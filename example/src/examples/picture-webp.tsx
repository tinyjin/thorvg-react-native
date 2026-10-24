// Native example: PictureWebp.cpp

import { useEffect, useRef } from 'react';
import { Canvas, useThorVG } from 'thorvg-react-native';

const Example = () => {
  const TVG = useThorVG();
  const canvasRef = useRef<Canvas>(null);

  useEffect(() => {
    if (!TVG) return;
    const canvas = new TVG.Canvas(canvasRef, { width: 600, height: 600 });
    let active = true;

    //Background
    const bg = new TVG.Shape();
    bg.appendRect(0, 0, 600, 600); //x, y, w, h
    bg.fill(255, 255, 255); //r, g, b
    canvas.add(bg);

    //Load webp file
    (async () => {
      const data = await fetch('/assets/images/test.webp')
        .then((res) => res.arrayBuffer())
        .then((buffer) => new Uint8Array(buffer));
      if (!active) return;

      for (let i = 0; i < 7; ++i) {
        const picture = new TVG.Picture();
        picture.load(data, { type: 'webp' });
        picture.translate(i * 97.5, i * 97.5);
        picture.rotate(30 * i);
        picture.size(130, 130);
        picture.opacity(31 * (1 + i));
        canvas.add(picture);
      }

      //Open file
      {
        const picture = new TVG.Picture();
        picture.load(data, { type: 'webp' });

        picture.translate(260, 0);
        picture.scale(0.65);
        canvas.add(picture);
      }

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
