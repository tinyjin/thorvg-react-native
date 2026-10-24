import type { ReactNode } from 'react';
import Link from '@docusaurus/Link';
import CodeBlock from '@theme/CodeBlock';
import Heading from '@theme/Heading';
import Layout from '@theme/Layout';
import styles from './index.module.css';

const snippet = `import { Canvas, Circle, LottieAnimation, Rect } from 'thorvg-react-native';

const Example = () => (
  <Canvas width={300} height={300}>
    <Rect x={20} y={20} width={260} height={260} rx={24} ry={24} fill="#2563eb" />
    <Circle cx={150} cy={150} rx={80} fill="#facc15" />
    <LottieAnimation
      data={lottieJson}
      size={{ width: 160, height: 160 }}
      translate={{ x: 70, y: 70 }}
      playing
      loop
    />
  </Canvas>
);`;

const features: { title: string; body: ReactNode }[] = [
  {
    title: 'Declarative API',
    body: (
      <>
        Draw with components such as <code>Rect</code>, <code>Scene</code>, <code>Text</code> and{' '}
        <code>LottieAnimation</code>. No setup, props update the drawing, and refs reach the
        underlying objects.
      </>
    ),
  },
  {
    title: 'WebCanvas API',
    body: (
      <>
        The <Link href="https://www.npmjs.com/package/@thorvg/webcanvas">@thorvg/webcanvas</Link> API
        runs on Android, iOS and web. Web uses WebCanvas itself, native runs the same classes on
        ThorVG through JSI.
      </>
    ),
  },
  {
    title: 'Vector, Lottie, SVG and text',
    body: 'Shapes, gradients, masks, scene effects, Lottie animations with slots and markers, SVG, PNG, JPG and WebP pictures, and TrueType or OpenType text.',
  },
];

export default function Home() {
  return (
    <Layout description="ThorVG vector graphics and Lottie for React Native">
      <header className={styles.hero}>
        <div className="container">
          <Heading as="h1" className={styles.title}>
            ThorVG for React Native
          </Heading>
          <p className={styles.tagline}>
            High-performance vector graphics rendering and Lottie on Android,
            iOS and web.
          </p>
          <div className={styles.buttons}>
            <Link className="button button--primary button--lg" to="/docs/getting-started">
              Get started
            </Link>
            <Link className="button button--secondary button--lg" to="/docs/examples">
              Examples
            </Link>
          </div>
          <div className={styles.snippet}>
            <CodeBlock language="tsx">{snippet}</CodeBlock>
          </div>
        </div>
      </header>
      <main className="container">
        <div className={styles.features}>
          {features.map((feature) => (
            <div key={feature.title} className={styles.feature}>
              <Heading as="h3">{feature.title}</Heading>
              <p>{feature.body}</p>
            </div>
          ))}
        </div>
      </main>
    </Layout>
  );
}
