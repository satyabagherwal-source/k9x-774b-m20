# Forensic Learning Record (Deep Inspection): signerlabs/ShipSwift

> **Canonical Artifact**: `07_PROJECT_LEARNING/signerlabs-shipswift-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/signerlabs/ShipSwift](https://github.com/signerlabs/ShipSwift))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:32:38.297Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `signerlabs/ShipSwift`
- **Description**: AI-native SwiftUI component library with full-stack recipes — connect via MCP for instant access.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3227 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `ShipSwift/SWPackage/SWAnimation/SWMetal/SWAnimatedLoop.swift`
```
//
//  SWAnimatedLoop.swift
//  ShipSwift
//
//  Pulsing rings in one of four hand-tuned styles (Shape / Diamond / Neon /
//  Warp), rendered via SwiftUI Metal stitchable shaders. The `Shape` style
//  additionally exposes a 5-way geometric selector (circle / square /
//  diamond / hexagon / star). All four styles share the same parameter
//  surface; Neon adds three angular-wobble parameters on top.
//
//  Requires iOS 17+ / macOS 14+.
//
//  Usage:
//    // Default — Shape style, circle, red/green/blue rings on black
//    ZStack {
//        SWAnimatedLoop()
//            .ignoresSafeArea()
//    }
//
//    // Switch styles — each style auto-loads its hand-tuned numeric defaults
//    SWAnimatedLoop(style: .diamond)
//    SWAnimatedLoop(style: .neon)
//    SWAnimatedLoop(style: .warp)
//
//    // Within Shape style, pick a geometric shape
//    SWAnimatedLoop(style: .shape, shape: .hexagon)
//    SWAnimatedLoop(style: .shape, shape: .star, petals: 7)
//
//    // As a section background
//    myContent
//        .background { SWAnimatedLoop(style: .neon) }
//
//    // Demo / debug — adds a gear button in the navigation bar that opens
//    // a sheet to tweak every parameter live. Disabled by default.
//    SWAnimatedLoop(showsControls: true)
//
//  Parameters:
//    - style: One of `.shape / .diamond / .neon / .warp` (default `.shape`)
//    - shape: Geometric shape, only honored when `style == .shape`
//             (default `.circle`)
//    - petals: Number of star points, only honored when
//              `style == .shape && shape == .star` (default `5`)
//    - color1, color2, color3: Three RGB channel colors (default red/green/blue)
//    - background: Color rendered behind the rings (default `.black`)
//    - speed: Time multiplier on the ring sweep (style-specific default)
//    - lineWidth: Per-ring line thickness (default `0.002`)
//    - lines: Number of concentric rings (style-specific default)
//    - spacing: Distance multiplier between rings (style-specific default)
//    - channelOffset: Phase offset between RGB channels (style-specific default)
//    - patternMod: Period of the pattern term overlaid on the rings
//                  (style-specific default)
//    - rotation: Rotation in radians (default `0`)
//    - scale: Spatial scale (default `1.0`)
//    - centerX, centerY: Ring origin offset (default `0, 0`)
//    - angularLobes, angularAmount, angularSpeed: Per-channel angular wobble
//             added by the Neon style only (defaults `3.0`, `0.08`, `0.5`)
//    - showsControls: Demo gear `ToolbarItem`. Default `false`.
//
//  Notes:
//    - When `showsControls` is `true`, the sheet's Style picker resets the
//      numeric ring parameters (`speed`, `lines`, `spacing`, `channelOffset`,
//      `patternMod`) to the new style's hand-tuned defaults — intentional,
//      so each style ships with the look its author designed.
//    - The Shape selector and Star points slider are hidden in the sheet
//      unless `style == .shape`. The Angular section appears only for
//      `style == .neon`. Parameters that don't apply to the current style
//      are still passed to the shader but ignored there.
//    - The gear button is a native `ToolbarItem` — the call site must be
//      inside a `NavigationStack`.
//
//  Created by Wei Zhong on 5/20/26.
//

import SwiftUI

// MARK: - Style

enum SWAnimatedLoopStyle: String, CaseIterable, Identifiable {
    case shape
    case diamond
    case neon
    case warp

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .shape:   "Shape"
        case .diamond: "Diamond"
        case .neon:    "Neon"
        case .warp:    "Warp"
        }
    }

    /// Metal `stitchable` function name in the default `ShaderLibrary`.
    var shaderName: String {
        switch self {
        case .shape:   "swAnimatedLoopShape"
        case .diamond: "swAnimatedLoopDiamond"
        case .neon:    "swAnimatedLoopNeon"
        case .warp:    "swAnimatedLoopWarp"
        }
    }

    /// Whether this style consumes the `shape` parameter (Shape style only).
    var supportsShape: Bool { self == .shape }

    /// Whether this style consumes the angular-wobble parameters (Neon only).
    var supportsAngular: Bool { self == .neon }

    /// Hand-tuned numeric defaults for this style. Loaded by `SWAnimatedLoop`'s
    /// initializer and reloaded by the controls sheet on style change.
    struct NumericDefaults {
        var speed: Float
        var lineWidth: Float
        var lines: Int
        var spacing: Float
        var channelOffset: Float
        var patternMod: Float
    }

    var numericDefaults: NumericDefaults {
        switch self {
        case .shape:
            return NumericDefaults(speed: 0.05, lineWidth: 0.002, lines: 5,
                                   spacing: 5.0, channelOffset: 0.01, patternMod: 0.2)
        case .diamond:
            return NumericDefaults(speed: 0.05, lineWidth: 0.002, lines: 6,
                                   spacing: 5.0, channelOffset: 0.01, patternMod: 0.15)
        case .neon:
            return NumericDefaults(speed: 0.06, lineWidth: 0.002, lines: 5,
                                   spacing: 5.0, channelOffset: 0.01, patternMod: 0.2)
        case .warp:
            return NumericDefaults(speed: 0.07, lineWidth: 0.002, lines: 6,
                                   spacing: 4.0, channelOffset: 0.008, patternMod: 0.3)
        }
    }
}

// MARK: - Shape

enum SWAnimatedLoopShape: Int, CaseIterable, Identifiable {
    case circle  = 0
    case square  = 1
    case diamond = 2
    case hexagon = 3
    case star    = 4

    var id: Int { rawValue }

    var displayName: String {
        switch self {
        case .circle:  "Circle"
        case .square:  "Square"
        case .diamond: "Diamond"
        case .hexagon: "Hexagon"
        case .star:    "Star"
        }
    }
}

// MARK: - Main View

struct SWAnimatedLoop: View {
    var style: SWAnimatedLoopStyle
    var shape: SWAnimatedLoopShape
    var petals: Int

    var color1: Color
    var color2: Color
    var color3: Color
    var background: Color

    var speed: Float
    var lineWidth: Float
    var lines: Int
    var spacing: Float
    var channelOffset: Float
    var patternMod: Float

    var rotation: Float
    var scale: Float
    var centerX: Float
    var centerY: Float

    var angularLobes: Float
    var angularAmount: Float
    var angularSpeed: Float

    var showsControls: Bool

    /// Designated initializer. Any numeric ring parameter passed as `nil`
    /// falls back to the `style`'s `numericDefaults`, so each style is one
    /// line to render: `SWAnimatedLoop(style: .warp)` is enough.
    init(
        style: SWAnimatedLoopStyle = .shape,
        shape: SWAnimatedLoopShape = .circle,
        petals: Int = 5,
        color1: Color = .red,
        color2: Color = .green,
        color3: Color = .blue,
        background: Color = .black,
        speed: Float? = nil,
        lineWidth: Float? = nil,
        lines: Int? = nil,
        spacing: Float? = nil,
        channelOffset: Float? = nil,
        patternMod: Float? = nil,
        rotation: Float = 0.0,
        scale: Float = 1.0,
        centerX: Float = 0.0,
        centerY: Float = 0.0,
        angularLobes: Float = 3.0,
        angularAmount: Float = 0.08,
        angularSpeed: Float = 0.5,
        showsControls: Bool = false
    ) {
        let d = style.numericDefaults
        self.style          = style
        self.shape          = shape
        self.petals         = petals
        self.color1         = color1
        self.color2         = color2
        self.color3         = color3
        self.background     = background
        self.speed          = speed         ?? d.speed
        self.lineWidth      = lineWidth     ?? d.lineWidth
        self.lines          = lines         ?? d.lines
        self.spacing        = spacing       ?? d.spacing
        self.channelOffset  = channelOffset ?? d.channelOffset
        self.patternMod     = patternMod    ?? d.patternMod
        self.rotation       = rotation
        self.scale          = scale
        self.centerX        = centerX
        self.centerY        = centerY
        self.angularLobes   = angularLobes
        self.angularAmount  = angularAmount
        self.angularSpeed   = angularSpeed
        self.showsControls  = showsControls
    }

    var body: some View {
        if showsControls {
            SWAnimatedLoopControlled(initial: self)
        } else {
            SWAnimatedLoopRenderer(
                style: style,
                shape: shape,
                petals: petals,
                color1: color1,
                color2: color2,
                color3: color3,
                background: background,
                speed: speed,
                lineWidth: lineWidth,
                lines: lines,
                spacing: spacing,
                channelOffset: channelOffset,
                patternMod: patternMod,
                rotation: rotation,
                scale: scale,
                centerX: centerX,
                centerY: centerY,
                angularLobes: angularLobes,
                angularAmount: angularAmount,
                angularSpeed: angularSpeed
            )
        }
    }
}

// MARK: - Renderer (pure shader binding)

private struct SWAnimatedLoopRenderer: View {
    let style: SWAnimatedLoopStyle
    let shape: SWAnimatedLoopShape
    let petals: Int
    let color1: Color
    let color2: Color
    let color3: Color
    let background: Color
    let speed: Float
    let lineWidth: Float
    let lines: Int
    let spacing: Float
    let channelOffset: Float
    let patternMod: Float
    let rotation: Float
    let scale: Float
    let centerX: Float
    let centerY: Float
    let angularLobes: Float
    let angularAmount: Float
    let angularSpeed: Float

    @State private var start: Date = .now

