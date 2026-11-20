import type { GlyphMetrics, TextMetrics } from '@thorvg/webcanvas';
import { Paint } from './Paint';
import { Fill } from './Fill';
import { checkResult } from '../errors';
import { getJSI, type Handle } from '../jsi';
import type { TextWrapMode } from '../generated/constants';

export class Text extends Paint {
  constructor(handle?: Handle) {
    super(handle ?? getJSI().tvg_text_new());
  }

  protected _createInstance(handle: Handle): Text {
    return new Text(handle);
  }

  public font(name: string): this {
    checkResult(getJSI().tvg_text_set_font(this.handle, name), 'font');
    return this;
  }

  public text(content: string): this {
    checkResult(getJSI().tvg_text_set_text(this.handle, content), 'text');
    return this;
  }

  public fontSize(size: number): this {
    checkResult(getJSI().tvg_text_set_size(this.handle, size), 'fontSize');
    return this;
  }

  public fill(gradient: Fill): this;
  public fill(r: number, g: number, b: number): this;
  public fill(gradientOrR: Fill | number, g?: number, b?: number): this {
    const jsi = getJSI();
    if (gradientOrR instanceof Fill) {
      gradientOrR._applyStops();
      checkResult(
        jsi.tvg_text_set_gradient(this.handle, gradientOrR.handle),
        'fill (gradient)'
      );
      gradientOrR._markFilled();
    } else if (
      typeof gradientOrR === 'number' &&
      g !== undefined &&
      b !== undefined
    ) {
      checkResult(
        jsi.tvg_text_set_color(this.handle, gradientOrR, g, b),
        'fill (color)'
      );
    } else {
      throw new TypeError('Invalid fill arguments');
    }
    return this;
  }

  public align(x: number, y: number): this {
    checkResult(getJSI().tvg_text_align(this.handle, x, y), 'align');
    return this;
  }

  public layout(width: number, height: number = 0): this {
    checkResult(getJSI().tvg_text_layout(this.handle, width, height), 'layout');
    return this;
  }

  public wrap(mode: TextWrapMode): this {
    checkResult(getJSI().tvg_text_wrap_mode(this.handle, mode), 'wrap');
    return this;
  }

  public lines(): number {
    return getJSI().tvg_text_line_count(this.handle);
  }

  public metrics(): TextMetrics;
  public metrics(char: string): GlyphMetrics;
  public metrics(char?: string): TextMetrics | GlyphMetrics {
    const jsi = getJSI();

    if (char === undefined) {
      const { result, metrics: m } = jsi.tvg_text_get_text_metrics(this.handle);
      checkResult(result, 'metrics');
      return {
        ascent: m[0]!,
        descent: m[1]!,
        linegap: m[2]!,
        advance: m[3]!,
      };
    }

    const { result, metrics: m } = jsi.tvg_text_get_glyph_metrics(
      this.handle,
      char
    );
    checkResult(result, 'metrics');
    return {
      advance: m[0]!,
      bearing: m[1]!,
      min: { x: m[2]!, y: m[3]! },
      max: { x: m[4]!, y: m[5]! },
    };
  }

  public spacing(letter: number, line: number): this {
    checkResult(
      getJSI().tvg_text_spacing(this.handle, letter, line),
      'spacing'
    );
    return this;
  }

  public italic(shear: number = 0.18): this {
    checkResult(getJSI().tvg_text_set_italic(this.handle, shear), 'italic');
    return this;
  }

  public outline(width: number, r: number, g: number, b: number): this {
    checkResult(
      getJSI().tvg_text_set_outline(this.handle, width, r, g, b),
      'outline'
    );
    return this;
  }
}

Paint.registerType(4, (handle) => new Text(handle));
