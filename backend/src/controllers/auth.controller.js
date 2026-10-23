const UserModel = require("../models/auth.models.js");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const {
  generateOtp,
  hashOtp,
  verifyOtpHash,
  getOtpExpiry,
  isOtpExpired,
} = require("../utils/otp.utils.js");
const { sendOtpEmail } = require("../services/mail.service.js");

const registerUser = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    // const existingUser = await UserModel.findOne({
    //   $or: [{ username: username }, { email: email }],
    // });
    // if (existingUser) {
    //   return res.status(409).json({ message: "User already exists" });
    // }
    const hashedpassword = await bcrypt.hash(password, 10);

    // Generate OTP and compute hash & expiry
    const otp = generateOtp(6);
    const hashedOtp = hashOtp(otp);
    const otpExpires = getOtpExpiry(10);

    let userRecord;
    if (req.existingUnverifiedUser) {
      userRecord = req.existingUnverifiedUser;
      userRecord.username = username;
      userRecord.password = hashedpassword;
      userRecord.role = role || userRecord.role || 'user';
      userRecord.otp = hashedOtp;
      userRecord.otpExpires = otpExpires;
      await userRecord.save();
    } else {
      userRecord = await UserModel.create({
        username: username,
        email: email,
        password: hashedpassword,
        role: role || 'user',
        otp: hashedOtp,
        otpExpires: otpExpires,
        isVerified: false,
      });
    }

    // Send verification email via Brevo
    try {
      await sendOtpEmail({
        to: email,
        otp,
        name: username,
      });
    } catch (mailError) {
      const errorMsg = mailError?.body?.message || mailError?.message || "Failed to dispatch email";
      console.error("Failed to send OTP email:", mailError?.body || mailError);
      return res.status(500).json({
        message: `Account created, but verification email could not be sent: ${errorMsg}. Please verify your Brevo sender configuration.`,
        error: errorMsg,
      });
    }

    const token = jwt.sign({ id: userRecord._id }, process.env.JWT_SECRET);

    res.cookie("token", token);
    res.status(201).json({
      message: "User registered successfully. Verification OTP sent to email.",
      user: {
        id: userRecord._id,
        username: userRecord.username,
        email: userRecord.email,
        role: userRecord.role,
        isVerified: userRecord.isVerified,
      },
    });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "Email is already verified" });
    }

    if (!user.otp || !user.otpExpires) {
      return res.status(400).json({ message: "No OTP request found for this user" });
    }

    if (isOtpExpired(user.otpExpires)) {
      return res.status(400).json({ message: "OTP has expired. Please request a new one" });
    }

    const isOtpValid = verifyOtpHash(otp, user.otp);
    if (!isOtpValid) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    res.cookie("token", token);

    res.status(200).json({
      message: "Email verified successfully",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "Email is already verified" });
    }

    const otp = generateOtp(6);
    user.otp = hashOtp(otp);
    user.otpExpires = getOtpExpiry(10);
    await user.save();

    try {
      await sendOtpEmail({
        to: user.email,
        otp,
        name: user.username,
      });
    } catch (mailError) {
      const errorMsg = mailError?.body?.message || mailError?.message || "Failed to dispatch email";
      console.error("Failed to resend OTP email:", mailError?.body || mailError);
      return res.status(500).json({
        message: `Failed to send verification email: ${errorMsg}`,
        error: errorMsg,
      });
    }
    
    res.status(200).json({
      message: "New OTP sent successfully to your email",
    });
  } catch (error) {
    console.error("Error resending OTP:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};



const login = async (req , res) => {

    const { username, email, password } = req.body;
    const hash = await bcrypt.hash(password, 10);
    
    const User = req.user;

    const isPasswordValid = await bcrypt.compare(password, User.password);

    if(!isPasswordValid) {
        return res.status(401).json({ message: "Invalid password" });
    }
        
    const token = jwt.sign({ id: User._id }, process.env.JWT_SECRET);
    res.cookie("token", token)

    res.status(200).json({
        message: "Login successful",
        user: {
            id: User._id,
            username: User.username,
            email: User.email,
            role: User.role,
            isVerified: User.isVerified,
        },
    });

}
module.exports = {
  registerUser,
  login,
  verifyOtp,
  resendOtp,
};
