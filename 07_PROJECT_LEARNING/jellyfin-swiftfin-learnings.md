> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/jellyfin-swiftfin-learnings.md`  
> **Source**: github ([https://github.com/jellyfin/Swiftfin](https://github.com/jellyfin/Swiftfin))  
> **Source Version**: `8ac23970`  
> **License**: MPL-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-01T00:36:20.256Z  
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
> **Harvest Timestamp**: 2026-11-01T00:36:20.253Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `jellyfin/Swiftfin`
- **Description**: Native Jellyfin Client for iOS and tvOS 
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 4248 stars

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
- **Issue #2384** (2026-10-28): **Remeasure media tiles when the window resizes**
  *Symptoms*: Hi, I’m a longtime Swiftfin user and recently got an iPhone Duo, so I figured I’d contribute a few fixes. Thanks for all the work on Swiftfin; I’m happy to help test and make edits.  Folding and unfolding left some media tiles sized for the previous display, causing overlapping artwork and titles. This change remeasures grids when the window width changes, preserves the leading item when rebuilding horizontal rows, and keeps artwork within its tile.  This covers the media browser only. Session restoration, playback and SDK changes are separate.  I tested the earlier combined build on both Duo displays and the iPhone 18 Pro simulator. This isolated patch builds for iOS and tvOS with Xcode 27.1 and passes SwiftFormat and SwiftLint. Standalone simulator checks cover Home, the library grid and movie details on iPhone 18 Pro and the Duo inner display; window-width changes from 834 to 1,210 points and back on iPad; and tvOS remote focus, browsing and opening movie details. The collection checks verify that cells do not overlap and titles stay within their tiles.

- **Issue #2380** (2026-10-25): **TvOS client does not respect server settings for continuing with the same audio and subtitle track as the previous episode in a series**
  *Symptoms*: ### This issue respects the following points:  - [x] This is a **bug**, not a question or a configuration issue; Please visit our [forum or chat rooms](https://jellyfin.org/contact/) first to troubleshoot with volunteers, before creating a report. - [x] This issue is **not** already reported on [GitHub](https://github.com/jellyfin/Swiftfin/issues?q=is%3Aopen+is%3Aissue). - [x] I have read the [Common Issues](https://github.com/jellyfin/Swiftfin/blob/main/Documentation/common_issues.md) documentation and this issue was not mentioned there. - [x] I'm using an up to date version of Swiftfin; We generally do not support previous older versions. If possible, please update to the latest version before opening an issue. - [x] I agree to follow Jellyfin's [Code of Conduct](https://jellyfin.org/docs/general/community-standards.html#code-of-conduct).  ### Description of the bug  The server has settings to keep playing in the same audio and subtitle language when you continue from one episode of a series to the next. The settings are "Set audio track based on previous item" and "Set subtitle track based on previous item" in the Playback settings in the server.  When playing through jellyfin's web client, if I am watching a show in Dutch with Portugese subtitles and the next episode autoplays, it stays in dutch with portugese subs even if those aren't the default tracks. In swiftfin, it always goes to the default tracks, requiring me to pause and adjust everything at the beginning of eve

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

### Incident Patch 1: `8ac23970` (2026-10-31)
**Commit Message**: Translated using Weblate (Arabic)

Currently translated at 96.9% (979 of 1010 strings)

Translation: Swiftfin/Swiftfin
Translate-URL: https://translate.jellyfin.org/projects/swiftfin/swiftfin/ar/



---

### Incident Patch 2: `b3b19b91` (2026-10-31)
**Commit Message**: Adaptive layout (#2394)

**File**: `PreferencesView/.swiftpm/xcode/package.xcworkspace/contents.xcworkspacedata` (removed, +0/-7)
```diff
@@ -1,7 +0,0 @@
-<?xml version="1.0" encoding="UTF-8"?>
-<Workspace
-   version = "1.0">
-   <FileRef
-      location = "self:">
-   </FileRef>
-</Workspace>
```

**File**: `PreferencesView/Package.resolved` (removed, +0/-14)
```diff
@@ -1,14 +0,0 @@
-{
-  "pins" : [
-    {
-      "identity" : "swift-syntax",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github.com/swiftlang/swift-syntax",
-      "state" : {
-        "revision" : "0687f71944021d616d34d922343dcef086855920",
-        "version" : "600.0.1"
-      }
-    }
-  ],
-  "version" : 2
-}
```

**File**: `PreferencesView/Package.swift` (removed, +0/-28)
```diff
@@ -1,28 +0,0 @@
-// swift-tools-version: 5.9
-
-import PackageDescription
-
-let package = Package(
-    name: "PreferencesView",
-    platforms: [
-        .iOS(.v16),
-        .tvOS(.v16),
-    ],
-    products: [
-        .library(
-            name: "PreferencesView",
-            targets: ["PreferencesView"]
-        ),
-    ],
-    dependencies: [
-        .package(path: "../SwiftfinMacros"),
-    ],
-    targets: [
-        .target(
-            name: "PreferencesView",
-            dependencies: [
-                .product(name: "SwiftfinMacros", package: "SwiftfinMacros"),
-            ]
-        ),
-    ]
-)
```

**File**: `PreferencesView/README.md` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-# PreferencesView
\ No newline at end of file
```

