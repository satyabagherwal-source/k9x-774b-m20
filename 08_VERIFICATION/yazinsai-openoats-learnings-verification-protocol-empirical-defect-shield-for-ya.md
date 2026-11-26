# Verification Protocol: Verification Protocol: Empirical Defect Shield for yazinsai-openoats-learnings

<!-- PROVENANCE_START
{
  "source_repository": "yazinsai-openoats-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-26T15:02:31.359Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-yazinsai-openoats-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [yazinsai-openoats-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-26T15:02:31.359Z`  
> **Learning ID**: `LEARN-EVO-yazinsai-openoats-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `yazinsai-openoats-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/yazinsai-openoats-learnings.md`  
> **Source**: github ([https://github.com/yazinsai/OpenOats](https://github.com/yazinsai/OpenOats))  
> **Source Version**: `d8caac78`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-26T15:02:18.079Z  
> **Learning ID**: `learn-github-yazinsai-openoats`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): yazinsai/OpenOats

> **Canonical Artifact**: `07_PROJECT_LEARNING/yazinsai-openoats-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/yazinsai/OpenOats](https://github.com/yazinsai/OpenOats))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-26T15:02:18.073Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `yazinsai/OpenOats`
- **Description**: A beautiful, minimal meeting recorder for Mac. Press Start, and after Stop you get Notes and a transcript in one markdown file. On-device, free and open source.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2691 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `OpenOats/Sources/OatsCore/AnthropicNotes.swift`
```
import Foundation

/// The Anthropic Notes backend: the native Messages API (`POST …/v1/messages`), non-streaming.
public struct AnthropicNotes: NotesBackend {
    public var address: String
    public var model: String
    public var apiKey: String?
    public var contextTokens: Int
    public var client: CloudClient

    public var name: String { "anthropic:\(model)" }

    public init(_ setup: BackendSetup<NotesBackendType>, session: URLSession = URLSession(configuration: .ephemeral)) {
        address = setup.address ?? "https://api.anthropic.com"
        model = setup.model ?? "claude-sonnet-4-5"
        apiKey = setup.apiKey?.isEmpty == false ? setup.apiKey : nil
        contextTokens = setup.contextTokens
        client = CloudClient(backend: "Anthropic", session: session)
    }

    /// Accepts `host`, `host/v1` or the full `…/v1/messages`.
    var endpoint: URL? {
        var s = address.trimmingCharacters(in: .whitespaces)
        while s.hasSuffix("/") { s.removeLast() }
        for suffix in ["/messages", "/v1"] where s.hasSuffix(suffix) { s.removeLast(suffix.count) }
        guard let url = URL(string: s + "/v1/messages"), url.scheme?.hasPrefix("http") == true, url.host() != nil else { return nil }
        return url
    }

    public func complete(system: String, user: String) async throws -> String {
        guard let url = endpoint else { throw CloudError.badAddress(address) }
        guard let apiKey else { throw CloudError.invalidKey(backend: client.backend) }
        let body: [String: Any] = ["model": model, "max_tokens": 8_192, "system": system, "messages": [["role": "user", "content": user]]]
        var request = URLRequest(url: url, timeoutInterval: 600)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let data = try await client.send(request)
        let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        guard let content = json?["content"] as? [[String: Any]] else { throw CloudError.badResponse(backend: client.backend) }
        let text = content.compactMap { $0["type"] as? String == "text" ? $0["text"] as? String : nil }.joined()
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { throw NotesError.empty }
        return text
    }
}

```

### Core Architecture Module: `OpenOats/Sources/OatsCore/AssemblyAITranscription.swift`
```
import Foundation

/// The AssemblyAI Transcription backend: upload the m4a track, create a transcript, poll until it's done.
/// A single mixed-file import gets speaker labels. The speech model isn't pinned, so AssemblyAI picks its current one.
public struct AssemblyAITranscription: TranscriptionBackend {
    public static let defaultAddress = "https://api.assemblyai.com/v2"
    public var address: String
    public var apiKey: String?
    public var client: CloudClient
    public var chunkSeconds: TimeInterval = 3 * 3600
    public var pollInterval = Duration.seconds(3)
    /// About 30 minutes at the default interval.
    public var maxPolls = 600

    public var name: String { "assemblyai" }
    public var separatesSpeakers: Bool { true }

    public init(address: String? = nil, apiKey: String?, session: URLSession = URLSession(configuration: .ephemeral)) {
        self.address = address ?? Self.defaultAddress
        self.apiKey = apiKey?.isEmpty == false ? apiKey : nil
        client = CloudClient(backend: "AssemblyAI", session: session)
    }

    public init(_ setup: BackendSetup<TranscriptionBackendType>) {
        self.init(address: setup.address, apiKey: setup.apiKey)
    }

    public func transcribe(_ audio: URL, language: String?) async throws -> [TimedSegment] {
        guard let url = URL(string: address), url.scheme?.hasPrefix("http") == true else { throw CloudError.badAddress(address) }
        guard apiKey != nil else { throw CloudError.invalidKey(backend: client.backend) }
        let diarize = audio.deletingPathExtension().lastPathComponent == Track.mixed.rawValue
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("oats-upload-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: directory) }
        var segments: [TimedSegment] = []
        for chunk in try TrackAudio.compressedChunks(of: audio, maxSeconds: chunkSeconds, in: directory) {
            let upload: Upload = try await send(url.appendingPathComponent("upload"), body: try Data(contentsOf: chunk.url), type: "application/octet-stream")
            // The upload address goes back to AssemblyAI with the key, so only accept AssemblyAI's own hosts.
            guard let audioURL = URL(string: upload.upload_url), audioURL.scheme == "https",
                  let host = audioURL.host(), host == url.host() || host.hasSuffix(".assemblyai.com")
            else { throw CloudError.badResponse(backend: client.backend) }

            var job: [String: Any] = ["audio_url": audioURL.absoluteString, "speaker_labels": diarize]
            if let language = language?.split(separator: "-").first { job["language_code"] = String(language) } else { job["language_detection"] = true }
            var transcript: Transcript = try await send(url.appendingPathComponent("transcript"), body: try JSONSerialization.data(withJSONObject: job), type: "application/json")
            var polls = 0
            while transcript.status != "completed" {
                if transcript.status == "error" { throw CloudError.failed(backend: client.backend, message: transcript.error ?? "unknown error") }
                guard polls < maxPolls else { throw CloudError.failed(backend: client.backend, message: "timed out waiting for the transcript") }
                polls += 1
                try await client.sleep(pollInterval)
                transcript = try await send(url.appendingPathComponent("transcript/\(transcript.id)"))
            }
            segments += Word.sentences((transcript.words ?? []).map {
                Word(text: $0.text, start: chunk.offset + $0.start / 1000, end: chunk.offset + $0.end / 1000, speaker: $0.speaker.map { "Speaker \($0)" })
            })
        }
        return segments
    }

    private struct Upload: Decodable { var upload_url: String }
    private struct Transcript: Decodable {
        struct Word: Decodable { var text: String, start: Double, end: Double, speaker: String? }
        var id: String, status: String, error: String?, words: [Word]?
    }

    private func send<T: Decodable>(_ url: URL, body: Data? = nil, type: String? = nil) async throws -> T {
        var request = URLRequest(url: url, timeoutInterval: 600)
        request.httpMethod = body == nil ? "GET" : "POST"
        request.setValue(apiKey, forHTTPHeaderField: "Authorization")
        request.setValue(type, forHTTPHeaderField: "Content-Type")
        request.httpBody = body
        let data = try await client.send(request)
        guard let value = try? JSONDecoder().decode(T.self, from: data) else { throw CloudError.badResponse(backend: client.backend) }
        return value
    }
}

```

### Core Architecture Module: `OpenOats/Sources/OatsCore/BackendMakers.swift`
```
import Foundation

/// A backend config resolved against its Preset, with its API key: what a backend type is built from.
public struct BackendSetup<Kind: Sendable>: Sendable {
    public var type: Kind
    public var address: String?
    public var model: String?
    public var apiKey: String?
    /// Assumed context size: small for local servers, large for cloud APIs.
    public var contextTokens: Int

    public init(type: Kind, address: String?, model: String?, apiKey: String?, contextTokens: Int) {
        self.type = type
        self.address = address
        self.model = model
        self.apiKey = apiKey
        self.contextTokens = contextTokens
    }

    /// Cloud APIs 128k. A local server's context is unknown, so 4096, except Ollama, which is sent `num_ctx` 8192.
    static func contextTokens(_ address: String?) -> Int {
        guard isLocal(address) else { return 128_000 }
        return address.flatMap(URLComponents.init(string:))?.port == 11434 ? 8_192 : 4_096
    }

    static func isLocal(_ address: String?) -> Bool {
        guard let host = address.flatMap(URL.init(string:))?.host()?.lowercased() else { return false }
        return host == "localhost" || host == "::1" || host == "0.0.0.0" || host.hasSuffix(".local")
            || ["127.", "10.", "192.168."].contains { host.hasPrefix($0) }
    }
}

/// How each backend type is built. Each backend ticket adds one line to `builtIn`, e.g.
/// `.openAICompatible: { OpenAICompatibleNotes($0) },`. Types without a line build an `UnavailableBackend`.
public struct BackendMakers: Sendable {
    public var transcription: [TranscriptionBackendType: @Sendable (BackendSetup<TranscriptionBackendType>) -> any TranscriptionBackend]
    public var notes: [NotesBackendType: @Sendable (BackendSetup<NotesBackendType>) -> any NotesBackend]

    public init(transcription: [TranscriptionBackendType: @Sendable (BackendSetup<TranscriptionBackendType>) -> any TranscriptionBackend] = [:],
                notes: [NotesBackendType: @Sendable (BackendSetup<NotesBackendType>) -> any NotesBackend] = [:]) {
        self.transcription = transcription
        self.notes = notes
    }

    public static let builtIn = BackendMakers(
        transcription: [
            .openAIStyle: { OpenAIStyleTranscription($0) },
            .elevenLabs: { ElevenLabsTranscription($0) },
            .assemblyAI: { AssemblyAITranscription($0) },
            .gemini: { GeminiTranscription($0) },
        ],
        notes: [
            .openAICompatible: { OpenAICompatibleNotes($0) },
            .anthropic: { AnthropicNotes($0) },
            .gemini: { GeminiNotes($0) },
        ]
    )
}

/// Stands in for a backend type this build doesn't have; fails when used, so Processing shows Needs attention.
struct UnavailableBackend: TranscriptionBackend, NotesBackend {
    var name: String
    var contextTokens: Int { 0 }
    var error: Error { NSError(domain: "OpenOats", code: 1, userInfo: [NSLocalizedDescriptionKey: "The \(name) backend isn't available in this build."]) }
    func transcribe(_ audio: URL, language: String?) async throws -> [TimedSegment] { throw error }
    func complete(system: String, user: String) async throws -> String { throw error }
}

```

### Core Architecture Module: `OpenOats/Sources/OatsCore/Backends.swift`
```
import Foundation

/// A stretch of speech in one track, in seconds from the start of the track.
public struct TimedSegment: Codable, Sendable, Equatable {
    public var start: TimeInterval
    public var end: TimeInterval
    public var text: String
    /// Speaker label from a backend that separates speakers itself; nil otherwise.
    public var speaker: String?

    public init(start: TimeInterval, end: TimeInterval, text: String, speaker: String? = nil) {
        self.start = start
        self.end = end
        self.text = text
        self.speaker = speaker
    }
}

/// Turns one track's audio file (`.pcm` 16 kHz mono Int16, `.m4a`, or any AVFoundation format) into timed segments.
public protocol TranscriptionBackend: Sendable {
    /// Short engine name written to the Meeting file's `engine` field, e.g. `parakeet-v3`.
    var name: String { get }
    /// True if the backend labels speakers itself (used only for single mixed-file imports).
    var separatesSpeakers: Bool { get }
    /// `language` is a BCP 47 code or nil for the backend's own detection.
    func transcribe(_ audio: URL, language: String?) async throws -> [TimedSegment]
    /// Frees loaded models; Processing calls it after the transcribe step.
    func unload() async
}

extension TranscriptionBackend {
    public var separatesSpeakers: Bool { false }
    public func unload() async {}
}

/// A language model that only ever sees text: system + user prompt in, text out.
public protocol NotesBackend: Sendable {
    /// Short name recorded in `meeting.json`, e.g. `openai-compatible:gpt-4.1-mini`.
    var name: String { get }
    /// Approximate context size in tokens, used to decide when to summarise in pieces.
    var contextTokens: Int { get }
    func complete(system: String, user: String) async throws -> String
}

/// The Transcription backend types (ADR 0003).
public enum TranscriptionBackendType: String, Codable, Sendable, CaseIterable {
    case onDevice = "on-device", openAIStyle = "openai-style", elevenLabs = "elevenlabs", assemblyAI = "assemblyai", gemini
}

/// The Notes backend types (ADR 0003).
public enum NotesBackendType: String, Codable, Sendable, CaseIterable {
    case none, openAICompatible = "openai-compatible", anthropic, gemini
}

/// One backend slot's saved configuration. Secrets live in the Keychain, never here.
public struct BackendConfig<Kind: Codable & Sendable & Hashable>: Codable, Sendable, Hashable {
    public var type: Kind
    /// Base address, e.g. `http://localhost:11434/v1`; nil means the type's default.
    public var address: String?
    public var model: String?
    /// Name of the Preset this was filled in from, if any.
    public var preset: String?

    public init(type: Kind, address: String? = nil, model: String? = nil, preset: String? = nil) {
        self.type = type
        self.address = address
        self.model = model
        self.preset = preset
    }
}

