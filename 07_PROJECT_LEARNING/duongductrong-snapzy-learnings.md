# Forensic Learning Record (Deep Inspection): duongductrong/Snapzy

> **Canonical Artifact**: `07_PROJECT_LEARNING/duongductrong-snapzy-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/duongductrong/Snapzy](https://github.com/duongductrong/Snapzy))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:14:22.650Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `duongductrong/Snapzy`
- **Description**: An open-source native macOS screenshot and screen recording app. A CleanShot X alternative.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3304 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Snapzy/App/MenuBarIconRenderer.swift`
```
//
//  MenuBarIconRenderer.swift
//  Snapzy
//
//  Renders 18pt template status bar images for each menu bar icon style and
//  manages the user-imported custom icon file.
//

import AppKit

@MainActor
final class MenuBarIconRenderer {
  static let shared = MenuBarIconRenderer()

  private let fileManager = FileManager.default
  private let appSupportFolderName = "Snapzy"
  private let customIconFolderName = "MenuBarIcon"
  private let customIconFileName = "custom.png"

  private init() {}

  // MARK: - Rendering

  /// 18pt template image for the given style. Falls back to the bundled
  /// default artwork when a custom icon is missing or undecodable.
  func statusImage(for style: MenuBarIconStyle) -> NSImage? {
    switch style {
    case .default:
      return makeBundledStatusImage()
    case .custom:
      if let custom = makeCustomStatusImage() {
        return custom
      }
      return makeBundledStatusImage()
    default:
      return makeSymbolStatusImage(symbolName: style.symbolName)
    }
  }

  /// Current bundled-artwork rendering (moved from AppStatusBarController).
  private func makeBundledStatusImage() -> NSImage? {
    guard let appIcon = NSImage(named: "MenubarIcon") else { return nil }

    let canvasSize = NSSize(width: 18, height: 18)
    let targetVisibleOccupancy: CGFloat = 0.89
    // Current MenubarIcon PNG alpha bounds occupy 75.28% of its transparent canvas.
    let sourceVisibleOccupancy: CGFloat = 0.7528
    let drawSize = NSSize(
      width: canvasSize.width * targetVisibleOccupancy / sourceVisibleOccupancy,
      height: canvasSize.height * targetVisibleOccupancy / sourceVisibleOccupancy
    )
    let drawRect = NSRect(
      x: (canvasSize.width - drawSize.width) / 2,
      y: (canvasSize.height - drawSize.height) / 2,
      width: drawSize.width,
      height: drawSize.height
    )

    let resizedIcon = NSImage(size: canvasSize)
    resizedIcon.lockFocus()
    appIcon.draw(
      in: drawRect,
      from: NSRect(origin: .zero, size: appIcon.size),
      operation: .copy,
      fraction: 1.0
    )
    resizedIcon.unlockFocus()
    // Template images let AppKit adapt the glyph color to the current menu bar material.
    resizedIcon.isTemplate = true
    return resizedIcon
  }

  private func makeSymbolStatusImage(symbolName: String?) -> NSImage? {
    guard let symbolName else { return nil }
    let config = NSImage.SymbolConfiguration(pointSize: 15, weight: .regular)
    let image = NSImage(systemSymbolName: symbolName, accessibilityDescription: nil)?
      .withSymbolConfiguration(config)
    image?.isTemplate = true
    return image
  }

  /// Renders the user-imported PNG with alpha-bounds normalization so its
  /// visible content matches the bundled icon's 89% canvas occupancy.
  private func makeCustomStatusImage() -> NSImage? {
    guard let url = customIconURL,
          fileManager.fileExists(atPath: url.path),
          let source = NSImage(contentsOf: url),
          let cgImage = source.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
      return nil
    }

    let canvasSize = NSSize(width: 18, height: 18)
    let targetVisibleOccupancy: CGFloat = 0.89
    let imageSize = NSSize(width: cgImage.width, height: cgImage.height)

    let drawSize: NSSize
    if let alphaBounds = Self.alphaBoundingBox(of: cgImage), !alphaBounds.isEmpty {
      // Scale so the larger visible dimension fills the target occupancy.
      let sourceOccupancy = max(
        alphaBounds.width / imageSize.width,
        alphaBounds.height / imageSize.height
      )
      guard sourceOccupancy > 0 else { return nil }
      let scale = targetVisibleOccupancy / sourceOccupancy
      drawSize = NSSize(width: imageSize.width * scale, height: imageSize.height * scale)
    } else {
      // Fully opaque (or undetectable bounds): fit the longest side to the target.
      let fit = min(
        canvasSize.width * targetVisibleOccupancy / imageSize.width,
        canvasSize.height * targetVisibleOccupancy / imageSize.height
      )
      drawSize = NSSize(width: imageSize.width * fit, height: imageSize.height * fit)
    }

    let drawRect = NSRect(
      x: (canvasSize.width - drawSize.width) / 2,
      y: (canvasSize.height - drawSize.height) / 2,
      width: drawSize.width,
      height: drawSize.height
    )

    let rendered = NSImage(size: canvasSize)
    rendered.lockFocus()
    source.draw(
      in: drawRect,
      from: NSRect(origin: .zero, size: source.size),
      operation: .copy,
      fraction: 1.0
    )
    rendered.unlockFocus()
    // Template rendering makes any imported PNG monochrome automatically.
    rendered.isTemplate = true
    return rendered
  }

  // MARK: - Custom Icon Storage

  /// URL of the stored custom icon: Application Support/Snapzy/MenuBarIcon/custom.png
  var customIconURL: URL? {
    guard
      let appSupportURL = fileManager.urls(
        for: .applicationSupportDirectory, in: .userDomainMask
      ).first
    else {
      return nil
    }

    return appSupportURL
      .appendingPathComponent(appSupportFolderName, isDirectory: true)
      .appendingPathComponent(customIconFolderName, isDirectory: true)
      .appendingPathComponent(customIconFileName, isDirectory: false)
  }

  var hasCustomIcon: Bool {
    guard let url = customIconURL else { return false }
    return fileManager.fileExists(atPath: url.path)
  }

  /// Modification date of the stored custom icon, used for cache invalidation.
  var customIconModificationDate: Date? {
    guard let url = customIconURL else { return nil }
    return try? fileManager.attributesOfItem(atPath: url.path)[.modificationDate] as? Date
  }

  /// Validates and copies a user-picked PNG into Application Support.
  @discardableResult
  func saveCustomIcon(from sourceURL: URL) -> Bool {
    guard let destinationURL = customIconURL else { return false }

    // Validate the pick decodes as an image before replacing the stored copy.
    guard let image = NSImage(contentsOf: sourceURL),
          image.cgImage(forProposedRect: nil, context: nil, hints: nil) != nil else {
      DiagnosticLogger.shared.log(
        .warning, .ui, "Custom menu bar icon rejected: undecodable image",
        context: ["path": sourceURL.path]
      )
      return false
    }

    do {
      let directory = destinationURL.deletingLastPathComponent()
      try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
      if fileManager.fileExists(atPath: destinationURL.path) {
        try fileManager.removeItem(at: destinationURL)
      }
      try fileManager.copyItem(at: sourceURL, to: destinationURL)
      DiagnosticLogger.shared.log(.info, .ui, "Custom menu bar icon imported")
      return true
    } catch {
      DiagnosticLogger.shared.log(
        .error, .ui, "Custom menu bar icon import failed",
        context: ["error": error.localizedDescription]
      )
      return false
    }
  }

  func removeCustomIcon() {
    guard let url = customIconURL, fileManager.fileExists(atPath: url.path) else { return }
    try? fileManager.removeItem(at: url)
  }

  // MARK: - Alpha Bounds

  /// Alpha bounding box of the image in pixel coordinates, detected on a
  /// downsampled bitmap. Returns nil when the image has no transparent pixels.
  static nonisolated func alphaBoundingBox(of cgImage: CGImage) -> CGRect? {
    let sampleSize = 128
    var bitmap = [UInt8](repeating: 0, count: sampleSize * sampleSize * 4)

    guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
          let context = CGContext(
            data: &bitmap,
            width: sampleSize,
            height: sampleSize,
            bitsPerComponent: 8,
            bytesPerRow: sampleSize * 4,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
          )
    else {
      return nil
    }

    context.draw(cgImage, in: CGRect(x: 0, y: 0, width: sampleSize, height: sampleSize))

    var minX = sampleSize
    var minY = sampleSize
    var maxX = -1
    var maxY = -1
    var foundTransparent = false

    for y in 0..<sampleSize {
      for x in 0..<sampleSize {
        let alpha = bitmap[(y * sampleSize + x) * 4 + 3]
        if alpha < 8 {
          foundTransparent = true
          continue
        }
        minX = min(minX, x)
        minY = min(minY, y)
        maxX = max(maxX, x)
        maxY = max(maxY, y)
      }
    }

    // No transparent pixels means the content fills the canvas; normalization
    // by alpha bounds would be meaningless.
    guard foundTransparent, maxX >= minX, maxY >= minY else { return nil }

    let scaleX = CGFloat(cgImage.width) / CGFloat(sampleSize)
    let scaleY = CGFloat(cgImage.height) / CGFloat(sampleSize)
    return CGRect(
      x: CGFloat(minX) * scaleX,
      y: CGFloat(minY) * scaleY,
      width: CGFloat(maxX - minX + 1) * scaleX,
      height: CGFloat(maxY - minY + 1) * scaleY
    )
  }
}

```

### Core Architecture Module: `Snapzy/Features/Annotate/Models/AnnotateMockupState.swift`
```
//
//  MockupState.swift
//  Snapzy
//
//  Central state management for 3D mockup rendering
//

import SwiftUI
import AppKit
import Combine

/// State snapshot for undo/redo
private struct MockupStateSnapshot: Equatable {
    let rotationX: Double
    let rotationY: Double
    let rotationZ: Double
    let perspective: Double
    let padding: CGFloat
    let shadowIntensity: Double
    let cornerRadius: Double
    let backgroundStyle: BackgroundStyle
}

/// Central state object for mockup renderer
@MainActor
final class MockupState: ObservableObject {
    // MARK: - Source Image
    @Published var sourceImage: NSImage?
    @Published var sourceURL: URL?

    // MARK: - 3D Transform Parameters
    // NOTE: each clamp guards its reassignment. `didSet` fires on every write —
    // even one that leaves the value unchanged — so an unconditional
    // `rotationX = clamp(...)` re-triggers `didSet` forever (stack overflow /
    // SIGSEGV). The `!=` guard makes the re-entrant pass a no-op, bounding
    // recursion at depth 2.
    @Published var rotationX: Double = 0 {
        didSet {
            let clamped = clamp(rotationX, min: -45, max: 45)
            if clamped != rotationX { rotationX = clamped }
        }
    }
    @Published var rotationY: Double = 0 {
        didSet {
            let clamped = clamp(rotationY, min: -45, max: 45)
            if clamped != rotationY { rotationY = clamped }
        }
    }
    @Published var rotationZ: Double = 0 {
        didSet {
            let clamped = clamp(rotationZ, min: -180, max: 180)
            if clamped != rotationZ { rotationZ = clamped }
        }
    }
    @Published var perspective: Double = 0.5 {
        didSet {
            let clamped = clamp(perspective, min: 0.1, max: 1.0)
            if clamped != perspective { perspective = clamped }
        }
    }

    // MARK: - Styling
    @Published var padding: CGFloat = 40
    @Published var shadowIntensity: Double = 0.3
    @Published var cornerRadius: Double = 12
    @Published var backgroundStyle: BackgroundStyle = .gradient(.bluePurple)

    // MARK: - Preset Selection
    @Published var selectedPresetId: UUID?

    // MARK: - UI State
    @Published var showSidebar: Bool = false
    @Published var zoomLevel: CGFloat = 1.0

    // MARK: - Undo/Redo
    private var undoStack: [MockupStateSnapshot] = []
    private var redoStack: [MockupStateSnapshot] = []
    private let maxUndoStackSize = 20

    var canUndo: Bool { !undoStack.isEmpty }
    var canRedo: Bool { !redoStack.isEmpty }

    // MARK: - Computed Properties

    /// Shadow X offset based on Y rotation
    var shadowOffsetX: CGFloat {
        CGFloat(rotationY) * 0.8
    }

    /// Shadow Y offset based on X rotation
    var shadowOffsetY: CGFloat {
        CGFloat(rotationX) * 0.5 + 8
    }

    /// Shadow radius scales with perspective
    var shadowRadius: CGFloat {
        CGFloat(20 * (1.1 - perspective) * shadowIntensity * 2)
    }

    // MARK: - Initialization

    init() {}

    init(sourceImage: NSImage) {
        self.sourceImage = sourceImage
    }

    // MARK: - Image Loading

    func loadImage(from url: URL) {
        guard let image = NSImage(contentsOf: url) else { return }
        saveState()
        self.sourceImage = image
        self.sourceURL = url
    }

    func setImage(_ image: NSImage) {
        saveState()
        self.sourceImage = image
        self.sourceURL = nil
    }

    // MARK: - Preset Application

    func applyPreset(_ preset: MockupPreset) {
        saveState()
        rotationX = preset.rotationX
        rotationY = preset.rotationY
        rotationZ = preset.rotationZ
        perspective = preset.perspective
        padding = preset.padding
        selectedPresetId = preset.id
    }

    func resetToDefaults() {
        saveState()
        rotationX = 0
        rotationY = 0
        rotationZ = 0
        perspective = 0.5
        padding = 40
        shadowIntensity = 0.3
        cornerRadius = 12
        backgroundStyle = .gradient(.bluePurple)
        selectedPresetId = nil
    }

    // MARK: - Undo/Redo

    func saveState() {
        let snapshot = MockupStateSnapshot(
            rotationX: rotationX,
            rotationY: rotationY,
            rotationZ: rotationZ,
            perspective: perspective,
            padding: padding,
            shadowIntensity: shadowIntensity,
            cornerRadius: cornerRadius,
            backgroundStyle: backgroundStyle
        )

        // Avoid duplicates
        if undoStack.last != snapshot {
            undoStack.append(snapshot)
            if undoStack.count > maxUndoStackSize {
                undoStack.removeFirst()
            }
            redoStack.removeAll()
        }
    }

    func undo() {
        guard let snapshot = undoStack.popLast() else { return }

        // Save current state to redo stack
        let currentSnapshot = MockupStateSnapshot(
            rotationX: rotationX,
            rotationY: rotationY,
            rotationZ: rotationZ,
            perspective: perspective,
            padding: padding,
            shadowIntensity: shadowIntensity,
            cornerRadius: cornerRadius,
            backgroundStyle: backgroundStyle
        )
        redoStack.append(currentSnapshot)

        // Restore snapshot
        applySnapshot(snapshot)
    }

    func redo() {
        guard let snapshot = redoStack.popLast() else { return }

        // Save current state to undo stack
        let currentSnapshot = MockupStateSnapshot(
            rotationX: rotationX,
            rotationY: rotationY,
            rotationZ: rotationZ,
            perspective: perspective,
            padding: padding,
            shadowIntensity: shadowIntensity,
            cornerRadius: cornerRadius,
            backgroundStyle: backgroundStyle
        )
        undoStack.append(currentSnapshot)

        // Restore snapshot
        applySnapshot(snapshot)
    }

    private func applySnapshot(_ snapshot: MockupStateSnapshot) {
        rotationX = snapshot.rotationX
        rotationY = snapshot.rotationY
        rotationZ = snapshot.rotationZ
        perspective = snapshot.perspective
        padding = snapshot.padding
        shadowIntensity = snapshot.shadowIntensity
        cornerRadius = snapshot.cornerRadius
        backgroundStyle = snapshot.backgroundStyle
    }

    // MARK: - Helpers

    private func clamp(_ value: Double, min: Double, max: Double) -> Double {
        Swift.min(Swift.max(value, min), max)
    }
}

```

### Core Architecture Module: `Snapzy/Features/Annotate/Models/AnnotateRenderSnapshot.swift`
```
//
//  AnnotateRenderSnapshot.swift
//  Snapzy
//
//  Immutable value-type snapshot of everything final-image rendering needs.
//

import AppKit

/// Frozen copy of every `AnnotateState` input used by `AnnotateExporter` rendering.
/// Built on the main actor (lazy caches pre-warmed, background images pre-resolved),
/// then consumed from any queue — rendering never touches live state.
///
/// Contract: the referenced `NSImage` instances are treated as immutable during render
/// (state replaces rather than mutates them post-load).
struct AnnotateRenderSnapshot {
  var sourceImage: NSImage
  var editorMode: AnnotateState.EditorMode
  var isCombineMode: Bool
  var effectiveContentBounds: CGRect
  var cropRect: CGRect?
  var annotations: [AnnotationItem]
  var embeddedImages: [UUID: NSImage]
  var embeddedCGImages: [UUID: CGImage]

  var backgroundStyle: BackgroundStyle
  var isBlurredBackgroundEffectActive: Bool
  var blurredBackgroundEffect: BlurredBackgroundEffect
  /// Wallpaper/blurred background for the active `backgroundStyle` URL, resolved on main
  /// (cache + sandbox access + blur are main-bound). Nil for `.none`/`.gradient`/preset URLs.
  var resolvedBackgroundImage: NSImage?

  var padding: CGFloat
  var cornerRadius: CGFloat
  var shadowIntensity: CGFloat
  var imageAlignment: ImageAlignment
  var aspectRatio: AspectRatioOption
  var aspectRatioOrientation: AspectRatioOrientation

  var mockupRotationX: CGFloat
  var mockupRotationY: CGFloat
  var mockupRotationZ: CGFloat
  var mockupPerspective: CGFloat
  var mockupShadowRadius: CGFloat
  var mockupShadowOffsetX: CGFloat
  var mockupShadowOffsetY: CGFloat
}

```

### Core Architecture Module: `Snapzy/Features/Annotate/Services/AnnotateAnnotationRenderer.swift`
```
//
//  AnnotateAnnotationRenderer.swift
//  Snapzy
//
//  Handles rendering annotations to CGContext
//

import AppKit
import CoreGraphics
import SwiftUI

/// Renders annotations to a CGContext
nonisolated struct AnnotationRenderer {
  private static let livePreviewFullQualityAreaThreshold: CGFloat = 120_000

  let context: CGContext
  var editingTextId: UUID?
  var sourceImage: NSImage?
  /// Pre-resolved `sourceImage` CGImage; avoids re-resolving per blur per frame.
  var sourceCGImage: CGImage?
  var blurCacheManager: BlurCacheManager?
  private var interactiveBlurAnnotationIds: Set<UUID>
  var interactiveEmbeddedImageAnnotationId: UUID?
  var embeddedImageProvider: ((UUID) -> NSImage?)?
  var embeddedCGImageProvider: ((UUID) -> CGImage?)?

  init(
    context: CGContext,
    editingTextId: UUID? = nil,
    sourceImage: NSImage? = nil,
    sourceCGImage: CGImage? = nil,
    blurCacheManager: BlurCacheManager? = nil,
    interactiveBlurAnnotationId: UUID? = nil,
    interactiveBlurAnnotationIds: Set<UUID> = [],
    interactiveEmbeddedImageAnnotationId: UUID? = nil,
    embeddedImageProvider: ((UUID) -> NSImage?)? = nil,
    embeddedCGImageProvider: ((UUID) -> CGImage?)? = nil
  ) {
    self.context = context
    self.editingTextId = editingTextId
    self.sourceImage = sourceImage
    self.sourceCGImage = sourceCGImage
    self.blurCacheManager = blurCacheManager
    var normalizedInteractiveBlurIds = interactiveBlurAnnotationIds
    if let interactiveBlurAnnotationId {
      normalizedInteractiveBlurIds.insert(interactiveBlurAnnotationId)
    }
    self.interactiveBlurAnnotationIds = normalizedInteractiveBlurIds
    self.interactiveEmbeddedImageAnnotationId = interactiveEmbeddedImageAnnotationId
    self.embeddedImageProvider = embeddedImageProvider
    self.embeddedCGImageProvider = embeddedCGImageProvider
  }

  func draw(_ annotation: AnnotationItem) {
    // Skip rendering text that is being edited (overlay handles display)
    if case .text = annotation.type, annotation.id == editingTextId {
      return
    }

    let strokeColor = NSColor(annotation.properties.strokeColor).cgColor
    let fillColor = NSColor(annotation.properties.fillColor).cgColor

    context.setStrokeColor(strokeColor)
    context.setFillColor(fillColor)
    context.setLineWidth(annotation.properties.strokeWidth)
    context.setLineCap(.round)
    context.setLineJoin(.round)

    switch annotation.type {
    case .rectangle:
      context.addPath(roundedRectPath(in: annotation.bounds, cornerRadius: annotation.properties.cornerRadius))
      strokeCurrentPath(lineStyle: annotation.properties.lineStyle, strokeWidth: annotation.properties.strokeWidth)

    case .filledRectangle:
      context.addPath(roundedRectPath(in: annotation.bounds, cornerRadius: annotation.properties.cornerRadius))
      strokeCurrentPath(lineStyle: annotation.properties.lineStyle, strokeWidth: annotation.properties.strokeWidth, mode: .fillStroke)

    case .oval:
      context.addEllipse(in: annotation.bounds)
      strokeCurrentPath(lineStyle: annotation.properties.lineStyle, strokeWidth: annotation.properties.strokeWidth)

    case .arrow(let geometry):
      drawArrow(
        geometry,
        strokeWidth: annotation.properties.strokeWidth,
        strokeColor: annotation.properties.strokeColor,
        lineStyle: annotation.properties.lineStyle
      )

    case .line(let start, let end):
      context.move(to: start)
      context.addLine(to: end)
      strokeCurrentPath(lineStyle: annotation.properties.lineStyle, strokeWidth: annotation.properties.strokeWidth)

    case .path(let points), .highlight(let points):
      drawPath(
        points: points,
        isHighlight: annotation.type.isHighlight,
        strokeWidth: annotation.properties.strokeWidth
      )

    case .counter(let value):
      drawCounter(value: value, in: annotation.bounds, properties: annotation.properties)

    case .blur(let blurType):
      drawBlur(
        bounds: annotation.bounds,
        annotationId: annotation.id,
        blurType: blurType,
        controlValue: annotation.properties.strokeWidth
      )

    case .text(let content):
      drawText(content, in: annotation.bounds, properties: annotation.properties)

    case .watermark(let content):
      drawWatermark(content, in: annotation.bounds, properties: annotation.properties)

    case .embeddedImage(let assetId):
      drawEmbeddedImage(assetId: assetId, annotationId: annotation.id, in: annotation.bounds)

    case .spotlight:
      // Spotlight is rendered as a unified overlay pass, skip per-item drawing
      break
    }
  }

  func drawCurrentStroke(
    tool: AnnotationToolType,
    start: CGPoint,
    currentPath: [CGPoint],
    strokeColor: Color,
    strokeWidth: CGFloat,
    fillColor: Color = .clear,
    arrowStyle: ArrowStyle = .straight,
    arrowType: ArrowType = .tapered,
    arrowBendDirection: ArrowBendDirection = .primary,
    arrowStartHead: ArrowEndpointStyle = .none,
    arrowEndHead: ArrowEndpointStyle = .arrow,
    lineStyle: LineDashStyle = .solid,
    rectangleCornerRadius: CGFloat = 0,
    watermarkText: String = "Snapzy",
    watermarkStyle: WatermarkStyle = .diagonal,
    watermarkOpacity: CGFloat = 0.22,
    watermarkRotationDegrees: CGFloat = -24,
    watermarkFontSize: CGFloat = 36
  ) {
    context.setStrokeColor(NSColor(strokeColor).cgColor)
    context.setLineWidth(strokeWidth)
    context.setLineCap(.round)

    switch tool {
    case .pencil, .highlighter:
      if tool == .highlighter {
        context.setAlpha(0.4)
        context.setLineWidth(strokeWidth * 3)
      }
      guard currentPath.count > 1 else { return }
      context.move(to: currentPath[0])
      for point in currentPath.dropFirst() {
        context.addLine(to: point)
      }
      context.strokePath()
      context.setAlpha(1.0)

    case .rectangle:
      let currentPoint = currentPath.last ?? start
      let rect = makeRect(from: start, to: currentPoint)
      context.addPath(roundedRectPath(in: rect, cornerRadius: rectangleCornerRadius))
      strokeCurrentPath(lineStyle: lineStyle, strokeWidth: strokeWidth)

    case .filledRectangle:
      let currentPoint = currentPath.last ?? start
      let rect = makeRect(from: start, to: currentPoint)
      let resolvedFillColor = fillColor == .clear ? strokeColor.opacity(1) : fillColor
      context.setFillColor(NSColor(resolvedFillColor).cgColor)
      context.addPath(roundedRectPath(in: rect, cornerRadius: rectangleCornerRadius))
      strokeCurrentPath(lineStyle: lineStyle, strokeWidth: strokeWidth, mode: .fillStroke)
      context.setFillColor(NSColor.clear.cgColor)

    case .oval:
      let currentPoint = currentPath.last ?? start
      let rect = makeRect(from: start, to: currentPoint)
      context.addEllipse(in: rect)
      strokeCurrentPath(lineStyle: lineStyle, strokeWidth: strokeWidth)

    case .line:
      let currentPoint = currentPath.last ?? start
      context.move(to: start)
      context.addLine(to: currentPoint)
      strokeCurrentPath(lineStyle: lineStyle, strokeWidth: strokeWidth)

    case .arrow:
      let currentPoint = currentPath.last ?? start
      let initialStyle = arrowStyle
      let resolvedStyle: ArrowStyle
      if arrowBendDirection == .alternate {
        if initialStyle == .curvedRight {
          resolvedStyle = .curvedLeft
        } else if initialStyle == .curvedLeft {
          resolvedStyle = .curvedRight
        } else {
          resolvedStyle = initialStyle
        }
      } else {
        resolvedStyle = initialStyle
      }
      let resolvedDirection: ArrowBendDirection = (resolvedStyle == .curvedLeft) ? .primary : .alternate
      drawArrow(
        ArrowGeometry(
          start: start,
          end: currentPoint,
          style: resolvedStyle,
          bendDirection: resolvedDirection,
          arrowType: arrowType,
          startHead: arrowStartHead,
          endHead: arrowEndHead
        ),
        strokeWidth: strokeWidth,
        strokeColor: strokeColor,
        lineStyle: lineStyle
      )

    case .watermark:
      let currentPoint = currentPath.last ?? start
      let rect = makeRect(from: start, to: currentPoint)
      guard rect.width >= 24, rect.height >= 24 else { return }
      drawWatermark(
        watermarkText,
        in: rect,
        properties: AnnotationProperties(
          strokeColor: strokeColor,
          fillColor: .clear,
          strokeWidth: strokeWidth,
          fontSize: watermarkFontSize,
          opacity: watermarkOpacity,
          rotationDegrees: watermarkRotationDegrees,
          watermarkStyle: watermarkStyle
        )
      )

    default:
      break
    }
  }

  /// Live preview of text-snapped highlighter bars. Routed through the same
  /// path drawing the committed annotations use, so the preview is pixel
  /// identical to what `mouseUp` creates.
  func drawSnappedHighlightPreview(segments: [AnnotateTextSnapSegment], strokeColor: Color) {
    guard !segments.isEmpty else { return }
    context.setStrokeColor(NSColor(strokeColor).cgColor)
    context.setLineCap(.round)
    for segment in segments {
      drawPath(points: segment.highlightPoints, isHighlight: true, strokeWidth: segment.strokeWidth)
    }
  }

  // MARK: - Private Drawing Helpers

  private func drawPath(points: [CGPoint], isHighlight: Bool, strokeWidth: CGFloat) {
    guard points.count > 1 else { return }
    if isHighlight {
      context.setAlpha(0.4)
      context.setLineWidth(strokeWidth * 3)
    } else {
      context.setLineWidth(strokeWidth)
    }
    context.move(to: points[0])
    for point in points.dropFirst() {
      context.addLine(to: point)
    }
    context.strokePath()
    context.setAlpha(1.0)
  }

  private func roundedRectPath(in rect: CGRect, cornerRadius: CGFloat) -> CGPath {
    let clampedCornerRadius = max(0, min(cornerRadius, min(rect.width, rect.height) / 2))
    guard clampedCornerRadius > 0 else {
      return CGPath(rect: rect, transform: nil)
    }
    retur
```

### Core Architecture Module: `Snapzy/Features/Annotate/Services/AnnotateBlurEffectRenderer.swift`
```
//
//  AnnotateBlurEffectRenderer.swift
//  Snapzy
//
//  Helper for rendering pixelated blur effect on image regions
//

import AppKit
import CoreGraphics
import CoreImage
import Metal

/// Quality tier for blur renders. Interactive work must be bounded so UI input never waits on expensive effects.
nonisolated enum BlurRenderQuality: Equatable {
  case interactive
  case settled
  case export

  var maxGaussianSamplePixels: CGFloat? {
    switch self {
    case .interactive:
      420_000
    case .settled:
      1_600_000
    case .export:
      nil
    }
  }
}

/// Renders pixelated blur effect for sensitive content redaction
nonisolated enum BlurEffectRenderer {
  /// Default pixel block size for blur effect
  static let defaultPixelSize: CGFloat = 12

  /// Default Gaussian blur radius
  static let defaultGaussianRadius: Double = 20.0

  /// Security-first radius floor relative to smallest blur dimension
  private static let gaussianSecurityStrengthFactor: CGFloat = 0.35

  /// Sampling padding multiplier around target region
  private static let gaussianPaddingMultiplier: CGFloat = 2.0

  /// Hard cap to keep Gaussian cost bounded on very large regions
  private static let maxAdaptiveGaussianRadius: CGFloat = 120

  /// Shared GPU-backed CIContext for performance (reused across blur operations)
  static let sharedCIContext: CIContext = {
    if let metalDevice = MTLCreateSystemDefaultDevice() {
      return CIContext(mtlDevice: metalDevice, options: [
        .cacheIntermediates: true,
        .priorityRequestLow: false,
      ])
    }
    return CIContext(options: [.cacheIntermediates: true])
  }()

  private struct RegionMapping {
    let imageScaleX: CGFloat
    let imageScaleY: CGFloat
    let clampedSourceRegion: CGRect
    let clampedDestRegion: CGRect
    let targetPixelRegion: CGRect
  }

  /// Draw a pixelated version of the source image region
  /// - Parameters:
  ///   - context: The graphics context to draw into
  ///   - sourceImage: The source image to sample from
  ///   - region: The region bounds in image coordinates
  ///   - pixelSize: Size of each pixel block (larger = more blur)
  static func drawPixelatedRegion(
    in context: CGContext,
    sourceImage: NSImage,
    region: CGRect,
    pixelSize: CGFloat = defaultPixelSize
  ) {
    drawPixelatedRegion(
      in: context,
      sourceImage: sourceImage,
      sourceRegion: region,
      destRegion: region,
      pixelSize: pixelSize
    )
  }

  /// Draw a pixelated region by sampling from source region and drawing into destination region.
  static func drawPixelatedRegion(
    in context: CGContext,
    sourceImage: NSImage,
    sourceRegion: CGRect,
    destRegion: CGRect,
    pixelSize: CGFloat = defaultPixelSize
  ) {
    guard let cgImage = sourceImage.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
      drawFallbackBlur(in: context, region: destRegion)
      return
    }

    drawPixelatedRegion(
      in: context,
      sourceCGImage: cgImage,
      sourceSize: sourceImage.size,
      sourceRegion: sourceRegion,
      destRegion: destRegion,
      pixelSize: pixelSize
    )
  }

  /// Draw a pixelated region using a CGImage snapshot. Safe for background render work.
  static func drawPixelatedRegion(
    in context: CGContext,
    sourceCGImage cgImage: CGImage,
    sourceSize: CGSize,
    sourceRegion: CGRect,
    destRegion: CGRect,
    pixelSize: CGFloat = defaultPixelSize
  ) {
    guard sourceRegion.width > 0, sourceRegion.height > 0, destRegion.width > 0, destRegion.height > 0 else { return }

    guard let mapping = makeRegionMapping(
      sourceSize: sourceSize,
      cgImage: cgImage,
      sourceRegion: sourceRegion,
      destRegion: destRegion
    ) else {
      drawFallbackBlur(in: context, region: destRegion)
      return
    }

    guard let croppedImage = cgImage.cropping(to: mapping.targetPixelRegion) else {
      drawFallbackBlur(in: context, region: mapping.clampedDestRegion)
      return
    }

    drawPixelated(
      croppedImage: croppedImage,
      in: context,
      destRect: mapping.clampedDestRegion,
      pixelSize: pixelSize * max(mapping.imageScaleX, mapping.imageScaleY)
    )
  }

  /// Draw pixelated version of cropped image region.
  /// Uses downsample -> nearest-neighbor upscale instead of one fill call per block.
  private static func drawPixelated(
    croppedImage: CGImage,
    in context: CGContext,
    destRect: CGRect,
    pixelSize: CGFloat
  ) {
    let blockSize = max(1, pixelSize)
    let cols = max(1, Int(ceil(CGFloat(croppedImage.width) / blockSize)))
    let rows = max(1, Int(ceil(CGFloat(croppedImage.height) / blockSize)))

    guard let smallContext = CGContext(
      data: nil,
      width: cols,
      height: rows,
      bitsPerComponent: 8,
      bytesPerRow: 0,
      space: CGColorSpaceCreateDeviceRGB(),
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else {
      drawFallbackBlur(in: context, region: destRect)
      return
    }

    smallContext.interpolationQuality = .low
    smallContext.draw(croppedImage, in: CGRect(x: 0, y: 0, width: cols, height: rows))

    guard let lowResolutionImage = smallContext.makeImage() else {
      drawFallbackBlur(in: context, region: destRect)
      return
    }

    context.saveGState()
    context.clip(to: destRect)
    context.setAllowsAntialiasing(false)
    context.setShouldAntialias(false)
    context.interpolationQuality = .none
    context.draw(lowResolutionImage, in: destRect)
    context.restoreGState()
  }

  /// Fallback blur when image sampling fails - draws semi-transparent overlay
  private static func drawFallbackBlur(in context: CGContext, region: CGRect) {
    context.setFillColor(NSColor.gray.withAlphaComponent(0.7).cgColor)
    context.fill(region)
  }

  /// Draw a subtle placeholder while an exact async blur render is pending.
  static func drawBlurPlaceholder(
    in context: CGContext,
    region: CGRect
  ) {
    context.saveGState()
    context.setFillColor(NSColor.gray.withAlphaComponent(0.32).cgColor)
    context.fill(region)
    context.restoreGState()
  }

  /// Draw blur preview during drag operation (simpler/faster)
  static func drawBlurPreview(
    in context: CGContext,
    region: CGRect,
    strokeColor: CGColor
  ) {
    // Draw semi-transparent overlay with pattern to indicate blur area
    context.setFillColor(NSColor.gray.withAlphaComponent(0.5).cgColor)
    context.fill(region)

    // Draw border
    context.setStrokeColor(strokeColor)
    context.setLineWidth(2)
    context.setLineDash(phase: 0, lengths: [6, 4])
    context.stroke(region)
    context.setLineDash(phase: 0, lengths: [])
  }

  /// Draw Gaussian blur region using CIFilter (GPU-accelerated).
  static func drawGaussianRegion(
    in context: CGContext,
    sourceImage: NSImage,
    region: CGRect,
    radius: Double = defaultGaussianRadius,
    quality: BlurRenderQuality = .export
  ) {
    drawGaussianRegion(
      in: context,
      sourceImage: sourceImage,
      sourceRegion: region,
      destRegion: region,
      radius: radius,
      quality: quality
    )
  }

  /// Draw Gaussian blur by sampling from source region and drawing into destination region.
  static func drawGaussianRegion(
    in context: CGContext,
    sourceImage: NSImage,
    sourceRegion: CGRect,
    destRegion: CGRect,
    radius: Double = defaultGaussianRadius,
    quality: BlurRenderQuality = .export
  ) {
    guard let cgImage = sourceImage.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
      drawFallbackBlur(in: context, region: destRegion)
      return
    }

    drawGaussianRegion(
      in: context,
      sourceCGImage: cgImage,
      sourceSize: sourceImage.size,
      sourceRegion: sourceRegion,
      destRegion: destRegion,
      radius: radius,
      quality: quality
    )
  }

  /// Draw Gaussian blur using a CGImage snapshot. Safe for background render work.
  static func drawGaussianRegion(
    in context: CGContext,
    sourceCGImage cgImage: CGImage,
    sourceSize: CGSize,
    sourceRegion: CGRect,
    destRegion: CGRect,
    radius: Double = defaultGaussianRadius,
    quality: BlurRenderQuality = .export
  ) {
    guard sourceRegion.width > 0, sourceRegion.height > 0, destRegion.width > 0, destRegion.height > 0 else { return }

    guard let mapping = makeRegionMapping(
      sourceSize: sourceSize,
      cgImage: cgImage,
      sourceRegion: sourceRegion,
      destRegion: destRegion
    ) else {
      drawFallbackBlur(in: context, region: destRegion)
      return
    }

    let targetPixelRegion = mapping.targetPixelRegion
    let imageScale = max(mapping.imageScaleX, mapping.imageScaleY)
    let effectiveRadiusPx = effectiveGaussianRadiusPixels(
      baseRadius: CGFloat(radius),
      imageScale: imageScale,
      pixelRegion: targetPixelRegion
    )
    let samplePaddingPx = ceil(effectiveRadiusPx * gaussianPaddingMultiplier)
    let pixelBounds = CGRect(x: 0, y: 0, width: cgImage.width, height: cgImage.height)
    let sampledPixelRegion = targetPixelRegion.insetBy(dx: -samplePaddingPx, dy: -samplePaddingPx)
      .intersection(pixelBounds)

    guard !sampledPixelRegion.isEmpty,
          let sampledCGImage = cgImage.cropping(to: sampledPixelRegion) else {
      drawFallbackBlur(in: context, region: mapping.clampedDestRegion)
      return
    }

    let sampleExtent = CGRect(x: 0, y: 0, width: sampledCGImage.width, height: sampledCGImage.height)
    let sampleArea = sampleExtent.width * sampleExtent.height
    let downsampleScale: CGFloat = if let maxPixels = quality.maxGaussianSamplePixels, sampleArea > maxPixels {
      max(0.05, sqrt(maxPixels / sampleArea))
    } else {
      1
    }

    let sampledCIImage = CIImage(cgImage: sampledCGImage)
    let workingImage: CIImage = if downsampleScale < 0.999 {
      sampledCIImage.transformed(by: CGAffineTransform(scaleX: downsampleScale, y: downsampleScale))
    } else {
      sampledCIImage
    }

    let clampedInput = workingIma
```

