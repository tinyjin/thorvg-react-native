import type { LoadDataOptions, PictureSize } from '@thorvg/webcanvas';
import { Paint } from './Paint';
import { registerCallback, unregisterCallback } from '../callbacks';
import { checkResult, handleError, ThorVGResultCode } from '../errors';
import { ColorSpace, FilterMethod } from '../generated/constants';
import { getJSI, type Handle } from '../jsi';

export type AssetResolver = (paint: Paint, src: string) => boolean;

export class Picture extends Paint {
  public _owner: object | null = null;
  private _resolver: AssetResolver | null = null;
  private _resolverId = 0;
  private _accessible = false;

  constructor(handle?: Handle) {
    super(handle ?? getJSI().tvg_picture_new());
  }

  protected _createInstance(handle: Handle): Picture {
    return new Picture(handle);
  }

  public get accessible(): boolean {
    return this._accessible;
  }

  public set accessible(value: boolean) {
    checkResult(
      getJSI().tvg_picture_set_accessible(this.handle, value),
      'accessible'
    );
    this._accessible = value;
  }

  public resolver(callback: AssetResolver | null): this {
    const jsi = getJSI();

    this._releaseResolver();
    this._resolver = callback;

    if (!callback) {
      const result = jsi.tvg_picture_set_asset_resolver(this.handle, 0);
      if (
        result !== ThorVGResultCode.Success &&
        result !== ThorVGResultCode.InsufficientCondition
      ) {
        checkResult(result, 'resolver');
      }
      return this;
    }

    const self = new WeakRef(this);
    this._resolverId = registerCallback((handle: Handle, src: string) => {
      const picture = self.deref();
      const resolver = picture ? picture._resolver : null;
      if (!resolver) return false;
      try {
        return resolver(Paint.fromHandle(handle), src);
      } catch {
        return false;
      }
    });
    checkResult(
      jsi.tvg_picture_set_asset_resolver(this.handle, this._resolverId),
      'resolver'
    );
    return this;
  }

  public override dispose(): void {
    this._releaseResolver();
    this._resolver = null;
    this._owner = null;
    super.dispose();
  }

  public load(data: Uint8Array | string, options: LoadDataOptions = {}): this {
    const jsi = getJSI();
    const {
      type = 'svg',
      width,
      height,
      colorSpace = ColorSpace.ARGB8888,
    } = options;

    if (type === 'raw') {
      if (!width || !height) {
        handleError(
          'Width and height are required for raw image format',
          'load'
        );
        return this;
      }
      const bytes =
        typeof data === 'string' ? new TextEncoder().encode(data) : data;
      checkResult(
        jsi.tvg_picture_load_raw(this.handle, bytes, width, height, colorSpace),
        'load'
      );
      return this;
    }

    checkResult(jsi.tvg_picture_load_data(this.handle, data, type), 'load');
    return this;
  }

  public size(width: number, height: number): this;
  public size(): PictureSize;
  public size(width?: number, height?: number): this | PictureSize {
    const jsi = getJSI();
    if (width !== undefined && height !== undefined) {
      checkResult(
        jsi.tvg_picture_set_size(this.handle, width, height),
        'size (set)'
      );
      return this;
    }
    const [w = 0, h = 0] = jsi.tvg_picture_get_size(this.handle);
    return { width: w, height: h };
  }

  public origin(x: number, y: number): this {
    checkResult(getJSI().tvg_picture_set_origin(this.handle, x, y), 'origin');
    return this;
  }

  public paint(id: number): Paint | null;
  public paint(name: string): Paint | null;
  public paint(id: number | string): Paint | null {
    const jsi = getJSI();
    const numericId =
      typeof id === 'string' ? jsi.tvg_accessor_generate_id(id) : id;
    const handle = jsi.tvg_picture_get_paint(this.handle, numericId);
    return handle ? Paint.fromHandle(handle) : null;
  }

  public filter(method: FilterMethod = FilterMethod.Bilinear): this {
    checkResult(getJSI().tvg_picture_set_filter(this.handle, method), 'filter');
    return this;
  }

  private _releaseResolver(): void {
    if (this._resolverId) {
      unregisterCallback(this._resolverId);
      this._resolverId = 0;
    }
  }
}

Paint.registerType(3, (handle) => new Picture(handle));
