# Forensic Learning Record (Deep Inspection): jordanbaird/Ice

> **Canonical Artifact**: `07_PROJECT_LEARNING/jordanbaird-ice-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/jordanbaird/Ice](https://github.com/jordanbaird/Ice))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:24:36.113Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `jordanbaird/Ice`
- **Description**: Powerful menu bar manager for macOS
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 29750 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Ice/Events/EventMonitors/RunLoopLocalEventMonitor.swift`
```
//
//  RunLoopLocalEventMonitor.swift
//  Ice
//

import Cocoa
import Combine

final class RunLoopLocalEventMonitor {
    private let runLoop = CFRunLoopGetCurrent()
    private let mode: RunLoop.Mode
    private let handler: (NSEvent) -> NSEvent?
    private let observer: CFRunLoopObserver

    /// Creates an event monitor with the given event type mask and handler.
    ///
    /// - Parameters:
    ///   - mask: An event type mask specifying which events to monitor.
    ///   - handler: A handler to execute when the event monitor receives
    ///     an event corresponding to the event types in `mask`.
    init(
        mask: NSEvent.EventTypeMask,
        mode: RunLoop.Mode,
        handler: @escaping (_ event: NSEvent) -> NSEvent?
    ) {
        self.mode = mode
        self.handler = handler
        self.observer = CFRunLoopObserverCreateWithHandler(
            kCFAllocatorDefault,
            CFRunLoopActivity.beforeSources.rawValue,
            true,
            0
        ) { _, _ in
            var events = [NSEvent]()

            while let event = NSApp.nextEvent(matching: .any, until: nil, inMode: .default, dequeue: true) {
                events.append(event)
            }

            for event in events {
                var handledEvent: NSEvent?

                if !mask.contains(NSEvent.EventTypeMask(rawValue: 1 << event.type.rawValue)) {
                    handledEvent = event
                } else if let eventFromHandler = handler(event) {
                    handledEvent = eventFromHandler
                }

                guard let handledEvent else {
                    continue
                }

                NSApp.postEvent(handledEvent, atStart: false)
            }
        }
    }

    deinit {
        stop()
    }

    func start() {
        CFRunLoopAddObserver(
            runLoop,
            observer,
            CFRunLoopMode(mode.rawValue as CFString)
        )
    }

    func stop() {
        CFRunLoopRemoveObserver(
            runLoop,
            observer,
            CFRunLoopMode(mode.rawValue as CFString)
        )
    }
}

extension RunLoopLocalEventMonitor {
    /// A publisher that emits local events for an event type mask.
    struct RunLoopLocalEventPublisher: Publisher {
        typealias Output = NSEvent
        typealias Failure = Never

        let mask: NSEvent.EventTypeMask
        let mode: RunLoop.Mode

        func receive<S: Subscriber<Output, Failure>>(subscriber: S) {
            let subscription = RunLoopLocalEventSubscription(mask: mask, mode: mode, subscriber: subscriber)
            subscriber.receive(subscription: subscription)
        }
    }

    /// Returns a publisher that emits local events for the given event type mask.
    ///
    /// - Parameter mask: An event type mask specifying which events to publish.
    static func publisher(for mask: NSEvent.EventTypeMask, mode: RunLoop.Mode) -> RunLoopLocalEventPublisher {
        RunLoopLocalEventPublisher(mask: mask, mode: mode)
    }
}

extension RunLoopLocalEventMonitor.RunLoopLocalEventPublisher {
    private final class RunLoopLocalEventSubscription<S: Subscriber<Output, Failure>>: Subscription {
        var subscriber: S?
        let monitor: RunLoopLocalEventMonitor

        init(mask: NSEvent.EventTypeMask, mode: RunLoop.Mode, subscriber: S) {
            self.subscriber = subscriber
            self.monitor = RunLoopLocalEventMonitor(mask: mask, mode: mode) { event in
                _ = subscriber.receive(event)
                return event
            }
            monitor.start()
        }

        func request(_ demand: Subscribers.Demand) { }

        func cancel() {
            monitor.stop()
            subscriber = nil
        }
    }
}

```

### Core Architecture Module: `Ice/Main/AppState.swift`
```
//
//  AppState.swift
//  Ice
//

import Combine
import SwiftUI

/// The model for app-wide state.
@MainActor
final class AppState: ObservableObject {
    /// A Boolean value that indicates whether the active space is fullscreen.
    @Published private(set) var isActiveSpaceFullscreen = Bridging.isSpaceFullscreen(Bridging.activeSpaceID)

    /// Manager for the menu bar's appearance.
    private(set) lazy var appearanceManager = MenuBarAppearanceManager(appState: self)

    /// Manager for events received by the app.
    private(set) lazy var eventManager = EventManager(appState: self)

    /// Manager for menu bar items.
    private(set) lazy var itemManager = MenuBarItemManager(appState: self)

    /// Manager for the state of the menu bar.
    private(set) lazy var menuBarManager = MenuBarManager(appState: self)

    /// Manager for app permissions.
    private(set) lazy var permissionsManager = PermissionsManager(appState: self)

    /// Manager for the app's settings.
    private(set) lazy var settingsManager = SettingsManager(appState: self)

    /// Manager for app updates.
    private(set) lazy var updatesManager = UpdatesManager(appState: self)

    /// Manager for user notifications.
    private(set) lazy var userNotificationManager = UserNotificationManager(appState: self)

    /// Global cache for menu bar item images.
    private(set) lazy var imageCache = MenuBarItemImageCache(appState: self)

    /// Manager for menu bar item spacing.
    let spacingManager = MenuBarItemSpacingManager()

    /// Model for app-wide navigation.
    let navigationState = AppNavigationState()

    /// The app's hotkey registry.
    nonisolated let hotkeyRegistry = HotkeyRegistry()

    /// The app's delegate.
    private(set) weak var appDelegate: AppDelegate?

    /// The window that contains the settings interface.
    private(set) weak var settingsWindow: NSWindow?

    /// The window that contains the permissions interface.
    private(set) weak var permissionsWindow: NSWindow?

    /// A Boolean value that indicates whether the "ShowOnHover" feature is prevented.
    private(set) var isShowOnHoverPrevented = false

    /// Storage for internal observers.
    private var cancellables = Set<AnyCancellable>()

    /// A Boolean value that indicates whether the app is running as a SwiftUI preview.
    let isPreview: Bool = {
        #if DEBUG
        let environment = ProcessInfo.processInfo.environment
        let key = "XCODE_RUNNING_FOR_PREVIEWS"
        return environment[key] != nil
        #else
        return false
        #endif
    }()

    /// A Boolean value that indicates whether the application can set the cursor
    /// in the background.
    var setsCursorInBackground: Bool {
        get { Bridging.getConnectionProperty(forKey: "SetsCursorInBackground") as? Bool ?? false }
        set { Bridging.setConnectionProperty(newValue, forKey: "SetsCursorInBackground") }
    }

    /// Configures the internal observers for the app state.
    private func configureCancellables() {
        var c = Set<AnyCancellable>()

        Publishers.Merge3(
            NSWorkspace.shared.notificationCenter
                .publisher(for: NSWorkspace.activeSpaceDidChangeNotification)
                .mapToVoid(),
            // Frontmost application change can indicate a space change from one display to
            // another, which gets ignored by NSWorkspace.activeSpaceDidChangeNotification.
            NSWorkspace.shared
                .publisher(for: \.frontmostApplication)
                .mapToVoid(),
            // Clicking into a fullscreen space from another space is also ignored.
            UniversalEventMonitor
                .publisher(for: .leftMouseDown)
                .delay(for: 0.1, scheduler: DispatchQueue.main)
                .mapToVoid()
        )
        .receive(on: DispatchQueue.main)
        .sink { [weak self] _ in
            guard let self else {
                return
            }
            isActiveSpaceFullscreen = Bridging.isSpaceFullscreen(Bridging.activeSpaceID)
        }
        .store(in: &c)

        NSWorkspace.shared.publisher(for: \.frontmostApplication)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] frontmostApplication in
                guard let self else {
                    return
                }
                navigationState.isAppFrontmost = frontmostApplication == .current
            }
            .store(in: &c)

        if let settingsWindow {
            settingsWindow.publisher(for: \.isVisible)
                .debounce(for: 0.05, scheduler: DispatchQueue.main)
                .sink { [weak self] isVisible in
                    guard let self else {
                        return
                    }
                    navigationState.isSettingsPresented = isVisible
                }
                .store(in: &c)
        } else {
            Logger.appState.warning("No settings window!")
        }

        Publishers.Merge(
            navigationState.$isAppFrontmost,
            navigationState.$isSettingsPresented
        )
        .debounce(for: 0.1, scheduler: DispatchQueue.main)
        .sink { [weak self] shouldUpdate in
            guard
                let self,
                shouldUpdate
            else {
                return
            }
            Task.detached {
                if ScreenCapture.cachedCheckPermissions(reset: true) {
                    await self.imageCache.updateCacheWithoutChecks(sections: MenuBarSection.Name.allCases)
                }
            }
        }
        .store(in: &c)

        menuBarManager.objectWillChange
            .sink { [weak self] in
                self?.objectWillChange.send()
            }
            .store(in: &c)
        permissionsManager.objectWillChange
            .sink { [weak self] in
                self?.objectWillChange.send()
            }
            .store(in: &c)
        settingsManager.objectWillChange
            .sink { [weak self] in
                self?.objectWillChange.send()
            }
            .store(in: &c)
        updatesManager.objectWillChange
            .sink { [weak self] in
                self?.objectWillChange.send()
            }
            .store(in: &c)

        cancellables = c
    }

    /// Sets up the app state.
    func performSetup() {
        configureCancellables()
        permissionsManager.stopAllChecks()
        menuBarManager.performSetup()
        appearanceManager.performSetup()
        eventManager.performSetup()
        settingsManager.performSetup()
        itemManager.performSetup()
        imageCache.performSetup()
        updatesManager.performSetup()
        userNotificationManager.performSetup()
    }

    /// Assigns the app delegate to the app state.
    func assignAppDelegate(_ appDelegate: AppDelegate) {
        guard self.appDelegate == nil else {
            Logger.appState.warning("Multiple attempts made to assign app delegate")
            return
        }
        self.appDelegate = appDelegate
    }

    /// Assigns the settings window to the app state.
    func assignSettingsWindow(_ window: NSWindow) {
        guard window.identifier?.rawValue == Constants.settingsWindowID else {
            Logger.appState.warning("Window \(window.identifier?.rawValue ?? "<NIL>") is not the settings window!")
            return
        }
        settingsWindow = window
        configureCancellables()
    }

    /// Assigns the permissions window to the app state.
    func assignPermissionsWindow(_ window: NSWindow) {
        guard window.identifier?.rawValue == Constants.permissionsWindowID else {
            Logger.appState.warning("Window \(window.identifier?.rawValue ?? "<NIL>") is not the permissions window!")
            return
        }
        permissionsWindow = window
        configureCancellables()
    }

    /// Opens the settings window.
    func openSettingsWindow() {
        with(EnvironmentValues()) { environment in
            environment.openWindow(id: Constants.settingsWindowID)
        }
    }

    /// Dismisses the settings window.
    func dismissSettingsWindow() {
        with(EnvironmentValues()) { environment in
            environment.dismissWindow(id: Constants.settingsWindowID)
        }
    }

    /// Opens the permissions window.
    func openPermissionsWindow() {
        with(EnvironmentValues()) { environment in
            environment.openWindow(id: Constants.permissionsWindowID)
        }
    }

    /// Dismisses the permissions window.
    func dismissPermissionsWindow() {
        with(EnvironmentValues()) { environment in
            environment.dismissWindow(id: Constants.permissionsWindowID)
        }
    }

    /// Activates the app and sets its activation policy to the given value.
    func activate(withPolicy policy: NSApplication.ActivationPolicy) {
        // Store whether the app has previously activated inside an internal
        // context to keep it isolated.
        enum Context {
            static let hasActivated = ObjectStorage<Bool>()
        }

        func activate() {
            if let frontApp = NSWorkspace.shared.frontmostApplication {
                NSRunningApplication.current.activate(from: frontApp)
            } else {
                NSApp.activate()
            }
            NSApp.setActivationPolicy(policy)
        }

        if Context.hasActivated.value(for: self) == true {
            activate()
        } else {
            Context.hasActivated.set(true, for: self)
            Logger.appState.debug("First time activating app, so going through Dock")
            // Hack to make sure the app properly activates for the first time.
            NSRunningApplication.runningApplications(withBundleIdentifier: "com.apple.dock").first?.activate()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                activate()
            }
        }
    }

    /// Deactivates the app and sets its activation policy to the given va
```