### Core Architecture Module: `Snapzy/Features/Annotate/Services/AnnotateMockup3DRenderer.swift`
```
//
//  Mockup3DRenderer.swift
//  Snapzy
//
//  3D transformation renderer for mockup images
//

import SwiftUI

/// Renders an image with 3D perspective transformations
struct Mockup3DRenderer: View {
    @ObservedObject var state: MockupState

    var body: some View {
        Group {
            if let image = state.sourceImage {
                imageContent(image)
            } else {
                placeholderView
            }
        }
    }

    // MARK: - Image Content

    @ViewBuilder
    private func imageContent(_ image: NSImage) -> some View {
        Image(nsImage: image)
            .resizable()
            .aspectRatio(contentMode: .fit)
            .clipShape(RoundedRectangle(cornerRadius: state.cornerRadius, style: .continuous))
            // Apply rotations in Y -> X -> Z order for intuitive control
            .rotation3DEffect(
                .degrees(state.rotationY),
                axis: (x: 0, y: 1, z: 0),
                anchor: .center,
                anchorZ: 0,
                perspective: state.perspective
            )
            .rotation3DEffect(
                .degrees(state.rotationX),
                axis: (x: 1, y: 0, z: 0),
                anchor: .center,
                anchorZ: 0,
                perspective: state.perspective
            )
            .rotation3DEffect(
                .degrees(state.rotationZ),
                axis: (x: 0, y: 0, z: 1),
                anchor: .center
            )
            .shadow(
                color: .black.opacity(state.shadowIntensity),
                radius: state.shadowRadius,
                x: state.shadowOffsetX,
                y: state.shadowOffsetY
            )
            .animation(.interactiveSpring(response: 0.3, dampingFraction: 0.8), value: state.rotationX)
            .animation(.interactiveSpring(response: 0.3, dampingFraction: 0.8), value: state.rotationY)
            .animation(.interactiveSpring(response: 0.3, dampingFraction: 0.8), value: state.rotationZ)
            .animation(.interactiveSpring(response: 0.3, dampingFraction: 0.8), value: state.perspective)
    }

    // MARK: - Placeholder

    private var placeholderView: some View {
        Radius.rect(Radius.card)
            .fill(Color.gray.opacity(0.2))
            .frame(width: 300, height: 200)
            .overlay {
                VStack(spacing: 8) {
                    Image(systemName: "photo")
                        .font(.system(size: 40))
                        .foregroundStyle(.secondary)
                    Text(L10n.AnnotateUI.dropImageHere)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
    }
}

// MARK: - Preview Content View (for export)

/// A view that renders the mockup without animations for static export
struct MockupStaticRenderer: View {
    let image: NSImage
    let rotationX: Double
    let rotationY: Double
    let rotationZ: Double
    let perspective: Double
    let cornerRadius: Double
    let shadowIntensity: Double
    let shadowOffsetX: CGFloat
    let shadowOffsetY: CGFloat
    let shadowRadius: CGFloat

    init(state: MockupState) {
        self.image = state.sourceImage ?? NSImage()
        self.rotationX = state.rotationX
        self.rotationY = state.rotationY
        self.rotationZ = state.rotationZ
        self.perspective = state.perspective
        self.cornerRadius = state.cornerRadius
        self.shadowIntensity = state.shadowIntensity
        self.shadowOffsetX = state.shadowOffsetX
        self.shadowOffsetY = state.shadowOffsetY
        self.shadowRadius = state.shadowRadius
    }

    var body: some View {
        Image(nsImage: image)
            .resizable()
            .aspectRatio(contentMode: .fit)
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .rotation3DEffect(
                .degrees(rotationY),
                axis: (x: 0, y: 1, z: 0),
                anchor: .center,
                anchorZ: 0,
                perspective: perspective
            )
            .rotation3DEffect(
                .degrees(rotationX),
                axis: (x: 1, y: 0, z: 0),
                anchor: .center,
                anchorZ: 0,
                perspective: perspective
            )
            .rotation3DEffect(
                .degrees(rotationZ),
                axis: (x: 0, y: 0, z: 1),
                anchor: .center
            )
            .shadow(
                color: .black.opacity(shadowIntensity),
                radius: shadowRadius,
                x: shadowOffsetX,
                y: shadowOffsetY
            )
    }
}

#Preview {
    let state = MockupState()
    state.rotationX = 10
    state.rotationY = -15
    state.perspective = 0.4

    return Mockup3DRenderer(state: state)
        .frame(width: 400, height: 300)
        .padding()
}

```

### Core Architecture Module: `Snapzy/Features/History/Components/HistoryEmptyStateView.swift`
```
//
//  HistoryEmptyStateView.swift
//  Snapzy
//
//  Empty state placeholder for capture history
//

import SwiftUI

struct HistoryEmptyStateView: View {
  @Environment(\.colorScheme) private var colorScheme

  let filter: CaptureHistoryType?
  let hasSearch: Bool

  var body: some View {
    VStack(spacing: 16) {
      Image(systemName: iconName)
        .font(.system(size: 48))
        .foregroundColor(.secondary.opacity(0.5))

      Text(title)
        .font(.title3)
        .fontWeight(.semibold)

      Text(subtitle)
        .font(.body)
        .foregroundColor(.secondary)
        .multilineTextAlignment(.center)
        .frame(maxWidth: 300)
    }
    .padding(.horizontal, 30)
    .padding(.vertical, 26)
    .background(.regularMaterial, in: Radius.rect(Radius.panel))
    .overlay(
      Radius.rect(Radius.panel)
        .stroke(colorScheme == .dark ? Color.white.opacity(0.08) : Color.black.opacity(0.05), lineWidth: 1)
    )
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }

  private var iconName: String {
    if hasSearch {
      return "magnifyingglass"
    }
    switch filter {
    case .screenshot: return CaptureHistoryType.screenshot.systemIconName
    case .video: return CaptureHistoryType.video.systemIconName
    case .gif: return CaptureHistoryType.gif.systemIconName
    case nil: return "square.grid.2x2"
    }
  }

  private var title: String {
    if hasSearch {
      return "No matches found"
    }
    switch filter {
    case .screenshot: return "No screenshots yet"
    case .video: return "No videos yet"
    case .gif: return "No GIFs yet"
    case nil: return "No captures yet"
    }
  }

  private var subtitle: String {
    if hasSearch {
      return "Try a different search term."
    }
    return "Take a screenshot or record your screen to see them here."
  }
}

```

### Core Architecture Module: `Snapzy/Features/Onboarding/SnapzyOnboardingState.swift`
```
//
//  SnapzyOnboardingState.swift
//  Snapzy
//
//  Observable state manager for interactive onboarding, fully compatible with macOS 13.0+.
//

import AppKit
import Combine
import SwiftUI

enum MockAnnotateTool: String, CaseIterable, Identifiable {
  case arrow
  case rect
  case counter
  case blur

  var id: String { rawValue }

  var icon: String {
    switch self {
    case .arrow: return "arrow.up.right"
    case .rect: return "rectangle"
    case .counter: return "1.circle.fill"
    case .blur: return "checkerboard.rectangle"
    }
  }

  var label: String {
    switch self {
    case .arrow: return "Arrow"
    case .rect: return "Rectangle"
    case .counter: return "Counter"
    case .blur: return "Blur"
    }
  }
}

struct MockAnnotateItem: Identifiable, Equatable {
  let id = UUID()
  let tool: MockAnnotateTool
  var position: CGPoint
}

enum Step1WorkflowStage: Equatable {
  case readyToCapture
  case selectingArea
  case quickAccessFloating
  case annotateWindowOpen
}

enum Step2WorkflowStage: Equatable {
  case readyToRecord
  case prerecordArea
  case recordingActive
  case videoQuickAccess
  case videoEditorOpen
}

@MainActor
final class SnapzyOnboardingState: ObservableObject {
  @Published var currentStep: SnapzyOnboardingStep = .meetSnapzy
  @Published var completedSteps: Set<SnapzyOnboardingStep> = []
  @Published var completedChallenges: Set<SnapzyOnboardingChallenge> = []

  init(restoreSavedStep: Bool = true) {
    if restoreSavedStep,
       let savedStepRaw = UserDefaults.standard.string(forKey: PreferencesKeys.onboardingActiveStep),
       let savedStep = SnapzyOnboardingStep(rawValue: savedStepRaw) {
      self.currentStep = savedStep
      self.resetStateForStep(savedStep)
    }
  }

  // Step 1: Capture > Quick Access > Annotate Lifecycle State
  @Published var step1Stage: Step1WorkflowStage = .readyToCapture
  @Published var screenFlashOpacity: Double = 0
  @Published var hasAreaSelection: Bool = false
  @Published var selectedTool: MockAnnotateTool? = nil
  @Published var annotationItems: [MockAnnotateItem] = []
  @Published var isSimulatingSelection: Bool = false

  // Step 2: Screen Recording & Video Editor Lifecycle State
  @Published var step2Stage: Step2WorkflowStage = .readyToRecord
  @Published var recordingSeconds: Int = 0
  @Published var isRecordingTimerRunning: Bool = false
  @Published var isPlayingPreview: Bool = false
  @Published var isQuickAccessHovered: Bool = false
  @Published var quickAccessFeedbackText: String? = nil
  @Published var isCardPinned: Bool = false
  private var recordingTimer: Timer? = nil

  // Step 3: Shortcuts & Config Mock State
  @Published var hasConflict: Bool = true
  @Published var hasFullscreenConflict: Bool = true
  @Published var hasAreaConflict: Bool = true
  @Published var hasRecordingConflict: Bool = true
  @Published var isCheckingConflict: Bool = false
  @Published var isConfigGranted: Bool = false
  @Published var diagnosticsOptIn: Bool = true

  var isCurrentStepComplete: Bool {
    let required = currentStep.challenges
    return required.allSatisfy { completedChallenges.contains($0) }
  }

  var canGoBack: Bool {
    currentStep.stepNumber > 1
  }

  var canGoForward: Bool {
    currentStep.stepNumber < SnapzyOnboardingStep.allCases.count
  }

  func markCurrentStepVisited() {
    withAnimation(SnapzyMotionPreferences.shared.spec(.settle).animation) {
      _ = completedSteps.insert(currentStep)
    }
  }

  func completeChallenge(_ challenge: SnapzyOnboardingChallenge) {
    withAnimation(SnapzyMotionPreferences.shared.spec(.settle).animation) {
      completedChallenges.insert(challenge)
      if isCurrentStepComplete {
        completedSteps.insert(currentStep)
      }
    }
  }

  func setChallenge(_ challenge: SnapzyOnboardingChallenge, completed: Bool) {
    guard completedChallenges.contains(challenge) != completed else { return }
    withAnimation(SnapzyMotionPreferences.shared.spec(.settle).animation) {
      if completed {
        completedChallenges.insert(challenge)
        if isCurrentStepComplete { completedSteps.insert(currentStep) }
      } else {
        completedChallenges.remove(challenge)
        completedSteps.remove(currentStep)
      }
    }
  }

  func nextStep() {
    guard let currentIndex = SnapzyOnboardingStep.allCases.firstIndex(of: currentStep),
          currentIndex + 1 < SnapzyOnboardingStep.allCases.count else { return }
    let next = SnapzyOnboardingStep.allCases[currentIndex + 1]
    transition(to: next)
  }

  func previousStep() {
    guard let currentIndex = SnapzyOnboardingStep.allCases.firstIndex(of: currentStep),
          currentIndex > 0 else { return }
    let prev = SnapzyOnboardingStep.allCases[currentIndex - 1]
    transition(to: prev)
  }

  func transition(to step: SnapzyOnboardingStep) {
    withAnimation(SnapzyMotionPreferences.shared.spec(.morph).animation) {
      currentStep = step
      UserDefaults.standard.set(step.rawValue, forKey: PreferencesKeys.onboardingActiveStep)
      resetStateForStep(step)
    }
  }

  private func resetStateForStep(_ step: SnapzyOnboardingStep) {
    switch step {
    case .meetSnapzy:
      step1Stage = .readyToCapture
      screenFlashOpacity = 0
      hasAreaSelection = false
      selectedTool = nil
      annotationItems = []
    case .quickAccess:
      resetStep2Flow()
    case .shortcuts:
      hasFullscreenConflict = true
      hasAreaConflict = true
      hasRecordingConflict = true
      hasConflict = true
    case .permissions:
      break
    }
  }

  // MARK: - Interactive Simulation Actions

  func simulateAreaCapture() {
    withAnimation(SnapzyMotionPreferences.shared.spec(.settle).animation) {
      step1Stage = .selectingArea
      hasAreaSelection = true
      completeChallenge(.selectArea)
    }
  }

  func completeCaptureToQuickAccess() {
    withAnimation(.easeOut(duration: 0.12)) {
      screenFlashOpacity = 0.65
    }
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) { [weak self] in
      withAnimation(SnapzyMotionPreferences.shared.spec(.morph).animation) {
        self?.screenFlashOpacity = 0
        self?.step1Stage = .quickAccessFloating
        self?.completeChallenge(.captureToQuickAccess)
      }
    }
  }

  func openAnnotateFromQuickAccess() {
    withAnimation(SnapzyMotionPreferences.shared.spec(.morph).animation) {
      step1Stage = .annotateWindowOpen
      completeChallenge(.openAnnotateWindow)
    }
  }

  func resetStep1Flow() {
    withAnimation(SnapzyMotionPreferences.shared.spec(.morph).animation) {
      step1Stage = .readyToCapture
      hasAreaSelection = false
      selectedTool = nil
      annotationItems = []
    }
  }

  func selectAnnotationTool(_ tool: MockAnnotateTool) {
    withAnimation(SnapzyMotionPreferences.shared.spec(.hover).animation) {
      selectedTool = tool
      if !annotationItems.contains(where: { $0.tool == tool }) {
        let defaultPosition: CGPoint
        switch tool {
        case .arrow: defaultPosition = CGPoint(x: 220, y: 150)
        case .rect: defaultPosition = CGPoint(x: 140, y: 110)
        case .counter: defaultPosition = CGPoint(x: 80, y: 80)
        case .blur: defaultPosition = CGPoint(x: 180, y: 200)
        }
        annotationItems.append(MockAnnotateItem(tool: tool, position: defaultPosition))
      }
      completeChallenge(.addAnnotation)
    }
  }

  func simulateQuickAccessAction(_ actionName: String) {
    withAnimation(SnapzyMotionPreferences.shared.spec(.settle).animation) {
      quickAccessFeedbackText = actionName
      completeChallenge(.triggerQuickAction)
    }
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { [weak self] in
      withAnimation(SnapzyMotionPreferences.shared.spec(.settle).animation) {
        self?.quickAccessFeedbackText = nil
      }
    }
  }

  // MARK: - Step 2: Screen Recording Simulation Actions

  func simulateStartPrerecord() {
    withAnimation(SnapzyMotionPreferences.shared.spec(.settle).animation) {
      step2Stage = .prerecordArea
      completeChallenge(.selectRecordArea)
    }
  }

  func simulateStartRecording() {
    recordingTimer?.invalidate()
    recordingTimer = nil
    recordingSeconds = 0
    isRecordingTimerRunning = true

    withAnimation(SnapzyMotionPreferences.shared.spec(.settle).animation) {
      step2Stage = .recordingActive
    }

    recordingTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
      MainActor.assumeIsolated {
        guard let self else { return }
        if self.recordingSeconds < 3 {
          self.recordingSeconds += 1
        }
        if self.recordingSeconds >= 3 {
          self.recordingTimer?.invalidate()
          self.recordingTimer = nil
          self.simulateFinishRecording()
        }
      }
    }
  }

  func simulateFinishRecording() {
    recordingTimer?.invalidate()
    recordingTimer = nil
    isRecordingTimerRunning = false

    withAnimation(.easeOut(duration: 0.12)) {
      screenFlashOpacity = 0.65
    }
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) { [weak self] in
      withAnimation(SnapzyMotionPreferences.shared.spec(.morph).animation) {
        self?.screenFlashOpacity = 0
        self?.step2Stage = .videoQuickAccess
        self?.completeChallenge(.recordVideo3s)
      }
    }
  }

  func openVideoEditorFromQuickAccess() {
    withAnimation(SnapzyMotionPreferences.shared.spec(.morph).animation) {
      step2Stage = .videoEditorOpen
      completeChallenge(.openVideoEditor)
    }
  }

  func resetStep2Flow() {
    recordingTimer?.invalidate()
    recordingTimer = nil
    isRecordingTimerRunning = false
    recordingSeconds = 0
    isPlayingPreview = false
    isQuickAccessHovered = false
    quickAccessFeedbackText = nil
    isCardPinned = false

    withAnimation(SnapzyMotionPreferences.shared.spec(.morph).animation) {
      step2Stage = .readyToRecord
    }
  }

  // MARK: - Step 3: Shortcuts & Conflict Resolution

  func updateShortcutConflicts(fullscreenConflict: Bool, 
```

### Core Architecture Module: `Snapzy/Features/Preferences/Models/PreferencesNavigationState.swift`
```
//
//  PreferencesNavigationState.swift
//  Snapzy
//
//  Shared navigation state for selecting Preferences tabs programmatically.
//

import Combine
import Foundation

enum PreferencesTab: String, CaseIterable, Identifiable, Hashable {
  case general
  case menuBar
  case capture
  case annotate
  case quickAccess
  case history
  case shortcuts
  case permissions
  case cloud
  case advanced
  case about

  var id: String { rawValue }

  static let storageKey = "preferences.lastSelectedTab"

  static var lastSelected: PreferencesTab {
    guard let raw = UserDefaults.standard.string(forKey: storageKey),
          let tab = PreferencesTab(rawValue: raw) else {
      return .general
    }
    return tab
  }

  var title: String {
    switch self {
    case .general:
      return L10n.Preferences.generalTab
    case .menuBar:
      return L10n.Preferences.menuBarTab
    case .capture:
      return L10n.Preferences.captureTab
    case .annotate:
      return L10n.Preferences.annotateTab
    case .quickAccess:
      return L10n.Preferences.quickAccessTab
    case .history:
      return L10n.Preferences.historyTab
    case .shortcuts:
      return L10n.Preferences.shortcutsTab
    case .permissions:
      return L10n.Preferences.permissionsTab
    case .cloud:
      return L10n.Preferences.cloudTab
    case .advanced:
      return L10n.Preferences.advancedTab
    case .about:
      return L10n.Preferences.aboutTab
    }
  }

  var symbol: String {
    switch self {
    case .general:
      return "gearshape"
    case .menuBar:
      return "menubar.rectangle"
    case .capture:
      return "camera"
    case .annotate:
      return "pencil.and.scribble"
    case .quickAccess:
      return "square.stack"
    case .history:
      return "clock.arrow.circlepath"
    case .shortcuts:
      return "keyboard"
    case .permissions:
      return "lock.shield"
    case .cloud:
      return "icloud"
    case .advanced:
      return "slider.horizontal.3"
    case .about:
      return "info.circle"
    }
  }

  /// The sidebar's running order in 4 unlabelled groups separated by natural whitespace (Ruru & macOS System Settings style).
  static let groups: [[PreferencesTab]] = [
    [.general, .menuBar, .quickAccess, .history],
    [.capture, .annotate, .cloud],
    [.shortcuts, .permissions, .advanced],
    [.about],
  ]
}

@MainActor
final class PreferencesNavigationState: ObservableObject {
  static let shared = PreferencesNavigationState()

  @Published var selectedTab: PreferencesTab {
    didSet {
      UserDefaults.standard.set(selectedTab.rawValue, forKey: PreferencesTab.storageKey)
    }
  }

  @Published private(set) var backStack: [PreferencesTab] = []
  @Published private(set) var forwardStack: [PreferencesTab] = []

  var canGoBack: Bool { !backStack.isEmpty }
  var canGoForward: Bool { !forwardStack.isEmpty }

  init(initialTab: PreferencesTab? = nil) {
    self.selectedTab = initialTab ?? PreferencesTab.lastSelected
  }

  /// User directly selects a tab (via sidebar or programmatic link).
  func select(_ tab: PreferencesTab) {
    guard tab != selectedTab else { return }
    backStack.append(selectedTab)
    forwardStack.removeAll()
    selectedTab = tab
  }

  /// Navigates back to the previous tab in history.
  func goBack() {
    guard let previous = backStack.popLast() else { return }
    forwardStack.append(selectedTab)
    selectedTab = previous
  }

  /// Navigates forward to the next tab in history.
  func goForward() {
    guard let next = forwardStack.popLast() else { return }
    backStack.append(selectedTab)
    selectedTab = next
  }
}

```

### Core Architecture Module: `Snapzy/Features/QuickAccess/Models/QuickAccessPinWindowState.swift`
```
//
//  QuickAccessPinWindowState.swift
//  Snapzy
//
//  Observable state for independent pinned screenshot windows.
//

import AppKit
import Combine
import Foundation

@MainActor
final class QuickAccessPinWindowState: ObservableObject {
  let id: UUID

  @Published private(set) var url: URL
  @Published private(set) var image: NSImage
  @Published private(set) var thumbnail: NSImage
  @Published var isLocked = false
  @Published var isMouseInside = false
  @Published private(set) var zoomFactor: CGFloat = 1

  private(set) var baseSize: CGSize
  private(set) var maxSize: CGSize

  private let absoluteMinimumZoomFactor: CGFloat = 0.4

  init(id: UUID, url: URL, image: NSImage, thumbnail: NSImage, baseSize: CGSize, maxSize: CGSize) {
    self.id = id
    self.url = url
    self.image = image
    self.thumbnail = thumbnail
    self.baseSize = baseSize
    self.maxSize = maxSize
  }

  var displaySize: CGSize {
    CGSize(width: baseSize.width * zoomFactor, height: baseSize.height * zoomFactor)
  }

  var zoomPercent: Int {
    Int((zoomFactor * 100).rounded())
  }

  var zoomMenuPercents: [Int] {
    var percents = [50, 75, 100, 125, 150, 200].filter { percent in
      let factor = CGFloat(percent) / 100
      return factor >= minimumZoomFactor - 0.001 && factor <= maximumZoomFactor + 0.001
    }
    if !percents.contains(zoomPercent) {
      percents.append(zoomPercent)
      percents.sort()
    }
    return percents
  }

  var minimumZoomFactor: CGFloat {
    guard baseSize.width > 0, baseSize.height > 0 else { return 1 }
    let interactiveSize = QuickAccessPinWindowSizing.minimumInteractiveSize
    let interactiveFloor = max(
      interactiveSize.width / baseSize.width,
      interactiveSize.height / baseSize.height
    )
    let floor = max(absoluteMinimumZoomFactor, interactiveFloor)
    return min(floor, maximumZoomFactor)
  }

  var maximumZoomFactor: CGFloat {
    guard baseSize.width > 0, baseSize.height > 0 else { return 1 }
    let screenLimit = min(maxSize.width / baseSize.width, maxSize.height / baseSize.height)
    return max(1, min(2, screenLimit))
  }

  func setZoomPercent(_ percent: Int) -> CGSize {
    setZoomFactor(CGFloat(percent) / 100)
  }

  func resetZoom() -> CGSize {
    setZoomFactor(1)
  }

  func applyZoomStep(_ step: CGFloat) -> CGSize {
    guard step.isFinite, step != 0 else { return displaySize }
    return setZoomFactor(zoomFactor + step)
  }

  func update(url: URL, image: NSImage, thumbnail: NSImage, baseSize: CGSize, maxSize: CGSize) -> CGSize {
    self.url = url
    self.image = image
    self.thumbnail = thumbnail
    return updateSizing(baseSize: baseSize, maxSize: maxSize)
  }

  func updateSizing(baseSize: CGSize, maxSize: CGSize) -> CGSize {
    self.baseSize = baseSize
    self.maxSize = maxSize
    zoomFactor = clampedZoomFactor(zoomFactor)
    return displaySize
  }

  func updateZoomFactor(_ factor: CGFloat) {
    zoomFactor = clampedZoomFactor(factor)
  }

  @discardableResult
  private func setZoomFactor(_ factor: CGFloat) -> CGSize {
    zoomFactor = clampedZoomFactor(factor)
    return displaySize
  }

  func clampedZoomFactor(_ factor: CGFloat) -> CGFloat {
    min(max(factor, minimumZoomFactor), maximumZoomFactor)
  }
}


```

### Core Architecture Module: `Snapzy/Features/Recording/Models/RecordingAnnotationState.swift`
```
//
//  RecordingAnnotationState.swift
//  Snapzy
//
//  Lightweight state for annotations during screen recording
//  Supports per-tool auto-clear (time-based and count-based)
//

import AppKit
import Combine
import SwiftUI

// MARK: - Auto-Clear Mode

enum AnnotationClearMode: Equatable, Hashable {
  case persist
  case timeBased(seconds: Double)
  case countBased(count: Int)

  var displayName: String {
    switch self {
    case .persist: return L10n.RecordingAnnotation.persist
    case .timeBased(let s): return "\(Int(s))s"
    case .countBased(let c): return L10n.RecordingAnnotation.lastCount(c)
    }
  }
}

// MARK: - Annotation Entry (wraps AnnotationItem with lifecycle metadata)

struct RecordingAnnotationEntry: Identifiable, Equatable {
  let id: UUID
  var item: AnnotationItem
  let createdAt: Date
  let createdByTool: AnnotationToolType
  var opacity: Double = 1.0

  static func == (lhs: Self, rhs: Self) -> Bool {
    lhs.id == rhs.id && lhs.opacity == rhs.opacity
  }
}

// MARK: - Recording Annotation State

@MainActor
final class RecordingAnnotationState: ObservableObject {
  @Published var annotations: [RecordingAnnotationEntry] = []
  @Published var selectedTool: AnnotationToolType = .selection
  @Published var selectedAnnotationId: UUID?
  @Published var strokeColor: Color = .red
  @Published var strokeWidth: CGFloat = 3
  @Published var isAnnotationEnabled: Bool = false {
    didSet {
      if !isAnnotationEnabled {
        selectedTool = .selection
      }
    }
  }
  @Published var toolClearModes: [AnnotationToolType: AnnotationClearMode] = [:]
  @Published var isShortcutModeActive: Bool = false

  private var cleanupTimer: Timer?

  static let availableTools: [AnnotationToolType] = [
    .selection, .rectangle, .oval, .arrow, .line, .pencil, .highlighter,
  ]

  static let clearModePresets: [AnnotationClearMode] = [
    .persist,
    .timeBased(seconds: 3),
    .timeBased(seconds: 5),
    .timeBased(seconds: 10),
    .countBased(count: 3),
    .countBased(count: 5),
    .countBased(count: 10),
  ]

  func clearMode(for tool: AnnotationToolType) -> AnnotationClearMode {
    toolClearModes[tool] ?? .persist
  }

  /// Select a recording annotation tool from the active modifier shortcut mode.
  /// `charactersIgnoringModifiers` is required because Control and Option can
  /// otherwise transform the character before it reaches the event handler.
  @discardableResult
  func selectTool(for event: NSEvent) -> Bool {
    guard isAnnotationEnabled, isShortcutModeActive else { return false }
    guard let character = (event.charactersIgnoringModifiers ?? event.characters)?
      .lowercased().first else { return false }
    guard let matchedTool = AnnotateShortcutManager.shared.tool(for: character),
          Self.availableTools.contains(matchedTool) else {
      return false
    }

    selectedTool = matchedTool
    return true
  }

  // MARK: - Annotation Management

  func appendAnnotation(_ item: AnnotationItem, tool: AnnotationToolType) {
    let entry = RecordingAnnotationEntry(
      id: item.id,
      item: item,
      createdAt: Date(),
      createdByTool: tool
    )
    annotations.append(entry)
    enforceCountLimit(for: tool)
  }

  func clearAll() {
    annotations.removeAll()
    selectedAnnotationId = nil
  }

  func deleteSelected() {
    guard let selectedId = selectedAnnotationId else { return }
    annotations.removeAll { $0.id == selectedId }
    selectedAnnotationId = nil
  }

  // MARK: - Cleanup Timer

  func startCleanupTimer() {
    cleanupTimer?.invalidate()
    cleanupTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
      MainActor.assumeIsolated {
        self?.removeExpired()
      }
    }
  }

  func stopCleanupTimer() {
    cleanupTimer?.invalidate()
    cleanupTimer = nil
  }

  // MARK: - Private Cleanup

  private func removeExpired() {
    let now = Date()
    var changed = false

    annotations = annotations.compactMap { entry in
      let mode = clearMode(for: entry.createdByTool)
      guard case .timeBased(let seconds) = mode else { return entry }

      let elapsed = now.timeIntervalSince(entry.createdAt)
      let fadeStart = seconds - 0.5  // Start fading 0.5s before removal

      if elapsed >= seconds {
        changed = true
        return nil  // Remove
      } else if elapsed >= fadeStart {
        var fading = entry
        fading.opacity = max(0, 1.0 - (elapsed - fadeStart) / 0.5)
        changed = true
        return fading
      }
      return entry
    }

    if changed {
      objectWillChange.send()
    }
  }

  private func enforceCountLimit(for tool: AnnotationToolType) {
    guard case .countBased(let maxCount) = clearMode(for: tool) else { return }

    let toolEntries = annotations.filter { $0.createdByTool == tool }
    guard toolEntries.count > maxCount else { return }

    let excess = toolEntries.count - maxCount
    let idsToRemove = Set(toolEntries.prefix(excess).map(\.id))
    annotations.removeAll { idsToRemove.contains($0.id) }
  }
}

```

