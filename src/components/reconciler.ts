import { createContext, type ReactNode } from 'react';
import Reconciler from 'react-reconciler';
import {
  DefaultEventPriority,
  LegacyRoot,
  NoEventPriority,
} from 'react-reconciler/constants';
import type { Canvas } from '@thorvg/webcanvas';
import type { ThorVG } from '../types';
import {
  AnimationNode,
  ClipNode,
  Container,
  FontNode,
  GradientNode,
  MaskNode,
  Node,
  PaintNode,
  PictureNode,
  SceneNode,
  ShapeNode,
  TextNode,
} from './nodes';

type Props = Record<string, unknown>;

export const HostType = {
  Rect: 'thorvg-rect',
  Circle: 'thorvg-circle',
  Path: 'thorvg-path',
  Scene: 'thorvg-scene',
  Picture: 'thorvg-picture',
  Text: 'thorvg-text',
  Animation: 'thorvg-animation',
  LottieAnimation: 'thorvg-lottie-animation',
  LinearGradient: 'thorvg-linear-gradient',
  RadialGradient: 'thorvg-radial-gradient',
  ConicGradient: 'thorvg-conic-gradient',
  Clip: 'thorvg-clip',
  Mask: 'thorvg-mask',
  Font: 'thorvg-font',
} as const;

function createNode(type: string, container: Container): Node {
  switch (type) {
    case HostType.Rect:
      return new ShapeNode(container, 'rect');
    case HostType.Circle:
      return new ShapeNode(container, 'circle');
    case HostType.Path:
      return new ShapeNode(container, 'path');
    case HostType.Scene:
      return new SceneNode(container);
    case HostType.Picture:
      return new PictureNode(container);
    case HostType.Text:
      return new TextNode(container);
    case HostType.Animation:
      return new AnimationNode(container, false);
    case HostType.LottieAnimation:
      return new AnimationNode(container, true);
    case HostType.LinearGradient:
      return new GradientNode(container, 'linear');
    case HostType.RadialGradient:
      return new GradientNode(container, 'radial');
    case HostType.ConicGradient:
      return new GradientNode(container, 'conic');
    case HostType.Clip:
      return new ClipNode(container);
    case HostType.Mask:
      return new MaskNode(container);
    case HostType.Font:
      return new FontNode(container);
  }
  throw new Error(`ThorVG: unknown element <${type}>`);
}

function disposeTree(node: Node): void {
  for (const child of node.children) disposeTree(child);
  node.dispose();
}

let updatePriority: number = NoEventPriority;
const hostContext = {};

const reconciler = Reconciler({
  rendererPackageName: 'thorvg-react-native',
  rendererVersion: '1',
  supportsMutation: true,
  supportsPersistence: false,
  supportsHydration: false,
  isPrimaryRenderer: false,
  noTimeout: -1,
  scheduleTimeout: setTimeout,
  cancelTimeout: clearTimeout,
  supportsMicrotasks: true,
  scheduleMicrotask: (task: () => void) => Promise.resolve().then(task),
  NotPendingTransition: null,
  HostTransitionContext: createContext(null),

  createInstance(type: string, props: Props, container: Container): Node {
    const node = createNode(type, container);
    node.update(props, null);
    return node;
  },
  createTextInstance(): never {
    throw new Error('ThorVG: text strings must be passed to <Text text="...">');
  },
  appendInitialChild(parent: Node, child: Node) {
    parent.insert(child, null);
  },
  finalizeInitialChildren: () => false,
  shouldSetTextContent: () => false,
  getRootHostContext: () => hostContext,
  getChildHostContext: () => hostContext,
  getPublicInstance: (node: Node) => node.instance,
  prepareForCommit: () => null,
  resetAfterCommit(container: Container) {
    container.requestRender();
  },
  preparePortalMount() {},
  commitMount() {},
  commitUpdate(node: Node, _type: string, prev: Props, next: Props) {
    node.update(next, prev);
  },
  appendChild(parent: Node, child: Node) {
    parent.insert(child, null);
  },
  appendChildToContainer(container: Container, child: Node) {
    container.root.insert(child, null);
  },
  insertBefore(parent: Node, child: Node, before: Node) {
    parent.insert(child, before);
  },
  insertInContainerBefore(container: Container, child: Node, before: Node) {
    container.root.insert(child, before);
  },
  removeChild(parent: Node, child: Node) {
    parent.remove(child);
    disposeTree(child);
  },
  removeChildFromContainer(container: Container, child: Node) {
    container.root.remove(child);
    disposeTree(child);
  },
  clearContainer(container: Container) {
    container.root.clear();
  },
  hideInstance(node: Node) {
    if (node instanceof PaintNode) node.hide();
  },
  unhideInstance(node: Node, props: Props) {
    if (node instanceof PaintNode) node.unhide(props);
  },
  hideTextInstance() {},
  unhideTextInstance() {},
  resetTextContent() {},
  commitTextUpdate() {},
  detachDeletedInstance() {},
  getInstanceFromNode: () => null,
  getInstanceFromScope: () => null,
  beforeActiveInstanceBlur() {},
  afterActiveInstanceBlur() {},
  prepareScopeUpdate() {},
  setCurrentUpdatePriority(priority: number) {
    updatePriority = priority;
  },
  getCurrentUpdatePriority: () => updatePriority,
  resolveUpdatePriority: () =>
    updatePriority !== NoEventPriority ? updatePriority : DefaultEventPriority,
  shouldAttemptEagerTransition: () => false,
  requestPostPaintCallback() {},
  maySuspendCommit: () => false,
  preloadInstance: () => true,
  startSuspendingCommit() {},
  suspendInstance() {},
  waitForCommitToBeReady: () => null,
  resetFormInstance() {},
  trackSchedulerEvent() {},
  resolveEventType: () => null,
  resolveEventTimeStamp: () => -1.1,
} as unknown as Parameters<typeof Reconciler>[0]);

export interface Root {
  render(children: ReactNode): void;
  invalidate(): void;
  unmount(onDone: () => void): void;
}

export function createRoot(TVG: ThorVG, canvas: Canvas): Root {
  const container = new Container(TVG, canvas);
  const createContainer = reconciler.createContainer as unknown as (
    ...args: unknown[]
  ) => ReturnType<typeof reconciler.createContainer>;
  const fiber = createContainer(
    container,
    LegacyRoot,
    null,
    false,
    null,
    '',
    console.error,
    console.error,
    console.error,
    null
  );
  return {
    render(children) {
      reconciler.updateContainer(children, fiber, null, () => {});
    },
    invalidate() {
      container.requestRender();
    },
    unmount(onDone) {
      reconciler.updateContainer(null, fiber, null, onDone);
    },
  };
}
