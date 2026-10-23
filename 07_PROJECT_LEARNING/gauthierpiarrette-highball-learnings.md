> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/gauthierpiarrette-highball-learnings.md`  
> **Source**: github ([https://github.com/gauthierpiarrette/highball](https://github.com/gauthierpiarrette/highball))  
> **Source Version**: `be1d0f39`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-23T05:23:48.741Z  
> **Learning ID**: `learn-github-gauthierpiarrette-highball`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): gauthierpiarrette/highball

> **Canonical Artifact**: `07_PROJECT_LEARNING/gauthierpiarrette-highball-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/gauthierpiarrette/highball](https://github.com/gauthierpiarrette/highball))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-23T05:23:47.814Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `gauthierpiarrette/highball`
- **Description**: Run Windows games on Apple Silicon — free, open source, with an open compatibility database that tells you what actually works.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1807 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Sources/HighballApp/AppState.swift`
```
import AppKit
import Foundation
import HighballKit
import Observation
import os

/// The three Settings tabs, so a deep link can select one.
enum SettingsTab: Hashable { case environments, engine, troubleshooting }

@Observable @MainActor
final class AppState {
    var engines: [InstalledEngine] = []
    /// frame generation shim directory per engine id, resolved once in refresh() so the settings view does not repair links on every redraw
    var lsfgShimDirs: [String: URL] = [:]
    var bottles: [Bottle] = []
    /// Directories under bottles/ that aren't loadable bottles. Shown alongside the real
    /// ones so a bottle whose settings file is gone still has somewhere to be acted on (#38).
    var damagedBottles: [DamagedBottle] = []
    /// Bottles with a delete in flight. Their rows show it and refuse a second click.
    var deletingBottles: Set<String> = []
    var selectedBottle: String?
    /// Which Settings tab to show. A deep link (the library's "Open Troubleshooting") sets it
    /// before opening the window; the TabView binds its selection to it.
    var settingsTab: SettingsTab = .environments
    var gamesByBottle: [String: [SteamGame]] = [:]
    /// The Steam account's games per bottle, installed or not (SteamOwnedLibrary, highball#199).
    var steamOwnedByBottle: [String: [OwnedSteamGame]] = [:]
    /// What Steam's app data says about each owned game's Mac build (MacAppInfoBuild), by appid.
    /// Built with steamOwnedByBottle, so the library's tiles look it up instead of searching.
    var macAppInfoByAppID: [Int: MacAppInfoBuild] = [:]
    var gameDB = GameDB(directories: [])

    // Long-running work
    var busy = false
    var busyTitle = ""
    var stage = ""
    var logLines: [String] = []
    var showLog = false
    // Onboarding legibility (#31): a first-time user should never have to guess whether
    // something is working, finished, or stuck.
    var stageHint = ""                  // recipe-declared "slow step, this is normal" text
    var busyStartedAt: Date?            // drives the "running for N min" row
    var busyExpected: String?           // human duration ("usually 20–40 minutes")
    var lastOutputAt: Date?             // liveness: when the task last produced output
    var doneState: DoneState?           // explicit success panel with an optional next step
    struct DoneState {
        var title: String
        var ctaTitle: String?
        var cta: (() -> Void)?
        /// No done row: a session or the Steam row took over from the busy operation.
        var silent = false
        static let handedOff = DoneState(title: "", ctaTitle: nil, cta: nil, silent: true)
    }
    // The activity strip (UX plan 0.5): what the busy operation can show beyond its title.
    struct Transfer: Equatable { var received: Int64; var total: Int64? }
    var busyProgress: Transfer?         // bytes of the current download, for the bar
    var transferRate: Double?           // measured bytes per second, never a prediction
    /// How a busy operation can be stopped, and what stopping does. A download stops cleanly
    /// (the partial file stays); a launch stops by ending the bottle's processes.
    enum BusyStop {
        case cancelTask(label: String)
        case killBottle(Bottle, label: String)
        /// A Windows step (installer, recipe) cannot stop cleanly: the bottle is ended and the
        /// repair path runs right after, and the button says so (UX plan §3.3).
        case killBottleThenRepair(Bottle, label: String)
        var label: String {
            switch self {
            case .cancelTask(let l), .killBottle(_, let l), .killBottleThenRepair(_, let l): return l
            }
        }
        var stoppedTitle: String {
            switch self {
            case .cancelTask: return L("Stopped. Nothing already downloaded is lost.")
            case .killBottle: return L("Stopped.")
            case .killBottleThenRepair: return L("Stopped. Repairing the environment so nothing half-installed stays behind.")
            }
        }
        var bottleToRepair: Bottle? {
            if case .killBottleThenRepair(let b, _) = self { return b }
            return nil
        }
    }
    var busyStop: BusyStop?
    @ObservationIgnored private var busyTask: Task<Void, Never>?
    @ObservationIgnored private var transferSamples: [ActivityText.Sample] = []
    @ObservationIgnored private var stopRequested = false

    // Onboarding
    var rosettaInstalled = true
    /// Rosetta stopped working on a Mac that already has an engine that needs it: the app asks to install it.
    var rosettaMissing = false
    /// Get started will install Rosetta first: the Mac lacks it and the bundled engine needs it.
    var setupInstallsRosetta = false
    /// Whether the engine Get started installs is Intel code. Every engine shipped so far is; the
    /// arm64 line (private/notes/rosetta-transition-plan.md) says `requires: []` and skips Rosetta.
    static var bundledEngineRequiresRosetta: Bool {
        guard let url = bundledManifest, let m = try? EngineManifest.load(from: url) else { return true }
        return m.requiresRosetta
    }

    /// Installs Rosetta for an existing install, from the ask that rosettaMissing raises.
    func installRosettaNow() {
        rosettaMissing = false
        runBusy(L("Installing Rosetta, Apple's compatibility layer"), expected: L("a minute or two")) { [self] in
            try await Self.installRosetta()
            await MainActor.run { self.rosettaInstalled = true; self.appendLog("Rosetta installed"); self.refresh() }
        }
    }
    var needsOnboarding = false
    var showGPTKLicense = false
    var gptkLicenseText = ""

    // Crash follow-up
    var crashSuggestion: CrashSuggestion?
    struct CrashSuggestion {
        let program: String
        /// The bottle that was actually launched. The alert used to edit `selectedBottle`, which
        /// `launchGame` never sets — so accepting could rewrite an unrelated bottle, or none.
        let bottleName: String
        /// The renderer to offer next.
        let renderer: Renderer
        let logPath: String
        /// The renderer the program actually ran under, and how long it lived: the facts the
        /// alert can state as detected.
        var current: Renderer
        var seconds: Int
        /// Another installed engine to offer as the second way out, when there is one.
        var alternateEngine: InstalledEngine? = nil
        /// The library item this launch belongs to, when it is a game: accepting then changes the
        /// mode for that game alone, never the whole environment.
        var itemID: String? = nil
    }

    /// A game that ran, badly by the player's account, with another mode to try next time (the
    /// guided renderer trial, ux-plan item 1). One click sets it for this game only.
    struct RendererTrial {
        let itemID: String
        let title: String
        let current: Renderer
        let next: Renderer
    }
    var rendererTrial: RendererTrial?

    /// Graphics modes chosen per game (library id), the store's copy for the views.
    var libraryOverrides: [String: Renderer] = [:]
    func rendererOverride(for item: LibraryItem) -> Renderer? { libraryOverrides[item.id] }
    /// Launch arguments the player set for a game (highball#236), by library id.
    var libraryLaunchArgs: [String: [String]] = [:]
    func launchArguments(for item: LibraryItem) -> [String] { libraryLaunchArgs[item.id] ?? [] }
    func setLaunchArguments(_ line: String, for item: LibraryItem) {
        let args = ArgumentLine.split(line)
        guard args != launchArguments(for: item) else { return }
        libraryStore.setLaunchArguments(args, for: item.id)
        libraryLaunchArgs = libraryStore.launchArguments()
        appendLog(args.isEmpty ? "\(item.id): launch arguments cleared" : "\(item.id): launch arguments set to \(ArgumentLine.join(args))")
    }
    /// The display (CoreGraphics UUID) a game's window moves to, by library id.
    var libraryDisplays: [String: String] = [:]
    func displayChoice(for item: LibraryItem) -> String? { libraryDisplays[item.id] }
    func setDisplay(_ uuid: String?, for item: LibraryItem) {
        guard uuid != displayChoice(for: item) else { return }
        if uuid != nil { _ = WindowMover.ensureTrusted(prompt: true) }
        libraryStore.setDisplay(uuid, for: item.id)
        libraryDisplays = libraryStore.displayChoices()
        let name = uuid.flatMap { u in Monitor.connected().first { $0.id == u }?.name }
        appendLog(uuid == nil ? "\(item.id): display back to the main one" : "\(item.id): display set to \(name ?? "a disconnected display")")
    }
    func setRendererOverride(_ renderer: Renderer?, for id: String) {
        libraryStore.setRendererOverride(renderer, for: id)
        libraryOverrides = libraryStore.rendererOverrides()
        appendLog(renderer.map { "\(id): graphics mode set to \($0.rawValue) for this game" } ?? "\(id): graphics mode back to the environment's")
    }

    /// A game whose last run asked Windows for a fullscreen size this Mac never switched to.
    /// One click tells Wine to pretend the switch happened and scale the game to the screen.
    struct ModesetTrial {
        let itemID: String
        let title: String
    }
    var modesetTrial: ModesetTrial?
    func acceptModesetTrial() {
        defer { modesetTrial = nil }
        guard let trial = modesetTrial, let item = libraryItems.first(where: { $0.id == trial.itemID }) else { return }
        setDisplayModeEmulation(true, for: item)
    }

    /// "Had problems" on the post-play row: offer the next mode for this game, then the report.
    func offerRendererTrial(for record: SessionRecord) {
        postPlay = nil
        guard let bottle = bottles.first(where: { $0.name == record.bottle }), let engine = engine(for: bottle),
              let item = libraryItems.first(where: { $0.steamAppID != nil && $0.steamAppID == record.appid })
 
```

### Core Architecture Module: `Sources/HighballApp/EngineAsk.swift`
```
import Foundation
import HighballKit

// MARK: - An engine a recipe needs (#60)

extension GamePageCopy {
    /// "Wine 11.0 (CrossOver 26.3 tree, …) + DXMT …" → "Wine 11.0".
    static func shortEngineName(_ m: EngineManifest) -> String {
        String(m.displayName.prefix { $0 != "(" && $0 != "+" }).trimmingCharacters(in: .whitespaces)
    }

    static func downloadSize(_ m: EngineManifest) -> String {
        ByteCountFormatter.string(fromByteCount: Int64(m.downloadBytes), countStyle: .file)
    }

    /// The fix names an engine this build does not ship: the database moved ahead of the app.
    static func updateAsk(recipe: HighballKit.Recipe, engineID: String, canPlay: Bool) -> String {
        let play = canPlay ? " " + L("You can also play without the fix, as before.") : ""
        return String(format: L("%@'s fix runs on the %@ engine, and this version of Highball does not ship it yet. Check for Updates gets the version that does.%@"),
                      recipe.title, engineID, play)
    }

    /// `others` is how many other programs the environment has installed (Steam games and added
    /// programs): moving the environment moves them all onto the engine, which a player found out
    /// the hard way when an old revision could not show Steam's window (highball#262).
    /// `existing` names an environment already on that engine and whether the game is installed
    /// in it; the ask then offers it first (highball-db#318).
    /// `canMove` is false when the environment's engine is of another architecture than the
    /// recipe's (EngineStore.sameArch): only a new environment is offered then.
    /// `carriesGame` is true when the game installed in this environment can come along to a new one as an APFS
    /// clone (SteamGameCarryOver): no second download, no extra disk. `memoryMB` is this Mac's memory, checked
    /// against the recipe's minMemoryGB.
    static func engineAsk(recipe: HighballKit.Recipe, manifest: EngineManifest, installed: Bool, others: Int,
                          existing: (name: String, holdsGame: Bool)? = nil, canMove: Bool = true,
                          carriesGame: Bool = false, memoryMB: Int = Machine.memoryMB) -> String {
        guard let existing else {
            guard canMove else {
                return engineAskOtherArch(recipe: recipe, manifest: manifest, installed: installed, carriesGame: carriesGame)
                    + memoryNote(recipe: recipe, memoryMB: memoryMB)
            }
            return engineAskBody(recipe: recipe, manifest: manifest, installed: installed, others: others)
                + memoryNote(recipe: recipe, memoryMB: memoryMB)
        }
        return (existing.holdsGame
            ? String(format: L("'%@' is already on the %@ engine and has the game installed, so it plays there. This environment stays as it is."), existing.name, shortEngineName(manifest))
            : String(format: L("'%@' is already on the %@ engine. Using it installs the game there, with what it needs, and this environment stays as it is."), existing.name, shortEngineName(manifest)))
            + memoryNote(recipe: recipe, memoryMB: memoryMB)
    }

    private static func engineAskOtherArch(recipe: HighballKit.Recipe, manifest: EngineManifest, installed: Bool,
                                           carriesGame: Bool) -> String {
        let download = installed ? "" : String(format: L(", after a download of about %@"), downloadSize(manifest))
        if carriesGame {
            let text = manifest.isNativeARM64
                ? L("%@ is verified on the %@ engine, which runs natively on Apple silicon. This environment's engine runs through Rosetta, so the environment cannot move to it. A new environment gets a Steam of its own%@, and the game installed here comes along without a new download or extra disk space. This environment stays as it is.")
                : L("%@ is verified on the %@ engine, which runs through Rosetta. This environment's engine runs natively on Apple silicon, so the environment cannot move to it. A new environment gets a Steam of its own%@, and the game installed here comes along without a new download or extra disk space. This environment stays as it is.")
            return String(format: text, recipe.title, shortEngineName(manifest), download)
        }
        let text = manifest.isNativeARM64
            ? L("%@ is verified on the %@ engine, which runs natively on Apple silicon. This environment's engine runs through Rosetta, so the environment cannot move to it. A new environment starts empty%@, and the game has to be installed again.")
            : L("%@ is verified on the %@ engine, which runs through Rosetta. This environment's engine runs natively on Apple silicon, so the environment cannot move to it. A new environment starts empty%@, and the game has to be installed again.")
        return String(format: text, recipe.title, shortEngineName(manifest), download)
    }

    /// A recipe pinned to a preview engine this Mac does not see yet: Play asks before anything changes. Before
    /// 0.10.19 Play launched such a game on the current engine as if the recipe did not exist, which for Microsoft
    /// Flight Simulator 2024 was a Rosetta engine it cannot start on.
    static func previewAsk(recipe: HighballKit.Recipe, manifest: EngineManifest, memoryMB: Int = Machine.memoryMB) -> String {
        let text = manifest.isNativeARM64
            ? L("%@ is verified on the %@ engine, which runs natively on Apple silicon and is still in preview: the game plays, with the rough edges its page lists. Highball offers that engine for this game, sets it up in an environment of its own, and leaves this one as it is.")
            : L("%@ is verified on the %@ engine, which is still in preview: the game plays, with the rough edges its page lists. Highball offers that engine for this game, sets it up in an environment of its own, and leaves this one as it is.")
        return String(format: text, recipe.title, shortEngineName(manifest)) + memoryNote(recipe: recipe, memoryMB: memoryMB)
    }

    /// "r5" for arm64-wine11.18-r5, the id itself when it carries no revision.
    static func revisionName(_ m: EngineManifest) -> String {
        EngineManifest.revision(of: m.id).map { "r\($0)" } ?? m.id
    }

    /// An environment on an earlier revision of the preview line its game's recipe pins (AppState.pendingPreviewMove).
    static func previewMoveAsk(recipe: HighballKit.Recipe, current: EngineManifest, manifest: EngineManifest, installed: Bool) -> String {
        let download = installed ? "" : String(format: L(", after a download of about %@"), downloadSize(manifest))
        return String(format: L("%@ is now verified on %@ of its preview engine, and this environment still runs %@. Moving the environment switches it there%@ and keeps the game and everything else installed. The Windows setup re-runs, which takes a minute or two. Highball asks this once, and the environment's Engine setting can move it later."),
                      recipe.title, revisionName(manifest), revisionName(current), download)
    }

    /// A game whose recipe's engine needs a newer macOS than this Mac runs (AppState.pendingMacOS). `current` is
    /// "major.minor.patch", shown without a patch of 0.
    static func macOSAsk(recipe: HighballKit.Recipe, floor: String, current: String) -> String {
        let shown = current.hasSuffix(".0") ? String(current.dropLast(2)) : current
        return String(format: L("%@'s fix runs on an engine that needs macOS %@ or later, and this Mac runs macOS %@. Once macOS is updated, Play sets it up. You can also play without the fix, as before."),
                      recipe.title, floor, shown)
    }

    /// One sentence when the recipe names a memory floor this Mac is under, empty otherwise. The floor is the memory
    /// the game was tested with, so the sentence says that rather than a hard requirement: smaller Macs are untested,
    /// not ruled out (2026-10-19).
    static func memoryNote(recipe: HighballKit.Recipe, memoryMB: Int) -> String {
        guard let short = recipe.memoryShortfall(memoryMB: memoryMB) else { return "" }
        return " " + String(format: L("It was tested on Macs with %d GB of memory and this Mac has %d GB, so it may not run well here."),
                            short.needGB, short.haveGB)
    }

    private static func engineAskBody(recipe: HighballKit.Recipe, manifest: EngineManifest, installed: Bool, others: Int) -> String {
        let download = installed ? "" : String(format: L(", after a download of about %@"), downloadSize(manifest))
        if others == 0 {
            return String(format: L("%@ is verified on the %@ engine, and this environment is not on it. Moving this environment switches it there%@ and keeps everything installed; the Windows setup re-runs when needed, a minute or two. A new environment starts empty, so the game has to be installed again."),
                          recipe.title, shortEngineName(manifest), download)
        }
        let programs = others == 1 ? L("the other program installed here") : String(format: L("the %d other programs installed here"), others)
        return String(format: L("%@ is verified on the %@ engine, and this environment is not on it. A new environment keeps %@ where they are and starts empty, so the game has to be installed again. Moving this environment switches it there%@ and keeps everything installed, but %@ then run on that engine too, which suits some games and not others; the Windows setup re-runs when needed, a minute or two."),
                      recipe.title, shortEngineName(manifest), programs, download, programs)
    }
}

```

### Core Architecture Module: `Sources/HighballApp/EngineTransitionSheet.swift`
```
import SwiftUI
import HighballKit

/// The page a player sees after picking another engine on an environment's page (highball#254,
/// from PR #230 by @matiasmg-ok): what moves, what stays, the steps, and then the steps as they
/// happen. The work itself is the usual move on the activity strip, so closing the page never
/// stops anything (UX plan 0.5: what takes time lives on the strip, never modal).
struct EngineTransitionSheet: View {
    @Environment(AppState.self) private var state
    @Environment(\.dismiss) private var dismiss
    let transition: AppState.EngineTransition
    @State private var started = false
    /// The steps as they were when Switch was pressed: afterwards the environment is on the new
    /// engine and the engine is installed, so a fresh plan would drop the steps that just ran.
    @State private var frozen: EngineSwitchPlan?

    private var bottle: Bottle? { state.bottles.first { $0.name == transition.bottleName } }
    private var target: EngineManifest? {
        state.engines.first { $0.id == transition.targetID }?.manifest
            ?? AppState.knownManifests.first { $0.id == transition.targetID }
    }
    private var installed: Bool { state.engines.contains { $0.id == transition.targetID } }
    private var plan: EngineSwitchPlan { frozen ?? livePlan }
    private var livePlan: EngineSwitchPlan {
        let current = bottle.flatMap { b in state.engines.first { $0.id == b.settings.engineID }?.manifest }
        let refreshes = target.map { EngineManifest.needsPrefixRefresh(from: current, to: $0) } ?? true
        return EngineSwitchPlan(engineInstalled: installed, refreshesWindows: refreshes)
    }
    private var programs: [String] { bottle.map { state.programNames(in: $0) } ?? [] }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                HB.eyebrow(L("Engine"))
                Text(String(format: L("Switch '%@' to %@"), transition.bottleName, targetName))
                    .font(.title2.bold())
                Text(verbatim: transition.targetID).font(.caption.monospaced()).foregroundStyle(.tertiary)
            }

            section(L("What moves"), programs.isEmpty
                    ? L("The environment and everything in it. Programs installed later run on the new engine too.")
                    : String(format: L("Everything in this environment moves to the new engine, including %@."), programList))
            section(L("What stays"), L("Everything installed, your saves and Steam's sign-in. The engine you leave stays installed, so switching back is the same step."))

            VStack(alignment: .leading, spacing: 8) {
                Text(L("Steps")).font(.callout.weight(.medium))
                ForEach(plan.steps, id: \.self) { step in
                    stepRow(step)
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 10).fill(HB.card))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(HB.cardStroke))

            if started, state.engineSwitchSucceeded == false {
                Text(L("The switch did not finish. The environment keeps the engine it had, and the message at the bottom of the window says why."))
                    .font(.callout).foregroundStyle(HB.bad).fixedSize(horizontal: false, vertical: true)
            } else if !started, state.busy {
                Text(L("Something else is running. The switch can start once it finishes."))
                    .font(.caption).foregroundStyle(.secondary)
            }

            HStack {
                if started && state.engineSwitchSucceeded == nil {
                    Text(L("You can close this page, the switch carries on at the bottom of the window."))
                        .font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                if !started {
                    Button(L("Cancel")) { dismiss() }.keyboardShortcut(.cancelAction)
                    Button(L("Switch")) {
                        frozen = livePlan
                        started = true
                        state.startEngineTransition(transition)
                    }
                    .keyboardShortcut(.defaultAction)
                    .buttonStyle(.borderedProminent)
                    .disabled(state.busy || bottle == nil || target == nil)
                } else if state.engineSwitchSucceeded == nil {
                    Button(L("Hide")) { dismiss() }.keyboardShortcut(.cancelAction)
                } else {
                    Button(L("Done")) { dismiss() }
                        .keyboardShortcut(.defaultAction)
                        .buttonStyle(.borderedProminent)
                }
            }
        }
        .padding(22)
        .frame(width: 520)
        .onChange(of: state.debugStartEngineTransition) { _, go in
            guard go, !started else { return }
            state.debugStartEngineTransition = false
            frozen = livePlan
            started = true
            state.startEngineTransition(transition)
        }
    }

    private var targetName: String { target.map(GamePageCopy.shortEngineName) ?? transition.targetID }

    /// Up to four names, then how many more, so a big library does not turn into a wall of text.
    private var programList: String {
        let shown = programs.prefix(4).joined(separator: ", ")
        let rest = programs.count - min(programs.count, 4)
        return rest > 0 ? String(format: L("%@ and %d more"), shown, rest) : shown
    }

    @ViewBuilder private func section(_ title: String, _ body: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title).font(.callout.weight(.medium))
            Text(body).font(.callout).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
        }
    }

    private func label(_ step: EngineSwitchPlan.Step) -> String {
        switch step {
        case .download:
            let size = target.map(GamePageCopy.downloadSize) ?? ""
            return size.isEmpty ? L("Download the engine") : String(format: L("Download the engine, about %@"), size)
        case .stopPrograms: return L("Stop what runs in this environment and switch")
        case .windowsSetup: return L("Run the Windows setup again, a minute or two")
        case .done: return L("Ready to play")
        }
    }

    @ViewBuilder private func stepRow(_ step: EngineSwitchPlan.Step) -> some View {
        let steps = plan.steps
        let currentIndex = state.engineSwitchStep.flatMap { steps.firstIndex(of: $0) }
        let index = steps.firstIndex(of: step) ?? 0
        let finished = state.engineSwitchSucceeded == true
        let isDone = started && (finished || (currentIndex.map { index < $0 } ?? false))
        let isCurrent = started && !finished && currentIndex == index && state.engineSwitchSucceeded == nil
        HStack(spacing: 10) {
            Group {
                if isDone {
                    Image(systemName: "checkmark.circle.fill").foregroundStyle(HB.good)
                } else if isCurrent {
                    ProgressView().controlSize(.small)
                } else {
                    Image(systemName: "circle").foregroundStyle(.tertiary)
                }
            }
            .frame(width: 18)
            Text(label(step))
                .font(.callout)
                .foregroundStyle(isCurrent ? .primary : (isDone ? .secondary : .secondary))
            if isCurrent, step == .download, let p = state.busyProgress, let total = p.total, total > 0 {
                Spacer()
                Text(verbatim: "\(Int(Double(p.received) / Double(total) * 100)) %")
                    .font(.caption.monospacedDigit()).foregroundStyle(.secondary)
            }
        }
    }
}

