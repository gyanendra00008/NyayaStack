const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]); // TEMP: local testing only

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

  // Start the background hierarchical escalation scheduler
  if (process.env.NODE_ENV !== "test" && process.env.ENABLE_IN_PROCESS_SCHEDULER !== "false") {
    const { startEscalationScheduler } = require("./src/services/escalation.service.js");
    startEscalationScheduler();
    console.log("Hierarchical Complaint Escalation Scheduler initialized (48h default SLA window).");
  }
});