### Core Architecture Module: `Snapzy/Features/VideoEditor/Components/VideoEditorEmptyStateView.swift`
```
//
//  VideoEditorEmptyStateView.swift
//  Snapzy
//
//  Empty state view with drag & drop zone for video editor
//

import SwiftUI
import UniformTypeIdentifiers

/// Empty state view displayed when no video is loaded.
///
/// Monochrome and quiet: the plain window background, one dashed drop card, and the
/// app's Liquid Glass buttons. Drag-over is the only state that changes the scene.
struct VideoEditorEmptyStateView: View {
  /// Callback with (workingURL, originalURL) - originalURL is the user's actual file for "Replace Original"
  var onVideoDropped: (URL, URL?) -> Void

  @State private var isTargeted = false
  @State private var showError = false
  @State private var errorMessage = ""

  private let supportedTypes: [UTType] = [.movie, .video, .quickTimeMovie, .mpeg4Movie, .gif]

  var body: some View {
    VStack(spacing: 0) {
      Spacer()

      dropZone

      Spacer()

      footer
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .onDrop(of: supportedTypes, isTargeted: $isTargeted) { providers in
      handleDrop(providers: providers)
    }
    .animation(.spring(response: 0.35, dampingFraction: 0.8), value: isTargeted)
    .alert(L10n.VideoEditor.invalidFileTitle, isPresented: $showError) {
      Button(L10n.Common.ok, role: .cancel) {}
    } message: {
      Text(errorMessage)
    }
  }

  // MARK: - Drop Zone

  private var dropZone: some View {
    VStack(spacing: Spacing.lg) {
      Image(systemName: "film")
        .font(.system(size: 44, weight: .light))
        .foregroundColor(isTargeted ? Color.primary.opacity(0.8) : .secondary)
        .scaleEffect(isTargeted ? 1.08 : 1)

      VStack(spacing: Spacing.xs) {
        Text(L10n.VideoEditor.dropVideoHereToEdit)
          .font(.system(size: 16, weight: .semibold))
          .foregroundColor(.primary)

        Text(L10n.VideoEditor.supportsVideoFormats)
          .font(.subheadline)
          .foregroundColor(.secondary)
      }

      LiquidGlassActionButton(
        title: L10n.VideoEditor.browseFiles,
        icon: "folder",
        emphasis: .secondary,
        action: { browseForVideo() }
      )
      .keyboardShortcut(.defaultAction)
    }
    .padding(.horizontal, Spacing.xl)
    .padding(.vertical, Spacing.lg)
    .frame(width: 420)
    .background(
      Radius.rect(Radius.panel)
        .fill(Color.primary.opacity(isTargeted ? 0.05 : 0.02))
    )
    .overlay(
      Radius.rect(Radius.panel).strokeBorder(
        Color.primary.opacity(isTargeted ? 0.45 : 0.15),
        style: StrokeStyle(lineWidth: isTargeted ? 2 : 1, dash: [6, 5])
      )
    )
    .contentShape(Radius.rect(Radius.panel))
    .onTapGesture {
      browseForVideo()
    }
    .onHover { hovering in
      if hovering {
        NSCursor.pointingHand.set()
      } else {
        NSCursor.arrow.set()
      }
    }
  }

  // MARK: - Footer

  private var footer: some View {
    HStack {
      Spacer()
      LiquidGlassActionButton(
        title: L10n.Common.cancel,
        emphasis: .secondary,
        action: { NSApp.keyWindow?.close() }
      )
      .keyboardShortcut(.cancelAction)
    }
    .padding(Spacing.md)
  }

  // MARK: - Drop Handling

  private func handleDrop(providers: [NSItemProvider]) -> Bool {
    guard let provider = providers.first else {
      DiagnosticLogger.shared.log(.warning, .editor, "Video editor drop skipped; provider missing")
      return false
    }

    DiagnosticLogger.shared.log(
      .info,
      .editor,
      "Video editor drop received",
      context: ["registeredTypeCount": "\(provider.registeredTypeIdentifiers.count)"]
    )

    // Find the first video type the provider can load
    guard let videoType = supportedTypes.first(where: {
      provider.hasItemConformingToTypeIdentifier($0.identifier)
    }) else {
      DiagnosticLogger.shared.log(.warning, .editor, "Video editor drop rejected; unsupported type")
      DispatchQueue.main.async {
        showError(message: L10n.VideoEditor.unsupportedFileType)
      }
      return false
    }

    DiagnosticLogger.shared.log(
      .debug,
      .editor,
      "Video editor drop loading file",
      context: ["type": videoType.identifier]
    )

    // First, extract the original URL using loadItem (provides actual file URL)
    provider.loadItem(forTypeIdentifier: videoType.identifier, options: nil) { item, error in
      if let error {
        DiagnosticLogger.shared.logError(
          .editor,
          error,
          "Video editor drop loadItem failed",
          context: ["type": videoType.identifier]
        )
        DispatchQueue.main.async {
          showError(message: L10n.VideoEditor.failedToLoadFile(error.localizedDescription))
        }
        return
      }

      // Extract original URL from the item
      let originalURL: URL?
      if let url = item as? URL {
        originalURL = url
        DiagnosticLogger.shared.log(
          .debug,
          .editor,
          "Video editor drop original URL resolved",
          context: ["source": "loadItem", "fileName": url.lastPathComponent]
        )
      } else if let data = item as? Data, let url = URL(dataRepresentation: data, relativeTo: nil) {
        originalURL = url
        DiagnosticLogger.shared.log(
          .debug,
          .editor,
          "Video editor drop original URL resolved",
          context: ["source": "data", "fileName": url.lastPathComponent]
        )
      } else {
        originalURL = nil
        DiagnosticLogger.shared.log(.debug, .editor, "Video editor drop original URL unavailable")
      }

      // Now load file representation to get a working copy
      _ = provider.loadFileRepresentation(forTypeIdentifier: videoType.identifier) { tempURL, repError in
        if let repError {
          DiagnosticLogger.shared.logError(
            .editor,
            repError,
            "Video editor drop file representation failed",
            context: ["type": videoType.identifier]
          )
          DispatchQueue.main.async {
            showError(message: L10n.VideoEditor.failedToLoadFile(repError.localizedDescription))
          }
          return
        }

        guard let tempURL else {
          DiagnosticLogger.shared.log(.warning, .editor, "Video editor drop file representation missing temp URL")
          DispatchQueue.main.async {
            showError(message: L10n.VideoEditor.couldNotReadFile)
          }
          return
        }

        // Copy temp file to a permanent location before it gets deleted
        let fileName = tempURL.lastPathComponent
        let destURL = FileManager.default.temporaryDirectory
          .appendingPathComponent("VideoEditor_\(UUID().uuidString)")
          .appendingPathComponent(fileName)

        do {
          try FileManager.default.createDirectory(
            at: destURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
          )
          try FileManager.default.copyItem(at: tempURL, to: destURL)
          DiagnosticLogger.shared.log(
            .info,
            .editor,
            "Video editor drop prepared working copy",
            context: [
              "fileName": destURL.lastPathComponent,
              "hasOriginalURL": originalURL == nil ? "false" : "true",
            ]
          )

          DispatchQueue.main.async {
            validateAndLoad(url: destURL, originalURL: originalURL)
          }
        } catch {
          DiagnosticLogger.shared.logError(
            .editor,
            error,
            "Video editor drop working copy failed",
            context: ["fileName": tempURL.lastPathComponent]
          )
          DispatchQueue.main.async {
            showError(message: L10n.VideoEditor.failedToPrepareFile(error.localizedDescription))
          }
        }
      }
    }

    return true
  }

  private func browseForVideo() {
    let panel = NSOpenPanel()
    panel.allowsMultipleSelection = false
    panel.canChooseDirectories = false
    panel.canChooseFiles = true
    panel.allowedContentTypes = supportedTypes

    panel.begin { response in
      if response == .OK, let url = panel.url {
        DiagnosticLogger.shared.log(
          .info,
          .editor,
          "Video editor browse selected file",
          context: ["fileName": url.lastPathComponent]
        )
        // Browse uses original file directly - pass same URL as both working and original
        validateAndLoad(url: url, originalURL: url)
      } else {
        DiagnosticLogger.shared.log(.debug, .editor, "Video editor browse cancelled")
      }
    }
  }

  private func validateAndLoad(url: URL, originalURL: URL? = nil) {
    // Validate file exists
    guard FileManager.default.fileExists(atPath: url.path) else {
      DiagnosticLogger.shared.log(
        .warning,
        .editor,
        "Video editor load rejected; file missing",
        context: ["fileName": url.lastPathComponent]
      )
      showError(message: L10n.VideoEditor.fileNotFound)
      return
    }

    // Validate it's a video or GIF file
    guard let type = try? url.resourceValues(forKeys: [.contentTypeKey]).contentType,
          type.conforms(to: .movie) || type.conforms(to: .video) || type.conforms(to: .gif) else {
      DiagnosticLogger.shared.log(
        .warning,
        .editor,
        "Video editor load rejected; invalid type",
        context: ["fileName": url.lastPathComponent]
      )
      showError(message: L10n.VideoEditor.selectValidVideoOrGIFFile)
      return
    }

    DiagnosticLogger.shared.log(
      .info,
      .editor,
      "Video editor loading file",
      context: ["fileName": url.lastPathComponent, "hasOriginalURL": originalURL == nil ? "false" : "true"]
    )
    onVideoDropped(url, originalURL)
  }

  private func showError(message: String) {
    errorMessage = message
    showError = true
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #627** (2026-10-02): **[Bug]: Could not capture web select dropdown options**
  *Symptoms*: ### Description  Using short keys or menubar action: cannot capture the options as it's always hid before capturing  ### Steps to Reproduce  1. Click to show dropdown options for a select field on web (chrome) 2. Take a screenshot  <img width="256" height="180" alt="Image" src="https://github.com/user-attachments/assets/a44b5f91-451f-47ee-b728-3c4cc6f8d706" />  ### Expected Behavior  Keep the options dropdown  ### Actual Behavior  Only the select field itself  ### Screenshots / Recordings  _No response_  ### Snapzy Version  2.0.0  ### macOS Version  Other (specify in description)  ### Installation Method  None  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > I would suggest enabling `Freeze screen` to solve this and many other "issues" when screenshotting (i.e. you want to screenshot exactly what you see in that moment, not what happens between you clicking "screenshot" and actually selecting the area)  <img width="775" height="292" alt="Image" src="https://github.com/user-attachments/assets/9637e8a4-59b5-4343-a24f-860df437cbb0" />
  > Yep that seems to work. Thank you
  > Thanks guys @antonio1475  @anhnt  really appreciate your efforts supporting me on these tickets, can't reply all issue now, too much 😂

- **Issue #592** (2026-09-23): **[Bug]: Mac OS27 区域截图文字描述 背景色无响应**
  *Symptoms*: ### Description  Mac OS27 环境下使用 区域截图后，添加文字描述的 背景色无响应  <img width="1410" height="1336" alt="Image" src="https://github.com/user-attachments/assets/58ea99be-1bd3-4b7b-8f95-408ac156cfba" />  ### Steps to Reproduce  1. Capture Markup 2. Add text 3.Setup background Color  ### Expected Behavior  Change the background color of text area, and can select the shape of area, just like annotate.  <img width="1730" height="100" alt="Image" src="https://github.com/user-attachments/assets/5d4e3775-1eaf-4436-82eb-b3a8e495271a" />  ### Actual Behavior  No background color effected, and no shape can be selected  ### Screenshots / Recordings  _No response_  ### Snapzy Version  1.32.1（190）  ### macOS Version  Other (specify in description)  ### Installation Method  DMG download  ### Additional Context  _No response_

- **Issue #585** (2026-09-19): **[Bug]: Screenshots of quicklook PDF preview are blank (show desktop behind).**
  *Symptoms*: ### Description  As title – quicklooking PDF files and screenshoting results in a capture of the desktop picture behind. Seems to happen with PDFs too Irrespective of full screen, custom area  If relevant, I have hide desktop icons and hide desktop widgets on.  I see the report for MacOS 27 beta but I am on 26.6.2 Snapzy 1.32.0  ### Steps to Reproduce  Snapzy open (from login, but have quit/reopened still happens) Space bar to quicklook item  Screenshot Quicklook item isn't capture/rendered in the screenshot - we just see what is behind (window or desktop)  ### Expected Behavior  Capture the quicklook window contents in screenshot  ### Actual Behavior  Captures whatever is behind  ### Screenshots / Recordings  _No response_  ### Snapzy Version  1.32.0  ### macOS Version  Other (specify in description)  ### Installation Method  DMG download  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report. We’re investigating the Quick Look PDF capture issue now, including why Snapzy captures the desktop behind the preview instead of the PDF content. We’ll trace the capture path and test a fix across the affected macOS versions.
  > Implemented in PR #588: https://github.com/duongductrong/Snapzy/pull/588  The fix restores Quick Look PDF pixels in filtered fullscreen and area captures by retaining the QuickLookUIService display crop before the capture overlay appears. The PR includes regression coverage and has been verified on macOS 26.6.2. It will be included in the next patch release. I’ll close this issue after the PR merges.
  > Release update: stable patch release PR #589 has merged and generated version v1.32.2, which includes the Quick Look PDF capture fix. The Release Publish workflow is now running; I’ll verify the published release before considering this fully shipped.

- **Issue #576** (2026-09-17): **[Bug]: 录屏过程中进入标注状态后，应用内部切换注释工具的快捷键不起作用**
  *Symptoms*: ### Description  The v1.32.0 version has resolved the issue #517  of global shortcut keys not working during screen recording and annotation. However, during screen recording and annotation, the internal shortcut keys of the annotation tool (non global shortcut keys of various tools) still do not work, and cannot switch between various annotation tools through shortcut keys. They can only be switched by clicking with the mouse. v1.32.0版本已解决录屏时标注功能全局快捷键不起作用的问题（#517），但在录屏并进行标注时，注释工具的内部快捷键（各种工具的非全局快捷键）仍然不起作用，无法通过快捷键切换各个注释工具，只能通过鼠标点击进行切换。  <img width="523" height="150" alt="Image" src="https://github.com/user-attachments/assets/2ebd8b3b-c182-4bef-a08f-0b1a387734da" />  ### Steps to Reproduce  1. Open Snapzy to perform screen recording normally;  1. 打开Snapzy正常进行屏幕录制；  2. During the screen recording process, enter the annotation state through the global shortcut key, for example, the shortcut key I set is Control B; 2. 录屏过程中通过全局快捷键进入标注状态，比如我设置的快捷键是Control B；  3. At this time, there will be various tools on the annotation toolbar. Hold down Shift to see the internal shortcut keys, but pressing the shortcut keys has no effect and is accompanied by an error prompt sound. You can only switch between various annotation tools by clicking with the mouse, which is very inconvenient. 3. 此时标注工具栏上会有各种工具，按住Shift即可看到内部快捷键，但是按快捷键不起任何作用，并伴有报错提示音，只能通过鼠标点击各个注释工具进行切换，非常不方便。  ### Expected Behavior  I hope to fix the bug where internal shortcut keys cannot be called and enable quick switching of annot

- **Issue #575** (2026-09-19): **[Bug]: macOS 27 使用截图钉在屏幕功能时，无法正常拖拽移动图片**
  *Symptoms*: ### Description  更新macOS27后出现，钉在屏幕后，可以正常缩放、锁定，但无法拖动位置。 最初未意识到是系统版本问题，尝试使用官方提供的脚本完全卸载并安装历史版本后仍无法拖动 最后用朋友的低系统版本mac测试可以正常拖动  ### Steps to Reproduce  **  ### Expected Behavior  **  ### Actual Behavior  **  ### Screenshots / Recordings  _No response_  ### Snapzy Version  1.32.0 and 1.30.1  ### macOS Version  Other (specify in description)  ### Installation Method  None  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > I ran into the same issue on macOS 27 and dug into it. Root cause: AppKit no longer initiates `isMovableByWindowBackground` drags when the window content is a SwiftUI `NSHostingView` (plain AppKit `NSView` content still drags fine, and overriding `mouseDownCanMoveWindow` doesn't help — verified with a minimal repro on macOS 27.0 build 26A428).  Opened #584 with a fix: a manual drag path in `QuickAccessPinWindow.sendEvent`, gated to macOS 27+. Tested locally — dragging works again, zoom/lock/drag-to-export unaffected, no warnings in the diagnostic log.
  > A fix for this issue has now been released in Snapzy. Please update to the latest version and help us verify it on macOS 27:  - Pin a screenshot and drag it from the image background. - Confirm that the pinned window follows the cursor normally. - Confirm that close, zoom, lock/unlock, and drag-to-export controls still work.  If the issue persists, please share your Snapzy version, macOS version/build, and a short screen recording. Thank you!

- **Issue #552** (2026-09-11): **[Bug]: Pop up of ‘Open history' will disappear when moving annotation**
  *Symptoms*: ### Description  My annotate window is on top of the screen and i need to check history image, but it's hidden behind the annotate, so i tried to move the annotate, history pop up disappeared.  Because i was trying to drag one of the history image to the annotate window to show as "picture in picture" but failed.  Would this also be one of the feature?  <img width="1709" height="1285" alt="Image" src="https://github.com/user-attachments/assets/395820b1-95e5-4e3d-a28f-ce919ac7a640" />  ### Steps to Reproduce  1. from menu bar "Open history" =>showing the pop up, no issue to choose and view all. 2. Open annotate window, and from menu bar "Open history" , moving the annotate windows( not matter if hidden behind or above the annotate), history pop up disappearing.   ### Expected Behavior  it should be closed either by the cross mark or hit esc.   ### Actual Behavior  history pop up is disappearing and can not he kept  ### Screenshots / Recordings  <img width="958" height="422" alt="Image" src="https://github.com/user-attachments/assets/a3ac7512-e32f-4557-8c56-d475e3203b33" />  ### Snapzy Version  1.32.0-beta5(178)  ### macOS Version  Other (specify in description)  ### Installation Method  DMG download  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Hi @OMGLee,  Thank you for reporting this issue and sharing your workflow!  ### What was happening 1. By default, the History Floating Panel auto-dismissed whenever it lost focus (`panelDidResignKey`), which occurred as soon as you clicked or dragged the Annotate window. 2. The Annotate window runs at an elevated window level (`floating + 1`), so the History panel (`floating`) was also hidden underneath it.  ### Solution implemented We have added a **Pin** feature to the History Floating Panel: - **Prevent auto-dismiss & stay on top**: When pinned, the panel will not close when you click, move, or focus other windows (such as Annotate). Its window level is elevated (`floating + 2`) so it remains visible above the Annotate editor. - **Picture-in-Picture drag & drop**: You can now comfortably drag any image card from the pinned History panel and drop it into the Annotate canvas to insert it as a picture-in-picture image layer. - **Keyboard shortcut**: Quickly toggle pin/unpin with **`⌘P`
  > @duongductrong thanks for the update, i'll update to the bete version and try.

- **Issue #551** (2026-09-07): **[Bug]:  zoom in/out simultaneously for all annotate windows**
  *Symptoms*: ### Description  Accidentally open tWo annotate windows and when zoom in,  window A and B window following same change simultaneously. Then I checked and it can reproduced. Mac OS: 26.6.2  ### Steps to Reproduce  1. Take a screenshot, then open the “Annotate” tool , now it's window A, zoom in and out, no issue;  2. follow step1 to have window B, zoom in and out, both window A and B following same animation; 3. follow step1 to have window C, zoom in and out, all windows A+B+C  following same animation;   ### Expected Behavior  separate control for each windows  ### Actual Behavior  all windows A+B+C  following same animation when zoom in and out   ### Screenshots / Recordings  <img width="957" height="410" alt="Image" src="https://github.com/user-attachments/assets/a4857292-059f-4159-aab0-8c30894e819d" />  ### Snapzy Version  1.32.0-beta.5(178)  ### macOS Version  Other (specify in description)  ### Installation Method  DMG download  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Hi @OMGLee,  Thank you for reporting this and providing such clear reproduction steps and screenshot!  I have identified the root cause: zoom gestures and shortcuts (trackpad pinch, ⌘ + scroll wheel, and ⌘+/⌘-/⌘0) currently broadcast notifications across the app via `NotificationCenter` without filtering by the specific active window. As a result, all open annotation canvas instances receive the event and adjust their zoom simultaneously.  I am working on a fix to properly scope zoom and navigation events to their respective window so each can be controlled independently. This will be included in an upcoming release soon!  Thanks again for helping improve Snapzy!

- **Issue #550** (2026-09-11): **[Bug]: Tabs Preferences and About persistent disabled if language is set to "System Default" as app language**
  *Symptoms*: ### Description  Tabs Preferences and About persistent disabled if language is set to "System Default" as app language   ### Steps to Reproduce  1. Start Snapzy 2. go to the Menu bar 3. click on Preferences 4. see screenshot  macOS Tahoe  ### Expected Behavior  available tabs  ### Actual Behavior  Tabs Preferences and About persistent disabled if language is set to "System Default" as app language  only if I switch to english as App language the tabs are reachable   ### Screenshots / Recordings  <img width="975" height="702" alt="Image" src="https://github.com/user-attachments/assets/bccea1d1-b9b8-404f-8fbe-323389755f57" />  ### Snapzy Version  1.31.0 (137)  ### macOS Version  Other (specify in description)  ### Installation Method  None  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Hi @Fischmuetze,  Thank you for reporting this issue with the detailed screenshot!  ### Root Cause In version `1.31.0`, Preferences was built using SwiftUI `TabView`, which renders tabs as horizontal items in the macOS window toolbar (`NSToolbar`). When the app language was set to "System Default" on a German system, German tab titles (e.g. *Allgemein*, *Menüleiste*, *Schnellzugriff*, *Verknüpfungen*, *Berechtigungen*) required more horizontal width than English.   Because the labels exceeded the toolbar width, macOS collapsed the remaining items (*Erweitert* and *Über*) into the toolbar overflow menu (`>>`). Due to a known macOS SwiftUI/AppKit `TabView` limitation, items pushed into the toolbar overflow popup menu became persistently disabled/unclickable. When switching the app language to English, the shorter titles fit into the window width without overflowing, which made all tabs clickable.  ### Resolution This has been resolved by completely redesigning the Preferences window into
  > Works perfect! Thank you!

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & Real Production Code Patches
Observed empirical fixes and code patches:

### Incident Patch 1: `32441ab7` (2026-09-28)
**Commit Message**: BREAKING CHANGE: Apply Liquid Glass Beta (#574)

* feat: Added Liquid Glass design system with dual-path architecture

- Introduce 4-layer optical composite (substrate, refraction, tint,
  specular hairline) for macOS 13–15
- Support native Apple Liquid Glass APIs on macOS 26+ with automatic
  fallback
- Add LiquidGlassButton, LiquidGlassActionButton,
  LiquidGlassSegmentedControl, LiquidGlassActionBar components
- Add LiquidGlassSurface, LiquidGlassContainer,
  LiquidGlassControlChrome, LiquidGlassWindowBackdrop view modifiers
- Update Annotate toolbar, bottom bar, and quick properties bar to use
  glass treatment
- Add LiquidGlassTokens with adaptive ink colors for Light/Dark
  appearance support
- Add comprehensive tests for capability gating and appearance
  adaptation
- Document architecture in docs/LIQUID_GLASS.md

* feat: Improved toolbar and overlay controls to Liquid Glass chrome

- Remove `.glass` treatment option from ToolbarButton; glass is now the
  default
- Add LiquidGlassChromeEmphasis for standard vs overlay chrome contexts
- Add ink tokens for tint-aware rendering (inkOverlay, inkOnAccent,
  ink(onTint:))
- Update QuickAccess and Recording controls to use .liquidG

**File**: `.github/workflows/ci.yml` (modified, +12/-2)
```diff
@@ -2,9 +2,9 @@ name: CI Build Check
 
 on:
   push:
-    branches: [master]
+    branches: [master, beta]
   pull_request:
-    branches: [master]
+    branches: [master, beta]
 
 concurrency:
   group: ci-${{ github.ref }}
@@ -34,6 +34,8 @@ jobs:
         env:
           # The following tests crash on GitHub Actions macOS runners (Swift concurrency /
           # headless CGS), so they are skipped in CI and run locally instead.
+          # The timeline suites also abort intermittently on the headless runner with a
+          # malloc error; they remain covered by local CI.
           SNAPZY_CI_SKIP_TESTS: |
             SnapzyTests/GoogleDriveTests
             SnapzyTests/DatabaseManagerTests
@@ -53,7 +55,11 @@ jobs:
             SnapzyTests/SandboxOffDataMigrationServiceTests
             SnapzyTests/AppStatusBarControllerTests
             SnapzyTests/RecordingAudioLevelMeterTests
+            SnapzyTests/RecordingToolbarInteractionTests/testRecordButton_dispatchesFromPaddedSurface
             SnapzyTests/RecordingToolbarWindowTests/testShowRecordingStatusBar_alreadyVisibleWindow_enablesBackgroundDragging
+            SnapzyTests/RecordingToolbarWindowTests/testShowRecordingStatusBar_reportsAnnotateButtonCenterInHostingWindow
+            SnapzyTests/RecordingToolbarWindowTests/testAnnotationPopover_centersOnReportedAnnotateButton
+            SnapzyTests/S3MultipartUploaderTests/testMultipartUpload_abortsOnFailure
             SnapzyTests/CaptureViewModelTests/testHiddenWindowSession_restore_postsSyntheticMouseMovedEvent
             SnapzyTests/AnnotateCreationTests/testCanExtractTextRequiresNormalAnnotateSourceImage
             SnapzyTests/AnnotateExportSaveTests/testCopyToClipboardRunsWithoutCrashing
@@ -80,6 +86,10 @@ jobs:
             SnapzyTests/HotkeyUnregistrationTests
             SnapzyTests/RecordingSessionShortcutGatingTests
             SnapzyTests/RecordingSessionHotkeyRegistrationTests
+            SnapzyTests/SnapzyOnboardingStateTests/testStep2ScreenRecordingWorkflow
+            SnapzyTests/VideoEditorSessionStoreTests/testEditorHostingReplay_preservesFinalZoomAndSpeedValues
+            SnapzyTests/VideoEditorTimelineViewportTests
+            SnapzyTests/VideoEditorTimelineScrollCatcherTests
         run: |
           set -euo pipefail
           mkdir -p build
```

**File**: `.github/workflows/release-prepare.yml` (modified, +50/-12)
```diff
@@ -21,7 +21,7 @@ on:
           - beta
 
   push:
-    branches: [master]
+    branches: [master, beta]
 
 concurrency:
   group: release-prepare-${{ github.ref }}
@@ -34,23 +34,55 @@ jobs:
       should_release: ${{ steps.check.outputs.should_release }}
       version_type: ${{ steps.check.outputs.version_type }}
       channel: ${{ steps.check.outputs.channel }}
+      target_branch: ${{ steps.check.outputs.target_branch }}
     steps:
       - name: Determine if release should run
         id: check
         env:
+          BRANCH_NAME: ${{ github.ref_name }}
           COMMIT_MSG: ${{ github.event.head_commit.message }}
+          EVENT_NAME: ${{ github.event_name }}
+          INPUT_CHANNEL: ${{ inputs.channel }}
+          INPUT_VERSION_TYPE: ${{ inputs.version_type }}
         run: |
-          if [ "${{ github.event_name }}" = "workflow_dispatch" ]; then
+          set -euo pipefail
+
+          case "$BRANCH_NAME" in
+            master)
+              EXPECTED_CHANNEL=stable
+              ;;
+            beta)
+              EXPECTED_CHANNEL=beta
+              ;;
+            *)
+              echo "::error::Release preparation must run from master or beta, got '$BRANCH_NAME'"
+              exit 1
+              ;;
+          esac
+
+          echo "target_branch=$BRANCH_NAME" >> "$GITHUB_OUTPUT"
+
+          if [ "$EVENT_NAME" = "workflow_dispatch" ]; then
+            if [ "$INPUT_CHANNEL" != "$EXPECTED_CHANNEL" ]; then
+              echo "::error::The $BRANCH_NAME branch only accepts the $EXPECTED_CHANNEL release channel, got '$INPUT_CHANNEL'"
+              exit 1
+            fi
             echo "should_release=true" >> "$GITHUB_OUTPUT"
-            echo "version_type=${{ inputs.version_type }}" >> "$GITHUB_OUTPUT"
-            echo "channel=${{ inputs.channel || 'stable' }}" >> "$GITHUB_OUTPUT"
-          elif [ "${{ github.event_name }}" = "push" ]; then
-            if printf '%s\n' "$COMMIT_MSG" | grep -qE "^release\((patch|minor|major)(-beta)?\):"; then
-              TYPE=$(printf '%s\n' "$COMMIT_MSG" | sed -nE 's/^release\((patch|minor|major)(-beta)?\):.*/\1/p' | head -n 1)
+            echo "version_type=$INPUT_VERSION_TYPE" >> "$GITHUB_OUTPUT"
+            echo "channel=$INPUT_CHANNEL" >> "$GITHUB_OUTPUT"
+          elif [ "$EVENT_NAME" = "push" ]; then
+            if [ "$BRANCH_NAME" = "beta" ]; then
+              RELEASE_PATTERN='^release\((patch|minor|major)-beta\):'
+              TYPE_PATTERN='^release\((patch|minor|major)-beta\):.*'
+              CHANNEL=beta
+            else
+              RELEASE_PATTERN='^release\((patch|minor|major)\):'
+              TYPE_PATTERN='^release\((patch|minor|major)\):.*'
               CHANNEL=stable
-              if printf '%s\n' "$COMMIT_MSG" | grep -qE "^release\((patch|minor|major)-beta\):"; then
-                CHANNEL=beta
-              fi
+            fi
+
+            if printf '%s\n' "$COMMIT_MSG" | grep -qE "$RELEASE_PATTERN"; then
+              TYPE=$(printf '%s\n' "$COMMIT_MSG" | sed -nE "s/$TYPE_PATTERN/\\1/p" | head -n 1)
               echo "should_release=true" >> "$GITHUB_OUTPUT"
               echo "version_type=$TYPE" >> "$GITHUB_OUTPUT"
               echo "channel=$CHANNEL" >> "$GITHUB_OUTPUT"
@@ -59,6 +91,10 @@ jobs:
               echo "version_type=" >> "$GITHUB_OUTPUT"
               echo "channel=" >> "$GITHUB_OUTPUT"
             fi
+          else
+            echo "should_release=false" >> "$GITHUB_OUTPUT"
+            echo "version_type=" >> "$GITHUB_OUTPUT"
+            echo "channel=" >> "$GITHUB_OUTPUT"
           fi
 
   prepare:
@@ -75,6 +111,7 @@ jobs:
         uses: actions/checkout@v7
         with:
           fetch-depth: 0
+          ref: ${{ github.ref_name }}
           token: ${{ secrets.GITHUB_TOKEN }}
 
       - name: Bump version
@@ -131,6 +168,7 @@ jobs:
         run: |
           VERSION="v${{ steps.version.outputs.version }}"
           BRANCH="release/${VERSION}"
+          TARGET_BRANCH="${{ needs.check-release-trigger.outputs.target_branch }}"
 
           git config user.name "github-actions[bot]"
           git config user.email "github-actions[bot]@users.noreply.github.com"
@@ -152,15 +190,15 @@ jobs:
           } > build/pr-body.md
 
           # Create PR (or update if already exists)
-          EXISTING_PR=$(gh pr list --head "$BRANCH" --json number --jq '.[0].number' 2>/dev/null || true)
+          EXISTING_PR=$(gh pr list --head "$BRANCH" --base "$TARGET_BRANCH" --json number --jq '.[0].number' 2>/dev/null || true)
           if [ -n "$EXISTING_PR" ]; then
             gh pr edit "$EXISTING_PR" \
               --title "chore: release ${VERSION}" \
               --body-file build/pr-body.md
             echo "Updated existing PR #${EXISTING_PR}"
           else
             gh pr create \
-              --base master \
+              --base "$TARGET_BRANCH" \
               --head "$BRANCH" \
               --title "chore: release ${VERSION}" \
               --body-file
```

**File**: `.github/workflows/release-publish.yml` (modified, +82/-16)
```diff
@@ -3,7 +3,7 @@ name: Release Publish
 on:
   pull_request:
     types: [closed]
-    branches: [master]
+    branches: [master, beta]
 
 concurrency:
   group: release-publish
@@ -30,22 +30,47 @@ jobs:
     steps:
       - name: Extract version
         id: version
+        env:
+          RELEASE_BRANCH: ${{ github.event.pull_request.head.ref }}
+          TARGET_BRANCH: ${{ github.event.pull_request.base.ref }}
         run: |
-          BRANCH="${{ github.event.pull_request.head.ref }}"
-          VERSION="${BRANCH#release/v}"
-          echo "version=$VERSION" >> "$GITHUB_OUTPUT"
-          if [[ "$VERSION" == *-* ]]; then
-            echo "is_beta=true" >> "$GITHUB_OUTPUT"
-          else
-            echo "is_beta=false" >> "$GITHUB_OUTPUT"
+          set -euo pipefail
+
+          VERSION="${RELEASE_BRANCH#release/v}"
+          if [ "$VERSION" = "$RELEASE_BRANCH" ] || [ -z "$VERSION" ]; then
+            echo "::error::Could not extract a release version from '$RELEASE_BRANCH'"
+            exit 1
           fi
-          echo "Release version: v${VERSION}"
+
+          echo "version=$VERSION" >> "$GITHUB_OUTPUT"
+          case "$VERSION" in
+            *-beta.[0-9]*)
+              IS_BETA=true
+              ;;
+            *)
+              IS_BETA=false
+              ;;
+          esac
+          echo "is_beta=$IS_BETA" >> "$GITHUB_OUTPUT"
+          echo "target_branch=$TARGET_BRANCH" >> "$GITHUB_OUTPUT"
+
+          case "$TARGET_BRANCH:$IS_BETA" in
+            master:false|beta:true)
+              ;;
+            *)
+              echo "::error::Release channel does not match target branch: v${VERSION} -> ${TARGET_BRANCH}"
+              echo "::error::Stable releases must target master; beta releases must target beta."
+              exit 1
+              ;;
+          esac
+
+          echo "Release version: v${VERSION} (${TARGET_BRANCH} channel)"
 
       - name: Checkout
         uses: actions/checkout@v7
         with:
           fetch-depth: 0
-          ref: master
+          ref: ${{ github.event.pull_request.merge_commit_sha }}
           token: ${{ secrets.GITHUB_TOKEN }}
 
       - name: Extract changelog
@@ -612,13 +637,19 @@ jobs:
           ED_SIGNATURE: ${{ steps.sparkle_sign.outputs.signature }}
           RELEASE_NOTES_PATH: ${{ steps.release_notes.outputs.release_notes_path }}
           CHANNEL: ${{ steps.version.outputs.is_beta == 'true' && 'beta' || '' }}
+          TARGET_BRANCH: ${{ steps.version.outputs.target_branch }}
         run: |
           set -euo pipefail
           DMG_PATH="${dmg_path:?dmg_path is not set}"
           if [ -z "$ED_SIGNATURE" ]; then
             echo "::error::ED_SIGNATURE is empty — refusing to publish. The app sets SUPublicEDKey, so an appcast item without an EdDSA signature would be rejected by all clients."
             exit 1
           fi
+          if [ "$TARGET_BRANCH" = "beta" ]; then
+            # appcast.xml is served from master for both stable and opted-in beta clients.
+            git fetch origin master --no-tags
+            git show origin/master:appcast.xml > appcast.xml
+          fi
           RELEASE_NOTES_HTML="$(cat "$RELEASE_NOTES_PATH")"
           chmod +x scripts/update-appcast.sh
           ./scripts/update-appcast.sh \
@@ -652,18 +683,53 @@ jobs:
             "${{ steps.version.outputs.version }}" \
             "${{ steps.build.outputs.number }}"
 
-      - name: Commit appcast and cask update
+      - name: Commit release metadata
+        env:
+          TARGET_BRANCH: ${{ steps.version.outputs.target_branch }}
+          MERGE_SHA: ${{ github.event.pull_request.merge_commit_sha }}
+          IS_BETA: ${{ steps.version.outputs.is_beta }}
+          VERSION: ${{ steps.version.outputs.version }}
         run: |
+          set -euo pipefail
           git config user.name "github-actions[bot]"
           git config user.email "github-actions[bot]@users.noreply.github.com"
+          # The build ran from the exact release merge commit. Attach the
+          # metadata commit to the PR target branch before pushing it.
+          git checkout -B "$TARGET_BRANCH" "$MERGE_SHA"
           git add appcast.xml Casks/snapzy.rb README.md docs/*.md
           if git diff --cached --quiet; then
             echo "No appcast/cask/readme/docs changes to commit"
-            exit 0
+          else
+            if [ "$IS_BETA" = "true" ]; then
+              git commit -m "chore: update appcast and docs for v${VERSION}"
+            else
+              git commit -m "chore: update appcast, cask, readme, and docs for v${VERSION}"
+            fi
+            git push origin "HEAD:$TARGET_BRANCH"
           fi
-          if [ "${{ steps.version.outputs.is_beta }}" = "true" ]; then
-            git commit -m "chore: update appcast and docs for v${{ steps.version.outputs.version }}"
+
+      - name: Sync beta appcast to stable feed
+        if: steps.version.outputs.is_beta == 'true'
+        env:
+          VERSION: ${{ st
```

**File**: `.github/workflows/swiftformat.yml` (modified, +2/-2)
```diff
@@ -2,9 +2,9 @@ name: SwiftFormat Validation
 
 on:
   push:
-    branches: [ master ]
+    branches: [ master, beta ]
   pull_request:
-    branches: [ master ]
+    branches: [ master, beta ]
 
 concurrency:
   group: swiftformat-${{ github.ref }}
```

**File**: `.gitignore` (modified, +2/-0)
```diff
@@ -17,3 +17,5 @@ Snapzy/Config/Secrets.xcconfig
 /plans
 
 .codex
+
+.dd
```

**File**: `CONTEXT.md` (added, +41/-0)
```diff
@@ -0,0 +1,41 @@
+# Capture Editing Context
+
+This context describes how captured media moves between Quick Access and an editor while its file ownership remains clear.
+
+## Language
+
+**Capture**:
+A screenshot, video, or GIF produced by Snapzy and shown through the capture lifecycle.
+_Avoid_: asset, document
+
+**Quick Access card**:
+A transient representation of a capture that provides immediate actions such as edit, copy, and save.
+_Avoid_: editor session, file browser
+
+**Editing session**:
+The in-progress changes for one capture before the user commits or discards them.
+_Avoid_: window state, draft file
+
+**Temporary capture**:
+A capture kept under Snapzy's temporary ownership until the user chooses its persistent destination.
+_Avoid_: unsaved file, cache
+
+**Export destination**:
+The persistent user-selected location where a capture is stored after leaving temporary ownership.
+_Avoid_: source file, temp path
+
+**Editor commit**:
+Applying the current editing session to the capture's current file without changing its ownership or destination.
+_Avoid_: export, promote
+
+**Edit recipe**:
+The persisted video-editor instructions—ordered clips, trims, zoom, speed, and export context—that can be reopened and changed again.
+_Avoid_: rendered output, baked file
+
+**Source snapshot**:
+A private copy of the unrendered video source kept so later editor commits can reapply the edit recipe without stacking edits on a rendered file.
+_Avoid_: destination, preview
+
+**Promotion**:
+Moving a temporary capture into its export destination and ending temporary ownership.
+_Avoid_: editor save, commit
```

**File**: `Snapzy.xcodeproj/project.pbxproj` (modified, +2/-1)
```diff
@@ -233,10 +233,11 @@
 			outputFileListPaths = (
 			);
 			outputPaths = (
+				"$(DERIVED_FILE_DIR)/SwiftFormat.disabled.stamp",
 			);
 			runOnlyForDeploymentPostprocessing = 0;
 			shellPath = /bin/sh;
-			shellScript = "if which swiftformat >/dev/null; then\n  # swiftformat \"${SRCROOT}/Snapzy\" \"${SRCROOT}/SnapzyTests\"\n  echo \"SwiftFormat is configured but disabled by default.\"\nelse\n  echo \"warning: SwiftFormat not installed. Install via 'brew install swiftformat'.\"\nfi\n";
+			shellScript = "if which swiftformat >/dev/null; then\n  # swiftformat \"${SRCROOT}/Snapzy\" \"${SRCROOT}/SnapzyTests\"\n  echo \"SwiftFormat is configured but disabled by default.\"\nelse\n  echo \"SwiftFormat is not installed; formatting remains disabled.\"\nfi\ntouch \"$SCRIPT_OUTPUT_FILE_0\"\n";
 		};
 /* End PBXShellScriptBuildPhase section */
 
