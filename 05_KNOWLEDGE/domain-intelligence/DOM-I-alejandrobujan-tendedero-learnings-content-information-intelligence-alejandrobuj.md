# Domain I — Content & Information Intelligence: Content & Information Intelligence: alejandrobujan-tendedero-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "alejandrobujan-tendedero-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-25T07:22:41.519Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-alejandrobujan-tendedero-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [alejandrobujan-tendedero-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-25T07:22:41.519Z`  
> **Learning ID**: `LEARN-EVO-alejandrobujan-tendedero-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain I (Content & Information Intelligence)
- **Secondary Corroborating Domains**: L (Deployment & Operations Intelligence), G (Architecture Intelligence), H (Technical Construction Intelligence), D (Research & Knowledge Intelligence), M (Feedback & Evolution Intelligence), A (Human & Need Intelligence), J (Search & Distribution Intelligence), F (Design Intelligence), K (Quality & Verification Intelligence)
- **Confidence Rating**: 61%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from alejandrobujan-tendedero-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/alejandrobujan-tendedero-learnings.md`  
> **Source**: github ([https://github.com/alejandrobujan/tendedero](https://github.com/alejandrobujan/tendedero))  
> **Source Version**: `483e54ba`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-25T07:22:23.568Z  
> **Learning ID**: `learn-github-alejandrobujan-tendedero`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): alejandrobujan/tendedero

> **Canonical Artifact**: `07_PROJECT_LEARNING/alejandrobujan-tendedero-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/alejandrobujan/tendedero](https://github.com/alejandrobujan/tendedero))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-25T07:22:23.561Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `alejandrobujan/tendedero`
- **Description**: Capture it. Copy it. Hang it all out to dry. A tiny native macOS app that hangs every screenshot, and anything you copy, on a line at the top of your screen, and finds any word on it.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3425 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Package.swift`
```
// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "Tendedero",
    platforms: [.macOS(.v14)],
    targets: [
        // Resources holds the translations. scripts/build-app.sh copies them
        // into the app, so SwiftPM leaves them alone.
        .executableTarget(name: "Tendedero", path: "Sources/Tendedero", exclude: ["Resources"])
    ]
)

```

### Core Architecture Module: `Sources/Tendedero/AppDelegate.swift`
```
import AppKit
import Carbon
import Combine
import Quartz
import ServiceManagement
import SwiftUI

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, NSMenuDelegate {
    private let line = Line()
    private var panel: LinePanel!
    private var statusItem: NSStatusItem!
    private var watcher: ScreenshotWatcher!
    /// In inbox mode, a second watcher on the Desktop. If a macOS version
    /// ignores the screenshot settings (macOS 27 renamed one), captures keep
    /// landing on the Desktop, and they still hang on the line.
    /// Folders chosen in "Also watch folders", like the one another
    /// screenshot app saves to.
    private var folderWatchers: [ScreenshotWatcher] = []
    private var clipboardWatcher: ClipboardWatcher!
    private var noteWatcher: NoteWatcher!
    private var signalSources: [DispatchSourceSignal] = []
    private var hotKey: HotKey?
    /// ⌃⌥F searches the line. Fixed, apart from the shortcut that shows it.
    private var searchHotKey: HotKey?
    private var searchBar: SearchBar!
    private let zoom = Zoom()
    private var cancellables = Set<AnyCancellable>()
    private var mouseTimer: Timer?

    /// Whether the panel is ordered in. It can be in and still tucked away
    /// above the top edge, like an auto-hiding Dock.
    private var isPresent = false
    /// Whether the line has slid down into view.
    private var isRevealed = false
    /// Opened on purpose with the shortcut or the menu: it stays down until
    /// the cursor has visited it and left, or the shortcut is pressed again.
    private var pinned = false
    /// A new screenshot shows itself for a moment, then tucks away.
    private var peekUntil = Date.distantPast
    private var hotZoneSince: Date?
    /// After a click in the menu bar the line stays up there hidden until the
    /// pointer leaves the menu bar, so it does not come back over a menu.
    private var menuBarSuppressed = false
    private var clickMonitors: [Any] = []
    private var awaySince: Date?
    /// Whether the line should be up, if nothing prevents it. A full screen
    /// app on that screen does: the line waits until you leave full screen.
    private var wanted = false
    /// Set when you open the line on purpose, so it stays up while empty.
    private var keepOpen = false
    /// Opened on purpose with the shortcut or the menu, which counts over a
    /// full screen app too, until the line tucks away.
    private var openedOnPurpose = false

    // What brings the line down, from the menu bar's "Bring the line down".
    // Out of the box, the first two are on and the third off.

    /// Resting the pointer in the menu bar. Off, only the shortcut and the
    /// menu open it.
    static var opensFromMenuBar: Bool {
        get { !UserDefaults.standard.bool(forKey: "menuBarRevealOff") }
        set { UserDefaults.standard.set(!newValue, forKey: "menuBarRevealOff") }
    }

    /// Something new hanging shows itself for a moment. Off, it hangs
    /// quietly and waits for you to bring the line down.
    static var peeksAtNew: Bool {
        get { !UserDefaults.standard.bool(forKey: "quietHang") }
        set { UserDefaults.standard.set(!newValue, forKey: "quietHang") }
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        let host = NSHostingView(rootView: LineView(line: line))
        host.sizingOptions = []
        panel = LinePanel(content: host)
        panel.placeOnScreen()
        updateCapacity()

        if Inbox.isEnabled { Inbox.apply() }
        restoreSettingsOnTermination()
        startWatcher()
        clipboardWatcher = ClipboardWatcher { [weak self] url in self?.hangCapture(url) }
        if ClipboardWatcher.isEnabled { clipboardWatcher.start() }
        noteWatcher = NoteWatcher { [weak self] in self?.line.refreshNotes() }
        noteWatcher.start()

        registerShortcut()
        searchBar = SearchBar(line: line)
        searchBar.onReturn = { [weak self] in self?.copyFirstMatch() }
        searchBar.onEnd = { [weak self] in self?.endSearch(tuckAway: true) }
        registerSearchShortcut()

        setUpStatusItem()
        watchMenuBarClicks()
        watchPutBackKey()

        // Hang on Tendedero, in the menu of images in Finder and other apps.
        NSApp.servicesProvider = self
        NSUpdateDynamicServices()

        Markup.shared.onSaved = { [weak self] url in self?.line.reloadThumbnail(for: url) }
        Share.shared.clearAll()
        Trim.shared.onSaved = { [weak self] url in self?.line.reloadThumbnail(for: url) }
        panel.onScroll = { [weak self] event in
            // Sideways on a trackpad, or the wheel of a mouse.
            let delta = abs(event.scrollingDeltaX) >= abs(event.scrollingDeltaY)
                ? event.scrollingDeltaX : event.scrollingDeltaY
            self?.line.scroll(by: event.hasPreciseScrollingDeltas ? delta : delta * 12)
        }
        line.onFall = { [weak self] item in self?.fall(item) }
        line.onHold = { [weak self] id in self?.hold(id) }
        line.onHangBack = { id in Held.hangBack(id) }
        line.onUndoableAction = { [weak self] in self?.keepUndoAtPointer() }

        line.$items
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in self?.itemsChanged() }
            .store(in: &cancellables)
        // Photos kept from last time show themselves for a moment.
        if line.liveCount > 0 { comeDown(on: nil) }

        // Entering or leaving full screen switches Space. Check again once the
        // switch animation has settled.
        let workspace = NSWorkspace.shared.notificationCenter
        for name in [NSWorkspace.activeSpaceDidChangeNotification, NSWorkspace.didActivateApplicationNotification] {
            workspace.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
                MainActor.assumeIsolated {
                    // Opened on purpose counts for the Space it was opened on.
                    if name == NSWorkspace.activeSpaceDidChangeNotification { self?.openedOnPurpose = false }
                    self?.refresh()
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
                        self?.refresh()
                        self?.keepOnActiveSpace()
                    }
                }
            }
        }

        NotificationCenter.default.addObserver(
            forName: NSApplication.didChangeScreenParametersNotification, object: nil, queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated {
                self?.panel.placeOnScreen()
                self?.updateCapacity()
            }
        }

        if !Inbox.wasOffered {
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { [weak self] in
                self?.offerInbox()
                self?.offerCopying()
            }
        } else if !Self.copyingOffered {
            // Updated from a version that only hung screenshots: shown once.
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { [weak self] in self?.offerCopying() }
        } else if Self.shouldOfferLogin {
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { Self.offerLogin() }
        }

        if !UserDefaults.standard.bool(forKey: "welcomed") {
            UserDefaults.standard.set(true, forKey: "welcomed")
            keepOpen = true
            wanted = true
            refresh()
            reveal(pinned: true)
            DispatchQueue.main.asyncAfter(deadline: .now() + 5) { [weak self] in
                guard let self, self.line.liveCount == 0 else { return }
                self.keepOpen = false
                self.wanted = false
                self.refresh()
            }
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        if Inbox.isEnabled { Inbox.restore() }
        Share.shared.clearAll()
    }

    // MARK: Inbox mode

    private func startWatcher() {
        watcher?.stop()
        watcher = ScreenshotWatcher(
            onNew: { [weak self] url in self?.hangCapture(url, screenshot: true) },
            onChange: { [weak self] in self?.line.prune() })
        watcher.start()
        folderWatchers.forEach { $0.stop() }
        folderWatchers = []
        // A folder may also be watched for screenshots, like the Desktop; an
        // image both report hangs once.
        for folder in Self.extraFolders {
            let extra = ScreenshotWatcher(
                folder: folder, anyImage: true,
                onNew: { [weak self] url in self?.hangCapture(url) },
                onChange: { [weak self] in self?.line.prune() })
            extra.start()
            folderWatchers.append(extra)
        }
    }

    /// Up to three folders: enough for another screenshot app or an export
    /// folder, few enough that screenshots still have room on the line.
    static let maxExtraFolders = 3

    /// The folders from "Also watch folders" that still exist. New images in
    /// them hang like screenshots; taking one down leaves the file there.
    static var extraFolders: [URL] {
        get {
            let paths = UserDefaults.standard.stringArray(forKey: "extraFolders") ?? []
            return paths.compactMap { path in
                var isDir: ObjCBool = false
                guard FileManager.default.fileExists(atPath: path, isDirectory: &isDir), isDir.boolValue else { return nil }
                return URL(fileURLWithPath: path, isDirectory: true)
            }
        }
        set { UserDefaults.standard.set(newValue.map(\.path), forKey: "extraFolders") }
    }

    /// Each new screenshot goes to the clipboard as it hangs.
    static var copiesScreenshots: Bool {
        get { UserDefaults.standard.bool(forKey: "copyScreenshots") }
        set { UserDefaults.standard.set(newValue, forKey: "copyScreenshots") }
    }

    private func chooseExtraFolder() {
        let panel = NSOpenPanel()
        panel.canChooseDirectori
```

### Core Architecture Module: `Sources/Tendedero/CaptureFlight.swift`
```
import AppKit
import QuartzCore

/// Reads where on screen a screenshot was taken. macOS stores the captured
/// area on the file, in global points with the origin at the top left of
/// the main display. Returned in AppKit screen coordinates.
func captureRect(of url: URL) -> CGRect? {
    let name = "com.apple.metadata:kMDItemScreenCaptureGlobalRect"
    let data: Data? = url.withUnsafeFileSystemRepresentation { path in
        guard let path else { return nil }
        let size = getxattr(path, name, nil, 0, 0, 0)
        guard size > 0 else { return nil }
        var buffer = Data(count: size)
        let read = buffer.withUnsafeMutableBytes { getxattr(path, name, $0.baseAddress, size, 0, 0) }
        return read == size ? buffer : nil
    }
    guard let data,
          let values = try? PropertyListSerialization.propertyList(from: data, format: nil) as? [NSNumber],
          values.count == 4, let main = NSScreen.screens.first else { return nil }
    let x = CGFloat(truncating: values[0]), y = CGFloat(truncating: values[1])
    let w = CGFloat(truncating: values[2]), h = CGFloat(truncating: values[3])
    guard w > 2, h > 2 else { return nil }
    return CGRect(x: x, y: main.frame.maxY - y - h, width: w, height: h)
}

/// The capture lifting off the screen and flying up to the line. It turns
/// into the hanging card on the way: it shrinks, tilts into place and grows
/// its glass frame and clip, so there is nothing left to change on landing.
@MainActor
final class CaptureFlight {
    static let duration: CFTimeInterval = 0.65
    /// How high the gentle arc rises halfway, in points.
    private static let arc: CGFloat = 30

    private let window: NSWindow
    private let container = CALayer()
    private let glass = CALayer()
    private let edge = CAGradientLayer()
    private let edgeMask = CAShapeLayer()
    private let photo = CALayer()
    private let clip = CAGradientLayer()

    private let from: CGRect
    private let to: CGRect
    private let tilt: CGFloat
    private var falling = false
    private var duration: CFTimeInterval = CaptureFlight.duration
    private var start: CFTimeInterval = 0
    private var timer: Timer?
    private var completion: () -> Void = {}

    private static var current: [CaptureFlight] = []

    /// Captures flying to the line right now. Each one holds a large image,
    /// so in a burst of captures only a couple fly and the rest drop in.
    static var flightsInProgress: Int { current.filter { !$0.falling }.count }

    /// - Parameters:
    ///   - from: the captured area, in screen coordinates.
    ///   - to: the card's frame on the line, in screen coordinates, unrotated.
    ///   - tilt: the card's resting tilt in degrees, clockwise, as SwiftUI uses.
    static func fly(image: CGImage, from: CGRect, to: CGRect, tilt: CGFloat, on screen: NSScreen,
                    completion: @escaping () -> Void) {
        let flight = CaptureFlight(image: image, from: from, to: to, tilt: tilt, screen: screen)
        current.append(flight)
        flight.completion = { [weak flight] in
            completion()
            current.removeAll { $0 === flight }
        }
        flight.run()
    }

    /// A discarded card falling off the line, drawn over the whole screen so
    /// it is never cut by the line's strip. Same motion as the app always had:
    /// 520 points down, tilting further, fading, 0.55 s ease in.
    static func fall(image: CGImage, card: CGRect, tilt: CGFloat, pinned: Bool = false, on screen: NSScreen) {
        let flight = CaptureFlight(image: image, from: card, to: card, tilt: tilt, screen: screen)
        flight.falling = true
        // A pinned photo falls with its space grey clip, as it hung.
        if pinned {
            flight.clip.colors = [NSColor(white: 0.30, alpha: 1).cgColor, NSColor(white: 0.47, alpha: 1).cgColor,
                                  NSColor(white: 0.38, alpha: 1).cgColor, NSColor(white: 0.24, alpha: 1).cgColor]
            flight.clip.borderColor = NSColor(white: 1, alpha: 0.35).cgColor
        }
        flight.duration = 0.55
        current.append(flight)
        flight.completion = { [weak flight] in current.removeAll { $0 === flight } }
        flight.run()
    }

    private init(image: CGImage, from: CGRect, to: CGRect, tilt: CGFloat, screen: NSScreen) {
        self.from = from
        self.to = to
        self.tilt = tilt
        window = NSPanel(contentRect: screen.frame, styleMask: [.borderless, .nonactivatingPanel],
                         backing: .buffered, defer: false)
        window.isOpaque = false
        window.backgroundColor = .clear
        window.hasShadow = false
        window.ignoresMouseEvents = true
        window.level = NSWindow.Level(rawValue: NSWindow.Level.floating.rawValue + 1)
        window.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle, .fullScreenAuxiliary]

        let host = NSView(frame: NSRect(origin: .zero, size: screen.frame.size))
        host.wantsLayer = true
        window.contentView = host
        let scale = screen.backingScaleFactor

        container.anchorPoint = CGPoint(x: 0.5, y: 1)   // the card's top center
        container.shadowColor = NSColor.black.cgColor
        container.shadowOpacity = 0.24
        container.shadowRadius = 10
        container.shadowOffset = CGSize(width: 0, height: -5)

        glass.backgroundColor = NSColor(white: 0.97, alpha: 0.72).cgColor
        edge.colors = [NSColor(white: 1, alpha: 0.9).cgColor, NSColor(white: 1, alpha: 0.25).cgColor]
        edge.startPoint = CGPoint(x: 0.5, y: 1); edge.endPoint = CGPoint(x: 0.5, y: 0)
        edgeMask.fillColor = nil
        edgeMask.strokeColor = NSColor.black.cgColor
        edgeMask.lineWidth = 1.5
        edge.mask = edgeMask

        photo.contents = image
        photo.contentsGravity = .resizeAspectFill
        photo.masksToBounds = true
        photo.contentsScale = scale

        clip.colors = [NSColor(white: 0.70, alpha: 1).cgColor, NSColor(white: 0.93, alpha: 1).cgColor,
                       NSColor(white: 0.82, alpha: 1).cgColor, NSColor(white: 0.62, alpha: 1).cgColor]
        clip.locations = [0, 0.35, 0.65, 1]
        clip.startPoint = CGPoint(x: 0, y: 0.5); clip.endPoint = CGPoint(x: 1, y: 0.5)
        clip.cornerRadius = 3.5
        clip.borderColor = NSColor(white: 1, alpha: 0.7).cgColor
        clip.borderWidth = 0.6

        for layer in [container, glass, edge, photo, clip] as [CALayer] { layer.contentsScale = scale }
        container.addSublayer(glass)
        container.addSublayer(photo)
        container.addSublayer(edge)
        container.addSublayer(clip)
        host.layer?.addSublayer(container)
    }

    private func run() {
        if falling { update(1); updateFall(0) } else { update(0) }
        window.orderFrontRegardless()
        start = CACurrentMediaTime()
        let timer = Timer(timeInterval: 1.0 / 120.0, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.tick() }
        }
        RunLoop.main.add(timer, forMode: .common)
        self.timer = timer
    }

    private func tick() {
        let k = min(1, (CACurrentMediaTime() - start) / duration)
        if falling { updateFall(k) } else { update(k) }
        guard k >= 1 else { return }
        timer?.invalidate()
        timer = nil
        completion()
        if falling {
            window.orderOut(nil)
            return
        }
        // The real card fades in underneath; this one fades out over it.
        NSAnimationContext.runAnimationGroup({ ctx in
            ctx.duration = 0.16
            window.animator().alphaValue = 0
        }, completionHandler: { [window] in
            MainActor.assumeIsolated { window.orderOut(nil) }
        })
    }

    private func updateFall(_ raw: Double) {
        let e = CGFloat(raw * raw * raw)
        let origin = window.frame.origin
        let angle = tilt + (tilt * 7 + 20) * e
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        container.position = CGPoint(x: to.midX - origin.x, y: to.maxY - origin.y - 520 * e)
        container.setAffineTransform(CGAffineTransform(rotationAngle: -angle * .pi / 180))
        container.opacity = Float(1 - e)
        CATransaction.commit()
    }

    private static func easeInOutCubic(_ x: Double) -> Double {
        x < 0.5 ? 4 * x * x * x : 1 - pow(-2 * x + 2, 3) / 2
    }

    private static func smooth(_ x: Double, _ a: Double, _ b: Double) -> Double {
        let t = max(0, min(1, (x - a) / (b - a)))
        return t * t * (3 - 2 * t)
    }

    private func update(_ raw: Double) {
        let k = CGFloat(Self.easeInOutCubic(raw))
        let chrome = Float(Self.smooth(Double(k), 0.35, 1))
        let origin = window.frame.origin
        func lerp(_ a: CGFloat, _ b: CGFloat) -> CGFloat { a + (b - a) * k }

        let w = lerp(from.width, to.width), h = lerp(from.height, to.height)
        let topX = lerp(from.midX, to.midX) - origin.x
        let topY = lerp(from.maxY, to.maxY) - origin.y + sin(.pi * k) * Self.arc
        let inset = 4 * k
        let radius = lerp(0, 16)

        CATransaction.begin()
        CATransaction.setDisableActions(true)
        container.bounds = CGRect(x: 0, y: 0, width: w, height: h)
        container.position = CGPoint(x: topX, y: topY)
        // SwiftUI tilts clockwise for positive angles; Core Animation the other way.
        container.setAffineTransform(CGAffineTransform(rotationAngle: -tilt * .pi / 180 * k))
        container.shadowPath = CGPath(roundedRect: container.bounds, cornerWidth: radius, cornerHeight: radius, transform: nil)

        glass.frame = container.bounds
        glass.cornerRadius = radius
        glass.opacity = chrome
        edge.frame = container.bounds
        edgeMask.path = CGPath(roundedRect: container.bounds.insetBy(dx: 0.75, dy: 0.75),
                               cornerWidth: max(0, radius - 0.75), cornerHeight: max(0, radius - 0.75), transform: nil)
        edge.o
```

### Core Architecture Module: `Sources/Tendedero/ClipboardWatcher.swift`
```
import AppKit
import Carbon

/// Hangs images copied to the clipboard, like a screenshot taken with Control
/// held or an image copied in Preview. Each one is saved as a PNG in
/// Tendedero's own folder, so on the line it behaves like any screenshot.
///
/// Off until the user turns it on. The pasteboard has no change notification,
/// so its change count is checked twice a second; what was copied is only read
/// once its types say it is a picture and nothing else.
@MainActor
final class ClipboardWatcher {
    private let onImage: (URL) -> Void
    private var timer: Timer?
    private var lastCount = NSPasteboard.general.changeCount
    /// The last image saved. Some apps put the same image on the clipboard
    /// again; it hangs once, unless it has been taken down since.
    private var last: (png: Data, url: URL)?

    private static let enabledKey = "clipboardEnabled"

    private static let textKey = "clipboardTextEnabled"
    private static let linksKey = "clipboardLinksEnabled"

    /// Hang copied images.
    static var imagesEnabled: Bool {
        get { UserDefaults.standard.bool(forKey: enabledKey) }
        set { UserDefaults.standard.set(newValue, forKey: enabledKey) }
    }

    /// Hang copied text. Off until chosen: nothing you copy is kept on disk
    /// unless you asked for it.
    static var textEnabled: Bool {
        get { UserDefaults.standard.bool(forKey: textKey) }
        set { UserDefaults.standard.set(newValue, forKey: textKey) }
    }

    /// Hang copied links: a copy that is one web address and nothing else.
    /// Off until chosen, apart from text.
    static var linksEnabled: Bool {
        get { UserDefaults.standard.bool(forKey: linksKey) }
        set { UserDefaults.standard.set(newValue, forKey: linksKey) }
    }

    /// The clipboard is watched while any kind is on.
    static var isEnabled: Bool { imagesEnabled || textEnabled || linksEnabled }

    /// Copies that carry a picture but are not one. Text from a spreadsheet
    /// or a document also comes as an image of itself. A file copied in
    /// Finder brings its icon, and a photo copied from the line brings its
    /// file. Password managers and similar apps mark private or temporary
    /// copies, following nspasteboard.org.
    private static let ignoredTypes: Set<NSPasteboard.PasteboardType> = [
        // What Tendedero itself copies is never hung again.
        .string, .fileURL, selfCopyType,
        .init("org.nspasteboard.ConcealedType"),
        .init("org.nspasteboard.TransientType"),
        .init("org.nspasteboard.AutoGeneratedType"),
    ]

    /// Anything bigger is not a screenshot.
    private static let maxBytes = 64 * 1024 * 1024
    nonisolated private static let maxPixels = 80_000_000

    init(onImage: @escaping (URL) -> Void) {
        self.onImage = onImage
    }

    func start() {
        guard timer == nil else { return }
        // Whatever is on the clipboard already is old news.
        lastCount = NSPasteboard.general.changeCount
        let timer = Timer(timeInterval: 0.5, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.check() }
        }
        RunLoop.main.add(timer, forMode: .common)
        self.timer = timer
    }

    func stop() {
        timer?.invalidate()
        timer = nil
    }

    private func check() {
        let pb = NSPasteboard.general
        let count = pb.changeCount
        guard count != lastCount else { return }
        lastCount = count
        if Self.textEnabled || Self.linksEnabled, let (text, rtf) = Self.copiedText(pb) {
            let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
            if Note.webAddress(trimmed) != nil {
                if Self.linksEnabled { save(text: trimmed, rtf: nil, link: true) }
            } else if Self.textEnabled {
                save(text: text, rtf: rtf, link: false)
            }
            return
        }
        guard Self.imagesEnabled, let items = pb.pasteboardItems, !items.isEmpty,
              items.allSatisfy({ Self.ignoredTypes.isDisjoint(with: $0.types) }),
              let type = pb.availableType(from: [.png, .tiff]),
              let data = pb.data(forType: type), data.count <= Self.maxBytes,
              pb.changeCount == count else { return }
        // Decoding a large image takes a moment, so it happens off the main thread.
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            let png = ClipboardWatcher.png(from: data, type: type)
            DispatchQueue.main.async {
                // Copied over again in the meantime: that copy is the one that
                // counts. Turned off in the meantime: nothing hangs.
                guard let png, NSPasteboard.general.changeCount == count,
                      let self, self.timer != nil else { return }
                self.save(png)
            }
        }
    }

    /// Text copied on its own: not a file, not from the line, not private,
    /// not from another device, not typed into a password field. A copy that
    /// also carries a picture, such as cells from a spreadsheet, is never
    /// text: it is up to the images switch.
    private static let maxChars = 100_000
    private static func copiedText(_ pb: NSPasteboard) -> (String, Data?)? {
        guard let items = pb.pasteboardItems, !items.isEmpty,
              !IsSecureEventInputEnabled(),
              pb.availableType(from: [.png, .tiff]) == nil else { return nil }
        let blocked: Set<NSPasteboard.PasteboardType> = [
            .fileURL, selfCopyType,
            .init("org.nspasteboard.ConcealedType"),
            .init("org.nspasteboard.TransientType"),
            .init("org.nspasteboard.AutoGeneratedType"),
            // Universal Clipboard: copied on an iPhone or another Mac.
            .init("com.apple.is-remote-clipboard"),
        ]
        guard items.allSatisfy({ blocked.isDisjoint(with: $0.types) }),
              let text = pb.string(forType: .string),
              !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              text.count <= maxChars else { return nil }
        return (text, richData(pb))
    }

    /// The styled version of what was copied, as RTF, when there is one.
    /// Web pages bring HTML, which is converted.
    private static func richData(_ pb: NSPasteboard) -> Data? {
        if let rtf = pb.data(forType: .rtf), rtf.count <= 5_000_000 { return lightPageRTF(rtf) }
        guard let html = pb.data(forType: .html), html.count <= 2_000_000,
              let attr = try? NSAttributedString(
                data: html,
                options: [.documentType: NSAttributedString.DocumentType.html,
                          .characterEncoding: String.Encoding.utf8.rawValue],
                documentAttributes: nil) else { return nil }
        let clean = lightPageStyled(attr)
        return try? clean.data(from: NSRange(location: 0, length: clean.length),
                               documentAttributes: [.documentType: NSAttributedString.DocumentType.rtf])
    }

    private var lastText: String?

    /// Notes and links go to their own folder, apart from the screenshots.
    private func save(text: String, rtf: Data?, link: Bool) {
        if let last, FileManager.default.fileExists(atPath: last.url.path), lastText == text { return }
        let ext = rtf == nil ? "txt" : "rtf"
        let name = link ? "Link" : "Text"
        let fm = FileManager.default
        let folder = NoteFolder.url
        var url = folder.appendingPathComponent("\(name) \(Self.stamp()).\(ext)")
        var n = 2
        while fm.fileExists(atPath: url.path) {
            url = folder.appendingPathComponent("\(name) \(Self.stamp()) \(n).\(ext)")
            n += 1
        }
        do {
            try fm.createDirectory(at: folder, withIntermediateDirectories: true)
            try (rtf ?? Data(text.utf8)).write(to: url, options: .atomic)
            try fm.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)
            last = (Data(), url)
            lastText = text
            onImage(url)
        } catch {
            try? fm.removeItem(at: url)
            log.error("Could not save copied text: \(error.localizedDescription, privacy: .public)")
        }
    }

    /// PNG bytes are kept as they are; TIFF becomes PNG. Either way the image
    /// must decode and have a sane size.
    nonisolated private static func png(from data: Data, type: NSPasteboard.PasteboardType) -> Data? {
        guard let rep = NSBitmapImageRep(data: data),
              rep.pixelsWide > 0, rep.pixelsHigh > 0,
              rep.pixelsWide <= maxPixels / rep.pixelsHigh else { return nil }
        return type == .png ? data : rep.representation(using: .png, properties: [:])
    }

    private func save(_ png: Data) {
        if let last, last.png == png, FileManager.default.fileExists(atPath: last.url.path) { return }
        let fm = FileManager.default
        var url = Inbox.folder.appendingPathComponent("Clipboard \(Self.stamp()).png")
        var n = 2
        while fm.fileExists(atPath: url.path) {
            url = Inbox.folder.appendingPathComponent("Clipboard \(Self.stamp()) \(n).png")
            n += 1
        }
        do {
            try fm.createDirectory(at: Inbox.folder, withIntermediateDirectories: true)
            try png.write(to: url, options: .atomic)
            // What people copy can be private: only they can read it.
            try fm.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)
            last = (png, url)
            onImage(url)
        } catch {
            try? fm.removeItem(at: url)
            log.error("Could not save a copied image: \(error.localizedDescription, privacy: .public)")
        }
    }

    private static func stamp() -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd 'at' HH.mm.ss"
        return f.string(from: Date
```

### Core Architecture Module: `Sources/Tendedero/FullScreen.swift`
```
import AppKit

// The window server knows the type of the Space each display is showing.
// These calls are private but stable for a decade, need no permission, and
// are what window managers like yabai rely on. A full screen Space is type 4.
@_silgen_name("CGSMainConnectionID")
private func CGSMainConnectionID() -> Int32

@_silgen_name("CGSCopyManagedDisplaySpaces")
private func CGSCopyManagedDisplaySpaces(_ connection: Int32) -> CFArray

enum FullScreen {
    private static let fullScreenSpaceType = 4

    /// Whether the line also comes down over full screen apps, so screenshots
    /// stay within reach while you work in one. Off unless turned on: a video
    /// or a presentation should not get a clothesline across the top.
    static var showLineOver: Bool {
        get { UserDefaults.standard.bool(forKey: "showOverFullScreen") }
        set { UserDefaults.standard.set(newValue, forKey: "showOverFullScreen") }
    }

    /// True when the line should keep away from the given screen.
    static func blocksLine(on screen: NSScreen) -> Bool {
        !showLineOver && isActive(on: screen)
    }

    /// True when the given screen is currently showing a full screen app,
    /// like a video or a presentation.
    static func isActive(on screen: NSScreen) -> Bool {
        guard let displays = CGSCopyManagedDisplaySpaces(CGSMainConnectionID()) as? [[String: Any]],
              !displays.isEmpty else { return false }

        // With "Displays have separate Spaces" off there is a single entry
        // that covers every screen.
        let entry: [String: Any]?
        if displays.count == 1 {
            entry = displays.first
        } else {
            let uuid = uuidString(for: screen)
            entry = displays.first { ($0["Display Identifier"] as? String) == uuid }
        }
        let current = entry?["Current Space"] as? [String: Any]
        return (current?["type"] as? Int) == fullScreenSpaceType
    }

    private static func uuidString(for screen: NSScreen) -> String? {
        guard let number = screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? CGDirectDisplayID,
              let uuid = CGDisplayCreateUUIDFromDisplayID(number)?.takeRetainedValue() else { return nil }
        return CFUUIDCreateString(nil, uuid) as String?
    }
}

```

### Core Architecture Module: `Sources/Tendedero/GrabArea.swift`
```
import AppKit
import SwiftUI

/// Bridges each photo to AppKit's drag and drop, so it can be dragged into
/// any app as a real file. Each destination means one thing:
///
/// - An app gets a copy, and the photo stays on the line.
/// - A folder or the Desktop keeps the file, and the photo leaves the line.
/// - The Trash discards it.
/// - Nowhere that accepts it: the photo flies back to the line.
///
/// Click copies, double click opens, press and hold opens Markup, the corner
/// cross discards.
struct GrabArea: NSViewRepresentable {
    let item: Pegged
    let line: Line

    func makeNSView(context: Context) -> GrabView {
        let view = GrabView()
        configure(view)
        return view
    }

    func updateNSView(_ view: GrabView, context: Context) {
        configure(view)
    }

    private func configure(_ view: GrabView) {
        let id = item.id
        let line = line
        let isRecording = item.isRecording
        view.url = item.url
        view.dragImage = item.thumb
        view.isHeld = item.held
        view.toolTip = L("Shift-click to select photos")
        view.onSelect = { line.toggleSelection(id) }
        // Pressing a selected photo keeps the selection, so it can be
        // dragged as a group; a plain click on it clears it when released.
        view.onPlainPress = { if !line.selectedIDs.contains(id) { line.clearSelection() } }
        view.onPlainClick = { line.clearSelection() }
        view.onHangBack = { line.onHangBack?(id) }
        view.onClick = { line.copy(id) }
        view.onDoubleClick = { line.open(id) }
        view.onDragStart = { line.draggingID = id }
        view.onDragEnd = {
            line.draggingID = nil
            // Moved into a folder: it is saved where you wanted it.
            line.prune()
        }
        // A photo selected with others drags them all, and they go to the
        // Trash together.
        let inGroup = { line.selectedIDs.contains(id) && line.selectedIDs.count > 1 }
        view.dragGroup = { inGroup() ? line.selectedItems.map { ($0.url, $0.thumb) } : [] }
        view.onTrash = {
            if inGroup() { line.trash(line.selectedItems.map(\.id)) } else { line.trash(id) }
        }
        view.onDiscard = { line.pressCorner(id) }
        view.onLongPress = { line.markup(id) }
        view.onForceClick = { line.quickLook(id) }
        view.onPressChange = { pressed in line.pressedID = pressed ? id : nil }
        view.menuProvider = { [weak view] in
            if line.selectedIDs.contains(id) {
                return selectionMenu(line.selectedItems, from: view)
            }
            line.clearSelection()
            let menu = NSMenu()
            // Items say themselves whether they can be used.
            menu.autoenablesItems = false
            menu.addItem(ClosureMenuItem(L("Copy")) { line.copy(id) })
            menu.addItem(ClosureMenuItem(L("Copy Path")) { line.copyPath([id]) })
            menu.addItem(ClosureMenuItem(L("Open")) { line.openFile(id) })
            if isText(item.url), Note.cached(item.url)?.link != nil {
                menu.addItem(ClosureMenuItem(L("Open Link")) { line.openLink(id) })
            }
            menu.addItem(ClosureMenuItem(L("Quick Look")) { line.quickLook(id) })
            if !isRecording {
                menu.addItem(ClosureMenuItem(L("Hold")) { line.onHold?(id) })
            }
            if !isRecording && !isText(item.url) {
                menu.addItem(ClosureMenuItem(L("Markup")) { line.markup(id) })
            }
            menu.addItem(ClosureMenuItem(L("Show in Finder")) { line.reveal(id) })
            if let view, let url = view.url, let window = view.window {
                // Sending it away is a section of its own.
                menu.addItem(.separator())
                let card = window.convertToScreen(view.convert(view.bounds, to: nil))
                // Once the menu has closed, so the panel opens on its own.
                let share = ClosureMenuItem(L("Share…")) {
                    DispatchQueue.main.async { Share.shared.show(url, from: card) }
                }
                // The icon macOS uses for Share everywhere.
                share.image = NSImage(systemSymbolName: "square.and.arrow.up", accessibilityDescription: nil)
                menu.addItem(share)
                menu.addItem(.separator())
            }
            let item = line.items.first(where: { $0.id == id })
            let kept = item?.kept == true
            if !kept {
                menu.addItem(ClosureMenuItem(L("Pin")) { line.pin(id) })
            } else if item?.byHand == false {
                menu.addItem(ClosureMenuItem(L("Unpin")) { line.unpin(id) })
            }
            let inInbox = line.isInInbox(id)
            menu.addItem(saveToDesktopItem([id]))
            menu.addItem(.separator())
            if kept {
                // A pinned photo never goes to the Trash from here. One hung
                // by hand comes down; one pinned from the line is unpinned above.
                if item?.byHand == true {
                    menu.addItem(ClosureMenuItem(L("Take down")) { line.discard(id) })
                }
            } else if inInbox {
                menu.addItem(ClosureMenuItem(L("Discard")) { line.discard(id) })
            } else {
                menu.addItem(ClosureMenuItem(L("Take down")) { line.discard(id) })
                menu.addItem(ClosureMenuItem(L("Move to Trash")) { line.trash(id) })
            }
            let left = ClosureMenuItem(L("Take down everything to the left")) { line.takeDown(id, toTheLeft: true) }
            left.isEnabled = !line.neighbours(of: id, toTheLeft: true).isEmpty
            menu.addItem(left)
            let right = ClosureMenuItem(L("Take down everything to the right")) { line.takeDown(id, toTheLeft: false) }
            right.isEnabled = !line.neighbours(of: id, toTheLeft: false).isEmpty
            menu.addItem(right)
            return menu
        }
    }

    /// A menu captures the selection when it opens. New photos arriving
    /// while it is open cannot become part of an action by accident.
    private func selectionMenu(_ photos: [Pegged], from view: GrabView?) -> NSMenu {
        let ids = photos.map(\.id)
        let menu = NSMenu()
        menu.autoenablesItems = false
        let count = NSMenuItem(title: String(format: L("%d selected"), photos.count), action: nil, keyEquivalent: "")
        count.isEnabled = false
        menu.addItem(count)
        menu.addItem(.separator())
        menu.addItem(ClosureMenuItem(L("Copy")) { line.copy(ids) })
        menu.addItem(ClosureMenuItem(L("Copy Paths")) { line.copyPath(ids) })
        menu.addItem(ClosureMenuItem(L("Open")) { line.open(ids) })
        menu.addItem(ClosureMenuItem(L("Show in Finder")) { line.reveal(ids) })
        if let view, let window = view.window {
            let card = window.convertToScreen(view.convert(view.bounds, to: nil))
            menu.addItem(.separator())
            let share = ClosureMenuItem(L("Share…")) {
                DispatchQueue.main.async { Share.shared.show(photos.map(\.url), from: card) }
            }
            share.image = NSImage(systemSymbolName: "square.and.arrow.up", accessibilityDescription: nil)
            menu.addItem(share)
        }
        menu.addItem(.separator())
        if photos.contains(where: { !$0.kept }) {
            menu.addItem(ClosureMenuItem(L("Pin")) { line.pin(ids) })
        }
        if photos.contains(where: { $0.kept && !$0.byHand }) {
            menu.addItem(ClosureMenuItem(L("Unpin")) { line.unpin(ids) })
        }
        menu.addItem(saveToDesktopItem(ids))
        menu.addItem(.separator())
        let inInbox = photos.allSatisfy { !$0.kept && line.isInInbox($0.id) }
        let discard = ClosureMenuItem(inInbox ? L("Discard") : L("Take down")) { line.discard(ids) }
        discard.isEnabled = line.canDiscard(ids)
        menu.addItem(discard)
        return menu
    }

    /// Keep the action discoverable for a single photo too, and explain
    /// why other source folders are not handled by this action.
    private func saveToDesktopItem(_ ids: [UUID]) -> NSMenuItem {
        // Preserve the single-photo action, including a photo held in hand.
        let single = ids.count == 1 ? ids.first : nil
        let enabled = single.map { line.canSaveToDesktop($0) } ?? line.canSaveToDesktop(ids)
        let title = enabled ? L("Save to Desktop") : L("Save to Desktop (inbox or Desktop only)")
        let item = ClosureMenuItem(title) {
            if let single { line.saveToDesktop(single) } else { line.saveToDesktop(ids) }
        }
        item.isEnabled = enabled
        return item
    }
}

final class GrabView: NSView, NSDraggingSource {
    static var isDragging = false
    /// A photo's menu is open. It reaches past the line, so the line waits.
    static var isShowingMenu = false

    var url: URL?
    var dragImage: NSImage?
    /// Every photo that drags along with this one, when it is selected with
    /// others. Empty for a drag of its own.
    var dragGroup: () -> [(URL, NSImage)] = { [] }
    /// Held in your hand: only its faded trace is on the line, and a click
    /// on it is all it answers, to bring the photo back.
    var isHeld = false
    var onHangBack: () -> Void = {}
    var onSelect: () -> Void = {}
    var onPlainPress: () -> Void = {}
    var onPlainClick: () -> Void = {}
    var onClick: () -> Void = {}
    var onDoubleClick: () -> Void = {}
    var onDragStart: () -> Void = {}
    var onDragEnd: () -> Void = {}
    var onTrash: () -> Void = {}
    var onDiscard: () -> Void = {}
    var onLongPress: () -> Void = {}
    var onForceClick: () -> Void = {}
    var onPressChange: (Bool) -> Void = { _ in }
    var menuProvider: () -> NSMenu = { NSMenu() }

    private var downPoint: NSPoint?
    private var startedDrag = false
    private var holdTimer: Timer?
    private var didLongPress = false
    private var pressedCross = f
```

### Core Architecture Module: `Sources/Tendedero/Held.swift`
```
import AppKit
import SwiftUI

/// A photo taken off the line to keep in front of you while you work: a
/// design to copy, numbers to type in, steps to follow. It is the photo
/// itself, not a copy: its clip waits empty on the line, and Hang back, or
/// Escape, sends it home.
///
/// It opens in the middle of the screen you are on, framed like a card.
/// Drag it anywhere; stretch it from an edge or a corner, or pinch or scroll
/// over it to zoom. Several can be held at
/// once. It never takes the app you are working in out of the front.
@MainActor
final class Held: NSObject {
    private static var open: [UUID: Held] = [:]

    let id: UUID
    let url: URL
    private let panel: HeldPanel
    private let view: HeldView
    /// Its size at 100%, in points.
    private let natural: NSSize
    /// Set for copied text, which reflows instead of keeping a shape.
    private let noteScale: NoteScale?
    /// Called with where it was on screen, to fly back to its clip from there.
    private let onHangBack: (UUID, CGRect) -> Void

    static var heldIDs: Set<UUID> { Set(open.keys) }

    static func show(_ id: UUID, url: URL, line: Line, onHangBack: @escaping (UUID, CGRect) -> Void) {
        guard open[id] == nil,
              let screen = LinePanel.screenUnderPointer() else { return }
        // No sharper than the screen can show, so a huge image stays light.
        let longest = max(screen.frame.width, screen.frame.height) * screen.backingScaleFactor
        guard let image = makeThumbnail(url, maxPixels: Int(longest), full: true), image.size.width > 0 else { return }
        open[id] = Held(id: id, url: url, image: image, on: screen, line: line, onHangBack: onHangBack)
    }

    static func hangBack(_ id: UUID) { open[id]?.hangBack() }

    /// A held note whose file was edited shows the new words.
    static func reload(_ url: URL) {
        guard let note = Note.peek(url) else { return }
        for held in open.values where held.url == url { held.view.show(note) }
    }

    static func hangEverythingBack() {
        for held in open.values { held.hangBack() }
    }

    /// Its photo left the line some other way: the file moved, for example.
    static func forget(except live: Set<UUID>) {
        for (id, held) in open where !live.contains(id) {
            held.panel.close()
            open[id] = nil
        }
    }

    private init(id: UUID, url: URL, image: NSImage, on screen: NSScreen, line: Line,
                 onHangBack: @escaping (UUID, CGRect) -> Void) {
        self.id = id
        self.url = url
        self.onHangBack = onHangBack
        let scale = screen.backingScaleFactor
        natural = NSSize(width: image.size.width / scale + HeldView.border * 2,
                         height: image.size.height / scale + HeldView.border * 2)
        let note = isText(url) ? Note.cached(url) : nil
        noteScale = note == nil ? nil : NoteScale()
        view = HeldView(image: image, note: note, scale: noteScale)
        panel = HeldPanel(content: view)
        super.init()
        view.onHangBack = { [weak self] in self?.hangBack() }
        view.onZoom = { [weak self] factor, anchor in self?.zoom(by: factor, around: anchor) }
        view.onActualSize = { [weak self] in self?.actualSize() }
        view.onCopy = { line.copy(id) }
        panel.onCopy = { line.copy(id) }
        panel.onEscape = { [weak self] in self?.hangBack() }
        view.onMarkup = { line.markup(id) }
        view.onQuickLook = { line.quickLook(id) }
        // Stretched from an edge or a corner, a photo keeps its shape; a
        // note takes any shape and its text reflows.
        if noteScale == nil { panel.contentAspectRatio = natural }
        panel.minSize = NSSize(width: noteScale == nil ? 80 : 120, height: 80)
        panel.setFrame(startFrame(on: screen), display: false)
        panel.orderFrontRegardless()
    }

    /// In the middle of the screen, each new one a little lower and to the
    /// right so none hides another. Never bigger than most of the screen.
    private func startFrame(on screen: NSScreen) -> NSRect {
        let area = screen.visibleFrame
        let fit = min(1, area.width * 0.7 / natural.width, area.height * 0.7 / natural.height)
        let w = natural.width * fit, h = natural.height * fit
        let step = CGFloat((Self.open.count) % 8) * 24
        return NSRect(x: area.midX - w / 2 + step, y: area.midY - h / 2 - step, width: w, height: h)
    }

    /// Zooms keeping the point under the pointer where it is.
    private func zoom(by factor: CGFloat, around anchor: NSPoint) {
        let frame = panel.frame
        if let noteScale {
            // A note grows from the shape it has, words included.
            let u = min(max(noteScale.u * factor, 0.9), 8)
            let f = u / noteScale.u
            let w = frame.width * f, h = frame.height * f
            guard w >= 120, h >= 80 else { return }
            noteScale.u = u
            let fx = (anchor.x - frame.minX) / frame.width, fy = (anchor.y - frame.minY) / frame.height
            panel.setFrame(NSRect(x: anchor.x - w * fx, y: anchor.y - h * fy, width: w, height: h), display: true)
            return
        }
        let scale = min(max(frame.width * factor / natural.width, 0.1), 4)
        let w = natural.width * scale, h = natural.height * scale
        guard w >= 60, h >= 60 else { return }
        let fx = (anchor.x - frame.minX) / frame.width, fy = (anchor.y - frame.minY) / frame.height
        panel.setFrame(NSRect(x: anchor.x - w * fx, y: anchor.y - h * fy, width: w, height: h), display: true)
    }

    private func actualSize() {
        noteScale?.u = NoteScale.natural
        let frame = panel.frame
        panel.setFrame(NSRect(x: frame.midX - natural.width / 2, y: frame.midY - natural.height / 2,
                              width: natural.width, height: natural.height), display: true)
    }

    private func hangBack() {
        let frame = panel.frame
        panel.close()
        Self.open[id] = nil
        onHangBack(id, frame)
    }
}

/// Floats over every app and Space, under the line so it never covers it.
/// A click makes it key without bringing Tendedero to the front, so the app
/// you work in stays active; it then takes Escape and ⌘C.
private final class HeldPanel: NSPanel {
    /// ⌘C copies what is selected in a held note, else the whole item.
    var onCopy: () -> Void = {}
    var onEscape: () -> Void = {}

    override func performKeyEquivalent(with event: NSEvent) -> Bool {
        guard event.modifierFlags.contains(.command), let key = event.charactersIgnoringModifiers else {
            return super.performKeyEquivalent(with: event)
        }
        let text = firstResponder as? NSTextView
        switch key {
        case "c":
            if let text, text.selectedRange().length > 0 { text.copy(nil) } else { onCopy() }
            return true
        case "a":
            guard let text else { return super.performKeyEquivalent(with: event) }
            text.selectAll(nil)
            return true
        default:
            return super.performKeyEquivalent(with: event)
        }
    }

    /// Escape hangs it back, even while its text has the focus.
    override func cancelOperation(_ sender: Any?) { onEscape() }

    init(content: NSView) {
        // Resizable from its edges and corners, like any window.
        super.init(contentRect: .zero, styleMask: [.borderless, .nonactivatingPanel, .resizable],
                   backing: .buffered, defer: false)
        isOpaque = false
        backgroundColor = .clear
        hasShadow = true
        level = NSWindow.Level(rawValue: NSWindow.Level.floating.rawValue - 1)
        collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .ignoresCycle]
        hidesOnDeactivate = false
        isReleasedWhenClosed = false
        isMovableByWindowBackground = true
        becomesKeyOnlyIfNeeded = false
        // Set on purpose: by default clicks fall through the transparent
        // pixels outside the rounded corners, so the corners could not be
        // grabbed to resize.
        ignoresMouseEvents = false
        contentView = content
    }

    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }
}

/// The photo in a glass frame like the cards on the line. Its only control
/// is the button in the corner, which hangs it back, shown on hover like the
/// cards' own; everything else is in its menu.
private final class HeldView: NSVisualEffectView {
    static let border: CGFloat = 6

    var onHangBack: () -> Void = {}
    var onZoom: (CGFloat, NSPoint) -> Void = { _, _ in }
    var onActualSize: () -> Void = {}
    var onCopy: () -> Void = {}
    var onMarkup: () -> Void = {}
    var onQuickLook: () -> Void = {}

    private let photo = CALayer()
    /// Copied text is held as real, selectable text instead of a picture.
    private var sheet: NSView?
    private var noteScale: NoteScale?
    private let hangBackButton = CornerButton(symbol: "arrow.up.to.line")

    init(image: NSImage, note: Note? = nil, scale: NoteScale? = nil) {
        super.init(frame: .zero)
        material = .popover
        blendingMode = .behindWindow
        state = .active
        wantsLayer = true
        layer?.cornerRadius = 12
        layer?.masksToBounds = true
        layer?.borderWidth = 0.5
        layer?.borderColor = NSColor.white.withAlphaComponent(0.45).cgColor
        if let note {
            let scale = scale ?? NoteScale()
            noteScale = scale
            let host = NSHostingView(rootView: HeldNote(note: note, scale: scale))
            host.wantsLayer = true
            host.layer?.cornerRadius = 7
            host.layer?.masksToBounds = true
            addSubview(host)
            sheet = host
        } else {
            photo.contents = image
            photo.contentsGravity = .resizeAspect
            photo.cornerRadius = 7
            photo.masksToBounds = true
            layer?.a
```

### Core Architecture Module: `Sources/Tendedero/HotKey.swift`
```
import AppKit
import Carbon

/// A global shortcut through the Carbon hot key API. Unlike a global key
/// monitor, it needs no Accessibility permission. It lasts as long as the
/// object.
final class HotKey {
    private var ref: EventHotKeyRef?
    private let id: UInt32
    private static var actions: [UInt32: () -> Void] = [:]
    private static var nextID: UInt32 = 1
    private static var handlerInstalled = false

    /// Nil when the combination cannot be registered, for example because
    /// another app already took it.
    init?(_ shortcut: Shortcut, action: @escaping () -> Void) {
        // One handler for the app, whatever the shortcuts. It finds which one
        // was pressed by its id.
        if !HotKey.handlerInstalled {
            var spec = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
            InstallEventHandler(GetApplicationEventTarget(), { _, event, _ in
                var pressed = EventHotKeyID()
                GetEventParameter(event, EventParamName(kEventParamDirectObject), EventParamType(typeEventHotKeyID),
                                  nil, MemoryLayout<EventHotKeyID>.size, nil, &pressed)
                DispatchQueue.main.async { HotKey.actions[pressed.id]?() }
                return noErr
            }, 1, &spec, nil, nil)
            HotKey.handlerInstalled = true
        }
        id = HotKey.nextID
        HotKey.nextID += 1
        let hotKeyID = EventHotKeyID(signature: OSType(0x5445_4E44), id: id) // "TEND"
        let status = RegisterEventHotKey(UInt32(shortcut.keyCode), UInt32(shortcut.carbonModifiers), hotKeyID,
                                         GetApplicationEventTarget(), 0, &ref)
        guard status == noErr, ref != nil else { return nil }
        HotKey.actions[id] = action
    }

    deinit {
        if let ref { UnregisterEventHotKey(ref) }
        HotKey.actions[id] = nil
    }
}

/// A global shortcut: ⌃⌥T shows and hides the line, ⌃⌥F searches it. Either
/// can be changed or removed.
struct Shortcut: Equatable {
    var keyCode: Int
    var modifiers: NSEvent.ModifierFlags
    /// The key as typed, for the menu: "t", " ", "1".
    var key: String

    static let standard = Shortcut(keyCode: kVK_ANSI_T, modifiers: [.control, .option], key: "t")
    static let standardSearch = Shortcut(keyCode: kVK_ANSI_F, modifiers: [.control, .option], key: "f")

    /// ⌘Z, for Put back while the pointer is on the line. A hot key is a key
    /// on the keyboard, not a letter, so it is the key that types Z with
    /// Command held in the layout in use: on AZERTY, where QWERTY has W.
    static var putBack: Shortcut {
        Shortcut(keyCode: keyCode(typing: "z") ?? kVK_ANSI_Z, modifiers: .command, key: "z")
    }

    /// The key that types this letter with Command held, in a keyboard
    /// layout, by default the one in use.
    static func keyCode(typing letter: String,
                        in source: TISInputSource? = TISCopyCurrentKeyboardLayoutInputSource()?.takeRetainedValue()) -> Int? {
        guard let source, let data = TISGetInputSourceProperty(source, kTISPropertyUnicodeKeyLayoutData) else { return nil }
        let layout = Unmanaged<CFData>.fromOpaque(data).takeUnretainedValue() as Data
        return layout.withUnsafeBytes { bytes -> Int? in
            guard let keys = bytes.baseAddress?.assumingMemoryBound(to: UCKeyboardLayout.self) else { return nil }
            let command = UInt32((cmdKey >> 8) & 0xFF)
            for code in 0..<128 {
                var dead: UInt32 = 0
                var chars = [UniChar](repeating: 0, count: 4)
                var length = 0
                let status = UCKeyTranslate(keys, UInt16(code), UInt16(kUCKeyActionDown), command,
                                            UInt32(LMGetKbdType()), OptionBits(kUCKeyTranslateNoDeadKeysBit),
                                            &dead, chars.count, &length, &chars)
                if status == noErr, String(utf16CodeUnits: chars, count: length).lowercased() == letter { return code }
            }
            return nil
        }
    }

    /// The user's choice for showing the line. Nil means no shortcut at all.
    static var current: Shortcut? {
        get { saved("shortcut") ?? standard }
        set { save(newValue, "shortcut") }
    }

    /// The user's choice for searching the line. Nil means no shortcut at all.
    static var search: Shortcut? {
        get { saved("searchShortcut") ?? standardSearch }
        set { save(newValue, "searchShortcut") }
    }

    /// Nil when never changed, so the standard one applies; `.some(nil)`
    /// when removed.
    private static func saved(_ defaultsKey: String) -> Shortcut?? {
        guard let saved = UserDefaults.standard.dictionary(forKey: defaultsKey) else { return nil }
        guard let code = saved["keyCode"] as? Int, let flags = saved["modifiers"] as? UInt,
              let key = saved["key"] as? String else { return .some(nil) }
        return Shortcut(keyCode: code, modifiers: NSEvent.ModifierFlags(rawValue: flags), key: key)
    }

    private static func save(_ shortcut: Shortcut?, _ defaultsKey: String) {
        UserDefaults.standard.set(shortcut.map {
            ["keyCode": $0.keyCode, "modifiers": $0.modifiers.rawValue, "key": $0.key] as [String: Any]
        } ?? [:], forKey: defaultsKey)
    }

    /// From a key press, if it makes a usable global shortcut: it needs
    /// Command, Control or Option, so typing alone never triggers it.
    init?(event: NSEvent) {
        let flags = event.modifierFlags.intersection([.command, .control, .option, .shift])
        guard !flags.intersection([.command, .control, .option]).isEmpty,
              let key = event.charactersIgnoringModifiers?.lowercased(), !key.isEmpty else { return nil }
        self.init(keyCode: Int(event.keyCode), modifiers: flags, key: key)
    }

    init(keyCode: Int, modifiers: NSEvent.ModifierFlags, key: String) {
        self.keyCode = keyCode
        self.modifiers = modifiers
        self.key = key
    }

    var carbonModifiers: Int {
        var carbon = 0
        if modifiers.contains(.command) { carbon |= cmdKey }
        if modifiers.contains(.control) { carbon |= controlKey }
        if modifiers.contains(.option) { carbon |= optionKey }
        if modifiers.contains(.shift) { carbon |= shiftKey }
        return carbon
    }

    /// As macOS writes it in menus: ⌃⌥⇧⌘ and the key.
    var display: String {
        var text = ""
        if modifiers.contains(.control) { text += "⌃" }
        if modifiers.contains(.option) { text += "⌥" }
        if modifiers.contains(.shift) { text += "⇧" }
        if modifiers.contains(.command) { text += "⌘" }
        return text + (key == " " ? L("Space") : key.uppercased())
    }
}

/// Asks for a new shortcut in a small window: the next key press with
/// Command, Control or Option becomes it. Escape cancels and Delete leaves
/// the line without a shortcut.
@MainActor
final class ShortcutRecorder: NSObject, NSWindowDelegate {
    static let shared = ShortcutRecorder()

    private var window: NSWindow?
    private var monitor: Any?
    private var done: ((Shortcut??) -> Void)?

    /// Calls back with the new shortcut, `.some(nil)` for none, or nil if
    /// cancelled.
    func record(_ done: @escaping (Shortcut??) -> Void) {
        finish(nil)
        self.done = done

        let title = NSTextField(labelWithString: L("Press the new shortcut"))
        title.font = .systemFont(ofSize: 15, weight: .semibold)
        let hint = NSTextField(labelWithString: L("Escape cancels. Delete removes the shortcut."))
        hint.font = .systemFont(ofSize: 12)
        hint.textColor = .secondaryLabelColor
        let stack = NSStackView(views: [title, hint])
        stack.orientation = .vertical
        stack.spacing = 6
        stack.edgeInsets = NSEdgeInsets(top: 22, left: 28, bottom: 22, right: 28)

        let window = NSWindow(contentRect: .zero, styleMask: [.titled, .closable], backing: .buffered, defer: false)
        window.title = L("Change Shortcut")
        window.contentView = stack
        window.isReleasedWhenClosed = false
        window.delegate = self
        window.center()
        self.window = window
        NSApp.activate(ignoringOtherApps: true)
        window.makeKeyAndOrderFront(nil)

        monitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            guard let self, event.window === self.window else { return event }
            let plain = event.modifierFlags.intersection([.command, .control, .option, .shift]).isEmpty
            if event.keyCode == UInt16(kVK_Escape) && plain {
                self.finish(nil)
            } else if (event.keyCode == UInt16(kVK_Delete) || event.keyCode == UInt16(kVK_ForwardDelete)) && plain {
                self.finish(.some(nil))
            } else if let shortcut = Shortcut(event: event) {
                self.finish(.some(shortcut))
            } else {
                NSSound.beep()
            }
            return nil
        }
    }

    func windowWillClose(_ notification: Notification) {
        guard (notification.object as? NSWindow) === window else { return }
        window = nil
        finish(nil)
    }

    private func finish(_ result: Shortcut??) {
        if let monitor { NSEvent.removeMonitor(monitor) }
        monitor = nil
        let done = self.done
        self.done = nil
        window?.close()
        window = nil
        done?(result)
    }
}

```

### Core Architecture Module: `Sources/Tendedero/Inbox.swift`
```
import Foundation

/// Inbox mode: Tendedero takes over where screenshots go.
///
/// It changes the macOS screenshot settings in the Options menu of
/// Cmd+Shift+5: the floating thumbnail is turned off, so the file is written
/// at once instead of five seconds later, and captures are saved as files in
/// Tendedero's own folder, so the Desktop only gets what you keep. Saving to
/// the clipboard or Preview would leave nothing to hang, and a click on the
/// line copies anyway.
/// Screen recordings go there too, and hang on the line like screenshots.
///
/// The previous values are saved first and put back when the mode is turned
/// off or the app quits, so macOS is never left pointing at a folder nobody
/// is watching.
enum Inbox {
    private static let domain = "com.apple.screencapture" as CFString
    /// macOS 26 and earlier read "location". macOS 27 reads
    /// "location-screenshot" and ignores the old key, so both are written.
    private static let locationKey = "location" as CFString
    private static let screenshotLocationKey = "location-screenshot" as CFString
    /// macOS 27 keeps screen recordings apart, in "location-screenrecording".
    /// Earlier versions send them wherever "location" points.
    private static let recordingLocationKey = "location-screenrecording" as CFString
    private static let thumbnailKey = "show-thumbnail" as CFString
    /// Whether a capture is saved as a file or sent to the clipboard, Preview
    /// and so on. macOS 26 and earlier read "target"; macOS 27 has one for
    /// screenshots and one for recordings.
    private static let targetKey = "target" as CFString
    private static let screenshotTargetKey = "target-screenshot" as CFString
    private static let recordingTargetKey = "target-screenrecording" as CFString

    private static let enabledKey = "inboxEnabled"
    private static let offeredKey = "inboxOffered"
    private static let savedKey = "inboxSavedSettings"

    static let folder: URL = {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return base.appendingPathComponent("Tendedero/Screenshots", isDirectory: true)
    }()

    /// The user's choice, kept across launches.
    static var isEnabled: Bool {
        get { UserDefaults.standard.bool(forKey: enabledKey) }
        set { UserDefaults.standard.set(newValue, forKey: enabledKey) }
    }

    /// Whether we already asked, so the offer appears only once.
    static var wasOffered: Bool {
        get { UserDefaults.standard.bool(forKey: offeredKey) }
        set { UserDefaults.standard.set(newValue, forKey: offeredKey) }
    }

    /// Whether macOS is currently sending screenshots to our folder.
    static var isApplied: Bool {
        guard let current = CFPreferencesCopyAppValue(locationKey, domain) as? String else { return false }
        return URL(fileURLWithPath: (current as NSString).expandingTildeInPath).standardizedFileURL
            == folder.standardizedFileURL
    }

    static func apply() {
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        // Never save our own values as the "previous" ones, for example after
        // a crash left them applied.
        var saved = UserDefaults.standard.dictionary(forKey: savedKey) ?? [:]
        if !isApplied {
            saved = [:]
            saved["location"] = CFPreferencesCopyAppValue(locationKey, domain) as? String
            saved["locationScreenshot"] = CFPreferencesCopyAppValue(screenshotLocationKey, domain) as? String
            saved["thumbnail"] = CFPreferencesCopyAppValue(thumbnailKey, domain) as? Bool
        }
        // Recordings and the target came later: settings saved by an earlier
        // version lack them, and the value macOS has now is still the user's own.
        if saved["recordingSaved"] == nil {
            saved["locationRecording"] = CFPreferencesCopyAppValue(recordingLocationKey, domain) as? String
            saved["recordingSaved"] = true
        }
        if saved["targetSaved"] == nil {
            saved["target"] = CFPreferencesCopyAppValue(targetKey, domain) as? String
            saved["targetScreenshot"] = CFPreferencesCopyAppValue(screenshotTargetKey, domain) as? String
            saved["targetRecording"] = CFPreferencesCopyAppValue(recordingTargetKey, domain) as? String
            saved["targetSaved"] = true
        }
        UserDefaults.standard.set(saved, forKey: savedKey)
        set(locationKey, folder.path)
        set(screenshotLocationKey, folder.path)
        set(recordingLocationKey, folder.path)
        set(targetKey, "file")
        set(screenshotTargetKey, "file")
        set(recordingTargetKey, "file")
        set(thumbnailKey, false)
    }

    static func restore() {
        guard isApplied else { return }
        let saved = UserDefaults.standard.dictionary(forKey: savedKey) ?? [:]
        set(locationKey, saved["location"])
        set(screenshotLocationKey, saved["locationScreenshot"])
        set(recordingLocationKey, saved["locationRecording"])
        set(targetKey, saved["target"])
        set(screenshotTargetKey, saved["targetScreenshot"])
        set(recordingTargetKey, saved["targetRecording"])
        set(thumbnailKey, saved["thumbnail"])
        UserDefaults.standard.removeObject(forKey: savedKey)
    }

    /// Writes through cfprefsd, so the screenshot service sees it at once.
    /// A nil value removes the key and returns it to the macOS default.
    private static func set(_ key: CFString, _ value: Any?) {
        CFPreferencesSetAppValue(key, value as CFPropertyList?, domain)
        CFPreferencesAppSynchronize(domain)
    }
}

```

### Core Architecture Module: `Sources/Tendedero/Line.swift`
```
import AppKit
import AVFoundation
import Combine
import os

let log = Logger(subsystem: "app.tendedero.Tendedero", category: "line")

/// One screenshot hanging on the line.
struct Pegged: Identifiable, Equatable {
    let id = UUID()
    let url: URL
    var thumb: NSImage
    /// Every photo hangs a little crooked, like on a real line.
    let tilt = Double.random(in: -2.5...2.5)
    var falling = false
    /// Still flying in from where it was captured; the card waits hidden.
    var flying = false
    /// Pinned, left of the knot: it stays until you take it down.
    var kept = false
    /// Taken off the line to hold in front of you. Its clip waits empty
    /// until it comes back.
    var held = false
    /// Hung from another app with Hang on Tendedero, rather than pinned
    /// from the photos that came and went. Always pinned.
    var byHand = false
    /// A screen recording rather than a screenshot.
    var isRecording: Bool { Tendedero.isRecording(url) }

    static func == (a: Pegged, b: Pegged) -> Bool {
        a.id == b.id && a.falling == b.falling && a.flying == b.flying && a.kept == b.kept && a.byHand == b.byHand && a.held == b.held && a.thumb === b.thumb
    }
}

/// The line itself: what hangs on it and what you can do with each item.
/// The files never move. The line is only a view onto them.
@MainActor
final class Line: ObservableObject {
    @Published private(set) var items: [Pegged] = []
    @Published private(set) var gust = 0
    @Published private(set) var copiedIDs: Set<UUID> = []
    @Published private(set) var selectedIDs: Set<UUID> = []
    private var copyGeneration = 0
    @Published var draggingID: UUID?
    @Published var pressedID: UUID?
    /// Whether the line has slid down into view.
    @Published var revealed = false {
        didSet {
            guard revealed != oldValue else { return }
            gustWork?.cancel()
            gustWork = nil
            if revealed { scheduleGust(); refreshNotes() }
        }
    }

    /// Card frames in window coordinates, reported by the views. The panel
    /// uses them to only catch clicks over photos and let the rest through.
    var hitRects: [UUID: CGRect] = [:]

    var maxItems = 8
    /// How many photos fit across the screen. With Keep on line set, the
    /// line can hold more, and the rest are reached by scrolling.
    var visibleCount = 8
    /// How far the line is scrolled towards older photos, in points; 0 shows
    /// the newest.
    @Published var scroll: CGFloat = 0

    /// Keep on line, from the menu bar: how many photos the line keeps, or
    /// nil for as many as fit across the screen.
    nonisolated static let keepChoices = [25, 50, 100]
    nonisolated static var keepOnLine: Int? {
        get {
            let n = UserDefaults.standard.integer(forKey: "keepOnLine")
            return keepChoices.contains(n) ? n : nil
        }
        set { UserDefaults.standard.set(newValue ?? 0, forKey: "keepOnLine") }
    }


    var soundOn: Bool {
        get { !UserDefaults.standard.bool(forKey: "soundOff") }
        set { UserDefaults.standard.set(!newValue, forKey: "soundOff") }
    }

    var liveCount: Int { items.filter { !$0.falling }.count }

    // MARK: Searching

    /// The words of what hangs, read once per item.
    let search = SearchIndex()
    /// What is typed in the search field under the line.
    @Published var query = ""
    var isSearching: Bool { !SearchIndex.words(query).isEmpty }

    /// What hangs, narrowed by the search. A photo that is falling stays,
    /// so its fall is not cut short.
    var shown: [Pegged] {
        let words = SearchIndex.words(query)
        guard !words.isEmpty else { return items }
        return items.filter { $0.falling || search.matches($0.url, words) }
    }

    var shownCount: Int { shown.filter { !$0.falling }.count }

    /// Photos hung by hand. They hang together at the left end of the line,
    /// before the knot, and never fall to make room.
    var keptCount: Int { items.filter { !$0.falling && $0.kept }.count }

    /// How many photos at the start of the line are pinned, the empty
    /// places of pinned ones that just came down included.
    var pinnedLead: Int { items.prefix { $0.kept }.count }

    /// The oldest photo that can fall: the first one past the knot.
    private var oldestLoose: Pegged? { items.first { !$0.falling && !$0.kept && !$0.held } }

    private let storeKey = "pegged"
    private let pasteboard: NSPasteboard
    private let desktop: URL

    init(pasteboard: NSPasteboard = .general,
         desktop: URL = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Desktop")) {
        self.pasteboard = pasteboard
        self.desktop = desktop
        restore()
        search.onChange = { [weak self] in self?.objectWillChange.send() }
        // What already hangs is read once, a moment after launch.
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) { [weak self] in self?.indexForSearch() }
    }

    private func indexForSearch() {
        search.update(items.filter { !$0.falling }.map(\.url))
    }

    // MARK: Hanging and dropping

    @discardableResult
    func hang(_ url: URL, quietly: Bool = false, flying: Bool = false) -> UUID? {
        guard !items.contains(where: { $0.url == url && !$0.falling }),
              let thumb = makeThumbnail(url) else { return nil }
        var item = Pegged(url: url, thumb: thumb)
        item.flying = flying
        // The line moves anyway for a new photo, so the gaps close with it.
        sweepFallen()
        items.append(item)
        scroll = 0
        // A full line lets the oldest photo fall off the far end. Only one: a
        // line hung on a wider screen keeps its length here instead of losing
        // several photos to a single capture.
        if liveCount > maxItems, let oldest = oldestLoose {
            letGo(oldest.id)
        }
        save()
        if !quietly { play("Tink", volume: 0.35) }
        return item.id
    }

    /// The capture has reached the line: the real card takes over.
    func land(_ id: UUID) {
        guard let i = items.firstIndex(where: { $0.id == id }) else { return }
        items[i].flying = false
    }

    /// Called just before a photo starts falling, so the fall can be drawn
    /// over the whole screen.
    var onFall: ((Pegged) -> Void)?

    /// Hold, from a photo's menu: the app takes it off the line.
    var onHold: ((UUID) -> Void)?
    /// A click on a held photo's faded trace: it comes back.
    var onHangBack: ((UUID) -> Void)?

    func drop(_ id: UUID, quietly: Bool = false) {
        guard let i = items.firstIndex(where: { $0.id == id }), !items[i].falling else { return }
        selectedIDs.remove(id)
        onFall?(items[i])
        items[i].falling = true
        hitRects[id] = nil
        save()
        if !quietly { play("Pop", volume: 0.25) }
        lastFall = Date()
    }

    /// When the last photo started falling. A fallen photo keeps its empty
    /// place while the pointer stays on the line, so the next cross stays
    /// under it while discarding several in a row.
    private var lastFall = Date.distantPast

    /// The pointer left the line: the gaps close, once the last photo has
    /// finished falling.
    func closeGaps() {
        guard items.contains(where: { $0.falling }),
              Date().timeIntervalSince(lastFall) >= 0.6 else { return }
        sweepFallen()
    }

    /// The fallen photos leave their places and the rest close up.
    private func sweepFallen() {
        items.removeAll { $0.falling }
    }

    /// "Take everything down": every photo past the knot goes the way of its
    /// corner cross. What you hung by hand stays.
    func clear() {
        takeDown(items.filter { !$0.falling && !$0.kept && !$0.held })
    }

    /// The photos hung before (left) or after (right) this one.
    func neighbours(of id: UUID, toTheLeft: Bool) -> [Pegged] {
        let live = items.filter { !$0.falling }
        guard let i = live.firstIndex(where: { $0.id == id }) else { return [] }
        return (toTheLeft ? Array(live[..<i]) : Array(live[(i + 1)...])).filter { !$0.kept && !$0.held }
    }

    /// Takes down everything on one side of a photo. Each one goes the way
    /// of its own corner button: to the Trash from Tendedero's folder, and
    /// only off the line from anywhere else.
    func takeDown(_ id: UUID, toTheLeft: Bool) {
        takeDown(neighbours(of: id, toTheLeft: toTheLeft))
    }

    /// One after another, and only the first makes a sound. They are one
    /// step, so Put back brings them all back at once.
    private func takeDown(_ live: [Pegged]) {
        let step = UUID()
        for (n, item) in live.enumerated() {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.06 * Double(n)) { [weak self] in
                self?.discard(item.id, quietly: n > 0, step: step)
            }
        }
    }

    /// Photos whose file was deleted or moved away fall off by themselves.
    func prune() {
        for item in items where !item.falling && !FileManager.default.fileExists(atPath: item.url.path) {
            drop(item.id, quietly: true)
        }
    }

    // MARK: Selecting photos

    /// A selection follows the line's order, not the order of the clicks.
    var selectedItems: [Pegged] { actionItems(Array(selectedIDs)) }

    private func actionItems(_ ids: [UUID]) -> [Pegged] {
        let ids = Set(ids)
        return items.filter { ids.contains($0.id) && !$0.falling && !$0.held }
    }

    func toggleSelection(_ id: UUID) {
        guard !actionItems([id]).isEmpty else { return }
        if !selectedIDs.insert(id).inserted { selectedIDs.remove(id) }
    }

    func clearSelection() { selectedIDs.removeAll() }

    // MARK: Actions on photos

    func copy(_ id: UUID) {
        guard let item = items.first(where: { $0.id == id && !$0.falling }) else { return }
        copyPhotos([item])
    }

    func copy(_
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #159** (2026-11-24): **fix: prevent crash when reattaching the screenshot line**
  *Symptoms*: ## What and why  Prevent an intermittent crash when revealing the screenshot line or recovering its window after a Space change. Three local crash reports pointed to `LineView.scrollBounds(width:)`, called while `keepOnActiveSpace()` reattached the hosting view.  `LinePanel` attaches its content at zero width before the caller restores its frame. With enough pinned photos on a scrolling line, the knot can lie beyond that temporary right edge, so `start...width` traps with `Range requires lowerBound <= upperBound`.  Clamp the lower bound to the right edge until there is room again. Normal-width layout is unchanged. Add a native regression using nine photos, six pinned, that reattaches the actual hosting view to a replacement `LinePanel` and checks that photos, pins, and hit regions survive.  ## How you tested it  On a real Apple Silicon Mac running macOS 27.0.1 (26A434), using the macOS 26.5 SDK:  - Reproduced the Swift range trap with the new regression before the fix. - Ran `bash scripts/test-selection.sh` on this branch based on upstream main: all 82 checks passed. - Ran `swift scripts/check-strings.swift`: all 86 strings checked across 13 languages. - `git diff --check` passed.  The native checks use generated images, isolated preferences, and a private pasteboard. Long-term use across Spaces remains to be observed. 

- **Issue #146** (2026-11-17): **No copia notas al pie de un texto**
  *Symptoms*: ### What happened  Cuando copio un texto desde Adobe InDesign que incluye estilos y notas al pie, el contenido se copia en formato RTF. Con **Tendedero** las notas al pie desaparecen por completo, tanto la referencia como el contenido de la nota misma.  ### Steps to reproduce  <img width="964" height="892" alt="Captura de pantalla 2026-11-16 a la(s) 5 38 41 p  m" src="https://github.com/user-attachments/assets/bad463c6-5494-4bcc-8743-c6631099d357" />  <img width="1066" height="1026" alt="Captura de pantalla 2026-11-16 a la(s) 5 39 25 p  m" src="https://github.com/user-attachments/assets/eb99bfb9-54f3-45e3-a459-15f2451fd3d2" />  ### macOS version  Mac Os 15.7.9   ### Tendedero version  2.0  ### Is "Handle screenshots" on?  Yes  ### Anything else  _No response_

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

### Incident Patch 1: `4bfebc66` (2026-11-24)
**Commit Message**: fix: prevent crash when reattaching the screenshot line (#159)

**File**: `Sources/Tendedero/LineView.swift` (modified, +3/-1)
```diff
@@ -162,7 +162,9 @@ struct LineView: View {
         let pinnedStay = Layout.pinnedEdge(count: shown.count, width: width,
                                            visible: line.visibleCount, pinned: pinned) != nil
         let start = pinnedStay ? knotX(width: width) ?? 0 : 0
-        return start...width
+        // Reattaching to a Space window briefly gives the view zero width.
+        // Collapse the visible range while the knot is past the right edge.
+        return min(start, width)...width
     }
 
     /// Halfway between the last pinned photo and the next one, or half a
```

**File**: `scripts/test-selection.swift` (modified, +23/-0)
```diff
@@ -97,6 +97,7 @@ struct CheckFailed: Error { let message: String }
 
     func run() throws {
         Inbox.folder = root.appendingPathComponent("inbox", isDirectory: true)
+        try checkWindowReattachment()
         let a = try png("A.png"), b = try png("B.png", red: 0.7), c = try png("C.png", red: 0.9)
         let line = line()
         let aID = line.hang(a, quietly: true)!, bID = line.hang(b, quietly: true)!, cID = line.hang(c, quietly: true)!
@@ -506,6 +507,28 @@ struct CheckFailed: Error { let message: String }
                   "Undo after copy watcher callbacks preserves the original and restores exactly one card")
     }
 
