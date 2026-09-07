// Vercel detects the direct Express import in this entry point.
import express from 'express';
import tara from './server/app.js';

const app = express();
app.disable('x-powered-by');
app.use(tara);
export default app;
