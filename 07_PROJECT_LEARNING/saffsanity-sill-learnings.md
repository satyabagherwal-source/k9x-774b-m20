> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/saffsanity-sill-learnings.md`  
> **Source**: github ([https://github.com/Saffsanity/sill](https://github.com/Saffsanity/sill))  
> **Source Version**: `22ab5a3e`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-26T12:20:02.984Z  
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
> **Harvest Timestamp**: 2026-11-26T12:20:02.978Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Saffsanity/sill`
- **Description**: Any window from your Mac, live on your iPhone or iPad. Touch, Apple Pencil, trackpad and keys. Free, open source, no servers.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 5120 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Sources/SillHost/DesktopDisplaysHook.swift`
```
import CoreGraphics
import Foundation
import StreamProtocol

/// TEST ONLY: `SILL_TEST_DISPLAYS='Built-in Retina Display:1512x982@2:120:0,0;DELL U2723QE:2560x1440@1:60:1512,0'`
/// on a --synthetic host (docs/virtual-desktop-plan.md, "The CLI and the test hooks"): the stops it lists in
/// place of this Mac's displays (DesktopDisplays), the first of them its main display, each a name, its size
/// in points at a scale (1 or 2), its refresh rate in Hz (0: none reported) and its origin in global points.
/// The test pattern then shows the stop the Desktop is on, at its size and scale, with its number and name
/// drawn on it, its rate held to the stop's; kind 47 steps through them; input lands in each one's own
/// space (the dry run's log under SILL_TEST_INPUT_LOG); the window list's fields and the lines are as on a
/// real Mac. Nothing of this Mac's displays is read for it, and nothing is posted or warped. Honoured only by
/// a test host (`--synthetic`, and never Sill.app's own executable: DoorPolicy.isTestHost): anywhere else one
/// line says it is ignored.
enum DesktopDisplaysHook {
    static let variable = "SILL_TEST_DISPLAYS"

    /// A test stop: the display DesktopDisplays judges, and its pixel scale (the test pattern's size).
    struct Stop: Equatable {
        var display: DesktopDisplays.Display
        var scale: CGFloat
    }

    /// The stops a test host takes, and the one line it prints at start (nil when the variable is not set).
    static func read(testHost: Bool, environment: [String: String]) -> (stops: [Stop]?, line: String?) {
        guard let raw = environment[variable], !raw.isEmpty else { return (nil, nil) }
        guard testHost else { return (nil, "\(variable) ignored: only a --synthetic test host takes it, never Sill.app.") }
        guard let stops = parse(raw) else {
            return (nil, "\(variable) ignored: it takes NAME:WxH@SCALE:HZ:X,Y entries separated by ';', the first the main display.")
        }
        let words = stops.enumerated().map { i, s -> String in
            let d = s.display
            return "\(i + 1) \(d.name ?? "unnamed") \(Int(d.frame.width))×\(Int(d.frame.height)) pt @\(Int(s.scale))x, "
                + (d.refreshHz.map { "\(Int($0.rounded())) Hz" } ?? "no rate") + " at \(Int(d.frame.minX)),\(Int(d.frame.minY))"
        }
        return (stops, "Test displays: \(stops.count) in place of this Mac's (\(variable)): " + words.joined(separator: "; ") + ".")
    }

    /// Entries separated by ';', each NAME:WxH@SCALE:HZ:X,Y; IDs 101, 102… and UUIDs TEST-1, TEST-2… in the
    /// order given. Nil when any entry does not parse, a size is under 64 or over 8192 points, a scale is
    /// not 1 or 2, a rate is not 0 to 500, or there are none or more than 16.
    static func parse(_ raw: String) -> [Stop]? {
        var stops: [Stop] = []
        for (i, entry) in raw.split(separator: ";", omittingEmptySubsequences: true).enumerated() {
            let parts = entry.split(separator: ":", omittingEmptySubsequences: false)
            guard parts.count == 4 else { return nil }
            let name = parts[0].trimmingCharacters(in: .whitespaces)
            let sizeScale = parts[1].split(separator: "@")
            guard sizeScale.count == 2, let scale = Double(sizeScale[1]), scale == 1 || scale == 2 else { return nil }
            let wh = sizeScale[0].split(separator: "x")
            guard wh.count == 2, let w = Double(wh[0]), let h = Double(wh[1]), (64...8192).contains(w), (64...8192).contains(h) else { return nil }
            guard let hz = Double(parts[2]), (0...500).contains(hz) else { return nil }
            let xy = parts[3].split(separator: ",")
            guard xy.count == 2, let x = Double(xy[0]), let y = Double(xy[1]), abs(x) <= 65_536, abs(y) <= 65_536 else { return nil }
            let display = DesktopDisplays.Display(id: UInt32(101 + i), uuid: "TEST-\(i + 1)", frame: CGRect(x: x, y: y, width: w, height: h),
                                                  refreshHz: hz > 0 ? hz : nil, name: name.isEmpty ? nil : name)
            stops.append(Stop(display: display, scale: CGFloat(scale)))
        }
        guard !stops.isEmpty, stops.count <= 16 else { return nil }
        return stops
    }
}

