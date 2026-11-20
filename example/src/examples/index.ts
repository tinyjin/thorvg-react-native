import type { ComponentType } from 'react';
import type { ImageSourcePropType } from 'react-native';
import ConicGradient from './conic-gradient';
import CustomTransform from './custom-transform';
import DirectUpdate from './direct-update';
import FillRule from './fill-rule';
import FillSpread from './fill-spread';
import GradientStroke from './gradient-stroke';
import GradientTransform from './gradient-transform';
import LinearGradient from './linear-gradient';
import Opacity from './opacity';
import Path from './path';
import RadialGradient from './radial-gradient';
import Retaining from './retaining';
import Scene from './scene';
import SceneBlending from './scene-blending';
import SceneTransform from './scene-transform';
import Shapes from './shapes';
import Stroke from './stroke';
import StrokeLine from './stroke-line';
import StrokeMiterlimit from './stroke-miterlimit';
import Transform from './transform';
import TrimPath from './trim-path';
import Accessor from './accessor';
import Blending from './blending';
import BoundingBox from './bounding-box';
import Clipping from './clipping';
import Duplicate from './duplicate';
import EffectDropShadow from './effect-drop-shadow';
import ErrorHandling from './error-handling';
import GradientMasking from './gradient-masking';
import Intersects from './intersects';
import Masking from './masking';
import MaskingMethods from './masking-methods';
import MotionBlur from './motion-blur';
import SceneEffects from './scene-effects';
import Viewport from './viewport';
import TextLayout from './text-layout';
import TextLineWrap from './text-line-wrap';
import TextMetrics from './text-metrics';
import TextOtf from './text-otf';
import TextTtf from './text-ttf';
import Animation from './animation';
import DataLoad from './data-load';
import Lottie from './lottie';
import LottieAssetResolver from './lottie-asset-resolver';
import LottieExpressions from './lottie-expressions';
import LottieInteraction from './lottie-interaction';
import LottieSlot from './lottie-slot';
import Picture from './picture';
import PictureData from './picture-data';
import PictureJpg from './picture-jpg';
import PicturePng from './picture-png';
import PictureRaw from './picture-raw';
import PictureSvg from './picture-svg';
import PictureTransform from './picture-transform';
import PictureWebp from './picture-webp';
import Svg from './svg';
import ComponentsShapes from './components-shapes';
import ComponentsScene from './components-scene';
import ComponentsMasking from './components-masking';
import ComponentsPicture from './components-picture';
import ComponentsText from './components-text';
import ComponentsLottie from './components-lottie';
import ViewsLottie from './views-lottie';
import ViewsSvg from './views-svg';

export type ExampleCategory =
  'basic' | 'advanced' | 'text' | 'media' | 'components' | 'views';

export interface Example {
  id: string;
  title: string;
  description: string;
  category: ExampleCategory;
  thumbnail: string | ImageSourcePropType;
  Component: ComponentType;
}

