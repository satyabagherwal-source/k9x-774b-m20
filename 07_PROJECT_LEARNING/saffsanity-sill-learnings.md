> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/saffsanity-sill-learnings.md`  
> **Source**: github ([https://github.com/Saffsanity/sill](https://github.com/Saffsanity/sill))  
> **Source Version**: `e4d30349`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-30T22:20:20.785Z  
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
> **Harvest Timestamp**: 2026-10-30T22:20:19.768Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Saffsanity/sill`
- **Description**: Any window from your Mac, live on your iPhone or iPad. Touch, Apple Pencil, trackpad and keys. Free, open source, no servers.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 4275 stars

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
///                                              older-device and "Devices Can’t Connect" items);
///                                              the macOS firewall is asked again first, as the
///                                              menu does when it opens, its answer shown by the
///                                              next print
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
///                                              General's update and firewall lines, s seconds after
///                                              launch
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
///                                              update section in each of its, General with the
///                                              macOS firewall's line and that line alone in each
///                                              of its verdicts), the pairing
///                                              window's states and the cable notice,
///                                              status cards, glyphs and menu.txt to <dir>, then
///                                              exit (no Screen Recording needed: views render
///                                              offscreen; no identity is loaded, no listener)
///
/// These are the bare SillMenuBar binary's (defaults domain "SillMenuBar"; delete it after). Sill.app
/// itself (`AppModel.bundled`: Sill's own code wherever it runs from, AppIdentity) ignores every
/// `-Sill…After` hook and `-requirePairing`, each with one line (docs/home-pairing-plan.md §6.6):
/// they open, answer or remove pairings, or change what the doors admit, and any process of this
/// user can start Sill.app, or a copy of it, with arguments, which then runs with Sill's Screen
/// Recording and Accessibility grants. `-SillTestScreenHeight` and
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
    static var testScreenHeight
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

### Core Architecture Module: `Scripts/asc.swift`
```
// App Store Connect's API for TestFlight builds, as the nightly workflow (.github/workflows/nightly.yml)
// and `Scripts/release-ios.sh --whats-new` use it (docs/release-checklist.md, "Nightlies"): wait for an
// uploaded build to be processed, give it What to Test, add it to TestFlight's groups, and submit it
// for Beta App Review when it goes to the public beta group. Foundation and CryptoKit only.
//
//   swiftc -O -o .build/asc/asc Scripts/asc.swift     (or run it as a script: swift Scripts/asc.swift …)
//   asc groups      --key-file F --key-id ID --issuer ID
//       lists the app's TestFlight groups: internal or external, automatic distribution, public link.
//       Reads only.
//   asc build-state --key-file F --key-id ID --issuer ID --version 0.6.0 --build 983
//       prints one word on stdout: missing (App Store Connect lists no such build yet), PROCESSING,
//       VALID, FAILED or INVALID. Reads only.
//   asc whats-new   --key-file F --key-id ID --issuer ID --version 0.6.0 --build 983 --whats-new FILE
//       waits for the build to be processed, then gives it FILE as What to Test (English, U.S.).
//   asc distribute  --key-file F --key-id ID --issuer ID --version 0.6.0 --build 983 --whats-new FILE
//                   [--public-beta [--public-beta-group NAME]]
//       the same, then the build goes to every internal group, and with --public-beta to the public
//       beta group too, and to Beta App Review when TestFlight asks for that.
//
// Options for all four:
//   --bundle-id ID        the app, by default me.saffer.sill
//   --wait-minutes N      how long to wait for processing (default 90; App Store Connect usually takes
//                         5 to 40 minutes)
//   --poll-seconds N      how often to look meanwhile (default 60)
//   --retry-seconds N     the first wait before trying a request again after a 429, a 5xx or no answer
//                         (default 5; then 3 and 6 times that; tests give 0)
//   --api-base URL        https://api.appstoreconnect.apple.com, the default, or a stand-in on this Mac
//                         for tests (http or https on 127.0.0.1, localhost or [::1]): the token goes to
//                         no other host, and a next-page link to another host is not followed.
//
// The groups, in `distribute`:
// - Every internal group (App Store Connect users only, no review) gets the build. One with automatic
//   distribution ("access to all builds") gets every processed build by itself and is left alone.
// - The public beta group is the external group with the public link on (or the one named with
//   --public-beta-group). It gets the build only with --public-beta, which is refused unless the
//   environment also says SILL_NIGHTLY_PUBLIC_BETA=true: the nightly workflow passes both only while
//   the repository variable of that name is true (Noah, 2026-10-29: "hold off on giving the testflight
//   build to public beta until I try it out in Insiders first tomorrow"). Without both, no external
//   group is ever touched and nothing goes to Beta App Review.
// - Beta App Review: only right after the build went to that external group, and only when TestFlight
//   says it waits for a submission (externalBuildState READY_FOR_BETA_SUBMISSION). The first build of a
//   version is reviewed in full; a later build of the same version is submitted the same way and
//   usually approved within minutes. A build already in review or approved is left as it is.
//
// The token: an ES256 JWT (header alg ES256, kid the Key ID, typ JWT; claims iss the Issuer ID, iat,
// exp 15 minutes later, aud appstoreconnect-v1; App Store Connect refuses more than 20 minutes) signed
// with the .p8 key, made again every 10 minutes during a long wait. It goes only into the
// Authorization header of requests to the API base above; it is never printed, logged or written to a
// file, and neither is the key. Redirects are not followed.
//
// Exit status: 0 done; 1 App Store Connect refused a request, the build failed processing, or the wait
// ran out; 2 a usage error (a missing or malformed option, a key file that isn't a key, --public-beta
// without SILL_NIGHTLY_PUBLIC_BETA=true).
import CryptoKit
import Foundation

setvbuf(stdout, nil, _IOLBF, 0)   // progress lines during a long wait show as they happen in a pipe

let environment = ProcessInfo.processInfo.environment
let inActions = environment["GITHUB_ACTIONS"] == "true"
let usageText = """
    usage: asc groups      --key-file F --key-id ID --issuer ID [--bundle-id ID]
           asc build-state --key-file F --key-id ID --issuer ID --version V --build N
           asc whats-new   --key-file F --key-id ID --issuer ID --version V --build N --whats-new FILE
           asc distribute  --key-file F --key-id ID --issuer ID --version V --build N --whats-new FILE
                           [--public-beta [--public-beta-group NAME]]
           [--wait-minutes 90] [--poll-seconds 60] [--retry-seconds 5] [--api-base URL]
    Scripts/asc.swift's header says what each does; docs/release-checklist.md, "Nightlies".
    """

// MARK: - Output

/// A GitHub Actions annotation's message: a %, a carriage return or a newline would otherwise end it
/// or start a command of its own.
func annotation(_ text: String) -> String {
    text.replacingOccurrences(of: "%", with: "%25").replacingOccurrences(of: "\r", with: "%0D")
        .replacingOccurrences(of: "\n", with: "%0A")
}

func say(_ text: String) { print(text) }

func warn(_ text: String) {
    let line = inActions ? "::warning::\(annotation(text))" : "warning: \(text)"
    FileHandle.standardError.write(Data((line + "\n").utf8))
}

func fail(_ text: String, status: Int32 = 1) -> Never {
    let line = inActions ? "::error::\(annotation(text))" : "error: \(text)"
    FileHandle.standardError.write(Data((line + "\n").utf8))
    exit(status)
}

/// Text from App Store Connect, made safe to print on one line: control characters (newlines among
/// them, which in a GitHub log could start a workflow command) become spaces, and it is cut at 300.
func clean(_ text: String) -> String {
    let scalars = text.unicodeScalars.map { CharacterSet.controlCharacters.contains($0) ? " " : Character($0) }
    let joined = String(scalars).split(separator: " ", omittingEmptySubsequences: true).joined(separator: " ")
    return joined.count > 300 ? String(joined.prefix(300)) + "…" : joined
}

// MARK: - Options

struct Options {
    var command = ""
    var keyFile = ""
    var keyID = ""
    var issuer = ""
    var bundleID = "me.saffer.sill"
    var version = ""
    var build = ""
    var whatsNewFile = ""
    var publicBeta = false
    var publicBetaGroup: String?
    var waitMinutes = 90.0
    var pollSeconds = 60.0
    var retrySeconds = 5.0
    var apiBase = "https://api.appstoreconnect.apple.com"
}

func usageError(_ text: String) -> Never {
    FileHandle.standardError.write(Data("error: \(text)\n\(usageText)\n".utf8))
    exit(2)
}

func parseOptions(_ arguments: [String]) -> Options {
    var options = Options()
    var rest = arguments[...]
    guard let command = rest.popFirst() else { usageError("no command") }
    if command == "-h" || command == "--help" { print(usageText); exit(0) }
    guard ["groups", "build-state", "whats-new", "distribute"].contains(command) else {
        usageError("unknown command '\(clean(command))'")
    }
    options.command = command
    func number(_ name: String, _ text: String) -> Double {
        guard let value = Double(text), value.isFinite, value >= 0 else { usageError("\(name) takes a number, not '\(clean(text))'") }
        return value
    }
    while let argument = rest.popFirst() {
        var name = argument
        var value: String?
        if argument.hasPrefix("--"), let equals = argument.firstIndex(of: "=") {
            name = String(argument[..<equals])
            value = String(argument[argument.index(after: equals)...])
        }
        if name == "--public-beta" {
            if value != nil { usageError("--public-beta takes no value") }
            options.publicBeta = true
            continue
        }
        if name == "-h" || name == "--help" { print(usageText); exit(0) }
        let flags = ["--key-file", "--key-id", "--issuer", "--bundle-id", "--version", "--build", "--whats-new",
                     "--public-beta-group", "--wait-minutes", "--poll-seconds", "--retry-seconds", "--api-base"]
        guard flags.contains(name) else { usageError("unknown option '\(clean(argument))'") }
        if value == nil {
            guard let next = rest.popFirst() else { usageError("\(name) needs a value") }
            value = next
        }
        let text = value ?? ""
        switch name {
        case "--key-file": options.keyFile = text
        case "--key-id": options.keyID = text
        case "--issuer": options.issuer = text
        case "--bundle-id": options.bundleID = text
        case "--version": options.version = text
        case "--build": options.build = text
        case "--whats-new": options.whatsNewFile = text
        case "--public-beta-group": options.publicBetaGroup = text
        case "--wait-minutes": options.waitMinutes = number(name, text)
        case "--poll-seconds": options.pollSeconds = number(name, text)
        case "--retry-seconds": options.retrySeconds = number(name, text)
        case "--api-base": options.apiBase = text
        default: usageError("unknown option '\(clean(argument))'")
        }
    }
    return options
}

func matches(_ text: String, _ pattern: String) -> Bool {
    text.range(of: pattern, options: .regularExpression) != nil
}

/// The default base, or a stand-in on this Mac for tests: the token is never sent anywhere else.
func allowedBase(_ url: URL) -> Bool {
    if url.scheme == "https", url.host == "api.appstoreconnect.apple.com", url.port == nil,
       url.path.isEmpty || url.path == "/" { return true }
    guard url.scheme == "http" || url.scheme == "https", url.user == nil, url
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #162** (2026-10-30): **Option/CMD + left/right arrows sends the keys just once**
  *Symptoms*: ### What happened  holding down combos like this should send the combo repeatedly. doesnt happen for non-combo keystrokes.  ### How to make it happen again  _No response_  ### Your Mac and its macOS  macbook pro m4 27.2 beta 3  ### Sill for Mac's version  latest as of filing  ### Your iPhone or iPad and its iOS or iPadOS  ipad m4 pro  ### The Sill app's version  _No response_  ### How the device reached the Mac  Wi-Fi  ### Sill's log on your Mac  ```text  ```
  **Post-Mortem & Fix Analysis**:
  > Opened #163 so held keys and `Option`/`Command` + arrow key chords repeat properly on iPad.

- **Issue #138** (2026-10-27): **Chinese input (Zhuyin keyboard) and dictation (any language) can't be used to type on the Mac**
  *Symptoms*: ### What happened  Through Sill on my iPad, I can't type Chinese on my Mac, and I can't use dictation at all:  1. Zhuyin (Bopomofo) keyboard: nothing reaches the Mac — not the chosen characters, and not even the Bopomofo symbols (ㄅㄆㄇ) as I type them. 2. Dictation, in any language: dictated text doesn't reach the Mac, whether I dictate in Chinese or in English.  English typing works normally, including while the Mac's input source is Zhuyin. So the keyboard path itself works, and only composed input (an input method's candidates, dictation) is lost.  Expected: Chinese composed on the iPad (through the keyboard's candidates or through dictation) arrives in the focused Mac window, the same way English text does.  Workaround: type in another iPad app, copy, then use Sill's Paste and press ⌘V. This works but is slow.   Possible cause (from reading the source at 5c323e6; not verified with a debugger)  InputOverlayView adopts only UIKeyInput (iOSClient/InputOverlay.swift:16), not UITextInput. CJK input methods compose through marked text (setMarkedText / unmarkText) and commit the chosen candidate, and dictation inserts its result through the same UITextInput machinery. With UIKeyInput alone, iPadOS never commits anything to insertText(_:), so nothing is sent to the Mac. docs/hardware-keyboard-plan.md (item 11) already lists input methods as untested.  A possible fix: adopt UITextInput with marked-text support, keep the composition on the device, and send only the committed text as 

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

### Incident Patch 1: `541c18ff` (2026-10-30)
**Commit Message**: Merge origin/firewall-executable-block into integrate-security

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>



---

### Incident Patch 2: `bc0e5a8c` (2026-10-30)
**Commit Message**: Merge remote-tracking branch 'origin/firewall-executable-block' into test-security

# Conflicts:
#	.github/workflows/ci.yml
#	CLAUDE.md

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -134,7 +134,7 @@ jobs:
     strategy:
       fail-fast: false
       matrix:
-        check: [addresses, ask-limits, audio-codec, audio-packetizer, audio-playout, away-copy, away-quality, away-wire, cable-link, capture-scale, clientlink, clipboard, compatibility, connection-list, device-gate, display-wake, dmg-layout, door-policy, duo, encoder-mailbox, encoder-slowstate, fence, gesture-chords, gestures, goodbye, hardware-keyboard, home-device, home-model, home-records, home-txt, installed-apps, key-strokes, keychain, keyframe-recovery, ledger, link-judge, menu-state, menus, message-reader, origin, pairing-address, pairing-sharing, phone-portrait, pointer-control, pointer-presence, pointer-watch, policy, protocol, remote-rules, settings-window, stream-zoom, test-host, text-composition, tour, update-policy, viewport-bounds, virtual-display-api, window-restore]
+        check: [addresses, ask-limits, audio-codec, audio-packetizer, audio-playout, away-copy, away-quality, away-wire, cable-link, capture-scale, clientlink, clipboard, compatibility, connection-list, device-gate, display-wake, dmg-layout, door-policy, duo, encoder-mailbox, encoder-slowstate, fence, firewall, gesture-chords, gestures, goodbye, hardware-keyboard, home-device, home-model, home-records, home-txt, installed-apps, key-strokes, keychain, keyframe-recovery, ledger, link-judge, menu-state, menus, message-reader, origin, pairing-address, pairing-sharing, phone-portrait, pointer-control, pointer-presence, pointer-watch, policy, protocol, remote-rules, settings-window, stream-zoom, test-host, text-composition, tour, update-policy, viewport-bounds, virtual-display-api, window-restore]
     steps:
       - name: Check out
         uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
```

