# Forensic Learning Record (Deep Inspection): Lessica/TrollFools

> **Canonical Artifact**: `07_PROJECT_LEARNING/lessica-trollfools-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Lessica/TrollFools](https://github.com/Lessica/TrollFools))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:12:17.109Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Lessica/TrollFools`
- **Description**: In-place tweak injection with insert_dylib and ChOma.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3631 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `TrollFools/App+Ads.swift`
```
//
//  App+Ads.swift
//  TrollFools
//
//  Created by Rachel on 9/9/2025.
//

import Foundation

extension App {
    static let advertisementApp: App = {
        [
            App(
                bid: NSLocalizedString("Record your phone calls like never before.", comment: ""),
                name: NSLocalizedString("TrollRecorder", comment: ""),
                type: "System",
                teamID: "GXZ23M5TP2",
                url: URL(string: "https://havoc.app/package/trollrecorder")!,
                alternateIcon: .init(named: "tricon-default"),
                isAdvertisement: true
            ),
            App(
                bid: NSLocalizedString("Bringing back the most advanced system and security analysis tool.", comment: ""),
                name: NSLocalizedString("Reveil", comment: ""),
                type: "System",
                teamID: "GXZ23M5TP2",
                url: URL(string: "https://havoc.app/package/reveil")!,
                alternateIcon: .init(named: "reveil-default"),
                isAdvertisement: true
            ),
            App(
                bid: NSLocalizedString("Full-Fledged Automation Framework for TrollStore.", comment: ""),
                name: NSLocalizedString("XXTouch Elite TS", comment: ""),
                type: "System",
                teamID: "GXZ23M5TP2",
                url: URL(string: "https://havoc.app/package/xxtouchelitets")!,
                alternateIcon: .init(named: "elite-default"),
                isAdvertisement: true
            ),
            App(
                bid: NSLocalizedString("Fast, feature-rich VNC server for iOS: remote control made simple.", comment: ""),
                name: NSLocalizedString("TrollVNC", comment: ""),
                type: "System",
                teamID: "GXZ23M5TP2",
                url: URL(string: "https://havoc.app/package/trollvnc")!,
                alternateIcon: .init(named: "vnc-default"),
                isAdvertisement: true
            ),
        ].randomElement()!
    }()
}

```

### Core Architecture Module: `TrollFools/App.swift`
```
//
//  App.swift
//  TrollFools
//
//  Created by 82Flex on 2024/10/30.
//

import Combine
import Foundation

final class App: ObservableObject {
    let bid: String
    let name: String
    let latinName: String
    let type: String
    let teamID: String
    let url: URL
    let version: String?
    let isAdvertisement: Bool

    @Published var isDetached: Bool
    @Published var isAllowedToAttachOrDetach: Bool
    @Published var isInjected: Bool
    @Published var hasPersistedAssets: Bool

    lazy var icon: UIImage? = UIImage._applicationIconImage(forBundleIdentifier: bid, format: 0, scale: 3.0)
    var alternateIcon: UIImage?

    lazy var isUser: Bool = type == "User"
    lazy var isSystem: Bool = !isUser
    lazy var isFromApple: Bool = bid.hasPrefix("com.apple.")
    lazy var isFromTroll: Bool = isSystem && !isFromApple
    lazy var isRemovable: Bool = url.path.contains("/var/containers/Bundle/Application/")

    weak var appList: AppListModel?
    private var cancellables: Set<AnyCancellable> = []
    private static let reloadSubject = PassthroughSubject<String, Never>()

    init(
        bid: String,
        name: String,
        type: String,
        teamID: String,
        url: URL,
        version: String? = nil,
        alternateIcon: UIImage? = nil,
        isAdvertisement: Bool = false
    ) {
        self.bid = bid
        self.name = name
        self.type = type
        self.teamID = teamID
        self.url = url
        self.version = version
        self.isDetached = InjectorV3.main.isMetadataDetachedInBundle(url)
        self.isAllowedToAttachOrDetach = type == "User" && InjectorV3.main.isAllowedToAttachOrDetachMetadataInBundle(url)
        self.isInjected = InjectorV3.main.checkIsInjectedAppBundle(url)
        self.hasPersistedAssets = InjectorV3.main.hasPersistedAssets(bid: bid)
        self.alternateIcon = alternateIcon
        self.isAdvertisement = isAdvertisement
        self.latinName = name
            .applyingTransform(.toLatin, reverse: false)?
            .applyingTransform(.stripDiacritics, reverse: false)?
            .components(separatedBy: .whitespaces)
            .joined() ?? ""
        Self.reloadSubject
            .filter { $0 == bid }
            .sink { [weak self] _ in
                self?._reload()
            }
            .store(in: &cancellables)
    }

    func reload() {
        Self.reloadSubject.send(bid)
    }

    private func _reload() {
        reloadDetachedStatus()
        reloadInjectedStatus()
    }

    private func reloadDetachedStatus() {
        self.isDetached = InjectorV3.main.isMetadataDetachedInBundle(url)
        self.isAllowedToAttachOrDetach = isUser && InjectorV3.main.isAllowedToAttachOrDetachMetadataInBundle(url)
    }

    private func reloadInjectedStatus() {
        self.isInjected = InjectorV3.main.checkIsInjectedAppBundle(url)
        self.hasPersistedAssets = InjectorV3.main.hasPersistedAssets(bid: bid)
    }
}

```

### Core Architecture Module: `TrollFools/AppListCell.swift`
```
//
//  AppListCell.swift
//  TrollFools
//
//  Created by 82Flex on 2024/10/30.
//

import CocoaLumberjackSwift
import SwiftUI

struct AppListCell: View {
    @EnvironmentObject var appList: AppListModel

    @StateObject var app: App

    @available(iOS 15, *)
    var highlightedName: AttributedString {
        let name = app.name
        var attributedString = AttributedString(name)
        if let range = attributedString.range(of: appList.filter.searchKeyword, options: [.caseInsensitive, .diacriticInsensitive]) {
            attributedString[range].foregroundColor = .accentColor
        }
        return attributedString
    }

    @available(iOS 15, *)
    var highlightedId: AttributedString {
        let bid = app.bid
        var attributedString = AttributedString(bid)
        if let range = attributedString.range(of: appList.filter.searchKeyword, options: [.caseInsensitive, .diacriticInsensitive]) {
            attributedString[range].foregroundColor = .accentColor
        }
        return attributedString
    }

    var body: some View {
        HStack(spacing: 12) {
            if #available(iOS 15, *) {
                Image(uiImage: app.alternateIcon ?? app.icon ?? UIImage())
                    .resizable()
                    .frame(width: 32, height: 32)
            } else {
                Image(uiImage: app.alternateIcon ?? app.icon ?? UIImage())
                    .resizable()
                    .frame(width: 32, height: 32)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    if #available(iOS 15, *) {
                        Text(highlightedName)
                            .font(.headline)
                            .lineLimit(1)
                    } else {
                        Text(app.name)
                            .font(.headline)
                            .lineLimit(1)
                    }

                    if app.isInjected || app.hasPersistedAssets {
                        Image(systemName: app.isInjected ? "bandage" : "exclamationmark.triangle")
                            .font(.subheadline)
                            .foregroundColor(.orange)
                            .accessibilityLabel(app.isInjected ? NSLocalizedString("Patched", comment: "") : NSLocalizedString("Includes Disabled PlugIns", comment: ""))
                            .transition(.opacity)
                    }
                }
                .animation(.easeOut, value: combines(
                    app.isInjected,
                    app.hasPersistedAssets
                ))

                if #available(iOS 15, *) {
                    Text(highlightedId)
                        .font(.subheadline)
                        .lineLimit(app.isAdvertisement ? 2 : 1)
                } else {
                    Text(app.bid)
                        .font(.subheadline)
                        .lineLimit(app.isAdvertisement ? 2 : 1)
                }
            }

            Spacer()

            if let version = app.version {
                if app.isUser && app.isDetached {
                    HStack(spacing: 4) {
                        Image(systemName: "lock")
                            .font(.subheadline)
                            .foregroundColor(.red)
                            .accessibilityLabel(NSLocalizedString("Pinned Version", comment: ""))

                        Text(version)
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .lineLimit(1)
                    }
                } else {
                    Text(version)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }
            } else if app.isAdvertisement {
                Image("badge-ad")
                    .foregroundColor(.secondary)
                    .scaleEffect(1.2)
                    .accessibilityLabel(NSLocalizedString("This is an advertisement.", comment: ""))
            }
        }
        .contextMenu {
            if !appList.isSelectorMode && !app.isAdvertisement {
                cellContextMenuWrapper
            }
        }
        .background(cellBackground)
    }

    @ViewBuilder
    var cellContextMenu: some View {
        Button {
            launch()
        } label: {
            Label(NSLocalizedString("Launch", comment: ""), systemImage: "command")
        }

        if AppListModel.hasTrollStore && app.isAllowedToAttachOrDetach {
            if app.isDetached {
                Button {
                    do {
                        try InjectorV3(app.url).setMetadataDetached(false)
                        app.reload()
                        appList.isRebuildNeeded = true
                    } catch { DDLogError("\(error)", ddlog: InjectorV3.main.logger) }
                } label: {
                    Label(NSLocalizedString("Unlock Version", comment: ""), systemImage: "lock.open")
                }
            } else {
                Button {
                    do {
                        try InjectorV3(app.url).setMetadataDetached(true)
                        app.reload()
                        appList.isRebuildNeeded = true
                    } catch { DDLogError("\(error)", ddlog: InjectorV3.main.logger) }
                } label: {
                    Label(NSLocalizedString("Lock Version", comment: ""), systemImage: "lock")
                }
            }
        }

        Button {
            openInFilza()
        } label: {
            if isFilzaInstalled {
                Label(NSLocalizedString("Show in Filza", comment: ""), systemImage: "scope")
            } else {
                Label(NSLocalizedString("Filza (URL Scheme) Not Installed", comment: ""), systemImage: "xmark.octagon")
            }
        }
        .disabled(!isFilzaInstalled)
    }

    @ViewBuilder
    var cellContextMenuWrapper: some View {
        if #available(iOS 16, *) {
            // iOS 16
            cellContextMenu
        } else {
            if #available(iOS 15, *) { }
            else {
                // iOS 14
                cellContextMenu
            }
        }
    }

    @ViewBuilder
    var cellBackground: some View {
        if #available(iOS 15, *) {
            if #available(iOS 16, *) { }
            else {
                // iOS 15
                Color.clear
                    .contextMenu {
                        if !appList.isSelectorMode {
                            cellContextMenu
                        }
                    }
                    .id(app.isDetached)
            }
        }
    }

    private func launch() {
        LSApplicationWorkspace.default().openApplication(withBundleID: app.bid)
    }

    var isFilzaInstalled: Bool { appList.isFilzaInstalled }

    private func openInFilza() {
        appList.openInFilza(app.url)
    }
}

```

