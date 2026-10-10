import DocumentScanner, { ResponseType, ScanDocumentResponseStatus } from 'react-native-document-scanner-plugin';

/**
 * Opens the system document camera (VisionKit on iOS). Returns local file
 * URIs of the cropped page images, or null if the user cancelled.
 */
export async function scanPages(quality: 'high' | 'standard' = 'high'): Promise<string[] | null> {
  const r = await DocumentScanner.scanDocument({
    croppedImageQuality: quality === 'high' ? 95 : 80,
    responseType: ResponseType.ImageFilePath,
  });
  if (r.status === ScanDocumentResponseStatus.Cancel || !r.scannedImages?.length) return null;
  return r.scannedImages.map((p) => (p.startsWith('file://') ? p : `file://${p}`));
}