```

**File**: `Snapzy/App/AppStatusBarController.swift` (modified, +46/-0)
```diff
@@ -461,6 +461,33 @@ final class AppStatusBarController: ObservableObject {
     prefsItem.isEnabled = true
     menu?.addItem(prefsItem)
 
+    #if DEBUG
+    // Liquid Glass Playground
+    let playgroundItem = NSMenuItem(
+      title: "Liquid Glass Playground",
+      action: #selector(openLiquidGlassPlaygroundAction),
+      keyEquivalent: ""
+    )
+    playgroundItem.target = self
+    playgroundItem.image = NSImage(systemSymbolName: "slider.horizontal.below.square.and.square.filled", accessibilityDescription: nil)
+    playgroundItem.isEnabled = true
+    menu?.addItem(playgroundItem)
+    #endif
+
+    // Replay onboarding — keep this as the last action before the final separator/Quit item.
+    let replayOnboardingItem = NSMenuItem(
+      title: L10n.PreferencesGeneral.restartOnboardingTitle,
+      action: #selector(replayOnboardingAction),
+      keyEquivalent: ""
+    )
+    replayOnboardingItem.target = self
+    replayOnboardingItem.image = NSImage(
+      systemSymbolName: "arrow.counterclockwise.circle",
+      accessibilityDescription: nil
+    )
+    replayOnboardingItem.isEnabled = true
+    menu?.addItem(replayOnboardingItem)
+
     menu?.addItem(NSMenuItem.separator())
 
     // Quit
@@ -878,6 +905,25 @@ final class AppStatusBarController: ObservableObject {
     openPreferencesWindow()
   }
 
+  @objc private func replayOnboardingAction() {
+    logMenuAction("replayOnboarding")
+    OnboardingFlowView.resetOnboarding()
+    SnapzyOnboardingWindowController.shared.close()
+    PreferencesWindowController.shared.close()
+
+    // Let the status-bar menu finish dismissing before presenting the onboarding window.
+    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
+      NotificationCenter.default.post(name: .showOnboarding, object: nil)
+    }
+  }
+
+  #if DEBUG
+  @objc private func openLiquidGlassPlaygroundAction() {
+    logMenuAction("openLiquidGlassPlayground")
+    LiquidGlassPlaygroundWindowController.shared.show()
+  }
+  #endif
+
   func openPreferencesWindow(tab: PreferencesTab? = nil) {
     if let tab {
       PreferencesNavigationState.shared.select(tab)
```

---

### Incident Patch 2: `e3055542` (2026-09-25)
**Commit Message**: fix: Fixed reset delayed capture countdown on restore defaults (#613)

**File**: `Snapzy/Services/Configuration/SnapzyConfigurationDefaultDocument.swift` (modified, +1/-0)
```diff
@@ -60,6 +60,7 @@ enum SnapzyConfigurationDefaultDocument {
     writer.value("include_snapzy", false)
     writer.value("show_cursor", false)
     writer.value("freeze_area", false)
+    writer.value("delayed_capture_seconds", CaptureDelayOption.defaultValue.seconds)
     writer.value("show_selection_area_overlay", true)
     writer.value("reverse_magnifier_zoom_direction", false)
 
```

**File**: `SnapzyTests/Services/Configuration/SnapzyConfigurationImporterTests.swift` (modified, +11/-0)
```diff
@@ -10,6 +10,17 @@ import XCTest
 
 @MainActor
 final class SnapzyConfigurationImporterTests: XCTestCase {
+  func testImportingDefaultDocumentResetsDelayedCaptureCountdown() {
+    let defaults = UserDefaultsFactory.make()
+    defaults.set(10, forKey: PreferencesKeys.screenshotDelayedCaptureSeconds)
+
+    let source = SnapzyConfigurationDefaultDocument.toml()
+    let result = SnapzyConfigurationImporter.importTOML(source, defaults: defaults)
+
+    XCTAssertFalse(result.hasErrors)
+    XCTAssertEqual(defaults.integer(forKey: PreferencesKeys.screenshotDelayedCaptureSeconds), 3)
+  }
+
   func testImportAppliesCaptureAndRecordingSettingsToProvidedDefaults() {
     let defaults = UserDefaultsFactory.make()
     let source = """
```

---

### Incident Patch 3: `c11cb39c` (2026-09-23)
**Commit Message**: fix: Fixed text background color by promoting plain text to label (#594)

* fix: promote plain text to label when a background fill is picked

The text background fill only renders for label/callout presentations,
but every background color control (sidebar grid, quick properties bar,
inline area annotate bar) wrote fillColor without leaving .plain. The
color was stored yet never drawn, so picking a background appeared to do
nothing (issue #592).

Promote textPresentation to .label when a non-clear fill is applied to
plain text, in both per-annotation updates and default tool properties.
Also add the missing text presentation switch (plain/label/callout) to
the inline area annotate properties bar.

Co-authored-by: Kimi

* fix: persist promoted text presentation and promote on same-fill selection

Address review feedback on PR #594:

- PersistedAnnotationProperties now stores textPresentation as an
  optional field, so a promoted .label default survives relaunch
  instead of falling back to .plain with a restored fill.
- setTextPresentation writes through to persisted tool defaults when
  no text is selected.
- updateAnnotationProperties treats a same-value non-clear fill as a
  cha

**File**: `Snapzy/Features/Annotate/AnnotateState.swift` (modified, +32/-2)
```diff
@@ -108,6 +108,7 @@ final class AnnotateState: ObservableObject {
     var opacity: CGFloat
     var rotationDegrees: CGFloat
     var watermarkStyle: String
+    var textPresentation: String?
     var spotlightOpacity: CGFloat?
     var lineStyle: String?
 
@@ -126,6 +127,7 @@ final class AnnotateState: ObservableObject {
       self.opacity = properties.opacity
       self.rotationDegrees = properties.rotationDegrees
       self.watermarkStyle = properties.watermarkStyle.rawValue
+      self.textPresentation = properties.textPresentation.rawValue
       self.spotlightOpacity = properties.spotlightOpacity
       self.lineStyle = properties.lineStyle.rawValue
     }
@@ -142,7 +144,8 @@ final class AnnotateState: ObservableObject {
         opacity: opacity,
         rotationDegrees: rotationDegrees,
         watermarkStyle: WatermarkStyle(rawValue: watermarkStyle) ?? .single,
-        spotlightOpacity: spotlightOpacity ?? 0.5
+        spotlightOpacity: spotlightOpacity ?? 0.5,
+        textPresentation: textPresentation.flatMap { TextPresentation(rawValue: $0) } ?? .plain
       )
     }
   }
@@ -3694,6 +3697,19 @@ final class AnnotateState: ObservableObject {
       fillColor: fillColor
     )
 
+    // Re-selecting the current fill still matters for plain text: the
+    // promotion below is what makes the fill visible, so an equal fill value
+    // does not mean this update is a no-op.
+    let fillPromotesTextPresentation: Bool = {
+      guard let fillColor = colorUpdate.fillColor,
+            fillColor != .clear,
+            case .text = annotations[index].type,
+            annotations[index].properties.textPresentation == .plain else {
+        return false
+      }
+      return true
+    }()
+
     guard annotationPropertiesWillChange(
       annotations[index],
       strokeWidth: strokeWidth,
@@ -3706,7 +3722,7 @@ final class AnnotateState: ObservableObject {
       watermarkStyle: watermarkStyle,
       spotlightOpacity: spotlightOpacity,
       lineStyle: lineStyle
-    ) else { return }
+    ) || fillPromotesTextPresentation else { return }
 
     if recordsUndo {
       if let snapshot = propertySliderGestureUndoSnapshot {
@@ -3748,6 +3764,13 @@ final class AnnotateState: ObservableObject {
     }
     if let fillColor = colorUpdate.fillColor {
       annotations[index].properties.fillColor = fillColor
+      // The background fill only renders for label/callout presentations, so a
+      // colored fill on plain text would stay invisible. Promote it to a label.
+      if case .text = annotations[index].type,
+         fillColor != .clear,
+         annotations[index].properties.textPresentation == .plain {
+        annotations[index].properties.textPresentation = .label
+      }
     }
     if let cornerRadius = cornerRadius {
       annotations[index].properties.cornerRadius = max(0, cornerRadius)
@@ -4659,6 +4682,12 @@ final class AnnotateState: ObservableObject {
         properties.fillColor = fillColor
       }
     }
+    if tool == .text,
+       let fillColor = fillColor,
+       fillColor != .clear,
+       properties.textPresentation == .plain {
+      properties.textPresentation = .label
+    }
     if let cornerRadius = cornerRadius {
       properties.cornerRadius = max(0, cornerRadius)
     }
@@ -5017,6 +5046,7 @@ final class AnnotateState: ObservableObject {
         properties.fillColor = .black
       }
       annotationToolProperties[.text] = properties
+      persistAnnotationToolProperties()
       return
     }
 
```

**File**: `Snapzy/Features/Annotate/InlineAreaAnnotateWindow.swift` (modified, +11/-0)
```diff
@@ -1878,6 +1878,17 @@ private struct InlineAreaPropertiesBar: View {
           }
 
           if state.quickPropertiesSupportsTextBackground {
+            InlineAreaSegmentedPicker(
+              title: L10n.AnnotateUI.textStyle,
+              items: TextPresentation.allCases,
+              selection: Binding(
+                get: { state.quickTextPresentation },
+                set: { state.setTextPresentation($0) }
+              ),
+              icon: { $0.icon },
+              tooltip: \.helpText
+            )
+
             InlineAreaColorControl(
               title: L10n.Common.background,
               selectedColor: state.quickTextBackgroundBinding,
```

**File**: `SnapzyTests/Features/Annotate/AnnotateTextEditingTests.swift` (modified, +133/-0)
```diff
@@ -27,6 +27,12 @@ final class AnnotateTextEditingTests: XCTestCase {
     return state
   }
 
+  private func makeAnnotateState(defaults: UserDefaults) -> AnnotateState {
+    let state = AnnotateState(defaults: defaults)
+    Self.retainedAnnotateStates.append(state)
+    return state
+  }
+
   private func makeTextAnnotation(_ text: String) -> AnnotationItem {
     AnnotationItem(
       type: .text(text),
@@ -35,6 +41,13 @@ final class AnnotateTextEditingTests: XCTestCase {
     )
   }
 
+  /// Color equality is not stable across a persistence round-trip (the stored
+  /// color comes back with a named sRGB colorspace), so compare components.
+  private func rgbaComponents(_ color: Color) -> (r: CGFloat, g: CGFloat, b: CGFloat, a: CGFloat) {
+    let nsColor = NSColor(color).usingColorSpace(.sRGB) ?? NSColor(color)
+    return (nsColor.redComponent, nsColor.greenComponent, nsColor.blueComponent, nsColor.alphaComponent)
+  }
+
   func testBeginTextEditingSetsEditingTargetId() {
     let state = makeAnnotateState()
     let annotation = makeTextAnnotation("Hello")
@@ -209,6 +222,126 @@ final class AnnotateTextEditingTests: XCTestCase {
     XCTAssertEqual(updated.properties.fillColor, .black)
   }
 
+  func testBackgroundFillPromotesPlainTextToLabelPresentation() throws {
+    let state = makeAnnotateState()
+    let annotation = makeTextAnnotation("Hello")
+    state.annotations = [annotation]
+    state.selectedAnnotationId = annotation.id
+    state.selectedTool = .text
+
+    state.updateAnnotationProperties(id: annotation.id, fillColor: .yellow)
+
+    let updated = try XCTUnwrap(state.annotations.first)
+    XCTAssertEqual(updated.properties.fillColor, .yellow)
+    XCTAssertEqual(updated.properties.textPresentation, .label)
+  }
+
+  func testBackgroundFillKeepsNonPlainPresentationUnchanged() throws {
+    let state = makeAnnotateState()
+    let annotation = AnnotationItem(
+      type: .text("Hello"),
+      bounds: CGRect(x: 20, y: 20, width: 140, height: 32),
+      properties: AnnotationProperties(fontSize: 18, textPresentation: .callout)
+    )
+    state.annotations = [annotation]
+    state.selectedAnnotationId = annotation.id
+    state.selectedTool = .text
+
+    state.updateAnnotationProperties(id: annotation.id, fillColor: .yellow)
+
+    let updated = try XCTUnwrap(state.annotations.first)
+    XCTAssertEqual(updated.properties.fillColor, .yellow)
+    XCTAssertEqual(updated.properties.textPresentation, .callout)
+  }
+
+  func testClearBackgroundLeavesPlainPresentationUnchanged() throws {
+    let state = makeAnnotateState()
+    let annotation = makeTextAnnotation("Hello")
+    state.annotations = [annotation]
+    state.selectedAnnotationId = annotation.id
+    state.selectedTool = .text
+
+    state.updateAnnotationProperties(id: annotation.id, fillColor: .clear)
+
+    let updated = try XCTUnwrap(state.annotations.first)
+    XCTAssertEqual(updated.properties.textPresentation, .plain)
+  }
+
+  func testQuickTextBackgroundPromotesSelectedPlainText() throws {
+    let state = makeAnnotateState()
+    let annotation = makeTextAnnotation("Hello")
+    state.annotations = [annotation]
+    state.selectedAnnotationId = annotation.id
+    state.selectedTool = .text
+
+    state.quickTextBackgroundBinding.wrappedValue = .yellow
+
+    let updated = try XCTUnwrap(state.annotations.first)
+    XCTAssertEqual(updated.properties.fillColor, .yellow)
+    XCTAssertEqual(updated.properties.textPresentation, .label)
+  }
+
+  func testQuickTextBackgroundPromotesDefaultPlainPresentation() {
+    let state = makeAnnotateState()
+    state.selectedTool = .text
+
+    state.quickTextBackgroundBinding.wrappedValue = .yellow
+
+    XCTAssertEqual(state.quickTextPresentation, .label)
+  }
+
+  func testSameFillSelectionPromotesPlainTextAfterPresentationReset() throws {
+    let state = makeAnnotateState()
+    let annotation = makeTextAnnotation("Hello")
+    state.annotations = [annotation]
+    state.selectedAnnotationId = annotation.id
+    state.selectedTool = .text
+
+    state.updateAnnotationProperties(id: annotation.id, fillColor: .yellow)
+    state.setTextPresentation(.plain)
+
+    var updated = try XCTUnwrap(state.annotations.first)
+    XCTAssertEqual(updated.properties.fillColor, .yellow)
+    XCTAssertEqual(updated.properties.textPresentation, .plain)
+
+    state.updateAnnotationProperties(id: annotation.id, fillColor: .yellow)
+
+    updated = try XCTUnwrap(state.annotations.first)
+    XCTAssertEqual(updated.properties.fillColor, .yellow)
+    XCTAssertEqual(updated.properties.textPresentation, .label)
+  }
+
+  func testPromotedTextPresentationPersistsAcrossStateReload() {
+    let defaults = UserDefaultsFactory.make()
+    let firstState = makeAnnotateState(defaults: defaults)
+    firstState.selectedTool = .text
+
+    firstState.quickTextBackgroundBinding.wrappedValue = .yellow
+    XCTAssertEqual(firstState.quickTextPresentation, .label)
+
+    let reloadedState = makeAnnotateSta
```

---

### Incident Patch 4: `cbf9811a` (2026-09-20)
**Commit Message**: fix: Fixed intermittent low-resolution window captures (#571)

Prefer the target display backing scale for independent window captures because ScreenCaptureKit can intermittently report a nominal 1x scale on Retina displays.

Validate returned image dimensions and fall back to the existing display-crop path when the output is materially undersized.

Preserve native 1x output for external displays and add regression tests.

**File**: `Snapzy/Services/Capture/ScreenCaptureManager.swift` (modified, +53/-11)
```diff
@@ -2053,7 +2053,11 @@ final class ScreenCaptureManager: ObservableObject {
   ) async throws -> (image: CGImage, scaleFactor: CGFloat) {
     let contentFilter = SCContentFilter(desktopIndependentWindow: window)
     let scaleFactor = max(
-      resolvedWindowScaleFactor(window: window, fallbackDisplayID: fallbackTarget.displayID),
+      resolvedWindowScaleFactor(
+        window: window,
+        contentFilter: contentFilter,
+        fallbackDisplayID: fallbackTarget.displayID
+      ),
       Self.minimumScreenshotOutputScaleFactor
     )
     let contentRect: CGRect
@@ -2081,6 +2085,36 @@ final class ScreenCaptureManager: ObservableObject {
       contentFilter: contentFilter,
       configuration: configuration
     )
+
+    let actualPixelSize = CGSize(width: image.width, height: image.height)
+    let expectedPixelSize = WindowCaptureResolution.expectedPixelSize(
+      logicalSize: contentRect.size,
+      scaleFactor: scaleFactor
+    )
+    let actualScaleFactor = WindowCaptureResolution.actualScaleFactor(
+      pixelSize: actualPixelSize,
+      logicalSize: contentRect.size
+    )
+    if WindowCaptureResolution.isUndersized(
+      pixelSize: actualPixelSize,
+      logicalSize: contentRect.size,
+      expectedScaleFactor: scaleFactor
+    ) {
+      DiagnosticLogger.shared.log(
+        .warning,
+        .capture,
+        "Window capture returned an undersized image; falling back to display crop",
+        context: [
+          "windowID": "\(fallbackTarget.windowID)",
+          "expected": "\(Int(expectedPixelSize.width))x\(Int(expectedPixelSize.height))",
+          "actual": "\(image.width)x\(image.height)",
+          "requestedScale": String(format: "%.3f", Double(scaleFactor)),
+          "actualScale": actualScaleFactor.map { String(format: "%.3f", Double($0)) } ?? "unknown",
+        ]
+      )
+      throw CaptureError.captureFailed("ScreenCaptureKit returned an undersized window image")
+    }
+
     let normalizedImage = await Task.detached(priority: .userInitiated) {
       Self.trimTransparentWindowFringe(from: image)
     }.value
@@ -2100,21 +2134,29 @@ final class ScreenCaptureManager: ObservableObject {
 
   private func resolvedWindowScaleFactor(
     window: SCWindow,
+    contentFilter: SCContentFilter,
     fallbackDisplayID: CGDirectDisplayID
   ) -> CGFloat {
+    // Prefer the display's backing scale. On some macOS releases,
+    // independent-window filters can transiently report a nominal 1x
+    // pointPixelScale for a Retina window; the display scale remains stable.
+    // A real 1x display still stays native because its backing scale is 1.
+    let screenScaleFactor = screenContainingWindow(
+      window,
+      fallbackDisplayID: fallbackDisplayID
+    )?.backingScaleFactor
+    let filterPointPixelScale: CGFloat?
     if #available(macOS 14.0, *) {
-      let filter = SCContentFilter(desktopIndependentWindow: window)
-      let pointPixelScale = CGFloat(filter.pointPixelScale)
-      if pointPixelScale > 0 {
-        return pointPixelScale
-      }
-    }
-
-    if let screen = screenContainingWindow(window, fallbackDisplayID: fallbackDisplayID) {
-      return screen.backingScaleFactor
+      filterPointPixelScale = CGFloat(contentFilter.pointPixelScale)
+    } else {
+      filterPointPixelScale = nil
     }
 
-    return NSScreen.main?.backingScaleFactor ?? 2.0
+    return WindowCaptureResolution.scaleFactor(
+      displayBackingScaleFactor: screenScaleFactor,
+      filterPointPixelScale: filterPointPixelScale,
+      fallback: NSScreen.main?.backingScaleFactor ?? 2.0
+    )
   }
 
   private func screenContainingWindow(
```

**File**: `Snapzy/Services/Capture/WindowCaptureResolution.swift` (added, +81/-0)
```diff
@@ -0,0 +1,81 @@
+//
+//  WindowCaptureResolution.swift
+//  Snapzy
+//
+//  Pure scale and output-size rules for independent window captures.
+//
+
+import CoreGraphics
+import Foundation
+
+nonisolated enum WindowCaptureResolution {
+  /// Small differences can come from pixel rounding or transparent window
+  /// margins. A result below this ratio is a density mismatch, not rounding.
+  static let minimumAcceptedScaleRatio: CGFloat = 0.75
+
+  static func scaleFactor(
+    displayBackingScaleFactor: CGFloat?,
+    filterPointPixelScale: CGFloat?,
+    fallback: CGFloat
+  ) -> CGFloat {
+    if let displayBackingScaleFactor,
+       displayBackingScaleFactor.isFinite,
+       displayBackingScaleFactor > 0 {
+      return displayBackingScaleFactor
+    }
+
+    if let filterPointPixelScale,
+       filterPointPixelScale.isFinite,
+       filterPointPixelScale > 0 {
+      return filterPointPixelScale
+    }
+
+    return max(fallback, 1)
+  }
+
+  static func actualScaleFactor(
+    pixelSize: CGSize,
+    logicalSize: CGSize
+  ) -> CGFloat? {
+    guard
+      pixelSize.width > 0,
+      pixelSize.height > 0,
+      logicalSize.width > 0,
+      logicalSize.height > 0
+    else {
+      return nil
+    }
+
+    let widthScale = pixelSize.width / logicalSize.width
+    let heightScale = pixelSize.height / logicalSize.height
+    let scale = min(widthScale, heightScale)
+    return scale.isFinite && scale > 0 ? scale : nil
+  }
+
+  static func expectedPixelSize(
+    logicalSize: CGSize,
+    scaleFactor: CGFloat
+  ) -> CGSize {
+    let scale = max(scaleFactor, 1)
+    return CGSize(
+      width: max(1, (logicalSize.width * scale).rounded()),
+      height: max(1, (logicalSize.height * scale).rounded())
+    )
+  }
+
+  static func isUndersized(
+    pixelSize: CGSize,
+    logicalSize: CGSize,
+    expectedScaleFactor: CGFloat
+  ) -> Bool {
+    guard
+      expectedScaleFactor.isFinite,
+      expectedScaleFactor > 0,
+      let actualScaleFactor = actualScaleFactor(pixelSize: pixelSize, logicalSize: logicalSize)
+    else {
+      return false
+    }
+
+    return actualScaleFactor < expectedScaleFactor * minimumAcceptedScaleRatio
+  }
+}
```

**File**: `SnapzyTests/Services/Capture/WindowCaptureResolutionTests.swift` (added, +73/-0)
```diff
@@ -0,0 +1,73 @@
+//
+//  WindowCaptureResolutionTests.swift
+//  SnapzyTests
+//
+
+import CoreGraphics
+import XCTest
+@testable import Snapzy
+
+final class WindowCaptureResolutionTests: XCTestCase {
+  func testDisplayBackingScaleWinsOverNominalFilterScale() {
+    XCTAssertEqual(
+      WindowCaptureResolution.scaleFactor(
+        displayBackingScaleFactor: 2,
+        filterPointPixelScale: 1,
+        fallback: 1
+      ),
+      2
+    )
+  }
+
+  func testOneXExternalDisplayRemainsNativeWhenBothSourcesAgree() {
+    XCTAssertEqual(
+      WindowCaptureResolution.scaleFactor(
+        displayBackingScaleFactor: 1,
+        filterPointPixelScale: 1,
+        fallback: 2
+      ),
+      1
+    )
+  }
+
+  func testFilterScaleIsUsedWhenDisplayScaleIsUnavailable() {
+    XCTAssertEqual(
+      WindowCaptureResolution.scaleFactor(
+        displayBackingScaleFactor: nil,
+        filterPointPixelScale: 1.5,
+        fallback: 1
+      ),
+      1.5
+    )
+  }
+
+  func testOneXOutputIsRejectedForTwoXTarget() {
+    XCTAssertTrue(
+      WindowCaptureResolution.isUndersized(
+        pixelSize: CGSize(width: 800, height: 450),
+        logicalSize: CGSize(width: 800, height: 450),
+        expectedScaleFactor: 2
+      )
+    )
+  }
+
+  func testNativeOneXOutputIsAcceptedForOneXTarget() {
+    XCTAssertFalse(
+      WindowCaptureResolution.isUndersized(
+        pixelSize: CGSize(width: 800, height: 450),
+        logicalSize: CGSize(width: 800, height: 450),
+        expectedScaleFactor: 1
+      )
+    )
+  }
+
+  func testRoundingAndTransparentMarginsDoNotTriggerFallback() {
+    XCTAssertFalse(
+      WindowCaptureResolution.isUndersized(
+        pixelSize: CGSize(width: 1_800, height: 900),
+        logicalSize: CGSize(width: 1_000, height: 500),
+        expectedScaleFactor: 2
+      )
+    )
+  }
+}
```

**File**: `docs/CAPTURE.md` (modified, +1/-1)
```diff
@@ -109,7 +109,7 @@ flowchart TD
 - Application-window capture can also start directly from the menu, independent shortcut, or `snapzy://capture/application`; it uses the same area capture flow with `.applicationWindow` as the initial interaction mode.
 - Active-window capture resolves the AX focused window of the frontmost app via `ActiveWindowResolver`, maps it to the nearest `WindowCaptureTarget` candidate, and captures it through the same `captureWindow` path — no selection overlay appears.
 - In live application window mode, Snapzy synchronously retains an already-open eligible menu-bar popover before showing any overlay. Because some transient WindowServer popovers can be enumerated but not rendered as an independent Core Graphics window, Snapzy takes one containing-display snapshot and crops the detected popover bounds from that pre-overlay image. After the overlay appears, it checks the exact `CGWindowID` during a short, bounded session-start interval: if the source closes, the retained image is restored beneath the existing dim-mask cutout; if it remains visible, no duplicate image is drawn. The retained image receives a 12pt transparent rounded-corner mask so flattened desktop pixels do not leak into exported PNG corners. The retained candidate is merged ahead of the normal front-to-back layer-0 list built from `CGWindowListCopyWindowInfo` plus `SCShareableContent`. Normal app windows keep their live behavior; only menu-bar-anchored third-party nonzero-layer popovers/dropdowns already open at capture start are retained. Snapzy, Dock, Control Center, and Notification Center are excluded.
-- Exact window capture is handled by `ScreenCaptureManager.captureWindow()`. ScreenCaptureKit is preferred for every still-resolved `SCWindow`; if a retained eligible menu-bar popover is no longer shareable, Snapzy saves the pre-overlay display crop instead of recapturing after it has disappeared. The legacy Core Graphics single-window path remains only as a fallback for a live eligible popover. Quick Look previews are detected as `QuickLookUIService` WindowServer windows and their pre-overlay display crops are composited back into filtered fullscreen, frozen-area, and live-area captures because ScreenCaptureKit may enumerate them as off-screen. Snapzy does not force third-party popovers to remain open.
+- Exact window capture is handled by `ScreenCaptureManager.captureWindow()`. ScreenCaptureKit is preferred for every still-resolved `SCWindow`; its output scale uses the target display's backing scale (falling back to ScreenCaptureKit's point-pixel scale only when the display cannot be resolved), and a materially undersized returned image is routed through the existing display-area crop fallback. This keeps Retina windows from being saved at an intermittent nominal 1× while preserving native 1× external-display output. If a retained eligible menu-bar popover is no longer shareable, Snapzy saves the pre-overlay display crop instead of recapturing after it has disappeared. The legacy Core Graphics single-window path remains only as a fallback for a live eligible popover. Quick Look previews are detected as `QuickLookUIService` WindowServer windows and their pre-overlay display crops are composited back into filtered fullscreen, frozen-area, and live-area captures because ScreenCaptureKit may enumerate them as off-screen. Snapzy does not force third-party popovers to remain open.
 - The frozen/manual and application-window paths both preserve existing desktop icon/widget exclusion, cursor, own-app exclusion, temp-save, Quick Access, clipboard, and annotate routing behavior.
 - When own-app exclusion hides visible normal Snapzy windows for screenshot, OCR, cutout, scrolling capture, or pre-recording setup, those windows are ordered out temporarily (`HiddenWindowSession`) and restored after the capture/session finishes or is cancelled.
 - Capture toasts, alerts, open-panel prompts, and error surfaces are localized through `L10n`.
```

---

### Incident Patch 5: `d082a7a4` (2026-09-19)
**Commit Message**: fix: Restore pinned window dragging on macOS 27 (#584)

* fix: Restore pinned window dragging on macOS 27

On macOS 27, AppKit no longer initiates background window drags
(isMovableByWindowBackground) when the content view is a SwiftUI
NSHostingView, so pinned screenshots could not be repositioned.
Plain NSView content still works; overriding
mouseDownCanMoveWindow on the hosting view does not help.

Implement a manual drag path in QuickAccessPinWindow.sendEvent,
gated to macOS 27+ so older systems keep the native behavior:
mouseDown records the offset (skipping the file-drag handle and
locked state), mouseDragged past a small threshold follows the
cursor via setFrameOrigin. Verified with an interactive repro on
macOS 27.0 (build 26A428).

* docs: Add demo video for pinned window drag fix on macOS 27

* fix: address review feedback on pin-window background dragging

- Replace version gating with native-first runtime detection: every drag
  starts in a tracking state that forwards events to AppKit untouched,
  and the manual drag path only takes ownership when the frame stays
  put past a movement threshold (with a small tolerance for point
  snapping); if the system moves the frame

**File**: `Snapzy/Features/QuickAccess/Components/QuickAccessPinWindowView.swift` (modified, +31/-6)
```diff
@@ -57,28 +57,36 @@ struct QuickAccessPinWindowView: View {
         .opacity(state.isLocked ? 0 : 1)
         .allowsHitTesting(!state.isLocked)
 
-      lockButton
+      interactiveRegion(lockButton)
         .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
         .padding(controlInset)
     }
   }
 
   private var unlockedControls: some View {
     ZStack {
-      chromeButton(systemName: "xmark", help: L10n.PreferencesQuickAccess.unpinAction, action: onClose)
-        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
-        .padding(controlInset)
+      interactiveRegion(
+        chromeButton(systemName: "xmark", help: L10n.PreferencesQuickAccess.unpinAction, action: onClose)
+      )
+      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
+      .padding(controlInset)
 
-      zoomMenu
+      interactiveRegion(zoomMenu)
         .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
         .padding(.top, controlInset)
 
-      dragHandle
+      interactiveRegion(dragHandle)
         .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
         .padding(.bottom, controlInset)
     }
   }
 
+  /// Wraps interactive chrome so background-window dragging never starts on
+  /// a control, keeping both drags and clicks exclusive to the control.
+  private func interactiveRegion<V: View>(_ content: V) -> some View {
+    content.background(PinWindowDragExclusionRepresentable())
+  }
+
   private var lockButton: some View {
     chromeButton(
       systemName: state.isLocked ? "lock.fill" : "lock.open",
@@ -305,3 +313,20 @@ private struct PinWindowZoomOptionButton: View {
     isSelected || isHovering ? Color.primary.opacity(0.08) : Color.clear
   }
 }
+
+/// NSView marker that opts a region of the pin window out of background
+/// window dragging. `QuickAccessPinWindow` hit-tests for this class before
+/// starting a native-or-manual background drag, so chrome controls keep
+/// their clicks and future interactive controls only need to be wrapped in
+/// `PinWindowDragExclusionRepresentable`.
+final class PinWindowDragExclusionView: NSView {
+  override var mouseDownCanMoveWindow: Bool { false }
+}
+
+struct PinWindowDragExclusionRepresentable: NSViewRepresentable {
+  func makeNSView(context: Context) -> PinWindowDragExclusionView {
+    PinWindowDragExclusionView(frame: .zero)
+  }
+
+  func updateNSView(_ nsView: PinWindowDragExclusionView, context: Context) {}
+}
```

**File**: `Snapzy/Features/QuickAccess/Managers/QuickAccessPinWindow.swift` (modified, +215/-0)
```diff
@@ -7,6 +7,94 @@
 
 import AppKit
 
+/// Per-gesture decision logic for pin-window background dragging.
+///
+/// The policy is native-first: every eligible drag starts as `.tracking`,
+/// events keep flowing to AppKit untouched, and only when the frame stays put
+/// past a small movement threshold does the manual path take ownership of the
+/// gesture. If the system moves the frame at any point (native dragging is
+/// available), the gesture is ceded back so exactly one mode owns it.
+struct PinWindowDragDecider: Equatable {
+  enum Mode: Equatable {
+    case idle
+    case tracking(startScreenPoint: NSPoint, grabOffset: NSPoint, initialFrameOrigin: NSPoint)
+    case manual(grabOffset: NSPoint, appliedFrameOrigin: NSPoint)
+    case native
+  }
+
+  static let movementThreshold: CGFloat = 4
+
+  /// How far the frame may deviate from the recorded origin before it counts
+  /// as "the system moved the window". Live drags can be subject to
+  /// point/pixel snapping, so exact equality would false-trigger the
+  /// native-first backoff.
+  static let systemMoveTolerance: CGFloat = 2
+
+  private(set) var mode: Mode = .idle
+
+  var isManual: Bool {
+    if case .manual = mode { return true }
+    return false
+  }
+
+  /// Starts tracking a new eligible background drag. Always resets first so
+  /// stale state can never leak into the next gesture.
+  mutating func begin(startScreenPoint: NSPoint, grabOffset: NSPoint, initialFrameOrigin: NSPoint) {
+    mode = .tracking(
+      startScreenPoint: startScreenPoint,
+      grabOffset: grabOffset,
+      initialFrameOrigin: initialFrameOrigin
+    )
+  }
+
+  /// Evaluates a drag update. Returns the screen origin the window should be
+  /// moved to when the manual path owns the gesture, otherwise nil so events
+  /// keep flowing to AppKit.
+  mutating func dragged(screenPoint: NSPoint, currentFrameOrigin: NSPoint) -> NSPoint? {
+    switch mode {
+    case .idle, .native:
+      return nil
+    case let .tracking(start, offset, initialOrigin):
+      // The system moved the frame: native background dragging owns this
+      // gesture.
+      guard !frameMoved(currentFrameOrigin, from: initialOrigin) else {
+        mode = .native
+        return nil
+      }
+      let dx = screenPoint.x - start.x
+      let dy = screenPoint.y - start.y
+      guard dx * dx + dy * dy >= Self.movementThreshold * Self.movementThreshold else {
+        return nil
+      }
+      return applyingManualMove(screenPoint: screenPoint, grabOffset: offset)
+    case let .manual(offset, applied):
+      // Back off if the frame moved without our involvement.
+      guard !frameMoved(currentFrameOrigin, from: applied) else {
+        mode = .native
+        return nil
+      }
+      return applyingManualMove(screenPoint: screenPoint, grabOffset: offset)
+    }
+  }
+
+  /// Ends the gesture: mouse-up, cancellation, or the window losing key
+  /// status.
+  mutating func end() {
+    mode = .idle
+  }
+
+  private func frameMoved(_ origin: NSPoint, from reference: NSPoint) -> Bool {
+    abs(origin.x - reference.x) > Self.systemMoveTolerance
+      || abs(origin.y - reference.y) > Self.systemMoveTolerance
+  }
+
+  private mutating func applyingManualMove(screenPoint: NSPoint, grabOffset: NSPoint) -> NSPoint {
+    let target = NSPoint(x: screenPoint.x - grabOffset.x, y: screenPoint.y - grabOffset.y)
+    mode = .manual(grabOffset: grabOffset, appliedFrameOrigin: target)
+    return target
+  }
+}
+
 @MainActor
 final class QuickAccessPinWindow: NSPanel {
   private static let pinnedWindowLevel = NSWindow.Level(rawValue: NSWindow.Level.floating.rawValue + 2)
@@ -23,6 +111,11 @@ final class QuickAccessPinWindow: NSPanel {
   private var localKeyMonitor: Any?
   private var globalKeyMonitor: Any?
 
+  // Native-first background drag ownership: the manual path in
+  // `PinWindowDragDecider` only takes over when the native path does not
+  // move the frame.
+  private var backgroundDrag = PinWindowDragDecider()
+
   init(contentRect: NSRect, state: QuickAccessPinWindowState) {
     pinState = state
     super.init(
@@ -50,11 +143,30 @@ final class QuickAccessPinWindow: NSPanel {
     switch event.type {
     case .scrollWheel where handleScrollZoomIfNeeded(event):
       return
+    case .leftMouseDown:
+      beginBackgroundDragIfEligible(with: event)
+      super.sendEvent(event)
+    case .leftMouseDragged where continueBackgroundDrag():
+      return
+    case .leftMouseUp:
+      // A manual drag consumed the gesture: swallow the mouse-up so the click
+      // underneath does not fire (same behavior as a native window drag).
+      let wasManual = backgroundDrag.isManual
+      backgroundDrag.end()
+      if wasManual {
+        return
+      }
+      super.sendEvent(event)
     default:
       super.sendEvent(event)
     }
   }
 
+  override func resignKey() {
+    backgroundDrag.end()
+    super.resignKey()
+  }
+
   private var isMouseMonitorsSuspended = false
 
   overri
```

**File**: `SnapzyTests/Features/QuickAccess/QuickAccessPinWindowDragDeciderTests.swift` (added, +205/-0)
```diff
@@ -0,0 +1,205 @@
+//
+//  QuickAccessPinWindowDragDeciderTests.swift
+//  SnapzyTests
+//
+//  Regression coverage for pin-window background drag ownership (PR #584).
+//
+
+import AppKit
+import XCTest
+@testable import Snapzy
+
+final class QuickAccessPinWindowDragDeciderTests: XCTestCase {
+  private let threshold = PinWindowDragDecider.movementThreshold
+
+  func testIdleDeciderNeverMoves() {
+    var decider = PinWindowDragDecider()
+
+    let target = decider.dragged(
+      screenPoint: NSPoint(x: 500, y: 500),
+      currentFrameOrigin: NSPoint(x: 400, y: 400)
+    )
+
+    XCTAssertNil(target)
+    XCTAssertEqual(decider.mode, .idle)
+  }
+
+  func testTrackingBelowThresholdDoesNotMoveAndKeepsTracking() {
+    var decider = PinWindowDragDecider()
+    decider.begin(
+      startScreenPoint: NSPoint(x: 100, y: 100),
+      grabOffset: NSPoint(x: 50, y: 50),
+      initialFrameOrigin: NSPoint(x: 400, y: 400)
+    )
+
+    let target = decider.dragged(
+      screenPoint: NSPoint(x: 100 + threshold - 1, y: 100),
+      currentFrameOrigin: NSPoint(x: 400, y: 400)
+    )
+
+    XCTAssertNil(target)
+    XCTAssertEqual(
+      decider.mode,
+      .tracking(
+        startScreenPoint: NSPoint(x: 100, y: 100),
+        grabOffset: NSPoint(x: 50, y: 50),
+        initialFrameOrigin: NSPoint(x: 400, y: 400)
+      )
+    )
+  }
+
+  func testTrackingPastThresholdWithUnmovedFrameTakesManualOwnership() {
+    var decider = PinWindowDragDecider()
+    decider.begin(
+      startScreenPoint: NSPoint(x: 100, y: 100),
+      grabOffset: NSPoint(x: 50, y: 50),
+      initialFrameOrigin: NSPoint(x: 400, y: 400)
+    )
+
+    let target = decider.dragged(
+      screenPoint: NSPoint(x: 100 + threshold + 10, y: 100),
+      currentFrameOrigin: NSPoint(x: 400, y: 400)
+    )
+
+    XCTAssertEqual(target, NSPoint(x: threshold + 60, y: 50))
+    XCTAssertTrue(decider.isManual)
+  }
+
+  func testSystemMovedFrameCedesGestureToNative() {
+    var decider = PinWindowDragDecider()
+    decider.begin(
+      startScreenPoint: NSPoint(x: 100, y: 100),
+      grabOffset: NSPoint(x: 50, y: 50),
+      initialFrameOrigin: NSPoint(x: 400, y: 400)
+    )
+
+    let target = decider.dragged(
+      screenPoint: NSPoint(x: 100 + threshold + 10, y: 100),
+      currentFrameOrigin: NSPoint(x: 460, y: 400)
+    )
+
+    XCTAssertNil(target)
+    XCTAssertEqual(decider.mode, .native)
+    // Once ceded, the gesture stays native until mouse-up.
+    XCTAssertNil(
+      decider.dragged(
+        screenPoint: NSPoint(x: 200, y: 200),
+        currentFrameOrigin: NSPoint(x: 500, y: 500)
+      )
+    )
+  }
+
+  func testManualBacksOffWhenFrameMovesWithoutUs() {
+    var decider = PinWindowDragDecider()
+    decider.begin(
+      startScreenPoint: NSPoint(x: 100, y: 100),
+      grabOffset: NSPoint(x: 50, y: 50),
+      initialFrameOrigin: NSPoint(x: 400, y: 400)
+    )
+
+    let first = decider.dragged(
+      screenPoint: NSPoint(x: 160, y: 100),
+      currentFrameOrigin: NSPoint(x: 400, y: 400)
+    )
+    XCTAssertEqual(first, NSPoint(x: 110, y: 50))
+
+    // A future macOS update restores native dragging mid-gesture: the frame
+    // is somewhere we did not put it, so the decider must cede ownership.
+    let second = decider.dragged(
+      screenPoint: NSPoint(x: 170, y: 100),
+      currentFrameOrigin: NSPoint(x: 118, y: 50)
+    )
+    XCTAssertNil(second)
+    XCTAssertEqual(decider.mode, .native)
+  }
+
+  func testManualMoveUsesAbsolutePositionWithoutDrift() {
+    var decider = PinWindowDragDecider()
+    decider.begin(
+      startScreenPoint: NSPoint(x: 100, y: 100),
+      grabOffset: NSPoint(x: 50, y: 50),
+      initialFrameOrigin: NSPoint(x: 400, y: 400)
+    )
+
+    _ = decider.dragged(
+      screenPoint: NSPoint(x: 160, y: 100),
+      currentFrameOrigin: NSPoint(x: 400, y: 400)
+    )
+    let second = decider.dragged(
+      screenPoint: NSPoint(x: 150, y: 130),
+      currentFrameOrigin: NSPoint(x: 110, y: 50)
+    )
+
+    XCTAssertEqual(second, NSPoint(x: 100, y: 80))
+  }
+
+  func testSubToleranceFrameSnapKeepsManualOwnership() {
+    var decider = PinWindowDragDecider()
+    decider.begin(
+      startScreenPoint: NSPoint(x: 100, y: 100),
+      grabOffset: NSPoint(x: 50, y: 50),
+      initialFrameOrigin: NSPoint(x: 400, y: 400)
+    )
+
+    _ = decider.dragged(
+      screenPoint: NSPoint(x: 160, y: 100),
+      currentFrameOrigin: NSPoint(x: 400, y: 400)
+    )
+    // AppKit snapped the origin by a fraction of a point after we moved the
+    // window: within tolerance, so the manual path must keep ownership.
+    let target = decider.dragged(
+      screenPoint: NSPoint(x: 170, y: 100),
+      currentFrameOrigin: NSPoint(x: 110.5, y: 50)
+    )
+
+    XCTAssertEqual(target, NSPoint(x: 120, y: 50))
+    XCTAssertTrue(decider.isManual)
+  }
+
+  func testEndResetsToIdle() {
+    var decider = PinWindowDragDecider()
+    decider.begin(
+      startScreenPoint: NSPoint(x: 100, y: 100),
+      grabOffse
```

---

### Incident Patch 6: `1862794d` (2026-09-19)
**Commit Message**: feat: Add Sound Effects Toggle to Quick Access (#586)

* feat(quick-access): add sound effects toggle

Add a separate preference for Quick Access sounds while preserving the global sound setting. Include the preference in configuration import and export, and document and test the new behavior.

* fix(quick-access): honor sound toggle in all paths and localize strings

Route the copy and cloud-upload sounds through QuickAccessSound so the
Quick Access sound effects preference applies to every Quick Access
sound path. Add quick_access.play_sounds to the default configuration
document so Restore Defaults resets the preference. Add translations
for the two new preference strings in all nine non-English locales.

**File**: `Snapzy/Features/Preferences/Components/PreferencesQuickAccessSettingsView.swift` (modified, +6/-0)
```diff
@@ -10,6 +10,7 @@ import SwiftUI
 struct QuickAccessSettingsView: View {
   @ObservedObject private var manager = QuickAccessManager.shared
   @ObservedObject private var trackpadSwipeModeStore = QuickAccessTrackpadSwipeModeStore.shared
+  @AppStorage(PreferencesKeys.quickAccessPlaySounds) private var playSounds = true
 
   @State private var positionIsLeft: Bool = false
 
@@ -74,6 +75,11 @@ struct QuickAccessSettingsView: View {
           .frame(width: 150, alignment: .trailing)
         }
 
+        SettingRow(icon: "speaker.wave.2", title: L10n.PreferencesQuickAccess.soundEffectsTitle, description: L10n.PreferencesQuickAccess.soundEffectsDescription) {
+          Toggle("", isOn: $playSounds)
+            .labelsHidden()
+        }
+
         if manager.autoDismissEnabled {
           HStack(spacing: 12) {
             Image(systemName: "clock")
```

**File**: `Snapzy/Features/Preferences/Models/PreferencesKeys.swift` (modified, +1/-0)
```diff
@@ -113,6 +113,7 @@ enum PreferencesKeys {
   static let quickAccessSwipeRightAction = "quickAccess.swipe.action.right"
   static let quickAccessHideCardWhenWindowOpen = "quickAccess.hideCardWhenWindowOpen"
   static let quickAccessAnimationStyle = "quickAccess.animationStyle"
+  static let quickAccessPlaySounds = "quickAccess.playSounds"
 
   // Recording
   static let recordingFormat = "recording.format"
```

**File**: `Snapzy/Features/QuickAccess/Components/QuickAccessCardView.swift` (modified, +1/-1)
```diff
@@ -740,7 +740,7 @@ struct QuickAccessCardView: View {
         }
 
         isCloudUploading = false
-        SoundManager.play("Pop")
+        QuickAccessSound.copy.play(reduceMotion: reduceMotion)
         DiagnosticLogger.shared.log(
           .info,
           .cloud,
```

**File**: `Snapzy/Features/QuickAccess/QuickAccessManager.swift` (modified, +2/-2)
```diff
@@ -1096,7 +1096,7 @@ final class QuickAccessManager: ObservableObject {
         context: ["fileName": item.url.lastPathComponent]
       )
       dismissCard(id: id)
-      SoundManager.play("Pop")
+      QuickAccessSound.copy.play()
       return
     }
 
@@ -1130,7 +1130,7 @@ final class QuickAccessManager: ObservableObject {
     // File-based clipboard: the file must stay on disk so the receiving app
     // can read it at paste time. Orphaned temp files are cleaned on next launch.
 
-    SoundManager.play("Pop")
+    QuickAccessSound.copy.play()
   }
 
   /// Delete item from disk and remove from stack
```

**File**: `Snapzy/Features/QuickAccess/Services/QuickAccessSound.swift` (modified, +17/-3)
```diff
@@ -32,9 +32,7 @@ enum QuickAccessSound {
   /// Play the sound effect asynchronously (non-blocking)
   /// - Parameter reduceMotion: When true, sounds are disabled for accessibility
   func play(reduceMotion: Bool = false) {
-    guard !reduceMotion else { return }
-    let soundsEnabled = UserDefaults.standard.object(forKey: PreferencesKeys.playSounds) as? Bool ?? true
-    guard soundsEnabled else { return }
+    guard shouldPlay(reduceMotion: reduceMotion) else { return }
     let soundName = self.soundName
     let vol = self.volume
     // Fire-and-forget async playback - never blocks UI
@@ -45,6 +43,22 @@ enum QuickAccessSound {
     }
   }
 
+  func shouldPlay(
+    reduceMotion: Bool,
+    defaults: UserDefaults = .standard
+  ) -> Bool {
+    guard !reduceMotion else { return false }
+    let soundsEnabled = defaults.object(forKey: PreferencesKeys.playSounds) as? Bool ?? true
+    guard soundsEnabled else { return false }
+
+    switch self {
+    case .complete, .failed:
+      return true
+    case .appear, .dismiss, .copy, .save, .delete:
+      return defaults.object(forKey: PreferencesKeys.quickAccessPlaySounds) as? Bool ?? true
+    }
+  }
+
   /// Sound name for cache lookup
   private var soundName: String {
     switch self {
```

**File**: `Snapzy/Resources/Localization/Features/QuickAccess.xcstrings` (modified, +130/-0)
```diff
@@ -1171,6 +1171,136 @@
         }
       }
     },
+    "preferences-quick-access.sound-effects-description": {
+      "extractionState": "manual",
+      "localizations": {
+        "en": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Play sounds when the overlay appears or an action completes"
+          }
+        },
+        "vi": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Phát âm thanh khi lớp phủ xuất hiện hoặc một thao tác hoàn tất"
+          }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "浮层出现或操作完成时播放提示音"
+          }
+        },
+        "zh-Hant": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "浮層出現或操作完成時播放提示音"
+          }
+        },
+        "es": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Reproducir sonidos cuando aparece la superposición o se completa una acción"
+          }
+        },
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "オーバーレイの表示時やアクションの完了時にサウンドを再生する"
+          }
+        },
+        "ko": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "오버레이가 나타나거나 작업이 완료될 때 소리 재생"
+          }
+        },
+        "ru": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Воспроизводить звуки при появлении оверлея или завершении действия"
+          }
+        },
+        "fr": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Jouer des sons lorsque la superposition apparaît ou qu'une action se termine"
+          }
+        },
+        "de": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Töne abspielen, wenn das Overlay erscheint oder eine Aktion abgeschlossen ist"
+          }
+        }
+      }
+    },
+    "preferences-quick-access.sound-effects-title": {
+      "extractionState": "manual",
+      "localizations": {
+        "en": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Sound Effects"
+          }
+        },
+        "vi": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Hiệu ứng âm thanh"
+          }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "音效"
+          }
+        },
+        "zh-Hant": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "音效"
+          }
+        },
+        "es": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Efectos de sonido"
+          }
+        },
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "効果音"
+          }
+        },
+        "ko": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "효과음"
+          }
+        },
+        "ru": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Звуковые эффекты"
+          }
+        },
+        "fr": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Effets sonores"
+          }
+        },
+        "de": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Soundeffekte"
+          }
+        }
+      }
+    },
     "preferences-quick-access.hide-card-when-window-open-description": {
       "extractionState": "stale",
       "localizations": {
```

**File**: `Snapzy/Services/Configuration/SnapzyConfigurationDefaultDocument.swift` (modified, +1/-0)
```diff
@@ -114,6 +114,7 @@ enum SnapzyConfigurationDefaultDocument {
   private static func writeQuickAccess(_ writer: inout SimpleTOMLWriter) {
     writer.section("quick_access")
     writer.value("enabled", true)
+    writer.value("play_sounds", true)
     writer.value("position", QuickAccessPosition.bottomRight.rawValue)
     writer.value("auto_dismiss", true)
     writer.value("auto_dismiss_delay", 10)
```

**File**: `Snapzy/Services/Configuration/SnapzyConfigurationExporter.swift` (modified, +3/-2)
```diff
@@ -20,7 +20,7 @@ enum SnapzyConfigurationExporter {
     writeMenuBar(&writer)
     writeCapture(&writer, defaults: defaults)
     writeRecording(&writer, defaults: defaults)
-    writeQuickAccess(&writer)
+    writeQuickAccess(&writer, defaults: defaults)
     writeHistory(&writer, defaults: defaults)
     writeCloud(&writer, defaults: defaults)
     writeAnnotate(&writer, defaults: defaults)
@@ -136,12 +136,13 @@ enum SnapzyConfigurationExporter {
     writer.value("hold_duration", defaults.doubleValue(PreferencesKeys.annotationShortcutHoldDuration, default: 0.3))
   }
 
-  private static func writeQuickAccess(_ writer: inout SimpleTOMLWriter) {
+  private static func writeQuickAccess(_ writer: inout SimpleTOMLWriter, defaults: UserDefaults) {
     let manager = QuickAccessManager.shared
     let actionStore = QuickAccessActionConfigurationStore.shared
 
     writer.section("quick_access")
     writer.value("enabled", manager.isEnabled)
+    writer.value("play_sounds", defaults.boolValue(PreferencesKeys.quickAccessPlaySounds, default: true))
     writer.value("position", manager.position.rawValue)
     writer.value("auto_dismiss", manager.autoDismissEnabled)
     writer.value("auto_dismiss_delay", manager.autoDismissDelay)
```

---

### Incident Patch 7: `c7800536` (2026-09-19)
**Commit Message**: Merge pull request #588 from duongductrong/fix/quicklook-pdf-capture

fix: Fixed Quick Look PDF screenshots

**File**: `Snapzy/Services/Capture/AreaSelectionBackdrop.swift` (modified, +14/-0)
```diff
@@ -73,6 +73,20 @@ nonisolated struct ImmediateMenuBarPopoverCapture {
   let scaleFactor: CGFloat
 }
 
+/// A Quick Look preview captured before Snapzy presents selection UI.
+///
+/// Quick Look is rendered by `QuickLookUIService` as a transient WindowServer
+/// window. ScreenCaptureKit can enumerate that window but may report it as
+/// off-screen, so the preview must be retained from a display snapshot and
+/// restored over the filtered capture.
+nonisolated struct ImmediateQuickLookCapture {
+  let windowID: CGWindowID
+  let displayID: CGDirectDisplayID
+  let frame: CGRect
+  let image: CGImage
+  let scaleFactor: CGFloat
+}
+
 nonisolated enum AreaSelectionTarget: Equatable {
   case rect(CGRect)
   case window(WindowCaptureTarget)
```

**File**: `Snapzy/Services/Capture/ScreenCaptureManager.swift` (modified, +120/-17)
```diff
@@ -111,6 +111,7 @@ final class ScreenCaptureManager: ObservableObject {
     let minimumOutputScaleFactor: CGFloat
     let assumedFullPixelSize: CGSize
     let displayID: CGDirectDisplayID
+    let quickLookCaptures: [ImmediateQuickLookCapture]
   }
 
   struct PreparedAreaCaptureResult {
@@ -434,6 +435,7 @@ final class ScreenCaptureManager: ObservableObject {
     excludeOwnApplication: Bool = false,
     prefetchedContentTask: ShareableContentPrefetchTask? = nil
   ) async throws -> [CGDirectDisplayID: FrozenDisplaySnapshot] {
+    let quickLookCaptures = WindowSelectionQueryService.captureImmediateQuickLookCaptures()
     let includeDesktopWindows = excludeDesktopIcons || excludeDesktopWidgets
     let content = try await loadShareableContent(
       prefetchedContentTask: prefetchedContentTask,
@@ -450,7 +452,7 @@ final class ScreenCaptureManager: ObservableObject {
       throw CaptureError.noDisplayFound
     }
 
-    let snapshots = try await withThrowingTaskGroup(
+    var snapshots = try await withThrowingTaskGroup(
       of: (CGDirectDisplayID, FrozenDisplaySnapshot).self,
       returning: [CGDirectDisplayID: FrozenDisplaySnapshot].self
     ) { group in
@@ -508,6 +510,28 @@ final class ScreenCaptureManager: ObservableObject {
       return result
     }
 
+    if !quickLookCaptures.isEmpty {
+      for (displayID, snapshot) in snapshots {
+        let restoredImage = Self.imageByCompositingQuickLookWindows(
+          baseImage: snapshot.image,
+          screenFrame: snapshot.screenFrame,
+          captures: quickLookCaptures.filter { $0.displayID == displayID }
+        )
+        guard restoredImage !== snapshot.image else { continue }
+        snapshots[displayID] = FrozenDisplaySnapshot(
+          displayID: snapshot.displayID,
+          screenFrame: snapshot.screenFrame,
+          scaleFactor: Self.imageScaleFactor(
+            for: restoredImage,
+            screenFrame: snapshot.screenFrame,
+            fallback: snapshot.scaleFactor
+          ),
+          colorSpaceName: snapshot.colorSpaceName,
+          image: restoredImage
+        )
+      }
+    }
+
     guard !snapshots.isEmpty else {
       throw CaptureError.noDisplayFound
     }
@@ -546,6 +570,7 @@ final class ScreenCaptureManager: ObservableObject {
     DiagnosticLogger.shared.log(.info, .capture, "Fullscreen capture started")
 
     do {
+      let quickLookCaptures = WindowSelectionQueryService.captureImmediateQuickLookCaptures()
       let includeDesktopWindows = excludeDesktopIcons || excludeDesktopWidgets
       let content = try await loadShareableContent(
         prefetchedContentTask: prefetchedContentTask,
@@ -595,10 +620,15 @@ final class ScreenCaptureManager: ObservableObject {
       }
 
       // Capture the image (compat: SCScreenshotManager requires macOS 14+)
-      let image = try await Self.captureImageCompat(
+      let capturedImage = try await Self.captureImageCompat(
         contentFilter: filter,
         configuration: config
       )
+      let image = Self.imageByCompositingQuickLookWindows(
+        baseImage: capturedImage,
+        screenFrame: captureFrame,
+        captures: quickLookCaptures.filter { $0.displayID == display.displayID }
+      )
 
       DiagnosticLogger.shared.log(
         .debug,
@@ -677,6 +707,9 @@ final class ScreenCaptureManager: ObservableObject {
       )
       let content: SCShareableContent?
       let targets: [DisplayCaptureTarget]
+      let quickLookCaptures = canUseFastPath
+        ? []
+        : WindowSelectionQueryService.captureImmediateQuickLookCaptures()
 
       if canUseFastPath {
         content = nil
@@ -711,7 +744,8 @@ final class ScreenCaptureManager: ObservableObject {
         showCursor: showCursor,
         excludeDesktopIcons: excludeDesktopIcons,
         excludeDesktopWidgets: excludeDesktopWidgets,
-        excludeOwnApplication: excludeOwnApplication
+        excludeOwnApplication: excludeOwnApplication,
+        quickLookCaptures: quickLookCaptures
       )
       let acquisitionDurationMs = Int(Date().timeIntervalSince(acquisitionStartedAt) * 1000)
 
@@ -836,7 +870,8 @@ final class ScreenCaptureManager: ObservableObject {
     showCursor: Bool,
     excludeDesktopIcons: Bool,
     excludeDesktopWidgets: Bool,
-    excludeOwnApplication: Bool
+    excludeOwnApplication: Bool,
+    quickLookCaptures: [ImmediateQuickLookCapture]
   ) async -> [DisplayPayloadResult] {
     if canUseFastPath {
       return await captureDisplayPayloadsUsingCoreGraphics(targets: targets)
@@ -887,13 +922,18 @@ final class ScreenCaptureManager: ObservableObject {
               contentFilter: request.filter,
               configuration: request.configuration
             )
+            let restoredImage = Self.imageByCompositingQuickLookWindows(
+              baseImage: image,
+              screenFrame: request.screenFrame,
+              captures: quickLookCaptures.filter { $0.displayID == request.displayID }
+            )
             let im
```

**File**: `Snapzy/Services/Capture/WindowSelectionQueryService.swift` (modified, +76/-2)
```diff
@@ -257,6 +257,66 @@ enum WindowSelectionQueryService {
     return captures
   }
 
+  /// Retain visible Quick Look previews before Snapzy presents selection UI.
+  ///
+  /// On recent macOS releases Quick Look is backed by `QuickLookUIService` and
+  /// appears in the WindowServer display image, but its `SCWindow` can report
+  /// `isOnScreen == false`. Capturing its pixels from the display snapshot is
+  /// therefore more reliable than asking ScreenCaptureKit for the window.
+  static func captureImmediateQuickLookCaptures() -> [ImmediateQuickLookCapture] {
+    var captures: [ImmediateQuickLookCapture] = []
+    var displaySnapshots: [CGDirectDisplayID: CGImage] = [:]
+
+    for info in rawWindowInfoList(includeOffscreen: true) {
+      guard isQuickLookWindow(info), let quartzBounds = info.quartzBounds else { continue }
+
+      let frame = appKitGlobalRect(fromQuartzGlobalRect: quartzBounds).integral
+      guard frame.width > 32, frame.height > 32, info.alpha > 0 else { continue }
+      guard let displayID = displayID(for: frame),
+            let display = NSScreen.screens.first(where: { $0.displayID == displayID })
+      else { continue }
+
+      let displayImage: CGImage
+      if let snapshot = displaySnapshots[displayID] {
+        displayImage = snapshot
+      } else if let snapshot = CGDisplayCreateImage(displayID) {
+        displaySnapshots[displayID] = snapshot
+        displayImage = snapshot
+      } else {
+        continue
+      }
+
+      guard let cropRect = WindowCaptureSelectionPolicy.displaySnapshotCropRect(
+        frame: frame,
+        displayFrame: display.frame,
+        imagePixelWidth: displayImage.width,
+        imagePixelHeight: displayImage.height
+      ), let croppedImage = displayImage.cropping(to: cropRect) else {
+        continue
+      }
+
+      let capturedFrame = frame.intersection(display.frame)
+      guard !capturedFrame.isEmpty else { continue }
+
+      let scaleFactor = max(
+        CGFloat(croppedImage.width) / max(capturedFrame.width, 1),
+        CGFloat(croppedImage.height) / max(capturedFrame.height, 1),
+        1
+      )
+      captures.append(
+        ImmediateQuickLookCapture(
+          windowID: info.windowID,
+          displayID: displayID,
+          frame: capturedFrame,
+          image: croppedImage,
+          scaleFactor: scaleFactor
+        )
+      )
+    }
+
+    return captures
+  }
+
   static func resolveWindow(
     windowID: CGWindowID,
     prefetchedContentTask: ShareableContentPrefetchTask?
@@ -334,10 +394,24 @@ enum WindowSelectionQueryService {
     )
   }
 
-  nonisolated private static func rawWindowInfoList() -> [RawWindowInfo] {
+  private static func isQuickLookWindow(_ info: RawWindowInfo) -> Bool {
+    let ownerName = info.ownerName?.lowercased() ?? ""
+    if ownerName.contains("quicklook") {
+      return true
+    }
+
+    guard let ownerPID = info.ownerPID else { return false }
+    return NSRunningApplication(processIdentifier: ownerPID)?.bundleIdentifier?.lowercased()
+      == "com.apple.quicklook.quicklookuiservice"
+  }
+
+  nonisolated private static func rawWindowInfoList(includeOffscreen: Bool = false) -> [RawWindowInfo] {
+    let options: CGWindowListOption = includeOffscreen
+      ? [.optionAll, .excludeDesktopElements]
+      : [.optionOnScreenOnly, .excludeDesktopElements]
     guard
       let rawWindowInfo = CGWindowListCopyWindowInfo(
-        [.optionOnScreenOnly, .excludeDesktopElements],
+        options,
         kCGNullWindowID
       ) as? [[String: Any]]
     else {
```

**File**: `SnapzyTests/Services/Capture/QuickLookCaptureTests.swift` (added, +71/-0)
```diff
@@ -0,0 +1,71 @@
+//
+//  QuickLookCaptureTests.swift
+//  SnapzyTests
+//
+
+import CoreGraphics
+import XCTest
+@testable import Snapzy
+
+final class QuickLookCaptureTests: XCTestCase {
+  func testQuickLookWindowIsCompositedAtItsDisplayPosition() {
+    let baseImage = solidImage(width: 100, height: 100, red: 0, green: 0, blue: 0)
+    let quickLookImage = solidImage(width: 20, height: 30, red: 1, green: 1, blue: 1)
+    let quickLookCapture = ImmediateQuickLookCapture(
+      windowID: 42,
+      displayID: 1,
+      frame: CGRect(x: 40, y: 30, width: 20, height: 30),
+      image: quickLookImage,
+      scaleFactor: 1
+    )
+
+    let result = ScreenCaptureManager.imageByCompositingQuickLookWindows(
+      baseImage: baseImage,
+      screenFrame: CGRect(x: 0, y: 0, width: 100, height: 100),
+      captures: [quickLookCapture]
+    )
+
+    let restoredPixel = pixel(in: result, x: 45, y: 35)
+    XCTAssertGreaterThan(restoredPixel.0, 200)
+    XCTAssertGreaterThan(restoredPixel.1, 200)
+    XCTAssertGreaterThan(restoredPixel.2, 200)
+
+    let untouchedPixel = pixel(in: result, x: 10, y: 10)
+    XCTAssertLessThan(untouchedPixel.0, 50)
+    XCTAssertLessThan(untouchedPixel.1, 50)
+    XCTAssertLessThan(untouchedPixel.2, 50)
+  }
+
+  private func solidImage(width: Int, height: Int, red: CGFloat, green: CGFloat, blue: CGFloat) -> CGImage {
+    let context = CGContext(
+      data: nil,
+      width: width,
+      height: height,
+      bitsPerComponent: 8,
+      bytesPerRow: width * 4,
+      space: CGColorSpaceCreateDeviceRGB(),
+      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
+    )!
+    context.setFillColor(CGColor(red: red, green: green, blue: blue, alpha: 1))
+    context.fill(CGRect(x: 0, y: 0, width: width, height: height))
+    return context.makeImage()!
+  }
+
+  private func pixel(in image: CGImage, x: Int, y: Int) -> (UInt8, UInt8, UInt8) {
+    var bytes = [UInt8](repeating: 0, count: 4)
+    let context = CGContext(
+      data: &bytes,
+      width: 1,
+      height: 1,
+      bitsPerComponent: 8,
+      bytesPerRow: 4,
+      space: CGColorSpaceCreateDeviceRGB(),
+      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
+    )!
+    context.draw(
+      image,
+      in: CGRect(x: -x, y: y - image.height + 1, width: image.width, height: image.height)
+    )
+    return (bytes[0], bytes[1], bytes[2])
+  }
+}
```

**File**: `docs/CAPTURE.md` (modified, +1/-1)
```diff
@@ -109,7 +109,7 @@ flowchart TD
 - Application-window capture can also start directly from the menu, independent shortcut, or `snapzy://capture/application`; it uses the same area capture flow with `.applicationWindow` as the initial interaction mode.
 - Active-window capture resolves the AX focused window of the frontmost app via `ActiveWindowResolver`, maps it to the nearest `WindowCaptureTarget` candidate, and captures it through the same `captureWindow` path — no selection overlay appears.
 - In live application window mode, Snapzy synchronously retains an already-open eligible menu-bar popover before showing any overlay. Because some transient WindowServer popovers can be enumerated but not rendered as an independent Core Graphics window, Snapzy takes one containing-display snapshot and crops the detected popover bounds from that pre-overlay image. After the overlay appears, it checks the exact `CGWindowID` during a short, bounded session-start interval: if the source closes, the retained image is restored beneath the existing dim-mask cutout; if it remains visible, no duplicate image is drawn. The retained image receives a 12pt transparent rounded-corner mask so flattened desktop pixels do not leak into exported PNG corners. The retained candidate is merged ahead of the normal front-to-back layer-0 list built from `CGWindowListCopyWindowInfo` plus `SCShareableContent`. Normal app windows keep their live behavior; only menu-bar-anchored third-party nonzero-layer popovers/dropdowns already open at capture start are retained. Snapzy, Dock, Control Center, and Notification Center are excluded.
-- Exact window capture is handled by `ScreenCaptureManager.captureWindow()`. ScreenCaptureKit is preferred for every still-resolved `SCWindow`; if a retained eligible menu-bar popover is no longer shareable, Snapzy saves the pre-overlay display crop instead of recapturing after it has disappeared. The legacy Core Graphics single-window path remains only as a fallback for a live eligible popover. Snapzy does not force third-party popovers to remain open; Quick Look, ordinary in-app popovers, and dedicated macOS system UI remain out of scope.
+- Exact window capture is handled by `ScreenCaptureManager.captureWindow()`. ScreenCaptureKit is preferred for every still-resolved `SCWindow`; if a retained eligible menu-bar popover is no longer shareable, Snapzy saves the pre-overlay display crop instead of recapturing after it has disappeared. The legacy Core Graphics single-window path remains only as a fallback for a live eligible popover. Quick Look previews are detected as `QuickLookUIService` WindowServer windows and their pre-overlay display crops are composited back into filtered fullscreen, frozen-area, and live-area captures because ScreenCaptureKit may enumerate them as off-screen. Snapzy does not force third-party popovers to remain open.
 - The frozen/manual and application-window paths both preserve existing desktop icon/widget exclusion, cursor, own-app exclusion, temp-save, Quick Access, clipboard, and annotate routing behavior.
 - When own-app exclusion hides visible normal Snapzy windows for screenshot, OCR, cutout, scrolling capture, or pre-recording setup, those windows are ordered out temporarily (`HiddenWindowSession`) and restored after the capture/session finishes or is cancelled.
 - Capture toasts, alerts, open-panel prompts, and error surfaces are localized through `L10n`.
```

---

### Incident Patch 8: `5e124ff6` (2026-09-19)
**Commit Message**: fix: Fixed Quick Look previews in filtered captures

Detect transient QuickLookUIService windows through WindowServer's raw window list before Snapzy presents capture UI. Retain the containing display crop and composite it back into ScreenCaptureKit captures so PDF previews remain visible when Finder and widget layers are excluded.

Cover fullscreen, frozen-area, live-area, and direct fullscreen paths while leaving the fast Core Graphics path unchanged. Add deterministic compositor regression coverage and document the behavior.

Tests: focused Quick Look and capture-policy suites passed; live debug capture on macOS 26.6.2 produced the PDF content at the Quick Look window position.

Fixes #585

**File**: `Snapzy/Services/Capture/AreaSelectionBackdrop.swift` (modified, +14/-0)
```diff
@@ -73,6 +73,20 @@ nonisolated struct ImmediateMenuBarPopoverCapture {
   let scaleFactor: CGFloat
 }
 
+/// A Quick Look preview captured before Snapzy presents selection UI.
+///
+/// Quick Look is rendered by `QuickLookUIService` as a transient WindowServer
+/// window. ScreenCaptureKit can enumerate that window but may report it as
+/// off-screen, so the preview must be retained from a display snapshot and
+/// restored over the filtered capture.
+nonisolated struct ImmediateQuickLookCapture {
+  let windowID: CGWindowID
+  let displayID: CGDirectDisplayID
+  let frame: CGRect
+  let image: CGImage
+  let scaleFactor: CGFloat
+}
+
 nonisolated enum AreaSelectionTarget: Equatable {
   case rect(CGRect)
   case window(WindowCaptureTarget)
```

**File**: `Snapzy/Services/Capture/ScreenCaptureManager.swift` (modified, +120/-17)
```diff
@@ -111,6 +111,7 @@ final class ScreenCaptureManager: ObservableObject {
     let minimumOutputScaleFactor: CGFloat
     let assumedFullPixelSize: CGSize
     let displayID: CGDirectDisplayID
+    let quickLookCaptures: [ImmediateQuickLookCapture]
   }
 
   struct PreparedAreaCaptureResult {
@@ -434,6 +435,7 @@ final class ScreenCaptureManager: ObservableObject {
     excludeOwnApplication: Bool = false,
     prefetchedContentTask: ShareableContentPrefetchTask? = nil
   ) async throws -> [CGDirectDisplayID: FrozenDisplaySnapshot] {
+    let quickLookCaptures = WindowSelectionQueryService.captureImmediateQuickLookCaptures()
     let includeDesktopWindows = excludeDesktopIcons || excludeDesktopWidgets
     let content = try await loadShareableContent(
       prefetchedContentTask: prefetchedContentTask,
@@ -450,7 +452,7 @@ final class ScreenCaptureManager: ObservableObject {
       throw CaptureError.noDisplayFound
     }
 
-    let snapshots = try await withThrowingTaskGroup(
+    var snapshots = try await withThrowingTaskGroup(
       of: (CGDirectDisplayID, FrozenDisplaySnapshot).self,
       returning: [CGDirectDisplayID: FrozenDisplaySnapshot].self
     ) { group in
@@ -508,6 +510,28 @@ final class ScreenCaptureManager: ObservableObject {
       return result
     }
 
+    if !quickLookCaptures.isEmpty {
+      for (displayID, snapshot) in snapshots {
+        let restoredImage = Self.imageByCompositingQuickLookWindows(
+          baseImage: snapshot.image,
+          screenFrame: snapshot.screenFrame,
+          captures: quickLookCaptures.filter { $0.displayID == displayID }
+        )
+        guard restoredImage !== snapshot.image else { continue }
+        snapshots[displayID] = FrozenDisplaySnapshot(
+          displayID: snapshot.displayID,
+          screenFrame: snapshot.screenFrame,
+          scaleFactor: Self.imageScaleFactor(
+            for: restoredImage,
+            screenFrame: snapshot.screenFrame,
+            fallback: snapshot.scaleFactor
+          ),
+          colorSpaceName: snapshot.colorSpaceName,
+          image: restoredImage
+        )
+      }
+    }
+
     guard !snapshots.isEmpty else {
       throw CaptureError.noDisplayFound
     }
@@ -546,6 +570,7 @@ final class ScreenCaptureManager: ObservableObject {
     DiagnosticLogger.shared.log(.info, .capture, "Fullscreen capture started")
 
     do {
+      let quickLookCaptures = WindowSelectionQueryService.captureImmediateQuickLookCaptures()
       let includeDesktopWindows = excludeDesktopIcons || excludeDesktopWidgets
       let content = try await loadShareableContent(
         prefetchedContentTask: prefetchedContentTask,
@@ -595,10 +620,15 @@ final class ScreenCaptureManager: ObservableObject {
       }
 
       // Capture the image (compat: SCScreenshotManager requires macOS 14+)
-      let image = try await Self.captureImageCompat(
+      let capturedImage = try await Self.captureImageCompat(
         contentFilter: filter,
         configuration: config
       )
+      let image = Self.imageByCompositingQuickLookWindows(
+        baseImage: capturedImage,
+        screenFrame: captureFrame,
+        captures: quickLookCaptures.filter { $0.displayID == display.displayID }
+      )
 
       DiagnosticLogger.shared.log(
         .debug,
@@ -677,6 +707,9 @@ final class ScreenCaptureManager: ObservableObject {
       )
       let content: SCShareableContent?
       let targets: [DisplayCaptureTarget]
+      let quickLookCaptures = canUseFastPath
+        ? []
+        : WindowSelectionQueryService.captureImmediateQuickLookCaptures()
 
       if canUseFastPath {
         content = nil
@@ -711,7 +744,8 @@ final class ScreenCaptureManager: ObservableObject {
         showCursor: showCursor,
         excludeDesktopIcons: excludeDesktopIcons,
         excludeDesktopWidgets: excludeDesktopWidgets,
-        excludeOwnApplication: excludeOwnApplication
+        excludeOwnApplication: excludeOwnApplication,
+        quickLookCaptures: quickLookCaptures
       )
       let acquisitionDurationMs = Int(Date().timeIntervalSince(acquisitionStartedAt) * 1000)
 
@@ -836,7 +870,8 @@ final class ScreenCaptureManager: ObservableObject {
     showCursor: Bool,
     excludeDesktopIcons: Bool,
     excludeDesktopWidgets: Bool,
-    excludeOwnApplication: Bool
+    excludeOwnApplication: Bool,
+    quickLookCaptures: [ImmediateQuickLookCapture]
   ) async -> [DisplayPayloadResult] {
     if canUseFastPath {
       return await captureDisplayPayloadsUsingCoreGraphics(targets: targets)
@@ -887,13 +922,18 @@ final class ScreenCaptureManager: ObservableObject {
               contentFilter: request.filter,
               configuration: request.configuration
             )
+            let restoredImage = Self.imageByCompositingQuickLookWindows(
+              baseImage: image,
+              screenFrame: request.screenFrame,
+              captures: quickLookCaptures.filter { $0.displayID == request.displayID }
+            )
             let im
```

**File**: `Snapzy/Services/Capture/WindowSelectionQueryService.swift` (modified, +76/-2)
```diff
@@ -257,6 +257,66 @@ enum WindowSelectionQueryService {
     return captures
   }
 
+  /// Retain visible Quick Look previews before Snapzy presents selection UI.
+  ///
+  /// On recent macOS releases Quick Look is backed by `QuickLookUIService` and
+  /// appears in the WindowServer display image, but its `SCWindow` can report
+  /// `isOnScreen == false`. Capturing its pixels from the display snapshot is
+  /// therefore more reliable than asking ScreenCaptureKit for the window.
+  static func captureImmediateQuickLookCaptures() -> [ImmediateQuickLookCapture] {
+    var captures: [ImmediateQuickLookCapture] = []
+    var displaySnapshots: [CGDirectDisplayID: CGImage] = [:]
+
+    for info in rawWindowInfoList(includeOffscreen: true) {
+      guard isQuickLookWindow(info), let quartzBounds = info.quartzBounds else { continue }
+
+      let frame = appKitGlobalRect(fromQuartzGlobalRect: quartzBounds).integral
+      guard frame.width > 32, frame.height > 32, info.alpha > 0 else { continue }
+      guard let displayID = displayID(for: frame),
+            let display = NSScreen.screens.first(where: { $0.displayID == displayID })
+      else { continue }
+
+      let displayImage: CGImage
+      if let snapshot = displaySnapshots[displayID] {
+        displayImage = snapshot
+      } else if let snapshot = CGDisplayCreateImage(displayID) {
+        displaySnapshots[displayID] = snapshot
+        displayImage = snapshot
+      } else {
+        continue
+      }
+
+      guard let cropRect = WindowCaptureSelectionPolicy.displaySnapshotCropRect(
+        frame: frame,
+        displayFrame: display.frame,
+        imagePixelWidth: displayImage.width,
+        imagePixelHeight: displayImage.height
+      ), let croppedImage = displayImage.cropping(to: cropRect) else {
+        continue
+      }
+
+      let capturedFrame = frame.intersection(display.frame)
+      guard !capturedFrame.isEmpty else { continue }
+
+      let scaleFactor = max(
+        CGFloat(croppedImage.width) / max(capturedFrame.width, 1),
+        CGFloat(croppedImage.height) / max(capturedFrame.height, 1),
+        1
+      )
+      captures.append(
+        ImmediateQuickLookCapture(
+          windowID: info.windowID,
+          displayID: displayID,
+          frame: capturedFrame,
+          image: croppedImage,
+          scaleFactor: scaleFactor
+        )
+      )
+    }
+
+    return captures
+  }
+
   static func resolveWindow(
     windowID: CGWindowID,
     prefetchedContentTask: ShareableContentPrefetchTask?
@@ -334,10 +394,24 @@ enum WindowSelectionQueryService {
     )
   }
 
-  nonisolated private static func rawWindowInfoList() -> [RawWindowInfo] {
+  private static func isQuickLookWindow(_ info: RawWindowInfo) -> Bool {
+    let ownerName = info.ownerName?.lowercased() ?? ""
+    if ownerName.contains("quicklook") {
+      return true
+    }
+
+    guard let ownerPID = info.ownerPID else { return false }
+    return NSRunningApplication(processIdentifier: ownerPID)?.bundleIdentifier?.lowercased()
+      == "com.apple.quicklook.quicklookuiservice"
+  }
+
+  nonisolated private static func rawWindowInfoList(includeOffscreen: Bool = false) -> [RawWindowInfo] {
+    let options: CGWindowListOption = includeOffscreen
+      ? [.optionAll, .excludeDesktopElements]
+      : [.optionOnScreenOnly, .excludeDesktopElements]
     guard
       let rawWindowInfo = CGWindowListCopyWindowInfo(
-        [.optionOnScreenOnly, .excludeDesktopElements],
+        options,
         kCGNullWindowID
       ) as? [[String: Any]]
     else {
```

**File**: `SnapzyTests/Services/Capture/QuickLookCaptureTests.swift` (added, +71/-0)
```diff
@@ -0,0 +1,71 @@
+//
+//  QuickLookCaptureTests.swift
+//  SnapzyTests
+//
+
+import CoreGraphics
+import XCTest
+@testable import Snapzy
+
+final class QuickLookCaptureTests: XCTestCase {
+  func testQuickLookWindowIsCompositedAtItsDisplayPosition() {
+    let baseImage = solidImage(width: 100, height: 100, red: 0, green: 0, blue: 0)
+    let quickLookImage = solidImage(width: 20, height: 30, red: 1, green: 1, blue: 1)
+    let quickLookCapture = ImmediateQuickLookCapture(
+      windowID: 42,
+      displayID: 1,
+      frame: CGRect(x: 40, y: 30, width: 20, height: 30),
+      image: quickLookImage,
+      scaleFactor: 1
+    )
+
+    let result = ScreenCaptureManager.imageByCompositingQuickLookWindows(
+      baseImage: baseImage,
+      screenFrame: CGRect(x: 0, y: 0, width: 100, height: 100),
+      captures: [quickLookCapture]
+    )
+
+    let restoredPixel = pixel(in: result, x: 45, y: 35)
+    XCTAssertGreaterThan(restoredPixel.0, 200)
+    XCTAssertGreaterThan(restoredPixel.1, 200)
+    XCTAssertGreaterThan(restoredPixel.2, 200)
+
+    let untouchedPixel = pixel(in: result, x: 10, y: 10)
+    XCTAssertLessThan(untouchedPixel.0, 50)
+    XCTAssertLessThan(untouchedPixel.1, 50)
+    XCTAssertLessThan(untouchedPixel.2, 50)
+  }
+
+  private func solidImage(width: Int, height: Int, red: CGFloat, green: CGFloat, blue: CGFloat) -> CGImage {
+    let context = CGContext(
+      data: nil,
+      width: width,
+      height: height,
+      bitsPerComponent: 8,
+      bytesPerRow: width * 4,
+      space: CGColorSpaceCreateDeviceRGB(),
+      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
+    )!
+    context.setFillColor(CGColor(red: red, green: green, blue: blue, alpha: 1))
+    context.fill(CGRect(x: 0, y: 0, width: width, height: height))
+    return context.makeImage()!
+  }
+
+  private func pixel(in image: CGImage, x: Int, y: Int) -> (UInt8, UInt8, UInt8) {
+    var bytes = [UInt8](repeating: 0, count: 4)
+    let context = CGContext(
+      data: &bytes,
+      width: 1,
+      height: 1,
+      bitsPerComponent: 8,
+      bytesPerRow: 4,
+      space: CGColorSpaceCreateDeviceRGB(),
+      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
+    )!
+    context.draw(
+      image,
+      in: CGRect(x: -x, y: y - image.height + 1, width: image.width, height: image.height)
+    )
+    return (bytes[0], bytes[1], bytes[2])
+  }
+}
```

**File**: `docs/CAPTURE.md` (modified, +1/-1)
```diff
@@ -109,7 +109,7 @@ flowchart TD
 - Application-window capture can also start directly from the menu, independent shortcut, or `snapzy://capture/application`; it uses the same area capture flow with `.applicationWindow` as the initial interaction mode.
 - Active-window capture resolves the AX focused window of the frontmost app via `ActiveWindowResolver`, maps it to the nearest `WindowCaptureTarget` candidate, and captures it through the same `captureWindow` path — no selection overlay appears.
 - In live application window mode, Snapzy synchronously retains an already-open eligible menu-bar popover before showing any overlay. Because some transient WindowServer popovers can be enumerated but not rendered as an independent Core Graphics window, Snapzy takes one containing-display snapshot and crops the detected popover bounds from that pre-overlay image. After the overlay appears, it checks the exact `CGWindowID` during a short, bounded session-start interval: if the source closes, the retained image is restored beneath the existing dim-mask cutout; if it remains visible, no duplicate image is drawn. The retained image receives a 12pt transparent rounded-corner mask so flattened desktop pixels do not leak into exported PNG corners. The retained candidate is merged ahead of the normal front-to-back layer-0 list built from `CGWindowListCopyWindowInfo` plus `SCShareableContent`. Normal app windows keep their live behavior; only menu-bar-anchored third-party nonzero-layer popovers/dropdowns already open at capture start are retained. Snapzy, Dock, Control Center, and Notification Center are excluded.
-- Exact window capture is handled by `ScreenCaptureManager.captureWindow()`. ScreenCaptureKit is preferred for every still-resolved `SCWindow`; if a retained eligible menu-bar popover is no longer shareable, Snapzy saves the pre-overlay display crop instead of recapturing after it has disappeared. The legacy Core Graphics single-window path remains only as a fallback for a live eligible popover. Snapzy does not force third-party popovers to remain open; Quick Look, ordinary in-app popovers, and dedicated macOS system UI remain out of scope.
+- Exact window capture is handled by `ScreenCaptureManager.captureWindow()`. ScreenCaptureKit is preferred for every still-resolved `SCWindow`; if a retained eligible menu-bar popover is no longer shareable, Snapzy saves the pre-overlay display crop instead of recapturing after it has disappeared. The legacy Core Graphics single-window path remains only as a fallback for a live eligible popover. Quick Look previews are detected as `QuickLookUIService` WindowServer windows and their pre-overlay display crops are composited back into filtered fullscreen, frozen-area, and live-area captures because ScreenCaptureKit may enumerate them as off-screen. Snapzy does not force third-party popovers to remain open.
 - The frozen/manual and application-window paths both preserve existing desktop icon/widget exclusion, cursor, own-app exclusion, temp-save, Quick Access, clipboard, and annotate routing behavior.
 - When own-app exclusion hides visible normal Snapzy windows for screenshot, OCR, cutout, scrolling capture, or pre-recording setup, those windows are ordered out temporarily (`HiddenWindowSession`) and restored after the capture/session finishes or is cancelled.
 - Capture toasts, alerts, open-panel prompts, and error surfaces are localized through `L10n`.
```

---

### Incident Patch 9: `0cdea528` (2026-09-18)
**Commit Message**: fix: retry release asset upload on transient GitHub errors

**File**: `.github/workflows/release-publish.yml` (modified, +24/-0)
```diff
@@ -429,7 +429,31 @@ jobs:
           name: Snapzy-v${{ steps.version.outputs.version }}
           path: ${{ env.dmg_path }}
 
+      # v3 creates a draft release first, uploads assets, then publishes it.
+      # If the asset upload hits a transient GitHub error (e.g. HTTP 500
+      # "Unicorn" page on uploads.github.com), the job fails and leaves the
+      # orphan draft in place; a retry (or job re-run) reuses that draft and
+      # uploads into it before publishing.
       - name: Create GitHub Release
+        id: create_release
+        uses: softprops/action-gh-release@v3
+        with:
+          tag_name: v${{ steps.version.outputs.version }}
+          name: v${{ steps.version.outputs.version }}
+          body_path: ${{ steps.changelog.outputs.changelog_path }}
+          draft: false
+          prerelease: ${{ steps.version.outputs.is_beta == 'true' }}
+          files: ${{ env.dmg_path }}
+          generate_release_notes: false
+        env:
+          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
+
+      - name: Wait before release retry
+        if: failure() && steps.create_release.conclusion == 'failure'
+        run: sleep 60
+
+      - name: Retry GitHub Release on transient upload failure
+        if: failure() && steps.create_release.conclusion == 'failure'
         uses: softprops/action-gh-release@v3
         with:
           tag_name: v${{ steps.version.outputs.version }}
```

---

### Incident Patch 10: `4c845d6b` (2026-09-18)
**Commit Message**: Revert "chore: bump version to v1.32.1 (#580)" (#581)

This reverts commit ba590bd363677cee8ad26f44e1f6b3c91834dad5.

**File**: `CHANGELOG.md` (modified, +0/-9)
```diff
@@ -4,15 +4,6 @@ All notable changes to Snapzy will be documented in this file.
 
 The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
 
-## [1.32.1] - 2026-09-17
-
-### Bug Fixes
--  Fixed recording annotation tool shortcuts bug (#579) (8beafc0a)
-
-### Contributors
-- @duongductrong
-- @github-actions[bot]
-
 ## [1.32.0] - 2026-09-16
 
 ### Features
```

**File**: `Snapzy.xcodeproj/project.pbxproj` (modified, +4/-4)
```diff
@@ -395,7 +395,7 @@
 				CODE_SIGN_ENTITLEMENTS = Snapzy/Snapzy.entitlements;
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 189;
+				CURRENT_PROJECT_VERSION = 188;
 				DEVELOPMENT_TEAM = XMHV5GH2Z7;
 				ENABLE_APP_SANDBOX = NO;
 				ENABLE_HARDENED_RUNTIME = YES;
@@ -413,7 +413,7 @@
 					"@executable_path/../Frameworks",
 				);
 				MACOSX_DEPLOYMENT_TARGET = 13.0;
-				MARKETING_VERSION = 1.32.1;
+				MARKETING_VERSION = 1.32.0;
 				PRODUCT_BUNDLE_IDENTIFIER = com.trongduong.snapzy.debug;
 				PRODUCT_MODULE_NAME = Snapzy;
 				PRODUCT_NAME = "Snapzy Debug";
@@ -437,7 +437,7 @@
 				CODE_SIGN_ENTITLEMENTS = Snapzy/Snapzy.entitlements;
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 189;
+				CURRENT_PROJECT_VERSION = 188;
 				DEVELOPMENT_TEAM = XMHV5GH2Z7;
 				ENABLE_APP_SANDBOX = NO;
 				ENABLE_HARDENED_RUNTIME = YES;
@@ -454,7 +454,7 @@
 					"@executable_path/../Frameworks",
 				);
 				MACOSX_DEPLOYMENT_TARGET = 13.0;
-				MARKETING_VERSION = 1.32.1;
+				MARKETING_VERSION = 1.32.0;
 				PRODUCT_BUNDLE_IDENTIFIER = com.trongduong.snapzy;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				REGISTER_APP_GROUPS = YES;
```

---

### Incident Patch 11: `8beafc0a` (2026-09-17)
**Commit Message**: fix: Fixed recording annotation tool shortcuts bug (#579)

* fix: restore recording annotation tool shortcuts

* test: avoid headless AppKit event dispatch

* test: make annotation toolbar fixture deterministic

* test: isolate annotation shortcut state coverage

**File**: `Snapzy/Features/Recording/Components/RecordingAnnotationCanvasView.swift` (modified, +3/-10)
```diff
@@ -13,7 +13,6 @@ import SwiftUI
 final class RecordingAnnotationCanvasView: NSView {
 
   let state: RecordingAnnotationState
-  private let shortcutManager = AnnotateShortcutManager.shared
 
   private var isDrawing = false
   private var drawStart: CGPoint = .zero
@@ -131,15 +130,9 @@ final class RecordingAnnotationCanvasView: NSView {
 
   override func keyDown(with event: NSEvent) {
     // Tool shortcuts — only when shortcut mode is active (modifier held)
-    if state.isShortcutModeActive,
-       let char = event.characters?.lowercased().first {
-      let tools = RecordingAnnotationState.availableTools
-      if let matchedTool = shortcutManager.tool(for: char),
-         tools.contains(matchedTool) {
-        state.selectedTool = matchedTool
-        needsDisplay = true
-        return
-      }
+    if state.selectTool(for: event) {
+      needsDisplay = true
+      return
     }
 
     switch event.keyCode {
```

**File**: `Snapzy/Features/Recording/Managers/RecordingAnnotationOverlayWindow.swift` (modified, +47/-0)
```diff
@@ -22,6 +22,8 @@ final class RecordingAnnotationOverlayWindow: NSWindow {
   private let shortcutConfig = RecordingAnnotationShortcutConfig.shared
   private var globalFlagsMonitor: Any?
   private var localFlagsMonitor: Any?
+  private var globalKeyMonitor: Any?
+  private var localKeyMonitor: Any?
   private var holdTimer: Timer?
   private var isModifierHeld = false
 
@@ -40,17 +42,21 @@ final class RecordingAnnotationOverlayWindow: NSWindow {
     setupCanvas()
     observeState()
     startModifierMonitor()
+    startKeyMonitor()
   }
 
   deinit {
     // NSEvent.removeMonitor is thread-safe, safe from nonisolated deinit
     if let m = globalFlagsMonitor { NSEvent.removeMonitor(m) }
     if let m = localFlagsMonitor { NSEvent.removeMonitor(m) }
+    if let m = globalKeyMonitor { NSEvent.removeMonitor(m) }
+    if let m = localKeyMonitor { NSEvent.removeMonitor(m) }
     holdTimer?.invalidate()
   }
 
   override func close() {
     stopModifierMonitor()
+    stopKeyMonitor()
     toolCancellable?.cancel()
     toolCancellable = nil
     refreshCancellable?.cancel()
@@ -134,9 +140,50 @@ final class RecordingAnnotationOverlayWindow: NSWindow {
     if let m = localFlagsMonitor { NSEvent.removeMonitor(m); localFlagsMonitor = nil }
     holdTimer?.invalidate()
     holdTimer = nil
+    isModifierHeld = false
     annotationState.isShortcutModeActive = false
   }
 
+  // MARK: - Tool Shortcut Routing
+
+  /// Tool keys must be observed both inside Snapzy (toolbar/status bar focus)
+  /// and outside Snapzy (the recorded application has focus). A global monitor
+  /// cannot consume another application's event, but it can still switch the
+  /// annotation tool; the local monitor consumes matching events addressed to
+  /// Snapzy so they do not fall through to the responder chain and beep.
+  private func startKeyMonitor() {
+    globalKeyMonitor = NSEvent.addGlobalMonitorForEvents(matching: .keyDown) { [weak self] event in
+      MainActor.assumeIsolated {
+        _ = self?.handleToolShortcut(event)
+      }
+    }
+
+    localKeyMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
+      let handled = MainActor.assumeIsolated {
+        self?.handleToolShortcut(event) ?? false
+      }
+      return handled ? nil : event
+    }
+  }
+
+  private func stopKeyMonitor() {
+    if let monitor = globalKeyMonitor {
+      NSEvent.removeMonitor(monitor)
+      globalKeyMonitor = nil
+    }
+    if let monitor = localKeyMonitor {
+      NSEvent.removeMonitor(monitor)
+      localKeyMonitor = nil
+    }
+  }
+
+  @discardableResult
+  private func handleToolShortcut(_ event: NSEvent) -> Bool {
+    guard annotationState.selectTool(for: event) else { return false }
+    canvasView.refresh()
+    return true
+  }
+
   private func handleFlagsChanged(_ event: NSEvent) {
     let requiredFlag = shortcutConfig.modifier.flag
     let isPressed = event.modifierFlags.contains(requiredFlag)
```

**File**: `Snapzy/Features/Recording/Managers/RecordingAnnotationToolbarWindow.swift` (modified, +10/-0)
```diff
@@ -271,6 +271,16 @@ final class RecordingAnnotationToolbarWindow: NSWindow {
     setFrameOrigin(CGPoint(x: x, y: y))
   }
 
+  /// The popover can own first responder while it is visible. Forward tool
+  /// shortcuts here as a direct-window fallback; the annotation overlay's
+  /// local monitor handles normal AppKit event delivery before this method.
+  override func keyDown(with event: NSEvent) {
+    guard annotationState.selectTool(for: event) else {
+      super.keyDown(with: event)
+      return
+    }
+  }
+
   override var canBecomeKey: Bool { true }
 
   override func close() {
```

**File**: `Snapzy/Features/Recording/Models/RecordingAnnotationState.swift` (modified, +18/-0)
```diff
@@ -6,6 +6,7 @@
 //  Supports per-tool auto-clear (time-based and count-based)
 //
 
+import AppKit
 import Combine
 import SwiftUI
 
@@ -78,6 +79,23 @@ final class RecordingAnnotationState: ObservableObject {
     toolClearModes[tool] ?? .persist
   }
 
+  /// Select a recording annotation tool from the active modifier shortcut mode.
+  /// `charactersIgnoringModifiers` is required because Control and Option can
+  /// otherwise transform the character before it reaches the event handler.
+  @discardableResult
+  func selectTool(for event: NSEvent) -> Bool {
+    guard isAnnotationEnabled, isShortcutModeActive else { return false }
+    guard let character = (event.charactersIgnoringModifiers ?? event.characters)?
+      .lowercased().first else { return false }
+    guard let matchedTool = AnnotateShortcutManager.shared.tool(for: character),
+          Self.availableTools.contains(matchedTool) else {
+      return false
+    }
+
+    selectedTool = matchedTool
+    return true
+  }
+
   // MARK: - Annotation Management
 
   func appendAnnotation(_ item: AnnotationItem, tool: AnnotationToolType) {
```

**File**: `SnapzyTests/Features/Recording/RecordingAnnotationStateTests.swift` (modified, +47/-0)
```diff
@@ -5,6 +5,7 @@
 //  Unit tests for RecordingAnnotationState append, clear, count limit, and cleanup.
 //
 
+import AppKit
 import CoreGraphics
 import XCTest
 @testable import Snapzy
@@ -97,4 +98,50 @@ final class RecordingAnnotationStateTests: XCTestCase {
     state.startCleanupTimer()
     state.stopCleanupTimer()
   }
+
+  /// Regression for issue #576: both annotation responders delegate tool
+  /// selection to the shared state, which must preserve the original key when
+  /// Control or Option transforms the event's display character.
+  @MainActor
+  func testSelectTool_routesControlModifiedShortcut() throws {
+    state.isAnnotationEnabled = true
+    state.isShortcutModeActive = true
+    let event = try XCTUnwrap(NSEvent.keyEvent(
+      with: .keyDown,
+      location: .zero,
+      modifierFlags: [.control],
+      timestamp: 0,
+      windowNumber: 0,
+      context: nil,
+      characters: "\u{12}",
+      charactersIgnoringModifiers: "r",
+      isARepeat: false,
+      keyCode: 15 // R
+    ))
+
+    XCTAssertTrue(state.selectTool(for: event))
+    XCTAssertEqual(state.selectedTool, .rectangle)
+  }
+
+  @MainActor
+  func testSelectTool_routesShortcutWithoutAppKitEventDispatch() throws {
+    state.isAnnotationEnabled = true
+    state.isShortcutModeActive = true
+    let event = try XCTUnwrap(NSEvent.keyEvent(
+      with: .keyDown,
+      location: .zero,
+      modifierFlags: [.shift],
+      timestamp: 0,
+      windowNumber: 0,
+      context: nil,
+      characters: "r",
+      charactersIgnoringModifiers: "r",
+      isARepeat: false,
+      keyCode: 15 // R
+    ))
+
+    XCTAssertTrue(state.selectTool(for: event))
+
+    XCTAssertEqual(state.selectedTool, .rectangle)
+  }
 }
```

**File**: `docs/RECORDING.md` (modified, +1/-1)
```diff
@@ -79,7 +79,7 @@ Snapzy windows are normally excluded from the stream; effect overlays are re-inc
 - **Click highlights** (pref `PreferencesKeys.recordingHighlightClicks`, default off): `MouseClickHighlightService` installs local+global NSEvent monitors for down/up/drag and forwards points to `MouseClickHighlightWindow` (`showClickEffect` ripple rings, hold circle while pressed, drag follow).
 - **Keystroke overlay** (pref `PreferencesKeys.recordingShowKeystrokes`, default off): `KeystrokeMonitorService` shows keystrokes only when a modifier (⌘/⌥/⌃) is held or a special key is pressed, building modifier-combo display strings; rendered by `KeystrokeOverlayWindow.showKeystroke`.
 - **Camera overlay** (pref `PreferencesKeys.recordingCaptureCamera`, default off): the toolbar lists the system camera and available devices, including iPhone Continuity Camera. `RecordingCameraOverlayWindow` shows a fixed 16:9 preview at the bottom-right of the recording area. ScreenCaptureKit includes this window in the video. If the camera disconnects, screen recording continues, the overlay shows a waiting message, and Snapzy reconnects the same device when it returns. Camera audio is not used; select a microphone separately.
-- **Live annotations**: `RecordingAnnotationState` + `RecordingAnnotationOverlayWindow` over the recording rect, plus a popover-style `RecordingAnnotationToolbarWindow` anchored to the status bar pencil button (button position reported through a SwiftUI `PreferenceKey`). Tools: selection, rectangle, oval, arrow, line, pencil, highlighter, with per-tool auto-clear modes (persist / time-based / count-based). Global shortcut path: `RecordingCoordinator.togglePenFromShortcut()`.
+- **Live annotations**: `RecordingAnnotationState` + `RecordingAnnotationOverlayWindow` over the recording rect, plus a popover-style `RecordingAnnotationToolbarWindow` anchored to the status bar pencil button (button position reported through a SwiftUI `PreferenceKey`). Tools: selection, rectangle, oval, arrow, line, pencil, highlighter, with per-tool auto-clear modes (persist / time-based / count-based). Global shortcut path: `RecordingCoordinator.togglePenFromShortcut()`. While the configured modifier is held (Shift by default), local and global key-down monitors route tool keys through `RecordingAnnotationState`; local matches are consumed, while global matches switch tools when the recorded app owns focus (Accessibility permission required). Matching uses `charactersIgnoringModifiers` so Control/Option do not change the selected tool key.
 
 The camera overlay starts before `startRecording()` so it can be added to the initial content filter. The other overlays start after recording begins. Region overlay borders are hidden and interaction is disabled at the same moment.
 
```

**File**: `docs/SHORTCUTS.md` (modified, +4/-0)
```diff
@@ -77,6 +77,10 @@ All 19 `GlobalShortcutKind`s with shipping defaults (verified in `KeyboardShortc
 - `pauseResumeRecording` no-ops unless a recording is active (`state.isPauseResumeEligible` guard, logged when ignored).
 - `togglePenRecording` no-ops unless `RecordingCoordinator.shared.isActive`.
 
+## Recording annotation tool shortcuts
+
+While recording annotations are enabled, hold the configured annotation shortcut modifier (Shift by default) and press a tool key to switch tools. `RecordingAnnotationOverlayWindow` routes key-down events through `RecordingAnnotationState` using `charactersIgnoringModifiers`, with a local monitor for events addressed to Snapzy and a global monitor for events addressed to the recorded app. Matching local events are consumed; global monitors are passive and cannot suppress the recorded app's keystroke, and external-app delivery requires Accessibility permission. The visible tool set is selection, rectangle, oval, arrow, line, pencil, and highlighter.
+
 ## Quick Access card action shortcuts (hover-scoped)
 
 `QuickAccessActionShortcutStore` (`Snapzy/Features/QuickAccess/Models/QuickAccessActionShortcutStore.swift`) +
```

**File**: `docs/pr/576-pr-summary.md` (added, +41/-0)
```diff
@@ -0,0 +1,41 @@
+# PR Summary — Issue #576
+
+## 1. Purpose & Motivation (Why)
+
+* **Description:** Restore recording annotation tool shortcuts after annotation mode is entered through the global recording shortcut. The toolbar can become the active window, while the recorded application can retain focus; in both cases the configured modifier + tool key must switch the selected annotation tool.
+* **Ticket Link(s):** [GitHub issue #576](https://github.com/duongductrong/Snapzy/issues/576)
+* **Root cause:** Tool-key handling existed only in `RecordingAnnotationCanvasView`. Recording selection mode intentionally kept the overlay pass-through, and `RecordingAnnotationToolbarWindow` had no key handler. Existing event monitors observed modifier changes only, so tool keys were delivered to the toolbar/status bar or the recorded application instead of the annotation state.
+
+## 2. Key Changes (What)
+
+* Centralize tool-key matching in `RecordingAnnotationState.selectTool(for:)`, using `charactersIgnoringModifiers` so Control/Option do not transform the configured shortcut character.
+* Route key-down events through local and global monitors owned by `RecordingAnnotationOverlayWindow`. Matching local events are consumed; global events switch the tool while the recorded application owns focus.
+* Add a direct `RecordingAnnotationToolbarWindow` responder fallback and keep the existing canvas responder path.
+* Add deterministic regression coverage for centralized state-level shortcut routing, including Control-modified characters.
+* Document the shortcut routing behavior and Accessibility permission requirement in the recording and shortcut guides.
+
+**Recommended review order:**
+
+1. `RecordingAnnotationState` — shared tool-selection rules.
+2. `RecordingAnnotationOverlayWindow` — local/global event routing and lifecycle cleanup.
+3. `RecordingAnnotationToolbarWindow` and `RecordingAnnotationCanvasView` — responder fallbacks.
+4. `RecordingAnnotationStateTests` and documentation.
+
+**Technical decision:** Use the existing AppKit monitor model already used by recording overlays. This covers both Snapzy-owned windows and the externally focused recorded application while preserving the platform constraint that a global monitor cannot suppress another application's key event.
+
+## 3. Verification & Testing (How)
+
+* **Focused regression suite:** `./scripts/run-tests.sh -only-testing:SnapzyTests/RecordingAnnotationStateTests` — 11 tests passed.
+* **Build:** `CLANG_MODULE_CACHE_PATH=build/swift-module-cache xcodebuild -project Snapzy.xcodeproj -scheme Snapzy -configuration Debug -destination 'platform=macOS' -derivedDataPath build/DerivedData build -quiet` — passed.
+* **Static validation:** `git diff --cached --check` — passed.
+* **Covered edge cases:** shortcut-mode gating, centralized routing, and Control-modified input resolved through `charactersIgnoringModifiers`.
+* **Broader-suite note:** The full suite remains affected by two pre-existing Carbon F18 probe failures in `RecordingSessionHotkeyRegistrationTests`; these are unrelated to annotation shortcut routing.
+
+**Manual verification steps:**
+
+1. Start a recording and enter annotation mode using the recording shortcut.
+2. Hold the configured annotation modifier (Shift by default) until tool labels appear.
+3. Press the tool keys and confirm the selected tool changes while the toolbar is focused.
+4. Repeat with the recorded application focused; verify tool switching still works and grant Accessibility permission if macOS requires it.
+
+Closes #576
```

---

### Incident Patch 12: `b48ee9ce` (2026-09-11)
**Commit Message**: fix: Fixed recording-session shortcut gating timing bug (#517)

- Fix @Published willSet timing: observer now uses emitted value instead
  of re-reading isActive (stale by one transition)
- Add sessionActivityOverride to park the emitted state for the duration
  of synchronous refresh
- Add DEBUG setStateForTesting() to drive ScreenRecordingManager state
  for tests
- Add RecordingSessionShortcutObservationTests exercising the real
  $state observation path without stubbing
- Update SHORTCUTS.md with the emission semantics explanation

**File**: `Snapzy/Services/Capture/ScreenRecordingManager.swift` (modified, +9/-0)
```diff
@@ -606,6 +606,15 @@ final class ScreenRecordingManager: NSObject, ObservableObject {
   var isPaused: Bool { state == .paused }
   var isActive: Bool { state != .idle }
 
+  #if DEBUG
+  /// Test-only hook: drive `state` without a real capture session so tests can
+  /// exercise the real `$state` observation path (KeyboardShortcutManager session
+  /// gating re-registers session shortcuts from this publisher).
+  func setStateForTesting(_ newState: RecordingState) {
+    state = newState
+  }
+  #endif
+
   // MARK: - Recording Components
 
   private var stream: SCStream?
```

**File**: `Snapzy/Services/Shortcuts/KeyboardShortcutManager.swift` (modified, +26/-5)
```diff
@@ -626,10 +626,23 @@ final class KeyboardShortcutManager {
   /// tests can substitute a stub to exercise session gating deterministically.
   var isRecordingSessionActive: () -> Bool = { ScreenRecordingManager.shared.isActive }
 
+  /// Authoritative session-activity truth for the current observation-driven refresh.
+  ///
+  /// `@Published` delivers on `willSet`: the sink fires BEFORE the new value is
+  /// committed to `ScreenRecordingManager.state`, so re-reading
+  /// `ScreenRecordingManager.shared.isActive` from inside the sink observes the
+  /// stale pre-transition value (session kinds stayed unregistered during a
+  /// recording and registered after it ended — issue #517). The publisher's
+  /// emitted value is the committed truth; it is parked here only for the
+  /// duration of the refresh it triggered (synchronous, main-actor confined).
+  private var sessionActivityOverride: Bool?
+
   /// Whether a binding for `kind` should hold a global registration right now.
   /// Session-scoped kinds register only while a recording session is active.
   func shouldRegisterNow(for kind: GlobalShortcutKind) -> Bool {
-    !Self.recordingSessionKinds.contains(kind) || isRecordingSessionActive()
+    guard Self.recordingSessionKinds.contains(kind) else { return true }
+    if let sessionActivityOverride { return sessionActivityOverride }
+    return isRecordingSessionActive()
   }
 
   private var fullscreenHotkeyRef: EventHotKeyRef?
@@ -795,14 +808,22 @@ final class KeyboardShortcutManager {
   /// Re-register shortcuts when a recording session starts or ends so
   /// session-scoped kinds only hold their global hotkeys while a session is
   /// active. `state` is only mutated on the main actor, so the sink fires
-  /// synchronously on main and registration stays in lockstep with the session.
+  /// synchronously on main.
+  ///
+  /// The sink acts on the EMITTED value, not on a fresh property read:
+  /// `@Published` fires on willSet, so `ScreenRecordingManager.shared.isActive`
+  /// would still answer with the previous state here (see
+  /// `sessionActivityOverride`).
   private func observeRecordingSessionState() {
     ScreenRecordingManager.shared.$state
       .map { $0 != .idle }
       .removeDuplicates()
       .dropFirst()
-      .sink { [weak self] _ in
-        self?.refreshShortcutRegistration()
+      .sink { [weak self] isActive in
+        guard let self else { return }
+        self.sessionActivityOverride = isActive
+        self.refreshShortcutRegistration()
+        self.sessionActivityOverride = nil
       }
       .store(in: &cancellables)
   }
@@ -1571,7 +1592,7 @@ final class KeyboardShortcutManager {
   /// combo plus its current disposition (registered / fn-monitor / session-gated /
   /// disabled / cleared / skipped).
   private func logRegistrationAudit() {
-    let sessionActive = isRecordingSessionActive()
+    let sessionActive = sessionActivityOverride ?? isRecordingSessionActive()
     let entries = GlobalShortcutKind.allCases.map { kind -> String in
       guard isShortcutEnabled(for: kind) else { return "\(kind.rawValue)=disabled" }
       guard let config = shortcut(for: kind) else { return "\(kind.rawValue)=cleared" }
```

**File**: `SnapzyTests/Services/Shortcuts/RecordingSessionShortcutObservationTests.swift` (added, +270/-0)
```diff
@@ -0,0 +1,270 @@
+//
+//  RecordingSessionShortcutObservationTests.swift
+//  SnapzyTests
+//
+//  Integration tests for the production observation path behind recording-session
+//  shortcut gating: KeyboardShortcutManager re-registers session-scoped shortcuts
+//  (toggle pen, pause/resume, restart, delete) when ScreenRecordingManager.$state
+//  transitions to/from a non-idle session.
+//
+//  Unlike `RecordingSessionShortcutGatingTests` / `RecordingSessionHotkeyRegistrationTests`,
+//  these tests never stub `isRecordingSessionActive` and never call
+//  `refreshShortcutRegistration()` manually — the registration refresh must be driven
+//  by the real `ScreenRecordingManager.$state` publisher, exactly as in the app.
+//
+
+import AppKit
+import Carbon.HIToolbox
+import Combine
+import XCTest
+@testable import Snapzy
+
+final class RecordingSessionShortcutObservationTests: XCTestCase {
+
+  /// Exotic combo (Ctrl+Option+Shift+Cmd+F18) — no system/app should hold it.
+  private let sessionProbeConfig = ShortcutConfig(
+    keyCode: UInt32(kVK_F18),
+    modifiers: UInt32(cmdKey | shiftKey | optionKey | controlKey)
+  )
+
+  private func probeHotkeyID() -> EventHotKeyID {
+    EventHotKeyID(signature: OSType(0x5A54_4F42), id: 981)  // "ZTOB"
+  }
+
+  @discardableResult
+  private func probeRegister(_ config: ShortcutConfig) -> (status: OSStatus, ref: EventHotKeyRef?) {
+    var ref: EventHotKeyRef?
+    let status = RegisterEventHotKey(
+      config.keyCode,
+      config.modifiers,
+      probeHotkeyID(),
+      GetApplicationEventTarget(),
+      0,
+      &ref
+    )
+    return (status, ref)
+  }
+
+  private func assertComboHeld(_ config: ShortcutConfig, _ message: String) {
+    let probe = probeRegister(config)
+    XCTAssertEqual(probe.status, OSStatus(-9878), message)  // eventHotKeyExistsErr
+    if let ref = probe.ref { UnregisterEventHotKey(ref) }
+  }
+
+  private func assertComboFree(_ config: ShortcutConfig, _ message: String) {
+    let probe = probeRegister(config)
+    XCTAssertEqual(probe.status, noErr, message)
+    if let ref = probe.ref { UnregisterEventHotKey(ref) }
+  }
+
+  @MainActor
+  private func preserveManagerState(of manager: KeyboardShortcutManager) {
+    let wasEnabled = manager.isEnabled
+    let originalConfig = manager.shortcut(for: .togglePenRecording)
+    let originalEnabled = manager.isShortcutEnabled(for: .togglePenRecording)
+    addTeardownBlock { @MainActor in
+      manager.setTogglePenRecordingShortcut(originalConfig)
+      manager.setShortcutEnabled(originalEnabled, for: .togglePenRecording)
+      ScreenRecordingManager.shared.setStateForTesting(.idle)
+      wasEnabled ? manager.enable() : manager.disable()
+    }
+  }
+
+  @MainActor
+  private func requireFreeProbe(_ config: ShortcutConfig) throws {
+    let pre = probeRegister(config)
+    guard pre.status == noErr else {
+      throw XCTSkip("Probe combo unexpectedly held before test (status \(pre.status))")
+    }
+    UnregisterEventHotKey(pre.ref!)
+  }
+
+  /// The regression scenario for issue #517: bind the toggle-pen shortcut while
+  /// Snapzy is idle, start a recording session, press the combo — the Carbon
+  /// registration must appear purely from the $state observation, with no
+  /// manual refresh.
+  @MainActor
+  func testTogglePenShortcut_becomesRegisteredWhenRecordingSessionStarts() throws {
+    try skipIfRunningInCI("Carbon hotkey registration is unsupported on headless CI runners")
+    let manager = KeyboardShortcutManager.shared
+    preserveManagerState(of: manager)
+    try requireFreeProbe(sessionProbeConfig)
+
+    manager.enable()
+    // Snapzy idle: session-scoped kind must not hold its combo.
+    XCTAssertFalse(manager.shouldRegisterNow(for: .togglePenRecording))
+
+    manager.setTogglePenRecordingShortcut(sessionProbeConfig)
+    manager.setShortcutEnabled(true, for: .togglePenRecording)
+    assertComboFree(
+      sessionProbeConfig,
+      "Toggle-pen shortcut must not hold its combo while no recording session is active"
+    )
+
+    // Start a recording session the way the recorder does: a state transition
+    // on the live ScreenRecordingManager publisher (preparing → recording).
+    ScreenRecordingManager.shared.setStateForTesting(.preparing)
+    assertComboHeld(
+      sessionProbeConfig,
+      "Toggle-pen shortcut must hold its combo as soon as the recording session starts — registration must be driven by the real $state publisher"
+    )
+
+    ScreenRecordingManager.shared.setStateForTesting(.recording)
+    assertComboHeld(
+      sessionProbeConfig,
+      "Toggle-pen shortcut must keep its combo while the session is recording"
+    )
+  }
+
+  /// The session end path: the combo must be released without any manual refresh.
+  @MainActor
+  func testTogglePenShortcut_releasedWhenRecordingSessionEnds() throws {
+    try skipIfRunningInCI("Carbon hotkey registration is unsupported on headless CI runners")
+    let manager = KeyboardShortcutManager
```

**File**: `docs/SHORTCUTS.md` (modified, +2/-1)
```diff
@@ -27,7 +27,8 @@ flowchart TD
 - Delegate: `KeyboardShortcutDelegate.shortcutTriggered(ShortcutAction)` — implemented by `ScreenCaptureViewModel` (`Snapzy/Features/Capture/CaptureViewModel.swift`).
 - Global enable: `shortcutsEnabled` UserDefaults flag; `enable()` / `disable()` re-register everything. Restored at init if previously enabled.
 - Temporary suspension: `beginTemporaryShortcutSuppression()` / `endTemporaryShortcutSuppression()` — refcounted, unregisters hotkeys without touching the persisted enabled flag (used while recording shortcut input).
-- Recording-session gating: the four recording-session kinds (`pauseResumeRecording`, `togglePenRecording`, `restartRecording`, `deleteRecording`) hold a global registration **only while a recording session is active** (`ScreenRecordingManager.shared.isActive`). The manager observes `ScreenRecordingManager.shared.$state` and re-registers when `isActive` toggles (`shouldRegisterNow(for:)`), so those combos stay free for other apps while Snapzy is idle; Fn-based session bindings likewise stay out of `fnBindings` while idle. `recording` itself is **not** gated — it starts recordings and must stay global.
+- Recording-session gating: the four recording-session kinds (`pauseResumeRecording`, `togglePenRecording`, `restartRecording`, `deleteRecording`) hold a global registration **only while a recording session is active** (`ScreenRecordingManager.shared.isActive`). The manager observes `ScreenRecordingManager.shared.$state` and re-registers when session activity toggles (`shouldRegisterNow(for:)`), so those combos stay free for other apps while Snapzy is idle; Fn-based session bindings likewise stay out of `fnBindings` while idle. `recording` itself is **not** gated — it starts recordings and must stay global.
+  - The observer acts on the **emitted** state value, never on a fresh `isActive` read inside the sink: `@Published` delivers on `willSet`, so a property re-read inside the sink observes the stale pre-transition value and registration would run one transition behind (session hotkeys missing during recordings, combos left held after they end — issue #517). The emitted value is parked in `sessionActivityOverride` for the duration of the refresh it triggers.
 - Per-shortcut disable set: `shortcuts.disabledGlobalActions` (`PreferencesKeys.disabledGlobalShortcuts`).
 - Cleared/unbound set: `shortcuts.clearedGlobalActions` (`PreferencesKeys.clearedGlobalShortcuts`) — `shortcut(for:)` returns `nil` for cleared kinds.
 
```

---

### Incident Patch 13: `5b1e4393` (2026-09-10)
**Commit Message**: feat: Modernize preferences UI, settings navigation, and interactive onboarding flow (#557)

* feat: Improved modern preferences sidebar with navigation history

- NavigationSplitView sidebar with 4 grouped categories (Ruru/System
  Settings style)
- Back/forward navigation via backStack/forwardStack (⌘[ / ⌘])
- Last-visited tab persistence across app launches
- Dedicated PreferencesWindowController managing window lifecycle and
  activation policy
- Support "menubar"/"menu-bar" aliases in deep links

* feat: Added update badge to preferences sidebar

- Added PreferencesSidebarUpdateBadge at bottom of sidebar
- Uses safeAreaInset for proper positioning

* feat: Added sidebar update badge component

- New PreferencesSidebarUpdateBadge view for preferences sidebar
- Displays app icon, name, version, and update channel badge
- Provides quick update check and channel switching via context menu

* feat: Improved onboarding flow step 1

- Show onboarding window if forceOnboarding is true or onboarding not
  completed
- Otherwise proceed with normal splash display

* feat: Added Step 2 screen recording onboarding flow with mock UI
components

- Introduce SnapzyCurvedHintArrow for guiding 

**File**: `.github/workflows/ci.yml` (modified, +8/-1)
```diff
@@ -46,12 +46,14 @@ jobs:
             SnapzyTests/OCRModelSelectionTests
             SnapzyTests/PreferencesOCRModelSelectionTests
             SnapzyTests/OCRKeychainStoreTests
+            SnapzyTests/RemoteOCRServiceTests
             SnapzyTests/SmartElementCaptureControllerTests
             SnapzyTests/SmartElementWindowOwnerResolverTests
             SnapzyTests/SmartElementQueryServiceTests
             SnapzyTests/SandboxOffDataMigrationServiceTests
             SnapzyTests/AppStatusBarControllerTests
             SnapzyTests/RecordingAudioLevelMeterTests
+            SnapzyTests/RecordingToolbarWindowTests/testShowRecordingStatusBar_alreadyVisibleWindow_enablesBackgroundDragging
             SnapzyTests/CaptureViewModelTests/testHiddenWindowSession_restore_postsSyntheticMouseMovedEvent
             SnapzyTests/AnnotateCreationTests/testCanExtractTextRequiresNormalAnnotateSourceImage
             SnapzyTests/AnnotateExportSaveTests/testCopyToClipboardRunsWithoutCrashing
@@ -68,11 +70,15 @@ jobs:
             SnapzyTests/AreaSelectionSessionLifecycleTests
             SnapzyTests/AreaSelectionHoverPerformanceTests
             SnapzyTests/AreaSelectionControllerTests
+            SnapzyTests/AreaSelectionModelsTests
+            SnapzyTests/AreaSelectionOverlayPassthroughStaleLocationTests
+            SnapzyTests/AreaSelectionLivePassthroughWindowDetectionTests
             SnapzyTests/AreaSelectionOverlayMagnifierLayoutTests/testMagnifierZoom_worksWithEmptyBackdropsInitially
             SnapzyTests/PersistedCombineSessionTests/testCaptureStitchSaveReopen_persistsStitchEverywhere
             SnapzyTests/BackgroundCursorControlTests
             SnapzyTests/LivePassthroughInputLogicTests
             SnapzyTests/HotkeyUnregistrationTests
+            SnapzyTests/RecordingSessionShortcutGatingTests
             SnapzyTests/RecordingSessionHotkeyRegistrationTests
         run: |
           set -euo pipefail
@@ -97,13 +103,14 @@ jobs:
             -destination 'platform=macOS' \
             -derivedDataPath build/DerivedData \
             -resultBundlePath build/ci-test.xcresult \
+            -parallel-testing-enabled NO \
             CODE_SIGN_IDENTITY="" \
             CODE_SIGNING_REQUIRED=NO \
             CODE_SIGNING_ALLOWED=NO \
             "${test_args[@]}" \
             test > build/ci-test.log 2>&1; then
             echo "::group::Likely test failures"
-            grep -E "Test case '.*' failed|Failing tests:|\\*\\* TEST FAILED \\*\\*|error:" build/ci-test.log || true
+            grep -E "Test [Cc]ase '.*' (failed|skipped)|Test crashed|malloc:|Failing tests:|\\*\\* TEST FAILED \\*\\*|error:" build/ci-test.log || true
             echo "::endgroup::"
             tail -200 build/ci-test.log
             exit 1
```

**File**: `Snapzy/App/AppStatusBarController.swift` (modified, +7/-16)
```diff
@@ -863,20 +863,18 @@ final class AppStatusBarController: ObservableObject {
 
   func openPreferencesWindow(tab: PreferencesTab? = nil) {
     if let tab {
-      PreferencesNavigationState.shared.selectedTab = tab
+      PreferencesNavigationState.shared.select(tab)
     }
     DiagnosticLogger.shared.log(
       .info,
       .preferences,
       "Preferences window requested",
       context: ["tab": tab.map { "\($0)" } ?? "current"]
     )
-    presentPreferencesWindow()
+    presentPreferencesWindow(tab: tab)
   }
 
-  private func presentPreferencesWindow() {
-    let existingWindowNumbers = Set(NSApp.windows.map(\.windowNumber))
-
+  private func presentPreferencesWindow(tab: PreferencesTab? = nil) {
     // Elevate to regular app so Snapzy appears in top-left menu bar
     if !didElevateForSettings {
       NSApp.setActivationPolicy(.regular)
@@ -892,19 +890,12 @@ final class AppStatusBarController: ObservableObject {
       )
     }
 
-    NSApp.activate(ignoringOtherApps: true)
+    PreferencesWindowController.shared.show(tab: tab)
 
-    // Trigger Settings scene - equivalent to SettingsLink behavior.
-    // Simulating Cmd+, fails on layouts where AppKit mirrors the Settings item's
-    // key equivalent to the physical comma key's character (e.g. "ö" on Turkish
-    // layouts, issue #311), so find and perform the menu item directly instead.
-    if #available(macOS 14.0, *) {
-      attemptToTriggerSettings(remainingAttempts: Self.settingsTriggerMaxAttempts)
-    } else {
-      NSApp.sendAction(Selector(("showSettingsWindow:")), to: nil, from: nil)
+    if let window = PreferencesWindowController.shared.window {
+      trackedPreferencesWindow = window
+      syncTrackedPreferencesWindowExclusion()
     }
-
-    schedulePreferencesWindowTracking(excludingWindowNumbers: existingWindowNumbers)
   }
 
   // MARK: - Settings Scene Trigger
```

**File**: `Snapzy/App/SnapzyApp.swift` (modified, +5/-0)
```diff
@@ -7,6 +7,7 @@
 
 import AppKit
 import Carbon
+import CoreGraphics
 import SwiftUI
 
 // MARK: - Notification Names
@@ -21,6 +22,10 @@ struct SnapzyApp: App {
   @ObservedObject private var themeManager = ThemeManager.shared
 
   init() {
+    if CommandLine.arguments.contains("--check-screen-capture-granted") {
+      let granted = CGPreflightScreenCaptureAccess()
+      exit(granted ? 0 : 1)
+    }
     AppIdentityManager.shared.refresh()
   }
 
```

**File**: `Snapzy/App/SnapzyDeepLinkHandler.swift` (modified, +2/-0)
```diff
@@ -229,6 +229,8 @@ enum SnapzyDeepLinkAction: Equatable {
     switch name {
     case "general":
       return .general
+    case "menubar", "menu-bar":
+      return .menuBar
     case "capture", "screenshots", "screenshot":
       return .capture
     case "annotate", "annotation", "annotations":
```

**File**: `Snapzy/Features/Onboarding/Components/SnapzyCurvedHintArrow.swift` (added, +177/-0)
```diff
@@ -0,0 +1,177 @@
+//
+//  SnapzyCurvedHintArrow.swift
+//  Snapzy
+//
+//  Animated curved vector hint arrow with pure text label.
+//  Directs user attention to target interactive controls during onboarding.
+//
+
+import SwiftUI
+
+enum SnapzyHintArrowOrientation {
+  case curveDownToTarget   // Label sits above, curves down to point at target
+  case curveLeftToTarget   // Label sits to the right, curves down-left to point at target
+  case curveRightToTarget  // Label sits to the left, curves down-right to point at target
+}
+
+struct SnapzyCurvedHintArrow: View {
+  let text: String
+  var orientation: SnapzyHintArrowOrientation = .curveDownToTarget
+  var arrowAlignment: HorizontalAlignment = .center
+  var color: Color = .white
+
+  @State private var floatOffset: CGFloat = 0
+
+  var body: some View {
+    Group {
+      switch orientation {
+      case .curveDownToTarget:
+        downToTargetLayout
+      case .curveLeftToTarget:
+        leftToTargetLayout
+      case .curveRightToTarget:
+        rightToTargetLayout
+      }
+    }
+    .onAppear {
+      withAnimation(
+        Animation.easeInOut(duration: 1.6)
+          .repeatForever(autoreverses: true)
+      ) {
+        floatOffset = -3
+      }
+    }
+  }
+
+  // MARK: - Layout: Label above, curve arcs down to target
+
+  private var downToTargetLayout: some View {
+    VStack(alignment: arrowAlignment, spacing: 2) {
+      labelView
+
+      // Vector curved stroke with arrowhead
+      ZStack {
+        // Dark contour stroke for high contrast on light backgrounds
+        Path { path in
+          path.move(to: CGPoint(x: 45, y: 0))
+          path.addQuadCurve(to: CGPoint(x: 18, y: 36), control: CGPoint(x: 45, y: 24))
+        }
+        .stroke(Color.black.opacity(0.45), style: StrokeStyle(lineWidth: 3.2, lineCap: .round))
+
+        // Crisp main stroke
+        Path { path in
+          path.move(to: CGPoint(x: 45, y: 0))
+          path.addQuadCurve(to: CGPoint(x: 18, y: 36), control: CGPoint(x: 45, y: 24))
+        }
+        .stroke(color, style: StrokeStyle(lineWidth: 1.8, lineCap: .round))
+
+        // Arrowhead
+        arrowHead(tip: CGPoint(x: 18, y: 36), from: CGPoint(x: 45, y: 24))
+      }
+      .frame(width: 60, height: 38)
+      .shadow(color: Color.black.opacity(0.60), radius: 3, x: 0, y: 1)
+      .padding(.trailing, arrowAlignment == .trailing ? 14 : 0)
+      .padding(.leading, arrowAlignment == .leading ? 14 : 0)
+    }
+    .offset(y: floatOffset)
+  }
+
+  // MARK: - Layout: Label to the right, curves left to point at card
+
+  private var leftToTargetLayout: some View {
+    HStack(alignment: .bottom, spacing: 6) {
+      ZStack {
+        // Dark contour stroke
+        Path { path in
+          path.move(to: CGPoint(x: 58, y: 6))
+          path.addQuadCurve(to: CGPoint(x: 4, y: 32), control: CGPoint(x: 48, y: 36))
+        }
+        .stroke(Color.black.opacity(0.45), style: StrokeStyle(lineWidth: 3.2, lineCap: .round))
+
+        // Main stroke
+        Path { path in
+          path.move(to: CGPoint(x: 58, y: 6))
+          path.addQuadCurve(to: CGPoint(x: 4, y: 32), control: CGPoint(x: 48, y: 36))
+        }
+        .stroke(color, style: StrokeStyle(lineWidth: 1.8, lineCap: .round))
+
+        // Arrowhead
+        arrowHead(tip: CGPoint(x: 4, y: 32), from: CGPoint(x: 48, y: 36))
+      }
+      .frame(width: 62, height: 38)
+      .shadow(color: Color.black.opacity(0.60), radius: 3, x: 0, y: 1)
+
+      labelView
+        .padding(.bottom, 10)
+    }
+    .offset(y: floatOffset)
+  }
+
+  // MARK: - Layout: Label to the left, curves right to point at target
+
+  private var rightToTargetLayout: some View {
+    HStack(alignment: .bottom, spacing: 6) {
+      labelView
+        .padding(.bottom, 10)
+
+      ZStack {
+        // Dark contour stroke
+        Path { path in
+          path.move(to: CGPoint(x: 4, y: 6))
+          path.addQuadCurve(to: CGPoint(x: 58, y: 32), control: CGPoint(x: 14, y: 36))
+        }
+        .stroke(Color.black.opacity(0.45), style: StrokeStyle(lineWidth: 3.2, lineCap: .round))
+
+        // Main stroke
+        Path { path in
+          path.move(to: CGPoint(x: 4, y: 6))
+          path.addQuadCurve(to: CGPoint(x: 58, y: 32), control: CGPoint(x: 14, y: 36))
+        }
+        .stroke(color, style: StrokeStyle(lineWidth: 1.8, lineCap: .round))
+
+        // Arrowhead
+        arrowHead(tip: CGPoint(x: 58, y: 32), from: CGPoint(x: 14, y: 36))
+      }
+      .frame(width: 62, height: 38)
+      .shadow(color: Color.black.opacity(0.60), radius: 3, x: 0, y: 1)
+    }
+    .offset(y: floatOffset)
+  }
+
+  // MARK: - Arrowhead Generator
+
+  private func arrowHead(tip: CGPoint, from control: CGPoint) -> some View {
+    Path { path in
+      let tipAngle = atan2(tip.y - control.y, tip.x - control.x)
+      let headLength: CGFloat = 8
+      let headAngle: CGFloat = .pi / 5.2
+      path.move(to: tip)
+      path.addLine(to: CGPoint(
+        x: tip.x - headLength * cos
```

**File**: `Snapzy/Features/Onboarding/Components/SnapzyOnboardingActionBar.swift` (added, +152/-0)
```diff
@@ -0,0 +1,152 @@
+//
+//  SnapzyOnboardingActionBar.swift
+//  Snapzy
+//
+//  Rounded-full capsule Liquid Glass Action Bar with tactile spring button feedback.
+//
+
+import SwiftUI
+
+struct SnapzyOnboardingActionBar: View {
+  var skipTitle: String? = nil
+  var continueTitle: String
+  var continueKey: String? = nil
+  var isContinueEnabled: Bool = true
+  var isBusy: Bool = false
+  var minWidth: CGFloat? = nil
+  var onSkip: (() -> Void)? = nil
+  var onContinue: () -> Void
+
+  private let barHeight: CGFloat = 40
+
+  var body: some View {
+    HStack(spacing: 0) {
+      if let skipTitle, let onSkip {
+        SnapzyOnboardingBarSegment(
+          title: skipTitle,
+          trailingKey: nil,
+          isEnabled: true,
+          isBusy: false,
+          action: onSkip
+        )
+
+        // Etched vertical hairline divider
+        Rectangle()
+          .fill(
+            LinearGradient(
+              colors: [
+                Color.white.opacity(0.0),
+                Color.white.opacity(0.18),
+                Color.white.opacity(0.0),
+              ],
+              startPoint: .top,
+              endPoint: .bottom
+            )
+          )
+          .frame(width: SnapzySurfaceGlass.specularLineWidth, height: 18)
+          .padding(.horizontal, 2)
+      }
+
+      SnapzyOnboardingBarSegment(
+        title: continueTitle,
+        trailingKey: continueKey,
+        isEnabled: isContinueEnabled,
+        isBusy: isBusy,
+        action: onContinue
+      )
+    }
+    .padding(3.5)
+    .frame(height: barHeight)
+    .frame(minWidth: minWidth)
+    .background {
+      SnapzyGlassSurface(
+        shape: Capsule(style: .continuous),
+        substrate: SnapzySurfaceGlass.baseDarkness,
+        tint: 0.04
+      )
+    }
+    .clipShape(Capsule(style: .continuous))
+    .shadow(color: Color.black.opacity(0.20), radius: 12, y: 5)
+    .shadow(color: Color.black.opacity(0.10), radius: 2, y: 1)
+    .animation(SnapzyMotionPreferences.shared.spec(.settle).animation, value: isContinueEnabled)
+  }
+}
+
+private struct SnapzyOnboardingBarSegment: View {
+  var title: String
+  var trailingKey: String?
+  var isEnabled: Bool = true
+  var isBusy: Bool = false
+  var action: () -> Void
+
+  @State private var isHovered = false
+
+  var body: some View {
+    Button(action: {
+      guard isEnabled, !isBusy else { return }
+      action()
+    }) {
+      HStack(spacing: SnapzySpace.sm) {
+        if isBusy {
+          ProgressView()
+            .controlSize(.small)
+            .tint(SnapzyGlassInk.primary)
+        }
+
+        Text(title)
+          .font(.system(
+            size: SnapzyOnboardingType.body + 1,
+            weight: (isHovered && isEnabled) ? .semibold : .medium
+          ))
+          .foregroundStyle(
+            !isEnabled
+              ? Color.white.opacity(0.30)
+              : (isHovered ? SnapzyGlassInk.primary : SnapzyGlassInk.body)
+          )
+
+        if let trailingKey, !isBusy {
+          SnapzyKeycapChip(label: trailingKey, emphasis: isHovered && isEnabled)
+            .opacity(isEnabled ? 1.0 : 0.35)
+        }
+      }
+      .padding(.horizontal, SnapzySpace.xl + 1)
+      .frame(maxHeight: .infinity)
+      .background { segmentSurface }
+      .contentShape(Capsule(style: .continuous))
+    }
+    .buttonStyle(SnapzyInteractiveButtonStyle(isEnabled: isEnabled && !isBusy))
+    .disabled(!isEnabled || isBusy)
+    .onHover { hovering in
+      guard isEnabled, !isBusy else {
+        isHovered = false
+        return
+      }
+      withAnimation(SnapzyMotionPreferences.shared.spec(.hover).animation) {
+        isHovered = hovering
+      }
+    }
+    .animation(SnapzyMotionPreferences.shared.spec(.settle).animation, value: isEnabled)
+  }
+
+  @ViewBuilder
+  private var segmentSurface: some View {
+    if isHovered && isEnabled {
+      SnapzyGlassSurface(
+        shape: Capsule(style: .continuous),
+        substrate: SnapzySurfaceGlass.controlSubstrateHover,
+        tint: 0.10,
+        highlight: .custom(top: 0.24, bottom: 0.08)
+      )
+    }
+  }
+}
+
+private struct SnapzyInteractiveButtonStyle: ButtonStyle {
+  var isEnabled: Bool = true
+
+  func makeBody(configuration: Configuration) -> some View {
+    configuration.label
+      .scaleEffect((configuration.isPressed && isEnabled) ? 0.96 : 1.0)
+      .animation(.spring(response: 0.18, dampingFraction: 0.8), value: configuration.isPressed)
+  }
+}
```

**File**: `Snapzy/Features/Onboarding/Components/SnapzyOnboardingChrome.swift` (added, +138/-0)
```diff
@@ -0,0 +1,138 @@
+//
+//  SnapzyOnboardingChrome.swift
+//  Snapzy
+//
+//  Header brand mark, language selector, close button, and footer escape affordance.
+//
+
+import AppKit
+import SwiftUI
+
+// MARK: - Overline
+
+struct SnapzyOnboardingOverline: View {
+  var text: String
+  var tint: Color = SnapzyGlassInk.muted
+
+  init(_ text: String, tint: Color = SnapzyGlassInk.muted) {
+    self.text = text
+    self.tint = tint
+  }
+
+  var body: some View {
+    Text(text.uppercased())
+      .font(.system(size: SnapzyOnboardingType.sectionLabel, weight: .semibold))
+      .tracking(1.3)
+      .foregroundStyle(tint)
+  }
+}
+
+// MARK: - Close Button
+
+struct SnapzyOnboardingCloseButton: View {
+  var action: () -> Void
+
+  @State private var isHovered = false
+
+  var body: some View {
+    Button(action: action) {
+      Image(systemName: "xmark")
+        .font(.system(size: 11, weight: .semibold))
+        .foregroundStyle(isHovered ? SnapzyGlassInk.primary : SnapzyGlassInk.muted)
+        .frame(width: 28, height: 28)
+        .background(
+          Circle()
+            .fill(Color.white.opacity(isHovered ? 0.16 : 0.08))
+            .overlay(Circle().strokeBorder(Color.white.opacity(0.10), lineWidth: 0.5))
+        )
+    }
+    .buttonStyle(.plain)
+    .onHover { hovering in
+      withAnimation(SnapzyMotionPreferences.shared.spec(.hover).animation) {
+        isHovered = hovering
+      }
+    }
+    .accessibilityLabel(L10n.Onboarding.chromeCloseAccessibility)
+  }
+}
+
+// MARK: - Language Picker Pill
+
+struct SnapzyOnboardingLanguagePicker: View {
+  @EnvironmentObject private var onboardingLocalization: OnboardingLocalizationController
+
+  var body: some View {
+    Menu {
+      Button {
+        onboardingLocalization.selectLanguage("")
+      } label: {
+        HStack {
+          Text(L10n.Onboarding.chromeLanguageAutoSystem)
+          if onboardingLocalization.selectedLanguageIdentifier.isEmpty {
+            Image(systemName: "checkmark")
+          }
+        }
+      }
+
+      Divider()
+
+      ForEach(onboardingLocalization.availableOptions) { option in
+        Button {
+          onboardingLocalization.selectLanguage(option.identifier)
+        } label: {
+          HStack {
+            Text(option.displayName)
+            if onboardingLocalization.selectedLanguageIdentifier == option.identifier {
+              Image(systemName: "checkmark")
+            }
+          }
+        }
+      }
+    } label: {
+      HStack(spacing: SnapzySpace.sm) {
+        Image(systemName: "globe")
+          .font(.system(size: 11, weight: .medium))
+          .foregroundStyle(SnapzyGlassInk.muted)
+
+        Text(currentLanguageLabel)
+          .font(.system(size: SnapzyOnboardingType.caption, weight: .medium))
+          .foregroundStyle(SnapzyGlassInk.body)
+
+        Image(systemName: "chevron.down")
+          .font(.system(size: 8, weight: .semibold))
+          .foregroundStyle(SnapzyGlassInk.muted)
+      }
+      .padding(.horizontal, SnapzySpace.lg)
+      .frame(height: 28)
+      .background(
+        Capsule()
+          .fill(Color.white.opacity(0.08))
+          .overlay(Capsule().strokeBorder(Color.white.opacity(0.12), lineWidth: 0.5))
+      )
+    }
+    .menuStyle(.borderlessButton)
+    .fixedSize()
+  }
+
+  private var currentLanguageLabel: String {
+    if onboardingLocalization.selectedLanguageIdentifier.isEmpty {
+      return onboardingLocalization.systemResolvedOption?.displayName ?? L10n.Onboarding.chromeLanguageAuto
+    }
+    return onboardingLocalization.availableOptions.first(where: { $0.identifier == onboardingLocalization.selectedLanguageIdentifier })?.displayName ?? L10n.Onboarding.chromeLanguageLabel
+  }
+}
+
+// MARK: - Escape Hint
+
+struct SnapzyOnboardingEscapeHint: View {
+  var text: String
+
+  var body: some View {
+    HStack(spacing: SnapzySpace.md) {
+      SnapzyKeycapChip(label: "esc")
+      Text(text)
+        .font(.system(size: SnapzyOnboardingType.caption))
+        .foregroundStyle(SnapzyGlassInk.muted)
+    }
+  }
+}
```

**File**: `Snapzy/Features/Onboarding/Components/SnapzyOnboardingCompletionCard.swift` (added, +268/-0)
```diff
@@ -0,0 +1,268 @@
+//
+//  SnapzyOnboardingCompletionCard.swift
+//  Snapzy
+//
+//  Celebratory completion view with Dark Liquid Glass aesthetics, clean logo presentation,
+//  monochrome capability cards showcase, ecosystem links, and consistent action bar button.
+//
+
+import AppKit
+import SwiftUI
+
+struct SnapzyOnboardingCompletionCard: View {
+  var onFinish: () -> Void
+  var onBack: (() -> Void)? = nil
+
+  @State private var hasAppeared = false
+
+  var body: some View {
+    VStack(spacing: 22) {
+      Spacer(minLength: 8)
+
+      // 1. Clean Logo (no border, no check, no shadow)
+      heroLogo
+        .opacity(hasAppeared ? 1 : 0)
+
+      // 2. Headline & Description (monochrome simple palette)
+      headerSection
+        .opacity(hasAppeared ? 1 : 0)
+
+      // 3. Core Capabilities (monochrome 4-card glass grid)
+      capabilitiesGrid
+        .opacity(hasAppeared ? 1 : 0)
+
+      // 4. Community & Open Source Row (monochrome pills)
+      communityRow
+        .opacity(hasAppeared ? 1 : 0)
+
+      // 5. Primary Action Button (same style as previous onboarding steps)
+      primaryActionRow
+        .opacity(hasAppeared ? 1 : 0)
+
+      Spacer(minLength: 8)
+    }
+    .frame(maxWidth: 900)
+    .onAppear {
+      withAnimation(SnapzyMotionPreferences.shared.spec(.morph).animation) {
+        hasAppeared = true
+      }
+    }
+  }
+
+  // MARK: - Hero Logo
+
+  private var heroLogo: some View {
+    Image(nsImage: NSApp.applicationIconImage)
+      .resizable()
+      .aspectRatio(contentMode: .fit)
+      .frame(width: 56, height: 56)
+      .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
+  }
+
+  // MARK: - Header Section
+
+  private var headerSection: some View {
+    VStack(spacing: 8) {
+      SnapzyOnboardingOverline(L10n.Onboarding.completionCardOverline)
+
+      Text(L10n.Onboarding.completionCardTitle)
+        .font(.system(size: 28, weight: .bold))
+        .tracking(-0.5)
+        .foregroundStyle(SnapzyGlassInk.primary)
+
+      Text(L10n.Onboarding.completionCardSubtitle)
+        .font(.system(size: SnapzyOnboardingType.lede))
+        .foregroundStyle(SnapzyGlassInk.body)
+        .multilineTextAlignment(.center)
+        .lineSpacing(3)
+        .frame(maxWidth: 580)
+    }
+  }
+
+  // MARK: - Capabilities Grid
+
+  private var capabilitiesGrid: some View {
+    HStack(spacing: 12) {
+      CapabilityCard(
+        icon: "camera.viewfinder",
+        shortcut: "⇧⌘4",
+        title: L10n.Onboarding.completionAreaCaptureTitle,
+        detail: L10n.Onboarding.completionAreaCaptureDetail
+      )
+
+      CapabilityCard(
+        icon: "record.circle",
+        shortcut: "⇧⌘5",
+        title: L10n.Onboarding.completionScreenRecordingTitle,
+        detail: L10n.Onboarding.completionScreenRecordingDetail
+      )
+
+      CapabilityCard(
+        icon: "text.viewfinder",
+        shortcut: "⇧⌘2",
+        title: L10n.Onboarding.completionOcrTitle,
+        detail: L10n.Onboarding.completionOcrDetail
+      )
+
+      CapabilityCard(
+        icon: "menubar.rectangle",
+        shortcut: "⌘,",
+        title: L10n.Onboarding.completionMenubarHubTitle,
+        detail: L10n.Onboarding.completionMenubarHubDetail
+      )
+    }
+    .frame(maxWidth: 880)
+  }
+
+  // MARK: - Community Links
+
+  private var communityRow: some View {
+    HStack(spacing: 12) {
+      CommunityLinkPill(
+        title: L10n.Onboarding.completionStarGithub,
+        icon: "star.fill",
+        url: "https://github.com/duongductrong/Snapzy"
+      )
+
+      CommunityLinkPill(
+        title: L10n.Onboarding.completionJoinDiscord,
+        icon: "bubble.left.and.bubble.right.fill",
+        url: "https://discord.gg/xkWDAuJkZu"
+      )
+
+      CommunityLinkPill(
+        title: L10n.Onboarding.completionSponsorProject,
+        icon: "heart.fill",
+        url: "https://github.com/sponsors/duongductrong"
+      )
+    }
+    .padding(.vertical, 2)
+  }
+
+  // MARK: - Primary Action
+
+  private var primaryActionRow: some View {
+    VStack(spacing: 10) {
+      SnapzyOnboardingActionBar(
+        continueTitle: L10n.Onboarding.completionStartUsing,
+        continueKey: "\u{21A9}",
+        isContinueEnabled: true,
+        onContinue: onFinish
+      )
+
+      if let onBack {
+        Button(action: onBack) {
+          Text(L10n.Onboarding.completionReviewHint)
+            .font(.system(size: 11))
+            .foregroundStyle(SnapzyGlassInk.faint)
+        }
+        .buttonStyle(.plain)
+      }
+    }
+  }
+}
+
+// MARK: - Capability Card
+
+private struct CapabilityCard: View {
+  var icon: String
+  var shortcut: String
+  var title: String
+  var detail: String
+
+  @State private var isHovered = false
+
+  var body: some View {
+    VStack(alignment: .leading, spacing: 10) {
+      HStack {
+        // Monochrome glass icon container matching previous steps
+        Image(systemName: icon)
+          .font(.system(size: 13))
+          .foregroundStyle(S
```

---

### Incident Patch 14: `348bd768` (2026-09-09)
**Commit Message**: fix: Fixed canvas hit testing under SwiftUI zoom/pan transforms

- Add CanvasInteractionBridge to connect SwiftUI canvas to AppKit
  drawing view
- Add CanvasInteractionProxy that forwards events when window point
  falls inside transformed canvas bounds
- Preserve context menu responder chain for zoomed canvas content
- Add tests for zoomed hit tolerance normalization and large canvas
  interaction

**File**: `Snapzy/Features/Annotate/Components/AnnotateCanvasDrawingView.swift` (modified, +189/-7)
```diff
@@ -15,11 +15,14 @@ struct CanvasDrawingView: NSViewRepresentable {
   var displayScale: CGFloat = 1.0
   var canvasBounds: CGRect
   var acceptsFirstMouse = false
+  var interactionBridge: CanvasInteractionBridge?
 
   func makeNSView(context _: Context) -> DrawingCanvasNSView {
     let view = DrawingCanvasNSView(state: state, acceptsFirstMouse: acceptsFirstMouse)
     view.displayScale = displayScale
     view.canvasBounds = canvasBounds
+    view.interactionBridge = interactionBridge
+    interactionBridge?.drawingCanvas = view
     return view
   }
 
@@ -36,6 +39,160 @@ struct CanvasDrawingView: NSViewRepresentable {
       nsView.invalidateDrawing()
     }
     nsView.acceptsInactiveWindowMouse = acceptsFirstMouse
+    nsView.interactionBridge = interactionBridge
+    interactionBridge?.drawingCanvas = nsView
+  }
+
+  static func dismantleNSView(_ nsView: DrawingCanvasNSView, coordinator _: ()) {
+    if nsView.interactionBridge?.drawingCanvas === nsView {
+      nsView.interactionBridge?.drawingCanvas = nil
+    }
+    nsView.interactionBridge = nil
+  }
+}
+
+/// Keeps the visual SwiftUI canvas and the AppKit drawing view connected without
+/// changing either view's layout ownership. The drawing view remains fit-sized
+/// for memory-efficient rendering of large captures; a sibling proxy uses this
+/// bridge to route events from the zoomed visual footprint back to it.
+final class CanvasInteractionBridge: ObservableObject {
+  weak var drawingCanvas: DrawingCanvasNSView?
+  weak var textEditor: NSView?
+}
+
+/// AppKit hit-testing does not expand an `NSViewRepresentable`'s interactive
+/// frame for SwiftUI's outer `scaleEffect`. This proxy fills the untransformed
+/// viewport and forwards only events whose window point falls inside the
+/// drawing canvas' transformed visual bounds. `DrawingCanvasNSView` then uses
+/// its normal `convert(_:from:)` path, which correctly inverts that transform.
+struct CanvasInteractionProxy: NSViewRepresentable {
+  let bridge: CanvasInteractionBridge
+
+  func makeNSView(context _: Context) -> CanvasInteractionProxyNSView {
+    CanvasInteractionProxyNSView(bridge: bridge)
+  }
+
+  func updateNSView(_ nsView: CanvasInteractionProxyNSView, context _: Context) {
+    nsView.bridge = bridge
+  }
+}
+
+final class CanvasInteractionProxyNSView: NSView {
+  weak var bridge: CanvasInteractionBridge?
+  private var trackingArea: NSTrackingArea?
+  private weak var hoveredView: NSView?
+  private weak var dragTarget: NSView?
+
+  init(bridge: CanvasInteractionBridge) {
+    self.bridge = bridge
+    super.init(frame: .zero)
+  }
+
+  @available(*, unavailable)
+  required init?(coder _: NSCoder) {
+    fatalError("init(coder:) has not been implemented")
+  }
+
+  override func hitTest(_ point: NSPoint) -> NSView? {
+    interactionTarget(at: point) == nil ? nil : self
+  }
+
+  override func updateTrackingAreas() {
+    if let trackingArea {
+      removeTrackingArea(trackingArea)
+    }
+    let trackingArea = NSTrackingArea(
+      rect: .zero,
+      options: [.activeInKeyWindow, .inVisibleRect, .mouseMoved, .mouseEnteredAndExited],
+      owner: self,
+      userInfo: nil
+    )
+    addTrackingArea(trackingArea)
+    self.trackingArea = trackingArea
+    super.updateTrackingAreas()
+  }
+
+  override func mouseDown(with event: NSEvent) {
+    guard let target = interactionTarget(at: convert(event.locationInWindow, from: nil)) else {
+      return
+    }
+    dragTarget = target
+    target.mouseDown(with: event)
+  }
+
+  override func mouseDragged(with event: NSEvent) {
+    dragTarget?.mouseDragged(with: event)
+  }
+
+  override func mouseUp(with event: NSEvent) {
+    defer { dragTarget = nil }
+    dragTarget?.mouseUp(with: event)
+  }
+
+  override func menu(for event: NSEvent) -> NSMenu? {
+    // The proxy becomes the AppKit hit view, but the SwiftUI context menu is
+    // installed on an ancestor. Preserve the normal responder-chain lookup
+    // instead of silently swallowing right-clicks on zoomed canvas content.
+    var ancestor = superview
+    while let view = ancestor {
+      if let menu = view.menu(for: event) {
+        return menu
+      }
+      ancestor = view.superview
+    }
+    return nil
+  }
+
+  override func mouseEntered(with event: NSEvent) {
+    updateHover(for: event)
+  }
+
+  override func mouseMoved(with event: NSEvent) {
+    updateHover(for: event)
+  }
+
+  override func mouseExited(with event: NSEvent) {
+    hoveredView?.mouseExited(with: event)
+    hoveredView = nil
+  }
+
+  private func updateHover(for event: NSEvent) {
+    let target = interactionTarget(at: convert(event.locationInWindow, from: nil))
+    if hoveredView !== target {
+      hoveredView?.mouseExited(with: event)
+      if let target {
+        target.mouseEntered(with: event)
+      }
+      hoveredView = target
+    } else {
+      target?.mouseMoved(with: event)
+    }
+  }
+
+  /// The point is in this untransformed proxy's local coordinate syste
```

**File**: `Snapzy/Features/Annotate/Components/AnnotateCanvasView.swift` (modified, +26/-3)
```diff
@@ -66,6 +66,7 @@ struct AnnotateCanvasView: View {
   @State private var isDragOver = false
   @State private var showDropError = false
   @State private var dropErrorMessage = ""
+  @StateObject private var canvasInteractionBridge = CanvasInteractionBridge()
 
   /// Supported image types for drag-drop
   static let supportedImageTypes: [UTType] = [
@@ -313,15 +314,21 @@ struct AnnotateCanvasView: View {
         Group {
           sourceImageLayer(visibleBounds: foregroundBounds, scale: scale)
 
-          CanvasDrawingView(state: state, displayScale: scale, canvasBounds: foregroundBounds)
-            .frame(width: foregroundWidth, height: foregroundHeight)
+          CanvasDrawingView(
+            state: state,
+            displayScale: scale,
+            canvasBounds: foregroundBounds,
+            interactionBridge: canvasInteractionBridge
+          )
+          .frame(width: foregroundWidth, height: foregroundHeight)
 
           // Text editing overlay (when editing a text annotation)
           if state.editingTextAnnotationId != nil {
             TextEditOverlay(
               state: state,
               scale: scale,
-              canvasBounds: foregroundBounds
+              canvasBounds: foregroundBounds,
+              interactionBridge: canvasInteractionBridge
             )
             .frame(width: foregroundWidth, height: foregroundHeight)
             .clipped()
@@ -348,6 +355,22 @@ struct AnnotateCanvasView: View {
       ))
       .scaleEffect(state.zoomLevel)
       .offset(x: state.panOffset.width, y: state.panOffset.height)
+      // AppKit conversion exposes the layout transform, not a Core Animation
+      // presentation transform. Apply zoom atomically so a pointer cannot be
+      // mapped through a completed transform while pixels are mid-animation.
+      .animation(nil, value: state.zoomLevel)
+
+      // Keep AppKit input aligned with the transformed visual footprint. SwiftUI
+      // scales the canvas layer but leaves the representable's hit frame at its
+      // fit size, which otherwise makes portions of a zoomed tall capture inert.
+      // Native text input is registered with the bridge and receives priority
+      // within its transformed bounds. Perspective mockups have non-rectangular
+      // projected bounds, so the rectangular proxy yields to their existing interaction
+      // path rather than accepting clicks in visually empty corners.
+      if !shouldShowMockupTransforms {
+        CanvasInteractionProxy(bridge: canvasInteractionBridge)
+          .frame(width: containerSize.width, height: containerSize.height)
+      }
     }
     .contentShape(Rectangle())
     .contextMenu {
```

**File**: `Snapzy/Features/Annotate/Components/AnnotateTextEditOverlay.swift` (modified, +14/-2)
```diff
@@ -13,6 +13,7 @@ struct TextEditOverlay: View {
   @ObservedObject var state: AnnotateState
   let scale: CGFloat
   let canvasBounds: CGRect
+  var interactionBridge: CanvasInteractionBridge?
 
   @State private var editingText: String = ""
 
@@ -69,7 +70,8 @@ struct TextEditOverlay: View {
             onCommit: { commitEdit(id: editingId) },
             onCancel: cancelEdit,
             onUndo: { state.undo() },
-            onRedo: { state.redo() }
+            onRedo: { state.redo() },
+            interactionBridge: interactionBridge
           )
         }
           .frame(
@@ -175,6 +177,7 @@ private struct InlineAnnotationTextEditor: NSViewRepresentable {
   let onCancel: () -> Void
   let onUndo: () -> Void
   let onRedo: () -> Void
+  var interactionBridge: CanvasInteractionBridge?
 
   func makeCoordinator() -> Coordinator {
     Coordinator(text: $text)
@@ -207,6 +210,8 @@ private struct InlineAnnotationTextEditor: NSViewRepresentable {
     textView.font = font
     textView.textColor = textColor
     context.coordinator.focusedEditingId = editingId
+    textView.interactionBridge = interactionBridge
+    interactionBridge?.textEditor = textView
     textView.requestInitialFocus()
 
     return textView
@@ -218,6 +223,8 @@ private struct InlineAnnotationTextEditor: NSViewRepresentable {
     textView.onCancel = onCancel
     textView.onUndo = onUndo
     textView.onRedo = onRedo
+    textView.interactionBridge = interactionBridge
+    interactionBridge?.textEditor = textView
 
     if textView.string != text {
       context.coordinator.isApplyingExternalText = true
@@ -246,6 +253,10 @@ private struct InlineAnnotationTextEditor: NSViewRepresentable {
   }
 
   static func dismantleNSView(_ textView: UndoIsolatedTextView, coordinator: Coordinator) {
+    if textView.interactionBridge?.textEditor === textView {
+      textView.interactionBridge?.textEditor = nil
+    }
+    textView.interactionBridge = nil
     textView.onCommit = nil
     textView.onCancel = nil
     textView.onUndo = nil
@@ -284,6 +295,7 @@ private struct InlineAnnotationTextEditor: NSViewRepresentable {
     var onCancel: (() -> Void)?
     var onUndo: (() -> Void)?
     var onRedo: (() -> Void)?
+    weak var interactionBridge: CanvasInteractionBridge?
     private var wantsInitialFocus = false
     private var hasPendingInputMethodPlacementRefresh = false
 
@@ -379,4 +391,4 @@ private struct InlineAnnotationTextEditor: NSViewRepresentable {
       super.keyDown(with: event)
     }
   }
-}
\ No newline at end of file
+}
```

**File**: `SnapzyTests/Features/Annotate/AnnotateCoreTests.swift` (modified, +78/-0)
```diff
@@ -1184,6 +1184,84 @@ final class AnnotateCoreTests: XCTestCase {
     XCTAssertEqual(state.annotations[0].bounds, existing.bounds)
   }
 
+  @MainActor
+  func testCanvasZoomedSmallDragCommitsUsingScreenDistance() {
+    let state = makeAnnotateState()
+    state.zoomLevel = 16
+    state.selectedTool = .rectangle
+
+    let canvas = DrawingCanvasNSView(state: state)
+    canvas.frame = CGRect(x: 0, y: 0, width: 400, height: 300)
+    canvas.displayScale = 1
+    canvas.canvasBounds = CGRect(x: 0, y: 0, width: 400, height: 300)
+
+    // The event location is in the pre-zoom canvas space. A quarter-point
+    // local drag is four physical screen points at 16× zoom and should count
+    // as an intentional drawing gesture.
+    let start = CGPoint(x: 100, y: 100)
+    let end = CGPoint(x: 100.25, y: 100.25)
+    canvas.mouseDown(with: makeMouseEvent(type: .leftMouseDown, location: start))
+    canvas.mouseDragged(with: makeMouseEvent(type: .leftMouseDragged, location: end))
+    canvas.mouseUp(with: makeMouseEvent(type: .leftMouseUp, location: end))
+
+    XCTAssertEqual(state.annotations.count, 1)
+    XCTAssertEqual(state.annotations[0].bounds, CGRect(x: 100, y: 100, width: 0.25, height: 0.25))
+  }
+
+  @MainActor
+  func testCanvasZoomNormalizesAnnotationHitToleranceToScreenSpace() {
+    let state = makeAnnotateState()
+    state.zoomLevel = 16
+    let existing = AnnotationItem(
+      type: .line(start: CGPoint(x: 50, y: 100), end: CGPoint(x: 350, y: 100)),
+      bounds: CGRect(x: 50, y: 100, width: 300, height: 0),
+      properties: AnnotationProperties()
+    )
+    state.annotations = [existing]
+    state.selectedTool = .selection
+
+    let canvas = DrawingCanvasNSView(state: state)
+    canvas.frame = CGRect(x: 0, y: 0, width: 400, height: 300)
+    canvas.displayScale = 1
+    canvas.canvasBounds = CGRect(x: 0, y: 0, width: 400, height: 300)
+
+    // Five image points are 80 physical screen points at 16× zoom. The old
+    // fixed six-image-point tolerance incorrectly selected the line here;
+    // hit testing should stay within a roughly six-screen-point target.
+    let point = CGPoint(x: 200, y: 105)
+    canvas.mouseDown(with: makeMouseEvent(type: .leftMouseDown, location: point))
+    canvas.mouseUp(with: makeMouseEvent(type: .leftMouseUp, location: point))
+
+    XCTAssertTrue(state.selectedAnnotationIds.isEmpty)
+  }
+
+  @MainActor
+  func testCanvasFitScaledSelectionDoesNotRerunModelOnlyHitTest() {
+    let state = makeAnnotateState()
+    state.loadImage(NSImage(size: CGSize(width: 4_000, height: 4_000)))
+    let existing = AnnotationItem(
+      type: .line(start: CGPoint(x: 50, y: 100), end: CGPoint(x: 350, y: 100)),
+      bounds: CGRect(x: 50, y: 100, width: 300, height: 0),
+      properties: AnnotationProperties()
+    )
+    state.annotations = [existing]
+    state.selectedTool = .selection
+
+    let canvas = DrawingCanvasNSView(state: state)
+    canvas.frame = CGRect(x: 0, y: 0, width: 200, height: 200)
+    canvas.displayScale = 0.05
+    canvas.canvasBounds = CGRect(x: 0, y: 0, width: 4_000, height: 4_000)
+
+    // Eight image points are only 0.4 screen points at this fit scale. The
+    // canvas hit test accepts the visible stroke, then selection must preserve
+    // that result instead of re-running AnnotateState's fixed image tolerance.
+    let point = CGPoint(x: 10, y: 5.4)
+    canvas.mouseDown(with: makeMouseEvent(type: .leftMouseDown, location: point))
+    canvas.mouseUp(with: makeMouseEvent(type: .leftMouseUp, location: point))
+
+    XCTAssertEqual(state.selectedAnnotationIds, [existing.id])
+  }
+
   @MainActor
   func testCanvasShiftRectangleDragCommitsConstrainedPreviewEndpoint() throws {
     let state = makeAnnotateState()
```

**File**: `SnapzyTests/Features/Annotate/AnnotateViewportUIStateTests.swift` (modified, +204/-0)
```diff
@@ -77,6 +77,133 @@ final class AnnotateViewportUIStateTests: XCTestCase {
     XCTAssertEqual(state.zoomLevel(forDisplayedPercent: 100), 2.0, accuracy: 0.0001)
   }
 
+  @MainActor
+  func testTallCanvasAtFiftyTwoPercentHitTestsAcrossItsVisibleWidth() throws {
+    let state = AnnotateState(
+      image: NSImage(size: CGSize(width: 3_546, height: 16_348)),
+      url: URL(fileURLWithPath: "/tmp/tall-annotate-canvas.png")
+    )
+    Self.retainedAnnotateStates.append(state)
+    state.showSidebar = false
+
+    let window = makeAnnotationWindow(state: state)
+    defer {
+      window.close()
+      window.contentView = nil
+    }
+
+    window.setFrame(CGRect(x: 0, y: 0, width: 1_500, height: 900), display: false)
+    window.makeKeyAndOrderFront(nil)
+    drainMainRunLoop()
+
+    state.zoomLevel = state.zoomLevel(forDisplayedPercent: 52)
+    // A scrolling capture is commonly viewed away from the centered origin.
+    // Keep a non-zero pan in this regression case so the proxy must include the
+    // outer translation as well as the outer scale in its visual hit bounds.
+    state.panOffset = CGSize(width: -120, height: 80)
+    drainMainRunLoop()
+
+    let contentView = try XCTUnwrap(window.contentView)
+    let canvas = try XCTUnwrap(findDrawingCanvas(in: contentView))
+    let interactionProxy = try XCTUnwrap(findCanvasInteractionProxy(in: contentView))
+    XCTAssertLessThan(canvas.frame.width, contentView.bounds.width / 2)
+
+    // The 52%-wide image visually spans the viewport, but this point falls
+    // outside the canvas' unzoomed AppKit frame. It must still resolve to the
+    // interaction bridge, which forwards events through the drawing view's
+    // transformed coordinate conversion.
+    let visiblePoint = CGPoint(x: contentView.bounds.maxX - 40, y: contentView.bounds.midY)
+    XCTAssertTrue(
+      isDescendant(contentView.hitTest(visiblePoint), of: interactionProxy),
+      "Zoomed image content outside the unzoomed canvas frame must remain interactive"
+    )
+
+    state.selectedTool = .rectangle
+    let start = contentView.convert(visiblePoint, to: nil)
+    let end = CGPoint(x: start.x - 32, y: start.y - 24)
+    try dispatchMouseEvent(
+      makeMouseEvent(type: .leftMouseDown, location: start, window: window),
+      in: contentView
+    )
+    try dispatchMouseEvent(
+      makeMouseEvent(type: .leftMouseDragged, location: end, window: window),
+      in: contentView
+    )
+    try dispatchMouseEvent(
+      makeMouseEvent(type: .leftMouseUp, location: end, window: window),
+      in: contentView
+    )
+
+    XCTAssertEqual(state.annotations.count, 1)
+    XCTAssertGreaterThan(state.annotations[0].bounds.width, 0)
+    XCTAssertGreaterThan(state.annotations[0].bounds.height, 0)
+
+    // The same bridge must preserve the existing select → move → resize flow,
+    // rather than merely allowing insertion on the formerly inert surface.
+    let originalBounds = state.annotations[0].bounds
+    state.selectedTool = .selection
+    let selectionPoint = windowPoint(
+      for: CGPoint(x: originalBounds.midX, y: originalBounds.midY),
+      on: canvas
+    )
+    let movedPoint = CGPoint(x: selectionPoint.x - 24, y: selectionPoint.y + 18)
+    try dispatchMouseEvent(
+      makeMouseEvent(type: .leftMouseDown, location: selectionPoint, window: window),
+      in: contentView
+    )
+    try dispatchMouseEvent(
+      makeMouseEvent(type: .leftMouseDragged, location: movedPoint, window: window),
+      in: contentView
+    )
+    try dispatchMouseEvent(
+      makeMouseEvent(type: .leftMouseUp, location: movedPoint, window: window),
+      in: contentView
+    )
+
+    let movedBounds = state.annotations[0].bounds
+    XCTAssertEqual(state.selectedAnnotationId, state.annotations[0].id)
+    XCTAssertNotEqual(movedBounds.origin, originalBounds.origin)
+
+    let resizePoint = windowPoint(
+      for: CGPoint(x: movedBounds.maxX, y: movedBounds.maxY),
+      on: canvas
+    )
+    let resizedPoint = CGPoint(x: resizePoint.x + 30, y: resizePoint.y + 20)
+    try dispatchMouseEvent(
+      makeMouseEvent(type: .leftMouseDown, location: resizePoint, window: window),
+      in: contentView
+    )
+    try dispatchMouseEvent(
+      makeMouseEvent(type: .leftMouseDragged, location: resizedPoint, window: window),
+      in: contentView
+    )
+    try dispatchMouseEvent(
+      makeMouseEvent(type: .leftMouseUp, location: resizedPoint, window: window),
+      in: contentView
+    )
+
+    let resizedBounds = state.annotations[0].bounds
+    XCTAssertGreaterThan(resizedBounds.width, movedBounds.width)
+    XCTAssertGreaterThan(resizedBounds.height, movedBounds.height)
+  }
+
+  @MainActor
+  func testPerspectiveMockupDoesNotInstallRectangularInteractionProxy() throws {
+    let state = makeAnnotateStateWithImage()
+    state.editorMode = .mockup
+    state.mockupRotationY = 18
+    let window = makeAnnotationWindow(state: state)
+    defer {
+      window.close()
+      window.cont
```

**File**: `docs/ANNOTATE.md` (modified, +1/-0)
```diff
@@ -101,6 +101,7 @@ The `.accessory` activation-policy revert is deferred to a later runloop turn (s
 - Range 0.25–16x: `minimumZoomLevel 0.25`, default max 4.0, `hardMaximumZoomLevel 16.0`; `effectiveMaximumZoomLevel` grows to `1/fitScale` for very long captures.
 - Input: pinch magnification, ⌘+scroll, Space+drag pan, ⌘=/⌘−/⌘0 (fit); zoom picker presets + `1:1` actual-pixels in bottom bar.
 - Selection chrome is editor-only: resize/end-point grips stay 8pt, selection outlines stay 1pt with 4pt dashes, and freehand halos stay 4pt in screen space. Image-space draw geometry compensates for both fit scale and zoom while AppKit hit testing uses the matching canvas-local conversion; Retina backing density requires no separate multiplier.
+- Annotation geometry remains in document/image coordinates. The fit-sized `DrawingCanvasNSView` is rendered through an outer SwiftUI zoom/pan transform; because that transform changes visual bounds without expanding the representable's AppKit hit frame, `CanvasInteractionProxy` covers the viewport and forwards only points within the canvas' transformed visual bounds (with a registered native inline text editor taking priority). The drawing view's normal AppKit conversion then inverts that transform before image-coordinate conversion applies the fit scale and canvas origin. Dynamic annotation hit tolerances and drag-to-create thresholds are derived from the combined fit scale × zoom scale, keeping lines, arrows, paths, handles, and small gestures visually aligned at every zoom level. Selection uses the canvas hit result directly instead of re-running the model's fixed image-space tolerance.
 - Full-editor AppKit input is delivered through the per-window `AnnotateWindowEventRouter`; zoom, pan, and Space transitions update only the `AnnotateState` owned by the originating window. Session edits, viewport metrics, and undo state remain controller-local; shared shortcut, palette, and preset stores are preferences, not editor state.
 
 ## Backgrounds & Mockups
```

---

### Incident Patch 15: `2dc8e9e5` (2026-09-08)
**Commit Message**: fix: Fixed selection chrome sizing during zoom

- Add separate selection underlay and chrome layer views to decouple
  editor-only chrome from annotation rendering
- Extract AnnotateSelectionChromeMetrics for proper coordinate
  conversions between screen, canvas, and image spaces
- Keep resize handles at 8pt and selection outlines at 1pt with 4pt
  dashes in screen space regardless of zoom level
- Add regression test for 8pt handle sizing at tiny fit scales
  (4000x4000 image at 0.05 fit)

**File**: `Snapzy/Features/Annotate/Components/AnnotateCanvasDrawingView.swift` (modified, +131/-73)
```diff
@@ -47,6 +47,11 @@ enum ResizeHandle: Equatable {
   case textCalloutTail
 }
 
+private enum ResizeHandleCoordinateSpace {
+  case image
+  case canvas
+}
+
 /// Transparent drawing layer of the annotate canvas. Renders via `drawBody`
 /// only when invalidated; CoreAnimation composites the existing backing store
 /// otherwise. All mouse/key events fall through to the container view.
@@ -124,8 +129,6 @@ final class DrawingCanvasNSView: NSView {
   private var activeCropHandle: CropHandle?
   private var originalCropRect: CGRect = .zero
 
-  private let handleSize: CGFloat = 8
-
   // Blur cache manager for performance optimization
   private let blurCacheManager = BlurCacheManager()
   private var lastSourceImageIdentifier: ObjectIdentifier?
@@ -144,20 +147,31 @@ final class DrawingCanvasNSView: NSView {
   // only redraws when invalidated), so per-frame cost stays flat without any
   // manual bitmap or color-space management — rendering always goes through the
   // standard AppKit pipeline in the window's own color space.
-  // Order (back → front): overlay → static-below → dragged → static-above → preview.
+  // Order (back → front): overlay → selection-underlay → static-below → dragged
+  // → static-above → preview → selection-chrome.
   private let overlayLayerView = CanvasLayerView()
+  private let selectionUnderlayLayerView = CanvasLayerView()
   private let staticBelowLayerView = CanvasLayerView()
   private let draggedLayerView = CanvasLayerView()
   private let staticAboveLayerView = CanvasLayerView()
   private let previewLayerView = CanvasLayerView()
+  private let selectionChromeLayerView = CanvasLayerView()
 
   private var layerViews: [CanvasLayerView] {
-    [overlayLayerView, staticBelowLayerView, draggedLayerView, staticAboveLayerView, previewLayerView]
+    [
+      overlayLayerView,
+      selectionUnderlayLayerView,
+      staticBelowLayerView,
+      draggedLayerView,
+      staticAboveLayerView,
+      previewLayerView,
+      selectionChromeLayerView,
+    ]
   }
 
   /// Views redrawn per frame while a gesture runs (cheap content only).
   private var liveLayerViews: [CanvasLayerView] {
-    [overlayLayerView, draggedLayerView, previewLayerView]
+    [overlayLayerView, selectionUnderlayLayerView, draggedLayerView, previewLayerView, selectionChromeLayerView]
   }
 
   private var stateObservers = Set<AnyCancellable>()
@@ -194,10 +208,12 @@ final class DrawingCanvasNSView: NSView {
       addSubview(layerView)
     }
     overlayLayerView.drawBody = { [weak self] dirtyRect in self?.drawSpotlightOverlay(dirtyRect: dirtyRect) }
+    selectionUnderlayLayerView.drawBody = { [weak self] dirtyRect in self?.drawSelectionUnderlays(dirtyRect: dirtyRect) }
     staticBelowLayerView.drawBody = { [weak self] dirtyRect in self?.drawStaticBelow(dirtyRect: dirtyRect) }
     draggedLayerView.drawBody = { [weak self] dirtyRect in self?.drawDraggedItems(dirtyRect: dirtyRect) }
     staticAboveLayerView.drawBody = { [weak self] dirtyRect in self?.drawStaticAbove(dirtyRect: dirtyRect) }
     previewLayerView.drawBody = { [weak self] dirtyRect in self?.drawGesturePreview(dirtyRect: dirtyRect) }
+    selectionChromeLayerView.drawBody = { [weak self] dirtyRect in self?.drawSelectionChrome(dirtyRect: dirtyRect) }
 
     // Enable mouse tracking for cursor updates
     let trackingArea = NSTrackingArea(
@@ -216,10 +232,10 @@ final class DrawingCanvasNSView: NSView {
       .sink { [weak self] _ in self?.scheduleAnnotationsInvalidation() }
       .store(in: &stateObservers)
     state.$selectedAnnotationIds
-      .sink { [weak self] _ in self?.invalidateDrawing() }
+      .sink { [weak self] _ in self?.invalidateSelectionChrome() }
       .store(in: &stateObservers)
     state.$selectedAnnotationId
-      .sink { [weak self] _ in self?.invalidateDrawing() }
+      .sink { [weak self] _ in self?.invalidateSelectionChrome() }
       .store(in: &stateObservers)
     state.$editingTextAnnotationId
       .sink { [weak self] _ in self?.invalidateDrawing() }
@@ -251,11 +267,10 @@ final class DrawingCanvasNSView: NSView {
   /// Redraw only the per-frame layers (overlay/dragged/preview) — the static
   /// layers keep compositing their existing backing store.
   private func invalidateLiveLayers() {
-    // When the manipulated items can't be split into the dragged layer
-    // (multi-select drag, or a selected item outside the gesture), their
-    // gesture-local copies live in the static layers, so everything must
-    // redraw per frame for the gesture to be visible.
-    if isDraggingAnnotation || isResizingAnnotation, !usesDragLayerSplit {
+    // When the manipulated items can't be split into the dragged layer (a
+    // multi-select drag), their gesture-local copies live in the static layers,
+    // so everything must redraw per frame for the gesture to be visible.
+    if (isDraggingAnnotation || isResizingAnnotation), !usesDragLayerSplit {
       invalidateDrawing()
       return
     }
@@ -264,6 +27
```

**File**: `Snapzy/Features/Annotate/Components/AnnotateSelectionChromeMetrics.swift` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+//
+//  AnnotateSelectionChromeMetrics.swift
+//  Snapzy
+//
+
+import CoreGraphics
+
+/// Converts editor-only selection chrome from screen points into the two
+/// coordinate spaces used by the annotation canvas. Image-space drawing is
+/// scaled by both fit and zoom; AppKit hit testing receives canvas-local points
+/// after fit scale, so it only needs the inverse zoom factor.
+struct AnnotateSelectionChromeMetrics {
+  static let handleSize: CGFloat = 8
+  static let selectionLineWidth: CGFloat = 1
+  static let selectionDashLength: CGFloat = 4
+  static let selectionHaloWidth: CGFloat = 4
+
+  private let fitScale: CGFloat
+  private let zoomScale: CGFloat
+
+  init(fitScale: CGFloat, zoomScale: CGFloat) {
+    self.fitScale = max(fitScale, 0.0001)
+    self.zoomScale = max(zoomScale, 0.0001)
+  }
+
+  /// Length for a Core Graphics context expressed in image coordinates.
+  func imageLength(forScreenPoints length: CGFloat) -> CGFloat {
+    length / (fitScale * zoomScale)
+  }
+
+  /// Length for an AppKit event point expressed in canvas-local coordinates.
+  func canvasLength(forScreenPoints length: CGFloat) -> CGFloat {
+    length / zoomScale
+  }
+}
```

**File**: `SnapzyTests/Features/Annotate/AnnotateCoreTests.swift` (modified, +31/-0)
```diff
@@ -1153,6 +1153,37 @@ final class AnnotateCoreTests: XCTestCase {
     XCTAssertEqual(state.selectedAnnotationId, existing.id)
   }
 
+  @MainActor
+  func testCanvasTinyFitScaleDoesNotTreatFarCanvasPointAsResizeHandle() {
+    let state = makeAnnotateState()
+    state.loadImage(NSImage(size: CGSize(width: 4_000, height: 4_000)))
+    let existing = AnnotationItem(
+      type: .rectangle,
+      bounds: CGRect(x: 1_000, y: 1_000, width: 100, height: 100),
+      properties: AnnotationProperties()
+    )
+    state.annotations = [existing]
+    state.selectedAnnotationId = existing.id
+    state.selectedTool = .rectangle
+
+    let canvas = DrawingCanvasNSView(state: state)
+    canvas.frame = CGRect(x: 0, y: 0, width: 200, height: 200)
+    canvas.displayScale = 0.05
+    canvas.canvasBounds = CGRect(x: 0, y: 0, width: 4_000, height: 4_000)
+
+    // The selected item's visible corner is at (55, 55). Before this fix, the
+    // image-space handle size was reused here and a 160pt hit rect swallowed
+    // this distant point instead of starting the requested rectangle.
+    let start = CGPoint(x: 120, y: 120)
+    let end = CGPoint(x: 140, y: 140)
+    canvas.mouseDown(with: makeMouseEvent(type: .leftMouseDown, location: start))
+    canvas.mouseDragged(with: makeMouseEvent(type: .leftMouseDragged, location: end))
+    canvas.mouseUp(with: makeMouseEvent(type: .leftMouseUp, location: end))
+
+    XCTAssertEqual(state.annotations.count, 2)
+    XCTAssertEqual(state.annotations[0].bounds, existing.bounds)
+  }
+
   @MainActor
   func testCanvasShiftRectangleDragCommitsConstrainedPreviewEndpoint() throws {
     let state = makeAnnotateState()
```

**File**: `SnapzyTests/Features/Annotate/AnnotateSelectionChromeMetricsTests.swift` (added, +80/-0)
```diff
@@ -0,0 +1,80 @@
+//
+//  AnnotateSelectionChromeMetricsTests.swift
+//  SnapzyTests
+//
+
+import CoreGraphics
+import XCTest
+@testable import Snapzy
+
+final class AnnotateSelectionChromeMetricsTests: XCTestCase {
+  func testUnitFitAtUnitZoomPreservesExistingChromeMeasurements() {
+    let metrics = AnnotateSelectionChromeMetrics(fitScale: 1, zoomScale: 1)
+
+    XCTAssertEqual(
+      metrics.imageLength(forScreenPoints: AnnotateSelectionChromeMetrics.handleSize),
+      8,
+      accuracy: 0.0001
+    )
+    XCTAssertEqual(
+      metrics.canvasLength(forScreenPoints: AnnotateSelectionChromeMetrics.handleSize),
+      8,
+      accuracy: 0.0001
+    )
+  }
+
+  func testTallCaptureAtFitKeepsVisibleAndHitHandlesAtEightScreenPoints() {
+    let fitScale: CGFloat = 0.05
+    let metrics = AnnotateSelectionChromeMetrics(fitScale: fitScale, zoomScale: 1)
+
+    XCTAssertEqual(
+      metrics.imageLength(forScreenPoints: AnnotateSelectionChromeMetrics.handleSize),
+      160,
+      accuracy: 0.0001
+    )
+    XCTAssertEqual(
+      metrics.canvasLength(forScreenPoints: AnnotateSelectionChromeMetrics.handleSize),
+      8,
+      accuracy: 0.0001
+    )
+    XCTAssertEqual(
+      metrics.imageLength(forScreenPoints: AnnotateSelectionChromeMetrics.handleSize) * fitScale,
+      8,
+      accuracy: 0.0001
+    )
+  }
+
+  func testTallCaptureAtMaximumZoomKeepsSelectionChromeInScreenSpace() {
+    let fitScale: CGFloat = 0.05
+    let zoomScale: CGFloat = 16
+    let metrics = AnnotateSelectionChromeMetrics(fitScale: fitScale, zoomScale: zoomScale)
+
+    XCTAssertEqual(
+      metrics.imageLength(forScreenPoints: AnnotateSelectionChromeMetrics.handleSize),
+      10,
+      accuracy: 0.0001
+    )
+    XCTAssertEqual(
+      metrics.canvasLength(forScreenPoints: AnnotateSelectionChromeMetrics.handleSize),
+      0.5,
+      accuracy: 0.0001
+    )
+    XCTAssertEqual(
+      metrics.imageLength(forScreenPoints: AnnotateSelectionChromeMetrics.handleSize) * fitScale * zoomScale,
+      8,
+      accuracy: 0.0001
+    )
+    XCTAssertEqual(
+      metrics.canvasLength(forScreenPoints: AnnotateSelectionChromeMetrics.handleSize) * zoomScale,
+      8,
+      accuracy: 0.0001
+    )
+  }
+
+  func testInvalidScalesRemainFinite() {
+    let metrics = AnnotateSelectionChromeMetrics(fitScale: 0, zoomScale: 0)
+
+    XCTAssertTrue(metrics.imageLength(forScreenPoints: 1).isFinite)
+    XCTAssertTrue(metrics.canvasLength(forScreenPoints: 1).isFinite)
+  }
+}
```

**File**: `docs/ANNOTATE.md` (modified, +3/-2)
```diff
@@ -9,8 +9,8 @@ Snapzy's annotation subsystem: the full Annotate editor window (hybrid AppKit sh
 - `Snapzy/Features/Annotate/Managers/AnnotateWindow.swift` — `NSWindow` subclass; intercepts ⌘+scroll zoom, trackpad magnify, Space key (pan mode via `annotateSpaceDown/Up` notifications), drag events; level floats while key (`activeEditorLevel`) and restores `restingLevel` on resign; pin sets resting level `.floating`. `AnnotateWindowEventRouter` scopes these input notifications (and cloud-upload actions) to the originating window, so each full editor keeps isolated viewport and UI state.
 - `Snapzy/Features/Annotate/AnnotateState.swift` — central `ObservableObject` (~4.8k lines): annotations, tools, undo/redo, zoom/pan, canvas effects, crop, cutout, mockup, combine, cloud state.
 - Layout (`AnnotateMainView`): `AnnotateToolbarView` → `AnnotateQuickPropertiesBar` → `HStack(AnnotateSidebarView 240pt | AnnotateCanvasView)` → `AnnotateBottomBarView`.
-- Rendering: `DrawingCanvasNSView` (AppKit event container) + 5 stacked `CanvasLayerView`s composited by CoreAnimation — spotlight overlay → static-below → dragged → static-above → gesture preview. Static layers redraw only when invalidated (CA reuses their backing store), so per-frame cost is flat in annotation count and colors always render through the standard pipeline (no offscreen bitmap color management). Deterministic export via `AnnotateExporter.renderFinalImage` (mockup: `renderMockupFlatImage` off-main + `compositeMockupImage` on main — `ImageRenderer` is main-only).
-- Gesture handling: drag/resize/draw gestures mutate gesture-local `AnnotationItem` copies (no `@Published` churn) and commit once on `mouseUp` via the regular `AnnotateState` update methods + one undo checkpoint; the manipulated item draws in the dragged layer between the static layers (exact z-order). Invalidation: content publishers (`$annotations`, selection, `$sourceImage`, …) redraw all layers; other state only the cheap live layers. Full redraw path culls items outside the dirty rect.
+- Rendering: `DrawingCanvasNSView` (AppKit event container) + 7 stacked `CanvasLayerView`s composited by CoreAnimation — spotlight overlay → selection underlay → static-below → dragged → static-above → gesture preview → selection chrome. Static layers redraw only when invalidated (CA reuses their backing store), so per-frame cost is flat in annotation count and colors always render through the standard pipeline (no offscreen bitmap color management). Deterministic export via `AnnotateExporter.renderFinalImage` (mockup: `renderMockupFlatImage` off-main + `compositeMockupImage` on main — `ImageRenderer` is main-only).
+- Gesture handling: drag/resize/draw gestures mutate gesture-local `AnnotationItem` copies (no `@Published` churn) and commit once on `mouseUp` via the regular `AnnotateState` update methods + one undo checkpoint; the manipulated item draws in the dragged layer between the static layers (exact z-order). Invalidation: content publishers (`$annotations`, `$sourceImage`, …) redraw all layers; selection changes and zoom redraw only the cheap selection layers. Full redraw path culls items outside the dirty rect.
 - Render z-order (`renderOrdered` in `AnnotateAnnotationItem.swift`, shared by canvas + exporter + hit-testing): embedded images bottom → blur/redact → markup (shapes, arrows, text, counters, …) top. Stable within tiers; model array order unchanged, so blur never covers shapes in canvas or export.
 - `AnnotateState.EditorMode`: `.annotate` (flat editing), `.mockup` (3D transforms), `.preview` (hides editing UI).
 
@@ -100,6 +100,7 @@ The `.accessory` activation-policy revert is deferred to a later runloop turn (s
 
 - Range 0.25–16x: `minimumZoomLevel 0.25`, default max 4.0, `hardMaximumZoomLevel 16.0`; `effectiveMaximumZoomLevel` grows to `1/fitScale` for very long captures.
 - Input: pinch magnification, ⌘+scroll, Space+drag pan, ⌘=/⌘−/⌘0 (fit); zoom picker presets + `1:1` actual-pixels in bottom bar.
+- Selection chrome is editor-only: resize/end-point grips stay 8pt, selection outlines stay 1pt with 4pt dashes, and freehand halos stay 4pt in screen space. Image-space draw geometry compensates for both fit scale and zoom while AppKit hit testing uses the matching canvas-local conversion; Retina backing density requires no separate multiplier.
 - Full-editor AppKit input is delivered through the per-window `AnnotateWindowEventRouter`; zoom, pan, and Space transitions update only the `AnnotateState` owned by the originating window. Session edits, viewport metrics, and undo state remain controller-local; shared shortcut, palette, and preset stores are preferences, not editor state.
 
 ## Backgrounds & Mockups
```

#### Recent Merged Pull Requests:
- **PR #633** (2026-10-03): chore: release v2.1.0-beta.1 (@github-actions[bot])
- **PR #625** (closed): feat: add attached arrows to counter annotations (@duongductrong)
- **PR #622** (2026-09-28): chore: release v2.0.0 (@github-actions[bot])
- **PR #621** (2026-09-28): chore: release v2.0.0-beta.1 (@github-actions[bot])
- **PR #620** (closed): chore: release v1.33.0 (@github-actions[bot])
- **PR #619** (closed): chore: release v1.33.0-beta.3 (@github-actions[bot])
- **PR #618** (closed): chore: release v1.33.0-beta.3 (@github-actions[bot])
- **PR #616** (2026-10-03): feat(history): add keyboard navigation to floating history (@tukuyomil032)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
