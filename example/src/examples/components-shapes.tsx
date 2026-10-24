import {
  Canvas,
  Circle,
  LinearGradient,
  Path,
  PathCommand,
  RadialGradient,
  Rect,
  StrokeCap,
  StrokeJoin,
} from 'thorvg-react-native';

const Example = () => (
  <Canvas width={600} height={600}>
    <Rect x={0} y={0} width={600} height={600} fill="#1e1e1e" />
    <Rect
      x={40}
      y={40}
      width={220}
      height={220}
      rx={32}
      ry={32}
      fill="#2563eb"
      stroke={{ width: 8, color: '#93c5fd' }}
    />
    <Circle cx={450} cy={150} rx={110}>
      <RadialGradient
        cx={450}
        cy={150}
        r={110}
        stops={[
          [0, [255, 255, 255, 255]],
          [1, [255, 90, 60, 255]],
        ]}
      />
    </Circle>
    <Rect
      x={40}
      y={330}
      width={220}
      height={220}
      stroke={{
        width: 14,
        cap: StrokeCap.Round,
        join: StrokeJoin.Round,
        dash: [30, 20],
      }}
    >
      <LinearGradient
        stroke
        x1={40}
        y1={330}
        x2={260}
        y2={550}
        stops={[
          [0, [0, 255, 170, 255]],
          [1, [0, 120, 255, 255]],
        ]}
      />
    </Rect>
    <Path
      commands={[
        PathCommand.MoveTo,
        PathCommand.LineTo,
        PathCommand.LineTo,
        PathCommand.LineTo,
        PathCommand.LineTo,
        PathCommand.LineTo,
        PathCommand.LineTo,
        PathCommand.LineTo,
        PathCommand.LineTo,
        PathCommand.LineTo,
        PathCommand.Close,
      ]}
      points={[
        [450, 330],
        [478, 390],
        [545, 400],
        [497, 445],
        [508, 510],
        [450, 480],
        [392, 510],
        [403, 445],
        [355, 400],
        [422, 390],
      ]}
      fill="#facc15"
      stroke={{ width: 4, color: '#ffffff' }}
      trimPath={{ begin: 0, end: 0.8 }}
    />
  </Canvas>
);

export default Example;
