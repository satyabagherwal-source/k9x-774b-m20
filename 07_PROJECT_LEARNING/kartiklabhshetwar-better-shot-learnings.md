# Forensic Learning Record (Deep Inspection): KartikLabhshetwar/better-shot

> **Canonical Artifact**: `07_PROJECT_LEARNING/kartiklabhshetwar-better-shot-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/KartikLabhshetwar/better-shot](https://github.com/KartikLabhshetwar/better-shot))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:27:39.520Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `KartikLabhshetwar/better-shot`
- **Description**: Screenshot, screen recording, and video editor for macOS. Native SwiftUI app with capture deck, 75+ customizable shortcuts, URL scheme automation, and self-hosted cloud sharing. Open-source alternative to CleanShot X and Loom.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2360 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Sources/BetterShot/AnnotationBackgroundRenderer.swift`
```
//
//  AnnotationBackgroundRenderer.swift
//  BetterShot
//

import AppKit
import CoreGraphics
import ImageIO
import SwiftUI

nonisolated enum AnnotationBackgroundRenderer {
    /// Decoded wallpapers are reused across settled previews and exports so
    /// compose doesn't pay a disk read + full decode per render. NSCache is
    /// thread-safe and evicts under memory pressure.
    nonisolated(unsafe) private static let wallpaperCache: NSCache<NSString, WallpaperCacheBox> = {
        let cache = NSCache<NSString, WallpaperCacheBox>()
        cache.countLimit = 4
        cache.totalCostLimit = 192 * 1024 * 1024
        return cache
    }()

    typealias ForegroundOverlay = (
        _ context: CGContext,
        _ layout: AnnotationBackgroundLayout,
        _ imageRect: CGRect,
        _ imageClipPath: CGPath
    ) -> Void
    typealias CanvasOverlay = (_ context: CGContext, _ layout: AnnotationBackgroundLayout, _ imageRect: CGRect) -> Void

    static func compose(
        annotatedImage: CGImage,
        settings: AnnotationBackgroundSettings,
        colorSpace: CGColorSpace
    ) throws -> CGImage {
        try compose(
            contentImage: annotatedImage,
            settings: settings,
            colorSpace: colorSpace
        )
    }

    static func compose(
        contentImage: CGImage,
        settings: AnnotationBackgroundSettings,
        colorSpace: CGColorSpace,
        foregroundOverlay: ForegroundOverlay? = nil,
        canvasOverlay: CanvasOverlay? = nil
    ) throws -> CGImage {
        let contentSize = CGSize(width: contentImage.width, height: contentImage.height)
        let layout = AnnotationBackgroundLayout.make(contentSize: contentSize, settings: settings)
        let width = max(1, Int(ceil(layout.canvasSize.width)))
        let height = max(1, Int(ceil(layout.canvasSize.height)))

        guard let context = CGContext(
            data: nil,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: 0,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else {
            throw CocoaError(.fileWriteUnknown)
        }

        let canvasRect = CGRect(x: 0, y: 0, width: width, height: height)
        context.interpolationQuality = .high
        drawBackground(settings.style, in: canvasRect, context: context)

        let borderWidth = settings.border.pixelThickness(for: contentSize)
        let imageRect = pixelAlignedImageRect(
            flipped(layout.imageRect, canvasHeight: CGFloat(height)),
            contentSize: contentSize,
            canvasSize: canvasRect.size,
            minimumInset: borderWidth
        )
        let frameGeometry = AnnotationScreenshotFrameGeometry(
            imageRect: imageRect,
            cardRect: imageRect.insetBy(dx: -borderWidth, dy: -borderWidth),
            settings: settings
        )
        let clipPath = frameGeometry.imagePath
        let usesSceneBlur = settings.progressiveBlur.isActive
            && settings.progressiveBlur.edgeMode == .bleed
        let displayedImage = if settings.progressiveBlur.edgeMode == .clipped {
            try AnnotationMockupEffectsRenderer.progressiveBlur(
                contentImage,
                settings: settings.progressiveBlur,
                colorSpace: colorSpace
            )
        } else {
            contentImage
        }

        if settings.camera.hasEffect {
            guard let foregroundContext = CGContext(
                data: nil,
                width: width,
                height: height,
                bitsPerComponent: 8,
                bytesPerRow: 0,
                space: colorSpace,
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
            ) else {
                throw CocoaError(.fileWriteUnknown)
            }

            drawScreenshotFrameBacking(
                settings,
                geometry: frameGeometry,
                castsShadow: true,
                context: foregroundContext
            )
            drawImage(displayedImage, in: imageRect, clippedTo: clipPath, context: foregroundContext)
            foregroundOverlay?(foregroundContext, layout, imageRect, clipPath)

            guard let foregroundImage = foregroundContext.makeImage() else {
                throw CocoaError(.fileWriteUnknown)
            }

            let topLeftImageRect = flipped(imageRect, canvasHeight: CGFloat(height))
            let projection = AnnotationCameraGeometry.projection(
                sourceRect: canvasRect,
                imageRect: topLeftImageRect,
                canvasSize: canvasRect.size,
                settings: settings.camera
            )
            try AnnotationMockupEffectsRenderer.drawProjectedForeground(
                foregroundImage,
                projection: projection,
                canvasSize: canvasRect.size,
                colorSpace: colorSpace,
                into: context
            )
        } else {
            drawScreenshotFrameBacking(
                settings,
                geometry: frameGeometry,
                castsShadow: settings.isEnabled,
                context: context
            )
            drawImage(displayedImage, in: imageRect, clippedTo: clipPath, context: context)
            foregroundOverlay?(context, layout, imageRect, clipPath)
        }

        if usesSceneBlur {
            guard let sceneImage = context.makeImage() else {
                throw CocoaError(.fileWriteUnknown)
            }
            context.clear(canvasRect)
            try AnnotationMockupEffectsRenderer.drawProgressivelyBlurredScene(
                sceneImage,
                canvasSize: canvasRect.size,
                colorSpace: colorSpace,
                progressiveBlurSettings: settings.progressiveBlur,
                into: context
            )
        }

        canvasOverlay?(context, layout, imageRect)

        guard let renderedImage = context.makeImage() else {
            throw CocoaError(.fileWriteUnknown)
        }
        return renderedImage
    }

    private static func drawImage(
        _ image: CGImage,
        in rect: CGRect,
        clippedTo path: CGPath,
        context: CGContext
    ) {
        context.saveGState()
        context.interpolationQuality = .none
        context.addPath(path)
        context.clip()
        context.draw(image, in: rect)
        context.restoreGState()
    }

    private static func drawScreenshotFrameBacking(
        _ settings: AnnotationBackgroundSettings,
        geometry: AnnotationScreenshotFrameGeometry,
        castsShadow: Bool,
        context: CGContext
    ) {
        if settings.border.isVisible, geometry.borderWidth > 0 {
            let opacity = min(max(settings.border.opacity, 0), 1)
                * min(max(settings.border.color.alpha, 0), 1)

            if castsShadow {
                drawShadow(
                    path: geometry.cardPath,
                    knockoutPath: geometry.cardShadowKnockoutPath,
                    strength: settings.shadow,
                    style: settings.shadowStyle,
                    context: context
                )
            }
            context.saveGState()
            context.setFillColor(
                settings.border.color.nsColor.withAlphaComponent(opacity).cgColor
            )
            context.addPath(geometry.cardPath)
            context.fillPath()
            context.restoreGState()
        } else if castsShadow {
            drawShadow(
                path: geometry.imagePath,
                knockoutPath: geometry.imageShadowKnockoutPath,
                strength: settings.shadow,
                style: settings.shadowStyle,
                context: context
            )
        }
    }

    static func drawWatermark(
        _ settings: AnnotationWatermarkSettings,
        in rect: CGRect,
        context: CGContext
    ) {
        let text = settings.text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard settings.isVisible,
              !text.isEmpty,
              rect.width > 1,
              rect.height > 1 else {
            return
        }

        let rows = max(2, Int(round(settings.density)))
        let spacingY = rect.height / CGFloat(rows)
        let spacingX = max(1, spacingY * 2.2)
        let diagonal = hypot(rect.width, rect.height)
        let columnCount = max(2, Int(ceil(diagonal / spacingX)))
        let rowCount = max(2, Int(ceil(diagonal / spacingY)))
        let originX = rect.midX - CGFloat(columnCount) * spacingX / 2
        let originY = rect.midY - CGFloat(rowCount) * spacingY / 2

        let font = AnnotationWatermarkTypography.nsFont(size: settings.fontSize)
        let color = settings.color.nsColor.withAlphaComponent(min(0.75, max(0, settings.opacity)))
        let attributes: [NSAttributedString.Key: Any] = [
            .font: font,
            .foregroundColor: color
        ]
        let attributedText = NSAttributedString(string: text, attributes: attributes)
        let measuredSize = attributedText.size()
        guard measuredSize.width > 0, measuredSize.height > 0 else { return }

        context.saveGState()
        context.clip(to: rect)
        context.translateBy(x: rect.midX, y: rect.midY)
        context.rotate(by: -settings.rotationDegrees * .pi / 180)
        context.translateBy(x: -rect.midX, y: -rect.midY)

        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: false)
        for row in 0...rowCount {
            for column in 0...columnCount {
                let center = CGPoint(
                    x: originX + CGFloat(column) * spacingX,
                    y: originY + CGFloat(row) * spacingY
                )
                attributedText.draw(
                    with: CGRect(
                        x: center.x - measuredSize.width / 2,
                        y: center.y - measuredSize.hei
```

### Core Architecture Module: `Sources/BetterShot/AnnotationMockupEffectsRenderer.swift`
```
//
//  AnnotationMockupEffectsRenderer.swift
//  BetterShot
//

import CoreGraphics
import CoreImage
import CoreImage.CIFilterBuiltins

enum AnnotationMockupEffectsError: Error {
    case progressiveBlurFailed
    case cameraProjectionFailed
}

nonisolated enum AnnotationMockupEffectsRenderer {
    /// `CIContext` is immutable after creation and documented for reuse across
    /// render calls. Access is serialized for previews by the worker below;
    /// exports run on the editor's actor.
    nonisolated(unsafe) private static let context = CIContext(options: [.cacheIntermediates: false])

    nonisolated static func progressiveBlur(
        _ image: CGImage,
        settings: AnnotationProgressiveBlurSettings,
        colorSpace: CGColorSpace
    ) throws -> CGImage {
        guard settings.isActive else { return image }

        let input = CIImage(cgImage: image)
        let extent = input.extent
        let output = try progressiveBlurCIImage(input, settings: settings)
        guard let renderedImage = context.createCGImage(
            output,
            from: extent,
            format: .RGBA8,
            colorSpace: colorSpace
        ) else {
            throw AnnotationMockupEffectsError.progressiveBlurFailed
        }
        return renderedImage
    }

    static func drawProjectedForeground(
        _ image: CGImage,
        projection: AnnotationCameraProjection,
        canvasSize: CGSize,
        colorSpace: CGColorSpace,
        into destinationContext: CGContext
    ) throws {
        let canvasRect = CGRect(origin: .zero, size: canvasSize)
        let output = try projectedForegroundCIImage(
            image,
            projection: projection,
            canvasSize: canvasSize
        )

        try draw(
            output,
            in: canvasRect,
            colorSpace: colorSpace,
            into: destinationContext
        )
    }

    static func drawProgressivelyBlurredScene(
        _ image: CGImage,
        canvasSize: CGSize,
        colorSpace: CGColorSpace,
        progressiveBlurSettings: AnnotationProgressiveBlurSettings,
        into destinationContext: CGContext
    ) throws {
        let canvasRect = CGRect(origin: .zero, size: canvasSize)
        let output = try progressiveBlurCIImage(
            CIImage(cgImage: image),
            settings: progressiveBlurSettings
        )
        try draw(
            output,
            in: canvasRect,
            colorSpace: colorSpace,
            into: destinationContext
        )
    }

    private static func draw(
        _ image: CIImage,
        in canvasRect: CGRect,
        colorSpace: CGColorSpace,
        into destinationContext: CGContext
    ) throws {
        // Reuse the GPU context; a CGContext-backed CIContext is recreated
        // for every effect and cannot reuse its compiled filter pipeline.
        guard let rendered = context.createCGImage(
            image, from: canvasRect, format: .RGBA8, colorSpace: colorSpace
        ) else {
            throw AnnotationMockupEffectsError.cameraProjectionFailed
        }
        destinationContext.draw(rendered, in: canvasRect)
    }

    nonisolated private static func blurMask(
        geometry: AnnotationProgressiveBlurGeometry,
        settings: AnnotationProgressiveBlurSettings
    ) -> CIImage? {
        let baseMask: CIImage?

        switch settings.mode {
        case .radial:
            let gradient = CIFilter.radialGradient()
            gradient.center = geometry.focus
            gradient.radius0 = Float(geometry.radialFocusRadius)
            gradient.radius1 = Float(geometry.radialFocusRadius + geometry.transitionWidth)
            gradient.color0 = CIColor(red: 0, green: 0, blue: 0, alpha: 1)
            gradient.color1 = CIColor(red: 1, green: 1, blue: 1, alpha: 1)
            baseMask = gradient.outputImage

        case .directional:
            let positiveFocusEdge = CGPoint(
                x: geometry.focus.x
                    + geometry.directionNormal.dx * geometry.directionalFocusHalfWidth,
                y: geometry.focus.y
                    + geometry.directionNormal.dy * geometry.directionalFocusHalfWidth
            )
            let negativeFocusEdge = CGPoint(
                x: geometry.focus.x
                    - geometry.directionNormal.dx * geometry.directionalFocusHalfWidth,
                y: geometry.focus.y
                    - geometry.directionNormal.dy * geometry.directionalFocusHalfWidth
            )
            let positive = directionalGradient(
                from: positiveFocusEdge,
                to: CGPoint(
                    x: positiveFocusEdge.x
                        + geometry.directionNormal.dx * geometry.transitionWidth,
                    y: positiveFocusEdge.y
                        + geometry.directionNormal.dy * geometry.transitionWidth
                )
            )
            let negative = directionalGradient(
                from: negativeFocusEdge,
                to: CGPoint(
                    x: negativeFocusEdge.x
                        - geometry.directionNormal.dx * geometry.transitionWidth,
                    y: negativeFocusEdge.y
                        - geometry.directionNormal.dy * geometry.transitionWidth
                )
            )

            let maximum = CIFilter.maximumCompositing()
            maximum.inputImage = positive
            maximum.backgroundImage = negative
            baseMask = maximum.outputImage
        }

        return baseMask?.cropped(to: geometry.extent)
    }

    nonisolated private static func directionalGradient(from start: CGPoint, to end: CGPoint) -> CIImage? {
        let gradient = CIFilter.smoothLinearGradient()
        gradient.point0 = start
        gradient.point1 = end
        gradient.color0 = CIColor(red: 0, green: 0, blue: 0, alpha: 1)
        gradient.color1 = CIColor(red: 1, green: 1, blue: 1, alpha: 1)
        return gradient.outputImage
    }

    private static func coreImagePoint(_ point: CGPoint, canvasHeight: CGFloat) -> CGPoint {
        CGPoint(x: point.x, y: canvasHeight - point.y)
    }

    private static func projectedForegroundCIImage(
        _ image: CGImage,
        projection: AnnotationCameraProjection,
        canvasSize: CGSize
    ) throws -> CIImage {
        guard canvasSize.width > 0, canvasSize.height > 0 else {
            throw AnnotationMockupEffectsError.cameraProjectionFailed
        }

        let filter = CIFilter.perspectiveTransform()
        filter.inputImage = CIImage(cgImage: image)
        filter.topLeft = coreImagePoint(projection.quad.topLeft, canvasHeight: canvasSize.height)
        filter.topRight = coreImagePoint(projection.quad.topRight, canvasHeight: canvasSize.height)
        filter.bottomRight = coreImagePoint(projection.quad.bottomRight, canvasHeight: canvasSize.height)
        filter.bottomLeft = coreImagePoint(projection.quad.bottomLeft, canvasHeight: canvasSize.height)

        let canvasRect = CGRect(origin: .zero, size: canvasSize)
        guard let output = filter.outputImage?.cropped(to: canvasRect) else {
            throw AnnotationMockupEffectsError.cameraProjectionFailed
        }
        return output
    }

    nonisolated private static func progressiveBlurCIImage(
        _ input: CIImage,
        settings: AnnotationProgressiveBlurSettings
    ) throws -> CIImage {
        guard settings.isActive else { return input }

        let extent = input.extent
        let geometry = AnnotationProgressiveBlurGeometry(
            extent: extent,
            settings: settings,
            coordinateOrigin: .bottomLeft
        )
        guard extent.width > 0, extent.height > 0,
              let mask = blurMask(geometry: geometry, settings: settings) else {
            throw AnnotationMockupEffectsError.progressiveBlurFailed
        }

        let blur = CIFilter.maskedVariableBlur()
        blur.inputImage = input.clampedToExtent()
        blur.mask = mask
        blur.radius = Float(geometry.renderRadius)
        guard let output = blur.outputImage?.cropped(to: extent) else {
            throw AnnotationMockupEffectsError.progressiveBlurFailed
        }
        return output
    }
}

```

### Core Architecture Module: `Sources/BetterShot/AnnotationRenderer.swift`
```
//
//  AnnotationRenderer.swift
//  BetterShot
//

import AppKit
import CryptoKit
import ImageIO
import UniformTypeIdentifiers

enum AnnotationRenderer {
    // ponytail: one PNG up to 32 MiB; use per-document entries if alternating editors needs reuse.
    // NSCache is thread-safe and can discard it under memory pressure.
    nonisolated(unsafe) private static let pngCache: NSCache<NSData, NSData> = {
        let cache = NSCache<NSData, NSData>()
        cache.countLimit = 1
        cache.totalCostLimit = 32 * 1024 * 1024
        return cache
    }()

    nonisolated private static func pngCacheKey(
        sourceURL: URL, shapes: [AnnoShape], background: AnnotationBackgroundSettings
    ) -> NSData? {
        // Hash file contents so overwrites with the same path, size, or timestamp
        // cannot return stale pixels. Missing/unreadable dependencies bypass reuse.
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        guard let source = try? Data(contentsOf: sourceURL, options: .mappedIfSafe),
              let edits = try? encoder.encode(AnnotationDocument(shapes: shapes, background: background))
        else { return nil }
        var digest = SHA256()
        digest.update(data: source)
        digest.update(data: edits)
        if case .customWallpaper(let wallpaper) = background.style {
            guard let data = try? Data(contentsOf: wallpaper.url, options: .mappedIfSafe) else { return nil }
            digest.update(data: data)
        }
        return Data(digest.finalize()) as NSData
    }

    /// Off-main variants: large exports (full-resolution compose + Core Image
    /// blur) are slow enough to beachball the UI, and the whole render graph
    /// is nonisolated, so hop to a background thread and await the result.
    static func renderInBackground(
        sourceURL: URL,
        shapes: [AnnoShape],
        backgroundSettings: AnnotationBackgroundSettings = AnnotationBackgroundSettings(),
        destinationURL: URL,
        contentType: UTType
    ) async throws {
        try await Task.detached(priority: .userInitiated) {
            try render(
                sourceURL: sourceURL,
                shapes: shapes,
                backgroundSettings: backgroundSettings,
                destinationURL: destinationURL,
                contentType: contentType
            )
        }.value
    }

    static func renderToTemporaryFileInBackground(
        sourceURL: URL,
        shapes: [AnnoShape],
        backgroundSettings: AnnotationBackgroundSettings = AnnotationBackgroundSettings()
    ) async throws -> URL {
        try await Task.detached(priority: .userInitiated) {
            try renderToTemporaryFile(
                sourceURL: sourceURL,
                shapes: shapes,
                backgroundSettings: backgroundSettings
            )
        }.value
    }

    nonisolated static func renderToTemporaryFile(
        sourceURL: URL,
        shapes: [AnnoShape],
        backgroundSettings: AnnotationBackgroundSettings = AnnotationBackgroundSettings()
    ) throws -> URL {
        let destinationURL = ScreenshotFileNaming.scratchURL("Annotated", extension: "png")
        try render(
            sourceURL: sourceURL,
            shapes: shapes,
            backgroundSettings: backgroundSettings,
            destinationURL: destinationURL,
            contentType: .png
        )
        return destinationURL
    }

    nonisolated static func render(
        sourceURL: URL,
        shapes: [AnnoShape],
        backgroundSettings: AnnotationBackgroundSettings = AnnotationBackgroundSettings(),
        destinationURL: URL,
        contentType: UTType
    ) throws {
        // Encode beside the destination, then replace atomically. A failed
        // render must never remove the user's previous export.
        let stagingURL = destinationURL.deletingLastPathComponent()
            .appendingPathComponent(".BetterShot-\(UUID().uuidString).\(destinationURL.pathExtension)")
        defer { try? FileManager.default.removeItem(at: stagingURL) }

        let cacheKey = contentType == .png && (!shapes.isEmpty || backgroundSettings.hasRenderableContent)
            ? pngCacheKey(sourceURL: sourceURL, shapes: shapes, background: backgroundSettings) : nil
        if let cacheKey, let data = pngCache.object(forKey: cacheKey) {
            try Data(referencing: data).write(to: stagingURL)
        } else if shapes.isEmpty, !backgroundSettings.hasRenderableContent,
           contentType == .png,
           let source = CGImageSourceCreateWithURL(sourceURL as CFURL, nil),
           CGImageSourceGetType(source) as String? == UTType.png.identifier {
            try FileManager.default.copyItem(at: sourceURL, to: stagingURL)
        } else {
            try autoreleasepool {
                let sourceImage = try loadSourceImage(sourceURL: sourceURL)
                // Keep the screenshot's own (typically Display P3) color space so
                // wide-gamut colors survive the export instead of being pulled
                // down to device RGB. Previews already render this way.
                let colorSpace = exportColorSpace(for: sourceImage)
                let renderedImage: CGImage
                if backgroundSettings.hasRenderableContent {
                    renderedImage = try AnnotationBackgroundRenderer.compose(
                        contentImage: sourceImage,
                        settings: backgroundSettings,
                        colorSpace: colorSpace,
                        foregroundOverlay: { context, layout, imageRect, imageClipPath in
                            drawAnnotations(
                                shapes,
                                in: imageRect,
                                pageSize: CGSize(width: sourceImage.width, height: sourceImage.height),
                                canvasSize: layout.canvasSize,
                                context: context,
                                colorSpace: colorSpace,
                                highlightClipPath: imageClipPath
                            )
                        },
                        canvasOverlay: { context, layout, _ in
                            AnnotationBackgroundRenderer.drawWatermark(
                                backgroundSettings.watermark,
                                in: CGRect(origin: .zero, size: layout.canvasSize),
                                context: context
                            )
                        }
                    )
                } else {
                    renderedImage = try renderAnnotatedImage(sourceImage, shapes: shapes, colorSpace: colorSpace)
                }

                guard let destination = CGImageDestinationCreateWithURL(
                    stagingURL as CFURL,
                    contentType.identifier as CFString,
                    1,
                    nil
                ) else {
                    throw CocoaError(.fileWriteUnknown)
                }

                var options: CFDictionary?
                if contentType != .png {
                    options = [
                        kCGImageDestinationLossyCompressionQuality: BetterShotPreferences.compressionQuality
                    ] as CFDictionary
                }

                CGImageDestinationAddImage(destination, renderedImage, options)

                guard CGImageDestinationFinalize(destination) else {
                    throw CocoaError(.fileWriteUnknown)
                }
            }
        }
        if let cacheKey, pngCache.object(forKey: cacheKey) == nil,
           cacheKey == pngCacheKey(sourceURL: sourceURL, shapes: shapes, background: backgroundSettings),
           let data = try? Data(contentsOf: stagingURL), data.count <= 32 * 1024 * 1024 {
            pngCache.setObject(data as NSData, forKey: cacheKey, cost: data.count)
        }
        if FileManager.default.fileExists(atPath: destinationURL.path) {
            _ = try FileManager.default.replaceItemAt(destinationURL, withItemAt: stagingURL)
        } else {
            try FileManager.default.moveItem(at: stagingURL, to: destinationURL)
        }
    }

    nonisolated private static func loadSourceImage(sourceURL: URL) throws -> CGImage {
        guard let source = CGImageSourceCreateWithURL(
            sourceURL as CFURL,
            [kCGImageSourceShouldCache: false] as CFDictionary
        ),
              let cgImage = CGImageSourceCreateImageAtIndex(
                source,
                0,
                [kCGImageSourceShouldCache: false] as CFDictionary
              ) else {
            throw CocoaError(.fileReadCorruptFile)
        }

        return cgImage
    }

    nonisolated private static func exportColorSpace(for image: CGImage) -> CGColorSpace {
        // Fall back to device RGB unless the source space can actually back
        // the 8-bit premultiplied contexts the render pipeline creates -
        // otherwise an exotic embedded profile would fail the whole export.
        guard let colorSpace = image.colorSpace,
              colorSpace.model == .rgb,
              CGContext(
                data: nil,
                width: 1,
                height: 1,
                bitsPerComponent: 8,
                bytesPerRow: 0,
                space: colorSpace,
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
              ) != nil else {
            return CGColorSpaceCreateDeviceRGB()
        }
        return colorSpace
    }

    nonisolated private static func renderAnnotatedImage(
        _ cgImage: CGImage,
        shapes: [AnnoShape],
        colorSpace: CGColorSpace
    ) throws -> CGImage {
        guard !shapes.isEmpty else { return cgImage }
        let width = cgImage.width
        let height = cgImage.height

        guard let context = CGContext(
            data: nil,
            width: width,
            height: height,
            bitsPerComponent: 8,
            
```

### Core Architecture Module: `Sources/BetterShot/MathUtils.swift`
```
import Foundation

let PI = Double.pi
let HALF_PI = Double.pi / 2
let PI2 = Double.pi * 2

func clamp(_ n: Double, _ min: Double, _ max: Double) -> Double {
    Swift.max(min, Swift.min(n, max))
}

func clamp(_ n: Double, _ min: Double) -> Double {
    Swift.max(min, n)
}

func modulate(_ value: Double, _ rangeA: (Double, Double), _ rangeB: (Double, Double), _ shouldClamp: Bool = false) -> Double {
    let (fromLow, fromHigh) = rangeA
    let (v0, v1) = rangeB
    let result = v0 + ((value - fromLow) / (fromHigh - fromLow)) * (v1 - v0)
    guard shouldClamp else { return result }
    return v0 < v1 ? Swift.max(Swift.min(result, v1), v0) : Swift.max(Swift.min(result, v0), v1)
}

func approximately(_ a: Double, _ b: Double, _ precision: Double = 0.000001) -> Bool {
    abs(a - b) <= precision
}

func isSafeFloat(_ n: Double) -> Bool {
    n.isFinite && abs(n) < 9007199254740991
}

func perimeterOfEllipse(_ rx: Double, _ ry: Double) -> Double {
    let h = pow(rx - ry, 2) / pow(rx + ry, 2)
    return PI * (rx + ry) * (1 + (3 * h) / (10 + (4 - 3 * h).squareRoot()))
}

/// A number between 0 and 2π.
func canonicalizeRotation(_ a: Double) -> Double {
    var a = a.truncatingRemainder(dividingBy: PI2)
    if a < 0 { a += PI2 } else if a == 0 { a = 0 }
    return a
}

func clockwiseAngleDist(_ a0: Double, _ a1: Double) -> Double {
    let a0 = canonicalizeRotation(a0)
    var a1 = canonicalizeRotation(a1)
    if a0 > a1 { a1 += PI2 }
    return a1 - a0
}

func counterClockwiseAngleDist(_ a0: Double, _ a1: Double) -> Double {
    PI2 - clockwiseAngleDist(a0, a1)
}

func shortAngleDist(_ a0: Double, _ a1: Double) -> Double {
    let da = (a1 - a0).truncatingRemainder(dividingBy: PI2)
    return (2 * da).truncatingRemainder(dividingBy: PI2) - da
}

func snapAngle(_ r: Double, _ segments: Int) -> Double {
    let seg = PI2 / Double(segments)
    var ang = (floor((canonicalizeRotation(r) + seg / 2) / seg) * seg).truncatingRemainder(dividingBy: PI2)
    if ang < PI { ang += PI2 }
    if ang > PI { ang -= PI2 }
    return ang
}

func getPointOnCircle(_ center: Vec, _ r: Double, _ a: Double) -> Vec {
    Vec.add(center, Vec.fromAngle(a, r))
}

/// Winding-number point-in-polygon test.
func pointInPolygon(_ point: Vec, _ points: [Vec]) -> Bool {
    var windingNumber = 0
    let n = points.count
    guard n > 0 else { return false }
    for i in 0..<n {
        let a = points[i]
        if a.x == point.x && a.y == point.y { return true }
        let b = points[(i + 1) % n]
        let cross = (b.x - a.x) * (point.y - a.y) - (point.x - a.x) * (b.y - a.y)
        if a.y <= point.y {
            if b.y > point.y && cross > 0 { windingNumber += 1 }
        } else if b.y <= point.y && cross < 0 {
            windingNumber -= 1
        }
    }
    return windingNumber != 0
}

/// The center of the circle passing through three points, or nil if they're collinear.
func centerOfCircleFromThreePoints(_ a: Vec, _ b: Vec, _ c: Vec) -> Vec? {
    let u: Double = -2 * (a.x * (b.y - c.y) - a.y * (b.x - c.x) + b.x * c.y - c.x * b.y)
    let sa: Double = a.x * a.x + a.y * a.y
    let sb: Double = b.x * b.x + b.y * b.y
    let sc: Double = c.x * c.x + c.y * c.y
    let x: Double = (sa * (c.y - b.y) + sb * (a.y - c.y) + sc * (b.y - a.y)) / u
    let y: Double = (sa * (b.x - c.x) + sb * (c.x - a.x) + sc * (a.x - b.x)) / u
    guard x.isFinite, y.isFinite else { return nil }
    return Vec(x, y)
}

/// The measure of an arc, negative when counter-clockwise.
func getArcMeasure(_ a: Double, _ b: Double, _ sweepFlag: Int, _ largeArcFlag: Int) -> Double {
    let diff = (b - a).truncatingRemainder(dividingBy: PI2)
    let m = (2 * diff).truncatingRemainder(dividingBy: PI2) - diff
    if largeArcFlag == 0 { return m }
    return (PI2 - abs(m)) * (sweepFlag != 0 ? 1 : -1)
}

/// Where along an arc a given angle falls, with 0 the start and 1 the end.
func getPointInArcT(_ mAB: Double, _ a: Double, _ b: Double, _ p: Double) -> Double {
    if abs(mAB) > PI {
        let mAP = shortAngleDist(a, p)
        let mPB = shortAngleDist(p, b)
        if abs(mAP) < abs(mPB) { return mAP / mAB }
        return (mAB - mPB) / mAB
    }
    let mAP = shortAngleDist(a, p)
    let t = mAP / mAB
    // If the arc runs from, say, -2.8 to 2.2, the measure to the center is negative while
    // measures near the ends are positive; snap to whichever end is closer.
    if (mAP < 0) != (mAB < 0) {
        return abs(t) > 0.5 ? 1 : 0
    }
    return t
}

/// Number of vertices to approximate an arc of the given length with.
func getVerticesCountForArcLength(_ length: Double, spacing: Double = 20) -> Int {
    Swift.max(8, Int(ceil(length / spacing)))
}

/// A seeded xorshift PRNG driven by the seed string's UTF-16 code units, using 32-bit integer
/// semantics throughout. Returns values in roughly [-1, 1].
func makeRng(_ seed: String) -> () -> Double {
    var x: Int32 = 0
    var y: Int32 = 0
    var z: Int32 = 0
    var w: Int32 = 0

    func next() -> Double {
        let t = x ^ (x << 11)
        x = y
        y = z
        z = w
        let shiftedW = Int32(bitPattern: UInt32(bitPattern: w) >> 19)
        let shiftedT = Int32(bitPattern: UInt32(bitPattern: t) >> 8)
        // `w ^= ((w >>> 19) ^ t ^ (t >>> 8)) >>> 0` - the result of `^` in JS is signed 32-bit,
        // so the division below can go negative, giving a range of roughly [-1, 1).
        w ^= shiftedW ^ t ^ shiftedT
        return (Double(w) / 0x1_0000_0000) * 2
    }

    let units = Array(seed.utf16)
    for k in 0..<(units.count + 64) {
        // JS `seed.charCodeAt(k) | 0` yields 0 past the end of the string (NaN | 0 === 0).
        let code: Int32 = k < units.count ? Int32(units[k]) : 0
        x ^= code
        _ = next()
    }
    return next
}

enum Easings {
    static let linear: (Double) -> Double = { $0 }
    static let easeOutQuad: (Double) -> Double = { $0 * (2 - $0) }
    static let easeOutCubic: (Double) -> Double = { t in
        let u = t - 1
        return u * u * u + 1
    }
    static let easeInOutCubic: (Double) -> Double = { t in
        t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1
    }
    static let easeOutSine: (Double) -> Double = { sin(($0 * PI) / 2) }
}

```

### Core Architecture Module: `Sources/BetterShot/Recording3DBlurRenderer.swift`
```
// SPDX-License-Identifier: AGPL-3.0-only
// Adapts Cap 3D rendering, Copyright (c) 2023-present Cap Software, Inc.
// Swift/Metal adaptation Copyright (c) 2026 Kartik Labhshetwar.
// See Resources/Licenses/Cap.txt for the full license.

import CoreImage
import QuartzCore
import simd

/// Shared GPU focus blur for the displayed preview and the export compositor.
/// Kernels compile once; strength is specified at 1080p and scales with the canvas.
nonisolated enum Recording3DBlurRenderer {
    enum Failure: LocalizedError {
        case unavailable
        var errorDescription: String? { "The GPU could not prepare the 3D focus effect. Try reopening the editor or switch Depth Blur to None." }
    }
    private static let kernels: [CIKernel] = (try? CIKernel.kernels(withMetalString: source)) ?? []

    static func apply(_ settings: Recording3DBlur, to image: CIImage, canvas: CGRect) throws -> CIImage {
        guard settings.isActive else { return image }
        let blur = settings.sanitized
        guard blur.isActive else { return image }
        let mode: Double = switch blur.mode { case .none: 0; case .radial: 1; case .directional: 2; case .tiltShift: 3 }
        let radius = blur.strength * canvas.height / 1080
        let frame = CIVector(x: canvas.width, y: canvas.height, z: mode, w: radius)
        let focus = CIVector(x: blur.focusX, y: blur.focusY, z: blur.focusSize, w: blur.angle * .pi / 180)
        let name = blur.bokeh ? "bettershotBokeh" : "bettershotFocusBlur"
        guard let kernel = kernels.first(where: { $0.name == name }) else { throw Failure.unavailable }
        var result = image.cropped(to: canvas)
        for pass in 0..<(blur.bokeh ? 1 : 2) {
            let style = CIVector(x: blur.falloff, y: blur.position, z: Double(pass), w: 0)
            guard let next = kernel.apply(extent: canvas, roiCallback: { _, rect in
                rect.insetBy(dx: -ceil(radius) - 1, dy: -ceil(radius) - 1)
            }, arguments: [result.clampedToExtent(), frame, focus, style]) else { throw Failure.unavailable }
            result = next
        }
        return result.cropped(to: canvas)
    }

    /// Inverse mapping keeps the camera fixed even when part of a steeply tilted plane
    /// crosses its horizon. Source and destination coordinates here use Core Image's y-up axis.
    static func warp(_ image: CIImage, projection m: CATransform3D, canvas: CGRect) throws -> CIImage {
        let forward = simd_double3x3(columns: (SIMD3(m.m11, m.m12, m.m14),
            SIMD3(m.m21, m.m22, m.m24), SIMD3(m.m41, m.m42, m.m44)))
        guard forward.determinant.isFinite, abs(forward.determinant) > 1e-12 else {
            return CIImage.empty().cropped(to: canvas)
        }
        let inverse = forward.inverse.transpose
        func row(_ i: Int) -> CIVector {
            let r = inverse[i]; return CIVector(x: r.x, y: r.y, z: r.z)
        }
        guard let kernel = kernels.first(where: { $0.name == "bettershotPerspective" }),
              let result = kernel.apply(extent: canvas, roiCallback: { _, _ in canvas },
                arguments: [image.composited(over: CIImage(color: .clear).cropped(to: canvas)).clampedToExtent(), row(0), row(1), row(2), CIVector(x: canvas.width, y: canvas.height)]) else {
            throw Failure.unavailable
        }
        return result
    }

    private static let source = #"""
    #include <metal_stdlib>
    #include <CoreImage/CoreImage.h>
    using namespace metal;
    using namespace coreimage;

    float focusRadius(float2 pixel, float4 frame, float4 focus, float4 style) {
        float2 uv = pixel / frame.xy;
        float aspect = frame.x / frame.y;
        float distance;
        float edge = focus.z * 0.5;
        float spread = (edge + 0.35) * (1.0 + 3.0 * style.x);
        if (frame.z == 2.0) {
            float2 delta = (uv - 0.5) * float2(aspect, 1.0);
            float extent = (aspect + 1.0) * 0.5;
            distance = dot(delta, float2(cos(focus.w), sin(focus.w))) - mix(-extent, extent, style.y);
            spread = 0.7 * (1.0 + 3.0 * style.x);
        } else {
            float2 delta = (uv - focus.xy) * float2(aspect, 1.0);
            distance = frame.z == 3.0 ? max(abs(dot(delta, float2(sin(focus.w), cos(focus.w)))) - edge, 0.0) : length(delta);
            distance -= edge;
        }
        float fade = smoothstep(0.0, max(spread, 0.0001), distance);
        return frame.w * pow(fade, mix(2.0, 0.7, style.x));
    }

    [[stitchable]] float4 bettershotPerspective(coreimage::sampler image, float3 row0, float3 row1, float3 row2, float2 size, destination dest) {
        float3 p = float3(dest.coord().x, size.y - dest.coord().y, 1.0);
        float3 q = float3(dot(row0, p), dot(row1, p), dot(row2, p));
        if (q.z <= 1e-6) return float4(0);
        float2 source = q.xy / q.z;
        float2 uv = source / size;
        float2 dx = (float2(row0.x, row1.x) * q.z - q.xy * row2.x) / (q.z * q.z) / size;
        float2 dy = (float2(row0.y, row1.y) * q.z - q.xy * row2.y) / (q.z * q.z) / size;
        float2 width = max(abs(dx) + abs(dy), float2(1e-6));
        float2 edge = smoothstep(float2(0), width, uv) * smoothstep(float2(0), width, 1.0 - uv);
        float2 sample = clamp(source, float2(0), size);
        return image.sample(image.transform(float2(sample.x, size.y - sample.y))) * edge.x * edge.y;
    }

    [[stitchable]] float4 bettershotFocusBlur(coreimage::sampler image, float4 frame, float4 focus, float4 style, destination dest) {
        float2 p = dest.coord();
        float radius = focusRadius(p, frame, focus, style);
        if (radius < 0.5) return image.sample(image.transform(p));
        int extent = int(min(radius, min(frame.y * (40.0 / 1080.0), 160.0)));
        float sigma = radius * 0.5;
        float2 axis = style.z < 0.5 ? float2(1, 0) : float2(0, 1);
        float4 sum = image.sample(image.transform(p));
        float total = 1;
        // Pair adjacent Gaussian taps with linear filtering. The normalized weights
        // are unchanged; texture reads are halved even at the reference's 8K cap.
        for (int i = 1; i <= extent; i += 2) {
            float a = exp(-float(i * i) / (2.0 * sigma * sigma));
            float b = i + 1 <= extent ? exp(-float((i + 1) * (i + 1)) / (2.0 * sigma * sigma)) : 0.0;
            float weight = a + b;
            float offset = float(i) + b / weight;
            sum += (image.sample(image.transform(p + axis * offset))
                  + image.sample(image.transform(p - axis * offset))) * weight;
            total += 2.0 * weight;
        }
        return sum / total;
    }

    [[stitchable]] float4 bettershotBokeh(coreimage::sampler image, float4 frame, float4 focus, float4 style, destination dest) {
        float2 p = dest.coord();
        float radius = focusRadius(p, frame, focus, style);
        float4 sum = image.sample(image.transform(p));
        if (radius < 0.5) return sum;
        float total = 1;
        for (int ring = 1; ring <= 3; ++ring) {
            int count = ring * 5;
            float ringWeight = mix(1.0, float(ring) / 3.0, 0.3);
            for (int j = 0; j < count; ++j) {
                float angle = 6.28318530718 * float(j) / float(count);
                float r = radius * float(ring) / 3.0;
                float4 color = image.sample(image.transform(p + float2(cos(angle), sin(angle)) * r));
                float light = dot(color.rgb, float3(0.299, 0.587, 0.114));
                float weight = ringWeight * (1.0 + 1.5 * smoothstep(0.7, 1.0, light));
                sum += color * weight;
                total += weight;
            }
        }
        return sum / total;
    }
    """#
}

```

