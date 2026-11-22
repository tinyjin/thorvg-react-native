import type { Ref } from 'react';
import type { ViewProps } from 'react-native';
import type {
  Canvas,
  CanvasOptions,
  CanvasTarget as WebCanvasTarget,
  InitOptions as WebCanvasInitOptions,
  ThorVGNamespace,
} from '@thorvg/webcanvas';
import type { CanvasRef, CanvasTarget } from './canvas/CanvasTarget';

export type AndroidBackingView = 'TextureView' | 'SurfaceView';

export interface CanvasViewProps extends ViewProps {
  ref?: Ref<CanvasTarget>;
  androidBackingView?: AndroidBackingView;
}

export interface CanvasProps extends CanvasViewProps, CanvasOptions {
  viewport?: { x: number; y: number; width: number; height: number };
}

export type ThorVG = Omit<ThorVGNamespace, 'Canvas' | 'Video'> & {
  Canvas: new (
    target: CanvasRef | CanvasTarget | string | WebCanvasTarget,
    options?: CanvasOptions
  ) => Canvas;
};

export type Renderer =
  NonNullable<WebCanvasInitOptions['renderer']> | 'mtl' | 'vk';

export type InitOptions = Omit<WebCanvasInitOptions, 'renderer'> & {
  renderer?: Renderer;
};
