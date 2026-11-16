import type { AnimationInfo } from '@thorvg/webcanvas';
import { NativeObject } from '../NativeObject';
import { Picture } from './Picture';
import { checkResult, handleError, ThorVGResultCode } from '../errors';
import { getJSI, type Handle } from '../jsi';

export class Animation extends NativeObject {
  private _picture: Picture | null = null;
  private _info: AnimationInfo | null = null;
  private _isPlaying = false;
  private _currentFrame = 0;
  private _animationFrameId: number | null = null;
  private _lastTime = 0;
  private _onFrame?: (frame: number) => void;
  private _loop = true;

  constructor(handle?: Handle) {
    super(handle ?? getJSI().tvg_animation_new());
  }

  protected _cleanup(handle: Handle): void {
    getJSI().tvg_animation_del(handle);
  }

  public get picture(): Picture | null {
    if (!this._picture && !this.isDisposed) {
      const handle = getJSI().tvg_animation_get_picture(this.handle);
      if (handle) {
        this._picture = new Picture(handle);
        this._picture._owner = this;
      }
    }
    return this._picture;
  }

  public load(data: Uint8Array | string): this {
    const picture = this.picture;
    if (!picture) {
      handleError('Failed to get picture from animation', 'load');
      return this;
    }

    picture.load(data, { type: 'lot' });
    this._updateInfo();
    return this;
  }

  public info(): AnimationInfo | null {
    return this._info;
  }

  public frame(): number;
  public frame(frameNumber: number): this;
  public frame(frameNumber?: number): number | this {
    if (frameNumber !== undefined) {
      this._currentFrame = frameNumber;
      const result = getJSI().tvg_animation_set_frame(this.handle, frameNumber);
      if (
        result !== ThorVGResultCode.Success &&
        result !== ThorVGResultCode.InsufficientCondition
      ) {
        checkResult(result, 'frame (set)');
      }
      return this;
    }
    return this._currentFrame;
  }

  public segment(begin: number, end: number): this {
    checkResult(
      getJSI().tvg_animation_set_segment(this.handle, begin, end),
      'segment'
    );
    return this;
  }

  public play(onFrame?: (frame: number) => void): this {
    if (this._isPlaying) {
      return this;
    }

    if (!this._info) {
      handleError('No animation loaded', 'play');
      return this;
    }

    this._isPlaying = true;
    this._onFrame = onFrame;
    this._lastTime = 0;
    this._animate(performance.now());
    return this;
  }

  public pause(): this {
    this._isPlaying = false;
    if (this._animationFrameId !== null) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
    }
    return this;
  }

  public stop(): this {
    this.pause();
    this.frame(0);
    return this;
  }

  public isPlaying(): boolean {
    return this._isPlaying;
  }

  public setLoop(loop: boolean): this {
    this._loop = loop;
    return this;
  }

  public getLoop(): boolean {
    return this._loop;
  }

  public seek(time: number): this {
    if (!this._info) {
      handleError('No animation loaded', 'seek');
      return this;
    }
    const frame = (time / this._info.duration) * this._info.totalFrames;
    this.frame(Math.max(0, Math.min(this._info.totalFrames - 1, frame)));
    return this;
  }

  public getCurrentTime(): number {
    if (!this._info) {
      return 0;
    }
    return (this._currentFrame / this._info.totalFrames) * this._info.duration;
  }

  public override dispose(): void {
    if (this.isDisposed) {
      return;
    }

    this.pause();
    this._info = null;

    if (this._picture) {
      const picture = this._picture;
      picture.resolver(null);
      picture._owner = null;
      this._picture = null;
      for (; picture._retains > 0; picture._retains--) {
        getJSI().tvg_paint_unref(picture.handle, false);
      }
    }

    super.dispose();
  }

  private _animate = (time: number): void => {
    if (!this._isPlaying || !this._info) {
      return;
    }

    if (this._lastTime === 0) {
      this._lastTime = time;
    }

    const deltaTime = (time - this._lastTime) / 1000;
    this._lastTime = time;

    this._currentFrame += this._info.fps * deltaTime;

    if (this._currentFrame >= this._info.totalFrames) {
      if (this._loop) {
        this._currentFrame = this._currentFrame % this._info.totalFrames;
      } else {
        this._currentFrame = this._info.totalFrames - 1;
        this.pause();
        return;
      }
    }

    getJSI().tvg_animation_set_frame(this.handle, this._currentFrame);

    if (this._onFrame) {
      this._onFrame(this._currentFrame);
    }

    this._animationFrameId = requestAnimationFrame(this._animate);
  };

  private _updateInfo(): void {
    const jsi = getJSI();
    const totalFrames = jsi.tvg_animation_get_total_frame(this.handle);
    const duration = jsi.tvg_animation_get_duration(this.handle);
    this._info = {
      totalFrames,
      duration,
      fps: totalFrames / duration,
    };
  }
}
