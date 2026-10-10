import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { jpegSize } from '../core/jpeg';

export function isJpeg(bytes: Uint8Array) {
  return bytes[0] === 0xff && bytes[1] === 0xd8;
}

/** Longest edge for imported page images: A4 at 300 dpi. Keeps memory, OCR and PDFs sane. */
export const MAX_PAGE_EDGE = 3508;

/**
 * Re-encodes any image (HEIC, PNG, oversized or rotated JPEG) as an upright
 * JPEG no larger than MAX_PAGE_EDGE, in the cache directory. The original
 * file is kept separately as a hashed source by the caller.
 */
export async function normaliseToJpeg(uri: string): Promise<string> {
  const probe = await ImageManipulator.manipulate(uri).renderAsync();
  const { width, height } = probe;
  probe.release();
  const longest = Math.max(width, height);
  let ctx = ImageManipulator.manipulate(uri);
  if (longest > MAX_PAGE_EDGE) {
    ctx = width >= height ? ctx.resize({ width: MAX_PAGE_EDGE }) : ctx.resize({ height: MAX_PAGE_EDGE });
  }
  const image = await ctx.renderAsync();
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.92 });
  image.release();
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
