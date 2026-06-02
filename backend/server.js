import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import './dns-setup.js'; // Must be first — overrides system DNS before any network calls

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, '.env') });

import express from 'express';
import cors from 'cors';
import connectMongoDB from './config/db.js';
import errorHandler from './middleware/errorHandler.js';
import logger from './utils/logger.js';

// Route imports
import authRoutes     from './routes/auth.js';
import queryRoutes    from './routes/query.js';
import searchRoutes   from './routes/search.js';
import questionRoutes from './routes/questions.js';
import answerRoutes   from './routes/answers.js';
import adminRoutes    from './routes/admin.js';
import faqRoutes      from './routes/faqs.js';
import categoryRoutes from './routes/categories.js';

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/query',      queryRoutes);
app.use('/api/search',     searchRoutes);
app.use('/api/questions',  questionRoutes);
app.use('/api/answers',    answerRoutes);
app.use('/api/admin',      adminRoutes);
app.use('/api/faqs',       faqRoutes);
app.use('/api/categories', categoryRoutes);

// ── Health check ────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Global error handler ────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  logger.error('Server', `Unhandled exception: ${err.message}`);
  // AppError uses `statusCode` (number); fallback to 500 for unexpected errors
  const httpStatus = typeof err.statusCode === 'number' ? err.statusCode
                   : typeof err.status    === 'number' ? err.status
                   : 500;
  res.status(httpStatus).json({
    error: err.message || 'An unexpected server error occurred. Please try again later.',
  });
});

// ── Bootstrap ───────────────────────────────────────────────────────────────
const startServer = async () => {
  await connectMongoDB();
  app.listen(PORT, () => logger.banner(PORT));
};

startServer();
