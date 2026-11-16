import { handleError } from './errors';
import { getJSI, type Handle } from './jsi';

export abstract class NativeObject {
  private _handle: Handle | null;
  private _disposed: boolean = false;

  constructor(handle: Handle | null) {
    this._handle = handle;
  }

  public get handle(): Handle {
    const handle = this._handle;
    if (!handle) {
      handleError('Object has been disposed', 'handle getter');
    }
    return handle as Handle;
  }

  public get ptr(): number {
    if (this._disposed) {
      handleError('Object has been disposed', 'ptr getter');
      return 0;
    }
    return this._handle ? getJSI().address(this._handle) : 0;
  }

  public dispose(): void {
    if (this._disposed) {
      return;
    }
    this._disposed = true;

    const handle = this._handle;
    this._handle = null;
    if (handle) {
      getJSI().disown(handle);
      this._cleanup(handle);
    }
  }

  public get isDisposed(): boolean {
    return this._disposed;
  }

  protected abstract _cleanup(handle: Handle): void;
}
