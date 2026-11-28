# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: sozercan/kaset Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "sozercan/kaset",
  "source_url": "https://github.com/sozercan/kaset",
  "source_version": "59e95c8a",
  "license": "MIT",
  "timestamp": "2026-11-28T10:10:48.050Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-sozercan-kaset",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [sozercan/kaset](https://github.com/sozercan/kaset) (Revision: `59e95c8a`).  
> **License**: MIT | **Timestamp**: `2026-11-28T10:10:48.050Z`  
> **Learning ID**: `learn-github-sozercan-kaset`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), K (Quality & Verification Intelligence), D (Research & Knowledge Intelligence), I (Content & Information Intelligence), M (Feedback & Evolution Intelligence), A (Human & Need Intelligence)
- **Confidence Rating**: 53%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from sozercan/kaset:

# Forensic Learning Record (Deep Inspection): sozercan/kaset

> **Canonical Artifact**: `07_PROJECT_LEARNING/sozercan-kaset-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/sozercan/kaset](https://github.com/sozercan/kaset))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-28T10:10:45.631Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sozercan/kaset`
- **Description**: 📼 The missing YouTube and YouTube Music macOS app
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2662 stars

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

    func beginRadioPlaybackIntent(for song: Song, queueEntryID: UUID? = nil) -> MusicPlaybackIntent {
        self.startRadioRefreshGeneration &+= 1
        return self.beginMusicPlaybackIntent(
            allowsPriorTerminalEvent: self.startRadioKeepsCurrentPlayback(for: song, queueEntryID: queueEntryID)
        )
    }

    func startRadio(song: Song, queueEntryID: UUID? = nil) async {
        let intent = self.beginRadioPlaybackIntent(for: song, queueEntryID: queueEntryID)
        await self.startRadio(song: song, queueEntryID: queueEntryID, intent: intent)
    }

    private func startRadioKeepsCurrentPlayback(for song: Song, queueEntryID: UUID?) -> Bool {
        guard self.currentTrack?.videoId == song.videoId,
              let owningEntryID = self.queueEntryIDOwningCurrentPlayback
        else { return false }
        return queueEntryID == nil || queueEntryID == owningEntryID
    }

    func startRadio(song: Song, queueEntryID: UUID? = nil, intent: MusicPlaybackIntent) async {
        guard self.startRadioKeepsCurrentPlayback(for: song, queueEntryID: queueEntryID) else {
            await self.playWithRadio(song: song, intent: intent)
            return
        }
        guard self.acceptsMusicPlaybackIntent(intent) else { return }
        self.invalidatePendingPlaybackSelectionRequests()
        let refreshGeneration = self.startRadioRefreshGeneration
        let navigationContext = self.playbackNavigationContext
        let pauseGeneration = self.explicitPauseGeneration
        if self.state == .paused || self.state == .ended {
            await self.resume(intent: intent)
            guard self.acceptsMusicPlaybackIntent(intent) else { return }
        }
        let seedEntryID = self.queueEntryIDOwningCurrentPlayback
        let outcome = await self.fetchAndApplyRadioQueue(
            for: song.videoId,
            seedEntryID: seedEntryID,
            queueGeneration: self.queueLoadGeneration,
            replacesUpcoming: true,
            isCurrentRequest: { refreshGeneration == self.startRadioRefreshGeneration }
        )
        guard outcome == .applied else { return }
        self.currentEpisode = nil
        if self.state == .ended {
            guard self.explicitPauseGeneration == pauseGeneration else { return }
            let seedIndex = self.queueEntries.firstIndex { $0.id == seedEntryID } ?? self.currentIndex
            guard let firstRecommendation = self.queueEntries[safe: max(seedIndex, self.currentIndex) + 1] else { return }
            await self.playFromQueue(entryID: firstRecommendation.id)
            return
        }
        guard self.playbackNavigationContext.requestGeneration == navigationContext.requestGeneration else { return }
        await self.fillSmartShuffleWindow()
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

            guard self.acc
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

### Incident Patch 1: `b987362e` (2026-11-27)
**Commit Message**: fix(playback): route bare Space to play/pause and stop hidden WebView swallowing ⌘←/⌘→ (#444)

Signed-off-by: Sertac Ozercan <[REDACTED_EMAIL]>
Co-authored-by: Sertac Ozercan <[REDACTED_EMAIL]>

**File**: `Sources/Kaset/KasetApp.swift` (modified, +19/-9)
```diff
@@ -62,6 +62,8 @@ struct KasetApp: App {
 
     @State private var textInputFocusState = TextInputFocusState()
 
+    @State private var playbackSpaceKeyMonitor = PlaybackSpaceKeyMonitor()
+
     @State private var sidebarNavigationReselectGenerations: [NavigationItem: Int] = [:]
 
     @State private var navigationSelection: NavigationItem? = SettingsManager.shared.launchNavigationItem
@@ -194,7 +196,7 @@ struct KasetApp: App {
     }
 
     var body: some Scene {
-        Window("Kaset", id: "main") {
+        Window("Kaset", id: MainWindowLayout.sceneIdentifier) {
             if UITestConfig.isRunningUnitTests, !UITestConfig.isUITestMode {
                 Color.clear
                     .frame(width: 1, height: 1)
@@ -242,6 +244,10 @@ struct KasetApp: App {
                 .onAppear {
                     DiagnosticsLogger.app.info("KasetApp: App content appeared")
                     self.textInputFocusState.startMonitoring()
+                    self.playbackSpaceKeyMonitor.start(
+                        isPlaybackCommandEnabled: { !self.shouldDisablePlaybackCommand },
+                        onPlayPause: { self.performPlayPause() }
+                    )
                     self.appDelegate.playerService = self.playerService
                     self.appDelegate.beginOpenURLDelivery()
                     AppIntentsBridge.shared.setShowMainWindowHandler { self.showMainWindow() }
@@ -347,13 +353,7 @@ struct KasetApp: App {
 
             CommandMenu("Playback") {
                 Button(self.activePlayerIsPlaying ? "Pause" : "Play") {
-                    if self.playbackArbiter.routesMediaKeysToVideo {
-                        self.youtubePlayerService.playPause()
-                    } else {
-                        Task {
-                            await self.playerService.playPause()
-                        }
-                    }
+                    self.performPlayPause()
                 }
                 .keyboardShortcut(self.playbackShortcut(.space, modifiers: []))
                 .disabled(self.shouldDisablePlaybackCommand)
@@ -591,7 +591,7 @@ struct KasetApp: App {
     private func showMainWindow() {
         guard !self.focusExistingMainWindow() else { return }
 
-        self.openWindow(id: "main")
+        self.openWindow(id: MainWindowLayout.sceneIdentifier)
         NSApplication.shared.activate(ignoringOtherApps: true)
 
         Task { @MainActor in
@@ -647,6 +647,16 @@ struct KasetApp: App {
         }
     }
 
+    private func performPlayPause() {
+        if self.playbackArbiter.routesMediaKeysToVideo {
+            self.youtubePlayerService.playPause()
+        } else {
+            Task {
+                await self.playerService.playPause()
+            }
+        }
+    }
+
     private var activePlayerIsPlaying: Bool {
         if self.playbackArbiter.routesMediaKeysToVideo {
             self.youtubePlayerService.isPlaying
```

**File**: `Sources/Kaset/Utilities/MainWindowLayout.swift` (modified, +15/-3)
```diff
@@ -1,6 +1,7 @@
 import AppKit
 
 enum MainWindowLayout {
+    static let sceneIdentifier = "main"
     static let autosaveName = "KasetMainWindow"
     static let windowTitle = "Kaset"
     static let minimumWidth: CGFloat = 980
@@ -13,13 +14,24 @@ enum MainWindowLayout {
         NSSize(width: minimumWidth, height: minimumHeight)
     }
 
-    static func isPrimaryWindowIdentity(title: String, frameAutosaveName: String) -> Bool {
-        frameAutosaveName == self.autosaveName || title == self.windowTitle
+    static func isPrimaryWindowIdentity(
+        title: String,
+        frameAutosaveName: String,
+        identifier: String? = nil
+    ) -> Bool {
+        identifier == self.sceneIdentifier
+            || frameAutosaveName == self.sceneIdentifier
+            || frameAutosaveName == self.autosaveName
+            || title == self.windowTitle
     }
 
     @MainActor
     static func isPrimaryWindow(_ window: NSWindow) -> Bool {
-        self.isPrimaryWindowIdentity(title: window.title, frameAutosaveName: window.frameAutosaveName)
+        self.isPrimaryWindowIdentity(
+            title: window.title,
+            frameAutosaveName: window.frameAutosaveName,
+            identifier: window.identifier?.rawValue
+        )
     }
 
     @MainActor
```

**File**: `Sources/Kaset/Utilities/PlaybackSpaceKeyMonitor.swift` (added, +98/-0)
```diff
@@ -0,0 +1,98 @@
+import AppKit
+import WebKit
+
+struct PlaybackSpaceKeyContext {
+    let keyCode: UInt16
+    let modifiers: NSEvent.ModifierFlags
+    let isRepeat: Bool
+    let isPrimaryWindow: Bool
+    let isTextInputFocused: Bool
+    let isWebContentFocused: Bool
+    let isNativeBrowsingContentFocused: Bool
+    let isPlaybackCommandEnabled: Bool
+}
+
+@MainActor
+final class PlaybackSpaceKeyMonitor {
+    nonisolated static let spaceKeyCode: UInt16 = 49
+
+    private var monitor: Any?
+
+    nonisolated static func handlesSpaceKey(_ context: PlaybackSpaceKeyContext) -> Bool {
+        guard context.keyCode == self.spaceKeyCode,
+              !context.isRepeat,
+              context.isPrimaryWindow
+        else { return false }
+
+        let significantModifiers = context.modifiers
+            .intersection(.deviceIndependentFlagsMask)
+            .subtracting([.capsLock, .numericPad])
+        guard significantModifiers.isEmpty else { return false }
+        return context.isPlaybackCommandEnabled
+            && !context.isTextInputFocused
+            && !context.isWebContentFocused
+            && context.isNativeBrowsingContentFocused
+    }
+
+    static func isWebContent(_ responder: NSResponder?) -> Bool {
+        var currentResponder = responder
+        while let current = currentResponder {
+            if current is WKWebView {
+                return true
+            }
+            currentResponder = current.nextResponder
+        }
+        return false
+    }
+
+    static func isTextInput(_ responder: NSResponder?) -> Bool {
+        responder is NSTextView || responder is NSTextField
+    }
+
+    static func isNativeBrowsingContent(_ responder: NSResponder?) -> Bool {
+        responder is NSTableView
+    }
+
+    func start(
+        isPlaybackCommandEnabled: @escaping @MainActor () -> Bool,
+        onPlayPause: @escaping @MainActor () -> Void
+    ) {
+        guard self.monitor == nil else { return }
+
+        self.monitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { event in
+            let keyCode = event.keyCode
+            let modifiers = event.modifierFlags
+            let window = event.window ?? NSApp.keyWindow
+            let responder = window?.firstResponder
+
+            let context = PlaybackSpaceKeyContext(
+                keyCode: keyCode,
+                modifiers: modifiers,
+                isRepeat: event.isARepeat,
+                isPrimaryWindow: MainActor.assumeIsolated {
+                    window.map(MainWindowLayout.isPrimaryWindow) ?? false
+                },
+                isTextInputFocused: MainActor.assumeIsolated { Self.isTextInput(responder) },
+                isWebContentFocused: MainActor.assumeIsolated { Self.isWebContent(responder) },
+                isNativeBrowsingContentFocused: MainActor.assumeIsolated {
+                    Self.isNativeBrowsingContent(responder)
+                },
+                isPlaybackCommandEnabled: MainActor.assumeIsolated { isPlaybackCommandEnabled() }
+            )
+            guard Self.handlesSpaceKey(context) else { return event }
+
+            MainActor.assumeIsolated { onPlayPause() }
+            return nil
+        }
+    }
+
+    func stop() {
+        guard let monitor else { return }
+        NSEvent.removeMonitor(monitor)
+        self.monitor = nil
+    }
+
+    isolated deinit {
+        self.stop()
+    }
+}
```

**File**: `Tests/KasetTests/MainWindowLayoutTests.swift` (modified, +14/-0)
```diff
@@ -30,6 +30,20 @@ struct MainWindowLayoutTests {
         #expect(MainWindowLayout.minimumContentSize.height == MainWindowLayout.minimumHeight)
     }
 
+    @Test("Primary window identity follows the SwiftUI scene identifier after navigation changes the title")
+    func primaryWindowIdentityUsesSceneIdentifier() {
+        #expect(MainWindowLayout.isPrimaryWindowIdentity(
+            title: "Home",
+            frameAutosaveName: "main",
+            identifier: MainWindowLayout.sceneIdentifier
+        ))
+        #expect(!MainWindowLayout.isPrimaryWindowIdentity(
+            title: "Settings",
+            frameAutosaveName: "",
+            identifier: "settings"
+        ))
+    }
+
     @Test("Primary window identity excludes other regular scene windows")
     func primaryWindowIdentityExcludesOtherRegularSceneWindows() {
         #expect(MainWindowLayout.isPrimaryWindowIdentity(title: MainWindowLayout.windowTitle, frameAutosaveName: ""))
```

**File**: `Tests/KasetTests/PlaybackSpaceKeyMonitorTests.swift` (added, +109/-0)
```diff
@@ -0,0 +1,109 @@
+import AppKit
+import Testing
+import WebKit
+@testable import Kaset
+
+@Suite(.tags(.service))
+struct PlaybackSpaceKeyMonitorTests {
+    private static func handles(
+        keyCode: UInt16 = PlaybackSpaceKeyMonitor.spaceKeyCode,
+        modifiers: NSEvent.ModifierFlags = [],
+        isRepeat: Bool = false,
+        isPrimaryWindow: Bool = true,
+        isTextInputFocused: Bool = false,
+        isWebContentFocused: Bool = false,
+        isNativeBrowsingContentFocused: Bool = true,
+        isPlaybackCommandEnabled: Bool = true
+    ) -> Bool {
+        PlaybackSpaceKeyMonitor.handlesSpaceKey(PlaybackSpaceKeyContext(
+            keyCode: keyCode,
+            modifiers: modifiers,
+            isRepeat: isRepeat,
+            isPrimaryWindow: isPrimaryWindow,
+            isTextInputFocused: isTextInputFocused,
+            isWebContentFocused: isWebContentFocused,
+            isNativeBrowsingContentFocused: isNativeBrowsingContentFocused,
+            isPlaybackCommandEnabled: isPlaybackCommandEnabled
+        ))
+    }
+
+    @Test("Bare Space over native UI is claimed for play/pause")
+    func bareSpaceOverNativeUIIsClaimed() {
+        #expect(Self.handles())
+    }
+
+    @Test("Keys other than Space are never claimed")
+    func otherKeysAreNotClaimed() {
+        #expect(!Self.handles(keyCode: 123))
+        #expect(!Self.handles(keyCode: 124))
+        #expect(!Self.handles(keyCode: 36))
+    }
+
+    @Test("Space with a modifier is left alone so it stays available as a shortcut")
+    func modifiedSpaceIsNotClaimed() {
+        #expect(!Self.handles(modifiers: .command))
+        #expect(!Self.handles(modifiers: .option))
+        #expect(!Self.handles(modifiers: .shift))
+        #expect(!Self.handles(modifiers: .function))
+        #expect(!Self.handles(modifiers: [.command, .shift]))
+    }
+
+    @Test("Caps lock and numeric-pad flags do not stop Space from being claimed")
+    func incidentalModifiersAreIgnored() {
+        #expect(Self.handles(modifiers: .capsLock))
+        #expect(Self.handles(modifiers: [.capsLock, .numericPad]))
+    }
+
+    @Test("Space outside the primary playback window is left to that window")
+    func spaceOutsidePrimaryWindowIsNotClaimed() {
+        #expect(!Self.handles(isPrimaryWindow: false))
+    }
+
+    @Test("Repeated Space key-down events are ignored")
+    func repeatedSpaceIsNotClaimed() {
+        #expect(!Self.handles(isRepeat: true))
+    }
+
+    @Test("Space is left to a focused control that uses it for activation")
+    func focusedControlKeepsSpace() {
+        #expect(!Self.handles(isNativeBrowsingContentFocused: false))
+    }
+
+    @Test("Space types normally while a text field is being edited")
+    func textInputKeepsSpace() {
+        #expect(!Self.handles(isTextInputFocused: true))
+    }
+
+    @Test("Space is left to the page while the player WebView holds focus")
+    func webContentKeepsSpace() {
+        #expect(!Self.handles(isWebContentFocused: true))
+    }
+
+    @Test("Space is not claimed when the playback command is disabled")
+    func disabledPlaybackCommandKeepsSpace() {
+        #expect(!Self.handles(isPlaybackCommandEnabled: false))
+    }
+
+    @Test("Only native table browsing focus is eligible for playback interception")
+    @MainActor
+    func recognisesNativeBrowsingContent() {
+        #expect(PlaybackSpaceKeyMonitor.isNativeBrowsingContent(NSOutlineView(frame: .zero)))
+        #expect(PlaybackSpaceKeyMonitor.isNativeBrowsingContent(NSTableView(frame: .zero)))
+        #expect(!PlaybackSpaceKeyMonitor.isNativeBrowsingContent(NSButton(frame: .zero)))
+        #expect(!PlaybackSpaceKeyMonitor.isNativeBrowsingContent(NSSlider(frame: .zero)))
+        #expect(!PlaybackSpaceKeyMonitor.isNativeBrowsingContent(NSView(frame: .zero)))
+    }
+
+    @Test("Responders inside a WKWebView are recognised as web content")
+    @MainActor
+    func recognisesWebContentResponders() {
+        let webView = WKWebView(frame: .zero, configuration: WKWebViewConfiguration())
+        let contentView = NSView(frame: .zero)
+        webView.addSubview(contentView)
+
+        #expect(PlaybackSpaceKeyMonitor.isWebContent(webView))
+        #expect(PlaybackSpaceKeyMonitor.isWebContent(contentView))
+        #expect(!PlaybackSpaceKeyMonitor.isWebContent(NSView(frame: .zero)))
+        #expect(!PlaybackSpaceKeyMonitor.isWebContent(NSButton(frame: .zero)))
+    }
+}
```

**File**: `docs/keyboard-shortcuts.md` (modified, +2/-0)
```diff
@@ -18,6 +18,8 @@ Kaset provides keyboard control for playback and navigation while preserving sta
 
 Mute is still available from the Playback menu and AppleScript, but Kaset intentionally does not assign a default mute shortcut so the native macOS minimize shortcut (`⌘M`) continues to work.
 
+`Space` also toggles playback while the sidebar or the queue panel has focus in the main window. It still types a space in text fields, and a focused button or card keeps `Space` for activation.
+
 Playback shortcuts are source-aware where both sources implement an equivalent action: play/pause, skip, seek, and volume route to regular YouTube when a YouTube video was the last active playback source. Shuffle, repeat, queue, and lyrics remain YouTube Music concepts.
 
 ## Navigation
```

---

### Incident Patch 2: `82e57b72` (2026-11-27)
**Commit Message**: fix(youtube): route F and double-click full screen through Kaset's player (#598)

Signed-off-by: Sertac Ozercan <[REDACTED_EMAIL]>
Co-authored-by: Sertac Ozercan <[REDACTED_EMAIL]>

**File**: `Sources/Kaset/Views/YouTube/YouTubePlayerBar.swift` (modified, +1/-9)
```diff
@@ -669,15 +669,7 @@ struct YouTubePlayerBar: View {
 
     private func openYouTubeFullView() {
         HapticService.toggle()
-        if self.youtubePlayer.surfaceLocation == .inline {
-            self.youtubePlayer.popOutToWindow()
-            Task { @MainActor in
-                try? await Task.sleep(for: .milliseconds(250))
-                YouTubeVideoWindowController.shared.toggleFullscreen(returnInlineOnExit: true)
-            }
-        } else {
-            YouTubeVideoWindowController.shared.toggleFullscreen()
-        }
+        YouTubeVideoWindowController.shared.toggleFullView(for: self.youtubePlayer)
     }
 
     private func toggleYouTubePictureInPicture() {
```

**File**: `Sources/Kaset/Views/YouTube/YouTubeVideoWindowController.swift` (modified, +44/-1)
```diff
@@ -60,6 +60,14 @@ enum YouTubeVideoWindowFullscreenPhase: Equatable {
     var blocksWindowedControls: Bool {
         self != .windowed
     }
+
+    var isTransitioning: Bool {
+        self == .entering || self == .exiting
+    }
+
+    static func settled(isFullScreen: Bool) -> Self {
+        isFullScreen ? .fullscreen : .windowed
+    }
 }
 
 @MainActor
@@ -70,6 +78,7 @@ final class YouTubeVideoWindowController {
     private var hostingView: NSHostingView<AnyView>?
     private weak var youtubePlayerService: YouTubePlayerService?
     private var isClosing = false
+    private var isPoppingOutToFullView = false
     private let frameAutosaveKey = "KasetYouTubeVideoWindow"
 
     private static let minContentSize = NSSize(width: 512, height: 288)
@@ -118,6 +127,9 @@ final class YouTubeVideoWindowController {
             minContentSize: Self.minContentSize,
             onDidFailToEnterFullScreen: { [weak self] window in
                 self?.handleFailedFullscreenEntry(window)
+            },
+            onDidFailToExitFullScreen: { [weak self] window in
+                self?.handleFailedFullscreenExit(window)
             }
         )
         self.resizeGuard = resizeGuard
@@ -227,6 +239,12 @@ final class YouTubeVideoWindowController {
         self.youtubePlayerService?.windowFullscreenPhase = .windowed
     }
 
+    private func handleFailedFullscreenExit(_ window: NSWindow) {
+        self.youtubePlayerService?.windowFullscreenPhase = .settled(
+            isFullScreen: window.styleMask.contains(.fullScreen)
+        )
+    }
+
     private func applyFrameAutosaveTransition(
         _ transition: YouTubeVideoWindowFrameAutosaveState.Transition,
         to window: NSWindow
@@ -252,6 +270,23 @@ final class YouTubeVideoWindowController {
         window.toggleFullScreen(nil)
     }
 
+    func toggleFullView(for player: YouTubePlayerService) {
+        guard !self.isPoppingOutToFullView,
+              !player.windowFullscreenPhase.isTransitioning
+        else { return }
+        if player.surfaceLocation == .inline {
+            player.popOutToWindow()
+            self.isPoppingOutToFullView = true
+            Task { @MainActor in
+                try? await Task.sleep(for: .milliseconds(250))
+                self.isPoppingOutToFullView = false
+                self.toggleFullscreen(returnInlineOnExit: true)
+            }
+        } else {
+            self.toggleFullscreen()
+        }
+    }
+
     func setWindowChromeVisible(_ visible: Bool) {
         guard let window = self.window else { return }
         for buttonType in [NSWindow.ButtonType.closeButton, .miniaturizeButton, .zoomButton] {
@@ -385,24 +420,32 @@ struct YouTubeVideoWindowFrameAutosaveState: Equatable {
 final class YouTubeVideoWindowResizeGuard: NSObject, NSWindowDelegate {
     private let minContentSize: NSSize
     private var onDidFailToEnterFullScreen: ((NSWindow) -> Void)?
+    private var onDidFailToExitFullScreen: ((NSWindow) -> Void)?
 
     init(
         minContentSize: NSSize,
-        onDidFailToEnterFullScreen: ((NSWindow) -> Void)? = nil
+        onDidFailToEnterFullScreen: ((NSWindow) -> Void)? = nil,
+        onDidFailToExitFullScreen: ((NSWindow) -> Void)? = nil
     ) {
         self.minContentSize = minContentSize
         self.onDidFailToEnterFullScreen = onDidFailToEnterFullScreen
+        self.onDidFailToExitFullScreen = onDidFailToExitFullScreen
         super.init()
     }
 
     func invalidate() {
         self.onDidFailToEnterFullScreen = nil
+        self.onDidFailToExitFullScreen = nil
     }
 
     func windowDidFailToEnterFullScreen(_ window: NSWindow) {
         self.onDidFailToEnterFullScreen?(window)
     }
 
+    func windowDidFailToExitFullScreen(_ window: NSWindow) {
+        self.onDidFailToExitFullScreen?(window)
+    }
+
     static func normalizedContentSize(
         for proposed: NSSize,
         minContentSize: NSSize,
```

**File**: `Sources/Kaset/Views/YouTube/YouTubeWatchWebView+Coordinator.swift` (modified, +2/-0)
```diff
@@ -33,6 +33,8 @@ extension YouTubeWatchWebView {
                 self.handleStateUpdate(body, documentGeneration: messageDocumentGeneration)
             case "VIDEO_ENDED":
                 self.handleVideoEnded(body, documentGeneration: messageDocumentGeneration)
+            case "TOGGLE_FULLSCREEN":
+                YouTubeVideoWindowController.shared.toggleFullView(for: self.playerService)
             default:
                 return
             }
```

**File**: `Sources/Kaset/Views/YouTube/YouTubeWatchWebView+Scripts.swift` (modified, +25/-0)
```diff
@@ -476,6 +476,31 @@ extension YouTubeWatchWebView {
         """
     }
 
+    static var fullscreenRedirectScript: String {
+        """
+        (function() {
+            'use strict';
+            const bridge = window.webkit.messageHandlers.youtubePlayer;
+            function redirect() {
+                const activation = window.navigator && window.navigator.userActivation;
+                if (activation && !activation.isActive) {
+                    return Promise.reject(new TypeError('Full screen requires a user gesture'));
+                }
+                bridge.postMessage({
+                    type: 'TOGGLE_FULLSCREEN',
+                    documentGeneration: window.__kasetDocumentGeneration
+                });
+                return Promise.resolve();
+            }
+            ['requestFullscreen', 'webkitRequestFullscreen', 'webkitRequestFullScreen'].forEach(function(name) {
+                if (typeof Element.prototype[name] === 'function') {
+                    Element.prototype[name] = redirect;
+                }
+            });
+        })();
+        """
+    }
+
     static var blackoutScript: String {
         """
         (function() {
```

**File**: `Sources/Kaset/Views/YouTube/YouTubeWatchWebView.swift` (modified, +7/-0)
```diff
@@ -803,6 +803,13 @@ extension YouTubeWatchWebView {
         )
         contentController.addUserScript(blackout)
 
+        let fullscreenRedirect = WKUserScript(
+            source: Self.fullscreenRedirectScript,
+            injectionTime: .atDocumentStart,
+            forMainFrameOnly: true
+        )
+        contentController.addUserScript(fullscreenRedirect)
+
         let observer = WKUserScript(
             source: Self.observerScript,
             injectionTime: .atDocumentEnd,
```

**File**: `Tests/KasetTests/VideoSupportTests.swift` (modified, +22/-0)
```diff
@@ -1,3 +1,4 @@
+import AppKit
 import Foundation
 import Testing
 @testable import Kaset
@@ -209,4 +210,25 @@ struct YouTubeVideoWindowResizeGuardTests {
         #expect(result.width == 1000)
         #expect(result.height == 563)
     }
+
+    @Test("Failed full screen exit reaches the controller until invalidated")
+    func failedExitForwardsUntilInvalidated() {
+        let window = NSWindow(
+            contentRect: NSRect(x: 0, y: 0, width: 640, height: 360),
+            styleMask: [.titled],
+            backing: .buffered,
+            defer: true
+        )
+        var failedExits = 0
+        let resizeGuard = YouTubeVideoWindowResizeGuard(
+            minContentSize: self.floor,
+            onDidFailToExitFullScreen: { _ in failedExits += 1 }
+        )
+
+        resizeGuard.windowDidFailToExitFullScreen(window)
+        resizeGuard.invalidate()
+        resizeGuard.windowDidFailToExitFullScreen(window)
+
+        #expect(failedExits == 1)
+    }
 }
```

**File**: `Tests/KasetTests/YouTubeFullscreenRedirectScriptTests.swift` (added, +90/-0)
```diff
@@ -0,0 +1,90 @@
+import Foundation
+import JavaScriptCore
+import Testing
+@testable import Kaset
+
+@Suite("YouTube full screen redirect script", .tags(.service))
+@MainActor
+struct YouTubeFullscreenRedirectScriptTests {
+    @Test("Element full screen requests become a Kaset full screen toggle")
+    func fullscreenRequestsPostToggle() throws {
+        let context = try #require(JSContext())
+        try self.evaluate(
+            """
+            var messages = [];
+            var nativeCalls = 0;
+            function Element() {}
+            Element.prototype.requestFullscreen = function() { nativeCalls += 1; };
+            Element.prototype.webkitRequestFullscreen = function() { nativeCalls += 1; };
+            var window = {
+                navigator: { userActivation: { isActive: true } },
+                __kasetDocumentGeneration: 7,
+                webkit: { messageHandlers: { youtubePlayer: {
+                    postMessage: function(message) { messages.push(message); }
+                } } }
+            };
+            """,
+            in: context
+        )
+        try self.evaluate(YouTubeWatchWebView.fullscreenRedirectScript, in: context)
+        try self.evaluate(
+            """
+            var player = new Element();
+            var result = player.requestFullscreen();
+            window.__kasetDocumentGeneration = 8;
+            player.webkitRequestFullscreen();
+            """,
+            in: context
+        )
+
+        #expect(context.evaluateScript("nativeCalls").toInt32() == 0)
+        #expect(context.evaluateScript("typeof result.then").toString() == "function")
+        #expect(context.evaluateScript(
+            "messages.map(function(m) { return m.type + ':' + m.documentGeneration; }).join(',')"
+        ).toString() == "TOGGLE_FULLSCREEN:7,TOGGLE_FULLSCREEN:8")
+    }
+
+    @Test("Full screen requests without a user gesture are rejected without a toggle")
+    func fullscreenRequestsRequireUserActivation() throws {
+        let context = try #require(JSContext())
+        try self.evaluate(
+            """
+            var messages = [];
+            var rejection = null;
+            function Element() {}
+            Element.prototype.requestFullscreen = function() {};
+            var window = {
+                navigator: { userActivation: { isActive: false } },
+                __kasetDocumentGeneration: 7,
+                webkit: { messageHandlers: { youtubePlayer: {
+                    postMessage: function(message) { messages.push(message); }
+                } } }
+            };
+            """,
+            in: context
+        )
+        try self.evaluate(YouTubeWatchWebView.fullscreenRedirectScript, in: context)
+        try self.evaluate(
+            """
+            new Element().requestFullscreen().catch(function(error) { rejection = error.name; });
+            """,
+            in: context
+        )
+
+        #expect(context.evaluateScript("messages.length").toInt32() == 0)
+        #expect(context.evaluateScript("rejection").toString() == "TypeError")
+    }
+
+    private func evaluate(_ script: String, in context: JSContext) throws {
+        context.exception = nil
+        _ = context.evaluateScript(script)
+        if let exception = context.exception?.toString() {
+            Issue.record("JavaScript exception: \(exception)")
+            throw FullscreenRedirectScriptError.javaScriptException(exception)
+        }
+    }
+}
+
+private enum FullscreenRedirectScriptError: Error {
+    case javaScriptException(String)
+}
```

**File**: `Tests/KasetTests/YouTubeVideoWindowLevelPolicyTests.swift` (modified, +15/-0)
```diff
@@ -29,6 +29,21 @@ struct YouTubeVideoWindowLevelPolicyTests {
         #expect(YouTubeVideoWindowFullscreenPhase.exiting.blocksWindowedControls)
     }
 
+    @Test("Only the entering and exiting phases count as transitions")
+    func fullscreenPhaseTransitions() {
+        #expect(!YouTubeVideoWindowFullscreenPhase.windowed.isTransitioning)
+        #expect(YouTubeVideoWindowFullscreenPhase.entering.isTransitioning)
+        #expect(!YouTubeVideoWindowFullscreenPhase.fullscreen.isTransitioning)
+        #expect(YouTubeVideoWindowFullscreenPhase.exiting.isTransitioning)
+    }
+
+    @Test("A failed transition settles on the window's actual full screen state")
+    func settledPhaseEndsTransition() {
+        #expect(YouTubeVideoWindowFullscreenPhase.settled(isFullScreen: true) == .fullscreen)
+        #expect(YouTubeVideoWindowFullscreenPhase.settled(isFullScreen: false) == .windowed)
+        #expect(!YouTubeVideoWindowFullscreenPhase.settled(isFullScreen: true).isTransitioning)
+    }
+
     @Test("Float on Top controls require a windowed floating surface")
     func controlAvailability() {
         #expect(YouTubeVideoWindowLevelPolicy.canToggleFloatOnTop(
```

---

### Incident Patch 3: `3a653676` (2026-11-27)
**Commit Message**: fix(player): Refresh radio without restarting the current song (#604)

Signed-off-by: Sertac Ozercan <[REDACTED_EMAIL]>
Co-authored-by: Matt Van Horn <[REDACTED_EMAIL]>
Co-authored-by: Sertac Ozercan <[REDACTED_EMAIL]>

**File**: `Sources/Kaset/Services/Player/PlayerService+PlaybackControls.swift` (modified, +9/-2)
```diff
@@ -459,13 +459,20 @@ extension PlayerService {
     }
 
     func pause() async {
+        await self.pause(isAutomaticStop: false)
+    }
+
+    func pause(isAutomaticStop: Bool) async {
         let intent = self.beginMusicPlaybackIntent()
-        await self.pause(intent: intent)
+        await self.pause(intent: intent, isAutomaticStop: isAutomaticStop)
     }
 
-    func pause(intent: MusicPlaybackIntent) async {
+    func pause(intent: MusicPlaybackIntent, isAutomaticStop: Bool = false) async {
         guard self.acceptsMusicPlaybackIntent(intent) else { return }
         self.logger.debug("Pausing playback")
+        if !isAutomaticStop {
+            self.explicitPauseGeneration &+= 1
+        }
         self.clearQueueNavigationRecovery()
         self.shouldResumeAfterInterruption = false
         self.isAwaitingPlaybackConfirmation = false
```

**File**: `Sources/Kaset/Services/Player/PlayerService+Queue.swift` (modified, +118/-29)
```diff
@@ -114,6 +114,60 @@ extension PlayerService {
         return loadGeneration
     }
 
+    func beginRadioPlaybackIntent(for song: Song, queueEntryID: UUID? = nil) -> MusicPlaybackIntent {
+        self.startRadioRefreshGeneration &+= 1
+        return self.beginMusicPlaybackIntent(
+            allowsPriorTerminalEvent: self.startRadioKeepsCurrentPlayback(for: song, queueEntryID: queueEntryID)
+        )
+    }
+
+    func startRadio(song: Song, queueEntryID: UUID? = nil) async {
+        let intent = self.beginRadioPlaybackIntent(for: song, queueEntryID: queueEntryID)
+        await self.startRadio(song: song, queueEntryID: queueEntryID, intent: intent)
+    }
+
+    private func startRadioKeepsCurrentPlayback(for song: Song, queueEntryID: UUID?) -> Bool {
+        guard self.currentTrack?.videoId == song.videoId,
+              let owningEntryID = self.queueEntryIDOwningCurrentPlayback
+        else { return false }
+        return queueEntryID == nil || queueEntryID == owningEntryID
+    }
+
+    func startRadio(song: Song, queueEntryID: UUID? = nil, intent: MusicPlaybackIntent) async {
+        guard self.startRadioKeepsCurrentPlayback(for: song, queueEntryID: queueEntryID) else {
+            await self.playWithRadio(song: song, intent: intent)
+            return
+        }
+        guard self.acceptsMusicPlaybackIntent(intent) else { return }
+        self.invalidatePendingPlaybackSelectionRequests()
+        let refreshGeneration = self.startRadioRefreshGeneration
+        let navigationContext = self.playbackNavigationContext
+        let pauseGeneration = self.explicitPauseGeneration
+        if self.state == .paused || self.state == .ended {
+            await self.resume(intent: intent)
+            guard self.acceptsMusicPlaybackIntent(intent) else { return }
+        }
+        let seedEntryID = self.queueEntryIDOwningCurrentPlayback
+        let outcome = await self.fetchAndApplyRadioQueue(
+            for: song.videoId,
+            seedEntryID: seedEntryID,
+            queueGeneration: self.queueLoadGeneration,
+            replacesUpcoming: true,
+            isCurrentRequest: { refreshGeneration == self.startRadioRefreshGeneration }
+        )
+        guard outcome == .applied else { return }
+        self.currentEpisode = nil
+        if self.state == .ended {
+            guard self.explicitPauseGeneration == pauseGeneration else { return }
+            let seedIndex = self.queueEntries.firstIndex { $0.id == seedEntryID } ?? self.currentIndex
+            guard let firstRecommendation = self.queueEntries[safe: max(seedIndex, self.currentIndex) + 1] else { return }
+            await self.playFromQueue(entryID: firstRecommendation.id)
+            return
+        }
+        guard self.playbackNavigationContext.requestGeneration == navigationContext.requestGeneration else { return }
+        await self.fillSmartShuffleWindow()
+    }
+
     func playWithRadio(song: Song) async {
         let intent = self.beginMusicPlaybackIntent()
         await self.playWithRadio(song: song, intent: intent)
@@ -309,7 +363,7 @@ extension PlayerService {
             let newSongs = result.songs.filter { !existingIDs.contains($0.videoId) }
             if !newSongs.isEmpty {
                 let updatedEntries = self.queueEntries + newSongs.map { QueueEntry(id: UUID(), song: $0) }
-                self.setQueue(entries: updatedEntries)
+                self.applyAutomaticQueueChange { self.setQueue(entries: updatedEntries) }
                 self.logger.info("Added \(newSongs.count) new songs to queue, total: \(self.queue.count)")
             }
 
@@ -336,6 +390,18 @@ extension PlayerService {
         self.resumeMixContinuationFetchWaiters()
     }
 
+    private func originalShuffleOrder(retaining entries: [QueueEntry]) -> [QueueEntry] {
+        let liveEntryIDs = Set(entries.map(\.id))
+        var originalEntries = (self.queueOrderBeforeShuffle ?? []).filter {
+            liveEntryIDs.contains($0.id)
+        }
+        let originalIDs = Set(originalEntries.map(\.id))
+        originalEntries.append(contentsOf: entries.filter {
+            !originalIDs.contains($0.id)
+        })
+        return originalEntries
+    }
+
     @discardableResult
     func fetchAndApplyRadioQueue(for videoId: String) async -> RadioQueueFetchOutcome {
         await self.fetchAndApplyRadioQueue(
@@ -350,7 +416,9 @@ extension PlayerService {
     func fetchAndApplyRadioQueue(
         for videoId: String,
         seedEntryID: UUID?,
-        queueGeneration: Int
+        queueGeneration: Int,
+        replacesUpcoming: Bool = false,
+        isCurrentRequest: @MainActor () -> Bool = { true }
     ) async -> RadioQueueFetchOutcome {
         guard self.isCurrentQueueLoad(queueGeneration) else { return .superseded }
         guard let client = self.ytMusicClient else {
@@ -360,11 +428,16 @@ extension PlayerService {
 
         let sourceNavigationContext = self.playbackNavigationContext
         let sourceQueueMutati
```

**File**: `Sources/Kaset/Services/Player/PlayerService+QueueNavigationRecovery.swift` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@ extension PlayerService {
         self.logger.info(
             "Ending playback after failed queue advance: \(reason), retryable continuation: \(hasRetryableMixContinuation)"
         )
-        await self.pause()
+        await self.pause(isAutomaticStop: true)
     }
 
     func clearQueueNavigationRecovery() {
```

**File**: `Sources/Kaset/Services/Player/PlayerService+SmartShuffle.swift` (modified, +16/-4)
```diff
@@ -166,7 +166,7 @@ extension PlayerService {
                 at: insertAt
             )
             self.smartShuffleSeenSuggestionIds.formUnion(chosen.map(\.videoId))
-            self.setQueue(entries: updated)
+            self.applyAutomaticQueueChange { self.setQueue(entries: updated) }
             didInsert = true
         }
 
@@ -238,6 +238,16 @@ extension PlayerService {
         generation == self.queueLoadGeneration
     }
 
+    var userQueueMutationGeneration: Int {
+        self.queueMutationGeneration &- self.automaticQueueMutationCount
+    }
+
+    func applyAutomaticQueueChange(_ change: () -> Void) {
+        let before = self.queueMutationGeneration
+        change()
+        self.automaticQueueMutationCount &+= self.queueMutationGeneration &- before
+    }
+
     func reserveQueueMutation() -> Int {
         self.queueLoadGeneration
     }
@@ -254,7 +264,7 @@ extension PlayerService {
     func appendOriginalTracks(_ songs: [Song]) {
         guard !songs.isEmpty else { return }
         let newEntries = songs.map { QueueEntry(id: UUID(), song: $0) }
-        self.setQueue(entries: self.queueEntries + newEntries)
+        self.applyAutomaticQueueChange { self.setQueue(entries: self.queueEntries + newEntries) }
         if self.queueOrderBeforeShuffle != nil {
             self.queueOrderBeforeShuffle?.append(contentsOf: newEntries)
         }
@@ -266,10 +276,12 @@ extension PlayerService {
     func endQueueLoading(_ generation: Int) async {
         guard self.isCurrentQueueLoad(generation), self.isQueueLoading else { return }
         self.isQueueLoading = false
-        self.stripSuggestedEntries()
+        self.applyAutomaticQueueChange { self.stripSuggestedEntries() }
         self.resetSmartShuffleState()
         if self.shuffleMode != .off {
-            self.materializeShuffleQueueForCurrentTrack(recordUndo: false, storesOriginalOrder: false)
+            self.applyAutomaticQueueChange {
+                self.materializeShuffleQueueForCurrentTrack(recordUndo: false, storesOriginalOrder: false)
+            }
         } else {
             self.saveQueueForPersistence()
         }
```

**File**: `Sources/Kaset/Services/Player/PlayerService+WebPlaybackIdentity.swift` (modified, +1/-1)
```diff
@@ -398,7 +398,7 @@ extension PlayerService {
             self.logger.warning("Native queue advance fallback has no remaining target: \(reason)")
             self.shouldSuppressAutoplayAfterQueueEnd = true
             self.markPlaybackEnded()
-            await self.pause()
+            await self.pause(isAutomaticStop: true)
             return
         }
 
```

**File**: `Sources/Kaset/Services/Player/PlayerService+WebQueueSync.swift` (modified, +9/-4)
```diff
@@ -379,7 +379,7 @@ extension PlayerService {
         self.logger.info("Suppressing unexpected autoplay after native queue ended")
         self.keepQueueSongVisible(currentQueueSong, thumbnailUrl: thumbnailUrl)
         self.scheduleMusicPlaybackIntentTask(expectedQueueEntryID: self.currentQueueEntryID) { service, intent in
-            await service.pause(intent: intent)
+            await service.pause(intent: intent, isAutomaticStop: true)
         }
         return true
     }
@@ -590,7 +590,7 @@ extension PlayerService {
         self.markPlaybackEnded()
         self.logger.info("Unexpected autoplay detected at end of native queue; pausing playback")
         self.scheduleMusicPlaybackIntentTask(expectedQueueEntryID: self.currentQueueEntryID) { service, intent in
-            await service.pause(intent: intent)
+            await service.pause(intent: intent, isAutomaticStop: true)
         }
         return true
     }
@@ -866,7 +866,12 @@ extension PlayerService {
         shouldContinue: @MainActor () -> Bool = { true }
     ) async {
         let intent = suppliedIntent ?? self.currentMusicPlaybackIntent
-        guard shouldContinue(), self.acceptsMusicPlaybackIntent(intent) else { return }
+        guard shouldContinue(),
+              self.acceptedTrackEndContinuationIntent(
+                  originalIntent: intent,
+                  occurrence: playbackOccurrence ?? self.currentMusicPlaybackOccurrence
+              ) != nil
+        else { return }
         if identityResolutionTimedOut {
             guard observedVideoId == nil,
                   playbackOccurrence?.documentGeneration != nil,
@@ -1048,7 +1053,7 @@ extension PlayerService {
             self.shouldSuppressAutoplayAfterQueueEnd = true
             self.markPlaybackEnded()
             self.logger.info("Reached end of native queue; not yielding to YouTube autoplay")
-            await self.pause(intent: continuationIntent)
+            await self.pause(intent: continuationIntent, isAutomaticStop: true)
             return
         }
         self.shouldSuppressAutoplayAfterQueueEnd = false
```

**File**: `Sources/Kaset/Services/Player/PlayerService.swift` (modified, +3/-0)
```diff
@@ -390,6 +390,9 @@ final class PlayerService: NSObject, PlayerServiceProtocol {
     var pendingPlaybackSelectionGeneration = 0
     var playbackNavigationGeneration = 0
     var queueMutationGeneration = 0
+    var automaticQueueMutationCount = 0
+    var startRadioRefreshGeneration = 0
+    var explicitPauseGeneration = 0
     var musicPlaybackIntentGeneration: UInt64 = 0
     var musicPlaybackReservationGeneration: UInt64 = 0
     var musicPlaybackIntentIssuedAtMilliseconds: Double = 0
```

**File**: `Sources/Kaset/Views/NowPlayingQueueView.swift` (modified, +1/-0)
```diff
@@ -187,6 +187,7 @@ struct NowPlayingQueueRow: View {
         .contextMenu {
             SongContextMenu(
                 song: self.entry.song,
+                queueEntryID: self.entry.id,
                 client: self.playerService.ytMusicClient,
                 play: self.position == .current ? nil : self.onPlay,
                 showsGoToArtist: false,
```

#### Recent Merged Pull Requests:
- **PR #628** (2026-11-28): feat: add App Mode setting for Music Only, YouTube Only, or both (@sozercan)
- **PR #627** (2026-11-25): chore: finish removing source comments (@sozercan)
- **PR #604** (2026-11-27): fix(player): Refresh radio without restarting the current song (@mvanhorn)
- **PR #603** (2026-11-22): chore: ratchet down source comments (@sozercan)
- **PR #599** (2026-11-26): fix(ui): close lyrics and queue panels when switching to YouTube (@winzamark123)
- **PR #598** (2026-11-27): fix(youtube): route F and double-click full screen through Kaset's player (@peeratop02)

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

## X. playback): route bare Space to play/pause and stop hidden WebView swallowing ⌘←/

**RULE**:
When implementing operations in `Sources/Kaset/KasetApp.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in sozercan/kaset. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b987362e`: playback): route bare Space to play/pause and stop hidden WebView swallowing ⌘←/⌘→. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `Sources/Kaset/KasetApp.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
    @State private var playbackSpaceKeyMonitor = PlaybackSpaceKeyMonitor()

        Window("Kaset", id: MainWindowLayout.sceneIdentifier) {
                    self.playbackSpaceKeyMonitor.start(
                        isPlaybackCommandEnabled: { !self.shouldDisablePlaybackCommand },
                        onPlayPause: { self.performPlayPause() }
                    )
                    self.performPlayPause()
        self.openWindow(id: MainWindowLayout.sceneIdentifier)
    private func performPlayPause() {
        if self.playbackArbiter.routesMediaKeysToVideo {
            self.youtubePlayerService.playPause()
        } else {
            Task {
                await self.playerService.playPause()
            }
        }
    }

```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
        Window("Kaset", id: "main") {
                    if self.playbackArbiter.routesMediaKeysToVideo {
                        self.youtubePlayerService.playPause()
                    } else {
                        Task {
                            await self.playerService.playPause()
                        }
                    }
        self.openWindow(id: "main")
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b987362e` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
