// Native example: LottieInteraction.cpp

import { useEffect, useRef } from 'react';
import type { GestureResponderEvent } from 'react-native';
import { Canvas, useThorVG } from 'thorvg-react-native';

type Point = { x: number; y: number };

const Example = () => {
  const TVG = useThorVG();
  const canvasRef = useRef<Canvas>(null);
  const layout = useRef({ width: 600, height: 600 });
  const pointer = useRef<{
    down: (p: Point) => void;
    move: (p: Point) => void;
    up: (p: Point) => void;
  } | null>(null);

  useEffect(() => {
    if (!TVG) return;
    const canvas = new TVG.Canvas(canvasRef, { width: 600, height: 600 });
    let active = true;
    let rafId = 0;

    // Drag on the canvas to spin the animation. A quick flick spins it further.

    const SIZE = 600;

    (async () => {
      const data = await fetch('/assets/lottie/extensions/spin.json').then(
        (res) => res.text()
      );
      if (!active) return;

      //LottieAnimation Controller
      const animation = new TVG.LottieAnimation();
      animation.load(data);

      const picture = animation.picture!;
      picture.origin(0.5, 0.5);

      //Lottie Boundary
      {
        const shape = new TVG.Shape();
        shape.appendRect(58.59, 58.59, SIZE - 117.19, SIZE - 117.19);
        shape.fill(50, 50, 50);
        canvas.add(shape);
      }

      //image scaling preserving its aspect ratio
      const { width, height } = picture.size();
      const scale = (width > height ? SIZE / width : SIZE / height) * 0.8;
      picture.scale(scale);
      picture.translate(SIZE / 2, SIZE / 2);
      canvas.add(picture);

      const info = animation.info()!;
      const origin = { x: SIZE / 2, y: SIZE / 2 };

      const slot = { cursor: 0, rotation: 0 };
      const effect = { duration: 2000, target: 0, time: 0, on: false };
      let rotation = 0;
      let now = 0;
      let pressed = false;
      let downTime = 0;
      let down = { x: 0, y: 0 };
      let prv = { x: 0, y: 0 };
      let cur = { x: 0, y: 0 };

      const calculate = (prv: Point, cur: Point) => {
        //degree with dot product
        let degree = Math.acos(
          (prv.x * cur.x + prv.y * cur.y) /
            (Math.sqrt(prv.x * prv.x + prv.y * prv.y) *
              Math.sqrt(cur.x * cur.x + cur.y * cur.y))
        );
        degree *= 30; //weight x30

        //direction with cross product
        const dir = prv.x * cur.y - prv.y * cur.x;
        if (dir < 0) degree *= -1;

        return degree;
      };

      const rotate = (val: number) => {
        rotation = val;
        if (slot.rotation) animation.del(slot.rotation);
        slot.rotation = animation.gen({
          spin_rotation: { p: { x: 'var $bm_rt = ' + rotation + ';' } },
        });
        animation.apply(slot.rotation);
      };

      pointer.current = {
        down(p: Point) {
          down = p;
          prv = { x: p.x - origin.x, y: p.y - origin.y };
          downTime = now;
          pressed = true;
          effect.on = false;
          effect.target = rotation;
        },
        move(p: Point) {
          cur = { x: p.x - origin.x, y: p.y - origin.y };
          if (!pressed) return;

          rotate((rotation + calculate(prv, cur)) % 360);

          prv = cur;
        },
        up(p: Point) {
          pressed = false;

          //flicking in 500ms
          if (now - downTime > 500) return;
          if (Math.abs(down.x - p.x) < 10 && Math.abs(down.y - p.y) < 10)
            return;

          const cur = { x: p.x - origin.x, y: p.y - origin.y };
          const prv = { x: down.x - origin.x, y: down.y - origin.y };

          effect.target = rotation + calculate(prv, cur) * 20; //target to spinning effect
          effect.time = now;
          effect.on = true;
        },
      };

      canvas.render();

      //Run animation loop
      let frame = 0;
      let lastTime = 0;
      const animate = (time: number) => {
        now = time;
        if (lastTime === 0) lastTime = time;
        const delta = (time - lastTime) / 1000;
        lastTime = time;

        //update cursor
        const wiggle = Math.sin(time * 0.01) * 20 + 320;
        const cx = (cur.x + origin.x) / scale + wiggle;
        const cy = (cur.y + origin.y) / scale;
        if (slot.cursor) animation.del(slot.cursor);
        slot.cursor = animation.gen({
          finger_cursor: {
            p: { x: 'var $bm_rt; $bm_rt = [' + cx + ', ' + cy + '];' },
          },
        });
        animation.apply(slot.cursor);

        //spinning effect
        if (effect.on) {
          let progress = (time - effect.time) / effect.duration;
          if (progress >= 1) {
            progress = 1;
            effect.on = false;
          }
          rotate((effect.target * Math.sin(progress)) % 360);
        }

        frame = (frame + info.fps * delta) % info.totalFrames;
        animation.frame(frame);

        canvas.update();
        canvas.render();
        if (active) rafId = requestAnimationFrame(animate);
      };

      if (active) rafId = requestAnimationFrame(animate);
    })();

    return () => {
      active = false;
      cancelAnimationFrame(rafId);
      pointer.current = null;
      canvas.destroy();
    };
  }, [TVG]);

  //Map a touch event to canvas coordinates
  const position = (e: GestureResponderEvent): Point => ({
    x: (e.nativeEvent.locationX / layout.current.width) * 600,
    y: (e.nativeEvent.locationY / layout.current.height) * 600,
  });

  if (!TVG) return null;
  return (
    <Canvas
      ref={canvasRef}
      onLayout={(e) => {
        layout.current = e.nativeEvent.layout;
      }}
      onStartShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => pointer.current?.down(position(e))}
      onResponderMove={(e) => pointer.current?.move(position(e))}
      onResponderRelease={(e) => pointer.current?.up(position(e))}
    />
  );
};

export default Example;
