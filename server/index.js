import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
dotenv.config();

import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import documentRoutes from './routes/documents.js';
import memberRoutes from './routes/members.js';
import taskRoutes from './routes/tasks.js';
import qualityRoutes from './routes/quality.js';
import gitlabRoutes from './routes/gitlab.js';
import aiRoutes from './routes/ai.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/quality', qualityRoutes);
app.use('/api/gitlab', gitlabRoutes);
app.use('/api/ai', aiRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Serve the static frontend (plain HTML/CSS/JS).
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));
// SPA-ish fallback for any non-API route -> serve the app shell.
app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(publicDir, 'index.html')));

// Central error handler — turns thrown errors into JSON.
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Server error' });
});

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log(`Tara PM server running on http://localhost:${PORT}`);
});
