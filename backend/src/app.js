const express = require('express');
const cors = require('cors');
const healthRoutes = require('./routes/health.routes.js');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler.js');
const authRoutes = require('./routes/auth.routes.js');
const { generalLimiter } = require('./middleware/rateLimit.middleware.js');

const app = express();
app.use(cors());
app.use(express.json());
app.use(generalLimiter);


app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);




app.use(notFoundHandler);
app.use(errorHandler);





module.exports = app;
