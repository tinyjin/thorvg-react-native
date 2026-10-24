// Native example: PictureSvg.cpp

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

      const data = await fetch('/assets/svg/logo.svg').then((res) =>
        res.text()
      );
      if (!active) return;

      const opacity = 36;

      //Load svg file
      for (let i = 0; i < 7; ++i) {
        const picture = new TVG.Picture();
        picture.load(data, { type: 'svg' });
        picture.translate(i * 112.5, i * 112.5);
        picture.rotate(30 * i);
        picture.size(150, 150);
        picture.opacity(opacity + opacity * i);
        canvas.add(picture);
      }

      //Open file
      const picture = new TVG.Picture();
      picture.load(data, { type: 'svg' });

      picture.translate(300, 0);
      picture.scale(0.3);
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
