// Native example: Viewport.cpp

import { useEffect, useRef } from 'react';
import { Canvas, useThorVG } from 'thorvg-react-native';

const Example = () => {
  const TVG = useThorVG();
  const canvasRef = useRef<Canvas>(null);

  useEffect(() => {
    if (!TVG) return;
    const canvas = new TVG.Canvas(canvasRef, { width: 1024, height: 1024 });
    let active = true;
    let rafId = 0;

    const VPORT_SIZE = 300;

    (async () => {
      //set viewport before canvas become dirty.
      canvas.viewport(0, 0, VPORT_SIZE, VPORT_SIZE);

      const mask = new TVG.Shape();
      mask.appendCircle(1024 / 2, 1024 / 2, 1024 / 2, 1024 / 2);
      mask.fill(255, 255, 255);
      //Use the opacity for a half-translucent mask.
      mask.opacity(125);

      const data = await fetch('/assets/svg/tiger.svg').then((res) =>
        res.text()
      );
      if (!active) return;

      const picture = new TVG.Picture();
      picture.load(data, { type: 'svg' });
      picture.size(1024, 1024);
      picture.mask(mask, TVG.MaskMethod.Alpha);
      canvas.add(picture);

      canvas.render();

      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const duration = 2000; // play time 2 sec.
        let progress = (elapsed % duration) / duration;
        if (Math.floor(elapsed / duration) % 2 !== 0) progress = 1 - progress;

        canvas.viewport(
          (1024 - VPORT_SIZE) * progress,
          (1024 - VPORT_SIZE) * progress,
          VPORT_SIZE,
          VPORT_SIZE
        );
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
