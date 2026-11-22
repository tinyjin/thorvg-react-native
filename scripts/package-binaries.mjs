import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const libs = join(root, 'libs');
const output = join(root, 'build', 'binaries');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const meson = readFileSync(join(root, 'thorvg/meson.build'), 'utf8');
const version = meson.match(/version\s*:\s*'([^']+)'/)?.[1];
if (!version) throw new Error('Could not read the ThorVG version from thorvg/meson.build');

const targets = [
  {
    name: 'thorvg-react-native-ios',
    directory: 'thorvg-react-native-ios',
    description: 'Prebuilt ThorVG xcframework for thorvg-react-native',
    source: join(libs, 'ios'),
    required: ['thorvg.xcframework/Info.plist', 'VERSION'],
  },
  {
    name: 'thorvg-react-native-android',
    directory: 'thorvg-react-native-android',
    description: 'Prebuilt ThorVG static libraries for thorvg-react-native',
    source: join(libs, 'android'),
    required: [
      'include/thorvg_capi.h',
      'arm64-v8a/libthorvg.a',
      'armeabi-v7a/libthorvg.a',
      'x86_64/libthorvg.a',
      'x86/libthorvg.a',
      'VERSION',
    ],
  },
];

const only = process.argv.slice(2);
const selected = only.length
  ? targets.filter((target) => only.some((platform) => target.directory.endsWith(`-${platform}`)))
  : targets;

rmSync(output, { recursive: true, force: true });

for (const target of selected) {
  for (const file of target.required) {
    if (!existsSync(join(target.source, file))) {
      throw new Error(`${target.name}: missing ${file}. Run yarn build:thorvg first.`);
    }
  }

  const directory = join(output, target.directory);
  mkdirSync(directory, { recursive: true });
  cpSync(target.source, join(directory, 'libs'), { recursive: true });

  const files = ['libs'];

  const manifest = {
    name: target.name,
    version,
    description: target.description,
    license: pkg.license,
    author: pkg.author,
    repository: pkg.repository,
    files,
    publishConfig: { access: 'public' },
  };
  writeFileSync(join(directory, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`${target.name}@${version} -> ${directory}`);
}
