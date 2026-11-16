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
  /** @internal */
  public _handle: CanvasHandle | null = null;
  private _renderer: Renderer = 'sw';
  private _mainScene: Scene | null = null;
  private _enableDevicePixelRatio: boolean = true;
  private _logicalWidth: number = 0;
  private _logicalHeight: number = 0;
  private _currentDPR: number = 1;
  private _unsubscribe: (() => void) | null = null;
  private _target: CanvasTarget | null = null;

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

    this._logicalWidth = width ?? surface.width;
    this._logicalHeight = height ?? surface.height;
    this._enableDevicePixelRatio = enableDevicePixelRatio;

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
    this._handle = handle;
    this._renderer = jsi.canvas_renderer(handle) as Renderer;
    if (__DEV__ && !warnedFallback && this._renderer !== preferredRenderer) {
      warnedFallback = true;
      console.warn(
        `ThorVG: the '${preferredRenderer}' renderer is not available, falling back to '${this._renderer}'.`
      );
    }

    this._currentDPR = enableDevicePixelRatio ? devicePixelRatio() : 1;
    this._applySize();

    this._mainScene = new Scene();
    if (enableDevicePixelRatio) {
      this._mainScene.scale(this._currentDPR);
    }
    checkResult(
      jsi.tvg_canvas_add(handle, this._mainScene.handle),
      'add main scene'
    );
    jsi.tvg_paint_ref(this._mainScene.handle);

    this._target = surface;
    bindCanvas(surface, this as unknown as WebCanvas);

    if (width !== undefined && height !== undefined) {
      setDrawingSize(surface, { width, height });
    } else {
      this._unsubscribe = surface.subscribe((w, h) => {
        this.resize(width ?? w, height ?? h).render();
      });
    }
  }

  public add(paint: Paint): this {
    if (!this._mainScene) {
      handleError('Main scene not initialized', 'add');
      return this;
    }
    this._mainScene.add(paint);
    return this;
  }

  public remove(paint?: Paint): this {
    if (!this._mainScene) {
      handleError('Main scene not initialized', 'remove');
      return this;
    }
    if (paint) {
      this._mainScene.remove(paint);
    } else {
      this._mainScene.remove();
    }
    return this;
  }

  public clear(): this {
    if (!this._handle || !this._mainScene) {
      return this;
    }
    this._mainScene.clear();
    getJSI().canvas_render(this._handle);
    return this;
  }

  public update(): this {
    return this;
  }

  public render(): this {
    if (!this._handle || !this._mainScene) {
      return this;
    }

    const jsi = getJSI();

    if (this._enableDevicePixelRatio) {
      const dpr = devicePixelRatio();
      if (dpr !== this._currentDPR) {
        this._currentDPR = dpr;
        this._mainScene.transform({
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
        this._applySize();
      }
    }

    jsi.canvas_render(this._handle);
    return this;
  }

  public resize(width: number, height: number): this {
    this._logicalWidth = width;
    this._logicalHeight = height;
    this._applySize();
    return this;
  }

  public viewport(x: number, y: number, w: number, h: number): this {
    if (!this._handle) {
      return this;
    }
    const dpr = this._enableDevicePixelRatio ? this._currentDPR : 1;
    checkResult(
      getJSI().tvg_canvas_set_viewport(
        this._handle,
        x * dpr,
        y * dpr,
        w * dpr,
        h * dpr
      ),
      'viewport'
    );
    return this;
  }

  public destroy(): void {
    this._unsubscribe?.();
    this._unsubscribe = null;
    if (this._target) {
      if (this._target.canvas === (this as unknown as WebCanvas)) {
        setDrawingSize(this._target, null);
      }
      unbindCanvas(this._target, this as unknown as WebCanvas);
      this._target = null;
    }
    if (this._mainScene) {
      this._mainScene.clear();
      this._mainScene.dispose();
      this._mainScene = null;
    }
    if (this._handle) {
      getJSI().canvas_destroy(this._handle);
      this._handle = null;
    }
  }

  public get renderer(): string {
    return this._renderer;
  }

  public get dpr(): number {
    return this._currentDPR;
  }

  private _applySize(): void {
    if (!this._handle) return;
    const dpr = this._enableDevicePixelRatio ? this._currentDPR : 1;
    const width = Math.floor(this._logicalWidth * dpr);
    const height = Math.floor(this._logicalHeight * dpr);
    getJSI().canvas_resize(this._handle, width, height);
  }
}
