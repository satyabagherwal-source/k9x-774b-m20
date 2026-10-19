> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/mrkai77-loop-learnings.md`  
> **Source**: github ([https://github.com/mrkai77/Loop](https://github.com/mrkai77/Loop))  
> **Source Version**: `573ace30`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T10:41:16.709Z  
> **Learning ID**: `learn-github-mrkai77-loop`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): mrkai77/Loop

> **Canonical Artifact**: `07_PROJECT_LEARNING/mrkai77-loop-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/mrkai77/Loop](https://github.com/mrkai77/Loop))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T10:41:16.701Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `mrkai77/Loop`
- **Description**: Window management made elegant.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 11810 stars

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1178** (2026-10-12): **🐞 Persistent crash when updating from development version 1.4.3 (1766) to 1.4.3 (1779)**
  *Symptoms*: ### Bug Description  Hi there, thanks for making this great application open source!  I've tried multiple times to update from development versions 1766 to 1779 with the same crash each time.   I was having a similar issue to issue #1164 previous to this, so in addition to capturing a macOS system crash report, I also captured output from the command you suggested in that issue: `log stream --level debug --style compact --predicate 'subsystem == "com.MrKai77.Loop" OR (process == "Loop" AND eventMessage CONTAINS[c] "quit")'`:  <details><summary>Command output:</summary> <p>  ``` BlackBook:~ $ log stream --level debug --style compact --predicate 'subsystem == "com.MrKai77.Loop" OR (process == "Loop" AND eventMessage CONTAINS[c] "quit")' Filtering the log data using "subsystem == "com.MrKai77.Loop" OR (process == "Loop" AND composedMessage CONTAINS[c] "quit")" Timestamp               Ty Process[PID:TID] 2026-10-12 09:20:11.669 F  Loop[49180:3b26fd] [com.apple.kvs:Connection] BUG IN CLIENT OF KVS: Trying to initialize NSUbiquitousKeyValueStore without a store identifier. Please specify your store identifier in the 'com.apple.developer.ubiquity-kvstore-identifier' entitlement. 2026-10-12 09:20:11.687 I  Loop[49180:3b270e] [com.MrKai77.Loop:DefaultsiCloudSyncRegistrar] 2026-10-12 09:20:11.687-0500 ℹ️ [DefaultsiCloudSyncRegistrar] iCloud sync enabled 2026-10-12 09:20:11.789 Db Loop[49180:3b270e] [com.MrKai77.Loop:IconManager] 2026-10-12 09:20:11.790-0500 🔍 [IconManager] Deleted doc

- **Issue #1176** (2026-10-13): **🐞 Stop trackpad gestures from scrolling the page behind them**
  *Symptoms*: With the native macOS gestures turned off, 3 and 4-finger Loop gestures would also scroll the page underneath, keep scrolling after lifting your fingers, and even trigger back/forward in browsers. This is because macOS turns unassigned 3 and 4-finger swipes into scrolls, and the gesture blocker only kicked in once Loop had _recognized_ the gesture. By then, the page had already started scrolling, and the momentum carried on after the lift. This PR:  1. Holds scrolls that _could_ belong to a Loop gesture from `began` while Loop decides on the stroke. If Loop takes it, the scroll is dropped. Otherwise, the held events are replayed in order through the tap proxy, 1. Lets swipes in unbound directions pass straight through, so they still scroll with no delay, 1. Decides momentum once, when it begins, so a stroke Loop took no longer flings the page after you lift your fingers, 1. Holds and replays navigation swipes (`kIOHIDEventTypeNavigationSwipe`, aka what browsers use for back/forward) the same way as scrolls, 1. Blocks rotation, zoom and smart zoom while a Loop gesture is active. Touch frames, force clicks and gesture brackets still pass, so apps don't get stuck mid-gesture, 1. Adds `scrollOwner(heldFor:direction:)` to `SystemGestureFilter` so the blocker can tell whether Loop owns the current touch. Loop keeps ownership until every finger lifts, since they rarely leave at the same time. 

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

### Incident Patch 2: `a1e33281` (2026-08-31)
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

### Incident Patch 3: `2467291f` (2026-08-07)
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

#### Recent Merged Pull Requests:
- **PR #1181** (closed): apply Maximize after a cross-display move (@mvanhorn)
- **PR #1180** (closed): ✨ Add per-app default window presets (@Mars-den)
- **PR #1176** (2026-10-13): 🐞 Stop trackpad gestures from scrolling the page behind them (@mrkai77)
- **PR #1175** (2026-10-09): 🐞 Use the system setting to prevent Mission Control on macOS 15+ (@mrkai77)
- **PR #1174** (2026-10-09): 🐞 Ignore windows at or above the menu bar's window level (@mrkai77)
- **PR #1173** (2026-10-09): 🌐 Update translations from Crowdin (@github-actions[bot])

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

## X. 🐞 Fix updater crash when updating download progress off the main thread (#1166)

**RULE**:
When implementing operations in `Loop/Updater/UpdateDownloader.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in mrkai77/Loop. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `7ce662a5`: 🐞 Fix updater crash when updating download progress off the main thread (#1166). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `Loop/Updater/UpdateDownloader.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
    private var progressClosure: (@MainActor (UpdateProgress) -> ())?
        progress: @escaping @MainActor (UpdateProgress) -> ()
        progress: @escaping @MainActor (UpdateProgress) -> (),
        Task { @MainActor in
            self.progressClosure?(progress)
```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern to NEVER write (induced failure mode):
    private var progressClosure: ((UpdateProgress) async -> ())?
        progress: @escaping (UpdateProgress) async -> ()
        progress: @escaping (UpdateProgress) async -> (),
        Task {
            await self.progressClosure?(progress)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `7ce662a5` are properly handled with clean fallback behavior.
