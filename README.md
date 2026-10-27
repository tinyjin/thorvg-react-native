# ThorVG for React Native

<p align="center">
  <img width="550" height="auto" src="https://github.com/thorvg/thorvg.site/blob/main/readme/logo/animated_brand.svg">
</p>

[ThorVG](https://github.com/thorvg/thorvg) vector graphics and Lottie for React Native on Android, iOS and web.

> Full documentation [here](https://tinyjin.github.io/thorvg-react-native)

## Installation

```sh
npm install thorvg-react-native
```

## Usage

### Components (Declarative API)

Draw with React components (JSX).

```tsx
import { Canvas, Rect } from 'thorvg-react-native';

const Example = () => (
  <Canvas width={200} height={160}>
    <Rect x={20} y={20} width={160} height={120} rx={16} ry={16} fill="#2563eb" />
  </Canvas>
);
```

### WebCanvas API

Use the [`@thorvg/webcanvas`](https://www.npmjs.com/package/@thorvg/webcanvas) API directly with `useThorVG`.

```tsx
import { useEffect, useRef } from 'react';
import { Canvas, useThorVG } from 'thorvg-react-native';

const Example = () => {
  const TVG = useThorVG({ renderer: 'sw' });
  const view = useRef<Canvas>(null);

  useEffect(() => {
    if (!TVG) return;
    const canvas = new TVG.Canvas(view, { width: 200, height: 160 });

    const shape = new TVG.Shape();
    shape.appendRect(20, 20, 160, 120, { rx: 16, ry: 16 }).fill(37, 99, 235, 255);
    canvas.add(shape).render();

    return () => canvas.destroy();
  }, [TVG]);

  return <Canvas ref={view} />;
}
```

### Views

#### LottieView

ThorVG provides a powerful Lottie runtime. You can play Lottie animations without installing any additional packages.

```tsx
import { LottieView } from 'thorvg-react-native';

<LottieView
  source={require('./confetti.json')}
  autoplay
  loop
  style={{ width: 200, height: 200 }}
/>
```

#### SvgView

SVG support is built into ThorVG. You can load SVG files directly.

```tsx
import { SvgView } from 'thorvg-react-native';

<SvgView
  source={{ uri: 'https://example.com/logo.svg' }}
  style={{ width: 120, height: 120 }}
/>
```

## Architecture

The Core API is compatible with [`@thorvg/webcanvas`](https://www.npmjs.com/package/@thorvg/webcanvas). On iOS and Android follow same classes run on the native ThorVG engine through [JSI](https://reactnative.dev/architecture/glossary#javascript-interfaces-jsi).

<p align="center">
  <img width="600" src="docs/static/img/architecture.svg" alt="thorvg-react-native architecture">
</p>

## Platform Notes

### Android

The JSI binding calls the ThorVG C API from `thorvg-react-native-android` and draws into the view's Android `Surface`.

- Canvases render into a `TextureView` by default.
- Android supports `'gl'` (OpenGL ES) and `'sw'`.

### iOS

The JSI binding calls the ThorVG C API from `thorvg-react-native-ios` and draws into the view's `CAMetalLayer`.

- Run `pod install` in your `ios` directory after installing the package.
- iOS supports `'sw'` and `'wg'` (WebGPU on Metal).
- To enable WebGPU, install `thorvg-react-native-webgpu`, then run `pod install` again.

### Web

Web platform uses `@thorvg/webcanvas`, which provides `thorvg.wasm` from default CDN. To serve it yourself, specify your own WASM URL:

```ts
useThorVG({ locateFile: (path) => 'https://example.com/path/to/' + path.split('/').pop() });
```

- `init()` option `locateFile` only applies on web.
- `threads` needs the COOP/COEP headers on web. See [Threads](https://tinyjin.github.io/thorvg-react-native/platforms#threads).
- Web supports `'sw'`, `'gl'`, and `'wg'` as default

## Development

### Requirements

- React Native 0.78+ (New Architecture)
- iOS 15.1+
- Android API 24+
- Node 24.15+
- Yarn 4.18+

### Build and Run

```sh
git submodule update --init
yarn
yarn build:thorvg            # prebuilt ThorVG into libs/ (needs meson, ninja, pkg-config, Xcode, Android NDK)
yarn example ios             # or: yarn example android, yarn example web
```
