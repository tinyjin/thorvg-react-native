import { useCallback, useEffect, useRef, useState, type Ref } from 'react';
import type { LayoutChangeEvent, ViewProps } from 'react-native';
import type {
  AnimationInfo,
  Canvas as WebCanvas,
  LottieAnimation,
  LottieSlotData,
} from '@thorvg/webcanvas';
import { assignRef } from '../canvas/assignRef';
import { Canvas } from '../canvas/Canvas';
import { useThorVG } from '../useThorVG';
import { place, type ContentFit, type ContentPosition } from './fit';
import { createPlayer, type Player, type PlayMode } from './player';
import { loadSource, sourceKey, type LottieSource } from './source';

export type LottieMode = PlayMode;

export interface LottieViewHandle {
  readonly animation: LottieAnimation | null;
  readonly canvas: WebCanvas | null;
  play(): void;
  pause(): void;
  stop(): void;
  seek(frame: number): void;
}

export interface LottieViewProps extends ViewProps {
  ref?: Ref<LottieViewHandle>;
  source: LottieSource;
  autoplay?: boolean;
  loop?: boolean;
  speed?: number;
  mode?: LottieMode;
  segment?: readonly [number, number] | string;
  progress?: number;
  slots?: LottieSlotData | string;
  contentFit?: ContentFit;
  contentPosition?: ContentPosition;
  onLoad?: (info: AnimationInfo) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
  onLoop?: () => void;
  onFrame?: (frame: number) => void;
}

interface State {
  canvas: WebCanvas;
  animation: LottieAnimation | null;
  player: Player | null;
  info: AnimationInfo | null;
  slot: number | null;
  layout: { width: number; height: number };
  size: { width: number; height: number };
}

function range(
  state: State,
  segment: LottieViewProps['segment']
): [number, number] {
  const total = Math.max(0, (state.info?.totalFrames ?? 1) - 1);
  if (typeof segment === 'string') {
    const animation = state.animation;
    for (let i = 0; i < (animation?.markersCnt() ?? 0); i++) {
      const marker = animation?.marker(i);
      if (marker?.name === segment) return [marker.begin, marker.end];
    }
    return [0, total];
  }
  if (segment) return [segment[0], segment[1]];
  return [0, total];
}

export type LottieView = LottieViewHandle;

export function LottieView({
  ref,
  source,
  autoplay = false,
  loop = false,
  speed = 1,
  mode = 'forward',
  segment,
  progress,
  slots,
  contentFit = 'contain',
  contentPosition,
  onLoad,
  onError,
  onComplete,
  onLoop,
  onFrame,
  onLayout,
  ...rest
}: LottieViewProps) {
  const TVG = useThorVG();
  const view = useRef<Canvas>(null);
  const state = useRef<State | null>(null);
  const [loaded, setLoaded] = useState(0);
  const latest = {
    source,
    loop,
    speed,
    mode,
    segment,
    contentFit,
    contentPosition,
    onLoad,
    onError,
    onComplete,
    onLoop,
    onFrame,
  };
  const props = useRef(latest);
  props.current = latest;

  const redraw = useCallback(() => {
    const current = state.current;
    if (!current?.info || !current.player) return;
    current.player.seek(current.player.frame());
  }, []);

  const layout = useCallback(() => {
    const current = state.current;
    const picture = current?.info ? current.animation?.picture : null;
    if (!current || !picture) return;
    const placement = place(
      current.layout,
      current.size,
      props.current.contentFit,
      props.current.contentPosition
    );
    if (!placement) return;
    picture.size(placement.width, placement.height);
    picture.translate(placement.x, placement.y);
    current.canvas.update().render();
  }, []);

  const configure = useCallback(() => {
    const current = state.current;
    if (!current?.info || !current.player) return;
    const [start, end] = range(current, props.current.segment);
    current.player.configure({
      speed: props.current.speed,
      loop: props.current.loop,
      mode: props.current.mode,
      start,
      end,
    });
  }, []);

  const handle = useRef<LottieViewHandle>({
    get animation() {
      return state.current?.animation ?? null;
    },
    get canvas() {
      return state.current?.canvas ?? null;
    },
    play() {
      state.current?.player?.play();
    },
    pause() {
      state.current?.player?.pause();
    },
    stop() {
      const player = state.current?.player;
      player?.pause();
      player?.reset();
    },
    seek(frame: number) {
      state.current?.player?.seek(frame);
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
    state.current = {
      canvas,
      animation: null,
      player: null,
      info: null,
      slot: null,
      layout: {
        width: view.current?.width ?? 0,
        height: view.current?.height ?? 0,
      },
      size: { width: 0, height: 0 },
    };
    return () => {
      const current = state.current;
      state.current = null;
      current?.player?.destroy();
      current?.animation?.dispose();
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
        const animation = new TVG.LottieAnimation();
        animation.load(data);
        const previous = current.animation;
        current.player?.destroy();
        if (previous?.picture) current.canvas.remove(previous.picture);
        previous?.dispose();
        current.animation = animation;
        current.info = animation.info();
        current.slot = null;
        current.size = animation.picture?.size() ?? { width: 0, height: 0 };
        if (animation.picture) current.canvas.add(animation.picture);
        current.player = createPlayer(current.canvas, animation);
        setLoaded((n) => n + 1);
        if (current.info) props.current.onLoad?.(current.info);
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
    const current = state.current;
    const animation = current?.animation;
    if (!current?.info || !animation || slots === undefined) return;
    if (current.slot !== null) animation.del(current.slot);
    current.slot = animation.gen(slots);
    animation.apply(current.slot);
    redraw();
  }, [loaded, slots, redraw]);

  useEffect(() => {
    layout();
  }, [loaded, contentFit, contentPosition, layout]);

  const segmentKey = Array.isArray(segment) ? segment.join(':') : segment;
  useEffect(() => {
    configure();
  }, [loaded, speed, loop, configure]);

  const hasFrameListener = !!onFrame;
  useEffect(() => {
    state.current?.player?.setEvents({
      onLoop: () => props.current.onLoop?.(),
      onComplete: () => props.current.onComplete?.(),
      onFrame: hasFrameListener
        ? (frame) => props.current.onFrame?.(frame)
        : undefined,
    });
  }, [loaded, hasFrameListener]);

  useEffect(() => {
    const current = state.current;
    const player = current?.player;
    if (!current?.info || !player) return;
    configure();
    if (progress !== undefined) {
      player.pause();
      const [start, end] = range(current, props.current.segment);
      const t = Math.min(1, Math.max(0, progress));
      player.seek(start + (end - start) * t);
      return;
    }
    player.reset();
    if (autoplay) player.play();
  }, [loaded, progress, segmentKey, mode, autoplay, configure]);

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
