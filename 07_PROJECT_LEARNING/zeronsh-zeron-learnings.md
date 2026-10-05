# Forensic Learning Record (Deep Inspection): zeronsh/zeron

> **Canonical Artifact**: `07_PROJECT_LEARNING/zeronsh-zeron-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/zeronsh/zeron](https://github.com/zeronsh/zeron))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:03:49.703Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zeronsh/zeron`
- **Description**: A native control plane for Claude Code, Codex, Cursor, Devin and other coding agents.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3036 stars

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
    private var hostDevice = ""

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
        handle.setViewAttached(attached: true)
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
                    done(models.map { m in
                        UIAction(title: m.label, subtitle: m.description, state: m.id == row.model ? .on : .off) { [weak self] _ in
                            self?.setConfig { $0.model = m.id }
                        }
                    })
                }
            }])
        case "effort":
            return UIMenu(title: "Reasoning effort", children: [UIDeferredMenuElement { [weak self] done in
                guard let self else { return done([]) }
                Task { @MainActor in
                    let models = (try? await self.client.listModels(deviceId: self.hos
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

### Core Architecture Module: `crates/engine/src/agent_accounts/oauth.rs`
```
//! Sign-ins the engine drives itself for agents that keep one login per
//! model provider (OpenCode, Pi) — the same flows those agents run in their
//! own `/login`, with the result written in their own entry format.
//!
//! - **ChatGPT** (OpenCode `openai`, Pi `openai-codex`): OpenAI's PKCE
//!   authorization-code flow with the Codex CLI's public client, redirecting
//!   to `http://localhost:1455/auth/callback` — the port is FIXED by the
//!   client registration, so this flow, `codex login` and the agents' own
//!   logins can't overlap (a new one supersedes any of ours holding it).
//!   Each login is a fresh grant: a refresh token is never shared with the
//!   Codex slots (OpenAI rotates them, so sharing one logs the other out).
//!   The callback port is reported, so a remote login tunnels it.
//! - **GitHub Copilot** (OpenCode `github-copilot`): GitHub's device flow
//!   with OpenCode's OAuth app (scope `read:user`) — the dialog shows the
//!   code; no loopback, so a remote login needs no tunnel. OpenCode stores
//!   the GitHub token as both `access` and `refresh` with `expires: 0`.
//!   Pi's Copilot login exchanges the token for an internal Copilot session
//!   and is left to pi's own `/login`.

use super::stores::{Upstream, openai_detected, upstream_of};
use super::*;

/// OpenAI's OAuth issuer (`/oauth/authorize`, `/oauth/token`).
pub(super) const OPENAI_AUTH: &str = "https://auth.openai.com";
/// The Codex CLI's public client — the one OpenCode and Pi sign in with.
const OPENAI_CLIENT_ID: &str = "app_EMoamEEZ73f0CkXaXp7hrann";
/// Fixed by the client's registered redirect.
pub(super) const OPENAI_LOOPBACK_PORT: u16 = 1455;
const OPENAI_SCOPES: &str = "openid profile email offline_access";
/// OpenCode's GitHub OAuth app (its Copilot device flow).
const OPENCODE_COPILOT_CLIENT_ID: &str = "Ov23li8tweQw6odWQebz";
/// How long a sign-in waits on the browser before giving up.
const LOGIN_WAIT: Duration = Duration::from_secs(10 * 60);

impl AgentAccounts {
    /// ChatGPT for OpenCode / Pi: PKCE against our own loopback on 1455.
    pub(super) async fn start_openai_login(
        &self,
        harness: HarnessId,
        store_key: &'static str,
    ) -> Result<AgentLoginStart, EngineError> {
        debug_assert_eq!(upstream_of(harness, store_key), Some(Upstream::OpenAi));
        self.reap_spawned_flows(harness);
        let wanted = self.inner.endpoints.openai_port;
        self.reap_port_flows(OPENAI_LOOPBACK_PORT);
        let listener = bind_loopback(wanted).await.map_err(|err| {
            EngineError::Other(if err.kind() == std::io::ErrorKind::AddrInUse {
                format!(
                    "Port {wanted} is in use — another ChatGPT sign-in (codex login, OpenCode or \
                     Pi) is running. Finish or cancel it, then try again."
                )
            } else {
                format!("Could not open the sign-in callback: {err}")
            })
        })?;
        let port = listener
            .local_addr()
            .map_err(|e| EngineError::Other(format!("sign-in callback has no port: {e}")))?
            .port();
        let login_id = new_id();
        let (verifier, challenge) = pkce_pair();
        let state = random_url_token();
        let redirect = format!("http://localhost:{port}/auth/callback");
        let originator = match harness {
            HarnessId::Pi => "pi",
            _ => "opencode",
        };
        let url = format!(
            "{}/oauth/authorize?response_type=code&client_id={OPENAI_CLIENT_ID}\
             &redirect_uri={}&scope={}&code_challenge={challenge}\
             &code_challenge_method=S256&id_token_add_organizations=true\
             &codex_cli_simplified_flow=true&state={state}&originator={originator}",
            self.inner.endpoints.openai_auth.trim_end_matches('/'),
            urlencode(&redirect),
            urlencode(OPENAI_SCOPES),
        );
        let task_state = Arc::new(Mutex::new(TaskLoginState {
            url: Some(url.clone()),
            ..Default::default()
        }));
        let this = self.clone();
        let outcome_state = task_state.clone();
        let handle = tokio::spawn(async move {
            let outcome = tokio::time::timeout(
                LOGIN_WAIT,
                this.finish_openai_login(
                    listener, harness, store_key, &state, &verifier, &redirect,
                ),
            )
            .await
            .unwrap_or_else(|_| Err(EngineError::Other("The sign-in timed out.".into())));
            lock(&outcome_state).outcome = Some(outcome.map_err(|e| e.to_string()));
        });
        lock(&self.inner.flows).insert(
            login_id.clone(),
            LoginFlow::Task {
                harness,
                started_at: Instant::now(),
                state: task_state,
                handle,
                home: None,
                port: Some(OPENAI_LOOPBACK_PORT),
            },
        );
        Ok(AgentLoginStart {
            login_id,
            url,
            mode: AgentLoginMode::Browser,
            callback_port: Some(port),
        })
    }

    async fn finish_openai_login(
        &self,
        listener: tokio::net::TcpListener,
        harness: HarnessId,
        store_key: &str,
        state: &str,
        verifier: &str,
        redirect: &str,
    ) -> Result<(), EngineError> {
        use tokio::io::AsyncWriteExt as _;
        let (callback, mut browser) =
            await_loopback_callback(&listener, "/auth/callback", state, "ChatGPT").await;
        drop(listener);
        let result = match callback {
            Ok(code) => {
                self.redeem_openai_code(harness, store_key, &code, verifier, redirect)
                    .await
            }
            Err(message) => Err(EngineError::Other(message)),
        };
        let (status, body) = match &result {
            Ok(()) => (
                "200 OK",
                "<!doctype html><title>Signed in</title><p>Signed in to ChatGPT.</p>\
                 <p>You can close this tab and return to Zeron.</p>"
                    .to_string(),
            ),
            Err(error) => (
                "400 Bad Request",
                format!(
                    "<!doctype html><title>Sign-in failed</title><p>{}</p>\
                     <p>Return to Zeron to try again.</p>",
                    html_escape(&error.to_string())
                ),
            ),
        };
        let response = http_response(
            status,
            &[("Content-Type", "text/html; charset=utf-8")],
            &body,
        );
        let _ = browser.write_all(response.as_bytes()).await;
        let _ = browser.shutdown().await;
        result
    }

    /// Redeem the code and save the login in the agent's entry format.
    async fn redeem_openai_code(
        &self,
        harness: HarnessId,
        store_key: &str,
        code: &str,
        verifier: &str,
        redirect: &str,
    ) -> Result<(), EngineError> {
        let response = self
            .inner
            .http
            .post(format!(
                "{}/oauth/token",
                self.inner.endpoints.openai_auth.trim_end_matches('/')
            ))
            .form(&[
                ("grant_type", "authorization_code"),
                ("code", code),
                ("redirect_uri", redirect),
                ("client_id", OPENAI_CLIENT_ID),
                ("code_verifier", verifier),
            ])
            .timeout(Duration::from_secs(15))
            .send()
            .await
            .map_err(|e| EngineError::Other(format!("token exchange failed: {e}")))?;
        if !response.status().is_success() {
            let status = response.status();
            // Never echo the body: it can carry token material on odd errors.
            return Err(EngineError::Other(format!(
                "OpenAI rejected the sign-in ({status}) — try again."
            )));
        }
        let tokens: serde_json::Value = response
            .json()
            .await
            .map_err(|e| EngineError::Other(format!("token exchange returned junk: {e}")))?;
        let (Some(access), Some(refresh)) = (
            str_field(&tokens, "access_token"),
            str_field(&tokens, "refresh_token"),
        ) else {
            return Err(EngineError::Other(
                "OpenAI returned no usable tokens — try signing in again.".into(),
            ));
        };
        let id_token = str_field(&tokens, "id_token");
        let expires_in = tokens
            .get("expires_in")
            .and_then(|v| v.as_i64())
            .unwrap_or(3600);
        let mut entry = serde_json::json!({
            "type": "oauth",
            "access": access,
            "refresh": refresh,
            "expires": now_ms() + expires_in * 1000,
        });
        let account_id = [id_token.as_deref(), Some(access.as_str())]
            .into_iter()
            .flatten()
            .filter_map(jwt_claims)
            .find_map(|claims| {
                claims
                    .get("https://api.openai.com/auth")
                    .and_then(|auth| str_field(auth, "chatgpt_account_id"))
            });
        if let (Some(account_id), Some(map)) = (account_id, entry.as_object_mut()) {
            map.insert("accountId".into(), serde_json::json!(account_id));
        }
        let detected =
            openai_detected(store_key, &entry, id_token.as_deref()).ok_or_else(|| {
                EngineError::Other("Could not identify the signed-in ChatGPT account.".into())
            })?;
        self.save_new_login(harness, &detected).await
    }

    /// GitHub Copilot for OpenCode: GitHub's device flow. The start asks
    /// GitHub for the code (the dialog shows it), then a task polls until
    /// the user approves.
    pub(super) async fn start_copilot_login(
        &self,
        harness: HarnessId,
    ) -> Result<AgentLoginStart, EngineError> {
        self.reap_spawned_
```

### Core Architecture Module: `crates/engine/src/agent_accounts/stores.rs`
```
//! Credential stores of the agents beyond Claude Code / Codex / Cursor /
//! Antigravity: where each CLI keeps its login, how zeron reads (and, where
//! it's safe, swaps) it, and the sign-ins that run through the CLI itself.
//!
//! - **Grok** — `$GROK_HOME/auth.json` (default `~/.grok`, 0600, guarded by
//!   an `auth.json.lock` flock): a map of `"{issuer}::{client_id}"` → OIDC
//!   token set (`key` = access token, `refresh_token`, `expires_at`, and
//!   identity: `user_id`, `email`, names, `subscription_tier`). One live
//!   login; the CLI re-reads the file on every call, so a swap is live at
//!   once. Swap = rewrite the file (under grok's lock). Add account = `grok
//!   login --device-auth` against a throwaway `GROK_HOME`: a device code
//!   needs no loopback, so a remote login works without a tunnel.
//! - **Devin** — `$XDG_DATA_HOME/devin/credentials.toml` (default
//!   `~/.local/share/devin/`; older CLIs used `~/Library/Application
//!   Support/devin/`, `%APPDATA%\devin`): a long-lived `windsurf_api_key`
//!   plus server urls, no identity and no refresh token. Swap = rewrite the
//!   file (running `devin acp` processes keep the key they started with).
//!   Add account = the ACP `authenticate` `devin-browser` method with a
//!   throwaway `XDG_DATA_HOME`: Devin's own PKCE loopback, whose
//!   `redirect_uri` port is reported for remote tunnelling. The identity is
//!   learned from the usage probe and written back into the slot.
//! - **OpenCode** — `$XDG_DATA_HOME/opencode/auth.json` (default
//!   `~/.local/share/opencode/`): one entry PER model provider (`{type:
//!   "oauth", access, refresh, expires, accountId?}` or `{type: "api",
//!   key}`), re-read on every request. zeron manages the OAuth entries of
//!   `openai` (ChatGPT) and `github-copilot`; a swap rewrites that one entry
//!   and leaves every other provider byte-for-byte. OpenCode has no lock of
//!   its own. API-key entries aren't accounts and are left alone.
//!   Anthropic OAuth was removed from OpenCode upstream and is not offered.
//! - **Pi** — `$PI_CODING_AGENT_DIR/auth.json` (default `~/.pi/agent`,
//!   0600, guarded by proper-lockfile's `auth.json.lock` DIRECTORY): the
//!   same per-provider shape (`openai-codex`, `anthropic`, `github-copilot`),
//!   hot-reloaded by running agents. Swap = rewrite one entry under that
//!   lock. Add account = ChatGPT only (zeron's own loopback, see
//!   [`super::oauth`]); Claude and Copilot logins stay with pi's `/login` —
//!   minting Claude Code OAuth for a third-party agent is not something
//!   zeron should do, and pi's Copilot login is an internal token exchange.
//! - **Hermes** — `$HERMES_HOME/auth.json` (default `~/.hermes`): Hermes
//!   keeps EVERY account itself, in `credential_pool[provider]`, and picks
//!   (fill-first by `priority`, or round-robin) and refreshes them on its
//!   own. A running Hermes writes its in-memory pool back over the file, so
//!   a zeron reorder would be silently undone — zeron lists the pool (the
//!   active provider's first entry is "in use"), probes usage, and adds
//!   accounts through `hermes auth add` (device code; Hermes appends to its
//!   own pool under its own lock). It never rewrites the pool.
//!
//! Opaque tokens (Pi's Claude login, Copilot tokens) carry no identity: a
//! live entry is matched to its slot by token, else identified ONCE per token
//! with a read-only profile call (`/api/oauth/profile`, GitHub `/user`). A
//! Copilot login on a self-hosted GitHub Enterprise Server (a host zeron
//! never sends the token to) gets a local identity instead — its host and a
//! SHA-256 fingerprint of the token — so it still switches; its usage is
//! skipped.

use std::collections::HashSet;

use super::*;

// ── paths ───────────────────────────────────────────────────────────────────

fn env_dir(name: &str) -> Option<PathBuf> {
    std::env::var_os(name)
        .filter(|s| !s.is_empty())
        .map(PathBuf::from)
}

fn xdg_data_home() -> PathBuf {
    env_dir("XDG_DATA_HOME").unwrap_or_else(|| home_dir().join(".local").join("share"))
}

pub(super) fn default_grok_home() -> PathBuf {
    env_dir("GROK_HOME").unwrap_or_else(|| home_dir().join(".grok"))
}

/// Devin 3000.x reads `$XDG_DATA_HOME/devin/credentials.toml`; older builds
/// kept it under the platform config dir. The first existing one wins, else
/// the current location (where a new login lands).
pub(super) fn default_devin_credentials_file() -> PathBuf {
    let primary = xdg_data_home().join("devin").join("credentials.toml");
    if primary.exists() {
        return primary;
    }
    let mut fallbacks = Vec::new();
    if cfg!(target_os = "macos") {
        fallbacks.push(
            home_dir()
                .join("Library")
                .join("Application Support")
                .join("devin")
                .join("credentials.toml"),
        );
    }
    if cfg!(windows) {
        fallbacks.push(
            env_dir("APPDATA")
                .unwrap_or_else(|| home_dir().join("AppData").join("Roaming"))
                .join("devin")
                .join("credentials.toml"),
        );
    }
    fallbacks
        .into_iter()
        .find(|file| file.exists())
        .unwrap_or(primary)
}

pub(super) fn default_opencode_auth_file() -> PathBuf {
    xdg_data_home().join("opencode").join("auth.json")
}

pub(super) fn default_pi_agent_dir() -> PathBuf {
    env_dir("PI_CODING_AGENT_DIR").unwrap_or_else(|| home_dir().join(".pi").join("agent"))
}

pub(super) fn default_hermes_home() -> PathBuf {
    if let Some(home) = env_dir("HERMES_HOME") {
        return home;
    }
    if cfg!(windows)
        && let Some(local) = env_dir("LOCALAPPDATA")
        && local.join("hermes").join("auth.json").exists()
    {
        return local.join("hermes");
    }
    home_dir().join(".hermes")
}

// ── naming ──────────────────────────────────────────────────────────────────

/// The CLI a user would run for `harness` (named in reasons and errors).
pub(super) fn cli_name(harness: HarnessId) -> &'static str {
    match harness {
        HarnessId::ClaudeCode => "claude",
        HarnessId::Codex => "codex",
        HarnessId::Cursor => "Cursor",
        HarnessId::Grok => "grok",
        HarnessId::Devin => "devin",
        HarnessId::Opencode => "opencode",
        HarnessId::Pi => "pi",
        HarnessId::Hermes => "hermes",
        HarnessId::Antigravity => "Antigravity",
        HarnessId::Mock => "mock",
    }
}

/// The vendor behind a per-provider store key, for usage reasons.
pub(super) fn upstream_vendor(store_key: &str) -> &'static str {
    match store_key {
        "openai" | "openai-codex" => "OpenAI",
        "anthropic" => "Anthropic",
        "github-copilot" | "copilot" => "GitHub",
        "nous" => "Nous",
        "xai-oauth" | "xai" => "xAI",
        _ => "the provider",
    }
}

/// The logins `hermes auth add` can run unattended (device codes).
pub(super) const HERMES_LOGINS: &[&str] = &["openai-codex", "nous"];

pub(super) fn unsupported_login(harness: HarnessId, provider: &str) -> EngineError {
    let reason = match (harness, provider) {
        (HarnessId::Pi, "anthropic") => {
            "Claude logins for Pi stay with pi's own /login — zeron only mints Claude Code \
             logins for Claude Code."
                .to_string()
        }
        _ => format!(
            "zeron can't add a {provider} login for {} — sign in with `{}` itself.",
            cli_name(harness),
            cli_name(harness)
        ),
    };
    EngineError::Other(reason)
}

/// OpenCode ignores `auth.json` while `OPENCODE_AUTH_CONTENT` is set.
pub(super) fn opencode_env_warning() -> Option<String> {
    std::env::var_os("OPENCODE_AUTH_CONTENT")
        .filter(|v| !v.is_empty())
        .map(|_| {
            "OPENCODE_AUTH_CONTENT is set, so OpenCode reads its logins from that variable — \
             switching accounts here won't change what it uses."
                .to_string()
        })
}

fn key_tail(secret: &str) -> String {
    let chars: Vec<char> = secret.chars().collect();
    chars[chars.len().saturating_sub(4)..].iter().collect()
}

fn hashed_key(secret: &str) -> String {
    let digest = Sha256::digest(secret.as_bytes());
    crate::repos::hex(&digest)[..12].to_string()
}

/// "SUBSCRIPTION_TIER_SUPER_GROK" / "super_grok" → "Super Grok".
fn title_words(raw: &str) -> Option<String> {
    let words: Vec<String> = raw
        .split(['_', '-', ' '])
        .filter(|w| !w.is_empty())
        .map(|w| {
            let mut chars = w.chars();
            match chars.next() {
                Some(first) => format!("{}{}", first.to_uppercase(), chars.as_str().to_lowercase()),
                None => String::new(),
            }
        })
        .collect();
    (!words.is_empty()).then(|| words.join(" "))
}

// ── Grok ────────────────────────────────────────────────────────────────────

/// `subscription_tier` → a plan chip ("SuperGrok Heavy"); `None` when absent.
pub(super) fn grok_plan(tier: Option<&str>) -> Option<String> {
    let tier = tier?;
    let stem = tier
        .strip_prefix("SUBSCRIPTION_TIER_")
        .or_else(|| tier.strip_prefix("TIER_"))
        .unwrap_or(tier);
    if matches!(
        stem.to_ascii_lowercase().as_str(),
        "" | "none" | "free" | "unspecified"
    ) {
        return None;
    }
    let label = title_words(stem)?;
    Some(label.replace("Super Grok", "SuperGrok"))
}

fn grok_identity(entry: &serde_json::Value) -> Option<String> {
    str_field(entry, "user_id")
        .or_else(|| str_field(entry, "principal_id"))
        .or_else(|| str_field(entry, "email"))
}

/// Grok's `auth.json` → the live login. The file can hold several issuers
/// (a legacy web login, an enterprise OIDC): prefer `auth.x.ai`, then an
/// entry that names its user. An identity-less entry is keyed by its stable
/// `issuer::client` map key — never the rotating access token.
pub(super) fn parse_grok_auth(auth: serde_json::Valu
```

### Core Architecture Module: `crates/engine/src/agent_accounts/usage.rs`
```
//! Usage probes for Grok, Devin, OpenCode, Pi and Hermes — each the view the
//! agent's own CLI renders, with the same stale-while-revalidate cache,
//! [`ProbeError`] classification and backoff as the original providers.
//!
//! - **Grok**: `GET cli-chat-proxy.grok.com/v1/billing?format=credits`
//!   (`/usage` in the CLI) — the Grok Build share of the current period.
//!   Only a 401/403 refreshes, and only a SAVED slot (OIDC `refresh_token`
//!   grant against the entry's own issuer, single-flight); the live token is
//!   the CLI's to rotate.
//! - **Devin**: Connect-JSON `SeatManagementService/GetUserStatus` (what
//!   `devin auth status` calls) — daily/weekly quota, plus the identity the
//!   key file lacks, written back into the slot. Keys don't refresh.
//! - **ChatGPT logins** (OpenCode `openai`, Pi `openai-codex`, Hermes
//!   `openai-codex`): the Codex usage endpoint — the same token kind.
//! - **Claude logins** (Pi `anthropic`): Claude's `/api/oauth/usage`.
//! - **Copilot** (OpenCode / Pi `github-copilot`):
//!   `api.github.com/copilot_internal/user` — premium-request quota.
//! - **Nous** (Hermes `nous`): the portal's `/api/oauth/account` credits.
//!
//! None of these refresh a per-provider store's tokens: those rotate, and
//! the agent (or Hermes' pool) owns them — a rejected token reads "switch to
//! it to refresh" / "refreshes next time" instead.

use super::stores::{
    DEVIN_SERVERS, GROK_ISSUERS, NOUS_PORTALS, Upstream, copilot_api_base, devin_api_key,
    trusted_base, upstream_of,
};
use super::*;

pub(super) const GROK_USAGE_URL: &str = "https://cli-chat-proxy.grok.com/v1/billing?format=credits";
pub(super) const NOUS_PORTAL: &str = "https://portal.nousresearch.com";
const DEVIN_STATUS_RPC: &str = "exa.seat_management_pb.SeatManagementService/GetUserStatus";
const DEVIN_DEFAULT_API_SERVER: &str = "https://server.codeium.com";
/// The CLI version the status call identifies as (the server wants one).
const DEVIN_CLI_VERSION: &str = "3000.11.3";

impl AgentAccounts {
    pub(super) async fn grok_usage(
        &self,
        slot: &Slot,
        is_active: bool,
    ) -> Result<UsageSnapshot, ProbeError> {
        let missing = ProbeError::NoCredentials {
            why: NoCredentials::Missing,
        };
        // A Grok slot is one issuer's token set.
        let access_token = str_field(&slot.credentials, "key").ok_or(missing)?;
        match self.grok_usage_request(&access_token).await {
            // Same rule as Claude: rotate slot-owned tokens only after the
            // endpoint REJECTED them; the live pair is the CLI's.
            Err(ProbeError::Unauthorized { status })
                if !is_active && self.inner.endpoints.allow_slot_refresh =>
            {
                match self.refresh_grok_slot(slot).await? {
                    Some(fresh) => self.grok_usage_request(&fresh).await,
                    None => Err(ProbeError::Unauthorized { status }),
                }
            }
            result => result,
        }
    }

    async fn grok_usage_request(&self, access_token: &str) -> Result<UsageSnapshot, ProbeError> {
        let body = probe_json(
            "grok",
            "usage",
            self.inner
                .http
                .get(&self.inner.endpoints.grok_usage)
                .bearer_auth(access_token)
                .header("X-XAI-Token-Auth", "xai-grok-cli"),
        )
        .await?;
        grok_usage_snapshot(&body).ok_or_else(|| schema_error("grok", &body))
    }

    /// Single-flight per slot, like Claude's: a second concurrent refresh of
    /// a single-use refresh token would revoke it. `Ok(None)` = in flight.
    async fn refresh_grok_slot(&self, slot: &Slot) -> Result<Option<String>, ProbeError> {
        if !lock(&self.inner.inflight_refreshes).insert(slot.id.clone()) {
            return Ok(None);
        }
        let _release = InflightGuard {
            set: &self.inner.inflight_refreshes,
            keys: vec![slot.id.clone()],
        };
        let missing = ProbeError::NoCredentials {
            why: NoCredentials::Missing,
        };
        let entry = &slot.credentials;
        let refresh_token = str_field(entry, "refresh_token").ok_or(missing.clone())?;
        let client_id = str_field(entry, "oidc_client_id").ok_or(missing)?;
        // The issuer comes from the credential file: the refresh token only
        // goes to an xAI host.
        let issuer = trusted_base(
            &str_field(entry, "oidc_issuer").unwrap_or_else(|| "https://auth.x.ai".to_string()),
            GROK_ISSUERS,
            self.inner.endpoints.allow_loopback_http,
        )
        .ok_or(ProbeError::UntrustedEndpoint)?;
        let body = probe_json(
            "grok",
            "refresh",
            self.inner
                .http
                .post(format!(
                    "{}/oauth2/token",
                    issuer.as_str().trim_end_matches('/')
                ))
                .form(&[
                    ("grant_type", "refresh_token"),
                    ("refresh_token", refresh_token.as_str()),
                    ("client_id", client_id.as_str()),
                ]),
        )
        .await
        .map_err(|error| match error {
            // invalid_grant: the saved login is dead — "sign in again".
            ProbeError::Http { status: 400, .. } => ProbeError::Unauthorized { status: 400 },
            other => other,
        })?;
        let access_token =
            str_field(&body, "access_token").ok_or_else(|| schema_error("grok", &body))?;
        let expires_in = body
            .get("expires_in")
            .and_then(|v| v.as_i64())
            .unwrap_or(3600);
        let mut credentials = slot.credentials.clone();
        if let Some(entry) = credentials.as_object_mut() {
            entry.insert("key".into(), serde_json::json!(access_token));
            if let Some(rotated) = str_field(&body, "refresh_token") {
                entry.insert("refresh_token".into(), serde_json::json!(rotated));
            }
            entry.insert(
                "expires_at".into(),
                serde_json::json!(
                    (Utc::now() + chrono::TimeDelta::seconds(expires_in)).to_rfc3339()
                ),
            );
        }
        let mut refreshed = slot.clone();
        refreshed.credentials = credentials;
        refreshed.saved_at = now_ms();
        if let Err(err) = self.write_slot(&refreshed) {
            tracing::warn!(slot = %slot.id, error = %err, "refreshed grok slot write failed");
        }
        Ok(Some(access_token))
    }

    /// Devin's quota view, which also names the account behind the key.
    pub(super) async fn devin_usage(&self, slot: &Slot) -> Result<UsageSnapshot, ProbeError> {
        let api_key = devin_api_key(&slot.credentials).ok_or(ProbeError::NoCredentials {
            why: NoCredentials::Missing,
        })?;
        // The server comes from the credential file: the key only goes to a
        // Devin / Windsurf host.
        let server = trusted_base(
            &str_field(&slot.credentials, "api_server_url")
                .unwrap_or_else(|| DEVIN_DEFAULT_API_SERVER.to_string()),
            DEVIN_SERVERS,
            self.inner.endpoints.allow_loopback_http,
        )
        .ok_or(ProbeError::UntrustedEndpoint)?;
        let server = server.as_str();
        let body = probe_json(
            "devin",
            "usage",
            self.inner
                .http
                .post(format!(
                    "{}/{DEVIN_STATUS_RPC}",
                    server.trim_end_matches('/')
                ))
                .header("Connect-Protocol-Version", "1")
                .json(&serde_json::json!({
                    "metadata": {
                        "apiKey": api_key,
                        "ideName": "devin-cli",
                        "ideVersion": DEVIN_CLI_VERSION,
                        "extensionName": "devin-cli",
                        "extensionVersion": DEVIN_CLI_VERSION,
                        "locale": "en_US",
                        "os": std::env::consts::OS,
                        "sessionId": "zeron-accounts",
                        "requestId": "1",
                    }
                })),
        )
        .await?;
        let (snapshot, identity) =
            devin_usage_snapshot(&body).ok_or_else(|| schema_error("devin", &body))?;
        // Adopt the probed identity (best-effort; a failed write re-probes).
        let mut updated = slot.clone();
        if let Some(email) = identity.email {
            updated.profile.email = email;
        }
        if identity.name.is_some() {
            updated.profile.display_name = identity.name;
        }
        if snapshot.plan_label.is_some() {
            updated.profile.plan = snapshot.plan_label.clone();
        }
        if updated.profile.email != slot.profile.email
            || updated.profile.display_name != slot.profile.display_name
            || updated.profile.plan != slot.profile.plan
        {
            updated.saved_at = now_ms();
            if let Err(err) = self.write_slot(&updated) {
                tracing::warn!(slot = %slot.id, error = %err, "devin identity write-back failed");
            }
        }
        Ok(snapshot)
    }

    /// A per-provider login (OpenCode / Pi entry, Hermes pool entry): probe
    /// the vendor behind it with its own token.
    pub(super) async fn keyed_usage(
        &self,
        harness: HarnessId,
        slot: &Slot,
    ) -> Result<UsageSnapshot, ProbeError> {
        let missing = ProbeError::NoCredentials {
            why: NoCredentials::Missing,
        };
        let key = slot.store_key.as_deref().ok_or(missing.clone())?;
        let creds = &slot.credentials;
        if harness == HarnessId::Hermes {
            if str_field(creds, "auth_type").as_deref() == Some("api_key") {
                return Err(ProbeError::NoCredentials {
                    why: NoCredenti
```

### Core Architecture Module: `crates/engine/src/auth.rs`
```
//! Auth — the engine owns the WorkOS session for its device (feature-inventory §3.7,
//! ARCHITECTURE §5). Port of zeron's `apps/backend/src/auth.ts`.
//!
//! The engine is a public client: it builds the AuthKit authorize URL itself but
//! delegates the secret-bearing **code exchange** and **refresh** to the edge Worker
//! (`/auth/exchange`, `/auth/refresh` — the WorkOS API key lives only there).
//!
//! Two modes:
//! - **Dev** (no WorkOS client id configured, or the edge reports `auth: "dev"`): always
//!   signed in; the bearer IS the configured user id (current M2/M3 behavior).
//! - **WorkOS**: authorization-code flow. Headed devices use a loopback callback server
//!   on an ephemeral port; headless devices use the paste-code flow (the redirect is the
//!   edge's hosted `/auth/cli/callback` page, which shows `state.code` to paste back via
//!   stdin or the `CompleteSignIn` RPC). The refresh token is persisted 0600 in the data
//!   dir; access tokens are cached with dual-clock expiry (monotonic AND wall, whichever
//!   aged more — see [`AccessEntry`]) and refreshed on demand plus by a background loop,
//!   so the device-room relay and room clients always dial with a live `?token=`, even
//!   on the first redial after a laptop wakes from sleep. Org onboarding: an org-less session is `NeedsOrganization`; `SelectOrg`
//!   runs an org-scoped refresh and the state follows the returned token's `org_id`.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, MutexGuard, PoisonError, Weak};
use std::time::{Duration, Instant};

use futures::FutureExt;
use serde::{Deserialize, Serialize};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::watch;

use crate::EngineError;
use crate::http_error::describe_http_error;
use zeron_rpc::TokenError;

const SIGN_IN_TTL: Duration = Duration::from_secs(15 * 60);
/// Refresh when the cached token has less than this much life left.
const TOKEN_SLACK: Duration = Duration::from_secs(30);
const HTTP_TIMEOUT: Duration = Duration::from_secs(15);
const REFRESH_RETRY_BASE: Duration = Duration::from_secs(1);
/// DNS can recover without an OS path event. Keep polling even at the cap.
const REFRESH_RETRY_CAP: Duration = Duration::from_secs(5);

type RefreshFlight =
    futures::future::Shared<futures::future::BoxFuture<'static, Result<Option<String>, String>>>;

#[derive(Default)]
struct RefreshRetry {
    generation: u64,
    failures: u32,
    failure: Option<RefreshFailure>,
}

struct RefreshFailure {
    message: String,
    at: tokio::time::Instant,
    wall: std::time::SystemTime,
    delay: Duration,
}

impl RefreshFailure {
    fn remaining(&self) -> Duration {
        let wall = self.wall.elapsed().unwrap_or(Duration::ZERO);
        self.delay.saturating_sub(self.at.elapsed().max(wall))
    }
}

fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(PoisonError::into_inner)
}

// ---------------------------------------------------------------------------
// Wire types (feature-inventory §2 AuthRpc)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AuthUser {
    pub id: String,
    pub email: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrgMembership {
    pub id: String,
    pub organization_id: String,
    pub name: String,
}

/// AuthStatus stream payload (`SignedOut | NeedsOrganization{user} |
/// SignedIn{user, orgId?}`). Serializes as the canonical [`zeron_proto::AuthState`]
/// wire shape (`{"state": "signedIn", …}`) so every client parses one form.
#[derive(Debug, Clone, PartialEq)]
pub enum AuthState {
    SignedOut,
    NeedsOrganization {
        user: AuthUser,
    },
    SignedIn {
        user: AuthUser,
        org_id: Option<String>,
    },
}

impl AuthState {
    pub fn is_signed_in(&self) -> bool {
        matches!(self, AuthState::SignedIn { .. })
    }

    pub fn org_id(&self) -> Option<&str> {
        match self {
            AuthState::SignedIn { org_id, .. } => org_id.as_deref(),
            _ => None,
        }
    }

    pub fn user(&self) -> Option<&AuthUser> {
        match self {
            AuthState::SignedIn { user, .. } | AuthState::NeedsOrganization { user } => Some(user),
            AuthState::SignedOut => None,
        }
    }

    /// The proto wire twin — the one shape the engine emits over AuthStatus.
    pub fn to_proto(&self) -> zeron_proto::AuthState {
        let profile = |user: &AuthUser| zeron_proto::UserProfile {
            id: user.id.clone(),
            email: user.email.clone(),
            name: user.name.clone(),
        };
        match self {
            AuthState::SignedOut => zeron_proto::AuthState::SignedOut,
            AuthState::NeedsOrganization { user } => zeron_proto::AuthState::NeedsOrganization {
                user: profile(user),
            },
            AuthState::SignedIn { user, org_id } => zeron_proto::AuthState::SignedIn {
                user: profile(user),
                org_id: org_id.clone(),
            },
        }
    }
}

impl Serialize for AuthState {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        self.to_proto().serialize(serializer)
    }
}

// ---------------------------------------------------------------------------
// Config + construction
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct AuthConfig {
    /// Edge base URL (`/auth/*` routes).
    pub edge_url: String,
    /// Data dir for the persisted session (`session.json`, 0600).
    pub data_dir: PathBuf,
    /// WorkOS client id; `None` = dev mode.
    pub workos_client_id: Option<String>,
    /// WorkOS API base (authorize URL host).
    pub workos_api_base: String,
    /// Dev-mode bearer/user id (mirrors the old `ZERON_EDGE_TOKEN` behavior).
    pub dev_user_id: String,
    /// Loopback callback port; `None` = ephemeral.
    pub callback_port: Option<u16>,
}

impl AuthConfig {
    pub fn new(edge_url: impl Into<String>, data_dir: impl Into<PathBuf>) -> Self {
        Self {
            edge_url: edge_url.into(),
            data_dir: data_dir.into(),
            workos_client_id: None,
            workos_api_base: "https://api.workos.com".into(),
            dev_user_id: "dev-user".into(),
            callback_port: None,
        }
    }
}

/// The persisted session (refresh token + user + last org scope).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredSession {
    refresh_token: String,
    user: AuthUser,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    org_id: Option<String>,
}

/// Access-token cache. Expiry ages the token's own lifetime (`exp - iat`) by
/// BOTH clocks, pessimistically. Monotonic alone (`Instant`) freezes across
/// system sleep (macOS `mach_absolute_time` and Linux `CLOCK_MONOTONIC` both
/// exclude suspend), so a laptop waking from hours of sleep presented a
/// wall-expired token that still read "fresh" — every room/relay redial got a
/// 401 with the same stale bearer and sync never recovered (user report).
/// Wall clock alone breaks under skewed device clocks (`exp` vs local time);
/// the elapsed-since-issue reading is skew-immune, and a BACKWARD wall step
/// (NTP correction) degrades harmlessly to the monotonic reading.
struct AccessEntry {
    token: String,
    ttl: Duration,
    got_at: Instant,
    got_wall: std::time::SystemTime,
}

impl AccessEntry {
    fn fresh(token: String) -> Self {
        let ttl = jwt_claims(&token)
            .and_then(|c| match (c.exp, c.iat) {
                (Some(exp), Some(iat)) if exp > iat => {
                    Some(Duration::from_secs((exp - iat) as u64))
                }
                _ => None,
            })
            .unwrap_or(Duration::from_secs(240));
        Self {
            token,
            ttl,
            got_at: Instant::now(),
            got_wall: std::time::SystemTime::now(),
        }
    }

    fn remaining(&self) -> Duration {
        let monotonic = self.got_at.elapsed();
        let wall = std::time::SystemTime::now()
            .duration_since(self.got_wall)
            .unwrap_or(Duration::ZERO);
        self.ttl.saturating_sub(monotonic.max(wall))
    }
}

struct AuthInner {
    config: AuthConfig,
    /// `Some(client_id)` = WorkOS mode; `None` = dev mode.
    workos: Option<String>,
    /// Whether construction loaded a parseable WorkOS session. This is an
    /// immutable startup fact: refresh or sign-out must not rewrite it.
    loaded_workos_session: bool,
    http: reqwest::Client,
    state_tx: watch::Sender<AuthState>,
    token_tx: watch::Sender<u64>,
    stored: Mutex<Option<StoredSession>>,
    access: Mutex<Option<AccessEntry>>,
    /// Pending OAuth states plus the cancellation generation that fences code
    /// exchanges already in flight when sign-out occurs.
    sign_in: Mutex<SignInLifecycle>,
    /// Single-flight refresh: WorkOS refresh tokens are single-use (rotated per
    /// exchange); two concurrent refreshes would race and could revoke the session.
    refresh_gate: tokio::sync::Mutex<()>,
    refresh_flight: Mutex<Option<RefreshFlight>>,
    /// Failed refreshes are shared across every HTTP/WS token consumer, not
    /// just delayed by the background loop. Resettable without waiting on HTTP.
    refresh_retry: Mutex<RefreshRetry>,
    retry_tx: watch::Sender<u64>,
    /// Loopback callback listener port, bound lazily on the first headed sign-in.
    loopback: tokio::sync::Mutex<Option<u16>>,
}

#[derive(Default)]
struct SignInLifecycle {
    generation: u64,
    pending: HashMap<String, Instant>,
}

/// The auth service — cheap to clone by `Arc`.
#[derive(Clone)]
pub 
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #799** (2026-10-05): **Group projects by git identity, plus Zeron Icons and rolling labels**
  *Symptoms*: ## Summary  **Group projects by repository identity** - The engine stamps each project (space) with a `repositoryId`: the commit its main line of history started from (`commit:<sha>`). That survives repository renames and transfers, SSH host aliases and remote spellings. - Shallow clones and repos with no commits yet fall back to the normalized remote, then to a per-device hash. - A folder below the repository root carries its path inside the repo, so monorepo siblings stay separate projects. - The sidebar's project mode folds clones and worktrees into one group. The new-session composer picks the project first, then the device. iOS does the same through the shared core. - Mixed versions are safe: the field is optional and readers treat it as opaque.  **UI** - Adopts Zeron Icons across the shell. The sidebar toggle glyph animates between open and closed. - Picker chip labels, the compact picker's effort title, and the working indicator's word and timer roll when they change (Scritto-style blur and tilt; animation runs on the shared 30Hz pulse clock). - Composer chips stay steady across project switches. - The compact sidebar row keeps a stable trailing cluster: PR badge, then one fixed slot showing the time, archive on hover, or the jump legend while Cmd is held. - The compact model list returns to provider tabs. - The model chip's effort text is always muted.  **Dependencies:** pins zeronsh/zui `0966d06` (adds `paint_glyph_transformed` with gaussian glyph blur on Metal, WGSL

- **Issue #775** (2026-10-05): **Composer: mention images and files as chips**
  *Symptoms*: ## Summary  - Pasting, dropping or attaching a file stages it and drops a chip at the caret, so a prompt can say *which* attachment it means. Images read `Image 1`, `Image 2`, …; any other regular file (up to the existing 24 MB limit, no extension filter) is staged as opaque bytes and its chip carries the file name and the file theme's icon. - Chips and attachments stay in step: removing the last chip for an attachment unstages it (undo restores both), removing a tile removes its chips, and a chip whose attachment is gone shows as plain text and is never sent as a link. The `@` list pins staged attachments above project files and filters them as you type. - All chips (files, folders, skills, commands, attachments) share one pill style — the same soft badge the transcript already uses for tool file names — in the composer, sent messages and queue rows. Hovering an image chip shows a preview with its name and size. - Sent messages show file attachments as pills (images keep thumbnails); queue rows show an icon tile for files. The prompt trailer, uploads and run request are unchanged; the chip text becomes the plain label (`Image 2`, `notes.md`) when a prompt reaches a provider.  Worth a close look:  - **Restyle of existing chips.** `@file`, `$skill` and `/command` chips used to render as monochrome inline code. They now use the shared pill with an icon, so every chip reads the same. This is the one change to nearby UI. - **Wire/persisted text.** Chips are two new cano
  **Post-Mortem & Fix Analysis**:
  > ## Security review: no issues found  - **Engine readback (`uploads.rs`)**: the path jail is unchanged. Both sides are canonicalized, so `..` and symlinks can't escape, and the 32 MB cap still applies. Only files inside the uploads dir are newly readable as `application/octet-stream`. Workspace roots and the historical read-only roots stay image-only. Everything in the uploads dir is bytes the user staged, so no new class of file is exposed. - **Chip links (`attachment_mentions.rs`)**: they carry only a per-draft number, never a path. Labels must round-trip the escaper exactly, control characters are rejected, links inside images are ignored, and providers receive the plain label. - **Staging**: files are read only from copied/dropped paths (`ExternalPaths`), never from pasted text. Folders are refused, the 24 MB limit applies, and newlines in names are replaced so a name can't add attachment-ref lines.  ## Follow-up commit (2e353ba1)  1. **Tiles removed for chipped attachments** in the
  > ## Follow-up (78eaf6b9): sent messages are chips-only  Sent messages no longer show a strip above the bubble for attachments that have a chip. The strip now only appears for attachments without one (appshots, mobile sends).  To keep sent images viewable, clicking an image chip now opens the image full size, like the thumbnail did. The image is loaded ahead of the click and stays loaded with the row.  The one thing chipped images lose is the upload-progress ring that used to sit on the thumbnail.  Tests: `cargo test -p zeron-ui --lib -- --test-threads=1`, 1530 passed.  ![Sent bubble, chips only](https://raw.githubusercontent.com/zeronsh/zeron/cd2c46ad7d29b1c4b13b657c4d82e7b1ef6c5bb8/sent-bubble-chips-only.png)  Clicking `Image 2`:  ![Image chip opens the preview](https://raw.githubusercontent.com/zeronsh/zeron/cd2c46ad7d29b1c4b13b657c4d82e7b1ef6c5bb8/image-chip-click-preview.png)  🤖 Generated with [Claude Code](https://claude.com/claude-code) 
  > This addresses the original desktop ZIP-drop failure: removing the image-only filter and staging other regular files as bytes fixes the root cause. I reviewed head `78eaf6b9` and checked the passing Linux and Windows file tests. A few substantive gaps remain:  1. **Chip deletion during a queued-message edit leaves the attachment staged.** `reconcile_attachment_mentions` skips reconciliation whenever `editing_queued` is set ([composer.rs](https://github.com/zeronsh/zeron/blob/78eaf6b929bd6d84831c6456e305fbaeefc68bf6/crates/ui/src/composer.rs#L6687)), but newly attached files still receive chips while editing. The affected sequence is: edit a queued message → attach a ZIP → delete its chip → save. The save path snapshots and uploads all remaining staged attachments ([queue.rs](https://github.com/zeronsh/zeron/blob/78eaf6b929bd6d84831c6456e305fbaeefc68bf6/crates/ui/src/queue.rs#L1616)), so deleting the chip does not remove that ZIP from the message. Please isolate the queued edit's attach

- **Issue #763** (2026-10-03): **Fix preview discovery aborting CLI browser logins**
  *Symptoms*: Running `infisical login` from a known project immediately failed with `Login via browser failed. EOF`: Zeron's preview discovery sent `HEAD /` to the CLI's temporary callback listener, and Infisical tried to decode that empty request as the browser's JSON login payload. The delayed token-paste prompt then overlapped the email fallback.  Exclude commands with explicit authentication arguments (`login`, `auth`, `authenticate`, `signin`, `sign-in`, `sso`, `oauth`, and `oauth2`, before `--`) before any TCP connection or preview publication. This applies to Zeron-owned descendants as well as external processes. Whole-argument matching preserves ordinary servers whose paths, URLs, or source strings mention authentication, and preserves applications launched through `infisical run -- ...`.  The regression starts a real child-process callback listener alongside an ordinary HTTP development server in the same project. It confirms discovery runs, sends zero connections to the callback across multiple scan cycles, and allows the browser's JSON POST to complete while discovery remains active. The regression failed against upstream main with the reproduced EOF before the fix.  Validation on Linux:  - `cargo test --locked -p zeron-preview -- --test-threads=1`: 25 passed; the existing local-Worker coordinator test remains ignored. - The final callback regression was rerun after keeping discovery active through browser completion. - `cargo clippy --locked -p zeron-preview --all-targets`: pa

- **Issue #760** (2026-10-03): **Render Mermaid diagrams in chat replies**
  *Symptoms*: ## Problem  The file preview already draws ```` ```mermaid ```` fences with the native `mermaid-rs-renderer` engine, but chat did not: when an agent replied with a diagram, the transcript showed only the source. The renderer had a hook for this (`MediaUi.diagram`), and the transcript passed `media: None`.  While measuring the chat integration, I also found that every prepared SVG and Mermaid diagram was charged against the media budget at the largest raster any view could ask for. This applied to the file preview as well. As a result, the file preview stopped drawing diagrams after about eight per document.  ## Change  ### Mermaid in chat  - Assistant replies render Mermaid fences as diagrams. They use the same engine, fence frame, **Show source / Show diagram** toggle, **Copy** action, and lightbox as the file preview. - Until a diagram is ready, the fence keeps its ordinary source. Completion therefore changes the row height at most once, with no "Rendering…" placeholder in between. - A failed render, or a diagram type the engine does not support, keeps the source. A warning marker in the fence header shows the engine's diagnostic as a tooltip. - The source toggle follows the stable row identity, so it survives the streaming → complete flip. - Inline images in chat keep their existing text rendering. `MediaUi.image` is now optional, so this change does not alter them.  ### Streaming safety  A fence that may still be growing is never rendered:  - A block requests a diagram o

- **Issue #757** (2026-10-03): **Fix Shift+Backspace deletion in text inputs**
  *Symptoms*: Holding Shift while pressing Backspace currently leaves typed input unchanged. Bind `shift-backspace` to the existing deletion action in both the shared composer keymap and palette-search keymap, so it deletes the preceding grapheme or the selected text as ordinary Backspace does.  ### Root cause  GPUI distinguishes modified keystrokes. The editor registered `backspace` but never registered `shift-backspace`, so holding Shift prevented the deletion action from being dispatched. Palette search has a separate text-editing keymap with the same omission. The deletion implementation itself already handles grapheme boundaries and selected ranges correctly.  ### Validation  - Added a GPUI regression test that focuses the rendered input and dispatches the actual `shift-backspace` keystroke in `Composer`, `MessageComposer`, and `PaletteSearch` contexts. - Covers a Unicode character, a nonempty selection, and an empty input. - Confirmed the test fails before the fix (`café` remains unchanged) and passes afterward. - `cargo test --locked -p zeron-ui --lib composer::tests -- --test-threads=1`: 135 passed. - `git diff --check` passed.  <!-- codesmith:footer --> --- <a href="https://app.blacksmith.sh/zeronsh/codesmith/zeron/pr/757?autoLogin=true&ref=codesmith_pr_footer"><picture><source media="(prefers-color-scheme: dark)" srcset="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-dark-v2.svg"><source media="(prefers-color-scheme: light)" srcset="https://pr-comments-ass

- **Issue #754** (2026-10-03): **Keep activity loaders pulsing under system reduced motion**
  *Symptoms*: When Windows has **Animation effects** disabled, the default **Reduce motion: System** preference freezes both the grid beside “Combobulating…” and the purple Working glyph. The OS returns false for `SPI_GETCLIENTAREAANIMATION`; `pulse_delta_every` then returns phase zero without leasing the shared animation clock. This was reproduced on Windows and with a regression test that failed before the fix. [Windows documents this setting here](https://learn.microsoft.com/en-us/windows/win32/winauto/client-area-animation).  Give activity grids a slow, uniform brightness pulse when following system reduced motion: a 2.4-second cycle, opacity 0.6–0.8, and 15 Hz updates through the existing self-parking clock. Other motion continues to follow the system setting. Explicit **Reduce motion: On** and **Pause animations in background** keep activity indicators still, and **Off** retains the normal travelling wave. Update the settings explanation and Windows development notes to describe this behavior.  Validation: - `cargo test --locked -p zeron-ui --lib -- --test-threads=1 --skip native_diff_font_geometry`: 1,451 passed, five existing ignored tests. - `cargo test --locked -p zeron-ui --lib native_diff_font_geometry -- --test-threads=1 --nocapture`: passed. - Four new regressions cover system reduced motion, explicit On/background pause, gentle uniform brightness, and repeated rendering of both the transcript loader and cached sidebar glyph. - Local native Windows probe with OS animations di

- **Issue #751** (2026-10-03): **Rename threads and side chats inline instead of in a dialog**
  *Symptoms*: ## Problem  Renaming a thread opened a modal "Rename session" dialog, both from the left sidebar's chat menu and for side chats under the file tree. There was no way to rename a row directly where it sits.  ## Change  - **Double-click** a session row in the left sidebar, or a side chat row in the explorer's Chats footer, to swap its title for an in-place field with the current name selected. - The chat menu's **Rename** (label drops the ellipsis, since it no longer opens a dialog) and the `/rename` command open the same field. - **Enter** or **blur** saves a changed, non-empty title. **Escape** cancels. Clicking inside the field places the caret instead of opening the chat or starting a drag. - The modal dialog is removed.  ### Hidden rows are revealed first  A rename started without touching the row (`/rename`, or Rename from a side chat's tab) could previously target a row that wasn't on screen, leaving an invisible field holding focus. Now the row is revealed before the field opens:  - A collapsed **Pinned**, **Sessions**, custom section, or device/project group opens with its usual disclosure motion. Expanding a synced custom section goes through the normal section change. - The **Archived** shelf opens and pages forward (in "Show more" steps) to include the row. - A collapsed sidebar expands. - The sidebar scrolls the row clear of its edge fades, following the disclosure while it opens. - The explorer's **Chats** section opens, pages, and scrolls to th
  **Post-Mortem & Fix Analysis**:
  > works in compact mode? 
  > > works in compact mode?  yes it does, i test it manually

- **Issue #750** (2026-10-02): **CI: pin every action to a commit SHA**
  *Symptoms*: ## Summary - Every third-party `uses:` in `.github/workflows/` and `.github/actions/` (60 references, 8 actions) now names a commit SHA, with the release version as a trailing comment. `release.yml` runs `Swatinem/rust-cache` and `softprops/action-gh-release` next to the macOS signing/notarization secrets and with `contents: write`; a moved tag could have run new code there. - No behavior change: each SHA is the commit the tag (`@v2`, `@v4`, `@v8`) points to today, checked through both the GitHub API and `git ls-remote` against the action's own repository (so no fork-network commit). - `.github/dependabot.yml` updates the pins weekly as one grouped PR (root workflows and the composite actions).  | action | version | sha | |---|---|---| | actions/checkout | v4.4.0 | 11d5960a | | actions/cache (restore/save) | v4.3.0 | 0057852b | | actions/setup-node | v4.4.0 | 49933ea5 | | actions/upload-artifact | v4.6.2 | ea165f8d | | actions/download-artifact | v4.3.0 | d3f86a10 | | actions/github-script | v8.0.0 | ed597411 | | Swatinem/rust-cache | v2.9.2 | 6323deb1 | | softprops/action-gh-release | v2.6.2 | 3bb12739 |  ## Test plan - [x] `actionlint` clean on every workflow. - [x] No unpinned third-party reference remains. - [ ] CI on this PR.  🤖 Generated with [Claude Code](https://claude.com/claude-code)  <!-- codesmith:footer --> --- <a href="https://app.blacksmith.sh/zeronsh/codesmith/zeron/pr/750?autoLogin=true&ref=codesmith_pr_footer"><picture><source media="(prefers-color-scheme: 

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

### Incident Patch 1: `9e1a1115` (2026-10-03)
**Commit Message**: Render Mermaid diagrams in chat replies (#760)

* Render Mermaid diagrams in chat replies

Assistant replies now draw ```mermaid fences as diagrams with the file
preview's engine, fence frame, source toggle, Copy action and lightbox.
Inline images in chat keep their text rendering.

Streaming never renders a fence that may still be growing: only blocks a
later row of the same reply follows, or blocks of a completed reply,
request a diagram, so per-token commits start no render work. Until a
diagram is ready the fence shows its source, and a failed render keeps
the source with the engine's diagnostic in a header marker.

Rows request their fences while laying out, so only painted diagrams
are rendered, one at a time off the UI thread; requests whose rows
scrolled away are dropped. Results are retained under a byte budget,
least recently painted first out. A swap remeasures only the rows
painting it and uses the existing layout signals, so the bottom pin
follows and the own-turn runway absorbs the change without moving the
sent prompt.

* Account prepared SVGs at their current raster, not the largest possible

decode_image reserved the largest preview any view could request (900x480


**File**: `crates/ui/src/attachments.rs` (modified, +16/-3)
```diff
@@ -956,6 +956,8 @@ pub struct PreviewImage {
     pub name: SharedString,
     pub image: Arc<Image>,
     pub(crate) viewer: crate::image_viewer::ImageView,
+    /// Fill behind an image drawn on a transparent canvas (diagrams).
+    pub(crate) plate: Option<gpui::Hsla>,
 }
 
 impl PreviewImage {
@@ -964,8 +966,14 @@ impl PreviewImage {
             name: name.into(),
             image,
             viewer: Default::default(),
+            plate: None,
         }
     }
+
+    pub(crate) fn with_plate(mut self, plate: gpui::Hsla) -> Self {
+        self.plate = Some(plate);
+        self
+    }
 }
 
 /// Shared image viewer over a dim scrim. Escape and a click close it;
@@ -1006,9 +1014,14 @@ pub(crate) fn lightbox_with_size(
             })
     });
     let content = match natural_size {
-        Some(natural) => preview
-            .viewer
-            .render(preview.image.clone(), natural, None, window, cx),
+        Some(natural) => preview.viewer.render(
+            preview.image.clone(),
+            natural,
+            None,
+            preview.plate,
+            window,
+            cx,
+        ),
         None => div()
             .text_color(ink(0.6))
             .child("Loading image…")
```

**File**: `crates/ui/src/files/image_preview.rs` (modified, +1/-0)
```diff
@@ -205,6 +205,7 @@ impl Render for ImagePreview {
                 display.image,
                 gpui::size(px(source.width), px(source.height)),
                 None,
+                None,
                 window,
                 cx,
             ));
```

**File**: `crates/ui/src/files/markdown_preview.rs` (modified, +89/-86)
```diff
@@ -239,14 +239,29 @@ impl MarkdownPreview {
             480.0,
         );
         let mut retired = Vec::new();
+        // Admission accounts current rasters, so a sharper one must still fit
+        // the document budget.
+        let mut used: usize = self
+            .images
+            .values()
+            .chain(self.diagrams.values())
+            .filter_map(|m| m.as_ref().ok())
+            .map(|m| m.bytes)
+            .sum();
         for media in self
             .images
             .values_mut()
             .chain(self.diagrams.values_mut())
             .filter_map(|m| m.as_mut().ok())
         {
-            let next = media.preview_for_view(target, window.scale_factor());
+            let others = used - media.bytes;
+            let next = media.preview_within(
+                target,
+                window.scale_factor(),
+                MAX_MEDIA_BYTES.saturating_sub(others),
+            );
             if !Arc::ptr_eq(&media.image, &next.image) {
+                used = others + next.bytes;
                 retired.push(std::mem::replace(media, next));
                 self.media_dirty = true;
             }
@@ -966,38 +981,22 @@ impl MarkdownPreview {
         loaded: &crate::image_media::MediaImage,
         id: gpui::SharedString,
         name: String,
+        plate: Option<gpui::Hsla>,
         weak: gpui::WeakEntity<Self>,
     ) -> AnyElement {
-        use gpui::StyledImage as _;
-        let preview = crate::attachments::PreviewImage::new(name, loaded.image.clone());
+        let mut preview = crate::attachments::PreviewImage::new(name, loaded.image.clone());
+        preview.plate = plate;
         let source = loaded.clone();
-        div()
-            .id(id)
-            .w_full()
-            .max_w(px(loaded.width))
-            .mx_auto()
-            .max_h(px(480.0))
-            .aspect_ratio(loaded.width / loaded.height)
-            .cursor_pointer()
-            .role(gpui::Role::Button)
-            .aria_label("Enlarge image")
-            .on_click(move |_, window, cx| {
-                cx.stop_propagation();
-                let _ = weak.update(cx, |view, cx| {
-                    view.close_media_preview(cx);
-                    view.zoom_source = Some(source.clone());
-                    preview.viewer.reset();
-                    view.preview_image = Some(preview.clone());
-                    window.focus(&view.preview_focus, cx);
-                    cx.notify();
-                });
-            })
-            .child(
-                gpui::img(loaded.image.clone())
-                    .size_full()
-                    .object_fit(gpui::ObjectFit::Contain),
-            )
-            .into_any_element()
+        crate::image_media::preview_element(loaded, id, move |window, cx| {
+            let _ = weak.update(cx, |view, cx| {
+                view.close_media_preview(cx);
+                view.zoom_source = Some(source.clone());
+                preview.viewer.reset();
+                view.preview_image = Some(preview.clone());
+                window.focus(&view.preview_focus, cx);
+                cx.notify();
+            });
+        })
     }
 
     #[cfg(test)]
@@ -1129,6 +1128,7 @@ impl MarkdownPreview {
                                 loaded,
                                 format!("{id}-image").into(),
                                 "Mermaid diagram".into(),
+                                Some(crate::markdown::mermaid::Palette::plate(theme)),
                                 diagram_owner.clone(),
                             ),
                             Some(Err(error)) => div()
@@ -1147,7 +1147,7 @@ impl MarkdownPreview {
                                 })
                                 .into_any_element(),
                         };
-                        render::DiagramUi {
+                        render::DiagramView::Diagram(render::DiagramUi {
                             body,
                             show_source: source_shown,
                             toggle_source: Rc::new(move |_, cx| {
@@ -1159,29 +1159,31 @@ impl MarkdownPreview {
                                     cx.notify();
                                 });
                             }),
-                        }
+                        })
                     })),
-                    image: Rc::new(move |image, id, theme| match images.get(&image.source) {
-                        Some(Ok(loaded)) => {
-                            let mut el =
-                                div()
-                                    .flex()
-                                    .flex_col()
-                                    .gap(px(4.0))
-                                    .child(Self::media_element(
+                    image: Some(Rc::new(move |image, id, theme| {
+                        match images.get(&image.source) {
+                            Some(Ok(loaded)) => {
+                                let mut el = div().flex()
```

**File**: `crates/ui/src/image_media.rs` (modified, +80/-8)
```diff
@@ -60,6 +60,12 @@ fn raster_size(
     size
 }
 
+/// Memory a prepared SVG holds: its source and wrapper copies, plus both the
+/// CPU pixels and GPU texture of one raster.
+fn svg_retained_bytes(svg: &str, raster: (u32, u32)) -> usize {
+    svg.len() * 2 + 1024 + raster.0 as usize * raster.1 as usize * 8
+}
+
 impl MediaImage {
     /// Preserve the sanitized vector source; only the outer raster viewport changes.
     pub(crate) fn for_view(&self, viewport: (f32, f32), dpi: f32, pixels: usize) -> Self {
@@ -82,14 +88,25 @@ impl MediaImage {
             image: Arc::new(Image::from_bytes(ImageFormat::Svg, wrapper.into_bytes())),
             width: self.width,
             height: self.height,
-            bytes: self
-                .bytes
-                .max(svg.len() * 2 + 1024 + size.0 as usize * size.1 as usize * 8),
+            bytes: svg_retained_bytes(svg, size),
             svg: self.svg.clone(),
             raster_size: Some(size),
         }
     }
 
+    /// Re-rasterize for a new view only when the variant fits the memory the
+    /// owner can still spend (`available`, excluding this media). A larger
+    /// raster that does not fit keeps the current one: slightly softer, never
+    /// over budget.
+    pub(crate) fn preview_within(&self, viewport: (f32, f32), dpi: f32, available: usize) -> Self {
+        let next = self.preview_for_view(viewport, dpi);
+        if next.bytes > self.bytes && next.bytes > available {
+            self.clone()
+        } else {
+            next
+        }
+    }
+
     pub(crate) fn preview_for_view(&self, viewport: (f32, f32), dpi: f32) -> Self {
         self.for_view(viewport, dpi, PREVIEW_PIXELS)
     }
@@ -117,6 +134,36 @@ impl MediaImage {
     }
 }
 
+/// Prepared media centered at its natural size within the reading column,
+/// capped at 480px tall. A click requests the enlarged lightbox.
+pub(crate) fn preview_element(
+    loaded: &MediaImage,
+    id: gpui::SharedString,
+    on_click: impl Fn(&mut gpui::Window, &mut gpui::App) + 'static,
+) -> gpui::AnyElement {
+    use gpui::{InteractiveElement as _, IntoElement as _, StyledImage as _, prelude::*};
+    gpui::div()
+        .id(id)
+        .w_full()
+        .max_w(gpui::px(loaded.width))
+        .mx_auto()
+        .max_h(gpui::px(480.0))
+        .aspect_ratio(loaded.width / loaded.height)
+        .cursor_pointer()
+        .role(gpui::Role::Button)
+        .aria_label("Enlarge image")
+        .on_click(move |_, window, cx| {
+            cx.stop_propagation();
+            on_click(window, cx);
+        })
+        .child(
+            gpui::img(loaded.image.clone())
+                .size_full()
+                .object_fit(gpui::ObjectFit::Contain),
+        )
+        .into_any_element()
+}
+
 pub(crate) fn svg_options() -> usvg::Options<'static> {
     static FONTS: OnceLock<Arc<usvg::fontdb::Database>> = OnceLock::new();
     let fonts = FONTS
@@ -157,15 +204,14 @@ pub(crate) fn decode_image(mime: &str, bytes: Vec<u8>) -> Result<MediaImage, Str
         if svg.len() > zeron_proto::MAX_WORKSPACE_IMAGE_BYTES {
             return Err("Prepared SVG exceeds preview size limit".into());
         }
-        let maximum = raster_size(width, height, (900.0, 480.0), 4.0, PREVIEW_PIXELS);
-        // Reserve the largest admitted preview across supported display densities,
-        // including both CPU pixels and GPU texture, plus source and wrapper.
-        let retained = svg.len() * 2 + 1024 + maximum.0 as usize * maximum.1 as usize * 8;
+        // Account the raster that exists, not the largest one any view could
+        // request: owners re-check their budget before a larger re-raster
+        // (`MediaImage::preview_within`).
         let media = MediaImage {
             image: Arc::new(Image::from_bytes(ImageFormat::Svg, Vec::new())),
             width,
             height,
-            bytes: retained,
+            bytes: svg_retained_bytes(&svg, (0, 0)),
             svg: Some(Arc::from(svg)),
             raster_size: None,
         };
@@ -351,6 +397,32 @@ mod tests {
         }
     }
 
+    #[test]
+    fn svg_accounting_follows_the_current_raster_and_upgrades_respect_budget() {
+        let media = decode_image(
+            "image/svg+xml",
+            br#"<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100"/></svg>"#.to_vec(),
+        )
+        .unwrap();
+        let exact = |m: &MediaImage| {
+            let (w, h) = m.raster_size.unwrap();
+            m.svg.as_ref().unwrap().len() * 2 + 1024 + w as usize * h as usize * 8
+        };
+        // A small diagram no longer reserves the largest preview any view
+        // could ask for (900x480 at 4x).
+        assert_eq!(media.bytes, exact(&media));
+        assert!(media.bytes < 1024 * 1024);
+        let sharper = media.preview_within((900.0, 480.0), 4.0, usize::MAX);
+        assert!(sharper.bytes > media.bytes);
+        assert_eq!(sharper.bytes, exact(&shar
```

**File**: `crates/ui/src/image_viewer.rs` (modified, +13/-0)
```diff
@@ -207,6 +207,7 @@ impl ImageView {
         image: Arc<Image>,
         natural: Size<Pixels>,
         on_image_click: Option<ImageClick>,
+        plate: Option<gpui::Hsla>,
         _window: &mut Window,
         _cx: &mut App,
     ) -> AnyElement {
@@ -283,6 +284,18 @@ impl ImageView {
                     on_click(window, cx);
                 }
             })
+            .when_some(plate, |viewport, plate| {
+                viewport.child(
+                    div()
+                        .absolute()
+                        .left(px(origin.x))
+                        .top(px(origin.y))
+                        .w(px(natural.width * geometry.scale))
+                        .h(px(natural.height * geometry.scale))
+                        .rounded(px(10.0))
+                        .bg(plate),
+                )
+            })
             .child(
                 gpui::img(image)
                     .absolute()
```

**File**: `crates/ui/src/markdown/mermaid.rs` (modified, +230/-25)
```diff
@@ -8,16 +8,23 @@ pub const MAX_SOURCE_BYTES: usize = 16 * 1024;
 // CPU work across previews; UI owners discard results from superseded revisions.
 static RENDER_LOCK: Mutex<()> = Mutex::new(());
 
+/// Zeron's diagram style. The canvas is left transparent so the diagram sits
+/// on its fence body; `canvas` is that body's opaque approximation, used where
+/// the engine needs a solid mask (edge label pills, hollow markers).
 #[derive(Clone)]
 pub struct Palette {
     dark: bool,
     font: String,
-    background: String,
-    raised: String,
+    canvas: String,
+    node: String,
+    group: String,
     text: String,
-    muted: String,
+    label: String,
+    line: String,
     border: String,
-    accent: String,
+    grid: String,
+    accent_line: String,
+    accent_wash: String,
 }
 
 fn color(color: gpui::Hsla, background: gpui::Hsla) -> String {
@@ -36,17 +43,36 @@ fn color(color: gpui::Hsla, background: gpui::Hsla) -> String {
 
 impl Palette {
     pub fn from_theme(theme: &Theme) -> Self {
+        let dark = theme.appearance.is_dark();
+        let canvas = Self::plate(theme);
+        // Nodes are cards lifted off the fence: white in light, one ink step
+        // up in dark, where the panel is already the deepest plane.
+        let node = if dark {
+            canvas.blend(theme.ink(0.06))
+        } else {
+            theme.bg
+        };
         Self {
-            dark: theme.appearance.is_dark(),
+            dark,
             font: theme.font_sans.to_string(),
-            background: color(theme.surface, theme.bg),
-            raised: color(theme.surface_raised, theme.bg),
-            text: color(theme.text, theme.bg),
-            muted: color(theme.text_muted, theme.bg),
-            border: color(theme.border_strong, theme.bg),
-            accent: color(theme.accent, theme.bg),
+            canvas: color(canvas, theme.bg),
+            node: color(node, canvas),
+            group: color(theme.ink(0.03), canvas),
+            text: color(theme.text, node),
+            label: color(theme.text_muted, canvas),
+            line: color(theme.text_faint, canvas),
+            border: color(theme.border_strong, canvas),
+            grid: color(theme.border, canvas),
+            accent_line: color(theme.accent.opacity(0.6), canvas),
+            accent_wash: color(theme.accent.opacity(0.12), node),
         }
     }
+
+    /// The fence body, an ink wash over the panel (see `code_block_frame`).
+    /// Also the fill behind a diagram shown off its fence, as in the lightbox.
+    pub fn plate(theme: &Theme) -> gpui::Hsla {
+        theme.bg.blend(theme.ink(0.035))
+    }
 }
 
 pub fn render(source: &str, palette: &Palette) -> Result<String, String> {
@@ -67,29 +93,42 @@ pub fn render(source: &str, palette: &Palette) -> Result<String, String> {
         } else {
             mermaid_rs_renderer::Theme::modern()
         };
+        // A denser layout than the engine's default: diagrams are scaled to the
+        // reading column, so slack spacing shrinks the labels.
+        options.layout.node_spacing = 36.0;
+        options.layout.rank_spacing = 40.0;
+        options.layout.node_padding_x = 18.0;
+        options.layout.node_padding_y = 10.0;
         let theme = &mut options.theme;
         theme.font_family = palette.font.clone();
         theme.font_size = 14.0;
-        theme.background = palette.background.clone();
-        theme.primary_color = palette.raised.clone();
+        theme.background = palette.canvas.clone();
+        theme.primary_color = palette.node.clone();
         theme.primary_text_color = palette.text.clone();
         theme.primary_border_color = palette.border.clone();
-        theme.text_color = palette.text.clone();
-        theme.line_color = palette.muted.clone();
-        theme.secondary_color = palette.raised.clone();
-        theme.tertiary_color = palette.raised.clone();
-        theme.edge_label_background = palette.background.clone();
-        theme.cluster_background = palette.background.clone();
+        theme.text_color = palette.label.clone();
+        theme.line_color = palette.line.clone();
+        theme.secondary_color = palette.node.clone();
+        theme.tertiary_color = palette.group.clone();
+        theme.edge_label_background = palette.canvas.clone();
+        theme.cluster_background = palette.group.clone();
         theme.cluster_border = palette.border.clone();
-        theme.sequence_actor_fill = palette.raised.clone();
+        theme.sequence_actor_fill = palette.node.clone();
         theme.sequence_actor_border = palette.border.clone();
-        theme.sequence_actor_line = palette.muted.clone();
-        theme.sequence_note_fill = palette.raised.clone();
-        theme.sequence_note_border = palette.border.clone();
-        theme.sequence_activation_fill = palette.accent.clone();
-        theme.sequence_activation_border = palette.border.clone();
+        theme.sequence_actor_line = palette.border.clone();
+     
```

**File**: `crates/ui/src/markdown/mermaid_cache.rs` (added, +366/-0)
```diff
@@ -0,0 +1,366 @@
+//! Lazily rendered Mermaid diagrams for a surface that discovers its fences
+//! while painting (the agent transcript).
+//!
+//! Rows request their fences as they lay out, so only painted diagrams cost
+//! anything. The owner renders one requested source at a time on a background
+//! executor and drops requests whose rows left the viewport before their turn.
+//! Results are retained under a byte budget, least recently painted first out;
+//! an evicted diagram simply renders again when its row returns. Diagrams
+//! painted in the latest two passes are never evicted, so the budget is soft
+//! only when more diagrams than it admits are on screen at once.
+use crate::image_media::MediaImage;
+use gpui::SharedString;
+use std::collections::{HashMap, HashSet};
+
+pub(crate) const MAX_RETAINED_BYTES: usize = 64 * 1024 * 1024;
+const MAX_ENTRIES: usize = 64;
+
+pub(crate) enum Lookup {
+    Pending,
+    Ready(MediaImage),
+    Failed(SharedString),
+}
+
+enum State {
+    Pending,
+    Ready(MediaImage),
+    Failed(SharedString),
+}
+
+struct Entry {
+    state: State,
+    /// Paint pass that last requested this source.
+    used: u64,
+    /// Rows that painted this source, remeasured when its result lands.
+    rows: Vec<SharedString>,
+}
+
+#[derive(Default)]
+pub(crate) struct MermaidCache {
+    entries: HashMap<String, Entry>,
+    frame: u64,
+    style: Option<u32>,
+    view: Option<((f32, f32), f32)>,
+    new_requests: bool,
+    /// Diagram frames switched to their source, keyed by frame id.
+    source_visible: HashSet<SharedString>,
+}
+
+/// The renderer keys a diagram frame `"{row_key}-mermaid-{ix}"`.
+pub(crate) fn frame_row(frame_id: &str) -> &str {
+    frame_id
+        .rsplit_once("-mermaid-")
+        .map_or(frame_id, |(row, _)| row)
+}
+
+impl MermaidCache {
+    /// Start a paint pass. A theme change discards every diagram, since the
+    /// palette is baked into the generated SVG; the media is returned for
+    /// release.
+    pub(crate) fn begin_frame(&mut self, style: u32) -> Vec<MediaImage> {
+        self.frame += 1;
+        if self.style == Some(style) {
+            return Vec::new();
+        }
+        self.style = Some(style);
+        self.drain()
+    }
+
+    /// Rasterize retained diagrams for the column width and display density.
+    /// Returns superseded rasters for release.
+    pub(crate) fn set_view(&mut self, target: (f32, f32), scale: f32) -> Vec<MediaImage> {
+        if self.view == Some((target, scale)) {
+            return Vec::new();
+        }
+        self.view = Some((target, scale));
+        let mut retired = Vec::new();
+        let mut used = self.retained_bytes();
+        for entry in self.entries.values_mut() {
+            if let State::Ready(media) = &mut entry.state {
+                let others = used - media.bytes;
+                let next =
+                    media.preview_within(target, scale, MAX_RETAINED_BYTES.saturating_sub(others));
+                if !std::sync::Arc::ptr_eq(&media.image, &next.image) {
+                    used = others + next.bytes;
+                    retired.push(std::mem::replace(media, next));
+                }
+            }
+        }
+        retired
+    }
+
+    /// Look up a fence painted in the current pass, queueing it if unseen.
+    pub(crate) fn request(&mut self, code: &str, frame_id: &str) -> Lookup {
+        let frame = self.frame;
+        let entry = match self.entries.get_mut(code) {
+            Some(entry) => entry,
+            None => {
+                self.new_requests = true;
+                self.entries.entry(code.to_owned()).or_insert(Entry {
+                    state: State::Pending,
+                    used: frame,
+                    rows: Vec::new(),
+                })
+            }
+        };
+        entry.used = frame;
+        let row = frame_row(frame_id);
+        if !entry.rows.iter().any(|known| known == row) {
+            entry.rows.push(row.to_owned().into());
+        }
+        match &entry.state {
+            State::Pending => Lookup::Pending,
+            State::Ready(media) => Lookup::Ready(media.clone()),
+            State::Failed(reason) => Lookup::Failed(reason.clone()),
+        }
+    }
+
+    /// Whether a fence was requested since the last call.
+    pub(crate) fn take_new_requests(&mut self) -> bool {
+        std::mem::take(&mut self.new_requests)
+    }
+
+    /// The next source to render. Requests not repainted in the latest two
+    /// passes belong to rows that scrolled away; they are forgotten and
+    /// requested again if their row returns. Two passes, because a request
+    /// can be made while the current pass has only laid out some of its rows.
+    pub(crate) fn next_job(&mut self) -> Option<String> {
+        let frame = self.frame;
+        self.entries.retain(|_, entry| {
+            !matches!(entry.state, State::Pending) || frame.saturating_sub(entry.used) <= 1
+        });
+        self.entries
```

**File**: `crates/ui/src/markdown/mod.rs` (modified, +1/-0)
```diff
@@ -27,3 +27,4 @@ pub mod veil;
 pub use parser::{Block, BlockTree, IncrementalParser, InlineRun, InlineStyle, parse_full};
 
 pub mod mermaid;
+pub(crate) mod mermaid_cache;
```

---

### Incident Patch 2: `edac0d7d` (2026-10-03)
**Commit Message**: Fix Windows drive paths in the project folder picker (#727)

* Fix Windows drive paths in the project folder picker

The folder-browser helpers (breadcrumbs, parent_path, child_path,
path_under) only understood "/" separators. For a drive path like D:\ they
produced a bogus "/D:\" crumb; clicking it (or any deeper crumb) sent that
path to the engine, which failed with "os error 123". Going up from D:\Foo
also fell back to the drive list instead of reaching D:\.

Detect drive-rooted paths by shape (not cfg, since a non-Windows client can
browse a remote Windows device) and use "\" there. Drive roots no longer get
a duplicate crumb.

* Accept typed Windows drive paths in the folder picker search

Typing an absolute (/x) or home-relative (~/x) path in the folder search jumps
straight to it, but a drive path like D:\projects\ was treated as a folder-name
filter. Recognise drive-rooted queries (D:, D:\, D:/x) as path jumps, normalise
them to backslashes so the breadcrumb trail matches, and commit on a trailing
\ or /.

**File**: `crates/ui/src/pickers.rs` (modified, +97/-10)
```diff
@@ -243,8 +243,28 @@ pub fn offered_options(
 // Pure: folder-browser navigation (used by the shell's add-space flow)
 // ---------------------------------------------------------------------------
 
+/// Whether `path` is drive-rooted (`C:`, `C:\…`, `C:/…`). Judged by shape,
+/// not `cfg`: the device being browsed may be a Windows machine reached from
+/// any platform.
+fn is_windows_path(path: &str) -> bool {
+    let bytes = path.as_bytes();
+    bytes.len() >= 2
+        && bytes[0].is_ascii_alphabetic()
+        && bytes[1] == b':'
+        && bytes.get(2).is_none_or(|b| matches!(b, b'/' | b'\\'))
+}
+
 /// Parent of an absolute path; `None` at the filesystem root.
 pub fn parent_path(path: &str) -> Option<String> {
+    if is_windows_path(path) {
+        let (drive, rest) = path.split_at(2);
+        let rest = rest.trim_matches(['/', '\\']);
+        if rest.is_empty() {
+            return None; // drive root
+        }
+        let parent = rest.rfind(['/', '\\']).map_or("", |at| &rest[..at]);
+        return Some(format!("{drive}\\{parent}"));
+    }
     let trimmed = path.trim_end_matches('/');
     if trimmed.is_empty() {
         return None; // was "/" (or empty)
@@ -258,8 +278,10 @@ pub fn parent_path(path: &str) -> Option<String> {
 
 /// Join a listing path and an entry name.
 pub fn child_path(base: &str, name: &str) -> String {
-    if base.ends_with('/') {
+    if base.ends_with(['/', '\\']) {
         format!("{base}{name}")
+    } else if is_windows_path(base) {
+        format!("{base}\\{name}")
     } else {
         format!("{base}/{name}")
     }
@@ -304,13 +326,29 @@ pub fn segment_target(names: &[&str], query: &str) -> Option<usize> {
     hits.next().is_none().then_some(ix)
 }
 
-/// Interpret a palette query as a typed path jump: absolute (`/disk2/projects`)
-/// or home-relative (`~`, `~/github`). Returns the absolute path to browse,
-/// trailing slash trimmed. `home` is the device's resolved home — `None`
-/// until the first listing lands, when `~` can't expand yet. A query like
-/// `~foo` is a folder name, not a path.
+/// Whether a palette query is path-shaped (absolute, home-relative or
+/// drive-rooted) rather than a folder name to filter by.
+pub fn is_typed_path(query: &str) -> bool {
+    query.starts_with(['/', '~']) || is_windows_path(query)
+}
+
+/// Interpret a palette query as a typed path jump: absolute (`/disk2/projects`),
+/// drive-rooted (`D:\projects`) or home-relative (`~`, `~/github`). Returns the
+/// absolute path to browse, trailing separator trimmed. `home` is the device's
+/// resolved home — `None` until the first listing lands, when `~` can't expand
+/// yet. A query like `~foo` is a folder name, not a path.
 pub fn typed_path_target(query: &str, home: Option<&str>) -> Option<String> {
     let query = query.trim();
+    if is_windows_path(query) {
+        let path = query.replace('/', "\\");
+        let trimmed = path.trim_end_matches('\\');
+        // `D:` and `D:\` both mean the drive root.
+        return Some(if trimmed.len() == 2 {
+            format!("{trimmed}\\")
+        } else {
+            trimmed.to_string()
+        });
+    }
     if let Some(rest) = query.strip_prefix('~') {
         let home = home?.trim_end_matches('/');
         if rest.is_empty() {
@@ -336,10 +374,17 @@ pub fn typed_path_target(query: &str, home: Option<&str>) -> Option<String> {
 
 /// Breadcrumb segments for a path: `(label, full path)`, root first.
 pub fn breadcrumbs(path: &str) -> Vec<(String, String)> {
-    let mut out: Vec<(String, String)> = vec![("/".to_string(), "/".to_string())];
-    let mut acc = String::new();
-    for segment in path.split('/').filter(|s| !s.is_empty()) {
-        acc.push('/');
+    let (drive, sep, rest) = if is_windows_path(path) {
+        let (drive, rest) = path.split_at(2);
+        (drive, '\\', rest)
+    } else {
+        ("", '/', path)
+    };
+    let root = format!("{drive}{sep}");
+    let mut out = vec![(root.clone(), root)];
+    let mut acc = drive.to_string();
+    for segment in rest.split(['/', sep]).filter(|s| !s.is_empty()) {
+        acc.push(sep);
         acc.push_str(segment);
         out.push((segment.to_string(), acc.clone()));
     }
@@ -8698,6 +8743,28 @@ mod tests {
         assert_eq!(breadcrumbs("/").len(), 1);
     }
 
+    #[test]
+    fn windows_folder_paths_and_breadcrumbs() {
+        assert_eq!(
+            parent_path(r"D:\Random\zeron"),
+            Some(r"D:\Random".to_string())
+        );
+        assert_eq!(parent_path(r"D:\Random"), Some(r"D:\".to_string()));
+        assert_eq!(parent_path(r"D:\Random\"), Some(r"D:\".to_string()));
+        assert_eq!(parent_path(r"D:\"), None);
+        assert_eq!(parent_path("D:"), None);
+        assert_eq!(child_path(r"D:\", "Random"), r"D:\Random");
+        assert_eq!(child_path(r"D:\Random", "zeron"), r"D:\Random\zeron");
+        let crumbs = breadcrumbs(r"D:\Random\zeron");
+        let labels: Vec<&str> = crumbs.iter().map(|
```

**File**: `crates/ui/src/shell/spaces.rs` (modified, +27/-13)
```diff
@@ -2231,10 +2231,14 @@ fn device_glyph(platform: &str) -> &'static str {
 }
 
 /// Segment-aware "is `path` at or under `base`" (`/media/a` is not under
-/// `/media/ab`); a root base covers everything.
+/// `/media/ab`); a root base covers everything. Either separator counts, so
+/// Windows drive paths (`D:\` under `D:\`) work too.
 fn path_under(path: &str, base: &str) -> bool {
-    let base = base.trim_end_matches('/');
-    base.is_empty() || path == base || path.starts_with(&format!("{base}/"))
+    let base = base.trim_end_matches(['/', '\\']);
+    base.is_empty()
+        || path
+            .strip_prefix(base)
+            .is_some_and(|rest| rest.is_empty() || rest.starts_with(['/', '\\']))
 }
 
 /// The space-row Rename dialog (same shape as [`RenameChatDialog`]).
@@ -5565,11 +5569,8 @@ impl Shell {
         };
         if rows.is_empty() {
             let text = flow.search.read(cx).text().to_string();
-            if text.starts_with('/') || text.starts_with('~') {
-                if let Some(target) = crate::pickers::typed_path_target(&text, flow.home.as_deref())
-                {
-                    self.add_space_descend(target, false, cx);
-                }
+            if let Some(target) = crate::pickers::typed_path_target(&text, flow.home.as_deref()) {
+                self.add_space_descend(target, false, cx);
             }
             return;
         }
@@ -5603,16 +5604,17 @@ impl Shell {
         {
             return false;
         }
-        // A typed PATH jump: an absolute (`/disk2/`) or home-relative (`~/x/`)
-        // query browses that path directly — mounts at unconventional roots
-        // (and anywhere else) are reachable without a Locations row. Same
-        // trailing-`/` trigger as the folder-name descend below.
+        // A typed PATH jump: an absolute (`/disk2/`), drive-rooted (`D:\x\`)
+        // or home-relative (`~/x/`) query browses that path directly — mounts
+        // at unconventional roots (and anywhere else) are reachable without a
+        // Locations row. Same trailing-separator trigger as the folder-name
+        // descend below.
         {
             let Some(flow) = self.add_space.as_ref() else {
                 return false;
             };
             let text = flow.search.read(cx).text().to_string();
-            if text.ends_with('/') && (text.starts_with('/') || text.starts_with('~')) {
+            if crate::pickers::is_typed_path(&text) && text.ends_with(['/', '\\']) {
                 let target = crate::pickers::typed_path_target(&text, flow.home.as_deref());
                 let Some(target) = target else {
                     // Path-shaped but unresolvable (`~/…` before home is
@@ -6926,6 +6928,18 @@ mod project_flow_tests {
         assert_eq!(deep, ["d", "e"]);
     }
 
+    #[test]
+    fn path_under_handles_posix_and_windows_drive_paths() {
+        assert!(path_under("/media/a", "/"));
+        assert!(path_under("/media/a", "/media"));
+        assert!(!path_under("/media/ab", "/media/a"));
+        // A drive-root crumb hides itself, not a sibling drive.
+        assert!(path_under(r"D:\", r"D:\"));
+        assert!(path_under(r"D:\Random", r"D:\"));
+        assert!(!path_under(r"D:\Random2", r"D:\Random"));
+        assert!(!path_under(r"C:\Random", r"D:\"));
+    }
+
     #[gpui::test]
     fn devices_locations_folders_and_back_clear_stale_state(cx: &mut gpui::TestAppContext) {
         let data = tempfile::tempdir().unwrap();
```

---

### Incident Patch 3: `612df512` (2026-10-03)
**Commit Message**: fix(preview): leave authentication callback listeners unprobed (#763)

**File**: `crates/preview/src/discovery.rs` (modified, +74/-1)
```diff
@@ -1,5 +1,6 @@
 //! Observe only this user's listeners. HTTP probes run only after project
-//! ownership has been established from the process's actual working directory.
+//! ownership has been established from the process's actual working directory
+//! and commands performing authentication have been excluded.
 use std::{
     collections::HashMap,
     net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr},
@@ -23,6 +24,31 @@ impl Listener {
     pub fn belongs_to(&self, root: &Path) -> bool {
         self.cwd.starts_with(root)
     }
+
+    /// A login CLI may open an HTTP listener in the project's cwd, but that
+    /// listener is a browser callback, not a development server. Some (such as
+    /// Infisical) abort the login on an unsolicited HEAD, so exclude explicit
+    /// authentication commands before connecting at all. Match whole arguments,
+    /// not paths, URLs or source strings that happen to mention authentication.
+    pub(crate) fn is_authentication_command(&self) -> bool {
+        self.args
+            .iter()
+            .skip(1)
+            .take_while(|arg| arg.as_str() != "--")
+            .any(|arg| {
+                matches!(
+                    arg.as_str(),
+                    "login"
+                        | "auth"
+                        | "authenticate"
+                        | "signin"
+                        | "sign-in"
+                        | "sso"
+                        | "oauth"
+                        | "oauth2"
+                )
+            })
+    }
 }
 
 /// Preserve a useful framework label without advertising process arguments,
@@ -432,6 +458,53 @@ pub fn same_process(_pid: u32, _started_at: u64) -> bool {
 mod tests {
     use super::*;
     #[test]
+    fn authentication_commands_are_not_preview_candidates() {
+        let listener = |args: &[&str]| Listener {
+            pid: 1,
+            parent: 0,
+            cwd: "/project".into(),
+            args: args.iter().map(|arg| (*arg).into()).collect(),
+            started_at: 1,
+            address: "127.0.0.1:3000".parse().unwrap(),
+            zeron_owned: true,
+        };
+        for args in [
+            vec!["/usr/bin/infisical", "login"],
+            vec![
+                "infisical",
+                "--silent",
+                "login",
+                "--domain",
+                "https://app.infisical.com",
+            ],
+            vec!["gh", "auth", "login"],
+            vec!["aws", "sso", "login"],
+            vec!["gcloud", "auth", "application-default", "login"],
+            vec!["codex", "login"],
+            vec!["node", "/tools/firebase.js", "login"],
+            vec!["cli", "authenticate"],
+            vec!["cli", "signin"],
+            vec!["cli", "sign-in"],
+            vec!["cli", "oauth"],
+            vec!["cli", "oauth2"],
+        ] {
+            assert!(listener(&args).is_authentication_command(), "{args:?}");
+        }
+        for args in [
+            vec![],
+            vec!["node", "/project/auth/server.js"],
+            vec!["node", "/project/login.js"],
+            vec!["node", "/project/node_modules/vite/bin/vite.js"],
+            vec!["next", "dev"],
+            vec!["python3", "-m", "http.server", "3000"],
+            vec!["python3", "-c", "import auth; auth.serve()"],
+            vec!["server", "--auth", "--login-url=https://example.com/login"],
+            vec!["infisical", "run", "--", "node", "server.js", "login"],
+        ] {
+            assert!(!listener(&args).is_authentication_command(), "{args:?}");
+        }
+    }
+    #[test]
     fn service_identity_ignores_port_configuration() {
         let args = |port: &str| vec!["node".into(), "api.js".into(), "--port".into(), port.into()];
         assert_eq!(
```

**File**: `crates/preview/src/service.rs` (modified, +1/-0)
```diff
@@ -226,6 +226,7 @@ impl PreviewService {
                             .filter(|l| {
                                 l.address.port() != zeron_proto::PREVIEW_PROXY_PORT
                                     && l.pid != std::process::id()
+                                    && !l.is_authentication_command()
                             })
                             .filter_map(|listener| {
                                 roots
```

**File**: `crates/preview/tests/discovery.rs` (modified, +114/-0)
```diff
@@ -157,3 +157,117 @@ async fn a_discovered_server_is_probed_once_not_every_cycle() {
     );
     service.shutdown().await;
 }
+
+/// Infisical's browser login decodes the first callback request as JSON. A
+/// discovery HEAD has no body and aborts that login with EOF. Even opening a
+/// connection to these one-shot listeners is outside preview discovery's remit.
+#[tokio::test]
+async fn authentication_callbacks_receive_no_discovery_connections() {
+    use tokio::io::{AsyncReadExt, AsyncWriteExt};
+
+    let _serial = SERIAL.lock().await;
+    let temp = tempfile::tempdir().unwrap();
+    let app = temp.path().join("app");
+    std::fs::create_dir(&app).unwrap();
+    let ready = temp.path().join("callback-port");
+    let connections = temp.path().join("callback-connections");
+    let script = format!(
+        r#"import json,socket
+s=socket.socket()
+s.bind(('127.0.0.1',0))
+s.listen()
+open({ready:?},'w').write(str(s.getsockname()[1]))
+c,_=s.accept()
+open({connections:?},'a').write('connected\n')
+r=c.makefile('rb')
+request=r.readline()
+headers={{}}
+while True:
+    line=r.readline()
+    if line in (b'\r\n',b''): break
+    name,value=line.decode().split(':',1)
+    headers[name.lower()]=value.strip()
+body=r.read(int(headers.get('content-length','0')))
+if not body: raise RuntimeError('EOF')
+assert request.startswith(b'POST ')
+assert json.loads(body)=={{'code':'test-code'}}
+c.sendall(b'HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nOK')
+"#,
+        ready = ready.display().to_string(),
+        connections = connections.display().to_string(),
+    );
+    let mut callback = Child(
+        std::process::Command::new("python3")
+            .args([
+                "-c",
+                &script,
+                "login",
+                "--domain",
+                "https://app.infisical.com",
+            ])
+            .current_dir(&app)
+            .stdout(std::process::Stdio::null())
+            .stderr(std::process::Stdio::inherit())
+            .spawn()
+            .unwrap(),
+    );
+    let port: u16 = tokio::time::timeout(Duration::from_secs(5), async {
+        loop {
+            if let Some(port) = std::fs::read_to_string(&ready)
+                .ok()
+                .and_then(|s| s.parse::<u16>().ok())
+            {
+                break port;
+            }
+            tokio::time::sleep(Duration::from_millis(20)).await;
+        }
+    })
+    .await
+    .expect("callback did not start");
+    let server = launch(&app, true);
+    let service = PreviewService::new(
+        temp.path().join("names.json"),
+        "local".into(),
+        "Laptop".into(),
+    )
+    .unwrap();
+    let roots = vec![app];
+    service.start(Arc::new(move || roots.clone()), None).await;
+    wait(&service, Some(server.0.id())).await;
+    // Discovery actually runs, including multiple cycles after the ordinary
+    // development server is found. The callback must remain entirely untouched.
+    tokio::time::sleep(Duration::from_secs(5)).await;
+    assert!(
+        !connections.exists(),
+        "preview discovery connected to the authentication callback"
+    );
+    assert!(callback.0.try_wait().unwrap().is_none());
+
+    // The real browser request can still finish the waiting sign-in.
+    let body = r#"{"code":"test-code"}"#;
+    let mut browser = tokio::net::TcpStream::connect(("127.0.0.1", port))
+        .await
+        .unwrap();
+    browser
+        .write_all(
+            format!(
+                "POST / HTTP/1.1\r\nHost: localhost:{port}\r\nContent-Length: {}\r\n\r\n{body}",
+                body.len()
+            )
+            .as_bytes(),
+        )
+        .await
+        .unwrap();
+    let mut response = String::new();
+    tokio::time::timeout(
+        Duration::from_secs(5),
+        browser.read_to_string(&mut response),
+    )
+    .await
+    .unwrap()
+    .unwrap();
+    assert!(response.starts_with("HTTP/1.1 200 OK"));
+    assert_eq!(std::fs::read_to_string(connections).unwrap(), "connected\n");
+    assert!(callback.0.wait().unwrap().success());
+    service.shutdown().await;
+}
```

**File**: `docs/preview-networking.md` (modified, +13/-3)
```diff
@@ -16,9 +16,19 @@ On Linux, the scanner joins the current user's `/proc` process cwd, ancestry,
 creation time and socket descriptors to listening TCP sockets. On macOS it uses
 `lsof` and `ps` for equivalent metadata. Only loopback-reachable listeners whose
 cwd belongs to a known local project are probed. The deepest matching project
-wins. Unrelated listeners and non-HTTP services are excluded. HTTP probes are
-bounded and run every two seconds, using HEAD and accepting valid HTTP status
-responses (including authentication and application errors).
+wins. Commands with explicit authentication arguments (`login`, `auth`,
+`authenticate`, `signin`, `sign-in`, `sso`, `oauth`, or `oauth2`, before `--`)
+are excluded before any connection, even when started by a Zeron terminal or
+agent. Their listeners may be one-shot browser callbacks: for example,
+`infisical login` fails with EOF if it receives a discovery HEAD without the
+browser's JSON body. This command check does not identify custom callback
+servers without an authentication argument.
+
+Unrelated listeners and non-HTTP services are excluded. Discovery runs every
+two seconds; bounded HEAD probes accept valid HTTP status responses (including
+authentication and application errors). Confirmed HTTP listeners are not
+probed again during that socket's lifetime; non-HTTP results use a capped
+exponential backoff.
 
 Zeron terminal/task/agent descendants are marked as Zeron-owned. Framework
 commands identify Vite, Next.js, Astro, Miniflare and Node servers; otherwise the
```

---

### Incident Patch 4: `2a884777` (2026-10-03)
**Commit Message**: Fix Shift+Backspace in composer and palette inputs (#757)

**File**: `crates/ui/src/composer.rs` (modified, +50/-0)
```diff
@@ -1499,6 +1499,7 @@ fn input_bindings(context: &'static str) -> Vec<KeyBinding> {
         KeyBinding::new("shift-tab", OutdentList, ctx),
         KeyBinding::new("shift-enter", Newline, ctx),
         KeyBinding::new("backspace", Backspace, ctx),
+        KeyBinding::new("shift-backspace", Backspace, ctx),
         KeyBinding::new("delete", Delete, ctx),
         KeyBinding::new("left", Left, ctx),
         KeyBinding::new("right", Right, ctx),
@@ -1618,6 +1619,7 @@ pub fn init(cx: &mut App, send_behavior: ComposerSendBehavior) {
     let palette = Some(PALETTE_SEARCH_CONTEXT);
     let mut palette_bindings = vec![
         KeyBinding::new("backspace", Backspace, palette),
+        KeyBinding::new("shift-backspace", Backspace, palette),
         KeyBinding::new("delete", Delete, palette),
         KeyBinding::new("home", Home, palette),
         KeyBinding::new("end", End, palette),
@@ -10930,6 +10932,54 @@ mod tests {
             .unwrap();
     }
 
+    #[gpui::test]
+    fn shift_backspace_deletes_text_and_selection_in_all_input_contexts(
+        cx: &mut gpui::TestAppContext,
+    ) {
+        cx.update(|cx| {
+            gpui_base::init(cx);
+            cx.set_global(Theme::dark());
+            init(cx, ComposerSendBehavior::default());
+        });
+        for context in [
+            GENERIC_COMPOSER_CONTEXT,
+            MESSAGE_COMPOSER_CONTEXT,
+            PALETTE_SEARCH_CONTEXT,
+        ] {
+            let handle = cx.add_window(|window, cx| {
+                let mut input = ComposerInput::with_context("", context, cx);
+                input.set_text("café", cx);
+                window.focus(&input.focus_handle, cx);
+                input
+            });
+            cx.update_window(handle.into(), |_, window, cx| window.draw(cx).clear())
+                .unwrap();
+            cx.simulate_keystrokes(handle.into(), "shift-backspace");
+            handle
+                .update(cx, |input, _, cx| {
+                    assert_eq!(input.text(), "caf", "{context}");
+                    input.set_text("hello world", cx);
+                    input.move_to(6, cx);
+                    input.extend_selection(11, cx);
+                })
+                .unwrap();
+            cx.simulate_keystrokes(handle.into(), "shift-backspace");
+            handle
+                .update(cx, |input, _, cx| {
+                    assert_eq!(input.text(), "hello ", "{context}");
+                    input.set_text("", cx);
+                })
+                .unwrap();
+            cx.simulate_keystrokes(handle.into(), "shift-backspace");
+            assert_eq!(
+                handle
+                    .read_with(cx, |input, _| input.text().to_owned())
+                    .unwrap(),
+                ""
+            );
+        }
+    }
+
     #[gpui::test]
     fn dock_morph_restores_skinny_height_with_a_continuous_editor_origin(
         cx: &mut gpui::TestAppContext,
```

---

### Incident Patch 5: `e94c49ad` (2026-10-02)
**Commit Message**: Fix compact model picker browsing across providers (#749)

**File**: `crates/ui/src/pickers.rs` (modified, +29/-8)
```diff
@@ -8140,13 +8140,16 @@ mod tests {
                     Loadable::Ready(vec![bare_model("claude", "Claude model")]),
                 );
                 picker.catalog_rev += 1;
-                // The list holds one provider's models; the provider page
-                // switches to the newly loaded one.
-                assert_eq!(picker.model_rows_len(cx), 1);
-                picker.pick_compact_provider(HarnessId::ClaudeCode, cx);
+                // A provider's models become directly selectable when its
+                // catalog finishes loading; no provider-page detour is needed.
+                assert_eq!(picker.model_rows_len(cx), 2);
+                assert_eq!(picker.model_rows(cx)[1].harness, HarnessId::ClaudeCode);
+                picker.activate_model_index(1, cx);
+                assert_eq!(picker.resolved(cx).harness, Some(HarnessId::ClaudeCode));
+                assert_eq!(picker.resolved(cx).model.as_deref(), Some("claude"));
                 picker.show_compact_models(cx);
-                assert_eq!(picker.model_rows_len(cx), 1);
-                assert_eq!(picker.model_rows(cx)[0].harness, HarnessId::ClaudeCode);
+                assert_eq!(picker.model_rows_len(cx), 2);
+                assert_eq!(picker.model_rows(cx)[picker.active].harness, HarnessId::ClaudeCode);
             })
             .unwrap();
     }
@@ -8314,10 +8317,25 @@ mod tests {
             .update(cx, |picker, window, cx| {
                 picker.open_model_menu(window, cx);
                 assert!(!picker.compact_model_list);
-                // The list holds the current provider's models only.
+                // Models from every offered provider are directly selectable.
                 picker.show_compact_models(cx);
-                assert_eq!(picker.model_rows_len(cx), 1);
+                assert_eq!(picker.model_rows_len(cx), 2);
                 assert_eq!(picker.model_rows(cx)[0].harness, HarnessId::Codex);
+                assert_eq!(picker.model_rows(cx)[1].harness, HarnessId::ClaudeCode);
+                // Searching must also find another provider's model.
+                picker.search.update(cx, |input, cx| input.set_text("Claude", cx));
+                assert_eq!(picker.model_rows_len(cx), 1);
+                assert_eq!(picker.model_rows(cx)[0].harness, HarnessId::ClaudeCode);
+                picker.activate_model_index(0, cx);
+                assert!(!picker.compact_model_list);
+                assert_eq!(picker.resolved(cx).harness, Some(HarnessId::ClaudeCode));
+                assert_eq!(picker.resolved(cx).model.as_deref(), Some("claude-model"));
+                picker.pick_harness(HarnessId::Codex, cx);
+                // Clicking a foreign-provider row works without a search too.
+                picker.show_compact_models(cx);
+                picker.activate_model_index(1, cx);
+                assert_eq!(picker.resolved(cx).harness, Some(HarnessId::ClaudeCode));
+                picker.pick_harness(HarnessId::Codex, cx);
                 // The provider page lists every provider, highlighting the
                 // current one, and a pick lands back on the panel.
                 picker.show_compact_providers(cx);
@@ -8339,6 +8357,9 @@ mod tests {
                 picker.show_compact_models(cx);
                 assert_eq!(picker.model_rows_len(cx), 1);
                 assert_eq!(picker.rail_descriptors(cx)[0].id, HarnessId::Codex);
+                picker.search.update(cx, |input, cx| input.set_text("Claude", cx));
+                assert_eq!(picker.model_rows_len(cx), 0);
+                picker.search.update(cx, |input, cx| input.set_text("", cx));
                 // A chat's provider is fixed: the provider page stays shut.
                 picker.compact_model_list = false;
                 picker.show_compact_providers(cx);
```

**File**: `crates/ui/src/pickers/compact.rs` (modified, +9/-2)
```diff
@@ -322,8 +322,15 @@ impl Pickers {
     }
 
     pub(super) fn show_compact_models(&mut self, cx: &mut Context<Self>) {
-        // The provider button picks the provider; the list holds its models.
-        self.show_compact_list(ModelRail::Harness, "Search models…", cx);
+        // Browse every offered provider, just as the standard picker's rail
+        // allows. rail_descriptors still limits existing chats to their provider.
+        // A foreign-provider row switches the provider before picking its model.
+        let rail = if self.harness_locked(cx) {
+            ModelRail::Harness
+        } else {
+            ModelRail::All
+        };
+        self.show_compact_list(rail, "Search models…", cx);
     }
 
     /// The starred models across providers, opened from the provider page.
```

---

### Incident Patch 6: `c14d4579` (2026-10-02)
**Commit Message**: Let the composer's session branch label use free width and fade on overflow (#744)

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `crates/ui/src/pickers.rs` (modified, +26/-7)
```diff
@@ -3078,13 +3078,31 @@ impl Pickers {
     /// A read-only footer label (locked sessions — t3code's
     /// `resolveLockedWorkspaceLabel` span).
     fn footer_label(icon_path: &'static str, label: SharedString, theme: &Theme) -> gpui::Div {
+        Self::footer_label_shell(icon_path, theme)
+            .max_w(px(160.0))
+            .child(div().min_w_0().truncate().child(label))
+    }
+
+    /// A [`Self::footer_label`] that takes whatever width the row leaves it
+    /// and fades its tail only when that isn't enough.
+    fn footer_faded_label(
+        id: &'static str,
+        icon_path: &'static str,
+        label: SharedString,
+        theme: &Theme,
+    ) -> gpui::Div {
+        Self::footer_label_shell(icon_path, theme).child(crate::shell::sidebar_faded_label(
+            id.into(),
+            false,
+            label,
+        ))
+    }
+
+    fn footer_label_shell(icon_path: &'static str, theme: &Theme) -> gpui::Div {
         div()
             .h(px(20.0))
-            // Four of these share one row now (device, project, checkout,
-            // ref): cap each early and let them SHRINK (`min_w_0`) — without
-            // it the clusters overflowed into each other and the labels
-            // painted overlapped (user report).
-            .max_w(px(160.0))
+            // Labels SHRINK (`min_w_0`) — without it the clusters overflowed
+            // into each other and the labels painted overlapped (user report).
             .min_w_0()
             .flex()
             .flex_row()
@@ -3097,9 +3115,9 @@ impl Pickers {
             .child(
                 crate::icons::icon(icon_path)
                     .size(px(12.0))
+                    .flex_none()
                     .text_color(theme.text_muted.opacity(0.6)),
             )
-            .child(div().min_w_0().truncate().child(label))
     }
 
     /// New-session destination controls. Machine and project form the
@@ -3309,7 +3327,8 @@ impl Pickers {
                 .items_center()
                 .gap(px(4.0))
                 .min_w_0()
-                .child(Self::footer_label(
+                .child(Self::footer_faded_label(
+                    "composer-session-branch",
                     crate::icons::GIT_BRANCH,
                     chat.branch
                         .clone()
```

---

### Incident Patch 7: `ae4181f5` (2026-10-02)
**Commit Message**: Fix the compact panel's model name; test settings survive navigation (#721)

The compact panel and composer chip now name the selected model through one resolver, so the panel no longer reads "Select model" while the chip names the pick. Adds a regression test for settings toggles surviving navigation saves (fixed in #591).

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `crates/ui/src/pickers.rs` (modified, +109/-12)
```diff
@@ -360,6 +360,20 @@ pub fn browser_rows(listing: &FolderListing) -> Vec<&zeron_proto::FolderEntry> {
 /// the first Down lands on row 0.
 const NO_ACTIVE_ROW: usize = usize::MAX;
 
+/// What names the selected model, shared by the composer chip and the
+/// compact panel so the two never disagree about it.
+#[derive(Clone, Debug, PartialEq, Eq)]
+enum ModelName {
+    /// The catalog row's label, else the remembered pick's, else the id.
+    Named(SharedString),
+    /// Nothing names it yet, but the harness or model catalog that would
+    /// is still on its way.
+    Loading,
+    /// Nothing offers a model: no agents at all, or a provider whose
+    /// catalog came back empty or failed with no pick remembered.
+    None { no_agents: bool },
+}
+
 /// Which pane the harness/model picker's icon rail is showing (t3code
 /// ModelPickerContent `selectedInstanceId | "favorites"`). `Harness` means
 /// "the effective harness's list" — the rail has no browse-without-commit
@@ -986,6 +1000,27 @@ impl Pickers {
         selected_catalog_model(models, selected)
     }
 
+    fn model_name(&self, cx: &App) -> ModelName {
+        if self.no_agents_available() && self.effective_harness(cx).is_none() {
+            return ModelName::None { no_agents: true };
+        }
+        if let Some(label) = self.selected_model_label(cx) {
+            return ModelName::Named(label.into());
+        }
+        let catalog_loading = matches!(self.harnesses, Loadable::Idle | Loadable::Loading);
+        let models_loading = self.effective_harness(cx).is_some_and(|harness| {
+            !matches!(
+                self.models.get(&harness),
+                Some(Loadable::Ready(_)) | Some(Loadable::Error(_))
+            )
+        });
+        if catalog_loading || models_loading {
+            ModelName::Loading
+        } else {
+            ModelName::None { no_agents: false }
+        }
+    }
+
     fn selected_model_label(&self, cx: &App) -> Option<String> {
         self.selected_model(cx)
             .map(|model| model.label.clone())
@@ -5740,6 +5775,7 @@ impl Render for Pickers {
         // loaded, so that's a conclusion, not a loading gap) — the chip says
         // so instead of wearing a brand mark for an agent that can't run.
         let no_agents = self.no_agents_available() && self.effective_harness(cx).is_none();
+        let model_name = self.model_name(cx);
         let model_label: SharedString = if let Some(title) = &self.title {
             // The saved choice, not the tab being browsed.
             match (title.harness, title.model.as_deref()) {
@@ -5755,19 +5791,14 @@ impl Render for Pickers {
                     .unwrap_or_else(|| id.to_owned())
                     .into(),
             }
-        } else if no_agents {
-            SharedString::from("No agents available")
         } else {
-            let label = self.selected_model_label(cx);
-            label.map(SharedString::from).unwrap_or_default()
+            match &model_name {
+                ModelName::Named(label) => label.clone(),
+                ModelName::None { no_agents: true } => "No agents available".into(),
+                ModelName::Loading | ModelName::None { .. } => SharedString::default(),
+            }
         };
         let catalog_loading = matches!(self.harnesses, Loadable::Idle | Loadable::Loading);
-        let models_loading = self.effective_harness(cx).is_some_and(|harness| {
-            !matches!(
-                self.models.get(&harness),
-                Some(Loadable::Ready(_)) | Some(Loadable::Error(_))
-            )
-        });
         // Harness unknown while the catalog resolves: the pixel-glyph loader
         // instead of guessing a brand mark.
         let chip_icon_loading = self.title.is_none()
@@ -5776,8 +5807,7 @@ impl Render for Pickers {
             && catalog_loading;
         // Harness known but nothing names the model yet (fresh install, no
         // remembered pick): a ghost label instead of a bare icon.
-        let chip_label_loading =
-            !no_agents && model_label.is_empty() && (catalog_loading || models_loading);
+        let chip_label_loading = self.title.is_none() && model_name == ModelName::Loading;
         let chip_harness = match &self.title {
             Some(title) => title.harness,
             None => self.effective_harness(cx),
@@ -7713,6 +7743,73 @@ mod tests {
             supports_steering: false,
         }
     }
+    #[gpui::test]
+    fn model_name_never_reads_select_model_while_anything_can_still_name_it(
+        cx: &mut gpui::TestAppContext,
+    ) {
+        let dir = tempfile::tempdir().unwrap();
+        cx.update(|cx| {
+            cx.set_global(Theme::dark());
+            let mut settings = crate::settings::UiSettings::default();
+            settings.compact_model_picker = true;
+            crate::settings::init(settings, dir.path(), cx);
+        });
+        let handle = cx.add_window(|_, cx| {
+            let state = cx.new
```

**File**: `crates/ui/src/pickers/compact.rs` (modified, +23/-6)
```diff
@@ -624,6 +624,17 @@ impl Pickers {
             .map(|o| o.id.clone())
     }
 
+    /// The panel's title for a [`ModelName`]. Loading also draws a ghost
+    /// bar in the name's place, as the composer chip does.
+    fn compact_title_text(name: &ModelName) -> SharedString {
+        match name {
+            ModelName::Named(label) => label.clone(),
+            ModelName::Loading => "Loading models…".into(),
+            ModelName::None { no_agents: true } => "No agents available".into(),
+            ModelName::None { .. } => "Select model".into(),
+        }
+    }
+
     /// The slider's stops: the model's reasoning ladder, else an option
     /// shaped like one (Cursor's `effort`/`reasoning` choices), so every
     /// model with an effort gets the same slider.
@@ -883,11 +894,17 @@ impl Pickers {
         let (levels, selected) = self
             .compact_effort(cx)
             .map_or((Vec::new(), 0), |e| (e.labels, e.selected));
-        let label: SharedString = self
-            .selected_model(cx)
-            .map(|m| m.label.clone())
-            .unwrap_or_else(|| "Select model".into())
-            .into();
+        let name = self.model_name(cx);
+        let label = Self::compact_title_text(&name);
+        let name_element: AnyElement = if name == ModelName::Loading {
+            popover::skeleton_bar(72.0, cx.entity_id(), cx)
+        } else {
+            div()
+                .min_w_0()
+                .truncate()
+                .child(label.clone())
+                .into_any_element()
+        };
         let effort: SharedString = levels
             .get(selected)
             .cloned()
@@ -985,7 +1002,7 @@ impl Pickers {
                                 .text_color(motion::mix(theme.text_muted, theme.text, hover))
                         }
                     })
-                    .child(div().min_w_0().truncate().child(label.clone()))
+                    .child(name_element)
                     .child(
                         // Leans 3pt toward the list and firms up on hover.
                         div()
```

**File**: `crates/ui/src/shell.rs` (modified, +68/-0)
```diff
@@ -14583,6 +14583,74 @@ mod exit_regressions {
         }
     }
 
+    #[gpui::test]
+    fn shell_saves_never_revert_settings_written_outside_the_shell(cx: &mut TestAppContext) {
+        let dir = tempfile::tempdir().unwrap();
+        cx.update(|cx| {
+            gpui_base::init(cx);
+            cx.set_global(Theme::default());
+            crate::app_menus::init(cx);
+            crate::history::init(
+                Default::default(),
+                Default::default(),
+                Default::default(),
+                Default::default(),
+                cx,
+            );
+            settings::init(settings::UiSettings::default(), dir.path(), cx);
+        });
+        let window = cx.add_window(|_, cx| {
+            let state = cx.new(|_| AppState::new());
+            Shell::new(
+                state,
+                EngineBootConfig {
+                    data_dir: dir.path().into(),
+                    ipc_port: 0,
+                    edge_url: "http://127.0.0.1:1".into(),
+                    edge_token: None,
+                    org_id: None,
+                    workos_client_id: None,
+                    default_harness: zeron_proto::HarnessId::Mock,
+                },
+                cx,
+            )
+        });
+        let before = cx.update(|cx| settings::current(cx));
+        window
+            .update(cx, |shell, _, cx| {
+                // Toggles that write the store directly (the General page's
+                // Compact mode, notification and sidebar switches, ...).
+                settings::set_transcript_compact_mode(!before.transcript_compact_mode, cx);
+                settings::update(SavePolicy::Immediate, cx, |s| {
+                    s.notifications_enabled = !before.notifications_enabled;
+                    s.sidebar_show_branch = !before.sidebar_show_branch;
+                    s.escape_stops_active_agent = !before.escape_stops_active_agent;
+                });
+                // Navigating away saves the shell's own working copy.
+                shell.remember_settings_section(SettingsSection::Notifications, cx);
+                // The shell's own writes still land.
+                shell.settings.sidebar_width += 10.0;
+                shell.schedule_save(cx);
+            })
+            .unwrap();
+        let after = cx.update(|cx| settings::current(cx));
+        assert_eq!(
+            after.transcript_compact_mode,
+            !before.transcript_compact_mode
+        );
+        assert_eq!(after.notifications_enabled, !before.notifications_enabled);
+        assert_eq!(after.sidebar_show_branch, !before.sidebar_show_branch);
+        assert_eq!(
+            after.escape_stops_active_agent,
+            !before.escape_stops_active_agent
+        );
+        assert_eq!(
+            after.settings_section,
+            SettingsSection::Notifications.canonical()
+        );
+        assert_eq!(after.sidebar_width, before.sidebar_width + 10.0);
+    }
+
     #[gpui::test]
     fn workspace_slash_commands_open_existing_zeron_surfaces(cx: &mut TestAppContext) {
         use crate::composer::WorkspaceCommand;
```

---

### Incident Patch 8: `27480d99` (2026-10-01)
**Commit Message**: OpenCode 2.x: fix instant "Run failed" (cold version probe), show start failures (#686)

* OpenCode: show start failures and stop failing runs on an unknown version

A run whose harness fails before streaming only reached the live journal,
so the chat showed "Run failed" with no assistant entry and no reason.
The engine now writes the error as an assistant entry.

OpenCode runs (not discovery) probe `opencode --version` to pick the MCP
config shape, and that probe's failure is cached per binary. One slow or
unparseable probe made every later run fail at startup until restart.
An unknown version now starts the server without the Zeron MCP block
and logs a warning.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* OpenCode: retry a cold version probe; own both password variables

Root cause of the instant "Run failed" on OpenCode 2.x: runs probe
`opencode --version` (2s cap) to pick the MCP config shape, and the
shared probe caches a timeout for the binary's lifetime. A freshly
upgraded binary's first exec waits on the OS malware scan (1.1s on an
M-series Mac, more on slower machines or under Defender), so one slow
probe failed every later run in ~100ms until restart. Reproduced

**File**: `crates/engine/src/sessions.rs` (modified, +19/-0)
```diff
@@ -1892,6 +1892,25 @@ async fn drive_run(
         Ok(stream) => stream,
         Err(err) => {
             let message = err.to_string();
+            tracing::warn!(chat = %chat_id, harness = ?harness_id, error = %message, "run failed to start");
+            // The journal alone is live-only: without an entry the transcript
+            // shows "Run failed" with no reason (an OpenCode server that never
+            // booted looked exactly like that).
+            let parts = [MessagePart::Error {
+                id: "e0".into(),
+                message: message.clone(),
+            }];
+            if let Err(err) = finish_segment(
+                &doc,
+                None,
+                &new_id(),
+                &device_id,
+                now_ms(),
+                &parts,
+                MessageStatus::Complete,
+            ) {
+                tracing::warn!(chat = %chat_id, error = %err, "start failure entry failed");
+            }
             inner.publish(
                 &chat_id,
                 &AgentEvent::Error {
```

**File**: `crates/engine/tests/e2e.rs` (modified, +64/-0)
```diff
@@ -3223,3 +3223,67 @@ async fn real_image_generation_profile_smoke() {
     );
     core.sessions.shutdown().await;
 }
+
+/// A harness that fails before streaming (an OpenCode server that never
+/// booted) must leave its reason in the transcript, not only a bare
+/// "Run failed" status.
+#[tokio::test(flavor = "multi_thread")]
+async fn start_failure_lands_in_the_transcript() {
+    struct FailsToStart;
+    #[async_trait]
+    impl Harness for FailsToStart {
+        fn id(&self) -> HarnessId {
+            HarnessId::Mock
+        }
+        fn display_name(&self) -> &str {
+            "FailsToStart"
+        }
+        fn supports_steering(&self) -> bool {
+            false
+        }
+        fn steering_mode(&self) -> SteeringMode {
+            SteeringMode::TurnBoundary
+        }
+        fn reasoning_levels(&self) -> &[ReasoningLevel] {
+            &[]
+        }
+        async fn models(&self) -> Result<Vec<Model>, HarnessError> {
+            Ok(vec![])
+        }
+        async fn run(
+            &self,
+            _request: RunRequest,
+            _controls: RunControls,
+        ) -> Result<BoxStream<'static, Result<AgentEvent, HarnessError>>, HarnessError> {
+            Err(HarnessError::Protocol("server never booted".into()))
+        }
+    }
+
+    let dir = tempfile::tempdir().unwrap();
+    let core = assemble(dir.path(), Arc::new(FailsToStart));
+    let handle = core.doc_host.open(CHAT).unwrap();
+    queue_as_viewer(
+        handle.doc(),
+        "cmd-run-fails",
+        SessionCommandPayload::Run {
+            request: run_request("hello"),
+            message_id: "m-1".into(),
+        },
+    );
+    wait_for(
+        || core.sessions.session_status(CHAT).map(|s| s.status) == Some(SessionStatus::Errored),
+        "errored",
+    )
+    .await;
+    let entries = entries_now(&core);
+    let assistant = entries
+        .iter()
+        .find(|e| e.role == MessageRole::Assistant)
+        .expect("assistant entry for the failed start");
+    assert_eq!(assistant.status, Some(MessageStatus::Complete));
+    assert!(matches!(
+        assistant.parts.as_slice(),
+        [MessagePart::Error { message, .. }] if message.contains("server never booted")
+    ));
+    core.sessions.shutdown().await;
+}
```

**File**: `crates/harness/src/executable.rs` (modified, +1/-1)
```diff
@@ -276,7 +276,7 @@ pub fn binary_version(path: &Path) -> Option<semver::Version> {
     version
 }
 
-fn parse_version(bytes: &[u8]) -> Option<semver::Version> {
+pub(crate) fn parse_version(bytes: &[u8]) -> Option<semver::Version> {
     String::from_utf8_lossy(bytes)
         .split_whitespace()
         .find_map(|word| {
```

**File**: `crates/harness/src/opencode/mod.rs` (modified, +168/-24)
```diff
@@ -605,33 +605,35 @@ impl Server {
             .arg(port.to_string())
             .arg("--hostname")
             .arg("127.0.0.1")
+            // 2.x prefers OPENCODE_PASSWORD over the legacy name; a user's
+            // own value would otherwise lock us out of our server (401).
+            .env("OPENCODE_PASSWORD", &password)
             .env("OPENCODE_SERVER_PASSWORD", &password)
             .env("OPENCODE_CLIENT", "zeron");
         if let Some(mcp) = mcp {
-            let version_exe = exe.to_path_buf();
-            let version = tokio::task::spawn_blocking(move || {
-                crate::executable::binary_version(&version_exe)
-            })
-            .await
-            .map_err(|e| HarnessError::Protocol(format!("opencode version probe: {e}")))?
-            .ok_or_else(|| {
-                HarnessError::Protocol(
-                    "cannot determine opencode version for MCP configuration".into(),
-                )
-            })?;
-            let protocol = if version.major >= 2 {
-                Protocol::V2
-            } else {
-                Protocol::V1
-            };
-            cmd.env(
-                "OPENCODE_CONFIG_CONTENT",
-                mcp_config(
-                    std::env::var("OPENCODE_CONFIG_CONTENT").ok().as_deref(),
-                    mcp,
-                    protocol,
-                )?,
-            );
+            // The config shape differs by generation. If even the cold probe
+            // can't tell, run without the Zeron MCP server rather than fail.
+            match opencode_version(exe).await {
+                Some(version) => {
+                    let protocol = if version.major >= 2 {
+                        Protocol::V2
+                    } else {
+                        Protocol::V1
+                    };
+                    cmd.env(
+                        "OPENCODE_CONFIG_CONTENT",
+                        mcp_config(
+                            std::env::var("OPENCODE_CONFIG_CONTENT").ok().as_deref(),
+                            mcp,
+                            protocol,
+                        )?,
+                    );
+                }
+                None => tracing::warn!(
+                    binary_path = %exe.display(),
+                    "opencode version unknown; starting without the Zeron MCP server"
+                ),
+            }
         }
         crate::compose_child_path(&mut cmd, exe);
         if let Some(cwd) = cwd {
@@ -4234,6 +4236,46 @@ mod context_tests {
     }
 }
 
+/// Budget for a `--version` the shared probe gave up on: a freshly installed
+/// binary's first exec waits on the OS malware scan (1.1s on an M-series Mac
+/// for 2.0.20, longer on slower machines and under Windows Defender).
+const COLD_VERSION_TIMEOUT: Duration = Duration::from_secs(30);
+
+/// The shared probe caps `--version` at 2s and caches a timeout for the
+/// binary's lifetime, so one cold first exec after an upgrade failed every
+/// later run instantly until restart. Retry past that cache with a longer
+/// budget, and on success clear the cached failure for other callers.
+async fn opencode_version(exe: &std::path::Path) -> Option<semver::Version> {
+    let cached_exe = exe.to_path_buf();
+    let cached =
+        tokio::task::spawn_blocking(move || crate::executable::binary_version(&cached_exe))
+            .await
+            .ok()
+            .flatten();
+    if cached.is_some() {
+        return cached;
+    }
+    let mut cmd = Command::new(exe);
+    cmd.arg("--version")
+        .stdin(Stdio::null())
+        .stdout(Stdio::piped())
+        .stderr(Stdio::piped())
+        .kill_on_drop(true);
+    let output = tokio::time::timeout(COLD_VERSION_TIMEOUT, cmd.output())
+        .await
+        .ok()?
+        .ok()?;
+    if !output.status.success() {
+        return None;
+    }
+    let version = crate::executable::parse_version(&output.stdout)
+        .or_else(|| crate::executable::parse_version(&output.stderr))?;
+    if let Some(stem) = exe.file_stem().and_then(|s| s.to_str()) {
+        crate::executable::invalidate_versions(&[stem]);
+    }
+    Some(version)
+}
+
 /// Inline config is the final user config layer. Preserve inherited overrides
 /// and other MCP servers; never write chat identity into a shared config file.
 fn mcp_config(
@@ -4346,6 +4388,108 @@ http.createServer((req, res) => {{
         }
     }
 
+    #[cfg(unix)]
+    #[tokio::test]
+    async fn unknown_version_starts_without_mcp_instead_of_failing() {
+        use std::os::unix::fs::PermissionsExt;
+        let fixture = tempfile::tempdir().unwrap();
+        let exe = fixture.path().join("opencode");
+        // `--version` fails (a probe that timed out or printed no version).
+        let script = r#"#!/usr/bin/env node
+const http = require('node:http');
+if (process.argv.includes('--version')) process.exit(1);
+const config = process.env.OPENCODE_CONFIG_CONTENT ?? null;
+const port = Number(process.argv
```

---

### Incident Patch 9: `0f7ae6f4` (2026-10-01)
**Commit Message**: Merge pull request #694 from katulevskiy/ci-linux-fast

CI: run Linux tests with nextest on a dev profile, one shared build

**File**: `.github/actions/linux-ci/action.yml` (added, +80/-0)
```diff
@@ -0,0 +1,80 @@
+name: Linux Rust CI setup
+description: >-
+  Rust toolchain, cargo-nextest, optional apt packages (with a cached .deb
+  directory) and the main-seeded Rust cache for Linux test jobs. Run
+  actions/checkout first.
+
+inputs:
+  rust-cache:
+    description: >-
+      rust-cache shared key. Jobs with the same key share one cache, so they
+      must have the same dependency graph.
+    required: true
+  save-rust-cache:
+    description: >-
+      Whether this job may save the cache when it runs on main. Give it to
+      exactly one job per key. Pull requests never save.
+    default: 'false'
+  apt-packages:
+    description: apt packages to install (space separated). Nothing is installed when empty.
+    default: ''
+  apt-cache:
+    description: Name of the cached .deb directory for apt-packages (one per package list).
+    default: ''
+  apt-recommends:
+    description: Install recommended packages too ('true' or 'false').
+    default: 'false'
+
+runs:
+  using: composite
+  steps:
+    - name: Rust toolchain
+      shell: bash
+      run: rustup show active-toolchain || rustup toolchain install
+
+    # apt mirrors on hosted runners occasionally stall for minutes; apt-install.sh
+    # bounds and retries the download and uses a directory of .debs that main
+    # saves to the cache (pull requests only restore it).
+    - name: Restore apt packages
+      id: apt-cache
+      if: inputs.apt-packages != ''
+      uses: actions/cache/restore@v4
+      with:
+        path: ~/apt-debs/*.deb
+        key: apt-debs-v1-${{ inputs.apt-cache }}-${{ hashFiles('scripts/ci/apt-install.sh') }}
+    - name: Install system packages
+      if: inputs.apt-packages != ''
+      shell: bash
+      env:
+        APT_RECOMMENDS: ${{ inputs.apt-recommends == 'true' && '1' || '0' }}
+        APT_PACKAGES: ${{ inputs.apt-packages }}
+      run: |
+        # shellcheck disable=SC2086 # the package list is word-split on purpose
+        bash scripts/ci/apt-install.sh $APT_PACKAGES
+    - name: Save apt packages
+      if: inputs.apt-packages != '' && github.ref == 'refs/heads/main' && steps.apt-cache.outputs.cache-hit != 'true'
+      uses: actions/cache/save@v4
+      with:
+        path: ~/apt-debs/*.deb
+        key: apt-debs-v1-${{ inputs.apt-cache }}-${{ hashFiles('scripts/ci/apt-install.sh') }}
+
+    # Exported for the rest of the job. Tests and the browser fixture are built in
+    # the dev profile without debug info (smaller, faster to link). CARGO_* variables
+    # are part of the rust-cache key, so every job sharing a cache must set the same.
+    - name: Build settings
+      shell: bash
+      run: echo "CARGO_PROFILE_DEV_DEBUG=0" >> "$GITHUB_ENV"
+
+    - uses: Swatinem/rust-cache@v2
+      with:
+        prefix-key: ci-linux-v1
+        shared-key: ${{ inputs.rust-cache }}
+        add-job-id-key: false
+        save-if: ${{ inputs.save-rust-cache == 'true' && github.ref == 'refs/heads/main' }}
+        cache-on-failure: true
+
+    # After the cache restore, so the checksum-verified binary is the one that
+    # runs (rust-cache restores ~/.cargo/bin).
+    - name: Install cargo-nextest
+      shell: bash
+      run: bash scripts/ci/install-nextest.sh
```

**File**: `.github/workflows/cursor-compatibility.yml` (modified, +18/-15)
```diff
@@ -32,10 +32,6 @@ jobs:
       - uses: actions/setup-node@v4
         with:
           node-version: '22'
-      - uses: Swatinem/rust-cache@v2
-        with:
-          save-if: ${{ github.ref == 'refs/heads/main' }}
-          cache-on-failure: true
       - name: Dependency updater validation
         run: python3 scripts/test-update-cursor-sdk.py
       - name: Install the exact SDK selected by this engine
@@ -44,14 +40,21 @@ jobs:
           npm install --prefix "$RUNNER_TEMP/cursor-sdk-contract" --ignore-scripts --no-audit --no-fund "$pin"
       - name: Actual SDK token expiry, stream invalidation, and transient auth recovery
         run: node scripts/test-cursor-sdk-auth.mjs "$RUNNER_TEMP/cursor-sdk-contract/node_modules/@cursor/sdk"
-      - name: Harness compatibility, steering, and session recovery
-        run: cargo test --locked -p zeron-harness
-      - name: Durable commands and engine message delivery
-        run: |
-          cargo test --locked -p zeron-doc
-          cargo test --locked -p zeron-engine --test message_queue
-          cargo test --locked -p zeron-engine --lib sessions::tests
-      - name: Native Pi RPC driver
-        run: |
-          cargo test --locked -p zeron-harness --features native-fixture --test pi_rpc
-          cargo test --locked -p zeron-engine --test pi_resume
+
+  # The Rust half (harness compatibility, steering, session recovery, durable
+  # commands, message delivery, native Pi RPC) is part of the `core-tests` job
+  # of ui-tests.yml, which already runs on pull requests and on main with a
+  # superset of this workflow's paths. Run it here only for the callers that
+  # do not get that: release.yml (tag push), cursor-sdk-update.yml (manual
+  # dispatch on the update branch) and manual runs.
+  rust-tests:
+    if: ${{ github.event_name != 'pull_request' && !(github.event_name == 'push' && github.ref == 'refs/heads/main') }}
+    runs-on: ubuntu-24.04
+    timeout-minutes: 30
+    steps:
+      - uses: actions/checkout@v4
+      - uses: ./.github/actions/linux-ci
+        with:
+          rust-cache: core # saved by core-tests in ui-tests.yml
+      - name: Harness, engine, sync, update, doc and preview tests
+        run: scripts/ci/test-core.sh
```

**File**: `.github/workflows/linux-installer.yml` (modified, +5/-3)
```diff
@@ -6,6 +6,7 @@ on:
       - 'edge/src/install.sh'
       - 'scripts/package-linux.sh'
       - 'scripts/test-linux-desktop-entry.sh'
+      - 'scripts/ci/apt-install.sh'
       - 'dist/zeron.desktop'
       - 'dist/zeron.png'
       - '.github/workflows/linux-installer.yml'
@@ -15,6 +16,7 @@ on:
       - 'edge/src/install.sh'
       - 'scripts/package-linux.sh'
       - 'scripts/test-linux-desktop-entry.sh'
+      - 'scripts/ci/apt-install.sh'
       - 'dist/zeron.desktop'
       - 'dist/zeron.png'
       - '.github/workflows/linux-installer.yml'
@@ -34,9 +36,9 @@ jobs:
     steps:
       - uses: actions/checkout@v4
       - name: Desktop entry validator
-        run: |
-          sudo apt-get update -qq -o Dir::Etc::sourcelist="sources.list.d/ubuntu.sources" -o Dir::Etc::sourceparts="-"
-          sudo apt-get install -y -qq desktop-file-utils
+        # Skips apt when the runner image already has it; otherwise the install
+        # retries and is bounded instead of hanging on a stalled mirror.
+        run: command -v desktop-file-validate || bash scripts/ci/apt-install.sh desktop-file-utils
       # Both installers, offline, under a throwaway HOME (no network, no systemd).
       - name: Installers write a valid launcher entry
         run: scripts/test-linux-desktop-entry.sh
```

**File**: `.github/workflows/preview-tests.yml` (modified, +3/-1)
```diff
@@ -11,10 +11,12 @@ concurrency:
   group: preview-tests-${{ github.ref }}
   cancel-in-progress: ${{ github.event_name == 'pull_request' }}
 jobs:
+  # The Linux leg runs in the `core-tests` job of ui-tests.yml (same tests, one
+  # shared build with the rest of the Rust tests).
   networking:
     strategy:
       matrix:
-        os: [ubuntu-latest, macos-latest]
+        os: [macos-latest]
     runs-on: ${{ matrix.os }}
     timeout-minutes: 30
     steps:
```

**File**: `.github/workflows/release-profile-tests.yml` (added, +47/-0)
```diff
@@ -0,0 +1,47 @@
+name: Release-profile tests
+
+# Pull-request and main CI test the dev profile (fast rebuilds). This runs the
+# same Linux suites once a day against the optimized release profile that
+# ships, so optimization-only failures still surface. It does not save a Rust
+# cache, so it cannot evict the main-seeded caches pull requests depend on.
+
+on:
+  schedule:
+    - cron: '17 7 * * *'
+  workflow_dispatch:
+
+permissions:
+  contents: read
+
+concurrency:
+  group: release-profile-tests
+  cancel-in-progress: false
+
+jobs:
+  core-tests:
+    runs-on: ubuntu-24.04
+    timeout-minutes: 60
+    steps:
+      - uses: actions/checkout@v4
+      - uses: ./.github/actions/linux-ci
+        with:
+          rust-cache: release-profile-core
+      - name: Harness, engine, sync, update, doc and preview tests (release)
+        run: scripts/ci/test-core.sh --release
+
+  ui-tests:
+    runs-on: ubuntu-24.04
+    timeout-minutes: 60
+    steps:
+      - uses: actions/checkout@v4
+      - uses: ./.github/actions/linux-ci
+        with:
+          rust-cache: release-profile-ui
+          apt-cache: gpui
+          apt-packages: >-
+            libxkbcommon-dev libxkbcommon-x11-dev libwayland-dev
+            libx11-dev libxcb1-dev libx11-xcb-dev
+            libfontconfig1-dev libfreetype-dev libasound2-dev
+            libvulkan-dev pkg-config cmake libwebkit2gtk-4.1-dev libjson-glib-dev
+      - name: UI and headless layout regressions (release)
+        run: cargo nextest run --config-file scripts/ci/nextest.toml --locked --no-fail-fast --release -p zeron-ui --lib
```

**File**: `.github/workflows/ui-tests.yml` (modified, +41/-47)
```diff
@@ -7,6 +7,10 @@ on:
       - 'Cargo.lock'
       - 'rust-toolchain.toml'
       - 'crates/**'
+      - '.github/actions/linux-ci/**'
+      - 'scripts/ci/**'
+      - 'scripts/*cursor-sdk*'
+      - '.github/workflows/cursor-*.yml'
       - 'scripts/test-linux-browser.sh'
       - 'scripts/run-macos-browser-fixture.sh'
       - 'dist/macos/Info.plist'
@@ -19,6 +23,10 @@ on:
       - 'Cargo.lock'
       - 'rust-toolchain.toml'
       - 'crates/**'
+      - '.github/actions/linux-ci/**'
+      - 'scripts/ci/**'
+      - 'scripts/*cursor-sdk*'
+      - '.github/workflows/cursor-*.yml'
       - 'scripts/test-linux-browser.sh'
       - 'scripts/run-macos-browser-fixture.sh'
       - 'dist/macos/Info.plist'
@@ -67,49 +75,38 @@ jobs:
             return files.some(file => affectsIOS(file.filename)
               || affectsIOS(file.previous_filename));
 
-  session-sync-regressions:
+  # Every Linux Rust test that is not UI: one build, one nextest run (see
+  # scripts/ci/test-core.sh). Replaces session-sync-regressions and the Rust
+  # steps of cursor-compatibility and preview-tests.
+  core-tests:
     runs-on: ubuntu-24.04
-    timeout-minutes: 20
+    timeout-minutes: 30
     steps:
       - uses: actions/checkout@v4
-      - name: Rust toolchain
-        run: rustup show active-toolchain || rustup toolchain install
-      - uses: Swatinem/rust-cache@v2
+      - uses: ./.github/actions/linux-ci
         with:
-          save-if: ${{ github.ref == 'refs/heads/main' }}
-          cache-on-failure: true
-      - name: OpenCode protocol and permission regressions
-        run: |
-          cargo test --locked -p zeron-harness --lib opencode::
-          cargo test --locked -p zeron-harness --test opencode
-      - name: Durable session publication and recovery
-        run: |
-          cargo test --locked -p zeron-sync --lib
-          cargo test --locked -p zeron-update --lib
-          cargo test --locked -p zeron-engine --lib --test session_publication --test restart_resume --test codex_subagents --test local_profiles
+          rust-cache: core
+          save-rust-cache: 'true'
+      - name: Harness, engine, sync, update, doc and preview tests
+        run: scripts/ci/test-core.sh
 
   ui-tests:
     runs-on: ubuntu-24.04
     timeout-minutes: 30
     steps:
       - uses: actions/checkout@v4
-      - name: GPUI system dependencies
-        run: |
-          # Only Ubuntu packages are needed; unrelated runner repositories can be out of sync.
-          sudo apt-get update -qq -o Dir::Etc::sourcelist="sources.list.d/ubuntu.sources" -o Dir::Etc::sourceparts="-"
-          sudo apt-get install -y -qq \
-            libxkbcommon-dev libxkbcommon-x11-dev libwayland-dev \
-            libx11-dev libxcb1-dev libx11-xcb-dev \
-            libfontconfig1-dev libfreetype-dev libasound2-dev \
-            libvulkan-dev pkg-config cmake libwebkit2gtk-4.1-dev libjson-glib-dev
-      - name: Rust toolchain
-        run: rustup show active-toolchain || rustup toolchain install
-      - uses: Swatinem/rust-cache@v2
+      - uses: ./.github/actions/linux-ci
         with:
-          save-if: ${{ github.ref == 'refs/heads/main' }}
-          cache-on-failure: true
+          rust-cache: ui
+          save-rust-cache: 'true'
+          apt-cache: gpui
+          apt-packages: >-
+            libxkbcommon-dev libxkbcommon-x11-dev libwayland-dev
+            libx11-dev libxcb1-dev libx11-xcb-dev
+            libfontconfig1-dev libfreetype-dev libasound2-dev
+            libvulkan-dev pkg-config cmake libwebkit2gtk-4.1-dev libjson-glib-dev
       - name: UI and headless layout regressions
-        run: cargo test --release --locked -p zeron-ui --lib -- --test-threads=1
+        run: cargo nextest run --config-file scripts/ci/nextest.toml --locked --no-fail-fast -p zeron-ui --lib
 
   macos-frame-recovery:
     runs-on: macos-latest
@@ -235,28 +232,25 @@ jobs:
     timeout-minutes: 30
     steps:
       - uses: actions/checkout@v4
-      - name: Native browser and GPUI dependencies
-        run: |
-          # Only Ubuntu packages are needed; unrelated runner repositories can be out of sync.
-          sudo apt-get update -qq -o Dir::Etc::sourcelist="sources.list.d/ubuntu.sources" -o Dir::Etc::sourceparts="-"
-          sudo apt-get install -y -qq \
-            libxkbcommon-dev libxkbcommon-x11-dev libwayland-dev \
-            libx11-dev libxcb1-dev libx11-xcb-dev libfontconfig1-dev \
-            libfreetype-dev libasound2-dev libvulkan-dev pkg-config cmake \
-            libwebkit2gtk-4.1-dev libjson-glib-dev xvfb xdotool openbox \
-            weston ffmpeg imagemagick fonts-noto-cjk
-      - name: Rust toolchain
-        run: rustup show active-toolchain || rustup toolchain install
-      - uses: Swatinem/rust-cache@v2
+      - uses: ./.github/actions/linux-ci
         with:
-          save-if: ${{ github.ref == 'refs/heads/main' }}
-          cache-on-failure: true
+          # Same dependency graph as ui-tests, which sav
```

**File**: `scripts/ci/apt-install.sh` (added, +41/-0)
```diff
@@ -0,0 +1,41 @@
+#!/usr/bin/env bash
+# Install apt packages from a user-owned, cacheable .deb directory with
+# stall-resistant retries and per-phase timestamps.
+#   usage: APT_DEB_DIR=~/apt-debs [APT_RECOMMENDS=1] apt-install.sh pkg...
+# Hosted-runner apt mirrors occasionally stall for minutes (observed 7-14 min
+# for a ~400 MB install); a bounded download retry + actions/cache of the .debs
+# makes the common case ~20 s and the bad case bounded.
+set -uo pipefail
+dir=${APT_DEB_DIR:-$HOME/apt-debs}
+mkdir -p "$dir/partial"
+export DEBIAN_FRONTEND=noninteractive
+ts() { while IFS= read -r l; do printf '[%(%T)T] %s\n' -1 "$l"; done; }
+log() { printf '[%(%T)T] apt-install: %s\n' -1 "$*"; }
+
+# No docs/man/locales, no fsync: faster unpack.
+printf '%s\n' force-unsafe-io 'path-exclude=/usr/share/doc/*' 'path-exclude=/usr/share/man/*' \
+  'path-exclude=/usr/share/locale/*' 'path-exclude=/usr/share/info/*' | sudo tee /etc/dpkg/dpkg.cfg.d/90ci >/dev/null
+sudo rm -f /var/lib/man-db/auto-update
+
+APT=(-y -o Acquire::Retries=3 -o Acquire::http::Timeout=15 -o Acquire::Languages=none
+     -o "Dir::Cache::archives=$dir" -o APT::Sandbox::User=root -o DPkg::Lock::Timeout=120)
+[ "${APT_RECOMMENDS:-0}" = 1 ] || APT+=(--no-install-recommends)
+
+log "cached debs: $(ls "$dir"/*.deb 2>/dev/null | wc -l)"
+log "update"
+# Only Ubuntu packages are needed; unrelated runner repositories can be out of sync.
+sudo timeout 120 apt-get update -qq -o Acquire::Retries=3 -o Acquire::http::Timeout=15 \
+  -o Dir::Etc::sourcelist="sources.list.d/ubuntu.sources" -o Dir::Etc::sourceparts="-" 2>&1 | ts
+
+ok=0
+for attempt in 1 2 3 4; do
+  log "download attempt $attempt"
+  sudo timeout 150 apt-get install "${APT[@]}" --download-only "$@" 2>&1 | ts
+  if [ "${PIPESTATUS[0]}" = 0 ]; then ok=1; break; fi
+done
+[ "$ok" = 1 ] || { log "download failed"; exit 1; }
+log "install"
+sudo apt-get install "${APT[@]}" -qq "$@" 2>&1 | ts
+rc=${PIPESTATUS[0]}
+log "done rc=$rc"
+exit "$rc"
```

**File**: `scripts/ci/install-nextest.sh` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+#!/usr/bin/env bash
+# Install a pinned cargo-nextest release (x86_64 Linux) after verifying its
+# SHA-256, instead of trusting a third-party install action. To bump: change
+# VERSION and SHA256 (from the release's .tar.gz asset).
+set -euo pipefail
+VERSION=0.9.146
+SHA256=682c21b777c333e96fd532e114d3a5a894e0729ab88d94c0a9f20f8419695428
+
+[ "$(uname -m)" = x86_64 ] || { echo "install-nextest.sh: x86_64 only" >&2; exit 1; }
+tmp="$(mktemp -d)"
+trap 'rm -rf "$tmp"' EXIT
+curl --proto '=https' --tlsv1.2 -fsSL --retry 5 -o "$tmp/nextest.tar.gz" \
+  "https://github.com/nextest-rs/nextest/releases/download/cargo-nextest-$VERSION/cargo-nextest-$VERSION-x86_64-unknown-linux-gnu.tar.gz"
+echo "$SHA256  $tmp/nextest.tar.gz" | sha256sum -c -
+mkdir -p "$HOME/.cargo/bin"
+tar -xzf "$tmp/nextest.tar.gz" -C "$HOME/.cargo/bin" cargo-nextest
+cargo nextest --version
```

---

### Incident Patch 10: `2249a112` (2026-10-01)
**Commit Message**: Merge ci-linux-fast (#694) into ci-macos-fast

Resolve the expected conflicts: ui-tests.yml keeps core-tests and drops the
iOS changes job (now in macos.yml) and the macOS/iOS-only path filters;
preview-tests.yml drops the networking job, whose Rust tests now run in
core-tests (Linux) and macos-native (macOS).

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.github/actions/linux-ci/action.yml` (added, +80/-0)
```diff
@@ -0,0 +1,80 @@
+name: Linux Rust CI setup
+description: >-
+  Rust toolchain, cargo-nextest, optional apt packages (with a cached .deb
+  directory) and the main-seeded Rust cache for Linux test jobs. Run
+  actions/checkout first.
+
+inputs:
+  rust-cache:
+    description: >-
+      rust-cache shared key. Jobs with the same key share one cache, so they
+      must have the same dependency graph.
+    required: true
+  save-rust-cache:
+    description: >-
+      Whether this job may save the cache when it runs on main. Give it to
+      exactly one job per key. Pull requests never save.
+    default: 'false'
+  apt-packages:
+    description: apt packages to install (space separated). Nothing is installed when empty.
+    default: ''
+  apt-cache:
+    description: Name of the cached .deb directory for apt-packages (one per package list).
+    default: ''
+  apt-recommends:
+    description: Install recommended packages too ('true' or 'false').
+    default: 'false'
+
+runs:
+  using: composite
+  steps:
+    - name: Rust toolchain
+      shell: bash
+      run: rustup show active-toolchain || rustup toolchain install
+
+    # apt mirrors on hosted runners occasionally stall for minutes; apt-install.sh
+    # bounds and retries the download and uses a directory of .debs that main
+    # saves to the cache (pull requests only restore it).
+    - name: Restore apt packages
+      id: apt-cache
+      if: inputs.apt-packages != ''
+      uses: actions/cache/restore@v4
+      with:
+        path: ~/apt-debs/*.deb
+        key: apt-debs-v1-${{ inputs.apt-cache }}-${{ hashFiles('scripts/ci/apt-install.sh') }}
+    - name: Install system packages
+      if: inputs.apt-packages != ''
+      shell: bash
+      env:
+        APT_RECOMMENDS: ${{ inputs.apt-recommends == 'true' && '1' || '0' }}
+        APT_PACKAGES: ${{ inputs.apt-packages }}
+      run: |
+        # shellcheck disable=SC2086 # the package list is word-split on purpose
+        bash scripts/ci/apt-install.sh $APT_PACKAGES
+    - name: Save apt packages
+      if: inputs.apt-packages != '' && github.ref == 'refs/heads/main' && steps.apt-cache.outputs.cache-hit != 'true'
+      uses: actions/cache/save@v4
+      with:
+        path: ~/apt-debs/*.deb
+        key: apt-debs-v1-${{ inputs.apt-cache }}-${{ hashFiles('scripts/ci/apt-install.sh') }}
+
+    # Exported for the rest of the job. Tests and the browser fixture are built in
+    # the dev profile without debug info (smaller, faster to link). CARGO_* variables
+    # are part of the rust-cache key, so every job sharing a cache must set the same.
+    - name: Build settings
+      shell: bash
+      run: echo "CARGO_PROFILE_DEV_DEBUG=0" >> "$GITHUB_ENV"
+
+    - uses: Swatinem/rust-cache@v2
+      with:
+        prefix-key: ci-linux-v1
+        shared-key: ${{ inputs.rust-cache }}
+        add-job-id-key: false
+        save-if: ${{ inputs.save-rust-cache == 'true' && github.ref == 'refs/heads/main' }}
+        cache-on-failure: true
+
+    # After the cache restore, so the checksum-verified binary is the one that
+    # runs (rust-cache restores ~/.cargo/bin).
+    - name: Install cargo-nextest
+      shell: bash
+      run: bash scripts/ci/install-nextest.sh
```

**File**: `.github/actions/windows-ci-setup/action.yml` (added, +54/-0)
```diff
@@ -0,0 +1,54 @@
+name: Windows CI setup
+description: >-
+  Prepare a Windows runner for the Windows test jobs: toolchain, shader
+  compiler, a cheaper release profile for the CI builds, and the Rust cache.
+
+runs:
+  using: composite
+  steps:
+    - name: Disable Defender real-time scanning
+      shell: pwsh
+      # Hosted runners are ephemeral and only build this repository; scanning
+      # every file rustc writes slows builds down. Best effort: warn and carry
+      # on if the runner image does not allow it.
+      run: |
+        try { Set-MpPreference -DisableRealtimeMonitoring $true -ErrorAction Stop }
+        catch { Write-Warning "Could not disable Defender real-time scanning: $_" }
+    - name: Rust toolchain
+      shell: pwsh
+      run: rustup show active-toolchain || rustup toolchain install
+    - name: Locate Windows SDK shader compiler
+      shell: pwsh
+      run: |
+        $fxc = Get-ChildItem "${env:ProgramFiles(x86)}/Windows Kits/10/bin/*/x64/fxc.exe" |
+          Sort-Object FullName -Descending | Select-Object -First 1
+        if (-not $fxc) { throw 'Windows SDK fxc.exe is required for GPUI release shaders' }
+        "GPUI_FXC_PATH=$($fxc.FullName)" >> $env:GITHUB_ENV
+    - name: Cheaper release profile for CI builds
+      shell: pwsh
+      # CI only: the binaries built and tested here are NOT the shipped ones
+      # (release.yml still builds those with the committed profile). Thin LTO is
+      # off and the workspace's own crates are built at opt-level 0; third-party
+      # dependencies (gpui, tokio, ...) keep the release opt-level. Written to
+      # $CARGO_HOME/config.toml so Cargo.toml is untouched and every cargo
+      # invocation in the job, including the ones inside
+      # scripts/package-windows.ps1, picks it up.
+      run: |
+        $members = (cargo metadata --no-deps --format-version 1 | ConvertFrom-Json).packages.name
+        $config = @('[profile.release]', 'lto = false')
+        foreach ($name in $members) {
+          $config += "[profile.release.package.`"$name`"]"
+          $config += 'opt-level = 0'
+        }
+        $cargoHome = if ($env:CARGO_HOME) { $env:CARGO_HOME } else { Join-Path $env:USERPROFILE '.cargo' }
+        Add-Content -LiteralPath (Join-Path $cargoHome 'config.toml') -Value $config
+        Write-Host "opt-level 0 for $($members.Count) workspace crates: $($members -join ', ')"
+    - uses: Swatinem/rust-cache@v2
+      with:
+        # Only main writes the cache; PRs restore it.
+        save-if: ${{ github.ref == 'refs/heads/main' }}
+        cache-on-failure: true
+        # Workspace crates are rebuilt on every change anyway and are cheap at
+        # opt-level 0, so keep them out of the cache. Each job gets its own
+        # cache (rust-cache keys on the job id by default).
+        cache-workspace-crates: false
```

**File**: `.github/workflows/cursor-compatibility.yml` (modified, +18/-15)
```diff
@@ -32,10 +32,6 @@ jobs:
       - uses: actions/setup-node@v4
         with:
           node-version: '22'
-      - uses: Swatinem/rust-cache@v2
-        with:
-          save-if: ${{ github.ref == 'refs/heads/main' }}
-          cache-on-failure: true
       - name: Dependency updater validation
         run: python3 scripts/test-update-cursor-sdk.py
       - name: Install the exact SDK selected by this engine
@@ -44,14 +40,21 @@ jobs:
           npm install --prefix "$RUNNER_TEMP/cursor-sdk-contract" --ignore-scripts --no-audit --no-fund "$pin"
       - name: Actual SDK token expiry, stream invalidation, and transient auth recovery
         run: node scripts/test-cursor-sdk-auth.mjs "$RUNNER_TEMP/cursor-sdk-contract/node_modules/@cursor/sdk"
-      - name: Harness compatibility, steering, and session recovery
-        run: cargo test --locked -p zeron-harness
-      - name: Durable commands and engine message delivery
-        run: |
-          cargo test --locked -p zeron-doc
-          cargo test --locked -p zeron-engine --test message_queue
-          cargo test --locked -p zeron-engine --lib sessions::tests
-      - name: Native Pi RPC driver
-        run: |
-          cargo test --locked -p zeron-harness --features native-fixture --test pi_rpc
-          cargo test --locked -p zeron-engine --test pi_resume
+
+  # The Rust half (harness compatibility, steering, session recovery, durable
+  # commands, message delivery, native Pi RPC) is part of the `core-tests` job
+  # of ui-tests.yml, which already runs on pull requests and on main with a
+  # superset of this workflow's paths. Run it here only for the callers that
+  # do not get that: release.yml (tag push), cursor-sdk-update.yml (manual
+  # dispatch on the update branch) and manual runs.
+  rust-tests:
+    if: ${{ github.event_name != 'pull_request' && !(github.event_name == 'push' && github.ref == 'refs/heads/main') }}
+    runs-on: ubuntu-24.04
+    timeout-minutes: 30
+    steps:
+      - uses: actions/checkout@v4
+      - uses: ./.github/actions/linux-ci
+        with:
+          rust-cache: core # saved by core-tests in ui-tests.yml
+      - name: Harness, engine, sync, update, doc and preview tests
+        run: scripts/ci/test-core.sh
```

**File**: `.github/workflows/linux-installer.yml` (modified, +5/-3)
```diff
@@ -6,6 +6,7 @@ on:
       - 'edge/src/install.sh'
       - 'scripts/package-linux.sh'
       - 'scripts/test-linux-desktop-entry.sh'
+      - 'scripts/ci/apt-install.sh'
       - 'dist/zeron.desktop'
       - 'dist/zeron.png'
       - '.github/workflows/linux-installer.yml'
@@ -15,6 +16,7 @@ on:
       - 'edge/src/install.sh'
       - 'scripts/package-linux.sh'
       - 'scripts/test-linux-desktop-entry.sh'
+      - 'scripts/ci/apt-install.sh'
       - 'dist/zeron.desktop'
       - 'dist/zeron.png'
       - '.github/workflows/linux-installer.yml'
@@ -34,9 +36,9 @@ jobs:
     steps:
       - uses: actions/checkout@v4
       - name: Desktop entry validator
-        run: |
-          sudo apt-get update -qq -o Dir::Etc::sourcelist="sources.list.d/ubuntu.sources" -o Dir::Etc::sourceparts="-"
-          sudo apt-get install -y -qq desktop-file-utils
+        # Skips apt when the runner image already has it; otherwise the install
+        # retries and is bounded instead of hanging on a stalled mirror.
+        run: command -v desktop-file-validate || bash scripts/ci/apt-install.sh desktop-file-utils
       # Both installers, offline, under a throwaway HOME (no network, no systemd).
       - name: Installers write a valid launcher entry
         run: scripts/test-linux-desktop-entry.sh
```

**File**: `.github/workflows/preview-tests.yml` (modified, +2/-14)
```diff
@@ -11,20 +11,8 @@ concurrency:
   group: preview-tests-${{ github.ref }}
   cancel-in-progress: ${{ github.event_name == 'pull_request' }}
 jobs:
-  networking:
-    strategy:
-      matrix:
-        os: [ubuntu-latest]
-    runs-on: ${{ matrix.os }}
-    timeout-minutes: 30
-    steps:
-      - uses: actions/checkout@v4
-      - uses: dtolnay/rust-toolchain@stable
-      - uses: Swatinem/rust-cache@v2
-        with:
-          save-if: ${{ github.ref == 'refs/heads/main' }}
-          cache-on-failure: true
-      - run: cargo test --locked -p zeron-preview
+  # The Rust networking tests run in `core-tests` (ui-tests.yml, Linux) and
+  # `macos-native` (macos.yml); this workflow keeps the edge coordinator.
   coordinator:
     runs-on: ubuntu-latest
     timeout-minutes: 10
```

**File**: `.github/workflows/release-profile-tests.yml` (added, +47/-0)
```diff
@@ -0,0 +1,47 @@
+name: Release-profile tests
+
+# Pull-request and main CI test the dev profile (fast rebuilds). This runs the
+# same Linux suites once a day against the optimized release profile that
+# ships, so optimization-only failures still surface. It does not save a Rust
+# cache, so it cannot evict the main-seeded caches pull requests depend on.
+
+on:
+  schedule:
+    - cron: '17 7 * * *'
+  workflow_dispatch:
+
+permissions:
+  contents: read
+
+concurrency:
+  group: release-profile-tests
+  cancel-in-progress: false
+
+jobs:
+  core-tests:
+    runs-on: ubuntu-24.04
+    timeout-minutes: 60
+    steps:
+      - uses: actions/checkout@v4
+      - uses: ./.github/actions/linux-ci
+        with:
+          rust-cache: release-profile-core
+      - name: Harness, engine, sync, update, doc and preview tests (release)
+        run: scripts/ci/test-core.sh --release
+
+  ui-tests:
+    runs-on: ubuntu-24.04
+    timeout-minutes: 60
+    steps:
+      - uses: actions/checkout@v4
+      - uses: ./.github/actions/linux-ci
+        with:
+          rust-cache: release-profile-ui
+          apt-cache: gpui
+          apt-packages: >-
+            libxkbcommon-dev libxkbcommon-x11-dev libwayland-dev
+            libx11-dev libxcb1-dev libx11-xcb-dev
+            libfontconfig1-dev libfreetype-dev libasound2-dev
+            libvulkan-dev pkg-config cmake libwebkit2gtk-4.1-dev libjson-glib-dev
+      - name: UI and headless layout regressions (release)
+        run: cargo nextest run --config-file scripts/ci/nextest.toml --locked --no-fail-fast --release -p zeron-ui --lib
```

**File**: `.github/workflows/ui-tests.yml` (modified, +41/-53)
```diff
@@ -7,10 +7,11 @@ on:
       - 'Cargo.lock'
       - 'rust-toolchain.toml'
       - 'crates/**'
+      - '.github/actions/linux-ci/**'
+      - 'scripts/ci/**'
+      - 'scripts/*cursor-sdk*'
+      - '.github/workflows/cursor-*.yml'
       - 'scripts/test-linux-browser.sh'
-      - 'scripts/run-macos-browser-fixture.sh'
-      - 'dist/macos/Info.plist'
-      - 'apps/ios/**'
       - '.github/workflows/ui-tests.yml'
   push:
     branches: [main]
@@ -19,10 +20,11 @@ on:
       - 'Cargo.lock'
       - 'rust-toolchain.toml'
       - 'crates/**'
+      - '.github/actions/linux-ci/**'
+      - 'scripts/ci/**'
+      - 'scripts/*cursor-sdk*'
+      - '.github/workflows/cursor-*.yml'
       - 'scripts/test-linux-browser.sh'
-      - 'scripts/run-macos-browser-fixture.sh'
-      - 'dist/macos/Info.plist'
-      - 'apps/ios/**'
       - '.github/workflows/ui-tests.yml'
   workflow_dispatch:
 
@@ -34,77 +36,63 @@ concurrency:
   cancel-in-progress: ${{ github.event_name == 'pull_request' }}
 
 jobs:
-  session-sync-regressions:
+  # Every Linux Rust test that is not UI: one build, one nextest run (see
+  # scripts/ci/test-core.sh). Replaces session-sync-regressions and the Rust
+  # steps of cursor-compatibility and preview-tests.
+  core-tests:
     runs-on: ubuntu-24.04
-    timeout-minutes: 20
+    timeout-minutes: 30
     steps:
       - uses: actions/checkout@v4
-      - name: Rust toolchain
-        run: rustup show active-toolchain || rustup toolchain install
-      - uses: Swatinem/rust-cache@v2
+      - uses: ./.github/actions/linux-ci
         with:
-          save-if: ${{ github.ref == 'refs/heads/main' }}
-          cache-on-failure: true
-      - name: OpenCode protocol and permission regressions
-        run: |
-          cargo test --locked -p zeron-harness --lib opencode::
-          cargo test --locked -p zeron-harness --test opencode
-      - name: Durable session publication and recovery
-        run: |
-          cargo test --locked -p zeron-sync --lib
-          cargo test --locked -p zeron-update --lib
-          cargo test --locked -p zeron-engine --lib --test session_publication --test restart_resume --test codex_subagents --test local_profiles
+          rust-cache: core
+          save-rust-cache: 'true'
+      - name: Harness, engine, sync, update, doc and preview tests
+        run: scripts/ci/test-core.sh
 
   ui-tests:
     runs-on: ubuntu-24.04
     timeout-minutes: 30
     steps:
       - uses: actions/checkout@v4
-      - name: GPUI system dependencies
-        run: |
-          # Only Ubuntu packages are needed; unrelated runner repositories can be out of sync.
-          sudo apt-get update -qq -o Dir::Etc::sourcelist="sources.list.d/ubuntu.sources" -o Dir::Etc::sourceparts="-"
-          sudo apt-get install -y -qq \
-            libxkbcommon-dev libxkbcommon-x11-dev libwayland-dev \
-            libx11-dev libxcb1-dev libx11-xcb-dev \
-            libfontconfig1-dev libfreetype-dev libasound2-dev \
-            libvulkan-dev pkg-config cmake libwebkit2gtk-4.1-dev libjson-glib-dev
-      - name: Rust toolchain
-        run: rustup show active-toolchain || rustup toolchain install
-      - uses: Swatinem/rust-cache@v2
+      - uses: ./.github/actions/linux-ci
         with:
-          save-if: ${{ github.ref == 'refs/heads/main' }}
-          cache-on-failure: true
+          rust-cache: ui
+          save-rust-cache: 'true'
+          apt-cache: gpui
+          apt-packages: >-
+            libxkbcommon-dev libxkbcommon-x11-dev libwayland-dev
+            libx11-dev libxcb1-dev libx11-xcb-dev
+            libfontconfig1-dev libfreetype-dev libasound2-dev
+            libvulkan-dev pkg-config cmake libwebkit2gtk-4.1-dev libjson-glib-dev
       - name: UI and headless layout regressions
-        run: cargo test --release --locked -p zeron-ui --lib -- --test-threads=1
+        run: cargo nextest run --config-file scripts/ci/nextest.toml --locked --no-fail-fast -p zeron-ui --lib
 
   linux-browser:
     runs-on: ubuntu-24.04
     timeout-minutes: 30
     steps:
       - uses: actions/checkout@v4
-      - name: Native browser and GPUI dependencies
-        run: |
-          # Only Ubuntu packages are needed; unrelated runner repositories can be out of sync.
-          sudo apt-get update -qq -o Dir::Etc::sourcelist="sources.list.d/ubuntu.sources" -o Dir::Etc::sourceparts="-"
-          sudo apt-get install -y -qq \
-            libxkbcommon-dev libxkbcommon-x11-dev libwayland-dev \
-            libx11-dev libxcb1-dev libx11-xcb-dev libfontconfig1-dev \
-            libfreetype-dev libasound2-dev libvulkan-dev pkg-config cmake \
-            libwebkit2gtk-4.1-dev libjson-glib-dev xvfb xdotool openbox \
-            weston ffmpeg imagemagick fonts-noto-cjk
-      - name: Rust toolchain
-        run: rustup show active-toolchain || rustup toolchain install
-      - uses: Swatinem/rust-cache@v2
+      - uses: ./.github/actions/linux-ci
         with:
-          save-if: ${{ github.ref == 
```

**File**: `.github/workflows/windows.yml` (modified, +37/-24)
```diff
@@ -43,26 +43,14 @@ defaults:
     shell: pwsh
 
 jobs:
-  tests:
+  # The original single serial job is split into three independent jobs so they
+  # run in parallel. Together they run exactly the commands the single job ran.
+  ui-tests:
     runs-on: windows-2022
-    timeout-minutes: 90
+    timeout-minutes: 45
     steps:
       - uses: actions/checkout@v4
-      - name: Rust toolchain
-        run: rustup show active-toolchain || rustup toolchain install
-      - name: Locate Windows SDK shader compiler
-        run: |
-          $fxc = Get-ChildItem "${env:ProgramFiles(x86)}/Windows Kits/10/bin/*/x64/fxc.exe" |
-            Sort-Object FullName -Descending | Select-Object -First 1
-          if (-not $fxc) { throw 'Windows SDK fxc.exe is required for GPUI release shaders' }
-          "GPUI_FXC_PATH=$($fxc.FullName)" >> $env:GITHUB_ENV
-      - uses: Swatinem/rust-cache@v2
-        with:
-          save-if: ${{ github.ref == 'refs/heads/main' }}
-          cache-on-failure: true
-          cache-workspace-crates: true
-      - name: Native harness security and integration tests
-        run: cargo test --release --locked -p zeron-harness --features native-fixture --lib --test codex_availability --test windows_native
+      - uses: ./.github/actions/windows-ci-setup
       - name: UI tests
         env:
           RUST_BACKTRACE: '1'
@@ -74,22 +62,47 @@ jobs:
           cargo test --release --locked -p zeron-ui --lib -- --test-threads=1 --skip native_diff_font_geometry --nocapture
           $headlessResult = $LASTEXITCODE
           if ($nativeResult -ne 0 -or $headlessResult -ne 0) { exit 1 }
-      - name: Build application
-        run: cargo build --release --locked -p zeron
-      - name: Verify portable and installer packaging
-        run: ./scripts/package-windows.ps1 -ReleasesUrl "https://github.com/$env:GITHUB_REPOSITORY/releases/latest/download"
-      - name: Installer install/uninstall
-        run: ./scripts/test-windows-installer.ps1
+
+  # The crate suites compile different package sets, so the two jobs below each
+  # build what they need in parallel instead of one job building them in turn.
+  harness-app-tests:
+    runs-on: windows-2022
+    timeout-minutes: 45
+    steps:
+      - uses: actions/checkout@v4
+      - uses: ./.github/actions/windows-ci-setup
+      - name: Native harness security and integration tests
+        run: cargo test --release --locked -p zeron-harness --features native-fixture --lib --test codex_availability --test windows_native
       - name: Shader layout tests
         run: cargo test --release --locked -p gpui_windows --lib layout
       - name: Application and updater tests
         run: cargo test --release --locked -p zeron -p zeron-update
+
+  engine-tests:
+    runs-on: windows-2022
+    timeout-minutes: 45
+    steps:
+      - uses: actions/checkout@v4
+      - uses: ./.github/actions/windows-ci-setup
       - name: Engine unit tests
         run: cargo test --release --locked -p zeron-engine --lib
       - name: Harness catalog and login tests
         run: cargo test --release --locked -p zeron-engine --test codex_catalog --test codex_login_resolution
       - name: Auth integration tests
         run: cargo test --release --locked -p zeron-engine --test auth
+
+  app:
+    runs-on: windows-2022
+    timeout-minutes: 45
+    steps:
+      - uses: actions/checkout@v4
+      - uses: ./.github/actions/windows-ci-setup
+      - name: Build application
+        run: cargo build --release --locked -p zeron
+      - name: Verify portable and installer packaging
+        run: ./scripts/package-windows.ps1 -ReleasesUrl "https://github.com/$env:GITHUB_REPOSITORY/releases/latest/download"
+      - name: Installer install/uninstall
+        run: ./scripts/test-windows-installer.ps1
       - name: GUI subsystem and redirected CLI output
         run: ./scripts/test-windows-startup.ps1
       - name: CLI startup without HOME
@@ -143,7 +156,7 @@ jobs:
 
   native-gui:
     if: ${{ github.event_name == 'workflow_dispatch' && inputs.native_gui }}
-    needs: tests
+    needs: app
     runs-on: windows-2022
     timeout-minutes: 10
     steps:
```

---

### Incident Patch 11: `5d5d9359` (2026-10-01)
**Commit Message**: CI: cover cursor paths in ui-tests, verify nextest after cache restore, nightly release-profile run

- ui-tests.yml also triggers on scripts/*cursor-sdk* and cursor-*.yml, so the
  Rust half that moved out of cursor-compatibility still runs for those PRs.
- linux-ci installs nextest after rust-cache restores ~/.cargo/bin, so the
  checksum-verified binary is the one used.
- release-profile-tests.yml runs the Linux core and UI suites daily with
  --release (no cache save), backstopping the dev-profile switch.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.github/actions/linux-ci/action.yml` (modified, +6/-4)
```diff
@@ -58,10 +58,6 @@ runs:
         path: ~/apt-debs/*.deb
         key: apt-debs-v1-${{ inputs.apt-cache }}-${{ hashFiles('scripts/ci/apt-install.sh') }}
 
-    - name: Install cargo-nextest
-      shell: bash
-      run: bash scripts/ci/install-nextest.sh
-
     # Exported for the rest of the job. Tests and the browser fixture are built in
     # the dev profile without debug info (smaller, faster to link). CARGO_* variables
     # are part of the rust-cache key, so every job sharing a cache must set the same.
@@ -76,3 +72,9 @@ runs:
         add-job-id-key: false
         save-if: ${{ inputs.save-rust-cache == 'true' && github.ref == 'refs/heads/main' }}
         cache-on-failure: true
+
+    # After the cache restore, so the checksum-verified binary is the one that
+    # runs (rust-cache restores ~/.cargo/bin).
+    - name: Install cargo-nextest
+      shell: bash
+      run: bash scripts/ci/install-nextest.sh
```

**File**: `.github/workflows/release-profile-tests.yml` (added, +47/-0)
```diff
@@ -0,0 +1,47 @@
+name: Release-profile tests
+
+# Pull-request and main CI test the dev profile (fast rebuilds). This runs the
+# same Linux suites once a day against the optimized release profile that
+# ships, so optimization-only failures still surface. It does not save a Rust
+# cache, so it cannot evict the main-seeded caches pull requests depend on.
+
+on:
+  schedule:
+    - cron: '17 7 * * *'
+  workflow_dispatch:
+
+permissions:
+  contents: read
+
+concurrency:
+  group: release-profile-tests
+  cancel-in-progress: false
+
+jobs:
+  core-tests:
+    runs-on: ubuntu-24.04
+    timeout-minutes: 60
+    steps:
+      - uses: actions/checkout@v4
+      - uses: ./.github/actions/linux-ci
+        with:
+          rust-cache: release-profile-core
+      - name: Harness, engine, sync, update, doc and preview tests (release)
+        run: scripts/ci/test-core.sh --release
+
+  ui-tests:
+    runs-on: ubuntu-24.04
+    timeout-minutes: 60
+    steps:
+      - uses: actions/checkout@v4
+      - uses: ./.github/actions/linux-ci
+        with:
+          rust-cache: release-profile-ui
+          apt-cache: gpui
+          apt-packages: >-
+            libxkbcommon-dev libxkbcommon-x11-dev libwayland-dev
+            libx11-dev libxcb1-dev libx11-xcb-dev
+            libfontconfig1-dev libfreetype-dev libasound2-dev
+            libvulkan-dev pkg-config cmake libwebkit2gtk-4.1-dev libjson-glib-dev
+      - name: UI and headless layout regressions (release)
+        run: cargo nextest run --config-file scripts/ci/nextest.toml --locked --no-fail-fast --release -p zeron-ui --lib
```

**File**: `.github/workflows/ui-tests.yml` (modified, +4/-0)
```diff
@@ -9,6 +9,8 @@ on:
       - 'crates/**'
       - '.github/actions/linux-ci/**'
       - 'scripts/ci/**'
+      - 'scripts/*cursor-sdk*'
+      - '.github/workflows/cursor-*.yml'
       - 'scripts/test-linux-browser.sh'
       - 'scripts/run-macos-browser-fixture.sh'
       - 'dist/macos/Info.plist'
@@ -23,6 +25,8 @@ on:
       - 'crates/**'
       - '.github/actions/linux-ci/**'
       - 'scripts/ci/**'
+      - 'scripts/*cursor-sdk*'
+      - '.github/workflows/cursor-*.yml'
       - 'scripts/test-linux-browser.sh'
       - 'scripts/run-macos-browser-fixture.sh'
       - 'dist/macos/Info.plist'
```

**File**: `scripts/ci/test-core.sh` (modified, +2/-1)
```diff
@@ -16,6 +16,7 @@
 #                  they are listed instead of globbed to avoid compiling them.
 # nextest does not run doctests; these crates have none (their doc comments
 # contain no Rust code blocks).
+# Extra arguments are passed to nextest (the nightly job adds `--release`).
 set -euo pipefail
 cd "$(dirname "$0")/../.."
 
@@ -30,4 +31,4 @@ done
 exec cargo nextest run --config-file scripts/ci/nextest.toml --locked --no-fail-fast \
   -p zeron-harness -p zeron-engine -p zeron-sync -p zeron-update -p zeron-doc -p zeron-preview \
   --features zeron-harness/native-fixture \
-  --lib --bins "${tests[@]}"
+  --lib --bins "${tests[@]}" "$@"
```

---

### Incident Patch 12: `b3d7f48b` (2026-10-01)
**Commit Message**: Fix command and skill labels in the message queue (#682)

* Fix command and skill labels in the message queue

* Test queue row labels for commands, skills and files

Extract the row label into queue_row_text so the projection is covered by a
unit test alongside the attachment-trailer handling.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

---------

Co-authored-by: Wing <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `crates/ui/src/queue.rs` (modified, +43/-1)
```diff
@@ -218,6 +218,17 @@ fn queue_visible_text(text: &str, attachments: &[String]) -> String {
     }
 }
 
+/// The row's one-line label. Commands, skills and file mentions show the same
+/// labels as the transcript; editing and delivery still read the stored text,
+/// which keeps their canonical links.
+fn queue_row_text(text: &str, attachments: &[String]) -> SharedString {
+    let visible = queue_visible_text(text, attachments);
+    let display = crate::composer::sent_mention_display(&visible)
+        .map(|(display, _)| display)
+        .unwrap_or(visible);
+    one_line(&display)
+}
+
 /// Presentation-only metadata. Never expose the observed accessibility payload.
 /// Rows show thumbnails only; these names surface as tooltips and labels.
 fn queue_attachment_labels(text: &str, paths: &[String]) -> Vec<String> {
@@ -433,7 +444,7 @@ impl Composer {
             Some(QueueDeliveryGate::ReviewRequired { .. }) if !being_edited => {
                 SharedString::from("Needs review")
             }
-            _ => one_line(&queue_visible_text(&item.text, &item.attachments)),
+            _ => queue_row_text(&item.text, &item.attachments),
         };
 
         let edit_id = item.id.clone();
@@ -2042,6 +2053,37 @@ mod tests {
         assert_eq!(super::queue_hidden_attachments_label(&[], 2), None);
     }
 
+    /// Rows label references the way the transcript does, never as raw
+    /// `zeron-invoke:`/`zeron-file:` links, and still hide attachment trailers.
+    #[test]
+    fn queue_rows_label_commands_skills_and_files() {
+        use zeron_proto::invocation::Invocation;
+        let command = Invocation::Command {
+            name: "compact".into(),
+        }
+        .link();
+        let skill = Invocation::Skill {
+            name: "review-pr".into(),
+            path: "/skills/review-pr/SKILL.md".into(),
+            command: None,
+        }
+        .link();
+        let file = zeron_proto::file_mentions::local_file_link("src/queue.rs", false);
+        let text = format!("{command} then {skill}\non {file}");
+        assert_eq!(
+            super::queue_row_text(&text, &[]).as_ref(),
+            "/compact then $review-pr on @queue.rs"
+        );
+
+        let paths = vec!["/tmp/image.png".to_string()];
+        let legacy = crate::attachments::with_attachments(&command, &paths);
+        assert_eq!(super::queue_row_text(&legacy, &paths).as_ref(), "/compact");
+        assert_eq!(
+            super::queue_row_text("plain  text", &[]).as_ref(),
+            "plain text"
+        );
+    }
+
     #[test]
     fn legacy_attachment_trailers_are_hidden_from_queue_text() {
         let paths = vec!["/tmp/image.png".to_string()];
```

---

### Incident Patch 13: `878307a3` (2026-10-01)
**Commit Message**: CI: run Linux tests with nextest on a dev profile and one shared build

- ui-tests: session-sync-regressions becomes core-tests (one build for the
  harness, engine, sync, update, doc and preview tests); ui-tests and
  linux-browser use nextest, the dev profile and a shared rust-cache
- cursor-compatibility: the Rust half runs from core-tests on PRs and main;
  it only runs here for release, cursor-sdk-update dispatch and manual runs
- preview-tests: the Linux leg moves into core-tests
- linux-installer: install desktop-file-utils with bounded apt retries

**File**: `.github/workflows/cursor-compatibility.yml` (modified, +18/-15)
```diff
@@ -32,10 +32,6 @@ jobs:
       - uses: actions/setup-node@v4
         with:
           node-version: '22'
-      - uses: Swatinem/rust-cache@v2
-        with:
-          save-if: ${{ github.ref == 'refs/heads/main' }}
-          cache-on-failure: true
       - name: Dependency updater validation
         run: python3 scripts/test-update-cursor-sdk.py
       - name: Install the exact SDK selected by this engine
@@ -44,14 +40,21 @@ jobs:
           npm install --prefix "$RUNNER_TEMP/cursor-sdk-contract" --ignore-scripts --no-audit --no-fund "$pin"
       - name: Actual SDK token expiry, stream invalidation, and transient auth recovery
         run: node scripts/test-cursor-sdk-auth.mjs "$RUNNER_TEMP/cursor-sdk-contract/node_modules/@cursor/sdk"
-      - name: Harness compatibility, steering, and session recovery
-        run: cargo test --locked -p zeron-harness
-      - name: Durable commands and engine message delivery
-        run: |
-          cargo test --locked -p zeron-doc
-          cargo test --locked -p zeron-engine --test message_queue
-          cargo test --locked -p zeron-engine --lib sessions::tests
-      - name: Native Pi RPC driver
-        run: |
-          cargo test --locked -p zeron-harness --features native-fixture --test pi_rpc
-          cargo test --locked -p zeron-engine --test pi_resume
+
+  # The Rust half (harness compatibility, steering, session recovery, durable
+  # commands, message delivery, native Pi RPC) is part of the `core-tests` job
+  # of ui-tests.yml, which already runs on pull requests and on main with a
+  # superset of this workflow's paths. Run it here only for the callers that
+  # do not get that: release.yml (tag push), cursor-sdk-update.yml (manual
+  # dispatch on the update branch) and manual runs.
+  rust-tests:
+    if: ${{ github.event_name != 'pull_request' && !(github.event_name == 'push' && github.ref == 'refs/heads/main') }}
+    runs-on: ubuntu-24.04
+    timeout-minutes: 30
+    steps:
+      - uses: actions/checkout@v4
+      - uses: ./.github/actions/linux-ci
+        with:
+          rust-cache: core # saved by core-tests in ui-tests.yml
+      - name: Harness, engine, sync, update, doc and preview tests
+        run: scripts/ci/test-core.sh
```

**File**: `.github/workflows/linux-installer.yml` (modified, +5/-3)
```diff
@@ -6,6 +6,7 @@ on:
       - 'edge/src/install.sh'
       - 'scripts/package-linux.sh'
       - 'scripts/test-linux-desktop-entry.sh'
+      - 'scripts/ci/apt-install.sh'
       - 'dist/zeron.desktop'
       - 'dist/zeron.png'
       - '.github/workflows/linux-installer.yml'
@@ -15,6 +16,7 @@ on:
       - 'edge/src/install.sh'
       - 'scripts/package-linux.sh'
       - 'scripts/test-linux-desktop-entry.sh'
+      - 'scripts/ci/apt-install.sh'
       - 'dist/zeron.desktop'
       - 'dist/zeron.png'
       - '.github/workflows/linux-installer.yml'
@@ -34,9 +36,9 @@ jobs:
     steps:
       - uses: actions/checkout@v4
       - name: Desktop entry validator
-        run: |
-          sudo apt-get update -qq -o Dir::Etc::sourcelist="sources.list.d/ubuntu.sources" -o Dir::Etc::sourceparts="-"
-          sudo apt-get install -y -qq desktop-file-utils
+        # Skips apt when the runner image already has it; otherwise the install
+        # retries and is bounded instead of hanging on a stalled mirror.
+        run: command -v desktop-file-validate || bash scripts/ci/apt-install.sh desktop-file-utils
       # Both installers, offline, under a throwaway HOME (no network, no systemd).
       - name: Installers write a valid launcher entry
         run: scripts/test-linux-desktop-entry.sh
```

**File**: `.github/workflows/preview-tests.yml` (modified, +3/-1)
```diff
@@ -11,10 +11,12 @@ concurrency:
   group: preview-tests-${{ github.ref }}
   cancel-in-progress: ${{ github.event_name == 'pull_request' }}
 jobs:
+  # The Linux leg runs in the `core-tests` job of ui-tests.yml (same tests, one
+  # shared build with the rest of the Rust tests).
   networking:
     strategy:
       matrix:
-        os: [ubuntu-latest, macos-latest]
+        os: [macos-latest]
     runs-on: ${{ matrix.os }}
     timeout-minutes: 30
     steps:
```

**File**: `.github/workflows/ui-tests.yml` (modified, +37/-47)
```diff
@@ -7,6 +7,8 @@ on:
       - 'Cargo.lock'
       - 'rust-toolchain.toml'
       - 'crates/**'
+      - '.github/actions/linux-ci/**'
+      - 'scripts/ci/**'
       - 'scripts/test-linux-browser.sh'
       - 'scripts/run-macos-browser-fixture.sh'
       - 'dist/macos/Info.plist'
@@ -19,6 +21,8 @@ on:
       - 'Cargo.lock'
       - 'rust-toolchain.toml'
       - 'crates/**'
+      - '.github/actions/linux-ci/**'
+      - 'scripts/ci/**'
       - 'scripts/test-linux-browser.sh'
       - 'scripts/run-macos-browser-fixture.sh'
       - 'dist/macos/Info.plist'
@@ -67,49 +71,38 @@ jobs:
             return files.some(file => affectsIOS(file.filename)
               || affectsIOS(file.previous_filename));
 
-  session-sync-regressions:
+  # Every Linux Rust test that is not UI: one build, one nextest run (see
+  # scripts/ci/test-core.sh). Replaces session-sync-regressions and the Rust
+  # steps of cursor-compatibility and preview-tests.
+  core-tests:
     runs-on: ubuntu-24.04
-    timeout-minutes: 20
+    timeout-minutes: 30
     steps:
       - uses: actions/checkout@v4
-      - name: Rust toolchain
-        run: rustup show active-toolchain || rustup toolchain install
-      - uses: Swatinem/rust-cache@v2
+      - uses: ./.github/actions/linux-ci
         with:
-          save-if: ${{ github.ref == 'refs/heads/main' }}
-          cache-on-failure: true
-      - name: OpenCode protocol and permission regressions
-        run: |
-          cargo test --locked -p zeron-harness --lib opencode::
-          cargo test --locked -p zeron-harness --test opencode
-      - name: Durable session publication and recovery
-        run: |
-          cargo test --locked -p zeron-sync --lib
-          cargo test --locked -p zeron-update --lib
-          cargo test --locked -p zeron-engine --lib --test session_publication --test restart_resume --test codex_subagents --test local_profiles
+          rust-cache: core
+          save-rust-cache: 'true'
+      - name: Harness, engine, sync, update, doc and preview tests
+        run: scripts/ci/test-core.sh
 
   ui-tests:
     runs-on: ubuntu-24.04
     timeout-minutes: 30
     steps:
       - uses: actions/checkout@v4
-      - name: GPUI system dependencies
-        run: |
-          # Only Ubuntu packages are needed; unrelated runner repositories can be out of sync.
-          sudo apt-get update -qq -o Dir::Etc::sourcelist="sources.list.d/ubuntu.sources" -o Dir::Etc::sourceparts="-"
-          sudo apt-get install -y -qq \
-            libxkbcommon-dev libxkbcommon-x11-dev libwayland-dev \
-            libx11-dev libxcb1-dev libx11-xcb-dev \
-            libfontconfig1-dev libfreetype-dev libasound2-dev \
-            libvulkan-dev pkg-config cmake libwebkit2gtk-4.1-dev libjson-glib-dev
-      - name: Rust toolchain
-        run: rustup show active-toolchain || rustup toolchain install
-      - uses: Swatinem/rust-cache@v2
+      - uses: ./.github/actions/linux-ci
         with:
-          save-if: ${{ github.ref == 'refs/heads/main' }}
-          cache-on-failure: true
+          rust-cache: ui
+          save-rust-cache: 'true'
+          apt-cache: gpui
+          apt-packages: >-
+            libxkbcommon-dev libxkbcommon-x11-dev libwayland-dev
+            libx11-dev libxcb1-dev libx11-xcb-dev
+            libfontconfig1-dev libfreetype-dev libasound2-dev
+            libvulkan-dev pkg-config cmake libwebkit2gtk-4.1-dev libjson-glib-dev
       - name: UI and headless layout regressions
-        run: cargo test --release --locked -p zeron-ui --lib -- --test-threads=1
+        run: cargo nextest run --config-file scripts/ci/nextest.toml --locked --no-fail-fast -p zeron-ui --lib
 
   macos-frame-recovery:
     runs-on: macos-latest
@@ -235,28 +228,25 @@ jobs:
     timeout-minutes: 30
     steps:
       - uses: actions/checkout@v4
-      - name: Native browser and GPUI dependencies
-        run: |
-          # Only Ubuntu packages are needed; unrelated runner repositories can be out of sync.
-          sudo apt-get update -qq -o Dir::Etc::sourcelist="sources.list.d/ubuntu.sources" -o Dir::Etc::sourceparts="-"
-          sudo apt-get install -y -qq \
-            libxkbcommon-dev libxkbcommon-x11-dev libwayland-dev \
-            libx11-dev libxcb1-dev libx11-xcb-dev libfontconfig1-dev \
-            libfreetype-dev libasound2-dev libvulkan-dev pkg-config cmake \
-            libwebkit2gtk-4.1-dev libjson-glib-dev xvfb xdotool openbox \
-            weston ffmpeg imagemagick fonts-noto-cjk
-      - name: Rust toolchain
-        run: rustup show active-toolchain || rustup toolchain install
-      - uses: Swatinem/rust-cache@v2
+      - uses: ./.github/actions/linux-ci
         with:
-          save-if: ${{ github.ref == 'refs/heads/main' }}
-          cache-on-failure: true
+          # Same dependency graph as ui-tests, which saves this cache on main.
+          rust-cache: ui
+          apt-cache: browser
+          apt-recommends: 'true'
+          apt-packages: >-
+        
```

---

### Incident Patch 14: `9cb1de50` (2026-10-01)
**Commit Message**: CI: add Linux test helpers (setup action, nextest, apt with retries)

A composite action installs the toolchain, a checksum-pinned cargo-nextest
and apt packages (bounded retries, cached .debs), and wires the main-seeded
Rust cache. scripts/ci/test-core.sh runs the harness, engine, sync, update,
doc and preview tests as one build and one nextest run. nextest.toml retries
the two tests that are timing-sensitive under nextest. Not used by any
workflow yet.

**File**: `.github/actions/linux-ci/action.yml` (added, +78/-0)
```diff
@@ -0,0 +1,78 @@
+name: Linux Rust CI setup
+description: >-
+  Rust toolchain, cargo-nextest, optional apt packages (with a cached .deb
+  directory) and the main-seeded Rust cache for Linux test jobs. Run
+  actions/checkout first.
+
+inputs:
+  rust-cache:
+    description: >-
+      rust-cache shared key. Jobs with the same key share one cache, so they
+      must have the same dependency graph.
+    required: true
+  save-rust-cache:
+    description: >-
+      Whether this job may save the cache when it runs on main. Give it to
+      exactly one job per key. Pull requests never save.
+    default: 'false'
+  apt-packages:
+    description: apt packages to install (space separated). Nothing is installed when empty.
+    default: ''
+  apt-cache:
+    description: Name of the cached .deb directory for apt-packages (one per package list).
+    default: ''
+  apt-recommends:
+    description: Install recommended packages too ('true' or 'false').
+    default: 'false'
+
+runs:
+  using: composite
+  steps:
+    - name: Rust toolchain
+      shell: bash
+      run: rustup show active-toolchain || rustup toolchain install
+
+    # apt mirrors on hosted runners occasionally stall for minutes; apt-install.sh
+    # bounds and retries the download and uses a directory of .debs that main
+    # saves to the cache (pull requests only restore it).
+    - name: Restore apt packages
+      id: apt-cache
+      if: inputs.apt-packages != ''
+      uses: actions/cache/restore@v4
+      with:
+        path: ~/apt-debs/*.deb
+        key: apt-debs-v1-${{ inputs.apt-cache }}-${{ hashFiles('scripts/ci/apt-install.sh') }}
+    - name: Install system packages
+      if: inputs.apt-packages != ''
+      shell: bash
+      env:
+        APT_RECOMMENDS: ${{ inputs.apt-recommends == 'true' && '1' || '0' }}
+        APT_PACKAGES: ${{ inputs.apt-packages }}
+      run: |
+        # shellcheck disable=SC2086 # the package list is word-split on purpose
+        bash scripts/ci/apt-install.sh $APT_PACKAGES
+    - name: Save apt packages
+      if: inputs.apt-packages != '' && github.ref == 'refs/heads/main' && steps.apt-cache.outputs.cache-hit != 'true'
+      uses: actions/cache/save@v4
+      with:
+        path: ~/apt-debs/*.deb
+        key: apt-debs-v1-${{ inputs.apt-cache }}-${{ hashFiles('scripts/ci/apt-install.sh') }}
+
+    - name: Install cargo-nextest
+      shell: bash
+      run: bash scripts/ci/install-nextest.sh
+
+    # Exported for the rest of the job. Tests and the browser fixture are built in
+    # the dev profile without debug info (smaller, faster to link). CARGO_* variables
+    # are part of the rust-cache key, so every job sharing a cache must set the same.
+    - name: Build settings
+      shell: bash
+      run: echo "CARGO_PROFILE_DEV_DEBUG=0" >> "$GITHUB_ENV"
+
+    - uses: Swatinem/rust-cache@v2
+      with:
+        prefix-key: ci-linux-v1
+        shared-key: ${{ inputs.rust-cache }}
+        add-job-id-key: false
+        save-if: ${{ inputs.save-rust-cache == 'true' && github.ref == 'refs/heads/main' }}
+        cache-on-failure: true
```

**File**: `scripts/ci/apt-install.sh` (added, +41/-0)
```diff
@@ -0,0 +1,41 @@
+#!/usr/bin/env bash
+# Install apt packages from a user-owned, cacheable .deb directory with
+# stall-resistant retries and per-phase timestamps.
+#   usage: APT_DEB_DIR=~/apt-debs [APT_RECOMMENDS=1] apt-install.sh pkg...
+# Hosted-runner apt mirrors occasionally stall for minutes (observed 7-14 min
+# for a ~400 MB install); a bounded download retry + actions/cache of the .debs
+# makes the common case ~20 s and the bad case bounded.
+set -uo pipefail
+dir=${APT_DEB_DIR:-$HOME/apt-debs}
+mkdir -p "$dir/partial"
+export DEBIAN_FRONTEND=noninteractive
+ts() { while IFS= read -r l; do printf '[%(%T)T] %s\n' -1 "$l"; done; }
+log() { printf '[%(%T)T] apt-install: %s\n' -1 "$*"; }
+
+# No docs/man/locales, no fsync: faster unpack.
+printf '%s\n' force-unsafe-io 'path-exclude=/usr/share/doc/*' 'path-exclude=/usr/share/man/*' \
+  'path-exclude=/usr/share/locale/*' 'path-exclude=/usr/share/info/*' | sudo tee /etc/dpkg/dpkg.cfg.d/90ci >/dev/null
+sudo rm -f /var/lib/man-db/auto-update
+
+APT=(-y -o Acquire::Retries=3 -o Acquire::http::Timeout=15 -o Acquire::Languages=none
+     -o "Dir::Cache::archives=$dir" -o APT::Sandbox::User=root -o DPkg::Lock::Timeout=120)
+[ "${APT_RECOMMENDS:-0}" = 1 ] || APT+=(--no-install-recommends)
+
+log "cached debs: $(ls "$dir"/*.deb 2>/dev/null | wc -l)"
+log "update"
+# Only Ubuntu packages are needed; unrelated runner repositories can be out of sync.
+sudo timeout 120 apt-get update -qq -o Acquire::Retries=3 -o Acquire::http::Timeout=15 \
+  -o Dir::Etc::sourcelist="sources.list.d/ubuntu.sources" -o Dir::Etc::sourceparts="-" 2>&1 | ts
+
+ok=0
+for attempt in 1 2 3 4; do
+  log "download attempt $attempt"
+  sudo timeout 150 apt-get install "${APT[@]}" --download-only "$@" 2>&1 | ts
+  if [ "${PIPESTATUS[0]}" = 0 ]; then ok=1; break; fi
+done
+[ "$ok" = 1 ] || { log "download failed"; exit 1; }
+log "install"
+sudo apt-get install "${APT[@]}" -qq "$@" 2>&1 | ts
+rc=${PIPESTATUS[0]}
+log "done rc=$rc"
+exit "$rc"
```

**File**: `scripts/ci/install-nextest.sh` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+#!/usr/bin/env bash
+# Install a pinned cargo-nextest release (x86_64 Linux) after verifying its
+# SHA-256, instead of trusting a third-party install action. To bump: change
+# VERSION and SHA256 (from the release's .tar.gz asset).
+set -euo pipefail
+VERSION=0.9.146
+SHA256=682c21b777c333e96fd532e114d3a5a894e0729ab88d94c0a9f20f8419695428
+
+[ "$(uname -m)" = x86_64 ] || { echo "install-nextest.sh: x86_64 only" >&2; exit 1; }
+tmp="$(mktemp -d)"
+trap 'rm -rf "$tmp"' EXIT
+curl --proto '=https' --tlsv1.2 -fsSL --retry 5 -o "$tmp/nextest.tar.gz" \
+  "https://github.com/nextest-rs/nextest/releases/download/cargo-nextest-$VERSION/cargo-nextest-$VERSION-x86_64-unknown-linux-gnu.tar.gz"
+echo "$SHA256  $tmp/nextest.tar.gz" | sha256sum -c -
+mkdir -p "$HOME/.cargo/bin"
+tar -xzf "$tmp/nextest.tar.gz" -C "$HOME/.cargo/bin" cargo-nextest
+cargo nextest --version
```

**File**: `scripts/ci/nextest.toml` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+# cargo-nextest settings for CI (pass with --config-file).
+#
+# Two tests are timing-sensitive and fail now and then when nextest runs many tests
+# at once (the old `cargo test` runs were serial per binary, and the UI run was
+# `--test-threads=1` in the release profile). nextest reports a pass-on-retry as
+# FLAKY, so these stay visible in the log. Remove an override once its test is fixed.
+
+# zeron-ui `state::tests::bootstrap_reports_local_assembly_failure_before_returning_a_handle`
+# picks a "free" port (bind(:0) + drop), makes an engine bootstrap fail, then asserts
+# nothing listens on that port ("failed bootstrap must release the IPC listener").
+# In the dev profile it fails on the first attempt in roughly one run in three and
+# passes on the retry, even when it runs alone: a race in listener teardown or port
+# reuse.
+[[profile.default.overrides]]
+filter = 'package(zeron-ui) & test(bootstrap_reports_local_assembly_failure_before_returning_a_handle)'
+retries = 2
+
+# zeron-harness `opencode::mcp_injection_tests::mcp_injection_reaches_isolated_server_processes`
+# starts `node` fixture scripts and `binary_version` gives each `--version` probe 2 s;
+# on a loaded 4-core runner the probe occasionally times out ("cannot determine
+# opencode version for MCP configuration").
+[[profile.default.overrides]]
+filter = 'package(zeron-harness) & test(mcp_injection_reaches_isolated_server_processes)'
+retries = 2
```

**File**: `scripts/ci/test-core.sh` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+#!/usr/bin/env bash
+# The Linux Rust tests that used to run as separate `cargo test` invocations in
+# session-sync-regressions, cursor-compatibility and preview-tests, as ONE
+# build and ONE nextest run (separate invocations recompiled the same
+# dependency graph with different feature sets).
+#
+# Same coverage as the old invocations:
+#   zeron-harness  every test binary (cursor-compatibility ran `-p zeron-harness`
+#                  plus `--test pi_rpc` with native-fixture; native-fixture only
+#                  adds the pi_rpc fixture binaries, so it is on for the whole build)
+#   zeron-preview  every test binary (preview-tests)
+#   zeron-doc      lib + attachments_roundtrip (cursor-compatibility)
+#   zeron-sync, zeron-update   lib only (session-sync-regressions)
+#   zeron-engine   lib + the integration tests named below. Engine has many other
+#                  integration binaries (live agents etc.) that no workflow ran, so
+#                  they are listed instead of globbed to avoid compiling them.
+# nextest does not run doctests; these crates have none (their doc comments
+# contain no Rust code blocks).
+set -euo pipefail
+cd "$(dirname "$0")/../.."
+
+tests=()
+for f in crates/harness/tests/*.rs crates/preview/tests/*.rs; do
+  tests+=(--test "$(basename "$f" .rs)")
+done
+for t in session_publication restart_resume codex_subagents local_profiles message_queue pi_resume attachments_roundtrip; do
+  tests+=(--test "$t")
+done
+
+exec cargo nextest run --config-file scripts/ci/nextest.toml --locked --no-fail-fast \
+  -p zeron-harness -p zeron-engine -p zeron-sync -p zeron-update -p zeron-doc -p zeron-preview \
+  --features zeron-harness/native-fixture \
+  --lib --bins "${tests[@]}"
```

---

### Incident Patch 15: `c168ba5b` (2026-10-01)
**Commit Message**: windows: run the crate suites as two parallel jobs

**File**: `.github/workflows/windows.yml` (modified, +10/-1)
```diff
@@ -63,7 +63,9 @@ jobs:
           $headlessResult = $LASTEXITCODE
           if ($nativeResult -ne 0 -or $headlessResult -ne 0) { exit 1 }
 
-  crate-tests:
+  # The crate suites compile different package sets, so the two jobs below each
+  # build what they need in parallel instead of one job building them in turn.
+  harness-app-tests:
     runs-on: windows-2022
     timeout-minutes: 45
     steps:
@@ -75,6 +77,13 @@ jobs:
         run: cargo test --release --locked -p gpui_windows --lib layout
       - name: Application and updater tests
         run: cargo test --release --locked -p zeron -p zeron-update
+
+  engine-tests:
+    runs-on: windows-2022
+    timeout-minutes: 45
+    steps:
+      - uses: actions/checkout@v4
+      - uses: ./.github/actions/windows-ci-setup
       - name: Engine unit tests
         run: cargo test --release --locked -p zeron-engine --lib
       - name: Harness catalog and login tests
```

#### Recent Merged Pull Requests:
- **PR #799** (2026-10-05): Group projects by git identity, plus Zeron Icons and rolling labels (@wing-anara)
- **PR #775** (2026-10-05): Composer: mention images and files as chips (@notsapinho)
- **PR #763** (2026-10-03): Fix preview discovery aborting CLI browser logins (@katulevskiy)
- **PR #760** (2026-10-03): Render Mermaid diagrams in chat replies (@jsgrrchg)
- **PR #757** (2026-10-03): Fix Shift+Backspace deletion in text inputs (@katulevskiy)
- **PR #754** (2026-10-03): Keep activity loaders pulsing under system reduced motion (@katulevskiy)
- **PR #751** (2026-10-03): Rename threads and side chats inline instead of in a dialog (@jsgrrchg)
- **PR #750** (2026-10-02): CI: pin every action to a commit SHA (@wingleeio)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
