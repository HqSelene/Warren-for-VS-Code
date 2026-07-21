const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const outDir = path.resolve(projectRoot, 'out');

if (path.dirname(outDir) !== projectRoot || path.basename(outDir) !== 'out') {
  throw new Error(`Refusing to clean unexpected path: ${outDir}`);
}

fs.rmSync(outDir, { recursive: true, force: true });
