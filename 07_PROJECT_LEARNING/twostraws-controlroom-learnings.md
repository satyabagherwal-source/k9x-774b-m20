# Forensic Learning Record (Deep Inspection): twostraws/ControlRoom

> **Canonical Artifact**: `07_PROJECT_LEARNING/twostraws-controlroom-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/twostraws/ControlRoom](https://github.com/twostraws/ControlRoom))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:29:42.825Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `twostraws/ControlRoom`
- **Description**: A macOS app to control the Xcode Simulator.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 6103 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `ControlRoom/Controllers/ChromeRendering/ChromeRenderer.swift`
```
//
//  ChromeRenderer.swift
//  ControlRoom
//
//  Created by Paul Hudson on 15/05/2023.
//  Copyright © 2023 Paul Hudson. All rights reserved.
//

import SwiftUI

// The programmer's credo: "We do these things not because they
// are easy, but because we thought they were going to be easy."
//                                        – @Pinboard
//
// This file was created late at night. "How hard could it be to
// add the simulator chrome around a screenshot?" I thought to
// myself at about 10:30pm. At midnight I knew the answer:
// bizarrely hard, because Apple stores information in various
// places, separated into individual PDFs, and pieced together
// using a JSON format I can only describe as "creative."
//
// Still, I persisted, and by about 1:30am I had produced the below.
// This code is terrible, partly because it digs into simulator
// files bundled with Xcode, partly because it doesn't support
// devices rotated to landscape, but mostly because it contains a
// huge amount of guesswork as to what individual components in
// Apple's file format actually mean.
//
// Yes, around 1am I did think to myself, "I should just use some
// pre-rendered pictures of each device," but I suspect Apple might
// have taken issue with that kind of thing!
//
// I would love to see this code ripped out and replaced with
// something actually sensible. I've documented what the below
// does in case it helps, but really it comes down to two things:
//
// 1. There's a large collection of simulator device types at
// /Applications/Xcode.app/Contents/Developer/Platforms
// /iPhoneOS.platform/Library/Developer/CoreSimulator
// /Profiles/DeviceTypes. These describe the various devices
// the simulator is capable of working with.
//
// 2. There's a collection of simulator chromes at
// /Applications/Xcode.app/Contents/Developer/Platforms
// /iPhoneOS.platform/Library/Developer/CoreSimulator
// /Profiles/Chrome. These provide PDFs for various parts
// of a simulator (top-left corner, top edge, top-right corner,
// etc), along with JSON that describes the positioning of
// those parts in a rather obtuse way.
//
// So, this code makes dozens of guesses about what the various
// pieces of JSON data mean, and attempts to use that to combine
// the PDF components together with a user screenshot to
// produce a final image. If there's a simpler, cleaner, or
// more flexible way to get the same result, I'd love to see it!

// Note: all the Decodable types for rendering are stored
// in ChromeRendererTypes.swift.

/// Renders a screenshot to an image using a specific device name.
class ChromeRenderer {
    /// The screenshot we want to place inside our device chrome.
    let screenshot: NSImage

    /// The base URL where we can find the JSON and images for this chrome.
    let baseURL: URL

    /// Describes the chrome type and screen scale for this simulator.
    let device: SimulatorDevice

    /// Describes the images and placements for this chrome.
    let chrome: SimulatorChrome

    /// The final width of the rendered image.
    let width: Double

    /// The final height of the rendered image.
    let height: Double

    /// Creates an instance of ChromeRenderer from a raw device name
    /// (eg "iPhone 14 Pro") and the screenshot the user just took.
    init(deviceName: String, screenshot: NSImage) throws {
        self.screenshot = screenshot

        // We start by loading this device's profile, which describes
        // what type of chrome we have and also the screen scale.
        let developerPath = XcodeHelper.getDeveloperPath()
        let basePath = "\(developerPath)/Platforms/iPhoneOS.platform/Library/Developer/CoreSimulator/Profiles"
        let profilePath = "\(basePath)/DeviceTypes/\(deviceName).simdevicetype/Contents/Resources/profile.plist"
        let profileURL = URL(filePath: profilePath)

        let profileData = try Data(contentsOf: profileURL)
        device = try PropertyListDecoder().decode(SimulatorDevice.self, from: profileData)

        // The main Chrome identifier looks like
        // com.apple.CoreSimulator.SimDeviceChrome.phone7, but we only want
        // the last part of that, i.e. "phone7".
        let mainIdentifier = device.chromeIdentifier.components(separatedBy: ".").last ?? "phone"

        // Now use that last part to find the PDFs and placement JSON.
        var chromePath = "\(basePath)/Chrome/\(mainIdentifier).devicechrome/Contents/Resources"
        if !FileManager.default.fileExists(atPath: chromePath) {
            // Before Xcode 15, the path used `simdevicechrome`, not `devicechrome`, so fall back to that
            chromePath = "\(basePath)/Chrome/\(mainIdentifier).simdevicechrome/Contents/Resources"
        }
        baseURL = URL(filePath: chromePath)

        let chromeURL = URL(filePath: "\(chromePath)/chrome.json")
        let chromeData = try Data(contentsOf: chromeURL)

        chrome = try JSONDecoder().decode(SimulatorChrome.self, from: chromeData)

        // Add just a little extra space for padding
        width = (Double(screenshot.size.width) / device.mainScreenScale + chrome.images.sizing.leftWidth * 2) * 1.05
        height = (Double(screenshot.size.height) / Double(device.mainScreenScale) + chrome.images.sizing.topHeight * 2) * 1.05
    }