### Core Architecture Module: `TrollFools/AppListModel.swift`
```
//
//  AppListModel.swift
//  TrollFools
//
//  Created by 82Flex on 2024/10/30.
//

import notify
import Combine
import OrderedCollections
import SwiftUI

final class AppListModel: ObservableObject {
    enum Scope: Int, CaseIterable {
        case all
        case user
        case troll
        case system

        var localizedShortName: String {
            switch self {
            case .all:
                NSLocalizedString("All", comment: "")
            case .user:
                NSLocalizedString("User", comment: "")
            case .troll:
                NSLocalizedString("TrollStore", comment: "")
            case .system:
                NSLocalizedString("System", comment: "")
            }
        }

        var localizedName: String {
            switch self {
            case .all:
                NSLocalizedString("All Applications", comment: "")
            case .user:
                NSLocalizedString("User Applications", comment: "")
            case .troll:
                NSLocalizedString("TrollStore Applications", comment: "")
            case .system:
                NSLocalizedString("Injectable System Applications", comment: "")
            }
        }
    }

    static let isLegacyDevice: Bool = { UIScreen.main.fixedCoordinateSpace.bounds.height <= 736.0 }()
    static let hasTrollStore: Bool = { LSApplicationProxy(forIdentifier: "com.opa334.TrollStore") != nil }()
    private var _allApplications: [App] = []

    let selectorURL: URL?
    var isSelectorMode: Bool { selectorURL != nil }

    @Published var filter = FilterOptions()
    @Published var activeScope: Scope = .all
    @Published var activeScopeApps: OrderedDictionary<String, [App]> = [:]

    @Published var unsupportedCount: Int = 0

    lazy var isFilzaInstalled: Bool = {
        if let filzaURL {
            UIApplication.shared.canOpenURL(filzaURL)
        } else {
            false
        }
    }()
    private let filzaURL = URL(string: "filza://view")

    @Published var isRebuildNeeded: Bool = false

    private let applicationChanged = PassthroughSubject<Void, Never>()
    private var cancellables = Set<AnyCancellable>()
    private var darwinNotifyToken: Int32 = NOTIFY_TOKEN_INVALID

    init(selectorURL: URL? = nil) {
        self.selectorURL = selectorURL
        reload()

        Publishers.CombineLatest(
            $filter,
            $activeScope
        )
        .throttle(for: 0.5, scheduler: DispatchQueue.main, latest: true)
        .sink { [weak self] _ in
            self?.performFilter()
        }
        .store(in: &cancellables)

        applicationChanged
            .throttle(for: 0.5, scheduler: DispatchQueue.main, latest: true)
            .sink { [weak self] _ in
                self?.reload()
            }
            .store(in: &cancellables)

        // Uses notify_register_dispatch instead of CFNotificationCenterAddObserver to avoid
        // Unmanaged pointer management. Unlike CFNotificationCenterAddObserver with .coalesce,
        // notify_register_dispatch may deliver queued notifications individually upon app resume,
        // but the .throttle(for: 0.5, ...) on applicationChanged already coalesces rapid bursts.
        notify_register_dispatch("com.apple.LaunchServices.ApplicationsChanged", &darwinNotifyToken, .main) { [weak self] _ in
            self?.applicationChanged.send()
        }
    }

    deinit {
        if darwinNotifyToken != NOTIFY_TOKEN_INVALID {
            notify_cancel(darwinNotifyToken)
        }
    }

    func reload() {
        let allApplications = Self.fetchApplications(&unsupportedCount)
        allApplications.forEach { $0.appList = self }
        _allApplications = allApplications
        performFilter()
    }

    func performFilter() {
        var filteredApplications = _allApplications

        if !filter.searchKeyword.isEmpty {
            filteredApplications = filteredApplications.filter {
                $0.name.localizedCaseInsensitiveContains(filter.searchKeyword) || $0.bid.localizedCaseInsensitiveContains(filter.searchKeyword) ||
                    (
                        $0.latinName.localizedCaseInsensitiveContains(
                            filter.searchKeyword
                                .components(separatedBy: .whitespaces).joined()
                        )
                    )
            }
        }

        if filter.showPatchedOnly {
            filteredApplications = filteredApplications.filter { $0.isInjected || $0.hasPersistedAssets }
        }

        switch activeScope {
        case .all:
            activeScopeApps = Self.groupedAppList(filteredApplications)
        case .user:
            activeScopeApps = Self.groupedAppList(filteredApplications.filter { $0.isUser })
        case .troll:
            activeScopeApps = Self.groupedAppList(filteredApplications.filter { $0.isFromTroll })
        case .system:
            activeScopeApps = Self.groupedAppList(filteredApplications.filter { $0.isFromApple })
        }
    }

    private static let excludedIdentifiers: Set<String> = [
        "com.opa334.Dopamine",
        "org.coolstar.SileoStore",
        "xyz.willy.Zebra",
    ]

    private static func fetchApplications(_ unsupportedCount: inout Int) -> [App] {
        let allApps: [App] = LSApplicationWorkspace.default()
            .allApplications()
            .compactMap { proxy in
                guard let id = proxy.applicationIdentifier(),
                      let url = proxy.bundleURL(),
                      let teamID = proxy.teamID(),
                      let appType = proxy.applicationType(),
                      let localizedName = proxy.localizedName()
                else {
                    return nil
                }

                guard !id.hasPrefix("wiki.qaq.") && !id.hasPrefix("com.82flex.") && !id.hasPrefix("ch.xxtou.") else {
                    return nil
                }

                guard !excludedIdentifiers.contains(id) else {
                    return nil
                }

                let shortVersionString: String? = proxy.shortVersionString()
                let app = App(
                    bid: id,
                    name: localizedName,
                    type: appType,
                    teamID: teamID,
                    url: url,
                    version: shortVersionString
                )

                if app.isUser && app.isFromApple {
                    return nil
                }

                guard app.isRemovable else {
                    return nil
                }

                return app
            }

        let filteredApps = allApps
            .filter { $0.isSystem || InjectorV3.main.checkIsEligibleAppBundle($0.url) }
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }

        unsupportedCount = allApps.count - filteredApps.count

        return filteredApps
    }
}

extension AppListModel {
    func openInFilza(_ url: URL) {
        guard let filzaURL else {
            return
        }

        let fileURL: URL
        if #available(iOS 16, *) {
            fileURL = filzaURL.appending(path: url.path)
        } else {
            fileURL = URL(string: filzaURL.absoluteString + (url.path.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? ""))!
        }

        UIApplication.shared.open(fileURL)
    }

    func rebuildIconCache() {
        // Sadly, we can't call `trollstorehelper` directly because only TrollStore can launch it without error.
        DispatchQueue.global(qos: .userInitiated).async {
            LSApplicationWorkspace.default().openApplication(withBundleID: "com.opa334.TrollStore")
        }
    }
}

extension AppListModel {
    static let allowedCharacters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#"
    private static let allowedCharacterSet = CharacterSet(charactersIn: allowedCharacters)

    private static func groupedAppList(_ apps: [App]) -> OrderedDictionary<String, [App]> {
        var groupedApps = OrderedDictionary<String, [App]>()

        for app in apps {
            var key = app.name
                .trimmingCharacters(in: .controlCharacters)
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .applyingTransform(.stripCombiningMarks, reverse: false)?
                .applyingTransform(.toLatin, reverse: false)?
                .applyingTransform(.stripDiacritics, reverse: false)?
                .prefix(1).uppercased() ?? "#"

            if let scalar = UnicodeScalar(key) {
                if !allowedCharacterSet.contains(scalar) {
                    key = "#"
                }
            } else {
                key = "#"
            }

            if groupedApps[key] == nil {
                groupedApps[key] = []
            }

            groupedApps[key]?.append(app)
        }

        groupedApps.sort { app1, app2 in
            if let c1 = app1.key.first,
               let c2 = app2.key.first,
               let idx1 = allowedCharacters.firstIndex(of: c1),
               let idx2 = allowedCharacters.firstIndex(of: c2)
            {
                return idx1 < idx2
            }
            return app1.key < app2.key
        }

        return groupedApps
    }
}

```

### Core Architecture Module: `TrollFools/AppListSearchModel.swift`
```
//
//  AppListSearchModel.swift
//  TrollFools
//
//  Created by 82Flex on 3/8/25.
//

import Combine
import UIKit

final class AppListSearchModel: NSObject, ObservableObject {
    @Published var searchKeyword: String = ""
    @Published var searchScopeIndex: Int = 0

    weak var searchController: UISearchController?
    weak var forwardSearchBarDelegate: (any UISearchBarDelegate)?
}

extension AppListSearchModel: UISearchBarDelegate, UISearchResultsUpdating {
    func updateSearchResults(for searchController: UISearchController) {
        searchKeyword = searchController.searchBar.text ?? ""
    }

    func searchBarShouldBeginEditing(_ searchBar: UISearchBar) -> Bool {
        forwardSearchBarDelegate?.searchBarShouldBeginEditing?(searchBar) ?? true
    }

    func searchBarTextDidBeginEditing(_ searchBar: UISearchBar) {
        forwardSearchBarDelegate?.searchBarTextDidBeginEditing?(searchBar)
    }

    func searchBarShouldEndEditing(_ searchBar: UISearchBar) -> Bool {
        forwardSearchBarDelegate?.searchBarShouldEndEditing?(searchBar) ?? true
    }

    func searchBarTextDidEndEditing(_ searchBar: UISearchBar) {
        forwardSearchBarDelegate?.searchBarTextDidEndEditing?(searchBar)
    }

    func searchBar(_ searchBar: UISearchBar, textDidChange searchText: String) {
        forwardSearchBarDelegate?.searchBar?(searchBar, textDidChange: searchText)
    }

    func searchBar(_ searchBar: UISearchBar, shouldChangeTextIn range: NSRange, replacementText text: String) -> Bool {
        forwardSearchBarDelegate?.searchBar?(searchBar, shouldChangeTextIn: range, replacementText: text) ?? true
    }

    func searchBarSearchButtonClicked(_ searchBar: UISearchBar) {
        forwardSearchBarDelegate?.searchBarSearchButtonClicked?(searchBar)
    }

    func searchBarBookmarkButtonClicked(_ searchBar: UISearchBar) {
        forwardSearchBarDelegate?.searchBarBookmarkButtonClicked?(searchBar)
    }

    func searchBarCancelButtonClicked(_ searchBar: UISearchBar) {
        forwardSearchBarDelegate?.searchBarCancelButtonClicked?(searchBar)
    }

    func searchBarResultsListButtonClicked(_ searchBar: UISearchBar) {
        forwardSearchBarDelegate?.searchBarResultsListButtonClicked?(searchBar)
    }

    func searchBar(_ searchBar: UISearchBar, selectedScopeButtonIndexDidChange selectedScope: Int) {
        searchScopeIndex = selectedScope
        forwardSearchBarDelegate?.searchBar?(searchBar, selectedScopeButtonIndexDidChange: selectedScope)
    }
}

```

### Core Architecture Module: `TrollFools/AppListView.swift`
```
//
//  AppListView.swift
//  TrollFools
//
//  Created by Lessica on 2024/7/19.
//

import CocoaLumberjackSwift
import OrderedCollections
import SwiftUI
import SwiftUIIntrospect

typealias Scope = AppListModel.Scope

struct AppListView: View {
    let isPad: Bool = UIDevice.current.userInterfaceIdiom == .pad

    @StateObject var searchViewModel = AppListSearchModel()
    @EnvironmentObject var appList: AppListModel
    @Environment(\.verticalSizeClass) var verticalSizeClass

    @State var selectorOpenedURL: URLIdentifiable? = nil
    @State var selectedIndex: String? = nil

    @State var isWarningPresented = false
    @State var temporaryOpenedURL: URLIdentifiable? = nil

    @State var latestVersionString: String?

    @AppStorage("isAdvertisementHiddenV2")
    var isAdvertisementHidden: Bool = false

    @AppStorage("isWarningHidden")
    var isWarningHidden: Bool = false

    var shouldShowAdvertisement: Bool {
        !isAdvertisementHidden &&
            !appList.filter.isSearching &&
            !appList.filter.showPatchedOnly &&
            !appList.isRebuildNeeded &&
            !appList.isSelectorMode
    }

    var appString: String {
        let appNameString = Bundle.main.infoDictionary?["CFBundleName"] as? String ?? "TrollFools"
        let appVersionString = String(
            format: "v%@ (%@)",
            Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.0.0",
            Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "0"
        )

        let appStringFormat = """
        %@ %@
        %@ © 2024-%d %@
        """

        return String(
            format: appStringFormat,
            appNameString, appVersionString,
            NSLocalizedString("Copyright", comment: ""),
            Calendar.current.component(.year, from: Date()),
            NSLocalizedString("Lessica, huami1314, iosdump and other contributors", comment: "")
        )
    }

    var body: some View {
        if #available(iOS 15, *) {
            content
                .alert(
                    NSLocalizedString("Notice", comment: ""),
                    isPresented: $isWarningPresented,
                    presenting: temporaryOpenedURL
                ) { result in
                    Button {
                        selectorOpenedURL = result
                    } label: {
                        Text(NSLocalizedString("Continue", comment: ""))
                    }
                    Button(role: .destructive) {
                        selectorOpenedURL = result
                        isWarningHidden = true
                    } label: {
                        Text(NSLocalizedString("Continue and Don’t Show Again", comment: ""))
                    }
                    Button(role: .cancel) {
                        temporaryOpenedURL = nil
                        isWarningPresented = false
                    } label: {
                        Text(NSLocalizedString("Cancel", comment: ""))
                    }
                } message: {
                    Text(OptionView.warningMessage([$0.url]))
                }
        } else {
            content
        }
    }

    var content: some View {
        styledNavigationView
            .animation(.easeOut, value: appList.activeScopeApps.keys)
            .sheet(item: $selectorOpenedURL) { urlWrapper in
                AppListView()
                    .environmentObject(AppListModel(selectorURL: urlWrapper.url))
            }
            .onOpenURL { url in
                let ext = url.pathExtension.lowercased()
                guard url.isFileURL,
                      ext == "dylib" || ext == "deb" || ext == "zip"
                else {
                    return
                }

                let urlIdent = URLIdentifiable(url: preprocessURL(url))
                if #available(iOS 15, *) {
                    if !isWarningHidden && ext == "deb" {
                        temporaryOpenedURL = urlIdent
                        isWarningPresented = true
                        return
                    }
                }

                selectorOpenedURL = urlIdent
            }
            .onAppear {
                if Double.random(in: 0 ..< 1) < 0.1 {
                    isAdvertisementHidden = false
                }

                CheckUpdateManager.shared.checkUpdateIfNeeded { latestVersion, _ in
                    DispatchQueue.main.async {
                        withAnimation {
                            latestVersionString = latestVersion?.tagName
                        }
                    }
                }
            }
    }

    @ViewBuilder
    var styledNavigationView: some View {
        if isPad {
            navigationView
                .navigationViewStyle(.automatic)
        } else {
            navigationView
                .navigationViewStyle(.stack)
        }
    }

    var navigationView: some View {
        NavigationView {
            ScrollViewReader { reader in
                ZStack {
                    refreshableListView

                    if verticalSizeClass == .regular && appList.activeScopeApps.keys.count > 1 {
                        IndexableScroller(
                            indexes: appList.activeScopeApps.keys.elements,
                            currentIndex: $selectedIndex
                        )
                        .accessibilityHidden(true)
                    }
                }
                .onChange(of: selectedIndex) { index in
                    if let index {
                        reader.scrollTo("AppSection-\(index)", anchor: .center)
                    }
                }
            }

            // Detail view shown when nothing has been selected
            if !appList.isSelectorMode {
                PlaceholderView()
            }
        }
    }

    @ViewBuilder
    var refreshableListView: some View {
        if #available(iOS 15, *) {
            searchableListView
                .refreshable {
                    appList.reload()
                }
        } else {
            searchableListView
                .introspect(.list, on: .iOS(.v14)) { tableView in
                    if tableView.refreshControl == nil {
                        tableView.refreshControl = {
                            let refreshControl = UIRefreshControl()
                            refreshControl.addAction(UIAction { action in
                                appList.reload()
                                if let control = action.sender as? UIRefreshControl {
                                    control.endRefreshing()
                                }
                            }, for: .valueChanged)
                            return refreshControl
                        }()
                    }
                }
        }
    }

    var searchableListView: some View {
        listView
            .onChange(of: appList.filter.showPatchedOnly) { showPatchedOnly in
                if let searchBar = searchViewModel.searchController?.searchBar {
                    reloadSearchBarPlaceholder(searchBar, showPatchedOnly: showPatchedOnly)
                }
            }
            .onReceive(searchViewModel.$searchKeyword) {
                appList.filter.searchKeyword = $0
            }
            .onReceive(searchViewModel.$searchScopeIndex) {
                appList.activeScope = Scope(rawValue: $0) ?? .all
            }
            .introspect(.viewController, on: .iOS(.v14, .v15, .v16, .v17, .v18)) { viewController in
                viewController.navigationItem.hidesSearchBarWhenScrolling = true
                if searchViewModel.searchController == nil {
                    viewController.navigationItem.searchController = {
                        let searchController = UISearchController(searchResultsController: nil)
                        searchController.searchResultsUpdater = searchViewModel
                        searchController.obscuresBackgroundDuringPresentation = false
                        searchController.hidesNavigationBarDuringPresentation = true
                        searchController.automaticallyShowsScopeBar = false
                        if #available(iOS 16, *) {
                            searchController.scopeBarActivation = .manual
                        }
                        setupSearchBar(searchController: searchController)
                        return searchController
                    }()
                    searchViewModel.searchController = viewController.navigationItem.searchController
                }
            }
    }

    var listView: some View {
        List {
            topSection

            if #available(iOS 15, *) {
                if appList.activeScope == .all && shouldShowAdvertisement {
                    advertisementSection
                }
            }

            appSections
        }
        .animation(.easeOut, value: combines(
            appList.isRebuildNeeded,
            appList.activeScope,
            appList.filter,
            appList.unsupportedCount,
            shouldShowAdvertisement
        ))
        .listStyle(.insetGrouped)
        .navigationTitle(appList.isSelectorMode ?
            NSLocalizedString("Select Application to Inject", comment: "") :
            NSLocalizedString("TrollFools", comment: "")
        )
        .navigationBarTitleDisplayMode((AppListModel.isLegacyDevice || appList.isSelectorMode) ? .inline : .automatic)
        .toolbar {
            ToolbarItem(placement: .principal) {
                if appList.isSelectorMode, let selectorURL = appList.selectorURL {
                    VStack {
                        Text(selectorURL.lastPathComponent).font(.headline)
                        Text(NSLocalizedString("Select Application to Inject", comment: "")).font(.caption)
                    }
                }
            }
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
        
```