public typealias TranscriptionConfig = BackendConfig<TranscriptionBackendType>
public typealias NotesConfig = BackendConfig<NotesBackendType>

```

### Core Architecture Module: `OpenOats/Sources/OatsCore/CalendarTitle.swift`
```
import Foundation

/// A calendar event as the title lookup sees it. The app reads these from EventKit, leaving out all-day, cancelled
/// and declined events.
public struct CalendarEvent: Sendable, Equatable {
    public var title: String
    public var start: Date
    public var end: Date
    /// Other attendees or a call link: a meeting, not a personal block such as "Focus" or "Lunch".
    public var withOthers: Bool

    public init(title: String, start: Date, end: Date, withOthers: Bool) {
        self.title = title
        self.start = start
        self.end = end
        self.withOthers = withOthers
    }

    /// The title of the meeting a recording was part of: the event with others it overlaps most, the shorter one on a
    /// tie (a meeting inside an all-hands block). The overlap must be at least a quarter of the shorter of the two,
    /// so a recording that started in the last minutes of the previous meeting isn't named after it. nil when none.
    public static func title(for recording: DateInterval, in events: [CalendarEvent]) -> String? {
        let candidates = events.compactMap { event -> (CalendarEvent, TimeInterval)? in
            let title = event.title.trimmingCharacters(in: .whitespacesAndNewlines)
            guard event.withOthers, !title.isEmpty, event.end > event.start else { return nil }
            let overlap = min(event.end, recording.end).timeIntervalSince(max(event.start, recording.start))
            let shorter = min(event.end.timeIntervalSince(event.start), recording.duration)
            guard overlap > 0, overlap >= shorter / 4 else { return nil }
            return (CalendarEvent(title: title, start: event.start, end: event.end, withOthers: true), overlap)
        }
        return candidates.min { a, b in
            if a.1 != b.1 { return a.1 > b.1 }
            let (la, lb) = (a.0.end.timeIntervalSince(a.0.start), b.0.end.timeIntervalSince(b.0.start))
            return la != lb ? la < lb : a.0.start < b.0.start
        }?.0.title
    }
}

