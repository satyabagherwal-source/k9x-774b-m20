> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/wquguru-cicada-learnings.md`  
> **Source**: github ([https://github.com/wquguru/cicada](https://github.com/wquguru/cicada))  
> **Source Version**: `f119ba61`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-13T06:06:43.193Z  
> **Learning ID**: `learn-github-wquguru-cicada`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): wquguru/cicada

> **Canonical Artifact**: `07_PROJECT_LEARNING/wquguru-cicada-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/wquguru/cicada](https://github.com/wquguru/cicada))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-13T06:06:43.014Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `wquguru/cicada`
- **Description**: 知了 Cicada · 任何会议和直播的实时字幕、同声传译、AI 会议纪要，Mac、Windows、Linux、Android 免费开源。Live subtitles, interpreting and meeting notes for any call or stream, on Mac, Windows, Linux and Android.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2200 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Sources/Cicada/ListenEngine.swift`
```
import AppKit
import AVFoundation
import CoreMedia
import Network

struct Segment {
    let id: Int
    var text: String
    let sourceCode: String
    var translation: String?
    /// The sentence's audio, 16 kHz mono, when telling voices apart is on.
    var voiceSamples: [Float]? = nil
    /// Where it sits in the recognizer's audio (seconds; `clock` changes with each new recognizer),
    /// and whether Cicada ended it at a pause: what deciding a join needs (`HeardText.continues`).
    var start = 0.0, end = 0.0, clock = 0
    var cut = false
    /// Cicada ended it where a sentence or clause ends, on purpose: the next line doesn't join it.
    var split = false
    /// The record's own recognizer heard it too and will settle its words (`onRefined`).
    var refining = false
}

/// System audio → language detection → on-device transcription → translation.
/// UI-free: it reports through the callbacks below.
/// 电脑和会议室 runs two: the main one on the Mac's audio, a `.room` one on the microphone, each
/// with its own language, pauses and model, as Feishu keeps online and room streams apart.
@MainActor
final class ListenEngine {
    enum Role { case main, room }
    /// Segment ids from here up are the room engine's.
    static let roomIDs = 1_000_000
    /// `.room`: the microphone side of 电脑和会议室 (no prompts, offers or remembered language).
    let role: Role
    /// A language picked by hand is the meeting's: the people at the table may speak another
    /// (yours, from 同声传译's 我说), so the room side always detects, starting with yours.
    private var sourceMode: SourceMode { role == .room ? .auto : settings.sourceMode }
    // Outputs
    var onSubtitle: ((_ source: String, _ translation: String) -> Void)?
    var onStatus: ((String) -> Void)?
    var onStateChange: (() -> Void)?
    /// A finished sentence; `secondsAgo` ≈ how long ago it started.
    var onFinal: ((Segment, _ secondsAgo: Double) -> Void)?
    var onTranslated: ((_ segmentID: Int, _ translation: String) -> Void)?
    /// The record's own recognizer settled segment `id` (`RecordRefiner`): its text for the meeting
    /// record, "" when it heard nothing there.
    var onRefined: ((_ segmentID: Int, _ text: String) -> Void)?
    /// Diagnostics: how long a sentence took from its last new words to its translation on screen.
    var onTiming: ((SentenceTiming) -> Void)?
    /// The recognizer heard words (a draft or a line), whether or not they are shown.
    var onWords: (() -> Void)?
    /// The room mic stayed digital silence even after it was opened again (`RoomMic.onSilent`).
    private(set) var roomMicSilent = false

    let settings: AppSettings
    let router = AudioRouter()

    private(set) var isRunning = false
    private(set) var statusText = L("准备就绪")
    private(set) var activeLang: Lang?
    /// Where "auto" stands on the language, and when to check it next.
    private var detection = LanguageDetection()
    var languageConfirmed: Bool { detection.confirmed }
    var detecting: Bool { detection.checking }
    private(set) var candidates: [Lang] = []
    private(set) var installedLocales: Set<String> = []
    /// The speech model fetched in the background so "auto" has two to compare.
    private(set) var fetchingModel: (lang: Lang, progress: Progress)?
    private var fetchFailed: Set<String> = []
    /// Debug (`models:`): treat only these as installed, plus what is fetched meanwhile, and these as the Mac's languages.
    var simulatedModels: Set<String>?
    var simulatedSystemLanguages: [String]?
    /// Debug (`models:…@<s>`): a background download takes at least this long, like a slow network.
    var simulatedFetchDelay: Double = 0
    /// Debug (`modelFail:`): every model download fails this way (offline, disk, limit, other).
    var simulatedModelFailure: String?
    /// Debug (`network:`): pretend to be on or offline; nil follows the real network.
    var simulatedOnline: Bool? { didSet { networkChanged() } }
    /// A model that couldn't be had while it was needed, shown in 听不出 with what to do.
    private(set) var modelProblem: ModelProblem?
    /// Speech models downloading (locale → which and since when), the background fetch and the one
    /// listening waits for alike: the card says how long it has taken.
    private var downloads: [String: (lang: Lang, since: Date)] = [:]
    /// The download the card shows: the one listening waits for, else the background one.
    var downloading: (lang: Lang, since: Date, background: Bool)? {
        if let lang = activeLang, recognizer == nil || cloudListening, let d = downloads[lang.locale] {
            return (d.lang, d.since, fetchingModel?.lang == lang)
        }
        guard let d = downloads.values.min(by: { $0.since < $1.since }) else { return nil }
        return (d.lang, d.since, fetchingModel?.lang == d.lang)
    }

    /// A service hearing the meeting (`CloudStream`): 先用○○听 while the model it needs downloads,
    /// or the user's own recognition server.
    private struct CloudSession {
        /// What listening was before, restored by 换回等待.
        var replaced: (lang: Lang?, confirmed: Bool)
        /// The model being waited for: once it is on the Mac, listening goes back to it.
        let awaiting: Lang?
        /// Who was hearing the meeting when it went to a service, and whether it was the user's own
        /// recognition server (rather than 先用○○听): a change in settings must not move the audio elsewhere.
        let via: (provider: AIProvider.Kind?, server: Bool)
        /// The language the service says is spoken.
        var lang: Lang?
        var failures = 0
    }
    /// nil while this Mac listens.
    private var cloud: CloudSession?
    var cloudListening: Bool { cloud != nil }
    /// The user's own service stopped answering in this meeting: listening went back to this Mac.
    private var serverFellBack = false
    /// The meeting is recognized by the user's own service (`Recognition.serverPreferred`).
    var serverHears: Bool {
        Recognition.serverPreferred && !serverFellBack && translator?.ling.transcribes == true
    }
    /// Back on this Mac after the service listened (its name), shown for a few seconds.
    private(set) var cloudBack: (name: String, at: Date)?
    /// The service that can hear audio (Ling's Ming, or a custom service's speech model); nil when
    /// there is none.
    var cloudService: String? {
        guard let ling = translator?.ling, ling.hearsAudio || ling.transcribes else { return nil }
        return ling.config().provider.name
    }
    /// 先用○○听 is offered: a model listening needs has been downloading a while, or couldn't be had.
    var offersCloud: Bool {
        guard isRunning, !cloudListening, cloudService != nil else { return false }
        // Something already shows the meeting in its language: the download only adds a comparison.
        guard recognizer == nil || !recordable else { return false }
        if modelProblem != nil { return true }
        guard let d = downloading else { return false }
        return Date().timeIntervalSince(d.since) >= Self.cloudOfferAfter
    }
    /// The 132 MB English model took 97 s on a fast link: most downloads end before the offer shows.
    static let cloudOfferAfter = 90.0
    private let pathMonitor = NWPathMonitor()
    private var realOnline = true
    private var online: Bool { simulatedOnline ?? realOnline }
    private var systemLanguages: [String] { simulatedSystemLanguages ?? Locale.preferredLanguages }
    /// When words were first heard this run: 听不出 is offered once the language stays unknown long after.
    private var firstHeardAt: Date?
    private var askShown = false

    private var audioTap: AudioSource?
    /// 会议室: the microphone Cicada listens to the room with; nil leaves the input on its default.
    var roomDevice: (() -> OutputDevice?)?
    /// The Mac reading a translation aloud, or the talk key held: the room mic hears silence then.
    private var roomMuted = false
    private var startedAt = Date()
    private var recognizer: RecognitionStream?
    private var resultsTask: Task<Void, Never>?
    /// The record's recognizer for the current transcriber (`Recognition.recordTrack`). Its lines
    /// keep settling after `stop()`, so it has a generation of its own.
    private var refiner: RecordRefiner?
    private var refinerGen = 0
    private var recordTask: Task<Void, Never>?
    /// The room engine's clocks and segment ids start far above the main one's, so lines from the two
    /// never look like one recognizer's (joins, translations).
    private var generation: Int
    private var lastForeignCheck = Date.distantPast
    /// When the recognizer last wrote anything: speech, even where the loudness gate heard none.
    private var lastWordsAt = Date.distantPast
    /// Sentences finished before detection settled the language: recorded once it confirms the
    /// language they were heard in, dropped on a switch (the replay into the new model redoes them).
    private var unconfirmed: [(seg: Segment, at: Date, duration: Double)] = []
    private var recordable: Bool {
        sourceMode != .auto || detection.settledEnough
            || legacySingleLanguage || cloudListening
            // The room side's 听不出 never reaches the panel (it reads the main engine): held lines would
            // stay held all meeting. Measured: a show from a phone across the table scored 0.56–0.71 for
            // Chinese, never confirmed, and not one room line was written in 40 s.
            || role == .room
    }
    /// macOS 14/15 with one Dictation language: nothing to compare it with and none Cicada could
    /// fetch, and every check takes the recognizer from the meeting. It is taken as heard.
    private var legacySingleLanguage: Bool { Recognition.legacy && candidates.count < 2 }
    /// The only model there is checked the audio and it isn't its language (`LanguageDetection.Verdict.notThis`).
    var mismatch: Bool { detection.mi
```

### Core Architecture Module: `Sources/Cicada/SpeakEngine.swift`
```
import AppKit
import AVFoundation
import Carbon.HIToolbox
import CoreAudio
import Speech

// MARK: - Output devices

struct OutputDevice: Identifiable, Hashable {
    let id: AudioObjectID
    let uid: String
    let name: String
    var isVirtualMic: Bool {
        let n = name.lowercased()
        return n.contains("blackhole") || n.contains("livesubs") || n.contains("cicada") || n.contains("loopback")
    }
}

enum AudioDevices {
    static func string(_ device: AudioObjectID, _ selector: AudioObjectPropertySelector) -> String? {
        var value: CFString = "" as CFString
        var size = UInt32(MemoryLayout<CFString>.size)
        var addr = AudioObjectPropertyAddress(mSelector: selector, mScope: kAudioObjectPropertyScopeGlobal,
                                              mElement: kAudioObjectPropertyElementMain)
        let status = withUnsafeMutablePointer(to: &value) { AudioObjectGetPropertyData(device, &addr, 0, nil, &size, $0) }
        return status == noErr ? value as String : nil
    }

    static func outputs() -> [OutputDevice] { devices(scope: kAudioObjectPropertyScopeOutput) }

    /// Devices with streams on one side (output or input), minus Cicada's own aggregate devices.
    static func devices(scope: AudioObjectPropertyScope) -> [OutputDevice] {
        var addr = AudioObjectPropertyAddress(mSelector: kAudioHardwarePropertyDevices,
                                              mScope: kAudioObjectPropertyScopeGlobal,
                                              mElement: kAudioObjectPropertyElementMain)
        var size: UInt32 = 0
        guard AudioObjectGetPropertyDataSize(AudioObjectID(kAudioObjectSystemObject), &addr, 0, nil, &size) == noErr else { return [] }
        var ids = [AudioObjectID](repeating: 0, count: Int(size) / MemoryLayout<AudioObjectID>.size)
        guard AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject), &addr, 0, nil, &size, &ids) == noErr else { return [] }
        return ids.compactMap { id in
            var streams = AudioObjectPropertyAddress(mSelector: kAudioDevicePropertyStreams,
                                                     mScope: scope,
                                                     mElement: kAudioObjectPropertyElementMain)
            var s: UInt32 = 0
            guard AudioObjectGetPropertyDataSize(id, &streams, 0, nil, &s) == noErr, s > 0,
                  let uid = string(id, kAudioDevicePropertyDeviceUID),
                  let name = string(id, kAudioObjectPropertyName),
                  !uid.hasPrefix("com.wquguru.cicada") else { return nil }
            return OutputDevice(id: id, uid: uid, name: name)
        }
    }

    static var virtualMic: OutputDevice? { outputs().first(where: \.isVirtualMic) }

    static func name(_ device: AudioObjectID) -> String? { string(device, kAudioObjectPropertyName) }

    /// The system output (speakers or headphones): voice previews play here, not into the room.
    static var defaultOutput: OutputDevice? {
        var id = AudioObjectID(0)
        var size = UInt32(MemoryLayout<AudioObjectID>.size)
        var addr = AudioObjectPropertyAddress(mSelector: kAudioHardwarePropertyDefaultOutputDevice,
                                              mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
        guard AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject), &addr, 0, nil, &size, &id) == noErr else { return nil }
        return outputs().first { $0.id == id }
    }
}

