import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import authRoutes from './routes/auth.js';
import exerciseRoutes from './routes/exercises.js';
import workoutRoutes from './routes/workouts.js';
import templateRoutes from './routes/templates.js';
import activityRoutes from './routes/activity.js';
import adminRoutes from './routes/admin.js';
import publicRoutes from './routes/public.js';
import shareRoutes from './routes/share.js';
import socialRoutes from './routes/social.js';
import notificationsRoutes from './routes/notifications.js';
import cronRoutes from './routes/cron.js';
import goalRoutes from './routes/goals.js';
import nutritionRoutes from './routes/nutrition.js';
import aiRoutes from './routes/ai.js';

const app = express();
const PORT = process.env.PORT || 5000;

/** One hop (e.g. Render, Fly) so express-rate-limit sees the real client IP. */
if (process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
  })
);

/** Comma-separated list, e.g. https://app.vercel.app,http://localhost:5173 */
function corsOrigins() {
  const raw = process.env.CLIENT_URL || 'http://localhost:5173';
  return String(raw)
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

const allowedOrigins = corsOrigins();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      const normalized = origin.replace(/\/$/, '');
      if (allowedOrigins.includes(normalized)) {
        return callback(null, true);
      }
      callback(null, false);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/public', publicRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/cron', cronRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/exercises', exerciseRoutes);
app.use('/api/workouts', workoutRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/nutrition', nutritionRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/admin', adminRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

const uri = process.env.MONGODB_URI?.trim();
if (!uri) {
  console.error(
    'Startup failed: MONGODB_URI is missing or empty. Set it in Render → Environment (or .env locally).'
  );
  process.exit(1);
}
const jwt = process.env.JWT_SECRET?.trim();
if (!jwt) {
  console.error(
    'Startup failed: JWT_SECRET is missing or empty. Set it in Render → Environment (or .env locally).'
  );
  process.exit(1);
}

mongoose
  .connect(uri)
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`API listening on port ${PORT}`);
    });
  })
  .catch((e) => {
    console.error('MongoDB connection failed:', e.message || e);
    console.error(
      'Check MONGODB_URI, Atlas Network Access (allow 0.0.0.0/0 or Render), and URL-encoded password if needed.'
    );
    process.exit(1);
  });
