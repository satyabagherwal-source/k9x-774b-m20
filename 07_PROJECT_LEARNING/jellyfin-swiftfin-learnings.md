# Forensic Learning Record (Deep Inspection): jellyfin/Swiftfin

> **Canonical Artifact**: `07_PROJECT_LEARNING/jellyfin-swiftfin-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/jellyfin/Swiftfin](https://github.com/jellyfin/Swiftfin))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:58:53.104Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `jellyfin/Swiftfin`
- **Description**: Native Jellyfin Client for iOS and tvOS 
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 4198 stars

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

### Core Architecture Module: `Shared/Objects/MediaPlayerManager/Supplements/Components/MediaPlayerQueue.swift`
```
//
// Swiftfin is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, you can obtain one at https://mozilla.org/MPL/2.0/.
//
// Copyright (c) 2026 Jellyfin & Jellyfin Contributors
//

import Combine

@MainActor
protocol MediaPlayerQueue: ObservableObject, MediaPlayerObserver, MediaPlayerSupplement {

    var hasNextItem: Bool { get }
    var hasPreviousItem: Bool { get }

    var nextItem: MediaPlayerItemProvider? { get }
    var previousItem: MediaPlayerItemProvider? { get }

    var hasNextItemPublisher: Published<Bool>.Publisher { get set }
    var hasPreviousItemPublisher: Published<Bool>.Publisher { get set }
    var nextItemPublisher: Published<MediaPlayerItemProvider?>.Publisher { get set }
    var previousItemPublisher: Published<MediaPlayerItemProvider?>.Publisher { get set }
}

extension MediaPlayerQueue {

    var hasNextItem: Bool {
        nextItem != nil
    }

    var hasPreviousItem: Bool {
        previousItem != nil
    }
}

class AnyMediaPlayerQueue: MediaPlayerQueue {

    @Published
    var hasNextItem: Bool
    @Published
    var hasPreviousItem: Bool

    @Published
    var nextItem: MediaPlayerItemProvider?
    @Published
    var previousItem: MediaPlayerItemProvider?

    lazy var hasNextItemPublisher: Published<Bool>.Publisher = $hasNextItem
    lazy var hasPreviousItemPublisher: Published<Bool>.Publisher = $hasPreviousItem
    lazy var nextItemPublisher: Published<MediaPlayerItemProvider?>.Publisher = $nextItem
    lazy var previousItemPublisher: Published<MediaPlayerItemProvider?>.Publisher = $previousItem

    private var wrapped: any MediaPlayerQueue

    var displayTitle: String {
        wrapped.displayTitle
    }

    var id: String {
        wrapped.id
    }

    weak var manager: MediaPlayerManager? {
        get { wrapped.manager }
        set { wrapped.manager = newValue }
    }

    private var cancellables: [AnyCancellable] = []

    init(_ wrapped: some MediaPlayerQueue) {
        self.wrapped = wrapped
        self.hasNextItem = wrapped.hasNextItem
        self.hasPreviousItem = wrapped.hasPreviousItem

        wrapped.hasNextItemPublisher
            .assign(to: &$hasNextItem)
        wrapped.hasPreviousItemPublisher
            .assign(to: &$hasPreviousItem)
        wrapped.nextItemPublisher
            .assign(to: &$nextItem)
        wrapped.previousItemPublisher
            .assign(to: &$previousItem)
    }

    var videoPlayerBody: some PlatformView {
        wrapped
            .videoPlayerBody
            .eraseToAnyView()
    }
}

```

### Core Architecture Module: `Shared/Objects/MediaPlayerManager/Supplements/EpisodeMediaPlayerQueue.swift`
```
//
// Swiftfin is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, you can obtain one at https://mozilla.org/MPL/2.0/.
//
// Copyright (c) 2026 Jellyfin & Jellyfin Contributors
//

import Combine
import Defaults
import Foundation
import IdentifiedCollections
import JellyfinAPI
import SwiftUI

@MainActor
class EpisodeMediaPlayerQueue: ViewModel, MediaPlayerQueue {

    weak var manager: MediaPlayerManager? {
        didSet {
            cancellables = []
            guard let manager else { return }

            manager.$playbackItem
                .sink { [weak self] newItem in
                    self?.didReceive(newItem: newItem)
                }
                .store(in: &cancellables)
        }
    }

    let displayTitle: String = L10n.episodes
    let id: String = "EpisodeMediaPlayerQueue"

    @Published
    var nextItem: MediaPlayerItemProvider? = nil
    @Published
    var previousItem: MediaPlayerItemProvider? = nil

    @Published
    var hasNextItem: Bool = false
    @Published
    var hasPreviousItem: Bool = false

    lazy var hasNextItemPublisher: Published<Bool>.Publisher = $hasNextItem
    lazy var hasPreviousItemPublisher: Published<Bool>.Publisher = $hasPreviousItem
    lazy var nextItemPublisher: Published<MediaPlayerItemProvider?>.Publisher = $nextItem
    lazy var previousItemPublisher: Published<MediaPlayerItemProvider?>.Publisher = $previousItem

    private var currentAdjacentEpisodesTask: AnyCancellable?
    private let seasonsViewModel: PagingLibraryViewModel<SeasonViewModelLibrary>

    init(episode: BaseItemDto) {
        self.seasonsViewModel = PagingLibraryViewModel(
            library: SeasonViewModelLibrary(
                parent: BaseItemDto(id: episode.seriesID, name: episode.seriesName)
            ),
            pageSize: 100
        )
        super.init()

        seasonsViewModel.refresh()
    }

    var videoPlayerBody: some PlatformView {
        EpisodeOverlay(viewModel: seasonsViewModel)
    }

    private func didReceive(newItem: MediaPlayerItem?) {
        self.currentAdjacentEpisodesTask = Task {
            await MainActor.run {
                self.nextItem = nil
                self.previousItem = nil
                self.hasNextItem = false
                self.hasPreviousItem = false
            }

            try await self.getAdjacentEpisodes(for: newItem?.baseItem)
        }
        .asAnyCancellable()
    }

