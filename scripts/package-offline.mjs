import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const python = process.platform === 'win32' ? 'python' : 'python3';
const packager = fileURLToPath(new URL('./package-offline.py', import.meta.url));
execFileSync(python, [packager], { stdio: 'inherit' });
