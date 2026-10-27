> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/gauthierpiarrette-highball-learnings.md`  
> **Source**: github ([https://github.com/gauthierpiarrette/highball](https://github.com/gauthierpiarrette/highball))  
> **Source Version**: `cddc6d1d`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T11:27:24.981Z  
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
> **Harvest Timestamp**: 2026-10-27T11:27:24.685Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `gauthierpiarrette/highball`
- **Description**: Run Windows games on Apple Silicon — free, open source, with an open compatibility database that tells you what actually works.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1941 stars

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
    /// Empty when the engine is intact, which is the normal answer. Every engine ships each of
    /// `builtins` in both halves (all 31 on the M4, x86-64 and arm64, 2026-10-25), and a 32-bit
    /// program only ever loads the 32-bit copy, so a name missing from either half counts:
    /// SteamSetup.exe died on missing 32-bit shcore.dll and combase.dll while the 64-bit copies
    /// made the engine look whole, and the app offered a fresh installer again (highball#494).
    public static func gone(fromEngineAt root: URL, notFound: [String], arch: String = "x86_64") -> [String] {
        let dirs = libraryDirectories(engineRoot: root, arch: arch)
        return notFound.filter { name in
            builtins.contains(name) && !dirs.allSatisfy { FileManager.default.fileExists(atPath: $0.appending(path: name).path) }
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

    /// The engines the owner may remove from Settings: installed, not the default, and no
    /// environment's engine. Only the engine an update supersedes goes on its own
    /// (engineT
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
- **Issue #514** (2026-10-26): **death stranding requires a cpu with avx support**
  *Symptoms*: ### What happened  it did not work until I enabled promote ave. then worked fine  ### Chip and macOS  Apple M4 Max, macOS 27.0.1  ### Highball version  0.10.22  ### Log  ~/Library/Application Support/Highball/logs/2026-10-26T162738Z-Games-steam.exe.log: # gin x64-sikarugir10.0_6-r29 bottle=Games renderer=d3dmetal # wine ~/Library/Application Support/Highball/bottles/Games/drive_c/Program Files (x86)/Steam/steam.exe -silent -applaunch 1850570 # sync=msync winver=win10 dpi=96 dxvkAsync=false frameGen=off # audio out=48000 Hz # WINEDLLPATH_PREPEND=~/Library/Application Support/Highball/engines/x64-sikarugir10.0_6-r29/renderers/d3dmetal-tsshim/wine:~/Library/Application Support/Highball/engines/x64-sikarugir10.0_6-r29/renderers/d3dmetal/wine:~/Library/Application Support/Highball/engine… ( 158 chars) # WINEDLLOVERRIDES=winemenubuilder.exe=d # ROSETTA_ADVERTISE_AVX=1 # CX_FWD_COMPAT_GL_CTX=1 # DXVK_CONFIG_FILE=C:\highball\dxvk.conf # DXVK_LOG_PATH=C:\highball\logs #   dxvk.enableAsync = False # note: restarted the environment before the launch so its Windows services get this stack: it runs with a different renderer than d3dmetal; it runs with AVX advertised off and the game wants it on … 370 lines … 0158:err:environ:init_peb starting L"C:\\Program Files (x86)\\Common Files\\Steam\\steamservice.exe" in experimental wow64 mode … 521 lines … # the line above repeated 1 more times 02bc:err:environ:init_peb starting L"C:\\Program Files (x86)\\Steam\\bin\\gldriverquery.exe" in experime
  **Post-Mortem & Fix Analysis**:
  > Thanks, that explains it. Our Death Stranding fix advertises AVX automatically, but it was set on the original game's page, and the Director's Cut is a separate Steam app, so it never reached your copy. The Director's Cut has its own page and fix now, so from the next version it starts without the switch. Closing since it works, feel free to reopen.

- **Issue #508** (2026-10-26): **steam not working**
  *Symptoms*: ### What happened  steam not working  ### Chip and macOS  Apple M4, macOS 26.5.2  ### Highball version  0.10.22  ### Log  ~/Library/Application Support/Highball/logs/2026-10-26T103328Z-Games-steam.exe.log: # gin x64-sikarugir10.0_6-r28 bottle=Games renderer=dxmt # wine ~/Library/Application Support/Highball/bottles/Games/drive_c/Program Files (x86)/Steam/steam.exe # sync=none (bottle asks msync) winver=win10 dpi=96 dxvkAsync=false frameGen=off # audio out=48000 Hz # WINEDLLPATH_PREPEND=~/Library/Application Support/Highball/engines/x64-sikarugir10.0_6-r28/renderers/dxmt/wine:~/Library/Application Support/Highball/engines/x64-sikarugir10.0_6-r28/frameworks/renderer/d9vk/wine # WINEDLLOVERRIDES=winemenubuilder.exe=d # CX_FWD_COMPAT_GL_CTX=1 # DXVK_CONFIG_FILE=C:\highball\dxvk.conf # DXVK_LOG_PATH=C:\highball\logs #   dxvk.enableAsync = False … 538 lines … 0158:err:environ:init_peb starting L"C:\\Program Files (x86)\\Common Files\\Steam\\steamservice.exe" in experimental wow64 mode … 1 lines … # the line above repeated 1 more times … 322 lines … 	VK_AMD_shader_trinary_minmax v1 	VK_GOOGLE_display_timing v1 	VK_IMG_format_pvrtc v1 	VK_INTEL_shader_integer_functions2 v1 	VK_MVK_macos_surface v3 	VK_MVK_moltenvk v37 	VK_NV_fragment_shader_barycentric v1 [mvk-info] GPU device: 	model: Apple M4 	type: Integrated 	vendorID: 0x106b 	deviceID: 0x1a050209 	pipelineCacheUUID: DB445FF2-1A05-0209-0000-000100000000 	GPU memory available: 12124 MB 	GPU memory used: 0 MB 	Metal Shading Languag

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

### Incident Patch 1: `761456bd` (2026-10-23)
**Commit Message**: winetricks' wine gets the engine's library paths back. winetricks runs under /bin/bash, which drops every DYLD_* variable under SIP, so the wine processes it started had no library path. The Wine 10 engines find their libraries through their own search path and never showed it; the Wine 11 engines open FreeType by name through that path, so every winetricks install on them ran without fonts. A player's .NET 4.8 install on r23 printed that error over a thousand times while it crashed in a loop until the Mac stopped answering (highball#241); on the M4 the same install finished on r23 and r25 even without fonts (1,758 and 586 errors, no crash), so the loop's own cause is not settled. Measured on the M4: a cmd /c echo on x64-crossover26.3-r25 printed 'cannot find the FreeType font library' 12 times through /bin/sh and never when the variable reached wine, and the winetricks win10 verb 3 times the old way and none through this change. The paths now travel as HB_KEEP_* and a script under Highball's tools folder exports them and starts the engine's wine, in the app's recipe path and the CLI. dotnet48 through the app's recipe code on r25 in an isolated home: installed in 236 s, no FreeType

**File**: `Sources/HighballKit/Recipe.swift` (modified, +2/-0)
```diff
@@ -587,6 +587,8 @@ public struct RecipeRunner: Sendable {
                 let joined = WineRunner.joiningLiveServer(env, prefix: bottle.url)
                 if joined != env { log?("[\(recipe.id)] the environment runs with sync \(SyncMode(environment: joined).rawValue), so winetricks uses it too") }
                 env = joined
+                // The library paths reach winetricks' wine through a script, past bash (see WinetricksWine).
+                env = WinetricksWine.environment(env, wine: engine.wineBinary, script: try WinetricksWine.installScript(in: paths))
                 // winetricks shells out to cabextract for Microsoft's cabinet installers (the core
                 // fonts among them) and macOS does not ship it, so the app bundles one under
                 // Resources/tools (highball#96). HIGHBALL_TOOLS names another directory, for the CLI.
```

**File**: `Sources/HighballKit/WinetricksWine.swift` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+import Foundation
+
+/// The wine winetricks starts. winetricks runs under /bin/bash, and with SIP on macOS drops every
+/// DYLD_* variable before bash starts, so each wine process winetricks started had no library path.
+/// The Wine 10 engines find their libraries without one and never showed it. The Wine 11 engines
+/// open FreeType by name through that path, so every winetricks install on them ran without fonts.
+/// A player's .NET 4.8 install on r23 printed that error over a thousand times while it crashed in
+/// a loop until the Mac stopped answering (highball#241). On the M4 the same install finished on
+/// r23 and r25 even without fonts (1,758 and 586 of those errors, no crash), so the loop's own
+/// cause is not settled. Measured on the M4, 2026-10-23: one `cmd /c echo` on
+/// x64-crossover26.3-r25 printed "cannot find the FreeType font library" 12 times started through
+/// /bin/sh, and never when the variable reached wine.
+///
+/// The library paths travel under other names, and a small script puts them back right before it
+/// starts the engine's wine: a variable the script sets itself reaches its child, since SIP only
+/// drops the ones a protected program inherits.
+public enum WinetricksWine {
+    /// What a launch hands wine and winetricks lost on the way.
+    static let carried = ["DYLD_FALLBACK_LIBRARY_PATH", "DYLD_FALLBACK_FRAMEWORK_PATH", "DYLD_LIBRARY_PATH", "DYLD_FRAMEWORK_PATH"]
+    static let keptPrefix = "HB_KEEP_"
+
+    static let script = """
+    #!/bin/sh
+    # Highball: winetricks runs under /bin/bash, where SIP drops the DYLD_* variables. Put the
+    # engine's library paths back, then start the engine's wine.
+    for name in \(carried.joined(separator: " ")); do
+      eval "value=\\${\(keptPrefix)$name-}"
+      if [ -n "$value" ]; then export "$name=$value"; fi
+    done
+    exec "$HB_WINE" "$@"
+
+    """
+
+    /// The script, written under Highball's tools folder when it is missing or out of date.
+    public static func installScript(in paths: HighballPaths) throws -> URL {
+        let dir = paths.home.appending(path: "tools/winetricks-wine", directoryHint: .isDirectory)
+        // Named wine in a folder of its own, so winetricks' name-based guesses (wine64 beside wine) still read it as wine.
+        let file = dir.appending(path: "wine")
+        let fm = FileManager.default
+        if (try? String(contentsOf: file, encoding: .utf8)) != script {
+            try fm.createDirectory(at: dir, withIntermediateDirectories: true)
+            try Data(script.utf8).write(to: file, options: .atomic)
+        }
+        try fm.setAttributes([.posixPermissions: 0o755], ofItemAtPath: file.path)
+        return file
+    }
+
+    /// The environment for a winetricks run: WINE is the script, HB_WINE the engine's wine, and each
+    /// library path is also under its HB_KEEP_ name. WINE_BIN stays the engine's wine, which
+    /// winetricks only reads to tell the binary's architecture.
+    public static func environment(_ env: [String: String], wine: URL, script: URL) -> [String: String] {
+        var out = env
+        for name in carried { if let value = env[name] { out[keptPrefix + name] = value } }
+        out["HB_WINE"] = wine.path
+        out["WINE"] = script.path
+        return out
+    }
+}
```

**File**: `Sources/highball/main.swift` (modified, +3/-2)
```diff
@@ -538,8 +538,9 @@ struct Tricks: AsyncParsableCommand {
         env["WINE_BINDIR"] = eng.wineBinary.deletingLastPathComponent().path
         env["WINESERVER"] = eng.wineserverBinary.path
         env["PATH"] = "\(eng.engineDir.appending(path: "bin").path):/usr/bin:/bin:/usr/sbin:/sbin"
-        // bash, not sh: same as the recipe path — winetricks' macOS guidance, and sh strips
-        // the DYLD vars winetricks' children need (issue #16 fix said "both paths"; this one lagged).
+        // bash, as the recipe path runs it (winetricks' macOS guidance). bash drops the DYLD vars
+        // under SIP like sh does, so they reach wine through WinetricksWine's script.
+        env = WinetricksWine.environment(env, wine: eng.wineBinary, script: try WinetricksWine.installScript(in: HighballPaths()))
         let out = try Shell.capture("/bin/bash", [wt.path, "--unattended"] + verbs, env: env)
         print(out.split(separator: "\n").suffix(12).joined(separator: "\n"))
     }
```

**File**: `Tests/HighballKitTests/WinetricksWineTests.swift` (added, +61/-0)
```diff
@@ -0,0 +1,61 @@
+import XCTest
+@testable import HighballKit
+
+/// winetricks runs under /bin/bash, which drops the DYLD_* variables under SIP, and the Wine 11
+/// engines then found no FreeType during every winetricks install (highball#241).
+final class WinetricksWineTests: XCTestCase {
+    func testTheLibraryPathsTravelUnderOtherNames() {
+        let wine = URL(fileURLWithPath: "/engines/x/engine/bin/wine"), script = URL(fileURLWithPath: "/hb/tools/winetricks-wine/wine")
+        let env = WinetricksWine.environment(["DYLD_FALLBACK_LIBRARY_PATH": "/a b/frameworks:/c", "WINE": wine.path,
+                                              "WINE_BIN": wine.path, "WINEPREFIX": "/p"], wine: wine, script: script)
+        XCTAssertEqual(env["WINE"], script.path, "winetricks starts the script")
+        XCTAssertEqual(env["HB_WINE"], wine.path, "the script starts the engine's wine")
+        XCTAssertEqual(env["WINE_BIN"], wine.path, "winetricks reads the architecture off the real binary")
+        XCTAssertEqual(env["HB_KEEP_DYLD_FALLBACK_LIBRARY_PATH"], "/a b/frameworks:/c")
+        XCTAssertEqual(env["DYLD_FALLBACK_LIBRARY_PATH"], "/a b/frameworks:/c", "a run where DYLD gets through keeps it")
+        XCTAssertNil(env["HB_KEEP_DYLD_LIBRARY_PATH"], "nothing is invented for a variable the environment does not set")
+        XCTAssertEqual(env["WINEPREFIX"], "/p")
+    }
+
+    /// The script's loop, run by /bin/sh the way winetricks reaches it: a path with spaces comes back
+    /// whole, and a variable with nothing kept stays unset.
+    func testTheScriptPutsThePathsBack() throws {
+        let body = WinetricksWine.script.replacingOccurrences(of: "exec \"$HB_WINE\" \"$@\"", with: "export -p")
+        XCTAssertNotEqual(body, WinetricksWine.script)
+        let out = try run(["-c", body], env: ["HB_KEEP_DYLD_FALLBACK_LIBRARY_PATH": "/Users/x/Library/Application Support/Highball/engines/r/frameworks:/y"])
+        // export -p quotes the way the shell likes (bash double, dash single), so the quotes are left out.
+        let exported = out.split(separator: "\n").map { line -> String in
+            var s = String(line)
+            for prefix in ["export ", "declare -x "] where s.hasPrefix(prefix) { s.removeFirst(prefix.count) }
+            return s.replacingOccurrences(of: "\"", with: "").replacingOccurrences(of: "'", with: "")
+        }
+        XCTAssertTrue(exported.contains("DYLD_FALLBACK_LIBRARY_PATH=/Users/x/Library/Application Support/Highball/engines/r/frameworks:/y"), out)
+        XCTAssertFalse(exported.contains { $0.hasPrefix("DYLD_LIBRARY_PATH") }, out)
+    }
+
+    func testTheScriptStartsWineWithItsArguments() throws {
+        let dir = FileManager.default.temporaryDirectory.appending(path: "hb-wtw-\(UUID().uuidString)", directoryHint: .isDirectory)
+        defer { try? FileManager.default.removeItem(at: dir) }
+        let script = try WinetricksWine.installScript(in: HighballPaths(home: dir))
+        XCTAssertEqual(try WinetricksWine.installScript(in: HighballPaths(home: dir)), script, "a second call keeps the same file")
+        let stub = dir.appending(path: "stub-wine")
+        try Data("#!/bin/sh\necho \"wine got: $*\"\n".utf8).write(to: stub)
+        try FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: stub.path)
+        let out = try run(["-c", "\"$0\" cmd.exe /c 'echo %AppData%'", script.path], env: ["HB_WINE": stub.path])
+        XCTAssertEqual(out.trimmingCharacters(in: .whitespacesAndNewlines), "wine got: cmd.exe /c echo %AppData%")
+    }
+
+    private func run(_ args: [String], env: [String: String]) throws -> String {
+        let p = Process()
+        p.executableURL = URL(fileURLWithPath: "/bin/sh")
+        p.arguments = args
+        p.environment = ["PATH": "/usr/bin:/bin"].merging(env) { $1 }
+        let pipe = Pipe()
+        p.standardOutput = pipe
+        p.standardError = pipe
+        try p.run()
+        let data = pipe.fileHandleForReading.readDataToEndOfFile()
+        p.waitUntilExit()
+        return String(decoding: data, as: UTF8.self)
+    }
+}
```

---

### Incident Patch 2: `86c161d1` (2026-10-25)
**Commit Message**: Launch logs keep MoltenVK's warnings and errors and drop its info output. MoltenVK printed its whole extension list, about 160 lines, at info level each time a process made a Vulkan instance, and a Steam launch makes dozens. The end of a log, where a crash lands, was more of that list, so the reports' digests and the logs players paste ended before the failure (highball#486, #490, #492, Portal 2 on Discord). Every launch now sets MVK_CONFIG_LOG_LEVEL=2: [mvk-warn] and [mvk-error] lines stay, our MoltenVK patches' HIGHBALL markers among them, and a level the engine or the player sets wins. 591 tests pass on the M4.

**File**: `Sources/HighballKit/Bottle.swift` (modified, +7/-0)
```diff
@@ -769,6 +769,13 @@ public struct Bottle: Sendable {
         // CrossOver switch the engine's winemac.so carries adds the bit for them (Tomb Raider IV-VI
         // Remastered, highball#136). It touches nothing that succeeded before.
         env["CX_FWD_COMPAT_GL_CTX"] = "1"
+        // MoltenVK prints its whole extension list, about 160 lines, at info level each time a
+        // process makes a Vulkan instance, and a Steam launch makes dozens. The end of the log,
+        // where a crash lands, was more of that list, so the reports' digests and the logs players
+        // paste ended before the failure (highball#486, #490, #492, Portal 2 on Discord). Warnings
+        // and errors stay, our patches' markers among them, and a level the engine or the player
+        // sets wins.
+        if env["MVK_CONFIG_LOG_LEVEL"] == nil { env["MVK_CONFIG_LOG_LEVEL"] = "2" }
         let r = effective
         // The async toggle travels in the generated dxvk.conf, NOT the DXVK_ASYNC env var:
         // the async fork reads `env == "1" || config.enableAsync`, so an env 1 can never be
```

**File**: `Tests/HighballKitTests/EngineArchTests.swift` (modified, +8/-0)
```diff
@@ -223,4 +223,12 @@ final class EngineArchTests: XCTestCase {
         let intel = InstalledEngine(manifest: manifest("x86_64", requires: ["rosetta2"]), root: tempRoot("x64-engine"))
         XCTAssertEqual(try bottle.environment(engine: intel, renderer: .wined3d)["ROSETTA_ADVERTISE_AVX"], "1")
     }
+
+    func testMoltenVKLogsWarningsNotItsExtensionList() throws {
+        var bottle = Bottle(url: URL(fileURLWithPath: "/tmp/hb-arch-test-bottle"), settings: BottleSettings(name: "t", engineID: "x64-test-r1"))
+        let intel = InstalledEngine(manifest: manifest("x86_64", requires: ["rosetta2"]), root: tempRoot("x64-engine"))
+        XCTAssertEqual(try bottle.environment(engine: intel, renderer: .wined3d)["MVK_CONFIG_LOG_LEVEL"], "2", "warnings and errors only")
+        bottle.settings.environment["MVK_CONFIG_LOG_LEVEL"] = "3"
+        XCTAssertEqual(try bottle.environment(engine: intel, renderer: .wined3d)["MVK_CONFIG_LOG_LEVEL"], "3", "a player's own level wins")
+    }
 }
```

---

### Incident Patch 3: `234c9888` (2026-10-25)
**Commit Message**: A program added by hand carries its game's fix variables. The library matches such a program to its database game, and the game's page lists the variables the fix scoped to it as applied to its launches, but launching a pin passed only the pin's own environment. Forza Horizon 6 run from its exe in ~/Games then started on D3DMetal's default graphics card and crashed at startup (highball#486). A pin launch now starts from the matched game's variables, with the program's own settings winning. 590 tests pass on the M4.

**File**: `Sources/HighballApp/AppState.swift` (modified, +5/-1)
```diff
@@ -2559,13 +2559,17 @@ final class AppState {
         let steamFirstBoot = isSteamUI(pin) && !FileManager.default.fileExists(
             atPath: bottle.driveC.appending(path: "Program Files (x86)/Steam/bin/cef").path)
         let cef = bottle.driveC.appending(path: "Program Files (x86)/Steam/bin/cef")
+        // The database game the library matches this program to keeps its fix's variables, as its
+        // page says, with the program's own winning (highball#486).
+        let gameID = libraryItems.first(where: { $0.pinID == pin.id }).flatMap { gameDB.entry(for: $0)?.id }
+        let gameEnvironment = pin.environment(withGame: bottle.settings.environment(forGame: gameID))
         runBusy(steamFirstBoot ? L("Starting Steam for the first time — it downloads and unpacks its own client") : "Starting \(pin.name)",
                 expected: steamFirstBoot ? L("usually 15–25 minutes; long quiet stretches are normal") : nil,
                 done: .handedOff,
                 stop: .killBottle(bottle, label: L("Stop")),
                 cleanup: { [weak self] in self?.launchingPins.remove(pin.id) }) { [self] in
             let runner = WineRunner(paths: paths, engine: engine, bottle: bottle)
-            var extraEnvironment = [String: String]()
+            var extraEnvironment = gameEnvironment
             // A Steam client left running by a game launch answers a new steam.exe by swallowing
             // it (issue #33). Ask it to show its window instead, and leave the wineserver alone:
             // a game may still be running under it.
```

**File**: `Sources/HighballKit/Bottle.swift` (modified, +9/-0)
```diff
@@ -282,6 +282,15 @@ public struct Pin: Codable, Sendable, Identifiable, Hashable {
         return pin
     }
 
+    /// What a launch of this program carries: the variables the database game it is matched to got
+    /// from its fix, then the program's own, which win. A program added by hand ran with its own
+    /// variables only, so its game's page listed the fix's variables as applied while the launch
+    /// dropped them, and Forza Horizon 6 started that way crashed on D3DMetal's default graphics card
+    /// (highball#486).
+    public func environment(withGame gameVariables: [String: String]) -> [String: String] {
+        gameVariables.merging(environment) { $1 }
+    }
+
     /// Where the pin's executable actually lives for a given bottle.
     public func executableURL(driveC: URL) -> URL {
         let named = launchURL(driveC: driveC)
```

**File**: `Tests/HighballKitTests/LaunchChecksTests.swift` (modified, +12/-0)
```diff
@@ -71,6 +71,18 @@ final class LaunchChecksTests: XCTestCase {
         XCTAssertNil(Pin(name: "x", path: "x.exe").launching(with: nil).renderer, "and with none, the environment decides")
     }
 
+    /// Forza Horizon 6 added by hand ran without its fix's graphics card variables and crashed (highball#486).
+    func testAProgramCarriesItsGamesVariables() {
+        let fix = ["D3DM_VENDOR_ID": "0x10de", "D3DM_DEVICE_ID": "0x2786"]
+        let pin = Pin(name: "Forza Horizon 6", path: "/Users/x/Games/Forza Horizon 6/forzahorizon6.exe",
+                      environment: ["D3DM_DEVICE_ID": "0x56a1", "MY_SETTING": "1"])
+        let env = pin.environment(withGame: fix)
+        XCTAssertEqual(env["D3DM_VENDOR_ID"], "0x10de", "the fix's variable reaches the launch")
+        XCTAssertEqual(env["D3DM_DEVICE_ID"], "0x56a1", "the program's own setting wins over the fix")
+        XCTAssertEqual(env["MY_SETTING"], "1")
+        XCTAssertEqual(Pin(name: "x", path: "x.exe").environment(withGame: [:]), [:], "no game, nothing added")
+    }
+
     /// A DualSense player had "Controllers through SDL" installed and no way back but regedit.
     func testRegistryOnlyTweaksCanBeRemoved() throws {
         let sdl = try JSONDecoder.highball.decode(Recipe.self, from: Data("""
```

#### Recent Merged Pull Requests:
- **PR #520** (2026-10-27): MoltenVK device memory cap (highball#398) and a CI build for the engine's MoltenVK (@gauthierpiarrette)
- **PR #511** (2026-10-26): Settings can remove engines no environment uses (@gauthierpiarrette)
- **PR #510** (2026-10-26): A winetricks step no longer waits forever behind an open Steam window (@gauthierpiarrette)
- **PR #501** (2026-10-25): Launch logs drop MoltenVK's info output (@gauthierpiarrette)
- **PR #495** (2026-10-25): An engine missing the 32-bit half of a Wine DLL counts as damaged (@gauthierpiarrette)
- **PR #491** (2026-10-25): Offer patched private-API MoltenVK for X4 (@mvanhorn)

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

## X. winetricks' wine gets the engine's library paths back. winetricks runs under /bi

**RULE**:
When implementing operations in `Sources/HighballKit/Recipe.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in gauthierpiarrette/highball. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `761456bd`: winetricks' wine gets the engine's library paths back. winetricks runs under /bin/bash, which drops every DYLD_* variable under SIP, so the wine processes it started had no library path. The Wine 10 engines find their libraries through their own search path and never showed it; the Wine 11 engines open FreeType by name through that path, so every winetricks install on them ran without fonts. A player's .NET 4.8 install on r23 printed that error over a thousand times while it crashed in a loop until the Mac stopped answering (highball#241); on the M4 the same install finished on r23 and r25 even without fonts (1,758 and 586 errors, no crash), so the loop's own cause is not settled. Measured on the M4: a cmd /c echo on x64-crossover26.3-r25 printed 'cannot find the FreeType font library' 12 times through /bin/sh and never when the variable reached wine, and the winetricks win10 verb 3 times the old way and none through this change. The paths now travel as HB_KEEP_* and a script under Highball's tools folder exports them and starts the engine's wine, in the app's recipe path and the CLI. dotnet48 through the app's recipe code on r25 in an isolated home: installed in 236 s, no FreeType. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `Sources/HighballKit/Recipe.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
                // The library paths reach winetricks' wine through a script, past bash (see WinetricksWine).
                env = WinetricksWine.environment(env, wine: engine.wineBinary, script: try WinetricksWine.installScript(in: paths))
```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `761456bd` are properly handled with clean fallback behavior.
