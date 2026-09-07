// Talks to the local Claude Code CLI by spawning it as a child process.
// Stays fully offline/local — no API key required, uses your existing CLI login.
import { spawn } from 'node:child_process';
import { onVercel } from '../config.js';

const CLI = process.env.CLAUDE_CLI || 'claude';
const MODEL = process.env.CLAUDE_MODEL || '';

/**
 * Runs a one-shot prompt through the Claude CLI in print mode (-p) and
 * returns the raw text output. Throws if the CLI is missing or errors.
 *
 * @param {string} prompt
 * @param {object} opts  { timeoutMs }
 * @returns {Promise<string>}
 */
export function runClaude(prompt, opts = {}) {
  if (onVercel || process.env.CLAUDE_ENABLED !== 'true') {
    return Promise.reject(Object.assign(new Error('Local Claude integration is disabled.'), { status: 503 }));
  }
  const timeoutMs = opts.timeoutMs ?? 120000;
  const args = ['-p', prompt];
  if (MODEL) args.push('--model', MODEL);

  return new Promise((resolve, reject) => {
    let child;
    try {
      // shell:true so a Windows `claude.cmd` shim resolves correctly.
      child = spawn(CLI, args, { shell: true });
    } catch (err) {
      return reject(new Error(`Could not start Claude CLI ("${CLI}"): ${err.message}`));
    }

    let out = '';
    let errOut = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Claude CLI timed out'));
    }, timeoutMs);

    child.stdout.on('data', (d) => (out += d.toString()));
    child.stderr.on('data', (d) => (errOut += d.toString()));
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Claude CLI error: ${err.message}. Is "${CLI}" installed and on PATH?`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out.trim());
      else reject(new Error(`Claude CLI exited with code ${code}: ${errOut || out}`));
    });
  });
}

// Asks Claude to answer as strict JSON and parses it. Tolerates ```json fences.
export async function runClaudeJSON(prompt, opts = {}) {
  const wrapped =
    prompt +
    '\n\nRespond with ONLY valid JSON. Do not include any prose, explanation, or markdown code fences.';
  const raw = await runClaude(wrapped, opts);
  return extractJSON(raw);
}

export function extractJSON(text) {
  let t = text.trim();
  // strip ```json ... ``` fences if the model added them
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  // fall back to the first {...} or [...] block
  try {
    return JSON.parse(t);
  } catch {
    const m = t.match(/[\[{][\s\S]*[\]}]/);
    if (m) return JSON.parse(m[0]);
    throw new Error('Claude did not return valid JSON:\n' + text.slice(0, 500));
  }
}
