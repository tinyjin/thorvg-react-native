import { useEffect, useRef } from 'react';
import { Canvas, useThorVG } from 'thorvg-react-native';

const Example = () => {
  const TVG = useThorVG();
  const canvasRef = useRef<Canvas>(null);

  useEffect(() => {
    if (!TVG) return;
    const canvas = new TVG.Canvas(canvasRef, { width: 600, height: 600 });

    // Global error handling catches

    // Background
    const background = new TVG.Shape();
    background.appendRect(0, 0, 600, 600);
    background.fill(45, 45, 45);
    canvas.add(background);

    // Error: Invalid SVG data (ThorVGError - WASM error)
    const picture = new TVG.Picture();
    picture.load('invalid svg data', { type: 'svg' }); // Error caught by onError
    canvas.add(picture);

    // Visual indicator
    const errorIndicator = new TVG.Shape();
    errorIndicator.appendCircle(300, 300, 100, 100);
    errorIndicator.fill(255, 100, 100, 255);
    canvas.add(errorIndicator);

    // Info text
    const infoText = new TVG.Text();
    infoText.font('default');
    infoText.fontSize(16);
    infoText.text('Check console for error logs');
    infoText.fill(255, 255, 255);
    infoText.translate(150, 500);
    canvas.add(infoText);

    canvas.render();

    return () => canvas.destroy();
  }, [TVG]);

  if (!TVG) return null;
  return <Canvas ref={canvasRef} />;
};

export default Example;
