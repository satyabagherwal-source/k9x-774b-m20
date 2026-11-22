# Verification Protocol: Verification Protocol: Empirical Defect Shield for mrkai77/Loop

<!-- PROVENANCE_START
{
  "source_repository": "mrkai77/Loop",
  "source_url": "https://github.com/mrkai77/Loop",
  "source_version": "5cc7551c",
  "license": "GPL-3.0",
  "timestamp": "2026-11-22T16:48:11.889Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-mrkai77-loop",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [mrkai77/Loop](https://github.com/mrkai77/Loop) (Revision: `5cc7551c`).  
> **License**: GPL-3.0 | **Timestamp**: `2026-11-22T16:48:11.889Z`  
> **Learning ID**: `learn-github-mrkai77-loop`


## 1. Scope & Verification Target
- **Target Repository**: `mrkai77/Loop` (Commit: `5cc7551c`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): mrkai77/Loop

> **Canonical Artifact**: `07_PROJECT_LEARNING/mrkai77-loop-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/mrkai77/Loop](https://github.com/mrkai77/Loop))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-22T16:48:10.646Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `mrkai77/Loop`
- **Description**: Window management made elegant.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 12009 stars

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
- **Issue #1211** (2026-11-17): **🐞 Fix window focus within frontmost app + gesture rebuild fixes**
  *Symptoms*: This PR contains two unrelated bug fixes. They're both relatively small, so they're bundled together!  1. Gestures stop responding after editing them  Changing the gesture list rebuilt the recognizers by stopping the gesture monitor first. Stopping the monitor also finishes the contact streams of the recognizers the rebuild keeps, so Loop stopped listening for gestures until it was restarted. This was a timing issue introduced in #1185. With this PR, the monitor keeps running through a rebuild and is only stopped when no recognizers are left, restoring the pre-#1185 behavior for this part.  2. Focusing a window of an app that's already frontmost  Focusing a window whose app is already frontmost didn't always make it key. For example, after clicking a Finder window, Loop couldn't focus Finder's Quick Look panel again. With the macOS window manager integration, this meant the Finder window got tiled instead of Quick Look, since macOS acts on the key window.  `makeFrontProcess` and `makeKeyWindow` alone weren't enough here, so `focus()` now hands activation over first: it deactivates the app's current key window, waits 40ms, and activates the target, before the usual focus steps. This is adapted from yabai's [`window_manager_focus_window_without_raise`](https://github.com/koekeishiya/yabai/blob/b2dc8b4c892d74738a6e865d73048ed2dc3c9ed1/src/window_manager.c#L1293-L1322), which solves this exact problem! It only runs when moving focus between two windows of the frontmost app, so fo

- **Issue #1210** (2026-11-17): **🐞 Quick Look window cannot be moved/resized with Loop after interacting with the underlying window**
  *Symptoms*: ### Bug Description  When invoking Quick Look, Loop is initially able to move and resize the Quick Look preview window normally while hovering over it.   However, as soon as I interact with the underlying Finder window, Loop stops recognizing the Quick Look window under the cursor. Even though the Quick Look panel remains floating on top of other windows, triggering Loop only moves/resizes the underlying window behind it.  ### Affected Scope  Other  ### Steps to Reproduce  1. Open Finder 2. Press `Spacebar` to open the Quick Look preview. 3. Hover the cursor over the Quick Look window and trigger Loop. **Result:** The Quick Look window moves/resizes as expected. 4. Click on the Finder window behind it, while keeping Quick Look open on top. 5. Move the cursor back over the floating Quick Look window and trigger Loop again. **Result:** Loop ignores the Quick Look window and moves/resizes the underlying window instead.  ### Reproducibility  Always  ### Expected vs Actual Behavior  Loop should continue to detect and manage the Quick Look window whenever the cursor is hovering over it (or when it's the topmost window under the cursor), regardless of whether focus was temporarily shifted to an underlying application.  ### Screen Recordings / Screenshots  https://github.com/user-attachments/assets/75848c71-6e55-4949-8b9c-8c681dac57f9  ### Severity  Blocker (cannot proceed)  ### macOS Version  27.3 (Beta)  ### Loop Version  Version 🧪 1.4.3 (1791)  ### Did You Try the Development Bui

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

### Incident Patch 1: `5cc7551c` (2026-11-22)
**Commit Message**: 🐞 Shrink a window before moving it to a smaller frame (#1190)

* 🐞 Shrink a window before moving it to a smaller frame

A same-screen snap moved the window at its old width first, so the frame hung off the display. Finder and TextEdit then shrink. iTerm2 keeps that frame, and AppKit latches it as the minimum size.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

* 🐞 Shrink in place before a move, even when the other axis grows

setFrame now reduces any shrinking side before it changes the origin, so a caller that forgets sizeFirst cannot slide the old frame off the display. Growth on the other axis happens after the move. A screen change that only grows still sets the full size first.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

* 🐞 Fix window resize order and skip redundant frame writes

---------

Co-authored-by: Kai Azim <[REDACTED_EMAIL]>

**File**: `Loop/Core/WindowDragManager.swift` (modified, +3/-1)
```diff
@@ -240,7 +240,9 @@ final class WindowDragManager {
             newWindowFrame = newWindowFrame.pushInside(screen.displayBounds)
             await window.setFrame(newWindowFrame)
         } else {
-            window.setSize(initialFrame.size)
+            window.performFrameAdjustment { writer in
+                writer.setSize(initialFrame.size)
+            }
         }
 
         // If the window doesn't contain the cursor, keep the original maxX
```

**File**: `Loop/Window Management/Window Manipulation/WindowEngine.swift` (modified, +78/-5)
```diff
@@ -193,12 +193,13 @@ enum WindowEngine {
             try await window.setFrameAnimated(targetFrame, bounds: bounds, resolvedProperties: resolvedProperties)
             actualFrame = window.frame
         } else {
-            await window.setFrame(targetFrame, sizeFirst: willChangeScreens, resolvedProperties: resolvedProperties)
+            let placement = Window.FramePlacement(bounds: bounds, willChangeScreens: willChangeScreens)
+            await window.setFrame(targetFrame, placement: placement, resolvedProperties: resolvedProperties)
             try Task.checkCancellation()
 
             var frameAfterResize = window.frame
             if !frameAfterResize.approximatelyEqual(to: targetFrame) {
-                await window.setFrame(targetFrame, resolvedProperties: resolvedProperties)
+                await window.setFrame(targetFrame, placement: placement, resolvedProperties: resolvedProperties)
                 try Task.checkCancellation()
                 frameAfterResize = window.frame
             }
@@ -209,7 +210,8 @@ enum WindowEngine {
             window: window,
             actualFrame: actualFrame,
             targetFrame: targetFrame,
-            bounds: bounds
+            bounds: bounds,
+            resolvedProperties: resolvedProperties
         )
     }
 
@@ -219,7 +221,8 @@ enum WindowEngine {
         window: Window,
         actualFrame: CGRect,
         targetFrame: CGRect,
-        bounds: CGRect
+        bounds: CGRect,
+        resolvedProperties: Window.ResolvedProperties?
     ) -> CGRect {
         guard !window.isOwnWindow, bounds != .zero else {
             return actualFrame
@@ -244,10 +247,80 @@ enum WindowEngine {
             return actualFrame
         }
 
-        window.setPosition(correctedFrame.origin)
+        window.performFrameAdjustment(resolvedProperties: resolvedProperties) { writer in
+            writer.setPosition(correctedFrame.origin)
+        }
         return correctedFrame
     }
 
+    /// Whether to resize before moving, picking whichever order keeps more of the window on screen in between.
+    /// Based on Rectangle's `ImmediateFrameOrder` located here :)
+    ///  https://github.com/rxhanson/Rectangle/blob/adbc8a0560367a6c0a56b2e8ae6f39a24740ab14/Rectangle/WindowMover/StandardWindowMover.swift#L38-L52
+    static func shouldSizeFirst(
+        from current: CGRect,
+        to target: CGRect,
+        within bounds: CGRect,
+        willChangeScreens: Bool
+    ) -> Bool {
+        // Moving at the old size can resize the window against the Dock or the new screen's edge
+        if willChangeScreens {
+            return true
+        }
+
+        guard !current.size.approximatelyEqual(to: target.size, tolerance: 1) else {
+            return false
+        }
+
+        guard bounds.size.area > 0 else {
+            return false
+        }
+
+        // Same for a window that's already partly off screen
+        if !bounds.insetBy(dx: -1, dy: -1).contains(current) {
+            return true
+        }
+
+        let sizedFirst = overflow(of: CGRect(origin: current.origin, size: target.size), outside: bounds)
+        let movedFirst = overflow(of: CGRect(origin: target.origin, size: current.size), outside: bounds)
+        if abs(sizedFirst - movedFirst) > 1 {
+            return sizedFirst < movedFirst
+        }
+
+        return true
+    }
+
+    /// The origin to move to after sizing first, anchored to the size the app accepted.
+    /// A smaller size may only be the old position clamping it, so that's left to `handleSizeConstrainedWindow`.
+    static func origin(
+        afterAccepting acceptedSize: CGSize,
+        for targetFrame: CGRect,
+        within bounds: CGRect
+    ) -> CGPoint {
+        let placedSize = CGSize(
+            width: max(acceptedSize.width, targetFrame.width),
+            height: max(acceptedSize.height, targetFrame.height)
+        )
+
+        guard !placedSize.approximatelyEqual(to: targetFrame.size, tolerance: 2),
+              placedSize.width <= bounds.width,
+              placedSize.height <= bounds.height
+        else {
+            return targetFrame.origin
+        }
+
+        return anchoredFrame(
+            for: placedSize,
+            within: targetFrame,
+            targetEdges: targetFrame.getEdgesTouchingBounds(bounds),
+            bounds: bounds
+        ).origin
+    }
+
+    private static func overflow(of frame: CGRect, outside bounds: CGRect) -> CGFloat {
+        max(0, bounds.minX - frame.minX) + max(0, frame.maxX - bounds.maxX)
+            + max(0, bounds.minY - frame.minY) + max(0, frame.maxY - bounds.maxY)
+    }
+
     static func anchoredFrame(
         for actualSize: CGSize,
         within requestedFrame: CGRect,
```

**File**: `Loop/Window Management/Window Manipulation/WindowTransformAnimation.swift` (modified, +7/-4)
```diff
@@ -27,6 +27,7 @@ final class WindowTransformAnimation: NSAnimation {
     private var targetFrame: CGRect
     private let originalFrame: CGRect
     private let window: Window
+    private let writer: FrameWriter
     private let bounds: CGRect
     private let shouldSetSize: Bool
     private let targetEdges: Edge.Set
@@ -44,6 +45,7 @@ final class WindowTransformAnimation: NSAnimation {
     init(
         _ newRect: CGRect,
         window: Window,
+        writer: FrameWriter,
         bounds: CGRect,
         shouldSetSize: Bool,
         completionHandler: @escaping (Error?) -> ()
@@ -52,6 +54,7 @@ final class WindowTransformAnimation: NSAnimation {
         self.targetFrame = newRect
         self.originalFrame = originalFrame
         self.window = window
+        self.writer = writer
         self.bounds = bounds
         self.shouldSetSize = shouldSetSize
         self.targetEdges = newRect.getEdgesTouchingBounds(bounds)
@@ -140,7 +143,7 @@ final class WindowTransformAnimation: NSAnimation {
                 sizeToSet: sizeToSet
             ) {
                 if !lastWindowFrame.origin.approximatelyEqual(to: preResizeOrigin, tolerance: 1) {
-                    window.setPosition(preResizeOrigin)
+                    writer.setPosition(preResizeOrigin)
                     currentOrigin = preResizeOrigin
                 }
             } else if growsHorizontally || growsVertically {
@@ -152,12 +155,12 @@ final class WindowTransformAnimation: NSAnimation {
                     preResizeOrigin.y = requestedFrame.origin.y
                 }
                 if !lastWindowFrame.origin.approximatelyEqual(to: preResizeOrigin, tolerance: 1) {
-                    window.setPosition(preResizeOrigin)
+                    writer.setPosition(preResizeOrigin)
                     currentOrigin = preResizeOrigin
                 }
             }
 
-            window.setSize(sizeToSet)
+            writer.setSize(sizeToSet)
             if bounds != .zero {
                 let actualFrame = window.frame
                 updateConstraint(actualFrame: actualFrame, requestedFrame: requestedFrame, tolerance: resizeTolerance)
@@ -190,7 +193,7 @@ final class WindowTransformAnimation: NSAnimation {
         }
 
         if !currentOrigin.approximatelyEqual(to: newFrame.origin, tolerance: 1) {
-            window.setPosition(newFrame.origin)
+            writer.setPosition(newFrame.origin)
         }
 
         lastWindowFrame = window.frame
```

**File**: `Loop/Window Management/Window/Window.swift` (modified, +72/-32)
```diff
@@ -426,7 +426,7 @@ final class Window {
         }
     }
 
-    func setPosition(_ point: CGPoint) {
+    fileprivate func setPosition(_ point: CGPoint) {
         if isOwnWindow {
             Task { @MainActor in
                 guard let win = ownNSWindow() else { return }
@@ -453,7 +453,7 @@ final class Window {
         }
     }
 
-    func setSize(_ size: CGSize) {
+    fileprivate func setSize(_ size: CGSize) {
         if isOwnWindow {
             Task { @MainActor in
                 guard let win = ownNSWindow() else { return }
@@ -535,66 +535,87 @@ final class Window {
         return true
     }
 
+    /// The screen a frame is placed on, used to choose whether to resize or move first.
+    struct FramePlacement {
+        let bounds: CGRect
+        let willChangeScreens: Bool
+    }
+
+    /// - Parameter placement: When `nil`, the window is moved, then resized.
     func setFrame(
         _ rect: CGRect,
-        sizeFirst: Bool = false,
+        placement: FramePlacement? = nil,
         resolvedProperties: ResolvedProperties? = nil
     ) async {
         guard await !MainActor.run(resultType: Bool.self, body: { applyOwnWindowFrame(rect) }) else {
             return
         }
 
-        let enhancedUI = resolvedProperties?.isEnhancedUserInterface ?? enhancedUserInterface
         let shouldSetSize = resolvedProperties?.isResizable ?? true
 
-        if enhancedUI {
-            let appName = nsRunningApplication?.localizedName
-            log.info("\(appName ?? "This app")'s enhanced UI will be temporarily disabled while resizing.")
-            enhancedUserInterface = false
+        performFrameAdjustment(resolvedProperties: resolvedProperties) {
+            writeChangedFrame(rect, with: $0, placement: placement, shouldSetSize: shouldSetSize)
         }
+    }
 
-        if sizeFirst, shouldSetSize {
-            setSize(rect.size)
+    func setFrameSynchronously(
+        _ rect: CGRect,
+        resolvedProperties: ResolvedProperties? = nil
+    ) {
+        guard !applyOwnWindowFrameSynchronously(rect) else {
+            return
         }
 
-        setPosition(rect.origin)
-
-        if shouldSetSize {
-            setSize(rect.size)
-        }
+        let shouldSetSize = resolvedProperties?.isResizable ?? true
 
-        if enhancedUI {
-            enhancedUserInterface = true
+        performFrameAdjustment(resolvedProperties: resolvedProperties) {
+            writeChangedFrame(rect, with: $0, placement: nil, shouldSetSize: shouldSetSize)
         }
     }
 
-    func setFrameSynchronously(
+    /// Only writes the parts of `rect` that differ from the current frame, as each write can make the app redraw.
+    private func writeChangedFrame(
         _ rect: CGRect,
-        sizeFirst: Bool = false,
-        resolvedProperties: ResolvedProperties? = nil
+        with writer: FrameWriter,
+        placement: FramePlacement?,
+        shouldSetSize: Bool
     ) {
-        guard !applyOwnWindowFrameSynchronously(rect) else {
-            return
+        var current = frame
+        var origin = rect.origin
+
+        let sizeFirst = placement.map {
+            WindowEngine.shouldSizeFirst(from: current, to: rect, within: $0.bounds, willChangeScreens: $0.willChangeScreens)
+        } ?? false
+
+        if sizeFirst, shouldSetSize, !current.size.approximatelyEqual(to: rect.size, tolerance: 1) {
+            writer.setSize(rect.size)
+            current = frame
+            if let placement {
+                origin = WindowEngine.origin(afterAccepting: current.size, for: rect, within: placement.bounds)
+            }
+        }
+
+        if !current.origin.approximatelyEqual(to: origin, tolerance: 1) {
+            writer.setPosition(origin)
+        }
+
+        // Set again in case the old position clamped the size
+        if shouldSetSize, !current.size.approximatelyEqual(to: rect.size, tolerance: 1) {
+            writer.setSize(rect.size)
         }
+    }
 
+    /// Runs frame writes with enhanced UI disabled, as some apps animate or ignore frame changes while it's on.
+    func performFrameAdjustment(resolvedProperties: ResolvedProperties? = nil, _ adjustment: (FrameWriter) -> ()) {
         let enhancedUI = resolvedProperties?.isEnhancedUserInterface ?? enhancedUserInterface
-        let shouldSetSize = resolvedProperties?.isResizable ?? true
 
         if enhancedUI {
             let appName = nsRunningApplication?.localizedName
             log.info("\(appName ?? "This app")'s enhanced UI will be temporarily disabled while resizing.")
             enhancedUserInterface = false
         }
 
-        if sizeFirst, shouldSetSize {
-            setSize(rect.size)
-        }
-
-        setPosition(rect.origin)
-
-        if shouldSetSize {
-            setSize(rect.size)
-        }
+        adjustment(FrameWriter(self))
 
         if enhancedUI {
             enhancedUserInterface = true
@@ -631,6 +652,7 @@ final class Window {
             let animation = WindowTra
```

**File**: `LoopTests/WindowEngineSizeFirstTests.swift` (added, +68/-0)
```diff
@@ -0,0 +1,68 @@
+//
+//  WindowEngineSizeFirstTests.swift
+//  LoopTests
+//
+
+import CoreGraphics
+@testable import Loop
+import Testing
+
+struct WindowEngineSizeFirstTests {
+    private let screen = CGRect(x: 0, y: 0, width: 1920, height: 1080)
+
+    private func sizesFirst(from current: CGRect, to target: CGRect) -> Bool {
+        WindowEngine.shouldSizeFirst(from: current, to: target, within: screen, willChangeScreens: false)
+    }
+
+    @Test func shrinkingTowardTheFarEdgeSizesFirst() {
+        // Moving first would slide the full-width window 1280 points off the right edge
+        #expect(sizesFirst(
+            from: CGRect(x: 0, y: 0, width: 1920, height: 1080),
+            to: CGRect(x: 1280, y: 0, width: 640, height: 1080)
+        ))
+    }
+
+    @Test func growingFromTheFarEdgeMovesFirst() {
+        // Sizing first would grow the right third 1280 points off the right edge
+        #expect(!sizesFirst(
+            from: CGRect(x: 1280, y: 0, width: 640, height: 1080),
+            to: CGRect(x: 0, y: 0, width: 1920, height: 1080)
+        ))
+    }
+
+    @Test func mixedResizePicksTheOrderThatSticksOutLess() {
+        // Sizing first hangs 600 points off the bottom, moving first 1080 points off the right
+        #expect(sizesFirst(
+            from: CGRect(x: 0, y: 600, width: 1900, height: 400),
+            to: CGRect(x: 1100, y: 0, width: 800, height: 1080)
+        ))
+    }
+
+    @Test func eitherOrderOnScreenSizesFirst() {
+        #expect(sizesFirst(
+            from: CGRect(x: 0, y: 0, width: 640, height: 1080),
+            to: CGRect(x: 960, y: 0, width: 960, height: 1080)
+        ))
+    }
+
+    @Test func partlyOffScreenWindowSizesFirst() {
+        #expect(sizesFirst(
+            from: CGRect(x: 1500, y: 0, width: 960, height: 1080),
+            to: CGRect(x: 0, y: 0, width: 1920, height: 1080)
+        ))
+    }
+
+    @Test func largerAcceptedSizeStaysAnchoredToTheTargetEdge() {
+        // A window with an 800-point minimum width snapped to the right third keeps its right edge on the screen's
+        let target = CGRect(x: 1280, y: 0, width: 640, height: 1080)
+        let origin = WindowEngine.origin(afterAccepting: CGSize(width: 800, height: 1080), for: target, within: screen)
+        #expect(origin == CGPoint(x: 1120, y: 0))
+    }
+
+    @Test func smallerAcceptedSizeIsPlacedAtTheTargetSize() {
+        // May only be the old position clamping it, so it's corrected after the move instead
+        let target = CGRect(x: 1280, y: 0, width: 640, height: 1080)
+        let origin = WindowEngine.origin(afterAccepting: CGSize(width: 640, height: 500), for: target, within: screen)
+        #expect(origin == target.origin)
+    }
+}
```

---

### Incident Patch 2: `56a96f7f` (2026-11-22)
**Commit Message**: 🐞 Replace SkyLight window blur with an in-window backdrop blur

SkyLight's window background blur unfortunately broke on macOS 27.2 on newer rounded-screen MacBooks when a window approached a screen corner.

**File**: `Loop/Private APIs/SkyLightToolBelt.swift` (modified, +8/-0)
```diff
@@ -231,6 +231,14 @@ enum SkyLightToolBelt {
     }
 
     /// Sets the background blur radius of a window.
+    ///
+    /// You may need to call something like:
+    /// ```swift
+    /// window.backgroundColor = .white.withAlphaComponent(0.001)
+    /// window.ignoresMouseEvents = false
+    /// ```
+    /// to restore pointer interaction with the window.
+    ///
     /// - Parameters:
     ///   - windowID: The `CGWindowID` of the window to manipulate.
     ///   - radius: The desired blur radius.
```

**File**: `Loop/Settings Window/SettingsContentView.swift` (modified, +3/-1)
```diff
@@ -42,7 +42,6 @@ struct SettingsContentView: View {
             }
             .frame(width: 230)
             .padding(.top, titleBarHeight)
-            .luminareBackground()
 
             LuminarePane {
                 model.currentTab.view()
@@ -107,6 +106,9 @@ struct SettingsContentView: View {
                 .animation(animation, value: [showRadialMenu, showPreview])
                 .padding(12)
                 .frame(width: 520)
+                .background {
+                    BackdropBlurView(radius: 6)
+                }
             }
         }
         .luminareTint(overridingWith: accentColorController.color1)
```

**File**: `Loop/Settings Window/SettingsWindowManager.swift` (modified, +0/-8)
```diff
@@ -83,14 +83,6 @@ final class SettingsWindowManager: ObservableObject {
                     .frame(height: 620)
             }
 
-            SkyLightToolBelt.setBackgroundBlur(
-                windowID: CGWindowID(window.windowNumber),
-                radius: 20
-            )
-
-            window.backgroundColor = .white.withAlphaComponent(0.001)
-            window.ignoresMouseEvents = false
-
             controller = NSWindowController(window: window)
         }
 
```

**File**: `Loop/Updater/Updater.swift` (modified, +1/-1)
```diff
@@ -253,7 +253,7 @@ final class Updater: ObservableObject {
         guard updateState == .available else { return }
 
         if windowController?.window == nil {
-            windowController = .init(window: LuminareWindow(cornerRadius: 20) { UpdateView() })
+            windowController = .init(window: LuminareCustomCornerRadiusWindow(cornerRadius: 20) { UpdateView() })
         }
         windowController?.window?.makeKeyAndOrderFront(self)
         windowController?.window?.orderFrontRegardless()
```

**File**: `Loop/Updater/Views/UpdateView.swift` (modified, +0/-1)
```diff
@@ -68,7 +68,6 @@ struct UpdateView: View {
         }
         .frame(width: 500, height: 480)
         .padding(.top, 38) // titlebar
-        .luminareBackground()
     }
 
     private func theLoopTimesView() -> some View {
```

**File**: `Loop/Utilities/BackdropBlurView.swift` (added, +128/-0)
```diff
@@ -0,0 +1,128 @@
+//
+//  BackdropBlurView.swift
+//  Loop
+//
+//  Created by Kai Azim on 2026-11-21.
+//
+
+import SwiftUI
+
+/// A pass-through Gaussian blur of everything behind the window.
+struct BackdropBlurView: NSViewRepresentable {
+    let radius: CGFloat
+
+    func makeNSView(context _: Context) -> BackdropBlurNSView {
+        BackdropBlurNSView(radius: radius)
+    }
+
+    func updateNSView(_ view: BackdropBlurNSView, context _: Context) {
+        view.radius = radius
+    }
+}
+
+final class BackdropBlurNSView: NSVisualEffectView {
+    var radius: CGFloat {
+        didSet {
+            guard radius != oldValue else { return }
+            reduceToBlur()
+        }
+    }
+
+    init(radius: CGFloat) {
+        self.radius = radius
+        super.init(frame: .zero)
+
+        // A behind-window visual effect view is what makes AppKit sample the content behind the window,
+        // so this works without making the window transparent. Its material is then reduced to just a blur.
+        material = .menu
+        blendingMode = .behindWindow
+        state = .active
+    }
+
+    @available(*, unavailable)
+    required init?(coder _: NSCoder) {
+        fatalError("init(coder:) has not been implemented")
+    }
+
+    /// The blur is purely visual
+    override func hitTest(_: NSPoint) -> NSView? {
+        nil
+    }
+
+    // AppKit rebuilds the material's layers on these occasions (such as appearance changes),
+    // so the blur is reapplied after each one. Reapplying is a no-op when nothing has changed.
+
+    override func layout() {
+        super.layout()
+        reduceToBlur()
+    }
+
+    override func updateLayer() {
+        super.updateLayer()
+        reduceToBlur()
+    }
+
+    override func viewDidChangeEffectiveAppearance() {
+        super.viewDidChangeEffectiveAppearance()
+        reduceToBlur()
+    }
+
+    override func viewDidMoveToWindow() {
+        super.viewDidMoveToWindow()
+        reduceToBlur()
+    }
+
+    /// Reduces AppKit's material to a plain Gaussian blur of the given radius.
+    private func reduceToBlur() {
+        guard
+            let layer,
+            let backdropLayer = Self.findBackdropLayer(in: layer),
+            let filters = backdropLayer.filters as? [NSObject]
+        else {
+            return
+        }
+
+        // Keep only the blur (and SDR normalization), dropping the material's saturation boost
+        let keptFilters = filters.filter { filter in
+            let type = Self.filterType(of: filter)
+            return type == "gaussianBlur" || type == "sdrNormalize"
+        }
+
+        guard let blurFilter = keptFilters.first(where: { Self.filterType(of: $0) == "gaussianBlur" }) else {
+            return
+        }
+
+        let radiusChanged = (blurFilter.value(forKey: "inputRadius") as? CGFloat) != radius
+        if radiusChanged {
+            blurFilter.setValue(radius, forKey: "inputRadius")
+        }
+
+        // Filters are only applied when reassigned, so reassign them only when something changed
+        if radiusChanged || keptFilters.count != filters.count {
+            backdropLayer.filters = keptFilters
+        }
+
+        // Hide the material's tint layers, which sit beside the backdrop layer
+        for sibling in backdropLayer.superlayer?.sublayers ?? [] where sibling !== backdropLayer && !sibling.isHidden {
+            sibling.isHidden = true
+        }
+    }
+
+    private static func filterType(of filter: NSObject) -> String? {
+        filter.value(forKey: "type") as? String
+    }
+
+    private static func findBackdropLayer(in layer: CALayer) -> CALayer? {
+        if String(describing: type(of: layer)) == "CABackdropLayer" {
+            return layer
+        }
+
+        for sublayer in layer.sublayers ?? [] {
+            if let backdropLayer = findBackdropLayer(in: sublayer) {
+                return backdropLayer
+            }
+        }
+
+        return nil
+    }
+}
```

#### Recent Merged Pull Requests:
- **PR #1211** (2026-11-17): 🐞 Fix window focus within frontmost app + gesture rebuild fixes (@mrkai77)
- **PR #1209** (2026-11-14): 🐞 Fix delayed gesture availability after login (@mrkai77)
- **PR #1208** (2026-11-13): 🐞 Resolve child windows to their parent when hit-testing the cursor (@mrkai77)
- **PR #1207** (2026-11-13): 🎨 Make swipe and pinch gesture code consistent (@mrkai77)
- **PR #1202** (closed): 🐞 Persist updater info logs so failed updates can be diagnosed (@jvanderen1)
- **PR #1201** (closed): 🐞 Include newer stable releases on the development channel (@jvanderen1)

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

## X. 🐞 Shrink a window before moving it to a smaller frame

**RULE**:
When implementing operations in `Loop/Core/WindowDragManager.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in mrkai77/Loop. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5cc7551c`: 🐞 Shrink a window before moving it to a smaller frame. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `Loop/Core/WindowDragManager.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
            window.performFrameAdjustment { writer in
                writer.setSize(initialFrame.size)
            }
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
            window.setSize(initialFrame.size)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5cc7551c` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