```

### Core Architecture Module: `OpenOats/Sources/OatsCore/CallDetector.swift`
```
import Foundation

/// An app whose Calls OpenOats asks to record. Matched by the bundle ID of the process doing the audio, not by
/// whether the app is merely running: helpers (`<id>.helper`, `com.apple.WebKit.GPU`) count as their app.
public struct CallApp: Sendable, Hashable, Identifiable {
    public let id: String
    public let name: String
    let bundleIDs: [String]

    init(_ name: String, _ bundleIDs: String...) {
        self.id = bundleIDs[0]
        self.name = name
        self.bundleIDs = bundleIDs
    }

    /// Native call apps and browsers (a Meet, Teams or Zoom tab). Dictation and AI voice apps are left out on purpose:
    /// an allowlist of who holds the mic replaces 1.x's ever-growing list of apps to ignore.
    public static let known: [CallApp] = [
        CallApp("Zoom", "us.zoom.xos"),
        CallApp("Microsoft Teams", "com.microsoft.teams2", "com.microsoft.teams"),
        CallApp("FaceTime", "com.apple.FaceTime", "com.apple.avconferenced"),
        CallApp("Webex", "Cisco-Systems.Spark", "com.cisco.webexmeetingsapp", "com.webex.meetingmanager"),
        CallApp("Slack", "com.tinyspeck.slackmacgap"),
        CallApp("Discord", "com.hnc.Discord"),
        CallApp("WhatsApp", "net.whatsapp.WhatsApp", "desktop.WhatsApp"),
        CallApp("Signal", "org.whispersystems.signal-desktop"),
        CallApp("Telegram", "ru.keepcoder.Telegram", "org.telegram.desktop", "com.tdesktop.Telegram"),
        CallApp("Skype", "com.skype.skype"),
        CallApp("Tuple", "app.tuple.app"),
        CallApp("Around", "co.around.Around"),
        CallApp("OpenPhone", "ca.illusive.openphone"),
        CallApp("kMeet", "com.infomaniak.meet"),
        CallApp("Google Chrome", "com.google.Chrome"),
        CallApp("Arc", "company.thebrowser.Browser"),
        CallApp("Dia", "company.thebrowser.dia"),
        CallApp("Brave", "com.brave.Browser"),
        CallApp("Microsoft Edge", "com.microsoft.edgemac"),
        CallApp("Firefox", "org.mozilla.firefox", "org.mozilla.plugincontainer"),
        CallApp("Vivaldi", "com.vivaldi.Vivaldi"),
        CallApp("Opera", "com.operasoftware.Opera"),
        CallApp("Chromium", "org.chromium.Chromium"),
        CallApp("Safari", "com.apple.Safari", "com.apple.WebKit"),
    ]

    /// The Call app a process belongs to: its bundle ID, or a dotted child of it, ignoring case.
    public static func of(_ bundleID: String) -> CallApp? {
        let id = bundleID.lowercased()
        return known.first { app in
            app.bundleIDs.contains { let known = $0.lowercased(); return id == known || id.hasPrefix(known + ".") }
        }
    }

    public static func named(_ id: String) -> CallApp? { known.first { $0.id == id } }
}

/// One process using audio right now, as Core Audio reports it.
public struct AudioClient: Sendable, Equatable {
    public var bundleID: String
    public var input: Bool
    public var output: Bool

    public init(bundleID: String, input: Bool, output: Bool) {
        self.bundleID = bundleID
        self.input = input
        self.output = output
    }
}

public enum CallEvent: Sendable, Equatable {
    case started(CallApp)
    case ended(CallApp)
}

/// Turns snapshots of the audio clients into Call started/ended events.
///
/// A Call starts when one Call app records from the mic for `confirmAfter` seconds while it also plays audio or a
/// camera is on: a voice note, a dictation into a web page, or a video playing in a browser next to a dictation app
/// is not a Call. The camera only backs up an app that already holds the mic (macOS can't say who has the camera),
/// so a camera alone never prompts. It ends when that app has left the mic alone for `endAfter` seconds, so a device switch or a breakout
/// room doesn't split one Call into two.
public struct CallDetector: Sendable {
    public var confirmAfter: TimeInterval = 5
    public var endAfter: TimeInterval = 20
    private var candidates: [CallApp: Date] = [:]
    private var calls: [CallApp: Date] = [:] // → last time the app held the mic

    public init() {}

    /// True while a Call is in progress or about to be confirmed, so the caller keeps sampling.
    public var isTracking: Bool { !candidates.isEmpty || !calls.isEmpty }
    public var current: [CallApp] { calls.keys.sorted { $0.id < $1.id } }

    public mutating func update(_ clients: [AudioClient], cameraOn: Bool = false, at now: Date) -> [CallEvent] {
        var input = Set<CallApp>(), output = Set<CallApp>()
        for client in clients {
            guard let app = CallApp.of(client.bundleID) else { continue }
            if client.input { input.insert(app) }
            if client.output { output.insert(app) }
        }
        var events: [CallEvent] = []
        for (app, lastInput) in calls {
            if input.contains(app) { calls[app] = now } else if now.timeIntervalSince(lastInput) >= endAfter {
                calls[app] = nil
                events.append(.ended(app))
            }
        }
        let onACall = cameraOn ? input : input.intersection(output)
        for app in Array(candidates.keys) where !onACall.contains(app) { candidates[app] = nil }
        for app in onACall where calls[app] == nil {
            let since = candidates[app] ?? now
            if now.timeIntervalSince(since) >= confirmAfter {
                candidates[app] = nil
                calls[app] = now
                events.append(.started(app))
            } else {
                candidates[app] = since
            }
        }
        // Endings first, then starts, each by app, so a tick's events read the same every time.
        return events.sorted { a, b in
            switch (a, b) {
            case let (.ended(x), .ended(y)), let (.started(x), .started(y)): x.id < y.id
            case (.ended, .started): true
            case (.started, .ended): false
            }
        }
    }
}

```

### Core Architecture Module: `OpenOats/Sources/OatsCore/Cloud.swift`
```
import AVFoundation

/// Errors from cloud Transcription backends. Messages never include audio or transcript content.
public enum CloudError: LocalizedError, Equatable {
    case invalidKey(backend: String)
    case http(backend: String, status: Int, message: String?)
    case badResponse(backend: String)
    case badAddress(String)
    case failed(backend: String, message: String)

    public var errorDescription: String? {
        switch self {
        case .invalidKey(let backend): "\(backend) rejected the API key. Check Settings > AI."
        case .http(let backend, let status, let message): "\(backend) request failed (HTTP \(status))" + (message.map { ": \($0)" } ?? ".")
        case .badResponse(let backend): "\(backend) returned a response OpenOats couldn't read."
        case .badAddress(let address): "\"\(address)\" isn't an http(s) address."
        case .failed(let backend, let message): "\(backend) couldn't transcribe the audio: \(message)"
        }
    }
}

/// Sends requests for a cloud backend, retrying 429, 5xx and dropped connections with exponential backoff.
public struct CloudClient: Sendable {
    public var backend: String
    public var session: URLSession
    public var attempts = 5
    public var sleep: @Sendable (Duration) async throws -> Void = { try await Task.sleep(for: $0) }

