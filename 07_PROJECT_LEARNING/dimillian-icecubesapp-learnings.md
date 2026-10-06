# Forensic Learning Record (Deep Inspection): Dimillian/IceCubesApp

> **Canonical Artifact**: `07_PROJECT_LEARNING/dimillian-icecubesapp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Dimillian/IceCubesApp](https://github.com/Dimillian/IceCubesApp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:26:59.825Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Dimillian/IceCubesApp`
- **Description**: A SwiftUI Mastodon client
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 7076 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `IceCubesAppWidgetsExtension/Shared/SharedUtils.swift`
```
import AppAccount
import Foundation
import Models
import NetworkClient
import StatusKit
import Timeline
import UIKit
import WidgetKit

func loadStatuses(
  for timeline: TimelineFilter,
  account: AppAccountEntity,
  widgetFamily: WidgetFamily
) async -> [Status] {
  let client = MastodonClient(server: account.account.server, oauthToken: account.account.oauthToken)
  do {
    var statuses: [Status] = try await client.get(
      endpoint: timeline.endpoint(
        sinceId: nil,
        maxId: nil,
        minId: nil,
        offset: nil,
        limit: 6))
    statuses = statuses.filter { $0.reblog == nil && !$0.content.asRawText.isEmpty }
    switch widgetFamily {
    case .systemSmall, .systemMedium:
      if statuses.count >= 1 {
        statuses = statuses.prefix(upTo: 1).map { $0 }
      }
    case .systemLarge, .systemExtraLarge:
      if statuses.count >= 5 {
        statuses = statuses.prefix(upTo: 5).map { $0 }
      }
    default:
      break
    }
    return statuses
  } catch {
    return []
  }
}

func loadImages(urls: [URL]) async throws -> [URL: UIImage] {
  try await withThrowingTaskGroup(of: (URL, UIImage?).self) { group in
    for url in urls {
      group.addTask {
        let response = try await URLSession.shared.data(from: url)
        return (url, UIImage(data: response.0))
      }
    }

    var images: [URL: UIImage] = [:]

    for try await (url, image) in group {
      images[url] = image
    }

    return images
  }
}

```

### Core Architecture Module: `Packages/Account/Sources/Account/Detail/AccountDetailState.swift`
```
import Foundation
import Models

enum AccountDetailState {
  case loading
  case display(
    account: Account,
    featuredTags: [FeaturedTag],
    relationships: [Relationship],
    fields: [Account.Field])
  case error(error: Error)
}

```

### Core Architecture Module: `Packages/Conversations/Sources/Conversations/Detail/ConversationDetailState.swift`
```
import Foundation
import Models

public enum ConversationDetailState {
  case loading
  case display(messages: [Status], conversation: Conversation)
  case error(error: Error)
}
```

### Core Architecture Module: `Packages/Conversations/Sources/Conversations/List/ConversationsListState.swift`
```
import Foundation
import Models
import NetworkClient

public enum ConversationsListState {
  case loading
  case display(conversations: [Conversation], hasNextPage: Bool)
  case error(error: Error)
}
```

### Core Architecture Module: `Packages/Notifications/Sources/Notifications/List/NotificationsListState.swift`
```
import Foundation
import Models

public enum NotificationsListState {
  public enum PagingState {
    case none, hasNextPage
  }
  
  case loading
  case display(notifications: [ConsolidatedNotification], nextPageState: PagingState)
  case error(error: Error)
}
```

### Core Architecture Module: `Packages/StatusKit/Sources/StatusKit/Editor/EditorFocusState.swift`
```
import SwiftUI

extension StatusEditor {
  enum EditorFocusState: Hashable {
    case main
    case followUp(index: UUID)
  }
}

```

### Core Architecture Module: `Packages/StatusKit/Sources/StatusKit/Editor/TextState.swift`
```
import Foundation

extension StatusEditor {
  struct TextState {
    var statusText: NSMutableAttributedString = .init(string: "")
    var mentionString: String?
    var urlLengthAdjustments: Int = 0
    var currentSuggestionRange: NSRange?
    var backupStatusText: NSAttributedString?
  }
}

```

### Core Architecture Module: `IceCubesActionExtension/Action.js`
```
//
//  Action.js
//  IceCubesActionExtension
//
//  Created by Thomas Durand on 26/01/2023.
//

var Action = function() {};

Action.prototype = {
    run: function(arguments) {
        arguments.completionFunction({ "url" : document.URL })
    },
    finalize: function(arguments) {
        var openingUrl = arguments["deeplink"]
        if (openingUrl) {
            document.location.href = openingUrl
        }
    }
};
    
var ExtensionPreprocessingJS = new Action

```

### Core Architecture Module: `IceCubesActionExtension/ActionRequestHandler.swift`
```
//
//  ActionRequestHandler.swift
//  IceCubesActionExtension
//
//  Created by Thomas Durand on 26/01/2023.
//

import MobileCoreServices
import Models
import NetworkClient
import UIKit
import UniformTypeIdentifiers

// Sample code was sending this from a thread to another, let asume @Sendable for this
extension NSExtensionContext: @unchecked @retroactive Sendable {}

final class ActionRequestHandler: NSObject, NSExtensionRequestHandling, Sendable {
  enum Error: Swift.Error {
    case inputProviderNotFound
    case loadedItemHasWrongType
    case urlNotFound
    case noHost
    case notMastodonInstance
  }

  func beginRequest(with context: NSExtensionContext) {
    // Do not call super in an Action extension with no user interface
    Task {
      do {
        let url = try await url(from: context)
        guard await url.isMastodonInstance else {
          throw Error.notMastodonInstance
        }
        await MainActor.run {
          let deeplink = url.iceCubesAppDeepLink
          let output = output(wrapping: deeplink)
          context.completeRequest(returningItems: output)
        }
      } catch {
        await MainActor.run {
          context.completeRequest(returningItems: [])
        }
      }
    }
  }
}

extension URL {
  var isMastodonInstance: Bool {
    get async {
      do {
        guard let host = host() else {
          throw ActionRequestHandler.Error.noHost
        }
        let _: Instance = try await MastodonClient(server: host, version: .v2).get(
          endpoint: Instances.instance)
        return true
      } catch {
        return false
      }
    }
  }

  var iceCubesAppDeepLink: URL {
    var components = URLComponents(url: self, resolvingAgainstBaseURL: false)!
    components.scheme = AppInfo.scheme.trimmingCharacters(in: [":", "/"])
    return components.url!
  }
}

extension ActionRequestHandler {
  /// Will look for an input item that might provide the property list that Javascript sent us
  private func url(from context: NSExtensionContext) async throws -> URL {
    for item in context.inputItems as! [NSExtensionItem] {
      guard let attachments = item.attachments else {
        continue
      }
      for itemProvider in attachments {
        guard itemProvider.hasItemConformingToTypeIdentifier(UTType.propertyList.identifier) else {
          continue
        }
        guard
          let dictionary = try await itemProvider.loadItem(
            forTypeIdentifier: UTType.propertyList.identifier) as? [String: Any]
        else {
          throw Error.loadedItemHasWrongType
        }
        let input =
          dictionary[NSExtensionJavaScriptPreprocessingResultsKey] as! [String: Any]? ?? [:]
        guard let absoluteStringUrl = input["url"] as? String,
          let url = URL(string: absoluteStringUrl)
        else {
          throw Error.urlNotFound
        }
        return url
      }
    }
    throw Error.inputProviderNotFound
  }

  /// Wrap the output to the expected object so we send back results to JS
  private func output(wrapping deeplink: URL) -> [NSExtensionItem] {
    let results = ["deeplink": deeplink.absoluteString]
    let dictionary = [NSExtensionJavaScriptFinalizeArgumentKey: results]
    let provider = NSItemProvider(
      item: dictionary as NSDictionary, typeIdentifier: UTType.propertyList.identifier)
    let item = NSExtensionItem()
    item.attachments = [provider]
    return [item]
  }
}

```

