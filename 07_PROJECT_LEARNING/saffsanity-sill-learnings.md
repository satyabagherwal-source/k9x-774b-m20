> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/saffsanity-sill-learnings.md`  
> **Source**: github ([https://github.com/Saffsanity/sill](https://github.com/Saffsanity/sill))  
> **Source Version**: `5c323e69`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-16T09:06:18.217Z  
> **Learning ID**: `learn-github-saffsanity-sill`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): Saffsanity/sill

> **Canonical Artifact**: `07_PROJECT_LEARNING/saffsanity-sill-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Saffsanity/sill](https://github.com/Saffsanity/sill))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-16T09:06:17.131Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Saffsanity/sill`
- **Description**: Any window from your Mac, live on your iPhone or iPad. Touch, Apple Pencil, trackpad and keys. Free, open source, no servers.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2105 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Sources/SillHost/EncoderSlowState.swift`
```
import Foundation

/// Whether a hardware stream's session has settled in the encoder engine's slow state, and whether
/// the new session HEVCEncoder then gives the stream runs any faster. Pure (Foundation only):
/// HEVCEncoder keeps it under its lock and tells it about every frame the capture delivers, every
/// frame that comes back encoded (with its turnaround: hand-over to output) and when a new session
/// took over; it is checked on its own with swiftc against scripted streams in virtual time
/// (`Tests/checks/encoder-slowstate`, which CI runs).
///
/// The slow state (CLAUDE.md, "The 33 fps plateau"), measured alone on the engine at 3024×1964:
/// every fresh session started fast (9 ms a frame, then ~16 ms paced to 57 fps); about a second
/// into a quiet spell an isolated frame took 29 ms, and once motion resumed every frame did for as
/// long as it lasted (90 s of 90): 34 fps out of 57 captured, one frame inside at a time.
///
/// The rule: a session that has run fast (a frame back in under `slowTurnaround`) and now, over the
/// last `window` seconds, gets at least `minInputFPS` frames a second from the capture in each half
/// of the window while the median turnaround of what came back is at least `slowTurnaround` and at
/// least `slowFactor` times the fastest frame the session has returned, is replaced
/// (`Event.replace`), at most once per `minSpacing`. The factor keeps a session that is merely at
/// the engine's capacity near `slowTurnaround` (6880×2880 at 60 fps: 25.5 ms at the median, 24.65
/// at best) from being replaced for nothing, while the slow state is 1.8 times the paced fast
/// state (29 ms against 16) and 3.2 times a fresh session's 9. A session that never ran fast (a
/// frame size the engine is simply slow at) is never replaced.
///
/// The new session is timed on its frames after its first (a keyframe) while the motion that set
/// off the swap lasts (`inMotion`): the first frame handed over without it ends the timing, since
/// sparse frames make a session slow within about a second (seen in new sessions too: 29 ms a
/// frame 0.55 s after the picture stopped, and 15 ms once motion came back), so they say nothing
/// of how it keeps up with a stream. The verdict (`Event.judged`) comes at `judgeFrames` timed
/// frames, when the timing ends, or at the first frame back `judgeWithin` after the swap: the
/// median of those frames if there are at least `minJudged`, else none (the picture went still).
/// One no faster (its median at least `noFasterFraction` of the replaced session's: then the
/// engine is slow, as beside another app, not the session) ends the replacing for this stream
/// (`gaveUp`).
struct EncoderSlowState {
    static let window: CFTimeInterval = 2
    /// Frames a second from the capture: in each half of `window` for a replace, and in the second
    /// before a new session's frame went in for that frame to be timed.
    static let minInputFPS = 45
    static let slowTurnaround: CFTimeInterval = 0.025
    /// A median this many times the session's fastest frame or more is slow (and `slowTurnaround`).
    static let slowFactor = 1.5
    /// A new session whose median is at least this fraction of the replaced session's is no faster.
    static let noFasterFraction = 0.8
    /// A frame is timed only if the capture before its hand-over came within this of the one
    /// before it (and `minInputFPS` came in the second before).
    static let motionGap: CFTimeInterval = 0.1
    /// The fewest frames back in the window for its median to count.
    static let minReturns = 10
    /// At most one new session in this long (one that could not be made counts too).
    static let minSpacing: CFTimeInterval = 10
    /// A new session is judged on this many frames after its first, or on those back within
    /// `judgeWithin` of the swap (or before the motion ended) if there are at least `minJudged`.
    static let judgeFrames = 30
    static let judgeWithin: CFTimeInterval = 2
    static let minJudged = 5

    /// The session replaced, over the window that condemned it.
    struct Slow: Equatable {
        /// The median turnaround, in seconds.
        let turnaround: CFTimeInterval
        /// Frames captured, and frames back, a second.
        let inputFPS: Double
        let outputFPS: Double
    }

    /// How a new session's first frames went.
    struct Report: Equatable {
        let slow: Slow
        /// The median turnaround of the new session's frames timed in motion after its first; nil
        /// when fewer than `minJudged` were (the picture went still).
        let turnaround: CFTimeInterval?
        /// How many frames that median is of.
        let judged: Int
        /// The new session's first frame (a keyframe): its bytes, its own turnaround, and the time
        /// from the old session's last frame back to it (the stream's wait for a frame across the
        /// swap).
        let keyframeBytes: Int
        let firstTurnaround: CFTimeInterval
        let gap: CFTimeInterval
        /// No faster: the stream keeps this session and gets no other.
        var noFaster: Bool { turnaround.map { $0 >= EncoderSlowState.noFasterFraction * slow.turnaround } ?? false }
    }

    enum Event: Equatable {
        /// Make a new session: the next frame handed over goes into it (`swapped`).
        case replace(Slow)
        /// The new session's verdict, once.
        case judged(Report)
    }

    private struct Judging {
        let slow: Slow
        let swapAt: CFTimeInterval
        /// When the old session's last frame came back.
        let lastOldReturn: CFTimeInterval
        var first: (bytes: Int, turnaround: CFTimeInterval, at: CFTimeInterval)?
        /// The frames after the first timed while the motion lasted.
        var turnarounds: [CFTimeInterval] = []
        /// A frame after the first went in without motion: no later frame is timed.
        var motionEnded = false
    }

    private enum Phase {
        case watching
        /// A new session was asked for and has not taken over yet.
        case making(Slow)
        case judging(Judging)
    }

    private var phase = Phase.watching
    /// When the evidence about the current session began: the stream's start, or the verdict on
    /// the session that replaced its predecessor.
    private var watchingSince: CFTimeInterval
    /// When a new session last took over, or could not be made; -infinity for never.
    private var lastAttempt = -CFTimeInterval.infinity
    /// The fastest frame the current session has returned; +infinity before its first. It has run
    /// fast once this is under `slowTurnaround`.
    private var fastest = CFTimeInterval.infinity
    /// A new session was no faster: the stream keeps the one it has.
    private(set) var gaveUp = false
    /// Capture times, and the frames back (when, and their turnaround), within the last `window`.
    private var captures: [CFTimeInterval] = []
    private var returns: [(at: CFTimeInterval, turnaround: CFTimeInterval)] = []
    private var lastReturnAt = -CFTimeInterval.infinity

    init(now: CFTimeInterval) { watchingSince = now }

    /// The capture delivered a frame (a re-encode of the last frame is not one).
    mutating func captured(at now: CFTimeInterval) {
        captures.append(now)
        dropOld(now)
    }

    /// A frame came back encoded, `bytes` long, `turnaround` seconds after it was handed over.
    mutating func returned(turnaround: CFTimeInterval, bytes: Int, at now: CFTimeInterval) -> Event? {
        lastReturnAt = now
        returns.append((now, turnaround))
        dropOld(now)
        fastest = min(fastest, turnaround)
        switch phase {
        case .making:
            return nil
        case .judging(var j):
            guard let first = j.first else {
                j.first = (bytes, turnaround, now)
                phase = .judging(j)
                return nil
            }
            if !j.motionEnded {
                if inMotion(handedOverAt: now - turnaround) { j.turnarounds.append(turnaround) } else { j.motionEnded = true }
            }
            guard j.turnarounds.count >= Self.judgeFrames || j.motionEnded || now - j.swapAt >= Self.judgeWithin else {
                phase = .judging(j)
                return nil
            }
            let report = Report(slow: j.slow,
                                turnaround: j.turnarounds.count >= Self.minJudged ? Self.median(j.turnarounds) : nil,
                                judged: j.turnarounds.count, keyframeBytes: first.bytes,
                                firstTurnaround: first.turnaround, gap: first.at - j.lastOldReturn)
            if report.noFaster { gaveUp = true }
            phase = .watching
            watchingSince = now
            return .judged(report)
        case .watching:
            guard !gaveUp, fastest < Self.slowTurnaround, turnaround >= Self.slowTurnaround,
                  now - watchingSince >= Self.window, now - lastAttempt >= Self.minSpacing else { return nil }
            let half = Self.window / 2, need = Double(Self.minInputFPS) * half
            guard Double(inputs(after: now - half, through: now)) >= need,
                  Double(inputs(after: now - Self.window, through: now - half)) >= need,
                  returns.count >= Self.minReturns else { return nil }
            let median = Self.median(returns.map(\.turnaround))
            guard median >= max(Self.slowTurnaround, Self.slowFactor * fastest) else { return nil }
            let slow = Slow(turnaround: median, inputFPS: Double(captures.count) / Self.window,
                            outputFPS: Double(returns.count) / Self.window)
            phase = .making(slow)
            return .replace(slow)
        }
    }

    /// The next frame went into the new session.
    mutating func swapped(at now: CFTimeInterval) {
        guard case .making(let slow) = phase else { return }
        phase = .judging(Judging(slow: slow, swapAt: now, 
```

### Core Architecture Module: `Sources/SillMenuBar/DebugHooks.swift`
```
import AppKit
import SwiftUI
import SillHostCore
import StreamProtocol

/// Test hooks, read from the launch arguments like the iOS app's -SillLayout harness. Each does
/// nothing unless it is passed, so they stay in release builds, where the tests run.
///
///     --synthetic                              the Desktop is a test pattern and nothing is
///                                              advertised, as with the CLI (test clients connect
///                                              to the port in the "Status: Test Pattern Mode" line)
///     -SillLogFile <path>                      log file instead of ~/Library/Logs/Sill/Sill.log
///     -SillSetAfter '<s> key=value[,key=value][; <s> …]'
///                                              change settings s seconds after launch, exactly as
///                                              a control would (maxFPS, captureScale, bitrate,
///                                              awayBitrate, awayCaptureScale,
///                                              prioritizeSpeed, virtualDisplay, directWireless,
///                                              remoteAccess, remotePort, internetAccess,
///                                              remoteAddressName=host[:port], updateCheck,
///                                              requirePairing=0|1). Saved like any change
///                                              (requirePairing in the identity store: memory, or
///                                              SILL_TEST_REMOTE_DIR)
///     -requirePairing YES|NO                   Require pairing at launch, saved in the identity
///                                              store as the Devices pane saves it
///     -SillPairAfter <s>                       open a pairing window (Pair iPhone or iPad…) s
///                                              seconds after launch. With --synthetic and
///                                              SILL_TEST_REMOTE_DIR the link and the code are
///                                              also left there as pairing.url and pairing.code
///                                              (0600), never printed (the log copies stdout)
///     -SillCancelPairingAfter '<s>[; <s> …]'   close the pairing window as its Cancel does (a
///                                              window a device opened quiets its asker), s
///                                              seconds after launch
///     -SillUnpairAfter <s>                     remove every paired device s seconds after launch
///     -SillCableNoticeAfter <s>                show the notice for a device paired over the USB
///                                              cable (a sample one) s seconds after launch
///     -SillMenuAfter '<s>[; <s> …]'            print the status menu as menu.txt shows it, one
///                                              "SillMenuAfter <s> s: " line per line, s seconds
///                                              after launch (the "‹device› Wants to Pair",
///                                              older-device and "Devices Can’t Connect" items)
///     -SillQuitAfter <s>                       Quit (NSApp.terminate) s seconds after launch
///     -SillUpdateFeed <url>                    the update check asks this feed instead of GitHub:
///                                              a feed on this Mac only (http or https to
///                                              127.0.0.1, ::1 or localhost; anything else is
///                                              ignored with one line). With it any http or https
///                                              release page counts, and test pattern mode checks
///     -SillUpdateNow 1                         one check right after the host starts, as Check Now
///     -SillUpdateVersion <v>                   the version the check compares (the bare binary has
///                                              none, so it never checks without this)
///     -SillUpdateInterval <s>                  the check's 24 hours become s seconds (the hour's
///                                              retry s/24, at least 1 s; the launch delay at most
///                                              s; no jitter)
///     -SillPrintMenuAfter <s>                  print the status menu as it would open (as menu.txt
///                                              draws it, "menu: " before each line) and Settings ›
///                                              General's update line, s seconds after launch
///     -SillSettingsAfter '<s> <tab>[; <s> <tab> …]'
///                                              open Settings on that tab s seconds after launch,
///                                              as the menu does, and 0.6 s later print the window's
///                                              frame, its pane's whole height and how much shows,
///                                              the visible frame it fits and the cap (issue #59).
///                                              A tab by its name or the start of one (remote,
///                                              general, virtual); close closes the window; report
///                                              prints it as it stands; end scrolls the pane to its
///                                              last row; height=<points> sets
///                                              -SillTestScreenHeight (0: the screen's own) and
///                                              posts the screens' change, as the Dock or a
///                                              display would
///     -SillTestScreenHeight <points>           the Settings window fits the top <points> of its
///                                              screen's visible frame, as if the screen were that
///                                              short with the Dock at its bottom
///     -SillSettingsShot <dir>                  each -SillSettingsAfter step also writes the window
///                                              (title bar, toolbar, pane) to <dir>/settings-<s>s-<tab>.png
///     -SillRenderPreviews <dir>                write the Settings panes (the Devices and Remote
///                                              Access panes in each of their states, General's
///                                              update section in each of its), the pairing
///                                              window's states and the cable notice,
///                                              status cards, glyphs and menu.txt to <dir>, then
///                                              exit (no Screen Recording needed: views render
///                                              offscreen; no identity is loaded, no listener)
///
/// These are the bare SillMenuBar binary's (defaults domain "SillMenuBar"; delete it after). Sill.app
/// itself, an app bundle's executable, ignores every `-Sill…After` hook and `-requirePairing`, each
/// with one line (docs/home-pairing-plan.md §6.6): they open, answer or remove pairings, or change
/// what the doors admit, and any process of this user can start Sill.app with arguments, which then
/// runs with Sill's Screen Recording and Accessibility grants. `-SillTestScreenHeight` and
/// `-SillSettingsShot` go with `-SillSettingsAfter` and are ignored the same way: Sill.app has no
/// use for them. `--synthetic`, `-SillLogFile`,
/// `-SillRenderPreviews` and the update check's `-SillUpdateFeed`, `-SillUpdateNow`,
/// `-SillUpdateVersion` and `-SillUpdateInterval` stay: they bear on no door and no pairing (a feed
/// on this Mac only).
///
/// The bare binary (and any --synthetic run) never touches the login keychain: its identity lives
/// in SILL_TEST_REMOTE_DIR or in memory (AppModel.makeRemoteAccess).
///
/// The timers are run-loop Timers, never Tasks: NSApp.terminate may run a modal loop, which from
/// a Task would stall the main queue (see AppDelegate).
@MainActor
enum DebugHooks {
    /// Where the log file goes. Read before the app starts (main.swift).
    nonisolated static var logFileURL: URL {
        if let path = UserDefaults.standard.string(forKey: "SillLogFile"), !path.isEmpty {
            return URL(fileURLWithPath: (path as NSString).expandingTildeInPath)
        }
        let library = FileManager.default.urls(for: .libraryDirectory, in: .userDomainMask).first
            ?? FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library")
        return library.appendingPathComponent("Logs/Sill/Sill.log")
    }

    /// The timed hooks, which Sill.app itself ignores.
    static let timedHooks = ["SillSetAfter", "SillPairAfter", "SillCancelPairingAfter", "SillUnpairAfter",
                             "SillCableNoticeAfter", "SillMenuAfter", "SillPrintMenuAfter", "SillSettingsAfter", "SillQuitAfter"]
    /// The Settings window's test arguments (issue #59), which Sill.app itself ignores too.
    static let windowHooks = ["SillTestScreenHeight", "SillSettingsShot"]

    /// TEST ONLY (-SillTestScreenHeight <points>, and -SillSettingsAfter's height=): the Settings
    /// window fits the top <points> of its screen's visible frame (SettingsWindowFit.visible). Nil in
    /// Sill.app itself, and without it.
    static var testScreenHeight: CGFloat? = {
        guard !AppModel.bundled else { return nil }
        let h = UserDefaults.standard.double(forKey: "SillTestScreenHeight")
        return h > 0 ? CGFloat(h) : nil
    }()

    /// The update check's configuration: GitHub and the plan's schedule, with the running version
    /// from the bundle, unless the test arguments above say otherwise. Read once, when the model is
    /// made; nothing here makes a request.
    static func updateConfiguration(testPattern: Bool) -> UpdateChecker.Configuration {
        let defaults = UserDefaults.standard
        var c = UpdateChecker.Configuration()
        c.testPattern = testPattern
        c.running = Bundle.ma
```

### Core Architecture Module: `iOSClient/MacMenuState.swift`
```
import Foundation
import StreamProtocol

/// One connection's view of the Mac's menus (kinds 24, 25 and 27; docs/menu-bar-plan.md §7.2): the
/// top level the Mac last sent, the menus this device asked for and waits on, the choices it sent,
/// and when a wait has lasted too long. Pure logic (Foundation and StreamProtocol, no UIKit), so it
/// is checked on its own (Tests/checks/menu-state, with mutants). StreamClient owns one on the main
/// thread and runs the completions it hands back; MacMenuElements turns what it holds into menus.
///
/// Each open menu is one completion, known here by a key (a UIKit provider's), settled exactly once:
/// by the answer to its fetch, at once when nothing may be asked, by the timeout, or by the end of
/// the connection. A key leaves the state when it is settled.
///
/// The rules:
/// 1. Nothing before the first top level: until one has arrived, for all this device knows, the
///    Mac is an older one. A menu opened then (only ever after a tear-down) is "Not connected.".
/// 2. A top level replaces the one before. A new version settles every waiting fetch of another
///    version with "The menus changed. Open the menu again.".
/// 3. One fetch per menu: opening a menu whose fetch is waiting joins it (UIKit may ask a provider
///    more than once), and one kind 27 goes out. It carries the title the menu was shown under: the
///    Mac reads the menu only while the item at its id still has that title.
/// 4. An answer settles only the fetch with its token. An unknown token is dropped: a late answer
///    after its timeout.
/// 5. An answer whose version is not the fetch's settles it with "The menus changed…". A menu
///    whose row came from another version than the current one is settled so at once, unasked:
///    its id is a place in an older tree.
/// 6. Timeout: `expire` settles a fetch that has waited the caller's timeout (max(4 s, 4 × the
///    worst recent round trip)) with "‹Mac› didn’t answer. Open the menu again.".
/// 7. Stale (the Mac reports the app not answering): no menu is fetched, each settles with the
///    note alone; an answer that is stale shows its rows, every one disabled, under the note.
/// 8. Presses: never for a disabled row, never before a top level; while stale, refused here with
///    the note, unsent. A `pressed: false` answer is a refusal to tell the user; `pressed: true`
///    is nothing: the Mac shows the result.
/// 9. `reset` (every tear-down) settles every waiting completion with "Not connected." and
///    empties everything; `connectionReplaced` (a move's hand-over) settles the waiting fetches,
///    whose answers come on the connection the session left, and keeps the top level.
/// 10. `sections`: separators split the items into sections, leading, trailing and doubled ones
///    dropped; an item without a title is dropped; a mark "-" or "–" is mixed, any other mark on;
///    `more > 0` adds a last disabled row "‹n› more on the Mac"; no rows at all, no note and
///    nothing more gives one disabled row, "No items". A stale answer or a refusal carries its
///    note and no items, and shows the note alone.
/// 11. A menu of the top level asks by what it showed: UIKit rebuilds the iPad's bar lazily (at
///    the next key event or focus change, measured), so a bar menu can have been built from an
///    older top level than the current one, even another session's: versions start again at each
///    launch of the Mac's host, so a reconnect, or another Mac, can reach the version it was built
///    in with other menus. So its own id only while the current top level's menu there has its
///    title; else the id of the current top level's first menu with the same title (the old app's
///    File finds the new app's File); with no such menu, none (`barMenuID`).
///
/// What the Mac sends is cleaned here as any text from the Mac is (SafeText): titles to 100
/// characters, shortcuts to 16, notes to 300. The top level keeps at most 32 menus, each with an id
/// of one part (1–4 digits, no leading zero) that no earlier menu has: the iPad's bar gives each an
/// identifier made from its id, and two equal identifiers in one build throw.
struct MacMenuState: Equatable {
    /// One row of a menu as the device draws it.
    struct Row: Equatable {
        enum Kind: Equatable { case item, submenu, note }
        enum Mark: Equatable { case off, on, mixed }
        var kind: Kind
        /// The Mac's id ("2.9"); nil for a note.
        var id: String?
        var title: String
        /// The Mac's shortcut as text ("⇧⌘S"), shown as the row's subtitle, never a key command.
        var key: String?
        var enabled: Bool
        var mark: Mark
        /// The tree version the row was sent in: its fetch or its choice carries it, so the Mac
        /// refuses one from an older tree instead of acting on whatever sits at that place now.
        var version: Int?

        init(kind: Kind, id: String? = nil, title: String, key: String? = nil, enabled: Bool = true,
             mark: Mark = .off, version: Int? = nil) {
            self.kind = kind; self.id = id; self.title = title; self.key = key
            self.enabled = enabled; self.mark = mark; self.version = version
        }

        /// A disabled row of words: a note, "No items", "‹n› more on the Mac".
        static func note(_ text: String) -> Row { Row(kind: .note, title: text, enabled: false) }
    }

    typealias Section = [Row]

    /// What an opened menu gets: its sections (`more`: how many items the Mac left out), or words
    /// of the device's own (a timeout, the menus changed, not connected).
    enum Content: Equatable {
        case sections([Section], more: Int)
        case message(String)
    }

    /// A completion's key, and what it gets.
    struct Done: Equatable {
        let key: Int
        let content: Content
    }

    /// A choice that was not made: the warning, the announcement and the console line.
    struct Refusal: Equatable {
        let title: String
        let id: String
        let note: String
        /// The Mac refused it (a `pressed: false` answer); false: never sent (stale here).
        let byMac: Bool
        var announcement: String { "Couldn’t choose \(title). \(note)" }
    }

    /// What `fetch` makes of an opened menu.
    enum Fetch: Equatable {
        /// A kind 27 to send; the completion waits for its answer.
        case send(FetchMenu)
        /// A fetch of the same menu waits already; the completion waits with it.
        case joined
        /// Settled at once, nothing sent.
        case settled(Content)
    }

    /// What `press` makes of a chosen row.
    enum Press: Equatable {
        case send(PressMenuItem)
        case refused(Refusal)
    }

    /// The top level as the bar and the Menus button draw it: a change here rebuilds the bar and
    /// replaces the button's menu.
    struct Top: Equatable {
        var version: Int?
        var app: String?
        var menus: [Row]
        var stale: Bool
        var note: String?
    }

    static let changedNote = "The menus changed. Open the menu again."
    static let notConnected = "Not connected."
    static let noItems = "No items"
    static func noAnswer(mac: String) -> String { "\(mac.isEmpty ? "The Mac" : mac) didn’t answer. Open the menu again." }
    static func moreOnTheMac(_ count: Int) -> String { "\(count) more on the Mac" }
    static let maxMenus = 32
    static let titleLimit = 100, keyLimit = 16, noteLimit = 300
    /// Choices waiting for their answer, at most (each is answered, or the connection ends).
    static let maxChoices = 16

    private(set) var version: Int?
    private(set) var app: String?
    /// The top level, each a `.submenu` row, in the Mac's order.
    private(set) var menus: [Row] = []
    private(set) var stale = false
    private(set) var note: String?

    /// Whether the Menus button shows: menus, or a note to show (no Accessibility on the Mac).
    var hasMenus: Bool { !menus.isEmpty || note != nil }
    var top: Top { Top(version: version, app: app, menus: menus, stale: stale, note: note) }

    private struct Waiting: Equatable {
        let id: String
        let title: String
        let version: Int
        let token: Int
        var keys: [Int]
        let sentAt: Double
    }
    /// The fetches sent and not answered yet, oldest first.
    private var waiting: [Waiting] = []

    private struct Choice: Equatable {
        let token: Int
        let id: String
        let title: String
    }
    /// The choices sent and not answered yet, oldest first.
    private var choices: [Choice] = []

    /// When the oldest waiting fetch was sent: the timeout's next look.
    var oldestWait: Double? { waiting.map(\.sentAt).min() }
    /// The completions waiting, joined ones included.
    var waitingKeys: [Int] { waiting.flatMap(\.keys) }

    // MARK: From the Mac

    /// A kind 24: a top level (it has `menus`), or the answer to one of this device's fetches or
    /// choices (by `answering`). Returns the completions it settles, whether the top level changed,
    /// and a refused choice.
    mutating func receive(_ m: MacMenu, now: Double) -> (done: [Done], topChanged: Bool, refusal: Refusal?) {
        if let items = m.menus {
            // Every kind 24 has its version; a top level without one says nothing this device can use.
            guard let v = m.version else { return ([], false, nil) }
            let before = top
            version = v
            app = Self.clean(m.app, limit: SafeText.labelLimit)
            stale = m.stale == true
            note = Self.clean(m.note, limit: Self.noteLimit)
            if stale, note == nil { note = "\(app ?? "The app") isn’t responding." }
            menus = Self.topRows(items, version: v)
            // Rule 2: what was asked of another tree is answered here.
            var done: [Done] = []
            waiting.removeAll { w in
                guard w.version != vers
```

### Core Architecture Module: `Package.swift`
```
// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "Sill",
    platforms: [.macOS(.v14), .iOS(.v17)],
    products: [
        .library(name: "StreamProtocol", targets: ["StreamProtocol"]),
        // The CLI keeps the product name SillHost, so `swift run -c release SillHost …` and
        // .build/release/SillHost are what they always were.
        .executable(name: "SillHost", targets: ["SillHostCLI"]),
        // Sill.app's executable. Scripts/make-app.sh wraps it into the bundle and signs it.
        .executable(name: "SillMenuBar", targets: ["SillMenuBar"]),
        // No product for SillHostCore: the iOS project links this package and must never see it.
    ],
    targets: [
        .target(name: "StreamProtocol"),
        // The Mac host itself (capture, encode, network, input, virtual display), shared by the CLI
        // and the menu bar app; they reach it through `package` access. The folder keeps its old
        // name (Sources/SillHost) so the paths in the docs and the VirtualDisplayProbe symlink to
        // ../SillHost/VirtualDisplay.swift stay valid.
        .target(name: "SillHostCore", dependencies: ["StreamProtocol"], path: "Sources/SillHost"),
        // The command-line host: flags, the run loop, the Terminal permission hint.
        .executableTarget(name: "SillHostCLI", dependencies: ["SillHostCore", "StreamProtocol"]),
        // The menu bar app: status item, Settings and Log windows (AppKit lifecycle, SwiftUI panes).
        .executableTarget(name: "SillMenuBar", dependencies: ["SillHostCore", "StreamProtocol"]),
        // Milestone 3 spike: virtual display + window move + capture. Its VirtualDisplay.swift
        // is a symlink to the host's copy. Not shipped.
        .executableTarget(name: "CaptureProbe"),
        .executableTarget(name: "VirtualDisplayProbe"),
    ]
)

```

### Core Architecture Module: `Scripts/dmg-layout/DMGLayout.swift`
```
import Foundation

/// The window a disk image opens in, as .DS_Store records: icon view with no toolbar, sidebar,
/// path bar or status bar, a background picture the size of its content, and each item's icon at a
/// point of that picture.
struct DMGLayout: Equatable {
    struct Item: Equatable {
        var name: String
        var x: Int
        var y: Int
    }

    /// The window's content in points: the background picture's size at 1x.
    var width: Int
    var height: Int
    /// The window's top-left corner on the screen.
    var left: Int
    var top: Int
    var iconSize: Int
    var textSize: Int
    /// The picture's path on the volume, such as ".background/background.tiff".
    var background: String
    /// The view's colour behind the picture, for where the window is larger than it: the picture's
    /// edge colour. (Finder may show its own fill there instead: white in Light Mode, so a picture
    /// white to its edges, as Sill's is, looks the same either way.)
    var backgroundColor: (red: Int, green: Int, blue: Int)
    /// Where each icon's centre sits, in points from the content's top-left corner.
    var items: [Item]
    /// Hidden items (.background, .VolumeIcon.icns), put below the window, out of sight for anyone
    /// who shows hidden files in Finder; otherwise Finder would place them among the others.
    var hidden: [String]

    /// Finder's WindowBounds is the whole window, its title bar included, and a window with no
    /// toolbar has only that bar above its content: 32 points on macOS 27 (AppKit's
    /// NSWindow.frameRect(forContentRect:styleMask:) for a titled window, on a Mac whose Finder is
    /// built with the same SDK), 28 on macOS 11 to 15 (not measured here). The window is sized for
    /// the taller bar: on macOS 27 its content is exactly the picture, and under a 28-point bar it
    /// is 4 points taller, a strip below the picture that shows white, as every edge of the picture
    /// is (make-dmg.sh's backgroundColor, and Finder's own fill in Light Mode). Sized for 28, the
    /// window would hide the picture's bottom 4 points on macOS 27; sized to the picture alone, as
    /// some images are (a Finder-made one of 2023: 512 x 400 for a 512 x 400 picture), 32.
    static let titleBar = 32

    static func == (a: DMGLayout, b: DMGLayout) -> Bool {
        a.width == b.width && a.height == b.height && a.left == b.left && a.top == b.top
            && a.iconSize == b.iconSize && a.textSize == b.textSize && a.background == b.background
            && a.backgroundColor == b.backgroundColor && a.items == b.items && a.hidden == b.hidden
    }

    var windowBounds: String { "{{\(left), \(top)}, {\(width), \(height + Self.titleBar)}}" }

    /// Browser window settings: the window's place and size, and no bars.
    var browserWindowSettings: [String: Any] {
        [
            "ContainerShowSidebar": false,
            "PreviewPaneVisibility": false,
            "ShowPathbar": false,
            "ShowSidebar": false,
            "ShowStatusBar": false,
            "ShowTabView": false,
            "ShowToolbar": false,
            "SidebarWidth": 0,
            "WindowBounds": windowBounds,
        ]
    }

    /// Icon view options: the picture (type 2) through its alias, icon and text size, no grid
    /// arrangement, names below the icons.
    func iconViewSettings(backgroundAlias: Data) -> [String: Any] {
        [
            "arrangeBy": "none",
            "backgroundColorBlue": Double(backgroundColor.blue) / 255,
            "backgroundColorGreen": Double(backgroundColor.green) / 255,
            "backgroundColorRed": Double(backgroundColor.red) / 255,
            "backgroundImageAlias": backgroundAlias,
            "backgroundType": 2,
            "gridOffsetX": 0.0,
            "gridOffsetY": 0.0,
            "gridSpacing": 100.0,
            "iconSize": Double(iconSize),
            "labelOnBottom": true,
            "showIconPreview": true,
            "showItemInfo": false,
            "textSize": Double(textSize),
            "viewOptionsVersion": 1,
        ]
    }

    /// An icon's place: its centre, then the four bytes ff ff ff ff and ff ff 00 00 Finder writes.
    static func location(x: Int, y: Int) -> Data {
        var data = Data()
        data.appendWord(UInt32(x))
        data.appendWord(UInt32(y))
        data.append(contentsOf: [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0, 0])
        return data
    }

    /// Where the hidden items go: a row below the window's content.
    func hiddenLocation(_ index: Int) -> (x: Int, y: Int) {
        (x: iconSize + index * (iconSize + 60), y: height + iconSize * 2)
    }

    /// The .DS_Store records for this window, the background named by `backgroundAlias`.
    func records(backgroundAlias: Data) throws -> [DSRecord] {
        func plist(_ value: [String: Any]) throws -> Data {
            try PropertyListSerialization.data(fromPropertyList: value, format: .binary, options: 0)
        }
        var records = [
            DSRecord(name: ".", code: "bwsp", value: .blob(try plist(browserWindowSettings))),
            DSRecord(name: ".", code: "icvp", value: .blob(try plist(iconViewSettings(backgroundAlias: backgroundAlias)))),
            DSRecord(name: ".", code: "vSrn", value: .long(1)),
            DSRecord(name: ".", code: "vstl", value: .type("icnv")),   // icon view, whatever the Mac's default view
        ]
        for item in items {
            records.append(DSRecord(name: item.name, code: "Iloc", value: .blob(Self.location(x: item.x, y: item.y))))
        }
        for (index, name) in hidden.enumerated() {
            let place = hiddenLocation(index)
            records.append(DSRecord(name: name, code: "Iloc", value: .blob(Self.location(x: place.x, y: place.y))))
        }
        return records.sorted(by: DSStore.precedes)
    }

    /// The whole .DS_Store for the volume mounted at `volume`, whose background file must be there.
    func dsStore(onVolumeAt volume: String, timeZone: TimeZone = .current) throws -> Data {
        let alias = try FinderAlias.forFile(background, onVolumeAt: volume)
        return try DSStore.encode(try records(backgroundAlias: try alias.encoded(timeZone: timeZone)))
    }
}

/// The volume's own icon: .VolumeIcon.icns at its root, shown only while the root folder's Finder
/// info has the custom-icon flag (kHasCustomIcon, 0x0400, the 2-byte Finder flags at offset 8 of
/// the 32-byte com.apple.FinderInfo). SetFile -a C sets it; SetFile ships with Xcode's command line
/// tools only, so this sets the attribute itself, keeping the other 30 bytes.
enum VolumeIcon {
    static let attribute = "com.apple.FinderInfo"
    static let hasCustomIcon: UInt16 = 0x0400

    static func finderInfo(_ path: String) -> [UInt8] {
        var bytes = [UInt8](repeating: 0, count: 32)
        let read = getxattr(path, attribute, &bytes, 32, 0, XATTR_NOFOLLOW)
        return read == 32 ? bytes : [UInt8](repeating: 0, count: 32)
    }

    static func flags(_ path: String) -> UInt16 {
        let info = finderInfo(path)
        return UInt16(info[8]) << 8 | UInt16(info[9])
    }

    static func setCustomIcon(_ path: String) throws {
        var info = finderInfo(path)
        let flags = (UInt16(info[8]) << 8 | UInt16(info[9])) | hasCustomIcon
        info[8] = UInt8(flags >> 8)
        info[9] = UInt8(flags & 0xff)
        guard setxattr(path, attribute, info, 32, 0, XATTR_NOFOLLOW) == 0 else {
            throw DSStoreError("can't set \(path)'s custom-icon flag: \(String(cString: strerror(errno)))")
        }
    }
}

```

### Core Architecture Module: `Scripts/dmg-layout/DSStore.swift`
```
import Foundation

// The .DS_Store file Finder reads to lay out a folder's window: which view, the window's size and
// place, the background picture and where each icon sits. Scripts/make-dmg.sh writes one into
// Sill.dmg with this code instead of asking Finder to (AppleScript would need Automation
// permission, and Finder, to lay out a window, needs a logged-in session that shows it).
//
// The format is Apple's and undocumented; this follows the file Finder itself writes (a disk
// image's .DS_Store is one B-tree leaf, and Finder's own for such a folder is 10,244 bytes laid out
// exactly as `encode` lays it out) and the descriptions in Mac::Finder::DSStore's
// DSStoreFormat.pod and the ds_store Python package, whose layout Finder-made images share:
//
// - The file is a 4-byte 1, then a "buddy allocator" whose addresses count from byte 4. Its header,
//   at address 0, is "Bud1", the root block's address and size, the address again, and 16 bytes
//   Finder leaves as 00 00 10 0c and zeros.
// - Every block has a power-of-two size of at least 32 bytes, at an address that is a multiple of
//   its size, and is named by a 32-bit word: the address with the size's log2 in the low 5 bits.
// - The root block lists the blocks by number (in pages of 256 words), a table of contents that
//   names block 1 "DSDB", and the free lists: for each size 2^0 to 2^31, the addresses of the free
//   blocks of that size. The allocated and the free blocks cover the 2 GiB address space exactly.
// - "DSDB" is five words: the B-tree's root node (a block number), its levels below the root, the
//   number of records, the number of nodes and the page size, 4096.
// - A node is a word that is 0 for a leaf (else the last child's block number), a count, and the
//   records, sorted by file name without regard to case, then by code.
// - A record is its file name (a word counting UTF-16 units, then UTF-16BE), a four-character code
//   such as "Iloc", a four-character type and the value: "long" and "shor" 4 bytes, "bool" 1,
//   "type" 4, "comp" and "dutc" 8, "blob" a length and bytes, "ustr" a UTF-16 count and UTF-16BE.

/// One record: a file name ("." for the folder itself), a four-character code and a value.
struct DSRecord: Equatable, CustomStringConvertible {
    enum Value: Equatable {
        case long(UInt32)
        case shor(UInt16)
        case bool(Bool)
        case type(String)
        case comp(UInt64)
        case dutc(UInt64)
        case blob(Data)
        case ustr(String)
    }

    var name: String
    var code: String
    var value: Value

    var description: String {
        let shown: String
        switch value {
        case .long(let v): shown = "long \(v)"
        case .shor(let v): shown = "shor \(v)"
        case .bool(let v): shown = "bool \(v)"
        case .type(let v): shown = "type '\(v)'"
        case .comp(let v): shown = "comp \(v)"
        case .dutc(let v): shown = "dutc \(v)"
        case .blob(let v): shown = "blob \(v.count) bytes"
        case .ustr(let v): shown = "ustr \"\(v)\""
        }
        return "\"\(name)\" \(code) \(shown)"
    }
}

struct DSStoreError: Error, CustomStringConvertible {
    let description: String
    init(_ description: String) { self.description = description }
}

enum DSStore {
    /// Finder's page size, the size of every B-tree node.
    static let pageSize = 0x1000

    // Where encode puts the blocks: as Finder does for a folder with a few records.
    static let headerAddress = 0x0, headerSize = 0x20     // the "Bud1" header itself
    static let masterAddress = 0x40, masterSize = 0x20    // "DSDB", block 1
    static let leafAddress = 0x1000                       // the one node, block 2, a page
    static let rootAddress = 0x2000, rootSize = 0x800     // the allocator's root block, block 0

    /// Whether `a` sorts before `b` in a .DS_Store: by file name without regard to case (as Finder
    /// compares names on a case-insensitive volume), then by code.
    static func precedes(_ a: DSRecord, _ b: DSRecord) -> Bool {
        let an = Array(a.name.lowercased().utf16), bn = Array(b.name.lowercased().utf16)
        if an != bn { return an.lexicographicallyPrecedes(bn) }
        return Array(a.code.utf8).lexicographicallyPrecedes(Array(b.code.utf8))
    }

    /// A whole .DS_Store holding `records` (in any order) in one leaf node.
    static func encode(_ records: [DSRecord]) throws -> Data {
        let sorted = records.sorted(by: precedes)
        for (a, b) in zip(sorted, sorted.dropFirst()) where !precedes(a, b) {
            throw DSStoreError("two records for \"\(a.name)\" \(a.code)")
        }

        var leaf = Data()
        leaf.appendWord(0)                         // a leaf: no children
        leaf.appendWord(UInt32(sorted.count))
        for record in sorted { try leaf.appendRecord(record) }
        guard leaf.count <= pageSize else {
            throw DSStoreError("the records take \(leaf.count) bytes, more than one \(pageSize)-byte node; this writer makes only one")
        }

        var master = Data()
        master.appendWord(2)                       // the root node: block 2
        master.appendWord(0)                       // no levels below it
        master.appendWord(UInt32(sorted.count))
        master.appendWord(1)                       // one node
        master.appendWord(UInt32(pageSize))

        let allocated = [
            (address: headerAddress, size: headerSize), (address: masterAddress, size: masterSize),
            (address: leafAddress, size: pageSize), (address: rootAddress, size: rootSize),
        ]
        var root = Data()
        let blocks = [(rootAddress, rootSize), (masterAddress, masterSize), (leafAddress, pageSize)]
        root.appendWord(UInt32(blocks.count))
        root.appendWord(0)
        for index in 0..<256 {
            if index < blocks.count {
                root.appendWord(UInt32(blocks[index].0) | UInt32(log2(blocks[index].1)))
            } else {
                root.appendWord(0)
            }
        }
        root.appendWord(1)                         // the table of contents: one name
        root.append(4)
        root.append(contentsOf: Array("DSDB".utf8))
        root.appendWord(1)                         // "DSDB" is block 1
        let free = freeLists(allocated: allocated)
        for width in 0..<32 {
            root.appendWord(UInt32(free[width].count))
            for address in free[width] { root.appendWord(UInt32(address)) }
        }
        guard root.count <= rootSize else { throw DSStoreError("the root block takes \(root.count) bytes") }

        var file = Data(count: 4 + rootAddress + rootSize)
        file.replace(at: 0, with: word(1))
        var header = Data("Bud1".utf8)
        header.appendWord(UInt32(rootAddress))
        header.appendWord(UInt32(rootSize))
        header.appendWord(UInt32(rootAddress))
        header.append(contentsOf: [0, 0, 0x10, 0x0c] + [UInt8](repeating: 0, count: 12))
        file.replace(at: 4 + headerAddress, with: header)
        file.replace(at: 4 + masterAddress, with: master)
        file.replace(at: 4 + leafAddress, with: leaf)
        file.replace(at: 4 + rootAddress, with: root)
        return file
    }

    /// The free blocks a buddy allocator has around `allocated`, by width (log2 of the size): the
    /// largest aligned blocks of the 2^31-byte space that hold no allocated byte.
    static func freeLists(allocated: [(address: Int, size: Int)]) -> [[Int]] {
        var lists = [[Int]](repeating: [], count: 32)
        func visit(_ address: Int, _ width: Int) {
            let size = 1 << width, end = address + size
            let overlapping = allocated.filter { $0.address < end && address < $0.address + $0.size }
            if overlapping.isEmpty {
                lists[width].append(address)
            } else if overlapping.count == 1, overlapping[0].address == address, overlapping[0].size == size {
                return
            } else if width > 5 {
                visit(address, width - 1)
                visit(address + size / 2, width - 1)
            }
        }
        visit(0, 31)
        return lists.map { $0.sorted() }
    }

    /// The records of a .DS_Store, in the order the file keeps them, whatever its shape.
    static func decode(_ data: Data) throws -> [DSRecord] {
        var reader = ByteReader(data)
        guard try reader.word(at: 0) == 1, try reader.bytes(at: 4, count: 4) == Data("Bud1".utf8) else {
            throw DSStoreError("not a .DS_Store (no \"Bud1\" header)")
        }
        let rootOffset = Int(try reader.word(at: 8)), rootLength = Int(try reader.word(at: 12))
        guard try reader.word(at: 16) == UInt32(rootOffset) else { throw DSStoreError("the header's two root addresses differ") }
        reader.position = 4 + rootOffset
        let blockCount = Int(try reader.nextWord())
        _ = try reader.nextWord()
        var blocks: [UInt32] = []
        for index in 0..<((blockCount + 255) / 256 * 256) {
            let word = try reader.nextWord()
            if index < blockCount { blocks.append(word) }
        }
        var contents: [String: UInt32] = [:]
        for _ in 0..<(try reader.nextWord()) {
            let length = Int(try reader.nextByte())
            let name = String(decoding: try reader.next(length), as: UTF8.self)
            contents[name] = try reader.nextWord()
        }
        guard reader.position <= 4 + rootOffset + rootLength else { throw DSStoreError("the root block's table of contents runs past its end") }
        guard let masterBlock = contents["DSDB"] else { throw DSStoreError("no DSDB in the table of contents") }

        func blockOffset(_ number: UInt32) throws -> Int {
            guard Int(number) < blocks.count else { throw DSStoreError("no block \(number)") }
            return 4 + Int(blocks[Int(number)] & ~0x1f)
        }
        let rootNode = try reader.word(at: try blockOffset(masterBlock))
        var records: [DSRecord] = 
```

### Core Architecture Module: `Scripts/dmg-layout/FinderAlias.swift`
```
import Foundation

// How a .DS_Store names its window's background picture: the "icvp" record's backgroundImageAlias,
// an Alias Manager record (version 2) for a file on the same volume. When the image is mounted,
// Finder finds the picture through it (by the volume's name and creation date, then the file's ID,
// its folder's ID or its path), wherever the volume is mounted.
//
// FinderAlias writes the record as Finder itself does for a background on a disk image's HFS+
// volume (a Finder-made installer image's record, 2023, fields and tags in this order), less the
// last tag, 20, an alias of the read-write image Finder had open, which names the build machine's
// folders and is not needed to find the picture:
//
//     0   4  application info, 0            114   4  the file's ID (its CNID)
//     4   2  the record's length            118   4  the file's creation date
//     6   2  version 2                       122   8  creator and type codes, 0
//     8   2  kind: 0, a file                 130   4  levels from and to, -1 and -1
//    10  28  the volume's name (Pascal)      134   4  volume attributes 0x0d02
//    38   4  the volume's creation date      138  12  file system ID and reserved, 0
//    42   2  file system, "H+"               150      tagged fields, each a 2-byte tag, a 2-byte
//    44   2  disk type 5, ejectable                   length and the value (padded to even), then
//    46   4  the parent folder's ID                   tag -1 with length 0:
//    50  64  the file's name (Pascal)
//
//   0 the parent folder's name      16 the volume's creation date   17 the file's creation date
//   1 the folder IDs up to the root  2 "Volume:folder:\0file"       14 the file's name (UTF-16)
//  15 the volume's name (UTF-16)    18 the file's path on the volume  19 the volume's mount point
//
// The 4-byte dates count seconds since 1904 in local time, as HFS+ keeps a volume's creation date;
// tags 16 and 17 count 1/65536 seconds since 1904 in UTC. Names go into the Pascal strings with ":"
// as "/", the way the Carbon path writes them.

struct FinderAlias: Equatable {
    var volumeName: String
    var volumeCreated: Date
    var parentID: UInt32
    var parentName: String
    var fileID: UInt32
    var fileName: String
    var fileCreated: Date
    /// The IDs of the folders from the file's parent up to (not including) the volume's root.
    var folderIDs: [UInt32]
    /// The file's path on the volume, from its root: "/.background/background.tiff".
    var path: String
    /// Where the volume is mounted when the alias is used: "/Volumes/<name>" on any Mac that opens
    /// the image, whatever folder it was mounted in while being made.
    var mountPoint: String

    static let hfsEpoch = Date(timeIntervalSince1970: -2_082_844_800)   // 1904-01-01 00:00:00 UTC
    static let tags: [Int16] = [0, 16, 17, 1, 2, 14, 15, 18, 19]

    /// The alias for `relativePath` (such as ".background/background.tiff"), a regular file in a
    /// folder on the volume mounted at `volume`, as Finder will see it once the image is mounted at
    /// /Volumes/<the volume's name>.
    static func forFile(_ relativePath: String, onVolumeAt volume: String) throws -> FinderAlias {
        let volumeURL = URL(fileURLWithPath: volume).resolvingSymlinksInPath()
        let values = try volumeURL.resourceValues(forKeys: [.volumeNameKey, .volumeCreationDateKey, .volumeURLKey])
        guard let name = values.volumeName, let created = values.volumeCreationDate else {
            throw DSStoreError("\(volume) reports no volume name or creation date")
        }
        let root = volumeURL.path
        guard let volumeRoot = values.volume?.resolvingSymlinksInPath().path, volumeRoot == root else {
            throw DSStoreError("\(volume) is not the root of a volume")
        }
        let components = relativePath.split(separator: "/").map(String.init)
        guard components.count >= 2, !components.contains(".."), !components.contains(".") else {
            throw DSStoreError("\(relativePath) must name a file in a folder on the volume, such as .background/background.tiff")
        }
        let info = try status(root + "/" + components.joined(separator: "/"))
        guard info.isRegularFile else { throw DSStoreError("\(relativePath) on \(volume) is not a regular file") }

        // The folders between the volume's root and the file, the parent first.
        var folderIDs: [UInt32] = []
        for depth in stride(from: components.count - 1, through: 1, by: -1) {
            folderIDs.append(try status(root + "/" + components[0..<depth].joined(separator: "/")).id)
        }
        return FinderAlias(
            volumeName: name, volumeCreated: created,
            parentID: folderIDs[0], parentName: components[components.count - 2],
            fileID: info.id, fileName: components[components.count - 1], fileCreated: info.created,
            folderIDs: folderIDs, path: "/" + components.joined(separator: "/"),
            mountPoint: "/Volumes/" + name)
    }

    private static func status(_ path: String) throws -> (id: UInt32, created: Date, isRegularFile: Bool) {
        var st = stat()
        guard lstat(path, &st) == 0 else { throw DSStoreError("can't stat \(path): \(String(cString: strerror(errno)))") }
        guard st.st_ino <= UInt64(UInt32.max) else { throw DSStoreError("\(path)'s ID \(st.st_ino) doesn't fit an alias") }
        let created = Date(timeIntervalSince1970: TimeInterval(st.st_birthtimespec.tv_sec)
            + TimeInterval(st.st_birthtimespec.tv_nsec) / 1e9)
        return (UInt32(st.st_ino), created, (st.st_mode & S_IFMT) == S_IFREG)
    }

    /// Whole seconds since 1904 in UTC.
    static func hfsSeconds(_ date: Date) -> Int64 {
        Int64((date.timeIntervalSince(hfsEpoch)).rounded(.down))
    }

    /// The record. `timeZone` makes the two 4-byte dates local time, as HFS+ does (the Mac that makes
    /// the image: its creation date on the volume is that Mac's local time too).
    func encoded(timeZone: TimeZone = .current) throws -> Data {
        func local(_ date: Date) throws -> UInt32 {
            let seconds = Self.hfsSeconds(date) + Int64(timeZone.secondsFromGMT(for: date))
            guard seconds >= 0, seconds <= Int64(UInt32.max) else { throw DSStoreError("\(date) is out of an alias's range") }
            return UInt32(seconds)
        }
        func pascal(_ string: String, _ size: Int) throws -> Data {
            let bytes = Array(string.replacingOccurrences(of: ":", with: "/").utf8)
            guard string.allSatisfy(\.isASCII), bytes.count < size else {
                throw DSStoreError("\"\(string)\" must be ASCII and at most \(size - 1) characters in an alias")
            }
            return Data([UInt8(bytes.count)] + bytes + [UInt8](repeating: 0, count: size - 1 - bytes.count))
        }
        func half(_ value: Int16) -> Data { withUnsafeBytes(of: value.bigEndian) { Data($0) } }
        func long(_ value: UInt64) -> Data { withUnsafeBytes(of: value.bigEndian) { Data($0) } }
        func utf16(_ string: String) -> Data {
            var data = half(Int16(string.utf16.count))
            data.appendUTF16(string)
            return data
        }

        var record = Data([0, 0, 0, 0])                      // application info
        record.append(half(0))                                // the length, filled in below
        record.append(half(2))                                // version 2
        record.append(half(0))                                // a file
        record.append(try pascal(volumeName, 28))
        record.appendWord(try local(volumeCreated))
        record.append(contentsOf: Array("H+".utf8))
        record.append(half(5))                                // ejectable: a disk image
        record.appendWord(parentID)
        record.append(try pascal(fileName, 64))
        record.appendWord(fileID)
        record.appendWord(try local(fileCreated))
        record.append(Data(count: 8))                         // creator and type
        record.append(half(-1))                               // levels from
        record.append(half(-1))                               // levels to
        record.appendWord(0x0d02)                             // volume attributes, as Finder's
        record.append(Data(count: 12))                        // file system ID and reserved

        func tag(_ number: Int16, _ value: Data) {
            record.append(half(number))
            record.append(half(Int16(value.count)))
            record.append(value)
            if value.count % 2 == 1 { record.append(0) }
        }
        tag(0, Data(parentName.replacingOccurrences(of: ":", with: "/").utf8))
        tag(16, long(UInt64(Self.hfsSeconds(volumeCreated)) << 16))
        tag(17, long(UInt64(Self.hfsSeconds(fileCreated)) << 16))
        var ids = Data()
        for id in folderIDs { ids.appendWord(id) }
        tag(1, ids)
        let carbon = path.split(separator: "/").map { $0.replacingOccurrences(of: ":", with: "/") }
        tag(2, Data((volumeName.replacingOccurrences(of: ":", with: "/") + ":" + carbon.joined(separator: ":\0")).utf8))
        tag(14, utf16(fileName))
        tag(15, utf16(volumeName))
        tag(18, Data(path.utf8))
        tag(19, Data(mountPoint.utf8))
        record.append(half(-1))
        record.append(half(0))

        guard record.count <= Int(Int16.max) else { throw DSStoreError("the alias is too long") }
        record.replace(at: 4, with: half(Int16(record.count)))
        return record
    }

    /// The fields of a record, read back: every field `encoded` writes (the 4-byte dates as they
    /// are, local time), and the tags in the order they came.
    struct Fields: Equatable {
        var length: Int, version: Int, kind: Int
        var volumeName: String, volumeDate: UInt32, fileSystem: String, diskType: Int
        var parentID: UInt32, fileName: String, fileID: UInt32, fileDate: UInt32
        var levelsFrom: Int, levelsTo: Int,
```

### Core Architecture Module: `Scripts/dmg-layout/main.swift`
```
import Foundation
import ImageIO
import UniformTypeIdentifiers

// dmg-layout: lays out a disk image's Finder window from the command line, for Scripts/make-dmg.sh.
// Built there with `xcrun swiftc -O Scripts/dmg-layout/*.swift`; nothing here asks Finder anything.
//
//   dmg-layout write VOLUME LAYOUT     writes VOLUME/.DS_Store (DSStore.swift, FinderAlias.swift) and,
//                                      with VOLUME/.VolumeIcon.icns there, sets the volume's
//                                      custom-icon flag
//   dmg-layout check VOLUME LAYOUT     reads them back from a mounted image: the records the layout
//                                      makes, the background's alias leading to the picture on
//                                      this volume, the picture's two sizes, the icon flag
//   dmg-layout dump FILE               prints a .DS_Store's records
//   dmg-layout crop IN OUT WxH         the top-left WxH pixels of IN (a Quick Look render) as a PNG
//
// LAYOUT: --window WxH (the content, in points: the picture's size at 1x) --position X,Y
//   --icon-size N --text-size N --background PATH (on the volume) --background-color RRGGBB
//   --item NAME=X,Y (an icon's centre; repeated) --hidden NAME (repeated)

func fail(_ message: String, status: Int32 = 1) -> Never {
    FileHandle.standardError.write(Data("dmg-layout: \(message)\n".utf8))
    exit(status)
}

func parseLayout(_ arguments: ArraySlice<String>) -> DMGLayout {
    var layout = DMGLayout(width: 0, height: 0, left: 0, top: 0, iconSize: 0, textSize: 0, background: "",
                           backgroundColor: (0, 0, 0), items: [], hidden: [])
    var seen = Set<String>()
    var rest = arguments.makeIterator()
    func pair(_ text: String, _ separator: Character, _ option: String) -> (Int, Int) {
        let parts = text.split(separator: separator).map { Int($0) }
        guard parts.count == 2, let a = parts[0], let b = parts[1], a >= 0, b >= 0 else {
            fail("\(option) takes two whole numbers separated by \"\(separator)\", not \"\(text)\"", status: 2)
        }
        return (a, b)
    }
    while let option = rest.next() {
        guard let value = rest.next() else { fail("\(option) needs a value", status: 2) }
        seen.insert(option)
        switch option {
        case "--window": (layout.width, layout.height) = pair(value, "x", option)
        case "--position": (layout.left, layout.top) = pair(value, ",", option)
        case "--icon-size": layout.iconSize = Int(value) ?? 0
        case "--text-size": layout.textSize = Int(value) ?? 0
        case "--background": layout.background = value
        case "--background-color":
            guard value.count == 6, let rgb = Int(value, radix: 16) else { fail("--background-color takes RRGGBB, not \"\(value)\"", status: 2) }
            layout.backgroundColor = (rgb >> 16, (rgb >> 8) & 0xff, rgb & 0xff)
        case "--item":
            guard let equals = value.lastIndex(of: "=") else { fail("--item takes NAME=X,Y, not \"\(value)\"", status: 2) }
            let (x, y) = pair(String(value[value.index(after: equals)...]), ",", option)
            layout.items.append(.init(name: String(value[..<equals]), x: x, y: y))
        case "--hidden": layout.hidden.append(value)
        default: fail("unknown option \(option)", status: 2)
        }
    }
    for needed in ["--window", "--position", "--icon-size", "--text-size", "--background", "--background-color", "--item"]
    where !seen.contains(needed) {
        fail("\(needed) is missing", status: 2)
    }
    guard layout.width > 0, layout.height > 0, (16...512).contains(layout.iconSize), (10...16).contains(layout.textSize) else {
        fail("the window needs a size, the icons 16 to 512 points and the text 10 to 16", status: 2)
    }
    for item in layout.items where item.x > layout.width || item.y > layout.height {
        fail("\(item.name) at \(item.x),\(item.y) is outside the \(layout.width)x\(layout.height) window", status: 2)
    }
    return layout
}

/// The picture's representations as (width, height, dpi), from its file.
func pictureSizes(_ path: String) -> [(width: Int, height: Int, dpi: Int)] {
    guard let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil) else { return [] }
    return (0..<CGImageSourceGetCount(source)).compactMap { index in
        guard let properties = CGImageSourceCopyPropertiesAtIndex(source, index, nil) as? [CFString: Any],
              let width = properties[kCGImagePropertyPixelWidth] as? Int,
              let height = properties[kCGImagePropertyPixelHeight] as? Int else { return nil }
        let dpi = (properties[kCGImagePropertyDPIWidth] as? Double) ?? 72
        return (width, height, Int(dpi.rounded()))
    }
}

func write(_ volume: String, _ layout: DMGLayout) throws {
    let data = try layout.dsStore(onVolumeAt: volume)
    try data.write(to: URL(fileURLWithPath: volume + "/.DS_Store"), options: .atomic)
    if FileManager.default.fileExists(atPath: volume + "/.VolumeIcon.icns") {
        try VolumeIcon.setCustomIcon(volume)
    }
    print("Wrote \(volume)/.DS_Store (\(data.count) bytes): a \(layout.width)x\(layout.height + DMGLayout.titleBar) window "
          + "(a \(layout.width)x\(layout.height) picture and the title bar), "
          + layout.items.map { "\($0.name) at \($0.x),\($0.y)" }.joined(separator: ", "))
}

/// The path with every symbolic link resolved (/tmp is /private/tmp), or itself when it's not there.
func real(_ path: String) -> String {
    guard let resolved = realpath(path, nil) else { return path }
    defer { free(resolved) }
    return String(cString: resolved)
}

/// How `have` differs from `want`, record by record. Property lists (bwsp, icvp) are compared as
/// what they hold: their bytes follow the order a dictionary happens to have in the process that
/// wrote them.
func differences(_ have: [DSRecord], _ want: [DSRecord]) -> [String] {
    func plist(_ record: DSRecord) -> NSDictionary? {
        guard case .blob(let data) = record.value else { return nil }
        return try? PropertyListSerialization.propertyList(from: data, format: nil) as? NSDictionary
    }
    var problems: [String] = []
    let haveKeys = have.map { "\($0.name) \($0.code)" }, wantKeys = want.map { "\($0.name) \($0.code)" }
    if haveKeys != wantKeys {
        return ["its .DS_Store has the records \(haveKeys), not \(wantKeys)"]
    }
    for (a, b) in zip(have, want) {
        if let pa = plist(a), let pb = plist(b) {
            for key in Set(pa.allKeys.compactMap { $0 as? String } + pb.allKeys.compactMap { $0 as? String }).sorted()
            where !((pa[key] as AnyObject?)?.isEqual(pb[key]) ?? (pb[key] == nil)) {
                problems.append("\(a.name) \(a.code): \(key) is \(pa[key].map { "\($0)" } ?? "missing"), not \(pb[key].map { "\($0)" } ?? "missing")")
            }
        } else if a.value != b.value {
            problems.append("\(a) is not \(b)")
        }
    }
    return problems
}

/// Everything the layout promises, read back from the mounted image. Returns the problems.
func check(_ volume: String, _ layout: DMGLayout) -> [String] {
    var problems: [String] = []
    let root = real(volume)
    guard let data = FileManager.default.contents(atPath: root + "/.DS_Store") else {
        return ["\(volume) has no .DS_Store"]
    }
    let records: [DSRecord]
    do { records = try DSStore.decode(data) } catch { return ["its .DS_Store can't be read: \(error)"] }

    // The alias as the file has it; everything else must be exactly what the layout makes.
    guard let icvp = records.first(where: { $0.name == "." && $0.code == "icvp" }), case .blob(let icvpData) = icvp.value,
          let options = try? PropertyListSerialization.propertyList(from: icvpData, format: nil) as? [String: Any],
          let alias = options["backgroundImageAlias"] as? Data else {
        return ["its .DS_Store has no icon view settings with a background alias"]
    }
    do {
        let expected = try layout.records(backgroundAlias: alias)
        problems += differences(records, expected)
        // The file itself: exactly the blocks, tree and free lists this writer makes of its records.
        if try DSStore.encode(records) != data {
            problems.append("its .DS_Store holds the records, but not laid out as DSStore.encode lays them out")
        }
    } catch {
        problems.append("the layout's records can't be made: \(error)")
    }

    // The alias: every field that doesn't depend on a time zone as the volume has it now, the
    // local-time dates within a time zone of the UTC ones, and resolving to the picture here.
    do {
        let actual = try FinderAlias.fields(of: alias)
        let now = try FinderAlias.forFile(layout.background, onVolumeAt: root)
        let wanted = try FinderAlias.fields(of: try now.encoded(timeZone: TimeZone(identifier: "UTC")!))
        var same = actual, other = wanted
        same.volumeDate = 0; same.fileDate = 0; other.volumeDate = 0; other.fileDate = 0
        if same != other { problems.append("the background alias is \(actual), not \(wanted)") }
        for (local, utc, what) in [(actual.volumeDate, wanted.volumeDate, "volume"), (actual.fileDate, wanted.fileDate, "file")] {
            let offset = Int64(local) - Int64(utc)
            if abs(offset) > 14 * 3600 || offset % 900 != 0 {
                problems.append("the alias's \(what) date is \(offset) s from UTC, not a time zone's offset")
            }
        }
        let resolved = FinderAlias.resolve(alias).map(real)
        if resolved != real(root + "/" + layout.background) {
            problems.append("the background alias leads to \(resolved ?? "nothing"), not \(root)/\(layout.background)")
        }
    } catch {
        problems.append("the background alias can't be checked: \(error)")
    }

    // The picture: 1x at the window's size, 2x at twice it.
    let sizes = pictureSizes(root + "/" + layout.background)
    let
```

### Core Architecture Module: `Scripts/encoder-check/encoder/FakeVT.swift`
```
// A stand-in for the VideoToolbox calls HEVCEncoder.swift makes, and for the two names it takes
// from StreamProtocol and SillHostCore (ParameterSets, Stats). run.sh compiles a copy of the real
// Sources/SillHost/HEVCEncoder.swift with its `import VideoToolbox` and `import StreamProtocol`
// lines removed against these, with the real EncoderMailbox.swift and EncoderProbe.swift, so the
// binary links no VideoToolbox and cannot open an encoder session (run.sh checks with otool). No
// NSLock here (os_unfair_lock only): a check that times the encoder's own NSLock sees only its.
import Foundation
import CoreMedia
import CoreVideo
import QuartzCore

final class UnfairLock {
    private let p: UnsafeMutablePointer<os_unfair_lock>
    init() { p = .allocate(capacity: 1); p.initialize(to: os_unfair_lock()) }
    func lock() { os_unfair_lock_lock(p) }
    func unlock() { os_unfair_lock_unlock(p) }
    func run<T>(_ body: () -> T) -> T { lock(); defer { unlock() }; return body() }
}

// MARK: - Frames whose content and lifetime the check can see

/// Every frame carries one as an attachment: its number (a higher number is newer content), and
/// `alive` counts the frames not yet destroyed, as the pixel buffer lets go of its attachments.
final class Tracker {
    private static let lock = UnfairLock()
    private static var live: Set<Int> = []
    static var alive: [Int] { lock.run { live.sorted() } }
    let seq: Int
    init(seq: Int) { self.seq = seq; Self.lock.run { _ = Self.live.insert(seq) } }
    deinit { let s = seq; Self.lock.run { _ = Self.live.remove(s) } }
}
let trackerKey = "sill.encoder-check.tracker" as CFString

func makeFrame(seq: Int, width: Int = 16, height: Int = 16) -> CVPixelBuffer {
    var pb: CVPixelBuffer?
    CoreVideo.CVPixelBufferCreate(nil, width, height, kCVPixelFormatType_420YpCbCr8BiPlanarFullRange, nil, &pb)
    CVBufferSetAttachment(pb!, trackerKey, Tracker(seq: seq), .shouldNotPropagate)
    return pb!
}
func seqOf(_ b: CVBuffer) -> Int {
    guard let v = CVBufferCopyAttachment(b, trackerKey, nil) else { return -1 }
    return (v as? Tracker)?.seq ?? -1
}

/// EncoderProbe's own test frames: CoreVideo's CVPixelBufferCreate (shadowed for this module), with
/// a tracker numbered from 1_000_001. `probeSeqNow`: the last number given out.
private let probeSeqLock = UnfairLock()
private var probeSeq = 1_000_000
var probeSeqNow: Int { probeSeqLock.run { probeSeq } }
@discardableResult
func CVPixelBufferCreate(_ allocator: CFAllocator?, _ width: Int, _ height: Int, _ format: OSType, _ attrs: CFDictionary?,
                         _ out: UnsafeMutablePointer<CVPixelBuffer?>) -> CVReturn {
    let r = CoreVideo.CVPixelBufferCreate(allocator, width, height, format, attrs, out)
    if r == kCVReturnSuccess, let b = out.pointee {
        let s = probeSeqLock.run { probeSeq += 1; return probeSeq }
        CVBufferSetAttachment(b, trackerKey, Tracker(seq: s), .shouldNotPropagate)
    }
    return r
}

// MARK: - The stand-in session

/// What the stand-in does with one encode call.
enum Behavior {
    /// Accepted; its output comes this long after the call (on a serial engine, this long after the
    /// frame before it is done), never before an earlier frame's (decode order).
    case returnAfter(Double)
    /// Accepted and never comes out; in decode order nothing after it comes out either. The session
    /// keeps the frames it holds, as VideoToolbox keeps a frame's surface until its output.
    case stuck
    /// The encode call itself never returns (2026-09-22's `sample`: the thread inside
    /// VTCompressionSessionEncodeFrameWithOutputHandler → RemoteVideoEncoder).
    case blockCall
    /// The encode call blocks this long, then refuses the frame: an error status, no output.
    case refuse(after: Double)
}

struct Call {
    let session: Int
    let n: Int              // 1 for the session's first encode call
    let seq: Int            // the frame's content
    let pts: CMTime
    let forced: Bool
    let at: CFTimeInterval
    var refused = false
}
struct Output { let session: Int; let n: Int; let at: CFTimeInterval }

enum FakeVT {
    static let lock = UnfairLock()
    /// How each call behaves, by session number (1 for the first session made), call number and the
    /// frame's content number.
    static var plan: (_ session: Int, _ call: Int, _ seq: Int, _ software: Bool) -> Behavior = { _, _, _, _ in .returnAfter(0.009) }
    /// One engine: a frame's time starts when the frame before it is done. Else each frame's time
    /// starts at its call and they overlap.
    static var serialEngine = false
    static var calls: [Call] = []
    static var outputs: [Output] = []
    /// The most frames each session held at once, by session number.
    static var maxHeld: [Int: Int] = [:]
    /// Sessions invalidated: when, and how many frames each still held then.
    static var invalidated: [Int: (at: CFTimeInterval, held: Int)] = [:]
    /// How long VTCompressionSessionCreate takes (a new session for the slow state is made off every
    /// queue of the encoder's, so this delays only its taking over).
    static var createDelay: Double = 0
    /// Called on a session's callback queue just before and just after it runs an output handler,
    /// with the session's number (the delivery-order case of E7 holds a handler with `Inject`).
    static var beforeHandler: ((Int) -> Void)?
    static var afterHandler: ((Int) -> Void)?
    private static var sessionCount = 0

    static func reset(plan p: @escaping (_ session: Int, _ call: Int, _ seq: Int, _ software: Bool) -> Behavior = { _, _, _, _ in .returnAfter(0.009) },
                      serial: Bool = false) {
        lock.run {
            plan = p; serialEngine = serial; calls = []; outputs = []; maxHeld = [:]; invalidated = [:]; createDelay = 0
            beforeHandler = nil; afterHandler = nil
        }
    }
    static func newSession() -> Int { lock.run { sessionCount += 1; return sessionCount } }
    /// The session and call an encoded frame (`onEncoded`'s data) came from.
    static func origin(_ data: Data) -> (session: Int, call: Int)? {
        guard data.count == 8 else { return nil }
        let v = data.withUnsafeBytes { $0.loadUnaligned(as: Int64.self) }
        return (Int(v / 1_000_000), Int(v % 1_000_000))
    }
    static var lastSession: Int { lock.run { sessionCount } }
    static func callsOf(_ session: Int) -> [Call] { lock.run { calls.filter { $0.session == session } } }
    static func outputsOf(_ session: Int) -> [Output] { lock.run { outputs.filter { $0.session == session } } }
}

final class VTCompressionSession {
    let index: Int
    let software: Bool
    private let lock = UnfairLock()
    private var callCount = 0
    /// Frames accepted and not out yet, by call number: the surfaces this "encoder" holds.
    private var held: [Int: CVPixelBuffer] = [:]
    private var lastDue: CFTimeInterval = 0
    private var engineFree: CFTimeInterval = 0
    private var invalid = false
    /// Outputs one after another, in the order the frames went in, as VideoToolbox's.
    private let callbacks: DispatchQueue
    private let never = DispatchSemaphore(value: 0)

    init(software: Bool) {
        self.software = software
        index = FakeVT.newSession()
        callbacks = DispatchQueue(label: "fakevt.callback.\(index)", qos: .userInteractive)
    }

    func encode(_ pb: CVPixelBuffer, pts: CMTime, props: CFDictionary?, handler: @escaping VTCompressionOutputHandler) -> OSStatus {
        let forced = ((props as NSDictionary?)?[kVTEncodeFrameOptionKey_ForceKeyFrame as String] as? Bool) ?? false
        let seq = seqOf(pb)
        let now = CACurrentMediaTime()
        let (n, invalidNow) = lock.run { () -> (Int, Bool) in callCount += 1; return (callCount, invalid) }
        if invalidNow { return -12903 }
        let behavior = FakeVT.lock.run { FakeVT.plan(index, n, seq, software) }
        var call = Call(session: index, n: n, seq: seq, pts: pts, forced: forced, at: now)
        switch behavior {
        case .refuse(let after):
            if after > 0 { Thread.sleep(forTimeInterval: after) }
            call.refused = true
            FakeVT.lock.run { FakeVT.calls.append(call) }
            return -12902
        case .blockCall:
            FakeVT.lock.run { FakeVT.calls.append(call) }
            withExtendedLifetime(pb) { never.wait() }   // never returns: this thread holds the frame for good
            return noErr
        case .stuck:
            FakeVT.lock.run { FakeVT.calls.append(call) }
            let count = lock.run { () -> Int in held[n] = pb; return held.count }
            FakeVT.lock.run { FakeVT.maxHeld[index] = max(FakeVT.maxHeld[index] ?? 0, count) }
            callbacks.async { [never] in never.wait() }   // decode order: nothing after it comes out
            return noErr
        case .returnAfter(let d):
            let serial = FakeVT.lock.run { () -> Bool in
                FakeVT.calls.append(call)
                return FakeVT.serialEngine
            }
            let key = forced || n == 1
            let (due, count) = lock.run { () -> (CFTimeInterval, Int) in
                held[n] = pb
                var due = now + d
                if serial { due = max(now, engineFree) + d; engineFree = due }
                due = max(due, lastDue)
                lastDue = due
                return (due, held.count)
            }
            FakeVT.lock.run { FakeVT.maxHeld[index] = max(FakeVT.maxHeld[index] ?? 0, count) }
            let session = index
            callbacks.async { [self] in
                let wait = due - CACurrentMediaTime()
                if wait > 0 { Thread.sleep(forTimeInterval: wait) }
                lock.run { _ = held.removeValue(forKey: n) }
                let (before, after) = FakeVT.lock.run { () -> (((Int) -> Void)?, ((Int) -> Void)?) in
                    FakeVT.outputs.append(Output(session: session, n: n, at: CACurrentMediaTime()))
       
```

### Core Architecture Module: `Scripts/encoder-check/encoder/main.swift`
```
// Encoder-free check of the real HEVCEncoder.swift (with the real EncoderMailbox.swift and
// EncoderProbe.swift) against the stand-in VideoToolbox in FakeVT.swift, in real time: capture,
// network and callback threads as the host has them. What EncoderMailbox's own check cannot see:
// the glue's threads, locks and queues, the frames a stuck encoder keeps, the keyframe's second
// look on the watchdog's queue, a new session for the slow state (E7).
//
//   Scripts/encoder-check/run.sh encoder
// E7 checks whatever `HEVCEncoder.replacingSlowSessions` is for the run: run.sh runs the check with
// SILL_TEST_ENCODER_RECYCLE=1 (E1–E7) and =0 (E7 alone, `encoder-check E7`).
import Foundation
import CoreMedia
import CoreVideo
import QuartzCore

setvbuf(stdout, nil, _IOLBF, 0)
Inject.install()
let onlyE7 = CommandLine.arguments.dropFirst().first == "E7"
// Read before any encoder is made, so a TEST line from SILL_TEST_ENCODER_RECYCLE prints here, not
// inside E1's "prints nothing when made".
let replacing = HEVCEncoder.replacingSlowSessions
print("new sessions for the slow state: \(replacing ? "on" : "off")")

var checks = 0, failures = 0
func expect(_ ok: Bool, _ what: @autoclosure () -> String) {
    checks += 1
    if !ok { failures += 1; print("  FAIL: \(what())") }
}

print("== the real HEVCEncoder against a stand-in VideoToolbox")

func sleepUntil(_ t: CFTimeInterval) {
    let d = t - CACurrentMediaTime()
    if d > 0.002 { Thread.sleep(forTimeInterval: d - 0.0015) }
    while CACurrentMediaTime() < t {}
}

/// Runs `body` with stdout going to a pipe, and returns what it printed (a few lines at most).
func capturingStdout(_ body: () -> Void) -> String {
    fflush(stdout)
    let pipe = Pipe()
    let saved = dup(STDOUT_FILENO)
    dup2(pipe.fileHandleForWriting.fileDescriptor, STDOUT_FILENO)
    body()
    fflush(stdout)
    dup2(saved, STDOUT_FILENO); close(saved)
    pipe.fileHandleForWriting.closeFile()
    return String(data: pipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
}

func makeEncoder(software: Bool = false, quiet: Bool = false) -> HEVCEncoder {
    try! HEVCEncoder(width: 16, height: 16, fps: 60, bitrate: 1_000_000, prioritizeSpeed: false, software: software, quiet: quiet)
}

/// Output times, thread-safe.
final class Outputs {
    private let lock = UnfairLock()
    private var times: [CFTimeInterval] = []
    private var keys = 0
    func add(key: Bool) { lock.run { times.append(CACurrentMediaTime()); if key { keys += 1 } } }
    var all: [CFTimeInterval] { lock.run { times } }
    var keyframes: Int { lock.run { keys } }
}

/// Feeds `count` new frames at `fps` from a capture queue, numbered from `from`. Returns when the
/// last went in, with the time the first did.
@discardableResult
func feed(_ enc: HEVCEncoder, count: Int, fps: Double = 60, from: Int = 0, capture: DispatchQueue) -> CFTimeInterval {
    let start = CACurrentMediaTime() + 0.005
    for i in 0..<count {
        sleepUntil(start + Double(i) / fps)
        let frame = makeFrame(seq: from + i)
        capture.sync { enc.encode(frame, pts: CMTime(value: CMTimeValue(from + i), timescale: 60)) }
    }
    return start
}

// E1: every kind of session (a stream's on the hardware, a probe's, the software encoder's) lets
// one frame in at a time, and none prints anything when it is made.
if !onlyE7 {
    var held: [String: Int] = [:]
    var printed = ""
    for (name, software, quiet) in [("hardware", false, false), ("probe", false, true), ("software", true, false)] {
        FakeVT.reset(plan: { _, _, _, _ in .returnAfter(0.030) })
        var enc: HEVCEncoder?
        printed += capturingStdout { enc = makeEncoder(software: software, quiet: quiet) }
        let session = FakeVT.lastSession
        let capture = DispatchQueue(label: "capture.e1", qos: .userInteractive)
        feed(enc!, count: 12, capture: capture)
        Thread.sleep(forTimeInterval: 0.1)
        held[name] = FakeVT.lock.run { FakeVT.maxHeld[session] ?? 0 }
        withExtendedLifetime(enc) {}
    }
    print("inside at most: hardware \(held["hardware"] ?? -1), probe \(held["probe"] ?? -1), software \(held["software"] ?? -1); printed \(printed.isEmpty ? "nothing" : printed.debugDescription)")
    expect(held.values.allSatisfy { $0 == 1 } && held.count == 3, "frames inside at most: \(held), not 1 each")
    expect(printed.isEmpty, "making the sessions printed \(printed.debugDescription)")
}

// E2: a stream at 60 fps against frames that each take 30 ms, then 9 ms (outputs in decode
// order): one over the turnaround (~33 fps), then the capture rate.
for (turnaround, low, high) in [(0.030, 25.0, 34.0), (0.009, 55.0, 61.0)] where !onlyE7 {
    FakeVT.reset(plan: { _, _, _, _ in .returnAfter(turnaround) })
    let enc = makeEncoder()
    let session = FakeVT.lastSession
    let outs = Outputs()
    enc.onEncoded = { _, key, _ in outs.add(key: key) }
    let capture = DispatchQueue(label: "capture", qos: .userInteractive)
    let start = feed(enc, count: 90, capture: capture)
    Thread.sleep(forTimeInterval: 0.2)
    let window = outs.all.filter { $0 >= start + 0.5 && $0 < start + 1.5 }
    let rate = Double(window.count)
    let held = FakeVT.lock.run { FakeVT.maxHeld[session] ?? 0 }
    let calls = FakeVT.callsOf(session)
    let pts = calls.map(\.pts)
    print(String(format: "steady, %.0f ms a frame at 60 fps: %.0f fps out, at most %d inside, %d encode calls for 90 frames", turnaround * 1000, rate, held, calls.count))
    expect(held == 1, "\(Int(turnaround * 1000)) ms a frame: at most \(held) inside VideoToolbox, not 1")
    expect(rate >= low && rate <= high, "\(Int(turnaround * 1000)) ms a frame: \(rate) fps, not \(low) to \(high)")
    expect(zip(pts, pts.dropFirst()).allSatisfy { CMTimeCompare($0, $1) < 0 }, "timestamps handed to VideoToolbox went backwards")
    expect(outs.keyframes >= 1, "no keyframe (the session's first frame is one)")
    withExtendedLifetime(enc) {}
}

/// A value shared between threads.
final class Shared<T> {
    private let lock = UnfairLock()
    private var v: T
    init(_ v: T) { self.v = v }
    var value: T { get { lock.run { v } } set { lock.run { v = newValue } } }
}

/// A stream fed at 60 fps from a capture queue, each frame a new one numbered from `base`, until
/// the watchdog reports a hang or `seconds` pass; then the owner lets go of the encoder, as the
/// coordinator does when it restarts the source. The frames still alive `settle` seconds later are
/// the ones the encoder (or the stand-in VideoToolbox) never let go of.
func streamThenRelease(base: Int, seconds: Double, settle: Double) -> (hungAt: Double?, alive: [Int]) {
    let t0 = CACurrentMediaTime()
    let hungAt = Shared<Double?>(nil)
    var enc: HEVCEncoder? = makeEncoder()
    enc!.onHung = { hungAt.value = CACurrentMediaTime() - t0 }
    let capture = DispatchQueue(label: "capture", qos: .userInteractive)
    let count = Int(seconds * 60)
    for i in 0..<count {
        sleepUntil(t0 + Double(i) / 60)
        if hungAt.value != nil { break }
        let e = enc!
        // Each in its own pool: the main thread's is never drained here, and would keep frames.
        autoreleasepool { capture.sync { e.encode(makeFrame(seq: base + i), pts: CMTime(value: CMTimeValue(i), timescale: 60)) } }
    }
    enc = nil
    Thread.sleep(forTimeInterval: settle)
    return (hungAt.value, Tracker.alive.filter { $0 >= base && $0 < base + count })
}

/// `n` re-checks' tests in a row; the test frames still alive `settle` seconds after the last.
func probesThenSettle(_ n: Int, settle: Double) -> (ok: [Bool], alive: [Int]) {
    let from = probeSeqNow + 1
    var ok: [Bool] = []
    for _ in 0..<n { autoreleasepool { ok.append(EncoderProbe.throughput(width: 16, height: 16).ok) } }
    let to = probeSeqNow
    Thread.sleep(forTimeInterval: settle)
    return (ok, Tracker.alive.filter { $0 >= from && $0 <= to })
}

// E3: what a stuck encoder keeps for good: the one frame inside it, whether it stuck on its first
// frame (every session and probe through the 2026-09-22 wedge) or mid-stream. A busy encoder
// hands everything back.
if !onlyE7 {
    FakeVT.reset(plan: { _, call, _, software in call == 1 && !software ? .stuck : .returnAfter(0.005) })
    let r = streamThenRelease(base: 10_000, seconds: 3, settle: 0.5)
    print("stream stuck on its first frame: hung at \(r.hungAt.map { String(format: "%.2f s", $0) } ?? "never"), frames kept \(r.alive)")
    expect(r.hungAt != nil && r.alive == [10_000], "stuck on its first frame: frames kept \(r.alive), not [10000]")

    FakeVT.reset(plan: { _, call, _, software in call == 1 && !software ? .blockCall : .returnAfter(0.005) })
    let b = streamThenRelease(base: 20_000, seconds: 3, settle: 0.5)
    print("stream whose first encode call never returns: hung at \(b.hungAt.map { String(format: "%.2f s", $0) } ?? "never"), frames kept \(b.alive)")
    expect(b.hungAt != nil && b.alive == [20_000], "first call blocked: frames kept \(b.alive), not [20000]")

    FakeVT.reset(plan: { _, call, _, software in call == 50 && !software ? .stuck : .returnAfter(0.005) })
    let m = streamThenRelease(base: 30_000, seconds: 4, settle: 0.5)
    print("stream stuck at its 50th frame: hung at \(m.hungAt.map { String(format: "%.2f s", $0) } ?? "never"), frames kept \(m.alive)")
    expect(m.hungAt != nil && m.alive.count == 1, "stuck mid-stream: \(m.alive.count) frames kept, not 1")

    FakeVT.reset(plan: { _, call, _, software in call == 50 && !software ? .returnAfter(2.5) : .returnAfter(0.005) })
    let busy = streamThenRelease(base: 40_000, seconds: 4, settle: 3.0)
    print("stream whose 50th frame comes back after 2.5 s: hung at \(busy.hungAt.map { String(format: "%.2f s", $0) } ?? "never"), frames kept \(busy.alive)")
    expect(busy.hungAt != nil && busy.alive.isEmpty, "busy: frames kept \(busy.alive) after they came back")

    FakeVT.reset(plan: { _, call, _, _ in call == 1 ? .stuck : .returnAfter(0.005) })
    l
```

### Core Architecture Module: `Scripts/encoder-check/harness/main.swift`
```
import Foundation
import CoreMedia
import CoreVideo
import QuartzCore

// Hardware harness (never shipped; USES THE MAC'S HARDWARE VIDEO ENCODER): drives the real
// HEVCEncoder.swift of a tree (compiled into this module with its EncoderProbe.swift, Stats.swift
// and StreamProtocol, by build.sh) with a moving test pattern in phases, and logs each second's
// frames in, enc.out, enc.mailboxDrop, the capture-to-output latency (host clock at the output
// handler minus the frame's timestamp, which is the host clock at capture, as ScreenCaptureKit's
// is), output handlers that overlapped and outputs out of timestamp order. Run it only through
// verify-hardware.sh, which checks first that no device is connected to Sill.app.
//
// usage: harness WIDTH HEIGHT BITRATE PHASE...      PHASE = dense:S | sparse:S@INTERVAL | still:S
//        harness probe WIDTH HEIGHT [N]             EncoderProbe.throughput N times at that size
//        harness keyframe WIDTH HEIGHT BITRATE [N]  N sessions: 12 frames at 60 fps, a keyframe
//                                                   asked for 5, 20 or 40 ms after the last, then
//                                                   still for 0.5 s: does a keyframe come out?
//
// The copy of HEVCEncoder.swift compiled here has one line added at the top of `handle(_:)`:
// `harnessOutputPTS = CMSampleBufferGetPresentationTimeStamp(sb)`.

var harnessOutputPTS = CMTime.invalid
setvbuf(stdout, nil, _IOLBF, 0)
let args = Array(CommandLine.arguments.dropFirst())

if args.first == "probe" {
    let w = Int(args[1])!, h = Int(args[2])!, n = args.count > 3 ? Int(args[3])! : 3
    for i in 0..<n {
        let r = EncoderProbe.throughput(width: w, height: h)
        print(String(format: "probe %d: %dx%d ok %@ fps %@ ms %d", i + 1, w, h, r.ok ? "yes" : "no",
                     r.fps.map { String(format: "%.1f", $0) } ?? "-", r.ms))
        usleep(200_000)
    }
    exit(0)
}

if args.first == "keyframe" {
    // A device joining, or one whose delta was dropped, just after the window's last repaint: the
    // request comes within 50 ms of it and nothing repaints after. 4fe37d4 only set the flag then
    // (no keyframe until the next repaint); HEVCEncoder.keyframeCheck re-encodes the last frame
    // about 60 ms after that repaint.
    let w = Int(args[1])!, h = Int(args[2])!, rate = Int(args[3])!, n = args.count > 4 ? Int(args[4])! : 6
    var kpool: CVPixelBufferPool?
    let kattrs: [CFString: Any] = [kCVPixelBufferPixelFormatTypeKey: kCVPixelFormatType_420YpCbCr8BiPlanarFullRange,
                                   kCVPixelBufferWidthKey: w, kCVPixelBufferHeightKey: h,
                                   kCVPixelBufferIOSurfacePropertiesKey: [:] as CFDictionary]
    CVPixelBufferPoolCreate(nil, nil, kattrs as CFDictionary, &kpool)
    let capture = DispatchQueue(label: "harness.capture", qos: .userInteractive)
    func frame(_ k: Int) -> CVPixelBuffer {
        var pb: CVPixelBuffer?
        CVPixelBufferPoolCreatePixelBuffer(nil, kpool!, &pb)
        CVPixelBufferLockBaseAddress(pb!, [])
        let yw = CVPixelBufferGetWidthOfPlane(pb!, 0), yh = CVPixelBufferGetHeightOfPlane(pb!, 0)
        if let y = CVPixelBufferGetBaseAddressOfPlane(pb!, 0) {
            let stride = CVPixelBufferGetBytesPerRowOfPlane(pb!, 0)
            memset(y, 96, stride * yh)
            let bar = max(8, yw / 20), x0 = (k * max(1, yw / 60)) % max(1, yw - bar)
            for row in 0..<yh { memset(y.advanced(by: row * stride + x0), 235, bar) }
        }
        if let uv = CVPixelBufferGetBaseAddressOfPlane(pb!, 1) {
            memset(uv, 128, CVPixelBufferGetBytesPerRowOfPlane(pb!, 1) * CVPixelBufferGetHeightOfPlane(pb!, 1))
        }
        CVPixelBufferUnlockBaseAddress(pb!, [])
        return pb!
    }
    func until(_ t: CFTimeInterval) { while CACurrentMediaTime() < t { usleep(200) } }
    let gaps = [0.005, 0.020, 0.040]
    var answered = 0
    for i in 0..<n {
        let gap = gaps[i % gaps.count]
        let e = try! HEVCEncoder(width: w, height: h, fps: 60, bitrate: rate, prioritizeSpeed: false, software: false)
        let klock = NSLock()
        var keys: [CFTimeInterval] = []
        e.onEncoded = { _, isKey, _ in if isKey { klock.lock(); keys.append(CACurrentMediaTime()); klock.unlock() } }
        var lastAt: CFTimeInterval = 0
        let t0 = CACurrentMediaTime() + 0.01
        for k in 0..<12 {
            until(t0 + Double(k) / 60)
            let pb = frame(k)
            capture.sync { e.encode(pb, pts: CMClockGetTime(CMClockGetHostTimeClock())) }
            lastAt = CACurrentMediaTime()
        }
        until(lastAt + gap)
        let requestAt = CACurrentMediaTime()
        e.requestKeyframe()
        Thread.sleep(forTimeInterval: 0.5)
        klock.lock(); let after = keys.filter { $0 >= requestAt }; klock.unlock()
        if let first = after.first {
            answered += 1
            print(String(format: "keyframe %d: asked %.0f ms after the last frame; a keyframe came out %.0f ms after it", i + 1, (requestAt - lastAt) * 1000, (first - lastAt) * 1000))
        } else {
            print(String(format: "keyframe %d: asked %.0f ms after the last frame; NO keyframe in 0.5 s", i + 1, (requestAt - lastAt) * 1000))
        }
        withExtendedLifetime(e) {}
        Thread.sleep(forTimeInterval: 0.1)
    }
    print("keyframe: answered \(answered) of \(n) at \(w)x\(h)")
    exit(0)
}

let width = Int(args[0])!, height = Int(args[1])!, bitrate = Int(args[2])!
struct Phase { let kind: String; let seconds: Double; let interval: Double }
let phases: [Phase] = args.dropFirst(3).map { spec in
    let (head, interval) = spec.contains("@") ? (String(spec.split(separator: "@")[0]), Double(spec.split(separator: "@")[1])!) : (spec, 0)
    let parts = head.split(separator: ":")
    return Phase(kind: String(parts[0]), seconds: Double(parts[1])!, interval: interval)
}
let total = phases.reduce(0) { $0 + $1.seconds }

let enc = try! HEVCEncoder(width: width, height: height, fps: 60, bitrate: bitrate, prioritizeSpeed: false, software: false)
let lock = NSLock()
var active = 0, overlaps = 0, outOfOrder = 0, lastOut = CMTime.invalid
var secLatencies: [Double] = [], allLatencies: [(Double, Double)] = []   // (seconds since start, ms)
var secIn = 0
var hung = false
let start = CACurrentMediaTime()
enc.onEncoded = { _, _, _ in
    lock.lock(); active += 1; if active > 1 { overlaps += 1 }; lock.unlock()
    let pts = harnessOutputPTS
    let now = CMClockGetTime(CMClockGetHostTimeClock())
    let ms = CMTimeGetSeconds(CMTimeSubtract(now, pts)) * 1000
    lock.lock()
    if lastOut.isValid, CMTimeCompare(pts, lastOut) <= 0 { outOfOrder += 1 }
    lastOut = pts
    secLatencies.append(ms)
    allLatencies.append((CACurrentMediaTime() - start, ms))
    active -= 1
    lock.unlock()
}
enc.onHung = { lock.lock(); hung = true; lock.unlock(); print("HUNG at \(String(format: "%.2f", CACurrentMediaTime() - start)) s") }

var pool: CVPixelBufferPool?
let attrs: [CFString: Any] = [kCVPixelBufferPixelFormatTypeKey: kCVPixelFormatType_420YpCbCr8BiPlanarFullRange,
                              kCVPixelBufferWidthKey: width, kCVPixelBufferHeightKey: height,
                              kCVPixelBufferIOSurfacePropertiesKey: [:] as CFDictionary]
CVPixelBufferPoolCreate(nil, nil, attrs as CFDictionary, &pool)
let feedQueue = DispatchQueue(label: "harness.feed", qos: .userInteractive)
var frameIndex = 0
var lastEmit = -1.0

func phase(at t: Double) -> (Phase, Int)? {
    var acc = 0.0
    for (i, p) in phases.enumerated() { acc += p.seconds; if t < acc { return (p, i) } }
    return nil
}

func emit() {
    var pb: CVPixelBuffer?
    CVPixelBufferPoolCreatePixelBuffer(nil, pool!, &pb)
    guard let pb else { return }
    frameIndex += 1
    CVPixelBufferLockBaseAddress(pb, [])
    let w = CVPixelBufferGetWidthOfPlane(pb, 0), h = CVPixelBufferGetHeightOfPlane(pb, 0)
    if let y = CVPixelBufferGetBaseAddressOfPlane(pb, 0) {
        let stride = CVPixelBufferGetBytesPerRowOfPlane(pb, 0)
        memset(y, 96, stride * h)
        let bar = max(8, w / 20)
        let x0 = (frameIndex * max(1, w / 60)) % max(1, w - bar)
        for row in 0..<h { memset(y.advanced(by: row * stride + x0), 235, bar) }
    }
    if let uv = CVPixelBufferGetBaseAddressOfPlane(pb, 1) {
        memset(uv, 128, CVPixelBufferGetBytesPerRowOfPlane(pb, 1) * CVPixelBufferGetHeightOfPlane(pb, 1))
    }
    CVPixelBufferUnlockBaseAddress(pb, [])
    lock.lock(); secIn += 1; lock.unlock()
    enc.encode(pb, pts: CMClockGetTime(CMClockGetHostTimeClock()))
}

let timer = DispatchSource.makeTimerSource(queue: feedQueue)
timer.schedule(deadline: .now(), repeating: 1.0 / 60, leeway: .milliseconds(1))
timer.setEventHandler {
    let t = CACurrentMediaTime() - start
    guard let (p, _) = phase(at: t) else { return }
    switch p.kind {
    case "dense": emit()
    case "sparse": if t - lastEmit >= p.interval { lastEmit = t; emit() }
    default: break
    }
}
timer.resume()

func pct(_ xs: [Double], _ p: Double) -> Double { xs.isEmpty ? .nan : xs.sorted()[min(xs.count - 1, Int(Double(xs.count) * p))] }

var second = 0
Stats.shared.onTick = { counts in
    second += 1
    lock.lock()
    let lat = secLatencies; secLatencies = []
    let inCount = secIn; secIn = 0
    let ov = overlaps, ooo = outOfOrder
    lock.unlock()
    let t = CACurrentMediaTime() - start
    let name = phase(at: t - 0.5).map { "\($0.0.kind)" } ?? "end"
    print(String(format: "t=%2d %-6@ in %2d  enc.out %2d  mailboxDrop %2d  latency median %5.1f p95 %5.1f max %5.1f ms  overlaps %d  outOfOrder %d",
                 second, name as NSString, inCount, counts["enc.out"] ?? 0, counts["enc.mailboxDrop"] ?? 0,
                 pct(lat, 0.5), pct(lat, 0.95), lat.max() ?? .nan, ov, ooo))
}
DispatchQueue.main.async { Stats.shared.startPrinting() }
DispatchQueue.main.asyncAfter(deadline: .now() + total + 0.6) {
    timer.cancel()
    lock.lock()
    let all = allLatencies
    lock.unlock()
    fo
```

### Core Architecture Module: `Scripts/encoder-check/hbparse.py`
```
#!/usr/bin/env python3
# AppleAVE2 HeartBeat lines (log show --info --debug --style compact, sender == "AppleAVE2") ->
# per 5 s window: each session's frames completed and fps, and the engine's counters per frame
# (C/F is what the 2026-09-25 investigation read as the time per frame on the encoder: 9.0 ms in
# the fast state, 14.0 in the slow one, alone on the engine at 3024×1964; the counters are the
# engine's, so C/F is only a session's own when it is alone on the engine). A/s: the first
# counter's growth a second. CLAUDE.md, "The 33 fps plateau".
# usage: hbparse.py FILE      (the output of the log show above)
import re, sys
res, prev = {}, None
for ln in open(sys.argv[1]):
    m = re.match(r'(\S+) (\S+) .*?\(AppleAVE2\) (\d+) \d+ (.*)', ln.strip())
    if not m: continue
    d, t, us, msg = m.groups()
    r = re.search(r'ID: (\d+) Resolution: (\d+x\d+).*?Priority: (\d+)', msg)
    if r:
        res[r.group(1)] = r.group(2) + ' p' + r.group(3)
        print(f'{t} session {r.group(1)} opened: {r.group(2)} priority {r.group(3)}')
        continue
    h = re.search(r'HeartBeat <private> (\d+) (\d+) (\d+) - (\d+) - (\d+) \| (\d+) \[(.*)\]', msg)
    if not h: continue
    a, c = int(h.group(3)), int(h.group(5))
    sess = {x[0]: (int(x[1]), int(x[2])) for x in re.findall(r'(\d+)\((\d+) \| (\d+)\)', h.group(7))}
    us = int(us)
    if prev and sess:
        dt = (us - prev['us']) / 1e6
        per = {k: v[1] - prev['sess'][k][1] for k, v in sess.items() if k in prev['sess']}
        new = [k for k in sess if k not in prev['sess']]
        dF = sum(per.values())
        parts = '  '.join(f"{k}({res.get(k, '?')}) {n/dt:5.1f} fps" for k, n in per.items()) + ''.join(f'  {k} new' for k in new)
        if dF > 0:
            print(f"{t} {parts}  | engine C/F {(c - prev['c'])/dF:5.2f} ms  A/s {(a - prev['a'])/dt:6.1f}"
                  + ("  (shared)" if len([n for n in per.values() if n > 0]) > 1 else ""))
        else:
            print(f"{t} {parts or 'no session'}  | idle window")
    elif sess:
        print(f"{t} first beat: " + ', '.join(f"{k}({res.get(k, '?')})" for k in sess))
    prev = dict(sess=sess, a=a, c=c, us=us)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #69** (2026-10-15): **Couldn't get the app to work after sitting dormant for a few hours. Had to login to my Mac and close and restart the app on my iPad before it would reconnect.**
  *Symptoms*: ### What happened  User couldn't get the app to work after sitting dormant for a few hours. He had to login to my Mac and close and restart the app on my iPad before it would reconnect.  ### How to make it happen again  See above  ### Your Mac and its macOS  macOS 27  ### Sill for Mac's version  0.5.1 (563)  ### Your iPhone or iPad and its iOS or iPadOS  iPad OS  ### The Sill app's version  0.5.1  ### How the device reached the Mac  Wi-Fi  ### Sill's log on your Mac  ```text  ```

- **Issue #68** (2026-10-15): **Two finger scrolling on Magic Keyboard trackpad, and allowing typing into text fields without needing to hit the keyboard button**
  *Symptoms*: ### What happened  Some better interaction with the iPad Magic Keyboard would be great - such as two finger scrolling on the trackpad, and allowing typing into text fields without needing to hit the keyboard button. It makes sense for iPhone and iPad without a keyboard, but with it attached it's just a tiny bit of added friction.  ### How to make it happen again  See above  ### Your Mac and its macOS  MacOS 27  ### Sill for Mac's version  Sill 0.5.1 (563)  ### Your iPhone or iPad and its iOS or iPadOS  iPad with Magic Keyboard  ### The Sill app's version  0.5.1  ### How the device reached the Mac  Wi-Fi  ### Sill's log on your Mac  ```text  ```

- **Issue #59** (2026-10-15): **Bug: Remote Access settings are too tall on Macbook 14-inch (3024 × 1964)**
  *Symptoms*: ### What happened  The Remote Access settings on Mac are too tall and cannot be resized. This is on a Macbook Pro 14-inch (3024 × 1964).  <img width="524" height="951" alt="Image" src="https://github.com/user-attachments/assets/46097ba3-1de7-401d-a897-b004d9741668" />  ### How to make it happen again  _No response_  ### Your Mac and its macOS  Macbook Pro (M1), 26.6.2 (25G83)  ### Sill for Mac's version  Sill 0.5.1 (563)  ### Your iPhone or iPad and its iOS or iPadOS  iPhone 15 Pro Max,   ### The Sill app's version  _No response_  ### How the device reached the Mac  Wi-Fi  ### Sill's log on your Mac  ```text  ```
  **Post-Mortem & Fix Analysis**:
  > Huh! I think this is related to scaling settings on your Mac versus mine, as mine fits easily. I will look into this and get back to you! Will be out of the country until the 25th but I promise to look at it then! Or give a PR yourself a go! Cheers!
  > <img width="537" height="803" alt="Image" src="https://github.com/user-attachments/assets/f15a3c2f-2bd6-4085-accb-2d5f3b3b8733" />

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

### Incident Patch 1: `ed42d9b2` (2026-10-14)
**Commit Message**: Docs for #69: the review's findings, their fixes and the numbers after them

The plan's Results gain the review (four findings, each fixed in a commit of
its own: 1798232, f39b875, 37ed3de, 0e8a098), the review's own runs (among
them sessionEnded's new branch live for the first time) and the checks after
the fixes: the three iOS builds with only the known StreamClient warning,
swift build -c release from clean, run-all.sh all 40, policy 446 cases and
158 of 158 mutants, the other three checks' mutant patterns unchanged, and
four trips to the background on a private simulator. Progress and the
CLAUDE.md entry say the same, the entry with the cable case and the words'
dependence on Noah's sleep-proxy test among his steps.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `CLAUDE.md` (modified, +49/-39)
```diff
@@ -9,10 +9,10 @@ Formerly winstream; the folder still carries the old name.
 ## Current step
 
 **Finding the Mac again after hours idle (2026-10-14, branch `reconnect-after-sleep` from main at
-985a733, PR #77, issue #69; the plan, the causes with line numbers, the decisions and the results are
-in `docs/reconnect-after-sleep-plan.md`).** The report: after a few hours dormant nothing reconnected
-until the Mac was logged in to and Sill relaunched on the iPad. Device code, the support page and the
-docs; no wire change, nothing on the Mac.
+985a733, PR #77, issue #69; the plan, the causes with line numbers, the decisions, the results and the
+review's fixes are in `docs/reconnect-after-sleep-plan.md`).** The report: after a few hours dormant
+nothing reconnected until the Mac was logged in to and Sill relaunched on the iPad. Device code, the
+support page and the docs; no wire change, nothing on the Mac.
 - The browsers: iOS makes a suspended app's connection to mDNSResponder defunct (-65569), and the
   Bonjour browser was made once (`startBrowsing`), so after hours in the background the rows were
   what it saw then, and a failed browse only said "Browse failed: …". Now the network browser, and
@@ -21,8 +21,10 @@ docs; no wire change, nothing on the Mac.
   2, 4, 8, 16, then 30 s later and in the foreground only (`DiscoveryPolicy.rebuildBrowser`,
   `browserFailures`: one that ran 30 s is the first again). The old results stay beside the new
   browser's for 3 s (`browserResults`, `rebuildSettle` = `networkFirst`), and a failed browser's rows
-  stay as they are until it is made again, so a Mac that stays listed keeps its sightings. No line
-  for a failed browse.
+  stay as they are until it is made again, so a Mac that stays listed keeps its sightings by name.
+  Its interfaces are the new browser's; the return stamps the session's pong as it resets liveness
+  (`resetLiveness`), so a cable session whose new browser first lists the Mac on Wi-Fi alone stays
+  on the cable. No line for a failed browse.
 - The reconnect: a listed row was dialled at once, a dial not ready in 5 s was let go and nothing
   looked again (`tearDown` never does, whatever the comment said), and the retry chain ended at its
   first dial: two dials, then "Reconnecting…" for good, also under a Bonjour Sleep Proxy's record of
@@ -37,47 +39,55 @@ docs; no wire change, nothing on the Mac.
   (`sessionEnded`); "Waiting for ‹Mac›…" is a tap's line only; the retry chain lives while a
   reconnect is wanted, one at a time.
 - A Desktop the Mac stopped (its capture stopped, so the host selects nothing) is asked for again
-  at once, under the old 10 s spacing (`DiscoveryPolicy.autoDesktop`).
+  at once, under the old 10 s spacing (`DiscoveryPolicy.autoDesktop`); 0.5.1 asks only with the
+  Mac's next window list, sent when a window opens, closes or changes.
 - DEBUG `-SillBrowserFail N` (each of the first N network browsers reported failed with -65569 half
   a second after it starts) and `-SillConnectCase asleep`. The support page's "Your Mac isn’t listed"
-  gains a sleeping Mac (Sill may not be able to wake it, so keep it awake: Energy, or Battery; not
-  "can't", since a dial through a Bonjour Sleep Proxy may wake it, untested) and a restarted one
-  (Sill opens after a login, with Launch at Login); README's Good to know, the next What's New
-  (docs/app-store-metadata.md), DEVELOPMENT.md.
-- Verified (the plan's Results): on a private simulator against `SillHost --synthetic --pairing` as
-  a `_silltest._tcp` row, the host stopped for 20 s: main's build dialled at +0 and +6.3 s after the
-  loss and then nothing for the minute after the host came back; this branch dialled at +0, 5.3,
-  15.3 and 35.3 s and the session came back without a tap. Stopped for 300 s: 12 dials at the rule's
-  times, the quiet line at +20.5 s, "Stopped trying…" at +281.8 s and no dial after it; back from the
+  gains a sleeping Mac (Sill may not be able to wake it, so keep it awake: Energy, or Battery) and a
+  restarted one (Sill opens after a login, with Launch at Login); README's Good to know, the next
+  What's New (docs/app-store-metadata.md), DEVELOPMENT.md.
+- The review (2026-10-14, after 1c4b921), four findings, each fixed in a commit of its own: the
+  home-side words said Sill can't wake a sleeping Mac, at odds with the bound's own reason (a dial
+  through a sleep proxy may wake it) and neither verified: now "may not be able to" (1798232); a
+  rebuild keeps a Mac by name, not by interface, so a working cable session back from a short trip
+  could move to Wi-Fi and back on its pong from before the trip: the stamp above, a model in
+  `sleep.swift` (f39b875); "0.5.1 never does" ask for a stopped Desktop: it does, with the Mac's
+  next window list (37ed3de); "both browsers" made again: the nearby one only while it runs
+  (0e8a098). Its own runs agreed with the ones below and ran `sessionEnded`'s new branch live (a
+  TLS stand-in that never se
```

**File**: `docs/reconnect-after-sleep-plan.md` (modified, +55/-5)
```diff
@@ -250,20 +250,70 @@ stamped as it came) and the host's log; the loss is the device's "connection sil
   trip away, under the Mac's 4 s eviction) is called "silent for 10 s" and ended; the reconnect then
   brings it back at once (0.1 s here), with a flash of the connect screen. A ping tick that comes
   long after the last one (the app was suspended) could reset liveness itself.
+- **The review** (2026-10-14, after 1c4b921: an adversarial pass that ran the builds, every check and
+  mutant and the live runs again on a simulator of its own) found four things, each checked against
+  the code here and fixed in a commit of its own:
+  - *The words on waking a sleeping Mac* (should-fix, 1798232). The home-side words "Sill can’t wake
+    a sleeping Mac" (support.html, README, DEVELOPMENT.md, §4) were at odds with the reason this
+    branch gives for the 12-dial bound, that a dial through a Bonjour Sleep Proxy may wake the Mac,
+    and neither is verified; Sill.app's own comment on App Nap (AppModel.swift) already says a device
+    at home can wake its Mac that way. The words now say Sill may not be able to wake it, so keep it
+    awake (§4 has the wording for after Noah's sleep-proxy test). The Remote Access lines stay: no
+    sleep proxy sits on a VPN path.
+  - *A rebuild keeps a Mac by name, not by interface* (f39b875). §1 claimed the cable's settle
+    survived a rebuild; it does only when the new browser's first report lists the cable. When that
+    report lists the Mac on Wi-Fi alone, a working cable session back from a short trip would move
+    to Wi-Fi, and back once the cable had settled again, because its pong dated from before the
+    trip (`pathGone`; the review's pure demo, no cable here). The return now stamps the pong as it resets liveness
+    (`resetLiveness`), `sleep.swift` has the model, and §1 says what a rebuild keeps.
+  - *0.5.1 and a stopped Desktop* (37ed3de). CLAUDE.md said 0.5.1 never asks for it again; it asks
+    with the Mac's next window list (the Desktop's run above).
+  - *"Both browsers"* (0e8a098). DEVELOPMENT.md and ContentView's harness contract said the return
+    from the background makes both browsers again; it makes the network browser again, and the
+    nearby one only while it runs, as `cameForward`'s comment now says too.
+- **The review's own runs** on 1c4b921 agreed with the ones above (the 20 s stop back at the third
+  dial without a tap; the 300 s stop's 12 dials, quiet line and "Stopped trying…"; `-SillBrowserFail
+  3`; the Desktop; `policy` 158 of 158 mutants and the other three checks' 124, 21 and 72), and ran
+  two paths these runs had not: a reconnect dial that ends before it connects (`sessionEnded`'s new
+  branch), against a TLS stand-in holding the test host's key that completes the handshake and never
+  sends a window list, advertised under the session's Bonjour name: "the dial of … did not connect
+  (closed)", dials at +0, 7.2, 17.2, 37.3 and 67.4 s, the quiet line after the third, a steady status
+  line (main's build: "disconnected", then a new dial about every 6 s, 13 connections in 75 s); and a
+  row whose port resets each handshake (main: two dials, then stuck; this branch: 0, 5, 15, 35 s and
+  the quiet line).
+- **After the review's fixes** (2026-10-14, on 0e8a098 and the record after it): the iOS app Debug for
+  the generic simulator as CI builds it, Release for the generic simulator and Debug for a generic
+  device, unsigned, each only the known `StreamClient` capture warning (StreamClient.swift:3662);
+  `swift build -c release` from a clean build folder, 41.1 s, only the CaptureProbe warning;
+  `Tests/checks/run-all.sh`, all 40 passed (1,004 s on a Mac loaded by other work); `Tests/checks/policy`
+  446 cases (441, and the cable model's 5) and 158 of 158 mutants (53 min on that loaded Mac); `home-device` 182, `home-model` 62 and
+  `remote-rules` 123 cases, their files unchanged, and their mutant patterns in DiscoveryPolicy.swift
+  (124, 10 and 17) each found as often as at 1c4b921 and on main: the fixes change only a comment
+  there. Live, on a private simulator ("Sill reconnect-fix 69", iPad mini (A17 Pro), iOS 27.0, deleted
+  after), the Debug app built ad hoc against `SillHost --synthetic` (a plain door on 127.0.0.1 alone,
+  the software encoder, no router, registered as a `_silltest._tcp` row), found as a row and
+  streaming: four trips to the background (the Settings app for 2.3, 2.3, 2.3 and 15 s); each return
+  made the network browser again with the row kept beside it, settled 3.05 to 3.13 s later, and the
+  session went on over the one connection the host saw throughout (no "connection silent", no "Client
+  left" until the host was stopped at the end, when the reconnect dialled at once). That session has
+  no route word (loopback), so the pong stamp itself changes nothing there; the cable case is Noah's.
 
 ## Progress
 
 - 2026-10-14: the plan (211e98c); the browsers made again, the reconnect kept a
```

---

### Incident Patch 2: `229934f5` (2026-10-14)
**Commit Message**: Docs: the review's findings and fixes, with their results

The plan's design and open questions now carry the review's changes (the
rate a stop never meets, macOS's paste privacy, a Paste's receipt, the chip's
time and VoiceOver's announcement, the site's words marked for the release),
and open question 1 says what on-by-default does to the device's clipboard,
for Noah. Results has "The review", each of the eight findings with what was
reproduced, what changed and how it was checked, and the final numbers:
`Tests/checks/clipboard` 259 checks and 72 of 72 mutants, run-all all 41, the
host and the iOS app three ways from git archive of a371cb6 with only the
known warnings, H2 against main again, the live runs on loopback and on a
private simulator, and the photos (byte for byte the reviewed build's but the
new note). Untested gains macOS's paste alert through the developer preview,
a Paste right after an app switch, and on-by-default's effect.

CLAUDE.md's entry, Layout and harness lines; DEVELOPMENT.md's clipboard
section (the receipt, the chip's time, macOS's paste privacy and how to try
it, SILL_TEST_CLIPBOARD_ACCESS, `paste` and -SillSettingsCloseAt); the checks'
README row (259 

**File**: `CLAUDE.md` (modified, +73/-45)
```diff
@@ -8,60 +8,81 @@ Formerly winstream; the folder still carries the old name.
 
 ## Current step
 
-**The clipboard both ways (2026-10-14, branch `clipboard` from main at 985a733; issue #64; the plan,
-its open questions with the default taken for each, and the results are in
-`docs/clipboard-plan.md`).** Noah: work on the clipboard (after #67/#68, #69, #59, #57, #58), text
+**The clipboard both ways (2026-10-14, branch `clipboard` from main at 985a733; issue #64; PR #78;
+the plan, its open questions with the default taken for each, the results and the review's fixes are
+in `docs/clipboard-plan.md`).** Noah: work on the clipboard (after #67/#68, #69, #59, #57, #58), text
 first. Wire, host and device; additive.
 - Wire: kind 32 `clipboard`, both ways, JSON `Clipboard {text, image, stop}` (Clipboard.swift): pull
   request #66's number and shape (`image` reserved for a later generation; `stop`, a device's switch
   going off, is this change's); `WindowList.clipboard: Int?` (1: text), so #66's `Bool` becomes an
   Int as it rebases (a Bool does not decode). A device sends kind 32 only to a host that says 1 or
-  more; any kind 32 subscribes. Text at most 256 KB of UTF-8, the JSON at most 1 MiB either way.
-  Kinds 29–31 stay free (audio, #66's side streams).
+  more; any kind 32 subscribes, and `{}` is text alone: a host sends `image` only to a subscription
+  that says it takes images (the floor; #66's host sends one to every subscriber). Text at most
+  256 KB of UTF-8, the JSON at most 1 MiB either way. Kinds 29–31 stay free (audio, #66's).
 - Rules, pure, both ends: `ClipboardPolicy` (StreamProtocol). Never sent: an item a password manager
   or another app marks `org.nspasteboard.ConcealedType` or `org.nspasteboard.TransientType` (and
   three older markers), one from another device through Universal Clipboard
   (`com.apple.is-remote-clipboard`: reading it fetches it from there, found while building), the
-  host's own write; types are judged before any data is read.
+  host's own write; types are judged before any data is read. A device's subscriptions and texts are
+  rated 4 a second, its stop never (`hostReceives`).
 - Host: `HostClipboard` (main actor; the pasteboard read and written on a queue of its own,
   `Board`, so a slow read never holds up input): the look at the change count four times a second
-  while a device subscribes (Task.sleep, not a RunLoop timer); an empty pasteboard waits up to a
-  second for its contents (`hostWaits`: an app clears, then writes, and only the clear moves the
-  count; found live, 9 of 12 slow copies lost before, none now); what was on the clipboard when the
-  first subscribed is never sent; a device's text written `.currentHostOnly` with this launch's
-  marker and passed to the other subscribers; 4 kind 32 a second per connection; one line per
-  subscription or stop ("Clipboard: iPad (iPad14,1) shares the clipboard."), none per copy, never
-  contents; `clip.sent`/`clip.recv`. `HostConfig.shareClipboard` (on): Settings › General "Share
-  clipboard with devices" (`shareClipboard`), the CLI's `--no-clipboard`; the Mac's alone, applied
-  at once by `setTarget` (subscriptions dropped, lists sent again). A synthetic host shares a
-  pasteboard of its own (TEST ONLY `SILL_TEST_PASTEBOARD`, `SILL_TEST_CLIPBOARD_LOG=1`), never this
-  Mac's clipboard.
+  while a device subscribes (Task.sleep, not a RunLoop timer), and only while macOS allows every read
+  (`MacClipboard.access`, NSPasteboard's `accessBehavior`, macOS 15.4 and later: while it would ask,
+  an alert at every copy, or denies, nothing is read, nothing copied meanwhile is sent, one line when
+  that changes); an empty pasteboard waits up to a second for its contents (`hostWaits`: found live,
+  9 of 12 slow copies lost before, none now); what was on the clipboard when the first subscribed is
+  never sent; a device's text written `.currentHostOnly` with this launch's marker and passed to the
+  other subscribers; one line per subscription or stop ("Clipboard: iPad (iPad14,1) shares the
+  clipboard."), none per copy, never contents; `clip.sent`/`clip.recv`. `HostConfig.shareClipboard`
+  (on): Settings › General's `ClipboardSection`, "Share clipboard with devices" (`shareClipboard`),
+  and while macOS asks or denies, why and "Allow in System Settings…" (Paste from Other Apps,
+  `Privacy_Pasteboard`; one read on that click first while macOS has not asked about Sill, so it is
+  listed); the CLI's `--no-clipboard`; the Mac's alone, applied at once by `setTarget`. A synthetic
+  host shares a pasteboard of its own (TEST ONLY `SILL_TEST_PASTEBOARD`, `SILL_TEST_CLIPBOARD_LOG=1`,
+  `SILL_TEST_CLIPBOARD_ACCESS`), never this Mac's clipboard.
 - Device: `StreamClient+Clipboard` (subscription, `stop`, the Mac's text written `.localOnly` with a
   10-minute expiration, the handled change count `Sill.clipboardHandled`) and `ClipboardChip`: when
   Sill becomes active (or a session starts within 15 s after) wit
```

**File**: `Tests/checks/README.md` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ exit status is the number of checks that failed. Binaries, data and logs go to
 | `away-wire` | `Sources/StreamProtocol/HostSettings.swift` | kind 16's `away` (AwayQuality) and `link` (LinkReport): their wire names, what decodes and what does not, an older host's state and an older device's decoder (main's HostSettingsState at 2b38179); QualityPreset's `name(forBitrate:)` and `shortTitle(bitrate:captureScale:)` | 47 | 9 |
 | `cable-link` | `Sources/SillHost/CableLink.swift` and `OriginPolicy.swift` with `Sources/StreamProtocol` (`module.txt`) | what counts as the USB cable to an iPhone or iPad, from this Mac's own IOKit readings with an iPad on the cable; the device ID; the test stand-in | 40 | 20 |
 | `clientlink` | `Sources/SillHost/ClientLink.swift` (`-package-name sill`) | which route a device came by, from its endpoint's scope and path, and the menu card's word for it | 89 | 14 |
-| `clipboard` | `Sources/StreamProtocol/*.swift` | the clipboard (docs/clipboard-plan.md): kind 32 and Clipboard's JSON both ways (#66's shape, `stop`), the window list's `clipboard` (an Int: #66's Bool does not decode), the caps (256 KB of text, 1 MiB of JSON, counted in UTF-8 bytes, a control character six bytes of JSON); ClipboardPolicy: what a device's message asks of the host, which change of the Mac's pasteboard the host sends (its own write, the five markers, a password manager's text never read, no text, empty, too long), who a device's text goes to, the rate, the device's subscription, which text from the Mac it writes (the echo), the chip and its look at a session's start, Paste's send, the chip's corner, every word; two random models: the device's subscription against the host's view of it (5,000 sessions), and a host with three devices against what each must receive (2,000 runs, an app that clears and writes later among them); the host waiting for an empty pasteboard's contents | 197 | 50 |
+| `clipboard` | `Sources/StreamProtocol/*.swift` | the clipboard (docs/clipboard-plan.md): kind 32 and Clipboard's JSON both ways (#66's shape, `stop`), the window list's `clipboard` (an Int: #66's Bool does not decode), the caps (256 KB of text, 1 MiB of JSON, counted in UTF-8 bytes, a control character six bytes of JSON); ClipboardPolicy: what a device's message asks of the host, which change of the Mac's pasteboard the host sends (its own write, the five markers, a password manager's text never read, no text, empty, too long), who a device's text goes to, the rate (which a stop never meets: `hostReceives`), macOS's paste privacy (`MacAccess`, the look's steps, the host's lines, Settings' words), the device's subscription, which text from the Mac it writes (the echo), a Paste's receipt, the chip, its time and its look at a session's start, Paste's send, the chip's corner, every word; three random models: the device's subscription against the host's view of it (5,000 sessions), the same quickly through the rate (5,000: never subscribed while the device's switch is off), and a host with three devices against what each must receive (2,000 runs, an app that clears and writes later and macOS's answer changing among them); the host waiting for an empty pasteboard's contents | 259 | 72 |
 | `compatibility` | `Sources/StreamProtocol/*.swift` | `SillVersion` (tags, bundles and the wire's versions, and their order), `SillProtocol`, and the update notice's payloads: kind 23's hello, kind 22's new fields with the five older goodbyes byte for byte, the window list's `hostVersion` and `protocol`; kind 28's trackpad gesture and the window list's `gestures`; kind 32's clipboard and the window list's `clipboard`; pairing at home's reason and the update notice's as their devices read them | 102 | 22 |
 | `device-gate` | `Sources/SillHost/DeviceGate.swift` with `Sources/StreamProtocol` (`build.sh`, `-package-name sill`) | the host's device floor: which hello it admits, the refusal's words, the Refused, count and hello lines, the shipped floor "0" | 58 | 14 |
 | `dmg-layout` | `Scripts/dmg-layout/DSStore.swift`, `FinderAlias.swift`, `DMGLayout.swift` (with make-dmg.sh's layout arguments and `design/DMGBackground.svg`) | the `.DS_Store` of Sill.dmg's window byte by byte against Finder's own layout of the file (blocks, free lists, header), the window's bounds (the picture and macOS 27's 32-point title bar), view options and icon places; the background's alias field by field; the encoder and decoder, a two-level tree among them; the volume icon's flag; an alias for a real file where it runs; that make-dmg.sh and the SVG still give that window | 70 | 43 |
```

**File**: `docs/DEVELOPMENT.md` (modified, +34/-7)
```diff
@@ -366,22 +366,49 @@ near the bar offers "Paste on ‹Mac›" with the system's Paste control
 (UIPasteControl), whose tap reads it without asking; the Settings group has the
 same button. The Mac writes it for this Mac only (`.currentHostOnly`), marked
 with its launch ID so it never sends it back, and passes it to its other
-subscribers; the person presses ⌘V. Text is capped at 256 KB. The log says
-"Clipboard: iPad (iPad14,1) shares the clipboard." and "… stopped sharing the
-clipboard." and nothing per copy, never what was copied; the stats line has
-`clip.sent` and `clip.recv` in seconds they happen.
+subscribers; the person presses ⌘V. The device says "Sent to ‹Mac›’s
+clipboard" only once the Mac has read it: a ping with a 16-byte random payload
+goes after the text through the same door, and its pong is the receipt (the Mac
+echoes a ping only after reading all before it); none within max(4 s, 4 × the
+worst round trip) says "Didn’t reach ‹Mac›. Try Paste again." and offers the
+chip again. The chip's 20 s run only while it is on screen with Sill active,
+never under VoiceOver, and VoiceOver is told when it first shows. Text is capped
+at 256 KB. A device's subscriptions and texts are limited to four a second; its
+stop never is. The log says "Clipboard: iPad (iPad14,1) shares the clipboard."
+and "… stopped sharing the clipboard." and nothing per copy, never what was
+copied; the stats line has `clip.sent` and `clip.recv` in seconds they happen.
+
+macOS 15.4 and later can ask before an app reads the clipboard on its own
+(NSPasteboard's `accessBehavior`; System Settings › Privacy & Security › Paste
+from Other Apps). Sill for Mac reads the pasteboard only while macOS allows
+every read: while it would ask (its alert at every copy) or denies, the look
+reads nothing, what is copied meanwhile is never sent, the log says so once,
+and Settings › General says why under the switch, with "Allow in System
+Settings…" (which, while macOS has not asked about Sill yet, makes one read on
+that click so macOS asks and lists Sill there). A device's text is still
+written. To try it with Sill.app: `defaults write me.saffer.sill.mac
+EnablePasteboardPrivacyDeveloperPreview -bool yes`, relaunch Sill, and
+`defaults delete me.saffer.sill.mac EnablePasteboardPrivacyDeveloperPreview`
+after.
 
 A synthetic host never touches this Mac's clipboard: it shares a pasteboard of
 its own, `me.saffer.sill.test.<pid>`, or the one TEST ONLY
 `SILL_TEST_PASTEBOARD=<name>` names, which a test writes and reads with
 `NSPasteboard(name:)`; `SILL_TEST_CLIPBOARD_LOG=1` prints each decision ("change
-4 not sent (marked)") with sizes, never text. `sillclient.py --clipboard`
+4 not sent (marked)") with sizes, never text; `SILL_TEST_CLIPBOARD_ACCESS` gives
+its pasteboard macOS's answer (`allowed`, `notAsked`, `asks`, `denied`, or the
+path of a file holding one, read at each look). `sillclient.py --clipboard`
 subscribes and prints each kind 32, `--copy=TEXT@T` (or `--copy-bytes=N@T`)
 sends text as a device's Paste does, `--raw32='{"stop":true}@T'` stops, and
 `--expect=clipboard=TEXT` (or `none`) checks the last one at exit. In the
 harness, `-SillClipboardChip 1` puts the chip on the mock's stream and
-`-SillClipboardNote sent|long` its note; `-Sill.shareClipboard 0` turns the
-device's switch off for one run.
+`-SillClipboardNote sent|long|notsent` its note; `-Sill.shareClipboard 0` turns
+the device's switch off for one run. Live against a synthetic host on loopback,
+`-SillSettingsScript '3 paste TEXT'` sends TEXT as the Paste control hands it
+over (the receipt and its note included; through `sillrelay.py
+--blackhole-after S` it never comes), and `-SillSettings 1 -SillSettingsCloseAt
+<s>` holds the Settings panel over the chip until then; the console's
+"clipboard: …" lines say what happened.
 
 ## The Mac's menus on the device
 
```

**File**: `docs/clipboard-plan.md` (modified, +177/-12)
```diff
@@ -76,6 +76,13 @@ dependency, the device through the local package).
   `me.saffer.sill.clipboard` naming its launch); only a change with text, not empty, at most 256 KB,
   whose JSON fits. A marker's types are read before any data, so neither a password manager's text
   nor another device's is ever read.
+- **The rate** (`hostReceives`, after the review): what a device's message asks is decided first; a
+  subscription or text is taken at most 4 times in any second (`admits`), the rest refused (`rate`); a
+  stop is always taken and counts nothing, nor does a refusal (`countsAgainstRate`).
+- **macOS's paste privacy** (`MacAccess`, `hostLooks`, `accessStep`, `accessLine`, after the review):
+  NSPasteboard's `accessBehavior` (macOS 15.4 and later) read as allowed, not asked yet, asks or denied
+  (a value this build does not know as asks); the host reads its pasteboard only while macOS allows
+  every read, and what was copied while it did not is never sent.
 - **Who a device's text goes to**: every subscriber but its sender (`forward`).
 - **The device's subscription** (`deviceSubscription`): subscribe while the Mac says 1 or more, the
   switch is on and this connection has not; stop when it has and the switch is off; nothing otherwise.
@@ -85,6 +92,11 @@ dependency, the device through the local package).
   says 1 or more, text not empty and within the cap, and not the text this device sent while its
   clipboard still holds it (its change count unchanged since the send: the Mac's echo, which a host of
   this change never sends, but a later one could).
+- **A Paste's receipt** (`receiptLength`, `receiptWait`, after the review): "Sent" only once a ping sent
+  after the text comes back, its payload 16 random bytes; none within max(4 s, 4 × the worst round trip),
+  "Didn’t reach ‹Mac›. Try Paste again." and the copy not dealt with.
+- **The chip's time** (`chipCounts`, after the review): its 20 s run only while it is on screen, Sill is
+  active and VoiceOver is off.
 - **The chip** (`offersChip`): connected, the Mac says 1 or more, the switch on, the device's clipboard
   has text (`hasStrings`), and its change count is not the one Sill last handled (sent, wrote from the
   Mac, or dismissed). When Sill becomes active, or when a session's first list says 1 or more within
@@ -115,13 +127,26 @@ dependency, the device through the local package).
 - **A device's text.** `prepareForNewContents(with: .currentHostOnly)` (so Universal Clipboard does
   not carry it to the person's other devices, the device included), one item with the text and the
   marker, the change count kept, and the text forwarded to every other subscriber.
-- **Limits.** At most 4 kind 32 a second per connection (a tap sends one); the rest, and text over
-  the cap, ignored with one line a minute (`RefusalSummary`). Contents are never logged. Stats keys
+- **Limits.** At most 4 subscriptions and texts a second per connection (a tap sends one); the rest,
+  and text over the cap, ignored with one line a minute (`RefusalSummary`). A stop is never limited. Contents are never logged. Stats keys
   `clip.sent` (messages sent) and `clip.recv` (texts taken), only in seconds they happen.
+- **macOS's paste privacy** (after the review). The look reads NSPasteboard.general only while
+  `MacClipboard.access()` says macOS allows every read (`accessBehavior` `.alwaysAllow`, or a macOS
+  before 15.4); otherwise it reads nothing, not even the change count, and when reads are allowed again
+  the count is taken as seen. One line when macOS's answer changes ("Clipboard: macOS asks before Sill
+  reads the clipboard, so what is copied on this Mac stays here. …"). A device's text is still written
+  (the count from `prepareForNewContents`). Settings › General (`ClipboardSection`): under the switch,
+  while macOS asks or denies, the reason, what to do and "Allow in System Settings…", which opens
+  Privacy & Security › Paste from Other Apps (`Privacy_Pasteboard`); while macOS has not asked about
+  Sill yet, Sill is not listed there (NSPasteboard.h), so the button first makes one read on that click
+  (`MacClipboard.askOnce`, off the main thread, the text dropped) for macOS to ask. `PermissionsModel`
+  reads the state with the permissions.
 - **Test hosts.** A synthetic host never reads or writes this Mac's clipboard, as it never reads the
   real pointer: it uses a pasteboard of its own, `me.saffer.sill.test.<pid>`, or the one
   `SILL_TEST_PASTEBOARD=<name>` names (TEST ONLY), said once at its first subscription.
   `SILL_TEST_CLIPBOARD_LOG=1` (TEST ONLY) prints each decision with the text's size, never the text.
+  `SILL_TEST_CLIPBOARD_ACCESS` (TEST ONLY) gives its pasteboard macOS's answer: a word, or a file
+  holding one, read at each look.
 
 ### Device
 
@@ -135,19 +160,31 @@ dependency, the device through the local package).
   then press ⌘V there) with the system Paste button and a dismiss button appears near the bar: under
   the bar at t
```

---

### Incident Patch 3: `46b208c8` (2026-10-14)
**Commit Message**: docs: the review of #80, its fixes and their verification in the plan and CLAUDE.md

The plan's Results gain "The review (2026-10-14) and its fixes": the four
findings and the commit that fixed each, the two-window runs before and after
(2fc53ed's build sent no Esc to the host with Settings open in the window
behind; this build sent key 53; with a tour in each window, Esc closed the
front one's and left the other's alone), the one-window Esc cases again, the
two claims that did not hold ("Fixes #68", now Towards; run-all's flaky
protocol case), and the verification on 7fdc902: the three iOS builds from new
derived data and a clean swift build -c release with the known warnings only,
run-all.sh 41 of 41 at the first run, the touch rig 72 of 72, no mutants again
(no check compiles a file the review changed). Progress and "Not verified here"
follow; CLAUDE.md's entry gets a review bullet and its Verified bullet rewrapped.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `CLAUDE.md` (modified, +20/-11)
```diff
@@ -49,17 +49,26 @@ and #68 together)". Device only: no wire change, nothing on the Mac changed.
   warnings only; 19 harness photos identical to main's (the Menus pull-down open among them, the hold let
   go under it); live on private simulators against `SillHost --synthetic`, with `Tests/keyrig` (new, TEST
   ONLY: a virtual HID keyboard and mouse inside the simulator, as duorig): keys and ⌘W with no Keyboard
-  button, after two turns too (an iPhone, `-SillTurnAt`); Esc,
-  ⇧Esc, ⌘Esc and ⌥⌘Esc through both channels; Esc closing Settings and skipping the tour with nothing
-  sent; the tour shown with a keyboard attached; a keyboard going and coming; the button's two states on a
-  fresh iPhone; wheel notches; the touch rig 72 of 72 against main's. Found there and fixed: a lone wheel
-  notch was never sent; the rule asked with no view in a window. Learned in the simulator: its GameController
-  always counts its own keyboard, UIKit counts one once keys arrive, iPadOS 27 refuses programmatic turns,
-  and scroll events marked as momentum reached no pan there (no real trackpad's events reached the
-  continuous pan, so a device decides whether iPadOS coasts too). CI's Build and check passed on 807c8ef.
-  With the other open pull requests
-  it meets in the docs and, with #79, in StreamScreen.swift's DEBUG hooks (keep both): the plan's
-  Progress.
+  button, after two turns too (an iPhone, `-SillTurnAt`); Esc, ⇧Esc, ⌘Esc and ⌥⌘Esc through both channels;
+  Esc closing Settings and skipping the tour with nothing sent; the tour shown with a keyboard attached; a
+  keyboard going and coming; the button's two states on a fresh iPhone; wheel notches; the touch rig 72 of
+  72 against main's. Found there and fixed: a lone wheel notch was never sent; the rule asked with no view
+  in a window. Learned in the simulator: its GameController always counts its own keyboard, UIKit counts
+  one once keys arrive, iPadOS 27 refuses programmatic turns, and scroll events marked as momentum reached
+  no pan there (no real trackpad's events reached the continuous pan, so a device decides whether iPadOS
+  coasts too). CI's Build and check passed on 807c8ef. With the other open pull requests it meets in the
+  docs and, with #79, in StreamScreen.swift's DEBUG hooks (keep both): the plan's Progress.
+- The review (2026-10-14; the plan's Results, "The review and its fixes"): four findings, each checked
+  here first and fixed in a commit of its own. Esc's key commands and EscapeKey keep to their own window
+  (`onScreen(in:)`, `fire(in:)`): Settings open in a window behind took the stream's Esc key commands in
+  front (a private simulator, `-SillSecondWindow 1 -SillSettings 1 -SillEscViaCommand 1`: 2fc53ed's build
+  sent no key 53 to the host, this one did), and Esc could close another window's panel. README, the
+  support page, the App Store bullet and the next What's New keep Esc and trackpad scrolling out until
+  Noah's steps 1, 7 and 9 pass (the plan's "Words that wait for a device"); the support page's Keyboard
+  button sentence; Full Keyboard Access and Switch Control (open question 11, step 13). Towards #68, not
+  Fixes. Again on 7fdc902: the three iOS builds and a clean `swift build -c release`, the known warnings
+  only; `run-all.sh` all 41 at the first run; the touch rig 72 of 72; Esc in one window and in two, live; no check
+  compiles a file the review changed, so no mutants again.
 - **Untested, for Noah (the plan's 1–13, on the iPad with the Magic Keyboard, a Debug build):** which
   channel brings Esc (`hwkey:`; `-SillKeyProbe 1`), Esc in iTerm2's vim, zsh's vi mode and Zed, and
   Control-[; typing right after connecting and after a turn; ⌘W closing the Mac's window, not Sill's;
```

**File**: `docs/hardware-keyboard-plan.md` (modified, +72/-1)
```diff
@@ -386,9 +386,76 @@ scenarios on main's surfaces and on this branch's; `compare.py` 72 of 72 (the ov
 trackpad's one- and two-finger strokes give the same events as before, the gestures as before). It makes
 direct touches only, not scroll events: the wheel's pan ran under the key rig instead.
 
+**The review (2026-10-14) and its fixes.** An adversarial review of 2fc53ed re-ran every claim above and
+found four things, and two claims that did not hold. Each was checked here against the code first, then
+fixed in a commit of its own:
+
+1. **Esc and `EscapeKey` across Sill's windows** (should-fix; bdc121d). `EscapeKey.onScreen` counted the
+   EscapeKeys of every window, so Settings, the tour, the pairing overlay or the Add a Mac card open in one
+   window took the stream's Esc key commands away in every other; on a device that gives Esc only to the
+   key command (#67's), Esc then went nowhere in the window in front. And `fire()` answered with the newest
+   EscapeKey in any window, so Esc in one window could close another's panel. Now `onScreen(in:)` and
+   `fire(in:)` take the window (§1). On a private iPad Pro 13-inch (M5) simulator, iOS 27.0, against
+   loopback `SillHost --synthetic` with keys from the key rig:
+   - `-SillSecondWindow 1 -SillSettings 1 -SillEscViaCommand 1` (Settings open in the first window, behind;
+     the second in front, holding the keyboard), then Esc and "a": 2fc53ed's build handed Esc on with no
+     key-command line, and the host got only the "a" (key 0); this build: `hwkey: usage 41 down via
+     keyCommand (none): to the Mac`, and the host got key 53 down and up, then key 0.
+   - `-SillSecondWindow 1 -SillTour touch -SillTakeTourAt 5` (a tour in each window, then Settings opening
+     in the one behind), Esc in the front window: this build closed the front window's tour (`escape: Esc
+     to what is on screen in its window (its EscapeKey), not to the Mac; 1 in other windows, left alone`;
+     the photo after it shows the front window with no tour). 2fc53ed's build closed the front window's
+     tour too: the Settings panel opened in the window behind never put its EscapeKey on screen while that
+     window stayed behind (2fc53ed's Esc closed a tour, not that panel; this build counted one EscapeKey in
+     the other window, not two), so the newest EscapeKey anywhere was still the front window's. Showing
+     `fire()`'s old mistake needs two windows side by side, or a switch from one to the other, which these
+     runs could not make: Noah's step 12.
+   - One window, as before the fix: with Settings open, Esc closed it through its EscapeKey with nothing at
+     the host, then Esc and "a" reached the host (key 53, key 0); with `-SillTourState fresh` the tour
+     showed 1.10 s after the picture with the keyboard attached, an "a" during it reached nothing, Esc
+     skipped it, then Esc and "c" reached the host; with `-SillEscViaCommand 1`, Esc, ⇧Esc and ⌥⌘Esc came
+     through the key command, each key 53 at the host with its flags and every modifier let go after;
+     `-SillInputTest 1`: Esc and ⇧Esc through the key command, a trackpad's scroll with its coast and a
+     wheel's (104 scroll events at the host); in the harness the Add a Mac card (`-SillLayout 1000x710
+     -SillConnectCase addmac`) closed on Esc.
+2. **Public words beyond what a device has shown** (nit; af9f13c). README.md, public as soon as this
+   merges, said Esc reaches the Mac and a trackpad or a mouse scrolls, and so did the support page, the App
+   Store description's bullet and the next What's New. They now keep to typing without the Keyboard
+   button; "Words that wait for a device" (above) has the fuller lines. CLAUDE.md's "a pan gets no momentum
+   events" is now a simulator observation.
+3. **The support page's Keyboard button** (nit; af9f13c). It said the button "shows the on-screen
+   keyboard"; with a keyboard attached it brings up the keyboard bar first: now "It brings up your
+   device’s keyboard bar, and from there the on-screen keyboard."
+4. **Full Keyboard Access and Switch Control** (nit; 7fdc902). The hold puts Tab, Space and the arrows
+   on the Mac and, with a keyboard attached, the Keyboard button never lets go for good
+   (`HardwareKeyboardPolicy.toggled()` answers `makeAutomatic` while the hold is wanted, read here):
+   open question 11 and step 13.
+
+The claims that did not hold: "Fixes #68" (no real trackpad's events reached the continuous pan, and the
+double coast is untested): the pull request now says Towards #68. And "`run-all.sh`: all 41 pass" held for
+the review only on a second run: `protocol`'s "generate: digits uniform", a p = 0.001 test of
+StreamProtocol's pairing-code generator, which this branch does not touch, failed once (chi² 27.9 against
+a bound of 27.9) and passed alone. Here, on 7fdc902, it passed all 41 at the first run (347 s; `protocol`
+ALL PASS, hardware-keyboard 51 checks, key-strokes 347).
+
+Verified again on 7fdc902 (
```

---

### Incident Patch 4: `af462f78` (2026-10-14)
**Commit Message**: docs: Larger Picture's plan, the final builds and checks (#58)

Progress names the review's docs commit, and H1 and H4 the final head's
numbers: the Swift package built from clean in 43 s, Tests/checks/run-all.sh
all 40 on cfad7f3.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `docs/larger-picture-plan.md` (modified, +4/-4)
```diff
@@ -288,14 +288,14 @@ own runs (R1 to R4).
 - **H1, builds:** iOS Debug and Release for the generic simulator (arm64) and Debug for a generic
   device, `CODE_SIGNING_ALLOWED=NO`: `** BUILD SUCCEEDED **`, only the known `StreamClient` capture
   warning (StreamClient.swift:3435, 3430 at main); the Release binary holds none of the DEBUG
-  arguments or console lines. `swift build -c release` (nothing of the host changed): built, only
-  the CaptureProbe warning.
+  arguments or console lines. `swift build -c release` (nothing of the host changed): built from
+  clean in 43 s, only the CaptureProbe warning.
 - **H2, `phone-portrait`:** 401 checks (165 at main, unchanged but for the standard arrangement's
   keyboard table, which now has the SE's and the minis' measured keyboards) and 68 of 68 mutants
   (31 at main; M12 and M13 follow the ruler into a function; 28 new with the build, 9 with the
   review's fixes).
 - **H3, `tour`:** 111,079 checks (51,840 at main) and 80 of 80 mutants (72 at main, 8 new).
-- **H4:** `Tests/checks/run-all.sh`, all 40 passed.
+- **H4:** `Tests/checks/run-all.sh`, all 40 passed (6 min, on cfad7f3).
 - **H5, nothing else moved:** 33 harness photos on an 18 Pro Max simulator, the switch off, against
   main's build (985a733, from `git archive`): 402x812, 393x793, 390x797, 375x762 and 375x647 plain,
   drawer, ruler, the Desktop, Settings at its end and a thumbnail's lights, 874x402 plain and
@@ -432,5 +432,5 @@ device; a real iPhone Duo; the Menus button's Large Content Viewer (the review's
 - 2026-10-14, the review's fixes: Larger Picture only where it is larger, and the panel's switch
   only there (0e9aa0e); the drawer above row 1 (77abae3) and read after it by VoiceOver (d6322a9);
   the switch applying as Settings closes (0cbe883); the docs, these results and the review's section
-  (the docs commit). Simulators deleted; the review's photos in
+  (cfad7f3, and this line). Simulators deleted; the review's photos in
   `~/Downloads/sill-handoff/larger-picture/review-fixes/`. PR #79's body updated; left for Noah.
```

---

### Incident Patch 5: `ba4efafd` (2026-10-14)
**Commit Message**: Docs: the review's fixes, its flows for Noah, full screen and several devices in the public copy

The review found the docs and the list for Noah out of date: the restore probe had run (17 of 17
then, 20 of 20 now with steps 13 and 14), and the list lacked the flows most likely to fail (full
screen entered and left while the window streams, a window full screen when picked, a resize from
the left or top edge, two devices, a display unplugged mid-stream). support.html said the window
goes back when you disconnect (with two devices only the last to leave puts it back) and that a
full-screen window stays as it is (it then keeps the size Sill gave it when it leaves full screen).
The plan, CLAUDE.md and the pull request called the check's copy of the coordinator's glue a model
that ran.

The plan: the design as it stands (the sequences over WindowRestore.Access, the fit never in full
screen, an unanswered size and a failed read-back recorded, movedSince, the grace in
windowsChanged), open questions 15 to 19 with their defaults, the review and its fixes with the
numbers, Noah's twelve steps and what is known and left, Progress. CLAUDE.md's Current step entry
and its Layout lines; DEVELOP

**File**: `CLAUDE.md` (modified, +91/-53)
```diff
@@ -10,54 +10,88 @@ Formerly winstream; the folder still carries the old name.
 
 **A window Sill sized goes back (2026-10-14, branch `restore-window-frames` from main at 985a733,
 PR #75; docs/restore-window-frames-plan.md has the rule, the open questions with the defaults taken,
-the results and Noah's steps).** Issue #57 (rosstex): "disconnecting on the iOS app doesn't revert
+the review, the results and Noah's steps).** Issue #57 (rosstex): "disconnecting on the iOS app doesn't revert
 apps back to their original shape/size on Mac". In regular mode (Virtual Display off) Aa resized the
 real window (`StreamCoordinator.fitToViewport`) and nothing put it back, on purpose until now. Host
 only; no wire change, nothing on the device, nothing stored.
 - The rule (`WindowRestore`, pure; `Tests/checks/window-restore`): each fit's record (`original`,
-  the AX frame before Sill first touched it; `set`, the frame read back; `asked`; `moved`, a move
-  noted at a later fit; 2 pt tolerance) and, when the window stops streaming, `decide`: gone
-  (nothing), full screen (left, a line), home (nothing), `settle` (Sill asked another size and the
-  read-back never showed it: an app that applies a size late, stopped first; the original written
-  again, no line), resized on the Mac after Sill's last fit (left entirely, a line), unmoved (the
-  whole original frame), moved (its own size where it is, kept on its display by `keep`, moved here
-  from WindowSizer). Lines in the stage's style: "Restored ‹app› — ‹title› to (x,y,w×h)", "…, its
+  the AX frame before Sill first touched it; `set`, the frame read back; `asked`; `moved`, noted at
+  a later fit by `movedSince`: at Sill's size its top-left corner elsewhere, at another size both
+  edges of an axis gone the same way from where Sill left it, at either of Sill's sizes, so a resize
+  from any edge or corner, or with Option, is no move; 2 pt tolerance) and, when the window stops
+  streaming, `decide`: gone (nothing), full screen (left, a line), home (nothing), `settle` (Sill
+  asked another size and the read-back never showed it: an app that applies a size late, stopped
+  first; the original written again, no line), resized on the Mac after Sill's last fit (left
+  entirely, a line), unmoved (the whole original frame), moved (its own size where it is, kept on its
+  display by `keep`). Lines in the stage's style: "Restored ‹app› — ‹title› to (x,y,w×h)", "…, its
   own size where it was moved", "Left … at (…): it was resized on the Mac", "Left … as it is: it is
   full screen", "Could not restore …", "…: it is not answering Accessibility"; `win.restored` in the
   `[1s]` lines.
-- Where: `fitToViewport` records every resize the app took (`WindowSizer.resize` returns `Fit`: the
-  element and the frames before and after, and puts back its own nudge when the size is refused;
-  no fit once `shuttingDown`); `select` restores every fitted window but the next source's once the
-  old pipeline has stopped (a pick, the Desktop, `.none` when the last device leaves or the stream
-  stops), and its defer every one when nothing streams (a window gone, a failed start);
-  `shutdownForExit` (Quit, the signals under `HostShutdown.install`) and `releaseKeysForExit` (the
-  CLI's default path at a signal) restore every one. The per-window restore is WindowSizer's
-  (`stopDecision`: one AX read first, an app that does not answer left after at most a second;
-  `putBack` through `restore`). Virtual Display turned on while a fitted window streams:
-  `VirtualStage.prepare(…, home:)` keeps the frame it would have gone back to (`stageHome`,
-  `WindowRestore.homeForStage`) and the record is handed over (`Ledger.take`) only once staged;
-  `restoreFits` skips the staged window (Quit mid-`prepare`).
-- Defaults taken (the plan's 14): the CLI's Ctrl-C restores too (a line only when a window was
-  sized, the same exit status); full screen left; resized left, position included; moved keeps its
-  place, also after a re-fit (`moved`); a resize a re-fit undid is forgotten; a failed restore tried
-  once; nothing after a crash or `kill -9` (memory only); the App Store text unchanged.
-- Verified: `swift build -c release` (only the CaptureProbe warning); `Tests/checks/run-all.sh`, all
-  41 (383 s); `window-restore` 41,391 checks (90 cases and a model of the glue, 5,000 random
-  sessions against a stand-in Mac; its first run found the late app's race, now `settle`) and 48 of
-  48 mutants (in CI's matrix); H2 against 985a733 from `git archive`: idle 35 s identical masked and
-  sorted, a Desktop client identical but for the last partial second's `[Ns]` line, as base against
-  base. No iOS file changed.
-- Not verified here: anything live. AX was trusted, but the screen was locked with the display
-  asleep (7.8 h idle): the window server listed a new window at about 0.9 of its frame and
-  Accessibility listed none, so `resize` matched nothing. `Scripts/restore-probe/run.sh` (a window of
-  it
```

**File**: `README.md` (modified, +2/-2)
```diff
@@ -99,8 +99,8 @@ Sill has layouts of its own.
   through Accessibility, so its text shows at the size you pick, and keeps it
   at that size while it streams. The window goes back to its own size and
   place when Sill stops showing it: you pick another window or the Desktop,
-  disconnect, or quit Sill. If you moved it on your Mac meanwhile, it keeps its
-  new place.
+  your last device disconnects, or you quit Sill. If you moved it on your Mac
+  meanwhile, it keeps its new place.
 - **The virtual display** (off by default) moves a window you stream onto a
   display of its own on your Mac, so it keeps updating when other windows
   cover it. It uses a private macOS API, which is one reason Sill for Mac comes
```

**File**: `Tests/checks/README.md` (modified, +1/-1)
```diff
@@ -71,7 +71,7 @@ exit status is the number of checks that failed. Binaries, data and logs go to
 | `remote-rules` | `iOSClient/DiscoveryPolicy.swift`, `RemoteDialPolicy.swift`, `SavedMacs.swift` with `Sources/StreamProtocol` (`build.sh`), with `main.swift` and `home.swift` | the Remote rows and automatic remote dial, the order a saved Mac's addresses are tried in, what a failure means, saved Macs; pairing at home's model, a look-alike under a saved Mac's name among it, and the saved Macs' home fields (`home.swift`) | 123 | 72 |
 | `tour` | `iOSClient/TourPolicy.swift` (with `PhonePortraitLayout.swift`) | the first-run tour's rules: the steps and targets per layout (sideways, the halves, a phone's rows; and under VoiceOver), what is owed, when the tour shows by itself (a beat after the picture, nothing touched, sent, used or open; a turn), memory and runs, Skip in Take the Tour, what a session decided and the automatic reconnect's, a rotation mid-run, the crease, the card's width and place, beside its targets (pinned at the Duo's four sizes, the iPhone SE's two and four phones upright against PhonePortraitLayout's rects, an oracle, a grid of screens and heights), every string (the Duo's own words for its keys) | 51,840 | 72 |
 | `update-policy` | `Sources/SillMenuBar/UpdatePolicy.swift` with `Sources/StreamProtocol` (`build.sh`) | Sill.app's update check: what each answer from GitHub's releases feed means, the offer, the schedule, the feeds and pages it accepts, every text | 124 | 18 |
-| `window-restore` | `Sources/SillHost/WindowRestore.swift` (`build.sh`) | a window Sill sized for a device goes back when it stops streaming (issue #57): `keep` at every edge; each fit's record (the first frame kept, a move since noted at 2 pt); what becomes of the window at the stop (gone, full screen, home, settled for an app that applies a size late, resized on the Mac and left, its whole frame back, or its own size where it was moved, kept on its display); the virtual display's way home; the ledger (stopping in window ID order, `take`); every line. Then a model of the coordinator's glue against a stand-in Mac: 5,000 random sessions of picks, viewports, restarts, the catalog's resize check, the person moving, resizing, closing and full-screening windows, apps that clamp, snap or apply a size late, the virtual display on and off, the last device leaving and Quit, each window held to where the person expects it | 41,391 | 48 |
+| `window-restore` | `Sources/SillHost/WindowRestore.swift` (`build.sh`) | a window Sill sized for a device goes back when it stops streaming (issue #57): `keep` at every edge; each fit's record (the first frame kept; a move since noted by `movedSince`, a resize from any edge or corner being none); what becomes of the window at the stop (gone, full screen, home, settled for an app that applies a size late, resized on the Mac and left, its whole frame back, or its own size where it was moved, kept on its display); the virtual display's way home; the ledger (stopping in window ID order, `take`); every line; the sequences that fit a window and put it back (`fit`: never in full screen, a refusal's nudge put back, an unanswered size or a failed read-back recorded; `stop`; `stageHome`; `Ledger.restore`) and `keepsStreaming` and `coversDisplay` for a window off the list on its way into or out of full screen, against a stand-in window that logs every call. Then a stand-in Mac answering the real sequences, with a copy of the coordinator's glue around them: 5,000 random sessions of picks, viewports, restarts, the catalog's resize check and its looks, the person moving, resizing (from any edge or corner), closing and full-screening windows, apps that clamp, snap, apply a size late, answer it late or fail a read-back, windows that cannot be resized, full-screen writes answered either way, windows off the list on their way into or out of full screen, the virtual display on and off, the last device leaving and Quit, each window held to where the person expects it | 41,499 | 95 |
 
 The counts are those of the `remote-away` branch (PR #39) after its merge with main at e6b3265
 (2026-10-08), where every check passes. The mutants of the 27 checks whose files that merge changed
```

**File**: `docs/DEVELOPMENT.md` (modified, +40/-23)
```diff
@@ -298,23 +298,37 @@ and open Sill again.
 
 Without the virtual display, Aa (text size) on the device resizes the window
 it streams on the Mac itself, through Accessibility, to the device's panel at
-that scale (nothing happens until Aa is first touched). The window goes back to
-its own frame when it stops streaming: another window or the Desktop picked,
-the last device disconnecting, the stream stopping (the window closed, a stream
-that failed to start), and Sill quitting (Quit, logout, a `kill` or hangup, and
-Ctrl-C of `SillHost`). Moved on the Mac meanwhile, it gets its own size back
-where it is now, kept on its display; resized on the Mac after Sill last sized
-it, or full screen, it is left as it is. A resize on the Mac while it streams
-is undone by the next fit within about two seconds, so it does not count.
-Turning the virtual display on while such a window streams stages it with that
-frame as its way home. Each window acted on gets one line in the log:
-"Restored Safari — Apple Developer to (212,95,1280×800)", "…, its own size
-where it was moved", "Left … at (…): it was resized on the Mac", "Left … as it
-is: it is full screen", or "Could not restore …" (an app that does not answer
-Accessibility is left where it is rather than wait out a second for each
-write). The frames are kept in memory only: after a crash or `kill -9` the
-window stays at the size Sill gave it. `Sources/SillHost/WindowRestore.swift`
-is the rule, checked in `Tests/checks/window-restore`;
+that scale (nothing happens until Aa is first touched; a window in full screen
+is not resized: "Window sizing: ‹app› — ‹title› is full screen; not
+resizing."). The window goes back to its own frame when it stops streaming:
+another window or the Desktop picked, the last device disconnecting (with
+several connected, the first to leave changes nothing), the stream stopping
+(the window closed, a stream that failed to start), and Sill quitting (Quit,
+logout, a `kill` or hangup, and Ctrl-C of `SillHost`). Moved on the Mac
+meanwhile, it gets its own size back where it is now, kept on its display;
+resized on the Mac after Sill last sized it, or full screen, it is left as it
+is (full screen, it keeps the size Sill gave it when it leaves full screen). A
+resize on the Mac while it streams, from any edge or corner, is undone by the
+next fit within about two seconds, so it does not count, and the window still
+goes back to its old place; a move and a resize both made before that fit are
+taken as the window's edges show them. A window that enters or leaves full
+screen while it streams is off the window list for a second or two: it keeps
+streaming through three of the catalog's looks, as a window on the virtual
+display does, and goes back at the stop like any other (a pick, Disconnect or
+Quit within that second can still leave it at the size Sill gave it). A busy
+app that does not answer the size in time is still recorded ("… did not answer
+the size in time; if it takes it later, it still goes back."). Turning the
+virtual display on while such a window streams stages it with that frame as its
+way home. Each window acted on gets one line in the log: "Restored Safari —
+Apple Developer to (212,95,1280×800)", "…, its own size where it was moved",
+"Left … at (…): it was resized on the Mac", "Left … as it is: it is full
+screen", or "Could not restore …" (an app that does not answer Accessibility is
+left where it is rather than wait out a second for each write). The frames are
+kept in memory only: after a crash or `kill -9` the window stays at the size
+Sill gave it. `Sources/SillHost/WindowRestore.swift` is the rule and the
+sequences that fit a window and put it back (over `WindowRestore.Access`, which
+`WindowSizer.AXWindows` answers through Accessibility), checked in
+`Tests/checks/window-restore` against a stand-in Mac;
 docs/restore-window-frames-plan.md has the reasons, and The restore probe
 (below) checks it against a real window.
 
@@ -690,15 +704,18 @@ file's header says how to build and run it.
 `Scripts/restore-probe/run.sh` checks that a window Sill sized goes back, with
 the real `WindowSizer.resize` and the restore the host runs, against a window
 of its own (`owner.swift`, in a bundle that never comes to the front, at the
-lower left behind every other window): twelve steps (a stop, a rotation's
+lower left behind every other window): fourteen steps (a stop, a rotation's
 re-fit, moved, moved then re-fitted, resized, an app's minimum, a window that
 closes, the nudge at a display's edge, a window that cannot be resized, an app
 that does not answer, the virtual display's way home worked out without a
-display, and two windows), each frame before, during and after. It touches no
-other window, posts no input and makes no virtual display, and the front app
-must not change. It needs Accessibility and Screen Recording for the terminal,
-and an unlocked screen: while the screen is locked the window server shows a

```

**File**: `docs/restore-window-frames-plan.md` (modified, +226/-47)
```diff
@@ -50,8 +50,12 @@ For each window Sill fits, a record:
 
 A fit (`WindowRestore.fitted`): the first makes the record; a later one (a rotation, another Aa
 step, a restart that resized) keeps `original`, takes the new `set` and `asked`, and sets `moved`
-when the window's origin before this fit is more than 2 pt from the last `set`'s. Once set, `moved`
-stays.
+when the window was moved since the last fit (`movedSince`, after the review: at Sill's size, read
+back or asked, its top-left corner more than 2 pt from `set`'s; at another size, both its left and
+right edges, or both its top and bottom, gone the same way by more than 2 pt from where Sill left it,
+at either of Sill's sizes). A resize from any edge or corner keeps the opposite edge where it was, and
+one with Option held moves the two apart, so neither is a move: the next fit undoes it and the window
+still goes back whole. Once set, `moved` stays.
 
 When the window stops streaming (`WindowRestore.decide`), from its frame now:
 
@@ -77,7 +81,9 @@ A resize on the Mac while the window streams is undone today within about two se
 catalog's resize check restarts the pipeline, 2135-2140, and the restart fits the window again,
 1344), so rule 4 mostly sees a resize made in the last two seconds before the stop, or after the
 fit that a restart would have redone. Such a re-fit keeps `original`: the window goes back to the
-frame it had before Sill first touched it, not to the size the person tried for a moment.
+frame it had before Sill first touched it, not to the size the person tried for a moment, whichever
+edge or corner was dragged (since the review; before, a drag of the left or top edge counted as a
+move).
 
 `WindowRestore.Ledger<Handle>` keeps the records by window ID, each with the coordinator's handle
 (a `WindowSizer.Placement`: the window's AX element, matched once at the first fit, its pid, app and
@@ -89,10 +95,10 @@ check pins them.
 
 ### Where the coordinator calls it
 
-- `fitToViewport`: every resize that went through (the size write accepted) is a fit for the
-  ledger, with the frames `WindowSizer.resize` now returns (`WindowSizer.Fit`: the element, the
-  frame before and the frame after). A fit after `shuttingDown` does nothing (nothing would restore
-  it).
+- `fitToViewport`: every resize that went through (the size write accepted), or went unanswered
+  (after the review), is a fit for the ledger, with the frames `WindowSizer.resize` now returns
+  (`WindowSizer.Fit`: the element, the frame before and the frame after). A fit after `shuttingDown`
+  does nothing (nothing would restore it). A window in full screen is not resized (after the review).
 - `select`: after the old pipeline stops and the virtual display has sent a staged window home,
   every fitted window but the one about to stream is restored (`restoreFits(keeping:)`): a pick of
   another window or the Desktop, `select(.none)` when the last device leaves or the stream stops,
@@ -108,17 +114,36 @@ check pins them.
   (`take`) only once the stage has it. A staging that fails keeps the record. Turning the virtual
   display off sends the staged window home as before; the regular path then fits it from there,
   a new record whose `original` is that home.
-
-The per-window restore is WindowSizer's, so the coordinator and the live probe run the same code:
-`stopDecision` reads the frame (one Accessibility read first: no frame from a window the window
-server no longer lists is `gone`; none from one it lists means its app does not answer, a beach
-ball, and the window is left with a line after at most a second, instead of up to six seconds of
-writes on the main actor), whether it is full screen and the visible area of its display, and asks
-WindowRestore; `putBack` writes a `restore` or `settle` through `WindowSizer.restore` (position,
-size, position through the element kept from the first fit; a window gone is nothing to restore, a
-`cannotComplete` gets one more try while the window is listed, a window left off every display is
-nudged onto the main one), so a window that is gone, minimized, in full screen or refusing AX is
-handled as the virtual display's is.
+- `windowsChanged` (after the review): the streamed window missing from the catalog's on-screen list
+  in regular mode keeps streaming through three looks, as a staged full-screen window does, when it
+  was full screen when last listed or when picked (its frame covered a display: `coversDisplay`,
+  VirtualStage's 98 % rule) or, when Sill fitted it, Accessibility says it is full screen now; unless
+  Accessibility and the window server both say it is gone (`WindowRestore.keepsStreaming`). A window
+  entering or leaving full screen is off every list for a second or two, and stopping it then decided
+  its way back mid-change. It now comes back at the size Sill gave it and keeps streaming.
+
+The two sequences that read and move a window are WindowRestore's since the review, generic over
+`WindowRestore.Acc
```

**File**: `site/support.html` (modified, +2/-2)
```diff
@@ -103,10 +103,10 @@ <h2 id="remote-access">Remote Access</h2>
   <!-- /Remote Access -->
 
   <h2 id="window-size">A window on your Mac changed size</h2>
-  <p>When you change the text size with Aa on your iPhone or iPad, Sill resizes the window you’re using on your Mac to fit your device, unless Virtual Display is on, and keeps it at that size while you use it. When you switch to another window or to the Desktop, disconnect, or quit Sill, the window goes back to the size and place it had.</p>
+  <p>When you change the text size with Aa on your iPhone or iPad, Sill resizes the window you’re using on your Mac to fit your device, unless Virtual Display is on, and keeps it at that size while you use it. When you switch to another window or to the Desktop, disconnect, or quit Sill, the window goes back to the size and place it had. With more than one device connected, it goes back when the last one disconnects.</p>
   <ul>
     <li>If you moved the window on your Mac meanwhile, it keeps its new place and gets its size back.</li>
-    <li>A window that’s full screen stays as it is.</li>
+    <li>A window that’s full screen when you stop stays as it is. When it leaves full screen it keeps the size Sill gave it; resize it yourself.</li>
     <li>If Sill for Mac stopped without quitting, for example after Force Quit, resize the window yourself.</li>
   </ul>
 
```

---

### Incident Patch 6: `1c4b9216` (2026-10-14)
**Commit Message**: Docs for #69: the final check and build numbers

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `CLAUDE.md` (modified, +4/-2)
```diff
@@ -54,8 +54,10 @@ docs; no wire change, nothing on the Mac.
   Desktop: asked for again 10 ms after a stand-in Mac said nothing streams (main: never). Photos of
   `asleep` at the Duo's four sizes and 744×1133, default and accessibility-extra-large; `homerows`
   pixel for pixel main's. `Tests/checks/policy` 441 cases (`sleep.swift`, models of a host stopped,
-  a sleep proxy, a new listing and the background), 158 mutants (28 new); the other DiscoveryPolicy
-  checks; the builds; `run-all.sh` (numbers in the PR).
+  a sleep proxy, a new listing and the background) and 158 of 158 mutants (28 new); `home-device`
+  124 of 124, `home-model` 21 of 21, `remote-rules` 72 of 72; `run-all.sh`, all 40; iOS Debug for the
+  simulator (CI's command), Release for the simulator and Debug for a device, only the known
+  `StreamClient` capture warning; `swift build -c release`, only the CaptureProbe one; CI green.
 - **Untested, for Noah:** the real overnight case on the iPad mini (Sill left streaming or on the
   connect screen for hours, the iPad locked; back: the console's "browser: rebuilt the network
   browser (back from the background)", the Mac's row as it is now, and the session back by itself if
```

**File**: `docs/reconnect-after-sleep-plan.md` (modified, +11/-1)
```diff
@@ -235,4 +235,14 @@ stamped as it came) and the host's log; the loss is the device's "connection sil
 - 2026-10-14: the plan (211e98c); the browsers made again, the reconnect kept alive, the Desktop
   asked for again, with `Tests/checks/policy`'s `sleep.swift` and 28 mutants (83f96ba); a failure
   keeps the rows as they are (03ca390); the runs above; the support page, README, the App Store
-  text for the next version, DEVELOPMENT.md and CLAUDE.md.
+  text for the next version, DEVELOPMENT.md and CLAUDE.md; PR #77.
+- Checks on the final files: `Tests/checks/policy` 441 cases (392 and 49 new) and 158 of 158
+  mutants (130 and 28 new); the other checks that compile DiscoveryPolicy.swift, whose mutants'
+  patterns occur as often as on main: `home-device` 182 cases and 124 of 124 mutants, `home-model`
+  62 and 21 of 21, `remote-rules` 123 and 72 of 72; `Tests/checks/run-all.sh`, all 40 passed
+  (493 s).
+- Builds: the iOS app Debug for the generic simulator as CI builds it (`CODE_SIGNING_ALLOWED=NO
+  ARCHS=arm64`), Release for the generic simulator and Debug for a generic device, unsigned: only
+  the known `StreamClient` capture warning (StreamClient.swift:3662, the closure main has at 3430);
+  `swift build -c release`: only the CaptureProbe warning. CI's "Build and check" passed on the PR
+  (run 38486135118, 8 min 39 s).
```

---

### Incident Patch 7: `b41c3218` (2026-10-14)
**Commit Message**: The plan and CLAUDE.md: the review, its fixes and the re-runs

The plan gains "The review" (three findings, each fixed: 5962ad4 macOS 26
and the virtual display among the untested, 7a7efcb the fit and shrink
claims with 20 checks, 99bd169 the margins), and its Results the re-runs
after the fixes: swift build -c release clean from git archive of 5962ad4
(54 s, only the CaptureProbe warning), Tests/checks/run-all.sh all 41
(372 s), settings-window 307,709 checks and 27 of 27 mutants, and where a
capped window sits (rosstex's saved frame 0 pt under the menu bar and 24
over the bottom, kept through a 70 and a 140 pt Dock; a pane grown while
Settings was closed reopened at the screen's bottom). rosstex's run is now
described as what it shows: a saved frame sets only this window's top-left.
CLAUDE.md's Verified says the same, and a Review bullet lists the findings.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `CLAUDE.md` (modified, +20/-8)
```diff
@@ -51,14 +51,26 @@ nothing on the iOS side, the CLI untouched.
   untouched): `swift build -c release` clean from `git archive`, only the CaptureProbe warning;
   `run-all.sh`, all 41; the previews (130 files) identical to 985a733's; every tab at its natural
   height (limit 845) but Remote Access with the internet switch on (909: shows 845, scrolls, 12 pt
-  from both edges); `-SillTestScreenHeight 700`: General (727) and Remote Access (909) capped at 596
-  and scrolling; the screen changing under the tall pane (`height=`, the notification's path): 845,
-  596, 396, 845, the window shrinking and growing; a pane growing past the cap, and a tab switch to
-  it, with the window low: moved up to 12 pt over the bottom; rosstex's 951 pt saved frame restored
-  capped at 925; General and Streaming scrolled to their ends inside a 600 pt screen (231 and 72
-  pt); Sill.app's ignore lines, from the binary in a scratch bundle under `sandbox-exec` with binds
-  denied; CI's "Build and check" on c2339e2. Photos without personal details in
-  `~/Downloads/sill-handoff/settings-window/`.
+  from both edges, Sill having moved it); `-SillTestScreenHeight 700`: General (727) and Remote
+  Access (909) capped at 596 and scrolling; the screen changing under the tall pane (`height=`, the
+  notification's path): 845, 596, 396, 845, the window shrinking and growing; a pane growing past
+  the cap, and a tab switch to it, with the window low: moved up to 12 pt over the bottom; a window
+  opened at rosstex's saved frame (951 pt, its top at the menu bar; a saved frame sets only the
+  top-left) capped at 925, 0 pt under the menu bar and 24 over the bottom, and a 70 and a 140 pt
+  Dock under it, 855 and 785, its top kept; a pane grown while Settings was closed, reopened by
+  AppKit at the screen's bottom, 24 pt under the menu bar; General and Streaming scrolled to their
+  ends inside a 600 pt screen (231 and 72 pt); Sill.app's ignore lines, from the binary in a scratch
+  bundle under `sandbox-exec` with binds denied; CI's "Build and check" on c2339e2. Photos without
+  personal details in `~/Downloads/sill-handoff/settings-window/`.
+- Review (2026-10-14, at bb2451e; it re-ran everything above with the same numbers): three findings,
+  each fixed in a commit of its own (the plan's "The review"). Should fix: the untested lists left
+  out macOS 26, the reporter's, and Sill's virtual display (now U6 and U7). Nits: "the 501
+  constraint never shrinks" and "General does not fit a 14-inch with the Dock" (corrected above,
+  with 20 checks for which pane fits which scaling); U1, U2 and the PR's steps promised 12 pt above
+  and below (now: 12 pt only on a side Sill moved the window away from). Re-run after the fixes:
+  `swift build -c release` clean from `git archive`, only the CaptureProbe warning; `run-all.sh`,
+  all 41; `settings-window` 27 of 27 mutants; where a capped window sits, with a scratch build whose
+  window was invisible and never activated (the screen unlocked, nobody at it).
 - **Untested, for Noah** (the plan's U1 to U8, with Sill.app from this branch on the 14-inch): at
   the scaling at the far left with the Dock showing, every tab fits between the menu bar and the
   Dock (12 pt clear only on a side Sill moved it away from), General scrolls to Quit Sill and Remote
```

**File**: `docs/settings-window-plan.md` (modified, +49/-6)
```diff
@@ -193,17 +193,21 @@ Nothing touched Sill.app, its preferences or the keychain; the bare binary's `Si
 was emptied after.
 
 - **Builds.** `swift build -c release` from `git archive` of the branch, clean: 85 s, only the old
-  CaptureProbe warning, as at 985a733. No iOS, host, CLI, protocol or site file changes (`git
+  CaptureProbe warning, as at 985a733; again after the review (5962ad4, whose Swift sources are
+  bb2451e's): 54 s, the same warning alone. No iOS, host, CLI, protocol or site file changes (`git
   diff --stat origin/main...`), so no iOS build was needed.
-- **Checks.** `Tests/checks/settings-window`: 307,689 checks, 27 of 27 mutants caught (42 s).
-  `Tests/checks/run-all.sh`: all 41 passed.
+- **Checks.** `Tests/checks/settings-window`: 307,689 checks, 27 of 27 mutants caught (42 s); after
+  the review 307,709 (20 for which pane fits which 14-inch scaling), 27 of 27 again (60 s).
+  `Tests/checks/run-all.sh`: all 41 passed, and again after the review (372 s).
 - **Previews.** `-SillRenderPreviews` of the branch's binary and of 985a733's, run from the same
   path: 130 files each, identical byte for byte.
 - **Every tab at this screen's height** (limit 845): each at its natural height, nothing capped:
   General 727 (window 807), Devices 281, Streaming 568, Virtual Display 227, Permissions 275,
   Remote Access 327 (off).
 - **The tallest pane** (Remote Access on, with the internet switch, this Mac's addresses: 909):
-  capped at 845, scrolling, the window 925 pt, 12 pt from the visible frame's bottom and top.
+  capped at 845, scrolling, the window 925 pt, 12 pt from the visible frame's bottom and top (Sill
+  moved it there: the switches went on with the window's top at 600, and it ran off the bottom as
+  it grew).
 - **A pane that grows past the cap with the window low.** The window placed by a saved frame with
   its top at 600; Remote Access off (407 pt window), then turned on with the internet switch: the
   window capped at 925 and moved up to 12 pt over the bottom (it would have run 325 pt below the
@@ -216,8 +220,22 @@ was emptied after.
   at their natural heights. Close and reopen: capped again.
 - **Scrolled to the end** at a 600 pt screen: General scrolled 231 pt (727 − 496) and Streaming 72
   (568 − 496), their last rows in view (`~/Downloads/sill-handoff/settings-window/`).
-- **rosstex's window**: a 951 pt frame saved by a version before the fix, restored: capped at 925,
-  Remote Access scrolling.
+- **rosstex's window**: a frame saved by a version before the fix, 951 pt tall with its top at the
+  menu bar. A saved frame sets only this window's top-left (the review's logging build saw it 500
+  × 580 before its first layout), so the run shows a window opened with its top at the menu bar
+  being capped, not a 951 pt frame shortened: 925 pt, Remote Access scrolling, 0 pt under the menu
+  bar and 24 over the bottom, left there since it fits.
+- **Where a capped window sits** (after the review, with the screen unlocked and nobody at it for
+  over half an hour: a scratch build of the branch whose Settings window was invisible, took no
+  click and never activated, `WindowPlacement.bringForward` alone changed and never committed; its
+  own defaults domain, deleted after). rosstex's saved frame again: 925 pt, 0 under the menu bar,
+  24 over the bottom. A Dock of 70 and then 140 pt (`height=879`, `height=809`): 855 and 785 pt,
+  its top kept, 24 over the Dock; the screen's own again: 925; General then 807, its top kept.
+  Remote Access and the internet switch turned on while Settings was closed (its top at 600): the
+  hidden window laid out at 925 pt, its bottom at −325; reopened, AppKit ordered it in at the
+  screen's bottom: 0 pt over the bottom, 24 under the menu bar. Every window fit, and `placed`
+  moved none (each lay inside the visible frame): the 12 pt margin holds only on a side Sill moved
+  the window away from (The move).
 - **A pane that gets shorter**: the internet switch turned off while Remote Access showed: the pane
   909 → 734, the window 925 → 814 (open question 4).
 - **Sill.app ignores the hooks.** The same binary in a scratch bundle (its own bundle ID, so
@@ -242,6 +260,27 @@ Not verified here:
   a resize (no input is posted here), VoiceOver in a capped pane, Sill.app itself (the bundle's own
   executable was not run: it would read and write Sill.app's preferences), and macOS 14 and 15.
 
+## The review
+
+An adversarial review of the pull request (2026-10-14, at bb2451e) re-ran the builds, the checks,
+the previews and every live case above with a quiet build of its own (the same numbers), and found
+three things, each fixed in a commit of its own:
+1. **Should fix: the untested lists left out macOS 26 and Sill's virtual display** (5962ad4). The
+   issue is from macOS 26.6.2, everything here ran on 27.0.1, and "Fixes #59" closes the issue on
+   merge; the virtual display was in the implementer's report as not verified live, but not in
+   t
```

---

### Incident Patch 8: `6e9e313a` (2026-10-13)
**Commit Message**: CLAUDE.md: the nearby browser's rebuild is for Noah to try (#69)

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `CLAUDE.md` (modified, +4/-1)
```diff
@@ -65,7 +65,10 @@ docs; no wire change, nothing on the Mac.
   stops a capture when the display sleeps or the Mac locks (Sill.app streaming the Desktop, then
   `pmset displaysleepnow` or ⌃⌘Q: whether Sill.log says "Capture stopped: …", and whether the
   picture comes back by itself once the Mac is woken and unlocked: this build asks for the Desktop
-  again when the Mac says the stream stopped, 0.5.1 never does).
+  again when the Mac says the stream stopped, 0.5.1 never does); the nearby browser made again
+  (Direct Wireless on, the iPad on the iPhone's hotspot, Sill sent to the background and back: the
+  console's "browser: rebuilt the nearby browser (back from the background)", the Direct row kept),
+  which no headless run here could do without turning on this Mac's AWDL.
 
 **Release 0.5.1 (2026-10-09, branch `release-0.5.1` from main at 05f2bb8, main merged in again
 at e3ce043 after PR #47; PR #48; Noah's go the same day: "When #47 passes the CI, merge it, then
```

---

### Incident Patch 9: `d62f82d9` (2026-10-13)
**Commit Message**: The plan: a failed browser keeps the rows; the resume race found and left (#69)

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `docs/reconnect-after-sleep-plan.md` (modified, +8/-0)
```diff
@@ -70,6 +70,8 @@ app on my iPad before it would reconnect."
   and a remote dial for `networkGrace`; `quitWait`'s `networkSince`; `PathSightings.wiredSince`,
   the cable's settle and its refused listing; `directSince`), and the reconnect's count of dials of
   a listing (below) is not reset by a rebuild. A Mac that went leaves 3 s after the rebuild.
+  While a failed browser waits to be made again, the rows stay as they are (a settle still running
+  does not end then, and a result the failed browser still delivers only joins them).
 - The failed browse's status line goes: the browser is made again, and the console says so
   ("browser: the network browser failed (…); making it again in 1 s", "browser: rebuilt the network
   browser (back from the background)", "browser: the new network browser has settled: …").
@@ -221,6 +223,12 @@ stamped as it came) and the host's log; the loss is the device's "connection sil
   pixel main's build (0 pixels differ). The live photos show this Mac's name and windows and stay
   out of the repository.
 - **Checks and builds**: below, in Progress.
+- **Found, and left as it is** (older than this branch, the same on main): on the return from the
+  background the ping timer, on the network queue, can run before the main queue's
+  willEnterForeground handler resets liveness, so a session whose connection is still alive (a short
+  trip away, under the Mac's 4 s eviction) is called "silent for 10 s" and ended; the reconnect then
+  brings it back at once (0.1 s here), with a flash of the connect screen. A ping tick that comes
+  long after the last one (the app was suspended) could reset liveness itself.
 
 ## Progress
 
```

---

### Incident Patch 10: `1ba83776` (2026-10-13)
**Commit Message**: DebugHooks: why Sill.app ignores the window hooks; the steps' messages

-SillTestScreenHeight and -SillSettingsShot go with -SillSettingsAfter and are
ignored by Sill.app the same way, though they bear on no door; a bad step's
line names every step.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `Sources/SillMenuBar/DebugHooks.swift` (modified, +8/-7)
```diff
@@ -78,11 +78,12 @@ import StreamProtocol
 ///                                              offscreen; no identity is loaded, no listener)
 ///
 /// These are the bare SillMenuBar binary's (defaults domain "SillMenuBar"; delete it after). Sill.app
-/// itself, an app bundle's executable, ignores every `-Sill…After` hook, `-SillTestScreenHeight`,
-/// `-SillSettingsShot` and `-requirePairing`, each with one line (docs/home-pairing-plan.md §6.6):
-/// they open, answer or remove pairings, or change what the doors admit, and any process of this
-/// user can start Sill.app with arguments, which then runs with Sill's Screen Recording and
-/// Accessibility grants. `--synthetic`, `-SillLogFile`,
+/// itself, an app bundle's executable, ignores every `-Sill…After` hook and `-requirePairing`, each
+/// with one line (docs/home-pairing-plan.md §6.6): they open, answer or remove pairings, or change
+/// what the doors admit, and any process of this user can start Sill.app with arguments, which then
+/// runs with Sill's Screen Recording and Accessibility grants. `-SillTestScreenHeight` and
+/// `-SillSettingsShot` go with `-SillSettingsAfter` and are ignored the same way: Sill.app has no
+/// use for them. `--synthetic`, `-SillLogFile`,
 /// `-SillRenderPreviews` and the update check's `-SillUpdateFeed`, `-SillUpdateNow`,
 /// `-SillUpdateVersion` and `-SillUpdateInterval` stay: they bear on no door and no pairing (a feed
 /// on this Mac only).
@@ -293,7 +294,7 @@ enum DebugHooks {
         return spec.split(separator: ";").compactMap { raw in
             let parts = raw.trimmingCharacters(in: .whitespaces).split(separator: " ", maxSplits: 1).map(String.init)
             guard parts.count == 2, let delay = Double(parts[0]), delay > 0 else {
-                print("SillSettingsAfter: can’t read “\(raw)”; expected '<seconds> <tab>' or '<seconds> close'")
+                print("SillSettingsAfter: can’t read “\(raw)”; expected '<seconds> <tab or step>'")
                 return nil
             }
             let word = parts[1].lowercased().replacingOccurrences(of: " ", with: "")
@@ -311,7 +312,7 @@ enum DebugHooks {
                 $0.rawValue.lowercased().hasPrefix(word) || $0.title.lowercased().replacingOccurrences(of: " ", with: "").hasPrefix(word)
             }
             guard matches.count == 1, let tab = matches.first else {
-                print("SillSettingsAfter: no one tab called “\(parts[1])” (general, devices, streaming, virtual display, permissions, remote access)")
+                print("SillSettingsAfter: “\(parts[1])” is no step: a tab (general, devices, streaming, virtual display, permissions, remote access, or the start of one), close, report, end or height=<points>")
                 return nil
             }
             return (parts[0], delay, .tab(tab))
```

#### Recent Merged Pull Requests:
- **PR #126** (closed): feat(host): add parent-managed embedding mode (@gee842)
- **PR #120** (closed): Update 15/10 (@addhumal)
- **PR #98** (2026-10-15): AddressList: list a nameless VPN service's tunnel (Tailscale from the App Store) (@itssali)
- **PR #85** (2026-10-15): Homebrew: the cask, the tap, and the release step (@Saffsanity)
- **PR #80** (2026-10-15): A hardware keyboard and trackpad on the device: keys without the Keyboard button, Esc, scrolling (#67, #68) (@Saffsanity)
- **PR #79** (2026-10-15): Larger Picture on an iPhone held upright: no thumbnails, the picture down to the keyboard (#58) (@Saffsanity)
- **PR #78** (2026-10-15): The clipboard both ways: Share Clipboard on the Mac and the device, Paste on the Mac (#64) (@Saffsanity)
- **PR #77** (2026-10-15): Find the Mac again after hours idle: the browsers made again, the reconnect kept alive (#69) (@Saffsanity)

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

## X. Docs for #69: the review's findings, their fixes and the numbers after them

**RULE**:
When implementing operations in `CLAUDE.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Saffsanity/sill. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ed42d9b2`: Docs for #69: the review's findings, their fixes and the numbers after them. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `CLAUDE.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
985a733, PR #77, issue #69; the plan, the causes with line numbers, the decisions, the results and the
review's fixes are in `docs/reconnect-after-sleep-plan.md`).** The report: after a few hours dormant
nothing reconnected until the Mac was logged in to and Sill relaunched on the iPad. Device code, the
support page and the docs; no wire change, nothing on the Mac.
  stay as they are until it is made again, so a Mac that stays listed keeps its sightings by name.
  Its interfaces are the new browser's; the return stamps the session's pong as it resets liveness
  (`resetLiveness`), so a cable session whose new browser first lists the Mac on Wi-Fi alone stays
  on the cable. No line for a failed browse.
  at once, under the old 10 s spacing (`DiscoveryPolicy.autoDesktop`); 0.5.1 asks only with the
  Mac's next window list, sent when a window opens, closes or changes.
  gains a sleeping Mac (Sill may not be able to wake it, so keep it awake: Energy, or Battery) and a
  restarted one (Sill opens after a login, with Launch at Login); README's Good to know, the next
  What's New (docs/app-store-metadata.md), DEVELOPMENT.md.
- The review (2026-10-14, after 1c4b921), four findings, each fix
```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern to NEVER write (induced failure mode):
985a733, PR #77, issue #69; the plan, the causes with line numbers, the decisions and the results are
in `docs/reconnect-after-sleep-plan.md`).** The report: after a few hours dormant nothing reconnected
until the Mac was logged in to and Sill relaunched on the iPad. Device code, the support page and the
docs; no wire change, nothing on the Mac.
  stay as they are until it is made again, so a Mac that stays listed keeps its sightings. No line
  for a failed browse.
  at once, under the old 10 s spacing (`DiscoveryPolicy.autoDesktop`).
  gains a sleeping Mac (Sill may not be able to wake it, so keep it awake: Energy, or Battery; not
  "can't", since a dial through a Bonjour Sleep Proxy may wake it, untested) and a restarted one
  (Sill opens after a login, with Launch at Login); README's Good to know, the next What's New
  (docs/app-store-metadata.md), DEVELOPMENT.md.
- Verified (the plan's Results): on a private simulator against `SillHost --synthetic --pairing` as
  a `_silltest._tcp` row, the host stopped for 20 s: main's build dialled at +0 and +6.3 s after the
  loss and then nothing for the minute after the host came back; this branch dialled at +0, 5.3,
  15.3 and 35.3 s and 
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ed42d9b2` are properly handled with clean fallback behavior.