```

### Core Architecture Module: `Sources/HighballKit/EngineChannels.swift`
```
import Foundation

/// Which bundled engine manifests an install may see. Manifests ship inside the app, so an engine
/// line that is still being proven (the native arm64 line, first for Microsoft Flight Simulator 2024)
/// ships with a `channel`: "preview" shows it only where the preview key is set, "beta" also to
/// installs that get beta builds, and no channel shows it to everyone. Opening a line to players is
/// then a data change. An unknown channel stays hidden, so a typo cannot hand an engine to everyone.
public enum EngineChannels {
    public static let preview = "preview"
    public static let beta = "beta"
    /// The UserDefaults key that shows preview engines. No UI on purpose:
    /// `defaults write app.highball.Highball previewEngines -bool true`.
    public static let previewDefaultsKey = "previewEngines"
    /// Preview engines a player took from Play for a game whose recipe asks for one (the ask's "Use the
    /// preview engine"), by engine id: seen from then on as with the preview key, for those engines only.
    public static let optInDefaultsKey = "previewEngineOptIns"

    public static func visible(channel: String?, beta: Bool, preview: Bool) -> Bool {
        switch channel {
        case nil: return true
        case Self.beta?: return beta || preview
        default: return preview
        }
    }

    /// The same rule for one engine, counting the player's opt-ins: a preview engine they took for a game.
    public static func visible(_ manifest: EngineManifest, beta: Bool, preview: Bool, optedIn: Set<String>) -> Bool {
        visible(channel: manifest.channel, beta: beta, preview: preview)
            || (manifest.channel == Self.preview && optedIn.contains(manifest.id))
    }

