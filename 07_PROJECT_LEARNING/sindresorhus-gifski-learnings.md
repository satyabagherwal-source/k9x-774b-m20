# Forensic Learning Record (Deep Inspection): sindresorhus/Gifski

> **Canonical Artifact**: `07_PROJECT_LEARNING/sindresorhus-gifski-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/sindresorhus/Gifski](https://github.com/sindresorhus/Gifski))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:24:45.229Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sindresorhus/Gifski`
- **Description**: 🌈 Convert videos to high-quality GIFs on your Mac
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: N/A
- **Stars / Engagement**: 8573 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Remote API meta.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Gifski/AppState.swift`
```
import SwiftUI
import UserNotifications
import DockProgress
import OSLog

@MainActor
private final class ImportLog {
	static let shared = ImportLog()

	private let logger = Logger(
		subsystem: Bundle.main.bundleIdentifier ?? "com.sindresorhus.Gifski",
		category: "Import"
	)

	private var entries = [String]()

	var text: String {
		entries.joined(separator: "\n")
	}

	func info(_ publicMessage: String, _ privateMessage: @autoclosure () -> String) {
		logger.info("\(publicMessage, privacy: .public)")
		append("info", privateMessage())
	}

	func debug(_ publicMessage: String, _ privateMessage: @autoclosure () -> String) {
		logger.debug("\(publicMessage, privacy: .public)")
		append("debug", privateMessage())
	}

	func error(_ publicMessage: String, _ privateMessage: @autoclosure () -> String) {
		logger.error("\(publicMessage, privacy: .public)")
		append("error", privateMessage())
	}

	private func append(_ level: String, _ text: String) {
		entries.append("[\(Date.now.formatted(date: .numeric, time: .complete))] \(level): \(text)")

		if entries.count > 200 {
			entries.removeFirst(entries.count - 200)
		}
	}
}

@MainActor
@Observable
final class AppState {
	static let shared = AppState()

	var isOnEditScreen: Bool {
		guard case .edit = navigationPath.last else {
			return false
		}

		return true
	}

	var isConverting: Bool {
		guard case .conversion = navigationPath.last else {
			return false
		}

		return true
	}

	var navigationPath = [Route]()
	var isFileImporterPresented = false
	var isOpeningVideo = false

	enum Mode {
		case normal
		case editCrop
		case preview
	}

	var mode = Mode.normal

	var shouldShowPreview: Bool {
		mode == .preview
	}

	var isCropActive: Bool {
		mode == .editCrop
	}

	var onExportAsVideo: (() -> Void)?

	func copyDiagnosticLogs() {
		let importLogs = ImportLog.shared.text

		NSPasteboard.general.with {
			$0.setString(
				"""
				\(SSApp.debugInfo)

				Import Logs
				\(importLogs.isEmpty ? "No logs recorded." : importLogs)
				""",
				forType: .string
			)
		}
	}

	/**
	Provides a binding for a toggle button to access a certain mode.

	The getter returns true if in that mode. Setter will toggle the mode on, but return to initial mode if set to off (if we are in the specified mode).
	*/
	func toggleMode(mode: Mode) -> Binding<Bool> {
		.init(
			get: {
				self.mode == mode
			},
			set: { newValue in
				if newValue {
					self.mode = mode
					return
				}

				guard self.mode == mode else {
					return
				}

				self.mode = .normal
			}
		)
	}

	var error: Error?

	init() {
		DockProgress.style = .squircle(color: .white.opacity(0.7))

		DispatchQueue.main.async { [self] in
			didLaunch()
		}
	}

	private func didLaunch() {
		NSApp.servicesProvider = self

		// We have to include `.badge` otherwise system settings does not show the checkbox to turn off sounds. (macOS 12.4)
		UNUserNotificationCenter.current().requestAuthorization(options: [.sound, .badge]) { _, _ in }

		delay(.seconds(1)) {
			SSApp.runOnce(identifier: "firstLaunch-3-0-0") {
				guard !SSApp.isFirstLaunch else {
					return
				}

				NSAlert.showModal(
					for: NSApp.mainWindow,
					title: "Welcome to Gifski 3",
					message: "Gifski now supports cropping and preview.\n\nNote: Quick Look is no longer available after conversion. It was unreliable, and the preview window is now large enough on its own.\n\nKnown issue: Dragging from a Dock folder into the window may fail due to a macOS bug."
				)
			}
		}
	}

	func start(_ url: URL) {
		guard !isOpeningVideo else {
			ImportLog.shared.info(
				"Ignored open request while another video is opening",
				"Ignored open request while another video is opening: filename=\(url.lastPathComponent), pathExtension=\(url.pathExtension)"
			)
			return
		}

		startOpeningVideo(url)
	}

	private func startOpeningVideo(_ url: URL) {
		// We intentionally do not call `stop` on this one later for simplicity since we will never get a lot of files.
		let didStartSecurityScopedAccess = url.startAccessingSecurityScopedResource()
		let contentType = url.contentType?.identifier ?? "unknown"
		ImportLog.shared.info(
			"Start opening video: pathExtension=\(url.pathExtension), contentType=\(contentType)",
			"Start opening video: filename=\(url.lastPathComponent), pathExtension=\(url.pathExtension), contentType=\(contentType), fileSize=\(url.fileSize)"
		)
		ImportLog.shared.debug(
			"Security scoped access: didStart=\(didStartSecurityScopedAccess)",
			"Security scoped access: filename=\(url.lastPathComponent), didStart=\(didStartSecurityScopedAccess)"
		)

		// We have to nil it out first and dispatch, otherwise it shows the old video. (macOS 14.3)
		navigationPath = []
		isOpeningVideo = true

		// Reset mode to prevent the new EditScreen from inheriting preview/crop state.
		mode = .normal

		Task { [self] in
			defer {
				isOpeningVideo = false
			}

			do {
				ImportLog.shared.info(
					"Validating video",
					"Validating video: filename=\(url.lastPathComponent)"
				)
				// TODO: Simplify the validator.
				let (asset, metadata) = try await VideoValidator.validate(url)
				ImportLog.shared.info(
					"Video validated",
					"Video validated: filename=\(url.lastPathComponent), dimensions=\(metadata.dimensions.formatted), duration=\(metadata.duration.toTimeInterval.formatted(.number.precision(.fractionLength(2)))), hasAudio=\(metadata.hasAudio)"
				)
				navigationPath = [.edit(url, asset, metadata)]
			} catch {
				let nsError = error as NSError
				let recoverySuggestion = nsError.localizedRecoverySuggestion.map { ", recoverySuggestion=\($0)" } ?? ""
				ImportLog.shared.error(
					"Video validation failed: errorDomain=\(nsError.domain), errorCode=\(nsError.code)",
					"Video validation failed: filename=\(url.lastPathComponent), errorDomain=\(nsError.domain), errorCode=\(nsError.code), message=\(error.localizedDescription)\(recoverySuggestion)"
				)
				self.error = error
			}
		}
	}

	func start(_ itemProvider: NSItemProvider) {
		guard !isOpeningVideo else {
			ImportLog.shared.info(
				"Ignored open request while another video is opening",
				"Ignored open request while another video is opening"
			)
			return
		}

		isOpeningVideo = true

		Task { [self] in
			guard let url = await itemProvider.getURL() else {
				isOpeningVideo = false
				return
			}

			startOpeningVideo(url)
		}
	}

	private func handlePromisedVideoError(_ error: Error) {
		isOpeningVideo = false
		let nsError = error as NSError
		ImportLog.shared.error(
			"Failed to receive promised video: errorDomain=\(nsError.domain), errorCode=\(nsError.code)",
			"Failed to receive promised video: errorDomain=\(nsError.domain), errorCode=\(nsError.code), message=\(error.localizedDescription)"
		)
		self.error = error
	}

	/**
	Open a video from a dragged file promise, such as the macOS screen-recording thumbnail (`screencaptureui`).

	The promise source writes the file into a directory we own before it tears down its own temporary file, so the video remains available. This avoids the race in the plain drag-pasteboard path where the source deletes its temporary file before the async open resolves, losing the recording.
	*/
	func start(_ promiseReceiver: NSFilePromiseReceiver) {
		guard !isOpeningVideo else {
			ImportLog.shared.info(
				"Ignored promised video while another video is opening",
				"Ignored promised video while another video is opening"
			)
			return
		}

		let fileTypes = promiseReceiver.fileTypes.joined(separator: ", ")
		ImportLog.shared.info(
			"Receiving promised video: fileTypes=\(fileTypes)",
			"Receiving promised video: fileTypes=\(fileTypes)"
		)

		isOpeningVideo = true

		do {
			let promisedFile = try promiseReceiver.receivePromisedFile()

			Task { [self] in
				do {
					for try await url in promisedFile {
						startOpeningVideo(url)
						return
					}

					isOpeningVideo = false
				} catch {
					handlePromisedVideoError(error)
				}
			}
		} catch {
			handlePromisedVideoError(error)
		}
	}

	/**
	Returns `nil` if it should not continue.
	*/
	fileprivate func extractSharedVideoUrlIfAny(from url: URL) -> URL? {
		guard url.host == "shareExtension" else {
			ImportLog.shared.debug(
				"Using direct open URL: pathExtension=\(url.pathExtension)",
				"Using direct open URL: filename=\(url.lastPathComponent), pathExtension=\(url.pathExtension)"
			)
			return url
		}

		ImportLog.shared.info("Resolving share extension URL", "Resolving share extension URL")

		guard
			let path = url.queryDictionary["path"],
			let appGroupShareVideoUrl = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: Shared.appGroupIdentifier)?.appendingPathComponent(path, isDirectory: false)
		else {
			ImportLog.shared.error("Failed to resolve share extension URL", "Failed to resolve share extension URL")
			NSAlert.showModal(
				for: SSApp.swiftUIMainWindow,
				title: "Could not retrieve the shared video."
			)
			return nil
		}

