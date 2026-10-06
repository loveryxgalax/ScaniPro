/** A recognised line of text. Coordinates are normalised 0..1 with a top-left origin. */
export type OcrLine = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence?: number;
};

export type Sha256Fn = (bytes: Uint8Array) => Promise<string>;

/** Environment recorded with every custody entry. */
export type DeviceContext = {
  deviceModel: string;
  osName: string;
  osVersion: string;
  appVersion: string;
  appBuild: string;
};

export type CustodyAction =
  | 'captured'
  | 'ocr_completed'
  | 'ocr_failed'
  | 'pdf_generated'
  | 'renamed'
  | 'annotated'
  | 'signed'
  | 'exported'
  | 'shared'
  | 'verified'
  | 'verification_failed'
  | 'deleted';

/** Point in normalised page space (0..1, top-left origin). */
export type NormPoint = [number, number];

export type InkAnnotation = {
  kind: 'ink' | 'signature';
  pageIndex: number;
  color: string;
  /** Stroke width as a fraction of page width. */
  width: number;
  points: NormPoint[];
};

export type TextAnnotation = {
  kind: 'text';
  pageIndex: number;
  color: string;
  /** Font size as a fraction of page width. */
  size: number;
  x: number;
  y: number;
  text: string;
};

export type Annotation = InkAnnotation | TextAnnotation;