    /// Whether a recipe's engine pin names a bundled engine this install may not see. Such a recipe
    /// is not offered at all: without this, Play would find the pin missing from the visible engines
    /// and tell the player to update Highball, though no update would show it either. A pin no
    /// bundled manifest carries is not hidden; that case keeps its own "update Highball" answer.
    public static func hidesPin(_ pin: String?, bundled: [EngineManifest], beta: Bool, preview: Bool,
                                optedIn: Set<String> = []) -> Bool {
        guard let pin, let manifest = bundled.first(where: { $0.id == pin }) else { return false }
        return !visible(manifest, beta: beta, preview: preview, optedIn: optedIn)
    }

    /// The preview engine a recipe pins while this install does not see it: Play offers it instead of
    /// launching the game as if the recipe did not exist, which for Microsoft Flight Simulator 2024 meant
    /// a Rosetta engine the game cannot start on (2026-10-18). nil for a visible pin, a pin on another
    /// hidden channel (beta lines reach players through beta builds) or a pin no bundled manifest carries.
    public static func previewToOffer(pin: String?, bundled: [EngineManifest], beta: Bool, preview: Bool,
                                      optedIn: Set<String>) -> EngineManifest? {
        guard let pin, let manifest = bundled.first(where: { $0.id == pin }), manifest.channel == Self.preview,
              !visible(manifest, beta: beta, preview: preview, optedIn: optedIn) else { return nil }
        return manifest
    }

    /// Whether an environment on `current` already runs the preview line `offer` belongs to: an earlier revision the
    /// player took for the game. Play then counts the later revision as theirs too and offers the move
    /// (Recipe.previewRevisionToOffer) instead of asking whether to use a preview engine they already use. The line
    /// decides, with the bundled offer's channel saying it is in preview, whatever the installed copy of the current
    /// engine's manifest carries.
    public static func runsLine(current: EngineManifest, of offer: EngineManifest) -> Bool {
        guard offer.channel == Self.preview, let line = EngineManifest.line(of: current.id) else { return false }
        return line == EngineManifest.line(of: offer.id)
    }
}

```

### Core Architecture Module: `Sources/HighballKit/EngineIntegrity.swift`
```
import Foundation

/// Files that left the engine folder after it was installed.
///
/// Wine prints `err:module:import_dll Library shcore.dll (which is needed by ...) not found`
/// for two unrelated reasons. A program can ask for a DLL it was supposed to ship itself —
/// Steam's `gldriverquery.exe` asks for SDL2.dll on every launch and nothing is wrong — or Wine
/// can fail to find one of its own builtins, which every build of it ships, and that means files
/// are gone from the installed engine. An antivirus quarantine is what that looks like from the
/// inside: highball#151 and #153 both arrived as `exit=53` with five of Wine's own DLLs not
/// found, and both took a round of questions before anyone could say so. The app said
/// "SteamSetup.exe didn't finish. Highball can try again with a fresh copy", which is advice
/// that can never work, because the download was never the problem.
///
/// A name counts only when it is one of Wine's own DLLs AND it really is absent from this
/// engine's lib folders, so a game's missing SDL2.dll stays what it is: the game's business.
public enum EngineIntegrity {
    /// Wine's own DLLs. Every build ships all of these, and nothing installed into a bottle
    /// replaces the copy in the engine's lib folders. Deliberately short: a name here that an
    /// engine legitimately lacks would turn an ordinary failure into a false "engine damaged".
    public static let builtins: Set<String> = [
        "ntdll.dll", "kernel32.dll", "kernelbase.dll", "user32.dll", "gdi32.dll", "advapi32.dll",
        "ole32.dll", "oleaut32.dll", "combase.dll", "shell32.dll", "shlwapi.dll", "shcore.dll",
        "rpcrt4.dll", "msvcrt.dll", "ws2_32.dll", "setupapi.dll", "version.dll", "imm32.dll",
        "comctl32.dll", "comdlg32.dll", "winmm.dll", "win32u.dll", "sechost.dll", "crypt32.dll",
    ]

    /// Where an engine keeps its builtins, 64-bit half first. The 64-bit directory follows the
    /// engine's architecture (`aarch64-windows` on the arm64 line).
    public static func libraryDirectories(engineRoot: URL, arch: String = "x86_64") -> [URL] {
        ["engine/lib/wine/\(EngineManifest.pe64LibDir(arch: arch))", "engine/lib/wine/\(EngineManifest.pe32LibDir)"]
            .map { engineRoot.appending(path: $0, directoryHint: .isDirectory) }
    }

    /// The DLL names in Wine's `Library <name> ... not found` lines, lowercased, in the order
    /// they appeared and without repeats. Pure, so the parsing is tested without a Wine run.
    public static func librariesNotFound(in output: String) -> [String] {
        var seen = Set<String>(), names: [String] = []
        for line in output.split(separator: "\n") where line.contains("import_dll") && line.contains("not found") {
            guard let range = line.range(of: "Library [A-Za-z0-9_.+-]+", options: .regularExpression) else { continue }
            let name = line[range].dropFirst("Library ".count).lowercased()
            guard !name.isEmpty, seen.insert(String(name)).inserted else { continue }
            names.append(String(name))
        }
        return names
    }

    /// Of the DLLs Wine could not find, its own that are absent from this engine on disk.
    /// Empty when the engine is intact, which is the normal answer.
    public static func gone(fromEngineAt root: URL, notFound: [String], arch: String = "x86_64") -> [String] {
        let dirs = libraryDirectories(engineRoot: root, arch: arch)
        return notFound.filter { name in
            builtins.contains(name) && !dirs.contains { FileManager.default.fileExists(atPath: $0.appending(path: name).path) }
        }
    }

    /// "shcore.dll, shlwapi.dll and three others", for a sentence.
    public static func list(_ files: [String]) -> String {
        switch files.count {
        case 0: return "Files"
        case 1: return files[0]
        case 2: return "\(files[0]) and \(files[1])"
        default: return "\(files[0]), \(files[1]) and \(files.count - 2) more"
        }
    }
}

```

### Core Architecture Module: `Sources/HighballKit/EngineStore.swift`
```
import CryptoKit
import Foundation

public enum HighballError: Error, CustomStringConvertible {
    case checksumMismatch(file: String, expected: String, actual: String)
    case processFailed(command: String, status: Int32, output: String)
    case missing(String)
    case invalid(String)
    /// Wine's own DLLs are gone from an installed engine, so nothing Windows can start in it
    /// (highball#151, #153: an antivirus quarantine emptying parts of Highball's folder).
    case engineDamaged(engine: String, files: [String])
    /// A message already written for the user. Carries no prefix, so it reads as a sentence
    /// rather than as a category the reader has to decode.
    case failed(String)

