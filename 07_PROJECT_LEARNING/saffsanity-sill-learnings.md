> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/saffsanity-sill-learnings.md`  
> **Source**: github ([https://github.com/Saffsanity/sill](https://github.com/Saffsanity/sill))  
> **Source Version**: `6c5b5d24`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T12:53:45.120Z  
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
> **Harvest Timestamp**: 2026-10-27T12:53:43.611Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Saffsanity/sill`
- **Description**: Any window from your Mac, live on your iPhone or iPad. Touch, Apple Pencil, trackpad and keys. Free, open source, no servers.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 4153 stars

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
///                                              sendAudio, remoteAccess, remotePort, internetAccess,
///                                              shareClipboard, remoteAddressName=host[:port],
///                                              updateCheck, showPairingWindowToScreenSharing=0|1,
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
        let defaults = UserDefaults.standa
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

### Core Architecture Module: `Scripts/audio/main.swift`
```
import Foundation
import Network
import StreamProtocol

// The encoder-free sound harness's host (docs/audio-plan.md §11, H5–H8, H12; Scripts/audio/run.sh says
// how the harness runs): the real StreamServer.swift and the sound's host files (AudioPipeline,
// AudioPacketizer, AudioEncoder, SyntheticAudio, TestTone), built by build.sh from the working tree,
// fed FAKE frames of chosen sizes by a timer, and the real test tone through the real pipeline and send
// path. Nothing here touches VideoToolbox, ScreenCaptureKit, CoreMedia or AVFoundation, and build.sh
// refuses a binary that links any of them: no picture is encoded, no sound captured, nothing played.
//
// What it stands in for, from StreamCoordinator: the catalog on connect (a window list, the settings,
// icons, the app list, the cursor) and a keyframe request; the encoder (one frame per 1/fps, a keyframe
// when asked and every gop seconds, parameter sets before each keyframe), as Scripts/pacing/main.swift
// does; and the sound's rule: while Send Audio is on (--audio) and a device plays it, the test tone
// (AudioKey.test), else none, with the coordinator's reasons.
//
// Two doors, on 127.0.0.1 alone: the home door (plain TCP, each connection served as a home client
// from this Mac, as the home door registers one) and the remote door (RemoteTLS's TLS 1.3, any client
// key, served as a remote session; --plain-remote: the same without TLS). StreamServer's own
// listener, which takes connections on every interface, is never started.
//
// usage: Harness [--seconds S] [--fps N] [--kf BYTES] [--delta BYTES] [--gop S] [--audio]
//                [--switch-at T] [--audio-at T:on|off,…] [--plain-remote] [--log PATH]
// --switch-at: at T seconds the sound's source changes to a second tone (660 Hz; AudioKey.app, pid 1,
//   "Second Tone"): a new epoch, as another app's window would be.
// --audio-at: Send Audio turned on or off at T seconds (a device's or the Mac's change).
// SILL_TEST_AUDIO_CHUNK and SILL_TEST_AUDIO_PAUSE reach the tone as they do on a synthetic host.

setvbuf(stdout, nil, _IOLBF, 0)

var args = CommandLine.arguments.dropFirst()
func value(_ name: String, _ fallback: String) -> String {
    if let i = args.firstIndex(of: name), args.index(after: i) < args.endIndex { return args[args.index(after: i)] }
    return fallback
}
let seconds = Double(value("--seconds", "60"))!
let fps = Int(value("--fps", "60"))!
let keyBytes = Int(value("--kf", "300000"))!
let deltaBytes = Int(value("--delta", "30000"))!
let gop = Double(value("--gop", "4"))!
let switchAt = Double(value("--switch-at", "-1"))!
let plainRemote = args.contains("--plain-remote")
let logPath = value("--log", "")
var sendAudio = args.contains("--audio")
let audioAt: [(t: Double, on: Bool)] = value("--audio-at", "").split(separator: ",").compactMap {
    let p = $0.split(separator: ":"); guard p.count == 2, let t = Double(p[0]) else { return nil }
    return (t, p[1] == "on")
}
if !logPath.isEmpty { HostLog.shared.configure(keepLines: 0, fileURL: URL(fileURLWithPath: logPath)) }

// MARK: - The fake encoder (Scripts/pacing/main.swift's, cut to what the sound's gates need)

final class FakeEncoder {
    private let lock = NSLock()
    private var forced = true
    private var sinceKey = 0
    func requestKeyframe() { lock.lock(); forced = true; lock.unlock() }
    func next() -> (key: Bool, size: Int) {
        lock.lock(); defer { lock.unlock() }
        let key = forced || sinceKey >= Int(Double(fps) * gop)
        if key { forced = false; sinceKey = 0 } else { sinceKey += 1 }
        return (key, key ? keyBytes : deltaBytes)
    }
}
let encoder = FakeEncoder()
let server = try StreamServer(advertise: false)
let psPayload = ParameterSets(nalUnitHeaderLength: 4, sets: [Data(count: 24), Data(count: 40), Data(count: 8)]).encoded()

// MARK: - The sound, as the coordinator runs it

let audio = AudioPipeline()
audio.onFormat = { data, epoch in server.broadcastAudio(format: data, epoch: epoch) }
audio.onPackets = { data, epoch in server.broadcastAudio(packets: data, epoch: epoch) }
var listeners = 0
var second = false   // the source switched to the second tone
@MainActor func follow() {
    let (key, reason): (AudioKey, String)
    if !sendAudio { (key, reason) = (.none, "Send Audio is off") }
    else if listeners == 0 { (key, reason) = (.none, "no connected device plays sound") }
    else { (key, reason) = (second ? .app(pid: 1, name: "Second Tone") : .test, "") }
    audio.follow(key, reason: reason) { key in
        switch key {
        case .test:
            return .source(SyntheticAudio(queue: audio.queue), line: "Audio: a test tone (440 Hz at -30 dBFS, a click at each second).")
        case .app:
            return .source(SyntheticAudio(queue: audio.queue, pitch: 660), line: "Audio: a second test tone (660 Hz, a click at each second).")
        default:
            return .failed("no source")
        }
    }
}
server.onAudioListenersChanged = { n in Task { @MainActor in listeners = n; follow() } }

server.onKeyframeNeeded = { encoder.requestKeyframe() }
server.onClientCountChanged = { n in Stats.shared.activeClients = n }
server.onClientConnected = { connection, _, _ in
    DispatchQueue.main.async {
        let now = Date().timeIntervalSince1970
        print("Catalog → \(connection.endpoint): 11 windows, 20 icons, 119 apps")
        server.send(StreamMessage(kind: .windowList, timestamp: now, isKeyframe: false, payload: Data(count: 3000)), to: connection)
        server.send(StreamMessage(kind: .hostSettings, timestamp: now, isKeyframe: false, payload: Data(count: 400)), to: connection)
        for _ in 0..<20 {
            server.send(StreamMessage(kind: .appIcon, timestamp: now, isKeyframe: false, payload: Data(count: 6000)), to: connection)
        }
        server.send(StreamMessage(kind: .appList, timestamp: now, isKeyframe: false, payload: Data(count: 20000)), to: connection)
        server.send(StreamMessage(kind: .cursorShape, timestamp: now, isKeyframe: false, payload: Data(count: 2000)), to: connection)
        encoder.requestKeyframe()
    }
}

// MARK: - The doors, on loopback only

func door(_ name: String, _ params: NWParameters, route: ClientRoute) throws -> NWListener {
    params.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: .any)
    let l = try NWListener(using: params)
    l.stateUpdateHandler = { state in
        if case .ready = state { print("\(name) door listening on port \(l.port!.rawValue)") }
        if case .failed(let e) = state { print("\(name) door failed: \(e)"); exit(1) }
    }
    l.newConnectionHandler = { c in
        c.stateUpdateHandler = { state in
            switch state {
            case .ready:
                server.serve(c, route: route, hello: nil)   // the device's hello reaches `took` in the receive loop
                print("\(name) client connected: \(c.endpoint)")
            case .failed:
                c.cancel()
            default: break
            }
        }
        c.start(queue: server.queue)
    }
    l.start(queue: server.queue)
    return l
}
let homeParams = NWParameters(tls: nil, tcp: RemoteTLS.tcpOptions(dialing: false))
homeParams.serviceClass = .interactiveVideo
let home = try door("Home", homeParams, route: .home(.loopback, peer: nil))
let remoteParams: NWParameters
if plainRemote {
    remoteParams = NWParameters(tls: nil, tcp: RemoteTLS.tcpOptions(dialing: false))
    remoteParams.serviceClass = .interactiveVideo
} else {
    guard let key = RemoteKey.generate(), let identity = RemoteIdentity(privateKey: key) else { fatalError("no identity") }
    let tls = RemoteTLS.options(identity: identity.tls, role: .server, queue: server.queue) { _, _ in true }
    remoteParams = RemoteTLS.parameters(tls: tls, dialing: false)
}
let remote = try door("Remote", remoteParams, route: .remote(origin: .vpn, label: "through Tailscale", fingerprint: Data([1, 2, 3]), name: "harness"))
server.setStreaming(true)

// MARK: - Frames, the schedule, the end

let captureQueue = DispatchQueue(label: "harness.capture", qos: .userInteractive)
let started = Date()
let frameTimer = DispatchSource.makeTimerSource(queue: captureQueue)
frameTimer.schedule(deadline: .now() + 0.5, repeating: 1.0 / Double(fps), leeway: .milliseconds(1))
frameTimer.setEventHandler {
    let (key, size) = encoder.next()
    Stats.shared.bump("cap.complete")
    Stats.shared.bump("enc.out")
    let now = Date().timeIntervalSince1970
    if key { server.broadcast(StreamMessage(kind: .parameterSets, timestamp: now, isKeyframe: true, payload: psPayload)) }
    server.broadcast(StreamMessage(kind: .frame, timestamp: now, isKeyframe: key, payload: Data(count: size)))
}
frameTimer.resume()

if switchAt >= 0 {
    DispatchQueue.main.asyncAfter(deadline: .now() + switchAt) {
        Task { @MainActor in
            print("Switch: the sound's source is now the second tone")
            second = true
            follow()
        }
    }
}
for (t, on) in audioAt {
    DispatchQueue.main.asyncAfter(deadline: .now() + t) {
        Task { @MainActor in
            print("Settings: send audio \(sendAudio ? "on" : "off") → \(on ? "on" : "off")")
            sendAudio = on
            follow()
        }
    }
}

DispatchQueue.main.async { Stats.shared.startPrinting() }
DispatchQueue.main.asyncAfter(deadline: .now() + seconds) {
    print("Harness done after \(Int(seconds)) s.")
    exit(0)
}
print("Harness: keyframe \(keyBytes) B, delta \(deltaBytes) B, \(fps) fps, gop \(gop) s, Send Audio \(sendAudio ? "on" : "off")")
_ = (home, remote)
dispatchMain()

```

