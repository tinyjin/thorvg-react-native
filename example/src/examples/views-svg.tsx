import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SvgView } from 'thorvg-react-native';

const badge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="46" fill="#2563eb"/>
  <path d="M30 52 L45 66 L72 36" stroke="#ffffff" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const Example = () => (
  <View>
    <SvgView
      source={{
        uri: '/assets/svg/tiger.svg',
      }}
      style={styles.hero}
    />
    <View style={styles.panel}>
      <Tile label="String">
        <SvgView source={badge} style={styles.tile} />
      </Tile>
      <Tile label="tintColor">
        <SvgView source={badge} tintColor="#f43f5e" style={styles.tile} />
      </Tile>
      <Tile label="contentFit cover">
        <SvgView
          source={{
            uri: '/assets/svg/logo.svg',
          }}
          contentFit="cover"
          style={[styles.tile, styles.light]}
        />
      </Tile>
    </View>
  </View>
);

const Tile = ({ label, children }: { label: string; children: ReactNode }) => (
  <View style={styles.item}>
    {children}
    <Text style={styles.label}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  hero: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#ffffff',
  },
  panel: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#252526',
  },
  item: {
    flex: 1,
    gap: 8,
  },
  tile: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: '#2d2d30',
  },
  light: {
    backgroundColor: '#ffffff',
  },
  label: {
    color: '#a0a0a6',
    fontSize: 12,
    textAlign: 'center',
  },
});

export default Example;
