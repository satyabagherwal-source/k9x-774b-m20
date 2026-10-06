# Forensic Learning Record (Deep Inspection): mrkai77/Loop

> **Canonical Artifact**: `07_PROJECT_LEARNING/mrkai77-loop-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/mrkai77/Loop](https://github.com/mrkai77/Loop))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:08:37.908Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `mrkai77/Loop`
- **Description**: Window management made elegant.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 11719 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Loop/Accent Color/AccentColorController.swift`
```
//
//  AccentColorController.swift
//  Loop
//
//  Created by Kai Azim on 2025-09-06.
//

import Defaults
import Scribe
import SwiftUI

/// In charge of processing and storing an up-to-date version of the user's accent color(s), according to their settings.
/// Automatically refreshes when the user updates the following preferences: `accentColorMode`, `customAccentColor`, `useGradient` and `gradientColor`.
@Loggable
@MainActor
final class AccentColorController: ObservableObject {
    static let shared = AccentColorController()

    @Published var color1: Color = Defaults[.lastUsedAccentColor1]
    @Published var color2: Color = Defaults[.lastUsedAccentColor2]

    private let wallpaperProcessor = WallpaperProcessor()
    private var observationTask: Task<(), Never>?

    private init() {
        self.observationTask = Task { [weak self] in
            let updates = Defaults.updates(
                .accentColorMode,
                .customAccentColor,
                .useGradient,
                .gradientColor
            )

            for await _ in updates {
                guard
                    !Task.isCancelled,
                    let self
                else {
                    break
                }
                await refresh()
            }
        }
    }

    deinit {
        observationTask?.cancel()
    }

    func refresh(ignoreThrottle: Bool = false) async {
        switch Defaults[.accentColorMode] {
        case .system:
            log.info("Refreshing accent color based on system accent setting")
            color1 = Color.accentColor
            color2 = Defaults[.useGradient] ? Color(nsColor: NSColor.controlAccentColor.blended(withFraction: 0.5, of: .black)!) : Color.accentColor
        case .wallpaper:
            log.info("Refreshing accent color based on wallpaper analysis")
            let colors = await wallpaperProcessor.fetchLatest(ignoreThrottle: ignoreThrottle)
            color1 = colors.primary
            color2 = Defaults[.useGradient] ? colors.secondary : colors.primary
        case .custom:
            log.info("Refreshing accent color based on custom selection")
            color1 = Defaults[.customAccentColor]
            color2 = Defaults[.useGradient] ? Defaults[.gradientColor] : Defaults[.customAccentColor]
        }

        Defaults[.lastUsedAccentColor1] = color1
        Defaults[.lastUsedAccentColor2] = color2
    }
}

extension Color {
    static var systemGray: Color {
        Color(nsColor: NSColor.systemGray.blended(withFraction: 0.2, of: .black)!)
    }
}

```

### Core Architecture Module: `Loop/Accent Color/AccentColorOption.swift`
```
//
//  AccentColorOption.swift
//  Loop
//
//  Created by Kai Azim on 2025-09-07.
//

import Defaults
import SwiftUI

enum AccentColorOption: Int, Codable, Defaults.Serializable, CaseIterable {
    case system
    case wallpaper
    case custom

    var image: Image {
        switch self {
        case .system: Image(systemName: "apple.logo")
        case .wallpaper: Image(systemName: "photo")
        case .custom: Image(systemName: "eyedropper.halffull")
        }
    }

    var text: String {
        switch self {
        case .system: String(localized: "System", comment: "Accent color option")
        case .wallpaper: String(localized: "Wallpaper", comment: "Accent color option")
        case .custom: String(localized: "Custom", comment: "Accent color option")
        }
    }
}

```

### Core Architecture Module: `Loop/Accent Color/WallpaperImageFetcher.swift`
```
//
//  WallpaperImageFetcher.swift
//  Loop
//
//  Created by Kai Azim on 2025-07-26.
//

import SwiftUI

final class WallpaperImageFetcher {
    /// Bundle identifier for the wallpaper window process
    /// On macOS 27 and later, the wallpaper window is not owned by the dock but rather the window manager.
    private static let wallpaperOwnerBundleIDs: Set<String> = [
        "com.apple.dock",
        "com.apple.WindowManager"
    ]

    /// Takes a screenshot of the main display.
    /// - Returns: An NSImage of the screenshot or nil if the operation fails.
    ///
    /// This method attempts to capture the desktop wallpaper using three approaches:
    /// 1. First, it tries to find and capture the system wallpaper window directly that matches our screen dimensions
    /// 2. If that fails, it tries to capture any system wallpaper window  (even if not on our exact screen)
    /// 3. As a last resort, it falls back to capturing the entire screen
    ///
    /// The direct wallpaper capture is preferred as it gets only the wallpaper without desktop icons,
    /// but requires accessibility permissions (this is accepted required for Loop, so it's fine).
    /// The fallback ensures we still get colors even if permissions aren't granted.
    @concurrent
    func takeScreenshot() async throws -> NSImage? {
        let screen = NSScreen.screenWithMouse ?? NSScreen.main ?? NSScreen.screens[0]
        let screenFrame = screen.displayBounds

        // First try to get the wallpaper window from the system that matches our screen dimensions
        if let wallpaperImage = try? await captureSystemWallpaper(screenFrame: screenFrame, matchFrame: true) {
            return wallpaperImage
        }

        // Second fallback: try to get any wallpaper window, regardless of screen dimensions
        if let anyWallpaperImage = try? await captureSystemWallpaper(screenFrame: screenFrame, matchFrame: false) {
            return anyWallpaperImage
        }

        // Final fallback: capture the full screen if we couldn't get any wallpaper window
        if let fallbackImage = try? await captureFullScreen() {
            return fallbackImage
        }

        throw WallpaperProcessorError.screenshotFailed
    }

    /// Attempts to capture the wallpaper window from the Dock or WindowManager.
    /// - Parameters:
    ///   - screenFrame: The frame of the screen to capture.
    ///   - matchFrame: Whether to match the exact screen frame dimensions or get any wallpaper window.
    /// - Returns: An NSImage of the wallpaper or nil if the operation fails.
    ///
    /// This approach uses window capturing APIs to specifically target the systems wallpaper window.
    /// It requires appropriate permissions, but provides the cleanest capture of just the wallpaper.
    /// The method identifies the wallpaper window by filtering window properties from the Dock/WindowManager process.
    private func captureSystemWallpaper(screenFrame: CGRect, matchFrame: Bool) async throws -> NSImage? {
        // Get all windows and filter for the wallpaper windows
        let windows = CGWindowListCopyWindowInfo(.optionAll, kCGNullWindowID) as! [[CFString: Any]]
        var wallpaperWindows = windows
            .filter { window in
                guard let pid = window[kCGWindowOwnerPID] as? pid_t,
                      let bundleIdentifier = NSRunningApplication(processIdentifier: pid)?.bundleIdentifier
                else {
                    return false
                }
                return Self.wallpaperOwnerBundleIDs.contains(bundleIdentifier)
            }
            .filter { ($0[kCGWindowName] as? String ?? "").contains("Wallpaper") }
            .filter { $0[kCGWindowIsOnscreen] as? Int == 1 }
            .filter { ($0[kCGWindowLayer] as? Int ?? 0) <= CGWindowLevelForKey(.desktopWindow) }

        // Apply additional frame filtering only if matchFrame is true
        if matchFrame {
            wallpaperWindows = wallpaperWindows.filter { window in
                if let bounds = window[kCGWindowBounds] as? [String: CGFloat],
                   bounds["X"] == screenFrame.origin.x,
                   bounds["Y"] == screenFrame.origin.y,
                   bounds["Width"] == screenFrame.width,
                   bounds["Height"] == screenFrame.height {
                    true
                } else {
                    false
                }
            }
        }

        let windowIDs = wallpaperWindows.map { $0[kCGWindowNumber] as! CGWindowID }

        guard !windowIDs.isEmpty else {
            throw WallpaperProcessorError.noWallpaperWindowsFound
        }

        // Use the SkyLight API to capture high-quality images of the windows
        // This approach provides better results than the public APIs for this specific use case
        guard let image = SkyLightToolBelt.captureWindowList(windowIDs: windowIDs).first else {
            throw WallpaperProcessorError.wallpaperWindowCaptureFailed
        }

        return NSImage(cgImage: image, size: NSSize.zero)
    }

    /// Fallback method to capture the entire screen.
    /// This may include desktop icons and menubar, but it's better than nothing.
    /// - Returns: An NSImage of the screen or nil if the operation fails.
    ///
    /// This method uses the public CGWindowListCreateImage API to capture what's visible on screen.
    /// While this will include desktop icons and potentially other UI elements, it's a reliable
    /// fallback when we can't access the wallpaper window directly, and still provides
    /// useful color information in most cases.
    private func captureFullScreen() async throws -> NSImage? {
        let screen = NSScreen.screenWithMouse ?? NSScreen.main ?? NSScreen.screens[0]
        let rect = screen.frame

        guard let cgImage = CGWindowListCreateImage(
            rect,
            .optionOnScreenBelowWindow,
            kCGNullWindowID,
            [.shouldBeOpaque, .bestResolution]
        ) else {
            throw WallpaperProcessorError.screenshotFailed
        }

        return NSImage(cgImage: cgImage, size: NSSize.zero)
    }
}

```

### Core Architecture Module: `Loop/Accent Color/WallpaperProcessor.swift`
```
//
//  WallpaperProcessor.swift
//  Loop
//
//  Created by Kami on 27/06/2024.
//

import AppKit
import Defaults
import Scribe
import SwiftUI

// MARK: - Wallpaper processor errors

/// Represents errors that can occur during wallpaper processing.
enum WallpaperProcessorError: LocalizedError {
    case screenshotFailed
    case dominantColorsCalculationFailed
    case noWallpaperWindowsFound
    case wallpaperWindowCaptureFailed
    case imageResizeFailed
    case bitmapCreationFailed

    var errorDescription: String? {
        switch self {
        case .screenshotFailed:
            "Screenshot failed."
        case .dominantColorsCalculationFailed:
            "Failed to calculate dominant colors."
        case .noWallpaperWindowsFound:
            "No wallpaper windows found"
        case .wallpaperWindowCaptureFailed:
            "Failed to capture wallpaper window"
        case .imageResizeFailed:
            "Could not resize image."
        case .bitmapCreationFailed:
            "Failed to create bitmap image"
        }
    }
}

// MARK: - Wallpaper public function

/// Processes desktop wallpapers to extract colors for theming Loop.
/// This class provides methods to capture the current desktop wallpaper and extract
/// vibrant, visually appealing colors that can be used as accent colors in the UI.
@Loggable
final class WallpaperProcessor {
    private var lastProcessedDate: Date = .distantPast
    private var lastResult: (primary: Color, secondary: Color) = (.black, .black)

    /// Fetches the latest wallpaper colors, respecting a throttle period.
    /// This helps prevent excessive processing if called frequently, when the wallpaper is most likely unchanged.
    /// - Parameter ignoreThrottle: If true, the method will ignore the throttle and fetch colors immediately. This is useful when called from settings or manual triggers.
    func fetchLatest(ignoreThrottle: Bool = false) async -> (primary: Color, secondary: Color) {
        // Only proceed if the caller has chosen to ignore the throttle, or over 5 seconds have passed since the last refresh
        guard ignoreThrottle || lastProcessedDate.distance(to: .now) > 5.0 else {
            return lastResult
        }
        lastProcessedDate = .now

        // If we succeed in obtaining new colors, then return them
        if let newColors = await fetchLatestWallpaperColors() {
            lastResult = newColors
            return newColors
        }

        // If we didn't succeed, simply return the last set of valid colors
        return lastResult
    }

    /// Fetches the latest wallpaper colors and updates the app's theme settings.
    ///
    /// This method:
    /// 1. Captures the current wallpaper image
    /// 2. Processes it to extract dominant colors
    /// 3. Updates the app's accent color settings with the extracted colors
    ///
    /// The first (most vibrant) color is used as the primary accent color, while
    /// the second color is used as a gradient/secondary color. This provides
    /// a cohesive theme that matches the user's desktop environment.
    ///
    /// Note that you shouldn't call this method directly, but rather, call ``AccentColorController.refresh``.
    @concurrent
    private func fetchLatestWallpaperColors() async -> (primary: Color, secondary: Color)? {
        do {
            // Attempt to process the current wallpaper to get the dominant colors.
            let dominantColors = try await processCurrentWallpaper()

            // Sort the first two colors by their brightness
            // Using brightness sorting ensures that the brighter color is used as the primary accent,
            // which typically works better for UI elements that need good contrast
            let colors = dominantColors.prefix(2).sorted(by: { $0.brightness > $1.brightness })

            // Use the first dominant color or clear if none.
            let primaryColor = Color(colors.first ?? .clear)

            // Use the second dominant color if possible, otherwise return the primary color.
            let secondaryColor = colors.count > 1 ? Color(colors[1]) : primaryColor

            log.success("Successfully calculated dominant colors from wallpaper")

            return (primaryColor, secondaryColor)
        } catch {
            // If an error occurs, print the error description.
            log.error("Failed to fetch wallpaper colors: \(error.localizedDescription)")
            return nil
        }
    }

    /// Processes the current wallpaper and returns the dominant colors.
    /// - Throws: A WallpaperProcessorError if the screenshot fails or dominant colors cannot be calculated.
    /// - Returns: An array of NSColor representing the dominant colors.
    ///
    /// This method coordinates the wallpaper capture and color analysis process.
    /// It first attempts to capture a screenshot of the desktop wallpaper, then
    /// passes that image to the color analysis algorithm to extract vibrant,
    /// visually distinct colors suitable for UI accents.
    private func processCurrentWallpaper() async throws -> [NSColor] {
        let wallpaperImageFetcher = WallpaperImageFetcher()

        // Take a screenshot of the main display.
        guard let screenshot = try await wallpaperImageFetcher.takeScreenshot() else {
            // If taking a screenshot fails, throw an error.
            throw WallpaperProcessorError.screenshotFailed
        }

        // Calculate the dominant colors from the screenshot.
        let dominantColors = await screenshot.calculateDominantColors()

        // Ensure that dominant colors are calculated and the array is not empty.
        guard let colors = dominantColors, !colors.isEmpty else {
            // If no colors are found, throw an error.
            throw WallpaperProcessorError.dominantColorsCalculationFailed
        }

        return colors
    }
}

// MARK: - NSImage extensions

///
/// This implementation provides an advanced color extraction algorithm that:
/// - Efficiently processes desktop wallpaper images to extract vibrant colors
/// - Prioritizes visually appealing accent colors over technically dominant ones
/// - Uses a multi-step fallback approach to ensure it works across different permission scenarios
/// - Incorporates intelligent filtering to avoid colors that would make poor UI accents
///
/// The algorithm is optimized for performance while maintaining high-quality color results.
/// The real beans here (I don't like beans)
extension NSImage {
    /// Calculates the dominant colors of the image asynchronously.
    /// - Returns: An array of NSColor representing the dominant colors, or nil if an error occurs.
    /// Optimized to return only the top 2 most vibrant and visually distinct colors.
    ///
    /// This method prioritizes colors with high saturation and medium brightness to find
    /// visually appealing accent colors suitable for UI themes. The algorithm:
    /// 1. Resizes the image to improve performance
    /// 2. Samples pixels (skipping every other pixel to improve speed)
    /// 3. Uses a quantization technique to group similar colors
    /// 4. Scores colors based on both frequency and visual quality (saturation and balanced brightness)
    /// 5. Ensures the returned colors are visually distinct from each other
    ///
    /// The scoring system is designed to favor vibrant colors over dull ones, even if the
    /// dull colors appear more frequently in the image. This approach works well for extracting
    /// accent colors from wallpapers, which often have subtle variation in dominant colors.
    func calculateDominantColors() async -> [NSColor]? {
        // Resize the image to a smaller size to improve performance
        let aspectRatio = size.width / size.height
        let resizedImage = resized(to: NSSize(width: 100 * aspectRatio, height: 100))

        guard
            let resizedCGImage = resizedImage?.cgImage(forProposedRect: nil, context: nil, hints: nil),
            let dataProvider = resizedCGImage.dataProvider,
            let data = CFDataGetBytePtr(dataProvider.data)
        else {
            Log.error("Error: \(WallpaperProcessorError.imageResizeFailed)", category: WallpaperProcessor.logCategory)
            return nil
        }

        let bytesPerPixel = resizedCGImage.bitsPerPixel / 8
        let bytesPerRow = resizedCGImage.bytesPerRow
        let width = resizedCGImage.width
        let height = resizedCGImage.height

        // Use a lower quantization level to better group similar colors
        // The value of 32 provides enough color differentiation while still grouping similar shades
        let quantizationLevel = 32.0

        // Use a dictionary to count color occurrences
        // We use integer keys for better performance compared to using NSColor as keys
        var colorCounts = [Int: Int]() // [ColorKey: Count]
        var colorMap = [Int: NSColor]() // [ColorKey: ActualColor]

        // Sample every 2nd pixel for better performance
        // This significantly speeds up processing with minimal impact on accuracy
        for y in stride(from: 0, to: height, by: 2) {
            for x in stride(from: 0, to: width, by: 2) {
                let pixelData = Int(y * bytesPerRow + x * bytesPerPixel)

                let red = CGFloat(data[pixelData]) / 255.0
                let green = CGFloat(data[pixelData + 1]) / 255.0
                let blue = CGFloat(data[pixelData + 2]) / 255.0
                let alpha = (bytesPerPixel == 4) ? CGFloat(data[pixelData + 3]) / 255.0 : 1.0

                // Skip fully transparent pixels
                if alpha < 0.1 { continue }

                // Simple quantization - this maps similar colors to the same key
                // Converting to integers reduces memory usage and improves comparison speed
                let quantizedRed = Int(round(red * quantizationLevel))
                let quantizedGreen = Int(round(green * quantizationLevel))
               
```

### Core Architecture Module: `Loop/App/AppDelegate+UNNotifications.swift`
```
//
//  AppDelegate+UNNotifications.swift
//  Loop
//
//  Created by Kai Azim on 2024-06-03.
//

import Scribe
import SwiftUI
import UserNotifications

extension AppDelegate: UNUserNotificationCenterDelegate {
    func userNotificationCenter(
        _: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> ()
    ) {
        if response.actionIdentifier == "setIconAction",
           let icon = response.notification.request.content.userInfo["icon"] as? String {
            IconManager.setAppIcon(to: icon)
        }

        completionHandler()
    }

    /// Implementation is necessary to show notifications even when the app has focus!
    func userNotificationCenter(
        _: UNUserNotificationCenter,
        willPresent _: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> ()
    ) {
        completionHandler([.banner])
    }

    static func requestNotificationAuthorization() {
        UNUserNotificationCenter.current().requestAuthorization(
            options: [.alert]
        ) { accepted, error in
            if !accepted {
                Log.warn("Notification access denied.", category: AppDelegate.logCategory)
            }

            if let error {
                Log.error("Failed to request notification authorization: \(error.localizedDescription)", category: AppDelegate.logCategory)
            }
        }
    }

    private static func registerNotificationCategories() {
        let setIconAction = UNNotificationAction(
            identifier: "setIconAction",
            title: String(localized: "Use This Icon", comment: "Notification action button that sets the newly unlocked icon as Loop's icon"),
            options: .destructive
        )
        let notificationCategory = UNNotificationCategory(
            identifier: "icon_unlocked",
            actions: [setIconAction],
            intentIdentifiers: []
        )
        UNUserNotificationCenter.current().setNotificationCategories([notificationCategory])
    }

    static func areNotificationsEnabled() -> Bool {
        let group = DispatchGroup()
        group.enter()

        var notificationsEnabled = false

        UNUserNotificationCenter.current().getNotificationSettings { notificationSettings in
            notificationsEnabled = notificationSettings.authorizationStatus != UNAuthorizationStatus.denied
            group.leave()
        }

        group.wait()
        return notificationsEnabled
    }

    static func sendNotification(_ content: UNMutableNotificationContent) {
        let uuidString = UUID().uuidString
        let request = UNNotificationRequest(
            identifier: uuidString,
            content: content,
            trigger: nil
        )

        requestNotificationAuthorization()
        registerNotificationCategories()

        UNUserNotificationCenter.current().add(request)
    }

    static func sendNotification(_ title: String, _ body: String) {
        let content = UNMutableNotificationContent()

        content.title = title
        content.body = body
        content.categoryIdentifier = UUID().uuidString

        AppDelegate.sendNotification(content)
    }
}

```

