import { useEffect, useState } from 'react';
import { Canvas, LottieAnimation, Rect } from 'thorvg-react-native';

const Example = () => {
  const [data, setData] = useState<string>();

  useEffect(() => {
    fetch('/assets/lottie/27746-joypixels-partying-face-emoji-animation.json')
      .then((res) => res.text())
      .then(setData);
  }, []);

  return (
    <Canvas width={600} height={600}>
      <Rect x={0} y={0} width={600} height={600} fill="#f3f4f6" />
      {data && (
        <LottieAnimation
          data={data}
          size={{ width: 500, height: 500 }}
          translate={{ x: 50, y: 50 }}
          playing
          loop
        />
      )}
    </Canvas>
  );
};

export default Example;
