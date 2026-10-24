// Native example: SceneEffects.cpp

import { useEffect, useRef } from 'react';
import { Canvas, useThorVG, type Scene } from 'thorvg-react-native';

const Example = () => {
  const TVG = useThorVG();
  const canvasRef = useRef<Canvas>(null);

  useEffect(() => {
    if (!TVG) return;
    const canvas = new TVG.Canvas(canvasRef, { width: 600, height: 400 });
    let active = true;
    let rafId = 0;

    const SIZE = 200;

    const blur: Scene[] = []; //(for direction both, horizontal, vertical)
    let fill: Scene, tint: Scene, trintone: Scene;

    //blur scene
    (async () => {
      const svgData = await fetch('/assets/svg/tiger.svg')
        .then((res) => res.arrayBuffer())
        .then((buffer) => new Uint8Array(buffer));
      if (!active) return;

      for (let i = 0; i < 3; i++) {
        blur[i] = new TVG.Scene();

        const picture = new TVG.Picture();
        picture.load(svgData, { type: 'svg' });
        picture.size(SIZE, SIZE);
        picture.translate(SIZE * i, 0);

        blur[i].add(picture);
        canvas.add(blur[i]);
      }

      //fill scene
      {
        fill = new TVG.Scene();

        const picture = new TVG.Picture();
        picture.load(svgData, { type: 'svg' });
        picture.size(SIZE, SIZE);
        picture.translate(0, SIZE);

        fill.add(picture);
        canvas.add(fill);
      }

      //tint scene
      {
        tint = new TVG.Scene();

        const picture = new TVG.Picture();
        picture.load(svgData, { type: 'svg' });
        picture.size(SIZE, SIZE);
        picture.translate(SIZE, SIZE);

        tint.add(picture);
        canvas.add(tint);
      }

      //trinton scene
      {
        trintone = new TVG.Scene();

        const picture = new TVG.Picture();
        picture.load(svgData, { type: 'svg' });
        picture.size(SIZE, SIZE);
        picture.translate(SIZE * 2, SIZE);

        trintone.add(picture);
        canvas.add(trintone);
      }

      canvas.render();

      // Animation loop
      let startTime = Date.now();
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const duration = 2500; // 2.5 seconds
        let progress = (elapsed % duration) / duration;
        if (Math.floor(elapsed / duration) % 2 !== 0) progress = 1 - progress;

        //Apply GaussianBlur post effect (sigma, direction, border option, quality)
        for (let i = 0; i < 3; i++) {
          blur[i].resetEffects();
          blur[i].gaussianBlur(10.0 * progress, i, 0, 100);
        }

        //Apply Fill post effect (rgba)
        fill.resetEffects();
        fill.fillEffect(
          0,
          Math.floor(progress * 255),
          0,
          Math.floor(255 * progress)
        );

        //Apply Tint post effect (black:rgb, white:rgb, intensity)
        tint.resetEffects();
        tint.tint(0, 0, 0, 0, Math.floor(progress * 255), 0, progress * 100);

        //Apply Tritone post effect (shadow:rgb, midtone:rgb, highlight:rgb, blending with original)
        trintone.resetEffects();
        trintone.tritone(
          0,
          Math.floor(progress * 255),
          0,
          199,
          110,
          36,
          255,
          255,
          255,
          0
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