### Core Architecture Module: `TrollFools/AuxiliaryExecute+Spawn.swift`
```
//
//  AuxiliaryExecute+Spawn.swift
//  TrollFools
//
//  Created by Lakr Aream on 2021/12/6.
//

import CocoaLumberjackSwift
import Foundation

@discardableResult
@_silgen_name("posix_spawn_file_actions_addchdir_np")
private func posix_spawn_file_actions_addchdir_np(
    _ attr: UnsafeMutablePointer<posix_spawn_file_actions_t?>,
    _ dir: UnsafePointer<Int8>
) -> Int32

@discardableResult
@_silgen_name("posix_spawnattr_set_persona_np")
private func posix_spawnattr_set_persona_np(
    _ attr: UnsafeMutablePointer<posix_spawnattr_t?>,
    _ persona_id: uid_t,
    _ flags: UInt32
) -> Int32

@discardableResult
@_silgen_name("posix_spawnattr_set_persona_uid_np")
private func posix_spawnattr_set_persona_uid_np(
    _ attr: UnsafeMutablePointer<posix_spawnattr_t?>,
    _ persona_id: uid_t
) -> Int32

@discardableResult
@_silgen_name("posix_spawnattr_set_persona_gid_np")
private func posix_spawnattr_set_persona_gid_np(
    _ attr: UnsafeMutablePointer<posix_spawnattr_t?>,
    _ persona_id: gid_t
) -> Int32

private func WIFEXITED(_ status: Int32) -> Bool {
    _WSTATUS(status) == 0
}

private func _WSTATUS(_ status: Int32) -> Int32 {
    status & 0x7F
}

private func WIFSIGNALED(_ status: Int32) -> Bool {
    (_WSTATUS(status) != 0) && (_WSTATUS(status) != 0x7F)
}

private func WEXITSTATUS(_ status: Int32) -> Int32 {
    (status >> 8) & 0xFF
}

private func WTERMSIG(_ status: Int32) -> Int32 {
    status & 0x7F
}

private let POSIX_SPAWN_PERSONA_FLAGS_OVERRIDE = UInt32(1)

public extension AuxiliaryExecute {
    /// call posix spawn to begin execute
    /// - Parameters:
    ///   - command: full path of the binary file. eg: "/bin/cat"
    ///   - args: arg to pass to the binary, exclude argv[0] which is the path itself. eg: ["nya"]
    ///   - environment: any environment to be appended/overwrite when calling posix spawn. eg: ["mua" : "nya"]
    ///   - workingDirectory: chdir
    ///   - timeout: any wall timeout if lager than 0, in seconds. eg: 6
    ///   - output: a block call from pipeControlQueue in background when buffer from stdout or stderr available for read
    /// - Returns: execution receipt, see it's definition for details
    @discardableResult
    static func spawn(
        command: String,
        args: [String] = [],
        environment: [String: String] = [:],
        workingDirectory: String? = nil,
        personaOptions: PersonaOptions? = nil,
        timeout: Double = 0,
        ddlog: DDLog = .sharedInstance,
        setPid: ((pid_t) -> Void)? = nil,
        output: ((String) -> Void)? = nil
    ) -> ExecuteReceipt {
        let outputLock = NSLock()
        let result = spawn(
            command: command,
            args: args,
            environment: environment,
            workingDirectory: workingDirectory,
            personaOptions: personaOptions,
            timeout: timeout,
            ddlog: ddlog,
            setPid: setPid
        ) { str in
            outputLock.lock()
            output?(str)
            outputLock.unlock()
        } stderrBlock: { str in
            outputLock.lock()
            output?(str)
            outputLock.unlock()
        }
        return result
    }

    /// call posix spawn to begin execute and block until the process exits
    /// - Parameters:
    ///   - command: full path of the binary file. eg: "/bin/cat"
    ///   - args: arg to pass to the binary, exclude argv[0] which is the path itself. eg: ["nya"]
    ///   - environment: any environment to be appended/overwrite when calling posix spawn. eg: ["mua" : "nya"]
    ///   - workingDirectory: chdir
    ///   - timeout: any wall timeout if lager than 0, in seconds. eg: 6
    ///   - stdout: a block call from pipeControlQueue in background when buffer from stdout available for read
    ///   - stderr: a block call from pipeControlQueue in background when buffer from stderr available for read
    /// - Returns: execution receipt, see it's definition for details
    static func spawn(
        command: String,
        args: [String] = [],
        environment: [String: String] = [:],
        workingDirectory: String? = nil,
        personaOptions: PersonaOptions? = nil,
        timeout: Double = 0,
        ddlog: DDLog = .sharedInstance,
        setPid: ((pid_t) -> Void)? = nil,
        stdoutBlock: ((String) -> Void)? = nil,
        stderrBlock: ((String) -> Void)? = nil
    ) -> ExecuteReceipt {
        let sema = DispatchSemaphore(value: 0)
        var receipt: ExecuteReceipt!
        spawn(
            command: command,
            args: args,
            environment: environment,
            workingDirectory: workingDirectory,
            personaOptions: personaOptions,
            timeout: timeout,
            ddlog: ddlog,
            setPid: setPid,
            stdoutBlock: stdoutBlock,
            stderrBlock: stderrBlock
        ) {
            receipt = $0
            sema.signal()
        }
        sema.wait()
        return receipt
    }

    /// call posix spawn to begin execute
    /// - Parameters:
    ///   - command: full path of the binary file. eg: "/bin/cat"
    ///   - args: arg to pass to the binary, exclude argv[0] which is the path itself. eg: ["nya"]
    ///   - environment: any environment to be appended/overwrite when calling posix spawn. eg: ["mua" : "nya"]
    ///   - workingDirectory: chdir file action
    ///   - personaOptions: persona options
    ///   - timeout: any wall timeout if lager than 0, in seconds. eg: 6
    ///   - setPid: called sync when pid available
    ///   - stdoutBlock: a block call from pipeControlQueue in background when buffer from stdout available for read
    ///   - stderrBlock: a block call from pipeControlQueue in background when buffer from stderr available for read
    ///   - completionBlock: a block called from processControlQueue or current queue when the process is finished or an error occurred
    static func spawn(
        command: String,
        args: [String] = [],
        environment: [String: String] = [:],
        workingDirectory: String? = nil,
        personaOptions: PersonaOptions? = nil,
        timeout: Double = 0,
        ddlog: DDLog = .sharedInstance,
        setPid: ((pid_t) -> Void)? = nil,
        stdoutBlock: ((String) -> Void)? = nil,
        stderrBlock: ((String) -> Void)? = nil,
        completionBlock: ((ExecuteReceipt) -> Void)? = nil
    ) {
        // MARK: PREPARE ATTRIBUTE -

        var attrs: posix_spawnattr_t?
        posix_spawnattr_init(&attrs)
        defer { posix_spawnattr_destroy(&attrs) }

        if let personaOptions {
            posix_spawnattr_set_persona_np(&attrs, 99, POSIX_SPAWN_PERSONA_FLAGS_OVERRIDE)
            posix_spawnattr_set_persona_uid_np(&attrs, personaOptions.uid)
            posix_spawnattr_set_persona_gid_np(&attrs, personaOptions.gid)
        }

        // MARK: PREPARE FILE PIPE -

        var pipestdout: [Int32] = [0, 0]
        var pipestderr: [Int32] = [0, 0]

        let bufsiz = Int(exactly: BUFSIZ) ?? 65535

        pipe(&pipestdout)
        pipe(&pipestderr)

        guard fcntl(pipestdout[0], F_SETFL, O_NONBLOCK) != -1 else {
            let receipt = ExecuteReceipt.failure(error: .openFilePipeFailed)
            completionBlock?(receipt)
            return
        }
        guard fcntl(pipestderr[0], F_SETFL, O_NONBLOCK) != -1 else {
            let receipt = ExecuteReceipt.failure(error: .openFilePipeFailed)
            completionBlock?(receipt)
            return
        }

        // MARK: PREPARE FILE ACTION -

        var fileActions: posix_spawn_file_actions_t?
        posix_spawn_file_actions_init(&fileActions)
        posix_spawn_file_actions_addclose(&fileActions, pipestdout[0])
        posix_spawn_file_actions_addclose(&fileActions, pipestderr[0])
        posix_spawn_file_actions_adddup2(&fileActions, pipestdout[1], STDOUT_FILENO)
        posix_spawn_file_actions_adddup2(&fileActions, pipestderr[1], STDERR_FILENO)
        posix_spawn_file_actions_addclose(&fileActions, pipestdout[1])
        posix_spawn_file_actions_addclose(&fileActions, pipestderr[1])

        if let workingDirectory = workingDirectory {
            posix_spawn_file_actions_addchdir_np(&fileActions, workingDirectory)
        }

        defer { posix_spawn_file_actions_destroy(&fileActions) }

        // MARK: PREPARE ENV -

        var realEnvironmentBuilder: [String] = []
        // before building the environment, we need to read from the existing environment
        do {
            var envBuilder = [String: String]()
            var currentEnv = environ
            while let rawStr = currentEnv.pointee {
                defer { currentEnv += 1 }
                // get the env
                let str = String(cString: rawStr)
                guard let key = str.components(separatedBy: "=").first else {
                    continue
                }
                if !(str.count >= "\(key)=".count) {
                    continue
                }
                // this is to aviod any problem with mua=nya=nya= that ending with =
                let value = String(str.dropFirst("\(key)=".count))
                envBuilder[key] = value
            }
            // now, let's overwrite the environment specified in parameters
            for (key, value) in environment {
                envBuilder[key] = value
            }
            // now, package those items
            for (key, value) in envBuilder {
                realEnvironmentBuilder.append("\(key)=\(value)")
            }
        }
        // making it a c shit
        let realEnv: [UnsafeMutablePointer<CChar>?] = realEnvironmentBuilder.map { $0.withCString(strdup) }
        defer { for case let env? in realEnv { free(env) } }

        // MARK: PREPARE ARGS -

        let args = [command] + args
        let argv: [UnsafeMutablePointer<CChar>?] = args.map { $0.withCString(strdup) }
        defer { for case let arg? in argv { free(arg) } }

        // MARK: NOW POSIX_SPAWN -

        var pid: pid_t = 0
        let 
```

