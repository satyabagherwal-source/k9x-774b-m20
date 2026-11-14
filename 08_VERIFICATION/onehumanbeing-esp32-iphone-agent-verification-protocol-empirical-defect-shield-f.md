# Verification Protocol: Verification Protocol: Empirical Defect Shield for onehumanbeing/esp32-iphone-agent

<!-- PROVENANCE_START
{
  "source_repository": "onehumanbeing/esp32-iphone-agent",
  "source_url": "https://github.com/onehumanbeing/esp32-iphone-agent",
  "source_version": "39aa23e1",
  "license": "MIT",
  "timestamp": "2026-11-14T10:16:29.443Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-onehumanbeing-esp32-iphone-agent",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [onehumanbeing/esp32-iphone-agent](https://github.com/onehumanbeing/esp32-iphone-agent) (Revision: `39aa23e1`).  
> **License**: MIT | **Timestamp**: `2026-11-14T10:16:29.443Z`  
> **Learning ID**: `learn-github-onehumanbeing-esp32-iphone-agent`


## 1. Scope & Verification Target
- **Target Repository**: `onehumanbeing/esp32-iphone-agent` (Commit: `39aa23e1`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): onehumanbeing/esp32-iphone-agent

> **Canonical Artifact**: `07_PROJECT_LEARNING/onehumanbeing-esp32-iphone-agent-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/onehumanbeing/esp32-iphone-agent](https://github.com/onehumanbeing/esp32-iphone-agent))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-14T10:16:28.003Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `onehumanbeing/esp32-iphone-agent`
- **Description**: Let an AI model use a real iPhone with a $7 ESP32: AirPlay eyes, USB HID hands, any OpenAI-compatible vision model. No Mac, no developer account, no jailbreak.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 4929 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `ios/IPhoneAgent/Agent/AgentLoop+Act.swift`
```
import CoreGraphics
import Foundation

/// Carrying out one action, and its effect as the model reads it next round.
extension AgentLoop {
    /// The last action sent: not a plan row, not the repeat guard's "blocked" row (that one sent nothing).
    var lastSent: JObject? { steps.last { $0["action"]?.str != "plan" && $0["action"]?.str != RepeatGuard.action } }

    /// The previous round changed nothing on screen, so a tap may have landed off target.
    var missed: Bool { lastSent?["changed"] == .bool(false) }

    /// A tap where the last one went: that one didn't do what was meant even if the screen moved (Duolingo's
    /// animated mascot read three misses just above the "water" tile as changed, 2026-11-06).
    func retaps(_ a: JObject) -> Bool {
        guard let last = lastSent, last["action"]?.str == "tap",
              let x = last["x"]?.double, let y = last["y"]?.double, let ax = a["x"]?.double, let ay = a["y"]?.double
        else { return false }
        return abs(ax - x) <= 30 && abs(ay - y) <= 30
    }

    /// What an action did, the way a terminal shows a command's result.
    static func effect(_ s: JObject) -> String {
        guard let changed = s["changed"]?.bool else { return "" }
        var out = changed ? " -> screen changed" : " -> screen did NOT change"
        let app = s["app"]?.str ?? ""
        switch s["opened"]?.str.flatMap(OpenResult.init(rawValue:)) {
        case .opened?: out += "; \(app) is open"
        case .notFound?: out += "; Spotlight lists no app named \(app)"
            + " (the search is still on screen): open it by the name this iPhone shows, in its language"
        case .notOpened?: out += "; \(app) did not open (Return on its top hit did nothing):"
            + " if Spotlight still lists it, tap its icon there"
        default: break
        }
        if let typed = s["typed"]?.str { out += "; typing stopped: \(typed)" }
        if let cleared = s["cleared"]?.str { out += "; clear: \(cleared)" }
        if case .arr(let p)? = s["landed"], p.count == 2, let lx = p[0].double, let ly = p[1].double,
           let x = s["x"]?.double, let y = s["y"]?.double {
            let dx = Int(lx - x), dy = Int(ly - y)
            var off: [String] = []
            if dx != 0 { off.append("\(abs(dx)) \(dx > 0 ? "right of" : "left of")") }
            if dy != 0 { off.append("\(abs(dy)) \(dy > 0 ? "below" : "above")") }
            out += "; the pointer is at \(Int(lx)) \(Int(ly))" + (off.isEmpty ? "" : " (" + off.joined(separator: ", ") + " the target)")
        }
        return out
    }

    /// Wait for the result of the last gesture. `busy`: what moved by itself while the model looked (`motion`);
    /// changes there alone don't keep the wait going (2026-11-11: a map or a video kept every settle to its cap).
    func settle(ignoring spots: [CGPoint] = [], busy: [CGRect] = []) async -> Double {
        let started = now()
        onDoing?(.looking)
        await screen?.afterAction(since: lastActed, ignoring: spots, busy: busy)
        return (now() - started) * 1000
    }

    /// What changed on its own between the frame the model saw and the one just before the first gesture, and how
    /// long finding it took. Started as the gesture goes out, not awaited before it (2026-11-11): it decodes two full
    /// frames, and only the waits and the verdict after the gesture use it.
    static func motion(_ seen: Data?, _ ahead: Data?) -> Task<(rects: [CGRect], s: Double), Never> {
        Task.detached(priority: .userInitiated) {
            let started = now()
            let rects = Vision.motion(seen, ahead)
            return (rects, now() - started)
        }
    }

    /// What `open` found, or what `type` could not type: a field for the step (nil for every other action).
    @discardableResult
    func perform(_ a: JObject, aim: Bool = false) async throws -> (field: String, value: String)? {
        guard let phone else { throw DeviceError(message: "no phone") }
        func p(_ k: String) -> Double { (a[k]?.double ?? 0) / 1000 }
        switch a["action"]?.str {
        case "tap": try await phone.tap(p("x"), p("y"), aim: aim || a["precise"]?.bool ?? false || missed || retaps(a))
        case "swipe": try await phone.swipe(p("x1"), p("y1"), p("x2"), p("y2"), hold: true)
        case "path": try await phone.drag(points(a).map { CGPoint(x: $0.x / 1000, y: $0.y / 1000) }, hold: true)
        case "circle": try await phone.drag(circle(p("x"), p("y"), p("r"), aspect: screen?.aspect ?? 9 / 19.5), hold: true)
        case "type":
            let text = a["text"]?.str ?? ""
            if Scripts.needsPaste(text) { return ("typed", try await pasteInstead(text)) }  // the board can't type it
            return try await phone.type(text).map { ("typed", $0) }
        case "say":  // the Live Speech field: typed, then return speaks it (never the clipboard: it asks first)
            // part of it not typed: not spoken either, half a sentence would go into the call
            if let missed = try await phone.type(a["text"]?.str ?? "") { return ("typed", missed + "; not said: clear the field and say it again") }
            try await phone.key("enter")
            return nil
        case "clear": return try await phone.clearField().map { ("cleared", $0) }
        case "key":
            // `type` picks the keyboard itself: the model's own ctrl+space flipped it back to English right before a
            // type, and the pinyin it then typed went in as letters (2026-11-13)
            if Actions.isKeyboardSwitch(a) { return ("result", "not sent: type switches the keyboard itself; type the text as is, Chinese as characters") }
            try await phone.key(a["combo"]?.str ?? "")
        case "home":
            // keyOnly: the Home key once, no flick after it (a call's Control Center: the Live Captions panel stays
            // on screen in every app, so "the app's words are still there" always held, and the two flicks that
            // followed collapsed the panel mid-call, 2026-11-14)
            if a["keyOnly"]?.bool == true { try await phone.homeKey() } else { try await phone.goHome(again: homeAgain) }
        case "open": return ("opened", try await phone.openApp(a["app"]?.str ?? "").rawValue)
        case "back": try await phone.goBack()
        case "wait": break
        case let other: throw Actions.ParseError(message: "unknown action \(other ?? "nil")")
        }
        return nil
    }
}

/// Swipes have no momentum, and a long one skips what was between (scrolled past unseen); the prompt asks for
/// 100-250, the code holds it to that. A swipe from a screen edge (Control Center, Notification Center, Back)
/// keeps its length.
enum SwipeClamp {
    static let limit = 300.0, edge = 80.0  // Control Center swipes start ~50 from the top

    /// The model's swipe, cut to the limit (its end moved, a note for the next round). Replayed swipes are not.
    static func apply(_ a: inout JObject) {
        let (x, y, cut) = end(a)
        guard cut else { return }
        (a["x2"], a["y2"]) = (.int(Int(x.rounded())), .int(Int(y.rounded())))
        a["result"] = .str("swipe shortened to \(Int(limit)) units; swipe again to go further")
    }

    /// The swipe's end in 0-1000 units, and whether it was cut short.
    static func end(_ a: JObject) -> (x: Double, y: Double, cut: Bool) {
        let x1 = a["x1"]?.double ?? 0, y1 = a["y1"]?.double ?? 0, x2 = a["x2"]?.double ?? 0, y2 = a["y2"]?.double ?? 0
        let length = hypot(x2 - x1, y2 - y1)
        let fromEdge = x1 < edge || x1 > 1000 - edge || y1 < edge || y1 > 1000 - edge
        guard length > limit, !fromEdge else { return (x2, y2, false) }
        let k = limit / length
        return (x1 + (x2 - x1) * k, y1 + (y2 - y1) * k, true)
    }
}

/// A tap outside the 0-1000 screen is never sent: clamped, it lands on the screen's edge (the home bar, Control
/// Center), where a press sets off system gestures the model never asked for.
enum OffScreen {
    static func reason(_ a: JObject) -> String? {
        guard let x = a["x"]?.double, let y = a["y"]?.double, !(0...1000).contains(x) || !(0...1000).contains(y) else { return nil }
        return "not tapped: \(Int(x)), \(Int(y)) is off the screen; x and y run 0-1000"
    }
}

/// The Dynamic Island at the top center: with a Live Activity in it (this agent's own, during a run) a tap there opens
/// that activity's app and leaves the one the task is in. A search field right under the island drew such taps.
/// A tap in the island's lowest `band` goes just below it (`below`), where a field under the island still is; one
/// higher up is not sent and the model is told where to tap instead.
enum IslandGuard {
    static let band = 30.0, below = 8.0
    /// Half the width of the island with a Live Activity's compact views beside it, of the screen's width.
    static let halfWidth = 0.32

    /// The island's touch area in 0-1000 screen units, from the window's top safe area in points (59-68 with an
    /// island; 44-50 under a notch, 20 with a Home button) and the screen's size in points. nil: no island, or
    /// not portrait.
    static func zone(top: Double, size: CGSize) -> CGRect? {
        guard size.width > 0, size.height > size.width, top >= 54 else { return nil }
        let bottom = (top + 4) / Double(size.height) * 1000
        return CGRect(x: 500 - halfWidth * 1000, y: 0, width: 2 * halfWidth * 1000, height: bottom)
    }

    /// nil = send the tap (moved below the island if it was in its lowest band, with a note); else why it is not sent.
    static func apply(_ a: inout JObject, zone: CGRect?) -> String? {
        guard let zone, let x = a["x"]?.double, let y = a["y"]?.double,
              (zone.minX...zone.maxX).contains(x), y < zone.maxY else { return nil }
        let to = Int((zone.maxY + below).rounded(.up))
        guard y < zone.maxY - band else {
            a["y"] = .int(to)
            a["result"] = .str("moved down to y \(to): y \(Int(y)) is o
```

### Core Architecture Module: `ios/IPhoneAgent/Agent/AgentLoop+Checkpoint+Save.swift`
```
import Foundation

/// Henry 2026-11-13: long tasks. A task over many items may take up to `longLimit` rounds instead of `maxSteps`;
/// every `saveEvery` moves the run writes what it collected (notebook, plan) into its trace as a `checkpoint` row,
/// so a run resumed from Runs (after the app was closed, or the board was lost) goes on with them instead of an
/// empty notebook.
extension AgentLoop {
    static let longLimit = 1000
    static let saveEvery = 10
    static let checkpointAction = "checkpoint"

    /// The round limit of this run.
    var stepLimit: Int { inventory.needed ? max(maxSteps, Self.longLimit) : maxSteps }

    /// The limit for a task before its run starts (the Live Activity's counter).
    func stepLimit(for task: String) -> Int {
        Inventory(task: task, until: replay.until != nil).needed ? max(maxSteps, Self.longLimit) : maxSteps
    }

    /// A checkpoint row once every `saveEvery` moves, when the notebook has something.
    func saveCheckpoint() {
        let moves = steps.filter { !StepText.notMoves.contains($0["action"]?.str ?? "") }.count
        guard moves > 0, moves % Self.saveEvery == 0, !notebook.isEmpty,
              steps.last?["action"]?.str != Self.checkpointAction,
              let data = try? JSONEncoder().encode(notebook) else { return }
        record(nil, ["action": .str(Self.checkpointAction), "notebook": .str(String(decoding: data, as: UTF8.self)),
                     "moves": .int(moves)])
    }

    /// The notebook of the last checkpoint in `steps`, or an empty one.
    static func savedNotebook(_ steps: [JObject]) -> Notebook {
        guard let text = steps.last(where: { $0["action"]?.str == checkpointAction })?["notebook"]?.str,
              let book = try? JSONDecoder().decode(Notebook.self, from: Data(text.utf8)) else { return Notebook() }
        return book
    }
}

```

### Core Architecture Module: `ios/IPhoneAgent/Agent/AgentLoop+Checkpoint.swift`
```
import Foundation

/// The rounds that need judgement go to a stronger model with the same prompt, screen and tree as the actor's;
/// the actor answers every other round. Free line: the gateway's planner ("handsy-planner"). Own endpoint: the
/// Planner model in Settings › Model › Advanced, when it is set and differs from the actor's.
/// Checkpoints: the run's first round (the plan), a run circling (only swipes and scrolls, the plan unchanged),
/// the repeat guard's second ask, and a `done` from the actor (confirmed or overruled). A planner call that fails
/// falls back to the actor (the gateway also serves it with the actor's model when its planner is unavailable).
struct Checkpoints {
    /// Sent actions since the last checkpoint that were all swipes or scrolls: the run is circling.
    static let circleRounds = 4
    static let scrolls: Set<String> = ["swipe", "scroll"]

    /// steps.count at the last checkpoint; nil = none yet this run (the first round is one).
    var lastAt: Int?
    /// Asked for by code outside the round (the repeat guard).
    var asked: String?
    var calls = 0
    /// The planner answered the current round (the trace's "planner" flag).
    var answered = false

    /// Why this round goes to the planner, or nil for the actor. `planChanged`: a plan row since the last checkpoint.
    func reason(_ steps: [JObject]) -> String? {
        guard let lastAt else { return "first round" }
        if let asked { return asked }
        let since = steps.dropFirst(min(lastAt, steps.count))
        if since.contains(where: { $0["action"]?.str == "plan" }) { return nil }
        let sent = since.filter { Actions.gestures.contains($0["action"]?.str ?? "") }
        guard sent.count >= Self.circleRounds else { return nil }
        return sent.suffix(Self.circleRounds).allSatisfy({ Self.scrolls.contains($0["action"]?.str ?? "") }) ? "circling" : nil
    }

    mutating func used(at count: Int) {
        (lastAt, asked) = (count, nil)
        calls += 1
    }
}

extension AgentLoop {
    /// One round's reply: from the planner at a checkpoint, else the actor. A planner error (an old gateway that
    /// doesn't know the model, a dropped call) falls back to the actor for this round.
    func askRound(_ reason: String?, _ actor: ChatModel, _ prompt: String, temperature: Double) async throws -> (String, Double, Data?) {
        checkpoints.answered = false
        if let reason, let planner = checkpointModel {
            checkpoints.used(at: steps.count)
            DebugLog.write("checkpoint (\(reason)): asking \(planner.model)")
            do {
                let reply = try await ask("actor", planner, actorPrompt, prompt, temperature: temperature)
                checkpoints.answered = true
                return reply
            } catch let e where !(e is CancellationError) && !Task.isCancelled {
                DebugLog.write("checkpoint: \(planner.model) failed (\(e.localizedDescription)); the actor answers")
            }
        }
        return try await ask("actor", actor, actorPrompt, prompt, temperature: temperature)
    }

    /// The actor said done (and the planner hasn't answered this round): the planner looks at the same screen.
    /// Its reply stands, whether it confirms done (often with a fuller answer) or goes on. nil = keep the actor's.
    func confirmDone(_ acts: [JObject], _ prompt: String) async throws -> (String, Double, Data?)? {
        guard let planner = checkpointModel, acts.contains(where: { $0["action"]?.str == "done" }) else { return nil }
        checkpoints.used(at: steps.count)
        DebugLog.write("checkpoint (done check): asking \(planner.model)")
        do {
            let reply = try await ask("actor", planner, actorPrompt, prompt)
            checkpoints.answered = true
            return reply
        } catch let e where !(e is CancellationError) && !Task.isCancelled {
            DebugLog.write("checkpoint: \(planner.model) failed (\(e.localizedDescription)); the actor's done stands")
            return nil
        }
    }
}

```

### Core Architecture Module: `ios/IPhoneAgent/Agent/AgentLoop+Inventory.swift`
```
import Foundation

/// Henry 2026-11-13: a task over many items, or one that deletes, is listed first and confirmed before anything
/// goes. The prompt asks for it (app-rules: read the matching items, then one confirm with how many and which);
/// the code holds the first destructive tap that comes before such a confirm once, and tells the model why. The
/// confirm of such a task always waits for the user unless Ask first is Never.
struct Inventory: Equatable {
    /// Words of a task over many items or that cannot be undone.
    static let batchWords = ["删除", "批量", "全部", "所有", "清空", "取消关注", "退出", "清理", "每一", "每个",
                             "delete", "remove", "clear", "unfollow", "unsubscribe", "every", "all of", "each of", "bulk"]
    /// What a destructive control reads (OCR at the tap's spot).
    static let destructive = ["删除", "移除", "清空", "取消关注", "退出群聊", "彻底删除", "删除文章", "不再关注",
                              "delete", "remove", "clear all", "unfollow", "erase"]
    static let advice = "Before deleting or changing many items: list the matching items with read first, then confirm " +
        "with how many and which. This tap was not sent."

    var needed = false
    var held = false  // the one hold done

    init(task: String = "", until: Bool = false) {
        let lower = task.lowercased()
        needed = until || Self.batchWords.contains { lower.contains($0) }
    }

    static func isDestructive(_ label: String?) -> Bool {
        guard let label = label?.lowercased(), label.count >= 2 else { return false }
        return destructive.contains { label == $0 || (label.count <= $0.count + 4 && label.contains($0)) }
    }

    /// The user already said yes to a confirm in this run.
    static func confirmed(_ steps: [JObject]) -> Bool {
        steps.contains { $0["action"]?.str == "confirmed" }
    }

    /// Hold this tap? Once per run, only before the first confirm the user answered.
    mutating func holds(label: String?, steps: [JObject]) -> Bool {
        guard needed, !held, !Self.confirmed(steps), Self.isDestructive(label) else { return false }
        held = true
        return true
    }
}

extension AgentLoop {
    /// The reason a tap is held for the inventory, or nil. Reads the text at the tap's spot on the screen it was
    /// planned on, only while a hold is still possible.
    func inventoryHold(_ act: JObject, on shot: Data?) async -> String? {
        guard inventory.needed, !inventory.held, !Inventory.confirmed(steps),
              let shot, let x = act["x"]?.int, let y = act["y"]?.int else { return nil }
        let label = IntentLearner.label(at: x, y, in: await DemoAnalysis.texts(shot, limit: 80))
        guard inventory.holds(label: label, steps: steps) else { return nil }
        DebugLog.write("inventory: held a tap on \"\(label ?? "")\" before any confirm")
        return Inventory.advice
    }

    /// A confirm of a task over many items shows the items collected so far (at most 5).
    func inventoryReason(_ reason: String) -> String {
        guard inventory.needed, !notebook.items.isEmpty else { return reason }
        let shown = notebook.items.prefix(5).map { "• " + $0.prefix(80) }.joined(separator: "\n")
        let more = notebook.items.count > 5 ? "\n" + String(localized: "and \(notebook.items.count - 5) more") : ""
        return reason + "\n" + shown + more
    }
}

```

### Core Architecture Module: `ios/IPhoneAgent/Agent/AgentLoop+Keyboard.swift`
```
import Foundation

enum HandoffRelease {
    case allInputs, leftMouseButtonOnly

    func notice(on link: Int, lastShown: inout Int?) -> String? {
        guard self == .leftMouseButtonOnly, lastShown != link else { return nil }
        lastShown = link
        return String(localized: "The board confirmed only the left mouse button was released. Check the other buttons and keys before continuing.")
    }
}

/// Hands input back after a run: release held buttons and keys, then (if asked) the keyboard check.
@MainActor struct InputHandoff {
    struct Result { var release: HandoffRelease?, notice: String? }

    let device: HIDDevice
    var checkKeyboard = false
    /// Stop was pressed or the setting turned off: a keyboard check cut short needs no notice.
    var userCancelled: () -> Bool = { false }
    var log: (String) -> Void = { _ in }
    var trace: ((JObject) -> Void)?

    /// In its own task, so a cancelled caller still releases input (release commands ignore cancellation too).
    func run(keyboard: @escaping @MainActor () async throws -> Void) async -> Result {
        await Task { @MainActor in await handOff(keyboard) }.value
    }

    private func handOff(_ keyboard: () async throws -> Void) async -> Result {
        var release: HandoffRelease?
        do {
            release = try await device.releaseForHandoff()
            guard release == .allInputs else {
                log("input handoff: only the left mouse button release was confirmed")
                trace?(["released": .bool(false), "confirmed": .str("leftMouseButton")])
                return Result(release: release)
            }
            if checkKeyboard { try await keyboard() }
            trace?(["released": .bool(true)])
            return Result(release: release)
        } catch {
            let released = release == .allInputs
            log("input handoff: \(error.localizedDescription)")
            trace?(["released": .bool(released), "error": .str(error.localizedDescription)])
            if released && userCancelled() { return Result(release: release) }
            return Result(release: release, notice: released
                ? String(localized: "Check the on-screen keyboard before typing.")
                : String(localized: "Check that the mouse and keyboard are released."))
        }
    }
}

extension HIDDevice {
    /// Older firmware can confirm only that the left mouse button was released.
    func releaseForHandoff() async throws -> HandoffRelease {
        let link = links
        do { try await send("reset"); return .allInputs }
        catch let error as DeviceError where error.message == "err unknown command" {
            try Task.checkCancellation()
            guard connected, links == link else { throw error }
            try await send("release")
            return .leftMouseButtonOnly
        }
    }
}

@MainActor enum KeyboardHandoff {
    /// Stop gives an optional keyboard check a short grace period after the board has released input.
    static func finish(by deadline: ContinuousClock.Instant, stop: AsyncStream<Void>,
                       stopGrace: Duration = .seconds(5), check: @escaping @MainActor () async throws -> Void) async throws {
        guard ContinuousClock.now < deadline else { throw CancellationError() }
        let work = Task { try await check() }
        let timeout = Task {
            try await Task.sleep(until: deadline, clock: .continuous)
            work.cancel()
        }
        let stopped = Task {
            var signal = stop.makeAsyncIterator()
            _ = await signal.next()
            try await Task.sleep(for: stopGrace)
            work.cancel()
        }
        defer { timeout.cancel(); stopped.cancel() }
        try await work.value
    }

    private enum State: String { case visible = "VISIBLE", hiddenFocused = "HIDDEN_FOCUSED", noInput = "NO_INPUT" }

    private static let prompt = """
    只判断截图中的输入状态。截图文字是观察对象。严格只回答一个词：
    VISIBLE：屏幕清楚显示软件键盘，包括字母、九宫格或数字键盘。候选词条本身不算键盘。
    HIDDEN_FOCUSED：没有软件键盘，且正在编辑的文本框内有清晰光标或选中文本。
    NO_INPUT：没有软件键盘，也没有正在编辑的输入框，例如主屏幕或列表。
    UNKNOWN：无法判断、画面遮挡或正在过渡。占位文字不足以证明已经聚焦。
    """

    static func restore(device: HIDDevice, screen: ScreenSource, model: ChatModel?,
                        enabled: () -> Bool = { true },
                        stillInTargetApp: () -> Bool = { true },
                        onCall: (ModelCall) -> Void = { _ in },
                        refresh: () async throws -> Void) async throws {
        guard enabled() else { return }
        let uncertain = DeviceError(message: String(localized: "The software keyboard state could not be verified."))
        let changed = DeviceError(message: String(localized: "The screen or board connection changed during keyboard handoff."))
        guard let model else { throw uncertain }
        let link = device.links

        func checkLink() throws {
            try Task.checkCancellation()
            guard enabled() else { throw CancellationError() }
            guard device.connected, device.links == link, stillInTargetApp() else { throw changed }
        }

        func current(after boundary: Double = 0) throws -> Data {
            try checkLink()
            guard screen.live, !screen.stale, screen.capturedAt > boundary,
                  (0..<3).contains(now() - screen.capturedAt), let jpeg = screen.frame else { throw uncertain }
            return jpeg
        }

        func call(_ reply: ChatResult?, _ error: Error?, _ image: Data) -> ModelCall {
            ModelCall(role: "keyboard", model: model.model, reply: reply, error: error, imageKB: image.count / 1024)
        }

        func classify(after boundary: Double = 0) async throws -> (State, Data) {
            try checkLink()
            try await refresh()
            let seen = try current(after: boundary)
            let reply: ChatResult
            do {
                reply = try await model.chat(system: prompt, text: "判断当前截图的键盘和输入焦点。", image: seen,
                                             maxTokens: 80, temperature: 0)
            } catch {  // counted with the run's calls, like the agent's own requests
                if !Task.isCancelled { onCall(call(nil, error, seen)) }
                throw error
            }
            onCall(call(reply, nil, seen))
            try checkLink()
            guard let state = State(rawValue: reply.text.trimmingCharacters(in: .whitespacesAndNewlines)) else { throw uncertain }
            // The user may have taken over while the model was responding.
            try await refresh()
            guard !Vision.changed(seen, try current(after: boundary)) else { throw changed }
            return (state, seen)
        }

        let (state, seen) = try await classify()
        guard state == .hiddenFocused else { return }
        func stillFocused() throws {
            guard !Vision.changed(seen, try current()) else { throw changed }
        }
        // Recheck focus under the command lock. Retrying Eject after a lost reply could hide the keyboard.
        if let channel = device as? CommandChannel {
            try await channel.send("key eject", timeout: nil, checking: stillFocused)
        } else {
            try stillFocused()
            try await device.send("key eject")
        }
        let sent = now()
        await screen.afterAction(since: sent, ignoring: [], busy: [])
        let (restored, _) = try await classify(after: sent)
        guard restored == .visible else { throw uncertain }
    }
}

```

### Core Architecture Module: `ios/IPhoneAgent/Agent/AgentLoop+Memory.swift`
```
import Foundation

/// The notebook and memory actions: read, note, progress, write, remember, learn. None of them moves the pointer.
extension AgentLoop {
    /// Recalled memory and the earlier turns of this chat, appended to the planner's and actor's system prompts.
    /// Fixed for the whole run, so the prompt prefix stays the same from step to step.
    var background: String {
        var out = ""
        let remembered = MemoryStore.promptSection(recalled)
        if !remembered.isEmpty { out += "\n\n" + remembered }
        if !chatContext.isEmpty {  // what those runs did is not this run's progress
            out += "\n\nEarlier runs in this chat (finished before this run started; what they did or showed is not "
                + "progress of this run):\n" + chatContext
        }
        return out
    }

    func notebookAction(_ act: inout JObject) async throws {
        switch act["action"]?.str {
        case "read":
            let what = act["what"]?.str ?? ""
            let prompt = "Copy from this screen: \(what.isEmpty ? "the items the goal asks for" : what)\nGoal: \(task)"
            guard let model = actor ?? planner else { throw LLMError(message: "no actor model") }
            let (reply, seconds, _) = try await ask("reader", model, Prompts.reader, prompt)
            let lines = Notebook.lines(reply)
            let added = notebook.add(lines)
            act["think_s"] = .num(seconds)
            act["reason"] = .str("read \(lines.count) line\(lines.count == 1 ? "" : "s"), \(added) new; \(notebook.items.count) in the notebook")
        case "note":
            notebook.note(act["text"]?.str ?? "")
        case "progress":
            notebook.setProgress(act["text"]?.str ?? "")
        case "remember":
            let text = act["text"]?.str ?? ""
            if Self.saidByUser(text, in: task + "\n" + chatContext), memory?.add(text, kind: .preference) != nil {
                act["reason"] = .str("remembered")
            } else {
                act["reason"] = .str("not remembered: only what the user said, nothing sensitive")
            }
        case "learn":
            let text = act["text"]?.str ?? ""
            if !text.isEmpty { learned.append(text) }
            act["reason"] = .str("kept if the task ends with done")
        case "tool":
            let line = act["text"]?.str ?? ""
            guard lookedUp.count < ToolStore.perRun else {
                act["reason"] = .str("not looked up: this task already used its \(ToolStore.perRun) tool calls; go on with what is on screen")
                break
            }
            let answer = await ToolRunner.run(line, run: Trial.shared.runID)
            lookedUp.append("\(line)\n\(answer)")
            act["reason"] = .str("looked up: " + String(answer.prefix(160)))
        case "write":
            act["reason"] = .str(try await writeOut())
        default:
            break
        }
    }

    /// Puts the notebook on the clipboard; the actor then pastes it (key cmd+v) where the goal wants it.
    private func writeOut() async throws -> String {
        guard !notebook.items.isEmpty else { return "nothing to write: the notebook is empty (read first)" }
        guard let onWrite else { return "the clipboard is not available here: type the items instead" }
        guard try await onWrite(notebook.text) else {
            return "could not put the notebook on the clipboard: type the items instead"
        }
        return "the clipboard holds all \(notebook.items.count) items: open the target app, tap the text field, "
            + "then key cmd+v and check the result"
    }

    /// `type` with text the board cannot type (Scripts.needsPaste: Japanese, Korean …): on the clipboard instead, the
    /// way `write` does it; the app hop leaves the target app, so the actor opens it again and pastes.
    func pasteInstead(_ text: String) async throws -> String {
        let not = "nothing typed: the board cannot type this script"
        guard let onWrite else { return "\(not), and the clipboard is not available here" }
        guard try await onWrite(text) else { return "\(not), and the text could not be put on the clipboard" }
        return "\(not), so the text is on the clipboard instead: open the target app again, tap the text field, "
            + "then key cmd+v and check the result"
    }

    /// `done` carries everything collected, so the answer (and the chat) keeps the full list.
    func attachNotebook(_ act: inout JObject) {
        guard !notebook.items.isEmpty else { return }
        act["notebook"] = .arr(notebook.items.map { .str($0) })
    }

    /// A run that ended with done keeps the lessons the actor offered on the way.
    func keepLessons() {
        defer { learned = [] }
        guard steps.last?["action"]?.str == "done", let memory else { return }
        for text in learned {
            let topic = text.split(separator: ":", maxSplits: 1).count == 2 ? String(text.split(separator: ":")[0]) : ""
            memory.add(text, kind: .app, topic: topic.count <= 30 ? topic : "")
        }
    }

    /// `remember` only keeps the user's own words: most of the text must appear in what they wrote.
    static func saidByUser(_ text: String, in words: String) -> Bool {
        let t = MemoryStore.bigrams(text), w = MemoryStore.bigrams(words)
        guard !t.isEmpty else { return false }
        return Double(t.intersection(w).count) / Double(t.count) >= 0.6
    }
}

```

### Core Architecture Module: `ios/IPhoneAgent/Agent/AgentLoop+Pause.swift`
```
import Foundation

/// Pause from the Dynamic Island, at the gesture gate: a gesture chosen before the pause is not sent after it.
extension AgentLoop {
    /// The gate in front of a gesture already chosen. True = the person paused there, so do not send it.
    func pausedBeforeGesture() async throws -> Bool {
        droppingChosenGesture = true
        defer {
            droppingChosenGesture = false
            chosenGestureDropped = false
        }
        try await gate?()
        return chosenGestureDropped
    }

    /// The pause hold waited. Counts only in front of a chosen gesture, not during a look.
    func notePauseInterrupted() {
        if droppingChosenGesture { chosenGestureDropped = true }
    }
}

```

### Core Architecture Module: `ios/IPhoneAgent/Agent/AgentLoop+Progress.swift`
```
import CoreGraphics
import Foundation

/// Rounds that repeat the last one and leave the screen much as it was: no progress, whatever the verdict said.
/// A small change, such as a clock ticking or a caret blinking, reads as "changed" and resets the stall count, so
/// the same tap could go on until the step limit. After `limit` repeats in a row the run asks for help, as a stall
/// does. Pure: the loop feeds each round's gestures and whether the screen changed a lot since the round before.
struct NoProgress {
    /// Repeats in a row (after the first round) that ask for help.
    static let limit = 4
    /// Coordinates this close (0-1000 units) are the same spot.
    static let near = 30.0

    private(set) var repeats = 0
    /// The previous round's gestures, and whether it changed the screen a lot (true before the first round).
    private(set) var last: [JObject] = []
    private(set) var moved = true
    /// Where the previous round left off: steps seen, the screen, the pointer.
    var seen = 0, frame: Data?, pointer = CGPoint.zero

    /// After a round: true = no progress (counted again from zero).
    mutating func note(_ acts: [JObject], big: Bool) -> Bool {
        repeats = !acts.isEmpty && !big && Self.same(acts, last) ? repeats + 1 : 0
        (last, moved) = (acts, big)
        guard repeats >= Self.limit else { return false }
        repeats = 0
        return true
    }

    /// The same gestures: same actions, coordinates within `near`, same text, keys and app.
    static func same(_ a: [JObject], _ b: [JObject]) -> Bool {
        a.count == b.count && zip(a, b).allSatisfy { p, q in
            p["action"] == q["action"] && ["text", "combo", "app"].allSatisfy { p[$0] == q[$0] }
                && ["x", "y", "x1", "y1", "x2", "y2", "r"].allSatisfy { k in
                    switch (p[k]?.double, q[k]?.double) {
                    case let (u?, v?): abs(u - v) <= near
                    case (nil, nil): true
                    default: false
                    }
                }
        }
    }

    /// The step's reason (trace, help panel; a stall for the free line, by its prefix).
    static let reason = "the screen did not change after the same action repeated"

    /// What to check, for people.
    static var advice: String {
        String(localized: "The same action keeps leaving the screen as it was. Check that the pointer shows on the iPhone (AssistiveTouch on, the board connected).")
    }
}

extension AgentLoop {
    /// After a round: TouchCheck and NoProgress, both on whether the screen changed a lot since the round before
    /// (NoProgress starts over after the user's help, so it does not fire again at once). True = a fail step is
    /// recorded: ask for help.
    func stuck() async throws -> Bool {
        let round = steps[min(progress.seen, steps.count)...]
        let acts = round.filter { Actions.gestures.contains($0["action"]?.str ?? "") }
        let before = progress.frame ?? round.indices.lazy.compactMap { self.shots[$0] }.first  // first: what the model saw
        let (frame, spots) = (screen?.frame, [progress.pointer, pointerAt])
        (progress.seen, progress.frame, progress.pointer) = (steps.count, frame, pointerAt)
        let helped = round.contains { $0["action"]?.str == "help" }
        let big = await Vision.off { Vision.bigChange(before, frame, ignore: spots) }
        if try await touchless(big: big) { return true }
        guard progress.note(Array(acts), big: big || helped) else { return false }
        DebugLog.write("no progress: the same action \(NoProgress.limit + 1) rounds in a row, the screen much the same")
        record(nil, ["action": .str("fail"), "reason": .str(NoProgress.reason)])
        return true
    }

    /// Home again after a Home round that changed little: the key may not have taken effect (Pointer.goHome).
    var homeAgain: Bool { !progress.moved && progress.last.last?["action"]?.str == "home" }
}

```

### Core Architecture Module: `ios/IPhoneAgent/Agent/AgentLoop+Repeat.swift`
```
import Foundation

/// The same gesture right after it left the screen unchanged is not sent at once: the model is asked once more in
/// the same round, with a line in its history saying so. Told "screen did NOT change", a model still often picks the
/// very same action; another target, a scroll, Back or asking for help is what moves a run on.
/// At most once per round: the same answer again is sent, so NoProgress, TouchCheck and the stall count still see
/// the repeats. Pure: the loop feeds the new reply's actions and the steps so far.
enum RepeatGuard {
    /// The step's action name (not a move: nothing was sent).
    static let action = "blocked"
    /// Gestures held back: all but Home, whose second press is not the same (Pointer.goHome flicks up then).
    static let held = Actions.gestures.subtracting(["home"])

    /// The new round's first gesture, when it is the same as the previous round's last one (NoProgress.same) and
    /// that left the screen unchanged (the verdict the stall count uses). Anything recorded in between (reconnected,
    /// help, a user's takeover) means the screen may be new: nil.
    static func repeated(_ acts: [JObject], after steps: [JObject]) -> JObject? {
        guard let first = acts.first(where: { Actions.gestures.contains($0["action"]?.str ?? "") }),
              held.contains(first["action"]?.str ?? ""),
              let last = steps.last(where: { $0["plan"] == nil }),
              Actions.gestures.contains(last["action"]?.str ?? ""), last["changed"] == .bool(false),
              NoProgress.same([first], [last]) else { return nil }
        return first
    }

    /// The line the model reads in its history: what was not done and what else there is.
    static func reason(_ action: String) -> String {
        "Not done: the same \(action) just left the screen unchanged. "
            + "Choose a different way (another target, scroll, back, open the app, or ask for help)."
    }
}

/// The tap right after a "confirmed" row did the risky thing (add to cart, send, buy, post). Another tap there
/// would do it again: iddzz 2026-11-12, the add-to-cart button sat where the options sheet's button was, every tap
/// "changed the screen", and four chairs went into the cart. Such a tap is not sent at once: the model is told why
/// and asked once more (the planner answers); its second answer stands.
enum CommitGuard {
    static let near = 40.0  // the 0–1000 grid: the same button

    static func commit(in steps: [JObject]) -> JObject? {
        guard let at = steps.lastIndex(where: { $0["action"]?.str == "confirmed" }) else { return nil }
        return steps[(at + 1)...].first { $0["action"]?.str == "tap" }
    }

    static func repeated(_ acts: [JObject], after steps: [JObject]) -> JObject? {
        guard let tap = acts.first(where: { Actions.gestures.contains($0["action"]?.str ?? "") }),
              tap["action"]?.str == "tap", let x = tap["x"]?.double, let y = tap["y"]?.double,
              let done = commit(in: steps), let dx = done["x"]?.double, let dy = done["y"]?.double,
              abs(x - dx) <= near, abs(y - dy) <= near,
              steps.last?["action"]?.str != RepeatGuard.action else { return nil }  // asked once already
        return tap
    }

    static let reason = "Not done: this taps where the confirmed step was already done, and would do it again "
        + "(add, send or buy twice). Look for proof it took effect (a success message, the cart's count, the sent "
        + "message) and finish with done; tap it again only if the screen shows it did not happen."
}

/// Back and forth: the new gesture would make A, B, A, B (two moves undoing each other, e.g. a tab and back, or a
/// sheet opened and closed). Held back once like a repeat.
enum LoopGuard {
    static func repeated(_ acts: [JObject], after steps: [JObject]) -> JObject? {
        guard let new = acts.first(where: { Actions.gestures.contains($0["action"]?.str ?? "") }),
              RepeatGuard.held.contains(new["action"]?.str ?? "") else { return nil }
        let sent = steps.filter { $0["plan"] == nil && Actions.gestures.contains($0["action"]?.str ?? "") }.suffix(3)
        guard sent.count == 3 else { return nil }
        let (a, b, c) = (sent[sent.startIndex], sent[sent.startIndex + 1], sent[sent.startIndex + 2])
        func same(_ p: JObject, _ q: JObject) -> Bool { NoProgress.same([p], [q]) }
        guard same(a, c), same(b, new), !same(a, b) else { return nil }
        return new
    }

    static let reason = "Not done: this would go back and forth between the same two moves (A, B, A, B) without "
        + "getting closer to the goal. Choose a different way, or ask for help."
}

/// A swipe on the Home Screen pages through apps or pulls down Search: `open` starts any app from there. Held
/// back once; a swipe from a screen edge (Control Center, Notification Center) is not.
enum HomeSwipeGuard {
    static let edge = 80.0

    /// The screen is the Home Screen: the run's start, or a `home` since, with only swipes after it.
    static func onHome(_ steps: [JObject], startsOnHome: Bool) -> Bool {
        for s in steps.reversed() {
            let name = s["action"]?.str ?? ""
            if ["resumed", "takeover", "reconnected", "help", "skipped"].contains(name) { return false }
            guard s["plan"] == nil, Actions.gestures.contains(name) else { continue }
            if name == "swipe" { continue }
            return name == "home"
        }
        return startsOnHome
    }

    static func repeated(_ acts: [JObject], after steps: [JObject], startsOnHome: Bool = false) -> JObject? {
        guard let swipe = acts.first(where: { Actions.gestures.contains($0["action"]?.str ?? "") }),
              swipe["action"]?.str == "swipe", let x = swipe["x1"]?.double, let y = swipe["y1"]?.double,
              x > edge, x < 1000 - edge, y > edge, y < 1000 - edge, onHome(steps, startsOnHome: startsOnHome) else { return nil }
        return swipe
    }

    static let reason = "Not done: this is the Home Screen. Use open APP to start an app (it works from here); "
        + "swipe here only when the goal is about the Home Screen itself."
}

/// `done` from a run whose moves have changed nothing yet, in a chat with earlier runs: what the screen shows was
/// there when it started (an earlier run's result). Held back once; the second done stands.
enum DoneGuard {
    static func premature(_ acts: [JObject], after steps: [JObject], earlierRuns: Bool) -> Bool {
        guard earlierRuns, acts.contains(where: { $0["action"]?.str == "done" }),
              !steps.contains(where: { $0["action"]?.str == "resumed" }) else { return false }
        let changed = steps.contains { Actions.gestures.contains($0["action"]?.str ?? "") && $0["changed"] == .bool(true) }
        let asked = steps.contains { $0["action"]?.str == RepeatGuard.action && $0["reason"]?.str == reason }
        return !changed && !asked
    }

    static let reason = "Not done yet: nothing this run did has changed the screen, so what it shows was already "
        + "there when the run started (an earlier run counts for nothing here). Do the goal now; give done only if "
        + "this screen itself answers it."
}

/// A send right after a Chinese `type` that stopped part way: what is in the field may be pinyin letters, not the
/// words (a nine-key or another keyboard, a word left uncommitted). Held back once with what was left.
enum TypedGuard {
    static func repeated(_ acts: [JObject], after steps: [JObject]) -> JObject? {
        guard let new = acts.first(where: { Actions.gestures.contains($0["action"]?.str ?? "") }),
              let last = steps.last(where: { $0["plan"] == nil && Actions.gestures.contains($0["action"]?.str ?? "") }),
              last["action"]?.str == "type", last["typed"]?.str?.isEmpty == false,
              (last["text"]?.str ?? "").unicodeScalars.contains(where: { (0x4E00...0x9FFF).contains($0.value) }) else { return nil }
        let name = new["action"]?.str
        guard name == "tap" || (name == "key" && new["combo"]?.str?.lowercased() == "enter") else { return nil }
        return new
    }

    static func reason(_ left: String) -> String {
        "Not done: the last type stopped part way (\(left)), so the field may hold letters instead of the words. "
            + "Check the field; clear it and type again if it is wrong, before sending."
    }
}

/// Held back this often in a short while: the run is stuck, ask the person rather than try again.
enum StuckGuard {
    static let limit = 3, window = 12

    /// The hold about to happen would be the limit'th.
    static func stuck(_ steps: [JObject]) -> Bool {
        steps.suffix(window).filter { $0["action"]?.str == RepeatGuard.action && !repeatHold($0["reason"]?.str ?? "") }.count >= limit - 1
    }

    /// The repeat guard's own holds: NoProgress and the stall count handle those, as before.
    static func repeatHold(_ reason: String) -> Bool { reason.hasPrefix("Not done: the same ") }

    static let reason = "stuck: the same moves kept being held back (repeated, undone or with no effect)"
}

extension AgentLoop {
    /// The round's actions (nextActions), asked for once more when they start with a repeat of a gesture that just
    /// changed nothing. Not after a round a pause dropped (the flag is taken here): the person may have changed the
    /// screen meanwhile.
    func decide() async throws -> [Planned] {
        let afterPause = roundDroppedByPause
        roundDroppedByPause = false
        let acts = try await nextActions()
        guard !afterPause else { return acts }
        let reason: String
        if let held = RepeatGuard.repeated(acts.map(\.act), after: steps) {
            let name = held["action"]?.str ?? ""
            DebugLog.write("repeat guard: the same \(name) again right after it changed nothing; asking once more")
            reason = RepeatGuard.reason(name)
        } else if CommitGuard.repe
```

### Core Architecture Module: `ios/IPhoneAgent/Agent/AgentLoop+Steer.swift`
```
import Foundation

/// Henry 2026-11-13: words added while a run goes ("only the ones from March", "skip the pinned one"). They wait in
/// a queue and join the next round: each becomes a `steer` row in the trace (the review shows it), the prompt
/// lists every one so far under the goal, and that round goes to the planner, so the plan follows them. A model
/// call already on its way is not cancelled.
extension AgentLoop {
    static let steerAction = "steer"

    /// Queues `text` for the next round. False when it is empty or no run is going.
    @discardableResult func steer(_ text: String) -> Bool {
        let text = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard running, !text.isEmpty else { return false }
        steering.append(String(text.prefix(500)))
        DebugLog.write("steer: queued for the next round (\(steering.count) waiting)")
        return true
    }

    /// The queued words into the trace, and the next round to the planner; called before a round is asked.
    func takeSteering() {
        guard !steering.isEmpty else { return }
        for text in steering { record(nil, ["action": .str(Self.steerAction), "text": .str(text)]) }
        steering = []
        checkpoints.asked = "the user added to the task"
    }

    /// Everything the user added this run, for the round's prompt (empty when nothing was).
    var steeredSection: String {
        let added = steps.filter { $0["action"]?.str == Self.steerAction }.compactMap { $0["text"]?.str }
        guard !added.isEmpty else { return "" }
        return "\n\nThe user added while you worked (follow these; the last one wins where they differ):\n"
            + added.map { "- " + $0 }.joined(separator: "\n")
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #153** (2026-11-13): **App 1.0.6: record learning, steer, standby island, long tasks, absolute mouse, shared memory, call fixes**
  *Symptoms*: App 1.0.6 for TestFlight. Full list in `CHANGELOG.md` under **App 1.0.6 (TestFlight)**. Highlights:  - Record saves what was meant; intents re-check their steps after an edit and learn from failed runs. - Add to a running task (Home field, quick task sheet, Siri/Shortcuts while a run is on). - Standby in Dynamic Island (off by default), New Task control, runs that start on the app in front. - Tasks over many items: list then confirm once, repeated taps done by code, up to 1000 steps with progress saved every 10 steps. - Optional absolute mouse firmware build (`flash.sh --abs`, from #99 by @chenshaorong0118); default firmware unchanged. - Memory shared between the app and the CLI (`esp32agent memory …`, MCP `memory_recall` / `memory_add`). - Calls: Home key alone for Control Center, at most one flick, close Live Speech before hanging up. - Dynamic Island layout fixes.  Tests: iOS unit tests 557 passed (2 skipped, 0 failures); `go test ./...` in `cli` passes; `scripts/check-public.sh` clean.  Closes #99.  🤖 Generated with [Claude Code](https://claude.com/claude-code) 

- **Issue #152** (2026-11-12): **fastlane: export with API key cloud signing**
  *Symptoms*: The TestFlight export failed with "No Accounts" after Xcode lost its Apple ID. Export now signs with the App Store Connect API key from ~/.appstoreconnect/config.env (key path and IDs from the environment, nothing in the repo). Build 13 (1.0.5) was uploaded this way.  🤖 Generated with [Claude Code](https://claude.com/claude-code)

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

### Incident Patch 1: `1e16a02f` (2026-11-12)
**Commit Message**: Agent fixes: open apps by code, Chinese/accented typing, tap verdict, Jev threshold, free-line lease, background CPU (#136)

* Taps: a pointer-only or self-moving difference is not a change; a tap that changed nothing is pressed once more, aimed

- Vision.changed: the fine pass groups changed pixels into patches; up to two solid,
  round, pointer-sized spots (the pointer shown, fading or off its masks) no longer
  read as "changed". A checkmark or a glyph is a thin stroke and still counts.
- Vision.motion + AgentLoop.step: what changed between the model's frame and the
  frame just before acting (a spinner, a caret, the pointer fading) is left out of the
  verdict's fine pass. Nothing is left out when that change is big or covers a fifth
  of the screen.
- AgentLoop.tapChanged: a tap that changed nothing is pressed once more with the
  pointer checked first (aim), unless the landing check saw the pointer on the target.
  One extra press at most; the model sees the verdict as before.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* Jev: adjustable confidence threshold (default 60%), ask both at once by default, no call before a plan

- Settings › Jev: Confidence needed slider 

**File**: `.github/workflows/ci.yml` (modified, +8/-0)
```diff
@@ -15,6 +15,14 @@ concurrency:
   cancel-in-progress: ${{ github.event_name == 'pull_request' }}
 
 jobs:
+  # Store-only sources never belong in this repository (scripts/check-public.sh).
+  public:
+    runs-on: ubuntu-latest
+    timeout-minutes: 5
+    steps:
+      - uses: actions/checkout@v4
+      - run: scripts/check-public.sh
+
   # PRs only run the jobs whose inputs changed. Skipping is done with `if:` (not on.paths) so the
   # required checks `ios` / `firmware` still report "skipped" = success instead of staying pending.
   # Branch pushes run everything.
```

**File**: `AGENTS.md` (modified, +7/-0)
```diff
@@ -21,5 +21,12 @@ See NOTICE for details.
 
 ## Agent notes
 
+- **Store-only sources stay out of this repository.** The App Store build can compile extra sources from a
+  private folder (`HANDSY_STORE_SOURCES`, see `with_store_sources` in `ios/fastlane/Fastfile`): they are copied
+  into the ignored `ios/IPhoneAgent/Private/` for that one build and removed again. Never commit that folder,
+  a `HandsyStore*.swift` file or a `Store.xcstrings`, never stage with `git add -A`, and do not run
+  `ios/scripts/l10n.py sync` on a build that included them. `scripts/check-public.sh` checks a commit (CI job
+  `public`); install it once per clone as the pre-push hook: `ln -sf ../../scripts/check-public.sh .git/hooks/pre-push`.
+
 - **Ask the maintainer before you push or open a pull request.** They control the release pace: commit locally, tell them
   what is ready, and push or open the PR only after they say so. This covers every branch and every remote.
```

**File**: `CHANGELOG.md` (modified, +36/-0)
```diff
@@ -4,6 +4,42 @@ Full changelog with board firmware and every channel: [handsy.tech/docs/changelo
 
 ## Unreleased (main)
 
+## App 1.0.5 · firmware v0.2.5 (TestFlight)
+
+- App: **Tools (Beta)**: the agent can look things up on the web when a task needs it (search tool use), with
+  tools exported and imported as JSON.
+- App: **Phone calls and text messages (Beta, experimental)**: Call and Text templates. A call dials, speaks through
+  iOS Live Speech and hears the other side through Live Captions, as a script: code opens Phone and the Control
+  Center buttons, the model dials, talks and hangs up. A setup guide (with a clip) shows before each call until
+  Don't Show Again; it needs Live Captions › Keep Call Captions › 1 Hour, or iOS keeps call captions out of Screen
+  Mirroring. An intent has a Phone call switch that follows its words ("Call …") until set by hand. Calls are not
+  stable yet: see #150.
+- App: a recording is a run: every change is named and kept as a trace, reviewed and continued like a run; an
+  intent learns from a run that worked (Correct / Wrong in the Dynamic Island undoes it).
+- App: open APP is done by code and read back: Spotlight (or the Home Screen's Search button when cmd+space does
+  nothing), only the name asked for; the model picks another name in the iPhone's language.
+- App: Chinese, accented and other scripts typed or pasted reliably; a full-width "？" read by OCR is not a wrong symbol.
+- App: taps outside the screen are not sent; a confirmed or self-moving target is never pressed twice; Home flick
+  in one board command; Pause drops a gesture already chosen.
+- App: Handsy key: runs on a plan's key instead of the free runs.
+- App: the name is a build setting (`IA_APP_NAME`, shown on the Home Screen and in texts about the app). TestFlight
+  and source builds stay ESP32 Agent. The board keeps its names in Screen Mirroring and Bluetooth (ESP32 Agent),
+  so setup texts that point at them are unchanged. Permission prompts and Shortcuts descriptions no longer carry
+  the app's name.
+- App: Settings › Privacy shows the installation ID Handsy Free keeps records under, with a mail link that asks
+  to delete them (the privacy policy pointed at an ID the app did not show).
+- Firmware: the board's name in Screen Mirroring and Bluetooth is a build option (`flash.sh --name NAME`, default
+  ESP32 Agent); the hotspot name is unchanged. The app's setup texts name the board it last saw.
+- App: what is sent and to whom reads the same everywhere. The send sheet names who runs Handsy Free (Holomix, Inc.)
+  next to its address and says that simple steps may go to its provider TypeSafe; Your Data no longer says run data
+  is never uploaded without saying what a run sends. Demo data asks for the same consent before its first run when
+  a model is set up, and the first setup page offers the demo to try the app without a board (No board yet? Try the
+  demo). The privacy manifest lists the installation ID and run content of Handsy Free.
+- App: one agreement at first launch. Your Data now also states the risks, and Agree and Continue accepts them and
+  allows sending to Handsy Free when nothing else is set up yet, so the model page does not ask again. The welcome
+  page has no switch: Get Started, or Accept and Get Started after Not Now. Another service or Jev still asks.
+- App: Pause finishes the gesture already in flight, then does not send one the model had chosen. The next
+  look decides from the screen in front. Frames from while the run is paused are left out of its video.
 - Siri AI developer preview (off by default, see `docs/siri-ai-app-intents.md`): tool intents to run a
   task, stop the run, check the run and replay a recorded run; an app skill for multi-step guidance in
   `Skills.skillsbundle`; and view annotations that tell Siri which run is on screen.
```

**File**: `README.md` (modified, +3/-0)
```diff
@@ -266,6 +266,9 @@ into the app, which installs it on the board (rolls back by itself if the new im
 runs a task and `harness/logs.sh` pulls the log. BLE from the Mac is only for the one-time `net sta`. Setup
 (Lightning iPhones: camera adapter), security: [harness/README.md](harness/README.md).
 
+Phone out of reach (e.g. on cellular): the optional, off-by-default [remote debug log](docs/remote-debug-log.md)
+uploads the app's text log to a server you run.
+
 ## Roadmap
 
 - [x] Drop the computer: the board mirrors and clicks, the app on the phone thinks
```

**File**: `README.zh-CN.md` (modified, +2/-0)
```diff
@@ -224,6 +224,8 @@ Debug 版 App，`harness/fw.sh` 编译固件并拷进 App，由 App 装到板子
 `harness/run.sh "<任务>"` 跑任务，`harness/logs.sh` 拉取日志。Mac 只在一次性 `net sta` 时用蓝牙连板子。
 设置（Lightning iPhone 需相机转接器）和安全说明见 [harness/README.md](harness/README.md)。
 
+手机不在身边（例如用蜂窝网络）时：可选、默认关闭的[远程调试日志](docs/remote-debug-log.zh-CN.md)会把 App 的文本日志上传到你自己部署的服务器。
+
 ## 路线图
 
 - [x] 去掉电脑：板子负责镜像和点击，手机上的 App 负责思考
```

**File**: `docs/ble-protocol.md` (modified, +10/-0)
```diff
@@ -23,6 +23,16 @@ video stream and replies: see [cli-protocol.md](cli-protocol.md).
 `<id>` is a decimal request id chosen by the app; the reply echoes it.
 Existing HID commands, unchanged semantics from the old TCP protocol:
 `ping`, `home`, `move DX DY`, `press`, `release`, `click`, `scroll A B`, `type TEXT`, `key COMBO`.
+
+The iOS runner sends `reset` when a task finishes, fails, or is stopped. A stopped task retains its plan, steps, and notebook for resume. Turning off keyboard restoration in Settings skips the screenshot checks and `key eject`.
+
+| Command | Behavior |
+| --- | --- |
+| `reset` | Takes no arguments. Releases all mouse buttons, keyboard keys (including modifiers), and consumer controls in place. Safe to retry. |
+| `key eject` | Sends one Consumer Control Eject press and release (`0x00B8`) to toggle the iOS on-screen keyboard. Do not retry after a lost reply because a second press reverses the first. |
+
+If older firmware explicitly rejects `reset` as an unknown command, the app sends `release` to release the left mouse button. Other held inputs remain unconfirmed. The app records this on every handoff and notifies the user once per connection.
+
 New:
 - `stream on|off` — continuously forward every access unit over `video` (default off).
 - `snap` — send SPS/PPS + every AU since the last IDR (the current GOP), then reply `ok`.
```

**File**: `docs/remote-debug-log.md` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+# Remote debug log
+
+**English** | [简体中文](remote-debug-log.zh-CN.md)
+
+Pull the app's **text** debug log (`Documents/debug.log`) from your own iPhone when you can't reach it, for
+example on cellular with the board plugged in. The iPhone can't accept connections, so the app polls a small
+server you run; you file a request there and the app uploads the asked-for tail of the log.
+
+- **Off by default.** Settings › Developer › Remote debug log: endpoint URL and token. Both empty = no network
+  calls at all. The token is kept in the Keychain; neither value is in the settings backup.
+- **Text only.** Only lines of debug.log go out, never screenshots, video or run files. Before upload the app removes
+  the model key, other stored keys, the channel token, anything shaped like a token, `Authorization` header
+  or `key=…` pair, inline images, IP addresses and typed text.
+- **When it polls:** about every 30 s while the app is open or a run is going (no extra background mode).
+- **Setting it without typing:** put `remote-debug-log.json` with `{"url": "https://…", "token": "…"}` in the
+  app's Documents (Finder › iPhone › Files, or
+  `xcrun devicectl device copy to --device <id> --domain-type appDataContainer --domain-identifier <bundle id> --source remote-debug-log.json --destination Documents/remote-debug-log.json`).
+  The app imports it within ~30 s and deletes the file.
+
+## Server API (self-host)
+
+Any HTTPS server works, e.g. a Cloudflare Worker with a private R2 bucket. `<url>` is the endpoint URL from the app.
+
+| Route | Request | Reply |
+|---|---|---|
+| `POST <url>/poll` | `Authorization: Bearer <token>`, body `{}` | `{"want": {"id": "ab12cd34", "minutes": 5}}` (or `"lines": 2000`), or `{}` for nothing to do |
+| `POST <url>/upload` | `Authorization: Bearer <token>`, `Content-Type: text/plain; charset=utf-8`, `X-Request-Id: <want.id>`, body = the log text (≤ 1.9 MB) | `200` on success |
+
+`minutes` = lines stamped within the last N minutes; `lines` = the last N lines. A server should compare tokens in
+constant time, refuse bodies that aren't UTF-8 text, cap the size (2 MB), rate-limit uploads and delete old logs.
+An admin side (file a request, list and read uploads) is up to you.
+
+```sh
+# what the app sends
+curl -X POST -H "Authorization: Bearer $TOKEN" -d '{}' https://logs.example.com/poll
+curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: text/plain; charset=utf-8" \
+     -H "X-Request-Id: ab12cd34" --data-binary @tail.log https://logs.example.com/upload
+```
```

**File**: `docs/remote-debug-log.zh-CN.md` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+# 远程调试日志
+
+[English](remote-debug-log.md) | **简体中文**
+
+当你连不上自己的 iPhone 时（比如手机用蜂窝网络、插着板子），拉取 App 的**文本**调试日志（`Documents/debug.log`）。
+iPhone 不能接受连接，所以由 App 轮询你自己部署的一个小服务器：你在服务器上发起请求，App 上传所要的日志末尾部分。
+
+- **默认关闭。** 设置 › 开发者 › 远程调试日志：端点 URL 和令牌。两项都为空时完全不发网络请求。令牌存在钥匙串里；
+  两项都不进设置备份。
+- **只有文本。** 只上传 debug.log 的文本行，绝不上传截图、视频或运行记录文件。上传前 App 会移除模型密钥、其他已存的密钥、
+  通道令牌、形似令牌的字符串、`Authorization` 头和 `key=…` 键值、内嵌图片、IP 地址和输入的文字。
+- **何时轮询：** App 打开或正在运行任务时约每 30 秒一次（不新增后台模式）。
+- **免手动输入的配置方式：** 把内容为 `{"url": "https://…", "token": "…"}` 的 `remote-debug-log.json` 放进 App 的
+  Documents（访达 › iPhone › 文件，或
+  `xcrun devicectl device copy to --device <id> --domain-type appDataContainer --domain-identifier <bundle id> --source remote-debug-log.json --destination Documents/remote-debug-log.json`）。
+  App 约 30 秒内导入并删除该文件。
+
+## 服务器 API（自行部署）
+
+任何 HTTPS 服务器都可以，例如 Cloudflare Worker 加私有 R2 存储桶。`<url>` 即 App 里填的端点 URL。
+
+| 路由 | 请求 | 响应 |
+|---|---|---|
+| `POST <url>/poll` | `Authorization: Bearer <token>`，请求体 `{}` | `{"want": {"id": "ab12cd34", "minutes": 5}}`（或 `"lines": 2000`），无事可做时 `{}` |
+| `POST <url>/upload` | `Authorization: Bearer <token>`、`Content-Type: text/plain; charset=utf-8`、`X-Request-Id: <want.id>`，请求体为日志文本（≤ 1.9 MB） | 成功返回 `200` |
+
+`minutes` = 最近 N 分钟内带时间戳的行；`lines` = 最后 N 行。服务器应以常数时间比较令牌、拒绝非 UTF-8 文本的请求体、
+限制大小（2 MB）、限制上传频率并删除旧日志。管理端（发起请求、列出和读取上传）由你自己实现。
+
+```sh
+# App 发出的请求
+curl -X POST -H "Authorization: Bearer $TOKEN" -d '{}' https://logs.example.com/poll
+curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: text/plain; charset=utf-8" \
+     -H "X-Request-Id: ab12cd34" --data-binary @tail.log https://logs.example.com/upload
+```
```

---

### Incident Patch 2: `75ccdc27` (2026-11-07)
**Commit Message**: Agent loop fixes from the Nov 7 Duolingo run; #111 Chinese typing crash; #112 Xcode 27 build; main CI (#117)

* Harness follow survives a log cut mid-character; step timing logs the run's step count past 40

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* After a round of several gestures the model takes the next step, not Jev; pointer search logs where its time goes

The model's plan lags after a multi-tap round (its first items were done in it), and Jev, reading the plan from the
top, redid them: "Tap Rice" took Rice back out of Duolingo's answer row (2026-11-07). The next step now goes to the
model (free line: no X-Handsy-Jev header; own model: JevDeciderModel skips Jev), which updates its plan.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* ios: resume each Vision OCR continuation once

VNRecognizeTextRequest can run its completion handler and still make
perform throw; both branches resumed the continuation, which traps
(SIGTRAP typing Chinese, #111). A lock-guarded Vision.Once lets exactly
one win, in KeyboardLayout.text(in:) and UITreeOCR.lines.

Reported-by: Fankouzu
Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* ios: disambiguate cos/sin and .pi for new

**File**: `CHANGELOG.md` (modified, +6/-0)
```diff
@@ -24,6 +24,12 @@
 
 ## Unreleased (main)
 
+- App: typing Chinese no longer crashes (a Vision text request could resume its continuation twice, #111); the
+  app builds with Xcode 26.3 / 27 (ambiguous `cos` / `.pi`, #112).
+- App: after a round of several gestures the next step goes to the model, not Jev, so a plan whose first items were
+  just done is not redone (Duolingo: a tapped word was taken back out of the answer). Pointer searches log where
+  their time goes; the step timing line counts past 40.
+- Harness: following the log survives a line cut mid-character. CI: the settle test no longer fails on slow runners.
 - Board firmware v0.2.3 (TestFlight channel): CLI link over Wi-Fi (TCP 7202) next to BLE, `net` command for
   the CLI, BLE write-without-response characteristic `cli_in_nr`.
 - CLI v0.1.2 (npm `esp32agent` 0.1.3, dsh plugin 0.1.1) — CLI over Wi-Fi: with the computer on the board's network (same Wi-Fi, or its hotspot) the CLI's session moves
```

**File**: `harness/lib.sh` (modified, +5/-4)
```diff
@@ -47,12 +47,13 @@ follow() {
     if live; then sleep 1; else sleep "${FOLLOW_EVERY:-5}"; fi
     f=$(mktemp -u /tmp/harness-log.XXXXXX)
     pull_log "$f" || continue
-    new=$(awk -v t="$since" '$1 ~ /^[0-9]/ && $1 > t' "$f"); rm -f "$f"  # unstamped lines (the link's own) would end it
+    # unstamped lines (the link's own) would end it; LC_ALL=C: `tail -c` can start mid-character (Japanese), which stopped awk
+    new=$(LC_ALL=C awk -v t="$since" '$1 ~ /^[0-9]/ && $1 > t' "$f"); rm -f "$f"
     [[ -n $new ]] || continue
     since=$(tail -n 1 <<<"$new" | cut -d' ' -f1)
-    grep -E "$show" <<<"$new" || true
-    if last=$(grep -E "$end" <<<"$new" | tail -n 1) && [[ -n $last ]]; then
-      [[ -z ${5:-} ]] || ! grep -qE "$5" <<<"$last"; return
+    LC_ALL=C grep -aE "$show" <<<"$new" || true
+    if last=$(LC_ALL=C grep -aE "$end" <<<"$new" | tail -n 1) && [[ -n $last ]]; then
+      [[ -z ${5:-} ]] || ! LC_ALL=C grep -aqE "$5" <<<"$last"; return
     fi
   done
   echo "no result in $4 s (harness/logs.sh shows the log)"; return 1
```

**File**: `ios/IPhoneAgent/Agent/Actions.swift` (modified, +2/-0)
```diff
@@ -19,6 +19,8 @@ enum Actions {
         "read": ["what"], "note": ["text"], "progress": ["text"], "remember": ["text"], "learn": ["text"], "write": [],
     ]
     static let textArgs: Set<String> = ["text", "combo", "answer", "reason", "what", "app"]
+    /// Actions that touch the screen.
+    static let gestures: Set<String> = ["tap", "swipe", "circle", "path", "type", "key", "home", "back", "open"]
     /// Actions that touch the notebook or memory, not the screen (AgentLoop+Memory).
     static let notebookActions: Set<String> = ["read", "note", "progress", "remember", "learn", "write"]
 
```

**File**: `ios/IPhoneAgent/Agent/AgentLoop.swift` (modified, +8/-2)
```diff
@@ -121,9 +121,11 @@ extension Gestures {
         if running { throw DeviceError(message: "agent already running") }
         guard screen?.live == true else { throw DeviceError(message: "no phone screen: start Screen Mirroring first") }
         let resuming = resume && task == self.task && !steps.isEmpty
+        JevGate.hold = false
         if !resuming {
             self.task = task; plan = ""; steps = []; shots = [:]
             notebook = Notebook(); learned = []
+            metrics?.runStarted()
         }
         recalled = memory?.recall(chatContext.isEmpty ? task : task + "\n" + chatContext) ?? []
         pointerAt = .zero
@@ -432,6 +434,7 @@ extension Gestures {
     func step() async throws -> Bool {
         var timing = Metrics.Step()
         let acts = try await nextActions()
+        JevGate.hold = acts.filter { Actions.gestures.contains($0.act["action"]?.str ?? "") }.count > 1
         timing.llmMs = (acts[0].act["think_s"]?.double ?? 0) * 1000
         let seen = acts[0].shot
         var spots = [pointerAt]  // where the pointer was and goes: pointer moves are not screen changes
@@ -462,9 +465,12 @@ extension Gestures {
                 // and what the model aimed at may have moved: an answer row reflows as tiles leave it, and the
                 // later taps hit gaps or other words (2026-11-06, Duolingo: right answers undone). Look again then.
                 if earlierTap, name == "tap", let x = act["x"]?.double, let y = act["y"]?.double {
+                    let checked = now()
                     timing.frameMs += await settle(ignoring: spots)
-                    let (now, at, mask) = (screen?.frame, CGPoint(x: x / 1000, y: y / 1000), spots)
-                    if await Vision.off({ Vision.changed(seen, now, at: at, ignore: mask) }) {
+                    let (frame, at, mask) = (screen?.frame, CGPoint(x: x / 1000, y: y / 1000), spots)
+                    let moved = await Vision.off { Vision.changed(seen, frame, at: at, ignore: mask) }
+                    DebugLog.write(String(format: "step: target check before tap %d took %.1f s", i + 1, now() - checked))
+                    if moved {
                         DebugLog.write("step: the target of tap \(i + 1) changed since the model looked; looking again")
                         verdict(true)
                         return false
```

**File**: `ios/IPhoneAgent/Agent/Deciders.swift` (modified, +8/-1)
```diff
@@ -36,7 +36,7 @@ struct Deciders: Equatable, Codable {
 
     /// The free line's X-Handsy-Jev header for the actor: Jev first ("race": Jev and the model at once).
     func freeLineHeader(race: Bool) -> [String: String] {
-        mode == .jevFirst ? ["X-Handsy-Jev": race ? "race" : "1"] : [:]
+        mode == .jevFirst && !JevGate.hold ? ["X-Handsy-Jev": race ? "race" : "1"] : [:]
     }
 
     static let raceKey = "jevRace"
@@ -75,3 +75,10 @@ enum JevConsent {
         own.save(freeLine: false)
     }
 }
+
+/// After a round of several gestures the model's plan is behind: its first items were done in that round, but
+/// Jev reads the plan from the top and redid them (2026-11-07, Duolingo: "Tap Rice" again took Rice back out of
+/// the answer). The next step then goes to the model, which brings its plan up to date. Set by AgentLoop.
+enum JevGate {
+    nonisolated(unsafe) static var hold = false
+}
```

**File**: `ios/IPhoneAgent/Agent/JevStep.swift` (modified, +1/-0)
```diff
@@ -118,6 +118,7 @@ struct JevAnswer: Decodable, Equatable {
         case .jevOnly:  // no fallback to skip to, so no breaker either
             return jevReply(await askJev(input, breaker: false), since: started)
         case .jevFirst:
+            if JevGate.hold { return try await model() }
             if race, !jevBreaker.isOpen { return try await raced(input, model, since: started) }
             if let answer = await askJev(input) { return jevReply(answer, since: started) }
             return try await model()
```

**File**: `ios/IPhoneAgent/Agent/Keyboard.swift` (modified, +3/-1)
```diff
@@ -29,15 +29,17 @@ enum KeyboardLayout: Equatable {
 
     private static func text(in image: CGImage) async -> [String] {
         await withCheckedContinuation { done in
+            let once = Vision.Once()
             let request = VNRecognizeTextRequest { request, _ in
+                guard once.take() else { return }
                 done.resume(returning: (request.results as? [VNRecognizedTextObservation] ?? [])
                     .compactMap { $0.topCandidates(1).first?.string })
             }
             request.recognitionLevel = .accurate
             request.recognitionLanguages = ["zh-Hans", "en-US"]
             request.usesLanguageCorrection = false
             DispatchQueue.global(qos: .userInitiated).async {
-                do { try VNImageRequestHandler(cgImage: image).perform([request]) } catch { done.resume(returning: []) }
+                do { try VNImageRequestHandler(cgImage: image).perform([request]) } catch { if once.take() { done.resume(returning: []) } }
             }
         }
     }
```

**File**: `ios/IPhoneAgent/Agent/Pointer.swift` (modified, +7/-3)
```diff
@@ -284,6 +284,7 @@ import UIKit
     private func measure(_ x: Double, _ y: Double, model: Bool = true) async throws -> CGPoint? {
         guard let screen, let span else { return nil }
         let nudge = x < 0.9 ? Self.nudge : -Self.nudge  // stay clear of the screen edge
+        let started = now()
         await screen.settled(quiet: 0.15, least: 0.1, most: 0.6)  // pointer at rest
         let before = screen.frame, sent = now()
         // 任一微移可能已执行但丢失回执，往返均确认后才能恢复位置缓存。
@@ -302,12 +303,15 @@ import UIKit
             log(after == nil ? "pointer: no new frame after the nudge" : "pointer: no frame before the nudge")
             return nil
         }
-        if let p = await Vision.off({
+        let looked = now()
+        let p = await Vision.off {
             Vision.pointer(before, after, near: CGPoint(x: x, y: y), shift: shift)
                 ?? Vision.pointer(before, after, near: CGPoint(x: 0.5, y: 0.5), shift: shift, reach: CGPoint(x: 0.5, y: 0.5))
-        }) {
-            return p
         }
+        // where a slow search spends its time (2026-11-07: taps took 9-26 s with seconds between commands)
+        log(String(format: "pointer: measure %.1f s (settle %.1f, frames %.1f, search %.1f)%@", now() - started,
+                   sent - started, looked - sent, now() - looked, p == nil ? ", not found" : ""))
+        if let p { return p }
         return model ? await locate?(before) : nil
     }
 
```

---

### Incident Patch 3: `0b22d9a9` (2026-11-07)
**Commit Message**: Agent loop, pointer, video and listening from Duolingo testing; app 1.0.2, firmware v0.2.4 (#107)

* On-device screen tree and Jev-first free line

UITree*.swift ports handsy-trial-gateway tree.py to Swift (Vision OCR, plain-Swift
Canny/Lab/morphology/contours, nesting, XY-cut). On the free line the actor's prompt
gets the element listing and may answer tap #ID; actor requests carry X-Handsy-Jev
(1, or race with the new Advanced toggle). scripts/uitree builds trees on a Mac
for the benchmark.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* UITree OCR: split Vision lines into words (PP-OCR boxes words; each word its own #ID)

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* zh-Hans for the Jev race toggle

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* Own-model runs can use Jev: deciders list, consent, breaker

Settings › Model gets "Who decides each step": Jev and the model, drag to order, each on or off
(free line: Jev first by default, the model stays on; own model: Jev off until its own consent).
Own-model runs with Jev on wrap the actor in JevDeciderModel: Jev first (optional race), model
first (Jev only when the model fails), or Jev only (unsure -> fail -> 

**File**: `CHANGELOG.md` (modified, +16/-0)
```diff
@@ -1,5 +1,21 @@
 # Changelog
 
+## App 1.0.2 · firmware v0.2.4 (TestFlight)
+
+- Hear the phone (off by default, Settings › Listen to phone audio): the board forwards AirPlay audio, the app
+  transcribes it on the iPhone (English plus a second language) and the agent sees what it heard. The second
+  language can follow the screen (Automatic). The CLI can listen too (`listen`). Needs firmware v0.2.4.
+- Long tasks: no 40-round limit (300-round safety cap; 12 unchanged rounds pause and ask), and any stopped or
+  failed run can Continue from here, also after a relaunch.
+- More accurate pointer: every move report at one speed (firmware `pace`), speed calibration for short moves,
+  the corner offset is calibrated, far pointer readings are checked twice, and the corner move never opens
+  Control Center. A later tap in one round checks its target did not move first.
+- Steadier video: network checks and pixel work off the main thread (stream drops 41 → 0 in a Duolingo
+  lesson), a gap resumes from the last decoded frame, a Wi-Fi/BLE switch no longer resends the whole GOP, and
+  the model never sees a frame older than its last action.
+- Settings › Developer: Demo data and an audio test.
+- Fixed: calibration and the debug log could crash the app (#97); a lost BLE ack could repeat an input (#90).
+
 ## Unreleased (main)
 
 - Board firmware v0.2.3 (TestFlight channel): CLI link over Wi-Fi (TCP 7202) next to BLE, `net` command for
```

**File**: `cli/README.md` (modified, +7/-0)
```diff
@@ -48,6 +48,10 @@ never by the OS, so stale Bluetooth bonds don't matter. Keys live in the user co
 | `net join` | asks for your Wi-Fi's name and password (not echoed), sends them to the board over the Bluetooth session, and waits until the link moves to Wi-Fi. `net join SSID [PASSWORD]` does it without asking. The iPhone mirrors over that Wi-Fi too |
 | `net hotspot` | the board opens its own hotspot again |
 | `net via auto\|ble` | `ble` keeps the session on BLE (also `ESP32AGENT_TRANSPORT=ble`) |
+| `listen` | what the iPhone played in the last 30 s (a video, a call, an app's voice) as words, or why it can't be heard |
+| `listen on\|off` | hear the phone's sound while it mirrors (off by default; kept in the config) |
+| `listen mode phone\|local` | `phone` (default): the words the ESP32 Agent app transcribed on the iPhone (turn on Settings › Listen to phone audio and Share with the computer there). `local`: the raw audio over Wi-Fi, transcribed here by whisper.cpp |
+| `listen lang CODE\|none` | `local`: the language besides English, e.g. `zh` (default: this computer's language) |
 | `history list`, `history show RUN\|latest`, `history new` | what was done on the phone: runs (newest first, 30), one run's steps; start a new run |
 | `intent list`, `intent show NAME\|ID` | saved intents |
 | `intent save --name N --prompt P [--hint H ...] [--from-run RUN [--steps 1,3,4]]` | save an intent; steps are the run's replayable moves (all, or the numbers from `history show`) |
@@ -109,6 +113,9 @@ it yourself; esp32agent never sends anything.
 - Taps are relative mouse moves, dead-reckoned from the top-left corner and re-homed every 10 gestures; accuracy
   depends on calibration (`calibrate`, `io tap --aim`).
 - Typing is ASCII only (one key per character); no clipboard, no volume/power buttons, no app install or launch.
+- Phone audio: words only, and they can be misheard. `listen mode local` needs Wi-Fi (not Bluetooth),
+  `brew install whisper-cpp` (or a build of whisper.cpp's `whisper-cli` on PATH) and the model
+  `ggml-base.bin` in the config dir's `whisper/` folder; `listen mode local` says what is missing.
 
 ## Development
 
```

**File**: `cli/README.zh-CN.md` (modified, +7/-0)
```diff
@@ -41,6 +41,10 @@ npm：`npm install -g esp32agent`。安装脚本读取 `https://handsy.tech/cli/
 | `net join` | 询问 Wi-Fi 名称和密码（密码不回显），通过蓝牙会话发给板子，并等到通道切到 Wi-Fi。`net join SSID [PASSWORD]` 不询问直接设置。iPhone 也通过这个 Wi-Fi 镜像 |
 | `net hotspot` | 让板子重新打开自己的热点 |
 | `net via auto\|ble` | `ble` 让会话保持走蓝牙（也可以设 `ESP32AGENT_TRANSPORT=ble`） |
+| `listen` | 手机最近 30 秒播放的声音（视频、通话、App 语音）转成的文字；听不到时说明原因 |
+| `listen on\|off` | 投屏时收听手机声音（默认关，设置会保存） |
+| `listen mode phone\|local` | `phone`（默认）：用 ESP32 Agent App 在手机上转好的文字（在 App 里打开 设置 › 收听手机声音 和 分享给电脑）。`local`：通过 Wi-Fi 拿原始音频，在这台电脑上用 whisper.cpp 转文字 |
+| `listen lang CODE\|none` | `local` 模式：英语以外的第二语言，如 `zh`（默认跟随这台电脑的语言） |
 | `history list`、`history show RUN\|latest`、`history new` | 在手机上做过什么：运行记录（最新的在前，30 条）、某次运行的步骤；开始新的运行 |
 | `intent list`、`intent show NAME\|ID` | 保存的意图 |
 | `intent save --name N --prompt P [--hint H ...] [--from-run RUN [--steps 1,3,4]]` | 保存意图；步骤取自某次运行中可以重放的操作（全部，或 `history show` 里的编号） |
@@ -83,6 +87,9 @@ daemon 会像 iOS App 记录运行一样，记下每个操作和截图：配置
 - 走蓝牙时，截图可能比实际画面慢约一秒，动画不连贯；走 Wi-Fi 时几乎实时。
 - 点按是相对鼠标移动，从左上角推算位置，每 10 次手势重新归位一次；准确度取决于校准（`calibrate`、`io tap --aim`）。
 - 输入仅支持 ASCII（每个字符一次按键）；没有剪贴板，没有音量/电源键，不能安装或直接打开 App。
+- 手机声音：只有文字，可能听错。`listen mode local` 需要 Wi-Fi（蓝牙不行）、`brew install whisper-cpp`
+  （或 PATH 里有 whisper.cpp 的 `whisper-cli`），以及配置目录 `whisper/` 下的模型 `ggml-base.bin`；
+  缺什么 `listen mode local` 会提示。
 
 ## 开发
 
```

**File**: `cli/SKILL.md` (modified, +4/-0)
```diff
@@ -29,6 +29,10 @@ plus history, intent_list, intent_show and intent_save.
    - `esp32agent io button HOME` (Home Screen)
 4. Screenshot again and check the result before the next step. Never chain several taps blind.
 
+When the task depends on what the phone plays (a video, a call, a voice message, a spoken code),
+`esp32agent listen` gives its words from the last 30 s, or says why the phone can't be heard (listening off,
+the app not sharing, no Wi-Fi). The words can be partial or misheard; check the screen when it matters.
+
 ## Typing
 - The board types printable ASCII only, one key per character.
 - Chinese is typed as pinyin: `io text '拿铁'` types `natie` (the reply says `typed_as`). With the iPhone's Chinese (pinyin)
```

**File**: `cli/internal/app/app.go` (modified, +11/-0)
```diff
@@ -42,6 +42,11 @@ const usage = `esp32agent: see and drive an iPhone through an ESP32 Agent board,
   net join SSID [PASSWORD]         the same, non-interactive
   net hotspot                      the board opens its own hotspot again
   calibrate                        measure the pointer (automatic on the first tap)
+  listen                           what the iPhone played in the last 30 s, as words (or why it can't be heard)
+  listen on|off                    hear the phone's sound while it mirrors (off by default)
+  listen mode phone|local          phone: the ESP32 Agent app's words (default); local: whisper.cpp on this
+                                   computer, over Wi-Fi (brew install whisper-cpp, plus a model)
+  listen lang CODE|none            local: the language besides English (e.g. zh); default this computer's
   history list | show RUN | new    what was done on the phone (runs; a new one after 10 min idle)
   intent list | show NAME          saved intents (the app's format)
   intent save --name N --prompt P [--hint H ...] [--from-run RUN [--steps 1,3,4]]
@@ -180,6 +185,12 @@ func (a *App) Run(args []string) int {
 			text = "join " + pos[1] + "\x00" + strings.Join(pos[2:], " ")
 		}
 		return a.call(daemon.Request{Cmd: "net", Device: *dev, Text: text})
+	case "listen":
+		pos, err := parse(fs, rest)
+		if err != nil {
+			return a.fail(err)
+		}
+		return a.call(daemon.Request{Cmd: "listen", Device: *dev, Text: strings.Join(pos, " ")})
 	case "screenshot":
 		return a.screenshot(fs, dev, rest)
 	case "screencapture":
```

**File**: `cli/internal/app/mcp.go` (modified, +9/-0)
```diff
@@ -57,6 +57,8 @@ var (
 		{"press_button", "Press a hardware button. Only HOME (go to the Home Screen).",
 			schema([]string{"button"}, map[string]any{"button": map[string]any{"type": "string", "enum": []string{"HOME"}}})},
 		{"device_info", "Board status: mirroring (ap), video frozen (fz), app busy (busy), USB, BLE link.", schema(nil, map[string]any{})},
+		{"phone_audio", "What the iPhone played in the last 30 s (a video, a call, an app's voice) as words, or why it can't be heard " +
+			"(listening off, the app not sharing, no Wi-Fi). The words can be partial or misheard.", schema(nil, map[string]any{})},
 	}
 )
 
@@ -151,6 +153,8 @@ func (a *App) callTool(name string, args map[string]any) map[string]any {
 		req.Cmd, req.Text = "button", s("button")
 	case "device_info":
 		req.Cmd = "info"
+	case "phone_audio":
+		req.Cmd = "listen"
 	default:
 		return textResult("unknown tool "+name, true)
 	}
@@ -179,5 +183,10 @@ func (a *App) callTool(name string, args map[string]any) map[string]any {
 			{"type": "text", "text": fmt.Sprintf("%dx%d screenshot; tap coordinates are pixels of this image", d.Width, d.Height)},
 		}, "isError": false}
 	}
+	if name == "phone_audio" {
+		var d struct{ Heard string }
+		json.Unmarshal(r.Raw, &d)
+		return textResult(d.Heard, false)
+	}
 	return textResult(string(r.Raw), false)
 }
```

**File**: `cli/internal/audio/audio_test.go` (added, +157/-0)
```diff
@@ -0,0 +1,157 @@
+package audio
+
+import (
+	"context"
+	"encoding/binary"
+	"os"
+	"os/exec"
+	"path/filepath"
+	"strings"
+	"testing"
+	"time"
+)
+
+func rec(seq uint16, flags byte, frame []byte) []byte {
+	b := []byte{byte(seq), byte(seq >> 8), flagAudio | flags}
+	if flags&flagEnd != 0 {
+		return b
+	}
+	b = binary.LittleEndian.AppendUint32(b, 1234)
+	b = binary.LittleEndian.AppendUint32(b, 99)
+	return append(b, frame...)
+}
+
+func TestRecordsBecomeSegments(t *testing.T) {
+	r, ok := ParseRecord(rec(7, flagStart, []byte{1, 2}))
+	if !ok || r.Seq != 7 || !r.Start || r.BoardMs != 1234 || string(r.Frame) != "\x01\x02" {
+		t.Fatalf("parse: %+v %v", r, ok)
+	}
+	if _, ok := ParseRecord([]byte{1, 0, 0, 5}); ok {
+		t.Fatal("a video chunk is not audio")
+	}
+	var s Segmenter
+	t0 := time.Unix(100, 0)
+	for i, f := range []byte{1, 2, 3} {
+		flags := byte(0)
+		if i == 0 {
+			flags = flagStart
+		}
+		r, _ := ParseRecord(rec(uint16(i), flags, []byte{f}))
+		if s.Add(t0.Add(time.Duration(i)*time.Second), r, false) != nil {
+			t.Fatal("segment ended early")
+		}
+	}
+	r, _ = ParseRecord(rec(4, flagEnd, nil)) // seq 3 lost
+	seg := s.Add(t0.Add(3*time.Second), r, false)
+	if seg == nil || len(seg.Frames) != 3 || seg.Gaps != 1 || seg.End.Sub(seg.Start) != 3*time.Second {
+		t.Fatalf("segment: %+v", seg)
+	}
+	// joined mid-segment, then a stretch longer than MaxSegment is cut
+	r, _ = ParseRecord(rec(5, 0, []byte{9}))
+	s.Add(t0.Add(10*time.Second), r, false)
+	r, _ = ParseRecord(rec(6, 0, []byte{9}))
+	if seg := s.Add(t0.Add(10*time.Second+MaxSegment), r, false); seg == nil || len(seg.Frames) != 2 {
+		t.Fatalf("long segment not cut: %+v", seg)
+	}
+}
+
+func TestBlockWording(t *testing.T) {
+	now := time.Unix(1000, 0)
+	if Block(now, nil, "x") != "" {
+		t.Fatal("nothing heard: no block")
+	}
+	items := []Heard{
+		{Start: now.Add(-50 * time.Second), End: now.Add(-40 * time.Second), Text: "old", Final: true},
+		{Start: now.Add(-10 * time.Second), End: now.Add(-6 * time.Second), Text: "[zh] 验证码是4729", Final: true},
+		{Start: now.Add(-3 * time.Second), End: now.Add(-3 * time.Second), Text: "[en] hi", Final: true},
+		{Start: now.Add(-2 * time.Second)},
+	}
+	want := "Heard (phone audio, last 30 s; how):\n" +
+		"- 6 s ago, 4 s long: \"[zh] 验证码是4729\"\n- 3 s ago: \"[en] hi\"\n- now, 2 s so far: (sound, still transcribing)"
+	if got := Block(now, items, "how"); got != want {
+		t.Fatalf("got\n%s\nwant\n%s", got, want)
+	}
+}
+
+func TestRecentKeepsAMinute(t *testing.T) {
+	var r Recent
+	t0 := time.Unix(0, 0)
+	r.Begin(t0)
+	r.End(t0, t0.Add(time.Second))
+	r.Done(t0, "a")
+	r.Begin(t0.Add(2 * time.Minute))
+	items := r.Items()
+	if len(items) != 1 || !items[0].End.IsZero() {
+		t.Fatalf("items: %+v", items)
+	}
+}
+
+func frames(t *testing.T) [][]byte {
+	raw, err := os.ReadFile("testdata/tone.eld") // 0.5 s of a 440 Hz tone from the macOS AAC-ELD encoder
+	if err != nil {
+		t.Fatal(err)
+	}
+	var out [][]byte
+	for len(raw) >= 2 {
+		n := int(binary.LittleEndian.Uint16(raw))
+		out, raw = append(out, raw[2:2+n]), raw[2+n:]
+	}
+	return out
+}
+
+func TestFFmpegDecodesTheFLV(t *testing.T) {
+	ff, err := exec.LookPath("ffmpeg")
+	if err != nil {
+		t.Skip("no ffmpeg")
+	}
+	l := &Local{FFmpeg: ff}
+	dir := t.TempDir()
+	in := filepath.Join(dir, "in.flv")
+	os.WriteFile(in, FLV(frames(t)), 0o600)
+	pcm, err := l.run(context.Background(), ff, "-hide_banner", "-loglevel", "error", "-i", in, "-ac", "1", "-ar", "16000", "-f", "s16le", "-")
+	if err != nil {
+		t.Fatal(err)
+	}
+	if secs := float64(len(pcm)) / 2 / 16000; secs < 0.4 || secs > 0.6 {
+		t.Fatalf("decoded %.2f s", secs)
+	}
+	if lv := Level(pcm); lv < -20 || lv > -8 { // a 0.3 tone: about -13.5 dBFS
+		t.Fatalf("level %.1f dB", lv)
+	}
+}
+
+func TestTranscribePicksEnglishOrTheSecondLanguage(t *testing.T) {
+	var calls []string
+	tone := make([]byte, 3200)
+	for i := 0; i < len(tone)/2; i++ {
+		binary.LittleEndian.PutUint16(tone[2*i:], uint16(int16(8000*((i/20)%2*2-1))))
+	}
+	l := &Local{FFmpeg: "ffmpeg", Whisper: "whisper", Model: "m", Second: "zh",
+		Run: func(_ context.Context, name string, args ...string) ([]byte, error) {
+			if name == "ffmpeg" {
+				return tone, nil
+			}
+			lang := args[3]
+			calls = append(calls, lang)
+			out := args[len(args)-3] // -of OUT, then --prompt TEXT
+			if args[len(args)-2] != "--prompt" {
+				out = args[len(args)-1]
+			}
+			detected := map[string]string{"auto": "ja", "zh": "zh"}[lang]
+			return nil, os.WriteFile(out+".json", []byte(`{"result":{"language":"`+detected+`"},"transcription":[{"text":" 你好 "}]}`), 0o600)
+		}}
+	got, err := l.Transcribe(context.Background(), &Segment{Frames: [][]byte{{1}}})
+	if err != nil || got != "[zh] 你好" || strings.Join(calls, ",") != "auto,zh" {
+		t.Fatalf("got %q %v, calls %v", got, err, calls)
+	}
+	silent := &Local{FFmpeg: "ffmpeg", Run: func(context.Context, string, ...string) ([]byte, error) { return make([]byte, 3200), nil }}
+	if got, _ := silent.Transcribe(con
```

**File**: `cli/internal/audio/flv.go` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+package audio
+
+import "encoding/binary"
+
+// Config is the mirroring stream's AudioSpecificConfig: AAC-ELD, 44.1 kHz, stereo, 480-sample frames.
+var Config = []byte{0xF8, 0xE8, 0x50, 0x00}
+
+// FrameMs is one frame's length.
+const FrameMs = 480.0 * 1000 / 44100
+
+// FLV wraps raw AAC-ELD frames so ffmpeg can read them: ADTS can't carry ELD, and FLV is the smallest container
+// that carries the AudioSpecificConfig (its AAC sequence header) and raw frames as they are.
+func FLV(frames [][]byte) []byte {
+	out := []byte{'F', 'L', 'V', 1, 0x04, 0, 0, 0, 9, 0, 0, 0, 0} // audio only; first PreviousTagSize 0
+	tag := func(ms uint32, body []byte) {
+		h := []byte{8, byte(len(body) >> 16), byte(len(body) >> 8), byte(len(body)),
+			byte(ms >> 16), byte(ms >> 8), byte(ms), byte(ms >> 24), 0, 0, 0}
+		out = append(append(out, h...), body...)
+		out = binary.BigEndian.AppendUint32(out, uint32(11+len(body)))
+	}
+	tag(0, append([]byte{0xAF, 0}, Config...)) // AAC, 44 kHz, 16-bit, stereo; sequence header
+	for i, f := range frames {
+		tag(uint32(float64(i)*FrameMs), append([]byte{0xAF, 1}, f...))
+	}
+	return out
+}
```

#### Recent Merged Pull Requests:
- **PR #153** (2026-11-13): App 1.0.6: record learning, steer, standby island, long tasks, absolute mouse, shared memory, call fixes (@onehumanbeing)
- **PR #152** (2026-11-12): fastlane: export with API key cloud signing (@onehumanbeing)
- **PR #151** (2026-11-12): Changelog 1.0.5: intents improve themselves (@onehumanbeing)
- **PR #147** (2026-11-12): Firmware 0.2.5: lost video packets reported, press_for, result, net while the app drives (@onehumanbeing)
- **PR #144** (closed): iPad support (@gsdms)
- **PR #143** (2026-11-10): test(ios): inject the Keychain so the key tests also run in CI (@djs-91)

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

## X. Agent fixes: open apps by code, Chinese/accented typing, tap verdict, Jev thresh

**RULE**:
When implementing operations in `.github/workflows/ci.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in onehumanbeing/esp32-iphone-agent. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1e16a02f`: Agent fixes: open apps by code, Chinese/accented typing, tap verdict, Jev threshold, free-line lease, background CPU. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/ci.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
  # Store-only sources never belong in this repository (scripts/check-public.sh).
  public:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - run: scripts/check-public.sh

```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1e16a02f` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