    var body: some View {
        TimelineView(.a
```

### Core Architecture Module: `ShipSwift/SWPackage/SWModule/SWChat/SWVolcEngineASRService+iOS.swift`
```
//
//  SWVolcEngineASRService+iOS.swift
//  ShipSwift
//
//  VolcEngine automatic speech recognition service client.
//  Streams audio over WebSocket to ByteDance's VolcEngine ASR API,
//  providing real-time and final transcription callbacks.
//
//  Usage:
//    // 1. Create config with VolcEngine credentials
//    let config = SWASRConfig(
//        appId: "your-app-id",
//        accessToken: "your-access-token",
//        cluster: "volcengine_streaming_common",  // default
//        language: "zh-CN"                         // default, or "en-US"
//    )
//
//    // 2. Create service and set callbacks
//    let asr = SWVolcEngineASRService(config: config)
//
//    asr.onTranscriptionUpdate = { text in
//        print("Real-time: \(text)")  // partial results while speaking
//    }
//    asr.onTranscriptionComplete = { text in
//        print("Final: \(text)")      // final result after stop
//    }
//    asr.onError = { error in
//        print("Error: \(error.localizedDescription)")
//    }
//
//    // 3. Start/stop recording
//    try await asr.startRecording()   // requests mic permission, connects WebSocket
//    // ... user speaks ...
//    await asr.stopRecording()        // sends end-of-audio, triggers completion
//
//    // 4. Cancel recording (discards results)
//    asr.cancelRecording()
//
//    // 5. Observable state properties
//    asr.isRecording      // Bool
//    asr.transcribedText  // current transcription text
//    asr.error            // last error, if any
//
//  Created by Wei Zhong on 3/1/26.
//

import AVFoundation
import Compression
import Foundation
import Network

// MARK: - Configuration

/// VolcEngine ASR configuration
public struct SWASRConfig {
    public let appId: String
    public let accessToken: String
    public let cluster: String
    public let language: String

    public init(
        appId: String,
        accessToken: String,
        cluster: String = "volcengine_streaming_common",
        language: String = "zh-CN"
    ) {
        self.appId = appId
        self.accessToken = accessToken
        self.cluster = cluster
        self.language = language
    }
}

// MARK: - ASR Service

/// VolcEngine streaming speech recognition service
///
/// Usage:
/// ```swift
/// let config = SWASRConfig(appId: "xxx", accessToken: "xxx")
/// let asr = SWVolcEngineASRService(config: config)
///
/// asr.onTranscriptionUpdate = { text in print("Realtime: \(text)") }
/// asr.onTranscriptionComplete = { text in print("Complete: \(text)") }
///
/// try await asr.startRecording()
/// // ... user speaks ...
/// await asr.stopRecording()
/// ```
@Observable
public final class SWVolcEngineASRService: @unchecked Sendable {

    // MARK: - Configuration

    private let host = "openspeech.bytedance.com"
    private let port: UInt16 = 443
    private let path = "/api/v2/asr"
    private let config: SWASRConfig

    // MARK: - State

    public private(set) var isRecording = false
    public private(set) var transcribedText = ""
    public private(set) var error: Error?

    // MARK: - Callbacks

    /// Realtime transcription update callback
    public var onTranscriptionUpdate: ((String) -> Void)?
    /// Transcription complete callback
    public var onTranscriptionComplete: ((String) -> Void)?
    /// Error callback
    public var onError: ((Error) -> Void)?

    // MARK: - Private Properties

    private var connection: NWConnection?
    private var audioEngine: AVAudioEngine?
    private var isConnected = false
    private var connectionContinuation: CheckedContinuation<Void, Error>?
    private var receiveBuffer = Data()
    private let queue = DispatchQueue(label: "com.shipswift.asr.websocket")
    private var audioConverter: AVAudioConverter?
    private let targetFormat = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: 16000, channels: 1, interleaved: true)!

    // MARK: - Initialization

    public init(config: SWASRConfig) {
        self.config = config
    }

    // MARK: - Public Methods

    /// Start recording and perform speech recognition
    public func startRecording() async throws {
        guard !isRecording else { return }

        let granted = await requestMicrophonePermission()
        guard granted else {
            throw SWASRError.microphonePermissionDenied
        }

        transcribedText = ""
        error = nil

        try await connectWebSocket()
        try sendFullClientRequest()
        try startAudioEngine()

        isRecording = true
    }

    /// Stop recording
    public func stopRecording() async {
        guard isRecording else { return }

        isRecording = false
        stopAudioEngine()
        sendEndOfAudio()
    }

    /// Cancel recording
    public func cancelRecording() {
        isRecording = false
        stopAudioEngine()
        disconnectWebSocket()
        transcribedText = ""
    }

    // MARK: - Microphone Permission

    private func requestMicrophonePermission() async -> Bool {
        await withCheckedContinuation { continuation in
            AVAudioApplication.requestRecordPermission { granted in
                continuation.resume(returning: granted)
            }
        }
    }

    // MARK: - WebSocket Connection

    private func connectWebSocket() async throws {
        let tlsOptions = NWProtocolTLS.Options()
        let tcpOptions = NWProtocolTCP.Options()
        let params = NWParameters(tls: tlsOptions, tcp: tcpOptions)

        connection = NWConnection(host: NWEndpoint.Host(host), port: NWEndpoint.Port(rawValue: port)!, using: params)

        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            connectionContinuation = continuation

            connection?.stateUpdateHandler = { [weak self] state in
                guard let self else { return }
                Task { @MainActor in
                    switch state {
                    case .ready:
                        self.performWebSocketHandshake()
                    case .failed(let error):
                        self.connectionContinuation?.resume(throwing: error)
                        self.connectionContinuation = nil
                    default:
                        break
                    }
                }
            }

            connection?.start(queue: queue)
        }
    }

    private func performWebSocketHandshake() {
        var keyBytes = [UInt8](repeating: 0, count: 16)
        _ = SecRandomCopyBytes(kSecRandomDefault, 16, &keyBytes)
        let wsKey = Data(keyBytes).base64EncodedString()

        let request = """
        GET \(path) HTTP/1.1\r
        Host: \(host)\r
        Upgrade: websocket\r
        Connection: Upgrade\r
        Sec-WebSocket-Key: \(wsKey)\r
        Sec-WebSocket-Version: 13\r
        Authorization: Bearer;\(config.accessToken)\r
        \r

        """

        connection?.send(content: request.data(using: .utf8), completion: .contentProcessed { [weak self] error in
            if let error = error {
                self?.connectionContinuation?.resume(throwing: error)
                self?.connectionContinuation = nil
            } else {
                self?.receiveHandshakeResponse()
            }
        })
    }

    private func receiveHandshakeResponse() {
        connection?.receive(minimumIncompleteLength: 1, maximumLength: 4096) { [weak self] content, _, _, error in
            guard let self else { return }

            if let error = error {
                self.connectionContinuation?.resume(throwing: error)
                self.connectionContinuation = nil
                return
            }

            if let data = content, let response = String(data: data, encoding: .utf8) {
                if response.contains("101") && response.lowercased().contains("upgrade") {
                    self.isConnected = true
                    self.connectionContinuation?.resume()
                    self.connectionContinuation = nil
                    self.startReceivingFrames()
                } else {
                    self.connectionContinuation?.resume(throwing: SWASRError.connectionFailed)
                    self.connectionContinuation = nil
                }
            }
        }
    }

    private func startReceivingFrames() {
        guard isConnected else { return }

        connection?.receive(minimumIncompleteLength: 2, maximumLength: 65536) { [weak self] content, _, isComplete, error in
            guard let self else { return }

            if error != nil {
                DispatchQueue.main.async {
                    if !self.transcribedText.isEmpty {
                        self.onTranscriptionComplete?(self.transcribedText)
                    }
                }
                return
            }

            if let data = content {
                self.receiveBuffer.append(data)
                self.processWebSocketFrames()
            }

            if isComplete {
                self.isConnected = false
                DispatchQueue.main.async {
                    if !self.transcribedText.isEmpty {
                        self.onTranscriptionComplete?(self.transcribedText)
                    }
                }
            } else {
                self.startReceivingFrames()
            }
        }
    }

    private func processWebSocketFrames() {
        let bufferCopy = Array(receiveBuffer)
        guard bufferCopy.count >= 2 else { return }

        var offset = 0
        while bufferCopy.count - offset >= 2 {
            let firstByte = bufferCopy[offset]
            let secondByte = bufferCopy[offset + 1]

            let isMasked = (secondByte & 0x80) != 0
            var payloadLength = UInt64(secondByte & 0x7F)
            var headerSize = 2

            if payloadLength == 126 {
                guard bufferCopy.count - offset >= 4 else { break }
                payloadLength = UInt64(bufferCopy[offset + 2]) << 8 | UInt64(bufferCopy[offset + 3])
                headerSize = 4
         
```

### Core Architecture Module: `ShipSwift/SWPackage/SWUtil/SWDateExtension.swift`
```
//
//  SWDateExtension.swift
//  ShipSwift
//
//  Date extension providing English/Chinese date formatting, relative time descriptions,
//  date comparison, date arithmetic, and daily reset helper methods.
//  Language follows the "appLanguage" key in UserDefaults ("en" / "zh-Hans").
//
//  Usage:
//    // Formatted output (automatically adapts to English/Chinese):
//    Date().formatMonth()       // "Jan" or "1月"
//    Date().formatDay()         // "15"
//    Date().formatMonthDay()    // "Jan 15" or "1月15日"
//    Date().formatFullDate()    // "Jan 15, 2025" or "2025年1月15日"
//    Date().formatTime()        // "14:30"
//    Date().formatDateTime()    // "Jan 15, 14:30" or "1月15日 14:30"
//
//    // Relative time:
//    someDate.timeAgo()         // "Just now" / "3 min ago" / "Yesterday" / "Jan 15"
//
//    // Date comparison:
//    date.isToday               // Bool
//    date.isYesterday           // Bool
//    date.isSameDay(as: other)  // Bool
//    date.startOfDay            // Start of the day 00:00:00
//    date.endOfDay              // End of the day 23:59:59
//
//    // Date arithmetic:
//    date.adding(days: 7)       // 7 days later
//    date.adding(months: -1)    // 1 month ago
//    date.days(from: earlier)   // Number of days between two dates
//
//    // Daily reset detection (suitable for check-in / quota scenarios):
//    if Date.shouldResetDaily(dateKey: "lastCheckIn") {
//        resetCounter()
//        Date.updateDailyResetDate(dateKey: "lastCheckIn")
//    }
//
//  Created by Wei Zhong on 3/1/26.
//

import Foundation

// MARK: - App Language Helper

private var appLanguage: String {
    UserDefaults.standard.string(forKey: "appLanguage") ?? "en"
}

private var isEnglish: Bool {
    appLanguage == "en"
}

private var currentLocale: Locale {
    Locale(identifier: appLanguage)
}

// MARK: - Date Formatting

extension Date {

    // MARK: - Basic Formatting

    /// Format as month
    /// - Returns: `Jan` / `1月`
    func formatMonth() -> String {
        let formatter = DateFormatter()
        formatter.locale = currentLocale
        formatter.dateFormat = isEnglish ? "MMM" : "M月"
        return formatter.string(from: self)
    }

    /// Format as day
    /// - Returns: `15`
    func formatDay() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "d"
        return formatter.string(from: self)
    }

    /// Format as month and day
    /// - Returns: `Jan 15` / `1月15日`
    func formatMonthDay() -> String {
        let formatter = DateFormatter()
        formatter.locale = currentLocale
        formatter.dateFormat = isEnglish ? "MMM d" : "M月d日"
        return formatter.string(from: self)
    }

    /// Format as full date
    /// - Returns: `Jan 15, 2025` / `2025年1月15日`
    func formatFullDate() -> String {
        let formatter = DateFormatter()
        formatter.locale = currentLocale
        formatter.dateFormat = isEnglish ? "MMM d, yyyy" : "yyyy年M月d日"
        return formatter.string(from: self)
    }

    /// Format as time
    /// - Returns: `14:30`
    func formatTime() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: self)
    }

    /// Format as date and time
    /// - Returns: `Jan 15, 14:30` / `1月15日 14:30`
    func formatDateTime() -> String {
        "\(formatMonthDay()) \(formatTime())"
    }

    // MARK: - Relative Time

    /// Relative time description
    /// - Returns: `Just now` / `3 min ago` / `2 hours ago` / `Yesterday` / `Jan 15`
    func timeAgo() -> String {
        let now = Date()
        let interval = now.timeIntervalSince(self)

        // Future date
        if interval < 0 {
            return formatMonthDay()
        }

        // Within 1 minute
        if interval < 60 {
            return isEnglish ? "Just now" : "刚刚"
        }

        // Within 1 hour
        if interval < 3600 {
            let minutes = Int(interval / 60)
            return isEnglish ? "\(minutes) min ago" : "\(minutes)分钟前"
        }

        // Within 24 hours
        if interval < 86400 {
            let hours = Int(interval / 3600)
            return isEnglish ? "\(hours) hour\(hours > 1 ? "s" : "") ago" : "\(hours)小时前"
        }

        // Yesterday
        if Calendar.current.isDateInYesterday(self) {
            return isEnglish ? "Yesterday" : "昨天"
        }

        // Within 7 days
        if interval < 604800 {
            let days = Int(interval / 86400)
            return isEnglish ? "\(days) day\(days > 1 ? "s" : "") ago" : "\(days)天前"
        }

        // More than 7 days, show date
        return formatMonthDay()
    }

    // MARK: - Date Comparison

    /// Whether the date is today
    var isToday: Bool {
        Calendar.current.isDateInToday(self)
    }

    /// Whether the date is yesterday
    var isYesterday: Bool {
        Calendar.current.isDateInYesterday(self)
    }

    /// Whether the date is tomorrow
    var isTomorrow: Bool {
        Calendar.current.isDateInTomorrow(self)
    }

    /// Whether this date is the same day as another date
    func isSameDay(as other: Date) -> Bool {
        Calendar.current.isDate(self, inSameDayAs: other)
    }

    /// Get the start of day (00:00:00)
    var startOfDay: Date {
        Calendar.current.startOfDay(for: self)
    }

    /// Get the end of day (23:59:59)
    var endOfDay: Date {
        Calendar.current.date(byAdding: .day, value: 1, to: startOfDay)!.addingTimeInterval(-1)
    }

    // MARK: - Date Arithmetic

    /// Add days
    func adding(days: Int) -> Date {
        Calendar.current.date(byAdding: .day, value: days, to: self) ?? self
    }

    /// Add months
    func adding(months: Int) -> Date {
        Calendar.current.date(byAdding: .month, value: months, to: self) ?? self
    }

    /// Add years
    func adding(years: Int) -> Date {
        Calendar.current.date(byAdding: .year, value: years, to: self) ?? self
    }

    /// Number of days between two dates
    func days(from other: Date) -> Int {
        Calendar.current.dateComponents([.day], from: other.startOfDay, to: self.startOfDay).day ?? 0
    }
}

// MARK: - Daily Reset Helper

extension Date {
    /// Check whether the daily counter needs to be reset
    /// - Parameter key: The key used to store the date in UserDefaults
    /// - Returns: Whether a reset is needed (day has changed)
    static func shouldResetDaily(dateKey: String) -> Bool {
        let today = Date().startOfDay
        let lastDate = UserDefaults.standard.object(forKey: dateKey) as? Date ?? .distantPast
        return !today.isSameDay(as: lastDate)
    }

    /// Update the daily reset date
    /// - Parameter key: The key used to store the date in UserDefaults
    static func updateDailyResetDate(dateKey: String) {
        UserDefaults.standard.set(Date().startOfDay, forKey: dateKey)
    }
}

```

### Core Architecture Module: `ShipSwift/SWPackage/SWUtil/SWDebugLog.swift`
```
//
//  SWDebugLog.swift
//  ShipSwift
//
//  Debug logging utility functions that only print in DEBUG mode, with zero overhead
//  in Release builds (#if DEBUG + @inline(__always)). Provides two overloads:
//  simple print and print with file name/line number.
//
//  Usage:
//    // Overload 1 — multi-argument print (similar to print, supports custom separator and terminator):
//    swDebugLog("UserID:", userId, "Status:", status)
//    swDebugLog("A", "B", "C", separator: "-")
//    // Output: A-B-C
//
//    // Overload 2 — print with file name and line number (automatically captures call site):
//    swDebugLog("Network request failed")
//    // Output: [ViewModel.swift:42] Network request failed
//
//    // In Release mode, all swDebugLog calls are completely removed by the compiler with no performance impact.
//
//  Created by Wei Zhong on 3/1/26.
//

import Foundation

// MARK: - Debug Logging

/// Prints log messages in Debug mode, completely removed in Release (zero overhead)
@inline(__always)
nonisolated func swDebugLog(_ items: Any..., separator: String = " ", terminator: String = "\n") {
    #if DEBUG
    let output = items.map { "\($0)" }.joined(separator: separator)
    print(output, terminator: terminator)
    #endif
}

/// Prints log messages with file and line info in Debug mode
@inline(__always)
nonisolated func swDebugLog(_ message: @autoclosure () -> String, file: String = #file, line: Int = #line) {
    #if DEBUG
    let filename = (file as NSString).lastPathComponent
    print("[\(filename):\(line)] \(message())")
    #endif
}

```

### Core Architecture Module: `ShipSwift/SWPackage/SWUtil/SWLocationManager.swift`
```
//
//  SWLocationManager.swift
//  ShipSwift
//
//  CoreLocation-based location manager (@Observable) that encapsulates authorization
//  requests, location updates, and reverse geocoding. Automatically stops updates after
//  obtaining a location to conserve battery. Results are stored in currentLocation
//  (SWLocationManager.Location).
//
//  Usage:
//    // 1. Initialize (recommended at the App level or in a ViewModel):
//    @State private var locationManager = SWLocationManager()
//
//    // 2. Request location (automatically handles authorization status: requests authorization
//    //    if not determined, starts updates directly if already authorized):
//    locationManager.startLocationServices()
//
//    // 3. Read location results (@Observable drives automatic UI refresh):
//    if let location = locationManager.currentLocation {
//        Text(location.name)                    // City name (reverse geocoding)
//        Text("\(location.latitude), \(location.longitude)")
//        let coord = location.coordinate        // CLLocationCoordinate2D
//    }
//
//    // 4. Check authorization status:
//    locationManager.isAuthorized               // Whether authorized
//    locationManager.isAuthorizationDetermined  // Whether the user has made a choice
//
//    // 5. Guide the user to system Settings (when authorization is denied):
//    locationManager.openSettings()
//
//    // 6. Built-in Location data model (Identifiable, Equatable, Codable):
//    let saved = SWLocationManager.Location(
//        name: "Beijing", latitude: 39.9042, longitude: 116.4074
//    )
//
//  Created by Wei Zhong on 3/1/26.
//

import CoreLocation
#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

@MainActor
@Observable
final class SWLocationManager: NSObject {

    // MARK: - Built-in Data Model

    /// Location info model
    struct Location: Identifiable, Equatable, Codable {
        let id: UUID
        let name: String
        let latitude: Double
        let longitude: Double

        init(id: UUID = UUID(), name: String, latitude: Double, longitude: Double) {
            self.id = id
            self.name = name
            self.latitude = latitude
            self.longitude = longitude
        }

        /// Convert to CLLocationCoordinate2D
        var coordinate: CLLocationCoordinate2D {
            CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
        }

        /// Convert to CLLocation
        var clLocation: CLLocation {
            CLLocation(latitude: latitude, longitude: longitude)
        }
    }

    // MARK: - Properties

    private(set) var userLocation: CLLocation?
    private(set) var currentLocation: Location?
    private(set) var isAuthorized = false

    var isAuthorizationDetermined: Bool {
        manager.authorizationStatus != .notDetermined
    }

    @ObservationIgnored
    private let manager = CLLocationManager()

    @ObservationIgnored
    private let geocoder = CLGeocoder()

    #if os(iOS)
    private static let authorizedStatuses: Set<CLAuthorizationStatus> = [.authorizedAlways, .authorizedWhenInUse]
    #else
    private static let authorizedStatuses: Set<CLAuthorizationStatus> = [.authorizedAlways]
    #endif

    // MARK: - Initialization

    override init() {
        super.init()
        manager.delegate = self
        updateAuthorizationStatus()
    }

    // MARK: - Public Methods

    func startLocationServices() {
        userLocation = nil
        currentLocation = nil
        updateAuthorizationStatus()

        if isAuthorized {
            manager.startUpdatingLocation()
        } else if manager.authorizationStatus == .notDetermined {
            manager.requestWhenInUseAuthorization()
        }
    }

    func openSettings() {
        #if os(iOS)
        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
        UIApplication.shared.open(url)
        #elseif os(macOS)
        NSWorkspace.shared.open(URL(string: "x-apple.systempreferences:")!)
        #endif
    }

    // MARK: - Private Methods

    private func updateAuthorizationStatus() {
        isAuthorized = Self.authorizedStatuses.contains(manager.authorizationStatus)
    }

    private func resolveLocationName(for location: CLLocation) async -> String {
        let placemarks = try? await geocoder.reverseGeocodeLocation(location)
        return placemarks?.first?.locality ?? ""
    }
}

// MARK: - CLLocationManagerDelegate

extension SWLocationManager: CLLocationManagerDelegate {

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }

        Task { @MainActor in
            userLocation = location
            let name = await resolveLocationName(for: location)
            currentLocation = Location(
                name: name,
                latitude: location.coordinate.latitude,
                longitude: location.coordinate.longitude
            )
            manager.stopUpdatingLocation()
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in
            updateAuthorizationStatus()
            if isAuthorized {
                manager.startUpdatingLocation()
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: any Error) {
        // Silently handle errors
    }
}

```

### Core Architecture Module: `ShipSwift/SWPackage/SWUtil/SWStringExtension.swift`
```
//
//  SWStringExtension.swift
//  ShipSwift
//
//  String extension providing computed properties for email and phone number format validation.
//
//  Usage:
//    // Email validation — matches standard email format (user@domain.tld):
//    "hello@example.com".isValidEmail   // true
//    "not-an-email".isValidEmail        // false
//
//    // Phone number validation — digits only, 8-15 characters (supports international numbers):
//    "13800138000".isValidPhone         // true
//    "123".isValidPhone                 // false (fewer than 8 digits)
//    "+1-555-1234".isValidPhone         // false (contains non-digit characters)
//
//    // Common usage — validate before form submission:
//    Button("Submit") { submit() }
//        .disabled(!email.isValidEmail || !phone.isValidPhone)
//
//  Created by Wei Zhong on 3/1/26.
//

import Foundation

extension String {
    /// Validate email format
    var isValidEmail: Bool {
        let emailRegex = #"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"#
        return range(of: emailRegex, options: .regularExpression) != nil
    }

    /// Validate phone number format (8-15 digits, international)
    var isValidPhone: Bool {
        let phoneRegex = #"^\d{8,15}$"#
        return range(of: phoneRegex, options: .regularExpression) != nil
    }
}

```

### Core Architecture Module: `ShipSwift/SWPackage/SWUtil/SWViewExtension.swift`
```
//
//  SWViewExtension.swift
//  ShipSwift
//
//  SwiftUI view extensions including SWButtonStyle (primary/secondary button styles) and
//  the swCardStyle card modifier. Button styles are full-width rounded rectangles with
//  automatic pressed/disabled state handling; card style features a gradient stroke.
//
//  Usage:
//    // Primary button (accent background + white text, for confirm/save main actions):
//    Button("Save") { save() }
//        .buttonStyle(.swPrimary)
//
//    // Secondary button (light background, for cancel/close secondary actions):
//    Button("Cancel") { dismiss() }
//        .buttonStyle(.swSecondary)
//
//    // Custom border and corner radius:
//    Button("Submit") { submit() }
//        .buttonStyle(.swPrimary(showBorder: true, cornerRadius: 12))
//
//    // Card style modifier (gradient stroke + translucent background):
//    VStack { content }
//        .swCardStyle()
//
//    // Custom card parameters:
//    VStack { content }
//        .swCardStyle(strokeColor: .cyan, cornerRadius: 24, padding: 24, strokeWidth: 1.0)
//
//  Created by Wei Zhong on 3/1/26.
//

import SwiftUI

// MARK: - Button Style

struct SWButtonStyle: ButtonStyle {
    enum Variant {
        case primary
        case secondary
    }

    @Environment(\.isEnabled) private var isEnabled

    let variant: Variant
    var showBorder: Bool = false
    var cornerRadius: CGFloat = 16

    private var backgroundColor: Color {
        switch variant {
        case .primary: .accent
        case .secondary: .accent.opacity(0.1)
        }
    }

    private var foregroundColor: Color {
        switch variant {
        case .primary: .white
        case .secondary: .primary.opacity(0.8)
        }
    }

    private var borderColor: Color {
        switch variant {
        case .primary: .primary
        case .secondary: .secondary.opacity(0.8)
        }
    }

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .frame(maxWidth: .infinity)
            .padding()
            .background(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .fill(backgroundColor)
            )
            .foregroundStyle(foregroundColor)
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .strokeBorder(
                        showBorder ? borderColor : .clear,
                        lineWidth: 1.5
                    )
            )
            .contentShape(RoundedRectangle(cornerRadius: cornerRadius))
            .opacity(isEnabled ? (configuration.isPressed ? 0.7 : 1) : 0.5)
    }
}

extension ButtonStyle where Self == SWButtonStyle {
    /// Primary button style (confirm / save, etc.)
    static var swPrimary: SWButtonStyle { .init(variant: .primary) }
    /// Secondary button style (cancel / close, etc.)
    static var swSecondary: SWButtonStyle { .init(variant: .secondary) }

    static func swPrimary(showBorder: Bool = true, cornerRadius: CGFloat = 12) -> SWButtonStyle {
        .init(variant: .primary, showBorder: showBorder, cornerRadius: cornerRadius)
    }

    static func swSecondary(showBorder: Bool = true, cornerRadius: CGFloat = 12) -> SWButtonStyle {
        .init(variant: .secondary, showBorder: showBorder, cornerRadius: cornerRadius)
    }
}

// MARK: - Card Style
// Usage:
//   Text("Content").swCardStyle()
//   Text("Content").swCardStyle(strokeColor: .cyan, cornerRadius: 20)

extension View {
    /// Card style modifier
    /// - Parameters:
    ///   - strokeColor: Starting color for the border gradient
    ///   - background: Background color
    ///   - cornerRadius: Corner radius
    ///   - padding: Inner padding
    ///   - strokeWidth: Border width
    func swCardStyle(
        strokeColor: Color = .accentColor,
        background: Color = .white.opacity(0.1),
        cornerRadius: CGFloat = 16,
        padding: CGFloat = 16,
        strokeWidth: CGFloat = 0.6
    ) -> some View {
        self
            .padding(padding)
            .background(background)
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .strokeBorder(
                        LinearGradient(
                            colors: [
                                strokeColor,
                                strokeColor.opacity(0.6),
                                strokeColor.opacity(0.3),
                                .clear
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: strokeWidth
                    )
            )
    }
}

// MARK: - Preview

#Preview("Button Styles") {
    VStack(spacing: 20) {
        Button("Primary Button") { }
            .buttonStyle(.swPrimary)

        Button("Secondary Button") { }
            .buttonStyle(.swSecondary)

        Button("Disabled") { }
            .buttonStyle(.swPrimary)
            .disabled(true)
    }
    .padding()
}

#Preview("Card Styles") {
    VStack(spacing: 20) {
        VStack {
            ForEach(0..<3, id: \.self) { _ in
                Text("Default Card")
            }
        }
        .frame(maxWidth: .infinity)
        .swCardStyle()

        VStack {
            ForEach(0..<3, id: \.self) { _ in
                Text("Custom Card")
            }
        }
        .frame(maxWidth: .infinity)
        .swCardStyle(strokeColor: .cyan, cornerRadius: 24, padding: 24)
    }
    .padding()
}

```

### Core Architecture Module: `ShipSwift/Component/ListItem.swift`
```
//
//  ListItem.swift
//  ShipSwift
//
//  Created by Wei Zhong on 13/2/26.
//

import SwiftUI

struct ListItem: View {
    let title: String
    let icon: String
    let description: String

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label(title, systemImage: icon)

            Text(description)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }
}

#Preview {
    List {
        ListItem(
            title: "Before / After",
            icon: "slider.horizontal.below.rectangle",
            description: "Image comparison view with auto-oscillating slider and drag gesture."
        )
    }
}

```

### Core Architecture Module: `ShipSwift/SWPackage/SWAnimation/SWAnimatedMeshGradient.swift`
```
//
//  SWAnimatedMeshGradient.swift
//  ShipSwift
//
//  Animated 3x3 mesh gradient background that smoothly transitions between
//  two color palettes using a repeating easeInOut animation. Designed as a
//  full-screen or section background layer.
//
//  Usage:
//    // Default indigo/blue/cyan palette
//    ZStack {
//        SWAnimatedMeshGradient()
//            .ignoresSafeArea()
//        // Your content here
//    }
//
//    // As a section background
//    myContent
//        .background { SWAnimatedMeshGradient() }
//
//    // Custom color palette
//    SWAnimatedMeshGradient(
//        paletteA: [
//            .red.opacity(0.9),  .orange.opacity(0.85), .yellow.opacity(0.8),
//            .orange.opacity(0.85), .red.opacity(0.9),  .orange.opacity(0.85),
//            .yellow.opacity(0.8),  .orange.opacity(0.85), .red.opacity(0.9)
//        ],
//        paletteB: [
//            .yellow.opacity(0.8),  .red.opacity(0.9),    .orange.opacity(0.85),
//            .red.opacity(0.85),    .orange.opacity(0.9),  .yellow.opacity(0.85),
//            .orange.opacity(0.85), .yellow.opacity(0.8),  .red.opacity(0.9)
//        ]
//    )
//
//    // Custom animation duration
//    SWAnimatedMeshGradient(duration: 8.0)
//
//  Parameters:
//    - paletteA: First 9-color array for the 3x3 mesh (row-major order)
//    - paletteB: Second 9-color array to transition to
//    - duration: Animation cycle duration in seconds (default 5.0)
//
//  Notes:
//    - Both palettes must contain exactly 9 colors for the 3x3 grid
//    - The animation auto-reverses, creating a seamless loop
//
//  Created by Wei Zhong on 3/1/26.
//

