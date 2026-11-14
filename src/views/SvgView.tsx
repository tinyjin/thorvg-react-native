import { useCallback, useEffect, useRef, useState, type Ref } from 'react';
import type { LayoutChangeEvent, ViewProps } from 'react-native';
import type {
  Canvas as WebCanvas,
  Picture,
  PictureSize,
  Scene,
} from '@thorvg/webcanvas';
import { assignRef } from '../canvas/assignRef';
import { Canvas } from '../canvas/Canvas';
import { rgba, type Color } from '../color';
import { useThorVG } from '../useThorVG';
import { place, type ContentFit, type ContentPosition } from './fit';
import { loadSource, sourceKey, type SvgSource } from './source';

export interface SvgViewHandle {
  readonly picture: Picture | null;
  readonly canvas: WebCanvas | null;
}

export interface SvgViewProps extends ViewProps {
  ref?: Ref<SvgViewHandle>;
  source: SvgSource;
  contentFit?: ContentFit;
  contentPosition?: ContentPosition;
  tintColor?: Color;
  onLoad?: (size: PictureSize) => void;
  onError?: (error: Error) => void;
}

interface State {
  canvas: WebCanvas;
  scene: Scene;
  picture: Picture | null;
  size: PictureSize;
  layout: { width: number; height: number };
  tinted: boolean;
}

export type SvgView = SvgViewHandle;

export function SvgView({
  ref,
  source,
  contentFit = 'contain',
  contentPosition,
  tintColor,
  onLoad,
  onError,
  onLayout,
  ...rest
}: SvgViewProps) {
  const TVG = useThorVG();
  const view = useRef<Canvas>(null);
  const state = useRef<State | null>(null);
  const [loaded, setLoaded] = useState(0);
  const latest = { source, contentFit, contentPosition, onLoad, onError };
  const props = useRef(latest);
  props.current = latest;

  const layout = useCallback(() => {
    const current = state.current;
    if (!current?.picture) return;
    const placement = place(
      current.layout,
      current.size,
      props.current.contentFit,
      props.current.contentPosition
    );
    if (!placement) return;
    current.picture.size(placement.width, placement.height);
    current.picture.translate(placement.x, placement.y);
    current.canvas.update().render();
  }, []);

  const handle = useRef<SvgViewHandle>({
    get picture() {
      return state.current?.picture ?? null;
    },
    get canvas() {
      return state.current?.canvas ?? null;
    },
  });

  useEffect(() => {
    assignRef(ref, handle.current);
    return () => assignRef(ref, null);
  }, [ref]);

  useEffect(() => {
    if (!TVG) return;
    const canvas = new TVG.Canvas(view, {
      engineOption: TVG.EngineOption.None,
    });
    const scene = new TVG.Scene();
    canvas.add(scene);
    state.current = {
      canvas,
      scene,
      picture: null,
      size: { width: 0, height: 0 },
      layout: {
        width: view.current?.width ?? 0,
        height: view.current?.height ?? 0,
      },
      tinted: false,
    };
    return () => {
      state.current = null;
      canvas.destroy();
    };
  }, [TVG]);

  const key = sourceKey(source);
  useEffect(() => {
    const current = state.current;
    if (!current || !TVG) return;
    let active = true;
    loadSource(props.current.source).then(
      (data) => {
        if (!active || state.current !== current) return;
        const picture = new TVG.Picture();
        picture.load(data, { type: 'svg' });
        if (current.picture) current.scene.remove(current.picture);
        current.scene.add(picture);
        current.picture = picture;
        current.size = picture.size();
        setLoaded((n) => n + 1);
        props.current.onLoad?.(current.size);
      },
      (error: unknown) => {
        if (!active) return;
        props.current.onError?.(
          error instanceof Error ? error : new Error(String(error))
        );
      }
    );
    return () => {
      active = false;
    };
  }, [TVG, key]);

  useEffect(() => {
    layout();
  }, [loaded, contentFit, contentPosition, layout]);

  const tint = tintColor === undefined ? null : rgba(tintColor).join(',');
  useEffect(() => {
    const current = state.current;
    if (!current) return;
    if (current.tinted) current.scene.resetEffects();
    current.tinted = !!tint;
    if (tint) {
      const [r, g, b, a] = tint.split(',').map(Number) as [
        number,
        number,
        number,
        number,
      ];
      current.scene.fillEffect(r, g, b, a);
    }
    current.canvas.update().render();
  }, [loaded, tint]);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const current = state.current;
      if (current) {
        current.layout = {
          width: event.nativeEvent.layout.width,
          height: event.nativeEvent.layout.height,
        };
        layout();
      }
      onLayout?.(event);
    },
    [layout, onLayout]
  );

  return <Canvas {...rest} ref={view} onLayout={handleLayout} />;
}