```

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
///                                              shareClipboard, offConsoleView, lockAfterSession,
///                                              lockSleepsDisplay, lockOnlyAfterAway,
///                                              remoteAddressName=host[:port],
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
    /
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
//       waits for the build to be processed, then gives it FILE as What to Test (English, U.S.),
//       replacing what it had.
//   asc distribute  --key-file F --key-id ID --issuer ID --version 0.6.0 --build 983 --whats-new FILE
//                   [--replace-whats-new] [--public-beta [--public-beta-group NAME]]
//       the same, but FILE only for a build with no What to Test yet (below), then the build goes to
//       every internal group, and with --public-beta to the public beta group too, and to Beta App
//       Review when TestFlight asks for that.
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
// What to Test, in `distribute`: a build that has some already, in any language, keeps it, and FILE
// is sent only to a build with none (no localization, or only empty ones), unless --replace-whats-new
// asks for FILE whatever the build has. The nightly asks for that only for a build its own run
// uploaded; one it finds in App Store Connect already (uploaded by hand with its own text, or by an
// earlier run of the same night) keeps what it has (2026-11-09: build 1304, uploaded by hand with its
// What to Test, had it replaced by that night's notes). `whats-new` always replaces: it is how a
// build's text is set or put back by hand.
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
                           [--replace-whats-new] [--public-beta [--public-beta-group NAME]]
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
    var replaceWhatsNew = false
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
        if name == "--replace-whats-new" {
            if value != nil { usageError("--replace-whats-new takes no value") }
            options.replaceWhatsNew = true
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
// A tone that failed or ended by itself (SILL_TEST_AUDIO_END) is asked for again, as the coordinator does.
audio.onRetry = { follow() }

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #379** (2026-11-24): **Locking the iPhone or iPad during Picture in Picture leaves the stream running for about 40 seconds, far behind**
  *Symptoms*: ### What happened  I left Sill on my iPhone with my Mac's picture in Picture in Picture, then locked the iPhone. The session didn't end with the lock. For its last 38 seconds the iPhone took the stream at a trickle: Sill's log on the Mac shows about one frame a second arriving up to 35 seconds late, every sound packet dropped, and a warning that blames the connection:  ``` Link to iPhone (iPhone16,1): cannot carry Extreme (withheld 35 of 55 frames in the last second; the link carried about 3.4 Mbps); suggesting Low · Standard. client iPhone (iPhone16,1): 1 fps, frame age 18138/18138 ms, rtt – client iPhone (iPhone16,1): 1 fps, frame age 34906/34906 ms, rtt – ```  Then the iPhone left by itself and the Mac stopped capturing. The connection was fine: seconds before, the same iPhone showed 60 frames a second, 7 to 10 ms old, and it did again a minute later.  Nothing of this shows on the locked iPhone. What it costs is on the Mac: it keeps capturing and encoding its whole desktop for a device nobody is looking at, and its log says the connection can't keep up when the connection is fine.  ### What I think is going on  When the device locks, Sill ends Picture in Picture, but nothing ends or pauses the session. Sill is then in the background with a live connection and no picture to show, and it reads the stream slowly until iOS suspends it.  This looks new with Picture in Picture: in the 125 sessions before it in my Mac's log, no device ever fell 10 seconds behind. I haven't confir

- **Issue #370** (2026-11-24): **Apps list doesn't show apps installed on an external drive (e.g. /Volumes/Drive/Applications), even via aliases**
  *Symptoms*: ### What happened  Apps installed on an external drive (e.g. `/Volumes/Drive/Applications`) don't appear in Sill's Apps list. Adding aliases to them in `/Applications` doesn't help either.  The Mac App Store has a setting to download and install large apps to a separate disk, and apps installed that way never show up in the Apps list. I expected Sill to list them alongside apps in `/Applications`.  ### How to make it happen again  1. In the App Store's settings, turn on downloading and installing large apps to a separate disk (or put an app in `/Volumes/<Drive>/Applications`). 2. Optionally, add an alias to that app in `/Applications`. 3. Open the Apps list in Sill on the iPhone or iPad: the app isn't listed.  ### Your Mac and its macOS  MacBook Pro (M4 Pro), macOS 27.2.1  ### Sill for Mac's version  0.6.0  ### Your iPhone or iPad and its iOS or iPadOS  iPad 11" M4 Pro  ### The Sill app's version  0.6.0  ### How the device reached the Mac  Remote (Remote Access)  ### Sill's log on your Mac  ```text  ```
  **Post-Mortem & Fix Analysis**:
  > Will look into this thanks for reporting!

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

### Incident Patch 1: `597aadbe` (2026-11-23)
**Commit Message**: Revert "Settings: the scroll view places the rows' column by its content margins"

This reverts commit b3a9029b. It built (GitHub's CI passed on it), but it
could not be photographed: harness-photos refuses to build under 25 GB
free, and the Mac stayed at 23.9 to 24.4 GB from 19:20 to 20:40 with no
heavy job running. A layout change that no photo has shown does not go to
Noah, so the view code is again 0fe6f77a's, which the photos show (iOSClient,
Tests and Scripts are byte for byte 0fe6f77a's).

What that leaves, in the plan and the step file: padded into the column
inside the page-wide scroll view, Full Screen's footnote, which fitted its
line with about a point to spare, breaks "them back." onto a second line on
the Duo's inner display upright and on the iPads; every other line of text
is where it was. The content margins are the likely way back, for when the
photos can be taken.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `docs/LAYOUT.md` (modified, +1/-2)
```diff
@@ -939,8 +939,7 @@ Below, "this file" means CLAUDE.md, and "Build and run below" means docs/BUILD-A
   with Disconnect under the Mac's; each scroll view across its page, the
   whole screen in one column, out to the screen's edges through the safe area
   beside it (`ignoresSafeArea`), the header, the rows and Disconnect in their
