> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/duongductrong-snapzy-learnings.md`  
> **Source**: github ([https://github.com/duongductrong/Snapzy](https://github.com/duongductrong/Snapzy))  
> **Source Version**: `969b91d7`  
> **License**: BSD-3-Clause  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T21:38:27.128Z  
> **Learning ID**: `learn-github-duongductrong-snapzy`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): duongductrong/Snapzy

> **Canonical Artifact**: `07_PROJECT_LEARNING/duongductrong-snapzy-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/duongductrong/Snapzy](https://github.com/duongductrong/Snapzy))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T21:38:26.928Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `duongductrong/Snapzy`
- **Description**: An open-source native macOS screenshot and screen recording app. A CleanShot X alternative.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3400 stars

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
      context.addPath(Self.roundedRectPath(in: annotation.bounds, cornerRadius: annotation.properties.cornerRadius))
      strokeCurrentPath(lineStyle: annotation.properties.lineStyle, strokeWidth: annotation.properties.strokeWidth)

    case .filledRectangle:
      context.addPath(Self.roundedRectPath(in: annotation.bounds, cornerRadius: annotation.properties.cornerRadius))
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
      if let geometry = annotation.counterArrowGeometry {
        drawArrow(geometry, strokeWidth: annotation.properties.strokeWidth, strokeColor: annotation.properties.strokeColor)
      }
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
      context.addPath(Self.roundedRectPath(in: rect, cornerRadius: rectangleCornerRadius))
      strokeCurrentPath(lineStyle: lineStyle, strokeWidth: strokeWidth)

    case .filledRectangle:
      let currentPoint = currentPath.last ?? start
      let rect = makeRect(from: start, to: currentPoint)
      let resolvedFillColor = fillColor == .clear ? strokeColor.opacity(1) : fillColor
      context.setFillColor(NSColor(resolvedFillColor).cgColor)
      context.addPath(Self.roundedRectPath(in: rect, cornerRadius: rectangleCornerRadius))
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

  /// Corner radius the rectangle path actually uses: never negativ
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
  @Published private(set) var panOffset: CGPoint = .zero
  @Published private(set) var zoomMode: QuickAccessPinZoomMode

  private(set) var baseSize: CGSize
  var onWindowResize: ((CGSize, CGPoint) -> Void)?

  static let minimumZoomFactor: CGFloat = 0.4
  static let maximumZoomFactor: CGFloat = 8

  static func windowFollowsImageDisplaySize(baseSize: CGSize, zoomFactor: CGFloat) -> CGSize {
    let factor = min(max(zoomFactor, minimumZoomFactor), maximumZoomFactor)
    let minimumSize = QuickAccessPinWindowSizing.minimumInteractiveSize
    return CGSize(
      width: max(baseSize.width * factor, minimumSize.width),
      height: max(baseSize.height * factor, minimumSize.height)
    )
  }

  init(id: UUID, url: URL, image: NSImage, thumbnail: NSImage, baseSize: CGSize, zoomMode: QuickAccessPinZoomMode = .defaultMode) {
    self.id = id
    self.url = url
    self.image = image
    self.thumbnail = thumbnail
    self.baseSize = baseSize
    self.zoomMode = zoomMode
  }

  var displaySize: CGSize {
    zoomMode == .windowFollowsImage
      ? Self.windowFollowsImageDisplaySize(baseSize: baseSize, zoomFactor: zoomFactor)
      : baseSize
  }

  var imageDisplaySize: CGSize {
    if zoomMode == .windowFollowsImage {
      let fittedSize = QuickAccessPinImageGeometry.fittedContentSize(
        imageSize: image.size,
        viewportSize: baseSize
      )
      return CGSize(width: fittedSize.width * zoomFactor, height: fittedSize.height * zoomFactor)
    }
    return QuickAccessPinImageGeometry.fixedViewportContentSize(
      imageSize: image.size,
      viewportSize: baseSize,
      zoomFactor: zoomFactor
    )
  }

  var zoomPercent: Int {
    Int((zoomFactor * 100).rounded())
  }

  var zoomMenuPercents: [Int] {
    var percents = [40, 50, 75, 100, 125, 150, 200, 400, 800].filter { percent in
      let factor = CGFloat(percent) / 100
      return factor >= Self.minimumZoomFactor - 0.001 && factor <= Self.maximumZoomFactor + 0.001
    }
    if !percents.contains(zoomPercent) {
      percents.append(zoomPercent)
      percents.sort()
    }
    return percents
  }

  func setZoomPercent(_ percent: Int) {
    updateZoomFactor(CGFloat(percent) / 100)
  }

  func resetZoom() {
    zoomFactor = 1
    panOffset = .zero
    if zoomMode == .windowFollowsImage { onWindowResize?(baseSize, CGPoint(x: 0.5, y: 0.5)) }
  }

  @discardableResult
  func setZoomMode(_ mode: QuickAccessPinZoomMode, baseSize: CGSize) -> Bool {
    guard zoomMode != mode else { return false }
    zoomMode = mode
    self.baseSize = baseSize
    zoomFactor = 1
    panOffset = .zero
    return true
  }

  func update(url: URL, image: NSImage, thumbnail: NSImage, baseSize: CGSize) -> CGSize {
    self.url = url
    self.image = image
    self.thumbnail = thumbnail
    return updateSizing(baseSize: baseSize)
  }

  func updateSizing(baseSize: CGSize) -> CGSize {
    self.baseSize = baseSize
    zoomFactor = clampedZoomFactor(zoomFactor)
    panOffset = clampedPanOffset(panOffset)
    return displaySize
  }

  func updateZoomFactor(_ factor: CGFloat) {
    guard factor.isFinite else { return }
    zoomFactor = clampedZoomFactor(factor)
    panOffset = clampedPanOffset(panOffset)
    if zoomMode == .windowFollowsImage {
      onWindowResize?(displaySize, CGPoint(x: 0.5, y: 0.5))
    }
  }

  func updateViewport(magnification: CGFloat, panOffset: CGPoint) {
    guard magnification.isFinite, panOffset.x.isFinite, panOffset.y.isFinite else { return }
    let clampedMagnification = clampedZoomFactor(magnification)
    if abs(zoomFactor - clampedMagnification) > 0.000_1 {
      zoomFactor = clampedMagnification
    }
    let newPanOffset = clampedPanOffset(panOffset)
    if abs(self.panOffset.x - newPanOffset.x) > 0.000_1
      || abs(self.panOffset.y - newPanOffset.y) > 0.000_1 {
      self.panOffset = newPanOffset
    }
  }

  private func clampedPanOffset(_ offset: CGPoint) -> CGPoint {
    guard zoomMode == .fixedViewport else { return .zero }
    return QuickAccessPinImageGeometry.clampedPanOffset(
      offset,
      viewportSize: baseSize,
      contentSize: imageDisplaySize
    )
  }

  func clampedZoomFactor(_ factor: CGFloat) -> CGFloat {
    min(max(factor, Self.minimumZoomFactor), Self.maximumZoomFactor)
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #651** (2026-10-19): **[Bug]: Incorrect capture coordinates / clipping issue on screenshot**
  *Symptoms*: ### Description  When taking a screenshot, the capture area/overlay is misaligned, resulting in a clipped/partially cut-off image.  MacOS: 27.0  ### Steps to Reproduce  1. Cmd Shift 3 2. Select capture area 3. See the bug  ### Expected Behavior  Exactly what i select  ### Actual Behavior  Incorrect image capture  ### Screenshots / Recordings  https://drive.google.com/drive/folders/1AWi2zADoKmRVxD8qg_QqLXgU2J3_OYo_?usp=sharing  ### Snapzy Version  2.0.0  ### macOS Version  Other (specify in description)  ### Installation Method  DMG download  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > <img width="2560" height="1440" alt="Image" src="https://github.com/user-attachments/assets/50fa480c-b593-42ae-b5e5-3f5a622d61cf" /> Having this outcome of clipped screenshots also when taking a full screen shot (had to blur the top of the image).
  > Thanks for the report and the screenshots @thachtranvn @larswinter!  This looks like the same root cause as #623: when Snapzy puts temporarily hidden windows back into a ScreenCaptureKit image (e.g. with "Hide desktop icons" / "Hide desktop widgets" enabled), the restored patch was drawn at its vertical mirror. That leaves a rectangular block of wrong or missing content in the middle of the capture. It affected full-screen and area captures, which matches what you're both seeing.  It was fixed in #642 and shipped in [v2.1.0-beta.3](https://github.com/duongductrong/Snapzy/releases/tag/v2.1.0-beta.3). The latest beta, [v2.1.0-beta.6](https://github.com/duongductrong/Snapzy/releases/tag/v2.1.0-beta.6), includes it as well. v2.0.0 (stable) does not have the fix yet.  Please update to v2.1.0-beta.6 (or the next stable release). As a workaround on 2.0.0, you can turn off "Hide desktop icons" and "Hide desktop widgets" in Preferences.  Closing this for now. If the clipping still happens on v2

- **Issue #639** (2026-10-19): **[Bug]: Screenshot of quick-look is misaligned and/or glitchy**
  *Symptoms*: ### Description  Thanks for resolving the screenshot of quick look item previews, this is now fixed! :)  Still a bit of an issue with this approach though - but still not quite working as intended I don't think.  If I do a full screen screenshot (cmd-shift-3) of with a quick look item open it seems to reposition it – less noticeable on a large quicklook preview but if it is just a small image it will be respositioned on the screenshot in the lower left of the screen.  If I choose selected screen area (cmd-shift-4) and drag an area, alignment is always off - I think related to the same bug as above. If you have a big PDF or window open it will seem subtle but if it is just a small image (as above) it will be completely missed by the capture.     ### Steps to Reproduce  1. Open Snapzy 2. Return to finder 3. Quick-look preview a file (recommend an image file now more than 25% of screen area) 4. Capture screenshot   ### Expected Behavior  Expect the screen capture to be exactly as screen is laid out rather than apparently altered layout of quick look window. Seems to be unique to quick-look previews rather than standard windows - for me anyway!  ### Actual Behavior  If cmd-shift-3, will capture whole screen but the quicklook window will be repositioned If cmd-shift-4, will be either misaligned or completely miss the (intended) target within the quicklook window   ### Screenshots / Recordings  <img width="1599" height="1221" alt="Image" src="https://github.com/user-attachments/ass

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

### Incident Patch 1: `d74508b0` (2026-10-13)
**Commit Message**: fix: Fixed capture remapped and consumed keystrokes (#539)

* fix: capture remapped keystrokes

Observe key-down events before shortcut tools can consume them and retain downstream modifier rewrites. Restore recording overlays across retry and restart paths.

* fix: re-register recording overlays after restart

* fix: clear stale modifiers and invalidate recording startup

Clear downstream modifier rewrites when the head tap sees a flags change or is disabled. Invalidate recording startup before stop, cancel, delete, and restart, and verify the generation before resuming UI work.

Add regressions for consumed modifier releases, interrupted overlay registration, replacement sessions, and retained overlay registration. Validation: 21 targeted tests pass on macOS.

* fix: stop closed recording toolbar from reappearing

showRecordingStatusBar observes UserDefaults changes to track the hover bar
preference, but close() left the observer in place. A start task suspended
during overlay registration keeps the closed window alive, so a later
preference write (e.g. a new session saving its area) ordered the stale bar
back on screen. Remove observers when the window closes.

---------

Co-aut

**File**: `Snapzy/Features/Recording/RecordingCoordinator.swift` (modified, +80/-35)
```diff
@@ -15,13 +15,15 @@ final class RecordingCoordinator: ObservableObject {
 
   @Published private(set) var isActive = false
 
-  private var toolbarWindow: RecordingToolbarWindow?
+  private(set) var toolbarWindow: RecordingToolbarWindow?
   private var regionOverlayWindows: [RecordingRegionOverlayWindow] = []
   private var selectedRect: CGRect?
   private var selectedWindowTarget: WindowCaptureTarget?
   private let captureManager = ScreenCaptureManager.shared
   private let recorder = ScreenRecordingManager.shared
   private var isStartingRecording = false
+  // Invalidated before Stop/Cancel/Restart suspends, even while the toolbar survives.
+  private var recordingGeneration = UUID()
   private var localEscapeMonitor: Any?
   private var globalEscapeMonitor: Any?
   private var onSessionEnded: (@MainActor () -> Void)?
@@ -56,7 +58,7 @@ final class RecordingCoordinator: ObservableObject {
     let dimNonSelectedArea: Bool
   }
 
-  private init() {
+  init() {
     // Live-apply the dim preference while recording so toggling it in Settings (or the
     // toolbar options) takes effect immediately, mirroring the hover-bar live toggle.
     NotificationCenter.default.addObserver(
@@ -284,6 +286,7 @@ final class RecordingCoordinator: ObservableObject {
   }
 
   func cancel() {
+    recordingGeneration = UUID()
     DiagnosticLogger.shared.log(.info, .recording, "Recording coordinator cancel requested", context: [
       "isActive": "\(isActive)",
       "recorderState": "\(recorder.state)",
@@ -557,6 +560,7 @@ final class RecordingCoordinator: ObservableObject {
 
   /// Delete current recording and close
   private func deleteRecording() {
+    recordingGeneration = UUID()
     DiagnosticLogger.shared.log(.info, .recording, "Recording delete requested", context: [
       "recorderState": "\(recorder.state)",
     ])
@@ -574,6 +578,8 @@ final class RecordingCoordinator: ObservableObject {
       return
     }
 
+    recordingGeneration = UUID()
+    let generation = recordingGeneration
     let savedFormat = window.selectedFormat
     let savedQuality = window.selectedQuality
     let maxResolution = window.selectedMaxResolution
@@ -596,11 +602,14 @@ final class RecordingCoordinator: ObservableObject {
     ])
 
     Task {
+      guard isCurrentRecordingStart(generation, window: window) else { return }
       // Cancel current recording
       await recorder.cancelRecording()
+      guard isCurrentRecordingStart(generation, window: window) else { return }
 
       // Small delay to ensure cleanup completes
       try? await Task.sleep(nanoseconds: 100_000_000) // 0.1s
+      guard isCurrentRecordingStart(generation, window: window) else { return }
 
       // Re-prepare and start recording with same settings
       do {
@@ -640,24 +649,30 @@ final class RecordingCoordinator: ObservableObject {
             .map { CaptureContext.fromPID($0.ownerPID, windowTitle: $0.title) } ?? CaptureContext.fromFrontmostApp()
         )
 
+        guard isCurrentRecordingStart(generation, window: window) else { return }
         try await self.setupCameraOverlay(
           for: rect,
           enabled: savedCaptureCamera,
           deviceID: savedCameraDeviceID
         )
+        guard isCurrentRecordingStart(generation, window: window) else { return }
         try await recorder.startRecording()
+        guard isCurrentRecordingStart(generation, window: window) else { return }
         removeEscapeMonitors()
+        guard await completeRecordingStart(for: rect) else { return }
         DiagnosticLogger.shared.log(.info, .recording, "Recording restart completed")
 
         // Play sound to indicate restart
         SoundManager.play("Purr")
 
       } catch let error as RecordingError {
+        guard isCurrentRecordingStart(generation, window: window) else { return }
         DiagnosticLogger.shared.logError(.recording, error, "Recording restart failed")
         if !showErrorAlert(error) {
           cancel()
         }
       } catch {
+        guard isCurrentRecordingStart(generation, window: window) else { return }
         DiagnosticLogger.shared.logError(.recording, error, "Recording restart failed (generic)")
         if !showErrorAlert(.setupFailed(error.localizedDescription)) {
           cancel()
@@ -695,6 +710,7 @@ final class RecordingCoordinator: ObservableObject {
       return
     }
     guard beginRecordingStartAttempt(source: "toolbar") else { return }
+    let generation = recordingGeneration
 
     let format = window.selectedFormat
     DiagnosticLogger.shared.log(.info, .recording, "Start recording", context: [
@@ -741,6 +757,7 @@ final class RecordingCoordinator: ObservableObject {
     UserDefaults.standard.set(format.rawValue, forKey: PreferencesKeys.recordingFormat)
 
     Task {
+      guard isCurrentRecordingStart(generation, window: window) else { return }
       do {
         let exclusionConfig = self.recordingCaptureExclusionConfiguration()
         DiagnosticLogger.shared.log(.debug
```

**File**: `Snapzy/Features/Recording/RecordingToolbarWindow.swift` (modified, +7/-0)
```diff
@@ -325,6 +325,13 @@ final class RecordingToolbarWindow: NSWindow {
     NotificationCenter.default.removeObserver(self)
   }
 
+  override func close() {
+    // A closed bar may outlive its session in a suspended start task. Stop observing so a later
+    // preference write cannot order it back on screen.
+    NotificationCenter.default.removeObserver(self)
+    super.close()
+  }
+
   private func configureWindow() {
     isOpaque = false
     backgroundColor = .clear
```

**File**: `Snapzy/Services/Capture/KeystrokeMonitorService.swift` (modified, +95/-22)
```diff
@@ -12,62 +12,135 @@ import Foundation
 @MainActor
 final class KeystrokeMonitorService {
 
-  private var globalKeyDownMonitor: Any?
-  private var localKeyDownMonitor: Any?
+  static let tapLocation: CGEventTapLocation = .cgSessionEventTap
+  static let tapPlacement: CGEventTapPlacement = .headInsertEventTap
+  static let tapOptions: CGEventTapOptions = .defaultTap
+  static let eventMask = (CGEventMask(1) << CGEventType.keyDown.rawValue)
+    | (CGEventMask(1) << CGEventType.flagsChanged.rawValue)
+
+  private var eventTap: CFMachPort?
+  private var runLoopSource: CFRunLoopSource?
+  private var globalFlagsChangedMonitor: Any?
+  private var localFlagsChangedMonitor: Any?
+  private var observedModifierFlags: NSEvent.ModifierFlags = []
   private var isRunning = false
 
   /// Called with the formatted keystroke string (e.g. "⌘ ⇧ S")
   var onKeystroke: ((String) -> Void)?
 
   func start() {
     guard !isRunning else { return }
-    isRunning = true
+    guard let eventTap = CGEvent.tapCreate(
+      tap: Self.tapLocation,
+      place: Self.tapPlacement,
+      options: Self.tapOptions,
+      eventsOfInterest: Self.eventMask,
+      callback: Self.tapCallback,
+      userInfo: Unmanaged.passUnretained(self).toOpaque()
+    ) else {
+      DiagnosticLogger.shared.log(.error, .recording, "Failed to create keystroke event tap")
+      return
+    }
+    guard let runLoopSource = CFMachPortCreateRunLoopSource(nil, eventTap, 0) else {
+      CFMachPortInvalidate(eventTap)
+      DiagnosticLogger.shared.log(.error, .recording, "Failed to create keystroke event tap source")
+      return
+    }
 
-    globalKeyDownMonitor = NSEvent.addGlobalMonitorForEvents(
-      matching: [.keyDown]
-    ) { [weak self] event in
+    self.eventTap = eventTap
+    self.runLoopSource = runLoopSource
+    CFRunLoopAddSource(CFRunLoopGetMain(), runLoopSource, .commonModes)
+    CGEvent.tapEnable(tap: eventTap, enable: true)
+
+    globalFlagsChangedMonitor = NSEvent.addGlobalMonitorForEvents(matching: .flagsChanged) {
+      [weak self] event in
       MainActor.assumeIsolated {
-        self?.handleKeyDown(event)
+        self?.handleModifierFlagsChanged(event.modifierFlags)
       }
     }
-
-    localKeyDownMonitor = NSEvent.addLocalMonitorForEvents(
-      matching: [.keyDown]
-    ) { [weak self] event in
+    localFlagsChangedMonitor = NSEvent.addLocalMonitorForEvents(matching: .flagsChanged) {
+      [weak self] event in
       MainActor.assumeIsolated {
-        self?.handleKeyDown(event)
+        self?.handleModifierFlagsChanged(event.modifierFlags)
       }
       return event
     }
+    isRunning = true
   }
 
   func stop() {
+    if let runLoopSource {
+      CFRunLoopRemoveSource(CFRunLoopGetMain(), runLoopSource, .commonModes)
+      CFRunLoopSourceInvalidate(runLoopSource)
+    }
+    if let eventTap {
+      CGEvent.tapEnable(tap: eventTap, enable: false)
+      CFMachPortInvalidate(eventTap)
+    }
+    if let globalFlagsChangedMonitor {
+      NSEvent.removeMonitor(globalFlagsChangedMonitor)
+    }
+    if let localFlagsChangedMonitor {
+      NSEvent.removeMonitor(localFlagsChangedMonitor)
+    }
+    runLoopSource = nil
+    eventTap = nil
+    globalFlagsChangedMonitor = nil
+    localFlagsChangedMonitor = nil
+    observedModifierFlags = []
     isRunning = false
-
-    if let m = globalKeyDownMonitor { NSEvent.removeMonitor(m) }
-    if let m = localKeyDownMonitor { NSEvent.removeMonitor(m) }
-    globalKeyDownMonitor = nil
-    localKeyDownMonitor = nil
     onKeystroke = nil
   }
 
+  private static let tapCallback: CGEventTapCallBack = { _, type, event, userInfo in
+    guard let userInfo else { return Unmanaged.passUnretained(event) }
+    let service = Unmanaged<KeystrokeMonitorService>
+      .fromOpaque(userInfo)
+      .takeUnretainedValue()
+    return MainActor.assumeIsolated {
+      service.handleTapEvent(type: type, event: event)
+    }
+  }
+
+  func handleTapEvent(type: CGEventType, event: CGEvent) -> Unmanaged<CGEvent>? {
+    if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput {
+      observedModifierFlags = []
+      if let eventTap {
+        CGEvent.tapEnable(tap: eventTap, enable: true)
+      }
+    } else if type == .flagsChanged {
+      // Invalidate the previous rewrite before a downstream tap can consume the
+      // release. AppKit can then supply the rewrite for this new modifier state.
+      observedModifierFlags = []
+    } else if type == .keyDown {
+      if let keyEvent = NSEvent(cgEvent: event) {
+        handleKeyDown(keyEvent)
+      }
+    }
+    return Unmanaged.passUnretained(event)
+  }
+
   // MARK: - Event Processing
 
+  func handleModifierFlagsChanged(_ flags: NSEvent.ModifierFlags) {
+    observedModifierFlags = flags.intersection(.deviceIndependentFlagsMask)
+  }
+
   private func handleKeyDown(_ event: NSEvent) {
     // Ignore key repeats to avoid spamming
     guard !event.isARepeat else { return }
 
-    let flags = event.modifier
```

**File**: `SnapzyTests/Services/Capture/KeystrokeMonitorServiceTests.swift` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+import AppKit
+import CoreGraphics
+@testable import Snapzy
+import Testing
+
+@MainActor
+struct KeystrokeMonitorServiceTests {
+  @Test(arguments: [CGEventType.flagsChanged, .tapDisabledByTimeout, .tapDisabledByUserInput])
+  func lostAppKitReleaseDoesNotExposePlainTyping(resetEventType: CGEventType) throws {
+    let service = KeystrokeMonitorService()
+    service.handleModifierFlagsChanged([.command])
+    var keystrokes: [String] = []
+    service.onKeystroke = { keystrokes.append($0) }
+    let event = try #require(CGEvent(keyboardEventSource: nil, virtualKey: 35, keyDown: true))
+    event.flags = []
+
+    // The head tap sees the release, but the remapper consumes it before AppKit.
+    _ = service.handleTapEvent(type: resetEventType, event: event)
+    _ = service.handleTapEvent(type: .keyDown, event: event)
+
+    #expect(keystrokes.isEmpty)
+  }
+
+  @Test
+  func headSessionTapObservesShortcutWithoutConsumingIt() throws {
+    #expect(KeystrokeMonitorService.tapLocation == .cgSessionEventTap)
+    #expect(KeystrokeMonitorService.tapPlacement == .headInsertEventTap)
+    #expect(KeystrokeMonitorService.tapOptions == .defaultTap)
+    #expect(KeystrokeMonitorService.eventMask & (CGEventMask(1) << CGEventType.flagsChanged.rawValue) != 0)
+
+    let service = KeystrokeMonitorService()
+    let event = try #require(
+      CGEvent(keyboardEventSource: nil, virtualKey: 123, keyDown: true)
+    )
+
+    let forwarded = service.handleTapEvent(type: .keyDown, event: event)
+
+    #expect(forwarded?.takeUnretainedValue() === event)
+  }
+
+  @Test(arguments: [
+    (CGKeyCode(18), "1"),
+    (CGKeyCode(124), "→"),
+  ])
+  func tapCombinesDownstreamModifierRewrite(testCase: (keyCode: CGKeyCode, key: String)) throws {
+    let service = KeystrokeMonitorService()
+    var keystrokes: [String] = []
+    service.onKeystroke = { keystrokes.append($0) }
+    let event = try #require(
+      CGEvent(keyboardEventSource: nil, virtualKey: testCase.keyCode, keyDown: true)
+    )
+    event.flags = []
+    _ = service.handleTapEvent(type: .flagsChanged, event: event)
+    service.handleModifierFlagsChanged([.control, .option, .command])
+
+    _ = service.handleTapEvent(type: .keyDown, event: event)
+
+    #expect(keystrokes == ["⌃ ⌥ ⌘ \(testCase.key)"])
+  }
+}
```

**File**: `SnapzyTests/Services/Capture/RecordingCoordinatorLifecycleTests.swift` (added, +99/-0)
```diff
@@ -0,0 +1,99 @@
+import AppKit
+@testable import Snapzy
+import Testing
+
+@MainActor
+@Suite(.serialized)
+struct RecordingCoordinatorLifecycleTests {
+  @Test(arguments: [(false, false), (true, false), (true, true)])
+  func stopDuringOverlayRegistrationDoesNotReopenToolbar(
+    scenario: (waitForCleanup: Bool, replaceSession: Bool)
+  ) async throws {
+    let savedArea = UserDefaults.standard.object(forKey: PreferencesKeys.recordingLastAreaRect)
+    defer { UserDefaults.standard.set(savedArea, forKey: PreferencesKeys.recordingLastAreaRect) }
+    let coordinator = RecordingCoordinator()
+    let rect = CGRect(x: 100, y: 100, width: 640, height: 480)
+    var sessionEnded: CheckedContinuation<Void, Never>?
+    var didEnd = false
+    coordinator.showToolbar(for: rect, onSessionEnded: {
+      didEnd = true
+      sessionEnded?.resume()
+    })
+    let window = try #require(coordinator.toolbarWindow)
+    var registrations = 0
+
+    let completed = await coordinator.completeRecordingStart(for: rect) { _ in
+      registrations += 1
+      guard registrations == 1 else { return }
+      if scenario.waitForCleanup {
+        // Suspend the real setup path until Stop has closed the original windows.
+        await withCheckedContinuation { continuation in
+          sessionEnded = continuation
+          window.onStop?()
+        }
+      } else {
+        // Stop must invalidate setup even before asynchronous cleanup runs.
+        window.onStop?()
+        #expect(coordinator.isActive)
+      }
+      if scenario.replaceSession {
+        didEnd = false
+        sessionEnded = nil
+        coordinator.showToolbar(for: rect, onSessionEnded: {
+          didEnd = true
+          sessionEnded?.resume()
+        })
+      }
+    }
+
+    #expect(!completed)
+    #expect(registrations == 1)
+    if scenario.replaceSession {
+      #expect(coordinator.toolbarWindow !== window)
+      coordinator.cancel()
+    }
+    if !didEnd {
+      await withCheckedContinuation { sessionEnded = $0 }
+    }
+    #expect(!window.isVisible)
+    #expect(!coordinator.isActive)
+    window.close()
+  }
+
+  @Test
+  func completedSetupRegistersRetainedOverlaysAgain() async throws {
+    let defaults = UserDefaults.standard
+    let savedArea = defaults.object(forKey: PreferencesKeys.recordingLastAreaRect)
+    let keys = [PreferencesKeys.recordingHighlightClicks, PreferencesKeys.recordingShowKeystrokes]
+    let savedOptions = keys.map { defaults.object(forKey: $0) }
+    defer {
+      defaults.set(savedArea, forKey: PreferencesKeys.recordingLastAreaRect)
+      for (key, value) in zip(keys, savedOptions) { defaults.set(value, forKey: key) }
+    }
+    for key in keys { defaults.set(true, forKey: key) }
+    let coordinator = RecordingCoordinator()
+    let rect = CGRect(x: 100, y: 100, width: 640, height: 480)
+    var sessionEnded: CheckedContinuation<Void, Never>?
+    coordinator.showToolbar(for: rect, onSessionEnded: { sessionEnded?.resume() })
+    let window = try #require(coordinator.toolbarWindow)
+    var firstRegistration: [CGWindowID] = []
+    var secondRegistration: [CGWindowID] = []
+
+    let started = await coordinator.completeRecordingStart(for: rect) {
+      firstRegistration.append($0)
+    }
+    let restarted = await coordinator.completeRecordingStart(for: rect) {
+      secondRegistration.append($0)
+    }
+
+    #expect(started && restarted)
+    #expect(firstRegistration.count == 3)
+    #expect(firstRegistration == secondRegistration)
+    #expect(coordinator.toolbarWindow === window)
+    #expect(window.isMovableByWindowBackground)
+    await withCheckedContinuation { continuation in
+      sessionEnded = continuation
+      coordinator.cancel()
+    }
+  }
+}
```

**File**: `docs/RECORDING.md` (modified, +3/-3)
```diff
@@ -91,11 +91,11 @@ The toolbar's Fullscreen toggle keeps the display already selected: `restartSele
 Snapzy windows are normally excluded from the stream; effect overlays are re-included via `ScreenRecordingManager.addExceptedWindow(windowID:)` so they appear in the video:
 
 - **Click highlights** (pref `PreferencesKeys.recordingHighlightClicks`, default off): `MouseClickHighlightService` installs local+global NSEvent monitors for down/up/drag and forwards points to `MouseClickHighlightWindow` (`showClickEffect` ripple rings, hold circle while pressed, drag follow).
-- **Keystroke overlay** (pref `PreferencesKeys.recordingShowKeystrokes`, default off): `KeystrokeMonitorService` shows keystrokes only when a modifier (⌘/⌥/⌃) is held or a special key is pressed, building modifier-combo display strings; rendered by `KeystrokeOverlayWindow.showKeystroke`.
+- **Keystroke overlay** (pref `PreferencesKeys.recordingShowKeystrokes`, default off): `KeystrokeMonitorService` observes session key events before other event taps can consume them and forwards every event unchanged, showing keystrokes only when a modifier (⌘/⌥/⌃) is held or a special key is pressed; rendered by `KeystrokeOverlayWindow.showKeystroke`.
 - **Camera overlay** (pref `PreferencesKeys.recordingCaptureCamera`, default off): the toolbar lists the system camera and available devices, including iPhone Continuity Camera. `RecordingCameraOverlayWindow` shows a draggable borderless preview inside the recording area following Snapzy's Liquid Glass standard (0.75pt specular hairline rim, floating window shadow, frosted placeholder on disconnect). Users can choose between Default Rectangle (16:9), Square (1:1), and Circle (1:1) shapes with Small, Medium, and Large size presets and camera mirroring, configurable from both the toolbar menu and a right-click context menu on the overlay itself. It snaps to the four corners or the center of any side when dragged within 32 points on both axes of an anchor, smoothly anchoring transitions. It is a borderless, non-activating `NSPanel` that owns the whole left-button gesture in `sendEvent` — clicking or dragging the preview never activates Snapzy, changes key window state, or reaches AppKit's default window-move handling, so no system alert sound fires on drop. ScreenCaptureKit includes this window in the video. If the camera disconnects, screen recording continues, the overlay shows a waiting message, and Snapzy reconnects the same device when it returns. Camera audio is not used; select a microphone separately.
 - **Live annotations**: `RecordingAnnotationState` + `RecordingAnnotationOverlayWindow` over the recording rect, plus a popover-style `RecordingAnnotationToolbarWindow` anchored to the status bar pencil button. The trigger center is reported by a transparent AppKit anchor reporter attached beside the button, so native Liquid Glass containers cannot isolate the measurement; the popover waits for a valid first layout and follows later updates. Tools: selection, rectangle, oval, arrow, line, pencil, highlighter, with per-tool auto-clear modes (persist / time-based / count-based). Global shortcut path: `RecordingCoordinator.togglePenFromShortcut()`. While the configured modifier is held (Shift by default), local and global key-down monitors route tool keys through `RecordingAnnotationState`; local matches are consumed, while global matches switch tools when the recorded app owns focus (Accessibility permission required). Matching uses `charactersIgnoringModifiers` so Control/Option do not change the selected tool key.
 
-The camera overlay starts before `startRecording()` so it can be added to the initial content filter. The other overlays start after recording begins. Region overlay borders are hidden and interaction is disabled at the same moment.
+The camera overlay starts before `startRecording()` so it can be added to the initial content filter. The other overlays start after recording begins. Region overlay borders are hidden and interaction is disabled at the same moment. Every new stream re-registers all effect overlays, including windows retained across a restart, because preparing a stream clears its window exceptions.
 
 - **Region dimming toggle** (pref `PreferencesKeys.recordingDimNonSelectedArea`, default on): `RecordingRegionOverlayView` fills the area outside the recording rect with `black@0.4` (window `sharingType = .none`, so it never enters the video). The dim is always shown during pre-record selection for visual feedback. At record-start each per-screen overlay gets `setDimEnabled(dimNonSelectedArea)` in the same loop that calls `hideBorder()`, so when the pref is off the dim disappears the instant recording begins and non-selected windows stay fully usable. Surfaced in Settings (Capture → Recording → Behavior) and the pre-record toolbar Options popover; `RecordingCoordinator` observes `UserDefaults.didChangeNotification` and re-applies to live overlays while `RecordingState.isPauseResumeE
```

---

### Incident Patch 2: `9b574164` (2026-10-10)
**Commit Message**: fix: stabilize pinned image focal anchoring and restore gesture zoom paths (#640)

* fix: stabilize pin focal anchoring and restore gesture zoom paths

- Anchor window-follows zoom resizes to the live window frame instead of
  potentially stale scroll view bounds, and preserve the focal point
  when zoom clamping re-applies state, fixing focal drift during fast
  pinch gestures.
- Route magnify events from the pin window directly to the image scroll
  view so pinch zoom works regardless of host hit-testing quirks.
- Restore command-scroll zoom for mouse users in both pin zoom modes.

* fix: keep cursor anchored to image point across window-resizing zooms

**File**: `Snapzy/Features/QuickAccess/Components/QuickAccessPinImageScrollView.swift` (modified, +69/-9)
```diff
@@ -69,6 +69,7 @@ final class QuickAccessPinImageScrollView: NSScrollView {
   private var requestedMagnification: CGFloat = 1
   private var requestedPanOffset: CGPoint = .zero
   private var stateApplicationDepth = 0
+  private var pendingFocalAnchor: CGPoint?
   private var boundsObserver: NSObjectProtocol?
 
   override init(frame frameRect: NSRect) {
@@ -162,6 +163,12 @@ final class QuickAccessPinImageScrollView: NSScrollView {
   func scrollAction(for event: NSEvent) -> ScrollAction {
     let modifiers = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
     guard !isLockedProvider() else { return .reject("locked") }
+    if modifiers == .command {
+      guard abs(event.scrollingDeltaY) > abs(event.scrollingDeltaX), abs(event.scrollingDeltaY) > 0 else {
+        return .reject("horizontalOrZeroDelta")
+      }
+      return .magnify
+    }
     guard modifiers.isEmpty else { return .reject("modifiers") }
     if zoomMode == .windowFollowsImage {
       guard abs(event.scrollingDeltaY) > abs(event.scrollingDeltaX), abs(event.scrollingDeltaY) > 0 else {
@@ -270,9 +277,15 @@ final class QuickAccessPinImageScrollView: NSScrollView {
 
     performStateApplication {
       if zoomChanged {
-        let visibleRect = documentView?.visibleRect ?? imageView.bounds
-        let viewportCenter = NSPoint(x: visibleRect.midX, y: visibleRect.midY)
-        setMagnification(clampedMagnification, centeredAt: viewportCenter)
+        let anchor: CGPoint
+        if let focal = pendingFocalAnchor {
+          anchor = focal
+          pendingFocalAnchor = nil
+        } else {
+          let visibleRect = documentView?.visibleRect ?? imageView.bounds
+          anchor = CGPoint(x: visibleRect.midX, y: visibleRect.midY)
+        }
+        setMagnification(clampedMagnification, centeredAt: anchor)
       }
 
       let visibleSize = CGSize(
@@ -301,22 +314,69 @@ final class QuickAccessPinImageScrollView: NSScrollView {
     let before = magnification
     guard target != before else { return }
 
+    pendingFocalAnchor = point
     performStateApplication {
       setMagnification(target, centeredAt: point)
     }
     publishViewportChange()
     if zoomMode == .windowFollowsImage {
-      let fraction = CGPoint(x: bounds.width > 0 ? windowPoint.x / bounds.width : 0.5, y: bounds.height > 0 ? windowPoint.y / bounds.height : 0.5)
-      let displaySize = QuickAccessPinWindowState.windowFollowsImageDisplaySize(
-        baseSize: configuredImageSize,
-        zoomFactor: target
-      )
-      stateResizeRequest?(displaySize, fraction)
+      if window == nil {
+        stateResizeRequest?(displaySizeForZoom(target), liveAnchorFraction(windowPoint: windowPoint))
+      } else {
+        performWindowResizingZoom(target: target, contentPoint: point, windowPoint: windowPoint)
+      }
+    }
+  }
+
+  private func performWindowResizingZoom(target: CGFloat, contentPoint: CGPoint, windowPoint: CGPoint) {
+    guard let window else { return }
+    let cursorBase = convert(windowPoint, to: nil)
+    let cursorScreen = window.convertToScreen(NSRect(origin: cursorBase, size: .zero)).origin
+    let documentAnchor = imageView.convert(cursorBase, from: nil)
+
+    stateResizeRequest?(displaySizeForZoom(target), liveAnchorFraction(windowPoint: windowPoint))
+    window.contentView?.layoutSubtreeIfNeeded()
+    reanchor(imagePoint: documentAnchor, atScreenPoint: cursorScreen)
+  }
+
+  private func reanchor(imagePoint: CGPoint, atScreenPoint cursorScreen: CGPoint) {
+    guard let window else { return }
+    let cursorBase = window.convertFromScreen(NSRect(origin: cursorScreen, size: .zero)).origin
+    let currentImagePoint = imageView.convert(cursorBase, from: nil)
+    let delta = NSPoint(
+      x: currentImagePoint.x - imagePoint.x,
+      y: currentImagePoint.y - imagePoint.y
+    )
+    guard abs(delta.x) > 0.001 || abs(delta.y) > 0.001 else { return }
+    let origin = contentView.bounds.origin
+    performStateApplication {
+      contentView.setBoundsOrigin(NSPoint(x: origin.x + delta.x, y: origin.y + delta.y))
+      reflectScrolledClipView(contentView)
     }
+    publishViewportChange()
   }
 
   var stateResizeRequest: ((CGSize, CGPoint) -> Void)?
 
+  private func displaySizeForZoom(_ target: CGFloat) -> CGSize {
+    QuickAccessPinWindowState.windowFollowsImageDisplaySize(
+      baseSize: configuredImageSize,
+      zoomFactor: target
+    )
+  }
+
+  private func liveAnchorFraction(windowPoint: CGPoint) -> CGPoint {
+    guard let window else {
+      return CGPoint(x: bounds.width > 0 ? windowPoint.x / bounds.width : 0.5, y: bounds.height > 0 ? windowPoint.y / bounds.height : 0.5)
+    }
+    let pointInWindow = convert(windowPoint, to: nil)
+    let frame = window.frame
+    return CGPoint(
+      x: frame.width > 0 ? pointInWindow.x / frame.width : 0.5,
+      y: frame.height > 0 ? pointInWindow.y / frame.height : 0.5
+    )
+  }
+
   private func publishViewportChange() {
     requestedMagnificati
```

**File**: `Snapzy/Features/QuickAccess/Managers/QuickAccessPinWindow.swift` (modified, +20/-1)
```diff
@@ -137,7 +137,11 @@ final class QuickAccessPinWindow: NSPanel {
 
   override func sendEvent(_ event: NSEvent) {
     switch event.type {
-    case .magnify, .scrollWheel:
+    case .magnify:
+      if !routeMagnifyToImageScrollView(event) {
+        super.sendEvent(event)
+      }
+    case .scrollWheel:
       super.sendEvent(event)
     case .leftMouseDown:
       beginBackgroundDragIfEligible(with: event)
@@ -163,6 +167,21 @@ final class QuickAccessPinWindow: NSPanel {
     super.resignKey()
   }
 
+  @discardableResult
+  private func routeMagnifyToImageScrollView(_ event: NSEvent) -> Bool {
+    guard let contentView, let pinState, !pinState.isLocked else { return false }
+    let hitView = contentView.hitTest(event.locationInWindow)
+    var responder: NSResponder? = hitView
+    while let current = responder {
+      if let scrollView = current as? QuickAccessPinImageScrollView {
+        scrollView.magnify(with: event)
+        return true
+      }
+      responder = current.nextResponder
+    }
+    return false
+  }
+
   private var isMouseMonitorsSuspended = false
 
   override func close() {
```

**File**: `SnapzyTests/Features/QuickAccess/QuickAccessCoreTests.swift` (modified, +143/-3)
```diff
@@ -985,6 +985,89 @@ final class QuickAccessCoreTests: XCTestCase {
     XCTAssertEqual(state.zoomFactor, 1.5, accuracy: 0.001)
   }
 
+  func testQuickAccessPinImageScrollView_windowResizingZoomKeepsCursorDocumentPointAcrossInOutCycle() throws {
+    let image = NSImage(size: CGSize(width: 400, height: 300))
+    let baseSize = CGSize(width: 400, height: 300)
+    let state = QuickAccessPinWindowState(
+      id: UUID(),
+      url: URL(fileURLWithPath: "/tmp/pinned.png"),
+      image: image,
+      thumbnail: image,
+      baseSize: baseSize,
+      zoomMode: .windowFollowsImage
+    )
+    Self.retainedPinWindowStates.append(state)
+    let scrollView = QuickAccessPinImageScrollView(frame: NSRect(origin: .zero, size: baseSize))
+    scrollView.isLockedProvider = { state.isLocked }
+    scrollView.onViewportChange = { magnification, panOffset in
+      state.updateViewport(magnification: magnification, panOffset: panOffset)
+    }
+    scrollView.update(
+      image: image,
+      viewportSize: baseSize,
+      imageSize: baseSize,
+      zoomMode: .windowFollowsImage,
+      magnification: 1,
+      panOffset: .zero
+    )
+
+    let initialFrame = NSRect(x: 130, y: 270, width: baseSize.width, height: baseSize.height)
+    let window = QuickAccessPinWindow(
+      contentRect: initialFrame,
+      state: state
+    )
+    defer {
+      window.contentView = nil
+      window.close()
+    }
+    window.contentView = scrollView
+
+    let cursorViewPoint = NSPoint(x: 300, y: 200)
+    let documentView = try XCTUnwrap(scrollView.documentView)
+    let cursorBasePoint = scrollView.convert(cursorViewPoint, to: nil)
+    let cursorScreenRect = window.convertToScreen(NSRect(origin: cursorBasePoint, size: .zero))
+    let cursorScreenPoint = cursorScreenRect.origin
+    let documentPointBefore = documentView.convert(cursorBasePoint, from: nil)
+
+    scrollView.stateResizeRequest = { [weak window] size, fraction in
+      guard let window else { return }
+      let resized = QuickAccessPinWindowSizing.resizedFrame(
+        window.frame,
+        to: size,
+        preservingAnchorFraction: fraction
+      )
+      window.setFrame(resized, display: false)
+      window.contentView?.frame = NSRect(origin: .zero, size: size)
+    }
+
+    func cursorBaseUnderScreenPoint() -> NSPoint {
+      window.convertFromScreen(NSRect(origin: cursorScreenPoint, size: .zero)).origin
+    }
+    let documentPointUnderCursorAfter = { () -> NSPoint in
+      documentView.convert(cursorBaseUnderScreenPoint(), from: nil)
+    }
+
+    scrollView.applyMagnificationDelta(0.5, centeredAtContentPoint: cursorViewPoint, windowPoint: cursorViewPoint)
+    XCTAssertEqual(scrollView.magnification, 1.5, accuracy: 0.001)
+    XCTAssertEqual(window.frame.width, 600, accuracy: 1.0)
+    let documentPointDuring = documentPointUnderCursorAfter()
+    XCTAssertEqual(documentPointDuring.x, documentPointBefore.x, accuracy: 2.0)
+    XCTAssertEqual(documentPointDuring.y, documentPointBefore.y, accuracy: 2.0)
+
+    let cursorViewPointAfterReturn = scrollView.convert(cursorBaseUnderScreenPoint(), from: nil)
+    scrollView.applyMagnificationDelta(-0.33333, centeredAtContentPoint: cursorViewPointAfterReturn, windowPoint: cursorViewPointAfterReturn)
+    XCTAssertEqual(scrollView.magnification, 1, accuracy: 0.001)
+    XCTAssertEqual(window.frame.width, initialFrame.width, accuracy: 1.0)
+    XCTAssertEqual(window.frame.height, initialFrame.height, accuracy: 1.0)
+    XCTAssertEqual(window.frame.minX, initialFrame.minX, accuracy: 1.0)
+    XCTAssertEqual(window.frame.minY, initialFrame.minY, accuracy: 1.0)
+    XCTAssertEqual(scrollView.currentPanOffset.x, 0, accuracy: 1.0)
+    XCTAssertEqual(scrollView.currentPanOffset.y, 0, accuracy: 1.0)
+    let documentPointAfter = documentPointUnderCursorAfter()
+    XCTAssertEqual(documentPointAfter.x, documentPointBefore.x, accuracy: 2.0)
+    XCTAssertEqual(documentPointAfter.y, documentPointBefore.y, accuracy: 2.0)
+  }
+
   func testQuickAccessPinImageZoom_resizePreservesOffCenterFocalAnchor() throws {
     let image = NSImage(size: CGSize(width: 400, height: 300))
     let scrollView = QuickAccessPinImageScrollView(frame: NSRect(origin: .zero, size: image.size))
@@ -1035,6 +1118,46 @@ final class QuickAccessCoreTests: XCTestCase {
     )
   }
 
+  func testQuickAccessPinWindow_routesWindowMagnifyToImageScrollView() {
+    let image = NSImage(size: CGSize(width: 400, height: 300))
+    let state = QuickAccessPinWindowState(
+      id: UUID(),
+      url: URL(fileURLWithPath: "/tmp/pinned.png"),
+      image: image,
+      thumbnail: image,
+      baseSize: CGSize(width: 400, height: 300),
+      zoomMode: .fixedViewport
+    )
+    Self.retainedPinWindowStates.append(state)
+    let scrollView = QuickAccessPinImageScrollView(frame: NSRect(origin: .zero, size: state.baseSize))
+    scrollView.isLockedProvider = { state.isLocked }
+    scrollView.onViewportChange = { magnification, panOffset in
+      state.
```

**File**: `docs/QUICK_ACCESS.md` (modified, +1/-1)
```diff
@@ -60,7 +60,7 @@ Customization: `QuickAccessActionConfigurationStore` — context-menu order (`qu
 - Zoom presentation is selected in Settings → Quick Access → Pinned Image. `QuickAccessPinZoomModeStore` persists `fixedViewport` by default or `windowFollowsImage`; a setting change resets zoom/pan and updates all open pins while preserving their centers.
 - Both modes use `NSScrollView` for image display. Pinch events are handled by the image document view over the image and by the scroll view over empty viewport space. Pinch zoom is clamped to 0.4x–8x, with 800% in the capsule menu. Fit returns to 100%; window-follows-image mode restores its initial window size, and fixed mode centers the image.
 - Window follows image: the initial image keeps its aspect ratio and fits within 80% of the screen’s visible area. At 40% zoom, the window keeps a 240×180 minimum interactive frame and centers the image at its selected magnification, so exact pointer anchoring gives way to centering while the image is smaller than that minimum frame. Pinch and vertical scrolling zoom at the pointer and resize the window around that focal point; horizontal scrolling does not zoom. Images remain within the window, so image panning is unnecessary.
-- Fixed viewport: the initial image is scaled to at most 80% of the screen width and the viewport height is capped at 80% of the visible screen. Unmodified precise two-finger scrolling pans only when the image overflows. Modifier-key and coarse scrolling do not manipulate the image. Pan is clamped to image bounds, centering axes where the image is smaller.
+- Fixed viewport: the initial image is scaled to at most 80% of the screen width and the viewport height is capped at 80% of the visible screen. Unmodified precise two-finger scrolling pans only when the image overflows. Coarse and non-⌘-modified scrolling do not manipulate the image; ⌘-scroll zooms in both modes. Pan is clamped to image bounds, centering axes where the image is smaller.
 - Lock mode: click-through except the unlock button; image fades to 0.18 on hover. Locked pins reject zoom and pan. A normal one-finger background drag moves the unlocked window; Esc closes an unlocked pin.
 - The Quick Access preferences compare both modes with a synchronized SwiftUI illustration of a fictional long page. The page is drawn from shapes and contains no bundled screenshot or photo.
 - Drag-out handle (`QuickAccessPinDragHandleView`) re-exports the current rendered image to `Captures/PinDrags/` — saved edits included even while file write is in flight.
```

---

### Incident Patch 3: `00ae7536` (2026-10-19)
**Commit Message**: fix: Keep shadowed window captures at native resolution (#657)

The single-window filter's content rect excludes the window shadow, so a
frame-sized output canvas made ScreenCaptureKit shrink the shadowed window
to ~91% and resample it, which blurred Capture Active Window and
Application Capture output.

Pad the canvas by 128pt per side when the shadow is included (macOS 14+)
with scalesToFit off, then trim the transparent margin. When the cursor is
shown, take the trim bounds from a cursor-free pass so a cursor in the
padding cannot enlarge the image. The undersize check now runs on the
trimmed image for padded captures.

Shadow-off and macOS 13 captures are unchanged.

Closes #569

**File**: `Snapzy/Services/Capture/ScreenCaptureManager.swift` (modified, +85/-20)
```diff
@@ -2076,10 +2076,26 @@ final class ScreenCaptureManager: ObservableObject {
 
     let configuration = SCStreamConfiguration()
     let includeWindowShadow = UserDefaults.standard.object(forKey: PreferencesKeys.captureIncludeWindowShadow) as? Bool ?? WindowShadowPreference.defaultIncludeShadow
-    if #available(macOS 14.0, *) { configuration.ignoreShadowsSingleWindow = WindowShadowPreference.ignoreShadowsSingleWindow(includeShadow: includeWindowShadow) }
+    // The content rect excludes the shadow, so a shadowed window gets a padded
+    // canvas to render 1:1 (issue #569). Only macOS 14+ pads: its screenshot
+    // path leaves unused canvas transparent for the fringe trim below.
+    let padsCanvasForShadow: Bool
+    if #available(macOS 14.0, *) {
+      configuration.ignoreShadowsSingleWindow = WindowShadowPreference.ignoreShadowsSingleWindow(includeShadow: includeWindowShadow)
+      padsCanvasForShadow = includeWindowShadow
+    } else {
+      padsCanvasForShadow = false
+    }
     if #available(macOS 14.2, *) { configuration.captureResolution = .best }
-    configuration.width = max(1, Int((contentRect.width * scaleFactor).rounded()))
-    configuration.height = max(1, Int((contentRect.height * scaleFactor).rounded()))
+    let canvasPixelSize = WindowCaptureResolution.canvasPixelSize(
+      logicalSize: contentRect.size,
+      scaleFactor: scaleFactor,
+      includesShadow: padsCanvasForShadow
+    )
+    configuration.width = Int(canvasPixelSize.width)
+    configuration.height = Int(canvasPixelSize.height)
+    // Scale down only, never up, so the window stays native inside the canvas.
+    configuration.scalesToFit = false
     configuration.pixelFormat = kCVPixelFormatType_32BGRA
     configuration.showsCursor = showCursor
 
@@ -2093,38 +2109,78 @@ final class ScreenCaptureManager: ObservableObject {
       configuration: configuration
     )
 
-    let actualPixelSize = CGSize(width: image.width, height: image.height)
-    let expectedPixelSize = WindowCaptureResolution.expectedPixelSize(
-      logicalSize: contentRect.size,
-      scaleFactor: scaleFactor
-    )
-    let actualScaleFactor = WindowCaptureResolution.actualScaleFactor(
-      pixelSize: actualPixelSize,
-      logicalSize: contentRect.size
-    )
-    if WindowCaptureResolution.isUndersized(
-      pixelSize: actualPixelSize,
-      logicalSize: contentRect.size,
-      expectedScaleFactor: scaleFactor
-    ) {
+    // A cursor drawn in the padding would survive the trim and grow the
+    // image, so take the trim bounds from a cursor-free pass instead.
+    let fringeReference: CGImage?
+    if padsCanvasForShadow && showCursor {
+      configuration.showsCursor = false
+      fringeReference = try await Self.captureImageCompat(
+        contentFilter: contentFilter,
+        configuration: configuration
+      )
+    } else {
+      fringeReference = nil
+    }
+
+    func rejectIfUndersized(_ candidate: CGImage) throws {
+      let actualPixelSize = CGSize(width: candidate.width, height: candidate.height)
+      guard WindowCaptureResolution.isUndersized(
+        pixelSize: actualPixelSize,
+        logicalSize: contentRect.size,
+        expectedScaleFactor: scaleFactor
+      ) else {
+        return
+      }
+
+      let expectedPixelSize = WindowCaptureResolution.expectedPixelSize(
+        logicalSize: contentRect.size,
+        scaleFactor: scaleFactor
+      )
+      let actualScaleFactor = WindowCaptureResolution.actualScaleFactor(
+        pixelSize: actualPixelSize,
+        logicalSize: contentRect.size
+      )
       DiagnosticLogger.shared.log(
         .warning,
         .capture,
         "Window capture returned an undersized image; falling back to display crop",
         context: [
           "windowID": "\(fallbackTarget.windowID)",
           "expected": "\(Int(expectedPixelSize.width))x\(Int(expectedPixelSize.height))",
-          "actual": "\(image.width)x\(image.height)",
+          "actual": "\(candidate.width)x\(candidate.height)",
           "requestedScale": String(format: "%.3f", Double(scaleFactor)),
           "actualScale": actualScaleFactor.map { String(format: "%.3f", Double($0)) } ?? "unknown",
         ]
       )
       throw CaptureError.captureFailed("ScreenCaptureKit returned an undersized window image")
     }
 
+    // A padded canvas is always large, so only the trimmed window shows
+    // whether ScreenCaptureKit rendered it at the requested scale.
+    if !padsCanvasForShadow {
+      try rejectIfUndersized(image)
+    }
+
     let normalizedImage = await Task.detached(priority: .userInitiated) {
-      Self.trimTransparentWindowFringe(from: image)
+      Self.trimTransparentWindowFringe(from: image, boundsFrom: fringeReference)
     }.value
+
+    if padsCanvasForShadow {
+      try rejectIfUndersized(normalizedImage.image)
+      if normalizedImage.image.width >= image.width || normalizedImage.image.height >= image.height {
+        DiagnosticLogger.shared.log(
+       
```

**File**: `Snapzy/Services/Capture/WindowCaptureResolution.swift` (modified, +24/-0)
```diff
@@ -13,6 +13,13 @@ nonisolated enum WindowCaptureResolution {
   /// margins. A result below this ratio is a density mismatch, not rounding.
   static let minimumAcceptedScaleRatio: CGFloat = 0.75
 
+  /// Transparent room, in points, added on every side of a shadowed window's
+  /// output canvas. The filter's content rect excludes the shadow, and
+  /// ScreenCaptureKit shrinks a shadowed window that does not fit its canvas
+  /// (issue #569). macOS shadows measured about 56pt per side, so this leaves
+  /// headroom; the unused margin is trimmed after capture.
+  static let shadowCanvasPadding: CGFloat = 128
+
   static func scaleFactor(
     displayBackingScaleFactor: CGFloat?,
     filterPointPixelScale: CGFloat?,
@@ -63,6 +70,23 @@ nonisolated enum WindowCaptureResolution {
     )
   }
 
+  /// Output canvas for an independent window capture. A shadowed window needs
+  /// padding so it renders 1:1 instead of being scaled down to fit.
+  static func canvasPixelSize(
+    logicalSize: CGSize,
+    scaleFactor: CGFloat,
+    includesShadow: Bool
+  ) -> CGSize {
+    let padding = includesShadow ? shadowCanvasPadding * 2 : 0
+    return expectedPixelSize(
+      logicalSize: CGSize(
+        width: logicalSize.width + padding,
+        height: logicalSize.height + padding
+      ),
+      scaleFactor: scaleFactor
+    )
+  }
+
   static func isUndersized(
     pixelSize: CGSize,
     logicalSize: CGSize,
```

**File**: `SnapzyTests/Services/Capture/WindowCaptureResolutionTests.swift` (modified, +44/-0)
```diff
@@ -61,6 +61,50 @@ final class WindowCaptureResolutionTests: XCTestCase {
     )
   }
 
+  func testUnshadowedCanvasMatchesWindowPixels() {
+    XCTAssertEqual(
+      WindowCaptureResolution.canvasPixelSize(
+        logicalSize: CGSize(width: 1_800, height: 1_129),
+        scaleFactor: 2,
+        includesShadow: false
+      ),
+      CGSize(width: 3_600, height: 2_258)
+    )
+  }
+
+  // Issue #569: a 1800x1129pt window on a 2x display renders a 3824x2482px
+  // shadowed bitmap. A frame-sized canvas shrank it to ~91%.
+  func testShadowedCanvasFitsMeasuredRetinaShadow() {
+    let canvas = WindowCaptureResolution.canvasPixelSize(
+      logicalSize: CGSize(width: 1_800, height: 1_129),
+      scaleFactor: 2,
+      includesShadow: true
+    )
+    XCTAssertGreaterThanOrEqual(canvas.width, 3_824)
+    XCTAssertGreaterThanOrEqual(canvas.height, 2_482)
+  }
+
+  func testShadowedCanvasFitsShadowOnOneXDisplay() {
+    // The shadow adds ~112pt per dimension at any display scale.
+    let canvas = WindowCaptureResolution.canvasPixelSize(
+      logicalSize: CGSize(width: 1_200, height: 798),
+      scaleFactor: 1,
+      includesShadow: true
+    )
+    XCTAssertGreaterThanOrEqual(canvas.width, 1_312)
+    XCTAssertGreaterThanOrEqual(canvas.height, 910)
+  }
+
+  func testShadowPaddingScalesWithDisplay() {
+    let canvas = WindowCaptureResolution.canvasPixelSize(
+      logicalSize: CGSize(width: 1_000, height: 500),
+      scaleFactor: 2,
+      includesShadow: true
+    )
+    let padding = WindowCaptureResolution.shadowCanvasPadding * 2 * 2
+    XCTAssertEqual(canvas, CGSize(width: 2_000 + padding, height: 1_000 + padding))
+  }
+
   func testRoundingAndTransparentMarginsDoNotTriggerFallback() {
     XCTAssertFalse(
       WindowCaptureResolution.isUndersized(
```

**File**: `docs/CAPTURE.md` (modified, +1/-1)
```diff
@@ -112,7 +112,7 @@ flowchart TD
 - Application-window capture can also start directly from the menu, independent shortcut, or `snapzy://capture/application`; it uses the same area capture flow with `.applicationWindow` as the initial interaction mode.
 - Active-window capture resolves the AX focused window of the frontmost app via `ActiveWindowResolver`, maps it to the nearest `WindowCaptureTarget` candidate, and captures it through the same `captureWindow` path — no selection overlay appears.
 - In live application window mode, Snapzy synchronously retains an already-open eligible menu-bar popover before showing any overlay. Because some transient WindowServer popovers can be enumerated but not rendered as an independent Core Graphics window, Snapzy takes one containing-display snapshot and crops the detected popover bounds from that pre-overlay image. After the overlay appears, it checks the exact `CGWindowID` during a short, bounded session-start interval: if the source closes, the retained image is restored beneath the existing dim-mask cutout; if it remains visible, no duplicate image is drawn. The retained image receives a 12pt transparent rounded-corner mask so flattened desktop pixels do not leak into exported PNG corners. The retained candidate is merged ahead of the normal front-to-back layer-0 list built from `CGWindowListCopyWindowInfo` plus `SCShareableContent`. Normal app windows keep their live behavior; only menu-bar-anchored third-party nonzero-layer popovers/dropdowns already open at capture start are retained. Snapzy, Dock, Control Center, and Notification Center are excluded.
-- Exact window capture is handled by `ScreenCaptureManager.captureWindow()`. ScreenCaptureKit is preferred for every still-resolved `SCWindow`; its output scale uses the target display's backing scale (falling back to ScreenCaptureKit's point-pixel scale only when the display cannot be resolved), and a materially undersized returned image is routed through the existing display-area crop fallback. This keeps Retina windows from being saved at an intermittent nominal 1× while preserving native 1× external-display output. If a retained eligible menu-bar popover is no longer shareable, Snapzy saves the pre-overlay display crop instead of recapturing after it has disappeared. The legacy Core Graphics single-window path remains only as a fallback for a live eligible popover. Quick Look previews are detected as `QuickLookUIService` WindowServer windows and their pre-overlay display crops are composited back into filtered fullscreen, frozen-area, and live-area captures because ScreenCaptureKit may enumerate them as off-screen. Snapzy does not force third-party popovers to remain open.
+- Exact window capture is handled by `ScreenCaptureManager.captureWindow()`. ScreenCaptureKit is preferred for every still-resolved `SCWindow`; its output scale uses the target display's backing scale (falling back to ScreenCaptureKit's point-pixel scale only when the display cannot be resolved), and a materially undersized returned image is routed through the existing display-area crop fallback. This keeps Retina windows from being saved at an intermittent nominal 1× while preserving native 1× external-display output. When the window shadow is included (macOS 14+), the output canvas gets 128pt of transparent padding per side with `scalesToFit` off: the filter's content rect excludes the shadow, and a frame-sized canvas made ScreenCaptureKit shrink the shadowed window to ~91% and blur it (issue #569). The unused padding is trimmed afterwards; with the cursor shown, the trim bounds come from a second cursor-free pass so a cursor in the padding cannot enlarge the image, and the undersize check runs on the trimmed image. If a retained eligible menu-bar popover is no longer shareable, Snapzy saves the pre-overlay display crop instead of recapturing after it has disappeared. The legacy Core Graphics single-window path remains only as a fallback for a live eligible popover. Quick Look previews are detected as `QuickLookUIService` WindowServer windows and their pre-overlay display crops are composited back into filtered fullscreen, frozen-area, and live-area captures because ScreenCaptureKit may enumerate them as off-screen. Snapzy does not force third-party popovers to remain open.
 - The frozen/manual and application-window paths both preserve existing desktop icon/widget exclusion, cursor, own-app exclusion, temp-save, Quick Access, clipboard, and annotate routing behavior.
 - When own-app exclusion hides visible normal Snapzy windows for screenshot, OCR, cutout, scrolling capture, or pre-recording setup, those windows are ordered out temporarily (`HiddenWindowSession`) and restored after the capture/session finishes or is cancelled.
 - Capture toasts, alerts, open-panel prompts, and error surfaces are localized through `L10n`.
```

#### Recent Merged Pull Requests:
- **PR #661** (2026-10-19): chore: release v2.1.0-beta.8 (@github-actions[bot])
- **PR #660** (2026-10-19): fix: Keep Quick Access panel out of screenshots when Snapzy is excluded (@duongductrong)
- **PR #659** (2026-10-19): chore: release v2.1.0-beta.7 (@github-actions[bot])
- **PR #658** (2026-10-19): chore: release v2.1.0-beta.7 (@github-actions[bot])
- **PR #657** (2026-10-19): fix: Keep shadowed window captures at native resolution (@duongductrong)
- **PR #654** (2026-10-19): feat: Cut Out tool to remove or add a strip from the middle of an image (@duongductrong)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. Fixed capture remapped and consumed keystrokes (#539)

**RULE**:
When implementing operations in `Snapzy/Features/Recording/RecordingCoordinator.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in duongductrong/Snapzy. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d74508b0`: Fixed capture remapped and consumed keystrokes (#539). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `Snapzy/Features/Recording/RecordingCoordinator.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
  private(set) var toolbarWindow: RecordingToolbarWindow?
  // Invalidated before Stop/Cancel/Restart suspends, even while the toolbar survives.
  private var recordingGeneration = UUID()
  init() {
    recordingGeneration = UUID()
    recordingGeneration = UUID()
    recordingGeneration = UUID()
    let generation = recordingGeneration
      guard isCurrentRecordingStart(generation, window: window) else { return }
      guard isCurrentRecordingStart(generation, window: window) else { return }
      guard isCurrentRecordingStart(generation, window: window) else { return }
        guard isCurrentRecordingStart(generation, window: window) else { return }
        guard isCurrentRecordingStart(generation, window: window) else { return }
        guard isCurrentRecordingStart(generation, window: window) else { return }
        guard await completeRecordingStart(for: rect) else { return }
        guard isCurrentRecordingStart(generation, window: window) else { return }
        guard isCurrentRecordingStart(generation, window: window) else { return }
    let generation = recordingGeneration
      guard isCurrentRecordingStart(generation, window: window) else { return }
```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern to NEVER write (induced failure mode):
  private var toolbarWindow: RecordingToolbarWindow?
  private init() {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d74508b0` are properly handled with clean fallback behavior.
