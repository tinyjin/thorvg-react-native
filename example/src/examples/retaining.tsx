// Native example: Retaining.cpp

import { useEffect, useRef } from 'react';
import { Canvas, useThorVG, type Paint } from 'thorvg-react-native';

const Example = () => {
  const TVG = useThorVG();
  const canvasRef = useRef<Canvas>(null);

  useEffect(() => {
    if (!TVG) return;
    const canvas = new TVG.Canvas(canvasRef, { width: 600, height: 600 });
    let active = true;
    let rafId = 0;

    const paints: Paint[] = [];

    //Prepare Round Rectangle
    const shape1 = new TVG.Shape();
    shape1.appendRect(0, 0, 300, 300, { rx: 31.25, ry: 31.25 }); //x, y, w, h, rx, ry
    shape1.fill(0, 255, 0); //r, g, b
    canvas.add(shape1);
    paints.push(shape1);

    //Prepare Round Rectangle2
    const shape2 = new TVG.Shape();
    shape2.appendRect(87.5, 87.5, 300, 300, { rx: 31.25, ry: 31.25 }); //x, y, w, h, rx, ry
    shape2.fill(255, 255, 0); //r, g, b
    canvas.add(shape2);
    paints.push(shape2);

    //Prepare Round Rectangle3
    const shape3 = new TVG.Shape();
    shape3.appendRect(175, 175, 300, 300, { rx: 31.25, ry: 31.25 }); //x, y, w, h, rx, ry
    shape3.fill(0, 255, 255); //r, g, b
    canvas.add(shape3);
    paints.push(shape3);

    //Prepare Scene
    const scene = new TVG.Scene();

    const shape4 = new TVG.Shape();
    shape4.appendCircle(325, 325, 87.5, 87.5);
    shape4.fill(255, 0, 0);
    shape4.stroke({ width: 3.125, color: [255, 255, 255] });
    scene.add(shape4);

    const shape5 = new TVG.Shape();
    shape5.appendCircle(393.75, 393.75, 118.75, 118.75);
    shape5.fill(255, 0, 255);
    shape5.stroke({ width: 3.125, color: [255, 255, 255] });
    scene.add(shape5);

    canvas.add(scene);
    paints.push(scene);

    canvas.render();

    const startTime = Date.now();
    let last = 0;

    const animate = () => {
      const elapsed = Date.now() - startTime;

      //update per every 250ms
      //reorder with a circular list
      if (elapsed - last >= 250) {
        //Acquire the first paint from the root scene
        const paint = paints.shift()!;

        //Add again the front paint to the end of the root scene
        canvas.remove(paint);
        canvas.add(paint);
        paints.push(paint);

        last = elapsed;

        canvas.update();
        canvas.render();
      }

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
