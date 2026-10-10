// iOS OCR uses Apple Vision through the local `modules/vision-ocr` module.
// Google ML Kit is linked on Android only: on iOS it sends usage telemetry to
// Google, which would contradict the "Data Not Collected" privacy label.
module.exports = {
  dependencies: {
    '@react-native-ml-kit/text-recognition': {
      platforms: {
        ios: null,
      },
    },
  },
};
