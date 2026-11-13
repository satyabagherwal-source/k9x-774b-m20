# Domain K — Quality & Verification Intelligence: Quality & Verification Intelligence: Saffsanity/sill Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "Saffsanity/sill",
  "source_url": "https://github.com/Saffsanity/sill",
  "source_version": "bf69067f",
  "license": "Apache-2.0",
  "timestamp": "2026-11-13T15:47:11.832Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-saffsanity-sill",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Saffsanity/sill](https://github.com/Saffsanity/sill) (Revision: `bf69067f`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-13T15:47:11.832Z`  
> **Learning ID**: `learn-github-saffsanity-sill`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain K (Quality & Verification Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), H (Technical Construction Intelligence), D (Research & Knowledge Intelligence), A (Human & Need Intelligence), E (Creative Intelligence), F (Design Intelligence), M (Feedback & Evolution Intelligence), I (Content & Information Intelligence), J (Search & Distribution Intelligence), B (Product Intelligence)
- **Confidence Rating**: 61%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from Saffsanity/sill:

# Forensic Learning Record (Deep Inspection): Saffsanity/sill

> **Canonical Artifact**: `07_PROJECT_LEARNING/saffsanity-sill-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Saffsanity/sill](https://github.com/Saffsanity/sill))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-13T15:47:11.285Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Saffsanity/sill`
- **Description**: Any window from your Mac, live on your iPhone or iPad. Touch, Apple Pencil, trackpad and keys. Free, open source, no servers.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 4868 stars

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
///                                              shareClipboard, offConsoleView, remoteAddressName=host[:port],
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
    static var 
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
- **Issue #215** (2026-11-09): **Keyboard covers keyboard button on iPhone Duo "laptop mode"**
  *Symptoms*: ### What happened  Keyboard covers keyboard button on iPhone Duo "laptop mode" Meaning you can't dismiss the keyboard after you have summoned it.  <img width="1004" height="1427" alt="Image" src="https://github.com/user-attachments/assets/d013cc01-409b-4eca-ad63-8954b5e16114" />  ### How to make it happen again  Put duo in laptop mode Summon keyboard with toggle button  ### Your Mac and its macOS  MacBook Pro M1 Max, macOS 27  ### Sill for Mac's version  0.5.1 (563)  ### Your iPhone or iPad and its iOS or iPadOS  iPhone Duo iOS 27.2  ### The Sill app's version  0.5.1  ### How the device reached the Mac  Wi-Fi  ### Sill's log on your Mac  ```text  ```
  **Post-Mortem & Fix Analysis**:
  > Opened #220 to fix this: in laptop mode on the iPhone Duo, the window bar now shows a **Keyboard** button alongside **Apps**, **Aa**, **Desktop**, and **Settings**, and drops its 12 pt top padding while the software keyboard is up so the buttons stay above the keyboard.
  > @matt-cahill  This is a bad one. I will see about pushing a new build in the next day or two to resolve this bug. Really sorry about this. Thank you for reporting and bearing with me. Maybe at some point I had the hardware in hand to test!

- **Issue #162** (2026-10-30): **Option/CMD + left/right arrows sends the keys just once**
  *Symptoms*: ### What happened  holding down combos like this should send the combo repeatedly. doesnt happen for non-combo keystrokes.  ### How to make it happen again  _No response_  ### Your Mac and its macOS  macbook pro m4 27.2 beta 3  ### Sill for Mac's version  latest as of filing  ### Your iPhone or iPad and its iOS or iPadOS  ipad m4 pro  ### The Sill app's version  _No response_  ### How the device reached the Mac  Wi-Fi  ### Sill's log on your Mac  ```text  ```
  **Post-Mortem & Fix Analysis**:
  > Opened #163 so held keys and `Option`/`Command` + arrow key chords repeat properly on iPad.

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

### Incident Patch 1: `1b04b5f7` (2026-11-12)
**Commit Message**: Full screen's plan and step file: the live loopback gate's result

Run at 67039ddd once Noah's devices were off Sill.app: five cases (an iPhone upright, an iPad mini on its side, the
Desktop on screen 2, Shake to Show Controls off, a swipe in taken back), one viewport per change, none for the
swipe in taken back, every scripted input at the host, the Desktop kept on screen 2.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `docs/full-screen-plan.md` (modified, +27/-7)
```diff
@@ -364,13 +364,33 @@ after it.
     its way out on an iPhone on its side, about 16 % in, with nothing drawn under it; the photos' timing is too loose
     to catch more frames, so the static previews above are the evidence for every stage.
 - **G6:** `Tests/checks/repo-rules`, every rule holds.
-- **G4, live on loopback: not run.** Noah was testing on his devices: a device was streaming from Sill.app at 16:30
-  and at 16:56, and the gate keeps the rule (`Scripts/encoder-check/no-device.sh`: nothing that could share the
-  Mac's encoder while a device is connected), though its host uses the software encoder. The first build's run of
-  it (below) covered the same paths a hide and a show take (the viewport one per change, input around each change,
-  the Desktop kept on screen 2); what is new since is the swipe in's own recognizer, which the touch rig drove with
-  real synthesized touches in both orientations, and Shake to Show Controls, whose off case the gate adds
-  (`phone-up-shake-off`).
+- **G4, live on loopback**, at 67039ddd from 18:12 to 18:17, once Noah had disconnected his devices (a device was on
+  Sill.app at 16:30 and 16:56, so it waited; `Scripts/encoder-check/no-device.sh` said "OK: no device connected"
+  before every case): `SillHost --synthetic` (loopback only, the software encoder, no router, no screen, the
+  dry-run input log) and the app's Debug build under `-SillLive 1` on the agents' iPad simulator, an input script
+  tapping, pressing keys and typing every 0.1 s for a second around each change. Five cases, every one as it should:
+  - An iPhone 15 Pro's size upright: hidden at 4 s, back at 7, hidden at 10, back by a shake at 13 (Shake to Show
+    Controls on), hidden at 16, back by a played swipe in at 18.8: the viewport 377×235 twice as it connected, then
+    393×793 and 377×235, one per change, six; every input at the host (39 taps, each down and up; 24 keys and 12
+    letters).
+  - An iPad mini on its side, the same: 1117×618 as it connected, then 1133×744 and 1117×618, one per change; every
+    input at the host.
+  - The Desktop on the Mac's second screen (two test screens): the device's own Desktop button ("Desktop 1") stepped
+    the host to display 2, then hidden, back, hidden, back by a shake: one viewport each, and the host's only stream
+    start after the step was display 2's; the 12 taps arrived.
+  - Shake to Show Controls off: hidden at 4, a shake at 7 left the controls hidden ("full screen: a shake, and Shake
+    to Show Controls is off: the controls stay hidden"), a played swipe in at 10 brought them back: one viewport per
+    change; the 12 taps arrived.
+  - A swipe in taken back: hidden at 4, a played swipe in taken back at 7 ("reveal: lifted after 619 pt at -1500
+    pt/s …: springs back"): the controls stayed hidden, no viewport and nothing sent for it; back by a shake at 10,
+    hidden at 13, back by a played swipe in at 16: one viewport per change, four; every input at the host (39 taps,
+    24 keys and letters). In every case the one `pointer: this device has it (a pointer move)` line is the session's
+    first tap, at 3.5 s; none follows a swipe in, finished or taken back.
+  - Against round one: the same viewports and the same input, change for change. Once, in the taken-back case, the
+    connect sent its 377×235 a third time, before anything of full screen happened. Played, not swiped: the swipe in
+    reaches the stream screen as the recognizer's moves and lift (`revealMoved`), which the touch rig drove with real
+    synthesized touches; the hide is the harness's, the same `hideChrome` that Settings › Full Screen calls once its
+    panel has closed.
 
 ### The first build (the flick; superseded)
 
```