### Core Architecture Module: `IceCubesApp/App/Main/AppView.swift`
```
import AVFoundation
import Account
import AppAccount
import DesignSystem
import Env
import KeychainSwift
import MediaUI
import Models
import NetworkClient
import RevenueCat
import StatusKit
import SwiftData
import SwiftUI
import Timeline

@MainActor
struct AppView: View {
  @Environment(\.modelContext) private var context
  @Environment(\.openWindow) var openWindow
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass

  @Environment(AppAccountsManager.self) private var appAccountsManager
  @Environment(UserPreferences.self) private var userPreferences
  @Environment(Theme.self) private var theme
  @Environment(CurrentAccount.self) private var currentAccount

  @Binding var selectedTab: AppTab
  @Binding var appRouterPath: RouterPath

  @State var iosTabs = iOSTabs.shared
  @State var selectedTabScrollToTop: Int = -1
  @State var timeline: TimelineFilter = .home

  @AppStorage("timeline_pinned_filters") private var pinnedFilters: [TimelineFilter] = []

  @Query(sort: \LocalTimeline.creationDate, order: .reverse) var localTimelines: [LocalTimeline]
  @Query(sort: \TagGroup.creationDate, order: .reverse) var tagGroups: [TagGroup]

  var body: some View {
    HStack(spacing: 0) {
      Group {
        if #available(iOS 27.0, visionOS 27.0, *) {
          tabBarView
            .defaultTabBarPlacement(horizontalSizeClass == .regular ? .sidebar : .automatic)
        } else {
          tabBarView
        }
      }
      .tabViewStyle(.sidebarAdaptable)
      if horizontalSizeClass == .regular
        && (UIDevice.current.userInterfaceIdiom == .pad
          || UIDevice.current.userInterfaceIdiom == .mac),
        appAccountsManager.currentClient.isAuth,
        userPreferences.showiPadSecondaryColumn
      {
        Divider().edgesIgnoringSafeArea(.all)
        notificationsSecondaryColumn
      }
    }
  }

  var availableSections: [SidebarSections] {
    guard appAccountsManager.currentClient.isAuth else {
      return [SidebarSections.loggedOutTabs]
    }
    if horizontalSizeClass == .compact {
      return [SidebarSections.iosTabs]
    } else if UIDevice.current.userInterfaceIdiom == .vision {
      return [SidebarSections.visionOSTabs]
    }
    var sections = SidebarSections.macOrIpadOSSections
    if !localTimelines.isEmpty {
      sections.append(.localTimeline)
    }
    if !tagGroups.isEmpty {
      sections.append(.tagGroup)
    }
    sections.append(.app)
    return sections
  }

  @ViewBuilder
  var tabBarView: some View {
    TabView(
      selection: .init(
        get: {
          selectedTab
        },
        set: { newTab in
          updateTab(with: newTab)
        })
    ) {
      ForEach(availableSections) { section in
        TabSection(section.title) {
          if section == .localTimeline {
            ForEach(localTimelines) { timeline in
              let tab = AppTab.anyTimelineFilter(
                filter: .remoteLocal(server: timeline.instance, filter: .local))
              Tab(value: tab) {
                makeTabContent(for: tab)
              } label: {
                tab.label.environment(\.symbolVariants, tab == selectedTab ? .fill : .none)
              }
              .tabPlacement(tab.tabPlacement)
            }
          } else if section == .tagGroup {
            ForEach(tagGroups) { tagGroup in
              let tab = AppTab.anyTimelineFilter(
                filter: TimelineFilter.tagGroup(
                  title: tagGroup.title,
                  tags: tagGroup.tags,
                  symbolName: tagGroup.symbolName))
              Tab(value: tab) {
                makeTabContent(for: tab)
              } label: {
                tab.label.environment(\.symbolVariants, tab == selectedTab ? .fill : .none)
              }
              .tabPlacement(tab.tabPlacement)
            }
          } else {
            ForEach(section.tabs) { tab in
              Tab(value: tab, role: tab == .explore ? .search : .none) {
                makeTabContent(for: tab)
              } label: {
                tab.label.environment(\.symbolVariants, tab == selectedTab ? .fill : .none)
              }
              .tabPlacement(tab.tabPlacement)
              .badge(badgeFor(tab: tab))
            }
          }
        }
        .tabPlacement(.sidebarOnly)
      }
    }
    .id(appAccountsManager.currentClient.id)
    .withSheetDestinations(
      sheetDestinations: $appRouterPath.presentedSheet,
      routerPath: appRouterPath
    )
    .environment(\.selectedTabScrollToTop, selectedTabScrollToTop)
  }

  @ViewBuilder
  private func makeTabContent(for tab: AppTab) -> some View {
    tab.makeContentView(
      homeTimeline: $timeline,
      selectedTab: $selectedTab,
      pinnedFilters: $pinnedFilters
    )
    .overlay(alignment: .top) {
      ToastOverlayView()
    }
  }

  private func updateTab(with newTab: AppTab) {
    if newTab == .post {
      #if os(visionOS)
        openWindow(
          value: WindowDestinationEditor.newStatusEditor(visibility: userPreferences.postVisibility)
        )
      #else
        appRouterPath.presentedSheet = .newStatusEditor(visibility: userPreferences.postVisibility)
      #endif
      return
    }

    HapticManager.shared.fireHaptic(.tabSelection)
    SoundEffectManager.shared.playSound(.tabSelection)

    if selectedTab == newTab {
      selectedTabScrollToTop = newTab.id
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
        selectedTabScrollToTop = -1
      }
    } else {
      selectedTabScrollToTop = -1
    }

    selectedTab = newTab
  }

  private func badgeFor(tab: AppTab) -> Int {
    if tab == .notifications, selectedTab != tab,
      let token = appAccountsManager.currentAccount.oauthToken
    {
      return userPreferences.notificationsCount[token] ?? 0
    }
    return 0
  }

  var notificationsSecondaryColumn: some View {
    NotificationsTab(selectedTab: .constant(.notifications), lockedType: nil)
      .environment(\.isSecondaryColumn, true)
      .frame(maxWidth: .secondaryColumnWidth)
      .id(appAccountsManager.currentAccount.id)
  }
}

```

### Core Architecture Module: `IceCubesApp/App/Main/IceCubesApp+Menu.swift`
```
import Env
import SwiftUI

extension IceCubesApp {
  @CommandsBuilder
  var appMenu: some Commands {
    CommandGroup(replacing: .appSettings) {
      Button("menu.settings") {
        appRouterPath.presentedSheet = .settings
      }
      .keyboardShortcut(",", modifiers: .command)
    }
    CommandGroup(replacing: .newItem) {
      Button("menu.new-window") {
        openWindow(id: "MainWindow")
      }
      .keyboardShortcut("n", modifiers: .shift)
      Button("menu.new-post") {
        #if targetEnvironment(macCatalyst)
          openWindow(
            value: WindowDestinationEditor.newStatusEditor(
              visibility: userPreferences.postVisibility))
        #else
          appRouterPath.presentedSheet = .newStatusEditor(
            visibility: userPreferences.postVisibility)
        #endif
      }
      .keyboardShortcut("n", modifiers: .command)
    }
    CommandGroup(replacing: .textFormatting) {
      Menu("menu.font") {
        Button("menu.font.bigger") {
          if theme.fontSizeScale < 1.5 {
            theme.fontSizeScale += 0.1
          }
        }
        Button("menu.font.smaller") {
          if theme.fontSizeScale > 0.5 {
            theme.fontSizeScale -= 0.1
          }
        }
      }
    }
    CommandMenu("tab.timeline") {
      Button("timeline.latest") {
        NotificationCenter.default.post(name: .refreshTimeline, object: nil)
      }
      .keyboardShortcut("r", modifiers: .command)
      Button("timeline.home") {
        NotificationCenter.default.post(name: .homeTimeline, object: nil)
      }
      .keyboardShortcut("h", modifiers: .shift)
      Button("timeline.trending") {
        NotificationCenter.default.post(name: .trendingTimeline, object: nil)
      }
      .keyboardShortcut("t", modifiers: .shift)
      Button("timeline.federated") {
        NotificationCenter.default.post(name: .federatedTimeline, object: nil)
      }
      .keyboardShortcut("f", modifiers: .shift)
      Button("timeline.local") {
        NotificationCenter.default.post(name: .localTimeline, object: nil)
      }
      .keyboardShortcut("l", modifiers: .shift)
    }
    CommandGroup(replacing: .help) {
      Button("menu.help.github") {
        let url = URL(string: "https://github.com/Dimillian/IceCubesApp/issues")!
        UIApplication.shared.open(url)
      }
    }
  }
}

```