    /// This does all the actual work of loading and rendering the various image components to produce
    /// a final image of the screenshot in simulator chrome.
    @MainActor
    func makeImage() -> NSImage? {
        let renderer = ImageRenderer(content:
            Canvas { [self] context, size in
                // Loading the various edges of this chrome from PDFs – top-left,
                // left, top-right, and so on.
                // swiftlint:disable identifier_name
                let tl = image(named: chrome.images.topLeft)
                let l = image(named: chrome.images.left)
                let tr = image(named: chrome.images.topRight)
                let bl = image(named: chrome.images.bottomLeft)
                let r = image(named: chrome.images.right)
                let br = image(named: chrome.images.bottomRight)
                let t = image(named: chrome.images.top)
                let b = image(named: chrome.images.bottom)
                // swiftlint:enable identifier_name

                let center = CGPoint(x: size.width / 2, y: size.height / 2)

                // NSImage will report our screenshot's size at its full pixel
                // resolution, but we want to bring that down to the scale it
                // was actually rendered with – e.g. 3x.
                let screenshotSize = CGSize(width: screenshot.size.width / device.mainScreenScale, height: screenshot.size.height / device.mainScreenScale)

                // Presumably the size of the various edges of the device?
                let edgeSizes = SimulatorImagePadding(
                    top: chrome.images.sizing.topHeight,
                    left: chrome.images.sizing.leftWidth,
                    bottom: chrome.images.sizing.bottomHeight,
                    right: chrome.images.sizing.rightWidth
                )

                // Calculate base drawing positions of the four corners.
                let topLeft = CGPoint(x: size.width / 2 - (screenshotSize.width / 2), y: size.height / 2 - (screenshotSize.height / 2))
                let topRight = CGPoint(x: size.width / 2 + (screenshotSize.width / 2), y: topLeft.y)
                let bottomLeft = CGPoint(x: topLeft.x, y: size.height / 2 + (screenshotSize.height / 2))
                let bottomRight = CGPoint(x: topRight.x, y: bottomLeft.y)

                // Apple's PDFs provide device edges as being either 1-point high or 1-point wide,
                // depending on whether it's a horizontal or vertical edge. So, we need to stretch
                // the images to fit the correct dimensions for the current device.
                // NOTE: We overdraw ever so slightly to avoid hairline cracks between various segments.
                let drawHeight: Double = bottomLeft.y - t.size.height - b.size.height - topLeft.y + edgeSizes.top + edgeSizes.bottom + 2.0
                let drawWidth: Double = screenshotSize.width - tl.size.width - tr.size.width + edgeSizes.left + edgeSizes.right + 2.0

                // Now draw the inputs (i.e. buttons) that must be placed behind the rest of the
                // chrome, such as the volume buttons.
                let behindInputs = chrome.inputs.filter { $0.onTop == false }
                draw(inputs: behindInputs, in: context, canvasSize: size, screenshotSize: screenshotSize, edges: edgeSizes)

                // Draw the top and bottom edges of the chrome.
                let topX: Double = size.width / 2.0 - (screenshotSize.width / 2.0) + tl.size.width - edgeSizes.left - 1
                let topY: Double = topLeft.y - edgeSizes.top
                context.draw(Image(nsImage: t), in: CGRect(x: topX, y: topY, width: drawWidth, height: t.size.height))

                let bottomX: Double = size.width / 2 - (screenshotSize.width / 2.0) + tl.size.width - edgeSizes.left - 1
                let bottomY: Double = bottomLeft.y - b.size.height + edgeSizes.bottom
                context.draw(Image(nsImage: b), in: CGRect(x: bottomX, y: bottomY, width: drawWidth, height: b.size.height))

                // Draw the left and right edges of the chrome.
                context.draw(Image(nsImage: l), in: CGRect(x: topLeft.x - edgeSizes.left, y: topLeft.y + tl.size.height - edgeSizes.top - 1, width: l.size.width, height: drawHeight))
                context.draw(Image(nsImage: r), in: CGRect(x: topRight.x - tr.size.width + edgeSizes.right, y: topRight.y + tr.size.height - edgeSizes.top - 1, width: r.size.width, height: drawHeight))

                // Now draw the four corners. This must happen *after* the top, bottom, left,
                // and right edges have been drawn, because they overdraw by 1 pixel to avoid
         
```

### Core Architecture Module: `ControlRoom/Controllers/ChromeRendering/ChromeRendererTypes.swift`
```
//
//  ChromeRendererTypes.swift
//  ControlRoom
//
//  Created by Paul Hudson on 15/05/2023.
//  Copyright © 2023 Paul Hudson. All rights reserved.
//

/// This file contains all the Decodable types required to work with Apple's property list and JSON
/// files that handle simulator device and chrome data.

import Foundation

struct SimulatorDevice: Decodable {
    var chromeIdentifier: String
    var mainScreenScale: Double
}

struct SimulatorChrome: Decodable {
    var identifier: String
    var images: SimulatorImageSet
    var inputs: [SimulatorImageInput]
}

struct SimulatorImageSet: Decodable {
    var topLeft: String
    var top: String
    var topRight: String
    var right: String
    var bottomRight: String
    var bottom: String
    var bottomLeft: String
    var left: String
    var screen: String
    var sizing: SimulatorImageSetSizing
    var padding: SimulatorSize
    var devicePadding: SimulatorImagePadding
}

struct SimulatorImageSetSizing: Decodable {
    var leftWidth: Double
    var rightWidth: Double
    var topHeight: Double
    var bottomHeight: Double
}

struct SimulatorSize: Decodable {
    var width: Double
    var height: Double
}

// swiftlint:disable identifier_name
struct SimulatorPoint: Decodable {
    var x: Double
    var y: Double
}
// swiftlint:enable identifier_name

struct SimulatorImagePadding: Decodable {
    var top: Double
    var left: Double
    var bottom: Double
    var right: Double
}

struct SimulatorPath: Decodable {
    var insets: SimulatorImagePadding
    var cornerRadiusX: Double
    var cornerRadiusY: Double
}

struct SimulatorImageInput: Decodable {
    var image: String
    var onTop: Bool
    var anchor: String
    var align: String
    var offsets: SimulatorOffsets
}

struct SimulatorOffsets: Decodable {
    var normal: SimulatorPoint
    var rollover: SimulatorPoint
}

```

### Core Architecture Module: `ControlRoom/Controllers/UIState.swift`
```
//
//  UIState.swift
//  ControlRoom
//
//  Created by Dave DeLong on 2/16/20.
//  Copyright © 2020 Paul Hudson. All rights reserved.
//

import Combine

class UIState: ObservableObject {
    enum Sheet: Int, Identifiable {
        case preferences
        case createSimulator
        case deepLinkEditor
        case notificationEditor
        case confirmDeleteSelected

        var id: Int { rawValue }
    }

    enum Alert: Int, Identifiable {
        case confirmDeleteUnavailable

        var id: Int { rawValue }
    }

    static let shared = UIState()
    @Published var currentSheet: Sheet?
    @Published var currentAlert: Alert?

    private init() { }
}

```

### Core Architecture Module: `ControlRoom/About UI/AboutView.swift`
```
//
//  AboutView.swift
//  ControlRoom
//
//  Created by Dave DeLong on 2/19/20.
//  Copyright © 2020 Paul Hudson. All rights reserved.
//

import SwiftUI

struct AboutView: View {
    var appName: String {
        (Bundle.main.object(forInfoDictionaryKey: "CFBundleName") as? String) ?? "Control Room"
    }

    var appVersion: String {
        (Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String) ?? "1.0"
    }

    var appBuild: String {
        (Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String) ?? "1.0"
    }

    var copyright: String {
        let copyright = Bundle.main.object(forInfoDictionaryKey: "NSHumanReadableCopyright") as? String
        return copyright ?? "Copyright © 2023 Paul Hudson. All rights reserved."
    }

    let authors: [Author]

    var body: some View {
        VStack(spacing: 8) {
            Image(nsImage: NSImage(named: NSImage.applicationIconName)!)
                .resizable()
                .aspectRatio(1.0, contentMode: .fit)
                .frame(width: 64, height: 64)

            Text("Control Room")
                .fontWeight(.bold)

            Text("Version \(appVersion) (\(appBuild))")
                .font(.caption)

            if authors.isNotEmpty {
                Text("Built thanks to the contributions of:")
                    .font(.caption)

                // contributors
                CollectionView(authors, horizontalSpacing: 0, horizontalAlignment: .center, verticalSpacing: 0) { author in
                    Link("@\(author.login)", destination: author.htmlUrl)
                        .padding(2)
                }
                .font(.caption)
            }

            Text(copyright)
                .font(.caption)
        }
        .padding(20)
    }
}

struct AboutView_Previews: PreviewProvider {
    static var previews: some View {
        AboutView(authors: [])
    }
}

```

### Core Architecture Module: `ControlRoom/About UI/Contributors.swift`
```
//
//  Contributors.swift
//  ControlRoom
//
//  Created by Dave DeLong on 2/19/20.
//  Copyright © 2020 Paul Hudson. All rights reserved.
//

import Foundation

struct Author: Decodable, Identifiable {
    let login: String
    let htmlUrl: URL

    var id: String { login }
}

private struct Contributor: Decodable, Comparable {
    static func < (lhs: Contributor, rhs: Contributor) -> Bool {
        lhs.total < rhs.total
    }

    static func == (lhs: Contributor, rhs: Contributor) -> Bool {
        lhs.author.id == rhs.author.id
    }

    let total: Int
    let author: Author
}

extension Bundle {
    var authors: [Author] {
        guard let fileURL = url(forResource: "contributors", withExtension: "json") else { return [] }
        guard let rawJSON = try? Data(contentsOf: fileURL) else { return [] }

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase

        guard let contributors = try? decoder.decode([Contributor].self, from: rawJSON) else { return [] }
        return contributors.sorted().reversed().map(\.author)
    }
}

```

### Core Architecture Module: `ControlRoom/ControlRoomApp.swift`
```
//
//  ControlRoomApp.swift
//  ControlRoom
//
//  Created by Paul Hudson on 12/02/2020.
//  Copyright © 2023 Paul Hudson. All rights reserved.
//

import KeyboardShortcuts
import SwiftUI

@main
struct ControlRoomApp: App {
    @AppStorage("CRWantsMenuBarIcon") private var wantsMenuBarIcon = true
    @AppStorage("CRApps_LastOpenURL") private var lastOpenURL = ""
    @AppStorage("CRApps_LastBundleID") private var lastBundleID = ""
    @AppStorage("CRLastSimulatorUDID") private var lastSimulatorUDID = "booted"
    @AppStorage("CRApps_PushPayload") private var pushPayload = """
    {
        "aps": {
            "alert": {
                "body": "Hello, World!",
                "title": "From Control Room"
            }
        }
    }
    """

    @StateObject var preferences: Preferences
    @StateObject var controller: SimulatorsController
    @StateObject var deepLinks = DeepLinksController()

    var body: some Scene {
        Window("Control Room", id: "main") {
            MainView(controller: controller)
                .environmentObject(preferences)
                .environmentObject(UIState.shared)
                .environmentObject(deepLinks)
        }
        .commands {
            CommandGroup(replacing: .appInfo) {
                Button("About Control Room") {
                    let authors = Bundle.main.authors

                    if authors.isNotEmpty {
                        let content = NSViewController()
                        content.title = "Control Room"
                        let view = NSHostingView(rootView: AboutView(authors: authors))
                        view.frame.size = view.fittingSize
                        content.view = view
                        let panel = NSPanel(contentViewController: content)
                        panel.styleMask = [.closable, .titled]
                        panel.orderFront(nil)
                        panel.makeKey()
                    } else {
                        NSApp.orderFrontStandardAboutPanel(nil)
                    }
                }
            }
        }

        Settings {
            SettingsView()
                .environmentObject(preferences)
        }

        MenuBarExtra(isInserted: .constant(preferences.wantsMenuBarIcon)) {
            if deepLinks.links.isEmpty == false {
                Menu("Saved deep links") {
                    ForEach(deepLinks.links) { link in
                        Button(link.name) {
                            open(link)
                        }
                    }
                }

                Divider()
            }

            Button("Resend last push notification", action: resendLastPushNotification)
                .keyboardShortcut("p", modifiers: [.control, .option, .command])
            Button("Restart last selected app", action: restartLastSelectedApp)
                .keyboardShortcut("r", modifiers: [.control, .option, .command])
            Button("Reopen last URL", action: reopenLastURL)
                .keyboardShortcut("u", modifiers: [.control, .option, .command])
        } label: {
            Label("Control Room", systemImage: "gear")

        }
    }

    init() {
        let preferences = Preferences()
        _preferences = StateObject(wrappedValue: preferences)
        _controller =  StateObject(wrappedValue: SimulatorsController(preferences: preferences))
    }

    func resendLastPushNotification() {
        SimCtl.sendPushNotification(lastSimulatorUDID, appID: lastBundleID, jsonPayload: pushPayload)
    }

    func restartLastSelectedApp() {
        SimCtl.restart(lastSimulatorUDID, appID: lastBundleID)
    }

    func reopenLastURL() {
        SimCtl.openURL(lastSimulatorUDID, URL: lastOpenURL)
    }

    func open(_ link: DeepLink) {
        SimCtl.openURL(lastSimulatorUDID, URL: link.url.absoluteString)
    }
}

```

### Core Architecture Module: `ControlRoom/Controllers/Application.swift`
```
//
//  Application.swift
//  ControlRoom
//
//  Created by Mario Iannotta on 14/02/2020.
//  Copyright © 2020 Paul Hudson. All rights reserved.
//

import Foundation
import AppKit

struct Application: Hashable, Comparable {
    let url: URL?
    let type: ApplicationType?
    let displayName: String
    let bundleIdentifier: String
    let versionNumber: String
    let buildNumber: String
    let imageURLs: [URL]?
    let dataFolderURL: URL?
    let firstAppGroupFolderURL: URL?
    let bundleURL: URL?

    static let `default` = Application()

	static func < (lhs: Application, rhs: Application) -> Bool {
		lhs.displayName.localizedStandardCompare(rhs.displayName) == .orderedAscending
	}

    private init() {
        url = nil
        type = nil
        displayName = ""
        bundleIdentifier = ""
        versionNumber = ""
        buildNumber = ""
        imageURLs = nil
        dataFolderURL = nil
        firstAppGroupFolderURL = nil
        bundleURL = nil
    }

    init?(application: SimCtl.Application) {
        guard let url = URL(string: application.bundlePath) else { return nil }

        self.url = url
        type = application.type
        displayName = application.displayName

        let plistURL = url.appendingPathComponent("Info.plist")
        let plistDictionary = NSDictionary(contentsOf: plistURL)
        bundleIdentifier = application.bundleIdentifier
        versionNumber = plistDictionary?["CFBundleShortVersionString"] as? String ?? ""
        buildNumber = plistDictionary?["CFBundleVersion"] as? String ?? ""

        imageURLs = Self.fetchIconName(plistDictionary: plistDictionary)
			.sorted(by: >)
			.compactMap { Bundle(url: url)?.urlForImageResource($0) }

        dataFolderURL = URL(string: application.dataFolderPath ?? "")
        firstAppGroupFolderURL = URL(string: application.appGroupsFolderPaths?.first?.value ?? "")
        bundleURL = URL(string: application.bundlePath)
    }

	var icon: NSImage? {
		guard let imageURLs else { return nil }

		for iconURL in imageURLs {
			if let iconImage = NSImage(contentsOf: iconURL) {
				return iconImage
			}
		}

		return nil
	}

    private static func fetchIconName(plistDictionary: NSDictionary?) -> [String] {
		guard let plistDictionary else { return [] }

		var iconFilesNames = iconsList(plistDictionary: plistDictionary)

		if iconFilesNames.isEmpty {
			iconFilesNames = iconsList(plistDictionary: plistDictionary, platformIdentifier: "~ipad")

			// If empty, check for CFBundleIconFiles (since 3.2)
			if iconFilesNames.isEmpty, let iconFiles = plistDictionary["CFBundleIconFiles"] as? [String] {
				iconFilesNames = iconFiles
			}
		}

		if iconFilesNames.isNotEmpty {
			// Search some patterns for primary app icon
			for match in ["76", "60"] {
				let result = iconFilesNames.filter { $0.contains(match) }

				if result.isNotEmpty {
					return result
				}
			}

			return iconFilesNames
		}

		// Check for CFBundleIconFile (legacy, before 3.2)
		if let iconFileName = plistDictionary["CFBundleIconFile"] as? String {
			return [iconFileName]
		}

		return []
    }

	private static func iconsList(plistDictionary: NSDictionary?, platformIdentifier: String = "") -> [String] {
        let scaleSuffixes: [String] = ["@2x", "@3x"]

        guard
            let plistDictionary = plistDictionary,
            let iconsDictionary = plistDictionary["CFBundleIcons\(platformIdentifier)"] as? NSDictionary,
            let primaryIconDictionary = iconsDictionary["CFBundlePrimaryIcon"] as? NSDictionary,
            let iconFilesNames = primaryIconDictionary["CFBundleIconFiles"] as? [String]
            else {
                return []
            }

        var fullIconNames = [String]()

        iconFilesNames.forEach { iconFileName in
            scaleSuffixes.forEach { scaleSuffix in
                fullIconNames.append(iconFileName+scaleSuffix+platformIdentifier)
            }
        }

        return fullIconNames
    }
}

```

### Core Architecture Module: `ControlRoom/Controllers/ApplicationType.swift`
```
//
//  ApplicationType.swift
//  ControlRoom
//
//  Created by Mario on 15/02/2020.
//  Copyright © 2020 Paul Hudson. All rights reserved.
//

import Foundation

enum ApplicationType: String, Decodable {
    case user = "User"
    case system = "System"
}

```

### Core Architecture Module: `ControlRoom/Controllers/CaptureController.swift`
```
//
//  CaptureController.swift
//  ControlRoom
//
//  Created by Paul Hudson on 10/05/2023.
//  Copyright © 2023 Paul Hudson. All rights reserved.
//

import SwiftUI

/// Handles all screenshotting and video creation.
class CaptureController: ObservableObject {
    /// The user's settings for capturing
  @AppStorage("captureSettings") var settings = CaptureSettings(imageFormat: .png, videoFormat: .h264, display: .internal, mask: .ignored, saveURL: .desktop)

    /// The currently active recording process, if it exists. We don't need to monitor this, just keep it alive.
    @Published var recordingProcess: Process?

    /// The name of the file we're writing to, used at first in a temporary directory then on the desktop.
    @Published var recordingFilename = ""

    /// The export format description to be shown while exporting
    @Published var exportDescription = ""

    /// Converting MP4 to GIF takes time, so this tracks the progress of the operation
    @Published var exportProgress: CGFloat = 1.0

    private var videoFormat = SimCtl.IO.VideoFormat.h264

    var imageFormatString: String {
        settings.imageFormat.rawValue.uppercased()
    }

    var videoFormatString: String {
        settings.videoFormat.name
    }

    @MainActor
    /// Takes a screenshot of the device's current screen and saves it to the desktop.
    func takeScreenshot(of simulator: Simulator, format: SimCtl.IO.ImageFormat? = nil) {
        // If the user asked for a specific format then use it, otherwise
        // use whatever is our default.
        let resolvedFormat = format ?? settings.imageFormat

        // The filename where we intend to save this image
        let filename = makeScreenshotFilename(format: resolvedFormat)

        SimCtl.saveScreenshot(simulator.id, to: filename.path(), type: resolvedFormat, display: settings.display, with: settings.mask) { result in

            if UserDefaults.standard.bool(forKey: "renderChrome") {
                if let image = NSImage(contentsOf: filename) {
                    Task { @MainActor in
                        if let renderer = try? ChromeRenderer(deviceName: simulator.name, screenshot: image) {
                            let result = renderer.makeImage()

                            if let tiff = result?.tiffRepresentation {
                                let bitmap = NSBitmapImageRep(data: tiff)
                                if let compressedBitmap = bitmap?.representation(using: resolvedFormat.nsFileType, properties: [:]) {
                                    try FileManager.default.removeItem(at: filename)
                                    try compressedBitmap.write(to: filename)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    /// Creates a filename for a screenshot that ought to be unique
    func makeScreenshotFilename(format: SimCtl.IO.ImageFormat) -> URL {
        let formatter = DateFormatter()
        formatter.dateFormat = "y-MM-dd-HH-mm-ss"

        let dateString = formatter.string(from: Date.now)

      return settings.saveURL.url.appending(path: "ControlRoom-\(dateString).\(format.rawValue)")
    }

    /// Starts recording video of the device, saving it to the desktop.
    func startRecordingVideo(of simulator: Simulator, format: SimCtl.IO.VideoFormat? = nil) {
        // Store the format we've been asked to record in, so we can export to GIF
        // correctly later on.
        videoFormat = format ?? settings.videoFormat

        recordingFilename = makeVideoFilename()

        let tempPath = FileManager.default.temporaryDirectory.appendingPathComponent(recordingFilename).path

        recordingProcess = SimCtl.startVideo(simulator.id, to: tempPath, type: .h264, display: settings.display, with: settings.mask)
    }

    func stopRecordingVideo() {
        recordingProcess?.interrupt()
        recordingProcess?.waitUntilExit()
        recordingProcess = nil

        let sourceURL = FileManager.default.temporaryDirectory.appendingPathComponent(recordingFilename)

        let savePath = settings.saveURL.url.appendingPathComponent(recordingFilename).path

        let format = videoFormat.name

        if format.hasPrefix("GIF") {
            exportGif(format, savePath, sourceURL)
        } else if format.contains("Compressed") {
            exportCompressedVideo(savePath, sourceURL)
        } else {
            try? FileManager.default.moveItem(atPath: sourceURL.path, toPath: savePath)
        }
    }

    /// Saves recorded video as a GIF-file
    private func exportGif(_ format: String, _ savePath: String, _ sourceURL: URL) {
        let size: CGFloat?

        if format.contains("Small") {
            size = 400
        } else if format.contains("Medium") {
            size = 800
        } else if format.contains("Large") {
            size = 1200
        } else {
            size = 1600
        }

        let gifExtension = savePath.replacingOccurrences(of: ".mp4", with: ".gif")

        exportDescription = "GIF"

        Task {
            let result = try await sourceURL.convertToGIF(maxSize: size) { [weak self] progress in
                self?.exportProgress = progress
            }

            switch result {
            case .success(let gifURL):
                try? FileManager.default.moveItem(atPath: gifURL.path, toPath: gifExtension)
            case .failure(let reason):
                print(reason.localizedDescription)
            }
        }
    }

    /// Compresses recorded video with `ffmpeg` before saving
    private func exportCompressedVideo(_ savePath: String, _ sourceURL: URL) {
        guard FFMPEGConverter.available else {
            try? FileManager.default.moveItem(atPath: sourceURL.path, toPath: savePath)
            print("The 'ffmpeg' isn't available.")
            return
        }

        let convertPath = sourceURL.path.appending("-compressed.mp4")
        exportDescription = "Compressed Video"
        exportProgress = 0.0
        FFMPEGConverter.convert(input: sourceURL.path, output: convertPath) { [weak self] result in
            self?.exportProgress = 1.0
            switch result {
            case .success:
                try? FileManager.default.moveItem(atPath: convertPath, toPath: savePath)
            case .failure(let reason):
                print(reason.localizedDescription)
            }
        }
    }

    /// Creates a filename for a video that ought to be unique
    func makeVideoFilename() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "y-MM-dd-HH-mm-ss"

        let dateString = formatter.string(from: Date.now)

        return "ControlRoom-\(dateString).mp4"
    }
}

```

### Core Architecture Module: `ControlRoom/Controllers/ColorHistoryController.swift`
```
//
//  ColorHistoryController.swift
//  ControlRoom
//
//  Created by Paul Hudson on 16/05/2023.
//  Copyright © 2023 Paul Hudson. All rights reserved.
//

import SwiftUI

/// Loads, manages, and saves the user's collection of picked colors.
class ColorHistoryController: ObservableObject {
    /// The list of colors the user has picked over time.
    @Published private(set) var colors: [PickedColor]

    /// The UserDefaults key where we save our picked colors.
    private let defaultsKey = "CRColorHistory"

    /// Attempts to load saved colors from UserDefaults, or creates an empty array otherwise.
    init() {
        if let data = UserDefaults.standard.data(forKey: defaultsKey) {
            if let decoded = try? JSONDecoder().decode([PickedColor].self, from: data) {
                colors = decoded
                return
            }
        }

        colors = []
    }

    /// Writes the user's picked colors to UserDefaults.
    private func save() {
        if let encoded = try? JSONEncoder().encode(colors) {
            UserDefaults.standard.set(encoded, forKey: defaultsKey)
        }
    }

    /// Creates a new PickedColor instance from an NSColor, adds it to the start of the array
    /// so it appears immediately in the UI, then triggers a save.
    /// - Parameters:
    ///   - color: The NSColor we want to create
    /// - Returns: A PickedColor instance if it could be created.
    func add(_ color: NSColor?) -> PickedColor? {
        guard let color else { return nil }
        guard let pickedColor = PickedColor(from: color) else { return nil }

        colors.insert(pickedColor, at: 0)
        save()

        return pickedColor
    }

    /// Deletes a picked color instance based on its ID.
    /// - Parameter itemID: The identifier of the color we want to delete.
    func delete(_ itemID: PickedColor.ID?) {
        guard let itemID else { return }

        colors.removeAll { color in
            color.id == itemID
        }

        save()
    }

    /// Returns a picked color instance based on its ID.
    /// - Parameter itemID: The identifier of the color we want to return.
    /// - Returns: The PickedColor instance with the request ID, if it could be found.
    func item(with itemID: PickedColor.ID?) -> PickedColor? {
        guard let itemID else { return nil }

        return colors.first { color in
            color.id == itemID
        }
    }
}

```

### Core Architecture Module: `ControlRoom/Controllers/DeepLinksController.swift`
```
//
//  DeepLinksController.swift
//  ControlRoom
//
//  Created by Paul Hudson on 16/05/2023.
//  Copyright © 2023 Paul Hudson. All rights reserved.
//

import Foundation

/// Loads, manages, and saves the user's collection of deep links
class DeepLinksController: ObservableObject {
    /// The list of links the user has created, sorted however they want.
    @Published private(set) var links: [DeepLink]

    /// The UserDefaults key where we save our links.
    private let defaultsKey = "CRDeepLinks"

    /// Attempts to load saved links from UserDefaults, or creates an empty array otherwise.
    init() {
        if let data = UserDefaults.standard.data(forKey: defaultsKey) {
            if let decoded = try? JSONDecoder().decode([DeepLink].self, from: data) {
                links = decoded
                return
            }
        }

        links = []
    }

    /// Writes the user's deep links to UserDefaults.
    private func save() {
        if let encoded = try? JSONEncoder().encode(links) {
            UserDefaults.standard.set(encoded, forKey: defaultsKey)
        }
    }

    /// Creates a new DeepLink instance from a name and URL string.
    /// - Parameters:
    ///   - name: The user's name for this link.
    ///   - url: The stringified URL to load, already prefixed with a schema.
    func create(name: String, url: String) {
        if let verifiedURL = URL(string: url) {
            let link = DeepLink(id: UUID(), name: name, url: verifiedURL)
            links.append(link)
            save()
        }
    }

    /// Updates an existing DeepLink with the new name and URL. No changes are made if the `itemID` is `nil`, a matching
    /// DeepLink cannot be found or if the new stringified URL fails construction as a `URL`.
    /// - Parameters:
    ///   - itemID: The identifier of the link that needs to be updated.
    ///   - name: The updated name for this link.
    ///   - url: The updated stringified URL for the deep link.
    func edit(_ itemID: DeepLink.ID?, name: String, url: String) {
        guard
            let itemID,
            let index = links.firstIndex(where: { $0.id == itemID }),
            let verifiedURL = URL(string: url)
        else {
            return
        }

        var link = links[index]
        link.name = name
        link.url = verifiedURL
        links[index] = link

        save()
    }

    /// Deletes a DeepLink instance based on its ID.
    /// - Parameter itemID: The identifier of the link we want to delete.
    func delete(_ itemID: DeepLink.ID?) {
        guard let itemID else { return }

        links.removeAll { link in
            link.id == itemID
        }

        save()
    }

    /// Sorts the user's deep links using name or URL, then saves that order so it takes
    /// effect everywhere deep links are shown.
    /// - Parameter comparator: The sort order to use.
    func sort(using comparator: [KeyPathComparator<DeepLink>]) {
        links.sort(using: comparator)
        save()
    }

    /// Finds the first deep link matching the desired DeepLink.ID
    /// - Parameter itemID: The identifier to search for.
    /// - Returns: The first matching DeepLink if one is found. Returns `nil` if no matching link is found or if
    /// `itemID` parameter is `nil`.
    func link(_ itemID: DeepLink.ID?) -> DeepLink? {
        guard let itemID else { return nil }

        return links.first(where: { $0.id == itemID })
    }
}

```

### Core Architecture Module: `ControlRoom/Controllers/KeyboardShortcuts.swift`
```
//
//  KeyboardShortcuts.swift
//  ControlRoom
//
//  Created by Paul Hudson on 28/01/2021.
//  Copyright © 2021 Paul Hudson. All rights reserved.
//

import KeyboardShortcuts

extension KeyboardShortcuts.Name {
    static let resendLastPushNotification = Self("resendLastPushNotification", default: .init(.p, modifiers: [.control, .option, .command]))

    static let restartLastSelectedApp = Self("restartLastSelectedApp", default: .init(.r, modifiers: [.control, .option, .command]))

    static let reopenLastURL = Self("reopenLastURL", default: .init(.u, modifiers: [.control, .option, .command]))
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #61** (2020-02-20): **App crashes when selecting the default simulator**
  *Symptoms*: Steps to reproduce: - Make sure "Show default simulator" option is turned on in the preference - Launch the app - Select the very first simulator item from the sidebar, i.e. the one reads "Default" - App crashes  It seems that the `selectedSimulators` property in `SimulatorsController` is unable to locate the selected simulator(s) when a simulator has "booted" as its udid. 
  **Post-Mortem & Fix Analysis**:
  > @dyang thank you for reporting this!
  > @davedelong Thanks for the quick fix!

- **Issue #46** (2020-04-03): **Location simulation doesn't work on Default simulator**
  *Symptoms*: The `Default` simulator has some issues with Location simulation (the tab with the map).  The hack we're using to toggle current user's simulated position is based on simulator's `udid` property, which is `booted` for the Default one.    We can work around this by checking if selected simulator's id is `booted` and then broadcast the location notification to all booted devices.  I'll try to put together a PR  note: related to #43 .

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

### Incident Patch 1: `c8c7d4cf` (2026-04-05)
**Commit Message**: Merge pull request #206 from Jack-sh1/fix/swift6-concurrency-and-retroactive-conformance

Fix Swift 6 concurrency warnings and retroactive conformance (#199)

**File**: `ControlRoom/Controllers/LocalSearchController.swift` (modified, +6/-5)
```diff
@@ -115,16 +115,17 @@ class LocalSearchController: NSObject, ObservableObject {
 /// Adds `MKLocalSearchCompleterDelegate` conformance so the controller can use the delegate's callback methods
 extension LocalSearchController: MKLocalSearchCompleterDelegate {
     /// Called if `MKLocalSearchCompleter` return valid results from a query string
-    func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
-        guard let callback else { return }
+    nonisolated func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
         let results = completer.results.map {
-            LocalSearchResult( result: $0 )
+            LocalSearchResult(result: $0)
+        }
+        Task { @MainActor [weak self] in
+            self?.callback?(results)
         }
-        callback(results)
     }
 
     /// Called if `MKLocalSearchCompleter` encounters an error
-    func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
+    nonisolated func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
         print(error)
     }
 }
```

**File**: `ControlRoom/Extensions/CLLocationCoordinate2D-Identifiable.swift` (modified, +8/-0)
```diff
@@ -9,8 +9,16 @@
 import CoreLocation
 import Foundation
 
+#if swift(>=5.10)
+extension CLLocationCoordinate2D: @retroactive Identifiable {
+    public var id: String {
+        "\(latitude)-\(longitude)"
+    }
+}
+#else
 extension CLLocationCoordinate2D: Identifiable {
     public var id: String {
         "\(latitude)-\(longitude)"
     }
 }
+#endif
\ No newline at end of file
```

---

### Incident Patch 2: `f0464560` (2026-04-03)
**Commit Message**: Fix Swift 6 concurrency warnings and retroactive conformance (#199)

- Mark MKLocalSearchCompleterDelegate methods as nonisolated in
  LocalSearchController to satisfy nonisolated protocol requirement,
  dispatching back to @MainActor where needed
- Add @retroactive attribute to CLLocationCoordinate2D's Identifiable
  conformance with backward compatibility for Swift < 5.10

**File**: `ControlRoom/Controllers/LocalSearchController.swift` (modified, +6/-5)
```diff
@@ -115,16 +115,17 @@ class LocalSearchController: NSObject, ObservableObject {
 /// Adds `MKLocalSearchCompleterDelegate` conformance so the controller can use the delegate's callback methods
 extension LocalSearchController: MKLocalSearchCompleterDelegate {
     /// Called if `MKLocalSearchCompleter` return valid results from a query string
-    func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
-        guard let callback else { return }
+    nonisolated func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
         let results = completer.results.map {
-            LocalSearchResult( result: $0 )
+            LocalSearchResult(result: $0)
+        }
+        Task { @MainActor [weak self] in
+            self?.callback?(results)
         }
-        callback(results)
     }
 
     /// Called if `MKLocalSearchCompleter` encounters an error
-    func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
+    nonisolated func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
         print(error)
     }
 }
```

**File**: `ControlRoom/Extensions/CLLocationCoordinate2D-Identifiable.swift` (modified, +8/-0)
```diff
@@ -9,8 +9,16 @@
 import CoreLocation
 import Foundation
 
+#if swift(>=5.10)
+extension CLLocationCoordinate2D: @retroactive Identifiable {
+    public var id: String {
+        "\(latitude)-\(longitude)"
+    }
+}
+#else
 extension CLLocationCoordinate2D: Identifiable {
     public var id: String {
         "\(latitude)-\(longitude)"
     }
 }
+#endif
\ No newline at end of file
```

---

### Incident Patch 3: `afc95ae7` (2025-10-15)
**Commit Message**: Merge pull request #204 from PerlBeforeSwine/fix/swiftlint_issues

Fixed linter errors, warnings, and rule definition

**File**: `.swiftlint.yml` (modified, +0/-2)
```diff
@@ -5,8 +5,6 @@ identifier_name:
 line_length:
   warning: 220
   error: 250
-identifier_name:
-  allowed_symbols: "_"
 
 disabled_rules:
   - non_optional_string_data_conversion
```

**File**: `ControlRoom/Controllers/SimCtl+Types.swift` (modified, +0/-1)
```diff
@@ -19,7 +19,6 @@ extension SimCtl {
     enum DeviceFamily: CaseIterable {
         case iPhone
         case iPad
-        // swiftlint:disable:next identifier_name
         case tv
         case watch
         case visionPro
```

**File**: `ControlRoom/Helpers/TypeIdentifier.swift` (modified, +0/-1)
```diff
@@ -17,7 +17,6 @@ struct TypeIdentifier: Hashable {
     static let watch = TypeIdentifier("com.apple.watch")
     static let vision = TypeIdentifier("com.apple.vision-pro")
 
-    // swiftlint:disable:next identifier_name
     static let tv = TypeIdentifier("com.apple.apple-tv")
 
     /// Default type identifiers to be used for unknown simulators
```

**File**: `ControlRoom/Simulator UI/ControlScreens/LocationVIew/LocationView.swift` (modified, +5/-5)
```diff
@@ -14,8 +14,8 @@ import CoreLocation
 struct LocationView: View {
     @ObservedObject var controller: SimulatorsController
     let simulator: Simulator
-    static let DEFAULT_LAT = 37.323056
-    static let DEFAULT_LNG = -122.031944
+    static let defaultLat = 37.323056
+    static let defaultLong = -122.031944
 
     /// Saved locations controller.
     @StateObject private var locationsController = LocationsController()
@@ -40,10 +40,10 @@ struct LocationView: View {
     /// Keeps track of which search item is being currently hovered over
     @State private var lastHoverId: UUID?
 
-    @State private var latitudeText = "\(DEFAULT_LAT)"
-    @State private var longitudeText = "\(DEFAULT_LNG)"
+    @State private var latitudeText = "\(defaultLat)"
+    @State private var longitudeText = "\(defaultLong)"
     /// The location that is being simulated
-    @State private var currentLocation = Location(id: UUID(), name: "", latitude: DEFAULT_LAT, longitude: DEFAULT_LNG)
+    @State private var currentLocation = Location(id: UUID(), name: "", latitude: defaultLat, longitude: defaultLong)
     @State private var pinnedLocation: CLLocationCoordinate2D?
 
     /// A randomly generated location offset from the currentLocation.
```

**File**: `ControlRoom/Simulator UI/ControlScreens/SystemView/SystemView.swift` (modified, +1/-1)
```diff
@@ -218,7 +218,7 @@ struct SystemView: View {
 
 		let launchSpec = LSLaunchURLSpec(appURL: unmanagedTerminalUrl, itemURLs: unmanagedFolderUrl, passThruParams: nil, launchFlags: [], asyncRefCon: nil)
 
-		withUnsafePointer(to: launchSpec) { (pointer: UnsafePointer<LSLaunchURLSpec>) -> Void in
+		_ = withUnsafePointer(to: launchSpec) { (pointer: UnsafePointer<LSLaunchURLSpec>) in
 			LSOpenFromURLSpec(pointer, nil)
 		}
 	}
```

---

### Incident Patch 4: `204cbee4` (2025-09-18)
**Commit Message**: Fixed linter errors, warnings, and rule definition

**File**: `.swiftlint.yml` (modified, +1/-2)
```diff
@@ -2,11 +2,10 @@ type_name:
   allowed_symbols: "_"
 identifier_name:
   min_length: 2
+  allowed_symbols: "_"
 line_length:
   warning: 220
   error: 250
-identifier_name:
-  allowed_symbols: "_"
 
 disabled_rules:
   - non_optional_string_data_conversion
```

**File**: `ControlRoom/Controllers/SimCtl+Types.swift` (modified, +0/-1)
```diff
@@ -19,7 +19,6 @@ extension SimCtl {
     enum DeviceFamily: CaseIterable {
         case iPhone
         case iPad
-        // swiftlint:disable:next identifier_name
         case tv
         case watch
         case visionPro
```

**File**: `ControlRoom/Helpers/TypeIdentifier.swift` (modified, +0/-1)
```diff
@@ -17,7 +17,6 @@ struct TypeIdentifier: Hashable {
     static let watch = TypeIdentifier("com.apple.watch")
     static let vision = TypeIdentifier("com.apple.vision-pro")
 
-    // swiftlint:disable:next identifier_name
     static let tv = TypeIdentifier("com.apple.apple-tv")
 
     /// Default type identifiers to be used for unknown simulators
```

**File**: `ControlRoom/Simulator UI/ControlScreens/SystemView/SystemView.swift` (modified, +1/-1)
```diff
@@ -218,7 +218,7 @@ struct SystemView: View {
 
 		let launchSpec = LSLaunchURLSpec(appURL: unmanagedTerminalUrl, itemURLs: unmanagedFolderUrl, passThruParams: nil, launchFlags: [], asyncRefCon: nil)
 
-		withUnsafePointer(to: launchSpec) { (pointer: UnsafePointer<LSLaunchURLSpec>) -> Void in
+		_ = withUnsafePointer(to: launchSpec) { (pointer: UnsafePointer<LSLaunchURLSpec>) in
 			LSOpenFromURLSpec(pointer, nil)
 		}
 	}
```

---

### Incident Patch 5: `72455db8` (2025-01-23)
**Commit Message**: Reset the local UI state when reseting status bar overrides

**File**: `ControlRoom/Simulator UI/ControlScreens/StatusBarView.swift` (modified, +7/-0)
```diff
@@ -157,6 +157,13 @@ struct StatusBarView: View {
 
     private func clearOverrides() {
         SimCtl.clearStatusBarOverrides(simulator.udid)
+        dataNetwork = .wifi
+        wiFiBar = .three
+        cellularMode = .active
+        cellularBar = .four
+        batteryLevel = 100.0
+        batteryState = .charged
+        carrierName = "Carrier"
     }
 
     /// Sends status bar updates all at once; simctl gets unhappy if we send them individually, but
```

---

### Incident Patch 6: `5bc6005f` (2024-12-24)
**Commit Message**: Merge pull request #192 from marcelmendesfilho/fix/simulator-boot

fix: #157 Simulator isn't visible on booting it from Control Room

**File**: `ControlRoom/Controllers/SimCtl.swift` (modified, +7/-1)
```diff
@@ -42,7 +42,13 @@ enum SimCtl: CommandLineCommandExecuter {
     }
 
     static func boot(_ simulator: Simulator) {
-        execute(.boot(simulator: simulator))
+        /// No need to check if Simulator app is already running since no second SImulator app will be spawned
+        SnapshotCtl.startSimulatorApp {
+            /// Wait for a little while Simulator app starts running, then proceed to boot simulator
+            DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
+                execute(.boot(simulator: simulator))
+            }
+        }
     }
 
     static func shutdown(_ simulator: String, completion: ((Result<Data, CommandLineError>) -> Void)? = nil) {
```

**File**: `ControlRoom/Controllers/SnapshotCtl+Commands.swift` (modified, +4/-0)
```diff
@@ -27,6 +27,10 @@ extension SnapshotCtl {
             Command("/bin/mkdir", arguments:["-p", "\(devicesPath)/\(snapshotsFolder)/\(deviceId)/\(snapshotName)"])
         }
         
+        /// Open app
+        static func open(app: String) -> Command {
+            Command("/usr/bin/open", arguments: ["-a", app])
+        }
     }
     
 }
```

**File**: `ControlRoom/Controllers/SnapshotCtl.swift` (modified, +7/-1)
```diff
@@ -93,10 +93,16 @@ enum SnapshotCtl: CommandLineCommandExecuter {
         }
     }
     
+    static func startSimulatorApp(completion: @escaping (() -> Void)) {
+        execute(.open(app: "Simulator.app")) { _ in
+            return completion()
+        }
+    }
+
     private static func getSnapshotAttributes(_ snapshotPath: String) -> URLFileAttribute {
         let snapshotURL: URL = URL(fileURLWithPath: snapshotPath)
         let snapshotAttributes = URLFileAttribute(url: snapshotURL)
         return snapshotAttributes
     }
-        
+    
 }
```

---

### Incident Patch 7: `3077f4a1` (2024-12-23)
**Commit Message**: fix: #157 Simulator isn't visible on booting it from Control Room

**File**: `ControlRoom/Controllers/SimCtl.swift` (modified, +7/-1)
```diff
@@ -42,7 +42,13 @@ enum SimCtl: CommandLineCommandExecuter {
     }
 
     static func boot(_ simulator: Simulator) {
-        execute(.boot(simulator: simulator))
+        /// No need to check if Simulator app is already running since no second SImulator app will be spawned
+        SnapshotCtl.startSimulatorApp {
+            /// Wait for a little while Simulator app starts running, then proceed to boot simulator
+            DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
+                execute(.boot(simulator: simulator))
+            }
+        }
     }
 
     static func shutdown(_ simulator: String, completion: ((Result<Data, CommandLineError>) -> Void)? = nil) {
```

**File**: `ControlRoom/Controllers/SnapshotCtl+Commands.swift` (modified, +4/-0)
```diff
@@ -27,6 +27,10 @@ extension SnapshotCtl {
             Command("/bin/mkdir", arguments:["-p", "\(devicesPath)/\(snapshotsFolder)/\(deviceId)/\(snapshotName)"])
         }
         
+        /// Open app
+        static func open(app: String) -> Command {
+            Command("/usr/bin/open", arguments: ["-a", app])
+        }
     }
     
 }
```

**File**: `ControlRoom/Controllers/SnapshotCtl.swift` (modified, +7/-1)
```diff
@@ -93,10 +93,16 @@ enum SnapshotCtl: CommandLineCommandExecuter {
         }
     }
     
+    static func startSimulatorApp(completion: @escaping (() -> Void)) {
+        execute(.open(app: "Simulator.app")) { _ in
+            return completion()
+        }
+    }
+
     private static func getSnapshotAttributes(_ snapshotPath: String) -> URLFileAttribute {
         let snapshotURL: URL = URL(fileURLWithPath: snapshotPath)
         let snapshotAttributes = URLFileAttribute(url: snapshotURL)
         return snapshotAttributes
     }
-        
+    
 }
```

---

### Incident Patch 8: `6cb13bb2` (2024-12-14)
**Commit Message**: fix: last minute parameter removal

**File**: `ControlRoom/Simulator UI/ControlScreens/SystemView/SystemView.swift` (modified, +1/-1)
```diff
@@ -232,7 +232,7 @@ struct SystemView_Previews: PreviewProvider {
     static var previews: some View {
 		let preferences = Preferences()
 
-		SystemView(simulator: .example, controller: SimulatorsController(preferences: preferences))
+		SystemView(simulator: .example)
 			.environmentObject(preferences)
     }
 }
```

**File**: `ControlRoom/Simulator UI/ControlView.swift` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ struct ControlView: View {
 
     var body: some View {
         TabView {
-            SystemView(simulator: simulator, controller: controller)
+            SystemView(simulator: simulator)
                 .disabled(simulator.state != .booted)
             SnapshotsView(simulator: simulator, controller: controller)
             Group {
```

---

### Incident Patch 9: `98dcd41f` (2024-06-20)
**Commit Message**: Workaround: Only set status bar time

**File**: `ControlRoom/Controllers/SimCtl.swift` (modified, +6/-1)
```diff
@@ -105,7 +105,12 @@ enum SimCtl: CommandLineCommandExecuter {
     }
 
     static func overrideStatusBarTime(_ simulator: String, time: Date) {
-        let timeString = ISO8601DateFormatter().string(from: time)
+        // Use only time for now since ISO8601 parsing is broken since Xcode 15.3
+        // https://stackoverflow.com/a/59071895
+        // let timeString = ISO8601DateFormatter().string(from: time)
+        let timeOnlyFormatter = DateFormatter()
+        timeOnlyFormatter.dateFormat = "hh:mm"
+        let timeString = timeOnlyFormatter.string(from: time)
         execute(.statusBar(deviceId: simulator, operation: .override([.time(timeString)])))
     }
     static func setAppearance(_ simulator: String, appearance: UI.Appearance) {
```

---

### Incident Patch 10: `2bd731ed` (2023-12-20)
**Commit Message**: Fix screenshot device chrome issue with Xcode 15

**File**: `ControlRoom/Controllers/ChromeRendering/ChromeRenderer.swift` (modified, +5/-1)
```diff
@@ -98,7 +98,11 @@ class ChromeRenderer {
         let mainIdentifier = device.chromeIdentifier.components(separatedBy: ".").last ?? "phone"
 
         // Now use that last part to find the PDFs and placement JSON.
-        let chromePath = "\(basePath)/Chrome/\(mainIdentifier).simdevicechrome/Contents/Resources"
+        var chromePath = "\(basePath)/Chrome/\(mainIdentifier).devicechrome/Contents/Resources"
+        if !FileManager.default.fileExists(atPath: chromePath) {
+            // Before Xcode 15, the path used `simdevicechrome`, not `devicechrome`, so fall back to that
+            chromePath = "\(basePath)/Chrome/\(mainIdentifier).simdevicechrome/Contents/Resources"
+        }
         baseURL = URL(filePath: chromePath)
 
         let chromeURL = URL(filePath: "\(chromePath)/chrome.json")
```

---

### Incident Patch 11: `9a37f749` (2023-11-28)
**Commit Message**: feat: turn methods private and fix text moving depending on number text from slider

feat: change indentation to spacebar

**File**: `ControlRoom/Simulator UI/ControlScreens/StatusBarView.swift` (modified, +39/-13)
```diff
@@ -110,8 +110,16 @@ struct StatusBarView: View {
                     .pickerStyle(.radioGroup)
 
                     VStack(spacing: 0) {
-                        Text("Current battery percentage: \(Int(round(batteryLevel)))%")
-                        Slider(value: $batteryLevel, in: 0...100, onEditingChanged: levelChanged, minimumValueLabel: Text("0%"), maximumValueLabel: Text("100%")) {
+						Text("Current battery percentage: \(Int(round(batteryLevel)))%")
+							.font(.callout.monospacedDigit())
+
+						Slider(
+							value: $batteryLevel,
+							in: 0...100,
+							onEditingChanged: levelChanged,
+							minimumValueLabel: Text("0%"),
+							maximumValueLabel: Text("100%")
+						) {
                             Text("Level:")
                         }
                     }
@@ -125,12 +133,14 @@ struct StatusBarView: View {
         }
     }
 
+    // MARK: Private methods
+
     /// Changes the system clock to a new value.
-    func setTime() {
+    private func setTime() {
         SimCtl.overrideStatusBarTime(simulator.udid, time: time)
     }
 
-    func setAppleTime() {
+	private func setAppleTime() {
         let calendar = Calendar.current
         var components = calendar.dateComponents([.year, .month, .day], from: Date.now)
         components.hour = 9
@@ -145,36 +155,52 @@ struct StatusBarView: View {
 
     /// Sends status bar updates all at once; simctl gets unhappy if we send them individually, but
     /// also for whatever reason prefers cellular data sent separately from WiFi.
-    func updateWiFiData() {
-        SimCtl.overrideStatusBarWiFi(simulator.udid, network: dataNetwork,
-                                        wifiMode: wiFiMode, wifiBars: wiFiBar)
+	private func updateWiFiData() {
+		SimCtl.overrideStatusBarWiFi(
+			simulator.udid,
+			network: dataNetwork,
+			wifiMode: wiFiMode,
+			wifiBars: wiFiBar
+		)
     }
 
-    func updateCellularData() {
-        SimCtl.overrideStatusBarCellular(simulator.udid, cellMode: cellularMode,
-                                        cellBars: cellularBar, carrier: carrierName)
+    private func updateCellularData() {
+		SimCtl.overrideStatusBarCellular(
+			simulator.udid,
+			cellMode: cellularMode,
+			cellBars: cellularBar,
+			carrier: carrierName
+		)
     }
 
     /// Sends battery updates all at once; simctl gets unhappy if we send them individually.
-    func updateBattery() {
-        SimCtl.overrideStatusBarBattery(simulator.udid, level: Int(batteryLevel), state: batteryState)
+    private func updateBattery() {
+		SimCtl.overrideStatusBarBattery(
+			simulator.udid,
+			level: Int(batteryLevel),
+			state: batteryState
+		)
     }
 
     /// Triggered when the user adjusts the battery level.
-    func levelChanged(_ isEditing: Bool) {
+    private func levelChanged(_ isEditing: Bool) {
         if isEditing == false {
             updateBattery()
         }
     }
 }
 
+// MARK: Preview
+
 struct StatusBarViewView_Previews: PreviewProvider {
     static var previews: some View {
         StatusBarView(simulator: .example)
             .environmentObject(Preferences())
     }
 }
 
+// MARK: Extensions
+
 extension SimCtl.StatusBar.DataNetwork {
     var displayName: String {
         switch self {
```

---

### Incident Patch 12: `3bae091a` (2023-09-24)
**Commit Message**: Add basic build and test CI configuration

**File**: `.github/workflows/ci.yml` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+name: Xcode - Build and Test
+    
+on: [pull_request]
+
+jobs:
+  build:
+    name: 'Build and test: Debug'
+    runs-on: macos-13
+
+    steps:
+      - name: Checkout
+        uses: actions/checkout@v3
+      - name: Selected Xcode version 
+        run: |
+          xcode-select -p
+      - name: Build and test
+        run: |
+          xcodebuild clean build analyze test -project ControlRoom.xcodeproj -scheme 'Debug - ControlRoom' -destination 'platform=macOS' CONFIGURATION_BUILD_DIR=$(pwd)/build CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED=NO | xcpretty
\ No newline at end of file
```

---

### Incident Patch 13: `0d85c76c` (2023-09-21)
**Commit Message**: fix(ColorsView): Wrap actor-isolated method in Task initializer

- Resolve runtime error by wrapping `assetCatalogData(for:)` in `Task` initializer to ensure it's called asynchronously in an actor's context in `ColorsView`.
- Tested on macOS 13.5.2 (22G91) and Xcode 15.0 (15A240d), with no SwiftLint warnings or errors.

**File**: `ControlRoom/Simulator UI/ControlScreens/ColorsView.swift` (modified, +4/-1)
```diff
@@ -99,7 +99,10 @@ struct ColorsView: View {
                     TableRow(color)
                         .itemProvider {
                             let provider = NSItemProvider()
-                            provider.register(assetCatalogData(for: color))
+                            Task {
+                                    let catalogData = assetCatalogData(for: color)
+                                    provider.register(catalogData)
+                            }
                             return provider
                         }
                 }
```

---

### Incident Patch 14: `9ccfaaf3` (2023-05-17)
**Commit Message**: Removing Objective-C code that was causing crashes.

**File**: `ControlRoom.xcodeproj/project.pbxproj` (modified, +0/-22)
```diff
@@ -57,9 +57,7 @@
 		5534157E23FE04FA005C0A41 /* AboutView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 5534157D23FE04FA005C0A41 /* AboutView.swift */; };
 		5534158223FE0539005C0A41 /* Contributors.swift in Sources */ = {isa = PBXBuildFile; fileRef = 5534158123FE0539005C0A41 /* Contributors.swift */; };
 		5534158623FE1AC4005C0A41 /* Flow.swift in Sources */ = {isa = PBXBuildFile; fileRef = 5534158523FE1AC4005C0A41 /* Flow.swift */; };
-		555A145723F707E700313BC5 /* CoreSimulator.m in Sources */ = {isa = PBXBuildFile; fileRef = 555A145623F707E700313BC5 /* CoreSimulator.m */; };
 		555A145C23F70CCF00313BC5 /* Process.swift in Sources */ = {isa = PBXBuildFile; fileRef = 555A145B23F70CCF00313BC5 /* Process.swift */; };
-		555A145E23F70E8600313BC5 /* CoreSimulatorPublisher.swift in Sources */ = {isa = PBXBuildFile; fileRef = 555A145D23F70E8600313BC5 /* CoreSimulatorPublisher.swift */; };
 		55AF68B523F9CFD600C5D87A /* SettingsView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 55AF68B423F9CFD600C5D87A /* SettingsView.swift */; };
 		55AF68B723F9D2E200C5D87A /* UIState.swift in Sources */ = {isa = PBXBuildFile; fileRef = 55AF68B623F9D2E200C5D87A /* UIState.swift */; };
 		55AF68B923F9D32100C5D87A /* MainWindowController.swift in Sources */ = {isa = PBXBuildFile; fileRef = 55AF68B823F9D32100C5D87A /* MainWindowController.swift */; };
@@ -143,12 +141,8 @@
 		5534157D23FE04FA005C0A41 /* AboutView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AboutView.swift; sourceTree = "<group>"; };
 		5534158123FE0539005C0A41 /* Contributors.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Contributors.swift; sourceTree = "<group>"; };
 		5534158523FE1AC4005C0A41 /* Flow.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Flow.swift; sourceTree = "<group>"; };
-		555A145423F707E700313BC5 /* ControlRoom-Bridging-Header.h */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.c.h; path = "ControlRoom-Bridging-Header.h"; sourceTree = "<group>"; };
-		555A145523F707E700313BC5 /* CoreSimulator.h */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.c.h; path = CoreSimulator.h; sourceTree = "<group>"; };
-		555A145623F707E700313BC5 /* CoreSimulator.m */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.c.objc; path = CoreSimulator.m; sourceTree = "<group>"; };
 		555A145923F70A5100313BC5 /* CoreSimulator.framework */ = {isa = PBXFileReference; lastKnownFileType = wrapper.framework; name = CoreSimulator.framework; path = /Library/Developer/PrivateFrameworks/CoreSimulator.framework; sourceTree = "<absolute>"; };
 		555A145B23F70CCF00313BC5 /* Process.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Process.swift; sourceTree = "<group>"; };
-		555A145D23F70E8600313BC5 /* CoreSimulatorPublisher.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = CoreSimulatorPublisher.swift; sourceTree = "<group>"; };
 		55AF68B423F9CFD600C5D87A /* SettingsView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SettingsView.swift; sourceTree = "<group>"; };
 		55AF68B623F9D2E200C5D87A /* UIState.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = UIState.swift; sourceTree = "<group>"; };
 		55AF68B823F9D32100C5D87A /* MainWindowController.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = MainWindowController.swift; sourceTree = "<group>"; };
@@ -222,7 +216,6 @@
 				511BA5D123F4567C00E3E660 /* Helpers */,
 				AC472CCD240D46C2007FF521 /* Extensions */,
 				511BA5CF23F455D500E3E660 /* NSViewWrappers */,
-				555A145323F707D900313BC5 /* Objective-C */,
 				511BA5D023F455E100E3E660 /* SystemBits */,
 			);
 			path = ControlRoom;
@@ -349,16 +342,6 @@
 			path = "About UI";
 			sourceTree = "<group>";
 		};
-		555A145323F707D900313BC5 /* Objective-C */ = {
-			isa = PBXGroup;
-			children = (
-				555A145423F707E700313BC5 /* ControlRoom-Bridging-Header.h */,
-				555A145523F707E700313BC5 /* CoreSimulator.h */,
-				555A145623F707E700313BC5 /* CoreSimulator.m */,
-			);
-			path = "Objective-C";
-			sourceTree = "<group>";
-		};
 		555A145823F70A5100313BC5 /* Frameworks */ = {
 			isa = PBXGroup;
 			children = (
@@ -399,7 +382,6 @@
 				ACDF076723F7E91A00597B3B /* ApplicationType.swift */,
 				51DCEFB32A0BC6B600561C9B /* CaptureController.swift */,
 				51AB56EA2A141C57002B5A67 /* ColorHistoryController.swift */,
-				555A145D23F70E8600313BC5 /* CoreSimulatorPublisher.swift */,
 				51AB56DF2A13D189002B5A67 /* DeepLinksController.swift */,
 				5179289925C37D2A000F6F3A /* KeyboardShortcuts.swift */,
 				5523A7E023F99D7200F25EEC /* Preferences.swift */,
@@ -649,7 +631,6 @@
 				70BE435A23F54B7200FD6282 /* LocationView.swift in Sources */,
 				ACD2064D2431F20000F8659B /* CommandLineExecuter.swift in Sources */,
 				5179289A25C37D2A000F6F3A /* KeyboardShortcuts.swift in Sources 
```

**File**: `ControlRoom/About UI/Contributors.swift` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
 //  Copyright © 2020 Paul Hudson. All rights reserved.
 //
 
-import Swift
+import Foundation
 
 struct Author: Decodable, Identifiable {
     let login: String
```

**File**: `ControlRoom/Controllers/CoreSimulatorPublisher.swift` (removed, +0/-54)
```diff
@@ -1,54 +0,0 @@
-//
-//  CoreSimulatorPublisher.swift
-//  ControlRoom
-//
-//  Created by Dave DeLong on 2/14/20.
-//  Copyright © 2020 Paul Hudson. All rights reserved.
-//
-
-import Combine
-
-enum CoreSimulatorError: Error {
-    case missingFramework
-}
-
-// Thanks to @avanderlee for this great overview: https://www.avanderlee.com/swift/custom-combine-publisher/
-
-/// A custom subscription to monitor for notifications from CoreSimulator.
-final class CoreSimulatorSubscription<SubscriberType: Subscriber>: Subscription where SubscriberType.Input == Void, SubscriberType.Failure == CoreSimulatorError {
-    private var token: UInt?
-
-    init(subscriber: SubscriberType) {
-        let registrationToken = CoreSimulator.register {
-            _ = subscriber.receive()
-        }
-
-        if registrationToken == NSNotFound {
-            token = nil
-            subscriber.receive(completion: .failure(CoreSimulatorError.missingFramework))
-        } else {
-            token = registrationToken
-        }
-    }
-
-    func request(_ demand: Subscribers.Demand) {
-        // We do nothing here as we only want to send events when they occur.
-        // See, for more info: https://developer.apple.com/documentation/combine/subscribers/demand
-    }
-
-    func cancel() {
-        if let token {
-            CoreSimulator.unregister(fromSimulatorNotifications: token)
-        }
-    }
-}
-
-struct CoreSimulatorPublisher: Publisher {
-    typealias Output = Void
-    typealias Failure = CoreSimulatorError
-
-    func receive<S>(subscriber: S) where S: Subscriber, S.Input == CoreSimulatorPublisher.Output, S.Failure == CoreSimulatorPublisher.Failure {
-        let subscription = CoreSimulatorSubscription(subscriber: subscriber)
-        subscriber.receive(subscription: subscription)
-    }
-}
```

**File**: `ControlRoom/Controllers/SimCtl.swift` (modified, +7/-16)
```diff
@@ -16,22 +16,13 @@ enum SimCtl: CommandLineCommandExecuter {
     static let launchPath = "/usr/bin/xcrun"
 
     static func watchDeviceList() -> AnyPublisher<DeviceList, SimCtl.Error> {
-        if CoreSimulator.canRegisterForSimulatorNotifications {
-            return CoreSimulatorPublisher()
-                .mapError { _ in return SimCtl.Error.missingCommand }
-                .flatMap { _ in return SimCtl.listDevices() }
-                .prepend(SimCtl.listDevices())
-                .removeDuplicates()
-                .eraseToAnyPublisher()
-        } else {
-            return Timer.publish(every: 5, on: .main, in: .common)
-                .autoconnect()
-                .setFailureType(to: SimCtl.Error.self)
-                .flatMap { _ in return SimCtl.listDevices() }
-                .prepend(SimCtl.listDevices())
-                .removeDuplicates()
-                .eraseToAnyPublisher()
-        }
+        Timer.publish(every: 5, on: .main, in: .common)
+            .autoconnect()
+            .setFailureType(to: SimCtl.Error.self)
+            .flatMap { _ in return SimCtl.listDevices() }
+            .prepend(SimCtl.listDevices())
+            .removeDuplicates()
+            .eraseToAnyPublisher()
     }
 
     static func listDeviceTypes() -> AnyPublisher<DeviceTypeList, SimCtl.Error> {
```

**File**: `ControlRoom/Objective-C/ControlRoom-Bridging-Header.h` (removed, +0/-5)
```diff
@@ -1,5 +0,0 @@
-//
-//  Use this file to import your target's public headers that you would like to expose to Swift.
-//
-
-#import "CoreSimulator.h"
```

**File**: `ControlRoom/Objective-C/CoreSimulator.h` (removed, +0/-24)
```diff
@@ -1,24 +0,0 @@
-//
-//  CoreSimulator.h
-//  ControlRoom
-//
-//  Created by Dave DeLong on 2/14/20.
-//  Copyright © 2020 Paul Hudson. All rights reserved.
-//
-
-#import <Foundation/Foundation.h>
-
-NS_ASSUME_NONNULL_BEGIN
-
-@interface CoreSimulator: NSObject
-
-@property (class, readonly) BOOL canRegisterForSimulatorNotifications;
-
-+ (NSUInteger)registerForSimulatorNotifications:(void(^)(void))handler;
-+ (void)unregisterFromSimulatorNotifications:(NSUInteger)token;
-
-- (instancetype)init NS_UNAVAILABLE;
-
-@end
-
-NS_ASSUME_NONNULL_END
```

**File**: `ControlRoom/Objective-C/CoreSimulator.m` (removed, +0/-77)
```diff
@@ -1,77 +0,0 @@
-//
-//  CoreSimulator.m
-//  ControlRoom
-//
-//  Created by Dave DeLong on 2/14/20.
-//  Copyright © 2020 Paul Hudson. All rights reserved.
-//
-
-#import "CoreSimulator.h"
-#import "Control_Room-Swift.h"
-
-/*
- This file uses private API in the CoreSimulator framework, which is located at /Library/Developer/PrivateFrameworks.
-
- The build settings for the project are modified to look inside /Library/Developer/PrivateFrameworks when linking,
- and they also specify to *weakly* link in CoreSimulator (ie, it's an "optional" framework).
-
- This means that if the app is run on a system that does not have CoreSimulator, then the symbols we need from it
- will all be nil.
-
- This allows us to dynamically check for the framework's existence (using NSClassFromString),
- and alter our behavior in the case that the framework is not properly loaded.
- */
-
-/// A protocol to describe a "SimDeviceSet"
-///
-/// This is a class defined in CoreSimulator.framework that notifies registrants of changes to the simulators
-@protocol SimDeviceSet_Protocol <NSObject>
-- (NSUInteger)registerNotificationHandler:(void (^_Nonnull)(NSDictionary *))handler;
-- (void)unregisterNotificationHandler:(NSUInteger)token error:(NSError **)error;
-@end
-
-/// A protocol to describe a "SimServiceContext"
-///
-/// This is how we can retrieve the SimDeviceSet
-@protocol SimServiceContext_Protocol <NSObject>
-+ (instancetype)sharedServiceContextForDeveloperDir:(NSString *)developerDirectory error:(NSError **)error;
-- (id<SimDeviceSet_Protocol>)defaultDeviceSetWithError:(NSError **)error;
-@end
-
-id<SimDeviceSet_Protocol> deviceSet(void) {
-    static id<SimDeviceSet_Protocol> set;
-    static dispatch_once_t onceToken;
-    dispatch_once(&onceToken, ^{
-        // run `xcode-select -p` to get the active developer directory
-        NSData *select = [NSTask execute:@"/usr/bin/xcode-select" arguments:@[@"-p"]];
-        if (select == nil) { return; }
-
-        NSString *developerDir = [[NSString alloc] initWithData:select encoding:NSUTF8StringEncoding];
-
-        // if CoreSimulator isn't loaded, this will return nil
-        id<SimServiceContext_Protocol> context = [NSClassFromString(@"SimServiceContext") sharedServiceContextForDeveloperDir:developerDir error:nil];
-        set = [context defaultDeviceSetWithError:nil];
-    });
-    return set;
-}
-
-@implementation CoreSimulator
-
-+ (BOOL)canRegisterForSimulatorNotifications {
-    return deviceSet() != nil;
-}
-
-+ (NSUInteger)registerForSimulatorNotifications:(void (^)(void))handler {
-    if (self.canRegisterForSimulatorNotifications == NO) { return NSNotFound; }
-    return [deviceSet() registerNotificationHandler:^(id info) {
-        handler();
-    }];
-}
-
-+ (void)unregisterFromSimulatorNotifications:(NSUInteger)token {
-    [deviceSet() unregisterNotificationHandler:token error:nil];
-}
-
-@end
-
-
```

---

### Incident Patch 15: `888df1e4` (2023-05-11)
**Commit Message**: reverted indentation

**File**: `ControlRoom/Simulator UI/ControlScreens/LocationView.swift` (modified, +96/-96)
```diff
@@ -12,108 +12,108 @@ import CoreLocation
 
 /// Map view to change simulated user's position
 struct LocationView: View {
-  @ObservedObject var controller: SimulatorsController
-  let simulator: Simulator
-
-  @State private var latitudeText = "37.323056"
-  @State private var longitudeText = "-122.031944"
-  /// The location that is being simulated
-  @State private var currentLocation = MKCoordinateRegion(
-    center: CLLocationCoordinate2D(latitude: 37.323056, longitude: -122.031944),
-    span: MKCoordinateSpan(latitudeDelta: 15, longitudeDelta: 15))
-  @State private var pinnedLocation: CLLocationCoordinate2D?
-
-  /// A randomly generated location offset from the currentLocation.
-  /// Non-nil only when jittering is enabled.
-  @State private var jitteredLocation: CLLocationCoordinate2D?
-
-  @State private var isJittering: Bool = false
-  private let jitterTimer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()
-
-  var annotations: [CLLocationCoordinate2D] {
-    if let pinnedLocation = pinnedLocation {
-      return [pinnedLocation]
-    } else {
-      return []
-    }
-  }
-
-  /// User-facing text describing `currentLocation`
-  var locationText: String {
-    let location = jitteredLocation ?? currentLocation.center
-    return String(format: "%.5f, %.5f", location.latitude, location.longitude)
-  }
-
-  var body: some View {
-    Form {
-      VStack {
-        Text("Move the map wherever you want, then click Activate to update the simulator to match your centered coordinate.")
-        HStack(spacing: 10.0) {
-          TextField("Latitude", text: $latitudeText)
-            .textFieldStyle(.roundedBorder)
-
-          TextField("Longitude", text: $longitudeText)
-            .textFieldStyle(.roundedBorder)
-        }
-        Button("Update coordinates") {
-          if let latitude = Double(latitudeText),
-             let longitude = Double(longitudeText) {
-            self.currentLocation = MKCoordinateRegion(
-              center: CLLocationCoordinate2D(latitude: latitude, longitude: longitude),
-              span: MKCoordinateSpan(latitudeDelta: 15, longitudeDelta: 15))
-          }
+    @ObservedObject var controller: SimulatorsController
+    let simulator: Simulator
+
+    @State private var latitudeText = "37.323056"
+    @State private var longitudeText = "-122.031944"
+    /// The location that is being simulated
+    @State private var currentLocation = MKCoordinateRegion(
+        center: CLLocationCoordinate2D(latitude: 37.323056, longitude: -122.031944),
+        span: MKCoordinateSpan(latitudeDelta: 15, longitudeDelta: 15))
+    @State private var pinnedLocation: CLLocationCoordinate2D?
+
+    /// A randomly generated location offset from the currentLocation.
+    /// Non-nil only when jittering is enabled.
+    @State private var jitteredLocation: CLLocationCoordinate2D?
+
+    @State private var isJittering: Bool = false
+    private let jitterTimer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()
+
+    var annotations: [CLLocationCoordinate2D] {
+        if let pinnedLocation = pinnedLocation {
+            return [pinnedLocation]
+        } else {
+            return []
         }
+    }
 
-        ZStack {
-          Map(coordinateRegion: $currentLocation, annotationItems: annotations) { location in
-            MapMarker(coordinate: CLLocationCoordinate2D(latitude: location.latitude, longitude: location.longitude), tint: .red)
-          }
-          .cornerRadius(5)
+    /// User-facing text describing `currentLocation`
+    var locationText: String {
+        let location = jitteredLocation ?? currentLocation.center
+        return String(format: "%.5f, %.5f", location.latitude, location.longitude)
+    }
 
-          Circle()
-            .stroke(Color.blue, lineWidth: 4)
-            .frame(width: 20)
+    var body: some View {
+        Form {
+            VStack {
+                Text("Move the map wherever you want, then click Activate to update the simulator to match your centered coordinate.")
+                HStack(spacing: 10.0) {
+                    TextField("Latitude", text: $latitudeText)
+                        .textFieldStyle(.roundedBorder)
+
+                    TextField("Longitude", text: $longitudeText)
+                        .textFieldStyle(.roundedBorder)
+                }
+                Button("Update coordinates") {
+                    if let latitude = Double(latitudeText),
+                       let longitude = Double(longitudeText) {
+                        self.currentLocation = MKCoordinateRegion(
+                            center: CLLocationCoordinate2D(latitude: latitude, longitude: longitude),
+                            span: MKCoordinateSpan(latitudeDelta: 15, longitudeDelta: 15))
+                    }
+                }
+
+                ZStack {
+                    Map(coordinateRegion: $currentLocation, annotationItems: annotations) { location in
+                        MapMark
```

#### Recent Merged Pull Requests:
- **PR #206** (2026-04-05): Fix Swift 6 concurrency warnings and retroactive conformance (#199) (@elio-Wang)
- **PR #204** (2025-10-15): Fixed linter errors, warnings, and rule definition (@PerlBeforeSwine)
- **PR #200** (2025-05-02): suppress data <-> string lint rules (@sbeitzel)
- **PR #198** (2025-05-01): Remove redundant initializers (@sbeitzel)
- **PR #197** (2025-05-01): Add .editorconfig to help with formatting, clear whitespace warnings (@sbeitzel)
- **PR #195** (closed): Show preview and testing devices (@SeanRobinson159)
- **PR #194** (2025-04-21): Support For Arabic Localization (@Addallah)
- **PR #193** (2025-01-24): Add feature to clear the Status Bar overrides (@MultiColourPixel)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