    private func getAdjacentEpisodes(for item: BaseItemDto?) async throws {
        guard let item else { return }
        guard let seriesID = item.seriesID, item.type == .episode else { return }

        let parameters = try Paths.GetEpisodesParameters(
            userID: authenticatedUser.id,
            adjacentTo: item.id!,
            limit: 3
        )
        let request = Paths.getEpisodes(seriesID: seriesID, parameters: parameters)
        let response = try await send(request)

        // 4 possible states:
        //  1 - only current episode
        //  2 - two episodes with next episode
        //  3 - two episodes with previous episode
        //  4 - three episodes with current in middle

        // 1
        guard let items = response.value.items, items.count > 1 else { return }

        var previousItem: BaseItemDto?
        var nextItem: BaseItemDto?

        if items.count == 2 {
            if items[0].id == item.id {
                // 2
                nextItem = items[1]

            } else {
                // 3
                previousItem = items[0]
            }
        } else {
            nextItem = items[2]
            previousItem = items[0]
        }

        var nextProvider: MediaPlayerItemProvider?
        var previousProvider: MediaPlayerItemProvider?

        if let nextItem {
            nextProvider = MediaPlayerItemProvider(item: nextItem) { [weak self] item, modifyItem in
                let bitrate = await self?.manager?.playbackBitrate ?? Defaults[.VideoPlayer.Playback.appMaximumBitrate]
                return try await MediaPlayerItem.build(for: item, requestedBitrate: bitrate) { item in
                    item.userData?.playbackPositionTicks = .zero
                    modifyItem?(&item)
                }
            }
        }

        if let previousItem {
            previousProvider = MediaPlayerItemProvider(item: previousItem) { [weak self] item, modifyItem in
                let bitrate = await self?.manager?.playbackBitrate ?? Defaults[.VideoPlayer.Playback.appMaximumBitrate]
                return try await MediaPlayerItem.build(for: item, requestedBitrate: bitrate) { item in
                    item.userData?.playbackPositionTicks = .zero
                    modifyItem?(&item)
                }
            }
        }

        guard !Task.isCancelled else { return }

        await MainActor.run {
            self.nextItem = nextProvider
            self.previousItem = previousProvider
            self.hasNextItem = nextProvider != nil
            self.hasPreviousItem = previousProvider != nil
        }
    }
}

extension EpisodeMediaPlayerQueue {

    private struct EpisodeOverlay: PlatformView {

        @EnvironmentObject
        private var manager: MediaPlayerManager

        @ObservedObject
        var viewModel: PagingLibraryViewModel<SeasonViewModelLibrary>

        @State
        private var selection: PagingLibraryViewModel<EpisodeLibrary>.ID?

        private var selectionViewModel: PagingLibraryViewModel<EpisodeLibrary>? {
            guard let selection else { return nil }

            return viewModel.elements[id: selection]
        }

        private func select(episode: BaseItemDto) {
            let provider = MediaPlayerItemProvider(item: episode) { [manager] item, modifyItem in
                try await MediaPlayerItem.build(
                    for: item,
                    requestedBitrate: manager.playbackBitrate,
                    modifyItem: modifyItem
                )
            }

            manager.playNewItem(provider: provider)
        }

        private func selectInitialSeason() {
            if let seasonID = manager.item.seasonID, let season = viewModel.elements[id: seasonID] {
                if season.elements.isEmpty {
                    season.refresh()
                }
                selection = season.id
            } else {
                selection = viewModel.elements.first?.id
            }
        }

        private func setSelectionIfNeeded(seasons: IdentifiedArrayOf<PagingLibraryViewModel<EpisodeLibrary>>) {
            guard selection == nil, !seasons.isEmpty else { return }

            selection = seasons.first?.id
            seasons.first?.refresh()
        }

        @ViewBuilder
        private var seasonView: some View {
            if let selectionViewModel {
                SeasonQueueView(viewModel: selectionViewModel, action: select)
            }
        }

        var iOSView: some View {
            seasonView
                .onAppear { selectInitialSeason() }
                .onReceive(viewModel.$elements) { newSeasons in
                    setSelectionIfNeeded(seasons: newSeasons)
                }
        }

        var tvOSView: some View {
            seasonView
                .onFirstAppear { selectInitialSeason() }
                .onReceive(viewModel.$elements) { newSeasons in
                    setSelectionIfNeeded(seasons: newSeasons)
                }
        }
    }

    private struct SeasonQueueView: PlatformView {

        @Environment(VideoPlayer.ViewState.self)
        private var viewState

        @EnvironmentObject
        private var manager: MediaPlayerManager

        @ObservedObject
        var viewModel: PagingLibraryViewModel<EpisodeLibrary>

        let action: (BaseItemDto) -> Void

        @ViewBuilder
        private func content(errorView: some View) -> some View {
            switch viewModel.state {
            case .content:
                if viewModel.elements.isNotEmpty {
                    VideoPlayer.PosterCollectionView(
                        data: viewModel.elements,
                        currentElementID: manager.item.id.map { .some($0) },
                        isCompact: viewState.isCompact,
                        action: action
                    ) { item in
                        VStack(alignment: .leading, spacing: 5) {
                            Text(item.displayTitle)
                                .font(.subheadline)
                                .fontWeight(.semibold)
                                .foregroundStyle(.primary)
                                .lineLimit(2)
                                .multilineTextAlignment(.leading)

                            DotHStack {
                                if let subtitle = item.subtitle {
                                    Text(subtitle)
                                }

                                if let runtime = item.runTimeLabel {
                                    Text(runtime)
                                }
                            }
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        }
                    }
                }

            case .initial, .refreshing:
                EmptyView()

            case .error:
                errorView
            }
        }

        var iOSView: some View {
            content(errorView: CompactOrRegularView(isCompact: viewState.isCompact) {
                ErrorView(error: ErrorMessage(L10n.unknownError))
            } regularView: {
                SeasonErrorView(viewModel: viewModel)
            })
        }

        var tvOSView: some View {
            content(errorView: SeasonErrorView(viewModel: viewModel))
        }
    }

    private struct SeasonErrorView: View {

        @FocusState
        private var isRetryButtonFocused: Bool