### Core Architecture Module: `TrollFools/AuxiliaryExecute.swift`
```
//
//  AuxiliaryExecute.swift
//  TrollFools
//
//  Created by Lakr Aream on 2021/11/27.
//

import Foundation

/// Execute command or shell with posix, shared with AuxiliaryExecute.local
public class AuxiliaryExecute {
    /// we do not recommend you to subclass this singleton
    public static let local = AuxiliaryExecute()

    // if binary not found when you call the shell api
    // we will take some time to rebuild the bianry table each time
    // -->>> this is a time-heavy-task
    // so use binaryLocationFor(command:) to cache it if needed

    // system path
    internal var currentPath: [String] = []
    // system binary table
    internal var binaryTable: [String: String] = [:]

    // for you to put your own search path
    internal var extraSearchPath: [String] = []
    // for you to set your own binary table and will be used firstly
    // if you set nil here
    // -> we will return nil even the binary found in system path
    internal var overwriteTable: [String: String?] = [:]

    // this value is used when providing 0 or negative timeout paramete
    internal static let maxTimeoutValue: Double = 2147483647

    /// when reading from file pipe, must called from async queue
    internal static let pipeControlQueue = DispatchQueue(
        label: "wiki.qaq.AuxiliaryExecute.pipeRead",
        qos: .userInteractive,
        attributes: .concurrent
    )

    /// when killing process or monitoring events from process, must called from async queue
    /// we are making this queue serial queue so won't called at the same time when timeout
    internal static let processControlQueue = DispatchQueue(
        label: "wiki.qaq.AuxiliaryExecute.processControl",
        qos: .userInteractive,
        attributes: []
    )

    /// used for setting binary table, avoid crash
    internal let lock = NSLock()

    /// nope!
    private init() {
        // no need to setup binary table
        // we will make call to it when you call the shell api
        // if you only use the spawn api
        // we do not need to setup the hole table cause it is a time-heavy-task
    }

    /// Execution Error, do the localization your self
    public enum ExecuteError: Error, LocalizedError, Codable {
        // not found in path
        case commandNotFound
        // invalid, may be missing, wrong permission or any other reason
        case commandInvalid
        // fcntl failed
        case openFilePipeFailed
        // posix failed
        case posixSpawnFailed
        // waitpid failed
        case waitPidFailed
        // timeout when execute
        case timeout
    }

    public enum TerminationReason: Codable {
        case exit(Int32)
        case uncaughtSignal(Int32)
    }

    public struct PersonaOptions: Codable {
        let uid: uid_t
        let gid: gid_t
    }

    /// Execution Receipt
    public struct ExecuteReceipt: Codable {
        // exit code when process exit,
        // or signal code when process terminated by signal
        public let terminationReason: TerminationReason
        // process pid that was when it is alive
        // -1 means spawn failed in some situation
        public let pid: Int
        // wait result for final waitpid inside block at
        // processSource - eventMask.exit, usually is pid
        // -1 for other cases
        public let wait: Int
        // any error from us, not the command it self
        // DOES NOT MEAN THAT THE COMMAND DONE WELL
        public let error: ExecuteError?
        // stdout
        public let stdout: String
        // stderr
        public let stderr: String

        /// General initialization of receipt object
        /// - Parameters:
        ///   - terminationReason: termination reason
        ///   - pid: pid when process alive
        ///   - wait: wait result on waitpid
        ///   - error: error if any
        ///   - stdout: stdout
        ///   - stderr: stderr
        internal init(
            terminationReason: TerminationReason,
            pid: Int,
            wait: Int,
            error: AuxiliaryExecute.ExecuteError?,
            stdout: String,
            stderr: String
        ) {
            self.terminationReason = terminationReason
            self.pid = pid
            self.wait = wait
            self.error = error
            self.stdout = stdout
            self.stderr = stderr
        }

        /// Template for making failure receipt
        /// - Parameters:
        ///   - terminationReason: default uncaught signal 0
        ///   - pid: default -1
        ///   - wait: default -1
        ///   - error: error
        ///   - stdout: default empty
        ///   - stderr: default empty
        internal static func failure(
            terminationReason: TerminationReason = .uncaughtSignal(0),
            pid: Int = -1,
            wait: Int = -1,
            error: AuxiliaryExecute.ExecuteError?,
            stdout: String = "",
            stderr: String = ""
        ) -> ExecuteReceipt {
            .init(
                terminationReason: terminationReason,
                pid: pid,
                wait: wait,
                error: error,
                stdout: stdout,
                stderr: stderr
            )
        }
    }
}

```

### Core Architecture Module: `TrollFools/BartyCrouch.swift`
```
//  This file is required in order for the `transform` task of the translation helper tool BartyCrouch to work.
//  See here for more details: https://github.com/FlineDev/BartyCrouch

import Foundation

enum BartyCrouch {
    enum SupportedLanguage: String {
        case english = "en"
        case chineseSimplified = "zh-Hans"
        case vietnamese = "vi"
        case italian = "it"
    }

    static func translate(key: String, translations: [SupportedLanguage: String], comment _: String? = nil) -> String {
        let typeName = String(describing: BartyCrouch.self)
        let methodName = #function

        print(
            "Warning: [BartyCrouch]",
            "Untransformed \(typeName).\(methodName) method call found with key '\(key)' and base translations '\(translations)'.",
            "Please ensure that BartyCrouch is installed and configured correctly."
        )

        // fall back in case something goes wrong with BartyCrouch transformation
        return "BC: TRANSFORMATION FAILED!"
    }
}

```

### Core Architecture Module: `TrollFools/CLI/CmdEject.swift`
```
//
//  CmdEject.swift
//  TrollFools
//
//  Created by Rachel on 10/3/2025.
//

import ArgumentParser
import Foundation

struct CmdEject: ParsableCommand {
    static var configuration = CommandConfiguration(
        commandName: "eject",
        abstract: "Eject plugins from the specified application."
    )

    @Argument(help: "The bundle identifier of the application.")
    var bundleIdentifier: String

    @Option(name: [.customLong("path"), .customShort("p")], help: "The path of the plugin.")
    var pluginPath: String?

    @Flag(name: [.customLong("all")], help: "Eject all plugins.")
    var ejectAll: Bool = false

    func validate() throws {
        if ejectAll && pluginPath != nil {
            throw ArgumentParser.ValidationError(
                "The --all flag and --path option cannot be used at the same time."
            )
        }
        if !ejectAll && pluginPath == nil {
            throw ArgumentParser.ValidationError(
                "Either --all flag or --path option must be specified."
            )
        }
    }

    func run() throws {
        guard let app = LSApplicationProxy(forIdentifier: bundleIdentifier),
              let bundleURL = app.bundleURL()
        else {
            throw ArgumentParser.ValidationError("The specified application does not exist.")
        }
        if let pluginPath {
            if let pluginURL = URL(string: pluginPath),
               FileManager.default.fileExists(atPath: pluginPath) {
                try InjectorV3(bundleURL, loggerType: .os).eject([pluginURL], shouldDesist: true)
            } else {
                throw ArgumentParser.ValidationError("The specified plugin path is invalid.")
            }
        } else if ejectAll {
            try InjectorV3(bundleURL, loggerType: .os).ejectAll(shouldDesist: true)
        } else {
            throw ArgumentParser.ValidationError("No plugin to eject.")
        }
    }
}

```

### Core Architecture Module: `TrollFools/CLI/CmdInject.swift`
```
//
//  CmdInject.swift
//  TrollFools
//
//  Created by Rachel on 10/3/2025.
//

import ArgumentParser
import Foundation

struct CmdInject: ParsableCommand {
    static var configuration = CommandConfiguration(
        commandName: "inject",
        abstract: "Inject a persistent payload to a target application"
    )

    @Argument(help: "The bundle identifier of the application.")
    var bundleIdentifier: String

    @Option(name: [.customLong("path"), .customShort("p")], parsing: .upToNextOption, help: "The path of the plugin.")
    var pluginPaths: [String]

    @Flag(name: [.customLong("fast")], help: "Use fast injection strategy.")
    var fastInjection: Bool = false

    @Flag(name: [.customLong("weak")], help: "Use weak reference.")
    var weakReference: Bool = false

    func run() throws {
        guard let app = LSApplicationProxy(forIdentifier: bundleIdentifier),
              let appID = app.applicationIdentifier(),
              let bundleURL = app.bundleURL()
        else {
            throw ArgumentParser.ValidationError("The specified application does not exist.")
        }
        try pluginPaths.forEach {
            guard FileManager.default.fileExists(atPath: $0) else {
                throw ArgumentParser.ValidationError("This plugin does not exist: \($0)")
            }
        }
        let pluginURLs = pluginPaths.compactMap { URL(fileURLWithPath: $0) }
        let injector = try InjectorV3(bundleURL, loggerType: .os)
        if injector.appID.isEmpty {
            injector.appID = appID
        }
        if injector.teamID.isEmpty {
            if let teamID = app.teamID() {
                injector.teamID = teamID
            } else {
                injector.teamID = "0000000000"
            }
        }
        injector.useWeakReference = weakReference
        injector.injectStrategy = fastInjection ? .fast : .lexicographic
        try injector.inject(pluginURLs, shouldPersist: false)
    }
}

```

