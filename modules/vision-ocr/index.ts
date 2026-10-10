// Re-export the native module. On web, it will be resolved to VisionOcrModule.web.ts
// and on native platforms to VisionOcrModule.ts
export { default } from './src/VisionOcrModule';
export * from './src/VisionOcr.types';