### Core Architecture Module: `Ice/Main/Navigation/AppNavigationState.swift`
```
//
//  AppNavigationState.swift
//  Ice
//

import Combine

/// The model for app-wide navigation.
@MainActor
final class AppNavigationState: ObservableObject {
    @Published var isAppFrontmost = false
    @Published var isSettingsPresented = false
    @Published var isIceBarPresented = false
    @Published var isSearchPresented = false
    @Published var settingsNavigationIdentifier: SettingsNavigationIdentifier = .general
}

```

### Core Architecture Module: `Ice/Utilities/BindingExposable.swift`
```
//
//  BindingExposable.swift
//  Ice
//

import SwiftUI

/// A type that exposes its writable properties as bindings.
protocol BindingExposable {
    /// A lens that exposes bindings to the writable properties of this type.
    typealias Bindings = ExposedBindings<Self>

    /// A lens that exposes bindings to the writable properties of this instance.
    var bindings: Bindings { get }
}

extension BindingExposable {
    var bindings: Bindings {
        Bindings(base: self)
    }
}

/// A lens that exposes bindings to the writable properties of a base object.
@dynamicMemberLookup
struct ExposedBindings<Base: BindingExposable> {
    /// The object whose bindings are exposed.
    private let base: Base

    /// Creates a lens that exposes the bindings of the given object.
    init(base: Base) {
        self.base = base
    }

    /// Returns a binding to the property at the given key path.
    subscript<Value>(dynamicMember keyPath: ReferenceWritableKeyPath<Base, Value>) -> Binding<Value> {
        Binding(get: { base[keyPath: keyPath] }, set: { base[keyPath: keyPath] = $0 })
    }

    /// Returns a lens that exposes the bindings of the object at the given key path.
    subscript<T: BindingExposable>(dynamicMember keyPath: KeyPath<Base, T>) -> ExposedBindings<T> {
        ExposedBindings<T>(base: base[keyPath: keyPath])
    }
}

```

### Core Architecture Module: `Ice/Utilities/CodableColor.swift`
```
//
//  CodableColor.swift
//  Ice
//

import CoreGraphics
import Foundation

/// A Codable wrapper around a CGColor.
struct CodableColor {
    /// The CGColor contained within the wrapper.
    var cgColor: CGColor
}

// MARK: CodableColor: Codable
extension CodableColor: Codable {
    private enum CodingKeys: CodingKey {
        case components
        case colorSpace
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        var components = try container.decode([CGFloat].self, forKey: .components)
        let iccData = try container.decode(Data.self, forKey: .colorSpace) as CFData
        guard let colorSpace = CGColorSpace(iccData: iccData) else {
            throw DecodingError.dataCorruptedError(
                forKey: .colorSpace,
                in: container,
                debugDescription: "Invalid ICC profile data"
            )
        }
        guard let cgColor = CGColor(colorSpace: colorSpace, components: &components) else {
            throw DecodingError.dataCorrupted(
                DecodingError.Context(
                    codingPath: decoder.codingPath,
                    debugDescription: "Invalid color space or components"
                )
            )
        }
        self.cgColor = cgColor
    }

    func encode(to encoder: Encoder) throws {
        guard let components = cgColor.components else {
            throw EncodingError.invalidValue(
                cgColor,
                EncodingError.Context(
                    codingPath: encoder.codingPath,
                    debugDescription: "Missing color components"
                )
            )
        }
        guard let colorSpace = cgColor.colorSpace else {
            throw EncodingError.invalidValue(
                cgColor,
                EncodingError.Context(
                    codingPath: encoder.codingPath,
                    debugDescription: "Missing color space"
                )
            )
        }
        guard let iccData = colorSpace.copyICCData() else {
            throw EncodingError.invalidValue(
                colorSpace,
                EncodingError.Context(
                    codingPath: encoder.codingPath,
                    debugDescription: "Missing ICC profile data"
                )
            )
        }
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(components, forKey: .components)
        try container.encode(iccData as Data, forKey: .colorSpace)
    }
}

```

### Core Architecture Module: `Ice/Utilities/Constants.swift`
```
//
//  Constants.swift
//  Ice
//

import Foundation

enum Constants {
    // swiftlint:disable force_unwrapping
    /// The version string in the app's bundle.
    static let versionString = Bundle.main.versionString!

    /// The build string in the app's bundle.
    static let buildString = Bundle.main.buildString!

    /// The user-readable copyright string in the app's bundle.
    static let copyrightString = Bundle.main.copyrightString!

    /// The bundle identifier of the app.
    static let bundleIdentifier = Bundle.main.bundleIdentifier!
    // swiftlint:enable force_unwrapping

    /// The identifier for the settings window.
    static let settingsWindowID = "SettingsWindow"

    /// The identifier for the permissions window.
    static let permissionsWindowID = "PermissionsWindow"

    /// The title for the settings window.
    static let settingsWindowTitle = "Ice"

    /// The title for the permissions window.
    static let permissionsWindowTitle = "Permissions"
}

```

