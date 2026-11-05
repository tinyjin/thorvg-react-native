import NativeThorVG from '../specs/NativeThorVG';

const LOCAL_SCHEME = /^(file|asset|content):/i;
// Android release resolves require()d assets to a bare resource name
const RESOURCE_NAME = /^[a-z0-9_]+$/;

export function readLocalAsset(uri: string): Promise<string> | null {
  return LOCAL_SCHEME.test(uri) || RESOURCE_NAME.test(uri)
    ? NativeThorVG.readAsset(uri)
    : null;
}
