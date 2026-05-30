import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import './dns-setup.js'; // DNS setup

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, '.env') });

import express from 'express';
import cors from 'cors';
import connectMongoDB from './config/db.js';
import errorHandler from './middleware/errorHandler.js';

// Route imports
import authRoutes from './routes/auth.js';
import queryRoutes from './routes/query.js';
import searchRoutes from './routes/search.js';
import questionRoutes from './routes/questions.js';
import answerRoutes from './routes/answers.js';
import adminRoutes from './routes/admin.js';
import faqRoutes from './routes/faqs.js';
import categoryRoutes from './routes/categories.js';
console.log("MONGO URI:", process.env.MONGODB_URI);
const app = express();
const PORT = process.env.PORT || 5000;

// --- Middleware ---
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// --- Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/query', queryRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/answers', answerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/faqs', faqRoutes);
app.use('/api/categories', categoryRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Global Error Handler ---
app.use((err, req, res, next) => {
  console.error('ERROR:', err);
  res.status(500).json({ error: err.message || 'Something went wrong on the server. Please try again later.' });
});

// --- Start Server ---
const startServer = async () => {
  await connectMongoDB();

  app.listen(PORT, () => {
    console.log(`🚀 Samagama server running on port ${PORT}`);
  });
};

startServer();
