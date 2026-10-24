import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LottieView, type LottieMode } from 'thorvg-react-native';

const modes: { value: LottieMode; label: string }[] = [
  { value: 'forward', label: 'Forward' },
  { value: 'reverse', label: 'Reverse' },
  { value: 'bounce', label: 'Bounce' },
  { value: 'reverse-bounce', label: 'Reverse bounce' },
];

const speeds = [0.5, 1, 2];

const Example = () => {
  const lottie = useRef<LottieView>(null);
  const [mode, setMode] = useState<LottieMode>('forward');
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const total = useRef(1);

  const toggle = () => {
    if (playing) lottie.current?.pause();
    else lottie.current?.play();
    setPlaying(!playing);
  };

  return (
    <View>
      <LottieView
        ref={lottie}
        source={{
          uri: '/assets/lottie/alien.json',
        }}
        autoplay
        loop
        mode={mode}
        speed={speed}
        onLoad={(info) => {
          total.current = Math.max(1, info.totalFrames - 1);
        }}
        onFrame={(frame) => setProgress(frame / total.current)}
        style={styles.animation}
      />
      <View style={styles.track}>
        <View style={[styles.bar, { width: `${progress * 100}%` }]} />
      </View>
      <View style={styles.panel}>
        <Text style={styles.label}>Mode</Text>
        <View style={styles.segments}>
          {modes.map((item) => (
            <Segment
              key={item.value}
              label={item.label}
              selected={item.value === mode}
              onPress={() => setMode(item.value)}
            />
          ))}
        </View>
        <Text style={styles.label}>Speed</Text>
        <View style={styles.segments}>
          {speeds.map((item) => (
            <Segment
              key={item}
              label={`${item}×`}
              selected={item === speed}
              onPress={() => setSpeed(item)}
            />
          ))}
        </View>
        <Pressable onPress={toggle} style={styles.button}>
          <Text style={styles.buttonText}>{playing ? 'Pause' : 'Play'}</Text>
        </Pressable>
      </View>
    </View>
  );
};

const Segment = ({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    style={[styles.segment, selected && styles.segmentSelected]}
  >
    <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
      {label}
    </Text>
  </Pressable>
);

const styles = StyleSheet.create({
  animation: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#f3f4f6',
  },
  track: {
    height: 3,
    backgroundColor: '#3e3e42',
  },
  bar: {
    height: 3,
    backgroundColor: '#4fc1ff',
  },
  panel: {
    padding: 16,
    gap: 8,
    backgroundColor: '#252526',
  },
  label: {
    color: '#a0a0a6',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  segments: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  segment: {
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#2d2d30',
  },
  segmentSelected: {
    backgroundColor: '#4fc1ff',
  },
  segmentText: {
    color: '#e6e6e6',
    fontSize: 14,
  },
  segmentTextSelected: {
    color: '#000000',
    fontWeight: '600',
  },
  button: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#e6e6e6',
  },
  buttonText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default Example;
