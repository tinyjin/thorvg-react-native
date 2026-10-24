import {
  Canvas,
  Circle,
  Clip,
  Mask,
  MaskMethod,
  Rect,
  Scene,
} from 'thorvg-react-native';

const stripes = Array.from({ length: 12 }, (_, i) => i * 50);

const Example = () => (
  <Canvas width={600} height={600}>
    <Rect x={0} y={0} width={600} height={600} fill="#111827" />
    <Scene>
      {stripes.map((y) => (
        <Rect key={y} x={0} y={y} width={600} height={25} fill="#f472b6" />
      ))}
      <Clip>
        <Circle cx={160} cy={300} rx={130} />
      </Clip>
    </Scene>
    <Rect x={320} y={170} width={260} height={260} fill="#38bdf8">
      <Mask method={MaskMethod.InvAlpha}>
        <Circle cx={450} cy={300} rx={90} fill="#ffffff" />
      </Mask>
    </Rect>
  </Canvas>
);

export default Example;
