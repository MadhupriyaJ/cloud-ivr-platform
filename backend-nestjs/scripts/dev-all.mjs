#!/usr/bin/env node
/**
 * Runs the NestJS backend (watch mode) and the Vite dev server together in one
 * terminal, so `npm run dev` is the single command for local development.
 *
 * Backend  -> http://localhost:8010  (API under /api, websockets on /ws)
 * Frontend -> http://localhost:5173  (proxied/pointed at the backend)
 *
 * Ctrl+C stops both; if either process dies, the other is torn down too.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const frontendRoot = resolve(backendRoot, '..', 'typescript', 'vite');

if (!existsSync(join(frontendRoot, 'node_modules'))) {
  console.error(`Frontend dependencies missing. Run: npm install --prefix "${frontendRoot}"`);
  process.exit(1);
}

const children = [];
let shuttingDown = false;

/** Prefix every line so two interleaved dev servers stay readable. */
function start(name, args, cwd) {
  const child = spawn('npm', args, { cwd, shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const write = (stream) => (chunk) => {
    for (const line of chunk.toString().split('\n')) {
      if (line.trim()) stream.write(`[${name}] ${line}\n`);
    }
  };
  child.stdout.on('data', write(process.stdout));
  child.stderr.on('data', write(process.stderr));
  child.on('exit', (code) => {
    if (shuttingDown) return;
    console.error(`[${name}] exited with code ${code} - stopping the other process.`);
    shutdown(code ?? 1);
  });
  children.push(child);
  return child;
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode === null) child.kill();
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

start('backend', ['run', 'start:dev'], backendRoot);
start('frontend', ['run', 'dev'], frontendRoot);
