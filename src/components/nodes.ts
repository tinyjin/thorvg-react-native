import type {
  Animation,
  Canvas,
  ConicGradient,
  LinearGradient,
  LottieAnimation,
  RadialGradient,
  Paint,
  Picture,
  Scene,
  Shape,
  Text,
} from '@thorvg/webcanvas';
import type { ColorStop } from '@thorvg/webcanvas';
import type { ThorVG } from '../types';
import { rgba } from '../color';
import {
  type CircleProps,
  type ConicGradientProps,
  type Effect,
  type FontProps,
  type GradientProps,
  type LinearGradientProps,
  type LottieAnimationProps,
  type MaskProps,
  type PaintProps,
  type PathProps,
  type PictureProps,
  type RadialGradientProps,
  type RectProps,
  type SceneProps,
  type ShapeProps,
  type TextProps,
} from './props';

type Props = Record<string, unknown>;
type FillInstance = LinearGradient | RadialGradient | ConicGradient;

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (ArrayBuffer.isView(a) || ArrayBuffer.isView(b)) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const left = a as Props;
  const right = b as Props;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  return keys.every((key) => same(left[key], right[key]));
}

function changed(props: Props, prev: Props | null, ...keys: string[]): boolean {
  if (!prev) return keys.some((key) => props[key] !== undefined);
  return keys.some((key) => !same(props[key], prev[key]));
}

export class Container {
  readonly root: RootNode;
  private _scheduled = false;

  constructor(
    readonly TVG: ThorVG,
    readonly canvas: Canvas
  ) {
    this.root = new RootNode(this);
  }

  requestRender(): void {
    if (this._scheduled) return;
    this._scheduled = true;
    requestAnimationFrame(() => {
      this._scheduled = false;
      this.canvas.update().render();
    });
  }
}

interface PaintList {
  add(paint: Paint): void;
  remove(paint: Paint): void;
}

function insertPaint(
  paints: PaintNode[],
  child: PaintNode,
  before: PaintNode | null,
  target: PaintList
): void {
  const current = paints.indexOf(child);
  if (current >= 0) {
    paints.splice(current, 1);
    target.remove(child.paint);
  }
  const index = before ? paints.indexOf(before) : -1;
  if (index < 0) {
    paints.push(child);
    target.add(child.paint);
    return;
  }
  const tail = paints.splice(index);
  for (const node of tail) target.remove(node.paint);
  paints.push(child, ...tail);
  target.add(child.paint);
  for (const node of tail) target.add(node.paint);
}

function replacePaint(
  paints: PaintNode[],
  child: PaintNode,
  old: Paint,
  target: PaintList
): void {
  const index = paints.indexOf(child);
  if (index < 0) return;
  const tail = paints.slice(index + 1);
  target.remove(old);
  for (const node of tail) target.remove(node.paint);
  target.add(child.paint);
  for (const node of tail) target.add(node.paint);
}

export abstract class Node {
  parent: Node | null = null;
  readonly children: Node[] = [];

  constructor(readonly container: Container) {}

  abstract get instance(): unknown;
  abstract update(props: Props, prev: Props | null): void;

  insert(child: Node, before: Node | null): void {
    const current = this.children.indexOf(child);
    if (current >= 0) this.children.splice(current, 1);
    const index = before ? this.children.indexOf(before) : -1;
    if (index < 0) this.children.push(child);
    else this.children.splice(index, 0, child);
    child.parent = this;
    this.attach(child, before);
  }

  remove(child: Node): void {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
    child.parent = null;
    this.detach(child);
  }

  protected attach(_child: Node, _before: Node | null): void {}
  protected detach(_child: Node): void {}

  childChanged(_child: Node): void {}

  repaint(child: Node, _old: Paint): void {
    this.childChanged(child);
  }

  dispose(): void {}
}

export class RootNode extends Node {
  readonly paints: PaintNode[] = [];

  get instance(): null {
    return null;
  }

  update(): void {}

  clear(): void {
    for (const child of [...this.children]) this.remove(child);
  }

  protected attach(child: Node, before: Node | null): void {
    if (!(child instanceof PaintNode)) return;
    const canvas = this.container.canvas;
    insertPaint(this.paints, child, nextPaint(this, before), {
      add: (paint) => canvas.add(paint),
      remove: (paint) => canvas.remove(paint),
    });
  }

  protected detach(child: Node): void {
    if (!(child instanceof PaintNode)) return;
    const index = this.paints.indexOf(child);
    if (index >= 0) {
      this.paints.splice(index, 1);
      this.container.canvas.remove(child.paint);
    }
  }

