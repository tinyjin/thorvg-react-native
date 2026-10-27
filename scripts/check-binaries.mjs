import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const libs = join(root, 'libs');

const required = {
  ios: ['thorvg.xcframework/Info.plist', 'wgpu-stub.xcframework/Info.plist', 'VERSION'],
  android: [
    'include/thorvg_capi.h',
    'arm64-v8a/libthorvg.a',
    'armeabi-v7a/libthorvg.a',
    'x86_64/libthorvg.a',
    'x86/libthorvg.a',
    'VERSION',
  ],
};

const version = execFileSync('git', ['-C', join(root, 'thorvg'), 'describe', '--tags', '--always'], {
  encoding: 'utf8',
}).trim();

const errors = [];
if (!existsSync(join(libs, 'LICENSE'))) errors.push('libs: missing LICENSE');
for (const [platform, files] of Object.entries(required)) {
  const missing = files.filter((file) => !existsSync(join(libs, platform, file)));
  if (missing.length) {
    errors.push(`libs/${platform}: missing ${missing.join(', ')}`);
    continue;
  }
  const built = readFileSync(join(libs, platform, 'VERSION'), 'utf8').trim();
  if (built !== version) errors.push(`libs/${platform}: built from ${built}, submodule is ${version}`);
}

if (errors.length) {
  console.error(`${errors.join('\n')}\nRun yarn build:thorvg first.`);
  process.exit(1);
}

console.log(`Prebuilt ThorVG ${version} found for ${Object.keys(required).join(', ')}`);
