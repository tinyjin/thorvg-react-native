// Native example: Intersects.cpp

import { useEffect, useRef } from 'react';
import type { GestureResponderEvent } from 'react-native';
import {
  Canvas,
  useThorVG,
  type Picture,
  type Shape,
  type Text,
} from 'thorvg-react-native';

const Example = () => {
  const TVG = useThorVG();
  const canvasRef = useRef<Canvas>(null);
  const layout = useRef({ width: 600, height: 600 });
  const pointer = useRef<((x: number, y: number) => void) | null>(null);

  useEffect(() => {
    if (!TVG) return;
    const canvas = new TVG.Canvas(canvasRef, { width: 600, height: 600 });
    let active = true;
    let rafId = 0;

    //Use a scene for selection effect
    let shape: Shape, picture: Picture, text: Text, tiger: Picture;

    let marquee: Shape;
    let mx = 0,
      my = 0,
      mw = 10,
      mh = 10;

    (async () => {
      //dash stroke filled shape
      {
        shape = new TVG.Shape();
        shape.moveTo(127.5, 42.5);
        shape.lineTo(190, 202.5);
        shape.lineTo(37.5, 100);
        shape.lineTo(217.5, 100);
        shape.lineTo(65, 202.5);
        shape.close();
        shape.fill(255, 255, 255);
        shape.fillRule(TVG.FillRule.EvenOdd);

        shape.stroke({
          width: 10,
          color: [0, 255, 0, 255],
          cap: TVG.StrokeCap.Butt,
          dash: [20, 20],
        });

        shape.scale(1.25);

        canvas.add(shape);
      }

      //clipped, rotated image
      {
        picture = new TVG.Picture();
        const data = await fetch('/assets/images/test.jpg')
          .then((res) => res.arrayBuffer())
          .then((buffer) => new Uint8Array(buffer));
        if (!active) return;
        picture.load(data, { type: 'jpg' });

        picture.translate(400, 50);
        picture.rotate(47);
        picture.scale(0.5);

        const clip = new TVG.Shape();
        clip.appendCircle(450, 175, 100, 100);
        picture.clip(clip);

        canvas.add(picture);
      }

      //normal text
      {
        const data = await fetch('/fonts/PublicSans-Regular.ttf')
          .then((res) => res.arrayBuffer())
          .then((buffer) => new Uint8Array(buffer));
        if (!active) return;
        TVG.Font.load('PublicSans-Regular', data, { type: 'ttf' });
        text = new TVG.Text();
        text.font('PublicSans-Regular');
        text.fontSize(50);
        text.text('Intersect?!');
        text.translate(12.5, 400);
        text.fill(255, 255, 255);

        canvas.add(text);
      }

      //vector scene
      {
        tiger = new TVG.Picture();
        const data = await fetch('/assets/svg/tiger.svg').then((res) =>
          res.text()
        );
        if (!active) return;
        tiger.load(data, { type: 'svg' });
        tiger.translate(350, 320);
        tiger.scale(0.25);

        canvas.add(tiger);
      }

      //marquee
      {
        marquee = new TVG.Shape();
        marquee.appendRect(mx, my, mw, mh);
        marquee.stroke({ width: 1, color: [255, 255, 0, 255] });
        marquee.fill(255, 255, 0, 50);
        canvas.add(marquee);
      }

      pointer.current = (x, y) => {
        //center align
        mx = Math.trunc(x - mw * 0.5);
        my = Math.trunc(y - mh * 0.5);
      };

      const animate = () => {
        marquee.translate(mx, my);

        //reset
        shape.opacity(255);
        picture.opacity(255);
        text.opacity(255);
        tiger.opacity(255);

        const dpr = canvas.dpr;
        if (shape.intersects(mx * dpr, my * dpr, mw * dpr, mh * dpr, true))
          shape.opacity(127);
        else if (
          picture.intersects(mx * dpr, my * dpr, mw * dpr, mh * dpr, true)
        )
          picture.opacity(127);
        else if (text.intersects(mx * dpr, my * dpr, mw * dpr, mh * dpr, true))
          text.opacity(127);
        else if (tiger.intersects(mx * dpr, my * dpr, mw * dpr, mh * dpr, true))
          tiger.opacity(127);

        canvas.update();
        canvas.render();

        if (active) rafId = requestAnimationFrame(animate);
      };

      animate();
    })();

    return () => {
      active = false;
      cancelAnimationFrame(rafId);
      pointer.current = null;
      canvas.destroy();
    };
  }, [TVG]);

  const onTouch = (e: GestureResponderEvent) => {
    const { width, height } = layout.current;
    pointer.current?.(
      e.nativeEvent.locationX * (600 / width),
      e.nativeEvent.locationY * (600 / height)
    );
  };

  if (!TVG) return null;
  return (
    <Canvas
      ref={canvasRef}
      onLayout={(e) => {
        layout.current = e.nativeEvent.layout;
      }}
      onStartShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={onTouch}
      onResponderMove={onTouch}
    />
  );
};

export default Example;
