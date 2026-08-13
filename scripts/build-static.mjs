import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await fs.mkdir(path.join(root, 'public', 'api'), { recursive: true });
await Promise.all([
  fs.copyFile(path.join(root, 'data', 'latest.json'), path.join(root, 'public', 'api', 'latest.json')),
  fs.copyFile(path.join(root, 'config', 'benchmarks.json'), path.join(root, 'public', 'api', 'benchmarks.json'))
]);
console.log('Static dashboard payload prepared.');
