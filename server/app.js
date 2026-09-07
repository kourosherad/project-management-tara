import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { rootDir, demoMode, maxUploadBytes, onVercel } from './config.js';
import { ensureReady } from './db.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import documentRoutes from './routes/documents.js';
import memberRoutes from './routes/members.js';
import taskRoutes from './routes/tasks.js';
import qualityRoutes from './routes/quality.js';
import gitlabRoutes from './routes/gitlab.js';
import aiRoutes from './routes/ai.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use('/api', async (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  await ensureReady();
  next();
});
app.get('/api/health', (req, res) => res.json({
  ok: true, demo: demoMode, storage: demoMode ? 'temporary' : 'local',
  maxUploadBytes, time: new Date().toISOString(),
}));
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/quality', qualityRoutes);
app.use('/api/gitlab', gitlabRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found' }));
const publicDir = path.join(rootDir, 'public');
app.use(express.static(publicDir));
app.get(/^(?!\/api).*/, (req, res) => {
  // Vercel serves public/ on its CDN, outside the function's filesystem.
  if (onVercel) return res.redirect('/index.html');
  res.sendFile(path.join(publicDir, 'index.html'));
});
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `File too large. Maximum size is ${maxUploadBytes / 1024 / 1024} MB.` });
  }
  console.error(err.message);
  const status = err.status || 500;
  res.status(status).json({ error: status >= 500 ? 'Server error. Please try again.' : err.message });
});
export default app;