  repaint(child: Node, old: Paint): void {
    if (!(child instanceof PaintNode)) return;
    const canvas = this.container.canvas;
    replacePaint(this.paints, child, old, {
      add: (paint) => canvas.add(paint),
      remove: (paint) => canvas.remove(paint),
    });
  }
}

export abstract class PaintNode<
  P extends PaintProps = PaintProps,
> extends Node {
  abstract readonly paint: Paint;

  get instance(): unknown {
    return this.paint;
  }

  get TVG(): ThorVG {
    return this.container.TVG;
  }

  update(props: Props, prev: Props | null): void {
    this.applyPaint(props as P, prev as P | null);
  }

  hide(): void {
    this.paint.visible(false);
  }

  unhide(props: Props): void {
    this.paint.visible((props as P).visible ?? true);
  }

  protected applyPaint(props: P, prev: P | null): void {
    const p = props as Props;
    const q = prev as Props | null;
    if (changed(p, q, 'transform', 'translate', 'rotate', 'scale')) {
      if (props.transform) {
        this.paint.transform(props.transform);
      } else {
        this.paint.translate(props.translate?.x ?? 0, props.translate?.y ?? 0);
        this.paint.rotate(props.rotate ?? 0);
        this.paint.scale(props.scale ?? 1);
      }
    }
    if (changed(p, q, 'opacity')) this.paint.opacity(props.opacity ?? 255);
    if (changed(p, q, 'visible')) this.paint.visible(props.visible ?? true);
    if (changed(p, q, 'blend')) {
      this.paint.blend(props.blend ?? this.TVG.BlendMethod.Normal);
    }
  }

  protected attach(child: Node, _before: Node | null): void {
    if (child instanceof ClipNode || child instanceof MaskNode) {
      this.childChanged(child);
    } else if (child instanceof GradientNode) {
      this.applyGradients();
    }
  }

  protected detach(child: Node): void {
    if (child instanceof GradientNode) this.applyGradients();
  }

  childChanged(child: Node): void {
    if (child instanceof ClipNode && child.content) {
      this.paint.clip(child.content.paint);
    } else if (child instanceof MaskNode && child.content) {
      this.paint.mask(child.content.paint, child.method);
    } else if (child instanceof GradientNode) {
      this.applyGradients();
    }
  }

  protected replaced(old: Paint, props: Props): void {
    this.applyPaint(props as P, null);
    for (const child of this.children) this.childChanged(child);
    this.parent?.repaint(this, old);
  }

  protected gradient(stroke: boolean): FillInstance | null {
    for (const child of this.children) {
      if (child instanceof GradientNode && child.stroke === stroke) {
        return child.build();
      }
    }
    return null;
  }

  protected applyGradients(): void {}
}

const GEOMETRY = {
  rect: ['x', 'y', 'width', 'height', 'rx', 'ry', 'clockwise'],
  circle: ['cx', 'cy', 'rx', 'ry', 'clockwise'],
  path: ['commands', 'points'],
} as const;

export class ShapeNode extends PaintNode<ShapeProps> {
  readonly paint: Shape;
  private _props: ShapeProps = {};

  constructor(
    container: Container,
    readonly kind: keyof typeof GEOMETRY
  ) {
    super(container);
    this.paint = new container.TVG.Shape();
  }

  update(props: Props, prev: Props | null): void {
    const next = props as ShapeProps;
    this._props = next;
    this.applyPaint(next, prev as ShapeProps | null);
    const p = props;
    const q = prev;
    if (changed(p, q, ...GEOMETRY[this.kind])) {
      this.paint.reset();
      this.appendGeometry(props);
    }
    if (changed(p, q, 'fill')) this.applyFill();
    if (changed(p, q, 'stroke')) this.applyStroke();
    if (changed(p, q, 'fillRule')) {
      this.paint.fillRule(next.fillRule ?? this.TVG.FillRule.Winding);
    }
    if (changed(p, q, 'trimPath')) {
      const trim = next.trimPath;
      this.paint.trimPath(trim?.begin ?? 0, trim?.end ?? 1, trim?.simultaneous);
    }
    if (changed(p, q, 'order')) this.paint.order(next.order ?? false);
  }

  private appendGeometry(props: Props): void {
    if (this.kind === 'rect') {
      const rect = props as unknown as RectProps;
      this.paint.appendRect(rect.x, rect.y, rect.width, rect.height, {
        rx: rect.rx,
        ry: rect.ry,
        clockwise: rect.clockwise,
      });
    } else if (this.kind === 'circle') {
      const circle = props as unknown as CircleProps;
      this.paint.appendCircle(
        circle.cx,
        circle.cy,
        circle.rx,
        circle.ry ?? circle.rx,
        circle.clockwise
      );
    } else {
      const path = props as unknown as PathProps;
      this.paint.appendPath(path.commands, path.points);
    }
  }

