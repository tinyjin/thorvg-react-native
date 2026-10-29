import type {
  Canvas as WebCanvas,
  CanvasOptions,
  CanvasTarget as WebCanvasTarget,
} from '@thorvg/webcanvas';
import {
  bindCanvas,
  isCanvasRef,
  setDrawingSize,
  resolveTarget,
  type CanvasRef,
  type CanvasTarget,
  unbindCanvas,
} from '../canvas/CanvasTarget';
import type { ThorVG } from '../types';

const elements = new WeakMap<WebCanvas, unknown>();
const subscriptions = new WeakMap<WebCanvas, () => void>();
const targets = new WeakMap<WebCanvas, CanvasTarget>();

export function canvasElement(canvas: WebCanvas): unknown {
  return elements.get(canvas);
}

function fit(element: unknown): void {
  const style = (element as { style?: Record<string, string> } | null)?.style;
  if (!style) return;
  style.width = '100%';
  style.height = '100%';
}

// The threaded build has its own Canvas class, so the view support extends whichever build is loaded.
export function createCanvas(Base: typeof WebCanvas): ThorVG['Canvas'] {
  return class Canvas extends Base {
    constructor(
      target: string | WebCanvasTarget | CanvasTarget | CanvasRef,
      options: CanvasOptions = {}
    ) {
      const surface = resolveTarget(target);
      if (!surface && isCanvasRef(target)) {
        throw new Error('ThorVG: the Canvas view is not mounted');
      }
      super(
        (surface ? surface.element : target) as string | WebCanvasTarget,
        surface
          ? {
              ...options,
              width: options.width ?? Math.max(1, surface.width),
              height: options.height ?? Math.max(1, surface.height),
            }
          : options
      );
      if (!surface) return;

      elements.set(this, surface.element);
      targets.set(this, surface);
      bindCanvas(surface, this);
      fit(surface.element);
      if (options.width !== undefined && options.height !== undefined) {
        setDrawingSize(surface, {
          width: options.width,
          height: options.height,
        });
      } else {
        subscriptions.set(
          this,
          surface.subscribe((width, height) => {
            this.resize(options.width ?? width, options.height ?? height);
            this.render();
          })
        );
      }
    }

    override resize(width: number, height: number): this {
      super.resize(width, height);
      fit(elements.get(this));
      return this;
    }

    override destroy(): void {
      subscriptions.get(this)?.();
      subscriptions.delete(this);
      const target = targets.get(this);
      if (target) {
        if (target.canvas === this) setDrawingSize(target, null);
        unbindCanvas(target, this);
      }
      targets.delete(this);
      super.destroy();
    }
  };
}
