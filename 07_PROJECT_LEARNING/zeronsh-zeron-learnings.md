> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/zeronsh-zeron-learnings.md`  
> **Source**: github ([https://github.com/zeronsh/zeron](https://github.com/zeronsh/zeron))  
> **Source Version**: `911ec56e`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-20T04:57:05.907Z  
> **Learning ID**: `learn-github-zeronsh-zeron`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): zeronsh/zeron

> **Canonical Artifact**: `07_PROJECT_LEARNING/zeronsh-zeron-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/zeronsh/zeron](https://github.com/zeronsh/zeron))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-20T04:57:04.620Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zeronsh/zeron`
- **Description**: A native control plane for Claude Code, Codex, Cursor, Devin and other coding agents.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3311 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/ios/Zeron/Core/Fonts.swift`
```
import CoreText
import UIKit

/// The bundled faces. Rust measures the exact bytes CoreText draws with, so
/// measurement and rendering share one source of truth.
enum Fonts {
    static let files: [(FaceRole, String)] = [
        (.sans, "Geist"),
        (.sansMedium, "Geist-Medium"),
        (.sansSemibold, "Geist-SemiBold"),
        (.sansBold, "Geist-Bold"),
        (.sansItalic, "Geist-Italic"),
        (.sansMediumItalic, "Geist-MediumItalic"),
        (.sansSemiboldItalic, "Geist-SemiBoldItalic"),
        (.sansBoldItalic, "Geist-BoldItalic"),
        (.mono, "GeistMono"),
        (.monoMedium, "GeistMono-Medium"),
        (.monoSemibold, "GeistMono-SemiBold"),
        (.monoItalic, "GeistMono-Italic"),
    ]

    private static let registry: (faces: [FaceData], graphics: [FaceRole: CGFont]) = {
        var faces: [FaceData] = []
        var graphics: [FaceRole: CGFont] = [:]
        for (role, name) in files {
            guard let url = Bundle.main.url(forResource: name, withExtension: "ttf"),
                  let data = try? Data(contentsOf: url),
                  let provider = CGDataProvider(data: data as CFData),
                  let font = CGFont(provider)
            else { continue }
            CTFontManagerRegisterGraphicsFont(font, nil)
            faces.append(FaceData(role: role, bytes: data))
            graphics[role] = font
        }
        return (faces, graphics)
    }()

    static var faceData: [FaceData] { registry.faces }

    private static let lock = NSLock()
    nonisolated(unsafe) private static var cache: [FontKey: CTFont] = [:]

    private struct FontKey: Hashable {
        let face: FaceRole
        let centi: Int
    }

    /// Thread-safe: the Rust layout thread calls through `PlatformMeasurer`.
    static func ctFont(_ face: FaceRole, size: Float) -> CTFont {
        let key = FontKey(face: face, centi: Int((size * 100).rounded()))
        lock.lock()
        defer { lock.unlock() }
        if let font = cache[key] { return font }
        let font: CTFont
        if let graphic = registry.graphics[face] ?? registry.graphics[.sans] {
            font = CTFontCreateWithGraphicsFont(graphic, CGFloat(size), nil, nil)
        } else {
            font = CTFontCreateUIFontForLanguage(.system, CGFloat(size), nil)!
        }
        cache[key] = font
        return font
    }

    static func ui(_ face: FaceRole, _ size: CGFloat) -> UIFont {
        ctFont(face, size: Float(size)) as UIFont
    }

    /// The core's math faces, by table index (0 Fira Math, 1 STIX Two Math,
    /// …, whichever face the setting picks; glyph ids index these exact
    /// bytes), each at `mathReferenceSize`. Loaded when a row model first
    /// names its index (models build on the prefetch queue, so drawing never
    /// pays the copy) — a face nobody picks is never copied out of the core — and
    /// kept; a failed load is remembered as nil so it's never retried. Never
    /// registered: they're drawn by glyph id, not by name. Glyphs draw at any
    /// size by scaling the context — no per-size fonts, since shrunk formulas
    /// make sizes continuous (and iOS doesn't hint, so a scaled glyph paints
    /// the same as a sized one).
    private static let mathLock = NSLock()
    nonisolated(unsafe) private static var mathFonts: [UInt8: CTFont?] = [:]

    /// The size `mathFont` fonts are made at; scale by `size / this` to draw.
    static let mathReferenceSize: CGFloat = 16

    /// Math font `index` at `mathReferenceSize` (nil: unknown face).
    /// Thread-safe: row models resolve glyph fonts on the prefetch queue (and
    /// on main for a row needed before its prefetch lands).
    static func mathFont(_ index: UInt8) -> CTFont? {
        mathLock.lock()
        defer { mathLock.unlock() }
        if let font = mathFonts[index] { return font }
        let data = mathFontData(index: index)
        var font: CTFont?
        if !data.isEmpty, let provider = CGDataProvider(data: data as CFData), let graphic = CGFont(provider) {
            font = CTFontCreateWithGraphicsFont(graphic, mathReferenceSize, nil, nil)
        }
        mathFonts[index] = .some(font)
        return font
    }
}

/// CoreText as ground truth for glyphs the bundled faces don't cover.
final class CoreTextMeasurer: PlatformMeasurer {
    func measure(face: FaceRole, size: Float, ligatures: Bool, text: String) -> Float {
        let attrs: [NSAttributedString.Key: Any] = [
            .font: Fonts.ctFont(face, size: size),
            .ligature: ligatures ? 1 : 0,
        ]
        let line = CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: attrs))
        return Float(CTLineGetTypographicBounds(line, nil, nil, nil))
    }

    /// Per-scalar advances of `text` laid out as one CoreText line (fallback
    /// font + kerning chosen in context), folded from UTF-16 glyph indices.
    func measureRun(face: FaceRole, size: Float, ligatures: Bool, text: String) -> [Float] {
        let attrs: [NSAttributedString.Key: Any] = [
            .font: Fonts.ctFont(face, size: size),
            .ligature: ligatures ? 1 : 0,
        ]
        let line = CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: attrs))
        let units = text.utf16.count
        var perUnit = [Float](repeating: 0, count: units)
        for case let run as CTRun in CTLineGetGlyphRuns(line) as NSArray {
            let n = CTRunGetGlyphCount(run)
            guard n > 0 else { continue }
            var advances = [CGSize](repeating: .zero, count: n)
            var indices = [CFIndex](repeating: 0, count: n)
            CTRunGetAdvances(run, CFRange(location: 0, length: n), &advances)
            CTRunGetStringIndices(run, CFRange(location: 0, length: n), &indices)
            for i in 0..<n where indices[i] >= 0 && indices[i] < units {
                perUnit[indices[i]] += Float(advances[i].width)
            }
        }
        var out: [Float] = []
        out.reserveCapacity(text.unicodeScalars.count)
        var unit = 0
        for scalar in text.unicodeScalars {
            let width = scalar.utf16.count
            out.append(perUnit[unit..<min(units, unit + width)].reduce(0, +))
            unit += width
        }
        return out
    }
}

/// One process-wide text system shared by every transcript.
enum TextEngine {
    static let shared = TextSystem(faces: Fonts.faceData, measurer: CoreTextMeasurer())
}

```

### Core Architecture Module: `apps/ios/Zeron/Core/Generated/zeron_core.swift`
```
// This file was autogenerated by some hot garbage in the `uniffi` crate.
// Trust me, you don't want to mess with it!

// swiftlint:disable all
import Foundation

// Depending on the consumer's build setup, the low-level FFI code
// might be in a separate module, or it might be compiled inline into
// this module. This is a bit of light hackery to work with both.
#if canImport(zeron_coreFFI)
import zeron_coreFFI
#endif

fileprivate extension RustBuffer {
    // Allocate a new buffer, copying the contents of a `UInt8` array.
    init(bytes: [UInt8]) {
        let rbuf = bytes.withUnsafeBufferPointer { ptr in
            RustBuffer.from(ptr)
        }
        self.init(capacity: rbuf.capacity, len: rbuf.len, data: rbuf.data)
    }

    static func empty() -> RustBuffer {
        RustBuffer(capacity: 0, len:0, data: nil)
    }

    static func from(_ ptr: UnsafeBufferPointer<UInt8>) -> RustBuffer {
        try! rustCall { ffi_zeron_mobile_rustbuffer_from_bytes(ForeignBytes(bufferPointer: ptr), $0) }
    }

    // Frees the buffer in place.
    // The buffer must not be used after this is called.
    func deallocate() {
        try! rustCall { ffi_zeron_mobile_rustbuffer_free(self, $0) }
    }
}

fileprivate extension ForeignBytes {
    init(bufferPointer: UnsafeBufferPointer<UInt8>) {
        self.init(len: Int32(bufferPointer.count), data: bufferPointer.baseAddress)
    }

    init(rawBufferPointer: UnsafeRawBufferPointer) {
        self.init(
            len: Int32(rawBufferPointer.count),
            data: rawBufferPointer.baseAddress?.assumingMemoryBound(to: UInt8.self)
        )
    }
}

