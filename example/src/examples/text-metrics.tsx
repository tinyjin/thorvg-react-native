// Native example: TextMetrics.cpp

import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import type { TextInputInstance, TextInputKeyPressEvent } from 'react-native';
import { Canvas, useThorVG } from 'thorvg-react-native';

const MAX_LINE = 16;

const Example = () => {
  const TVG = useThorVG();
  const canvasRef = useRef<Canvas>(null);
  const inputRef = useRef<TextInputInstance>(null);
  const keyPress = useRef<((key: string) => void) | null>(null);

  useEffect(() => {
    if (!TVG) return;
    const canvas = new TVG.Canvas(canvasRef, { width: 600, height: 600 });
    let active = true;
    let rafId = 0;

    let data = 'Type here: ';
    let pos = { x: 0, y: 0 }; //cursor position
    let lastElapsed = 0;
    const endPos: number[] = []; //each line end position
    let curLine = 1; //default line number
    let toggle = true; //blinking toggle
    let updated = false;

    (async () => {
      const fontData = await fetch('/fonts/NotoSansKR.ttf')
        .then((res) => res.arrayBuffer())
        .then((buffer) => new Uint8Array(buffer));
      if (!active) return;
      TVG.Font.load('NotoSansKR', fontData, { type: 'ttf' });

      // guide line
      const border = 112.5;
      const lines = new TVG.Shape();
      lines.moveTo(border, border);
      lines.lineTo(600 - border, border);
      lines.lineTo(600 - border, 600 - border);
      lines.lineTo(border, 600 - border);
      lines.close();
      lines.stroke({
        width: 0.75,
        color: [100, 100, 100, 255],
        dash: [7.5, 7.5],
      });
      canvas.add(lines);

      // text group
      const group = new TVG.Scene();
      group.translate(border, border);
      canvas.add(group);

      // text body
      const text = new TVG.Text();
      text.font('NotoSansKR');
      text.fontSize(12);
      text.align(0, 0);
      text.layout(600 - border * 2, 600 - border * 2);
      text.wrap(TVG.TextWrapMode.Character);
      text.text(data);
      text.fill(255, 255, 255);
      group.add(text);

      // text cursor

      // figure out the cursor x position
      for (const ch of data) {
        pos.x += text.metrics(ch).advance;
      }

      // figure out the cursor y position
      const textMetric = text.metrics();
      pos.y = textMetric.ascent;

      // cursor visual
      const cursor = new TVG.Shape();
      cursor.appendRect(0, 0, 7.5, 1.5);
      cursor.fill(255, 255, 255);
      cursor.translate(pos.x, pos.y);
      group.add(cursor);

      canvas.render();

      // This example demonstrates very basic text typing. Tap the canvas to type.
      keyPress.current = (input: string) => {
        let glyphAdvance = 0;
        const p = { x: pos.x, y: pos.y };

        // backspace
        if (input === 'Backspace') {
          if (data.length === 0) return;
          const chars = Array.from(data);
          const last = chars.pop()!;
          glyphAdvance = text.metrics(last).advance;
          data = chars.join(''); // revert the character
          p.x -= glyphAdvance; // cursor x position
          // feed line
        } else if (input === 'Enter') {
          data += '\n';
          endPos[curLine - 1] = p.x;
          // append a character
        } else if (Array.from(input).length === 1) {
          glyphAdvance = text.metrics(input).advance;
          data += input; // append the character
          p.x += glyphAdvance; // cursor x position
        } else {
          return;
        }

        text.text(data);

        // get the line count
        const newLine = text.lines();

        // limit the line number, revert the condition
        if (newLine > MAX_LINE) {
          data = Array.from(data).slice(0, -1).join('');
          text.text(data);
          return;
        }

        // line has been changed
        if (curLine !== newLine) {
          // retreat
          if (curLine > newLine) {
            p.x = endPos[newLine - 1]!;
            // advance
          } else {
            endPos[curLine - 1] = pos.x;
            p.x = glyphAdvance;
          }
          curLine = newLine;
        }

        // cursor y position
        p.y = textMetric.ascent;
        if (newLine > 1) p.y += (newLine - 1) * textMetric.advance;

        cursor.translate(p.x, p.y);

        pos = p;
        updated = true;
      };

      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;

        //blinking cursor effect
        if (elapsed - lastElapsed > 500) {
          toggle = !toggle;

          if (toggle) cursor.opacity(255);
          else cursor.opacity(0);

          lastElapsed = elapsed;
          updated = true;
        }

        if (updated) {
          updated = false;
          canvas.update();
          canvas.render();
        }

        if (active) rafId = requestAnimationFrame(animate);
      };

      animate();
    })();

    return () => {
      active = false;
      cancelAnimationFrame(rafId);
      keyPress.current = null;
      canvas.destroy();
    };
  }, [TVG]);

  const onKeyPress = (e: TextInputKeyPressEvent) =>
    keyPress.current?.(e.nativeEvent.key);

  if (!TVG) return null;
  return (
    <Pressable onPress={() => inputRef.current?.focus()}>
      <Canvas ref={canvasRef} />
      <TextInput
        ref={inputRef}
        value=""
        multiline
        autoCorrect={false}
        autoCapitalize="none"
        onKeyPress={onKeyPress}
        style={styles.input}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  input: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
});

export default Example;