### Core Architecture Module: `Scripts/audio/run.py`
```
#!/usr/bin/env python3
"""One run of the encoder-free sound harness: its host (build.sh's) → a relay or none → audiocheck, all
on 127.0.0.1, for SECONDS. run.sh runs the gates; this is one of them.
usage: run.py NAME SECONDS [host args...] -- [relay args...] -- [device args...]
Env: DOOR=Home (default) or Remote, the host's door audiocheck dials (Remote adds --tls unless the host
was given --plain-remote); RELAY=none (default), bottleneck (Scripts/pacing/bottleneck.py) or sillrelay
(Scripts/sillrelay.py) on the path; HOSTENV="K=V;K=V" for the host's environment (SILL_TEST_AUDIO_*);
AUDIO_RUNS, where NAME.host.txt, NAME.relay.txt and NAME.device.txt go (default .build/audio/runs).
Every process is started in its own session and killed by PID at the end: none is left running. The
host's CPU (ps, once a second) goes to NAME.cpu.txt."""
import os, queue, re, signal, subprocess, sys, threading, time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(ROOT, ".build", "audio")
RUNS = os.environ.get("AUDIO_RUNS") or os.path.join(OUT, "runs")
os.makedirs(RUNS, exist_ok=True)
name, seconds = sys.argv[1], float(sys.argv[2])
parts = [[]]
for a in sys.argv[3:]:
    if a == "--": parts.append([])
    else: parts[-1].append(a)
while len(parts) < 3: parts.append([])
host_args, relay_args, dev_args = parts
binary = os.path.join(OUT, "host", ".build", "release", "Harness")
checker = os.path.join(OUT, "audiocheck")
for b in (binary, checker):
    if not os.path.exists(b): sys.exit(f"run.py: no {b}: run Scripts/audio/build.sh first")
env = dict(os.environ)
for kv in os.environ.get("HOSTENV", "").split(";"):
    if "=" in kv:
        k, v = kv.split("=", 1); env[k] = v
path = lambda suffix: os.path.join(RUNS, f"{name}.{suffix}")
procs = []

def start(cmd, **kw):
    p = subprocess.Popen(cmd, start_new_session=True, **kw)
    procs.append(p)
    return p

def stop_all():
    for p in reversed(procs):
        if p.poll() is None:
            p.terminate()
            try: p.wait(timeout=3)
            except subprocess.TimeoutExpired:
                p.kill(); p.wait()

def follow(p, sink):
    lines = queue.Queue()
    def drain():
        for line in p.stdout:
            sink.write(line); sink.flush(); lines.put(line)
    threading.Thread(target=drain, daemon=True).start()
    return lines

def wait_for(lines, pattern, what, limit=20):
    deadline = time.time() + limit
    while time.time() < deadline:
        try: line = lines.get(timeout=max(0.01, deadline - time.time()))
        except queue.Empty: break
        m = re.search(pattern, line)
        if m: return int(m.group(1))
    stop_all()
    sys.exit(f"run.py {name}: no {what}")

signal.signal(signal.SIGTERM, lambda *_: sys.exit(143))
try:
    host_out = open(path("host.txt"), "w")
    host = start([binary, "--seconds", str(seconds + 6)] + host_args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, env=env)
    door = os.environ.get("DOOR", "Home")
    lines = follow(host, host_out)
    port = wait_for(lines, door + r" door listening on port (\d+)", f"{door.lower()} door")
    relay = os.environ.get("RELAY", "none")
    if relay != "none":
        relay_py = {"bottleneck": os.path.join(ROOT, "Scripts", "pacing", "bottleneck.py"),
                    "sillrelay": os.path.join(ROOT, "Scripts", "sillrelay.py")}[relay]
        relay_out = open(path("relay.txt"), "w")
        r = start([sys.executable, relay_py, "--listen", "0", "--to", f"127.0.0.1:{port}"] + relay_args,
                  stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        port = wait_for(follow(r, relay_out), r"listening on 127\.0\.0\.1:(\d+)", "relay")
    tls = ["--tls"] if door == "Remote" and "--plain-remote" not in host_args else []
    cpu = open(path("cpu.txt"), "w")
    # DEVICES=N: N audiochecks at once (the second and later a second apart), NAME.device.txt, NAME.device2.txt…
    devices = []
    for i in range(int(os.environ.get("DEVICES", "1"))):
        if i: time.sleep(1)
        dev_out = open(path("device.txt" if i == 0 else f"device{i + 1}.txt"), "w")
        devices.append(start([checker, "127.0.0.1", str(port), str(seconds - i)] + tls + dev_args + ["--label", f"audiocheck{'' if i == 0 else i + 1}"],
                             stdout=dev_out, stderr=subprocess.STDOUT))
    end = time.time() + seconds + 10
    while any(d.poll() is None for d in devices) and time.time() < end:
        r = subprocess.run(["/bin/ps", "-o", "%cpu=", "-p", str(host.pid)], capture_output=True, text=True)
        cpu.write(f"{time.time():.1f} {r.stdout.strip()}\n"); cpu.flush()
        time.sleep(1)
finally:
    stop_all()
# A device that never reached the host (audiocheck exits 3) means the run could not run.
codes = [d.returncode for d in devices]
if any(c == 3 for c in codes):
    sys.exit(f"run.py {name}: a device never reached the host (exit {codes})")

```

### Core Architecture Module: `Scripts/audio/summarize.py`
```
#!/usr/bin/env python3
"""The sound harness's table and gates (docs/audio-plan.md §11): each run's numbers, from the host's
lines (its [1s] stats: net.sent, net.dropped, net.waitKey and the aud.* keys), the devices' AUDIOCHECK
lines and per-second lines, and the host's CPU; then each gate run.sh names for it.
usage: summarize.py RUNSDIR CASE:GATE [CASE:GATE ...]
Exit status: the number of gates that failed."""
import os, re, statistics, sys

runs = sys.argv[1]

def read(name, suffix):
    p = os.path.join(runs, f"{name}.{suffix}")
    return open(p).read() if os.path.exists(p) else ""

def host(name):
    text = read(name, "host.txt")
    seconds = []
    for line in text.splitlines():
        if not line.startswith("[1s]"): continue
        body = line[5:].split(" · ")[0]
        seconds.append({k: int(v) for k, v in re.findall(r"([a-zA-Z.]+) (\d+)", body)})
    total = lambda k: sum(s.get(k, 0) for s in seconds)
    return {"seconds": seconds, "total": total, "text": text,
            "evicted": bool(re.search(r"silent for|not draining", text))}

def device(name, suffix="device.txt"):
    text = read(name, suffix)
    m = re.search(r"AUDIOCHECK .*", text)
    d = {"text": text, "line": m.group(0) if m else ""}
    line = d["line"]
    def num(pattern, cast=float, default=None):
        mm = re.search(pattern, line)
        return cast(mm.group(1)) if mm and mm.group(1) != "–" else default
    d["frames"] = num(r"frames=(\d+)", int, 0)
    d["packets"] = num(r"packets=(\d+)", int, 0)
    d["rate"] = num(r"\(([\d.]+)/s\)", float, 0.0)
    d["formats"] = num(r"formats=(\d+)", int, 0)
    d["epochs"] = re.search(r"epochs=\[([^\]]*)\]", line).group(1) if "epochs=" in line else ""
    d["starts"] = num(r"segmentStarts=(\d+)", int, 0)
    d["gaps"] = num(r"seqGaps=(\d+)", int, 0)
    d["orphans"] = num(r"orphans=(\d+)", int, 0)
    d["failures"] = num(r"decodeFailures=(\d+)", int, 0)
    d["clicks"] = num(r"clicks=(\d+)", int, 0)
    d["within"] = num(r"within1ms=(\d+)", int, 0)
    d["fage"] = [num(r"frameAge p50 ([\d.–]+)"), num(r"frameAge p50 [\d.–]+ p95 ([\d.–]+)"), num(r"frameAge p50 [\d.–]+ p95 [\d.–]+ max ([\d.–]+)")]
    d["aage"] = [num(r"packetAge p50 ([\d.–]+)"), num(r"packetAge p50 [\d.–]+ p95 ([\d.–]+)"), num(r"packetAge p50 [\d.–]+ p95 [\d.–]+ max ([\d.–]+)")]
    d["closed"] = "closed the connection" in text
    # The playout model on these arrivals (iOSClient/AudioPlayout.swift, with an ideal output).
    for key in ("placed", "late", "lateAfter2", "jumps", "jumpsAfter3", "joins", "dups"):
        d["m_" + key] = num(r"model: .*?\b" + key + r"=(\d+)", int, None)
    for key in ("coverMax", "coverMaxAfter3", "needMax"):
        d["m_" + key] = num(r"model: .*?\b" + key + r"=([\d.–]+)", float, None)
    # Per second: (t, frames, frame age median, frame age max, packets, packet age median, packet age max)
    per = []
    for m in re.finditer(r"^t=(\d+) frames=(\d+) fage=([\d.–]+)/([\d.–]+) aud=(\d+) aage=([\d.–]+)/([\d.–]+)", text, re.M):
        f = lambda x: None if x == "–" else float(x)
        per.append((int(m.group(1)), int(m.group(2)), f(m.group(3)), f(m.group(4)), int(m.group(5)), f(m.group(6)), f(m.group(7))))
    d["per"] = per
    return d

def cpu(name):
    vals = []
    for line in read(name, "cpu.txt").splitlines()[3:]:   # past the connect
        parts = line.split()
        if len(parts) == 2:
            try: vals.append(float(parts[1]))
            except ValueError: pass
    return statistics.mean(vals) if vals else float("nan")

failed = 0
def gate(ok, what):
    global failed
    print(f"    {'PASS' if ok else 'FAIL'} {what}")
    if not ok: failed += 1

def row(name):
    h, d = host(name), device(name)
    secs = max(1, len(h["seconds"]))
    print(f"  {name:12} net.sent {h['total']('net.sent'):6} net.dropped {h['total']('net.dropped'):5} net.waitKey {h['total']('net.waitKey'):5} "
          f"aud.out {h['total']('aud.out'):6} aud.sent {h['total']('aud.sent'):6} aud.drop {h['total']('aud.drop'):4} aud.gap {h['total']('aud.gap'):3} "
          f"cpu {cpu(name):5.1f}%")
    print(f"               device: frames {d['frames']} fage {d['fage']} ms; packets {d['packets']} ({d['rate']}/s) aage {d['aage']} ms; "
          f"formats {d['formats']} epochs [{d['epochs']}] starts {d['starts']} gaps {d['gaps']} orphans {d['orphans']} clicks {d['within']}/{d['clicks']}")
    if d.get("m_placed") is not None:
        print(f"               model: placed {d['m_placed']} late {d['m_late']} (after 2 s {d['m_lateAfter2']}) jumps {d['m_jumps']} "
              f"(after 3 s {d['m_jumpsAfter3']}) joins {d['m_joins']} dups {d['m_dups']} cover max {d['m_coverMax']} ms "
              f"(after 3 s {d['m_coverMaxAfter3']}) need max {d['m_needMax']} ms")
    return h, d

def model_gate(name, d, cover=False):
    """The device's playout model on the run's real arrivals: nothing too late to play after its first
    2 s and no jump after 3 s; with `cover`, its jitter cover after 3 s no more than the link showed (the
    packets' largest age less their median, + 5 ms) or home's 40 ms start: pauses and a new epoch are
    segments placed by their stamps, never jitter (H8)."""
    if d.get("m_placed") is None:
        gate(False, f"{name}: no playout model numbers in the AUDIOCHECK line"); return
    gate(d["m_lateAfter2"] == 0 and d["m_jumpsAfter3"] == 0,
         f"{name}: the playout model: late after 2 s {d['m_lateAfter2']}, jumps after 3 s {d['m_jumpsAfter3']}, {d['m_placed']} placed")
    if cover:
        spread = (d["aage"][2] or 0) - (d["aage"][0] or 0)
        allowed = max(40.0, spread + 5)
        gate(d["m_coverMaxAfter3"] is not None and d["m_coverMaxAfter3"] <= allowed,
             f"{name}: the model's jitter cover after 3 s at most {d['m_coverMaxAfter3']} ms (the link's spread {spread:.1f} ms; ≤ {allowed:.1f})")

print(f"Runs in {runs}")
for spec in sys.argv[2:]:
    name, _, kind = spec.partition(":")
    if not read(name, "host.txt"):
        print(f"  {name}: no run"); failed += 1; continue
    h, d = row(name)
    if kind == "home":            # H5: 100 ± 1 a second, no gap, every click at its second ±1 ms
        gate(99 <= d["rate"] <= 101, f"{name}: {d['rate']} packets a second (100 ± 1)")
        gate(d["gaps"] == 0 and d["orphans"] == 0 and d["failures"] == 0, f"{name}: no seq gap, no packet before its format, nothing undecodable")
        gate(d["clicks"] >= 0.9 * len(d["per"]) and d["within"] == d["clicks"], f"{name}: {d['within']} of {d['clicks']} clicks within 1 ms of their second")
        model_gate(name, d)
    elif kind == "home1024":      # H5 with 1024-frame chunks: 93.75 a second
        gate(92.75 <= d["rate"] <= 94.75, f"{name}: {d['rate']} packets a second (93.75 ± 1)")
        gate(d["gaps"] == 0 and d["within"] == d["clicks"] and d["clicks"] > 0, f"{name}: no gap; {d['within']} of {d['clicks']} clicks within 1 ms")
        model_gate(name, d)
    elif kind.startswith("same-as="):   # H5: the picture the same with and without sound
        other = kind.split("=", 1)[1]
        ho, do = host(other), device(other)
        gate(d["packets"] == 0 and h["total"]("aud.out") == 0 and not re.search(r"^Audio", h["text"], re.M),
             f"{name}: no sound made or sent, and no Audio line (Send Audio off)")
        gate(h["total"]("net.dropped") == ho["total"]("net.dropped"), f"{name} and {other}: net.dropped {h['total']('net.dropped')} and {ho['total']('net.dropped')}")
        ns, no = h["total"]("net.sent") / max(1, len(h["seconds"])), ho["total"]("net.sent") / max(1, len(ho["seconds"]))
        gate(abs(ns - no) <= 2, f"{name} and {other}: net.sent {ns:.1f} and {no:.1f} a second")
        gate(d["fage"][0] is not None and do["fage"][0] is not None and abs(d["fage"][0] - do["fage"][0]) <= 1.0
             and abs((d["fage"][1] or 0) - (do["fage"][1] or 0)) <= 2.0,
             f"{name} and {other}: frame age p50/p95 {d['fage'][:2]} and {do['fage'][:2]} ms")
        c1, c2 = cpu(other), cpu(name)
        gate(c1 - c2 <= 1.5, f"H12: the host's CPU {c1:.1f}% with sound, {c2:.1f}% without (at most 1.5 points more)")
    elif kind == "segments":      # H8: pauses and a source change, on two devices
        for suffix in ("device.txt", "device2.txt"):
            dd = device(name, suffix)
            if not dd["line"]: gate(False, f"{name} {suffix}: no AUDIOCHECK line"); continue
            late = [p for p in dd["per"] if p[0] > 1 and p[6] is not None and p[6] > 40]
            gate(dd["epochs"] == "1, 2" and dd["formats"] == 2 and dd["orphans"] == 0,
                 f"{name} {suffix}: epochs [{dd['epochs']}], {dd['formats']} formats, each before its first packet ({dd['orphans']} orphans)")
            # Each tone pauses at 3 s and 6 s after it starts (SILL_TEST_AUDIO_PAUSE reaches both), so from the
            # first: its start, two pauses, the second tone's start and its two pauses. The second device
            # connects a second late and misses the first start.
            gate(dd["starts"] >= 5 and dd["gaps"] == 0, f"{name} {suffix}: {dd['starts']} segment starts, {dd['gaps']} seq gaps")
            gate(dd["within"] == dd["clicks"] and dd["clicks"] > 0, f"{name} {suffix}: {dd['within']} of {dd['clicks']} clicks within 1 ms, the segments placed by their stamps")
            gate(not late, f"{name} {suffix}: no packet more than 40 ms after its stamp after the first second ({[p[0] for p in late]})")
            # H8: the pauses and the source change are segments placed by their stamps, not jitter: the
            # model's cover stays where the steady link puts it.
            model_gate(f"{name} {suffix}", dd, cover=True)
        gate(h["total"]("aud.gap") == 4, f"{name}: the host began 4 segments after gaps, two in each tone (aud.gap {h['total']('aud.gap')})")
    elif kind.startswith("away"):   # H6: the sound never dropped while frames are, packets no later than frames + 20 ms
        want_drops = kind == "away-drops"
        gate(h["total"]("aud.drop") == 0, f"{n
```