    public init(backend: String, session: URLSession = URLSession(configuration: .ephemeral)) {
        self.backend = backend
        self.session = session
    }

    public func send(_ request: URLRequest) async throws -> Data {
        var delay = Duration.seconds(1)
        for attempt in 1... {
            let last = attempt >= attempts
            do {
                let (data, response) = try await session.data(for: request)
                let status = (response as? HTTPURLResponse)?.statusCode ?? 0
                if (200..<300).contains(status) { return data }
                if status == 401 || status == 403 { throw CloudError.invalidKey(backend: backend) }
                guard status == 429 || status >= 500, !last else {
                    throw CloudError.http(backend: backend, status: status, message: Self.message(in: data))
                }
                if let after = (response as? HTTPURLResponse)?.value(forHTTPHeaderField: "Retry-After").flatMap(Double.init) {
                    delay = .seconds(min(after, 60))
                }
            } catch let error as URLError where !last && Self.retriedNetworkErrors.contains(error.code) {}
            try await sleep(delay)
            delay *= 2
        }
        fatalError("unreachable")
    }

    /// Dropped or not-yet-available connections. The offline ones matter after sleep: a Meeting stopped by the lid
    /// closing is processed as the Mac wakes, often before Wi-Fi has rejoined, and the backoff (~15 s) covers that.
    static let retriedNetworkErrors: Set<URLError.Code> = [
        .timedOut, .networkConnectionLost, .cannotConnectToHost,
        .notConnectedToInternet, .dnsLookupFailed, .cannotFindHost,
    ]

    /// The API's own error message (`error.message`, `detail` or `message`), which describes the request, not the audio.
    static func message(in data: Data) -> String? {
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        let error = json["error"] as? [String: Any]
        let text = error?["message"] as? String ?? json["error"] as? String ?? json["detail"] as? String ?? json["message"] as? String
        return text.map { String($0.prefix(200)) }
    }
}

/// A `multipart/form-data` request body.
public struct Multipart {
    public let boundary = "oats-\(UUID().uuidString)"
    public private(set) var body = Data()
    public var contentType: String { "multipart/form-data; boundary=\(boundary)" }

    public init() {}

    public mutating func add(_ name: String, _ value: String) {
        body.append(Data("--\(boundary)\r\nContent-Disposition: form-data; name=\"\(name)\"\r\n\r\n\(value)\r\n".utf8))
    }

    public mutating func add(_ name: String, file: Data, filename: String, type: String) {
        body.append(Data("--\(boundary)\r\nContent-Disposition: form-data; name=\"\(name)\"; filename=\"\(filename)\"\r\nContent-Type: \(type)\r\n\r\n".utf8))
        body.append(file)
        body.append(Data("\r\n".utf8))
    }

    public func finished() -> Data { body + Data("--\(boundary)--\r\n".utf8) }
}

/// One compressed piece of a track for upload; `offset` is its start in seconds from the track start.
public struct AudioChunk: Sendable {
    public var url: URL
    public var offset: TimeInterval
}

extension TrackAudio {
    /// Writes the track as `.m4a` chunks of at most `maxSeconds` (AAC 32 kbps ≈ 14 MB/hour) into `directory`.
    /// Each cut lands on the quietest 10 ms in the chunk's last 5 s (or last tenth for short chunks) so words aren't split.
    public static func compressedChunks(of url: URL, maxSeconds: TimeInterval, in directory: URL) throws -> [AudioChunk] {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let limit = Int(maxSeconds * sampleRate)
        let window = min(Int(5 * sampleRate), limit / 10)
        var chunks: [AudioChunk] = []
        var file: AVAudioFile?
        var written = 0, consumed = 0
        var pending: [Float] = []

        func write(_ count: Int) throws {
            guard count > 0 else { return }
            if file == nil {
                let chunk = AudioChunk(url: directory.appendingPathComponent("chunk-\(chunks.count).m4a"), offset: Double(consumed) / sampleRate)
                chunks.append(chunk)
                file = try AVAudioFile(forWriting: chunk.url, settings: [
                    AVFormatIDKey: kAudioFormatMPEG4AAC, AVSampleRateKey: sampleRate, AVNumberOfChannelsKey: 1, AVEncoderBitRateKey: 32_000,
                ], commonFormat: .pcmFormatFloat32, interleaved: false)
            }
            let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(count))!
            buffer.frameLength = AVAudioFrameCount(count)
            pending.withUnsafeBufferPointer { buffer.floatChannelData![0].update(from: $0.baseAddress!, count: count) }
            try file!.write(from: buffer)
            pending.removeFirst(count)
            written += count
            consumed += count
        }

        try forEachChunk(of: url) { buffer in
            pending.append(contentsOf: UnsafeBufferPointer(start: buffer.floatChannelData![0], count: Int(buffer.frameLength)))
            while written + pending.count > limit {
                try write(quietestCut(pending, from: limit - written - window, to: limit - written))
                file = nil
                written = 0
            }
            try write(max(0, min(pending.count, limit - window - written)))
        }
        try write(pending.count)
        return chunks
    }

    static func quietestCut(_ samples: [Float], from start: Int, to end: Int) -> Int {
        let frame = 160
        var best = end, bestEnergy = Float.infinity
        for i in stride(from: max(start, 0), through: end - frame, by: frame) {
            var energy: Float = 0
            for j in i..<i + frame { energy += samples[j] * samples[j] }
            if energy < bestEnergy { bestEnergy = energy; best = i + frame / 2 }
        }
        return max(best, 1)
    }
}

```

### Core Architecture Module: `OpenOats/Sources/OatsCore/ElevenLabsTranscription.swift`
```
import Foundation

/// The ElevenLabs Scribe Transcription backend. Uploads the track as m4a and groups the returned words into sentences.
/// A single mixed-file import is diarized, so its speakers come from Scribe.
public struct ElevenLabsTranscription: TranscriptionBackend {
    public static let defaultAddress = "https://api.elevenlabs.io/v1"
    public var address: String
    public var model: String
    public var apiKey: String?
    public var client: CloudClient
    /// Scribe takes files of several hours; one chunk keeps speaker labels consistent across a mixed import.
    public var chunkSeconds: TimeInterval = 3 * 3600

    public var name: String { "elevenlabs:\(model)" }
    public var separatesSpeakers: Bool { true }

    public init(address: String? = nil, model: String? = nil, apiKey: String?, session: URLSession = URLSession(configuration: .ephemeral)) {
        self.address = address ?? Self.defaultAddress
        self.model = model ?? "scribe_v2"
        self.apiKey = apiKey?.isEmpty == false ? apiKey : nil
        client = CloudClient(backend: "ElevenLabs", session: session)
    }

    public init(_ setup: BackendSetup<TranscriptionBackendType>) {
        self.init(address: setup.address, model: setup.model, apiKey: setup.apiKey)
    }