// Converter for `&[u8]` / `[ByRef] bytes` arguments.
//
// Conforms to `FfiConverter` so the compiler enforces the full converter
// method set. Only the scope-bound `lower(_:_body:)` overload is sound —
// zero-copy byte buffers only flow foreign -> Rust, and only in argument
// position. The four protocol-witness methods (`lift`, `lower`, `read`,
// `write`) `fatalError` at runtime if anyone reaches them.
//
// The scope-bound `lower` takes a closure because the `ForeignBytes`
// pointer is only guaranteed valid for the duration of
// `Data.withUnsafeBytes`. Callers must run the full FFI call inside
// the closure body.
fileprivate enum FfiConverterByRefBytes: FfiConverter {
    typealias SwiftType = Data
    typealias FfiType = ForeignBytes

    static func lower<R>(_ value: Data, _ body: (ForeignBytes) throws -> R) rethrows -> R {
        return try value.withUnsafeBytes { rawBuf in
            try body(ForeignBytes(rawBufferPointer: rawBuf))
        }
    }

    static func lower(_ value: Data) -> ForeignBytes {
        fatalError("ByRef bytes cannot use the plain lower: returning ForeignBytes escapes the Data.withUnsafeBytes scope. Use the scope-bound lower(_:_body:) overload instead.")
    }

    static func lift(_ value: ForeignBytes) throws -> Data {
        fatalError("ByRef bytes cannot be lifted: zero-copy &[u8] only flows foreign->Rust")
    }

    static func read(from buf: inout (data: Data, offset: Data.Index)) throws -> Data {
        fatalError("ByRef bytes cannot be read from a buffer: zero-copy &[u8] is only supported in argument position, not nested in records/options/etc.")
    }

    static func write(_ value: Data, into buf: inout [UInt8]) {
        fatalError("ByRef bytes cannot be written to a buffer: zero-copy &[u8] is only supported in argument position, not nested in records/options/etc.")
    }
}

// For every type used in the interface, we provide helper methods for conveniently
// lifting and lowering that type from C-compatible data, and for reading and writing
// values of that type in a buffer.

// Helper classes/extensions that don't change.
// Someday, this will be in a library of its own.

fileprivate extension Data {
    init(rustBuffer: RustBuffer) {
        self.init(
            bytesNoCopy: rustBuffer.data!,
            count: Int(rustBuffer.len),
            deallocator: .none
        )
    }
}

// Define reader functionality.  Normally this would be defined in a class or
// struct, but we use standalone functions instead in order to make external
// types work.
//
// With external types, one swift source file needs to be able to call the read
// method on another source file's FfiConverter, but then what visibility
// should Reader have?
// - If Reader is fileprivate, then this means the read() must also
//   be fileprivate, which doesn't work with external types.
// - If Reader is internal/public, we'll get compile errors since both source
//   files will try define the same type.
//
// Instead, the read() method and these helper functions input a tuple of data

fileprivate func createReader(data: Data) -> (data: Data, offset: Data.Index) {
    (data: data, offset: 0)
}

// Reads an integer at the current offset, in big-endian order, and advances
// the offset on success. Throws if reading the integer would move the
// offset past the end of the buffer.
fileprivate func readInt<T: FixedWidthInteger>(_ reader: inout (data: Data, offset: Data.Index)) throws -> T {
    let range = reader.offset..<reader.offset + MemoryLayout<T>.size
    guard reader.data.count >= range.upperBound else {
        throw UniffiInternalError.bufferOverflow
    }
    if T.self == UInt8.self {
        let value = reader.data[reader.offset]
        reader.offset += 1
        return value as! T
    }
    var value: T = 0
    let _ = withUnsafeMutableBytes(of: &value, { reader.data.copyBytes(to: $0, from: range)})
    reader.offset = range.upperBound
    return value.bigEndian
}

// Reads an arbitrary number of bytes, to be used to read
// raw bytes, this is useful when lifting strings
fileprivate func readBytes(_ reader: inout (data: Data, offset: Data.Index), count: Int) throws -> Array<UInt8> {
    let range = reader.offset..<(reader.offset+count)
    guard reader.data.count >= range.upperBound else {
        throw UniffiInternalError.bufferOverflow
    }
    var value = [UInt8](repeating: 0, count: count)
    value.withUnsafeMutableBufferPointer({ buffer in
        reader.data.copyBytes(to: buffer, from: range)
    })
    reader.offset = range.upperBound
    return value
}

// Reads a float at the current offset.
fileprivate func readFloat(_ reader: inout (data: Data, offset: Data.Index)) throws -> Float {
    return Float(bitPattern: try readInt(&reader))
}

// Reads a float at the current offset.
fileprivate func readDouble(_ reader: inout (data: Data, offset: Data.Index)) throws -> Double {
    return Double(bitPattern: try readInt(&reader))
}

// Indicates if the offset has reached the end of the buffer.
fileprivate func hasRemaining(_ reader: (data: Data, offset: Data.Index)) -> Bool {
    return reader.offset < reader.data.count
}

// Define writer functionality.  Normally this would be defined in a class or
// struct, but we use standalone functions instead in order to make external
// types work.  See the above discussion on Readers for details.

fileprivate func createWriter() -> [UInt8] {
    return []
}

fileprivate func writeBytes<S>(_ writer: inout [UInt8], _ byteArr: S) where S: Sequence, S.Element == UInt8 {
    writer.append(contentsOf: byteArr)
}

// Writes an integer in big-endian order.
//
// Warning: make sure what you are trying to write
// is in the correct type!
fileprivate func writeInt<T: FixedWidthInteger>(_ writer: inout [UInt8], _ value: T) {
    var value = value.bigEndian
    withUnsafeBytes(of: &value) { writer.append(contentsOf: $0) }
}

fileprivate func writeFloat(_ writer: inout [UInt8], _ value: Float) {
    writeInt(&writer, value.bitPattern)
}

fileprivate func writeDouble(_ writer: inout [UInt8], _ value: Double) {
    writeInt(&writer, value.bitPattern)
}

// Protocol for types that transfer other types across the FFI. This is
// analogous to the Rust trait of the same name.
fileprivate protocol FfiConverter {
    associatedtype FfiType
    associatedtype SwiftType

    static func lift(_ value: FfiType) throws -> SwiftType
    static func lower(_ value: SwiftType) -> FfiType
    static func read(from buf: inout (data: Data, offset: Data.Index)) throws -> SwiftType
    static func write(_ value: SwiftType, into buf: inout [UInt8])
}

// Types conforming to `Primitive` pass themselves directly over the FFI.
fileprivate protocol FfiConverterPrimitive: FfiConverter where FfiType == SwiftType { }

extension FfiConverterPrimitive {
#if swift(>=5.8)
    @_documentation(visibility: private)
#endif
    public static func lift(_ value: FfiType) throws -> SwiftType {
        return value
    }

#if swift(>=5.8)
    @_documentation(visibility: private)
#endif
    public static func lower(_ value: SwiftType) -> FfiType {
        return value
    }
}

// Types conforming to `FfiConverterRustBuffer` lift and lower into a `RustBuffer`.
// Used for complex types where it's hard to write a custom lift/lower.
fileprivate protocol FfiConverterRustBuffer: FfiConverter where FfiType == RustBuffer {}

