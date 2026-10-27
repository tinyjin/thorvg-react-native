import type { CanvasOptions, InitOptions } from '@thorvg/webcanvas';
import { PixelRatio, Platform } from 'react-native';
import type { Paint } from './Paint';
import { Scene } from './Scene';
import { checkResult, handleError } from '../errors';
import { EngineOption } from '../generated/constants';
import { getJSI, type CanvasHandle } from '../jsi';
import type { Canvas as WebCanvas } from '@thorvg/webcanvas';
import {
  bindCanvas,
  resolveTarget,
  setDrawingSize,
  unbindCanvas,
  type CanvasRef,
  type CanvasTarget,
} from '../../canvas/CanvasTarget';

type Renderer = NonNullable<InitOptions['renderer']>;

const platformRenderer: Renderer = Platform.OS === 'android' ? 'gl' : 'sw';
let preferredRenderer: Renderer = platformRenderer;
let warnedFallback = false;

export function setRenderer(renderer: Renderer | undefined): void {
  preferredRenderer = renderer ?? platformRenderer;
}

function devicePixelRatio(): number {
  return 1 + (PixelRatio.get() - 1) * 0.75;
}

export class Canvas {
  #handle: CanvasHandle | null = null;
  #renderer: Renderer = 'sw';
  #mainScene: Scene | null = null;
  #enableDevicePixelRatio: boolean = true;
  #logicalWidth: number = 1;
  #logicalHeight: number = 1;
  #currentDPR: number = 1;
  #needsUpdate: boolean = false;
  #unsubscribe: (() => void) | null = null;
  #target: CanvasTarget | null = null;

  constructor(target: CanvasTarget | CanvasRef, options: CanvasOptions = {}) {
    const surface = resolveTarget(target);
    if (!surface) {
      handleError('The Canvas view is not mounted', 'Canvas constructor');
      return;
    }

    const {
      width,
      height,
      enableDevicePixelRatio = true,
      engineOption = EngineOption.Default,
    } = options;

    this.#logicalWidth = width ?? Math.max(1, surface.width);
    this.#logicalHeight = height ?? Math.max(1, surface.height);
    this.#enableDevicePixelRatio = enableDevicePixelRatio;

    const jsi = getJSI();
    const handle = jsi.canvas_create(
      surface.surfaceId,
      engineOption,
      preferredRenderer
    );
    if (!handle) {
      handleError(
        `Failed to create canvas with ${preferredRenderer} renderer`,
        'Canvas constructor'
      );
      return;
    }
    this.#handle = handle;
    this.#renderer = jsi.canvas_renderer(handle) as Renderer;
    if (__DEV__ && !warnedFallback && this.#renderer !== preferredRenderer) {
      warnedFallback = true;
      console.warn(
        `ThorVG: the '${preferredRenderer}' renderer is not available, falling back to '${this.#renderer}'.`
      );
    }

    this.#currentDPR = enableDevicePixelRatio ? devicePixelRatio() : 1;
    this.#applySize();

    this.#mainScene = new Scene();
    if (enableDevicePixelRatio) {
      this.#mainScene.scale(this.#currentDPR);
    }
    checkResult(
      jsi.tvg_canvas_add(handle, this.#mainScene.handle),
      'add main scene'
    );
    jsi.tvg_paint_ref(this.#mainScene.handle);

    this.#target = surface;
    bindCanvas(surface, this as unknown as WebCanvas);

    if (width !== undefined && height !== undefined) {
      setDrawingSize(surface, { width, height });
    } else {
      this.#unsubscribe = surface.subscribe((w, h) => {
        this.resize(width ?? w, height ?? h).render();
      });
    }
  }

  public add(paint: Paint): this {
    if (!this.#mainScene) {
      handleError('Main scene not initialized', 'add');
      return this;
    }
    this.#mainScene.add(paint);
    this.#needsUpdate = true;
    return this;
  }

  public remove(paint?: Paint): this {
    if (!this.#mainScene) {
      handleError('Main scene not initialized', 'remove');
      return this;
    }
    if (paint) {
      this.#mainScene.remove(paint);
    } else {
      this.#mainScene.remove();
    }
    this.#needsUpdate = true;
    return this;
  }

  public clear(): this {
    if (!this.#handle || !this.#mainScene) {
      return this;
    }
    this.#mainScene.clear();
    getJSI().canvas_render(this.#handle);
    return this;
  }

  public update(): this {
    if (!this.#handle) {
      return this;
    }
    checkResult(getJSI().tvg_canvas_update(this.#handle), 'update');
    return this;
  }

  public render(): this {
    if (!this.#handle || !this.#mainScene) {
      return this;
    }

    const jsi = getJSI();

    if (this.#needsUpdate) {
      jsi.tvg_canvas_update(this.#handle);
      this.#needsUpdate = false;
    }

    if (this.#enableDevicePixelRatio) {
      const dpr = devicePixelRatio();
      if (dpr !== this.#currentDPR) {
        this.#currentDPR = dpr;
        this.#mainScene.transform({
          e11: dpr,
          e12: 0,
          e13: 0,
          e21: 0,
          e22: dpr,
          e23: 0,
          e31: 0,
          e32: 0,
          e33: 1,
        });
        this.#applySize();
      }
    }

    jsi.canvas_render(this.#handle);
    return this;
  }

  public resize(width: number, height: number): this {
    this.#logicalWidth = width;
    this.#logicalHeight = height;
    this.#applySize();
    return this;
  }

  public viewport(x: number, y: number, w: number, h: number): this {
    if (!this.#handle) {
      return this;
    }
    checkResult(
      getJSI().tvg_canvas_set_viewport(this.#handle, x, y, w, h),
      'viewport'
    );
    return this;
  }

  public destroy(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    if (this.#target) {
      if (this.#target.canvas === (this as unknown as WebCanvas)) {
        setDrawingSize(this.#target, null);
      }
      unbindCanvas(this.#target, this as unknown as WebCanvas);
      this.#target = null;
    }
    if (this.#mainScene) {
      this.#mainScene.clear();
      this.#mainScene.dispose();
      this.#mainScene = null;
    }
    if (this.#handle) {
      getJSI().canvas_destroy(this.#handle);
      this.#handle = null;
    }
  }

  /** @internal */
  public get _handle(): CanvasHandle | null {
    return this.#handle;
  }

  public get renderer(): string {
    return this.#renderer;
  }

  public get dpr(): number {
    return this.#currentDPR;
  }

  #applySize(): void {
    if (!this.#handle) return;
    const dpr = this.#enableDevicePixelRatio ? this.#currentDPR : 1;
    const width = Math.max(1, Math.floor(this.#logicalWidth * dpr));
    const height = Math.max(1, Math.floor(this.#logicalHeight * dpr));
    getJSI().canvas_resize(this.#handle, width, height);
  }
}