    public func transcribe(_ audio: URL, language: String?) async throws -> [TimedSegment] {
        guard let url = URL(string: address), url.scheme?.hasPrefix("http") == true else { throw CloudError.badAddress(address) }
        guard let apiKey else { throw CloudError.invalidKey(backend: client.backend) }
        let diarize = audio.deletingPathExtension().lastPathComponent == Track.mixed.rawValue
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("oats-upload-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: directory) }
        var segments: [TimedSegment] = []
        for chunk in try TrackAudio.compressedChunks(of: audio, maxSeconds: chunkSeconds, in: directory) {
            var form = Multipart()
            form.add("model_id", model)
            if let language = language?.split(separator: "-").first { form.add("language_code", String(language)) }
            if diarize { form.add("diarize", "true") }
            form.add("file", file: try Data(contentsOf: chunk.url), filename: "audio.m4a", type: "audio/mp4")

            var request = URLRequest(url: url.appendingPathComponent("speech-to-text"), timeoutInterval: 900)
            request.httpMethod = "POST"
            request.setValue(form.contentType, forHTTPHeaderField: "Content-Type")
            request.setValue(apiKey, forHTTPHeaderField: "xi-api-key")
            request.httpBody = form.finished()

            let data = try await client.send(request)
            guard let response = try? JSONDecoder().decode(Response.self, from: data) else { throw CloudError.badResponse(backend: client.backend) }
            let words = response.words.filter { $0.type == "word" }.map {
                Word(text: $0.text, start: chunk.offset + $0.start, end: chunk.offset + $0.end,
                     speaker: $0.speaker_id.map { "Speaker \((Int($0.split(separator: "_").last ?? "") ?? 0) + 1)" })
            }
            segments += Word.sentences(words)
        }
        return segments
    }

    private struct Response: Decodable {
        struct Word: Decodable { var text: String, start: Double, end: Double, type: String, speaker_id: String? }
        var words: [Word]
    }
}

/// A timed word from a cloud backend, seconds from the track start.
struct Word {
    var text: String
    var start: TimeInterval
    var end: TimeInterval
    var speaker: String?

    /// Groups words into sentence segments, breaking on sentence-ending punctuation, a pause over 1 s or a speaker change.
    static func sentences(_ words: [Word]) -> [TimedSegment] {
        var segments: [TimedSegment] = []
        var open = false
        for word in words {
            let text = word.text.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !text.isEmpty else { continue }
            let punctuation = text.unicodeScalars.allSatisfy(CharacterSet.punctuationCharacters.contains)
            if open, let last = segments.last, punctuation || (last.speaker == word.speaker && word.start - last.end <= 1) {
                segments[segments.count - 1].text += punctuation ? text : " " + text
                segments[segments.count - 1].end = max(last.end, word.end)
            } else {
                segments.append(TimedSegment(start: word.start, end: word.end, text: text, speaker: word.speaker))
            }
            open = !".?!。？！".contains(text.last!)
        }
        return segments
    }
}

```

### Core Architecture Module: `OpenOats/Sources/OatsCore/GeminiNotes.swift`
```
import Foundation

/// The Gemini Notes backend: `POST …/models/<model>:generateContent` with the notes prompt as the system instruction.
public struct GeminiNotes: NotesBackend {
    public var address: String
    public var model: String
    public var apiKey: String?
    public var contextTokens: Int
    public var client: CloudClient

    public var name: String { "gemini:\(model)" }

    public init(_ setup: BackendSetup<NotesBackendType>, session: URLSession = URLSession(configuration: .ephemeral)) {
        address = setup.address ?? GeminiTranscription.defaultAddress
        model = setup.model ?? "gemini-3-flash-preview"
        apiKey = setup.apiKey?.isEmpty == false ? setup.apiKey : nil
        contextTokens = setup.contextTokens
        client = CloudClient(backend: "Gemini", session: session)
    }

    public func complete(system: String, user: String) async throws -> String {
        var base = address.trimmingCharacters(in: .whitespaces)
        while base.hasSuffix("/") { base.removeLast() }
        guard let url = URL(string: base), url.scheme?.hasPrefix("http") == true, url.host() != nil else { throw CloudError.badAddress(address) }
        guard let apiKey else { throw CloudError.invalidKey(backend: client.backend) }
        let body: [String: Any] = [
            "systemInstruction": ["parts": [["text": system]]],
            "contents": [["role": "user", "parts": [["text": user]]]],
        ]
        var request = URLRequest(url: url.appendingPathComponent("models/\(model):generateContent"), timeoutInterval: 600)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(apiKey, forHTTPHeaderField: "x-goog-api-key")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let data = try await client.send(request)
        let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        guard let candidate = (json?["candidates"] as? [[String: Any]])?.first,
              let parts = (candidate["content"] as? [String: Any])?["parts"] as? [[String: Any]]
        else { throw CloudError.badResponse(backend: client.backend) } // e.g. a blocked prompt
        let text = parts.compactMap { $0["thought"] as? Bool == true ? nil : $0["text"] as? String }.joined()
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { throw NotesError.empty }
        return text
    }
}

```

### Core Architecture Module: `OpenOats/Sources/OatsCore/GeminiTranscription.swift`
```
import Foundation

/// The Gemini Transcription backend: `generateContent` with each m4a chunk inline, asking for JSON timed sentences.
/// Short chunks keep each reply well under the output-token limit and the 20 MB inline-request cap.
public struct GeminiTranscription: TranscriptionBackend {
    public static let defaultAddress = "https://generativelanguage.googleapis.com/v1beta"
    public var address: String
    public var model: String
    public var apiKey: String?
    public var client: CloudClient
    public var chunkSeconds: TimeInterval = 10 * 60

    public var name: String { "gemini:\(model)" }

    public init(address: String? = nil, model: String? = nil, apiKey: String?, session: URLSession = URLSession(configuration: .ephemeral)) {
        self.address = address ?? Self.defaultAddress
        self.model = model ?? "gemini-3-flash-preview"
        self.apiKey = apiKey?.isEmpty == false ? apiKey : nil
        client = CloudClient(backend: "Gemini", session: session)
    }

    public init(_ setup: BackendSetup<TranscriptionBackendType>) {
        self.init(address: setup.address, model: setup.model, apiKey: setup.apiKey)
    }

    public func transcribe(_ audio: URL, language: String?) async throws -> [TimedSegment] {
        guard let url = URL(string: address), url.scheme?.hasPrefix("http") == true else { throw CloudError.badAddress(address) }
        guard let apiKey else { throw CloudError.invalidKey(backend: client.backend) }
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("oats-upload-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: directory) }
        let prompt = "Transcribe this audio verbatim\(language.map { " (language: \($0))" } ?? ""). Return one JSON item per sentence, "
            + "with start and end as MM:SS.s timestamps from the start of the audio. Return [] if nobody speaks."
        let text = ["type": "STRING"]
        let schema: [String: Any] = ["type": "ARRAY", "items": ["type": "OBJECT", "properties": ["start": text, "end": text, "text": text],
                                                                  "required": ["start", "end", "text"]]]
        var segments: [TimedSegment] = []
        for chunk in try TrackAudio.compressedChunks(of: audio, maxSeconds: chunkSeconds, in: directory) {
            let body: [String: Any] = [
                "contents": [["parts": [["text": prompt], ["inline_data": ["mime_type": "audio/mp4", "data": try Data(contentsOf: chunk.url).base64EncodedString()]]]]],
                "generationConfig": ["temperature": 0, "responseMimeType": "application/json", "responseSchema": schema],
            ]
            var request = URLRequest(url: url.appendingPathComponent("models/\(model):generateContent"), timeoutInterval: 600)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue(apiKey, forHTTPHeaderField: "x-goog-api-key")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)

            let data = try await client.send(request)
            guard let reply = try? JSONDecoder().decode(Reply.self, from: data),
                  let json = reply.candidates.first?.content?.parts.compactMap(\.text).joined(),
                  let items = try? JSONDecoder().decode([Reply.Item].self, from: Data(json.utf8))
            else { throw CloudError.badResponse(backend: client.backend) }
            let duration = TrackAudio.duration(of: chunk.url)
            for item in items {
                let text = item.text.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !text.isEmpty else { continue }
                let start = min(Self.seconds(item.start), duration)
                segments.append(TimedSegment(start: chunk.offset + start, end: chunk.offset + min(max(Self.seconds(item.end), start), duration), text: text))
            }
        }
        return segments
    }

