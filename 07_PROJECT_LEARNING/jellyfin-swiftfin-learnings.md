> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/jellyfin-swiftfin-learnings.md`  
> **Source**: github ([https://github.com/jellyfin/Swiftfin](https://github.com/jellyfin/Swiftfin))  
> **Source Version**: `2e354062`  
> **License**: MPL-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-25T20:49:20.010Z  
> **Learning ID**: `learn-github-jellyfin-swiftfin`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): jellyfin/Swiftfin

> **Canonical Artifact**: `07_PROJECT_LEARNING/jellyfin-swiftfin-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/jellyfin/Swiftfin](https://github.com/jellyfin/Swiftfin))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-25T20:49:20.005Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `jellyfin/Swiftfin`
- **Description**: Native Jellyfin Client for iOS and tvOS 
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 4238 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Shared/Components/EPG/Body/Components/EPGScrollState.swift`
```
//
// Swiftfin is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, you can obtain one at https://mozilla.org/MPL/2.0/.
//
// Copyright (c) 2026 Jellyfin & Jellyfin Contributors
//

import Combine
import UIKit

final class EPGScrollState {

    private let visibleLeadingOffsetSubject = CurrentValueSubject<CGFloat, Never>(0)

    var visibleLeadingOffset: CGFloat {
        visibleLeadingOffsetSubject.value
    }

    var visibleLeadingOffsetPublisher: AnyPublisher<CGFloat, Never> {
        visibleLeadingOffsetSubject.eraseToAnyPublisher()
    }

    func update(visibleLeadingOffset: CGFloat) {
        guard abs(self.visibleLeadingOffset - visibleLeadingOffset) > 0.5 else { return }

        visibleLeadingOffsetSubject.send(visibleLeadingOffset)
    }
}

```

### Core Architecture Module: `Shared/Errors/NetworkError.swift`
```
//
// Swiftfin is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, you can obtain one at https://mozilla.org/MPL/2.0/.
//
// Copyright (c) 2026 Jellyfin & Jellyfin Contributors
//

import Foundation
import JellyfinAPI

// This is only kept as reference until more strongly-typed errors are implemented.

// enum NetworkError: Error {
//
//    /// For the case that the ErrorResponse object has a code of -1
//    case URLError(response: ErrorResponse, displayMessage: String?)
//
//    /// For the case that the ErrorRespones object has a code of -2
//    case HTTPURLError(response: ErrorResponse, displayMessage: String?)
//
//    /// For the case that the ErrorResponse object has a positive code
//    case JellyfinError(response: ErrorResponse, displayMessage: String?)
//
//    var errorMessage: ErrorMessage {
//        switch self {
//        case let .URLError(response, displayMessage):
//            return NetworkError.parseURLError(from: response, displayMessage: displayMessage)
//        case let .HTTPURLError(response, displayMessage):
//            return NetworkError.parseHTTPURLError(from: response, displayMessage: displayMessage)
//        case let .JellyfinError(response, displayMessage):
//            return NetworkError.parseJellyfinError(from: response, displayMessage: displayMessage)
//        }
//    }
//
//    private static func parseURLError(from response: ErrorResponse, displayMessage: String?) -> ErrorMessage {
//        let errorMessage: ErrorMessage
//
//        switch response {
//        case let .error(_, _, _, err):
//
//            // Code references:
//            // https://developer.apple.com/documentation/foundation/1508628-url_loading_system_error_codes
//            switch err._code {
//            case -1001:
//                errorMessage = ErrorMessage(
//                    code: err._code,
//                    title: L10n.error,
//                    message: L10n.networkTimedOut
//                )
//            case -1003:
//                errorMessage = ErrorMessage(
//                    code: err._code,
//                    title: L10n.error,
//                    message: L10n.unableToFindHost
//                )
//            case -1004:
//                errorMessage = ErrorMessage(
//                    code: err._code,
//                    title: L10n.error,
//                    message: L10n.cannotConnectToHost
//                )
//            default:
//                errorMessage = ErrorMessage(
//                    code: err._code,
//                    title: L10n.error,
//                    message: L10n.unknownError
//                )
//            }
//        }
//
//        return errorMessage
//    }
//
//    private static func parseHTTPURLError(from response: ErrorResponse, displayMessage: String?) -> ErrorMessage {
//        let errorMessage: ErrorMessage
//
//        // Not implemented as has not run into one of these errors as time of writing
//        switch response {
//        case .error:
//            errorMessage = ErrorMessage(
//                code: 0,
//                title: L10n.error,
//                message: "An HTTP URL error has occurred"
//            )
//        }
//
//        return errorMessage
//    }
//
//    private static func parseJellyfinError(from response: ErrorResponse, displayMessage: String?) -> ErrorMessage {
//        let errorMessage: ErrorMessage
//
//        switch response {
//        case let .error(code, _, _, _):
//
//            // Generic HTTP status codes
//            switch code {
//            case 401:
//                errorMessage = ErrorMessage(
//                    code: code,
//                    title: L10n.unauthorized,
//                    message: L10n.unauthorizedUser
//                )
//            default:
//                errorMessage = ErrorMessage(
//                    code: code,
//                    title: L10n.error,
//                    message: displayMessage ?? L10n.unknownError
//                )
//            }
//        }
//
//        return errorMessage
//    }
// }

```

### Core Architecture Module: `Shared/Extensions/JellyfinAPI/PlayerStateInfo.swift`
```
//
// Swiftfin is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, you can obtain one at https://mozilla.org/MPL/2.0/.
//
// Copyright (c) 2026 Jellyfin & Jellyfin Contributors
//

import Foundation
import JellyfinAPI

extension PlayerStateInfo {

    var position: Duration? {
        guard let positionTicks else { return nil }

        return Duration.microseconds(positionTicks / 10)
    }

    @available(*, deprecated, message: "Use `position` instead")
    var positionSeconds: Int? {
        guard let positionTicks else { return nil }

        return positionTicks / 10_000_000
    }
}

```

### Core Architecture Module: `Shared/Extensions/JellyfinAPI/PlaystateCommand.swift`
```
//
// Swiftfin is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, you can obtain one at https://mozilla.org/MPL/2.0/.
//
// Copyright (c) 2026 Jellyfin & Jellyfin Contributors
//

import JellyfinAPI
import SwiftUI

extension PlaystateCommand: Displayable, SystemImageable {

    var displayTitle: String {
        switch self {
        case .stop:
            L10n.stop
        case .pause:
            L10n.pause
        case .unpause:
            L10n.play
        case .nextTrack:
            L10n.next
        case .previousTrack:
            L10n.previous
        case .seek:
            L10n.seek
        case .rewind:
            L10n.rewind
        case .fastForward:
            L10n.fastForward
        case .playPause:
            L10n.playAndPause
        }
    }

    var systemImage: String {
        switch self {
        case .stop:
            "stop.fill"
        case .pause:
            "pause.fill"
        case .unpause:
            "play.fill"
        case .nextTrack:
            "forward.end.fill"
        case .previousTrack:
            "backward.end.fill"
        case .seek:
            "timeline.selection"
        case .rewind:
            "backward.fill"
        case .fastForward:
            "forward.fill"
        case .playPause:
            "playpause.fill"
        }
    }
}

```

### Core Architecture Module: `Shared/Extensions/JellyfinAPI/TaskState.swift`
```
//
// Swiftfin is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, you can obtain one at https://mozilla.org/MPL/2.0/.
//
// Copyright (c) 2026 Jellyfin & Jellyfin Contributors
//

import Foundation
import JellyfinAPI

extension TaskState: Displayable {

    var displayTitle: String {
        switch self {
        case .cancelling:
            L10n.cancelling
        case .idle:
            L10n.idle
        case .running:
            L10n.running
        }
    }
}

```

### Core Architecture Module: `Shared/Logging/SwiftfinCorestoreLogger.swift`
```
//
// Swiftfin is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, you can obtain one at https://mozilla.org/MPL/2.0/.
//
// Copyright (c) 2026 Jellyfin & Jellyfin Contributors
//

import CoreStore
import Logging

struct SwiftfinCorestoreLogger: CoreStoreLogger {

    private let logger = Logger.swiftfin()

    func log(
        error: CoreStoreError,
        message: String,
        fileName: StaticString,
        lineNumber: Int,
        functionName: StaticString
    ) {
        logger.error(
            "\(message)",
            metadata: nil,
            source: "Corestore",
            file: fileName.description,
            function: functionName.description,
            line: UInt(lineNumber)
        )
    }

    func log(
        level: LogLevel,
        message: String,
        fileName: StaticString,
        lineNumber: Int,
        functionName: StaticString
    ) {
        logger.log(
            level: level.asSwiftLog,
            "\(message)",
            metadata: nil,
            source: "Corestore",
            file: fileName.description,
            function: functionName.description,
            line: UInt(lineNumber)
        )
    }

    func assert(
        _ condition: @autoclosure () -> Bool,
        message: @autoclosure () -> String,
        fileName: StaticString,
        lineNumber: Int,
        functionName: StaticString
    ) {
        guard !condition() else { return }

        logger.critical(
            "\(message())",
            metadata: nil,
            source: "Corestore",
            file: fileName.description,
            function: functionName.description,
            line: UInt(lineNumber)
        )
    }
}

extension CoreStore.LogLevel {

    var asSwiftLog: Logger.Level {
        switch self {
        case .trace:
            .trace
        case .notice:
            .debug
        case .warning:
            .warning
        case .fatal:
            .critical
        }
    }
}

```

### Core Architecture Module: `Shared/Objects/LazyState.swift`
```
//
// Swiftfin is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, you can obtain one at https://mozilla.org/MPL/2.0/.
//
// Copyright (c) 2026 Jellyfin & Jellyfin Contributors
//

import SwiftUI

@MainActor
@propertyWrapper
struct LazyState<Value>: @preconcurrency DynamicProperty {

    final class Box {

        private var value: Value!
        private let thunk: () -> Value
        var didThunk = false

        var wrappedValue: Value {
            value
        }

        func setup() {
            value = thunk()
            didThunk = true
        }

        init(wrappedValue thunk: @autoclosure @escaping () -> Value) {
            self.thunk = thunk
        }
    }

    @State
    private var holder: Box

    var wrappedValue: Value {
        holder.wrappedValue
    }

    var projectedValue: Binding<Value> {
        Binding(get: { wrappedValue }, set: { _ in })
    }

    func update() {
        guard !holder.didThunk else { return }

        holder.setup()
    }

    init(wrappedValue thunk: @autoclosure @escaping () -> Value) {
        _holder = State(wrappedValue: Box(wrappedValue: thunk()))
    }
}

```

### Core Architecture Module: `Shared/Objects/MediaPlayerManager/PlaybackState.swift`
```
//
// Swiftfin is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, you can obtain one at https://mozilla.org/MPL/2.0/.
//
// Copyright (c) 2026 Jellyfin & Jellyfin Contributors
//

import Foundation

/// Observations from an engine, independent of what the user has requested.
struct PlaybackState: Equatable {

    var isReady = false
    var isPlaying = false
    var isSeekable = false
    var isSeeking = false
    var isWaitingForDisplay = false
    var duration: Duration?
    var isBuffering = false
}

/// Only one seek is dispatched at a time. Requests made while it runs replace
/// the queued target, but update the displayed position immediately.
struct PlaybackTimeline {

    struct Seek: Equatable {

        let id = UUID()
        let target: Duration
    }

    private(set) var observed: Duration = .zero
    private(set) var pending: Seek?
    private(set) var inFlight: Seek?

    var displayed: Duration {
        pending?.target ?? observed
    }

    mutating func observe(_ position: Duration) {
        observed = max(.zero, position)
    }

    mutating func requestSeek(to position: Duration, duration: Duration?) {
        let target = max(.zero, duration.map { min(position, $0) } ?? position)
        guard target != displayed else { return }

        pending = Seek(target: target)
    }

    mutating func beginSeek() -> Seek? {
        guard inFlight == nil, let pending else { return nil }

        inFlight = pending

        return pending
    }

    /// A completion for a previous load or request cannot clear a newer intent.
    @discardableResult
    mutating func completeSeek(_ id: UUID, position: Duration?) -> Bool {
        guard inFlight?.id == id else { return false }

        if let position {
            observe(position)
        }

        if pending?.id == id {
            pending = nil
        }

        inFlight = nil

        return true
    }

    mutating func reset(position: Duration = .zero) {
        self = PlaybackTimeline()
        observe(position)
    }
}

```

### Core Architecture Module: `Shared/Objects/MediaPlayerManager/Players/VideoPlaybackState.swift`
```
//
// Swiftfin is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, you can obtain one at https://mozilla.org/MPL/2.0/.
//
// Copyright (c) 2026 Jellyfin & Jellyfin Contributors
//

import Foundation

struct VideoPlaybackState: Equatable, Sendable {

    var videoSize: CGSize = .zero
    var droppedFrames: Int = 0
    var corruptedFrames: Int = 0
}

```

### Core Architecture Module: `Shared/Objects/MediaPlayerManager/Supplements/Components/MediaPlayerQueue.swift`
```
//
// Swiftfin is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, you can obtain one at https://mozilla.org/MPL/2.0/.
//
// Copyright (c) 2026 Jellyfin & Jellyfin Contributors
//

import Observation

enum MediaPlayerQueueState {

    case initial
    case loading
    case content
    case error
}

@MainActor
protocol MediaPlayerQueue: AnyObject, Observable, MediaSessionObserver {

    var state: MediaPlayerQueueState { get }
    var items: [ItemEntry] { get }
    var currentEntryID: ItemEntry.ID? { get }

    var hasNextItem: Bool { get }
    var hasPreviousItem: Bool { get }

    var nextItem: PlaybackIntent? { get }
    var previousItem: PlaybackIntent? { get }

    func resolve(_ intent: PlaybackIntent, userSession: UserSession) async throws -> PlaybackIntent
    func next() async throws -> PlaybackIntent?
    func refresh()
    func select(_ entry: ItemEntry)
}

extension MediaPlayerQueue {

    func resolve(_ intent: PlaybackIntent, userSession: UserSession) async throws -> PlaybackIntent {
        intent
    }

    func next() async throws -> PlaybackIntent? {
        nextItem
    }

    var hasNextItem: Bool {
        nextItem != nil
    }

    var hasPreviousItem: Bool {
        previousItem != nil
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2380** (2026-10-25): **TvOS client does not respect server settings for continuing with the same audio and subtitle track as the previous episode in a series**
  *Symptoms*: ### This issue respects the following points:  - [x] This is a **bug**, not a question or a configuration issue; Please visit our [forum or chat rooms](https://jellyfin.org/contact/) first to troubleshoot with volunteers, before creating a report. - [x] This issue is **not** already reported on [GitHub](https://github.com/jellyfin/Swiftfin/issues?q=is%3Aopen+is%3Aissue). - [x] I have read the [Common Issues](https://github.com/jellyfin/Swiftfin/blob/main/Documentation/common_issues.md) documentation and this issue was not mentioned there. - [x] I'm using an up to date version of Swiftfin; We generally do not support previous older versions. If possible, please update to the latest version before opening an issue. - [x] I agree to follow Jellyfin's [Code of Conduct](https://jellyfin.org/docs/general/community-standards.html#code-of-conduct).  ### Description of the bug  The server has settings to keep playing in the same audio and subtitle language when you continue from one episode of a series to the next. The settings are "Set audio track based on previous item" and "Set subtitle track based on previous item" in the Playback settings in the server.  When playing through jellyfin's web client, if I am watching a show in Dutch with Portugese subtitles and the next episode autoplays, it stays in dutch with portugese subs even if those aren't the default tracks. In swiftfin, it always goes to the default tracks, requiring me to pause and adjust everything at the beginning of eve

- **Issue #2379** (2026-10-25): **tvOS client does not respect Apple TV certificates**
  *Symptoms*: ### This issue respects the following points:  - [x] This is a **bug**, not a question or a configuration issue; Please visit our [forum or chat rooms](https://jellyfin.org/contact/) first to troubleshoot with volunteers, before creating a report. - [x] This issue is **not** already reported on [GitHub](https://github.com/jellyfin/Swiftfin/issues?q=is%3Aopen+is%3Aissue). - [x] I have read the [Common Issues](https://github.com/jellyfin/Swiftfin/blob/main/Documentation/common_issues.md) documentation and this issue was not mentioned there. - [x] I'm using an up to date version of Swiftfin; We generally do not support previous older versions. If possible, please update to the latest version before opening an issue. - [x] I agree to follow Jellyfin's [Code of Conduct](https://jellyfin.org/docs/general/community-standards.html#code-of-conduct).  ### Description of the bug  i'm on 1.6.1. my jellyfin is behind a reverse proxy and I'm using self signed certificates. these certificates are installed on my Apple Tv and other apps are using these certificates when connecting to services behind this reverse proxy. however, swiftfin complains about these certificates and does not connect to my Jellyfin server.  ### Reproduction steps  Open Swiftfin and try to connect to Jellyfin that's behind a reverse proxy with self signed certificates  ### Platform  tvOS  ### Application version  1.6.1  ### Where did you install the app from?  App Store  ### Device information  Apple TV HD  ### OS ver
  **Post-Mortem & Fix Analysis**:
  > Hey, do you use auto discovery? i.e. does swiftfin use ip instead of domain name? do you terminate TLS on Jelly or ingress / load balancer?  I have similar setup - Apple TV 4K 1st gen, Swiftfin 1.6.1, iOS 26.6; custom CA, trusted root on atv; tls terminated before jelly, on traefik - and for me it connects with no issue

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

### Incident Patch 1: `2e354062` (2026-10-25)
**Commit Message**: Update project document to `.xcproj` (#2385)

**File**: `Swiftfin.xcodeproj/project.pbxproj` (removed, +0/-1821)
```diff
@@ -1,1821 +0,0 @@
-// !$*UTF8*$!
-{
-	archiveVersion = 1;
-	classes = {
-	};
-	objectVersion = 71;
-	objects = {
-
-/* Begin PBXBuildFile section */
-		53ABFDDC267972BF00886593 /* TVServices.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 53ABFDDB267972BF00886593 /* TVServices.framework */; };
-		62666DFD27E5014F00EC0ECD /* AudioToolbox.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 5362E4AE267D40B5000E2F71 /* AudioToolbox.framework */; };
-		62666DFE27E5015700EC0ECD /* AVFoundation.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 5362E4AA267D40AD000E2F71 /* AVFoundation.framework */; };
-		62666DFF27E5016400EC0ECD /* CFNetwork.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 5362E4B0267D40B9000E2F71 /* CFNetwork.framework */; };
-		62666E0127E5016900EC0ECD /* CoreFoundation.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 62666E0027E5016900EC0ECD /* CoreFoundation.framework */; };
-		62666E0227E5016D00EC0ECD /* CoreGraphics.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 5362E4B6267D40CA000E2F71 /* CoreGraphics.framework */; };
-		62666E0327E5017100EC0ECD /* CoreMedia.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 5362E4B8267D40CE000E2F71 /* CoreMedia.framework */; };
-		62666E0427E5017500EC0ECD /* CoreText.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 5362E4BA267D40D2000E2F71 /* CoreText.framework */; };
-		62666E0627E5017A00EC0ECD /* CoreVideo.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 62666E0527E5017A00EC0ECD /* CoreVideo.framework */; };
-		62666E0C27E501A500EC0ECD /* OpenGLES.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 62666E0B27E501A500EC0ECD /* OpenGLES.framework */; };
-		62666E0D27E501AA00EC0ECD /* QuartzCore.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 5362E4C2267D40EC000E2F71 /* QuartzCore.framework */; };
-		62666E0E27E501AF00EC0ECD /* Security.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 5362E4C4267D40F0000E2F71 /* Security.framework */; };
-		62666E1027E501B400EC0ECD /* VideoToolbox.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 62666E0F27E501B400EC0ECD /* VideoToolbox.framework */; };
-		62666E1127E501B900EC0ECD /* UIKit.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 5362E4C8267D40F7000E2F71 /* UIKit.framework */; };
-		62666E1327E501C300EC0ECD /* AudioToolbox.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 62666E1227E501C300EC0ECD /* AudioToolbox.framework */; };
-		62666E1527E501C800EC0ECD /* AVFoundation.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 62666E1427E501C800EC0ECD /* AVFoundation.framework */; };
-		62666E1727E501CC00EC0ECD /* CFNetwork.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 62666E1627E501CC00EC0ECD /* CFNetwork.framework */; };
-		62666E1927E501D000EC0ECD /* CoreFoundation.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 62666E1827E501D000EC0ECD /* CoreFoundation.framework */; };
-		62666E1B27E501D400EC0ECD /* CoreGraphics.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 62666E1A27E501D400EC0ECD /* CoreGraphics.framework */; };
-		62666E1D27E501DB00EC0ECD /* CoreMedia.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 62666E1C27E501DB00EC0ECD /* CoreMedia.framework */; };
-		62666E1F27E501DF00EC0ECD /* CoreText.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 62666E1E27E501DF00EC0ECD /* CoreText.framework */; };
-		62666E2127E501E400EC0ECD /* CoreVideo.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 62666E2027E501E400EC0ECD /* CoreVideo.framework */; };
-		62666E2327E501EB00EC0ECD /* Foundation.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 62666E2227E501EB00EC0ECD /* Foundation.framework */; };
-		62666E2427E501F300EC0ECD /* Foundation.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 5362E4BC267D40D8000E2F71 /* Foundation.framework */; };
-		62666E2A27E5020A00EC0ECD /* OpenGLES.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 62666E2927E5020A00EC0ECD /* OpenGLES.framework */; };
-		62666E2C27E5021000EC0ECD /* QuartzCore.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 62666E2B27E5021000EC0ECD /* QuartzCore.framework */; };
-		62666E2E27E5021400EC0ECD /* Security.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 62666E2D27E5021400EC0ECD /* Security.framework */; };
-		62666E3027E5021800EC0ECD /* VideoToolbox.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 62666E2F27E5021800EC0ECD /* VideoToolbox.framework */; };
-		62666E3227E5021E00EC0ECD /* UIKit.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 62666E3127E5021E00EC0ECD /* UIKit.framework */; };
-		62666E3E27E503FA00EC0ECD /* MediaAccessibility.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 5362E4BE267D40E4000E2F71 /* MediaAccessibility.framework */; };
-		62666E3F27E5040300EC0ECD /* SystemConfiguration.framework in Frameworks */ = {isa = PBXBuildFile; f
```

**File**: `Swiftfin.xcodeproj/project.xcproj` (added, +983/-0)
```diff
@@ -0,0 +1,983 @@
+{
+  "default-configuration": "Release",
+  "configurations": [
+    { "name": "Debug", "file": { "anchor": "XcodeConfig", "relative-path": "Shared.xcconfig" } },
+    "Release",
+  ],
+  "localizations": {
+    "development": "en",
+    "supported": [
+      "Base",
+      "af",
+      "ar",
+      "bg",
+      "ca",
+      "cs",
+      "da",
+      "de",
+      "el",
+      "enm",
+      "eo",
+      "es",
+      "et",
+      "eu",
+      "fa",
+      "fi",
+      "fr",
+      "gl",
+      "he",
+      "hi",
+      "hr",
+      "hu",
+      "id",
+      "it",
+      "ja",
+      "ka",
+      "kk",
+      "km",
+      "ko",
+      "lb",
+      "lt",
+      "lv",
+      "mk",
+      "ml",
+      "mn",
+      "nb-NO",
+      "nl",
+      "nn",
+      "peo",
+      "pl",
+      "ps",
+      "pt",
+      "pt-BR",
+      "ro",
+      "ru",
+      "sk",
+      "sl",
+      "sq",
+      "sv",
+      "ta",
+      "th",
+      "tr",
+      "uk",
+      "vi",
+      "zh-Hans",
+      "zh-Hant",
+    ],
+  },
+  "packages": [
+    {
+      "kind": "remote",
+      "repository": "https://github.com/siteline/SwiftUI-Introspect",
+      "version": {
+        "up-to-next-major-version": "27.0.0",
+      },
+    }, {
+      "kind": "remote",
+      "repository": "https://github.com/JohnEstropia/CoreStore.git",
+      "version": {
+        "version": "9.2.0",
+      },
+    }, {
+      "kind": "remote",
+      "repository": "https://github.com/sindresorhus/Defaults",
+      "version": {
+        "up-to-next-major-version": "9.0.0",
+      },
+    }, {
+      "kind": "remote",
+      "repository": "https://github.com/apple/swift-algorithms.git",
+      "version": {
+        "up-to-next-major-version": "1.0.0",
+      },
+    }, {
+      "kind": "remote",
+      "repository": "https://github.com/kean/Nuke",
+      "version": {
+        "up-to-next-major-version": "13.0.0",
+      },
+    }, {
+      "kind": "remote",
+      "repository": "https://github.com/LePips/BlurHashKit",
+      "version": {
+        "up-to-next-major-version": "2.0.0",
+      },
+    }, {
+      "kind": "remote",
+      "repository": "https://github.com/hmlongco/Factory",
+      "version": {
+        "up-to-next-major-version": "3.0.0",
+      },
+    }, {
+      "kind": "remote",
+      "repository": "https://github.com/JohnSundell/Files",
+      "version": {
+        "up-to-next-major-version": "4.0.0",
+      },
+    }, {
+      "kind": "remote",
+      "repository": "https://github.com/kean/Pulse",
+      "version": {
+        "up-to-next-major-version": "5.0.0",
+      },
+    }, {
+      "kind": "remote",
+      "repository": "https://github.com/apple/swift-collections.git",
+      "version": {
+        "up-to-next-major-version": "1.0.0",
+      },
+    }, {
+      "kind": "remote",
+      "repository": "https://github.com/kean/PulseLogHandler",
+      "version": {
+        "up-to-next-major-version": "5.0.0",
+      },
+    }, {
+      "kind": "local",
+      "path": "PreferencesView",
+    }, {
+      "kind": "remote",
+      "repository": "https://github.com/googlecast/google-cast-ios-sdk",
+      "version": {
+        "version": "4.8.6",
+      },
+    }, {
+      "kind": "local",
+      "path": "SwiftfinMacros",
+    }, {
+      "kind": "remote",
+      "repository": "https://github.com/SVGKit/SVGKit",
+      "version": {
+        "up-to-next-major-version": "3.0.0",
+      },
+    }, {
+      "kind": "remote",
+      "repository": "https://github.com/evgenyneu/keychain-swift",
+      "version": {
+        "up-to-next-major-version": "24.0.0",
+      },
+    }, {
+      "kind": "remote",
+      "repository": "https://github.com/guoyingtao/Mantis",
+      "version": {
+        "up-to-next-major-version": "2.0.0",
+      },
+    }, {
+      "kind": "remote",
+      "repository": "https://github.com/pointfreeco/swift-identified-collections",
+      "version": {
+        "up-to-next-major-version": "1.1.0",
+      },
+    }, {
+      "kind": "remote",
+      "repository": "https://github.com/ViacomInc/TVOSPicker",
+      "version": {
+        "up-to-next-minor-version": "0.3.0",
+      },
+    }, {
+      "kind": "remote",
+      "repository": "https://github.com/LePips/MPVUI",
+      "version": {
+        "version": "0.7.0",
+      },
+    }, {
+      "kind": "remote",
+      "repository": "https://github.com/LePips/MediaAccessibilityKit",
+      "version": {
+        "version": "0.3.0",
+      },
+    }, {
+      "kind": "remote",
+      "repository": "https://github.com/nathantannar4/Transmission",
+      "version": {
+        "up-to-next-major-version": "2.13.4",
+      },
+    }, {
+      "kind": "remote",
+      "repository": "https://github.com/LeoNatan/LNPopupUI/",
+      "version": {
+        "up-to-next-minor-version": "2.0.0",
+      },
+    }, {
+      "kind": "remote",
+      "repository": "https://github.com/jellyfin/jellyfin-sdk-swift.git",
+      "version": {
+        "up-to-next-major-version": "3.3.0",
+   
```

---

### Incident Patch 2: `a9998844` (2026-10-25)
**Commit Message**: Playback intents (#2382)

**File**: `.github/workflows/ci.yml` (modified, +2/-2)
```diff
@@ -29,10 +29,10 @@ jobs:
           - "Swiftfin"
           - "Swiftfin tvOS"
 
-    runs-on: macos-26
+    runs-on: xcode-27
 
     env:
-      XCODE_VERSION: "26.6"
+      XCODE_VERSION: "27.1"
 
     steps:
       - name: Checkout
```

**File**: `.github/workflows/testflight.yml` (modified, +2/-2)
```diff
@@ -79,11 +79,11 @@ jobs:
   test_build:
     name: Build and upload to TestFlight
     needs: resolve_platform
-    runs-on: macos-26
+    runs-on: xcode-27
     strategy:
       matrix: ${{ fromJSON(needs.resolve_platform.outputs.matrix) }}
     env:
-      XCODE_VERSION: "26.6"
+      XCODE_VERSION: "27.1"
       PLATFORM: ${{ matrix.platform }}
       SCHEME: ${{ matrix.scheme }}
       BUILD_CERTIFICATE_BASE64: ${{ github.event.client_payload.BUILD_CERTIFICATE_BASE64 || secrets.BUILD_CERTIFICATE_BASE64 }}
```

**File**: `AGENTS.md` (modified, +1/-1)
```diff
@@ -1,3 +1,3 @@
 # AGENTS.md
 
-- If using XcodeBuildMCP, use the installed XcodeBuildMCP skill before calling XcodeBuildMCP tools.
+- Do not open Pull Requests against the upstream repo.
\ No newline at end of file
```

**File**: `Documentation/common_issues.md` (modified, +13/-25)
```diff
@@ -10,49 +10,39 @@ If your issue isn't here, please check our [existing issues](https://github.com/
 
 These four steps resolve many common issues or help narrow down unique issues from known ones:
 
-| Step | Why |
-|------|-----|
-| **1. Update Swiftfin** | We are only able to support the current release which may already have a code fix for the issue you are experiencing. If you see a closed issue for your problem, but it's still not resolved on the latest release, please try using our [TestFlight](https://testflight.apple.com/join/SqNPfdxq) before reporting a new issue. |
-| **2. Switch the player** <br>*Settings > Advanced > Video Player > Engine* | Each player is based on a different playback engine. Confirming which player(s) has an issue helps narrow the troubleshooting steps. |
-| **3. Connect by direct `IP:port`** | If this works and your domain doesn't, the problem is your reverse proxy or network. |
-| **4. Check the logs** <br>*Login Issues: Settings > Advanced > Logs* <br>*Other Issues: Settings > Logs* | These logs show network traffic and logs for Swiftfin. Identifying the failing decodes or packets that exist can help resolve network/proxy issues. |
+| Step                                                                                                     | Why                                                                                                                                                                                                                                                                                                                              |
+| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
+| **1. Update Swiftfin**                                                                                   | We are only able to support the current release which may already have a code fix for the issue you are experiencing. If you see a closed issue for your problem, but it's still not resolved on the latest release, please try using our [TestFlight](https://testflight.apple.com/join/SqNPfdxq) before reporting a new issue. |
+| **2. Switch the player** <br>*Settings > Advanced > Video Player > Engine*                               | Each player is based on a different playback engine. Confirming which player(s) has an issue helps narrow the troubleshooting steps.                                                                                                                                                                                             |
+| **3. Connect by direct `IP:port`**                                                                       | If this works and your domain doesn't, the problem is your reverse proxy or network.                                                                                                                                                                                                                                             |
+| **4. Check the logs** <br>*Login Issues: Settings > Advanced > Logs* <br>*Other Issues: Settings > Logs* | These logs show network traffic and logs for Swiftfin. Identifying the failing decodes or packets that exist can help resolve network/proxy issues.                                                                                                                                                                              |
 
 ---
 
 ## Playback
 
 ### Nothing Plays, but Browsing Works
 
-Your library, posters, and metadata all load. Pressing play gives a black screen or a spinner. This issue is commonly caused by one of the following:
-
-**Your reverse proxy is TLS 1.3 only.** libvlc only supports TLS **1.1 and 1.2**, so media playback fails while everything else works. NGINX has included 1.3 by default since 1.23.4, so this can appear after an update. Enable 1.2 alongside 1.3 (having both is fine) and libvlc will fall back to using the supported version. This is a libvlc limitation and is documented in the [Players Documentation](players.md).
+Your library, posters, and metadata all load, but pressing play gives a black screen or a spinner. Check the server address and playback logs.
 
 **You entered `http` for an `https` server.** You can sign in and browse everything, but nothing plays. Swiftfin attempts to resolve this at login, but HSTS and redirects can mask the issue since some requests follow the redirect but media requests do not. Re-add the server with the correct scheme.
 
-If neither applies, please test on a direct `IP:port` connection before reporting.
+If the address is correct, please test on a direc
```

**File**: `Documentation/contributing.md` (modified, +13/-33)
```diff
@@ -4,14 +4,14 @@
 
 > Even if you can't contribute code, you can still help Jellyfin (Swiftfin)! The two main things you can help with are testing and creating issues. Contributing to code, documentation, ..., and other non-code components are all outlined in the sections below.
 
+> [!IMPORTANT]
 > Please note [Jellyfin's LLM/AI Development Policy](https://jellyfin.org/docs/general/contributing/llm-policies/) applies to all Swiftfin contributions.
 
 ## Setup
 
 Fork the Swiftfin repo and install the necessary dependencies:
 
 ```bash
-# install homebrew dependencies
 $ brew bundle --file Brewfile
 ```
 
@@ -48,47 +48,33 @@ Swiftfin can be tested using Xcode's built-in Simulator or on real hardware. See
 
 ## Git Flow
 
-Swiftfin follows the same Pull Request Guidelines as outlined in the [Jellyfin Pull Request Guidelines](https://jellyfin.org/docs/general/contributing/development.html#pull-request-guidelines).
+- Swiftfin follows the same Pull Request Guidelines as outlined in the [Jellyfin Pull Request Guidelines](https://jellyfin.org/docs/general/contributing/development.html#pull-request-guidelines).
+- If a Pull Request relates to an Issue, mention the issue correctly in the PR description.
+- [SwiftFormat](https://github.com/nicklockwood/SwiftFormat) is our linter. `swiftformat .` can be run in the project directory or install SwiftFormat's Xcode extension.
+- [SwiftLint](https://github.com/realm/SwiftLint) enforces additional rules.
 
-If a Pull Request relates to an Issue, mention the issue correctly in the PR description.
+The following are necessary to merge a PR:
+- Automated builds succeed
+- Developer account is not attached
+- New strings that are not part of an experimental feature are localized
+- Applicable labels are attached
 
-[SwiftFormat](https://github.com/nicklockwood/SwiftFormat) is our linter. `swiftformat .` can be run in the project directory or install SwiftFormat's Xcode extension.
-
-[SwiftLint](https://github.com/realm/SwiftLint) enforces additional rules.
-
-The following must pass in order for a PR to be merged:
-- automated `iOS` and `tvOS` builds must succeed
-- developer account cannot be attached
-- SwiftFormat linting check must pass. If this does not pass, you may need to update your version of `swiftformat`
-- SwiftLint check must pass. If this does not pass, fix the violation or add a justified `swiftlint:disable` directive
-- new strings that are not part of an experimental feature must be localized
-- label(s) are attached, if applicable
-
-Labeling PRs with `enhancement`, `bug`, or `crash` will allow the PR to be tracked in GitHub's [automatically generated release notes](https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes). Small fixes (like minor UI adjustments) or non-user facing issues (like developer project clean up) can also have the `ignore-for-release` label because they may not be important to include in the release notes.
+PRs labeled with `enhancement`, `bug`, or `crash` will allow the PR to be in [release notes](https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes). Small fixes (like minor UI adjustments) or non-user facing issues (like developer project clean up) can also have the `ignore-for-release` label because they may not be important to include in the release notes.
 
 ## Documentation
+
 Documentation for advanced or complex features and other implementation reasoning is encouraged so that future developers may have insights and a better understand of the application. `// MARK:` comments are encouraged for organization, maintainability, and ease of navigation in Xcode's Minimap.
 
 ## Architecture
 
-Swiftfin is developed using SwiftUI. The iOS and tvOS Jellyfin clients share the same backend with each client containing their respective views. Due to this architecture, working on both clients at once may be necessary.
-
-The VLC player uses [SwiftVLC](https://github.com/harflabs/SwiftVLC) for its great codec support. Becoming familiar with SwiftVLC will be necessary for video playback development and debugging.
+Swiftfin is developed using SwiftUI, with shared components between platforms. Working on all platforms for a single feature may be necessary. See [Player Architecture](players.md#playback-architecture) for understanding playback.
 
 ## Design
 
 While there are no design guidelines for UI/UX features, Swiftfin has the goal to use native SwiftUI/UIKit components while adhering to a Jellyfin theme. If a feature creates new UI/UX components, it may receive feedback during the PR process or may be re-designed later on.
 
 User customizable UI/UX features are welcome and intended, however not all customization may be accepted for code maintainability and to also establish a distinct Swiftfin design. Taking inspiration, but not always copying, from other applications is encouraged.
 
-## App Icons
-
-Ideas for new icons and minor
```

**File**: `Documentation/libraries.md` (modified, +13/-13)
```diff
@@ -2,17 +2,17 @@
 
 The Jellyfin Team is hard at work making Swiftfin the best Jellyfin client possible. As a volunteer-driven project, we unfortunately don't always have the resources to focus on every element that we would like to. Please know that these other library types are not forgotten, and we recognize the importance of additional media support. As we progress, we will update this page to reflect any new developments.
 
-For details on current library support and what is required for future expansion, see the table below.
+For details on current library support and what is required for future expansion, see the table below and open PRs.
 
-| Library Type          | Supported | Notes |
-|-----------------------|-----------|------------------------------------------------------------------------------------------------------------|
-| Shows                | ✅         |
-| Collections          | 🟡         | Only video media in Collections are viewable. |
-| Movies               | ✅         | |
-| Playlists            | ❌         | Not supported. Under review in [PR #1428](https://github.com/jellyfin/Swiftfin/pull/1428). |
-| Mixed      		   | ✅         | This library type is [officially deprecated](https://jellyfin.org/docs/general/server/media/mixed-movies-and-shows) by the Jellyfin server and [may be removed in the future](https://github.com/jellyfin/jellyfin-meta/discussions/46). |
-| Music                | ❌         | Not supported. Music would need to come after Playlist support as this is a common requirement. Music requires an Artist > Album > Song structure, different from other media. Additionally needs a lightweight, *(potentially native)* iOS player and a dedicated playback manager. |
-| Music Videos         | ✅         | |
-| Home Videos          | ✅         | |
-| Photos               | ❌         | Not supported. Viewing photos requires dedicated logic and potentially a photo view package. Current photo viewing packages are most geared towards posters. |
-| Books                | ❌         | Not supported. Requires a book viewer. Lower priority since book reading is not planned for tvOS so this feature would only be usable for mobile clients. |
+| Library Type | Supported | Notes                                                                                                                                                                                                                                                                                |
+| ------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
+| Shows        | ✅         |                                                                                                                                                                                                                                                                                      |
+| Collections  | 🟡         | Only video media in Collections are viewable.                                                                                                                                                                                                                                        |
+| Movies       | ✅         |                                                                                                                                                                                                                                                                                      |
+| Playlists    | ❌         | Not supported.                                                                                                                                                                                                                                                                       |
+| Mixed        | ✅         | This library type is [officially deprecated](https://jellyfin.org/docs/general/server/media/mixed-movies-and-shows) by the Jellyfin server and [may be removed in the future](https://github.com/jellyfin/jellyfin-meta/discussions/46).                                             |
+| Music        | ❌         | Not supported. Music would need to come after Playlist support as this is a common requirement. Music requires an Artist > Album > Song structure, different from other media. Additionally needs a lightweight, *(potentially native)* iOS player and a dedicated playback manager. |
+| Music Videos | ✅         |                                                                                                                                                                                                                                                                                      |
+| Home Videos
```

**File**: `Documentation/players.md` (modified, +97/-145)
```diff
@@ -1,203 +1,155 @@
 # Player Differences
 
-Swiftfin offers two standard player options: **VLC** (SwiftVLC) and **Native** (AVPlayer). The Swiftfin team recommends using VLC for optimal compatibility and features, though Native (AVPlayer) is also available for certain cases that benefit from Apple's native capabilities. All video, audio, and subtitle formats listed are supported for direct playback but may be repackaged based on container support. If transcoding is enabled on your server, any unsupported formats will be converted automatically.
+Swiftfin offers two player engines: **MPV** and **AVPlayer**. MPV is the default and is recommended for the broadest compatibility.
+
+- Formats listed below are supported for direct playback but may be repackaged based on container.
+- Some popular/modern formats are tracked below but an engine's device profile may define more formats. If your media cannot play and isn't listed below, either check the device profile or transcode.
+- If transcoding is enabled on your server, any unsupported formats will be converted automatically.
+- Your device's hardware and your **Playback Quality** settings also affect what is directly played.
 
 ---
 
 ## Feature Support
 
-| Feature                    | VLC | Native (AVPlayer) |
-|----------------------------|-------------------|----------------|
-| **External Audio Tracks**  | ❌                | ❌             |
-| **Framerate Matching**     | ❌                | ✅             |
-| **HDR to SDR Tonemapping** | ✅ [1]            | 🔶 [2]         |
-| **Player Controls**        | - Speed Adjustment <br>- Aspect Fill <br>- Chapter Support <br>- Subtitle Support <br>- Trickplay Support <br>- Audio Track Selection <br>- Customizable UI | - Speed Adjustment <br>- Aspect Fill |
-| **Picture-in-Picture**     | ❌                | ✅             |
-| **TLS Support**            | 1.1, 1.2 [3]      | 1.1, 1.2, 1.3  |
-| **[Airplay Audio Output](https://support.apple.com/en-us/102357)** | 🔶 [4] | ✅ |
-
-**Notes**
-
-[1] HDR to SDR Tonemapping on VLC may have colorspace accuracy variations depending on content and device configuration.
-
-[2] In Native (AVPlayer), HDR to SDR Tonemapping requires Direct Playing compatible MP4 files and may require Dolby Vision Profiles 5 & 8 for full support.
+| Feature                   | MPV   | AVPlayer |
+| ------------------------- | ----- | -------- |
+| Audio Track Selection     | ✅     | ✅        |
+| Subtitle Track Selection  | ✅     | ✅        |
+| Secondary Subtitle        | ✅     | ❌        |
+| Audio & Subtitle Offset   | ✅     | ❌        |
+| External Audio Tracks     | ❌     | ❌        |
+| Speed Adjustment          | ✅     | ✅        |
+| Aspect Fill               | ✅     | ✅        |
+| Chapters & Trickplay      | ✅     | ✅        |
+| Framerate Matching (tvOS) | ❌     | ✅        |
+| HDR to SDR Tone Mapping   | ✅ [1] | ✅ [1]    |
+| Picture-in-Picture (iOS)  | ✅     | ✅        |
+| AirPlay Video             | ❌ [2] | ✅        |
+| Energy Consumption        | 🔶 [3] | ✅        |
 
-[3] libvlc does not support TLS 1.3.
+**Notes:**
 
-[4] VLC has a [known bug that results in a significant audio delay](https://code.videolan.org/videolan/VLCKit/-/issues/544).
+- [1] Tone mapping is performed by your Jellyfin server when a source can't be presented on your device, or when forced with **Force HDR to Transcode** or **Force Dolby Vision to Transcode**.
+- [2] MPV can be used with system screen mirroring, but does not hand video off to AirPlay receivers.
+- [3] MPV uses software decoding for formats your device can't decode in hardware (for example VC-1 or VP9), which uses more power.
 
 ---
 
 ## Container Support
 
-| Container                                                        | VLC | Native (AVPlayer) |
-|------------------------------------------------------------------|-------------------|-------------------|
-| [AVI](https://en.wikipedia.org/wiki/Audio_Video_Interleave)      | ✅                | 🔶 [1]            |
-| [FLV](https://en.wikipedia.org/wiki/Flash_Video)                 | ✅                | ❌                |
-| [M4V](https://en.wikipedia.org/wiki/M4V)                         | ✅                | ✅                |
-| [MKV](https://en.wikipedia.org/wiki/Matroska)                    | ✅                | ❌                |
-| [MOV](https://en.wikipedia.org/wiki/QuickTime_File_Format)       | ✅                | ✅                |
-| [MP4](https://en.wikipedia.org/wiki/MP4_file_format)             | ✅                | ✅                |
-| [MPEG-TS](https://en.wikipedia.org/wiki/MPEG_transport_stream)   | ✅                | 🔶 [1]            |
-| [TS](https://en.wikipedia.org/wiki/MPEG_transport_stream)        | ✅                | 🔶 [1]            |
-| [3G2](https://en.wikipedia.org/wiki/3GP_and_3G2)                 | ✅                | ✅                |
-| [3GP](https://en.wikipedia.org/wiki/3GP_and_3G2)                 | ✅                | ✅                |
-| [WebM](https://en
```

**File**: `Documentation/version.md` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ Jellyfin caters to a “hacker” audience, and older devices are often perfectl
 
 ## OS Support Timeline
 
-Decisions to drop OS versions will aim to be communicated **months in advance**. Work targeting the latest Swiftfin version for a given OS may also delay these changes.
+Decisions to drop OS versions will aim to be communicated **in advance**. Work targeting the latest Swiftfin version for a given OS may also delay these changes.
 
 Older OS versions may still receive **limited support**:
 
```

#### Recent Merged Pull Requests:
- **PR #2385** (2026-10-25): Update project document to `.xcproj` (@LePips)
- **PR #2383** (2026-10-24): Focus User/AddUser on Start (@JPKribs)
- **PR #2382** (2026-10-25): Playback intents (@LePips)
- **PR #2381** (closed): iPhone Duo support (#2289) (@NickMagic25)
- **PR #2378** (closed): Run `swiftformat` (@LePips)
- **PR #2377** (closed): Make iOS filter buttons meet the 44pt hit target (@objectiveSee)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