import SwiftUI

struct SWAnimatedMeshGradient: View {
    /// First color palette (9 colors, 3x3 grid, row-major order)
    var paletteA: [Color] = [
        .indigo.opacity(0.9),  .blue.opacity(0.85),   .cyan.opacity(0.8),
        .blue.opacity(0.85),   .indigo.opacity(0.9),  .blue.opacity(0.85),
        .cyan.opacity(0.8),    .blue.opacity(0.85),   .indigo.opacity(0.9)
    ]

    /// Second color palette (9 colors, 3x3 grid, row-major order)
    var paletteB: [Color] = [
        .cyan.opacity(0.8),    .indigo.opacity(0.9),  .blue.opacity(0.85),
        .indigo.opacity(0.85), .blue.opacity(0.9),    .cyan.opacity(0.85),
        .blue.opacity(0.85),   .cyan.opacity(0.8),    .indigo.opacity(0.9)
    ]

    /// Animation cycle duration in seconds
    var duration: Double = 5.0

    @State private var appear = false

    var body: some View {
        MeshGradient(width: 3, height: 3, points: [
            .init(0, 0), .init(0.5, 0), .init(1, 0),
            .init(0, 0.5), .init(0.5, 0.5), .init(1, 0.5),
            .init(0, 1), .init(0.5, 1), .init(1, 1)
        ], colors: appear ? paletteA : paletteB)
        .onAppear {
            withAnimation(.easeInOut(duration: duration).repeatForever(autoreverses: true)) {
                appear = true
            }
        }
    }
}

// MARK: - Preview

#Preview("Default") {
    SWAnimatedMeshGradient()
        .ignoresSafeArea()
}

#Preview("Custom Palette") {
    SWAnimatedMeshGradient(
        paletteA: [
            .red.opacity(0.9),  .orange.opacity(0.85), .yellow.opacity(0.8),
            .orange.opacity(0.85), .red.opacity(0.9),  .orange.opacity(0.85),
            .yellow.opacity(0.8),  .orange.opacity(0.85), .red.opacity(0.9)
        ],
        paletteB: [
            .yellow.opacity(0.8),  .red.opacity(0.9),    .orange.opacity(0.85),
            .red.opacity(0.85),    .orange.opacity(0.9),  .yellow.opacity(0.85),
            .orange.opacity(0.85), .yellow.opacity(0.8),  .red.opacity(0.9)
        ],
        duration: 3.0
    )
    .ignoresSafeArea()
}

```

### Core Architecture Module: `ShipSwift/SWPackage/SWAnimation/SWBeforeAfterSlider.swift`
```
//
//  SWBeforeAfterSlider.swift
//  ShipSwift
//
//  Before/after image comparison view with an auto-oscillating slider
//  divider. The slider sweeps back and forth to reveal the "before" and
//  "after" images, with optional Before/After labels.
//
//  Usage:
//    // Basic usage with two images
//    SWBeforeAfterSlider(
//        before: Image("photo_before"),
//        after: Image("photo_after")
//    )
//
//    // Customized size, aspect ratio, and animation speed
//    SWBeforeAfterSlider(
//        before: Image("old"),
//        after: Image("new"),
//        width: 300,               // default 360
//        aspectRatio: 16.0 / 9.0,  // default 3/4 (portrait)
//        cornerRadius: 16,         // default 24
//        speed: 1.2,               // oscillation speed, default 0.8
//        showLabels: false,         // hide Before/After labels
//        beforeLabel: "Old",        // custom label text, default "Before"
//        afterLabel: "New"          // custom label text, default "After"
//    )
//
//    // Supports drag gesture — drag the slider to compare manually,
//    // auto-animation resumes seamlessly after release.
//
//  Created by Wei Zhong on 3/1/26.
//

import SwiftUI

struct SWBeforeAfterSlider: View {
    let before: Image
    let after: Image
    var width: CGFloat = 360
    var aspectRatio: CGFloat = 3.0 / 4.0
    var cornerRadius: CGFloat = 24
    var speed: Double = 0.8
    var showLabels: Bool = true
    var beforeLabel: String = "Before"
    var afterLabel: String = "After"

    private var height: CGFloat { width / aspectRatio }

    @State private var startDate = Date.now
    @State private var isDragging = false
    @State private var dragSliderPos: CGFloat = 0.5

    var body: some View {
        TimelineView(.animation(paused: isDragging)) { timeline in
            let sliderPos: CGFloat = isDragging
                ? dragSliderPos
                : 0.5 + sin(timeline.date.timeIntervalSince(startDate) * speed) * 0.3
            let sliderX = sliderPos * width

            ZStack {
                // Bottom layer (Before)
                before
                    .resizable()
                    .scaledToFill()
                    .frame(width: width, height: height)
                    .clipShape(RoundedRectangle(cornerRadius: cornerRadius))

                // Top layer (After) - clipped by mask
                after
                    .resizable()
                    .scaledToFill()
                    .frame(width: width, height: height)
                    .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
                    .mask(
                        HStack(spacing: 0) {
                            Rectangle()
                                .frame(width: sliderX)
                            Spacer(minLength: 0)
                        }
                        .frame(width: width)
                    )

                // Divider line
                Rectangle()
                    .fill(.ultraThinMaterial)
                    .frame(width: 3, height: height)
                    .offset(x: sliderX - width / 2)

                // Slider handle
                Image(systemName: "arrow.left.and.right.circle.fill")
                    .font(.largeTitle)
                    .foregroundStyle(
                        .tertiary,
                        .white.opacity(0.8)
                    )
                    .offset(x: sliderX - width / 2)

                // Before / After labels
                if showLabels {
                    HStack {
                        labelTag(beforeLabel)
                            .padding(12)
                        Spacer()
                        labelTag(afterLabel)
                            .padding(12)
                    }
                    .frame(width: width, height: height, alignment: .bottom)
                }
            }
            .contentShape(Rectangle())
            .gesture(dragGesture)
        }
    }

    private func labelTag(_ text: String) -> some View {
        Text(text)
            .font(.caption)
            .fontWeight(.medium)
            .foregroundStyle(.white)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(.ultraThinMaterial, in: Capsule())
    }

    private var dragGesture: some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                if !isDragging { isDragging = true }
                dragSliderPos = min(max(value.location.x / width, 0.05), 0.95)
            }
            .onEnded { _ in
                // Resume auto-animation from the current drag position
                let normalized = min(max((dragSliderPos - 0.5) / 0.3, -1.0), 1.0)
                let phase = Double(asin(normalized)) / speed
                startDate = Date.now.addingTimeInterval(-phase)
                isDragging = false
            }
    }
}

// MARK: - Preview

#Preview {
    SWBeforeAfterSlider(
        before: Image(.smileBefore),
        after: Image(.smileAfter)
    )
    .padding()
}

```

### Core Architecture Module: `ShipSwift/SWPackage/SWAnimation/SWChangeEffect.swift`
```
//
//  SWChangeEffect.swift
//  ShipSwift
//
//  Eight micro-interaction effects that fire whenever an Equatable value
//  changes, built on modern iOS 17+ APIs (KeyframeAnimator, PhaseAnimator,
//  sensoryFeedback, Canvas). Attach one modifier, change the trigger
//  value, and the effect plays once:
//
//    - swShake:   horizontal shake with decaying amplitude (wrong input)
//    - swJump:    squat, leap and land with squash & stretch
//    - swSpin:    one full rotation with smooth easing
//    - swPing:    expanding rings radiating from behind the view
//    - swSpray:   cone of tinted SF Symbol particles shooting upward
//    - swRise:    floating "+1"-style text that drifts up and fades
//    - swHaptic:  thin bridge over .sensoryFeedback for discoverability
//    - SWShine:   one-shot highlight sweep masked to the content (wrapper)
//
//  Usage:
//    // Shake on failed attempts
//    PasswordField()
//        .swShake(trigger: failedAttempts)
//
//    // Like button: hearts spray + counter rises
//    Button { likes += 1 } label: { Image(systemName: "heart.fill") }
//        .swSpray(trigger: likes, symbol: "heart.fill",
//                 colors: [.red, .pink, .orange])
//        .swRise(trigger: likes, text: "+1", color: .red)
//
//    // One-shot shine (view wrapper, masks to content shape)
//    SWShine(trigger: purchased) {
//        ProBadge()
//    }
//
//    // Haptics — same as .sensoryFeedback, kept for discoverability
//    view.swHaptic(.success, trigger: purchased)
//
//  All effects are additive: stack multiple modifiers on the same view
//  and drive them from the same trigger.
//
//  Created by Wei Zhong on 2/8/26.
//

import SwiftUI

// MARK: - Shake

extension View {
    /// Shakes the view horizontally with decaying amplitude when
    /// `trigger` changes. Classic "wrong password" feedback.
    func swShake(trigger: some Equatable, amplitude: Double = 9) -> some View {
        keyframeAnimator(
            initialValue: 0.0,
            trigger: trigger
        ) { content, offset in
            content.offset(x: offset)
        } keyframes: { _ in
            KeyframeTrack {
                CubicKeyframe(-amplitude, duration: 0.06)
                CubicKeyframe(amplitude * 0.9, duration: 0.07)
                CubicKeyframe(-amplitude * 0.7, duration: 0.07)
                CubicKeyframe(amplitude * 0.5, duration: 0.07)
                CubicKeyframe(-amplitude * 0.3, duration: 0.07)
                CubicKeyframe(0.0, duration: 0.08)
            }
        }
    }
}

// MARK: - Jump

/// Keyframe state for the jump effect.
private struct SWJumpState {
    var y: Double = 0
    var stretch: Double = 1
}

extension View {
    /// Makes the view squat, leap up and land with cartoon
    /// squash-and-stretch when `trigger` changes.
    func swJump(trigger: some Equatable, height: Double = 40) -> some View {
        keyframeAnimator(
            initialValue: SWJumpState(),
            trigger: trigger
        ) { content, state in
            content
                .scaleEffect(
                    x: 2 - state.stretch,
                    y: state.stretch,
                    anchor: .bottom
                )
                .offset(y: state.y)
        } keyframes: { _ in
            KeyframeTrack(\.y) {
                // Squat, spring into the air, then drop back down.
                CubicKeyframe(0, duration: 0.10)
                CubicKeyframe(-height, duration: 0.24)
                CubicKeyframe(0, duration: 0.18)
                SpringKeyframe(0, duration: 0.2, spring: .bouncy)
            }
            KeyframeTrack(\.stretch) {
                CubicKeyframe(0.85, duration: 0.10)   // squat
                CubicKeyframe(1.12, duration: 0.20)   // stretch upward
                CubicKeyframe(1.0, duration: 0.18)
                CubicKeyframe(0.88, duration: 0.06)   // land squash
                SpringKeyframe(1.0, duration: 0.18, spring: .bouncy)
            }
        }
    }
}

// MARK: - Spin

extension View {
    /// Rotates the view one full turn when `trigger` changes.
    func swSpin(trigger: some Equatable, duration: Double = 0.6) -> some View {
        keyframeAnimator(
            initialValue: 0.0,
            trigger: trigger
        ) { content, angle in
            content.rotationEffect(.degrees(angle))
        } keyframes: { _ in
            KeyframeTrack {
                CubicKeyframe(360, duration: duration)
            }
        }
    }
}

// MARK: - Ping

/// Keyframe state for one ping ring.
private struct SWPingRingState {
    var scale: Double = 1
    var opacity: Double = 0
}

/// One expanding ring; `delay` staggers rings within a burst.
private struct SWPingRing: View {
    let fire: Int
    let delay: Double
    let color: Color

    var body: some View {
        Circle()
            .stroke(color, lineWidth: 2)
            .keyframeAnimator(
                initialValue: SWPingRingState(),
                trigger: fire
            ) { content, state in
                content
                    .scaleEffect(state.scale)
                    .opacity(state.opacity)
            } keyframes: { _ in
                KeyframeTrack(\.scale) {
                    LinearKeyframe(1.0, duration: delay)
                    CubicKeyframe(2.4, duration: 0.9)
                }
                KeyframeTrack(\.opacity) {
                    LinearKeyframe(0.0, duration: delay)
                    LinearKeyframe(0.7, duration: 0.05)
                    LinearKeyframe(0.0, duration: 0.85)
                }
            }
    }
}

private struct SWPingModifier<Trigger: Equatable>: ViewModifier {
    let trigger: Trigger
    let color: Color
    let rings: Int

    @State private var fireCount = 0

    func body(content: Content) -> some View {
        content
            .background {
                ZStack {
                    ForEach(0..<rings, id: \.self) { index in
                        SWPingRing(
                            fire: fireCount,
                            delay: Double(index) * 0.18,
                            color: color
                        )
                    }
                }
                .allowsHitTesting(false)
            }
            .onChange(of: trigger) {
                fireCount += 1
            }
    }
}

extension View {
    /// Radiates expanding rings from behind the view when `trigger`
    /// changes. Great on notification bells and record buttons.
    func swPing(
        trigger: some Equatable,
        color: Color = .accentColor,
        rings: Int = 2
    ) -> some View {
        modifier(SWPingModifier(trigger: trigger, color: color, rings: rings))
    }
}

// MARK: - Spray

/// One particle in a spray or rise burst.
private struct SWSprayParticle {
    var birth: Date
    var startX: Double
    var vx: Double
    var vy: Double
    var size: Double
    var spin: Double
    var color: Color
}

private struct SWSprayModifier<Trigger: Equatable>: ViewModifier {
    let trigger: Trigger
    let symbol: String
    let colors: [Color]

    @State private var particles: [SWSprayParticle] = []

    private let lifetime = 0.9
    private let gravity = 480.0

    func body(content: Content) -> some View {
        content
            .overlay {
                TimelineView(.animation(paused: particles.isEmpty)) { ctx in
                    Canvas { gc, size in
                        let origin = CGPoint(x: size.width / 2, y: size.height / 2)
                        for p in particles {
                            let t = ctx.date.timeIntervalSince(p.birth)
                            guard t >= 0, t <= lifetime else { continue }

                            let life = t / lifetime
                            let px = origin.x + p.startX + p.vx * t
                            let py = origin.y + p.vy * t + 0.5 * gravity * t * t
                            let alpha = life < 0.6 ? 1.0 : 1 - (life - 0.6) / 0.4

                            var image = gc.resolve(Image(systemName: symbol))
                            image.shading = .color(p.color)

                            gc.drawLayer { layer in
                                layer.opacity = alpha
                                layer.translateBy(x: px, y: py)
                                layer.rotate(by: .degrees(p.spin * t))
                                layer.draw(
                                    image,
                                    in: CGRect(
                                        x: -p.size / 2, y: -p.size / 2,
                                        width: p.size, height: p.size
                                    )
                                )
                            }
                        }
                    }
                }
                .padding(-90)
                .allowsHitTesting(false)
            }
            .onChange(of: trigger) {
                fire()
            }
    }

    private func fire() {
        guard !colors.isEmpty else { return }
        let now = Date.now
        let fresh = (0..<11).map { i in
            // Upward cone between -55° and -125°.
            let angle = Double.random(in: (-125.0)...(-55.0)) * .pi / 180
            let speed = Double.random(in: 220...380)
            return SWSprayParticle(
                birth: now.addingTimeInterval(.random(in: 0...0.06)),
                startX: .random(in: -10...10),
                vx: cos(angle) * speed,
                vy: sin(angle) * speed,
                size: .random(in: 10...18),
                spin: .random(in: -220...220),
                color: colors[i % colors.count]
            )
        }
        // Keep any particles still alive so rapid taps overlap nicely.
        particles = particles.filter {
            now.timeIntervalSince($0.birth) < lifetime
        } + fresh
    }
}

extension View {
    /// Sprays a cone of tinted SF Symbol particles upward from the view
    /// when `trigger` changes. The go-to for like buttons.
   
```

### Core Architecture Module: `ShipSwift/SWPackage/SWAnimation/SWCharSphere.swift`
```
//
//  SWCharSphere.swift
//  ShipSwift
//
//  Rotating 3D sphere where each point is a glyph drawn at its
//  perspective-projected position. A user-supplied character palette
//  (`chars: [String]`) is randomly assigned across sphere points — the
//  assignment is baked at cloud-init so it doesn't flicker between
//  frames. Optional back-face culling, perspective-scaled font, and a
//  color wave that washes the palette up the sphere.
//
//  Rendered with a single SwiftUI `Canvas` per frame so 100–300
//  glyphs stay at 60fps on iPhone.
//
//  Algorithms used (both well-known graphics primitives):
//    - Spherical Fibonacci point set:
//        y = 1 − 2i / (N − 1)
//        θ = i · π(3 − √5)
//        (x, z) = √(1 − y²) · (cos θ, sin θ)
//    - One-axis perspective projection:
//        screen = world · (focal / (focal + z))
//
//  Requires iOS 17+ / macOS 14+ (SwiftUI `TimelineView`, `Canvas`).
//
//  Usage:
//    // Default — 240 "道" glyphs, white/cyan/pink wave on black
//    SWCharSphere()
//        .ignoresSafeArea()
//
//    // Random-mix a palette of glyphs
//    SWCharSphere(chars: ["道", "德", "经"])
//
//    // Latin glyphs work too
//    SWCharSphere(
//        chars: ["S", "h", "i", "p", "S", "w", "i", "f", "t"],
//        colors: [.orange, .yellow, .white]
//    )
//
//    // As a section background
//    myContent.background { SWCharSphere() }
//
//    // Demo / debug — adds a gear button that opens a live-tuning sheet.
//    SWCharSphere(showsControls: true)
//
//  Parameters:
//    - chars:          Glyph palette. Each sphere point is assigned a
//                      random index into this array once at cloud-init
//                      time, so the assignment is stable across frames
//                      (default `["道"]`).
//    - glyphCount:     Number of points on the sphere, 50...1000
//                      (default 240; > 400 starts to overlap visibly).
//    - colors:         Palette cycled through over time (default
//                      white / cyan / pink).
//    - background:     Background fill (default `.black`).
//    - morphAmount:    0 = random 3D cloud, 1 = perfect sphere
//                      (default 1.0).
//    - rotationSpeed:  Radians per second around the Y axis
//                      (default 0.5).
//    - fadeSeconds:    Seconds per color cross-fade (default 5.5).
//    - waitSeconds:    Pause between fades (default 5.0).
//    - fontSize:       Base font point size; perspective scales it
//                      (default 10, range 4...30).
//    - fontWeight:     Glyph weight (default `.semibold`).
//    - hidesBackFaces: Skip points on the far side of the sphere so
//                      back-side glyphs don't muddle the front
//                      (default `true`).
//    - showsControls:  Attach a gear `ToolbarItem` + bottom morph
//                      slider for live tuning (default `false`).
//

import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

// MARK: - Main View

struct SWCharSphere: View {
    /// Glyph palette. Each sphere point is assigned a random index into
    /// this array once (deterministic per cloud) so the assignment
    /// doesn't flicker between frames.
    ///
    /// Default is Tao Te Ching Chapter 1 (public-domain ancient Chinese
    /// text, ~33 unique glyphs across 59 positions — rich scatter on
    /// the sphere).
    var chars: [String] = [
        "道", "可", "道", "非", "常", "道",
        "名", "可", "名", "非", "常", "名",
        "無", "名", "天", "地", "之", "始",
        "有", "名", "萬", "物", "之", "母",
        "故", "常", "無", "欲", "以", "觀", "其", "妙",
        "常", "有", "欲", "以", "觀", "其", "徼",
        "此", "兩", "者", "同", "出", "而", "異", "名",
        "同", "謂", "之", "玄", "玄", "之", "又", "玄",
        "眾", "妙", "之", "門"
    ]
//    var chars: [String] = [
//        // Asia
//        "🇨🇳", "🇯🇵", "🇰🇷", "🇮🇳", "🇸🇬", "🇹🇭", "🇻🇳", "🇮🇩",
//        "🇲🇾", "🇵🇭", "🇦🇪", "🇸🇦", "🇮🇱", "🇹🇷", "🇵🇰", "🇧🇩",
//        // Europe
//        "🇬🇧", "🇫🇷", "🇩🇪", "🇮🇹", "🇪🇸", "🇵🇹", "🇳🇱", "🇧🇪",
//        "🇨🇭", "🇸🇪", "🇳🇴", "🇫🇮", "🇩🇰", "🇵🇱", "🇦🇹", "🇬🇷",
//        "🇮🇪", "🇨🇿", "🇭🇺", "🇷🇴",
//        // Americas
//        "🇺🇸", "🇨🇦", "🇲🇽", "🇧🇷", "🇦🇷", "🇨🇱", "🇨🇴", "🇵🇪",
//        // Africa
//        "🇿🇦", "🇪🇬", "🇳🇬", "🇰🇪", "🇲🇦", "🇪🇹", "🇬🇭",
//        // Oceania
//        "🇦🇺", "🇳🇿",
//        // Eurasia
//        "🇷🇺", "🇺🇦", "🇰🇿"
//    ]
    var glyphCount: Int = 240
    var colors: [Color] = [.white, .cyan, .pink]
    var background: Color = .black
    var morphAmount: Double = 1.0
    var rotationSpeed: Double = 0.5
    var fadeSeconds: Double = 5.5
    var waitSeconds: Double = 5.0
    var fontSize: Double = 7
    var fontWeight: Font.Weight = .semibold
    var hidesBackFaces: Bool = false
    var showsControls: Bool = false