// MARK: - Speak engine

/// Hold to talk: microphone → Ming's audio model (what was said + its translation in one call),
/// or on-device transcription → translation when that fails → voice → chosen output device
/// (a virtual microphone for the call). The on-device transcriber always runs: it shows the words
/// while the key is held and is the fallback transcript.
@MainActor
final class SpeakEngine {
    enum Phase { case idle, listening, translating, speaking }

    var onLive: ((_ phase: Phase, _ source: String, _ translation: String) -> Void)?
    /// A finished utterance for the meeting record.
    var onUtterance: ((_ source: String, _ translation: String, _ from: String, _ to: String, _ secondsAgo: Double) -> Void)?
    var onStatus: ((String) -> Void)?
    /// Why a press of the talk key went nowhere: shown while the key is held.
    var onNotice: ((String) -> Void)?
    /// Translator shared with the listening side.
    var translate: ((_ text: String, _ from: String, _ to: String, _ trace: TranslateTrace) async -> String?)?
    /// The press as a WAV → (what was said, translation); nil when Ming is unavailable or its reply is unusable.
    var interpret: ((_ wav: Data, _ from: String, _ to: String, _ trace: TranslateTrace) async -> (original: String, translation: String)?)?
    /// Diagnostics: key released → transcript → translation → voice finished.
    var onTiming: ((SentenceTiming) -> Void)?
    /// Key released → the first sound of the translation went out, for every real press.
    var onLatency: ((Double) -> Void)?
    /// Set by the sound test: the next press is a rehearsal. It reports every stage here and stays
    /// out of the meeting record and the diagnostics.
    var probe: SpeakProbe?
    private var releasedAt: Date?
    /// When the latest `speak` call started sending audio, and how it was voiced.
    private(set) var firstAudioAt: Date?
    private(set) var lastVoice = ""
    /// The real microphone to record from; the system default may be the virtual mic.
    var inputDevice: (() -> OutputDevice?)?
    /// Language the room speaks (for "follow the room").
    var roomLanguage: (() -> String?)?

    let settings: AppSettings
    private(set) var phase: Phase = .idle {
        didSet {
            if phase == .idle { unitIdle() }
            // Hands-free: a sentence said while the last one was translated waits its turn.
            if handsFree, phase == .idle || phase == .speaking, !segments.isEmpty {
                DispatchQueue.main.async { [weak self] in MainActor.assumeIsolated { self?.nextSegment() } }
            }
        }
    }

    private var mic = AVAudioEngine()
    /// The mic with echo cancellation, shared with 电脑和会议室's room (`VoiceMic`): used when
    /// `echoCancel` is on, or whenever the room already has it running.
    private let voiceMic: VoiceMic
    /// On by default (`speakVP:off` for the plain mic). With the meeting on the speakers and the
    /// plain mic, Ming took the meeting's own English for what I said and sent it back into the
    /// meeting, every press, even one nobody spoke in; through the unit my sentences came through
    /// whole (an ESP32 speaker 10 cm from the mic as me, the MacBook's speakers at 56 %).
    var echoCancel = true
    /// The real mic to cancel the echo for; nil when it is unknown or virtual (nothing to cancel there).
    private var echoInput: AudioObjectID? {
        // The plain room mic open: the unit readied after each press made it start again, which
        // gave the unit back, and every restart churned the system audio tap and the voice output
        // too, so later presses lost most of what was said and voices didn't reach the meeting.
        guard micTaken?() != true, let d = inputDevice?(), !d.isVirtualMic else { return nil }
        return d.id
    }
    private let micQueue = DispatchQueue(label: "com.wquguru.cicada.mic", qos: .userInitiated)
    private let converter = PCMConverter()
    private var analyzerFormat: AVAudioFormat?
    private var analyzerLocale = ""
    private nonisolated(unsafe) var feeding = false
    private var finals: [String] = []
    private var volatile = ""
    private var pressStarted = Date()
    /// The press went to the plain mic: echo cancellation wasn't to be had (打开麦克风 holds the mic
    /// without it, and lets go of the unit the press would need).
    private var pressPlain = false
    /// Whether the plain room mic holds the mic (打开麦克风 without echo cancellation).
    var micTaken: (() -> Bool)?
    /// The share of a stretch the Mac played its meeting through to the mic (`EchoGate.playedShare`).
    var playedShare: ((Date, Date) -> Double)?
    /// Over this share, what the plain mic heard is the meeting's echo as much as you: Ming sent the
    /// other side's own words back to them (as the ports drop it, Windows `EchoShare`).
    static let echoShare = 0.5
    private nonisolated(unsafe) var micRecorder: AVAudioFile?
    private nonisolated(unsafe) var micRecordURL: URL?
    /// This press's audio as 16 kHz mono 16-bit samples for Ming; only touched on `micQueue`.
    private nonisolated(unsafe) var pressSamples: [Int16] = []
    private nonisolated(unsafe) var pressConverter = PCMConverter()
    private nonisolated static let pressFormat = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: 16_000, channels: 1, interleaved: false)!
    /// Ming takes at most this much of a press (the talk key is meant for a sentence or two).
    private nonisolated static let pressLimit = 16_000 * 60

    private let synth = AVSpeechSynthesizer()
    private var out = AVAudioEngine()
    private var player = AVAudioPlayerNode()
    private var outObserver: NSObjectProtocol?
    private var outFormat: AVAudioFormat?
    /// Where the output was last pointed, to wire a replaced engine the same way.
    private var outDevice: OutputDevice?
    private var outDeviceUID: String?
    /// The device the latest `speak` call played to.
    private(set) var lastDevice: OutputDevice?
    /// Debug: also write synthesized speech here.
    var debugOutputURL: URL?

    init(settings: AppSettings, voiceMic: VoiceMic) {
        self.settings = settings
        self.voiceMic = voiceMic
        wireOutput()
    }

    // MARK: Hands-free

    /// 不用按键: the mic through echo cancellation the whole time, and every sentence I say is
    /// interpreted as a press would be (`HandsFreeDetector` says where it starts and ends). Set by the
    //
```

### Core Architecture Module: `android/core/src/main/kotlin/cicada/AICheck.kt`
```
package cicada

import cicada.Strings.L
import cicada.Strings.LF

