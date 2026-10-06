import { Platform } from 'react-native';

import VisionOcr from '../../../modules/vision-ocr';
import type { OcrLine } from '../core/types';

export type OcrPageResult = { text: string; lines: OcrLine[]; engine: string };

/**
 * On-device OCR. iOS uses Apple Vision (no network, no telemetry);
 * Android uses Google ML Kit's bundled on-device model.
 */
export async function recognizePage(uri: string, width: number, height: number): Promise<OcrPageResult> {
  if (Platform.OS === 'ios') {
    if (!VisionOcr) throw new Error('Text recognition is unavailable in this build.');
    const r = await VisionOcr.recognizeAsync(uri);
    return {
      text: r.text,
      engine: 'Apple Vision (on-device)',
      lines: r.lines.map((l) => ({
        text: l.text,
        x: l.x,
        y: l.y,
        width: l.width,
        height: l.height,
        confidence: l.confidence,
      })),
    };
  }

  const { default: TextRecognition } = await import('@react-native-ml-kit/text-recognition');
  const r = await TextRecognition.recognize(uri);
  const lines: OcrLine[] = [];
  for (const block of r.blocks) {
    for (const line of block.lines) {
      if (!line.frame) continue;
      lines.push({
        text: line.text,
        x: line.frame.left / width,
        y: line.frame.top / height,
        width: line.frame.width / width,
        height: line.frame.height / height,
      });
    }
  }
  return { text: r.text, lines, engine: 'ML Kit (on-device)' };
}
