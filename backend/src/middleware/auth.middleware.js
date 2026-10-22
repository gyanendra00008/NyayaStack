const userModel = require("../models/auth.models.js");



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


module.exports = { isExistingUser };