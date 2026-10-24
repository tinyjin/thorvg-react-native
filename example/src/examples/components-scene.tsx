import { useEffect, useState } from 'react';
import { BlendMethod, Canvas, Circle, Rect, Scene } from 'thorvg-react-native';

const Example = () => {
  const [angle, setAngle] = useState(0);

  useEffect(() => {
    let rafId = 0;
    const start = Date.now();
    const tick = () => {
      setAngle(((Date.now() - start) / 20) % 360);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <Canvas width={600} height={600}>
      <Rect x={0} y={0} width={600} height={600} fill="#ffffff" />
      <Scene
        translate={{ x: 300, y: 300 }}
        rotate={angle}
        effects={[
          {
            type: 'dropShadow',
            color: [0, 0, 0, 120],
            angle: 120,
            distance: 20,
            sigma: 8,
          },
        ]}
      >
        <Rect
          x={-150}
          y={-150}
          width={300}
          height={300}
          rx={40}
          ry={40}
          fill="#22c55e"
        />
        <Scene opacity={200} blend={BlendMethod.Multiply}>
          <Circle cx={-60} cy={-60} rx={110} fill="#facc15" />
          <Circle cx={80} cy={80} rx={90} fill="#06b6d4" />
        </Scene>
      </Scene>
    </Canvas>
  );
};

export default Example;