extension FfiConverterRustBuffer {
#if swift(>=5.8)
    @_documentation(visibility: private)
#endif
    public static func lift(_ buf: RustBuffer) throws -> SwiftType {
        var reader = createReader(data: Data(rustBuffer: buf))
        let value = try read(from: &reader)
        if hasRemaining(reader) {
            throw UniffiInternalError.incompleteData
        }
        buf.deallocate()
        return value
    }

#if swift(>=5.8)
    @_documentation(visibility: private)
#endif
    public static func lower(_ value: SwiftType) -> RustBuffer {
          var writer = createWriter()
          write(value, into: &writer)
          return RustBuffer(bytes: writer)
    }
}
// An error type for FFI errors. These errors occur at the UniFFI level, not
// the library level.
fileprivate enum UniffiInternalError: LocalizedError {
    case bufferOverflow
    case incompleteData
    case unexpectedOptionalTag
    case unexpectedEnumCase
    case unexpectedNullPointer
    case unexpectedRustCallS
```

### Core Architecture Module: `apps/ios/Zeron/Session/CoreSessionSource.swift`
```
import UIKit

/// A live session backed by the Rust core. The transcript flows Rust→Rust
/// (`TranscriptView.attach`); this maps the composer-facing state.
final class CoreSessionSource: SessionSource {
    private(set) var chrome = SessionChrome()
    var onChange: (() -> Void)?
    private weak var app: AppModel?
    private let client: CoreClient
    private let handle: SessionHandle
    private let chatId: String
    private var token: AnyObject?
    private var appToken: AnyObject?
    private var hostDevice = "" {
        didSet { if hostDevice != oldValue { connectVisuals() } }
    }
    private weak var engine: TranscriptView?

    init(app: AppModel, client: CoreClient, handle: SessionHandle, chatId: String) {
        self.app = app
        self.client = client
        self.handle = handle
        self.chatId = chatId
        token = app.observeSession(chatId) { [weak self] in self?.refresh() }
        appToken = app.observe { [weak self] in self?.refresh() }
        refresh()
    }

    func attach(_ engine: TranscriptView) {
        _ = engine.attach(client: client, chatId: chatId)
        self.engine = engine
        connectVisuals()
        handle.setViewAttached(attached: true)
    }

    /// Agent visuals load their scripts from the chat's host device.
    private func connectVisuals() {
        guard let engine, !hostDevice.isEmpty else { return }
        engine.setVisualSource(client: client, deviceId: hostDevice, pixelScale: Float(max(2, UITraitCollection.current.displayScale)))
    }

    func detach() {
        handle.setViewAttached(attached: false)
    }

    func reattach() {
        handle.setViewAttached(attached: true)
    }

    private func refresh() {
        let c = handle.composer()
        let row = app?.row(chatId)
        hostDevice = c.host.deviceId
        var next = SessionChrome()
        next.title = c.title
        let project = row?.project?.name ?? "No project"
        next.subtitle = c.host.name.map { "\(project) @ \($0)" } ?? project
        next.running = c.live.turnRunning
        next.canSteer = c.host.capabilities.midTurnSteering ?? false
        next.placeholder = "Message \(row?.harnessLabel ?? "the agent")"
        var chips: [ComposerChip] = []
        if let model = row?.modelLabel ?? row?.harnessLabel {
            chips.append(ComposerChip(id: "model", title: model, symbol: nil, icon: BrandMarks.image(for: row?.harness ?? "claude-code", side: 13)))
        }
        if let r = row?.reasoning, !r.isEmpty {
            chips.append(ComposerChip(id: "effort", title: reasoningLabel(level: r), symbol: "gauge.with.dots.needle.67percent"))
        }
        if let pr = row?.pullRequest {
            let state: SessionRowVM.PR = switch pr.state { case .open: .open; case .merged: .merged; case .closed: .closed }
            chips.append(ComposerChip(id: "pr", title: "\(pr.number)", symbol: nil, tint: PRBadgeView.tone(state), icon: PRIcon.image(side: 12)))
        } else if let b = row?.branch, !b.isEmpty {
            chips.append(ComposerChip(id: "branch", title: b, symbol: nil, icon: BranchIcon.sized()))
        }
        if let usage = c.contextUsage, let tokens = usage.tokens, let window = usage.window, window > 0 {
            let fraction = Double(tokens) / Double(window)
            if fraction >= 0.5 {
                chips.append(ComposerChip(
                    id: "context",
                    title: "\(Int((fraction * 100).rounded()))% context",
                    symbol: fraction >= 0.85 ? "exclamationmark.circle" : "circle.lefthalf.filled",
                    tint: fraction >= 0.85 ? Palette.warning : nil
                ))
            }
        }
        next.chips = chips
        if let sendFailure {
            next.banner = .failed(sendFailure)
        } else if c.sendState == .failed {
            next.banner = .notDelivered
        } else if c.sendState == .queued {
            next.banner = .failed("\(c.host.name ?? "Host") is offline — will send when it's back")
        } else if c.sendState == .sending {
            next.banner = .sending
        } else if app?.connectivity?.state == .offline {
            next.banner = .offline
        } else if !c.room.connected, let retry = c.room.retryAtMs {
            next.banner = .reconnecting(in: max(1, Int((retry - Int64(Date().timeIntervalSince1970 * 1000)) / 1000)))
        }
        next.uploadProgress = c.transferProgress
        // Working state is shown at the transcript tail (layout engine), not here.
        if let input = c.openInput {
            next.questions = (input.requestId, input.questions.map {
                SessionChrome.Question(id: $0.id, header: $0.header, text: $0.question, options: $0.options, multiSelect: $0.multiSelect, prefill: $0.prefill, multiline: $0.multiline)
            })
        }
        next.queue = c.queue.map { q in
            let gate: String? = switch q.gate {
            case let .editing(_, _, mine)?: mine ? "Editing" : "Being edited"
            case .reviewRequired?: "Needs review"
            case nil: q.actionPending ? "Updating" : nil
            }
            return SessionChrome.QueuedItem(id: q.id, text: q.visibleText, thumbnail: nil, gate: gate)
        }
        next.error = c.queueError
        if next != chrome {
            chrome = next
            onChange?()
        }
    }

    /// False when the core refused the message (it stays in the composer).
    @discardableResult
    func send(text: String, images: [StagedImage], mode: DeliveryMode) -> Bool {
        do {
            if mode == .interrupt, chrome.running { try handle.interrupt() }
            _ = try handle.send(request: SendRequest(text: text, attachments: images.map(\.outgoing), worktree: nil, busy: mode == .steer ? .steer : .queue))
            app?.noteDeliveryActivity()
            sendFailure = nil
            return true
        } catch {
            // Kept across refreshes (which rebuild the chrome) until the next send.
            sendFailure = "Couldn't send: \(error)"
            refresh()
            return false
        }
    }

    private var sendFailure: String?

    func stop() {
        try? handle.interrupt()
    }

    func answer(requestId: String, answers: [(questionId: String, labels: [String])]) {
        try? handle.respondInput(requestId: requestId, answers: answers.map { UserInputAnswer(questionId: $0.questionId, labels: $0.labels) })
    }

    func queueAction(_ id: String, _ action: QueueAction) {
        switch action {
        // Steers text into the live turn (never interrupts it); only
        // attachment rows stop the turn to send.
        case .sendNow: Task { _ = try? await handle.deliverQueuedNow(id: id) }
        case .remove: Task { _ = try? await handle.removeQueued(id: id) }
        case .moveUp: _ = try? handle.moveQueuedBy(id: id, delta: -1)
        case .moveDown: _ = try? handle.moveQueuedBy(id: id, delta: 1)
        case .edit: break // Driven by the view: beginEdit / finishEdit.
        }
    }

    private var lease: QueueEditLease?
    private var renewal: Task<Void, Never>?
    /// The row as it was when the edit began: the composer only edits its
    /// visible text, the rest (Appshot context, attachment trailer) rides along.
    private var editBase: (raw: String, visible: String)?

    func beginEdit(_ id: String) async -> String? {
        let start = await handle.beginQueuedEdit(id: id, instanceId: UUID().uuidString)
        guard case let .acquired(lease) = start else { return nil }
        self.lease = lease
        renewal?.cancel()
        renewal = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(20))
                guard let self, let lease = self.lease, !Task.isCancelled else { return }
                if await !self.handle.renewQueuedEdit(lease: lease) { return }
            }
        }
        guard let item = handle.composer().queue.first(where: { $0.id == id }) else { return nil }
        editBase = (item.text, item.visibleText)
        return item.visibleText
    }

    func finishEdit(text: String?) async {
        renewal?.cancel()
        let base = editBase
        editBase = nil
        guard let lease else { return }
        self.lease = nil
        var body = text
        if let edited = text, let base {
            // Unchanged: release the row as it was (a commit would drop what
            // the composer never showed).
            body = edited == base.visible ? nil : Self.replacingVisible(in: base.raw, visible: base.visible, with: edited)
        }
        _ = await handle.finishQueuedEdit(lease: lease, action: body == nil ? .cancel : .commit, text: body)
    }

    /// The row's raw text with its visible part replaced, keeping the hidden
    /// context after it. Blank edits stay blank (the host removes the row).
    static func replacingVisible(in raw: String, visible: String, with edited: String) -> String {
        if edited.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || raw == visible { return edited }
        let body = raw.drop(while: \.isWhitespace)
        if body.hasPrefix(visible) { return edited + body.dropFirst(visible.count) }
        // Attachment-only rows show a placeholder: all of the raw text is context.
        return body.isEmpty ? edited : edited + "\n\n" + body
    }

    func retryDelivery() {
        try? handle.retryDelivery()
    }

    func chipMenu(_ id: String) -> UIMenu? {
        guard let row = app?.row(chatId) else { return nil }
        let harness = row.harness ?? "claude-code"
        switch id {
        case "model":
            return UIMenu(title: "Model", children: [UIDeferredMenuElement { [weak self] done in
                guard let self else { return done([]) }
                Task { @MainActor in
                    let models = (try? await self.client.listModels(deviceId: self.hostDevice, harness: harness)) ?? fallbackModels(harness: harness)
                    done(mode
```

### Core Architecture Module: `crates/audio/src/worker.rs`
```
//! Poll on an audio worker, never GPUI or a hardware callback. Exact 10 ms
//! DSP windows retain partial frames between polls; network frames are 20 ms.
use crate::{
    AudioError,
    aec::{DSP_SAMPLES, EchoProcessor},
    dsp::Resampler,
    native::AudioIo,
};
use std::collections::VecDeque;
use std::sync::atomic::Ordering;
use zeron_proto::voice::VoiceFrame;

pub struct AudioWorker {
    pub io: AudioIo,
    echo: EchoProcessor,
    mic_resampler: Resampler,
    reference_resampler: Resampler,
    mic: VecDeque<f32>,
    reference: VecDeque<f32>,
    network: Vec<f32>,
    scratch: Vec<f32>,
    generation: u64,
    sequence: u64,
}
impl AudioWorker {
    pub fn open(generation: u64) -> Result<Self, AudioError> {
        let io = AudioIo::open(generation)?;
        Ok(Self {
            echo: EchoProcessor::new()?,
            mic_resampler: Resampler::new(io.input_rate, 48_000).ok_or(AudioError::Device)?,
            reference_resampler: Resampler::new(io.output_rate, 48_000)
                .ok_or(AudioError::Device)?,
            io,
            mic: VecDeque::with_capacity(9600),
            reference: VecDeque::with_capacity(9600),
            network: Vec::with_capacity(480),
            scratch: Vec::with_capacity(8),
            generation,
            sequence: 0,
        })
    }
    pub fn poll(&mut self) -> Result<Vec<VoiceFrame>, AudioError> {
        if self.io.failed.load(Ordering::Acquire) {
            return Err(AudioError::Device);
        }
        while let Some(sample) = self.io.reference.pop() {
            self.scratch.clear();
            self.reference_resampler.push(sample, &mut self.scratch);
            self.reference.extend(self.scratch.iter().copied());
            if self.reference.len() > 9600 {
                return Err(AudioError::Overflow);
            }
        }
        while self.reference.len() >= DSP_SAMPLES {
            let frame = std::array::from_fn(|_| self.reference.pop_front().unwrap());
            self.echo.render(&frame)?;
        }
        if self.io.muted.load(Ordering::Acquire) {
            while self.io.capture.pop().is_some() {}
            self.mic.clear();
            self.network.clear();
            self.mic_resampler = Resampler::new(self.io.input_rate, 48_000).unwrap();
            return Ok(Vec::new());
        }
        while let Some(sample) = self.io.capture.pop() {
            self.scratch.clear();
            self.mic_resampler.push(sample, &mut self.scratch);
            self.mic.extend(self.scratch.iter().copied());
            if self.mic.len() > 9600 {
                return Err(AudioError::Overflow);
            }
        }
        let mut frames = Vec::with_capacity(10);
        while self.mic.len() >= DSP_SAMPLES {
            let mut frame = std::array::from_fn(|_| self.mic.pop_front().unwrap());
            self.echo.capture(&mut frame)?;
            // Exact 48 -> 24 kHz decimation with a pair average after AEC.
            self.network
                .extend(frame.chunks_exact(2).map(|s| (s[0] + s[1]) * 0.5));
            if self.network.len() == 480 {
                self.sequence += 1;
                frames.push(crate::encode(
                    &self.network,
                    self.generation,
                    self.sequence,
                )?);
                self.network.clear();
            }
        }
        Ok(frames)
    }
    pub fn invalidate_playout(&mut self, next_generation: u64) -> Result<(), AudioError> {
        self.io.flush(next_generation);
        self.echo.reset()?;
        self.generation = next_generation;
        self.sequence = 0;
        self.mic.clear();
        self.reference.clear();
        self.network.clear();
        self.mic_resampler = Resampler::new(self.io.input_rate, 48_000).unwrap();
        self.reference_resampler = Resampler::new(self.io.output_rate, 48_000).unwrap();
        Ok(())
    }
}

```

### Core Architecture Module: `crates/doc/src/queue.rs`
```
//! The pending-message queue on a session doc.
//!
//! What you typed while the agent was busy, held where every device can see it
//! (and edit it) until the host has somewhere to put it. Distinct from the
//! `commands` ledger next door: commands are append-only and immutable by
//! design (rule 1), and a queue whose rows can be retyped, reordered and
//! dropped is the opposite of that. So it gets its own container.
//!
//! `queue` is a **LoroMovableList** rather than the plain `LoroList` the rest
//! of the doc uses. A plain list has no move: reordering means delete+insert,
//! which two devices doing it at once resolve into duplicated or lost rows.
//! MovableList carries a real move op, so concurrent reorders converge on one
//! order with every row still present exactly once.
//!
//! Writers: any device (unlike `messages`, which is host-only). The host is
//! the only one that *takes* from the queue — see `DocHost::drain_queue`.

use loro::ToJson;
use serde::{Deserialize, Serialize};

use crate::schema::{DocError, SessionDoc};

/// One unsent message waiting its turn.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueuedMessage {
    /// Stable through promotion: the host uses this as the transcript user
    /// message id when the row is finally dispatched.
    pub id: String,
    /// What the user typed. Never empty — emptying it deletes the row.
    pub text: String,
    /// Committed upload paths, staged at queue time so the row never points at
    /// files that only exist on the device that typed it.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachments: Vec<String>,
    /// Do not automatically steer this row into a live turn. The row remains
    /// visible until turn end or an explicit Steer now / Send now action.
    #[serde(default, skip_serializing_if = "is_false")]
    pub hold_for_turn_end: bool,
    /// Device that queued it.
    pub issued_by: String,
    /// Epoch millis.
    pub issued_at: i64,
    /// Epoch millis of the last text edit, when there has been one.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub edited_at: Option<i64>,
    /// Host-authoritative barrier preventing this row from reaching the
    /// agent while a client has an edit open. Expired edits fail closed into
    /// `ReviewRequired`; they never silently become sendable again.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub delivery_gate: Option<QueueDeliveryGate>,
}

/// Why a queued row is not currently eligible for automatic or explicit
/// delivery. Kept on the row so moves preserve it and deleting the row cannot
/// leave an orphaned lease behind.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum QueueDeliveryGate {
    Editing {
        lease_id: String,
        owner_device_id: String,
        owner_instance_id: String,
        acquired_at_ms: i64,
        expires_at_ms: i64,
        base_text_hash: String,
    },
    ReviewRequired {
        previous_lease_id: String,
        owner_device_id: String,
        since_ms: i64,
        base_text_hash: String,
    },
}

fn is_false(value: &bool) -> bool {
    !*value
}

impl QueuedMessage {
    pub fn new(
        id: impl Into<String>,
        text: impl Into<String>,
        issued_by: impl Into<String>,
    ) -> Self {
        Self {
            id: id.into(),
            text: text.into(),
            attachments: Vec::new(),
            hold_for_turn_end: false,
            issued_by: issued_by.into(),
            issued_at: 0,
            edited_at: None,
            delivery_gate: None,
        }
    }
}

impl SessionDoc {
    /// The queue in send order. Malformed rows skip rather than poison the read.
    pub fn read_queue(&self) -> Result<Vec<QueuedMessage>, DocError> {
        let raw = self
            .doc()
            .get_movable_list("queue")
            .get_deep_value()
            .to_json_value();
        let items: Vec<serde_json::Value> = match serde_json::from_value(raw) {
            Ok(items) => items,
            Err(_) => return Ok(Vec::new()),
        };
        Ok(items.into_iter().filter_map(queued_from_json).collect())
    }

    /// Append to the back of the queue.
    pub fn push_queued(&self, item: &QueuedMessage) -> Result<(), DocError> {
        if item.id.trim().is_empty() {
            return Err(DocError::Schema("queued message id required".into()));
        }
        if item.text.trim().is_empty() {
            return Err(DocError::Schema("queued message text required".into()));
        }
        let queue = self.doc().get_movable_list("queue");
        let map = queue.push_container(loro::LoroMap::new())?;
        write_queued_map(&map, item)?;
        self.doc().commit();
        Ok(())
    }

    /// Put a row back at `index` (clamped). The host's undo for a send that
    /// failed after the row was taken: it goes back where it was rather than to
    /// the back of the queue, so a failed "send now" doesn't demote the message
    /// the user just called urgent.
    pub fn insert_queued(&self, index: usize, item: &QueuedMessage) -> Result<(), DocError> {
        if item.id.trim().is_empty() {
            return Err(DocError::Schema("queued message id required".into()));
        }
        if item.text.trim().is_empty() {
            return Err(DocError::Schema("queued message text required".into()));
        }
        let queue = self.doc().get_movable_list("queue");
        let map = queue.insert_container(index.min(queue.len()), loro::LoroMap::new())?;
        write_queued_map(&map, item)?;
        self.doc().commit();
        Ok(())
    }

    /// Retype one row. Empty text means "I don't want to send this after all",
    /// so the row goes — that is the delete gesture, not an error.
    /// `false` when there is no such row, or the text is unchanged.
    pub fn set_queued_text(&self, id: &str, text: &str, now_ms: i64) -> Result<bool, DocError> {
        if text.trim().is_empty() {
            return self.remove_queued(id);
        }
        let queue = self.doc().get_movable_list("queue");
        let Some(index) = index_of(&queue, id) else {
            return Ok(false);
        };
        let Some(loro::ValueOrContainer::Container(loro::Container::Map(map))) = queue.get(index)
        else {
            return Ok(false);
        };
        let unchanged = matches!(
            map.get("text"),
            Some(loro::ValueOrContainer::Value(loro::LoroValue::String(s))) if s.as_str() == text
        );
        if unchanged {
            return Ok(false);
        }
        map.insert("text", text)?;
        map.insert("editedAt", now_ms)?;
        self.doc().commit();
        Ok(true)
    }

    /// Install, replace or clear a host-authoritative delivery barrier.
    /// Callers serialize this with the host's queue drain lock.
    pub fn set_queued_delivery_gate(
        &self,
        id: &str,
        gate: Option<&QueueDeliveryGate>,
    ) -> Result<bool, DocError> {
        let queue = self.doc().get_movable_list("queue");
        let Some(index) = index_of(&queue, id) else {
            return Ok(false);
        };
        let Some(loro::ValueOrContainer::Container(loro::Container::Map(map))) = queue.get(index)
        else {
            return Ok(false);
        };
        match gate {
            Some(gate) => map.insert(
                "deliveryGate",
                crate::schema::loro_value_from_json(&serde_json::to_value(gate)?),
            )?,
            None => {
                map.delete("deliveryGate")?;
            }
        }
        self.doc().commit();
        Ok(true)
    }

    /// Resolve an edit in one document commit. `None` cancels and preserves
    /// the old text; an empty replacement discards the row; any other value
    /// updates the text and clears the delivery gate atomically.
    ///
    /// Lease ownership is deliberately checked by `DocHost` while holding
    /// its drain lock immediately before this method is called.
    pub fn finish_queued_edit(
        &self,
        id: &str,
        replacement: Option<&str>,
        now_ms: i64,
    ) -> Result<bool, DocError> {
        self.finish_queued_edit_with_attachments(id, replacement, None, now_ms)
    }

    /// Replace text and optional attachment paths in the same CRDT commit
    /// that releases the row. `None` preserves attachments for older clients;
    /// an empty slice explicitly removes all attachments.
    pub fn finish_queued_edit_with_attachments(
        &self,
        id: &str,
        replacement: Option<&str>,
        attachments: Option<&[String]>,
        now_ms: i64,
    ) -> Result<bool, DocError> {
        if replacement.is_some_and(|text| text.trim().is_empty()) {
            return self.remove_queued(id);
        }
        let queue = self.doc().get_movable_list("queue");
        let Some(index) = index_of(&queue, id) else {
            return Ok(false);
        };
        let Some(loro::ValueOrContainer::Container(loro::Container::Map(map))) = queue.get(index)
        else {
            return Ok(false);
        };
        if let Some(text) = replacement {
            let unchanged = matches!(
                map.get("text"),
                Some(loro::ValueOrContainer::Value(loro::LoroValue::String(s)))
                    if s.as_str() == text
            );
            if !unchanged {
                map.insert("text", text)?;
                map.insert("editedAt", now_ms)?;
            }
        }
        if let Some(attachments) = attachments {
            map.insert(
                "attachments",
                crate::schema::loro_value_from_json(&serde_json::to_value(attachments)?),
            )?;
            map.insert("editedAt", now_ms)?;
        }
        map.delete("deliveryGate")?;
        self.doc().commit();
        Ok(true)
    }

```

### Core Architecture Module: `crates/engine/examples/mcp_standalone_smoke.rs`
```
//! Isolated MCP stdio instance for manual discovery/create/converse smoke tests.
//! Run with `cargo run -p zeron-engine --example mcp_standalone_smoke`.
//! Uses a temporary profile and scripted harness, never the user's workspace.

use std::sync::Arc;

use async_trait::async_trait;
use futures::stream::BoxStream;
use zeron_engine::{EngineCore, HarnessRegistry};
use zeron_harness::{Harness, HarnessError, RunControls, mock::MockHarness};
use zeron_mcp::{Origin, Tools, Zeron};
use zeron_proto::{
    AgentEvent, DoneStatus, HarnessId, Model, ReasoningLevel, RunRequest, SteeringMode,
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let dir = tempfile::tempdir()?;
    std::fs::write(dir.path().join("device-id"), "smoke-device")?;
    let registry = HarnessRegistry::new();
    registry.register(Arc::new(SmokeHarness));
    let core = EngineCore::assemble(dir.path(), Arc::new(registry), HarnessId::Codex, None)?;
    core.workspace.create_space(
        "smoke-project",
        "smoke-device",
        dir.path().to_str().unwrap(),
        Some("Smoke project".into()),
        false,
    )?;
    core.workspace
        .create_chat("smoke-origin", Some("smoke-project"), None, None, None)?;
    core.workspace.rename_chat("smoke-origin", "Coordinator")?;
    let tools = Tools::new(Arc::new(Zeron::with_client(
        zeron_rpc::memory_client(core.rpc_service()),
        Origin {
            chat_id: Some("smoke-origin".into()),
            device_id: Some("smoke-device".into()),
        },
    )));
    zeron_mcp::serve_stdio(Arc::new(tools)).await?;
    core.shutdown().await;
    Ok(())
}

/// A scripted, installed Codex adapter: the production catalog excludes Mock.
struct SmokeHarness;

#[async_trait]
impl Harness for SmokeHarness {
    fn id(&self) -> HarnessId {
        HarnessId::Codex
    }
    fn display_name(&self) -> &str {
        "Scripted Codex (smoke only)"
    }
    fn supports_steering(&self) -> bool {
        false
    }
    fn steering_mode(&self) -> SteeringMode {
        SteeringMode::TurnBoundary
    }
    fn reasoning_levels(&self) -> &[ReasoningLevel] {
        &[]
    }
    async fn models(&self) -> Result<Vec<Model>, HarnessError> {
        Ok(vec![Model {
            id: "smoke-1".into(),
            label: "Smoke 1".into(),
            description: None,
            reasoning_levels: vec![],
            options: vec![],
        }])
    }
    async fn run(
        &self,
        request: RunRequest,
        controls: RunControls,
    ) -> Result<BoxStream<'static, Result<AgentEvent, HarnessError>>, HarnessError> {
        let session_id = uuid::Uuid::new_v4().to_string();
        let mock = MockHarness {
            script: vec![
                AgentEvent::SessionStarted {
                    harness: HarnessId::Codex,
                    model: "smoke-1".into(),
                    tools: vec![],
                    cwd: request.cwd.clone(),
                    session_id: session_id.clone(),
                    assistant_message_id: uuid::Uuid::new_v4().to_string(),
                },
                AgentEvent::TextDelta {
                    text: "pong".into(),
                },
                AgentEvent::Done {
                    status: DoneStatus::Completed,
                    result: None,
                    error: None,
                    session_id: Some(session_id),
                },
            ],
        };
        mock.run(request, controls).await
    }
}

```

### Core Architecture Module: `crates/engine/examples/sidecar_probe.rs`
```
//! Isolate `DocHost::upload_tool_sidecar`: point it at a one-shot local HTTP
//! listener and report whether the PUT ever arrives. Diagnosing the
//! zero-blobs-in-prod mystery (refs stamped, uploads absent, no warns).
use std::sync::Arc;

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use zeron_engine::doc_host::{DocHost, DocHostConfig, EdgeConfig};
use zeron_sync::DocsStore;

#[tokio::main]
async fn main() {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let server = tokio::spawn(async move {
        let (mut sock, _) = listener.accept().await.unwrap();
        let mut buf = vec![0u8; 4096];
        let n = sock.read(&mut buf).await.unwrap();
        let head = String::from_utf8_lossy(&buf[..n]);
        let first = head.lines().next().unwrap_or("").to_string();
        let auth = head
            .lines()
            .find(|l| l.to_lowercase().starts_with("authorization"))
            .unwrap_or("")
            .to_string();
        let _ = sock
            .write_all(b"HTTP/1.1 200 OK\r\ncontent-length: 11\r\ncontent-type: application/json\r\n\r\n{\"ok\":true}")
            .await;
        (first, auth)
    });

    let dir = std::env::temp_dir().join(format!("sidecar-probe-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let store = Arc::new(DocsStore::open(&dir).unwrap());
    let host = DocHost::new(
        store,
        DocHostConfig {
            device_id: "probe-dev".into(),
            default_harness: zeron_proto::HarnessId::ClaudeCode,
            edge: Some(EdgeConfig::with_static_token(
                format!("http://{addr}"),
                "probe-user",
            )),
        },
    );
    host.upload_tool_sidecar(
        "chat-probe",
        zeron_doc::SidecarPayload {
            part_id: "part#1".into(),
            output: Some("full output body".into()),
            diff: None,
        },
    );

    match tokio::time::timeout(std::time::Duration::from_secs(5), server).await {
        Ok(Ok((first, auth))) => {
            println!("PUT ARRIVED: {first}");
            println!("auth header present: {}", !auth.is_empty());
        }
        _ => println!("NO REQUEST within 5s — uploader silently skipped"),
    }
    let _ = std::fs::remove_dir_all(&dir);
}

```

### Core Architecture Module: `crates/engine/examples/transcript_load_probe.rs`
```
//! Read-only profiler for exported local snapshots. Prints timings, not content.
use std::time::Instant;
fn main() -> Result<(), Box<dyn std::error::Error>> {
    for path in std::env::args().skip(1) {
        let started = Instant::now();
        let bytes = std::fs::read(&path)?;
        let read = started.elapsed();
        let doc = loro::LoroDoc::new();
        let t = Instant::now();
        doc.import(&bytes)?;
        let import = t.elapsed();
        let doc = zeron_doc::SessionDoc::from_doc(doc);
        let t = Instant::now();
        let tail = doc.read_opening_tail(128)?;
        let tail_materialize = t.elapsed();
        let t = Instant::now();
        let preview = zeron_doc::TranscriptUpdate {
            frame: zeron_doc::TranscriptFrame::reset(&tail),
            context_usage: doc.context_usage(),
            replay_baseline: Some(zeron_doc::TranscriptBaseline::capture(&tail)),
        };
        let tail_wire = serde_json::to_vec(&serde_json::to_value(preview)?)?;
        let _: zeron_doc::TranscriptUpdate =
            serde_json::from_value(serde_json::from_slice(&tail_wire)?)?;
        println!(
            "opening tail parts={} wire_bytes={} materialize={tail_materialize:?} serialize_and_decode={:?}",
            tail.iter().map(|e| e.parts.len()).sum::<usize>(),
            tail_wire.len(),
            t.elapsed()
        );
        let t = Instant::now();
        let entries = zeron_doc::join_continuation_entries(doc.read_entries()?);
        let materialize = t.elapsed();
        let mut kinds = std::collections::BTreeMap::<&str, (usize, usize, usize)>::new();
        for entry in &entries {
            for part in &entry.parts {
                let kind = match part {
                    zeron_doc::MessagePart::Text { .. } => "text",
                    zeron_doc::MessagePart::Reasoning { .. } => "reasoning",
                    zeron_doc::MessagePart::Tool { .. } => "tool",
                    _ => "other",
                };
                let size = part.byte_len();
                let slot = kinds.entry(kind).or_default();
                slot.0 += 1;
                slot.1 += size;
                slot.2 = slot.2.max(size);
            }
        }
        println!("part count/bytes/max: {kinds:?}");

        let t = Instant::now();
        let update = zeron_doc::TranscriptUpdate {
            frame: zeron_doc::TranscriptFrame::reset(&entries),
            context_usage: doc.context_usage(),
            replay_baseline: Some(zeron_doc::TranscriptBaseline::capture(&entries)),
        };
        let value = serde_json::to_value(update)?;
        let wire = serde_json::to_vec(&value)?;
        let serialize = t.elapsed();
        let t = Instant::now();
        let value: serde_json::Value = serde_json::from_slice(&wire)?;
        let _: zeron_doc::TranscriptUpdate = serde_json::from_value(value)?;
        let deserialize = t.elapsed();
        println!(
            "{} snapshot_bytes={} entries={} wire_bytes={} read={read:?} import={import:?} materialize={materialize:?} serialize={serialize:?} deserialize={deserialize:?}",
            path,
            bytes.len(),
            entries.len(),
            wire.len()
        );
    }
    Ok(())
}

```

### Core Architecture Module: `crates/engine/examples/workspace_search_bench.rs`
```
//! Workspace search benchmark: the `SearchFiles` (`@`),
//! `SearchWorkspaceFiles` (file tree) and `SearchWorkspaceContent` (cmd+K)
//! paths against one folder.
//!
//! ```text
//! BENCH_ROOT=/path/to/checkout cargo run --release -p zeron-engine \
//!     --example workspace_search_bench
//! ```
//!
//! `BENCH_QUERIES` (comma separated) overrides the default queries and
//! `BENCH_RUNS` the number of timed runs per query (default 10, after one
//! warm-up). RSS comes from `/proc/self/status`, so it prints only on Linux.
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use zeron_engine::Repos;

const DEFAULT_QUERIES: &[&str] = &[
    "composer",
    "repos",
    "cmdpal",
    "Cargo.toml",
    "workspace_files",
];

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let root = std::env::var_os("BENCH_ROOT")
        .map(PathBuf::from)
        .ok_or("set BENCH_ROOT to the folder to search")?;
    let root = std::fs::canonicalize(root)?;
    let queries: Vec<String> = match std::env::var("BENCH_QUERIES") {
        Ok(list) => list
            .split(',')
            .map(str::trim)
            .filter(|q| !q.is_empty())
            .map(str::to_owned)
            .collect(),
        Err(_) => DEFAULT_QUERIES.iter().map(|q| (*q).to_owned()).collect(),
    };
    let runs: usize = std::env::var("BENCH_RUNS")
        .ok()
        .and_then(|runs| runs.parse().ok())
        .unwrap_or(10)
        .max(1);
    let runtime = tokio::runtime::Runtime::new()?;
    let data = tempfile::tempdir()?;
    let repos = Repos::with_worktrees_root(data.path(), "bench", data.path().join("worktrees"));

    println!("root: {}", root.display());
    print_rss("baseline");

    let search = repos.workspace_search();
    let started = Instant::now();
    search.warm(&root)?;
    if !search.wait_until_indexed(&root, Duration::from_secs(600)) {
        return Err("index did not finish within 10 minutes".into());
    }
    println!(
        "index ready in {:?}",
        started.elapsed()
    );
    print_rss("after index");

    println!();
    println!(
        "{:<38} {:>10} {:>10} {:>10} {:>8}",
        "query", "min", "median", "max", "results"
    );
    for query in &queries {
        let (timings, results) = measure(runs, || {
            runtime
                .block_on(repos.search_files(root.clone(), query.clone(), Vec::new()))
                .map(|matches| matches.len())
        })?;
        report(&format!("SearchFiles {query}"), &timings, results);
    }
    for query in &queries {
        let (timings, results) = measure(runs, || tree_search(&repos, &root, query, false))?;
        report(&format!("SearchWorkspaceFiles {query}"), &timings, results);
    }
    for query in &queries {
        let (timings, results) = measure(runs, || tree_search(&repos, &root, query, true))?;
        report(&format!("…including ignored {query}"), &timings, results);
    }
    for query in &queries {
        let (timings, results) = measure(runs, || {
            search
                .search_content(&root, query, 100, 3)
                .map(|found| found.matches.len())
        })?;
        report(
            &format!("SearchWorkspaceContent {query}"),
            &timings,
            results,
        );
    }
    print_rss("after all queries");
    search.release_all();
    // Release runs off-thread; give it and the allocator a moment.
    std::thread::sleep(Duration::from_secs(2));
    println!("live indexes after release: {}", search.live());
    print_rss("after evicting the index");
    Ok(())
}

fn tree_search(
    repos: &Repos,
    root: &Path,
    query: &str,
    include_ignored: bool,
) -> Result<usize, Box<dyn std::error::Error>> {
    Ok(zeron_engine::workspace_files::bench_search_root(
        repos.workspace_search(),
        root,
        query,
        include_ignored,
        zeron_engine::workspace_files::MAX_SEARCH_RESULTS,
    )?
    .len())
}

/// One warm-up, then `runs` timed calls.
fn measure<E: Into<Box<dyn std::error::Error>>>(
    runs: usize,
    mut search: impl FnMut() -> Result<usize, E>,
) -> Result<(Vec<Duration>, usize), Box<dyn std::error::Error>> {
    search().map_err(Into::into)?;
    let mut timings = Vec::with_capacity(runs);
    let mut results = 0;
    for _ in 0..runs {
        let started = Instant::now();
        results = search().map_err(Into::into)?;
        timings.push(started.elapsed());
    }
    timings.sort();
    Ok((timings, results))
}

fn report(label: &str, timings: &[Duration], results: usize) {
    println!(
        "{label:<38} {:>10} {:>10} {:>10} {results:>8}",
        format_duration(timings[0]),
        format_duration(timings[timings.len() / 2]),
        format_duration(timings[timings.len() - 1]),
    );
}

fn format_duration(duration: Duration) -> String {
    format!("{:.2}ms", duration.as_secs_f64() * 1000.0)
}

fn print_rss(label: &str) {
    let Ok(status) = std::fs::read_to_string("/proc/self/status") else {
        return;
    };
    if let Some(line) = status.lines().find(|line| line.starts_with("VmRSS:")) {
        println!("RSS {label}: {}", line.trim_start_matches("VmRSS:").trim());
    }
}

```

### Core Architecture Module: `crates/engine/src/agent_accounts.rs`
```
//! AgentAccounts — the logins of every agent CLI on this device that has one
//! (feature-inventory §3.7 "Agent accounts"; port of zeron's
//! `agent-accounts.ts`).
//!
//! Grok, Devin, OpenCode, Pi and Hermes live in [`stores`] (credential
//! formats and detection), [`oauth`] (the sign-ins the engine drives itself)
//! and [`usage`] (their quota probes); each module documents per provider
//! what is supported and why. In short:
//!
//! | agent    | detect | switch | add account                    | usage |
//! |----------|--------|--------|--------------------------------|-------|
//! | Grok     | yes    | yes    | `grok login --device-auth`     | yes   |
//! | Devin    | yes    | yes    | ACP `authenticate` (loopback)  | yes   |
//! | OpenCode | yes    | yes    | ChatGPT loopback, Copilot code | yes   |
//! | Pi       | yes    | yes    | ChatGPT loopback               | yes   |
//! | Hermes   | yes    | no¹    | `hermes auth add` (device code) | yes  |
//!
//! ¹ Hermes keeps every account in its own credential pool and rotates
//! through it itself; zeron lists the pool and adds to it through Hermes'
//! own CLI, but never rewrites it.
//!
//! The original four providers each store exactly one live login:
//!
//! - **Claude Code** — credentials in `~/.claude/.credentials.json`
//!   (`$CLAUDE_CONFIG_DIR` relocates the dir) or, on macOS, the Keychain item
//!   `Claude Code-credentials`; the account identity (`oauthAccount`, `userID`)
//!   lives in `~/.claude.json`.
//! - **Codex** — `$CODEX_HOME/auth.json` (default `~/.codex`): a ChatGPT OAuth
//!   token set (identity inside the `id_token` JWT) or a raw API key.
//! - **Cursor** — `~/.cursor/sdk/auth.json`: the Cursor SDK's credential store
//!   (`StoredSdkCredentials`) holding the named, expiring user API key its
//!   browser login mints. Deliberately SEPARATE from `cursor-agent login`'s
//!   whole-account session tokens, which zeron never reads.
//! - **Antigravity** — its ACP server keeps one Google login per
//!   `GEMINI_HOME`: a token blob in the macOS Keychain (service `gemini`) or
//!   `antigravity-acp/acp_token.json`, plus the method in `settings.json`.
//!   The blob carries no identity and is never read — the login is listed
//!   from the method and the token's PRESENCE only, active and unswitchable.
//!
//! Claude-swap mechanics:
//!
//! 1. **Detect** the live login of each CLI and auto-snapshot it into a slot
//!    under `{data_dir}/agent-accounts/{harness}/{slotId}.json` — the current
//!    session is always backed up before any swap, and refreshed tokens stay
//!    current.
//! 2. **Swap** (`activate`): overwrite the CLI's credential store (and, for
//!    Claude, merge the identity back into `~/.claude.json`) with a saved slot.
//!    Claude's credential blob is overloaded: `claudeAiOauth` is per-account,
//!    but sibling keys such as `mcpOAuth` are machine-shared MCP/plugin tokens.
//!    Activate splices those live shared fields onto the target login so a
//!    switch does not force every MCP server to re-auth.
//! 3. **Add** (`start_login`…): drive an OAuth flow for a NEW account without
//!    touching the live one (unless it re-signs the live account in, or there
//!    is no live login) — the way each CLI signs in itself: the browser
//!    redirects to a loopback callback that finishes the login unattended.
//!    Claude runs the CLI's PKCE flow against our own `localhost:<port>/callback`
//!    (pasting the code is only the fallback when no port can be bound);
//!    Codex spawns `codex login` against a throwaway `CODEX_HOME` and polls
//!    until its loopback callback lands; Antigravity runs its server's
//!    `authenticate`. A login run for ANOTHER device (`requester`) publishes
//!    its callback port to [`zeron_preview::login`], so the requester can
//!    forward its own loopback to it over the P2P link.
//!
//! Usage probes: all three providers expose the rate-limit view their own CLIs render
//! (`/usage` in Claude Code, `/status` in Codex; Cursor's key has no quota view,
//! so the probe exchanges it for a dashboard session and reads the
//! `GetCurrentPeriodUsage` call the Cursor app itself makes). Usage is
//! stale-while-revalidate: every list serves each account's last good probe
//! (persisted to `agent-accounts/usage-cache.json`, so it survives restarts)
//! with its fetch time; only `force_usage` hits the network, probing all
//! accounts concurrently. The UI paints from a plain list, then forces one to
//! update in place. A failed probe keeps the last good windows, records why
//! (shown instead of "Usage unavailable"), and backs off — honouring
//! `Retry-After` — before that account is probed again. Only 401/403 counts
//! as a rejected token (and only then is a saved Claude slot refreshed).

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};
use std::time::{Duration, Instant};

use base64::Engine as _;
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::engine::general_purpose::URL_SAFE_NO_PAD as BASE64_URL;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use zeron_proto::{
    AgentAccount, AgentAccountWarning, AgentAccountsSnapshot, AgentAuthKind, AgentLoginMode,
    AgentLoginPoll, AgentLoginStart, AgentLoginStatus, AgentUsageWindow, HarnessId,
};

use crate::repos::home_dir;
use crate::{EngineError, new_id, now_ms};

mod oauth;
#[cfg(test)]
mod provider_tests;
mod stores;
mod usage;

// Claude Code's public OAuth client (the one the CLI itself uses for the manual
// "paste the code" flow — no secret involved, PKCE carries the proof).
const CLAUDE_CLIENT_ID: &str = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
const CLAUDE_REDIRECT: &str = "https://console.anthropic.com/oauth/code/callback";
const CLAUDE_SCOPES: &str = "org:create_api_key user:profile user:inference";
const CLAUDE_TOKEN_URL: &str = "https://console.anthropic.com/v1/oauth/token";
const CLAUDE_PROFILE_URL: &str = "https://api.anthropic.com/api/oauth/profile";
const CLAUDE_USAGE_URL: &str = "https://api.anthropic.com/api/oauth/usage";
// Claude Code 2.1.x's automatic (loopback) login: the claude.ai authorize
// page, the token endpoint it exchanges at, the page it sends the browser to
// once the code is redeemed, and the scopes it asks for.
const CLAUDE_LOOPBACK_AUTHORIZE_URL: &str = "https://claude.com/cai/oauth/authorize";
const CLAUDE_LOOPBACK_TOKEN_URL: &str = "https://platform.claude.com/v1/oauth/token";
const CLAUDE_LOOPBACK_SUCCESS_URL: &str =
    "https://platform.claude.com/oauth/code/success?app=claude-code";
const CLAUDE_LOOPBACK_SCOPES: &str = "org:create_api_key user:profile user:inference \
     user:sessions:claude_code user:mcp_servers user:file_upload user:plugins";
const CODEX_USAGE_URL: &str = "https://chatgpt.com/backend-api/wham/usage";
/// The Cursor dashboard's current-period usage RPC (Connect-style POST).
const CURSOR_CURRENT_PERIOD_USAGE: &str = "aiserver.v1.DashboardService/GetCurrentPeriodUsage";
const CURSOR_DEFAULT_BACKEND: &str = "https://api2.cursor.sh";

/// Claude Code stores these next to `claudeAiOauth` in the same credential
/// blob, but they are machine-shared (MCP server OAuth, plugin secrets) and
/// rotate independently of any account slot. On activate the live copies win.
const CLAUDE_SHARED_CREDENTIAL_KEYS: &[&str] = &[
    "mcpOAuth",
    "mcpOAuthClientConfig",
    "mcpXaaIdp",
    "mcpXaaIdpConfig",
    "pluginSecrets",
];

/// A forced list re-probes an account only when its last attempt is older
/// than this — the page's paint-then-refresh pair and Refresh mashing must
/// not multiply provider calls (Anthropic's usage endpoint 429s eagerly).
const FORCED_MIN_INTERVAL: Duration = Duration::from_secs(30);
/// How long a live Claude credential read is reused (see
/// [`AgentAccounts::read_claude_credentials_cached`]).
const CLAUDE_CREDENTIALS_TTL: Duration = Duration::from_secs(10);
/// An abandoned login flow (dialog dismissed without Cancel) is reaped past this.
const FLOW_TTL: Duration = Duration::from_secs(15 * 60);
const HTTP_TIMEOUT: Duration = Duration::from_secs(8);

/// A failed identity lookup is retried no sooner than this — an offline
/// device must not call the profile endpoint on every list.
const IDENTITY_RETRY: Duration = Duration::from_secs(5 * 60);

/// A remembered identity lookup (see `Inner::identities`).
#[derive(Clone)]
enum IdentityLookup {
    Known(String, SlotProfile),
    Failed(Instant),
}

/// Filesystem knobs — env-resolved in production ([`AgentAccountsConfig::detect`]),
/// explicit in tests.
#[derive(Debug, Clone)]
pub struct AgentAccountsConfig {
    /// Engine data dir; slots live under `{data_dir}/agent-accounts/`.
    pub data_dir: PathBuf,
    /// Claude config dir (`$CLAUDE_CONFIG_DIR` or `~/.claude`) — holds `.credentials.json`.
    pub claude_config_dir: PathBuf,
    /// Claude identity file (`~/.claude.json`, or `$CLAUDE_CONFIG_DIR/.claude.json`).
    pub claude_config_file: PathBuf,
    /// Codex home (`$CODEX_HOME` or `~/.codex`) — holds `auth.json`.
    pub codex_home: PathBuf,
    /// The Cursor SDK's credential store (`~/.cursor/sdk/auth.json`): the
    /// named, expiring API key minted by its browser login. SEPARATE from
    /// `cursor-agent login`'s session tokens — deliberately never read.
    pub cursor_sdk_auth_file: PathBuf,
    /// macOS Keychain service holding Claude Code's credentials, or `None`
    /// to use `.credentials.json` only (tests — a temp config must never
    /// read or write the real login). See [`claude_keychain_service`].
    pub claude_keychain_service: Option<String>,
    /// Antigravity's `GEMINI_HOME` (`None`: unresolvable — no Antigravity row).
    pub antigravity_home: Option<PathBuf>,
    /// Whether Antigravity's Keychain token counts (macOS production); tests
    /// look at the temp token files only.
    pub antigravity_keychain: bool,
    /// Grok's `GROK_HOME` (default `
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #953** (2026-10-19): **ACP: order advertised effort levels from lowest to highest**
  *Symptoms*: ## Summary  - On Grok 4.7 the composer's effort slider runs backwards: the left end is Extra High and the right end is Low, so the fill grows as effort drops. - Cause: Grok Build advertises its `thought_level` options from highest to lowest. `models_from_session` kept the wire order, and only Grok 4.5 has a built-in catalog row, so Grok 4.7, Grok 4.7 Fast and Grok 4.6 showed Grok's order directly. - Fix: sort and deduplicate the advertised ladder in `ReasoningLevel` order. The change is in the shared ACP parser, so any ACP agent that advertises a descending ladder now shows it ascending. Ladders that are already ascending are unchanged. - The default effort is unchanged. Zeron still picks High when a model offers it, which is also the level Grok marks as recommended.  Effort lists reported by Grok Build 1.0.62 (`session/new`, then `session/set_config_option` for each model):  | Model | Advertised order | Shown after this change | | --- | --- | --- | | `grok-4.7` | xhigh, high, medium, low | Low → Extra High | | `grok-4.7-build-fast` | xhigh, high, medium, low | Low → Extra High | | `grok-4.6` | xhigh, high, medium, low | Low → Extra High | | `grok-4.5` | high, medium, low | Low → High (catalog row, unchanged) |  ## Test plan  - [x] Added `grok_thought_levels_order_from_lowest_to_highest`, which uses the exact `configOptions` payload Grok Build 1.0.62 returns. It fails on `main` with `[XHigh, High, Medium, Low]` and passes with this change. - [x] `cargo test --locked -p zeron-

- **Issue #942** (2026-10-18): **iOS: adapt to iPhone Duo (fold/unfold, uneven safe areas)**
  *Symptoms*: ## What  Makes the iOS app adapt to iPhone Duo: the phone layout when it's folded, the sidebar layout when it's open, switching live as you fold and unfold.  **The shell follows the window, not the device.** The split shell (sidebar + session column) used to be chosen once at launch with `userInterfaceIdiom == .pad`. On iPhone Duo the idiom is always `.phone`, so the open inner display (regular × regular, like an iPad) got a stretched phone UI. The split shell is now the root everywhere: - Regular width **and** height (iPad, Duo open or half-open): sidebar beside the session. - Anything else (iPhone, Duo folded, Slide Over, narrow Split View): it collapses to the existing tab shell. - Folding and unfolding reuse the existing collapse/expand handoff, so the open session moves between the tab stack and the main column instead of being lost. - Phones in landscape keep the tab shell. Pro Max models are regular-width there; the split pins its horizontal class to compact while height is compact, so nothing changes on today's iPhones. - The main column's new-session page is built only once the sidebar is actually on screen, so a phone that never expands doesn't build it.  **Sidebar width on the open Duo.** The inner display is 669pt wide in portrait. Below 700pt the sidebar's minimum drops to 280pt so the session column keeps about 390pt, a phone's width. iPads are unchanged (the iPad mini still gets 320pt in portrait).  **Composer level with the sidebar toolbar.** Beside the sideba

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

### Incident Patch 1: `911ec56e` (2026-10-19)
**Commit Message**: ACP: order advertised effort levels from lowest to highest (#953)

Grok Build lists its thought_level options from highest to lowest
(xhigh, high, medium, low for Grok 4.7, 4.7 Fast and 4.6; high, medium,
low for Grok 4.5). Models without a built-in catalog row used that
order directly, so the composer's effort slider ran from Extra High on
the left to Low on the right.

Sort and deduplicate the wire ladder in models_from_session so every
ACP model presents its levels in ReasoningLevel order.

**File**: `crates/harness/src/acp/mod.rs` (modified, +65/-1)
```diff
@@ -1923,7 +1923,7 @@ fn models_from_session(session_response: &Value, catalog: &[Model]) -> Vec<Model
         .map(|a| a.as_slice())
         .unwrap_or_default();
 
-    let ladder: Vec<ReasoningLevel> = config_options
+    let mut ladder: Vec<ReasoningLevel> = config_options
         .iter()
         .find(|o| o.get("category").and_then(Value::as_str) == Some("thought_level"))
         .and_then(|o| o.get("options").and_then(Value::as_array))
@@ -1934,6 +1934,8 @@ fn models_from_session(session_response: &Value, catalog: &[Model]) -> Vec<Model
                 .collect()
         })
         .unwrap_or_default();
+    ladder.sort_unstable();
+    ladder.dedup();
     let wire_options: Vec<ModelOption> = config_options
         .iter()
         .filter_map(trait_from_config_option)
@@ -5842,6 +5844,68 @@ mod tests {
         assert_eq!(models[0].options[0].default_choice, "off");
     }
 
+    #[test]
+    fn grok_thought_levels_order_from_lowest_to_highest() {
+        let response = json!({
+            "sessionId": "s-1",
+            "configOptions": [
+                {
+                    "id": "model",
+                    "name": "Model",
+                    "category": "model",
+                    "type": "select",
+                    "currentValue": "grok-4.7",
+                    "options": [
+                        { "value": "grok-4.7", "name": "Grok 4.7" },
+                        { "value": "grok-4.7-build-fast", "name": "Grok 4.7 Fast" },
+                        { "value": "grok-4.6", "name": "Grok 4.6" },
+                        { "value": "grok-4.5", "name": "Grok 4.5" },
+                    ],
+                },
+                {
+                    "id": "reasoning_effort",
+                    "name": "Reasoning Effort",
+                    "category": "thought_level",
+                    "type": "select",
+                    "currentValue": "xhigh",
+                    "options": [
+                        { "value": "xhigh", "name": "Extra High" },
+                        { "value": "high", "name": "High" },
+                        { "value": "medium", "name": "Medium" },
+                        { "value": "low", "name": "Low" },
+                    ],
+                },
+            ],
+        });
+        let models = models_from_session(&response, &(grok_spec().models)());
+        let ladders = models
+            .iter()
+            .map(|m| (m.id.as_str(), m.reasoning_levels.clone()))
+            .collect::<Vec<_>>();
+        let ascending = vec![
+            ReasoningLevel::Low,
+            ReasoningLevel::Medium,
+            ReasoningLevel::High,
+            ReasoningLevel::XHigh,
+        ];
+        assert_eq!(
+            ladders,
+            vec![
+                ("grok-4.7", ascending.clone()),
+                ("grok-4.7-build-fast", ascending.clone()),
+                ("grok-4.6", ascending),
+                (
+                    "grok-4.5",
+                    vec![
+                        ReasoningLevel::Low,
+                        ReasoningLevel::Medium,
+                        ReasoningLevel::High,
+                    ],
+                ),
+            ]
+        );
+    }
+
     #[test]
     fn model_1m_variants_collapse_into_a_context_window_trait() {
         let response = json!({
```

#### Recent Merged Pull Requests:
- **PR #953** (2026-10-19): ACP: order advertised effort levels from lowest to highest (@woosal1337)
- **PR #942** (2026-10-18): iOS: adapt to iPhone Duo (fold/unfold, uneven safe areas) (@wingleeio)
- **PR #920** (2026-10-15): fix: send cursor model defaults for plus subscriptions (@laurentcodes)
- **PR #912** (2026-10-18): Render LaTeX math in messages with zatex (@SinaKhalili)
- **PR #909** (2026-10-17): Reorder sidebar sections by dragging their header (@jsgrrchg)
- **PR #903** (2026-10-17): Sidebar: show a session hover card beside each chat row (@jsgrrchg)

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

## X. ACP: order advertised effort levels from lowest to highest (#953)

**RULE**:
When implementing operations in `crates/harness/src/acp/mod.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in zeronsh/zeron. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `911ec56e`: ACP: order advertised effort levels from lowest to highest (#953). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/harness/src/acp/mod.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    let mut ladder: Vec<ReasoningLevel> = config_options
    ladder.sort_unstable();
    ladder.dedup();
    #[test]
    fn grok_thought_levels_order_from_lowest_to_highest() {
        let response = json!({
            "sessionId": "s-1",
            "configOptions": [
                {
                    "id": "model",
                    "name": "Model",
                    "category": "model",
                    "type": "select",
                    "currentValue": "grok-4.7",
                    "options": [
                        { "value": "grok-4.7", "name": "Grok 4.7" },
                        { "value": "grok-4.7-build-fast", "name": "Grok 4.7 Fast" },
                        { "value": "grok-4.6", "name": "Grok 4.6" },
                        { "value": "grok-4.5", "name": "Grok 4.5" },
                    ],
                },
                {
                    "id": "reasoning_effort",
                    "name": "Reasoning Effort",
                    "category": "thought_level",
                    "type": "select",
                    "currentValue": "xhigh",
                    "options": [
                        { "value": "xhigh", "name": "Extra High" },

```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
    let ladder: Vec<ReasoningLevel> = config_options
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `911ec56e` are properly handled with clean fallback behavior.
