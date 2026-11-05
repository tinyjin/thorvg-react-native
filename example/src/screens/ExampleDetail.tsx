import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Example } from '../examples';
import { CodeView } from '../components/CodeView';
import sources from '../sources.json';
import { setErrorSink } from '../errorSink';
import { colors } from '../theme';

const PADDING = 16;
const MAX_ERRORS = 20;

export function ExampleDetail({
  example,
  onBack,
  prev,
  next,
  onSelect,
}: {
  example: Example;
  onBack: () => void;
  prev: Example | null;
  next: Example | null;
  onSelect: (example: Example) => void;
}) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const stageWidth = Math.min(windowWidth - PADDING * 2, 600);
  const [errors, setErrors] = useState<string[]>([]);
  const [showCode, setShowCode] = useState(false);
  const { Component } = example;

  useEffect(() => {
    setErrors([]);
    setErrorSink((error) =>
      setErrors((list) => [...list.slice(-(MAX_ERRORS - 1)), error.message])
    );
    return () => setErrorSink(null);
  }, [example]);

  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={styles.back}>‹ Examples</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {example.title}
        </Text>
        <View style={styles.nav}>
          <Pressable
            onPress={() => prev && onSelect(prev)}
            disabled={!prev}
            hitSlop={8}
          >
            <Text style={[styles.navText, !prev && styles.navDisabled]}>
              ‹ Prev
            </Text>
          </Pressable>
          <Text style={styles.navSeparator}>|</Text>
          <Pressable
            onPress={() => next && onSelect(next)}
            disabled={!next}
            hitSlop={8}
          >
            <Text style={[styles.navText, !next && styles.navDisabled]}>
              Next ›
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.stage, { width: stageWidth }]}>
          <Component key={example.id} />
        </View>

        <Text style={styles.description}>{example.description}</Text>

        {errors.length > 0 ? (
          <View style={styles.errors}>
            {errors.map((message, index) => (
              <Text key={index} style={styles.errorText}>
                {message}
              </Text>
            ))}
          </View>
        ) : null}

        <Pressable
          onPress={() => setShowCode((value) => !value)}
          style={styles.codeToggle}
        >
          <Text style={styles.codeToggleText}>
            {showCode ? 'Hide code' : 'Show code'}
          </Text>
        </Pressable>

        {showCode ? (
          <CodeView
            code={(sources as Record<string, string>)[example.id] ?? ''}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: PADDING,
    paddingVertical: 12,
  },
  back: {
    color: colors.accent,
    fontSize: 16,
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  navText: {
    color: colors.accent,
    fontSize: 16,
  },
  navDisabled: {
    color: colors.border,
  },
  navSeparator: {
    color: colors.border,
    fontSize: 16,
  },
  content: {
    padding: PADDING,
    paddingTop: 0,
    gap: 12,
  },
  stage: {
    alignSelf: 'center',
    backgroundColor: colors.canvas,
    borderRadius: 8,
    overflow: 'hidden',
  },
  description: {
    color: colors.text,
    fontSize: 15,
  },
  errors: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  errorText: {
    color: colors.error,
    fontSize: 12,
  },
  codeToggle: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  codeToggleText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '600',
  },
});
