import type { RefObject } from 'react';
import type { Canvas } from '@thorvg/webcanvas';

type LayoutListener = (width: number, height: number) => void;

export interface Size {
  width: number;
  height: number;
}

const canvases = new WeakMap<CanvasTarget, Canvas>();
const sizes = new WeakMap<CanvasTarget, Size>();
const sizeListeners = new WeakMap<
  CanvasTarget,
  Set<(size: Size | null) => void>
>();

export function drawingSize(target: CanvasTarget): Size | null {
  return sizes.get(target) ?? null;
}

export function setDrawingSize(target: CanvasTarget, size: Size | null): void {
  const current = sizes.get(target);
  if (current?.width === size?.width && current?.height === size?.height) {
    return;
  }
  if (size) sizes.set(target, size);
  else sizes.delete(target);
  for (const listener of sizeListeners.get(target) ?? []) listener(size);
}

export function subscribeDrawingSize(
  target: CanvasTarget,
  listener: (size: Size | null) => void
): () => void {
  let listeners = sizeListeners.get(target);
  if (!listeners) {
    listeners = new Set();
    sizeListeners.set(target, listeners);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function bindCanvas(target: CanvasTarget, canvas: Canvas): void {
  canvases.set(target, canvas);
}

export function unbindCanvas(target: CanvasTarget, canvas: Canvas): void {
  if (canvases.get(target) === canvas) canvases.delete(target);
}

export class CanvasTarget {
  readonly surfaceId: number;
  element: unknown = null;
  private _width = 0;
  private _height = 0;
  private _listeners = new Set<LayoutListener>();

  constructor(surfaceId: number) {
    this.surfaceId = surfaceId;
  }

  get canvas(): Canvas | null {
    return canvases.get(this) ?? null;
  }

  get width(): number {
    return this._width;
  }

  get height(): number {
    return this._height;
  }

  layout(width: number, height: number): void {
    if (width === this._width && height === this._height) return;
    this._width = width;
    this._height = height;
    for (const listener of [...this._listeners]) listener(width, height);
  }

  subscribe(listener: LayoutListener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }
}

export type CanvasRef = RefObject<CanvasTarget | null>;

export function isCanvasRef(target: unknown): target is CanvasRef {
  return (
    !!target &&
    typeof target === 'object' &&
    'current' in target &&
    !(target instanceof CanvasTarget)
  );
}

export function resolveTarget(target: unknown): CanvasTarget | null {
  if (target instanceof CanvasTarget) return target;
  if (isCanvasRef(target) && target.current instanceof CanvasTarget) {
    return target.current;
  }
  return null;
}
