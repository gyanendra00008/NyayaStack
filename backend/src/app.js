import express from 'express';
import cors from 'cors';
import healthRoutes from './routes/health.routes.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api/health', healthRoutes);

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