### Core Architecture Module: `Ice/Utilities/Defaults.swift`
```
//
//  Defaults.swift
//  Ice
//

import Foundation

enum Defaults {
    /// Returns a dictionary containing the keys and values for
    /// the defaults meant to be seen by all applications.
    static var globalDomain: [String: Any] {
        UserDefaults.standard.persistentDomain(forName: UserDefaults.globalDomain) ?? [:]
    }

    /// Returns the object for the specified key.
    ///
    /// - Parameter key: The key in the UserDefaults database
    ///   to retrieve the value for.
    static func object(forKey key: Key) -> Any? {
        UserDefaults.standard.object(forKey: key.rawValue)
    }

    /// Returns the string for the specified key.
    ///
    /// - Parameter key: The key in the UserDefaults database
    ///   to retrieve the value for.
    static func string(forKey key: Key) -> String? {
        UserDefaults.standard.string(forKey: key.rawValue)
    }

    /// Returns the array for the specified key.
    ///
    /// - Parameter key: The key in the UserDefaults database
    ///   to retrieve the value for.
    static func array(forKey key: Key) -> [Any]? {
        UserDefaults.standard.array(forKey: key.rawValue)
    }

    /// Returns the dictionary for the specified key.
    ///
    /// - Parameter key: The key in the UserDefaults database
    ///   to retrieve the value for.
    static func dictionary(forKey key: Key) -> [String: Any]? {
        UserDefaults.standard.dictionary(forKey: key.rawValue)
    }

    /// Returns the data for the specified key.
    ///
    /// - Parameter key: The key in the UserDefaults database
    ///   to retrieve the value for.
    static func data(forKey key: Key) -> Data? {
        UserDefaults.standard.data(forKey: key.rawValue)
    }

    /// Returns the string array for the specified key.
    ///
    /// - Parameter key: The key in the UserDefaults database
    ///   to retrieve the value for.
    static func stringArray(forKey key: Key) -> [String]? {
        UserDefaults.standard.stringArray(forKey: key.rawValue)
    }

    /// Returns the integer value for the specified key.
    ///
    /// - Parameter key: The key in the UserDefaults database
    ///   to retrieve the value for.
    static func integer(forKey key: Key) -> Int {
        UserDefaults.standard.integer(forKey: key.rawValue)
    }

    /// Returns the single precision floating point value for
    /// the specified key.
    ///
    /// - Parameter key: The key in the UserDefaults database
    ///   to retrieve the value for.
    static func float(forKey key: Key) -> Float {
        UserDefaults.standard.float(forKey: key.rawValue)
    }

    /// Returns the double precision floating point value for
    /// the specified key.
    ///
    /// - Parameter key: The key in the UserDefaults database
    ///   to retrieve the value for.
    static func double(forKey key: Key) -> Double {
        UserDefaults.standard.double(forKey: key.rawValue)
    }

    /// Returns the Boolean value for the specified key.
    ///
    /// - Parameter key: The key in the UserDefaults database
    ///   to retrieve the value for.
    static func bool(forKey key: Key) -> Bool {
        UserDefaults.standard.bool(forKey: key.rawValue)
    }

    /// Returns the url for the specified key.
    ///
    /// - Parameter key: The key in the UserDefaults database
    ///   to retrieve the value for.
    static func url(forKey key: Key) -> URL? {
        UserDefaults.standard.url(forKey: key.rawValue)
    }

    /// Sets the value for the specified key.
    ///
    /// - Parameter key: The key in the UserDefaults database
    ///   to set the value for.
    static func set(_ value: Any?, forKey key: Key) {
        UserDefaults.standard.set(value, forKey: key.rawValue)
    }

    /// Removes the value of the specified key.
    ///
    /// - Parameter key: The key in the UserDefaults database
    ///   to remove the value for.
    static func removeObject(forKey key: Key) {
        UserDefaults.standard.removeObject(forKey: key.rawValue)
    }

    /// Retrieves the value for the given key, and, if it is
    /// present, assigns it to the given `inout` parameter.
    static func ifPresent<Value>(key: Key, assign value: inout Value) {
        if let found = object(forKey: key) as? Value {
            value = found
        }
    }

    /// Retrieves the value for the given key, and, if it is
    /// present, performs the given closure.
    static func ifPresent<Value>(key: Key, body: (Value) throws -> Void) rethrows {
        if let found = object(forKey: key) as? Value {
            try body(found)
        }
    }
}

extension Defaults {
    enum Key: String {

        // MARK: General Settings

        case showIceIcon = "ShowIceIcon"
        case iceIcon = "IceIcon"
        case customIceIconIsTemplate = "CustomIceIconIsTemplate"
        case useIceBar = "UseIceBar"
        case showOnClick = "ShowOnClick"
        case showOnHover = "ShowOnHover"
        case showOnScroll = "ShowOnScroll"
        case itemSpacingOffset = "ItemSpacingOffset"
        case autoRehide = "AutoRehide"
        case rehideStrategy = "RehideStrategy"
        case rehideInterval = "RehideInterval"

        // MARK: Hotkey Settings

        case hotkeys = "Hotkeys"

        // MARK: Advanced Settings

        case hideApplicationMenus = "HideApplicationMenus"
        case showSectionDividers = "ShowSectionDividers"
        case enableAlwaysHiddenSection = "EnableAlwaysHiddenSection"
        case canToggleAlwaysHiddenSection = "CanToggleAlwaysHiddenSection"
        case showOnHoverDelay = "ShowOnHoverDelay"
        case tempShowInterval = "TempShowInterval"
        case showAllSectionsOnUserDrag = "ShowAllSectionsOnUserDrag"
        case showContextMenuOnRightClick = "ShowContextMenuOnRightClick"

        // MARK: Menu Bar Appearance Settings

        case menuBarAppearanceConfigurationV2 = "MenuBarAppearanceConfigurationV2"

        // MARK: Ice Bar Settings

        case iceBarLocation = "IceBarLocation"
        case iceBarPinnedLocation = "IceBarPinnedLocation"

        // MARK: Migration

        case hasMigrated0_8_0 = "hasMigrated0_8_0"
        case hasMigrated0_10_0 = "hasMigrated0_10_0"
        case hasMigrated0_10_1 = "hasMigrated0_10_1"
        case hasMigrated0_11_10 = "hasMigrated0_11_10"

        // MARK: Deprecated

        case sections = "Sections"
        case menuBarHasBorder = "MenuBarHasBorder"
        case menuBarBorderColor = "MenuBarBorderColor"
        case menuBarBorderWidth = "MenuBarBorderWidth"
        case menuBarHasShadow = "MenuBarHasShadow"
        case menuBarTintKind = "MenuBarTintKind"
        case menuBarTintColor = "MenuBarTintColor"
        case menuBarTintGradient = "MenuBarTintGradient"
        case menuBarShapeKind = "MenuBarShapeKind"
        case menuBarFullShapeInfo = "MenuBarFullShapeInfo"
        case menuBarSplitShapeInfo = "MenuBarSplitShapeInfo"
        case menuBarAppearanceConfiguration = "MenuBarAppearanceConfiguration"
    }
}

```

