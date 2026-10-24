// Native example: DirectUpdate.cpp

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

    //Shape (for BG)
    const bg = new TVG.Shape();
    bg.appendRect(0, 0, 600, 600);
    bg.fill(255, 255, 255);
    canvas.add(bg);

    //Solid Shape
    const solid = new TVG.Shape();
    solid.appendRect(-62.5, -62.5, 125, 125);

    //fill property will be retained
    solid.fill(127, 255, 255, 255);
    solid.stroke({
      width: 0.625,
      color: [0, 0, 255, 255],
    });

    //Gradient Shape
    const gradient = new TVG.Shape();
    gradient.appendRect(475, 0, 125, 125);

    //LinearGradient
    const fill = new TVG.LinearGradient(475, 0, 475 + 178.125, 187.5);
    fill.setStops(
      [0, [255, 0, 0, 127]],
      [0.5, [255, 255, 0, 127]],
      [1, [255, 255, 255, 127]]
    );
    gradient.fill(fill);

    canvas.add(solid);
    canvas.add(gradient);
    canvas.render();

    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const duration = 2000; // play time 2 sec.
      let progress = (elapsed % duration) / duration;
      if (Math.floor(elapsed / duration) % 2 !== 0) progress = 1 - progress;

      //Reset Shape
      solid.reset();
      const cornerRadius = 62.5 * progress;
      solid.appendRect(
        -62.5 + 600 * progress,
        -62.5 + 600 * progress,
        125,
        125,
        { rx: cornerRadius, ry: cornerRadius }
      );

      //Solid Shape
      solid.stroke({ width: 18.75 * progress });

      //Gradient Shape
      gradient.translate(-(600 * progress), 600 * progress);

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