    public var description: String {
        switch self {
        case let .checksumMismatch(file, expected, actual):
            return "checksum mismatch for \(file): expected \(expected), got \(actual)"
        case let .processFailed(command, status, output):
            return "\(command) exited with \(status)\n\(output)"
        case let .engineDamaged(engine, files):
            return "engine \(engine) is missing Wine's own \(files.joined(separator: ", "))"
        case let .missing(what): return "missing: \(what)"
        case let .invalid(what): return "invalid: \(what)"
        case let .failed(message): return message
        }
    }
}

/// Progress callback: (component name, bytes received, total bytes or nil).
public typealias DownloadProgress = @Sendable (String, Int64, Int64?) -> Void

/// Downloads, verifies and lays out engines from manifests.
///
/// Installed layout: `engines/<id>/{engine, frameworks, renderers/<name>/..., manifest.json}`
public struct EngineStore: Sendable {
    public let paths: HighballPaths

    public init(paths: HighballPaths = HighballPaths()) { self.paths = paths }

    // MARK: Query

    public func installedEngines() throws -> [InstalledEngine] {
        guard FileManager.default.fileExists(atPath: paths.engines.path) else { return [] }
        let dirs = try FileManager.default.contentsOfDirectory(at: paths.engines, includingPropertiesForKeys: nil)
        return dirs.compactMap { dir in
            let manifest = dir.appending(path: "manifest.json")
            guard let m = try? EngineManifest.load(from: manifest) else { return nil }
            try? linkRuntime(dir)   // heals broken runtime links from pre-0.7.9 installs
            try? linkSignedLoader(dir, manifest: m)   // an app that moved repoints its arm64 engines
            // GStreamer took the plugin folder's `._libgst*.dylib` files for plugins (see AppleDouble); this also
            // heals engines installed before the cleanup.
            AppleDouble.removeTwins(in: InstalledEngine(manifest: m, root: dir).gstreamerPluginDir, recursive: false)
            return InstalledEngine(manifest: m, root: dir)
        }.sorted { $0.manifest.id < $1.manifest.id }
    }

    /// The engine to use by default: the one the bundled manifest names when it is installed,
    /// else the newest installed. Newest is the highest id under numeric-aware ordering, so
    /// `…-r10` beats `…-r9` and `…-r2`. After an engine update two engines coexist, and the
    /// CLI, which has no bundled manifest, created bottles on the old one while the app used
    /// the new one (found 2026-09-04: a bottle created from the CLI ran r0 next to the app's r1).
    public static func defaultEngine(installed: [InstalledEngine], bundledID: String?) -> InstalledEngine? {
        installed.first { $0.id == bundledID }
            ?? installed.max { $0.id.compare($1.id, options: .numeric) == .orderedAscending }
    }

    /// Whether an engine update may apply itself without a click: only when the Wine build is the
    /// same (a component-only update, r1's MoltenVK or r2's timestamp shim), so no environment is
    /// re-run and nothing can regress. Users kept appearing on old engines because the update
    /// needed a click (#61's reporter was on r0 with 0.8.3; ux-plan item 9).
    public static func autoUpdateAllowed(from installed: EngineManifest, to update: EngineManifest) -> Bool {
        !EngineManifest.needsPrefixRefresh(from: installed, to: update)
    }

    /// Engines nothing references any more: not the default, not the engine of any bottle, and
    /// not one the app still offers (`keep`: the bundled manifests, so an engine someone
    /// downloaded for rollback survives the next update even with no bottle on it right now).
    /// An engine update never removes an engine a bottle still runs on; a bottle keeps its
    /// engine until its owner switches it (per-bottle choice, not migration).
    public static func unreferencedEngines(installed: [InstalledEngine], referencedIDs: Set<String>, defaultID: String?, keep: Set<String> = []) -> [InstalledEngine] {
        installed.filter { $0.id != defaultID && !referencedIDs.contains($0.id) && !keep.contains($0.id) }
    }

    /// Which licences a newly installed engine records as accepted: the ones asked for, plus any
    /// already accepted on an engine installed here. Same id means the same licence text, so a
    /// second engine carrying the same D3DMetal does not ask again. Not carrying them left an
    /// engine that has D3DMetal but will not serve it, so a bottle set to Apple's DirectX 12
    /// silently fell back on every launch with nothing obviously wrong (highball#61, reproduced
    /// here 2026-09-09 when a fresh install of r5 dropped the acceptance made on r4).
    public static func acceptances(requested: Set<String>, installed: [InstalledEngine]) -> [String] {
        Array(requested.union(installed.flatMap { $0.manifest.acceptedLicenses ?? [] })).sorted()
    }

    /// Whether an engine update may move a bottle onto `fresh` without re-running the Windows
    /// first boot. The question is about the bottle's OWN engine: comparing the previous default
    /// instead walked bottles across Wine builds whenever the default's own step was
    /// component-only (2026-09-09, a 0.8.9 build moved Wine 11 bottles onto its Wine 10 default
    /// because r1 to r2 was same-Wine, and their prefixes are a different format).
    /// A bottle whose engine is not installed here returns false: this build cannot tell.
    ///
    /// Same Wine is not enough on its own: the move must also keep what the bottle's engine
    /// offers. The GPTK 4 line (r6, r12, r14) shares the default line's Wine build and adds Apple's
    /// D3DMetal 4, and 0.10.0's update walked those bottles onto the default engine, taking
    /// D3DMetal 4 away without a word. `shipped` names every component this app still ships in any
    /// of its manifests: one the bottle's engine has and `fresh` lacks holds the bottle back, unless
    /// no manifest ships it any more (lsfg, withdrawn at its author's request, must not keep r7 and
    /// r9 bottles off every later engine).
    public static func canMoveBottle(on bottleEngine: EngineManifest?, to fresh: EngineManifest, shipped: Set<String>? = nil) -> Bool {
        guard let bottleEngine, !EngineManifest.needsPrefixRefresh(from: bottleEngine, to: fresh) else { return false }
        return componentsLost(from: bottleEngine, to: fresh, shipped: shipped).isEmpty
    }

    /// The components a move from `old` to `new` would take away, among those still shipped.
    public static func componentsLost(from old: EngineManifest, to new: EngineManifest, shipped: Set<String>?) -> [String] {
        guard let shipped else { return [] }
        return old.components.keys.filter { shipped.contains($0) && new.components[$0] == nil }.sorted()
    }

    /// Where a bottle the default engine's update left behind should go instead: among `known`,
    /// a later revision of the bottle's own engine line that runs on this macOS and takes the
    /// bottle there without a first boot and without losing a shipped component. Of those, the
    /// one adding the fewest components (the same variant, not a bigger one: the default line and
    /// the GPTK 4 line share revision numbers), then the newest. A GPTK 4 bottle on r14 gets r16
    /// this way when the default moves from r13 to r15, and an r13 bottle would get r15, not r16.
    public static func successor(for bottleEngine: EngineManifest, among known: [EngineManifest],
                                 shipped: Set<String>, macOS: String = EngineManifest.currentMacOS) -> EngineManifest? {
        let candidates = known.filter { m in
            m.id != bottleEngine.id
                && EngineManifest.isAtOrAfter(current: m.id, wanted: bottleEngine.id)
                && m.runs(onMacOS: macOS)
                && canMoveBottle(on: bottleEngine, to: m, shipped: shipped)
        }
        func added(_ m: EngineManifest) -> Int { m.components.keys.filter { bottleEngine.components[$0] == nil }.count }
        return candidates.min { a, b in
            if added(a) != added(b) { return added(a) < added(b) }
            return a.id.compare(b.id, options: .numeric) == .orderedDescending
        }
    }

    /// The one engine an update may delete: the default it just superseded, and only when no
    /// bottle is left on it. Everything else stays, including an engine this build does not
    /// recognise, because a newer Highball may have installed it and removing it both discards a
    /// large download and strands the bottles that use it.
    public static func engineToRemoveAfterUpdate(oldID: String, freshID: String,
                                                 referencedIDs: Set<String>,
                                                 installed: [InstalledEngine]) -> InstalledEngine? {
        guard oldID != freshID, !referencedIDs.contains(oldID) else { return nil }
        return installed.first { $0.id == oldID }
    }

    /// The engine to offer when a program fails on `currentID`: the default engine when the
    /// bottle is not on it (the newer one, usually), else the newest other installed engine.
   
```

### Core Architecture Module: `Sources/HighballKit/EngineSwitchPlan.swift`
```
import Foundation

/// What switching one environment to another engine involves, step by step, for the page a player
/// sees when they pick an engine themselves (highball#254, from PR #230). Pure, so the page and the
/// tests agree on the steps: the app runs the same work it always did (AppState.moveBottle).
public struct EngineSwitchPlan: Equatable, Sendable {
    public enum Step: String, CaseIterable, Sendable {
        /// The engine is only known from a bundled manifest: it downloads first.
        case download
        /// Programs running in the environment are stopped, so nothing keeps the old Wine open.
        case stopPrograms
        /// A different Wine build: the Windows first boot runs again in the environment.
        case windowsSetup
        case done
    }

    public let steps: [Step]

    public init(engineInstalled: Bool, refreshesWindows: Bool) {
        var steps: [Step] = []
        if !engineInstalled { steps.append(.download) }
        steps.append(.stopPrograms)
        if refreshesWindows { steps.append(.windowsSetup) }
        steps.append(.done)
        self.steps = steps
    }
}

```

### Core Architecture Module: `Package.swift`
```
// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "highball",
    platforms: [.macOS(.v14)],
    products: [
        .library(name: "HighballKit", targets: ["HighballKit"]),
        .executable(name: "highball", targets: ["highball"]),
        .executable(name: "HighballApp", targets: ["HighballApp"]),
    ],
    dependencies: [
        .package(url: "https://github.com/apple/swift-argument-parser.git", from: "1.5.0"),
        .package(url: "https://github.com/sparkle-project/Sparkle", from: "2.6.0"),
    ],
    targets: [
        .target(name: "HighballKit", path: "Sources/HighballKit", swiftSettings: [.enableUpcomingFeature("StrictConcurrency")]),
        .executableTarget(
            name: "highball",
            dependencies: ["HighballKit", .product(name: "ArgumentParser", package: "swift-argument-parser")],
            path: "Sources/highball"),
        .executableTarget(
            name: "HighballApp",
            dependencies: ["HighballKit", .product(name: "Sparkle", package: "Sparkle")],
            path: "Sources/HighballApp",
            linkerSettings: [.unsafeFlags(["-Xlinker", "-rpath", "-Xlinker", "@executable_path/../Frameworks"])]),
        .testTarget(name: "HighballKitTests", dependencies: ["HighballKit"], path: "Tests/HighballKitTests"),
    ]
)

```

### Core Architecture Module: `Scripts/make-dmg-background.swift`
```
// Renders the background of the Highball disk-image window: warm cream ground, wordmark, and
// a gold arrow from where Highball.app sits to the Applications folder.
// The ground is light on purpose: Finder paints icon labels black over a background picture
// in BOTH light and dark mode (verified on macOS 26), so a dark ground hides "Highball" and
// "Applications". The geometry (window size, icon centres) must match the icon positions
// baked into Scripts/dmg/DS_Store — regenerate that with Scripts/dmg-layout.sh when it changes.
// Usage: swift Scripts/make-dmg-background.swift <out-1x.png> <out-2x.png>
import AppKit