### Core Architecture Module: `Sources/BetterShot/RecordingSessionRenderer.swift`
```
//
//  RecordingSessionRenderer.swift
//  BetterShot
//
//  On-demand utility for workflows that require a single flattened movie.
//  The capture pipeline keeps screen and camera as separate safety masters;
//  this renderer must not run on the recording Stop/presentation path.
//

import AppKit
import AVFoundation
import CoreGraphics

@MainActor
enum RecordingSessionRenderer {
    private enum RenderError: LocalizedError {
        case missingCameraTrack

        var errorDescription: String? {
            "The camera recording does not contain a readable video track."
        }
    }

    /// Creates a flattened deliverable when explicitly requested for a session
    /// whose raw screen master would not match what the user sees: a camera
    /// source, a cursor-hidden capture, or any saved Studio project. Only a
    /// never-edited, cursor-visible, camera-less capture is already its own
    /// complete result and skips the expensive second encode.
    static func ensureDeliverable(
        for session: RecordingSession,
        onProgress: (@Sendable (Double) -> Void)? = nil
    ) async throws -> URL {
        let manifest = session.loadCaptureManifest()
        let pointerSynthesized = manifest?.pointerSynthesized == true
        // Draft edits count: a flatten made for an upload must show what the
        // user last saw in Studio, not the last state they pressed Save on.
        let editDocument = session.effectiveEditDocument()
        guard session.hasCamera || pointerSynthesized || editDocument != nil else {
            return session.screenURL
        }
        if let existing = session.freshFinalURL(matching: editDocument) { return existing }

        let asset = AVURLAsset(url: session.screenURL)
        let duration = try await asset.load(.duration).seconds
        guard duration.isFinite, duration > 0 else {
            throw RecordingStudioExporter.ExportError.noVideoTrack
        }

        if session.hasCamera {
            let cameraAsset = AVURLAsset(url: session.cameraURL)
            guard try await !cameraAsset.loadTracks(withMediaType: .video).isEmpty else {
                throw RenderError.missingCameraTrack
            }
        }

        let canvasSize = try await outputSize(for: asset, manifest: manifest)
        let recordingPointScale = max(manifest?.pixelScale ?? 1, 1)
        let recordingPointSize = CGSize(
            width: canvasSize.width / CGFloat(recordingPointScale),
            height: canvasSize.height / CGFloat(recordingPointScale)
        )
        let capture = PointerStreamSanitizer.sanitize(
            session.loadPointerCapture() ?? PointerCaptureFile(),
            options: PointerSanitizeOptions(
                recordingSizeInPoints: recordingPointSize
            )
        ).sanitizedCapture
        let document = editDocument
        var style = document?.style.value ?? RecordingStudioDefaults.style
        // Selecting a camera means the default delivered recording includes
        // it; a saved Studio project that explicitly hid the bubble wins.
        style.camera.isVisible = session.hasCamera && (document?.style.value.camera.isVisible ?? true)
        let zoomEnabled = document?.zoomEnabled ?? true
        let zoomCues = document?.zoomCues
            ?? ZoomCueSynthesizer.cues(from: capture, duration: duration)
        let clipTimeline: RecordingClipTimeline
        if let clips = document?.clips, !clips.isEmpty {
            clipTimeline = RecordingClipTimeline(segments: clips).normalized(to: duration)
        } else {
            clipTimeline = .legacyTrim(
                start: document?.trimStart,
                end: document?.trimEnd,
                sourceDuration: duration
            )
        }
        let viewportTimeline = zoomEnabled
            ? ViewportTimeline.build(cues: zoomCues, capture: capture, clipTimeline: clipTimeline)
            : .identity
        let showsPressEffects = pointerSynthesized
            && manifest?.pressEffectsBaked == false
            && (document?.showsClickEffects ?? manifest?.pressEffectsEnabled ?? true)
        let showsKeystrokes = (document?.showsKeystrokes ?? true) && !capture.keystrokes.isEmpty

        // One pointer timeline serves both jobs: drawing the synthetic
        // cursor and steering the reframe camera's focus.
        let hasPointerData = !capture.travel.isEmpty || !capture.presses.isEmpty
        let pointerTimeline = hasPointerData
            ? PointerTimeline.build(
                capture: capture,
                duration: duration,
                recordingSizeInPoints: recordingPointSize,
                fallbackArtwork: PointerArtworkCapture.defaultArtwork(),
                clipTimeline: clipTimeline,
                options: style.cursor,
                overrideArtwork: PointerArtworkCapture.styledArtwork(style.cursor.appearance)
            )
            : nil

        let showsSubtitles = document?.showsSubtitles ?? true
        let cues = document?.subtitleCues ?? []
        let words = document?.subtitleWords ?? []

        let aspect = document?.exportAspectPreset ?? .original
        let aspectMode = document?.exportAspectContentMode ?? .fill
        let reframe: ReframeTrack? = aspectMode == .fill
            ? ReframeTrack.build(
                preset: aspect,
                sourceSize: canvasSize,
                viewportTimeline: viewportTimeline,
                duration: clipTimeline.duration
            ) { editorTime in
                pointerTimeline?.location(at: editorTime)
            }
            : nil
        let fitContentAspect: CGFloat? =
            aspect != .original && aspectMode == .fit && canvasSize.height > 0
                ? canvasSize.width / canvasSize.height
                : nil

        let configuration = RecordingStudioExporter.Configuration(
            screenURL: session.screenURL,
            cameraURL: session.hasCamera ? session.cameraURL : nil,
            cameraOffset: manifest?.cameraLeadIn ?? 0,
            style: style,
            viewportTimeline: viewportTimeline,
            pointerTimeline: pointerSynthesized ? pointerTimeline : nil,
            showsPressEffects: showsPressEffects,
            keystrokeTimeline: showsKeystrokes
                ? KeystrokeCaptionTimeline(events: capture.keystrokes)
                : nil,
            keystrokePlacement: document?.keystrokePlacement ?? .bottomCenter,
            subtitleTimeline: showsSubtitles && !cues.isEmpty
                ? SubtitleTimeline(cues: cues)
                : nil,
            subtitleStyle: document?.subtitleStyle ?? SubtitleBarStyle(),
            karaokeTimeline: showsSubtitles && !cues.isEmpty && !words.isEmpty
                ? KaraokeTimeline(cues: cues, words: words)
                : nil,
            canvasSize: aspect == .original
                ? canvasSize
                : aspect.canvasSize(for: canvasSize),
            clipTimeline: clipTimeline,
            exportSettings: document?.exportSettings ?? VideoCompressionSettings(),
            reframe: reframe,
            fitContentAspect: fitContentAspect,
            masks: document?.masks ?? [],
            timeline3D: Recording3DTimeline(shots: document?.shots3D ?? [], duration: clipTimeline.duration)
        )

        let temporaryURL = try await RecordingStudioExporter().export(configuration) { progress in
            onProgress?(progress)
        }
        do {
            return try session.installFinalVideo(
                movingFrom: temporaryURL,
                renderedFrom: editDocument
            )
        } catch {
            try? FileManager.default.removeItem(at: temporaryURL)
            throw error
        }
    }

    static func presentFailure(_ error: Error) {
        NSApp.activate(ignoringOtherApps: true)
        let alert = NSAlert()
        alert.alertStyle = .warning
        alert.messageText = "The camera video could not be added"
        alert.informativeText = "Your screen, camera, and audio masters are safe in the recording project, but BetterShot could not create the combined video: \(error.localizedDescription)"
        alert.addButton(withTitle: "OK")
        alert.runModal()
    }

    private static func outputSize(
        for asset: AVURLAsset,
        manifest: CaptureManifest?
    ) async throws -> CGSize {
        if let manifest, manifest.pixelWidth > 0, manifest.pixelHeight > 0 {
            return CGSize(width: manifest.pixelWidth, height: manifest.pixelHeight)
        }
        guard let track = try await asset.loadTracks(withMediaType: .video).first else {
            throw RecordingStudioExporter.ExportError.noVideoTrack
        }
        let size = try await track.load(.naturalSize)
        let transform = try await track.load(.preferredTransform)
        let transformed = size.applying(transform)
        return CGSize(width: abs(transformed.width), height: abs(transformed.height))
    }
}

```

### Core Architecture Module: `Sources/BetterShot/ShapeRenderer.swift`
```
import AppKit
import CoreGraphics
import Foundation

/// A single drawable piece of a shape, in the shape's own local space.
///
/// Everything the canvas and the exporter draw comes through this list, which `AnnoDocument` caches
/// per shape. Rebuilding it per frame meant panning re-ran the whole freehand pipeline for strokes
/// whose pixels hadn't moved.
///
/// BetterShot's non-vector tools ride the same list: a redaction, a spotlight hole and a numbered
/// callout are `Content` cases rather than paths, so one draw loop covers every tool and they all
/// inherit the same transform, z-order and caching.
struct RenderElement {
    enum Content {
        /// A vector path: filled, stroked, or both.
        case path(CGPath)
        /// A rectangle of the underlying screenshot, blurred or pixelated in place.
        case redaction(RedactionProps)
        /// A hole punched in the spotlight dimming layer.
        case spotlight(CGSize)
        /// A numbered callout: filled disc, outline, and centred digits.
        case numbered(NumberedProps)
        /// Glyph outlines, already positioned in the shape's local space.
        case glyphs(CGPath)
    }

    var content: Content
    var fill: NSColor?
    var stroke: NSColor?
    var strokeWidth: Double = 1
    /// Fill rule for self-overlapping ink outlines and glyph counters.
    var usesEvenOddFill = false
    /// Dash pattern and phase for the stroke, empty for a solid line.
    var dashes: [CGFloat] = []
    var dashPhase: CGFloat = 0

    var cgPath: CGPath? {
        switch content {
        case let .path(path), let .glyphs(path): path
        case .redaction, .spotlight, .numbered: nil
        }
    }

    /// Whether this element transforms the screenshot underneath it rather than painting over it.
    /// Those are drawn in a first pass, below the spotlight.
    var isRedaction: Bool {
        if case .redaction = content { return true }
        return false
    }

    var isSpotlight: Bool {
        if case .spotlight = content { return true }
        return false
    }
}

/// Turns shapes into render elements, in the shape's own local space.
enum AnnoShapeRenderer {
    static func elements(for shape: AnnoShape, in document: AnnoDocument) -> [RenderElement] {
        switch shape.kind {
        case let .geo(props):
            geoElements(props)
        case let .draw(props):
            drawElements(props)
        case .arrow:
            arrowElements(shape, in: document)
        case let .text(props):
            textElements(props)
        case let .redaction(props):
            [RenderElement(content: .redaction(props))]
        case let .highlight(props):
            [RenderElement(content: .spotlight(CGSize(width: props.w, height: props.h)))]
        case let .numbered(props):
            [RenderElement(content: .numbered(props))]
        }
    }

    // MARK: - Text

    private static func textElements(_ props: TextProps) -> [RenderElement] {
        guard !props.text.isEmpty else { return [] }
        return [RenderElement(
            content: .glyphs(TextMeasure.glyphPath(props)),
            fill: props.swatch.nsColor,
            stroke: nil,
            // Non-zero, not even-odd. OpenType contours are wound so that counters (the hole in an
            // "o") come out hollow under non-zero anyway, and even-odd additionally punches a hole
            // wherever two glyphs overlap - which at bold weights is most of a sentence.
            usesEvenOddFill: false
        )]
    }

    // MARK: - Draw

    private static func drawElements(_ props: DrawProps) -> [RenderElement] {
        guard !props.points.isEmpty else { return [] }

        let options = FreehandSettings.forDrawShape(
            isPen: props.isPen,
            isComplete: props.isComplete,
            strokeWidth: props.strokeWidth,
            forceComplete: false,
            forceSolid: false
        )
        let ink = SvgInk.render(props.points, options)
        return [RenderElement(
            content: .path(ink.path),
            fill: props.swatch.nsColor,
            stroke: nil,
            // The outline can double back on itself at tight corners; non-zero winding keeps those
            // overlaps solid instead of punching holes in the stroke.
            usesEvenOddFill: false
        )]
    }

    // MARK: - Geo

    private static func geoElements(_ props: GeoProps) -> [RenderElement] {
        let path = GeoPaths.path(for: props)

        if props.fill != .none {
            return [RenderElement(
                content: .path(path.solidPath()),
                fill: props.swatch.nsColor,
                stroke: nil
            )]
        }
        return [strokeElement(
            path: path,
            dash: props.dash,
            strokeWidth: props.strokeWidth,
            color: props.swatch.nsColor,
            seed: ""
        )]
    }

    /// Stroke a path in whichever dash style is asked for.
    private static func strokeElement(
        path: PathBuilder,
        dash: DashStyle,
        strokeWidth: Double,
        color: NSColor,
        seed: String
    ) -> RenderElement {
        switch dash {
        case .draw:
            let opts = PathBuilder.DrawOptions(strokeWidth: strokeWidth, randomSeed: seed)
            return RenderElement(
                content: .path(path.drawPath(opts)),
                fill: nil,
                stroke: color,
                strokeWidth: strokeWidth
            )
        case .solid:
            return RenderElement(
                content: .path(path.solidPath()),
                fill: nil,
                stroke: color,
                strokeWidth: strokeWidth
            )
        case .dashed, .dotted:
            // Each segment carries its own pattern, so dashes meet cleanly at a rectangle's corners
            // instead of wrapping around them.
            let segments = path.dashedSegments(strokeWidth: strokeWidth, style: dash)
            let combined = CGMutablePath()
            for segment in segments { combined.addPath(segment.path) }
            let first = segments.first
            return RenderElement(
                content: .path(combined),
                fill: nil,
                stroke: color,
                strokeWidth: strokeWidth,
                dashes: first?.dashes ?? [],
                dashPhase: first?.phase ?? 0
            )
        }
    }

    // MARK: - Arrow

    private static func arrowElements(_ shape: AnnoShape, in document: AnnoDocument) -> [RenderElement] {
        guard let props = shape.arrowProps,
              let info = document.arrowInfo(shape.id),
              info.isValid else { return [] }

        var elements: [RenderElement] = []
        elements.append(strokeElement(
            path: ArrowPath.body(info),
            dash: props.dash,
            strokeWidth: props.strokeWidth,
            color: props.swatch.nsColor,
            seed: shape.id.raw
        ))

        for side in [ArrowTerminal.start, ArrowTerminal.end] {
            guard let head = Arrowheads.path(info, side, props.strokeWidth) else { continue }
            elements.append(RenderElement(
                content: .path(head.path.solidPath()),
                fill: head.isFilled ? props.swatch.nsColor : nil,
                stroke: props.swatch.nsColor,
                strokeWidth: props.strokeWidth
            ))
        }

        return elements
    }
}

```

### Core Architecture Module: `Sources/BetterShot/TeleprompterSpeechEngine.swift`
```
//
//  TeleprompterSpeechEngine.swift
//  BetterShot
//
//  Live narration tracking for the teleprompter: microphone sample buffers
//  are teed off the recording's SCStream (no second capture session), fed
//  into SpeechAnalyzer with volatile results enabled, and every recognizer
//  update is matched against the script. Progress only ever moves forward -
//  a volatile-result retraction must never scroll the prompter backwards
//  while someone is mid-sentence.
//
//  The engine is best-effort by design: if the model asset is missing, the
//  locale unsupported, or the analyzer dies, the teleprompter simply stops
//  auto-advancing. It never interferes with the recording itself.
//

@preconcurrency import AVFoundation
@preconcurrency import CoreMedia
import Foundation
import Speech

nonisolated final class TeleprompterSpeechEngine: @unchecked Sendable {
    private let matcher: TeleprompterScriptMatcher
    /// Called with the (monotonic) count of script display words spoken.
    private let onProgress: @Sendable (Int) -> Void

    private let lock = NSLock()
    private var continuation: AsyncStream<AnalyzerInput>.Continuation?
    private var analyzerFormat: AVAudioFormat?
    private var converter: AVAudioConverter?
    private var isPaused = false
    private var isFinished = false
    private var analyzer: SpeechAnalyzer?
    private var analysisTask: Task<Void, Never>?

    init(matcher: TeleprompterScriptMatcher, onProgress: @escaping @Sendable (Int) -> Void) {
        self.matcher = matcher
        self.onProgress = onProgress
    }

    /// Resolves the locale + on-device model before a recording needs it, so
    /// enabling the teleprompter (not pressing Record) pays the download.
    static func preflightAssets() async {
        guard let locale = try? await RecordingTranscriptionService.resolveLocale() else { return }
        let transcriber = SpeechTranscriber(
            locale: locale,
            transcriptionOptions: [],
            reportingOptions: [.volatileResults],
            attributeOptions: []
        )
        if let installation = try? await AssetInventory.assetInstallationRequest(supporting: [transcriber]) {
            try? await installation.downloadAndInstall()
        }
    }

    func start() async throws {
        let locale = try await RecordingTranscriptionService.resolveLocale()
        let transcriber = SpeechTranscriber(
            locale: locale,
            transcriptionOptions: [],
            reportingOptions: [.volatileResults, .fastResults],
            attributeOptions: []
        )
        if let installation = try await AssetInventory.assetInstallationRequest(supporting: [transcriber]) {
            try await installation.downloadAndInstall()
        }
        guard let format = await SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith: [transcriber]) else {
            throw CocoaError(.featureUnsupported)
        }

        let (inputSequence, inputContinuation) = AsyncStream<AnalyzerInput>.makeStream()
        let analyzer = SpeechAnalyzer(modules: [transcriber])

        let alreadyFinished: Bool = lock.withLock {
            guard !isFinished else { return true }
            self.continuation = inputContinuation
            self.analyzerFormat = format
            self.analyzer = analyzer
            return false
        }
        if alreadyFinished {
            // The recording ended while the model was still downloading.
            inputContinuation.finish()
            return
        }

        analysisTask = Task { [matcher, onProgress] in
            // Finalized segments accumulate; the volatile tail is replaced on
            // every update. Matching reruns over the whole history so revised
            // guesses converge instead of compounding.
            var finalizedWords: [String] = []
            var reported = 0

            func report(_ spoken: [String]) {
                let count = matcher.spokenDisplayWordCount(spoken: spoken)
                guard count > reported else { return }
                reported = count
                onProgress(count)
            }

            do {
                for try await result in transcriber.results {
                    let words = TeleprompterScriptText.normalizedWords(
                        String(result.text.characters)
                    )
                    if result.isFinal {
                        finalizedWords.append(contentsOf: words)
                        report(finalizedWords)
                    } else {
                        report(finalizedWords + words)
                    }
                }
            } catch {
                // Recognition died; the prompter stays put and the recording
                // is unaffected.
            }
        }

        try await analyzer.start(inputSequence: inputSequence)
    }

    /// Called on the recording's audio sample queue for every microphone
    /// buffer. Must stay cheap: convert, yield, return.
    func ingest(_ sampleBuffer: CMSampleBuffer) {
        let (continuation, format): (AsyncStream<AnalyzerInput>.Continuation?, AVAudioFormat?) = lock.withLock {
            guard !isPaused, !isFinished else { return (nil, nil) }
            return (self.continuation, self.analyzerFormat)
        }
        guard let continuation, let format else { return }
        guard let buffer = Self.pcmBuffer(from: sampleBuffer) else { return }
        guard let converted = convert(buffer, to: format) else { return }
        continuation.yield(AnalyzerInput(buffer: converted))
    }

    func setPaused(_ paused: Bool) {
        lock.withLock { isPaused = paused }
    }

    /// Tears the session down without waiting for trailing results - the
    /// overlay is collapsing anyway.
    func finish() {
        let (continuation, analyzer, task): (
            AsyncStream<AnalyzerInput>.Continuation?,
            SpeechAnalyzer?,
            Task<Void, Never>?
        ) = lock.withLock {
            let values = (self.continuation, self.analyzer, self.analysisTask)
            isFinished = true
            self.continuation = nil
            self.analyzer = nil
            self.analysisTask = nil
            return values
        }
        continuation?.finish()
        Task {
            await analyzer?.cancelAndFinishNow()
            task?.cancel()
        }
    }

    // MARK: - Audio plumbing

    private static func pcmBuffer(from sampleBuffer: CMSampleBuffer) -> AVAudioPCMBuffer? {
        guard let description = CMSampleBufferGetFormatDescription(sampleBuffer),
              CMFormatDescriptionGetMediaType(description) == kCMMediaType_Audio else {
            return nil
        }
        let format = AVAudioFormat(cmAudioFormatDescription: description)
        let frameCount = AVAudioFrameCount(CMSampleBufferGetNumSamples(sampleBuffer))
        guard frameCount > 0,
              let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount) else {
            return nil
        }
        buffer.frameLength = frameCount
        let status = CMSampleBufferCopyPCMDataIntoAudioBufferList(
            sampleBuffer,
            at: 0,
            frameCount: Int32(frameCount),
            into: buffer.mutableAudioBufferList
        )
        return status == noErr ? buffer : nil
    }

    private func convert(_ buffer: AVAudioPCMBuffer, to format: AVAudioFormat) -> AVAudioPCMBuffer? {
        if buffer.format == format {
            return buffer
        }

        let converter: AVAudioConverter? = lock.withLock {
            if let existing = self.converter,
               existing.inputFormat == buffer.format,
               existing.outputFormat == format {
                return existing
            }
            let fresh = AVAudioConverter(from: buffer.format, to: format)
            self.converter = fresh
            return fresh
        }
        guard let converter else { return nil }

        let ratio = format.sampleRate / buffer.format.sampleRate
        let capacity = AVAudioFrameCount((Double(buffer.frameLength) * ratio).rounded(.up)) + 16
        guard let output = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: capacity) else {
            return nil
        }

        nonisolated(unsafe) let inputBuffer = buffer
        nonisolated(unsafe) var fed = false
        var conversionError: NSError?
        let status = converter.convert(to: output, error: &conversionError) { _, inputStatus in
            if fed {
                inputStatus.pointee = .noDataNow
                return nil
            }
            fed = true
            inputStatus.pointee = .haveData
            return inputBuffer
        }
        guard status != .error, output.frameLength > 0 else { return nil }
        return output
    }
}

```

### Core Architecture Module: `Sources/Models/OnboardingState.swift`
```
import Foundation

/// Completion is independent of app releases; updates never repeat completed setup.
enum OnboardingState {
    static let currentVersion = 2
    static let seenVersionKey = "bs_onboardingSeenVersion"
    static let resumePermissionsKey = "bs_onboardingResumePermissions"

    /// Run before launch migrations create preferences. Returns true only for a new install,
    /// not a permission restart or an upgrade with unfinished setup.
    @discardableResult
    static func prepareForLaunch(defaults: UserDefaults = .standard) -> Bool {
        guard defaults.object(forKey: seenVersionKey) == nil else { return false }
        let existingUser = defaults.dictionaryRepresentation().keys.contains {
            $0.hasPrefix("bs_") || $0.hasPrefix("recordingStudio.")
        }
        defaults.set(existingUser ? currentVersion : 0, forKey: seenVersionKey)
        return !existingUser
    }

    static func shouldPresent(defaults: UserDefaults = .standard) -> Bool {
        shouldResumePermissions(defaults: defaults) || defaults.integer(forKey: seenVersionKey) == 0
    }

    static func shouldResumePermissions(defaults: UserDefaults = .standard) -> Bool {
        defaults.bool(forKey: resumePermissionsKey)
    }

    static func resumeAtPermissions(defaults: UserDefaults = .standard) {
        defaults.set(true, forKey: resumePermissionsKey)
    }

    /// Closing and skipping count as seen, so an optional introduction never nags.
    static func markSeen(defaults: UserDefaults = .standard) {
        defaults.set(max(currentVersion, defaults.integer(forKey: seenVersionKey)), forKey: seenVersionKey)
        defaults.removeObject(forKey: resumePermissionsKey)
    }
}

```

### Core Architecture Module: `Sources/Services/BeautifierRenderer.swift`
```
import CoreGraphics
import AppKit

enum BeautifierRenderer {

    static let sRGB = CGColorSpace(name: CGColorSpace.sRGB) ?? CGColorSpaceCreateDeviceRGB()

    static func render(image source: CGImage, config: BeautifierConfig) -> CGImage? {
        let image = config.grade.applied(to: source)
        // No background keeps the source frame, matching the image editor.
        guard config.style != .none else { return image }
        let imgW = CGFloat(image.width)
        let imgH = CGFloat(image.height)
        let shortEdge = min(imgW, imgH)

        let pad = shortEdge * config.padding

        var canvasW = imgW + pad * 2
        var canvasH = imgH + pad * 2

        if let ratio = config.aspectRatio.numericValue {
            let current = canvasW / canvasH
            if current < ratio {
                canvasW = canvasH * ratio
            } else {
                canvasH = canvasW / ratio
            }
        }

        canvasW = ceil(canvasW)
        canvasH = ceil(canvasH)
        let totalHPad = canvasW - imgW
        let totalVPad = canvasH - imgH
        let imgX = (config.alignment.xFactor * totalHPad).rounded()
        let imgY = ((1 - config.alignment.yFactor) * totalVPad).rounded()

        let baseRadius = config.cornerRadius * shortEdge
        let m = config.alignment.cornerMultipliers
        let radii = BeautifierCornerRadii(
            topLeft: baseRadius * m.tl,
            topRight: baseRadius * m.tr,
            bottomRight: baseRadius * m.br,
            bottomLeft: baseRadius * m.bl
        )

        let canvasColorSpace = source.colorSpace.flatMap { $0.model == .rgb ? $0 : nil } ?? sRGB

        guard let ctx = CGContext(
            data: nil,
            width: Int(canvasW),
            height: Int(canvasH),
            bitsPerComponent: 8,
            bytesPerRow: 0,
            space: canvasColorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue
        ) else { return nil }

        let canvasRect = CGRect(x: 0, y: 0, width: canvasW, height: canvasH)

        drawBackground(in: ctx, rect: canvasRect, style: config.style, colorSpace: sRGB)

        let imageRect = CGRect(x: imgX, y: imgY, width: imgW, height: imgH)
        if config.shadowStrength > 0 {
            drawShadow(in: ctx, rect: imageRect, radii: radii, strength: config.shadowStrength, shortEdge: shortEdge)
        }

        ctx.saveGState()
        let clipPath = radii.path(in: imageRect)
        ctx.addPath(clipPath)
        ctx.clip()
        ctx.interpolationQuality = .none
        ctx.draw(image, in: imageRect)
        ctx.restoreGState()

        return ctx.makeImage()
    }

    // MARK: - Background Drawing

    private static func drawBackground(
        in ctx: CGContext,
        rect: CGRect,
        style: BackgroundStyle,
        colorSpace: CGColorSpace
    ) {
        switch style {
        case .none:
            break

        case .solid(let color):
            ctx.setFillColor(color.cgColor)
            ctx.fill(rect)

        case .gradient(let preset):
            preset.draw(in: ctx, rect: rect)

        case .wallpaper(let source):
            guard let wallpaperImage = loadImage(at: source.path) else { return }
            ctx.draw(wallpaperImage, in: rect)

        case .bundledImage(let assetID):
            guard let asset = BundledBackgrounds.asset(byID: assetID),
                  let url = asset.url,
                  let bgImage = loadImage(at: url.path) else { return }
            ctx.draw(bgImage, in: rect)
        }
    }

    // MARK: - Shadow

    private static func drawShadow(
        in ctx: CGContext,
        rect: CGRect,
        radii: BeautifierCornerRadii,
        strength: CGFloat,
        shortEdge: CGFloat
    ) {
        let blurRadius = max(2, shortEdge * (0.035 + strength * 0.035))
        let yOffset = -shortEdge * (0.012 + strength * 0.018)
        let alpha = strength * 0.36

        ctx.saveGState()
        ctx.setShadow(
            offset: CGSize(width: 0, height: yOffset),
            blur: blurRadius,
            color: CGColor(gray: 0, alpha: alpha)
        )

        let path = radii.path(in: rect)
        ctx.setFillColor(CGColor(gray: 0, alpha: 1))
        ctx.addPath(path)
        ctx.fillPath()
        ctx.restoreGState()

        ctx.saveGState()
        ctx.addPath(path)
        ctx.clip()
        ctx.clear(rect)
        ctx.restoreGState()
    }

    // MARK: - Helpers

    private static func loadImage(at path: String) -> CGImage? {
        let url = URL(fileURLWithPath: path)
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
        return CGImageSourceCreateImageAtIndex(source, 0, nil)
    }
}

// MARK: - Per-Corner Radii

struct BeautifierCornerRadii {
    let topLeft: CGFloat
    let topRight: CGFloat
    let bottomRight: CGFloat
    let bottomLeft: CGFloat

    func path(in rect: CGRect) -> CGPath {
        let path = CGMutablePath()
        let minX = rect.minX, maxX = rect.maxX
        let minY = rect.minY, maxY = rect.maxY

        path.move(to: CGPoint(x: minX + topLeft, y: maxY))

        path.addLine(to: CGPoint(x: maxX - topRight, y: maxY))
        if topRight > 0 {
            path.addArc(center: CGPoint(x: maxX - topRight, y: maxY - topRight),
                        radius: topRight, startAngle: .pi / 2, endAngle: 0, clockwise: true)
        }

        path.addLine(to: CGPoint(x: maxX, y: minY + bottomRight))
        if bottomRight > 0 {
            path.addArc(center: CGPoint(x: maxX - bottomRight, y: minY + bottomRight),
                        radius: bottomRight, startAngle: 0, endAngle: -.pi / 2, clockwise: true)
        }

        path.addLine(to: CGPoint(x: minX + bottomLeft, y: minY))
        if bottomLeft > 0 {
            path.addArc(center: CGPoint(x: minX + bottomLeft, y: minY + bottomLeft),
                        radius: bottomLeft, startAngle: -.pi / 2, endAngle: .pi, clockwise: true)
        }

        path.addLine(to: CGPoint(x: minX, y: maxY - topLeft))
        if topLeft > 0 {
            path.addArc(center: CGPoint(x: minX + topLeft, y: maxY - topLeft),
                        radius: topLeft, startAngle: .pi, endAngle: .pi / 2, clockwise: true)
        }

        path.closeSubpath()
        return path
    }
}

```

### Core Architecture Module: `bettershot-landing/hooks/use-mobile.ts`
```
import * as React from 'react'

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener('change', onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return !!isMobile
}

```

### Core Architecture Module: `bettershot-landing/hooks/use-toast.ts`
```
'use client'

// Inspired by react-hot-toast library
import * as React from 'react'

import type { ToastActionElement, ToastProps } from '@/components/ui/toast'

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 1000000

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

const actionTypes = {
  ADD_TOAST: 'ADD_TOAST',
  UPDATE_TOAST: 'UPDATE_TOAST',
  DISMISS_TOAST: 'DISMISS_TOAST',
  REMOVE_TOAST: 'REMOVE_TOAST',
} as const

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

type ActionType = typeof actionTypes

type Action =
  | {
      type: ActionType['ADD_TOAST']
      toast: ToasterToast
    }
  | {
      type: ActionType['UPDATE_TOAST']
      toast: Partial<ToasterToast>
    }
  | {
      type: ActionType['DISMISS_TOAST']
      toastId?: ToasterToast['id']
    }
  | {
      type: ActionType['REMOVE_TOAST']
      toastId?: ToasterToast['id']
    }

interface State {
  toasts: ToasterToast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: 'REMOVE_TOAST',
      toastId: toastId,
    })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'ADD_TOAST':
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case 'UPDATE_TOAST':
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t,
        ),
      }

    case 'DISMISS_TOAST': {
      const { toastId } = action

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        addToRemoveQueue(toastId)
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id)
        })
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t,
        ),
      }
    }
    case 'REMOVE_TOAST':
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

const listeners: Array<(state: State) => void> = []

let memoryState: State = { toasts: [] }

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

type Toast = Omit<ToasterToast, 'id'>

function toast({ ...props }: Toast) {
  const id = genId()

  const update = (props: ToasterToast) =>
    dispatch({
      type: 'UPDATE_TOAST',
      toast: { ...props, id },
    })
  const dismiss = () => dispatch({ type: 'DISMISS_TOAST', toastId: id })

  dispatch({
    type: 'ADD_TOAST',
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })

  return {
    id: id,
    dismiss,
    update,
  }
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [state])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: 'DISMISS_TOAST', toastId }),
  }
}

export { useToast, toast }

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #170** (2026-09-27): **Preview card sits in the bottom-right forever; Hide After is ignored**
  *Symptoms*: ## Summary  After a screenshot, the floating preview card in the bottom-right never goes away. Setting **Overlay → Hide After** has no effect. The card only leaves if you dismiss it by hand.  ## Environment  - BetterShot 0.5.7 (build 24) - macOS 26.6.2 - Normal Mode (not Notch Mode) - Multiple displays seen, but reproducible on one  ## Steps to reproduce  1. Take a region screenshot (⌘⇧4) or full-screen (⌘⇧3). 2. Leave the pointer anywhere that is not over the card. 3. Set **Settings → Overlay → Hide After** to 2s (or any finite value). 4. Take another screenshot. 5. Wait longer than the Hide After delay.  ## Expected  The preview card dismisses on its own after the Hide After delay, and the saved file remains.  ## Actual  The card stays in the bottom-right indefinitely. Changing Hide After and re-capturing does not help. Only manual Dismiss / Clear All removes it.  ## Root cause (from reading the code)  Two independent holes in `PreviewOverlay.scheduleDismiss` and `PreviewCardView`:  1. **The countdown can be cancelled permanently.** `scheduleDismiss` arms a one-shot `Task`. Hover and keyboard focus call `cancelScheduledDismiss` and only re-arm from `onHover(false)` / focus-loss. SwiftUI `onHover` and `FocusState` can stick at “active” when the `PreviewDeckPanel` appears under the pointer or becomes key (`canBecomeKey` + `orderFrontRegardless`). Once that state sticks, the timer never comes back.     The integration checks work around this by calling `hide()` first (`Tests/E
  **Post-Mortem & Fix Analysis**:
  > please update to the latest version 0.5.8 this issue should be resolved.
  > Works thanks.

