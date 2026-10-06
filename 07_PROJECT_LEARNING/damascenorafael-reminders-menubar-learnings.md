# Forensic Learning Record (Deep Inspection): DamascenoRafael/reminders-menubar

> **Canonical Artifact**: `07_PROJECT_LEARNING/damascenorafael-reminders-menubar-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/DamascenoRafael/reminders-menubar](https://github.com/DamascenoRafael/reminders-menubar))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:12:04.583Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `DamascenoRafael/reminders-menubar`
- **Description**: Simple macOS menu bar application to view and interact with reminders. Developed with SwiftUI and using Apple Reminders as a source.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3959 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `reminders-menubar/Views/EmptyStates/NoFilterSelectedView.swift`
```
import SwiftUI

struct NoFilterSelectedView: View {
    var body: some View {
        VStack(spacing: 4) {
            Image(rmbSymbol: .filterCircle)
                .font(.title)

            Text(rmbLocalized(.emptyListNoRemindersFilterTitle))
                .font(.headline)
                .multilineTextAlignment(.center)
            
            Text(rmbLocalized(.emptyListNoRemindersFilterMessage))
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(.bottom, 36)
        .padding(.horizontal, 12)
    }
}

#Preview {
    NoFilterSelectedView()
}

```

### Core Architecture Module: `reminders-menubar/Views/EmptyStates/NoReminderItemsView.swift`
```
import SwiftUI
import EventKit

struct NoReminderItemsView: View {
    enum EmptyListType {
        case allItemsCompleted
        case noUpcomingReminders
        case noRecentReminders
        case noSearchQuery
        case noSearchResults
        
        var message: String {
            switch self {
            case .allItemsCompleted:
                return rmbLocalized(.emptyListAllItemsCompletedMessage)
            case .noUpcomingReminders:
                return rmbLocalized(.emptyListNoUpcomingRemindersMessage)
            case .noRecentReminders:
                return rmbLocalized(.emptyListNoRecentRemindersMessage)
            case .noSearchQuery:
                return rmbLocalized(.emptyListSearchNoQueryMessage)
            case .noSearchResults:
                return rmbLocalized(.emptyListSearchNoResultsMessage)
            }
        }
    }
    
    var emptyList: EmptyListType
    
    var body: some View {
        HStack(alignment: .center) {
            Image(rmbSymbol: .tray)
            Text(emptyList.message)
        }
        .font(.callout)
        .padding(.leading, 0.5)
        .padding(.bottom, 4)
    }
}

#Preview {
    NoReminderItemsView(emptyList: .allItemsCompleted)
    NoReminderItemsView(emptyList: .noUpcomingReminders)
    NoReminderItemsView(emptyList: .noRecentReminders)
}

```

### Core Architecture Module: `reminders-menubar/Views/EmptyStates/NoReminderListsView.swift`
```
import SwiftUI

struct NoReminderListsView: View {
    private let appleRemindersUrl = URL(string: "x-apple-reminderkit://")

    var body: some View {
        VStack(spacing: 4) {
            Image(rmbSymbol: .calendarBadgeExclamationmark)
                .font(.title)

            Text(rmbLocalized(.emptyListNoCalendarsTitle))
                .font(.headline)
                .multilineTextAlignment(.center)

            Text(rmbLocalized(.emptyListNoCalendarsMessage))
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)

            if let appleRemindersUrl {
                Button(rmbLocalized(.openAppleRemindersButton)) {
                    NSWorkspace.shared.open(appleRemindersUrl)
                }
                .padding(.top, 6)
            }
        }
        .padding(.bottom, 36)
        .padding(.horizontal, 12)
    }
}

#Preview {
    NoReminderListsView()
}

```

### Core Architecture Module: `reminders-menubar-launcher/AppDelegate.swift`
```
import Cocoa

class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ aNotification: Notification) {
        guard NSRunningApplication.runningApplications(withBundleIdentifier: AppConstants.mainBundleId).isEmpty else {
            // main app is already running
            NSApp.terminate(self)
            return
        }
        
        guard let appUrl = containingMainAppURL() else {
            // The launcher must be embedded in the main app bundle.
            NSApp.terminate(self)
            return
        }
        
        let configuration = NSWorkspace.OpenConfiguration()
        configuration.activates = false
        NSWorkspace.shared.openApplication(
            at: appUrl,
            configuration: configuration,
            completionHandler: { _, _ in
                DispatchQueue.main.async {
                    NSApp.terminate(nil)
                }
            }
        )
    }

    private func containingMainAppURL() -> URL? {
        let mainAppURL = URL(
            fileURLWithPath: "../../../..",
            isDirectory: true,
            relativeTo: Bundle.main.bundleURL
        ).standardizedFileURL
        guard Bundle(url: mainAppURL)?.bundleIdentifier == AppConstants.mainBundleId else {
            return nil
        }
        return mainAppURL
    }
}

```

### Core Architecture Module: `reminders-menubar-launcher/main.swift`
```
import Cocoa

let delegate = AppDelegate()

NSApplication.shared.delegate = delegate

_ = NSApplicationMain(CommandLine.argc, CommandLine.unsafeArgv)

```

### Core Architecture Module: `reminders-menubar/AppCommands.swift`
```
import SwiftUI

struct AppCommands: Commands {
    @CommandsBuilder var body: some Commands {
        CommandMenu(Text(verbatim: "Edit")) {
            // NOTE: macOS 13.0 already has the below shortcuts for TextField.
            // Shortcuts only need to be registered for versions earlier than macOS 13.0.
            if #unavailable(macOS 13.0) {
                Button {
                    NSApp.sendAction(#selector(NSText.selectAll(_:)), to: nil, from: nil)
                } label: {
                    Text(verbatim: "Select All")
                }
                .keyboardShortcut(KeyEquivalent("a"), modifiers: .command)
                
                Button {
                    NSApp.sendAction(#selector(NSText.cut(_:)), to: nil, from: nil)
                } label: {
                    Text(verbatim: "Cut")
                }
                .keyboardShortcut(KeyEquivalent("x"), modifiers: .command)
                
                Button {
                    NSApp.sendAction(#selector(NSText.copy(_:)), to: nil, from: nil)
                } label: {
                    Text(verbatim: "Copy")
                }
                .keyboardShortcut(KeyEquivalent("c"), modifiers: .command)
                
                Button {
                    NSApp.sendAction(#selector(NSText.paste(_:)), to: nil, from: nil)
                } label: {
                    Text(verbatim: "Paste")
                }
                .keyboardShortcut(KeyEquivalent("v"), modifiers: .command)
                
                Button {
                    NSApp.sendAction(Selector(("undo:")), to: nil, from: nil)
                } label: {
                    Text(verbatim: "Undo")
                }
                .keyboardShortcut(KeyEquivalent("z"), modifiers: .command)
                
                Button {
                    NSApp.sendAction(Selector(("redo:")), to: nil, from: nil)
                } label: {
                    Text(verbatim: "Redo")
                }
                .keyboardShortcut(KeyEquivalent("z"), modifiers: [.command, .shift])
            }
        }
    }
}

```

### Core Architecture Module: `reminders-menubar/AppDelegate.swift`
```
import Cocoa
import SwiftUI
import Combine

@main
struct RemindersMenuBar: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    
    var body: some Scene {
        if #available(macOS 14.0, *) {
            Window(String(""), id: "SettingsOpener") {
                SettingsOpenerView()
            }
            .windowResizability(.contentSize)
            .windowStyle(.hiddenTitleBar)
            .defaultSize(width: 0, height: 0)
        }

        Settings {
            SettingsView()
        }
        .commands {
            AppCommands()
        }
    }
}

@MainActor
class AppDelegate: NSObject, NSApplicationDelegate {
    // swiftlint:disable:next implicitly_unwrapped_optional
    static private(set) var shared: AppDelegate!

    private var didCloseCancellationToken: AnyCancellable?
    private var didShowCancellationToken: AnyCancellable?
    private var didCloseEventDate = Date.distantPast

    private var globalOutsideClickMonitor: Any?
    private var localOutsideClickMonitor: Any?
    
    private var sharedAuthorizationErrorMessage: String?
    private var currentMenuBarCount = 0
    private var currentReminderPreview: String?

    let popover = NSPopover()
    lazy var statusBarItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    
    var contentViewController: NSViewController {
        let contentView = ContentView()
        let remindersData = RemindersData()
        let copyShortcutCoordinator = CopyShortcutCoordinator()
        let newReminderTypingCoordinator = NewReminderTypingCoordinator()
        return NSHostingController(
            rootView: contentView
                .environmentObject(remindersData)
                .environmentObject(copyShortcutCoordinator)
                .environmentObject(newReminderTypingCoordinator)
        )
    }

    func applicationDidFinishLaunching(_ aNotification: Notification) {
        AppDelegate.shared = self
        LaunchAtLoginService.shared.migrateIfNeeded()

        configurePopover()
        configureMenuBarButton()
        configureKeyboardShortcut()
        configureDidCloseNotification()
        configureDidShowNotification()
    }

    func applicationWillTerminate(_ notification: Notification) {
        stopOutsideClickMonitors()
    }

    // Prevent the app from terminating because of the Settings window (or any auxiliary window).
    // As a menu bar app with no main window, the popover serves as its primary UI.
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
    }

    private func configurePopover() {
        setMainPopoverSize(size: UserPreferences.shared.mainPopoverSize)
        popover.animates = false
        popover.behavior = .transient

        if RemindersService.shared.isAuthorized {
            popover.contentViewController = contentViewController
        }
    }
    
    func updateMenuBarCount(to count: Int) {
        currentMenuBarCount = count
        applyMenuBarButtonAppearance()
    }

    func updateMenuBarReminderPreview(_ title: String?) {
        currentReminderPreview = title
        applyMenuBarButtonAppearance()
    }

    private func applyMenuBarButtonAppearance() {
        let reminderPreview = currentReminderPreview
        let menuBarCount = currentMenuBarCount

        if let reminderPreview {
            let hideCounter = UserPreferences.shared.hideCounterWhenReminderPreviewIsShown
            if !hideCounter && menuBarCount > 0 {
                statusBarItem.button?.title = "\(menuBarCount) · \(reminderPreview)"
            } else {
                statusBarItem.button?.title = reminderPreview
            }
        } else {
            let buttonTitle = menuBarCount > 0 ? String(menuBarCount) : ""
            statusBarItem.button?.title = buttonTitle
        }

        loadMenuBarIcon()
    }
    
    func loadMenuBarIcon() {
        let isContentVisible = currentMenuBarCount > 0 || currentReminderPreview != nil
        let shouldHideIcon = UserPreferences.shared.hideMenuBarIconWhenContentIsShown && isContentVisible
        statusBarItem.button?.image = shouldHideIcon ? nil : UserPreferences.shared.reminderMenuBarIcon.image
    }
    
    private func configureMenuBarButton() {
        loadMenuBarIcon()
        statusBarItem.button?.imagePosition = .imageLeading
        statusBarItem.button?.sendAction(on: [.leftMouseUp, .rightMouseUp])
        statusBarItem.button?.action = #selector(handleStatusBarButtonAction)
    }
    
    private func configureKeyboardShortcut() {
        KeyboardShortcutService.shared.action(for: .openRemindersMenuBar) { [weak self] in
            self?.togglePopover()
        }
    }

    @objc private func handleStatusBarButtonAction() {
        guard let event = NSApp.currentEvent else { return }
        if event.type == .rightMouseUp {
            showRightClickMenu()
        } else {
            togglePopover()
        }
    }

    private func showRightClickMenu() {
        let menu = RightClickMenuHelper.shared.buildRightClickMenu()
        statusBarItem.menu = menu
        statusBarItem.button?.performClick(nil)
        statusBarItem.menu = nil
    }

    @objc private func togglePopover() {
        guard RemindersService.shared.isAuthorized else {
            requestAuthorization()
            return
        }
        
        guard let button = statusBarItem.button else {
            return
        }
        
        if popover.contentViewController == nil {
            popover.contentViewController = contentViewController
        }
        
        if popover.isShown || didCloseEventDate.elapsedTimeInterval < 0.01 {
            didCloseEventDate = .distantPast
            popover.performClose(button)
        } else {
            popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
            NSApp.activate(ignoringOtherApps: true)
            popover.contentViewController?.view.window?.makeKey()
        }
    }

    // - MARK: Popover sizing

    func setMainPopoverSize(size: NSSize, persist: Bool = false) {
        let clampedSize = clampedMainPopoverSize(size: size)
        popover.contentSize = clampedSize

        if persist {
            UserPreferences.shared.mainPopoverSize = clampedSize
        }
    }

