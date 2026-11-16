import type { FontProvider, LoadFontOptions } from '@thorvg/webcanvas';
import { checkResult } from '../errors';
import { getJSI } from '../jsi';

export class Font {
  private static _provider: FontProvider | null = null;
  private static readonly _loaded = new Set<string>();

  public static provider(provider: FontProvider): void {
    Font._provider = provider;
  }

  public static load(
    name: string,
    data: Uint8Array,
    options?: LoadFontOptions
  ): void;
  public static load(
    name: string,
    options?: Record<string, unknown>
  ): Promise<void>;
  public static load(
    name: string,
    dataOrOptions?: Uint8Array | Record<string, unknown>,
    loadOptions?: LoadFontOptions
  ): void | Promise<void> {
    if (dataOrOptions instanceof Uint8Array) {
      Font._loadData(name, dataOrOptions, loadOptions);
      return;
    }

    if (Font._loaded.has(name)) {
      return Promise.resolve();
    }

    const provider = Font._provider;
    if (!provider) {
      return Promise.reject(
        new Error(
          `Font.load("${name}"): no font provider is set. Call Font.provider() or pass the font data.`
        )
      );
    }

    Font._loaded.add(name);
    return provider
      .fetch(name, dataOrOptions)
      .then((result) => {
        Font._loadData(name, result.data, { type: result.type });
      })
      .catch((err) => {
        Font._loaded.delete(name);
        throw err;
      });
  }

  public static unload(name: string): void {
    Font._loaded.delete(name);
    checkResult(
      getJSI().tvg_font_load_data(name, null, null),
      `Font.unload("${name}")`
    );
  }

  private static _loadData(
    name: string,
    data: Uint8Array,
    options: LoadFontOptions = {}
  ): void {
    const { type = 'ttf' } = options;
    checkResult(
      getJSI().tvg_font_load_data(name, data, type),
      `Font.load("${name}")`
    );
  }
}