### Core Architecture Module: `Loop/App/AppDelegate.swift`
```
//
//  AppDelegate.swift
//  Loop
//
//  Created by Kai Azim on 2023-10-05.
//

import Darwin
import Defaults
import Scribe
import SwiftUI
import UserNotifications

@Loggable
final class AppDelegate: NSObject, NSApplicationDelegate {
    private let urlCommandHandler = URLCommandHandler()

    private static let terminateNotificationName = Notification.Name("com.MrKai77.Loop.terminate")
    private var terminateObserver: Any?

    private var launchedAsLoginItem: Bool {
        guard let event = NSAppleEventManager.shared().currentAppleEvent else { return false }
        return
            event.eventID == kAEOpenApplication &&
            event.paramDescriptor(forKeyword: keyAEPropData)?.enumCodeValue == keyAELaunchedAsLogInItem
    }

    func applicationDidFinishLaunching(_: Notification) {
        configureLogging()
        DefaultsiCloudSyncRegistrar.register()

        // Register before broadcasting so other instances can receive the signal
        registerTerminateObserver()

        let dataPatcherTask = Task { @MainActor in
            await Defaults.iCloud.waitForSyncCompletion()
            DataPatcher.run()
        }

        // Show settings window only if not launched as login item AND startHidden is disabled
        if !launchedAsLoginItem, !Defaults[.startHidden] {
            SettingsWindowManager.shared.show()
        } else {
            // Closing also hides the dock icon if needed.
            SettingsWindowManager.shared.close()
        }

        IconManager.refreshCurrentAppIcon()
        LaunchAtLoginManager.shared.start()

        UNUserNotificationCenter.current().delegate = self
        AppDelegate.requestNotificationAuthorization()

        // Register for URL handling
        NSAppleEventManager.shared().setEventHandler(
            self,
            andSelector: #selector(handleGetURLEvent(_:withReplyEvent:)),
            forEventClass: AEEventClass(kInternetEventClass),
            andEventID: AEEventID(kAEGetURL)
        )

        // Wait for other instances to fully exit before installing event taps to prevent conflicts
        Task { @MainActor in
            await dataPatcherTask.value

            let stalePIDs = broadcastTerminateToOtherInstances()
            await waitForInstancesToExit(pids: stalePIDs, timeout: .seconds(3))
            LoopManager.shared.start()
            WindowDragManager.shared.addObservers()
            StashManager.shared.start()
            AccessibilityManager.requestAccess()

            // Wait for the app to settle before showing the update window
            try? await Task.sleep(for: .seconds(5))
            await Updater.shared.fetchLatestInfo()
            await Updater.shared.showUpdateWindowIfEligible()
        }
    }

    /// Subscribes to the terminate notification so this instance shuts down when a newer Loop instance launches.
    private func registerTerminateObserver() {
        terminateObserver = DistributedNotificationCenter.default().addObserver(
            forName: Self.terminateNotificationName,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            guard let self else { return }

            // Ignore our own broadcast (for obvious reasons)
            if let senderPID = notification.userInfo?["pid"] as? Int,
               senderPID == Int(ProcessInfo.processInfo.processIdentifier) {
                return
            }

            log.info("Received terminate broadcast from newer Loop instance, shutting down")
            NSApp.terminate(nil)
        }
    }

    /// Sends the terminate notification to any other running Loop instances, and returns their PIDs.
    @discardableResult
    private func broadcastTerminateToOtherInstances() -> [pid_t] {
        let currentPID = ProcessInfo.processInfo.processIdentifier
        let bundleId = Bundle.main.bundleIdentifier ?? "com.MrKai77.Loop"

        let otherInstances = NSWorkspace.shared.runningApplications.filter {
            $0.bundleIdentifier == bundleId && $0.processIdentifier != currentPID
        }

        guard !otherInstances.isEmpty else {
            log.info("No other Loop instances found")
            return []
        }

        log.info("Found \(otherInstances.count) other Loop instance(s), broadcasting terminate notification")

        DistributedNotificationCenter.default().post(
            name: Self.terminateNotificationName,
            object: nil,
            userInfo: ["pid": Int(currentPID)]
        )

        return otherInstances.map(\.processIdentifier)
    }

    /// Waits until all provided PIDs have exited, or until the timeout is reached.
    private func waitForInstancesToExit(pids: [pid_t], timeout: Duration) async {
        guard !pids.isEmpty else { return }

        let deadline = ContinuousClock.now + timeout

        while ContinuousClock.now < deadline {
            let allGone = pids.allSatisfy { NSRunningApplication(processIdentifier: $0) == nil }
            if allGone {
                log.info("All prior Loop instances have exited")
                return
            }
            try? await Task.sleep(for: .milliseconds(100))
        }

        let surviving = pids.filter { NSRunningApplication(processIdentifier: $0) != nil }
        if !surviving.isEmpty {
            log.warn("Timed out waiting for prior Loop instances to exit, force killing \(surviving.count) instance(s)")
            for pid in surviving {
                kill(pid, SIGKILL)
            }
        }
    }

    /// Applies baseline logging configuration for Scribe.
    private func configureLogging() {
        LogManager.shared.configuration.includeFileAndLineNumber = false
    }

    @objc func handleGetURLEvent(_ event: NSAppleEventDescriptor, withReplyEvent _: NSAppleEventDescriptor) {
        guard let urlString = event.paramDescriptor(forKeyword: keyDirectObject)?.stringValue,
              let url = URL(string: urlString) else {
            log.info("Failed to get URL from event")
            return
        }

        log.info("Received URL: \(url)")
        urlCommandHandler.handle(url)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_: NSApplication) -> Bool {
        SettingsWindowManager.shared.close()
        return false
    }

    func applicationShouldHandleReopen(_: NSApplication, hasVisibleWindows _: Bool) -> Bool {
        SettingsWindowManager.shared.show()
        return true
    }

    func applicationShouldTerminate(_: NSApplication) -> NSApplication.TerminateReply {
        // LoopManager and WindowDragManager are explicitly shut down so that their
        // event monitors are stopped immediately (in case they are active)
        LoopManager.shared.shutdown()
        WindowDragManager.shared.shutdown()
        StashManager.shared.shutdown()
        return .terminateNow
    }

    func application(_: NSApplication, open urls: [URL]) {
        for url in urls {
            urlCommandHandler.handle(url)
        }
    }
}

```

### Core Architecture Module: `Loop/App/DataPatcher.swift`
```
//
//  DataPatcher.swift
//  Loop
//
//  Created by Kai Azim on 2025-09-07.
//

import AppKit
import Defaults
import Scribe

@Loggable(style: .static)
enum DataPatcher {
    static func run() {
        let initialPatches: Patches = Defaults[.patchesApplied]

        runPatchIfNeeded(patch: .changeToAccentColorMode, initialPatches: initialPatches) {
            // Migrate to accent color mode
            // We need to migrate `useSystemAccentColor` and `processWallpaper` over to `accentColorMode`
            let useSystemAccentColor: Bool = Defaults[.useSystemAccentColor]
            let processWallpaper: Bool = Defaults[.processWallpaper]

            if useSystemAccentColor {
                Defaults[.accentColorMode] = .system
            } else if processWallpaper {
                Defaults[.accentColorMode] = .wallpaper
            } else {
                Defaults[.accentColorMode] = .custom
            }

            Defaults.reset(.useSystemAccentColor)
            Defaults.reset(.processWallpaper)
        }

        runPatchIfNeeded(patch: .removeRevealedStashedWindows, initialPatches: initialPatches) {
            Defaults.reset(.stashManagerRevealedWindows)
        }

        runPatchIfNeeded(patch: .changeTohideOnNoSelection, initialPatches: initialPatches) {
            Defaults[.hideOnNoSelection] = Defaults[.hideUntilDirectionIsChosen]
            Defaults.reset(.hideUntilDirectionIsChosen)
        }

        runPatchIfNeeded(patch: .splitRadialMenuPresentationPolicies, initialPatches: initialPatches) {
            let hideOnNoSelection = Defaults[.hideOnNoSelection] || Defaults[.hideUntilDirectionIsChosen]
            Defaults[.hideOnNoSelectionForKeybinds] = hideOnNoSelection
            Defaults[.hideOnNoSelectionForGestures] = hideOnNoSelection
            Defaults.reset(.hideOnNoSelection)
            Defaults.reset(.hideUntilDirectionIsChosen)
        }

        runPatchIfNeeded(patch: .keepCustomizedPreviewBackground, initialPatches: initialPatches) {
            // Users who changed the blur or accent opacity keep the custom background
            let blurKey = Defaults.Keys.previewBackgroundEnableBlur
            let accentKey = Defaults.Keys.previewBackgroundAccentOpacity
            let customizedBlur = UserDefaults.standard.object(forKey: blurKey.name) != nil
                && Defaults[blurKey] != blurKey.defaultValue
            let customizedAccent = UserDefaults.standard.object(forKey: accentKey.name) != nil
                && Defaults[accentKey] != accentKey.defaultValue

            if customizedBlur || customizedAccent {
                Defaults[.previewBackgroundStyle] = .custom
            }
        }
    }

    private static func runPatchIfNeeded(patch: Patches, initialPatches: Patches, with callback: () -> ()) {
        if !initialPatches.contains(patch) {
            callback()

            Defaults[.patchesApplied].formUnion(patch)
            log.info("Ran patch \(patch)")
        }
    }

    struct Patches: OptionSet, Defaults.Serializable {
        let rawValue: Int

        /// Changed accent color configuration from multiple bools to an enum
        static let changeToAccentColorMode = Self(rawValue: 1 << 0)

        /// Revealed statshed windows are no longer persisted across Loop lifecycles
        static let removeRevealedStashedWindows = Self(rawValue: 1 << 1)

        /// Key was renamed from `hideUntilDirectionIsChosen` to `hideOnNoSelection` with slightly different behavior
        static let changeTohideOnNoSelection = Self(rawValue: 1 << 2)

        /// Split the global no-selection setting into trigger-specific presentation policies.
        static let splitRadialMenuPresentationPolicies = Self(rawValue: 1 << 3)

        /// The preview background now defaults to the system style, so users who customized it keep the custom style.
        static let keepCustomizedPreviewBackground = Self(rawValue: 1 << 4)
    }
}

// MARK: - Migrated keys (private)

// swiftformat:disable docComments
private extension Defaults.Keys {
    // StashManager
    static let stashManagerRevealedWindows = Key<Set<CGWindowID>>("stashManagerRevealed", default: Set<CGWindowID>())

    // AccentColorController
    static let useSystemAccentColor = Key<Bool>("useSystemAccentColor", default: true)
    static let processWallpaper = Key<Bool>("processWallpaper", default: false)

    // IndicatorService
    static let hideOnNoSelection = Key<Bool>("hideOnNoSelection", default: false)
    static let hideUntilDirectionIsChosen = Key<Bool>("hideUntilDirectionIsChosen", default: false)
}

```

### Core Architecture Module: `Loop/App/LaunchAtLoginManager.swift`
```
//
//  LaunchAtLoginManager.swift
//  Loop
//
//  Created by Kai Azim on 2026-01-21.
//

import Defaults
import Scribe
import ServiceManagement

@Loggable
@MainActor
final class LaunchAtLoginManager {
    static let shared = LaunchAtLoginManager()

    private var observationTask: Task<(), Never>?

    private init() {
        self.observationTask = Task { [weak self] in
            for await launchAtLogin in Defaults.updates(.launchAtLogin, initial: false) {
                guard !Task.isCancelled, let self else { break }
                await setLaunchAtLogin(launchAtLogin)
            }
        }
    }

    deinit {
        observationTask?.cancel()
    }

    func start() {
        Task {
            await setLaunchAtLogin(Defaults[.launchAtLogin])
        }
    }

    private func setLaunchAtLogin(_ enabled: Bool) async {
        let currentlyEnabled = SMAppService.mainApp.status == .enabled
        guard enabled != currentlyEnabled else {
            return
        }

        do {
            if enabled {
                try SMAppService.mainApp.register()
                log.info("Registered login item")
            } else {
                try await SMAppService.mainApp.unregister()
                log.info("Unregistered login item")
            }
        } catch {
            log.error("Failed to \(enabled ? "register" : "unregister") login item: \(error.localizedDescription)")
        }
    }
}

```

### Core Architecture Module: `Loop/App/LoopApp.swift`
```
//
//  LoopApp.swift
//  Loop
//
//  Created by Kai Azim on 2023-01-23.
//

import Defaults
import SwiftUI

@main
struct LoopApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @ObservedObject private var updater = Updater.shared
    @Default(.hideMenuBarIcon) var hideMenuBarIcon

    var body: some Scene {
        MenuBarExtra(Bundle.main.appName, image: "menubarIcon", isInserted: Binding.constant(!hideMenuBarIcon)) {
            Button {
                if let url = URL(string: "https://github.com/sponsors/MrKai77") {
                    NSWorkspace.shared.open(url)
                }
            } label: {
                Label("Donate", systemImage: "heart")
            }

            Divider()

            Text(
                "Version \(VersionDisplay.current.fullDisplay)",
                comment: "Format: Version [version, e.g. 1.3.0] ([build number, e.g. 1500])"
            )
            .font(.system(size: 11, weight: .semibold))

            Button {
                Task {
                    await updater.fetchLatestInfo()
                    await updater.showUpdateWindowIfEligible()
                }
            } label: {
                if updater.updateState == .available {
                    Text(
                        "Update…",
                        comment: "Button to update app in menubar dropdown menu"
                    )
                } else {
                    Text(
                        "Check for Updates…",
                        comment: "Button to check for updates in menubar dropdown menu"
                    )
                }
            }

            Button("Settings…") {
                SettingsWindowManager.shared.show()
            }
            .keyboardShortcut(",", modifiers: .command)

            Divider()

            Button("Quit \(Bundle.main.appName)") {
                NSApp.terminate(nil)
            }
            .keyboardShortcut("q", modifiers: .command)
        }
        .menuBarExtraStyle(.menu)
    }
}

```

### Core Architecture Module: `Loop/Core/LoopManager.swift`
```
//
//  LoopManager.swift
//  Loop
//
//  Created by Kai Azim on 2023-08-15.
//

import Defaults
import os
import Scribe
import SwiftUI

@Loggable
@MainActor
final class LoopManager {
    static let shared = LoopManager()
    private init() {}

    /// Context for the current resize operation, tracking frame and edge adjustment state.
    /// Initialized when Loop opens with a target window and screen.
    private(set) var resizeContext: ResizeContext = .init()

    private let windowActionCache = WindowActionCache()
    private let indicatorService = WindowActionIndicatorService()
    private let updater = Updater.shared

    private var accessibilityCheckerTask: Task<(), Never>?
    private var gestureToggleTask: Task<(), Never>?

    /// Opening prepares resizeContext asynchronously. We track that setup separately
    /// so rapid trigger events cannot act on the previous/default context.
    private var isLoopOpening: Bool = false
    private var pendingOpeningAction: WindowAction?
    private var shouldCancelOpening: Bool = false
    private var hideIndicatorOnNoSelection = false
    private var actionRevision: UInt64 = 0

    private(set) var isLoopActive: Bool = false {
        didSet {
            let value = isLoopActive
            isLoopActiveMirror.withLock { $0 = value }
        }
    }

    private let isLoopActiveMirror = OSAllocatedUnfairLock<Bool>(initialState: false)
    nonisolated var isLoopActiveAtomic: Bool {
        isLoopActiveMirror.withLock { $0 }
    }

    private let hasParentCycleActionMirror = OSAllocatedUnfairLock<Bool>(initialState: false)
    nonisolated var hasParentCycleActionAtomic: Bool {
        hasParentCycleActionMirror.withLock { $0 }
    }

    private lazy var triggerKeyTimeoutTimer = TriggerKeyTimeoutTimer(
        closeCallback: { [weak self] forceClose in
            Task { await self?.closeLoop(forceClose: forceClose) }
        }
    )

    private(set) lazy var keybindTrigger = KeybindTrigger(
        windowActionCache: windowActionCache,
        openCallback: { [weak self] action in
            Task {
                try? await self?.openLoop(
                    startingAction: action,
                    hideIndicatorOnNoSelection: Defaults[.hideOnNoSelectionForKeybinds]
                )
            }
        },
        closeCallback: { [weak self] forceClose in
            Task {
                await self?.closeLoop(forceClose: forceClose)
            }
        },
        checkIfLoopOpen: { [weak self] in
            self?.isLoopActiveAtomic ?? false
        }
    )

    private(set) lazy var middleClickTrigger = MiddleClickTrigger(
        openCallback: { [weak self] action in
            Task {
                try? await self?.openLoop(
                    startingAction: action,
                    hideIndicatorOnNoSelection: Defaults[.hideOnNoSelectionForKeybinds]
                )
            }
        },
        closeCallback: { [weak self] forceClose in
            Task {
                await self?.closeLoop(forceClose: forceClose)
            }
        },
        checkIfLoopOpen: { [weak self] in self?.isLoopActiveAtomic ?? false }
    )

    private(set) lazy var multitouchTrigger = MultitouchTrigger(
        windowActionCache: windowActionCache,
        openCallback: { [weak self] action, window in
            guard let self else { return .cancelled }
            return try await openLoop(
                startingAction: action,
                window: window,
                hideIndicatorOnNoSelection: Defaults[.hideOnNoSelectionForGestures]
            )
        },
        closeCallback: { [weak self] forceClose in
            Task {
                await self?.closeLoop(forceClose: forceClose)
            }
        },
        changeAction: { [weak self] action, reverse, canAdvanceCycle in
            Task {
                await self?.changeAction(
                    action,
                    canAdvanceCycle: canAdvanceCycle,
                    resumeCycleProgress: true,
                    reverse: reverse
                )
            }
        },
        checkIfLoopOpen: { [weak self] in
            self?.isLoopActive ?? false
        }
    )

    private(set) lazy var mouseInteractionObserver = MouseInteractionObserver(
        windowActionCache: windowActionCache,
        changeAction: { [weak self] newAction in
            Task {
                // If the mouse moved, that means that the keybind trigger should no longer passthrough special events such as the emoji key.
                self?.keybindTrigger.canPassthroughNextSpecialEvent = false
                await self?.changeAction(newAction, canAdvanceCycle: false)
            }
        },
        advanceSelectedAction: { [weak self] selectedAction in
            Task {
                guard let self else { return }

                if let selectedAction, selectedAction.id != self.resizeContext.action.id {
                    return
                }

                if let selectedAction {
                    await self.changeAction(
                        selectedAction,
                        disableHapticFeedback: true,
                        canAdvanceCycle: false
                    )
                } else if let parent = self.resizeContext.parentAction {
                    await self.changeAction(
                        parent,
                        disableHapticFeedback: true,
                        canAdvanceCycle: true
                    )
                }
            }
        },
        canSelectNextCycleitem: { [weak self] in
            self?.hasParentCycleActionAtomic ?? false
        },
        checkIfLoopOpen: { [weak self] in self?.isLoopActiveAtomic ?? false }
    )

    func start() {
        accessibilityCheckerTask = Task(priority: .background) { [weak self] in
            for await status in AccessibilityManager.shared.stream(initial: true) {
                guard let self, !Task.isCancelled else {
                    return
                }

                if status {
                    await keybindTrigger.start()
                    middleClickTrigger.start()
                    if Defaults[.enableGestures] {
                        multitouchTrigger.start()
                    }
                } else {
                    keybindTrigger.stop()
                    middleClickTrigger.stop()
                    multitouchTrigger.stop()
                }
            }
        }

        gestureToggleTask = Task(priority: .background) { [weak self] in
            for await enabled in Defaults.updates(.enableGestures, initial: false) {
                guard let self, !Task.isCancelled else { break }

                if enabled, AccessibilityManager.shared.isGranted {
                    multitouchTrigger.start()
                } else {
                    multitouchTrigger.stop()
                }
            }
        }
    }

    func shutdown() {
        actionRevision += 1

        accessibilityCheckerTask?.cancel()
        accessibilityCheckerTask = nil
        gestureToggleTask?.cancel()
        gestureToggleTask = nil

        indicatorService.closeAll()

        keybindTrigger.stop()
        middleClickTrigger.stop()
        mouseInteractionObserver.stop()
        multitouchTrigger.shutdown()
        triggerKeyTimeoutTimer.cancel()

        isLoopOpening = false
        pendingOpeningAction = nil
        shouldCancelOpening = false
        isLoopActive = false
        hasParentCycleActionMirror.withLock { $0 = false }
    }
}

enum LoopManagerError: LocalizedError {
    case accessibilityNotGranted
    case appExcluded
    case fullscreenWindow
    case missionControlShowing

    var errorDescription: String? {
        switch self {
        case .accessibilityNotGranted:
            "Cannot open Loop: accessibility permission not granted"
        case .appExcluded:
            "Cannot open Loop: app is excluded"
        case .fullscreenWindow:
            "Cannot open Loop: target window is fullscreen"
        case .missionControlShowing:
            "Cannot open Loop: Mission Control or App Exposé is showing"
        }
    }
}

enum LoopOpenResult {
    case opened
    case alreadyOpening
    case alreadyOpen
    case cancelled
}

// MARK: - Opening/Closing Loop

extension LoopManager {
    private func openLoop(
        startingAction: WindowAction,
        window: Window? = nil,
        hideIndicatorOnNoSelection: Bool
    ) async throws -> LoopOpenResult {
        guard AccessibilityManager.shared.isGranted else {
            throw LoopManagerError.accessibilityNotGranted
        }

        guard !MissionControl.isShowing else {
            throw LoopManagerError.missionControlShowing
        }

        guard !isLoopOpening else {
            if startingAction.direction != .noSelection {
                pendingOpeningAction = startingAction
            }
            return .alreadyOpening
        }

        guard !isLoopActive else {
            // If using Karabiner-Elements, TriggerKeybindObserver may call openLoop twice, as key events arrive in quick succession.
            // This happens because Karabiner-Elements sends modifier keys and other keys as separate, rapid events.
            // As a result, Loop might be opened before the full keybind is pressed.
            // In these cases, we can simply update the action instead of reopening the Loop.
            if startingAction.direction != .noSelection { // Can switch to .noAction still!
                await changeAction(startingAction, disableHapticFeedback: true)
            }

            return .alreadyOpen
        }

        let window = window ?? WindowUtility.userDefinedTargetWindow()

        guard window?.isAppExcluded != true else {
            throw LoopManagerError.appExcluded
        }

        guard (window?.fullscreen ?? false && Defaults[.ignoreFullscreen]) == false else {
            throw LoopManagerError.fullscreenWindow
        }

        actionRevision
```