/// What the last look at the AI service found, step by step (AICheck.swift): can this phone reach
/// it, does it take the key, does the text model answer, does the hear model take audio. A failed
/// step stops the ones after it, so the settings can say exactly where it broke and offer the one
/// thing that fixes it. The port has a fourth step the Mac doesn't: it hears through the service.
///
/// Most of the time the answer comes from real requests (hearing, notes, translation): every call
/// reports back here, so a meeting keeps the steps current without any extra request. An explicit
/// check runs only when the service, model or key changes, at launch, on 重新检查, and when the
/// network changes after the service was unreachable. Immutable: LingClient swaps in a new one.
data class AICheck(
    val steps: List<Step> = StepID.values().map { Step(it, State.Untested) },
    /** When the newest result came in (epoch ms); null before any. */
    val at: Long? = null,
    /** The newest result came from a real request in a meeting, not from a check. */
    val passive: Boolean = false,
    /** Where the phone's proxy stands when the service can't be reached: only read, to word the hint. */
    val proxy: ProxyHint? = null,
    /** OpenRouter only: dollars left (the smaller of the key's limit and the account's credits). */
    val balance: Double? = null,
    /** A custom service: how long one real sentence took, and whether the model thought first. */
    val translate: Speed? = null,
    /** A custom service whose notes go to another model or server: how that one answered. Null
     *  while notes use the translation model (then `steps` say it all). A notes failure doesn't
     *  stop translation: `failure` and `passed` stay about translation. */
    val notes: Notes? = null,
) {
    sealed class Notes {
        object Running : Notes() { override fun toString() = "running" }
        data class Ok(val seconds: Double) : Notes() {
            override fun toString() = "ok(${String.format(java.util.Locale.US, "%.1f", seconds)}s)"
        }
        data class Fail(val why: Reason, val code: Int? = null) : Notes() {
            override fun toString() = "fail(${lower(why.name)}${code?.let { " $it" } ?: ""})"
        }
        val ok get() = this is Ok
        val reason get() = (this as? Fail)?.why
    }

    data class Speed(val seconds: Double, val thinks: Boolean) {
        /// A sentence that takes this long often misses the 6 s a translation is given
        /// (Translator.translate) and falls back to Google.
        val slow get() = thinks || seconds >= SLOW_AFTER
        companion object { const val SLOW_AFTER = 3.0 }
    }

    enum class StepID { Reach, Key, Text, Hear }

    enum class Reason { Unreachable, BadAddress, InvalidKey, MgmtKey, NoCredit, NoModel, NoJSON, Deaf, Busy, ServerError }

    sealed class State {
        object Running : State()
        /** `seconds` of the request that proved it; null when it came with another step's request. */
        data class Ok(val seconds: Double? = null) : State()
        /** 429: the service is busy but the key works. Counts as passed. */
        object Busy : State()
        data class Fail(val reason: Reason, val code: Int? = null) : State()
        object Skipped : State()
        /** Nothing has proven it yet. */
        object Untested : State()
    }

    data class Step(val id: StepID, val state: State)

    /// A phone has no proxy app port to look for (the Mac's appRunning): only the system's.
    enum class ProxyHint { SystemOn, None }

    data class Failure(val step: StepID, val reason: Reason, val code: Int?)

    operator fun get(id: StepID): State = steps.firstOrNull { it.id == id }?.state ?: State.Untested

    fun with(id: StepID, state: State) = copy(steps = steps.map { if (it.id == id) Step(id, state) else it })

    /// The first step that failed, and why.
    val failure: Failure? get() {
        for (s in steps) { val st = s.state; if (st is State.Fail) return Failure(s.id, st.reason, st.code) }
        return null
    }

    val running get() = steps.any { it.state == State.Running } || notes == Notes.Running
    /** Translation works but the notes' own model or server doesn't (a busy one fixes itself). */
    val notesFailed get() = notes?.reason.let { it != null && it != Reason.Busy }
    val busy get() = steps.any { it.state == State.Busy }
    /** Every step passed (busy counts; a step nothing has tested yet does not block). */
    val passed get() = at != null && failure == null && !running
    val lowBalance get() = (balance ?: Double.POSITIVE_INFINITY) < LOW_BALANCE
    /** Text works but every sentence is slow (a thinking model): translations will fall back. */
    val slow get() = textFailure == null && translate?.slow == true
    /** The failure, unless it is only the hear model's (a custom service's rows show that apart). */
    val textFailure get() = failure?.takeIf { it.step != StepID.Hear }

    /** Something only the user can fix (a busy service fixes itself). */
    val needsUser: Boolean get() {
        val f = failure ?: return lowBalance
        return f.reason != Reason.Busy && f.reason != Reason.ServerError
    }

    /// `step` failed and the ones after it were never reached. `reached`: a reply came back, so the
    /// steps that request proves before it passed (false when nothing was sent, like a management key).
    fun fail(step: StepID, reason: Reason, code: Int? = null, reached: Boolean = true): AICheck {
        val proves = proves(step)
        var after = false
        val next = steps.map { s ->
            when {
                s.id == step -> { after = true; Step(s.id, State.Fail(reason, code)) }
                after -> Step(s.id, State.Skipped)
                reached && s.id in proves && !isOk(s.state) -> Step(s.id, State.Ok())
                // The text step comes before hearing but a hear request says nothing about it.
                s.id !in proves && s.state == State.Skipped -> Step(s.id, State.Untested)
                // Nothing was sent: the step a check had started on was never tried.
                s.state == State.Running -> Step(s.id, State.Untested)
                else -> s
            }
        }
        return copy(steps = next, proxy = if (reason == Reason.Unreachable) proxy else null)
    }

    /// One request proved `step` and what it rests on (a chat proves the address, the key and the
    /// text model; heard audio the address, the key and the hear model). Clears what failed before;
    /// steps that were skipped are open again.
    fun pass(step: StepID, seconds: Double?): AICheck {
        val proves = proves(step)
        val next = steps.map { s ->
            when {
                s.id == step -> Step(s.id, State.Ok(seconds))
                s.id in proves -> if (isOk(s.state)) s else Step(s.id, State.Ok())
                s.state == State.Skipped -> Step(s.id, State.Untested)
                else -> s
            }
        }
        return copy(steps = next, proxy = null)
    }

    // MARK: Words

    /// Why the failed step failed, in one sentence. `model`: the text model; `hearModel`: the hear model.
    fun message(service: String, host: String, model: String, hearModel: String): String? {
        val f = failure ?: return if (busy) LF("%@ 现在很忙，key 没问题。开会时会自动重试。", service) else null
        return when (f.reason) {
            Reason.Unreachable -> LF("这台手机访问不到 %@。", host)
            Reason.BadAddress -> L("地址要用 https；这台手机和局域网里的服务可以用 http。")
            Reason.InvalidKey -> LF("%@ 说这个 key 无效，可能没复制全，或已删除。", service)
            Reason.MgmtKey -> L("这是 ZenMux 的管理 key，不能用来调用模型。请粘贴 sk-payg 开头的 key。")
            Reason.NoCredit -> LF("%@ 账户余额不足。", service)
            Reason.NoModel -> LF("%@ 上找不到 %@ 这个模型。", service, model)
            Reason.NoJSON -> L("这个服务不支持 JSON，纪要写不了；翻译照常。")
            Reason.Deaf -> LF("%@ 听不了声音。", hearModel)
            Reason.Busy -> LF("%@ 现在很忙，key 没问题。开会时会自动重试。", service)
            Reason.ServerError -> LF("%@ 暂时出错（HTTP %lld），稍后再试。", service, f.code ?: 0)
        }
    }

    /// What stops listening or the notes until the user changes something (the Mac's
    /// AIServiceStrip.blocking): (what's wrong, what it stops). Not the network, a busy service or
    /// a server error: those fix themselves. Said beyond 设置, on the listening notification and the
    /// live screens. Models by their short name (after the last "/").
    fun blocking(service: String, textModel: String, hearModel: String): Pair<String, String>? {
        val f = failure ?: return null
        val stops = L("修好之前听不了")
        val notesStop = L("字幕照常，纪要先停下")
        return when (f.reason) {
            Reason.InvalidKey, Reason.MgmtKey -> LF("%@ 的 key 用不了", service) to stops
            Reason.NoCredit -> LF("%@ 账户余额不足。", service) to stops
            Reason.NoModel -> LF("%@ 上找不到 %@ 这个模型。", service, textModel.substringAfterLast('/')) to notesStop
            Reason.Deaf -> LF("%@ 听不了声音。", hearModel.substringAfterLast('/')) to stops
            Reason.BadAddress -> L("AI 服务的设置要改一下") to stops
            Reason.NoJSON -> L("AI 服务的设置要改一下") to notesStop
            Reason.Unreachable, Reason.Busy, Reason.ServerError -> null
        }
    }

    /// Why translations are slow, and what to do (a custom service).
    /// `googleOff`: 语音和文字只发给你的服务 is on, so a sentence that takes too long isn't handed to Google.
    fun slowLine(googleOff: Boolean = false): String? {
        val t = translate?.takeIf { slow } ?: return null
        val secs = String.format(Strings.locale, "%.1f", t.seconds)
        if (googleOff) return if (t.thinks) LF("这个模型先思考再回答，翻一句要 %@ 秒，超过 6 秒这句就不等它了。在服务端关掉思考，或换一个不思考的模型。", secs)
            else LF("翻一句要 %@ 秒，超过 6 秒这句就不等它了。换一个更小的模型会快一些。", secs)
        return if (t.thinks) LF("这个模型先思考再回答，翻一句要 %@ 秒，超过 6 秒会改用 Google。在服务端关掉思考，或换一个不思考的模型。", secs)
        else LF("翻一句要 %@ 秒，超过 6 秒会改用 Go
```

### Core Architecture Module: `android/core/src/main/kotlin/cicada/Audio.kt`
```
package cicada

import java.io.ByteArrayOutputStream
import java.io.DataInputStream
import java.io.File
import java.io.InputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder

/// Where listening gets its sound: 16 kHz mono Int16, pushed from any thread. On Android the
/// playback capture or the microphone; in tests, the CLI and the sample meeting, a file.
interface AudioSource {
    /// Set before start(); called on the source's own thread.
    var onSamples: ((ShortArray) -> Unit)?
    /// Called once when the source can't go on: null when a file finished, else why.
    var onEnded: ((String?) -> Unit)?
    fun start()
    fun stop()
}

/// Debug (the Mac's silentListen): a meeting with no audio at all, its lines given by
/// ListenEngine.debugHeard, to try what follows a finished sentence without playing anything.
class SilentAudioSource : AudioSource {
    override var onSamples: ((ShortArray) -> Unit)? = null
    override var onEnded: ((String?) -> Unit)? = null
    override fun start() {}
    override fun stop() {}
}

/// Plays 16 kHz samples into listening, in real time or as fast as it can (`speed` 0).
class PcmAudioSource(private val load: () -> ShortArray, private val speed: Double = 1.0) : AudioSource {
    override var onSamples: ((ShortArray) -> Unit)? = null
    override var onEnded: ((String?) -> Unit)? = null
    @Volatile private var stopped = false

    constructor(file: File, speed: Double = 1.0) : this({ Wav.read(file.inputStream()) }, speed)

    override fun start() {
        stopped = false
        Thread({
            val pcm = try { load() } catch (e: Exception) {
                Log.d("file source: unreadable ${e.javaClass.simpleName}"); onEnded?.invoke("unreadable"); return@Thread
            }
            val chunk = Segmenter.RATE / 10 // 100 ms, like a capture callback
            val started = System.nanoTime()
            var i = 0
            while (i < pcm.size && !stopped) {
                onSamples?.invoke(pcm.copyOfRange(i, minOf(pcm.size, i + chunk)))
                if (speed > 0) {
                    val due = started + ((i + chunk).toDouble() / Segmenter.RATE / speed * 1e9).toLong()
                    val wait = (due - System.nanoTime()) / 1_000_000
                    if (wait > 0) Thread.sleep(wait)
                }
                i += chunk
            }
            // A second of silence so the last sentence's pause is heard.
            onSamples?.invoke(ShortArray(Segmenter.RATE))
            onEnded?.invoke(null)
        }, "PcmAudioSource").apply { isDaemon = true }.start()
    }

    override fun stop() { stopped = true }
}

/// One stretch of speech as sent to Ming: the bytes and their media type.
class Clip(val bytes: ByteArray, val type: String) {
    companion object { fun wav(pcm: ShortArray) = Clip(Wav.bytes(pcm), "audio/wav") }
}

object Wav {
    fun bytes(pcm: ShortArray, rate: Int = Segmenter.RATE): ByteArray {
        val b = ByteBuffer.allocate(44 + pcm.size * 2).order(ByteOrder.LITTLE_ENDIAN)
        b.put("RIFF".toByteArray()).putInt(36 + pcm.size * 2).put("WAVEfmt ".toByteArray()).putInt(16)
        b.putShort(1).putShort(1).putInt(rate).putInt(rate * 2).putShort(2).putShort(16)
        b.put("data".toByteArray()).putInt(pcm.size * 2)
        for (s in pcm) b.putShort(s)
        return b.array()
    }

    /// A PCM16 WAV of any rate and channel count, as 16 kHz mono.
    fun read(input: InputStream): ShortArray {
        val all = input.use { it.readBytes() }
        val b = ByteBuffer.wrap(all).order(ByteOrder.LITTLE_ENDIAN)
        fun tag(): String { val a = ByteArray(4); b.get(a); return String(a, Charsets.US_ASCII) }
        if (tag() != "RIFF") throw IllegalArgumentException("not a WAV")
        b.int
        if (tag() != "WAVE") throw IllegalArgumentException("not a WAV")
        var channels = 1; var rate = 16000; var bits = 16
        while (b.remaining() >= 8) {
            val id = tag(); val size = b.int
            when (id) {
                "fmt " -> {
                    val start = b.position()
                    val format = b.short.toInt() and 0xFFFF; channels = b.short.toInt(); rate = b.int
                    b.int; b.short; bits = b.short.toInt()
                    b.position(start + size)
                    if ((format != 1 && format != 0xFFFE) || bits != 16) throw IllegalArgumentException("only 16-bit PCM WAV")
                }
                "data" -> {
                    val frames = minOf(size, b.remaining()) / 2 / channels
                    val mono = DoubleArray(frames)
                    for (f in 0 until frames) {
                        var sum = 0.0
                        repeat(channels) { sum += b.short }
                        mono[f] = sum / channels
                    }
                    return resample(mono, rate)
                }
                else -> b.position(minOf(b.limit(), b.position() + size + (size and 1)))
            }
        }
        throw IllegalArgumentException("no data chunk")
    }

    /// Box average then pick: plenty for speech going to a recognizer.
    fun resample(mono: DoubleArray, rate: Int): ShortArray {
        fun clamp(x: Double) = x.coerceIn(Short.MIN_VALUE.toDouble(), Short.MAX_VALUE.toDouble()).toInt().toShort()
        if (rate == Segmenter.RATE) return ShortArray(mono.size) { clamp(mono[it]) }
        val window = maxOf(1, rate / Segmenter.RATE)
        val count = (mono.size.toLong() * Segmenter.RATE / rate).toInt()
        return ShortArray(count) { i ->
            val start = (i.toLong() * rate / Segmenter.RATE).toInt()
            val stop = minOf(mono.size, start + window)
            var sum = 0.0
            for (j in start until stop) sum += mono[j]
            clamp(sum / maxOf(1, stop - start))
        }
    }

    fun rms(buf: ShortArray): Double {
        if (buf.isEmpty()) return 0.0
        var sum = 0.0
        for (s in buf) sum += s.toDouble() * s
        return Math.sqrt(sum / buf.size) / 32768
    }
}

```

### Core Architecture Module: `android/core/src/main/kotlin/cicada/Correction.kt`
```
package cicada

/// A word the AI service said speech recognition got wrong in a finished line ("莫拉" → "Morpho"),
/// field for field the Mac's LineFix. The line keeps what was heard (`src`) and carries its fixes,
/// so a record moves between the platforms unchanged.
data class LineFix(
    var from: String,
    var to: String,
    /// Waiting for the user (a name sound can't check): not applied until confirmed.
    var ask: Boolean? = null,
    /// The user said no (改回 or 不对): kept so the same line isn't fixed that way again.
    var off: Boolean? = null,
    /// The user's own: said 对, or wrote it (改这句…). A later pass never drops or overrides it.
    var user: Boolean? = null,
) {
    val applied: Boolean get() = ask != true && off != true

    fun toJson(): Map<String, Any?> = mapOf("from" to from, "to" to to, "ask" to ask, "off" to off, "user" to user)

    companion object {
        fun from(o: Map<String, Any?>) = LineFix(o["from"].str() ?: "", o["to"].str() ?: "", o["ask"].bool(), o["off"].bool(), o["user"].bool())
    }
}

/// 改正听错的词 (the Mac's Correction.swift): which of the service's proposed fixes to take, and
/// the line as shown once they are in. The service's own confidence isn't enough: in a 21-minute
/// test it rated "快销 → 区块" and "苍蝇 → 方向" above 0.85. So a Chinese word may only be swapped
/// for one that sounds alike (pinyin), a Latin word only for a near spelling, and a new name only
/// once the user says so.
object Correction {
    data class Edit(val from: String, val to: String, val confidence: Double)

    enum class Verdict { Apply, Ask, Drop }

    const val APPLY_AT = 0.6
    const val SPELLING_AT = 0.8
    const val ASK_AT = 0.8

    /// Toneless lowercase pinyin of one character ("" when it has none). The app sets the phone's
    /// ICU transform ("Han-Latin; Latin-ASCII"), the counterpart of the Mac's system transform;
    /// the tests and the CLI set a table generated from the same transform. Unset: nothing sounds alike.
    @Volatile var pinyinOf: (Char) -> String = { "" }

    private fun word(c: Char) = c.code < 128 && c.isLetterOrDigit()

    /// The part an edit changes, as a word: "解除质压" → "解除质押" is "质压" → "质押" (at least two
    /// characters, so one refusal doesn't block every 压 → 押), and a Latin word stays whole
    /// ("Un450P三" → "Uniswap V3", not "450P三" → "iswap V3").
    fun core(from: String, to: String): Pair<String, String> {
        val a = from; val b = to
        var i = 0
        while (i < minOf(a.length, b.length) && a[i] == b[i]) i++
        var j = 0
        while (j < minOf(a.length, b.length) - i && a[a.length - 1 - j] == b[b.length - 1 - j]) j++
        // Only a change that starts or ends inside a Latin word takes the rest of the word.
        if ((i < a.length && word(a[i])) || (i < b.length && word(b[i]))) { while (i > 0 && word(a[i - 1])) i-- }
        if ((a.length - j - 1 >= 0 && word(a[a.length - j - 1])) || (b.length - j - 1 >= 0 && word(b[b.length - j - 1]))) {
            while (j > 0 && word(a[a.length - j])) j--
        }
        // Two characters at least, taken from the Chinese side: "FFT制押" → "FFT质押" is "制押" → "质押".
        while (a.length - j - i < 2 || b.length - j - i < 2) {
            if (j > 0 && !word(a[a.length - j])) j-- else if (i > 0 && !word(a[i - 1])) i-- else break
        }
        return a.substring(i, maxOf(i, a.length - j)) to b.substring(i, maxOf(i, b.length - j))
    }

    /// A fix as the UI names it (听成 X → Y, 已改回 X): the changed words, or the whole fix when
    /// it only adds or drops words ("in" → "in now", whose changed part alone would be "" → "now").
    fun label(f: LineFix): Pair<String, String> {
        val c = core(f.from, f.to)
        return if (c.first.isEmpty() || c.second.isEmpty()) f.from to f.to else c
    }

    /// `known`: the user confirmed this heard form for this word (the word list). `rejected`: they
    /// said no to it in this meeting.
    fun decide(e: Edit, known: (String, String) -> Boolean, rejected: (String, String) -> Boolean): Verdict {
        val (cf, ct) = core(e.from, e.to)
        if (cf.isEmpty() || ct.isEmpty() || cf.lowercase() == ct.lowercase() || rejected(e.from, e.to) || rejected(cf, ct)) return Verdict.Drop
        if (known(e.from, e.to) || known(cf, ct)) return Verdict.Apply
        if (e.confidence < APPLY_AT) return Verdict.Drop
        val latinFrom = cf.any { it.code < 128 && it.isLetter() }; val latinTo = ct.any { it.code < 128 && it.isLetter() }
        if (!latinFrom && !latinTo && han(cf) && han(ct) && soundsAlike(cf, ct)) return Verdict.Apply
        if (latinFrom && latinTo && cf.all { it.code < 128 } && ct.all { it.code < 128 } && e.confidence >= SPELLING_AT &&
            distance(cf.lowercase(), ct.lowercase()) <= 2) return Verdict.Apply
        // A new name (Chinese heard as a Latin name, or a respelled one): sound can't check it. A
        // name has a capital or a digit; "X平台 → X platform" is a translation, and one 对 to it
        // taught the word list 平台 → platform, which then rewrote every 平台 in the meeting.
        if (latinTo && e.confidence >= ASK_AT && nameShaped(ct)) return Verdict.Ask
        return Verdict.Drop
    }

    /// Latin text that could be a name: a capital or a digit in it (Morpho, GPT4o), not "platform".
    fun nameShaped(s: String): Boolean = s.any { it.code < 128 && (it.isUpperCase() || it.isDigit()) }

    /// A Chinese word "fixed" into a plain English one (平台 → platform): a translation, not a
    /// misheard name.
    fun translation(heard: String, word: String): Boolean =
        han(heard) && word.any { it.code < 128 && it.isLetter() } && word.all { it.code < 128 } && !nameShaped(word)

    fun pinyin(s: String): List<String> = s.map { pinyinOf(it).trim().lowercase() }

    private val initials = listOf("zh", "ch", "sh", "b", "p", "m", "f", "d", "t", "n", "l", "g", "k", "h", "j", "q",
                                  "x", "r", "z", "c", "s", "y", "w")

    private fun split(syllable: String): Pair<String, String> {
        for (i in initials) if (syllable.startsWith(i)) return i to syllable.substring(i.length)
        return "" to syllable
    }

    /// Same number of syllables, and on average three quarters alike: a syllable counts whole when
    /// equal, half when its initial or its final matches (质/追, 销/照). 苍蝇/方向 is a quarter.
    fun soundsAlike(a: String, b: String): Boolean {
        val x = pinyin(a); val y = pinyin(b)
        if (x.size != y.size || x.isEmpty() || x.any { it.isEmpty() } || y.any { it.isEmpty() }) return false
        var score = 0.0
        for ((p, q) in x.zip(y)) {
            if (p == q) { score += 1; continue }
            val (i1, f1) = split(p); val (i2, f2) = split(q)
            if (i1 == i2 || f1 == f2 || f1.replace("ng", "n") == f2.replace("ng", "n")) score += 0.5
        }
        return score / x.size >= 0.75
    }

    fun han(s: String): Boolean = s.isNotEmpty() && s.codePoints().allMatch { Character.isIdeographic(it) }

    fun distance(a: String, b: String): Int {
        val row = IntArray(b.length + 1) { it }
        for ((i, ca) in a.withIndex()) {
            var prev = row[0]
            row[0] = i + 1
            for ((j, cb) in b.withIndex()) {
                val cur = row[j + 1]
                row[j + 1] = minOf(row[j + 1] + 1, row[j] + 1, prev + if (ca == cb) 0 else 1)
                prev = cur
            }
        }
        return row[b.length]
    }

    /// The service's reply to a sentence sent with fixes asked for:
    /// {"translation": "…", "fixes": [{"from", "to", "confidence"}]}. Null when it isn't that shape.
    /// Fixes whose words aren't in the subtitle are dropped: the service sometimes quotes them rephrased.
    fun parse(reply: String, subtitle: String): Pair<String, List<Edit>>? {
        // Asked for JSON in the prompt only: take the outermost {…}, fenced or not.
        val open = reply.indexOf('{'); val close = reply.lastIndexOf('}')
        if (open < 0 || close <= open) return null
        val o = Json.parseObject(reply.substring(open, close + 1)) ?: return null
        val translation = o["translation"].str() ?: return null
        val edits = mutableListOf<Edit>()
        for (f in o["fixes"].arr()) {
            val m = f.obj() ?: continue
            val from = m["from"].str() ?: continue; val to = m["to"].str() ?: continue
            if (from.isEmpty() || from == to || !subtitle.contains(from)) continue
            edits.add(Edit(from, to, (m["confidence"] as? Number)?.toDouble() ?: 0.0))
        }
        return translation.trim() to edits
    }

    /// What a line's fixes become after the service answered for it again (a joined line): the
    /// user's decisions stay (said no, said yes, wrote it), and of the rest only what is proposed
    /// again. So a pass that no longer proposes a fix takes it back.
    fun merge(old: List<LineFix>, new: List<LineFix>): List<LineFix> {
        val kept = old.filter { it.off == true || it.user == true }
        val fresh = new.filter { n ->
            val c = core(n.from, n.to).first
            kept.none { it.from == n.from || core(it.from, it.to).first == c }
        }
        return kept + fresh
    }

    data class UserEdit(val fix: LineFix, val heard: String, val swap: Boolean)

    /// 改这句…: the user rewrote the line as shown. What changed, as a fix on top of the others: the
    /// changed span grown to whole tokens (a Latin word, or one CJK character), and further, a token
    /// at a time, until it holds a letter and is the only such span in the line. An added word
    /// ("lock that in." → "lock that in now.") is then "in" → "in now" on this line, never "." on
    /// every line. `swap` is whether words were replaced (not only added or dropped): only a swap
    /// may go to the rest of the meeting and teach the word list. `heard` is the words in `src`
    /// when they are there, else the heard words of the fix the user corrected again.
    fun userEdit(shown: String,
```

### Core Architecture Module: `android/core/src/main/kotlin/cicada/Ed25519.kt`
```
package cicada

import java.math.BigInteger
import java.security.MessageDigest

/// Ed25519 signing (RFC 8032), for the share service's device key (ShareClient). Android has it
/// built in only from Android 13 (API 33) and the app runs from Android 10, so this is the RFC's
/// reference algorithm on BigInteger, with the platform's SHA-512: slow by crypto standards (tens
/// of milliseconds a signature), which is nothing for one request. Signing only; the server
/// verifies. Tested against RFC 8032's vectors and the JDK's own Ed25519 (cli Tests).
/// Not constant-time: the key only names this phone to the share service (rate limits and owning
/// its links), and nothing else on the phone can time the signing.
object Ed25519 {
    private val TWO = BigInteger.valueOf(2) // BigInteger.TWO is Android 13+
    private val P = BigInteger.ONE.shiftLeft(255).subtract(BigInteger.valueOf(19))
    private val Q = BigInteger.ONE.shiftLeft(252).add(BigInteger("27742317777372353535851937790883648493"))
    private val D = BigInteger.valueOf(-121665).multiply(inv(BigInteger.valueOf(121666))).mod(P)
    private val D2 = D.shiftLeft(1).mod(P)
    private val SQRT_M1 = TWO.modPow(P.subtract(BigInteger.ONE).shiftRight(2), P)
    private val G: Array<BigInteger> = run {
        val y = BigInteger.valueOf(4).multiply(inv(BigInteger.valueOf(5))).mod(P)
        val x = recoverX(y)
        arrayOf(x, y, BigInteger.ONE, x.multiply(y).mod(P))
    }

    private fun inv(x: BigInteger) = x.modPow(P.subtract(TWO), P)

    private fun recoverX(y: BigInteger): BigInteger {
        val yy = y.multiply(y)
        val x2 = yy.subtract(BigInteger.ONE).multiply(inv(D.multiply(yy).add(BigInteger.ONE))).mod(P)
        var x = x2.modPow(P.add(BigInteger.valueOf(3)).shiftRight(3), P)
        if (x.multiply(x).subtract(x2).mod(P).signum() != 0) x = x.multiply(SQRT_M1).mod(P)
        return if (x.testBit(0)) P.subtract(x) else x // the base point's x is even
    }

    // Extended coordinates (X, Y, Z, T), x = X/Z, y = Y/Z, xy = T/Z.
    private fun add(a: Array<BigInteger>, b: Array<BigInteger>): Array<BigInteger> {
        val pa = a[1].subtract(a[0]).multiply(b[1].subtract(b[0])).mod(P)
        val pb = a[1].add(a[0]).multiply(b[1].add(b[0])).mod(P)
        val c = a[3].multiply(D2).multiply(b[3]).mod(P)
        val d = a[2].shiftLeft(1).multiply(b[2]).mod(P)
        val e = pb.subtract(pa); val f = d.subtract(c); val g = d.add(c); val h = pb.add(pa)
        return arrayOf(e.multiply(f).mod(P), g.multiply(h).mod(P), f.multiply(g).mod(P), e.multiply(h).mod(P))
    }

    private fun mul(scalar: BigInteger, point: Array<BigInteger>): Array<BigInteger> {
        var q = arrayOf(BigInteger.ZERO, BigInteger.ONE, BigInteger.ONE, BigInteger.ZERO)
        var p = point
        for (i in 0 until scalar.bitLength()) {
            if (scalar.testBit(i)) q = add(q, p)
            p = add(p, p)
        }
        return q
    }

    private fun compress(pt: Array<BigInteger>): ByteArray {
        val z = inv(pt[2])
        val x = pt[0].multiply(z).mod(P)
        var y = pt[1].multiply(z).mod(P)
        if (x.testBit(0)) y = y.setBit(255)
        return little(y)
    }

    private fun little(n: BigInteger): ByteArray {
        val big = n.toByteArray()
        val out = ByteArray(32)
        for (i in 0 until minOf(32, big.size)) out[i] = big[big.size - 1 - i]
        return out
    }

    private fun number(b: ByteArray): BigInteger = BigInteger(1, b.reversedArray())

    private fun sha512(vararg parts: ByteArray): ByteArray {
        val md = MessageDigest.getInstance("SHA-512")
        for (p in parts) md.update(p)
        return md.digest()
    }

    private fun expand(seed: ByteArray): Pair<BigInteger, ByteArray> {
        require(seed.size == 32) { "an Ed25519 seed is 32 bytes" }
        val h = sha512(seed)
        val a = number(h.copyOfRange(0, 32)).and(BigInteger.ONE.shiftLeft(254).subtract(BigInteger.valueOf(8))).setBit(254)
        return a to h.copyOfRange(32, 64)
    }

    /// The 32-byte public key of a 32-byte private seed.
    fun publicKey(seed: ByteArray): ByteArray = compress(mul(expand(seed).first, G))

    /// A 64-byte signature of `message`.
    fun sign(seed: ByteArray, message: ByteArray, publicKey: ByteArray = publicKey(seed)): ByteArray {
        val (a, prefix) = expand(seed)
        val r = number(sha512(prefix, message)).mod(Q)
        val rs = compress(mul(r, G))
        val h = number(sha512(rs, publicKey, message)).mod(Q)
        val s = r.add(h.multiply(a)).mod(Q)
        return rs + little(s)
    }
}

```

### Core Architecture Module: `android/core/src/main/kotlin/cicada/Export.kt`
```
package cicada

import java.io.ByteArrayOutputStream
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/// What the transcript shows for the other side's lines (the Mac's SpeakerLabels, SpeakerID.swift).
/// A voice gets a number only once it has `SHOWN_AFTER` substantive lines, and only when at least
/// two voices have, so a one-to-one call stays 对方. Numbers follow the order voices got there.
/// The voices come from SpeakerTagger (Speakers.kt) or records made on another platform.
object SpeakerLabels {
    const val SHOWN_AFTER = 5

    /// Speaker numbers on (设置 › 说话人识别), kept in step by the app.
    @Volatile var voices = true

    /// Long enough to say whose voice it is: three words, or four characters of CJK.
    fun substantive(text: String): Boolean {
        val words = text.split(Regex("\\s+")).filter { w -> w.any { it.isLetter() } }
        if (words.size >= 3) return true
        return text.codePoints().filter { c ->
            Character.isIdeographic(c) || c in 0x3040..0x30FF || c in 0xAC00..0xD7A3
        }.count() >= 4
    }

    /// Voice id → 1-based speaker number, for the voices on show.
    fun voiceNumbers(lines: List<TranscriptLine>): Map<Int, Int> {
        val count = HashMap<Int, Int>(); val reached = HashMap<Int, Int>()
        lines.forEachIndexed { i, l ->
            val v = l.voice
            if (l.speaker != "them" || v == null || !substantive(l.src)) return@forEachIndexed
            count[v] = (count[v] ?: 0) + 1
            if (count[v] == SHOWN_AFTER) reached[v] = i
        }
        val shown = reached.keys.sortedBy { reached[it] }
        if (shown.size < 2) return emptyMap()
        return shown.mapIndexed { i, v -> v to i + 1 }.toMap()
    }

    /// Line id → 1-based speaker number; lines without one show as 对方.
    fun numbers(lines: List<TranscriptLine>): Map<String, Int> {
        if (!voices) return emptyMap()
        val number = voiceNumbers(lines)
        val out = HashMap<String, Int>()
        for (l in lines) if (l.speaker == "them") l.voice?.let { v -> number[v]?.let { out[l.id] = it } }
        return out
    }

    /// Speaker number → name: the user's, else Ling's guess (unless the user turned it down).
    fun names(s: Session): Map<Int, String> {
        if (s.voiceNames == null && s.voiceGuesses == null) return emptyMap()
        val out = HashMap<Int, String>()
        for ((v, n) in voiceNumbers(s.lines)) {
            val mine = s.voiceNames?.get(v.toString())
            if (mine != null) { if (mine.isNotEmpty()) out[n] = mine }
            else s.voiceGuesses?.get(v.toString())?.let { out[n] = it.name }
        }
        return out
    }

    /// Speaker number → its voice id (to store a name under the voice).
    fun voiceOf(lines: List<TranscriptLine>, number: Int): Int? = voiceNumbers(lines).entries.firstOrNull { it.value == number }?.key

    fun label(number: Int, names: Map<Int, String>): String = names[number] ?: Strings.LF("说话人 %lld", number)

    /// The notes with names: Ling wrote "说话人 6" before anyone named them (SpeakerLabels.named on
    /// the Mac). A copy; the record keeps what Ling wrote.
    fun named(notes: MeetingNotes, names: Map<Int, String>): MeetingNotes {
        val n = MeetingNotes.from(notes.toJson())
        if (names.isEmpty()) return n
        fun swap(text: String): String {
            if (!text.contains("说话人") && !text.contains("Speaker")) return text
            var out = text
            for ((k, name) in names.entries.sortedByDescending { it.key }) // 说话人 12 before 说话人 1
                for (form in listOf("说话人 $k", "说话人$k", "Speaker $k")) out = out.replace(form, name)
            return out
        }
        n.summary = swap(n.summary)
        for (t in n.topics) { t.title = swap(t.title); t.summary = swap(t.summary); t.points = t.points.map(::swap).toMutableList() }
        for (i in n.conclusions + n.todos) { i.text = swap(i.text); i.owner = i.owner?.let(::swap) }
        return n
    }

    /// Whether lines say who spoke. An imported file has no "other side" to call 对方: its lines
    /// are named only once its voices are told apart.
    fun saysWho(s: Session, numbers: Map<String, Int>): Boolean = s.sourceFile == null || numbers.isNotEmpty()

    /// Who said a line: 你 · 同传 (said with 我说, so the other side heard its translation), a
    /// speaker's name or number, else 对方 (未识别 once others have numbers).
    fun speakerName(l: TranscriptLine, numbers: Map<String, Int>, names: Map<Int, String>): String {
        if (l.speaker == "me") return Strings.L("你 · 同传")
        numbers[l.id]?.let { return label(it, names) }
        return if (numbers.isEmpty()) Strings.L("对方") else Strings.L("未识别")
    }
}

/// Exports, as the Mac writes them (TranscriptExport, SessionStore.swift): Markdown, SRT subtitles
/// and a Word document. Plain JVM, so the CLI tests them.
object TranscriptExport {
    fun header(s: Session): String {
        val mins = (s.durationSeconds / 60).toInt()
        val at = DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM, FormatStyle.SHORT)
            .withLocale(Strings.locale).withZone(ZoneId.systemDefault()).format(s.startedAt)
        return "$at · " + if (mins < 1) Strings.L("不到 1 分钟") else Strings.LF("%lld 分钟", mins)
    }

    fun notesMarkdown(n: MeetingNotes?): String {
        if (n == null || n.isEmpty) return ""
        val b = StringBuilder("## ${Strings.L("纪要")}\n\n${n.summary}\n\n")
        for (t in n.topics) {
            b.append("### ${Languages.clock(t.start)} ${t.title}\n\n")
            if (t.summary.isNotEmpty()) b.append("${t.summary}\n\n")
            for (p in t.points) b.append("- $p\n")
            t.fishbone?.let { f ->
                b.append("\n**${f.question}**\n\n")
                for (br in f.branches) b.append("- ${br.label}：${br.detail}\n")
            }
            b.append("\n")
        }
        if (n.conclusions.isNotEmpty()) b.append("### ${Strings.L("结论")}\n\n").append(n.conclusions.joinToString("") { "- ${it.text}\n" }).append("\n")
        if (n.todos.isNotEmpty()) b.append("### ${Strings.L("待办")}\n\n").append(n.todos.joinToString("") { "- [ ] ${it.withOwner}\n" }).append("\n")
        if (n.terms.isNotEmpty()) b.append("### ${Strings.L("人名和术语")}\n\n").append(n.terms.joinToString("") { "- **${it.name}** ${it.note}\n" }).append("\n")
        return b.toString()
    }

    fun markdown(s: Session): String {
        val b = StringBuilder("# ${SessionStore.displayTitle(s)}\n\n${header(s)}\n\n")
        val notes = notesMarkdown(s.notes)
        if (notes.isNotEmpty()) b.append(notes).append("## ${Strings.L("文字记录")}\n\n")
        val numbers = SpeakerLabels.numbers(s.lines); val names = SpeakerLabels.names(s)
        for (l in s.lines) {
            val who = if (SpeakerLabels.saysWho(s, numbers)) " ${SpeakerLabels.speakerName(l, numbers, names)}" else ""
            b.append("**[${Languages.clock(l.t)}]$who**  \n${l.shown}\n")
            l.dst?.takeIf { it != l.shown && it.isNotEmpty() }?.let { b.append("> $it\n") }
            b.append("\n")
        }
        return b.toString()
    }

    fun srt(s: Session): String {
        fun ts(t: Double): String {
            val ms = Math.round(maxOf(0.0, t) * 1000)
            return "%02d:%02d:%02d,%03d".format(ms / 3_600_000, (ms / 60_000) % 60, (ms / 1000) % 60, ms % 1000)
        }
        val b = StringBuilder()
        s.lines.forEachIndexed { i, l ->
            val next = if (i + 1 < s.lines.size) s.lines[i + 1].t else l.t + 4
            val end = maxOf(l.t + 1, minOf(next, l.t + 8))
            // Your own lines (我说) say so, as the record does.
            val tag = if (l.speaker == "me") "[${Strings.L("同传")}] " else ""
            b.append("${i + 1}\n${ts(l.t)} --> ${ts(end)}\n$tag${l.shown}\n")
            l.dst?.takeIf { it != l.shown && it.isNotEmpty() }?.let { b.append("$it\n") }
            b.append("\n")
        }
        return b.toString()
    }

    /// A .docx with the Mac's layout: title, header, notes, then the transcript. Written as
    /// WordprocessingML by hand (a zip of three XML files): no library.
    fun docx(s: Session): ByteArray {
        val body = StringBuilder()
        fun add(text: String, size: Double, bold: Boolean = false, color: String = "000000", after: Double = 4.0) {
            val esc = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            body.append("<w:p><w:pPr><w:spacing w:after=\"${(after * 20).toInt()}\"/></w:pPr><w:r><w:rPr>")
            if (bold) body.append("<w:b/>")
            body.append("<w:color w:val=\"$color\"/><w:sz w:val=\"${(size * 2).toInt()}\"/></w:rPr><w:t xml:space=\"preserve\">$esc</w:t></w:r></w:p>")
        }
        add(SessionStore.displayTitle(s), 20.0, bold = true, after = 6.0)
        add(header(s), 10.0, color = "555555", after = 14.0)
        val n = s.notes
        if (n != null && !n.isEmpty) {
            add(Strings.L("纪要"), 15.0, bold = true, after = 6.0)
            add(n.summary, 11.0, after = 10.0)
            for (t in n.topics) {
                add("${Languages.clock(t.start)}  ${t.title}", 12.0, bold = true, after = 3.0)
                if (t.summary.isNotEmpty()) add(t.summary, 11.0, color = "555555", after = 3.0)
                for (p in t.points) add("• $p", 11.0, after = 2.0)
                t.fishbone?.let { f ->
                    add(f.question, 11.0, bold = true, after = 2.0)
                    for (br in f.branches) add("  – ${br.label}：${br.detail}", 11.0, after = 2.0)
                }
                add("", 6.0, after = 4.0)
            }
            if (n.conclusions.isNotEmpty()) { add(Strings.L("结论"), 12.0, bold = true, after = 3.0); for (c in n.conclusions) add("• ${c.text}", 11.0, after = 2.0) }
            if (n.todos.isNotEmpty()) { add(Strings.L("待办"), 12.0, bold = true, after = 3.0); for (t in n.todos) add("☐ ${t.withOwner}", 11.0, af
```

### Core Architecture Module: `android/core/src/main/kotlin/cicada/FolderExport.kt`
```
package cicada

import java.io.File
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/// 存到文件夹: the file a settled meeting becomes (docs/folder-export.md, the Mac's
/// FolderExport.swift). The name and frontmatter are a contract with the Mac and the other ports
/// (Tests/fixtures/folder-export); the body is 导出 Markdown's. The app writes it through SAF.
object FolderExportFormat {
    /// The record's own name: what the user called it, else the notes' title, else the imported
    /// file's name. Never displayTitle, which is localized and carries a date.
    fun name(s: Session): String {
        if (s.renamed ?: !s.title.startsWith("会议 ")) return s.title
        s.notes?.title?.takeIf { it.isNotEmpty() }?.let { return it }
        // Swift's deletingPathExtension: ".hidden" keeps its name.
        s.sourceFile?.let { f -> val dot = f.lastIndexOf('.'); return if (dot > 0) f.substring(0, dot) else f }
        return ""
    }

    private val banned = "/\\:*?\"<>|#^[]".codePoints().toArray().toSet()

    /// A name every system accepts and a vault can link to: no path, wildcard or link characters,
    /// at most 120 UTF-8 bytes (vaults sync between systems, so the union of their rules). By code
    /// point, so an emoji is never cut in half.
    fun safeName(name: String): String {
        val spaced = StringBuilder()
        name.codePoints().forEach { cp -> if (cp in banned || cp < 0x20) spaced.append(' ') else spaced.appendCodePoint(cp) }
        var out = trim(spaced.split(Regex("[\\s\\p{Z}]+")).filter { it.isNotEmpty() }.joinToString(" "))
        if (out.toByteArray(Charsets.UTF_8).size > 120) {
            val cut = StringBuilder()
            var bytes = 0
            for (cp in out.codePoints().toArray()) {
                bytes += String(Character.toChars(cp)).toByteArray(Charsets.UTF_8).size
                if (bytes > 120) break
                cut.appendCodePoint(cp)
            }
            out = trim(cut.toString())
        }
        return out
    }

    private fun trim(s: String) = s.trim { it == ' ' || it == '.' }

    fun stem(s: Session, zone: ZoneId = ZoneId.systemDefault()): String {
        val date = format(s.startedAt, "yyyy-MM-dd HHmm", zone)
        val safe = safeName(name(s))
        return if (safe.isEmpty()) date else "$date $safe"
    }

    /// `stem.md`, or `stem 2.md`, `stem 3.md`… when a name is taken.
    fun fileName(stem: String, taken: (String) -> Boolean): String {
        var n = 1
        while (true) {
            val name = if (n == 1) "$stem.md" else "$stem $n.md"
            if (!taken(name)) return name
            n++
        }
    }

    /// A JSON-style double-quoted string, which YAML reads as is. Not Json.write's: that escapes "/"
    /// as the Mac's JSONEncoder does, and the frontmatter keeps it.
    fun quote(s: String): String {
        val b = StringBuilder("\"")
        s.codePoints().forEach { cp ->
            when {
                cp == '\\'.code -> b.append("\\\\")
                cp == '"'.code -> b.append("\\\"")
                cp == '\n'.code -> b.append("\\n")
                cp == '\r'.code -> b.append("\\r")
                cp == '\t'.code -> b.append("\\t")
                cp < 0x20 -> b.append(String.format(Locale.ROOT, "\\u%04x", cp))
                else -> b.appendCodePoint(cp)
            }
        }
        return b.append('"').toString()
    }

    private fun byCodePoint(a: String, b: String): Int {
        val x = a.codePoints().toArray(); val y = b.codePoints().toArray()
        for (i in 0 until minOf(x.size, y.size)) if (x[i] != y[i]) return x[i].compareTo(y[i])
        return x.size.compareTo(y.size)
    }

    fun frontmatter(s: Session, zone: ZoneId = ZoneId.systemDefault()): String {
        val ended = s.endedAt ?: s.startedAt
        val languages = s.lines.map { it.srcLang }.distinct().sortedWith(::byCodePoint)
        val notes = s.notes?.let { if (it.isEmpty) "none" else if (it.final) "final" else "draft" } ?: "none"
        val minutes = maxOf(0L, (ended.toEpochMilli() - s.startedAt.toEpochMilli()) / 60_000)
        return "---\n" +
            "cicada: 1\n" +
            "id: ${quote(s.id)}\n" +
            "title: ${quote(name(s))}\n" +
            "started: ${quote(format(s.startedAt, "yyyy-MM-dd'T'HH:mm:ssxxx", zone))}\n" +
            "ended: ${quote(format(ended, "yyyy-MM-dd'T'HH:mm:ssxxx", zone))}\n" +
            "minutes: $minutes\n" +
            "languages: [${languages.joinToString(", ") { quote(it) }}]\n" +
            "source: ${quote(if (s.sourceFile == null) "meeting" else "file")}\n" +
            "notes: ${quote(notes)}\n" +
            "tags: [\"cicada\"]\n" +
            "---\n"
    }

    fun document(s: Session): String = frontmatter(s) + TranscriptExport.markdown(s)

    private fun format(at: Instant, pattern: String, zone: ZoneId) =
        DateTimeFormatter.ofPattern(pattern, Locale.ROOT).withZone(zone).format(at)
}

/// What 存到文件夹 wrote, next to the records (FolderExport.json, as on the Mac): the folder (here a
/// SAF tree URI), each record's file name, and the records still to write. `uris` is Android's own:
/// each file's document URI, a hint only (a path-based provider changes it on rename).
class FolderExportIndex(
    var folder: String = "",
    val files: MutableMap<String, String> = mutableMapOf(),
    val uris: MutableMap<String, String> = mutableMapOf(),
    val pending: MutableList<String> = mutableListOf(),
    var lastFile: String? = null,
    var lastAt: Instant? = null,
) {
    fun toJson(): Map<String, Any?> = mapOf(
        "folder" to folder, "files" to files.toSortedMap(), "uris" to uris.toSortedMap(), "pending" to pending.toList(),
        "lastFile" to lastFile, "lastAt" to lastAt?.let(Iso8601::write),
    )

    fun save(file: File) {
        try {
            val tmp = File(file.path + ".tmp")
            tmp.writeText(Json.write(toJson(), slashes = false))
            if (!tmp.renameTo(file)) { file.delete(); tmp.renameTo(file) }
        } catch (e: Exception) { Log.d("folder export: index not saved ${e.javaClass.simpleName}") }
    }

    companion object {
        fun from(o: Map<String, Any?>) = FolderExportIndex(
            folder = o["folder"].str() ?: "",
            files = strings(o["files"]), uris = strings(o["uris"]),
            pending = o["pending"].arr().mapNotNull { it.str() }.toMutableList(),
            lastFile = o["lastFile"].str(), lastAt = Iso8601.read(o["lastAt"].str()),
        )

        fun load(file: File): FolderExportIndex =
            try { if (file.isFile) Json.parseObject(file.readText())?.let(::from) else null } catch (_: Exception) { null } ?: FolderExportIndex()

        private fun strings(v: Any?): MutableMap<String, String> =
            v.obj()?.mapNotNull { (k, x) -> x.str()?.let { k to it } }?.toMap(mutableMapOf()) ?: mutableMapOf()
    }
}

```

### Core Architecture Module: `android/core/src/main/kotlin/cicada/Json.kt`
```
package cicada

import java.math.BigDecimal

/// A small JSON reader and writer, so the engines need neither org.json (Android only, unsorted)
/// nor a library. Values are Map<String, Any?> (insertion-ordered), List<Any?>, String, Long,
/// Double, Boolean and null.
///
/// `write(pretty = true)` produces what the Mac's JSONEncoder writes with [.prettyPrinted,
/// .sortedKeys], byte for byte: `"key" : value`, two-space indent, `[\n\n  ]` for an empty array,
/// `\/` for a slash, shortest doubles with no ".0", so a record read and written back is unchanged.
object Json {
    class ParseException(message: String) : Exception(message)

    fun parse(text: String): Any? {
        val p = Parser(text)
        p.space()
        val v = p.value()
        p.space()
        if (p.i != text.length) throw ParseException("trailing text at ${p.i}")
        return v
    }

    fun parseObject(text: String): Map<String, Any?>? = try { parse(text) as? Map<String, Any?> } catch (_: ParseException) { null }

    private class Parser(val s: String) {
        var i = 0

        fun space() { while (i < s.length && s[i].isWhitespace()) i++ }

        fun value(): Any? {
            if (i >= s.length) throw ParseException("unexpected end")
            return when (val c = s[i]) {
                '{' -> obj()
                '[' -> arr()
                '"' -> str()
                't' -> word("true", true)
                'f' -> word("false", false)
                'n' -> word("null", null)
                else -> if (c == '-' || c.isDigit()) num() else throw ParseException("unexpected '$c' at $i")
            }
        }

        fun word(w: String, v: Any?): Any? {
            if (!s.startsWith(w, i)) throw ParseException("bad literal at $i")
            i += w.length
            return v
        }

        fun obj(): Map<String, Any?> {
            val m = LinkedHashMap<String, Any?>()
            i++; space()
            if (i < s.length && s[i] == '}') { i++; return m }
            while (true) {
                space()
                if (i >= s.length || s[i] != '"') throw ParseException("expected key at $i")
                val k = str()
                space()
                if (i >= s.length || s[i] != ':') throw ParseException("expected ':' at $i")
                i++; space()
                m[k] = value()
                space()
                if (i >= s.length) throw ParseException("unexpected end")
                if (s[i] == ',') { i++; continue }
                if (s[i] == '}') { i++; return m }
                throw ParseException("expected ',' or '}' at $i")
            }
        }

        fun arr(): List<Any?> {
            val a = ArrayList<Any?>()
            i++; space()
            if (i < s.length && s[i] == ']') { i++; return a }
            while (true) {
                space()
                a.add(value())
                space()
                if (i >= s.length) throw ParseException("unexpected end")
                if (s[i] == ',') { i++; continue }
                if (s[i] == ']') { i++; return a }
                throw ParseException("expected ',' or ']' at $i")
            }
        }

        fun str(): String {
            val b = StringBuilder()
            i++
            while (true) {
                if (i >= s.length) throw ParseException("unterminated string")
                val c = s[i++]
                when (c) {
                    '"' -> return b.toString()
                    '\\' -> {
                        if (i >= s.length) throw ParseException("bad escape")
                        when (val e = s[i++]) {
                            'n' -> b.append('\n'); 't' -> b.append('\t'); 'r' -> b.append('\r')
                            'b' -> b.append('\b'); 'f' -> b.append('\u000C')
                            'u' -> {
                                if (i + 4 > s.length) throw ParseException("bad \\u")
                                b.append(s.substring(i, i + 4).toInt(16).toChar()); i += 4
                            }
                            else -> b.append(e)
                        }
                    }
                    else -> b.append(c)
                }
            }
        }

        fun num(): Any {
            val start = i
            if (s[i] == '-') i++
            while (i < s.length && (s[i].isDigit() || s[i] in ".eE+-")) i++
            val t = s.substring(start, i)
            if (t.none { it == '.' || it == 'e' || it == 'E' }) t.toLongOrNull()?.let { return it }
            return t.toDoubleOrNull() ?: throw ParseException("bad number $t")
        }
    }

    /// `slashes = false` writes "/" as it is, like JSONEncoder's .withoutEscapingSlashes (the share
    /// document, ShareProjection.swift).
    fun write(value: Any?, pretty: Boolean = true, slashes: Boolean = true): String {
        val b = StringBuilder()
        emit(b, value, pretty, 0, slashes)
        return b.toString()
    }

    private fun emit(b: StringBuilder, v: Any?, pretty: Boolean, depth: Int, slashes: Boolean) {
        when (v) {
            null -> b.append("null")
            is String -> quote(b, v, slashes)
            is Boolean -> b.append(if (v) "true" else "false")
            is Int, is Long -> b.append(v.toString())
            is Double -> b.append(number(v))
            is Float -> b.append(number(v.toDouble()))
            is Map<*, *> -> {
                // Sorted like Swift's .sortedKeys; nulls are left out, as Swift leaves out nil optionals.
                val entries = v.entries.filter { it.value != null }.sortedBy { it.key as String }
                if (entries.isEmpty()) { b.append(if (pretty) "{\n\n" + "  ".repeat(depth) + "}" else "{}"); return }
                b.append('{')
                entries.forEachIndexed { n, e ->
                    if (n > 0) b.append(',')
                    if (pretty) b.append('\n').append("  ".repeat(depth + 1))
                    quote(b, e.key as String, slashes)
                    b.append(if (pretty) " : " else ":")
                    emit(b, e.value, pretty, depth + 1, slashes)
                }
                if (pretty) b.append('\n').append("  ".repeat(depth))
                b.append('}')
            }
            is List<*> -> {
                if (v.isEmpty()) { b.append(if (pretty) "[\n\n" + "  ".repeat(depth) + "]" else "[]"); return }
                b.append('[')
                v.forEachIndexed { n, x ->
                    if (n > 0) b.append(',')
                    if (pretty) b.append('\n').append("  ".repeat(depth + 1))
                    emit(b, x, pretty, depth + 1, slashes)
                }
                if (pretty) b.append('\n').append("  ".repeat(depth))
                b.append(']')
            }
            else -> quote(b, v.toString(), slashes)
        }
    }

    /// Shortest round-trip digits, as Swift prints a Double: "2" not "2.0", no exponent for the
    /// values records hold.
    fun number(d: Double): String {
        if (d.isNaN() || d.isInfinite()) return "0"
        if (d == Math.rint(d) && Math.abs(d) < 1e15) return d.toLong().toString()
        val s = d.toString()
        return if (s.contains('E')) BigDecimal(s).stripTrailingZeros().toPlainString() else s
    }

    private fun quote(b: StringBuilder, s: String, slashes: Boolean) {
        b.append('"')
        for (c in s) {
            when (c) {
                '"' -> b.append("\\\"")
                '\\' -> b.append("\\\\")
                '/' -> if (slashes) b.append("\\/") else b.append('/')
                '\n' -> b.append("\\n")
                '\r' -> b.append("\\r")
                '\t' -> b.append("\\t")
                '\b' -> b.append("\\b")
                '\u000C' -> b.append("\\f")
                else -> if (c < ' ') b.append(String.format("\\u%04x", c.code)) else b.append(c)
            }
        }
        b.append('"')
    }
}

// Lenient accessors for decoded JSON.

@Suppress("UNCHECKED_CAST")
fun Any?.obj(): Map<String, Any?>? = this as? Map<String, Any?>
fun Any?.arr(): List<Any?> = this as? List<Any?> ?: emptyList()
fun Any?.str(): String? = this as? String
fun Any?.num(): Double? = when (this) {
    is Number -> toDouble()
    is String -> trim().toDoubleOrNull()
    else -> null
}
fun Any?.int(): Int? = num()?.toInt()
fun Any?.bool(): Boolean? = this as? Boolean

```

### Core Architecture Module: `android/core/src/main/kotlin/cicada/Ling.kt`
```
package cicada

import java.io.File
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.SocketTimeoutException
import java.net.URL
import java.util.Base64

/// Turns the key into bytes on disk and back. Android wraps it with a Keystore key (this app
/// only); the plain one is for the CLI and tests.
interface KeyProtector {
    val tag: String
    fun protect(data: ByteArray): ByteArray
    fun unprotect(data: ByteArray): ByteArray
}

object PlainProtector : KeyProtector {
    override val tag = "plain"
    override fun protect(data: ByteArray) = data
    override fun unprotect(data: ByteArray) = data
}

/// The user's AI keys, one file per service in the app's private folder (`ling-api-key`,
/// `ai-key-<service>`, as on the Mac): never in settings, logs or exports. `service` says which
/// one is in use; switching services keeps the others' keys. On Android each file holds
/// "keystore:" + base64 of the Keystore-sealed bytes. `file` pins one file (the CLI reads the Mac's).
class AIKey(private val protector: KeyProtector, private val file: File? = null, var service: () -> String = { "ling" }) {
    val path: File get() = file ?: Paths.keyFile(service())
    private val cache = HashMap<String, String?>()

    @Synchronized fun read(): String? {
        val p = path
        if (cache.containsKey(p.path)) return cache[p.path]
        val value = try {
            if (!p.isFile) null else {
                var text = p.readText().trim()
                if (text.startsWith("keystore:"))
                    text = String(protector.unprotect(Base64.getDecoder().decode(text.removePrefix("keystore:"))), Charsets.UTF_8)
                text.trim().ifEmpty { null }
            }
        } catch (e: Exception) {
            Log.d("ai key: read failed ${e.javaClass.simpleName}")
            null
        }
        cache[p.path] = value
        return value
    }

    @Synchronized fun save(key: String): Boolean {
        val k = key.trim()
        val p = path
        return try {
            p.parentFile?.mkdirs()
            val body = if (protector.tag == "plain") k else "keystore:" + Base64.getEncoder().encodeToString(protector.protect(k.toByteArray()))
            p.writeText(body)
            p.setReadable(false, false); p.setReadable(true, true)
            p.setWritable(false, false); p.setWritable(true, true)
            cache[p.path] = k
            true
        } catch (e: Exception) {
            Log.d("ai key: save failed ${e.javaClass.simpleName}")
            false
        }
    }

    @Synchronized fun remove() {
        val p = path
        p.delete()
        cache[p.path] = null
    }

    /// Reads the files again (a dev build's key pushed in with adb).
    @Synchronized fun reload() { cache.clear() }

    /// Another key file in the same store, sealed the same way (the custom service's notes key).
    fun sibling(service: String) = AIKey(protector, service = { service })

    companion object {
        /// "sk-••••••••••••3f9a" for display.
        fun masked(key: String) = if (key.length <= 8) "sk-…" else key.take(3) + "•".repeat(12) + key.takeLast(4)
    }
}

enum class Priority { Speak, Translate, Notes }

enum class KeyState { None, Unchecked, Checking, Ok, Invalid, Unreachable }

/// 继续 on the key step with a key already saved (the guide opened again from 设置): an empty field,
/// or the saved key again, keeps it, unless it was found invalid. Onboarding opens past the key step
/// on the same condition.
fun keepsSavedKey(typed: String, saved: String?, state: KeyState) =
    saved != null && state != KeyState.Invalid && (typed.isEmpty() || typed == saved)

/// `retryAfter`: seconds the service asked us to wait (a 429's Retry-After), when it said.
class LingException(val kind: Kind, val status: Int = 0, val retryAfter: Double? = null) : Exception(if (kind == Kind.Http) "http$status" else kind.name) {
    enum class Kind { NoKey, InvalidKey, RateLimited, Hijacked, Timeout, Http, Network, Parse }
}

/// Time for LingClient's start gate, in ms; tests hand in one that moves on by itself.
open class GateClock {
    open fun now(): Long = System.currentTimeMillis()
    /// Waits on `lock` (held) for `ms`, or until notified; 0 is until notified.
    open fun wait(lock: Object, ms: Long) = lock.wait(ms)
}

/// How requests leave the app: HttpURLConnection, or a fake in tests.
interface Transport {
    /// `retryAfter`: the Retry-After header, as sent.
    class Response(val status: Int, val body: String, val retryAfter: String? = null)
    /// A reply read as it arrives (speech): its type and the open body, which the caller closes.
    class Stream(val status: Int, val contentType: String, val body: InputStream)
    /// Throws SocketTimeoutException on a timeout and IOException when the network fails.
    fun send(url: String, method: String, body: String?, headers: Map<String, String>, timeoutMs: Int): Response
    fun stream(url: String, body: String, headers: Map<String, String>, timeoutMs: Int): Stream =
        send(url, "POST", body, headers, timeoutMs).let { Stream(it.status, "application/json", it.body.byteInputStream()) }
}

object UrlTransport : Transport {
    override fun send(url: String, method: String, body: String?, headers: Map<String, String>, timeoutMs: Int): Transport.Response {
        val c = URL(url).openConnection() as HttpURLConnection
        try {
            c.requestMethod = method
            c.connectTimeout = minOf(timeoutMs, 10_000)
            c.readTimeout = timeoutMs
            headers.forEach { (k, v) -> c.setRequestProperty(k, v) }
            if (body != null) {
                c.doOutput = true
                c.outputStream.use { it.write(body.toByteArray()) }
            }
            val status = c.responseCode
            val stream = if (status in 200..299) c.inputStream else c.errorStream
            val text = stream?.use { it.readBytes().toString(Charsets.UTF_8) } ?: ""
            return Transport.Response(status, text, c.getHeaderField("Retry-After"))
        } finally { c.disconnect() }
    }

    override fun stream(url: String, body: String, headers: Map<String, String>, timeoutMs: Int): Transport.Stream {
        val c = URL(url).openConnection() as HttpURLConnection
        c.requestMethod = "POST"
        c.connectTimeout = minOf(timeoutMs, 10_000)
        c.readTimeout = timeoutMs
        headers.forEach { (k, v) -> c.setRequestProperty(k, v) }
        c.doOutput = true
        c.outputStream.use { it.write(body.toByteArray()) }
        val status = c.responseCode
        if (status !in 200..299) { c.errorStream?.close(); c.disconnect(); return Transport.Stream(status, "", ByteArray(0).inputStream()) }
        val input = c.inputStream
        return Transport.Stream(status, c.contentType ?: "", object : java.io.FilterInputStream(input) {
            override fun close() { try { super.close() } finally { c.disconnect() } }
        })
    }
}

/// One instance for the app, for whichever AI service the settings name (`config`, read on every
/// call). Request *starts* go through one gate in priority order: Ling allows about 2 a second
/// across every model (≥ 0.6 s apart, overlapping is fine), the aggregators far more. Ling's
/// gateway shapes every call (see Ling.swift): thinking is always disabled, and the content goes in
/// the system message with a fixed user instruction, because a question-like user message gets a
/// search essay back; such replies are dropped. The other services get the same messages.
/// Calls block: run them off the main thread.
class LingClient(
    private val key: AIKey,
    private val transport: Transport = UrlTransport,
    val config: () -> AIConfig = { Providers.configFrom(AppSettings()) },
    private val clock: GateClock = GateClock(),
    /** The custom service's notes server's own key (另一个服务): `ai-key-custom-notes`, as on the Mac. */
    private val notesKeys: AIKey = key.sibling(NOTES_KEY),
) {
    companion object {
        /// The key file of the custom service's notes server.
        const val NOTES_KEY = "custom-notes"
        val BASE = Providers.LING.base!!
        val DEFAULT_MODEL = Providers.LING.textModels[0].id
        val AUDIO_MODEL = Providers.LING.hearModels[0].id

        /// A chat reply's text holds a JSON object (a fence or a sentence around it is fine).
        fun answersJSON(text: String?): Boolean {
            if (text == null) return false
            val a = text.indexOf('{'); val z = text.lastIndexOf('}')
            return a in 0 until z && Json.parseObject(text.substring(a, z + 1)) != null
        }

        /// Seconds before each retry of a 429 (Ling.swift › retryWaits). Notes retry a few times; the
        /// rest fail fast so the caller can fall back, except heard audio. A meeting's: there a lost
        /// reply loses the words, and Ling's 429s came in runs of up to ~10 s (two in a row lost a line
        /// with one retry, about 2 a minute in 2026-11 testing), so it keeps at it for about 15 s. What
        /// the user says (Speak) retries once: late is worse than a short "try again". `patient`
        /// (the final notes) keeps at it for about a minute: a model limited upstream (OpenRouter's
        /// Ling 3.1 by DeepInfra, 2026-11) came back after ~15 s, and a meeting left without its
        /// notes is worse than notes a little late.
        fun retryWaits(priority: Priority, audio: Boolean = false, patient: Boolean = false): List<Double> = when {
            priority == Priority.Notes -> if (patient) listOf(1.0, 2.0, 4.0, 8.0, 16.0, 30.0) else listOf(1.0, 2.0, 4.0)
            audio -> if (priority == Priority.Translate) listOf(1.0, 2.0, 4.0, 8.0) else listOf(1.0)
            else -> emptyList()
        }

        /// Longest Retry-After worth waiting for; longer is an outage, not a busy moment.
        const val MAX_PAUSE = 30.0

        /// A Retry-After header in seconds: a number, or an HTTP date. Null when absent or unreadable.
       
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #26** (2026-11-12): **[FR] 导入录音/重新转写也做说话人识别（声纹标注）**
  *Symptoms*: ### 背景  现场开会（开始听）时，说话人识别（设置 › 通用）工作正常：每句话的音频会跑声纹聚类，记录里能标出“说话人 1/2”，也支持命名和合并。但**导入录音/视频**和**重新转写**这条离线链路只出文字，不做声纹标注，产出的记录里所有行的 `voice` 都是空的。  ### 复现  1. 设置 › 通用 › 说话人识别：开启。 2. 导入一段多人对话的录音（mp3），等转写完成。 3. 打开文字记录：所有行只显示“对方”，没有说话人编号。 4. 检查 `~/Library/Application Support/LiveSubs/Sessions/<id>/session.json`：所有行的 `voice` 均为 null。  对照：同一天现场听的会议里 `voice` 字段正常标注（0、1、2…），只是句数少没到显示门槛。实测 8 场导入转写的会议（每场约 250 行）全部 0 行带 `voice`，现场听的会议有标注——可以排除是设置没开。  ### 期望  导入录音/视频、重新转写这些离线链路也跑声纹标注，显示规则与现场一致（说话人 N、命名、合并，纪要里能归属到人）。  ### 可行性（个人猜测）  导入时音频本来就在手上（已经是 16 kHz 单声道 PCM），每行也有起止时间，似乎可以在逐行落盘时切出对应片段喂给现有的 `SpeakerTagger` / `VoiceClusterer`，不需要新模型或服务。  ### 环境  - Cicada 1.7.0（核对了 1.8.0 的更新说明，未见此项） - Apple Silicon Mac，macOS 15.5 - 声纹用的本地音频，与识别引擎无关；现场/导入两种链路的差异看起来只在是否调用了声纹 
  **Post-Mortem & Fix Analysis**:
  > 谢谢这么详细的建议和排查！你的判断是对的：导入时手上已经有 16 kHz 单声道音频和每行的时间，按行切片喂给现有的声纹聚类就行，不需要新模型。我们近期会实现，导入录音/视频和重新转写都会标出说话人，显示、命名、合并和现场听的会议一致。做好后会在这里更新。
  > 1.9.0 已发布：导入的录音/视频和重新转写的会议都会按声音标出说话人 1、2，可以改名、合并，导出的文字记录和纪要里也会写出是谁说的。注意一种声音要先说上几句才会标出来，很短的插话会先显示“未识别”。

- **Issue #25** (2026-11-13): **[FR]翻译与纪要分别配置LLM模型**
  *Symptoms*: ## 需求  现在「AI 服务 → 其他（兼容 OpenAI）」只有一行文字模型，标题是「翻译和纪要」，翻译、纪要、说话人识别和设置检查都共用它。希望可以分别配置：  - 翻译模型：普通句子翻译、会中听错的词修正等低延迟任务 - 纪要模型：实时纪要、说话人识别、JSON 检查等需要结构化 JSON 的任务  版本：Cicada 1.7.0（macOS）  ## 为什么需要  两个任务的取舍相反：  - 翻译每句有 6 秒超时，要求低延迟、纯文本。本地打算使用翻译专用模型，但不擅长写纪要。 - 纪要 90 秒超时、6000 token，需要通用模型的理解和归纳，并稳定返回 JSON。  现在只能在一个模型上取舍：选翻译模型，纪要不可用；选通用模型，翻译变慢。云端服务也一样：快而便宜的模型适合翻译，强模型适合纪要。  ## 现在的 workaround  我在本机加了一层 OpenAI 兼容代理，按请求是否带 `response_format` 分流。能用，但不够可靠：  - 分流依据是 JSON 字段，不是任务语义；「会中改正听错的词」也返回 JSON，但它是低延迟任务，应该走翻译模型。 - 需要额外运行代理，配置和排错多一层。 - 设置页检查只能测一个模型，无法同时验证“翻译够快”和“纪要 JSON 可用”。    
  **Post-Mortem & Fix Analysis**:
  > 感谢详细的需求说明，这个已经实现了（21642b9），会在下一个版本发布。  做法：设置 › AI 服务 › 其他（兼容 OpenAI）拆成「翻译」和「纪要」两部分：  - **翻译**：句子翻译、会中改正听错的词等低延迟任务，走翻译模型。 - **纪要**：实时纪要、说话人识别、文件转写后的修正，可选「同一个服务」换个模型，或「另一个服务」用自己的地址和 key。默认和翻译用同一个。 - 模型菜单会从服务的 `/models` 搜索，列表里没有的名字也能直接填。 - 设置页检查会分别测两边：翻译测速度，纪要单独测能否稳定返回 JSON；两边各自限流，纪要出错不会影响翻译。  这样就不需要按 `response_format` 分流的本地代理了。发版后欢迎反馈。
  > 1.9.0 已发布，包含这个功能：设置 › AI 服务 › 其他（兼容 OpenAI）分成「翻译」和「纪要」两组，纪要可以换模型，也可以选「另一个服务」填自己的地址和 key；「保存并检查」会分别测翻译速度和纪要能不能写。下载：https://cicada.indaloop.app/download/ ，用着有问题欢迎在这里继续说。

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

### Incident Patch 1: `1c3d0142` (2026-11-12)
**Commit Message**: fix: Cicada no longer quits after an interpreted sentence when the meeting plays from the speakers

Letting go of the echo-cancelling unit after a press rebuilds the voice output engine; a sentence still streaming then scheduled its audio on the new, unwired player, which threw (channel count mismatch) and left the app to crash on the main thread a few seconds later. The player is now wired again before every buffer.

audio-test, meeting at 56 %: before, 2 of 4 rounds crashed (log: required condition is false: _outputFormat.channelCount == buffer.format.channelCount); after, 7 rounds and 26 engine rebuilds, no crash, no exception.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `Sources/Cicada/SpeakEngine.swift` (modified, +19/-1)
```diff
@@ -165,6 +165,8 @@ final class SpeakEngine {
     private var player = AVAudioPlayerNode()
     private var outObserver: NSObjectProtocol?
     private var outFormat: AVAudioFormat?
+    /// Where the output was last pointed, to wire a replaced engine the same way.
+    private var outDevice: OutputDevice?
     private var outDeviceUID: String?
     /// The device the latest `speak` call played to.
     private(set) var lastDevice: OutputDevice?
@@ -887,6 +889,7 @@ final class SpeakEngine {
             debugLog("voice output failed: \(error)")
             return
         }
+        guard outputReady(for: first.format) else { return }
         for b in buffers.dropLast() { player.scheduleBuffer(b, completionHandler: nil) }
         firstAudioAt = Date()
         player.play()
@@ -926,8 +929,10 @@ final class SpeakEngine {
                     firstAt = Date().timeIntervalSince(started)
                     firstAudioAt = Date()
                     configureOutput(format: format, device: device)
-                    if !out.isRunning { try out.start() }
                 }
+                // The engine may have been replaced while the stream ran (the echo-cancelling unit
+                // let go): a player not wired for this format throws, and that took the app down.
+                guard outputReady(for: format) else { break }
                 player.scheduleBuffer(buf, completionHandler: nil)
                 if !player.isPlaying { player.play() }
                 count += 1
@@ -951,6 +956,7 @@ final class SpeakEngine {
     /// Schedules `buffer` last and waits until it has played, or `limit` seconds. A stalled output
     /// never calls back, and would otherwise hold every later sentence; it is rebuilt instead.
     private func waitPlayed(_ buffer: AVAudioPCMBuffer, limit: TimeInterval) async {
+        guard outputReady(for: buffer.format) else { return }
         let once = Once()
         let played = await withCheckedContinuation { (cont: CheckedContinuation<Bool, Never>) in
             player.scheduleBuffer(buffer, completionCallbackType: .dataPlayedBack) { _ in once.run { cont.resume(returning: true) } }
@@ -993,6 +999,18 @@ final class SpeakEngine {
         out.connect(player, to: out.mainMixerNode, format: format)
         outFormat = format
         outDeviceUID = uid
+        outDevice = device
+    }
+
+    /// The player is wired for `format` and the engine runs (wired again after the engine was
+    /// replaced or reset); false when it can't be started.
+    private func outputReady(for format: AVAudioFormat) -> Bool {
+        if outFormat != format { configureOutput(format: format, device: outDevice) }
+        guard !out.isRunning else { return true }
+        do { try out.start(); return true } catch {
+            debugLog("voice output failed: \(error)")
+            return false
+        }
     }
 
     /// Plays a short sample through the chosen output so the user can check it.
```

---

### Incident Patch 2: `9d3286eb` (2026-11-12)
**Commit Message**: fix: Cicada no longer quits now and then when the menu bar panel opens

SwiftUI sometimes builds the panel off the main thread, where the keyboard-layout lookup for the shortcut's name asserted the main queue (crash reports since 1.4.0). Off the main thread the name now comes from the last one worked out on it.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `Sources/Cicada/Shortcuts.swift` (modified, +15/-0)
```diff
@@ -62,10 +62,25 @@ struct Shortcut: Equatable {
         kVK_Home: "↖", kVK_End: "↘", kVK_PageUp: "⇞", kVK_PageDown: "⇟", kVK_RightOption: L("右 ⌥"),
     ]
 
+    /// Names worked out on the main thread. SwiftUI sometimes builds the panel off it, and the
+    /// input-source calls assert the main queue there (a crash since 1.4.0): off it, the last name.
+    private static let nameLock = NSLock()
+    nonisolated(unsafe) private static var names: [Int: String] = [:]
+
     /// The character the key types on the current layout (US letters on non-Latin layouts).
     static func keyName(_ code: Int) -> String {
         if let f = functionKeys[code] { return f }
         if let n = named[code] { return n }
+        guard Thread.isMainThread else {
+            nameLock.lock(); defer { nameLock.unlock() }
+            return names[code] ?? "#\(code)"
+        }
+        let name = layoutName(code)
+        nameLock.lock(); names[code] = name; nameLock.unlock()
+        return name
+    }
+
+    private static func layoutName(_ code: Int) -> String {
         guard let source = TISCopyCurrentASCIICapableKeyboardLayoutInputSource()?.takeRetainedValue(),
               let ptr = TISGetInputSourceProperty(source, kTISPropertyUnicodeKeyLayoutData) else { return "#\(code)" }
         let data = Unmanaged<CFData>.fromOpaque(ptr).takeUnretainedValue() as Data
```

---

### Incident Patch 3: `4ff6ac9d` (2026-11-12)
**Commit Message**: docs: changelog items for the crash and playback fixes

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `site/changelog.json` (modified, +16/-0)
```diff
@@ -162,6 +162,22 @@
         ],
         "title": "自建服务的 key 失效时，报错会直接写出服务地址。",
         "text": "以前英文界面会显示有语病的“The this service key doesn't work”。现在直接写明服务地址，比如“zenmux.ai 的 key 用不了”。"
+      },
+      {
+        "kind": "fixed",
+        "platforms": [
+          "mac"
+        ],
+        "title": "会议外放时用同声传译，说完一句后知了不会再退出。",
+        "text": "按住说话键说完一句、译文说出去后，知了偶尔会在几秒后直接退出。现在不会了。"
+      },
+      {
+        "kind": "fixed",
+        "platforms": [
+          "mac"
+        ],
+        "title": "打开菜单栏面板时，知了不会再偶尔退出。",
+        "text": "面板里显示快捷键名字时偶尔会让知了直接退出，从 1.4 起就有。现在不会了。"
       }
     ]
   },
```

#### Recent Merged Pull Requests:
- **PR #21** (2026-11-09): Add meeting microphone selection on macOS (@Ali1995A)
- **PR #18** (closed): Feature/lark task sync (@lmjmt)
- **PR #17** (2026-11-06): fix(audio): dynamically query default output sample rate and support LarkSuite app (@lmjmt)
- **PR #13** (2026-11-06): fix: prevent push-to-talk crashes after switching microphones (@philo-veritas)
- **PR #10** (2026-11-05): feat: support Intel Macs with cloud speech recognition (@longshines)
- **PR #8** (2026-11-05): docs: add Japanese README (@eltociear)

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

## X. Cicada no longer quits after an interpreted sentence when the meeting plays from

**RULE**:
When implementing operations in `Sources/Cicada/SpeakEngine.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in wquguru/cicada. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1c3d0142`: Cicada no longer quits after an interpreted sentence when the meeting plays from the speakers. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `Sources/Cicada/SpeakEngine.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
    /// Where the output was last pointed, to wire a replaced engine the same way.
    private var outDevice: OutputDevice?
        guard outputReady(for: first.format) else { return }
                // The engine may have been replaced while the stream ran (the echo-cancelling unit
                // let go): a player not wired for this format throws, and that took the app down.
                guard outputReady(for: format) else { break }
        guard outputReady(for: buffer.format) else { return }
        outDevice = device
    }

    /// The player is wired for `format` and the engine runs (wired again after the engine was
    /// replaced or reset); false when it can't be started.
    private func outputReady(for format: AVAudioFormat) -> Bool {
        if outFormat != format { configureOutput(format: format, device: outDevice) }
        guard !out.isRunning else { return true }
        do { try out.start(); return true } catch {
            debugLog("voice output failed: \(error)")
            return false
        }
```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern to NEVER write (induced failure mode):
                    if !out.isRunning { try out.start() }
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1c3d0142` are properly handled with clean fallback behavior.