- **Issue #169** (2026-09-25): **Feature/scroll capture UI**
  *Symptoms*: Closes #33  ## What changed - Adds Scrolling Capture to the menu bar with area selection and Stop/Cancel controls. - Supports manual vertical or horizontal scrolling, stitching overlapping frames into one image. - Handles fixed headers and scrollbar seams, then sends the result to the normal capture preview. - Keeps capture to one scroll direction per session; automatic scrolling is disabled.  ## Validation - `make release` - passed. - `BETTERSHOT_CHECK_CAPTURE_UI=1 bash Tests/run-exports.sh` - passed, including stitching and light/dark control snapshots. - `make test` - build passed, but the full suite stopped at an unrelated screenshot-staging assertion in `Tests/ExportIntegration.swift:866`.   ### Menu bar entry: <img width="348" height="358" alt="Screenshot 2026-09-25 at 12 15 40 AM" src="https://github.com/user-attachments/assets/ddad149b-a2c7-4bdf-aba9-a91c25bd6d30" />   ### Vertical scrolling capture example: <img width="1707" height="5883" alt="bettershot_F83CA025-650B-4CAC-A536-F6B7E4D62D17" src="https://github.com/user-attachments/assets/9749807e-d905-43a3-a300-c6f2ad87c4e1" />  #### Similar working with horizontal scrolling capture, tested.
  **Post-Mortem & Fix Analysis**:
  > @ItisPratham is attempting to deploy a commit to the **knox projects** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=knox%20projects&slug=nerdkartiks-projects&teamId=team_25A4qq4tBTq01XGlMdaEFea1&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%22cca2009093ce11c8ad1c5c2ecda339bf39800426%22%7D%2C%22id%22%3A%22QmbqW6jGTu7N41Ag5iLrEVqjHRFkZAo68ZT1YeB9AQ2B5M%22%2C%22org%22%3A%22KartikLabhshetwar%22%2C%22prId%22%3A169%2C%22repo%22%3A%22better-shot%22%7D).  

- **Issue #168** (2026-09-25): **fix: don't wait on Spotlight before a screenshot appears**
  *Symptoms*: ## Problem  Region, last-region and fullscreen screenshots can take up to 10 seconds to reach the clipboard or preview. After saving the PNG, `/usr/sbin/screencapture` tags the file for Spotlight and waits for the reply before exiting. When Spotlight is busy that call times out after 10 seconds (`MDItemSetAttributes failed` in the system log), and BetterShot waits for the exit.  ## Change  - BetterShot continues as soon as the PNG is complete (its IEND trailer is written) instead of waiting for `screencapture` to exit. - Cancelling and errors still come from the exit status, so Escape and permission failures behave as before.  ## Testing  - New `ScreencaptureRunnerCheck` runs the production runner against stand-in `screencapture` scripts: a saved PNG followed by a long hang, a PNG written in two steps, a cancel, and a failure. The hang case fails before the fix and passes after. - Unsigned Release build succeeds and `scripts/run-checks.sh` passes. 
  **Post-Mortem & Fix Analysis**:
  > @icanhasjonas is attempting to deploy a commit to the **knox projects** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=knox%20projects&slug=nerdkartiks-projects&teamId=team_25A4qq4tBTq01XGlMdaEFea1&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%22170d4234347bddf3d2f1605d2c2d01a05c5322e8%22%7D%2C%22id%22%3A%22QmXiQysYw1ky2ESMubgZLdqcpLRMj8qRwwFAukcWzyYmsM%22%2C%22org%22%3A%22KartikLabhshetwar%22%2C%22prId%22%3A168%2C%22repo%22%3A%22better-shot%22%7D).  

- **Issue #167** (2026-09-25): **fix: use the configured filename template for saved screenshots**
  *Symptoms*: Fixes #166.  New screenshot exports now get their filename from `ScreenshotFileNaming.currentFileName` rather than inheriting the internal `.preview.png` basename. This covers automatic capture saving and explicit Save while leaving updates to an already-associated export at its existing path.  The screenshot save integration check now uses a custom `Saved-{kind}` template and asserts that explicit and automatic saves use it instead of the preview filename.  Validation: `git diff --check`, Swift parser check, and `FileNamingCheck` (9 groups) passed. Full `make test` and the screenshot integration check could not run on this machine because full Xcode/XcodeGen are not installed; the active Command Line Tools Swift and macOS 27 SDK also have a version mismatch.
  **Post-Mortem & Fix Analysis**:
  > @zergzorg is attempting to deploy a commit to the **knox projects** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=knox%20projects&slug=nerdkartiks-projects&teamId=team_25A4qq4tBTq01XGlMdaEFea1&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%22020ec57ff623d21949bbbfc88bbe15a3aa796c48%22%7D%2C%22id%22%3A%22QmZVU6Jv1iVPQsbmeyhC3HjxZJPzh5K12r6VYjWrawSSyi%22%2C%22org%22%3A%22KartikLabhshetwar%22%2C%22prId%22%3A167%2C%22repo%22%3A%22better-shot%22%7D).  
  > @zergzorg - is this also related to what I'm solving here? https://github.com/KartikLabhshetwar/better-shot/pull/161
  > @icanhasjonas Yes. #161 addresses the same root cause as #166/#167 for new screenshots, and does more: it assigns a name at capture time and reuses it across Save, Copy, Share, and recording deliverables. My #167 is the narrower automatic-save fix, so #161 should supersede it once merged. I reviewed the capture/save paths and found one non-PNG naming gap in #161: retained JPEG/HEIC/WebP captures are shown as `.png` in Gallery/Recent Captures because the record name is derived from the internal PNG raw file. I left the exact-line review comment here: https://github.com/KartikLabhshetwar/better-shot/pull/161#discussion_r4080901949 . The standalone naming and recording-save checks pass locally; the two other check failures also reproduce on the base commit in this environment.

- **Issue #166** (2026-09-25): **Auto-saved screenshots ignore the configured file name template**
  *Symptoms*: ## Environment  - BetterShot 0.5.6 (build 23), macOS 27.0, Apple Silicon. - General > Saving: Save to `~/Pictures/Screenshots`; Automatically save screenshots enabled; File name `BetterShot_{date}-{time}`.  ## Reproduction  1. Capture a normal region screenshot. 2. Inspect the configured save folder.  **Expected:** A saved screenshot named like `BetterShot_2026-09-23-10-26-26.png`, matching the example in Settings.  **Actual:** The folder contains files named `bettershot_<UUID>.preview.png`. The folder selection and automatic save work, but the configured name template is ignored.  ## Likely cause  `CaptureOrchestrator.processCapturedImage` passes the retained preview URL to `ScreenshotFileActions.saveCapture`. `saveToDefaultLocation` calls `exportFileName(for:)`, which preserves the preview source basename and only changes its extension. It does not use `ScreenshotFileNaming.currentFileName`, even though the Settings example and recording deliverable do. The same save path is used by explicit screenshot Save.  Please use the template for new screenshot deliverables, while preserving the existing filename when replacing an already-associated export. A regression check should cover normal automatic saving and explicit Save.
  **Post-Mortem & Fix Analysis**:
  > (Trying to fix, one time for all, for every possible scenario, here: https://github.com/KartikLabhshetwar/better-shot/pull/161)

- **Issue #164** (2026-09-25): **fix: group clip speed slider drags into one undo step**
  *Symptoms*: ## Problem Dragging the Studio clip Speed slider registered an undo step and rebuilt the player on every tick. One drag left dozens of undo steps, and the preview stuttered.  ## Change The slider holds the dragged speed and applies it once on release: one undo step and one rebuild. Typed values and arrow-key steps still commit one undo step each.  ## Testing - `RecordingClipSpeedCheck`: ticks during a drag are held, and release applies the final speed once. - Unsigned Release build succeeds. 
  **Post-Mortem & Fix Analysis**:
  > @icanhasjonas is attempting to deploy a commit to the **knox projects** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=knox%20projects&slug=nerdkartiks-projects&teamId=team_25A4qq4tBTq01XGlMdaEFea1&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%22a71df6073410ff10105b7145bb28b10a3ebf3c45%22%7D%2C%22id%22%3A%22QmXsuhsKyfkGTpDUyc4EWMzQRqN8VerQdXhZ5FCEZ8w9Nx%22%2C%22org%22%3A%22KartikLabhshetwar%22%2C%22prId%22%3A164%2C%22repo%22%3A%22better-shot%22%7D).  

- **Issue #163** (2026-09-25): **fix: honor the upload toggle when sharing**
  *Symptoms*: ## Problem With Settings > Sharing > Upload when I share turned off, Share still uploaded to the public bucket and copied a link. Nothing on the upload path read the toggle.  ## Change - `uploadShare` refuses when uploads are off. - The editors and Studio hide Share, and the capture card shows "Uploads are off" with a Settings button. - `CloudUploader.isConfigured` is renamed to `canShare`. It now answers "may Share upload?", which is false for a configured account with uploads off, so the old name was misleading. The two integration checks that assert tests have no credentials now read `R2CredentialStore.isConfigured` directly. - Versions 0.4.3 to 0.5.6 let users save keys without ever writing the toggle. For those installs a missing value counts as on when keys exist, so they keep sharing. An explicit off stays off.  ## Testing - New `R2UploadToggleCheck` (no Keychain, no network): off refuses, on proceeds, and a missing value resolves as described. It fails before the fix and passes after. - Release build succeeds, and the standalone checks pass. 
  **Post-Mortem & Fix Analysis**:
  > @icanhasjonas is attempting to deploy a commit to the **knox projects** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=knox%20projects&slug=nerdkartiks-projects&teamId=team_25A4qq4tBTq01XGlMdaEFea1&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%224f230efdb765ab9058fefba5f26fa91d0668f702%22%7D%2C%22id%22%3A%22QmZVUh4GDCdWRgV81taRRWEsvtQ7LZ49rUx6tQZNmTrBAx%22%2C%22org%22%3A%22KartikLabhshetwar%22%2C%22prId%22%3A163%2C%22repo%22%3A%22better-shot%22%7D).  

- **Issue #162** (2026-09-25): **fix: remove WebP export, which macOS cannot encode**
  *Symptoms*: ## Problem Settings > General > File Format offers WebP, but ImageIO on macOS has no WebP encoder: `CGImageDestinationCreateWithURL` returns nil for `public.webp`. With WebP selected, every capture fails with "Couldn't prepare capture" and editor Save fails.  ## Change - Remove WebP from the export formats and the Settings picker. - A stored `webp` choice falls back to PNG through the existing default, with no migration step. - Reading WebP (wallpapers, clipboard) is unchanged.  ## Testing - New `ExportFormatCheck`: every offered format encodes, and a stored `webp` reads as PNG. It fails before the fix and passes after. - Debug build succeeds. 
  **Post-Mortem & Fix Analysis**:
  > @icanhasjonas is attempting to deploy a commit to the **knox projects** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=knox%20projects&slug=nerdkartiks-projects&teamId=team_25A4qq4tBTq01XGlMdaEFea1&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%22b79c16b2cd81cc726d05563653979239e1e860dd%22%7D%2C%22id%22%3A%22QmW72niTgwvTGxwQyp8VH5TwJhjBZBKcDk9mN3QGSsqouG%22%2C%22org%22%3A%22KartikLabhshetwar%22%2C%22prId%22%3A162%2C%22repo%22%3A%22better-shot%22%7D).  

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

### Incident Patch 1: `9bfd416b` (2026-09-27)
**Commit Message**: fix: use native alerts for recording discard and restart

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -9,6 +9,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Fixed
 
+- **Recording confirmations no longer show a black rectangle.** Discard and Start Over now use standalone native macOS alerts instead of SwiftUI alerts attached to the transparent recording bar. Buttons and keyboard shortcuts share the same confirmation; Cancel keeps the current recording.
 - Floating screenshot previews now dismiss after Overlay > Hide After. The timer pauses for the live pointer or a focused action, recovers from missed hover/focus events, and keeps saved files. Keep screenshot previews open now holds only unsaved staged captures; saved and retained captures follow Hide After.
 
 ### Changed
```

**File**: `CONTRIBUTING.md` (modified, +4/-0)
```diff
@@ -178,6 +178,10 @@ OCR and color results copy through `CaptureOrchestrator.completeTextCapture`;
 empty OCR must not erase the clipboard.
 Recording areas use BetterShot's adjustable AppKit selector.
 `RecordingPickerControls` owns the compact `RecordingOptionsView`. Keep the 0.5.4 Display/Window/Area and Camera/Mic/Audio/Script strip in the floating bar.
+Discard and Start Over, including their shortcuts, use
+`RecordingBarPresenter.confirmRecordingAction` and a standalone `NSAlert.runModal()`.
+Do not attach SwiftUI alerts or sheets to the transparent recording panel: its
+oversized hosting area becomes an opaque backdrop. Cancel preserves the recording.
 Run `BETTERSHOT_CHECK_CAPTURE_UI=1 bash Tests/run-exports.sh` after building for
 focused light/dark capture layout checks without generating a video fixture.
 Keep source selection separate from starting a recording, preserve permission checks
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -54,7 +54,7 @@ permissions and your first capture.
 
 **Recordings**
 - Record a display, window, or adjustable area with optional system audio, microphone, camera, and teleprompter.
-- Pause, restart, or discard from the compact recording bar.
+- Pause, restart, or discard from the compact recording bar. Restart and Discard ask for confirmation in a native macOS dialog; Cancel keeps the recording.
 
 **Video editor**
 - Cut clips, change speed from 0.25x to 8x, and add zooms, transitions, captions, and blur or pixelate masks.
