import app from './app.js';
import { ensureReady } from './db.js';
const port = Number(process.env.PORT || 4000);
try {
  await ensureReady();
  app.listen(port, () => console.log(`Tara PM running on http://localhost:${port}`));
} catch (error) {
  console.error('Failed to initialize database:', error.message);
  process.exitCode = 1;
}
