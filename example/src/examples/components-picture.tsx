import { useEffect, useState } from 'react';
import { Canvas, Picture, Rect } from 'thorvg-react-native';

const Example = () => {
  const [svg, setSvg] = useState<string>();
  const [png, setPng] = useState<Uint8Array>();

  useEffect(() => {
    fetch('/assets/svg/tiger.svg')
      .then((res) => res.text())
      .then(setSvg);
    fetch('/assets/images/test.png')
      .then((res) => res.arrayBuffer())
      .then((buffer) => setPng(new Uint8Array(buffer)));
  }, []);

  return (
    <Canvas width={600} height={600}>
      <Rect x={0} y={0} width={600} height={600} fill="#ffffff" />
      {svg && (
        <Picture
          data={svg}
          options={{ type: 'svg' }}
          size={{ width: 300, height: 300 }}
        />
      )}
      {png && (
        <Picture
          data={png}
          options={{ type: 'png' }}
          size={{ width: 260, height: 260 }}
          translate={{ x: 320, y: 320 }}
          rotate={-10}
          opacity={220}
        />
      )}
    </Canvas>
  );
};

export default Example;