+    /// A replacement Space window attaches the hosting view before restoring
+    /// its width. A pinned knot may then sit beyond the temporary right edge.
+    func checkWindowReattachment() throws {
+        let line = line()
+        Line.keepOnLine = 100
+        for i in 0..<9 {
+            let id = line.hang(try png("Reattach-\(i).png"), quietly: true)!
+            if i < 6 { line.pin(id, quietly: true) }
+        }
+        show(line)
+        let content = window.contentView!
+        window.contentView = NSView()
+        let replacement = LinePanel(content: content)
+        replacement.setFrame(window.frame, display: false)
+        replacement.orderFrontRegardless()
+        pump(0.3)
+        try check(line.items.count == 9 && line.pinnedLead == 6,
+                  "Reattaching a scrolling line preserves all photos and pins without crashing")
+        try check(line.hitRects.count == 9, "Cards regain hit regions after the window width is restored")
+        replacement.orderOut(nil)
+    }
+
     func cleanUp() {
         window?.orderOut(nil)
         pasteboard.releaseGlobally()
```

---

### Incident Patch 2: `0edae67c` (2026-11-15)
**Commit Message**: Fix AirDrop dialogs opening against the top of the screen (#136)

The window a sharing service opens, like AirDrop's, hung from the photo at the top of the screen and could end up partly off it. The share panel still opens beside the photo, and the service's window now opens in the middle of the same screen. Both anchors go away when sharing ends.

**File**: `Sources/Tendedero/Share.swift` (modified, +20/-5)
```diff
@@ -26,8 +26,12 @@ final class Share: NSObject, NSSharingServicePickerDelegate, NSSharingServiceDel
 
     /// The share panel hangs from a view, and the photo's own view is gone
     /// once the line puts itself away. An invisible window in the card's
-    /// place holds the panel, and whatever the chosen service opens next to it.
-    private lazy var anchor: NSWindow = {
+    /// place holds the panel. Once a service is chosen, its window belongs
+    /// in the middle of that screen, not up against the card's screen edge.
+    private lazy var anchor = Self.makeAnchor()
+    private lazy var serviceAnchor = Self.makeAnchor()
+
+    private static func makeAnchor() -> NSWindow {
         let window = NSWindow(contentRect: .zero, styleMask: .borderless, backing: .buffered, defer: true)
         window.isOpaque = false
         window.backgroundColor = .clear
@@ -37,7 +41,7 @@ final class Share: NSObject, NSSharingServicePickerDelegate, NSSharingServiceDel
         // Above the line, which floats.
         window.level = NSWindow.Level(rawValue: NSWindow.Level.floating.rawValue + 1)
         return window
-    }()
+    }
 
     /// Shows the share panel for the photo at `url`, whose card is at
     /// `cardFrame` on screen.
@@ -74,6 +78,7 @@ final class Share: NSObject, NSSharingServicePickerDelegate, NSSharingServiceDel
 
     private func done() {
         anchor.orderOut(nil)
+        serviceAnchor.orderOut(nil)
         picker = nil
         isOpen = false
         safety?.invalidate()
@@ -131,12 +136,22 @@ final class Share: NSObject, NSSharingServicePickerDelegate, NSSharingServiceDel
     nonisolated func sharingService(_ sharingService: NSSharingService,
                                     sourceWindowForShareItems items: [Any],
                                     sharingContentScope: UnsafeMutablePointer<NSSharingService.SharingContentScope>) -> NSWindow? {
-        MainActor.assumeIsolated { anchor }
+        MainActor.assumeIsolated {
+            // Keep the picker's anchor at the photo. Moving that window while
+            // AppKit hands over to a service also moves the service's window.
+            let centre = NSPoint(x: anchor.frame.midX, y: anchor.frame.midY)
+            if let screen = NSScreen.screens.first(where: { NSMouseInRect(centre, $0.frame, false) }) ?? NSScreen.main {
+                let area = screen.visibleFrame
+                serviceAnchor.setFrame(NSRect(x: area.midX - 1, y: area.midY - 1, width: 2, height: 2), display: false)
+            }
+            serviceAnchor.orderFront(nil)
+            return serviceAnchor
+        }
     }
 
     nonisolated func sharingService(_ sharingService: NSSharingService,
                                     sourceFrameOnScreenForShareItem item: Any) -> NSRect {
-        MainActor.assumeIsolated { anchor.frame }
+        MainActor.assumeIsolated { serviceAnchor.frame }
     }
 
     nonisolated func sharingService(_ sharingService: NSSharingService, didShareItems items: [Any]) {
```

#### Recent Merged Pull Requests:
- **PR #159** (2026-11-24): fix: prevent crash when reattaching the screenshot line (@channingkuo)
- **PR #156** (2026-11-24): Add Russian Localization (@snowlander)
- **PR #143** (2026-11-24): Add Greek localization (@Camthalion77)
- **PR #140** (2026-11-15): Sounds start off the main thread, so a photo no longer waits for its chime (@pablopeza)
- **PR #136** (2026-11-15): Fix AirDrop dialogs opening against the top of the screen (@ashzene)
- **PR #131** (2026-11-15): Copy each screenshot as it hangs, an option at first launch and in the menu bar (@alvaro-freire)

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

## X. prevent crash when reattaching the screenshot line

**RULE**:
When implementing operations in `Sources/Tendedero/LineView.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in alejandrobujan/tendedero. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `4bfebc66`: prevent crash when reattaching the screenshot line. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `Sources/Tendedero/LineView.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
        // Reattaching to a Space window briefly gives the view zero width.
        // Collapse the visible range while the knot is past the right edge.
        return min(start, width)...width
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
        return start...width
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `4bfebc66` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
