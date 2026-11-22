import * as WebCanvas from '@thorvg/webcanvas';
import { createCanvas } from './web/Canvas';
import { WEBCANVAS_VERSION } from './native/generated/constants';
import type { InitOptions, ThorVG } from './types';

export { ThorVGError, ThorVGResultCode } from '@thorvg/webcanvas';

const THREAD_MODULE = 'webcanvas.esm.js';

// eslint-disable-next-line no-new-func
const importModule = new Function('url', 'return import(url)') as (
  url: string
) => Promise<typeof WebCanvas>;

// Route to the default build and thread build
function loadWebCanvas(options: InitOptions): Promise<typeof WebCanvas> {
  if (!options.threads) return Promise.resolve(WebCanvas);
  if (!(globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated) {
    if (__DEV__) {
      console.warn(
        'ThorVG: `threads` needs a cross-origin isolated page (COOP/COEP headers), falling back to no worker threads.'
      );
    }
    return Promise.resolve(WebCanvas);
  }
  const url =
    options.locateFile?.(THREAD_MODULE) ??
    `https://unpkg.com/@thorvg/webcanvas@${WEBCANVAS_VERSION}/dist/thread/${THREAD_MODULE}`;
  return importModule(url);
}

export async function createNamespace(
  options: InitOptions,
  onTerm: () => void
): Promise<ThorVG> {
  const module = await loadWebCanvas(options);
  const { renderer, ...rest } = options;
  const namespace = await module.init({
    ...rest,
    renderer: renderer === 'mtl' || renderer === 'vk' ? undefined : renderer,
  });
  return {
    ...namespace,
    Canvas: createCanvas(module.Canvas),
    term: () => {
      namespace.term();
      onTerm();
    },
  };
}