    /// `HH:MM:SS.s`, `MM:SS.s` or plain seconds.
    static func seconds(_ timestamp: String) -> TimeInterval {
        timestamp.split(separator: ":").reduce(0) { $0 * 60 + (Double($1.trimmingCharacters(in: .whitespaces)) ?? 0) }
    }

    private struct Reply: Decodable {
        struct Candidate: Decodable { var content: Content? }
        struct Content: Decodable { var parts: [Part] }
        struct Part: Decodable { var text: String? }
        struct Item: Decodable { var start: String, end: String, text: String }
        var candidates: [Candidate]
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #786** (2026-11-24): **Rebuild a mic the headset rebound; don't blame mics for route changes; pad tracks at Stop**
  *Symptoms*: A trimmed version of #783 by @dandaka, follow-up to #781/#782. Credit for the diagnosis and the design goes to them; this keeps their fix and drops the riskiest part.  ## Problem  When a Bluetooth headset changes profile (e.g. a call ends), AVFAudio can move a running engine's input to another device without posting `AVAudioEngineConfigurationChange`. The engine keeps running and delivers nothing. The watchdog then marks every mic that went silent as stalled, so after two route changes it can fall back to a mic that never delivers. On Stop, the mic track ends early.  ## Kept from #783  - **Watchdog detects a rebound mic:** a mic that's been silent for 1 s and is no longer bound the way its tap was made (another device, or a different usable rate or channel count) is rebuilt right away as a route change. Rebuilds are debounced and capped at one every 2 s. - **No blame for route changes:** a mic that goes silent soon after a route change isn't added to `stalledMics`. - **Recorder pads stopped tracks at Stop** so both tracks end together. Tracks that never delivered stay empty. - The `MicRebuildTests` and `RecorderTests` from #783.  ## Changed from #783  - **Dropped the input-unit property listener** (`AudioUnitAddPropertyListener` with an unmanaged context). It only made the rebuild about 2 s faster than the watchdog, and it was the riskiest code in the capture path. The watchdog's 2 s tick now catches the rebind, so the gap is about 1.5–3.5 s instead of 4–7 s. - **Padding is w

- **Issue #785** (2026-11-22): **Name Meetings after their calendar event (optional)**
  *Symptoms*: ## Summary  Meetings can be named after the calendar event they happened in. Off unless the user turns it on.  ```diff  AppModel.stop() / recorder stopped / recoverInterruptedMeetings +  nameFromCalendar(folder)        # only if titleFromCalendar == true and access is .fullAccess +    CalendarTitles.title(for: startedAt...endedAt)   # EventKit, fresh store, main app only +      CalendarEvent.title(for:in:)                   # OatsCore, pure +    status.title = event title    # wins over the Notes title, like Rename    enqueue(folder) ```  Matching (lessons from 1.x #701, #706): - only events with other attendees or a call link; all-day, cancelled, declined skipped - most overlap with the whole recording wins, shorter event on a tie - overlap ≥ ¼ of the shorter of event and recording, so the tail of the previous meeting doesn't name it  Asking (lessons from 1.x #517, #671, #711): access is requested only when the user turns it on, never from a view appearing or a timer; status re-read on every use.  ```diff  Settings › General +  Calendar: "Name Meetings after calendar events" toggle (+ Open System Settings when denied)  Onboarding +  4. Calendar (optional) [Allow]  Meeting detail (finished Meeting) +  📅 Name Meetings after your calendar events?  Turn On · Not Now   # until answered once ```  `Info.plist` gains `NSCalendarsFullAccessUsageDescription`; entitlements gain `com.apple.security.personal-information.calendars`. ADR 0006.  ## Evidence  - `CalendarTitleTests` (9): mee
  **Post-Mortem & Fix Analysis**:
  > risk:high because it adds the calendars entitlement and a new permission. Merge and release approved directly by @yazinsai (operator instruction).

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

### Incident Patch 1: `d8caac78` (2026-11-24)
**Commit Message**: Rebuild a mic the headset rebound; don't blame mics for route changes; pad tracks at Stop (#786)

Trimmed from #783 by @dandaka: the watchdog detects the rebind instead of an input-unit property listener, and Stop pads silence 10 s at a time.

Co-authored-by: Vlad Rafeev <[REDACTED_EMAIL]>

**File**: `OpenOats/Sources/OatsCapture/LiveCapture.swift` (modified, +37/-6)
```diff
@@ -20,6 +20,9 @@ public final class LiveCapture: CaptureSource, @unchecked Sendable {
     private var watchdog: DispatchSourceTimer?
     /// Mics that went silent since the last default-input change; skipped when picking the next one.
     private var stalledMics: Set<AudioDeviceID> = []
+    /// Last default-device change or mic hardware format change, on the `Activity` clock.
+    private var routeChangedAt = -TimeInterval.infinity
+    private var micRebuiltAt = -TimeInterval.infinity
     private var lastProblem: [Track: String] = [:]
     private var assertion: IOPMAssertionID = 0
 
@@ -47,12 +50,12 @@ public final class LiveCapture: CaptureSource, @unchecked Sendable {
             }
             IOPMAssertionCreateWithName(kIOPMAssertionTypePreventUserIdleSystemSleep as CFString, IOPMAssertionLevel(kIOPMAssertionLevelOn),
                                         "OpenOats is recording a meeting" as CFString, &assertion)
-            listen(kAudioHardwarePropertyDefaultInputDevice) { $0.rebuild(.mic, deviceChanged: true) }
+            listen(kAudioHardwarePropertyDefaultInputDevice) { $0.routeChanged(rebuildMic: true) }
             // The tap is bound to the output device's UID. Output changes (Bluetooth A2DP ↔ HFP) can also silence the
             // mic; rebuilding it here would cost ~0.5 s of speech each time, so the watchdog handles that, with every mic
             // eligible again.
             listen(kAudioHardwarePropertyDefaultOutputDevice) {
-                $0.stalledMics = []
+                $0.routeChanged(rebuildMic: false)
                 $0.rebuild(.system, deviceChanged: true)
             }
             let timer = DispatchSource.makeTimerSource(queue: queue)
@@ -91,13 +94,33 @@ public final class LiveCapture: CaptureSource, @unchecked Sendable {
         }
     }
 
+    /// A default device or the mic's hardware format changed: every mic is eligible again, and silence that follows
+    /// isn't held against the mic.
+    private func routeChanged(rebuildMic: Bool) {
+        let now = ProcessInfo.processInfo.systemUptime
+        routeChangedAt = now
+        stalledMics = []
+        if rebuildMic { rebuild(.mic, deviceChanged: true, after: Self.routeRebuildDelay(sinceLast: now - micRebuiltAt)) }
+    }
+
+    /// A burst of route changes causes one rebuild, and at most one every 2 s.
+    static func routeRebuildDelay(sinceLast: TimeInterval) -> TimeInterval {
+        max(0.5, 2 - sinceLast)
+    }
+
+    /// Whether a mic silent for `silentFor` seconds is to blame: not if a route changed shortly before it went silent.
+    static func blamesMic(silentFor: TimeInterval, sinceRouteChange: TimeInterval) -> Bool {
+        sinceRouteChange > silentFor + 2
+    }
+
     /// Rebuilds `track` after a short pause, so a burst of device notifications causes one rebuild.
-    private func rebuild(_ track: Track, deviceChanged: Bool) {
+    private func rebuild(_ track: Track, deviceChanged: Bool, after delay: TimeInterval? = nil) {
         if deviceChanged, track == .mic { stalledMics = [] }
         pending[track]?.cancel()
         let item = DispatchWorkItem { [weak self] in
             guard let self, let deliver else { return }
             pending[track] = nil
+            if track == .mic { micRebuiltAt = ProcessInfo.processInfo.systemUptime }
             do {
                 if track == .mic { try startMic() } else { try system.start(deliver) }
                 lastProblem[track] = nil
@@ -109,16 +132,24 @@ public final class LiveCapture: CaptureSource, @unchecked Sendable {
             }
         }
         pending[track] = item
-        queue.asyncAfter(deadline: .now() + (deviceChanged ? 0.5 : 0), execute: item)
+        queue.asyncAfter(deadline: .now() + (delay ?? (deviceChanged ? 0.5 : 0)), execute: item)
     }
 
     /// CoreAudio can announce a new default device before a Bluetooth device has finished connecting, or a mic can go
     /// silent after an HFP switch, with no further notification. Rebuild whatever stopped delivering. The tap only
     /// delivers while the output device runs, so an idle one isn't stalled; nor is one that never delivered (the
     /// system-audio permission prompt may be up, and Core Audio blocks teardown until it is answered).
     private func checkStalls() {
-        if mic.activity.age >= Self.stallAfter, pending[.mic] == nil {
-            stalledMics.insert(mic.device)
+        let silent = mic.activity.age
+        // A Bluetooth headset profile switch can rebind the input unit with no notification, leaving the engine running
+        // and silent; a silent mic no longer bound the way its tap was made is rebuilt now, as a route change. A fresh
+        // engine reads its binding back, so it is never rebound.
+        if silent >= 1, pending[.mic] == nil, mic.isRebound {
+            routeChanged(rebuildMic: true)
+        } else if silent >= Self.stallAfter, pending[.mic] == nil {
+            if Self.blamesMic(silent
```

**File**: `OpenOats/Sources/OatsCapture/MicCapture.swift` (modified, +34/-0)
```diff
@@ -5,8 +5,16 @@ import OatsObjC
 
 /// The Mic track: an AVAudioEngine input tap on one device. Used on the LiveCapture queue only.
 final class MicCapture: @unchecked Sendable {
+    /// What a tap was made for: the input unit's device and the hardware format.
+    struct Binding: Equatable {
+        var device: AudioDeviceID
+        var rate: Double
+        var channels: AVAudioChannelCount
+    }
+
     private let queue: DispatchQueue
     private var engine: AVAudioEngine?
+    private var bound: Binding?
     /// AVAudioEngine teardown races AVAudioIOUnit callbacks during route changes (AirPods); keep recently
     /// stopped engines alive so AVFAudio's internal queues can drain.
     private var retired: [AVAudioEngine] = []
@@ -16,6 +24,29 @@ final class MicCapture: @unchecked Sendable {
 
     init(queue: DispatchQueue) { self.queue = queue }
 
+    /// True when the input unit moved to another device, or the hardware has a usable format other than the tap's. An
+    /// unknown device or unusable format (mid switch) is left to the restart and the watchdog.
+    static func rebound(_ tap: Binding, now: Binding) -> Bool {
+        (now.device != kAudioObjectUnknown && now.device != tap.device)
+            || (now.rate > 0 && now.channels > 0 && (now.rate != tap.rate || now.channels != tap.channels))
+    }
+
+    /// Whether the running engine is no longer bound the way its tap was made. Cheap; reads the unit and node.
+    var isRebound: Bool {
+        guard let engine, let bound, let unit = engine.inputNode.audioUnit else { return false }
+        let hardware = try? Self.guarded { engine.inputNode.inputFormat(forBus: 0) }
+        let now = Binding(device: Self.device(of: unit) ?? AudioDeviceID(kAudioObjectUnknown),
+                          rate: hardware?.sampleRate ?? 0, channels: hardware?.channelCount ?? 0)
+        return Self.rebound(bound, now: now)
+    }
+
+    private static func device(of unit: AudioUnit) -> AudioDeviceID? {
+        var id = AudioDeviceID(kAudioObjectUnknown)
+        var size = UInt32(MemoryLayout<AudioDeviceID>.size)
+        let status = AudioUnitGetProperty(unit, kAudioOutputUnitProperty_CurrentDevice, kAudioUnitScope_Global, 0, &id, &size)
+        return status == noErr && id != kAudioObjectUnknown ? id : nil
+    }
+
     /// Builds a fresh engine on `device`, replacing any running one. On failure the engine is retired again.
     func start(device: AudioDeviceID, _ deliver: @escaping @Sendable (CapturedAudio) -> Void) throws {
         stop()
@@ -49,6 +80,8 @@ final class MicCapture: @unchecked Sendable {
         let channels = usable ? hardware.channelCount : output.channelCount
         guard rate > 0, channels > 0, let tapFormat = AVAudioFormat(standardFormatWithSampleRate: rate, channels: channels)
         else { throw CaptureError.micFailed("no usable input format") }
+        // Read back, so a fresh engine is never rebound by construction.
+        bound = Binding(device: Self.device(of: unit) ?? device, rate: rate, channels: channels)
         let resampler = Resampler(.mic, deliver)
         let activity = activity
         try Self.guarded {
@@ -72,6 +105,7 @@ final class MicCapture: @unchecked Sendable {
     func stop() {
         if let observer { NotificationCenter.default.removeObserver(observer) }
         observer = nil
+        bound = nil
         guard let engine else { return }
         _ = OatsCatchException { engine.inputNode.removeTap(onBus: 0) }
         _ = OatsCatchException { engine.stop() }
```

**File**: `OpenOats/Sources/OatsCore/Recorder.swift` (modified, +21/-1)
```diff
@@ -142,10 +142,30 @@ public final class Recorder: @unchecked Sendable {
     @discardableResult
     public func stop() throws -> MeetingFolder {
         source.stop()
-        try queue.sync { try finish() }
+        try queue.sync {
+            guard !finished else { return }
+            try padStoppedTracks()
+            try finish()
+        }
         return folder
     }
 
+    /// A track that stopped delivering before Stop (a mic gone silent) ends with silence, like a gap, so the tracks end
+    /// together. One that never delivered stays empty. Written 10 s at a time, so a long silence stays small in memory.
+    private func padStoppedTracks() throws {
+        try write()
+        let end = Int(((clock() - startTime) * TrackAudio.sampleRate).rounded())
+        let chunk = 10 * Int(TrackAudio.sampleRate), zeros = Data(count: 2 * chunk)
+        for (track, var writer) in writers where writer.written > 0 && writer.written < end {
+            while writer.written < end {
+                let count = min(chunk, end - writer.written)
+                try writer.handle.write(contentsOf: zeros.prefix(2 * count))
+                writer.written += count
+            }
+            writers[track] = writer
+        }
+    }
+
     private func append(_ chunk: CapturedAudio) {
         guard !finished, var writer = writers[chunk.track] else { return }
         let offset = Int(((chunk.hostTime - startTime) * TrackAudio.sampleRate).rounded())
```

**File**: `OpenOats/Tests/OatsCaptureTests/MicRebuildTests.swift` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+import CoreAudio
+@testable import OatsCapture
+import Testing
+
+private func bound(_ device: AudioDeviceID, _ rate: Double, _ channels: UInt32) -> MicCapture.Binding {
+    MicCapture.Binding(device: device, rate: rate, channels: channels)
+}
+
+@Test func aNewHardwareFormatRebuildsTheMic() {
+    // Bluetooth headset profile switch: AVFAudio rebinds the input to a 1 ch 44.1 kHz device under a 48 kHz tap.
+    #expect(MicCapture.rebound(bound(125, 48_000, 2), now: bound(167, 44_100, 1)))
+    #expect(MicCapture.rebound(bound(125, 48_000, 1), now: bound(125, 44_100, 1)))
+    #expect(MicCapture.rebound(bound(125, 48_000, 2), now: bound(125, 48_000, 1)))
+    // Engine 1 right after start: 3 ch 44.1 kHz → 3 ch 48 kHz.
+    #expect(MicCapture.rebound(bound(101, 44_100, 3), now: bound(101, 48_000, 3)))
+}
+
+@Test func anotherDeviceRebuildsTheMicEvenAtTheSameFormat() {
+    #expect(MicCapture.rebound(bound(125, 48_000, 1), now: bound(167, 48_000, 1)))
+}
+
+@Test func aFreshEngineIsNotRebound() {
+    // The change a fresh engine posts just after starting reports the binding its tap was made at.
+    #expect(!MicCapture.rebound(bound(125, 48_000, 1), now: bound(125, 48_000, 1)))
+}
+
+@Test func anUnknownDeviceOrUnusableFormatIsLeftToTheWatchdog() {
+    let unknown = AudioDeviceID(kAudioObjectUnknown)
+    #expect(!MicCapture.rebound(bound(125, 48_000, 1), now: bound(unknown, 0, 0)))
+    #expect(!MicCapture.rebound(bound(125, 48_000, 1), now: bound(125, 0, 1)))
+    #expect(!MicCapture.rebound(bound(125, 48_000, 1), now: bound(125, 44_100, 0)))
+}
+
+@Test func routeRebuildsAreDebouncedAndAtMostOneEvery2Seconds() {
+    #expect(LiveCapture.routeRebuildDelay(sinceLast: .infinity) == 0.5)
+    #expect(LiveCapture.routeRebuildDelay(sinceLast: 10) == 0.5)
+    #expect(LiveCapture.routeRebuildDelay(sinceLast: 0.5) == 1.5)
+    #expect(LiveCapture.routeRebuildDelay(sinceLast: 0) == 2)
+}
+
+@Test func aMicSilentSinceARouteChangeIsNotBlamed() {
+    // Rebuilt 0.5 s after the change, silent ever since.
+    #expect(!LiveCapture.blamesMic(silentFor: 4, sinceRouteChange: 4.5))
+    #expect(!LiveCapture.blamesMic(silentFor: 5, sinceRouteChange: 6))
+}
+
+@Test func aMicThatDiesWithNoRouteChangeIsBlamed() {
+    #expect(LiveCapture.blamesMic(silentFor: 4, sinceRouteChange: .infinity))
+    // Worked for a while after the change, then went silent; or stayed silent through a second rebuild.
+    #expect(LiveCapture.blamesMic(silentFor: 4, sinceRouteChange: 30))
+    #expect(LiveCapture.blamesMic(silentFor: 4, sinceRouteChange: 8.5))
+}
```

**File**: `OpenOats/Tests/OatsCoreTests/RecorderTests.swift` (modified, +32/-0)
```diff
@@ -117,6 +117,38 @@ final class EventLog: @unchecked Sendable {
         #expect(mic[31_999] == 100 && mic[32_000] == 101 && mic[39_999] == 101 && mic[40_000] == 102)
     }
 
+    @Test func padsATrackThatStoppedDeliveringToTheEndOfTheRecording() throws {
+        let recorder = try start()
+        source.send(.system, 200, seconds: 2, at: 0)
+        // The mic goes silent after a second and delivers nothing more before Stop at 3 s.
+        source.send(.mic, 100, seconds: 1, at: 0)
+        source.now = 1003
+        let folder = try recorder.stop()
+
+        let mic = try samples(folder.micTrackURL), system = try samples(folder.systemTrackURL)
+        #expect(mic.count == 48_000 && system.count == 48_000)
+        #expect(mic[15_999] == 100 && mic[16_000] == 0 && mic[47_999] == 0)
+        #expect(system[31_999] == 200 && system[32_000] == 0)
+    }
+
+    @Test func padsALongSilenceInChunks() throws {
+        let recorder = try start()
+        source.send(.mic, 100, seconds: 1, at: 0)
+        source.now = 1025
+        let mic = try samples(try recorder.stop().micTrackURL)
+        #expect(mic.count == 400_000 && mic[15_999] == 100 && mic[16_000] == 0 && mic[399_999] == 0)
+    }
+
+    @Test func leavesATrackThatNeverDeliveredEmpty() throws {
+        let recorder = try start()
+        source.send(.mic, 100, seconds: 1, at: 0)
+        source.now = 1002
+        let folder = try recorder.stop()
+
+        #expect(try samples(folder.micTrackURL).count == 32_000)
+        #expect(try samples(folder.systemTrackURL).isEmpty)
+    }
+
     @Test func systemTrackStartsAtItsFirstAudioWhenNothingPlaysAtFirst() throws {
         let recorder = try start()
         // The process tap delivers nothing while the output device is idle; then a meeting app starts playing,
```

#### Recent Merged Pull Requests:
- **PR #786** (2026-11-24): Rebuild a mic the headset rebound; don't blame mics for route changes; pad tracks at Stop (@yazinsai)
- **PR #785** (2026-11-22): Name Meetings after their calendar event (optional) (@yazinsai)
- **PR #784** (2026-11-22): Notifications default to Persistent so the "Record this meeting?" prompt waits for a click (@yazinsai)
- **PR #783** (closed): Rebuild the mic at once when AVFAudio rebinds it during a Bluetooth route change (@dandaka)
- **PR #782** (2026-11-24): Mic tap uses the engine's input hardware format and survives AVFAudio exceptions (@dandaka)
- **PR #780** (2026-11-17): Stop the recording when the Mac sleeps; retry cloud calls while offline after wake (@yazinsai)

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

## X. Rebuild a mic the headset rebound; don't blame mics for route changes; pad track

**RULE**:
When implementing operations in `OpenOats/Sources/OatsCapture/LiveCapture.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in yazinsai/OpenOats. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d8caac78`: Rebuild a mic the headset rebound; don't blame mics for route changes; pad tracks at Stop. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `OpenOats/Sources/OatsCapture/LiveCapture.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
    /// Last default-device change or mic hardware format change, on the `Activity` clock.
    private var routeChangedAt = -TimeInterval.infinity
    private var micRebuiltAt = -TimeInterval.infinity
            listen(kAudioHardwarePropertyDefaultInputDevice) { $0.routeChanged(rebuildMic: true) }
                $0.routeChanged(rebuildMic: false)
    /// A default device or the mic's hardware format changed: every mic is eligible again, and silence that follows
    /// isn't held against the mic.
    private func routeChanged(rebuildMic: Bool) {
        let now = ProcessInfo.processInfo.systemUptime
        routeChangedAt = now
        stalledMics = []
        if rebuildMic { rebuild(.mic, deviceChanged: true, after: Self.routeRebuildDelay(sinceLast: now - micRebuiltAt)) }
    }

    /// A burst of route changes causes one rebuild, and at most one every 2 s.
    static func routeRebuildDelay(sinceLast: TimeInterval) -> TimeInterval {
        max(0.5, 2 - sinceLast)
    }

    /// Whether a mic silent for `silentFor` seconds is to blame: not if a route changed shortly before it went silent.
    static func blamesMic(silentFor: TimeInterval, sinceRouteChange: TimeInterval) -> Bool 
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
            listen(kAudioHardwarePropertyDefaultInputDevice) { $0.rebuild(.mic, deviceChanged: true) }
                $0.stalledMics = []
    private func rebuild(_ track: Track, deviceChanged: Bool) {
        queue.asyncAfter(deadline: .now() + (deviceChanged ? 0.5 : 0), execute: item)
        if mic.activity.age >= Self.stallAfter, pending[.mic] == nil {
            stalledMics.insert(mic.device)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d8caac78` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