    var body: some View {
        if showsControls {
            SWCharSphereControlled(initial: self)
        } else {
            SWCharSphereRenderer(
                chars: chars,
                glyphCount: glyphCount,
                colors: colors,
                background: background,
                morphAmount: morphAmount,
                rotationSpeed: rotationSpeed,
                fadeSeconds: fadeSeconds,
                waitSeconds: waitSeconds,
                fontSize: fontSize,
                fontWeight: fontWeight,
                hidesBackFaces: hidesBackFaces
            )
        }
    }
}

// MARK: - Renderer

/// Pre-computed random offsets per glyph; resampled when `glyphCount`
/// changes. Kept separate from the renderer so the loop's hot path
/// never allocates.
private struct SWCharSphereCloud {
    let randomXYZ: [SIMD3<Double>]
    let yNormalized: [Double]
    /// One char-palette index per glyph slot, baked at cloud-init so the
    /// per-glyph character assignment is stable across frames.
    let charIndices: [Int]

    init(glyphCount: Int, charCount: Int) {
        var random: [SIMD3<Double>] = []
        random.reserveCapacity(glyphCount)
        var sortable: [(Int, Double)] = []
        sortable.reserveCapacity(glyphCount)
        var charIdx: [Int] = []
        charIdx.reserveCapacity(glyphCount)
        let safeCharCount = max(1, charCount)
        for i in 0..<glyphCount {
            // Uniform random point inside the unit ball.
            let u = Double.random(in: 0...1)
            let v = Double.random(in: 0...1)
            let theta = u * 2 * .pi
            let phi = acos(2 * v - 1)
            let r = pow(Double.random(in: 0...1), 1.0 / 3.0)
            let x = r * sin(phi) * cos(theta)
            let y = r * sin(phi) * sin(theta)
            let z = r * cos(phi)
            random.append(SIMD3(x, y, z))

            let sphereY = (glyphCount > 1)
                ? 1 - (Double(i) / Double(glyphCount - 1)) * 2
                : 0
            sortable.append((i, sphereY))

            charIdx.append(Int.random(in: 0..<safeCharCount))
        }
        self.randomXYZ = random
        self.charIndices = charIdx

        let minY = sortable.map { $0.1 }.min() ?? -1
        let maxY = sortable.map { $0.1 }.max() ??  1
        let span = max(1e-6, maxY - minY)
        var norm = Array(repeating: 0.0, count: glyphCount)
        for (i, y) in sortable {
            norm[i] = (y - minY) / span
        }
        self.yNormalized = norm
    }
}

private struct SWCharSphereRenderer: View {
    let chars: [String]
    let glyphCount: Int
    let colors: [Color]
    let background: Color
    let morphAmount: Double
    let rotationSpeed: Double
    let fadeSeconds: Double
    let waitSeconds: Double
    let fontSize: Double
    let fontWeight: Font.Weight
    let hidesBackFaces: Bool

    @State private var cloud: SWCharSphereCloud = .init(glyphCount: 240, charCount: 59)
    @State private var start: Date = .now
    @State private var lastCount: Int = 240
    @State private var lastCharCount: Int = 59

