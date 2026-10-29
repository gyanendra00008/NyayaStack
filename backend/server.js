   const dns = require('dns');
   dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();
const app = require('./src/app.js');
const connectDB = require('./src/config/db.js');
const { validateJwtSecret } = require('./src/config/jwt.config.js');
const { invokeMlServiceOnStartup } = require('./src/services/ml.service.js');

// Validate critical security secrets before application boot
validateJwtSecret();

connectDB();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server Is Running on Port " + PORT);
  // Send request to probe and warm up the ML service on backend startup
  invokeMlServiceOnStartup();
});