**File**: `PreferencesView/Sources/PreferencesView/Box.swift` (removed, +0/-14)
```diff
@@ -1,14 +0,0 @@
-//
-// Swiftfin is subject to the terms of the Mozilla Public
-// License, v2.0. If a copy of the MPL was not distributed with this
-// file, you can obtain one at https://mozilla.org/MPL/2.0/.
-//
-// Copyright (c) 2026 Jellyfin & Jellyfin Contributors
-//
-
-class Box {
-
-    weak var value: UIPreferencesHostingController?
-
-    init() {}
-}
```

**File**: `PreferencesView/Sources/PreferencesView/KeyCommandsBuilder.swift` (removed, +0/-37)
```diff
@@ -1,37 +0,0 @@
-//
-// Swiftfin is subject to the terms of the Mozilla Public
-// License, v2.0. If a copy of the MPL was not distributed with this
-// file, you can obtain one at https://mozilla.org/MPL/2.0/.
-//
-// Copyright (c) 2026 Jellyfin & Jellyfin Contributors
-//
-
-import Foundation
-
-@resultBuilder
-public enum KeyCommandsBuilder {
-
-    public static func buildBlock(_ components: [KeyCommandAction]...) -> [KeyCommandAction] {
-        components.flatMap(\.self)
-    }
-
-    public static func buildExpression(_ expression: KeyCommandAction) -> [KeyCommandAction] {
-        [expression]
-    }
-
-    public static func buildOptional(_ component: [KeyCommandAction]?) -> [KeyCommandAction] {
-        component ?? []
-    }
-
-    public static func buildEither(first component: [KeyCommandAction]) -> [KeyCommandAction] {
-        component
-    }
-
-    public static func buildEither(second component: [KeyCommandAction]) -> [KeyCommandAction] {
-        component
-    }
-
-    public static func buildArray(_ components: [[KeyCommandAction]]) -> [KeyCommandAction] {
-        components.flatMap(\.self)
-    }
-}
```

**File**: `PreferencesView/Sources/PreferencesView/PressCommandBuilder.swift` (removed, +0/-37)
```diff
@@ -1,37 +0,0 @@
-//
-// Swiftfin is subject to the terms of the Mozilla Public
-// License, v2.0. If a copy of the MPL was not distributed with this
-// file, you can obtain one at https://mozilla.org/MPL/2.0/.
-//
-// Copyright (c) 2026 Jellyfin & Jellyfin Contributors
-//
-
-import Foundation
-
-@resultBuilder
-public enum PressCommandsBuilder {
-
-    public static func buildBlock(_ components: [PressCommandAction]...) -> [PressCommandAction] {
-        components.flatMap(\.self)
-    }
-
-    public static func buildExpression(_ expression: PressCommandAction) -> [PressCommandAction] {
-        [expression]
-    }
-
-    public static func buildOptional(_ component: [PressCommandAction]?) -> [PressCommandAction] {
-        component ?? []
-    }
-
-    public static func buildEither(first component: [PressCommandAction]) -> [PressCommandAction] {
-        component
-    }
-
-    public static func buildEither(second component: [PressCommandAction]) -> [PressCommandAction] {
-        component
-    }
-
-    public static func buildArray(_ components: [[PressCommandAction]]) -> [PressCommandAction] {
-        components.flatMap(\.self)
-    }
-}
```

**File**: `PreferencesView/Sources/PreferencesView/UIViewController+Swizzling.swift` (removed, +0/-52)
```diff
@@ -1,52 +0,0 @@
-//
-// Swiftfin is subject to the terms of the Mozilla Public
-// License, v2.0. If a copy of the MPL was not distributed with this
-// file, you can obtain one at https://mozilla.org/MPL/2.0/.
-//
-// Copyright (c) 2026 Jellyfin & Jellyfin Contributors
-//
-
-import UIKit
-
-extension UIViewController {
-
-    // MARK: Swizzle
-
-    static var swizzle: Void = {
-        #if os(iOS)
-        _swizzle(
-            #selector(getter: supportedInterfaceOrientations),
-            #selector(swizzled_supportedInterfaceOrientations)
-        )
-        #endif
-    }()
-
-    private static func _swizzle(
-        _ original: Selector,
-        _ replacement: Selector
-    ) {
-        guard let a = class_getInstanceMethod(UIViewController.self, original),
-              let b = class_getInstanceMethod(UIViewController.self, replacement)
-        else { return }
-
-        method_exchangeImplementations(a, b)
-    }
-
-    // MARK: Swizzles
-
-    #if os(iOS)
-
-    @objc
-    func swizzled_supportedInterfaceOrientations() -> UIInterfaceOrientationMask {
-        search()?._orientations ?? .all
-    }
-
-    #endif
-
-    // MARK: Search
-
-    private func search() -> UIPreferencesHostingController? {
-        children.lazy.compactMap { $0 as? UIPreferencesHostingController }.first
-            ?? children.lazy.compactMap { $0.search() }.first
-    }
-}
```

#### Recent Merged Pull Requests:
- **PR #2394** (2026-10-31): Adaptive layout (@LePips)
- **PR #2393** (closed): Add iPhone Duo support (@kesku)
- **PR #2391** (2026-10-26): Revert `xcproj` (@LePips)
- **PR #2385** (2026-10-25): Update project document to `.xcproj` (@LePips)
- **PR #2384** (closed): Remeasure media tiles when the window resizes (@soconnor0919)
- **PR #2383** (2026-10-24): Focus User/AddUser on Start (@JPKribs)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