### Core Architecture Module: `TrollFools/CLI/CmdList.swift`
```
//
//  CmdList.swift
//  TrollFools
//
//  Created by Rachel on 10/3/2025.
//

import ArgumentParser
import Foundation

struct CmdList: ParsableCommand {
    static var configuration = CommandConfiguration(
        commandName: "list",
        abstract: "List all the applications."
    )

    @Flag(name: [.customLong("user")], help: "Print user applications only.")
    var userOnly = false

    func run() throws {
        struct App {
            let identifier: String
            let localizedName: String
        }
        (LSApplicationWorkspace.default().allApplications() ?? [])
            .compactMap { app -> App? in
                guard let identifier = app.applicationIdentifier(),
                      let localizedName = app.localizedName()
                else {
                    return nil
                }
                if userOnly, let type = app.applicationType(), type.lowercased() != "user" {
                    return nil
                }
                return App(identifier: identifier, localizedName: localizedName)
            }
            .sorted { $0.identifier < $1.identifier }
            .forEach { app in
                print("\(app.identifier) = \(app.localizedName)")
            }
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #101** (2026-04-23): **Fix Swift runtime traps on inject/eject (zstd + MachOKit paths)**
  *Symptoms*: ## Summary  Fixes three independent Swift runtime traps (`brk #1`) that surfaced between `4.2-225` and `4.3-246` and do **not** propagate through `try?` (they are runtime aborts, not thrown errors), so they killed inject/eject end-to-end on affected apps.  | # | Path | Root cause commit | Fix commit | |---|---|---|---| | 1 | Inject — zstd streaming decompression | 9e2fcaa | zstd: raw buffer append, bypass COW | | 2 | Eject — MachOKit on non-Mach-O files  | 8a832b4 | `isMachO` = magic-byte check only | | 3 | Eject — MachOKit DyldCache load-command iteration | 5ea814a | dedicated `collectModifiedMachOs`, no load-command walk |  Verified end-to-end on iOS 16 (iPad14,5): inject + eject both succeed on top of 4.3-246 with these four commits applied.  ## Root cause and fix, per bug  ### 1) Inject — zstd streaming decompression (regression from 9e2fcaa)  `ZStd.decompress` in `InjectorV3+Preprocess.swift` started from an empty `Data()` (backed by `_NSZeroData`) and grew it via `append(contentsOf: ArraySlice<UInt8>)`. The first COW transition triggered a `brk #1` inside ObjC-bridged value copy during ARC retain of the backing storage.  Fix: switch to a raw `UnsafeMutableRawPointer` buffer + `Data.append(_:count:)`, bypassing the Sequence/COW path entirely. The loop is also tightened — break on `streamResult == 0`, fail fast when the decoder makes no progress (avoids potentially spinning on truncated input).  ### 2) Eject — MachOKit on non-Mach-O files (regression from 8a832b4)  The Un
  **Post-Mortem & Fix Analysis**:
  > 我注意到修复说明中指出的三种 Crash 都是 `brk #1`，你确实收集到了这三种崩溃日志吗？这么巧合？还是你只是单纯地问 AI 有没有这样的问题，然后 AI 凭感觉就开始修？  举个例子，所谓第二个问题说 MachOKit 走 `loadFromFile(url:)` 读取非 Mach-O 文件会发生 Crash，建议补充 File Magic Validation，但我没看到这个地方有哪儿会发生崩溃，而且 MachOKit 本身也自带 Magic 判断。  ``` import Foundation  public enum File {     case machO(MachOFile)     case fat(FatFile) }  public func loadFromFile(url: URL) throws -> File {     let fileHandle = try FileHandle(forReadingFrom: url)     let magicRaw: UInt32 = fileHandle.read(offset: 0)      guard let magic = Magic(rawValue: magicRaw) else {         throw NSError() // FIXME: error     }      if magic.isFat {         return .fat(try FatFile(url: url))     } else {         return .machO(try MachOFile(url: url))     } } ```  其余问题我先不细看，在你没有给出这三份崩溃的 real world proof （崩溃日志和复现方法）之前，此 PR 不予合入。 
  > > 我注意到修复说明中指出的三种 Crash 都是 `brk #1`，你确实收集到了这三种崩溃日志吗？这么巧合？还是你只是单纯地问 AI 有没有这样的问题，然后 AI 凭感觉就开始修？  从4.1-219之后的版本在我的iPad 2022设备上注入/移除注入均直接让TrollFools直接闪退，然后我反复验证并确认了219之后的两个版本在我的设备上都会闪退，已经持续了很久了，恰好今天想起来了问了一下AI，目前在我的设备上已经恢复正常使用  目前并不确认是不是设备的单独问题以及在别的设备是否有这个问题 [TrollFools-2026-04-23-173949.txt](https://github.com/user-attachments/files/27005298/TrollFools-2026-04-23-173949.txt)
  > 第一条与注入有关，说 zstd 逻辑有问题，但是 zstd 是前两天刚加的，还停留在开发分支，并没有带到任何正式版里面去。你又说 4.1-219 之后的版本在你设备上会闪退，说明你这个闪退和第一条指出的所谓「缺陷」没有任何关系。  第二、第三条与推出有关，但指出的都是在 4.3-426 才引入的修改，不应该和你 4.1-219 上的闪退有关系。  总之这三条和你所说的崩溃可以说是毫无关联。这条 PR 幻觉比较重先关了，崩溃日志具体原因有空再看。

- **Issue #100** (2026-04-23): **Hotfix: three brk #1 traps on inject/eject (4.2-225 → 4.3-246)**
  *Symptoms*: ## Summary  Fixes three independent Swift runtime traps (`brk #1`) that surfaced between `4.2-225` and `4.3-246` and do **not** propagate through `try?` (they are runtime aborts, not thrown errors), so they killed inject/eject end-to-end on affected apps.  | # | Path | Root cause commit | Fix commit | |---|---|---|---| | 1 | Inject — zstd streaming decompression | 9e2fcaa | zstd: raw buffer append, bypass COW | | 2 | Eject — MachOKit on non-Mach-O files  | 8a832b4 | `isMachO` = magic-byte check only | | 3 | Eject — MachOKit DyldCache load-command iteration | 5ea814a | dedicated `collectModifiedMachOs`, no load-command walk |  Verified end-to-end on iOS 16 (iPad14,5): inject + eject both succeed on top of 4.3-246 with this hotfix.  ## Root cause and fix, per bug  ### 1) Inject — zstd streaming decompression (regression from 9e2fcaa)  `ZStd.decompress` in `InjectorV3+Preprocess.swift` started from an empty `Data()` (backed by `_NSZeroData`) and grew it via `append(contentsOf: ArraySlice<UInt8>)`. The first COW transition triggered a `brk #1` inside ObjC-bridged value copy during ARC retain of the backing storage.  Fix: switch to a raw `UnsafeMutableRawPointer` buffer + `Data.append(_:count:)`, bypassing the Sequence/COW path entirely. The loop is also tightened — break on `streamResult == 0`, fail fast when the decoder makes no progress (avoids potentially spinning on truncated input).  ### 2) Eject — MachOKit on non-Mach-O files (regression from 8a832b4)  The Unity fallback sc

- **Issue #99** (2026-04-18): **Fix AppListView SIGABRT and AppListModel memory leak**
  *Symptoms*: 

- **Issue #98** (2026-04-13): **Update Localizable.strings**
  *Symptoms*: Update Vietnamese

- **Issue #97** (2026-04-13): **Filter fallback Mach-O candidates to exclude runtime dylibs**
  *Symptoms*: The dlopen fallback path added in #96 uses all Mach-Os found under `Frameworks/` as candidates, bypassing the filtering that `resolveLoadCommand` normally applies (which ignores `@rpath/libswift*`). This can cause the injector to select a Swift runtime dylib as the injection target.  - Filter `allMachOsInFrameworks` in the fallback branch to exclude `libswift*` and `ignoredDylibAndFrameworkNames` entries before sorting/selection  ```swift let filteredMachOs = allMachOsInFrameworks.filter { url in     let nameLower = url.lastPathComponent.lowercased()     if nameLower.hasPrefix("libswift") {         return false     }     if Self.ignoredDylibAndFrameworkNames.contains(nameLower) {         return false     }     return true } ```

- **Issue #96** (2026-04-13): **fix: support injection into Unity apps with dynamically loaded frameworks**
  *Symptoms*: Unity-based apps (e.g. Arena of Valor) do not statically link their frameworks via LC_LOAD_DYLIB. Instead, they load frameworks at runtime using dlopen(). This caused frameworkMachOsInBundle() to return an empty intersection, leaving only the main executable (which is typically encrypted) as a candidate.  Changes: - Add fallback in frameworkMachOsInBundle(): when the intersection of linked dylibs and enumerated Frameworks/ is empty, use all valid Mach-O files found in Frameworks/ as candidates. - Also scan bare .dylib files at level 1 in Frameworks/. - Add detailed logging in locateAvailableMachO() to report each candidate's encryption status and file size for easier debugging.

- **Issue #95** (2026-04-13): **Separate enabled and disabled plug-ins for ejection**
  *Symptoms*: Refactor eject logic to separate enabled and disabled plug-ins for ejection.

- **Issue #94** (2026-04-13): **refactor: enhance framework Mach-O retrieval methods**
  *Symptoms*: Refactor Mach-O scanning logic to correctly handle apps  that are allowed in the whitelist but fail injection  because the main executable does not directly link them.
  **Post-Mortem & Fix Analysis**:
  > Duplicate of #96   ------  提 PR 不要 bump 版本号，老弟。
  > 删库了

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

### Incident Patch 1: `1a4d4a30` (2026-04-23)
**Commit Message**: fix: dependencies

Signed-off-by: Lessica <[REDACTED_EMAIL]>

**File**: `TrollFools.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +10/-10)
```diff
@@ -24,8 +24,8 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/CocoaLumberjack/CocoaLumberjack.git",
       "state" : {
-        "revision" : "c5f2ed4d219866117e135cf648180dc7b66739d3",
-        "version" : "3.9.1"
+        "revision" : "4b8714a7fb84d42393314ce897127b3939885ec3",
+        "version" : "3.8.5"
       }
     },
     {
@@ -60,26 +60,26 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/apple/swift-argument-parser.git",
       "state" : {
-        "revision" : "626b5b7b2f45e1b0b1c6f4a309296d1d21d7311b",
-        "version" : "1.7.1"
+        "revision" : "41982a3656a71c768319979febd796c6fd111d5c",
+        "version" : "1.5.0"
       }
     },
     {
       "identity" : "swift-collections",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/apple/swift-collections.git",
       "state" : {
-        "revision" : "6675bc0ff86e61436e615df6fc5174e043e57924",
-        "version" : "1.4.1"
+        "revision" : "671108c96644956dddcd89dd59c203dcdb36cec7",
+        "version" : "1.1.4"
       }
     },
     {
       "identity" : "swift-log",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/apple/swift-log",
       "state" : {
-        "revision" : "5073617dac96330a486245e4c0179cb0a6fd2256",
-        "version" : "1.12.0"
+        "revision" : "96a2f8a0fa41e9e09af4585e2724c4e825410b91",
+        "version" : "1.6.2"
       }
     },
     {
@@ -96,8 +96,8 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/weichsel/ZIPFoundation.git",
       "state" : {
-        "revision" : "22787ffb59de99e5dc1fbfe80b19c97a904ad48d",
-        "version" : "0.9.20"
+        "revision" : "02b6abe5f6eef7e3cbd5f247c5cc24e246efcfe0",
+        "version" : "0.9.19"
       }
     },
     {
```

---

### Incident Patch 2: `a9ec6178` (2026-04-23)
**Commit Message**: fix: suppress warns

Signed-off-by: Lessica <[REDACTED_EMAIL]>

**File**: `TrollFools.xcodeproj/project.pbxproj` (modified, +20/-20)
```diff
@@ -65,12 +65,12 @@
 		61EFA37B2D31165700159442 /* InjectorV3+Backup.swift in Sources */ = {isa = PBXBuildFile; fileRef = 61EFA37A2D31165000159442 /* InjectorV3+Backup.swift */; };
 		61EFA37D2D311DA800159442 /* InjectorV3+Inject.swift in Sources */ = {isa = PBXBuildFile; fileRef = 61EFA37C2D311DA300159442 /* InjectorV3+Inject.swift */; };
 		61F595622D6B42340034DD83 /* SwiftUIIntrospect-Static in Frameworks */ = {isa = PBXBuildFile; productRef = 61F595612D6B42340034DD83 /* SwiftUIIntrospect-Static */; };
+		A1B2C3D72F12345000112233 /* libzstd in Frameworks */ = {isa = PBXBuildFile; productRef = A1B2C3D52F12345000112233 /* libzstd */; };
+		A1B2C3D82F12345000112233 /* libzstd in Frameworks */ = {isa = PBXBuildFile; productRef = A1B2C3D62F12345000112233 /* libzstd */; };
 		CC0D662D2D7F11A2000EADED /* ArArchiveKit in Frameworks */ = {isa = PBXBuildFile; productRef = CC0D662C2D7F11A2000EADED /* ArArchiveKit */; };
 		CC0D662F2D7F11AC000EADED /* ArArchiveKit in Frameworks */ = {isa = PBXBuildFile; productRef = CC0D662E2D7F11AC000EADED /* ArArchiveKit */; };
 		CC0D66322D7F13A9000EADED /* SWCompression in Frameworks */ = {isa = PBXBuildFile; productRef = CC0D66312D7F13A9000EADED /* SWCompression */; };
 		CC0D66342D7F13B1000EADED /* SWCompression in Frameworks */ = {isa = PBXBuildFile; productRef = CC0D66332D7F13B1000EADED /* SWCompression */; };
-		A1B2C3D72F12345000112233 /* libzstd in Frameworks */ = {isa = PBXBuildFile; productRef = A1B2C3D52F12345000112233 /* libzstd */; };
-		A1B2C3D82F12345000112233 /* libzstd in Frameworks */ = {isa = PBXBuildFile; productRef = A1B2C3D62F12345000112233 /* libzstd */; };
 		CC0E80FB2C54F84000B137B4 /* mv-15 in Resources */ = {isa = PBXBuildFile; fileRef = CC0E80FA2C54F84000B137B4 /* mv-15 */; };
 		CC1548C92C4A6B2100A4173E /* ZIPFoundation in Frameworks */ = {isa = PBXBuildFile; productRef = CC1548C82C4A6B2100A4173E /* ZIPFoundation */; };
 		CC1548D12C4A6B8200A4173E /* ct_bypass in Resources */ = {isa = PBXBuildFile; fileRef = CC1548CF2C4A6B8200A4173E /* ct_bypass */; };
@@ -1078,6 +1078,14 @@
 				version = 1.2.0;
 			};
 		};
+		A1B2C3D42F12345000112233 /* XCRemoteSwiftPackageReference "zstd" */ = {
+			isa = XCRemoteSwiftPackageReference;
+			repositoryURL = "https://github.com/facebook/zstd.git";
+			requirement = {
+				kind = upToNextMajorVersion;
+				minimumVersion = 1.5.7;
+			};
+		};
 		CC0D662B2D7F11A2000EADED /* XCRemoteSwiftPackageReference "ArArchiveKit" */ = {
 			isa = XCRemoteSwiftPackageReference;
 			repositoryURL = "https://github.com/LebJe/ArArchiveKit.git";
@@ -1094,14 +1102,6 @@
 				minimumVersion = 4.8.6;
 			};
 		};
-		A1B2C3D42F12345000112233 /* XCRemoteSwiftPackageReference "zstd" */ = {
-			isa = XCRemoteSwiftPackageReference;
-			repositoryURL = "https://github.com/facebook/zstd.git";
-			requirement = {
-				kind = upToNextMajorVersion;
-				minimumVersion = 1.5.7;
-			};
-		};
 		CC1548C72C4A6B2100A4173E /* XCRemoteSwiftPackageReference "ZIPFoundation" */ = {
 			isa = XCRemoteSwiftPackageReference;
 			repositoryURL = "https://github.com/weichsel/ZIPFoundation.git";
@@ -1194,6 +1194,16 @@
 			package = 61F595602D6B42340034DD83 /* XCRemoteSwiftPackageReference "swiftui-introspect" */;
 			productName = "SwiftUIIntrospect-Static";
 		};
+		A1B2C3D52F12345000112233 /* libzstd */ = {
+			isa = XCSwiftPackageProductDependency;
+			package = A1B2C3D42F12345000112233 /* XCRemoteSwiftPackageReference "zstd" */;
+			productName = libzstd;
+		};
+		A1B2C3D62F12345000112233 /* libzstd */ = {
+			isa = XCSwiftPackageProductDependency;
+			package = A1B2C3D42F12345000112233 /* XCRemoteSwiftPackageReference "zstd" */;
+			productName = libzstd;
+		};
 		CC0D662C2D7F11A2000EADED /* ArArchiveKit */ = {
 			isa = XCSwiftPackageProductDependency;
 			package = CC0D662B2D7F11A2000EADED /* XCRemoteSwiftPackageReference "ArArchiveKit" */;
@@ -1214,16 +1224,6 @@
 			package = CC0D66302D7F13A9000EADED /* XCRemoteSwiftPackageReference "SWCompression" */;
 			productName = SWCompression;
 		};
-		A1B2C3D52F12345000112233 /* libzstd */ = {
-			isa = XCSwiftPackageProductDependency;
-			package = A1B2C3D42F12345000112233 /* XCRemoteSwiftPackageReference "zstd" */;
-			productName = libzstd;
-		};
-		A1B2C3D62F12345000112233 /* libzstd */ = {
-			isa = XCSwiftPackageProductDependency;
-			package = A1B2C3D42F12345000112233 /* XCRemoteSwiftPackageReference "zstd" */;
-			productName = libzstd;
-		};
 		CC1548C82C4A6B2100A4173E /* ZIPFoundation */ = {
 			isa = XCSwiftPackageProductDependency;
 			package = CC1548C72C4A6B2100A4173E /* XCRemoteSwiftPackageReference "ZIPFoundation" */;
```

**File**: `TrollFools.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +11/-11)
```diff
@@ -24,8 +24,8 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/CocoaLumberjack/CocoaLumberjack.git",
       "state" : {
-        "revision" : "4b8714a7fb84d42393314ce897127b3939885ec3",
-        "version" : "3.8.5"
+        "revision" : "c5f2ed4d219866117e135cf648180dc7b66739d3",
+        "version" : "3.9.1"
       }
     },
     {
@@ -43,7 +43,7 @@
       "location" : "https://github.com/Lessica/MachOKit.git",
       "state" : {
         "branch" : "patch/trollfools",
-        "revision" : "43c4b5d59ab75c91ad689fb4a39a8a3913229535"
+        "revision" : "889084f803dd4c922ea4c5985c77b796c38d79c2"
       }
     },
     {
@@ -60,26 +60,26 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/apple/swift-argument-parser.git",
       "state" : {
-        "revision" : "41982a3656a71c768319979febd796c6fd111d5c",
-        "version" : "1.5.0"
+        "revision" : "626b5b7b2f45e1b0b1c6f4a309296d1d21d7311b",
+        "version" : "1.7.1"
       }
     },
     {
       "identity" : "swift-collections",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/apple/swift-collections.git",
       "state" : {
-        "revision" : "671108c96644956dddcd89dd59c203dcdb36cec7",
-        "version" : "1.1.4"
+        "revision" : "6675bc0ff86e61436e615df6fc5174e043e57924",
+        "version" : "1.4.1"
       }
     },
     {
       "identity" : "swift-log",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/apple/swift-log",
       "state" : {
-        "revision" : "96a2f8a0fa41e9e09af4585e2724c4e825410b91",
-        "version" : "1.6.2"
+        "revision" : "5073617dac96330a486245e4c0179cb0a6fd2256",
+        "version" : "1.12.0"
       }
     },
     {
@@ -96,8 +96,8 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/weichsel/ZIPFoundation.git",
       "state" : {
-        "revision" : "02b6abe5f6eef7e3cbd5f247c5cc24e246efcfe0",
-        "version" : "0.9.19"
+        "revision" : "22787ffb59de99e5dc1fbfe80b19c97a904ad48d",
+        "version" : "0.9.20"
       }
     },
     {
```

