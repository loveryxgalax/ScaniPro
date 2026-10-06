import ExpoModulesCore
import UIKit
import Vision

// On-device text recognition backed by Apple's Vision framework.
// Nothing leaves the device: no network, no telemetry, no model downloads.
public class VisionOcrModule: Module {
  public func definition() -> ModuleDefinition {
    Name("VisionOcr")

    Function("isAvailable") { () -> Bool in
      return true
    }

    // Returns lines with bounding boxes normalised to 0...1 using a
    // top-left origin, relative to the upright (EXIF-corrected) image.
    AsyncFunction("recognizeAsync") { (uri: String) throws -> [String: Any] in
      return try VisionOcrModule.recognize(uri: uri)
    }
  }

  static func recognize(uri: String) throws -> [String: Any] {
    let path: String
    if let url = URL(string: uri), url.isFileURL {
      path = url.path
    } else {
      path = uri
    }
    guard let image = UIImage(contentsOfFile: path), let cgImage = image.cgImage else {
      throw UnreadableImageException(path)
    }

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    if #available(iOS 16.0, *) {
      request.automaticallyDetectsLanguage = true
    }

    let handler = VNImageRequestHandler(
      cgImage: cgImage,
      orientation: CGImagePropertyOrientation(image.imageOrientation),
      options: [:]
    )
    try handler.perform([request])

    let observations = request.results ?? []
    var lines: [[String: Any]] = []
    for observation in observations {
      guard let candidate = observation.topCandidates(1).first else { continue }
      let box = observation.boundingBox
      lines.append([
        "text": candidate.string,
        "confidence": Double(candidate.confidence),
        "x": Double(box.minX),
        "y": Double(1.0 - box.maxY),
        "width": Double(box.width),
        "height": Double(box.height),
      ])
    }

    return [
      "width": Double(image.size.width * image.scale),
      "height": Double(image.size.height * image.scale),
      "text": lines.compactMap { $0["text"] as? String }.joined(separator: "\n"),
      "lines": lines,
    ]
  }
}

final class UnreadableImageException: GenericException<String> {
  override var reason: String {
    "Could not read image at '\(param)'"
  }
}

extension CGImagePropertyOrientation {
  init(_ orientation: UIImage.Orientation) {
    switch orientation {
    case .up: self = .up
    case .upMirrored: self = .upMirrored
    case .down: self = .down
    case .downMirrored: self = .downMirrored
    case .left: self = .left
    case .leftMirrored: self = .leftMirrored
    case .right: self = .right
    case .rightMirrored: self = .rightMirrored
    @unknown default: self = .up
    }
  }
}