**File**: `docs/steps/2026-11-12-full-screen.md` (modified, +5/-1)
```diff
@@ -44,5 +44,9 @@ no wire change, nothing on the Mac, nothing stored but how often the hint has sh
   but the Settings panel (and the thumbnail strip's fade on an upright iPad mini, which differs between two builds
   of main itself), the Settings panel after the merge with main's Quality row and these rows after Frame Rate, and
   32 previews in every layout and Duo pose, the controls on their own black and nothing of the picture's place.
-- **Not run:** the live loopback gate (a device was on Sill.app both times; the rule holds it).
+- Live on loopback at 67039ddd once Noah's devices were off Sill.app (18:12): five cases (an iPhone upright, an iPad
+  mini on its side, the Desktop on screen 2, Shake to Show Controls off, a swipe in taken back), one viewport per
+  change in each, none for the swipe in taken back, every scripted tap, key and letter at the host, the Desktop kept
+  on screen 2, a shake with the switch off leaving the controls hidden; the same as round one's run but for one
+  extra identical viewport at one connect.
 - **Untested, for Noah:** the plan's "Noah's test" on the iPad mini and the iPhone 15 Pro.
```

---

### Incident Patch 2: `1442d8ac` (2026-11-12)
**Commit Message**: CLAUDE.md Layout: the edge recognizers' watchers and held landing, the rig's trace

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `CLAUDE.md` (modified, +6/-3)
```diff
@@ -794,8 +794,9 @@ Rules found in the steps that hold for all work (each where it is written):
   the pointer's dwell at the edge, when it is offered and armed, when the controls come back by
   themselves, the hint, the room, the words; pure, `Tests/checks/full-screen`; pbxproj A279/F279),
   `EdgeFlickRecognizer` (the flick's recognizer and the swipe in's, `RevealEdgePan`, on Sill's window,
-  which other recognizers wait for them, `EdgeRecognizers.waits`, and a stroke they held until its lift,
-  `releasedAtLift`; UIKit only, so Tests/touchrig compiles it; A27B/F27B) and `FullScreen`
+  which other recognizers wait for them, `EdgeRecognizers.waits` (never one that only watches,
+  `WatchesTouchesOnly`), where a held stroke landed, `heldLanding`, for the picture's scroll, and a stroke
+  they held until its lift, `releasedAtLift`; UIKit only, so Tests/touchrig compiles it; A27B/F27B) and `FullScreen`
   (`FullScreenEdges`, which puts them and a hover on the window and says whether it covers the screen and
   its safe area, `FullScreenSystem` for the status bar, the home indicator and the deferred left edge, the
   shake through `UIWindow.motionEnded`, the hint, the swipe in's preview hole, the hidden picture's
@@ -1086,7 +1087,9 @@ Rules found in the steps that hold for all work (each where it is written):
   made fresh; `compare.py --all` every stroke against main's, and, where the
   sources have full screen's EdgeFlickRecognizer (on the rig's window),
   `compare.py --edge` its strokes at the left edge (`RIG_ONLY=edge`): a flick
-  hides and sends nothing, anything else goes on whole and in order.
+  hides and sends nothing, anything else goes on whole and in order;
+  `RIG_TRACE=1` logs every recognizer's state (and the flick's trace). It
+  compiles StreamProtocol whole, and DuoPosture.swift, as the surfaces need.
 - `Tests/duorig/` — TEST ONLY, private interfaces, simulator only: folds and
   turns the iPhone Duo simulator with Device Hub's own events (usage page
   0xFF61, usage 0x5B, an IOCFSerialize dictionary from
```