        @ObservedObject
        var viewModel: PagingLibr
```

### Core Architecture Module: `Shared/Objects/Utilities.swift`
```
//
// Swiftfin is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, you can obtain one at https://mozilla.org/MPL/2.0/.
//
// Copyright (c) 2026 Jellyfin & Jellyfin Contributors
//

import Foundation

@_exported import CasePaths
@_exported import Engine
@_exported import StatefulMacros
@_exported import SwiftfinMacros

@inlinable
func clamp<T: Comparable>(_ x: T, min y: T, max z: T) -> T {
    min(max(x, y), z)
}

@inlinable
func copy<P, Value>(_ p: P, modifying keyPath: WritableKeyPath<P, Value>, to newValue: Value) -> P {
    var copy = p
    copy[keyPath: keyPath] = newValue
    return copy
}

@inlinable
func round<T: BinaryFloatingPoint>(_ value: T, toNearest: T) -> T {
    round(value / toNearest) * toNearest
}

@inlinable
func round<T: BinaryInteger>(_ value: T, toNearest: T) -> T {
    T(round(Double(value), toNearest: Double(toNearest)))
}

@inlinable
func with<V>(_ value: V, modify: @escaping (inout V) -> Void) -> V {
    var value = value
    modify(&value)
    return value
}

```

### Core Architecture Module: `Shared/Services/UserSession/UserSessionState.swift`
```
//
// Swiftfin is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, you can obtain one at https://mozilla.org/MPL/2.0/.
//
// Copyright (c) 2026 Jellyfin & Jellyfin Contributors
//

enum UserSessionState: RawRepresentable, Storable {

    case signedOut
    case signedIn(userID: String)

    var rawValue: String {
        switch self {
        case .signedOut:
            ""
        case let .signedIn(userID):
            userID
        }
    }

    init?(rawValue: String) {
        if rawValue.isEmpty {
            self = .signedOut
        } else {
            self = .signedIn(userID: rawValue)
        }
    }
}

```

### Core Architecture Module: `Shared/SwiftfinStore/SwiftfinStore+ServerState.swift`
```
//
// Swiftfin is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, you can obtain one at https://mozilla.org/MPL/2.0/.
//
// Copyright (c) 2026 Jellyfin & Jellyfin Contributors
//

import CoreStore
import FactoryKit
import Foundation
import JellyfinAPI
import Pulse

extension SwiftfinStore.State {

    struct Server: Hashable, Identifiable, Codable {

        @available(*, message: "Use connections instead")
        let urls: Set<URL>
        @available(*, message: "Use connections instead")
        let currentURL: URL
        let name: String
        let id: String
        let userIDs: [String]

        /// - Note: Since this is created from a server, it does not
        ///         have a user access token.
        var client: JellyfinClient {
            JellyfinClient(
                configuration: .swiftfinConfiguration(url: effectiveServerURL),
                sessionConfiguration: .swiftfin,
                sessionDelegate: URLSessionProxyDelegate(logger: NetworkLogger.swiftfin())
            )
        }
    }
}

extension ServerState {

    var activeServerConnection: ServerConnection? {
        get {
            let connections = serverConnections
            let activeConnectionID = StoredValues[.Server.activeConnectionID(id: id)]

            if activeConnectionID.isNotEmpty,
               let connection = connections.first(where: { $0.id == activeConnectionID })
            {
                return connection
            }

            let normalizedCurrentURL = currentURL.normalizedServerConnectionURL ?? currentURL
            return connections.first { $0.url == normalizedCurrentURL } ?? connections.first
        }
        nonmutating set {
            StoredValues[.Server.activeConnectionID(id: id)] = newValue?.id ?? .empty
        }
    }

    /// Deletes the model that this state represents and
    /// all settings from `StoredValues`.
    func delete() throws {
        let users = StoredValues[.User.users]
            .filter { $0.serverID == id }

        for user in users {
            try AnyStoredData.deleteAll(ownerID: user.id)
        }
        try AnyStoredData.deleteAll(ownerID: id)
        UserDefaults.userSuite(id: id).removeAll()

        var storedUsers = StoredValues[.User.users]
        storedUsers.removeAll { $0.serverID == id }
        StoredValues[.User.users] = storedUsers

        var servers = StoredValues[.Server.servers]
        servers.removeAll { $0.id == id }
        StoredValues[.Server.servers] = servers

        for user in users {
            UserDefaults.userSuite(id: user.id).removeAll()
        }
    }

    var effectiveServerURL: URL {
        activeServerConnection?.url ?? currentURL
    }

    func ensureServerConnections() -> [ServerConnection] {
        let connections = StoredValues[.Server.connections(id: id)]
        guard connections.isEmpty else { return ServerConnection.ordered(connections) }

        let defaultConnections = defaultServerConnections
        serverConnections = defaultConnections
        return defaultConnections
    }

    func getPublicSystemInfo() async throws -> PublicSystemInfo {

        let request = Paths.getPublicSystemInfo
        let response = try await client.send(request)

        return response.value
    }

    func hasServerConnection(url: URL) -> Bool {
        let normalizedURL = url.normalizedServerConnectionURL ?? url
        return serverConnections.contains { $0.url == normalizedURL }
    }

    var isAutoSwitchEnabled: Bool {
        get {
            StoredValues[.Server.isAutoSwitchEnabled(id: id)]
        }
        nonmutating set {
            StoredValues[.Server.isAutoSwitchEnabled(id: id)] = newValue
        }
    }

    var isVersionCompatible: Bool {
        let publicInfo = StoredValues[.Server.publicInfo(id: self.id)]

        if let version = publicInfo.version {
            return JellyfinClient.Version(stringLiteral: version).majorMinor >= client.version.majorMinor
        } else {
            return false
        }
    }

    var serverConnections: [ServerConnection] {
        get {
            let connections = StoredValues[.Server.connections(id: id)]

            guard connections.isNotEmpty else {
                return defaultServerConnections
            }

            return ServerConnection.ordered(connections)
        }
        nonmutating set {
            StoredValues[.Server.connections(id: id)] = ServerConnection.ordered(newValue, preservingOrder: true)
        }
    }

    var splashScreenImageSource: ImageSource {
        ImageSource(url: client.url(with: Paths.getSplashscreen()))
    }

    private var defaultServerConnections: [ServerConnection] {
        let urls = [currentURL] + self.urls
            .subtracting([currentURL])
            .sorted(using: \.absoluteString)

        return urls.enumerated().map { index, url in
            let normalizedURL = url.normalizedServerConnectionURL ?? url

            return ServerConnection(
                id: UUID().uuidString,
                name: url == currentURL ? L10n.currentURL : normalizedURL.absoluteString,
                url: normalizedURL,
                interface: .any,
                priority: index
            )
        }
    }