  protected applyGradients(): void {
    this.applyFill();
    this.applyStroke();
  }

  private applyFill(): void {
    const gradient = this.gradient(false);
    if (gradient) {
      this.paint.fill(gradient);
    } else {
      const [r, g, b, a] = this._props.fill
        ? rgba(this._props.fill)
        : [0, 0, 0, 0];
      this.paint.fill(r, g, b, a);
    }
  }

  private applyStroke(): void {
    const stroke = this._props.stroke;
    const options = typeof stroke === 'number' ? { width: stroke } : stroke;
    const gradient = this.gradient(true);
    if (!options && !gradient) {
      this.paint.stroke(0);
      return;
    }
    this.paint.stroke({
      width: options?.width ?? 1,
      color: options?.color ? rgba(options.color) : undefined,
      gradient: gradient ?? undefined,
      cap: options?.cap,
      join: options?.join,
      miterLimit: options?.miterLimit,
      dash: options?.dash,
      dashOffset: options?.dashOffset,
    });
  }
}

export class SceneNode extends PaintNode<SceneProps> {
  readonly paint: Scene;
  readonly paints: PaintNode[] = [];

  constructor(container: Container) {
    super(container);
    this.paint = new container.TVG.Scene();
  }

  update(props: Props, prev: Props | null): void {
    const next = props as SceneProps;
    this.applyPaint(next, prev as SceneProps | null);
    if (changed(props, prev, 'effects')) this.applyEffects(next.effects);
  }

  protected attach(child: Node, before: Node | null): void {
    if (child instanceof PaintNode) {
      insertPaint(this.paints, child, nextPaint(this, before), {
        add: (paint) => this.paint.add(paint),
        remove: (paint) => this.paint.remove(paint),
      });
    } else {
      super.attach(child, before);
    }
  }

  protected detach(child: Node): void {
    if (child instanceof PaintNode) {
      const index = this.paints.indexOf(child);
      if (index >= 0) {
        this.paints.splice(index, 1);
        this.paint.remove(child.paint);
      }
    } else {
      super.detach(child);
    }
  }

  repaint(child: Node, old: Paint): void {
    if (!(child instanceof PaintNode)) return;
    replacePaint(this.paints, child, old, {
      add: (paint) => this.paint.add(paint),
      remove: (paint) => this.paint.remove(paint),
    });
  }

  private applyEffects(effects: readonly Effect[] | undefined): void {
    const scene = this.paint;
    scene.resetEffects();
    for (const effect of effects ?? []) {
      switch (effect.type) {
        case 'gaussianBlur':
          scene.gaussianBlur(
            effect.sigma,
            effect.direction,
            effect.border,
            effect.quality
          );
          break;
        case 'motionBlur':
          scene.motionBlur(effect.distance, effect.angle, effect.quality);
          break;
        case 'dropShadow': {
          const [r, g, b, a] = rgba(effect.color);
          scene.dropShadow(
            r,
            g,
            b,
            a,
            effect.angle,
            effect.distance,
            effect.sigma,
            effect.quality
          );
          break;
        }
        case 'fill': {
          const [r, g, b, a] = rgba(effect.color);
          scene.fillEffect(r, g, b, a);
          break;
        }
        case 'tint': {
          const [br, bg, bb] = rgba(effect.black);
          const [wr, wg, wb] = rgba(effect.white);
          scene.tint(br, bg, bb, wr, wg, wb, effect.intensity);
          break;
        }
        case 'tritone': {
          const [sr, sg, sb] = rgba(effect.shadow);
          const [mr, mg, mb] = rgba(effect.midtone);
          const [hr, hg, hb] = rgba(effect.highlight);
          scene.tritone(sr, sg, sb, mr, mg, mb, hr, hg, hb, effect.blend);
          break;
        }
      }
    }
  }
}

function nextPaint(parent: Node, before: Node | null): PaintNode | null {
  if (!before) return null;
  const start = parent.children.indexOf(before);
  for (let i = start; i >= 0 && i < parent.children.length; i++) {
    const node = parent.children[i];
    if (node instanceof PaintNode) return node;
  }
  return null;
}

export class PictureNode extends PaintNode<PictureProps> {
  paint: Picture;
  private _loaded = false;

