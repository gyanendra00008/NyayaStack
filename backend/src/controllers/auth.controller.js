const UserModel = require("../models/auth.models.js");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

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

    const newUser = await UserModel.create({
      username: username,
      email: email,
      password: hashedpassword,
      role: role || 'user',
    });

    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET);

    res.cookie("token", token)
    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error("Error registering user:", error);
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
        },
    });

}
module.exports = {
  registerUser,
  login
};
