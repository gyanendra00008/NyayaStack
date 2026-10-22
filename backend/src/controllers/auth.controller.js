const UserModel = require("../models/auth.models.js");
const jwt = require("jsonwebtoken");

const registerUser = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    // const existingUser = await UserModel.findOne({
    //   $or: [{ username: username }, { email: email }],
    // });
    // if (existingUser) {
    //   return res.status(409).json({ message: "User already exists" });
    // }

    const newUser = await UserModel.create({
      username,
      email,
      password,
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

module.exports = {
  registerUser,
};