// Window content size in points and the icon centres, all measured from the top-left.
// The image is rendered taller than the content: Finder anchors it top-left and clips the
// rest, so a title bar that is a few points shorter on another macOS never exposes a bare
// strip under the paper. Nothing important is drawn below contentH.
let W: CGFloat = 660, contentH: CGFloat = 400, H: CGFloat = 440
let iconSize: CGFloat = 128
let appCenter  = CGPoint(x: 150, y: 185)
let appsCenter = CGPoint(x: 510, y: 185)

func color(_ hex: UInt32, _ a: CGFloat = 1) -> NSColor {
    NSColor(srgbRed: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255, alpha: a)
}
// The app icon's and gethighball.com's palette, on paper instead of charcoal.
let paperTop: UInt32 = 0xF7F1E5, paperBottom: UInt32 = 0xEEE5D2
let ink: UInt32 = 0x16110A, mutedInk: UInt32 = 0x75654D, amber: UInt32 = 0xD79A45, amberDeep: UInt32 = 0xB87A2E

func rounded(_ size: CGFloat, _ weight: NSFont.Weight) -> NSFont {
    let base = NSFont.systemFont(ofSize: size, weight: weight)
    guard let d = base.fontDescriptor.withDesign(.rounded), let f = NSFont(descriptor: d, size: size) else { return base }
    return f
}

func text(_ s: String, _ font: NSFont, _ c: NSColor, at p: CGPoint, align: NSTextAlignment = .left) {
    let attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: c]
    let str = NSAttributedString(string: s, attributes: attrs)
    let size = str.size()
    var x = p.x
    if align == .center { x -= size.width / 2 } else if align == .right { x -= size.width }
    str.draw(at: CGPoint(x: x, y: p.y))
}

func render(scale: CGFloat) -> NSImage {
    NSImage(size: NSSize(width: W * scale, height: H * scale), flipped: true) { _ in
        guard let ctx = NSGraphicsContext.current?.cgContext else { return false }
        ctx.scaleBy(x: scale, y: scale)
        ctx.setAllowsAntialiasing(true)
        ctx.setShouldSmoothFonts(true)
        let space = CGColorSpace(name: CGColorSpace.sRGB)!

        // Paper ground, a touch brighter at the top.
        let paper = CGGradient(colorsSpace: space, colors: [color(paperTop).cgColor, color(paperBottom).cgColor] as CFArray, locations: [0, 1])!
        ctx.drawLinearGradient(paper, start: .zero, end: CGPoint(x: 0, y: H), options: [])

        // Warm amber pool behind the icon row: the drink, not a spotlight.
        let mid = CGPoint(x: (appCenter.x + appsCenter.x) / 2, y: appCenter.y + 10)
        let glow = CGGradient(colorsSpace: space,
                              colors: [color(amber, 0.20).cgColor, color(amber, 0.07).cgColor, color(amber, 0).cgColor] as CFArray,
                              locations: [0, 0.5, 1])!
        ctx.drawRadialGradient(glow, startCenter: mid, startRadius: 0, endCenter: mid, endRadius: 340, options: [])

        // The shelf the icons stand on: a hairline that fades out at both ends.
        let shelfY = appCenter.y + iconSize / 2 + 34
        let shelf = CGGradient(colorsSpace: space,
                               colors: [color(ink, 0).cgColor, color(ink, 0.18).cgColor, color(ink, 0).cgColor] as CFArray,
                               locations: [0, 0.5, 1])!
        ctx.saveGState()
        ctx.clip(to: CGRect(x: 60, y: shelfY, width: W - 120, height: 1))
        ctx.drawLinearGradient(shelf, start: CGPoint(x: 60, y: shelfY), end: CGPoint(x: W - 60, y: shelfY), options: [])
        ctx.restoreGState()

        // The arrow: app -> Applications. Thick, round, gold, lit from above.
        let gap: CGFloat = 36
        let x0 = appCenter.x + iconSize / 2 + gap
        let x1 = appsCenter.x - iconSize / 2 - gap
        let y = appCenter.y
        let head: CGFloat = 22
        let arrow = CGMutablePath()
        arrow.move(to: CGPoint(x: x0, y: y))
        arrow.addLine(to: CGPoint(x: x1, y: y))
        arrow.move(to: CGPoint(x: x1 - head, y: y - head))
        arrow.addLine(to: CGPoint(x: x1, y: y))
        arrow.addLine(to: CGPoint(x: x1 - head, y: y + head))
        ctx.setLineCap(.round); ctx.setLineJoin(.round)
        ctx.saveGState()
        ctx.setShadow(offset: CGSize(width: 0, height: 3), blur: 10, color: color(amberDeep, 0.35).cgColor)
        ctx.setStrokeColor(color(amberDeep).cgColor)
        ctx.setLineWidth(10)
        ctx.addPath(arrow); ctx.strokePath()
        ctx.restoreGState()
        ctx.setStrokeColor(color(amber).cgColor)
        ctx.setLineWidth(8)
        ctx.addPath(arrow); ctx.strokePath()
        ctx.setStrokeColor(color(0xF3CE8B, 0.9).cgColor)
        ctx.setLineWidth(2.5)
        ctx.addPath(arrow); ctx.strokePath()

        // Wordmark and tagline, top-left. Same rounded heavy face as the app's sidebar.
        text("Highball", rounded(24, .heavy), color(ink), at: CGPoint(x: 36, y: 28))
        text("Run Windows games on Apple Silicon.", rounded(13, .medium), color(mutedInk), at: CGPoint(x: 37, y: 60))

        // Instruction, centred under the shelf.
        text("Drag Highball into Applications", rounded(15, .semibold), color(ink), at: CGPoint(x: W / 2, y: shelfY + 22), align: .center)
        text("then open it from your Applications folder.", rounded(13, .regular), color(mutedInk), at: CGPoint(x: W / 2, y: shelfY + 46), align: .center)

        text("gethighball.com", rounded(11, .medium), color(mutedInk, 0.7), at: CGPoint(x: W - 36, y: contentH - 30), align: .right)
        return true
    }
}

func writePNG(_ image: NSImage, _ path: String, scale: CGFloat) {
    let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: Int(W * scale), pixelsHigh: Int(H * scale),
                               bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
                               colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    rep.size = NSSize(width: W * scale, height: H * scale)
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    image.draw(in: NSRect(x: 0, y: 0, width: W * scale, height: H * scale))
    NSGraphicsContext.restoreGraphicsState()
    guard let png = rep.representation(using: .png, properties: [:]) else { fatalError("render failed") }
    try! png.write(to: URL(fileURLWithPath: path))
    print("wrote \(path) (\(Int(W * scale))x\(Int(H * scale)))")
}

let args = CommandLine.arguments
guard args.count == 3 else {
    print("usage: swift Scripts/make-dmg-background.swift <out-1x.png> <out-2x.png>"); exit(2)
}
writePNG(render(scale: 1), args[1], scale: 1)
writePNG(render(scale: 2), args[2], scale: 2)

```

### Core Architecture Module: `Scripts/mark-builtin.py`
```
# Stamp Wine's builtin marker into a PE DLL so the loader accepts it from a WINEDLLPATH dir.
import sys, struct
for path in sys.argv[1:]:
    b = bytearray(open(path, 'rb').read())
    assert b[:2] == b'MZ', path
    e_lfanew = struct.unpack_from('<I', b, 0x3C)[0]
    assert e_lfanew >= 0x40 + 17, (path, e_lfanew)
    b[0x40:0x40 + 17] = b'Wine builtin DLL\0'
    open(path, 'wb').write(b); print('  marked', path.split('/')[-1], 'e_lfanew=0x%x' % e_lfanew)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #443** (2026-10-22): **Blue prince: blank screen**
  *Symptoms*: ### What happened  the game starts up with no problems at all. as soon as you click new game, it goes on the loading page and after that the screen goes white and nothing can be done  ### Chip and macOS  Apple M5, macOS 26.7.1  ### Highball version  0.10.22  ### Log  ~/Library/Application Support/Highball/logs/2026-10-22T150309Z-Games-BLUE PRINCE.exe.log: # gin x64-sikarugir10.0_6-r26 bottle=Games renderer=wined3d # wine ~/Library/Application Support/Highball/bottles/Games/drive_c/Games/Blue.Prince.v2026.09.24/Blue Prince/BLUE PRINCE.exe # sync=msync winver=win10 dpi=96 dxvkAsync=false frameGen=off # audio out=48000 Hz # WINEDLLOVERRIDES=winemenubuilder.exe=d # ROSETTA_ADVERTISE_AVX=1 # CX_FWD_COMPAT_GL_CTX=1 … 3 lines … 00a8:err:environ:init_peb starting L"C:\\windows\\Microsoft.NET\\Framework\\v4.0.30319\\mscorsvw.exe" in experimental wow64 mode  (x17) … 534 lines … 0024:err:winediag:wined3d_adapter_create Using the Vulkan renderer for d3d10/11 applications.  (x4) … 12 lines … 0024:err:d3d:validate_state_table State STATE_RENDER(WINED3D_RS_SPECULARENABLE) (0x1d) should have a representative.  (x4) 0024:err:d3d:validate_state_table State STATE_RENDER(WINED3D_RS_COLORKEYENABLE) (0x29) should have a representative.  (x4) 0024:err:d3d:validate_state_table State STATE_RENDER(WINED3D_RS_RANGEFOGENABLE) (0x30) should have a representative.  (x4) 0024:err:d3d:validate_state_table State STATE_RENDER(WINED3D_RS_LIGHTING) (0x89) should have a representative.  (x4) 0024:err:d3d:validat
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report. The game's folder is from a copy outside the stores, and Highball supports games as their stores sell them, so I can't help with that one. If you have it on Steam or another store, that copy is the one to try.

