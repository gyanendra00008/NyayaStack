const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const healthRoutes = require('./routes/health.routes.js');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler.js');
const authRoutes = require('./routes/auth.routes.js');
const adminRoutes = require('./routes/admin.routes.js');
const complaintRoutes = require('./routes/complaint.routes.js');
const notificationRoutes = require('./routes/notification.routes.js');
const classifyComplaintRoutes = require('./routes/complaintClassifier.routes.js');
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
    const envOrigins = process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((item) => item.trim()).filter(Boolean)
      : [];

    // Safe default origins for local dev and standard production domains
    const defaultAllowed = [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      'http://127.0.0.1:3000',
    ];
    const allowedOrigins = [...new Set([...envOrigins, ...defaultAllowed])];

    // Allow non-browser requests (e.g. server-to-server, curl) with no Origin header
    if (!origin) {
      return callback(null, true);
    }
    if (
      allowedOrigins.includes(origin) ||
      /^https:\/\/nyayastack.*\.vercel\.app$/.test(origin)
    ) {
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
app.use('/api/admin', adminRoutes);
app.use('/admin', adminRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/petitions', complaintRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/notifications', notificationRoutes);
app.use('/api/classify-complaint', classifyComplaintRoutes);

// External Cron Webhook trigger for Render / external cron schedulers
app.post('/api/escalate-cron', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const bearerKey = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const cronKey = req.headers['x-cron-key'] || bearerKey || req.query.key;

  if (!cronKey || typeof cronKey !== 'string') {
    return res.status(401).json({ success: false, message: 'Unauthorized: missing cron secret key' });
  }

  const expectedKey =
    process.env.CRON_SECRET ||
    (process.env.NODE_ENV !== 'production' ? 'nyayastack-escalation-cron-secret' : null);

  if (!expectedKey) {
    return res.status(503).json({
      success: false,
      message: 'CRON_SECRET is not configured on this server',
    });
  }

  const bufProvided = Buffer.from(cronKey);
  const bufExpected = Buffer.from(expectedKey);

  if (bufProvided.length !== bufExpected.length || !crypto.timingSafeEqual(bufProvided, bufExpected)) {
    return res.status(401).json({ success: false, message: 'Unauthorized: invalid cron secret key' });
  }

  try {
    const { escalateDueComplaints } = require('./services/escalation.service.js');
    const summary = await escalateDueComplaints();
    return res.status(200).json({ success: true, summary });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