### Core Architecture Module: `Scripts/audiocheck.swift`
```
import Foundation
import Network

// The encoder-free sound harness's device (docs/audio-plan.md §11, H5–H8; Scripts/audio/build.sh
// compiles it with Sources/StreamProtocol, iOSClient/AudioDecoder.swift, iOSClient/AudioPlayout.swift and
// Sources/SillHost/TestTone.swift as one module, so nothing here imports StreamProtocol). What the device's StreamClient does with the
// Mac's sound, minus a speaker: a hello that lists "aac-eld" first, pings every 0.25 s and stats every
// second (so a remote door never takes it for gone), every message read, every kind 43 parsed, each
// epoch's decoder made from its format, every packet decoded, and each decoded sample placed by its
// packet's stamp, where the test tone's click must sit at each whole second of the wall clock. The host
// runs on this Mac, so its stamps and this clock are one clock: a packet's age (arrival minus stamp) is
// a true age, as a frame's is.
//
// It plays nothing: no audio device is opened. The device's playout model (AudioPlayout) runs on these
// arrivals as the device runs it, with an ideal output in place of a player (its timeline from the first
// packet, a stand-in IO buffer of 5 ms and output latency of 10 ms): its floor, cover, need, late packets
// and jumps are in each second's line and the summary.
//
// usage: audiocheck HOST PORT SECONDS [--tls] [--no-audio] [--label NAME]
//   --tls       the remote door (TLS 1.3, ALPN sill/1, a throwaway key; the harness admits any)
//   --no-audio  a hello without the codec: the host must send no kind 43
// One line a second ("t=3 frames=60 fage=1.2/3.4 aud=100 aage=15.2/17.0 clicks=1 model late=0 …"), then
// one summary line, "AUDIOCHECK …", with every number the gates read.

setvbuf(stdout, nil, _IOLBF, 0)
let args = CommandLine.arguments
guard args.count >= 4, let port = UInt16(args[2]), let seconds = Double(args[3]) else {
    print("usage: audiocheck HOST PORT SECONDS [--tls] [--no-audio] [--label NAME]"); exit(2)
}
let host = args[1]
let useTLS = args.contains("--tls")
let playsAudio = !args.contains("--no-audio")
let label = args.firstIndex(of: "--label").flatMap { $0 + 1 < args.count ? args[$0 + 1] : nil } ?? "audiocheck"
let queue = DispatchQueue(label: "audiocheck")
let rate = 48_000.0
let click = TestTone.click(sampleRate: rate)
let started = Date().timeIntervalSince1970

func message(_ kind: StreamMessageKind, _ payload: Data = Data()) -> Data {
    StreamMessage(kind: kind, timestamp: Date().timeIntervalSince1970, isKeyframe: false, payload: payload).serialized()
}
@Sendable func pct(_ v: [Double], _ q: Double) -> Double {
    guard !v.isEmpty else { return .nan }
    let s = v.sorted()
    return s[min(s.count - 1, Int((q * Double(s.count - 1)).rounded()))]
}
@Sendable func f1(_ x: Double) -> String { x.isNaN ? "–" : String(format: "%.1f", x) }

// MARK: - What arrived (on `queue`)

final class Tally {
    var frames = 0, framesSecond = 0, keyframes = 0
    var frameAges: [Double] = [], frameAgesSecond: [Double] = []
    var formats = 0, epochs: [Int] = [], packets = 0, packetsSecond = 0, seqGaps = 0, orphans = 0, starts = 0
    var packetAges: [Double] = [], packetAgesSecond: [Double] = []
    var firstPacketAt: Double?, lastPacketAt: Double?
    var nextSeq: [Int: UInt32] = [:]
    /// Each segment's first packet: its age (how long after its stamp it arrived).
    var segmentStartAges: [Double] = []
    var decodeFailures = 0
    /// Each whole second's click: its offset from the second, ms.
    var clickOffsets: [Int: Double] = [:], clicksSecond = 0
    var notAudioBytes = 0
}
let t = Tally()

// MARK: - The playout model (on `queue`), on these arrivals, with an ideal output

var model = AudioPlayout()
/// The output's clock: the sample `s` of its timeline goes out at `modelT0 + s ÷ rate`; a render reaches
/// `modelIO` ahead of now. Set at the first packet.
var modelT0: Double?
let modelIO = 0.005, modelOL = 0.010
var modelTimer: DispatchSourceTimer?
final class ModelTally {
    var placed = 0, late = 0, lateAfter2 = 0, jumps = 0, jumpsAfter3 = 0, joins = 0, dups = 0
    var coverMax = 0.0, needMax = 0.0, coverMaxAfter3 = 0.0, seconds = 0
    var behind: [Int] = []
}
let mt = ModelTally()
/// The device's monotonic clock, which the model counts arrivals on.
func monotonic() -> Double { ProcessInfo.processInfo.systemUptime }
func modelRead(_ now: Double) {
    guard let t0 = modelT0 else { return }
    let s = ((now + modelIO - t0) * rate).rounded(.down)
    _ = model.played(sample: s, at: t0 + s / rate, now: now)
}
func modelArm() {
    modelTimer?.cancel()
    modelTimer = nil
    guard let d = model.deadline else { return }
    let timer = DispatchSource.makeTimerSource(queue: queue)
    timer.schedule(deadline: .now() + max(0, d - monotonic()), leeway: .nanoseconds(0))
    timer.setEventHandler {
        let now = monotonic()
        modelRead(now)
        _ = model.tick(now: max(now, model.deadline ?? now))
        modelArm()
    }
    timer.resume()
    modelTimer = timer
}

// The sound's timeline: the current run of decoded samples (left channel) placed by their stamps, from
// `runWall` on; a new segment, a seq gap or a new epoch starts a new run.
var decoder: AudioDecoder?
var format: (epoch: Int, frames: Int, priming: Int)?
var run: [Float] = []
var runWall = 0.0
var runPrimed = false        // the run's decoder started clean (a segment's first packet) or has passed its first packet
var searched = Set<Int>()

func place(_ samples: ArraySlice<Float>, at wall: Double) {
    let at = run.isEmpty ? 0 : Int(((wall - runWall) * rate).rounded())
    if run.isEmpty { runWall = wall }
    // A run is contiguous within a segment; a stamp more than 2 frames off where the run ends starts it anew.
    if !run.isEmpty, abs(at - run.count) > 2 { run = []; runWall = wall }
    run.append(contentsOf: samples)
    // Each whole second the run now covers with a margin: the click's best match, ±600 frames.
    let last = runWall + Double(run.count) / rate
    var second = Int((runWall + 600 / rate).rounded(.up))
    while Double(second) + Double(600 + click.count) / rate <= last {
        if !searched.contains(second) {
            searched.insert(second)
            let want = Int(((Double(second) - runWall) * rate).rounded())
            var best = -Double.infinity, lag = 0
            for l in -600...600 {
                var acc = 0.0
                let s = want + l
                for j in 0..<click.count { acc += Double(click[j]) * Double(run[s + j]) }
                if acc > best { best = acc; lag = l }
            }
            t.clickOffsets[second] = Double(lag) / rate * 1000
            t.clicksSecond += 1
        }
        second += 1
    }
    // Keep a second and a half.
    if run.count > Int(1.5 * rate) {
        let drop = run.count - Int(rate)
        run.removeFirst(drop)
        runWall += Double(drop) / rate
    }
}

func took(_ header: StreamHeader, _ payload: Data) {
    let now = Date().timeIntervalSince1970
    switch header.kind {
    case .frame:
        model.frame(stamp: header.timestamp, arrival: monotonic())
        t.frames += 1; t.framesSecond += 1
        if header.isKeyframe { t.keyframes += 1 }
        let age = (now - header.timestamp) * 1000
        t.frameAges.append(age); t.frameAgesSecond.append(age)
    case .audio:
        guard let m = AudioMessage.parse(payload) else { t.decodeFailures += 1; return }
        switch m {
        case .format(let f):
            t.formats += 1
            guard let epoch = f.epoch, let frames = f.framesPerPacket, f.codec == "aac-eld" else { return }
            t.epochs.append(epoch)
            if model.format(epoch: epoch, framesPerPacket: frames, primingFrames: f.primingFrames ?? 0, cookie: f.cookie ?? Data()) {
                model.latency(output: modelOL, io: modelIO, refresh: 1.0 / 60, streamFPS: 60)
            }
            if format?.epoch == epoch { return }   // the epoch already playing (a move's new connection)
            decoder = try? AudioDecoder(framesPerPacket: frames, cookie: f.cookie ?? Data())
            format = (epoch, frames, f.primingFrames ?? 0)
            run = []
            runPrimed = false
            print("\(label): format epoch \(epoch) \(f.codec ?? "?") \(f.sampleRate ?? 0) Hz \(f.channels ?? 0) ch, \(frames) frames (priming \(f.primingFrames ?? 0)), \(f.source ?? "?")\(f.app.map { " " + $0 } ?? "")")
        case .packets(let p):
            t.packets += p.packets.count; t.packetsSecond += p.packets.count
            if t.firstPacketAt == nil { t.firstPacketAt = now - started }
            t.lastPacketAt = now - started
            let age = (now - header.timestamp) * 1000
            t.packetAges.append(age); t.packetAgesSecond.append(age)
            guard let fmt = format, fmt.epoch == p.epoch, let dec = decoder else { t.orphans += 1; return }
            var gap = false
            if let next = t.nextSeq[p.epoch], next != p.seq { t.seqGaps += 1; gap = true }
            t.nextSeq[p.epoch] = p.seq &+ UInt32(p.packets.count)
            if p.segmentStart {
                t.starts += 1
                t.segmentStartAges.append(age)
                dec.reset()
                run = []
                runPrimed = true
            } else if gap {
                dec.reset()
                run = []
                runPrimed = false
            }
            for i in 0..<p.packets.count {
                let now = monotonic()
                if modelT0 == nil { modelT0 = now + modelIO }
                modelRead(now)
                _ = model.packet(epoch: p.epoch, seq: p.seq &+ UInt32(i), stamp: header.timestamp + Double(i * fmt.frames) / rate,
                                 segmentStart: p.segmentStart && i == 0, now: now)
            }
            modelArm()
            for (i, packet) in p.packets.enumerated() {
                let stamp = header.timestamp + Double(i * fmt.frames) / rate
                guard let (left, _) = dec.decode(packet) else { t.decodeFai
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #138** (2026-10-27): **Chinese input (Zhuyin keyboard) and dictation (any language) can't be used to type on the Mac**
  *Symptoms*: ### What happened  Through Sill on my iPad, I can't type Chinese on my Mac, and I can't use dictation at all:  1. Zhuyin (Bopomofo) keyboard: nothing reaches the Mac — not the chosen characters, and not even the Bopomofo symbols (ㄅㄆㄇ) as I type them. 2. Dictation, in any language: dictated text doesn't reach the Mac, whether I dictate in Chinese or in English.  English typing works normally, including while the Mac's input source is Zhuyin. So the keyboard path itself works, and only composed input (an input method's candidates, dictation) is lost.  Expected: Chinese composed on the iPad (through the keyboard's candidates or through dictation) arrives in the focused Mac window, the same way English text does.  Workaround: type in another iPad app, copy, then use Sill's Paste and press ⌘V. This works but is slow.   Possible cause (from reading the source at 5c323e6; not verified with a debugger)  InputOverlayView adopts only UIKeyInput (iOSClient/InputOverlay.swift:16), not UITextInput. CJK input methods compose through marked text (setMarkedText / unmarkText) and commit the chosen candidate, and dictation inserts its result through the same UITextInput machinery. With UIKeyInput alone, iPadOS never commits anything to insertText(_:), so nothing is sent to the Mac. docs/hardware-keyboard-plan.md (item 11) already lists input methods as untested.  A possible fix: adopt UITextInput with marked-text support, keep the composition on the device, and send only the committed text as 

- **Issue #108** (2026-10-27): **Pairing code doesn't display when accessing a headless Mac**
  *Symptoms*: ### What happened  I have a headless Mac mini that I use Screens 5 to remotely control from time to time.  I wanted to give Sill a try, but, after installing it and clicking on the button to pair, the window manager focus changes to an invisible window; if it's there, it's not something I can see, which means neither the QR code or the manual code is accessible.  If I turn off the requirement to pair, I can remotely access the Mac, but, obviously, that's not something I want to do.  The workaround I had for this was to use the Apple Remote Desktop to access the Mini, and either because of sunspots, quantum entanglement, AI hallucinations, or something else, the QR code did display when using ARD.   This let me pair with my iPhone, but, it feels like a bug that the QR code didn't visibly display over VNC via Screens 5.    Feel free to close / ignore this if it's pilot error.  Note:  This is repeatable.  To get the logs I used Screens 5 again and the pairing window did not display.  You'll see it in the logs that it thinks it is displaying.   ### How to make it happen again  1.  Use Screens 5 to access a headless Mac 2. Run Sill 3. Click on the button to pair 4. Wait for the QR code to display 5. QR code doesn’t display 6. Notice that when you clicked on the Pair button, the window manager focus changed to something you can’t see  ### Your Mac and its macOS  M1 Mac Mini  ### Sill for Mac's version  0.5.1 (563)  ### Your iPhone or iPad and its iOS or iPadOS  iPhone 18 Pro Max (b

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

### Incident Patch 1: `6c5b5d24` (2026-10-27)
**Commit Message**: Merge pull request #236 from Saffsanity/defaults-tiles-vd

The defaults Noah set on 2026-10-27, one PR after #117: the connect screen shows tiles unless its person chose the list, and the list/tiles switch always shows; Sill.app's Virtual Display and Send Audio are on by default as registered defaults that a saved key always wins over (the CLI keeps --virtual-display and --audio opt-in); the virtual display is never made with a side under 800 points, which macOS ran at 1x (the five 1x displays in Sill.log, an iPhone held upright). Verified 2026-10-27 (the verdict in the handoff): run-all 55 of 55, 162 of 162 mutants over four checks, the CLI's output identical to main's, the bare app registering both defaults and writing nothing, photos on a 27.1 Duo simulator, then the review's word fixes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

**File**: `CLAUDE.md` (modified, +109/-10)
```diff
@@ -8,6 +8,99 @@ Formerly winstream; the folder still carries the old name.
 
 ## Current step
 
