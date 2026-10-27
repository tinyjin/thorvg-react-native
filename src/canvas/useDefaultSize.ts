import { useEffect, useState } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import {
  drawingSize,
  subscribeDrawingSize,
  type CanvasTarget,
} from './CanvasTarget';

function sized(style: StyleProp<ViewStyle>): boolean {
  const flat = StyleSheet.flatten(style) ?? {};
  return (
    flat.width !== undefined ||
    flat.height !== undefined ||
    flat.aspectRatio !== undefined ||
    flat.flex !== undefined
  );
}

export function useDefaultSize(
  target: CanvasTarget,
  style: StyleProp<ViewStyle>
): StyleProp<ViewStyle> {
  const [size, setSize] = useState(() => drawingSize(target));

  useEffect(() => {
    setSize(drawingSize(target));
    return subscribeDrawingSize(target, setSize);
  }, [target]);

  if (!size || sized(style)) return style;
  return [
    {
      width: '100%',
      maxWidth: size.width,
      maxHeight: size.height,
      aspectRatio: size.width / size.height,
    },
    style,
  ];
}
