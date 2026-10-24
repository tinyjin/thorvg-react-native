#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';

function resolveWebCanvas() {
  for (const base of [join(process.cwd(), 'package.json'), import.meta.url]) {
    try {
      return dirname(createRequire(base).resolve('@thorvg/webcanvas'));
    } catch {}
  }
  throw new Error('Could not resolve @thorvg/webcanvas. Install thorvg-react-native first.');
}

const target = resolve(process.cwd(), process.argv[2] ?? 'public');
const dist = resolveWebCanvas();
const wasm = join(dist, 'thorvg.wasm');

if (!existsSync(wasm)) {
  throw new Error(`thorvg.wasm not found in ${dist}`);
}

mkdirSync(target, { recursive: true });
copyFileSync(wasm, join(target, 'thorvg.wasm'));

// Handle thread preset build
mkdirSync(join(target, 'thread'), { recursive: true });
for (const file of ['webcanvas.esm.js', 'thorvg.wasm']) {
  copyFileSync(join(dist, 'thread', file), join(target, 'thread', file));
}

console.log(`Copied thorvg.wasm and thread/ to ${target}`);
console.log("Load it with init({ locateFile: (path) => '/' + path.split('/').pop() })");
console.log("With threads, use init({ threads, locateFile: (path) => '/thread/' + path.split('/').pop() })");
