import { TurboModuleRegistry, type TurboModule } from 'react-native';

export interface Spec extends TurboModule {
  install(): boolean;
  readAsset(uri: string): Promise<string>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('ThorVG');