- **Issue #439** (2026-10-22): **Helldivers 2 no longer working due to easy anti-cheat**
  *Symptoms*: ### What happened  Recently Helldivers 2 changed from game-guard to easy anti-cheat and now either crashes on the anti-cheat start or simply doesn't start at all. I got the game to even try to start by switching off of crossover to wine and even then the anti-cheat failed on this error. I tried to attach the log from the wine start up.  <img width="746" height="413" alt="Image" src="https://github.com/user-attachments/assets/cef0171f-8175-4cc1-846a-aae8b3b358f2" />  ### Chip and macOS  Apple M5, macOS 27.0.1  ### Highball version  0.10.22  ### Log  ~/Library/Application Support/Highball/logs/2026-10-22T013932Z-Games-steam.exe.log: # gin x64-sikarugir10.0_6-r29 bottle=Games renderer=dxmt # wine ~/Library/Application Support/Highball/bottles/Games/drive_c/Program Files (x86)/Steam/steam.exe -silent -applaunch 440 # sync=msync winver=win10 dpi=96 dxvkAsync=false frameGen=off # audio out=44100 Hz (most games mix at 48000 Hz) # WINEDLLPATH_PREPEND=~/Library/Application Support/Highball/engines/x64-sikarugir10.0_6-r29/renderers/dxmt/wine:~/Library/Application Support/Highball/engines/x64-sikarugir10.0_6-r29/frameworks/renderer/d9vk/wine # WINEDLLOVERRIDES=winemenubuilder.exe=d # CX_FWD_COMPAT_GL_CTX=1 # DXVK_CONFIG_FILE=C:\highball\dxvk.conf # DXVK_LOG_PATH=C:\highball\logs #   dxvk.enableAsync = False … 370 lines … 015c:err:environ:init_peb starting L"C:\\Program Files (x86)\\Common Files\\Steam\\steamservice.exe" in experimental wow64 mode … 521 lines … # the line above repeated 
  **Post-Mortem & Fix Analysis**:
  > I just read the description that wine doesn't work with easy anti-cheat and realized I'm kinda dumb, AND while i was testing and writing this comment the game gave the same error with crossover as it did with wine even though just a second ago it wasn't even working.  <img width="1052" height="774" alt="Image" src="https://github.com/user-attachments/assets/135dffec-a9f6-4a7b-a26a-0d5c436172f4" /> (Edit: steam also shows up as a completely blank window)
  > Thanks for the report. Easy Anti-Cheat can run under Proton on Linux when a game allows it, but that doesn't carry over to Wine on a Mac, so with Easy Anti-Cheat Helldivers 2 is out of reach for Highball and CrossOver alike. I've noted it on the game's page. I'm closing this since there's nothing on our side to fix, but if the game ever drops it, comment here.

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

