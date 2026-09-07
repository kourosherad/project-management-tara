import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
function check(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) check(file);
    else if (/\.(m?js)$/.test(entry.name)) execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  }
}
for (const dir of ['server', 'public/js', 'scripts']) check(dir);
execFileSync(process.execPath, ['--check', 'app.js'], { stdio: 'inherit' });
console.log('JavaScript syntax checks passed. Static assets are served directly from public/.');
