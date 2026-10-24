// Native example: PictureJpg.cpp

import { useEffect, useRef } from 'react';
import { Canvas, useThorVG } from 'thorvg-react-native';

const Example = () => {
  const TVG = useThorVG();
  const canvasRef = useRef<Canvas>(null);

  useEffect(() => {
    if (!TVG) return;
    const canvas = new TVG.Canvas(canvasRef, { width: 600, height: 600 });
    let active = true;

    //Load jpg file
    (async () => {
      const data = await fetch('/assets/images/test.jpg')
        .then((res) => res.arrayBuffer())
        .then((buffer) => new Uint8Array(buffer));
      if (!active) return;

      for (let i = 0; i < 7; ++i) {
        const picture = new TVG.Picture();
        picture.load(data, { type: 'jpg' });
        picture.translate(i * 97.5, i * 97.5);
        picture.rotate(30 * i);
        picture.size(130, 130);
        picture.opacity(36 * (1 + i));
        canvas.add(picture);
      }

      //Open file
      {
        const picture = new TVG.Picture();
        picture.load(data, { type: 'jpg' });

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