### Incident Patch 1: `0de235ca` (2026-10-20)
**Commit Message**: arm64-wine11.18-r6: the flight check passed. Microsoft Flight Simulator 2024 on r6 through the test harness (flight r6chk on the M4, the recipe's settings): boot, Free Flight at Gibraltar, a 2-minute park and a 1-minute take-off roll, no crash, no unhandled exception, no GPU hang, 26.1 fps parked and 21.8 rolling. The harness's Steam restarted on r6 started winebus's SDL, UDEV and IOHID buses and signed in.

**File**: `spike/engines/arm64-wine11.18-r6.json` (modified, +1/-1)
```diff
@@ -80,7 +80,7 @@
     "date": "2026-10-20",
     "macos": "27.0",
     "chip": "Apple M4",
-    "result": "This archive on a Mac mini M4 (checksum checked): in a fresh prefix with +hid, winebus logged SDL, UDEV and IOHID 'main loop started' within 10 s, where r5's never got past 'SDL main loop starting'. The flight check on this engine is pending. Not tested: a real controller (the M4 has none), other Macs."
+    "result": "This archive on a Mac mini M4 with 32 GB (checksum checked). Controllers: in a fresh prefix with +hid, winebus logged SDL, UDEV and IOHID 'main loop started' within 10 s, where r5's never got past 'SDL main loop starting', and the test harness's Steam, restarted on r6, started the same three and signed in. Steam copy of Microsoft Flight Simulator 2024 through the test harness with the recipe's settings (flight r6chk): boot, Free Flight, a Cessna 172 at Gibraltar, a 2-minute park and a 1-minute take-off roll in daylight, about 8 minutes to the start screen and 16 to the cockpit; no crash, no unhandled exception, no GPU hang; 26.1 fps parked and 21.8 rolling on this one flight (r5: 22.5 and 19 over four). Not tested: a real controller (the M4 has none), other Macs."
   },
   "licenses": {}
 }
```

---

### Incident Patch 2: `f85dd689` (2026-10-20)
**Commit Message**: Five fixes from the 2026-10-20 sweep.

A new environment for a game is named from its title through BottleStore.safeName: a colon before a space reads " - ", other colons, slashes and bars "-", the other characters Windows forbids go, and the name stops at 60 characters. "Onimusha: Way of the Sword Benchmark" refused to become an environment (highball#391), and 100 of the database's 501 titles carry such a character. A test runs every database and recipe title through it.

Before a launch the prefix's own Windows version is read from its registry files (the per-user Version, else CurrentBuild) and the setting written back when they differ. Something set an environment to Windows 7 and left it there, so Steam warned it would stop running on Windows 7 and RDR2 refused Windows 7, while the setting and the log header said Windows 11 (highball#396).

The launch log header shows the DXMT_, D3DM_, SDL_, MVK_ and HB_ switches and WINE_NO_DELAYED_FORK. They are settings, not personal, and a report could not tell whether DXMT_ALLOW_CROSS_PROCESS_SWAPCHAIN was set (highball#371).

A program that exits within 10 s with an error gets 20 s to come back before Highball calls it a crash and offers

**File**: `Sources/HighballApp/AppState.swift` (modified, +34/-2)
```diff
@@ -1567,7 +1567,7 @@ final class AppState {
     func createEnvironment(for recipe: HighballKit.Recipe, on manifest: EngineManifest, item: LibraryItem? = nil) {
         pendingEngine = nil
         guard !busy else { return }
-        let name = BottleStore.freeName(recipe.title, taken: Set(bottles.map(\.name)))
+        let name = BottleStore.freeName(BottleStore.safeName(fromTitle: recipe.title), taken: Set(bottles.map(\.name)))
         let accepted = Set(engines.flatMap { $0.manifest.acceptedLicenses ?? [] })
         let done: DoneState
         // The game installed where Play started comes along as a clone when it can (SteamGameCarryOver): no second
@@ -2735,7 +2735,18 @@ final class AppState {
                 switch outcome {
                 case .failure(let error): throw error
                 case .success(let result):
-                    if result.crashedEarly, !stopRequested { crashed(result); return false }
+                    if result.crashedEarly, !stopRequested {
+                        // A program that hands itself to its launcher exits at once with an error code
+                        // and comes back moments later, started by the launcher: Star Wars Galaxy of
+                        // Heroes through the EA app read as a crash and Highball offered another mode
+                        // for a game that was running fine (highball-db#566). It gets 20 s to appear.
+                        for _ in 0..<10 {
+                            if await started() { box.handedOff = true; return true }
+                            if stopRequested { return false }
+                            try await Task.sleep(for: .seconds(2))
+                        }
+                        crashed(result); return false
+                    }
                     if exitEndsWait { return false }
                     exited = true
                 }
@@ -3091,6 +3102,27 @@ final class AppState {
         return ids.contains(recipe.id)
     }
 
+    /// Takes a registry-only tweak back off an environment: each value it set is deleted, so Wine
+    /// uses its own default again, and the environment stops if nothing runs in it, since drivers
+    /// such as the controller bus read their options when the environment starts. A DualSense player
+    /// with "Controllers through SDL" installed had no way back short of regedit (Discord, 2026-10-19).
+    func removeTweak(_ recipe: HighballKit.Recipe, from bottle: Bottle) {
+        guard recipe.isRemovable, let engine = engine(for: bottle) else { return }
+        runBusy(String(format: L("Removing %@"), recipe.title)) { [self] in
+            let runner = WineRunner(paths: paths, engine: engine, bottle: bottle)
+            for value in recipe.registryValues { try await runner.regDelete(key: value.key, name: value.name) }
+            let stopped = ProcessTable.liveServer(forPrefix: bottle.url) != nil && ProcessTable.isIdle(prefix: bottle.url)
+            if stopped { _ = try? runner.kill() }
+            await MainActor.run {
+                var copy = self.bottles.first { $0.name == bottle.name } ?? bottle
+                copy.settings.recipes.removeAll { $0 == recipe.id }
+                self.update(copy)
+                self.appendLog("\(recipe.title) removed from \(bottle.name): its registry values are gone, so Wine uses its defaults again"
+                               + (stopped ? "; the idle environment stopped so its next start reads them." : ". Stop the environment once so programs see it."))
+            }
+        }
+    }
+
     /// A runtime a game's own first-run setup installed (Steam runs the Visual C++ redist for
     /// most games) registers itself like Highball's install does, but leaves Wine's built-in
     /// copies of its DLLs in front of the real ones, and a launcher that checks those files
```

**File**: `Sources/HighballApp/BottleView.swift` (modified, +3/-0)
```diff
@@ -593,6 +593,9 @@ struct EnvironmentSettingsPage: View {
                                     let live = state.bottles.first { $0.name == bottle.name } ?? bottle
                                     if live.settings.recipes.contains(r.id) || state.tweakIsInstalled(r, in: live) {
                                         Label(L("Installed"), systemImage: "checkmark.circle.fill").foregroundStyle(.green).labelStyle(.titleAndIcon)
+                                        if r.isRemovable {
+                                            Button(L("Remove")) { state.removeTweak(r, from: live) }.controlSize(.small).disabled(state.busy)
+                                        }
                                     } else {
                                         Button(L("Install")) {
                                             state.applyRecipe(r.id, to: state.bottles.first { $0.name == bottle.name } ?? bottle)
```

**File**: `Sources/HighballKit/BottleStore.swift` (modified, +27/-0)
```diff
@@ -43,6 +43,33 @@ public struct BottleStore: Sendable {
         return candidate
     }
 
+    /// A name `nameProblem` accepts, made from a game's title, for an environment Highball creates
+    /// for that game. A fifth of the database's titles carry a character Windows forbids in paths,
+    /// mostly a colon, and "Onimusha: Way of the Sword Benchmark" refused to become an environment
+    /// (highball#391). A colon before a space reads as " - ", any other colon, slash or bar as "-",
+    /// the other forbidden characters and control characters go, spaces close up, leading and
+    /// trailing dots and dashes go, and the name stops at 60 characters so freeName's " 2" still fits.
+    public static func safeName(fromTitle title: String) -> String {
+        let chars = Array(title)
+        var out = ""
+        for (i, ch) in chars.enumerated() {
+            if ch.unicodeScalars.contains(where: { CharacterSet.controlCharacters.contains($0) }) { out += " "; continue }
+            switch ch {
+            case ":": out += (i + 1 < chars.count && chars[i + 1] == " ") ? " -" : "-"
+            case "/", "\\", "|": out += "-"
+            case "*", "?", "\"", "<", ">": continue
+            default: out.append(ch)
+            }
+        }
+        func tidy(_ s: String) -> String {
+            s.split(separator: " ", omittingEmptySubsequences: true).joined(separator: " ")
+                .trimmingCharacters(in: CharacterSet(charactersIn: " .-"))
+        }
+        var name = tidy(out)
+        if name.count > 60 { name = tidy(String(name.prefix(60))) }
+        return name.isEmpty ? "Game" : name
+    }
+
     public static func nameProblem(_ name: String) -> String? {
         let trimmed = name.trimmingCharacters(in: .whitespaces)
         if trimmed.isEmpty { return "The bottle name is empty." }
```

**File**: `Sources/HighballKit/Recipe.swift` (modified, +14/-0)
```diff
@@ -316,6 +316,20 @@ public struct Recipe: Codable, Sendable, Identifiable {
         public var min: Int?
     }
 
+    /// A tweak made only of registry values (and notes) can be taken back off: deleting each value it
+    /// set returns Wine to its own default for it. "Controllers through SDL" asked for it, since a
+    /// DualSense gives no input in some games with it on and the app could only install it.
+    public var isRemovable: Bool {
+        kind == .tweak && !registryValues.isEmpty && steps.allSatisfy {
+            switch $0 { case .registry, .note: return true; default: return false }
+        }
+    }
+
+    /// The registry values this recipe sets, key and name.
+    public var registryValues: [(key: String, name: String)] {
+        steps.compactMap { if case let .registry(key, name, _, _) = $0 { return (key, name) } else { return nil } }
+    }
+
     /// True when any marker is present in the bottle. Recipes without markers report false; the
     /// caller still knows whether the recipe ran.
     public func isInstalled(in bottle: Bottle) -> Bool {
```

**File**: `Sources/HighballKit/WineRunner.swift` (modified, +51/-0)
```diff
@@ -91,6 +91,15 @@ public struct WineRunner: Sendable {
     /// GitHub issue, and a bottle's env can hold personal paths or tokens. Without it a report
     /// cannot separate "the config was never delivered" from "the config was delivered and did
     /// not help", which is exactly where issue #21 stalled for two rounds.
+    static let headerSwitchPrefixes = ["DXMT_", "D3DM_", "SDL_", "MVK_", "HB_", "WINE_NO_DELAYED_FORK"]
+
+    /// The header lines for those switches, in name order, short values only.
+    static func headerSwitchLines(_ env: [String: String]) -> String {
+        env.keys.sorted().filter { key in headerSwitchPrefixes.contains { key.hasPrefix($0) } }
+            .compactMap { key in env[key].flatMap { $0.count <= 200 ? "# \(key)=\($0)\n" : nil } }
+            .joined()
+    }
+
     static func launchHeader(engine: InstalledEngine, bottle: Bottle, renderer: Renderer,
                              env: [String: String], args: [String]) -> String {
         var out = "# gin \(engine.id) bottle=\(bottle.name) renderer=\(renderer)\n"
@@ -109,6 +118,10 @@ public struct WineRunner: Sendable {
         for key in ["WINEDLLPATH_PREPEND", "WINEDLLOVERRIDES", "ROSETTA_ADVERTISE_AVX", "MTL_HUD_ENABLED", "CX_FWD_COMPAT_GL_CTX", "DXVK_CONFIG_FILE", "DXVK_LOG_PATH", "DXVK_CONFIG", "VKD3D_SHADER_MODEL", "VKD3D_FEATURE_LEVEL", "VKD3D_CONFIG", "VKD3D_SHADER_CACHE_PATH", "LSFGM_MULTIPLIER", "LSFGM_PACING_MODE", "LSFGM_FLOW_SCALE", "LSFGM_DLL_PATH"] {
             if let value = env[key] { out += "# \(key)=\(value)\n" }
         }
+        // Renderer and controller switches a player or a recipe sets: settings, never personal, and
+        // a report can't tell whether one was set without them (highball#371 asked whether
+        // DXMT_ALLOW_CROSS_PROCESS_SWAPCHAIN was in the environment, and the log couldn't say).
+        out += headerSwitchLines(env)
         // The generated dxvk.conf decides per-game behaviour, so quote it rather than making the
         // reader ask for a second file that Repair may already have rewritten.
         if env["DXVK_CONFIG_FILE"] != nil,
@@ -289,6 +302,7 @@ public struct WineRunner: Sendable {
     public func start(_ executable: URL, arguments: [String] = [], renderer: Renderer? = nil, extraEnvironment: [String: String] = [:], workingDirectory: URL? = nil, headerNote: String? = nil, program: String? = nil, onOutput: (@Sendable (String) -> Void)? = nil) async throws -> LaunchResult {
         // First, while no server holds the hive: the syncs below start the environment's server.
         let linkedSteamView = (try? SteamRegistryView.repair(prefix: bottle.url)) == true
+        let prefixVersion = Self.prefixWindowsVersion(prefix: bottle.url)
         await syncMacFontSubstitutes()
         await syncDllOverridesRegistry()
         await syncEngineAppDefaults()
@@ -299,6 +313,15 @@ public struct WineRunner: Sendable {
             onOutput?("note: \(text)")
             note = [note, text].compactMap { $0 }.joined(separator: "; ")
         }
+        // highball#396: winetricks verbs and some installers set the prefix to Windows 7 and leave it.
+        // Steam then warned it would stop running on Windows 7 and RDR2 refused to start, while the
+        // environment's setting, and the header below, still said Windows 11. The setting wins.
+        let wantedVersion = bottle.settings.windowsVersion.rawValue
+        if let found = prefixVersion, found != wantedVersion, (try? await setWindowsVersion(bottle.settings.windowsVersion)) != nil {
+            let text = "the prefix reported \(found), set back to \(wantedVersion) as the environment's settings say"
+            onOutput?("note: \(text)")
+            note = [note, text].compactMap { $0 }.joined(separator: "; ")
+        }
         // External Mac drives get letters of their own, so Steam can offer them for a library.
         // Windows lists drives through Wine's mount manager, which reads the links when the
         // environment's server starts: a letter linked while the server ran stayed unlisted until
@@ -759,6 +782,34 @@ public struct WineRunner: Sendable {
     public func setWindowsVersion(_ v: WindowsVersion) async throws {
         _ = try await run(["winecfg", "-v", v.rawValue], renderer: .wined3d, label: "winecfg")
     }
+
+    /// The Windows version a prefix reports, from its registry files, as winecfg names it, or nil
+    /// when the files can't be read or say nothing. Wine takes HKCU\Software\Wine's Version first
+    /// (winetricks and older winecfg write it) and otherwise the machine's CurrentBuild, which
+    /// `winecfg -v` writes while it removes the per-user value.
+    public static func prefixWindowsVersion(prefix: URL) -> String? {
+        let user = (try? String(contentsOf: prefix.appending(path: "user.reg"), encoding: .utf8)) ?? ""
+        let system = (try? String(contentsOf: prefix.appending(path: "system.reg"), encoding: .utf8)) ?? ""
+        return prefixWindowsV
```

**File**: `Tests/HighballKitTests/LaunchChecksTests.swift` (added, +54/-0)
```diff
@@ -0,0 +1,54 @@
+import XCTest
+@testable import HighballKit
+
+/// The checks a launch makes before the program starts, and the tweak removal next to them.
+final class LaunchChecksTests: XCTestCase {
+
+    /// highball#396: Steam warned it would stop running on Windows 7 in an environment whose setting
+    /// said Windows 11. The prefix's own version is what Wine reports, read from its registry files.
+    func testPrefixWindowsVersionComesFromTheRegistryFiles() {
+        func system(_ build: String) -> String {
+            "WINE REGISTRY Version 2\n\n[Software\\\\Microsoft\\\\Windows NT\\\\CurrentVersion] 1788462370\n\"CurrentBuild\"=\"\(build)\"\n\"CurrentVersion\"=\"6.3\"\n"
+        }
+        XCTAssertEqual(WineRunner.prefixWindowsVersion(userReg: "", systemReg: system("7601")), "win7", "what winetricks win7 leaves")
+        XCTAssertEqual(WineRunner.prefixWindowsVersion(userReg: "", systemReg: system("19045")), "win10")
+        XCTAssertEqual(WineRunner.prefixWindowsVersion(userReg: "", systemReg: system("22000")), "win11")
+        XCTAssertEqual(WineRunner.prefixWindowsVersion(userReg: "", systemReg: system("9600")), "win81")
+        XCTAssertNil(WineRunner.prefixWindowsVersion(userReg: "", systemReg: ""), "nothing to read, nothing to change")
+        // The per-user value wins in Wine, so it wins here.
+        let user = "WINE REGISTRY Version 2\n\n[Software\\\\Wine] 1788462370\n\"Version\"=\"win7\"\n\n[Software\\\\Wine\\\\Direct3D] 1788462370\n\"Version\"=\"win11\"\n"
+        XCTAssertEqual(WineRunner.prefixWindowsVersion(userReg: user, systemReg: system("22000")), "win7")
+        XCTAssertEqual(WineRunner.prefixWindowsVersion(userReg: "[Software\\\\Wine\\\\Direct3D] 1\n\"Version\"=\"win7\"\n", systemReg: system("22000")), "win11",
+                       "a value of the same name under another key is not the version")
+    }
+
+    /// highball#371: the log could not show whether DXMT_ALLOW_CROSS_PROCESS_SWAPCHAIN was set.
+    func testTheHeaderShowsRendererAndControllerSwitchesOnly() {
+        let env = ["DXMT_ALLOW_CROSS_PROCESS_SWAPCHAIN": "1", "SDL_JOYSTICK_MFI": "0", "HOME": "/Users/someone",
+                   "STEAM_TOKEN": "secret", "MVK_CONFIG_USE_MTLHEAP": "0", "WINE_NO_DELAYED_FORK": "1",
+                   "D3DM_LONG": String(repeating: "x", count: 300)]
+        XCTAssertEqual(WineRunner.headerSwitchLines(env),
+                       "# DXMT_ALLOW_CROSS_PROCESS_SWAPCHAIN=1\n# MVK_CONFIG_USE_MTLHEAP=0\n# SDL_JOYSTICK_MFI=0\n# WINE_NO_DELAYED_FORK=1\n")
+    }
+
+    /// A DualSense player had "Controllers through SDL" installed and no way back but regedit.
+    func testRegistryOnlyTweaksCanBeRemoved() throws {
+        let sdl = try JSONDecoder.highball.decode(Recipe.self, from: Data("""
+        {"id": "controller-sdl", "kind": "tweak", "title": "Controllers through SDL", "steps": [
+          {"type": "registry", "key": "HKLM\\\\System\\\\CurrentControlSet\\\\Services\\\\winebus", "name": "DisableHidraw", "valueType": "REG_DWORD", "data": "1"},
+          {"type": "registry", "key": "HKLM\\\\System\\\\CurrentControlSet\\\\Services\\\\winebus", "name": "Enable SDL", "valueType": "REG_DWORD", "data": "1"},
+          {"type": "note", "text": "Restart the environment."}]}
+        """.utf8))
+        XCTAssertTrue(sdl.isRemovable)
+        XCTAssertEqual(sdl.registryValues.map(\.name), ["DisableHidraw", "Enable SDL"])
+        let runtime = try JSONDecoder.highball.decode(Recipe.self, from: Data("""
+        {"id": "xact", "kind": "tweak", "title": "XACT", "steps": [{"type": "winetricks", "verbs": ["xact"]},
+          {"type": "registry", "key": "HKCU\\\\Software\\\\Wine\\\\DllOverrides", "name": "xaudio2_7", "valueType": "REG_SZ", "data": "native"}]}
+        """.utf8))
+        XCTAssertFalse(runtime.isRemovable, "a runtime that installed files can't be taken off by deleting values")
+        let notesOnly = try JSONDecoder.highball.decode(Recipe.self, from: Data("""
+        {"id": "n", "kind": "tweak", "title": "N", "steps": [{"type": "note", "text": "x"}]}
+        """.utf8))
+        XCTAssertFalse(notesOnly.isRemovable, "nothing to remove")
+    }
+}
```

**File**: `Tests/HighballKitTests/RecipeDBTests.swift` (modified, +22/-0)
```diff
@@ -39,6 +39,28 @@ final class RecipeDBTests: XCTestCase {
         XCTAssertTrue(recipe.isInstalled(in: bottle), "the real runtime counts")
     }
 
+    /// highball#391: every title in the database and every recipe's title makes a usable
+    /// environment name, a fifth of them through BottleStore.safeName's replacements.
+    func testEveryTitleMakesAnEnvironmentName() throws {
+        guard FileManager.default.fileExists(atPath: dbRoot.appending(path: "db/games").path) else {
+            throw XCTSkip("no highball-db checkout beside the repo and no .build/highball-db clone")
+        }
+        var titles: [String] = []
+        for dir in ["db/games", "recipes/games", "recipes/launchers", "recipes/tweaks"] {
+            let files = (try? FileManager.default.contentsOfDirectory(at: dbRoot.appending(path: dir), includingPropertiesForKeys: nil)) ?? []
+            for f in files where f.pathExtension == "json" {
+                if let o = try? JSONSerialization.jsonObject(with: Data(contentsOf: f)) as? [String: Any],
+                   let t = o["title"] as? String { titles.append(t) }
+            }
+        }
+        XCTAssertGreaterThan(titles.count, 400)
+        for t in titles {
+            let name = BottleStore.safeName(fromTitle: t)
+            XCTAssertNil(BottleStore.nameProblem(name), "\(t) -> \(name)")
+            XCTAssertNil(BottleStore.nameProblem(BottleStore.freeName(name, taken: [name])), "\(t) with a suffix")
+        }
+    }
+
     func testAllShippedRecipesDecode() throws {
         let recipes = dbRoot.appending(path: "recipes")
         guard FileManager.default.fileExists(atPath: recipes.path) else {
```

**File**: `Tests/HighballKitTests/RecipeEngineTests.swift` (modified, +20/-0)
```diff
@@ -215,4 +215,24 @@ final class RecipeEngineTests: XCTestCase {
         XCTAssertEqual(BottleStore.freeName("EA app", taken: ["EA app"]), "EA app 2")
         XCTAssertEqual(BottleStore.freeName("EA app", taken: ["EA app", "EA app 2"]), "EA app 3")
     }
+
+    /// highball#391: a new environment for "Onimusha: Way of the Sword Benchmark" failed, since its
+    /// name came straight from the title and a bottle name can't hold a colon.
+    func testSafeNameFromTitle() {
+        XCTAssertEqual(BottleStore.safeName(fromTitle: "Onimusha: Way of the Sword Benchmark"), "Onimusha - Way of the Sword Benchmark")
+        XCTAssertEqual(BottleStore.safeName(fromTitle: "Seven Knights Re:BIRTH"), "Seven Knights Re-BIRTH")
+        XCTAssertEqual(BottleStore.safeName(fromTitle: "Fate/Stay Night"), "Fate-Stay Night")
+        XCTAssertEqual(BottleStore.safeName(fromTitle: "Who's Your Daddy?!"), "Who's Your Daddy!")
+        XCTAssertEqual(BottleStore.safeName(fromTitle: "\"Quoted\" <Game>"), "Quoted Game")
+        XCTAssertEqual(BottleStore.safeName(fromTitle: "PEAK"), "PEAK", "a usable title stays as it is")
+        XCTAssertEqual(BottleStore.safeName(fromTitle: "...Dots..."), "Dots")
+        XCTAssertEqual(BottleStore.safeName(fromTitle: "???"), "Game")
+        let long = BottleStore.safeName(fromTitle: "BRAZILIAN DRUG DEALER 3: I OPENED A PORTAL TO HELL IN THE FAVELA TRYING TO REVIVE MIT AIA I NEED TO CLOSE IT")
+        XCTAssertLessThanOrEqual(long.count, 60)
+        for title in ["Onimusha: Way of the Sword Benchmark", "Seven Knights Re:BIRTH", "a|b\\c*d", "x\ty", " : ", long] {
+            let name = BottleStore.safeName(fromTitle: title)
+            XCTAssertNil(BottleStore.nameProblem(name), "\(title) -> \(name)")
+            XCTAssertNil(BottleStore.nameProblem(BottleStore.freeName(name, taken: [name])), "with freeName's suffix")
+        }
+    }
 }
```

---

### Incident Patch 3: `7c9eb52c` (2026-10-19)
**Commit Message**: The app icon is now Hayden's .icon, which he built from the original icon's drawing script. Its ice stays see-through, the drink has more depth and the bubbles have a rim, closer to the old icon than the version this PR had. The one change to his file is the refraction effect, which is gone because Xcode 26.6's actool, which builds releases, stops on it with an exception, and on macOS 27 the icon draws the same without it (no pixel more than 0.8% apart). The static files, AppIcon.icns at every size from 16 to 1024 px (each drawn at its point size and scale), AppIcon.png and the README and docs logos, are this icon as macOS 27 draws it, rendered on the M4 from the catalog Xcode 26.6 compiles. Xcode 26.6 and 27.0 both compile it. make-app.sh says why the refraction effect stays out.

Co-authored-by: hayden <[REDACTED_EMAIL]>

**File**: `Resources/AppIcon.icon/Assets/03_Liquid_Body 2.svg` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
+  <defs>
+    <clipPath id="glassClip">
+      <rect x="362" y="224" width="300" height="560" rx="42" ry="42"/>
+    </clipPath>
+    <linearGradient id="liquidGrad" x1="0" y1="0" x2="0" y2="1">
+      <stop offset="0%" stop-color="#E3A94F"/>
+      <stop offset="100%" stop-color="#9A5E17"/>
+    </linearGradient>
+  </defs>
+  <!-- Glass clipping mask preserves the rounded base corners -->
+  <g clip-path="url(#glassClip)">
+    <!-- Flat-topped liquid body (from y=422 down to glass base at y=784) -->
+    <rect x="362" y="422" width="300" height="362" fill="url(#liquidGrad)"/>
+    <!-- Integrated fizz head band across the flat top surface -->
+    <rect x="362" y="422" width="300" height="18" fill="#F3CE8B" fill-opacity="0.85"/>
+  </g>
+</svg>
\ No newline at end of file
```

**File**: `Resources/AppIcon.icon/Assets/05_Ice_Cube_Left.svg` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
+  <g transform="translate(453, 499) rotate(12)">
+    <rect x="-55" y="-55" width="110" height="110" rx="22" ry="22"
+          fill="#FFF6E6" fill-opacity="0.4675"
+          stroke="#FFFFFF" stroke-opacity="0.65" stroke-width="6"/>
+  </g>
+</svg>
\ No newline at end of file
```

**File**: `Resources/AppIcon.icon/Assets/06_Ice_Cube_Right.svg` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
+  <g transform="translate(575, 549) rotate(-18)">
+    <rect x="-55" y="-55" width="110" height="110" rx="22" ry="22"
+          fill="#FFF6E6" fill-opacity="0.4125"
+          stroke="#FFFFFF" stroke-opacity="0.65" stroke-width="6"/>
+  </g>
+</svg>
\ No newline at end of file
```

**File**: `Resources/AppIcon.icon/Assets/07_Bubble_1.svg` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
+  <circle cx="430" cy="724" r="10" fill="#FFF0D0" fill-opacity="0.7"/>
+</svg>
\ No newline at end of file
```

**File**: `Resources/AppIcon.icon/Assets/08_Bubble_2.svg` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
+  <circle cx="560" cy="684" r="13" fill="#FFF0D0" fill-opacity="0.7"/>
+</svg>
\ No newline at end of file
```

**File**: `Resources/AppIcon.icon/Assets/09_Bubble_3.svg` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
+  <circle cx="480" cy="644" r="8" fill="#FFF0D0" fill-opacity="0.7"/>
+</svg>
\ No newline at end of file
```

**File**: `Resources/AppIcon.icon/Assets/10_Bubble_4.svg` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
+  <circle cx="610" cy="734" r="9" fill="#FFF0D0" fill-opacity="0.7"/>
+</svg>
\ No newline at end of file
```

**File**: `Resources/AppIcon.icon/Assets/11_Glass_Outline.svg` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
+  <rect x="362" y="224" width="300" height="560" rx="42" ry="42"
+        fill="none" stroke="#F5EBDD" stroke-opacity="0.9" stroke-width="16"/>
+</svg>
\ No newline at end of file
```

#### Recent Merged Pull Requests:
- **PR #457** (2026-10-23): Play removes macOS '._' files from a game's folder on exFAT and similar drives (@gauthierpiarrette)
- **PR #456** (2026-10-23): A game's page looks for its program again after an install changes (@gauthierpiarrette)
- **PR #452** (2026-10-22): Play gives a pinned program the mode it chose (@gauthierpiarrette)
- **PR #450** (2026-10-22): Report links fill the form's Game or launcher field (@gauthierpiarrette)
- **PR #449** (2026-10-22): winetricks joins a running server's sync mode (@gauthierpiarrette)
- **PR #422** (2026-10-21): Secrets out of launch logs, Steam window after a D3DMetal Play, engine choice for new environments, setup without Rosetta (@gauthierpiarrette)

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

## X. arm64-wine11.18-r6: the flight check passed. Microsoft Flight Simulator 2024 on 

**RULE**:
When implementing operations in `spike/engines/arm64-wine11.18-r6.json`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in gauthierpiarrette/highball. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0de235ca`: arm64-wine11.18-r6: the flight check passed. Microsoft Flight Simulator 2024 on r6 through the test harness (flight r6chk on the M4, the recipe's settings): boot, Free Flight at Gibraltar, a 2-minute park and a 1-minute take-off roll, no crash, no unhandled exception, no GPU hang, 26.1 fps parked and 21.8 rolling. The harness's Steam restarted on r6 started winebus's SDL, UDEV and IOHID buses and signed in.. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `spike/engines/arm64-wine11.18-r6.json`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
    "result": "This archive on a Mac mini M4 with 32 GB (checksum checked). Controllers: in a fresh prefix with +hid, winebus logged SDL, UDEV and IOHID 'main loop started' within 10 s, where r5's never got past 'SDL main loop starting', and the test harness's Steam, restarted on r6, started the same three and signed in. Steam copy of Microsoft Flight Simulator 2024 through the test harness with the recipe's settings (flight r6chk): boot, Free Flight, a Cessna 172 at Gibraltar, a 2-minute park and a 1-minute take-off roll in daylight, about 8 minutes to the start screen and 16 to the cockpit; no crash, no unhandled exception, no GPU hang; 26.1 fps parked and 21.8 rolling on this one flight (r5: 22.5 and 19 over four). Not tested: a real controller (the M4 has none), other Macs."
```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern to NEVER write (induced failure mode):
    "result": "This archive on a Mac mini M4 (checksum checked): in a fresh prefix with +hid, winebus logged SDL, UDEV and IOHID 'main loop started' within 10 s, where r5's never got past 'SDL main loop starting'. The flight check on this engine is pending. Not tested: a real controller (the M4 has none), other Macs."
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0de235ca` are properly handled with clean fallback behavior.