export const examples: Example[] = [
  {
    id: 'conic-gradient',
    title: 'Conic Gradient',
    description: 'Demonstrate conic gradients',
    category: 'basic',
    thumbnail: '/assets/conic-gradient-thumbnail.png',
    Component: ConicGradient,
  },
  {
    id: 'custom-transform',
    title: 'Custom Transform',
    description: 'Apply custom transformation matrices to shapes',
    category: 'basic',
    thumbnail: '/assets/custom-transform-matrix-thumbnail.png',
    Component: CustomTransform,
  },
  {
    id: 'direct-update',
    title: 'Direct Update',
    description: 'Direct shape updates with retained properties',
    category: 'basic',
    thumbnail: '/assets/direct-update-thumbnail.png',
    Component: DirectUpdate,
  },
  {
    id: 'fill-rule',
    title: 'Fill Rule',
    description: 'Demonstrate shape fill rules',
    category: 'basic',
    thumbnail: '/assets/fill-rule-thumbnail.png',
    Component: FillRule,
  },
  {
    id: 'fill-spread',
    title: 'Fill Spread',
    description: 'Demonstrate gradient spread modes',
    category: 'basic',
    thumbnail: '/assets/fill-spread-thumbnail.png',
    Component: FillSpread,
  },
  {
    id: 'gradient-stroke',
    title: 'Gradient Stroke',
    description: 'Apply linear and radial gradients to strokes',
    category: 'basic',
    thumbnail: '/assets/gradient-stroke-thumbnail.png',
    Component: GradientStroke,
  },
  {
    id: 'gradient-transform',
    title: 'Gradient Transform',
    description: 'Animate gradients with shape transformations',
    category: 'basic',
    thumbnail: '/assets/gradient-with-transform-thumbnail.png',
    Component: GradientTransform,
  },
  {
    id: 'linear-gradient',
    title: 'Linear Gradient',
    description: 'Apply linear gradients to shapes',
    category: 'basic',
    thumbnail: '/assets/gradient-thumbnail.png',
    Component: LinearGradient,
  },
  {
    id: 'opacity',
    title: 'Opacity',
    description: 'Demonstrate opacity control on shapes and scenes',
    category: 'basic',
    thumbnail: '/assets/opacity-thumbnail.png',
    Component: Opacity,
  },
  {
    id: 'path',
    title: 'Path',
    description: 'Draw shapes using path commands',
    category: 'basic',
    thumbnail: '/assets/path-drawing-thumbnail.png',
    Component: Path,
  },
  {
    id: 'radial-gradient',
    title: 'Radial Gradient',
    description: 'Demonstrate radial gradients',
    category: 'basic',
    thumbnail: '/assets/radial-gradient-thumbnail.png',
    Component: RadialGradient,
  },
  {
    id: 'retaining',
    title: 'Retaining',
    description: 'Reorder retained paints by removing and re-adding them',
    category: 'basic',
    thumbnail: '/assets/retaining-thumbnail.png',
    Component: Retaining,
  },
  {
    id: 'scene',
    title: 'Scene',
    description:
      'Group shapes together using scenes for hierarchical organization',
    category: 'basic',
    thumbnail: '/assets/scene-hierarchy-thumbnail.png',
    Component: Scene,
  },
  {
    id: 'scene-blending',
    title: 'Scene Blending',
    description: 'Demonstrate scene blending modes',
    category: 'basic',
    thumbnail: '/assets/scene-blending-thumbnail.png',
    Component: SceneBlending,
  },
  {
    id: 'scene-transform',
    title: 'Scene Transform',
    description:
      'Animate scene transformations with rotate, scale, and translate',
    category: 'basic',
    thumbnail: '/assets/scene-transform-animation-thumbnail.png',
    Component: SceneTransform,
  },
  {
    id: 'shapes',
    title: 'Shapes',
    description: 'Draw simple shapes',
    category: 'basic',
    thumbnail: '/assets/shape-thumbnail.png',
    Component: Shapes,
  },
  {
    id: 'stroke',
    title: 'Stroke',
    description: 'Demonstrate stroke width, join, and cap styles',
    category: 'basic',
    thumbnail: '/assets/stroke-styles-thumbnail.png',
    Component: Stroke,
  },
  {
    id: 'stroke-line',
    title: 'Stroke Line',
    description: 'Demonstrate stroke join and cap styles',
    category: 'basic',
    thumbnail: '/assets/stroke-line-styles-thumbnail.png',
    Component: StrokeLine,
  },
  {
    id: 'stroke-miterlimit',
    title: 'Stroke Miterlimit',
    description: 'Demonstrate stroke miter limit behavior',
    category: 'basic',
    thumbnail: '/assets/stroke-miter-limit-thumbnail.png',
    Component: StrokeMiterlimit,
  },
  {
    id: 'transform',
    title: 'Transform',
    description: 'Animate shapes with translation, rotation and scaling',
    category: 'basic',
    thumbnail: '/assets/transform-thumbnail.png',
    Component: Transform,
  },
  {
    id: 'trim-path',
    title: 'Trim Path',
    description: 'Trim paths to show only portions of shapes',
    category: 'basic',
    thumbnail: '/assets/trimpath-thumbnail.png',
    Component: TrimPath,
  },
  {
    id: 'accessor',
    title: 'Accessor',
    description:
      'Traverse a picture scene tree and modify paint properties by ID',
    category: 'advanced',
    thumbnail: '/assets/accessor-thumbnail.png',
    Component: Accessor,
  },
  {
    id: 'blending',
    title: 'Blending',
    description: 'Demonstrate all blend modes with various paint types',
    category: 'advanced',
    thumbnail: '/assets/blending-thumbnail.png',
    Component: Blending,
  },
  {
    id: 'bounding-box',
    title: 'Bounding Box',
    description: 'Display bounding boxes around objects',
    category: 'advanced',
    thumbnail: '/assets/boundingbox-thumbnail.png',
    Component: BoundingBox,
  },
  {
    id: 'clipping',
    title: 'Clipping',
    description: 'Demonstrate clipping for shapes and scenes',
    category: 'advanced',
    thumbnail: '/assets/clipping-thumbnail.png',
    Component: Clipping,
  },
  {
    id: 'duplicate',
    title: 'Duplicate',
    description: 'Duplicate shapes, scenes, pictures, and objects',
    category: 'advanced',
    thumbnail: '/assets/duplicate-objects-thumbnail.png',
    Component: Duplicate,
  },
  {
    id: 'effect-drop-shadow',
    title: 'Effect Drop Shadow',
    description: 'Drop shadow effect applied to scene content',
    category: 'advanced',
    thumbnail: '/assets/effect-drop-shadow-thumbnail.png',
    Component: EffectDropShadow,
  },
  {
    id: 'error-handling',
    title: 'Error Handling',
    description: 'Global error handler catches',
    category: 'advanced',
    thumbnail: '/assets/error-handling-thumbnail.png',
    Component: ErrorHandling,
  },
  {
    id: 'gradient-masking',
    title: 'Gradient Masking',
    description: 'Demonstrate Alpha and InvAlpha masking with linear gradients',
    category: 'advanced',
    thumbnail: '/assets/gradient-masking-thumbnail.png',
    Component: GradientMasking,
  },
  {
    id: 'intersects',
    title: 'Intersects',
    description:
      'Interactive example demonstrating paint.intersects() API with mouse hover detection',
    category: 'advanced',
    thumbnail: '/assets/intersects-thumbnail.png',
    Component: Intersects,
  },
  {
    id: 'masking',
    title: 'Masking',
    description: 'Demonstrate Alpha, InvAlpha, Luma, and InvLuma masking',
    category: 'advanced',
    thumbnail: '/assets/masking-thumbnail.png',
    Component: Masking,
  },
  {
    id: 'masking-methods',
    title: 'Masking Methods',
    description:
      'Demonstrate mask composition methods (Add, Subtract, Intersect, Difference, Lighten, Darken)',
    category: 'advanced',
    thumbnail: '/assets/masking-methods-thumbnail.png',
    Component: MaskingMethods,
  },
  {
    id: 'motion-blur',
    title: 'Motion Blur',
    description: 'Motion blur effect applied to scene content',
    category: 'advanced',
    thumbnail: '/assets/motion-blur-thumbnail.png',
    Component: MotionBlur,
  },
  {
    id: 'scene-effects',
    title: 'Scene Effects',
    description:
      'Comprehensive demonstration of all scene effects: Gaussian Blur, Fill, Tint, and Tritone',
    category: 'advanced',
    thumbnail: '/assets/scene-effects-thumbnail.png',
    Component: SceneEffects,
  },
  {
    id: 'viewport',
    title: 'Viewport',
    description: 'Control canvas viewport for panning effects',
    category: 'advanced',
    thumbnail: '/assets/viewport-control-thumbnail.png',
    Component: Viewport,
  },
  {
    id: 'text-layout',
    title: 'Text Layout',
    description: 'Demonstrate text layout with alignment',
    category: 'text',
    thumbnail: '/assets/text-layout-thumbnail.png',
    Component: TextLayout,
  },
  {
    id: 'text-line-wrap',
    title: 'Text Line Wrap',
    description: 'Demonstrate text wrapping modes',
    category: 'text',
    thumbnail: '/assets/text-line-wrap-thumbnail.png',
    Component: TextLineWrap,
  },
  {
    id: 'text-metrics',
    title: 'Text Metrics',
    description: 'Type text with a cursor positioned by glyph metrics',
    category: 'text',
    thumbnail: '/assets/text-metrics-thumbnail.png',
    Component: TextMetrics,
  },
  {
    id: 'text-otf',
    title: 'Text OTF',
    description: 'Render text with OpenType fonts',
    category: 'text',
    thumbnail: '/assets/text-otf-thumbnail.png',
    Component: TextOtf,
  },
  {
    id: 'text-ttf',
    title: 'Text TTF',
    description: 'Render text with TrueType fonts',
    category: 'text',
    thumbnail: '/assets/text-thumbnail.png',
    Component: TextTtf,
  },
  {
    id: 'animation',
    title: 'Animation',
    description: 'Load and play a Lottie animation',
    category: 'media',
    thumbnail: '/assets/animation-thumbnail.png',
    Component: Animation,
  },
  {
    id: 'data-load',
    title: 'Data Load',
    description: 'Load a picture from in-memory SVG data',
    category: 'media',
    thumbnail: '/assets/data-load-thumbnail.png',
    Component: DataLoad,
  },
  {
    id: 'lottie',
    title: 'Lottie',
    description: 'Play a collection of Lottie animations',
    category: 'media',
    thumbnail: '/assets/lottie-thumbnail.png',
    Component: Lottie,
  },
  {
    id: 'lottie-asset-resolver',
    title: 'Lottie Asset Resolver',
    description: 'Supply external Lottie assets (images, fonts) at runtime',
    category: 'media',
    thumbnail: '/assets/lottie-asset-resolver-thumbnail.png',
    Component: LottieAssetResolver,
  },
  {
    id: 'lottie-expressions',
    title: 'Lottie Expressions',
    description: 'Lottie animations with expressions support',
    category: 'media',
    thumbnail: '/assets/lottie-expressions-thumbnail.png',
    Component: LottieExpressions,
  },
  {
    id: 'lottie-interaction',
    title: 'Lottie Interaction',
    description: 'Demonstrate interactivity with Lottie animation',
    category: 'media',
    thumbnail: '/assets/lottie-interaction-thumbnail.png',
    Component: LottieInteraction,
  },
  {
    id: 'lottie-slot',
    title: 'Lottie Slot',
    description: 'Override Lottie properties at runtime with slots',
    category: 'media',
    thumbnail: '/assets/lottie-slot-thumbnail.png',
    Component: LottieSlot,
  },
  {
    id: 'picture',
    title: 'Picture',
    description: 'Load and display a picture',
    category: 'media',
    thumbnail: '/assets/picture-thumbnail.png',
    Component: Picture,
  },
  {
    id: 'picture-data',
    title: 'Picture Data',
    description: 'Load and display a picture with raw pixel data',
    category: 'media',
    thumbnail: '/assets/picture-data-thumbnail.png',
    Component: PictureData,
  },
  {
    id: 'picture-jpg',
    title: 'Picture JPG',
    description: 'Load and display JPG images',
    category: 'media',
    thumbnail: '/assets/jpg-thumbnail.png',
    Component: PictureJpg,
  },
  {
    id: 'picture-png',
    title: 'Picture PNG',
    description: 'Load and display PNG images',
    category: 'media',
    thumbnail: '/assets/png-thumbnail.png',
    Component: PicturePng,
  },
  {
    id: 'picture-raw',
    title: 'Picture Raw',
    description: 'Load and display raw ARGB8888 image data',
    category: 'media',
    thumbnail: '/assets/raw-thumbnail.png',
    Component: PictureRaw,
  },
  {
    id: 'picture-svg',
    title: 'Picture SVG',
    description: 'Load and display a SVG image',
    category: 'media',
    thumbnail: '/assets/svg-picture-thumbnail.png',
    Component: PictureSvg,
  },
  {
    id: 'picture-transform',
    title: 'Picture Transform',
    description: 'Scale and rotate an image around its center origin',
    category: 'media',
    thumbnail: '/assets/picture-transform-thumbnail.png',
    Component: PictureTransform,
  },
  {
    id: 'picture-webp',
    title: 'Picture WebP',
    description: 'Load and display WebP images',
    category: 'media',
    thumbnail: '/assets/webp-thumbnail.png',
    Component: PictureWebp,
  },
  {
    id: 'svg',
    title: 'Svg',
    description: 'Load a collection of SVG images',
    category: 'media',
    thumbnail: '/assets/svg-thumbnail.png',
    Component: Svg,
  },
  {
    id: 'components-shapes',
    title: 'Shapes',
    description: 'Draw shapes, gradients, strokes and paths with components',
    category: 'components',
    thumbnail: require('../../assets/thumbnails/components-shapes.png'),
    Component: ComponentsShapes,
  },
  {
    id: 'components-scene',
    title: 'Scene',
    description: 'Animate a scene with state, effects and blending',
    category: 'components',
    thumbnail: require('../../assets/thumbnails/components-scene.png'),
    Component: ComponentsScene,
  },
  {
    id: 'components-masking',
    title: 'Masking',
    description: 'Clip and mask paints with components',
    category: 'components',
    thumbnail: require('../../assets/thumbnails/components-masking.png'),
    Component: ComponentsMasking,
  },
  {
    id: 'components-picture',
    title: 'Picture',
    description: 'Load SVG and PNG pictures with components',
    category: 'components',
    thumbnail: require('../../assets/thumbnails/components-picture.png'),
    Component: ComponentsPicture,
  },
  {
    id: 'components-text',
    title: 'Text',
    description: 'Render text with a loaded font, gradients and layout',
    category: 'components',
    thumbnail: require('../../assets/thumbnails/components-text.png'),
    Component: ComponentsText,
  },
  {
    id: 'components-lottie',
    title: 'Lottie',
    description: 'Play a Lottie animation with a component',
    category: 'components',
    thumbnail: require('../../assets/thumbnails/components-lottie.png'),
    Component: ComponentsLottie,
  },
  {
    id: 'views-lottie',
    title: 'LottieView',
    description: 'Play a Lottie from a URL with modes, speed and controls',
    category: 'views',
    thumbnail: require('../../assets/thumbnails/views-lottie.png'),
    Component: ViewsLottie,
  },
  {
    id: 'views-svg',
    title: 'SvgView',
    description: 'Show SVG from a URL or a string with fit and tint',
    category: 'views',
    thumbnail: require('../../assets/thumbnails/views-svg.png'),
    Component: ViewsSvg,
  },
];