### Core Architecture Module: `IceCubesApp/App/Main/IceCubesApp+Scene.swift`
```
import AppIntents
import Env
import MediaUI
import StatusKit
import SwiftUI

extension IceCubesApp {
  var appScene: some Scene {
    WindowGroup(id: "MainWindow") {
      AppView(selectedTab: $selectedTab, appRouterPath: $appRouterPath)
        .applyTheme(theme)
        .onAppear {
          setupRevenueCat()
          refreshPushSubs()
        }
        .withAppDependencyGraph(
          appAccountsManager: appAccountsManager,
          currentAccount: currentAccount,
          currentInstance: currentInstance,
          userPreferences: userPreferences,
          theme: theme,
          watcher: watcher,
          pushNotificationsService: pushNotificationsService,
          appIntentService: appIntentService,
          quickLook: quickLook,
          toastCenter: toastCenter,
          namespace: namespace,
          isSupporter: isSupporter)
        .sheet(item: $quickLook.selectedMediaAttachment) { selectedMediaAttachment in
          if let namespace = quickLook.namespace {
            MediaUIView(
              selectedAttachment: selectedMediaAttachment,
              attachments: quickLook.mediaAttachments
            )
            .navigationTransition(.zoom(sourceID: selectedMediaAttachment.id, in: namespace))
            .presentationBackground(theme.primaryBackgroundColor)
            .presentationCornerRadius(16)
            .presentationSizing(.page)
            .withEnvironments()
          } else {
            EmptyView()
          }
        }
        .onChange(of: pushNotificationsService.handledNotification) { _, newValue in
          if newValue != nil {
            pushNotificationsService.handledNotification = nil
            if appAccountsManager.currentAccount.oauthToken?.accessToken
              != newValue?.account.token.accessToken,
              let account = appAccountsManager.availableAccounts.first(where: {
                $0.oauthToken?.accessToken == newValue?.account.token.accessToken
              })
            {
              appAccountsManager.currentAccount = account
              DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                selectedTab = .notifications
                pushNotificationsService.handledNotification = newValue
              }
            } else {
              selectedTab = .notifications
            }
          }
        }
        .onChange(of: appIntentService.handledIntent) { _, _ in
          if let intent = appIntentService.handledIntent?.intent {
            handleIntent(intent)
            appIntentService.handledIntent = nil
          }
        }
        .withModelContainer()
    }
    .commands {
      appMenu
    }
    .onChange(of: scenePhase) { _, newValue in
      handleScenePhase(scenePhase: newValue)
    }
    #if targetEnvironment(macCatalyst)
      .windowResize()
    #elseif os(visionOS)
      .defaultSize(width: 800, height: 1200)
    #endif
  }

  @SceneBuilder
  var otherScenes: some Scene {
    WindowGroup(for: WindowDestinationEditor.self) { destination in
      Group {
        switch destination.wrappedValue {
        case let .newStatusEditor(visibility):
          StatusEditor.MainView(mode: .new(text: nil, visibility: visibility))
        case let .prefilledStatusEditor(text, visibility):
          StatusEditor.MainView(mode: .new(text: text, visibility: visibility))
        case let .editStatusEditor(status):
          StatusEditor.MainView(mode: .edit(status: status))
        case let .quoteStatusEditor(status):
          StatusEditor.MainView(mode: .quote(status: status))
        case let .replyToStatusEditor(status):
          StatusEditor.MainView(mode: .replyTo(status: status))
        case let .mentionStatusEditor(account, visibility):
          StatusEditor.MainView(mode: .mention(account: account, visibility: visibility))
        case let .quoteLinkStatusEditor(link):
          StatusEditor.MainView(mode: .quoteLink(link: link))
        case .none:
          EmptyView()
        }
      }
      .withEnvironments()
      .environment(\.isCatalystWindow, true)
      .environment(RouterPath())
      .withModelContainer()
      .applyTheme(theme)
      .frame(minWidth: 300, minHeight: 400)
    }
    .defaultSize(width: 600, height: 800)
    .windowResizability(.contentMinSize)

    WindowGroup(for: WindowDestinationMedia.self) { destination in
      Group {
        switch destination.wrappedValue {
        case let .mediaViewer(attachments, selectedAttachment):
          MediaUIView(
            selectedAttachment: selectedAttachment,
            attachments: attachments)
        case .none:
          EmptyView()
        }
      }
      .withEnvironments()
      .withModelContainer()
      .applyTheme(theme)
      .environment(\.isCatalystWindow, true)
      .frame(minWidth: 300, minHeight: 400)
    }
    .defaultSize(width: 1200, height: 1000)
    .windowResizability(.contentMinSize)
  }

  private func handleIntent(_: any AppIntent) {
    if let postIntent = appIntentService.handledIntent?.intent as? PostIntent {
      #if os(visionOS) || os(macOS)
        openWindow(
          value: WindowDestinationEditor.prefilledStatusEditor(
            text: postIntent.content ?? "",
            visibility: userPreferences.postVisibility))
      #else
        appRouterPath.presentedSheet = .prefilledStatusEditor(
          text: postIntent.content ?? "",
          visibility: userPreferences.postVisibility)
      #endif
    } else if let tabIntent = appIntentService.handledIntent?.intent as? TabIntent {
      selectedTab = tabIntent.tab.toAppTab
    } else if let imageIntent = appIntentService.handledIntent?.intent as? PostImageIntent,
      let urls = imageIntent.images?.compactMap({ $0.fileURL })
    {
      appRouterPath.presentedSheet = .imageURL(
        urls: urls,
        caption: imageIntent.caption,
        altTexts: imageIntent.altText.map { [$0] },
        visibility: userPreferences.postVisibility)
    }
  }
}

extension Scene {
  func windowResize() -> some Scene {
    return self.windowResizability(.contentSize)
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2469** (2026-08-22): **Bug: Mac app doesn't display quoted post**
  *Symptoms*: ## Environment:  <!-- Please complete the following information, when reporting bugs related to the IceCubesApp. -->   - OS: macOS Tahoe 26.4.1  - IceCubesApp version: 2.1.3 (3244)  ## Description  A post that quotes another post doesn't display the quoted post on Mac, but does on iPhone.  This is what I see on Mac:  <img width="1480" height="1326" alt="Image" src="https://github.com/user-attachments/assets/29bec98f-7a26-41e8-b634-79b8d0aa7b21" />    This is what is I see on iPhone:  <img width="603" height="1311" alt="Image" src="https://github.com/user-attachments/assets/716e19f0-8152-4858-8a30-b484d2b4414e" />    There is a content setting called Show Quotes that is enabled:  <img width="1592" height="1548" alt="Image" src="https://github.com/user-attachments/assets/406cd996-fed4-41d8-8660-25f93d60d736" />   <!-- A clear and concise description of what the bug is. -->  ## Related Issues    - [X] I have searched the open issues and did not see an existing issue.   <!-- Are there any existing issues or pull requests related to this problem? If so, link them here. -->
  **Post-Mortem & Fix Analysis**:
  > Hi @Dimillian , I've tracked down the root cause of this on macOS Catalyst! It turns out the .fixedSize modifier on StatusEmbeddedView causes the container to collapse vertically on the desktop layout engine due to how the internal Spacer() interacts with the layout pass.  I have a clean fix ready using a #if !targetEnvironment(macCatalyst) conditional compilation guard so that iOS behavior remains entirely unchanged while fixing the macOS rendering. Opening a Pull Request right now with the full details!

- **Issue #2468** (2026-05-23): **Bug: Unable to sign in with two accounts on the same instance.**
  *Symptoms*: ## Environment:   - OS:   macOS 26.2 / iPadOS 26.4.2  - IceCubesApp version:   IceCubes App 2.1.3 (on both platforms)  ## Description  I've created an account within IceCubes connected to a self-hosted Mastodon instance. When I click "Add Account" and attempt to connect a second account from the same instance, after tapping "Sign In," I'm taken straight to the "Authorization required" screen from my first account, with no way tell Ice Cubes that it's a new account I'm adding.
  **Post-Mortem & Fix Analysis**:
  > Disregard! I realized there was a right-arrow icon to the right of the "Sign in as:" section that I needed to click in order to get back to the login screen.

- **Issue #2466** (2026-08-22): **Bug:**
  *Symptoms*: ## Environment:  <!-- Please complete the following information, when reporting bugs related to the IceCubesApp. -->   - OS:  iOS 26.4  - IceCubesApp version: 2.1.3  ## Description  <!-- A clear and concise description of what the bug is. --> _As a user, When I want to report a toot, The icon of the action on the menu is not red like the text and should be._  _As a user, When I want to delete a toot, The icon of the action on the menu is not red like the text and should be._  ## Screenshots  For example, deleting a toot: <img height="300" alt="Delete action without red icon" src="https://github.com/user-attachments/assets/36b6605e-6ce1-4ad3-a2d6-ab8f4f73dba4" />  For example, reporting a toot: <img height="300" alt="Report action without red icon" src="https://github.com/user-attachments/assets/6407b494-16e4-4740-b496-6fc6bc24b994" />  ## Suggestions  Destructive actions should have both text and icons in the red tint color.  ## Related Issues   - [x] Search that this bugs don't already exist before creating it.   <!-- Are there any existing issues or pull requests related to this problem? If so, link them here. -->
  **Post-Mortem & Fix Analysis**:
  > > [!NOTE] > Pull request: https://github.com/Dimillian/IceCubesApp/pull/2467

- **Issue #2463** (2026-08-22): **Bug: When I pinned several tools, the header wording is not in plural form**
  *Symptoms*: ## Environment:  <!-- Please complete the following information, when reporting bugs related to the IceCubesApp. -->   - OS: iOS 26.0  - IceCubesApp version: 2.1.4  ## Description  <!-- A clear and concise description of what the bug is. --> When I have several toots pinned, the header is always in singular form. Thus I may understand I have only pinned toot, which is not true.  For example, the screenshot below was made on an account with 2 pinned toots. <img height="500" alt="Image" src="https://github.com/user-attachments/assets/5d0118e2-e6d3-40ab-9a02-47fa3a061e73" />  ## Related Issues   - [x] Search that this bugs don't already exist before creating it.   <!-- Are there any existing issues or pull requests related to this problem? If so, link them here. -->
  **Post-Mortem & Fix Analysis**:
  > > [!NOTE] > Pull request will come very soon
  > > [!IMPORTANT] > @Dimillian You can find the associated pull request: https://github.com/Dimillian/IceCubesApp/pull/2464

- **Issue #2461** (2026-08-22): **Bug: screen rotation while drafting crashes app**
  *Symptoms*: ## Environment:   - OS:   iOS 26.4.2  - IceCubesApp version: 2.1.3    ## Description  If screen orientation rotates while drafting a post the app will crash.
  **Post-Mortem & Fix Analysis**:
  > Confirmed with last _develop_ version on Xcode 26.4 and codebase at commit 0fc41d2ced2e3e735bd9c42d5ae6dea16e63d618  Is seems the rotation in that case creates an insane infinite loop due to a cycle in the attribute graph, see logs below:  ```text === AttributeGraph: cycle detected through attribute 4091024 === ```
  > This started happening to me when Apple released iOS26.  (A lot of my apps started having weird issues related to transitions between portrait and landscape mode.  Ice Cubes is notable in that it crashes entirely rather than just displaying weirdly until returned to the original orientation.)  Current iOS version:  26.4.1 Current Ice Cubes version:  2.1.3
  > I would like to take a crack at this one. Will dig into the rotation crash and open a PR.

- **Issue #2430** (2026-08-22): **Bug: Message "toast.posting.success.title" when sending a toot.**
  *Symptoms*: ## Environment:  - OS:   26.2  - IceCubesApp version:   2.1.2  - Language:  German  ## Description  When sending a toot a message on top of the screen with "toast.posting.success.title" appears for a short moment. Maybe there is a missing text in the german translations?  ## Related Issues  
  **Post-Mortem & Fix Analysis**:
  > Spotted the same issue (iOS 26.2, french, version 2.1.2)  ![image](https://github.com/user-attachments/assets/1e8b4a4c-ca12-4368-afc2-4db5a7e7aa23)
  > And also same issue with the wording displayed during upload of toot (_toast.posting.title_ I might remember).
  > > [!NOTE] > @predecker For german language the error is not here anymore with version 2.1.4, did not spotted it. > 2.1.4 is maybe still in development, not release done yet  <img height="300" alt="Toot status toast in germand" src="https://github.com/user-attachments/assets/ec148b90-3326-4324-a33f-249cf0b48bb2" />  > [!CAUTION] > However the issue can be still here for other languages, like french language  <img height="300" alt="Missing toot status toast french translation" src="https://github.com/user-attachments/assets/38b33695-5a7d-4aae-8a8d-056cdabafc66" />  > [!TIP] > The issue is here just because some translations are missing and there is no fallback to english for example.

- **Issue #2425** (2026-01-10): **Bug:**
  *Symptoms*: ## Environment:  iPhone Air   - OS: 26.3  - IceCubesApp version: 2.1.2  ## Description  Hard crash when sharing a toot via the ... > Share > Share post as image  ## Related Issues

- **Issue #2408** (2026-01-06): **Bug: faulty News layout**
  *Symptoms*: ## Environment:  <!-- Please complete the following information, when reporting bugs related to the IceCubesApp. -->   - OS:  iPadOS 26.3b1 but present on 26.2 as well  - IceCubesApp version:  2.1.0 but present in the previous version as well  <img width="1408" height="970" alt="Image" src="https://github.com/user-attachments/assets/16b2860a-89a7-4901-b0ae-d65b9c2e10bf" />  ## Description  "News" tab has bad layout, truncating the content and leaving most space unused.   
  **Post-Mortem & Fix Analysis**:
  > @Stooovie how do you get there? I can't repro on 26.2
  > Fixed by deleting and reinstalling, sorry for not trying that first. Case closed, thanks!

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

### Incident Patch 1: `9efcb16e` (2026-09-20)
**Commit Message**: fix: show adaptive sidebar on unfolded iPhone Duo

**File**: `IceCubesApp/App/Main/AppView.swift` (modified, +10/-3)
```diff
@@ -38,8 +38,15 @@ struct AppView: View {
 
   var body: some View {
     HStack(spacing: 0) {
-      tabBarView
-        .tabViewStyle(.sidebarAdaptable)
+      Group {
+        if #available(iOS 27.0, visionOS 27.0, *) {
+          tabBarView
+            .defaultTabBarPlacement(horizontalSizeClass == .regular ? .sidebar : .automatic)
+        } else {
+          tabBarView
+        }
+      }
+      .tabViewStyle(.sidebarAdaptable)
       if horizontalSizeClass == .regular
         && (UIDevice.current.userInterfaceIdiom == .pad
           || UIDevice.current.userInterfaceIdiom == .mac),
@@ -56,7 +63,7 @@ struct AppView: View {
     guard appAccountsManager.currentClient.isAuth else {
       return [SidebarSections.loggedOutTabs]
     }
-    if UIDevice.current.userInterfaceIdiom == .phone || horizontalSizeClass == .compact {
+    if horizontalSizeClass == .compact {
       return [SidebarSections.iosTabs]
     } else if UIDevice.current.userInterfaceIdiom == .vision {
       return [SidebarSections.visionOSTabs]
```

---

### Incident Patch 2: `b2db3033` (2026-08-25)
**Commit Message**: fix: gate WishKit on Mac Catalyst

**File**: `IceCubesApp.xcodeproj/project.pbxproj` (modified, +2/-2)
```diff
@@ -32,7 +32,7 @@
 		9F7788E62BE6543D004E6BEF /* NetworkClient in Frameworks */ = {isa = PBXBuildFile; productRef = 9F7788E52BE6543D004E6BEF /* NetworkClient */; };
 		9F7788F02BE78E77004E6BEF /* Timeline in Frameworks */ = {isa = PBXBuildFile; productRef = 9F7788EF2BE78E77004E6BEF /* Timeline */; };
 		9F7D93942980063100EE6B7A /* AppAccount in Frameworks */ = {isa = PBXBuildFile; productRef = 9F7D93932980063100EE6B7A /* AppAccount */; };
-		9F9191592C6DDF20001C89E7 /* WishKit in Frameworks */ = {isa = PBXBuildFile; productRef = 9F9191582C6DDF20001C89E7 /* WishKit */; };
+		9F9191592C6DDF20001C89E7 /* WishKit in Frameworks */ = {isa = PBXBuildFile; platformFilters = (ios, ); productRef = 9F9191582C6DDF20001C89E7 /* WishKit */; };
 		9FAD858E29743F7400496AB1 /* (null) in Resources */ = {isa = PBXBuildFile; };
 		9FAD859229743F7400496AB1 /* IceCubesShareExtension.appex in Embed Foundation Extensions */ = {isa = PBXBuildFile; fileRef = 9FAD858829743F7400496AB1 /* IceCubesShareExtension.appex */; platformFilters = (ios, maccatalyst, ); settings = {ATTRIBUTES = (RemoveHeadersOnCopy, ); }; };
 		9FAD859A297440CB00496AB1 /* KeychainSwift in Frameworks */ = {isa = PBXBuildFile; productRef = 9FAD8599297440CB00496AB1 /* KeychainSwift */; };
@@ -1337,7 +1337,7 @@
 			repositoryURL = "https://github.com/RevenueCat/purchases-ios-spm";
 			requirement = {
 				kind = upToNextMajorVersion;
-				minimumVersion = 5.85.0;
+				minimumVersion = 5.86.0;
 			};
 		};
 		9F9191572C6DDF20001C89E7 /* XCRemoteSwiftPackageReference "wishkit-ios" */ = {
```

**File**: `IceCubesApp.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +5/-5)
```diff
@@ -1,5 +1,5 @@
 {
-  "originHash" : "95e07ea2caeef497bba7391e6b1a42cf03603536ac065c31a8810d81f5b980a4",
+  "originHash" : "a385044d9d2ed200355221b2fa134ff82734976d25fc828f4bf68e8eb32555c0",
   "pins" : [
     {
       "identity" : "bodega",
@@ -60,17 +60,17 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/kean/Nuke",
       "state" : {
-        "revision" : "63a8fcbd6621340a2410bc3e9575ac97058615f4",
-        "version" : "13.0.6"
+        "revision" : "30f7a7e72e0607d304fbf69c799474bd5fb6d1ce",
+        "version" : "13.2.0"
       }
     },
     {
       "identity" : "purchases-ios-spm",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/RevenueCat/purchases-ios-spm",
       "state" : {
-        "revision" : "1af9d1bf28df81af57a1958237c98bb562b8cc6b",
-        "version" : "5.85.0"
+        "revision" : "57043e7e0173c48d64e171944ac76a34d2467fa1",
+        "version" : "5.86.0"
       }
     },
     {
```

**File**: `IceCubesApp/App/Main/IceCubesApp.swift` (modified, +7/-2)
```diff
@@ -10,7 +10,10 @@ import RevenueCat
 import StatusKit
 import SwiftUI
 import Timeline
-import WishKit
+
+#if !targetEnvironment(macCatalyst)
+  import WishKit
+#endif
 
 @main
 struct IceCubesApp: App {
@@ -93,7 +96,9 @@ class AppDelegate: UIResponder, UIApplicationDelegate {
     PushNotificationsService.shared.setAccounts(accounts: AppAccountsManager.shared.pushAccounts)
     Telemetry.setup()
     Telemetry.signal("app.launched")
-    WishKit.configure(with: "AF21AE07-3BA9-4FE2-BFB1-59A3B3941730")
+    #if !targetEnvironment(macCatalyst)
+      WishKit.configure(with: "AF21AE07-3BA9-4FE2-BFB1-59A3B3941730")
+    #endif
     return true
   }
 
```

**File**: `IceCubesApp/App/Tabs/Settings/SettingsTab.swift` (modified, +7/-5)
```diff
@@ -333,11 +333,13 @@ struct SettingsTabs: View {
         Label("settings.app.about", systemImage: "info.circle")
       }
 
-      NavigationLink {
-        WishlistView()
-      } label: {
-        Label("Feature Requests", systemImage: "list.bullet.rectangle.portrait")
-      }
+      #if !targetEnvironment(macCatalyst)
+        NavigationLink {
+          WishlistView()
+        } label: {
+          Label("Feature Requests", systemImage: "list.bullet.rectangle.portrait")
+        }
+      #endif
 
     } header: {
       Text("settings.section.app")
```

**File**: `IceCubesApp/App/Tabs/Settings/WishlistView.swift` (modified, +8/-5)
```diff
@@ -1,8 +1,11 @@
 import SwiftUI
-import WishKit
 
-struct WishlistView: View {
-  var body: some View {
-    WishKit.FeedbackListView()
+#if !targetEnvironment(macCatalyst)
+  import WishKit
+
+  struct WishlistView: View {
+    var body: some View {
+      WishKit.FeedbackListView()
+    }
   }
-}
+#endif
```

**File**: `Packages/DesignSystem/Package.swift` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ let package = Package(
   dependencies: [
     .package(name: "Models", path: "../Models"),
     .package(name: "Env", path: "../Env"),
-    .package(url: "https://github.com/kean/Nuke", exact: "13.0.6"),
+    .package(url: "https://github.com/kean/Nuke", exact: "13.2.0"),
     .package(url: "https://github.com/Dimillian/EmojiText", branch: "fix-ios26"),
     .package(url: "https://github.com/kaishin/Gifu.git", from: "4.0.1"),
   ],
```

---

### Incident Patch 3: `5a017d84` (2026-08-22)
**Commit Message**: fix: refine profile collection pills

**File**: `Packages/Account/Sources/Account/Detail/Components/AccountCollectionsView.swift` (modified, +6/-2)
```diff
@@ -17,12 +17,16 @@ struct AccountCollectionsView: View {
               routerPath.navigate(to: .collectionDetail(collection: collection))
             } label: {
               VStack(alignment: .leading, spacing: 0) {
-                Label(collection.name, systemImage: "person.2.crop.square.stack")
+                Text(collection.name)
                   .font(.scaledCallout)
+                  .lineLimit(1)
+                  .truncationMode(.tail)
                 Text("account.detail.collections-n-accounts \(collection.itemCount)")
                   .font(.caption2)
               }
-            }.buttonStyle(.bordered)
+            }
+            .buttonStyle(.bordered)
+            .frame(maxWidth: 180)
           }
         }
         .padding(.leading, .layoutPadding)
```

---

### Incident Patch 4: `91d58dd4` (2026-08-22)
**Commit Message**: fix: prevent composer rotation crash (#2473)

Dismiss the composer text view before interface rotation to avoid the iOS 26/27 AttributeGraph cycle while preserving one-time autofocus.

**File**: `Packages/StatusKit/Sources/StatusKit/Editor/UITextView/Representable.swift` (modified, +4/-4)
```diff
@@ -1,19 +1,19 @@
 import SwiftUI
 
 extension TextView {
-  struct Representable: UIViewRepresentable {
+  struct Representable: UIViewControllerRepresentable {
     @Binding var text: NSMutableAttributedString
     @Binding var calculatedHeight: CGFloat
     @Environment(\.sizeCategory) var sizeCategory
 
     let keyboard: UIKeyboardType
     var getTextView: ((UITextView) -> Void)?
 
-    func makeUIView(context: Context) -> UIKitTextView {
-      context.coordinator.textView
+    func makeUIViewController(context: Context) -> TextViewController {
+      TextViewController(textView: context.coordinator.textView)
     }
 
-    func updateUIView(_: UIKitTextView, context: Context) {
+    func updateUIViewController(_: TextViewController, context: Context) {
       context.coordinator.update(representable: self)
       if !context.coordinator.didBecomeFirstResponder {
         context.coordinator.textView.becomeFirstResponder()
```

**File**: `Packages/StatusKit/Sources/StatusKit/Editor/UITextView/TextView.swift` (modified, +32/-1)
```diff
@@ -60,11 +60,42 @@ public struct TextView: View {
   }
 }
 
+/// Hosts the text view so it can dismiss the keyboard before interface rotation.
+final class TextViewController: UIViewController {
+  private let textView: UIKitTextView
+
+  init(textView: UIKitTextView) {
+    self.textView = textView
+    super.init(nibName: nil, bundle: nil)
+  }
+
+  @available(*, unavailable)
+  required init?(coder _: NSCoder) {
+    fatalError("init(coder:) has not been implemented")
+  }
+
+  override func loadView() {
+    view = textView
+  }
+
+  override func viewWillTransition(
+    to size: CGSize, with coordinator: UIViewControllerTransitionCoordinator
+  ) {
+    if textView.isFirstResponder {
+      textView.resignFirstResponder()
+    }
+    super.viewWillTransition(to: size, with: coordinator)
+  }
+}
+
 final class UIKitTextView: UITextView {
   override var keyCommands: [UIKeyCommand]? {
     (super.keyCommands ?? []) + [
       UIKeyCommand(
-        input: UIKeyCommand.inputEscape, modifierFlags: [], action: #selector(escape(_:)))
+        input: UIKeyCommand.inputEscape,
+        modifierFlags: [],
+        action: #selector(escape(_:))
+      ),
     ]
   }
 
```

---

### Incident Patch 5: `8f0b7496` (2026-08-22)
**Commit Message**: [#2463] Fix plural form of pinned toots header (#2464)

Signed-off-by: Pierre-Yves Lapersonne <[REDACTED_EMAIL]>

**File**: `IceCubesApp/Resources/Localization/Localizable.xcstrings` (modified, +280/-58)
```diff
@@ -17822,121 +17822,343 @@
         }
       }
     },
-    "account.post.pinned" : {
+    "account.post.pinned %lld" : {
       "extractionState" : "manual",
       "localizations" : {
         "be" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Замацаваны допіс"
+          "variations" : {
+            "plural" : {
+              "one" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "Замацаваны допіс"
+                }
+              },
+              "few" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "%lld замацаваныя допісы"
+                }
+              },
+              "other" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "%lld замацаваных допісаў"
+                }
+              }
+            }
           }
         },
         "ca" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Publicació fixada"
+          "variations" : {
+            "plural" : {
+              "one" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "Publicació fixada"
+                }
+              },
+              "other" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "%lld publicacions fixades"
+                }
+              }
+            }
           }
         },
         "de" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Angehefteter Beitrag"