    private func mainScreenVisibleFrame() -> NSRect {
        if let screen = statusBarItem.button?.window?.screen {
            return screen.visibleFrame
        }
        return NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1_440, height: 900)
    }

    private func clampedMainPopoverSize(size: NSSize) -> NSSize {
        let screenSize = mainScreenVisibleFrame()

        let maxWidth = (screenSize.width - MainPopoverSizing.minWidthPadding)
            .constrainedTo(min: MainPopoverSizing.minSize.width, max: MainPopoverSizing.maxSize.width)
        let width = size.width.constrainedTo(min: MainPopoverSizing.minSize.width, max: maxWidth)

        let maxHeight = (screenSize.height - MainPopoverSizing.minHeightPadding)
            .constrainedTo(min: MainPopoverSizing.minSize.height, max: MainPopoverSizing.maxSize.height)
        let height = size.height.constrainedTo(min: MainPopoverSizing.minSize.height, max: maxHeight)

        return NSSize(width: width, height: height)
    }

    // - MARK: Fallback for popover open/close behavior

    private func configureDidCloseNotification() {
        // NOTE: There is an issue where if the menu bar button is clicked on its top part to close the popover
        // there will be a didClose event and then togglePopover will be called (reopening the popover).
        // didCloseEventDate is saved to figure out if the event is recent and the popover should not be reopened.
        didCloseCancellationToken = NotificationCenter.default
            .publisher(for: NSPopover.didCloseNotification, object: popover)
            .sink { [weak self] _ in
                self?.didCloseEventDate = Date()
                self?.stopOutsideClickMonitors()
            }
    }

    private func configureDidShowNotification() {
        // SwiftUI `Menu` inside an NSPopover can occasionally break the system's transient dismissal behavior.
        // Install a fallback outside-click monitor while the popover is visible.
        didShowCancellationToken = NotificationCenter.default
            .publisher(for: NSPopover.didShowNotification, object: popover)
            .sink { [weak self] _ in
                self?.startOutsideClickMonitors()
            }
    }

    private func startOutsideClickMonitors() {
        stopOutsideClickMonitors()

        globalOutsideClickMonitor = NSEvent.addGlobalMonitorForEvents(
            matching: [.leftMouseDown, .rightMouseDown, .otherMouseDown]
        ) { [weak self] event in
            MainActor.assumeIsolated {
                if self?.isClickOutsidePopover(event: event) ?? false {
                    self?.popover.performClose(nil)
                }
            }
        }

        localOutsideClickMonitor = NSEvent.addLocalMonitorForEvents(
            matching: [.leftMouseDown, .rightMouseDown, .otherMouseDown]
        ) { [weak self] event in
            // Return nil to swallow the event when dismissing, matching native transient popover behavior.
            let shouldClose = MainActor.assumeIsolated {
                self?.isClickOutsidePopover(event: event) ?? false
            }
            if shouldClose {
                self?.popover.performClose(nil)
            }
            return shouldClose ? nil : event
        }
    }

    private func stopOutsideClickMonitors() {
        if let monitor = globalOutsideClickMonitor {
            NSEvent.removeMonitor(monitor)
            globalOutsideClickMonitor = nil
        }
        if let monitor = localOutsideClickMonitor {
            NSEvent.removeMonitor(monitor)
            localOutsideClickMonitor = nil
        }
    }

    private func isClickOutsidePopover(event: NSEvent) -> Bool {
  
```

### Core Architecture Module: `reminders-menubar/Constants.swift`
```
import Foundation

enum AppConstants {
    static let bundleVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String

    static let displayVersion: String = {
        guard let bundleVersion else {
            return "-"
        }
        
        return "v\(bundleVersion)"
    }()
    
    static let appName = "Reminders MenuBar"
    static let mainBundleId = "br.com.damascenorafael.reminders-menubar"
    static let launcherBundleId = "br.com.damascenorafael.reminders-menubar-launcher"
}

enum GithubConstants {
    static let repository = "DamascenoRafael/reminders-menubar"
    static let repositoryPage = "https://github.com/\(repository)"
}

#if APPSTORE
enum AppStoreConstants {
    static let appId = "PLACEHOLDER_APP_ID"
    static let appPage = "macappstore://apps.apple.com/app/id\(appId)"
    static let versionCheckUrl = "https://itunes.apple.com/lookup?bundleId=\(AppConstants.mainBundleId)"
}
#endif

```

### Core Architecture Module: `reminders-menubar/Extensions/Array+Extension.swift`
```
import Foundation

extension Array {
    func separated(by condition: (Element) -> Bool) -> (matching: [Element], notMatching: [Element]) {
        var elements = self
        let partition = elements.partition(by: { condition($0) })
        let matching = Array(elements[partition...])
        let notMatching = Array(elements[..<partition])
        return(matching, notMatching)
    }
}

```

### Core Architecture Module: `reminders-menubar/Extensions/ArrayReminderItem+Extension.swift`
```
import EventKit

extension Array where Element == ReminderItem {
    var sortedReminders: [ReminderItem] {
        return sorted(
            self,
            dueDateOnTop: UserPreferences.shared.showRemindersWithDueDateOnTop,
            byFlagAndPriority: UserPreferences.shared.sortRemindersByFlagAndPriority,
            using: UserPreferences.shared.reminderSortingOrder
        )
    }

    var sortedUpcomingReminders: [ReminderItem] {
        return sortedByDueDate(self)
    }

    private func sorted(
        _ reminders: [ReminderItem],
        dueDateOnTop: Bool,
        byFlagAndPriority: Bool,
        using sortingOrder: RmbSortingOrder
    ) -> [ReminderItem] {
        if dueDateOnTop {
            var (dueDateReminders, undatedReminders) = reminders.separated(by: { $0.reminder.hasDueDate })

            dueDateReminders = sortedByDueDate(dueDateReminders)
            undatedReminders = sortedByFlagAndPriority(
                undatedReminders, enabled: byFlagAndPriority, using: sortingOrder
            )

            return dueDateReminders + undatedReminders
        }

        return sortedByFlagAndPriority(reminders, enabled: byFlagAndPriority, using: sortingOrder)
    }

    private func sortedByFlagAndPriority(
        _ reminders: [ReminderItem],
        enabled: Bool,
        using sortingOrder: RmbSortingOrder
    ) -> [ReminderItem] {
        if enabled {
            let (flaggedReminders, unflaggedReminders) = reminders.separated(by: { $0.reminder.isFlagged })
            let remindersByPriority = PrioritizedReminders(unflaggedReminders)

            return sortedByOrder(flaggedReminders, using: sortingOrder) +
                sortedByOrder(remindersByPriority.high, using: sortingOrder) +
                sortedByOrder(remindersByPriority.medium, using: sortingOrder) +
                sortedByOrder(remindersByPriority.low, using: sortingOrder) +
                sortedByOrder(remindersByPriority.none, using: sortingOrder)
        }

        return sortedByOrder(reminders, using: sortingOrder)
    }

    private func sortedByDueDate(_ reminders: [ReminderItem]) -> [ReminderItem] {
        reminders.sorted(by: {
            let firstDate = $0.reminder.dueDateComponents?.date ?? Date.distantPast
            let secondDate = $1.reminder.dueDateComponents?.date ?? Date.distantPast
            return firstDate.compare(secondDate) == .orderedAscending
        })
    }

    private func sortedByOrder(
        _ reminders: [ReminderItem],
        using sortingOrder: RmbSortingOrder
    ) -> [ReminderItem] {
        switch sortingOrder {
        case .defaultOrder:
            return sortedByDefaultOrder(reminders)
        case .newestFirst:
            return reminders.sorted(by: {
                let firstDate = $0.reminder.completionDate ?? $0.reminder.creationDate ?? Date.distantPast
                let secondDate = $1.reminder.completionDate ?? $1.reminder.creationDate ?? Date.distantPast
                return firstDate.compare(secondDate) == .orderedDescending
            })
        case .oldestFirst:
            return reminders.sorted(by: {
                let firstDate = $0.reminder.completionDate ?? $0.reminder.creationDate ?? Date.distantPast
                let secondDate = $1.reminder.completionDate ?? $1.reminder.creationDate ?? Date.distantPast
                return firstDate.compare(secondDate) == .orderedAscending
            })
        }
    }

    private func sortedByDefaultOrder(_ reminders: [ReminderItem]) -> [ReminderItem] {
        var orderLookup: [String: Int] = [:]
        let calendarGroups = Dictionary(grouping: reminders, by: { $0.reminder.calendar.calendarIdentifier })
        for (_, groupReminders) in calendarGroups {
            if let calendar = groupReminders.first?.reminder.calendar,
               let ordering = calendar.reminderOrdering {
                for (index, reminderId) in ordering.enumerated() {
                    orderLookup[reminderId] = index
                }
            }
        }

        guard !orderLookup.isEmpty else {
            return reminders
        }

        return reminders.sorted(by: {
            let firstOrder = orderLookup[$0.id] ?? Int.max
            let secondOrder = orderLookup[$1.id] ?? Int.max
            return firstOrder < secondOrder
        })
    }
}

```

### Core Architecture Module: `reminders-menubar/Extensions/Binding+Extensions.swift`
```
import SwiftUI

extension Binding where Value: Equatable {
    init(_ source: Binding<Value?>, replacingNilWith nilProxy: Value) {
        self.init(
            get: { source.wrappedValue ?? nilProxy },
            set: { source.wrappedValue = $0 }
        )
    }
}

```

### Core Architecture Module: `reminders-menubar/Extensions/Calendar+Extensions.swift`
```
import Foundation

extension Calendar {
    func endOfDay(for date: Date) -> Date? {
        var dateComponents = DateComponents()
        dateComponents.day = 1
        dateComponents.second = -1
        return self.date(byAdding: dateComponents, to: self.startOfDay(for: date))
    }

    func daysBetween(_ startDate: Date, and endDate: Date) -> Int {
        let dateComponents = Calendar.current.dateComponents(
            [.day],
            from: startOfDay(for: startDate),
            to: startOfDay(for: endDate)
        )
        return dateComponents.day ?? 0
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #124** (2023-04-05): **1.16 seems to not sync information about what lists should appear, menu bar icon**
  *Symptoms*: After updating from the last 1.15 build to the new 1.16 build via brew, I seem to have some issues with settings I have previously configured not loading at all. I'm not too sure if this is the fault of having the app signed now or not, but its a bit annoying
  **Post-Mortem & Fix Analysis**:
  > Changing the settings for the app, quitting it, and then relaunching the app can help, but still an annoying way to live.
  > I'm sorry to hear that, the settings may have been lost because the app's bundle-id changed between v1.15 and v1.16. I'll add a note in the release to clarify this issue. This should not happen for future versions.  After you change the settings in v1.16 those new settings are kept even if you quit and reopen the app, right?  I don't know if I understand your last message, does something different happen if you quit and reopen the app?
  > The changes in settings do take into effect after I close and repopen the app. They do not occur immediately as on previous builds.  > On Apr 3, 2023, at 8:45 AM, Rafael Damasceno ***@***.***> wrote: >  >  > I'm sorry to hear that, the settings may have been lost because the app's bundle-id changed between v1.15 and v1.16. > I'll add a note in the release to clarify this issue. This should not happen for future versions. >  > After you change the settings in v1.16 those new settings are kept even if you quit and reopen the app, right? >  > I don't know if I understand your last message, does something different happen if you quit and reopen the app? >  > — > Reply to this email directly, view it on GitHub <https://github.com/DamascenoRafael/reminders-menubar/issues/124#issuecomment-1494259799>, or unsubscribe <https://github.com/notifications/unsubscribe-auth/AOJ5WWFCGNNXX5UFAGAKL7LW7LA77ANCNFSM6AAAAAAWQON52I>. > You are receiving this because you authored the thread. >   

- **Issue #96** (2023-01-06): **Not appearing on menu bar**
  *Symptoms*: Hello,  Unsure of what's causing the issue, but I cannot get reminders to even appear on the menu bar. Everything is all up-to-date, so I'm not sure what else could be obstructing the app from opening. <img width="1512" alt="Screenshot 2023-01-04 at 07 50 50 PM" src="https://user-images.githubusercontent.com/105251221/210699361-757346a6-2fb4-4f61-9012-23d481ff67c8.png"> 
  **Post-Mortem & Fix Analysis**:
  > Hello @petersonsim, thanks for reporting this.  When you try to open the app do you get any messages/alerts? You can open the app through Launchpad (second dock icon) or you can open it through Spotlight.
  > Thanks for looking into this! I'm not getting any messages when I open the app via the routes you mentioned.  ![Screenshot 2023-01-04 at 08 29 39 PM](https://user-images.githubusercontent.com/105251221/210702503-e30876ad-5ab3-459a-897a-b68d83a56a80.gif)  ![Screenshot 2023-01-04 at 08 32 32 PM](https://user-images.githubusercontent.com/105251221/210702518-4999150b-be9c-4a08-858f-869b67a12f28.gif)  The only message that popped up was upon initial installation (Reinstalled to show what I was seeing):  ![Screenshot 2023-01-04 at 08 41 11 PM](https://user-images.githubusercontent.com/105251221/210703507-40564b5d-5c69-41c1-8bc4-40899f3d2ee3.gif) 
  > I had the same issue. Open the app from Launchpad, but nothing happened. Environment: macOS 13.1, Reminders Menu Bar 1.12.0

- **Issue #95** (2023-02-01): **Version 1.12.0 - App crashes**
  *Symptoms*: I installed V1.12.0 using the zip file (not Homebrew). The app crashes and quit as soon as I click on the menu bar icon.  Tried to reboot, didn't change anything.  I then tried to do a complete uninstall of V1.11.0 using AppCleaner. Reinstalled V1.12.0, then when I click the icon, it crashes but does not quit (icon gets darker but nothing shows up, unresponsive).  Returned to V1.11.0 for the moment, although I'm very much looking forward for the URL implementation.  I'm on a MBP 14" M1 - Base model.  Cheers
  **Post-Mortem & Fix Analysis**:
  > Thank you for reporting this @LocheBC. I'll try to check it later today.  Can you tell me what version of macOS you are using?  And just to confirm, v1.11.0 works fine, right?
  > Yes, no problem with V1.11.0!  I’m on macOS Ventura 13.2 (a) Beta - Build 22D7750270d  > On Jan 4, 2023, at 1:31 PM, Rafael Damasceno ***@***.***> wrote: >  >  > Thank you for reporting this @LocheBC <https://github.com/LocheBC>. > I'll try to check it later today. >  > Can you tell me what version of macOS you are using? >  > And just to confirm, v1.11.0 works fine, right? >  > — > Reply to this email directly, view it on GitHub <https://github.com/DamascenoRafael/reminders-menubar/issues/95#issuecomment-1371448915>, or unsubscribe <https://github.com/notifications/unsubscribe-auth/A4XQFVJZQK7KV6E7RYFJA4DWQXT4HANCNFSM6AAAAAATRHHTZE>. > You are receiving this because you were mentioned. >   
  > hey @LocheBC. I talked to a friend running macOS 13.0.1 on an M1 and he had no issues. Same thing for me running macOS 13.1 on an Intel i7 MBP.  I'm wondering if it might be some problem happening only in macOS beta.  Do you think you could download the project and try to run it in Xcode? That way Xcode will possibly point out where it is crashing.  Another option would be to see the log which should be saved in ~/Library/Logs/DiagnosticReports/, the file name should start with "Reminders Menu Bar". To open 'Library', open Finder and hold down the Option key before clicking the 'Go' menu in Finder's menu bar.

- **Issue #50** (2022-06-14): **Filter settings are constantly reset.**
  *Symptoms*: Any action from my side and filter settings are reset. Can you fix it please? Latest MacOS, MacBook Air M1
  **Post-Mortem & Fix Analysis**:
  > Hey, @sohate. The filtered lists are saved in the user preferences and should persist when the app is restarted. The only exception is when no list is selected, in which case when restarting the app all lists appear selected.  Can you tell me if this is the situation that is happening to you (no list selected and then when the app is restarted all lists appear selected)?  This was designed before the _Upcoming Reminders_ option. Maybe we can remove this situation now that there is an option for _Upcoming Reminders_, maybe the user always wants to see only this option (and no list).  If the problem is occurring in a different situation let me know so we can investigate further.
  > I guess it's true. The only list is selected is "Upcoming Reminders" (the only list that I need). And when I do check any position all list select back.  What do I want: https://ibb.co/zrkHP56 What do I get when check any position: https://ibb.co/9NHp4Ph
  > Thanks, @sohate. I will be fixing this for the next release 👍 

- **Issue #31** (2021-10-26): **"Show today count in menu bar" no longer works for me**
  *Symptoms*: I upgraded from 1.50 to 1.60 and the "show today count in menu bar" option no longer works for me. The count is never there, regardless of whether I have the option turned on or off. 😞 
  **Post-Mortem & Fix Analysis**:
  > @deathlyfrantic, thanks for letting me know. I'm doing some testing to release a fix.
  > @deathlyfrantic, version 1.6.1 should fix this problem :) Please let me know if something doesn't work as expected or if you find any other bugs 🐞 
  > It works again! 🥳 Thank you!

- **Issue #18** (2021-10-26): **Freezing on macOS Monterey**
  *Symptoms*: After clicking the menu bar icon the application freezes and must be force quit.   Looking in Xcode 13 [this line](https://github.com/DamascenoRafael/reminders-menubar/blob/84dbcdbab03409dfde72ee5ef8447d1cb912e7aa/reminders-menu-bar/AppDelegate.swift#L12) is flagged with the error:  ``` Fatal error: No ObservableObject of type RemindersData found. A View.environmentObject(_:) for RemindersData may be missing as an ancestor of this view. ```  Let me know if there is any other information I can provide that would be helpful.
  **Post-Mortem & Fix Analysis**:
  > I am unsure if there's been an update to address this, but I can confirm that this is still an issue with the latest Monterey dev beta (21A5294g).
  > I still can't figure out what causes this error. In Big Sur, even in Xcode 13 beta there is no problem. The error would be as if ".environmentObject(remindersData)" was not present. Maybe creating a SceneDelegate can help, but it still feels weird. 
  > > The error would be as if ".environmentObject(remindersData)" was not present.  Is it possible that this method is deprecated in favor of something else? I've never seen this before with SwiftUI.

- **Issue #10** (2021-01-28): **Past due times are not showing as red**
  *Symptoms*: Did you end up implementing this in #6? If so, it's not working.  Note: it's currently 11:41  ![image](https://user-images.githubusercontent.com/68361/105840760-702e1480-5fcb-11eb-827f-b21bbda9f42e.png) 
  **Post-Mortem & Fix Analysis**:
  > Oh, i just hid a list, and it seems to have switched them to red. Maybe it had not reloaded or something?
  > I hadn't noticed that, thanks for the feedback!  The View has nothing to indicate that it needs to be reloaded. I'll have to look for something to trigger this reload so that the text changes to expired reminders.  Probably the same will happen when the text needs to change from "Tomorrow" to "Today", for example. 😞   I'll take a look after work.
  > Hey, I believe that the problem with the text not changing to red has been solved!  In addition, there is now an observer and any changes to Apple Reminders will automatically reflect in the App 🎉   I'm not sure if there is still a problem when the text needs to change between a date, "Tomorrow", "Today" etc. because if no other reminder triggers the observer then the View probably won't update. I will try to investigate whether this happens later.

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

### Incident Patch 1: `3ee6f0ac` (2026-10-04)
**Commit Message**: Improve UI by showing reminder count hidden from lists and surfaced in Upcoming

**File**: `reminders-menubar/Models/ReminderItemTree.swift` (modified, +36/-24)
```diff
@@ -1,45 +1,57 @@
 enum ReminderItemTree {
+    struct ExclusionResult {
+        let reminders: [ReminderItem]
+        let excludedCount: Int
+    }
+
     static func excluding(
         reminderIds excludedReminderIds: Set<String>,
         from reminders: [ReminderItem]
-    ) -> [ReminderItem] {
-        guard !excludedReminderIds.isEmpty else { return reminders }
+    ) -> ExclusionResult {
+        guard !excludedReminderIds.isEmpty else {
+            return ExclusionResult(reminders: reminders, excludedCount: 0)
+        }
+
         return excluding(
             reminderIds: excludedReminderIds,
             from: reminders,
-            itemsAreChildren: false
+            isChildLevel: false
         )
     }
 
     private static func excluding(
         reminderIds excludedReminderIds: Set<String>,
         from reminders: [ReminderItem],
-        itemsAreChildren: Bool
-    ) -> [ReminderItem] {
-        return reminders.flatMap { reminderItem in
-            let remainingChildren = excluding(
+        isChildLevel: Bool
+    ) -> ExclusionResult {
+        var remainingReminders: [ReminderItem] = []
+        var excludedCount = 0
+
+        for reminderItem in reminders {
+            let isExcluded = excludedReminderIds.contains(reminderItem.id)
+            let remainingChildrenResult = excluding(
                 reminderIds: excludedReminderIds,
                 from: reminderItem.childReminders,
-                itemsAreChildren: true
-            )
+                isChildLevel: isExcluded ? isChildLevel : true // Promote retained children to the excluded item's level
 
-            if excludedReminderIds.contains(reminderItem.id) {
-                return remainingChildren.map {
-                    ReminderItem(
-                        for: $0.reminder,
-                        isChild: itemsAreChildren,
-                        withChildren: $0.childReminders
-                    )
-                }
-            }
+            )
+            excludedCount += remainingChildrenResult.excludedCount
 
-            return [
-                ReminderItem(
+            if isExcluded {
+                excludedCount += 1
+                remainingReminders.append(contentsOf: remainingChildrenResult.reminders)
+            } else {
+                remainingReminders.append(ReminderItem(
                     for: reminderItem.reminder,
-                    isChild: itemsAreChildren,
-                    withChildren: remainingChildren
-                )
-            ]
+                    isChild: isChildLevel,
+                    withChildren: remainingChildrenResult.reminders
+                ))
+            }
         }
+
+        return ExclusionResult(
+            reminders: remainingReminders,
+            excludedCount: excludedCount
+        )
     }
 }
```

**File**: `reminders-menubar/Models/ReminderList/ReminderListSection.swift` (modified, +16/-9)
```diff
@@ -1,42 +1,49 @@
 import SwiftUI
 
 enum ReminderListSection: Identifiable, Equatable {
-    case calendar(CalendarReminderList)
-    case tag(TagReminderList)
+    case calendar(CalendarReminderList, hiddenUpcomingReminderCount: Int)
+    case tag(TagReminderList, hiddenUpcomingReminderCount: Int)
 
     var id: String {
         switch self {
-        case .calendar(let list):
+        case .calendar(let list, _):
             return "calendar-\(list.id)"
-        case .tag(let list):
+        case .tag(let list, _):
             return "tag-\(list.id)"
         }
     }
 
     var reminders: [ReminderItem] {
         switch self {
-        case .calendar(let list):
+        case .calendar(let list, _):
             return list.reminders
-        case .tag(let list):
+        case .tag(let list, _):
             return list.reminders
         }
     }
 
     var title: String {
         switch self {
-        case .calendar(let list):
+        case .calendar(let list, _):
             return list.calendar.title
-        case .tag(let list):
+        case .tag(let list, _):
             return "# \(list.tag.name)"
         }
     }
 
     var color: Color {
         switch self {
-        case .calendar(let list):
+        case .calendar(let list, _):
             return Color(list.calendar.color)
         case .tag:
             return .rmbColor(.tagHighlight)
         }
     }
+
+    var hiddenUpcomingReminderCount: Int {
+        switch self {
+        case .calendar(_, let count), .tag(_, let count):
+            return count
+        }
+    }
 }
```

**File**: `reminders-menubar/Models/RemindersData.swift` (modified, +16/-12)
```diff
@@ -156,25 +156,29 @@ class RemindersData: ObservableObject {
     var orderedFilteredSections: [ReminderListSection] {
         let reminderIdsToExclude = upcomingReminderIdsToExcludeFromLists
         let calendarSections = filteredCalendarReminderLists.map {
-            ReminderListSection.calendar(
+            let exclusionResult = ReminderItemTree.excluding(
+                reminderIds: reminderIdsToExclude,
+                from: $0.reminders
+            )
+            return ReminderListSection.calendar(
                 CalendarReminderList(
                     for: $0.calendar,
-                    with: ReminderItemTree.excluding(
-                        reminderIds: reminderIdsToExclude,
-                        from: $0.reminders
-                    )
-                )
+                    with: exclusionResult.reminders
+                ),
+                hiddenUpcomingReminderCount: exclusionResult.excludedCount
             )
         }
         let tagSections = filteredTagReminderLists.map {
-            ReminderListSection.tag(
+            let exclusionResult = ReminderItemTree.excluding(
+                reminderIds: reminderIdsToExclude,
+                from: $0.reminders
+            )
+            return ReminderListSection.tag(
                 TagReminderList(
                     for: $0.tag,
-                    with: ReminderItemTree.excluding(
-                        reminderIds: reminderIdsToExclude,
-                        from: $0.reminders
-                    )
-                )
+                    with: exclusionResult.reminders
+                ),
+                hiddenUpcomingReminderCount: exclusionResult.excludedCount
             )
         }
 
```

**File**: `reminders-menubar/Resources/Localizable.xcstrings` (modified, +395/-0)
```diff
@@ -9001,6 +9001,401 @@
         }
       }
     },
+    "hiddenUpcomingRemindersInListHelp" : {
+      "extractionState" : "manual",
+      "localizations" : {
+        "cs" : {
+          "variations" : {
+            "plural" : {
+              "few" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "%lld připomínky skryty, zobrazeny v sekci Naplánováno"
+                }
+              },
+              "many" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "%lld připomínek skryto, zobrazeno v sekci Naplánováno"
+                }
+              },
+              "one" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "%lld připomínka skryta, zobrazena v sekci Naplánováno"
+                }
+              },
+              "other" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "%lld připomínek skryto, zobrazeno v sekci Naplánováno"
+                }
+              }
+            }
+          }
+        },
+        "de" : {
+          "variations" : {
+            "plural" : {
+              "one" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "%lld Erinnerung ausgeblendet, unter „Zukünftige Erinnerungen“ angezeigt"
+                }
+              },
+              "other" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "%lld Erinnerungen ausgeblendet, unter „Zukünftige Erinnerungen“ angezeigt"
+                }
+              }
+            }
+          }
+        },
+        "en" : {
+          "variations" : {
+            "plural" : {
+              "one" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "%lld reminder hidden, shown in Upcoming reminders"
+                }
+              },
+              "other" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "%lld reminders hidden, shown in Upcoming reminders"
+                }
+              }
+            }
+          }
+        },
+        "es-419" : {
+          "variations" : {
+            "plural" : {
+              "one" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "%lld recordatorio oculto, mostrado en Próximos recordatorios"
+                }
+              },
+              "other" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "%lld recordatorios ocultos, mostrados en Próximos recordatorios"
+                }
+              }
+            }
+          }
+        },
+        "fil-PH" : {
+          "variations" : {
+            "plural" : {
+              "one" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "%lld paalala nakatago, ipinapakita sa Mga paparating na paalala"
+                }
+              },
+              "other" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "%lld paalala nakatago, ipinapakita sa Mga paparating na paalala"
+                }
+              }
+            }
+          }
+        },
+        "fr" : {
+          "variations" : {
+            "plural" : {
+              "one" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "%lld rappel masqué, affiché dans Prochains rappels"
+                }
+              },
+              "other" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "%lld rappels masqués, affichés dans Prochains rappels"
+                }
+              }
+            }
+          }
+        },
+        "id" : {
+          "variations" : {
+            "plural" : {
+              "one" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "%lld pengingat disembunyikan, ditampilkan di Pengingat yang akan datang"
+                }
+              },
+              "other" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "%lld pengingat disembunyikan, ditampilkan di Pengingat yang akan datang"
+                }
+              }
+            }
+          }
+        },
+        "it" : {
+          "variations" : {
+            "plural" : {
+              "one" : {
+                "stringUnit" : {
+                  "state" : "translated",
+                  "value" : "%lld promemoria nascosto, mostrato in Prossimi promemoria"
+                }
+              },
+              "other" : {
+                "stringUni
```

**File**: `reminders-menubar/Resources/remindersLocalized.swift` (modified, +1/-0)
```diff
@@ -143,6 +143,7 @@ enum RemindersMenuBarLocalizedKeys: String {
     case copySampleTags
     case showUpcomingRemindersSettingsOption
     case hideUpcomingRemindersFromListsOption
+    case hiddenUpcomingRemindersInListHelp
     case reminderDisplaySettingsLabel
     case showExternalLinksInReminderItemOption
     case showExternalLinksInReminderItemNote
```

**File**: `reminders-menubar/Views/ContentView.swift` (modified, +19/-7)
```diff
@@ -151,7 +151,7 @@ struct ContentView: View {
             Section(header: CalendarTitle(
                 title: rmbLocalized(.recentRemindersSectionTitle),
                 color: .rmbColor(.recentSectionTitle),
-                icon: {
+                accessories: {
                     Image(rmbSymbol: .recentReminders)
                 }
             )) {
@@ -168,10 +168,12 @@ struct ContentView: View {
                 Section(header: CalendarTitle(
                     title: userPreferences.upcomingRemindersInterval.sectionTitle,
                     color: .rmbColor(.upcomingSectionTitle),
-                    icon: {
+                    accessories: {
                         if userPreferences.filterUpcomingRemindersByCalendar {
-                            Image(rmbSymbol: .filterCircle)
-                                .help(rmbLocalized(.upcomingRemindersFilterByCalendarEnabledHelp))
+                            CalendarTitleIndicator(
+                                symbol: .filterCircle,
+                                helpText: rmbLocalized(.upcomingRemindersFilterByCalendarEnabledHelp)
+                            )
                         }
                     }
                 )) {
@@ -184,10 +186,20 @@ struct ContentView: View {
                 Section(header: CalendarTitle(
                     title: section.title,
                     color: section.color,
-                    icon: {
+                    accessories: {
                         if case .tag = section, userPreferences.filterTagRemindersByCalendar {
-                            Image(rmbSymbol: .filterCircle)
-                                .help(rmbLocalized(.tagRemindersFilterByCalendarEnabledHelp))
+                            CalendarTitleIndicator(
+                                symbol: .filterCircle,
+                                helpText: rmbLocalized(.tagRemindersFilterByCalendarEnabledHelp)
+                            )
+                        }
+                        let hiddenCount = section.hiddenUpcomingReminderCount
+                        if hiddenCount > 0 {
+                            CalendarTitleIndicator(
+                                symbol: .calendar,
+                                helpText: rmbLocalized(.hiddenUpcomingRemindersInListHelp, arguments: hiddenCount),
+                                text: "+\(hiddenCount)"
+                            )
                         }
                     }
                 )) {
```

**File**: `reminders-menubar/Views/Helpers/CalendarTitle.swift` (modified, +52/-16)
```diff
@@ -1,42 +1,78 @@
 import SwiftUI
 import EventKit
 
-struct CalendarTitle<Icon: View>: View {
-    var title: String
-    var color: Color
-    var icon: Icon
+struct CalendarTitle<Accessories: View>: View {
+    let title: String
+    let color: Color
+    let accessories: Accessories
 
-    init(calendar: EKCalendar) where Icon == EmptyView {
+    init(calendar: EKCalendar) where Accessories == EmptyView {
         self.title = calendar.title
         self.color = Color(calendar.color)
-        self.icon = EmptyView()
+        self.accessories = EmptyView()
     }
 
-    init(title: String, color: Color) where Icon == EmptyView {
+    init(title: String, color: Color) where Accessories == EmptyView {
         self.title = title
         self.color = color
-        self.icon = EmptyView()
+        self.accessories = EmptyView()
     }
 
-    init(title: String, color: Color, @ViewBuilder icon: () -> Icon) {
+    init(title: String, color: Color, @ViewBuilder accessories: () -> Accessories) {
         self.title = title
         self.color = color
-        self.icon = icon()
+        self.accessories = accessories()
     }
-    
+
     var body: some View {
-        HStack(alignment: .center) {
+        HStack(alignment: .center, spacing: 6) {
             Text(title)
                 .font(.headline)
                 .foregroundColor(color)
-                .padding(.top, 2)
-                .padding(.bottom, 5)
+                .lineLimit(1)
+                .truncationMode(.tail)
 
-            icon
-                .padding(.bottom, 3)
+            HStack(spacing: 4) {
+                accessories
+            }
+            .font(.caption)
+            .fixedSize(horizontal: true, vertical: false)
 
             Spacer()
         }
+        .padding(.top, 2)
+        .padding(.bottom, 5)
+    }
+}
+
+struct CalendarTitleIndicator: View {
+    let symbol: RmbSymbol
+    let helpText: String
+    let text: String?
+
+    init(symbol: RmbSymbol, helpText: String, text: String? = nil) {
+        self.symbol = symbol
+        self.helpText = helpText
+        self.text = text
+    }
+
+    var body: some View {
+        HStack(spacing: 2) {
+            Image(rmbSymbol: symbol)
+                .font(.system(size: 9))
+            if let text {
+                Text(text)
+                    .font(.system(size: 9))
+            }
+        }
+        .foregroundStyle(.secondary)
+        .padding(.horizontal, 5)
+        .padding(.vertical, 2)
+        .background(
+            Capsule()
+                .fill(Color.secondary.opacity(0.08))
+        )
+        .help(helpText)
     }
 }
 
```

---

### Incident Patch 2: `2a69cd16` (2026-10-03)
**Commit Message**: Minor UI improvement for External Links to enhance consistency

**File**: `reminders-menubar/Resources/Localizable.xcstrings` (modified, +0/-125)
```diff
@@ -6001,131 +6001,6 @@
         }
       }
     },
-    "editReminderExternalLinksEmptyMessage" : {
-      "extractionState" : "manual",
-      "localizations" : {
-        "cs" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Žádné"
-          }
-        },
-        "de" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Keine"
-          }
-        },
-        "en" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "None"
-          }
-        },
-        "es-419" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Ninguno"
-          }
-        },
-        "fil-PH" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Wala"
-          }
-        },
-        "fr" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Aucun"
-          }
-        },
-        "id" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Tidak ada"
-          }
-        },
-        "it" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Nessuno"
-          }
-        },
-        "ja" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "なし"
-          }
-        },
-        "ko" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "없음"
-          }
-        },
-        "nl" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Geen"
-          }
-        },
-        "pl" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Brak"
-          }
-        },
-        "pt-BR" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Nenhum"
-          }
-        },
-        "ru" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Нет"
-          }
-        },
-        "sk" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Žiadne"
-          }
-        },
-        "tr" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Yok"
-          }
-        },
-        "uk" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Немає"
-          }
-        },
-        "vi" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Không có"
-          }
-        },
-        "zh-Hans" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "无"
-          }
-        },
-        "zh-Hant" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "無"
-          }
-        }
-      }
-    },
     "editReminderExternalLinksViewOnlyLabel" : {
       "extractionState" : "manual",
       "localizations" : {
```

**File**: `reminders-menubar/Resources/remindersLocalized.swift` (modified, +0/-1)
```diff
@@ -8,7 +8,6 @@ enum RemindersMenuBarLocalizedKeys: String {
     case remindersOptionsButtonHelp
     case editReminderButton
     case editReminderTitleTextFieldPlaceholder
-    case editReminderExternalLinksEmptyMessage
     case editReminderExternalLinksViewOnlyLabel
     case editReminderNotesTextFieldPlaceholder
     case editReminderTagsTextFieldPlaceholder
```

**File**: `reminders-menubar/Views/ReminderEditView/ReminderEditView.swift` (modified, +3/-7)
```diff
@@ -116,7 +116,7 @@ struct ReminderEditView: View {
             actionButtons()
         }
         .frame(width: 300, alignment: .top)
-        .frame(minHeight: 410)
+        .frame(minHeight: 360)
         .fixedSize(horizontal: false, vertical: true)
         .padding()
         .modifier(RmbBackgroundModifier())
@@ -218,13 +218,9 @@ struct ReminderEditView: View {
                 .frame(width: 20)
 
             VStack(alignment: .leading, spacing: 6) {
-                Text(rmbLocalized(.editReminderExternalLinksViewOnlyLabel))
-                    .font(.system(size: 12))
-                    .foregroundColor(.secondary)
-
                 if externalLinks.isEmpty {
-                    Text(rmbLocalized(.editReminderExternalLinksEmptyMessage))
-                        .font(.footnote)
+                    Text(rmbLocalized(.editReminderExternalLinksViewOnlyLabel))
+                        .font(.system(size: 11))
                         .foregroundColor(.secondary)
                 } else {
                     ReminderExternalLinksView(
```

---

### Incident Patch 3: `d1d1dfe4` (2026-10-03)
**Commit Message**: Fix bug where tag lists might not be displayed when combined with calendar list filter

**File**: `reminders-menubar/Services/RemindersService.swift` (modified, +6/-3)
```diff
@@ -205,10 +205,13 @@ class RemindersService {
 
         var calendars: [EKCalendar]?
         if let calendarIdentifiers {
-            if calendarIdentifiers.isEmpty {
-                return []
+            let selectedCalendars = getCalendars().filter {
+                calendarIdentifiers.contains($0.calendarIdentifier)
             }
-            calendars = getCalendars().filter({ calendarIdentifiers.contains($0.calendarIdentifier) })
+            guard !selectedCalendars.isEmpty else {
+                return tags.map { TagReminderList(for: $0, with: []) }
+            }
+            calendars = selectedCalendars
         }
 
         let predicate = eventStore.predicateForIncompleteReminders(
```

---

### Incident Patch 4: `3c860bce` (2026-10-03)
**Commit Message**: Fix bug where child reminders in tag lists might not be displayed

**File**: `reminders-menubar/Services/RemindersService.swift` (modified, +9/-6)
```diff
@@ -54,13 +54,16 @@ class RemindersService {
         }
     }
 
-    private func createReminderItems(for calendarReminders: [EKReminder]) -> [ReminderItem] {
+    private func createReminderItems(for reminders: [EKReminder]) -> [ReminderItem] {
         var reminderItems: [ReminderItem] = []
-        
-        let noParentKey = "noParentKey"
-        let remindersByParentId = Dictionary(grouping: calendarReminders, by: { $0.parentId ?? noParentKey })
-        let parentReminders = remindersByParentId[noParentKey, default: []]
-        
+
+        let reminderIds = Set(reminders.map(\.calendarItemIdentifier))
+        let remindersByParentId = Dictionary(grouping: reminders, by: { $0.parentId })
+        let parentReminders = reminders.filter { reminder in
+            guard let parentId = reminder.parentId else { return true }
+            return !reminderIds.contains(parentId)
+        }
+
         parentReminders.forEach { parentReminder in
             let parentId = parentReminder.calendarItemIdentifier
             let children = remindersByParentId[parentId, default: []].map({ ReminderItem(for: $0, isChild: true) })
```

---

### Incident Patch 5: `9081e03c` (2026-09-19)
**Commit Message**: Fix deprecated menuStyle with showsMenuIndicator usage

**File**: `reminders-menubar/Views/ReminderItemView/ReminderEllipsisMenuView/ReminderEllipsisMenuView.swift` (modified, +2/-1)
```diff
@@ -27,7 +27,8 @@ struct ReminderEllipsisMenuView: View {
         } label: {
             Image(rmbSymbol: .ellipsis)
         }
-        .menuStyle(BorderlessButtonMenuStyle(showsMenuIndicator: false))
+        .menuStyle(.borderlessButton)
+        .menuIndicator(.hidden)
         .frame(width: 16, height: 16)
         .padding(.top, 1)
         .padding(.trailing, 6)
```

---

### Incident Patch 6: `03c1b8b5` (2026-09-08)
**Commit Message**: Fix long localizable key name

**File**: `reminders-menubar/Resources/Localizable.xcstrings` (modified, +8/-8)
```diff
@@ -9751,7 +9751,7 @@
         }
       }
     },
-    "keyboardTypingShortcutsDateDescription" : {
+    "keyboardSmartTypingDateDescription" : {
       "extractionState" : "manual",
       "localizations" : {
         "cs" : {
@@ -9876,7 +9876,7 @@
         }
       }
     },
-    "keyboardTypingShortcutsFlagDescription" : {
+    "keyboardSmartTypingFlagDescription" : {
       "extractionState" : "manual",
       "localizations" : {
         "cs" : {
@@ -10001,7 +10001,7 @@
         }
       }
     },
-    "keyboardTypingShortcutsListDescription" : {
+    "keyboardSmartTypingListDescription" : {
       "extractionState" : "manual",
       "localizations" : {
         "cs" : {
@@ -10126,7 +10126,7 @@
         }
       }
     },
-    "keyboardTypingShortcutsNote" : {
+    "keyboardSmartTypingNote" : {
       "extractionState" : "manual",
       "localizations" : {
         "cs" : {
@@ -10251,7 +10251,7 @@
         }
       }
     },
-    "keyboardTypingShortcutsPriorityDescription" : {
+    "keyboardSmartTypingPriorityDescription" : {
       "extractionState" : "manual",
       "localizations" : {
         "cs" : {
@@ -10376,7 +10376,7 @@
         }
       }
     },
-    "keyboardTypingShortcutsSettingsLabel" : {
+    "keyboardSmartTypingSettingsLabel" : {
       "extractionState" : "manual",
       "localizations" : {
         "cs" : {
@@ -10501,7 +10501,7 @@
         }
       }
     },
-    "keyboardTypingShortcutsTagDescription" : {
+    "keyboardSmartTypingTagDescription" : {
       "extractionState" : "manual",
       "localizations" : {
         "cs" : {
@@ -10626,7 +10626,7 @@
         }
       }
     },
-    "keyboardTypingShortcutsUrgentDescription" : {
+    "keyboardSmartTypingUrgentDescription" : {
       "extractionState" : "manual",
       "localizations" : {
         "cs" : {
```

**File**: `reminders-menubar/Resources/remindersLocalized.swift` (modified, +8/-8)
```diff
@@ -82,14 +82,14 @@ enum RemindersMenuBarLocalizedKeys: String {
     case updateLaterButton
     case keyboardShortcutEnableOpenShortcutOption
     case keyboardShortcutRestoreDefaultButton
-    case keyboardTypingShortcutsSettingsLabel
-    case keyboardTypingShortcutsNote
-    case keyboardTypingShortcutsDateDescription
-    case keyboardTypingShortcutsListDescription
-    case keyboardTypingShortcutsPriorityDescription
-    case keyboardTypingShortcutsFlagDescription
-    case keyboardTypingShortcutsUrgentDescription
-    case keyboardTypingShortcutsTagDescription
+    case keyboardSmartTypingSettingsLabel
+    case keyboardSmartTypingNote
+    case keyboardSmartTypingDateDescription
+    case keyboardSmartTypingListDescription
+    case keyboardSmartTypingPriorityDescription
+    case keyboardSmartTypingFlagDescription
+    case keyboardSmartTypingUrgentDescription
+    case keyboardSmartTypingTagDescription
     case upcomingRemindersDueFilterOption
     case upcomingRemindersTodayFilterOption
     case upcomingRemindersInAWeekFilterOption
```

**File**: `reminders-menubar/Views/SettingsView/KeyboardSettingsTab.swift` (modified, +8/-8)
```diff
@@ -40,38 +40,38 @@ struct KeyboardSettingsTab: View {
 
             SettingsDivider()
 
-            SettingsSection(rmbLocalized(.keyboardTypingShortcutsSettingsLabel)) {
-                Text(rmbLocalized(.keyboardTypingShortcutsNote))
+            SettingsSection(rmbLocalized(.keyboardSmartTypingSettingsLabel)) {
+                Text(rmbLocalized(.keyboardSmartTypingNote))
 
                 TypingShortcutRow(
                     shortcuts: [dateShortcutExample],
-                    description: rmbLocalized(.keyboardTypingShortcutsDateDescription),
+                    description: rmbLocalized(.keyboardSmartTypingDateDescription),
                     highlightColor: .rmbColor(.dateHighlight)
                 )
                 TypingShortcutRow(
                     shortcuts: ["@work", "/personal"],
-                    description: rmbLocalized(.keyboardTypingShortcutsListDescription)
+                    description: rmbLocalized(.keyboardSmartTypingListDescription)
                 )
                 TypingShortcutRow(
                     shortcuts: ["!", "!!", "!!!"],
-                    description: rmbLocalized(.keyboardTypingShortcutsPriorityDescription),
+                    description: rmbLocalized(.keyboardSmartTypingPriorityDescription),
                     highlightColor: .rmbColor(.priorityHighlight)
                 )
                 TypingShortcutRow(
                     shortcuts: ["!f"],
-                    description: rmbLocalized(.keyboardTypingShortcutsFlagDescription),
+                    description: rmbLocalized(.keyboardSmartTypingFlagDescription),
                     highlightColor: .rmbColor(.flaggedHighlight)
                 )
                 if #available(macOS 26, *) {
                     TypingShortcutRow(
                         shortcuts: ["!u"],
-                        description: rmbLocalized(.keyboardTypingShortcutsUrgentDescription),
+                        description: rmbLocalized(.keyboardSmartTypingUrgentDescription),
                         highlightColor: .rmbColor(.urgentHighlight)
                     )
                 }
                 TypingShortcutRow(
                     shortcuts: ["#tag"],
-                    description: rmbLocalized(.keyboardTypingShortcutsTagDescription),
+                    description: rmbLocalized(.keyboardSmartTypingTagDescription),
                     highlightColor: .rmbColor(.tagHighlight)
                 )
             }
```

---

### Incident Patch 7: `960a46ed` (2026-09-06)
**Commit Message**: Add option to close popover after creating a reminder - Fix #316

**File**: `reminders-menubar/Resources/Localizable.xcstrings` (modified, +250/-0)
```diff
@@ -13029,6 +13029,256 @@
         }
       }
     },
+    "newReminderClosePopoverNote" : {
+      "extractionState" : "manual",
+      "localizations" : {
+        "cs" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Užitečné pro rychlé vytvoření připomínky bez další interakce. Po uložení znovu otevřete okno, pokud chcete připomínky zobrazit, upravit nebo přidat."
+          }
+        },
+        "de" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Nützlich, um schnell eine Erinnerung ohne weitere Interaktion zu erstellen. Öffne nach dem Sichern das Fenster erneut, um Erinnerungen anzuzeigen, zu bearbeiten oder hinzuzufügen."
+          }
+        },
+        "en" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Useful for quickly creating a reminder without further interaction. After saving, reopen the window to view, edit, or add reminders."
+          }
+        },
+        "es-419" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Útil para crear rápidamente un recordatorio sin más interacción. Después de guardarlo, vuelve a abrir la ventana para ver, editar o agregar recordatorios."
+          }
+        },
+        "fil-PH" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Kapaki-pakinabang para sa mabilis na paggawa ng paalala nang walang karagdagang interaksiyon. Pagkatapos mag-save, buksang muli ang window para tingnan, i-edit, o magdagdag ng mga paalala."
+          }
+        },
+        "fr" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Permet de créer rapidement un rappel sans autre interaction. Après l’enregistrement, rouvrez la fenêtre pour consulter, modifier ou ajouter des rappels."
+          }
+        },
+        "id" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Berguna untuk membuat pengingat dengan cepat tanpa interaksi lebih lanjut. Setelah menyimpan, buka kembali jendela untuk melihat, mengedit, atau menambahkan pengingat."
+          }
+        },
+        "it" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Utile per creare rapidamente un promemoria senza ulteriori interazioni. Dopo il salvataggio, riapri la finestra per visualizzare, modificare o aggiungere promemoria."
+          }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "追加の操作をせずにリマインダーをすばやく作成する場合に便利です。保存後にリマインダーを表示、編集、追加するには、ウインドウをもう一度開いてください。"
+          }
+        },
+        "ko" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "추가 작업 없이 미리 알림을 빠르게 생성할 때 유용합니다. 저장 후 미리 알림을 보거나 편집하거나 추가하려면 윈도우를 다시 여십시오."
+          }
+        },
+        "nl" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Handig om snel een herinnering aan te maken zonder verdere interactie. Open na het bewaren het venster opnieuw om herinneringen te bekijken, te bewerken of toe te voegen."
+          }
+        },
+        "pl" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Przydatne do szybkiego tworzenia przypomnienia bez dalszej interakcji. Po zapisaniu otwórz okno ponownie, aby wyświetlić, edytować lub dodać przypomnienia."
+          }
+        },
+        "pt-BR" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Útil para criar rapidamente um lembrete sem outras interações. Após salvar, reabra a janela para visualizar, editar ou adicionar lembretes."
+          }
+        },
+        "ru" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Удобно для быстрого создания напоминания без дальнейших действий. После сохранения снова откройте окно, чтобы просмотреть, изменить или добавить напоминания."
+          }
+        },
+        "sk" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Užitočné na rýchle vytvorenie pripomienky bez ďalšej interakcie. Po uložení znova otvorte okno, ak chcete pripomienky zobraziť, upraviť alebo pridať."
+          }
+        },
+        "tr" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Başka bir işlem yapmadan hızlıca anımsatıcı oluşturmak için kullanışlıdır. Kaydettikten sonra anımsatıcıları görüntülemek, düzenlemek veya eklemek için pencereyi yeniden açın."
+          }
+        },
+        "uk" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Зручно для швидкого створення нагадування без подальшої взаємодії. Після збереження знову відкрийте вікно, щоб переглянути, відредагувати або додати нагадування."
+          }
+        },
+        "vi" :
```

**File**: `reminders-menubar/Resources/remindersLocalized.swift` (modified, +2/-0)
```diff
@@ -3,6 +3,8 @@ import Foundation
 enum RemindersMenuBarLocalizedKeys: String {
     case newReminderSettingsLabel
     case newReminderAutoSuggestTodayOption
+    case newReminderClosePopoverOption
+    case newReminderClosePopoverNote
     case remindersOptionsButtonHelp
     case editReminderButton
     case editReminderTitleTextFieldPlaceholder
```

**File**: `reminders-menubar/Services/UserPreferences.swift` (modified, +12/-0)
```diff
@@ -5,6 +5,7 @@ private enum PreferencesKeys {
     static let calendarIdentifiersFilter = "calendarIdentifiersFilter"
     static let calendarIdentifierForSaving = "calendarIdentifierForSaving"
     static let autoSuggestTodayForNewReminders = "autoSuggestTodayForNewReminders"
+    static let closePopoverAfterCreatingReminder = "closePopoverAfterCreatingReminder"
     static let rmbColorScheme = "rmbColorScheme"
     static let preferTransparentBackground = "backgroundIsTransparent"
     static let showUpcomingReminders = "showUpcomingReminders"
@@ -94,6 +95,17 @@ class UserPreferences: ObservableObject {
             UserPreferences.defaults.set(autoSuggestToday, forKey: PreferencesKeys.autoSuggestTodayForNewReminders)
         }
     }
+
+    @Published var closePopoverAfterCreatingReminder: Bool = {
+        return defaults.bool(forKey: PreferencesKeys.closePopoverAfterCreatingReminder)
+    }() {
+        didSet {
+            UserPreferences.defaults.set(
+                closePopoverAfterCreatingReminder,
+                forKey: PreferencesKeys.closePopoverAfterCreatingReminder
+            )
+        }
+    }
     
     @Published var upcomingRemindersInterval: ReminderInterval = {
         guard let intervalData = defaults.data(forKey: PreferencesKeys.upcomingRemindersInterval),
```

**File**: `reminders-menubar/Views/ReminderEditView/ReminderEditView.swift` (modified, +3/-0)
```diff
@@ -377,6 +377,9 @@ struct ReminderEditView: View {
         if case .create = mode {
             RemindersService.shared.createNew(with: rmbReminder, in: calendar)
             remindersData.calendarForSaving = calendar
+            if userPreferences.closePopoverAfterCreatingReminder {
+                AppDelegate.shared.popover.performClose(nil)
+            }
         } else if case .edit(let ekReminder, _) = mode {
             ekReminder.update(with: rmbReminder)
             if ekReminder.hasChanges || rmbReminder.hasPrivateApiChanges {
```

**File**: `reminders-menubar/Views/SettingsView/ReminderSettingsTab.swift` (modified, +9/-0)
```diff
@@ -10,6 +10,15 @@ struct ReminderSettingsTab: View {
                     rmbLocalized(.newReminderAutoSuggestTodayOption),
                     isOn: $userPreferences.autoSuggestToday
                 )
+
+                Toggle(
+                    rmbLocalized(.newReminderClosePopoverOption),
+                    isOn: $userPreferences.closePopoverAfterCreatingReminder
+                )
+
+                Text(rmbLocalized(.newReminderClosePopoverNote))
+                    .modifier(SettingsNoteStyle())
+                    .padding(.leading, 20)
             }
 
             SettingsDivider()
```

---

### Incident Patch 8: `669051c4` (2026-09-06)
**Commit Message**: Add show notes in ReminderItemView + visibility setting - Fix #308

**File**: `reminders-menubar/Extensions/String+Extensions.swift` (modified, +6/-8)
```diff
@@ -22,20 +22,18 @@ extension String {
         return NSRange(location: 0, length: endIndex.utf16Offset(in: self))
     }
     
-    func toDetectedLinkAttributedString() -> String {
+    @available(macOS 12, *)
+    func toDetectedLinkAttributedString() -> AttributedString {
         let range = NSRange(self.startIndex..., in: self)
         let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue)
-        guard let matches = detector?.matches(in: self, options: [], range: range), !matches.isEmpty else {
-            return self
-        }
-        
         let attributedString = NSMutableAttributedString(string: self)
-        for match in matches {
+
+        for match in detector?.matches(in: self, options: [], range: range) ?? [] {
             if let url = match.url {
                 attributedString.addAttribute(.link, value: url, range: match.range)
             }
         }
-        
-        return attributedString.string
+
+        return AttributedString(attributedString)
     }
 }
```

**File**: `reminders-menubar/Resources/Localizable.xcstrings` (modified, +250/-0)
```diff
@@ -20960,6 +20960,256 @@
         }
       }
     },
+    "showNotesInReminderItemNote" : {
+      "extractionState" : "manual",
+      "localizations" : {
+        "cs" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Náhledy poznámek jsou omezeny na dva řádky. Úplné poznámky jsou vždy viditelné při otevření připomínky."
+          }
+        },
+        "de" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Notizvorschauen sind auf zwei Zeilen begrenzt. Vollständige Notizen sind beim Öffnen einer Erinnerung immer sichtbar."
+          }
+        },
+        "en" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Note previews are limited to two lines. Full notes are always visible when opening a reminder."
+          }
+        },
+        "es-419" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Las vistas previas de las notas están limitadas a dos líneas. Las notas completas siempre están visibles al abrir un recordatorio."
+          }
+        },
+        "fil-PH" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Limitado sa dalawang linya ang mga preview ng tala. Palaging makikita ang buong tala kapag binuksan ang isang paalala."
+          }
+        },
+        "fr" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Les aperçus des notes sont limités à deux lignes. Les notes complètes sont toujours visibles lors de l’ouverture d’un rappel."
+          }
+        },
+        "id" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Pratinjau catatan dibatasi hingga dua baris. Catatan lengkap selalu terlihat saat membuka pengingat."
+          }
+        },
+        "it" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Le anteprime delle note sono limitate a due righe. Le note complete sono sempre visibili quando si apre un promemoria."
+          }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "メモのプレビューは2行まで表示されます。リマインダーを開くと、メモの全文をいつでも確認できます。"
+          }
+        },
+        "ko" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "메모 미리보기는 두 줄로 제한됩니다. 미리 알림을 열면 전체 메모가 항상 표시됩니다."
+          }
+        },
+        "nl" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Voorvertoningen van notities zijn beperkt tot twee regels. Volledige notities zijn altijd zichtbaar wanneer je een herinnering opent."
+          }
+        },
+        "pl" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Podglądy notatek są ograniczone do dwóch wierszy. Pełne notatki są zawsze widoczne po otwarciu przypomnienia."
+          }
+        },
+        "pt-BR" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "As prévias das notas são limitadas a duas linhas. As notas completas estão sempre visíveis ao abrir um lembrete."
+          }
+        },
+        "ru" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Предварительный просмотр заметок ограничен двумя строками. Полные заметки всегда видны при открытии напоминания."
+          }
+        },
+        "sk" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Náhľady poznámok sú obmedzené na dva riadky. Úplné poznámky sú vždy viditeľné pri otvorení pripomienky."
+          }
+        },
+        "tr" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Not önizlemeleri iki satırla sınırlıdır. Bir hatırlatıcı açıldığında notların tamamı her zaman görünür."
+          }
+        },
+        "uk" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Попередній перегляд нотаток обмежено двома рядками. Повні нотатки завжди видно після відкриття нагадування."
+          }
+        },
+        "vi" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Bản xem trước ghi chú được giới hạn ở hai dòng. Ghi chú đầy đủ luôn hiển thị khi mở lời nhắc."
+          }
+        },
+        "zh-Hans" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "备注预览最多显示两行。打开提醒事项时始终可以查看完整备注。"
+          }
+        },
+        "zh-Hant" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "備註預覽最多顯示兩行。打開提醒事項時始終可以查看完整備註。"
+          }
+        }
+      }
+    },
+    "showNotesInReminderItemOption" : {
+      "extractionState" : "manual",
+      "localizations" : {
+        "cs" : {
+          "stringUnit" : {
+            "state" : "translated",
+       
```

**File**: `reminders-menubar/Resources/remindersLocalized.swift` (modified, +2/-0)
```diff
@@ -135,6 +135,8 @@ enum RemindersMenuBarLocalizedKeys: String {
     case reminderDisplaySettingsLabel
     case showExternalLinksInReminderItemOption
     case showExternalLinksInReminderItemNote
+    case showNotesInReminderItemOption
+    case showNotesInReminderItemNote
     case completionSettingsLabel
     case completionAnimationSettingsOption
     case completionAnimationSettingsNote
```

**File**: `reminders-menubar/Services/UserPreferences.swift` (modified, +9/-0)
```diff
@@ -23,6 +23,7 @@ private enum PreferencesKeys {
     static let reminderSortingOrder = "reminderSortingOrder"
     static let timeFormatIs24Hour = "timeFormatIs24Hour"
     static let showExternalLinksInReminderItem = "showExternalLinksInReminderItem"
+    static let showNotesInReminderItem = "showNotesInReminderItem"
     static let menuBarReminderPreviewEnabled = "menuBarReminderPreviewEnabled"
     static let menuBarReminderPreviewTimeAhead = "menuBarReminderPreviewTimeAhead"
     static let menuBarReminderPreviewMaxLength = "menuBarReminderPreviewMaxLength"
@@ -169,6 +170,14 @@ class UserPreferences: ObservableObject {
             )
         }
     }
+
+    @Published var showNotesInReminderItem: Bool = {
+        return defaults.bool(forKey: PreferencesKeys.showNotesInReminderItem)
+    }() {
+        didSet {
+            UserPreferences.defaults.set(showNotesInReminderItem, forKey: PreferencesKeys.showNotesInReminderItem)
+        }
+    }
     
     @Published var completionAnimationEnabled: Bool = {
         return defaults.boolWithDefaultValueTrue(forKey: PreferencesKeys.completionAnimationEnabled)
```

**File**: `reminders-menubar/Views/ReminderItemView/ReminderItemView.swift` (modified, +29/-2)
```diff
@@ -40,7 +40,10 @@ struct ReminderItemView: View {
             ReminderCompleteButton(reminderItem: reminderItem, isPendingCompletion: $isPendingCompletion)
 
             VStack(spacing: 4) {
-                reminderTitleRow()
+                VStack(spacing: 2) {
+                    reminderTitleRow()
+                    reminderNotesText()
+                }
 
                 if #available(macOS 12, *), !reminderItem.reminder.ekTags.isEmpty {
                     ReminderTagsView(tagNames: reminderItem.reminder.ekTags.map(\.name))
@@ -147,8 +150,16 @@ struct ReminderItemView: View {
         }
     }
 
+    private func detectedLinkText(_ string: String) -> Text {
+        if #available(macOS 12, *) {
+            return Text(string.toDetectedLinkAttributedString())
+        }
+
+        return Text(verbatim: string)
+    }
+
     private func reminderTitleText() -> Text {
-        let titleText = Text(LocalizedStringKey(reminderItem.reminder.title.toDetectedLinkAttributedString()))
+        let titleText = detectedLinkText(reminderItem.reminder.title)
 
         var prefixes: [(symbol: RmbSymbol, color: Color)] = []
         if reminderItem.reminder.isFlagged {
@@ -221,6 +232,21 @@ struct ReminderItemView: View {
         }
     }
 
+    @ViewBuilder
+    private func reminderNotesText() -> some View {
+        if userPreferences.showNotesInReminderItem,
+           let notes = reminderItem.reminder.notes,
+           !notes.isEmpty {
+            detectedLinkText(notes)
+                .font(.footnote)
+                .foregroundColor(.secondary)
+                .lineLimit(2)
+                .truncationMode(.tail)
+                .frame(maxWidth: .infinity, alignment: .leading)
+                .padding(.trailing, 22)
+        }
+    }
+
     @ViewBuilder
     private func calendarTitleText() -> some View {
         Text(reminderItem.reminder.calendar.title)
@@ -269,6 +295,7 @@ struct ReminderItemView: View {
 
         let reminder = EKReminder(eventStore: .init())
         reminder.title = "Look for awesome projects on GitHub"
+        reminder.notes = "Review the repository documentation and recent changes."
         reminder.isCompleted = false
         reminder.calendar = calendar
         reminder.addDueDateAndAlarm(for: Date().addingTimeInterval(86_400), withTime: false)
```

**File**: `reminders-menubar/Views/SettingsView/ReminderSettingsTab.swift` (modified, +9/-0)
```diff
@@ -15,6 +15,15 @@ struct ReminderSettingsTab: View {
             SettingsDivider()
 
             SettingsSection(rmbLocalized(.reminderDisplaySettingsLabel)) {
+                Toggle(
+                    rmbLocalized(.showNotesInReminderItemOption),
+                    isOn: $userPreferences.showNotesInReminderItem
+                )
+
+                Text(rmbLocalized(.showNotesInReminderItemNote))
+                    .modifier(SettingsNoteStyle())
+                    .padding(.leading, 20)
+
                 Toggle(
                     rmbLocalized(.showExternalLinksInReminderItemOption),
                     isOn: $userPreferences.showExternalLinksInReminderItem
```

---

### Incident Patch 9: `68d8d86b` (2026-09-05)
**Commit Message**: Refactor TagTextField to improve UX

**File**: `reminders-menubar/Views/ReminderEditView/ReminderTagsEditView.swift` (modified, +190/-73)
```diff
@@ -3,7 +3,7 @@ import SwiftUI
 struct ReminderTagsEditView: View {
     let tagNames: [String]
     let onCommitTag: (String) -> Void
-    var onCommitEmpty: (() -> Void)?
+    var onCommitEmpty: () -> Void
     let onRemoveTag: (String) -> Void
     let onRemoveLastTag: () -> Void
     @Binding var focusTrigger: UUID?
@@ -18,35 +18,58 @@ struct ReminderTagsEditView: View {
                 .foregroundColor(.secondary)
                 .frame(width: 20)
 
-            ScrollView(.horizontal, showsIndicators: false) {
-                HStack(alignment: .center, spacing: 4) {
-                    ForEach(tagNames, id: \.self) { tag in
-                        TagPillView(name: tag, onRemove: { onRemoveTag(tag) })
+            ScrollViewReader { scrollProxy in
+                ScrollView(.horizontal, showsIndicators: false) {
+                    HStack(alignment: .center, spacing: 4) {
+                        ForEach(tagNames, id: \.self) { tag in
+                            TagPillView(name: tag, onRemove: { onRemoveTag(tag) })
+                        }
+
+                        TagTextField(
+                            text: $newTagText,
+                            placeholder: rmbLocalized(.editReminderTagsTextFieldPlaceholder),
+                            onCommit: commitTag,
+                            onCommitEmpty: onCommitEmpty,
+                            onDeleteBackward: onRemoveLastTag,
+                            autoCompleteSuggestions: { TagParser.autoCompleteSuggestions($0) },
+                            focusTrigger: $focusTrigger,
+                            onMoveFocus: onMoveFocus
+                        )
+                        .frame(minWidth: 60)
+                        .frame(height: 20)
+
+                        Color.clear
+                            .frame(width: 1, height: 1)
+                            .id(ScrollAnchor.trailing)
                     }
-
-                    TagTextField(
-                        text: $newTagText,
-                        placeholder: rmbLocalized(.editReminderTagsTextFieldPlaceholder),
-                        onCommit: commitTag,
-                        onCommitEmpty: onCommitEmpty,
-                        onDeleteBackward: onRemoveLastTag,
-                        autoCompleteSuggestions: { TagParser.autoCompleteSuggestions($0) },
-                        focusTrigger: $focusTrigger,
-                        onMoveFocus: onMoveFocus
-                    )
-                    .frame(minWidth: 60, maxWidth: 120)
-                    .frame(height: 20)
                 }
+                .onChange(of: newTagText) { _ in scrollToEnd(using: scrollProxy) }
+                .onChange(of: tagNames) { _ in scrollToEnd(using: scrollProxy) }
+                .onChange(of: focusTrigger) { _ in scrollToEnd(using: scrollProxy) }
             }
         }
     }
 
+    // MARK: - Actions
+
     private func commitTag() {
         onCommitTag(newTagText)
         newTagText = ""
     }
+
+    private func scrollToEnd(using proxy: ScrollViewProxy) {
+        DispatchQueue.main.async {
+            proxy.scrollTo(ScrollAnchor.trailing, anchor: .trailing)
+        }
+    }
+
+    private enum ScrollAnchor {
+        case trailing
+    }
 }
 
+// MARK: - Tag pill
+
 private struct TagPillView: View {
     let name: String
     let onRemove: () -> Void
@@ -67,10 +90,13 @@ private struct TagPillView: View {
     }
 }
 
+// MARK: - Preview
+
 #Preview {
     ReminderTagsEditView(
         tagNames: ["sample", "review", "important"],
         onCommitTag: { _ in },
+        onCommitEmpty: { },
         onRemoveTag: { _ in },
         onRemoveLastTag: {},
         focusTrigger: .constant(nil),
@@ -84,48 +110,52 @@ private struct TagTextField: NSViewRepresentable {
     @Binding var text: String
     var placeholder: String
     var onCommit: () -> Void
-    var onCommitEmpty: (() -> Void)?
+    var onCommitEmpty: () -> Void
     var onDeleteBackward: () -> Void
-    var autoCompleteSuggestions: ((_ typingWord: String) -> [String])?
+    var autoCompleteSuggestions: (_ typingWord: String) -> [String]
     @Binding var focusTrigger: UUID?
     var onMoveFocus: (FocusDirection) -> Void
 
-    func makeNSView(context: Context) -> NSTextField {
-        let textField = NSTextField()
-        textField.placeholderString = placeholder
-        textField.isBordered = false
-        textField.drawsBackground = false
-        textField.font = .systemFont(ofSize: 11)
-        textField.cell?.usesSingleLineMode = true
-        textField.cell?.wraps = false
-        textField.cell?.isScrollable = true
-        textField.lineBreakMode = .byClipping
-        textField.delegate = context.coordinator
-        return textField
+    // MARK: - NSViewRepresentable
+
+    func makeNSView(context: Context) -> TagNSTextView {
+        let textView = TagNSTextView()
+        textView.placeholder = placeholder
+        textView.textContainer?.maximumNumberOfLines = 1
+  
```

---

### Incident Patch 10: `81cbc031` (2026-09-04)
**Commit Message**: Add focus handling using tab or backtab for ReminderEditView - Fix #310

**File**: `reminders-menubar.xcodeproj/project.pbxproj` (modified, +4/-0)
```diff
@@ -127,6 +127,7 @@
 		71F93A632E03B6DA00D5C5BC /* ReminderDateDescriptionView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 71F93A622E03B6DA00D5C5BC /* ReminderDateDescriptionView.swift */; };
 		71F93A652E03B93100D5C5BC /* ReminderExternalLinksView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 71F93A642E03B93100D5C5BC /* ReminderExternalLinksView.swift */; };
 		71F9726A25981EDF00D0A118 /* NSTableView+Extensions.swift in Sources */ = {isa = PBXBuildFile; fileRef = 71F9726925981EDF00D0A118 /* NSTableView+Extensions.swift */; };
+		71FM00012FA9000100000001 /* FocusDirection.swift in Sources */ = {isa = PBXBuildFile; fileRef = 71FM00002FA9000100000001 /* FocusDirection.swift */; };
 		71FP00012FA9000100000001 /* FilterPanelController.swift in Sources */ = {isa = PBXBuildFile; fileRef = 71FP00002FA9000100000001 /* FilterPanelController.swift */; };
 		71FP00032FA9000100000001 /* FilterPanelContentView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 71FP00022FA9000100000001 /* FilterPanelContentView.swift */; };
 		71FS00012FA8000100000001 /* ReminderListSection.swift in Sources */ = {isa = PBXBuildFile; fileRef = 71FS00002FA8000100000001 /* ReminderListSection.swift */; };
@@ -278,6 +279,7 @@
 		71F93A622E03B6DA00D5C5BC /* ReminderDateDescriptionView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ReminderDateDescriptionView.swift; sourceTree = "<group>"; };
 		71F93A642E03B93100D5C5BC /* ReminderExternalLinksView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ReminderExternalLinksView.swift; sourceTree = "<group>"; };
 		71F9726925981EDF00D0A118 /* NSTableView+Extensions.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = "NSTableView+Extensions.swift"; sourceTree = "<group>"; };
+		71FM00002FA9000100000001 /* FocusDirection.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = FocusDirection.swift; sourceTree = "<group>"; };
 		71FP00002FA9000100000001 /* FilterPanelController.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = FilterPanelController.swift; sourceTree = "<group>"; };
 		71FP00022FA9000100000001 /* FilterPanelContentView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = FilterPanelContentView.swift; sourceTree = "<group>"; };
 		71FS00002FA8000100000001 /* ReminderListSection.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ReminderListSection.swift; sourceTree = "<group>"; };
@@ -379,6 +381,7 @@
 				718AE6D62F84A35D00B53E04 /* Modifiers */,
 				71B4AD4E25B7D06400214219 /* CalendarTitle.swift */,
 				71A000022F724B7500000001 /* ColoredDotTitle.swift */,
+				71FM00002FA9000100000001 /* FocusDirection.swift */,
 				71AABB002F8E5A0000000001 /* RemoveReminderAlert.swift */,
 				B55D54FD2F37E4E5002DE761 /* PopoverResizeHandleView.swift */,
 				714C28A72A0A056600734DAF /* RmbHighlightedTextField.swift */,
@@ -806,6 +809,7 @@
 				71CCF9842D43148100D334F8 /* EKReminderPriority+Extensions.swift in Sources */,
 				71E7126A2908C6D100DA97BD /* Binding+Extensions.swift in Sources */,
 				714C28A82A0A056600734DAF /* RmbHighlightedTextField.swift in Sources */,
+				71FM00012FA9000100000001 /* FocusDirection.swift in Sources */,
 				71A000032F724B7500000001 /* ColoredDotTitle.swift in Sources */,
 				718C0C632D43220A00BF04B0 /* PriorityParser.swift in Sources */,
 				71F93A632E03B6DA00D5C5BC /* ReminderDateDescriptionView.swift in Sources */,
```

**File**: `reminders-menubar/Views/Helpers/FocusDirection.swift` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+enum FocusDirection {
+    case forward
+    case backward
+
+    var offset: Int {
+        switch self {
+        case .forward:
+            return 1
+        case .backward:
+            return -1
+        }
+    }
+}
```

**File**: `reminders-menubar/Views/Helpers/RmbHighlightedTextField.swift` (modified, +42/-10)
```diff
@@ -11,11 +11,12 @@ struct RmbHighlightedTextField: NSViewRepresentable {
     var highlightedTexts: [HighlightedText]
     var textContainerDynamicHeight: Binding<CGFloat>?
     var maximumNumberOfLines: Int
-    var allowNewLineAndTab: Bool
-    var focusTrigger: Binding<UUID>?
+    var allowsLineBreaks: Bool
+    var focusTrigger: Binding<UUID?>?
 
     private var textFont = NSFont.systemFont(ofSize: NSFont.systemFontSize)
     private var onSubmit: (() -> Void)?
+    private var onMoveFocus: ((FocusDirection) -> Void)?
     private var onDidBecomeFirstResponder: ((NSTextView) -> Void)?
     private var isInitialCharValidToAutoComplete: ((_ initialChar: String?) -> Bool)?
     private var autoCompleteSuggestions: ((_ initialChar: String?, _ typingWord: String) -> [String])?
@@ -28,15 +29,15 @@ struct RmbHighlightedTextField: NSViewRepresentable {
         highlightedTexts: [HighlightedText] = [],
         textContainerDynamicHeight: Binding<CGFloat>? = nil,
         maximumNumberOfLines: Int = 3,
-        allowNewLineAndTab: Bool = false,
-        focusTrigger: Binding<UUID>? = nil
+        allowsLineBreaks: Bool = false,
+        focusTrigger: Binding<UUID?>? = nil
     ) {
         self.placeholder = placeholder
         self.text = text
         self.highlightedTexts = highlightedTexts
         self.textContainerDynamicHeight = textContainerDynamicHeight
         self.maximumNumberOfLines = maximumNumberOfLines
-        self.allowNewLineAndTab = allowNewLineAndTab
+        self.allowsLineBreaks = allowsLineBreaks
         self.focusTrigger = focusTrigger
     }
 
@@ -47,7 +48,7 @@ struct RmbHighlightedTextField: NSViewRepresentable {
         }
 
         textView.placeholder = placeholder
-        textView.shouldFocus = focusTrigger != nil
+        textView.shouldFocus = focusTrigger?.wrappedValue != nil
         textView.onDidBecomeFirstResponder = onDidBecomeFirstResponder
         textView.isEditable = true
         textView.isSelectable = true
@@ -182,6 +183,8 @@ struct RmbHighlightedTextField: NSViewRepresentable {
         var isDeletingText = false
         var lastFocusTrigger: UUID?
 
+        private let relevantModifiers: NSEvent.ModifierFlags = [.command, .option, .shift, .control]
+
         init(_ parent: RmbHighlightedTextField) {
             self.parent = parent
         }
@@ -192,20 +195,36 @@ struct RmbHighlightedTextField: NSViewRepresentable {
             switch commandSelector {
             case #selector(NSResponder.insertNewline(_:)):
                 return handleNewline()
+            case #selector(NSResponder.insertTab(_:)):
+                return handleFocusMove(.forward, expectedModifiers: [])
+            case #selector(NSResponder.insertBacktab(_:)):
+                return handleFocusMove(.backward, expectedModifiers: .shift)
             default:
                 return false
             }
         }
 
+        private func handleFocusMove(
+            _ direction: FocusDirection,
+            expectedModifiers: NSEvent.ModifierFlags
+        ) -> Bool {
+            let modifiers = NSApp.currentEvent?.modifierFlags.intersection(relevantModifiers) ?? []
+            guard modifiers == expectedModifiers, let onMoveFocus = parent.onMoveFocus else {
+                return false
+            }
+
+            onMoveFocus(direction)
+            return true
+        }
+
         private func handleNewline() -> Bool {
-            let relevantModifiers: NSEvent.ModifierFlags = [.command, .option, .shift, .control]
             let modifiers = NSApp.currentEvent?.modifierFlags.intersection(relevantModifiers) ?? []
 
-            if parent.allowNewLineAndTab, !modifiers.isEmpty {
+            if parent.allowsLineBreaks, modifiers == .shift {
                 return false
             }
 
-            guard let onSubmit = parent.onSubmit else {
+            guard let onSubmit = parent.onSubmit, modifiers.isEmpty else {
                 return false
             }
 
@@ -224,7 +243,12 @@ struct RmbHighlightedTextField: NSViewRepresentable {
 
             isDeletingText = replacementString.isEmpty && affectedCharRange.length > 0
 
-            if !parent.allowNewLineAndTab && (replacementString == "\n" || replacementString == "\t") {
+            if replacementString == "\n" {
+                let modifiers = NSApp.currentEvent?.modifierFlags.intersection(relevantModifiers)
+                return parent.allowsLineBreaks && modifiers == .shift
+            }
+
+            if replacementString == "\t" {
                 return false
             }
 
@@ -331,6 +355,14 @@ extension RmbHighlightedTextField {
         return view
     }
 
+    func onMoveFocus(
+        _ onMoveFocus: @escaping (FocusDirection) -> Void
+    ) -> RmbHighlightedTextField {
+        var view = self
+        view.onMoveFocus = onMoveFocus
+        return view
+    }
+
     func autoComplete(
         isInitialCharValid: @escaping (_ initialChar: String?) -> Bool,
         suggestions: @escaping (
```

**File**: `reminders-menubar/Views/ReminderEditView/ReminderEditView.swift` (modified, +48/-4)
```diff
@@ -16,7 +16,7 @@ struct ReminderEditView: View {
     let mode: Mode
     @State var rmbReminder: RmbReminder
 
-    @State var titleTextFieldFocusTrigger = UUID()
+    @StateObject private var focusCoordinator = ReminderEditFocusCoordinator()
     @State var titleTextFieldDynamicHeight = NSLayoutManager().defaultLineHeight(
         for: .preferredFont(forTextStyle: .title3)
     )
@@ -94,7 +94,9 @@ struct ReminderEditView: View {
                     onCommitTag: { rmbReminder.addTag(named: $0) },
                     onCommitEmpty: { confirmAction() },
                     onRemoveTag: { rmbReminder.removeTag(named: $0) },
-                    onRemoveLastTag: { rmbReminder.removeLastTag() }
+                    onRemoveLastTag: { rmbReminder.removeLastTag() },
+                    focusTrigger: $focusCoordinator.tagsTrigger,
+                    onMoveFocus: { focusCoordinator.moveFocus(from: .tags, direction: $0) }
                 )
             }
 
@@ -171,11 +173,12 @@ struct ReminderEditView: View {
             text: $rmbReminder.title,
             highlightedTexts: rmbReminder.highlightedTexts,
             textContainerDynamicHeight: $titleTextFieldDynamicHeight,
-            focusTrigger: $titleTextFieldFocusTrigger
+            focusTrigger: $focusCoordinator.titleTrigger
         )
         .onDidBecomeFirstResponder { textView in
             newReminderTypingCoordinator.replayPendingEvents(in: textView)
         }
+        .onMoveFocus { focusCoordinator.moveFocus(from: .title, direction: $0) }
         .onSubmit { confirmAction() }
         .autoComplete(
             isInitialCharValid: { char in
@@ -199,8 +202,10 @@ struct ReminderEditView: View {
             placeholder: rmbLocalized(.editReminderNotesTextFieldPlaceholder),
             text: Binding($rmbReminder.notes, replacingNilWith: ""),
             textContainerDynamicHeight: $notesTextFieldDynamicHeight,
-            allowNewLineAndTab: true
+            allowsLineBreaks: true,
+            focusTrigger: $focusCoordinator.notesTrigger
         )
+        .onMoveFocus { focusCoordinator.moveFocus(from: .notes, direction: $0) }
         .onSubmit { confirmAction() }
         .frame(height: notesTextFieldDynamicHeight)
     }
@@ -419,3 +424,42 @@ struct ReminderEditView: View {
     .environmentObject(RemindersData())
     .environmentObject(NewReminderTypingCoordinator())
 }
+
+// MARK: - Focus Coordinator
+
+private final class ReminderEditFocusCoordinator: ObservableObject {
+    enum Field: Equatable {
+        case title
+        case notes
+        case tags
+    }
+
+    @Published var titleTrigger: UUID? = UUID()
+    @Published var notesTrigger: UUID?
+    @Published var tagsTrigger: UUID?
+
+    private var fieldOrder: [Field] {
+        if #available(macOS 12, *) {
+            return [.title, .notes, .tags]
+        } else {
+            return [.title, .notes]
+        }
+    }
+
+    func moveFocus(from field: Field, direction: FocusDirection) {
+        guard let currentIndex = fieldOrder.firstIndex(of: field) else { return }
+        let destinationIndex = (currentIndex + direction.offset + fieldOrder.count) % fieldOrder.count
+        focus(fieldOrder[destinationIndex])
+    }
+
+    private func focus(_ field: Field) {
+        switch field {
+        case .title:
+            titleTrigger = UUID()
+        case .notes:
+            notesTrigger = UUID()
+        case .tags:
+            tagsTrigger = UUID()
+        }
+    }
+}
```

**File**: `reminders-menubar/Views/ReminderEditView/ReminderTagsEditView.swift` (modified, +54/-6)
```diff
@@ -6,6 +6,8 @@ struct ReminderTagsEditView: View {
     var onCommitEmpty: (() -> Void)?
     let onRemoveTag: (String) -> Void
     let onRemoveLastTag: () -> Void
+    @Binding var focusTrigger: UUID?
+    let onMoveFocus: (FocusDirection) -> Void
 
     @State private var newTagText = ""
 
@@ -28,7 +30,9 @@ struct ReminderTagsEditView: View {
                         onCommit: commitTag,
                         onCommitEmpty: onCommitEmpty,
                         onDeleteBackward: onRemoveLastTag,
-                        autoCompleteSuggestions: { TagParser.autoCompleteSuggestions($0) }
+                        autoCompleteSuggestions: { TagParser.autoCompleteSuggestions($0) },
+                        focusTrigger: $focusTrigger,
+                        onMoveFocus: onMoveFocus
                     )
                     .frame(minWidth: 60, maxWidth: 120)
                     .frame(height: 20)
@@ -68,7 +72,9 @@ private struct TagPillView: View {
         tagNames: ["sample", "review", "important"],
         onCommitTag: { _ in },
         onRemoveTag: { _ in },
-        onRemoveLastTag: {}
+        onRemoveLastTag: {},
+        focusTrigger: .constant(nil),
+        onMoveFocus: { _ in }
     )
 }
 
@@ -81,6 +87,8 @@ private struct TagTextField: NSViewRepresentable {
     var onCommitEmpty: (() -> Void)?
     var onDeleteBackward: () -> Void
     var autoCompleteSuggestions: ((_ typingWord: String) -> [String])?
+    @Binding var focusTrigger: UUID?
+    var onMoveFocus: (FocusDirection) -> Void
 
     func makeNSView(context: Context) -> NSTextField {
         let textField = NSTextField()
@@ -98,18 +106,38 @@ private struct TagTextField: NSViewRepresentable {
 
     func updateNSView(_ nsView: NSTextField, context: Context) {
         context.coordinator.parent = self
+
         if nsView.stringValue != text {
             nsView.stringValue = text
         }
+
+        updateFocusIfNeeded(in: nsView, coordinator: context.coordinator)
     }
 
     func makeCoordinator() -> Coordinator {
         Coordinator(self)
     }
 
+    private func updateFocusIfNeeded(in nsView: NSTextField, coordinator: Coordinator) {
+        guard let trigger = focusTrigger,
+              trigger != coordinator.lastFocusTrigger else {
+            return
+        }
+
+        guard nsView.window?.makeFirstResponder(nsView) == true,
+              let textView = nsView.currentEditor() as? NSTextView else {
+            return
+        }
+
+        coordinator.lastFocusTrigger = trigger
+        let textLength = (textView.string as NSString).length
+        textView.setSelectedRange(NSRange(location: textLength, length: 0))
+    }
+
     class Coordinator: NSObject, NSTextFieldDelegate {
         var parent: TagTextField
         var isAutoCompleting = false
+        var lastFocusTrigger: UUID?
 
         init(_ parent: TagTextField) {
             self.parent = parent
@@ -137,21 +165,41 @@ private struct TagTextField: NSViewRepresentable {
         }
 
         func control(_ control: NSControl, textView: NSTextView, doCommandBy commandSelector: Selector) -> Bool {
-            if commandSelector == #selector(NSResponder.insertNewline(_:)) {
+            switch commandSelector {
+            case #selector(NSResponder.insertNewline(_:)):
                 if textView.string.isEmpty {
                     parent.onCommitEmpty?()
                 } else {
                     parent.onCommit()
                 }
                 return true
-            }
-            if commandSelector == #selector(NSResponder.deleteBackward(_:)) {
+            case #selector(NSResponder.insertTab(_:)):
+                return handleFocusMove(.forward, expectedModifiers: [])
+            case #selector(NSResponder.insertBacktab(_:)):
+                return handleFocusMove(.backward, expectedModifiers: .shift)
+            case #selector(NSResponder.deleteBackward(_:)):
                 if textView.string.isEmpty {
                     parent.onDeleteBackward()
                     return true
                 }
+                return false
+            default:
+                return false
+            }
+        }
+
+        private func handleFocusMove(
+            _ direction: FocusDirection,
+            expectedModifiers: NSEvent.ModifierFlags
+        ) -> Bool {
+            let relevantModifiers: NSEvent.ModifierFlags = [.command, .option, .shift, .control]
+            let modifiers = NSApp.currentEvent?.modifierFlags.intersection(relevantModifiers) ?? []
+            guard modifiers == expectedModifiers else {
+                return false
             }
-            return false
+
+            parent.onMoveFocus(direction)
+            return true
         }
 
         func control(
```

---

### Incident Patch 11: `fb54cbc2` (2026-09-03)
**Commit Message**: Refactor text field height calculation in ReminderEditView and RmbHighlightedTextField - Fix #315

**File**: `reminders-menubar/Views/Helpers/RmbHighlightedTextField.swift` (modified, +16/-7)
```diff
@@ -153,15 +153,23 @@ struct RmbHighlightedTextField: NSViewRepresentable {
     // MARK: - Layout
 
     private func adjustDynamicHeight(for textView: NSTextView, context: Context) {
-        var newHeight: CGFloat = 48.0
-        if let layoutManager = textView.layoutManager,
-           let textContainer = textView.textContainer {
-            let maxHeight = layoutManager.defaultLineHeight(for: textFont) * CGFloat(maximumNumberOfLines)
-            newHeight = min(layoutManager.usedRect(for: textContainer).height, maxHeight)
+        guard let dynamicHeight = context.coordinator.parent.textContainerDynamicHeight,
+              let layoutManager = textView.layoutManager,
+              let textContainer = textView.textContainer else {
+            return
+        }
+
+        let lineHeight = layoutManager.defaultLineHeight(for: textFont)
+        let maxHeight = lineHeight * CGFloat(max(maximumNumberOfLines, 1))
+        let usedHeight = layoutManager.usedRect(for: textContainer).height
+        let newHeight = min(max(usedHeight, lineHeight), maxHeight)
+
+        guard dynamicHeight.wrappedValue != newHeight else {
+            return
         }
 
         DispatchQueue.main.async {
-            context.coordinator.parent.textContainerDynamicHeight?.wrappedValue = newHeight
+            dynamicHeight.wrappedValue = newHeight
         }
     }
 
@@ -348,6 +356,8 @@ private class PlaceholderNSTextView: NSTextView {
     var onDidBecomeFirstResponder: ((NSTextView) -> Void)?
 
     override func draw(_ rect: CGRect) {
+        super.draw(rect)
+
         if string.isEmpty && !placeholder.isEmpty {
             let attributes: [NSAttributedString.Key: Any] = [
                 .font: font ?? .systemFont(ofSize: NSFont.systemFontSize),
@@ -356,7 +366,6 @@ private class PlaceholderNSTextView: NSTextView {
 
             placeholder.draw(in: rect.insetBy(dx: 4, dy: 0), withAttributes: attributes)
         }
-        super.draw(rect)
     }
 
     override func viewDidMoveToWindow() {
```

**File**: `reminders-menubar/Views/ReminderEditView/ReminderEditView.swift` (modified, +6/-2)
```diff
@@ -17,8 +17,12 @@ struct ReminderEditView: View {
     @State var rmbReminder: RmbReminder
 
     @State var titleTextFieldFocusTrigger = UUID()
-    @State var titleTextFieldDynamicHeight: CGFloat = 0
-    @State var notesTextFieldDynamicHeight: CGFloat = 0
+    @State var titleTextFieldDynamicHeight = NSLayoutManager().defaultLineHeight(
+        for: .preferredFont(forTextStyle: .title3)
+    )
+    @State var notesTextFieldDynamicHeight = NSLayoutManager().defaultLineHeight(
+        for: .systemFont(ofSize: NSFont.systemFontSize)
+    )
 
     @State private var showingRemoveAlert = false
     @State private var removeButtonIsHovered = false
```

---

### Incident Patch 12: `98fe72a9` (2026-09-02)
**Commit Message**: Refactor new reminder typing to use NSEvent - Fix #314

**File**: `reminders-menubar.xcodeproj/project.pbxproj` (modified, +4/-0)
```diff
@@ -91,6 +91,7 @@
 		71CC00022FA6000200000001 /* CopyShortcutCoordinator.swift in Sources */ = {isa = PBXBuildFile; fileRef = 71CC00012FA6000100000001 /* CopyShortcutCoordinator.swift */; };
 		71CC00042FA6000400000002 /* SettingsCoordinator.swift in Sources */ = {isa = PBXBuildFile; fileRef = 71CC00032FA6000300000002 /* SettingsCoordinator.swift */; };
 		71CCF9842D43148100D334F8 /* EKReminderPriority+Extensions.swift in Sources */ = {isa = PBXBuildFile; fileRef = 71CCF9832D43148000D334F8 /* EKReminderPriority+Extensions.swift */; };
+		71CE00022FA6000200000001 /* NewReminderTypingCoordinator.swift in Sources */ = {isa = PBXBuildFile; fileRef = 71CE00012FA6000100000001 /* NewReminderTypingCoordinator.swift */; };
 		71D2623C2F57935F0073C0FD /* SettingsView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 71D2623B2F57935F0073C0FD /* SettingsView.swift */; };
 		71D2623F2F57D4490073C0FD /* SettingsSection.swift in Sources */ = {isa = PBXBuildFile; fileRef = 71D2623E2F57D4490073C0FD /* SettingsSection.swift */; };
 		71D262412F57D4E60073C0FD /* GeneralSettingsTab.swift in Sources */ = {isa = PBXBuildFile; fileRef = 71D262402F57D4E60073C0FD /* GeneralSettingsTab.swift */; };
@@ -241,6 +242,7 @@
 		71CC00012FA6000100000001 /* CopyShortcutCoordinator.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = CopyShortcutCoordinator.swift; sourceTree = "<group>"; };
 		71CC00032FA6000300000002 /* SettingsCoordinator.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SettingsCoordinator.swift; sourceTree = "<group>"; };
 		71CCF9832D43148000D334F8 /* EKReminderPriority+Extensions.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = "EKReminderPriority+Extensions.swift"; sourceTree = "<group>"; };
+		71CE00012FA6000100000001 /* NewReminderTypingCoordinator.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = NewReminderTypingCoordinator.swift; sourceTree = "<group>"; };
 		71D2623B2F57935F0073C0FD /* SettingsView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SettingsView.swift; sourceTree = "<group>"; };
 		71D2623E2F57D4490073C0FD /* SettingsSection.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SettingsSection.swift; sourceTree = "<group>"; };
 		71D262402F57D4E60073C0FD /* GeneralSettingsTab.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = GeneralSettingsTab.swift; sourceTree = "<group>"; };
@@ -359,6 +361,7 @@
 				71F2AF662FB190EA00C59519 /* Parsers */,
 				B55D54F72F37DF4E002DE761 /* ReminderCopyService.swift */,
 				71CC00012FA6000100000001 /* CopyShortcutCoordinator.swift */,
+				71CE00012FA6000100000001 /* NewReminderTypingCoordinator.swift */,
 				71CC00032FA6000300000002 /* SettingsCoordinator.swift */,
 				7115461824C0C280007781E2 /* RemindersService.swift */,
 				71F301F9259FB5CF00CDD81E /* UserPreferences.swift */,
@@ -841,6 +844,7 @@
 				716F69F42D6421170080A5F1 /* ReminderChangeDueDateOptionMenu.swift in Sources */,
 				B55D54F82F37DF4E002DE761 /* ReminderCopyService.swift in Sources */,
 				71CC00022FA6000200000001 /* CopyShortcutCoordinator.swift in Sources */,
+				71CE00022FA6000200000001 /* NewReminderTypingCoordinator.swift in Sources */,
 				71CC00042FA6000400000002 /* SettingsCoordinator.swift in Sources */,
 				7115461324C0ADCB007781E2 /* ReminderItemView.swift in Sources */,
 				71F93A652E03B93100D5C5BC /* ReminderExternalLinksView.swift in Sources */,
```

**File**: `reminders-menubar/AppDelegate.swift` (modified, +2/-0)
```diff
@@ -48,10 +48,12 @@ class AppDelegate: NSObject, NSApplicationDelegate {
         let contentView = ContentView()
         let remindersData = RemindersData()
         let copyShortcutCoordinator = CopyShortcutCoordinator()
+        let newReminderTypingCoordinator = NewReminderTypingCoordinator()
         return NSHostingController(
             rootView: contentView
                 .environmentObject(remindersData)
                 .environmentObject(copyShortcutCoordinator)
+                .environmentObject(newReminderTypingCoordinator)
         )
     }
 
```

**File**: `reminders-menubar/Models/RemindersData.swift` (modified, +0/-2)
```diff
@@ -221,8 +221,6 @@ class RemindersData: ObservableObject {
         }
     }
 
-    @Published var pendingNewReminderTitle: String?
-
     @Published var calendarForSaving: EKCalendar? = {
         guard RemindersService.shared.isAuthorized else {
             return nil
```

**File**: `reminders-menubar/Services/NewReminderTypingCoordinator.swift` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+import AppKit
+
+@MainActor
+final class NewReminderTypingCoordinator: ObservableObject {
+    @Published private(set) var isHandoffActive = false
+    private var pendingKeyEvents: [NSEvent] = []
+
+    func enqueue(_ event: NSEvent) {
+        pendingKeyEvents.append(event)
+        if !isHandoffActive {
+            isHandoffActive = true
+        }
+    }
+
+    func replayPendingEvents(in textView: NSTextView) {
+        guard isHandoffActive else { return }
+
+        while !pendingKeyEvents.isEmpty {
+            let events = pendingKeyEvents
+            pendingKeyEvents.removeAll()
+            events.forEach { textView.keyDown(with: $0) }
+        }
+        isHandoffActive = false
+    }
+
+    func reset() {
+        pendingKeyEvents.removeAll()
+        if isHandoffActive {
+            isHandoffActive = false
+        }
+    }
+}
```

**File**: `reminders-menubar/Views/ContentView.swift` (modified, +17/-11)
```diff
@@ -3,6 +3,7 @@ import EventKit
 
 struct ContentView: View {
     @EnvironmentObject var remindersData: RemindersData
+    @EnvironmentObject var newReminderTypingCoordinator: NewReminderTypingCoordinator
     @ObservedObject var userPreferences = UserPreferences.shared
     @State private var appHasPopoverOpen = false
     @State private var keyMonitor: Any?
@@ -49,7 +50,7 @@ struct ContentView: View {
             guard !appHasPopoverOpen else { return event }
             guard !FilterPanelController.shared.isVisible else { return event }
 
-            if handlePrintableKey(event, popoverWindow: popoverWindow) {
+            if handleNewReminderTyping(event, popoverWindow: popoverWindow) {
                 return nil
             }
             if handleEscapeKey(event, popoverWindow: popoverWindow) {
@@ -62,21 +63,26 @@ struct ContentView: View {
     private func activePopoverWindow(for event: NSEvent) -> NSWindow? {
         let popover = AppDelegate.shared.popover
         guard popover.isShown,
-              let window = popover.contentViewController?.view.window,
-              event.window === window else {
+              let window = popover.contentViewController?.view.window else {
             return nil
         }
+
+        let isMainPopoverEvent = event.window === window
+        let isNewReminderSheetEvent = newReminderTypingCoordinator.isHandoffActive
+            && event.window === window.attachedSheet
+        guard isMainPopoverEvent || isNewReminderSheetEvent else { return nil }
+
         return window
     }
 
-    private func handlePrintableKey(_ event: NSEvent, popoverWindow: NSWindow) -> Bool {
+    private func handleNewReminderTyping(_ event: NSEvent, popoverWindow: NSWindow) -> Bool {
         guard !remindersData.showingSearch,
               !remindersData.availableCalendars.isEmpty,
-              popoverWindow.attachedSheet == nil || remindersData.pendingNewReminderTitle != nil,
-              let typedText = printableText(from: event) else {
+              popoverWindow.attachedSheet == nil || newReminderTypingCoordinator.isHandoffActive,
+              isTextInputEvent(event) else {
             return false
         }
-        remindersData.pendingNewReminderTitle = (remindersData.pendingNewReminderTitle ?? "") + typedText
+        newReminderTypingCoordinator.enqueue(event)
         return true
     }
 
@@ -101,18 +107,17 @@ struct ContentView: View {
         .control, .format, .surrogate, .privateUse, .unassigned
     ]
 
-    private func printableText(from event: NSEvent) -> String? {
+    private func isTextInputEvent(_ event: NSEvent) -> Bool {
         let nonTypingModifiers: NSEvent.ModifierFlags = [.command, .control]
         guard event.modifierFlags.intersection(.deviceIndependentFlagsMask).isDisjoint(with: nonTypingModifiers),
               let characters = event.characters,
               !characters.isEmpty,
               characters.unicodeScalars.allSatisfy({
                   !Self.nonPrintableCategories.contains($0.properties.generalCategory)
               }) else {
-            return nil
+            return false
         }
-
-        return characters
+        return true
     }
 
     private func stopKeyMonitor() {
@@ -235,4 +240,5 @@ struct ListSectionModifier: ViewModifier {
 #Preview {
     ContentView()
         .environmentObject(RemindersData())
+        .environmentObject(NewReminderTypingCoordinator())
 }
```

**File**: `reminders-menubar/Views/Helpers/RmbHighlightedTextField.swift` (modified, +145/-52)
```diff
@@ -16,9 +16,12 @@ struct RmbHighlightedTextField: NSViewRepresentable {
 
     private var textFont = NSFont.systemFont(ofSize: NSFont.systemFontSize)
     private var onSubmit: (() -> Void)?
+    private var onDidBecomeFirstResponder: ((NSTextView) -> Void)?
     private var isInitialCharValidToAutoComplete: ((_ initialChar: String?) -> Bool)?
     private var autoCompleteSuggestions: ((_ initialChar: String?, _ typingWord: String) -> [String])?
 
+    // MARK: - NSViewRepresentable
+
     init(
         placeholder: String,
         text: Binding<String>,
@@ -45,6 +48,7 @@ struct RmbHighlightedTextField: NSViewRepresentable {
 
         textView.placeholder = placeholder
         textView.shouldFocus = focusTrigger != nil
+        textView.onDidBecomeFirstResponder = onDidBecomeFirstResponder
         textView.isEditable = true
         textView.isSelectable = true
         textView.allowsUndo = true
@@ -56,80 +60,114 @@ struct RmbHighlightedTextField: NSViewRepresentable {
     }
 
     func updateNSView(_ nsView: NSScrollView, context: Context) {
-        guard let textView = nsView.documentView as? NSTextView else {
+        guard let textView = nsView.documentView as? PlaceholderNSTextView else {
             return
         }
 
         context.coordinator.parent = self
+        textView.onDidBecomeFirstResponder = onDidBecomeFirstResponder
+
+        // AppKit owns marked text until the input method commits its composition.
+        if !textView.hasMarkedText() {
+            let updatedText = text.wrappedValue
+            if updatedText == textView.string {
+                // Refresh highlighting without replacing characters, selection, or undo state.
+                if let textStorage = textView.textStorage {
+                    applyAttributes(to: textStorage)
+                }
+            } else if textView.window?.firstResponder !== textView {
+                // Keep the active editor authoritative so stale text cannot move its insertion point.
+                updateTextAndAttributes(in: textView, with: updatedText)
+            }
+        }
+
+        updateFocusIfNeeded(in: textView, coordinator: context.coordinator)
+
+        textView.scrollRangeToVisible(textView.selectedRange())
+
+        adjustDynamicHeight(for: textView, context: context)
+    }
+
+    func makeCoordinator() -> Coordinator {
+        return Coordinator(self)
+    }
+
+    // MARK: - Text and attributes
 
+    private func updateTextAndAttributes(in textView: NSTextView, with updatedText: String) {
         let selectedRange = textView.selectedRange()
-        let updatedText = text.wrappedValue
         let updatedTextLength = (updatedText as NSString).length
         let selectionLocation = min(selectedRange.location, updatedTextLength)
         let selectionLength = min(selectedRange.length, updatedTextLength - selectionLocation)
 
         textView.textStorage?.setAttributedString(getAttributedString(from: updatedText))
         textView.setSelectedRange(NSRange(location: selectionLocation, length: selectionLength))
-
-        if let trigger = focusTrigger?.wrappedValue,
-           trigger != context.coordinator.lastFocusTrigger {
-            context.coordinator.lastFocusTrigger = trigger
-            if nsView.window?.firstResponder != textView {
-                nsView.window?.makeFirstResponder(textView)
-            }
-            textView.setSelectedRange(NSRange(location: updatedTextLength, length: 0))
-        }
-
-        textView.scrollRangeToVisible(NSRange(location: updatedTextLength, length: 0))
-
-        adjustDynamicHeight(for: textView, context: context)
     }
 
-    private func adjustDynamicHeight(for textView: NSTextView, context: Context) {
-        var newHeight: CGFloat = 48.0
-        if let layoutManager = textView.layoutManager,
-           let textContainer = textView.textContainer {
-            let maxHeight = layoutManager.defaultLineHeight(for: textFont) * CGFloat(maximumNumberOfLines)
-            newHeight = min(layoutManager.usedRect(for: textContainer).height, maxHeight)
-        }
-
-        DispatchQueue.main.async {
-            context.coordinator.parent.textContainerDynamicHeight?.wrappedValue = newHeight
-        }
+    private func getAttributedString(from text: String) -> NSMutableAttributedString {
+        let attributedString = NSMutableAttributedString(string: text)
+        applyAttributes(to: attributedString)
+        return attributedString
     }
 
-    private func getAttributedString(from text: String) -> NSMutableAttributedString {
-        let fullRange = text.fullRange
+    private func applyAttributes(to attributedString: NSMutableAttributedString) {
+        let fullRange = NSRange(location: 0, length: attributedString.length)
 
-        let attributedString = NSMutableAttributedString(string: text)
         attributedString.beginEditing()
-        attributedString.addAttribute(
-            .font,
-            value: textFont,
+        attributed
```

**File**: `reminders-menubar/Views/ReminderEditView/ReminderEditView.swift` (modified, +6/-5)
```diff
@@ -8,6 +8,7 @@ struct ReminderEditView: View {
     }
 
     @EnvironmentObject var remindersData: RemindersData
+    @EnvironmentObject var newReminderTypingCoordinator: NewReminderTypingCoordinator
     @ObservedObject var userPreferences = UserPreferences.shared
 
     @Binding var isPresented: Bool
@@ -120,11 +121,6 @@ struct ReminderEditView: View {
                 if userPreferences.autoSuggestToday {
                     rmbReminder.setIsAutoSuggestingTodayForCreation()
                 }
-                if let pendingTitle = remindersData.pendingNewReminderTitle, !pendingTitle.isEmpty {
-                    rmbReminder.title = pendingTitle
-                    titleTextFieldFocusTrigger = UUID()
-                }
-                remindersData.pendingNewReminderTitle = nil
             }
         }
     }
@@ -173,6 +169,9 @@ struct ReminderEditView: View {
             textContainerDynamicHeight: $titleTextFieldDynamicHeight,
             focusTrigger: $titleTextFieldFocusTrigger
         )
+        .onDidBecomeFirstResponder { textView in
+            newReminderTypingCoordinator.replayPendingEvents(in: textView)
+        }
         .onSubmit { confirmAction() }
         .autoComplete(
             isInitialCharValid: { char in
@@ -390,6 +389,7 @@ struct ReminderEditView: View {
         isPresented: .constant(true)
     )
     .environmentObject(RemindersData())
+    .environmentObject(NewReminderTypingCoordinator())
 }
 
 #Preview("Edit mode") {
@@ -413,4 +413,5 @@ struct ReminderEditView: View {
         reminderHasChildren: false
     )
     .environmentObject(RemindersData())
+    .environmentObject(NewReminderTypingCoordinator())
 }
```

**File**: `reminders-menubar/Views/ToolbarView/CreateReminderButton.swift` (modified, +5/-3)
```diff
@@ -2,6 +2,7 @@ import SwiftUI
 
 struct CreateReminderButton: View {
     @EnvironmentObject var remindersData: RemindersData
+    @EnvironmentObject var newReminderTypingCoordinator: NewReminderTypingCoordinator
     @State private var showingCreateView = false
 
     var body: some View {
@@ -29,8 +30,8 @@ struct CreateReminderButton: View {
         ) { _ in
             resetCreateReminderSheetState()
         }
-        .onChange(of: remindersData.pendingNewReminderTitle) { newValue in
-            guard newValue != nil, !showingCreateView else { return }
+        .onChange(of: newReminderTypingCoordinator.isHandoffActive) { isActive in
+            guard isActive, !showingCreateView else { return }
             showingCreateView = true
         }
         .sheet(isPresented: $showingCreateView, onDismiss: resetCreateReminderSheetState) {
@@ -40,11 +41,12 @@ struct CreateReminderButton: View {
 
     private func resetCreateReminderSheetState() {
         showingCreateView = false
-        remindersData.pendingNewReminderTitle = nil
+        newReminderTypingCoordinator.reset()
     }
 }
 
 #Preview {
     CreateReminderButton()
         .environmentObject(RemindersData())
+        .environmentObject(NewReminderTypingCoordinator())
 }
```

---

### Incident Patch 13: `4db53bfa` (2026-08-29)
**Commit Message**: Fix launch at login migration and add LaunchAtLoginService - Related to #306

**File**: `reminders-menubar.xcodeproj/project.pbxproj` (modified, +4/-0)
```diff
@@ -101,6 +101,7 @@
 		71D2624B2F592E2A0073C0FD /* SettingsDivider.swift in Sources */ = {isa = PBXBuildFile; fileRef = 71D2624A2F592E2A0073C0FD /* SettingsDivider.swift */; };
 		71D2624B2F592E2B0073C0FD /* SettingsNoteStyle.swift in Sources */ = {isa = PBXBuildFile; fileRef = 71D2624A2F592E2B0073C0FD /* SettingsNoteStyle.swift */; };
 		71D2624D2F5A1B0000C8A33E /* RightClickMenuHelper.swift in Sources */ = {isa = PBXBuildFile; fileRef = 71D2624C2F5A1B0000C8A33E /* RightClickMenuHelper.swift */; };
+		71D2624D2F5A1B0200C8A33E /* LaunchAtLoginService.swift in Sources */ = {isa = PBXBuildFile; fileRef = 71D2624C2F5A1B0200C8A33E /* LaunchAtLoginService.swift */; };
 		71D2624F2F5A1B0100C8A33E /* SettingsOpenerView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 71D2624E2F5A1B0100C8A33E /* SettingsOpenerView.swift */; };
 		71D262502F5B8A0000C8A33E /* CopySettingsTab.swift in Sources */ = {isa = PBXBuildFile; fileRef = 71D262512F5B8A0000C8A33E /* CopySettingsTab.swift */; };
 		71D6B98028E25B9F0004EEBB /* AppCommands.swift in Sources */ = {isa = PBXBuildFile; fileRef = 71D6B97F28E25B9F0004EEBB /* AppCommands.swift */; };
@@ -250,6 +251,7 @@
 		71D2624A2F592E2A0073C0FD /* SettingsDivider.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SettingsDivider.swift; sourceTree = "<group>"; };
 		71D2624A2F592E2B0073C0FD /* SettingsNoteStyle.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SettingsNoteStyle.swift; sourceTree = "<group>"; };
 		71D2624C2F5A1B0000C8A33E /* RightClickMenuHelper.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = RightClickMenuHelper.swift; sourceTree = "<group>"; };
+		71D2624C2F5A1B0200C8A33E /* LaunchAtLoginService.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = LaunchAtLoginService.swift; sourceTree = "<group>"; };
 		71D2624E2F5A1B0100C8A33E /* SettingsOpenerView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SettingsOpenerView.swift; sourceTree = "<group>"; };
 		71D262512F5B8A0000C8A33E /* CopySettingsTab.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = CopySettingsTab.swift; sourceTree = "<group>"; };
 		71D6B97F28E25B9F0004EEBB /* AppCommands.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AppCommands.swift; sourceTree = "<group>"; };
@@ -360,6 +362,7 @@
 				71CC00032FA6000300000002 /* SettingsCoordinator.swift */,
 				7115461824C0C280007781E2 /* RemindersService.swift */,
 				71F301F9259FB5CF00CDD81E /* UserPreferences.swift */,
+				71D2624C2F5A1B0200C8A33E /* LaunchAtLoginService.swift */,
 				715B4DD428D56FE5008C6683 /* KeyboardShortcutService.swift */,
 				71D2624C2F5A1B0000C8A33E /* RightClickMenuHelper.swift */,
 				71C0D001E1700001A8000001 /* MenuBarPreviewService.swift */,
@@ -853,6 +856,7 @@
 				71D2624F2F5A1B0100C8A33E /* SettingsOpenerView.swift in Sources */,
 				71217BA82F8C8BEB00E5FEB4 /* AppStoreUpdateController.swift in Sources */,
 				71F301FA259FB5CF00CDD81E /* UserPreferences.swift in Sources */,
+				71D2624D2F5A1B0200C8A33E /* LaunchAtLoginService.swift in Sources */,
 				716CAFF02AC28E5500EEB1DB /* ReminderItem.swift in Sources */,
 				71B0CA022FA4000100000C01 /* CopyProperty.swift in Sources */,
 				71D2623C2F57935F0073C0FD /* SettingsView.swift in Sources */,
```

**File**: `reminders-menubar/AppDelegate.swift` (modified, +1/-0)
```diff
@@ -57,6 +57,7 @@ class AppDelegate: NSObject, NSApplicationDelegate {
 
     func applicationDidFinishLaunching(_ aNotification: Notification) {
         AppDelegate.shared = self
+        LaunchAtLoginService.shared.migrateIfNeeded()
 
         configurePopover()
         configureMenuBarButton()
```

**File**: `reminders-menubar/Resources/Localizable.xcstrings` (modified, +375/-0)
```diff
@@ -9626,6 +9626,381 @@
         }
       }
     },
+    "launchAtLoginApprovalRequiredNote" : {
+      "extractionState" : "manual",
+      "localizations" : {
+        "cs" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Než se aplikace bude moci spouštět při přihlášení, je nutné ji schválit v Nastavení systému."
+          }
+        },
+        "de" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Bevor die App bei der Anmeldung gestartet werden kann, ist eine Genehmigung in den Systemeinstellungen erforderlich."
+          }
+        },
+        "en" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Approval is required in System Settings before the app can launch at login."
+          }
+        },
+        "es-419" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Se requiere aprobación en Configuración del Sistema antes de que la app pueda iniciarse al iniciar sesión."
+          }
+        },
+        "fil-PH" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Kailangan ng pag-apruba sa Mga Setting ng System bago mabuksan ang app kapag nag-log in."
+          }
+        },
+        "fr" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Une autorisation dans Réglages Système est requise pour que l’app puisse se lancer à l’ouverture de session."
+          }
+        },
+        "id" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Persetujuan diperlukan di Pengaturan Sistem agar app dapat diluncurkan saat masuk."
+          }
+        },
+        "it" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "È richiesta l’approvazione in Impostazioni di Sistema prima che l’app possa avviarsi al login."
+          }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "ログイン時にアプリを起動するには、システム設定での承認が必要です。"
+          }
+        },
+        "ko" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "로그인 시 앱을 실행하려면 시스템 설정에서 승인이 필요합니다."
+          }
+        },
+        "nl" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Goedkeuring in Systeeminstellingen is vereist voordat de app bij het inloggen kan worden gestart."
+          }
+        },
+        "pl" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Aby aplikacja mogła uruchamiać się po zalogowaniu, wymagane jest zatwierdzenie w Ustawieniach systemowych."
+          }
+        },
+        "pt-BR" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "É necessário aprovar nos Ajustes do Sistema para que o app possa iniciar no login."
+          }
+        },
+        "ru" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Чтобы приложение запускалось при входе, необходимо разрешить это в Системных настройках."
+          }
+        },
+        "sk" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Pred spustením aplikácie pri prihlásení je potrebné schválenie v Systémových nastaveniach."
+          }
+        },
+        "tr" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Uygulamanın oturum açıldığında başlatılabilmesi için Sistem Ayarları’nda onay gerekir."
+          }
+        },
+        "uk" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Щоб програма запускалася під час входу, її потрібно схвалити в Системних параметрах."
+          }
+        },
+        "vi" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Cần phê duyệt trong Cài đặt hệ thống trước khi ứng dụng có thể chạy khi đăng nhập."
+          }
+        },
+        "zh-Hans" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "需要先在“系统设置”中批准，应用才能在登录时启动。"
+          }
+        },
+        "zh-Hant" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "需要先在「系統設定」中核准，App 才能在登入時啟動。"
+          }
+        }
+      }
+    },
+    "launchAtLoginUnavailableNote" : {
+      "extractionState" : "manual",
+      "localizations" : {
+        "cs" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Přihlašovací položku aplikace se nepodařilo najít. Obvykle to znamená, že aplikace nebyla správně nainstalována nebo není ve složce Aplikace."
+          }
+        },
+        "de" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Das Anmeldeobjekt der App wurde nicht gef
```

**File**: `reminders-menubar/Resources/remindersLocalized.swift` (modified, +3/-0)
```diff
@@ -46,6 +46,9 @@ enum RemindersMenuBarLocalizedKeys: String {
     case recentRemindersLoadingMessage
     case updateAvailableNoticeButton
     case launchAtLoginOption
+    case launchAtLoginApprovalRequiredNote
+    case launchAtLoginUnavailableNote
+    case openLoginItemsSettingsButton
     case appAppearanceReduceTransparencyOption
     case appColorSchemeSettingsLabel
     case appAppearanceColorSystemModeOption
```

**File**: `reminders-menubar/Services/LaunchAtLoginService.swift` (added, +139/-0)
```diff
@@ -0,0 +1,139 @@
+import Combine
+import Foundation
+import ServiceManagement
+
+@MainActor
+final class LaunchAtLoginService: ObservableObject {
+    enum Status {
+        case enabled
+        case disabled
+        case requiresApproval
+        case unavailable
+    }
+
+    static let shared = LaunchAtLoginService()
+
+    @Published private(set) var status: Status = .disabled
+
+    private static let migrationVersionKey = "launchAtLoginMigrationVersion"
+    private static let currentMigrationVersion = 3
+
+    private init() {
+        refresh()
+    }
+
+    var isEnabled: Bool {
+        status == .enabled || status == .requiresApproval
+    }
+
+    func setEnabled(_ isEnabled: Bool) {
+        if #available(macOS 13.0, *) {
+            setModernLoginItemEnabled(isEnabled)
+            if !isEnabled {
+                _ = setLegacyLoginItemEnabled(false)
+            }
+        } else {
+            setLegacyLoginItemEnabled(isEnabled)
+        }
+        refresh()
+    }
+
+    func refresh() {
+        if #available(macOS 13.0, *) {
+            status = modernStatus()
+        } else {
+            status = isLegacyLoginItemEnabled() ? .enabled : .disabled
+        }
+    }
+
+    func migrateIfNeeded() {
+        guard #available(macOS 13.0, *) else {
+            return
+        }
+
+        guard UserDefaults.standard.integer(forKey: Self.migrationVersionKey) < Self.currentMigrationVersion else {
+            return
+        }
+
+        guard isLegacyLoginItemEnabled() else {
+            completeMigration()
+            return
+        }
+
+        setModernLoginItemEnabled(true)
+
+        let mainAppService = SMAppService.mainApp
+        guard mainAppService.status == .enabled else {
+            refresh()
+            return
+        }
+
+        if setLegacyLoginItemEnabled(false) {
+            completeMigration()
+        }
+    }
+
+    @available(macOS 13.0, *)
+    func openSystemSettings() {
+        SMAppService.openSystemSettingsLoginItems()
+    }
+
+    @available(macOS 13.0, *)
+    private func modernStatus() -> Status {
+        let mainStatus = SMAppService.mainApp.status
+
+        if mainStatus == .requiresApproval {
+            return .requiresApproval
+        }
+        if mainStatus == .enabled || isLegacyLoginItemEnabled() {
+            return .enabled
+        }
+        if mainStatus == .notFound {
+            return .unavailable
+        }
+        return .disabled
+    }
+
+    @available(macOS 13.0, *)
+    private func setModernLoginItemEnabled(_ isEnabled: Bool) {
+        let mainAppService = SMAppService.mainApp
+        let isRegistered = mainAppService.status == .enabled || mainAppService.status == .requiresApproval
+        guard isRegistered != isEnabled else { return }
+
+        do {
+            if isEnabled {
+                try mainAppService.register()
+            } else {
+                try mainAppService.unregister()
+            }
+        } catch {
+            print("Failed to \(isEnabled ? "enable" : "disable") launch at login [modern]:", error.localizedDescription)
+        }
+    }
+
+    private func isLegacyLoginItemEnabled() -> Bool {
+        guard let jobs = SMCopyAllJobDictionaries(kSMDomainUserLaunchd),
+              let allJobs = jobs.takeRetainedValue() as? [[String: AnyObject]] else {
+            return false
+        }
+
+        let launcherJob = allJobs.first {
+            $0["Label"] as? String == AppConstants.launcherBundleId
+        }
+        return launcherJob?["OnDemand"] as? Bool ?? false
+    }
+
+    @discardableResult
+    private func setLegacyLoginItemEnabled(_ isEnabled: Bool) -> Bool {
+        let succeeded = SMLoginItemSetEnabled(AppConstants.launcherBundleId as CFString, isEnabled)
+        if !succeeded {
+            print("Failed to \(isEnabled ? "enable" : "disable") launch at login [legacy]")
+        }
+        return succeeded
+    }
+
+    private func completeMigration() {
+        UserDefaults.standard.set(Self.currentMigrationVersion, forKey: Self.migrationVersionKey)
+        refresh()
+    }
+}
```

**File**: `reminders-menubar/Services/UserPreferences.swift` (modified, +0/-53)
```diff
@@ -1,5 +1,4 @@
 import SwiftUI
-import ServiceManagement
 
 private enum PreferencesKeys {
     static let reminderMenuBarIcon = "reminderMenuBarIcon"
@@ -35,16 +34,12 @@ private enum PreferencesKeys {
     static let completionAnimationEnabled = "completionAnimationEnabled"
 }
 
-// TODO: Resolve body length of UserPreferences
-// swiftlint:disable:next type_body_length
 class UserPreferences: ObservableObject {
     static let shared = UserPreferences()
 
     private var accessibilityObserver: NSObjectProtocol?
 
     private init() {
-        migrateLaunchAtLoginIfNeeded()
-
         accessibilityObserver = NSWorkspace.shared.notificationCenter.addObserver(
             forName: NSWorkspace.accessibilityDisplayOptionsDidChangeNotification,
             object: nil,
@@ -54,24 +49,6 @@ class UserPreferences: ObservableObject {
         }
     }
 
-    private func migrateLaunchAtLoginIfNeeded() {
-        let launchAtLoginMigratedPreferencesKey = "launchAtLoginMigrated"
-        guard !UserPreferences.defaults.bool(forKey: launchAtLoginMigratedPreferencesKey) else {
-            return
-        }
-        UserPreferences.defaults.set(true, forKey: launchAtLoginMigratedPreferencesKey)
-
-        if #available(macOS 13.0, *) {
-            let launcherService = SMAppService.loginItem(identifier: AppConstants.launcherBundleId)
-            guard launcherService.status == .enabled else {
-                return
-            }
-            // Unregister the old launcher and register the main app instead
-            try? launcherService.unregister()
-            try? SMAppService.mainApp.register()
-        }
-    }
-
     deinit {
         if let observer = accessibilityObserver {
             NotificationCenter.default.removeObserver(observer)
@@ -250,36 +227,6 @@ class UserPreferences: ObservableObject {
         }
     }
 
-    var launchAtLoginIsEnabled: Bool {
-        get {
-            if #available(macOS 13.0, *) {
-                return SMAppService.mainApp.status == .enabled
-            } else {
-                let allJobs = SMCopyAllJobDictionaries(
-                    kSMDomainUserLaunchd
-                ).takeRetainedValue() as? [[String: AnyObject]]
-                let launcherJob = allJobs?.first { $0["Label"] as? String == AppConstants.launcherBundleId }
-                return launcherJob?["OnDemand"] as? Bool ?? false
-            }
-        }
-        set {
-            objectWillChange.send()
-            if #available(macOS 13.0, *) {
-                do {
-                    if newValue {
-                        try SMAppService.mainApp.register()
-                    } else {
-                        try SMAppService.mainApp.unregister()
-                    }
-                } catch {
-                    print("Failed to \(newValue ? "enable" : "disable") launch at login:", error.localizedDescription)
-                }
-            } else {
-                SMLoginItemSetEnabled(AppConstants.launcherBundleId as CFString, newValue)
-            }
-        }
-    }
-    
     @Published var rmbColorScheme: RmbColorScheme = {
         guard let rmbColorSchemeString = defaults.string(forKey: PreferencesKeys.rmbColorScheme) else {
             return .system
```

**File**: `reminders-menubar/Views/SettingsView/GeneralSettingsTab.swift` (modified, +33/-1)
```diff
@@ -2,14 +2,21 @@ import SwiftUI
 
 struct GeneralSettingsTab: View {
     @ObservedObject var userPreferences = UserPreferences.shared
+    @ObservedObject private var launchAtLoginService = LaunchAtLoginService.shared
 
     var body: some View {
         Form {
             SettingsSection {
                 Toggle(
                     rmbLocalized(.launchAtLoginOption),
-                    isOn: $userPreferences.launchAtLoginIsEnabled
+                    isOn: Binding(
+                        get: { launchAtLoginService.isEnabled },
+                        set: { launchAtLoginService.setEnabled($0) }
+                    )
                 )
+                .disabled(launchAtLoginService.status == .unavailable)
+
+                launchAtLoginStatusNote
             }
 
             SettingsDivider()
@@ -76,6 +83,31 @@ struct GeneralSettingsTab: View {
             }
         }
         .padding(20)
+        .onAppear {
+            launchAtLoginService.refresh()
+        }
+        .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in
+            launchAtLoginService.refresh()
+        }
+    }
+
+    @ViewBuilder private var launchAtLoginStatusNote: some View {
+        switch launchAtLoginService.status {
+        case .requiresApproval:
+            Text(rmbLocalized(.launchAtLoginApprovalRequiredNote))
+                .modifier(SettingsNoteStyle())
+
+            if #available(macOS 13.0, *) {
+                Button(rmbLocalized(.openLoginItemsSettingsButton)) {
+                    launchAtLoginService.openSystemSettings()
+                }
+            }
+        case .unavailable:
+            Text(rmbLocalized(.launchAtLoginUnavailableNote))
+                .modifier(SettingsNoteStyle())
+        case .enabled, .disabled:
+            EmptyView()
+        }
     }
 }
 
```

---

### Incident Patch 14: `3680f1d0` (2026-08-28)
**Commit Message**: Fix SettingsOpenerView when app launches at login - Related to #306

**File**: `reminders-menubar/Extensions/NSApplication+Extensions.swift` (modified, +2/-2)
```diff
@@ -12,8 +12,8 @@ extension NSApplication {
         AppDelegate.shared.popover.performClose(nil)
 
         if #available(macOS 14.0, *) {
-            // Note: Post a notification that the hidden helper view (SettingsOpenerView) will pick up.
-            NotificationCenter.default.post(name: .openSettingsRequest, object: nil)
+            // Note: Request to post a notification that the hidden helper view (SettingsOpenerView) will pick up.
+            SettingsOpenerBridge.shared.requestOpen()
         } else if #available(macOS 13.0, *) {
             sendAction(Selector(("showSettingsWindow:")), to: nil, from: nil)
             activate(ignoringOtherApps: true)
```

**File**: `reminders-menubar/Views/Helpers/SettingsOpenerView.swift` (modified, +76/-0)
```diff
@@ -1,9 +1,75 @@
 import Combine
 import SwiftUI
 
+@available(macOS 14.0, *)
+@MainActor
+final class SettingsOpenerBridge {
+    private enum State {
+        case listenerUnavailable
+        case reopening
+        case awaitingListener
+        case listenerReady
+    }
+
+    static let shared = SettingsOpenerBridge()
+
+    private var state = State.listenerUnavailable
+
+    private init() {}
+
+    func requestOpen() {
+        switch state {
+        case .listenerReady:
+            postRequest()
+            return
+        case .reopening:
+            return
+        case .listenerUnavailable, .awaitingListener:
+            state = .reopening
+            reopenApplication()
+        }
+    }
+
+    func listenerDidAppear() {
+        let shouldOpenSettings = state == .reopening || state == .awaitingListener
+        state = .listenerReady
+
+        if shouldOpenSettings {
+            DispatchQueue.main.async { [weak self] in
+                self?.postRequest()
+            }
+        }
+    }
+
+    func listenerDidDisappear() {
+        state = .listenerUnavailable
+    }
+
+    private func reopenApplication() {
+        let configuration = NSWorkspace.OpenConfiguration()
+        configuration.activates = false
+
+        NSWorkspace.shared.openApplication(
+            at: Bundle.main.bundleURL,
+            configuration: configuration,
+            completionHandler: { [weak self] _, error in
+                Task { @MainActor in
+                    guard let self, self.state == .reopening else { return }
+                    self.state = error == nil ? .awaitingListener : .listenerUnavailable
+                }
+            }
+        )
+    }
+
+    private func postRequest() {
+        NotificationCenter.default.post(name: .openSettingsRequest, object: nil)
+    }
+}
+
 @available(macOS 14.0, *)
 struct SettingsOpenerView: View {
     @Environment(\.openSettings) private var openSettings
+    @State private var isOpeningSettings = false
     @State private var settingsOpenCancellable: AnyCancellable?
     @State private var settingsCloseCancellable: AnyCancellable?
     @State private var settingsWindow: NSWindow?
@@ -12,6 +78,12 @@ struct SettingsOpenerView: View {
         SettingsOpenerHiddenWindow()
             .frame(width: 0, height: 0)
             .allowsHitTesting(false)
+            .onAppear {
+                SettingsOpenerBridge.shared.listenerDidAppear()
+            }
+            .onDisappear {
+                SettingsOpenerBridge.shared.listenerDidDisappear()
+            }
             .onReceive(NotificationCenter.default.publisher(for: .openSettingsRequest)) { _ in
                 Task { @MainActor in
                     await handleOpenSettingsRequest()
@@ -27,6 +99,10 @@ struct SettingsOpenerView: View {
             return
         }
 
+        guard !isOpeningSettings else { return }
+        isOpeningSettings = true
+        defer { isOpeningSettings = false }
+
         // Clear any stale reference from a previous session.
         settingsWindow = nil
 
```

---

### Incident Patch 15: `d81e6349` (2026-08-28)
**Commit Message**: Fix unexpected termination when app launches at login - Related to #306

**File**: `reminders-menubar/AppDelegate.swift` (modified, +6/-0)
```diff
@@ -69,6 +69,12 @@ class AppDelegate: NSObject, NSApplicationDelegate {
         stopOutsideClickMonitors()
     }
 
+    // Prevent the app from terminating because of the Settings window (or any auxiliary window).
+    // As a menu bar app with no main window, the popover serves as its primary UI.
+    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
+        false
+    }
+
     private func configurePopover() {
         setMainPopoverSize(size: UserPreferences.shared.mainPopoverSize)
         popover.animates = false
```

**File**: `reminders-menubar/Info.plist` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@
 	<key>NSRemindersUsageDescription</key>
 	<string>The App uses Apple Reminders as a source for lists and tasks. Access is required to view and edit reminders.</string>
 	<key>NSSupportsAutomaticTermination</key>
-	<true/>
+	<false/>
 	<key>NSSupportsSuddenTermination</key>
 	<true/>
 	<key>SUFeedURL</key>
```

#### Recent Merged Pull Requests:
- **PR #319** (2026-09-30): Add option to hide upcoming reminders from lists (@edbond88)
- **PR #298** (2026-06-17): fix: include undated reminders in 'show all' menu bar counter (@neo-c212)
- **PR #296** (2026-06-14): Automatically open the pop-up if one starts typing (@palmerovicdev)
- **PR #292** (2026-04-22): Update it-IT locale (@katullo)
- **PR #291** (2026-04-09): Update it-IT locale (@katullo)
- **PR #289** (closed): Simplifyed version (@hreinssondev)
- **PR #288** (closed): Add reminder sorting options and creation date metadata (@albertkls)
- **PR #287** (closed): Barrettj/inline search (@DamascenoRafael)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