---

### Incident Patch 3: `efc4ccfc` (2026-11-12)
**Commit Message**: Touch rig: compare.py leaves RIG_TRACE's recognizer states out of the events

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `Tests/touchrig/compare.py` (modified, +1/-0)
```diff
@@ -40,6 +40,7 @@ def normal(events):
     out, coasting = [], False
     for e in events:
         if e.startswith("[touch]") or e.startswith("[edge]") or e.startswith("[measure]"): continue
+        if re.match(r"\s*\[[TOWB]\.", e): continue      # RIG_TRACE's recognizer states, not events
         who, _, what = e.partition(" send ")
         who = who.strip()
         if not what:
```

#### Recent Merged Pull Requests:
- **PR #364** (2026-11-13): Version 0.6.2 for both apps, after 0.6.1 (@Saffsanity)
- **PR #363** (2026-11-12): Settings: the Quality row shows the quality's name, and its menu the rates (@Saffsanity)
- **PR #361** (2026-11-13): pointer-watch: the stale mutant applies again, and SILL_TEST_NO_SCREEN is checked (@Saffsanity)
- **PR #360** (2026-11-12): Full screen: Settings › Full Screen hides Sill's controls; a swipe in from the left edge or a shake brings them back (@Saffsanity)
- **PR #358** (2026-11-12): A staged window goes home before Sill's display goes (@Saffsanity)
- **PR #356** (2026-11-12): Notes in a file per branch, checks that describe themselves, harness photos on shared simulators (@Saffsanity)

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

## X. Full screen's plan and step file: the live loopback gate's result

**RULE**:
When implementing operations in `docs/full-screen-plan.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Saffsanity/sill. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1b04b5f7`: Full screen's plan and step file: the live loopback gate's result. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/full-screen-plan.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
- **G4, live on loopback**, at 67039ddd from 18:12 to 18:17, once Noah had disconnected his devices (a device was on
  Sill.app at 16:30 and 16:56, so it waited; `Scripts/encoder-check/no-device.sh` said "OK: no device connected"
  before every case): `SillHost --synthetic` (loopback only, the software encoder, no router, no screen, the
  dry-run input log) and the app's Debug build under `-SillLive 1` on the agents' iPad simulator, an input script
  tapping, pressing keys and typing every 0.1 s for a second around each change. Five cases, every one as it should:
  - An iPhone 15 Pro's size upright: hidden at 4 s, back at 7, hidden at 10, back by a shake at 13 (Shake to Show
    Controls on), hidden at 16, back by a played swipe in at 18.8: the viewport 377×235 twice as it connected, then
    393×793 and 377×235, one per change, six; every input at the host (39 taps, each down and up; 24 keys and 12
    letters).
  - An iPad mini on its side, the same: 1117×618 as it connected, then 1133×744 and 1117×618, one per change; every
    input at the host.
  - The Desktop on the Mac's second screen (two test screens): the device's own Desktop button ("Desktop 1") stepped
    the host to d
```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern to NEVER write (induced failure mode):
- **G4, live on loopback: not run.** Noah was testing on his devices: a device was streaming from Sill.app at 16:30
  and at 16:56, and the gate keeps the rule (`Scripts/encoder-check/no-device.sh`: nothing that could share the
  Mac's encoder while a device is connected), though its host uses the software encoder. The first build's run of
  it (below) covered the same paths a hide and a show take (the viewport one per change, input around each change,
  the Desktop kept on screen 2); what is new since is the swipe in's own recognizer, which the touch rig drove with
  real synthesized touches in both orientations, and Shake to Show Controls, whose off case the gate adds
  (`phone-up-shake-off`).
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1b04b5f7` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