### Core Architecture Module: `Ice/Utilities/Extensions.swift`
```
//
//  Extensions.swift
//  Ice
//

import Combine
import SwiftUI

// MARK: - Bundle

extension Bundle {
    /// The bundle's copyright string.
    ///
    /// This accessor looks for an associated value for the "NSHumanReadableCopyright"
    /// key in the bundle's Info.plist. If a string value cannot be found for this key,
    /// this accessor returns `nil`.
    var copyrightString: String? {
        object(forInfoDictionaryKey: "NSHumanReadableCopyright") as? String
    }

    /// The bundle's version string.
    ///
    /// This accessor looks for an associated value for the "CFBundleShortVersionString"
    /// key in the bundle's Info.plist. If a string value cannot be found for this key,
    /// this accessor returns `nil`.
    var versionString: String? {
        object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
    }

    /// The bundle's build string.
    ///
    /// This accessor looks for an associated value for the "CFBundleVersion" key in
    /// the bundle's Info.plist. If a string value cannot be found for this key, this
    /// accessor returns `nil`.
    var buildString: String? {
        object(forInfoDictionaryKey: "CFBundleVersion") as? String
    }
}

// MARK: - CGColor

extension CGColor {
    /// The brightness of the color.
    var brightness: CGFloat? {
        guard
            let rgb = converted(to: CGColorSpaceCreateDeviceRGB(), intent: .defaultIntent, options: nil),
            let components = rgb.components
        else {
            return nil
        }
        // Algorithm from http://www.w3.org/WAI/ER/WD-AERT/#color-contrast
        return ((components[0] * 299) + (components[1] * 587) + (components[2] * 114)) / 1000
    }
}

// MARK: - CGError

extension CGError {
    /// A string to use for logging purposes.
    var logString: String {
        switch self {
        case .success: "\(rawValue): success"
        case .failure: "\(rawValue): failure"
        case .illegalArgument: "\(rawValue): illegalArgument"
        case .invalidConnection: "\(rawValue): invalidConnection"
        case .invalidContext: "\(rawValue): invalidContext"
        case .cannotComplete: "\(rawValue): cannotComplete"
        case .notImplemented: "\(rawValue): notImplemented"
        case .rangeCheck: "\(rawValue): rangeCheck"
        case .typeCheck: "\(rawValue): typeCheck"
        case .invalidOperation: "\(rawValue): invalidOperation"
        case .noneAvailable: "\(rawValue): noneAvailable"
        @unknown default: "\(rawValue): unknown"
        }
    }
}

// MARK: - CGImage

extension CGImage {

    // MARK: Average Color

    /// Computes and returns the average color of the image.
    ///
    /// - Parameters:
    ///   - alphaThreshold: An alpha value below which pixels should be ignored. Pixels with
    ///     an alpha component greater than or equal to this value contribute to the average.
    ///   - makeOpaque: A Boolean value that indicates whether the resulting color should be
    ///     made opaque, regardless of the alpha content of the image.
    func averageColor(alphaThreshold: CGFloat = 0.5, makeOpaque: Bool = false) -> CGColor? {
        func createPixelData(width: Int, height: Int) -> [UInt32]? {
            var data = [UInt32](repeating: 0, count: width * height)
            guard let context = CGContext(
                data: &data,
                width: width,
                height: height,
                bitsPerComponent: 8,
                bytesPerRow: width * 4,
                space: CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGImageByteOrderInfo.order32Little.rawValue | CGImageAlphaInfo.premultipliedFirst.rawValue
            ) else {
                return nil
            }
            context.draw(self, in: CGRect(x: 0, y: 0, width: width, height: height))
            return data
        }

        func computeComponent(shift: UInt32, pixel: UInt32) -> Int {
            return Int((pixel >> shift) & 255)
        }

        // Resize the image for better performance.
        let width = min(width, 10)
        let height = min(height, 10)

        guard let pixelData = createPixelData(width: width, height: height) else {
            return nil
        }

        // Convert the alpha threshold to a valid component for comparison.
        let alphaThreshold = Int((alphaThreshold.clamped(to: 0...1) * 255).rounded(.toNearestOrAwayFromZero))

        var includedPixelCount = width * height
        var totals = (red: 0, green: 0, blue: 0, alpha: 0)

        for column in 0..<width {
            for row in 0..<height {
                let pixel = pixelData[(row * width) + column]

                // Check alpha before computing other components.
                let alphaComponent = computeComponent(shift: 24, pixel: pixel)

                guard alphaComponent >= alphaThreshold else {
                    includedPixelCount -= 1 // Don't include this pixel.
                    continue
                }

                // Add the components to the totals.
                totals.red += computeComponent(shift: 16, pixel: pixel)
                totals.green += computeComponent(shift: 8, pixel: pixel)
                totals.blue += computeComponent(shift: 0, pixel: pixel)
                totals.alpha += alphaComponent
            }
        }

        // Multiply the included pixel count by 255 to convert the components
        // to their corresponding floating point values.
        let adjustedPixelCount = CGFloat(includedPixelCount * 255)

        return CGColor(
            red: CGFloat(totals.red) / adjustedPixelCount,
            green: CGFloat(totals.green) / adjustedPixelCount,
            blue: CGFloat(totals.blue) / adjustedPixelCount,
            alpha: makeOpaque ? 1 : CGFloat(totals.alpha) / adjustedPixelCount
        )
    }

    // MARK: Trim Transparent Pixels

    /// A context for handling transparency data in an image.
    private struct TransparencyContext: ~Copyable {
        private let image: CGImage
        private let maxAlpha: UInt8
        private let cgContext: CGContext
        private let zeroByteBlock: UnsafeMutableRawPointer
        private let rowRange: LazySequence<Range<Int>>
        private let columnRange: LazySequence<Range<Int>>

        /// Creates a context with the given image and alpha threshold.
        ///
        /// - Parameters:
        ///   - image: The image to form a context around.
        ///   - maxAlpha: The maximum alpha value to consider transparent.
        init?(image: CGImage, maxAlpha: UInt8) {
            guard
                let cgContext = CGContext(
                    data: nil,
                    width: image.width,
                    height: image.height,
                    bitsPerComponent: 8,
                    bytesPerRow: 0,
                    space: CGColorSpaceCreateDeviceGray(),
                    bitmapInfo: CGImageAlphaInfo.alphaOnly.rawValue
                ),
                cgContext.data != nil,
                let zeroByteBlock = calloc(image.width, MemoryLayout<UInt8>.size)
            else {
                return nil
            }

            cgContext.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))

            self.image = image
            self.maxAlpha = maxAlpha
            self.cgContext = cgContext
            self.zeroByteBlock = zeroByteBlock
            self.rowRange = (0..<image.height).lazy
            self.columnRange = (0..<image.width).lazy
        }

        deinit {
            free(zeroByteBlock)
        }

        /// Trims transparent pixels from the context.
        func trim(edges: Set<CGRectEdge>) -> CGImage? {
            guard
                maxAlpha < 255,
                !edges.isEmpty
            else {
                return image // Nothing to trim.
            }

            guard
                let minYInset = inset(for: .minYEdge, in: edges),
                let maxYInset = inset(for: .maxYEdge, in: edges),
                let minXInset = inset(for: .minXEdge, in: edges),
                let maxXInset = inset(for: .maxXEdge, in: edges)
            else {
                return nil
            }

            guard (minYInset, maxYInset, minXInset, maxXInset) != (0, 0, 0, 0) else {
                return image // Already trimmed.
            }

            let insetRect = CGRect(
                x: minXInset,
                y: maxYInset,
                width: image.width - (minXInset + maxXInset),
                height: image.height - (minYInset + maxYInset)
            )

            return image.cropping(to: insetRect)
        }

        private func inset(for edge: CGRectEdge, in edges: Set<CGRectEdge>) -> Int? {
            guard edges.contains(edge) else {
                return 0
            }
            return switch edge {
            case .maxYEdge:
                firstOpaqueRow(in: rowRange)
            case .minYEdge:
                firstOpaqueRow(in: rowRange.reversed()).map { (image.height - 1) - $0 }
            case .minXEdge:
                firstOpaqueColumn(in: columnRange)
            case .maxXEdge:
                firstOpaqueColumn(in: columnRange.reversed()).map { (image.width - 1) - $0 }
            }
        }

        private func isPixelOpaque(row: Int, column: Int) -> Bool {
            guard let bitmapData = cgContext.data else {
                return false
            }
            let rawAlpha = bitmapData.load(fromByteOffset: (row * cgContext.bytesPerRow) + column, as: UInt8.self)
            return rawAlpha > maxAlpha
        }

        private func firstOpaqueRow<S: Sequence>(in rowRange: S) -> Int? where S.Element == Int {
            guard let bitmapData = cgContext.data else {
                return nil
            }
            return rowRange.first { row in
                // Use memcmp to efficiently check the entire row for zeroed out alpha.
                let rowByteBlock = bitmapData + (row * cgContext.bytesPerRow)
                if m
```

### Core Architecture Module: `Ice/Utilities/IconResource.swift`
```
//
//  IconResource.swift
//  Ice
//

import SwiftUI

/// A type that produces a view representing an icon.
enum IconResource: Hashable {
    /// A resource derived from a system symbol.
    case systemSymbol(_ name: String)

    /// A resource derived from an asset catalog.
    case assetCatalog(_ resource: ImageResource)

    /// The view produced by the resource.
    @ViewBuilder
    var view: some View {
        image
            .resizable()
            .aspectRatio(contentMode: .fit)
    }

    /// The image produced by the resource.
    private var image: Image {
        switch self {
        case .systemSymbol(let name):
            Image(systemName: name)
        case .assetCatalog(let resource):
            Image(resource)
        }
    }
}

```

### Core Architecture Module: `Ice/Utilities/Injection.swift`
```
//
//  Injection.swift
//  Ice
//

/// Updates the given value in place using a closure.
///
/// Use this function to repeatedly update a value while ensuring it is only mutated once.
func update<Value>(_ value: inout Value, body: (inout Value) throws -> Void) rethrows {
    try body(&value)
}

/// Updates the given value in place using a closure.
///
/// Use this function to repeatedly update a value while ensuring it is only mutated once.
func update<Value>(_ value: inout Value, body: (inout Value) async throws -> Void) async rethrows {
    try await body(&value)
}

/// Updates a copy of the given value using a closure and returns the updated value.
@discardableResult
func with<Value>(_ value: Value, update: (inout Value) throws -> Void) rethrows -> Value {
    var copy = value
    try update(&copy)
    return copy
}

/// Updates a copy of the given value using a closure and returns the updated value.
@discardableResult
func with<Value>(_ value: Value, update: (inout Value) async throws -> Void) async rethrows -> Value {
    var copy = value
    try await update(&copy)
    return copy
}

```

### Core Architecture Module: `Ice/Utilities/LocalizedErrorWrapper.swift`
```
//
//  LocalizedErrorWrapper.swift
//  Ice
//

import Foundation

/// A type that wraps the information of any error inside a `LocalizedError`.
///
/// If the error used to initialize the box is also a `LocalizedError`, its
/// information is passed through to the box. Otherwise, a description of the
/// error is passed to the wrapper.
struct LocalizedErrorWrapper: LocalizedError {
    let errorDescription: String?
    let failureReason: String?
    let helpAnchor: String?
    let recoverySuggestion: String?

    /// Creates a wrapper with the given error.
    init(_ error: any Error) {
        if let error = error as? any LocalizedError {
            self.errorDescription = error.errorDescription
            self.failureReason = error.failureReason
            self.helpAnchor = error.helpAnchor
            self.recoverySuggestion = error.recoverySuggestion
        } else {
            self.errorDescription = error.localizedDescription
            self.failureReason = nil
            self.helpAnchor = nil
            self.recoverySuggestion = nil
        }
    }
}

```

