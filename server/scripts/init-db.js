// Creates the schema (tables) and seeds an admin user for the configured driver.
//   SQLite (default): also happens automatically on `npm start`.
// Usage:  npm run init-db
import { ensureReady, driver } from '../db.js';

ensureReady()
  .then(() => {
    console.log(`Database ready (driver: ${driver}).`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('init-db failed:', err.message);
    process.exit(1);
  });
