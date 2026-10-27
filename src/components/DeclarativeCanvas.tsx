import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { Canvas as WebCanvas } from '@thorvg/webcanvas';
import { assignRef } from '../canvas/assignRef';
import type { CanvasTarget } from '../canvas/CanvasTarget';
import { CanvasView } from '../canvas/CanvasView';
import { getInitialized, init } from '../init';
import type { CanvasProps } from '../types';
import { createRoot, type Root } from './reconciler';

export function DeclarativeCanvas({
  ref,
  children,
  width,
  height,
  enableDevicePixelRatio,
  engineOption,
  viewport,
  ...rest
}: CanvasProps) {
  const [TVG, setTVG] = useState(getInitialized);
  const target = useRef<CanvasTarget | null>(null);
  const scene = useRef<{ root: Root; canvas: WebCanvas } | null>(null);
  const sized = width !== undefined && height !== undefined;
  const size = useRef({ width, height });
  size.current = { width, height };

  useEffect(() => {
    if (TVG) return;
    let active = true;
    init().then(
      (namespace) => {
        if (active) setTVG(namespace);
      },
      (error: unknown) => console.error(error)
    );
    return () => {
      active = false;
    };
  }, [TVG]);

  const setTarget = useCallback(
    (value: CanvasTarget | null) => {
      target.current = value;
      assignRef(ref, value);
    },
    [ref]
  );

  useLayoutEffect(() => {
    if (!TVG) return;
    const canvas = new TVG.Canvas(target, {
      ...size.current,
      enableDevicePixelRatio,
      engineOption,
    });
    const root = createRoot(TVG, canvas);
    scene.current = { root, canvas };
    return () => {
      scene.current = null;
      root.unmount(() => canvas.destroy());
    };
  }, [TVG, enableDevicePixelRatio, engineOption, sized]);

  useLayoutEffect(() => {
    const current = scene.current;
    if (!current || width === undefined || height === undefined) return;
    current.canvas.resize(width, height);
    current.root.invalidate();
  }, [width, height]);

  useLayoutEffect(() => {
    const current = scene.current;
    if (!current || !viewport) return;
    current.canvas.viewport(
      viewport.x,
      viewport.y,
      viewport.width,
      viewport.height
    );
    current.root.invalidate();
  }, [viewport]);

  useLayoutEffect(() => {
    scene.current?.root.render(children);
  });

  return <CanvasView {...rest} ref={setTarget} />;
}
