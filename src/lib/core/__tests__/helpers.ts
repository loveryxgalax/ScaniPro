import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { DeviceContext, Sha256Fn } from '../types';

export const sha256: Sha256Fn = async (bytes) => createHash('sha256').update(bytes).digest('hex');

export const fixtureJpeg = () => new Uint8Array(readFileSync(join(__dirname, 'fixtures', 'page.jpg')));

export const device: DeviceContext = {
  deviceModel: 'iPhone 16 Pro',
  osName: 'iOS',
  osVersion: '26.0',
  appVersion: '1.0.0',
  appBuild: '1',
};