```

**File**: `Sources/BetterShot/RecordingBarPresenter.swift` (modified, +28/-1)
```diff
@@ -34,7 +34,7 @@ final class RecordingBarPresenter {
     /// tells the hosting view which part of itself is real and satellite
     /// windows where to anchor.
     var showsRecordingOptions = false
-    var recordingConfirmation: ShortcutService.Action?
+    @ObservationIgnored private var isConfirmingRecordingAction = false
 
     var barFrameInPanel: CGRect = .zero
 
@@ -88,6 +88,33 @@ final class RecordingBarPresenter {
 
     // MARK: Recording
 
+    func confirmRecordingAction(_ action: ShortcutService.Action) {
+        let manager = ScreenRecordingManager.shared
+        guard action == .restartRecording || action == .discardRecording,
+              manager.state == .recording || manager.state == .paused,
+              !isConfirmingRecordingAction else { return }
+        isConfirmingRecordingAction = true
+        defer { isConfirmingRecordingAction = false }
+
+        let restarting = action == .restartRecording
+        let alert = NSAlert()
+        alert.alertStyle = .warning
+        alert.messageText = restarting ? "Start a new recording?" : "Discard this recording?"
+        alert.informativeText = restarting
+            ? "This recording will be discarded and recording will start again."
+            : "This recording will be deleted without saving."
+        alert.addButton(withTitle: "Cancel")
+        alert.addButton(withTitle: restarting ? "Start Over" : "Discard").hasDestructiveAction = true
+        PreviewWindowCaptureExclusion.shared.register(window: alert.window)
+        NSApp.activate(ignoringOtherApps: true)
+        // A sheet makes the transparent recording panel's full hosting area visible.
+        // Present independently so the bar never becomes an alert backdrop.
+        guard alert.runModal() == .alertSecondButtonReturn,
+              manager.state == .recording || manager.state == .paused else { return }
+        if restarting { manager.restartRecording() }
+        else { manager.deleteRecording() }
+    }
+
     /// Called once capture is actually starting. If the bar is already up on
     /// the recording's display it morphs in place; otherwise it has to move,
     /// and there's nothing to morph from.
```

**File**: `Sources/BetterShot/RecordingControlPresenter.swift` (modified, +2/-19)
```diff
@@ -32,11 +32,6 @@ struct RecordingSessionControls: View {
     @State private var manager = ScreenRecordingManager.shared
     @State private var presenter = RecordingBarPresenter.shared
 
-    private func confirmation(_ action: ShortcutService.Action) -> Binding<Bool> {
-        Binding(get: { presenter.recordingConfirmation == action },
-                set: { if !$0 { presenter.recordingConfirmation = nil } })
-    }
-
     private var isPaused: Bool {
         manager.state == .paused
     }
@@ -87,30 +82,18 @@ struct RecordingSessionControls: View {
 
             separator
             BarActionButton(id: .restart, title: "Start over", systemImage: "arrow.counterclockwise") {
-                presenter.recordingConfirmation = .restartRecording
+                presenter.confirmRecordingAction(.restartRecording)
             }
             .frame(width: 42)
             .disabled(isSettling)
 
             separator
             BarActionButton(id: .discard, title: "Discard recording", systemImage: "trash") {
-                presenter.recordingConfirmation = .discardRecording
+                presenter.confirmRecordingAction(.discardRecording)
             }
             .frame(width: 42)
             .disabled(isSettling)
         }
-        .alert("Start a new recording?", isPresented: confirmation(.restartRecording)) {
-            Button("Start Over", role: .destructive) { manager.restartRecording() }
-            Button("Cancel", role: .cancel) {}
-        } message: {
-            Text("This recording will be discarded and recording will start again.")
-        }
-        .alert("Discard this recording?", isPresented: confirmation(.discardRecording)) {
-            Button("Discard", role: .destructive) { manager.deleteRecording() }
-            Button("Cancel", role: .cancel) {}
-        } message: {
-            Text("This recording will be deleted without saving.")
-        }
     }
 
     private var separator: some View {
```

**File**: `Sources/Services/ShortcutActions.swift` (modified, +1/-2)
```diff
@@ -29,8 +29,7 @@ extension ShortcutService {
             if manager.state == .paused { manager.resumeRecording() }
             else if manager.state == .recording { manager.pauseRecording() }
         case .restartRecording, .discardRecording:
-            guard manager.state == .recording || manager.state == .paused else { return }
-            RecordingBarPresenter.shared.recordingConfirmation = action
+            RecordingBarPresenter.shared.confirmRecordingAction(action)
         case .mediaGallery:
             MediaGalleryWindowController.shared.open(on: screen)
         case .openSettings:
```

**File**: `Tests/EditorUIIntegration.swift` (modified, +50/-0)
```diff
@@ -14,6 +14,7 @@ func checkEditorUI(imageURL: URL, movieURL: URL) async throws {
         try await checkEditorWindowInteractions(imageURL: imageURL, movieURL: movieURL)
     }
     try checkCaptureControlsUI()
+    checkRecordingConfirmations()
     try checkImageTransforms(imageURL: imageURL)
     try await checkColorPickerAndToast()
     try await checkPreviewOverlay(imageURL: imageURL)
@@ -905,6 +906,55 @@ private func checkGeneralEditorDefaults(movieURL: URL) async throws {
     print("PASS General defaults for new recordings/imports, image look parity, reset, and saved project preservation")
 }
 
+/// Exercises real native dialogs without starting a capture or accessing microphone/camera.
+@MainActor
+private func checkRecordingConfirmations() {
+    let manager = ScreenRecordingManager.shared
+    let presenter = RecordingBarPresenter.shared
+    let previousState = manager.state
+    let previousAppearance = NSApp.appearance
+    defer {
+        manager.state = previousState
+        NSApp.appearance = previousAppearance
+        presenter.hide()
+    }
+    for state in [ScreenRecordingState.idle, .starting, .finishing] {
+        manager.state = state
+        presenter.confirmRecordingAction(.discardRecording)
+        presenter.confirmRecordingAction(.restartRecording)
+        precondition(NSApp.modalWindow == nil, "Inactive/settling recordings must not open a destructive confirmation")
+    }
+    for appearance in [NSAppearance.Name.aqua, .darkAqua] {
+        NSApp.appearance = NSAppearance(named: appearance)
+        for action in [ShortcutService.Action.discardRecording, .restartRecording] {
+            manager.state = action == .discardRecording ? .recording : .paused
+            let state = manager.state
+            presenter.showRecording(displayID: nil)
+            let bar = NSApp.windows.first { $0.identifier?.rawValue == "BetterShot.RecordingBar" }!
+            var observed = false
+            let timer = Timer(timeInterval: 0.1, repeats: false) { _ in
+                MainActor.assumeIsolated {
+                    guard let alertWindow = NSApp.modalWindow else { preconditionFailure("Missing native recording confirmation") }
+                    observed = true
+                    precondition(alertWindow !== bar && alertWindow.sheetParent == nil && bar.attachedSheet == nil,
+                                 "Recording confirmations must be standalone, not sheets on the transparent bar")
+                    precondition(!bar.isOpaque && bar.backgroundColor == .clear)
+                    precondition(alertWindow.sharingType == (PreviewWindowCaptureExclusion.includesAppWindowsInCaptures ? .readOnly : .none))
+                    presenter.confirmRecordingAction(action)
+                    precondition(NSApp.modalWindow === alertWindow, "Repeated shortcuts must not nest confirmations")
+                    NSApp.stopModal(withCode: .alertFirstButtonReturn) // Cancel is the safe default.
+                }
+            }
+            RunLoop.main.add(timer, forMode: .modalPanel)
+            presenter.confirmRecordingAction(action)
+            timer.invalidate()
+            precondition(observed && manager.state == state, "Cancel must preserve recording/paused state")
+            precondition(NSApp.modalWindow == nil && bar.attachedSheet == nil)
+        }
+    }
+    print("PASS standalone native recording confirmations, cancellation, duplicate protection, capture exclusion, and both appearances")
+}
+
 /// Static layout checks need no camera/microphone access or encoded video fixture.
 @MainActor
 func checkCaptureControlsUI() throws {
```

---

### Incident Patch 2: `3a5077af` (2026-09-27)
**Commit Message**: fix: restore preview dismissal and native capture in 0.5.8

**File**: `AGENTS.md` (modified, +4/-1)
```diff
@@ -95,7 +95,10 @@ a PR unless explicitly requested.
   `⌘⇧1` Capture Previous Region. `⌘⇧2` always opens the capture bar.
   Use `ShortcutService` as the source for UI labels and settings. Migrations must
   preserve customized bindings and disabled states.
-- Region screenshots and recording areas use BetterShot's adjustable AppKit selector
+- Region screenshots default to BetterShot's adjustable AppKit selector, with a
+  native macOS selector toggle in Settings > Capture > Region. The native
+  selector leaves BetterShot's remembered area unchanged. Window screenshots use
+  macOS's native window selector. Recording areas use the adjustable AppKit selector
   and system crosshair. It opens with the previous area selected, so Return captures
   it again; its edges resize it, and a drag anywhere, even inside it, draws a new
   area. OCR keeps macOS's native `screencapture` selector. Do not describe the
```

**File**: `BetterShot.xcodeproj/project.pbxproj` (modified, +8/-58)
```diff
@@ -44,7 +44,7 @@
 		24A92D5E02A892E928CE1D5B /* ColorGrade.swift in Sources */ = {isa = PBXBuildFile; fileRef = ADD96168EC491E4A46366640 /* ColorGrade.swift */; };
 		2586A51024C6154C47BCD872 /* RecordingStudioStyle.swift in Sources */ = {isa = PBXBuildFile; fileRef = 4304694812C833847090F918 /* RecordingStudioStyle.swift */; };
 		25A54F46D3F80738AEFEF3A9 /* AnnotationRenderer.swift in Sources */ = {isa = PBXBuildFile; fileRef = E2532AE9303B012F07C0FC4F /* AnnotationRenderer.swift */; };
-		266F345A43B69C9ABD40386E /* DockProgress in Frameworks */ = {isa = PBXBuildFile; productRef = 1E4513356E30E8574136C7F3 /* DockProgress */; };
+		266F345A43B69C9ABD40386E /* TourKit in Frameworks */ = {isa = PBXBuildFile; productRef = 21A5326AB43CA6E519B6D062 /* TourKit */; };
 		27495F9E313930753A6E726A /* AnnotationRedactionImageProcessor.swift in Sources */ = {isa = PBXBuildFile; fileRef = 977759233837DBEB3EB78A1E /* AnnotationRedactionImageProcessor.swift */; };
 		2BDDF4C68FA168E537AF4029 /* Onboarding in Resources */ = {isa = PBXBuildFile; fileRef = 110CD327D097B8F42B0B8BA1 /* Onboarding */; };
 		2D2CFBFFDA6767FA9FB2C2E9 /* BeautifierRenderer.swift in Sources */ = {isa = PBXBuildFile; fileRef = D58300A37E3A994CE15987C5 /* BeautifierRenderer.swift */; };
@@ -55,15 +55,12 @@
 		36AE41B4746338DBA7F192D6 /* PreviewWindowCaptureExclusion.swift in Sources */ = {isa = PBXBuildFile; fileRef = 036620C86E40600826E3930C /* PreviewWindowCaptureExclusion.swift */; };
 		37000BC29C1251CAF994FE0F /* CameraRecordingManager.swift in Sources */ = {isa = PBXBuildFile; fileRef = 6E8333B22E7E66B67D75E2D2 /* CameraRecordingManager.swift */; };
 		373BC289BF3F9A842CA12CF0 /* VideoTrimSelection.swift in Sources */ = {isa = PBXBuildFile; fileRef = 8EB02705C403A4D300A1000F /* VideoTrimSelection.swift */; };
-		37CD2E69C23CF7BB962C2549 /* CapturePresentationMode.swift in Sources */ = {isa = PBXBuildFile; fileRef = 46DAB0B314FDE73338171876 /* CapturePresentationMode.swift */; };
-		380EDC32A94F83B02916D6DD /* NotchRecentCaptures.swift in Sources */ = {isa = PBXBuildFile; fileRef = 7D6C3162472265AFC3EF722B /* NotchRecentCaptures.swift */; };
 		387EB7D93F69E67AE33613AD /* CloudUploader.swift in Sources */ = {isa = PBXBuildFile; fileRef = B5B6D30AC545D7DFDE178FED /* CloudUploader.swift */; };
 		3933094B835D8EF2F5F1EABB /* RegionSelectionOverlay.swift in Sources */ = {isa = PBXBuildFile; fileRef = 868F0E1B6C8FC7DF50B4A79B /* RegionSelectionOverlay.swift */; };
 		3A14826DE9ED6F5F4C674ABD /* AnnotationSwatch.swift in Sources */ = {isa = PBXBuildFile; fileRef = 2CD064BBAE4EC5BF78867B77 /* AnnotationSwatch.swift */; };
 		3AA2E443AA076D9AA4BCFFA9 /* PinnedScreenshot.swift in Sources */ = {isa = PBXBuildFile; fileRef = 8B3D8697A2AEA9FD3527BA3D /* PinnedScreenshot.swift */; };
 		3AA56BD8027AACABC1257B3D /* AnnotationWallpaperPreviewCache.swift in Sources */ = {isa = PBXBuildFile; fileRef = 06C8996BCFE669700EEF01EE /* AnnotationWallpaperPreviewCache.swift */; };
 		3BF5DBCBE10B92005C121A2D /* RecordingSourceCatalog.swift in Sources */ = {isa = PBXBuildFile; fileRef = 7711E5BB4466B588EE32C7BC /* RecordingSourceCatalog.swift */; };
-		3CA0F0B61AD84D125B91E9AF /* NotchVoiceCapture.swift in Sources */ = {isa = PBXBuildFile; fileRef = 4DF3A00AA83CB4F8ED8C7F30 /* NotchVoiceCapture.swift */; };
 		3DFD0AFCC40248A410ACC8BD /* AnnotationEditorZoom.swift in Sources */ = {isa = PBXBuildFile; fileRef = 2FC217457F424CFCD7667853 /* AnnotationEditorZoom.swift */; };
 		3EB30B21F2F488EC0524A801 /* TeleprompterOverlayPresenter.swift in Sources */ = {isa = PBXBuildFile; fileRef = 3A5FFC877AB3AB6B64894072 /* TeleprompterOverlayPresenter.swift */; };
 		40B553DB8E65CE93297F3D11 /* SmartRedactionRecognizer.swift in Sources */ = {isa = PBXBuildFile; fileRef = F2DD10CB10250C7A3DEC3186 /* SmartRedactionRecognizer.swift */; };
@@ -72,7 +69,6 @@
 		435989A6E7CFD7DC8AE1B593 /* Mat.swift in Sources */ = {isa = PBXBuildFile; fileRef = 9E1854845C0B1A123F908A41 /* Mat.swift */; };
 		44601DAC2783F0755C8D58BA /* AnnotationCropModels.swift in Sources */ = {isa = PBXBuildFile; fileRef = 2F7378F3CC5B8D8FDD885D11 /* AnnotationCropModels.swift */; };
 		46070CAF5A877CB564FDB379 /* Box.swift in Sources */ = {isa = PBXBuildFile; fileRef = BB9AE65970CD5EA6BDABF0B5 /* Box.swift */; };
-		47DCC099CAE8F680E0DC9E28 /* NotchShelfStore.swift in Sources */ = {isa = PBXBuildFile; fileRef = 06E86E8B9AD49CDD2E7D82E4 /* NotchShelfStore.swift */; };
 		48D780C259A85BBCB1B6BE82 /* RecordingSession.swift in Sources */ = {isa = PBXBuildFile; fileRef = 4DB2C921338E7AA1207539D1 /* RecordingSession.swift */; };
 		49F98CCBDB5611D43C61342D /* AnnotationMockupEffectsRenderer.swift in Sources */ = {isa = PBXBuildFile; fileRef = 86308A7F5B1D769189631945 /* AnnotationMockupEffectsRenderer.swift */; };
 		4C60427E131EEFD8D35939F8 /* RecordingStudioStylePresetStore.swift in Sources */ = {isa = PBXBuildFile; fileRef = E1F111988702AFBAF2496331 /* RecordingStudioStylePresetStore.swift */; };
@@ -108,7 +104,6 @@
 	
```

**File**: `CHANGELOG.md` (modified, +12/-1)
```diff
@@ -5,6 +5,18 @@ All notable changes to Better Shot will be documented in this file.
 The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
 and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
 
+## [0.5.8] - 2026-09-27
+
+### Fixed
+
+- Floating screenshot previews now dismiss after Overlay > Hide After. The timer pauses for the live pointer or a focused action, recovers from missed hover/focus events, and keeps saved files. Keep screenshot previews open now holds only unsaved staged captures; saved and retained captures follow Hide After.
+
+### Changed
+
+- Restored native macOS window screenshot selection.
+- Added Settings > Capture > Region > Use native macOS region selector. Off keeps BetterShot’s adjustable, remembered-area selector; on uses the native crosshair. OCR continues to use native selection.
+- Removed Notch Mode, its shelf, quick editor, capture gestures, and bundled dependencies. Previews use the floating capture deck.
+
 ## [0.5.7] - 2026-09-25
 
 ### Added
@@ -83,7 +95,6 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 - Notch Mode never displays toast notifications. Copy confirms directly on the result button; capture and saving failures remain as dismissible inline instructions. Switching modes removes existing toasts immediately. Recent items stay aligned and disabled action icons remain readable.
 
-- Notch shape, hover controls, and interactions reuse Boring Notch code, with contributor attribution, pinned source references, and its GPLv3 license bundled with the app.
 
 - The notch groups capture tools and provides actions on each media card. Its compact state shows the BetterShot logo and readiness/editor status, or the recording timer. Short, interruptible transitions respect Reduce Motion.
 
```

**File**: `CONTRIBUTING.md` (modified, +12/-60)
```diff
@@ -169,32 +169,17 @@ Region screenshots use `RegionSelectionOverlay` with the previous area
 (`AppPreferences.lastRegionRect`) preselected, so Return captures it again, then
 reactivate the previously frontmost app before `screencapture -R` takes the shot.
 OCR keeps macOS's native `/usr/sbin/screencapture -i` selector.
-Window screenshots use `SCContentSharingPicker` and `SCScreenshotManager.captureImage`
-in the app process; preserve picker cancellation, native pixel dimensions, and private PNG staging.
-OCR and color results share `CaptureOrchestrator.completeTextCapture`: copy the exact
-value and persist typed text/color results only when Notch Mode is active. Empty OCR must not erase the clipboard.
-Notch Mode must not show toasts. Mark `ToastWindow.show` failures with `isError: true`
-so recovery instructions appear inline; successes stay quiet or update their action
-button. Export/share progress continues through the embedded `TransferStatusCard`.
+Region screenshots can instead use the native selector via
+`AppPreferences.nativeRegionSelector`, exposed in Settings > Capture > Region.
+The native selector does not update BetterShot's remembered rectangle.
+Window screenshots use `/usr/sbin/screencapture -i -w`, retaining cancellation,
+shadow options, native pixel dimensions, and private PNG staging.
+OCR and color results copy through `CaptureOrchestrator.completeTextCapture`;
+empty OCR must not erase the clipboard.
 Recording areas use BetterShot's adjustable AppKit selector.
-`RecordingPickerControls` owns the compact `RecordingOptionsView`. Keep the 0.5.4 Display/Window/Area and Camera/Mic/Audio/Script strip in the floating bar in both capture modes; do not embed it in the notch.
+`RecordingPickerControls` owns the compact `RecordingOptionsView`. Keep the 0.5.4 Display/Window/Area and Camera/Mic/Audio/Script strip in the floating bar.
 Run `BETTERSHOT_CHECK_CAPTURE_UI=1 bash Tests/run-exports.sh` after building for
 focused light/dark capture layout checks without generating a video fixture.
-The notch shelf uses `NotchRecentCaptures.shelfItems` to merge pending media and
-saved media/text/colors by recency without duplicates. Reuse `PreviewCardView` and `PreviewOverlay.perform` for
-card rendering/actions; notch sizing must not change the normal overlay. Notch media cards reveal the standard actions on hover or keyboard focus, with drag recognition confined to the preview.
-`NotchQuickEditor` reuses `AnnotationCanvas`, `AnnotationRenderer`, and editable
-history sidecars. Done saves privately; it must not update an exported file.
-`NotchVoiceCapture` handles the configurable hold key through the existing `ShortcutService` event tap. Select an area is the default through `RegionSelectionOverlay` and `captureLastRegion`; pressing the modifier alone must not open the notch, and unset or unknown hold actions must never start drawing. Draw on screen is opt-in: snapshot the display, open the production canvas full-screen with a red freehand tool, and route held strokes through its model. Buffer mouse events during capture preparation; finish on modifier release after the final mouse-up. Drawing alone must not request microphone access. Escape preserves the editor's discard confirmation. Keyboard chords cancel arming. The folder menu dispatches OCR/color through `CaptureOrchestrator`, with shortcut labels from `ShortcutService`.
-Option voice capture is opt-in, observes modifier state only when enabled and when Option is not the capture hold key, and never retains plain keystrokes. Releasing Option during microphone startup must still finish the capture. Keep the annotated image and transcript in one shelf item. Microphone capture ends before on-device transcription, with temporary
-audio retained only for retry until completion/discard. Reuse
-`RecordingTranscriptionService.transcribeAudio` rather than adding a cloud service.
-`NotchShelfStore` keeps bounded OCR/color history only in Notch Mode, plus opt-in clipboard text and separately configurable standalone hex-color collection (on by default), and checks private pasteboard
-markers before reading text. Test with isolated pasteboards and storage only.
-After building, `BETTERSHOT_CHECK_LOCAL_SHELF=1 bash Tests/run-exports.sh` checks
-persistence, copying and quick-edit rendering without live capture. An optional
-`BETTERSHOT_SPEECH_FIXTURE` path can supply synthesized speech saying “button” and
-“smaller” to validate the actual on-device transcription engine.
 Keep source selection separate from starting a recording, preserve permission checks
 for camera/microphone, and keep screenshot and recording delays distinct.
 
@@ -208,8 +193,9 @@ a new install, then `AfterCaptureActions.prepareForLaunch` to preserve upgrades'
 explicit choices and previous unset/off behavior. Unfinished onboarding is not a
 new install. Restore General defaults uses the new-install saving default.
 Explicit Copy/Edit/Pin actions bypass automatic saving, and failed save
```

**File**: `LICENSE` (modified, +0/-3)
```diff
@@ -30,6 +30,3 @@ OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 Additional components: Cap 3D rendering adaptations are AGPL-3.0-only.
 See Resources/Licenses/Cap.txt for license terms and combined-application
 distribution requirements.
-
-Boring Notch UI/interaction adaptations are GPLv3. See
-Resources/Licenses/BoringNotch.txt.
```

**File**: `README.md` (modified, +11/-16)
```diff
@@ -67,7 +67,6 @@ permissions and your first capture.
 - Copy, save, pin, edit, share, or drag captures from the floating preview.
 - Browse screenshots, recordings, and share links in the Media Gallery.
 - Share to [your own Cloudflare R2 bucket](#cloud-sharing) with one click.
-- Optional [Notch Mode](#notch-mode) keeps previews and a capture shelf at the top of the screen.
 - Trigger any capture from Shortcuts, Raycast, or the terminal with [URL actions](#automation).
 
 Original captures and source movies are never modified. Both editors support
@@ -104,6 +103,15 @@ Capture Region & Pin or Edit Clipboard Image, start unassigned.
 Set the background, padding, corner radius, and shadow for new captures in
 **Settings > General > Default Look**.
 
+Choose **Settings > Capture > Region > Use native macOS region selector**
+for the macOS crosshair instead of BetterShot’s adjustable selector. Window
+screenshots always use the native macOS window selector. The native selector
+does not update BetterShot’s remembered area.
+
+Saved previews dismiss after **Settings > Overlay > Hide After**, pausing while
+you use the card. **Keep screenshot previews open** holds only unsaved captures;
+choose **Never** under Hide After to keep saved previews open too.
+
 ### Scrolling capture
 
 Capture a page or list taller than the screen:
@@ -142,27 +150,14 @@ name. Customize it in **Settings > General > Saving** with templates such as
 | Permission | Used for |
 | --- | --- |
 | Screen & System Audio Recording | Screenshots, recordings, and system audio |
-| Accessibility | Global shortcuts and Notch Mode hold-to-capture |
+| Accessibility | Global shortcuts |
 | Input Monitoring | Cursor effects and shortcut overlays. Plain typing is never recorded. |
-| Microphone | Voice in recordings and voice notes |
+| Microphone | Voice in recordings |
 | Camera | Camera recording |
 
 Manage access in **System Settings > Privacy & Security**. If capture or
 shortcuts still fail after granting access, quit and reopen BetterShot.
 
-## Notch Mode
-
-Turn it on in **Settings > General > Capture Mode**. Normal Mode stays the default.
-
-- **Shelf.** Previews, recordings, OCR text, and picked colors appear in a black shelf at the top of the screen, filtered by All, Text, Images, Videos, or Colors.
-- **Hold to capture.** Hold Control and drag to screenshot an area. Change the key or switch to Draw on screen in **Settings > Shortcuts > Notch Capture Gesture**.
-- **Quick edit.** Click an image to draw, blur, crop, or add a background right below the notch.
-- **Voice notes.** Tap the microphone in the quick editor to talk while you annotate. Transcription runs on your Mac with no cloud fallback.
-- **History.** Copied hex colors are kept by default. Copied text is opt-in under **Settings > General > Notch Shelf**, capped at 50 entries, and skips content that apps mark as private.
-
-Recording controls always stay in the floating bar. On Macs without a notch,
-the shelf appears as a floating panel at the top center of the screen.
-
 ## Cloud sharing
 
 Sharing is optional and uses a Cloudflare R2 bucket you own.
```

**File**: `Resources/Licenses/BoringNotch.txt` (removed, +0/-674)
```diff
@@ -1,674 +0,0 @@
-                    GNU GENERAL PUBLIC LICENSE
-                       Version 3, 29 June 2007
-
- Copyright (C) 2007 Free Software Foundation, Inc. <https://fsf.org/>
- Everyone is permitted to copy and distribute verbatim copies
- of this license document, but changing it is not allowed.
-
-                            Preamble
-
-  The GNU General Public License is a free, copyleft license for
-software and other kinds of works.
-
-  The licenses for most software and other practical works are designed
-to take away your freedom to share and change the works.  By contrast,
-the GNU General Public License is intended to guarantee your freedom to
-share and change all versions of a program--to make sure it remains free
-software for all its users.  We, the Free Software Foundation, use the
-GNU General Public License for most of our software; it applies also to
-any other work released this way by its authors.  You can apply it to
-your programs, too.
-
-  When we speak of free software, we are referring to freedom, not
-price.  Our General Public Licenses are designed to make sure that you
-have the freedom to distribute copies of free software (and charge for
-them if you wish), that you receive source code or can get it if you
-want it, that you can change the software or use pieces of it in new
-free programs, and that you know you can do these things.
-
-  To protect your rights, we need to prevent others from denying you
-these rights or asking you to surrender the rights.  Therefore, you have
-certain responsibilities if you distribute copies of the software, or if
-you modify it: responsibilities to respect the freedom of others.
-
-  For example, if you distribute copies of such a program, whether
-gratis or for a fee, you must pass on to the recipients the same
-freedoms that you received.  You must make sure that they, too, receive
-or can get the source code.  And you must show them these terms so they
-know their rights.
-
-  Developers that use the GNU GPL protect your rights with two steps:
-(1) assert copyright on the software, and (2) offer you this License
-giving you legal permission to copy, distribute and/or modify it.
-
-  For the developers' and authors' protection, the GPL clearly explains
-that there is no warranty for this free software.  For both users' and
-authors' sake, the GPL requires that modified versions be marked as
-changed, so that their problems will not be attributed erroneously to
-authors of previous versions.
-
-  Some devices are designed to deny users access to install or run
-modified versions of the software inside them, although the manufacturer
-can do so.  This is fundamentally incompatible with the aim of
-protecting users' freedom to change the software.  The systematic
-pattern of such abuse occurs in the area of products for individuals to
-use, which is precisely where it is most unacceptable.  Therefore, we
-have designed this version of the GPL to prohibit the practice for those
-products.  If such problems arise substantially in other domains, we
-stand ready to extend this provision to those domains in future versions
-of the GPL, as needed to protect the freedom of users.
-
-  Finally, every program is threatened constantly by software patents.
-States should not allow patents to restrict development and use of
-software on general-purpose computers, but in those that do, we wish to
-avoid the special danger that patents applied to a free program could
-make it effectively proprietary.  To prevent this, the GPL assures that
-patents cannot be used to render the program non-free.
-
-  The precise terms and conditions for copying, distribution and
-modification follow.
-
-                       TERMS AND CONDITIONS
-
-  0. Definitions.
-
-  "This License" refers to version 3 of the GNU General Public License.
-
-  "Copyright" also means copyright-like laws that apply to other kinds of
-works, such as semiconductor masks.
-
-  "The Program" refers to any copyrightable work licensed under this
-License.  Each licensee is addressed as "you".  "Licensees" and
-"recipients" may be individuals or organizations.
-
-  To "modify" a work means to copy from or adapt all or part of the work
-in a fashion requiring copyright permission, other than the making of an
-exact copy.  The resulting work is called a "modified version" of the
-earlier work or a work "based on" the earlier work.
-
-  A "covered work" means either the unmodified Program or a work based
-on the Program.
-
-  To "propagate" a work means to do anything with it that, without
-permission, would make you directly or secondarily liable for
-infringement under applicable copyright law, except executing it on a
-computer or modifying a private copy.  Propagation includes copying,
-distribution (with or without modification), making available to the
-public, and in some countries other activities as well.
-
-  To "convey" a work means any kind of propagation that enables other
-pa
```

**File**: `Resources/Licenses/DynamicNotchKit-MIT.txt` (removed, +0/-21)
```diff
@@ -1,21 +0,0 @@
-MIT License
-
-Copyright (c) 2025 Kai Azim
-
-Permission is hereby granted, free of charge, to any person obtaining a copy
-of this software and associated documentation files (the "Software"), to deal
-in the Software without restriction, including without limitation the rights
-to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
-copies of the Software, and to permit persons to whom the Software is
-furnished to do so, subject to the following conditions:
-
-The above copyright notice and this permission notice shall be included in all
-copies or substantial portions of the Software.
-
-THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
-IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
-FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
-AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
-LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
-OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
-SOFTWARE.
```

---

### Incident Patch 3: `f93372bb` (2026-09-25)
**Commit Message**: fix: preserve capture names and safely publish video saves

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -33,6 +33,8 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - Share only uploads when Upload when I share is on. Setups from 0.4.3 to 0.5.6 that already saved cloud keys have it turned on once during this update; new setups stay off until you turn it on, and Share explains how instead of uploading ([#163](https://github.com/KartikLabhshetwar/better-shot/pull/163), thanks [@icanhasjonas](https://github.com/icanhasjonas))
 - Dragging a clip's Speed slider applies the speed once when you let go: one undo step, no preview stutter, and the speed stays on the clip where the drag started ([#164](https://github.com/KartikLabhshetwar/better-shot/pull/164), thanks [@icanhasjonas](https://github.com/icanhasjonas))
 - WebP is no longer offered as an export format because macOS cannot encode it. A saved WebP choice falls back to PNG ([#162](https://github.com/KartikLabhshetwar/better-shot/pull/162), thanks [@icanhasjonas](https://github.com/icanhasjonas))
+- Custom capture names containing dots keep their full name through Copy, Save, Export, and drag-out instead of losing the last dotted suffix.
+- Video saves preserve the previous file if copying or conversion fails. Simultaneous video saves with the same name now create separate numbered files.
 
 ## [0.5.6] - 2026-09-21
 
```

**File**: `CONTRIBUTING.md` (modified, +5/-0)
```diff
@@ -213,6 +213,11 @@ that export. Export opens a save panel for a new destination.
 Foundation-only deliverable name renderer. Preserve sanitization and keep
 previews from advancing counters. Recording package directory names identify
 projects and must not change with the deliverable template.
+`captureName` already removes the format extension; append the requested
+extension without stripping another dotted suffix. Video saves stage the complete
+copy/remux before replacing an export, and choose collision-free default names
+after asynchronous conversion. Keep the naming and failed-save regressions in
+`Tests/ExportIntegration.swift` against these production paths.
 
 ### Editing, rendering, and persistence
 
```

**File**: `README.md` (modified, +4/-2)
```diff
@@ -47,7 +47,7 @@ permissions and your first capture.
 - Annotate with arrows, shapes, text, numbered markers, highlights, blur, and pixelate.
 - Crop, rotate, and flip without losing editable annotations.
 - Frame captures on a wallpaper, soft gradient, or any solid color with padding, rounded corners, and shadow.
-- Save as PNG, JPEG, or WebP.
+- Save as PNG or JPEG.
 
 **Recordings**
 - Record a display, window, or adjustable area with optional system audio, microphone, camera, and teleprompter.
@@ -126,7 +126,9 @@ bundled in [Resources/Licenses/MacShot.txt](Resources/Licenses/MacShot.txt).
 
 Captures stay in BetterShot's private storage until you save them. A screenshot
 or recording is named once, when it is taken, and Copy, Save, Export, Share, and
-drag-out all reuse that name.
+drag-out all reuse that name, including any dots in a custom template.
+Video saves finish copying or converting before replacing an existing file;
+simultaneous saves with the same name get separate numbered files.
 
 - **Copy** puts the image on the clipboard. No file lands in your save folder.
 - **Save** writes to your configured folder. In the editor, later saves update the same file.
```

**File**: `Sources/BetterShot/BetterShotPreferences.swift` (modified, +1/-1)
```diff
@@ -392,7 +392,7 @@ enum ScreenshotFileActions {
     /// Derived files (the raw source, the deck preview, edited copies) resolve
     /// to it through the capture's record; any other file keeps its own name.
     static func captureFileName(for url: URL, extension pathExtension: String) -> String {
-        ScreenshotFileNaming.fileName(of: URL(fileURLWithPath: captureName(for: url)), extension: pathExtension)
+        URL(fileURLWithPath: captureName(for: url)).appendingPathExtension(pathExtension).lastPathComponent
     }
 
     /// The capture's name without an extension.
```

**File**: `Sources/BetterShot/VideoFileActions.swift` (modified, +24/-12)
```diff
@@ -98,10 +98,16 @@ enum VideoFileActions {
 
     @discardableResult
     static func saveToDefaultLocation(from url: URL, suggestedFileName: String? = nil) async throws -> URL {
-        let destinationURL = try ScreenshotFileActions.exportDestination(
-            named: suggestedFileName ?? exportFileName(for: url)
-        )
-        try await save(from: url, to: destinationURL)
+        let fileName = suggestedFileName ?? exportFileName(for: url)
+        let stagingURL = try ScreenshotFileActions.exportDestination(
+            named: ".BetterShot-\(UUID().uuidString).\(URL(fileURLWithPath: fileName).pathExtension)")
+        defer { try? FileManager.default.removeItem(at: stagingURL) }
+        try await save(from: url, to: stagingURL)
+        // Remuxing suspends. Choose the free name afterward, so concurrent
+        // saves with the same template cannot overwrite each other's output.
+        let destinationURL = ScreenshotFileNaming.uniqueURL(
+            for: fileName, in: stagingURL.deletingLastPathComponent())
+        try FileManager.default.moveItem(at: stagingURL, to: destinationURL)
         return destinationURL
     }
 
@@ -111,16 +117,22 @@ enum VideoFileActions {
     /// reject - the remux is what makes the rename honest. Matching containers
     /// take the copy path, which on APFS is a clone rather than a byte copy.
     static func save(from sourceURL: URL, to destinationURL: URL) async throws {
-        if FileManager.default.fileExists(atPath: destinationURL.path) {
-            try FileManager.default.removeItem(at: destinationURL)
+        let stagingURL = destinationURL.deletingLastPathComponent()
+            .appendingPathComponent(".BetterShot-\(UUID().uuidString)")
+            .appendingPathExtension(destinationURL.pathExtension)
+        defer { try? FileManager.default.removeItem(at: stagingURL) }
+
+        if let target = remuxTarget(from: sourceURL, to: destinationURL) {
+            try await VideoContainerRemuxer.remux(from: sourceURL, to: stagingURL, as: target)
+        } else {
+            try FileManager.default.copyItem(at: sourceURL, to: stagingURL)
         }
-
-        guard let target = remuxTarget(from: sourceURL, to: destinationURL) else {
-            try FileManager.default.copyItem(at: sourceURL, to: destinationURL)
-            return
+        try Task.checkCancellation()
+        if FileManager.default.fileExists(atPath: destinationURL.path) {
+            _ = try FileManager.default.replaceItemAt(destinationURL, withItemAt: stagingURL)
+        } else {
+            try FileManager.default.moveItem(at: stagingURL, to: destinationURL)
         }
-
-        try await VideoContainerRemuxer.remux(from: sourceURL, to: destinationURL, as: target)
     }
 
     /// The container to rewrite into, or nil when a plain copy is correct.
```

**File**: `Tests/ExportIntegration.swift` (modified, +42/-1)
```diff
@@ -322,6 +322,7 @@ struct ExportIntegration {
     }
 
     @MainActor static func checkVideoExports(movie: URL, directory: URL) async throws {
+        try await checkVideoFileSaving(movie: movie, directory: directory)
         checkZoomCamera()
         let clips = RecordingClipTimeline.full(sourceDuration: 2)
         let viewport = ViewportTimeline.build(
@@ -834,6 +835,46 @@ struct ExportIntegration {
     }
 }
 
+@MainActor
+private func checkVideoFileSaving(movie: URL, directory: URL) async throws {
+    let destination = directory.appendingPathComponent("saved-video.mov")
+    let original = try Data(contentsOf: movie)
+    try original.write(to: destination)
+    for source in [directory.appendingPathComponent("missing.mov"), directory.appendingPathComponent("invalid.mp4")] {
+        if source.pathExtension == "mp4" { try Data("invalid movie".utf8).write(to: source) }
+        do {
+            try await VideoFileActions.save(from: source, to: destination)
+            preconditionFailure("Invalid video input must fail")
+        } catch {}
+        precondition((try? Data(contentsOf: destination)) == original,
+                     "Failed video copy/remux must preserve the previous export")
+    }
+    try await VideoFileActions.save(from: destination, to: destination)
+    precondition((try? Data(contentsOf: destination)) == original, "Saving onto the source must preserve it")
+
+    let oldDirectory = AppPreferences.saveDirectory
+    AppPreferences.saveDirectory = directory.path
+    defer { AppPreferences.saveDirectory = oldDirectory }
+    let first = Task { @MainActor in
+        try await VideoFileActions.saveToDefaultLocation(from: movie, suggestedFileName: "same-name.mp4")
+    }
+    let second = Task { @MainActor in
+        try await VideoFileActions.saveToDefaultLocation(from: movie, suggestedFileName: "same-name.mp4")
+    }
+    let outputs = try await [first.value, second.value]
+    precondition(outputs[0] != outputs[1], "Concurrent remuxes must not share a destination")
+    for output in outputs {
+        let duration = try await AVURLAsset(url: output).load(.duration).seconds
+        precondition(abs(duration - 2) < 0.04, "Each saved video must be complete")
+    }
+    let longName = String(repeating: "x", count: 200) + ".mov"
+    let longOutput = try await VideoFileActions.saveToDefaultLocation(from: movie, suggestedFileName: longName)
+    precondition(longOutput.lastPathComponent == longName, "Staging must allow full-length template names")
+    let leftovers = try FileManager.default.contentsOfDirectory(atPath: directory.path)
+    precondition(!leftovers.contains { $0.hasPrefix(".BetterShot-") }, "Video saves must clean up staging files")
+    print("PASS video save failure preserves exports, same-file save, and concurrent remux naming")
+}
+
 @MainActor
 private func checkAnnotationExport(image: CGImage, source: URL, directory: URL) async throws {
     let history = HistoryStore(storageDirectory: directory.appendingPathComponent("annotation-history"))
@@ -894,7 +935,7 @@ private func checkCapturesKeepTheirName(
 
     for keep in [false, true] {
         AppPreferences.keepInDeckUntilSaved = keep
-        let born = "born-\(keep)-{counter:3}"
+        let born = "born-\(keep)-{counter:3}.release.0.5.7"
         UserDefaults.standard.set(born, forKey: templateKey)
         let counterBefore = ScreenshotFileNaming.counter()
         let copied = try await capture(.region)
```

**File**: `Tests/ScrollCaptureIntegration.swift` (modified, +2/-2)
```diff
@@ -82,7 +82,7 @@ struct ScrollCaptureIntegration {
         for _ in 0..<600 {
             if finished { break }
             if !controller.autoScrollActive && NSWorkspace.shared.frontmostApplication?.processIdentifier != fixture.processIdentifier {
-                throw failure("Live check interrupted by an app switch; rerun with the fixture in front")
+                throw failure("Live check interrupted by an app switch to \(NSWorkspace.shared.frontmostApplication?.localizedName ?? "unknown"); rerun with the fixture in front")
             }
             if !checkedPause && controller.stripCount >= 3 {
                 checkedPause = true
@@ -102,7 +102,7 @@ struct ScrollCaptureIntegration {
                     try await Task.sleep(for: .milliseconds(100))
                 }
                 guard controller.stripCount > pausedCount else {
-                    throw failure("Manual scrolling after Pause did not capture the next strip")
+                    throw failure("Manual scrolling after Pause did not capture the next strip; strips=\(pausedCount), pixels=\(controller.stitchedPixelSize), pointerInSelection=\(selection.contains(NSEvent.mouseLocation)), fixtureInFront=\(NSWorkspace.shared.frontmostApplication?.processIdentifier == fixture.processIdentifier)")
                 }
                 controller.toggleAutoScroll()
             }
```

---

### Incident Patch 4: `37b1e62b` (2026-09-25)
**Commit Message**: fix: stitch settled scroll content, enlarge and speed up overlay, add editor dot grid

**File**: `CHANGELOG.md` (modified, +3/-0)
```diff
@@ -17,12 +17,15 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 - **Recording zooms now follow Cap's camera model for smoother, steadier zoom in and zoom out.** Zoom level and framing move on separate springs, so every frame stays inside the recording. A zoom now aims at its target before it begins, so it scales straight toward the subject instead of zooming into the middle and panning across. When a zoom ends, the view zooms out in place without drifting back to the center first. Auto focus groups pointer movement into regions, so small cursor jitter no longer shakes the camera and the view only re-aims when the pointer moves into a new area (hovering is enough, no click needed). The pan-widening and click-snap corrections that caused wobble are gone. Instant zooms snap cleanly on both sides of the segment. Adapted from [Cap](https://github.com/CapSoftware/Cap) under AGPLv3.
 - Auto Zoom creates zooms at 2x, matching Cap's default. Existing zooms keep their saved level and focus.
+- The floating capture preview cards are larger at every size (Small, Medium, and Large), with larger hover actions to match. The preview also appears faster: the deck window is reused between captures and a new card shows the already-rendered image instead of reading it back from disk.
+- The image and video editors show a subtle dot grid behind the canvas, in both light and dark appearance.
 - Capture Previous Region now defaults to `⌘⇧1`, so the last area can be shot again without opening the selector. `⌘⇧2` stays the capture bar. A custom binding for it is kept, and it stays unassigned if another action already uses `⌘⇧1`.
 
 ### Fixed
 
 - **Region screenshots remember your last area again.** `⌘⇧4` and Area in the capture bar open BetterShot's selector with the previous area already selected, as in 0.4: press Return (or double-click inside it) to capture the same area again, drag its edges to resize it, or drag anywhere, even inside it, to draw a new area (so a full-screen previous area never blocks a new selection). Space still switches to window selection and Escape cancels. The app you were using regains focus before the shot, so its windows are captured as active. OCR keeps the native macOS selector.
 - **Scrolling capture no longer lags, in Auto Scroll or when scrolling by hand.** It now uses MacShot's capture engine and bar: frames come straight from the window server (about three times faster than before), Vision measures each scroll and joins frames away from the main thread, and a frame is only added once the page has settled. Manual scrolling grabs frames as you go and takes a final settled frame when you pause, so it keeps up with fast scrolling. Auto Scroll warps the pointer to the area, scrolls it in even steps sized to the area, and stops at the bottom of the page or at 30,000 pixels. It also scrolls down with mouse utilities such as Mac Mouse Fix installed, which previously reversed or smoothed its steps so the page never moved. Hover effects in the page are held still while capturing when Accessibility is allowed. The controls are now MacShot's compact bar with the stitched size, Auto Scroll/Scrolling…, Stop, and a Cancel button, placed beside the selection and clear of the notch. Horizontal capture and the "Lost track" message are gone; scrolling back a little lets the capture continue. Adapted from [MacShot](https://github.com/sw33tLie/macshot) under GPLv3.
+- **Scrolling captures no longer contain faded sections.** Pages that fade content in as it scrolls into view (and have a fixed header) were stitched with the first, half-faded appearance of each section. Each join now redraws the overlap from the newest frame, and Stop takes one last settled frame at the end of the page. The live preview beside the area is also scaled down away from the main thread, so long captures stay smooth.
 - The capture bar no longer shows a dashed "A to capture again" rectangle that could not be moved, resized, or triggered. The previous area is now part of the selector itself, and Capture Previous Region (`⌘⇧1`) captures it without opening the selector.
 - Image and video editors open in a normal window after a screenshot or recording instead of entering full screen automatically. Use the window's green full-screen button to enter full screen, or turn on Settings > General > Editor > Open editors in full screen to restore automatic full screen.
 - **A capture is named once, when it is taken.** Screenshots get their name from the file name template at capture time, and Copy, Save, Export, Share, and drag-out all use it, so pasted files no longer arrive as `BetterShot-Clipboard-<UUID>.png` and saved files no longer use internal names. Two captures in the same second get a number instead of overwriting each other. Recordings are also named once, so saving again no longer renames them or advances `{counter}`. Saving over an existing export keeps its current name ([#161](https://github.com/Ka
```

**File**: `CONTRIBUTING.md` (modified, +4/-0)
```diff
@@ -154,6 +154,10 @@ outline, so BetterShot's panels never appear in them. Vision registration and
 merging run off the main actor, and manual, automatic, and final captures are
 serialized. The reference frame only advances when a strip is appended or the
 page is unchanged, so scrolling back after a missed join recovers.
+Every join redraws the overlap below the pinned header from the newer frame, and
+Stop's final frame refreshes the page end even without further scrolling, so
+content that fades in on scroll is captured settled. The live preview is
+downscaled off the main actor.
 `ScrollFrameAnalyzer` compares native pixel strides and channel layouts; never
 assume captured rows are packed. Auto Scroll posts continuous pixel-unit scroll
 events sized to the area, which mouse utilities such as Mac Mouse Fix pass
```

**File**: `README.md` (modified, +4/-1)
```diff
@@ -111,7 +111,10 @@ again (it reads **Scrolling…**) to go back to scrolling by hand. Click **Stop*
 trigger Scrolling Capture again, to send the image to the capture preview. The
 **×** button or Escape discards it.
 
-Fixed headers and scrollbars are detected and left out of the joins. Auto Scroll
+Fixed headers and scrollbars are detected and left out of the joins. Each join
+redraws the overlap from the newest frame, and Stop takes one last frame at the
+end of the page, so content that fades in as it scrolls into view is captured
+fully drawn. Auto Scroll
 needs Accessibility and finishes at the bottom of the page; either mode finishes
 at 30,000 pixels. If a join is missed, scroll back up a little and continue.
 
```

**File**: `Sources/BetterShot/AnnotationEditorChrome.swift` (modified, +15/-0)
```diff
@@ -94,6 +94,21 @@ struct LowResolutionPreviewNotice: View {
 struct AnnotationEditorWorkspaceBackground: View {
     var body: some View {
         EditorChrome.workspace
+            .overlay {
+                Canvas { context, size in
+                    let spacing: CGFloat = 16
+                    let diameter: CGFloat = 1.6
+                    var dots = Path()
+                    for x in stride(from: spacing / 2, to: size.width, by: spacing) {
+                        for y in stride(from: spacing / 2, to: size.height, by: spacing) {
+                            dots.addEllipse(in: CGRect(x: x - diameter / 2, y: y - diameter / 2,
+                                                       width: diameter, height: diameter))
+                        }
+                    }
+                    context.fill(dots, with: .color(Color(nsColor: .tertiaryLabelColor)))
+                }
+                .accessibilityHidden(true)
+            }
             .ignoresSafeArea()
     }
 }
```

**File**: `Sources/Capture/CaptureOrchestrator.swift` (modified, +13/-9)
```diff
@@ -188,7 +188,7 @@ final class CaptureOrchestrator {
 
     /// Every screenshot starts privately; normal captures can opt into automatic saving.
     func processCapturedImage(_ url: URL, action: ShortcutService.Action = .region) async {
-        let stagedURL = await stageCapture(url)
+        let (stagedURL, thumbnail) = await stageCapture(url)
         var displayURL = AppPreferences.keepInDeckUntilSaved ? stagedURL : DeckStaging.retain(stagedURL)
         if displayURL != stagedURL { DeckStaging.discard(stagedURL) }
         let allowsAutomaticSave: Bool = switch action {
@@ -218,7 +218,7 @@ final class CaptureOrchestrator {
             }
         }
 
-        PreviewOverlay.shared.show(url: displayURL, on: captureScreen)
+        PreviewOverlay.shared.show(url: displayURL, on: captureScreen, thumbnail: thumbnail)
         if saveFailed {
             PreviewOverlay.shared.showSaveFailure(for: displayURL)
             return
@@ -235,12 +235,13 @@ final class CaptureOrchestrator {
         }
     }
 
-    private func stageCapture(_ url: URL) async -> URL {
+    private func stageCapture(_ url: URL) async -> (URL, NSImage?) {
         let config = AppPreferences.defaultBeautifierConfig
+        let thumbnailEdge = OverlayCardSize.large.thumbnailSize.width * 2
         // The capture is named once, here. Its raw source, library copy, and
         // every later Copy or Save keep this name.
         let fileName = ScreenshotFileNaming.currentFileName(extension: AppPreferences.exportFormat.fileExtension)
-        let stagedURL = await Task.detached { () -> URL? in
+        let staging = await Task.detached { () -> (URL, CGImage)? in
             guard let folder = try? DeckStaging.makeCaptureDirectory() else { return nil }
             guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
                   let cgImage = CGImageSourceCreateImageAtIndex(source, 0, nil),
@@ -249,21 +250,24 @@ final class CaptureOrchestrator {
                 try? FileManager.default.removeItem(at: folder)
                 return nil
             }
-            return staged
+            let scale = min(1, thumbnailEdge / CGFloat(max(rendered.width, rendered.height)))
+            let colorSpace = rendered.colorSpace ?? CGColorSpaceCreateDeviceRGB()
+            let thumbnail = (try? AnnotationScenePreviewRenderer.downscaled(rendered, scale: scale, colorSpace: colorSpace)) ?? rendered
+            return (staged, thumbnail)
         }.value
 
-        guard let stagedURL else {
+        guard let (stagedURL, thumbnail) = staging else {
             ToastWindow.shared.show(isError: true, title: "Couldn’t prepare capture",
                 message: "The original screenshot is still available in the preview.",
                 systemIcon: "exclamationmark.triangle", on: captureScreen)
-            return Self.unstagedCapture(url, named: fileName)
+            return (Self.unstagedCapture(url, named: fileName), nil)
         }
         do {
             try FileManager.default.moveItem(at: url, to: DeckStaging.rawURL(for: stagedURL))
-            return stagedURL
+            return (stagedURL, NSImage(cgImage: thumbnail, size: .zero))
         } catch {
             DeckStaging.discard(stagedURL)
-            return Self.unstagedCapture(url, named: fileName)
+            return (Self.unstagedCapture(url, named: fileName), nil)
         }
     }
 
```

**File**: `Sources/Capture/ScrollCaptureController.swift` (modified, +20/-18)
```diff
@@ -96,7 +96,7 @@ final class ScrollCaptureController {
         shotA = firstFrame
         stitchedImage = firstFrame
         stripCount = 1
-        emitPreview()
+        await emitPreview()
         onStripAdded?(stripCount)
 
         guard !isStopping else { return }
@@ -203,12 +203,11 @@ final class ScrollCaptureController {
             Self.visionScrollOffset(previous: previous, current: frame,
                                     excludedTop: excludedTop, excludedRight: excludedRight)
         }
-        guard isActive, !isCancelled, !Task.isCancelled, let offset else { return .unmatched }
-        guard offset != 0 else {
+        guard isActive, !isCancelled, !Task.isCancelled, let offset, offset >= 0 else { return .unmatched }
+        guard offset > 0 || final else {
             shotA = frame
             return .unchanged
         }
-        guard offset > 0 else { return .unmatched }
         guard final || offset >= frame.height / 10 else { return .tooSmall }
 
         if frozenDetectionEnabled && !headerDetectionDone {
@@ -224,7 +223,7 @@ final class ScrollCaptureController {
         stitchedImage = merged
         shotA = frame
         stripCount += 1
-        emitPreview()
+        await emitPreview()
         onStripAdded?(stripCount)
         if maxScrollHeight > 0 && merged.height >= maxScrollHeight { stopSession() }
         return .appended
@@ -246,11 +245,14 @@ final class ScrollCaptureController {
         return Int(shift.rounded())
     }
 
-    /// Appends `offsetPx` new rows; without a pinned header the whole newer frame overwrites the overlap so pinned footers appear once, at the end.
+    /// Appends `offsetPx` rows and redraws everything below the pinned header from the newer frame, so content that faded or loaded in late is kept settled.
     nonisolated static func mergedImage(existing: CGImage, currentFrame: CGImage,
                                         offsetPx: Int, headerHeight: Int = 0) -> CGImage? {
-        guard existing.width == currentFrame.width, offsetPx > 0, offsetPx <= currentFrame.height,
-              currentFrame.height <= existing.height + offsetPx else { return nil }
+        let header = max(0, headerHeight)
+        guard existing.width == currentFrame.width, offsetPx >= 0, header < currentFrame.height,
+              currentFrame.height <= existing.height + offsetPx,
+              let body = currentFrame.cropping(to: CGRect(x: 0, y: header, width: currentFrame.width,
+                                                          height: currentFrame.height - header)) else { return nil }
         let width = currentFrame.width
         let totalHeight = existing.height + offsetPx
         let colorSpace = existing.colorSpace ?? CGColorSpace(name: CGColorSpace.sRGB)!
@@ -259,13 +261,7 @@ final class ScrollCaptureController {
                                       bitsPerComponent: 8, bytesPerRow: width * 4,
                                       space: colorSpace, bitmapInfo: bitmapInfo) else { return nil }
         context.draw(existing, in: CGRect(x: 0, y: offsetPx, width: width, height: existing.height))
-        if headerHeight > 0 {
-            guard let strip = currentFrame.cropping(to: CGRect(x: 0, y: currentFrame.height - offsetPx,
-                                                               width: width, height: offsetPx)) else { return nil }
-            context.draw(strip, in: CGRect(x: 0, y: 0, width: width, height: offsetPx))
-        } else {
-            context.draw(currentFrame, in: CGRect(x: 0, y: 0, width: width, height: currentFrame.height))
-        }
+        context.draw(body, in: CGRect(x: 0, y: 0, width: width, height: body.height))
         return context.makeImage()
     }
 
@@ -418,8 +414,14 @@ final class ScrollCaptureController {
         }
     }
 
-    private func emitPreview() {
-        guard let image = stitchedImage, let onPreviewUpdated else { return }
-        onPreviewUpdated(NSImage(cgImage: image, size: pointSize(of: image)))
+    private func emitPreview() async {
+        guard let image = stitchedImage, onPreviewUpdated != nil else { return }
+        let scale = min(1, ScrollCapturePreviewPanel.previewWidth * backingScale / CGFloat(image.width))
+        let colorSpace = image.colorSpace ?? CGColorSpaceCreateDeviceRGB()
+        let preview = await onCaptureQueue {
+            (try? AnnotationScenePreviewRenderer.downscaled(image, scale: scale, colorSpace: colorSpace)) ?? image
+        }
+        guard isActive, !isCancelled, image === stitchedImage else { return }
+        onPreviewUpdated?(NSImage(cgImage: preview, size: pointSize(of: preview)))
     }
 }
```

**File**: `Sources/Capture/ScrollCapturePreviewPanel.swift` (modified, +7/-7)
```diff
@@ -11,7 +11,7 @@ final class ScrollCapturePreviewPanel: NSPanel {
     private let captureRect: NSRect
     private let targetScreen: NSScreen
     private let side: Side  // which side of the capture rect the preview appears on
-    private let previewWidth: CGFloat = 200
+    static let previewWidth: CGFloat = 200
     private let margin: CGFloat = 12
     private let minHeight: CGFloat = 100
     /// Half of the selection border stroke width (2.5pt during scroll capture).
@@ -27,7 +27,7 @@ final class ScrollCapturePreviewPanel: NSPanel {
         // Determine which side has more space
         let spaceLeft = captureRect.minX - screen.visibleFrame.minX
         let spaceRight = screen.visibleFrame.maxX - captureRect.maxX
-        let needed = previewWidth + margin * 2
+        let needed = Self.previewWidth + margin * 2
 
         if spaceRight >= needed {
             side = .right
@@ -41,11 +41,11 @@ final class ScrollCapturePreviewPanel: NSPanel {
         let x: CGFloat
         switch side {
         case .right: x = captureRect.maxX + margin
-        case .left:  x = captureRect.minX - margin - previewWidth
+        case .left:  x = captureRect.minX - margin - Self.previewWidth
         }
         let initialHeight = minHeight
         let y = captureRect.minY - selectionBorderOutset
-        let frame = NSRect(x: x, y: y, width: previewWidth, height: initialHeight)
+        let frame = NSRect(x: x, y: y, width: Self.previewWidth, height: initialHeight)
 
         super.init(contentRect: frame,
                    styleMask: [.borderless, .nonactivatingPanel],
@@ -86,7 +86,7 @@ final class ScrollCapturePreviewPanel: NSPanel {
         let x: CGFloat
         switch side {
         case .right: x = captureRect.maxX + margin
-        case .left:  x = captureRect.minX - margin - previewWidth
+        case .left:  x = captureRect.minX - margin - Self.previewWidth
         }
 
         // Anchor the bottom of the preview at the bottom of the capture rect,
@@ -97,7 +97,7 @@ final class ScrollCapturePreviewPanel: NSPanel {
 
         // Desired height based on image aspect ratio
         let imageAspect = image.size.height / max(1, image.size.width)
-        let contentWidth = previewWidth - 8
+        let contentWidth = Self.previewWidth - 8
         let desiredHeight = contentWidth * imageAspect + 8
 
         // Clamp to available space — image scales down proportionally inside the view
@@ -108,7 +108,7 @@ final class ScrollCapturePreviewPanel: NSPanel {
             ? anchorBottom
             : ceilingY - panelHeight
 
-        let newFrame = NSRect(x: x, y: panelBottom, width: previewWidth, height: panelHeight)
+        let newFrame = NSRect(x: x, y: panelBottom, width: Self.previewWidth, height: panelHeight)
         setFrame(newFrame, display: true, animate: false)
     }
 }
```

**File**: `Sources/Models/AppPreferences.swift` (modified, +6/-6)
```diff
@@ -351,18 +351,18 @@ enum OverlayCardSize: String, CaseIterable, Identifiable {
     /// Hover control scale, deliberately sub-linear to the thumbnail ratio.
     var controlScale: CGFloat {
         switch self {
-        case .small: return 1.0
-        case .medium: return 1.25
-        case .large: return 1.5
+        case .small: return 1.15
+        case .medium: return 1.35
+        case .large: return 1.6
         }
     }
 
     /// The visible thumbnail drawn inside the panel.
     var thumbnailSize: CGSize {
         switch self {
-        case .small: return CGSize(width: 130, height: 98)
-        case .medium: return CGSize(width: 190, height: 140)
-        case .large: return CGSize(width: 250, height: 180)
+        case .small: return CGSize(width: 180, height: 130)
+        case .medium: return CGSize(width: 240, height: 172)
+        case .large: return CGSize(width: 300, height: 216)
         }
     }
 }
```

---

### Incident Patch 5: `c03bf8dc` (2026-09-25)
**Commit Message**: fix: port MacShot scrolling capture engine and bar

Scrolling capture lagged and stalled in both Auto Scroll and manual mode.
Replace the controller with MacShot's engine: window-server frames below
the selection outline, TIFF settlement, Vision registration and merging
off the main actor, and serialized manual/auto/final captures. Replace
the panel with MacShot's compact bar.

Auto Scroll posts continuous pixel steps sized to the area so mouse
utilities such as Mac Mouse Fix no longer reverse its line events, and
Pause drops an in-flight frame instead of appending it.

**File**: `CHANGELOG.md` (modified, +2/-4)
```diff
@@ -9,7 +9,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Added
 
-- **Scrolling capture is now available.** The 0.5.5 stitching engine shipped without a way to start it. Choose Scrolling Capture in the menu bar or Scroll in the capture bar, select an area, then scroll down or sideways through the content. A floating panel counts stitched frames and the image's length; Stop sends the result to the normal capture preview and Cancel discards it. Stitching now handles horizontal scrolling, fixed headers, and moving scrollbars, and a capture finishes on its own at 30,000 pixels ([#169](https://github.com/KartikLabhshetwar/better-shot/pull/169), thanks [@ItisPratham](https://github.com/ItisPratham))
+- **Scrolling capture is now available.** The 0.5.5 stitching engine shipped without a way to start it. Choose Scrolling Capture in the menu bar or Scroll in the capture bar, select an area, then scroll down through the content. A compact bar beside the area shows the stitched size; Stop sends the result to the normal capture preview and Cancel or Escape discards it. Stitching handles fixed headers and moving scrollbars, and a capture finishes on its own at 30,000 pixels ([#169](https://github.com/KartikLabhshetwar/better-shot/pull/169), thanks [@ItisPratham](https://github.com/ItisPratham))
 - Scrolling Capture can be assigned a shortcut in Settings > Shortcuts (unassigned by default); triggering it again during a capture stops the capture. It is also available as `bettershot://capture/scroll` for automation.
 - **Choose any background color.** Background > Color in the image and video editors now has a Custom color well below the preset swatches, and Settings > General > Default Look has one for new captures. The color is kept in saved projects and exports ([#160](https://github.com/KartikLabhshetwar/better-shot/issues/160), thanks [@EthanL06](https://github.com/EthanL06))
 
@@ -22,9 +22,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 ### Fixed
 
 - **Region screenshots remember your last area again.** `⌘⇧4` and Area in the capture bar open BetterShot's selector with the previous area already selected, as in 0.4: press Return (or double-click inside it) to capture the same area again, drag its edges to resize it, or drag anywhere, even inside it, to draw a new area (so a full-screen previous area never blocks a new selection). Space still switches to window selection and Escape cancels. The app you were using regains focus before the shot, so its windows are captured as active. OCR keeps the native macOS selector.
-- **Rebuilt scrolling capture around MacShot's capture flow.** Added Vision-based alignment, Auto Scroll/Pause, a live stitched preview, Escape cancellation, and controls positioned beside the selection without hiding under the notch. Low-contrast pages now register movement, matching runs off the main thread, and frozen-header/scrollbar detection handles padded pixel rows and different channel layouts. Automatic scrolling stops at the page bottom and pauses if tracking is lost or you switch apps. Preserved horizontal capture, full-resolution PNGs, private staging, and pinned bottom bars appearing once at the end. Adapted from [MacShot](https://github.com/sw33tLie/macshot) under GPLv3.
-- Scrolling capture takes a new frame after every third of the area you scroll, so fast scrolling keeps enough overlap to stitch. If it still loses its place, the panel shows "Lost track. Scroll back a little, then slower." with a warning symbol and VoiceOver announces it; the message clears as soon as stitching resumes.
-- Scrolling capture keeps its place on pages whose content fades, slides, or plays while you scroll, such as landing pages with reveal animations or autoplaying video. The whole page is stitched instead of stopping partway with "Lost track", and faint low-contrast pages still line up.
+- **Scrolling capture no longer lags, in Auto Scroll or when scrolling by hand.** It now uses MacShot's capture engine and bar: frames come straight from the window server (about three times faster than before), Vision measures each scroll and joins frames away from the main thread, and a frame is only added once the page has settled. Manual scrolling grabs frames as you go and takes a final settled frame when you pause, so it keeps up with fast scrolling. Auto Scroll warps the pointer to the area, scrolls it in even steps sized to the area, and stops at the bottom of the page or at 30,000 pixels. It also scrolls down with mouse utilities such as Mac Mouse Fix installed, which previously reversed or smoothed its steps so the page never moved. Hover effects in the page are held still while capturing when Accessibility is allowed. The controls are now MacShot's compact bar with the stitched size, Auto Scroll/Scrolling…, Stop, and a Cancel button, placed beside the selection and clear of the notch. Horizontal capture and the "Lost track" mes
```

**File**: `CONTRIBUTING.md` (modified, +11/-7)
```diff
@@ -147,14 +147,18 @@ Scrolling Capture is the `.scrollCapture` action: the menu bar, capture bar,
 shortcut, and `bettershot://capture/scroll` all reach it through
 `CaptureOrchestrator.performCapture`. It selects an area with
 `RegionSelectionOverlay` and uses `ScrollCaptureSessionPresenter` to Stop into
-that same private preview flow or Cancel/Escape without staging a file. MacShot's
-Vision registration, automatic scroll cycle, and live preview use the same
-controller and preserve ScreenCaptureKit exclusion/coordinate conversion.
+that same private preview flow or Cancel/Escape without staging a file.
+`ScrollCaptureController` ports MacShot's engine: frames come from
+`CGWindowListCreateImage` (loaded at runtime) for windows below the selection
+outline, so BetterShot's panels never appear in them. Vision registration and
+merging run off the main actor, and manual, automatic, and final captures are
+serialized. The reference frame only advances when a strip is appended or the
+page is unchanged, so scrolling back after a missed join recovers.
 `ScrollFrameAnalyzer` compares native pixel strides and channel layouts; never
-assume captured rows are packed. Keep matching off the main actor, serialize
-manual/auto/final captures, and retain the last successfully stitched reference
-when a match fails. Auto Scroll pauses on tracking loss or app changes and stops
-at page end or the size limit. Run
+assume captured rows are packed. Auto Scroll posts continuous pixel-unit scroll
+events sized to the area, which mouse utilities such as Mac Mouse Fix pass
+through unchanged; line events get reversed or smoothed. It pauses on app
+changes and stops at page end, after repeated misses, or at the size limit. Run
 `BETTERSHOT_CHECK_CAPTURE_UI=1 bash Tests/run-exports.sh` after a test build to
 check stitching and the compact capture controls in both appearances.
 Region screenshots use `RegionSelectionOverlay` with the previous area
```

**File**: `README.md` (modified, +11/-12)
```diff
@@ -101,20 +101,19 @@ Set the background, padding, corner radius, and shadow for new captures in
 
 ### Scrolling capture
 
-Capture a page or list that is taller or wider than the screen. Choose
+Capture a page or list that is taller than the screen. Choose
 **Scrolling Capture** in the menu bar popover or **Scroll** in the capture bar
 (`⌘⇧2`), or assign a shortcut in **Settings > Shortcuts**. Drag over the
-scrollable content, then scroll through it as usual in one direction: down, or
-horizontally. The floating panel counts the stitched frames and the image's
-length, with a live stitched preview beside the area when there is room.
-Choose **Auto Scroll** to scroll down automatically and **Pause Scroll** to resume
-manual scrolling. Click **Stop**, or trigger Scrolling Capture again, to send the
-image to the capture preview. **Cancel** or Escape discards it.
-
-Scroll at a steady pace so consecutive frames overlap. Fixed headers and
-scrollbars are detected and left out of the joins. Auto Scroll finishes at the
-bottom of the page; either mode finishes at 30,000 pixels. If tracking is lost,
-auto-scroll pauses so you can scroll back slightly and recover.
+scrollable content, then scroll down through it as usual. A compact bar beside
+the area shows the stitched size, with a live preview next to the area when
+there is room. Choose **Auto Scroll** to scroll down automatically, and click it
+again (it reads **Scrolling…**) to go back to scrolling by hand. Click **Stop**, or
+trigger Scrolling Capture again, to send the image to the capture preview. The
+**×** button or Escape discards it.
+
+Fixed headers and scrollbars are detected and left out of the joins. Auto Scroll
+needs Accessibility and finishes at the bottom of the page; either mode finishes
+at 30,000 pixels. If a join is missed, scroll back up a little and continue.
 
 Vision alignment, automatic scrolling, frame analysis, and the live preview are
 adapted from [MacShot](https://github.com/sw33tLie/macshot); its GPLv3 notice is
```

**File**: `Sources/Capture/ScrollCaptureController.swift` (modified, +198/-750)
```diff
@@ -1,5 +1,4 @@
 import Cocoa
-import ScreenCaptureKit
 import Vision
 
 // Scroll registration, settlement and auto-scroll adapted from MacShot (GPLv3).
@@ -8,94 +7,83 @@ import Vision
 @MainActor
 final class ScrollCaptureController {
 
-    nonisolated enum ScrollDirection: Sendable {
-        case down, right, left
-
-        var isHorizontal: Bool { self != .down }
-        var sign: Int { self == .left ? -1 : 1 }
-    }
-
-    private(set) var stripCount: Int = 0
+    private(set) var stripCount = 0
     private(set) var stitchedImage: CGImage?
-    private(set) var stitchedPixelSize: CGSize = .zero
-    private(set) var isActive: Bool = false
+    private(set) var isActive = false
+    private(set) var autoScrollActive = false
     private(set) var frozenTopHeight: CGFloat = 0
-    private var isCancelled: Bool = false
-    private var isStopping: Bool = false
-    private var didFinishSession: Bool = false
+    private var isCancelled = false
+    private var isStopping = false
+    private var didFinishSession = false
 
-    var estimatedTotalHeight: CGFloat {
-        guard let merged = mergedImage else { return 0 }
-        return CGFloat(merged.height) / backingScale
+    var stitchedPixelSize: CGSize {
+        stitchedImage.map { CGSize(width: $0.width, height: $0.height) } ?? .zero
     }
 
     var onStripAdded: ((Int) -> Void)?
     var onSessionDone: ((NSImage?) -> Void)?
     var onPreviewUpdated: ((NSImage) -> Void)?
-    var onTrackingChanged: ((Bool) -> Void)?
-
-    var excludedWindowIDs: [CGWindowID] = []
-
-    private(set) var autoScrollActive = false
     var onAutoScrollChanged: ((Bool) -> Void)?
     var onStatusMessage: ((String?) -> Void)?
-    private var autoScrollTask: Task<Void, Never>?
+
+    /// Frames include only windows below this one, so BetterShot's session panels never appear in them.
+    var captureBelowWindowID: CGWindowID = kCGNullWindowID
+
     private var autoScrollSpeed = 3
-    private var targetAppPID: pid_t = 0
-    private var maxScrollHeight: Int = 30000
-    private var frozenDetectionEnabled: Bool = true
+    private var maxScrollHeight = 30_000
+    private var frozenDetectionEnabled = true
 
     private let captureRect: NSRect
-    private let screen: NSScreen
+    private let captureRectCG: CGRect
     private let backingScale: CGFloat
-
     private let captureQueue = DispatchQueue(label: "bettershot.scrollcapture", qos: .userInitiated)
 
     private var shotA: CGImage?
-    private var mergedImage: CGImage?
-    private var scrollDirection: ScrollDirection?
-    private var prefersHorizontal = false
-    var isHorizontalCapture: Bool { scrollDirection?.isHorizontal == true }
-    private var headerHeight: Int = 0
-    private var headerDetectionDone: Bool = false
-
-    private var rightMarginPx: Int = 0
-    private var rightMarginDetected: Bool = false
+    private var headerHeight = 0
+    private var headerDetectionDone = false
+    private var rightMarginPx = 0
+    private var rightMarginDetected = false
 
     private var scrollMonitorGlobal: Any?
     private var scrollMonitorLocal: Any?
+    private var autoScrollTask: Task<Void, Never>?
+    private var targetAppPID: pid_t = 0
 
     private let manualCaptureInterval: TimeInterval = 0.15
     private var lastCaptureTime: TimeInterval = 0
-    private var scrolledSinceCapture: CGFloat = 0
-    private var scrolledSinceMatch: CGFloat = 0
-    private var isTracking = true
     private var settlementTimer: Timer?
     private let settlementInterval: TimeInterval = 0.25
+    private let maxMatchNotFound = 8
 
-    private var isCapturing: Bool = false
+    private var isCapturing = false
 
-    private var cachedContentFilter: SCContentFilter?
+    private enum Step { case appended, unchanged, tooSmall, unmatched }
+
+    private typealias WindowListCreateImage = @convention(c) (
+        CGRect, CGWindowListOption, CGWindowID, CGWindowImageOption) -> Unmanaged<CGImage>?
+
+    /// `CGWindowListCreateImage` is hidden from Swift at this deployment target but still ships; it is several times faster than ScreenCaptureKit for single frames.
+    private static let createWindowListImage: WindowListCreateImage? =
+        dlsym(UnsafeMutableRawPointer(bitPattern: -2), "CGWindowListCreateImage")
+            .map { unsafeBitCast($0, to: WindowListCreateImage.self) }
 
     init(captureRect: NSRect, screen: NSScreen) {
         self.captureRect = captureRect
-        self.screen = screen
         self.backingScale = screen.backingScaleFactor
+        let primaryHeight = CGDisplayBounds(CGMainDisplayID()).height
+        captureRectCG = CGRect(x: captureRect.minX, y: primaryHeight - captureRect.maxY,
+                               width: captureRect.width, height: captureRect.height)
     }
 
     func startSession() async {
         guard !isActive, !isCancelled, !didFinishSession else { return }
 
         let ud = UserDefaults.standard
-        maxScrollHeight = ud.object(forKey: "scrollMaxHe
```

**File**: `Sources/Capture/ScrollCaptureSessionPresenter.swift` (modified, +96/-60)
```diff
@@ -18,6 +18,8 @@ final class ScrollCaptureSessionPresenter {
     private var selectionPanel: NSPanel?
     private var keyMonitorGlobal: Any?
     private var keyMonitorLocal: Any?
+    private var mouseMoveTap: CFMachPort?
+    private var mouseMoveTapSource: CFRunLoopSource?
     private var continuation: CheckedContinuation<Result, Never>?
 
     private init() {}
@@ -34,20 +36,12 @@ final class ScrollCaptureSessionPresenter {
         let controller = ScrollCaptureController(captureRect: rect, screen: screen)
         let model = ScrollCaptureSessionModel()
         self.controller = controller
-        controller.onStripAdded = { [weak self, weak controller] count in
+        controller.onStripAdded = { [weak self, weak controller] _ in
             guard self?.continuation != nil, let controller else { return }
             model.isStarting = false
-            model.stripCount = count
-            model.isHorizontal = controller.isHorizontalCapture
-            model.pixelLength = Int(model.isHorizontal
-                ? controller.stitchedPixelSize.width : controller.stitchedPixelSize.height)
-        }
-        controller.onTrackingChanged = { [weak self] isTracking in
-            guard self?.continuation != nil else { return }
-            model.isLost = !isTracking
-            if !isTracking {
-                AccessibilityNotification.Announcement(ScrollCaptureSessionView.lostMessage).post()
-            }
+            let pixels = controller.stitchedPixelSize
+            model.pointSize = CGSize(width: pixels.width / screen.backingScaleFactor,
+                                     height: pixels.height / screen.backingScaleFactor)
         }
         controller.onSessionDone = { [weak self, weak controller] image in
             guard let self else { return }
@@ -81,7 +75,8 @@ final class ScrollCaptureSessionPresenter {
         }
         preview?.orderFrontRegardless()
         present(model: model, rect: rect, on: screen)
-        controller.excludedWindowIDs = [panel, previewPanel, selectionPanel].compactMap { $0.map { CGWindowID($0.windowNumber) } }
+        controller.captureBelowWindowID = CGWindowID(outline.windowNumber)
+        if ShortcutService.hasAccessibilityPermission { installMouseMoveSuppression() }
         keyMonitorGlobal = NSEvent.addGlobalMonitorForEvents(matching: .keyDown) { [weak self] event in
             if event.keyCode == 53 { self?.cancel() }
         }
@@ -102,6 +97,28 @@ final class ScrollCaptureSessionPresenter {
         finish(.cancelled)
     }
 
+    /// Swallows mouse-moved events while capturing so hover effects in the target app don't change the frames being stitched.
+    private func installMouseMoveSuppression() {
+        guard let tap = CGEvent.tapCreate(tap: .cgSessionEventTap, place: .headInsertEventTap,
+            options: .defaultTap, eventsOfInterest: CGEventMask(1 << CGEventType.mouseMoved.rawValue),
+            callback: { _, _, _, _ in nil }, userInfo: nil) else { return }
+        let source = CFMachPortCreateRunLoopSource(nil, tap, 0)
+        CFRunLoopAddSource(CFRunLoopGetMain(), source, .commonModes)
+        CGEvent.tapEnable(tap: tap, enable: true)
+        mouseMoveTap = tap
+        mouseMoveTapSource = source
+    }
+
+    private func removeMouseMoveSuppression() {
+        if let mouseMoveTap {
+            CGEvent.tapEnable(tap: mouseMoveTap, enable: false)
+            CFMachPortInvalidate(mouseMoveTap)
+        }
+        if let mouseMoveTapSource { CFRunLoopRemoveSource(CFRunLoopGetMain(), mouseMoveTapSource, .commonModes) }
+        mouseMoveTap = nil
+        mouseMoveTapSource = nil
+    }
+
     // MacShot's selection-relative HUD placement, including the notch-safe fallback.
     static func panelFrame(size: NSSize, selection: NSRect, screenFrame: NSRect,
                            visibleFrame: NSRect, topInset: CGFloat) -> NSRect {
@@ -120,7 +137,7 @@ final class ScrollCaptureSessionPresenter {
             cancel: { [weak self] in self?.cancel() },
             toggleAutoScroll: { [weak self] in self?.controller?.toggleAutoScroll() })
         let hostingView = NSHostingView(rootView: view)
-        let size = NSSize(width: 312, height: 148)
+        let size = ScrollCaptureSessionView.size
         let panel = NSPanel(contentRect: NSRect(origin: .zero, size: size),
             styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
         panel.identifier = NSUserInterfaceItemIdentifier("BetterShot.ScrollCaptureControls")
@@ -145,14 +162,14 @@ final class ScrollCaptureSessionPresenter {
         self.continuation = nil
         controller?.onStripAdded = nil
         controller?.onSessionDone = nil
-        controller?.onTrackingChanged = nil
         controller?.onAutoScrollChanged = nil
         controller?.onStatusMessage = nil
         controller?.onPreviewUpdated = nil
         if let keyMonitorGlobal { NSEvent.removeMonitor(keyMonitorGlobal) }
         if let keyMonitorLoca
```

**File**: `Tests/EditorUIIntegration.swift` (modified, +49/-381)
```diff
@@ -921,36 +921,26 @@ func checkCaptureControlsUI() throws {
         if ProcessInfo.processInfo.environment["BETTERSHOT_CHECK_CAPTURE_UI"] == "1" {
             try snapshot(MenuBarContentView(dismissPopover: {}), scheme: scheme, width: 296,
                          to: output.appendingPathComponent("capture-menu-\(name).png"), height: 540)
-            let startingModel = ScrollCaptureSessionModel()
-            try snapshot(ScrollCaptureSessionView(model: startingModel,
-                stop: {}, cancel: {}), scheme: scheme, width: 312,
-                to: output.appendingPathComponent("scroll-session-starting-\(name).png"), height: 148)
-
-            let capturingModel = ScrollCaptureSessionModel()
-            capturingModel.isStarting = false
-            capturingModel.stripCount = 4
-            capturingModel.pixelLength = 2_160
-            try snapshot(ScrollCaptureSessionView(model: capturingModel,
-                stop: {}, cancel: {}), scheme: scheme, width: 312,
-                to: output.appendingPathComponent("scroll-session-capturing-\(name).png"), height: 148)
-            capturingModel.isAutoScrolling = true
-            try snapshot(ScrollCaptureSessionView(model: capturingModel,
-                stop: {}, cancel: {}), scheme: scheme, width: 312,
-                to: output.appendingPathComponent("scroll-session-auto-\(name).png"), height: 148)
-            capturingModel.isAutoScrolling = false
-            capturingModel.statusMessage = "Allow Accessibility in Settings, then retry Auto Scroll."
-            try snapshot(ScrollCaptureSessionView(model: capturingModel,
-                stop: {}, cancel: {}), scheme: scheme, width: 312,
-                to: output.appendingPathComponent("scroll-session-permission-\(name).png"), height: 148)
-            capturingModel.statusMessage = nil
-            capturingModel.isHorizontal = true
-            try snapshot(ScrollCaptureSessionView(model: capturingModel,
-                stop: {}, cancel: {}), scheme: scheme, width: 312,
-                to: output.appendingPathComponent("scroll-session-horizontal-\(name).png"), height: 148)
-            capturingModel.isLost = true
-            try snapshot(ScrollCaptureSessionView(model: capturingModel,
-                stop: {}, cancel: {}), scheme: scheme, width: 312,
-                to: output.appendingPathComponent("scroll-session-lost-\(name).png"), height: 148)
+            let hudWidth = ScrollCaptureSessionView.size.width
+            let hudHeight = ScrollCaptureSessionView.size.height
+            let scrollModel = ScrollCaptureSessionModel()
+            try snapshot(ScrollCaptureSessionView(model: scrollModel,
+                stop: {}, cancel: {}), scheme: scheme, width: hudWidth,
+                to: output.appendingPathComponent("scroll-session-starting-\(name).png"), height: hudHeight)
+            scrollModel.isStarting = false
+            scrollModel.pointSize = CGSize(width: 1_512, height: 12_480)
+            try snapshot(ScrollCaptureSessionView(model: scrollModel,
+                stop: {}, cancel: {}), scheme: scheme, width: hudWidth,
+                to: output.appendingPathComponent("scroll-session-capturing-\(name).png"), height: hudHeight)
+            scrollModel.isAutoScrolling = true
+            try snapshot(ScrollCaptureSessionView(model: scrollModel,
+                stop: {}, cancel: {}), scheme: scheme, width: hudWidth,
+                to: output.appendingPathComponent("scroll-session-auto-\(name).png"), height: hudHeight)
+            scrollModel.isAutoScrolling = false
+            scrollModel.statusMessage = "Allow Accessibility in Settings, then retry Auto Scroll."
+            try snapshot(ScrollCaptureSessionView(model: scrollModel,
+                stop: {}, cancel: {}), scheme: scheme, width: hudWidth,
+                to: output.appendingPathComponent("scroll-session-permission-\(name).png"), height: hudHeight)
         }
         try snapshot(RecordingSessionControls().studioGlass(cornerRadius: BarMetrics.cornerRadius, opacity: 0.78),
                      scheme: scheme, width: 360,
@@ -988,13 +978,6 @@ private func checkScrollCaptureStitching() throws {
             shouldInterpolate: false, intent: .defaultIntent)!
     }
     let padded = paddedFrame(changed: false, littleEndian: true)
-    precondition(ScrollCaptureController.framesEqual(padded,
-        paddedFrame(changed: false, littleEndian: true, padding: 91)),
-        "Changing unused row padding must not look like new content")
-    precondition(ScrollCaptureController.framesEqual(padded,
-        paddedFrame(changed: false, littleEndian: false)), "Padding/channel order must not prevent page-end detection")
-    precondition(!ScrollCaptureController.framesEqual(padded,
-        paddedFrame(changed: true, littleEndian: false)))
     precondition(ScrollFrameAnalyzer.frozenTopRows(current: paddedFrame(changed: false, littleEndian: false),
         previous: padded, rightMarginPx: 0) == 6
```

**File**: `Tests/ScrollCaptureIntegration.swift` (modified, +4/-4)
```diff
@@ -70,7 +70,7 @@ struct ScrollCaptureIntegration {
         var finished = false
         controller.onSessionDone = { completed = $0; finished = true }
         UserDefaults.standard.set(false, forKey: "scrollAutoScrollEnabled")
-        UserDefaults.standard.set(3, forKey: "scrollAutoScrollSpeed")
+        UserDefaults.standard.set(1, forKey: "scrollAutoScrollSpeed")
         UserDefaults.standard.set(30_000, forKey: "scrollMaxHeight")
         await controller.startSession()
         guard controller.stripCount == 1, let first = controller.stitchedImage else {
@@ -92,8 +92,8 @@ struct ScrollCaptureIntegration {
                 guard !controller.autoScrollActive, controller.stripCount == pausedCount else {
                     throw failure("Pause must stop the auto-scroll cycle")
                 }
-                let event = CGEvent(scrollWheelEvent2Source: nil, units: .line, wheelCount: 1,
-                    wheel1: -3, wheel2: 0, wheel3: 0)!
+                let event = CGEvent(scrollWheelEvent2Source: nil, units: .pixel, wheelCount: 1,
+                    wheel1: -60, wheel2: 0, wheel3: 0)!
                 event.location = CGPoint(x: selection.midX,
                     y: CGDisplayBounds(CGMainDisplayID()).height - selection.midY)
                 event.post(tap: .cghidEventTap)
@@ -129,7 +129,7 @@ struct ScrollCaptureIntegration {
         for row in 0..<10 {
             let original = initial.colorAt(x: Int(10 * scale), y: Int((CGFloat(row * 30) + 10) * scale))!
                 .usingColorSpace(.sRGB)!.redComponent
-            guard abs(reds[row] - original) < 0.005 else { throw failure("Initial row \(row) changed") }
+            guard abs(reds[row] - original) < 0.015 else { throw failure("Initial row \(row) changed") }
         }
         for row in 0..<20 {
             for other in 0..<row {
```

---

### Incident Patch 6: `497bca80` (2026-09-25)
**Commit Message**: docs: add merged fixes to the 0.5.7 changelog

**File**: `CHANGELOG.md` (modified, +6/-1)
```diff
@@ -23,9 +23,14 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - **Region screenshots remember your last area again.** `⌘⇧4` and Area in the capture bar open BetterShot's selector with the previous area already selected, as in 0.4: press Return (or double-click inside it) to capture the same area again, drag its edges to resize it, or drag anywhere, even inside it, to draw a new area (so a full-screen previous area never blocks a new selection). Space still switches to window selection and Escape cancels. The app you were using regains focus before the shot, so its windows are captured as active. OCR keeps the native macOS selector.
 - **Rebuilt scrolling capture around MacShot's capture flow.** Added Vision-based alignment, Auto Scroll/Pause, a live stitched preview, Escape cancellation, and controls positioned beside the selection without hiding under the notch. Low-contrast pages now register movement, matching runs off the main thread, and frozen-header/scrollbar detection handles padded pixel rows and different channel layouts. Automatic scrolling stops at the page bottom and pauses if tracking is lost or you switch apps. Preserved horizontal capture, full-resolution PNGs, private staging, and pinned bottom bars appearing once at the end. Adapted from [MacShot](https://github.com/sw33tLie/macshot) under GPLv3.
 - Scrolling capture takes a new frame after every third of the area you scroll, so fast scrolling keeps enough overlap to stitch. If it still loses its place, the panel shows "Lost track. Scroll back a little, then slower." with a warning symbol and VoiceOver announces it; the message clears as soon as stitching resumes.
+- Scrolling capture keeps its place on pages whose content fades, slides, or plays while you scroll, such as landing pages with reveal animations or autoplaying video. The whole page is stitched instead of stopping partway with "Lost track", and faint low-contrast pages still line up.
 - The capture bar no longer shows a dashed "A to capture again" rectangle that could not be moved, resized, or triggered. The previous area is now part of the selector itself, and Capture Previous Region (`⌘⇧1`) captures it without opening the selector.
 - Image and video editors open in a normal window after a screenshot or recording instead of entering full screen automatically. Use the window's green full-screen button to enter full screen, or turn on Settings > General > Editor > Open editors in full screen to restore automatic full screen.
-- Automatically saved screenshots and new explicit Saves use the configured file name template instead of the internal `.preview.png` name. Saving over an existing export keeps its current name ([#167](https://github.com/KartikLabhshetwar/better-shot/pull/167), thanks [@zergzorg](https://github.com/zergzorg))
+- **A capture is named once, when it is taken.** Screenshots get their name from the file name template at capture time, and Copy, Save, Export, Share, and drag-out all use it, so pasted files no longer arrive as `BetterShot-Clipboard-<UUID>.png` and saved files no longer use internal names. Two captures in the same second get a number instead of overwriting each other. Recordings are also named once, so saving again no longer renames them or advances `{counter}`. Saving over an existing export keeps its current name ([#161](https://github.com/KartikLabhshetwar/better-shot/pull/161), thanks [@icanhasjonas](https://github.com/icanhasjonas); builds on [#167](https://github.com/KartikLabhshetwar/better-shot/pull/167), thanks [@zergzorg](https://github.com/zergzorg))
+- Region, previous-region, and full-screen screenshots appear as soon as the PNG is written instead of waiting up to 10 seconds for Spotlight. A capture can no longer stay stuck "in progress" when the system screenshot tool writes a lot of error output ([#168](https://github.com/KartikLabhshetwar/better-shot/pull/168), thanks [@icanhasjonas](https://github.com/icanhasjonas))
+- Share only uploads when Upload when I share is on. Setups from 0.4.3 to 0.5.6 that already saved cloud keys have it turned on once during this update; new setups stay off until you turn it on, and Share explains how instead of uploading ([#163](https://github.com/KartikLabhshetwar/better-shot/pull/163), thanks [@icanhasjonas](https://github.com/icanhasjonas))
+- Dragging a clip's Speed slider applies the speed once when you let go: one undo step, no preview stutter, and the speed stays on the clip where the drag started ([#164](https://github.com/KartikLabhshetwar/better-shot/pull/164), thanks [@icanhasjonas](https://github.com/icanhasjonas))
+- WebP is no longer offered as an export format because macOS cannot encode it. A saved WebP choice falls back to PNG ([#162](https://github.com/KartikLabhshetwar/better-shot/pull/162), thanks [@icanhasjonas](https://github.com/icanhasjonas))
 
 ## [0.5.6] - 2026-09-21
 
```

---

### Incident Patch 7: `8269cdef` (2026-09-25)
**Commit Message**: Merge pull request #161 from icanhasjonas/fix/clipboard-file-names

fix: name a capture once, when it is taken

**File**: `BetterShot.xcodeproj/project.pbxproj` (modified, +0/-8)
```diff
@@ -525,13 +525,6 @@
 			path = Sharing;
 			sourceTree = "<group>";
 		};
-		299E86DC313097FC40D543B7 /* Presets */ = {
-			isa = PBXGroup;
-			children = (
-			);
-			path = Presets;
-			sourceTree = "<group>";
-		};
 		39D4566D88515C653CF4F4DB /* Models */ = {
 			isa = PBXGroup;
 			children = (
@@ -809,7 +802,6 @@
 				749E9D00F818F70E06F34BB9 /* History */,
 				39D4566D88515C653CF4F4DB /* Models */,
 				BDA590964BECE51622E85075 /* Notch */,
-				299E86DC313097FC40D543B7 /* Presets */,
 				99E8726305BC9AF4B98FA73B /* Preview */,
 				02E0E07267FD5201B631F82C /* Services */,
 				E4007FFA622C92BA5142F86A /* Settings */,
```

**File**: `README.md` (modified, +8/-3)
```diff
@@ -122,14 +122,19 @@ bundled in [Resources/Licenses/MacShot.txt](Resources/Licenses/MacShot.txt).
 
 ### Where files go
 
-Captures stay in BetterShot's private storage until you save them.
+Captures stay in BetterShot's private storage until you save them. A screenshot
+or recording is named once, when it is taken, and Copy, Save, Export, Share, and
+drag-out all reuse that name.
 
 - **Copy** puts the image on the clipboard. No file lands in your save folder.
 - **Save** writes to your configured folder. In the editor, later saves update the same file.
 - **Export** asks for a new destination.
 
-Automatic saving is off by default. Turn it on in **Settings > General > Saving**,
-where you can also set file name templates such as `standup-{date}-{counter:3}`.
+Automatic screenshot saving is **off by default**. Enable it under
+**Settings > General > Saving** to save normal captures while keeping the preview
+or editor available. Explicit Capture & Copy, Edit, and Pin shortcuts bypass it.
+The same settings section lets you customize file names with templates such as
+`standup-{date}-{counter:3}`.
 
 ### Permissions
 
```

**File**: `Sources/BetterShot/AnnotationEditorModel.swift` (modified, +1/-4)
```diff
@@ -819,10 +819,7 @@ extension AnnotationEditorModel {
     private func stableImageSnapshotURL(for url: URL) -> URL? {
         if ownedImageURLs.contains(url) { return url }
 
-        let fileExtension = url.pathExtension.isEmpty ? "png" : url.pathExtension
-        let destinationURL = URL(fileURLWithPath: NSTemporaryDirectory())
-            .appendingPathComponent("BetterShot_ImageSnapshot_\(UUID().uuidString)")
-            .appendingPathExtension(fileExtension)
+        let destinationURL = ScreenshotFileNaming.scratchURL("ImageSnapshot", extension: url.pathExtension)
 
         do {
             try FileManager.default.copyItem(at: url, to: destinationURL)
```

**File**: `Sources/BetterShot/AnnotationEditorWindow.swift` (modified, +2/-1)
```diff
@@ -543,7 +543,7 @@ struct AnnotationEditorWindow: View {
                 )
                 // The clipboard helper keeps a private snapshot for terminals
                 // and apps that paste files, independent of future edits or Save.
-                try ScreenshotFileActions.copyPNGToClipboard(from: renderedURL)
+                try ScreenshotFileActions.copyPNGToClipboard(from: renderedURL, of: sourceURL)
                 flashCopyConfirmation()
             } catch {
                 model.errorMessage = "Failed to copy annotation: \(error.localizedDescription)"
@@ -645,6 +645,7 @@ struct AnnotationEditorWindow: View {
                 let result = try await CloudUploader.shared.upload(
                     itemID: itemID,
                     fileURL: resultURL,
+                    named: ScreenshotFileActions.captureName(for: sourceURL),
                     title: options.trimmedTitleOrNil
                 )
                 NSPasteboard.general.clearContents()
```

**File**: `Sources/BetterShot/AnnotationImageCropper.swift` (modified, +1/-2)
```diff
@@ -50,8 +50,7 @@ enum AnnotationImageCropper {
             return nil
         }
 
-        let destinationURL = URL(fileURLWithPath: NSTemporaryDirectory())
-            .appendingPathComponent("BetterShot_Crop_\(UUID().uuidString).png")
+        let destinationURL = ScreenshotFileNaming.scratchURL("Crop", extension: "png")
 
         guard let destination = CGImageDestinationCreateWithURL(
             destinationURL as CFURL,
```

**File**: `Sources/BetterShot/AnnotationImageTransform.swift` (modified, +1/-2)
```diff
@@ -90,8 +90,7 @@ enum AnnotationImageTransform: CaseIterable {
         context.scaleBy(x: 1, y: -1)
         context.draw(image, in: CGRect(origin: .zero, size: sourceSize))
         guard let transformed = context.makeImage() else { return nil }
-        let destinationURL = FileManager.default.temporaryDirectory
-            .appendingPathComponent("BetterShot_Transform_\(UUID().uuidString).png")
+        let destinationURL = ScreenshotFileNaming.scratchURL("Transform", extension: "png")
         guard let destination = CGImageDestinationCreateWithURL(destinationURL as CFURL,
             UTType.png.identifier as CFString, 1, nil) else { return nil }
         CGImageDestinationAddImage(destination, transformed, nil)
```

**File**: `Sources/BetterShot/AnnotationRenderer.swift` (modified, +1/-2)
```diff
@@ -78,8 +78,7 @@ enum AnnotationRenderer {
         shapes: [AnnoShape],
         backgroundSettings: AnnotationBackgroundSettings = AnnotationBackgroundSettings()
     ) throws -> URL {
-        let destinationURL = URL(fileURLWithPath: NSTemporaryDirectory())
-            .appendingPathComponent("BetterShot_Annotated_\(UUID().uuidString).png")
+        let destinationURL = ScreenshotFileNaming.scratchURL("Annotated", extension: "png")
         try render(
             sourceURL: sourceURL,
             shapes: shapes,
```

**File**: `Sources/BetterShot/BetterShotPreferences.swift` (modified, +44/-51)
```diff
@@ -258,7 +258,8 @@ enum ScreenshotExportFormat: String, CaseIterable, Identifiable {
 }
 
 enum ScreenshotFileActions {
-    static func copyImageToClipboard(from url: URL) throws {
+    /// `captureURL` names the pasted file when `url` is a rendering of it.
+    static func copyImageToClipboard(from url: URL, of captureURL: URL? = nil) throws {
         let contentType = UTType(filenameExtension: url.pathExtension)
         let dataType: NSPasteboard.PasteboardType
         if contentType?.conforms(to: .jpeg) == true {
@@ -269,20 +270,26 @@ enum ScreenshotFileActions {
             dataType = .png
         }
 
-        try copyImageToClipboard(from: url, dataType: dataType)
+        try copyImageToClipboard(from: url, of: captureURL ?? url, dataType: dataType)
     }
 
-    static func copyPNGToClipboard(from url: URL, text: String? = nil, to pasteboard: NSPasteboard = .general) throws {
-        try copyImageToClipboard(from: url, dataType: .png, text: text, pasteboard: pasteboard)
+    static func copyPNGToClipboard(from url: URL, of captureURL: URL? = nil, text: String? = nil,
+                                   to pasteboard: NSPasteboard = .general) throws {
+        try copyImageToClipboard(from: url, of: captureURL ?? url, dataType: .png, text: text, pasteboard: pasteboard)
     }
 
-    private static func copyImageToClipboard(from url: URL, dataType: NSPasteboard.PasteboardType,
+    private static func copyImageToClipboard(from url: URL, of captureURL: URL, dataType: NSPasteboard.PasteboardType,
                                               text: String? = nil, pasteboard: NSPasteboard = .general) throws {
         let imageData = try Data(contentsOf: url, options: .mappedIfSafe)
         // Keep a clipboard snapshot independent of later dismissal, edits, or Save.
-        let clipboardURL = FileManager.default.temporaryDirectory
-            .appendingPathComponent("BetterShot-Clipboard-\(UUID().uuidString)")
-            .appendingPathExtension(url.pathExtension)
+        // Paste targets show the file name, so it carries the capture's name;
+        // a per-copy folder keeps two copies of one capture apart.
+        let clipboardDirectory = FileManager.default.temporaryDirectory
+            .appendingPathComponent("BetterShot-Clipboard", isDirectory: true)
+            .appendingPathComponent(UUID().uuidString, isDirectory: true)
+        try FileManager.default.createDirectory(at: clipboardDirectory, withIntermediateDirectories: true)
+        let clipboardURL = clipboardDirectory
+            .appendingPathComponent(captureFileName(for: captureURL, extension: url.pathExtension))
         try imageData.write(to: clipboardURL, options: .atomic)
         pasteboard.clearContents()
 
@@ -312,20 +319,19 @@ enum ScreenshotFileActions {
     }
     
     @discardableResult
-    static func saveToDefaultLocation(from url: URL) throws -> URL {
-        let destinationDirectory = BetterShotPreferences.exportDirectory
-        try FileManager.default.createDirectory(
-            at: destinationDirectory,
-            withIntermediateDirectories: true
-        )
-        
-        let destinationURL = uniqueDestinationURL(
-            for: ScreenshotFileNaming.currentFileName(extension: BetterShotPreferences.exportFormat.fileExtension),
-            in: destinationDirectory
-        )
+    static func saveToDefaultLocation(from url: URL, suggestedFileName: String? = nil) throws -> URL {
+        let destinationURL = try exportDestination(named: suggestedFileName ?? exportFileName(for: url))
         try save(from: url, to: destinationURL)
         return destinationURL
     }
+
+    /// A free path for `fileName` in the save folder, creating the folder if
+    /// needed. Image and video saves both resolve their destination here.
+    static func exportDestination(named fileName: String) throws -> URL {
+        let directory = BetterShotPreferences.exportDirectory
+        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
+        return ScreenshotFileNaming.uniqueURL(for: fileName, in: directory)
+    }
     
     static func save(from sourceURL: URL, to destinationURL: URL) throws {
         try replaceExistingExport(from: sourceURL, at: destinationURL,
@@ -349,7 +355,7 @@ enum ScreenshotFileActions {
                                       compressionQuality: BetterShotPreferences.compressionQuality)
             destination = existing
         } else {
-            destination = try saveToDefaultLocation(from: renderedURL)
+            destination = try saveToDefaultLocation(from: renderedURL, suggestedFileName: exportFileName(for: captureURL))
         }
         if let record { HistoryStore.shared.setBeautifiedPath(destination.path, for: record.id) }
         return destination
@@ -382,11 +388,24 @@ enum ScreenshotFileActions {
         }
     }
     
-    static func exportFileName(for sourceURL: URL) -> String {
-        return sourceURL
-           
```

---

### Incident Patch 8: `41601f60` (2026-09-25)
**Commit Message**: Merge remote-tracking branch 'origin/main' into fix/clipboard-file-names

**File**: `Sources/Capture/ScrollCaptureController.swift` (modified, +55/-36)
```diff
@@ -690,6 +690,7 @@ final class ScrollCaptureController {
                       let other = match.score(distance * direction.sign, direction: direction, sampleLimit: 16),
                       other.isConfident else { return false }
                 return other.error <= score.error + max(2, score.error * 0.5)
+                    && other.relativeError <= score.relativeError * 1.5 + 0.05
             }
             if !ambiguous { return (candidate, score) }
         }
@@ -712,43 +713,69 @@ final class ScrollCaptureController {
             coarse.append((candidate, score))
         }
         let likely = coarse.sorted { $0.score.error < $1.score.error }.prefix(24)
+        let seeds = Set(likely.map(\.offset) + coarse.filter(\.score.isConfident).map(\.offset))
         var candidates: [Int: ScrollMatch.Score] = [:]
-        for entry in coarse where entry.score.isConfident {
-            candidates[entry.offset] = entry.score
-        }
-        for entry in likely {
-            for distance in max(minimum, abs(entry.offset) - step)...min(maximum, abs(entry.offset) + step) {
+        var refined = Set<Int>()
+        for seed in seeds {
+            for distance in max(minimum, abs(seed) - step)...min(maximum, abs(seed) + step)
+            where refined.insert(distance).inserted {
                 let offset = distance * direction.sign
                 guard let score = match.score(offset, direction: direction),
                       score.isConfident else { continue }
                 candidates[offset] = score
             }
         }
-        let ranked = candidates.sorted { $0.value.error < $1.value.error }
-        guard let best = ranked.first else { return nil }
-        let offsets = candidates.keys.sorted()
-        var lower = offsets.firstIndex(of: best.key)!
-        var upper = lower
-        while lower > 0, offsets[lower] - offsets[lower - 1] <= step { lower -= 1 }
-        while upper < offsets.count - 1, offsets[upper + 1] - offsets[upper] <= step { upper += 1 }
-        let bestBasin = offsets[lower]...offsets[upper]
+        var basins: [(offset: Int, score: ScrollMatch.Score)] = []
+        var previousOffset: Int?
+        for offset in candidates.keys.sorted() {
+            let score = candidates[offset]!
+            if let previousOffset, offset - previousOffset <= step, let last = basins.last {
+                if score.error < last.score.error { basins[basins.count - 1] = (offset, score) }
+            } else {
+                basins.append((offset, score))
+            }
+            previousOffset = offset
+        }
+        guard let best = basins.min(by: { $0.score.error < $1.score.error }) else { return nil }
+        let rivals = basins
+            .filter { $0.score.error - best.score.error <= max(2, best.score.error * 0.5)
+                && $0.score.relativeError <= best.score.relativeError * 1.5 + 0.05 }
+            .sorted { $0.score.evidence > $1.score.evidence }
         // Repeated content can match at several offsets. Wait for another frame
         // rather than permanently joining at an arbitrary row or column.
-        if let runnerUp = ranked.first(where: { !bestBasin.contains($0.key) }),
-           runnerUp.value.error - best.value.error <= max(2, best.value.error * 0.5) {
-            return nil
-        }
-        return (best.key, best.value)
+        guard rivals.count == 1 || rivals[0].score.evidence >= rivals[1].score.evidence * 2 else { return nil }
+        return rivals[0]
     }
 
     private nonisolated struct ScrollMatch {
         struct Score {
             let error: Double
+            let trimmedError: Double
             let relativeError: Double
-            let support: Int
+            let evidence: Int
+
+            /// Scores aligned differences, ignoring the worst half so fading or animated content cannot hide a true match.
+            init?(alignedHistogram histogram: [Int], unchangedPositionError: Int, stride: Int) {
+                let changed = histogram.reduce(0, +)
+                guard changed >= 20 else { return nil }
+                let kept = changed - changed / 2
+                var remaining = kept
+                var trimmedSum = 0
+                var alignedSum = 0
+                for (value, count) in histogram.enumerated() {
+                    let taken = min(count, remaining)
+                    trimmedSum += value * taken
+                    remaining -= taken
+                    alignedSum += value * count
+                }
+                error = Double(alignedSum) / Double(changed * 3)
+                trimmedError = Double(trimmedSum) / Double(kept * 3)
+                relativeError = Double(alignedSum) / Double(unchangedPositionError)
+                evidence = histogram[..<36].reduce(0, +) * stride
+            }
 
             var isConfident: Bool {
-                support >= 20 && error <= 8 && relativeError <= 0.12
+                trimmedError <= 1.5 && error <= 32 && relat
```

**File**: `Tests/EditorUIIntegration.swift` (modified, +7/-0)
```diff
@@ -1099,6 +1099,13 @@ private func checkScrollCaptureStitching() throws {
             color: CGColor(gray: 0.5, alpha: 1)),
         excludedTop: headerHeight, excludedRight: 0) == nil,
         "The matcher must reject unrelated frames")
+    let revealContext = bitmap(viewportHeight)
+    revealContext.draw(second, in: CGRect(x: 0, y: 0, width: width, height: viewportHeight))
+    revealContext.setFillColor(CGColor(gray: 1, alpha: 0.6))
+    revealContext.fill(CGRect(x: 0, y: 24, width: width, height: 20))
+    precondition(ScrollCaptureController.matchedScrollOffset(previous: first,
+        current: revealContext.makeImage()!, excludedTop: headerHeight, excludedRight: 0) == 23,
+        "Content fading in during a scroll must not hide the page movement")
 
     // Sparse text on a dark page resembles a conversation capture: most of
     // the viewport is unchanged background, with a stationary top bar.
```

---

### Incident Patch 9: `51661a49` (2026-09-25)
**Commit Message**: fix: keep scrolling capture aligned while page content fades or slides in

**File**: `Sources/Capture/ScrollCaptureController.swift` (modified, +55/-36)
```diff
@@ -690,6 +690,7 @@ final class ScrollCaptureController {
                       let other = match.score(distance * direction.sign, direction: direction, sampleLimit: 16),
                       other.isConfident else { return false }
                 return other.error <= score.error + max(2, score.error * 0.5)
+                    && other.relativeError <= score.relativeError * 1.5 + 0.05
             }
             if !ambiguous { return (candidate, score) }
         }
@@ -712,43 +713,69 @@ final class ScrollCaptureController {
             coarse.append((candidate, score))
         }
         let likely = coarse.sorted { $0.score.error < $1.score.error }.prefix(24)
+        let seeds = Set(likely.map(\.offset) + coarse.filter(\.score.isConfident).map(\.offset))
         var candidates: [Int: ScrollMatch.Score] = [:]
-        for entry in coarse where entry.score.isConfident {
-            candidates[entry.offset] = entry.score
-        }
-        for entry in likely {
-            for distance in max(minimum, abs(entry.offset) - step)...min(maximum, abs(entry.offset) + step) {
+        var refined = Set<Int>()
+        for seed in seeds {
+            for distance in max(minimum, abs(seed) - step)...min(maximum, abs(seed) + step)
+            where refined.insert(distance).inserted {
                 let offset = distance * direction.sign
                 guard let score = match.score(offset, direction: direction),
                       score.isConfident else { continue }
                 candidates[offset] = score
             }
         }
-        let ranked = candidates.sorted { $0.value.error < $1.value.error }
-        guard let best = ranked.first else { return nil }
-        let offsets = candidates.keys.sorted()
-        var lower = offsets.firstIndex(of: best.key)!
-        var upper = lower
-        while lower > 0, offsets[lower] - offsets[lower - 1] <= step { lower -= 1 }
-        while upper < offsets.count - 1, offsets[upper + 1] - offsets[upper] <= step { upper += 1 }
-        let bestBasin = offsets[lower]...offsets[upper]
+        var basins: [(offset: Int, score: ScrollMatch.Score)] = []
+        var previousOffset: Int?
+        for offset in candidates.keys.sorted() {
+            let score = candidates[offset]!
+            if let previousOffset, offset - previousOffset <= step, let last = basins.last {
+                if score.error < last.score.error { basins[basins.count - 1] = (offset, score) }
+            } else {
+                basins.append((offset, score))
+            }
+            previousOffset = offset
+        }
+        guard let best = basins.min(by: { $0.score.error < $1.score.error }) else { return nil }
+        let rivals = basins
+            .filter { $0.score.error - best.score.error <= max(2, best.score.error * 0.5)
+                && $0.score.relativeError <= best.score.relativeError * 1.5 + 0.05 }
+            .sorted { $0.score.evidence > $1.score.evidence }
         // Repeated content can match at several offsets. Wait for another frame
         // rather than permanently joining at an arbitrary row or column.
-        if let runnerUp = ranked.first(where: { !bestBasin.contains($0.key) }),
-           runnerUp.value.error - best.value.error <= max(2, best.value.error * 0.5) {
-            return nil
-        }
-        return (best.key, best.value)
+        guard rivals.count == 1 || rivals[0].score.evidence >= rivals[1].score.evidence * 2 else { return nil }
+        return rivals[0]
     }
 
     private nonisolated struct ScrollMatch {
         struct Score {
             let error: Double
+            let trimmedError: Double
             let relativeError: Double
-            let support: Int
+            let evidence: Int
+
+            /// Scores aligned differences, ignoring the worst half so fading or animated content cannot hide a true match.
+            init?(alignedHistogram histogram: [Int], unchangedPositionError: Int, stride: Int) {
+                let changed = histogram.reduce(0, +)
+                guard changed >= 20 else { return nil }
+                let kept = changed - changed / 2
+                var remaining = kept
+                var trimmedSum = 0
+                var alignedSum = 0
+                for (value, count) in histogram.enumerated() {
+                    let taken = min(count, remaining)
+                    trimmedSum += value * taken
+                    remaining -= taken
+                    alignedSum += value * count
+                }
+                error = Double(alignedSum) / Double(changed * 3)
+                trimmedError = Double(trimmedSum) / Double(kept * 3)
+                relativeError = Double(alignedSum) / Double(unchangedPositionError)
+                evidence = histogram[..<36].reduce(0, +) * stride
+            }
 
             var isConfident: Bool {
-                support >= 20 && error <= 8 && relativeError <= 0.12
+                trimmedError <= 1.5 && error <= 32 && relat
```

**File**: `Tests/EditorUIIntegration.swift` (modified, +7/-0)
```diff
@@ -1097,6 +1097,13 @@ private func checkScrollCaptureStitching() throws {
             color: CGColor(gray: 0.5, alpha: 1)),
         excludedTop: headerHeight, excludedRight: 0) == nil,
         "The matcher must reject unrelated frames")
+    let revealContext = bitmap(viewportHeight)
+    revealContext.draw(second, in: CGRect(x: 0, y: 0, width: width, height: viewportHeight))
+    revealContext.setFillColor(CGColor(gray: 1, alpha: 0.6))
+    revealContext.fill(CGRect(x: 0, y: 24, width: width, height: 20))
+    precondition(ScrollCaptureController.matchedScrollOffset(previous: first,
+        current: revealContext.makeImage()!, excludedTop: headerHeight, excludedRight: 0) == 23,
+        "Content fading in during a scroll must not hide the page movement")
 
     // Sparse text on a dark page resembles a conversation capture: most of
     // the viewport is unchanged background, with a stationary top bar.
```

---

### Incident Patch 10: `032e9c0e` (2026-09-25)
**Commit Message**: Merge remote-tracking branch 'origin/main' into fix/clipboard-file-names

**File**: `BetterShot.xcodeproj/project.pbxproj` (modified, +12/-0)
```diff
@@ -161,6 +161,7 @@
 		ADDDE18D5DA47F866E3C15C2 /* RecordingTranscriptEditing.swift in Sources */ = {isa = PBXBuildFile; fileRef = 4CCD4CBE6C2F68F14298572D /* RecordingTranscriptEditing.swift */; };
 		AECE06FCCA388F3C27CA5C9C /* RecordingExportReframe.swift in Sources */ = {isa = PBXBuildFile; fileRef = F02562FF53E7AE39E8DE3E81 /* RecordingExportReframe.swift */; };
 		B0D43AF92D661FDC828C1399 /* GeoPaths.swift in Sources */ = {isa = PBXBuildFile; fileRef = A077E702B85C092E049C33BA /* GeoPaths.swift */; };
+		B59A11814CC73A048E1A925D /* ScrollFrameAnalyzer.swift in Sources */ = {isa = PBXBuildFile; fileRef = 8566C51E6448E2BC40BD938A /* ScrollFrameAnalyzer.swift */; };
 		B67249B2788081263585AB5D /* RecordingExportOptions.swift in Sources */ = {isa = PBXBuildFile; fileRef = C7881A05DB7FD7C0160C3D30 /* RecordingExportOptions.swift */; };
 		B6A1C17303643E0C512127E3 /* RecordingTranscription.swift in Sources */ = {isa = PBXBuildFile; fileRef = CEC5745BD6B7DD30BD91DEA0 /* RecordingTranscription.swift */; };
 		B713F9D891DBC6B6756A4C71 /* RecordingStudioExporter.swift in Sources */ = {isa = PBXBuildFile; fileRef = 2E260FCA6C4E719CE4AE0F45 /* RecordingStudioExporter.swift */; };
@@ -170,6 +171,7 @@
 		BA2E35F115F67D7CA6DEE5A9 /* BetterShotApp.swift in Sources */ = {isa = PBXBuildFile; fileRef = F74F2F48E0775A96906E180F /* BetterShotApp.swift */; };
 		BA91FBAAB700FD8A1341F27D /* ScreenshotPreviewItem.swift in Sources */ = {isa = PBXBuildFile; fileRef = 0FC7A31E31203B3330CE5AA0 /* ScreenshotPreviewItem.swift */; };
 		BACCC6CAD5B08E0987F79EE4 /* ScreenshotFileNaming.swift in Sources */ = {isa = PBXBuildFile; fileRef = 4EC83F060B8C618716847D95 /* ScreenshotFileNaming.swift */; };
+		BC3024BE9954759663767B8D /* ScrollCapturePreviewPanel.swift in Sources */ = {isa = PBXBuildFile; fileRef = FDFB9ADE951E2EB3D7A4AB3D /* ScrollCapturePreviewPanel.swift */; };
 		BC6170740B05997D27830D0B /* RecordingKeystrokeCapture.swift in Sources */ = {isa = PBXBuildFile; fileRef = 8944EFA56AE64C38C83ED9E1 /* RecordingKeystrokeCapture.swift */; };
 		BC811FEA82E635D6292A80FD /* MenuBarContentView.swift in Sources */ = {isa = PBXBuildFile; fileRef = AE87F338892DCBFEA8FD7BDA /* MenuBarContentView.swift */; };
 		BC91FECA9CA43F0585BE1836 /* StudioInspectorTabs.swift in Sources */ = {isa = PBXBuildFile; fileRef = 7C6D5B9A6634007DC09C4A81 /* StudioInspectorTabs.swift */; };
@@ -210,6 +212,7 @@
 		E129F8B6CE468246CA52897C /* AnnotationBackground.swift in Sources */ = {isa = PBXBuildFile; fileRef = FE35FD31C764306466AF2955 /* AnnotationBackground.swift */; };
 		E1DE7FE0CEBB164E662979EA /* AnnotationTextStyleControls.swift in Sources */ = {isa = PBXBuildFile; fileRef = DEDFDD9AD76A019ADE57581A /* AnnotationTextStyleControls.swift */; };
 		E29FA26E5F3F90C0653923E8 /* Assets.xcassets in Resources */ = {isa = PBXBuildFile; fileRef = B350EE68E3E974004660FC0A /* Assets.xcassets */; };
+		E5EC3D5ABA7F21EA6052C1A4 /* ScreencaptureRunner.swift in Sources */ = {isa = PBXBuildFile; fileRef = 279A657A2185919A48381A64 /* ScreencaptureRunner.swift */; };
 		E5F46E4A80BB763B20FF325D /* OnboardingState.swift in Sources */ = {isa = PBXBuildFile; fileRef = 497BE78596E45F13EA785993 /* OnboardingState.swift */; };
 		E70126BC766D72CFA1522996 /* AnnotationEditorModel.swift in Sources */ = {isa = PBXBuildFile; fileRef = 826D967E7F5D2962EFE34A29 /* AnnotationEditorModel.swift */; };
 		E9925479ADCF9DBD17407322 /* RecordingBarPresenter.swift in Sources */ = {isa = PBXBuildFile; fileRef = 5C57F353C924B2EAE57C53C0 /* RecordingBarPresenter.swift */; };
@@ -269,6 +272,7 @@
 		23F4D20DF3F0349735C2F80D /* RecordingProject.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = RecordingProject.swift; sourceTree = "<group>"; };
 		26E94949C3E83B5CA1C11F94 /* AnnotationCameraGeometry.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AnnotationCameraGeometry.swift; sourceTree = "<group>"; };
 		2770974B62BA6019294FC9BF /* ScreenshotImageLoader.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ScreenshotImageLoader.swift; sourceTree = "<group>"; };
+		279A657A2185919A48381A64 /* ScreencaptureRunner.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ScreencaptureRunner.swift; sourceTree = "<group>"; };
 		27B9B3F0836AF531CFB09F8C /* AnnoCanvasLayerView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AnnoCanvasLayerView.swift; sourceTree = "<group>"; };
 		293EA45B51DD6073E49641F4 /* AnnotationEditorWindow.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AnnotationEditorWindow.swift; sourceTree = "<group>"; };
 		297470BDCFA9440CC1AACDC6 /* BoringNotchHoverButton.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = BoringNotchHoverButton.swift; sourceTree = "<group>"; };
@@ -358,6 +362,7 @@
 		7D6C3162472265AFC3EF722B /* NotchRecentCaptures.swift */ = {isa = PBXFileRef
```

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 ### Fixed
 
 - **Region screenshots remember your last area again.** `⌘⇧4` and Area in the capture bar open BetterShot's selector with the previous area already selected, as in 0.4: press Return (or double-click inside it) to capture the same area again, drag its edges to resize it, or drag anywhere, even inside it, to draw a new area (so a full-screen previous area never blocks a new selection). Space still switches to window selection and Escape cancels. The app you were using regains focus before the shot, so its windows are captured as active. OCR keeps the native macOS selector.
-- **Scrolling capture stitches more reliably.** Pages with a pinned bottom bar (chat composer, cookie banner, tab bar) no longer stop after the first frame, and that bar appears once at the end instead of repeating between strips. Near-identical matches a pixel apart no longer make it skip frames.
+- **Rebuilt scrolling capture around MacShot's capture flow.** Added Vision-based alignment, Auto Scroll/Pause, a live stitched preview, Escape cancellation, and controls positioned beside the selection without hiding under the notch. Low-contrast pages now register movement, matching runs off the main thread, and frozen-header/scrollbar detection handles padded pixel rows and different channel layouts. Automatic scrolling stops at the page bottom and pauses if tracking is lost or you switch apps. Preserved horizontal capture, full-resolution PNGs, private staging, and pinned bottom bars appearing once at the end. Adapted from [MacShot](https://github.com/sw33tLie/macshot) under GPLv3.
 - Scrolling capture takes a new frame after every third of the area you scroll, so fast scrolling keeps enough overlap to stitch. If it still loses its place, the panel shows "Lost track. Scroll back a little, then slower." with a warning symbol and VoiceOver announces it; the message clears as soon as stitching resumes.
 - The capture bar no longer shows a dashed "A to capture again" rectangle that could not be moved, resized, or triggered. The previous area is now part of the selector itself, and Capture Previous Region (`⌘⇧1`) captures it without opening the selector.
 - Image and video editors open in a normal window after a screenshot or recording instead of entering full screen automatically. Use the window's green full-screen button to enter full screen, or turn on Settings > General > Editor > Open editors in full screen to restore automatic full screen.
```

**File**: `CONTRIBUTING.md` (modified, +9/-1)
```diff
@@ -147,7 +147,14 @@ Scrolling Capture is the `.scrollCapture` action: the menu bar, capture bar,
 shortcut, and `bettershot://capture/scroll` all reach it through
 `CaptureOrchestrator.performCapture`. It selects an area with
 `RegionSelectionOverlay` and uses `ScrollCaptureSessionPresenter` to Stop into
-that same private preview flow or Cancel without staging a file. Run
+that same private preview flow or Cancel/Escape without staging a file. MacShot's
+Vision registration, automatic scroll cycle, and live preview use the same
+controller and preserve ScreenCaptureKit exclusion/coordinate conversion.
+`ScrollFrameAnalyzer` compares native pixel strides and channel layouts; never
+assume captured rows are packed. Keep matching off the main actor, serialize
+manual/auto/final captures, and retain the last successfully stitched reference
+when a match fails. Auto Scroll pauses on tracking loss or app changes and stops
+at page end or the size limit. Run
 `BETTERSHOT_CHECK_CAPTURE_UI=1 bash Tests/run-exports.sh` after a test build to
 check stitching and the compact capture controls in both appearances.
 Region screenshots use `RegionSelectionOverlay` with the previous area
@@ -381,6 +388,7 @@ with `make test` when production code changes.
 | Area | Command |
 | --- | --- |
 | Notch hover, preview actions, and compact/expanded snapshots | `BETTERSHOT_CHECK_NOTCH=1 bash Tests/run-exports.sh` |
+| Live scroll capture, automatic page-end detection, and ordered pixels (requires existing Screen Recording and Accessibility permissions) | `BETTERSHOT_CHECK_SCROLL_CAPTURE=1 bash Tests/run-exports.sh` |
 | ScreenCaptureKit window pixels, native resolution, staging, and preview in both modes (requires existing Screen Recording permission) | `BETTERSHOT_CHECK_WINDOW_CAPTURE=1 bash Tests/run-exports.sh` |
 | Screenshot Copy/Save and private storage | `BETTERSHOT_CHECK_SCREENSHOT_SAVING=1 bash Tests/run-exports.sh` |
 | Video compositing and encoded exports | `BETTERSHOT_CHECK_VIDEO_EXPORTS=1 bash Tests/run-exports.sh` |
```

**File**: `README.md` (modified, +11/-4)
```diff
@@ -106,12 +106,19 @@ Capture a page or list that is taller or wider than the screen. Choose
 (`⌘⇧2`), or assign a shortcut in **Settings > Shortcuts**. Drag over the
 scrollable content, then scroll through it as usual in one direction: down, or
 horizontally. The floating panel counts the stitched frames and the image's
-length. Click **Stop**, or trigger Scrolling Capture again, to send the image to
-the capture preview. **Cancel** discards it.
+length, with a live stitched preview beside the area when there is room.
+Choose **Auto Scroll** to scroll down automatically and **Pause Scroll** to resume
+manual scrolling. Click **Stop**, or trigger Scrolling Capture again, to send the
+image to the capture preview. **Cancel** or Escape discards it.
 
 Scroll at a steady pace so consecutive frames overlap. Fixed headers and
-scrollbars are detected and left out of the joins. A capture finishes on its own at
-30,000 pixels.
+scrollbars are detected and left out of the joins. Auto Scroll finishes at the
+bottom of the page; either mode finishes at 30,000 pixels. If tracking is lost,
+auto-scroll pauses so you can scroll back slightly and recover.
+
+Vision alignment, automatic scrolling, frame analysis, and the live preview are
+adapted from [MacShot](https://github.com/sw33tLie/macshot); its GPLv3 notice is
+bundled in [Resources/Licenses/MacShot.txt](Resources/Licenses/MacShot.txt).
 
 ### Where files go
 
```

**File**: `Resources/Licenses/MacShot.txt` (added, +685/-0)
```diff
@@ -0,0 +1,685 @@
+MacShot scroll capture
+Source: https://github.com/sw33tLie/macshot
+Source revision: 89219e1 (local checkout)
+Author: sw33tLie and MacShot contributors
+License: GNU General Public License, version 3 (GPLv3), as stated in MacShot's website/index.html.
+
+Adapted on 2026-09-25 for BetterShot: Vision registration, settled-frame capture,
+auto-scroll, ScrollFrameAnalyzer, preview panel and HUD placement. BetterShot
+uses ScreenCaptureKit and its existing horizontal stitching, private staging,
+and native controls. Modified files retain their source attribution.
+
+                    GNU GENERAL PUBLIC LICENSE
+                       Version 3, 29 June 2007
+
+ Copyright (C) 2007 Free Software Foundation, Inc. <https://fsf.org/>
+ Everyone is permitted to copy and distribute verbatim copies
+ of this license document, but changing it is not allowed.
+
+                            Preamble
+
+  The GNU General Public License is a free, copyleft license for
+software and other kinds of works.
+
+  The licenses for most software and other practical works are designed
+to take away your freedom to share and change the works.  By contrast,
+the GNU General Public License is intended to guarantee your freedom to
+share and change all versions of a program--to make sure it remains free
+software for all its users.  We, the Free Software Foundation, use the
+GNU General Public License for most of our software; it applies also to
+any other work released this way by its authors.  You can apply it to
+your programs, too.
+
+  When we speak of free software, we are referring to freedom, not
+price.  Our General Public Licenses are designed to make sure that you
+have the freedom to distribute copies of free software (and charge for
+them if you wish), that you receive source code or can get it if you
+want it, that you can change the software or use pieces of it in new
+free programs, and that you know you can do these things.
+
+  To protect your rights, we need to prevent others from denying you
+these rights or asking you to surrender the rights.  Therefore, you have
+certain responsibilities if you distribute copies of the software, or if
+you modify it: responsibilities to respect the freedom of others.
+
+  For example, if you distribute copies of such a program, whether
+gratis or for a fee, you must pass on to the recipients the same
+freedoms that you received.  You must make sure that they, too, receive
+or can get the source code.  And you must show them these terms so they
+know their rights.
+
+  Developers that use the GNU GPL protect your rights with two steps:
+(1) assert copyright on the software, and (2) offer you this License
+giving you legal permission to copy, distribute and/or modify it.
+
+  For the developers' and authors' protection, the GPL clearly explains
+that there is no warranty for this free software.  For both users' and
+authors' sake, the GPL requires that modified versions be marked as
+changed, so that their problems will not be attributed erroneously to
+authors of previous versions.
+
+  Some devices are designed to deny users access to install or run
+modified versions of the software inside them, although the manufacturer
+can do so.  This is fundamentally incompatible with the aim of
+protecting users' freedom to change the software.  The systematic
+pattern of such abuse occurs in the area of products for individuals to
+use, which is precisely where it is most unacceptable.  Therefore, we
+have designed this version of the GPL to prohibit the practice for those
+products.  If such problems arise substantially in other domains, we
+stand ready to extend this provision to those domains in future versions
+of the GPL, as needed to protect the freedom of users.
+
+  Finally, every program is threatened constantly by software patents.
+States should not allow patents to restrict development and use of
+software on general-purpose computers, but in those that do, we wish to
+avoid the special danger that patents applied to a free program could
+make it effectively proprietary.  To prevent this, the GPL assures that
+patents cannot be used to render the program non-free.
+
+  The precise terms and conditions for copying, distribution and
+modification follow.
+
+                       TERMS AND CONDITIONS
+
+  0. Definitions.
+
+  "This License" refers to version 3 of the GNU General Public License.
+
+  "Copyright" also means copyright-like laws that apply to other kinds of
+works, such as semiconductor masks.
+
+  "The Program" refers to any copyrightable work licensed under this
+License.  Each licensee is addressed as "you".  "Licensees" and
+"recipients" may be individuals or organizations.
+
+  To "modify" a work means to copy from or adapt all or part of the work
+in a fashion requiring copyright permission, other than the making of an
+exact copy.  The resulting work is called a "modified version" of the
+earlier work or a work "based on" the earlier work
```

**File**: `Sources/Capture/ScreenCapture.swift` (modified, +7/-21)
```diff
@@ -46,7 +46,7 @@ final class ScreenCapture {
         }
         args.append(tempPath)
 
-        let success = try await runScreencapture(args)
+        let success = try await runScreencapture(args, output: tempPath)
         guard success, FileManager.default.fileExists(atPath: tempPath) else { return nil }
         return URL(fileURLWithPath: tempPath)
     }
@@ -61,7 +61,7 @@ final class ScreenCapture {
 
         if nativeSelector {
             let tempPath = makeTempPath()
-            let success = try await runScreencapture(["-i", "-o", "-x", "-t", "png", tempPath])
+            let success = try await runScreencapture(["-i", "-o", "-x", "-t", "png", tempPath], output: tempPath)
             guard success, FileManager.default.fileExists(atPath: tempPath) else { return nil }
             return URL(fileURLWithPath: tempPath)
         }
@@ -88,7 +88,7 @@ final class ScreenCapture {
         try? await Task.sleep(for: .milliseconds(80))
         let tempPath = makeTempPath()
         let region = RegionGeometry.screencaptureArgument(pointsRect)
-        let success = try await runScreencapture(["-R", region, "-x", "-t", "png", tempPath])
+        let success = try await runScreencapture(["-R", region, "-x", "-t", "png", tempPath], output: tempPath)
         guard success, FileManager.default.fileExists(atPath: tempPath) else { return nil }
         return URL(fileURLWithPath: tempPath)
     }
@@ -205,24 +205,10 @@ final class ScreenCapture {
         ScreenshotFileNaming.scratchURL("Capture", extension: "png").path
     }
 
-    private func runScreencapture(_ arguments: [String]) async throws -> Bool {
-        try await withCheckedThrowingContinuation { continuation in
-            DispatchQueue.global(qos: .userInitiated).async {
-                let process = Process()
-                process.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
-                process.arguments = arguments
-                let errors = Pipe()
-                process.standardError = errors
-                do {
-                    try process.run()
-                    let data = errors.fileHandleForReading.readDataToEndOfFile()
-                    process.waitUntilExit()
-                    continuation.resume(returning: try Self.validateCommandResult(
-                        status: process.terminationStatus, diagnostic: String(decoding: data, as: UTF8.self)))
-                } catch {
-                    continuation.resume(throwing: error)
-                }
-            }
+    private func runScreencapture(_ arguments: [String], output: String) async throws -> Bool {
+        switch try await ScreencaptureRunner.run(arguments, output: output) {
+        case .saved: true
+        case let .exited(status, diagnostic): try Self.validateCommandResult(status: status, diagnostic: diagnostic)
         }
     }
 
```

**File**: `Sources/Capture/ScreencaptureRunner.swift` (added, +74/-0)
```diff
@@ -0,0 +1,74 @@
+import Foundation
+
+/// Runs `/usr/sbin/screencapture` for one PNG and reports as soon as the PNG is
+/// complete. After saving, screencapture tags the file for Spotlight and waits
+/// for the reply before exiting; a busy Spotlight holds that exit for up to
+/// 10 seconds. The exit status still decides cancellation and failures.
+nonisolated enum ScreencaptureRunner {
+    enum Outcome: Equatable, Sendable {
+        case saved
+        case exited(status: Int32, diagnostic: String)
+    }
+
+    static func run(_ arguments: [String], output: String,
+                    executable: URL = URL(fileURLWithPath: "/usr/sbin/screencapture")) async throws -> Outcome {
+        try await withCheckedThrowingContinuation { continuation in
+            DispatchQueue.global(qos: .userInitiated).async {
+                let process = Process()
+                process.executableURL = executable
+                process.arguments = arguments
+                let errors = Pipe()
+                process.standardError = errors
+                do {
+                    try process.run()
+                } catch {
+                    continuation.resume(throwing: error)
+                    return
+                }
+                let diagnostic = DiagnosticBuffer()
+                let drained = DispatchGroup()
+                drained.enter()
+                DispatchQueue.global(qos: .utility).async {
+                    diagnostic.set(errors.fileHandleForReading.readDataToEndOfFile())
+                    drained.leave()
+                }
+                var saved = false
+                while process.isRunning {
+                    if !saved, isCompletePNG(atPath: output) {
+                        saved = true
+                        continuation.resume(returning: .saved)
+                    }
+                    Thread.sleep(forTimeInterval: 0.05)
+                }
+                process.waitUntilExit()
+                guard !saved else { return }
+                drained.wait()
+                continuation.resume(returning: .exited(
+                    status: process.terminationStatus, diagnostic: diagnostic.string))
+            }
+        }
+    }
+
+    /// Holds stderr bytes drained on a background thread while the polling loop above runs.
+    private final class DiagnosticBuffer: @unchecked Sendable {
+        private let lock = NSLock()
+        private var data = Data()
+
+        func set(_ newData: Data) {
+            lock.withLock { data = newData }
+        }
+
+        var string: String {
+            lock.withLock { String(decoding: data, as: UTF8.self) }
+        }
+    }
+
+    /// A PNG always ends with its IEND chunk, so a file still being written does not.
+    static func isCompletePNG(atPath path: String) -> Bool {
+        guard let file = FileHandle(forReadingAtPath: path) else { return false }
+        defer { try? file.close() }
+        guard let size = try? file.seekToEnd(), size >= 12 else { return false }
+        try? file.seek(toOffset: size - 12)
+        return (try? file.read(upToCount: 12)) == Data([0, 0, 0, 0, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82])
+    }
+}
```

**File**: `Sources/Capture/ScrollCaptureController.swift` (modified, +238/-126)
```diff
@@ -1,10 +1,14 @@
 import Cocoa
 import ScreenCaptureKit
+import Vision
+
+// Scroll registration, settlement and auto-scroll adapted from MacShot (GPLv3).
+// See Resources/Licenses/MacShot.txt.
 
 @MainActor
 final class ScrollCaptureController {
 
-    enum ScrollDirection {
+    nonisolated enum ScrollDirection: Sendable {
         case down, right, left
 
         var isHorizontal: Bool { self != .down }
@@ -32,6 +36,12 @@ final class ScrollCaptureController {
 
     var excludedWindowIDs: [CGWindowID] = []
 
+    private(set) var autoScrollActive = false
+    var onAutoScrollChanged: ((Bool) -> Void)?
+    var onStatusMessage: ((String?) -> Void)?
+    private var autoScrollTask: Task<Void, Never>?
+    private var autoScrollSpeed = 3
+    private var targetAppPID: pid_t = 0
     private var maxScrollHeight: Int = 30000
     private var frozenDetectionEnabled: Bool = true
 
@@ -48,7 +58,6 @@ final class ScrollCaptureController {
     var isHorizontalCapture: Bool { scrollDirection?.isHorizontal == true }
     private var headerHeight: Int = 0
     private var headerDetectionDone: Bool = false
-    private var headerDetectionSamples: Int = 0
 
     private var rightMarginPx: Int = 0
     private var rightMarginDetected: Bool = false
@@ -81,11 +90,15 @@ final class ScrollCaptureController {
         maxScrollHeight = ud.object(forKey: "scrollMaxHeight") as? Int ?? 30000
         frozenDetectionEnabled = ud.object(forKey: "scrollFrozenDetection") as? Bool ?? true
 
+        autoScrollSpeed = min(4, max(1, ud.object(forKey: "scrollAutoScrollSpeed") as? Int ?? 3))
+        resolveTargetApp()
         cachedContentFilter = nil
 
         // Mark the session active before the first awaited frame so Stop can
         // cancel a capture that is still settling.
         isActive = true
+        isCapturing = true
+        defer { isCapturing = false }
 
         guard let firstFrame = await captureSettledFrame() else {
             if !isCancelled { finishSession(with: nil) }
@@ -98,7 +111,6 @@ final class ScrollCaptureController {
         prefersHorizontal = false
         headerHeight = 0
         headerDetectionDone = false
-        headerDetectionSamples = 0
         rightMarginPx = 0
         rightMarginDetected = false
         frozenTopHeight = 0
@@ -109,12 +121,15 @@ final class ScrollCaptureController {
         emitPreview()
         onStripAdded?(stripCount)
 
+        guard !isStopping else { return }
         startManualScrollMonitors()
+        if ud.bool(forKey: "scrollAutoScrollEnabled") { toggleAutoScroll() }
     }
 
     func stopSession() {
         guard isActive, !isStopping else { return }
         isStopping = true
+        stopAutoScroll()
         settlementTimer?.invalidate(); settlementTimer = nil
         if let monitor = scrollMonitorGlobal { NSEvent.removeMonitor(monitor); scrollMonitorGlobal = nil }
         if let monitor = scrollMonitorLocal { NSEvent.removeMonitor(monitor); scrollMonitorLocal = nil }
@@ -144,6 +159,7 @@ final class ScrollCaptureController {
 
     private func endSession() {
         isActive = false
+        stopAutoScroll()
         settlementTimer?.invalidate(); settlementTimer = nil
         if let monitor = scrollMonitorGlobal { NSEvent.removeMonitor(monitor); scrollMonitorGlobal = nil }
         if let monitor = scrollMonitorLocal { NSEvent.removeMonitor(monitor); scrollMonitorLocal = nil }
@@ -211,7 +227,7 @@ final class ScrollCaptureController {
         var waitNs: UInt64 = 10_000_000
 
         for _ in 0..<30 {
-            guard !isCancelled else { return nil }
+            guard !isCancelled, !Task.isCancelled else { return nil }
             guard let cg = await captureFrame() else {
                 try? await Task.sleep(nanoseconds: 30_000_000)
                 continue
@@ -223,7 +239,7 @@ final class ScrollCaptureController {
                     cont.resume(returning: bitmapRep.tiffRepresentation)
                 }
             }
-            guard !isCancelled else { return nil }
+            guard !isCancelled, !Task.isCancelled else { return nil }
             guard let currentTIFF = tiffData else {
                 try? await Task.sleep(nanoseconds: waitNs)
                 waitNs = min(waitNs * 3 / 2, 80_000_000)
@@ -245,7 +261,7 @@ final class ScrollCaptureController {
 
     @discardableResult
     private func processFrame(_ currentFrame: CGImage,
-                              allowAxisFallback: Bool = false) -> Bool {
+                              allowAxisFallback: Bool = false) async -> Bool {
         guard let previousFrame = shotA else { return false }
 
         if !rightMarginDetected {
@@ -260,24 +276,29 @@ final class ScrollCaptureController {
         } else {
             directionGroups = allowAxisFallback ? [[.down], [.right, .left]] : [[.down]]
         }
-        var chosen: (ScrollDirection, Int)?
-        for directions in directionGroups {
-            let matches = directions.compactMap { direction -> (ScrollD
```

---

### Incident Patch 11: `d52b71aa` (2026-09-25)
**Commit Message**: Merge pull request #168 from icanhasjonas/fix/screencapture-saved-early

fix: don't wait on Spotlight before a screenshot appears

**File**: `BetterShot.xcodeproj/project.pbxproj` (modified, +4/-0)
```diff
@@ -212,6 +212,7 @@
 		E129F8B6CE468246CA52897C /* AnnotationBackground.swift in Sources */ = {isa = PBXBuildFile; fileRef = FE35FD31C764306466AF2955 /* AnnotationBackground.swift */; };
 		E1DE7FE0CEBB164E662979EA /* AnnotationTextStyleControls.swift in Sources */ = {isa = PBXBuildFile; fileRef = DEDFDD9AD76A019ADE57581A /* AnnotationTextStyleControls.swift */; };
 		E29FA26E5F3F90C0653923E8 /* Assets.xcassets in Resources */ = {isa = PBXBuildFile; fileRef = B350EE68E3E974004660FC0A /* Assets.xcassets */; };
+		E5EC3D5ABA7F21EA6052C1A4 /* ScreencaptureRunner.swift in Sources */ = {isa = PBXBuildFile; fileRef = 279A657A2185919A48381A64 /* ScreencaptureRunner.swift */; };
 		E5F46E4A80BB763B20FF325D /* OnboardingState.swift in Sources */ = {isa = PBXBuildFile; fileRef = 497BE78596E45F13EA785993 /* OnboardingState.swift */; };
 		E70126BC766D72CFA1522996 /* AnnotationEditorModel.swift in Sources */ = {isa = PBXBuildFile; fileRef = 826D967E7F5D2962EFE34A29 /* AnnotationEditorModel.swift */; };
 		E9925479ADCF9DBD17407322 /* RecordingBarPresenter.swift in Sources */ = {isa = PBXBuildFile; fileRef = 5C57F353C924B2EAE57C53C0 /* RecordingBarPresenter.swift */; };
@@ -271,6 +272,7 @@
 		23F4D20DF3F0349735C2F80D /* RecordingProject.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = RecordingProject.swift; sourceTree = "<group>"; };
 		26E94949C3E83B5CA1C11F94 /* AnnotationCameraGeometry.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AnnotationCameraGeometry.swift; sourceTree = "<group>"; };
 		2770974B62BA6019294FC9BF /* ScreenshotImageLoader.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ScreenshotImageLoader.swift; sourceTree = "<group>"; };
+		279A657A2185919A48381A64 /* ScreencaptureRunner.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ScreencaptureRunner.swift; sourceTree = "<group>"; };
 		27B9B3F0836AF531CFB09F8C /* AnnoCanvasLayerView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AnnoCanvasLayerView.swift; sourceTree = "<group>"; };
 		293EA45B51DD6073E49641F4 /* AnnotationEditorWindow.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AnnotationEditorWindow.swift; sourceTree = "<group>"; };
 		297470BDCFA9440CC1AACDC6 /* BoringNotchHoverButton.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = BoringNotchHoverButton.swift; sourceTree = "<group>"; };
@@ -554,6 +556,7 @@
 				C2B128F33D1CBF0CBB6A6852 /* RegionGeometry.swift */,
 				868F0E1B6C8FC7DF50B4A79B /* RegionSelectionOverlay.swift */,
 				4495302A23BB2192D91C5ED3 /* ScreenCapture.swift */,
+				279A657A2185919A48381A64 /* ScreencaptureRunner.swift */,
 				797BDC98FC7C054D427684E4 /* ScrollCaptureController.swift */,
 				FDFB9ADE951E2EB3D7A4AB3D /* ScrollCapturePreviewPanel.swift */,
 				65090633B7C4C7E83B55DD7E /* ScrollCaptureSessionPresenter.swift */,
@@ -1103,6 +1106,7 @@
 				FD68955182A0F6FF6960A6AE /* ReleaseNotesWindowController.swift in Sources */,
 				615EE1453C9A7BDFD9248E09 /* ScreenCapture.swift in Sources */,
 				CB270F6BDD39E72E8CEE4F5D /* ScreenRecordingManager.swift in Sources */,
+				E5EC3D5ABA7F21EA6052C1A4 /* ScreencaptureRunner.swift in Sources */,
 				A069BBE1EEC909EAF7668718 /* ScreenshotCompressionService.swift in Sources */,
 				BACCC6CAD5B08E0987F79EE4 /* ScreenshotFileNaming.swift in Sources */,
 				118F7D00871572DFAF7B5E84 /* ScreenshotHistoryStore.swift in Sources */,
```

**File**: `Sources/Capture/ScreenCapture.swift` (modified, +7/-21)
```diff
@@ -46,7 +46,7 @@ final class ScreenCapture {
         }
         args.append(tempPath)
 
-        let success = try await runScreencapture(args)
+        let success = try await runScreencapture(args, output: tempPath)
         guard success, FileManager.default.fileExists(atPath: tempPath) else { return nil }
         return URL(fileURLWithPath: tempPath)
     }
@@ -61,7 +61,7 @@ final class ScreenCapture {
 
         if nativeSelector {
             let tempPath = makeTempPath()
-            let success = try await runScreencapture(["-i", "-o", "-x", "-t", "png", tempPath])
+            let success = try await runScreencapture(["-i", "-o", "-x", "-t", "png", tempPath], output: tempPath)
             guard success, FileManager.default.fileExists(atPath: tempPath) else { return nil }
             return URL(fileURLWithPath: tempPath)
         }
@@ -88,7 +88,7 @@ final class ScreenCapture {
         try? await Task.sleep(for: .milliseconds(80))
         let tempPath = makeTempPath()
         let region = RegionGeometry.screencaptureArgument(pointsRect)
-        let success = try await runScreencapture(["-R", region, "-x", "-t", "png", tempPath])
+        let success = try await runScreencapture(["-R", region, "-x", "-t", "png", tempPath], output: tempPath)
         guard success, FileManager.default.fileExists(atPath: tempPath) else { return nil }
         return URL(fileURLWithPath: tempPath)
     }
@@ -206,24 +206,10 @@ final class ScreenCapture {
         return "\(dir)bettershot_\(UUID().uuidString).png"
     }
 
-    private func runScreencapture(_ arguments: [String]) async throws -> Bool {
-        try await withCheckedThrowingContinuation { continuation in
-            DispatchQueue.global(qos: .userInitiated).async {
-                let process = Process()
-                process.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
-                process.arguments = arguments
-                let errors = Pipe()
-                process.standardError = errors
-                do {
-                    try process.run()
-                    let data = errors.fileHandleForReading.readDataToEndOfFile()
-                    process.waitUntilExit()
-                    continuation.resume(returning: try Self.validateCommandResult(
-                        status: process.terminationStatus, diagnostic: String(decoding: data, as: UTF8.self)))
-                } catch {
-                    continuation.resume(throwing: error)
-                }
-            }
+    private func runScreencapture(_ arguments: [String], output: String) async throws -> Bool {
+        switch try await ScreencaptureRunner.run(arguments, output: output) {
+        case .saved: true
+        case let .exited(status, diagnostic): try Self.validateCommandResult(status: status, diagnostic: diagnostic)
         }
     }
 
```

**File**: `Sources/Capture/ScreencaptureRunner.swift` (added, +74/-0)
```diff
@@ -0,0 +1,74 @@
+import Foundation
+
+/// Runs `/usr/sbin/screencapture` for one PNG and reports as soon as the PNG is
+/// complete. After saving, screencapture tags the file for Spotlight and waits
+/// for the reply before exiting; a busy Spotlight holds that exit for up to
+/// 10 seconds. The exit status still decides cancellation and failures.
+nonisolated enum ScreencaptureRunner {
+    enum Outcome: Equatable, Sendable {
+        case saved
+        case exited(status: Int32, diagnostic: String)
+    }
+
+    static func run(_ arguments: [String], output: String,
+                    executable: URL = URL(fileURLWithPath: "/usr/sbin/screencapture")) async throws -> Outcome {
+        try await withCheckedThrowingContinuation { continuation in
+            DispatchQueue.global(qos: .userInitiated).async {
+                let process = Process()
+                process.executableURL = executable
+                process.arguments = arguments
+                let errors = Pipe()
+                process.standardError = errors
+                do {
+                    try process.run()
+                } catch {
+                    continuation.resume(throwing: error)
+                    return
+                }
+                let diagnostic = DiagnosticBuffer()
+                let drained = DispatchGroup()
+                drained.enter()
+                DispatchQueue.global(qos: .utility).async {
+                    diagnostic.set(errors.fileHandleForReading.readDataToEndOfFile())
+                    drained.leave()
+                }
+                var saved = false
+                while process.isRunning {
+                    if !saved, isCompletePNG(atPath: output) {
+                        saved = true
+                        continuation.resume(returning: .saved)
+                    }
+                    Thread.sleep(forTimeInterval: 0.05)
+                }
+                process.waitUntilExit()
+                guard !saved else { return }
+                drained.wait()
+                continuation.resume(returning: .exited(
+                    status: process.terminationStatus, diagnostic: diagnostic.string))
+            }
+        }
+    }
+
+    /// Holds stderr bytes drained on a background thread while the polling loop above runs.
+    private final class DiagnosticBuffer: @unchecked Sendable {
+        private let lock = NSLock()
+        private var data = Data()
+
+        func set(_ newData: Data) {
+            lock.withLock { data = newData }
+        }
+
+        var string: String {
+            lock.withLock { String(decoding: data, as: UTF8.self) }
+        }
+    }
+
+    /// A PNG always ends with its IEND chunk, so a file still being written does not.
+    static func isCompletePNG(atPath path: String) -> Bool {
+        guard let file = FileHandle(forReadingAtPath: path) else { return false }
+        defer { try? file.close() }
+        guard let size = try? file.seekToEnd(), size >= 12 else { return false }
+        try? file.seek(toOffset: size - 12)
+        return (try? file.read(upToCount: 12)) == Data([0, 0, 0, 0, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82])
+    }
+}
```

**File**: `Tests/ScreencaptureRunnerCheck.sources` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Sources/Capture/ScreencaptureRunner.swift
```

**File**: `Tests/ScreencaptureRunnerCheck.swift` (added, +87/-0)
```diff
@@ -0,0 +1,87 @@
+import CoreGraphics
+import Foundation
+import ImageIO
+import UniformTypeIdentifiers
+
+/// Stands in for `screencapture` with shell scripts, so no capture runs.
+@main
+enum ScreencaptureRunnerCheck {
+    static func main() async throws {
+        armWatchdog(seconds: 20)
+
+        let dir = FileManager.default.temporaryDirectory
+            .appendingPathComponent("ScreencaptureRunnerCheck-\(UUID().uuidString)", isDirectory: true)
+        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
+        defer { try? FileManager.default.removeItem(at: dir) }
+        let png = dir.appendingPathComponent("fixture.png")
+        try writeFixture(to: png)
+
+        // screencapture saves the PNG, then can wait up to 10 s on Spotlight before exiting.
+        var output = dir.appendingPathComponent("saved.png").path
+        var start = Date()
+        var outcome = try await ScreencaptureRunner.run([output], output: output,
+            executable: script("cp '\(png.path)' \"$1\"; sleep 5", in: dir))
+        precondition(outcome == .saved, "a saved PNG reports saved, got \(outcome)")
+        precondition(Date().timeIntervalSince(start) < 2, "a saved PNG must not wait for the process to exit")
+
+        // A PNG still being written is not saved yet.
+        output = dir.appendingPathComponent("partial.png").path
+        outcome = try await ScreencaptureRunner.run([output], output: output,
+            executable: script("head -c 40 '\(png.path)' > \"$1\"; sleep 1; cp '\(png.path)' \"$1\"; sleep 5", in: dir))
+        precondition(outcome == .saved, "the completed PNG reports saved, got \(outcome)")
+        let written = try Data(contentsOf: URL(fileURLWithPath: output)), fixture = try Data(contentsOf: png)
+        precondition(written == fixture, "saved must wait until the PNG is complete")
+
+        // Cancelling writes nothing, so the exit status decides.
+        output = dir.appendingPathComponent("cancelled.png").path
+        start = Date()
+        outcome = try await ScreencaptureRunner.run([output], output: output,
+            executable: script("exit 1", in: dir))
+        precondition(outcome == .exited(status: 1, diagnostic: ""), "cancel reports the exit, got \(outcome)")
+
+        output = dir.appendingPathComponent("failed.png").path
+        outcome = try await ScreencaptureRunner.run([output], output: output,
+            executable: script("echo 'no permission' >&2; exit 2", in: dir))
+        precondition(outcome == .exited(status: 2, diagnostic: "no permission\n"), "failure keeps its diagnostic, got \(outcome)")
+
+        output = dir.appendingPathComponent("chatty.png").path
+        outcome = try await ScreencaptureRunner.run([output], output: output,
+            executable: script("yes 'this line pads the diagnostic well past one pipe buffer' | head -c 200000 >&2; exit 3", in: dir))
+        switch outcome {
+        case let .exited(status, diagnostic):
+            precondition(status == 3, "expected the child's exit status, got \(status)")
+            precondition(diagnostic.utf8.count >= 200_000, "expected the full overflow to be drained, got \(diagnostic.utf8.count) bytes")
+        case .saved:
+            preconditionFailure("a chatty child that never writes a PNG must not report saved")
+        }
+
+        print("ScreencaptureRunnerCheck passed")
+    }
+
+    /// Hard-exits the process if it runs longer than `seconds`, so a deadlocked runner fails the check instead of hanging the suite.
+    private static func armWatchdog(seconds: TimeInterval) {
+        Thread.detachNewThread {
+            Thread.sleep(forTimeInterval: seconds)
+            FileHandle.standardError.write(Data("ScreencaptureRunnerCheck timed out after \(Int(seconds))s\n".utf8))
+            exit(1)
+        }
+    }
+
+    private static func script(_ body: String, in dir: URL) throws -> URL {
+        let url = dir.appendingPathComponent("fake-\(UUID().uuidString).sh")
+        try "#!/bin/sh\n\(body)\n".write(to: url, atomically: true, encoding: .utf8)
+        try FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: url.path)
+        return url
+    }
+
+    private static func writeFixture(to url: URL) throws {
+        let context = CGContext(data: nil, width: 64, height: 64, bitsPerComponent: 8, bytesPerRow: 0,
+                                space: CGColorSpaceCreateDeviceRGB(),
+                                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
+        context.setFillColor(red: 0.2, green: 0.5, blue: 0.9, alpha: 1)
+        context.fill(CGRect(x: 0, y: 0, width: 64, height: 64))
+        let destination = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil)!
+        CGImageDestinationAddImage(destination, context.makeImage()!, nil)
+        guard CGImageDestinationFinalize(destination) else { throw CocoaError(.fileWriteUnknown) }
+    }
+}
```

---

### Incident Patch 12: `1aa2a50e` (2026-09-25)
**Commit Message**: Fix scrolling capture with MacShot registration and auto-scroll

**File**: `BetterShot.xcodeproj/project.pbxproj` (modified, +8/-0)
```diff
@@ -161,6 +161,7 @@
 		ADDDE18D5DA47F866E3C15C2 /* RecordingTranscriptEditing.swift in Sources */ = {isa = PBXBuildFile; fileRef = 4CCD4CBE6C2F68F14298572D /* RecordingTranscriptEditing.swift */; };
 		AECE06FCCA388F3C27CA5C9C /* RecordingExportReframe.swift in Sources */ = {isa = PBXBuildFile; fileRef = F02562FF53E7AE39E8DE3E81 /* RecordingExportReframe.swift */; };
 		B0D43AF92D661FDC828C1399 /* GeoPaths.swift in Sources */ = {isa = PBXBuildFile; fileRef = A077E702B85C092E049C33BA /* GeoPaths.swift */; };
+		B59A11814CC73A048E1A925D /* ScrollFrameAnalyzer.swift in Sources */ = {isa = PBXBuildFile; fileRef = 8566C51E6448E2BC40BD938A /* ScrollFrameAnalyzer.swift */; };
 		B67249B2788081263585AB5D /* RecordingExportOptions.swift in Sources */ = {isa = PBXBuildFile; fileRef = C7881A05DB7FD7C0160C3D30 /* RecordingExportOptions.swift */; };
 		B6A1C17303643E0C512127E3 /* RecordingTranscription.swift in Sources */ = {isa = PBXBuildFile; fileRef = CEC5745BD6B7DD30BD91DEA0 /* RecordingTranscription.swift */; };
 		B713F9D891DBC6B6756A4C71 /* RecordingStudioExporter.swift in Sources */ = {isa = PBXBuildFile; fileRef = 2E260FCA6C4E719CE4AE0F45 /* RecordingStudioExporter.swift */; };
@@ -170,6 +171,7 @@
 		BA2E35F115F67D7CA6DEE5A9 /* BetterShotApp.swift in Sources */ = {isa = PBXBuildFile; fileRef = F74F2F48E0775A96906E180F /* BetterShotApp.swift */; };
 		BA91FBAAB700FD8A1341F27D /* ScreenshotPreviewItem.swift in Sources */ = {isa = PBXBuildFile; fileRef = 0FC7A31E31203B3330CE5AA0 /* ScreenshotPreviewItem.swift */; };
 		BACCC6CAD5B08E0987F79EE4 /* ScreenshotFileNaming.swift in Sources */ = {isa = PBXBuildFile; fileRef = 4EC83F060B8C618716847D95 /* ScreenshotFileNaming.swift */; };
+		BC3024BE9954759663767B8D /* ScrollCapturePreviewPanel.swift in Sources */ = {isa = PBXBuildFile; fileRef = FDFB9ADE951E2EB3D7A4AB3D /* ScrollCapturePreviewPanel.swift */; };
 		BC6170740B05997D27830D0B /* RecordingKeystrokeCapture.swift in Sources */ = {isa = PBXBuildFile; fileRef = 8944EFA56AE64C38C83ED9E1 /* RecordingKeystrokeCapture.swift */; };
 		BC811FEA82E635D6292A80FD /* MenuBarContentView.swift in Sources */ = {isa = PBXBuildFile; fileRef = AE87F338892DCBFEA8FD7BDA /* MenuBarContentView.swift */; };
 		BC91FECA9CA43F0585BE1836 /* StudioInspectorTabs.swift in Sources */ = {isa = PBXBuildFile; fileRef = 7C6D5B9A6634007DC09C4A81 /* StudioInspectorTabs.swift */; };
@@ -358,6 +360,7 @@
 		7D6C3162472265AFC3EF722B /* NotchRecentCaptures.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = NotchRecentCaptures.swift; sourceTree = "<group>"; };
 		7DB9ADF51148B7B593827415 /* CountdownOverlay.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = CountdownOverlay.swift; sourceTree = "<group>"; };
 		826D967E7F5D2962EFE34A29 /* AnnotationEditorModel.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AnnotationEditorModel.swift; sourceTree = "<group>"; };
+		8566C51E6448E2BC40BD938A /* ScrollFrameAnalyzer.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ScrollFrameAnalyzer.swift; sourceTree = "<group>"; };
 		861CE2F486701322F7B4FAD3 /* R2Uploader.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = R2Uploader.swift; sourceTree = "<group>"; };
 		8629959CD33DDE1BF29CABCF /* MediaGalleryActions.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = MediaGalleryActions.swift; sourceTree = "<group>"; };
 		86308A7F5B1D769189631945 /* AnnotationMockupEffectsRenderer.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AnnotationMockupEffectsRenderer.swift; sourceTree = "<group>"; };
@@ -458,6 +461,7 @@
 		FA193D0606AD96AC7616D674 /* AnnotationBackgroundLayout.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AnnotationBackgroundLayout.swift; sourceTree = "<group>"; };
 		FBB04739A2E2BF3D541F2161 /* AnnotationBackgroundPreviewViews.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AnnotationBackgroundPreviewViews.swift; sourceTree = "<group>"; };
 		FCA325987B11058BD383F07F /* RecordingVideoMask.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = RecordingVideoMask.swift; sourceTree = "<group>"; };
+		FDFB9ADE951E2EB3D7A4AB3D /* ScrollCapturePreviewPanel.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ScrollCapturePreviewPanel.swift; sourceTree = "<group>"; };
 		FE35FD31C764306466AF2955 /* AnnotationBackground.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AnnotationBackground.swift; sourceTree = "<group>"; };
 		FF44DA79DA0F8C173F4D8299 /* RecordingOverlayEffects.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = RecordingOverlayEffects.swift; sourceTree = "<group>"; };
 /* End PBXFileReference section */
@@ -551,7 +555,9 @@
 				868F0E1B6C8FC7DF50B4A79B /* Regio
```

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 ### Fixed
 
 - **Region screenshots remember your last area again.** `⌘⇧4` and Area in the capture bar open BetterShot's selector with the previous area already selected, as in 0.4: press Return (or double-click inside it) to capture the same area again, drag its edges to resize it, or drag anywhere, even inside it, to draw a new area (so a full-screen previous area never blocks a new selection). Space still switches to window selection and Escape cancels. The app you were using regains focus before the shot, so its windows are captured as active. OCR keeps the native macOS selector.
-- **Scrolling capture stitches more reliably.** Pages with a pinned bottom bar (chat composer, cookie banner, tab bar) no longer stop after the first frame, and that bar appears once at the end instead of repeating between strips. Near-identical matches a pixel apart no longer make it skip frames.
+- **Rebuilt scrolling capture around MacShot's capture flow.** Added Vision-based alignment, Auto Scroll/Pause, a live stitched preview, Escape cancellation, and controls positioned beside the selection without hiding under the notch. Low-contrast pages now register movement, matching runs off the main thread, and frozen-header/scrollbar detection handles padded pixel rows and different channel layouts. Automatic scrolling stops at the page bottom and pauses if tracking is lost or you switch apps. Preserved horizontal capture, full-resolution PNGs, private staging, and pinned bottom bars appearing once at the end. Adapted from [MacShot](https://github.com/sw33tLie/macshot) under GPLv3.
 - Scrolling capture takes a new frame after every third of the area you scroll, so fast scrolling keeps enough overlap to stitch. If it still loses its place, the panel shows "Lost track. Scroll back a little, then slower." with a warning symbol and VoiceOver announces it; the message clears as soon as stitching resumes.
 - The capture bar no longer shows a dashed "A to capture again" rectangle that could not be moved, resized, or triggered. The previous area is now part of the selector itself, and Capture Previous Region (`⌘⇧1`) captures it without opening the selector.
 - Image and video editors open in a normal window after a screenshot or recording instead of entering full screen automatically. Use the window's green full-screen button to enter full screen, or turn on Settings > General > Editor > Open editors in full screen to restore automatic full screen.
```

**File**: `CONTRIBUTING.md` (modified, +9/-1)
```diff
@@ -147,7 +147,14 @@ Scrolling Capture is the `.scrollCapture` action: the menu bar, capture bar,
 shortcut, and `bettershot://capture/scroll` all reach it through
 `CaptureOrchestrator.performCapture`. It selects an area with
 `RegionSelectionOverlay` and uses `ScrollCaptureSessionPresenter` to Stop into
-that same private preview flow or Cancel without staging a file. Run
+that same private preview flow or Cancel/Escape without staging a file. MacShot's
+Vision registration, automatic scroll cycle, and live preview use the same
+controller and preserve ScreenCaptureKit exclusion/coordinate conversion.
+`ScrollFrameAnalyzer` compares native pixel strides and channel layouts; never
+assume captured rows are packed. Keep matching off the main actor, serialize
+manual/auto/final captures, and retain the last successfully stitched reference
+when a match fails. Auto Scroll pauses on tracking loss or app changes and stops
+at page end or the size limit. Run
 `BETTERSHOT_CHECK_CAPTURE_UI=1 bash Tests/run-exports.sh` after a test build to
 check stitching and the compact capture controls in both appearances.
 Region screenshots use `RegionSelectionOverlay` with the previous area
@@ -381,6 +388,7 @@ with `make test` when production code changes.
 | Area | Command |
 | --- | --- |
 | Notch hover, preview actions, and compact/expanded snapshots | `BETTERSHOT_CHECK_NOTCH=1 bash Tests/run-exports.sh` |
+| Live scroll capture, automatic page-end detection, and ordered pixels (requires existing Screen Recording and Accessibility permissions) | `BETTERSHOT_CHECK_SCROLL_CAPTURE=1 bash Tests/run-exports.sh` |
 | ScreenCaptureKit window pixels, native resolution, staging, and preview in both modes (requires existing Screen Recording permission) | `BETTERSHOT_CHECK_WINDOW_CAPTURE=1 bash Tests/run-exports.sh` |
 | Screenshot Copy/Save and private storage | `BETTERSHOT_CHECK_SCREENSHOT_SAVING=1 bash Tests/run-exports.sh` |
 | Video compositing and encoded exports | `BETTERSHOT_CHECK_VIDEO_EXPORTS=1 bash Tests/run-exports.sh` |
```

**File**: `README.md` (modified, +11/-4)
```diff
@@ -106,12 +106,19 @@ Capture a page or list that is taller or wider than the screen. Choose
 (`⌘⇧2`), or assign a shortcut in **Settings > Shortcuts**. Drag over the
 scrollable content, then scroll through it as usual in one direction: down, or
 horizontally. The floating panel counts the stitched frames and the image's
-length. Click **Stop**, or trigger Scrolling Capture again, to send the image to
-the capture preview. **Cancel** discards it.
+length, with a live stitched preview beside the area when there is room.
+Choose **Auto Scroll** to scroll down automatically and **Pause Scroll** to resume
+manual scrolling. Click **Stop**, or trigger Scrolling Capture again, to send the
+image to the capture preview. **Cancel** or Escape discards it.
 
 Scroll at a steady pace so consecutive frames overlap. Fixed headers and
-scrollbars are detected and left out of the joins. A capture finishes on its own at
-30,000 pixels.
+scrollbars are detected and left out of the joins. Auto Scroll finishes at the
+bottom of the page; either mode finishes at 30,000 pixels. If tracking is lost,
+auto-scroll pauses so you can scroll back slightly and recover.
+
+Vision alignment, automatic scrolling, frame analysis, and the live preview are
+adapted from [MacShot](https://github.com/sw33tLie/macshot); its GPLv3 notice is
+bundled in [Resources/Licenses/MacShot.txt](Resources/Licenses/MacShot.txt).
 
 ### Where files go
 
```

**File**: `Resources/Licenses/MacShot.txt` (added, +685/-0)
```diff
@@ -0,0 +1,685 @@
+MacShot scroll capture
+Source: https://github.com/sw33tLie/macshot
+Source revision: 89219e1 (local checkout)
+Author: sw33tLie and MacShot contributors
+License: GNU General Public License, version 3 (GPLv3), as stated in MacShot's website/index.html.
+
+Adapted on 2026-09-25 for BetterShot: Vision registration, settled-frame capture,
+auto-scroll, ScrollFrameAnalyzer, preview panel and HUD placement. BetterShot
+uses ScreenCaptureKit and its existing horizontal stitching, private staging,
+and native controls. Modified files retain their source attribution.
+
+                    GNU GENERAL PUBLIC LICENSE
+                       Version 3, 29 June 2007
+
+ Copyright (C) 2007 Free Software Foundation, Inc. <https://fsf.org/>
+ Everyone is permitted to copy and distribute verbatim copies
+ of this license document, but changing it is not allowed.
+
+                            Preamble
+
+  The GNU General Public License is a free, copyleft license for
+software and other kinds of works.
+
+  The licenses for most software and other practical works are designed
+to take away your freedom to share and change the works.  By contrast,
+the GNU General Public License is intended to guarantee your freedom to
+share and change all versions of a program--to make sure it remains free
+software for all its users.  We, the Free Software Foundation, use the
+GNU General Public License for most of our software; it applies also to
+any other work released this way by its authors.  You can apply it to
+your programs, too.
+
+  When we speak of free software, we are referring to freedom, not
+price.  Our General Public Licenses are designed to make sure that you
+have the freedom to distribute copies of free software (and charge for
+them if you wish), that you receive source code or can get it if you
+want it, that you can change the software or use pieces of it in new
+free programs, and that you know you can do these things.
+
+  To protect your rights, we need to prevent others from denying you
+these rights or asking you to surrender the rights.  Therefore, you have
+certain responsibilities if you distribute copies of the software, or if
+you modify it: responsibilities to respect the freedom of others.
+
+  For example, if you distribute copies of such a program, whether
+gratis or for a fee, you must pass on to the recipients the same
+freedoms that you received.  You must make sure that they, too, receive
+or can get the source code.  And you must show them these terms so they
+know their rights.
+
+  Developers that use the GNU GPL protect your rights with two steps:
+(1) assert copyright on the software, and (2) offer you this License
+giving you legal permission to copy, distribute and/or modify it.
+
+  For the developers' and authors' protection, the GPL clearly explains
+that there is no warranty for this free software.  For both users' and
+authors' sake, the GPL requires that modified versions be marked as
+changed, so that their problems will not be attributed erroneously to
+authors of previous versions.
+
+  Some devices are designed to deny users access to install or run
+modified versions of the software inside them, although the manufacturer
+can do so.  This is fundamentally incompatible with the aim of
+protecting users' freedom to change the software.  The systematic
+pattern of such abuse occurs in the area of products for individuals to
+use, which is precisely where it is most unacceptable.  Therefore, we
+have designed this version of the GPL to prohibit the practice for those
+products.  If such problems arise substantially in other domains, we
+stand ready to extend this provision to those domains in future versions
+of the GPL, as needed to protect the freedom of users.
+
+  Finally, every program is threatened constantly by software patents.
+States should not allow patents to restrict development and use of
+software on general-purpose computers, but in those that do, we wish to
+avoid the special danger that patents applied to a free program could
+make it effectively proprietary.  To prevent this, the GPL assures that
+patents cannot be used to render the program non-free.
+
+  The precise terms and conditions for copying, distribution and
+modification follow.
+
+                       TERMS AND CONDITIONS
+
+  0. Definitions.
+
+  "This License" refers to version 3 of the GNU General Public License.
+
+  "Copyright" also means copyright-like laws that apply to other kinds of
+works, such as semiconductor masks.
+
+  "The Program" refers to any copyrightable work licensed under this
+License.  Each licensee is addressed as "you".  "Licensees" and
+"recipients" may be individuals or organizations.
+
+  To "modify" a work means to copy from or adapt all or part of the work
+in a fashion requiring copyright permission, other than the making of an
+exact copy.  The resulting work is called a "modified version" of the
+earlier work or a work "based on" the earlier work
```

**File**: `Sources/Capture/ScrollCaptureController.swift` (modified, +238/-126)
```diff
@@ -1,10 +1,14 @@
 import Cocoa
 import ScreenCaptureKit
+import Vision
+
+// Scroll registration, settlement and auto-scroll adapted from MacShot (GPLv3).
+// See Resources/Licenses/MacShot.txt.
 
 @MainActor
 final class ScrollCaptureController {
 
-    enum ScrollDirection {
+    nonisolated enum ScrollDirection: Sendable {
         case down, right, left
 
         var isHorizontal: Bool { self != .down }
@@ -32,6 +36,12 @@ final class ScrollCaptureController {
 
     var excludedWindowIDs: [CGWindowID] = []
 
+    private(set) var autoScrollActive = false
+    var onAutoScrollChanged: ((Bool) -> Void)?
+    var onStatusMessage: ((String?) -> Void)?
+    private var autoScrollTask: Task<Void, Never>?
+    private var autoScrollSpeed = 3
+    private var targetAppPID: pid_t = 0
     private var maxScrollHeight: Int = 30000
     private var frozenDetectionEnabled: Bool = true
 
@@ -48,7 +58,6 @@ final class ScrollCaptureController {
     var isHorizontalCapture: Bool { scrollDirection?.isHorizontal == true }
     private var headerHeight: Int = 0
     private var headerDetectionDone: Bool = false
-    private var headerDetectionSamples: Int = 0
 
     private var rightMarginPx: Int = 0
     private var rightMarginDetected: Bool = false
@@ -81,11 +90,15 @@ final class ScrollCaptureController {
         maxScrollHeight = ud.object(forKey: "scrollMaxHeight") as? Int ?? 30000
         frozenDetectionEnabled = ud.object(forKey: "scrollFrozenDetection") as? Bool ?? true
 
+        autoScrollSpeed = min(4, max(1, ud.object(forKey: "scrollAutoScrollSpeed") as? Int ?? 3))
+        resolveTargetApp()
         cachedContentFilter = nil
 
         // Mark the session active before the first awaited frame so Stop can
         // cancel a capture that is still settling.
         isActive = true
+        isCapturing = true
+        defer { isCapturing = false }
 
         guard let firstFrame = await captureSettledFrame() else {
             if !isCancelled { finishSession(with: nil) }
@@ -98,7 +111,6 @@ final class ScrollCaptureController {
         prefersHorizontal = false
         headerHeight = 0
         headerDetectionDone = false
-        headerDetectionSamples = 0
         rightMarginPx = 0
         rightMarginDetected = false
         frozenTopHeight = 0
@@ -109,12 +121,15 @@ final class ScrollCaptureController {
         emitPreview()
         onStripAdded?(stripCount)
 
+        guard !isStopping else { return }
         startManualScrollMonitors()
+        if ud.bool(forKey: "scrollAutoScrollEnabled") { toggleAutoScroll() }
     }
 
     func stopSession() {
         guard isActive, !isStopping else { return }
         isStopping = true
+        stopAutoScroll()
         settlementTimer?.invalidate(); settlementTimer = nil
         if let monitor = scrollMonitorGlobal { NSEvent.removeMonitor(monitor); scrollMonitorGlobal = nil }
         if let monitor = scrollMonitorLocal { NSEvent.removeMonitor(monitor); scrollMonitorLocal = nil }
@@ -144,6 +159,7 @@ final class ScrollCaptureController {
 
     private func endSession() {
         isActive = false
+        stopAutoScroll()
         settlementTimer?.invalidate(); settlementTimer = nil
         if let monitor = scrollMonitorGlobal { NSEvent.removeMonitor(monitor); scrollMonitorGlobal = nil }
         if let monitor = scrollMonitorLocal { NSEvent.removeMonitor(monitor); scrollMonitorLocal = nil }
@@ -211,7 +227,7 @@ final class ScrollCaptureController {
         var waitNs: UInt64 = 10_000_000
 
         for _ in 0..<30 {
-            guard !isCancelled else { return nil }
+            guard !isCancelled, !Task.isCancelled else { return nil }
             guard let cg = await captureFrame() else {
                 try? await Task.sleep(nanoseconds: 30_000_000)
                 continue
@@ -223,7 +239,7 @@ final class ScrollCaptureController {
                     cont.resume(returning: bitmapRep.tiffRepresentation)
                 }
             }
-            guard !isCancelled else { return nil }
+            guard !isCancelled, !Task.isCancelled else { return nil }
             guard let currentTIFF = tiffData else {
                 try? await Task.sleep(nanoseconds: waitNs)
                 waitNs = min(waitNs * 3 / 2, 80_000_000)
@@ -245,7 +261,7 @@ final class ScrollCaptureController {
 
     @discardableResult
     private func processFrame(_ currentFrame: CGImage,
-                              allowAxisFallback: Bool = false) -> Bool {
+                              allowAxisFallback: Bool = false) async -> Bool {
         guard let previousFrame = shotA else { return false }
 
         if !rightMarginDetected {
@@ -260,24 +276,29 @@ final class ScrollCaptureController {
         } else {
             directionGroups = allowAxisFallback ? [[.down], [.right, .left]] : [[.down]]
         }
-        var chosen: (ScrollDirection, Int)?
-        for directions in directionGroups {
-            let matches = directions.compactMap { direction -> (ScrollD
```

**File**: `Sources/Capture/ScrollCapturePreviewPanel.swift` (added, +114/-0)
```diff
@@ -0,0 +1,114 @@
+// Adapted from MacShot (GPLv3); see Resources/Licenses/MacShot.txt.
+import Cocoa
+
+/// Floating panel that shows a live preview of the scroll capture as it progresses.
+/// Appears to the left or right of the capture region if there's enough space.
+/// Grows upward from the selection bottom and scales down at the visible screen edge.
+@MainActor
+final class ScrollCapturePreviewPanel: NSPanel {
+
+    private let imageView = NSImageView()
+    private let captureRect: NSRect
+    private let targetScreen: NSScreen
+    private let side: Side  // which side of the capture rect the preview appears on
+    private let previewWidth: CGFloat = 200
+    private let margin: CGFloat = 12
+    private let minHeight: CGFloat = 100
+    /// Half of the selection border stroke width (2.5pt during scroll capture).
+    /// The stroke is centered on the rect edge, so the visible bottom sits this far below minY.
+    private let selectionBorderOutset: CGFloat = 1.25
+
+    enum Side { case left, right }
+
+    init?(captureRect: NSRect, screen: NSScreen) {
+        self.captureRect = captureRect
+        self.targetScreen = screen
+
+        // Determine which side has more space
+        let spaceLeft = captureRect.minX - screen.visibleFrame.minX
+        let spaceRight = screen.visibleFrame.maxX - captureRect.maxX
+        let needed = previewWidth + margin * 2
+
+        if spaceRight >= needed {
+            side = .right
+        } else if spaceLeft >= needed {
+            side = .left
+        } else {
+            return nil  // not enough space on either side
+        }
+
+        // Initial frame — bottom-aligned with capture rect, grows upward
+        let x: CGFloat
+        switch side {
+        case .right: x = captureRect.maxX + margin
+        case .left:  x = captureRect.minX - margin - previewWidth
+        }
+        let initialHeight = minHeight
+        let y = captureRect.minY - selectionBorderOutset
+        let frame = NSRect(x: x, y: y, width: previewWidth, height: initialHeight)
+
+        super.init(contentRect: frame,
+                   styleMask: [.borderless, .nonactivatingPanel],
+                   backing: .buffered, defer: false)
+
+        isOpaque = false
+        backgroundColor = .clear
+        hasShadow = true
+        level = .floating
+        sharingType = .none
+        hidesOnDeactivate = false
+        collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
+        ignoresMouseEvents = true
+        isReleasedWhenClosed = false
+
+        // Just the image with rounded corners, no container chrome
+        let container = NSView(frame: NSRect(origin: .zero, size: frame.size))
+        container.wantsLayer = true
+        container.layer?.cornerRadius = 6
+        container.layer?.masksToBounds = true
+        container.autoresizingMask = [.width, .height]
+        contentView = container
+
+        imageView.frame = container.bounds
+        imageView.autoresizingMask = [.width, .height]
+        imageView.imageScaling = .scaleProportionallyUpOrDown
+        imageView.imageAlignment = .alignTop
+        container.addSubview(imageView)
+    }
+
+    required init?(coder: NSCoder) { fatalError() }
+
+    /// Update the preview with the latest stitched image.
+    func updatePreview(image: NSImage) {
+        imageView.image = image
+
+        let screenFrame = targetScreen.visibleFrame
+        let x: CGFloat
+        switch side {
+        case .right: x = captureRect.maxX + margin
+        case .left:  x = captureRect.minX - margin - previewWidth
+        }
+
+        // Anchor the bottom of the preview at the bottom of the capture rect,
+        // and grow upward. Clamp so it doesn't exceed the screen top.
+        let anchorBottom = max(screenFrame.minY + margin, min(captureRect.minY - selectionBorderOutset, screenFrame.maxY - minHeight - 20))
+        let ceilingY = screenFrame.maxY - 20  // small margin from screen top
+        let availableHeight = max(minHeight, ceilingY - anchorBottom)
+
+        // Desired height based on image aspect ratio
+        let imageAspect = image.size.height / max(1, image.size.width)
+        let contentWidth = previewWidth - 8
+        let desiredHeight = contentWidth * imageAspect + 8
+
+        // Clamp to available space — image scales down proportionally inside the view
+        let panelHeight = min(desiredHeight, availableHeight)
+
+        // Anchor bottom at capture rect bottom, grow upward
+        let panelBottom = anchorBottom + panelHeight <= ceilingY
+            ? anchorBottom
+            : ceilingY - panelHeight
+
+        let newFrame = NSRect(x: x, y: panelBottom, width: previewWidth, height: panelHeight)
+        setFrame(newFrame, display: true, animate: false)
+    }
+}
```

**File**: `Sources/Capture/ScrollCaptureSessionPresenter.swift` (modified, +85/-14)
```diff
@@ -14,6 +14,10 @@ final class ScrollCaptureSessionPresenter {
 
     private var controller: ScrollCaptureController?
     private var panel: NSPanel?
+    private var previewPanel: ScrollCapturePreviewPanel?
+    private var selectionPanel: NSPanel?
+    private var keyMonitorGlobal: Any?
+    private var keyMonitorLocal: Any?
     private var continuation: CheckedContinuation<Result, Never>?
 
     private init() {}
@@ -54,24 +58,69 @@ final class ScrollCaptureSessionPresenter {
             }
         }
 
-        present(model: model, on: screen)
-        controller.excludedWindowIDs = panel.map { [CGWindowID($0.windowNumber)] } ?? []
+        let outline = NSPanel(contentRect: rect.insetBy(dx: -1, dy: -1),
+            styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
+        outline.isOpaque = false
+        outline.backgroundColor = .clear
+        outline.hasShadow = false
+        outline.level = .floating
+        outline.sharingType = .none
+        outline.hidesOnDeactivate = false
+        outline.ignoresMouseEvents = true
+        outline.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
+        outline.contentView = NSHostingView(rootView: Rectangle()
+            .strokeBorder(Color.accentColor, lineWidth: 2).accessibilityHidden(true))
+        outline.orderFrontRegardless()
+        selectionPanel = outline
+        controller.onAutoScrollChanged = { active in model.isAutoScrolling = active }
+        controller.onStatusMessage = { message in model.statusMessage = message }
+        let preview = ScrollCapturePreviewPanel(captureRect: rect, screen: screen)
+        previewPanel = preview
+        controller.onPreviewUpdated = { [weak preview] image in
+            preview?.updatePreview(image: image)
+        }
+        preview?.orderFrontRegardless()
+        present(model: model, rect: rect, on: screen)
+        controller.excludedWindowIDs = [panel, previewPanel, selectionPanel].compactMap { $0.map { CGWindowID($0.windowNumber) } }
+        keyMonitorGlobal = NSEvent.addGlobalMonitorForEvents(matching: .keyDown) { [weak self] event in
+            if event.keyCode == 53 { self?.cancel() }
+        }
+        keyMonitorLocal = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
+            guard event.keyCode == 53 else { return event }
+            self?.cancel()
+            return nil
+        }
 
         return await withCheckedContinuation { continuation in
             self.continuation = continuation
             Task { await controller.startSession() }
         }
     }
 
-    private func present(model: ScrollCaptureSessionModel, on screen: NSScreen) {
+    private func cancel() {
+        controller?.cancelSession()
+        finish(.cancelled)
+    }
+
+    // MacShot's selection-relative HUD placement, including the notch-safe fallback.
+    static func panelFrame(size: NSSize, selection: NSRect, screenFrame: NSRect,
+                           visibleFrame: NSRect, topInset: CGFloat) -> NSRect {
+        var y = selection.minY - size.height - 6
+        if y < visibleFrame.minY + 4 { y = selection.maxY + 6 }
+        let topLimit = min(visibleFrame.maxY, screenFrame.maxY - topInset) - 4
+        y = max(visibleFrame.minY + 4, min(y, topLimit - size.height))
+        let x = max(visibleFrame.minX + 4,
+            min(selection.midX - size.width / 2, visibleFrame.maxX - size.width - 4))
+        return NSRect(x: x, y: y, width: size.width, height: size.height)
+    }
+
+    private func present(model: ScrollCaptureSessionModel, rect: NSRect, on screen: NSScreen) {
         let view = ScrollCaptureSessionView(model: model,
             stop: { [weak self] in self?.stop() },
-            cancel: { [weak self] in
-                self?.controller?.cancelSession()
-                self?.finish(.cancelled)
-            })
+            cancel: { [weak self] in self?.cancel() },
+            toggleAutoScroll: { [weak self] in self?.controller?.toggleAutoScroll() })
         let hostingView = NSHostingView(rootView: view)
-        let size = NSSize(width: 312, height: 116)
+        let size = NSSize(width: 312, height: 148)
         let panel = NSPanel(contentRect: NSRect(origin: .zero, size: size),
             styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
         panel.identifier = NSUserInterfaceItemIdentifier("BetterShot.ScrollCaptureControls")
@@ -84,8 +133,9 @@ final class ScrollCaptureSessionPresenter {
         panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
         panel.isMovableByWindowBackground = true
         panel.contentView = hostingView
-        panel.setFrameOrigin(CGPoint(x: screen.visibleFrame.maxX - size.width - 16,
-                                   y: screen.visibleFrame.maxY - size.height - 16))
+        panel.setFrame(Self.panelFrame(size: size, selection: rect,
+            screenFrame: screen.frame, visibleFrame: screen.visibleF
```

---

### Incident Patch 13: `686c2cbe` (2026-09-25)
**Commit Message**: Merge remote-tracking branch 'origin/main' into fix/clipboard-file-names

**File**: `README.md` (modified, +2/-0)
```diff
@@ -163,6 +163,8 @@ Sharing is optional and uses a Cloudflare R2 bucket you own.
    [API token](https://developers.cloudflare.com/r2/api/tokens/) with
    Object Read & Write access to that bucket.
 2. Enter your credentials in **Settings > Sharing** and click **Test Connection**.
+   A successful test turns on **Upload when I share**; while it is off, Share
+   uploads nothing.
 3. Click **Share** on any capture to upload it and copy the link.
 
 Credentials are stored in your login Keychain. Links open a viewer on
```

**File**: `Sources/BetterShot/AnnotationEditorWindow.swift` (modified, +1/-1)
```diff
@@ -355,7 +355,7 @@ struct AnnotationEditorWindow: View {
             if model.isCropping {
                 CropResolutionBadge(size: model.cropPixelSize)
             } else {
-                if CloudUploader.shared.isConfigured {
+                if CloudUploader.shared.canShare {
                     CloudUploadButton(
                         suggestedTitle: model.sourceURL?.deletingPathExtension().lastPathComponent ?? "",
                         onUpload: uploadAnnotation, shortcutAction: .imageShare
```

**File**: `Sources/BetterShot/CloudUploader.swift` (modified, +2/-2)
```diff
@@ -27,8 +27,8 @@ final class CloudUploader {
 
     private init() {}
 
-    var isConfigured: Bool {
-        R2CredentialStore.shared.isConfigured
+    var canShare: Bool {
+        R2CredentialStore.shared.canShare
     }
 
     /// Progress keyed by item ID; only the network leg reports, the local
```

**File**: `Sources/BetterShot/RecordingStudioModel.swift` (modified, +1/-1)
```diff
@@ -2597,7 +2597,7 @@ final class RecordingStudioModel {
     // MARK: - Share to cloud
 
     var canShareToCloud: Bool {
-        CloudUploader.shared.isConfigured
+        CloudUploader.shared.canShare
     }
 
     /// The Loom loop: render the current edits, cache the result as the
```

**File**: `Sources/Preview/PreviewOverlay.swift` (modified, +7/-4)
```diff
@@ -254,9 +254,12 @@ final class PreviewOverlay {
         if !items.contains(url) { show(url: url, automaticallyDismiss: false) }
         cancelScheduledDismiss(for: url)
         toastURL = url
-        guard CloudUploader.shared.isConfigured else {
-            shareStatuses[url] = .failed(headline: "Set up cloud sharing",
-                message: "Add your cloud account in Settings \u{2192} Sharing, then try again.", canRetry: true)
+        guard CloudUploader.shared.canShare else {
+            shareStatuses[url] = R2CredentialStore.shared.isConfigured
+                ? .failed(headline: "Uploads are off",
+                    message: "Turn on Upload when I share in Settings \u{2192} Sharing, then try again.", canRetry: true)
+                : .failed(headline: "Set up cloud sharing",
+                    message: "Add your cloud account in Settings \u{2192} Sharing, then try again.", canRetry: true)
             return
         }
         let savedURL = DeckStaging.retain(url)
@@ -548,7 +551,7 @@ struct PreviewCardView: View {
                     onCancel: { overlay.cancelShare(for: url) },
                     onRetry: { overlay.share(url) },
                     onDismiss: { overlay.dismissShareStatus(for: url) }, compactSize: cardSize,
-                    onSettings: CloudUploader.shared.isConfigured ? nil : {
+                    onSettings: CloudUploader.shared.canShare ? nil : {
                         SettingsWindowController.shared.open(section: .sharing)
                     })
             } else if let image = thumbnail {
```

**File**: `Sources/Sharing/R2CredentialStore.swift` (modified, +22/-1)
```diff
@@ -14,6 +14,12 @@ struct R2Credentials: Sendable {
     var isConfigured: Bool {
         !accountID.isEmpty && !bucket.isEmpty && !publicBaseURL.isEmpty && !accessKeyID.isEmpty && !secretAccessKey.isEmpty
     }
+
+    /// Why Share must not upload; nil when it may. "Upload when I share" is the consent to publish.
+    var shareBlocker: String? {
+        if !isConfigured { return "R2 sharing is not configured. Add your credentials in Settings > Sharing." }
+        return enabled ? nil : "Uploads are off. Turn on Upload when I share in Settings > Sharing."
+    }
 }
 
 /// Keychain-backed R2 config: secrets go to the Keychain, non-secret settings to UserDefaults.
@@ -33,6 +39,7 @@ final class R2CredentialStore {
         static let publicBaseURL = "bs_r2_publicBaseURL"
         static let useDirectLinks = "bs_r2_useDirectLinks"
         static let enabled = "bs_r2_enabled"
+        static let enabledMigrated = "bs_r2_enabledMigrated"
         static let accessKeyID = "accessKeyID"
         static let secretAccessKey = "secretAccessKey"
     }
@@ -116,6 +123,13 @@ final class R2CredentialStore {
         !_accountID.isEmpty && !_bucket.isEmpty && !_publicBaseURL.isEmpty && !_accessKeyID.isEmpty && !_secretAccessKey.isEmpty
     }
 
+    var canShare: Bool { snapshot().shareBlocker == nil }
+
+    /// 0.4.3-0.5.6 installs saved keys without writing the toggle; the first launch of this build turns those on once, and any later missing value means OFF.
+    nonisolated static func resolvedEnabled(stored: Bool?, hasKeys: Bool, hasMigrated: Bool = false) -> Bool {
+        stored ?? (hasMigrated ? false : hasKeys)
+    }
+
     func snapshot() -> R2Credentials {
         R2Credentials(
             accountID: _accountID,
@@ -133,13 +147,20 @@ final class R2CredentialStore {
         _bucket = defaults.string(forKey: Keys.bucket) ?? ""
         _publicBaseURL = defaults.string(forKey: Keys.publicBaseURL) ?? ""
         _useDirectLinks = defaults.bool(forKey: Keys.useDirectLinks)
-        _enabled = defaults.bool(forKey: Keys.enabled)
 
         let accessKey = Self.getKeychainItem(key: Keys.accessKeyID)
         let secret = Self.getKeychainItem(key: Keys.secretAccessKey)
         _accessKeyID = accessKey.value ?? ""
         _secretAccessKey = secret.value ?? ""
         keychainAccess = Self.access(of: [accessKey.status, secret.status])
+
+        let storedEnabled = defaults.object(forKey: Keys.enabled) as? Bool
+        let hasMigrated = defaults.bool(forKey: Keys.enabledMigrated)
+        _enabled = Self.resolvedEnabled(stored: storedEnabled, hasKeys: isConfigured, hasMigrated: hasMigrated)
+        if !hasMigrated {
+            defaults.set(_enabled, forKey: Keys.enabled)
+            defaults.set(true, forKey: Keys.enabledMigrated)
+        }
     }
 
     /// Wipes the stored keys so the next save writes a fresh item owned by this build, which is the only way past an access list a re-signed app no longer matches.
```

**File**: `Sources/Sharing/R2Uploader.swift` (modified, +2/-2)
```diff
@@ -130,8 +130,8 @@ final class R2Uploader {
 
     func uploadShare(itemID: UUID, fileURL: URL, title: String?) async throws -> URL {
         let credentials = R2CredentialStore.shared.snapshot()
-        guard credentials.isConfigured else {
-            throw R2UploadError(message: "R2 sharing is not configured. Add your credentials in Settings > Sharing.")
+        if let blocker = credentials.shareBlocker {
+            throw R2UploadError(message: blocker)
         }
 
         uploadingItems.insert(itemID)
```

**File**: `Tests/EditorUIIntegration.swift` (modified, +1/-1)
```diff
@@ -1911,7 +1911,7 @@ private func checkPreviewOverlay(imageURL: URL) async throws {
     AppPreferences.overlayCardSize = .large
     overlay.refreshSettings()
     precondition(panel.frame.width > originalWidth, "Changing Overlay settings must resize an existing overlay")
-    precondition(!CloudUploader.shared.isConfigured, "Tests must not access R2 credentials")
+    precondition(!R2CredentialStore.shared.isConfigured, "Tests must not access R2 credentials")
     overlay.share(imageURL)
     guard case .failed(_, _, true) = overlay.transferStatus(for: imageURL) else {
         preconditionFailure("An unconfigured share must offer recovery")
```

---

### Incident Patch 14: `e2c51874` (2026-09-25)
**Commit Message**: Merge remote-tracking branch 'origin/main' into fix/screencapture-saved-early

**File**: `README.md` (modified, +2/-0)
```diff
@@ -158,6 +158,8 @@ Sharing is optional and uses a Cloudflare R2 bucket you own.
    [API token](https://developers.cloudflare.com/r2/api/tokens/) with
    Object Read & Write access to that bucket.
 2. Enter your credentials in **Settings > Sharing** and click **Test Connection**.
+   A successful test turns on **Upload when I share**; while it is off, Share
+   uploads nothing.
 3. Click **Share** on any capture to upload it and copy the link.
 
 Credentials are stored in your login Keychain. Links open a viewer on
```

**File**: `Sources/BetterShot/AnnotationEditorWindow.swift` (modified, +1/-1)
```diff
@@ -355,7 +355,7 @@ struct AnnotationEditorWindow: View {
             if model.isCropping {
                 CropResolutionBadge(size: model.cropPixelSize)
             } else {
-                if CloudUploader.shared.isConfigured {
+                if CloudUploader.shared.canShare {
                     CloudUploadButton(
                         suggestedTitle: model.sourceURL?.deletingPathExtension().lastPathComponent ?? "",
                         onUpload: uploadAnnotation, shortcutAction: .imageShare
```

**File**: `Sources/BetterShot/CloudUploader.swift` (modified, +2/-2)
```diff
@@ -27,8 +27,8 @@ final class CloudUploader {
 
     private init() {}
 
-    var isConfigured: Bool {
-        R2CredentialStore.shared.isConfigured
+    var canShare: Bool {
+        R2CredentialStore.shared.canShare
     }
 
     /// Progress keyed by item ID; only the network leg reports, the local
```

**File**: `Sources/BetterShot/RecordingStudioModel.swift` (modified, +1/-1)
```diff
@@ -2598,7 +2598,7 @@ final class RecordingStudioModel {
     // MARK: - Share to cloud
 
     var canShareToCloud: Bool {
-        CloudUploader.shared.isConfigured
+        CloudUploader.shared.canShare
     }
 
     /// The Loom loop: render the current edits, cache the result as the
```

**File**: `Sources/Preview/PreviewOverlay.swift` (modified, +7/-4)
```diff
@@ -254,9 +254,12 @@ final class PreviewOverlay {
         if !items.contains(url) { show(url: url, automaticallyDismiss: false) }
         cancelScheduledDismiss(for: url)
         toastURL = url
-        guard CloudUploader.shared.isConfigured else {
-            shareStatuses[url] = .failed(headline: "Set up cloud sharing",
-                message: "Add your cloud account in Settings \u{2192} Sharing, then try again.", canRetry: true)
+        guard CloudUploader.shared.canShare else {
+            shareStatuses[url] = R2CredentialStore.shared.isConfigured
+                ? .failed(headline: "Uploads are off",
+                    message: "Turn on Upload when I share in Settings \u{2192} Sharing, then try again.", canRetry: true)
+                : .failed(headline: "Set up cloud sharing",
+                    message: "Add your cloud account in Settings \u{2192} Sharing, then try again.", canRetry: true)
             return
         }
         let savedURL = DeckStaging.retain(url)
@@ -547,7 +550,7 @@ struct PreviewCardView: View {
                     onCancel: { overlay.cancelShare(for: url) },
                     onRetry: { overlay.share(url) },
                     onDismiss: { overlay.dismissShareStatus(for: url) }, compactSize: cardSize,
-                    onSettings: CloudUploader.shared.isConfigured ? nil : {
+                    onSettings: CloudUploader.shared.canShare ? nil : {
                         SettingsWindowController.shared.open(section: .sharing)
                     })
             } else if let image = thumbnail {
```

**File**: `Sources/Sharing/R2CredentialStore.swift` (modified, +22/-1)
```diff
@@ -14,6 +14,12 @@ struct R2Credentials: Sendable {
     var isConfigured: Bool {
         !accountID.isEmpty && !bucket.isEmpty && !publicBaseURL.isEmpty && !accessKeyID.isEmpty && !secretAccessKey.isEmpty
     }
+
+    /// Why Share must not upload; nil when it may. "Upload when I share" is the consent to publish.
+    var shareBlocker: String? {
+        if !isConfigured { return "R2 sharing is not configured. Add your credentials in Settings > Sharing." }
+        return enabled ? nil : "Uploads are off. Turn on Upload when I share in Settings > Sharing."
+    }
 }
 
 /// Keychain-backed R2 config: secrets go to the Keychain, non-secret settings to UserDefaults.
@@ -33,6 +39,7 @@ final class R2CredentialStore {
         static let publicBaseURL = "bs_r2_publicBaseURL"
         static let useDirectLinks = "bs_r2_useDirectLinks"
         static let enabled = "bs_r2_enabled"
+        static let enabledMigrated = "bs_r2_enabledMigrated"
         static let accessKeyID = "accessKeyID"
         static let secretAccessKey = "secretAccessKey"
     }
@@ -116,6 +123,13 @@ final class R2CredentialStore {
         !_accountID.isEmpty && !_bucket.isEmpty && !_publicBaseURL.isEmpty && !_accessKeyID.isEmpty && !_secretAccessKey.isEmpty
     }
 
+    var canShare: Bool { snapshot().shareBlocker == nil }
+
+    /// 0.4.3-0.5.6 installs saved keys without writing the toggle; the first launch of this build turns those on once, and any later missing value means OFF.
+    nonisolated static func resolvedEnabled(stored: Bool?, hasKeys: Bool, hasMigrated: Bool = false) -> Bool {
+        stored ?? (hasMigrated ? false : hasKeys)
+    }
+
     func snapshot() -> R2Credentials {
         R2Credentials(
             accountID: _accountID,
@@ -133,13 +147,20 @@ final class R2CredentialStore {
         _bucket = defaults.string(forKey: Keys.bucket) ?? ""
         _publicBaseURL = defaults.string(forKey: Keys.publicBaseURL) ?? ""
         _useDirectLinks = defaults.bool(forKey: Keys.useDirectLinks)
-        _enabled = defaults.bool(forKey: Keys.enabled)
 
         let accessKey = Self.getKeychainItem(key: Keys.accessKeyID)
         let secret = Self.getKeychainItem(key: Keys.secretAccessKey)
         _accessKeyID = accessKey.value ?? ""
         _secretAccessKey = secret.value ?? ""
         keychainAccess = Self.access(of: [accessKey.status, secret.status])
+
+        let storedEnabled = defaults.object(forKey: Keys.enabled) as? Bool
+        let hasMigrated = defaults.bool(forKey: Keys.enabledMigrated)
+        _enabled = Self.resolvedEnabled(stored: storedEnabled, hasKeys: isConfigured, hasMigrated: hasMigrated)
+        if !hasMigrated {
+            defaults.set(_enabled, forKey: Keys.enabled)
+            defaults.set(true, forKey: Keys.enabledMigrated)
+        }
     }
 
     /// Wipes the stored keys so the next save writes a fresh item owned by this build, which is the only way past an access list a re-signed app no longer matches.
```

**File**: `Sources/Sharing/R2Uploader.swift` (modified, +2/-2)
```diff
@@ -130,8 +130,8 @@ final class R2Uploader {
 
     func uploadShare(itemID: UUID, fileURL: URL, title: String?) async throws -> URL {
         let credentials = R2CredentialStore.shared.snapshot()
-        guard credentials.isConfigured else {
-            throw R2UploadError(message: "R2 sharing is not configured. Add your credentials in Settings > Sharing.")
+        if let blocker = credentials.shareBlocker {
+            throw R2UploadError(message: blocker)
         }
 
         uploadingItems.insert(itemID)
```

**File**: `Tests/EditorUIIntegration.swift` (modified, +1/-1)
```diff
@@ -1909,7 +1909,7 @@ private func checkPreviewOverlay(imageURL: URL) async throws {
     AppPreferences.overlayCardSize = .large
     overlay.refreshSettings()
     precondition(panel.frame.width > originalWidth, "Changing Overlay settings must resize an existing overlay")
-    precondition(!CloudUploader.shared.isConfigured, "Tests must not access R2 credentials")
+    precondition(!R2CredentialStore.shared.isConfigured, "Tests must not access R2 credentials")
     overlay.share(imageURL)
     guard case .failed(_, _, true) = overlay.transferStatus(for: imageURL) else {
         preconditionFailure("An unconfigured share must offer recovery")
```

---

### Incident Patch 15: `e8f1eb3e` (2026-09-25)
**Commit Message**: Merge pull request #163 from icanhasjonas/fix/honor-upload-toggle

fix: honor the upload toggle when sharing

**File**: `README.md` (modified, +2/-0)
```diff
@@ -158,6 +158,8 @@ Sharing is optional and uses a Cloudflare R2 bucket you own.
    [API token](https://developers.cloudflare.com/r2/api/tokens/) with
    Object Read & Write access to that bucket.
 2. Enter your credentials in **Settings > Sharing** and click **Test Connection**.
+   A successful test turns on **Upload when I share**; while it is off, Share
+   uploads nothing.
 3. Click **Share** on any capture to upload it and copy the link.
 
 Credentials are stored in your login Keychain. Links open a viewer on
```

**File**: `Sources/BetterShot/AnnotationEditorWindow.swift` (modified, +1/-1)
```diff
@@ -355,7 +355,7 @@ struct AnnotationEditorWindow: View {
             if model.isCropping {
                 CropResolutionBadge(size: model.cropPixelSize)
             } else {
-                if CloudUploader.shared.isConfigured {
+                if CloudUploader.shared.canShare {
                     CloudUploadButton(
                         suggestedTitle: model.sourceURL?.deletingPathExtension().lastPathComponent ?? "",
                         onUpload: uploadAnnotation, shortcutAction: .imageShare
```

**File**: `Sources/BetterShot/CloudUploader.swift` (modified, +2/-2)
```diff
@@ -27,8 +27,8 @@ final class CloudUploader {
 
     private init() {}
 
-    var isConfigured: Bool {
-        R2CredentialStore.shared.isConfigured
+    var canShare: Bool {
+        R2CredentialStore.shared.canShare
     }
 
     /// Progress keyed by item ID; only the network leg reports, the local
```

**File**: `Sources/BetterShot/RecordingStudioModel.swift` (modified, +1/-1)
```diff
@@ -2598,7 +2598,7 @@ final class RecordingStudioModel {
     // MARK: - Share to cloud
 
     var canShareToCloud: Bool {
-        CloudUploader.shared.isConfigured
+        CloudUploader.shared.canShare
     }
 
     /// The Loom loop: render the current edits, cache the result as the
```

**File**: `Sources/Preview/PreviewOverlay.swift` (modified, +7/-4)
```diff
@@ -254,9 +254,12 @@ final class PreviewOverlay {
         if !items.contains(url) { show(url: url, automaticallyDismiss: false) }
         cancelScheduledDismiss(for: url)
         toastURL = url
-        guard CloudUploader.shared.isConfigured else {
-            shareStatuses[url] = .failed(headline: "Set up cloud sharing",
-                message: "Add your cloud account in Settings \u{2192} Sharing, then try again.", canRetry: true)
+        guard CloudUploader.shared.canShare else {
+            shareStatuses[url] = R2CredentialStore.shared.isConfigured
+                ? .failed(headline: "Uploads are off",
+                    message: "Turn on Upload when I share in Settings \u{2192} Sharing, then try again.", canRetry: true)
+                : .failed(headline: "Set up cloud sharing",
+                    message: "Add your cloud account in Settings \u{2192} Sharing, then try again.", canRetry: true)
             return
         }
         let savedURL = DeckStaging.retain(url)
@@ -547,7 +550,7 @@ struct PreviewCardView: View {
                     onCancel: { overlay.cancelShare(for: url) },
                     onRetry: { overlay.share(url) },
                     onDismiss: { overlay.dismissShareStatus(for: url) }, compactSize: cardSize,
-                    onSettings: CloudUploader.shared.isConfigured ? nil : {
+                    onSettings: CloudUploader.shared.canShare ? nil : {
                         SettingsWindowController.shared.open(section: .sharing)
                     })
             } else if let image = thumbnail {
```

**File**: `Sources/Sharing/R2CredentialStore.swift` (modified, +22/-1)
```diff
@@ -14,6 +14,12 @@ struct R2Credentials: Sendable {
     var isConfigured: Bool {
         !accountID.isEmpty && !bucket.isEmpty && !publicBaseURL.isEmpty && !accessKeyID.isEmpty && !secretAccessKey.isEmpty
     }
+
+    /// Why Share must not upload; nil when it may. "Upload when I share" is the consent to publish.
+    var shareBlocker: String? {
+        if !isConfigured { return "R2 sharing is not configured. Add your credentials in Settings > Sharing." }
+        return enabled ? nil : "Uploads are off. Turn on Upload when I share in Settings > Sharing."
+    }
 }
 
 /// Keychain-backed R2 config: secrets go to the Keychain, non-secret settings to UserDefaults.
@@ -33,6 +39,7 @@ final class R2CredentialStore {
         static let publicBaseURL = "bs_r2_publicBaseURL"
         static let useDirectLinks = "bs_r2_useDirectLinks"
         static let enabled = "bs_r2_enabled"
+        static let enabledMigrated = "bs_r2_enabledMigrated"
         static let accessKeyID = "accessKeyID"
         static let secretAccessKey = "secretAccessKey"
     }
@@ -116,6 +123,13 @@ final class R2CredentialStore {
         !_accountID.isEmpty && !_bucket.isEmpty && !_publicBaseURL.isEmpty && !_accessKeyID.isEmpty && !_secretAccessKey.isEmpty
     }
 
+    var canShare: Bool { snapshot().shareBlocker == nil }
+
+    /// 0.4.3-0.5.6 installs saved keys without writing the toggle; the first launch of this build turns those on once, and any later missing value means OFF.
+    nonisolated static func resolvedEnabled(stored: Bool?, hasKeys: Bool, hasMigrated: Bool = false) -> Bool {
+        stored ?? (hasMigrated ? false : hasKeys)
+    }
+
     func snapshot() -> R2Credentials {
         R2Credentials(
             accountID: _accountID,
@@ -133,13 +147,20 @@ final class R2CredentialStore {
         _bucket = defaults.string(forKey: Keys.bucket) ?? ""
         _publicBaseURL = defaults.string(forKey: Keys.publicBaseURL) ?? ""
         _useDirectLinks = defaults.bool(forKey: Keys.useDirectLinks)
-        _enabled = defaults.bool(forKey: Keys.enabled)
 
         let accessKey = Self.getKeychainItem(key: Keys.accessKeyID)
         let secret = Self.getKeychainItem(key: Keys.secretAccessKey)
         _accessKeyID = accessKey.value ?? ""
         _secretAccessKey = secret.value ?? ""
         keychainAccess = Self.access(of: [accessKey.status, secret.status])
+
+        let storedEnabled = defaults.object(forKey: Keys.enabled) as? Bool
+        let hasMigrated = defaults.bool(forKey: Keys.enabledMigrated)
+        _enabled = Self.resolvedEnabled(stored: storedEnabled, hasKeys: isConfigured, hasMigrated: hasMigrated)
+        if !hasMigrated {
+            defaults.set(_enabled, forKey: Keys.enabled)
+            defaults.set(true, forKey: Keys.enabledMigrated)
+        }
     }
 
     /// Wipes the stored keys so the next save writes a fresh item owned by this build, which is the only way past an access list a re-signed app no longer matches.
```

**File**: `Sources/Sharing/R2Uploader.swift` (modified, +2/-2)
```diff
@@ -130,8 +130,8 @@ final class R2Uploader {
 
     func uploadShare(itemID: UUID, fileURL: URL, title: String?) async throws -> URL {
         let credentials = R2CredentialStore.shared.snapshot()
-        guard credentials.isConfigured else {
-            throw R2UploadError(message: "R2 sharing is not configured. Add your credentials in Settings > Sharing.")
+        if let blocker = credentials.shareBlocker {
+            throw R2UploadError(message: blocker)
         }
 
         uploadingItems.insert(itemID)
```

**File**: `Tests/EditorUIIntegration.swift` (modified, +1/-1)
```diff
@@ -1909,7 +1909,7 @@ private func checkPreviewOverlay(imageURL: URL) async throws {
     AppPreferences.overlayCardSize = .large
     overlay.refreshSettings()
     precondition(panel.frame.width > originalWidth, "Changing Overlay settings must resize an existing overlay")
-    precondition(!CloudUploader.shared.isConfigured, "Tests must not access R2 credentials")
+    precondition(!R2CredentialStore.shared.isConfigured, "Tests must not access R2 credentials")
     overlay.share(imageURL)
     guard case .failed(_, _, true) = overlay.transferStatus(for: imageURL) else {
         preconditionFailure("An unconfigured share must offer recovery")
```

#### Recent Merged Pull Requests:
- **PR #169** (2026-09-25): Feature/scroll capture UI (@ItisPratham)
- **PR #168** (2026-09-25): fix: don't wait on Spotlight before a screenshot appears (@icanhasjonas)
- **PR #167** (2026-09-25): fix: use the configured filename template for saved screenshots (@zergzorg)
- **PR #164** (2026-09-25): fix: group clip speed slider drags into one undo step (@icanhasjonas)
- **PR #163** (2026-09-25): fix: honor the upload toggle when sharing (@icanhasjonas)
- **PR #162** (2026-09-25): fix: remove WebP export, which macOS cannot encode (@icanhasjonas)
- **PR #161** (2026-09-25): fix: name a capture once, when it is taken (@icanhasjonas)
- **PR #157** (2026-09-20): feat: add scroll capture controller for full-page screenshots (@KartikLabhshetwar)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