    var body: some View {
        TimelineView(.animation) { ctx in
            let elapsed = ctx.date.timeIntervalSince(start)
            let rotation = elapsed * rotationSpeed
            let totalCycle = max(0.001, fadeSeconds + waitSeconds)
            let timeInCycle = elapsed.truncatingRemainder(dividingBy: totalCycle)
            let baseIdx = Int(floor(elapsed / totalCycle)) % max(1, colors.count)
            let nextIdx = (baseIdx + 1) % max(1, colors.count)
            let baseRGB = rgbComponents(colors[baseIdx])
            let nextRGB = rgbComponents(colors[nextIdx])
            let cosR = cos(rotation)
            let sinR = sin(rotation)
            let count = cloud.randomXYZ.count
            let tMorph = max(0.0, min(1.0, morphAmount))
            let chaosScale = 250.0 * (1 - tMorph) + 100.0 * tMorph
            let goldenAngle = .pi * (3 - sqrt(5.0))

            // Fall back to a single dot if the palette is empty.
            let safeChars: [String] = chars.isEmpty ? ["·"] : chars

            Canvas { gc, size in
                let centerX = size.width / 2
                let centerY = size.height / 2

                for i in 0..<count {
                    // Sphere position via Vogel spiral.
                    let sphereY: Double = (count > 1)
                        ? 1 - (Double(i) / Double(count - 1)) * 2
                        : 0
                    let radiusAtY = sqrt(max(0, 1 - sphereY * sphereY))
                    let theta = goldenAngle * Double(i)
                    let sphereX = radiusAtY * cos(theta)
                    let sphereZ = radiusAtY * sin(theta)

                    // Morph: lerp between random cloud and sphere.
                    let rnd = cloud.randomXYZ[i]
                    let wx = (rnd.x * (1 - tMorph) + sphereX * tMorph) * chaosScale
                    let wy = (rnd.y * (1 - tMorph) + sphereY * tMorph) * chaosScale
                    let wz = (rnd.z * (1 - tMorph) + sphereZ * tMorph) * chaosScale

                    // Rotate around
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #62** (2026-07-09): **feat(chart): add SWNetworkGraph interactive 3D dependency graph**
  *Symptoms*: ## What  Adds **SWNetworkGraph**, a new `SWChart` component that renders an interactive 3D "knowledge graph" on a single SwiftUI `Canvas`, plus **SWNetworkGraphData** with the full open Marble curriculum dataset.  Inspired by the curriculum map at [withmarble.com/curriculum](https://withmarble.com/curriculum). All 3D math is hand-rolled — no SceneKit: golden-angle funnel layout, a Y-rotation + tilt matrix, and one-axis perspective projection.  ## Features  - Idle auto-spin that pauses on interaction or selection - Bottom-up grow-in intro (skipped under Reduce Motion) - Drag to orbit, pinch to zoom (0.5–4×) - Tap a dot to BFS-highlight its full prerequisite lineage with a camera focus tween; everything else dims - Depth fog, painter's-algorithm draw order, focus ring/glow - Built-in group-filter legend and a detail card with tappable *builds on* / *unlocks* rows and a back stack  ## Data  `SWNetworkGraphData.swift` bundles the full **Marble Skill Taxonomy**: 1,590 micro-topics across 8 subjects / 54 domains, wired by 3,221 prerequisite edges — the same graph as the source site.  - Source: [withmarbleapp/os-taxonomy](https://github.com/withmarbleapp/os-taxonomy), data under **ODbL v1.0**, content under **CC BY-SA 4.0**. Attribution header kept in the file. - Downloaded from the official repo (not scraped/decoded from the site). Only factual fields are used: id, name, subject, domain, age range, centrality, dependency list. - Stored as compact pipe-separated string tables parsed

- **Issue #60** (2026-07-01): **[closed - test] Shipswift MCP build-feature prompt rejects empty args probe**
  *Symptoms*: test
  **Post-Mortem & Fix Analysis**:
  > test — closing immediately

- **Issue #59** (2026-07-31): **fix: wrap SWOrderView content in ScrollView on iOS to prevent button clipping**
  *Symptoms*: ## 问题 在 iOS 上打开 `SWOrderView`，底部的「Add to Cart」按钮会被屏幕底部裁切，且无法滚动到达。  在 iPhone 15 Pro 上实测：按钮底边在 875pt，而屏幕高仅 852pt，**被切掉约 23pt**。屏幕越小（如 iPhone SE）问题越严重。  ## 原因 `body` 里只有 macOS 分支用了 `ScrollView`，iOS 分支直接渲染 `contentView`：  ```swift #if os(macOS) ScrollView { contentView } #else contentView          // iOS 没有 ScrollView #endif ```  而 `cupsSection` 在 iOS 上是固定高度 500，加上数量控件、两个选择器和按钮，总高超过屏幕，iOS 又不能滚动，导致按钮被挤出可视区。  ## 修复 去掉平台判断，iOS / macOS 统一用 `ScrollView` 包裹，和原本 macOS 的行为保持一致。这样所有设备尺寸下内容都能滚动、按钮都能完整看到。  修复后在 iPhone 15 Pro 上验证：滚动到底部时按钮底边为 802pt（< 852），完整可见。

- **Issue #58** (2026-07-23): **建议，新增ios自动化调试skill**
  *Symptoms*: https://github.com/conorluddy/ios-simulator-skill  这个skill感觉不错，感觉可补充追加为第四个skill  楼主有时间看看 ❤️

- **Issue #4** (2026-05-31): **how ot use?**
  *Symptoms*:  • I can see those skills and they’re available. The issue is the ShipSwift recipe tools (listRecipes, searchRecipes, getRecipe) aren’t currently   accessible in this environment, so I can’t query recipes yet.    If you want me to proceed with ShipSwift components, please install/enable the ShipSwift skills so those tools are available. The skill docs suggest:    - npx skills add signerlabs/shipswift-skills    Once that’s set up, tell me and I’ll use build-feature to implement your settings page, charts, quote rotation, orbit logos, and tab button changes.   the codex can know skill but can not find receipts.
  **Post-Mortem & Fix Analysis**:
  > 1. Install skills npx skills add signerlabs/shipswift-skills 2. Ask llm to use it, example: Build a settingview for me, use shipswift settingview for reference.

- **Issue #3** (2026-03-14): **feat: add local skills for offline component discovery**
  *Symptoms*: ## What  Adds a `skills/` directory so users can install ShipSwift skills that work **locally without MCP**.  ```bash npx skills add signerlabs/ShipSwift ```  ## Why  The current setup requires both `npx skills add signerlabs/shipswift-skills` **and** a separate MCP server configuration. This is a barrier for users who: - Just want to use the open-source components - Don't need Pro recipes (backend/compliance/pitfall guides) - Want offline access  ## What's included  | File | Purpose | |------|---------| | `skills/catalog.md` | Structured index of all 59 components with descriptions and file paths | | `skills/build-feature/SKILL.md` | Workflow for building features by combining components | | `skills/add-component/SKILL.md` | Workflow for adding a specific component to a project | | `skills/explore-recipes/SKILL.md` | Workflow for browsing the full catalog |  ## How it works  Skills instruct the AI to: 1. Read `catalog.md` for discovery 2. Read Swift source files directly from `SWPackage/` 3. Follow existing naming conventions from `CLAUDE.md`  No API, no network, no key. MCP remains the path for Pro content.  ## README update  Added "Option 2: Local Skills" in Quick Start, between the MCP option and file copy.

- **Issue #2** (2026-05-31): **Supabase support**
  *Symptoms*: Hi there, id like to ask if there are plans to support supabase?
  **Post-Mortem & Fix Analysis**:
  > Sure, maybe in 2 weeks, I love supabase!
  > 掘金我从来不用，脑残

- **Issue #1** (2026-03-14): **docs: improve README documentation**
  *Symptoms*: ## 改进类型 文档改进  ## 描述 改进README文档，添加缺失的部分。  ## 更改内容 - 缺少安装说明 - 缺少使用说明  ## 测试 无需测试，纯文档改进。  ## 备注 这是一个自动化贡献，旨在帮助改进项目文档。

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

### Incident Patch 1: `3062473a` (2026-08-07)
**Commit Message**: feat: SWAlert renders in a dedicated top-level UIWindow on iOS

Sheets and fullScreenCovers could cover the root-view overlay — alerts fired
from inside a sheet were invisible until dismissed. iOS now mounts a
passthrough UIWindow (windowLevel .alert+1) once; macOS keeps the overlay
(sheets attach in-window there). Public API unchanged.
Battle-tested in spotby (2026-08-07).

Co-Authored-By: Claude Fable 5 <[REDACTED_EMAIL]>

**File**: `ShipSwift/SWPackage/SWComponent/Feedback/SWAlert.swift` (modified, +72/-0)
```diff
@@ -6,6 +6,13 @@
 //  the screen. Supports four preset styles (info, success, warning, error)
 //  and fully custom styling. Auto-dismisses after a configurable duration.
 //
+//  Presentation (2026-08-07): on iOS the toast renders in a dedicated
+//  top-level UIWindow (windowLevel = .alert + 1, hit-test passthrough), so it
+//  is never covered by sheets or fullScreenCovers — alerts fired from inside
+//  a sheet show instantly, no need to wait for the dismiss animation.
+//  On macOS it stays a root-view overlay (no full-screen sheet occlusion there).
+//  Public API is unchanged.
+//
 //  Usage:
 //    1. Attach the modifier at your App entry point (once):
 //
@@ -54,6 +61,9 @@
 //
 
 import SwiftUI
+#if canImport(UIKit)
+import UIKit
+#endif
 
 // MARK: - SWAlertType
 
@@ -242,18 +252,80 @@ private struct SWAlertView: View {
     }
 }
 
+// MARK: - Top-Level Window Host (iOS)
+
+#if canImport(UIKit)
+/// Passthrough window: only the toast itself receives touches;
+/// everything else falls through to the windows below.
+private final class SWAlertPassthroughWindow: UIWindow {
+    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
+        let view = super.hitTest(point, with: event)
+        // The hosting controller's container view itself = empty area → pass through
+        return view == rootViewController?.view ? nil : view
+    }
+}
+
+/// Dedicated top-level window (windowLevel above system alerts) so sheets and
+/// fullScreenCovers can never cover the toast. Mounted once, app-lifetime.
+@MainActor
+private enum SWAlertWindowHost {
+    static var window: UIWindow?
+
+    static func mountIfNeeded() {
+        guard window == nil,
+              let scene = UIApplication.shared.connectedScenes
+                  .compactMap({ $0 as? UIWindowScene })
+                  .first(where: { $0.activationState == .foregroundActive })
+                  ?? UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first
+        else { return }
+        let host = UIHostingController(rootView: SWAlertOverlayRoot())
+        host.view.backgroundColor = .clear
+        let window = SWAlertPassthroughWindow(windowScene: scene)
+        window.windowLevel = .alert + 1
+        window.backgroundColor = .clear
+        window.rootViewController = host
+        window.isHidden = false
+        self.window = window
+    }
+}
+
+/// Root view inside the dedicated window: reads the singleton, top-aligned.
+private struct SWAlertOverlayRoot: View {
+    let alertManager = SWAlertManager.shared
+
+    var body: some View {
+        VStack {
+            SWAlertView()
+                .padding(.top, 40)
+            Spacer()
+        }
+        .frame(maxWidth: .infinity)
+        .animation(.spring(duration: 0.3), value: alertManager.isShowing)
+    }
+}
+#endif
+
 // MARK: - View Modifier
 
 private struct SWAlertModifier: ViewModifier {
     let alertManager = SWAlertManager.shared
 
     func body(content: Content) -> some View {
+        #if canImport(UIKit)
+        // iOS: render in a dedicated top-level window — never covered by
+        // sheets/fullScreenCovers, no need to delay until dismiss animations end.
+        content
+            .onAppear { SWAlertWindowHost.mountIfNeeded() }
+        #else
+        // macOS: keep the root-view overlay (sheets attach inside the window
+        // there, so full-screen occlusion is not a concern).
         content
             .overlay(alignment: .top) {
                 SWAlertView()
                     .padding(.top, 40)
             }
             .animation(.spring(duration: 0.3), value: alertManager.isShowing)
+        #endif
     }
 }
 
```

---

### Incident Patch 2: `d5a17ba8` (2026-07-11)
**Commit Message**: fix: increment CURRENT_PROJECT_VERSION to 7

**File**: `ShipSwift.xcodeproj/project.pbxproj` (modified, +2/-2)
```diff
@@ -312,7 +312,7 @@
 				ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
 				ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor;
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 6;
+				CURRENT_PROJECT_VERSION = 7;
 				DEAD_CODE_STRIPPING = YES;
 				ENABLE_APP_SANDBOX = YES;
 				ENABLE_HARDENED_RUNTIME = YES;
@@ -369,7 +369,7 @@
 				ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
 				ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor;
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 6;
+				CURRENT_PROJECT_VERSION = 7;
 				DEAD_CODE_STRIPPING = YES;
 				ENABLE_APP_SANDBOX = YES;
 				ENABLE_HARDENED_RUNTIME = YES;
```

---

### Incident Patch 3: `646d22c6` (2026-07-11)
**Commit Message**: fix: update MARKETING_VERSION to 1.1.5

**File**: `ShipSwift.xcodeproj/project.pbxproj` (modified, +2/-2)
```diff
@@ -345,7 +345,7 @@
 				LD_RUNPATH_SEARCH_PATHS = "@executable_path/Frameworks";
 				"LD_RUNPATH_SEARCH_PATHS[sdk=macosx*]" = "@executable_path/../Frameworks";
 				MACOSX_DEPLOYMENT_TARGET = 15.0;
-				MARKETING_VERSION = 1.1.4;
+				MARKETING_VERSION = 1.1.5;
 				PRODUCT_BUNDLE_IDENTIFIER = "com.signerlabs.ship-swift-ios";
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				REGISTER_APP_GROUPS = YES;
@@ -402,7 +402,7 @@
 				LD_RUNPATH_SEARCH_PATHS = "@executable_path/Frameworks";
 				"LD_RUNPATH_SEARCH_PATHS[sdk=macosx*]" = "@executable_path/../Frameworks";
 				MACOSX_DEPLOYMENT_TARGET = 15.0;
-				MARKETING_VERSION = 1.1.4;
+				MARKETING_VERSION = 1.1.5;
 				PRODUCT_BUNDLE_IDENTIFIER = "com.signerlabs.ship-swift-ios";
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				REGISTER_APP_GROUPS = YES;
```

---

### Incident Patch 4: `9c529f17` (2026-07-09)
**Commit Message**: fix: update README to remove outdated Pro recipes section and enhance code style guidelines

**File**: `README.md` (modified, +4/-13)
```diff
@@ -221,8 +221,6 @@ All iOS client code is open-source under the MIT license. Pro recipes add everyt
 | Compliance templates | — | Privacy manifest, App Store labels |
 | Known pitfalls | — | 10+ battle-tested tips per recipe |
 
-More Pro recipes coming soon: **Push Notifications**, **Analytics Dashboard**.
-
 See [pricing](https://shipswift.app/#pricing) for details.
 
 ---
@@ -251,9 +249,7 @@ Contributions are welcome! Please follow these steps:
 ### Code Style
 
 - All comments and documentation in English
-- All types use the `SW` prefix
-- Each file in `SWAnimation/`, `SWChart/`, and `SWComponent/` must be self-contained
-- Follow existing code patterns and naming conventions
+- Follow the naming conventions, dependency rules, and self-containment described above
 
 ---
 
@@ -263,14 +259,9 @@ This project is licensed under the MIT License — see the [LICENSE](LICENSE) fi
 
 ---
 
-## Stargazers over time
-<a href="https://www.star-history.com/#signerlabs/ShipSwift&Date">
- <picture>
-   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=signerlabs/ShipSwift&type=Date&theme=dark" />
-   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=signerlabs/ShipSwift&type=Date" />
-   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=signerlabs/ShipSwift&type=Date" width="100%" />
- </picture>
-</a>
+## Activity
+
+![Repobeats analytics image](https://repobeats.axiom.co/api/embed/63e16d415eaeceabec8cc446fdcd164346dd22c4.svg)
 
 ---
 
```

---

### Incident Patch 5: `9c79b084` (2026-06-26)
**Commit Message**: fix: update stargazers chart to use responsive design and dark mode support

**File**: `README.md` (modified, +7/-1)
```diff
@@ -264,7 +264,13 @@ This project is licensed under the MIT License — see the [LICENSE](LICENSE) fi
 ---
 
 ## Stargazers over time
-[![Stargazers over time](https://starchart.cc/signerlabs/ShipSwift.svg?variant=adaptive)](https://starchart.cc/signerlabs/ShipSwift)
+<a href="https://www.star-history.com/#signerlabs/ShipSwift&Date">
+ <picture>
+   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=signerlabs/ShipSwift&type=Date&theme=dark" />
+   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=signerlabs/ShipSwift&type=Date" />
+   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=signerlabs/ShipSwift&type=Date" width="100%" />
+ </picture>
+</a>
 
 ---
 
```

---

### Incident Patch 6: `0877b3af` (2026-06-08)
**Commit Message**: fix: prevent rendering of confetti particles with negligible scale

**File**: `ShipSwift/SWPackage/SWAnimation/SWConfetti.swift` (modified, +1/-0)
```diff
@@ -184,6 +184,7 @@ private struct SWConfettiCanvas: View {
                     let angle = Angle.degrees(p.angle + p.angularVelocity * t)
                     let wobble = cos(p.wobbleSpeed * t + p.wobblePhase)
                     let currentScaleX = p.scaleX * wobble
+                    guard abs(currentScaleX) > 0.001 else { continue }
 
                     guard px > -50 && px < size.width + 50 else { continue }
                     guard py > -50 && py < size.height + 200 else { continue }
```

---

### Incident Patch 7: `ad743b8c` (2026-06-02)
**Commit Message**: Add SWGlassLogo shader and SwiftUI view for frosted glass effect

- Implemented SWGlassLogo.metal for a frosted glass effect using Metal shaders.
- Created SWGlassLogo.swift to define a SwiftUI view that utilizes the shader.
- The view supports customizable parameters for refraction, frost, thickness, and more.
- Added a controlled interface for live tuning of the glass effect parameters.
- Integrated a flowing light background with a mesh gradient and diagonal stripes.
- Included a bloom effect to enhance the visual appeal of the glass logo.

**File**: `ShipSwift/Localizable.xcstrings` (modified, +30/-0)
```diff
@@ -1228,6 +1228,9 @@
     },
     "Custom (blue, large)" : {
 
+    },
+    "Cutout" : {
+
     },
     "Cyan" : {
 
@@ -1571,6 +1574,15 @@
           }
         }
       }
+    },
+    "Fresnel" : {
+
+    },
+    "Fresnel Color" : {
+
+    },
+    "Fresnel Rim" : {
+
     },
     "Front" : {
 
@@ -1601,6 +1613,15 @@
     },
     "Glass" : {
 
+    },
+    "Glass Controls" : {
+
+    },
+    "Glass Logo" : {
+
+    },
+    "Glass Logo Controls" : {
+
     },
     "Glass Orb" : {
 
@@ -1722,6 +1743,9 @@
           }
         }
       }
+    },
+    "Highlight Color" : {
+
     },
     "Holes" : {
 
@@ -2681,6 +2705,9 @@
     },
     "Polished Aluminum Controls" : {
 
+    },
+    "Preserve Luminosity" : {
+
     },
     "Privacy" : {
 
@@ -3529,6 +3556,9 @@
           }
         }
       }
+    },
+    "Tint Color" : {
+
     },
     "Tip: register a same-named ColorSet alongside the image set to get a brand-appropriate tint before the image decodes — or as a permanent fallback for empty states." : {
 
```

**File**: `ShipSwift/SWPackage/SWAnimation/SWCharSphere.swift` (modified, +1/-1)
```diff
@@ -388,7 +388,7 @@ private struct SWCharSphereControlled: View {
                 fontWeight: $fontWeight,
                 hidesBackFaces: $hidesBackFaces
             )
-            .presentationDetents([.medium, .large])
+            .presentationDetents([.medium])
             .presentationDragIndicator(.visible)
         }
     }
```

**File**: `ShipSwift/SWPackage/SWAnimation/SWDotSphere.swift` (modified, +1/-1)
```diff
@@ -300,7 +300,7 @@ private struct SWDotSphereControlled: View {
                 waitSeconds: $waitSeconds,
                 dotSize: $dotSize
             )
-            .presentationDetents([.medium, .large])
+            .presentationDetents([.medium])
             .presentationDragIndicator(.visible)
         }
     }
```

**File**: `ShipSwift/SWPackage/SWAnimation/SWMetal/SWAnimatedLoop.swift` (modified, +1/-1)
```diff
@@ -447,7 +447,7 @@ private struct SWAnimatedLoopControlled: View {
                 angularSpeed: $angularSpeed,
                 applyDefaults: applyDefaults
             )
-            .presentationDetents([.medium, .large])
+            .presentationDetents([.medium])
             .presentationDragIndicator(.visible)
         }
     }
```

**File**: `ShipSwift/SWPackage/SWAnimation/SWMetal/SWChromaticGlass.swift` (modified, +1/-1)
```diff
@@ -155,7 +155,7 @@ private struct SWChromaticGlassControlled<Content: View>: View {
                 intensity: $intensity,
                 separation: $separation
             )
-            .presentationDetents([.medium, .large])
+            .presentationDetents([.medium])
             .presentationDragIndicator(.visible)
         }
     }
```

**File**: `ShipSwift/SWPackage/SWAnimation/SWMetal/SWColorPanels.swift` (modified, +1/-1)
```diff
@@ -279,7 +279,7 @@ private struct SWColorPanelsControlled: View {
                 scale: $scale,
                 speed: $speed
             )
-            .presentationDetents([.medium, .large])
+            .presentationDetents([.medium])
             .presentationDragIndicator(.visible)
         }
     }
```

**File**: `ShipSwift/SWPackage/SWAnimation/SWMetal/SWDotOrbit.swift` (modified, +1/-1)
```diff
@@ -206,7 +206,7 @@ private struct SWDotOrbitControlled: View {
                 spreading: $spreading,
                 stepsPerColor: $stepsPerColor
             )
-            .presentationDetents([.medium, .large])
+            .presentationDetents([.medium])
             .presentationDragIndicator(.visible)
         }
     }
```

**File**: `ShipSwift/SWPackage/SWAnimation/SWMetal/SWDots.swift` (modified, +1/-1)
```diff
@@ -315,7 +315,7 @@ private struct SWDotsControlled: View {
                 vignette: $vignette,
                 horizon: $horizon
             )
-            .presentationDetents([.medium, .large])
+            .presentationDetents([.medium])
             .presentationDragIndicator(.visible)
         }
     }
```

---

### Incident Patch 8: `23017a5d` (2026-05-26)
**Commit Message**: fix: update star history section to stargazers over time with adaptive variant

**File**: `README.md` (modified, +2/-5)
```diff
@@ -263,11 +263,8 @@ This project is licensed under the MIT License — see the [LICENSE](LICENSE) fi
 
 ---
 
-## Star History
-
-<a href="https://starchart.cc/signerlabs/ShipSwift">
- <img alt="Star History Chart" src="https://starchart.cc/signerlabs/ShipSwift.svg" />
-</a>
+## Stargazers over time
+[![Stargazers over time](https://starchart.cc/signerlabs/ShipSwift.svg?variant=adaptive)](https://starchart.cc/signerlabs/ShipSwift)
 
 ---
 
```

---

### Incident Patch 9: `08e526e0` (2026-05-26)
**Commit Message**: fix: update star history section to use starchart.cc for star history visualization

**File**: `README.md` (modified, +2/-6)
```diff
@@ -265,12 +265,8 @@ This project is licensed under the MIT License — see the [LICENSE](LICENSE) fi
 
 ## Star History
 
-<a href="https://www.star-history.com/?repos=signerlabs%2FShipSwift&type=date&legend=bottom-right">
- <picture>
-   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=signerlabs/ShipSwift&type=date&theme=dark&legend=bottom-right" />
-   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=signerlabs/ShipSwift&type=date&legend=bottom-right" />
-   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=signerlabs/ShipSwift&type=date&legend=bottom-right" />
- </picture>
+<a href="https://starchart.cc/signerlabs/ShipSwift">
+ <img alt="Star History Chart" src="https://starchart.cc/signerlabs/ShipSwift.svg" />
 </a>
 
 ---
```

---

### Incident Patch 10: `bfb6f4e0` (2026-05-26)
**Commit Message**: fix: update star history chart URLs to use lowercase type parameter and change endpoint to chart

**File**: `README.md` (modified, +4/-4)
```diff
@@ -265,11 +265,11 @@ This project is licensed under the MIT License — see the [LICENSE](LICENSE) fi
 
 ## Star History
 
-<a href="https://www.star-history.com/?repos=signerlabs%2FShipSwift&type=Date&legend=bottom-right">
+<a href="https://www.star-history.com/?repos=signerlabs%2FShipSwift&type=date&legend=bottom-right">
  <picture>
-   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=signerlabs/ShipSwift&type=Date&theme=dark&legend=bottom-right" />
-   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=signerlabs/ShipSwift&type=Date&legend=bottom-right" />
-   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=signerlabs/ShipSwift&type=Date&legend=bottom-right" />
+   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=signerlabs/ShipSwift&type=date&theme=dark&legend=bottom-right" />
+   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=signerlabs/ShipSwift&type=date&legend=bottom-right" />
+   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=signerlabs/ShipSwift&type=date&legend=bottom-right" />
  </picture>
 </a>
 
```

---

### Incident Patch 11: `ca89ee81` (2026-05-26)
**Commit Message**: fix: update star history chart URLs to use SVG format and correct type parameter

**File**: `README.md` (modified, +4/-4)
```diff
@@ -265,11 +265,11 @@ This project is licensed under the MIT License — see the [LICENSE](LICENSE) fi
 
 ## Star History
 
-<a href="https://www.star-history.com/?repos=signerlabs%2FShipSwift&type=timeline&legend=bottom-right">
+<a href="https://www.star-history.com/?repos=signerlabs%2FShipSwift&type=Date&legend=bottom-right">
  <picture>
-   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/image?repos=signerlabs/ShipSwift&type=timeline&theme=dark&legend=bottom-right&_=20260526" />
-   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/image?repos=signerlabs/ShipSwift&type=timeline&legend=bottom-right&_=20260526" />
-   <img alt="Star History Chart" src="https://api.star-history.com/image?repos=signerlabs/ShipSwift&type=timeline&legend=bottom-right&_=20260526" />
+   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=signerlabs/ShipSwift&type=Date&theme=dark&legend=bottom-right" />
+   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=signerlabs/ShipSwift&type=Date&legend=bottom-right" />
+   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=signerlabs/ShipSwift&type=Date&legend=bottom-right" />
  </picture>
 </a>
 
```

---

### Incident Patch 12: `a465d1f9` (2026-05-26)
**Commit Message**: fix: update star history chart URLs to include cache-busting query parameters

**File**: `README.md` (modified, +3/-3)
```diff
@@ -267,9 +267,9 @@ This project is licensed under the MIT License — see the [LICENSE](LICENSE) fi
 
 <a href="https://www.star-history.com/?repos=signerlabs%2FShipSwift&type=timeline&legend=bottom-right">
  <picture>
-   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/image?repos=signerlabs/ShipSwift&type=timeline&theme=dark&legend=bottom-right" />
-   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/image?repos=signerlabs/ShipSwift&type=timeline&legend=bottom-right" />
-   <img alt="Star History Chart" src="https://api.star-history.com/image?repos=signerlabs/ShipSwift&type=timeline&legend=bottom-right" />
+   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/image?repos=signerlabs/ShipSwift&type=timeline&theme=dark&legend=bottom-right&_=20260526" />
+   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/image?repos=signerlabs/ShipSwift&type=timeline&legend=bottom-right&_=20260526" />
+   <img alt="Star History Chart" src="https://api.star-history.com/image?repos=signerlabs/ShipSwift&type=timeline&legend=bottom-right&_=20260526" />
  </picture>
 </a>
 
```

---

### Incident Patch 13: `983a43b1` (2026-05-25)
**Commit Message**: feat: add SWLiquidMetal component with customizable liquid metal shader effects and controls

**File**: `ShipSwift/Localizable.xcstrings` (modified, +66/-0)
```diff
@@ -940,6 +940,9 @@
           }
         }
       }
+    },
+    "Black" : {
+
     },
     "Bottom sheet with text input and confirm button" : {
 
@@ -1083,6 +1086,9 @@
           }
         }
       }
+    },
+    "Classic" : {
+
     },
     "Cloud" : {
       "localizations" : {
@@ -1093,6 +1099,9 @@
           }
         }
       }
+    },
+    "CMYK" : {
+
     },
     "Color %lld" : {
 
@@ -1186,6 +1195,9 @@
     },
     "Custom (blue, large)" : {
 
+    },
+    "Cyan" : {
+
     },
     "Date" : {
 
@@ -1499,6 +1511,9 @@
           }
         }
       }
+    },
+    "Front" : {
+
     },
     "Full-stack iOS + AWS backend" : {
 
@@ -1527,12 +1542,18 @@
           }
         }
       }
+    },
+    "Gooey" : {
+
     },
     "Google" : {
 
     },
     "Gradient Divider" : {
 
+    },
+    "Grain" : {
+
     },
     "Grain Gradient" : {
       "localizations" : {
@@ -1589,9 +1610,18 @@
     },
     "Health" : {
 
+    },
+    "Heatmap" : {
+
+    },
+    "Heatmap Controls" : {
+
     },
     "Hello World" : {
 
+    },
+    "Hex" : {
+
     },
     "Highlight" : {
       "localizations" : {
@@ -1602,6 +1632,9 @@
           }
         }
       }
+    },
+    "Holes" : {
+
     },
     "Home" : {
 
@@ -1876,6 +1909,9 @@
     },
     "Integration Steps" : {
 
+    },
+    "Inverted" : {
+
     },
     "iOS 18+ TabView with haptic feedback" : {
 
@@ -1933,6 +1969,9 @@
     },
     "Loading data..." : {
 
+    },
+    "Magenta" : {
+
     },
     "Message bubbles, text input, voice recording waveform" : {
 
@@ -2035,6 +2074,9 @@
     },
     "Order View" : {
 
+    },
+    "Original Colors" : {
+
     },
     "Outfit" : {
 
@@ -2073,6 +2115,9 @@
     },
     "Past 60 days" : {
 
+    },
+    "Pattern" : {
+
     },
     "paywall.alert.api_key_generated" : {
       "extractionState" : "manual",
@@ -2483,6 +2528,9 @@
           }
         }
       }
+    },
+    "Plates" : {
+
     },
     "Privacy" : {
 
@@ -2498,6 +2546,9 @@
     },
     "Query: %@" : {
 
+    },
+    "Ramp" : {
+
     },
     "Recent" : {
 
@@ -3104,9 +3155,15 @@
     },
     "SmileMax - Glow Up Coach" : {
 
+    },
+    "Soft" : {
+
     },
     "Spark - Goal Tracker & Diary" : {
 
+    },
+    "Square" : {
+
     },
     "Standard event types supported by TikTok Ads SDK. Custom events can also be tracked with arbitrary names." : {
 
@@ -3388,6 +3445,12 @@
     },
     "Warning" : {
 
+    },
+    "Water" : {
+
+    },
+    "Water Controls" : {
+
     },
     "Wealth" : {
 
@@ -3397,6 +3460,9 @@
     },
     "Wisdom" : {
 
+    },
+    "Yellow" : {
+
     },
     "Your Generation Purpose" : {
 
```

**File**: `ShipSwift/SWPackage/SWAnimation/SWMetal/SWLiquidMetal.metal` (added, +218/-0)
```diff
@@ -0,0 +1,218 @@
+//
+//  SWLiquidMetal.metal
+//  ShipSwift
+//
+//  Stitchable SwiftUI layerEffect — port of Paper Design's liquid-metal
+//  (https://shaders.paper.design/liquid-metal, original by Stephen Haney
+//  for paper-design/liquid-logo). Wraps any view (typically an SF Symbol)
+//  in a flowing chromatic liquid-metal effect: simplex noise drives a
+//  stripe-pattern color split with refraction, edge-aware bulge, and
+//  per-channel chromatic shift.
+//
+//  Reference Metal port:
+//    https://github.com/bobek-balinek/LiquidMetalShader (MIT-style fork
+//    of the original WebGL fragment shader). Function names adapted to
+//    the SW prefix and layer-size sourcing switched from `layer.tex.get_*`
+//    to the `boundingRect` parameter (more portable across SwiftUI shader
+//    APIs).
+//
+//  Paired with: SWLiquidMetal.swift
+//  Entry point: `swLiquidMetal` — invoked via SwiftUI `.layerEffect(...)`.
+//  Requires iOS 17+ / macOS 14+.
+//
+
+#include <metal_stdlib>
+#include <SwiftUI/SwiftUI_Metal.h>
+using namespace metal;
+
+// =============================================================================
+// MARK: - Constants & shared helpers
+// =============================================================================
+
+constant float SWLM_PI = 3.14159265358979323846;
+constant float4 SWLM_C = float4(0.211324865405187,
+                                 0.366025403784439,
+                                -0.577350269189626,
+                                 0.024390243902439);
+
+static float3 swLM_mod289v3(float3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
+static float2 swLM_mod289v2(float2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
+static float3 swLM_permute(float3 x)  { return swLM_mod289v3(((x * 34.0) + 1.0) * x); }
+
+// 2D simplex noise (Ashima Arts / Stefan Gustavson, public domain).
+static float swLM_snoise(float2 v) {
+    float2 i = floor(v + dot(v, SWLM_C.yy));
+    float2 x0 = v - i + dot(i, SWLM_C.xx);
+    float2 i1 = (x0.x > x0.y) ? float2(1.0, 0.0) : float2(0.0, 1.0);
+    float4 x12 = x0.xyxy + SWLM_C.xxzz;
+    x12.xy -= i1;
+    i = swLM_mod289v2(i);
+    float3 p = swLM_permute(swLM_permute(i.y + float3(0.0, i1.y, 1.0))
+                                       + i.x + float3(0.0, i1.x, 1.0));
+    float3 m = max(0.5 - float3(dot(x0, x0),
+                                 dot(x12.xy, x12.xy),
+                                 dot(x12.zw, x12.zw)), 0.0);
+    m = m * m;
+    m = m * m;
+    float3 x = 2.0 * fract(p * SWLM_C.www) - 1.0;
+    float3 h = abs(x) - 0.5;
+    float3 ox = floor(x + 0.5);
+    float3 a0 = x - ox;
+    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
+    float3 g;
+    g.x  = a0.x  * x0.x   + h.x  * x0.y;
+    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
+    return 130.0 * dot(m, g);
+}
+
+static float2 swLM_rotate(float2 uv, float th) {
+    float2x2 m = float2x2(cos(th), sin(th), -sin(th), cos(th));
+    return m * uv;
+}
+
+// Soft alpha falloff at the layer's outer 10% (per Paper original).
+static float swLM_imgFrameAlpha(float2 uv, float frameWidth) {
+    float f = smoothstep(0.0, frameWidth, uv.x)
+            * smoothstep(1.0, 1.0 - frameWidth, uv.x);
+    f *= smoothstep(0.0, frameWidth, uv.y)
+       * smoothstep(1.0, 1.0 - frameWidth, uv.y);
+    return f;
+}
+
+// Per-channel color resolver — Paper's `get_color_channel`. Threads the
+// stripe pattern through 5 alternating smoothstep bands plus a trailing
+// gradient. `c1` / `c2` are the two endpoint colors (light vs. dark),
+// `stripePos` is the wrapped UV along the stripe direction, `w` packs
+// the stripe widths, `extraBlur` lets the caller widen the per-channel
+// band edge for chromatic split, and `bulge` modulates which bands the
+// stripe enters.
+static float swLM_getColorChannel(float c1, float c2,
+                                  float stripePos,
+                                  float3 w,
+                                  float extraBlur,
+                                  float bulge,
+                                  float patternBlur) {
+    float ch = c2;
+    float blur = patternBlur + extraBlur;
+    ch = mix(ch, c1, smoothstep(0.0, blur, stripePos));
+
+    float border = w[0];
+    ch = mix(ch, c2, smoothstep(border - blur, border + blur, stripePos));
+
+    float b = smoothstep(0.2, 0.8, bulge);
+    border = w[0] + 0.4 * (1.0 - b) * w[1];
+    ch = mix(ch, c1, smoothstep(border - blur, border + blur, stripePos));
+
+    border = w[0] + 0.5 * (1.0 - b) * w[1];
+    ch = mix(ch, c2, smoothstep(border - blur, border + blur, stripePos));
+
+    border = w[0] + w[1];
+    ch = mix(ch, c1, smoothstep(border - blur, border + blur, stripePos));
+
+    float gradientT = (stripePos - w[0] - w[1]) / w[2];
+    float gradient  = mix(c1, c2, smoothstep(0.0, 1.0, gradientT));
+    ch = mix(ch, gradient, smoothstep(border - blur, border + blur, stripePos));
+    return ch;
+}
+
+// =====================================================
```

**File**: `ShipSwift/SWPackage/SWAnimation/SWMetal/SWLiquidMetal.swift` (added, +300/-0)
```diff
@@ -0,0 +1,300 @@
+//
+//  SWLiquidMetal.swift
+//  ShipSwift
+//
+//  Port of Paper Design's liquid-metal shader
+//  (https://shaders.paper.design/liquid-metal, original by Stephen Haney
+//  for paper-design/liquid-logo) as a SwiftUI Metal `layerEffect`. Wraps
+//  any view in a flowing chromatic liquid-metal effect: simplex noise
+//  drives a stripe-pattern color split with refraction, edge-aware
+//  bulge, and per-channel chromatic shift.
+//
+//  Best paired with a bold, opaque silhouette (SF Symbol, logo) — the
+//  effect uses the source's red channel as its edge mask, so vector
+//  shapes against transparent background work cleanest.
+//
+//  Reference Metal port: bobek-balinek/LiquidMetalShader (MIT).
+//
+//  Requires iOS 17+ / macOS 14+ (SwiftUI `ShaderLibrary`,
+//  `Shader`/`ShaderFunction`, Metal `stitchable`).
+//
+//  Usage:
+//    // Default — flowing chrome over the Apple logo
+//    SWLiquidMetal {
+//        Image(systemName: "apple.logo")
+//            .font(.system(size: 300))
+//    }
+//
+//    // Subtler refraction, slower
+//    SWLiquidMetal(
+//        refraction: 0.003,
+//        timeScale: 0.1
+//    ) {
+//        Image(systemName: "swift")
+//            .font(.system(size: 300))
+//    }
+//
+//    // Demo / debug — adds a gear button that opens a live-tuning sheet.
+//    // Requires an enclosing `NavigationStack`.
+//    SWLiquidMetal(showsControls: true) {
+//        Image(systemName: "apple.logo")
+//            .font(.system(size: 300))
+//    }
+//
+//  Parameters:
+//    - speed: Multiplier on the internal animation time (default `1.0`).
+//    - refraction: Strength of the per-channel chromatic split in
+//                  `0...0.06` (default `0.008`).
+//    - edge: Edge mask sharpness in `0...1` — higher = tighter edge
+//            opacity falloff (default `0.8`).
+//    - liquid: Noise distortion strength in `0...1` (default `0.7`).
+//    - patternBlur: Stripe band softness in `0...0.05` (default `0.005`).
+//    - patternScale: Stripe density in `1...10` — small = wider stripes,
+//                    large = denser (default `5.0`).
+//    - timeScale: Base animation speed multiplier in `0...2`
+//                 (default `0.2`).
+//    - showsControls: Attach a gear `ToolbarItem` that opens a
+//                     live-tuning sheet (default `false`).
+//
+//  Created by Wei Zhong on 5/25/26.
+//
+
+import SwiftUI
+
+// MARK: - Main View
+
+struct SWLiquidMetal<Content: View>: View {
+    /// Multiplier on the internal animation time.
+    var speed: Float = 1.0
+
+    /// Strength of the per-channel chromatic split (0...0.06 reasonable).
+    var refraction: Float = 0.008
+
+    /// Edge mask sharpness in 0...1.
+    var edge: Float = 0.8
+
+    /// Noise distortion strength in 0...1.
+    var liquid: Float = 0.1
+
+    /// Stripe band softness in 0...0.05.
+    var patternBlur: Float = 0.005
+
+    /// Stripe density in 1...10.
+    var patternScale: Float = 1
+
+    /// Base animation speed multiplier in 0...2.
+    var timeScale: Float = 0.2
+
+    /// When `true`, attaches a gear `ToolbarItem` that opens a live-tuning sheet.
+    var showsControls: Bool = false
+
+    private let content: Content
+
+    init(
+        speed: Float = 1.0,
+        refraction: Float = 0.008,
+        edge: Float = 0.8,
+        liquid: Float = 0.3,
+        patternBlur: Float = 0.005,
+        patternScale: Float = 2.5,
+        timeScale: Float = 0.2,
+        showsControls: Bool = false,
+        @ViewBuilder content: () -> Content
+    ) {
+        self.speed = speed
+        self.refraction = refraction
+        self.edge = edge
+        self.liquid = liquid
+        self.patternBlur = patternBlur
+        self.patternScale = patternScale
+        self.timeScale = timeScale
+        self.showsControls = showsControls
+        self.content = content()
+    }
+
+    var body: some View {
+        if showsControls {
+            SWLiquidMetalControlled(initial: self, content: content)
+        } else {
+            SWLiquidMetalRenderer(initial: self, content: content)
+        }
+    }
+}
+
+// MARK: - Renderer
+
+private struct SWLiquidMetalRenderer<Content: View>: View {
+    let initial: SWLiquidMetal<Content>
+    let content: Content
+
+    @State private var start: Date = .now
+
+    var body: some View {
+        TimelineView(.animation) { ctx in
+            let elapsed = Float(ctx.date.timeIntervalSince(start))
+            // The shader only samples the layer at the current pixel
+            // (and reads layer.r for the edge mask) — no need for any
+            // sample offset budget.
+            content.layerEffect(
+                ShaderLibrary.swLiquidMetal(
+                    .boundingRect,
+                    .float(elapsed),
+                    .float(initial.speed),
+                    .float(initial.refraction),
+                    .float(initial.edge),
+                    .float(initial.liquid),
+                    .float(initial.
```

**File**: `ShipSwift/Service/ComponentRegistry.swift` (modified, +26/-0)
```diff
@@ -795,6 +795,32 @@ struct ComponentRegistry {
             presentation: .push
         )
 
+        reg["liquid-metal"] = ComponentEntry(
+            title: "Liquid Metal",
+            icon: "drop.triangle.fill",
+            description: "Metal-shader liquid-metal image filter (Paper Shaders port by Stephen Haney) — simplex-noise driven stripe pattern with refraction, edge-aware bulge, and per-channel chromatic shift over any source view",
+            preview: {
+                AnyView(
+                    SWLiquidMetal {
+                        Image(systemName: "apple.logo")
+                            .font(.system(size: 100))
+                    }
+                    .frame(height: 150)
+                    .clipShape(RoundedRectangle(cornerRadius: 12))
+                )
+            },
+            fullView: {
+                AnyView(
+                    SWLiquidMetal(showsControls: true) {
+                        Image(systemName: "apple.logo")
+                            .font(.system(size: 300))
+                    }
+                    .ignoresSafeArea()
+                )
+            },
+            presentation: .push
+        )
+
         reg["orbiting-logos"] = ComponentEntry(
             title: "Orbiting Logos",
             icon: "atom",
```

**File**: `ShipSwift/View/ComponentView.swift` (modified, +13/-0)
```diff
@@ -598,6 +598,19 @@ struct ComponentView: View {
                 )
             }
 
+            ComponentNavigationLink {
+                SWLiquidMetal(showsControls: true) {
+                    Image(systemName: "apple.logo")
+                        .font(.system(size: 300))
+                }
+            } label: {
+                ListItem(
+                    title: "Liquid Metal",
+                    icon: "drop.triangle.fill",
+                    description: "Paper Shaders' liquid-metal image filter port (by Stephen Haney) — simplex-noise driven stripe pattern with per-channel chromatic refraction, edge-aware bulge, and flowing chrome over any opaque source view (SF Symbols, logos). Tap the gear to tune refraction, edge, liquid, pattern blur / scale, time scale."
+                )
+            }
+
             ComponentNavigationLink {
                 VStack {
                     SWOrbitingLogos(
```

---

### Incident Patch 14: `bf971a95` (2026-05-24)
**Commit Message**: Add SWHalftone and SWMetaballs shaders with SwiftUI integration

- Implemented SWHalftone.metal and SWHalftone.swift for a procedural halftone effect, featuring customizable parameters for ink color, paper color, dot size, and more.
- Introduced SWMetaballs.metal and SWMetaballs.swift to create glowing jelly metaball blobs with dynamic shading and customizable properties.
- Both effects utilize SwiftUI's new shader capabilities and provide user interfaces for real-time parameter adjustments.

**File**: `ShipSwift/Localizable.xcstrings` (modified, +90/-0)
```diff
@@ -1530,6 +1530,56 @@
     },
     "Gradient Divider" : {
 
+    },
+    "Grain Gradient" : {
+      "localizations" : {
+        "zh-Hans" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "颗粒渐变"
+          }
+        }
+      }
+    },
+    "Grain Gradient Controls" : {
+      "localizations" : {
+        "zh-Hans" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "颗粒渐变控制"
+          }
+        }
+      }
+    },
+    "Grid" : {
+      "localizations" : {
+        "zh-Hans" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "网格"
+          }
+        }
+      }
+    },
+    "Halftone" : {
+      "localizations" : {
+        "zh-Hans" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "半色调"
+          }
+        }
+      }
+    },
+    "Halftone Controls" : {
+      "localizations" : {
+        "zh-Hans" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "半色调控制"
+          }
+        }
+      }
     },
     "Happiness" : {
 
@@ -1731,6 +1781,16 @@
     },
     "Info" : {
 
+    },
+    "Ink" : {
+      "localizations" : {
+        "zh-Hans" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "墨色"
+          }
+        }
+      }
     },
     "Ink 1" : {
       "localizations" : {
@@ -1873,6 +1933,26 @@
     },
     "Message bubbles, text input, voice recording waveform" : {
 
+    },
+    "Metaballs" : {
+      "localizations" : {
+        "zh-Hans" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "金属球"
+          }
+        }
+      }
+    },
+    "Metaballs Controls" : {
+      "localizations" : {
+        "zh-Hans" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "金属球控制"
+          }
+        }
+      }
     },
     "Module" : {
 
@@ -1972,6 +2052,16 @@
         }
       }
     },
+    "Paper" : {
+      "localizations" : {
+        "zh-Hans" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "纸张"
+          }
+        }
+      }
+    },
     "Password" : {
 
     },
```

**File**: `ShipSwift/SWPackage/SWAnimation/SWMetal/SWGrainGradient.metal` (added, +85/-0)
```diff
@@ -0,0 +1,85 @@
+//
+//  SWGrainGradient.metal
+//  ShipSwift
+//
+//  Stitchable SwiftUI color effect — soft tri-color gradient with film grain.
+//
+//  Two low-frequency value-noise samples drive the blend between three
+//  user colors, producing a slow, premium-feeling color field. A per-frame
+//  high-frequency hash adds film grain so the surface always reads as
+//  "designed" rather than flat — the staple of 2025-era hero backgrounds
+//  (Apple Music posters, Spotify hero cards, Linear gradients).
+//
+//  Paired with: SWGrainGradient.swift
+//  Entry point: `swGrainGradient` — invoked via SwiftUI `.colorEffect(...)`.
+//
+//  Requires iOS 17+ / macOS 14+.
+//
+
+#include <metal_stdlib>
+#include <SwiftUI/SwiftUI_Metal.h>
+using namespace metal;
+
+static float swGrainGradientHash21(float2 p) {
+    p = fract(p * float2(123.34, 456.21));
+    p += dot(p, p + 45.32);
+    return fract(p.x * p.y);
+}
+
+// Bilinear value noise with smoothstep interpolation.
+static float swGrainGradientVNoise(float2 p) {
+    float2 i = floor(p);
+    float2 f = fract(p);
+    float2 u = f * f * (3.0 - 2.0 * f);
+    float a = swGrainGradientHash21(i);
+    float b = swGrainGradientHash21(i + float2(1.0, 0.0));
+    float c = swGrainGradientHash21(i + float2(0.0, 1.0));
+    float d = swGrainGradientHash21(i + float2(1.0, 1.0));
+    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
+}
+
+[[ stitchable ]] half4 swGrainGradient(float2 position,
+                                       half4  color,
+                                       float4 boundingRect,
+                                       float  time,
+                                       float  speed,
+                                       float  scale,
+                                       float  grain,
+                                       float  contrast,
+                                       half4  color1,
+                                       half4  color2,
+                                       half4  color3) {
+    float2 size = boundingRect.zw;
+    // Normalized coords (0..1), then scaled for the noise sampler.
+    float2 uv = position / max(min(size.x, size.y), 1.0);
+    float2 ap = uv * max(scale, 0.0001);
+
+    // Time is slowed by 0.15 — grain gradients are meant to drift, not flow.
+    float t = time * speed * 0.15;
+
+    // Two low-frequency samples drive the two blend weights between the
+    // three colors. Different offsets / scales decouple them so the field
+    // doesn't collapse into a single direction of motion.
+    float n1 = swGrainGradientVNoise(ap         + float2( t,         t * 0.6));
+    float n2 = swGrainGradientVNoise(ap * 0.7   + float2(-t * 0.4,   t * 0.3) + 17.0);
+
+    // Contrast-shape each weight before blending so the user can compress
+    // colors toward one dominant tone or open them up.
+    float w1 = clamp(pow(n1, max(contrast, 0.001)), 0.0, 1.0);
+    float w2 = clamp(pow(n2, max(contrast, 0.001)), 0.0, 1.0);
+
+    float3 c1 = float3(color1.rgb);
+    float3 c2 = float3(color2.rgb);
+    float3 c3 = float3(color3.rgb);
+
+    float3 col = mix(c1, c2, w1);
+    col        = mix(col, c3, w2);
+
+    // Film grain — high-frequency hash on raw pixel position (independent
+    // of `scale`) shifted per-frame so the grain shimmers like actual film.
+    // Centered around 0 so it adds equally to highlights and shadows.
+    float g = swGrainGradientHash21(position * 0.5 + time * 60.0) - 0.5;
+    col    += g * grain;
+
+    return half4(half3(col), 1.0);
+}
```

**File**: `ShipSwift/SWPackage/SWAnimation/SWMetal/SWGrainGradient.swift` (added, +282/-0)
```diff
@@ -0,0 +1,282 @@
+//
+//  SWGrainGradient.swift
+//  ShipSwift
+//
+//  Soft tri-color noise gradient with film grain, rendered via a SwiftUI
+//  Metal stitchable shader. Two low-frequency value-noise samples drift
+//  three user colors against each other; a per-frame high-frequency hash
+//  adds film grain so the surface reads as designed rather than flat —
+//  the 2025-era staple of Apple Music posters and Spotify hero cards.
+//
+//  Requires iOS 17+ / macOS 14+ (SwiftUI `ShaderLibrary`,
+//  `Shader`/`ShaderFunction`, Metal `stitchable`).
+//
+//  Usage:
+//    // Default — twilight peach / lilac gradient, full-screen
+//    ZStack {
+//        SWGrainGradient()
+//            .ignoresSafeArea()
+//        // Your content here
+//    }
+//
+//    // Recolor — cool mint
+//    SWGrainGradient(
+//        color1: .teal,
+//        color2: .green,
+//        color3: .mint
+//    )
+//
+//    // As a hero background
+//    heroContent
+//        .background { SWGrainGradient() }
+//
+//    // Demo / debug — adds a gear button in the navigation bar that
+//    // opens a sheet to tweak every parameter live. Disabled by default.
+//    SWGrainGradient(showsControls: true)
+//
+//  Parameters:
+//    - color1: First color, dominant in low-weight regions
+//              (default warm peach `#FFB380`)
+//    - color2: Second color, mixed in by the first noise sample
+//              (default soft lilac `#B399FF`)
+//    - color3: Third color, mixed in by the second noise sample
+//              (default rose `#FF8099`)
+//    - speed: Multiplier on the internal drift time (default `1.0`)
+//    - scale: Spatial scale of the noise field — higher = smaller,
+//             more numerous color cells (default `1.2`)
+//    - grain: Amplitude of the per-frame film grain. `0` = clean
+//             gradient, `0.1` ≈ noticeable, `0.2` = chunky photo
+//             grain (default `0.06`)
+//    - contrast: Gamma exponent on the noise blend weights — higher
+//                = sharper color transitions, lower = smoother
+//                pastel field (default `1.0`)
+//    - showsControls: When `true`, adds a gear `ToolbarItem` to the
+//                     enclosing `NavigationStack` that opens a
+//                     live-tuning sheet. Default `false`.
+//
+//  Notes:
+//    - Grain is sampled at raw pixel position (independent of `scale`)
+//      so the texture stays film-like at any zoom.
+//    - Time is multiplied by 0.15 internally; the field is meant to
+//      drift slowly. Use the speed slider to push it faster if needed.
+//    - When `showsControls` is `true`, the gear button is a native
+//      `ToolbarItem` — the call site must be inside a `NavigationStack`.
+//
+//  Created by Wei Zhong on 5/24/26.
+//
+
+import SwiftUI
+
+// MARK: - Main View
+
+struct SWGrainGradient: View {
+    /// First color, dominant in low-weight regions.
+    var color1: Color = Color(red: 1.0,   green: 0.702, blue: 0.502) // #FFB380
+
+    /// Second color, mixed in by the first noise sample.
+    var color2: Color = Color(red: 0.702, green: 0.6,   blue: 1.0)   // #B399FF
+
+    /// Third color, mixed in by the second noise sample.
+    var color3: Color = Color(red: 1.0,   green: 0.502, blue: 0.6)   // #FF8099
+
+    /// Multiplier on the internal drift time.
+    var speed: Float = 1.0
+
+    /// Spatial scale of the noise field.
+    var scale: Float = 1.2
+
+    /// Amplitude of the per-frame film grain.
+    var grain: Float = 0.06
+
+    /// Gamma exponent on the noise blend weights.
+    var contrast: Float = 1.0
+
+    /// When `true`, attaches a gear `ToolbarItem` that opens a live-tuning sheet.
+    var showsControls: Bool = false
+
+    var body: some View {
+        if showsControls {
+            SWGrainGradientControlled(initial: self)
+        } else {
+            SWGrainGradientRenderer(
+                color1: color1,
+                color2: color2,
+                color3: color3,
+                speed: speed,
+                scale: scale,
+                grain: grain,
+                contrast: contrast
+            )
+        }
+    }
+}
+
+// MARK: - Renderer (pure shader binding)
+
+private struct SWGrainGradientRenderer: View {
+    let color1: Color
+    let color2: Color
+    let color3: Color
+    let speed: Float
+    let scale: Float
+    let grain: Float
+    let contrast: Float
+
+    @State private var start: Date = .now
+
+    var body: some View {
+        TimelineView(.animation) { ctx in
+            let elapsed = Float(ctx.date.timeIntervalSince(start))
+            // Base layer is `color1` so the first frame matches the gradient
+            // tone before the shader runs — avoids any black flash.
+            color1
+                .colorEffect(
+                    ShaderLibrary.swGrainGradient(
+                        .boundingRect,
+                        .float(elapsed),
+                        .float(speed),
+                        .float(scale),
+            
```

**File**: `ShipSwift/SWPackage/SWAnimation/SWMetal/SWHalftone.metal` (added, +86/-0)
```diff
@@ -0,0 +1,86 @@
+//
+//  SWHalftone.metal
+//  ShipSwift
+//
+//  Stitchable SwiftUI color effect — print-shop halftone dots over a
+//  procedurally generated luminance field.
+//
+//  A rotating radial gradient (drifting bright spot + low-frequency sin
+//  band) provides the underlying luminance. The screen is then quantized
+//  into a rotated cell grid; in each cell, one solid ink dot is drawn
+//  with radius proportional to `(1 - luminance)` — dark cells get big
+//  dots, bright cells get small or empty dots, producing the classic
+//  newspaper-print "Lichtenstein" texture.
+//
+//  Paired with: SWHalftone.swift
+//  Entry point: `swHalftone` — invoked via SwiftUI `.colorEffect(...)`.
+//
+//  Requires iOS 17+ / macOS 14+.
+//
+
+#include <metal_stdlib>
+#include <SwiftUI/SwiftUI_Metal.h>
+using namespace metal;
+
+[[ stitchable ]] half4 swHalftone(float2 position,
+                                  half4  color,
+                                  float4 boundingRect,
+                                  float  time,
+                                  float  speed,
+                                  float  dotSize,
+                                  float  angle,
+                                  float  scale,
+                                  float  contrast,
+                                  half4  ink,
+                                  half4  paper) {
+    float2 size   = boundingRect.zw;
+    float2 center = 0.5 * size;
+    float  minDim = max(min(size.x, size.y), 1.0);
+
+    float t = time * speed;
+
+    // Rotate the pixel position into the halftone grid space. Real CMYK
+    // plates are angled (15°, 45°, 75°) to avoid moire — exposing `angle`
+    // lets the user dial that in.
+    float s = sin(angle);
+    float c = cos(angle);
+    float2 p       = position - center;
+    float2 rotated = float2(c * p.x - s * p.y,
+                            s * p.x + c * p.y);
+
+    // Quantize rotated position to a cell. One dot per cell, all dots in
+    // a cell evaluated against the same per-cell luminance.
+    float  cellSize         = max(dotSize, 1.0);
+    float2 cellIndex        = floor(rotated / cellSize);
+    float2 rotatedCellCenter = (cellIndex + 0.5) * cellSize;
+
+    // Inverse-rotate the cell center back to screen space so luminance
+    // (which is defined in the unrotated source frame) is sampled at the
+    // visual position of the dot, not at the rotated grid coordinate.
+    float2 cellPxOffset = float2( c * rotatedCellCenter.x + s * rotatedCellCenter.y,
+                                  -s * rotatedCellCenter.x + c * rotatedCellCenter.y);
+    float2 cellPxCenter = cellPxOffset + center;
+
+    // Procedural luminance — a bright spot wobbling around the center +
+    // a horizontal sin band for variety. Output is in [0, 1] after the
+    // contrast shape.
+    float2 cellUV = (cellPxCenter - center) / minDim;
+    float2 wob    = 0.4 * float2(cos(t * 0.6), sin(t * 0.8));
+    float  lum    = 1.0 - length(cellUV - wob) * 1.4;
+    lum          += 0.3 * sin(cellUV.y * 5.0 * max(scale, 0.0001) + t * 1.4);
+    lum           = clamp((lum - 0.5) * max(contrast, 0.0001) + 0.5, 0.0, 1.0);
+
+    // Dot radius: dark cells (low lum) draw a large dot. Factor 1.414
+    // (≈ √2) lets dots overlap into solid ink at full black.
+    float maxR = cellSize * 0.5 * 1.414;
+    float r    = (1.0 - lum) * maxR;
+
+    // Distance from current rotated pixel to its rotated cell center.
+    // Smoothstep edge in screen-pixel units (0.7) gives anti-aliased dot rims
+    // regardless of cell size.
+    float dist = length(rotated - rotatedCellCenter);
+    float mask = 1.0 - smoothstep(r - 0.7, r + 0.7, dist);
+
+    half3 col = mix(paper.rgb, ink.rgb, half(mask));
+    return half4(col, 1.0);
+}
```

**File**: `ShipSwift/SWPackage/SWAnimation/SWMetal/SWHalftone.swift` (added, +289/-0)
```diff
@@ -0,0 +1,289 @@
+//
+//  SWHalftone.swift
+//  ShipSwift
+//
+//  Print-shop halftone dots over a procedurally drifting luminance field,
+//  rendered via a SwiftUI Metal stitchable shader. The screen is quantized
+//  into a rotated cell grid; each cell draws one ink dot whose radius is
+//  proportional to `(1 - luminance)` — dark = big dot, bright = small or
+//  empty. Output reads like a newspaper-print / Lichtenstein texture.
+//
+//  Requires iOS 17+ / macOS 14+ (SwiftUI `ShaderLibrary`,
+//  `Shader`/`ShaderFunction`, Metal `stitchable`).
+//
+//  Usage:
+//    // Default — black ink on cream paper, full-screen
+//    ZStack {
+//        SWHalftone()
+//            .ignoresSafeArea()
+//        // Your content here
+//    }
+//
+//    // Recolor — magenta on white, larger dots
+//    SWHalftone(
+//        dotSize: 24,
+//        ink: .pink,
+//        paper: .white
+//    )
+//
+//    // As a section background
+//    myContent
+//        .background { SWHalftone() }
+//
+//    // Demo / debug — adds a gear button in the navigation bar that
+//    // opens a sheet to tweak every parameter live. Disabled by default.
+//    SWHalftone(showsControls: true)
+//
+//  Parameters:
+//    - ink: Color of the dots (default near-black `#1A1A1A`)
+//    - paper: Color of the background paper
+//             (default warm cream `#F5EFE0`)
+//    - speed: Multiplier on the internal luminance-spot drift time
+//             (default `1.0`)
+//    - dotSize: Cell size in screen pixels — also the maximum dot
+//               diameter. Higher = chunkier print look (default `16`)
+//    - angle: Grid rotation angle in radians. Real CMYK plates use
+//             ~15° / 45° / 75° to avoid moire (default `0.785`, π/4)
+//    - scale: Frequency of the horizontal sin band in the luminance
+//             field — higher = more bands (default `1.0`)
+//    - contrast: Steepness of the luminance → dot-size mapping —
+//                higher = more pure black/white, lower = more midtones
+//                (default `1.6`)
+//    - showsControls: When `true`, adds a gear `ToolbarItem` to the
+//                     enclosing `NavigationStack` that opens a
+//                     live-tuning sheet. Default `false`.
+//
+//  Notes:
+//    - This is a procedural full-screen background; it does NOT apply a
+//      halftone filter to existing content. (That would be a `layerEffect`
+//      and is intentionally not in scope for the current SWMetal family.)
+//    - Dot edges are smoothstepped in screen-pixel units (±0.7) so they
+//      stay anti-aliased at any `dotSize`.
+//    - When `showsControls` is `true`, the gear button is a native
+//      `ToolbarItem` — the call site must be inside a `NavigationStack`.
+//
+//  Created by Wei Zhong on 5/24/26.
+//
+
+import SwiftUI
+
+// MARK: - Main View
+
+struct SWHalftone: View {
+    /// Color of the dots.
+    var ink: Color = Color(red: 0.102, green: 0.102, blue: 0.102) // #1A1A1A
+
+    /// Color of the background paper.
+    var paper: Color = Color(red: 0.961, green: 0.937, blue: 0.878) // #F5EFE0
+
+    /// Multiplier on the internal luminance-spot drift time.
+    var speed: Float = 1.0
+
+    /// Cell size in screen pixels.
+    var dotSize: Float = 16
+
+    /// Grid rotation angle in radians (π/4 ≈ 0.785 by default).
+    var angle: Float = 0.785
+
+    /// Frequency of the horizontal sin band in the luminance field.
+    var scale: Float = 1.0
+
+    /// Steepness of the luminance → dot-size mapping.
+    var contrast: Float = 1.6
+
+    /// When `true`, attaches a gear `ToolbarItem` that opens a live-tuning sheet.
+    var showsControls: Bool = false
+
+    var body: some View {
+        if showsControls {
+            SWHalftoneControlled(initial: self)
+        } else {
+            SWHalftoneRenderer(
+                ink: ink,
+                paper: paper,
+                speed: speed,
+                dotSize: dotSize,
+                angle: angle,
+                scale: scale,
+                contrast: contrast
+            )
+        }
+    }
+}
+
+// MARK: - Renderer (pure shader binding)
+
+private struct SWHalftoneRenderer: View {
+    let ink: Color
+    let paper: Color
+    let speed: Float
+    let dotSize: Float
+    let angle: Float
+    let scale: Float
+    let contrast: Float
+
+    @State private var start: Date = .now
+
+    var body: some View {
+        TimelineView(.animation) { ctx in
+            let elapsed = Float(ctx.date.timeIntervalSince(start))
+            // Base layer is `paper` so the first frame already looks correct
+            // before the shader fills in the dots.
+            paper
+                .colorEffect(
+                    ShaderLibrary.swHalftone(
+                        .boundingRect,
+                        .float(elapsed),
+                        .float(speed),
+                        .float(dotSize),
+                        .float(angle),
+                        .float(scale),
+                
```

**File**: `ShipSwift/SWPackage/SWAnimation/SWMetal/SWMetaballs.metal` (added, +199/-0)
```diff
@@ -0,0 +1,199 @@
+//
+//  SWMetaballs.metal
+//  ShipSwift
+//
+//  Stitchable SwiftUI color effect — glowing jelly metaball blobs.
+//
+//  Up to eight signed-distance circles orbit independently and are merged
+//  via a polynomial smooth-min (Inigo Quilez) into a single fluid field.
+//  The merged blob is shaded as a translucent jelly orb — every shading
+//  cue is driven by the surface itself rather than baked into a flat
+//  gradient, so the result feels three-dimensional from any angle:
+//
+//    1. Per-ball fake spherical normal blended by influence weight
+//    2. Color triplet (highlight / mid / shadow) mixed by Lambertian term
+//    3. Fresnel edge — pow(1 - n.z, k) — for translucent glass rim
+//    4. Subsurface depth tint — interior darkens / saturates with depth
+//    5. Specular hot spot from a single key light (`reflect()` + view)
+//    6. Sub-orb caustic noise so the interior never looks frozen
+//    7. Soft rim halo (glow) just outside the silhouette
+//
+//  Paired with: SWMetaballs.swift
+//  Entry point: `swMetaballs` — invoked via SwiftUI `.colorEffect(...)`.
+//
+//  Requires iOS 17+ / macOS 14+.
+//
+
+#include <metal_stdlib>
+#include <SwiftUI/SwiftUI_Metal.h>
+using namespace metal;
+
+// Polynomial smooth-min — blends two SDFs by `k`. Higher k = gooier merge.
+// Inigo Quilez: https://iquilezles.org/articles/smin/
+static float swMetaballsSmin(float a, float b, float k) {
+    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
+    return mix(b, a, h) - k * h * (1.0 - h);
+}
+
+// 1D scalar hash for per-ball orbit parameters. Cheap and good-enough
+// for static-per-frame ball identity.
+static float swMetaballsHash(float n) {
+    return fract(sin(n) * 43758.5453);
+}
+
+// Cheap value noise — used for sub-orb caustic shimmer.
+static float swMetaballsValueNoise(float2 p) {
+    float2 i = floor(p);
+    float2 f = fract(p);
+    float a = swMetaballsHash(i.x + i.y * 57.0);
+    float b = swMetaballsHash(i.x + 1.0 + i.y * 57.0);
+    float c = swMetaballsHash(i.x + (i.y + 1.0) * 57.0);
+    float d = swMetaballsHash(i.x + 1.0 + (i.y + 1.0) * 57.0);
+    float2 u = f * f * (3.0 - 2.0 * f);
+    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
+}
+
+[[ stitchable ]] half4 swMetaballs(float2 position,
+                                   half4  color,
+                                   float4 boundingRect,
+                                   float  time,
+                                   float  speed,
+                                   float  ballCount,
+                                   float  ballSize,
+                                   float  smoothness,
+                                   float  edgeSoftness,
+                                   float  lightingIntensity,
+                                   float  rimHighlight,
+                                   float  innerShadow,
+                                   half4  colorHighlight,
+                                   half4  colorMid,
+                                   half4  colorShadow,
+                                   half4  background) {
+    float2 size = boundingRect.zw;
+    float  minDim = max(min(size.x, size.y), 1.0);
+    // Centered, aspect-preserving coords (-1..1 along short axis).
+    float2 uv = (position - 0.5 * size) / minDim;
+
+    float t = time * speed;
+
+    int count = int(clamp(ballCount, 1.0, 8.0));
+
+    // Initialize field to a "far positive" SDF so the first smin returns
+    // the first ball cleanly.
+    float field = 10.0;
+
+    // Accumulators for per-ball spherical normal blending.
+    // Each ball contributes a hemisphere normal weighted by how strongly
+    // it influences the current pixel; the merge stays smooth across
+    // ball boundaries because the weight tapers, not the normal itself.
+    float3 accumNormal = float3(0.0);
+    float  accumWeight = 0.0;
+
+    // Loop bound is the static `8` so the compiler can unroll.
+    for (int i = 0; i < 8; i++) {
+        if (i >= count) break;
+        float fi = float(i);
+        // Each ball has its own orbit radius, angular speed, and phase.
+        float orbitR     = mix(0.15, 0.45, swMetaballsHash(fi + 1.7));
+        float orbitSpeed = mix(0.3,  1.1,  swMetaballsHash(fi + 5.3));
+        float phase      = swMetaballsHash(fi + 9.1) * 6.2831;
+        float2 c = orbitR * float2(cos(t * orbitSpeed + phase),
+                                    sin(t * orbitSpeed * 0.83 + phase));
+        float r = ballSize * mix(0.6, 1.2, swMetaballsHash(fi + 11.7));
+        float2 toCenter = uv - c;
+        float  dCenter = length(toCenter);
+        float  d = dCenter - r;
+        field = swMetaballsSmin(field, d, max(smoothness, 0.0001));
+
+        // Fake hemisphere normal — `nz = sqrt(1 - planar²)` recovers the
+        // missing depth so we can treat the disc as a 3D dome. Cubic
+        // falloff makes the closest ball dominate cleanly.
+        float reach = r * 1.4;
+        float inside = saturate(1.0 - d
```

**File**: `ShipSwift/SWPackage/SWAnimation/SWMetal/SWMetaballs.swift` (added, +392/-0)
```diff
@@ -0,0 +1,392 @@
+//
+//  SWMetaballs.swift
+//  ShipSwift
+//
+//  Gooey metaball blobs rendered via a SwiftUI Metal stitchable shader,
+//  shaded as glowing translucent jelly orbs — every shading cue is driven
+//  by the surface itself rather than baked into a flat gradient:
+//
+//    • Per-ball fake spherical normal blended by influence weight
+//    • Triplet colors mixed by Lambertian term (highlight / mid / shadow)
+//    • Fresnel edge for a translucent glass rim
+//    • Subsurface depth tint — interior darkens / saturates with depth
+//    • Specular hot spot from a key light
+//    • Sub-orb caustic shimmer so the interior never freezes
+//    • Soft external halo so the orb looks emissive
+//
+//  Requires iOS 17+ / macOS 14+ (SwiftUI `ShaderLibrary`,
+//  `Shader`/`ShaderFunction`, Metal `stitchable`).
+//
+//  Usage:
+//    // Default — violet → cyan → lime jelly orbs, full-screen
+//    ZStack {
+//        SWMetaballs()
+//            .ignoresSafeArea()
+//        // Your content here
+//    }
+//
+//    // Recolor — molten lava
+//    SWMetaballs(
+//        color1: .yellow,          // highlight (lit face)
+//        color2: .orange,          // mid       (side)
+//        color3: .red,             // shadow    (back face)
+//        background: .black
+//    )
+//
+//    // As a section background
+//    myContent
+//        .background { SWMetaballs() }
+//
+//    // Demo / debug — adds a gear button in the navigation bar that
+//    // opens a sheet to tweak every parameter live. Disabled by default.
+//    SWMetaballs(showsControls: true)
+//
+//  Parameters:
+//    - color1: Highlight color, painted where the surface faces the key
+//              light (default violet `#6633FF`)
+//    - color2: Mid tone, painted on grazing / side-lit areas
+//              (default cyan `#56CDE3`)
+//    - color3: Shadow color, painted on back-lit / deep interior regions
+//              (default lime `#C7F648`)
+//    - background: Color rendered behind the blobs
+//                  (default near-black `#0A0612`)
+//    - speed: Multiplier on the internal orbit time (default `1.0`)
+//    - ballCount: Number of metaballs, clamped to 1–8 (default `5`)
+//    - ballSize: Base radius of each ball in normalized short-axis units
+//                (default `0.18`)
+//    - smoothness: Smooth-min blend factor — higher = gooier merge
+//                  (default `0.15`)
+//    - edgeSoftness: Width of the SDF → alpha smoothstep — higher =
+//                    softer halo around the merged field (default `0.02`)
+//    - lightingIntensity: How strongly shading leans on the lambertian
+//                         triplet vs. a flat mid tone — 0 = matte flat,
+//                         1 = waxy directional (default `0.85`)
+//    - rimHighlight: Combined gain for the fresnel rim, specular hot
+//                    spot, and external halo — 0 = none, 1 = glassy /
+//                    luminous (default `0.6`)
+//    - innerShadow: Depth-driven edge darkening inside the blob — 0 =
+//                   uniform, 1 = deep pillow (default `0.45`)
+//    - showsControls: When `true`, adds a gear `ToolbarItem` to the
+//                     enclosing `NavigationStack` that opens a
+//                     live-tuning sheet. Default `false`.
+//
+//  Notes:
+//    - The shader's loop bound is the static `8` so it always unrolls;
+//      values above 8 are silently truncated.
+//    - Each ball's orbit (radius / speed / phase / size jitter) is
+//      derived from a deterministic hash of its index, so the cluster
+//      animates consistently across frames.
+//    - When `showsControls` is `true`, the gear button is a native
+//      `ToolbarItem` — the call site must be inside a `NavigationStack`.
+//
+//  Created by Wei Zhong on 5/24/26.
+//
+
+import SwiftUI
+
+// MARK: - Main View
+
+struct SWMetaballs: View {
+    /// Highlight color — painted where the surface faces the key light.
+    var color1: Color = Color(red: 0.4,   green: 0.2,   blue: 1.0)    // #6633FF
+
+    /// Mid tone — painted on grazing / side-lit areas.
+    var color2: Color = Color(red: 0.337, green: 0.804, blue: 0.890)  // #56CDE3
+
+    /// Shadow color — painted on back-lit / deep interior regions.
+    var color3: Color = Color(red: 0.780, green: 0.965, blue: 0.282)  // #C7F648
+
+    /// Color rendered behind the blobs.
+    var background: Color = Color(red: 0.039, green: 0.024, blue: 0.071) // #0A0612
+
+    /// Multiplier on the internal orbit time.
+    var speed: Float = 1.0
+
+    /// Number of metaballs (clamped to 1–8 by the shader).
+    var ballCount: Int = 5
+
+    /// Base radius of each ball in normalized short-axis units.
+    var ballSize: Float = 0.18
+
+    /// Smooth-min blend factor — higher = gooier merge.
+    var smoothness: Float = 0.15
+
+    /// Width of the SDF → alpha smoothstep — higher = softer halo.
+    var edgeSoftness: Float = 0.02
+
+    /// Lambertian shading weight (0 = flat mid tone, 1 = full
```

**File**: `ShipSwift/Service/ComponentRegistry.swift` (modified, +60/-0)
```diff
@@ -699,6 +699,66 @@ struct ComponentRegistry {
             presentation: .push
         )
 
+        reg["metaballs"] = ComponentEntry(
+            title: "Metaballs",
+            icon: "circle.hexagonpath.fill",
+            description: "Metal-shader gooey lava-lamp blobs — up to 8 SDF circles merged via smooth-min into one fluid surface",
+            preview: {
+                AnyView(
+                    SWMetaballs()
+                        .frame(height: 150)
+                        .clipShape(RoundedRectangle(cornerRadius: 12))
+                )
+            },
+            fullView: {
+                AnyView(
+                    SWMetaballs(showsControls: true)
+                        .ignoresSafeArea()
+                )
+            },
+            presentation: .push
+        )
+
+        reg["grain-gradient"] = ComponentEntry(
+            title: "Grain Gradient",
+            icon: "circle.grid.cross.fill",
+            description: "Metal-shader soft tri-color noise gradient with film grain — the 2025-era hero background staple",
+            preview: {
+                AnyView(
+                    SWGrainGradient()
+                        .frame(height: 150)
+                        .clipShape(RoundedRectangle(cornerRadius: 12))
+                )
+            },
+            fullView: {
+                AnyView(
+                    SWGrainGradient(showsControls: true)
+                        .ignoresSafeArea()
+                )
+            },
+            presentation: .push
+        )
+
+        reg["halftone"] = ComponentEntry(
+            title: "Halftone",
+            icon: "circle.grid.3x3",
+            description: "Metal-shader print-shop halftone dots over a drifting luminance field — newspaper / Lichtenstein texture",
+            preview: {
+                AnyView(
+                    SWHalftone()
+                        .frame(height: 150)
+                        .clipShape(RoundedRectangle(cornerRadius: 12))
+                )
+            },
+            fullView: {
+                AnyView(
+                    SWHalftone(showsControls: true)
+                        .ignoresSafeArea()
+                )
+            },
+            presentation: .push
+        )
+
         reg["orbiting-logos"] = ComponentEntry(
             title: "Orbiting Logos",
             icon: "atom",
```

---

### Incident Patch 15: `ec9a9cdb` (2026-05-20)
**Commit Message**: feat: add SWAnimatedLoop component with Metal shaders for animated pulsing rings and integrate into ComponentRegistry and ComponentView

**File**: `ShipSwift/Localizable.xcstrings` (modified, +105/-0)
```diff
@@ -1016,6 +1016,24 @@
           }
         }
       }
+    },
+    "Cloud" : {
+
+    },
+    "Color 1" : {
+
+    },
+    "Color 2" : {
+
+    },
+    "Color 3" : {
+
+    },
+    "Color 4" : {
+
+    },
+    "Color 5" : {
+
     },
     "Colors" : {
 
@@ -1121,6 +1139,9 @@
     },
     "Feedback" : {
 
+    },
+    "Field" : {
+
     },
     "Forgot Password?" : {
 
@@ -1311,6 +1332,12 @@
           }
         }
       }
+    },
+    "Fractal Clouds" : {
+
+    },
+    "Fractal Clouds Controls" : {
+
     },
     "Full-stack iOS + AWS backend" : {
 
@@ -1329,6 +1356,9 @@
     },
     "Get Started" : {
 
+    },
+    "Glow" : {
+
     },
     "Google" : {
 
@@ -1344,6 +1374,9 @@
     },
     "Hello World" : {
 
+    },
+    "Highlight" : {
+
     },
     "Home" : {
 
@@ -1526,6 +1559,27 @@
     },
     "Info" : {
 
+    },
+    "Ink 1" : {
+
+    },
+    "Ink 2" : {
+
+    },
+    "Ink 3" : {
+
+    },
+    "Ink 4" : {
+
+    },
+    "Ink Smoke" : {
+
+    },
+    "Ink Smoke Controls" : {
+
+    },
+    "Inks" : {
+
     },
     "Innovation distinguishes between a leader and a follower." : {
 
@@ -1562,6 +1616,15 @@
     },
     "Lifetime updates & new recipes included" : {
 
+    },
+    "Lighting" : {
+
+    },
+    "Liquid Chrome" : {
+
+    },
+    "Liquid Chrome Controls" : {
+
     },
     "Loading data..." : {
 
@@ -1574,6 +1637,9 @@
     },
     "Monthly Revenue" : {
 
+    },
+    "Motion" : {
+
     },
     "Multi-page swipe flow with skip support" : {
 
@@ -1646,6 +1712,9 @@
     },
     "Page Content" : {
 
+    },
+    "Palette" : {
+
     },
     "Password" : {
 
@@ -2035,6 +2104,15 @@
     },
     "Photo capture failed" : {
 
+    },
+    "Plasma" : {
+
+    },
+    "Plasma as button border" : {
+
+    },
+    "Plasma Controls" : {
+
     },
     "Privacy" : {
 
@@ -2560,6 +2638,12 @@
           }
         }
       }
+    },
+    "Shadow" : {
+
+    },
+    "Shape" : {
+
     },
     "Share App" : {
 
@@ -2590,9 +2674,15 @@
     },
     "Signing Out…" : {
 
+    },
+    "Silver" : {
+
     },
     "Skip" : {
 
+    },
+    "Sky" : {
+
     },
     "Sliders" : {
 
@@ -2605,6 +2695,12 @@
     },
     "Standard event types supported by TikTok Ads SDK. Custom events can also be tracked with arbitrary names." : {
 
+    },
+    "Star Color" : {
+
+    },
+    "Starfield Controls" : {
+
     },
     "Start Scan Today" : {
 
@@ -2644,6 +2740,9 @@
     },
     "Supported Events" : {
 
+    },
+    "Surface" : {
+
     },
     "Tab View Template" : {
 
@@ -2731,6 +2830,9 @@
     },
     "TikTok Tracking" : {
 
+    },
+    "Tint" : {
+
     },
     "Tip: register a same-named ColorSet alongside the image set to get a brand-appropriate tint before the image decodes — or as a permanent fallback for empty states." : {
 
@@ -2813,6 +2915,9 @@
     },
     "vs yesterday" : {
 
+    },
+    "Warm Tint" : {
+
     },
     "Warning" : {
 
```

**File**: `ShipSwift/SWPackage/SWAnimation/SWMetal/SWAnimatedLoop.metal` (added, +296/-0)
```diff
@@ -0,0 +1,296 @@
+//
+//  SWAnimatedLoop.metal
+//  ShipSwift
+//
+//  Stitchable SwiftUI color effects — `SWAnimatedLoop` family.
+//
+//  Four hand-tuned styles bundled in one file because they share the same
+//  per-line phase ramp / RGB-channel split / additive composite logic;
+//  they only differ in the distance metric `d` and the pattern term `m`.
+//
+//  Entry points:
+//    - `swAnimatedLoopShape`   — user-pickable shape (circle / square /
+//                                 diamond pip / hexagon / star)
+//    - `swAnimatedLoopDiamond` — L1 distance rings + multiplicative pattern
+//    - `swAnimatedLoopNeon`    — circle rings + per-channel angular wobble
+//    - `swAnimatedLoopWarp`    — stretched-ellipse rings + 1D pattern
+//
+//  All four take the same 18-parameter signature so the Swift renderer can
+//  use a single argument list and dispatch by name. Parameters that don't
+//  apply to a given style are touched with `(void)x;` to make the "unused
+//  on purpose" decision explicit.
+//
+//  Visual concept inspired by aliimam's Shader Animation on 21st.dev (MIT).
+//  https://21st.dev/community/components/aliimam/shader-animation/default
+//
+//  Paired with: SWAnimatedLoop.swift
+//  Requires iOS 17+ / macOS 14+.
+//
+
+#include <metal_stdlib>
+#include <SwiftUI/SwiftUI_Metal.h>
+using namespace metal;
+
+// MARK: - Shape
+
+[[ stitchable ]] half4 swAnimatedLoopShape(float2 position,
+                                           half4  color,
+                                           float4 boundingRect,
+                                           float  time,
+                                           float  speed,
+                                           float  lineWidth,
+                                           float  lines,
+                                           float  spacing,
+                                           float  channelOffset,
+                                           float  patternMod,
+                                           float  rotation,
+                                           float  scale,
+                                           float2 center,
+                                           float  shape,
+                                           float  petals,
+                                           float  angularLobes,
+                                           float  angularAmount,
+                                           float  angularSpeed,
+                                           half4  color1,
+                                           half4  color2,
+                                           half4  color3,
+                                           half4  background) {
+    // Angular params unused by this style — see file header.
+    (void)angularLobes;
+    (void)angularAmount;
+    (void)angularSpeed;
+
+    float2 size = boundingRect.zw;
+    float2 uv   = (position * 2.0 - size) / min(size.x, size.y);
+
+    uv = uv / max(scale, 0.0001);
+    uv -= center;
+    float c = cos(rotation);
+    float s = sin(rotation);
+    uv = float2(uv.x * c - uv.y * s, uv.x * s + uv.y * c);
+
+    float t     = time * speed;
+    int   count = max(1, int(lines));
+
+    int   shapeIdx = int(shape);
+    float d;
+    if (shapeIdx == 1) {
+        d = max(abs(uv.x), abs(uv.y));                      // square
+    } else if (shapeIdx == 2) {
+        d = abs(uv.x) * 1.6 + abs(uv.y) * 0.85;             // diamond pip
+    } else if (shapeIdx == 3) {
+        float2 q = abs(uv);
+        d = max(q.x * 0.866025 + q.y * 0.5, q.y);           // hexagon
+    } else if (shapeIdx == 4) {
+        float ang = atan2(uv.y, uv.x);
+        float r   = length(uv);
+        d = r * (1.0 + 0.35 * cos(petals * ang));           // star
+    } else {
+        d = length(uv);                                     // circle
+    }
+
+    float pmm = max(patternMod, 0.0001);
+    float m   = fmod(uv.x + uv.y, pmm);
+
+    float3 ch[3] = { float3(color1.rgb), float3(color2.rgb), float3(color3.rgb) };
+
+    float3 col = float3(0.0);
+    for (int j = 0; j < 3; j++) {
+        float acc = 0.0;
+        for (int i = 0; i < count; i++) {
+            float f = fract(t - channelOffset * float(j) + 0.01 * float(i)) * spacing - d + m;
+            acc += lineWidth * float(i * i) / max(abs(f), 0.00001);
+        }
+        col += ch[j] * acc;
+    }
+
+    float3 bg = float3(background.rgb);
+    return half4(half3(bg + col), 1.0);
+}
+
+// MARK: - Diamond
+
+[[ stitchable ]] half4 swAnimatedLoopDiamond(float2 position,
+                                             half4  color,
+                                             float4 boundingRect,
+                                             float  time,
+                                             float  speed,
+                                             float  lineWidth,
+                                             float  lines,
+                                             float  spacing,
+              
```

**File**: `ShipSwift/SWPackage/SWAnimation/SWMetal/SWAnimatedLoop.swift` (added, +619/-0)
```diff
@@ -0,0 +1,619 @@
+//
+//  SWAnimatedLoop.swift
+//  ShipSwift
+//
+//  Pulsing rings in one of four hand-tuned styles (Shape / Diamond / Neon /
+//  Warp), rendered via SwiftUI Metal stitchable shaders. The `Shape` style
+//  additionally exposes a 5-way geometric selector (circle / square /
+//  diamond / hexagon / star). All four styles share the same parameter
+//  surface; Neon adds three angular-wobble parameters on top.
+//
+//  Visual concept inspired by aliimam's Shader Animation on 21st.dev (MIT).
+//
+//  Requires iOS 17+ / macOS 14+.
+//
+//  Usage:
+//    // Default — Shape style, circle, red/green/blue rings on black
+//    ZStack {
+//        SWAnimatedLoop()
+//            .ignoresSafeArea()
+//    }
+//
+//    // Switch styles — each style auto-loads its hand-tuned numeric defaults
+//    SWAnimatedLoop(style: .diamond)
+//    SWAnimatedLoop(style: .neon)
+//    SWAnimatedLoop(style: .warp)
+//
+//    // Within Shape style, pick a geometric shape
+//    SWAnimatedLoop(style: .shape, shape: .hexagon)
+//    SWAnimatedLoop(style: .shape, shape: .star, petals: 7)
+//
+//    // As a section background
+//    myContent
+//        .background { SWAnimatedLoop(style: .neon) }
+//
+//    // Demo / debug — adds a gear button in the navigation bar that opens
+//    // a sheet to tweak every parameter live. Disabled by default.
+//    SWAnimatedLoop(showsControls: true)
+//
+//  Parameters:
+//    - style: One of `.shape / .diamond / .neon / .warp` (default `.shape`)
+//    - shape: Geometric shape, only honored when `style == .shape`
+//             (default `.circle`)
+//    - petals: Number of star points, only honored when
+//              `style == .shape && shape == .star` (default `5`)
+//    - color1, color2, color3: Three RGB channel colors (default red/green/blue)
+//    - background: Color rendered behind the rings (default `.black`)
+//    - speed: Time multiplier on the ring sweep (style-specific default)
+//    - lineWidth: Per-ring line thickness (default `0.002`)
+//    - lines: Number of concentric rings (style-specific default)
+//    - spacing: Distance multiplier between rings (style-specific default)
+//    - channelOffset: Phase offset between RGB channels (style-specific default)
+//    - patternMod: Period of the pattern term overlaid on the rings
+//                  (style-specific default)
+//    - rotation: Rotation in radians (default `0`)
+//    - scale: Spatial scale (default `1.0`)
+//    - centerX, centerY: Ring origin offset (default `0, 0`)
+//    - angularLobes, angularAmount, angularSpeed: Per-channel angular wobble
+//             added by the Neon style only (defaults `3.0`, `0.08`, `0.5`)
+//    - showsControls: Demo gear `ToolbarItem`. Default `false`.
+//
+//  Notes:
+//    - When `showsControls` is `true`, the sheet's Style picker resets the
+//      numeric ring parameters (`speed`, `lines`, `spacing`, `channelOffset`,
+//      `patternMod`) to the new style's hand-tuned defaults — intentional,
+//      so each style ships with the look its author designed.
+//    - The Shape selector and Star points slider are hidden in the sheet
+//      unless `style == .shape`. The Angular section appears only for
+//      `style == .neon`. Parameters that don't apply to the current style
+//      are still passed to the shader but ignored there.
+//    - The gear button is a native `ToolbarItem` — the call site must be
+//      inside a `NavigationStack`.
+//
+//  Created by Wei Zhong on 5/20/26.
+//
+
+import SwiftUI
+
+// MARK: - Style
+
+enum SWAnimatedLoopStyle: String, CaseIterable, Identifiable {
+    case shape
+    case diamond
+    case neon
+    case warp
+
+    var id: String { rawValue }
+
+    var displayName: String {
+        switch self {
+        case .shape:   "Shape"
+        case .diamond: "Diamond"
+        case .neon:    "Neon"
+        case .warp:    "Warp"
+        }
+    }
+
+    /// Metal `stitchable` function name in the default `ShaderLibrary`.
+    var shaderName: String {
+        switch self {
+        case .shape:   "swAnimatedLoopShape"
+        case .diamond: "swAnimatedLoopDiamond"
+        case .neon:    "swAnimatedLoopNeon"
+        case .warp:    "swAnimatedLoopWarp"
+        }
+    }
+
+    /// Whether this style consumes the `shape` parameter (Shape style only).
+    var supportsShape: Bool { self == .shape }
+
+    /// Whether this style consumes the angular-wobble parameters (Neon only).
+    var supportsAngular: Bool { self == .neon }
+
+    /// Hand-tuned numeric defaults for this style. Loaded by `SWAnimatedLoop`'s
+    /// initializer and reloaded by the controls sheet on style change.
+    struct NumericDefaults {
+        var speed: Float
+        var lineWidth: Float
+        var lines: Int
+        var spacing: Float
+        var channelOffset: Float
+        var patternMod: Float
+    }
+
+    var numericDefaults: NumericDefaults {
+        switch self {
+        case .shape:
+            return NumericDefaults(speed: 0
```

**File**: `ShipSwift/Service/ComponentRegistry.swift` (modified, +20/-0)
```diff
@@ -679,6 +679,26 @@ struct ComponentRegistry {
             presentation: .push
         )
 
+        reg["animated-loop"] = ComponentEntry(
+            title: "Animated Loop",
+            icon: "circle.dashed",
+            description: "Metal-shader pulsing rings — 4 styles (Shape / Diamond / Neon / Warp) with RGB chromatic split",
+            preview: {
+                AnyView(
+                    SWAnimatedLoop()
+                        .frame(height: 150)
+                        .clipShape(RoundedRectangle(cornerRadius: 12))
+                )
+            },
+            fullView: {
+                AnyView(
+                    SWAnimatedLoop(showsControls: true)
+                        .ignoresSafeArea()
+                )
+            },
+            presentation: .push
+        )
+
         reg["orbiting-logos"] = ComponentEntry(
             title: "Orbiting Logos",
             icon: "atom",
```

**File**: `ShipSwift/View/ComponentView.swift` (modified, +10/-0)
```diff
@@ -540,6 +540,16 @@ struct ComponentView: View {
                 )
             }
 
+            ComponentNavigationLink {
+                SWAnimatedLoop(showsControls: true)
+            } label: {
+                ListItem(
+                    title: "Animated Loop",
+                    icon: "circle.dashed",
+                    description: "Pulsing concentric rings in four hand-tuned styles — Shape (5 geometric shapes: circle/square/diamond/hexagon/star), Diamond (L1 distance), Neon (circle + angular wobble), Warp (stretched ellipse). Three RGB channels phase-offset for chromatic-aberration sweep. Tap the gear to switch style and live-tune."
+                )
+            }
+
             ComponentNavigationLink {
                 VStack {
                     SWOrbitingLogos(
```

#### Recent Merged Pull Requests:
- **PR #62** (2026-07-09): feat(chart): add SWNetworkGraph interactive 3D dependency graph (@w-zhong)
- **PR #59** (closed): fix: wrap SWOrderView content in ScrollView on iOS to prevent button clipping (@LeoLee0812)
- **PR #3** (2026-03-14): feat: add local skills for offline component discovery (@shing19)
- **PR #1** (closed): docs: improve README documentation (@awanawana)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
