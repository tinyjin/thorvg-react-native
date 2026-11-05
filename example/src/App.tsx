import './examples/assets';
import { useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useThorVG } from 'thorvg-react-native';
import { examples, type Example } from './examples';
import { ExampleDetail } from './screens/ExampleDetail';
import { ExampleList, examplesIn } from './screens/ExampleList';
import { reportError } from './errorSink';
import { colors, type CategoryKey } from './theme';

function exampleFromUrl(url: string | null | undefined): Example | null {
  const id = url?.match(/example[/=]([a-z0-9-]+)/)?.[1];
  return examples.find((example) => example.id === id) ?? null;
}

function embeddedExample(): Example | null {
  if (Platform.OS !== 'web') return null;
  const search = (globalThis as { location?: { search: string } }).location
    ?.search;
  const id = new URLSearchParams(search).get('embed');
  return examples.find((example) => example.id === id) ?? null;
}

interface WebGlobal {
  parent: { postMessage(message: unknown, origin: string): void };
  document: { documentElement: { scrollHeight: number }; body: unknown };
  ResizeObserver: new (callback: () => void) => {
    observe(target: unknown): void;
    disconnect(): void;
  };
}

function Embed({ example }: { example: Example }) {
  useEffect(() => {
    const web = globalThis as unknown as WebGlobal;
    const post = () =>
      web.parent.postMessage(
        {
          type: 'thorvg-embed',
          height: web.document.documentElement.scrollHeight,
        },
        '*'
      );
    const observer = new web.ResizeObserver(post);
    observer.observe(web.document.body);
    post();
    return () => observer.disconnect();
  }, []);

  const open = () =>
    (globalThis as unknown as WebGlobal).parent.postMessage(
      { type: 'thorvg-open', id: example.id },
      '*'
    );

  const { Component } = example;
  return (
    <Pressable style={styles.embed} onPress={open}>
      <Component />
    </Pressable>
  );
}

function Root() {
  const TVG = useThorVG({ onError: reportError });
  const [selected, setSelected] = useState<Example | null>(null);
  const [embedded] = useState(embeddedExample);
  const [category, setCategory] = useState<CategoryKey>('all');

  // Deep-linked examples outside the category fall back to the full list
  const siblings = useMemo(() => {
    const inCategory = examplesIn(category);
    return selected && !inCategory.includes(selected) ? examples : inCategory;
  }, [category, selected]);
  const index = selected ? siblings.indexOf(selected) : -1;
  const prev = index > 0 ? siblings[index - 1] : null;
  const next =
    index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null;

  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      const example = exampleFromUrl(url);
      if (example) setSelected(example);
    });
    const subscription = Linking.addEventListener('url', ({ url }) => {
      const example = exampleFromUrl(url);
      if (example) setSelected(example);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!selected || Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        setSelected(null);
        return true;
      }
    );
    return () => subscription.remove();
  }, [selected]);

  if (!TVG) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Loading ThorVG…</Text>
      </View>
    );
  }

  if (embedded) return <Embed example={embedded} />;

  // Keep the list mounted so its scroll position survives
  return (
    <View style={styles.root}>
      <ExampleList
        version={TVG.version}
        category={category}
        onCategoryChange={setCategory}
        onSelect={setSelected}
      />
      {selected ? (
        <View style={styles.overlay}>
          <ExampleDetail
            key={selected.id}
            example={selected}
            onBack={() => setSelected(null)}
            prev={prev}
            next={next}
            onSelect={setSelected}
          />
        </View>
      ) : null}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider style={styles.root}>
      <Root />
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  embed: {
    width: '100%',
  },
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.background,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    color: colors.textMuted,
  },
});