  constructor(container: Container) {
    super(container);
    this.paint = new container.TVG.Picture();
  }

  update(props: Props, prev: Props | null): void {
    const next = props as PictureProps;
    const reload = changed(props, prev, 'data', 'options');
    if (reload && this._loaded) {
      const old = this.paint;
      this.paint = new this.TVG.Picture();
      this.prepare(next);
      this.load(next);
      this.replaced(old, props);
      prev = null;
    } else {
      this.applyPaint(next, prev as PictureProps | null);
      if (changed(props, prev, 'accessible', 'resolver')) this.prepare(next);
      if (reload) this.load(next);
    }
    if ((reload || changed(props, prev, 'size')) && next.size) {
      this.paint.size(next.size.width, next.size.height);
    }
    if ((reload || changed(props, prev, 'origin')) && next.origin) {
      this.paint.origin(next.origin.x, next.origin.y);
    }
    if (changed(props, prev, 'filter') && next.filter !== undefined) {
      this.paint.filter(next.filter);
    }
  }

  private prepare(props: PictureProps): void {
    this.paint.accessible = props.accessible ?? false;
    this.paint.resolver(props.resolver ?? null);
  }

  private load(props: PictureProps): void {
    if (props.data === undefined) return;
    this.paint.load(props.data, props.options);
    this._loaded = true;
  }
}

export class TextNode extends PaintNode<TextProps> {
  readonly paint: Text;
  private _props: TextProps = {};

  constructor(container: Container) {
    super(container);
    this.paint = new container.TVG.Text();
  }

  update(props: Props, prev: Props | null): void {
    const next = props as TextProps;
    this._props = next;
    this.applyPaint(next, prev as TextProps | null);
    const q = prev;
    if (changed(props, q, 'font') && next.font) this.paint.font(next.font);
    if (changed(props, q, 'fontSize') && next.fontSize !== undefined) {
      this.paint.fontSize(next.fontSize);
    }
    if (changed(props, q, 'text', 'font', 'fontSize')) {
      this.paint.text(next.text ?? '');
    }
    if (changed(props, q, 'fill')) this.applyGradients();
    if (changed(props, q, 'align') && next.align) {
      this.paint.align(next.align.x, next.align.y);
    }
    if (changed(props, q, 'layout') && next.layout) {
      this.paint.layout(next.layout.width, next.layout.height);
    }
    if (changed(props, q, 'wrap') && next.wrap !== undefined) {
      this.paint.wrap(next.wrap);
    }
    if (changed(props, q, 'spacing') && next.spacing) {
      this.paint.spacing(next.spacing.letter, next.spacing.line);
    }
    if (changed(props, q, 'italic')) {
      const italic = next.italic;
      if (typeof italic === 'number') this.paint.italic(italic);
      else this.paint.italic(italic ? undefined : 0);
    }
    if (changed(props, q, 'outline')) {
      const outline = next.outline;
      const [r, g, b] = outline ? rgba(outline.color) : [0, 0, 0];
      this.paint.outline(outline?.width ?? 0, r, g, b);
    }
  }

  protected applyGradients(): void {
    const gradient = this.gradient(false);
    if (gradient) {
      this.paint.fill(gradient);
    } else {
      const [r, g, b] = this._props.fill ? rgba(this._props.fill) : [0, 0, 0];
      this.paint.fill(r, g, b);
    }
  }
}

export class AnimationNode extends PaintNode<LottieAnimationProps> {
  animation: Animation | LottieAnimation;
  private _loaded = false;
  private _props: LottieAnimationProps = {};
  private _slot: number | null = null;

  constructor(
    container: Container,
    readonly lottie: boolean
  ) {
    super(container);
    this.animation = this.create();
  }

  private create(): Animation | LottieAnimation {
    const TVG = this.container.TVG;
    return this.lottie ? new TVG.LottieAnimation() : new TVG.Animation();
  }

  get paint(): Picture {
    return this.animation.picture as Picture;
  }

  get instance(): Animation {
    return this.animation;
  }