**File**: `TrollFools/InjectorV3+Bundle.swift` (modified, +1/-2)
```diff
@@ -107,8 +107,7 @@ extension InjectorV3 {
                 }
                 let excludedCount = allMachOsInFrameworks.count - filteredMachOs.count
                 DDLogWarn(
-                    "No statically linked Mach-Os found, falling back to \(filteredMachOs.count) filtered Mach-Os in Frameworks/ " +
-                        "(excluded \(excludedCount): \(excludedSwiftRuntimeCount) Swift runtime, \(excludedIgnoredNameCount) ignored by name)",
+                    "No statically linked Mach-Os found, falling back to \(filteredMachOs.count) filtered Mach-Os in Frameworks/ (excluded \(excludedCount): \(excludedSwiftRuntimeCount) Swift runtime, \(excludedIgnoredNameCount) ignored by name)",
                     ddlog: logger
                 )
                 machOs = OrderedSet(filteredMachOs)
```

**File**: `TrollFools/InjectorV3+Preprocess.swift` (modified, +1/-43)
```diff
@@ -10,7 +10,6 @@ import CocoaLumberjackSwift
 import Foundation
 import SWCompression
 import ZIPFoundation
-import libzstd
 
 extension InjectorV3 {
     // MARK: - Constants
@@ -230,50 +229,9 @@ fileprivate enum ZStd {
     }
 
     static func decompress(data: Data) throws -> Data {
-        guard !data.isEmpty else {
+        guard let output = TFZStdDecompressData(data) else {
             throw SWCompression.DataError.corrupted
         }
-
-        guard let stream = ZSTD_createDStream() else {
-            throw SWCompression.DataError.corrupted
-        }
-        defer {
-            _ = ZSTD_freeDStream(stream)
-        }
-
-        let initResult = ZSTD_initDStream(stream)
-        guard ZSTD_isError(initResult) == 0 else {
-            throw SWCompression.DataError.corrupted
-        }
-
-        let chunkSize = max(Int(ZSTD_DStreamOutSize()), 1)
-        var chunk = [UInt8](repeating: 0, count: chunkSize)
-        var output = Data()
-
-        try data.withUnsafeBytes { sourceBuffer in
-            var input = ZSTD_inBuffer(src: sourceBuffer.baseAddress, size: sourceBuffer.count, pos: 0)
-            var streamResult: size_t = 1
-
-            while input.pos < input.size || streamResult != 0 {
-                let produced = try chunk.withUnsafeMutableBytes { destinationBuffer in
-                    var outBuffer = ZSTD_outBuffer(
-                        dst: destinationBuffer.baseAddress,
-                        size: destinationBuffer.count,
-                        pos: 0
-                    )
-                    streamResult = ZSTD_decompressStream(stream, &outBuffer, &input)
-                    guard ZSTD_isError(streamResult) == 0 else {
-                        throw SWCompression.DataError.corrupted
-                    }
-                    return outBuffer.pos
-                }
-
-                if produced > 0 {
-                    output.append(contentsOf: chunk[..<Int(produced)])
-                }
-            }
-        }
-
         return output
     }
 }
```

**File**: `TrollFools/TrollFools-Bridging-Header.h` (modified, +1/-0)
```diff
@@ -10,6 +10,7 @@
 
 FOUNDATION_EXTERN NSString *TFGetDisplayVersion(void);
 FOUNDATION_EXTERN void TFUtilKillAll(NSString *processPath, BOOL softly);
+FOUNDATION_EXTERN NSData * _Nullable TFZStdDecompressData(NSData * _Nonnull data);
 
 @interface UIImage (Private)
 + (instancetype)_applicationIconImageForBundleIdentifier:(NSString *)bundleIdentifier 
```

**File**: `TrollFools/TrollFoolsStub.m` (modified, +61/-0)
```diff
@@ -6,6 +6,7 @@
 //
 
 #import <Foundation/Foundation.h>
+#import <zstd.h>
 
 #import <spawn.h>
 #import <stdio.h>
@@ -89,6 +90,66 @@ void TFUtilKillAll(NSString *processName, BOOL softly) {
     });
 }
 
+NSData * _Nullable TFZStdDecompressData(NSData * _Nonnull data) {
+    if (data.length == 0) {
+        return nil;
+    }
+
+    ZSTD_DStream *stream = ZSTD_createDStream();
+    if (!stream) {
+        return nil;
+    }
+
+    size_t initResult = ZSTD_initDStream(stream);
+    if (ZSTD_isError(initResult)) {
+        ZSTD_freeDStream(stream);
+        return nil;
+    }
+
+    size_t chunkSize = ZSTD_DStreamOutSize();
+    if (chunkSize == 0) {
+        chunkSize = 1;
+    }
+
+    void *chunk = malloc(chunkSize);
+    if (!chunk) {
+        ZSTD_freeDStream(stream);
+        return nil;
+    }
+
+    NSMutableData *output = [NSMutableData data];
+    ZSTD_inBuffer input = { .src = data.bytes, .size = data.length, .pos = 0 };
+    size_t streamResult = 1;
+    BOOL succeeded = YES;
+
+    while (input.pos < input.size || streamResult != 0) {
+        size_t previousPos = input.pos;
+        ZSTD_outBuffer outBuffer = { .dst = chunk, .size = chunkSize, .pos = 0 };
+        streamResult = ZSTD_decompressStream(stream, &outBuffer, &input);
+        if (ZSTD_isError(streamResult)) {
+            succeeded = NO;
+            break;
+        }
+
+        if (outBuffer.pos > 0) {
+            [output appendBytes:chunk length:outBuffer.pos];
+        } else if (input.pos == previousPos && input.pos >= input.size && streamResult != 0) {
+            // No progress and frame not complete usually means truncated input.
+            succeeded = NO;
+            break;
+        }
+    }
+
+    free(chunk);
+    ZSTD_freeDStream(stream);
+
+    if (!succeeded) {
+        return nil;
+    }
+
+    return output;
+}
+
 static NSString *TFGetMarketingVersion(void) {
     return @MARKETING_VERSION;
 }
```

---

### Incident Patch 3: `309aad98` (2026-04-18)
**Commit Message**: fix: memory leak

Signed-off-by: Lessica <[REDACTED_EMAIL]>

**File**: `TrollFools.xcodeproj/project.pbxproj` (modified, +1/-1)
```diff
@@ -612,7 +612,7 @@
 			);
 			runOnlyForDeploymentPostprocessing = 0;
 			shellPath = /bin/sh;
-			shellScript = "if [ \"$CODE_SIGNING_ALLOWED\" = \"NO\" ]; then\n  ldid -S${CODE_SIGN_ENTITLEMENTS} ${CODESIGNING_FOLDER_PATH}\nfi\n";
+			shellScript = "PATH=\"/opt/homebrew/bin:/usr/local/bin:$PATH\"\nif [ \"$CODE_SIGNING_ALLOWED\" = \"NO\" ] && [ \"$TARGET_DEVICE_PLATFORM_NAME\" != \"iphonesimulator\" ]; then\n  ldid -S${CODE_SIGN_ENTITLEMENTS} ${CODESIGNING_FOLDER_PATH}\nfi\n";
 		};
 /* End PBXShellScriptBuildPhase section */
 
```

**File**: `TrollFools/AppListModel.swift` (modified, +12/-9)
```diff
@@ -5,6 +5,7 @@
 //  Created by 82Flex on 2024/10/30.
 //
 
+import notify
 import Combine
 import OrderedCollections
 import SwiftUI
@@ -69,6 +70,7 @@ final class AppListModel: ObservableObject {
 
     private let applicationChanged = PassthroughSubject<Void, Never>()
     private var cancellables = Set<AnyCancellable>()
+    private var darwinNotifyToken: Int32 = NOTIFY_TOKEN_INVALID
 
     init(selectorURL: URL? = nil) {
         self.selectorURL = selectorURL
@@ -91,18 +93,19 @@ final class AppListModel: ObservableObject {
             }
             .store(in: &cancellables)
 
-        let darwinCenter = CFNotificationCenterGetDarwinNotifyCenter()
-        CFNotificationCenterAddObserver(darwinCenter, Unmanaged.passRetained(self).toOpaque(), { _, observer, _, _, _ in
-            guard let observer = Unmanaged<AppListModel>.fromOpaque(observer!).takeUnretainedValue() as AppListModel? else {
-                return
-            }
-            observer.applicationChanged.send()
-        }, "com.apple.LaunchServices.ApplicationsChanged" as CFString, nil, .coalesce)
+        // Uses notify_register_dispatch instead of CFNotificationCenterAddObserver to avoid
+        // Unmanaged pointer management. Unlike CFNotificationCenterAddObserver with .coalesce,
+        // notify_register_dispatch may deliver queued notifications individually upon app resume,
+        // but the .throttle(for: 0.5, ...) on applicationChanged already coalesces rapid bursts.
+        notify_register_dispatch("com.apple.LaunchServices.ApplicationsChanged", &darwinNotifyToken, .main) { [weak self] _ in
+            self?.applicationChanged.send()
+        }
     }
 
     deinit {
-        let darwinCenter = CFNotificationCenterGetDarwinNotifyCenter()
-        CFNotificationCenterRemoveObserver(darwinCenter, Unmanaged.passUnretained(self).toOpaque(), nil, nil)
+        if darwinNotifyToken != NOTIFY_TOKEN_INVALID {
+            notify_cancel(darwinNotifyToken)
+        }
     }
 
     func reload() {
```

---

### Incident Patch 4: `5ea814a8` (2026-04-16)
**Commit Message**: fix: bad recursive target selection

Signed-off-by: 82Flex <[REDACTED_EMAIL]>

