export type VisionOcrLine = {
  text: string;
  confidence: number;
  /** Normalised 0..1, top-left origin. */
  x: number;
  y: number;
  width: number;
  height: number;
};

export type VisionOcrResult = {
  width: number;
  height: number;
  text: string;
  lines: VisionOcrLine[];
};