### Core Architecture Module: `Ice/Utilities/Logging.swift`
```
//
//  Logging.swift
//  Ice
//

import OSLog

/// A type that encapsulates logging behavior for Ice.
struct Logger {
    /// The unified logger at the base of this logger.
    private let base: os.Logger

    /// Creates a logger for Ice using the specified category.
    init(category: String) {
        self.base = os.Logger(subsystem: Constants.bundleIdentifier, category: category)
    }

    /// Logs the given informative message to the logger.
    func info(_ message: String) {
        base.info("\(message, privacy: .public)")
    }

    /// Logs the given debug message to the logger.
    func debug(_ message: String) {
        base.debug("\(message, privacy: .public)")
    }

    /// Logs the given error message to the logger.
    func error(_ message: String) {
        base.error("\(message, privacy: .public)")
    }

    /// Logs the given warning message to the logger.
    func warning(_ message: String) {
        base.warning("\(message, privacy: .public)")
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1005** (2026-10-01): **[Bug]: dont work on new update 27.0.1 MacOS**
  *Symptoms*: ### Search for Similar Reports  - [x] I have searched existing issues for similar reports  ### Description  [Bug]: dont work on new update 27.0.1 MacOS  ### Steps to Reproduce  [Bug]: dont work on new update 27.0.1 MacOS  ### App Version  0.11.13  ### macOS Version  27.0.1  ### Additional Information  _No response_

- **Issue #979** (2026-09-02): **[Bug]: Menu bar doesn't reflect the correct visible and hidden icons**
  *Symptoms*: ### Search for Similar Reports  - [x] I have searched existing issues for similar reports  ### Description  Currently it says the icons that are shown are the ones that are hidden are the ones that are visible, see screenshot  <img width="1203" height="495" alt="Image" src="https://github.com/user-attachments/assets/34296173-4997-4056-8be0-36ac55849341" />  ### Steps to Reproduce  1. Launch a new tool that appears in the menu bar 2. It automatically appears 3. Try and remove it 4. It still shows in the menu bar  ### App Version  v0.111.13-dev.2c-unofficial  ### macOS Version  26.6.2  ### Additional Information  <img width="991" height="619" alt="Image" src="https://github.com/user-attachments/assets/7927e6d1-6db1-4008-84e6-467c30cc2654" />
  **Post-Mortem & Fix Analysis**:
  > confused the hidden and visibility features as pr other apps menu bar settings, ignore this request

- **Issue #976** (2026-08-31): **[Bug]:**
  *Symptoms*: ### Search for Similar Reports  - [x] I have searched existing issues for similar reports  ### Description  I've set my space between icons as default. But this seems to have causes the apps to be closer, and my sound/wifi apps are now a lot more distant from each other.  <img width="1290" height="60" alt="Image" src="https://github.com/user-attachments/assets/0c2eed8e-8a3c-4149-bfef-93c376a09737" />  ### Steps to Reproduce  Just described above  ### App Version  0.11.13-dev.2  ### macOS Version  26.6.2  ### Additional Information  _No response_

- **Issue #930** (2026-04-23): **[Bug]: Removed icon from tray and can't get it back**
  *Symptoms*: ### Search for Similar Reports  - [x] I have searched existing issues for similar reports  ### Description  Hi, I have removed an icon from tray while using ice by holding CMD key.  Now I can't get it back in any way – even after quitting ice, reinstalling the software the icon belons to etc.  ### Steps to Reproduce  1. Open ice 2. Hold CMD key and move icon outside tray zone 3. Tooltip Remove shows up 4. Icon disappears   Might be related to this: https://github.com/jordanbaird/Ice/issues/860#event-22288083720  ### App Version  0.11.12  ### macOS Version  26.3.1  ### Additional Information  _No response_
  **Post-Mortem & Fix Analysis**:
  > Actually it might be a problem with Cloudflare WARP which icon I have removed.
  > i find it under System Settings > Menu Bar to show app icons again
  > Fantastic. Thanks @devane001. That solves the issue.

- **Issue #904** (2026-03-24): **[Bug]: macos 26.3.1 app crashed**
  *Symptoms*: ### Search for Similar Reports  - [x] I have searched existing issues for similar reports  ### Description  app just crashed when I clicked 'expand' icon in top bar  ### Steps to Reproduce  just click the expand icon in the top bar. that's it.  ### App Version  0.11.12  ### macOS Version  26.3.1  ### Additional Information  _No response_

- **Issue #901** (2026-03-18): **[Bug]: Invisible tray icon in menu bar layout in macos tahoe**
  *Symptoms*: ### Search for Similar Reports  - [x] I have searched existing issues for similar reports  ### Description  I use the latest version of the app, however, in MacOs Tahoe 26.3.1, Menu Bar Layout is completely invisible as shown in the image <img width="909" height="630" alt="Image" src="https://github.com/user-attachments/assets/d510fdcd-d06b-414e-9647-d0432414f1c0" />  Other than that, all functionalities are working.  Please help, thanks.  ### Steps to Reproduce  1. Open Ice Settings... 2. Go to Menu Bar Layout  ### App Version  0.11.12  ### macOS Version  26.3.1  ### Additional Information  _No response_
  **Post-Mortem & Fix Analysis**:
  > fixed with https://github.com/jordanbaird/Ice/releases/tag/0.11.13-dev.2
  > @dernerl thanks 👍 

- **Issue #884** (2026-02-24): **[Bug]: Unclickable Update popup**
  *Symptoms*: ### Search for Similar Reports  - [x] I have searched existing issues for similar reports  ### Description  Macos cant close the update window  <img width="872" height="284" alt="Image" src="https://github.com/user-attachments/assets/c47fe894-0cf6-4af4-958e-d9e6c2290f97" />  ### Steps to Reproduce  .  ### App Version  .  ### macOS Version  tahoe 26.3  ### Additional Information  _No response_
  **Post-Mortem & Fix Analysis**:
  > same here
  > Samw here
  > Updating to [0.11.13 macOS Tahoe Beta 2](https://github.com/jordanbaird/Ice/releases/tag/0.11.13-dev.2) works for me.

- **Issue #875** (2026-02-06): **[Bug]: My formal icons are lost and can't be foud after dragging them into the visible part of menu bar layout**
  *Symptoms*: ### Search for Similar Reports  - [x] I have searched existing issues for similar reports  ### Description  I dragged my 2 icons, clash verge and Gemini, into the visible part of menu bar layout, and the icons just disappear, and I can't get them back anymore. Then I tried to use the Tahoe version of Ice, but still, those 2 icons no longer exist, I really don't know where I can get them back.  Also, I've tried restart my computer and delete the plist, but it doesn't work.  ### Steps to Reproduce  1. go to setting 2. click menu bar layout 3. command + drag your icon 4. pooooh, it's gone.  ### App Version  Ice 0.11.12  ### macOS Version  Tahoe 26.2  ### Additional Information  _No response_
  **Post-Mortem & Fix Analysis**:
  > OK it's done, I fixed it. Go to the setting ,search "control center" and enter, then scroll down, you can see the subtitle "Allow in the Munu Bar", and toggle on those apps you need.  <img width="711" height="608" alt="Image" src="https://github.com/user-attachments/assets/b19bee66-4333-4dde-a1e4-c2ba57d312a9" />

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

### Incident Patch 1: `e5d5504a` (2025-06-06)
**Commit Message**: Minor UI reworks

**File**: `Ice/UI/HotkeyRecorder/HotkeyRecorder.swift` (modified, +2/-2)
```diff
@@ -21,7 +21,7 @@ struct HotkeyRecorder<Label: View>: View {
                 leadingSegment
                 trailingSegment
             }
-            .frame(width: 130, height: 22)
+            .frame(width: 132, height: 24)
             .alignmentGuide(.firstTextBaseline) { dimension in
                 dimension[VerticalAlignment.center]
             }
@@ -108,7 +108,7 @@ struct HotkeyRecorder<Label: View>: View {
         Image(systemName: symbolString)
             .resizable()
             .aspectRatio(contentMode: .fill)
-            .padding(1)
+            .padding(2)
     }
 }
 
```

**File**: `Ice/UI/LayoutBar/LayoutBar.swift` (modified, +6/-7)
```diff
@@ -30,6 +30,10 @@ struct LayoutBar: View {
         appState.menuBarManager
     }
 
+    private var backgroundShape: some InsettableShape {
+        RoundedRectangle(cornerRadius: 9, style: .circular)
+    }
+
     init(section: MenuBarSection, spacing: CGFloat = 0) {
         self.section = section
         self.spacing = spacing
@@ -40,9 +44,9 @@ struct LayoutBar: View {
             .frame(height: 50)
             .frame(maxWidth: .infinity)
             .layoutBarStyle(appState: appState, averageColorInfo: menuBarManager.averageColorInfo)
-            .clipShape(roundedRectangle)
+            .clipShape(backgroundShape)
             .overlay {
-                roundedRectangle
+                backgroundShape
                     .stroke(.quaternary)
             }
     }
@@ -56,9 +60,4 @@ struct LayoutBar: View {
             Representable(appState: appState, section: section, spacing: spacing)
         }
     }
-
-    @ViewBuilder
-    private var roundedRectangle: some Shape {
-        RoundedRectangle(cornerRadius: 11, style: .continuous)
-    }
 }
