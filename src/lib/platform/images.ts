import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { jpegSize } from '../core/jpeg';

export function isJpeg(bytes: Uint8Array) {
  return bytes[0] === 0xff && bytes[1] === 0xd8;
}

/** Re-encodes any image (HEIC, PNG…) as a JPEG in the cache directory. */
export async function convertToJpeg(uri: string): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  const image = await ctx.renderAsync();
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.95 });
  return result.uri;
}

/** Splits a two-page book spread into left and right page images. */
export async function splitSpread(uri: string, bytes: Uint8Array): Promise<[string, string]> {
  const { width, height } = jpegSize(bytes);
  const half = Math.floor(width / 2);
  const crop = async (originX: number, w: number) => {
    const ctx = ImageManipulator.manipulate(uri).crop({ originX, originY: 0, width: w, height });
    const image = await ctx.renderAsync();
    return (await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.95 })).uri;
  };
  return [await crop(0, half), await crop(half, width - half)];
}
