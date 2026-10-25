const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const healthRoutes = require('./routes/health.routes.js');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler.js');
const authRoutes = require('./routes/auth.routes.js');
const complaintRoutes = require('./routes/complaint.routes.js');
const { generalLimiter } = require('./middleware/rateLimit.middleware.js');

const app = express();

// Trust reverse proxy (e.g. Render, Heroku, Nginx, Cloudflare) when configured
if (process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY) {
  app.set('trust proxy', 1);
}

// CORS configuration supporting credentials safely (no wildcard with credentials)
const corsOptions = {
  origin: (origin, callback) => {
    // Parse allowed origins dynamically from CORS_ORIGIN environment variable
    const allowedOrigins = process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((item) => item.trim()).filter(Boolean)
      : [];

    // Allow non-browser requests (e.g. server-to-server, curl) with no Origin header
    if (!origin) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
};
app.use(cors(corsOptions));

app.use(cookieParser());
app.use(express.json({ limit: '10kb' }));
app.use(generalLimiter);

// Application routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes); // alias for backwards compatibility
app.use('/api/complaints', complaintRoutes);
app.use('/api/petitions', complaintRoutes);

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
