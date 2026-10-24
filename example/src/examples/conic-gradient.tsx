// Native example: ConicGradient.cpp

import { useEffect, useRef } from 'react';
import { Canvas, useThorVG, type ColorStop } from 'thorvg-react-native';

const Example = () => {
  const TVG = useThorVG();
  const canvasRef = useRef<Canvas>(null);
  const rotate = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!TVG) return;
    const canvas = new TVG.Canvas(canvasRef, { width: 600, height: 600 });

    let angle = 0;
    const colorStops: [number, ColorStop][] = [
      [0, [255, 255, 255, 255]],
      [1, [0, 0, 0, 255]],
    ];
    const colorStops2: [number, ColorStop][] = [
      [0, [0, 255, 255, 255]],
      [1 / 3, [255, 0, 255, 255]],
      [2 / 3, [255, 255, 0, 255]],
      [1, [0, 255, 255, 255]],
    ];
    const colorStops3: [number, ColorStop][] = [
      [0, [0, 127, 0, 127]],
      [0.25, [0, 170, 170, 170]],
      [0.5, [200, 0, 200, 200]],
      [1, [255, 255, 255, 255]],
    ];

    //Prepare Round Rectangle
    const shape1 = new TVG.Shape();
    shape1.appendRect(0, 0, 300, 300); //x, y, w, h

    //ConicGradient
    const fill = new TVG.ConicGradient(150, 150, angle); //cx, cy, angle

    //Gradient Color Stops
    fill.setStops(...colorStops);

    shape1.fill(fill);
    canvas.add(shape1);

    //Prepare Circle
    const shape2 = new TVG.Shape();
    shape2.appendCircle(300, 300, 150, 150); //cx, cy, radiusW, radiusH

    //ConicGradient
    const fill2 = new TVG.ConicGradient(300, 300, angle); //cx, cy, angle

    //Gradient Color Stops
    fill2.setStops(...colorStops2);

    shape2.fill(fill2);
    canvas.add(shape2);

    //Prepare Ellipse
    const shape3 = new TVG.Shape();
    shape3.appendCircle(450, 450, 112.5, 75); //cx, cy, radiusW, radiusH

    //ConicGradient
    const fill3 = new TVG.ConicGradient(450, 450, angle); //cx, cy, angle

    //Gradient Color Stops
    fill3.setStops(...colorStops3);

    shape3.fill(fill3);
    canvas.add(shape3);

    canvas.render();

    rotate.current = () => {
      angle = (angle + 1) % 360;
      const fill = new TVG.ConicGradient(150, 150, angle);
      fill.setStops(...colorStops);
      shape1.fill(fill);

      const fill2 = new TVG.ConicGradient(300, 300, angle);
      fill2.setStops(...colorStops2);
      shape2.fill(fill2);

      const fill3 = new TVG.ConicGradient(450, 450, angle);
      fill3.setStops(...colorStops3);
      shape3.fill(fill3);

      console.log('ConicGradient angle: ' + angle);

      canvas.update();
      canvas.render();
    };

    return () => {
      rotate.current = null;
      canvas.destroy();
    };
  }, [TVG]);

  if (!TVG) return null;
  return (
    <Canvas
      ref={canvasRef}
      onStartShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={() => rotate.current?.()}
      onResponderMove={() => rotate.current?.()}
    />
  );
};

export default Example;
