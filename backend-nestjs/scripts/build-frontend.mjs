#!/usr/bin/env node
/**
 * Builds the Vite frontend and copies it to backend-nestjs/public/ so the
 * NestJS ServeStaticModule serves the UI from the same process as the API.
 *
 * Replaces the old inline `cd ... && cp -r ...` script, which only ran on a
 * POSIX shell and silently never produced public/ on Windows.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, rmSync, cpSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const frontendRoot = resolve(backendRoot, '..', 'typescript', 'vite');
const frontendDist = join(frontendRoot, 'dist');
const publicDir = join(backendRoot, 'public');

/** npm is a .cmd shim on Windows; spawn it through the shell so PATH lookup works. */
function run(command, args, cwd) {
  console.log(`> ${command} ${args.join(' ')}  (in ${cwd})`);
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    throw new Error(`"${command} ${args.join(' ')}" exited with code ${result.status}`);
  }
}

if (!existsSync(frontendRoot)) {
  throw new Error(`Frontend not found at ${frontendRoot}`);
}

// Skip the reinstall when node_modules is already there - it turns a 3 second
// rebuild into a multi-minute one.
if (!existsSync(join(frontendRoot, 'node_modules'))) {
  run('npm', ['install'], frontendRoot);
}

run('npm', ['run', 'build'], frontendRoot);

if (!existsSync(frontendDist)) {
  throw new Error(`Frontend build produced no dist/ at ${frontendDist}`);
}

rmSync(publicDir, { recursive: true, force: true });
cpSync(frontendDist, publicDir, { recursive: true });

console.log(`Frontend copied to ${publicDir}`);