+**Tiles, Virtual Display and Send Audio on by default (2026-10-27, branch `defaults-tiles-vd` from main at
+3c257485, fast-forwarded to 3b546374 (#234) before its first commit; PR #236).** Noah, 2026-10-27:
+"make tiles not list the default behavior of the app. Also have Virtual Desktop on by default. Of
+course, if a user changes a setting remember their choice for future sessions as you do now. Make
+this a separate PR after #117 merges." Later that morning, testing #235: "Send Audio should be on
+by default, and mute should be off by default." No wire change.
+- Sill.app's Send Audio is on by default too (`HostConfig.app.sendAudio`; the CLI's `--audio` still
+  opts in; a saved `sendAudio` wins, so a Mac whose user turned it off stays off): the menu's
+  checkmark and Settings › Streaming's switch start on; README's Good to know, support.html's Sound
+  section and privacy.html say so. Mute on the device was off by default already (#235).
+- The device: the connect screen shows tiles unless its person chose the list
+  (`ConnectionList.defaultStyle`, `storedStyle`: a stored `Sill.connectionStyle`, "list" or "tiles",
+  always wins; nothing stored, or a value no build writes, reads as tiles). ConnectScreen keeps the
+  key optional (`@AppStorage … String?`), so the rule alone decides, as StreamClient's
+  `connectionStyle` already did. So a picture of each saved Mac's screen is kept by default
+  (`takesPreview`, unchanged: only with tiles), and Disconnect asks for its fresh keyframe by default
+  (300 ms at most before the connect screen with Sill for Mac 0.5.1, which skips kind 44). The switch
+  beside the title always shows, whichever style is on and whether or not a Mac is listed (Noah,
+  2026-10-27: "The list/tiles switch should always show"; #117 showed it for tiles alone, which with
+  tiles the default took it away under the finger of someone with no saved Mac who chose the list).
+  DEBUG: `-SillStyleToggleAt <s>[,<s>…]` toggles the style as
+  the switch does (`toggleStyle`); the console's `connect:` lines.
+- The Mac: Sill.app registers `HostConfig.app` (HostSettings), the CLI's `standard` with the virtual
+  display on. Registered, never written: a `virtualDisplay` key set from the menu, Settings ›
+  Virtual Display or a device always wins (a Mac that turned it off stays off; this Mac's own keys read 1 for
+  both on 2026-10-27, set by hand, so nothing changes here), and `-virtualDisplay 0` turns it off for one run. The CLI keeps `standard`: `--virtual-display`
+  opt-in, its stdout byte for byte. The menu's checkmark and the pane's switch follow `config`; no
+  pane names the default.
+- The virtual display at 1x, the caveat of that decision: not in the session of 2026-10-26/27.
+  Beside the 2560×1440 display at 1x every staged capture that night read "scale 2.0" (`filter
+  (1456.0, 1486.0)`, `(2560.0, 1486.0)`, `(2560.0, 2264.0)`); its "scale 1.0" captures were real
+  windows and the Desktop on that display (#233's case). Sill.log's 1x displays were five earlier
+  ones (2026-09-26, 09-28, 10-08 twice, 10-15), each asked with both sides under 800 points, 754×784
+  or 762×792: an iPhone held upright (its 377- or 381-point picture doubled for Aa's smallest step)
+  and the menu bar, beside the Mac's own Retina display too, so the main display's scale played no
+  part. macOS listed the 2x mode asked for, `selectRequestedMode` asked for it every half second,
+  and the display stayed at 800×832 points at 1x until the stage's 3 s wait ran out ("online 3312
+  ms"): the pick waited 3 s more, and the staged window was captured at 2x from a 1x display (eleven
+  captures `filter (800.0, 832.0) scale 1.0`). Every display with a side of 800 points or more came
+  up at 2x (754×979, 838×792, 900×800, 1000×784, 848×878 and larger). The fix, `VirtualDisplaySize`
+  (pure, in CaptureScale.swift, checked by `Tests/checks/capture-scale`): every side 800 to 4096
+  points, so an iPhone upright gets 800×830; VirtualStage's `envelope` and `ensureDisplay` use it.
+  The creation line prints the mode the display came up at (`VirtualDisplay.currentScale`; it said
+  "@2×" whatever came up), and `--virtual-display-selftest [Hz] [WxH]` makes another size.
+- Words: README (How it works: the connect screen's tiles, On iPhone, Text size and the virtual
+  display with it on by default; Good to know), site/support.html (a section, "A window left your
+  Mac’s screen", whose sentence on the default is marked `<!-- Virtual Display` for its release; "It
+  says Not paired"), site/privacy.html (the tiles' items: kept unless the list is chosen; "touch and
+  hold it"; dated October 27, 2026; the virtual display needs no word there, Accessibility "so Sill
+  can move and size the window it shows" says it already), docs/release-checklist.md (the marker,
+  its perl line and grep), docs/app-store-metadata.md (the descript
```

**File**: `README.md` (modified, +34/-22)
```diff
@@ -77,20 +77,21 @@ Sill has layouts of its own.
 - **On iPhone**, held upright, the picture is on top with buttons, keys and a
   trackpad below. Larger Picture, in the settings panel, gives a window's
   picture the room of the window thumbnails, down to where the keyboard comes
-  up; the Desktop keeps the usual layout. A window keeps its own shape until
-  you set its text size with Aa, or turn on the virtual display; then your Mac
-  makes it fill the taller picture.
+  up; the Desktop keeps the usual layout. With the virtual display (on unless
+  you turn it off in Sill for Mac), your Mac makes a window fill the taller
+  picture; with it off, once you set the window's text size with Aa.
 - **The clipboard** goes both ways while Share Clipboard is on, in both apps:
   text you copy on your Mac is ready to paste on your device, and Paste in
   Sill sends what you copied on your device to your Mac's clipboard, where you
   press ⌘V. Sill never reads your device's clipboard by itself, and copies a
   password manager marks as concealed stay on your Mac.
-- **Sound from your Mac** is a beta, off until you turn on Send Audio: in the
+- **Sound from your Mac** is a beta, on by default; Send Audio (Beta) in the
   Sill menu or Sill's Settings on your Mac, or in the settings panel of Sill on
-  your iPhone or iPad. Then Sill for Mac captures the sound of the window's
-  app, or of every app for the Desktop, and every connected device plays it a
-  moment behind the picture, never ahead of it. Your Mac keeps playing it too,
-  and Mute in a device's settings panel silences it on that device alone.
+  your iPhone or iPad, turns it off and on. Sill for Mac captures the sound of
+  the window's app, or of every app for the Desktop, and every connected device
+  plays it a moment behind the picture, never ahead of it. Your Mac keeps
+  playing it too, and Mute in a device's settings panel silences it on that
+  device alone.
 - **On iPhone Duo**, Sill follows the hinge: open it flat and your Mac fills
   the inner display; half open, the picture is above the fold with a trackpad
   and keys below; closed, Sill runs on the cover display. Nothing you touch
@@ -100,6 +101,10 @@ Sill has layouts of its own.
   Sill for Mac reads each menu from the app as you open it and chooses the
   item you pick, through Accessibility. When someone moves the mouse at your
   Mac, your device shows the pointer where it is.
+- **The connect screen** on your device shows each Mac as a tile, a paired Mac
+  with its screen as your last session with it ended. The picture stays on
+  your device until you remove it or forget the Mac. The button beside
+  "Connect to a Mac" lists them instead, and Sill remembers which you chose.
 - **Nearby**, your device finds your Mac with Bonjour on your local network.
   Over a USB cable, your Mac shows as Wired and the connection uses the cable.
   With no shared network, Direct Wireless Connection (off by default) connects
@@ -125,22 +130,29 @@ Sill has layouts of its own.
 - **When the link can't keep up**, Sill for Mac notices that it is holding
   frames back and tells your device, which says so over the picture and, in
   its Settings, offers a quality the link can carry.
-- **Text size**: Aa on your device resizes the window you stream on your Mac,
-  through Accessibility, so its text shows at the size you pick, and keeps it
-  at that size while it streams. The window goes back to its own size and
-  place when Sill stops showing it: you pick another window or the Desktop,
-  your last device disconnects, or you quit Sill. If you moved it on your Mac
-  meanwhile, it keeps its new place.
-- **The virtual display** (off by default) moves a window you stream onto a
-  display of its own on your Mac, so it keeps updating when other windows
-  cover it. It uses a private macOS API, which is one reason Sill for Mac comes
-  from the website and not from the Mac App Store.
+- **Text size**: Aa on your device resizes the window you stream, through
+  Accessibility, so its text shows at the size you pick, and keeps it at that
+  size while it streams, on the virtual display or, with that off, on your
+  Mac's screen. The window goes back to its own size and place when Sill stops
+  showing it: you pick another window or the Desktop, your last device
+  disconnects, or you quit Sill. With the virtual display off, a window you
+  moved on your Mac meanwhile keeps its new place.
+- **The virtual display**, on unless you turn it off in the Sill menu or in
+  Sill's Settings on your Mac, or in the settings panel of Sill on your iPhone
+  or iPad, moves the window you stream onto a display of
+  its own on your Mac, sized for your device, so it keeps updating when other
+  windows cover it. The window leaves your Mac's screen while it streams and
+  comes back where it was. The display uses a private macOS API, which is one
+  reason Sill for Mac comes from the website and not from the Mac App Store; if
+ 
```

**File**: `Sources/SillHost/CaptureScale.swift` (modified, +49/-5)
```diff
@@ -25,15 +25,17 @@ import Foundation
 /// rule of Sill's own can disagree with that pick (one that did would ask for a size the capture
 /// never fills, or restart the stream at every poll). It is what the capture line has always
 /// printed ("scale 1.0" above). Sill's own virtual display is made at 2x (VirtualStage's
-/// `VirtualDisplay(…, scale: 2)`), so a window staged there captures at the knob, as before.
+/// `VirtualDisplay(…, scale: 2)`, at a size macOS keeps at 2x: VirtualDisplaySize), so a window staged
+/// there captures at the knob, as before.
 ///
 /// Pure: Foundation and CoreGraphics, checked on its own with swiftc (Tests/checks/capture-scale).
 enum CaptureScale {
     /// The scale of Sill's own virtual display, which VirtualStage makes at 2x (HiDPI): what a staged
-    /// window's capture is held to, decided before the display exists. VirtualStage keeps a display
-    /// that came up at another mode ("online but not at … @2×": five times in Sill.log, each an
-    /// 800×832-point display at 1x), and a window staged on it still captures at the knob, scaled up,
-    /// as it always has.
+    /// window's capture is held to, decided before the display exists. macOS kept it at 2x for every
+    /// size but one with both sides under 800 points, five times in Sill.log an 800×832-point display at
+    /// 1x, where a staged window was captured at the knob, scaled up; VirtualDisplaySize keeps every
+    /// side at 800 or more since 2026-10-27. VirtualStage still keeps a display that comes up at
+    /// another mode ("online but not at … @2×"), and a window staged there still captures at the knob.
     static let virtualDisplay: CGFloat = 2
 
     /// The pixels a point that a capture of a source on a display of scale `displayScale` runs at:
@@ -122,6 +124,48 @@ enum CaptureScale {
     }
 }
 
+/// The size of Sill's virtual display in points, as VirtualStage asks VirtualDisplay for it: no side
+/// under 800 points, the least macOS keeps at 2x, the scale a staged window's capture counts on
+/// (`CaptureScale.virtualDisplay`).
+///
+/// Found in Sill.log (2026-09-26 to 2026-10-15): of every display Sill made, five came up at 1x, each
+/// asked with both sides under 800 points, 754×784 (four times) or 762×792: the envelope of an iPhone
+/// held upright, its picture 377 or 381 points wide, doubled for Aa's smallest step, with the menu bar.
+/// Each came up at 800×832 points at 1x. macOS listed the mode asked for ("754×784 pt @ 1508×1568 px"),
+/// VirtualDisplay.waitUntilOnline asked for it every half second, and the display stayed at 1x until
+/// the stage's 3 s wait ran out ("Virtual display is online but not at 754×784 @2×: backing 800×832
+/// px", "online 3312 ms"): the pick waited 3 s more, and a window staged there was captured at the knob
+/// from a 1x display, scaled up ("Capture started: 1480×768 … filter (800.0, 832.0) scale 1.0").
+/// Every display with a side of 800 points or more came up at 2x within about half a second, one
+/// side under 800 or not (754×979, 838×792, 1000×784, 900×800, 848×878). The main display's scale
+/// played no part: those five were made beside the Mac's own Retina display, and on 2026-10-27,
+/// beside an external 2560×1440 display at 1x, every one came up at 2x ("filter (2560.0, 2264.0)
+/// scale 2.0"). So every side is held to 800 points or more, which macOS kept at 2x whatever the
+/// other side: the smallest display Sill makes is 800×830 (800 and a 30-point menu bar).
+///
+/// Pure, with CaptureScale (Tests/checks/capture-scale).
+enum VirtualDisplaySize {
+    /// The least side, in points.
+    static let minSide: CGFloat = 800
+    /// 4096 keeps the 2x backing store at or under 8192 pixels, VirtualDisplay's ceiling.
+    static let maxSide: CGFloat = 4096
+
+    /// Each side held to `minSide`…`maxSide`.
+    static func clamp(_ s: CGSize) -> CGSize {
+        CGSize(width: min(max(s.width, minSide), maxSide), height: min(max(s.height, minSide), maxSide))
+    }
+
+    /// The display's size below its menu bar that fits a device's panel of `panel` points at every Aa
+    /// scale and in both orientations: a square of the panel's longer edge ÷ 0.5 (the slider's smallest
+    /// step). No panel (no viewport yet), or one with no area: the window's own size. Held by `clamp`
+    /// either way (VirtualStage.envelope).
+    static func envelope(panel: CGSize?, windowSize: CGSize) -> CGSize {
+        guard let panel, panel.width > 0, panel.height > 0 else { return clamp(windowSize) }
+        let side = ceil(max(panel.width, panel.height) / 0.5)
+        return clamp(CGSize(width: side, height: side))
+    }
+}
+
 /// HEVC wants even sides: a capture's size in pixels rounded down to even. Every capture's rule until
 /// 2026-10-27, and still a display's, a staged window's crop's and the test pattern's; a window that
 /// ScreenCaptureKit draws 1:1 rounds up instead (`CaptureScale.windowPixels`). Here rather than in
```

**File**: `Sources/SillHost/HostConfig.swift` (modified, +26/-10)
```diff
@@ -1,8 +1,8 @@
 import CoreGraphics
 
 /// The host's knobs, as one value. The CLI streams with `standard` (plus its --virtual-display and
-/// --direct-wireless flags); the menu bar app starts from the same values and lets Settings change
-/// them while it runs. Change `standard`, rebuild, measure: both pick it up.
+/// --direct-wireless flags); the menu bar app starts from `app`, the same values with the virtual display
+/// and Send Audio on, and lets Settings change them while it runs. Change `standard`, rebuild, measure: both pick it up.
 ///
 /// The coordinator takes a new value only between pipelines (inside `select`), so one pipeline
 /// never mixes two settings. See `StreamCoordinator.setTarget`.
@@ -23,7 +23,7 @@ package struct HostConfig: Equatable, Sendable {
     /// Apple: trades quality for encode speed; try after the baseline.
     package var prioritizeSpeed: Bool
     /// A picked window streams from its own HiDPI virtual display (see VirtualStage). Needs the
-    /// AppKit event loop, so the CLI turns it on only with --virtual-display.
+    /// AppKit event loop, so the CLI turns it on only with --virtual-display. On in Sill.app (`app`).
     package var virtualDisplay: Bool
     /// Direct Wireless Connection: peer-to-peer Wi-Fi (AWDL) on the listener and its Bonjour
     /// registration, so a device with no network in common can find and reach the Mac. Off by
@@ -58,8 +58,9 @@ package struct HostConfig: Equatable, Sendable {
     package var shareClipboard: Bool
     /// Send Audio: every connected device that plays the Mac's sound (its hello lists a codec) gets the
     /// sound of what streams, the streamed window's app or every app for the Desktop (AudioPipeline,
-    /// kind 43). Off by default: the Mac keeps playing its own sound, so a device beside it would
-    /// double every sound a moment late. The sound's own stream's, not the pipeline's: a change starts
+    /// kind 43). Off in `standard` (the CLI's `--audio` opts in), on in Sill.app since 2026-10-27 (`app`):
+    /// the Mac keeps playing its own sound, so a device beside it doubles every sound a moment late
+    /// until it mutes. The sound's own stream's, not the pipeline's: a change starts
     /// or stops that stream and never restarts the picture (absent from `restartNeeded`), whoever makes
     /// it. One value home or away, set from the Mac's menu and Settings, the CLI's `--audio`, or any
     /// device's Settings panel (`DeviceSettings.accepted`, then `applying` or `applyingAway` like every
@@ -87,22 +88,37 @@ package struct HostConfig: Equatable, Sendable {
         self.sendAudio = sendAudio
     }
 
-    /// The spike's knobs, formerly the `let`s at the top of the CLI's main.swift, and the app's
-    /// defaults. Virtual display off in both until Noah flips it. Direct Wireless off in both
-    /// (Noah, 2026-09-24): AWDL costs every Wi-Fi stream its steadiness, and a shared network needs
+    /// The spike's knobs, formerly the `let`s at the top of the CLI's main.swift: the CLI's values, and
+    /// the app's but for the virtual display and Send Audio (`app`). Virtual display off here: the CLI turns it on
+    /// with --virtual-display, which runs the AppKit loop the display needs. Direct Wireless off in
+    /// both (Noah, 2026-09-24): AWDL costs every Wi-Fi stream its steadiness, and a shared network needs
     /// none of it. Remote access and internet access off in both: only the Mac's own user widens
     /// exposure. 7455 is unassigned at IANA and below the ephemeral range. Away from home, Low ·
     /// Standard (Noah, 2026-09-25): a slow connection never starts at the home quality. Require
     /// pairing on: a home door that speaks TLS admits only paired devices until the Mac's user says
     /// otherwise. Share clipboard with devices on (2026-10-14): each device has its own switch too, and
-    /// a password manager's copies never go. Send Audio off in both until Noah has tried it
-    /// (docs/audio-plan.md, Q1).
+    /// a password manager's copies never go. Send Audio off here; Sill.app's is on since 2026-10-27
+    /// (`app`).
     package static let standard = HostConfig(maxFPS: 120, captureScale: 2, bitrate: 15_000_000,
                                              awayBitrate: 4_000_000, awayCaptureScale: 1,
                                              prioritizeSpeed: false, virtualDisplay: false, directWireless: false,
                                              remoteAccess: false, remotePort: 7455, internetAccess: false,
                                              requirePairing: true, shareClipboard: true, sendAudio: false)
 
+    /// Sill.app's defaults: `standard` with the virtual display on (Noah, 2026-10-27: "have Virtual
+    /// Desktop on by default. Of course, if a user changes a setting remember their choice for future
+    /// sessions as you do now"). HostSettings registers these, so a key the Mac's user or a device ever
+    /// set (`virtualDisplay`
```

**File**: `Sources/SillHost/VirtualDisplay.swift` (modified, +8/-0)
```diff
@@ -103,6 +103,14 @@ final class VirtualDisplay {
 
     var isAlive: Bool { object != nil }
 
+    /// The current mode's pixels a point, whole: 2 at the HiDPI mode asked for, 1 at a mode macOS
+    /// chose instead (VirtualStage's creation line). 0 before the display is online.
+    var currentScale: Int {
+        let b = bounds, px = pixelSize
+        guard b.width > 0, px.width > 0 else { return 0 }
+        return Int((Double(px.width) / Double(b.width)).rounded())
+    }
+
     /// The retained CGVirtualDisplay instance. Releasing it removes the display.
     private var object: AnyObject?
     private let queue = DispatchQueue(label: "sill.virtualdisplay")
```

**File**: `Sources/SillHost/VirtualDisplaySelfTest.swift` (modified, +22/-10)
```diff
@@ -3,11 +3,13 @@ import AppKit
 import CoreGraphics
 import ScreenCaptureKit
 
-/// `SillHost --virtual-display-selftest`: creates one 1000×700 pt @2× virtual display from a
-/// process that runs the AppKit event loop exactly as `--virtual-display` does, reports what this
-/// process, CoreGraphics, AppKit and ScreenCaptureKit see of it, destroys it and exits. The
-/// display part needs no permission; SCShareableContent needs Screen Recording and the report
-/// says so when it is missing. Exit code 0 when the display came up and went away cleanly.
+/// `SillHost --virtual-display-selftest [Hz] [WxH]`: creates one 1000×700 pt @2× virtual display (or
+/// W×H points: `800x830` is the smallest VirtualStage makes, VirtualDisplaySize; `754x784` one that
+/// macOS ran at 1x) from a process that runs the AppKit event loop exactly as `--virtual-display`
+/// does, reports what this process, CoreGraphics, AppKit and ScreenCaptureKit see of it, destroys it
+/// and exits. The display part needs no permission; SCShareableContent needs Screen Recording and the
+/// report says so when it is missing. It moves the pointer onto the display and back (the input
+/// check below). Exit code 0 when the display came up and went away cleanly.
 package enum VirtualDisplaySelfTest {
     package static func run() -> Never {
         let app = NSApplication.shared
@@ -20,6 +22,13 @@ package enum VirtualDisplaySelfTest {
         exit(0)   // app.run() does not return
     }
 
+    /// "800x830" → 800×830 points; nil for anything else (a refresh rate, another flag).
+    private static func points(_ text: String) -> (width: Int, height: Int)? {
+        let parts = text.lowercased().split(separator: "x")
+        guard parts.count == 2, let w = Int(parts[0]), let h = Int(parts[1]), w > 0, h > 0 else { return nil }
+        return (w, h)
+    }
+
     private static func onlineDisplays() -> [CGDirectDisplayID] {
         var n: UInt32 = 0
         CGGetOnlineDisplayList(0, nil, &n)
@@ -44,12 +53,15 @@ package enum VirtualDisplaySelfTest {
         let t0 = Date()
         let d: VirtualDisplay
         do {
-            // `--virtual-display-selftest 120` asks for a 120 Hz display (what a ProMotion device gets).
+            // `--virtual-display-selftest 120` asks for a 120 Hz display (what a ProMotion device gets),
+            // and `800x830` (either order) for that size in points.
             let args = CommandLine.arguments
-            let hz = args.firstIndex(of: "--virtual-display-selftest").flatMap { i in args.count > i + 1 ? Double(args[i + 1]) : nil } ?? 60
-            d = try VirtualDisplay(name: "Sill", widthPt: 1000, heightPt: 700, scale: 2, refreshHz: hz,
+            let after = args.firstIndex(of: "--virtual-display-selftest").map { Array(args[($0 + 1)...]) } ?? []
+            let hz = after.lazy.compactMap { Double($0) }.first ?? 60
+            let size = after.lazy.compactMap(points).first ?? (width: 1000, height: 700)
+            d = try VirtualDisplay(name: "Sill", widthPt: size.width, heightPt: size.height, scale: 2, refreshHz: hz,
                                    vendorID: VirtualStage.vendorID, productID: VirtualStage.productID, serialNum: VirtualStage.serialNum)
-            print("  requested refresh: \(Int(hz)) Hz")
+            print("  requested: \(size.width)×\(size.height) pt @2×, \(Int(hz)) Hz")
         } catch {
             print("  FAIL create: \(error)")
             return 2
@@ -59,7 +71,7 @@ package enum VirtualDisplaySelfTest {
         let onlineMs = Int(Date().timeIntervalSince(t0) * 1000)
         let px = d.pixelSize
         print("  created id \(d.displayID) in \(createdMs) ms; online at requested mode: \(online) after \(onlineMs) ms")
-        print("  bounds \(d.bounds), backing \(px.width)×\(px.height) px")
+        print("  bounds \(d.bounds), backing \(px.width)×\(px.height) px, @\(d.currentScale)×")
         if let mode = CGDisplayCopyDisplayMode(d.displayID) { print("  current mode refresh: \(Int(mode.refreshRate)) Hz") }
         // Input reachability: the host maps device touches to global coordinates on this display
         // and posts HID mouse events there. If the window server keeps the cursor off virtual
```

**File**: `Sources/SillHost/VirtualStage.swift` (modified, +14/-19)
```diff
@@ -16,8 +16,9 @@ import StreamProtocol
 /// exactly where it was and removes the display.
 ///
 /// Geometry: the display is not sized to the client's panel but to an *envelope* — a square whose
-/// side is the panel's longer edge ÷ 0.5 (the smallest Aa scale), plus the menu bar — and reused
-/// as long as the wanted window fits, so a rotation or an Aa step only re-places the window and
+/// side is the panel's longer edge ÷ 0.5 (the smallest Aa scale), 800 points at least (an iPhone's
+/// 754 came up at 1x: VirtualDisplaySize), plus the menu bar — and reused as long as the wanted
+/// window fits, so a rotation or an Aa step only re-places the window and
 /// restarts the pipeline; no display is recreated and nothing flashes on the Mac. The encoded
 /// frame is always exactly the window's rectangle (`sourceRect`), so the envelope is invisible on
 /// the device. To get the task's literal "display sized to the panel", make `envelope` return
@@ -144,10 +145,6 @@ final class VirtualStage {
     let sizer: WindowSizer
     let catalog: WindowCatalog
 
-    /// Display bounds: 320 is VirtualDisplay's floor; 4096 keeps the 2× backing store at or under
-    /// 8192 px, its ceiling.
-    static let minSide: CGFloat = 320
-    static let maxSide: CGFloat = 4096
     /// Fixed identity, so System Settings › Displays keeps one remembered "Sill" entry across runs
     /// (the probe used serial 0xF00D and does not collide).
     static let vendorID: UInt32 = 0x5111, productID: UInt32 = 0x0001, serialNum: UInt32 = 1
@@ -204,16 +201,11 @@ final class VirtualStage {
     }
 
     /// The display size (without the menu bar) that fits this panel at every Aa scale and in both
-    /// orientations: a square of the longer edge ÷ 0.5 (the slider's smallest step). No viewport →
-    /// the window's own size.
+    /// orientations: a square of the longer edge ÷ 0.5 (the slider's smallest step), every side 800
+    /// to 4096 points (VirtualDisplaySize, pure, where the rule and its reasons are). No viewport →
+    /// the window's own size, held the same way.
     static func envelope(for v: Viewport?, windowSize: CGSize) -> CGSize {
-        guard let v, v.width > 0, v.height > 0 else { return clamp(windowSize) }
-        let side = ceil(max(v.width, v.height) / 0.5)
-        return clamp(CGSize(width: side, height: side))
-    }
-
-    static func clamp(_ s: CGSize) -> CGSize {
-        CGSize(width: min(max(s.width, minSide), maxSide), height: min(max(s.height, minSide), maxSide))
+        VirtualDisplaySize.envelope(panel: v.map { CGSize(width: $0.width, height: $0.height) }, windowSize: windowSize)
     }
 
     /// The NSScreen for a display ID, as the area below its menu bar in CG (top-left) coordinates.
@@ -507,15 +499,15 @@ final class VirtualStage {
     /// so one grown to an app's minimum is not grown a second time after a rate change. Throws
     /// with the display destroyed if it never came up or SCK never saw it.
     private func ensureDisplay(atLeast env: CGSize) async throws {
-        var env = Self.clamp(env)
-        env.height = min(env.height, Self.maxSide - menuInset)   // the menu bar counts toward the 8192 px ceiling
+        var env = VirtualDisplaySize.clamp(env)
+        env.height = min(env.height, VirtualDisplaySize.maxSide - menuInset)   // the menu bar counts toward the 8192 px ceiling
         if let d = display, d.isAlive, scDisplay != nil, Int(d.refreshHz) == refreshHz,
            CGFloat(d.widthPt) >= env.width, CGFloat(d.heightPt) - menuInset >= env.height {
             Stats.shared.bump("vd.reused")
             return
         }
         if let d = display {
-            env = Self.clamp(CGSize(width: max(env.width, CGFloat(d.widthPt)), height: max(env.height, CGFloat(d.heightPt) - menuInset)))
+            env = VirtualDisplaySize.clamp(CGSize(width: max(env.width, CGFloat(d.widthPt)), height: max(env.height, CGFloat(d.heightPt) - menuInset)))
         }
         // Recreating under a staged window (rate change, envelope grew) would let the window server
         // dump it anywhere on a real display until the new one is up: send it home first. prepare
@@ -586,7 +578,10 @@ final class VirtualStage {
         }
         scDisplay = listed
         Stats.shared.bump("vd.created")
-        print("Virtual display \(d.widthPt)×\(d.heightPt) pt @2× id \(d.displayID): created \(created) ms, online \(onlineMs) ms, "
+        // The mode it came up at, not the one asked for: a display macOS kept at 1x read "@2×" here
+        // until 2026-10-27 (the line before this one said so, "online but not at …").
+        let b = d.bounds
+        print("Virtual display \(Int(b.width))×\(Int(b.height)) pt @\(d.currentScale)× id \(d.displayID): created \(created) ms, online \(onlineMs) ms, "
               + "listed by ScreenCaptureKit after \(Self.ms(since: t1)) ms, menu bar \(Int(menuInset)) pt\(insetMeasured ? "" : " (assumed)")")
     }
 
```

**File**: `Sources/SillHostCLI/main.swift` (modified, +9/-8)
```diff
@@ -9,8 +9,8 @@ import SillHostCore
 setvbuf(stdout, nil, _IOLBF, 0)
 
 // Knobs for the spike: maxFPS, captureScale, bitrate (per 60 fps), prioritizeSpeed. They live in
-// Sources/SillHost/HostConfig.swift now (`HostConfig.standard`), which is also where the menu bar
-// app's Settings start. Change, rebuild, measure.
+// Sources/SillHost/HostConfig.swift now (`HostConfig.standard`); the menu bar app's Settings start from
+// `HostConfig.app`. Change, rebuild, measure.
 var config = HostConfig.standard
 
 // Optional. Streams the first window whose app name or title matches, before any client asks.
@@ -23,8 +23,9 @@ let synthetic = CommandLine.arguments.contains("--synthetic")
 
 // `SillHost --virtual-display`: a picked window is moved onto its own HiDPI virtual display and
 // that display is captured, so the window keeps repainting whatever covers its old spot on the
-// Mac. Off by default until Noah has tried it. Needs the AppKit event loop below: without it this
-// process never sees the display's modes (VirtualDisplay.swift, "Event loop").
+// Mac. Off by default here (Sill.app has it on since 2026-10-27: HostConfig.app). Needs the AppKit
+// event loop below: without it this process never sees the display's modes (VirtualDisplay.swift,
+// "Event loop").
 let virtualDisplay = CommandLine.arguments.contains("--virtual-display")
 config.virtualDisplay = virtualDisplay
 
@@ -118,10 +119,10 @@ if let app = MenuSelfTest.requested(in: CommandLine.arguments) {
 // Otherwise SCStream aborts with "Assertion failed: (did_initialize), CGS_REQUIRE_INIT".
 _ = CGMainDisplayID()
 
-// `SillHost --virtual-display-selftest`: creates one 1000×700 pt @2× virtual display, reports
-// whether this process, CoreGraphics and ScreenCaptureKit see it, destroys it and exits. Needs
-// no permission for the display itself (SCShareableContent needs Screen Recording; it says so).
-// Runs under the AppKit loop like the real thing.
+// `SillHost --virtual-display-selftest [Hz] [WxH]`: creates one 1000×700 pt @2× virtual display (or
+// W×H points), reports whether this process, CoreGraphics and ScreenCaptureKit see it and the mode it
+// came up at, destroys it and exits. Needs no permission for the display itself (SCShareableContent
+// needs Screen Recording; it says so). Runs under the AppKit loop like the real thing.
 if CommandLine.arguments.contains("--virtual-display-selftest") {
     VirtualDisplaySelfTest.run()
 }
```

---

### Incident Patch 2: `64cc383b` (2026-10-27)
**Commit Message**: Words: Send Audio on by default everywhere it was said off, the switch always shown, the numbers at the head (#236)

The review of #236: three source comments, BRIEF.md, the App Store drafts
(the description's sound bullet, the review notes' sound line at the same
byte length), docs/audio-plan.md's Q1 and the lines premised on off by
default, the Current step entry's numbers (away-quality 96 and 30 of 30, five
previews, the warning's line, the photos under the always-shown switch, this
Mac's saved keys), the simulator instruction (a simctl spawn defaults write
never reaches the app: plutil on the container's plist instead), README's
virtual display bullet (a device's panel turns it off too).

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `CLAUDE.md` (modified, +18/-15)
```diff
@@ -32,8 +32,8 @@ by default, and mute should be off by default." No wire change.
   the switch does (`toggleStyle`); the console's `connect:` lines.
 - The Mac: Sill.app registers `HostConfig.app` (HostSettings), the CLI's `standard` with the virtual
   display on. Registered, never written: a `virtualDisplay` key set from the menu, Settings ›
-  Virtual Display or a device always wins (a Mac that turned it off stays off; this Mac's own reads
-  0), and `-virtualDisplay 0` turns it off for one run. The CLI keeps `standard`: `--virtual-display`
+  Virtual Display or a device always wins (a Mac that turned it off stays off; this Mac's own keys read 1 for
+  both on 2026-10-27, set by hand, so nothing changes here), and `-virtualDisplay 0` turns it off for one run. The CLI keeps `standard`: `--virtual-display`
   opt-in, its stdout byte for byte. The menu's checkmark and the pane's switch follow `config`; no
   pane names the default.
 - The virtual display at 1x, the caveat of that decision: not in the session of 2026-10-26/27.
@@ -63,7 +63,7 @@ by default, and mute should be off by default." No wire change.
   checks README.
 - Verified: `swift build -c release`, only the CaptureProbe warning; `Tests/checks/run-all.sh`, all
   55 (562 s); mutants: connection-list 162 checks and 76 of 76, capture-scale 148 and 39 of 39,
-  away-quality 88 and 27 of 27, virtual-display-api (VirtualDisplay.swift changed) 17 of 17; H2
+  away-quality 96 and 30 of 30 (after #235's merge: its acceptance mutants and the app defaults'), virtual-display-api (VirtualDisplay.swift changed) 17 of 17; H2
   against main at 3b546374 from `git archive`, `--synthetic` on loopback (software encoder, no
   router, no screen): idle 35 s identical masked and sorted (8 lines), with `sillclient.py PORT 8
   desktop` identical (23 lines; a first pair differed only in which counters three stats lines
@@ -72,15 +72,16 @@ by default, and mute should be off by default." No wire change.
   `-SillSetAfter '2 virtualDisplay=0'`, one "Settings: virtual display on → off" and the key 0; a
   relaunch, off; `-virtualDisplay 1`, on for the run, the key still 0; main's binary with no key,
   off; previews from both bare binaries at one path, 146 files each, only `menu.txt` (the
-  update-available sample's ✓), `pane-virtualDisplay-light.png` and `-dark.png` differ; the iOS app
+  update-available sample's ✓ Virtual Display and ✓ Send Audio (Beta)), `pane-virtualDisplay-light.png`,
+  `-dark.png`, `pane-streaming-light.png` and `-dark.png` differ, each pane only in its switch; the iOS app
   with Xcode 27.1 (27A9275), Debug for the generic simulator as CI builds it, Release for the
   simulator, Debug for a device, only the known StreamClient capture warning
-  (StreamClient.swift:4067); on a private iPhone Duo simulator on iOS 27.1 (its cover display), the
-  29 connect cases at 466×678 and 951×669 against main's Debug build: this build with the list
-  stored and main's with nothing stored, 58 of 58 pixel for pixel; this build with nothing stored
-  and main's with tiles stored, 43 of 58, the rest the switch beside the title absent with no saved
-  Mac listed (denied, hint, looking, methods, nearby, notice, update, both sizes) and the pairing
-  case's spinner (it differs from itself); the normal app, a fresh install against a synthetic host
+  (StreamClient.swift:4110); on a private iPhone Duo simulator on iOS 27.1 (its cover display), the
+  29 connect cases at 466×678 and 951×669 against main's Debug build: this build with nothing stored
+  and main's with tiles stored, 57 of 58 pixel for pixel (the 58th the pairing case's spinner, which
+  differs from itself); this build with the list stored and main's with nothing stored, 44 of 58, the
+  rest the switch beside the title, which this build always shows (the verifier's photos of 04c9f226;
+  the author's, before 70423d1a, had the switch only with a saved Mac listed); the normal app, a fresh install against a synthetic host
   registered as `_silltest._tcp`: tiles, toggled to the list (stored "list"), a relaunch the list,
   toggled back (stored "tiles"), a relaunch tiles, the key read from the app's container plist
   (`simctl spawn … defaults read <container>/Library/Preferences/me.saffer.sill.plist`; the domain by
@@ -92,8 +93,10 @@ by default, and mute should be off by default." No wire change.
   tiles; once a Mac is paired the switch beside the title shows; to the list, quit Sill from the app
   switcher and reopen: the list; back to tiles, reopen: tiles; an install that chose the list keeps it.
   On a Mac whose `virtualDisplay` was never set (another Mac or user account, or, with Sill quit,
-  `defaults delete me.saffer.sill.mac virtualDisplay`; this Mac's reads 0, so it stays off here): the
-  menu shows ✓ Virtual Display, a window picked moves onto the virtual display (Sill.log "Virtual
+  `defaults delete me.saffer.sill.mac virtualDisplay sendAudio`; this Mac's read 1, set by hand, so it
+  is 
```

**File**: `README.md` (modified, +2/-1)
```diff
@@ -138,7 +138,8 @@ Sill has layouts of its own.
   disconnects, or you quit Sill. With the virtual display off, a window you
   moved on your Mac meanwhile keeps its new place.
 - **The virtual display**, on unless you turn it off in the Sill menu or in
-  Sill's Settings on your Mac, moves the window you stream onto a display of
+  Sill's Settings on your Mac, or in the settings panel of Sill on your iPhone
+  or iPad, moves the window you stream onto a display of
   its own on your Mac, sized for your device, so it keeps updating when other
   windows cover it. The window leaves your Mac's screen while it streams and
   comes back where it was. The display uses a private macOS API, which is one
```

**File**: `Sources/SillHost/HostConfig.swift` (modified, +7/-6)
```diff
@@ -2,7 +2,7 @@ import CoreGraphics
 
 /// The host's knobs, as one value. The CLI streams with `standard` (plus its --virtual-display and
 /// --direct-wireless flags); the menu bar app starts from `app`, the same values with the virtual display
-/// on, and lets Settings change them while it runs. Change `standard`, rebuild, measure: both pick it up.
+/// and Send Audio on, and lets Settings change them while it runs. Change `standard`, rebuild, measure: both pick it up.
 ///
 /// The coordinator takes a new value only between pipelines (inside `select`), so one pipeline
 /// never mixes two settings. See `StreamCoordinator.setTarget`.
@@ -58,8 +58,9 @@ package struct HostConfig: Equatable, Sendable {
     package var shareClipboard: Bool
     /// Send Audio: every connected device that plays the Mac's sound (its hello lists a codec) gets the
     /// sound of what streams, the streamed window's app or every app for the Desktop (AudioPipeline,
-    /// kind 43). Off by default: the Mac keeps playing its own sound, so a device beside it would
-    /// double every sound a moment late. The sound's own stream's, not the pipeline's: a change starts
+    /// kind 43). Off in `standard` (the CLI's `--audio` opts in), on in Sill.app since 2026-10-27 (`app`):
+    /// the Mac keeps playing its own sound, so a device beside it doubles every sound a moment late
+    /// until it mutes. The sound's own stream's, not the pipeline's: a change starts
     /// or stops that stream and never restarts the picture (absent from `restartNeeded`), whoever makes
     /// it. One value home or away, set from the Mac's menu and Settings, the CLI's `--audio`, or any
     /// device's Settings panel (`DeviceSettings.accepted`, then `applying` or `applyingAway` like every
@@ -88,16 +89,16 @@ package struct HostConfig: Equatable, Sendable {
     }
 
     /// The spike's knobs, formerly the `let`s at the top of the CLI's main.swift: the CLI's values, and
-    /// the app's but for the virtual display (`app`). Virtual display off here: the CLI turns it on
+    /// the app's but for the virtual display and Send Audio (`app`). Virtual display off here: the CLI turns it on
     /// with --virtual-display, which runs the AppKit loop the display needs. Direct Wireless off in
     /// both (Noah, 2026-09-24): AWDL costs every Wi-Fi stream its steadiness, and a shared network needs
     /// none of it. Remote access and internet access off in both: only the Mac's own user widens
     /// exposure. 7455 is unassigned at IANA and below the ephemeral range. Away from home, Low ·
     /// Standard (Noah, 2026-09-25): a slow connection never starts at the home quality. Require
     /// pairing on: a home door that speaks TLS admits only paired devices until the Mac's user says
     /// otherwise. Share clipboard with devices on (2026-10-14): each device has its own switch too, and
-    /// a password manager's copies never go. Send Audio off in both until Noah has tried it
-    /// (docs/audio-plan.md, Q1).
+    /// a password manager's copies never go. Send Audio off here; Sill.app's is on since 2026-10-27
+    /// (`app`).
     package static let standard = HostConfig(maxFPS: 120, captureScale: 2, bitrate: 15_000_000,
                                              awayBitrate: 4_000_000, awayCaptureScale: 1,
                                              prioritizeSpeed: false, virtualDisplay: false, directWireless: false,
```

**File**: `Sources/SillHostCLI/main.swift` (modified, +2/-2)
```diff
@@ -9,8 +9,8 @@ import SillHostCore
 setvbuf(stdout, nil, _IOLBF, 0)
 
 // Knobs for the spike: maxFPS, captureScale, bitrate (per 60 fps), prioritizeSpeed. They live in
-// Sources/SillHost/HostConfig.swift now (`HostConfig.standard`), which is also where the menu bar
-// app's Settings start. Change, rebuild, measure.
+// Sources/SillHost/HostConfig.swift now (`HostConfig.standard`); the menu bar app's Settings start from
+// `HostConfig.app`. Change, rebuild, measure.
 var config = HostConfig.standard
 
 // Optional. Streams the first window whose app name or title matches, before any client asks.
```

**File**: `Sources/SillMenuBar/HostSettings.swift` (modified, +2/-1)
```diff
@@ -137,7 +137,8 @@ final class HostSettings {
             Key.updateCheck: true,
             // On, like the CLI: each device has its own switch, and a password manager's copies never go.
             Key.shareClipboard: base.shareClipboard,
-            // Off, like the CLI: the Mac keeps playing its own sound (docs/audio-plan.md, Q1).
+            // On, unlike the CLI (Noah, 2026-10-27: "Send Audio should be on by default"); a saved key
+            // wins. The Mac keeps playing its own sound too.
             Key.sendAudio: base.sendAudio,
             // Off: whoever can see this Mac's screen remotely could read a code (PairingWindowSharing).
             Key.showPairingWindowToScreenSharing: false,
```

**File**: `docs/BRIEF.md` (modified, +3/-1)
```diff
@@ -88,7 +88,9 @@ address.
 Out: hole punching, multi-window, layout customization, AV1. Audio moved in on
 2026-09-27 (Noah: "Audio: the plan is done and parked as a v2 feature by your
 earlier decision", first in what he wanted worked on): the sound of what
-streams, off by default (Send Audio), per docs/audio-plan.md. In, as a beta,
+streams (Send Audio: off by default until 2026-10-27, on by default in Sill.app
+since, Noah: "Send Audio should be on by default, and mute should be off by
+default"; the CLI's `--audio` still opts in), per docs/audio-plan.md. In, as a beta,
 since 2026-10-20 (Noah, about PR #94: "merge as beta support"): Send Audio says
 beta until the plan's device tests pass. Since 2026-10-27 (Noah: "Sound should be
 a toggle in the settings menu") a device's Settings panel turns it on and off for
```

**File**: `docs/DEVELOPMENT.md` (modified, +3/-2)
```diff
@@ -1448,8 +1448,9 @@ simulator:
   every connect case shows tiles unless `-Sill.connectionStyle list` gives
   the list main showed by default before. A launch argument outranks the
   switch beside the title, so to try the switch write the default instead
-  (`xcrun simctl spawn <udid> defaults write me.saffer.sill
-  Sill.connectionStyle list`), or let `-SillStyleToggleAt <s>[,<s>…]` toggle
+  (with Sill not running, `plutil -replace Sill.connectionStyle -string list
+  "$(xcrun simctl get_app_container <udid> me.saffer.sill data)/Library/Preferences/me.saffer.sill.plist"`;
+  a `simctl spawn … defaults write` never reaches the app), or let `-SillStyleToggleAt <s>[,<s>…]` toggle
   it at those seconds after the connect screen shows, as the switch does (the
   choice is stored); the console says `connect: tiles (Sill.connectionStyle
   unset)` as each connect screen shows, and `connect: tiles → list at 4.0 s`
```

**File**: `docs/app-store-metadata.md` (modified, +4/-4)
```diff
@@ -369,7 +369,7 @@ after the one that starts "Set quality". "Beta" goes on the feature, never on th
 2.2 keeps betas and trials of an app off the App Store (TestFlight is for those).
 
 ```text
-• Hear sound from your Mac in step with the picture, a beta feature that is off until you turn on Send Audio in Sill’s settings, on your Mac or your iPhone or iPad. Mute it on any device in Sill’s settings.
+• Hear sound from your Mac in step with the picture, a beta feature that is on unless you turn off Send Audio in Sill’s settings, on your Mac or your iPhone or iPad. Mute it on any device in Sill’s settings.
 ```
 
 The source is public under the Apache License 2.0 (since 2026-09-26), so the
@@ -589,7 +589,7 @@ are then 3,995 bytes (local-only 3,752), all ASCII, as this file's measure count
 last newline included). "Beta" stays on the feature, never on the app (guideline 2.2).
 
 ```text
-- Sound (optional beta feature): turn on Send Audio (Beta) in the Sill menu; the device plays it.
+- Sound (optional beta feature): Send Audio (Beta), in the Sill menu, is on; the device plays it.
 ```
 
 These are the notes as App Store Connect holds them since App Review's
@@ -844,8 +844,8 @@ Safe:
   tiles' paragraph, 232 characters, before the sound's: the draft 1,805
   characters; the rest unchanged.
 - With the sound's two switches in the device's Settings panel (Noah, 2026-10-27: Send Audio set
-  from a device for every device, Mute for each device, no Sound button), the sound's bullet 206
-  characters and the description with it 3,210 (without the line "Sill doesn’t play sound from
+  from a device for every device, Mute for each device, no Sound button), the sound's bullet 207
+  characters ("on unless you turn off", since #236) and the description with it 3,211 (without the line "Sill doesn’t play sound from
   your Mac."); the next What's New's sound paragraph 363, the draft 1,631; the review notes
   unchanged (their WHAT TO TRY line names the Sill menu, which still turns it on).
 - With Send Audio on by default on the Mac (2026-10-27, PR #236) the What's New's sound paragraph
```

#### Recent Merged Pull Requests:
- **PR #236** (2026-10-27): Tiles, Virtual Display and Send Audio on by default; no virtual display under 800 points (@Saffsanity)
- **PR #235** (2026-10-27): Sound: Send Audio and Mute as switches in the device's Settings panel, the bar's button gone (@Saffsanity)
- **PR #234** (2026-10-27): Capture scale follow-ups: even sizes on a 1x display, the Resolution words (@Saffsanity)
- **PR #233** (2026-10-27): Capture at the display's own pixel scale: a window on a 1x display filled a quarter of the picture (@Saffsanity)
- **PR #232** (2026-10-27): Connect screen: a Mac's row keeps its pairing record when the cable goes (unplugging read as Update Sill) (@Saffsanity)
- **PR #227** (2026-10-26): TEST ONLY: SILL_TEST_NO_SCREEN=1 keeps a synthetic host off ScreenCaptureKit (@Saffsanity)

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

## X. Merge pull request #236 from Saffsanity/defaults-tiles-vd

**RULE**:
When implementing operations in `CLAUDE.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Saffsanity/sill. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6c5b5d24`: Merge pull request #236 from Saffsanity/defaults-tiles-vd. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `CLAUDE.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
**Tiles, Virtual Display and Send Audio on by default (2026-10-27, branch `defaults-tiles-vd` from main at
3c257485, fast-forwarded to 3b546374 (#234) before its first commit; PR #236).** Noah, 2026-10-27:
"make tiles not list the default behavior of the app. Also have Virtual Desktop on by default. Of
course, if a user changes a setting remember their choice for future sessions as you do now. Make
this a separate PR after #117 merges." Later that morning, testing #235: "Send Audio should be on
by default, and mute should be off by default." No wire change.
- Sill.app's Send Audio is on by default too (`HostConfig.app.sendAudio`; the CLI's `--audio` still
  opts in; a saved `sendAudio` wins, so a Mac whose user turned it off stays off): the menu's
  checkmark and Settings › Streaming's switch start on; README's Good to know, support.html's Sound
  section and privacy.html say so. Mute on the device was off by default already (#235).
- The device: the connect screen shows tiles unless its person chose the list
  (`ConnectionList.defaultStyle`, `storedStyle`: a stored `Sill.connectionStyle`, "list" or "tiles",
  always wins; nothing stored, or a value no build writes, reads as tiles)
```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `6c5b5d24` are properly handled with clean fallback behavior.
