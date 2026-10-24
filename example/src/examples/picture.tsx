// Native example: Picture.cpp

import { useEffect, useRef } from 'react';
import { Canvas, useThorVG } from 'thorvg-react-native';

const Example = () => {
  const TVG = useThorVG();
  const canvasRef = useRef<Canvas>(null);

  useEffect(() => {
    if (!TVG) return;
    const canvas = new TVG.Canvas(canvasRef, { width: 600, height: 600 });
    let active = true;

    (async () => {
      //The default font for fallback in case
      const fontData = await fetch('/fonts/PublicSans-Regular.ttf')
        .then((res) => res.arrayBuffer())
        .then((buffer) => new Uint8Array(buffer));
      if (!active) return;
      TVG.Font.load('PublicSans-Regular', fontData, { type: 'ttf' });

      //Background
      const bg = new TVG.Shape();
      bg.appendRect(0, 0, 600, 600);
      bg.fill(50, 50, 50);
      canvas.add(bg);

      const picture = new TVG.Picture();
      picture.origin(0.5, 0.5); //center origin

      const data = await fetch('/assets/svg/logo.svg').then((res) =>
        res.text()
      );
      if (!active) return;
      picture.load(data, { type: 'svg' });

      //image scaling preserving its aspect ratio
      const { width: w2, height: h2 } = picture.size();
      const scale = w2 > h2 ? 600 / w2 : 600 / h2;
      picture.scale(scale);
      picture.translate(300, 300);

      canvas.add(picture);
      canvas.render();
    })();

    return () => {
      active = false;
      canvas.destroy();
    };
  }, [TVG]);

  if (!TVG) return null;
  return <Canvas ref={canvasRef} />;
};

export default Example;