+          "variations" : {
+            "plural" : {
+              "one" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "Angehefteter Beitrag"
+                }
+              },
+              "other" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "%lld angeheftete Beiträge"
+                }
+              }
+            }
           }
         },
         "en" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Pinned post"
+          "variations" : {
+            "plural" : {
+              "one" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "Pinned post"
+                }
+              },
+              "other" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "%lld pinned posts"
+                }
+              }
+            }
           }
         },
         "en-GB" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Pinned post"
+          "variations" : {
+            "plural" : {
+              "one" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "Pinned post"
+                }
+              },
+              "other" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "%lld pinned posts"
+                }
+              }
+            }
           }
         },
         "es" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Publicación fijada"
+          "variations" : {
+            "plural" : {
+              "one" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "Publicación fijada"
+                }
+              },
+              "other" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "%lld publicaciones fijadas"
+                }
+              }
+            }
           }
         },
         "eu" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Finkatutako bidalketa"
+          "variations" : {
+            "plural" : {
+              "one" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "Finkatutako bidalketa"
+                }
+              },
+              "other" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "%lld finkatutako bidalketa"
+                }
+              }
+            }
           }
         },
         "fr" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Publication épinglée"
+          "variations" : {
+            "plural" : {
+              "one" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "Publication épinglée"
+                }
+              },
+              "other" : {
+    
```

**File**: `Packages/Account/Sources/Account/Detail/Tabs/StatusesTab.swift` (modified, +1/-1)
```diff
@@ -125,7 +125,7 @@ private struct StatusesTabView: View {
 
   @ViewBuilder
   private var pinnedPostsView: some View {
-    Label("account.post.pinned", systemImage: "pin.fill")
+    Label("account.post.pinned \(fetcher.pinned.count)", systemImage: "pin.fill")
       .accessibilityAddTraits(.isHeader)
       .font(.scaledFootnote)
       .foregroundStyle(.secondary)
```

---

### Incident Patch 6: `dadaa35d` (2026-08-22)
**Commit Message**: [#2466] Fix missing color of icons for destructive actions (report and delete toot) (#2467)

Signed-off-by: Pierre-Yves Lapersonne <[REDACTED_EMAIL]>

**File**: `Packages/Conversations/Sources/Conversations/Detail/ConversationMessageView.swift` (modified, +1/-1)
```diff
@@ -173,7 +173,7 @@ struct ConversationMessageView: View {
         Button(role: .destructive) {
           routerPath.presentedSheet = .report(status: message.reblogAsAsStatus ?? message)
         } label: {
-          Label("status.action.report", systemImage: "exclamationmark.bubble")
+          Label("status.action.report", systemImage: "exclamationmark.bubble").tint(.red)
         }
       }
     }
```

**File**: `Packages/StatusKit/Sources/StatusKit/Row/Subviews/StatusRowContextMenu.swift` (modified, +5/-2)
```diff
@@ -214,7 +214,10 @@ struct StatusRowContextMenu: View {
         Button(
           role: .destructive,
           action: { viewModel.showDeleteAlert = true },
-          label: { Label("status.action.delete", systemImage: "trash") })
+          label: {
+            Label("status.action.delete", systemImage: "trash")
+              .tint(.red)
+          })
       }
     } else {
       if !viewModel.isRemote {
@@ -266,7 +269,7 @@ struct StatusRowContextMenu: View {
           viewModel.routerPath.presentedSheet = .report(
             status: viewModel.status.reblogAsAsStatus ?? viewModel.status)
         } label: {
-          Label("status.action.report", systemImage: "exclamationmark.bubble")
+          Label("status.action.report", systemImage: "exclamationmark.bubble").tint(.red)
         }
       }
     }