  update(props: Props, prev: Props | null): void {
    const next = props as LottieAnimationProps;
    this._props = next;
    const q = prev;
    const reload = changed(props, q, 'data') && next.data !== undefined;
    const old = reload && this._loaded ? this.paint : null;
    if (old) {
      this.animation.pause();
      this.animation = this.create();
    }
    const lottie = this.lottie ? (this.animation as LottieAnimation) : null;

    if (lottie && (old || changed(props, q, 'resolver'))) {
      lottie.resolver(next.resolver ?? null);
    }
    if (reload) {
      this._slot = null;
      this.animation.load(next.data as Uint8Array | string);
      this._loaded = true;
    }
    if (old) this.replaced(old, props);
    else this.applyPaint(next, prev as LottieAnimationProps | null);
    if ((reload || changed(props, q, 'size')) && next.size) {
      this.paint.size(next.size.width, next.size.height);
    }
    if (lottie) {
      if ((reload || changed(props, q, 'slot')) && next.slot !== undefined) {
        if (this._slot !== null) lottie.del(this._slot);
        this._slot = lottie.gen(next.slot);
        lottie.apply(this._slot);
      }
      if (
        (reload || changed(props, q, 'quality')) &&
        next.quality !== undefined
      ) {
        lottie.quality(next.quality);
      }
      if (
        (reload || changed(props, q, 'volume')) &&
        next.volume !== undefined
      ) {
        lottie.volume(next.volume);
      }
    }
    if (reload || changed(props, q, 'segment')) this.applySegment(next);
    if (reload || changed(props, q, 'loop')) {
      this.animation.setLoop(next.loop ?? false);
    }
    if ((reload || changed(props, q, 'frame')) && next.frame !== undefined) {
      this.animation.frame(next.frame);
    }
    if (reload || changed(props, q, 'playing')) {
      if (next.playing) {
        this.animation.play((frame) => {
          this._props.onFrame?.(frame);
          this.container.requestRender();
        });
      } else {
        this.animation.pause();
      }
    }
  }

  private applySegment(props: LottieAnimationProps): void {
    const segment = props.segment;
    if (typeof segment === 'string') {
      (this.animation as LottieAnimation).segment(segment);
    } else if (segment) {
      this.animation.segment(segment.start, segment.end);
    } else if (this.lottie) {
      (this.animation as LottieAnimation).segment(null);
    }
  }

  dispose(): void {
    this.animation.pause();
  }
}

export class GradientNode extends Node {
  private _props: Props = {};

  constructor(
    container: Container,
    readonly kind: 'linear' | 'radial' | 'conic'
  ) {
    super(container);
  }

  get instance(): null {
    return null;
  }

  get stroke(): boolean {
    return !!(this._props as GradientProps).stroke;
  }

  update(props: Props, prev: Props | null): void {
    this._props = props;
    if (prev) this.parent?.childChanged(this);
  }

  build(): FillInstance {
    const TVG = this.container.TVG;
    let fill: FillInstance;
    if (this.kind === 'linear') {
      const p = this._props as unknown as LinearGradientProps;
      fill = new TVG.LinearGradient(p.x1, p.y1, p.x2, p.y2);
    } else if (this.kind === 'radial') {
      const p = this._props as unknown as RadialGradientProps;
      fill = new TVG.RadialGradient(p.cx, p.cy, p.r, p.fx, p.fy, p.fr);
    } else {
      const p = this._props as unknown as ConicGradientProps;
      fill = new TVG.ConicGradient(p.cx, p.cy, p.angle);
    }
    const p = this._props as GradientProps;
    if (p.stops?.length) {
      fill.setStops(
        ...p.stops.map(([offset, color]): [number, ColorStop] => [
          offset,
          color,
        ])
      );
    }
    if (p.spread !== undefined) fill.spread(p.spread);
    return fill;
  }
}

abstract class HolderNode extends Node {
  get content(): PaintNode | null {
    const child = this.children.find((node) => node instanceof PaintNode);
    return (child as PaintNode | undefined) ?? null;
  }

  get instance(): null {
    return null;
  }

  update(_props: Props, _prev: Props | null): void {}

  protected attach(): void {
    this.parent?.childChanged(this);
  }

  childChanged(): void {
    this.parent?.childChanged(this);
  }
}

export class ClipNode extends HolderNode {}

export class MaskNode extends HolderNode {
  method = 0;

  update(props: Props, prev: Props | null): void {
    this.method = (props as unknown as MaskProps).method;
    if (prev && props.method !== prev.method) this.parent?.childChanged(this);
  }
}

export class FontNode extends Node {
  private _name: string | null = null;

  get instance(): null {
    return null;
  }

  update(props: Props, prev: Props | null): void {
    if (!changed(props, prev, 'name', 'data', 'type')) return;
    const next = props as unknown as FontProps;
    if (this._name) this.container.TVG.Font.unload(this._name);
    this.container.TVG.Font.load(next.name, next.data, { type: next.type });
    this._name = next.name;
  }

  dispose(): void {
    if (this._name) this.container.TVG.Font.unload(this._name);
    this._name = null;
  }
}
