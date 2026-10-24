// Native example: PictureData.cpp

import { useEffect, useRef } from 'react';
import { Canvas, useThorVG } from 'thorvg-react-native';

const Example = () => {
  const TVG = useThorVG();
  const canvasRef = useRef<Canvas>(null);

  useEffect(() => {
    if (!TVG) return;
    const canvas = new TVG.Canvas(canvasRef, { width: 600, height: 600 });
    let active = true;
    let rafId = 0;

    const buffer = new Uint8Array(800 * 800 * 4);

    const generate = () => {
      // generate the content image
      for (let i = 0; i < 800 * 800 * 4; i += 4) {
        buffer[i + 0] = 255;
        buffer[i + 1] = Math.floor(Math.random() * 255);
        buffer[i + 2] = Math.floor(Math.random() * 255);
        buffer[i + 3] = Math.floor(Math.random() * 255);
      }
    };

    generate();

    // picture 1
    const picture1 = new TVG.Picture();
    picture1.scale(0.375);

    // load the picture raw image data
    picture1.load(buffer, {
      type: 'raw',
      width: 800,
      height: 800,
      colorSpace: TVG.ColorSpace.ABGR8888,
    });

    canvas.add(picture1);

    // picture 2
    const picture2 = new TVG.Picture();
    picture2.translate(300, 300);
    picture2.scale(0.375);

    // load the picture raw image data
    picture2.load(buffer, {
      type: 'raw',
      width: 800,
      height: 800,
      colorSpace: TVG.ColorSpace.ABGR8888,
    });

    canvas.add(picture2);

    const animate = () => {
      generate();

      // only reload the picture1 image
      picture1.load(buffer, {
        type: 'raw',
        width: 800,
        height: 800,
        colorSpace: TVG.ColorSpace.ABGR8888,
      });

      canvas.update();
      canvas.render();

      if (active) rafId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      active = false;
      cancelAnimationFrame(rafId);
      canvas.destroy();
    };
  }, [TVG]);

  if (!TVG) return null;
  return <Canvas ref={canvasRef} />;
};

export default Example;