```

---

### Incident Patch 7: `25d4a4c7` (2026-08-22)
**Commit Message**: Fix quoted posts not displaying on macOS (#2469) (#2472)

**File**: `Packages/StatusKit/Sources/StatusKit/Row/Subviews/StatusRowContentView.swift` (modified, +4/-0)
```diff
@@ -45,15 +45,19 @@ struct StatusRowContentView: View {
             client: viewModel.client,
             routerPath: viewModel.routerPath
           )
+          #if !targetEnvironment(macCatalyst)
           .fixedSize(horizontal: false, vertical: true)
+          #endif
           .transition(.opacity)
         } else {
           StatusEmbeddedView(
             status: Status.placeholder(),
             client: viewModel.client,
             routerPath: viewModel.routerPath
           )
+          #if !targetEnvironment(macCatalyst)
           .fixedSize(horizontal: false, vertical: true)
+          #endif
           .redacted(reason: .placeholder)
           .transition(.opacity)
         }
```

---

### Incident Patch 8: `c9a6ad2d` (2026-08-22)
**Commit Message**: fix: remove custom font capability

**File**: `IceCubesApp/App/IceCubesApp-release.entitlements` (modified, +0/-5)
```diff
@@ -12,11 +12,6 @@
 	<array>
 		<string>CloudKit</string>
 	</array>
-	<key>com.apple.developer.user-fonts</key>
-	<array>
-		<string>font-enumeration</string>
-		<string>app-usage</string>
-	</array>
 	<key>com.apple.developer.usernotifications.communication</key>
 	<true/>
 	<key>com.apple.security.app-sandbox</key>
```

**File**: `IceCubesApp/App/IceCubesApp.entitlements` (modified, +0/-5)
```diff
@@ -12,11 +12,6 @@
 	<array>
 		<string>CloudKit</string>
 	</array>
-	<key>com.apple.developer.user-fonts</key>
-	<array>
-		<string>app-usage</string>
-		<string>font-enumeration</string>
-	</array>
 	<key>com.apple.developer.usernotifications.communication</key>
 	<true/>
 	<key>com.apple.security.app-sandbox</key>