### Core Architecture Module: `Loop/Core/Multitouch/Debug/GestureDebugOverlayController.swift`
```
#if DEBUG

    import AppKit
    import Subsurface
    import SwiftUI

    @MainActor
    final class GestureDebugOverlayController {
        static let isEnabled = ProcessInfo.processInfo.isEnvironmentFlagEnabled("LOOP_GESTURE_DEBUG_OVERLAY")

        let model = GestureDebugOverlayModel()
        private var windowController: NSWindowController?
        private var preserveDuringSwipeReset = false

        func begin(
            originCentroid: CGPoint,
            fingerCount: Int,
            recognitionThreshold: CGFloat,
            actionCount: Int,
            swipeStep: CGFloat,
            magnifyStep: CGFloat,
            screenCenter: CGPoint
        ) {
            model.begin(
                originCentroid: originCentroid,
                fingerCount: fingerCount,
                recognitionThreshold: recognitionThreshold,
                actionCount: actionCount,
                swipeStep: swipeStep,
                magnifyStep: magnifyStep
            )

            let size = CGSize(width: 520, height: 520)
            let panel: ActivePanel
            if let existing = windowController?.window as? ActivePanel {
                panel = existing
            } else {
                panel = ActivePanel(
                    contentRect: CGRect(origin: .zero, size: size),
                    styleMask: [.borderless, .nonactivatingPanel],
                    backing: .buffered,
                    defer: true
                )
                panel.ignoresMouseEvents = true
                panel.becomesKeyOnlyIfNeeded = false
                panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
                panel.hasShadow = false
                panel.backgroundColor = .clear
                panel.isOpaque = false
                panel.level = NSWindow.Level(rawValue: NSWindow.Level.screenSaver.rawValue + 1)
                panel.contentView = NSHostingView(rootView: GestureDebugOverlayView(model: model))
                windowController = NSWindowController(window: panel)
            }

            panel.setContentSize(size)
            panel.setFrameOrigin(
                CGPoint(x: screenCenter.x - size.width / 2, y: screenCenter.y - size.height / 2)
            )
            panel.orderFrontRegardless()
        }

        func updateDetermining(centroid: CGPoint, fingerCount: Int) {
            model.updateDetermining(centroid: centroid, fingerCount: fingerCount)
        }

        func updateSwipe(
            centroid: CGPoint,
            translation: CGPoint,
            angle: CGFloat,
            distance: CGFloat,
            fingerCount: Int
        ) {
            model.updateSwipe(
                centroid: centroid,
                translation: translation,
                angle: angle,
                distance: distance,
                fingerCount: fingerCount
            )
        }

        func recordSwipeCommit(distance: CGFloat, slot: Int? = nil) {
            model.recordSwipeCommit(distance: distance, slot: slot)
        }

        func recordSwipeActionReset() {
            preserveDuringSwipeReset = true
            model.recordSwipeActionReset()
        }

        func updateMagnify(
            centroid: CGPoint,
            distance: CGFloat,
            originDistance: CGFloat,
            fingerCount: Int
        ) {
            model.updateMagnify(
                centroid: centroid,
                distance: distance,
                originDistance: originDistance,
                fingerCount: fingerCount
            )
        }

        func recordMagnifyCommit(distance: CGFloat) {
            model.recordMagnifyCommit(distance: distance)
        }

        func updateRawContacts(_ contacts: [MTContact]) {
            model.updateRawContacts(contacts)
        }

        func close(force: Bool = false) {
            guard force || !preserveDuringSwipeReset else { return }
            preserveDuringSwipeReset = false
            model.clear()
            windowController?.window?.orderOut(nil)
            windowController?.close()
            windowController = nil
        }
    }

#endif

```

