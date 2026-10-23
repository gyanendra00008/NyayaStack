const userModel = require("../models/auth.models.js");

//Validate user input for registration
async function validateUser(req, res, next) {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({
            success: false,
             message: "Username, email, and password are required" 
            });
    }
    next();
}

//Check if the user already exists in the database for Registration
async function isExistingUser(req, res, next) {
    const { username, email } = req.body;

    try {
        const existingUser = await userModel.findOne({
            $or: [
                { username: username },
                { email: email }
            ]
        });

        if (existingUser) {
            return res.status(409).json({ message: "User already exists" });
        }

        next();
    } catch (error) {
        console.error("Error checking existing user:", error);
        res.status(500).json({ message: "Internal server error" });
    }

}

//Check if the user exists in the database for Login
async function isUser(req, res, next) {
    const { username, email } = req.body;
    
    try {
        const user = await userModel.findOne({
            $or: [
                { username: username },
                { email: email }
            ]
        });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        req.user = user; 
        next();
    } catch (error) {
        console.error("Error checking user:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

module.exports = { isExistingUser, isUser , validateUser};