```

**File**: `IceCubesApp/App/Tabs/Settings/DisplaySettingsView.swift` (modified, +1/-7)
```diff
@@ -27,8 +27,6 @@ struct DisplaySettingsView: View {
 
   @State private var localValues = DisplaySettingsLocalValues()
 
-  @State private var isFontSelectorPresented = false
-
   private let previewStatusViewModel = StatusRowViewModel(
     status: Status.placeholder(forSettings: true, language: "la"),
     client: MastodonClient(server: ""),
@@ -152,7 +150,7 @@ struct DisplaySettingsView: View {
             } else if theme.chosenFont?.fontName == ".AppleSystemUIFontRounded-Regular" {
               return FontState.SFRounded
             }
-            return theme.chosenFontData != nil ? FontState.custom : FontState.system
+            return FontState.system
           },
           set: { newValue in
             switch newValue {
@@ -164,17 +162,13 @@ struct DisplaySettingsView: View {
               theme.chosenFont = UIFont(name: "Atkinson Hyperlegible", size: 1)
             case .SFRounded:
               theme.chosenFont = UIFont.systemFont(ofSize: 1).rounded()
-            case .custom:
-              isFontSelectorPresented = true
             }
           })
       ) {
         ForEach(FontState.allCases, id: \.rawValue) { fontState in
           Text(fontState.title).tag(fontState)
         }
       }
-      .navigationDestination(isPresented: $isFontSelectorPresented, destination: { FontPicker() })
-
       VStack {
         Slider(value: $localValues.fontSizeScale, in: 0.5...1.5, step: 0.1)
         Text("settings.display.font.scaling-\(String(format: "%.1f", localValues.fontSizeScale))")
```

**File**: `IceCubesApp/Resources/Localization/Localizable.xcstrings` (modified, +1/-120)
```diff
@@ -49239,125 +49239,6 @@
         }
       }
     },
-    "settings.display.font.custom" : {
-      "extractionState" : "manual",
-      "localizations" : {
-        "be" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Уласны"
-          }
-        },
-        "ca" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Personalitzada"
-          }
-        },
-        "de" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Eigene"
-          }
-        },
-        "en" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Custom"
-          }
-        },
-        "en-GB" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Custom"
-          }
-        },
-        "es" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Personalizada"
-          }
-        },
-        "eu" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Norberak ezarritakoa"
-          }
-        },
-        "fr" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Personnalisée"
-          }
-        },
-        "it" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Personalizzato"
-          }
-        },
-        "ja" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "カスタム"
-          }
-        },
-        "ko" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "직접 설정"
-          }
-        },
-        "nb" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Tilpasset"
-          }
-        },
-        "nl" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Aangepast"
-          }
-        },
-        "pl" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Własna"
-          }
-        },
-        "pt-BR" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Personalizada"
-          }
-        },
-        "tr" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Özel"
-          }
-        },
-        "uk" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Власний"
-          }
-        },
-        "zh-Hans" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "自定义"
-          }
-        },
-        "zh-Hant" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "自定"
-          }
-        }
-      }
-    },
     "settings.display.font.line-spacing-%@" : {
       "localizations" : {
         "be" : {
@@ -86092,4 +85973,4 @@
     }
   },
   "version" : "1.0"
-}
\ No newline at end of file
+}
```

**File**: `Packages/DesignSystem/Sources/DesignSystem/FontPicker.swift` (removed, +0/-37)
```diff
@@ -1,37 +0,0 @@
-import Env
-import SwiftUI
-
-public struct FontPicker: UIViewControllerRepresentable {
-  @Environment(\.dismiss) var dismiss
-
-  public class Coordinator: NSObject, UIFontPickerViewControllerDelegate {
-    private let dismiss: DismissAction
-
-    public init(dismiss: DismissAction) {
-      self.dismiss = dismiss
-    }
-
-    public func fontPickerViewControllerDidCancel(_: UIFontPickerViewController) {
-      dismiss()
-    }
-
-    public func fontPickerViewControllerDidPickFont(_ viewController: UIFontPickerViewController) {
-      Theme.shared.chosenFont = UIFont(descriptor: viewController.selectedFontDescriptor!, size: 0)
-      dismiss()
-    }
-  }
-
-  public init() {}
-
-  public func makeCoordinator() -> Coordinator {
-    Coordinator(dismiss: dismiss)
-  }
-
-  public func makeUIViewController(context: Context) -> UIFontPickerViewController {
-    let controller = UIFontPickerViewController()
-    controller.delegate = context.coordinator
-    return controller
-  }
-
-  public func updateUIViewController(_: UIFontPickerViewController, context _: Context) {}
-}
```

**File**: `Packages/DesignSystem/Sources/DesignSystem/Theme.swift` (modified, +22/-5)
```diff
@@ -52,7 +52,6 @@ public final class Theme {
     case openDyslexic
     case hyperLegible
     case SFRounded
-    case custom
 
     public var title: LocalizedStringKey {
       switch self {
@@ -64,8 +63,6 @@ public final class Theme {
         "Hyper Legible"
       case .SFRounded:
         "SF Rounded"
-      case .custom:
-        "settings.display.font.custom"
       }
     }
   }
@@ -139,6 +136,12 @@ public final class Theme {
     }
   }
 