```

---

### Incident Patch 2: `0d958d6e` (2025-01-22)
**Commit Message**: Fix possible retain cycle

**File**: `Ice/UI/IceBar/IceBar.swift` (modified, +2/-2)
```diff
@@ -55,15 +55,15 @@ final class IceBarPanel: NSPanel {
         .store(in: &c)
 
         if
-            let appState,
-            let section = appState.menuBarManager.section(withName: .hidden),
+            let section = appState?.menuBarManager.section(withName: .hidden),
             let window = section.controlItem.window
         {
             window.publisher(for: \.frame)
                 .debounce(for: 0.1, scheduler: DispatchQueue.main)
                 .sink { [weak self, weak window] _ in
                     guard
                         let self,
+                        let appState,
                         // Only continue if the menu bar is automatically hidden, as Ice
                         // can't currently display its menu bar items.
                         appState.menuBarManager.isMenuBarHiddenBySystemUserDefaults,
```

---

### Incident Patch 3: `a3f78d4b` (2025-01-14)
**Commit Message**: Revert "Update MenuBarItemManager.swift"

This reverts commit bd4ff51931a3082fcddc40e278f42d8afac6fda5.

**File**: `Ice/MenuBar/MenuBarItems/MenuBarItemManager.swift` (modified, +29/-6)
```diff
@@ -592,6 +592,15 @@ extension MenuBarItemManager {
         return CGPoint(x: currentFrame.midX, y: currentFrame.midY)
     }
 
+    /// Returns the target item for the given destination.
+    ///
+    /// - Parameter destination: The destination to get the target item from.
+    private func getTargetItem(for destination: MoveDestination) -> MenuBarItem {
+        switch destination {
+        case .leftOfItem(let targetItem), .rightOfItem(let targetItem): targetItem
+        }
+    }
+
     /// Returns a Boolean value that indicates whether the given item is in the
     /// correct position for the given destination.
     ///
@@ -911,12 +920,14 @@ extension MenuBarItemManager {
                 type: .move(.leftMouseDown),
                 location: CGPoint(x: currentFrame.midX, y: currentFrame.midY),
                 item: item,
+                pid: item.ownerPID,
                 source: source
             ),
             let mouseUpEvent = CGEvent.menuBarItemEvent(
                 type: .move(.leftMouseUp),
                 location: CGPoint(x: currentFrame.midX, y: currentFrame.midY),
                 item: item,
+                pid: item.ownerPID,
                 source: source
             )
         else {
@@ -959,24 +970,28 @@ extension MenuBarItemManager {
         let startPoint = CGPoint(x: 20_000, y: 20_000)
         let endPoint = try getEndPoint(for: destination)
         let fallbackPoint = try getFallbackPoint(for: item)
+        let targetItem = getTargetItem(for: destination)
 
         guard
             let mouseDownEvent = CGEvent.menuBarItemEvent(
                 type: .move(.leftMouseDown),
                 location: startPoint,
                 item: item,
+                pid: item.ownerPID,
                 source: source
             ),
             let mouseUpEvent = CGEvent.menuBarItemEvent(
                 type: .move(.leftMouseUp),
                 location: endPoint,
-                item: nil,
+                item: targetItem,
+                pid: item.ownerPID,
                 source: source
             ),
             let fallbackEvent = CGEvent.menuBarItemEvent(
                 type: .move(.leftMouseUp),
                 location: fallbackPoint,
-                item: nil,
+                item: item,
+                pid: item.ownerPID,
                 source: source
             )
         else {
@@ -1140,18 +1155,21 @@ extension MenuBarItemManager {
                 type: .click(buttonStates.down),
                 location: clickPoint,
                 item: item,
+                pid: item.ownerPID,
                 source: source
             ),
             let mouseUpEvent = CGEvent.menuBarItemEvent(
                 type: .click(buttonStates.up),
                 location: clickPoint,
                 item: item,
+                pid: item.ownerPID,
                 source: source
             ),
             let fallbackEvent = CGEvent.menuBarItemEvent(
                 type: .click(buttonStates.up),
                 location: clickPoint,
                 item: item,
+                pid: item.ownerPID,
                 source: source
             )
         else {
@@ -1577,9 +1595,10 @@ private extension CGEvent {
     /// - Parameters:
     ///   - type: The type of the event.
     ///   - location: The location of the event. Does not need to be within the bounds of the item.
-    ///   - item: The target item of the event, used to set the event's window. Can be `nil`.
-    ///   - source: The event source.
-    class func menuBarItemEvent(type: MenuBarItemEventType, location: CGPoint, item: MenuBarItem?, source: CGEventSource) -> CGEvent? {
+    ///   - item: The target item of the event.
+    ///   - pid: The target process identifier of the event. Does not need to be the item's `ownerPID`.
+    ///   - source: The source of the event.
+    class func menuBarItemEvent(type: MenuBarItemEventType, location: CGPoint, item: MenuBarItem, pid: pid_t, source: CGEventSource) -> CGEvent? {
         let mouseType = type.cgEventType
         let mouseButton = type.mouseButton
 
@@ -1589,10 +1608,14 @@ private extension CGEvent {
 
         event.flags = type.cgEventFlags
 
+        let targetPID = Int64(pid)
         let userData = Int64(truncatingIfNeeded: Int(bitPattern: ObjectIdentifier(event)))
-        let windowID = Int64(item?.windowID ?? kCGNullWindowID)
+        let windowID = Int64(item.windowID)
 
+        event.setIntegerValueField(.eventTargetUnixProcessID, value: targetPID)
         event.setIntegerValueField(.eventSourceUserData, value: userData)
+        event.setIntegerValueField(.mouseEventWindowUnderMousePointer, value: windowID)
+        event.setIntegerValueField(.mouseEventWindowUnderMousePointerThatCanHandleThisEvent, value: windowID)
         event.setIntegerValueField(.windowID, value: windowID)
 
         if case .click = type {
```

---

### Incident Patch 4: `d567f1ec` (2024-10-29)
**Commit Message**: Bump version and build numbers

**File**: `Ice.xcodeproj/project.pbxproj` (modified, +4/-4)
```diff
@@ -307,7 +307,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "Apple Development";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 1116;
+				CURRENT_PROJECT_VERSION = 1117;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "";
 				DEVELOPMENT_TEAM = K2ATHQPJDP;
@@ -323,7 +323,7 @@
 					"$(inherited)",
 					"@executable_path/../Frameworks",
 				);
-				MARKETING_VERSION = 0.11.11;
+				MARKETING_VERSION = 0.11.12;
 				PRODUCT_BUNDLE_IDENTIFIER = com.jordanbaird.Ice;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SWIFT_EMIT_LOC_STRINGS = YES;
@@ -340,7 +340,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "Apple Development";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 1116;
+				CURRENT_PROJECT_VERSION = 1117;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "";
 				DEVELOPMENT_TEAM = K2ATHQPJDP;
@@ -356,7 +356,7 @@
 					"$(inherited)",
 					"@executable_path/../Frameworks",
 				);
-				MARKETING_VERSION = 0.11.11;
+				MARKETING_VERSION = 0.11.12;
 				PRODUCT_BUNDLE_IDENTIFIER = com.jordanbaird.Ice;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SWIFT_EMIT_LOC_STRINGS = YES;
```

---

### Incident Patch 5: `5b11d6c3` (2024-10-21)
**Commit Message**: Fix missing items from hidden sections

**File**: `Ice/MenuBar/ItemManagement/MenuBarItemManager.swift` (modified, +2/-11)
```diff
@@ -181,9 +181,7 @@ final class MenuBarItemManager: ObservableObject {
                     return
                 }
                 Task {
-                    if(ScreenCapture.cachedCheckPermissions()) {
-                        await self.cacheItemsIfNeeded()
-                    }
+                    await self.cacheItemsIfNeeded()
                 }
             }
             .store(in: &c)
@@ -195,9 +193,7 @@ final class MenuBarItemManager: ObservableObject {
                     return
                 }
                 Task {
-                    if(ScreenCapture.cachedCheckPermissions()) {
-                        await self.cacheItemsIfNeeded()
-                    }
+                    await self.cacheItemsIfNeeded()
                 }
             }
             .store(in: &c)
@@ -317,11 +313,6 @@ extension MenuBarItemManager {
     /// Caches the current menu bar items if needed, ensuring that the control
     /// items are in the correct order.
     func cacheItemsIfNeeded() async {
-        guard ScreenCapture.cachedCheckPermissions() else {
-            logSkippingCache(reason: "Ice not having screen recording permission")
-            return
-        }
-        
         do {
             try await waitForItemsToStopMoving(timeout: .seconds(1))
         } catch is TaskTimeoutError {
```

---

### Incident Patch 6: `f24e08ad` (2024-10-19)
**Commit Message**: Bump version and build numbers

**File**: `Ice.xcodeproj/project.pbxproj` (modified, +4/-4)
```diff
@@ -307,7 +307,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "Apple Development";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 1115;
+				CURRENT_PROJECT_VERSION = 1116;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "";
 				DEVELOPMENT_TEAM = K2ATHQPJDP;
@@ -323,7 +323,7 @@
 					"$(inherited)",
 					"@executable_path/../Frameworks",
 				);
-				MARKETING_VERSION = 0.11.10;
+				MARKETING_VERSION = 0.11.11;
 				PRODUCT_BUNDLE_IDENTIFIER = com.jordanbaird.Ice;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SWIFT_EMIT_LOC_STRINGS = YES;
@@ -340,7 +340,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "Apple Development";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 1115;
+				CURRENT_PROJECT_VERSION = 1116;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "";
 				DEVELOPMENT_TEAM = K2ATHQPJDP;
@@ -356,7 +356,7 @@
 					"$(inherited)",
 					"@executable_path/../Frameworks",
 				);
-				MARKETING_VERSION = 0.11.10;
+				MARKETING_VERSION = 0.11.11;
 				PRODUCT_BUNDLE_IDENTIFIER = com.jordanbaird.Ice;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SWIFT_EMIT_LOC_STRINGS = YES;
```

---

### Incident Patch 7: `630f39e0` (2024-10-19)
**Commit Message**: Revert "Add title to search panel for accessibility"

This reverts commit 56021258994960c4fe80c65a10e483c34151f48c.

**File**: `Ice/MenuBar/Search/MenuBarSearchPanel.swift` (modified, +0/-1)
```diff
@@ -60,7 +60,6 @@ final class MenuBarSearchPanel: NSPanel {
             defer: false
         )
         self.appState = appState
-        self.title = "Menu Bar Search Panel"
         self.titlebarAppearsTransparent = true
         self.isMovableByWindowBackground = false
         self.animationBehavior = .none
```

---

### Incident Patch 8: `08e8cb75` (2024-10-14)
**Commit Message**: Bump version and build numbers

**File**: `Ice.xcodeproj/project.pbxproj` (modified, +4/-4)
```diff
@@ -307,7 +307,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "Apple Development";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 1114;
+				CURRENT_PROJECT_VERSION = 1115;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "";
 				DEVELOPMENT_TEAM = K2ATHQPJDP;
@@ -323,7 +323,7 @@
 					"$(inherited)",
 					"@executable_path/../Frameworks",
 				);
-				MARKETING_VERSION = 0.11.9;
+				MARKETING_VERSION = 0.11.10;
 				PRODUCT_BUNDLE_IDENTIFIER = com.jordanbaird.Ice;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SWIFT_EMIT_LOC_STRINGS = YES;
@@ -340,7 +340,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "Apple Development";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 1114;
+				CURRENT_PROJECT_VERSION = 1115;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "";
 				DEVELOPMENT_TEAM = K2ATHQPJDP;
@@ -356,7 +356,7 @@
 					"$(inherited)",
 					"@executable_path/../Frameworks",
 				);
-				MARKETING_VERSION = 0.11.9;
+				MARKETING_VERSION = 0.11.10;
 				PRODUCT_BUNDLE_IDENTIFIER = com.jordanbaird.Ice;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SWIFT_EMIT_LOC_STRINGS = YES;
```

---

### Incident Patch 9: `6ce5b1ba` (2024-10-13)
**Commit Message**: Conform TaskTimeoutError to LocalizedError

**File**: `Ice/Extensions/Task/Task+timeout.swift` (modified, +21/-2)
```diff
@@ -3,6 +3,8 @@
 //  Ice
 //
 
+import Foundation
+
 extension Task where Failure == any Error {
     /// Runs the given throwing operation asynchronously as part of a new top-level task
     /// on behalf of the current actor.
@@ -22,7 +24,12 @@ extension Task where Failure == any Error {
         operation: @escaping @Sendable () async throws -> Success
     ) {
         self.init(priority: priority) {
-            try await Task.run(operation: operation, withTimeout: timeout, tolerance: tolerance, clock: clock)
+            try await Task.run(
+                operation: operation,
+                withTimeout: timeout,
+                tolerance: tolerance,
+                clock: clock
+            )
         }
     }
 
@@ -45,7 +52,12 @@ extension Task where Failure == any Error {
         operation: @escaping @Sendable () async throws -> Success
     ) -> Task {
         Task.detached(priority: priority) {
-            try await Task.run(operation: operation, withTimeout: timeout, tolerance: tolerance, clock: clock)
+            try await Task.run(
+                operation: operation,
+                withTimeout: timeout,
+                tolerance: tolerance,
+                clock: clock
+            )
         }
     }
 
@@ -70,7 +82,14 @@ extension Task where Failure == any Error {
     }
 }
 
+// MARK: - TaskTimeoutError
+
 /// An error that indicates that a task timed out.
 struct TaskTimeoutError: Error, CustomStringConvertible {
     let description = "Task timed out before completion"
 }
+
+// MARK: TaskTimeoutError: LocalizedError
+extension TaskTimeoutError: LocalizedError {
+    var errorDescription: String? { description }
+}
```

---

### Incident Patch 10: `4be9543c` (2024-10-11)
**Commit Message**: Update menu bar search UI

**File**: `Ice/MenuBar/Search/MenuBarSearchPanel.swift` (modified, +24/-14)
```diff
@@ -207,14 +207,13 @@ private struct MenuBarSearchContentView: View {
 
                 Spacer()
 
-                ShowItemButton {
-                    guard
-                        let selection,
-                        let item = menuBarItem(for: selection)
-                    else {
-                        return
+                if
+                    let selection,
+                    let item = menuBarItem(for: selection)
+                {
+                    ShowItemButton(item: item) {
+                        performAction(for: item)
                     }
-                    performAction(for: item)
                 }
             }
             .padding(5)
@@ -293,7 +292,9 @@ private struct MenuBarSearchContentView: View {
 }
 
 private struct BottomBarButton<Content: View>: View {
+    @State private var frame = CGRect.zero
     @State private var isHovering = false
+    @State private var isPressed = false
 
     let content: Content
     let action: () -> Void
@@ -309,15 +310,25 @@ private struct BottomBarButton<Content: View>: View {
             .background {
                 VisualEffectView(material: .selection, blendingMode: .withinWindow)
                     .clipShape(RoundedRectangle(cornerRadius: 5, style: .circular))
-                    .opacity(isHovering ? 0.25 : 0)
+                    .opacity(isPressed ? 0.5 : isHovering ? 0.25 : 0)
             }
             .contentShape(Rectangle())
             .onHover { hovering in
                 isHovering = hovering
             }
-            .onTapGesture {
-                action()
-            }
+            .simultaneousGesture(
+                DragGesture(minimumDistance: 0)
+                    .onChanged { value in
+                        isPressed = frame.contains(value.location)
+                    }
+                    .onEnded { value in
+                        isPressed = false
+                        if frame.contains(value.location) {
+                            action()
+                        }
+                    }
+            )
+            .onFrameChange(update: $frame)
     }
 }
 
@@ -337,14 +348,13 @@ private struct SettingsButton: View {
 }
 
 private struct ShowItemButton: View {
-    @State private var isHovering = false
-
+    let item: MenuBarItem
     let action: () -> Void
 
     var body: some View {
         BottomBarButton(action: action) {
             HStack {
-                Text("Show item")
+                Text(item.isOnScreen ? "Click item" : "Show item")
                     .padding(.horizontal, 5)
 
                 Image(systemName: "return")
```

---

### Incident Patch 11: `6179b3a6` (2024-10-08)
**Commit Message**: Bump version and build numbers

**File**: `Ice.xcodeproj/project.pbxproj` (modified, +4/-4)
```diff
@@ -307,7 +307,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "Apple Development";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 1113;
+				CURRENT_PROJECT_VERSION = 1114;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "";
 				DEVELOPMENT_TEAM = K2ATHQPJDP;
@@ -323,7 +323,7 @@
 					"$(inherited)",
 					"@executable_path/../Frameworks",
 				);
-				MARKETING_VERSION = 0.11.8.1;
+				MARKETING_VERSION = 0.11.9;
 				PRODUCT_BUNDLE_IDENTIFIER = com.jordanbaird.Ice;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SWIFT_EMIT_LOC_STRINGS = YES;
@@ -340,7 +340,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "Apple Development";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 1113;
+				CURRENT_PROJECT_VERSION = 1114;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "";
 				DEVELOPMENT_TEAM = K2ATHQPJDP;
@@ -356,7 +356,7 @@
 					"$(inherited)",
 					"@executable_path/../Frameworks",
 				);
-				MARKETING_VERSION = 0.11.8.1;
+				MARKETING_VERSION = 0.11.9;
 				PRODUCT_BUNDLE_IDENTIFIER = com.jordanbaird.Ice;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SWIFT_EMIT_LOC_STRINGS = YES;
```

---

### Incident Patch 12: `30827bc2` (2024-10-05)
**Commit Message**: Fix smart rehide check for Sequoia

**File**: `Ice/Events/EventManager.swift` (modified, +1/-1)
```diff
@@ -215,7 +215,7 @@ extension EventManager {
                     let mouseLocation = MouseCursor.coreGraphicsLocation,
                     let windowUnderMouse = WindowInfo.getOnScreenWindows(excludeDesktopWindows: false)
                         .filter({ $0.layer < CGWindowLevelForKey(.cursorWindow) })
-                        .first(where: { $0.frame.contains(mouseLocation) }),
+                        .first(where: { $0.frame.contains(mouseLocation) && $0.title?.isEmpty == false }),
                     let owningApplication = windowUnderMouse.owningApplication
                 else {
                     return
```

---

### Incident Patch 13: `a2b3f6ce` (2024-10-05)
**Commit Message**: Bump version and build numbers

**File**: `Ice.xcodeproj/project.pbxproj` (modified, +4/-4)
```diff
@@ -307,7 +307,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "Apple Development";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 1112;
+				CURRENT_PROJECT_VERSION = 1113;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "";
 				DEVELOPMENT_TEAM = K2ATHQPJDP;
@@ -323,7 +323,7 @@
 					"$(inherited)",
 					"@executable_path/../Frameworks",
 				);
-				MARKETING_VERSION = 0.11.8;
+				MARKETING_VERSION = 0.11.8.1;
 				PRODUCT_BUNDLE_IDENTIFIER = com.jordanbaird.Ice;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SWIFT_EMIT_LOC_STRINGS = YES;
@@ -340,7 +340,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "Apple Development";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 1112;
+				CURRENT_PROJECT_VERSION = 1113;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "";
 				DEVELOPMENT_TEAM = K2ATHQPJDP;
@@ -356,7 +356,7 @@
 					"$(inherited)",
 					"@executable_path/../Frameworks",
 				);
-				MARKETING_VERSION = 0.11.8;
+				MARKETING_VERSION = 0.11.8.1;
 				PRODUCT_BUNDLE_IDENTIFIER = com.jordanbaird.Ice;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SWIFT_EMIT_LOC_STRINGS = YES;
```

---

### Incident Patch 14: `0b0c710e` (2024-10-05)
**Commit Message**: Hot fix to remove option for legacy inset

**File**: `Ice/MenuBar/Appearance/MenuBarAppearanceConfiguration.swift` (modified, +0/-5)
```diff
@@ -11,7 +11,6 @@ struct MenuBarAppearanceConfiguration: Hashable {
     var hasShadow: Bool
     var hasBorder: Bool
     var isInset: Bool
-    var useLegacyShapeInset: Bool
     var borderColor: CGColor
     var borderWidth: Double
     var shapeKind: MenuBarShapeKind
@@ -100,7 +99,6 @@ extension MenuBarAppearanceConfiguration {
         hasShadow: false,
         hasBorder: false,
         isInset: true,
-        useLegacyShapeInset: false,
         borderColor: .black,
         borderWidth: 1,
         shapeKind: .none,
@@ -118,7 +116,6 @@ extension MenuBarAppearanceConfiguration: Codable {
         case hasShadow
         case hasBorder
         case isInset
-        case useLegacyShapeInset
         case borderColor
         case borderWidth
         case shapeKind
@@ -135,7 +132,6 @@ extension MenuBarAppearanceConfiguration: Codable {
             hasShadow: container.decodeIfPresent(Bool.self, forKey: .hasShadow) ?? Self.defaultConfiguration.hasShadow,
             hasBorder: container.decodeIfPresent(Bool.self, forKey: .hasBorder) ?? Self.defaultConfiguration.hasBorder,
             isInset: container.decodeIfPresent(Bool.self, forKey: .isInset) ?? Self.defaultConfiguration.isInset,
-            useLegacyShapeInset: container.decodeIfPresent(Bool.self, forKey: .useLegacyShapeInset) ?? Self.defaultConfiguration.useLegacyShapeInset,
             borderColor: container.decodeIfPresent(CodableColor.self, forKey: .borderColor)?.cgColor ?? Self.defaultConfiguration.borderColor,
             borderWidth: container.decodeIfPresent(Double.self, forKey: .borderWidth) ?? Self.defaultConfiguration.borderWidth,
             shapeKind: container.decodeIfPresent(MenuBarShapeKind.self, forKey: .shapeKind) ?? Self.defaultConfiguration.shapeKind,
@@ -152,7 +148,6 @@ extension MenuBarAppearanceConfiguration: Codable {
         try container.encode(hasShadow, forKey: .hasShadow)
         try container.encode(hasBorder, forKey: .hasBorder)
         try container.encode(isInset, forKey: .isInset)
-        try container.encode(useLegacyShapeInset, forKey: .useLegacyShapeInset)
         try container.encode(CodableColor(cgColor: borderColor), forKey: .borderColor)
         try container.encode(borderWidth, forKey: .borderWidth)
         try container.encode(shapeKind, forKey: .shapeKind)
```

**File**: `Ice/MenuBar/Appearance/MenuBarAppearanceEditor/MenuBarAppearanceEditor.swift` (modified, +0/-14)
```diff
@@ -89,11 +89,6 @@ struct MenuBarAppearanceEditor: View {
                 shapePicker
                 isInset
             }
-            if appState.settingsManager.advancedSettingsManager.showAdvancedAppearanceSettings {
-                IceSection("Advanced") {
-                    useLegacyShapeInset
-                }
-            }
             if case .settings = location {
                 IceGroupBox {
                     AnnotationView(
@@ -203,13 +198,4 @@ struct MenuBarAppearanceEditor: View {
             )
         }
     }
-
-    @ViewBuilder
-    private var useLegacyShapeInset: some View {
-        Toggle(
-            "Use legacy shape inset",
-            isOn: appearanceManager.bindings.configuration.useLegacyShapeInset
-        )
-        .annotation("Apply a 1px inset to the menu bar shape")
-    }
 }
```

**File**: `Ice/MenuBar/Appearance/MenuBarOverlayPanel.swift` (modified, +10/-6)
```diff
@@ -448,8 +448,8 @@ private final class MenuBarOverlayPanelContentView: NSView {
 
     /// Returns a path in the given rectangle, with the given end caps,
     /// and inset by the given amounts.
-    private func shapePath(in rect: CGRect, leadingEndCap: MenuBarEndCap, trailingEndCap: MenuBarEndCap) -> NSBezierPath {
-        let insetRect: CGRect = if configuration.useLegacyShapeInset {
+    private func shapePath(in rect: CGRect, leadingEndCap: MenuBarEndCap, trailingEndCap: MenuBarEndCap, screen: NSScreen) -> NSBezierPath {
+        let insetRect: CGRect = if !screen.hasNotch {
             switch (leadingEndCap, trailingEndCap) {
             case (.square, .square):
                 CGRect(x: rect.origin.x, y: rect.origin.y + 1, width: rect.width, height: rect.height - 2)
@@ -518,7 +518,8 @@ private final class MenuBarOverlayPanelContentView: NSView {
         return shapePath(
             in: rect,
             leadingEndCap: info.leadingEndCap,
-            trailingEndCap: info.trailingEndCap
+            trailingEndCap: info.trailingEndCap,
+            screen: screen
         )
     }
 
@@ -580,18 +581,21 @@ private final class MenuBarOverlayPanelContentView: NSView {
             return shapePath(
                 in: rect,
                 leadingEndCap: info.leading.leadingEndCap,
-                trailingEndCap: info.trailing.trailingEndCap
+                trailingEndCap: info.trailing.trailingEndCap,
+                screen: screen
             )
         } else {
             let leadingPath = shapePath(
                 in: leadingPathBounds,
                 leadingEndCap: info.leading.leadingEndCap,
-                trailingEndCap: info.leading.trailingEndCap
+                trailingEndCap: info.leading.trailingEndCap,
+                screen: screen
             )
             let trailingPath = shapePath(
                 in: trailingPathBounds,
                 leadingEndCap: info.trailing.leadingEndCap,
-                trailingEndCap: info.trailing.trailingEndCap
+                trailingEndCap: info.trailing.trailingEndCap,
+                screen: screen
             )
             let path = NSBezierPath()
             path.append(leadingPath)
```

**File**: `Ice/Settings/SettingsManagers/AdvancedSettingsManager.swift` (modified, +0/-12)
```diff
@@ -30,10 +30,6 @@ final class AdvancedSettingsManager: ObservableObject {
     /// Time interval to temporarily show items for.
     @Published var tempShowInterval: TimeInterval = 15
 
-    /// A Boolean value that indicates whether to show the advanced settings
-    /// in the menu bar appearance pane.
-    @Published var showAdvancedAppearanceSettings = false
-
     /// Storage for internal observers.
     private var cancellables = Set<AnyCancellable>()
 
@@ -56,7 +52,6 @@ final class AdvancedSettingsManager: ObservableObject {
         Defaults.ifPresent(key: .canToggleAlwaysHiddenSection, assign: &canToggleAlwaysHiddenSection)
         Defaults.ifPresent(key: .showOnHoverDelay, assign: &showOnHoverDelay)
         Defaults.ifPresent(key: .tempShowInterval, assign: &tempShowInterval)
-        Defaults.ifPresent(key: .showAdvancedAppearanceSettings, assign: &showAdvancedAppearanceSettings)
     }
 
     private func configureCancellables() {
@@ -104,13 +99,6 @@ final class AdvancedSettingsManager: ObservableObject {
             }
             .store(in: &c)
 
-        $showAdvancedAppearanceSettings
-            .receive(on: DispatchQueue.main)
-            .sink { shouldShow in
-                Defaults.set(shouldShow, forKey: .showAdvancedAppearanceSettings)
-            }
-            .store(in: &c)
-
         cancellables = c
     }
 }
```

**File**: `Ice/Settings/SettingsPanes/AdvancedSettingsPane.swift` (modified, +0/-7)
```diff
@@ -31,7 +31,6 @@ struct AdvancedSettingsPane: View {
             IceSection {
                 hideApplicationMenus
                 showSectionDividers
-                showAdvancedAppearanceSettings
             }
             IceSection {
                 enableAlwaysHiddenSection
@@ -71,12 +70,6 @@ struct AdvancedSettingsPane: View {
             }
     }
 
-    @ViewBuilder
-    private var showAdvancedAppearanceSettings: some View {
-        Toggle("Show advanced appearance settings", isOn: manager.bindings.showAdvancedAppearanceSettings)
-            .annotation("Show advanced settings in the Menu Bar Appearance editor")
-    }
-
     @ViewBuilder
     private var enableAlwaysHiddenSection: some View {
         Toggle("Enable always-hidden section", isOn: manager.bindings.enableAlwaysHiddenSection)
```

**File**: `Ice/Utilities/Defaults.swift` (modified, +0/-1)
```diff
@@ -164,7 +164,6 @@ extension Defaults {
         case canToggleAlwaysHiddenSection = "CanToggleAlwaysHiddenSection"
         case showOnHoverDelay = "ShowOnHoverDelay"
         case tempShowInterval = "TempShowInterval"
-        case showAdvancedAppearanceSettings = "ShowAdvancedAppearanceSettings"
 
         // MARK: Menu Bar Appearance Settings
 
```

---

### Incident Patch 15: `f622dd02` (2024-10-05)
**Commit Message**: Bump version and build numbers

**File**: `Ice.xcodeproj/project.pbxproj` (modified, +4/-4)
```diff
@@ -307,7 +307,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "Apple Development";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 1111;
+				CURRENT_PROJECT_VERSION = 1112;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "";
 				DEVELOPMENT_TEAM = K2ATHQPJDP;
@@ -323,7 +323,7 @@
 					"$(inherited)",
 					"@executable_path/../Frameworks",
 				);
-				MARKETING_VERSION = 0.11.7;
+				MARKETING_VERSION = 0.11.8;
 				PRODUCT_BUNDLE_IDENTIFIER = com.jordanbaird.Ice;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SWIFT_EMIT_LOC_STRINGS = YES;
@@ -340,7 +340,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "Apple Development";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 1111;
+				CURRENT_PROJECT_VERSION = 1112;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "";
 				DEVELOPMENT_TEAM = K2ATHQPJDP;
@@ -356,7 +356,7 @@
 					"$(inherited)",
 					"@executable_path/../Frameworks",
 				);
-				MARKETING_VERSION = 0.11.7;
+				MARKETING_VERSION = 0.11.8;
 				PRODUCT_BUNDLE_IDENTIFIER = com.jordanbaird.Ice;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SWIFT_EMIT_LOC_STRINGS = YES;
```

#### Recent Merged Pull Requests:
- **PR #971** (closed): Prevent Ice Bar window ID overflow crash (@Capt-Lappland)
- **PR #962** (closed): Add uninstall instructions to README and fix grammar in FREQUENT_ISSUES (@davidnichols-ops)
- **PR #958** (closed): Release 2.5.1: enable always-hidden section by default (@teddychan)
- **PR #952** (closed): Allow MenuBarItemService XPC connection on builds without a Team Identifier (@djmango)
- **PR #941** (closed): Auto-hide menu bar items obscured by the notch (@defer2xn)
- **PR #933** (closed): Skip show-on-click when an overlay covers the menu bar (@AlexandrosAlexiou)
- **PR #927** (closed): Improve macOS 26 screen recording permission handling (@hkfi)
- **PR #903** (closed): Fix menu bar item identification and navigation on macOS Tahoe (@tabossert)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
