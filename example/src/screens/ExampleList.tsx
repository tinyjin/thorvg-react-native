import { useMemo } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { examples, type Example } from '../examples';
import { ASSETS } from '../examples/assets';
import { categories, colors, type CategoryKey } from '../theme';

const GAP = 12;
const PADDING = 16;

export function examplesIn(category: CategoryKey): Example[] {
  return category === 'all'
    ? examples
    : examples.filter((example) => example.category === category);
}

export function ExampleList({
  version,
  category,
  onCategoryChange,
  onSelect,
}: {
  version: string | null;
  category: CategoryKey;
  onCategoryChange: (category: CategoryKey) => void;
  onSelect: (example: Example) => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const columns = width >= 700 ? 3 : 2;
  const cardWidth = (width - PADDING * 2 - GAP * (columns - 1)) / columns;

  const data = useMemo(() => examplesIn(category), [category]);

  return (
    <FlatList
      key={columns}
      style={styles.list}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
      ]}
      columnWrapperStyle={styles.row}
      numColumns={columns}
      data={data}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>ThorVG for React Native</Text>
          <Text style={styles.subtitle}>
            {examples.length} examples
            {version ? ` · ThorVG ${version}` : ''}
          </Text>
          <View style={styles.chips}>
            {categories.map((item) => (
              <Pressable
                key={item.key}
                onPress={() => onCategoryChange(item.key)}
                style={[
                  styles.chip,
                  category === item.key && styles.chipActive,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    category === item.key && styles.chipTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => onSelect(item)}
          style={({ pressed }) => [
            styles.card,
            { width: cardWidth },
            pressed && styles.cardPressed,
          ]}
        >
          <View style={styles.thumbnail}>
            <Image
              source={
                typeof item.thumbnail === 'string'
                  ? { uri: ASSETS + item.thumbnail }
                  : item.thumbnail
              }
              style={styles.thumbnailImage}
              resizeMode="cover"
            />
          </View>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.title}
          </Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: PADDING,
    gap: GAP,
  },
  row: {
    gap: GAP,
  },
  header: {
    gap: 6,
    marginBottom: 4,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#000000',
  },
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardPressed: {
    opacity: 0.7,
  },
  thumbnail: {
    aspectRatio: 1,
    backgroundColor: colors.canvas,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  cardTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    padding: 10,
  },
});