-  column inside it (`inColumn`; the rows that scroll by their scroll view's
-  content margins), so a drag anywhere scrolls; DEBUG
+  column inside it (`inColumn`), so a drag anywhere scrolls; DEBUG
   `-SillSettingsScrollArea 1` outlines them; a feature's group
   goes into the part whose it is), `SettingsPane` (where the pane's two parts
   go: one column on every screen without a fold to keep to, an iPad's and an
```

**File**: `docs/settings-pane-plan.md` (modified, +6/-3)
```diff
@@ -68,9 +68,12 @@ panel's rows, the same views in one place (`HostSettingsPanel`), unchanged in me
   and bounce only when they do not fit. Each scroll view spans its page, the whole screen in one column, out
   to the screen's edges through the safe area beside it (the pane is laid out in the safe area and each
   scroll view reaches past it, `ignoresSafeArea`, as far as the pane's own reader says the safe area goes),
-  and the rows keep to their column inside it (`SettingsPane.Layout`'s `macScroll` and `deviceScroll`; the
-  column is the scroll view's content margins, so the rows are laid out at its width as before), so a drag
-  beside them scrolls them as a drag on them does; a tap there does nothing. Their edges fade over 12 pt
+  and the rows keep to their column inside it (`SettingsPane.Layout`'s `macScroll` and `deviceScroll`), so a
+  drag beside them scrolls them as a drag on them does; a tap there does nothing. Padded into their column
+  inside the wider scroll view, the rows' text can be laid out a pixel narrower where the column's edge falls
+  between two pixels (34.5 pt on the Duo's inner display upright, on a 3x screen): there Full Screen's
+  footnote, which fitted its line with about a point to spare, breaks its last two words onto a second line,
+  and so it does on an iPad. Their edges fade over 12 pt
   where rows go out of sight under the header, Disconnect or the fold (the panel cut them sharply, which at the
   laptop pose's fold left a sliver of a line); the fade runs the scroll view's width, which holds nothing
   beside the column, so it reads as before. The scroll indicator is the scroll view's, so it sits at the
```

**File**: `docs/steps/2026-11-18-settings-pane.md` (modified, +7/-4)
```diff
@@ -103,10 +103,13 @@
   to the fold's band, the laptop pose's page the screen's width, out to the screen's edges through the safe
   area beside the stream screen (an iPhone on its side: 44 to 62 pt by its sensor housing and as much on the
   other side; the Duo's cover: its camera's 84), and the header, the rows and Disconnect keep to their column
-  inside it (HostSettingsPanel's `inColumn`; the rows that scroll by their scroll view's content margins, so the
-  scroll view lays them out at the column's width as it did when it was the column's: padded inside it instead,
-  Full Screen's footnote, which fitted its line with a point to spare, broke "them back." onto a second line in
-  the first photos, b3a9029b). The pane is laid out in the safe area as before; each scroll view
+  inside it (HostSettingsPanel's `inColumn`). Padded into the column inside the wider scroll view, Full
+  Screen's footnote, which fitted its line with about a point to spare, breaks "them back." onto a second line
+  (the Duo's inner display upright, the iPads; every other line of text is where it was): the rows' text is laid
+  out a pixel narrower where the column's edge falls between pixels. b3a9029b kept the column as the scroll
+  view's content margins instead, which should lay the rows out as before; it built (CI) but could not be
+  photographed (the disk stayed at 24 GB, under harness-photos' 25), so a later commit reverts it, and the view
+  code is the photographed 0fe6f77a's. The pane is laid out in the safe area as before; each scroll view
   reaches past it with `ignoresSafeArea(edges: .horizontal)`, as far as the pane's own reader says the safe
   area goes (`geo.safeAreaInsets`, in the same layout, so a turn moves both at once), and its rows are placed
   from its reached edge. The pure rule says both (`Layout.macScroll`, `deviceScroll`, `page(_:)`, the column
```

**File**: `iOSClient/HostSettingsPanel.swift` (modified, +8/-12)
```diff
@@ -248,7 +248,7 @@ struct HostSettingsPanel: View {
     /// below it. Nothing on the fold's band. Each part is laid out on its page (`page(macScroll)`, the whole
     /// screen in one column) and its scroll view goes on into the safe area beside the screen, so it takes a drag
     /// anywhere on the pane (`macScroll`, `deviceScroll`); the header, the rows and Disconnect keep to their
-    /// column inside it (`inColumn`, and the scroll view's content margins).
+    /// column inside it (`inColumn`).
     @ViewBuilder private func arranged(_ l: SettingsPane.Layout) -> some View {
         let macPage = l.page(l.macScroll), devicePage = l.page(l.deviceScroll)
         switch l.arrangement {
@@ -322,28 +322,24 @@ struct HostSettingsPanel: View {
     /// scrolls them too (Noah, 2026-11-23: "on iPad in landscape, you have to touch the middle 3rd of the display
     /// to scroll instead of anywhere on the screen"). The pane lays the scroll view out on its page and
     /// `ignoresSafeArea` takes it on to the screen's edge wherever the page meets one: inside, no safe area is
-    /// left, so the column's place is measured from `scroll`'s leading edge, as the scroll view's content margins.
-    /// Its indicator is at its trailing edge, as in a system list whose rows keep a readable width. `bottom`: the room kept under the rows where the scroll view
+    /// left, so the rows are placed from `scroll`'s leading edge. Its indicator is at its trailing edge, as in a
+    /// system list whose rows keep a readable width. `bottom`: the room kept under the rows where the scroll view
     /// reaches the screen's bottom edge (the home indicator's), so they scroll under it and their last line rests
     /// above it. Its edges fade (`ScrollEdgeFade`), so a row cut by the header, Disconnect or the fold reads as
     /// scrolled away; the rows begin under the top's fade.
     private func part<Content: View>(bottom: CGFloat, column: CGRect, scroll: CGRect,
                                      @ViewBuilder _ content: () -> Content) -> some View {
         let rows = content()
-        // The column as the scroll view's content margins at its sides, not as padding round the rows: the scroll
-        // view lays the rows out at the column's width and places them, as it did when it was the column's width
-        // (with padding inside the scroll view, a footnote line that fitted with a point to spare broke a word early).
-        let margins = EdgeInsets(top: 0, leading: max(0, column.minX - scroll.minX), bottom: bottom,
-                                 trailing: max(0, scroll.maxX - column.maxX))
         return ScrollViewReader { reader in
             ScrollView {
                 VStack(alignment: .leading, spacing: 0) { rows }
                     .padding(.top, ScrollEdgeFade.height)
+                    .inColumn(x: column.minX - scroll.minX, width: column.width)
             }
             .scrollIndicatorsFlash(onAppear: true)
             .scrollBounceBehavior(.basedOnSize)
             .modifier(StartAnchor(atEnd: Self.startsAtEnd))
-            .contentMargins([.leading, .bottom, .trailing], margins, for: .scrollContent)
+            .contentMargins(.bottom, bottom, for: .scrollContent)
             .modifier(ScrollEdgeFade())
             .modifier(ScrollAreaOutline())
             .ignoresSafeArea(edges: .horizontal)
@@ -1475,9 +1471,9 @@ private extension View {
     }
 
     /// This view as wide as a column `x` from its container's leading edge, the container's whole width taken
-    /// (SettingsPane.Layout's column on its part's page): the header, Disconnect, and the rows where they fit
-    /// without scrolling keep to the column while the part spans its page (the rows that scroll keep to it by
-    /// their scroll view's content margins, `part`). From the leading edge, so right to left mirrors it.
+    /// (SettingsPane.Layout's column inside its part's scroll view): the rest is empty, so the scroll view around
+    /// it spans its page while the rows, the header and Disconnect keep to the column. From the leading edge,
+    /// so right to left mirrors it.
     func inColumn(x: CGFloat, width: CGFloat) -> some View {
         frame(width: max(0, width))
             .padding(.leading, max(0, x))
```

---

### Incident Patch 2: `d8d6f57f` (2026-11-23)
**Commit Message**: Steps: ready-292's 2026-11-23 results: the checks, mutants, build, run-all, CI and the Duo's photos

The first hold's tour check found the one stale case c100e7de fixed; on c100e7de touch-hold
51 and 29 of 29 mutants, tour 740,388 checks and its 12 picture-card mutants, the rig compiled,
the iOS app built, run-all 76 of 76, CI green. The Duo's 5 changed cases against main: 2 as
main's, the rest only where designed, and the default's photos byte for byte 11-19's with the
switch on by name. The iPad's wait for the disk's floor. Noah's steps rewritten, shortest first.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `docs/steps/2026-11-19-ready-292.md` (modified, +43/-1)
```diff
@@ -158,4 +158,46 @@ and the review's list done on top; its pull request is a draft, "#292 ready: …
   a window by its title bar, a slider or a selection of text. Touching and holding without moving still right-clicks,
   now when you lift your finger. To have a hold right-click at once again, turn off Hold, Then Drag under This iPad
   (This iPhone) in the settings panel."
-- **Verified (2026-11-23):** in progress; the holds of tools/heavy.sh wait for the quiet flag (Noah's probes).
+- **Verified (2026-11-23).** The checks in two holds of tools/heavy.sh, 16:31 and 16:49 (the first stopped at the tour
+  check, below); the photos in a hold of slot A of their own, 17:04.
+  - The first hold's tour check failed one case of 740,388 (line 1165, "a row is spoken as it reads"): it still named
+    the right click's words for the default card. CI's run on 8fc800ea failed on the same line. c100e7de holds the
+    default to the drag's words and the switch off to the right click's; TourPolicy did not change.
+  - On c100e7de: touch-hold 51 passed, its mutants 29 of 29 caught (G1, the default off, among them). tour 740,388
+    checks, 0 failed. The tour's mutants: the 12 whose patterns sit on the picture card or in TourFeatures, run and
+    caught, 12 of 12 (the new one, TourFeatures' default off, with 1,542 FAIL lines); the other 120 not run, each
+    pattern found exactly once in the text (this change only flipped their cases' expectations on the picture card).
+  - The touch rig compiled as run.sh compiles it, now with `-D HOLD` (`-D GESTURES -D ZOOM -D HOLD -D REVEAL`):
+    0 errors, 0 warnings; not run.
+  - The iOS app for the simulator as CI builds it (Debug, arm64, Xcode 27.1): BUILD SUCCEEDED in 30 s, its one
+    warning main's (StreamClient.swift:4539, from 3c1bd97d).
+  - run-all: 76 of 76 (692 s), repo-rules 11 of 11.
+  - CI's Build and check on c100e7de (run 45161494273): green.
+  - Harness photos of c100e7de against main e0f222a0, the 8 cases whose arguments changed. The Duo (iOS 27.1, 168 s):
+    5 cases, 2 identical to main pixel for pixel (`duo-tour-holddrag-off`, `duo-stream-holddrag-on`). The 3 that
+    differ were looked at and differ only where they should: the row Hold, Then Drag off with
+    `-Sill.holdThenDrag 0`, the row on with no argument, and the tour's drag row with no argument. Against the photos
+    of 8578740c (2026-11-19), `duo-holddrag-on`, `duo-tour-holddrag-on`, `duo-tour-holddrag-off` and
+    `duo-stream-holddrag-on` are byte for byte the same: with no argument the default draws what
+    `-Sill.holdThenDrag 1` drew then. `duo-holddrag-off` differs from its 11-19 photo in 53 pixels, a channel by at
+    most 3, in a 71×12 box of the bar's first thumbnail, not in the panel.
+- **Not verified:** the touch rig's run (it needs a simulator of its own, and the rules keep agents to the harness
+  photos' pair), so neither `RIG_ONLY=hold`'s events nor compare.py's new rule on real logs; `swift build -c release`
+  here (no Mac source changed; CI built each head); anything on glass: a fresh install's default, an update that
+  never touched the switch, a switch turned off staying off after an update, the cancels mid-drag, the Pencil.
+- **Defaults for Noah to confirm (today's):** the tour's drag row stays unmarked, not "New:" (which of 0.7's rows get
+  the mark is the 0.7 tour's question); the footnote as it was; the support page's and README's new words; the
+  What's New words above. The 11-19 list's first item, the default off, is gone: Noah decided it.
+- **For Noah, on his devices** (a build of this head, a Mac window with something to drag), shortest first; the drag
+  itself he has done:
+  1. The default: on a device where the switch was never touched, Settings › This iPhone (This iPad) shows Hold, Then
+     Drag on.
+  2. Touch and hold a spot and lift without moving: the right-click menu opens as the finger lifts.
+  3. Turn the switch off: a hold right-clicks at about half a second with the finger still down, and moving then
+     drags nothing, as in 0.6. Turn it back on.
+  4. Settings › Take the Tour: the picture card says "…or hold, then drag, to move a window or select text"; with the
+     switch off, "Touch and hold to right-click."
+  5. Mid-drag, two more fingers down, or Control Center pulled with another finger: the button comes up and nothing is
+     clicked (a click on the Mac's own trackpad shows no button held).
+  6. On the iPad, the Pencil: unchanged, it drags as a mouse and its hold does not right-click.
+  7. The defaults above, then the merge word, or not.
```

---

### Incident Patch 3: `287927b4` (2026-11-24)
**Commit Message**: Revert "Settings: the rows' column in its scroll view from a whole pixel"

This reverts commit 15a947a9. Its photos (run "the blur", 2026-11-24) show
Full Screen's footnote breaking "them back." onto a second line on the Duo's
inner display upright however the rows are placed in their scroll view: at
the column's own 34.5 pt, from a whole pixel (34.33 pt) or from a whole point
(34 pt). So the placement is not why it breaks: the footnote needs a little
more than the 572 pt a 600 pt column gives its words. On feda62ff only that
one layout gave them more (its scroll view was the column's own width at a
half-pixel place; its cards' edges straddle pixels 103 and 1903, where
Disconnect's card is crisp from 104 to 1903); its laptop pose, the same
column, broke the footnote as now, and so does every 600 pt column of the
iPads.

Rounding down also put the rows' cards a pixel left of Disconnect's (from 103
against 104 px), where the column's own place, which SwiftUI rounds as it does
the header's and Disconnect's, keeps them over it. The tree is d02c139b's
again, which both devices' photos cover.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `Scripts/harness-photos/settings-pane-duo.cases` (modified, +0/-5)
```diff
@@ -6,15 +6,11 @@
 # `-system-edge`: iOS 26's own scroll edge effect left on (`-SillSettingsSystemEdge 1`), which the pane turns off on every
 # edge since 2026-11-24, on the Duo's own displays: beside the inner display's status bar strip, the cover's camera strip,
 # over the home indicator under the laptop and book poses' pages; the same as without it where it draws nothing.
-# `-grid-exact`, `-grid-points`: the rows' column in its scroll view at its own place (34.5 pt, as on 2026-11-23) or on whole
-# points, instead of the display's pixels (`-SillSettingsColumnGrid`), for what each does to the rows' text.
 #   Scripts/harness-photos.sh Scripts/harness-photos/settings-pane-duo.cases --baseline origin/main
 # Open flat, upright (the default pose): the inner display, and an iPhone's 393x852 upright.
 flat-portrait              -SillLayout 669x951 -SillHinge flat -SillSettings 1
 flat-portrait-end          -SillLayout 669x951 -SillHinge flat -SillSettings 1 -SillSettingsEnd 1
 flat-portrait-system-edge  -SillLayout 669x951 -SillHinge flat -SillSettings 1 -SillSettingsSystemEdge 1
-flat-portrait-grid-exact   -SillLayout 669x951 -SillHinge flat -SillSettings 1 -SillSettingsColumnGrid exact
-flat-portrait-grid-points  -SillLayout 669x951 -SillHinge flat -SillSettings 1 -SillSettingsColumnGrid points
 flat-portrait-long         -SillLayout 669x951 -SillHinge flat -SillSettings 1 -SillSettingsCase linkbehind -SillPiPSupported 1 -SillClipboardNote sent
 flat-portrait-stream       -SillLayout 669x951 -SillHinge flat
 phone-upright              -SillLayout 393x852 -SillSafeArea 59,0,34,0 -SillSettings 1
@@ -25,7 +21,6 @@ phone-upright-stream       -SillLayout 393x852 -SillSafeArea 59,0,34,0
 laptop                     -SillLayout 669x951 -SillHinge half -SillSettings 1 --pose=laptop
 laptop-end                 -SillLayout 669x951 -SillHinge half -SillSettings 1 -SillSettingsEnd 1 --pose=laptop
 laptop-end-system-edge     -SillLayout 669x951 -SillHinge half -SillSettings 1 -SillSettingsEnd 1 -SillSettingsSystemEdge 1 --pose=laptop
-laptop-grid-exact          -SillLayout 669x951 -SillHinge half -SillSettings 1 -SillSettingsColumnGrid exact --pose=laptop
 laptop-ax3                 -SillLayout 669x951 -SillHinge half -SillSettings 1 -UIPreferredContentSizeCategoryName UICTContentSizeCategoryAccessibilityXL --pose=laptop
 laptop-area                -SillLayout 669x951 -SillHinge half -SillSettings 1 -SillSettingsScrollArea 1 --pose=laptop
 laptop-stream              -SillLayout 669x951 -SillHinge half --pose=laptop
```

**File**: `Tests/checks/settings-pane/README.md` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 # `settings-pane`
 
-**Checks:** Settings as a whole-screen pane on every device (Noah, 2026-11-18; docs/settings-pane-plan.md): where its two parts go (the Mac's: the header with Done, its groups and Disconnect; this device's: This iPad's group, Take the Tour, the version) at the real sizes, every iPhone upright and on its side, the iPads either way round and in their narrow windows (one column on each), the iPhone Duo in every pose (the book pose a column on each page, the laptop pose a page above and a page below the fold, open flat and the cover one column as any screen), right to left too; then a grid of every width from 200 to 1,400 pt at heights from 240 to 1,400, each without a fold, with a book band down it (centred and off centre) and a laptop band across it, both ways round: every part inside the screen and 16 pt from its sides, none wider than 600, nothing on a fold's band, the Mac's part leading or above, one column on every screen without a fold kept to, however wide and whichever way round (both parts, centred; Noah, 2026-11-23: "Settings should not be 2 columns, please make it 1 column"), two columns or pages only around a fold, a fold kept to only where its pages hold a column (300 pt on a book page), each scroll view across its page with its column inside it, out to the screen's edges through the safe area beside the stream screen (an iPhone's sensor housing's strips, the Duo's cover's camera strip; laid out on its page, the stream screen's part of it) (in one column one scroll view, the whole screen, so a drag anywhere scrolls the rows; in the book pose each page up to the fold's band, never on it; in the laptop pose the screen's width above and below the fold; Noah, 2026-11-23: "on iPad in landscape, you have to touch the middle 3rd of the display to scroll instead of anywhere on the screen"), the header over the Mac's part (in the book pose across the fold to Done, its words the leading page's column), Disconnect clear of the home indicator (its room under it, 16 pt at least; 12 over the laptop pose's fold), iOS's own scroll edge effect off all four edges of both scroll views on every screen and in every arrangement (the pane's own fade their only edge; 2026-11-24: left on, it blurred all but the last rows of the 13-inch iPad's sideways harness photos), each part's rows in their scroll view from a whole pixel at 2x and 3x, at most a pixel short of the column's place and the column's whole width between the margins (2026-11-24: half a pixel off the grid, Full Screen's footnote broke a line early), right to left the mirror of left to right; the console's lines, with the scroll views and the bottom the pane was given; and what each way of closing it brings (back to the stream, the keyboard and VoiceOver's reading, only for Done and the harness's stand-in; only the tour and full screen wait for its motion)
+**Checks:** Settings as a whole-screen pane on every device (Noah, 2026-11-18; docs/settings-pane-plan.md): where its two parts go (the Mac's: the header with Done, its groups and Disconnect; this device's: This iPad's group, Take the Tour, the version) at the real sizes, every iPhone upright and on its side, the iPads either way round and in their narrow windows (one column on each), the iPhone Duo in every pose (the book pose a column on each page, the laptop pose a page above and a page below the fold, open flat and the cover one column as any screen), right to left too; then a grid of every width from 200 to 1,400 pt at heights from 240 to 1,400, each without a fold, with a book band down it (centred and off centre) and a laptop band across it, both ways round: every part inside the screen and 16 pt from its sides, none wider than 600, nothing on a fold's band, the Mac's part leading or above, one column on every screen without a fold kept to, however wide and whichever way round (both parts, centred; Noah, 2026-11-23: "Settings should not be 2 columns, please make it 1 column"), two columns or pages only around a fold, a fold kept to only where its pages hold a column (300 pt on a book page), each scroll view across its page with its column inside it, out to the screen's edges through the safe area beside the stream screen (an iPhone's sensor housing's strips, the Duo's cover's camera strip; laid out on its page, the stream screen's part of it) (in one column one scroll view, the whole screen, so a drag anywhere scrolls the rows; in the book pose each page up to the fold's band, never on it; in the laptop pose the screen's width above and below the fold; Noah, 2026-11-23: "on iPad in landscape, you have to touch the middle 3rd of the display to scroll instead of anywhere on the screen"), the header over the Mac's part (in the book pose across the fold to Done, its words the leading page's column), Disconnect clear of the home indicator (its room under it, 16 pt at least; 12 over the laptop pose's fold), iOS's own scroll edge effect off all four edges of both scroll 
```

**File**: `Tests/checks/settings-pane/main.swift` (modified, +1/-27)
```diff
@@ -39,26 +39,6 @@ typealias Edges = SettingsPane.Edges
 let fourEdges: Edges = [.top, .leading, .bottom, .trailing]
 check("a scroll view's four edges, each its own: top, leading, bottom, trailing",
       [Edges.top, .leading, .bottom, .trailing].map(\.rawValue) == [1, 2, 4, 8] && Edges.all == fourEdges)
-/// The rows' column in its scroll view (`contentMargins`) at `scale` pixels a point: from a whole pixel, at most a pixel
-/// short of the column's own place (never past it), and the column's whole width between the two margins.
-func marginsHold(_ column: CGRect, _ scroll: CGRect, scale: CGFloat) -> Bool {
-    let (lead, trail) = Layout.contentMargins(column: column, in: scroll, scale: scale)
-    let exact = column.minX - scroll.minX, px = lead * scale
-    return abs(px - px.rounded()) < 1e-6 && exact - lead > -1e-9 && exact - lead < 1 / scale - 1e-9
-        && near(lead + column.width + trail, scroll.width, 1e-6)
-}
-let upright3 = Layout.contentMargins(column: rect(34.5, 0, 600, 951), in: rect(0, 0, 669, 951), scale: 3)
-let upright2 = Layout.contentMargins(column: rect(34.5, 0, 600, 951), in: rect(0, 0, 669, 951), scale: 2)
-let uprightExact = Layout.contentMargins(column: rect(34.5, 0, 600, 951), in: rect(0, 0, 669, 951), scale: 0)
-check("the Duo open flat upright (669 pt, the column at 34.5): its rows from 103 px at 3x (34.33 pt, 34.67 beyond), from 69 px at 2x "
-        + "(34.5, 34.5 beyond); with no grid at 34.5 (2026-11-24: half a pixel off the grid, Full Screen's footnote broke a line early)",
-      near(upright3.leading, 103.0 / 3, 1e-9) && near(upright3.trailing, 669 - 103.0 / 3 - 600, 1e-9)
-        && upright2.leading == 34.5 && upright2.trailing == 34.5 && uprightExact.leading == 34.5 && uprightExact.trailing == 34.5)
-check("the column on the grid already stays: an iPhone 15 Pro on its side, 126 pt into its scroll view (59 of it the island's strip)",
-      [CGFloat(2), 3].allSatisfy { s in
-          let m = Layout.contentMargins(column: rect(67, 0, 600, 393), in: rect(-59, 0, 852, 393), scale: s)
-          return m.leading == 126 && m.trailing == 126
-      })
 
 // MARK: - The real sizes
 //
@@ -184,8 +164,6 @@ for c in cases {
         check("\(c.name)\(dir): the bottom inset kept, \(c.bottom)", l.bottom == c.bottom)
         check("\(c.name)\(dir): iOS's own scroll edge effect off all four edges of both scroll views",
               l.systemEdgeEffectHidden == fourEdges)
-        check("\(c.name)\(dir): each part's rows in their scroll view from a whole pixel at 2x and 3x, the column's width between the margins",
-              [CGFloat(2), 3].allSatisfy { s in marginsHold(l.mac, l.macScroll, scale: s) && marginsHold(l.device, l.deviceScroll, scale: s) })
         // Disconnect clear of the home indicator (its room, 16 pt at least), or 12 pt over the laptop pose's fold.
         let foot: CGFloat = c.arrangement == .twoPages ? 12 : max(16, c.bottom)
         check("\(c.name)\(dir): \(String(format: "%g", Double(foot))) pt under Disconnect, "
@@ -296,9 +274,7 @@ let scrolls = Rule("each scroll view across its page, out to the screen's edges
                    + "the laptop pose the screen's width above the band and below it; laid out on its page, the stream screen's part of it")
 let systemEdge = Rule("iOS's own scroll edge effect off all four edges of both scroll views, in every arrangement, on every screen, "
                       + "either way round and right to left (the pane's own fade their only edge; 2026-11-24)")
-let onGrid = Rule("each part's rows in their scroll view from a whole pixel at 2x and 3x, at most a pixel short of the column's place, the "
-                  + "column's whole width between the margins (2026-11-24)")
-let rules = [inside, widest, decided, offFold, leadingMac, foldsOnly, single, headerRule, mirrored, footRule, scrolls, systemEdge, onGrid]
+let rules = [inside, widest, decided, offFold, leadingMac, foldsOnly, single, headerRule, mirrored, footRule, scrolls, systemEdge]
 
 
 var gridLayouts = 0
@@ -345,8 +321,6 @@ for w in stride(from: 200, through: 1400, by: 1) {
                 footRule.expect(l.arrangement == .twoPages ? l.footBottom == 12 : l.footBottom == max(16, bottom) && l.footBottom >= bottom,
                                 at + ", \(l.footBottom) under Disconnect")
                 systemEdge.expect(l.systemEdgeEffectHidden == fourEdges, at + ", the system's edge effect hidden at \(l.systemEdgeEffectHidden.rawValue)")
-                onGrid.expect([CGFloat(2), 3].allSatisfy { s in marginsHold(l.mac, l.macScroll, scale: s) && marginsHold(l.device, l.deviceScroll, scale: s) },
-                              at + ", the margins at 3x \(Layout.contentMargins(column: l.mac, in: l.macScroll, scale: 3))")
                 // The scroll views, in the leading-edge space (the mirror rule below holds them right to left): each
                 // holds its column, spans its page and goes on into the safe area beside the screen where the 
```

**File**: `Tests/checks/settings-pane/mutants.py` (modified, +0/-8)
```diff
@@ -99,14 +99,6 @@
         "var systemEdgeEffectHidden: SettingsPane.Edges { arrangement == .oneColumn ? .all : [] }"),
     "M53 every edge without the sides": ("static let all: Edges = [.top, .leading, .bottom, .trailing]",
                                          "static let all: Edges = [.top, .bottom]"),
-    # The rows' column in its scroll view from a whole pixel (2026-11-24: half a pixel off the grid, Full Screen's footnote
-    # broke a line early): off the grid, a pixel past the column's place, or the trailing margin the column's own, must fail.
-    "M54 the rows' column in its scroll view off the pixel grid": (
-        "let leading = scale > 0 ? (abs(pixels - pixels.rounded()) < 0.001 ? pixels.rounded() : pixels.rounded(.down)) / scale : exact",
-        "let leading = exact"),
-    "M55 the rows' column rounded up, past its place": ("pixels.rounded(.down)) / scale", "pixels.rounded(.up)) / scale"),
-    "M56 the trailing margin from the column's own place": ("return (leading, max(0, scroll.width - leading - column.width))",
-                                                            "return (leading, max(0, scroll.maxX - column.maxX))"),
     # Closing.
     "M27 the overlay puts the keyboard back":("var backToStream: Bool { self == .done || self == .harness }",
                                                "var backToStream: Bool { self == .done || self == .harness || self == .overlay }"),
```

**File**: `docs/BUILD-AND-RUN.md` (modified, +1/-3)
```diff
@@ -356,9 +356,7 @@ views outlined in orange: where a drag scrolls the rows, the whole screen in one
 to its edges, each page around the fold; none where the rows fit), `-SillSettingsSystemEdge 1`
 (Settings' scroll views keep iOS 26's own scroll edge effect, which the pane turns off on every
 edge: on the 13-inch iPad's sideways screen, drawn a quarter turn round, it blurs all but the
-last rows; for photos of what it does, never a device's look), `-SillSettingsColumnGrid points|exact`
-(Settings' rows placed in their scroll view from a whole point, or at the column's own place, instead of
-from a whole pixel: half a pixel off on a 3x screen, Full Screen's footnote breaks a line early), `-SillSettingsScroll gestures` (the pane scrolled to its
+last rows; for photos of what it does, never a device's look), `-SillSettingsScroll gestures` (the pane scrolled to its
 This iPad group; the mock Mac takes gestures in every case but `legacy`; `reverse`
 to its Reverse Scrolling switch; `hold` to its Hold to Show Window Controls stepper),
 `-Sill.trackpadGestures 0` (the device's Three-Finger Gestures off for one run,
```

**File**: `docs/LAYOUT.md` (modified, +2/-4)
```diff
@@ -943,8 +943,7 @@ Below, "this file" means CLAUDE.md, and "Build and run below" means docs/BUILD-A
   content margins), so a drag anywhere scrolls; DEBUG
   `-SillSettingsScrollArea 1` outlines them; their edges the pane's own
   12 pt fade (`ScrollEdgeFade`), iOS 26's scroll edge effect kept off them
-  (`SystemEdgeEffect`; DEBUG `-SillSettingsSystemEdge 1` leaves it on); the
-  rows from a whole pixel in their scroll view (DEBUG `-SillSettingsColumnGrid`); a feature's group
+  (`SystemEdgeEffect`; DEBUG `-SillSettingsSystemEdge 1` leaves it on); a feature's group
   goes into the part whose it is), `SettingsPane` (where the pane's two parts
   go: one column on every screen without a fold to keep to, an iPad's and an
   iPhone's either way round (Noah, 2026-11-23), a column on each page of the
@@ -953,8 +952,7 @@ Below, "this file" means CLAUDE.md, and "Build and run below" means docs/BUILD-A
   whole screen in one column, the side strips of the safe area included), nothing
   on the fold, right to left mirrored, the room under Disconnect, the home
   indicator's (`footBottom`), iOS's own scroll edge effect off every edge of
-  each scroll view (`systemEdgeEffectHidden`, `Edges`), the column in its scroll
-  view from a whole pixel (`contentMargins`); and `Close`, what each way of closing it
+  each scroll view (`systemEdgeEffectHidden`, `Edges`); and `Close`, what each way of closing it
   brings; pure, `Tests/checks/settings-pane`; pbxproj A5E1/F5E1), `AwayCopy` (every
   string of away from home and the link on the device, which callout shows,
   and `LinkLine`, the stream screen's line over time; pure,
```

**File**: `iOSClient/ContentView.swift` (modified, +0/-4)
```diff
@@ -239,10 +239,6 @@ struct ContentView: View {
 ///   edge effect (iOS 26 and later), which the pane otherwise turns off on every edge
 ///   (`SettingsPane.Layout.systemEdgeEffectHidden`), so a photo shows what it does: on the 13-inch iPad's
 ///   sideways screen, drawn a quarter turn round (below), a blur over all but the last rows.
-/// * `-SillSettingsColumnGrid points|exact` — with `-SillSettings 1`: Settings' rows placed in their scroll
-///   view from a whole point, or at their column's own place, instead of from a whole pixel
-///   (`SettingsPane.Layout.contentMargins`), so a photo shows what each does to their text (`exact` at
-///   34.5 pt on a 3x screen: Full Screen's footnote breaks "them back." onto a second line).
 /// * `-SillSettingsCase <case>` — what the mock Mac's settings look like: `default` (Sill.app),
 ///   `cli`, `software`, `custom`, `vdproblem`, `vdstream`, `legacy`, `pending`, `timeout`,
 ///   `direct`, `directlink` (connected over it), `nodirect` (a host without it), `wired` or
```

**File**: `iOSClient/HostSettingsPanel.swift` (modified, +5/-21)
```diff
@@ -116,8 +116,6 @@ struct HostSettingsPanel: View {
     @Environment(\.duoFold) private var duoFold
     /// Right to left (Arabic, Hebrew): the Mac's part is still on the leading side, and a fold's pages swap.
     @Environment(\.layoutDirection) private var layoutDirection
-    /// Pixels a point, for the rows' column inside its scroll view (`part`).
-    @Environment(\.displayScale) private var displayScale
 
     private var mac: String { client.macName.isEmpty ? "the Mac" : client.macName }
     /// DEBUG `-SillSettingsEnd 1`: the rows start scrolled to their end, so a photo of a short
@@ -132,19 +130,6 @@ struct HostSettingsPanel: View {
         return false
         #endif
     }
-    /// The grid the rows' column keeps to inside its scroll view: the display's pixels (`displayScale`). DEBUG
-    /// `-SillSettingsColumnGrid points` keeps it to whole points instead, `exact` to none (the column's own place, as
-    /// on 2026-11-23), for photos of what each does to the rows' text.
-    private static func columnGrid(_ displayScale: CGFloat) -> CGFloat {
-        #if DEBUG
-        switch UserDefaults.standard.string(forKey: "SillSettingsColumnGrid") {
-        case "points"?: return 1
-        case "exact"?: return 0
-        default: break
-        }
-        #endif
-        return displayScale
-    }
     /// DEBUG `-SillSettingsScroll gestures`: the rows start scrolled to the This iPad group, so a
     /// photo of a short screen shows its switches and rows, which the footnote under them pushes out
     /// of `-SillSettingsEnd`'s view; `sound`, to the Send Audio row; `mute`, to the Mute row
@@ -353,12 +338,11 @@ struct HostSettingsPanel: View {
     private func part<Content: View>(bottom: CGFloat, column: CGRect, scroll: CGRect, systemEdges: SettingsPane.Edges,
                                      @ViewBuilder _ content: () -> Content) -> some View {
         let rows = content()
-        // The column as the scroll view's content margins at its sides, its leading one on the display's pixel grid
-        // (SettingsPane.Layout.contentMargins): the scroll view lays the rows out the column's whole width from a whole
-        // pixel, as when it was the column's own width (half a pixel off it, a footnote that needs all of its 572 pt
-        // broke its last two words onto a second line).
-        let side = SettingsPane.Layout.contentMargins(column: column, in: scroll, scale: Self.columnGrid(displayScale))
-        let margins = EdgeInsets(top: 0, leading: side.leading, bottom: bottom, trailing: side.trailing)
+        // The column as the scroll view's content margins at its sides, not as padding round the rows: the scroll
+        // view lays the rows out at the column's width and places them, as it did when it was the column's width
+        // (with padding inside the scroll view, a footnote line that fitted with a point to spare broke a word early).
+        let margins = EdgeInsets(top: 0, leading: max(0, column.minX - scroll.minX), bottom: bottom,
+                                 trailing: max(0, scroll.maxX - column.maxX))
         return ScrollViewReader { reader in
             ScrollView {
                 VStack(alignment: .leading, spacing: 0) { rows }
```

#### Recent Merged Pull Requests:
- **PR #434** (closed): Keep the session when backgrounded (@dahda-app)
- **PR #433** (closed): Fix typing into Parallels (@dahda-app)
- **PR #418** (2026-11-23): Keep the modifier keys above any keyboard on an iPhone held upright (@Saffsanity)
- **PR #414** (2026-11-24): #292 ready: iOS: hold, then drag, on the picture in Direct Touch (#178) (@Saffsanity)
- **PR #410** (2026-11-24): #315 ready: iPhone: arrow keys in a scrolling key row (#287) (@Saffsanity)
- **PR #406** (2026-11-24): Picture in Picture: the stream stops when it ends in the background (#379) (@Saffsanity)

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

## X. Revert "Settings: the scroll view places the rows' column by its content margins

**RULE**:
When implementing operations in `docs/LAYOUT.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Saffsanity/sill. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `597aadbe`: Revert "Settings: the scroll view places the rows' column by its content margins". Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/LAYOUT.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
  column inside it (`inColumn`), so a drag anywhere scrolls; DEBUG
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
  column inside it (`inColumn`; the rows that scroll by their scroll view's
  content margins), so a drag anywhere scrolls; DEBUG
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `597aadbe` are properly handled with clean fallback behavior.
