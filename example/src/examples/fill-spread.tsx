// Native example: FillSpread.cpp

import { useEffect, useRef } from 'react';
import { Canvas, useThorVG } from 'thorvg-react-native';

const Example = () => {
  const TVG = useThorVG();
  const canvasRef = useRef<Canvas>(null);

  useEffect(() => {
    if (!TVG) return;
    const canvas = new TVG.Canvas(canvasRef, { width: 600, height: 600 });

    //Radial grad
    {
      let x1,
        y1 = 60.0,
        r = 90.0;

      //Pad
      x1 = 30.0;
      const shape1 = new TVG.Shape();
      shape1.appendRect(x1, y1, 2.0 * r, 2.0 * r);

      const fill1 = new TVG.RadialGradient(
        x1 + r,
        y1 + r,
        30.0,
        x1 + r,
        y1 + r,
        0.0
      );
      fill1.setStops(
        [0.0, [127, 39, 255, 255]],
        [0.33, [159, 112, 253, 255]],
        [0.66, [253, 191, 96, 255]],
        [1.0, [255, 137, 17, 255]]
      );
      fill1.spread(TVG.GradientSpread.Pad);
      shape1.fill(fill1);

      canvas.add(shape1);

      //Reflect
      x1 = 215.0;
      const shape2 = new TVG.Shape();
      shape2.appendRect(x1, y1, 2.0 * r, 2.0 * r);

      const fill2 = new TVG.RadialGradient(
        x1 + r,
        y1 + r,
        30.0,
        x1 + r,
        y1 + r,
        0.0
      );
      fill2.setStops(
        [0.0, [127, 39, 255, 255]],
        [0.33, [159, 112, 253, 255]],
        [0.66, [253, 191, 96, 255]],
        [1.0, [255, 137, 17, 255]]
      );
      fill2.spread(TVG.GradientSpread.Reflect);
      shape2.fill(fill2);

      canvas.add(shape2);

      //Repeat
      x1 = 400.0;
      const shape3 = new TVG.Shape();
      shape3.appendRect(x1, y1, 2.0 * r, 2.0 * r);

      const fill3 = new TVG.RadialGradient(
        x1 + r,
        y1 + r,
        30.0,
        x1 + r,
        y1 + r,
        0.0
      );
      fill3.setStops(
        [0.0, [127, 39, 255, 255]],
        [0.33, [159, 112, 253, 255]],
        [0.66, [253, 191, 96, 255]],
        [1.0, [255, 137, 17, 255]]
      );
      fill3.spread(TVG.GradientSpread.Repeat);
      shape3.fill(fill3);

      canvas.add(shape3);
    }

    //Linear grad
    {
      let x1,
        y1 = 340.0,
        r = 90.0;

      //Pad
      x1 = 30.0;
      const shape1 = new TVG.Shape();
      shape1.appendRect(x1, y1, 2.0 * r, 2.0 * r);

      const fill1 = new TVG.LinearGradient(x1, y1, x1 + 37.5, y1 + 37.5);
      fill1.setStops(
        [0.0, [127, 39, 255, 255]],
        [0.33, [159, 112, 253, 255]],
        [0.66, [253, 191, 96, 255]],
        [1.0, [255, 137, 17, 255]]
      );
      fill1.spread(TVG.GradientSpread.Pad);
      shape1.fill(fill1);

      canvas.add(shape1);

      //Reflect
      x1 = 215.0;
      const shape2 = new TVG.Shape();
      shape2.appendRect(x1, y1, 2.0 * r, 2.0 * r);

      const fill2 = new TVG.LinearGradient(x1, y1, x1 + 37.5, y1 + 37.5);
      fill2.setStops(
        [0.0, [127, 39, 255, 255]],
        [0.33, [159, 112, 253, 255]],
        [0.66, [253, 191, 96, 255]],
        [1.0, [255, 137, 17, 255]]
      );
      fill2.spread(TVG.GradientSpread.Reflect);
      shape2.fill(fill2);

      canvas.add(shape2);

      //Repeat
      x1 = 400.0;
      const shape3 = new TVG.Shape();
      shape3.appendRect(x1, y1, 2.0 * r, 2.0 * r);

      const fill3 = new TVG.LinearGradient(x1, y1, x1 + 37.5, y1 + 37.5);
      fill3.setStops(
        [0.0, [127, 39, 255, 255]],
        [0.33, [159, 112, 253, 255]],
        [0.66, [253, 191, 96, 255]],
        [1.0, [255, 137, 17, 255]]
      );
      fill3.spread(TVG.GradientSpread.Repeat);
      shape3.fill(fill3);

      canvas.add(shape3);
    }

    canvas.render();

    return () => canvas.destroy();
  }, [TVG]);

  if (!TVG) return null;
  return <Canvas ref={canvasRef} />;
};

export default Example;
