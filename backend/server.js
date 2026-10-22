require('dotenv').config();
const app = require('./src/app.js');
const connectDB = require('./src/config/db.js');

connectDB();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server Is Running on Port " + PORT);
});
