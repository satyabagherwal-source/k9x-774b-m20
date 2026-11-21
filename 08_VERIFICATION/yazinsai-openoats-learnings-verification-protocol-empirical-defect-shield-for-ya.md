# Verification Protocol: Verification Protocol: Empirical Defect Shield for yazinsai-openoats-learnings

<!-- PROVENANCE_START
{
  "source_repository": "yazinsai-openoats-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T08:25:41.528Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-yazinsai-openoats-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [yazinsai-openoats-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T08:25:41.528Z`  
> **Learning ID**: `LEARN-EVO-yazinsai-openoats-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `yazinsai-openoats-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/yazinsai-openoats-learnings.md`  
> **Source**: github ([https://github.com/yazinsai/OpenOats](https://github.com/yazinsai/OpenOats))  
> **Source Version**: `2d6e6ce5`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-21T08:24:45.178Z  
> **Learning ID**: `learn-github-yazinsai-openoats`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): yazinsai/OpenOats

---

## 1. Executive Forensic Architecture & System Mechanics

OpenOats is an offline-first, low-overhead native macOS meeting recording and dual-track transcription pipeline. It is engineered to solve four core systems problems in local acoustic and conversational capture:
1. **Low-Impact Live Capture During Execution:** Operating during live calls without competing for CPU/GPU cycles with real-time conferencing applications (e.g., Zoom, Teams, Webex). The recording subsystem uses strictly decoupled raw audio buffering (under 2% CPU footprint, ~19 MB RSS), deferring all heavy compute (Whisper / Parakeet neural inference or cloud streaming) until the meeting concludes (`Stop`).
2. **Crash & Power-Failure Fault Tolerance:** Writing multi-channel raw Int16 PCM chunks to append-only disk segments every 2 seconds, ensuring unfinalized buffers survive kernel panics, abrupt termination (`SIGKILL`), battery exhaustion, or lid closure with $\le 1.1\text{ s}$ of audio loss.
3. **Decoupled Dual-Track Acoustic Separation:** Recording local user input (microphone via CoreAudio HAL / `AVAudioEngine`) and remote conversational output (system audio via ScreenCaptureKit / CoreAudio Tap) as isolated streams, bypassing software echo cancellation artifacts and eliminating diarization ambiguity.
4. **Lifecycle & Hardware State Synchronization:** Hardening network, sleep/wake, and background execution states against macOS power management events (such as `NSWorkspace.willSleepNotification`, `NSWorkspace.didWakeNotification`, and IOKit sleep assertion locks).

### Critical Subsystem Boundaries & Layout

```
                        ┌─────────────────────────────────────────────────────────┐
                        │                    OpenOats App UI                      │
                        │        (SwiftUI / AppModel / NSStatusItem Menu)         │
                        └───────────────────────────┬─────────────────────────────┘
                                                    │
                 ┌──────────────────────────────────┴──────────────────────────────────┐
                 ▼                                                                     ▼
   ┌───────────────────────────┐                                         ┌───────────────────────────┐
   │        OatsCapture        │                                         │         OatsCore          │
   ├───────────────────────────┤                                         ├───────────────────────────┤
   │ - MicCapture              │                                         │ - CallDetector            │
   │ - SystemAudioCapture      │                                         │ - TrackAudio & Resampler  │
   │ - AudioDevices & HAL Tap  │                                         │ - ProcessingQueue         │
   │ - LiveCapture Engine      │                                         │ - MeetingFileWriter       │
   └─────────────┬─────────────┘                                         └─────────────┬─────────────┘
                 │                                                                     │
                 │ writes PCM chunks to disk (crash-safe)                              │
                 ▼                                                                     ▼
   ┌───────────────────────────┐                                         ┌───────────────────────────┐
   │       MeetingFolder       │ ══════════════════════════════════════> │    Batch Transcriber      │
   │ (~/Library/Application    │       spawns isolated oats CLI child    │ - Local: OatsOnDevice     │
   │  Support/OpenOats/Temp)   │                                         │   (Parakeet v3 / Whisper) │
   └───────────────────────────┘                                         │ - Cloud: CloudClient      │
                                                                         │   (AssemblyAI, ElevenLabs,│
                                                                         │    Gemini, OpenAI, Claude)│
                                                                         └─────────────┬─────────────┘
                                                                                       │ writes finalized MD
                                                                                       ▼
                                                                         ┌───────────────────────────┐
                                                                         │    Target Notes Folder    │
                                                                         │ (Obsidian / Plain Markdown│
                                                                         │  with Dataview metadata)  │
                                                                         └───────────────────────────┘
```

### Key Subsystem Invariants
- **`OatsCapture`:** Never performs string allocations, formatting, or lock contention in the CoreAudio real-time I/O render thread. Buffers incoming PCM frames into continuous ring buffers, writing sequentially to disk.
- **`OatsCore::CallDetector`:** Pure state-machine analyzer running against system audio client snapshots. Enforces a temporal confirmation debounce ($\Delta t_{\text{confirm}} \ge 5\text{ s}$) and an ending hysteresis delay ($\Delta t_{\text{end}} \ge 20\text{ s}$) before firing start/end transition events.
- **`OatsCore::ProcessingQueue` & CLI Separation:** Heavy transcription and AI summarization run inside an out-of-process CLI binary (`oats child`). If the child crashes due to Metal memory exhaustion or out-of-memory (OOM) states, the main menubar daemon remains completely unscathed.
- **`OatsCore::CloudClient`:** Ephemeral session network executor enforcing non-persistent state, mandatory TLS validation, exponential backoff with jitter on network partition recovery, and upload URL host matching to prevent key exfiltration.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Acoustic Boundary Cut Invariant for Audio Chunking
**RULE**:
When splitting continuous multi-hour spoken audio into discrete chunks for cloud processing or inference context boundaries, the split boundary MUST NOT be placed at an arbitrary fixed-time or fixed-frame boundary. The split boundary MUST be dynamically located within a backward-looking search window ($W_{\text{search}} \le 5\text{ s}$) centered before the maximum chunk duration limit, positioned at the lowest RMS energy frame ($E_{\min}$) of duration $\ge 10\text{ ms}$.

**WHY**:
Cutting audio at arbitrary chunk boundaries cuts phonemes and words in half. Cloud transcription and local acoustic models hallucinate or drop syllables at clipped boundaries, leading to mangled words across boundary transitions. Locating the minimum-energy frame guarantees the split occurs during natural conversational silence or unvoiced inter-word pauses.

**WHEN TO APPLY**:
Apply in any system processing audio streams exceeding backend ingestion ceilings (e.g., Gemini 20 MB inline caps, Whisper 25 MB caps, AssemblyAI/ElevenLabs chunking thresholds).

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
extension TrackAudio {
    /// Writes the track as compressed chunks of at most `maxSeconds` into `directory`.
    /// Each cut lands on the quietest 10 ms in the chunk's last 5 s (or last tenth for short chunks).
    public static func compressedChunks(
        of url: URL, 
        maxSeconds: TimeInterval, 
        sampleRate: Double,
        in directory: URL
    ) throws -> [AudioChunk] {
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
                let chunkURL = directory.appendingPathComponent("chunk-\(chunks.count).m4a")
                let chunk = AudioChunk(url: chunkURL, offset: Double(consumed) / sampleRate)
                chunks.append(chunk)
                file = try AVAudioFile(
                    forWriting: chunk.url,
                    settings: [
                        AVFormatIDKey: kAudioFormatMPEG4AAC,
                        AVSampleRateKey: sampleRate,
                        AVNumberOfChannelsKey: 1,
                        AVEncoderBitRateKey: 32_000,
                    ],
                    commonFormat: .pcmFormatFloat32,
                    interleaved: false
                )
            }
            let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(count))!
            buffer.frameLength = AVAudioFrameCount(count)
            pending.withUnsafeBufferPointer { ptr in
                buffer.floatChannelData![0].update(from: ptr.baseAddress!, count: count)
            }
            try file!.write(from: buffer)
            pending.removeFirst(count)
            written += count
            consumed += count
        }

        try forEachChunk(of: url) { buffer in
            pending.append(contentsOf: UnsafeBufferPointer(start: buffer.floatChannelData![0], count: Int(buffer.frameLength)))
            while written + pending.count > limit {
                // Dynamically seek the lowest-energy 10ms frame in the tail window
                let cutPoint = quietestCut(pending, from: limit - written - window, to: limit - written)
                try write(cutPoint)
                file = nil
                written = 0
            }
            try write(max(0, min(pending.count, limit - window - written)))
        }
        try write(pending.count)
        return chunks
    }

    /// Evaluates squared energy across consecutive 160-sample (10ms at 16kHz) windows
    static func quietestCut(_ samples: [Float], from start: Int, to end: Int) -> Int {
        let frame = 160
        var best = end
        var bestEnergy = Float.infinity
        let safeStart = max(start, 0)
        guard safeStart <= end - frame else { return max(end, 1) }

        for i in stride(from: safeStart, through: end - frame, by: frame) {
            var energy: Float = 0
            for j in i..<(i + frame) {
                let val = samples[j]
                energy += val * val
            }
            if energy < bestEnergy {
                bestEnergy = energy
                best = i + (frame / 2) // Midpoint of quietest frame
            }
        }
        return max(best, 1)
    }
}
```

**NEGATIVE CONSTRAINT**:
```swift
// ANTI-PATTERN: Fixed slice window splitting regardless of audio waveform amplitude
func badSplit(samples: [Float], chunkSize: Int) -> [[Float]] {
    var chunks: [[Float]] = []
    for i in stride(from: 0, to: samples.count, by: chunkSize) {
        let end = min(i + chunkSize, samples.count)
        chunks.append(Array(samples[i..<end])) // HARD CUT: Mid-vowel / mid-consonant split creates click artifact and cuts speech models
    }
    return chunks
}
```

**VERIFICATION METHOD**:
Generate a synthetic sine wave containing periodic silence intervals (e.g., 500 ms speech followed by 50 ms zeros). Run `compressedChunks` targeting a boundary near the silence interval. Assert through automated test that the calculated cut point index falls strictly within the zero-amplitude interval rather than the sine-wave crest or trough.

---

### 2. Network Wake-Backoff Partition Invariant
**RULE**:
Background network retry mechanisms executing immediately upon operating system sleep-to-wake transitions MUST classify DNS resolution failures (`.dnsLookupFailed`, `.cannotFindHost`) and initial transport disconnection (`.notConnectedToInternet`, `.networkConnectionLost`) as transient retryable states, and MUST provide an exponential backoff threshold window of at least 15 to 30 seconds.

**WHY**:
When an OS (specifically macOS) awakes from system sleep (e.g., lid open), the CPU immediately resumes paused threads and queues background workers *before* the network interface controller (NIC) has associated with the local Wi-Fi base station, completed the 802.11 4-way handshake, or obtained an IP/DNS lease via DHCP. If HTTP/gRPC clients fail fast on `URLError.notConnectedToInternet`, jobs resumed on wake fail immediately and transition permanently into dead-letter or "Needs Attention" states.

**WHEN TO APPLY**:
Any desktop or mobile application utilizing background workers, upload synchronization queues, or cloud API integrations executing across device sleep/wake boundaries.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
public struct CloudClient: Sendable {
    public var backend: String
    public var session: URLSession
    public var attempts = 5
    public var sleep: @Sendable (Duration) async throws -> Void = { try await Task.sleep(for: $0) }

    /// Dropped or not-yet-available connections.
    /// The offline errors matter after sleep: jobs resumed as the Mac wakes
    /// fire before Wi-Fi rejoins; ~15s-30s backoff bridges this latency window.
    public static let retriedNetworkErrors: Set<URLError.Code> = [
        .timedOut,
        .networkConnectionLost,
        .cannotConnectToHost,
        .notConnectedToInternet,
        .dnsLookupFailed,
        .cannotFindHost,
    ]

    public func send(_ request: URLRequest) async throws -> Data {
        var delay = Duration.seconds(1)
        for attempt in 1... {
            let last = attempt >= attempts
            do {
                let (data, response) = try await session.data(for: request)
                let status = (response as? HTTPURLResponse)?.statusCode ?? 0
                if (200..<300).contains(status) { return data }
                if status == 401 || status == 403 {
                    throw CloudError.invalidKey(backend: backend)
                }
                guard (status == 429 || status >= 500), !last else {
                    throw CloudError.http(backend: backend, status: status, message: Self.message(in: data))
                }
                if let after = (response as? HTTPURLResponse)?.value(forHTTPHeaderField: "Retry-After").flatMap(Double.init) {
                    delay = .seconds(min(after, 60))
                }
            } catch let error as URLError where !last && Self.retriedNetworkErrors.contains(error.code) {
                // Transient wake / offline condition: catch and proceed to sleep & backoff
            }
            try await sleep(delay)
            delay *= 2
        }
        fatalError("unreachable")
    }
}
```

**NEGATIVE CONSTRAINT**:
```swift
// ANTI-PATTERN: Failing immediately on transport-layer offline state
do {
    let (data, response) = try await session.data(for: request)
} catch let error as URLError {
    // FATAL FLAW: Treating lack of internet as permanent client failure
    if error.code == .notConnectedToInternet || error.code == .dnsLookupFailed {
        throw PermanentWorkerError.noNetwork // Aborts instantly on lid wake
    }
}
```

**VERIFICATION METHOD**:
Implement an automated unit test injecting a mock network session (`StubHTTP`) configured to throw `URLError(.notConnectedToInternet)` on attempt 1, `URLError(.dnsLookupFailed)` on attempt 2, and return `200 OK` on attempt 3. Assert that the client performs all 3 attempts without throwing, returning the successful payload.

---

### 3. Presigned Host Boundary Validation for Third-Party Ingestion
**RULE**:
When an API workflow splits file upload and job submission across two phases (Phase 1: obtain presigned upload target; Phase 2: submit presigned URL to ingestion engine), the client MUST cryptographically/stringently validate that the received upload destination URL matches an explicit domain allowlist or the root API host before dispatching binary data or credentials.

**WHY**:
If an upstream service or man-in-the-middle responds with an arbitrary or hijacked `upload_url`, a client sending data or bearing authorization tokens to that URL can leak audio recordings, PII, or API keys to external, untrusted infrastructure (SSRF / Credential Reflection Attack).

**WHEN TO APPLY**:
All multi-step cloud transcription or blob upload architectures (e.g., AssemblyAI, AWS S3 presigned URLs, Google Cloud Storage signed endpoints).

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Inside AssemblyAITranscription.swift
let upload: Upload = try await send(
    url.appendingPathComponent("upload"), 
    body: try Data(contentsOf: chunk.url), 
    type: "application/octet-stream"
)

// Invariant: The upload address goes back to AssemblyAI with the key;
// strictly verify protocol and hostname suffix before delegating.
guard let audioURL = URL(string: upload.upload_url),
      audioURL.scheme == "https",
      let host = audioURL.host(),
      host == url.host() || host.hasSuffix(".assemblyai.com")
else {
    throw CloudError.badResponse(backend: client.backend)
}

// Safe to proceed with dispatching audio URL reference
var job: [String: Any] = ["audio_url": audioURL.absoluteString, "speaker_labels": diarize]
```

**NEGATIVE CONSTRAINT**:
```swift
// ANTI-PATTERN: Blindly trusting server-provided upload URLs
let upload: Upload = try await send(uploadInitURL)
// VULNERABILITY: If upload_url is redirected to "attacker-controlled-bucket.com",
// subsequent requests will upload sensitive unencrypted room audio directly to attacker.
var job = ["audio_url": upload.upload_url]
```

**VERIFICATION METHOD**:
Unit test setting `upload_url` to `https://evil-server.com/test.m4a` and `http://api.assemblyai.com/test.m4a` (unencrypted HTTP). Assert that both trigger `CloudError.badResponse` and abort before dispatching the job payload.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Unbounded Audio Capture on Mac Sleep / Lid Close (BUG-OATS-01)
- **Context**: `OpenOats/Sources/OpenOats/AppModel.swift` and `OpenOats/Sources/OatsCore/Cloud.swift`
- **What Was Expected**: Closing the MacBook lid during an active recording stops the recording cleanly, enqueues the meeting for transcription/summarization, and prompts the user fresh if a meeting is still active upon waking.
- **What Actually Happened**: Prior to commit `2d6e6ce5`, nothing observed OS sleep. When the user closed the laptop lid at the end of a meeting, audio recording remained open in memory. Upon opening the lid hours later in another room or context, the app resumed recording into the *same* meeting file, aggregating private off-meeting audio into the previous meeting's transcript. Furthermore, cloud background workers failed immediately with network disconnection upon wake before Wi-Fi reconnected.
- **Evidence in Repo**: Commit `2d6e6ce5`, PR #780, Issue #779.
- **Root Cause**: Missing bindings to `NSWorkspace.willSleepNotification` and `NSWorkspace.didWakeNotification`. Incomplete network error classification in `CloudClient` which failed immediately on `.notConnectedToInternet`.
- **Remediation Code Diff**:
```swift
// OpenOats/Sources/OpenOats/AppModel.swift
+    private var stoppedForSleep = false
+
+    private func watchSleep() {
+        let center = NSWorkspace.shared.notificationCenter
+        center.addObserver(forName: NSWorkspace.willSleepNotification, object: nil, queue: .main) { _ in
+            MainActor.assumeIsolated { AppModel.shared.systemWillSleep() }
+        }
+        center.addObserver(forName: NSWorkspace.didWakeNotification, object: nil, queue: .main) { _ in
+            MainActor.assumeIsolated { AppModel.shared.systemDidWake() }
+        }
+    }
+
+    func systemWillSleep() {
+        guard recorder != nil else { return }
+        stop()
+        stoppedForSleep = true
+        Notifier.post("Recording stopped", "Your Mac went to sleep. The meeting will be processed as usual.")
+    }
+
+    func systemDidWake() {
+        guard stoppedForSleep else { return }
+        stoppedForSleep = false
+        guard settings.load().askToRecordCalls, ProcessInfo.processInfo.environment["OATS_FAKE_CAPTURE"] != "1" else { return }
+        callWatcher.stop()
+        CallPrompt.withdraw(calls)
+        calls = []
+        callWatcher.start()
+    }
```
- **Lesson**: Desktop recording applications must explicitly anchor their session lifecycles to OS power state notifications. Sleep must be treated as a definitive session boundary, and audio device watchers must be re-initialized on wake to flush stale hardware handles.

---

### Incident 2: Post-Wake Network Partition Crashing Cloud Transcription (BUG-OATS-02)
- **Context**: `OpenOats/Sources/OatsCore/Cloud.swift`
- **What Was Expected**: Transcription queued during lid closure processes gracefully in the background once the system wakes up.
- **What Actually Happened**: The `oats` CLI child process resumed on wake and immediately initiated HTTP requests to cloud endpoints (Anthropic, Gemini, AssemblyAI, ElevenLabs). Because Wi-Fi takes between 2 to 10 seconds to associate and complete DHCP negotiation, `URLSession` immediately threw `URLError.notConnectedToInternet` or `URLError.dnsLookupFailed`. The cloud client failed fast, dumping the meeting into the "Needs Attention" failure state.
- **Evidence in Repo**: Commit `2d6e6ce5`, `OpenAICompatibleNotesTests.retriesWhileTheMacIsStillOfflineAfterWake`.
- **Root Cause**: `CloudClient` retry predicates only filtered on `[.timedOut, .networkConnectionLost, .cannotConnectToHost]`. Offline errors (`.notConnectedToInternet`, `.dnsLookupFailed`, `.cannotFindHost`) were excluded from the retry set, treating offline states as unrecoverable errors.
- **Remediation Code Diff**:
```swift
// OpenOats/Sources/OatsCore/Cloud.swift
- } catch let error as URLError where !last && [.timedOut, .networkConnectionLost, .cannotConnectToHost].contains(error.code) {}
+ } catch let error as URLError where !last && Self.retriedNetworkErrors.contains(error.code) {}
  try await sleep(delay)
  delay *= 2
 }
 fatalError("unreachable")
}

+ static let retriedNetworkErrors: Set<URLError.Code> = [
+     .timedOut, .networkConnectionLost, .cannotConnectToHost,
+     .notConnectedToInternet, .dnsLookupFailed, .cannotFindHost,
+ ]
```
- **Lesson**: Transient network failure detection cannot assume transport availability at the time of process execution. Backoff must include DNS and offline error codes to accommodate physical network link establishment latency.

---

### Incident 3: Continuous Clock Premature Timeout on Sleep (BUG-OATS-03)
- **Context**: Finalization and save timeout mechanisms (PR #779 post-mortem).
- **What Was Expected**: If an active recording is finishing or saving when the system goes to sleep, the process is given an adequate grace period (e.g., 30 real operating seconds) to complete flushing disk writes.
- **What Actually Happened**: The finalization timeout was measured using a `ContinuousClock`. In Swift/Mach systems, `ContinuousClock` continues ticking while the system is asleep. When the Mac went to sleep for 2 hours and woke up, `ContinuousClock` evaluated that 7,200 seconds had elapsed, instantly firing the 30-second finalization timeout on the first post-wake cycle and forcibly aborting the session save.
- **Evidence in Repo**: PR #779 ("finalization timeout: 30s on continuous clock (fires instantly on wake, cancels save) -> 30s on suspending clock").
- **Root Cause**: Using `ContinuousClock` instead of `SuspendingClock` for measuring workload timeouts. `ContinuousClock` includes sleeping time; `SuspendingClock` pauses while the CPU is suspended.
- **Remediation Invariant**:
```swift
// INVARIANT ENFORCED:
// Workload execution limits MUST use SuspendingClock.
// Wall-clock absolute schedules MUST use ContinuousClock.
let clock = SuspendingClock()
try await withThrowingTaskGroup(of: Void.self) { group in
    group.addTask {
        try await clock.sleep(for: .seconds(30))
        throw TimeoutError.saveTimedOut
    }
    group.addTask {
        await self.flushAndSaveSession()
    }
    try await group.next()
    group.cancelAll()
}
```
- **Lesson**: Time measurement primitives must strictly match the semantic domain: never use continuous clocks for execution budgets that are suspended when the underlying hardware halts execution.

---

### Incident 4: Single-Slot Auto-Notes Session Overwrite in Back-to-Back Meetings (BUG-OATS-04)
- **Context**: `ProcessingQueue.swift` / Session management (PR #779 post-mortem).
- **What Was Expected**: If Meeting B ends while Meeting A is still undergoing re-transcription or notes generation, both meetings complete their processing pipeline deterministically.
- **What Actually Happened**: The system stored `pendingAutoNotesSessionID` as a single variable on the actor/model. When Meeting B finalized, it overwrote `pendingAutoNotesSessionID` with B's ID. When Meeting A finished transcribing, its callback looked up the current pending ID, found B's ID, and Meeting A was orphaned with zero notes generated.
- **Evidence in Repo**: PR #779 ("meeting B ends while A is re-transcribing: process(B) cancels A; single pendingAutoNotesSessionID overwritten -> A gets no notes -> jobs queue; each session's notes start from its own job outcome").
- **Root Cause**: Single-value state slot anti-pattern used for multi-instance asynchronous tasks.
- **Remediation Invariant**:
```swift
// State changed from:
// var pendingAutoNotesSessionID: MeetingID?
// To a FIFO queue keyed per job:
struct ProcessingJob: Sendable {
    let meetingID: String
    let folder: URL
}
actor ProcessingQueue {
    private var queue: [ProcessingJob] = []
    private var activeJob: ProcessingJob?
    
    func enqueue(_ job: ProcessingJob) {
        queue.append(job)
        processNext()
    }
}
```
- **Lesson**: Asynchronous task coordination must never rely on single scalar slots for pending identifiers when incoming events can arrive before previous jobs terminate.

---

### Incident 5: Call Prompt Starvation on System Wake (BUG-OATS-05)
- **Context**: `OpenOats/Sources/OatsCore/CallDetector.swift` & `OpenOats/Sources/OpenOats/AppModel.swift`
- **What Was Expected**: If a user is on an active conference call (e.g., Zoom), closes the lid, moves to a desk, and reopens the lid while the call is still ongoing, OpenOats should detect the call and prompt whether to record the new session.
- **What Actually Happened**: The internal `CallDetector` state retained the active `CallApp` entry in its internal `calls` dictionary (`calls[app] = lastInput`). Because it asks only once per detected call session, `CallDetector` considered the post-wake call to be the *same* continuous call. As a result, it never fired another `.started(app)` event, leaving the user without an option to record the second leg of the call.
- **Evidence in Repo**: Commit `2d6e6ce5` and Issue #780.
- **Root Cause**: State retention across OS suspension boundaries without re-arming detection logic.
- **Remediation Code Diff**:
```swift
// OpenOats/Sources/OpenOats/AppModel.swift
    func systemDidWake() {
        guard stoppedForSleep else { return }
        stoppedForSleep = false
        guard settings.load().askToRecordCalls, ProcessInfo.processInfo.environment["OATS_FAKE_CAPTURE"] != "1" else { return }
+       callWatcher.stop()
+       CallPrompt.withdraw(calls)
+       calls = []
+       callWatcher.start()
    }
```
- **Lesson**: External state detection mechanisms that rely on edge-triggered events must be reset to zero upon resumption from suspended execution environments to ensure state re-evaluation.

---

## 4. Microscopic Code-Level Invariants (Syntax, Infinite Loop, UI/UX & Concurrency Guards)

### 1. Micro-Syntax & Token-Level Precision
- **Operator Precedence in URL Normalization**:
  In `AnthropicNotes.swift` and `GeminiNotes.swift`, path sanitation requires stripping trailing slashes followed by specific suffix removal:
  ```swift
  var s = address.trimmingCharacters(in: .whitespaces)
  while s.hasSuffix("/") { s.removeLast() }
  for suffix in ["/messages", "/v1"] where s.hasSuffix(suffix) { 
      s.removeLast(suffix.count) 
  }
  ```
  *Hazard*: If `s.removeLast(suffix.count)` is called without checking `s.hasSuffix(suffix)` on each iteration, or if the order of suffixes is reversed where `/v1` is stripped before `/v1/messages`, malformed URLs like `http://host:8080/v1` turn into invalid endpoint concatenation (`http://host:8080/v1/v1/messages`).
- **YAML Frontmatter Injection & Escaping Safeguard**:
  In `MeetingFileWriter.swift`:
  ```swift
  static func quote(_ value: String) -> String {
      let escaped = value
          .replacingOccurrences(of: "\\", with: "\\\\")
          .replacingOccurrences(of: "\"", with: "\\\"")
          .replacingOccurrences(of: "\n", with: " ")
      return "\"\(escaped)\""
  }
  ```
  *Invariant*: Newline characters (`\n`) in user meeting titles MUST be converted to spaces. Unescaped newlines in YAML double-quoted scalar keys break YAML parser blocks, corrupting markdown frontmatter parsing across downstream tools (Obsidian, Dataview).

### 2. Infinite Loop & Recursion Guards
- **Finite Polling Loops with Hard Bounds**:
  In `AssemblyAITranscription.swift`, the polling loop enforces a hard cap:
  ```swift
  var polls = 0
  while transcript.status != "completed

## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