+  private static let supportedFontNames: Set<String> = [
+    "OpenDyslexic-Regular",
+    "AtkinsonHyperlegible-Regular",
+    ".AppleSystemUIFontRounded-Regular",
+  ]
+
   private var _cachedChoosenFont: UIFont?
   public var chosenFont: UIFont? {
     get {
@@ -155,6 +158,7 @@ public final class Theme {
     }
     set {
       if let font = newValue,
+        Self.supportedFontNames.contains(font.fontName),
         let data = try? NSKeyedArchiver.archivedData(
           withRootObject: font, requiringSecureCoding: false)
       {
@@ -302,7 +306,7 @@ public final class Theme {
       themeStorage.compactLayoutPadding = compactLayoutPadding
     }
   }
-    
+
   public var avatarAnimated: Bool {
     didSet {
       themeStorage.avatarAnimated = avatarAnimated
@@ -346,12 +350,25 @@ public final class Theme {
     displayFullUsername = themeStorage.displayFullUsername
     lineSpacing = themeStorage.lineSpacing
     fontSizeScale = themeStorage.fontSizeScale
-    chosenFontData = themeStorage.chosenFontData
+    let storedChosenFontData = themeStorage.chosenFontData
+    if let storedChosenFontData,
+      let storedFont = try? NSKeyedUnarchiver.unarchivedObject(
+        ofClass: UIFont.self, from: storedChosenFontData),
+      Self.supportedFontNames.contains(storedFont.fontName)
+    {
+      chosenFontData = storedChosenFontData
+    } else {
+      chosenFontData = nil
+    }
     statusActionSecondary = themeStorage.statusActionSecondary
     compactLayoutPadding = themeStorage.compactLayoutPadding
     avatarAnimated = themeStorage.avatarAnimated
     selectedSet = storedSet
 
+    if storedChosenFontData != chosenFontData {
+      themeStorage.chosenFontData = chosenFontData
+    }
+
     computeContrastingTintColor()
   }
 
```

---

### Incident Patch 9: `f1921f49` (2026-08-22)
**Commit Message**: fix: enable font enumeration capability

**File**: `IceCubesApp.xcodeproj/project.pbxproj` (modified, +4/-2)
```diff
@@ -1070,12 +1070,13 @@
 				CURRENT_PROJECT_VERSION = 3066;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "\"IceCubesApp/Resources\"";
-				DEVELOPMENT_TEAM = "$(DEVELOPMENT_TEAM)";
+				DEVELOPMENT_TEAM = Z6P74P6T99;
 				ENABLE_HARDENED_RUNTIME = YES;
 				ENABLE_PREVIEWS = YES;
 				GENERATE_INFOPLIST_FILE = YES;
 				INFOPLIST_FILE = IceCubesApp/Info.plist;
 				INFOPLIST_KEY_CFBundleDisplayName = "Ice Cubes";
+				INFOPLIST_KEY_ITSAppUsesNonExemptEncryption = NO;
 				INFOPLIST_KEY_LSApplicationCategoryType = "public.app-category.social-networking";
 				INFOPLIST_KEY_NSCameraUsageDescription = "Upload photos & videos to attach to your Mastodon posts.";
 				INFOPLIST_KEY_NSHumanReadableCopyright = "© 2024 Thomas Ricouard";
@@ -1141,12 +1142,13 @@
 				CURRENT_PROJECT_VERSION = 3066;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "\"IceCubesApp/Resources\"";
-				DEVELOPMENT_TEAM = "$(DEVELOPMENT_TEAM)";
+				DEVELOPMENT_TEAM = Z6P74P6T99;
 				ENABLE_HARDENED_RUNTIME = YES;
 				ENABLE_PREVIEWS = YES;
 				GENERATE_INFOPLIST_FILE = YES;
 				INFOPLIST_FILE = IceCubesApp/Info.plist;
 				INFOPLIST_KEY_CFBundleDisplayName = "Ice Cubes";
+				INFOPLIST_KEY_ITSAppUsesNonExemptEncryption = NO;
 				INFOPLIST_KEY_LSApplicationCategoryType = "public.app-category.social-networking";
 				INFOPLIST_KEY_NSCameraUsageDescription = "Upload photos & videos to attach to your Mastodon posts.";
 				INFOPLIST_KEY_NSHumanReadableCopyright = "© 2024 Thomas Ricouard";
```

**File**: `IceCubesApp/App/IceCubesApp-release.entitlements` (modified, +1/-0)
```diff
@@ -14,6 +14,7 @@
 	</array>
 	<key>com.apple.developer.user-fonts</key>
 	<array>
+		<string>font-enumeration</string>
 		<string>app-usage</string>
 	</array>
 	<key>com.apple.developer.usernotifications.communication</key>
```

**File**: `IceCubesApp/App/IceCubesApp.entitlements` (modified, +1/-0)
```diff
@@ -15,6 +15,7 @@
 	<key>com.apple.developer.user-fonts</key>
 	<array>
 		<string>app-usage</string>
+		<string>font-enumeration</string>
 	</array>
 	<key>com.apple.developer.usernotifications.communication</key>
 	<true/>
```

**File**: `IceCubesApp/Info.plist` (modified, +0/-2)
```diff
@@ -15,8 +15,6 @@
 			</array>
 		</dict>
 	</array>
-	<key>ITSAppUsesNonExemptEncryption</key>
-	<false/>
 	<key>NSUserActivityTypes</key>
 	<array>
 		<string>INSendMessageIntent</string>
```

---

### Incident Patch 10: `086e919e` (2026-08-22)
**Commit Message**: fix: close media panel before ALT sheet

**File**: `Packages/StatusKit/Sources/StatusKit/Editor/MainView.swift` (modified, +38/-4)
```diff
@@ -21,6 +21,7 @@ extension StatusEditor {
     @State private var mainStore: EditorStore
     @State private var followUpStores: [EditorStore] = []
     @State private var editingMediaContainer: MediaContainer?
+    @State private var pendingEditingMediaContainer: MediaContainer?
     @State private var scrollID: UUID?
     @State private var isMediaPanelPresented: Bool = false
     @State private var lastEditorFocusState: EditorFocusState?
@@ -47,7 +48,7 @@ extension StatusEditor {
       NavigationStack {
         mainContent(focusedStore: focusedStore)
       }
-      .sheet(item: $editingMediaContainer) { container in
+      .sheet(item: $editingMediaContainer, onDismiss: restoreEditorFocus) { container in
         StatusEditor.MediaEditView(store: focusedStore, container: container)
       }
       .presentationDetents([.large, .height(230)], selection: $presentationDetent)
@@ -143,7 +144,7 @@ extension StatusEditor {
         if newValue {
           lastEditorFocusState = editorFocusState
           editorFocusState = nil
-        } else if editorFocusState == nil {
+        } else if pendingEditingMediaContainer == nil, editorFocusState == nil {
           editorFocusState = lastEditorFocusState ?? .main
         }
       }
@@ -169,7 +170,7 @@ extension StatusEditor {
         EditorView(
           store: mainStore,
           followUpStores: $followUpStores,
-          editingMediaContainer: $editingMediaContainer,
+          editingMediaContainer: mediaEditingRequest,
           presentationDetent: $presentationDetent,
           editorFocusState: $editorFocusState,
           assignedFocusState: .main,
@@ -183,7 +184,7 @@ extension StatusEditor {
           EditorView(
             store: store,
             followUpStores: $followUpStores,
-            editingMediaContainer: $editingMediaContainer,
+            editingMediaContainer: mediaEditingRequest,
             presentationDetent: $presentationDetent,
             editorFocusState: $editorFocusState,
             assignedFocusState: .followUp(index: store.id),
@@ -212,6 +213,7 @@ extension StatusEditor {
 
               if isMediaPanelPresented {
                 MediaPickerPanelView(store: focusedStore)
+                  .onDisappear(perform: presentPendingMediaEditor)
               }
             }
           }
@@ -226,10 +228,42 @@ extension StatusEditor {
 
             if isMediaPanelPresented {
               MediaPickerPanelView(store: focusedStore)
+                .onDisappear(perform: presentPendingMediaEditor)
             }
           }
         }
       }
     }
+
+    private var mediaEditingRequest: Binding<MediaContainer?> {
+      Binding {
+        editingMediaContainer
+      } set: { container in
+        guard let container else {
+          pendingEditingMediaContainer = nil
+          editingMediaContainer = nil
+          return
+        }
+
+        if isMediaPanelPresented {
+          pendingEditingMediaContainer = container
+          isMediaPanelPresented = false
+        } else {
+          editingMediaContainer = container
+        }
+      }
+    }
+
+    private func presentPendingMediaEditor() {
+      guard let container = pendingEditingMediaContainer else { return }
+      pendingEditingMediaContainer = nil
+      editingMediaContainer = container
+    }
+
+    private func restoreEditorFocus() {
+      if editorFocusState == nil {
+        editorFocusState = lastEditorFocusState ?? .main
+      }
+    }
   }
 }
```

---

### Incident Patch 11: `3a70c598` (2026-08-22)
**Commit Message**: fix: inset composer upload progress

**File**: `Packages/StatusKit/Sources/StatusKit/Editor/Components/MediaView.swift` (modified, +2/-1)
```diff
@@ -136,7 +136,8 @@ extension StatusEditor {
           if progress > 0 && progress < 1 {
             ProgressView(value: progress)
               .progressViewStyle(.linear)
-              .padding(.horizontal)
+              .padding(.horizontal, 24)
+              .frame(maxWidth: .infinity)
           } else  {
             ProgressView()
                 .progressViewStyle(.circular)
```

---

### Incident Patch 12: `f1eee2a1` (2026-08-22)
**Commit Message**: fix: prevent ALT editor layout loop

**File**: `Packages/StatusKit/Sources/StatusKit/Editor/Components/MediaEditView.swift` (modified, +28/-15)
```diff
@@ -60,21 +60,7 @@ extension StatusEditor {
           .listRowBackground(theme.primaryBackgroundColor)
           Section {
             if let url = container.mediaAttachment?.url {
-              AsyncImage(
-                url: url,
-                content: { image in
-                  image
-                    .resizable()
-                    .aspectRatio(contentMode: .fill)
-                    .cornerRadius(8)
-                    .padding(8)
-                },
-                placeholder: {
-                  RoundedRectangle(cornerRadius: 8)
-                    .fill(Color.gray)
-                    .frame(height: 200)
-                }
-              )
+              mediaPreview(url: url)
             }
           }
           .listRowBackground(theme.primaryBackgroundColor)
@@ -126,6 +112,33 @@ extension StatusEditor {
       }
     }
 
+    private func mediaPreview(url: URL) -> some View {
+      AsyncImage(url: url) { phase in
+        ZStack {
+          RoundedRectangle(cornerRadius: 8)
+            .fill(Color.gray.opacity(0.2))
+
+          switch phase {
+          case .empty:
+            ProgressView()
+          case .success(let image):
+            image
+              .resizable()
+              .scaledToFit()
+          case .failure:
+            Image(systemName: "photo")
+              .foregroundStyle(.secondary)
+          @unknown default:
+            EmptyView()
+          }
+        }
+      }
+      .frame(maxWidth: .infinity)
+      .frame(height: 200)
+      .clipShape(RoundedRectangle(cornerRadius: 8))
+      .padding(8)
+    }
+
     @ViewBuilder
     private var generateButton: some View {
       if let url = container.mediaAttachment?.url {
```

---

### Incident Patch 13: `7030e03f` (2026-08-22)
**Commit Message**: fix: resolve remaining iOS 27 diagnostics

**File**: `IceCubesApp/App/Tabs/Timeline/AddRemoteTimelineView.swift` (modified, +1/-0)
```diff
@@ -4,6 +4,7 @@ import Env
 import Models
 import NetworkClient
 import NukeUI
+import SwiftData
 import SwiftUI
 
 @MainActor
```

**File**: `Packages/Conversations/Sources/Conversations/Detail/ConversationMessageView.swift` (modified, +34/-5)
```diff
@@ -14,6 +14,7 @@ struct ConversationMessageView: View {
   @Environment(CurrentAccount.self) private var currentAccount
   @Environment(MastodonClient.self) private var client
   @Environment(Theme.self) private var theme
+  @Environment(ToastCenter.self) private var toastCenter
 
   let message: Status
   let conversation: Conversation
@@ -158,11 +159,7 @@ struct ConversationMessageView: View {
     }
     Divider()
     if message.account.id == currentAccount.account?.id {
-      Button("status.action.delete", role: .destructive) {
-        Task {
-          _ = try await client.delete(endpoint: Statuses.status(id: message.id))
-        }
-      }
+      Button("status.action.delete", role: .destructive, action: deleteMessage)
     } else {
       Section(message.reblog?.account.acct ?? message.account.acct) {
         Button {
@@ -182,6 +179,38 @@ struct ConversationMessageView: View {
     }
   }
 
+  private func deleteMessage() {
+    let toastID = toastCenter.showProgress(
+      title: String(localized: "toast.status.delete.title"),
+      systemImage: "trash",
+      tint: .red
+    )
+
+    Task {
+      do {
+        _ = try await client.delete(endpoint: Statuses.status(id: message.id))
+        let successToast = ToastCenter.Toast(
+          id: toastID,
+          title: String(localized: "toast.status.delete.success.title"),
+          systemImage: "checkmark.circle.fill",
+          tint: theme.tintColor,
+          kind: .message
+        )
+        toastCenter.update(id: toastID, toast: successToast, autoDismissAfter: .seconds(3))
+      } catch {
+        let errorToast = ToastCenter.Toast(
+          id: toastID,
+          title: String(localized: "toast.status.delete.failure.title"),
+          message: error.localizedDescription,
+          systemImage: "exclamationmark.triangle.fill",
+          tint: .red,
+          kind: .message
+        )
+        toastCenter.update(id: toastID, toast: errorToast, autoDismissAfter: .seconds(4))
+      }
+    }
+  }
+
   private var likeView: some View {
     HStack {
       Spacer()
```

**File**: `Packages/Env/Sources/Env/StreamWatcher.swift` (modified, +2/-0)
```diff
@@ -111,6 +111,8 @@ import Observation
               logger.error("Raw data: \(rawEvent.payload)")
             } catch let StreamDecodeError.rawEvent(error) {
               logger.error("Error decoding streaming event: \(error.localizedDescription)")
+            } catch {
+              logger.error("Unexpected error decoding streaming event: \(error.localizedDescription)")
             }
           }
 
```

**File**: `Packages/Lists/Sources/Lists/Create/ListCreateView.swift` (modified, +30/-14)
```diff
@@ -11,6 +11,7 @@ public struct ListCreateView: View {
   @Environment(Theme.self) private var theme
   @Environment(MastodonClient.self) private var client
   @Environment(CurrentAccount.self) private var currentAccount
+  @Environment(ToastCenter.self) private var toastCenter
 
   @State private var title = ""
   @State private var repliesPolicy: Models.List.RepliesPolicy = .list
@@ -42,20 +43,7 @@ public struct ListCreateView: View {
       .toolbar {
         CancelToolbarItem()
         ToolbarItem {
-          Button {
-            let client = client
-            Task {
-              isSaving = true
-              let _: Models.List = try await client.post(
-                endpoint: Lists.createList(
-                  title: title,
-                  repliesPolicy: repliesPolicy,
-                  exclusive: isExclusive))
-              await currentAccount.fetchLists()
-              isSaving = false
-              dismiss()
-            }
-          } label: {
+          Button(action: createList) {
             if isSaving {
               ProgressView()
             } else {
@@ -68,4 +56,32 @@ public struct ListCreateView: View {
       .navigationBarTitleDisplayMode(.inline)
     }
   }
+
+  private func createList() {
+    let client = client
+    Task {
+      isSaving = true
+      defer { isSaving = false }
+
+      do {
+        let _: Models.List = try await client.post(
+          endpoint: Lists.createList(
+            title: title,
+            repliesPolicy: repliesPolicy,
+            exclusive: isExclusive))
+        await currentAccount.fetchLists()
+        dismiss()
+      } catch {
+        toastCenter.show(
+          .init(
+            title: String(localized: "lists.create"),
+            message: error.localizedDescription,
+            systemImage: "exclamationmark.triangle.fill",
+            tint: .red
+          ),
+          autoDismissAfter: .seconds(4)
+        )
+      }
+    }
+  }
 }
```

**File**: `Packages/MediaUI/Sources/MediaUI/MediaUIAttachmentVideoView.swift` (modified, +14/-8)
```diff
@@ -11,6 +11,7 @@ import SwiftUI
   let url: URL
   let forceAutoPlay: Bool
   var isPlaying: Bool = false
+  @ObservationIgnored private var playbackEndObserver: NSObjectProtocol?
 
   public init(url: URL, forceAutoPlay: Bool = false) {
     self.url = url
@@ -31,13 +32,17 @@ import SwiftUI
       isPlaying = false
     }
     guard let player else { return }
-    NotificationCenter.default.addObserver(
+    if let playbackEndObserver {
+      NotificationCenter.default.removeObserver(playbackEndObserver)
+    }
+    playbackEndObserver = NotificationCenter.default.addObserver(
       forName: .AVPlayerItemDidPlayToEndTime,
       object: player.currentItem, queue: .main
-    ) { _ in
-      Task { @MainActor [weak self] in
-        if autoPlay || self?.forceAutoPlay == true {
-          self?.play()
+    ) { [weak self] _ in
+      Task { @MainActor in
+        guard let self else { return }
+        if autoPlay || self.forceAutoPlay {
+          self.play()
         }
       }
     }
@@ -75,9 +80,10 @@ import SwiftUI
     #endif
   }
 
-  deinit {
-    NotificationCenter.default.removeObserver(
-      self, name: .AVPlayerItemDidPlayToEndTime, object: nil)
+  isolated deinit {
+    if let playbackEndObserver {
+      NotificationCenter.default.removeObserver(playbackEndObserver)
+    }
   }
 }
 
```

**File**: `Packages/Models/Sources/Models/Alias/HTMLString.swift` (modified, +2/-2)
```diff
@@ -52,7 +52,7 @@ public struct HTMLString: Codable, Equatable, Hashable, @unchecked Sendable {
 
       asMarkdown = ""
       do {
-        let document: Document = try SwiftSoup.parse(htmlValue)
+        let document: SwiftSoup.Document = try SwiftSoup.parse(htmlValue)
         var listCounters: [Int] = []
         handleNode(node: document, listCounters: &listCounters)
 
@@ -136,7 +136,7 @@ public struct HTMLString: Codable, Equatable, Hashable, @unchecked Sendable {
     try container.encode(hadTrailingTags, forKey: .hadTrailingTags)
   }
 
-  private mutating func removeTrailingTags(doc: Document) {
+  private mutating func removeTrailingTags(doc: SwiftSoup.Document) {
     // Fast bail-outs
     if !asMarkdown.contains("#") { return }
 
```

**File**: `Packages/Notifications/Sources/Notifications/Models/NotificationExt.swift` (modified, +2/-2)
```diff
@@ -8,7 +8,7 @@
 import Models
 
 extension Notification {
-  func consolidationId(selectedType: Models.Notification.NotificationType?) -> String? {
+  nonisolated func consolidationId(selectedType: Models.Notification.NotificationType?) -> String? {
     guard let supportedType else { return nil }
 
     switch supportedType {
@@ -24,7 +24,7 @@ extension Notification {
     }
   }
 
-  func isConsolidable(selectedType: Models.Notification.NotificationType?) -> Bool {
+  nonisolated func isConsolidable(selectedType: Models.Notification.NotificationType?) -> Bool {
     // Notification is consolidable onlt if the consolidation id is not the notication id (unique) itself
     consolidationId(selectedType: selectedType) != id
   }
```

**File**: `Packages/Notifications/Sources/Notifications/Models/NotificationTypeExt.swift` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ import Models
 import SwiftUI
 
 extension Models.Notification.NotificationType {
-  public func label(count: Int) -> LocalizedStringKey {
+  public nonisolated func label(count: Int) -> LocalizedStringKey {
     switch self {
     case .status:
       "notifications.label.status"
```

---

### Incident Patch 14: `bcb4f62c` (2026-08-22)
**Commit Message**: build(deps): refresh Swift package resolutions

**File**: `IceCubesApp.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +8/-17)
```diff
@@ -51,8 +51,8 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/nicklockwood/LRUCache",
       "state" : {
-        "revision" : "0d91406ecd4d6c1c56275866f00508d9aeacc92a",
-        "version" : "1.2.0"
+        "revision" : "cb5b2bd0da83ad29c0bec762d39f41c8ad0eaf3e",
+        "version" : "1.2.1"
       }
     },
     {
@@ -87,26 +87,26 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/stephencelis/SQLite.swift.git",
       "state" : {
-        "revision" : "392dd6058624d9f6c5b4c769d165ddd8c7293394",
-        "version" : "0.15.4"
+        "revision" : "964c300fb0736699ce945c9edb56ecd62eba27a3",
+        "version" : "0.16.0"
       }
     },
     {
       "identity" : "swift-atomics",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/apple/swift-atomics.git",
       "state" : {
-        "revision" : "b601256eab081c0f92f059e12818ac1d4f178ff7",
-        "version" : "1.3.0"
+        "revision" : "0442cb5a3f98ab802acb777929fdb446bda11a34",
+        "version" : "1.3.1"
       }
     },
     {
       "identity" : "swift-cmark",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/swiftlang/swift-cmark.git",
       "state" : {
-        "revision" : "5d9bdaa4228b381639fff09403e39a04926e2dbe",
-        "version" : "0.7.1"
+        "revision" : "924936d0427cb25a61169739a7660230bffa6ea6",
+        "version" : "0.8.0"
       }
     },
     {
@@ -118,15 +118,6 @@
         "version" : "0.7.3"
       }
     },
-    {
-      "identity" : "swift-toolchain-sqlite",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github.com/swiftlang/swift-toolchain-sqlite",
-      "state" : {
-        "revision" : "b626d3002773b1a1304166643e7f118f724b2132",
-        "version" : "1.0.4"
-      }
-    },
     {
       "identity" : "swiftsdk",
       "kind" : "remoteSourceControl",
```

---

### Incident Patch 15: `9c05a720` (2026-06-09)
**Commit Message**: More compile fix

**File**: `Packages/Timeline/Sources/Timeline/actors/TimelineStatusFetcher.swift` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@ import Foundation
 import Models
 import NetworkClient
 
-protocol TimelineStatusFetching: Sendable {
+nonisolated protocol TimelineStatusFetching: Sendable {
   func fetchFirstPage(
     client: MastodonClient?,
     timeline: TimelineFilter
```

#### Recent Merged Pull Requests:
- **PR #2498** (closed): Bump github.com/revenuecat/purchases-ios-spm from 5.86.0 to 5.88.0 (@dependabot[bot])
- **PR #2497** (closed):  Fix fatal Swift 6.3.1 compiler crash in MediaUIZoomableContainer (@jadetheda)
- **PR #2491** (closed): Bump github.com/revenuecat/purchases-ios-spm from 5.86.0 to 5.87.1 (@dependabot[bot])
- **PR #2485** (closed): Bump github.com/telemetrydeck/swiftsdk from 2.11.0 to 2.14.2 (@dependabot[bot])
- **PR #2484** (closed): Bump github.com/swiftlang/swift-markdown from 0.7.3 to 0.8.0 (@dependabot[bot])
- **PR #2483** (closed): Bump github.com/wishkit/wishkit-ios from 4.7.0 to 5.1.2 (@dependabot[bot])
- **PR #2482** (closed): Bump github.com/dean151/buttonkit from 0.6.1 to 0.8.1 (@dependabot[bot])
- **PR #2481** (closed): Bump github.com/kean/nuke from 13.0.6 to 13.2.0 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