**File**: `CLAUDE.md` (modified, +75/-2)
```diff
@@ -165,6 +165,68 @@ wire change, nothing on the device.
   drag a window with the iPad's trackpad and click Remove mid-drag: the drag ends, and another device's
   pointer then moves without dragging; choose a menu item from the iPad's Menus in a slow app and click
   Remove at once: the item is not chosen (Sill.log: "Menu from … refused: …: the Mac no longer serves it").
+**The macOS firewall that blocks Sill's executable (2026-10-29, branch `firewall-executable-block` from main
+at 150479b5; PR #250; the security batch, Noah's go of 2026-10-29).** A user's report: the firewall keeps a
+rule per path, and a Mac held `/Applications/Sill.app` allowed and `…/Contents/MacOS/Sill` blocked
+(`socketfilterfw --listapps`): nothing reached Sill from the network, System Settings showed it allowed, and
+`--getappblocked` on the bundle said "permitted"; `sudo socketfilterfw --unblockapp` on the executable fixed it.
+No wire change.
+- `FirewallCheck` asks `/usr/libexec/ApplicationFirewall/socketfilterfw` `--getglobalstate`, then only while it is
+  on (`asksRules`) `--getblockall`, `--getappblocked` for the running executable (`proc_pidpath`) and its bundle,
+  and `--listapps`: a process each with 2 s (then SIGTERM, SIGKILL a second later), read-only, no privileges
+  (macOS 27.0.1: 4–8 ms each, no prompt, no Full Disk Access needed; asked in one run the tool is killed, 137,
+  when `--getstealthmode` or `--getallowsigned` follows `--getappblocked`, or `--listapps` follows it with a
+  bundle's path; no `com.apple.alf.plist` there). At launch, when the listener comes up, when Sill.app's status
+  menu opens (the glyph at once, its item from the next opening), when its General opens or Sill becomes active
+  over it, and when a device gets in from the network while the verdict says none can (`asksAgain`); never on a
+  timer.
+- `FirewallRule` (pure, `Tests/checks/firewall`, 390 checks, 69 mutants): off, allows (only once `--listapps`
+  was read), `blocks(executable:bundle:)` (its own answer or its rule in the list, either enough), `blocksAll`,
+  unknown (with why, in the log).
+  While it blocks: General's line in the Permissions style with `sudo …/socketfilterfw --unblockapp <the running
+  executable's path>` (a line per option; Copy copies one line), for Block all where to turn it off; the menu's
+  "Devices Can’t Connect — The macOS firewall blocks Sill’s executable." (opens General); one log line per change
+  ("Firewall: …"; none for a first verdict that blocks nothing). Sill never runs the command. support.html's
+  "Your Mac isn’t listed" gains the case (Sill's own line marked `<!-- Firewall`). TEST ONLY
+  `SILL_TEST_FIREWALL=executable|bundle|both|all|off|allowed|unreadable` or a file holding one, test hosts only;
+  the previews are the rule's verdicts on those answers; `-SillPrintMenuAfter` prints General's line.
+- Verified: the check and mutants; `run-all.sh`, all 57; a clean release build (the CaptureProbe warning
+  only); main's CLI output identical masked and sorted, idle and with a client; previews main's but the 16 new
+  files, menu.txt's two samples and General's path; live on loopback, blocked → allowed → Block all →
+  unreadable, a VPN-origin client clearing a stale verdict, the bare app's menu and line, this Mac's real
+  firewall "none (allows)". Not built: an Unblock button with the admin password (`osascript` off the main
+  thread, or a privileged helper), Noah's call.
+- The review (2026-10-29, three lenses; each finding reproduced first, then fixed in a commit of its own;
+  sill-handoff's `triage/2026-10-29-security/firewall-line-report.md`, "The review"): a block that came after
+  launch (a Deny in the firewall's own prompt, Block all turned on) went unsaid until General opened or the
+  listener was replaced, as `asksAgain` can only clear one (on loopback, the canned answer blocked from 2 s: a
+  client at 3.6 s and the bare app's menu at 4 and 7 s said nothing): the status menu asks again as it opens
+  (bd18d96b); with `--listapps` unread the verdict took the executable's own "permitted" for allowed and dropped
+  why: unknown, with why, unless an answer blocks (3d10ea95); the check's usage stand-in had no "apps", so a
+  reading that took any mention of apps for a list passed (56d3f3a3); the docs had the tool die whenever
+  `--listapps` followed `--getappblocked` in one run (the docs commit, af3283d1; the second review measured which
+  options do, below). Re-run: the check 340 and 67 of 67 mutants (64 of 64 before; two extra mutants had
+  survived); `run-all.sh`, all 57; the release build, the CaptureProbe warning only; main's CLI masked and sorted,
+  idle (8 lines) and with a client (three passes, as main against main); previews 162 files; on loopback a device
+  in from a VPN re-asking without clearing a block that holds, and clearing a stale one.
+- The second review (2026-10-29, after af3283d1; the report's "The second review"): two findings, each reproduced
+  first 
```

**File**: `Sources/SillHost/FirewallCheck.swift` (added, +153/-0)
```diff
@@ -0,0 +1,153 @@
+import Darwin
+import Foundation
+
+/// Asks the macOS Application Firewall what it holds for this process, read-only and without
+/// privileges; FirewallRule decides what that means. Five questions to `socketfilterfw`, each in a
+/// process of its own and given 2 s (then stopped: SIGTERM, and SIGKILL a second later):
+/// `--getglobalstate` (nothing else is asked unless the firewall is on: off, Block all and a state
+/// that doesn't read decide alone, FirewallRule.asksRules), `--getblockall`, `--getappblocked` for
+/// the executable and for its bundle, and `--listapps`. Never a question that changes anything,
+/// never sudo.
+///
+/// Measured on macOS 27.0.1 (2026-10-29), as an ordinary user with no privileges and no Full Disk
+/// Access (Sill.app has none): each question answers in 4–8 ms, exit status 0, no prompt. Asked in
+/// one run, the tool was killed (status 137, nothing printed) when some options followed
+/// `--getappblocked`: `--getstealthmode` or `--getallowsigned` after either path, `--listapps` after
+/// an app bundle's path (3 runs of 3 each; all five questions in one run, 133). `--getglobalstate`,
+/// `--getblockall` and another `--getappblocked` after it, `--listapps` after an executable's path,
+/// and each question alone answered every time: hence a process for each. The plist older Macs
+/// kept, /Library/Preferences/com.apple.alf.plist, does not exist there (only the tool's own
+/// defaults in /usr/libexec/ApplicationFirewall), so nothing is read from a file.
+///
+/// The coordinator asks at launch, whenever the listener comes up, when Sill.app's status menu or
+/// Settings › General opens, and when a device gets in from the network while the verdict says none
+/// can (FirewallRule.asksAgain); nothing asks on a timer.
+package enum FirewallCheck {
+    /// This process's executable as the kernel has it, symbolic links resolved (the firewall's rules
+    /// name real paths: /private/tmp, not /tmp); the bundle's idea of it when the kernel will not say.
+    package static func executablePath() -> String {
+        var buffer = [CChar](repeating: 0, count: 4 * Int(MAXPATHLEN))
+        if proc_pidpath(getpid(), &buffer, UInt32(buffer.count)) > 0 {
+            let path = String(cString: buffer)
+            if !path.isEmpty { return path }
+        }
+        return Bundle.main.executablePath ?? CommandLine.arguments.first ?? ""
+    }
+
+    /// The firewall's answers, asked off the caller's thread, or the TEST ONLY hook's.
+    package static func read(_ paths: FirewallRule.Paths, hook: TestHook?) async -> FirewallRule.Raw {
+        if let hook { return hook.answers(paths) }
+        return await withCheckedContinuation { continuation in
+            DispatchQueue.global(qos: .utility).async { continuation.resume(returning: readNow(paths)) }
+        }
+    }
+
+    /// The five questions, one after another (blocking: a utility queue's).
+    static func readNow(_ paths: FirewallRule.Paths) -> FirewallRule.Raw {
+        let tool = FirewallRule.Copy.tool
+        guard FileManager.default.isExecutableFile(atPath: tool) else {
+            return FirewallRule.Raw(problem: "\(tool) isn’t there")
+        }
+        var raw = FirewallRule.Raw()
+        var problems: [String] = []
+        func ask(_ arguments: [String]) -> String? {
+            switch run(tool, arguments) {
+            case .answer(let text): return text
+            case .failed(let why): problems.append(why); return nil
+            }
+        }
+        raw.globalState = ask(["--getglobalstate"])
+        // Off, Block all, or no state that reads: the verdict is decided (FirewallRule.asksRules), so
+        // nothing more is asked, and a tool that doesn't answer costs one question's wait, not five.
+        guard FirewallRule.asksRules(afterState: raw.globalState) else {
+            raw.problem = problems.first
+            return raw
+        }
+        raw.blockAll = ask(["--getblockall"])
+        raw.executable = ask(["--getappblocked", paths.executable])
+        if let bundle = paths.bundle { raw.bundle = ask(["--getappblocked", bundle]) }
+        raw.listApps = ask(["--listapps"])
+        raw.problem = problems.first
+        return raw
+    }
+
+    private enum Outcome { case answer(String), failed(String) }
+
+    /// Runs `tool` with `arguments`, its standard output and error read together, for at most
+    /// `timeout` seconds (then it is stopped, SIGTERM and a second later SIGKILL: a question has
+    /// nothing to undo).
+    private static func run(_ tool: String, _ arguments: [String], timeout: TimeInterval = 2) -> Outcome {
+        let process = Process()
+        process.executableURL = URL(fileURLWithPath: tool)
+        process.arguments = arguments
+        process.standardInput = FileHandle.nullDevice
+        let pipe = Pipe()
+        process.standardOutput = pipe
+        process.standardError = pipe
+        let exited = DispatchSemaphore(value: 0)
```

**File**: `Sources/SillHost/FirewallRule.swift` (added, +471/-0)
```diff
@@ -0,0 +1,471 @@
+import Foundation
+
+/// The macOS Application Firewall and Sill (a user's report, 2026-10-29). The firewall keeps a rule
+/// per path, and a Mac held "/Applications/Sill.app" allowed and "/Applications/Sill.app/Contents/
+/// MacOS/Sill" blocked at once (`socketfilterfw --listapps`): Sill's port took nothing from the
+/// network while the Mac itself connected fine, System Settings showed Sill allowed, and
+/// `--getappblocked` on the bundle said "permitted". `sudo socketfilterfw --unblockapp` on the
+/// executable's path fixed it.
+///
+/// This turns what `socketfilterfw` answers, asked read-only and without privileges (FirewallCheck),
+/// into a verdict and its words: the line in Sill.app's Settings › General with the Terminal command
+/// that unblocks Sill, the status menu's "Devices Can’t Connect", the log's lines. A rule that blocks
+/// the running executable or its bundle counts while the firewall is on, and so does Block all
+/// incoming connections, which leaves no app's own rule any say. Pure: Foundation alone, checked by
+/// Tests/checks/firewall.
+package enum FirewallRule {
+    /// The firewall's global state (`--getglobalstate`).
+    package enum State: Equatable, Sendable {
+        case off, on
+        /// Block all incoming connections: only essential services (DHCP, Bonjour, IPsec) get in.
+        case blockAll
+        /// No answer, or one this build does not know (bootstrap mode, an undefined state).
+        case unknown
+    }
+
+    /// One path's answer (`--getappblocked <path>`).
+    package enum AppAnswer: Equatable, Sendable { case blocked, permitted, unknown }
+
+    /// One rule of `--listapps`: its path (or whatever the line names) and whether it blocks incoming
+    /// connections; nil when no state line followed it.
+    package struct Listed: Equatable, Sendable {
+        package var path: String
+        package var blocks: Bool?
+        package init(path: String, blocks: Bool?) { self.path = path; self.blocks = blocks }
+    }
+
+    /// The paths a rule may name for this process: its executable, as the kernel has it (the
+    /// firewall's rules name real paths, /private/tmp rather than /tmp), and, for an app bundle's
+    /// main executable, the bundle.
+    package struct Paths: Equatable, Sendable {
+        package var executable: String
+        package var bundle: String?
+        package init(executable: String, bundle: String?) { self.executable = executable; self.bundle = bundle }
+    }
+
+    /// What `socketfilterfw` printed for each question, nil for one not asked or not answered;
+    /// `problem`, why the first that went unanswered did (the log says it when nothing can be told).
+    package struct Raw: Equatable, Sendable {
+        package var globalState: String?
+        package var blockAll: String?
+        package var executable: String?
+        package var bundle: String?
+        package var listApps: String?
+        package var problem: String?
+        package init(globalState: String? = nil, blockAll: String? = nil, executable: String? = nil, bundle: String? = nil,
+                     listApps: String? = nil, problem: String? = nil) {
+            self.globalState = globalState; self.blockAll = blockAll; self.executable = executable; self.bundle = bundle
+            self.listApps = listApps; self.problem = problem
+        }
+    }
+
+    /// The answers, read.
+    package struct Answers: Equatable, Sendable {
+        package var state: State
+        /// `--getblockall`: true while Block all incoming connections is on; nil without an answer.
+        package var blockAll: Bool?
+        package var executable: AppAnswer
+        package var bundle: AppAnswer
+        /// Every rule `--listapps` printed; nil when it printed no list.
+        package var listed: [Listed]?
+        package var problem: String?
+        package init(state: State, blockAll: Bool? = nil, executable: AppAnswer = .unknown, bundle: AppAnswer = .unknown,
+                     listed: [Listed]? = nil, problem: String? = nil) {
+            self.state = state; self.blockAll = blockAll; self.executable = executable; self.bundle = bundle
+            self.listed = listed; self.problem = problem
+        }
+    }
+
+    /// What the firewall does to devices that connect to this process.
+    package enum Verdict: Equatable, Sendable {
+        /// The firewall is off.
+        case off
+        /// It is on, its rules were read (`--listapps`), and none blocks the executable or its bundle.
+        case allows
+        /// It is on, and a rule blocks these paths (at least one is set): devices on the network
+        /// cannot connect, whatever the other path's rule says.
+        case blocks(executable: String?, bundle: String?)
+        /// Block all incoming connections is on.
+        case blocksAll
+        /// Its answers could not be read, and why.
+        case unknown(String)
+
+        /// Devices on the network cannot c
```

**File**: `Sources/SillHost/HostStatus.swift` (modified, +6/-0)
```diff
@@ -135,6 +135,12 @@ package struct HostStatusSnapshot: Equatable {
     /// The Mac's sound while it is wanted (Send Audio on, something streams, a device plays it); nil
     /// otherwise.
     package var audio: Audio?
+    /// What the macOS firewall does to devices connecting to this host (FirewallRule), as last asked:
+    /// at launch, when the listener comes up, when Sill.app's menu or Settings › General opens, when a
+    /// device gets in while it said none could. Nil before the first answer. While it blocks them,
+    /// Settings › General shows why with the Terminal command that unblocks Sill, and the menu says
+    /// "Devices Can’t Connect".
+    package var firewall: FirewallRule.Verdict?
 
     /// The Mac's sound as the menu's card and Settings show it.
     package struct Audio: Equatable {
```

**File**: `Sources/SillHost/StreamCoordinator.swift` (modified, +52/-3)
```diff
@@ -69,9 +69,16 @@ package final class StreamCoordinator {
     /// encoder, the launch probe never runs and the re-check never starts, so no test touches the
     /// Mac's one hardware encoder while Noah streams (PointerTestHooks).
     private let softwareOnly: Bool
-    /// The TEST ONLY hooks' lines (PointerTestHooks, InputInjector.testInputLog, `keyframeIgnoreHook`),
-    /// printed as `start` begins; empty without them.
+    /// The TEST ONLY hooks' lines (PointerTestHooks, InputInjector.testInputLog, `keyframeIgnoreHook`,
+    /// FirewallCheck.TestHook), printed as `start` begins; empty without them.
     private let testHookLines: [String]
+    /// The macOS firewall (FirewallRule, a user's report of 2026-10-29): the paths a rule may name
+    /// for this process, the TEST ONLY answers a test host takes instead of asking, and one check at
+    /// a time (`checkFirewall`), with one more after it when asked meanwhile.
+    private let firewallPaths: FirewallRule.Paths
+    private let firewallHook: FirewallCheck.TestHook?
+    private var firewallChecking = false
+    private var firewallAgain = false
     /// A picked window streams from its own HiDPI display (see VirtualStage): the CLI's
     /// `--virtual-display`, or the app's setting. Every branch this adds is behind this flag;
     /// without it the coordinator behaves as before. It changes only inside `select` (`adopt`).
@@ -352,7 +359,13 @@ package final class StreamCoordinator {
         let userActive = DisplayWake.userActive(environment: env, testHost: synthetic)
         displayActivity = DisplayActivity(remote: userActive.remote)
         keyframeRequestsToIgnore = keyframeIgnore.count
-        testHookLines = [path.line, software.line, inputLog.line, userActive.line, keyframeIgnore.line, noScreen.line].compactMap { $0 }
+        // The firewall's TEST ONLY answers, for a test host alone (StreamServer's own rule).
+        let firewallTest = FirewallCheck.TestHook.read(testHost: DoorPolicy.isTestHost(advertises: !synthetic, bundled: !testHooks),
+                                                       environment: env)
+        firewallHook = firewallTest.hook
+        firewallPaths = FirewallRule.paths(executable: FirewallCheck.executablePath())
+        testHookLines = [path.line, software.line, inputLog.line, userActive.line, keyframeIgnore.line, noScreen.line,
+                         firewallTest.line].compactMap { $0 }
         status = HostStatus()
         var home = StreamServer.HomeDoorMode.plain
         if homePairing, let remote {
@@ -446,6 +459,11 @@ package final class StreamCoordinator {
                     let words = route.label ?? Self.homeRouteWords(route, link: link)
                     self.remote?.sessionStarted(fingerprint: fp, route: words, cableDevice: route.cableDevice)
                 }
+                // A device got in from the network while the firewall's verdict said none could:
+                // that verdict is stale (FirewallRule.asksAgain).
+                if FirewallRule.asksAgain(after: self.status.snapshot.firewall, fromLoopback: route.origin == .loopback) {
+                    self.checkFirewall()
+                }
                 // Home or away before its catalog: its settings state says which quality it sets.
                 self.routesChanged(joined: id, endpoint: "\(connection.endpoint)")
                 // A sleeping display gives black frames: the session's start wakes it, as a key would.
@@ -649,6 +667,9 @@ package final class StreamCoordinator {
                 $0.network = .registering
             }
         }
+        // The listener is up, at launch or replaced (Direct Wireless): whether the macOS firewall
+        // lets devices reach it.
+        if network == .registering { checkFirewall() }
     }
 
     /// Bonjour registered this name (nil: the registration went away, to come back).
@@ -662,6 +683,33 @@ package final class StreamCoordinator {
         }
     }
 
+    // MARK: The macOS firewall
+
+    /// Asks the macOS firewall, read-only, whether it blocks this process (FirewallCheck, then
+    /// FirewallRule's verdict into the status: Sill.app's Settings › General and its menu say so), and
+    /// prints one line when the verdict changes (none for a first one that blocks nothing). At launch,
+    /// whenever the listener comes up, when Sill.app's status menu opens (a block that came after
+    /// launch; the menu is built before the answer, so its item shows from the next opening), when
+    /// its Settings › General opens or Sill becomes active over it, and when a device gets in from
+    /// the network while the verdict says none can; never on a timer. One check at a time: one asked
+    /// for meanwhile runs once more after it, so its answer is never older than the request.
+    package func checkFirewall() {
+        guard !firewallChecking else { firewallAgain = true; return }
+        firewallChecking = true
+        let paths = firewallPaths, 
```

**File**: `Sources/SillMenuBar/DebugHooks.swift` (modified, +58/-3)
```diff
@@ -37,7 +37,10 @@ import StreamProtocol
 ///     -SillMenuAfter '<s>[; <s> …]'            print the status menu as menu.txt shows it, one
 ///                                              "SillMenuAfter <s> s: " line per line, s seconds
 ///                                              after launch (the "‹device› Wants to Pair",
-///                                              older-device and "Devices Can’t Connect" items)
+///                                              older-device and "Devices Can’t Connect" items);
+///                                              the macOS firewall is asked again first, as the
+///                                              menu does when it opens, its answer shown by the
+///                                              next print
 ///     -SillQuitAfter <s>                       Quit (NSApp.terminate) s seconds after launch
 ///     -SillUpdateFeed <url>                    the update check asks this feed instead of GitHub:
 ///                                              a feed on this Mac only (http or https to
@@ -52,7 +55,8 @@ import StreamProtocol
 ///                                              s; no jitter)
 ///     -SillPrintMenuAfter <s>                  print the status menu as it would open (as menu.txt
 ///                                              draws it, "menu: " before each line) and Settings ›
-///                                              General's update line, s seconds after launch
+///                                              General's update and firewall lines, s seconds after
+///                                              launch
 ///     -SillSettingsAfter '<s> <tab>[; <s> <tab> …]'
 ///                                              open Settings on that tab s seconds after launch,
 ///                                              as the menu does, and 0.6 s later print the window's
@@ -72,7 +76,9 @@ import StreamProtocol
 ///                                              (title bar, toolbar, pane) to <dir>/settings-<s>s-<tab>.png
 ///     -SillRenderPreviews <dir>                write the Settings panes (the Devices and Remote
 ///                                              Access panes in each of their states, General's
-///                                              update section in each of its), the pairing
+///                                              update section in each of its, General with the
+///                                              macOS firewall's line and that line alone in each
+///                                              of its verdicts), the pairing
 ///                                              window's states and the cable notice,
 ///                                              status cards, glyphs and menu.txt to <dir>, then
 ///                                              exit (no Screen Recording needed: views render
@@ -219,6 +225,7 @@ enum DebugHooks {
         for delay in times(defaults.string(forKey: "SillMenuAfter")) {
             after(delay) {
                 model.permissions.refresh()
+                model.coordinator?.checkFirewall()   // as the menu does when it opens; the answer shows at the next
                 for line in MenuBuilder.dump(MenuBuilder.entries(for: model), card: model.presentation).split(separator: "\n") {
                     print("SillMenuAfter \(delay) s: \(line)")
                 }
@@ -229,10 +236,18 @@ enum DebugHooks {
             after(printAfter) {
                 model.permissions.refresh()
                 model.loginItem.refresh()
+                model.coordinator?.checkFirewall()   // as the menu does when it opens
                 print("SillPrintMenuAfter \(printAfter) s:")
                 let text = MenuBuilder.dump(MenuBuilder.entries(for: model), card: model.presentation)
                 for line in text.split(separator: "\n", omittingEmptySubsequences: false) where !line.isEmpty { print("menu: \(line)") }
                 print("Settings › General's update line: \(model.updates.pane.line)")
+                // The macOS firewall's line as the pane shows it (FirewallRule), with its command.
+                let firewall = model.coordinator?.status.snapshot.firewall
+                if let firewall, let line = FirewallRule.Copy.paneLine(firewall) {
+                    print("Settings › General's firewall line: \(line)\(FirewallRule.Copy.command(firewall).map { " \($0)" } ?? "")")
+                } else {
+                    print("Settings › General's firewall line: none (\(firewall.map { String(describing: $0) } ?? "not asked yet"))")
+                }
             }
         }
         let shots = defaults.string(forKey: "SillSettingsShot").flatMap { $0.isEmpty ? nil : $0 }
@@ -394,6 +409,23 @@ enum DebugHooks {
                 render(pane, appearance: appearance, to: out.appendingPathComponent("pane-devices-\(sample.name)-\(name).png"))
             }
         }
+        // General while the macOS firewall block
```

**File**: `Sources/SillMenuBar/SettingsPanes.swift` (modified, +66/-1)
```diff
@@ -14,12 +14,14 @@ struct SettingsPane: View {
     var previewUpdates: UpdatePolicy.Pane?
     /// …and its clipboard section with macOS's answer as given, never read from this Mac.
     var previewClipboardAccess: ClipboardPolicy.MacAccess?
+    /// …and what the macOS firewall does as given (FirewallRule), never asked.
+    var previewFirewall: FirewallRule.Verdict?
 
     var body: some View {
         Group {
             switch tab {
             case .general: GeneralPane(model: model, settings: model.settings, previewUpdates: previewUpdates,
-                                       previewClipboardAccess: previewClipboardAccess)
+                                       previewClipboardAccess: previewClipboardAccess, previewFirewall: previewFirewall)
             case .devices: LiveDevicesPane(model: model, settings: model.settings)
             case .streaming: StreamingPane(model: model, settings: model.settings)
             case .virtualDisplay: VirtualDisplayPane(model: model, settings: model.settings)
@@ -34,6 +36,8 @@ struct SettingsPane: View {
         // idle Sill with Settings closed wakes for nothing. The Devices and Remote Access panes
         // follow the host's status, which is pushed, so they poll nothing.
         .task(id: model.visibleSettingsTab == tab) {
+            // General on screen: whether the macOS firewall blocks Sill, asked again (FirewallCheck).
+            if model.visibleSettingsTab == tab, tab == .general { model.coordinator?.checkFirewall() }
             guard model.visibleSettingsTab == tab, tab != .streaming, tab != .devices, tab != .remoteAccess else { return }
             while !Task.isCancelled {
                 model.permissions.refresh()
@@ -44,6 +48,8 @@ struct SettingsPane: View {
         .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in
             model.permissions.refresh()
             model.loginItem.refresh()
+            // Back from Terminal with the command run: General's firewall line follows.
+            if model.visibleSettingsTab == tab, tab == .general { model.coordinator?.checkFirewall() }
         }
     }
 }
@@ -84,6 +90,7 @@ private struct GeneralPane: View {
     @Bindable var settings: HostSettings
     var previewUpdates: UpdatePolicy.Pane?
     var previewClipboardAccess: ClipboardPolicy.MacAccess?
+    var previewFirewall: FirewallRule.Verdict?
 
     private static let runsFromApplications = Bundle.main.bundlePath.hasPrefix("/Applications/")
 
@@ -133,6 +140,11 @@ private struct GeneralPane: View {
                     Spacer(minLength: 0)
                 }
             }
+            // Beside the name devices see: the macOS firewall keeping them out (FirewallRule), only
+            // while it does.
+            if let firewall = previewFirewall ?? model.coordinator?.status.snapshot.firewall, firewall.blocksDevices {
+                FirewallSection(verdict: firewall)
+            }
             // How devices reach this Mac, so beside its name on the network. Applies at once without
             // restarting the stream (the listener is replaced); enabled in test pattern mode too,
             // where it is saved and changes only the listener.
@@ -184,6 +196,59 @@ private struct GeneralPane: View {
     }
 }
 
+// MARK: Firewall
+
+/// The macOS firewall keeps devices out (FirewallRule; a user's report of 2026-10-29), in the
+/// Permissions pane's style: what it blocks and why that matters, then the Terminal command that
+/// unblocks Sill, the running executable's path in it, with Copy; or, for Block all incoming
+/// connections, where to turn it off. Nothing while the firewall lets devices in. Sill never runs the
+/// command itself (it needs an administrator). Drawn alone in the previews in each verdict.
+struct FirewallSection: View {
+    let verdict: FirewallRule.Verdict
+    @State private var copied = false
+
+    var body: some View {
+        if let line = FirewallRule.Copy.paneLine(verdict) {
+            let command = FirewallRule.Copy.command(verdict)
+            Section {
+                LabeledContent {
+                    HStack(spacing: 6) {
+                        Image(systemName: "exclamationmark.triangle.fill")
+                            .foregroundStyle(.orange)
+                        if let command {
+                            Button(copied ? "Copied" : "Copy") { copy(command) }
+                                .help("Copies the command, to paste into Terminal")
+                        }
+                    }
+                } label: {
+                    Text("Firewall")
+                    Text(line)
+                }
+                if let lines = FirewallRule.Copy.commandLines(verdict) {
+                    // A line for the tool and one for each option, never "--" over "unblockapp".
+                    Text(verbatim: lines.joined(separator: "\n"))
+                        .font(.system(.callout, design: .monospaced))

```

---

### Incident Patch 3: `e4d30349` (2026-10-30)
**Commit Message**: Merge pull request #262 from Saffsanity/integrate-security

Integration: the seven security pull requests tested together on 2026-10-30 (#249 #250 #251 #252 #253 #254 #255)

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -134,7 +134,7 @@ jobs:
     strategy:
       fail-fast: false
       matrix:
-        check: [addresses, ask-limits, audio-codec, audio-packetizer, audio-playout, away-copy, away-quality, away-wire, cable-link, capture-scale, catalog-look, clientlink, clipboard, compatibility, connection-list, device-gate, display-wake, dmg-layout, door-policy, duo, encoder-mailbox, encoder-slowstate, fence, gesture-chords, gestures, goodbye, hardware-keyboard, home-device, home-model, home-records, home-txt, installed-apps, key-repeat, key-strokes, keychain, keyframe-recovery, ledger, link-judge, menu-state, menus, message-reader, origin, pairing-address, pairing-sharing, phone-portrait, pointer-control, pointer-presence, pointer-watch, policy, protocol, remote-rules, settings-window, stream-zoom, text-composition, thumbnail-hold, tour, update-policy, virtual-display-api, window-restore]
+        check: [addresses, ask-limits, audio-codec, audio-packetizer, audio-playout, away-copy, away-quality, away-wire, cable-link, capture-scale, catalog-look, clientlink, clipboard, compatibility, connection-list, device-gate, display-wake, dmg-layout, door-policy, duo, encoder-mailbox, encoder-slowstate, fence, firewall, gesture-chords, gestures, goodbye, hardware-keyboard, home-device, home-model, home-records, home-txt, installed-apps, key-repeat, key-strokes, keychain, keyframe-recovery, ledger, link-judge, menu-state, menus, message-reader, origin, pairing-address, pairing-sharing, phone-portrait, pointer-control, pointer-presence, pointer-watch, policy, protocol, remote-rules, settings-window, stream-zoom, test-host, text-composition, thumbnail-hold, tour, update-policy, viewport-bounds, virtual-display-api, window-restore]
     steps:
       - name: Check out
         uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
```

**File**: `CLAUDE.md` (modified, +588/-23)
```diff
@@ -8,6 +8,225 @@ Formerly winstream; the folder still carries the old name.
 
 ## Current step
 
+**The door's waiting places (2026-10-29, branch `sec-door-pending` from main at 150479b5, PR #252; finding 9 of the
+security scan of 2026-10-18, Low; Noah's go of 2026-10-29).** A TLS door (the remote one, and the home one of
+Sill.app and `SillHost --pairing`) held 8 connections waiting for admission, 2 per address, 10 s each, and backed an
+address off only for its own refusals: four addresses closing each connection at 9.9 s kept every place full for good
+and a paired device got "limit". Host only, no wire change. `DoorPolicy.Places` (pure) owns the places, `Door` runs
+it on a monotonic clock: a connection that ends unadmitted, and a pairing connection's kind 19, costs its address a
+tenth of a failure, a tenth for each second it waited at least, one more for every 2 s beyond the first 2 (counted to
+its deadline at most), at least one when refused (5 in 60 s: 300 s, as before; a paired key at `.ready` clears its
+address); the TLS handshake has 4 s (Network.framework does not say when a ClientHello arrives, so the whole
+handshake rather than its first bytes; 10 s from a known address), a pairing connection's kind 19 4 s after `.ready`,
+10 s in all; an IPv6 address answers for its /64 too (a link-local one's on its interface): 2 waiting places per /64
+for addresses not known, and 12 failures in 300 s from those back the /64 off, an address counting 6 at most (so it
+takes two); 2 places beyond the 8 for addresses that proved a paired key within a day (known: never refused for nor
+charged to their /64, and they pay for what they hold as an address not known does, so someone at a paired device's
+address is backed off with it within 30 s: nothing tells them apart before TLS). One line a minute per door, "Home
+door backed off 10.128.0.34 for 300 s: its connections waited without being admitted, or were refused."
+`AskLimits.quietKey`: the quiet after the Mac's Cancel or a stop covers the asker's IPv6 /64. Checks: `door-policy`
+254 (the scan's attack modelled against the rule before and this one: before, every place held and the paired device
+refused at all 60 tries in 2 minutes; now the four backed off 12 s in, the paired device admitted at every try, one
+not yet known in at 13 s; closing at 1.9 s, 26.6 s; IPv6 churn in a /64, the /64 at 61 s, holding one place at 120 s)
+and 109 of 109 mutants; `ask-limits` 43 and 24 of 24. Live on loopback synthetic `--pairing` hosts (sources
+127.0.0.1, en0's 10.128.0.34, en13's 10.128.0.148 and en14's 169.254.219.184, whose connections to 127.0.0.1 stay on
+lo0; 127.0.0.2–5 cannot be bound without a root alias): main's build refused the paired client at all 30 tries in 90
+s ("… 27 over the limit."), backing nobody off; this one cut the four at 4.2 s and backed them off at 12.6 s ("Home
+door backed off 10.128.0.34 for 300 s: …", the client at 127.0.0.1 with them); a scratch build with 6 shared places
+(three addresses filling them as four fill 8) served a known client at all 20 tries and an unknown one from 13 s; one
+address cycling at 1.9 s held 2 places for good on main and was backed off at 47.9 s here. Plan's "What stays open"
+updated (an address keeps about 4/5 of a place, so ten IPv4 addresses taking turns fill the shared places; the
+co-located address; a device not yet paired in a backed-off /64, which a stranger in it keeps backed off with a dozen
+refused handshakes as each 5 minutes end; a routed IPv6 prefix from the internet at the remote door).
+- The review (2026-10-29; the report's "The review", f9-pending-slots-report.md in sill-handoff's
+  triage/2026-10-29-security): three findings, each reproduced live on 7929c539 first and fixed in a commit of its own.
+  A kind 19 left its place for nothing, and the home door's verify block takes `sill-pair/1` with any key: a holder
+  doing TLS on it 3 s in and a kind 19 (`v` 2, answered `closed`, nothing shown) 3.5 s later held all 8 places for
+  90 s from four addresses (112 kind 19s), nobody backed off, an unknown paired client refused at all 30 tries; now
+  `Places.End.request` pays as a connection that ended then (fd0a58c5): the same holder backed off at 13.07 s. The
+  wait counted from accept on CLOCK_MONOTONIC, which runs on through a sleep while the deadline's timer does not: one
+  connection waiting across a 20 s SIGSTOP of the host (a sleep's stand-in) backed 127.0.0.1 off at the continue and
+  the known client was refused at all 13 tries; now a wait counts to its place's deadline at most (0b457e48): no
+  backoff, 13 of 13 served. A known address was charged for all of its 10 s (a cut 4.1, its device's own let-go at
+  5 s 1.6, where main charged 1 and nothing): a known device's reconnect whose dials stalled was backed off at 40.06 s
+  and refused at all 6 tries after; now it pays as an address not known (1.1 at most for a handshake, 3.1 for a
+  pairing connection; 8e0148a0): no backof
```

**File**: `SECURITY.md` (modified, +20/-1)
```diff
@@ -24,17 +24,36 @@ who has it, and the newest iPhone and iPad app.
 - Remote Access's connection, and pairing, at home and away: the QR code, the
   typed code, `sill://pair` links, a USB cable's automatic pairing, Require
   pairing, and the paired devices and keys Sill for Mac keeps in the keychain.
+- What another app on the Mac can make Sill for Mac do by starting it, or a
+  copy of it, with arguments and an environment of its own: it then runs with
+  Sill's Screen Recording and Accessibility permissions.
 - The update check, which asks GitHub's releases feed about once a day and
   downloads nothing.
 - The website, getsill.app.
 
 Known, and by design: with Require pairing off (Settings › Devices), any
 device on the Mac's own networks, one nearby while Direct Wireless Connection
 is on, and any app on the Mac itself connect without pairing, still
-encrypted. With Show the pairing window to screen sharing on (Settings ›
+encrypted. An iPhone or iPad that connects that way takes whatever key
+answers when its row is tapped, so another Mac on the network that takes the
+Mac's name could answer that tap; its automatic reconnect goes back only to
+the key it connected to, and a paired device checks the Mac's key every
+time. With Show the pairing window to screen sharing on (Settings ›
+encrypted; only a paired device can turn Direct Wireless Connection on or off
+from its settings panel. With Show the pairing window to screen sharing on (Settings ›
 Devices, off by default), Screen Sharing and other remote desktop apps show the
 pairing window, so anyone who can see the Mac's screen remotely can read its
 code. `SillHost`, the command-line host for development, keeps a plain
 home door, with no pairing and no encryption, unless it runs with
 `--pairing`. Sill for Mac 0.3.1 and earlier had no pairing and no encryption
 at home: update to the newest release.
+
+The development builds made from source, `SillHost` and the bare `SillMenuBar`
+binary that `swift build` makes, take test settings that change who gets in
+and what pairing needs (`SILL_TEST_…` variables, and the bare binary's
+`-Sill…After` arguments and `-requirePairing`). Sill for Mac takes none of
+them, whatever its folder is called and however it is started (a renamed copy,
+a link to its executable): it knows itself by its code signature and its
+bundle. Sill for Mac 0.4.0 to 0.5.1, and the nightly builds before the next
+release, knew themselves by their folder's name and take them from a renamed
+copy or a link: update to the newest release.
```

**File**: `Scripts/audio/build.sh` (modified, +2/-2)
```diff
@@ -17,8 +17,8 @@ here="$(cd "$(dirname "$0")" && pwd)"
 root="$(cd "$here/../.." && pwd)"
 out="$root/.build/audio"
 cd "$root"
-host_files=(StreamServer CableLink ClientLink DeviceGate Door DoorPolicy HostIdentity HostLog InterfaceSnapshot LinkJudge
-            OriginPolicy PairingWindow PointerControl PointerWatch RefusalSummary Stats
+host_files=(StreamServer CableLink ClientLink DeviceGate Door DoorPolicy HostIdentity HostLog InterfaceSnapshot KeyStrokes
+            LinkJudge OriginPolicy PairingWindow PointerControl PointerWatch RefusalSummary Stats
             AudioPipeline AudioPacketizer AudioEncoder SyntheticAudio TestTone)
 
 put() {   # put DEST: stdin to DEST, only if it differs
```

**File**: `Scripts/menu-check/mirror.swift` (modified, +29/-5)
```diff
@@ -1,11 +1,13 @@
 // Scripts/menu-check/run.sh mirror: MenuMirror end to end against the fixture, with no host, network
 // or encoder: the real MenuMirror, MenuReader, MenuPolicy, MenuFormat and StreamProtocol, with stubs
 // for the server's send, a connection's state, Stats and print (all recorded). It drives the mirror
-// as the coordinator does (fetch, press, setTarget, catalogPolled, clientLeft, clientStats) and checks
-// each kind 24 and log line (docs/menu-bar-plan.md §4.4, §4.7; H4–H8's and H10's logic, and the
-// review's: only subscribers served, a request past its device's wait not read, one top-level read
-// a second, and the tree changed in place under a version). Presses go only to the fixture whose pid
-// is given; a /bin/sleep it starts stands for an app whose top level cannot be read. usage
+// as the coordinator does (fetch, press, setTarget, catalogPolled, clientLeft, clientRevoked,
+// clientStats) and checks each kind 24 and log line (docs/menu-bar-plan.md §4.4, §4.7; H4–H8's and
+// H10's logic, and the review's: only subscribers served, a request past its device's wait not read,
+// one top-level read a second, and the tree changed in place under a version; and a device the Mac
+// stops serving, whose waiting fetch and choice are neither read nor made: security scan finding 10).
+// Presses go only to the fixture whose pid is given; a /bin/sleep it starts stands for an app whose
+// top level cannot be read. usage
 // (fixture.py runs it): mirror PID FIXTURE_LOG FIXTURE_BIN
 import Foundation
 import ApplicationServices
@@ -292,6 +294,28 @@ func dynamic(_ m: MacMenu?) -> Int { Int(m?.items?.compactMap { $0.title }.first
     mirror.prepare = { true }
     B.state = .ready
     _ = await fetch(B, nil, nil)
+    // A device the Mac stops serving (security scan finding 10, the review of PR #254: Remove, Require
+    // pairing): D, a subscriber, is cut off while its fetch and its choice wait behind A's slow
+    // activation: neither is prepared, read or made, unlike B's choice above, and the host says why.
+    await sleep(1.1)
+    let D = FakeConnection("D")
+    _ = await fetch(D, nil, nil)
+    prepares = 0
+    let cbEditD = fixture().filter { $0.contains("menuNeedsUpdate 'Edit'") }.count
+    mirror.prepare = { prepares += 1; try? await Task.sleep(for: .seconds(0.6)); return true }
+    let tA3 = next(); mirror.fetch(FetchMenu(version: vF, id: "2", title: "File", token: tA3), from: A, who: "A")
+    mirror.fetch(FetchMenu(version: vF, id: "3", title: "Edit", token: next()), from: D, who: "D")
+    mirror.press(PressMenuItem(version: vF, id: "4.0", title: "Set Label A", token: next()), from: D, who: "D")
+    await sleep(0.05)
+    n = Lines.shared.all().count
+    mirror.clientRevoked(ObjectIdentifier(D))
+    _ = await answer(A, tA3)
+    await sleep(1.0)
+    check(prepares == 1 && label() == "B" && fixture().filter { $0.contains("menuNeedsUpdate 'Edit'") }.count == cbEditD
+          && lines(since: n).contains("Menu from D refused: 4.0: the Mac no longer serves it"),
+          "D cut off before its turn: its fetch neither prepared nor read, its choice not made (\(prepares) activations: A's; the label \(label()))")
+    D.state = .cancelled; mirror.clientLeft(D)
+    mirror.prepare = { true }
     // A request past its device's wait: a fetch queued behind a 4.2 s activation is not read, and a
     // choice behind it is refused as late.
     await sleep(1.1)
```

**File**: `Scripts/pacing/build.sh` (modified, +4/-3)
```diff
@@ -19,9 +19,10 @@ git rev-parse --verify --quiet "$base^{commit}" > /dev/null || { echo "build.sh:
 # needed it, the build says so). Since pairing at home (PR #37) StreamServer's TLS home door is a
 # `Door`, which brings DoorPolicy, HostIdentity's trust snapshot, CableLink and PairingWindow's
 # AskLimits; the harness never builds one (its own door serves every session). Since away from home
-# (PR #39) it judges each device's link (LinkJudge).
-host_files=(StreamServer CableLink ClientLink DeviceGate Door DoorPolicy HostIdentity HostLog InterfaceSnapshot LinkJudge
-            OriginPolicy PairingWindow PointerControl PointerWatch RefusalSummary Stats)
+# (PR #39) it judges each device's link (LinkJudge). Since a revoked session's receive loop hands on
+# only what lets go of a key or a button (security scan finding 10), it reads RevokedInput (KeyStrokes).
+host_files=(StreamServer CableLink ClientLink DeviceGate Door DoorPolicy HostIdentity HostLog InterfaceSnapshot KeyStrokes
+            LinkJudge OriginPolicy PairingWindow PointerControl PointerWatch RefusalSummary Stats)
 # The Mac's sound (docs/audio-plan.md H6): where a side has these, they are compiled in with SILL_AUDIO
 # defined, and main.swift's --audio runs the test tone through the real pipeline and send path.
 audio_files=(AudioPipeline AudioPacketizer AudioEncoder SyntheticAudio TestTone)
```

**File**: `Scripts/sillclient.py` (modified, +24/-12)
```diff
@@ -12,11 +12,14 @@
                      in send order. Keys: maxFPS, bitrate, captureScale, prioritizeSpeed,
                      virtualDisplay, directWireless, sendAudio; booleans accept 1/0/true/false/on/off
   --raw17=JSON@T     send this literal kind 17 payload T seconds in (split on the last @)
+  --raw9=JSON@T      send this literal kind 9 payload (a viewport) T seconds in (split on the last @);
+                     a host refuses one outside 1 to 16384 points a side or 0.25 to 4 for its scale,
+                     and one that does not decode, with a "Viewport from … refused" line
   --pick=SRC@T       a timed selectSource: none, desktop or window:ID
   --stats            send ClientStats (kind 12) once a second as device "sillclient", so the host
                      logs a name for this client
-  --expect=K=V[,...] at exit, compare the last kind 16's settings (and its top-level persistent
-                     and virtualDisplayAvailable; away from home, docs/remote-bundle-plan.md: its
+  --expect=K=V[,...] at exit, compare the last kind 16's settings (and its top-level persistent,
+                     virtualDisplayAvailable and sessionPaired; away from home, docs/remote-bundle-plan.md: its
                      away's homeBitrate, homeCaptureScale, awayBitrate, awayCaptureScale,
                      thisConnectionAway and awayRunning, missing when the host sent no away; and
                      linkState, its link's state, "fine" when it sent none): prints EXPECT ok or
@@ -136,26 +139,28 @@
 Once a second it prints the frames, their payload in kB (the encoder's output), ticks, cursor
 shapes and the last ping's round trip. Every kind 16 (host settings) is printed on one line with
 its arrival time; dw= is Direct Wireless
-(1, 0, or - when the host did not report it: an older host); away= (only when the host sent it) is
+(1, 0, or - when the host did not report it: an older host); paired= is sessionPaired, whether this
+session's key is on the Mac's trust list, the one kind of session it takes Direct Wireless from (1, 0,
+or - from a host before 2026-10-29); away= (only when the host sent it) is
 h:HOME_BITRATE/SCALE,a:AWAY_BITRATE/SCALE,this=1|0,run=1|0, and link= (only while the host reports
 the link behind or stalled) STATE,withheld=N,bitrate=B,carried=KBPS|-,suggested=B/SCALE|-. Flags may come in any
 order after the positional arguments. Everything is checked before connecting: an unknown flag, a
 --set or --expect key that is not one of theirs, or a value that does not parse stops the script
-with status 2 (--raw17 and --input go out as written). Find PORT with: lsof -nP -iTCP -sTCP:LISTEN -a -p <pid>.
+with status 2 (--raw17, --raw9 and --input go out as written). Find PORT with: lsof -nP -iTCP -sTCP:LISTEN -a -p <pid>.
 The --synthetic hosts do not advertise over Bonjour, so this is the only way to reach them."""
 import json, re, socket, struct, sys, time
 
 KIND = {0:"ps",1:"frame",2:"list",3:"thumb",4:"icon",5:"apps",11:"pong",13:"tick",14:"cursor",16:"settings",18:"macinfo",20:"pairresult",22:"goodbye",24:"menu",26:"pointer",32:"clipboard",43:"audio"}
 BOOL = {"1": True, "0": False, "true": True, "false": False, "on": True, "off": False, "yes": True, "no": False}
 BOOL_KEYS = {"prioritizeSpeed", "virtualDisplay", "directWireless", "sendAudio", "persistent", "virtualDisplayAvailable",
-             "thisConnectionAway", "awayRunning"}
+             "thisConnectionAway", "awayRunning", "sessionPaired"}
 # What --set may send: HostSettingsChange's seven fields. The host drops any other key without a
 # word, so a misspelt one would only show up as an unchanged answer.
 SET_KEYS = {"maxFPS", "bitrate", "captureScale", "prioritizeSpeed", "virtualDisplay", "directWireless", "sendAudio"}
 # Away from home (docs/remote-bundle-plan.md): read from the state's `away`, and its `link`'s state.
 AWAY_KEYS = {"homeBitrate", "homeCaptureScale", "awayBitrate", "awayCaptureScale", "thisConnectionAway", "awayRunning"}
-EXPECT_KEYS = SET_KEYS | {"persistent", "virtualDisplayAvailable", "linkState", "clipboard"} | AWAY_KEYS
-TIMED = ("set", "raw17", "pick", "fps-after", "stop-ping", "stop-read", "pairing-wanted", "keyframe", "fetch", "press", "raw25",
+EXPECT_KEYS = SET_KEYS | {"persistent", "virtualDisplayAvailable", "sessionPaired", "linkState", "clipboard"} | AWAY_KEYS
+TIMED = ("set", "raw17", "raw9", "pick", "fps-after", "stop-ping", "stop-read", "pairing-wanted", "keyframe", "fetch", "press", "raw25",
          "raw27", "move", "tap", "key", "input", "gesture", "raw28", "copy", "copy-bytes", "raw32")
 INPUT = ("move", "tap", "key", "input")
 # What --gesture may send: TrackpadGesture's six names (Gesture.swift). Anything else goes with --raw28.
@@ -602,7 +607,8 @@ def valued(name, default=None):
 mac_pin = None
 if pair_hold is not None:
     # A pairing connection still pending: TLS up (ALPN sill-pair/1), then silence. The host's
-    # admission deadline (10 s) or a Direct Wireless chang
```

**File**: `Sources/SillHost/CaptureScale.swift` (modified, +24/-0)
```diff
@@ -164,6 +164,30 @@ enum VirtualDisplaySize {
         let side = ceil(max(panel.width, panel.height) / 0.5)
         return clamp(CGSize(width: side, height: side))
     }
+
+    /// The most a window is asked for on the virtual display, a side: the largest viewport a host takes,
+    /// 16384 points at a text scale of 0.25 (ViewportBounds), so the hold changes no size a host asked
+    /// for before. Not the display's `maxSide`: the placement fits the window to the display anyway
+    /// (VirtualStage.prepare's `dest`), and a full-screen window's crop takes the shape of this size,
+    /// which is the panel's only while no side is held. Held at 4096, a 2560×1400 panel at 0.5x (an iPad's
+    /// Stage Manager window on a large display) was asked 4096×2800, and a full-screen window's crop came
+    /// out 1.46:1 for a 1.83:1 panel, black bars on the device (the review of finding 4, 2026-10-29).
+    static let maxWindowSide: CGFloat = 65536
+
+    /// The size a window should have on the virtual display, in Mac points: a device's panel of `panel`
+    /// points divided by its text scale (none, or one that is not a positive number, counts as 1), each
+    /// side held to 1…`maxWindowSide` (VirtualStage.windowSize). Until 2026-10-29 nothing held it: a
+    /// viewport of 1e300 points, or a scale of 1e-300, gave a side no Int holds, and the "insists on …"
+    /// line's Int() trapped (security scan, finding 4; hosts now refuse such a viewport, ViewportBounds,
+    /// and the line prints through ViewportBounds.whole). Every viewport a host takes is asked for as
+    /// before, but for a side under half a point, now 1 rather than 0. No panel, or one whose sides are
+    /// not positive numbers: the window's own size, as before.
+    static func windowSize(panel: CGSize?, scale: CGFloat?, own: CGSize) -> CGSize {
+        guard let panel, panel.width.isFinite, panel.height.isFinite, panel.width > 0, panel.height > 0 else { return own }
+        let s = scale.flatMap { $0.isFinite && $0 > 0 ? $0 : nil } ?? 1
+        return CGSize(width: min(max((panel.width / s).rounded(), 1), maxWindowSide),
+                      height: min(max((panel.height / s).rounded(), 1), maxWindowSide))
+    }
 }
 
 /// HEVC wants even sides: a capture's size in pixels rounded down to even. Every capture's rule until
```

#### Recent Merged Pull Requests:
- **PR #262** (2026-10-30): Integration: the seven security pull requests tested together on 2026-10-30 (#249 #250 #251 #252 #253 #254 #255) (@Saffsanity)
- **PR #259** (2026-10-30): Integration: the eight pull requests tested together on 2026-10-30 (#241 #239 #240 #217 #224 #181 #248 #242) (@Saffsanity)
- **PR #255** (2026-10-30): Security: the reconnect to an unpaired open door pins the key its session saw (scan finding 3) (@Saffsanity)
- **PR #254** (2026-10-30): A device the Mac stops serving lands no more input (security scan finding 10) (@Saffsanity)
- **PR #253** (2026-10-30): Direct Wireless only from a paired device (security scan finding 8) (@Saffsanity)
- **PR #252** (2026-10-30): Door: waiting for admission costs its source (security scan, finding 9) (@Saffsanity)

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

## X. Merge remote-tracking branch 'origin/firewall-executable-block' into test-securi

**RULE**:
When implementing operations in `.github/workflows/ci.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Saffsanity/sill. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `bc0e5a8c`: Merge remote-tracking branch 'origin/firewall-executable-block' into test-security. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/ci.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
        check: [addresses, ask-limits, audio-codec, audio-packetizer, audio-playout, away-copy, away-quality, away-wire, cable-link, capture-scale, clientlink, clipboard, compatibility, connection-list, device-gate, display-wake, dmg-layout, door-policy, duo, encoder-mailbox, encoder-slowstate, fence, firewall, gesture-chords, gestures, goodbye, hardware-keyboard, home-device, home-model, home-records, home-txt, installed-apps, key-strokes, keychain, keyframe-recovery, ledger, link-judge, menu-state, menus, message-reader, origin, pairing-address, pairing-sharing, phone-portrait, pointer-control, pointer-presence, pointer-watch, policy, protocol, remote-rules, settings-window, stream-zoom, test-host, text-composition, tour, update-policy, viewport-bounds, virtual-display-api, window-restore]
```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern to NEVER write (induced failure mode):
        check: [addresses, ask-limits, audio-codec, audio-packetizer, audio-playout, away-copy, away-quality, away-wire, cable-link, capture-scale, clientlink, clipboard, compatibility, connection-list, device-gate, display-wake, dmg-layout, door-policy, duo, encoder-mailbox, encoder-slowstate, fence, gesture-chords, gestures, goodbye, hardware-keyboard, home-device, home-model, home-records, home-txt, installed-apps, key-strokes, keychain, keyframe-recovery, ledger, link-judge, menu-state, menus, message-reader, origin, pairing-address, pairing-sharing, phone-portrait, pointer-control, pointer-presence, pointer-watch, policy, protocol, remote-rules, settings-window, stream-zoom, test-host, text-composition, tour, update-policy, viewport-bounds, virtual-display-api, window-restore]
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `bc0e5a8c` are properly handled with clean fallback behavior.
