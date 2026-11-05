import { Image } from 'react-native';
import { readLocalAsset } from './asset';

export interface UriSource {
  uri: string;
  headers?: Record<string, string>;
}

export type LottieSource = number | UriSource | string | object;

export type SvgSource = number | UriSource | string;

const cache = new Map<string, Promise<string>>();

function loadText(source: UriSource): Promise<string> {
  const key = source.headers
    ? `${source.uri}\n${JSON.stringify(source.headers)}`
    : source.uri;
  let request = cache.get(key);
  if (!request) {
    const fetchText = () =>
      fetch(source.uri, { headers: source.headers }).then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${source.uri}`);
        return res.text();
      });
    const local = readLocalAsset(source.uri);
    request = local ? local.catch(fetchText) : fetchText();
    request.catch(() => cache.delete(key));
    cache.set(key, request);
  }
  return request;
}

export function loadSource(source: LottieSource | SvgSource): Promise<string> {
  if (typeof source === 'number') {
    const asset = Image.resolveAssetSource(source);
    if (!asset?.uri) {
      return Promise.reject(new Error('ThorVG: unresolved asset source'));
    }
    return loadText({ uri: asset.uri });
  }
  if (typeof source === 'string') return Promise.resolve(source);
  if ('uri' in source && typeof source.uri === 'string') {
    return loadText(source as UriSource);
  }
  return Promise.resolve(JSON.stringify(source));
}

export function sourceKey(source: LottieSource | SvgSource): unknown {
  if (source && typeof source === 'object' && 'uri' in source) {
    const uri = source as UriSource;
    return `${uri.uri}\n${JSON.stringify(uri.headers ?? null)}`;
  }
  return source;
}
