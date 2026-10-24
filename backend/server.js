require('dotenv').config();
const app = require('./src/app.js');
const connectDB = require('./src/config/db.js');
const { validateJwtSecret } = require('./src/config/jwt.config.js');

// Validate critical security secrets before application boot
validateJwtSecret();

connectDB();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server Is Running on Port " + PORT);
});

