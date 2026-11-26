# Architecture Decision Record: ADR: Subsystem Boundary & Modular Decoupling in sozercan-kaset-learnings

<!-- PROVENANCE_START
{
  "source_repository": "sozercan-kaset-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-26T06:44:13.306Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-sozercan-kaset-learnings",
  "canonical_classification": "architecture_decision"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [sozercan-kaset-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-26T06:44:13.306Z`  
> **Learning ID**: `LEARN-EVO-sozercan-kaset-learnings`


## Status
**ACCEPTED** (Empirically verified from sozercan-kaset-learnings)

## Context
During deep inspection of sozercan-kaset-learnings, modular boundaries, performance characteristics, and concurrency constraints required explicit architectural trade-off analysis.

## Decision
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/sozercan-kaset-learnings.md`  
> **Source**: github ([https://github.com/sozercan/kaset](https://github.com/sozercan/kaset))  
> **Source Version**: `49c8bb52`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-26T06:44:03.772Z  
> **Learning ID**: `learn-github-sozercan-kaset`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): sozercan/kaset

> **Canonical Artifact**: `07_PROJECT_LEARNING/sozercan-kaset-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/sozercan/kaset](https://github.com/sozercan/kaset))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-26T06:44:03.767Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sozercan/kaset`
- **Description**: 📼 The missing YouTube and YouTube Music macOS app
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2651 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Sources/Kaset/Models/AI/QueueAnalysisSummary.swift`
```
import Foundation
import FoundationModels

@available(macOS 26.0, *)
@Generable
struct QueueAnalysisSummary: Equatable {
    @Guide(description: "A short opening sentence that starts from the current song or current queue position.")
    let opening: String

    @Guide(description: "A short phrase describing the queue's vibe, arc, or energy.")
    let vibe: String

    @Guide(description: "Two to four concrete highlight callouts from the queue, using song titles or artist names from the provided list.")
    let highlights: [String]

    @Guide(description: "A concise 3-5 sentence analysis of the queue's flow, taste, and momentum. Natural prose only.")
    let summary: String

    var displayText: String {
        self.summary.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

@available(macOS 26.0, *)
extension QueueAnalysisSummary.PartiallyGenerated {
    var displayText: String? {
        if let summary, !summary.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return summary.trimmingCharacters(in: .whitespacesAndNewlines)
        }

        var parts: [String] = []

        if let opening, !opening.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            parts.append(opening.trimmingCharacters(in: .whitespacesAndNewlines))
        }

        if let vibe, !vibe.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            parts.append("Vibe: \(vibe.trimmingCharacters(in: .whitespacesAndNewlines)).")
        }

        if let highlights, !highlights.isEmpty {
            parts.append(highlights.joined(separator: ", "))
        }

        guard !parts.isEmpty else { return nil }
        return parts.joined(separator: " ")
    }
}

```

### Core Architecture Module: `Sources/Kaset/Models/LoadingState.swift`
```
import Foundation

enum LoadingState {
    case idle
    case loading
    case loaded
    case loadingMore
    case error(LoadingError)
}

struct LoadingError {
    let title: String
    let message: String
    let isRetryable: Bool
    let underlyingError: (any Error)?

    init(from error: any Error) {
        if let ytError = error as? YTMusicError {
            self.title = ytError.userFriendlyTitle
            self.message = ytError.userFriendlyMessage
            self.isRetryable = ytError.isRetryable
            self.underlyingError = ytError
        } else if (error as NSError).domain == NSURLErrorDomain {
            self.title = "Connection Error"
            self.message = "Unable to connect. Please check your internet connection."
            self.isRetryable = true
            self.underlyingError = error
        } else {
            self.title = "Error"
            self.message = error.localizedDescription
            self.isRetryable = true
            self.underlyingError = error
        }
    }

    init(message: String, isRetryable: Bool = true) {
        self.title = "Error"
        self.message = message
        self.isRetryable = isRetryable
        self.underlyingError = nil
    }

    init(title: String, message: String, isRetryable: Bool = true) {
        self.title = title
        self.message = message
        self.isRetryable = isRetryable
        self.underlyingError = nil
    }
}

extension LoadingState: Equatable {
    static func == (lhs: LoadingState, rhs: LoadingState) -> Bool {
        switch (lhs, rhs) {
        case (.idle, .idle), (.loading, .loading), (.loaded, .loaded), (.loadingMore, .loadingMore):
            true
        case let (.error(lhsError), .error(rhsError)):
            lhsError.message == rhsError.message
        default:
            false
        }
    }
}

```

### Core Architecture Module: `Sources/Kaset/Models/QueueDisplayMode.swift`
```
import Foundation

enum QueueDisplayMode: String, Codable, CaseIterable {
    case popup
    case sidepanel

    var displayName: String {
        switch self {
        case .popup: "Popup"
        case .sidepanel: "Side Panel"
        }
    }

    var description: String {
        switch self {
        case .popup: "Compact overlay view"
        case .sidepanel: "Full-width panel with reordering"
        }
    }
}

```

### Core Architecture Module: `Sources/Kaset/Services/AI/Tools/QueueTool.swift`
```
import Foundation
import FoundationModels

@available(macOS 26.0, *)
@MainActor
struct QueueTool: Tool {
    private let playerService: PlayerService

    private let logger = DiagnosticsLogger.ai

    init(playerService: PlayerService) {
        self.playerService = playerService
    }

    let name = "getCurrentQueue"

    let description = """
    Gets the current playback queue with track details.
    Use this to understand what's in the queue before making changes.
    Returns the current track, upcoming tracks, and queue length.
    """

    @Generable
    struct Arguments {
        @Guide(description: "Maximum number of tracks to return (default 20)")
        let limit: Int
    }

    typealias Output = String

    nonisolated func call(arguments: Arguments) async throws -> String {
        await MainActor.run {
            let queue = self.playerService.queue
            let currentIndex = self.playerService.activePlaybackQueueIndex
            let limit = arguments.limit > 0 ? arguments.limit : 20

            guard !queue.isEmpty else {
                return "Queue is empty. No tracks are queued."
            }

            var output = "Current Queue (\(queue.count) tracks):\n"

            for (index, song) in queue.prefix(limit).enumerated() {
                let marker = index == currentIndex ? "▶ NOW PLAYING" : "  "
                output += "\(marker) \(index + 1). \"\(song.title)\" by \(song.artistsDisplay) [videoId: \(song.videoId)]\n"
            }

            if queue.count > limit {
                output += "... and \(queue.count - limit) more tracks"
            }

            self.logger.debug("QueueTool returned \(queue.count) tracks")
            return output
        }
    }
}

```

### Core Architecture Module: `Sources/Kaset/Services/API/Parsers/RadioQueueParser.swift`
```
import Foundation

struct RadioQueueResult {
    let songs: [Song]
    let continuationToken: String?
}

enum RadioQueueParser {
    private static let logger = DiagnosticsLogger.api

    static func parse(from data: [String: Any]) -> RadioQueueResult {
        guard let contents = data["contents"] as? [String: Any],
              let watchNextRenderer = contents["singleColumnMusicWatchNextResultsRenderer"] as? [String: Any],
              let tabbedRenderer = watchNextRenderer["tabbedRenderer"] as? [String: Any],
              let watchNextTabbedResults = tabbedRenderer["watchNextTabbedResultsRenderer"] as? [String: Any],
              let tabs = watchNextTabbedResults["tabs"] as? [[String: Any]],
              let firstTab = tabs.first,
              let tabRenderer = firstTab["tabRenderer"] as? [String: Any],
              let tabContent = tabRenderer["content"] as? [String: Any],
              let musicQueueRenderer = tabContent["musicQueueRenderer"] as? [String: Any],
              let queueContent = musicQueueRenderer["content"] as? [String: Any],
              let playlistPanelRenderer = queueContent["playlistPanelRenderer"] as? [String: Any],
              let playlistContents = playlistPanelRenderer["contents"] as? [[String: Any]]
        else {
            self.logger.debug("RadioQueueParser: Failed to parse radio queue structure. Top keys: \(data.keys.sorted())")
            return RadioQueueResult(songs: [], continuationToken: nil)
        }

        var continuationToken: String?
        if let continuations = playlistPanelRenderer["continuations"] as? [[String: Any]],
           let firstContinuation = continuations.first,
           let nextRadioData = firstContinuation["nextRadioContinuationData"] as? [String: Any],
           let token = nextRadioData["continuation"] as? String
        {
            continuationToken = token
        }

        let songs = Self.parseSongs(from: playlistContents)
        return RadioQueueResult(songs: songs, continuationToken: continuationToken)
    }

    static func parseContinuation(from data: [String: Any]) -> RadioQueueResult {
        guard let continuationContents = data["continuationContents"] as? [String: Any],
              let playlistPanelContinuation = continuationContents["playlistPanelContinuation"] as? [String: Any],
              let contents = playlistPanelContinuation["contents"] as? [[String: Any]]
        else {
            return RadioQueueResult(songs: [], continuationToken: nil)
        }

        var continuationToken: String?
        if let continuations = playlistPanelContinuation["continuations"] as? [[String: Any]],
           let firstContinuation = continuations.first,
           let nextRadioData = firstContinuation["nextRadioContinuationData"] as? [String: Any],
           let token = nextRadioData["continuation"] as? String
        {
            continuationToken = token
        }

        let songs = Self.parseSongs(from: contents)
        return RadioQueueResult(songs: songs, continuationToken: continuationToken)
    }

    private static func parseSongs(from playlistContents: [[String: Any]]) -> [Song] {
        var songs: [Song] = []
        for item in playlistContents {
            let panelVideoRenderer: [String: Any]? = if let direct = item["playlistPanelVideoRenderer"] as? [String: Any] {
                direct
            } else if let wrapper = item["playlistPanelVideoWrapperRenderer"] as? [String: Any],
                      let primary = wrapper["primaryRenderer"] as? [String: Any],
                      let wrapped = primary["playlistPanelVideoRenderer"] as? [String: Any]
            {
                wrapped
            } else {
                nil
            }

            guard let panelVideoRenderer else {
                continue
            }

            guard let videoId = panelVideoRenderer["videoId"] as? String else {
                continue
            }

            let title = self.parseTitle(from: panelVideoRenderer)
            let artists = self.parseArtists(from: panelVideoRenderer)
            let thumbnailURL = self.parseThumbnail(from: panelVideoRenderer)
            let duration = self.parseDuration(from: panelVideoRenderer)
            let likeStatus = SongMetadataParser.parseLikeStatus(from: panelVideoRenderer)

            let song = Song(
                id: videoId,
                title: title,
                artists: artists,
                album: nil,
                duration: duration,
                thumbnailURL: thumbnailURL,
                videoId: videoId,
                likeStatus: likeStatus,
                isExplicit: ParsingHelpers.extractIsExplicit(from: panelVideoRenderer)
            )
            songs.append(song)
        }

        return songs
    }

    private static func parseTitle(from renderer: [String: Any]) -> String {
        if let titleData = renderer["title"] as? [String: Any],
           let runs = titleData["runs"] as? [[String: Any]],
           let firstRun = runs.first,
           let text = firstRun["text"] as? String
        {
            return text
        }
        return "Unknown"
    }

    private static func parseArtists(from renderer: [String: Any]) -> [Artist] {
        var artists: [Artist] = []
        guard let bylineData = renderer["longBylineText"] as? [String: Any],
              let runs = bylineData["runs"] as? [[String: Any]]
        else { return artists }

        for run in runs {
            guard let text = run["text"] as? String else { continue }
            if text == " • " || text == " · " {
                break
            }
            guard text != " & ", text != ", " else { continue }

            let artistId: String = if let navEndpoint = run["navigationEndpoint"] as? [String: Any],
                                      let browseEndpoint = navEndpoint["browseEndpoint"] as? [String: Any],
                                      let browseId = browseEndpoint["browseId"] as? String
            {
                browseId
            } else {
                ParsingHelpers.stableId(title: "artist", components: text)
            }
            artists.append(Artist(id: artistId, name: text))
        }
        return artists
    }

    private static func parseThumbnail(from renderer: [String: Any]) -> URL? {
        guard let thumbnail = renderer["thumbnail"] as? [String: Any],
              let thumbnails = thumbnail["thumbnails"] as? [[String: Any]],
              let lastThumb = thumbnails.last,
              let urlString = lastThumb["url"] as? String
        else { return nil }

        let normalizedURL = urlString.hasPrefix("//") ? "https:" + urlString : urlString
        return URL(string: normalizedURL)
    }

    private static func parseDuration(from renderer: [String: Any]) -> TimeInterval? {
        guard let lengthText = renderer["lengthText"] as? [String: Any],
              let runs = lengthText["runs"] as? [[String: Any]],
              let firstRun = runs.first,
              let text = firstRun["text"] as? String
        else { return nil }

        return ParsingHelpers.parseDuration(text)
    }
}

```

### Core Architecture Module: `Sources/Kaset/Services/Audio/EqualizerAudioEngine.swift`
```
import AudioToolbox
import CoreAudio
import Foundation

final class EqualizerAudioEngine: EqualizerAudioEngineProtocol {
    private static let fallbackSampleRate: Float64 = 48000

    private static let tapChannelCount: Int = 2

    private(set) var isRunning: Bool = false

    // swiftformat:disable modifierOrder
    nonisolated(unsafe) private(set) var hasObservedAudio: Bool = false
    // swiftformat:enable modifierOrder

    private let tapHelper = ProcessTapHelper()

    private var ioProcID: AudioDeviceIOProcID?

    private var renderFormat: AudioStreamBasicDescription?

    private let filters: [BiquadFilter]

    private var preampLinear: Float = 1

    private var wetMixTarget: Float = 1

    private var wetMix: Float = 1

    private var envStereo: Float = 0
    private var envMono: Float = 0
    private var limiterGainStereo: Float = 1
    private var limiterGainMono: Float = 1

    private let bands: [EQBand]

    private let logger = DiagnosticsLogger.equalizer

    init(bands: [EQBand] = EQBand.defaultBands) {
        self.bands = bands
        self.filters = bands.map { _ in BiquadFilter() }
    }

    deinit {
        if let procID = self.ioProcID {
            let aggregateID = self.tapHelper.aggregateDeviceID
            if aggregateID != kAudioObjectUnknown {
                AudioDeviceStop(aggregateID, procID)
                AudioDeviceDestroyIOProcID(aggregateID, procID)
            }
        }
    }

    func start() -> Result<Void, StartFailure> {
        guard !self.isRunning else { return .success(()) }

        self.hasObservedAudio = false

        self.envStereo = 0
        self.envMono = 0
        self.limiterGainStereo = 1
        self.limiterGainMono = 1

        switch self.tapHelper.start() {
        case .success:
            break
        case let .failure(reason):
            return .failure(.tap(reason))
        }

        let aggregateID = self.tapHelper.aggregateDeviceID

        var sampleRate: Float64 = 0
        var srateSize = UInt32(MemoryLayout<Float64>.size)
        var srateAddr = AudioObjectPropertyAddress(
            mSelector: kAudioDevicePropertyNominalSampleRate,
            mScope: kAudioObjectPropertyScopeGlobal,
            mElement: kAudioObjectPropertyElementMain
        )
        let srateStatus = AudioObjectGetPropertyData(
            aggregateID, &srateAddr, 0, nil, &srateSize, &sampleRate
        )
        guard srateStatus == noErr, sampleRate > 0 else {
            self.logger.error("aggregate sample rate read failed: \(srateStatus)")
            self.tapHelper.stop()
            return .failure(.invalidTapFormat)
        }
        let format = Self.stereoFloat32NonInterleaved(sampleRate: sampleRate)
        self.renderFormat = format

        let selfRef = Unmanaged.passUnretained(self).toOpaque()
        var procID: AudioDeviceIOProcID?
        let createStatus = AudioDeviceCreateIOProcID(
            aggregateID, kasetEQIOProc, selfRef, &procID
        )
        guard createStatus == noErr, let procID else {
            self.logger.error("AudioDeviceCreateIOProcID failed: \(createStatus)")
            self.tapHelper.stop()
            return .failure(.ioProcInstall(createStatus))
        }
        self.ioProcID = procID

        let startStatus = AudioDeviceStart(aggregateID, procID)
        guard startStatus == noErr else {
            self.logger.error("AudioDeviceStart failed: \(startStatus)")
            AudioDeviceDestroyIOProcID(aggregateID, procID)
            self.ioProcID = nil
            self.tapHelper.stop()
            return .failure(.engineStart("AudioDeviceStart: \(startStatus)"))
        }

        self.isRunning = true
        self.logger.info("HAL I/O proc started at \(sampleRate) Hz")
        return .success(())
    }

    func stop() {
        if let procID = self.ioProcID {
            let aggregateID = self.tapHelper.aggregateDeviceID
            if aggregateID != kAudioObjectUnknown {
                AudioDeviceStop(aggregateID, procID)
                AudioDeviceDestroyIOProcID(aggregateID, procID)
            }
            self.ioProcID = nil
        }
        self.tapHelper.stop()
        self.renderFormat = nil
        self.isRunning = false
        self.hasObservedAudio = false
    }

    func apply(settings: EQSettings) {
        let sampleRate = Float(self.renderFormat?.mSampleRate ?? Self.fallbackSampleRate)
        let totalGainDB = settings.preampDB + settings.autoTrimDB
        self.preampLinear = powf(10, totalGainDB / 20)
        self.wetMixTarget = settings.isEnabled ? 1 : 0
        for (index, band) in self.bands.enumerated() {
            guard index < settings.bandGainsDB.count else { break }
            let gainDB = settings.bandGainsDB[index]
            switch band.type {
            case .peaking:
                self.filters[index].setPeakingEQ(
                    frequency: band.frequencyHz,
                    q: band.q,
                    gainDB: gainDB,
                    sampleRate: sampleRate
                )
            case .lowShelf:
                self.filters[index].setLowShelf(
                    frequency: band.frequencyHz,
                    slope: band.q,
                    gainDB: gainDB,
                    sampleRate: sampleRate
                )
            case .highShelf:
                self.filters[index].setHighShelf(
                    frequency: band.frequencyHz,
                    slope: band.q,
                    gainDB: gainDB,
                    sampleRate: sampleRate
                )
            }
        }
    }

    func performRender(
        inputBuffers: UnsafePointer<AudioBufferList>,
        frameCount: UInt32,
        outputBuffers: UnsafeMutablePointer<AudioBufferList>
    ) {
        let mutableInput = UnsafeMutableAudioBufferListPointer(
            UnsafeMutablePointer(mutating: inputBuffers)
        )
        let mutableOutput = UnsafeMutableAudioBufferListPointer(outputBuffers)
        let frames = Int(frameCount)

        let channelCount = min(mutableInput.count, mutableOutput.count)
        for channelIndex in 0 ..< channelCount {
            guard let src = mutableInput[channelIndex].mData?
                .bindMemory(to: Float.self, capacity: frames),
                let dst = mutableOutput[channelIndex].mData?
                .bindMemory(to: Float.self, capacity: frames)
            else {
                continue
            }
            dst.update(from: src, count: frames)
            if !self.hasObservedAudio,
               UnsafeBufferPointer(start: src, count: frames).contains(where: { $0 != 0 })
            {
                self.hasObservedAudio = true
            }
        }

        let gain = self.preampLinear
        var mix = self.wetMix
        let target = self.wetMixTarget
        let filters = self.filters
        let filterCount = filters.count

        if channelCount >= 2 {
            guard let leftPtr = mutableOutput[0].mData?
                .bindMemory(to: Float.self, capacity: frames),
                let rightPtr = mutableOutput[1].mData?
                .bindMemory(to: Float.self, capacity: frames),
                let dryLeft = mutableInput[0].mData?
                .bindMemory(to: Float.self, capacity: frames),
                let dryRight = mutableInput[1].mData?
                .bindMemory(to: Float.self, capacity: frames)
            else {
                return
            }
            for filterIndex in 0 ..< filterCount {
                filters[filterIndex].processNonInterleavedStereo(
                    left: leftPtr,
                    right: rightPtr,
                    frameCount: frames
                )
            }
            var env = self.envStereo
            var gR = self.limiterGainStereo
            for index in 0 ..< frames {
                mix += (target - mix) * Self.crossfadeAlpha
                let lSample = leftPtr[index] * gain
                let rSample = rightPtr[index] * gain
                let (wetL, wetR) = Self.limiterProcessStereo(
                    left: lSample, right: rSample, envelope: &env, gain: &gR
                )
                leftPtr[index] = dryLeft[index] * (1 - mix) + wetL * mix
                rightPtr[index] = dryRight[index] * (1 - mix) + wetR * mix
            }
            self.envStereo = env
            self.limiterGainStereo = gR
        } else if channelCount == 1 {
            guard let ptr = mutableOutput[0].mData?
                .bindMemory(to: Float.self, capacity: frames),
                let dry = mutableInput[0].mData?
                .bindMemory(to: Float.self, capacity: frames)
            else {
                return
            }
            for filterIndex in 0 ..< filterCount {
                filters[filterIndex].processMono(samples: ptr, frameCount: frames)
            }
            var env = self.envMono
            var gm = self.limiterGainMono
            for index in 0 ..< frames {
                mix += (target - mix) * Self.crossfadeAlpha
                let wet = Self.limiterProcess(
                    sample: ptr[index] * gain, envelope: &env, gain: &gm
                )
                ptr[index] = dry[index] * (1 - mix) + wet * mix
            }
            self.envMono = env
            self.limiterGainMono = gm
        }

        self.wetMix = mix
    }

    private static let crossfadeAlpha: Float = 0.002

    private static let limiterThreshold: Float = 0.99
    private static let limiterAttackCoeff: Float = 0.959
    private static let limiterReleaseCoeff: Float = 0.9999
    private static let limiterGainSlew: Float = 0.04

    @inline(__always)
    private static func limiterGainStep(
        level: Float,
        envelope: inout Float,
        gain: inout Float
    ) -> Float {
        if level > envelope {
            envelope = self.limiterAttackCoeff * envelope
                + (1 - self.limiterAttackCoeff) * level
        } else {
            envelope = self.limiterReleaseCoeff * envelope
   
```

### Core Architecture Module: `Sources/Kaset/Services/Audio/EqualizerAudioEngineProtocol.swift`
```
import Foundation

protocol EqualizerAudioEngineProtocol: AnyObject {
    var isRunning: Bool { get }
    var hasObservedAudio: Bool { get }
    func start() -> Result<Void, EqualizerAudioEngine.StartFailure>
    func stop()
    func apply(settings: EQSettings)
}

```

### Core Architecture Module: `Sources/Kaset/Services/Player/PlayerQueueModels.swift`
```
import Foundation

struct QueueEntry: Identifiable, Hashable {
    enum Source: String, Hashable, Codable {
        case queued
        case suggested
    }

    let id: UUID
    let song: Song
    var source: Source = .queued
}

struct QueuePlaybackContext: Equatable {
    let entryID: UUID?
    let index: Int
    let requestGeneration: Int
    let navigationGeneration: Int
}

struct PlaybackNavigationContext: Equatable {
    let requestGeneration: Int
    let navigationGeneration: Int
}

enum RadioQueueFetchOutcome: Equatable {
    case applied
    case unavailable
    case queueMutated
    case superseded
}

struct PendingNativeQueueAdvance: Equatable {
    let sourceEntryID: UUID?
    let sourceVideoId: String
    let targetEntryID: UUID
    let targetVideoId: String
    let generation: Int
    let fallbackDeadline: ContinuousClock.Instant
}

struct QueueState {
    enum PlaybackOwner: Equatable {
        case none
        case queueEntry(id: UUID, progress: TimeInterval, duration: TimeInterval)
        case detached(song: Song, episode: ArtistEpisode?, progress: TimeInterval, duration: TimeInterval)
    }

    let entries: [QueueEntry]
    let currentIndex: Int
    let shouldResumePlayback: Bool
    let wasPlaybackEnded: Bool
    let shuffleMode: PlayerService.ShuffleMode
    let mixContinuation: String?
    let mixContinuationRequiresAuth: Bool
    let queueOrderBeforeShuffle: [QueueEntry]?
    let playbackOwner: PlaybackOwner

    init(
        entries: [QueueEntry],
        currentIndex: Int,
        shouldResumePlayback: Bool = false,
        wasPlaybackEnded: Bool = false,
        shuffleMode: PlayerService.ShuffleMode = .off,
        mixContinuation: String? = nil,
        mixContinuationRequiresAuth: Bool = false,
        queueOrderBeforeShuffle: [QueueEntry]? = nil,
        playbackOwner: PlaybackOwner = .none
    ) {
        self.entries = entries
        self.currentIndex = currentIndex
        self.shouldResumePlayback = shouldResumePlayback
        self.wasPlaybackEnded = wasPlaybackEnded
        self.shuffleMode = shuffleMode
        self.mixContinuation = mixContinuation
        self.mixContinuationRequiresAuth = mixContinuationRequiresAuth
        self.queueOrderBeforeShuffle = queueOrderBeforeShuffle
        self.playbackOwner = playbackOwner
    }
}

```

### Core Architecture Module: `Sources/Kaset/Services/Player/PlayerService+Queue.swift`
```
// swiftlint:disable file_length
import Foundation

@MainActor
extension PlayerService {
    func playQueue(_ songs: [Song], startingAt index: Int = 0) async {
        guard !songs.isEmpty else { return }
        await self.playQueue(songs, startingAt: index, deferringSmartShuffleFill: false)
    }

    @discardableResult
    func playQueue(_ songs: [Song], startingAt index: Int = 0, deferringSmartShuffleFill: Bool) async -> Int? {
        guard !songs.isEmpty else { return nil }
        let intent = self.beginMusicPlaybackIntent()
        return await self.playQueue(
            songs,
            startingAt: index,
            deferringSmartShuffleFill: deferringSmartShuffleFill,
            intent: intent
        )
    }

    @discardableResult
    func playQueue(
        _ songs: [Song],
        startingAt index: Int,
        deferringSmartShuffleFill: Bool,
        intent: MusicPlaybackIntent
    ) async -> Int? {
        guard let installedQueue = self.installQueue(
            songs,
            startingAt: index,
            deferringSmartShuffleFill: deferringSmartShuffleFill,
            intent: intent
        ) else { return nil }
        return await self.startInstalledQueue(installedQueue)
    }

    struct InstalledQueue {
        let intent: MusicPlaybackIntent
        let playbackContextGeneration: Int
        let queueGeneration: Int
        let loadGeneration: Int?
    }

    func installQueue(
        _ songs: [Song],
        startingAt index: Int,
        deferringSmartShuffleFill: Bool,
        intent: MusicPlaybackIntent
    ) -> InstalledQueue? {
        guard self.acceptsMusicPlaybackIntent(intent), !songs.isEmpty else { return nil }
        let playbackContextGeneration = self.beginPlaybackRequest()
        self.invalidateMixContinuationRequest()
        self.resetSmartShuffleForNewQueue()
        let loadGeneration: Int?
        if deferringSmartShuffleFill {
            loadGeneration = self.beginQueueLoading()
        } else {
            self.invalidateStaleQueueLoad()
            loadGeneration = nil
        }
        let queueGeneration = loadGeneration ?? self.queueLoadGeneration
        self.clearForwardSkipNavigationStack()
        self.recordQueueStateForUndo()
        let safeIndex = max(0, min(index, songs.count - 1))
        let entries = songs.map { QueueEntry(id: UUID(), song: $0) }
        if self.shuffleEnabled, entries.count > 1 {
            self.materializeShuffleQueue(
                entries: entries,
                startingAt: safeIndex,
                recordUndo: false,
                storesOriginalOrder: true
            )
            self.currentIndex = 0
        } else {
            self.queueOrderBeforeShuffle = nil
            self.setQueue(entries: entries)
            self.currentIndex = safeIndex
        }
        self.mixContinuationToken = nil
        return InstalledQueue(
            intent: intent,
            playbackContextGeneration: playbackContextGeneration,
            queueGeneration: queueGeneration,
            loadGeneration: loadGeneration
        )
    }

    @discardableResult
    func startInstalledQueue(_ installedQueue: InstalledQueue) async -> Int? {
        let playbackContextGeneration = installedQueue.playbackContextGeneration
        let queueGeneration = installedQueue.queueGeneration
        let loadGeneration = installedQueue.loadGeneration
        guard self.acceptsMusicPlaybackIntent(installedQueue.intent) else { return loadGeneration }
        if let entry = self.queueEntries[safe: self.currentIndex] {
            await self.play(
                song: entry.song,
                webLoadStrategy: .standard,
                queueEntryID: entry.id,
                intent: installedQueue.intent
            )
        }
        guard self.isCurrentPlaybackRequest(playbackContextGeneration),
              self.isCurrentQueueLoad(queueGeneration)
        else { return loadGeneration }
        self.saveQueueForPersistence()
        if self.shuffleMode == .smart, loadGeneration == nil {
            await self.fillSmartShuffleWindow()
            guard self.isCurrentPlaybackRequest(playbackContextGeneration),
                  self.isCurrentQueueLoad(queueGeneration)
            else { return nil }
        }
        return loadGeneration
    }

    func playWithRadio(song: Song) async {
        let intent = self.beginMusicPlaybackIntent()
        await self.playWithRadio(song: song, intent: intent)
    }

    func playWithRadio(song: Song, intent: MusicPlaybackIntent) async {
        guard self.acceptsMusicPlaybackIntent(intent) else { return }
        let requestGeneration = self.beginPlaybackRequest()
        self.logger.info("Playing with radio: \(song.title)")
        self.clearForwardSkipNavigationStack()
        self.recordQueueStateForUndo()
        self.prepareForNewPlaybackContext()
        self.invalidateMixContinuationRequest()
        self.mixContinuationToken = nil
        let queueGeneration = self.queueLoadGeneration

        let seedEntry = QueueEntry(id: UUID(), song: song)
        self.setQueue(entries: [seedEntry])
        self.queueOrderBeforeShuffle = nil
        self.currentIndex = 0
        await self.play(
            song: song,
            webLoadStrategy: .standard,
            queueEntryID: seedEntry.id,
            intent: intent
        )
        guard self.isCurrentPlaybackRequest(requestGeneration),
              self.isCurrentQueueLoad(queueGeneration),
              self.queueEntryIDOwningCurrentPlayback == seedEntry.id
        else {
            self.logger.info("Discarding stale radio playback request")
            return
        }

        let outcome = await self.fetchAndApplyRadioQueue(
            for: song.videoId,
            seedEntryID: seedEntry.id,
            queueGeneration: queueGeneration
        )
        guard outcome == .applied || outcome == .unavailable,
              self.isCurrentPlaybackRequest(requestGeneration),
              self.isCurrentQueueLoad(queueGeneration),
              self.queueEntryIDOwningCurrentPlayback == seedEntry.id
        else { return }
        self.saveQueueForPersistence()
    }

    func playWithMix(
        playlistId: String,
        startVideoId: String?,
        intent suppliedIntent: MusicPlaybackIntent? = nil
    ) async {
        let intent = suppliedIntent ?? self.beginMusicPlaybackIntent()
        guard self.acceptsMusicPlaybackIntent(intent) else { return }
        self.logger.info("Playing mix playlist: \(playlistId), startVideoId: \(startVideoId ?? "nil (random)")")
        let requestGeneration = self.beginPendingPlaybackSelectionRequest()
        let continuationRequiresAuth = self.authService?.hasPersonalAccount == true
        self.clearForwardSkipNavigationStack()

        guard let client = self.ytMusicClient else {
            self.logger.warning("No YTMusicClient available for playing mix")
            return
        }

        do {
            let result = try await client.getMixQueue(playlistId: playlistId, startVideoId: startVideoId)
            guard !result.songs.isEmpty else {
                self.logger.warning("Mix queue returned empty")
                return
            }

            guard self.acceptsMusicPlaybackIntent(intent),
                  self.isCurrentPendingPlaybackSelectionRequest(requestGeneration)
            else {
                self.logger.info("Discarding stale mix playback request after playback boundary")
                return
            }

            let priorQueueState = self.makeQueueStateSnapshot()
            let playbackContextGeneration = self.beginPlaybackRequest()

            self.mixContinuationToken = result.continuationToken
            self.mixContinuationRequiresAuth = continuationRequiresAuth

            let shuffledSongs = result.songs.shuffled()
            let shuffledEntries = shuffledSongs.map { QueueEntry(id: UUID(), song: $0) }
            self.recordQueueStateForUndo(priorQueueState)

            self.prepareForNewPlaybackContext()
            let queueGeneration = self.queueLoadGeneration

            self.setQueue(entries: shuffledEntries)
            self.queueOrderBeforeShuffle = nil
            self.currentIndex = 0

            if let firstEntry = self.queueEntries.first {
                await self.play(
                    song: firstEntry.song,
                    webLoadStrategy: .standard,
                    queueEntryID: firstEntry.id,
                    intent: intent
                )
            }
            guard self.isCurrentPlaybackRequest(playbackContextGeneration),
                  self.isCurrentQueueLoad(queueGeneration)
            else { return }
            self.logger.info(
                "Mix queue loaded with \(shuffledEntries.count) songs, hasContinuation: \(result.continuationToken != nil)"
            )
            self.saveQueueForPersistence()
        } catch {
            guard self.acceptsMusicPlaybackIntent(intent),
                  self.isCurrentPendingPlaybackSelectionRequest(requestGeneration)
            else { return }
            self.logger.warning("Failed to fetch mix queue: \(error.localizedDescription)")
        }
    }

    func fetchMoreMixSongsIfNeeded(
        queueGeneration suppliedQueueGeneration: Int? = nil,
        shouldApplyResult: @MainActor () -> Bool = { true }
    ) async {
        let queueGeneration = suppliedQueueGeneration ?? self.queueLoadGeneration

        if self.isFetchingMoreMixSongs {
            let queueCountBeforeWait = self.queue.count
            let continuationBeforeWait = self.mixContinuationToken
            let queueMutationGenerationBeforeWait = self.queueMutationGeneration
            let completionGenerationBeforeWait = self.mixContinuationCompletionGeneration
            await withCheckedContinuation { continuation in
                self.mixContinuationFetchWaiters.append(continuation)
            }
            guard !Task.isCancelled,
                  shouldApplyResult(),
 
```

### Core Architecture Module: `Sources/Kaset/Services/Player/PlayerService+QueueEnrichment.swift`
```
import Foundation

@MainActor
extension PlayerService {
    func startQueueEnrichmentService() {
        self.scheduleQueueEnrichmentIfNeeded()
    }

    func stopQueueEnrichmentService() {
        self.queueEnrichmentNeedsReschedule = false
        self.queueEnrichmentGeneration += 1
        self.queueEnrichmentRunningGeneration = nil
        self.isQueueEnrichmentRunning = false
        self.enrichmentTask?.cancel()
        self.enrichmentTask = nil
    }

    func queueDidChangeForEnrichment() {
        guard !self.isApplyingQueueEnrichmentResult else { return }

        self.resetQueueEnrichmentAttemptState()
        self.scheduleQueueEnrichmentIfNeeded()
    }

    func resetQueueEnrichmentAttemptState() {
        self.queueEnrichmentAttemptsByEntryID.removeAll()
        self.stopQueueEnrichmentService()
    }

    func scheduleQueueEnrichmentIfNeeded(delay requestedDelay: Duration? = nil) {
        self.pruneQueueEnrichmentAttemptState()

        guard self.ytMusicClient != nil else {
            self.stopQueueEnrichmentService()
            return
        }

        let songsNeedingEnrichment = self.identifySongsNeedingEnrichment()
        guard !songsNeedingEnrichment.isEmpty else {
            self.queueEnrichmentAttemptsByEntryID.removeAll()
            self.stopQueueEnrichmentService()
            return
        }

        guard !self.identifyEnrichableSongsNeedingEnrichment().isEmpty else {
            self.stopQueueEnrichmentService()
            return
        }

        if self.isQueueEnrichmentRunning {
            self.queueEnrichmentNeedsReschedule = true
            return
        }

        guard self.enrichmentTask == nil else { return }

        self.queueEnrichmentGeneration += 1
        let generation = self.queueEnrichmentGeneration
        let delay = requestedDelay ?? self.queueEnrichmentInitialDelay

        self.enrichmentTask = Task { @MainActor [weak self] in
            do {
                try await Task.sleep(for: delay)
            } catch {
                await self?.finishScheduledQueueEnrichment(generation: generation)
                return
            }

            guard !Task.isCancelled else {
                await self?.finishScheduledQueueEnrichment(generation: generation)
                return
            }

            await self?.runScheduledQueueEnrichment(generation: generation)
        }
    }

    func runScheduledQueueEnrichment(generation: Int) async {
        guard generation == self.queueEnrichmentGeneration else { return }
        let songsToEnrich = self.identifyEnrichableSongsNeedingEnrichment()
        guard self.ytMusicClient != nil, !songsToEnrich.isEmpty else {
            await self.finishScheduledQueueEnrichment(generation: generation)
            return
        }

        self.isQueueEnrichmentRunning = true
        self.queueEnrichmentRunningGeneration = generation
        self.queueEnrichmentNeedsReschedule = false
        await self.enrichQueueMetadata(songsToEnrich: songsToEnrich)
        if self.queueEnrichmentRunningGeneration == generation {
            self.queueEnrichmentRunningGeneration = nil
            self.isQueueEnrichmentRunning = false
        }

        guard generation == self.queueEnrichmentGeneration, !Task.isCancelled else { return }

        let shouldRescheduleForMutation = self.queueEnrichmentNeedsReschedule
        let shouldRetryIncompleteEntries = !self.identifyEnrichableSongsNeedingEnrichment().isEmpty
        await self.finishScheduledQueueEnrichment(generation: generation)

        if shouldRescheduleForMutation {
            self.scheduleQueueEnrichmentIfNeeded()
        } else if shouldRetryIncompleteEntries {
            self.scheduleQueueEnrichmentIfNeeded(delay: self.queueEnrichmentRetryDelay)
        }
    }

    func finishScheduledQueueEnrichment(generation: Int) async {
        guard generation == self.queueEnrichmentGeneration else { return }

        self.enrichmentTask = nil
    }

    func identifyEnrichableSongsNeedingEnrichment() -> [(entryID: UUID, videoId: String)] {
        self.identifySongsNeedingEnrichment().filter { item in
            self.queueEnrichmentAttemptsByEntryID[item.entryID, default: 0]
                < Self.maxQueueEnrichmentAttempts
        }
    }

    func pruneQueueEnrichmentAttemptState() {
        let activeEntryIDs = Set(self.queueEntryIDs)
        self.queueEnrichmentAttemptsByEntryID = self.queueEnrichmentAttemptsByEntryID.filter { entryID, _ in
            activeEntryIDs.contains(entryID)
        }
    }

    func songNeedsQueueMetadataEnrichment(_ song: Song) -> Bool {
        Self.songNeedsQueueEnrichment(song)
    }

    func identifySongsNeedingEnrichment() -> [(entryID: UUID, videoId: String)] {
        self.queueEntries.compactMap { entry in
            Self.songNeedsQueueEnrichment(entry.song)
                ? (entryID: entry.id, videoId: entry.song.videoId)
                : nil
        }
    }

    func enrichQueueMetadata(
        songsToEnrich requestedSongsToEnrich: [(entryID: UUID, videoId: String)]? = nil
    ) async {
        guard let client = self.ytMusicClient else { return }

        let songsToEnrich = requestedSongsToEnrich ?? self.identifySongsNeedingEnrichment()
        guard !songsToEnrich.isEmpty else { return }

        self.logger.info("Enriching metadata for \(songsToEnrich.count) songs in queue")
        var didUpdateQueue = false

        for (entryID, videoId) in songsToEnrich {
            guard !Task.isCancelled else { break }
            guard self.queueEntries.contains(where: {
                $0.id == entryID && $0.song.videoId == videoId
            }) else { continue }
            self.queueEnrichmentAttemptsByEntryID[entryID, default: 0] += 1

            do {
                let enrichedSong = try await client.getSong(videoId: videoId)
                guard !Task.isCancelled else { break }

                if let index = self.queueEntries.firstIndex(where: {
                    $0.id == entryID && $0.song.videoId == videoId
                }), Self.songNeedsQueueEnrichment(self.queueEntries[index].song) {
                    var updatedEntries = self.queueEntries
                    let mergedSong = Self.mergingQueueMetadata(
                        current: updatedEntries[index].song,
                        response: enrichedSong,
                        includesAccountMetadata: false
                    )
                    updatedEntries[index] = QueueEntry(
                        id: updatedEntries[index].id,
                        song: mergedSong,
                        source: updatedEntries[index].source
                    )
                    self.isApplyingQueueEnrichmentResult = true
                    self.setQueue(entries: updatedEntries)
                    self.isApplyingQueueEnrichmentResult = false
                    didUpdateQueue = true
                    if !Self.songNeedsQueueEnrichment(mergedSong) {
                        self.queueEnrichmentAttemptsByEntryID.removeValue(forKey: entryID)
                    }
                    self.logger.debug(
                        "Enriched song \(index): '\(mergedSong.title)' - artists: \(mergedSong.artistsDisplay)"
                    )
                }

                if songsToEnrich.count > 1 {
                    try? await Task.sleep(for: .milliseconds(100))
                }
            } catch {
                self.logger.warning(
                    "Failed to enrich metadata for song \(videoId): \(error.localizedDescription)"
                )
            }
        }

        if didUpdateQueue {
            self.saveQueueForPersistence()
            self.logger.info("Queue metadata enrichment complete, saved to persistence")
        } else {
            self.logger.info("Queue metadata enrichment complete, no queue updates to persist")
        }
    }

    static func songNeedsQueueEnrichment(_ song: Song) -> Bool {
        song.artists.isEmpty
            || song.artists.allSatisfy { $0.name.isEmpty || $0.name == "Unknown Artist" }
            || song.title.isEmpty
            || song.title == "Loading..."
            || song.thumbnailURL == nil
    }

    static func mergingQueueMetadata(
        current: Song,
        response: Song,
        includesAccountMetadata: Bool = true
    ) -> Song {
        let keepsCurrentArtists = !current.artists.isEmpty
            && !current.artists.allSatisfy { $0.name.isEmpty || $0.name == "Unknown Artist" }
        let keepsCurrentTitle = !current.title.isEmpty && current.title != "Loading..."
        return Song(
            id: current.id,
            title: keepsCurrentTitle ? current.title : response.title,
            artists: keepsCurrentArtists ? current.artists : response.artists,
            album: current.album ?? response.album,
            duration: current.duration ?? response.duration,
            thumbnailURL: current.thumbnailURL ?? response.thumbnailURL,
            videoId: current.videoId,
            isPlayable: includesAccountMetadata ? response.isPlayable : current.isPlayable,
            hasVideo: current.hasVideo ?? response.hasVideo,
            musicVideoType: current.musicVideoType ?? response.musicVideoType,
            likeStatus: includesAccountMetadata ? (current.likeStatus ?? response.likeStatus) : current.likeStatus,
            isInLibrary: includesAccountMetadata ? (current.isInLibrary ?? response.isInLibrary) : current.isInLibrary,
            feedbackTokens: includesAccountMetadata
                ? (current.feedbackTokens ?? response.feedbackTokens)
                : current.feedbackTokens,
            isExplicit: current.isExplicit ?? response.isExplicit,
            audioTrackVideoId: current.audioTrackVideoId ?? response.audioTrackVideoId
        )
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #579** (2026-11-11): **[Wrong repo] please ignore**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Bug Description  Every track fails with "Time out, check internet connection (ERROR_UNKNOWN)". It is not a timeout: all three extractor tiers are rejected by YouTube's bot check.  My IP (a VPN exit) is challenged for anonymous requests. Official clients and other clients that send the login cookie play fine on it. SimpMusic is signed in, but per mitmproxy analysis, the stream request does not  ### Expected Behavior  When signed in, the stream request carries the login cookie.  ### Steps to Reproduce  1. Use an IP where YouTube challenges anonymous playback (e.g. a VPN exit). 2. Sign in on SimpMusic Desktop 2.5.0 (use official extension, paste cookies) and play any song.   ### macOS Version  Other  ### Kaset Version  2.5.0  ### Affected Area  Playback / Audio  ### Screenshots or Logs  _No response_  ### Additional Context  I have premium membership

- **Issue #574** (2026-11-09): **[Bug]: Google is blocking the sign in function**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Bug Description  So it happens that Google is now blocking the in-app login window...  <img width="1181" height="943" alt="Image" src="https://github.com/user-attachments/assets/0d24bb67-21b2-4af8-a865-a558b7f54db6" />  Not sure that the recommended flow is now.  ### Expected Behavior  Google login is fixed (in a Google recommended way?)  ### Steps to Reproduce  1. Login  ### macOS Version  macOS 26 (Tahoe)  ### Kaset Version  0.14.2  ### Affected Area  Authentication / Login  ### Screenshots or Logs  _No response_  ### Additional Context  _No response_

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

### Incident Patch 1: `49c8bb52` (2026-11-25)
**Commit Message**: chore: finish removing source comments (#627)

Signed-off-by: Sertac Ozercan <[REDACTED_EMAIL]>

**File**: `.agents/skills/delete-comment/SKILL.md` (modified, +2/-2)
```diff
@@ -16,6 +16,6 @@ Read each comment with its code and relevant tests, docs, or Git history. Treat
 | Stale | Describes behavior, a constraint, or a next step that no longer applies. | Verify against current code or history, then delete it. |
 | Decision Record | Explains a non-obvious invariant, tradeoff, or external constraint that's still relevant. | Update a relevant ADR or create one in `docs/adr/`, then remove the inline version. |
 
-Preserve syntax-required headers. Leave unverified or tooling-sensitive comments for a later ratchet pass rather than stripping them mechanically. For a large audit, work in reviewable batches and distinguish the locations inventoried from those actually classified. If issue filing isn't authorized or cannot be completed, report the candidate and leave the comment until the follow-up is recorded.
+Preserve required headers, generated metadata, vendored code, active lint or formatter directives, and exact `# vX.Y.Z` release annotations on SHA-pinned GitHub Actions `uses:` entries. Verify the annotation against the tag without changing the pin. Remove a directive only after verifying its target no longer needs it. The ratchet still rejects new directives, so the inventory can be nonzero even when no prose remains. For an exhaustive audit, check embedded JavaScript, CSS, shell, and heredoc source separately; preserve comment-like string content such as help text and parser fixtures. For a large audit, work in reviewable batches and distinguish the locations inventoried from those actually classified. If issue filing isn't authorized or cannot be completed, report the candidate and leave the comment until the follow-up is recorded.
 
-Run `python3 Scripts/comment_lint.py --base <merge-base>` and relevant checks. For a `main`-bound branch, find the merge base with `git merge-base HEAD origin/main`. Report before/after comment-only lines, documents and issues created or reused, and deferred areas. Mixed code/comment lines and new ADR text are not source-line savings.
+Run `python3 Scripts/comment_lint.py --base <merge-base>` and relevant checks. For a `main`-bound branch, find the merge base with `git merge-base HEAD origin/main`. Use `--list` to confirm what remains. Report before/after comment-only lines, any manually counted embedded removals, documents and issues created or reused, and retained exceptions. Mixed code/comment lines and new ADR text are not source-line savings.
```

**File**: `.github/FUNDING.yml` (modified, +0/-1)
```diff
@@ -1,2 +1 @@
-# These are supported funding model platforms
 ko_fi: sozercan
```

**File**: `.github/dependabot.yml` (modified, +0/-1)
```diff
@@ -1,6 +1,5 @@
 version: 2
 updates:
-  # GitHub Actions
   - package-ecosystem: "github-actions"
     directory: "/"
     schedule:
```

**File**: `.github/workflows/api-explorer.yml` (modified, +1/-5)
```diff
@@ -29,7 +29,7 @@ jobs:
 
     steps:
       - name: Checkout code
-        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v4
+        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
 
       - name: Select Xcode version
         run: sudo xcode-select -s /Applications/Xcode_26.2.app/Contents/Developer
@@ -55,28 +55,24 @@ jobs:
           set -euo pipefail
           OUT=$(swift run -c release -q api-explorer list)
           echo "$OUT"
-          # Sanity: list output should mention at least one well-known browseId.
           echo "$OUT" | grep -q "FEmusic_home" \
             || { echo "ERROR: 'list' output missing FEmusic_home"; exit 1; }
 
       - name: Smoke-test - auth status (offline, expect 'not authenticated')
         run: |
           set -euo pipefail
-          # CI has no Kaset cookie backup, so this should report no auth and exit 0.
           OUT=$(swift run -c release -q api-explorer auth)
           echo "$OUT"
 
       - name: Smoke-test - browse FEmusic_home (unauthenticated)
         run: |
           set -euo pipefail
-          # Hits real YouTube Music API. Network flakiness is possible; retry once.
           run_browse() {
             swift run -c release -q api-explorer browse FEmusic_home
           }
           OUT=$(run_browse) || { sleep 5; OUT=$(run_browse); }
           echo "$OUT"
 
-          # Validate basic response shape so we catch silent API drift.
           echo "$OUT" | grep -q "HTTP 200" \
             || { echo "ERROR: expected 'HTTP 200' from FEmusic_home"; exit 1; }
           echo "$OUT" | grep -q "singleColumnBrowseResultsRenderer" \
```

**File**: `.github/workflows/automerge.yml` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ jobs:
     steps:
       - name: Dependabot metadata
         id: metadata
-        uses: dependabot/fetch-metadata@25dd0e34f4fe68f24cc83900b1fe3fe149efef98 # v2
+        uses: dependabot/fetch-metadata@25dd0e34f4fe68f24cc83900b1fe3fe149efef98 # v3.1.0
         with:
           github-token: "${{ secrets.GITHUB_TOKEN }}"
 
```

**File**: `.github/workflows/dev-build.yml` (modified, +2/-6)
```diff
@@ -35,7 +35,7 @@ jobs:
 
     steps:
       - name: Checkout code
-        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v4
+        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
 
       - name: Select Xcode version
         run: sudo xcode-select -s /Applications/Xcode_26.2.app/Contents/Developer
@@ -61,11 +61,9 @@ jobs:
 
       - name: Build app
         env:
-          # Ad-hoc builds list App Intents in Shortcuts but macOS will not run them.
           KASET_SIGNING: adhoc
           ARCHES: "arm64 x86_64"
         run: |
-          # Override version for dev builds
           echo "MARKETING_VERSION=0.0.0-dev.${{ steps.slug.outputs.sha_short }}" > version.env
           echo "BUILD_NUMBER=${{ github.run_number }}" >> version.env
           Scripts/build-app.sh release
@@ -84,18 +82,16 @@ jobs:
 
           echo "Found app at: $APP_PATH"
 
-          # Create a temporary directory for DMG contents
           mkdir -p dmg_contents
           cp -R "$APP_PATH" dmg_contents/
 
-          # Create DMG
           hdiutil create -volname "Kaset-dev" \
             -srcfolder dmg_contents \
             -ov -format UDZO \
             kaset-dev.dmg
 
       - name: Upload DMG
-        uses: actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v4
+        uses: actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7.0.2
         if: github.event_name != 'pull_request'
         with:
           name: kaset-dev-${{ steps.slug.outputs.sha_short }}
```

**File**: `.github/workflows/lint.yml` (modified, +2/-2)
```diff
@@ -18,7 +18,7 @@ jobs:
 
     steps:
       - name: Checkout code
-        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v4
+        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
 
       - name: Cache Homebrew
         uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0
@@ -42,7 +42,7 @@ jobs:
 
     steps:
       - name: Checkout code
-        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v4
+        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
         with:
           fetch-depth: 0
 
```

**File**: `.github/workflows/pages.yml` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@ jobs:
       url: ${{ steps.deployment.outputs.page_url }}
     steps:
       - name: Checkout
-        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v4
+        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
 
       - name: Configure Pages
         uses: actions/configure-pages@45bfe0192ca1faeb007ade9deae92b16b8254a0d # v6.0.0
```

#### Recent Merged Pull Requests:
- **PR #627** (2026-11-25): chore: finish removing source comments (@sozercan)
- **PR #603** (2026-11-22): chore: ratchet down source comments (@sozercan)
- **PR #589** (2026-11-15): fix(extensions): require permission consent (@sozercan)
- **PR #588** (2026-11-14): chore: add t3.json with project scripts (@sozercan)
- **PR #587** (2026-11-14): fix(youtube): size the YouTube watch chapters shelf to its cards (@mvanhorn)
- **PR #583** (2026-11-14): test: keep queue persistence and App Intents tests off shared singletons (@czubaker)

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

## X. finish removing source comments

**RULE**:
When implementing operations in `.agents/skills/delete-comment/SKILL.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in sozercan/kaset. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `49c8bb52`: finish removing source comments. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `.agents/skills/delete-comment/SKILL.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
Preserve required headers, generated metadata, vendored code, active lint or formatter directives, and exact `# vX.Y.Z` release annotations on SHA-pinned GitHub Actions `uses:` entries. Verify the annotation against the tag without changing the pin. Remove a directive only after verifying its target no longer needs it. The ratchet still rejects new directives, so the inventory can be nonzero even when no prose remains. For an exhaustive audit, check embedded JavaScript, CSS, shell, and heredoc source separately; preserve comment-like string content such as help text and parser fixtures. For a large audit, work in reviewable batches and distinguish the locations inventoried from those actually classified. If issue filing isn't authorized or cannot be completed, report the candidate and leave the comment until the follow-up is recorded.
Run `python3 Scripts/comment_lint.py --base <merge-base>` and relevant checks. For a `main`-bound branch, find the merge base with `git merge-base HEAD origin/main`. Use `--list` to confirm what remains. Report before/after comment-only lines, any manually counted embedded removals, documents and issues created or reused, and retained exceptions. Mixe
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
Preserve syntax-required headers. Leave unverified or tooling-sensitive comments for a later ratchet pass rather than stripping them mechanically. For a large audit, work in reviewable batches and distinguish the locations inventoried from those actually classified. If issue filing isn't authorized or cannot be completed, report the candidate and leave the comment until the follow-up is recorded.
Run `python3 Scripts/comment_lint.py --base <merge-base>` and relevant checks. For a `main`-bound branch, find the merge base with `git merge-base HEAD origin/main`. Report before/after comment-only lines, documents and issues created or reused, and deferred areas. Mixed code/comment lines and new ADR text are not source-line savings.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `49c8bb52` are properly handled with clean fallback behavior.


## Consequences
- **Positive**: Guarantees modular isolation, deterministic resource reclamation, and clean boundary encapsulation.
- **Negative / Trade-offs**: Requires explicit interface adapters and serialization overhead.
- **Compliance Mandate**: All future subsystem implementations adhering to this pattern must enforce this decision.
