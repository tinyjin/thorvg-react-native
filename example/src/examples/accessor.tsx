// Native example: Accessor.cpp

import { useEffect, useRef } from 'react';
import { Canvas, useThorVG } from 'thorvg-react-native';

const Example = () => {
  const TVG = useThorVG();
  const canvasRef = useRef<Canvas>(null);

  useEffect(() => {
    if (!TVG) return;
    const canvas = new TVG.Canvas(canvasRef, { width: 600, height: 600 });
    let active = true;

    // This example demonstrates two approaches to accessing internal SVG scene nodes.
    (async () => {
      // SVG Picture
      const svgString = await fetch('/assets/svg/favorite_on.svg').then((res) =>
        res.text()
      );
      if (!active) return;

      const picture = new TVG.Picture();

      picture.accessible = true; // allow access to the SVG internals, it must be set before the SVG load call.
      picture.load(svgString, { type: 'svg' });
      picture.size(600, 600);

      /* 1. This demonstrates traversing the internal scene tree of the SVG picture. */
      const accessor = new TVG.Accessor();

      // If picture.accessible is set to true, only ID-accessible nodes are traversed,
      // which improves efficiency. Otherwise, all nodes are considered.
      accessor.set(picture, (paint) => {
        // figure out SVG node with the unique ID "star".
        if (accessor.name(paint.id) === 'star' && paint instanceof TVG.Shape) {
          // override color
          paint.fill(0, 0, 255);
        }

        // you can return false, to stop traversing immediately
        return true;
      });

      /* 2. This demonstrates a direct-access to the shape that corresponds to the SVG node with the unique ID "star". */
      const paint = picture.paint(TVG.Accessor.id('star'));
      if (paint instanceof TVG.Shape) {
        paint.stroke({ width: 5, color: [255, 255, 0, 255] });
      }

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
