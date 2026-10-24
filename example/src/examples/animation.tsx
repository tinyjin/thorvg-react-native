// Native example: Animation.cpp

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

    (async () => {
      //The default font for fallback in case
      const fontData = await fetch('/fonts/PublicSans-Regular.ttf')
        .then((res) => res.arrayBuffer())
        .then((buffer) => new Uint8Array(buffer));
      if (!active) return;
      TVG.Font.load('PublicSans-Regular', fontData, { type: 'ttf' });

      //Animation Controller
      const animation = new TVG.Animation();
      const picture = animation.picture!;
      picture.origin(0.5, 0.5); //center origin

      //Background
      const shape = new TVG.Shape();
      shape.appendRect(0, 0, 600, 600);
      shape.fill(50, 50, 50);

      canvas.add(shape);

      const data = await fetch('/assets/lottie/sample.json').then((res) =>
        res.text()
      );
      if (!active) return;
      animation.load(data);

      //image scaling preserving its aspect ratio
      const { width: w2, height: h2 } = picture.size();
      const scale = w2 > h2 ? 600 / w2 : 600 / h2;
      picture.scale(scale);
      picture.translate(300, 300);

      canvas.add(picture);
      canvas.render();

      const { totalFrames, duration } = animation.info()!;
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = (elapsed % (duration * 1000)) / (duration * 1000);

        //Update animation frame
        animation.frame(totalFrames * progress);

        canvas.update();
        canvas.render();

        if (active) rafId = requestAnimationFrame(animate);
      };

      animate();
    })();

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
