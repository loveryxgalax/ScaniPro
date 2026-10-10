import { CryptoDigestAlgorithm, digest } from 'expo-crypto';

import { bytesToHex } from '../core/text';
import type { Sha256Fn } from '../core/types';

export const sha256: Sha256Fn = async (bytes) => {
  const buf = await digest(CryptoDigestAlgorithm.SHA256, bytes as unknown as BufferSource);
  return bytesToHex(new Uint8Array(buf));
};
