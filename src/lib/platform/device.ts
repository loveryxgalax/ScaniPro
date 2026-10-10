import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import type { DeviceContext } from '../core/types';

let cached: DeviceContext | null = null;

export function deviceContext(): DeviceContext {
  if (!cached) {
    cached = {
      deviceModel: Device.modelName ?? Device.modelId ?? 'Unknown device',
      osName: Device.osName ?? (Platform.OS === 'ios' ? 'iOS' : Platform.OS),
      osVersion: Device.osVersion ?? String(Platform.Version),
      appVersion: Application.nativeApplicationVersion ?? '0.0.0',
      appBuild: Application.nativeBuildVersion ?? '0',
    };
  }
  return cached;
}