**File**: `TrollFools/InjectorV3+Backup.swift` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ import Foundation
 extension InjectorV3 {
     // MARK: - Constants
 
-    private static let alternateSuffix = "troll-fools.bak"
+    static let alternateSuffix = "troll-fools.bak"
 
     static func alternateURL(for target: URL) -> URL {
         target.appendingPathExtension(Self.alternateSuffix)
```

**File**: `TrollFools/InjectorV3+Bundle.swift` (modified, +28/-0)
```diff
@@ -63,6 +63,10 @@ extension InjectorV3 {
                     enumerator.skipDescendants()
                     continue
                 }
+                // Skip backup files created before injection
+                if itemURL.path.hasSuffix(".\(Self.alternateSuffix)") {
+                    continue
+                }
                 if enumerator.level == 2 {
                     enumeratedURLs.append(itemURL)
                     if isMachO(itemURL) {
@@ -113,6 +117,30 @@ extension InjectorV3 {
             }
         }
 
+        // Filter out previously-injected Mach-Os by diffing current vs. backup load commands.
+        // Any load command present in the current binary but absent from its backup was added by injection.
+        var injectedAssetNames = Set<String>()
+        for machO in (allMachOsInFrameworks.elements + [executableURL]) where hasAlternate(machO) {
+            if let current = try? loadedDylibsOfMachO(machO),
+               let original = try? loadedDylibsOfMachO(Self.alternateURL(for: machO))
+            {
+                for name in current where !original.contains(name) {
+                    injectedAssetNames.insert(URL(fileURLWithPath: name).lastPathComponent)
+                }
+            }
+        }
+        if !injectedAssetNames.isEmpty {
+            let preFilterCount = machOs.count
+            machOs = machOs.filter { !injectedAssetNames.contains($0.lastPathComponent) }
+            let excludedCount = preFilterCount - machOs.count
+            if excludedCount > 0 {
+                DDLogInfo(
+                    "Excluded \(excludedCount) previously-injected Mach-Os by backup diff: \(injectedAssetNames.sorted())",
+                    ddlog: logger
+                )
+            }
+        }
+
         var sortedMachOs: [URL] =
             switch injectStrategy {
         case .lexicographic:
```

**File**: `TrollFools/InjectorV3+MachO.swift` (modified, +4/-1)
```diff
@@ -66,7 +66,10 @@ extension InjectorV3 {
         var newCollected = collected
         newCollected.append(target)
 
-        let loadedDylibs = try loadedDylibsOfMachO(target).compactMap({ resolveLoadCommand($0) })
+        // If the Mach-O has a backup (made before injection), read load commands
+        // from the original to avoid picking up previously-injected dylibs.
+        let readTarget = hasAlternate(target) ? Self.alternateURL(for: target) : target
+        let loadedDylibs = try loadedDylibsOfMachO(readTarget).compactMap({ resolveLoadCommand($0) })
         for dylib in loadedDylibs {
             newCollected = try linkedDylibsRecursivelyOfMachO(dylib, collected: newCollected)
         }
```

---

### Incident Patch 5: `cf392756` (2026-04-13)
**Commit Message**: Potential fix for pull request finding

Co-authored-by: Copilot Autofix powered by AI <[REDACTED_EMAIL]>

**File**: `TrollFools/InjectorV3+Bundle.swift` (modified, +10/-1)
```diff
@@ -85,17 +85,26 @@ extension InjectorV3 {
         // Fallback: if none of the Mach-Os in Frameworks/ are statically linked
         // by the main binary (e.g. Unity apps use dlopen), use all available Mach-Os.
         if machOs.isEmpty && !allMachOsInFrameworks.isEmpty {
+            var excludedSwiftRuntimeCount = 0
+            var excludedIgnoredNameCount = 0
             let filteredMachOs = allMachOsInFrameworks.filter { url in
                 let nameLower = url.lastPathComponent.lowercased()
                 if nameLower.hasPrefix("libswift") {
+                    excludedSwiftRuntimeCount += 1
                     return false
                 }
                 if Self.ignoredDylibAndFrameworkNames.contains(nameLower) {
+                    excludedIgnoredNameCount += 1
                     return false
                 }
                 return true
             }
-            DDLogWarn("No statically linked Mach-Os found, falling back to \(filteredMachOs.count) filtered Mach-Os in Frameworks/ (excluded \(allMachOsInFrameworks.count - filteredMachOs.count) ignored)", ddlog: logger)
+            let excludedCount = allMachOsInFrameworks.count - filteredMachOs.count
+            DDLogWarn(
+                "No statically linked Mach-Os found, falling back to \(filteredMachOs.count) filtered Mach-Os in Frameworks/ " +
+                    "(excluded \(excludedCount): \(excludedSwiftRuntimeCount) Swift runtime, \(excludedIgnoredNameCount) ignored by name)",
+                ddlog: logger
+            )
             machOs = OrderedSet(filteredMachOs)
         }
 
```

---

### Incident Patch 6: `56a34101` (2026-04-13)
**Commit Message**: Use consistent case-insensitive check for libswift prefix

Agent-Logs-Url: https://github.com/Lessica/TrollFools/sessions/2dc5b17d-721d-4e7b-ab5c-255978ad2db3

Co-authored-by: Lessica <[REDACTED_EMAIL]>

**File**: `TrollFools/InjectorV3+Bundle.swift` (modified, +2/-3)
```diff
@@ -86,9 +86,8 @@ extension InjectorV3 {
         // by the main binary (e.g. Unity apps use dlopen), use all available Mach-Os.
         if machOs.isEmpty && !allMachOsInFrameworks.isEmpty {
             let filteredMachOs = allMachOsInFrameworks.filter { url in
-                let name = url.lastPathComponent
-                let nameLower = name.lowercased()
-                if name.hasPrefix("libswift") {
+                let nameLower = url.lastPathComponent.lowercased()
+                if nameLower.hasPrefix("libswift") {
                     return false
                 }
                 if Self.ignoredDylibAndFrameworkNames.contains(nameLower) {
```

---

### Incident Patch 7: `3b781bb9` (2026-04-13)
**Commit Message**: Merge pull request #96 from HuuDungg/fix/unity-framework-injection

fix: support injection into Unity apps with dynamically loaded frameworks

**File**: `TrollFools/InjectorV3+Bundle.swift` (modified, +27/-1)
```diff
@@ -43,9 +43,16 @@ extension InjectorV3 {
         precondition(isMachO(executableURL), "Not a Mach-O: \(executableURL.path)")
 
         let frameworksURL = target.appendingPathComponent("Frameworks")
+        let frameworksExist = FileManager.default.fileExists(atPath: frameworksURL.path)
+
+        DDLogInfo("Scanning Mach-Os in \(target.lastPathComponent), Frameworks exists: \(frameworksExist)", ddlog: logger)
+
         let linkedDylibs = try linkedDylibsRecursivelyOfMachO(executableURL)
+        DDLogInfo("Linked dylibs (\(linkedDylibs.count)): \(linkedDylibs.map { $0.lastPathComponent })", ddlog: logger)
 
         var enumeratedURLs = OrderedSet<URL>()
+        var allMachOsInFrameworks = OrderedSet<URL>()
+
         if let enumerator = FileManager.default.enumerator(
             at: frameworksURL,
             includingPropertiesForKeys: [.fileSizeKey],
@@ -58,11 +65,30 @@ extension InjectorV3 {
                 }
                 if enumerator.level == 2 {
                     enumeratedURLs.append(itemURL)
+                    if isMachO(itemURL) {
+                        allMachOsInFrameworks.append(itemURL)
+                    }
+                }
+                // Scan bare dylibs at level 1 (directly in Frameworks/)
+                if enumerator.level == 1 && itemURL.pathExtension.lowercased() == "dylib" && isMachO(itemURL) {
+                    allMachOsInFrameworks.append(itemURL)
+                    enumeratedURLs.append(itemURL)
                 }
             }
         }
 
-        let machOs = linkedDylibs.intersection(enumeratedURLs)
+        DDLogInfo("Enumerated \(enumeratedURLs.count) items, \(allMachOsInFrameworks.count) Mach-Os in Frameworks/", ddlog: logger)
+
+        var machOs = linkedDylibs.intersection(enumeratedURLs)
+        DDLogInfo("Intersection: \(machOs.count) linked Mach-Os in Frameworks/", ddlog: logger)
+
+        // Fallback: if none of the Mach-Os in Frameworks/ are statically linked
+        // by the main binary (e.g. Unity apps use dlopen), use all available Mach-Os.
+        if machOs.isEmpty && !allMachOsInFrameworks.isEmpty {
+            DDLogWarn("No statically linked Mach-Os found, falling back to all \(allMachOsInFrameworks.count) Mach-Os in Frameworks/", ddlog: logger)
+            machOs = allMachOsInFrameworks
+        }
+
         var sortedMachOs: [URL] =
             switch injectStrategy {
         case .lexicographic:
```

**File**: `TrollFools/InjectorV3+Inject.swift` (modified, +38/-2)
```diff
@@ -205,8 +205,44 @@ extension InjectorV3 {
     // MARK: - Path Finder
 
     fileprivate func locateAvailableMachO() throws -> URL? {
-        try frameworkMachOsInBundle(bundleURL)
-            .first { try !isProtectedMachO($0) }
+        let allMachOs = try frameworkMachOsInBundle(bundleURL)
+
+        DDLogInfo("Mach-O scan: \(allMachOs.count) candidates in \(bundleURL.lastPathComponent)", ddlog: logger)
+
+        var selectedMachO: URL?
+        var encryptedCount = 0
+        var unreadableCount = 0
+        for (index, machO) in allMachOs.enumerated() {
+            let fileSize = (try? machO.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
+            let sizeStr = ByteCountFormatter.string(fromByteCount: Int64(fileSize), countStyle: .file)
+
+            do {
+                let isProtected = try isProtectedMachO(machO)
+                if isProtected {
+                    encryptedCount += 1
+                    DDLogInfo("  [\(index + 1)/\(allMachOs.count)] ENCRYPTED \(machO.lastPathComponent) (\(sizeStr))", ddlog: logger)
+                } else {
+                    DDLogInfo("  [\(index + 1)/\(allMachOs.count)] AVAILABLE \(machO.lastPathComponent) (\(sizeStr))", ddlog: logger)
+                    if selectedMachO == nil {
+                        selectedMachO = machO
+                    }
+                }
+            } catch {
+                unreadableCount += 1
+                DDLogError("  [\(index + 1)/\(allMachOs.count)] UNREADABLE \(machO.lastPathComponent) (\(sizeStr)): \(error)", ddlog: logger)
+            }
+        }
+
+        if let selected = selectedMachO {
+            DDLogInfo("Selected Mach-O: \(selected.lastPathComponent)", ddlog: logger)
+        } else {
+            DDLogError(
+                "No available Mach-O found: \(encryptedCount) encrypted, \(unreadableCount) unreadable, \(allMachOs.count - encryptedCount - unreadableCount) unavailable",
+                ddlog: logger
+            )
+        }
+
+        return selectedMachO
     }
 
     fileprivate static func findResource(_ name: String, fileExtension: String) -> URL {
```

---

### Incident Patch 8: `8a832b41` (2026-04-13)
**Commit Message**: fix: support injection into Unity apps with dynamically loaded frameworks

Unity-based apps (e.g. Arena of Valor) do not statically link their
frameworks via LC_LOAD_DYLIB. Instead, they load frameworks at runtime
using dlopen(). This caused frameworkMachOsInBundle() to return an
empty intersection, leaving only the main executable (which is
typically encrypted) as a candidate.

Changes:
- Add fallback in frameworkMachOsInBundle(): when the intersection of
  linked dylibs and enumerated Frameworks/ is empty, use all valid
  Mach-O files found in Frameworks/ as candidates.
- Also scan bare .dylib files at level 1 in Frameworks/.
- Add detailed logging in locateAvailableMachO() to report each
  candidate's encryption status and file size for easier debugging.

**File**: `TrollFools/InjectorV3+Bundle.swift` (modified, +27/-1)
```diff
@@ -43,9 +43,16 @@ extension InjectorV3 {
         precondition(isMachO(executableURL), "Not a Mach-O: \(executableURL.path)")
 
         let frameworksURL = target.appendingPathComponent("Frameworks")
+        let frameworksExist = FileManager.default.fileExists(atPath: frameworksURL.path)
+
+        DDLogInfo("Scanning Mach-Os in \(target.lastPathComponent), Frameworks exists: \(frameworksExist)", ddlog: logger)
+
         let linkedDylibs = try linkedDylibsRecursivelyOfMachO(executableURL)
+        DDLogInfo("Linked dylibs (\(linkedDylibs.count)): \(linkedDylibs.map { $0.lastPathComponent })", ddlog: logger)
 
         var enumeratedURLs = OrderedSet<URL>()
+        var allMachOsInFrameworks = OrderedSet<URL>()
+
         if let enumerator = FileManager.default.enumerator(
             at: frameworksURL,
             includingPropertiesForKeys: [.fileSizeKey],
@@ -58,11 +65,30 @@ extension InjectorV3 {
                 }
                 if enumerator.level == 2 {
                     enumeratedURLs.append(itemURL)
+                    if isMachO(itemURL) {
+                        allMachOsInFrameworks.append(itemURL)
+                    }
+                }
+                // Scan bare dylibs at level 1 (directly in Frameworks/)
+                if enumerator.level == 1 && itemURL.pathExtension.lowercased() == "dylib" && isMachO(itemURL) {
+                    allMachOsInFrameworks.append(itemURL)
+                    enumeratedURLs.append(itemURL)
                 }
             }
         }
 
-        let machOs = linkedDylibs.intersection(enumeratedURLs)
+        DDLogInfo("Enumerated \(enumeratedURLs.count) items, \(allMachOsInFrameworks.count) Mach-Os in Frameworks/", ddlog: logger)
+
+        var machOs = linkedDylibs.intersection(enumeratedURLs)
+        DDLogInfo("Intersection: \(machOs.count) linked Mach-Os in Frameworks/", ddlog: logger)
+
+        // Fallback: if none of the Mach-Os in Frameworks/ are statically linked
+        // by the main binary (e.g. Unity apps use dlopen), use all available Mach-Os.
+        if machOs.isEmpty && !allMachOsInFrameworks.isEmpty {
+            DDLogWarn("No statically linked Mach-Os found, falling back to all \(allMachOsInFrameworks.count) Mach-Os in Frameworks/", ddlog: logger)
+            machOs = allMachOsInFrameworks
+        }
+
         var sortedMachOs: [URL] =
             switch injectStrategy {
         case .lexicographic:
```

**File**: `TrollFools/InjectorV3+Inject.swift` (modified, +27/-2)
```diff
@@ -205,8 +205,33 @@ extension InjectorV3 {
     // MARK: - Path Finder
 
     fileprivate func locateAvailableMachO() throws -> URL? {
-        try frameworkMachOsInBundle(bundleURL)
-            .first { try !isProtectedMachO($0) }
+        let allMachOs = try frameworkMachOsInBundle(bundleURL)
+
+        DDLogInfo("Mach-O scan: \(allMachOs.count) candidates in \(bundleURL.lastPathComponent)", ddlog: logger)
+
+        var selectedMachO: URL?
+        for (index, machO) in allMachOs.enumerated() {
+            let isProtected = (try? isProtectedMachO(machO)) ?? true
+            let fileSize = (try? machO.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
+            let sizeStr = ByteCountFormatter.string(fromByteCount: Int64(fileSize), countStyle: .file)
+
+            if isProtected {
+                DDLogInfo("  [\(index + 1)/\(allMachOs.count)] ENCRYPTED \(machO.lastPathComponent) (\(sizeStr))", ddlog: logger)
+            } else {
+                DDLogInfo("  [\(index + 1)/\(allMachOs.count)] AVAILABLE \(machO.lastPathComponent) (\(sizeStr))", ddlog: logger)
+                if selectedMachO == nil {
+                    selectedMachO = machO
+                }
+            }
+        }
+
+        if let selected = selectedMachO {
+            DDLogInfo("Selected Mach-O: \(selected.lastPathComponent)", ddlog: logger)
+        } else {
+            DDLogError("No available Mach-O found, all \(allMachOs.count) candidates are encrypted", ddlog: logger)
+        }
+
+        return selectedMachO
     }
 
     fileprivate static func findResource(_ name: String, fileExtension: String) -> URL {
```

---

### Incident Patch 9: `2dc1a03d` (2025-09-11)
**Commit Message**: fix: ios 14 deb import

Signed-off-by: 82Flex <[REDACTED_EMAIL]>

**File**: `TrollFools/AppListModel.swift` (modified, +9/-2)
```diff
@@ -63,7 +63,7 @@ final class AppListModel: ObservableObject {
             false
         }
     }()
-    private let filzaURL = URL(string: "filza://")
+    private let filzaURL = URL(string: "filza://view")
 
     @Published var isRebuildNeeded: Bool = false
 
@@ -206,7 +206,14 @@ extension AppListModel {
         guard let filzaURL else {
             return
         }
-        let fileURL = filzaURL.appendingPathComponent(url.path)
+
+        let fileURL: URL
+        if #available(iOS 16, *) {
+            fileURL = filzaURL.appending(path: url.path)
+        } else {
+            fileURL = URL(string: filzaURL.absoluteString + (url.path.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? ""))!
+        }
+
         UIApplication.shared.open(fileURL)
     }
 
```

**File**: `TrollFools/AppListView.swift` (modified, +9/-5)
```diff
@@ -110,13 +110,17 @@ struct AppListView: View {
                 else {
                     return
                 }
+
                 let urlIdent = URLIdentifiable(url: preprocessURL(url))
-                if !isWarningHidden && ext == "deb" {
-                    temporaryOpenedURL = urlIdent
-                    isWarningPresented = true
-                } else {
-                    selectorOpenedURL = urlIdent
+                if #available(iOS 15, *) {
+                    if !isWarningHidden && ext == "deb" {
+                        temporaryOpenedURL = urlIdent
+                        isWarningPresented = true
+                        return
+                    }
                 }
+
+                selectorOpenedURL = urlIdent
             }
             .onAppear {
                 if Double.random(in: 0 ..< 1) < 0.1 {
```

**File**: `TrollFools/OptionView.swift` (modified, +7/-6)
```diff
@@ -144,13 +144,14 @@ struct OptionView: View {
             result in
             switch result {
             case let .success(theSuccess):
-                if !isWarningHidden && theSuccess.contains(where: { $0.pathExtension.lowercased() == "deb" }) {
-                    temporaryResult = result
-                    isWarningPresented = true
-                } else {
-                    importerResult = result
-                    isImporterSelected = true
+                if #available(iOS 15, *) {
+                    if !isWarningHidden && theSuccess.contains(where: { $0.pathExtension.lowercased() == "deb" }) {
+                        temporaryResult = result
+                        isWarningPresented = true
+                        return
+                    }
                 }
+                fallthrough
             case .failure:
                 importerResult = result
                 isImporterSelected = true
```

---

### Incident Patch 10: `d62a8db9` (2025-09-11)
**Commit Message**: fix: higher spawn priority

Signed-off-by: 82Flex <[REDACTED_EMAIL]>

**File**: `TrollFools/AuxiliaryExecute.swift` (modified, +2/-0)
```diff
@@ -35,13 +35,15 @@ public class AuxiliaryExecute {
     /// when reading from file pipe, must called from async queue
     internal static let pipeControlQueue = DispatchQueue(
         label: "wiki.qaq.AuxiliaryExecute.pipeRead",
+        qos: .userInteractive,
         attributes: .concurrent
     )
 
     /// when killing process or monitoring events from process, must called from async queue
     /// we are making this queue serial queue so won't called at the same time when timeout
     internal static let processControlQueue = DispatchQueue(
         label: "wiki.qaq.AuxiliaryExecute.processControl",
+        qos: .userInteractive,
         attributes: []
     )
 
```

---

### Incident Patch 11: `56fd94cf` (2025-09-10)
**Commit Message**: fix: unif CN name

Signed-off-by: 82Flex <[REDACTED_EMAIL]>

**File**: `TrollFools/zh-Hans.lproj/Localizable.strings` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@
 "Bringing back the most advanced system and security analysis tool." = "最强大的系统和安全分析工具，再次归来。";
 
 /* No comment provided by engineer. */
-"Buy our paid products to support us if you like TrollFools!" = "如果你喜欢 TrollFools，请购买我们的付费产品以支持我们！";
+"Buy our paid products to support us if you like TrollFools!" = "如果你喜欢巨魔注入器，请购买我们的付费产品以支持我们！";
 
 /* StripedTextTableViewController */
 "Cancel" = "取消";
```

---

### Incident Patch 12: `f3c13b61` (2025-09-10)
**Commit Message**: fix: spawn wait

Signed-off-by: 82Flex <[REDACTED_EMAIL]>

**File**: `TrollFools/AuxiliaryExecute+Spawn.swift` (modified, +6/-3)
```diff
@@ -346,8 +346,9 @@ public extension AuxiliaryExecute {
         let wallTimeout = DispatchTime.now() + (
             TimeInterval(exactly: realTimeout) ?? maxTimeoutValue
         )
+
         var status: Int32 = 0
-        var wait: pid_t = 0
+        var waitResult: Int32 = 0
         var isTimeout = false
 
         let timerSource = DispatchSource.makeTimerSource(flags: [], queue: processControlQueue)
@@ -358,7 +359,9 @@ public extension AuxiliaryExecute {
 
         let processSource = DispatchSource.makeProcessSource(identifier: pid, eventMask: .exit, queue: processControlQueue)
         processSource.setEventHandler {
-            wait = waitpid(pid, &status, 0)
+            repeat {
+                waitResult = waitpid(pid, &status, 0)
+            } while waitResult == -1 && errno == EINTR
 
             processSource.cancel()
             timerSource.cancel()
@@ -388,7 +391,7 @@ public extension AuxiliaryExecute {
             let receipt = ExecuteReceipt(
                 terminationReason: terminationReason,
                 pid: Int(exactly: pid) ?? -1,
-                wait: Int(exactly: wait) ?? -1,
+                wait: Int(exactly: waitResult) ?? -1,
                 error: isTimeout ? .timeout : nil,
                 stdout: stdoutStr,
                 stderr: stderrStr
```

---

### Incident Patch 13: `a0ff4275` (2025-09-10)
**Commit Message**: fix: landscape layouts

Signed-off-by: 82Flex <[REDACTED_EMAIL]>

**File**: `TrollFools/AppListView.swift` (modified, +2/-1)
```diff
@@ -17,6 +17,7 @@ struct AppListView: View {
 
     @StateObject var searchViewModel = AppListSearchModel()
     @EnvironmentObject var appList: AppListModel
+    @Environment(\.verticalSizeClass) var verticalSizeClass
 
     @State var selectorOpenedURL: URLIdentifiable? = nil
     @State var selectedIndex: String? = nil
@@ -139,7 +140,7 @@ struct AppListView: View {
                 ZStack {
                     refreshableListView
 
-                    if appList.activeScopeApps.keys.count > 1 {
+                    if verticalSizeClass == .regular && appList.activeScopeApps.keys.count > 1 {
                         IndexableScroller(
                             indexes: appList.activeScopeApps.keys.elements,
                             currentIndex: $selectedIndex
```

**File**: `TrollFools/OptionView.swift` (modified, +29/-7)
```diff
@@ -10,6 +10,8 @@ import SwiftUI
 struct OptionView: View {
     let app: App
 
+    @Environment(\.verticalSizeClass) var verticalSizeClass
+
     @State var isImporterPresented = false
     @State var isImporterSelected = false
 
@@ -29,7 +31,7 @@ struct OptionView: View {
 
     var body: some View {
         if #available(iOS 15, *) {
-            content
+            wrappedContent
                 .alert(
                     NSLocalizedString("Notice", comment: ""),
                     isPresented: $isWarningPresented,
@@ -60,10 +62,14 @@ struct OptionView: View {
                     }
                 }
         } else {
-            content
+            wrappedContent
         }
     }
 
+    var wrappedContent: some View {
+        content.toolbar { toolbarContent }
+    }
+
     var content: some View {
         VStack(spacing: 80) {
             HStack {
@@ -88,11 +94,13 @@ struct OptionView: View {
                 Spacer()
             }
 
-            Button {
-                isSettingsPresented = true
-            } label: {
-                Label(NSLocalizedString("Advanced Settings", comment: ""),
-                      systemImage: "gear")
+            if verticalSizeClass == .regular {
+                Button {
+                    isSettingsPresented = true
+                } label: {
+                    Label(NSLocalizedString("Advanced Settings", comment: ""),
+                          systemImage: "gear")
+                }
             }
         }
         .padding()
@@ -150,6 +158,20 @@ struct OptionView: View {
         }
     }
 
+    @ToolbarContentBuilder
+    var toolbarContent: some ToolbarContent {
+        ToolbarItemGroup(placement: .topBarTrailing) {
+            if verticalSizeClass == .compact {
+                Button {
+                    isSettingsPresented = true
+                } label: {
+                    Label(NSLocalizedString("Advanced Settings", comment: ""),
+                          systemImage: "gear")
+                }
+            }
+        }
+    }
+
     static func warningMessage(_ urls: [URL]) -> String {
         guard let firstDylibName = urls.first(where: { $0.pathExtension.lowercased() == "deb" })?.lastPathComponent else {
             fatalError("No debian package found.")
```

**File**: `TrollFools/PlugInCell.swift` (modified, +38/-12)
```diff
@@ -17,6 +17,8 @@ private let gDateFormatter: DateFormatter = {
 
 struct PlugInCell: View {
     @EnvironmentObject var ejectList: EjectListModel
+    @Environment(\.verticalSizeClass) var verticalSizeClass
+
     @Binding var quickLookExport: URL?
     @State var isEnabled: Bool = true
 
@@ -38,22 +40,46 @@ struct PlugInCell: View {
         return attributedString
     }
 
+    var iconName: String {
+        let pathExt = plugIn.url.pathExtension.lowercased()
+        if pathExt == "bundle" {
+            return "archivebox"
+        }
+        if pathExt == "dylib" {
+            return "bandage"
+        }
+        if pathExt == "framework" {
+            return "shippingbox"
+        }
+        return "puzzlepiece"
+    }
+
     var body: some View {
         Toggle(isOn: $isEnabled) {
-            VStack(alignment: .leading) {
-                if #available(iOS 15, *) {
-                    Text(highlightedName)
-                        .font(.headline)
-                        .lineLimit(2)
-                } else {
-                    Text(plugIn.url.lastPathComponent)
-                        .font(.headline)
-                        .lineLimit(2)
+            HStack(spacing: 12) {
+                if verticalSizeClass == .compact {
+                    Image(systemName: iconName)
+                        .resizable()
+                        .aspectRatio(contentMode: .fit)
+                        .frame(width: 24, height: 24)
+                        .foregroundColor(.accentColor)
                 }
 
-                Text(gDateFormatter.string(from: plugIn.createdAt))
-                    .font(.subheadline)
-                    .lineLimit(1)
+                VStack(alignment: .leading) {
+                    if #available(iOS 15, *) {
+                        Text(highlightedName)
+                            .font(.headline)
+                            .lineLimit(2)
+                    } else {
+                        Text(plugIn.url.lastPathComponent)
+                            .font(.headline)
+                            .lineLimit(2)
+                    }
+
+                    Text(gDateFormatter.string(from: plugIn.createdAt))
+                        .font(.subheadline)
+                        .lineLimit(1)
+                }
             }
         }
         .contextMenu {
```

---

### Incident Patch 14: `e4dd95f5` (2025-09-09)
**Commit Message**: fix: dont query filza every time

Signed-off-by: 82Flex <[REDACTED_EMAIL]>

**File**: `TrollFools/AppListModel.swift` (modified, +7/-6)
```diff
@@ -55,7 +55,13 @@ final class AppListModel: ObservableObject {
 
     @Published var unsupportedCount: Int = 0
 
-    @Published var isFilzaInstalled: Bool = false
+    lazy var isFilzaInstalled: Bool = {
+        if let filzaURL {
+            UIApplication.shared.canOpenURL(filzaURL)
+        } else {
+            false
+        }
+    }()
     private let filzaURL = URL(string: "filza://")
 
     @Published var isRebuildNeeded: Bool = false
@@ -102,11 +108,6 @@ final class AppListModel: ObservableObject {
         let allApplications = Self.fetchApplications(&unsupportedCount)
         allApplications.forEach { $0.appList = self }
         _allApplications = allApplications
-        if let filzaURL {
-            isFilzaInstalled = UIApplication.shared.canOpenURL(filzaURL)
-        } else {
-            isFilzaInstalled = false
-        }
         performFilter()
     }
 
```

---

### Incident Patch 15: `4d9bc1a6` (2025-09-09)
**Commit Message**: fix: indexable scroller

Signed-off-by: 82Flex <[REDACTED_EMAIL]>

**File**: `TrollFools/AppListView.swift` (modified, +3/-2)
```diff
@@ -138,6 +138,7 @@ struct AppListView: View {
             ScrollViewReader { reader in
                 ZStack {
                     refreshableListView
+
                     if appList.activeScopeApps.keys.count > 1 {
                         IndexableScroller(
                             indexes: appList.activeScopeApps.keys.elements,
@@ -147,7 +148,7 @@ struct AppListView: View {
                 }
                 .onChange(of: selectedIndex) { index in
                     if let index {
-                        reader.scrollTo("AppSection-\(index)", anchor: .top)
+                        reader.scrollTo("AppSection-\(index)", anchor: .center)
                     }
                 }
             }
@@ -350,7 +351,7 @@ struct AppListView: View {
                             }
                         }
                     } header: {
-                        paddedHeaderFooterText(sectionKey)
+                        paddedHeaderFooterText(sectionKey == selectedIndex ? "→ \(sectionKey)" : sectionKey)
                     } footer: {
                         if sectionKey == appList.activeScopeApps.keys.last {
                             footer
```

**File**: `TrollFools/IndexableScroller.swift` (modified, +3/-0)
```diff
@@ -31,6 +31,9 @@ struct IndexableScroller: View {
                     .updating($dragLocation) { value, state, _ in
                         state = value.location
                     }
+                    .onEnded { value in
+                        currentIndex = nil
+                    }
             )
 
             Spacer()
```

#### Recent Merged Pull Requests:
- **PR #101** (closed): Fix Swift runtime traps on inject/eject (zstd + MachOKit paths) (@moxcomic)
- **PR #100** (closed): Hotfix: three brk #1 traps on inject/eject (4.2-225 → 4.3-246) (@moxcomic)
- **PR #99** (closed): Fix AppListView SIGABRT and AppListModel memory leak (@mszhangopopop)
- **PR #98** (2026-04-13): Update Localizable.strings (@romlayvn-0411)
- **PR #97** (2026-04-13): Filter fallback Mach-O candidates to exclude runtime dylibs (@Copilot)
- **PR #96** (2026-04-13): fix: support injection into Unity apps with dynamically loaded frameworks (@HuuDungg)
- **PR #95** (2026-04-13): Separate enabled and disabled plug-ins for ejection (@mszhangopopop)
- **PR #94** (closed): refactor: enhance framework Mach-O retrieval methods (@huami1314)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
