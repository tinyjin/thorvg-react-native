import { useEffect, useState } from 'react';
import {
  Canvas,
  Font,
  LinearGradient,
  Rect,
  Text,
  TextWrapMode,
} from 'thorvg-react-native';

const Example = () => {
  const [font, setFont] = useState<Uint8Array>();

  useEffect(() => {
    fetch('/fonts/PublicSans-Regular.ttf')
      .then((res) => res.arrayBuffer())
      .then((buffer) => setFont(new Uint8Array(buffer)));
  }, []);

  return (
    <Canvas width={600} height={600}>
      <Rect x={0} y={0} width={600} height={600} fill="#ffffff" />
      {font && <Font name="PublicSans" data={font} type="ttf" />}
      <Text
        text="ThorVG Text"
        font={font ? 'PublicSans' : 'default'}
        fontSize={64}
        translate={{ x: 40, y: 60 }}
      >
        <LinearGradient
          x1={40}
          y1={0}
          x2={560}
          y2={0}
          stops={[
            [0, [37, 99, 235, 255]],
            [1, [236, 72, 153, 255]],
          ]}
        />
      </Text>
      <Text
        text="Italic with outline"
        font={font ? 'PublicSans' : 'default'}
        fontSize={40}
        fill={[30, 30, 30]}
        italic
        outline={{ width: 2, color: [250, 204, 21] }}
        translate={{ x: 40, y: 180 }}
      />
      <Text
        text="Text wraps inside the layout box when it reaches the right edge of the area."
        font={font ? 'PublicSans' : 'default'}
        fontSize={28}
        fill="#374151"
        layout={{ width: 520, height: 200 }}
        wrap={TextWrapMode.Word}
        spacing={{ letter: 1, line: 1.2 }}
        translate={{ x: 40, y: 300 }}
      />
    </Canvas>
  );
};

export default Example;
