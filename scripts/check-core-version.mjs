import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const meson = readFileSync(join(root, 'thorvg/meson.build'), 'utf8');
const core = meson.match(/version\s*:\s*'([^']+)'/)?.[1];

const dist = dirname(require.resolve('@thorvg/webcanvas'));
const bundle = readFileSync(join(dist, 'webcanvas.cjs.js'), 'utf8');
const web = bundle.match(/EngineOption:\w+,version:"([^"]+)"/)?.[1];
const pkg = JSON.parse(readFileSync(join(dist, '..', 'package.json'), 'utf8'));

if (!core || !web) {
  console.error(`Could not read ThorVG versions (submodule: ${core}, webcanvas: ${web})`);
  process.exit(1);
}

if (core !== web) {
  console.error(
    `ThorVG core mismatch: submodule is ${core}, @thorvg/webcanvas@${pkg.version} is built on ${web}`
  );
  process.exit(1);
}

console.log(`ThorVG ${core} matches @thorvg/webcanvas@${pkg.version}`);