		ImportLog.shared.info(
			"Resolved share extension URL: pathExtension=\(appGroupShareVideoUrl.pathExtension)",
			"Resolved share extension URL: filename=\(appGroupShareVideoUrl.lastPathComponent), pathExtension=\(appGroupShareVideoUrl.pathExtension)"
		)
		return appGroupShareVideoUrl
	}
}

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
	func applicationDidFinishLaunching(_ notification: Notification) {
		ImportLog.shared.info("Application did finish launching", "Application did finish launching")
		// Set launch completions option if the notification center could not be set up already.
		LaunchCompletions.applicationDidLaunch()
	}

	// Using AppDelegate instead of `.onOpenURL` because we need to handle multiple URLs at once to reject multi-file drops with a user-friendly error.
	func application(_ application: NSApplication, open urls: [URL]) {
		ImportLog.shared.info(
			"Received open URLs event: count=\(urls.count), pathExtensions=\(urls.map(\.pathExtension).joined(separator: ", "))",
			"Received open 
```

### Core Architecture Module: `Gifski/Preview/PreviewRenderer.swift`
```
import Foundation
import Metal
import MetalKit

actor PreviewRenderer {
	private static var sharedRenderer: PreviewRenderer?

	static var shared: PreviewRenderer {
		get throws {
			if let sharedRenderer {
				return sharedRenderer
			}

			let renderer = try PreviewRenderer()
			sharedRenderer = renderer

			return renderer
		}
	}

	static let colorAttachmentPixelFormat = MTLPixelFormat.bgra8Unorm
	static let depthAttachmentPixelFormat = MTLPixelFormat.depth32Float

	private let context: PreviewRendererContext

	let metalDevice: MTLDevice
	let textureLoader: MTKTextureLoader
	var depthTextureCache = [DepthTextureSize: MTLTexture]()

	private init() throws {
		guard let metalDevice = MTLCreateSystemDefaultDevice() else {
			throw Error.noDevice
		}

		self.metalDevice = metalDevice

		guard metalDevice.supportsFamily(.common1) else {
			throw Error.unsupportedDevice
		}

		self.textureLoader = MTKTextureLoader(device: metalDevice)
		self.context = try PreviewRendererContext(metalDevice)
	}

	func renderOriginal(
		from videoFrame: SendableCVPixelBuffer,
		to outputFrame: SendableCVPixelBuffer,
	) throws {
		videoFrame.pixelBuffer.propagateAttachments(to: outputFrame.pixelBuffer)
		try videoFrame.pixelBuffer.copy(to: outputFrame.pixelBuffer)
	}

	func renderPreview(
		previewFrame: SendableTexture,
		outputFrame: SendableCVPixelBuffer,
		fragmentUniforms: CompositePreviewFragmentUniforms
	) async throws {
		outputFrame.pixelBuffer.setSRGBColorSpace()

		// Get a command buffer which will let us submit commands to the GPU.
		try await context.commandQueue.withCommandBuffer(isolated: self) { commandBuffer in
			// Convert our pixel buffer to a texture.
			let outputTexture = try context.textureCache.createTexture(
				from: outputFrame.pixelBuffer,
				pixelFormat: Self.colorAttachmentPixelFormat
			)

			// Remove isolation.
			let previewTexture = previewFrame.getTexture(isolated: self)

			// Setup the scale of our preview frame.
			let scale = SIMD2<Float>(
				x: outputTexture.texture.width > 0 ? Float(previewTexture.width.toDouble / outputTexture.texture.width.toDouble) : 1.0,
				y: outputTexture.texture.height > 0 ? Float(previewTexture.height.toDouble / outputTexture.texture.height.toDouble) : 1.0
			)

			// The render command encoder will create a render command (render on the GPU) (the command will run when the command buffer commits (which happens automatically at the end of this closure)).
			try commandBuffer.withRenderCommandEncoder(
				renderPassDescriptor: PreviewRendererContext.makeRenderPassDescriptor(
					outputTexture: outputTexture,
					depthTexture: try getDepthTexture(
						width: outputTexture.texture.width,
						height: outputTexture.texture.height
					)
				)
			) { renderEncoder in
				context.applyContext(to: renderEncoder)

				// Turn off back culling (this means we don't care what order triangles are wound, we can list the vertices in any order).
				renderEncoder.setCullMode(.none)

				// Send the texture to the fragment shader (which chooses the color of each pixel).
				renderEncoder.setFragmentTexture(previewTexture, index: 0)

				do {
					// Send data to the vertex shader. In this case, what scale the preview image is.
					var vertexUniforms = CompositePreviewVertexUniforms(scale: scale)

					renderEncoder.setVertexBytes(
						&vertexUniforms,
						length: MemoryLayout<CompositePreviewVertexUniforms>.stride,
						index: 0
					)
				}

				do {
					// Send our data to the fragment shader. Mostly about the checkerboard pattern.
					var fragmentUniforms = fragmentUniforms

					renderEncoder.setFragmentBytes(
						&fragmentUniforms,
						length: MemoryLayout<CompositePreviewFragmentUniforms>.stride,
						index: 0
					)
				}

				// Tell the encoder to draw. We want to draw 2 quads (one for the preview, one for the checkerboard pattern). The next code to look at will be the vertex shader in `previewVertexShader`.
				renderEncoder.drawPrimitives(
					type: .triangle,
					vertexStart: 0,
					vertexCount: Int(VERTICES_PER_QUAD) * 2
				)
			}
		}
	}
}

extension PreviewRenderer {
	enum Error: Swift.Error {
		case noDevice
		case unsupportedDevice
		case noCommandQueue
		case failedToMakeSampler
		case failedToMakeTextureCache
		case libraryFailure
		case failedToMakeDepthStencilState
		case failedToMakeSendableTexture
	}
}

extension PreviewRenderer {
	/**
	After it is sent to `SendableCVPixelBuffer`, the `CVPixelBuffer` is only accessible to `PreviewRenderer`.
	*/
	final class SendableCVPixelBuffer: @unchecked Sendable {
		fileprivate let pixelBuffer: CVPixelBuffer

		init(pixelBuffer: CVPixelBuffer) {
			self.pixelBuffer = pixelBuffer
		}
	}
}

```

### Core Architecture Module: `Gifski/Preview/PreviewRendererContext.swift`
```
import Foundation
import MetalKit

/**
The static state context we setup at runtime and use later.
*/
struct PreviewRendererContext {
	private let pipelineState: MTLRenderPipelineState
	private let depthStencilState: MTLDepthStencilState
	private let samplerState: MTLSamplerState

	let commandQueue: MTLCommandQueue
	let textureCache: CVMetalTextureCache

	init(_ metalDevice: MTLDevice) throws {
		guard let commandQueue = metalDevice.makeCommandQueue() else {
			throw PreviewRenderer.Error.noCommandQueue
		}

		self.pipelineState = try Self.setupPipelineState(metalDevice)
		self.samplerState = try Self.setupSamplerState(metalDevice)
		self.depthStencilState = try Self.setupDepthStencilState(metalDevice)
		self.commandQueue = commandQueue
		self.textureCache = try Self.setupTextureCache(metalDevice)
	}

	/**
	Set the render command encoder to use the context we have created.
	*/
	func applyContext(to renderCommandEncoder: MTLRenderCommandEncoder) {
		// Set up the depth buffer.
		renderCommandEncoder.setDepthStencilState(depthStencilState)

		// Set up the actual render.
		renderCommandEncoder.setRenderPipelineState(pipelineState)

		// Set up the sampler (allow us to read from the texture).
		renderCommandEncoder.setFragmentSamplerState(samplerState, index: 0)
	}

	/**
	The render pipeline sets up our shaders in `compositePreview.metal` and sets up to write to a color attachment with a depth buffer.
	*/
	private static func setupPipelineState(_ metalDevice: MTLDevice) throws -> MTLRenderPipelineState {
		guard
			let library = metalDevice.makeDefaultLibrary(),
			let vertexFunction = library.makeFunction(name: "previewVertexShader"),
			let fragmentFunction = library.makeFunction(name: "previewFragment")
		else {
			throw PreviewRenderer.Error.libraryFailure
		}

		let pipelineDescriptor = MTLRenderPipelineDescriptor()
		pipelineDescriptor.vertexFunction = vertexFunction
		pipelineDescriptor.fragmentFunction = fragmentFunction

		// This is the output of the render pass.
		pipelineDescriptor.colorAttachments[0].pixelFormat = PreviewRenderer.colorAttachmentPixelFormat

		// This is a texture which stores the "depth" of each pixel. It is used to decide whether a pixel will occlude another pixel.
		pipelineDescriptor.depthAttachmentPixelFormat = PreviewRenderer.depthAttachmentPixelFormat

		return try metalDevice.makeRenderPipelineState(descriptor: pipelineDescriptor)
	}

	/**
	Create a render pass descriptor to match our pipeline. Here we pass in the actual data (i.e. the textures).
	*/
	static func makeRenderPassDescriptor(
		outputTexture: CVMetalTextureReference,
		depthTexture: MTLTexture
	) -> MTLRenderPassDescriptor {
		let renderPassDescriptor = MTLRenderPassDescriptor()

		renderPassDescriptor.colorAttachments[0].texture = outputTexture.texture

		// before the render pass clear the output to the clear color
		renderPassDescriptor.colorAttachments[0].loadAction = .clear
		// which in this case is black
		renderPassDescriptor.colorAttachments[0].clearColor = MTLClearColorMake(0, 0, 0, 1)
		// after the render pass write to the output texture
		renderPassDescriptor.colorAttachments[0].storeAction = .store

		renderPassDescriptor.depthAttachment.texture = depthTexture
		// before render pass clear the depth texture to the clear depth
		renderPassDescriptor.depthAttachment.loadAction = .clear
		// which is 1.0, since our `depthCompareFunction` is `.less` anything less than `1.0` will be drawn
		renderPassDescriptor.depthAttachment.clearDepth = 1.0
		// after render pass we don't care what happens to the depth texture (it has served its purpose)
		renderPassDescriptor.depthAttachment.storeAction = .dontCare

		return renderPassDescriptor
	}

	/**
	The sampler is how we retrieve texture data inside the shader. We set it up such that we will linearly interpret all pixel data.
	*/
	private static func setupSamplerState(_ metalDevice: MTLDevice) throws(PreviewRenderer.Error) -> MTLSamplerState {
		let samplerDescriptor = MTLSamplerDescriptor()

		// Linearly interpolate colors between texels.
		samplerDescriptor.minFilter = .linear
		samplerDescriptor.magFilter = .linear

		// If we sample outside of our texture (0-1) use the same color as the edge.
		samplerDescriptor.sAddressMode = .clampToEdge
		samplerDescriptor.tAddressMode = .clampToEdge

		guard let samplerState = metalDevice.makeSamplerState(descriptor: samplerDescriptor) else {
			throw .failedToMakeSampler
		}

		return samplerState
	}

	/**
	Set up a depth buffer so that the preview will appear above the checkerboard pattern on all devices.
	*/
	private static func setupDepthStencilState(
		_ metalDevice: MTLDevice
	) throws(PreviewRenderer.Error) -> MTLDepthStencilState {
		let depthStencilDescriptor = MTLDepthStencilDescriptor()

		// For each pixel, if the depth is less than the current depth buffer, then draw, otherwise don't draw.
		depthStencilDescriptor.depthCompareFunction = .less

		// Each time you do draw (it is less than current depth buffer), store the current depth in the depth buffer.
		depthStencilDescriptor.isDepthWriteEnabled = true

		guard let depthStencilState = metalDevice.makeDepthStencilState(descriptor: depthStencilDescriptor) else {
			throw .failedToMakeDepthStencilState
		}

		return depthStencilState
	}

	/**
	Set up a texture cache to write out output pixel buffer to.
	*/
	private static func setupTextureCache(
		_ metalDevice: MTLDevice
	) throws(PreviewRenderer.Error) -> CVMetalTextureCache {
		var textureCache: CVMetalTextureCache?
		CVMetalTextureCacheCreate(nil, nil, metalDevice, nil, &textureCache)

		guard let textureCache else {
			throw .failedToMakeTextureCache
		}

		return textureCache
	}
}

```

### Core Architecture Module: `Gifski/Utilities.swift`
```
import SwiftUI
import AVKit
import Combine
import AVFoundation
import Accelerate.vImage
import AppIntents
import Defaults
import Sentry
import ExtendedAttributes

typealias Defaults = _Defaults
typealias Default = _Default
typealias AnyCancellable = Combine.AnyCancellable




@discardableResult
func with<T, E>(_ item: T, update: (inout T) throws(E) -> Void) throws(E) -> T {
	var this = item
	try update(&this)
	return this
}


func delay(@_implicitSelfCapture _ duration: Duration, closure: @escaping () -> Void) {
	DispatchQueue.main.asyncAfter(duration, execute: closure)
}


extension DispatchQueue {
	func asyncAfter(_ duration: Duration, execute: @escaping () -> Void) {
		asyncAfter(deadline: .now() + duration.toTimeInterval, execute: execute)
	}

	func asyncAfter(_ duration: Duration, execute: DispatchWorkItem) {
		asyncAfter(deadline: .now() + duration.toTimeInterval, execute: execute)
	}
}


func asyncNilCoalescing<T>(
	_ optional: T?,
	default defaultValue: @escaping @autoclosure () async throws -> T
) async rethrows -> T {
	guard let optional else {
		return try await defaultValue()
	}

	return optional
}

func asyncNilCoalescing<T>(
	_ optional: T?,
	default defaultValue: @escaping @autoclosure () async throws -> T?
) async rethrows -> T? {
	guard let optional else {
		return try await defaultValue()
	}

	return optional
}


// swiftlint:disable:next no_cgfloat
extension CGFloat {
	/**
	Get a Double from a CGFloat. This makes it easier to work with optionals.
	*/
	var toDouble: Double { Double(self) }
}

extension Double {
	/**
	Discouraged but sometimes needed when implicit coercion doesn't work.
	*/
	var toCGFloat: CGFloat { CGFloat(self) } // swiftlint:disable:this no_cgfloat no_cgfloat2

	/**
	If this represents an aspect ratio, return the normalized aspect ratio for each side as a `CGSize`.
	*/
	var normalizedAspectRatioSides: CGSize {
		self > 1.0 ? .init(width: 1.0, height: 1.0 / self) : .init(width: self, height: 1.0)
	}
}

extension BinaryInteger {
	var toDouble: Double { Double(Int(self)) }
}

extension BinaryFloatingPoint {
	/**
	- Note: Guards against numbers not representable for `Int`.
	*/
	var toInt: Int? {
		// `Self(Int.max)` rounds up to 2^63, which is not representable, so the upper bound must be exclusive.
		self >= Self(Int.min) && self < Self(Int.max) ? Int(self) : nil
	}

	/**
	- Note: Values outside the `Int` range are clamped to `Int.min`/`Int.max`. `NaN` becomes `0`.
	*/
	var toIntAndClampingIfNeeded: Int {
		guard !isNaN else {
			return 0
		}

		return toInt ?? (self < 0 ? .min : .max)
	}
}


extension Link<Label<Text, Image>> {
	init(
		_ title: String,
		systemImage: String,
		destination: URL
	) {
		self.init(destination: destination) {
			Label(title, systemImage: systemImage)
		}
	}
}


extension NSView {
	func shake(duration: Duration = .seconds(0.3), direction: NSUserInterfaceLayoutOrientation) {
		let translation = direction == .horizontal ? "x" : "y"
		let animation = CAKeyframeAnimation(keyPath: "transform.translation.\(translation)")
		animation.timingFunction = .linear
		animation.duration = duration.toTimeInterval
		animation.values = [-5, 5, -2.5, 2.5, 0]
		layer?.add(animation, forKey: nil)
	}
}


struct SendFeedbackButton: View {
	var body: some View {
		Link(
			"Support & Feedback",
			systemImage: "exclamationmark.bubble",
			destination: SSApp.appFeedbackUrl()
		)
	}
}


struct ShareAppButton: View {
	let appStoreID: String

	var body: some View {
		ShareLink("Share App", item: "https://apps.apple.com/app/id\(appStoreID)")
	}
}


struct RateOnAppStoreButton: View {
	let appStoreID: String

	var body: some View {
		Link(
			"Rate App",
			systemImage: "star",
			destination: URL(string: "itms-apps://apps.apple.com/app/id\(appStoreID)?action=write-review")!
		)
	}
}


// NOTE: This is moot with macOS 12, but `.values` property provided is super buggy and crashes a lot.
extension Publisher where Failure == Never {
	var toAsyncSequence: some AsyncSequence<Output, Failure> {
		AsyncStream(Output.self) { continuation in
			let cancellable = sink { completion in
				switch completion {
				case .finished:
					continuation.finish()
				}
			} receiveValue: { output in
				continuation.yield(output)
			}

			continuation.onTermination = { [cancellable] _ in
				cancellable.cancel()
			}
		}
	}
}


extension Task {
	/**
	Make a task cancellable.

	- Important: You need to assign it to a cancellable property for it to be cancelled. It's not weak by default like Combine.
	*/
	var toCancellable: AnyCancellable { .init(cancel) }
}


extension Sequence {
	func asyncMap<T, E>(
		_ transform: (Element) async throws(E) -> T
	) async throws(E) -> [T] {
		var values = [T]()

		for element in self {
			try await values.append(transform(element))
		}

		return values
	}
}


extension NSView {
	@discardableResult
	func insertVibrancyView(
		material: NSVisualEffectView.Material,
		blendingMode: NSVisualEffectView.BlendingMode = .behindWindow,
		appearanceName: NSAppearance.Name? = nil
	) -> NSVisualEffectView {
		let view = NSVisualEffectView(frame: bounds)
		view.autoresizingMask = [.width, .height]
		view.material = material
		view.blendingMode = blendingMode

		if let appearanceName {
			view.appearance = NSAppearance(named: appearanceName)
		}

		addSubview(view, positioned: .below, relativeTo: nil)

		return view
	}
}


extension NSWindow {
	private enum AssociatedKeys {
		static let cancellable = ObjectAssociation<AnyCancellable?>()
	}

	func makeVibrant() {
		// So there seems to be a visual effect view already created by NSWindow.
		// If we can attach ourselves to it and make it a vibrant one - awesome.
		// If not, let's just add our view as a first one so it is vibrant anyways.
		guard let visualEffectView = contentView?.superview?.subviews.lazy.compactMap({ $0 as? NSVisualEffectView }).first else {
			contentView?.superview?.insertVibrancyView(material: .underWindowBackground)
			return
		}

		visualEffectView.blendingMode = .behindWindow
		visualEffectView.material = .underWindowBackground

		AssociatedKeys.cancellable[self] = visualEffectView.publisher(for: \.effectiveAppearance)
			.sink { _ in
				visualEffectView.blendingMode = .behindWindow
				visualEffectView.material = .underWindowBackground
			}
	}
}


extension Binding<Int> {
	var intToDouble: Binding<Double> {
		map(
			get: { Double($0) },
			set: { Int($0) }
		)
	}
}


extension NSView {
	private final class AddedToSuperviewObserverView: NSView {
		var onAdded: (() -> Void)?

		override var acceptsFirstResponder: Bool { false }

		convenience init() {
			self.init(frame: .zero)
		}

		override func viewDidMoveToWindow() {
			guard window != nil else {
				return
			}

			onAdded?()
			removeFromSuperview()
		}
	}

	func onAddedToSuperview(_ closure: @escaping () -> Void) {
		let view = AddedToSuperviewObserverView()
		view.onAdded = closure
		addSubview(view)
	}
}


extension NSAlert {
	/**
	Show an alert as a window-modal sheet, or as an app-modal (window-indepedendent) alert if the window is `nil` or not given.
	*/
	@discardableResult
	static func showModal(
		for window: NSWindow? = nil,
		title: String,
		message: String? = nil,
		detailText: String? = nil,
		style: Style = .warning,
		buttonTitles: [String] = [],
		defaultButtonIndex: Int? = nil,
		minimumWidth: Double? = nil
	) -> NSApplication.ModalResponse {
		NSAlert(
			title: title,
			message: message,
			detailText: detailText,
			style: style,
			buttonTitles: buttonTitles,
			defaultButtonIndex: defaultButtonIndex,
			minimumWidth: minimumWidth
		).runModal(for: window)
	}

	/**
	The index in the `buttonTitles` array for the button to use as default.

	Set `-1` to not have any default. Useful for really destructive actions.
	*/
	var defaultButtonIndex: Int {
		get {
			buttons.firstIndex { $0.keyEquivalent == "\r" } ?? -1
		}
		set {
			// Clear the default button indicator from other buttons.
			for button in buttons where button.keyEquivalent == "\r" {
				button.keyEquivalent = ""
			}

			if newValue != -1 {
				buttons[newValue].keyEquivalent = "\r"
			}
		}
	}

	convenience init(
		title: String,
		message: String? = nil,
		detailText: String? = nil,
		style: Style = .warning,
		buttonTitles: [String] = [],
		defaultButtonIndex: Int? = nil,
		minimumWidth: Double? = nil
	) {
		self.init()
		self.messageText = title
		self.alertStyle = style

		if let message {
			self.informativeText = message
		}

		if let detailText {
			let scrollView = NSTextView.scrollableTextView()

			// We're setting the frame manually here as it's impossible to use auto-layout,
			// since it has nothing to constrain to. This will eventually be rewritten in SwiftUI anyway.
			scrollView.frame = CGRect(width: minimumWidth ?? 300, height: 120)

			if minimumWidth == nil {
				scrollView.onAddedToSuperview {
					if let messageTextField = (scrollView.superview?.superview?.subviews.first { $0 is NSTextField }) {
						scrollView.frame.width = messageTextField.frame.width
					} else {
						assertionFailure("Couldn't detect the message textfield view of the NSAlert panel")
					}
				}
			}

			let textView = scrollView.documentView as! NSTextView
			textView.drawsBackground = false
			textView.isEditable = false
			textView.font = .systemFont(ofSize: NSFont.systemFontSize(for: .small))
			textView.textColor = .secondaryLabelColor
			textView.string = detailText

			self.accessoryView = scrollView
		} else if let minimumWidth {
			self.accessoryView = NSView(frame: CGRect(width: minimumWidth, height: 0))
		}

		addButtons(withTitles: buttonTitles)

		if let defaultButtonIndex {
			self.defaultButtonIndex = defaultButtonIndex
		}
	}

	/**
	Runs the alert as a window-modal sheet, or as an app-modal (window-indepedendent) alert if the window is `nil` or not given.
	*/
	@discardableResult
	func runModal(for window: NSWindow? = nil) -> NSApplication.ModalResponse {
		guard let window else {
			return runModal()
		}

		beginSheetModal(for: window) { returnCode in
		
```

### Core Architecture Module: `Share Extension/Utilities.swift`
```
import SwiftUI
import UniformTypeIdentifiers


extension Sequence where Element: Sequence {
	func flatten() -> [Element.Element] {
		flatMap(\.self)
	}
}


extension NSExtensionContext {
	var inputItemsTyped: [NSExtensionItem] { inputItems as! [NSExtensionItem] }

	var attachments: [NSItemProvider] {
		inputItemsTyped.compactMap(\.attachments).flatten()
	}
}


// Strongly-typed versions of some of the methods.
extension NSItemProvider {
	func hasItemConforming(to contentType: UTType) -> Bool {
		hasItemConformingToTypeIdentifier(contentType.identifier)
	}
}


extension NSError {
	static let userCancelled = NSError(domain: NSCocoaErrorDomain, code: NSUserCancelledError, userInfo: nil)
}


extension NSExtensionContext {
	func cancel() {
		cancelRequest(withError: NSError.userCancelled)
	}
}


extension NSItemProvider {
	func loadTransferable<T: Transferable & Sendable>(type transferableType: T.Type) async throws -> T {
		try await withCheckedThrowingContinuation { continuation in
			_ = loadTransferable(type: transferableType) {
				continuation.resume(with: $0)
			}
		}
	}
}


class ExtensionController: NSViewController { // swiftlint:disable:this final_class
	init() {
		super.init(nibName: nil, bundle: nil)
	}

	@available(*, unavailable)
	required init?(coder: NSCoder) {
		fatalError() // swiftlint:disable:this fatal_error_message
	}

	override func loadView() {
		Task { @MainActor in // Not sure if this is needed, but added just in case.
			do {
				extensionContext!.completeRequest(
					returningItems: try await run(extensionContext!),
					completionHandler: nil
				)
			} catch {
				extensionContext!.cancelRequest(withError: error)
			}
		}
	}

	func run(_ context: NSExtensionContext) async throws -> [NSExtensionItem] { [] }
}

```

### Core Architecture Module: `Gifski/App.swift`
```
import SwiftUI

@main
struct AppMain: App {
	private let appState = AppState.shared
	@NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

	init() {
		setUpConfig()
	}

	var body: some Scene {
		Window(SSApp.name, id: "main") {
			MainScreen()
				.environment(appState)
		}
		.windowResizability(.contentSize)
		.windowToolbarStyle(.unifiedCompact)
//		.windowBackgroundDragBehavior(.enabled) // Does not work. (macOS 15.2)
		.defaultPosition(.center)
		.restorationBehavior(.disabled)
		.commands {
			CommandGroup(replacing: .newItem) {
				Button("Open…", systemImage: "arrow.up.forward.square") {
					appState.isFileImporterPresented = true
				}
				.keyboardShortcut("o")
				.disabled(appState.isConverting || appState.isOpeningVideo)
			}
			CommandGroup(replacing: .importExport) {
				Button("Export as Video…", systemImage: "square.and.arrow.up") {
					appState.onExportAsVideo?()
				}
				.keyboardShortcut("e")
				.disabled(!appState.isOnEditScreen)
			}
			CommandGroup(replacing: .textEditing) {
				Toggle(
					"Preview",
					systemImage: "eye",
					isOn: appState.toggleMode(mode: .preview)
				)
				.keyboardShortcut("p", modifiers: [.command, .shift])
				.disabled(!appState.isOnEditScreen)
				.help("Preview is only available when editing a video")
				Toggle(
					"Crop",
					systemImage: "crop",
					isOn: appState.toggleMode(mode: .editCrop)
				)
				.keyboardShortcut("c", modifiers: [.command, .shift])
				.disabled(!appState.isOnEditScreen)
			}
			CommandGroup(replacing: .help) {
				Link(
					"Website",
					systemImage: "safari",
					destination: "https://sindresorhus.com/gifski"
				)
				Link(
					"Source Code",
					systemImage: "chevron.left.forwardslash.chevron.right",
					destination: "https://github.com/sindresorhus/Gifski"
				)
				Link(
					"Gifski Library",
					systemImage: "shippingbox",
					destination: "https://github.com/ImageOptim/gifski"
				)
				Divider()
				RateOnAppStoreButton(appStoreID: "1351639930")
				ShareAppButton(appStoreID: "1351639930")
				Divider()
				Button("Copy Logs", systemImage: "doc.on.clipboard") {
					appState.copyDiagnosticLogs()
				}
				SendFeedbackButton()
			}
		}
		Settings {
			SettingsScreen()
		}
	}

	private func setUpConfig() {
		UserDefaults.standard.register(defaults: [
			"NSApplicationCrashOnExceptions": true
		])

		SSApp.initSentry("https://0ab0665326c54956f3caa10fc2f525d1@o844094.ingest.sentry.io/4505991507738624")

		SSApp.setUpExternalEventListeners()
	}
}

```

### Core Architecture Module: `Gifski/CompletedScreen.swift`
```
import SwiftUI
import UserNotifications
import StoreKit

struct CompletedScreen: View {
	@Environment(AppState.self) private var appState
	@Environment(\.requestReview) private var requestReview
	@AppStorage("conversionCount") private var conversionCount = 0
	@State private var isFileExporterPresented = false
	@State private var isShowingContent = false
	@State private var isCopyWarning1Presented = false
	@State private var isCopyWarning2Presented = false
	@State private var isDragTipPresented = false

	let data: Data
	let url: URL
	let sourceURL: URL

	var body: some View {
		VStack {
			ImageView(image: NSImage(data: data) ?? NSImage())
				.clipShape(.rect(cornerRadius: 8))
				.shadow(radius: 8)
				// TODO: This is probably fixed in macOS 15. Test.
				// TODO: `.draggable()` does not correctly add a file to the drag pasteboard. (macOS 14.0)
//				.draggable(ExportableGIF(url: url))
				.onDrag { .init(object: url as NSURL) }
				.popover(isPresented: $isDragTipPresented) {
					Text("Go ahead and drag the thumbnail to an app like Finder or Safari")
						.padding()
						.padding(.vertical, 4)
						.onTapGesture {
							isDragTipPresented = false
						}
						.accessibilityAddTraits(.isButton)
				}
				.opacity(isShowingContent ? 1 : -0.5)
				.scaleEffect(isShowingContent ? 1 : 4)
		}
		.fillFrame()
		.safeAreaInset(edge: .bottom) {
			controls
		}
		.scenePadding()
		.fileExporter(
			isPresented: $isFileExporterPresented,
			item: ExportableGIF(url: url),
			defaultFilename: url.filename
		) {
			do {
				let url = try $0.get()
				try? url.setAppAsItemCreator()
			} catch {
				appState.error = error
			}
		}
		.fileDialogDefaultDirectory(saveDialogDirectory)
		.fileDialogMessage("Choose where to save the GIF")
		.fileDialogConfirmationLabel("Save")
		.alert2(
			"The GIF was copied to the clipboard.",
			message: "However…",
			isPresented: $isCopyWarning1Presented
		) {
			Button("Continue") {
				isCopyWarning2Presented = true
			}
		}
		.alert2(
			"Please read!",
			message: "Many apps like Chrome and Slack do not properly handle copied animated GIFs and will paste them as non-animated PNG.\n\nInstead, drag and drop the GIF into such apps.",
			isPresented: $isCopyWarning2Presented
		)
		.toolbar {
			ToolbarSpacer(.fixed)
			ToolbarItem(placement: .primaryAction) {
				Button("New Conversion", systemImage: "plus") {
					appState.isFileImporterPresented = true
				}
				.if(SSApp.isFirstLaunch) {
					$0.labelStyle(.titleAndIcon)
				}
			}
		}
		.navigationTitle(url.filename)
		.navigationSubtitle(url.fileSizeFormatted)
//		.navigationDocument(url) // Doesn't show title (macOS 26.2)
		.task {
			withAnimationWhenNotReduced {
				isShowingContent = true
			}
		}
		.task {
			NSApp.requestUserAttention(.informationalRequest)
			showNotificationIfNeeded()
			showDragTipIfNeeded()
			requestReviewIfNeeded()
		}
	}

	private var controls: some View {
		HStack(spacing: 16) {
			Button("Save", systemImage: "square.and.arrow.down") {
				isFileExporterPresented = true
			}
			.keyboardShortcut("s")
			.help("Save")
			CopyButton {
				copyToClipboard(url)
			}
			.keyboardShortcut("c")
			.help("Copy")
			ShareLink("Share", item: url)
				// TODO: Document this shortcut.
				.keyboardShortcut("s", modifiers: [.command, .shift])
				.help("Share")
		}
		.labelStyle(.iconOnly)
		.controlSize(.extraLarge)
		.buttonStyle(.equalWidth(.constant(0), minimumWidth: 80))
		.buttonStyle(.glass)
		.frame(width: 300)
		.padding()
		.opacity(isShowingContent ? 1 : 0)
	}

	private static let appGroupContainer = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: Shared.appGroupIdentifier)

	/**
	The directory the save dialog should open in.

	Defaults to the source video's folder, but falls back to Downloads when that is not a sensible place to save: the hidden app group container (where the Share Extension copies imported videos) or a read-only volume (for example, a file dragged in from a mounted disk image).
	*/
	private var saveDialogDirectory: URL {
		let directory = sourceURL.deletingLastPathComponent()

		guard
			!directory.isVolumeReadonly,
			directory.standardizedFileURL != Self.appGroupContainer?.standardizedFileURL
		else {
			return .downloadsDirectory
		}

		return directory
	}

	private func copyToClipboard(_ url: URL) {
		NSPasteboard.general.with {
			// swiftlint:disable:next legacy_objc_type
			$0.writeObjects([url as NSURL])
			$0.setString(url.filenameWithoutExtension, forType: .urlName)
		}

		SSApp.runOnce(identifier: "copyWarning") {
			isCopyWarning1Presented = true
		}
	}

	private func showNotificationIfNeeded() {
		guard !NSApp.isActive || SSApp.swiftUIMainWindow?.isVisible == false else {
			return
		}

		let notification = UNMutableNotificationContent()
		notification.title = "Conversion Completed"
		notification.subtitle = url.filename
		notification.sound = .default
		let request = UNNotificationRequest(identifier: "conversionCompleted", content: notification, trigger: nil)
		UNUserNotificationCenter.current().add(request)
	}

	private func requestReviewIfNeeded() {
		conversionCount += 1

		guard conversionCount == 5 else {
			return
		}

		#if !DEBUG
		requestReview()
		#endif
	}

	private func showDragTipIfNeeded() {
		SSApp.runOnce(identifier: "CompletedScreen_dragTip") {
			Task {
				try? await Task.sleep(for: .seconds(1))
				isDragTipPresented = true
				try? await Task.sleep(for: .seconds(10))
				isDragTipPresented = false
			}
		}
	}
}

```

### Core Architecture Module: `Gifski/Components/CheckerboardView.swift`
```
import SwiftUI

enum CheckerboardViewConstants {
	static let gridSize = 8

	/**
	I tried just using firstColor directly (instead of splitting between light and dark), but it would not reliably change colors for the preview when switching between light and dark.
	*/
	static let firstColorLight = Color(white: 0.98)
	static let firstColorDark = Color(white: 0.46)
	static let secondColorLight = Color(white: 0.82)
	static let secondColorDark = Color(white: 0.26)

	static let firstColor = Color(light: firstColorLight, dark: firstColorDark)
	static let secondColor = Color(light: secondColorLight, dark: secondColorDark)
}

struct CheckerboardView: View {
	var gridSize = CGSize(width: CheckerboardViewConstants.gridSize, height: CheckerboardViewConstants.gridSize)
	var clearRect: CGRect?

	var body: some View {
		ZStack {
			Canvas(opaque: true) { context, size in
				context.fill(Rectangle().path(in: size.cgRect), with: .color(CheckerboardViewConstants.secondColor))

				for y in 0...Int(size.height / gridSize.height) {
					for x in 0...Int(size.width / gridSize.width) where x.isEven == y.isEven {
						let origin = CGPoint(x: x * Int(gridSize.width), y: y * Int(gridSize.height))
						let rect = CGRect(origin: origin, size: gridSize)
						context.fill(Rectangle().path(in: rect), with: .color(CheckerboardViewConstants.firstColor))
					}
				}
			}
			// Note: This overlay is needed because Canvas doesn't support blend modes for individual shapes.
			if let clearRect {
				Rectangle()
					.fill(.black)
					.frame(width: clearRect.width, height: clearRect.height)
					.blendMode(.destinationOut)
					// Position at the video bounds center. Without this, the rectangle
					// would be centered in the ZStack, which is wrong for letterboxed videos.
					.position(x: clearRect.midX, y: clearRect.midY)
			}
		}
		.compositingGroup()
		.drawingGroup()
	}
}

```

### Core Architecture Module: `Gifski/Components/IntTextField.swift`
```
import SwiftUI

struct IntTextField: NSViewRepresentable {
	typealias NSViewType = IntTextFieldCocoa

	@Binding var value: Int
	var minMax: ClosedRange<Int>?
	var delta = 1
	var alternativeDelta = 10
	var alignment: NSTextAlignment?
	var font: NSFont?
	var onValueChange: ((Int) -> Void)?
	var onBlur: ((Int) -> Void)?
	var onInvalid: ((Int) -> Void)?

	func makeNSView(context: Context) -> IntTextFieldCocoa {
		let nsView = IntTextFieldCocoa()

		nsView.onValueChange = {
			value = $0
			onValueChange?($0)
		}

		nsView.onBlur = {
			value = $0
			onBlur?($0)
		}

		nsView.onInvalid = {
			onInvalid?($0)
		}

		return nsView
	}

	func updateNSView(_ nsView: IntTextFieldCocoa, context: Context) {
		nsView.stringValue = "\(value)" // We intentionally do not use `nsView.intValue` as it formats the number.
		nsView.minMax = minMax
		nsView.delta = delta
		nsView.alternativeDelta = alternativeDelta

		if let alignment {
			nsView.alignment = alignment
		}

		if let font {
			nsView.font = font
		}
	}
}

final class IntTextFieldCocoa: NSTextField, NSTextFieldDelegate, NSControlTextEditingDelegate {
	override var canBecomeKeyView: Bool { true }

	/**
	Delta used for arrow navigation.
	*/
	var delta = 1

	/**
	Delta used for option + arrow navigation.
	*/
	var alternativeDelta = 10

	var onValueChange: ((Int) -> Void)?
	var onBlur: ((Int) -> Void)?
	var onInvalid: ((Int) -> Void)?
	var minMax: ClosedRange<Int>?

	var isEmpty: Bool { stringValue.trimmingCharacters(in: .whitespaces).isEmpty }

	required init?(coder: NSCoder) {
		super.init(coder: coder)
		setup()
	}

	override init(frame frameRect: CGRect) {
		super.init(frame: frameRect)
		setup()
	}

	private func setup() {
		delegate = self
	}

	override func performKeyEquivalent(with event: NSEvent) -> Bool {
		guard window?.firstResponder == currentEditor() else {
			return super.performKeyEquivalent(with: event)
		}

		let key = event.specialKey
		let isHoldingOption = event.modifierFlags.contains(.option)
		let initialDelta = isHoldingOption ? alternativeDelta : delta

		let delta: Int
		switch key {
		case .upArrow?:
			delta = initialDelta
		case .downArrow?:
			delta = initialDelta * -1
		default:
			return super.performKeyEquivalent(with: event)
		}

		let currentValue = Int(stringValue) ?? 0
		let tentativeNewValue = currentValue + delta

		func setValue() {
			stringValue = "\(tentativeNewValue)"
			handleValueChange()
		}

		if let minMax {
			if minMax.contains(tentativeNewValue) {
				setValue()
			} else {
				indicateValidationFailure(invalidValue: tentativeNewValue)
			}
		} else {
			setValue()
		}

		return true
	}

	func controlTextDidChange(_ object: Notification) {
		stringValue = stringValue
			.replacing(/\D+/, with: "") // Make sure only digits can be entered.
			.replacing(/^0/, with: "") // Don't allow leading zero.

		if let minMax {
			// Ensure the user cannot input more digits than the max.
			stringValue = String(stringValue.prefix("\(minMax.upperBound)".count))
		}

		let isInvalidButInBounds = !isValid(integerValue) && integerValue > 0 && integerValue <= (minMax?.upperBound ?? Int.max)

		// For entered text we want to give a little bit more room to breathe
		if isEmpty || isInvalidButInBounds {
			return
		}

		handleValueChange()
	}

	private func handleValueChange() {
		if !isValid(integerValue) {
			indicateValidationFailure(invalidValue: integerValue)
		}

		onValueChange?(integerValue)
	}

	func controlTextDidEndEditing(_ object: Notification) {
		var finalValue = integerValue

		if
			let minMax,
			!minMax.contains(finalValue)
		{
			indicateValidationFailure(invalidValue: finalValue)
			finalValue = finalValue.clamped(to: minMax)
			stringValue = "\(finalValue)"
		}

		onBlur?(finalValue)
	}

	func indicateValidationFailure(invalidValue: Int) {
		shake(direction: .horizontal)
		onInvalid?(invalidValue)
	}

	private func isValid(_ value: Int) -> Bool {
		guard let minMax else {
			return true
		}

		return minMax.contains(value)
	}
}

```

### Core Architecture Module: `Gifski/Components/TrimmingAVPlayer.swift`
```
import AVKit
import SwiftUI

struct TrimmingAVPlayer: NSViewControllerRepresentable {
	typealias NSViewControllerType = TrimmingAVPlayerViewController

	@Environment(\.colorScheme) private var colorScheme

	let asset: AVAsset
	let shouldShowPreview: Bool
	let fullPreviewState: FullPreviewGenerationEvent
	var controlsStyle = AVPlayerViewControlsStyle.inline
	var loopPlayback = false
	var bouncePlayback = false
	var speed = 1.0
	var overlay: NSView?
	var isPlayPauseButtonEnabled = true
	var isTrimmerCollapsible = false
	var timeRangeDidChange: ((ClosedRange<Double>) -> Void)?

	func makeNSViewController(context: Context) -> NSViewControllerType {
		.init(
			playerItem: .init(asset: asset),
			controlsStyle: controlsStyle,
			timeRangeDidChange: timeRangeDidChange
		)
	}

	func updateNSViewController(_ nsViewController: NSViewControllerType, context: Context) {
		if asset != nsViewController.currentItem.asset {
			let item = AVPlayerItem(asset: asset)
			forceAVPlayerToRedraw(item: item)
			item.playbackRange = nsViewController.currentItem.playbackRange
			nsViewController.currentItem = item
		}

		// Always update video composition based on preview state.
		// When preview is ON, use custom compositor. When OFF, clear it so AVPlayer handles rotation.
		let currentItem = nsViewController.currentItem
		if
			currentItem.videoComposition == nil,
			shouldShowPreview,
			fullPreviewState.canShowPreview
		{
			forceAVPlayerToRedraw(item: currentItem)
		}

		let didUpdatePreviewState = updatePreviewState(nsViewController)
		forceAVPlayerToRedraw(item: currentItem, forceRedraw: didUpdatePreviewState)

		nsViewController.loopPlayback = loopPlayback
		nsViewController.bouncePlayback = bouncePlayback
		nsViewController.player.defaultRate = Float(speed)
		if nsViewController.player.rate != 0 {
			nsViewController.player.rate = nsViewController.player.rate > 0 ? Float(speed) : -Float(speed)
		}
		nsViewController.overlay = overlay
		nsViewController.isTrimmerCollapsible = isTrimmerCollapsible
		nsViewController.isPlayPauseButtonEnabled = isPlayPauseButtonEnabled
	}

	/**
	Update the preview state.

	- Returns: True if state was updated and needs a redraw, false otherwise.
	*/
	func updatePreviewState(_ controller: NSViewControllerType) -> Bool {
		guard
			let previewVideoCompositor = controller.currentItem.customVideoCompositor as? PreviewVideoCompositor
		else {
			return false
		}

		let previewCheckerboardParams = CompositePreviewFragmentUniforms(
			isDarkMode: colorScheme.isDark,
			videoBounds: controller.playerView.videoBounds
		)

		return previewVideoCompositor.updateState(
			state: .init(
				shouldShowPreview: shouldShowPreview,
				fullPreviewState: fullPreviewState,
				previewCheckerboardParams: previewCheckerboardParams
			)
		)
	}

	/**
	Sets or clears the video composition based on preview state.

	When preview is OFF, we don't use the custom compositor so AVPlayer handles rotation via `preferredTransform` normally.
	When preview is ON, we use the custom compositor which renders the preview overlay.
	*/
	func forceAVPlayerToRedraw(item: AVPlayerItem, forceRedraw: Bool = false) {
		guard let assetVideoComposition = (asset as? PreviewableComposition)?.videoComposition else {
			return
		}

		let shouldUsePreviewCompositor = shouldShowPreview && fullPreviewState.canShowPreview
		let targetVideoComposition = shouldUsePreviewCompositor ? assetVideoComposition : nil
		let hasCompositionStateChanged = (item.videoComposition != nil) != (targetVideoComposition != nil)
		guard
			forceRedraw || hasCompositionStateChanged
		else {
			return
		}

		item.videoComposition = targetVideoComposition
	}
}

// TODO: Move more of the logic here over to the SwiftUI view.
/**
A view controller containing AVPlayerView and also extending possibilities for trimming (view) customization.
*/
final class TrimmingAVPlayerViewController: NSViewController {
	private(set) var timeRange: ClosedRange<Double>?
	private let playerItem: AVPlayerItem
	fileprivate let player: LoopingPlayer
	private let controlsStyle: AVPlayerViewControlsStyle
	private let timeRangeDidChange: ((ClosedRange<Double>) -> Void)?
	private var cancellables = Set<AnyCancellable>()
	private var currentItemDurationRange: ClosedRange<Double>?

	private var overlayContainer: OverlayContainerView?

	fileprivate var overlay: NSView? {
		didSet {
			guard oldValue != overlay else {
				return
			}

			oldValue?.removeFromSuperview()
			placeOverlay()
		}
	}

	fileprivate var isTrimmerCollapsible = false {
		didSet {
			guard isTrimmerCollapsible != oldValue else {
				return
			}

			if !isTrimmerCollapsible {
				overlayContainer?.removeFromSuperview()
				overlayContainer = nil
			}

			// Place overlay first so the container is created before the toggle button,
			// ensuring the button is always on top in the z-order.
			placeOverlay()
			collapsibleTrimmer?.isCollapsible = isTrimmerCollapsible
		}
	}

	/**
	Places the overlay in the correct layer based on crop mode.

	When cropping, the overlay goes on `playerView` (via a container) so crop handles sit above the player controls. Hit testing passes through to the trimmer area.

	When not cropping, the overlay goes on `contentOverlayView` (behind controls) so the trimmer is fully accessible.
	*/
	private func placeOverlay() {
		guard let overlay else {
			return
		}

		overlay.removeFromSuperview()
		overlay.removeConstraints(overlay.constraints)

		if isTrimmerCollapsible {
			if overlayContainer == nil {
				let container = OverlayContainerView()
				container.passthroughView = _collapsibleTrimmer?.trimmerWrapper
				playerView.addSubview(container)
				container.translatesAutoresizingMaskIntoConstraints = false
				NSLayoutConstraint.activate([
					container.leadingAnchor.constraint(equalTo: playerView.leadingAnchor),
					container.topAnchor.constraint(equalTo: playerView.topAnchor),
					container.trailingAnchor.constraint(equalTo: playerView.trailingAnchor),
					container.bottomAnchor.constraint(equalTo: playerView.bottomAnchor)
				])
				overlayContainer = container
			}

			guard let overlayContainer else {
				return
			}

			overlayContainer.addSubview(overlay)
			overlay.translatesAutoresizingMaskIntoConstraints = false

			let videoBounds = playerView.videoBounds
			NSLayoutConstraint.activate([
				overlay.leadingAnchor.constraint(equalTo: overlayContainer.leadingAnchor, constant: videoBounds.origin.x),
				overlay.topAnchor.constraint(equalTo: overlayContainer.topAnchor, constant: videoBounds.origin.y),
				overlay.widthAnchor.constraint(equalToConstant: videoBounds.size.width),
				overlay.heightAnchor.constraint(equalToConstant: videoBounds.size.height)
			])
		} else {
			guard let contentOverlayView = playerView.contentOverlayView else {
				return
			}

			let videoBounds = playerView.videoBounds

			contentOverlayView.addSubview(overlay)
			overlay.translatesAutoresizingMaskIntoConstraints = false
			NSLayoutConstraint.activate([
				overlay.leadingAnchor.constraint(equalTo: contentOverlayView.leadingAnchor, constant: videoBounds.origin.x),
				overlay.topAnchor.constraint(equalTo: contentOverlayView.topAnchor, constant: videoBounds.origin.y),
				overlay.widthAnchor.constraint(equalToConstant: videoBounds.size.width),
				overlay.heightAnchor.constraint(equalToConstant: videoBounds.size.height)
			])
		}
	}

	fileprivate var isPlayPauseButtonEnabled = true {
		didSet {
			guard isPlayPauseButtonEnabled != oldValue else {
				return
			}

			playerView.setPlayPauseButton(isEnabled: isPlayPauseButtonEnabled)
		}
	}

	var playerView: TrimmingAVPlayerView { view as! TrimmingAVPlayerView }

	// We cannot use lazy here because at start this will be `nil` before the player is initialized (there won't be an AVTrimView).
	private var _collapsibleTrimmer: CollapsibleTrimmer?

	private var collapsibleTrimmer: CollapsibleTrimmer? {
		if let _collapsibleTrimmer {
			return _collapsibleTrimmer
		}

		// Needed so that it will hide the trimmer when it is outside the view. This must be done now (as opposed to `viewDidLoad`) because layer is nil in `viewDidLoad`.
		playerView.layer?.masksToBounds = true

		guard
			let avTrimView = (playerView.firstSubview(deep: true) { $0.simpleClassName == "AVTrimView" })?.superview,
			let avTrimViewParent = avTrimView.superview?.superview
		else {
			return nil
		}

		let trimmer = CollapsibleTrimmer(
			avTrimView: avTrimView,
			avTrimViewParent: avTrimViewParent,
			playerView: playerView
		)

		overlayContainer?.passthroughView = trimmer.trimmerWrapper

		_collapsibleTrimmer = trimmer
		return trimmer
	}

	/**
	The minimum duration the trimmer can be set to.
	*/
	var minimumTrimDuration = 0.1 {
		didSet {
			playerView.minimumTrimDuration = minimumTrimDuration
		}
	}

	var loopPlayback: Bool {
		get { player.loopPlayback }
		set {
			player.loopPlayback = newValue
		}
	}

	var bouncePlayback: Bool {
		get { player.bouncePlayback }
		set {
			player.bouncePlayback = newValue
		}
	}

	/**
	Get or set the current player item.

	When setting an item, it preserves the current playback rate (which means pause state too), playback position, and trim range.
	*/
	var currentItem: AVPlayerItem {
		get { player.currentItem! }
		set {
			let rate = player.rate
			let playbackPercentage = player.currentItem?.playbackProgress ?? 0
			let playbackRangePercentage = player.currentItem?.playbackRangePercentage

			player.replaceCurrentItem(with: newValue)

			DispatchQueue.main.async { [self] in
				player.rate = rate
				player.currentItem?.seek(toPercentage: playbackPercentage)
				player.currentItem?.playbackRangePercentage = playbackRangePercentage
			}
		}
	}

	init(
		playerItem: AVPlayerItem,
		controlsStyle: AVPlayerViewControlsStyle = .inline,
		timeRangeDidChange: ((ClosedRange<Double>) -> Void)? = nil
	) {
		self.playerItem = playerItem
		self.player = LoopingPlayer(playerItem: playerItem)
		self.controlsStyle = controlsStyle
		self.timeRangeDidChange = timeRangeDidChange
		supe
```

### Core Architecture Module: `Gifski/Constants.swift`
```
import SwiftUI
import CoreTransferable
import AVFoundation

enum Constants {
	static let allowedFrameRate = 3.0...50.0
	static let loopCountRange = 0...100
}

extension Defaults.Keys {
	static let outputQuality = Key<Double>("outputQuality", default: 1)
	static let outputSpeed = Key<Double>("outputSpeed", default: 1)
	static let outputFPS = Key<Int>("outputFPS", default: 10)
	static let loopGIF = Key<Bool>("loopGif", default: true)
	static let bounceGIF = Key<Bool>("bounceGif", default: false)
	static let loopDelay = Key<Double>("loopDelay", default: 0)
	static let suppressKeyframeWarning = Key<Bool>("suppressKeyframeWarning", default: false)
	static let suppressLargeGIFWarning = Key<Bool>("suppressLargeGIFWarning", default: false)
	static let autoSaveToDownloads = Key<Bool>("autoSaveToDownloads", default: false)
}

enum Route: Hashable {
	case edit(URL, AVAsset, AVAsset.VideoMetadata)
	case conversion(GIFGenerator.Conversion)
	case completed(Data, URL, sourceURL: URL)
}

struct ExportableGIF: Transferable {
	let url: URL

	static var transferRepresentation: some TransferRepresentation {
		FileRepresentation(exportedContentType: .gif) { .init($0.url) }
			// TODO: Does not work when using `.fileExporter`. (macOS 14.3)
			.suggestedFileName { $0.url.filename }
	}
}

```

### Core Architecture Module: `Gifski/ConversionScreen.swift`
```
import SwiftUI
import AVFoundation
import DockProgress

struct ConversionScreen: View {
	@Environment(\.dismiss) private var dismiss
	@Environment(AppState.self) private var appState
	@Default(.autoSaveToDownloads) private var isAutoSaveToDownloadsEnabled
	@State private var progress = 0.0
	@State private var timeRemaining: String?
	@State private var startInstant: ContinuousClock.Instant?
	@State private var timeRemainingEstimator = TimeRemainingEstimator()
	private let clock = ContinuousClock()

	let conversion: GIFGenerator.Conversion

	var body: some View {
		VStack {
			ProgressView(value: progress)
				.progressViewStyle(
					.ssCircular(
						fill: LinearGradient(
							gradient: .init(
								colors: [
									.purple,
									.pink,
									.orange
								]
							),
							startPoint: .top,
							endPoint: .bottom
						),
						lineWidth: 30,
						text: "Converting"
					)
				)
				.frame(width: 300, height: 300)
				.overlay {
					Group {
						if let timeRemaining {
							Text(timeRemaining)
								.font(.subheadline)
								.monospacedDigit()
								.opacity(timeRemainingOpacity)
								.offset(y: 24)
								.animation(.easeOut(duration: 0.2), value: timeRemainingOpacity)
						}
					}
					.animation(.default, value: timeRemaining == nil)
				}
				.offset(y: -16) // Makes it centered (needed because of toolbar).
		}
		.fillFrame()
		.onKeyboardShortcut(.escape, modifiers: []) {
			dismiss()
		}
		.navigationTitle("")
		.task(priority: .utility) {
			do {
				try await convert()
			} catch {
				guard !error.isCancelled else {
					return
				}

				print("Conversion error:", error)
				appState.error = error
				dismiss()
			}
		}
		.activity(options: .userInitiated, reason: "Converting")
	}

	func convert() async throws {
		await MainActor.run {
			startInstant = clock.now
			timeRemainingEstimator = .init()
			timeRemaining = nil
		}

		defer {
			Task { @MainActor in
				timeRemaining = nil
				DockProgress.resetProgress()
			}
		}

		let data = try await GIFGenerator.run(conversion) { progress in
			Task { @MainActor in
				self.progress = progress
				updateEstimatedTimeRemaining(for: progress)
				DockProgress.progress = progress
			}
		}

		try Task.checkCancellation()

		let filename = conversion.sourceURL.filenameWithoutExtension
		let url = try data.writeToUniqueTemporaryFile(filename: filename, contentType: .gif)
		autoSaveToDownloadsIfNeeded(data, filename: filename)
		try? url.setAppAsItemCreator()

		try await Task.sleep(for: .seconds(1)) // Let the progress circle finish.

		// TODO: Support task cancellation.
		// TODO: Make sure it deinits too.

//		appState.navigationPath.removeLast()
//		appState.navigationPath.append(.completed(data))

		// This works around some race issue where it would sometimes end up with edit screen after conversion.
		var path = appState.navigationPath
		path.removeLast()
		path.append(.completed(data, url, sourceURL: conversion.sourceURL))
		appState.navigationPath = path
	}

	private func autoSaveToDownloadsIfNeeded(_ data: Data, filename: String) {
		guard isAutoSaveToDownloadsEnabled else {
			return
		}

		do {
			_ = try data.writeToUniqueFile(in: .downloadsDirectory, filename: filename, contentType: .gif)
		} catch {
			appState.error = error
		}
	}

	@MainActor
	private func updateEstimatedTimeRemaining(for progress: Double) {
		guard
			let startInstant
		else {
			timeRemaining = nil
			return
		}

		let now = clock.now
		let update = timeRemainingEstimator.updateDisplay(
			progress: progress,
			startInstant: startInstant,
			now: now
		)

		switch update {
		case .hide:
			timeRemaining = nil
		case .show(let remaining):
			let usesSeconds = timeRemainingEstimator.usesSeconds(for: remaining)
			let allowedUnits: Set<Duration.UnitsFormatStyle.Unit> = usesSeconds ? [.seconds] : [.hours, .minutes]
			let maximumUnitCount = usesSeconds ? 1 : 2
			let formatStyle: Duration.UnitsFormatStyle = .units(
				allowed: allowedUnits,
				width: .wide,
				maximumUnitCount: maximumUnitCount
			)
			let formatted = remaining.formatted(formatStyle)
			timeRemaining = "About \(formatted) remaining"
		case .noChange:
			break
		}
	}

	private var timeRemainingOpacity: Double {
		// Fade out the estimate near completion to avoid abrupt disappearance.
		let fadeStart = 0.95
		let fadeProgress = ((progress - fadeStart) / (1 - fadeStart)).clamped(to: 0...1)
		return 1 - fadeProgress
	}
}

struct TimeRemainingEstimator {
	enum Update {
		case hide
		case show(Duration)
		case noChange
	}

	private let smoothingFactor: Double
	private let minimumSampleInterval: Duration
	private let minimumUpdateInterval: Duration
	private let secondsStep: Duration
	private let secondsDisplayThreshold: Duration
	private let bufferDuration: Duration
	private let skipThreshold: Duration
	private var lastSample: (progress: Double, instant: ContinuousClock.Instant)?
	private var smoothedSpeed: Double?
	private var lastPresentation: (remaining: Duration, instant: ContinuousClock.Instant)?

	init(
		smoothingFactor: Double = 0.3,
		minimumSampleInterval: Duration = .seconds(0.2),
		minimumUpdateInterval: Duration = .seconds(5),
		secondsStep: Duration = .seconds(10),
		secondsDisplayThreshold: Duration = .seconds(60),
		bufferDuration: Duration = .seconds(3),
		skipThreshold: Duration = .seconds(10)
	) {
		self.smoothingFactor = smoothingFactor.clamped(to: 0...1)
		self.minimumSampleInterval = max(.zero, minimumSampleInterval)
		self.minimumUpdateInterval = max(.zero, minimumUpdateInterval)
		self.secondsStep = max(.seconds(1), secondsStep)
		self.secondsDisplayThreshold = max(.seconds(60), secondsDisplayThreshold)
		self.bufferDuration = max(.zero, bufferDuration)
		self.skipThreshold = max(.zero, skipThreshold)
	}

	/**
	Updates the estimator with a progress sample and returns the raw remaining duration.
	*/
	mutating func update(progress: Double, instant: ContinuousClock.Instant) -> Duration? {
		if let lastSample {
			let progressDelta = progress - lastSample.progress
			let timeDelta = lastSample.instant.duration(to: instant)

			if progressDelta > 0, timeDelta >= minimumSampleInterval {
				let instantaneousSpeed = progressDelta / Self.seconds(from: timeDelta)
				smoothedSpeed = smoothedSpeed.map {
					(smoothingFactor * instantaneousSpeed) + ((1 - smoothingFactor) * $0)
				} ?? instantaneousSpeed

				self.lastSample = (progress, instant)
			} else if progressDelta <= 0 || timeDelta <= .zero {
				self.lastSample = (progress, instant)
			}
		} else {
			lastSample = (progress, instant)
		}

		guard
			let smoothedSpeed,
			smoothedSpeed > 0
		else {
			return nil
		}

		let remainingProgress = 1 - progress
		guard remainingProgress > 0 else {
			return .zero
		}

		return .seconds(remainingProgress / smoothedSpeed)
	}

	/**
	Returns the next display update decision for the current progress sample.
	*/
	mutating func updateDisplay(
		progress: Double,
		startInstant: ContinuousClock.Instant,
		now: ContinuousClock.Instant
	) -> Update {
		if progress >= 1 {
			resetPresentation()
			return .hide
		}

		guard let remaining = update(progress: progress, instant: now) else {
			return lastPresentation == nil ? .hide : .noChange
		}

		guard remaining > .zero else {
			return lastPresentation == nil ? .hide : .noChange
		}

		if lastPresentation == nil {
			let elapsed = max(.zero, startInstant.duration(to: now))
			let total = elapsed + remaining

			guard
				elapsed > bufferDuration,
				total > skipThreshold
			else {
				return .hide
			}
		}

		guard let presentedRemaining = updatePresentation(remaining: remaining, now: now) else {
			return .noChange
		}

		return .show(presentedRemaining)
	}

	/**
	Quantizes and throttles display updates for a remaining duration.
	*/
	mutating func updatePresentation(
		remaining: Duration,
		now: ContinuousClock.Instant
	) -> Duration? {
		let quantizedRemaining = Self.quantizedRemaining(
			remaining: remaining,
			secondsStep: secondsStep,
			secondsDisplayThreshold: secondsDisplayThreshold
		)

		if let lastPresentation, quantizedRemaining > lastPresentation.remaining {
			return nil
		}

		if let lastPresentation {
			let wasSeconds = lastPresentation.remaining < secondsDisplayThreshold
			let isSeconds = quantizedRemaining < secondsDisplayThreshold
			let styleChanged = wasSeconds != isSeconds
			if !styleChanged, lastPresentation.instant.duration(to: now) < minimumUpdateInterval {
				return nil
			}

			guard styleChanged || quantizedRemaining != lastPresentation.remaining else {
				return nil
			}
		}

		lastPresentation = (quantizedRemaining, now)

		return quantizedRemaining
	}

	/**
	Returns whether the remaining duration should be displayed using seconds.
	*/
	func usesSeconds(for remaining: Duration) -> Bool {
		remaining < secondsDisplayThreshold
	}

	/**
	Quantizes a remaining duration into a stable display value.
	*/
	static func quantizedRemaining(
		remaining: Duration,
		secondsStep: Duration,
		secondsDisplayThreshold: Duration
	) -> Duration {
		let remainingSeconds = max(0, Self.seconds(from: remaining))
		let thresholdSeconds = max(1, Self.seconds(from: secondsDisplayThreshold))

		if remainingSeconds >= thresholdSeconds {
			let minutes = max(1, Int(remainingSeconds / 60))
			return .seconds(Double(minutes * 60))
		}

		let stepSeconds = max(1, Self.seconds(from: secondsStep))
		let quantizedSeconds = (remainingSeconds / stepSeconds).rounded(.down) * stepSeconds
		let clampedSeconds = max(stepSeconds, quantizedSeconds)
		let cappedSeconds = min(clampedSeconds, thresholdSeconds - 1)
		return .seconds(cappedSeconds)
	}

	private static func seconds(from duration: Duration) -> Double {
		Double(duration.nanoseconds) / 1_000_000_000
	}

	private mutating func resetPresentation() {
		lastPresentation = nil
	}
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #332** (2025-07-08): **Bounce causes frame flash**
  *Symptoms*: https://github.com/sindresorhus/Gifski/pull/329#issuecomment-2811893937
  **Post-Mortem & Fix Analysis**:
  > @mmulet This has the bounty from:  - https://issuehunt.io/r/sindresorhus/react-router-util/issues/1 $40 - https://issuehunt.io/r/sindresorhus/strict-import/issues/2 $40 - https://issuehunt.io/r/sindresorhus/detect-indent/issues/7 $40

- **Issue #261** (2022-01-10): **Artifacts on 0-20% quality with screen recording**
  *Symptoms*: GIF: https://user-images.githubusercontent.com/170270/148274421-a1d41304-e418-45ea-b21c-69a45289afaf.gif  Source video: https://user-images.githubusercontent.com/170270/148274565-5ec81390-60fc-4eab-ad18-b2839deca842.mov  @kornelski Is there anything the gifski library can do about this?
  **Post-Mortem & Fix Analysis**:
  > I don't think it's a bug per se — it is working as designed. When you ask for low quality, you get frames limited to very few colors. MPEG compression adds changes all over the place, which requires redraw of a large area, which then is a mess, because it isn't allowed to use enough colors to redraw it nicely.  This case could have been handled better if I optimized specifically for it, but I never did. The quality option is documented as: "1-100, but useful range is 50-100" 
  > As a temporary fix, what do you think of making the "Quality" slider range be constrained to `0.2...1`?
  > Yes.

- **Issue #247** (2021-09-11): **End frames dropped if they're the same**
  *Symptoms*: Hi,  I have a video that shows an animation that comes to rest in a final state and the video shows that final state for 2-3 seconds. However, when this video is converted to a .gif, the final state is only shown for a single frame. I'd like the gif to be as long as the video without it truncating duplicate frames at the end.  Or at least give me a checkbox to allow me to preserve all the frames if this behaviour is an optimisation in the app.  Here is the source and output showing what I mean.  https://user-images.githubusercontent.com/2559953/124855986-23744e00-dfed-11eb-8479-a275ef0da2e3.mp4 https://user-images.githubusercontent.com/2559953/124855971-1a837c80-dfed-11eb-8f56-ead0898ec449.gif 
  **Post-Mortem & Fix Analysis**:
  > There's unfortunately a bug in macOS 11 where videos with few key frames fail to decode many frames. This is completely out of our control. We plan to move to a different way to generate the frames, but it's a lot of work, so will take some time: https://github.com/sindresorhus/Gifski/issues/229  A quick workaround is to export with a higher frame rate and use ProRes. If you cannot re-export, you could convert the video with a video converter app like [Permute](https://apps.apple.com/us/app/permute-3/id1444998321?mt=12).  I just tried converting the video you shared to ProRes and it then worked just fine with Gifski:  ![124855986-23744e00-dfed-11eb-8479-a275ef0da2e3 2](https://user-images.githubusercontent.com/170270/125160852-6aa73e00-e1a9-11eb-91ea-903b601f6646.gif)  [124855986-23744e00-dfed-11eb-8479-a275ef0da2e3.mov.zip](https://github.com/sindresorhus/Gifski/files/6795112/124855986-23744e00-dfed-11eb-8479-a275ef0da2e3.mov.zip)  ---  Apple bug report: https://github.com
  > This was fixed in Gifski v2.17.0: https://apps.apple.com/app/id1351639930

- **Issue #231** (2021-06-12): **Produces empty GIF for very short video**
  *Symptoms*: @kornelski https://github.com/sindresorhus/Gifski/pull/222 introduced an issue where this video produces an empty invalid file: [Short.mp4.zip](https://github.com/sindresorhus/Gifski/files/5950638/Short.mp4.zip)  Before this change:  ![Short](https://user-images.githubusercontent.com/170270/107351122-d30bc980-6afc-11eb-960f-a85488ab0673.gif)  After:  [Short.gif.zip](https://github.com/sindresorhus/Gifski/files/5950674/Short.gif.zip)  ---  I realize the video is way too short and weird, but we should never produce an invalid GIF. According to logging, it successfully generated 2 frames and passed them to libgifski.
  **Post-Mortem & Fix Analysis**:
  > Fixed in https://github.com/ImageOptim/gifski/commit/2f62fbecf57430d3d5b88c817378b570be2c9740

- **Issue #202** (2021-01-22): **Failed to generate frame: Cannot Decode**
  *Symptoms*: macOS v.11.0 Beta (20A5364e) Gifski v.2.9.0 (39)  **Screenshot:** <img width="476" alt="Bildschirmfoto 2020-09-10 um 16 26 45" src="https://user-images.githubusercontent.com/62497891/92745237-7906ac80-f382-11ea-806b-99d2954212a0.png">  **Video recording:** [Bildschirmaufnahme 2020-09-10 um 16.18.34.zip](https://github.com/sindresorhus/Gifski/files/5202315/Bildschirmaufnahme.2020-09-10.um.16.18.34.zip) 
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting. Are you able to reproduce it again if you convert with the exact same file and settings? What settings did you convert with (can you take a screenshot)? I was not able to reproduce this myself.
  > I've got the same error on a screen recording from Big Sur. I fails on a specific frame, every time. I can trim the problematic frame out of the animation, and it won't fail then.  (I didn't report, since I was going to investigate myself, but needed to update Xcode, and that took so long that I forgot about the original issue :D) 
  > @sindresorhus  This is a problem only on Big Sur.  Sometimes it freezes, i have to kill the process forcibly. But this rarely happens. [Test 1.zip](https://github.com/sindresorhus/Gifski/files/5214090/Test.1.zip) [Test 2.zip](https://github.com/sindresorhus/Gifski/files/5214091/Test.2.zip) 

- **Issue #186** (2020-04-06): **"Couldn't open file" when started recording & progress isn't reported correctly.**
  *Symptoms*: This is my workflow: 1. Run simulator recording ``` xcrun simctl io booted recordVideo "$1" ``` 1. Stop & open the file with Gifski 1. Tap convert  What happens is that most of the time I tap convert it says "Couldn't open file", I have to wait (or tap on buttons, not sure which one works) and it converts eventually. Also when it finally starts converting, the progress reported isn't entirely accurate since it finishes at about 50%.  There is no particular video that triggers that as it is consistently reproducible. I'm thinking if this has something to do with APFS?
  **Post-Mortem & Fix Analysis**:
  > > Also when it finally starts converting, the progress reported isn't entirely accurate since it finishes at about 50%.  This is caused by #187.
  > Fixture that reproduces the issue: [simulator-recording.mp4.zip](https://github.com/sindresorhus/Gifski/files/4435996/simulator-recording.mp4.zip)  I have looked into the problem and it turns out the problem is that the recording contains blank frames at the start. If you open the video in QuickTime and go to the start, you'll see that it's blank (black) for some milliseconds. This is IMHO a bug in `simctl`, but we should still work around it as there could be valid videos with blank frames at the start too.

- **Issue #170** (2026-04-30): **Improve time estimate accuracy**
  *Symptoms*: Moving issue from #111 as requested.  > The remaining time estimate is a bit off. Looking at the progress circle it looks like the remaining time should be pretty predictable as it seems like each percentage point takes roughly a constant amount of time to process. I think perhaps the time estimate should be recalculated after each percentage point with the following formula: ( ( 100 / number_of_percentage_points_so_far ) - 1 ) * time_elapsed_so_far.  > I've timed it and converting a video took ~40s for me over a ~60s estimate, nothing particularly off but for me the countdown seems to be counting down a little faster than it should.  > I've just tried converting a video with Gifski and at the point where the app said there were 40s left, after about ~60% of the video had been processed already, I started a stopwatch and when the app finished the stopwatch was at ~32s.  
  **Post-Mortem & Fix Analysis**:
  > // @allewun In case you have time and interest in looking into this. No worries if not though.
  > Seems to be the same formula?   ``` Old: (timeElapsed / percentComplete) * (1 - percentComplete) New: ((100 / percentagePointsComplete) - 1) * timeElapsed      timeElapsed => t     percentComplete => p     percentagePointsComplete => p*100  Old: (t/p) * (1-p)   = t/p - t New: ((100/(100*p)) - 1) * t   = t/p - t ``` 
  > > New: ((100/(100*p)) - 1) * t  There's an extra 100 there, I think it should instead be:  ``` New: ((100/p) - 1) * t   = 100t/p - t ```  But I'm not sure in both expressions `p` is the same number, like in mine I'm expecting it to be a number in the 0~100 range, while in the old formula it's probably a number in the 0~1 range or it wouldn't make a lot of sense, and I think this makes the two expressions effectively equivalent.  Given how the expressions are equivalent, and they seem rational, maybe the problem is somewhere else.  I don't have many ideas on how to tackle this, mainly because I'm not sure how the video -> gif conversion actually works, but maybe the issue is that different portions of the video get converted at different rates, and/or that the computer stars converting slower/faster at some point (maybe another CPU-heavy process gets spawned, maybe it hits thermal throttling or whatever), to which a possible improvement could be to extrapolate a conversion 

- **Issue #164** (2019-12-02): **Crashes when almost complete**
  *Symptoms*:  <!-- I got your error message "We have been trying to track down this issue for a long time, but we have been unable to reproduce it. It would be awesome if you could send an email to sindresorhus@gmail.com with the video or some information about the video file you tried to convert so we can fix this issue. Error Domain=AVFoundationErrorDomain Code=-11832 "Cannot Open" UserInfo={NSLocalizedFailureReason=This media cannot be used., NSLocalizedDescription=Cannot Open, NSUnderlyingError=0x600000454250 {Error Domain=NSOSStatusErrorDomain Code=-12431 "(null)"}}" --> So here is the video I'm trying to convert.  The video was taken with a Samsung phone running Android 4.4,; I have no idea if it matters?  Action taken was reduce to 25%, lowered the quality, FPS was 15.  The conversion stopped at 96% displayed.  My first video that failed was to large to email , so, I have made a shorter video that also failed with the same error message, for your reference the filename is Gifski.mp4: [Gifski.mp4.zip](https://github.com/sindresorhus/Gifski/files/3909493/Gifski.mp4.zip)   --- Gifski 2.3.0 (26) - com.sindresorhus.Gifski macOS 10.13.6 iMac10,1
  **Post-Mortem & Fix Analysis**:
  > Duplicate of #119 
  > Thank you so much for sharing a video that reproduces the issue. I have been able to track down the issue and I'll fix it soon.

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

### Incident Patch 1: `b519c8ce` (2026-07-01)
**Commit Message**: Fix blank preview for screen recordings

Fixes #353

**File**: `Gifski.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +4/-4)
```diff
@@ -6,8 +6,8 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/sindresorhus/Defaults",
       "state" : {
-        "revision" : "5bfac4928f000fabdbef7e4ed0251399bb0841c9",
-        "version" : "9.0.8"
+        "revision" : "00a7465a0668a87fa159e779b9d80f1f9652357e",
+        "version" : "9.0.9"
       }
     },
     {
@@ -33,8 +33,8 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/getsentry/sentry-cocoa",
       "state" : {
-        "revision" : "2c420d31d0c31b525fa9e7c552ef0fc9d924befc",
-        "version" : "9.17.1"
+        "revision" : "d3562ee73e56a7b0b8319ec613db3c529924f07a",
+        "version" : "9.19.1"
       }
     },
     {
```

**File**: `Gifski/Components/TrimmingAVPlayer.swift` (modified, +29/-8)
```diff
@@ -388,6 +388,7 @@ final class TrimmingAVPlayerView: AVPlayerView {
 	private var timeRangeCancellable: AnyCancellable?
 	private var trimmingCancellable: AnyCancellable?
 	private var readyForDisplayCancellable: AnyCancellable?
+	private var checkerboardVideoBounds: CGRect?
 
 	/**
 	The minimum duration the trimmer can be set to.
@@ -398,6 +399,12 @@ final class TrimmingAVPlayerView: AVPlayerView {
 		print("TrimmingAVPlayerView - DEINIT")
 	}
 
+	override func layout() {
+		super.layout()
+
+		updateCheckerboardViewIfNeeded()
+	}
+
 	// TODO: This should be an AsyncSequence.
 	fileprivate func observeTrimmedTimeRange(_ updateClosure: @escaping (ClosedRange<Double>) -> Void) {
 		var skipNextUpdate = false
@@ -448,13 +455,11 @@ final class TrimmingAVPlayerView: AVPlayerView {
 	}
 
 	private func observeReadyForDisplay() {
-		// Wait for the video to be ready for display before adding the checkerboard,
-		// ensuring videoBounds is valid.
 		readyForDisplayCancellable = publisher(for: \.isReadyForDisplay)
 			.first(where: \.self)
 			.receive(on: DispatchQueue.main)
 			.sink { [weak self] _ in
-				self?.addCheckerboardView()
+				self?.updateCheckerboardViewIfNeeded()
 			}
 	}
 
@@ -523,16 +528,32 @@ final class TrimmingAVPlayerView: AVPlayerView {
 			}
 	}
 
-	fileprivate func addCheckerboardView() {
-		// Remove any existing checkerboard view to prevent stacking multiple on top of each other.
-		for subview in contentOverlayView?.subviews ?? [] where subview.identifier == Self.checkerboardViewIdentifier {
+	private func updateCheckerboardViewIfNeeded() {
+		guard let contentOverlayView else {
+			return
+		}
+
+		// Large videos can become ready before AVPlayer has computed `videoBounds`. Wait for a real rect so the checkerboard does not cover the whole player.
+		let clearRect = videoBounds
+		guard !clearRect.isEmpty else {
+			return
+		}
+
+		let existingCheckerboardViews = contentOverlayView.subviews.filter { $0.identifier == Self.checkerboardViewIdentifier }
+		let needsNewCheckerboardView = clearRect != checkerboardVideoBounds || existingCheckerboardViews.isEmpty
+		guard needsNewCheckerboardView else {
+			return
+		}
+
+		for subview in existingCheckerboardViews {
 			subview.removeFromSuperview()
 		}
 
-		let overlayView = NSHostingView(rootView: CheckerboardView(clearRect: videoBounds))
+		let overlayView = NSHostingView(rootView: CheckerboardView(clearRect: clearRect))
 		overlayView.identifier = Self.checkerboardViewIdentifier
-		contentOverlayView?.addSubview(overlayView)
+		contentOverlayView.addSubview(overlayView)
 		overlayView.constrainEdgesToSuperview()
+		checkerboardVideoBounds = clearRect
 	}
 
 	private static let checkerboardViewIdentifier = NSUserInterfaceItemIdentifier("CheckerboardView")
```

---

### Incident Patch 2: `a1ce47f4` (2026-06-13)
**Commit Message**: Fix window drop not triggering the file-access permission prompt

**File**: `Gifski/MainScreen.swift` (modified, +21/-3)
```diff
@@ -49,12 +49,30 @@ struct MainScreen: View {
 					$0.hasFileURLs
 				},
 				onPerform: {
-					// Validate that the dropped file is a movie before `AppState.start(_:)` resets navigation for the new import.
-					guard let url = $0.firstMovieFileURL else {
+					// Validate synchronously that the dropped file is a movie before `AppState.start(_:)` resets navigation for the new import.
+					guard $0.firstMovieFileURL != nil else {
 						return false
 					}
 
-					appState.start(url)
+					/*
+					IMPORTANT: Open the URL from the item provider, not from `firstMovieFileURL`/the drag pasteboard.
+
+					`NSItemProvider.getURL()` goes through the sandbox broker (Powerbox), which vends a security-scoped URL and shows the macOS file-access permission prompt (e.g. for the Downloads/Desktop folder) when needed. Reading the URL directly from the drag pasteboard returns a plain `file://` URL that bypasses the broker, so the app is never granted access, the prompt never appears, and the open silently fails. We use the pasteboard read above only for synchronous movie-type validation, never to actually open the file.
+
+					Do not "simplify" this back to opening `firstMovieFileURL` directly. That regressed window drops in 3.0.x.
+					*/
+					guard let itemProvider = $0.itemProviders(for: [.fileURL]).first else {
+						return false
+					}
+
+					Task {
+						guard let url = await itemProvider.getURL() else {
+							return
+						}
+
+						appState.start(url)
+					}
+
 					return true
 				}
 			)
```

**File**: `Gifski/Utilities.swift` (modified, +2/-0)
```diff
@@ -5379,6 +5379,8 @@ extension DropInfo {
 
 	/**
 	The first file URL in the current drag operation that looks like a movie.
+
+	- Important: This reads directly from the drag pasteboard, which returns a plain `file://` URL that bypasses the sandbox broker. Use it only for synchronous validation, never to actually open the file. Opening it would skip the file-access permission prompt and silently fail. To open a dropped file, resolve the URL via `NSItemProvider.getURL()` instead.
 	*/
 	var firstMovieFileURL: URL? {
 		fileURLs().first {
```

---

### Incident Patch 3: `55e9a26d` (2026-06-11)
**Commit Message**: Fix alpha channel being lost when converting transparent videos

The sequential frame reader introduced for performance drove frames through AVFoundation's built-in video compositor, which flattens the alpha channel to opaque. This lost transparency from alpha-capable sources like ProRes 4444. Replace it with a Core Image based compositor that crops, scales, and orients while preserving alpha.

**File**: `Gifski/ExportModifiedVideo.swift` (modified, +45/-26)
```diff
@@ -16,7 +16,7 @@ struct ExportModifiedVideoView: View {
 			}
 			.fileExporter(
 				isPresented: isFileExporterPresented,
-				item: exportableMP4,
+				item: exportableModifiedVideo,
 				defaultFilename: defaultExportModifiedFileName
 			) {
 				do {
@@ -36,15 +36,13 @@ struct ExportModifiedVideoView: View {
 			)
 	}
 
-	private var exportableMP4: ExportableMP4? {
-		guard case let .finished(url) = state else {
-			return nil
-		}
-		return ExportableMP4(url: url)
+	private var exportableModifiedVideo: ExportableModifiedVideo? {
+		state.finishedURL.map(ExportableModifiedVideo.init)
 	}
 
 	private var defaultExportModifiedFileName: String {
-		"\(sourceURL.filenameWithoutExtension) modified.mp4"
+		let fileExtension = state.finishedURL?.pathExtension ?? "mp4"
+		return "\(sourceURL.filenameWithoutExtension) modified.\(fileExtension)"
 	}
 
 	private var isProgressSheetPresented: Binding<Bool> {
@@ -75,7 +73,7 @@ struct ExportModifiedVideoView: View {
 			set: {
 				guard
 					!$0,
-					case let .finished(url) = state else {
+					let url = state.finishedURL else {
 					return
 				}
 				try? url.delete()
@@ -143,6 +141,14 @@ extension ExportModifiedVideoState {
 		}
 	}
 
+	var finishedURL: URL? {
+		guard case let .finished(url) = self else {
+			return nil
+		}
+
+		return url
+	}
+
 	/**
 	Update progress sheet visibility if the state is currently exporting.
 	- Returns: Whether the state is still exporting.
@@ -162,34 +168,43 @@ extension ExportModifiedVideoState {
 }
 
 /**
-Convert a source video to an `.mp4` using the same scale, speed, and crop as the exported `.gif`.
+Convert a source video using the same scale, speed, and crop as the exported `.gif`.
+
+Alpha-capable sources (for example, ProRes 4444) are exported as HEVC with alpha in a `.mov` to preserve transparency. Everything else is exported as an `.mp4`.
 - Returns: Temporary URL of the exported video.
 */
 func exportModifiedVideo(conversion: GIFGenerator.Conversion) async throws -> URL {
 	let (composition, compositionVideoTrack, sourceVideoTrack) = try await createComposition(
 		conversion: conversion
 	)
+
+	let hasAlpha = try await sourceVideoTrack.hasAlphaChannel
+	let preset = hasAlpha ? AVAssetExportPresetHEVCHighestQualityWithAlpha : AVAssetExportPresetHighestQuality
+	let fileType: AVFileType = hasAlpha ? .mov : .mp4
+	let fileExtension = hasAlpha ? "mov" : "mp4"
+
 	let videoComposition = try await createVideoComposition(
 		compositionVideoTrack: compositionVideoTrack,
 		sourceVideoTrack: sourceVideoTrack,
-		conversion: conversion
+		conversion: conversion,
+		preservingAlpha: hasAlpha
 	)
-	let outputURL = URL.temporaryDirectory.appending(path: "\(UUID().uuidString).mp4")
+	let outputURL = URL.temporaryDirectory.appending(path: "\(UUID().uuidString).\(fileExtension)")
 
 	let presets = AVAssetExportSession.allExportPresets()
-	guard presets.contains(AVAssetExportPresetHighestQuality) else {
+	guard presets.contains(preset) else {
 		throw ExportModifiedVideoView.Error.unableToCreateExportSession
 	}
-	guard await AVAssetExportSession.compatibility(ofExportPreset: AVAssetExportPresetHighestQuality, with: composition, outputFileType: .mp4) else {
+	guard await AVAssetExportSession.compatibility(ofExportPreset: preset, with: composition, outputFileType: fileType) else {
 		throw ExportModifiedVideoView.Error.unableToCreateExportSession
 	}
 
-	guard let exportSession = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetHighestQuality) else {
+	guard let exportSession = AVAssetExportSession(asset: composition, presetName: preset) else {
 		throw ExportModifiedVideoView.Error.unableToCreateExportSession
 	}
 	exportSession.shouldOptimizeForNetworkUse = true
 	exportSession.videoComposition = videoComposition
-	try await exportSession.export(to: outputURL, as: .mp4)
+	try await exportSession.export(to: outputURL, as: fileType)
 	return outputURL
 }
 
@@ -213,27 +228,30 @@ private func createComposition(
 		of: videoTrack,
 		at: .zero
 	)
-	let preferredTransform: CGAffineTransform
-	if let trackPreferredTransform = conversion.trackPreferredTransform {
-		preferredTransform = trackPreferredTransform
-	} else {
-		preferredTransform = try await videoTrack.load(.preferredTransform)
-	}
-	compositionTrack.preferredTransform = preferredTransform
+	compositionTrack.preferredTransform = try await conversion.geometry(for: videoTrack).preferredTransform
 	// Return the source track too because composition tracks do not reliably carry the natural-size geometry needed by the shared crop/scale code.
 	return (composition, compositionTrack, videoTrack)
 }
 
 /**
-Create an `AVVideoComposition` that will scale, translate, and crop the `compositionVideoTrack`.
+Create an `AVVideoComposition` that will scale, translate, and crop the `compositionVideoTrack`. When `preservingAlpha` is set, it uses the Core Image based compositor that keeps the source's transparency.
 */
 private func createVideoComposition(
 	comp
```

**File**: `Gifski/GIFGenerator.swift` (modified, +151/-14)
```diff
@@ -1,4 +1,5 @@
 import Foundation
+import CoreImage
 import VideoToolbox
 @preconcurrency import AVFoundation
 
@@ -301,7 +302,6 @@ actor GIFGenerator {
 		let output = try await makeFrameReaderOutput(
 			conversion: conversion,
 			videoTrack: firstVideoTrack,
-			videoTrackRange: videoTrackRange,
 			frameDuration: frameDuration
 		)
 
@@ -317,19 +317,15 @@ actor GIFGenerator {
 	private func makeFrameReaderOutput(
 		conversion: Conversion,
 		videoTrack: AVAssetTrack,
-		videoTrackRange: ClosedRange<Double>,
 		frameDuration: CMTime
 	) async throws -> AVAssetReaderVideoCompositionOutput {
 		let output = AVAssetReaderVideoCompositionOutput(
 			videoTracks: [videoTrack],
-			videoSettings: [
-				kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
-			]
+			videoSettings: CVPixelBuffer.bgra32Attributes
 		)
 		output.alwaysCopiesSampleData = false
-		output.videoComposition = try await conversion.videoComposition(
+		output.videoComposition = try await conversion.alphaPreservingVideoComposition(
 			for: videoTrack,
-			timeRange: videoTrackRange.cmTimeRange,
 			frameDuration: frameDuration
 		)
 
@@ -669,12 +665,19 @@ extension GIFGenerator.Conversion {
 		)
 	}
 
+	/**
+	The crop to apply, falling back to the full frame when none is set.
+	*/
+	var resolvedCrop: CropRect {
+		crop ?? .initial
+	}
+
 	/**
 	- Returns: Crop rect in pixels, if there is no crop rect then it returns the full render size.
 	*/
 	var cropRectInPixels: CGRect {
 		get async throws {
-			(crop ?? .initial).unnormalize(forDimensions: try await renderSize)
+			resolvedCrop.unnormalize(forDimensions: try await renderSize)
 		}
 	}
 
@@ -701,14 +704,59 @@ extension GIFGenerator.Conversion {
 		naturalSize: CGSize,
 		preferredTransform: CGAffineTransform
 	) -> CGRect {
-		let rotatedSize = CGRect(origin: .zero, size: naturalSize).applying(preferredTransform).size
-		let rotatedDimensions = CGSize(width: abs(rotatedSize.width), height: abs(rotatedSize.height))
+		let rotatedDimensions = naturalSize.applyingAbsolute(preferredTransform)
 
-		let cropRectInRotatedSpace = (crop ?? .initial).unnormalize(forDimensions: rotatedDimensions)
+		let cropRectInRotatedSpace = resolvedCrop.unnormalize(forDimensions: rotatedDimensions)
 
 		return cropRectInRotatedSpace.applying(preferredTransform.inverted())
 	}
 
+	/**
+	Loads `videoTrack`'s natural size together with the effective preferred transform — the `trackPreferredTransform` override when set, otherwise the track's own.
+	*/
+	func geometry(for videoTrack: AVAssetTrack) async throws -> (naturalSize: CGSize, preferredTransform: CGAffineTransform) {
+		let (naturalSize, loadedPreferredTransform) = try await videoTrack.load(.naturalSize, .preferredTransform)
+		return (naturalSize, trackPreferredTransform ?? loadedPreferredTransform)
+	}
+
+	/**
+	Creates an `AVVideoComposition` that crops, scales, and orients the source to this conversion's output settings while preserving the source's alpha channel. `geometryTrack` lets export apply the source track's natural size and orientation while reading frames from an `AVMutableCompositionTrack`.
+
+	The built-in `AVVideoComposition` compositor (used by `videoComposition(for:…)`) flattens the alpha channel to opaque, which loses transparency from alpha-capable sources like ProRes 4444. The Core Image based `AlphaPreservingCompositor` preserves it.
+	*/
+	func alphaPreservingVideoComposition(
+		for videoTrack: AVAssetTrack,
+		usingGeometryOf geometryTrack: AVAssetTrack? = nil,
+		frameDuration: CMTime
+	) async throws -> AVVideoComposition {
+		let (naturalSize, preferredTransform) = try await geometry(for: geometryTrack ?? videoTrack)
+		// Pad the instruction's range by one frame so a final frame landing on the track boundary is still covered.
+		let loadedTimeRange = try await videoTrack.load(.timeRange)
+		let timeRange = CMTimeRange(start: loadedTimeRange.start, duration: loadedTimeRange.duration + frameDuration)
+
+		let displaySize = naturalSize.applyingAbsolute(preferredTransform)
+
+		let crop = resolvedCrop
+		let outputSize = dimensionsAsCGSize ?? crop.unnormalize(forDimensions: displaySize).size
+
+		let instruction = AlphaPreservingCompositor.Instruction(
+			timeRange: timeRange,
+			trackID: videoTrack.trackID,
+			preferredTransform: preferredTransform,
+			crop: crop,
+			outputSize: outputSize
+		)
+
+		let configuration = AVVideoComposition.Configuration(
+			customVideoCompositorClass: AlphaPreservingCompositor.self,
+			frameDuration: frameDuration,
+			instructions: [instruction],
+			renderSize: outputSize
+		)
+
+		return AVVideoComposition(configuration: configuration)
+	}
+
 	/**
 	Creates an `AVVideoComposition` that scales, translates, and crops `videoTrack` using this conversion's output settings. `geometryTrack` lets export apply the source track's natural size and orientation while rendering an `AVMutableCompositionTrack`.
 	*/
@@ -719,10 +767,9 @@ extension GIFGenerator.Conversion {
 		frameD
```

**File**: `Gifski/Preview/PreviewVideoCompositor.swift` (modified, +2/-6)
```diff
@@ -96,13 +96,9 @@ final class PreviewVideoCompositor: NSObject, AVVideoCompositing {
 	}
 
 	// swiftlint:disable:next discouraged_optional_collection
-	let sourcePixelBufferAttributes: [String: any Sendable]? = [
-		kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
-	]
+	let sourcePixelBufferAttributes: [String: any Sendable]? = CVPixelBuffer.bgra32Attributes
 
-	let requiredPixelBufferAttributesForRenderContext: [String: any Sendable] = [
-		kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
-	]
+	let requiredPixelBufferAttributesForRenderContext: [String: any Sendable] = CVPixelBuffer.bgra32Attributes
 
 	func cancelAllPendingVideoCompositionRequests() {
 		pendingRequestTaskStore.cancelAll()
```

**File**: `Gifski/Utilities.swift` (modified, +32/-2)
```diff
@@ -661,8 +661,7 @@ extension AVAssetTrack {
 				return nil
 			}
 
-			let size = naturalSize.applying(preferredTransform)
-			let preferredSize = CGSize(width: abs(size.width), height: abs(size.height))
+			let preferredSize = naturalSize.applyingAbsolute(preferredTransform)
 
 			// Workaround for https://github.com/sindresorhus/gifski-app/issues/76
 			guard preferredSize != .zero else {
@@ -731,6 +730,20 @@ extension AVAssetTrack {
 		}
 	}
 
+	/**
+	Whether the track's video format declares an alpha channel (for example, ProRes 4444 or HEVC with alpha).
+	*/
+	var hasAlphaChannel: Bool {
+		get async throws {
+			guard let formatDescription = try await load(.formatDescriptions).first else {
+				return false
+			}
+
+			let value = CMFormatDescriptionGetExtension(formatDescription, extensionKey: kCMFormatDescriptionExtension_ContainsAlphaChannel)
+			return (value as? NSNumber)?.boolValue ?? false
+		}
+	}
+
 	/**
 	Returns a debug string with the media format.
 
@@ -2042,6 +2055,16 @@ extension CGSize {
 
 	var cgRect: CGRect { .init(origin: .zero, size: self) }
 
+	/**
+	Returns the size after applying `transform`, with negative dimensions from rotations or flips normalized to positive.
+
+	For example, applying a video track's `preferredTransform` to its natural size yields the display (oriented) size.
+	*/
+	func applyingAbsolute(_ transform: CGAffineTransform) -> Self {
+		let transformed = applying(transform)
+		return Self(width: abs(transformed.width), height: abs(transformed.height))
+	}
+
 	var longestSide: Double { max(width, height) }
 
 	var aspectRatio: Double { width / height }
@@ -5721,6 +5744,13 @@ extension Color {
 
 
 extension CVPixelBuffer {
+	/**
+	Pixel buffer attributes requesting the 32-bit BGRA format used by our video compositors and readers.
+	*/
+	static let bgra32Attributes: [String: any Sendable] = [
+		kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
+	]
+
 	var planeCount: Int {
 		CVPixelBufferGetPlaneCount(self)
 	}
```

**File**: `Tests/Tests.swift` (modified, +132/-1)
```diff
@@ -95,6 +95,7 @@ struct Tests {
 
 	private func makeTestVideo(
 		frameCount: Int,
+		codec: AVVideoCodecType = .h264,
 		pixelBufferForFrame: (Int) throws -> CVPixelBuffer
 	) async throws -> URL {
 		let directory = try URL.uniqueTemporaryDirectory()
@@ -103,7 +104,7 @@ struct Tests {
 		let input = AVAssetWriterInput(
 			mediaType: .video,
 			outputSettings: [
-				AVVideoCodecKey: AVVideoCodecType.h264,
+				AVVideoCodecKey: codec,
 				AVVideoWidthKey: 16,
 				AVVideoHeightKey: 16
 			]
@@ -210,6 +211,76 @@ struct Tests {
 		return pixelBuffer
 	}
 
+	/**
+	Left half opaque red, right half fully transparent.
+	*/
+	private func makeTransparentPixelBuffer() throws -> CVPixelBuffer {
+		var newPixelBuffer: CVPixelBuffer?
+		let status = CVPixelBufferCreate(
+			nil,
+			16,
+			16,
+			kCVPixelFormatType_32BGRA,
+			nil,
+			&newPixelBuffer
+		)
+		try #require(status == kCVReturnSuccess)
+		let pixelBuffer = try #require(newPixelBuffer)
+
+		CVPixelBufferLockBaseAddress(pixelBuffer, [])
+		defer {
+			CVPixelBufferUnlockBaseAddress(pixelBuffer, [])
+		}
+
+		guard let baseAddress = CVPixelBufferGetBaseAddress(pixelBuffer) else {
+			throw "Could not access pixel buffer storage.".toError
+		}
+
+		let bytesPerRow = CVPixelBufferGetBytesPerRow(pixelBuffer)
+		let height = CVPixelBufferGetHeight(pixelBuffer)
+		let width = CVPixelBufferGetWidth(pixelBuffer)
+		let buffer = baseAddress.bindMemory(to: UInt8.self, capacity: bytesPerRow * height)
+
+		for y in 0..<height {
+			for x in 0..<width {
+				let offset = (y * bytesPerRow) + (x * 4)
+				let isOpaque = x < width / 2
+				buffer[offset] = 0 // Blue
+				buffer[offset + 1] = 0 // Green
+				buffer[offset + 2] = isOpaque ? 255 : 0 // Red
+				buffer[offset + 3] = isOpaque ? 255 : 0 // Alpha
+			}
+		}
+
+		return pixelBuffer
+	}
+
+	private func transparentPixelCount(gifData: Data, frameIndex: Int) throws -> Int {
+		let imageSource = try #require(CGImageSourceCreateWithData(gifData as CFData, nil))
+		let image = try #require(CGImageSourceCreateImageAtIndex(imageSource, frameIndex, nil))
+		let width = image.width
+		let height = image.height
+		var pixels = [UInt8](repeating: 0, count: width * height * 4)
+		let context = try #require(CGContext(
+			data: &pixels,
+			width: width,
+			height: height,
+			bitsPerComponent: 8,
+			bytesPerRow: width * 4,
+			space: CGColorSpaceCreateDeviceRGB(),
+			bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
+		))
+
+		context.draw(image, in: .init(x: 0, y: 0, width: Double(width), height: Double(height)))
+
+		var count = 0
+		for offset in stride(from: 3, to: pixels.count, by: 4) where pixels[offset] == 0 {
+			count += 1
+		}
+
+		return count
+	}
+
 	private func makeHorizontalSplitCGImage() throws -> CGImage {
 		let pixelBuffer = try makeHorizontalSplitPixelBuffer()
 		var cgImage: CGImage?
@@ -641,6 +712,36 @@ struct Tests {
 		#expect(try averageRedValue(gifData: rightCropData, frameIndex: 0) < 50)
 	}
 
+	@Test
+	func gifGenerationPreservesAlphaFromProRes4444Source() async throws {
+		let videoURL = try await makeTestVideo(frameCount: 3, codec: .proRes4444) { _ in
+			try makeTransparentPixelBuffer()
+		}
+		defer {
+			try? videoURL.deletingLastPathComponent().delete()
+		}
+
+		let data = try await GIFGenerator.run(
+			.init(
+				asset: AVURLAsset(url: videoURL),
+				sourceURL: videoURL,
+				timeRange: 0...1,
+				quality: 0.8,
+				dimensions: (width: 16, height: 16),
+				frameRate: 2,
+				loop: .never,
+				bounce: false
+			)
+		) { _ in }
+
+		#expect(data.starts(with: Data("GIF".utf8)))
+
+		// The transparent right half of the ProRes 4444 source (128 of the 256 pixels) must survive as transparency in the GIF. The built-in video compositor flattened it to opaque, which is the bug this guards against. The bounds bracket the expected ~128 while allowing slight quantization slack.
+		let transparentCount = try transparentPixelCount(gifData: data, frameIndex: 0)
+		#expect(transparentCount > 96)
+		#expect(transparentCount < 160)
+	}
+
 	@Test
 	func exportModifiedVideoCreatesMovieFromVideoAsset() async throws {
 		let videoURL = try await makeTestVideo()
@@ -671,6 +772,36 @@ struct Tests {
 		#expect(try await asset.load(.duration).seconds > 0)
 	}
 
+	@Test
+	func exportModifiedVideoPreservesAlphaForProRes4444Source() async throws {
+		let videoURL = try await makeTestVideo(frameCount: 3, codec: .proRes4444) { _ in
+			try makeTransparentPixelBuffer()
+		}
+		defer {
+			try? videoURL.deletingLastPathComponent().delete()
+		}
+
+		let outputURL = try await exportModifiedVideo(
+			conversion: .init(
+				asset: AVURLAsset(url: videoURL),
+				sourceURL: videoURL,
+				quality: 1,
+				dimensions: (width: 16, height: 16),
+				frameRate: 2,
+				loop: .never,
+				bounce: false
+			)
+		)
+		defer {
+			try? outputURL.delete()
+		}
+
+		// An alpha-capable source must export as an alpha-capable format (HEVC with alpha in a `.mov`) so transparency is not flattened.
+		#expect(outputU
```

---

### Incident Patch 4: `e63e7e5c` (2026-02-07)
**Commit Message**: Add loop delay setting

Fixes #328

**File**: `Gifski/Constants.swift` (modified, +1/-0)
```diff
@@ -13,6 +13,7 @@ extension Defaults.Keys {
 	static let outputFPS = Key<Int>("outputFPS", default: 10)
 	static let loopGIF = Key<Bool>("loopGif", default: true)
 	static let bounceGIF = Key<Bool>("bounceGif", default: false)
+	static let loopDelay = Key<Double>("loopDelay", default: 0)
 	static let suppressKeyframeWarning = Key<Bool>("suppressKeyframeWarning", default: false)
 	static let suppressLargeGIFWarning = Key<Bool>("suppressLargeGIFWarning", default: false)
 	static let autoSaveToDownloads = Key<Bool>("autoSaveToDownloads", default: false)
```

**File**: `Gifski/EditScreen.swift` (modified, +42/-11)
```diff
@@ -38,6 +38,7 @@ private struct _EditScreen: View {
 	@Default(.bounceGIF) private var bounceGIF
 	@Default(.outputFPS) private var frameRate
 	@Default(.loopGIF) private var loopGIF
+	@Default(.loopDelay) private var loopDelay
 	@Default(.suppressKeyframeWarning) private var suppressKeyframeWarning
 	@Default(.suppressLargeGIFWarning) private var suppressLargeGIFWarning
 	@State private var url: URL
@@ -170,6 +171,9 @@ private struct _EditScreen: View {
 			estimatedFileSizeModel.updateEstimate()
 			updatePreviewOnSettingsChange()
 		}
+		.onChange(of: loopDelay) {
+			updatePreviewOnSettingsChange()
+		}
 		.alert2(
 			"Reverse Playback Preview Limitation",
 			message: "Reverse playback may stutter when the video has a low keyframe rate. The GIF will not have the same stutter.",
@@ -426,6 +430,7 @@ private struct _EditScreen: View {
 				return .forever
 			}(),
 			bounce: bounceGIF,
+			loopDelay: Defaults[.loopDelay],
 			crop: outputCropRect,
 			trackPreferredTransform: metadata.trackPreferredTransform
 		)
@@ -835,23 +840,49 @@ private struct QualitySetting: View {
 private struct LoopSetting: View {
 	@Default(.loopGIF) private var loop
 	@Default(.bounceGIF) private var bounce
+	@Default(.loopDelay) private var loopDelay
 	@State private var isGifLoopCountWarningPresented = false
+	@State private var isMoreOptionsPopoverPresented = false
 
 	@Binding var loopCount: Int
 
 	var body: some View {
 		LabeledContent("Loops") {
-			Stepper(
-				"Loop count",
-				value: $loopCount.intToDouble,
-				in: 0...100,
-				step: 1,
-				format: .number
-			)
-			.labelsHidden()
-			.disabled(loop)
-			Toggle("Forever", isOn: $loop)
-			Toggle("Bounce", isOn: $bounce)
+			HStack {
+				Stepper(
+					"Loop count",
+					value: $loopCount.intToDouble,
+					in: 0...100,
+					step: 1,
+					format: .number
+				)
+				.labelsHidden()
+				.disabled(loop)
+				Button("More Options", systemImage: "ellipsis") {
+					isMoreOptionsPopoverPresented.toggle()
+				}
+				.labelFillVertical()
+				.labelStyle(.iconOnly)
+				.buttonStyle(.accessoryBar)
+				.controlSize(.small)
+				.popover(isPresented: $isMoreOptionsPopoverPresented) {
+					LabeledContent("Loop delay") {
+						Stepper(
+							"Loop delay",
+							value: $loopDelay,
+							in: 0...10,
+							step: 0.5,
+							format: .number.precision(.fractionLength(1))
+						)
+						.labelsHidden()
+						Text("s")
+							.foregroundStyle(.secondary)
+					}
+					.padding()
+				}
+				Toggle("Forever", isOn: $loop)
+				Toggle("Bounce", isOn: $bounce)
+			}
 		}
 		.alert2(
 			"Animated GIF Preview Limitation",
```

**File**: `Gifski/GIFGenerator.swift` (modified, +5/-3)
```diff
@@ -115,6 +115,7 @@ actor GIFGenerator {
 
 		// TODO: Use `Duration`.
 		let startTime = times.first?.seconds ?? 0
+		let loopDelayOffset = conversion.loop.isLooping ? conversion.loopDelay : 0
 
 		// TODO: Does it handle cancellation?
 
@@ -152,7 +153,7 @@ actor GIFGenerator {
 				try gifski?.addFrame(
 					image,
 					frameNumber: frameNumber,
-					presentationTimestamp: max(0, actualTime.seconds - startTime)
+					presentationTimestamp: max(0, actualTime.seconds - startTime) + loopDelayOffset
 				)
 
 				if conversion.bounce {
@@ -178,7 +179,7 @@ actor GIFGenerator {
 					// Determine the reverse timestamp by finding the expected timestamp (frame number / frame rate) and adjusting for the image generator's slippage (actualTime - requestedTime)
 					let expectedReverseTimestamp = TimeInterval(reverseFrameNumber) / TimeInterval(frameRate)
 					let timestampSlippage = actualTime - requestedTime
-					let actualReverseTimestamp = max(0, expectedReverseTimestamp + timestampSlippage.seconds)
+					let actualReverseTimestamp = max(0, expectedReverseTimestamp + timestampSlippage.seconds) + loopDelayOffset
 
 					// Prevent duplicate frame with the same frame number causing an unwanted frame at the end of the GIF.
 					if frameNumber != reverseFrameNumber {
@@ -363,11 +364,12 @@ extension GIFGenerator {
 		let asset: AVAsset
 		let sourceURL: URL
 		var timeRange: ClosedRange<Double>?
-		var quality: Double = 1
+		var quality = 1.0
 		var dimensions: (width: Int, height: Int)?
 		var frameRate: Int?
 		var loop: Gifski.Loop
 		var bounce: Bool
+		var loopDelay = 0.0
 		var crop: CropRect?
 		var trackPreferredTransform: CGAffineTransform?
 	}
```

**File**: `Gifski/Gifski.swift` (modified, +9/-0)
```diff
@@ -6,6 +6,15 @@ final class Gifski {
 		case forever
 		case never
 		case count(Int)
+
+		var isLooping: Bool {
+			switch self {
+			case .never:
+				false
+			case .forever, .count:
+				true
+			}
+		}
 	}
 
 	private var wrapper: GifskiWrapper?
```

**File**: `Gifski/Utilities.swift` (modified, +29/-0)
```diff
@@ -6544,3 +6544,32 @@ extension ClosedRange<Double> {
 		(lhs.lowerBound * rhs) ... (lhs.upperBound * rhs)
 	}
 }
+
+
+extension View {
+	/**
+	Makes the underlying label fill the available vertical space.
+
+	Because this style re-wraps the content in a `Label`, you can apply additional label styles further up the view hierarchy:
+
+	```swift
+	Button("Title", systemImage: "star")
+		.labelFillVertical()
+		.labelStyle(.titleOnly)
+	```
+	*/
+	func labelFillVertical() -> some View {
+		labelStyle(VerticalFillLabelStyle())
+	}
+}
+
+struct VerticalFillLabelStyle: LabelStyle {
+	func makeBody(configuration: Configuration) -> some View {
+		Label {
+			configuration.title
+		} icon: {
+			configuration.icon
+		}
+		.fillFrame(.vertical)
+	}
+}
```

**File**: `Tests/Tests.swift` (modified, +7/-0)
```diff
@@ -324,4 +324,11 @@ struct Tests {
 		calibration.update(naiveBytes: 100, betterBytes: .infinity)
 		#expect(calibration.calibratedBytes(fromNaiveBytes: 100) == 100)
 	}
+
+	@Test
+	func loopDelayOffsetOnlyAppliesWhenGifLoops() {
+		#expect((Gifski.Loop.never.isLooping ? 0.4 : 0) == 0)
+		#expect((Gifski.Loop.forever.isLooping ? 0.4 : 0) == 0.4)
+		#expect((Gifski.Loop.count(3).isLooping ? 0.4 : 0) == 0.4)
+	}
 }
```

---

### Incident Patch 5: `93177b0f` (2026-01-07)
**Commit Message**: Clean up and fix video rotation handling

**File**: `Gifski.xcodeproj/project.pbxproj` (modified, +2/-0)
```diff
@@ -102,6 +102,7 @@
 		E3908B7326754568000723A7 /* EstimatedFileSize.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = EstimatedFileSize.swift; sourceTree = "<group>"; };
 		E3961F7F2AC9F2A700708EB7 /* Intents.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Intents.swift; sourceTree = "<group>"; };
 		E3A6BD102245345C00F62256 /* Constants.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; lineEnding = 0; path = Constants.swift; sourceTree = "<group>"; usesTabs = 1; };
+		E3ACE84E2F0EC74C004F95CC /* maintaining.md */ = {isa = PBXFileReference; lastKnownFileType = net.daringfireball.markdown; path = maintaining.md; sourceTree = "<group>"; };
 		E3AE62831E5CD2F300035A2F /* Gifski.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = Gifski.app; sourceTree = BUILT_PRODUCTS_DIR; };
 		E3AE62861E5CD2F300035A2F /* App.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; lineEnding = 0; path = App.swift; sourceTree = "<group>"; usesTabs = 1; };
 		E3AE62881E5CD2F300035A2F /* Assets.xcassets */ = {isa = PBXFileReference; lastKnownFileType = folder.assetcatalog; path = Assets.xcassets; sourceTree = "<group>"; };
@@ -200,6 +201,7 @@
 		E3AE627A1E5CD2F300035A2F = {
 			isa = PBXGroup;
 			children = (
+				E3ACE84E2F0EC74C004F95CC /* maintaining.md */,
 				E3805F542466E68900489E6C /* Config.xcconfig */,
 				E3AE62851E5CD2F300035A2F /* Gifski */,
 				0E79251C2329BDBE00058B94 /* Share Extension */,
```

**File**: `Gifski/Components/TrimmingAVPlayer.swift` (modified, +14/-5)
```diff
@@ -34,9 +34,10 @@ struct TrimmingAVPlayer: NSViewControllerRepresentable {
 			nsViewController.currentItem = item
 		}
 
-		if updatePreviewState(nsViewController) {
-			forceAVPlayerToRedraw(item: nsViewController.currentItem)
-		}
+		// Always update video composition based on preview state.
+		// When preview is ON, use custom compositor. When OFF, clear it so AVPlayer handles rotation.
+		forceAVPlayerToRedraw(item: nsViewController.currentItem)
+		_ = updatePreviewState(nsViewController)
 
 		nsViewController.loopPlayback = loopPlayback
 		nsViewController.bouncePlayback = bouncePlayback
@@ -76,14 +77,22 @@ struct TrimmingAVPlayer: NSViewControllerRepresentable {
 	}
 
 	/**
-	Resets the item's video composition, forcing a redraw.
+	Sets or clears the video composition based on preview state.
+
+	When preview is OFF, we don't use the custom compositor so AVPlayer handles rotation via `preferredTransform` normally.
+	When preview is ON, we use the custom compositor which renders the preview overlay.
 	*/
 	func forceAVPlayerToRedraw(item: AVPlayerItem) {
 		guard let assetVideoComposition = (asset as? PreviewableComposition)?.videoComposition else {
 			return
 		}
 
-		item.videoComposition = assetVideoComposition.mutableCopy() as? AVMutableVideoComposition
+		if shouldShowPreview {
+			item.videoComposition = assetVideoComposition.mutableCopy() as? AVMutableVideoComposition
+		} else {
+			// Clear video composition so AVPlayer handles rotation normally.
+			item.videoComposition = nil
+		}
 	}
 }
 
```

**File**: `Gifski/Crop/CropSettings.swift` (modified, +7/-12)
```diff
@@ -23,21 +23,16 @@ extension CropSettings {
 		return image.cropping(to: transformedCrop)
 	}
 
-	func unnormalizedCropRect(sizeInPreferredTransformationSpace preferredSize: CGSize) -> CGRect {
-		guard let trackPreferredTransform else {
-			guard let cropRect = crop else {
-				return .init(origin: .zero, size: preferredSize)
-			}
-			return cropRect.unnormalize(forDimensions: preferredSize)
-		}
+	/**
+	Returns the unnormalized crop rect for an image that is already in the preferred transform space (i.e., already rotated).
 
-		let originalSize = CGRect(origin: .zero, size: preferredSize)
-			.applying(trackPreferredTransform.inverted()).size
+	Since `AVAssetImageGenerator.appliesPreferredTrackTransform = true` and the preview manually applies the transform, images are always pre-rotated. The crop rect (which is defined in rotated space via the UI) can be applied directly.
+	*/
+	func unnormalizedCropRect(sizeInPreferredTransformationSpace preferredSize: CGSize) -> CGRect {
 		guard let cropRect = crop else {
-			return .init(origin: .zero, size: originalSize).applying(trackPreferredTransform)
+			return .init(origin: .zero, size: preferredSize)
 		}
-		let originalCropSize = cropRect.unnormalize(forDimensions: originalSize)
-		return originalCropSize.applying(trackPreferredTransform)
+		return cropRect.unnormalize(forDimensions: preferredSize)
 	}
 
 	var croppedOutputDimensions: (width: Int, height: Int)? {
```

**File**: `Gifski/EditScreen.swift` (modified, +2/-9)
```diff
@@ -377,8 +377,7 @@ private struct _EditScreen: View {
 	}
 
 	private var conversionSettings: GIFGenerator.Conversion {
-		print("resizableDimensions:", resizableDimensions.pixels, resizableDimensions.percent)
-		return .init(
+		.init(
 			asset: modifiedAsset,
 			sourceURL: url,
 			timeRange: timeRange,
@@ -571,7 +570,6 @@ private struct DimensionsSetting: View {
 			.labelsHidden()
 		}
 		.onAppear {
-			print("EDIT SCREEN - onappear")
 			setUpDimensions()
 			updateTextFieldsForCurrentDimensions()
 			showArrowKeyTipIfNeeded()
@@ -653,10 +651,8 @@ private struct DimensionsSetting: View {
 	}
 
 	private func applyWidth() {
-		print("widthMinMax", resizableDimensions.widthMinMax)
 		resizableDimensions = resizableDimensions.aspectResized(usingWidth: width.toDouble)
 		height = resizableDimensions.pixels.height.toDouble.clamped(to: resizableDimensions.heightMinMax).toIntAndClampingIfNeeded
-		print("widthMinMax2", resizableDimensions.widthMinMax)
 	}
 
 	private func applyHeight() {
@@ -667,18 +663,15 @@ private struct DimensionsSetting: View {
 
 	private func applyPercent() {
 		resizableDimensions = .percent(percent.toDouble / 100, originalSize: videoDimensions)
-		print("GGG", resizableDimensions)
 		width = resizableDimensions.pixels.width.toDouble.clamped(to: resizableDimensions.widthMinMax).toIntAndClampingIfNeeded
 		height = resizableDimensions.pixels.height.toDouble.clamped(to: resizableDimensions.heightMinMax).toIntAndClampingIfNeeded
-		print("GGG2", percent, width, height)
 		selectPredefinedSizeBasedOnCurrentDimensions(forceCustom: true)
 	}
 
 	private func updateTextFieldsForCurrentDimensions() {
 		width = resizableDimensions.pixels.width.toDouble.clamped(to: resizableDimensions.widthMinMax).toIntAndClampingIfNeeded
-				height = resizableDimensions.pixels.height.toDouble.clamped(to: resizableDimensions.heightMinMax).toIntAndClampingIfNeeded
+		height = resizableDimensions.pixels.height.toDouble.clamped(to: resizableDimensions.heightMinMax).toIntAndClampingIfNeeded
 		percent = (resizableDimensions.percent * 100).rounded().toIntAndClampingIfNeeded
-		print("FF", resizableDimensions.percent.toIntAndClampingIfNeeded)
 		selectPredefinedSizeBasedOnCurrentDimensions()
 	}
 
```

**File**: `Gifski/ExportModifiedVideo.swift` (modified, +6/-2)
```diff
@@ -74,7 +74,7 @@ struct ExportModifiedVideoView: View {
 			get: { state.isFinished && !isAudioWarningPresented },
 			set: {
 				guard
-					$0,
+					!$0,
 					case let .finished(url) = state else {
 					return
 				}
@@ -220,12 +220,16 @@ private func createVideoComposition(
 	instruction.timeRange = CMTimeRange(start: .zero, duration: .init(seconds: try await conversion.videoWithoutBounceDuration.toTimeInterval + 1.0, preferredTimescale: .video))
 
 	let layerInstruction = AVMutableVideoCompositionLayerInstruction(assetTrack: compositionVideoTrack)
+
+	// Layer instructions operate in natural space (unrotated). The crop rect from UI is in
+	// preferred space, so `cropRectAppliedToNaturalSize` transforms it back to natural space.
 	let cropRectAppliedToNaturalSize = try await conversion.cropRectAppliedToNaturalSize
 	let preferredTransform = conversion.trackPreferredTransform ?? .identity
 	let scaleTransform = CGAffineTransform(scaledBy: try await conversion.scale)
 	let scaledCropRect = cropRectAppliedToNaturalSize.applying(scaleTransform)
 	let cropRectAfterPreferred = scaledCropRect.applying(preferredTransform)
-	// now let's place the crop rect in the top left corner
+
+	// Place the crop rect in the top left corner.
 	let translateTransform = CGAffineTransform(translationX: -cropRectAfterPreferred.minX, y: -cropRectAfterPreferred.minY)
 	layerInstruction.setCropRectangle(cropRectAppliedToNaturalSize, at: .zero)
 	layerInstruction.setTransform(scaleTransform.concatenating(preferredTransform).concatenating(translateTransform), at: .zero)
```

**File**: `Gifski/GIFGenerator.swift` (modified, +24/-2)
```diff
@@ -263,7 +263,11 @@ actor GIFGenerator {
 //		)
 
 		let generator = AVAssetImageGenerator(asset: asset)
+
+		// Images are returned already rotated to match how the user sees the video.
+		// This means crop coordinates (defined in rotated space) can be applied directly.
 		generator.appliesPreferredTrackTransform = true
+
 		generator.requestedTimeToleranceBefore = .zero
 		generator.requestedTimeToleranceAfter = .zero
 
@@ -451,10 +455,28 @@ extension GIFGenerator.Conversion {
 		}
 	}
 
+	/**
+	The crop rect applied to the natural (unrotated) size of the video track.
+
+	The crop rect from the UI is defined in the preferred/rotated space (how the user sees the video). To apply it to `naturalSize`, we need to transform it from rotated space to natural space.
+	*/
 	var cropRectAppliedToNaturalSize: CGRect {
 		get async throws {
-			let size = try await asset.firstVideoTrack?.load(.naturalSize) ?? .one
-			return (crop ?? .initialCropRect).unnormalize(forDimensions: size)
+			guard let videoTrack = try await asset.firstVideoTrack else {
+				return .zero
+			}
+
+			let (naturalSize, preferredTransform) = try await videoTrack.load(.naturalSize, .preferredTransform)
+
+			// Get the rotated dimensions (how the user sees the video)
+			let rotatedSize = CGRect(origin: .zero, size: naturalSize).applying(preferredTransform).size
+			let rotatedDimensions = CGSize(width: abs(rotatedSize.width), height: abs(rotatedSize.height))
+
+			// The crop rect is defined in rotated space, so unnormalize it using rotated dimensions
+			let cropRectInRotatedSpace = (crop ?? .initialCropRect).unnormalize(forDimensions: rotatedDimensions)
+
+			// Transform the crop rect from rotated space back to natural space
+			return cropRectInRotatedSpace.applying(preferredTransform.inverted())
 		}
 	}
 
```

**File**: `Gifski/Preview/CVPixelBuffer+convertToGIF.swift` (modified, +7/-4)
```diff
@@ -9,13 +9,16 @@ extension CVPixelBuffer {
 	func convertToGIF(
 		settings: SettingsForFullPreview
 	) async throws -> Data {
-		//  Not the fastest way to convert `CVPixelBuffer` to image, but the runtime of `GIFGenerator.convertOneFrame` is so much larger that optimizing this would be a waste
+		// Not the fastest way to convert `CVPixelBuffer` to image, but the runtime of `GIFGenerator.convertOneFrame` is so much larger that optimizing this would be a waste.
 		var ciImage = CIImage(cvPixelBuffer: self)
-		if let trackPrefferedTransform = settings.conversion.trackPreferredTransform {
-			// Convert AVFoundation (top-left origin) transform to Core Image (bottom-left origin)
+
+		// Raw pixel buffers are in natural space (unrotated). Apply the transform to rotate
+		// the image to preferred space so crop coordinates (defined in preferred space) work correctly.
+		if let trackPreferredTransform = settings.conversion.trackPreferredTransform {
+			// Convert AVFoundation (top-left origin) transform to Core Image (bottom-left origin).
 			let imageHeight = ciImage.extent.height
 			let flip = CGAffineTransform(translationX: 0, y: imageHeight).scaledBy(x: 1, y: -1)
-			let ciTransform = flip.concatenating(trackPrefferedTransform).concatenating(flip)
+			let ciTransform = flip.concatenating(trackPreferredTransform).concatenating(flip)
 			ciImage = ciImage.transformed(by: ciTransform)
 		}
 		let ciContext = CIContext()
```

**File**: `Gifski/Preview/PreviewableComposition.swift` (modified, +4/-1)
```diff
@@ -40,8 +40,11 @@ final class PreviewableComposition: AVMutableComposition {
 		instruction.timeRange = CMTimeRange(start: .videoZero, duration: duration)
 		instruction.layerInstructions = [AVMutableVideoCompositionLayerInstruction(assetTrack: compositionOriginalTrack)]
 
+		// Render size in preferred space (rotated) so preview displays correctly.
+		let rotatedRect = CGRect(origin: .zero, size: trackSize).applying(preferredTransform)
+
 		videoComposition.frameDuration = frameDuration
-		videoComposition.renderSize = trackSize
+		videoComposition.renderSize = CGSize(width: abs(rotatedRect.width), height: abs(rotatedRect.height))
 		videoComposition.instructions = [instruction]
 		videoComposition.customVideoCompositorClass = PreviewVideoCompositor.self
 	}
```

---

### Incident Patch 6: `f298f53b` (2025-07-08)
**Commit Message**: Fix frame flash on bounce (#341)

**File**: `Gifski/GIFGenerator.swift` (modified, +8/-5)
```diff
@@ -180,11 +180,14 @@ actor GIFGenerator {
 					let timestampSlippage = actualTime - requestedTime
 					let actualReverseTimestamp = max(0, expectedReverseTimestamp + timestampSlippage.seconds)
 
-					try gifski?.addFrame(
-						image,
-						frameNumber: reverseFrameNumber,
-						presentationTimestamp: actualReverseTimestamp
-					)
+					// Prevent duplicate frame with the same frame number causing an unwanted frame at the end of the GIF.
+					if frameNumber != reverseFrameNumber {
+						try gifski?.addFrame(
+							image,
+							frameNumber: reverseFrameNumber,
+							presentationTimestamp: actualReverseTimestamp
+						)
+					}
 				}
 
 				index += 1
```

---

### Incident Patch 7: `2c41c613` (2025-07-06)
**Commit Message**: Add quick action tip to readme (#340)

Co-authored-by: Sindre Sorhus <[REDACTED_EMAIL]>

**File**: `readme.md` (modified, +10/-0)
```diff
@@ -87,6 +87,16 @@ brew install SwiftLint
 xcode-select --install
 ```
 
+## Tips
+
+## Quick Action shortcut
+
+Convert videos to GIFs directly from Finder using the built-in [Quick Action](https://support.apple.com/en-mz/guide/mac-help/mchl97ff9142/mac) shortcut. It works without opening Gifski, and you can create multiple shortcuts with different settings, such as quality, dimensions, or looping, to match your workflow.
+
+[Download shortcut](https://www.icloud.com/shortcuts/8a00497b180742139474d5470857d699)
+
+**Requires the [TestFlight version](https://testflight.apple.com/join/iCyHNNIA) of Gifski**
+
 ## FAQ
 
 #### The generated GIFs are huge!
```

---

### Incident Patch 8: `dafe075e` (2025-05-27)
**Commit Message**: Fix App Groups identifier

**File**: `Gifski/AppState.swift` (modified, +1/-1)
```diff
@@ -97,7 +97,7 @@ final class AppState {
 
 		guard
 			let path = url.queryDictionary["path"],
-			let appGroupShareVideoUrl = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: Shared.videoShareGroupIdentifier)?.appendingPathComponent(path, isDirectory: false)
+			let appGroupShareVideoUrl = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: Shared.appGroupIdentifier)?.appendingPathComponent(path, isDirectory: false)
 		else {
 			NSAlert.showModal(
 				for: SSApp.swiftUIMainWindow,
```

**File**: `Gifski/Gifski.entitlements` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
 	<true/>
 	<key>com.apple.security.application-groups</key>
 	<array>
-		<string>$(TeamIdentifierPrefix)gifski_video_share_group</string>
+		<string>group.com.sindresorhus.Gifski</string>
 	</array>
 	<key>com.apple.security.files.user-selected.read-write</key>
 	<true/>
```

**File**: `Gifski/Info.plist` (modified, +0/-2)
```diff
@@ -2,8 +2,6 @@
 <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
 <plist version="1.0">
 <dict>
-	<key>AppIdentifierPrefix</key>
-	<string>$(AppIdentifierPrefix)</string>
 	<key>CFBundleDocumentTypes</key>
 	<array>
 		<dict>
```

**File**: `Gifski/Shared.swift` (modified, +1/-2)
```diff
@@ -1,6 +1,5 @@
 import Foundation
 
 enum Shared {
-	static let appIdentifierPrefix = Bundle.main.infoDictionary!["AppIdentifierPrefix"] as! String
-	static let videoShareGroupIdentifier = "\(appIdentifierPrefix)gifski_video_share_group"
+	static let appGroupIdentifier = "group.com.sindresorhus.Gifski"
 }
```

**File**: `Share Extension/Info.plist` (modified, +0/-2)
```diff
@@ -2,8 +2,6 @@
 <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
 <plist version="1.0">
 <dict>
-	<key>AppIdentifierPrefix</key>
-	<string>$(AppIdentifierPrefix)</string>
 	<key>ITSAppUsesNonExemptEncryption</key>
 	<false/>
 	<key>NSExtension</key>
```

**File**: `Share Extension/ShareController.swift` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ final class ShareController: ExtensionController {
 		let filename = url.lastPathComponent
 
 		guard
-			let appGroupShareVideoURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: Shared.videoShareGroupIdentifier)?.appendingPathComponent(filename, isDirectory: false)
+			let appGroupShareVideoURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: Shared.appGroupIdentifier)?.appendingPathComponent(filename, isDirectory: false)
 		else {
 			context.cancel()
 			return []
```

**File**: `Share Extension/Share_Extension.entitlements` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
 	<true/>
 	<key>com.apple.security.application-groups</key>
 	<array>
-		<string>$(TeamIdentifierPrefix)gifski_video_share_group</string>
+		<string>group.com.sindresorhus.Gifski</string>
 	</array>
 </dict>
 </plist>
```

**File**: `Share Extension/Utilities.swift` (modified, +0/-1)
```diff
@@ -4,7 +4,6 @@ import UniformTypeIdentifiers
 
 extension Sequence where Element: Sequence {
 	func flatten() -> [Element.Element] {
-		// TODO: Make this `flatMap(\.self)` when https://github.com/apple/swift/issues/55343 is fixed.
 		flatMap(\.self)
 	}
 }
```

---

### Incident Patch 9: `649ae758` (2024-12-30)
**Commit Message**: Require macOS 15

**File**: `Gifski.xcodeproj/project.pbxproj` (modified, +10/-7)
```diff
@@ -293,7 +293,7 @@
 			attributes = {
 				BuildIndependentTargetsInParallel = YES;
 				LastSwiftUpdateCheck = 1100;
-				LastUpgradeCheck = 1600;
+				LastUpgradeCheck = 1630;
 				ORGANIZATIONNAME = "Sindre Sorhus";
 				TargetAttributes = {
 					0E79251A2329BDBE00058B94 = {
@@ -321,6 +321,7 @@
 				Base,
 			);
 			mainGroup = E3AE627A1E5CD2F300035A2F;
+			minimizedProjectReferenceProxies = 1;
 			packageReferences = (
 				E3339E912395766800303839 /* XCRemoteSwiftPackageReference "Defaults" */,
 				E3339E9B2395789500303839 /* XCRemoteSwiftPackageReference "DockProgress" */,
@@ -459,7 +460,6 @@
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
 				DEAD_CODE_STRIPPING = YES;
-				DEVELOPMENT_TEAM = YG56YK5RN5;
 				ENABLE_HARDENED_RUNTIME = YES;
 				GCC_C_LANGUAGE_STANDARD = gnu11;
 				GENERATE_INFOPLIST_FILE = YES;
@@ -475,6 +475,7 @@
 				PRODUCT_BUNDLE_IDENTIFIER = com.sindresorhus.Gifski.ShareExtension;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				PROVISIONING_PROFILE_SPECIFIER = "";
+				REGISTER_APP_GROUPS = YES;
 				SKIP_INSTALL = YES;
 				SWIFT_VERSION = 5.0;
 			};
@@ -492,7 +493,6 @@
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
 				DEAD_CODE_STRIPPING = YES;
-				DEVELOPMENT_TEAM = YG56YK5RN5;
 				ENABLE_HARDENED_RUNTIME = YES;
 				GCC_C_LANGUAGE_STANDARD = gnu11;
 				GENERATE_INFOPLIST_FILE = YES;
@@ -507,6 +507,7 @@
 				PRODUCT_BUNDLE_IDENTIFIER = com.sindresorhus.Gifski.ShareExtension;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				PROVISIONING_PROFILE_SPECIFIER = "";
+				REGISTER_APP_GROUPS = YES;
 				SKIP_INSTALL = YES;
 				SWIFT_VERSION = 5.0;
 			};
@@ -550,6 +551,7 @@
 				COPY_PHASE_STRIP = NO;
 				DEAD_CODE_STRIPPING = YES;
 				DEBUG_INFORMATION_FORMAT = dwarf;
+				DEVELOPMENT_TEAM = YG56YK5RN5;
 				ENABLE_STRICT_OBJC_MSGSEND = YES;
 				ENABLE_TESTABILITY = YES;
 				ENABLE_USER_SCRIPT_SANDBOXING = NO;
@@ -567,7 +569,7 @@
 				GCC_WARN_UNINITIALIZED_AUTOS = YES_AGGRESSIVE;
 				GCC_WARN_UNUSED_FUNCTION = YES;
 				GCC_WARN_UNUSED_VARIABLE = YES;
-				MACOSX_DEPLOYMENT_TARGET = 14.4;
+				MACOSX_DEPLOYMENT_TARGET = 15.2;
 				MTL_ENABLE_DEBUG_INFO = INCLUDE_SOURCE;
 				MTL_FAST_MATH = YES;
 				ONLY_ACTIVE_ARCH = YES;
@@ -615,6 +617,7 @@
 				COPY_PHASE_STRIP = NO;
 				DEAD_CODE_STRIPPING = YES;
 				DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym";
+				DEVELOPMENT_TEAM = YG56YK5RN5;
 				ENABLE_NS_ASSERTIONS = NO;
 				ENABLE_STRICT_OBJC_MSGSEND = YES;
 				ENABLE_USER_SCRIPT_SANDBOXING = NO;
@@ -626,7 +629,7 @@
 				GCC_WARN_UNINITIALIZED_AUTOS = YES_AGGRESSIVE;
 				GCC_WARN_UNUSED_FUNCTION = YES;
 				GCC_WARN_UNUSED_VARIABLE = YES;
-				MACOSX_DEPLOYMENT_TARGET = 14.4;
+				MACOSX_DEPLOYMENT_TARGET = 15.2;
 				MTL_ENABLE_DEBUG_INFO = NO;
 				MTL_FAST_MATH = YES;
 				SDKROOT = macosx;
@@ -645,7 +648,6 @@
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
 				DEAD_CODE_STRIPPING = YES;
-				DEVELOPMENT_TEAM = YG56YK5RN5;
 				ENABLE_HARDENED_RUNTIME = YES;
 				FRAMEWORK_SEARCH_PATHS = (
 					"$(inherited)",
@@ -664,6 +666,7 @@
 				PRODUCT_BUNDLE_IDENTIFIER = com.sindresorhus.Gifski;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				PROVISIONING_PROFILE_SPECIFIER = "";
+				REGISTER_APP_GROUPS = YES;
 				SWIFT_EMIT_LOC_STRINGS = YES;
 				SWIFT_OBJC_BRIDGING_HEADER = "Gifski/Gifski-Bridging-Header.h";
 				SWIFT_VERSION = 5.0;
@@ -679,7 +682,6 @@
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
 				DEAD_CODE_STRIPPING = YES;
-				DEVELOPMENT_TEAM = YG56YK5RN5;
 				ENABLE_HARDENED_RUNTIME = YES;
 				FRAMEWORK_SEARCH_PATHS = (
 					"$(inherited)",
@@ -698,6 +700,7 @@
 				PRODUCT_BUNDLE_IDENTIFIER = com.sindresorhus.Gifski;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				PROVISIONING_PROFILE_SPECIFIER = "";
+				REGISTER_APP_GROUPS = YES;
 				SWIFT_EMIT_LOC_STRINGS = YES;
 				SWIFT_OBJC_BRIDGING_HEADER = "Gifski/Gifski-Bridging-Header.h";
 				SWIFT_VERSION = 5.0;
```

**File**: `Gifski.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +6/-6)
```diff
@@ -6,8 +6,8 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/sindresorhus/Defaults",
       "state" : {
-        "revision" : "ef1b2318fb549002bb533bec3a8ad98ae09f2cb6",
-        "version" : "9.0.0"
+        "revision" : "00c82eff4550c87cf9c547d7e5493a6a97837061",
+        "version" : "9.0.3"
       }
     },
     {
@@ -33,17 +33,17 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/getsentry/sentry-cocoa",
       "state" : {
-        "revision" : "56bfb7e723c76614be4c0861ee820ccbaed14c6d",
-        "version" : "8.41.0"
+        "revision" : "2c6c1b81d9f6e6178064b4e9b457abe1c118bcda",
+        "version" : "8.49.0"
       }
     },
     {
       "identity" : "swift-syntax",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/swiftlang/swift-syntax",
       "state" : {
-        "revision" : "0687f71944021d616d34d922343dcef086855920",
-        "version" : "600.0.1"
+        "revision" : "f99ae8aa18f0cf0d53481901f88a0991dc3bd4a2",
+        "version" : "601.0.1"
       }
     }
   ],
```

**File**: `Gifski.xcodeproj/xcshareddata/xcschemes/Gifski.xcscheme` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 <?xml version="1.0" encoding="UTF-8"?>
 <Scheme
-   LastUpgradeVersion = "1600"
+   LastUpgradeVersion = "1630"
    version = "1.8">
    <BuildAction
       parallelizeBuildables = "YES"
```

**File**: `Gifski/App.swift` (modified, +23/-22)
```diff
@@ -14,30 +14,31 @@ struct AppMain: App {
 			MainScreen()
 				.environment(appState)
 		}
-			.windowResizability(.contentSize)
-			.windowToolbarStyle(.unifiedCompact)
-			.defaultPosition(.center)
-			.handlesExternalEvents(matching: []) // Makes sure it does not open a new window when dragging files onto the Dock icon.
-			.commands {
-				CommandGroup(replacing: .newItem) {
-					Button("Open…") {
-						appState.isFileImporterPresented = true
-					}
-						.keyboardShortcut("o")
-						.disabled(appState.isConverting)
-				}
-				CommandGroup(replacing: .help) {
-					Link("Website", destination: "https://sindresorhus.com/Gifski")
-					Link("Source Code", destination: "https://github.com/sindresorhus/Gifski")
-					Link("Gifski Library", destination: "https://github.com/ImageOptim/gifski")
-					Divider()
-					RateOnAppStoreButton(appStoreID: "1351639930")
-					// TODO: Doesn't work. (macOS 14.3)
-//					ShareAppButton(appStoreID: "1351639930")
-					Divider()
-					SendFeedbackButton()
+		.windowResizability(.contentSize)
+		.windowToolbarStyle(.unifiedCompact)
+//		.windowBackgroundDragBehavior(.enabled) // Does not work. (macOS 15.2)
+		.defaultPosition(.center)
+		.restorationBehavior(.disabled)
+		.handlesExternalEvents(matching: []) // Makes sure it does not open a new window when dragging files onto the Dock icon.
+		.commands {
+			CommandGroup(replacing: .newItem) {
+				Button("Open…") {
+					appState.isFileImporterPresented = true
 				}
+				.keyboardShortcut("o")
+				.disabled(appState.isConverting)
+			}
+			CommandGroup(replacing: .help) {
+				Link("Website", destination: "https://sindresorhus.com/Gifski")
+				Link("Source Code", destination: "https://github.com/sindresorhus/Gifski")
+				Link("Gifski Library", destination: "https://github.com/ImageOptim/gifski")
+				Divider()
+				RateOnAppStoreButton(appStoreID: "1351639930")
+				ShareAppButton(appStoreID: "1351639930")
+				Divider()
+				SendFeedbackButton()
 			}
+		}
 	}
 
 	private func setUpConfig() {
```

**File**: `Gifski/Intents.swift` (modified, +3/-3)
```diff
@@ -21,9 +21,9 @@ struct ConvertIntent: AppIntent, ProgressReportingIntent {
 	@Parameter(
 		title: "Video",
 		description: "Accepts MP4 and MOV video files.",
-		supportedTypeIdentifiers: [
-			"public.mpeg-4",
-			"com.apple.quicktime-movie"
+		supportedContentTypes: [
+			.mpeg4Movie,
+			.quickTimeMovie
 		]
 	)
 	var video: IntentFile
```

**File**: `Gifski/MainScreen.swift` (modified, +4/-3)
```diff
@@ -87,12 +87,13 @@ struct MainScreen: View {
 		.toolbar {
 			Color.clear
 		}
+		// `.materialActiveAppearance` does not currently work here. Remove `.windowIsVibrant` when it does.
+//		.containerBackground(.thinMaterial.materialActiveAppearance(.active), for: .window)
+		.toolbarBackgroundVisibility(.hidden, for: .windowToolbar)
+		.windowResizeBehavior(.disabled)
 		.windowTabbingMode(.disallowed)
 		.windowCollectionBehavior(.fullScreenNone)
 		.windowIsMovableByWindowBackground()
-		.windowIsResizable(false)
-		.windowIsRestorable(false)
-		.windowTitlebarAppearsTransparent()
 		.windowIsVibrant()
 	}
 }
```

**File**: `Gifski/Utilities.swift` (modified, +6/-28)
```diff
@@ -41,28 +41,6 @@ extension DispatchQueue {
 }
 
 
-extension CGSize: @retroactive Hashable {
-	public func hash(into hasher: inout Hasher) {
-		hasher.combine(width)
-		hasher.combine(height)
-	}
-}
-
-extension CGPoint: @retroactive Hashable {
-	public func hash(into hasher: inout Hasher) {
-		hasher.combine(x)
-		hasher.combine(y)
-	}
-}
-
-extension CGRect: @retroactive Hashable {
-	public func hash(into hasher: inout Hasher) {
-		hasher.combine(origin)
-		hasher.combine(size)
-	}
-}
-
-
 func asyncNilCoalescing<T>(
 	_ optional: T?,
 	default defaultValue: @escaping @autoclosure () async throws -> T
@@ -172,7 +150,7 @@ struct RateOnAppStoreButton: View {
 
 // NOTE: This is moot with macOS 12, but `.values` property provided is super buggy and crashes a lot.
 extension Publisher where Failure == Never {
-	var toAsyncStream: AsyncStream<Output> {
+	var toAsyncSequence: some AsyncSequence<Output, Failure> {
 		AsyncStream(Output.self) { continuation in
 			let cancellable = sink { completion in
 				switch completion {
@@ -1407,7 +1385,7 @@ extension URL {
 
 	var isVideoDecodable: Bool {
 		get async throws {
-			try await AVAsset(url: self).isVideoDecodable
+			try await AVURLAsset(url: self).isVideoDecodable
 		}
 	}
 }
@@ -5340,8 +5318,8 @@ extension AVPlayerView {
 	/**
 	Activates trim mode without waiting for trimming to finish.
 	*/
-	func activateTrimming() async throws { // TODO: `throws(CancellationError)`.
-		_ = await updates(for: \.canBeginTrimming).first { $0 }
+	func activateTrimming() async throws { // TODO: `throws(CancellationError)` when `checkCancellation` has typed throws.
+		_ = await updates(for: \.canBeginTrimming).first(where: \.self)
 
 		try Task.checkCancellation()
 
@@ -5358,8 +5336,8 @@ extension NSObjectProtocol where Self: NSObject {
 	func updates<Value>(
 		for keyPath: KeyPath<Self, Value>,
 		options: NSKeyValueObservingOptions = [.initial, .new]
-	) -> AsyncStream<Value> {
-		publisher(for: keyPath, options: options).toAsyncStream
+	) -> some AsyncSequence<Value, Never> {
+		publisher(for: keyPath, options: options).toAsyncSequence
 	}
 }
 
```

---

### Incident Patch 10: `a71f4c24` (2023-10-01)
**Commit Message**: Rewrite the app with SwiftUI

Fixes #244
Fixes #103
Fixes #246
Fixes #229

**File**: `.swiftlint.yml` (modified, +9/-4)
```diff
@@ -80,6 +80,7 @@ only_rules:
   - no_extension_access_modifier
   - no_fallthrough_only
   - no_space_in_method_call
+  - non_overridable_class_declaration
   - notification_center_detachment
   - ns_number_init_as_function_reference
   - nsobject_prefer_isequal
@@ -94,6 +95,7 @@ only_rules:
   - private_action
   - private_outlet
   - private_subject
+  - private_swiftui_state
   - private_unit_test
   - prohibited_super_call
   - protocol_property_accessors_order
@@ -133,6 +135,7 @@ only_rules:
   - unavailable_condition
   - unavailable_function
   - unneeded_break_in_switch
+  - unneeded_override
   - unneeded_parentheses_in_closure_argument
   - unowned_variable_capture
   - untyped_error_in_catch
@@ -143,6 +146,7 @@ only_rules:
   - unused_setter_value
   - valid_ibinspectable
   - vertical_parameter_alignment
+  - vertical_parameter_alignment_on_call
   - vertical_whitespace_closing_braces
   - vertical_whitespace_opening_braces
   - void_function_in_ternary
@@ -152,9 +156,10 @@ only_rules:
   - yoda_condition
 analyzer_rules:
   - capture_variable
+  - typesafe_array_init
+  - unneeded_synthesized_initializer
   - unused_declaration
   - unused_import
-  - typesafe_array_init
 for_where:
   allow_for_as_filter: true
 number_separator:
@@ -180,7 +185,7 @@ identifier_name:
     - 'y2'
     - 'z2'
 deployment_target:
-  macOS_deployment_target: '13'
+  macOS_deployment_target: '14'
 custom_rules:
   no_nsrect:
     regex: '\bNSRect\b'
@@ -202,8 +207,8 @@ custom_rules:
     regex: '\bCGFloat\('
     message: 'Use Double instead of CGFloat'
   swiftui_state_private:
-    regex: '@(State|StateObject|ObservedObject|EnvironmentObject)\s+var'
-    message: 'SwiftUI @State/@StateObject/@ObservedObject/@EnvironmentObject properties should be private'
+    regex: '@(ObservedObject|EnvironmentObject)\s+var'
+    message: 'SwiftUI @ObservedObject and @EnvironmentObject properties should be private'
   swiftui_environment_private:
     regex: '@Environment\(\\\.\w+\)\s+var'
     message: 'SwiftUI @Environment properties should be private'
```

**File**: `Gifski.xcodeproj/project.pbxproj` (modified, +57/-157)
```diff
@@ -7,47 +7,38 @@
 	objects = {
 
 /* Begin PBXBuildFile section */
-		0E7925202329BDBE00058B94 /* ShareViewController.swift in Sources */ = {isa = PBXBuildFile; fileRef = 0E79251F2329BDBE00058B94 /* ShareViewController.swift */; };
-		0E7925232329BDBE00058B94 /* ShareViewController.xib in Resources */ = {isa = PBXBuildFile; fileRef = 0E7925212329BDBE00058B94 /* ShareViewController.xib */; };
+		0E7925202329BDBE00058B94 /* ShareController.swift in Sources */ = {isa = PBXBuildFile; fileRef = 0E79251F2329BDBE00058B94 /* ShareController.swift */; };
 		0E7925282329BDBE00058B94 /* Share Extension.appex in Embed Foundation Extensions */ = {isa = PBXBuildFile; fileRef = 0E79251B2329BDBE00058B94 /* Share Extension.appex */; settings = {ATTRIBUTES = (RemoveHeadersOnCopy, ); }; };
 		5FF0DFFB278BA5DB00A80F09 /* libgifski_static.a in Frameworks */ = {isa = PBXBuildFile; fileRef = 5F6ABD84278BA5A20040DDF0 /* libgifski_static.a */; };
-		6D86841721FD283B0044F6FE /* ConversionCompletedViewController.swift in Sources */ = {isa = PBXBuildFile; fileRef = 6D86841121FD283B0044F6FE /* ConversionCompletedViewController.swift */; };
-		6D86841821FD283B0044F6FE /* DraggableFile.swift in Sources */ = {isa = PBXBuildFile; fileRef = 6D86841621FD283B0044F6FE /* DraggableFile.swift */; };
 		8548806522B78E8300E97401 /* IntTextField.swift in Sources */ = {isa = PBXBuildFile; fileRef = 8548806422B78E8300E97401 /* IntTextField.swift */; };
-		8548806E22B82D1400E97401 /* MenuPopUpButton.swift in Sources */ = {isa = PBXBuildFile; fileRef = 8548806D22B82D1300E97401 /* MenuPopUpButton.swift */; };
-		858380E622BFD0E30086BC98 /* VideoDropViewController.swift in Sources */ = {isa = PBXBuildFile; fileRef = 858380E522BFD0E30086BC98 /* VideoDropViewController.swift */; };
 		858380EA22BFD38C0086BC98 /* ExtendedAttributes.swift in Sources */ = {isa = PBXBuildFile; fileRef = 858380E922BFD38B0086BC98 /* ExtendedAttributes.swift */; };
 		8588EB0D22A424B800030A59 /* ResizableDimensions.swift in Sources */ = {isa = PBXBuildFile; fileRef = 8588EB0C22A424B800030A59 /* ResizableDimensions.swift */; };
 		85A5C44822CA41B500CAA94D /* VideoValidator.swift in Sources */ = {isa = PBXBuildFile; fileRef = 85A5C44722CA41B500CAA94D /* VideoValidator.swift */; };
-		85B9CF6422BD3FA00050A2E4 /* Tooltip.swift in Sources */ = {isa = PBXBuildFile; fileRef = 85B9CF6322BD3FA00050A2E4 /* Tooltip.swift */; };
-		85BF910922F3279300AD3FF6 /* TrimmingAVPlayerViewController.swift in Sources */ = {isa = PBXBuildFile; fileRef = 85BF910822F3279300AD3FF6 /* TrimmingAVPlayerViewController.swift */; };
-		85FD156222BFF12B00957AF1 /* ConversionViewController.swift in Sources */ = {isa = PBXBuildFile; fileRef = 85FD155D22BFF12B00957AF1 /* ConversionViewController.swift */; };
-		9F3340A322431CC3006EF9B5 /* TimeRemainingEstimator.swift in Sources */ = {isa = PBXBuildFile; fileRef = 9F3340A222431CC3006EF9B5 /* TimeRemainingEstimator.swift */; };
+		85BF910922F3279300AD3FF6 /* TrimmingAVPlayer.swift in Sources */ = {isa = PBXBuildFile; fileRef = 85BF910822F3279300AD3FF6 /* TrimmingAVPlayer.swift */; };
 		C2040B8920435871004EE259 /* GifskiWrapper.swift in Sources */ = {isa = PBXBuildFile; fileRef = C2040B8820435871004EE259 /* GifskiWrapper.swift */; };
-		C2AFA91D204FFEFD00FC5A7F /* MainWindowController.swift in Sources */ = {isa = PBXBuildFile; fileRef = C2AFA91B204FFEFD00FC5A7F /* MainWindowController.swift */; };
 		D957BCDE234941C200A9A9F9 /* CheckerboardView.swift in Sources */ = {isa = PBXBuildFile; fileRef = D957BCDD234941C200A9A9F9 /* CheckerboardView.swift */; };
 		E30C8EEF29387E7A002E053F /* Gifski.swift in Sources */ = {isa = PBXBuildFile; fileRef = E30C8EEE29387E7A002E053F /* Gifski.swift */; };
 		E31A4F3124AD36870097B1A5 /* InternetAccessPolicy.json in Resources */ = {isa = PBXBuildFile; fileRef = E31A4F2C24AD36870097B1A5 /* InternetAccessPolicy.json */; };
 		E3339E932395766800303839 /* Defaults in Frameworks */ = {isa = PBXBuildFile; productRef = E3339E922395766800303839 /* Defaults */; };
-		E3339E9A2395768F00303839 /* CircularProgress in Frameworks */ = {isa = PBXBuildFile; productRef = E3339E992395768F00303839 /* CircularProgress */; };
 		E3339E9D2395789500303839 /* DockProgress in Frameworks */ = {isa = PBXBuildFile; productRef = E3339E9C2395789500303839 /* DockProgress */; };
+		E33552EF2ACAC3190023AAE9 /* MainScreen.swift in Sources */ = {isa = PBXBuildFile; fileRef = E33552EE2ACAC3190023AAE9 /* MainScreen.swift */; };
+		E33552F12ACAC3280023AAE9 /* AppState.swift in Sources */ = {isa = PBXBuildFile; fileRef = E33552F02ACAC3280023AAE9 /* AppState.swift */; };
+		E33552F32ACAC5D80023AAE9 /* StartScreen.swift in Sources */ = {isa = PBXBuildFile; fileRef = E33552F22ACAC5D80023AAE9 /* StartScreen.swift */; };
 		E339F011203820ED003B78FB /* GIFGenerator.swift in Sources */ = {isa = PBXBuildFile; fileRef = E339F010203820ED003B78FB /* GIFGenerator.swift */; };
+		E37F68E02ACAD9D1007F1A7F /* CompletedScreen.swift in Sources */ = {isa = PBXBuildFile; fileRef = E37F68DF2A
```

**File**: `Gifski.xcodeproj/xcshareddata/xcschemes/Gifski.xcscheme` (modified, +1/-1)
```diff
@@ -44,8 +44,8 @@
       buildConfiguration = "Debug"
       selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
       selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
-      enableAddressSanitizer = "YES"
       enableASanStackUseAfterReturn = "YES"
+      enableThreadSanitizer = "YES"
       launchStyle = "0"
       useCustomWorkingDirectory = "NO"
       ignoresPersistentStateOnLaunch = "NO"
```

**File**: `Gifski/App.swift` (modified, +38/-127)
```diff
@@ -1,139 +1,50 @@
-import Cocoa
-import UserNotifications
-import FirebaseCore
-import FirebaseCrashlytics
-import DockProgress
-
-/**
-TODO when targeting macOS 14:
-- Rewrite everything to use async/await, AsyncSequence, and actors.
-- Rewrite `CheckerboardView` to use `SwiftUI.Canvas`.
-- Make `final class Gifski` an actor.
-- Use `@MainActor`
-- Add  button in the editor to preview the final GIF.
-*/
+import SwiftUI
 
 @main
-final class AppDelegate: NSObject, NSApplicationDelegate {
-	private(set) lazy var mainWindowController = MainWindowController()
-
-	var previousEditViewController: EditVideoViewController?
-
-	// Possible workaround for crashing bug because of Crashlytics swizzling.
-	let notificationCenter = UNUserNotificationCenter.current()
-
-	func applicationWillFinishLaunching(_ notification: Notification) {
-		UserDefaults.standard.register(
-			defaults: [
-				"NSApplicationCrashOnExceptions": true,
-				"NSFullScreenMenuItemEverywhere": false
-			]
-		)
-	}
-
-	func applicationDidFinishLaunching(_ notification: Notification) {
-		FirebaseApp.configure()
-		NSApp.servicesProvider = self
-
-		// We have to include `.badge` otherwise system settings does not show the checkbox to turn off sounds. (macOS 12.4)
-		notificationCenter.requestAuthorization(options: [.sound, .badge]) { _, _ in }
-
-		mainWindowController.showWindow(self)
+struct AppMain: App {
+	private let appState = AppState.shared
+	@NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
 
-		// Set launch completions option if the notification center could not be set up already.
-		LaunchCompletions.applicationDidLaunch()
-
-//		#if DEBUG
-//		mainWindowController.convert(URL(fileURLWithPath: "/Users/sindresorhus/Library/Containers/com.sindresorhus.Gifski/Data/Library/Application Support/com.sindresorhus.Gifski/Fixture.mp4"))
-//		#endif
-	}
-
-	/**
-	Returns `nil` if it should not continue.
-	*/
-	func extractSharedVideoUrlIfAny(from url: URL) -> URL? {
-		guard url.host == "shareExtension" else {
-			return url
-		}
-
-		guard
-			let path = url.queryDictionary["path"],
-			let appGroupShareVideoUrl = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: Shared.videoShareGroupIdentifier)?.appendingPathComponent(path, isDirectory: false)
-		else {
-			NSAlert.showModal(
-				for: mainWindowController.window,
-				title: "Could not retrieve the shared video."
-			)
-			return nil
-		}
-
-		return appGroupShareVideoUrl
+	init() {
+		setUpConfig()
 	}
 
-	func application(_ application: NSApplication, open urls: [URL]) {
-		guard
-			urls.count == 1,
-			let videoUrl = urls.first
-		else {
-			NSAlert.showModal(
-				for: mainWindowController.window,
-				title: "Gifski can only convert a single file at the time."
-			)
-			return
+	var body: some Scene {
+		Window(SSApp.name, id: "main") {
+			MainScreen()
+				.environment(appState)
 		}
-
-		guard let videoUrl2 = extractSharedVideoUrlIfAny(from: videoUrl) else {
-			return
-		}
-
-		// Start video conversion on launch
-		LaunchCompletions.add { [weak self] in
-			self?.mainWindowController.convert(videoUrl2)
-		}
-	}
-
-	func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
-
-	func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
-		if mainWindowController.isConverting {
-			let response = NSAlert.showModal(
-				for: mainWindowController.window,
-				title: "Do you want to continue converting?",
-				message: "Gifski is currently converting a video. If you quit, the conversion will be cancelled.",
-				buttonTitles: [
-					"Continue",
-					"Quit"
-				]
-			)
-
-			if response == .alertFirstButtonReturn {
-				return .terminateCancel
+			.windowResizability(.contentSize)
+			.windowToolbarStyle(.unifiedCompact)
+			.defaultPosition(.center)
+			.handlesExternalEvents(matching: []) // Makes sure it does not open a new window when dragging files onto the Dock icon.
+			.commands {
+				CommandGroup(replacing: .newItem) {
+					Button("Open…") {
+						appState.isFileImporterPresented = true
+					}
+						.keyboardShortcut("o")
+						.disabled(appState.isConverting)
+				}
+				CommandGroup(replacing: .help) {
+					Link("Website", destination: "https://sindresorhus.com/Gifski")
+					Link("Source Code", destination: "https://github.com/sindresorhus/Gifski")
+					Link("Gifski Library", destination: "https://github.com/ImageOptim/gifski")
+					Divider()
+					RateOnAppStoreButton(appStoreID: "1351639930")
+					// TODO: Doesn't work. (macOS 14.3)
+//					ShareAppButton(appStoreID: "1351639930")
+					Divider()
+					SendFeedbackButton()
+				}
 			}
-		}
-
-		return .terminateNow
-	}
-
-	func applicationWillTerminate(_ notification: Notification) {
-		UNUserNotificationCenter.current().removeAllDeliveredNotifications()
 	}
 
-	func application(_ application: NSApplication, willPresentError error: Error) -> Error {
-		Crashlytics.recordNonFatalError(error: error
```

**File**: `Gifski/AppState.swift` (added, +142/-0)
```diff
@@ -0,0 +1,142 @@
+import SwiftUI
+import UserNotifications
+import DockProgress
+
+@MainActor
+@Observable
+final class AppState {
+	static let shared = AppState()
+
+	var navigationPath = [Route]()
+	var isFileImporterPresented = false
+
+	// TODO: This can be inferred by checking the last element of navigationPath.
+	var isConverting = false
+
+	var error: Error?
+
+	init() {
+		DockProgress.style = .squircle(color: .white.withAlphaComponent(0.7))
+
+		DispatchQueue.main.async { [self] in
+			didLaunch()
+		}
+	}
+
+	private func didLaunch() {
+		NSApp.servicesProvider = self
+
+		// We have to include `.badge` otherwise system settings does not show the checkbox to turn off sounds. (macOS 12.4)
+		UNUserNotificationCenter.current().requestAuthorization(options: [.sound, .badge]) { _, _ in }
+	}
+
+	func start(_ url: URL) {
+		_ = url.startAccessingSecurityScopedResource()
+
+		// We have to nil it out first and dispatch, otherwise it shows the old video. (macOS 14.3)
+		navigationPath = []
+
+		Task { @MainActor [self] in
+			do {
+				// TODO: Simplify the validator.
+				let (asset, metadata) = try await VideoValidator.validate(url)
+				navigationPath = [.edit(url, asset, metadata)]
+			} catch {
+				self.error = error
+			}
+		}
+	}
+
+	/**
+	Returns `nil` if it should not continue.
+	*/
+	fileprivate func extractSharedVideoUrlIfAny(from url: URL) -> URL? {
+		guard url.host == "shareExtension" else {
+			return url
+		}
+
+		guard
+			let path = url.queryDictionary["path"],
+			let appGroupShareVideoUrl = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: Shared.videoShareGroupIdentifier)?.appendingPathComponent(path, isDirectory: false)
+		else {
+			NSAlert.showModal(
+				for: SSApp.swiftUIMainWindow,
+				title: "Could not retrieve the shared video."
+			)
+			return nil
+		}
+
+		return appGroupShareVideoUrl
+	}
+}
+
+final class AppDelegate: NSObject, NSApplicationDelegate {
+	func applicationDidFinishLaunching(_ notification: Notification) {
+		// Set launch completions option if the notification center could not be set up already.
+		LaunchCompletions.applicationDidLaunch()
+	}
+
+	// TODO: Try to migrate to `.onOpenURL` when targeting macOS 15.
+	func application(_ application: NSApplication, open urls: [URL]) {
+		guard
+			urls.count == 1,
+			let videoUrl = urls.first
+		else {
+			NSAlert.showModal(
+				for: SSApp.swiftUIMainWindow,
+				title: "Gifski can only convert a single file at the time."
+			)
+
+			return
+		}
+
+		guard let videoUrl2 = AppState.shared.extractSharedVideoUrlIfAny(from: videoUrl) else {
+			return
+		}
+
+		// Start video conversion on launch
+		LaunchCompletions.add {
+			AppState.shared.start(videoUrl2)
+		}
+	}
+
+	func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
+		if AppState.shared.isConverting {
+			let response = NSAlert.showModal(
+				for: SSApp.swiftUIMainWindow,
+				title: "Do you want to continue converting?",
+				message: "Gifski is currently converting a video. If you quit, the conversion will be cancelled.",
+				buttonTitles: [
+					"Continue",
+					"Quit"
+				]
+			)
+
+			if response == .alertFirstButtonReturn {
+				return .terminateCancel
+			}
+		}
+
+		return .terminateNow
+	}
+
+	func applicationWillTerminate(_ notification: Notification) {
+		UNUserNotificationCenter.current().removeAllDeliveredNotifications()
+	}
+}
+
+extension AppState {
+	/**
+	This is called from NSApp as a service resolver.
+	*/
+	@objc
+	func convertToGIF(_ pasteboard: NSPasteboard, userData: String, error: NSErrorPointer) {
+		guard let url = pasteboard.fileURLs().first else {
+			return
+		}
+
+		Task { @MainActor in
+			start(url)
+		}
+	}
+}
```

**File**: `Gifski/Assets.xcassets/ButtonTextColor.colorset/Contents.json` (removed, +0/-38)
```diff
@@ -1,38 +0,0 @@
-{
-  "colors" : [
-    {
-      "color" : {
-        "color-space" : "srgb",
-        "components" : {
-          "alpha" : "1.000",
-          "blue" : "1.000",
-          "green" : "1.000",
-          "red" : "1.000"
-        }
-      },
-      "idiom" : "universal"
-    },
-    {
-      "appearances" : [
-        {
-          "appearance" : "luminosity",
-          "value" : "dark"
-        }
-      ],
-      "color" : {
-        "color-space" : "srgb",
-        "components" : {
-          "alpha" : "1.000",
-          "blue" : "0.000",
-          "green" : "0.000",
-          "red" : "0.000"
-        }
-      },
-      "idiom" : "universal"
-    }
-  ],
-  "info" : {
-    "author" : "xcode",
-    "version" : 1
-  }
-}
```

**File**: `Gifski/Assets.xcassets/CheckerboardFirstColor.colorset/Contents.json` (removed, +0/-38)
```diff
@@ -1,38 +0,0 @@
-{
-  "info" : {
-    "version" : 1,
-    "author" : "xcode"
-  },
-  "colors" : [
-    {
-      "idiom" : "universal",
-      "color" : {
-        "color-space" : "srgb",
-        "components" : {
-          "red" : "1.000",
-          "alpha" : "1.000",
-          "blue" : "1.000",
-          "green" : "1.000"
-        }
-      }
-    },
-    {
-      "idiom" : "universal",
-      "appearances" : [
-        {
-          "appearance" : "luminosity",
-          "value" : "dark"
-        }
-      ],
-      "color" : {
-        "color-space" : "srgb",
-        "components" : {
-          "red" : "0.261",
-          "alpha" : "1.000",
-          "blue" : "0.261",
-          "green" : "0.261"
-        }
-      }
-    }
-  ]
-}
\ No newline at end of file
```

**File**: `Gifski/Assets.xcassets/CheckerboardSecondColor.colorset/Contents.json` (removed, +0/-38)
```diff
@@ -1,38 +0,0 @@
-{
-  "info" : {
-    "version" : 1,
-    "author" : "xcode"
-  },
-  "colors" : [
-    {
-      "idiom" : "universal",
-      "color" : {
-        "color-space" : "srgb",
-        "components" : {
-          "red" : "209",
-          "alpha" : "1.000",
-          "blue" : "209",
-          "green" : "209"
-        }
-      }
-    },
-    {
-      "idiom" : "universal",
-      "appearances" : [
-        {
-          "appearance" : "luminosity",
-          "value" : "dark"
-        }
-      ],
-      "color" : {
-        "color-space" : "srgb",
-        "components" : {
-          "red" : "0x83",
-          "alpha" : "1.000",
-          "blue" : "0x85",
-          "green" : "0x84"
-        }
-      }
-    }
-  ]
-}
\ No newline at end of file
```

---

### Incident Patch 11: `db66ef11` (2023-02-21)
**Commit Message**: Log Rust crash error output to Crashlytics

**File**: `Gifski/Gifski.swift` (modified, +5/-0)
```diff
@@ -1,4 +1,5 @@
 import Cocoa
+import FirebaseCrashlytics
 
 final class Gifski {
 	enum Loop {
@@ -49,6 +50,10 @@ final class Gifski {
 
 		self.wrapper = wrapper
 
+		wrapper.setErrorMessageCallback {
+			Crashlytics.crashlytics().log($0)
+		}
+
 		wrapper.setProgressCallback { [weak self] in
 			guard let self else {
 				return 0
```

**File**: `Gifski/GifskiWrapper.swift` (modified, +26/-0)
```diff
@@ -8,12 +8,14 @@ final class GifskiWrapper {
 		case rgb
 	}
 
+	typealias ErrorMessageCallback = (String) -> Void
 	typealias ProgressCallback = () -> Int
 	typealias WriteCallback = (Int, UnsafePointer<UInt8>) -> Int
 
 	private let pointer: OpaquePointer
 	private var unmanagedSelf: Unmanaged<GifskiWrapper>!
 	private var hasFinished = false
+	private var errorMessageCallback: ErrorMessageCallback!
 	private var progressCallback: ProgressCallback!
 	private var writeCallback: WriteCallback!
 
@@ -38,6 +40,30 @@ final class GifskiWrapper {
 		}
 	}
 
+	func setErrorMessageCallback(_ callback: @escaping ErrorMessageCallback) {
+		guard !hasFinished else {
+			return
+		}
+
+		errorMessageCallback = callback
+
+		gifski_set_error_message_callback(
+			pointer,
+			{ message, context in // swiftlint:disable:this opening_brace
+				guard
+					let message,
+					let context
+				else {
+					return
+				}
+
+				let this = Unmanaged<GifskiWrapper>.fromOpaque(context).takeUnretainedValue()
+				this.errorMessageCallback(String(cString: message))
+			},
+			unmanagedSelf.toOpaque()
+		)
+	}
+
 	func setProgressCallback(_ callback: @escaping ProgressCallback) {
 		guard !hasFinished else {
 			return
```

---

### Incident Patch 12: `204b7602` (2022-12-01)
**Commit Message**: Fix running SwiftLint when installed from Homebrew (#283)

**File**: `Gifski.xcodeproj/project.pbxproj` (modified, +1/-2)
```diff
@@ -438,8 +438,7 @@
 			);
 			runOnlyForDeploymentPostprocessing = 0;
 			shellPath = /bin/sh;
-			shellScript = "swiftlint\n";
-			showEnvVarsInLog = 0;
+			shellScript = "PATH=\"/opt/homebrew/bin/:${PATH}\"\nswiftlint\n";
 		};
 /* End PBXShellScriptBuildPhase section */
 
```

---

### Incident Patch 13: `6479e7c3` (2022-08-08)
**Commit Message**: Fix green line sometimes occurring on the GIF (#278)

**File**: `Gifski/Gifski.swift` (modified, +1/-4)
```diff
@@ -295,10 +295,7 @@ final class Gifski {
 		generator.requestedTimeToleranceBefore = .zero
 		generator.requestedTimeToleranceAfter = .zero
 
-		// This improves the performance a little bit.
-		if let dimensions = conversion.dimensions {
-			generator.maximumSize = CGSize(widthHeight: dimensions.longestSide)
-		}
+		// We are intentionally not setting a `generator.maximumSize` as it's buggy: https://github.com/sindresorhus/Gifski/pull/278
 
 		// Even though we enforce a minimum of 3 FPS in the GUI, a source video could have lower FPS, and we should allow that.
 		var fps = (conversion.frameRate.map(Double.init) ?? assetFrameRate).clamped(to: 0.1...Constants.allowedFrameRate.upperBound)
```

---

### Incident Patch 14: `010d09d2` (2022-03-26)
**Commit Message**: Require macOS 11

Minor tweaks

**File**: `.github/funding.yml` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-github: [sindresorhus, sunshinejr, boyvanamstel]
```

**File**: `.swiftlint.yml` (modified, +6/-3)
```diff
@@ -65,7 +65,6 @@ only_rules:
   - legacy_nsgeometry_functions
   - legacy_random
   - literal_expression_end_indentation
-  - legacy_objc_type
   - lower_acl_than_parent
   - mark
   - modifier_order
@@ -86,6 +85,7 @@ only_rules:
   - operator_whitespace
   - orphaned_doc_comment
   - overridden_super_call
+  - prefer_self_in_static_references
   - prefer_self_type_over_type_of_self
   - prefer_zero_over_explicit_init
   - private_action
@@ -106,6 +106,8 @@ only_rules:
   - redundant_void_return
   - required_enum_case
   - return_arrow_whitespace
+  - return_value_from_void_function
+  - self_in_property_initialization
   - shorthand_operator
   - sorted_first_last
   - statement_position
@@ -122,6 +124,7 @@ only_rules:
   - trailing_newline
   - trailing_semicolon
   - trailing_whitespace
+  - unavailable_condition
   - unavailable_function
   - unneeded_break_in_switch
   - unneeded_parentheses_in_closure_argument
@@ -139,14 +142,14 @@ only_rules:
   - vertical_whitespace_closing_braces
   - vertical_whitespace_opening_braces
   - void_return
-  - weak_delegate
   - xct_specific_matcher
   - xctfail_message
   - yoda_condition
 analyzer_rules:
   - capture_variable
   - unused_declaration
   - unused_import
+  - typesafe_array_init
 number_separator:
   minimum_length: 5
 identifier_name:
@@ -171,7 +174,7 @@ identifier_name:
     - 'y2'
     - 'z2'
 deployment_target:
-  macOS_deployment_target: '10.15'
+  macOS_deployment_target: '11'
 custom_rules:
   no_nsrect:
     regex: '\bNSRect\b'
```

**File**: `Gifski.xcodeproj/project.pbxproj` (modified, +4/-4)
```diff
@@ -600,7 +600,7 @@
 				GCC_WARN_UNINITIALIZED_AUTOS = YES_AGGRESSIVE;
 				GCC_WARN_UNUSED_FUNCTION = YES;
 				GCC_WARN_UNUSED_VARIABLE = YES;
-				MACOSX_DEPLOYMENT_TARGET = 10.15;
+				MACOSX_DEPLOYMENT_TARGET = 11.5;
 				MTL_ENABLE_DEBUG_INFO = INCLUDE_SOURCE;
 				MTL_FAST_MATH = YES;
 				ONLY_ACTIVE_ARCH = YES;
@@ -656,7 +656,7 @@
 				GCC_WARN_UNINITIALIZED_AUTOS = YES_AGGRESSIVE;
 				GCC_WARN_UNUSED_FUNCTION = YES;
 				GCC_WARN_UNUSED_VARIABLE = YES;
-				MACOSX_DEPLOYMENT_TARGET = 10.15;
+				MACOSX_DEPLOYMENT_TARGET = 11.5;
 				MTL_ENABLE_DEBUG_INFO = NO;
 				MTL_FAST_MATH = YES;
 				SDKROOT = macosx;
@@ -766,7 +766,7 @@
 			repositoryURL = "https://github.com/sindresorhus/Defaults";
 			requirement = {
 				kind = upToNextMajorVersion;
-				minimumVersion = 6.1.0;
+				minimumVersion = 6.2.1;
 			};
 		};
 		E3339E982395768F00303839 /* XCRemoteSwiftPackageReference "CircularProgress" */ = {
@@ -790,7 +790,7 @@
 			repositoryURL = "https://github.com/firebase/firebase-ios-sdk";
 			requirement = {
 				kind = upToNextMajorVersion;
-				minimumVersion = 8.11.0;
+				minimumVersion = 9.1.0;
 			};
 		};
 /* End XCRemoteSwiftPackageReference section */
```

**File**: `Gifski/App.swift` (modified, +5/-1)
```diff
@@ -8,6 +8,10 @@ import DockProgress
 TODO when targeting macOS 12:
 - Rewrite everything to use async/await, AsyncSequence, and actors.
 - Rewrite `CheckerboardView` to use `SwiftUI.Canvas`.
+- Make `final class Gifski` an actor.
+
+TODO when targeting macOS 13:
+- Use `@MainActor`
 */
 
 @main
@@ -32,7 +36,7 @@ final class AppDelegate: NSObject, NSApplicationDelegate {
 		FirebaseApp.configure()
 		NSApp.servicesProvider = self
 
-		// We have to include `.badge` otherwise system preferences does not show the checkbox to turn off sounds.
+		// We have to include `.badge` otherwise system preferences does not show the checkbox to turn off sounds. (macOS 12.4)
 		notificationCenter.requestAuthorization(options: [.sound, .badge]) { _, _ in }
 
 		mainWindowController.showWindow(self)
```

**File**: `Gifski/ConversionCompletedViewController.swift` (modified, +9/-14)
```diff
@@ -93,18 +93,14 @@ final class ConversionCompletedViewController: NSViewController {
 		draggableFileWrapper.layer?.masksToBounds = false
 		draggableFile.constrainEdgesToSuperview()
 
-		if #available(macOS 11, *) {
-			// TODO: Find a better icon for this.
-			openButton.image = NSImage(systemSymbolName: "plus", accessibilityDescription: "New conversion")
-
-			SSApp.runOnce(identifier: "showOpenButtonLabel") {
-				openButton.imagePosition = .imageLeading
-				openButton.title = "Open"
-				openButton.sizeToFit()
-				openButton.frame.x -= 34
-			}
-		} else {
-			openButton.isHidden = true
+		// TODO: Find a better icon for this.
+		openButton.image = NSImage(systemSymbolName: "plus", accessibilityDescription: "New conversion")
+
+		SSApp.runOnce(identifier: "showOpenButtonLabel") {
+			openButton.imagePosition = .imageLeading
+			openButton.title = "Open"
+			openButton.sizeToFit()
+			openButton.frame.x -= 34
 		}
 	}
 
@@ -176,8 +172,7 @@ final class ConversionCompletedViewController: NSViewController {
 
 		let panel = NSSavePanel()
 		panel.canCreateDirectories = true
-		// TODO: Use `.allowedContentTypes` here when targeting macOS 11.
-		panel.allowedFileTypes = [FileType.gif.identifier]
+		panel.allowedContentTypes = [.gif]
 		panel.nameFieldStringValue = inputUrl.filenameWithoutExtension
 		panel.message = "Choose where to save the GIF"
 
```

**File**: `Gifski/Credits.rtf` (modified, +4/-6)
```diff
@@ -1,8 +1,8 @@
-{\rtf1\ansi\ansicpg1252\cocoartf1671\cocoasubrtf500
-{\fonttbl\f0\fswiss\fcharset0 Helvetica;\f1\fswiss\fcharset0 Helvetica-Bold;}
+{\rtf1\ansi\ansicpg1252\cocoartf2638
+\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;\f1\fswiss\fcharset0 Helvetica-Bold;}
 {\colortbl;\red255\green255\blue255;\red0\green0\blue0;}
 {\*\expandedcolortbl;;\cssrgb\c0\c0\c0\c84706\cname labelColor;}
-\paperw11900\paperh16840\margl1440\margr1440\vieww12600\viewh7800\viewkind0
+\paperw11900\paperh16840\margl1440\margr1440\vieww8040\viewh6780\viewkind0
 \pard\tx566\tx1133\tx1700\tx2267\tx2834\tx3401\tx3968\tx4535\tx5102\tx5669\tx6236\tx6803\pardirnatural\qc\partightenfactor0
 
 \f0\fs24 \cf2 \
@@ -12,6 +12,4 @@
 \f0\b0 \
 {\field{\*\fldinst{HYPERLINK "https://github.com/sindresorhus"}}{\fldrslt Sindre Sorhus}}\
 {\field{\*\fldinst{HYPERLINK "https://github.com/kornelski"}}{\fldrslt Kornel Lesi\uc0\u324 ski}}\
-{\field{\*\fldinst{HYPERLINK "https://github.com/LarsJK"}}{\fldrslt Lars-J\'f8rgen Kristiansen}}\
-{\field{\*\fldinst{HYPERLINK "https://github.com/boyvanamstel"}}{\fldrslt Boy van Amstel}}\
-{\field{\*\fldinst{HYPERLINK "https://github.com/sunshinejr"}}{\fldrslt \uc0\u321 ukasz Mr\'f3z}}}
\ No newline at end of file
+{\field{\*\fldinst{HYPERLINK "https://github.com/sindresorhus/Gifski/graphs/contributors"}}{\fldrslt awesome contributors}}}
\ No newline at end of file
```

**File**: `Gifski/EditVideoViewController.swift` (modified, +0/-1)
```diff
@@ -10,7 +10,6 @@ struct SpeedView: View {
 		HStack(alignment: .firstTextBaseline) {
 			Text("Speed:")
 			Slider(value: $outputSpeed, in: 0.5...5, step: 0.5)
-				.offset(y: OS.isMacOS11OrLater ? 0 : -4)
 			Text("\(outputSpeed.formatted)×")
 				.font(.system().monospacedDigit()) // TODO: Use `.monospacedDigit()` view modifier when targeting macOS 12.
 				.frame(width: 30, alignment: .leading)
```

**File**: `Gifski/EstimatedFileSize.swift` (modified, +8/-17)
```diff
@@ -56,6 +56,7 @@ final class EstimatedFileSizeModel: ObservableObject {
 				// We add 10% extra because it's better to estimate slightly too much than too little.
 				let fileSize = (Double(data.count) * gifski.sizeMultiplierForEstimation) * 1.1
 
+				// TODO: Use the new formatter API when targeting macOS 12.
 				self.estimatedFileSize = Self.formatter.string(fromByteCount: Int64(fileSize))
 			case .failure(let error):
 				switch error {
@@ -84,8 +85,7 @@ final class EstimatedFileSizeModel: ObservableObject {
 }
 
 struct EstimatedFileSizeView: View {
-	// TODO: Use `StateObject` when targeting macOS 11.
-	@ObservedObject private var model: EstimatedFileSizeModel
+	@StateObject private var model: EstimatedFileSizeModel
 
 	init(model: EstimatedFileSizeModel) {
 		_model = .init(wrappedValue: model)
@@ -95,8 +95,7 @@ struct EstimatedFileSizeView: View {
 		HStack {
 			if let error = model.error {
 				Text("Failed to get estimate: \(error.localizedDescription)")
-					// TODO: Enable when targeting macOS 11.
-//					.help(error.localizedDescription)
+					.help(error.localizedDescription)
 			} else {
 				HStack(spacing: 0) {
 					Text("Estimated size: ")
@@ -108,18 +107,10 @@ struct EstimatedFileSizeView: View {
 					.foregroundColor(.secondary)
 				HStack {
 					if model.estimatedFileSize == nil {
-						if #available(macOS 11, *) {
-							ProgressView()
-								.controlSize(.small)
-								// TODO: This causes a crash on macOS 12.0.1
-//								.scaleEffect(0.7)
-								.padding(.leading, -4)
-								.help("Calculating file size estimate")
-						} else {
-							Text("Estimating…")
-								.foregroundColor(.secondary)
-								.font(.smallSystem())
-						}
+						ProgressView()
+							.controlSize(.mini)
+							.padding(.leading, -4)
+							.help("Calculating file size estimate")
 					}
 				}
 					// This causes SwiftUI to crash internally on macOS 12.0 when changing the trim size many times so the estimation indicator keeps changing.
@@ -129,7 +120,7 @@ struct EstimatedFileSizeView: View {
 			// It's important to set a width here as otherwise it can cause internal SwiftUI crashes on macOS 11 and 12.
 			.frame(width: 500, height: 22, alignment: .leading)
 			.overlay2 {
-				if #available(macOS 11, *), model.error == nil {
+				if model.error == nil {
 					HStack {
 						Text(DateComponentsFormatter.localizedStringPositionalWithFractionalSeconds(model.duration))
 							// TODO: Use `View#monospacedDigit()` when targeting macOS 12.
```

---

### Incident Patch 15: `eeaa53c9` (2022-01-19)
**Commit Message**: Fix encoding of transparency

**File**: `gifski-api/Cargo.lock` (modified, +8/-7)
```diff
@@ -297,7 +297,7 @@ dependencies = [
 
 [[package]]
 name = "gifski"
-version = "1.6.3"
+version = "1.6.4"
 dependencies = [
  "clap",
  "crossbeam-channel",
@@ -343,13 +343,14 @@ dependencies = [
 
 [[package]]
 name = "imagequant"
-version = "4.0.0-beta.6"
+version = "4.0.0-beta.7"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "a19e402b08669aee84b5df80b754856aad91d1301e72435c767eab689b289121"
+checksum = "6fbd720ffd79390df8aaf8d83d290d461f3e31f9b42f3eb49b156e05bc1e6d6e"
 dependencies = [
  "arrayvec",
  "fallible_collections",
  "noisy_float",
+ "once_cell",
  "rayon",
  "rgb",
  "thread_local",
@@ -391,9 +392,9 @@ dependencies = [
 
 [[package]]
 name = "lodepng"
-version = "3.4.7"
+version = "3.5.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "24844d5c0b922ddd52fb5bf0964a4c7f8e799a946ec01bb463771eb04fc1a323"
+checksum = "ee9bfa86cc28550f1e0f6a23ae4f4811aaec527be710b313f78cf33982cefdc3"
 dependencies = [
  "fallible_collections",
  "flate2",
@@ -667,9 +668,9 @@ checksum = "49874b5167b65d7193b8aba1567f5c7d93d001cafc34600cee003eda787e483f"
 
 [[package]]
 name = "wasi"
-version = "0.10.2+wasi-snapshot-preview1"
+version = "0.10.3+wasi-snapshot-preview1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "fd6fbd9a79829dd1ad0cc20627bf1ed606756a7f77edff7b66b7064f9cb327c6"
+checksum = "46a2e384a3f170b0c7543787a91411175b71afd56ba4d3a0ae5678d4e2243c0e"
 
 [[package]]
 name = "weezl"
```

**File**: `gifski-api/Cargo.toml` (modified, +3/-3)
```diff
@@ -10,7 +10,7 @@ license = "AGPL-3.0+"
 name = "gifski"
 readme = "README.md"
 repository = "https://github.com/ImageOptim/gifski"
-version = "1.6.3"
+version = "1.6.4"
 autobins = false
 edition = "2018"
 
@@ -23,9 +23,9 @@ gifsicle = { version = "1.92.5", optional = true }
 clap = "2.34.0"
 gif = "0.11.3"
 gif-dispose = "3.1.1"
-imagequant = "4.0.0-beta.6"
+imagequant = "4.0.0-beta.7"
 imgref = "1.9.1"
-lodepng = "3.4.7"
+lodepng = "3.5.0"
 pbr = "1.0.4"
 resize = "0.7.2"
 rgb = "0.8.31"
```

**File**: `gifski-api/src/lib.rs` (modified, +25/-15)
```diff
@@ -140,6 +140,7 @@ struct DiffMessage {
     dispose: gif::DisposalMethod,
     image: ImgVec<RGBA8>,
     importance_map: Vec<u8>,
+    needs_transparency: bool,
 }
 
 /// Frame post quantization, before remap
@@ -299,32 +300,41 @@ impl Writer {
     /// Avoids wasting palette on pixels identical to the background.
     ///
     /// `background` is the previous frame.
-    fn quantize(image: ImgRef<'_, RGBA8>, importance_map: &[u8], has_prev_frame: bool, settings: &Settings) -> CatResult<(Attributes, QuantizationResult, Image<'static>)> {
+    fn quantize(image: ImgVec<RGBA8>, importance_map: &[u8], first_frame: bool, needs_transparency: bool, prev_frame_keeps: bool, settings: &Settings) -> CatResult<(Attributes, QuantizationResult, Image<'static>)> {
         let mut liq = Attributes::new();
         if settings.fast {
-            liq.set_speed(10);
+            liq.set_speed(10)?;
         }
-        let quality = if has_prev_frame {
+        let quality = if !first_frame {
             settings.color_quality().into()
         } else {
             100 // the first frame is too important to ruin it
         };
-        liq.set_quality(0, quality);
-        let mut img = liq.new_image_stride(image.buf(), image.width(), image.height(), image.stride(), 0.)?;
-        img.set_importance_map(importance_map)?;
-        if has_prev_frame {
-            img.add_fixed_color(RGBA8::new(0, 0, 0, 0));
+        liq.set_quality(0, quality)?;
+        let (buf, width, height) = image.into_contiguous_buf();
+        let mut img = liq.new_image(buf, width, height, 0.)?;
+        // only later remapping tracks which area has been damanged by transparency
+        // so for previous-transparent background frame the importance map may be invalid
+        // because there's a transparent hole in the background not taken into account,
+        // and palette may lack colors to fill that hole
+        if first_frame || prev_frame_keeps {
+            img.set_importance_map(importance_map)?;
+        }
+        // first frame may be transparent too, so it's not just for diffs
+        if needs_transparency {
+            img.add_fixed_color(RGBA8::new(0, 0, 0, 0))?;
         }
         let res = liq.quantize(&mut img)?;
         Ok((liq, res, img))
     }
 
     fn remap(liq: Attributes, mut res: QuantizationResult, mut img: Image<'static>, background: Option<ImgRef<'_, RGBA8>>, settings: &Settings) -> CatResult<(ImgVec<u8>, Vec<RGBA8>)> {
         if let Some(bg) = background {
-            img.set_background(liq.new_image_stride(bg.buf(), bg.width(), bg.height(), bg.stride(), 0.)?)?;
+            let (buf, width, height) = bg.to_contiguous_buf();
+            img.set_background(liq.new_image(buf, width, height, 0.)?)?;
         }
 
-        res.set_dithering_level((settings.quality as f32 / 50.0 - 1.).max(0.));
+        res.set_dithering_level((settings.quality as f32 / 50.0 - 1.).max(0.))?;
 
         let (pal, pal_img) = res.remapped(&mut img)?;
         debug_assert_eq!(img.width() * img.height(), pal_img.len());
@@ -407,7 +417,7 @@ impl Writer {
 
     fn make_diffs(mut inputs: OrdQueueIter<DecodedImage>, quant_queue: Sender<DiffMessage>, settings: &Settings) -> CatResult<()> {
         let (first_frame, first_frame_pts) = inputs.next().transpose()?.ok_or(Error::NoFrames)?;
-        let mut prev_frame_pts = f64::NAN;
+        let mut prev_frame_pts = 0.;
 
         let mut denoiser = Denoiser::new(first_frame.width(), first_frame.height(), settings.quality);
 
@@ -469,9 +479,8 @@ impl Writer {
                     // shifts the whole anim and is the delay of the last frame
                     pts + first_frame_pts
                 } else {
-                    debug_assert!(prev_frame_pts.is_finite());
                     // otherwise assume steady framerate
-                    pts + (pts - prev_frame_pts)
+                    (pts + (pts - prev_frame_pts)).max(1./100.)
                 };
                 debug_assert!(end_pts > 0.);
                 prev_frame_pts = pts;
@@ -499,6 +508,7 @@ impl Writer {
                 dispose,
                 importance_map,
                 ordinal_frame_number,
+                needs_transparency: ordinal_frame_number > 0 || (ordinal_frame_number == 0 && first_frame_has_transparency),
                 image,
                 end_pts,
             })?;
@@ -510,7 +520,7 @@ impl Writer {
     fn quantize_frames(inputs: Receiver<DiffMessage>, remap_queue: Sender<RemapMessage>, settings: &Settings) -> CatResult<()> {
         let mut prev_frame_keeps = false;
         let mut consecutive_frame_num = 0;
-        while let Some(DiffMessage {mut image, end_pts, dispose, ordinal_frame_number, mut importance_map}) = inputs.recv().ok() {
+        while let Some(DiffMessage {mut image, end_pts, dispose, ordinal_frame_number, needs_transparency, mut importance_map}) = inputs.recv().ok() {
             if !prev_frame_keeps || importance_map.iter().any(|&px| px > 0) {
 
                 if 
```

#### Recent Merged Pull Requests:
- **PR #349** (closed): Update "Estimated Size" when cropping (@VoxelAgentSimon)
- **PR #348** (closed): Use crop size for export dimensions (@VoxelAgentSimon)
- **PR #346** (closed): Show warning when frame count would be too low (@william-laverty)
- **PR #345** (closed): Show warning when frame count is too low (@william-laverty)
- **PR #341** (2025-07-08): fix frame flash on bounce #332 (@mmulet)
- **PR #340** (2025-07-06): Quick action tip (@mmulet)
- **PR #339** (2026-01-07): implemented export modified video issue #337 (@mmulet)
- **PR #338** (closed): Export video issue #337 (@mmulet)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