### Core Architecture Module: `Loop/Core/Multitouch/Debug/GestureDebugOverlayModel.swift`
```
#if DEBUG

    import CoreGraphics
    import Subsurface
    import SwiftUI

    let gestureDebugPointsPerNormalizedUnit: CGFloat = 500

    struct GestureDebugFinger: Identifiable, Equatable {
        let id: Int32
        let position: CGPoint
    }

    enum GestureDebugKind: String {
        case determining
        case swipe
        case magnify
    }

    struct GestureDebugSnapshot {
        static let empty = Self()

        var visible = false
        var kind: GestureDebugKind = .determining
        var originCentroid: CGPoint?
        var processedCentroid: CGPoint?
        var translation: CGPoint = .zero
        var radialDistance: CGFloat = 0
        var swipeAngle: CGFloat = 0
        var fingerCount = 0
        var fingers: [GestureDebugFinger] = []
        var recognitionThreshold: CGFloat = 0
        var swipeStep: CGFloat = 0
        var swipeBaseline: CGFloat?
        var swipeActionReset = false
        var swipeSlot: Int?
        var swipeActionCount = 0
        var swipeBoundaries: [CGFloat] = []
        var magnifyDistance: CGFloat?
        var magnifyOriginDistance: CGFloat?
        var magnifyBaseline: CGFloat?
        var magnifyStep: CGFloat = 0
        var scale: CGFloat = gestureDebugPointsPerNormalizedUnit
    }

    @MainActor
    final class GestureDebugOverlayModel: ObservableObject {
        @Published private(set) var snapshot = GestureDebugSnapshot.empty
        private var rawContacts: [GestureDebugFinger] = []
        private var activeFingerCount = 0

        func begin(
            originCentroid: CGPoint,
            fingerCount: Int,
            recognitionThreshold: CGFloat,
            actionCount: Int,
            swipeStep: CGFloat,
            magnifyStep: CGFloat
        ) {
            activeFingerCount = fingerCount
            rawContacts = []
            snapshot = GestureDebugSnapshot(
                visible: true,
                originCentroid: originCentroid,
                recognitionThreshold: recognitionThreshold,
                swipeStep: swipeStep,
                swipeBaseline: recognitionThreshold > 0 ? recognitionThreshold : nil,
                swipeActionCount: actionCount,
                swipeBoundaries: RadialGestureGeometry.slotBoundaryAngles(actionCount: actionCount),
                magnifyStep: magnifyStep
            )
            snapshot.fingerCount = fingerCount
            applyRawContacts()
        }

        func updateDetermining(centroid: CGPoint, fingerCount: Int) {
            if snapshot.originCentroid == nil {
                begin(
                    originCentroid: centroid,
                    fingerCount: fingerCount,
                    recognitionThreshold: snapshot.recognitionThreshold,
                    actionCount: snapshot.swipeActionCount,
                    swipeStep: snapshot.swipeStep,
                    magnifyStep: snapshot.magnifyStep
                )
            }
            snapshot.kind = .determining
            snapshot.processedCentroid = centroid
            snapshot.translation = relativePosition(of: centroid)
            snapshot.radialDistance = hypot(snapshot.translation.x, snapshot.translation.y)
            snapshot.fingerCount = fingerCount
        }

        func updateSwipe(
            centroid: CGPoint,
            translation: CGPoint,
            angle: CGFloat,
            distance: CGFloat,
            fingerCount: Int
        ) {
            if snapshot.originCentroid == nil {
                begin(
                    originCentroid: CGPoint(x: centroid.x - translation.x, y: centroid.y - translation.y),
                    fingerCount: fingerCount,
                    recognitionThreshold: snapshot.recognitionThreshold,
                    actionCount: snapshot.swipeActionCount,
                    swipeStep: snapshot.swipeStep,
                    magnifyStep: snapshot.magnifyStep
                )
            }
            snapshot.kind = .swipe
            snapshot.processedCentroid = centroid
            snapshot.translation = translation
            snapshot.radialDistance = distance
            snapshot.swipeAngle = angle
            snapshot.fingerCount = fingerCount
        }

        func recordSwipeCommit(distance: CGFloat, slot: Int? = nil) {
            let firstActionDistance = snapshot.recognitionThreshold > 0
                ? snapshot.recognitionThreshold
                : distance
            let baseline = snapshot.swipeBaseline ?? firstActionDistance
            snapshot.swipeBaseline = baseline
            snapshot.swipeActionReset = false
            snapshot.swipeSlot = slot
        }

        func recordSwipeActionReset() {
            snapshot.swipeActionReset = true
        }

        func updateMagnify(
            centroid: CGPoint,
            distance: CGFloat,
            originDistance: CGFloat,
            fingerCount: Int
        ) {
            if snapshot.originCentroid == nil {
                begin(
                    originCentroid: centroid,
                    fingerCount: fingerCount,
                    recognitionThreshold: snapshot.recognitionThreshold,
                    actionCount: snapshot.swipeActionCount,
                    swipeStep: snapshot.swipeStep,
                    magnifyStep: snapshot.magnifyStep
                )
            }
            snapshot.kind = .magnify
            snapshot.processedCentroid = centroid
            snapshot.translation = relativePosition(of: centroid)
            snapshot.radialDistance = hypot(snapshot.translation.x, snapshot.translation.y)
            snapshot.magnifyDistance = distance
            snapshot.magnifyOriginDistance = originDistance
            snapshot.fingerCount = fingerCount
        }

        func recordMagnifyCommit(distance: CGFloat) {
            snapshot.magnifyBaseline = distance
        }

        func updateRawContacts(_ contacts: [MTContact]) {
            let active = SubsurfaceContactFilter.activeTouches(
                from: SubsurfaceContactFilter.removePalms(from: contacts)
            )
            guard activeFingerCount > 0, active.count == activeFingerCount else { return }

            rawContacts = active.map {
                GestureDebugFinger(
                    id: $0.id,
                    position: CGPoint(
                        x: CGFloat($0.normalizedVector.position.x),
                        y: CGFloat($0.normalizedVector.position.y)
                    )
                )
            }
            applyRawContacts()
        }

        func clear() {
            rawContacts = []
            activeFingerCount = 0
            snapshot = .empty
        }

        func displayOffset(
            for point: CGPoint,
            origin: CGPoint,
            scale: CGFloat = gestureDebugPointsPerNormalizedUnit
        ) -> CGPoint {
            CGPoint(
                x: (point.x - origin.x) * scale,
                y: (point.y - origin.y) * scale
            )
        }

        private func applyRawContacts() {
            guard snapshot.originCentroid != nil else {
                snapshot.fingers = rawContacts
                return
            }
            snapshot.fingers = rawContacts
        }

        private func relativePosition(of point: CGPoint) -> CGPoint {
            guard let origin = snapshot.originCentroid else { return .zero }
            return CGPoint(x: point.x - origin.x, y: point.y - origin.y)
        }
    }

#endif

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1166** (2026-10-03): **🐞 Fix updater crash when updating download progress off the main thread**
  *Symptoms*: Fixes Loop crashing while downloading an update, starting with the first dev build compiled with Xcode 27 (`1766`). `UpdateDownloader` and `UpdateInstaller` took progress callbacks typed as plain `async` closures with no actor isolation. With approachable concurrency and the Xcode 27 toolchain, these run on the caller's executor instead of the main actor, so `Updater.progressBar` was being set from the cooperative thread pool. SwiftUI then re-rendered `UpdateView` (and the About tab) _off_ the main thread, tripping the main actor isolation check in Luminare's views, causing a crash. The progress callbacks are now explicitly `@MainActor`, and `didWriteData` hops to the main actor before reporting progress.

- **Issue #1165** (2026-09-30): **🐞 Gesture reliability fixes**
  *Symptoms*: This PR includes a few stability fixes for trackpad gestures:  1. Always re-enables event taps disabled by the system, including by secure input, and pauses briefly instead of tearing a tap down when it keeps timing out, 1. Makes the gesture blocker a single long-lived tap gated by a reference count, which only blocks trackpad input. Mouse wheel scrolls now pass through, and scroll/gesture end phases are always delivered so apps don't get stuck mid-scroll, 1. Logs why gestures are rejected, errors that were previously swallowed when opening Loop, and gestures disabled due to conflicts, 1. Clears `SystemGestureFilter`'s finger counts when a device stops or is removed, and keeps touch IDs unique across restarts, 1. Only resumes cycle progress for gestures, and so the radial menu goes back to its previous behavior, 1. Makes gestures respect "Resize window under cursor". When disabled, gestures target the focused window, and titlebar-only gestures only activate on its titlebar.  Also includes some Subsurface fixes, which include retrying devices that fail to start, rebuilding devices after wake, and correctly detecting the trackpad on Intel MacBook Pros with a Touch Bar (it was previously treated as the Touch Bar itself!)

- **Issue #1160** (2026-09-29): **🐞 Fix wallpaper capture on macOS 27**
  *Symptoms*: ## Description  The wallpaper window is not owned by the Dock process, so wallpaper capture always used the fallback method, which requests screen recording permissions. This method doesn't check the window owner but the `kCGWindowLayer` instead, which for the wallpaper window is always below 0. Additional advantage of the intended method is that it doesn't request screen recording permissions.  ## How has this been tested?  Tested on both macOS 27 and macOS 14(VM) with different wallpaper types like aerial, dynamic, photo.  ## Checklist:  - [x] I have performed a self-review of my own code - [x] I have made corresponding changes to the documentation if applicable - [x] I have no unrelated changes in this PR.  ## Please describe to which degree, if any, an LLM was used in creating this pull request.  N/A 
  **Post-Mortem & Fix Analysis**:
  > Thanks for your feedback. I added your suggestions in `5282cbe`.  I actually didn't check the `kCGWindowOwnerName` on other versions than 27.0 since i had the screen recording popup appear before too, but I guess this would be from an old method you used to get the wallpaper?

- **Issue #1147** (2026-09-07): **🐞 Media key presses incorrectly trigger window snapping**
  *Symptoms*: ### Bug Description  When pressing any of the media keys located at the top of the keyboard, the key does not need to be held down, a single press is sufficient to activate the function. After pressing a media key, pressing any arrow key unexpectedly triggers the window-snapping behavior.  ### Affected Scope  User interface  ### Steps to Reproduce  1. First Step, press any media keys, don't need to hold it. 2. Second step, press any arrow keys, it will trigger window snapping.  ### Reproducibility  Always  ### Expected vs Actual Behavior  Expected behavior: Media keys should only perform their assigned function and should not affect subsequent keyboard input.  Actual behavior: After a single media key press, subsequent arrow-key presses trigger window snapping unexpectedly.  ### Screen Recordings / Screenshots  _No response_  ### Severity  Blocker (cannot proceed)  ### macOS Version  Tahoe 26.6.2  ### Loop Version  Version 🧪 1.4.3 (1763)  ### Did You Try the Development Build?  Yes  ### Additional Context  _No response_  ### Final Checks  - [x] My issue is written in English. - [x] My issue title is descriptive. - [x] This is a single bug (multiple bugs should be reported individually). - [x] I have looked to see if this is a duplicate of another bug report. - [ ] I can help with further investigation. - [ ] I can help with developing a fix for this issue.
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this! I’m closing this issue since it’s a duplicate of another one. That said, I’ve been able to reproduce the issue on my end and will be looking into possible fixes :)

- **Issue #1142** (2026-08-29): **🐞 Harden window focus sequence**
  *Symptoms*: Updates Loop's window focus behavior. The previous sequence raised and keyed the window multiple times. It now:  1. Makes the target process and window frontmost, 1. Posts one mouse-down event to make the target window key without completing a click, 1. Raises the window once through Accessibility, 1. Falls back to `NSRunningApplication.activate` if private fronting fails, 1. Uses a far bottom-right event point to avoid Chromium's NaN handling and the window's resize region.  Previously, Loop sent two synthetic clicks at `(-1, -1)` to raise a window. On macOS 27, these could register as a double-click on the title bar and expand the window (interestingly, this did not happen on macOS 26). Moving the point to `(300000, 300000)` and omitting mouse-up prevents the synthetic event from triggering either behavior. The updated focus sequence and coordinate are based on AltTab's current implementation :)

- **Issue #1134** (2026-08-31): **🐞 Two-key cycles do not advance when both action keys are released between presses**
  *Symptoms*: ### Bug Description  A cycle assigned to a two-key action binding such as ↑ + ← does not advance when I release both action keys and press the same combination again.  The first item in the cycle fires, but repeating the full two-key combination repeats the first item of the cycle instead of advancing. If I keep one arrow held and repeatedly tap the other arrow, the cycle advances correctly.  Single-arrow cycles continue to work normally.  ### Affected Scope  Other  ### Steps to Reproduce  1. Keep the standard single-arrow cycles assigned to ↑, ↓, ←, and →. 2. Create a custom cycle with at least two actions. 3. Assign that cycle to a two-arrow combination, such as ↑ + ←. 4. Hold Loop’s trigger key so that Loop remains active. 5. Press ↑ + ←, then release both arrows. The first cycle action fires. 6. Press and release ↑ + ← again while continuing to hold the trigger. 7. Observe that the corner cycle remains on its first action instead of advancing. 8. As a workaround, press both arrows, keep one arrow held, and repeatedly tap the other. The cycle then advances correctly.  ### Reproducibility  Always  ### Expected vs Actual Behavior  Expected: Repeatedly pressing and releasing the same two-key combination should advance through the configured cycle, just as repeatedly pressing a single-key cycle binding does.  Actual: The first cycle action fires, but releasing both action keys and pressing the combination again does not advance the cycle. Keeping one arrow held and tapping the
  **Post-Mortem & Fix Analysis**:
  > This issue should be fixed now! Please test it by updating to the latest development build. You can enable development builds by turning on "Include development versions" in Loop's About tab.  If it still doesn't work as expected, please let us know here :)
  > Wow, that was fast! Works great, thanks so much! :)  One very minor thing I noticed while testing, probably doesn't need to be fixed since it ends up working correctly and it doesn't affect usability at all, but just wanted to flag it for thoroughness.  On the second press of a two-key binding, the preview often, but not always briefly flashes the single-key action before settling on the correct one. For example, pressing ↑ + ← the first time almost always shows the correct preview immediately. Pressing ↑ + ← again frequently flashes the ↑-only preview for an instant, then resolves to the second item of the ↑ + ← cycle.  
  > Happy to hear that it's working well!  As for your concern, I did notice that too, but ultimately ended up keeping that behavior, so it is intentional. The other option would have been to introduce a minuscule delay before processing the keys, giving a bit of buffer time to press additional keys before activating an action. In testing, though, that ended up making everything feel noticeably more laggy, so I preferred the current behavior :)

- **Issue #1132** (2026-08-09): **🐞 Fix makeKeyWindow NaN coords that terminate Chromium PWA shims**
  *Symptoms*: ## Description  Loop’s synthetic `makeKeyWindow` focus event filled `windowLocation` with `0xFF` bytes, which decode as **NaN** doubles. A Chromium regression caused Mojo to terminate the PWA app-shim connection when those values were received (`app_shim_controller.mm:679` Channel error), so installed Chromium/Brave/Edge PWAs quit when Loop focused them before resize.  This ports [AltTab’s fix](https://github.com/lwouis/alt-tab-macos/commit/782f1fe2e7272f185526e3e69eadd08c241fe050): - Use a finite off-content point `CGPoint(x: -1, y: -1)` instead of `0xFF` fill - Widen the event buffer to `0x100` (record length stays `0xf8`)  The earlier Chromium-PWA-only resize workaround was removed in favor of this general fix.  Upstream: - Chromium sanitization: https://chromium.googlesource.com/chromium/src.git/+/72561e6e2170a66a9b41e8ca31838b9f6bc0b3a4 - Public report: https://issues.chromium.org/issues/539984770 - Canonical (restricted): https://issues.chromium.org/issues/537448007  Fixes #1131  ## How has this been tested?  Tested on macOS Tahoe 26.6 with a local Debug build.  - [x] Brave Google Keep / Chat PWAs — keybind snaps no longer quit the app - [x] Chrome / Brave browser windows — still focus/resize normally - [x] Safari Keep PWA / TextEdit — still fine - [x] Re-verify after this AltTab-style revision (author): Keep/Chat PWA snap + focus still healthy  <details><summary><h2>Screencast</h2></summary>  Screencast of Chromium PWA snapping successfully 
  **Post-Mortem & Fix Analysis**:
  > Updated per @mrkai77’s feedback on #1131:  - Replaced the Chromium-specific resize workaround with AltTab’s `makeKeyWindow` fix (`CGPoint(x: -1, y: -1)` + `0x100` buffer) in `SkyLightToolBelt.makeKeyWindow` - Removed `ChromiumPWAResizeWorkaround` entirely  Net diff vs `develop` is now only `SkyLightToolBelt.swift`. Please re-test Keep/Chat PWA snaps on this revision.

- **Issue #1131** (2026-08-09): **🐞 PWA Crashes when Using Loop**
  *Symptoms*: ### Bug Description  I notice if I use any PWA and try to vertically snap via Loop, the application I am resizing crashes.  ### Affected Scope  Crash / Freeze  ### Steps to Reproduce  1. Get a PWA (e.g., Google Keep, Google Chat, etc.) 2. Drag application vertically for vertical snapping  ### Reproducibility  Often (≥70%)  ### Expected vs Actual Behavior  ## Expected  Vertically snaps just fine  ## Actual  Application crashes  ### Screen Recordings / Screenshots  https://github.com/user-attachments/assets/c8bad617-fa13-4f1f-94d5-82531332d842  ### Severity  Major (workaround exists)  ### macOS Version  Tahoe 26.6 (25G72)  ### Loop Version  Version 🧪 1.4.3 (1755)  ### Did You Try the Development Build?  Yes  ### Additional Context  _No response_  ### Final Checks  - [x] My issue is written in English. - [x] My issue title is descriptive. - [x] This is a single bug (multiple bugs should be reported individually). - [x] I have looked to see if this is a duplicate of another bug report. - [x] I can help with further investigation. - [x] I can help with developing a fix for this issue.
  **Post-Mortem & Fix Analysis**:
  > I’m currently unable to reproduce this bug on my machine, but since you mentioned you might be able to help develop a fix, I was wondering if you have any ideas what could be causing it? Or if you already have a fix in mind, I’d be happy to hear your thoughts!  If not, it may also be worth trying to toggle window animations, since that changes how windows are handled slightly.
  > @mrkai77 I will spend some time today to see if I can isolate the root cause of the issue. Thanks for being super responsive!  OOC, when are you guys planning on officially releasing the latest binary? There are a lot of updates in the pipeline already and I would hate for non-beta users to be surprised by the amount of updates.
  > ## Investigation update  Root cause appears to be on the **Chromium PWA shim** side under Loop's non-animated AX resize path — not Loop crashing, and not all PWAs.  ### Isolation results | Case | Result | | --- | --- | | Chrome / Brave **PWA** (Keep, Chat, ...) + any snap (top / side / corner) | Crash | | Keybind / radial (no drag) | Crash | | Animate window resize **off** | Still crashes | | Chrome / Brave **browser** windows | OK | | Safari Keep PWA | OK | | TextEdit | OK |  ### Loop path `WindowActionEngine` → `WindowEngine.resizeWindow` (non-animated) does `setFrame`, then a **second** `setFrame` when the frame doesn't stick, then `handleSizeConstrainedWindow` may `setPosition` again. Chromium `*.app.<id>` shims (e.g. `com.brave.Browser.app.…`, `com.google.Chrome.app.…`) appear fragile under that AX flood.  ### Loop fix (in progress on `fix/1131-pwa-vertical-snap-crash`) For Chromium PWA shims only: single `sizeFirst` `setFrame`, skip the retry; still one constrained-origin correct

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

### Incident Patch 1: `7ce662a5` (2026-10-03)
**Commit Message**: 🐞 Fix updater crash when updating download progress off the main thread (#1166)

**File**: `Loop/Updater/UpdateDownloader.swift` (modified, +5/-5)
```diff
@@ -15,7 +15,7 @@ final class UpdateDownloader: NSObject {
 
     private var urlSession: URLSession?
     private var downloadTask: URLSessionDownloadTask?
-    private var progressClosure: ((UpdateProgress) async -> ())?
+    private var progressClosure: (@MainActor (UpdateProgress) -> ())?
     private var completionClosure: ((Result<URL, Error>) -> ())?
     private(set) var isDownloading = false
     private var performanceTracker: PerformanceTracker = .init()
@@ -32,7 +32,7 @@ final class UpdateDownloader: NSObject {
 
     func downloadUpdate(
         manifest: UpdateManifest,
-        progress: @escaping (UpdateProgress) async -> ()
+        progress: @escaping @MainActor (UpdateProgress) -> ()
     ) async throws -> URL {
         guard !isDownloading else {
             throw DownloadError.downloadInProgress
@@ -75,7 +75,7 @@ final class UpdateDownloader: NSObject {
 
     private func setupDownload(
         url: URL,
-        progress: @escaping (UpdateProgress) async -> (),
+        progress: @escaping @MainActor (UpdateProgress) -> (),
         completion: @escaping (Result<URL, Error>) -> ()
     ) {
         isDownloading = true
@@ -173,7 +173,7 @@ extension UpdateDownloader: URLSessionDownloadDelegate {
         totalBytesWritten: Int64,
         totalBytesExpectedToWrite: Int64
     ) {
-        Task {
+        Task { @MainActor in
             guard self.isDownloading else { return }
 
             let progress = self.performanceTracker.updateProgress(
@@ -182,7 +182,7 @@ extension UpdateDownloader: URLSessionDownloadDelegate {
                 totalBytesExpectedToWrite: totalBytesExpectedToWrite
             )
 
-            await self.progressClosure?(progress)
+            self.progressClosure?(progress)
         }
     }
 
```

**File**: `Loop/Updater/UpdateInstaller.swift` (modified, +1/-1)
```diff
@@ -50,7 +50,7 @@ actor UpdateInstaller {
     func installUpdate(
         from downloadURL: URL,
         manifest: UpdateManifest,
-        progress: @escaping (UpdateProgress) async -> ()
+        progress: @escaping @MainActor @Sendable (UpdateProgress) -> ()
     ) async throws {
         log.info("Starting installation of update: \(manifest.version)")
 
```

---

### Incident Patch 2: `61e9b091` (2026-09-30)
**Commit Message**: 🐞 Gesture reliability fixes (#1165)

**File**: `Loop/Core/LoopManager.swift` (modified, +12/-1)
```diff
@@ -112,7 +112,12 @@ final class LoopManager {
         },
         changeAction: { [weak self] action, reverse, canAdvanceCycle in
             Task {
-                await self?.changeAction(action, canAdvanceCycle: canAdvanceCycle, reverse: reverse)
+                await self?.changeAction(
+                    action,
+                    canAdvanceCycle: canAdvanceCycle,
+                    resumeCycleProgress: true,
+                    reverse: reverse
+                )
             }
         },
         checkIfLoopOpen: { [weak self] in
@@ -393,12 +398,14 @@ extension LoopManager {
     ///   - triggeredFromScreenChange: If this action was triggered from a screen change, this will prevent cycle keybinds from infinitely changing screens.
     ///   - disableHapticFeedback: This will prevent haptic feedback.
     ///   - canAdvanceCycle: This will prevent the cycle from advancing if set to false. This is currently used when changing actions via the radial menu.
+    ///   - resumeCycleProgress: When the cycle can't advance, resumes its stored progress instead of restarting it. Used by gestures.
     ///   - reverse: Steps a cycle backwards, or performs the opposite of any other action, such as smaller for larger.
     private func changeAction(
         _ newAction: WindowAction,
         triggeredFromScreenChange: Bool = false,
         disableHapticFeedback: Bool = false,
         canAdvanceCycle: Bool = true,
+        resumeCycleProgress: Bool = false,
         reverse: Bool = false
     ) async {
         var newAction = newAction
@@ -439,6 +446,7 @@ extension LoopManager {
             cycleProposal = proposeCycleAction(
                 newAction,
                 canAdvance: canAdvanceCycle,
+                resumeProgress: resumeCycleProgress,
                 reverse: reverse
             )
             if let cycleProposal {
@@ -642,6 +650,7 @@ extension LoopManager {
     private func proposeCycleAction(
         _ action: WindowAction,
         canAdvance: Bool,
+        resumeProgress: Bool,
         reverse: Bool
     ) -> CycleActionCoordinator.Proposal? {
         // Allow cycling backwards only if:
@@ -656,6 +665,8 @@ extension LoopManager {
             reverse || (allowReverseCycle && keybindTrigger.effectiveEventFlags.contains(.maskShift))
                 ? .advance(.backward)
                 : .advance(.forward)
+        } else if resumeProgress {
+            .resumeCurrent
         } else {
             .selectCurrent
         }
```

**File**: `Loop/Core/Multitouch/MultitouchGestureBlocker.swift` (modified, +130/-26)
```diff
@@ -6,55 +6,159 @@
 //
 
 import AppKit
+import os
 import Scribe
 
-/// Reference-counted because the blocker is shared across in-flight
-/// gestures: one gesture ending mustn't disable blocking for others still
-/// active. `start()` is also idempotent so duplicate calls don't leak the
-/// previous `ActiveEventMonitor` (it self-retains via `Unmanaged.passRetained`).
+/// Stops trackpad scrolls and gestures from reaching apps while a Loop gesture is active.
+/// Reference-counted, so one gesture ending doesn't stop blocking for another.
 @Loggable
 final class MultitouchGestureBlocker {
     private var monitor: ActiveEventMonitor?
-    private var activeCount: Int = 0
+
+    private let activeCount = OSAllocatedUnfairLock<Int>(initialState: 0)
+
+    /// `magnify` is left out, as its raw value (30) collides with `dockControl`
+    private static let gestureEventTypes: Set<UInt32> = [
+        UInt32(NSEvent.EventType.gesture.rawValue),
+        UInt32(NSEvent.EventType.rotate.rawValue),
+        UInt32(NSEvent.EventType.swipe.rawValue),
+        UInt32(NSEvent.EventType.smartMagnify.rawValue)
+    ]
+
+    private static let scrollPhaseEnded: Int64 = 4
+    private static let scrollPhaseCancelled: Int64 = 8
+    private static let momentumPhaseEnd: Int64 = 3
+    private static let scrollDeltaFields: [CGEventField] = [
+        .scrollWheelEventDeltaAxis1,
+        .scrollWheelEventDeltaAxis2,
+        .scrollWheelEventDeltaAxis3,
+        .scrollWheelEventPointDeltaAxis1,
+        .scrollWheelEventPointDeltaAxis2,
+        .scrollWheelEventPointDeltaAxis3
+    ]
+
+    private static let scrollFixedDeltaFields: [CGEventField] = [
+        .scrollWheelEventFixedPtDeltaAxis1,
+        .scrollWheelEventFixedPtDeltaAxis2,
+        .scrollWheelEventFixedPtDeltaAxis3
+    ]
 
     func start() {
-        if monitor != nil {
-            activeCount += 1
-            return
-        }
+        guard monitor == nil else { return }
 
         log.info("Starting gesture blocker")
+        startMonitor()
+    }
+
+    /// Also resets the reference count, as every gesture has been stopped by then. This clears any leaked `acquire()`.
+    func stop() {
+        activeCount.withLock { $0 = 0 }
+
+        guard let monitor else { return }
+
+        monitor.stop()
+        self.monitor = nil
+
+        log.info("Stopped gesture blocker")
+    }
+
+    func acquire() {
+        let count = activeCount.withLock { count in
+            count += 1
+            return count
+        }
+
+        if count == 1 {
+            if monitor == nil {
+                log.warn("Gesture blocker activated without an event tap; trackpad events won't be suppressed")
+            }
+            log.debug("Gesture blocker activated")
+        }
+    }
 
-        let eventTypes: [CGEventType] = [
-            .scrollWheel,
-            CGEventType(rawValue: UInt32(NSEvent.EventType.gesture.rawValue)),
-            CGEventType(rawValue: UInt32(NSEvent.EventType.rotate.rawValue)),
-            CGEventType(rawValue: UInt32(NSEvent.EventType.swipe.rawValue)),
-            CGEventType(rawValue: UInt32(NSEvent.EventType.smartMagnify.rawValue))
-        ].compactMap(\.self)
+    func release() {
+        let count = activeCount.withLock { count in
+            count = max(0, count - 1)
+            return count
+        }
+
+        if count == 0 {
+            log.debug("Gesture blocker deactivated")
+        }
+    }
+
+    private func startMonitor() {
+        let eventTypes: [CGEventType] = [.scrollWheel] + Self.gestureEventTypes.compactMap(CGEventType.init(rawValue:))
+
+        let newMonitor = ActiveEventMonitor(
+            "gesture_blocker",
+            events: eventTypes,
+            callback: Self.makeEventHandler(activeCount: activeCount)
+        )
 
-        let newMonitor = ActiveEventMonitor("gesture_blocker", events: eventTypes) { _ in .ignore }
         newMonitor.start()
 
+        // Left unset on failure, so the next `start()` tries again
         guard newMonitor.isEnabled else {
-            log.warn("Failed to start gesture blocker")
+            log.warn("Failed to start gesture blocker event tap")
             newMonitor.stop()
             return
         }
 
         monitor = newMonitor
-        activeCount = 1
     }
 
-    func stop() {
-        guard let monitor else { return }
+    private static func makeEventHandler(
+        activeCount: OSAllocatedUnfairLock<Int>
+    ) -> (CGEvent) -> Unmanaged<CGEvent>? {
+        { event in
+            guard activeCount.withLock({ $0 > 0 }) else {
+                return Unmanaged.passUnretained(event)
+            }
 
-        activeCount -= 1
-        guard activeCount == 0 else { return }
+            if event.type == .scrollWheel {
+                return handleScroll(event)
+            }
 
-        monitor.stop()
-        self.monitor = nil
+            if gestureEventTypes.contains(event.type.rawValue) {
+                return handleGesture(event)
+         
```

**File**: `Loop/Core/Multitouch/MultitouchRecognizerRegistry.swift` (modified, +23/-0)
```diff
@@ -5,8 +5,11 @@
 //  Created by Kai Azim on 2026-07-06.
 //
 
+import Foundation
+import Scribe
 import Subsurface
 
+@Loggable
 @MainActor
 final class MultitouchRecognizerRegistry {
     typealias EventHandler = @MainActor (SubsurfaceGestureEvent, Int) async -> ()
@@ -40,6 +43,8 @@ final class MultitouchRecognizerRegistry {
     private let gestureMonitor: SubsurfaceMonitor
     private let handleEvent: EventHandler
     private var entries: [Int: Entry] = [:]
+    /// Logged only when they change, as rebuilds also follow unrelated keybind edits
+    private var conflictingGestureIDs: Set<UUID> = []
 
     init(
         gestureMonitor: SubsurfaceMonitor,
@@ -58,6 +63,8 @@ final class MultitouchRecognizerRegistry {
     }
 
     func rebuild(with gestures: [GestureBinding]) -> [StopResult] {
+        logConflictingGestures(in: gestures)
+
         let gesturesByFingerCount = Dictionary(grouping: GestureBinding.activeGestures(in: gestures), by: \.fingerCount)
         let neededFingerCounts = Set(gesturesByFingerCount.keys)
 
@@ -103,6 +110,22 @@ final class MultitouchRecognizerRegistry {
         !entries.isEmpty
     }
 
+    private func logConflictingGestures(in gestures: [GestureBinding]) {
+        let conflictingIDs = GestureBinding.conflictingActionableIDs(in: gestures)
+        guard conflictingIDs != conflictingGestureIDs else { return }
+        conflictingGestureIDs = conflictingIDs
+
+        guard !conflictingIDs.isEmpty else {
+            log.info("No gestures are disabled by finger count conflicts")
+            return
+        }
+
+        let conflictingGestures = gestures
+            .filter { conflictingIDs.contains($0.id) }
+            .map { "\($0.fingerCount)-finger \($0.kind)" }
+        log.warn("Disabled gestures that conflict on the same finger count: \(conflictingGestures.joined(separator: ", "))")
+    }
+
     private func startRecognizer(
         for fingerCount: Int,
         radial: GestureBinding?,
```

**File**: `Loop/Core/Multitouch/MultitouchTargetResolver.swift` (modified, +44/-16)
```diff
@@ -25,7 +25,14 @@ final class MultitouchTargetResolver {
     /// Lets shrinking/growing continue after the cursor falls off the resized frame.
     private var lastRepeatableWindow: Window?
     /// Resolved once per touch and shared by every gesture in it, so they all agree on the window
-    private var touchTarget: (touchID: Int, window: Window?, isInTitlebar: Bool)?
+    private var touchTarget: TouchTarget?
+
+    private struct TouchTarget {
+        let touchID: Int
+        /// The window under the cursor, or the focused window without "Resize window under cursor"
+        let window: Window?
+        let startedInTitlebar: Bool
+    }
 
     func reset() {
         lastRepeatableWindow = nil
@@ -37,41 +44,62 @@ final class MultitouchTargetResolver {
         touchID: Int,
         allowsRapidRepeat: Bool
     ) -> MultitouchGestureActivationContext {
-        let (windowAtCursor, startedInTitlebar) = windowUnderCursor(touchID: touchID)
+        let target = touchTarget(touchID: touchID)
 
-        let targetWindow: Window? = if let windowAtCursor {
-            windowAtCursor
-        } else if allowsRapidRepeat, gesture.effectiveActivationZone == .anywhere {
-            lastRepeatableWindow
-        } else {
-            nil
+        let targetWindow: Window? = switch gesture.effectiveActivationZone {
+        case .titlebar:
+            target.startedInTitlebar ? target.window : nil
+        case .anywhere:
+            target.window ?? fallbackWindow(allowsRapidRepeat: allowsRapidRepeat)
         }
 
         return MultitouchGestureActivationContext(
             targetWindow: targetWindow,
-            startedInTitlebar: startedInTitlebar
+            startedInTitlebar: target.startedInTitlebar
         )
     }
 
     func isCursorInTitlebar(touchID: Int) -> Bool {
-        windowUnderCursor(touchID: touchID).isInTitlebar
+        touchTarget(touchID: touchID).startedInTitlebar
     }
 
     func rememberRepeatableWindow(_ window: Window?, allowsRapidRepeat: Bool) {
         guard let window, allowsRapidRepeat else { return }
         lastRepeatableWindow = window
     }
 
-    private func windowUnderCursor(touchID: Int) -> (window: Window?, isInTitlebar: Bool) {
+    /// Used when there's no window under the cursor, matching the rest of Loop's fallback to the focused window
+    private func fallbackWindow(allowsRapidRepeat: Bool) -> Window? {
+        if allowsRapidRepeat, let lastRepeatableWindow {
+            return lastRepeatableWindow
+        }
+        return try? WindowUtility.frontmostWindow()
+    }
+
+    private func touchTarget(touchID: Int) -> TouchTarget {
         if let touchTarget, touchTarget.touchID == touchID {
-            return (touchTarget.window, touchTarget.isInTitlebar)
+            return touchTarget
         }
 
         let cursorPosition = NSEvent.mouseLocation.flipY(screen: NSScreen.screens[0])
-        let window = WindowUtility.windowAtPosition(cursorPosition)
-        let inTitlebar = window.map { isInTitlebar(cursorPosition, of: $0) } ?? false
-        touchTarget = (touchID, window, inTitlebar)
-        return (window, inTitlebar)
+
+        let window: Window?
+        let startedInTitlebar: Bool
+        if Defaults[.resizeWindowUnderCursor] {
+            window = WindowUtility.windowAtPosition(cursorPosition)
+            startedInTitlebar = window.map { isInTitlebar(cursorPosition, of: $0) } ?? false
+        } else {
+            window = try? WindowUtility.frontmostWindow()
+            // Only counts where the focused window is the topmost window under the cursor
+            startedInTitlebar = window.map {
+                SkyLightToolBelt.windowIDAtPosition(cursorPosition) == $0.cgWindowID
+                    && isInTitlebar(cursorPosition, of: $0)
+            } ?? false
+        }
+
+        let target = TouchTarget(touchID: touchID, window: window, startedInTitlebar: startedInTitlebar)
+        touchTarget = target
+        return target
     }
 
     private func isInTitlebar(_ cursorPosition: CGPoint, of window: Window) -> Bool {
```

**File**: `Loop/Core/Multitouch/MultitouchTrigger.swift` (modified, +18/-3)
```diff
@@ -103,6 +103,7 @@ final class MultitouchTrigger {
             closeDebugOverlay(force: true)
         #endif
         handleStopResults(recognizerRegistry.stopAll())
+        gestureBlocker.stop()
         targetResolver.reset()
     }
 
@@ -126,8 +127,10 @@ final class MultitouchTrigger {
         handleStopResults(recognizerRegistry.rebuild(with: Defaults[.gestures]))
         if recognizerRegistry.hasRecognizers {
             gestureMonitor.start()
+            gestureBlocker.start()
         } else {
             gestureMonitor.stop()
+            gestureBlocker.stop()
         }
         updateSystemGestureFilter()
     }
@@ -143,7 +146,7 @@ final class MultitouchTrigger {
                 closeCallback(false)
             }
             if stopResult.didAcquireGestureBlocker {
-                gestureBlocker.stop()
+                gestureBlocker.release()
             }
         }
     }
@@ -188,6 +191,7 @@ final class MultitouchTrigger {
         releaseGestureBlocker(for: session)
 
         guard systemGestureFilter.canClaimCurrentTouch(fingerCount: fingerCount) else {
+            log.info("Rejected \(fingerCount)-finger \(gesture.kind) gesture: \(dockOwnershipRejectionReason)")
             session.abandonStroke()
             return false
         }
@@ -197,13 +201,19 @@ final class MultitouchTrigger {
             gesture: gesture,
             loopWasAlreadyOpen: loopWasAlreadyOpen
         ) else {
+            if !activationContext.allows(gesture) {
+                log.info("Rejected \(fingerCount)-finger \(gesture.kind) gesture: titlebar-only gesture started outside a titlebar")
+            } else {
+                log.info("Rejected \(fingerCount)-finger \(gesture.kind) gesture: no target window")
+            }
             systemGestureFilter.releaseCurrentTouch(fingerCount: fingerCount)
             // Keep the DEBUG overlay alive, as it follows the physical stroke
             return false
         }
 
         // Claimed only once accepted, so the filter never sees Loop own a stroke it's about to reject
         guard systemGestureFilter.claimCurrentTouch(fingerCount: fingerCount) else {
+            log.info("Rejected \(fingerCount)-finger \(gesture.kind) gesture: failed to claim the touch, \(dockOwnershipRejectionReason)")
             session.reject()
             return false
         }
@@ -217,11 +227,15 @@ final class MultitouchTrigger {
             allowsRapidRepeat: allowsRapidRepeat
         )
 
-        gestureBlocker.start()
+        gestureBlocker.acquire()
         session.acquireGestureBlocker()
         return true
     }
 
+    private var dockOwnershipRejectionReason: String {
+        MissionControl.isShowing ? "Mission Control is showing" : "the Dock already owns this stroke"
+    }
+
     private func handleEarlyRadialMenuGesture(
         phase: SubsurfaceGesturePhase,
         fingerCount: Int
@@ -361,6 +375,7 @@ final class MultitouchTrigger {
                 let result = try await openCallback(.init(.noSelection), window)
                 openedLoop = result == .opened
             } catch {
+                log.info("Failed to open Loop for \(fingerCount)-finger gesture: \(error.localizedDescription)")
                 if recognizerRegistry.contains(session: session, for: fingerCount) {
                     session.reject()
                     releaseGestureBlocker(for: session)
@@ -428,7 +443,7 @@ final class MultitouchTrigger {
 
     private func releaseGestureBlocker(for session: MultitouchGestureSession) {
         if session.releaseGestureBlocker() {
-            gestureBlocker.stop()
+            gestureBlocker.release()
         }
     }
 }
```

**File**: `Loop/Core/Multitouch/SystemGestureFilter.swift` (modified, +113/-52)
```diff
@@ -6,6 +6,7 @@
 //
 
 import CoreGraphics
+import Foundation
 import os
 import Scribe
 import Subsurface
@@ -20,6 +21,10 @@ final class SystemGestureFilter {
     struct Claims {
         var anywhere: Set<DockGesture> = []
         var titlebarOnly: Set<DockGesture> = []
+
+        var isEmpty: Bool {
+            anywhere.isEmpty && titlebarOnly.isEmpty
+        }
     }
 
     private enum Owner {
@@ -33,10 +38,10 @@ final class SystemGestureFilter {
     private struct State {
         var isRunning = false
         var claims: [Int: Claims] = [:]
-        /// Active finger count per multitouch device
+        /// Active finger count per device
         var fingerCounts: [UInt64: Int] = [:]
-        /// Incremented whenever the fingers touch down or lift, so stale lookups are discarded
         var touchID = 0
+        var isTouching = false
         var hasLookedUpTouch = false
         var titlebarLookup = TitlebarLookup.pending
         var isMissionControlShowing = false
@@ -48,16 +53,16 @@ final class SystemGestureFilter {
             fingerCounts.values.max() ?? 0
         }
 
-        /// The Dock keeps its gestures while Mission Control is showing, so they can dismiss it
-        func owner(fingerCount: Int) -> Owner? {
-            isMissionControlShowing ? .dock : owners[fingerCount]
+        /// Look up once enough fingers are down for the smallest claim
+        var lookupFingerCount: Int? {
+            claims.filter { !$0.value.isEmpty }.keys.min().map { max($0, 2) }
         }
     }
 
     private struct Hold {
         var events: [CGEvent]
         let fingerCount: Int
-        let touchID: Int
+        let touchID: Int?
         let motion: CGEventField.DockSwipeMotion
         let claims: Claims
         let start: ContinuousClock.Instant
@@ -123,30 +128,18 @@ final class SystemGestureFilter {
         guard eventMonitor == nil else { return }
 
         log.info("Starting system gesture filter")
-        state.withLock { $0.sequenceGeneration += 1 }
 
-        let newMonitor = ActiveEventMonitor(
-            "system_gesture_filter",
-            events: [.dockControl]
-        ) { [weak self] proxy, event in
-            guard let self else { return Unmanaged.passUnretained(event) }
-            return handle(event, proxy: proxy)
-        }
-        newMonitor.start()
-
-        guard newMonitor.isEnabled else {
+        if !startEventMonitor() {
             log.warn("Failed to start system gesture filter")
-            newMonitor.stop()
-            return
         }
-
-        eventMonitor = newMonitor
     }
 
     func stop() {
         contactsTask?.cancel()
         contactsTask = nil
-        state.withLock { $0 = State(sequenceGeneration: $0.sequenceGeneration + 1) }
+        state.withLock { state in
+            state = State(touchID: state.touchID, sequenceGeneration: state.sequenceGeneration + 1)
+        }
 
         guard let eventMonitor else { return }
         eventMonitor.stop()
@@ -155,20 +148,22 @@ final class SystemGestureFilter {
         log.info("Stopped system gesture filter")
     }
 
-    /// Identifies the touch in progress, changing whenever the fingers touch down or lift
     var currentTouchID: Int {
         state.withLock(\.touchID)
     }
 
     func canClaimCurrentTouch(fingerCount: Int) -> Bool {
-        state.withLock { !$0.isRunning || $0.owner(fingerCount: fingerCount) != .dock }
+        state.withLock { state in
+            !state.isRunning || (!state.isMissionControlShowing && state.owners[fingerCount] != .dock)
+        }
     }
 
     /// Returns false if the Dock is already acting on the stroke
     func claimCurrentTouch(fingerCount: Int) -> Bool {
         state.withLock { state in
             guard state.isRunning else { return true }
-            guard state.owner(fingerCount: fingerCount) != .dock else { return false }
+            // The Dock keeps its gestures while Mission Control is showing, so they can dismiss it
+            guard !state.isMissionControlShowing, state.owners[fingerCount] != .dock else { return false }
             state.owners[fingerCount] = .loop
             return true
         }
@@ -181,22 +176,78 @@ final class SystemGestureFilter {
         }
     }
 
+    // MARK: Lifecycle
+
+    @discardableResult
+    private func startEventMonitor() -> Bool {
+        resetTouches()
+
+        let newMonitor = ActiveEventMonitor(
+            "system_gesture_filter",
+            events: [.dockControl]
+        ) { [weak self] proxy, event in
+            guard let self else { return Unmanaged.passUnretained(event) }
+            return handle(event, proxy: proxy)
+        }
+
+        newMonitor.start()
+
+        guard newMonitor.isEnabled else {
+            newMonitor.stop()
+            return false
+        }
+
+        eventMonitor = newMonitor
+        return true
+    }
+
+    private func resetTouches() {
+        state.withLock { state in
+            state.owners.removeAll()
+            state.has
```

**File**: `Loop/Utilities/Event Monitoring/ActiveEventMonitor.swift` (modified, +3/-10)
```diff
@@ -88,21 +88,14 @@ final class ActiveEventMonitor: BaseEventTapMonitor {
             let observer = Unmanaged<ActiveEventMonitor>.fromOpaque(refcon).takeUnretainedValue()
 
             // Tap management notifications carry a null event, so read eventType, not event.type
-            if eventType == .tapDisabledByTimeout {
+            // Disabled by the system for being slow or for secure input
+            if eventType == .tapDisabledByTimeout || eventType == .tapDisabledByUserInput {
                 if observer.isEnabled {
-                    let tapRunLoop = EventTapThread.shared.runLoop
-                    CFRunLoopPerformBlock(tapRunLoop, CFRunLoopMode.commonModes as CFTypeRef) {
-                        observer.attemptRestart()
-                    }
-                    CFRunLoopWakeUp(tapRunLoop)
+                    observer.attemptRestart()
                 }
                 return nil
             }
 
-            if eventType == .tapDisabledByUserInput {
-                return nil
-            }
-
             guard unsafeBitCast(event, to: UnsafeRawPointer?.self) != nil else { return nil }
             return observer.handleEvent(proxy: proxy, event: event)
         }
```

**File**: `Loop/Utilities/Event Monitoring/BaseEventTapMonitor.swift` (modified, +16/-7)
```diff
@@ -90,22 +90,31 @@ class BaseEventTapMonitor: EventMonitorProtocol, Identifiable, Equatable {
         lhs.id == rhs.id
     }
 
-    /// Attempts to re-enable the tap after a timeout, giving up if it's restarting too frequently.
+    /// Re-enables the tap after the system disabled it.
+    /// If it's restarting too frequently, pauses first so a stalled tap doesn't keep interrupting input.
     func attemptRestart() {
         let now = ContinuousClock.now
         let windowStart = now - Self.restartWindow
         restartTimestamps.removeAll { $0 < windowStart }
         restartTimestamps.append(now)
 
-        let identifier = readableIdentifier ?? id.uuidString
-
-        if restartTimestamps.count > Self.maxRestartsInWindow {
-            log.warn("Event tap '\(identifier)' restart cascade detected, tearing down")
-            tearDownEventTap()
+        guard restartTimestamps.count > Self.maxRestartsInWindow else {
+            start()
             return
         }
 
-        start()
+        let identifier = readableIdentifier ?? id.uuidString
+        log.warn("Event tap '\(identifier)' restart cascade detected, pausing for \(Self.restartWindow)")
+        restartTimestamps.removeAll()
+
+        let runLoop = EventTapThread.shared.runLoop
+        DispatchQueue.global().asyncAfter(deadline: .now() + .seconds(2)) { [weak self] in
+            CFRunLoopPerformBlock(runLoop, CFRunLoopMode.commonModes as CFTypeRef) { [weak self] in
+                guard let self, isEnabled else { return }
+                start()
+            }
+            CFRunLoopWakeUp(runLoop)
+        }
     }
 
     private func tearDownEventTap() {
```

---

### Incident Patch 3: `f1124c51` (2026-09-30)
**Commit Message**: 🐞 Stop Loop from leaving Dock swipes unfinished (#1162)

**File**: `Loop/Core/Multitouch/SystemGestureFilter.swift` (modified, +195/-131)
```diff
@@ -23,28 +23,13 @@ final class SystemGestureFilter {
     }
 
     private enum Owner {
-        case undecided, loop, dock
+        case loop, dock
     }
 
     private enum TitlebarLookup {
         case pending, inside, outside
     }
 
-    private enum Sequence {
-        case passing
-        case dropping
-        /// Started the unbound way on a partly bound axis. The Dock is sent a cancel if Loop claims it
-        case provisional
-        /// Started the bound way on a partly or unconfirmed bound axis. Replayed to the Dock if Loop doesn't claim it
-        case holding(began: CGEvent)
-    }
-
-    private enum Decision {
-        case forward, drop
-        case replay(began: CGEvent, current: CGEvent)
-        case cancel(CGEvent)
-    }
-
     private struct State {
         var isRunning = false
         var claims: [Int: Claims] = [:]
@@ -55,28 +40,41 @@ final class SystemGestureFilter {
         var hasLookedUpTouch = false
         var titlebarLookup = TitlebarLookup.pending
         var isMissionControlShowing = false
+        /// Absent while undecided
         var owners: [Int: Owner] = [:]
+        var sequenceGeneration = 0
 
         var fingerCount: Int {
             fingerCounts.values.max() ?? 0
         }
 
-        /// Titlebar-only gestures stay claimed until known: losing a stroke beats both reacting
-        func claimedGestures(fingerCount: Int) -> Set<DockGesture> {
-            guard let claims = claims[fingerCount] else { return [] }
-            return titlebarLookup == .outside ? claims.anywhere : claims.anywhere.union(claims.titlebarOnly)
+        /// The Dock keeps its gestures while Mission Control is showing, so they can dismiss it
+        func owner(fingerCount: Int) -> Owner? {
+            isMissionControlShowing ? .dock : owners[fingerCount]
         }
+    }
 
-        /// Titlebar-only gestures count once known to apply, so the Dock can still get a stroke Loop rejects
-        func confirmedClaims(fingerCount: Int) -> Set<DockGesture> {
-            guard let claims = claims[fingerCount] else { return [] }
-            return titlebarLookup == .inside ? claims.anywhere.union(claims.titlebarOnly) : claims.anywhere
-        }
+    private struct Hold {
+        var events: [CGEvent]
+        let fingerCount: Int
+        let touchID: Int
+        let motion: CGEventField.DockSwipeMotion
+        let claims: Claims
+        let start: ContinuousClock.Instant
+        var direction: DockGesture?
+    }
 
-        /// The Dock keeps its gestures while Mission Control is showing, so they can dismiss it
-        func owner(fingerCount: Int) -> Owner {
-            isMissionControlShowing ? .dock : owners[fingerCount] ?? .undecided
-        }
+    private enum Sequence {
+        case passing
+        case dropping
+        case holding(Hold)
+    }
+
+    private enum Resolution {
+        case loop(reason: String)
+        case dock(reason: String)
+        case awaitingTitlebar
+        case awaitingDirection
     }
 
     private let gestureMonitor: SubsurfaceMonitor
@@ -85,14 +83,13 @@ final class SystemGestureFilter {
     private var eventMonitor: ActiveEventMonitor?
     private var contactsTask: Task<(), Never>?
 
-    /// Marks events Loop re-posts to the Dock, so the filter lets them through
-    private static let repostMarker: Int64 = 0x4C4F_4F50
-    /// Kept small, as the Dock jumps to the current progress when a held `began` is replayed
-    private static let holdReleaseProgress: Double = 0.05
+    /// How long a sequence may wait on the titlebar lookup before the Dock gets it
+    private static let titlebarDeadline: Duration = .milliseconds(40)
+    private static let ownProcessID = Int64(getpid())
 
     /// Only touched on the event tap thread
     private var sequence = Sequence.passing
-    private var sequenceFingerCount = 0
+    private var sequenceGeneration = 0
 
     init(
         gestureMonitor: SubsurfaceMonitor,
@@ -126,12 +123,14 @@ final class SystemGestureFilter {
         guard eventMonitor == nil else { return }
 
         log.info("Starting system gesture filter")
+        state.withLock { $0.sequenceGeneration += 1 }
 
         let newMonitor = ActiveEventMonitor(
             "system_gesture_filter",
             events: [.dockControl]
-        ) { [weak self] event in
-            self?.handle(event) ?? .forward
+        ) { [weak self] proxy, event in
+            guard let self else { return Unmanaged.passUnretained(event) }
+            return handle(event, proxy: proxy)
         }
         newMonitor.start()
 
@@ -147,7 +146,7 @@ final class SystemGestureFilter {
     func stop() {
         contactsTask?.cancel()
         contactsTask = nil
-        state.withLock { $0 = State() }
+        state.withLock { $0 = State(sequenceGeneration: $0.sequenceGeneration + 1) }
 
         guard let eventMonitor else { return }
         eventMonitor.stop()
@@ -215,139 +214,204 @@ final class SystemGestureFilter {
         }
     }
 

```

**File**: `Loop/Utilities/Event Monitoring/ActiveEventMonitor.swift` (modified, +32/-7)
```diff
@@ -10,7 +10,7 @@ import Scribe
 
 /// Active event monitor that can process and alter events when needed.
 final class ActiveEventMonitor: BaseEventTapMonitor {
-    private let eventCallback: (CGEvent) -> Unmanaged<CGEvent>?
+    private let eventCallback: (CGEventTapProxy, CGEvent) -> Unmanaged<CGEvent>?
 
     enum EventHandling {
         case forward
@@ -47,18 +47,43 @@ final class ActiveEventMonitor: BaseEventTapMonitor {
     ///   - placement: whether to add this monitor as a head or tail relative to other event monitors within this tap.
     ///   - events: the events to capture within this event monitor.
     ///   - callback: a callback to process and potentially alter received events.
-    init(
+    convenience init(
         _ name: String,
         tapLocation: CGEventTapLocation = .cgSessionEventTap,
         placement: CGEventTapPlacement = .tailAppendEventTap,
         events: [CGEventType],
         callback: @escaping (CGEvent) -> Unmanaged<CGEvent>?
     ) {
-        self.eventCallback = callback
+        self.init(
+            name,
+            tapLocation: tapLocation,
+            placement: placement,
+            events: events,
+            proxyCallback: { _, event in callback(event) }
+        )
+    }
+
+    /// Initializes an `ActiveEventMonitor` whose callback also receives the tap proxy.
+    /// The proxy is only valid for the duration of the callback, and can be used with `CGEventTapPostEvent`
+    /// to post events from this tap's position, ahead of the event currently being processed.
+    /// - Parameters:
+    ///   - name: a human-readable identifier used in log messages.
+    ///   - tapLocation: the location at which this event tap will be placed.
+    ///   - placement: whether to add this monitor as a head or tail relative to other event monitors within this tap.
+    ///   - events: the events to capture within this event monitor.
+    ///   - proxyCallback: a callback to process and potentially alter received events, called on `EventTapThread`.
+    init(
+        _ name: String,
+        tapLocation: CGEventTapLocation = .cgSessionEventTap,
+        placement: CGEventTapPlacement = .tailAppendEventTap,
+        events: [CGEventType],
+        proxyCallback: @escaping (CGEventTapProxy, CGEvent) -> Unmanaged<CGEvent>?
+    ) {
+        self.eventCallback = proxyCallback
         super.init()
 
         let eventsOfInterest = events.reduce(CGEventMask(0)) { $0 | (1 << $1.rawValue) }
-        let callback: CGEventTapCallBack = { _, eventType, event, refcon in
+        let callback: CGEventTapCallBack = { proxy, eventType, event, refcon in
             guard let refcon else { return nil }
             let observer = Unmanaged<ActiveEventMonitor>.fromOpaque(refcon).takeUnretainedValue()
 
@@ -79,7 +104,7 @@ final class ActiveEventMonitor: BaseEventTapMonitor {
             }
 
             guard unsafeBitCast(event, to: UnsafeRawPointer?.self) != nil else { return nil }
-            return observer.handleEvent(event: event)
+            return observer.handleEvent(proxy: proxy, event: event)
         }
 
         let userInfo = Unmanaged.passRetained(self).toOpaque()
@@ -99,7 +124,7 @@ final class ActiveEventMonitor: BaseEventTapMonitor {
         }
     }
 
-    private func handleEvent(event: CGEvent) -> Unmanaged<CGEvent>? {
-        eventCallback(event)
+    private func handleEvent(proxy: CGEventTapProxy, event: CGEvent) -> Unmanaged<CGEvent>? {
+        eventCallback(proxy, event)
     }
 }
```

---

### Incident Patch 4: `0ac6d834` (2026-09-29)
**Commit Message**: 🐞 Fix wallpaper capture on macOS 27 (#1160)

**File**: `Loop/Accent Color/WallpaperImageFetcher.swift` (modified, +27/-12)
```diff
@@ -8,12 +8,19 @@
 import SwiftUI
 
 final class WallpaperImageFetcher {
+    /// Bundle identifier for the wallpaper window process
+    /// On macOS 27 and later, the wallpaper window is not owned by the dock but rather the window manager.
+    private static let wallpaperOwnerBundleIDs: Set<String> = [
+        "com.apple.dock",
+        "com.apple.WindowManager"
+    ]
+
     /// Takes a screenshot of the main display.
     /// - Returns: An NSImage of the screenshot or nil if the operation fails.
     ///
     /// This method attempts to capture the desktop wallpaper using three approaches:
-    /// 1. First, it tries to find and capture the Dock's wallpaper window directly that matches our screen dimensions
-    /// 2. If that fails, it tries to capture any wallpaper window from the Dock (even if not on our exact screen)
+    /// 1. First, it tries to find and capture the system wallpaper window directly that matches our screen dimensions
+    /// 2. If that fails, it tries to capture any system wallpaper window  (even if not on our exact screen)
     /// 3. As a last resort, it falls back to capturing the entire screen
     ///
     /// The direct wallpaper capture is preferred as it gets only the wallpaper without desktop icons,
@@ -24,13 +31,13 @@ final class WallpaperImageFetcher {
         let screen = NSScreen.screenWithMouse ?? NSScreen.main ?? NSScreen.screens[0]
         let screenFrame = screen.displayBounds
 
-        // First try to get the wallpaper window from the Dock app that matches our screen dimensions
-        if let wallpaperImage = try? await captureWallpaperFromDock(screenFrame: screenFrame, matchFrame: true) {
+        // First try to get the wallpaper window from the system that matches our screen dimensions
+        if let wallpaperImage = try? await captureSystemWallpaper(screenFrame: screenFrame, matchFrame: true) {
             return wallpaperImage
         }
 
-        // Second fallback: try to get any wallpaper window from the Dock, regardless of screen dimensions
-        if let anyWallpaperImage = try? await captureWallpaperFromDock(screenFrame: screenFrame, matchFrame: false) {
+        // Second fallback: try to get any wallpaper window, regardless of screen dimensions
+        if let anyWallpaperImage = try? await captureSystemWallpaper(screenFrame: screenFrame, matchFrame: false) {
             return anyWallpaperImage
         }
 
@@ -42,22 +49,30 @@ final class WallpaperImageFetcher {
         throw WallpaperProcessorError.screenshotFailed
     }
 
-    /// Attempts to capture the wallpaper window from the Dock app.
+    /// Attempts to capture the wallpaper window from the Dock or WindowManager.
     /// - Parameters:
     ///   - screenFrame: The frame of the screen to capture.
     ///   - matchFrame: Whether to match the exact screen frame dimensions or get any wallpaper window.
     /// - Returns: An NSImage of the wallpaper or nil if the operation fails.
     ///
-    /// This approach uses window capturing APIs to specifically target the Dock's wallpaper window.
+    /// This approach uses window capturing APIs to specifically target the systems wallpaper window.
     /// It requires appropriate permissions, but provides the cleanest capture of just the wallpaper.
-    /// The method identifies the wallpaper window by filtering window properties from the Dock process.
-    private func captureWallpaperFromDock(screenFrame: CGRect, matchFrame: Bool) async throws -> NSImage? {
-        // Get all windows and filter for the Dock's wallpaper windows
+    /// The method identifies the wallpaper window by filtering window properties from the Dock/WindowManager process.
+    private func captureSystemWallpaper(screenFrame: CGRect, matchFrame: Bool) async throws -> NSImage? {
+        // Get all windows and filter for the wallpaper windows
         let windows = CGWindowListCopyWindowInfo(.optionAll, kCGNullWindowID) as! [[CFString: Any]]
         var wallpaperWindows = windows
-            .filter { $0[kCGWindowOwnerName] as? String == "Dock" }
+            .filter { window in
+                guard let pid = window[kCGWindowOwnerPID] as? pid_t,
+                      let bundleIdentifier = NSRunningApplication(processIdentifier: pid)?.bundleIdentifier
+                else {
+                    return false
+                }
+                return Self.wallpaperOwnerBundleIDs.contains(bundleIdentifier)
+            }
             .filter { ($0[kCGWindowName] as? String ?? "").contains("Wallpaper") }
             .filter { $0[kCGWindowIsOnscreen] as? Int == 1 }
+            .filter { ($0[kCGWindowLayer] as? Int ?? 0) <= CGWindowLevelForKey(.desktopWindow) }
 
         // Apply additional frame filtering only if matchFrame is true
         if matchFrame {
```

---

### Incident Patch 5: `a1e33281` (2026-08-31)
**Commit Message**: 🐞 Fix Golden Gate icon blocking releases in macOS Tahoe CI

**File**: `Loop/Resources/AppIcon-Developer.icon/icon.json` (modified, +3/-12)
```diff
@@ -1,7 +1,4 @@
 {
-  "features" : [
-    "refractivity"
-  ],
   "fill" : {
     "linear-gradient" : [
       "display-p3:0.29000,0.64300,1.00000,1.00000",
@@ -118,11 +115,6 @@
           "value" : 1
         }
       ],
-      "refractivity" : {
-        "depth" : 0.14,
-        "enabled" : true,
-        "strength" : 0.38
-      },
       "shadow" : {
         "kind" : "neutral",
         "opacity" : 0.75
@@ -200,9 +192,8 @@
     }
   ],
   "supported-platforms" : {
-    "circles" : [
-      "watchOS"
-    ],
-    "squares" : "shared"
+    "squares" : [
+      "macOS"
+    ]
   }
 }
\ No newline at end of file
```

---

### Incident Patch 6: `a7a8e5fa` (2026-08-09)
**Commit Message**: 🐞 Fix makeKeyWindow NaN coords that terminate Chromium PWA shims (#1132)

**File**: `Loop/Private APIs/SkyLightToolBelt.swift` (modified, +35/-15)
```diff
@@ -92,11 +92,34 @@ enum SkyLightToolBelt {
     }
 
     ///
+    /// Byte layout for the synthetic `CGSEventRecord` posted by `makeKeyWindow`.
+    /// Offsets match CGSInternal's CGSEvent.h / yabai / AltTab.
+    private enum MakeKeyWindowEvent {
+        /// Allocated buffer size. The record's declared length stays `recordLength`;
+        /// we allocate a little more because newer macOS WindowServer encoding can
+        /// read past the record (see AltTab / paneru#123).
+        static let bufferSize = 0x100
+        static let lengthOffset = 0x04
+        static let recordLength: UInt8 = 0xF8
+        static let eventTypeOffset = 0x08
+        static let leftMouseDown: UInt8 = 0x01
+        static let leftMouseUp: UInt8 = 0x02
+        /// Window-relative click point. Just outside the frame so the window becomes
+        /// key without hitting content. Must be finite — `0xFF` fill decodes as NaN
+        /// and can terminate Chromium PWA app-shim Mojo connections (#1131).
+        static let windowLocationOffset = 0x20
+        static let offContentPoint = CGPoint(x: -1, y: -1)
+        static let unknownFlagOffset = 0x3A
+        static let unknownFlagValue: UInt8 = 0x10
+        static let windowIdOffset = 0x3C
+    }
+
     /// Focuses a window. This will attempt to bring the window to the front and make it the active window.
     /// Note that this first sets the process as frontmost, *then* sends a left click event to the window itself.
     ///
-    /// This method uses a private API to focus the window.
-    /// The code for this method is derived from the Amethyst source code. Details of its implementation can be found [here](https://github.com/Hammerspoon/hammerspoon/issues/370#issuecomment-545545468)
+    /// Uses a private API. Derived from Hammerspoon / yabai / AltTab
+    /// (https://github.com/Hammerspoon/hammerspoon/issues/370#issuecomment-545545468,
+    /// https://github.com/lwouis/alt-tab-macos/commit/782f1fe2e7272f185526e3e69eadd08c241fe050).
     ///
     /// - Parameters:
     ///   - windowID: The `CGWindowID` of the window to focus.
@@ -117,19 +140,16 @@ enum SkyLightToolBelt {
             return false
         }
 
-        // `0x01` is left click down, `0x02` is left click up (see `CGEventType`)
-        for byte in [0x01, 0x02] {
-            // Create raw `SLSEvent` data.
-            // Future consideration: instead of manually creating the bytes here, investigate:
-            // - Creating a `SLSEvent` (likely analogous to `CGEvent`)
-            // - Apply an identifier to the event to help Loop differentiate events that originate from itself
-            // - Converting the `SLSEvent` to data using `SLEventCreateData` in SkyLight
-            var bytes = [UInt8](repeating: 0, count: 0xF8)
-            bytes[0x04] = 0xF8
-            bytes[0x08] = UInt8(byte)
-            bytes[0x3A] = 0x10
-            memcpy(&bytes[0x3C], &wid, MemoryLayout<UInt32>.size)
-            memset(&bytes[0x20], 0xFF, 0x10)
+        var offContentPoint = MakeKeyWindowEvent.offContentPoint
+
+        for eventType in [MakeKeyWindowEvent.leftMouseDown, MakeKeyWindowEvent.leftMouseUp] {
+            var bytes = [UInt8](repeating: 0, count: MakeKeyWindowEvent.bufferSize)
+            bytes[MakeKeyWindowEvent.lengthOffset] = MakeKeyWindowEvent.recordLength
+            bytes[MakeKeyWindowEvent.eventTypeOffset] = eventType
+            bytes[MakeKeyWindowEvent.unknownFlagOffset] = MakeKeyWindowEvent.unknownFlagValue
+            memcpy(&bytes[MakeKeyWindowEvent.windowIdOffset], &wid, MemoryLayout<UInt32>.size)
+            memcpy(&bytes[MakeKeyWindowEvent.windowLocationOffset], &offContentPoint, MemoryLayout<CGPoint>.size)
+
             let cgStatus = bytes.withUnsafeMutableBufferPointer { pointer in
                 SLPSPostEventRecordTo(&psn, &pointer.baseAddress!.pointee)
             }
```

---

### Incident Patch 7: `2467291f` (2026-08-07)
**Commit Message**: 🐞 Fix crash when a cycle action has an empty cycle (#1115)

**File**: `Loop/Core/LoopManager.swift` (modified, +2/-1)
```diff
@@ -474,7 +474,8 @@ extension LoopManager {
     }
 
     private func getNextCycleAction(_ action: WindowAction) async -> WindowAction {
-        guard let currentCycle = action.cycle else {
+        // `currentCycle[0]` below would trap on an empty cycle.
+        guard let currentCycle = action.cycle, !currentCycle.isEmpty else {
             return action
         }
 
```

---

### Incident Patch 8: `2e3452fc` (2026-07-15)
**Commit Message**: 💄 liquid glass toolbar button

**File**: `Loop/Settings Window/SettingsContentView.swift` (modified, +23/-7)
```diff
@@ -43,15 +43,31 @@ struct SettingsContentView: View {
 
                     Spacer()
 
-                    Button {
-                        model.showInspector.toggle()
-                    } label: {
-                        Image(systemName: "sidebar.right")
-                            .animation(animation, value: model.showInspector)
+                    if #available(macOS 26.0, *) {
+                        // mimics the toolbar buttons on macOS 26+.
+                        // ideally this would use a native NSToolbar, but there doesn't seem to be a clean
+                        // way to position a button beside the detail/inspector separator :/
+                        Button {
+                            model.showInspector.toggle()
+                        } label: {
+                            Image(systemName: "sidebar.right")
+                                .font(.title3)
+                                .animation(animation, value: model.showInspector)
+                                .frame(width: 28, height: 28)
+                        }
+                        .buttonBorderShape(.circle)
+                        .buttonStyle(.glass(.regular.interactive()))
+                        .tint(.clear)
+                    } else {
+                        Button {
+                            model.showInspector.toggle()
+                        } label: {
+                            Image(systemName: "sidebar.right")
+                                .animation(animation, value: model.showInspector)
+                        }
+                        .luminareContentSize(aspectRatio: 1, contentMode: .fit, hasFixedHeight: true)
                     }
-                    .luminareContentSize(aspectRatio: 1, contentMode: .fit, hasFixedHeight: true)
                 }
-                .drawingGroup()
             }
             .frame(width: 390)
 
```

---

### Incident Patch 9: `6e2b1d00` (2026-07-01)
**Commit Message**: 🐞 Fix stack overflow crash on window-move actions (#1113)

**File**: `Loop/Window Management/Window Manipulation/ResizeContext.swift` (modified, +7/-1)
```diff
@@ -131,6 +131,13 @@ final class ResizeContext {
     }
 
     private func recomputeTargetFrame() {
+        // Clear the recompute guard *before* resolving so this method is re-entrancy safe:
+        // if `WindowFrameResolver.getFrame` ever reads `getTargetFrame()` on this same
+        // context while it is still being computed, the guard is already clear and the
+        // re-entrant call returns the cached frame instead of recomputing and recursing
+        // until the stack overflows.
+        needsRecompute = false
+
         let result = WindowFrameResolver.getFrame(resizeContext: self)
 
         let normalized = CGRect(
@@ -152,7 +159,6 @@ final class ResizeContext {
             normalized: normalized,
             padded: paddedFrame
         )
-        needsRecompute = false
 
         log.info("Computed target frame - raw: \(cachedTargetFrame.raw), normalized: \(cachedTargetFrame.normalized) padded: \(cachedTargetFrame.padded), for action: \(action)")
     }
```

**File**: `Loop/Window Management/Window Manipulation/WindowFrameResolver.swift` (modified, +6/-1)
```diff
@@ -201,7 +201,12 @@ extension WindowFrameResolver {
             )
 
         } else if direction.willMove {
-            let frameToResizeFrom = context.getTargetFrame().raw
+            // Read the last applied frame (falling back to the cached target) instead of
+            // `context.getTargetFrame()`. `getTargetFrame()` would recompute this very
+            // context and re-enter here, recursing until the stack overflows. Matching the
+            // grow/shrink branches above also keeps moves anchored to the window's actual
+            // position rather than a theoretical (possibly clamped-away) target frame.
+            let frameToResizeFrom = context.lastAppliedFrame ?? context.cachedTargetFrame.raw
 
             result = calculatePositionAdjustment(for: action, frameToResizeFrom: frameToResizeFrom)
 
```

---

### Incident Patch 10: `398b06b1` (2026-07-01)
**Commit Message**: 💄 Expose all space-switching actions inside UI with icons

**File**: `Loop/Localizable.xcstrings` (modified, +3/-0)
```diff
@@ -30052,6 +30052,9 @@
         }
       }
     },
+    "Space Switching" : {
+      "comment" : "Section header in the action picker of the Keybinds tab"
+    },
     "Stage Manager" : {
       "comment" : "Section header shown in settings",
       "localizations" : {
```

**File**: `Loop/Utilities/PickerList.swift` (modified, +1/-0)
```diff
@@ -187,6 +187,7 @@ extension PickerSection where V == WindowDirection {
             .init(String(localized: "Vertical Thirds", comment: "Section header in the action picker of the Keybinds tab"), WindowDirection.verticalThirds),
             .init(String(localized: "Horizontal Fourths", comment: "Section header in the action picker of the Keybinds tab"), WindowDirection.horizontalFourths),
             .init(String(localized: "Screen Switching", comment: "Section header in the action picker of the Keybinds tab"), WindowDirection.screenSwitching),
+            .init(String(localized: "Space Switching", comment: "Section header in the action picker of the Keybinds tab"), WindowDirection.spaceSwitching),
             .init(String(localized: "Size Adjustment", comment: "Section header in the action picker of the Keybinds tab"), WindowDirection.sizeAdjustment),
             .init(String(localized: "Shrink", comment: "Section header in the action picker of the Keybinds tab"), WindowDirection.shrink),
             .init(String(localized: "Grow", comment: "Section header in the action picker of the Keybinds tab"), WindowDirection.grow),
```

**File**: `Loop/Window Management/Window Action/IconView.swift` (modified, +21/-7)
```diff
@@ -190,7 +190,7 @@ final class IconRenderView: NSView {
             animatePath(layer: fillLayer, to: newPath, duration: duration)
         case let .image(image):
             imageLayer.contents = processImage(image, color: .textColor)
-            imageLayer.frame = getImageBounds()
+            imageLayer.frame = getImageBounds(for: image)
             animateAlpha(layer: fillLayer, to: 0, duration: duration)
             animateAlpha(layer: imageLayer, to: 1, duration: duration)
         }
@@ -290,14 +290,28 @@ final class IconRenderView: NSView {
         return sizedImage
     }
 
-    private func getImageBounds() -> NSRect {
+    private func getImageBounds(for image: NSImage) -> NSRect {
         let insetBounds = bounds.insetBy(dx: strokeWidth, dy: strokeWidth)
-        let side = min(insetBounds.width, insetBounds.height)
+        let imageAspectRatio = image.size.width / max(image.size.height, 1)
+        let boundsAspectRatio = insetBounds.width / max(insetBounds.height, 1)
+
+        let imageSize = if imageAspectRatio > boundsAspectRatio {
+            CGSize(
+                width: insetBounds.width,
+                height: insetBounds.width / imageAspectRatio
+            )
+        } else {
+            CGSize(
+                width: insetBounds.height * imageAspectRatio,
+                height: insetBounds.height
+            )
+        }
+
         let squareRect = CGRect(
-            x: insetBounds.midX - side / 2,
-            y: insetBounds.midY - side / 2,
-            width: side,
-            height: side
+            x: insetBounds.midX - imageSize.width / 2,
+            y: insetBounds.midY - imageSize.height / 2,
+            width: imageSize.width,
+            height: imageSize.height
         )
         return squareRect
     }
```

**File**: `Loop/Window Management/Window Action/WindowAction+Image.swift` (modified, +44/-3)
```diff
@@ -11,13 +11,16 @@ import SwiftUI
 enum WindowActionImage {
     case systemImage(String)
     case resource(ImageResource)
+    case number(Int)
 
     var image: Image {
         switch self {
         case let .systemImage(string):
             Image(systemName: string)
         case let .resource(resource):
             Image(resource)
+        case .number:
+            Image(nsImage: nsImage)
         }
     }
 
@@ -28,13 +31,51 @@ enum WindowActionImage {
             return image?.withSymbolConfiguration(.init(pointSize: 20, weight: .bold)) ?? image ?? NSImage()
         case let .resource(resource):
             return NSImage(resource: resource)
+        case let .number(number):
+            return Self.numberImage(number)
         }
     }
+
+    private static func numberImage(_ number: Int) -> NSImage {
+        let size = CGSize(width: 22, height: 16)
+        let image = NSImage(size: size)
+
+        image.lockFocus()
+        defer {
+            image.unlockFocus()
+            image.isTemplate = true
+        }
+
+        let paragraphStyle = NSMutableParagraphStyle()
+        paragraphStyle.alignment = .center
+
+        let attributes: [NSAttributedString.Key: Any] = [
+            .font: NSFont.monospacedDigitSystemFont(ofSize: 14, weight: .bold),
+            .foregroundColor: NSColor.black,
+            .paragraphStyle: paragraphStyle
+        ]
+
+        let text = "\(number)" as NSString
+        let textSize = text.size(withAttributes: attributes)
+        let textRect = CGRect(
+            x: 0,
+            y: (size.height - textSize.height) / 2,
+            width: size.width,
+            height: textSize.height
+        )
+        text.draw(in: textRect, withAttributes: attributes)
+
+        return image
+    }
 }
 
 extension WindowAction {
     var image: WindowActionImage? {
-        switch direction {
+        if let desktopNumber = direction.spaceDestination?.desktopNumber {
+            return .number(Int(desktopNumber))
+        }
+
+        return switch direction {
         case .noAction:
             .systemImage("questionmark")
         case .undo:
@@ -51,9 +92,9 @@ extension WindowAction {
             .systemImage("arrow.up.and.down")
         case .maximizeWidth:
             .systemImage("arrow.left.and.right")
-        case .nextScreen:
+        case .nextScreen, .nextSpace:
             .systemImage("arrow.forward")
-        case .previousScreen:
+        case .previousScreen, .previousSpace:
             .systemImage("arrow.backward")
         case .leftScreen:
             .systemImage("arrow.left.to.line")
```

**File**: `Loop/Window Management/Window Manipulation/WindowActionEngine.swift` (modified, +7/-0)
```diff
@@ -202,6 +202,13 @@ final class WindowActionEngine {
             case let .desktop(n): "desktop \(n)"
             }
         }
+
+        var desktopNumber: UInt? {
+            if case let .desktop(number) = self {
+                return number
+            }
+            return nil
+        }
     }
 
     private func throwWindow(_ window: Window, to space: SpaceDestination) async {
```

---

### Incident Patch 11: `d7f9a1a7` (2026-05-25)
**Commit Message**: ✨ Safer event monitors + use notification to terminate other Loop instances

**File**: `Loop/App/AppDelegate.swift` (modified, +77/-39)
```diff
@@ -5,6 +5,7 @@
 //  Created by Kai Azim on 2023-10-05.
 //
 
+import Darwin
 import Defaults
 import Scribe
 import SwiftUI
@@ -14,6 +15,9 @@ import UserNotifications
 final class AppDelegate: NSObject, NSApplicationDelegate {
     private let urlCommandHandler = URLCommandHandler()
 
+    private static let terminateNotificationName = Notification.Name("com.MrKai77.Loop.terminate")
+    private var terminateObserver: Any?
+
     private var launchedAsLoginItem: Bool {
         guard let event = NSAppleEventManager.shared().currentAppleEvent else { return false }
         return
@@ -24,8 +28,8 @@ final class AppDelegate: NSObject, NSApplicationDelegate {
     func applicationDidFinishLaunching(_: Notification) {
         configureLogging()
 
-        // Check for and terminate other running Loop instances to prevent accessibility conflicts
-        terminateOtherLoopInstances()
+        // Register before broadcasting so other instances can receive the signal
+        registerTerminateObserver()
 
         Task {
             await Defaults.iCloud.waitForSyncCompletion()
@@ -42,69 +46,103 @@ final class AppDelegate: NSObject, NSApplicationDelegate {
         DataPatcher.run()
         IconManager.refreshCurrentAppIcon()
         LaunchAtLoginManager.shared.start()
-        LoopManager.shared.start()
-        WindowDragManager.shared.addObservers()
-        StashManager.shared.start()
-
-        Task {
-            // Wait to let the app settle and to prevent overwhelming the user
-            try? await Task.sleep(for: .seconds(5))
-
-            await Updater.shared.fetchLatestInfo()
-            await Updater.shared.showUpdateWindowIfEligible()
-        }
 
         UNUserNotificationCenter.current().delegate = self
         AppDelegate.requestNotificationAuthorization()
 
-        Task {
-            try? await Task.sleep(for: .seconds(1.5))
-            AccessibilityManager.requestAccess()
-        }
-
         // Register for URL handling
         NSAppleEventManager.shared().setEventHandler(
             self,
             andSelector: #selector(handleGetURLEvent(_:withReplyEvent:)),
             forEventClass: AEEventClass(kInternetEventClass),
             andEventID: AEEventID(kAEGetURL)
         )
+
+        let stalePIDs = broadcastTerminateToOtherInstances()
+
+        // Wait for other instances to fully exit before installing event taps to prevent conflicts
+        Task { @MainActor in
+            await waitForInstancesToExit(pids: stalePIDs, timeout: .seconds(3))
+            LoopManager.shared.start()
+            WindowDragManager.shared.addObservers()
+            StashManager.shared.start()
+            AccessibilityManager.requestAccess()
+
+            // Wait for the app to settle before showing the update window
+            try? await Task.sleep(for: .seconds(5))
+            await Updater.shared.fetchLatestInfo()
+            await Updater.shared.showUpdateWindowIfEligible()
+        }
+    }
+
+    /// Subscribes to the terminate notification so this instance shuts down when a newer Loop instance launches.
+    private func registerTerminateObserver() {
+        terminateObserver = DistributedNotificationCenter.default().addObserver(
+            forName: Self.terminateNotificationName,
+            object: nil,
+            queue: .main
+        ) { [weak self] notification in
+            guard let self else { return }
+
+            // Ignore our own broadcast (for obvious reasons)
+            if let senderPID = notification.userInfo?["pid"] as? Int,
+               senderPID == Int(ProcessInfo.processInfo.processIdentifier) {
+                return
+            }
+
+            log.info("Received terminate broadcast from newer Loop instance, shutting down")
+            NSApp.terminate(nil)
+        }
     }
 
-    /// Terminates any other running instances of Loop to prevent accessibility permission conflicts.
-    private func terminateOtherLoopInstances() {
-        let currentProcessId = ProcessInfo.processInfo.processIdentifier
+    /// Sends the terminate notification to any other running Loop instances, and returns their PIDs.
+    @discardableResult
+    private func broadcastTerminateToOtherInstances() -> [pid_t] {
+        let currentPID = ProcessInfo.processInfo.processIdentifier
         let bundleId = Bundle.main.bundleIdentifier ?? "com.MrKai77.Loop"
 
-        let runningApps = NSWorkspace.shared.runningApplications
-        let otherLoopInstances = runningApps.filter {
-            $0.bundleIdentifier == bundleId && $0.processIdentifier != currentProcessId
+        let otherInstances = NSWorkspace.shared.runningApplications.filter {
+            $0.bundleIdentifier == bundleId && $0.processIdentifier != currentPID
         }
 
-        guard !otherLoopInstances.isEmpty else {
+        guard !otherInstances.isEmpty else {
             log.info("No other Loop instances found")
-            return
+            return []
         }
 
-        log.info("Found \(
```

**File**: `Loop/Utilities/Event Monitoring/ActiveEventMonitor.swift` (modified, +15/-3)
```diff
@@ -65,14 +65,26 @@ final class ActiveEventMonitor: BaseEventTapMonitor {
             }
             let observer = Unmanaged<ActiveEventMonitor>.fromOpaque(refcon).takeUnretainedValue()
 
-            // If disabled, simply pass the event through, but attempt to restart the event tap.
-            if event.type == .tapDisabledByTimeout || event.type == .tapDisabledByUserInput {
-                observer.start()
+            if event.type == .tapDisabledByTimeout {
+                // Tap timed out, schedule a restart on the tap thread so the circuit breaker can run
+                if observer.isEnabled {
+                    let tapRunLoop = EventTapThread.shared.runLoop
+                    CFRunLoopPerformBlock(tapRunLoop, CFRunLoopMode.commonModes as CFTypeRef) {
+                        observer.attemptRestart()
+                    }
+                    CFRunLoopWakeUp(tapRunLoop)
+                }
+                return Unmanaged.passUnretained(event)
+            }
+
+            if event.type == .tapDisabledByUserInput {
+                // Explicitly disabled by the user/system, don't auto-restart
                 return Unmanaged.passUnretained(event)
             }
 
             return observer.handleEvent(event: event)
         }
+
         let userInfo = Unmanaged.passUnretained(self).toOpaque()
 
         if let eventTap = CGEvent.tapCreate(
```

**File**: `Loop/Utilities/Event Monitoring/BaseEventTapMonitor.swift` (modified, +39/-41)
```diff
@@ -12,7 +12,9 @@ import Scribe
 /// Base class to share common functionality. DO NOT USE DIRECTLY!
 @Loggable
 class BaseEventTapMonitor: EventMonitorProtocol, Identifiable, Equatable {
-    private static let teardownTimeout: DispatchTimeInterval = .milliseconds(250)
+    // Allow at most 5 restarts within any 2 second window before giving up
+    private static let restartWindow: Duration = .seconds(2)
+    private static let maxRestartsInWindow = 5
 
     let id = UUID()
 
@@ -22,6 +24,8 @@ class BaseEventTapMonitor: EventMonitorProtocol, Identifiable, Equatable {
     private var readableIdentifier: String?
     private(set) var isEnabled: Bool = false
 
+    private var restartTimestamps: [ContinuousClock.Instant] = []
+
     deinit {
         tearDownEventTap()
     }
@@ -42,14 +46,22 @@ class BaseEventTapMonitor: EventMonitorProtocol, Identifiable, Equatable {
     func start() {
         guard let eventTap else { return }
 
+        guard CFMachPortIsValid(eventTap) else {
+            let identifier = readableIdentifier ?? id.uuidString
+            log.warn("Event tap '\(identifier)' mach port is invalid, tearing down")
+            tearDownEventTap()
+            return
+        }
+
+        isEnabled = true
+
         if let readableIdentifier {
             log.info("Starting BaseEventTapMonitor '\(readableIdentifier)'")
         } else {
             log.info("Starting BaseEventTapMonitor with ID \(id)")
         }
 
         CGEvent.tapEnable(tap: eventTap, enable: true)
-        isEnabled = true
     }
 
     func stop() {
@@ -68,63 +80,49 @@ class BaseEventTapMonitor: EventMonitorProtocol, Identifiable, Equatable {
         lhs.id == rhs.id
     }
 
+    /// Attempts to re-enable the tap after a timeout, giving up if it's restarting too frequently.
+    func attemptRestart() {
+        let now = ContinuousClock.now
+        let windowStart = now - Self.restartWindow
+        restartTimestamps.removeAll { $0 < windowStart }
+        restartTimestamps.append(now)
+
+        let identifier = readableIdentifier ?? id.uuidString
+
+        if restartTimestamps.count > Self.maxRestartsInWindow {
+            log.warn("Event tap '\(identifier)' restart cascade detected, tearing down")
+            tearDownEventTap()
+            return
+        }
+
+        start()
+    }
+
     private func tearDownEventTap() {
         guard eventTap != nil || runLoopSource != nil else { return }
 
         let eventTap = eventTap
         let runLoop = runLoop
         let runLoopSource = runLoopSource
-        let readableIdentifier = readableIdentifier
 
         self.eventTap = nil
         self.runLoop = nil
         self.runLoopSource = nil
         isEnabled = false
 
-        let cleanup = {
-            if let eventTap, CFMachPortIsValid(eventTap) {
-                CGEvent.tapEnable(tap: eventTap, enable: false)
-            }
-
-            if let runLoop, let runLoopSource, CFRunLoopSourceIsValid(runLoopSource) {
-                CFRunLoopRemoveSource(runLoop, runLoopSource, .commonModes)
-            }
-
-            if let eventTap, CFMachPortIsValid(eventTap) {
-                CFMachPortInvalidate(eventTap)
-            }
+        if let eventTap, CFMachPortIsValid(eventTap) {
+            CGEvent.tapEnable(tap: eventTap, enable: false)
+            CFMachPortInvalidate(eventTap)
         }
 
-        guard let runLoop else {
-            cleanup()
-            return
-        }
-
-        if CFRunLoopGetCurrent() == runLoop {
-            cleanup()
-            return
-        }
+        guard let runLoop, let runLoopSource else { return }
 
-        let finished = DispatchSemaphore(value: 0)
+        // Keep the tap callback's refcon pointer valid until any in-flight callback finishes
         let monitor = self
-        CFRunLoopPerformBlock(runLoop, CFRunLoopMode.commonModes.rawValue) {
-            cleanup()
-
-            // Keep callback userInfo valid until the tap is torn down
+        CFRunLoopPerformBlock(runLoop, CFRunLoopMode.commonModes as CFTypeRef) {
+            CFRunLoopRemoveSource(runLoop, runLoopSource, .commonModes)
             _ = monitor
-
-            finished.signal()
         }
         CFRunLoopWakeUp(runLoop)
-
-        if finished.wait(timeout: .now() + Self.teardownTimeout) == .timedOut {
-            if let eventTap, CFMachPortIsValid(eventTap) {
-                CGEvent.tapEnable(tap: eventTap, enable: false)
-                CFMachPortInvalidate(eventTap)
-            }
-
-            let identifier = readableIdentifier ?? id.uuidString
-            log.warn("Timed out while tearing down event tap '\(identifier)'. Invalidated it from the caller thread.")
-        }
     }
 }
```

**File**: `Loop/Utilities/Event Monitoring/PassiveEventMonitor.swift` (modified, +15/-3)
```diff
@@ -38,16 +38,28 @@ final class PassiveEventMonitor: BaseEventTapMonitor {
             }
             let observer = Unmanaged<PassiveEventMonitor>.fromOpaque(refcon).takeUnretainedValue()
 
-            // If disabled, attempt to restart the event tap
-            if event.type == .tapDisabledByTimeout || event.type == .tapDisabledByUserInput {
-                observer.start()
+            if event.type == .tapDisabledByTimeout {
+                // Tap timed out, schedule a restart on the tap thread so the circuit breaker can run
+                if observer.isEnabled {
+                    let tapRunLoop = EventTapThread.shared.runLoop
+                    CFRunLoopPerformBlock(tapRunLoop, CFRunLoopMode.commonModes as CFTypeRef) {
+                        observer.attemptRestart()
+                    }
+                    CFRunLoopWakeUp(tapRunLoop)
+                }
+                return Unmanaged.passUnretained(event)
+            }
+
+            if event.type == .tapDisabledByUserInput {
+                // Explicitly disabled by the user/system, don't auto-restart
                 return Unmanaged.passUnretained(event)
             }
 
             // Call the callback but always pass the unmodified event through
             observer.eventCallback(event)
             return Unmanaged.passUnretained(event)
         }
+
         let userInfo = Unmanaged.passUnretained(self).toOpaque()
 
         if let eventTap = CGEvent.tapCreate(
```

---

### Incident Patch 12: `821a174e` (2026-05-12)
**Commit Message**: 🐞 Fix Loop not terminating

**File**: `Loop/App/AppDelegate.swift` (modified, +3/-54)
```diff
@@ -13,7 +13,6 @@ import UserNotifications
 @Loggable
 final class AppDelegate: NSObject, NSApplicationDelegate {
     private let urlCommandHandler = URLCommandHandler()
-    private var shutdownTask: Task<(), Never>?
 
     private var launchedAsLoginItem: Bool {
         guard let event = NSAppleEventManager.shared().currentAppleEvent else { return false }
@@ -134,68 +133,18 @@ final class AppDelegate: NSObject, NSApplicationDelegate {
         return true
     }
 
-    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
-        if shutdownTask != nil {
-            return .terminateLater
-        }
-
+    func applicationShouldTerminate(_: NSApplication) -> NSApplication.TerminateReply {
         // LoopManager and WindowDragManager are explicitly shut down so that their
         // event monitors are stopped immediately (in case they are active)
         LoopManager.shared.shutdown()
         WindowDragManager.shared.shutdown()
-
-        shutdownTask = Task { @MainActor in
-            let didFinishStashShutdown = await runStashShutdownWithTimeout(.seconds(3))
-            if !didFinishStashShutdown {
-                log.warn("Timed out while restoring stashed windows during termination. Continuing shutdown.")
-            }
-
-            self.shutdownTask = nil
-            sender.reply(toApplicationShouldTerminate: true)
-        }
-
-        return .terminateLater
+        StashManager.shared.shutdown()
+        return .terminateNow
     }
 
     func application(_: NSApplication, open urls: [URL]) {
         for url in urls {
             urlCommandHandler.handle(url)
         }
     }
-
-    private func runStashShutdownWithTimeout(_ duration: Duration) async -> Bool {
-        await withCheckedContinuation { continuation in
-            let reply = OneShotContinuation(continuation)
-
-            let shutdownTask = Task { @MainActor in
-                await StashManager.shared.shutdown()
-                reply.resume(returning: true)
-            }
-
-            Task {
-                try? await Task.sleep(for: duration)
-                shutdownTask.cancel()
-                reply.resume(returning: false)
-            }
-        }
-    }
-}
-
-private final class OneShotContinuation<T>: @unchecked Sendable {
-    private let lock = NSLock()
-    private var didResume = false
-    private let continuation: CheckedContinuation<T, Never>
-
-    init(_ continuation: CheckedContinuation<T, Never>) {
-        self.continuation = continuation
-    }
-
-    func resume(returning result: T) {
-        lock.lock()
-        defer { lock.unlock() }
-
-        guard !didResume else { return }
-        didResume = true
-        continuation.resume(returning: result)
-    }
 }
```

**File**: `Loop/Settings Window/SettingsWindowManager.swift` (modified, +1/-1)
```diff
@@ -95,7 +95,7 @@ final class SettingsWindowManager: ObservableObject {
         }
 
         NSApp.setActivationPolicy(.regular)
-        
+
         if showInspector {
             startTimer()
         }
```

**File**: `Loop/Stashing/StashManager.swift` (modified, +26/-22)
```diff
@@ -90,11 +90,11 @@ final class StashManager {
     }
 
     /// Cancels all monitoring and restores every stashed window to its initial frame.
-    func shutdown() async {
+    func shutdown() {
         mouseMovedTask?.cancel()
         mouseMovedTask = nil
         stopListeningToRevealTriggers()
-        await restoreAllStashedWindows(animate: false)
+        restoreAllStashedWindows()
     }
 
     func onConfigurationChanged() async {
@@ -242,33 +242,44 @@ extension StashManager {
         log.info("unstash \(window.window.description)")
 
         if resetFrame {
-            let action = WindowAction(.initialFrame)
-            let initialFrame = await WindowFrameResolver.getFrame(
-                for: action,
-                window: window.window,
-                bounds: window.screen.cgSafeScreenFrame
-            )
-
             if resetFrameAnimated {
                 try? await window.window.setFrameAnimated(
-                    initialFrame,
+                    window.restoreFrame,
                     bounds: .zero
                 )
             } else {
-                await window.window.setFrame(initialFrame)
+                await window.window.setFrame(window.restoreFrame)
             }
         }
 
         unmanage(windowID: window.window.cgWindowID)
     }
 
-    func restoreAllStashedWindows(animate: Bool) async {
+    func restoreAllStashedWindows() {
         let stashedWindowIDs = Array(store.stashed.keys)
 
         for stashedWindowID in stashedWindowIDs {
-            await unstash(stashedWindowID, resetFrame: true, resetFrameAnimated: animate)
+            unstashSynchronously(stashedWindowID, resetFrame: true)
+        }
+    }
+
+    private func unstashSynchronously(_ windowID: CGWindowID, resetFrame: Bool) {
+        if let windowToUnstash = store.stashed[windowID] {
+            unstashSynchronously(windowToUnstash, resetFrame: resetFrame)
+        } else {
+            unmanage(windowID: windowID)
         }
     }
+
+    private func unstashSynchronously(_ window: StashedWindowInfo, resetFrame: Bool) {
+        log.info("unstash \(window.window.description)")
+
+        if resetFrame {
+            window.window.setFrameSynchronously(window.restoreFrame)
+        }
+
+        unmanage(windowID: window.window.cgWindowID)
+    }
 }
 
 // MARK: - Reveal and Hide
@@ -452,17 +463,10 @@ private extension StashManager {
         frontmostAppMonitor?.cancel()
         frontmostAppMonitor = nil
 
-        // Stop and release the monitor
-        // The monitor's deinit will handle cleanup of the event tap
-        mouseMonitor?.stop()
-
-        // Delay the release to allow the run loop to process the stop
         let monitor = mouseMonitor
         mouseMonitor = nil
-
-        DispatchQueue.main.async {
-            _ = monitor // Keep alive until run loop processes the removal
-        }
+        monitor?.stop()
+        withExtendedLifetime(monitor) {}
     }
 
     /// Handles mouse movement events with a debounce to avoid excessive processing.
```

**File**: `Loop/Stashing/StashedWindowInfo.swift` (modified, +4/-0)
```diff
@@ -14,19 +14,22 @@ struct StashedWindowInfo: Equatable {
     let window: Window
     let screen: NSScreen
     let action: WindowAction
+    let restoreFrame: CGRect
     let revealedFrame: CGRect
     let stashedFrame: CGRect
 
     // MARK: - Frame computation
 
     static func create(window: Window, screen: NSScreen, action: WindowAction, peekSize: CGFloat) async -> StashedWindowInfo {
+        let restoreFrame = await WindowRecords.shared.getInitialFrame(for: window) ?? window.frame
         let revealedFrame = await WindowFrameResolver.getRevealedFrame(for: action, window: window, screen: screen)
         let stashedFrame = await WindowFrameResolver.getStashedFrame(for: action, window: window, screen: screen, peekSize: peekSize)
 
         return StashedWindowInfo(
             window: window,
             screen: screen,
             action: action,
+            restoreFrame: restoreFrame,
             revealedFrame: revealedFrame,
             stashedFrame: stashedFrame
         )
@@ -39,6 +42,7 @@ struct StashedWindowInfo: Equatable {
             window: window,
             screen: screen,
             action: action,
+            restoreFrame: restoreFrame,
             revealedFrame: revealedFrame,
             stashedFrame: stashedFrame
         )
```

**File**: `Loop/Window Management/Window Action/WindowAction.swift` (modified, +2/-2)
```diff
@@ -116,9 +116,9 @@ struct WindowAction: Codable, Identifiable, Hashable, Equatable, Defaults.Serial
 
     var iconResolvedAction: WindowAction {
         if direction == .cycle, let first = cycle?.first {
-            return first
+            first
         } else {
-            return self
+            self
         }
     }
 
```

**File**: `Loop/Window Management/Window/Window.swift` (modified, +70/-3)
```diff
@@ -371,7 +371,7 @@ final class Window {
     func setPosition(_ point: CGPoint) {
         if isOwnWindow {
             Task { @MainActor in
-                guard let win = NSApp.keyWindow else { return }
+                guard let win = ownNSWindow() else { return }
                 win.setFrameOrigin(CGRect(origin: point, size: win.frame.size).flipY(screen: .screens[0]).origin)
             }
         } else {
@@ -398,7 +398,7 @@ final class Window {
     func setSize(_ size: CGSize) {
         if isOwnWindow {
             Task { @MainActor in
-                guard let win = NSApp.keyWindow else { return }
+                guard let win = ownNSWindow() else { return }
                 win.setFrame(CGRect(origin: win.frame.origin, size: size), display: false)
             }
         } else {
@@ -432,7 +432,7 @@ final class Window {
         guard isOwnWindow else {
             return false
         }
-        guard let window = NSApp.keyWindow else {
+        guard let window = ownNSWindow() else {
             log.info("Failed to get own main window to resize")
             return true
         }
@@ -443,6 +443,40 @@ final class Window {
         return true
     }
 
+    @MainActor
+    private func ownNSWindow() -> NSWindow? {
+        NSApp.windows.first { CGWindowID($0.windowNumber) == cgWindowID } ?? NSApp.keyWindow ?? NSApp.mainWindow
+    }
+
+    @discardableResult
+    private func applyOwnWindowFrameSynchronously(_ rect: CGRect) -> Bool {
+        guard isOwnWindow else {
+            return false
+        }
+
+        if Thread.isMainThread {
+            MainActor.assumeIsolated {
+                guard let window = ownNSWindow() else {
+                    log.info("Failed to get own main window to resize")
+                    return
+                }
+                window.setFrame(rect.flipY(screen: .screens[0]), display: false)
+            }
+        } else {
+            DispatchQueue.main.sync {
+                MainActor.assumeIsolated {
+                    guard let window = ownNSWindow() else {
+                        log.info("Failed to get own main window to resize")
+                        return
+                    }
+                    window.setFrame(rect.flipY(screen: .screens[0]), display: false)
+                }
+            }
+        }
+
+        return true
+    }
+
     func setFrame(
         _ rect: CGRect,
         sizeFirst: Bool = false,
@@ -476,6 +510,39 @@ final class Window {
         }
     }
 
+    func setFrameSynchronously(
+        _ rect: CGRect,
+        sizeFirst: Bool = false,
+        resolvedProperties: ResolvedProperties? = nil
+    ) {
+        guard !applyOwnWindowFrameSynchronously(rect) else {
+            return
+        }
+
+        let enhancedUI = resolvedProperties?.isEnhancedUserInterface ?? enhancedUserInterface
+        let shouldSetSize = resolvedProperties?.isResizable ?? true
+
+        if enhancedUI {
+            let appName = nsRunningApplication?.localizedName
+            log.info("\(appName ?? "This app")'s enhanced UI will be temporarily disabled while resizing.")
+            enhancedUserInterface = false
+        }
+
+        if sizeFirst, shouldSetSize {
+            setSize(rect.size)
+        }
+
+        setPosition(rect.origin)
+
+        if shouldSetSize {
+            setSize(rect.size)
+        }
+
+        if enhancedUI {
+            enhancedUserInterface = true
+        }
+    }
+
     @MainActor
     func setFrameAnimated(
         _ rect: CGRect,
```

---

### Incident Patch 13: `9ad1b7d3` (2026-05-11)
**Commit Message**: 🐞 Fix settings inspector timer delays

**File**: `Loop/Settings Window/SettingsContentView.swift` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ struct SettingsContentView: View {
                 LuminareSidebarSection("Settings", selection: $model.currentTab, items: SettingsTab.settingsTabs)
                 LuminareSidebarSection("\(Bundle.main.appName)", selection: $model.currentTab, items: SettingsTab.loopTabs)
             }
-            .frame(width: 240)
+            .frame(width: 230)
             .padding(.top, titleBarHeight)
             .luminareBackground()
 
```

**File**: `Loop/Settings Window/SettingsWindowManager.swift` (modified, +9/-3)
```diff
@@ -95,6 +95,10 @@ final class SettingsWindowManager: ObservableObject {
         }
 
         NSApp.setActivationPolicy(.regular)
+        
+        if showInspector {
+            startTimer()
+        }
 
         controller?.showWindow(self)
         window?.orderFrontRegardless()
@@ -127,13 +131,15 @@ final class SettingsWindowManager: ObservableObject {
         guard showInspector else { return }
 
         stopTimer()
-        startTimer()
+        startTimer(immediatelySelectNext: true)
     }
 
-    private func startTimer() {
+    private func startTimer(immediatelySelectNext: Bool = false) {
         previewActionTimerTask?.cancel()
         previewActionTimerTask = Task(priority: .utility) {
-            try await Task.sleep(for: .seconds(1))
+            if !immediatelySelectNext {
+                try await Task.sleep(for: .seconds(1))
+            }
 
             while !Task.isCancelled {
                 if NSApp.isActive {
```

---

### Incident Patch 14: `dc143521` (2026-05-11)
**Commit Message**: ✨ Defer slider commits to prevent UI lag

**File**: `Loop/Settings Window/Settings/Behavior/Padding Configuration/PaddingConfigurationView.swift` (modified, +32/-7)
```diff
@@ -14,6 +14,7 @@ struct PaddingConfigurationView: View {
     @Default(.enablePadding) private var enablePadding
 
     @State var paddingModel = Defaults[.padding]
+    @State private var isDeferringDefaultsCommit = false
     @Binding var isPresented: Bool
 
     let range: ClosedRange<Double> = 0...100
@@ -57,6 +58,7 @@ struct PaddingConfigurationView: View {
         }
         .padding(16)
         .onChange(of: paddingModel) { _ in
+            guard !isDeferringDefaultsCommit else { return }
             // This fixes some weird animations.
             Defaults[.padding] = paddingModel
         }
@@ -125,7 +127,9 @@ struct PaddingConfigurationView: View {
             in: range,
             format: .number.precision(.fractionLength(0...1)),
             clampsUpper: false,
-            suffix: Text("px", comment: "Unit symbol: pixels")
+            suffix: Text("px", comment: "Unit symbol: pixels"),
+            onEditingChanged: handleSliderEditingChanged,
+            onEditingCommit: commitSliderChanges
         )
     }
 
@@ -137,7 +141,9 @@ struct PaddingConfigurationView: View {
                 in: range,
                 format: .number.precision(.fractionLength(0...1)),
                 clampsUpper: false,
-                suffix: Text("px", comment: "Unit symbol: pixels")
+                suffix: Text("px", comment: "Unit symbol: pixels"),
+                onEditingChanged: handleSliderEditingChanged,
+                onEditingCommit: commitSliderChanges
             )
             .luminareSliderLayout(.compact(textBoxWidth: 76))
 
@@ -147,7 +153,9 @@ struct PaddingConfigurationView: View {
                 in: range,
                 format: .number.precision(.fractionLength(0...1)),
                 clampsUpper: false,
-                suffix: Text("px", comment: "Unit symbol: pixels")
+                suffix: Text("px", comment: "Unit symbol: pixels"),
+                onEditingChanged: handleSliderEditingChanged,
+                onEditingCommit: commitSliderChanges
             )
             .luminareSliderLayout(.compact(textBoxWidth: 76))
 
@@ -157,7 +165,9 @@ struct PaddingConfigurationView: View {
                 in: range,
                 format: .number.precision(.fractionLength(0...1)),
                 clampsUpper: false,
-                suffix: Text("px", comment: "Unit symbol: pixels")
+                suffix: Text("px", comment: "Unit symbol: pixels"),
+                onEditingChanged: handleSliderEditingChanged,
+                onEditingCommit: commitSliderChanges
             )
             .luminareSliderLayout(.compact(textBoxWidth: 76))
 
@@ -167,7 +177,9 @@ struct PaddingConfigurationView: View {
                 in: range,
                 format: .number.precision(.fractionLength(0...1)),
                 clampsUpper: false,
-                suffix: Text("px", comment: "Unit symbol: pixels")
+                suffix: Text("px", comment: "Unit symbol: pixels"),
+                onEditingChanged: handleSliderEditingChanged,
+                onEditingCommit: commitSliderChanges
             )
             .luminareSliderLayout(.compact(textBoxWidth: 76))
         }
@@ -181,15 +193,19 @@ struct PaddingConfigurationView: View {
                 in: range,
                 format: .number.precision(.fractionLength(0...1)),
                 clampsUpper: false,
-                suffix: Text("px", comment: "Unit symbol: pixels")
+                suffix: Text("px", comment: "Unit symbol: pixels"),
+                onEditingChanged: handleSliderEditingChanged,
+                onEditingCommit: commitSliderChanges
             )
             .luminareSliderLayout(.compact(textBoxWidth: 76))
 
             LuminareSlider(
                 value: $paddingModel.externalBar.doubleBinding,
                 in: range,
                 format: .number.precision(.fractionLength(0...1)),
-                suffix: Text("px", comment: "Unit symbol: pixels")
+                suffix: Text("px", comment: "Unit symbol: pixels"),
+                onEditingChanged: handleSliderEditingChanged,
+                onEditingCommit: commitSliderChanges
             ) {
                 Text("External bar", comment: "Label for a slider in Loop’s padding settings")
                     .padding(.trailing, 4)
@@ -201,4 +217,13 @@ struct PaddingConfigurationView: View {
             .luminareSliderLayout(.compact(textBoxWidth: 76))
         }
     }
+
+    private func handleSliderEditingChanged(_ isEditing: Bool) {
+        isDeferringDefaultsCommit = isEditing
+    }
+
+    private func commitSliderChanges() {
+        isDeferringDefaultsCommit = false
+        Defaults[.padding] = paddingModel
+    }
 }
```

**File**: `Loop/Settings Window/Settings/Keybinds/Modal Views/CustomActionConfigurationView.swift` (modified, +26/-5)
```diff
@@ -17,6 +17,7 @@ struct CustomActionConfigurationView: View {
 
     @State private var action: WindowAction
     @State private var currentTab: Tab = .position
+    @State private var isDeferringExternalCommit = false
 
     private enum Tab: LocalizedStringKey, CaseIterable {
         case position = "Position", size = "Size"
@@ -57,12 +58,15 @@ struct CustomActionConfigurationView: View {
             ScreenView(isBlurred: action.sizeMode != .custom) {
                 ActionPreview(action: action)
             }
-            .onChange(of: action) { windowAction = $0 }
 
             configurationSections()
             actionButtons()
         }
         .padding(16)
+        .onChange(of: action) { newValue in
+            guard !isDeferringExternalCommit else { return }
+            windowAction = newValue
+        }
     }
 
     @ViewBuilder
@@ -256,7 +260,9 @@ struct CustomActionConfigurationView: View {
                     in: actionUnit == .percentage ? 0...100 : 0...Double(screenSize.width),
                     format: .number.precision(actionUnit.fractionLength),
                     clampsUpper: false,
-                    suffix: Text(action.unit?.suffix ?? CustomWindowActionUnit.percentage.suffix)
+                    suffix: Text(action.unit?.suffix ?? CustomWindowActionUnit.percentage.suffix),
+                    onEditingChanged: handleSliderEditingChanged,
+                    onEditingCommit: commitSliderChanges
                 )
 
                 LuminareSlider(
@@ -272,7 +278,9 @@ struct CustomActionConfigurationView: View {
                     in: actionUnit == .percentage ? 0...100 : 0...Double(screenSize.height),
                     format: .number.precision(actionUnit.fractionLength),
                     clampsUpper: false,
-                    suffix: Text(action.unit?.suffix ?? CustomWindowActionUnit.percentage.suffix)
+                    suffix: Text(action.unit?.suffix ?? CustomWindowActionUnit.percentage.suffix),
+                    onEditingChanged: handleSliderEditingChanged,
+                    onEditingCommit: commitSliderChanges
                 )
             }
         }
@@ -321,7 +329,9 @@ struct CustomActionConfigurationView: View {
                     in: actionUnit == .percentage ? 0...100 : 0...Double(screenSize.width),
                     format: .number.precision(actionUnit.fractionLength),
                     clampsUpper: false,
-                    suffix: .init(action.unit?.suffix ?? CustomWindowActionUnit.percentage.suffix)
+                    suffix: .init(action.unit?.suffix ?? CustomWindowActionUnit.percentage.suffix),
+                    onEditingChanged: handleSliderEditingChanged,
+                    onEditingCommit: commitSliderChanges
                 )
 
                 LuminareSlider(
@@ -337,9 +347,20 @@ struct CustomActionConfigurationView: View {
                     in: actionUnit == .percentage ? 0...100 : 0...Double(screenSize.height),
                     format: .number.precision(actionUnit.fractionLength),
                     clampsUpper: false,
-                    suffix: .init(action.unit?.suffix ?? CustomWindowActionUnit.percentage.suffix)
+                    suffix: .init(action.unit?.suffix ?? CustomWindowActionUnit.percentage.suffix),
+                    onEditingChanged: handleSliderEditingChanged,
+                    onEditingCommit: commitSliderChanges
                 )
             }
         }
     }
+
+    private func handleSliderEditingChanged(_ isEditing: Bool) {
+        isDeferringExternalCommit = isEditing
+    }
+
+    private func commitSliderChanges() {
+        isDeferringExternalCommit = false
+        windowAction = action
+    }
 }
```

**File**: `Loop/Settings Window/Settings/Keybinds/Modal Views/StashActionConfigurationView.swift` (modified, +26/-5)
```diff
@@ -18,6 +18,7 @@ struct StashActionConfigurationView: View {
 
     @State private var action: WindowAction
     @State private var currentTab: Tab = .position
+    @State private var isDeferringExternalCommit = false
 
     private enum Tab: LocalizedStringKey, CaseIterable {
         case position = "Position", size = "Unstashed Size"
@@ -62,12 +63,15 @@ struct StashActionConfigurationView: View {
             ScreenView(isBlurred: action.sizeMode != .custom) {
                 ActionPreview(action: action)
             }
-            .onChange(of: action) { windowAction = $0 }
 
             configurationSections()
             actionButtons()
         }
         .padding(16)
+        .onChange(of: action) { newValue in
+            guard !isDeferringExternalCommit else { return }
+            windowAction = newValue
+        }
     }
 
     @ViewBuilder
@@ -199,7 +203,9 @@ struct StashActionConfigurationView: View {
                     in: actionUnit == .percentage ? 0...100 : 0...Double(screenSize.width),
                     format: .number.precision(actionUnit.fractionLength),
                     clampsUpper: false,
-                    suffix: Text(action.unit?.suffix ?? CustomWindowActionUnit.percentage.suffix)
+                    suffix: Text(action.unit?.suffix ?? CustomWindowActionUnit.percentage.suffix),
+                    onEditingChanged: handleSliderEditingChanged,
+                    onEditingCommit: commitSliderChanges
                 )
 
                 LuminareSlider(
@@ -215,7 +221,9 @@ struct StashActionConfigurationView: View {
                     in: actionUnit == .percentage ? 0...100 : 0...Double(screenSize.height),
                     format: .number.precision(actionUnit.fractionLength),
                     clampsUpper: false,
-                    suffix: Text(action.unit?.suffix ?? CustomWindowActionUnit.percentage.suffix)
+                    suffix: Text(action.unit?.suffix ?? CustomWindowActionUnit.percentage.suffix),
+                    onEditingChanged: handleSliderEditingChanged,
+                    onEditingCommit: commitSliderChanges
                 )
             }
         }
@@ -264,7 +272,9 @@ struct StashActionConfigurationView: View {
                     in: actionUnit == .percentage ? 0...100 : 0...Double(screenSize.width),
                     format: .number.precision(actionUnit.fractionLength),
                     clampsUpper: false,
-                    suffix: .init(action.unit?.suffix ?? CustomWindowActionUnit.percentage.suffix)
+                    suffix: .init(action.unit?.suffix ?? CustomWindowActionUnit.percentage.suffix),
+                    onEditingChanged: handleSliderEditingChanged,
+                    onEditingCommit: commitSliderChanges
                 )
 
                 LuminareSlider(
@@ -280,9 +290,20 @@ struct StashActionConfigurationView: View {
                     in: actionUnit == .percentage ? 0...100 : 0...Double(screenSize.height),
                     format: .number.precision(actionUnit.fractionLength),
                     clampsUpper: false,
-                    suffix: .init(action.unit?.suffix ?? CustomWindowActionUnit.percentage.suffix)
+                    suffix: .init(action.unit?.suffix ?? CustomWindowActionUnit.percentage.suffix),
+                    onEditingChanged: handleSliderEditingChanged,
+                    onEditingCommit: commitSliderChanges
                 )
             }
         }
     }
+
+    private func handleSliderEditingChanged(_ isEditing: Bool) {
+        isDeferringExternalCommit = isEditing
+    }
+
+    private func commitSliderChanges() {
+        isDeferringExternalCommit = false
+        windowAction = action
+    }
 }
```

---

### Incident Patch 15: `61326788` (2026-05-11)
**Commit Message**: 🐞 Fix Safari AutoFill OTP window briefly showing up on macOS 26+

https://developer.apple.com/documentation/bundleresources/information-property-list/nsautofillrequirestextcontenttypeforonetimecodeonmac

**File**: `Loop/Info.plist` (modified, +2/-0)
```diff
@@ -13,6 +13,8 @@
 			</array>
 		</dict>
 	</array>
+	<key>NSAutoFillRequiresTextContentTypeForOneTimeCodeOnMac</key>
+	<true/>
 	<key>NSDockTilePlugIn</key>
 	<string>LoopDockTile.plugin</string>
 </dict>
```

**File**: `Loop/Settings Window/Settings/Keybinds/DirectionPickerView.swift` (modified, +9/-3)
```diff
@@ -10,6 +10,7 @@ import SwiftUI
 struct DirectionPickerView: View {
     @State private var searchText = ""
     @State private var searchResults: [WindowDirection] = []
+    @FocusState private var isSearchFocused: Bool
 
     @Binding private var direction: WindowDirection
     private let isInCycle: Bool
@@ -40,10 +41,12 @@ struct DirectionPickerView: View {
 
     var body: some View {
         VStack(spacing: 0) {
-            CustomTextField(
-                $searchText,
-                placeholder: .init(localized: "Search for a window action", defaultValue: "Search…")
+            TextField(
+                String(localized: "Search for a window action", defaultValue: "Search…"),
+                text: $searchText
             )
+            .textFieldStyle(.plain)
+            .focused($isSearchFocused)
             .padding(12)
 
             Divider()
@@ -71,6 +74,9 @@ struct DirectionPickerView: View {
         .onAppear {
             searchText = ""
             computeSearchResults()
+            Task { @MainActor in
+                isSearchFocused = true
+            }
         }
         .onDisappear {
             searchText = ""
```

**File**: `Loop/Settings Window/Settings/Keybinds/KeybindItemView.swift` (modified, +18/-20)
```diff
@@ -122,27 +122,25 @@ struct KeybindItemView: View {
             .foregroundStyle(isHovering ? .primary : .secondary)
         }
         .background(alignment: .leading) {
-            if isDirectionPickerPresented || isHovering {
-                Color.clear
-                    .frame(width: 300 - 24)
-                    .luminarePopover(
-                        isPresented: $isDirectionPickerPresented,
-                        arrowEdge: .top,
-                        shouldHideAnchor: true,
-                        shouldAnimate: false
-                    ) {
-                        DirectionPickerView(
-                            direction: $action.direction,
-                            isInCycle: cycleIndex != nil
-                        )
-                        .frame(width: 300, height: 300)
-                    }
-                    .onChange(of: isDirectionPickerPresented) { _ in
-                        if !isDirectionPickerPresented {
-                            PickerListEventMonitorManager.shared.removeAllMonitors()
-                        }
+            Color.clear
+                .frame(width: 300 - 24)
+                .luminarePopover(
+                    isPresented: $isDirectionPickerPresented,
+                    arrowEdge: .top,
+                    shouldHideAnchor: true,
+                    shouldAnimate: false
+                ) {
+                    DirectionPickerView(
+                        direction: $action.direction,
+                        isInCycle: cycleIndex != nil
+                    )
+                    .frame(width: 300, height: 300)
+                }
+                .onChange(of: isDirectionPickerPresented) { _ in
+                    if !isDirectionPickerPresented {
+                        PickerListEventMonitorManager.shared.removeAllMonitors()
                     }
-            }
+                }
         }
     }
 
```

**File**: `Loop/Settings Window/Theming/Radial Menu/RadialMenuActionItemView.swift` (modified, +15/-17)
```diff
@@ -86,24 +86,22 @@ struct RadialMenuActionItemView: View {
     private var label: some View {
         actionIndicator
             .background(alignment: .leading) {
-                if isHovering || isPickerPresented {
-                    Color.clear
-                        .frame(width: 300 - 24)
-                        .luminarePopover(
-                            isPresented: $isPickerPresented,
-                            arrowEdge: .top,
-                            shouldHideAnchor: true,
-                            shouldAnimate: false
-                        ) {
-                            RadialMenuActionPickerView(selection: $action.type)
-                                .frame(width: 300, height: 300)
-                        }
-                        .onChange(of: isPickerPresented) { _ in
-                            if !isPickerPresented {
-                                PickerListEventMonitorManager.shared.removeAllMonitors()
-                            }
+                Color.clear
+                    .frame(width: 300 - 24)
+                    .luminarePopover(
+                        isPresented: $isPickerPresented,
+                        arrowEdge: .top,
+                        shouldHideAnchor: true,
+                        shouldAnimate: false
+                    ) {
+                        RadialMenuActionPickerView(selection: $action.type)
+                            .frame(width: 300, height: 300)
+                    }
+                    .onChange(of: isPickerPresented) { _ in
+                        if !isPickerPresented {
+                            PickerListEventMonitorManager.shared.removeAllMonitors()
                         }
-                }
+                    }
             }
     }
 
```

**File**: `Loop/Settings Window/Theming/Radial Menu/RadialMenuActionPickerView.swift` (modified, +9/-3)
```diff
@@ -13,6 +13,7 @@ struct RadialMenuActionPickerView: View {
 
     @State private var searchText = ""
     @State private var searchResults: [RadialMenuAction.ActionType] = []
+    @FocusState private var isSearchFocused: Bool
 
     @Binding private var selection: RadialMenuAction.ActionType
 
@@ -56,10 +57,12 @@ struct RadialMenuActionPickerView: View {
 
     var body: some View {
         VStack(spacing: 0) {
-            CustomTextField(
-                $searchText,
-                placeholder: .init(localized: "Search for a window action", defaultValue: "Search…")
+            TextField(
+                String(localized: "Search for a window action", defaultValue: "Search…"),
+                text: $searchText
             )
+            .textFieldStyle(.plain)
+            .focused($isSearchFocused)
             .padding(12)
 
             Divider()
@@ -102,6 +105,9 @@ struct RadialMenuActionPickerView: View {
         .onAppear {
             searchText = ""
             computeSearchResults()
+            Task { @MainActor in
+                isSearchFocused = true
+            }
         }
         .onDisappear {
             searchText = ""
```

**File**: `Loop/Utilities/CustomTextField.swift` (removed, +0/-59)
```diff
@@ -1,59 +0,0 @@
-//
-//  CustomTextField.swift
-//  Loop
-//
-//  Created by Kai Azim on 2024-08-26.
-//
-
-import SwiftUI
-
-/// Custom TextField that will allow for auto-focus to happen correctly when the popover is shown.
-struct CustomTextField: NSViewRepresentable {
-    @Binding var text: String
-    let placeholder: String
-
-    init(_ text: Binding<String>, placeholder: String) {
-        self._text = text
-        self.placeholder = placeholder
-    }
-
-    func makeNSView(context: Context) -> NSTextField {
-        let textField = NSTextField()
-        textField.isBezeled = false
-        textField.placeholderString = placeholder
-        textField.isEditable = true
-        textField.isSelectable = true
-        textField.drawsBackground = false
-        textField.isBordered = false
-        textField.translatesAutoresizingMaskIntoConstraints = false
-        textField.focusRingType = .none
-
-        // Set the target-action for text changes
-        textField.delegate = context.coordinator
-
-        return textField
-    }
-
-    func updateNSView(_ nsView: NSTextField, context _: Context) {
-        nsView.stringValue = text
-    }
-
-    func makeCoordinator() -> Coordinator {
-        Coordinator(self)
-    }
-
-    final class Coordinator: NSObject, NSTextFieldDelegate {
-        var parent: CustomTextField
-
-        init(_ parent: CustomTextField) {
-            self.parent = parent
-        }
-
-        func controlTextDidChange(_ obj: Notification) {
-            if let textField = obj.object as? NSTextField {
-                // Update the binding when the text changes
-                parent.text = textField.stringValue
-            }
-        }
-    }
-}
```

#### Recent Merged Pull Requests:
- **PR #1167** (2026-10-05): 💄 Simplify settings and wording (@mrkai77)
- **PR #1166** (2026-10-03): 🐞 Fix updater crash when updating download progress off the main thread (@mrkai77)
- **PR #1165** (2026-09-30): 🐞 Gesture reliability fixes (@mrkai77)
- **PR #1163** (2026-09-30): 💄 Remove Tahoe shine from sidebar icons (@mrkai77)
- **PR #1162** (2026-09-30): 🐞 Stop Loop from leaving Dock swipes unfinished (@mrkai77)
- **PR #1161** (2026-09-29): 🌐 Update translations from Crowdin (@github-actions[bot])
- **PR #1160** (2026-09-29): 🐞 Fix wallpaper capture on macOS 27 (@Noah-Johann)
- **PR #1157** (closed): Personal defaults (@itsNotMyUsername)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
