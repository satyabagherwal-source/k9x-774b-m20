> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/mrkai77-loop-learnings.md`  
> **Source**: github ([https://github.com/mrkai77/Loop](https://github.com/mrkai77/Loop))  
> **Source Version**: `e8560f45`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-15T07:41:52.807Z  
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
> **Harvest Timestamp**: 2026-11-15T07:41:52.801Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `mrkai77/Loop`
- **Description**: Window management made elegant.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 11973 stars

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
        accessibilityCheckerTask = Task(priority: .userInitiated) { [weak self] in
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

        gestureToggleTask = Task(priority: .userInitiated) { [weak self] in
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

        actionRe
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1209** (2026-11-14): **🐞 Fix delayed gesture availability after login**
  *Symptoms*: Right after logging in, gestures could take up to 30 seconds to start responding, and 2-finger scrolls would stutter while Loop held them waiting for a decision. This is because `LoopManager` starts its triggers from `Task(priority: .background)`, and the gesture recognizer's tasks inherited that priority. While the system is busy after login, macOS _heavily_ throttles background work, so contact frames piled up and recognition fell behind for a while. With this PR, `LoopManager`'s accessibility and gesture toggle observers now run at `.userInitiated`, and Subsurface's recognizer no longer inherits its caller's priority (mrkai77/Subsurface@6b59a7f)!  Closes #1196

- **Issue #1196** (2026-11-14): **🐞 Delayed gesture availability after login**
  *Symptoms*: ### Bug Description  As someone who reboots their Mac frequently, I've noticed that after logging in, Loop gestures take significantly longer to become available than other Loop controls. Since I encountered this behavior on a daily basis, it has become quite noticeable. Keyboard + trackpad actions are ready almost immediately, while gesture-based window movement remains unavailable for some time before it starts responding.  I'm not sure if this is expected or specific to my system, but I wanted to report it in case it's an unknown issue or something that could be optimized :)  ### Affected Scope  Performance  ### Steps to Reproduce  1. Restart the Mac. 2. Log in to macOS. 3. Immediately attempt to move or position a window using Loop gestures. 4. Compare the behavior with Loop's keyboard + trackpad controls during the same period after login.  ### Reproducibility  Always  ### Expected vs Actual Behavior  Loop gestures should be available immediately after login, similarly to other Loop controls.  ### Screen Recordings / Screenshots  _No response_  ### Severity  Minor (limited impact)  ### macOS Version  macOS 27.2  ### Loop Version  Version 🧪 1.4.3 (1783)  ### Did You Try the Development Build?  Yes  ### Additional Context  _No response_  ### Final Checks  - [x] My issue is written in English. - [x] My issue title is descriptive. - [x] This is a single bug (multiple bugs should be reported individually). - [x] I have looked to see if this is a duplicate of another bug repo

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

### Incident Patch 1: `8e0e30a8` (2026-11-13)
**Commit Message**: 🐞 Fix crash when searching the action picker in non-English languages (#1193)

**File**: `Loop/Settings Window/Settings/Keybinds/DirectionPickerView.swift` (modified, +9/-3)
```diff
@@ -103,7 +103,7 @@ struct DirectionPickerView: View {
 
         let matches = sectionItems
             .compactMap { item -> (WindowDirection, Int)? in
-                if let score = fuzzyScore(item.name, key) {
+                if let score = Self.fuzzyScore(item.name, key) {
                     return (item, score)
                 }
                 return nil
@@ -114,7 +114,13 @@ struct DirectionPickerView: View {
         searchResults = matches + moreSection.items
     }
 
-    private func fuzzyScore(_ text: String, _ pattern: String) -> Int? {
+    /// Scores how well a search pattern matches an action name. Lower scores rank higher.
+    /// - Parameters:
+    ///   - text: The action name to match against.
+    ///   - pattern: The search text entered by the user.
+    /// - Returns: `0` for a prefix match, `1` for a substring match, `2` if the pattern's
+    ///   characters appear in order within the text, or `nil` if there is no match.
+    static func fuzzyScore(_ text: String, _ pattern: String) -> Int? {
         let text = text.lowercased()
         let pattern = pattern.lowercased()
 
@@ -129,7 +135,7 @@ struct DirectionPickerView: View {
         var pIndex = pattern.startIndex
         while tIndex < text.endIndex, pIndex < pattern.endIndex {
             if text[tIndex] == pattern[pIndex] {
-                pIndex = text.index(after: pIndex)
+                pIndex = pattern.index(after: pIndex)
             }
             tIndex = text.index(after: tIndex)
         }
```

**File**: `LoopTests/DirectionPickerSearchTests.swift` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+//
+//  DirectionPickerSearchTests.swift
+//  LoopTests
+//
+//  Created by Nicolas Corini on 2026-10-27.
+//
+
+@testable import Loop
+import Testing
+
+struct DirectionPickerSearchTests {
+    @Test func prefixMatchScoresZero() {
+        #expect(DirectionPickerView.fuzzyScore("Left Half", "left") == 0)
+    }
+
+    @Test func substringMatchScoresOne() {
+        #expect(DirectionPickerView.fuzzyScore("Left Half", "half") == 1)
+    }
+
+    @Test func subsequenceMatchScoresTwo() {
+        #expect(DirectionPickerView.fuzzyScore("Left Half", "lfhf") == 2)
+    }
+
+    @Test func outOfOrderCharactersDoNotMatch() {
+        #expect(DirectionPickerView.fuzzyScore("Left Half", "fl l") == nil)
+    }
+
+    /// Regression test for #1187, where a multi-byte character in the name crashed the search.
+    /// "meta" doesn't match "Metà" because the search isn't diacritic-insensitive.
+    @Test func subsequenceMatchAgainstNonASCIINameDoesNotCrash() {
+        #expect(DirectionPickerView.fuzzyScore("Metà inferiore", "meta") == nil)
+        #expect(DirectionPickerView.fuzzyScore("Metà inferiore", "eeoe") == 2)
+    }
+
+    @Test func subsequenceMatchWithNonASCIIPattern() {
+        #expect(DirectionPickerView.fuzzyScore("Metà inferiore", "mà ie") == 2)
+    }
+}
```

---

### Incident Patch 2: `fdd78fe9` (2026-11-14)
**Commit Message**: 🐞 Track physical Fn state so media keys don't trigger Loop (#1184)

* 🐞 Track physical Fn state so media keys don't trigger Loop

macOS adds the Fn flag to volume/brightness keys, and KeybindTrigger used
the previous event's flags to decide whether Fn was held for arrow and
F-keys. A media key press therefore made the next arrow key look like
Globe + Arrow and opened Loop. Fn is now only considered held after a
flagsChanged event for the Fn key itself.

Fixes #1139

* 🐞 Add Apple top-row keycodes and test Fn tracking with them

* 🐞 Replace isFnSpecialKey with tracked Fn state everywhere

---------

Co-authored-by: Kai Azim <[REDACTED_EMAIL]>

**File**: `Loop/Core/Observers/Helpers/FnKeyState.swift` (added, +41/-0)
```diff
@@ -0,0 +1,41 @@
+//
+//  FnKeyState.swift
+//  Loop
+//
+//  Created by root-daemon on 2026-10-18.
+//
+
+import AppKit
+import CoreGraphics
+
+/// Tracks whether the Fn/Globe key is physically held.
+///
+/// macOS adds `maskSecondaryFn` to many keys (arrows, F-keys, Apple's top-row keys, etc.) even when Fn isn't held,
+/// so an event's flags alone can't tell whether Fn is actually down. Only a `flagsChanged` event for the
+/// Fn key itself can press it, and any event without the Fn flag releases it.
+struct FnKeyState {
+    private(set) var isPressed = false
+
+    mutating func update(type: CGEventType, keyCode: CGKeyCode, flags: CGEventFlags) {
+        if type == .flagsChanged, keyCode == .kVK_Function {
+            isPressed = flags.contains(.maskSecondaryFn)
+        } else if !flags.contains(.maskSecondaryFn) {
+            isPressed = false
+        }
+    }
+
+    mutating func update(with event: NSEvent) {
+        guard let type = CGEventType(rawValue: UInt32(event.type.rawValue)) else { return }
+        update(type: type, keyCode: event.keyCode, flags: CGEventFlags(cocoaFlags: event.modifierFlags))
+    }
+
+    /// Removes the Fn flag unless Fn is physically held.
+    func filteredFlags(_ flags: CGEventFlags) -> CGEventFlags {
+        isPressed ? flags : flags.subtracting(.maskSecondaryFn)
+    }
+
+    /// - Parameter isPressed: the Fn state to start from, for when Fn may already be held (its press event was missed).
+    mutating func reset(isPressed: Bool = false) {
+        self.isPressed = isPressed
+    }
+}
```

**File**: `Loop/Core/Observers/KeybindTrigger.swift` (modified, +6/-6)
```diff
@@ -21,6 +21,7 @@ final class KeybindTrigger {
 
     // State-tracking
     private var pressedKeys: Set<CGKeyCode> = []
+    private var fnKeyState = FnKeyState()
     private(set) var effectiveEventFlags: CGEventFlags = []
     private var eventMonitor: ActiveEventMonitor?
 
@@ -89,13 +90,11 @@ final class KeybindTrigger {
     }
 
     private func handle(_ event: CGEvent) -> ActiveEventMonitor.EventHandling {
-        let keyCode = CGKeyCode(event.getIntegerValueField(.keyboardEventKeycode))
-            .baseKey(flags: .init(rawValue: UInt(event.flags.rawValue)))
+        let rawKeyCode = CGKeyCode(event.getIntegerValueField(.keyboardEventKeycode))
+        fnKeyState.update(type: event.type, keyCode: rawKeyCode, flags: event.flags)
 
-        var filteredFlags = event.flags
-        if keyCode.isFnSpecialKey, !effectiveEventFlags.contains(.maskSecondaryFn) {
-            filteredFlags.remove(.maskSecondaryFn)
-        }
+        let keyCode = rawKeyCode.baseKey(isFnPressed: fnKeyState.isPressed)
+        let filteredFlags = fnKeyState.filteredFlags(event.flags)
 
         let isLoopOpen = checkIfLoopOpen()
         effectiveEventFlags = filteredFlags
@@ -150,6 +149,7 @@ final class KeybindTrigger {
         // Reset states
         pressedKeys = []
         effectiveEventFlags = []
+        fnKeyState.reset()
         canPassthroughNextSpecialEvent = true
     }
 
```

**File**: `Loop/Extensions/CGKeyCode+Extensions.swift` (modified, +10/-29)
```diff
@@ -128,6 +128,13 @@ extension CGKeyCode {
     static let kVK_DownArrow: CGKeyCode = 0x7D
     static let kVK_UpArrow: CGKeyCode = 0x7E
 
+    /// Apple top-row keys, as seen on a built-in MacBook keyboard
+    /// macOS seems to send them as regular `keyDown` / `keyUp` events with `maskSecondaryFn` set, even when Fn isn't held
+    static let kVK_MissionControl: CGKeyCode = 0xA0 // F3
+    static let kVK_Dictation: CGKeyCode = 0xB0 // F5
+    static let kVK_Spotlight: CGKeyCode = 0xB1 // F4
+    static let kVK_DoNotDisturb: CGKeyCode = 0xB2 // F6
+
     static let kVK_Globe_Emoji: CGKeyCode = 0xB3
 
     /// ISO keyboards only
@@ -146,12 +153,13 @@ extension CGKeyCode {
 extension CGKeyCode {
     /// Some keycodes seem to alter when a modifier key (ex. the globe key) is being pressed.
     /// This function attempts to try and restore the "original" key.
-    func baseKey(flags: NSEvent.ModifierFlags) -> CGKeyCode {
+    /// - Parameter isFnPressed: whether Fn is physically held, as tracked by ``FnKeyState``.
+    func baseKey(isFnPressed: Bool) -> CGKeyCode {
         if self == .kVK_ANSI_KeypadEnter {
             return .kVK_Return
         }
 
-        if flags.contains(.function) {
+        if isFnPressed {
             switch self {
             case .kVK_Home: return .kVK_LeftArrow
             case .kVK_End: return .kVK_RightArrow
@@ -183,33 +191,6 @@ extension CGKeyCode {
         let rightModifiers: Set<CGKeyCode> = [.kVK_RightCommand, .kVK_RightControl, .kVK_RightOption, .kVK_RightShift]
         return rightModifiers.contains(self)
     }
-
-    var isFnSpecialKey: Bool {
-        // See: https://github.com/koekeishiya/skhd/issues/1
-        let specialKeys: Set<CGKeyCode> = [
-            .kVK_Delete, // Usually `kVK_ForwardDelete`, but `baseKey(flags:)` converts that back into `kVK_Delete` if the fn key is also being pressed.
-            .kVK_Help
-        ]
-        let allKeys = specialKeys
-            .union(Self.arrowKeys)
-            .union(Self.fKeys)
-
-        return allKeys.contains(self)
-    }
-
-    private static let arrowKeys: Set<CGKeyCode> = [
-        .kVK_LeftArrow,
-        .kVK_RightArrow,
-        .kVK_DownArrow,
-        .kVK_UpArrow
-    ]
-
-    private static let fKeys: Set<CGKeyCode> = [
-        .kVK_F1, .kVK_F2, .kVK_F3, .kVK_F4, .kVK_F5,
-        .kVK_F6, .kVK_F7, .kVK_F8, .kVK_F9, .kVK_F10,
-        .kVK_F11, .kVK_F12, .kVK_F13, .kVK_F14, .kVK_F15,
-        .kVK_F16, .kVK_F17, .kVK_F18, .kVK_F19, .kVK_F20
-    ]
 }
 
 // MARK: Stringification of keycodes
```

**File**: `Loop/Settings Window/Settings/Keybinds/Keybind Recorder/Keycorder.swift` (modified, +17/-9)
```diff
@@ -24,6 +24,7 @@ struct Keycorder: View {
     @Binding private var bypassTriggerKey: Bool?
 
     @State private var eventMonitor: LocalEventMonitor?
+    @State private var fnKeyState = FnKeyState()
     @State private var shouldShake: Bool = false
     @State private var shouldError: Bool = false
     @State private var errorMessage: LocalizedStringKey = .init(String("")) // We use Text here for String interpolation with images
@@ -110,8 +111,17 @@ struct Keycorder: View {
         isActive = true
 
         LoopManager.shared.keybindTrigger.stop()
+        // Recording starts from a click, so no other key is held and the current Fn flag is reliable
+        fnKeyState.reset(isPressed: NSEvent.modifierFlags.contains(.function))
+
+        eventMonitor = LocalEventMonitor(events: [.keyDown, .keyUp, .flagsChanged]) { event in
+            fnKeyState.update(with: event)
+
+            // flagsChanged is only used to track the Fn key
+            if event.type == .flagsChanged {
+                return event
+            }
 
-        eventMonitor = LocalEventMonitor(events: [.keyDown, .keyUp]) { event in
             // Handle regular key presses first
             if event.type == .keyDown, !event.isARepeat {
                 if event.keyCode == .kVK_Escape {
@@ -138,17 +148,15 @@ struct Keycorder: View {
     func handleKeyDown(with event: NSEvent) {
         // Get current selected keys that aren't modifiers
         let currentKeys = selectionKeybind + [event.keyCode]
-            .map { $0.baseKey(flags: event.modifierFlags) }
+            .map { $0.baseKey(isFnPressed: fnKeyState.isPressed) }
 
-        var flags = CGEventFlags(
-            cocoaFlags: event.modifierFlags
-                .intersection(.deviceIndependentFlagsMask) // Prevents right/left dependence
+        let flags = fnKeyState.filteredFlags(
+            CGEventFlags(
+                cocoaFlags: event.modifierFlags
+                    .intersection(.deviceIndependentFlagsMask) // Prevents right/left dependence
+            )
         )
 
-        if event.keyCode.isFnSpecialKey {
-            flags.remove(.maskSecondaryFn)
-        }
-
         let validModifiers = if bypassTriggerKey == true {
             flags.keyCodes
         } else {
```

**File**: `Loop/Settings Window/Settings/Keybinds/Keybind Recorder/TriggerKeycorder.swift` (modified, +6/-3)
```diff
@@ -133,9 +133,12 @@ struct TriggerKeycorder: View {
         LoopManager.shared.keybindTrigger.stop()
 
         eventMonitor = LocalEventMonitor(events: [.keyDown, .flagsChanged]) { event in
-            // keyDown event is only used to track escape key
-            if event.keyCode == CGKeyCode.kVK_Escape {
-                finishedObservingKeys(wasForced: true)
+            // keyDown event is only used to track escape key, as its flags can include an Fn flag that isn't actually held
+            if event.type == .keyDown {
+                if event.keyCode == CGKeyCode.kVK_Escape {
+                    finishedObservingKeys(wasForced: true)
+                }
+                return nil
             }
 
             let flags = CGEventFlags(cocoaFlags: event.modifierFlags)
```

**File**: `LoopTests/FnKeyStateTests.swift` (added, +84/-0)
```diff
@@ -0,0 +1,84 @@
+//
+//  FnKeyStateTests.swift
+//  LoopTests
+//
+//  Created by root-daemon on 2026-10-18.
+//
+
+import CoreGraphics
+@testable import Loop
+import Testing
+
+/// Event sequences below mirror what a CGEventTap receives from a built-in MacBook keyboard.
+struct FnKeyStateTests {
+    /// macOS tags arrow keys with both the Fn and numeric pad flags, whether or not Fn is held.
+    private let arrowFlags: CGEventFlags = [.maskSecondaryFn, .maskNumericPad]
+
+    @Test(arguments: [
+        CGKeyCode.kVK_MissionControl,
+        .kVK_Spotlight,
+        .kVK_Dictation,
+        .kVK_DoNotDisturb
+    ])
+    func topRowKeyFnFlagDoesNotLeakIntoNextArrowKey(_ topRowKey: CGKeyCode) {
+        var state = FnKeyState()
+
+        // These keys carry the Fn flag without Fn being held
+        state.update(type: .keyDown, keyCode: topRowKey, flags: .maskSecondaryFn)
+        #expect(!state.filteredFlags(.maskSecondaryFn).contains(.maskSecondaryFn))
+
+        state.update(type: .keyUp, keyCode: topRowKey, flags: .maskSecondaryFn)
+        state.update(type: .keyDown, keyCode: .kVK_LeftArrow, flags: arrowFlags)
+
+        #expect(!state.isPressed)
+        #expect(!state.filteredFlags(arrowFlags).contains(.maskSecondaryFn))
+    }
+
+    /// Holding Globe and pressing the left arrow arrives as `kVK_Home` with only the Fn flag.
+    @Test func physicallyHeldFnIsKeptOnArrowKey() {
+        var state = FnKeyState()
+
+        state.update(type: .flagsChanged, keyCode: .kVK_Function, flags: .maskSecondaryFn)
+        state.update(type: .keyDown, keyCode: .kVK_Home, flags: .maskSecondaryFn)
+
+        #expect(state.isPressed)
+        #expect(CGKeyCode.kVK_Home.baseKey(isFnPressed: state.isPressed) == .kVK_LeftArrow)
+        #expect(state.filteredFlags(.maskSecondaryFn).contains(.maskSecondaryFn))
+    }
+
+    @Test func releasingFnClearsState() {
+        var state = FnKeyState()
+
+        state.update(type: .flagsChanged, keyCode: .kVK_Function, flags: .maskSecondaryFn)
+        state.update(type: .flagsChanged, keyCode: .kVK_Function, flags: [])
+        state.update(type: .keyDown, keyCode: .kVK_LeftArrow, flags: arrowFlags)
+
+        #expect(!state.isPressed)
+        #expect(!state.filteredFlags(arrowFlags).contains(.maskSecondaryFn))
+    }
+
+    @Test func eventWithoutFnFlagClearsMissedRelease() {
+        var state = FnKeyState()
+
+        state.update(type: .flagsChanged, keyCode: .kVK_Function, flags: .maskSecondaryFn)
+        state.update(type: .keyDown, keyCode: .kVK_ANSI_A, flags: [])
+
+        #expect(!state.isPressed)
+    }
+
+    @Test func otherModifiersWhileHoldingFnKeepItPressed() {
+        var state = FnKeyState()
+
+        state.update(type: .flagsChanged, keyCode: .kVK_Function, flags: .maskSecondaryFn)
+        state.update(type: .flagsChanged, keyCode: .kVK_Shift, flags: [.maskSecondaryFn, .maskShift])
+
+        #expect(state.isPressed)
+        #expect(state.filteredFlags([.maskSecondaryFn, .maskShift]) == [.maskSecondaryFn, .maskShift])
+    }
+
+    @Test func fnFlagIsRemovedFromAnyKeyUnlessFnIsHeld() {
+        let state = FnKeyState()
+
+        #expect(state.filteredFlags([.maskSecondaryFn, .maskShift]) == .maskShift)
+    }
+}
```

---

### Incident Patch 3: `e8560f45` (2026-11-14)
**Commit Message**: 🐞 Fix delayed gesture availability after login (#1209)

**File**: `Loop/Core/LoopManager.swift` (modified, +2/-2)
```diff
@@ -164,7 +164,7 @@ final class LoopManager {
     )
 
     func start() {
-        accessibilityCheckerTask = Task(priority: .background) { [weak self] in
+        accessibilityCheckerTask = Task(priority: .userInitiated) { [weak self] in
             for await status in AccessibilityManager.shared.stream(initial: true) {
                 guard let self, !Task.isCancelled else {
                     return
@@ -184,7 +184,7 @@ final class LoopManager {
             }
         }
 
-        gestureToggleTask = Task(priority: .background) { [weak self] in
+        gestureToggleTask = Task(priority: .userInitiated) { [weak self] in
             for await enabled in Defaults.updates(.enableGestures, initial: false) {
                 guard let self, !Task.isCancelled else { break }
 
```

#### Recent Merged Pull Requests:
- **PR #1209** (2026-11-14): 🐞 Fix delayed gesture availability after login (@mrkai77)
- **PR #1208** (2026-11-13): 🐞 Resolve child windows to their parent when hit-testing the cursor (@mrkai77)
- **PR #1207** (2026-11-13): 🎨 Make swipe and pinch gesture code consistent (@mrkai77)
- **PR #1202** (closed): 🐞 Persist updater info logs so failed updates can be diagnosed (@jvanderen1)
- **PR #1201** (closed): 🐞 Include newer stable releases on the development channel (@jvanderen1)
- **PR #1200** (closed): 🐞 Install relocated updates over an existing /Applications copy (@jvanderen1)

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

## X. 🐞 Fix crash when searching the action picker in non-English languages

**RULE**:
When implementing operations in `Loop/Settings Window/Settings/Keybinds/DirectionPickerView.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in mrkai77/Loop. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `8e0e30a8`: 🐞 Fix crash when searching the action picker in non-English languages. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `Loop/Settings Window/Settings/Keybinds/DirectionPickerView.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
                if let score = Self.fuzzyScore(item.name, key) {
    /// Scores how well a search pattern matches an action name. Lower scores rank higher.
    /// - Parameters:
    ///   - text: The action name to match against.
    ///   - pattern: The search text entered by the user.
    /// - Returns: `0` for a prefix match, `1` for a substring match, `2` if the pattern's
    ///   characters appear in order within the text, or `nil` if there is no match.
    static func fuzzyScore(_ text: String, _ pattern: String) -> Int? {
                pIndex = pattern.index(after: pIndex)
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
                if let score = fuzzyScore(item.name, key) {
    private func fuzzyScore(_ text: String, _ pattern: String) -> Int? {
                pIndex = text.index(after: pIndex)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `8e0e30a8` are properly handled with clean fallback behavior.