    @MainActor
    func updateServerInfo() async throws {
        let servers = StoredValues[.Server.servers]
        guard let currentServer = servers.first(where: { $0.id == id }) else { return }

        let publicInfo = try await getPublicSystemInfo()
        let updatedName = publicInfo.serverName ?? currentServer.name

        let updatedServer = ServerState(
            urls: currentServer.urls,
            currentURL: currentServer.currentURL,
            name: updatedName,
            id: currentServer.id,
            userIDs: currentServer.userIDs
        )

        StoredValues[.Server.servers] = servers.map { $0.id == id ? updatedServer : $0 }
        StoredValues[.Server.publicInfo(id: currentServer.id)] = publicInfo
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2352** (2026-10-02): **Update Jellyfin SDK**
  *Symptoms*: Update sdk to 3.3.0.

- **Issue #2350** (2026-10-02): **Live TV does not transcode with Native Player on tvOS or iOS**
  *Symptoms*: ### This issue respects the following points:  - [x] This is a **bug**, not a question or a configuration issue; Please visit our [forum or chat rooms](https://jellyfin.org/contact/) first to troubleshoot with volunteers, before creating a report. - [x] This issue is **not** already reported on [GitHub](https://github.com/jellyfin/Swiftfin/issues?q=is%3Aopen+is%3Aissue). - [x] I have read the [Common Issues](https://github.com/jellyfin/Swiftfin/blob/main/Documentation/common_issues.md) documentation and this issue was not mentioned there. - [x] I'm using an up to date version of Swiftfin; We generally do not support previous older versions. If possible, please update to the latest version before opening an issue. - [x] I agree to follow Jellyfin's [Code of Conduct](https://jellyfin.org/docs/general/community-standards.html#code-of-conduct).  ### Description of the bug  It appears that LiveTV with the Native player is not following the device profiles for direct play/transcoding.   When playing from LiveTV (MPEG2/AC-3/TS) from a Silicon Dust HDHR4-2US, Jellyfin does not transcode the video, but transcodes the audio, AC-3->AAC. Swiftin Native player is unable to play the stream.  `Program 1    Stream #0:0[0x31]: Video: mpeg2video (Main) ([2][0][0][0] / 0x0002), yuv420p(tv, top first), 1920x1080 [SAR 1:1 DAR 16:9], 29.97 fps, 29.97 tbr, 90k tbn, start 30587.134333     Side data:       CPB properties: bitrate max/min/avg: 16619200/0/0 buffer size: 7995392 vbv_delay: N/A   Stream 
  **Post-Mortem & Fix Analysis**:
  > Should be resolved via:  https://github.com/jellyfin/Swiftfin/pull/2283  It says direct play but this is more calling live TV via HLS which resolves a lot of issues with AVPlayer and .ts.

- **Issue #2348** (2026-10-01): **Fix tvOS build, fix user view text**
  *Symptoms*: - Had merged #2326 on my phone and the actions were collapsed, thought the failing build was CodeFactor as tvOS built on my machine - Fix user view grid button style

- **Issue #2339** (2026-09-28): **Fix tvOS `ListRow` Clipping**
  *Symptoms*: ### Summary  Fixes weird clipping for Library List items. Just changing the location of the modifier. Zoom transition is unchanged for iOS. But we're just zooming to and from the image in the list row instead of the full row.  #### Before  <img width="396" height="143" alt="Screenshot 2026-09-27 at 18 52 44" src="https://github.com/user-attachments/assets/6090fc56-210c-43fd-839a-d4b18a257979" />  #### After  <img width="399" height="142" alt="Screenshot 2026-09-27 at 18 54 08" src="https://github.com/user-attachments/assets/492689b2-c320-4cba-b51a-8fcfec9f81b2" />
  **Post-Mortem & Fix Analysis**:
  > We may also want to remove the row divider on tvOS but I'll defer on that.

- **Issue #2335** (2026-09-26): **Content group focus**
  *Symptoms*: Closes #2234  Coordinate focus for content group states.

- **Issue #2334** (2026-09-26): **Poster overlay indicator styling, accessibility**
  *Symptoms*: - Poster overlay 	- Fix "rewatching" by showing progress even if marked as played 	- Adjust poster labels from circles to quadrant, generalizing the previous "episode count" design 		- Will go to circle/capsule design when poster has progress 	- Have overlay runtime in capsule instead of plain text - Poster settings 	- Allow selection of variety of item metadata in poster label 		- Does re-require requesting more item fields, should be fine. Would also be greatly aided with #2327. 	- As stored objects change over time, decoding to not broadly cause setting resets requires more manual work. Had implemented overall behavior as a macro, and finally made a macro for option sets while I'm at it. - Manual poster item accessibility for VoiceOver 	- A bit more intrusive than I wanted it to be 	- Closes #963, as that issue directly calls out poster data for VoiceOver. Overall, accessibility is improving and I'll take more specific issues going forward. - Episode cards 	- Closes #2158, now uses the same poster size resolution. This did cause an increase in requested size, can up if necessary. 	- Now have context menu

- **Issue #2332** (2026-09-24): **Use product name**
  *Symptoms*: Closes #2329  Use product name instead of target name.

- **Issue #2331** (2026-09-24): **`ActivityLogs` `ignoreSafeArea`**
  *Symptoms*: ### Summary  Same as https://github.com/jellyfin/Swiftfin/pull/2328 just adding `ignoreSafeArea` so the Activity Logs fill the the top safe area.  #### Before  <img width="360" height="320" alt="Before" src="https://github.com/user-attachments/assets/d1d2cdc4-7d3c-4851-a748-4f49bd7b74ce" />  #### After  <img width="355" height="305" alt="Screenshot 2026-09-23 at 21 59 18" src="https://github.com/user-attachments/assets/ef3aa118-0395-48db-8463-a6e568111cf4" />

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

### Incident Patch 1: `0a08af01` (2026-10-01)
**Commit Message**: Fix tvOS build, fix user view text (#2348)

**File**: `Shared/Objects/Libraries/UserViewLibrary.swift` (modified, +3/-0)
```diff
@@ -202,6 +202,7 @@ private struct UserViewLibraryGridElement: View {
                 .posterStyle(.landscape)
                 .matchedTransitionSource(id: "item", in: namespace)
         }
+        .foregroundStyle(.primary, .secondary)
         .onFirstAppear(perform: setImageSources)
         .onChange(of: useRandomImage) {
             setImageSources()
@@ -219,6 +220,7 @@ private struct UserViewLibraryGridElement: View {
             .frame(alignment: .center)
     }
 
+    @ViewBuilder
     private func titleLabelOverlay(with content: some View) -> some View {
         ZStack {
             content
@@ -277,6 +279,7 @@ private struct UserViewLibraryListElement: View {
         }
     }
 
+    @ViewBuilder
     private var imageView: some View {
         ZStack {
             Color.secondarySystemFill
```

**File**: `Shared/Views/VideoPlayer/Container/VideoPlayer+Supplements.swift` (modified, +0/-1)
```diff
@@ -153,7 +153,6 @@ extension VideoPlayer.UIContainerViewController {
 
                     SupplementTabView(
                         data: viewState.supplements,
-                        // UIKit callbacks must read the latest selection, even before SwiftUI renders again.
                         selection: Binding(
                             get: { viewState.selectedSupplementID },
                             set: { viewState.selectedSupplementID = $0 }
```

**File**: `Swiftfin tvOS/Views/VideoPlayer/SupplementTabView.swift` (modified, +13/-5)
```diff
@@ -12,11 +12,19 @@ import UIKit
 /// `TabView` acts weird with horizontal stacks, workaround with manual supplement presentation
 struct SupplementTabView<Content: View>: PlatformViewControllerRepresentable {
 
-    let data: [any MediaPlayerSupplement]
-    let selection: Binding<String?>
-
-    @ViewBuilder
-    let content: (any MediaPlayerSupplement) -> Content
+    private let content: (any MediaPlayerSupplement) -> Content
+    private let data: [any MediaPlayerSupplement]
+    private let selection: Binding<String?>
+
+    init(
+        data: [any MediaPlayerSupplement],
+        selection: Binding<String?>,
+        @ViewBuilder content: @escaping (any MediaPlayerSupplement) -> Content
+    ) {
+        self.data = data
+        self.selection = selection
+        self.content = content
+    }
 
     private var selectionPresented: (String) -> Void = { _ in }
     private var focusExitHeading: UIFocusHeading = []
```

---

### Incident Patch 2: `cdda8e64` (2026-09-28)
**Commit Message**: Fix tvOS `ListRow` Clipping (#2339)

Co-authored-by: Ethan Pippin <[REDACTED_EMAIL]>

**File**: `Shared/Components/ListRow.swift` (modified, +11/-44)
```diff
@@ -17,9 +17,6 @@ struct ListRow<Leading: View, Content: View>: View {
     @ViewContextContains(.isListRowSeparatorVisible)
     private var isListRowSeparatorVisible
 
-    @FocusState
-    private var isButtonFocused
-
     @State
     private var contentSize: CGSize = .zero
 
@@ -28,16 +25,16 @@ struct ListRow<Leading: View, Content: View>: View {
     private var insets: EdgeInsets
     private let leading: Leading
 
-    private init(
-        leading: Leading,
-        content: Content,
-        action: @escaping () -> Void,
-        insets: EdgeInsets
+    init(
+        insets: EdgeInsets = .zero,
+        @ViewBuilder leading: @escaping () -> Leading,
+        @ViewBuilder content: @escaping () -> Content,
+        action: @escaping () -> Void = {}
     ) {
-        self.leading = leading
-        self.content = content
         self.action = action
+        self.content = content()
         self.insets = insets
+        self.leading = leading()
     }
 
     var body: some View {
@@ -55,48 +52,18 @@ struct ListRow<Leading: View, Content: View>: View {
                 .padding(insets)
             }
             .foregroundStyle(.primary, .secondary)
-            .focused($isButtonFocused)
+            .contentShape(.contextMenuPreview, Rectangle())
             #if os(tvOS)
             .buttonStyle(.card)
-            #else
-            .contentShape(.contextMenuPreview, Rectangle())
             #endif
 
-            if isListRowSeparatorVisible, !isButtonFocused {
+            #if !os(tvOS)
+            if isListRowSeparatorVisible {
                 Color.secondarySystemFill
                     .frame(width: contentSize.width, height: 1)
                     .padding(.trailing, insets.trailing)
             }
+            #endif
         }
     }
 }
-
-extension ListRow {
-
-    init(
-        insets: EdgeInsets = .zero,
-        @ViewBuilder leading: @escaping () -> Leading,
-        @ViewBuilder content: @escaping () -> Content
-    ) {
-        self.init(
-            insets: insets,
-            leading: leading,
-            content: content,
-            action: {}
-        )
-    }
-
-    init(
-        insets: EdgeInsets = .zero,
-        @ViewBuilder leading: @escaping () -> Leading,
-        @ViewBuilder content: @escaping () -> Content,
-        action: @escaping () -> Void
-    ) {
-        self.init(
-            leading: leading(),
-            content: content(),
-            action: action,
-            insets: insets
-        )
-    }
-}
```

**File**: `Shared/Extensions/JellyfinAPI/BaseItemDto+LibraryElement.swift` (modified, +2/-0)
```diff
@@ -128,7 +128,9 @@ private struct BaseItemDtoLibraryListElement: View {
         } action: {
             item.libraryDidSelectElement(router: router, in: namespace)
         }
+        #if !os(tvOS)
         .matchedTransitionSource(id: "item", in: namespace)
+        #endif
         #if os(tvOS)
         .focusedValue(\.focusedPoster, AnyPoster(item))
         #endif
```

**File**: `Shared/Objects/Libraries/UserViewLibrary.swift` (modified, +2/-0)
```diff
@@ -268,7 +268,9 @@ private struct UserViewLibraryListElement: View {
         } action: {
             element.libraryDidSelectElement(router: router, in: namespace)
         }
+        #if !os(tvOS)
         .matchedTransitionSource(id: "item", in: namespace)
+        #endif
         .onFirstAppear(perform: setImageSources)
         .onChange(of: useRandomImage) {
             setImageSources()
```

---

### Incident Patch 3: `6152a329` (2026-09-27)
**Commit Message**: SwiftUI font cleanup, rows frame, warnings (#2337)

**File**: `PreferencesView/Sources/PreferencesView/UIViewController+Swizzling.swift` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ extension UIViewController {
 
     // MARK: Swizzle
 
-    static var swizzle = {
+    static var swizzle: Void = {
         #if os(iOS)
         _swizzle(
             #selector(getter: supportedInterfaceOrientations),
```

**File**: `PreferencesView/Sources/PreferencesView/ViewExtensions.swift` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@
 import SwiftfinMacros
 import SwiftUI
 
-extension UIInterfaceOrientationMask: CustomDebugStringConvertible {
+extension UIInterfaceOrientationMask: @retroactive CustomDebugStringConvertible {
     public var debugDescription: String {
         switch self {
         case .all: "All Orientations"
```

**File**: `Shared/Components/ChevronButton.swift` (modified, +1/-2)
```diff
@@ -216,8 +216,7 @@ struct ChevronButtonValueContent<Label: View, Value: View>: View {
 
             label
                 .labelStyle(BoldIconLabelStyle())
-
-            Spacer()
+                .frame(maxWidth: .infinity, alignment: .leading)
 
             value
                 .foregroundStyle(.secondary)
```

**File**: `Shared/Components/EPG/Body/Components/EPGChannelColumn.swift` (modified, +2/-1)
```diff
@@ -38,7 +38,8 @@ struct EPGChannelColumn: View {
                         )
                     } label: {
                         Text(L10n.onNow)
-                            .font(.caption2.weight(.semibold))
+                            .font(.caption2)
+                            .fontWeight(.semibold)
                             .lineLimit(1)
                             .padding(.horizontal, 8)
                             .padding(.vertical, 4)
```

**File**: `Shared/Components/EPG/Body/EPGTimeRuler.swift` (modified, +2/-1)
```diff
@@ -50,7 +50,8 @@ struct EPGTimeRuler: View {
                 ? date.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())
                 : date.formatted(date: .omitted, time: .shortened)
         )
-        .font(.caption2.weight(.semibold))
+        .font(.caption2)
+        .fontWeight(.semibold)
         .foregroundStyle(isDayStart ? Color.primary : Color.secondary)
         .lineLimit(1)
         .padding(.leading, 4)
```

**File**: `Shared/Components/PosterIndicators/UnplayedIndicator.swift` (modified, +2/-1)
```diff
@@ -21,7 +21,8 @@ struct UnplayedIndicator: View {
             Quadrant(.topTrailing) {
                 QuadrantItem(color: accentColor) {
                     Text(count.description)
-                        .font(.body.weight(.semibold))
+                        .font(.body)
+                        .fontWeight(.semibold)
                 }
             }
             .accessibilityElement(children: .ignore)
```

**File**: `Shared/Components/SystemImageContentView.swift` (modified, +1/-1)
```diff
@@ -67,7 +67,7 @@ struct SystemImageContentView: View {
             Image(systemName: systemName ?? "circle")
                 .resizable()
                 .aspectRatio(contentMode: .fit)
-                .foregroundColor(.secondary)
+                .foregroundStyle(.secondary)
         }
     }
 }
```

**File**: `Shared/Components/UserProfileRow.swift` (modified, +4/-4)
```diff
@@ -46,13 +46,13 @@ extension SettingsView {
                     Text(user.name ?? L10n.unknown)
                         .fontWeight(.semibold)
                         .foregroundStyle(.primary)
-
-                    Spacer()
+                        .frame(maxWidth: .infinity, alignment: .leading)
 
                     if action != nil {
                         Image(systemName: "chevron.right")
-                            .font(.body.weight(.regular))
-                            .foregroundColor(.secondary)
+                            .font(.body)
+                            .fontWeight(.regular)
+                            .foregroundStyle(.secondary)
                     }
                 }
             }
```

---

### Incident Patch 4: `14fe5b8e` (2026-09-23)
**Commit Message**: Revert #2313 & Real Spacing Fix (#2325)

Co-authored-by: Ethan Pippin <[REDACTED_EMAIL]>

**File**: `Shared/Components/LibraryElement.swift` (modified, +25/-42)
```diff
@@ -72,27 +72,23 @@ extension LibraryElement {
         let libraryStyle = options.normalized(libraryStyle)
 
         #if os(iOS)
-        let gridLayout: CollectionVGridLayout = {
-            switch libraryStyle.posterDisplayType {
-            case .landscape:
-                .minWidth(220, insets: insets)
-            case .portrait, .square:
-                .minWidth(140, insets: insets)
-            }
-        }()
-
-        let phoneGridLayout: CollectionVGridLayout = {
-            switch libraryStyle.posterDisplayType {
-            case .landscape:
-                .columns(2, insets: insets)
-            case .portrait, .square:
-                .columns(3, insets: insets)
-            }
-        }()
-
         switch libraryStyle.displayType {
         case .grid:
-            return UIDevice.isPhone ? phoneGridLayout : gridLayout
+            if UIDevice.isPhone {
+                return .columns(
+                    libraryStyle.posterDisplayType == .landscape ? 2 : 3,
+                    insets: insets,
+                    itemSpacing: EdgeInsets.itemSpacing,
+                    lineSpacing: EdgeInsets.itemSpacing
+                )
+            }
+
+            return .minWidth(
+                libraryStyle.posterDisplayType == .landscape ? 220 : 140,
+                insets: insets,
+                itemSpacing: EdgeInsets.itemSpacing,
+                lineSpacing: EdgeInsets.itemSpacing
+            )
         case .list:
             return .columns(
                 libraryStyle.listColumnCount,
@@ -102,32 +98,19 @@ extension LibraryElement {
             )
         }
         #else
-        switch libraryStyle.displayType {
+        let columnCount = switch libraryStyle.displayType {
         case .grid:
-            switch libraryStyle.posterDisplayType {
-            case .landscape:
-                return .columns(
-                    4,
-                    insets: .init(vertical: 0, horizontal: EdgeInsets.edgePadding),
-                    itemSpacing: EdgeInsets.edgePadding,
-                    lineSpacing: EdgeInsets.edgePadding
-                )
-            case .portrait, .square:
-                return .columns(
-                    7,
-                    insets: .init(vertical: 0, horizontal: EdgeInsets.edgePadding),
-                    itemSpacing: EdgeInsets.edgePadding,
-                    lineSpacing: EdgeInsets.edgePadding
-                )
-            }
+            libraryStyle.posterDisplayType == .landscape ? 4 : 7
         case .list:
-            return .columns(
-                libraryStyle.listColumnCount,
-                insets: .init(vertical: 0, horizontal: EdgeInsets.edgePadding),
-                itemSpacing: EdgeInsets.edgePadding,
-                lineSpacing: EdgeInsets.edgePadding
-            )
+            libraryStyle.listColumnCount
         }
+
+        return .columns(
+            columnCount,
+            insets: .init(vertical: 0, horizontal: EdgeInsets.edgePadding),
+            itemSpacing: EdgeInsets.itemSpacing,
+            lineSpacing: EdgeInsets.itemSpacing
+        )
         #endif
     }
 }
```

**File**: `Shared/Components/PosterButton.swift` (modified, +7/-4)
```diff
@@ -53,11 +53,10 @@ struct PosterButton<Item: Poster>: View {
         PosterImage(
             item: item,
             type: displayType,
-            size: size,
-            contentMode: .fit
+            size: size
         )
         .frame(maxWidth: .infinity, maxHeight: .infinity)
-        .overlay { overlay.posterStyle(displayType, contentMode: .fit) }
+        .overlay { overlay.posterStyle(displayType) }
         .contentShape(.contextMenuPreview, Rectangle())
         .matchedTransitionSource(id: "item", in: namespace)
         .subtleShadow()
@@ -83,14 +82,15 @@ struct PosterButton<Item: Poster>: View {
             // Layout required for tvOS focused offset label behavior
             #if os(tvOS)
             posterImage(overlay: item.posterOverlay(for: displayType))
+                .posterAspectRatio(displayType, contentMode: .fit)
+                .frame(width: posterSize.width > 0 ? posterSize.width : nil)
 
             if posterConfiguration.showLabels {
                 item.posterLabel
                     .frame(maxWidth: .infinity, alignment: .leading)
             }
             #else
             buttonLabel(overlay: item.posterOverlay(for: displayType))
-                .trackingSize($posterSize)
             #endif
         }
         .environment(\.posterDisplayType, displayType)
@@ -99,7 +99,10 @@ struct PosterButton<Item: Poster>: View {
         .buttonBorderShape(.roundedRectangle)
         #if os(tvOS)
         .focusedValue(\.focusedPoster, AnyPoster(item))
+        .frame(maxWidth: .infinity, alignment: .leading)
+        .ignoresSafeArea()
         #endif
+        .trackingSize($posterSize)
         .posterContextMenu(for: item) {
             contextMenuPreview
                 .withViewContext(viewContext)
```

**File**: `Shared/Components/PosterHStack.swift` (modified, +2/-21)
```diff
@@ -9,17 +9,6 @@
 import CollectionHStack
 import SwiftUI
 
-enum PosterHStackMetrics {
-
-    static let itemSpacing: CGFloat = {
-        #if os(tvOS)
-        40
-        #else
-        EdgeInsets.edgePadding / 2
-        #endif
-    }()
-}
-
 struct PosterHStack<
     Data: Collection
 >: View where Data.Element: Poster, Data.Index == Int {
@@ -80,14 +69,6 @@ struct PosterHStack<
         #endif
     }
 
-    private var horizontalInset: CGFloat {
-        #if os(tvOS)
-        60
-        #else
-        EdgeInsets.edgePadding
-        #endif
-    }
-
     var body: some View {
         CollectionHStack(
             uniqueElements: elements,
@@ -102,8 +83,8 @@ struct PosterHStack<
             }
         }
         .clipsToBounds(false)
-        .insets(horizontal: horizontalInset)
-        .itemSpacing(PosterHStackMetrics.itemSpacing)
+        .insets(horizontal: EdgeInsets.edgePadding)
+        .itemSpacing(EdgeInsets.itemSpacing)
         .scrollBehavior(.continuousLeadingEdge)
         .withViewContext(.isThumb)
     }
```

**File**: `Shared/Components/PosterIndicators/UnplayedIndicator.swift` (modified, +12/-12)
```diff
@@ -17,25 +17,25 @@ struct UnplayedIndicator: View {
     let count: Int?
 
     var body: some View {
-        AlternateLayoutView(alignment: .topTrailing) {
-            Color.clear
-                .aspectRatio(1, contentMode: .fit)
-        } content: { (size: CGSize) in
-            if let count, count > 0 {
+        if let count, count > 0 {
+            ZStack {
+                Color.clear
+                    .aspectRatio(1, contentMode: .fit)
+
                 Text(count.description)
                     .fontWeight(.semibold)
                     .foregroundStyle(accentColor.overlayColor)
                     .padding(.horizontal, UIDevice.isTV ? 8 : 4)
                     .fixedSize()
-                    .frame(minWidth: size.width, minHeight: size.height)
-                    .background {
-                        UnevenRoundedRectangle(bottomLeadingRadius: UIDevice.isTV ? 18 : 6)
-                            .fill(accentColor)
-                    }
-            } else {
-                Q3RightTriangle()
+            }
+            .background {
+                UnevenRoundedRectangle(bottomLeadingRadius: UIDevice.isTV ? 18 : 6)
                     .fill(accentColor)
             }
+        } else {
+            Q3RightTriangle()
+                .fill(accentColor)
+                .aspectRatio(1, contentMode: .fit)
         }
     }
 }
```

**File**: `Shared/Extensions/EdgeInsets.swift` (modified, +9/-0)
```diff
@@ -36,6 +36,15 @@ extension EdgeInsets {
 
     static let edgeInsets: EdgeInsets = .init(edgePadding)
 
+    /// The gap between collection items and rows, independent of content insets.
+    static let itemSpacing: CGFloat = {
+        #if os(tvOS)
+        40
+        #else
+        10
+        #endif
+    }()
+
     init(_ constant: CGFloat) {
         self.init(top: constant, leading: constant, bottom: constant, trailing: constant)
     }
```

**File**: `Shared/Objects/ContentGroup/PillGroup.swift` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@ struct PillGroup<Element: Displayable>: ContentGroup {
         var body: some View {
             ContentGroupSection {
                 ScrollView(.horizontal) {
-                    HStack(spacing: PosterHStackMetrics.itemSpacing) {
+                    HStack(spacing: EdgeInsets.itemSpacing) {
                         ForEach(elements) { element in
                             Button {
                                 action(router, element)
```

**File**: `Shared/Objects/ContentGroup/SeriesEpisodeContentGroup/SeriesEpisodeContentGroup+EpisodeCard.swift` (modified, +4/-2)
```diff
@@ -82,7 +82,7 @@ extension SeriesEpisodeContentGroup {
                     overlayView
                 }
                 .contentShape(.contextMenuPreview, Rectangle())
-                .posterStyle(.landscape, contentMode: .fit)
+                .posterStyle(.landscape)
                 .subtleShadow()
                 .matchedTransitionSource(id: "item", in: namespace)
             }
@@ -114,7 +114,7 @@ extension SeriesEpisodeContentGroup {
                                 .foregroundStyle(.secondary)
                         }
                     }
-                    .posterStyle(.landscape, contentMode: .fit)
+                    .posterStyle(.landscape)
                     #if os(tvOS)
                     .posterCornerRadius(.landscape)
                     #endif
@@ -180,6 +180,7 @@ extension SeriesEpisodeContentGroup {
         var body: some View {
             VStack(alignment: .leading) {
                 artworkButton
+                    .posterAspectRatio(.landscape, contentMode: .fit)
 
                 Button(action: contentAction) {
                     EpisodeMetadataView(
@@ -205,6 +206,7 @@ extension SeriesEpisodeContentGroup {
                 .artwork,
                 priority: .userInitiated
             )
+            .frame(maxHeight: .infinity, alignment: .top)
         }
     }
 
```

**File**: `Shared/Objects/ContentGroup/SeriesEpisodeContentGroup/SeriesEpisodeContentGroup+EpisodeCollection.swift` (modified, +4/-9)
```diff
@@ -167,14 +167,6 @@ extension SeriesEpisodeContentGroup {
             #endif
         }
 
-        private static var itemSpacing: CGFloat {
-            #if os(tvOS)
-            40
-            #else
-            EdgeInsets.edgePadding / 2
-            #endif
-        }
-
         var body: some View {
             ContentGroupSection {
                 CollectionHStack(
@@ -183,11 +175,14 @@ extension SeriesEpisodeContentGroup {
                 ) { element in
                     content(element)
                         .focused($focusedElement, equals: element.id)
+                        #if os(tvOS)
+                        .ignoresSafeArea()
+                        #endif
                 }
                 .initialElement(id: preferredElementID)
                 .clipsToBounds(false)
                 .insets(horizontal: EdgeInsets.edgePadding)
-                .itemSpacing(Self.itemSpacing)
+                .itemSpacing(EdgeInsets.itemSpacing)
                 .scrollBehavior(.continuousLeadingEdge)
                 .focusSection()
                 .focused($focusedSection, equals: .episodes)
```

---

### Incident Patch 5: `800d1085` (2026-09-17)
**Commit Message**: Pin CoreStore, MPVUI, MediaAccessibilityKit (#2302)

**File**: `Swiftfin.xcodeproj/project.pbxproj` (modified, +6/-6)
```diff
@@ -1247,8 +1247,8 @@
 			isa = XCRemoteSwiftPackageReference;
 			repositoryURL = "https://github.com/JohnEstropia/CoreStore.git";
 			requirement = {
-				kind = upToNextMajorVersion;
-				minimumVersion = 9.0.0;
+				kind = exactVersion;
+				version = 9.2.0;
 			};
 		};
 		E13DD3D127168E65009D4DAF /* XCRemoteSwiftPackageReference "Defaults" */ = {
@@ -1327,16 +1327,16 @@
 			isa = XCRemoteSwiftPackageReference;
 			repositoryURL = "https://github.com/LePips/MPVUI";
 			requirement = {
-				kind = upToNextMajorVersion;
-				minimumVersion = 0.1.1;
+				kind = exactVersion;
+				version = 0.1.1;
 			};
 		};
 		E19005020000000000000005 /* XCRemoteSwiftPackageReference "MediaAccessibilityKit" */ = {
 			isa = XCRemoteSwiftPackageReference;
 			repositoryURL = "https://github.com/LePips/MediaAccessibilityKit";
 			requirement = {
-				kind = upToNextMajorVersion;
-				minimumVersion = 0.1.0;
+				kind = exactVersion;
+				version = 0.1.0;
 			};
 		};
 		E192608128D2D0DB002314B4 /* XCRemoteSwiftPackageReference "Factory" */ = {
```

**File**: `Swiftfin.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +2/-2)
```diff
@@ -42,8 +42,8 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/JohnEstropia/CoreStore.git",
       "state" : {
-        "revision" : "5a0d27cf343c6e341b0ef3c8d36104770b27a839",
-        "version" : "9.3.0"
+        "revision" : "4b6d9a54e75d2c9fd2c3c768f7d4aa3175c09133",
+        "version" : "9.2.0"
       }
     },
     {
```

---

### Incident Patch 6: `83ab4365` (2026-09-16)
**Commit Message**: fix(player): show audio and subtitle tracks during Live TV (#2298)

**File**: `Shared/Views/VideoPlayer/Components/Toolbar/ActionButtons/VideoPlayer+ActionButtons.swift` (modified, +0/-2)
```diff
@@ -46,11 +46,9 @@ extension VideoPlayer.PlaybackControls.Toolbar {
             }
 
             if manager.item.isLiveStream {
-                filteredButtons.removeAll { $0 == .audio }
                 filteredButtons.removeAll { $0 == .autoPlay }
                 filteredButtons.removeAll { $0 == .playbackSpeed }
                 filteredButtons.removeAll { $0 == .playbackSettings }
-                filteredButtons.removeAll { $0 == .subtitles }
             }
 
             return filteredButtons
```

#### Recent Merged Pull Requests:
- **PR #2357** (2026-10-05): Add SwiftFormat rules (@LePips)
- **PR #2356** (2026-10-04): Video pinch zoom (@LePips)
- **PR #2352** (2026-10-02): Update Jellyfin SDK (@LePips)
- **PR #2349** (2026-10-02): Skip CI on translations, cancel concurrent jobs (@LePips)
- **PR #2348** (2026-10-01): Fix tvOS build, fix user view text (@LePips)
- **PR #2347** (closed): Add next chapter button and skip intro prompt (@Kouzi99)
- **PR #2341** (closed): Fix CJK subtitle rendering in VLC (@trulyspinach)
- **PR #2340** (2026-09-29): tvOS App Icon Selection (@JPKribs)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
