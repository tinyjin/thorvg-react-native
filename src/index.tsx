export { Canvas } from './canvas/Canvas';
export {
  Animation,
  Circle,
  Clip,
  ConicGradient,
  Font,
  LinearGradient,
  LottieAnimation,
  Mask,
  Path,
  Picture,
  RadialGradient,
  Rect,
  Scene,
  Text,
} from './components';
export type * from './components/props';
export type { Color } from './color';
export * from './constants';
export type { CanvasTarget } from './canvas/CanvasTarget';
export { LottieView } from './views/LottieView';
export { SvgView } from './views/SvgView';
export type { LottieMode, LottieViewProps } from './views/LottieView';
export type { SvgViewProps } from './views/SvgView';
export type { ContentFit, ContentPosition } from './views/fit';
export type { LottieSource, SvgSource, UriSource } from './views/source';
export { init } from './init';
export { useThorVG } from './useThorVG';
export { ThorVGError, ThorVGResultCode } from './platform';

export type {
  AndroidBackingView,
  CanvasProps,
  InitOptions,
  ThorVG,
} from './types';

export type {
  Accessor,
  AnimationInfo,
  AnimationSegment,
  AssetResolver,
  AudioInfo,
  AudioResolver,
  Bounds,
  CanvasOptions,
  ColorStop,
  ErrorContext,
  ErrorHandler,
  FontProvider,
  FontProviderResult,
  FontType,
  GlyphMetrics,
  LoadDataOptions,
  LoadFontOptions,
  LottieMarker,
  LottieSlotData,
  Matrix,
  MimeType,
  Paint,
  PictureSize,
  RectOptions,
  RendererType,
  Shape,
  StrokeOptions,
  TextLayout,
  TextMetrics,
  TextOutline,
} from '@thorvg/webcanvas';
