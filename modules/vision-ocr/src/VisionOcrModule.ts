import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { VisionOcrResult } from './VisionOcr.types';

declare class VisionOcrModule extends NativeModule<{}> {
  isAvailable(): boolean;
  recognizeAsync(uri: string): Promise<VisionOcrResult>;
}

// Optional so that Android (which uses ML Kit) and unit tests can import this file.
export default requireOptionalNativeModule<VisionOcrModule>('VisionOcr');
