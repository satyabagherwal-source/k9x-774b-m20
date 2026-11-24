> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/gauthierpiarrette-highball-learnings.md`  
> **Source**: github ([https://github.com/gauthierpiarrette/highball](https://github.com/gauthierpiarrette/highball))  
> **Source Version**: `062ea35b`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-24T01:56:00.485Z  
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
> **Harvest Timestamp**: 2026-11-24T01:56:00.479Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `gauthierpiarrette/highball`
- **Description**: Run Windows games on Apple Silicon — free, open source, with an open compatibility database that tells you what actually works.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2332 stars

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

/// A cloud-save conflict: this Mac's saves and the cloud's both changed since the last sync, so
/// nothing moved and the player picks which copy wins (GOGSaves, EpicSaves).
struct GOGSaveConflict: Identifiable {
    enum Choice { case useCloud, keepMac, skip }
    let id = UUID()
    let title: String
    /// Asked before Play (the launch waits) or after the game ended.
    let beforePlay: Bool
    /// An Epic game's (EpicSaves), and whether it is the first sync of saves on both sides.
    var epic = false
    var firstSync = false
    let resolve: (Choice) -> Void
}

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
    /// The library can look empty while its first store scans are still running. Keep the
    /// connect/install empty state out of view until those scans have had a chance to populate it.
    private(set) var steamOwnedLibraryLoaded = false
    private(set) var epicLibraryLoaded = false
    private(set) var gogLibraryLoaded = false
    private(set) var gogMacLibraryLoaded = false
    var libraryLoading: Bool {
        !steamOwnedLibraryLoaded || !epicLibraryLoaded || !gogLibraryLoaded || !gogMacLibraryLoaded || epicLoading || gogLoading
    }
    /// What Battle.net installed in each bottle, from its own records (BattleNetLibrary, highball#417).
    var battleNetByBottle: [String: [BattleNetGame]] = [:]
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
    fu
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
            : carriesGame
            ? String(format: L("'%@' is already on the %@ engine. Using it brings the game installed here along, without a new download or extra disk space, adds what it needs, and this environment stays as it is."), existing.name, shortEngineName(manifest))
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
        let route = recipe.previewRouteNote.flatMap { $0.isEmpty ? nil : " " + $0 } ?? ""
        return String(format: text, recipe.title, shortEngineName(manifest)) + route + memoryNote(recipe: recipe, memoryMB: memoryMB)
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

    /// The same rule for one engine, counting the player's opt-ins: a preview engine they took for a game, and the
    /// later revisions of its line. A player who took r4 for Forza Horizon 6 never saw r5, which carried the sound fix
    /// the game needed: the environment's Engine picker listed r4 alone and so stayed hidden (highball#672).
    public static func visible(_ manifest: EngineManifest, beta: Bool, preview: Bool, optedIn: Set<String>) -> Bool {
        visible(channel: manifest.channel, beta: beta, preview: preview)
            || (manifest.channel == Self.preview && optedIn.contains { EngineManifest.isAtOrAfter(current: manifest.id, wanted: $0) })
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

### Core Architecture Module: `Scripts/audit-localization.py`
```
#!/usr/bin/env python3
"""Static localization inventory. Candidates require review; they are not coverage claims."""
import argparse
import collections
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
PAIR = re.compile(r'^\s*"((?:[^"\\]|\\.)*)"\s*:\s*"((?:[^"\\]|\\.)*)"', re.M)
CALL = re.compile(r'\b(?:L|L10n\.translate|L10n\.format|format)\(\s*"((?:[^"\\]|\\.)*)"')
TOKEN = re.compile(r'%(?:\d+\$)?(?:[-+0#]*\d*(?:\.\d+)?)(?:ll|l|z)?[@diufgs]|%%')

def signature(text):
    """Argument index/type pairs allow positional reordering but reject changed types."""
    result = []; sequential = 0
    for token in TOKEN.findall(text):
        if token == '%%':
            result.append((0, '%%')); continue
        match = re.match(r'%(\d+)\$', token)
        if match:
            index = int(match.group(1)); spec = '%' + token[match.end():]
        else:
            sequential += 1; index = sequential; spec = token
        result.append((index, spec))
    return sorted(result)

def audit():
    dictionaries = {}
    duplicates = {}; mismatches = {}; newlines = {}
    for lang, name in [('zh-Hans', 'Chinese'), ('fr', 'French')]:
        pairs = PAIR.findall((ROOT / f'Sources/HighballKit/L10n{name}.swift').read_text())
        counts = collections.Counter(k for k, _ in pairs)
        duplicates[lang] = [k for k, n in counts.items() if n > 1]
        dictionaries[lang] = dict(pairs)
        mismatches[lang] = [k for k, v in pairs if signature(k) != signature(v)]
        newlines[lang] = [k for k, v in pairs if k.count('\\n') != v.count('\\n')]
    used = set(); candidates = []; dynamic = []
    # Include the complete app and kit: runtime diagnostics and external data are intentionally
    # reported as candidates, never blindly rewritten as display text.
    for path in sorted((ROOT / 'Sources').rglob('*.swift')):
        if path.name in {'L10n.swift', 'L10nChinese.swift', 'L10nFrench.swift'}: continue
        text = path.read_text()
        used.update(CALL.findall(text))
        for number, line in enumerate(text.splitlines(), 1):
            stripped = line.lstrip()
            if stripped.startswith('//'): continue
            if '"' not in line: continue
            loc = {'file': str(path.relative_to(ROOT)), 'line': number, 'source': stripped}
            if '\\(' in line and re.search(r'\b(Text|headline|meaning|detail|runBusy|stage|return)\b', line):
                dynamic.append(loc)
            if re.search(r'\b(?:Text|Button|Label|Toggle|Picker|Section|TextField)\(\s*"|\.(?:help|navigationTitle|accessibilityLabel)\(\s*"|\b(?:return|headline:|meaning:|detail:|stage\s*=|busyTitle\s*=)\s*"', line):
                candidates.append(loc)
    return {
        'entries': {k: len(v) for k,v in dictionaries.items()},
        'localized_keys': len(used),
        'missing': {lang: sorted(used-set(d)) for lang,d in dictionaries.items()},
        'duplicates': duplicates, 'placeholder_mismatches': mismatches, 'newline_mismatches': newlines,
        'unreferenced_or_dynamic_keys': {lang: sorted(set(d)-used) for lang,d in dictionaries.items()},
        'potentially_untranslated_source_lines': candidates,
        'dynamic_source_lines_to_review': dynamic,
        'limitations': 'Static candidates include technical identifiers, CLI diagnostics, numbers, external database text and nested localization calls. Unreferenced keys may be runtime values; do not delete automatically.'
    }

if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--output', type=Path)
    args = parser.parse_args(); report = audit()
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k in ['entries','localized_keys','duplicates','placeholder_mismatches','newline_mismatches']}, ensure_ascii=False, indent=2))
    for lang, missing in report['missing'].items(): print(f'{lang}: {len(missing)} missing keys (English fallback)')
    # Preserve upstream's warning-only policy for incomplete translations.
    raise SystemExit(1 if any(report['duplicates'].values()) or report['placeholder_mismatches']['zh-Hans'] or report['newline_mismatches']['zh-Hans'] else 0)

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #770** (2026-11-21): **Plant zoo 2 don't start**
  *Symptoms*: ### What happened  Plant zoo 2 do not start on the Mac mini m4 24 GB  ### Chip and macOS  Apple M4, macOS 27.2.1  ### Highball version  0.10.26  ### Log  ~/Library/Application Support/Highball/logs/2026-11-21T142132Z-Games-steam.exe.log: # gin x64-sikarugir10.0_6-r28 bottle=Games renderer=d3dmetal # wine ~/Library/Application Support/Highball/bottles/Games/drive_c/Program Files (x86)/Steam/steam.exe -silent -applaunch 3219030 # sync=msync winver=win10 dpi=96 dxvkAsync=false frameGen=off # audio out=48000 Hz # WINEDLLPATH_PREPEND=~/Library/Application Support/Highball/engines/x64-sikarugir10.0_6-r28/renderers/d3dmetal-tsshim/wine:~/Library/Application Support/Highball/engines/x64-sikarugir10.0_6-r28/frameworks/renderer/d3dmetal/wine:~/Library/Application S… ( 184 chars) # WINEDLLOVERRIDES=winemenubuilder.exe=d # CX_FWD_COMPAT_GL_CTX=1 # DXVK_CONFIG_FILE=C:\highball\dxvk.conf # DXVK_LOG_PATH=C:\highball\logs # DXMT_LOG_PATH=C:\highball\logs # HB_D3D12_REAL=Z:\Users\steindouma\Library\Application Support\Highball\engines\x64-sikarugir10.0_6-r28\renderers\d3dmetal-tsshim\wine\x86_64-windows\apd12.dll # MVK_CONFIG_LOG_LEVEL=2 #   dxvk.enableAsync = False … 17 lines … 0160:err:environ:init_peb starting L"C:\\Program Files (x86)\\Common Files\\Steam\\steamservice.exe" in experimental wow64 mode 016c:err:sync:RtlpWaitForCriticalSection section 00006FFFFFFB2440 "/Users/gcenx/Documents/GitHub/wine-private/dlls/ntdll/loader.c: loader_section" wait timed out in thread 016c, blocked by 01
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report. The log ends the way Planet Zoo 2 always does here, with error c0000409. The game's anti tamper needs hardware debug registers, which Rosetta doesn't have, so it loops without a window and exits. Nothing in the settings works around it on the current engines. [The database issue](https://github.com/gauthierpiarrette/highball-db/issues/537) has the full analysis and is where updates go, so I'm closing this one in favour of it.

- **Issue #753** (2026-11-24): **Move to... bottle picklist disappeared on pinned programs**
  *Symptoms*: ### What happened  You can move a Steam/Epic/GOG game to another bottle but there is no way to move pins to another bottle right now.  I recall in an earlier build, there was a picklist to move a pin to another bottle - it seems to have disappeared:  <img width="932" height="803" alt="Screenshot 2026-11-18 at 8 52 27 PM" src="https://github.com/user-attachments/assets/9b5f0b04-14ff-4037-9aab-a9fb277113ac" />  NOTE: I do feel using a picklist across Steam/Epic/GOG/pinned games is cleaner UX-wise in case it simplifies implementation and eliminates multiple rows of "Also installed in"  ### Workaround  edit `bottle.json` in both bottles and manually cut & paste the pins you want to move (if there is a better way to do this, please let me know!)  ### Chip and macOS  macOS 27.2.1  ### Highball version  0.10.28  ### Log  _No response_
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report. As far as I can tell programs never had that menu, the one on the game page was only for Epic games, which move their folder along. #759 adds Move to… for programs too, next to Environment on the game page. It shows for programs that live outside the environment, like a game on another drive, since one installed inside an environment has its files there. The program keeps its name, cover, mode, arguments and display, and a Mac app made for it keeps working.
  > This shipped in Highball 0.10.29 (https://github.com/gauthierpiarrette/highball/releases/tag/v0.10.29). Programs that live outside their environment have Move to on their page now. Thanks for the idea! If something about it doesn't work, comment here and I'll reopen it.

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

### Incident Patch 1: `7d471e91` (2026-11-23)
**Commit Message**: highball play --wait follows Mac builds, Steam for Mac's included, and the library JSON says installedOnWindows and hidden (highball#432). RunningGames, which --wait reads, held only the sessions in environments, so a wait on a game Steam for Mac started ran to --start-timeout and gave up while the game played (Terraforming Mars, udance4ever timed 49 s). It now also holds the Epic and GOG Mac builds Highball started and the Steam for Mac games Play opened, followed by their process under steamapps/common for up to ten minutes to appear and then until they quit. The JSON's installed is now installedOnWindows, beside installedOnMac, since the command hasn't shipped yet, and hidden says what the player hid from the library. play's id help names the form. New test in PlayFromCommandLineTests, 16 tests pass, and highball library --json lists the real library with both fields. The Steam for Mac wait is not tried live yet.

**File**: `Sources/HighballApp/AppState.swift` (modified, +45/-6)
```diff
@@ -511,7 +511,31 @@ final class AppState {
         if item.source == .epic { epicPlayMac(item); return }
         guard let appid = item.steamAppID else { return }
         recordPlay(item)
-        _ = openInSteamForMac(URL(string: "steam://run/\(appid)")!)
+        if openInSteamForMac(URL(string: "steam://run/\(appid)")!),
+           let game = macSteamGames.first(where: { $0.appid == appid }), !game.installdir.isEmpty {
+            watchMacSteamGame(item.id, markers: SessionWatch.markers(installdir: game.installdir))
+        }
+    }
+
+    /// Follows a game Steam for Mac started for Highball by its process, whose path runs through
+    /// its steamapps/common folder: up to ten minutes for it to appear (Steam may update it first),
+    /// then until it quits. Only `highball play --wait` reads it (writeRunningGames).
+    private func watchMacSteamGame(_ id: String, markers: [String]) {
+        Task { [weak self] in
+            var seen = false
+            for _ in 0..<300 {
+                try? await Task.sleep(for: .seconds(2))
+                let alive = SessionWatch.isAlive(markers: markers, ps: await Self.processList())
+                guard let self else { return }
+                if alive, !seen { seen = true; self.macSteamRunning.insert(id) }
+                if seen, !alive { self.macSteamRunning.remove(id); return }
+            }
+            while seen {
+                try? await Task.sleep(for: .seconds(2))
+                guard let self else { return }
+                if !SessionWatch.isAlive(markers: markers, ps: await Self.processList()) { self.macSteamRunning.remove(id); return }
+            }
+        }
     }
 
     /// Hands the game to Steam for Mac, whose own dialog asks where to put it; without it, the
@@ -2769,10 +2793,23 @@ final class AppState {
     /// nothing here blocks the app while a game runs. Kept in the home as well (RunningGames), so
     /// `highball play --wait` returns when its game quits (highball#432).
     var runningSessions: [GameSession] = [] {
-        didSet {
-            let ids = runningSessions.compactMap(\.libraryID)
-            if ids != oldValue.compactMap(\.libraryID) { RunningGames.write(ids, paths: paths) }
-        }
+        didSet { writeRunningGames() }
+    }
+    /// Steam for Mac games started from Highball and running now, by library id, seen by their
+    /// process (watchMacSteamGame). Steam for Mac starts them, so there is no process of ours.
+    var macSteamRunning: Set<String> = [] {
+        didSet { writeRunningGames() }
+    }
+    @ObservationIgnored private var runningGamesWritten: Set<String>?
+    /// What RunningGames holds for `highball play --wait`: the sessions in environments, the Mac
+    /// builds Highball started (Epic and GOG ones by their process, Steam for Mac ones by watching).
+    /// Before, only sessions counted, so a wait on a Mac game ended at --start-timeout
+    /// (highball#432, Terraforming Mars through Steam for Mac).
+    private func writeRunningGames() {
+        let ids = Set(runningSessions.compactMap(\.libraryID)).union(macGameProcesses.keys).union(macSteamRunning)
+        guard ids != runningGamesWritten else { return }
+        runningGamesWritten = ids
+        RunningGames.write(ids.sorted(), paths: paths)
     }
     /// The last session that ended, for the post-play prompt to come.
     var lastEndedSession: SessionRecord?
@@ -4689,7 +4726,9 @@ final class AppState {
 
     /// Mac builds running now, by library id: their process, for the achievement card's
     /// placement and so Play cannot start a second copy.
-    var macGameProcesses: [String: Process] = [:]
+    var macGameProcesses: [String: Process] = [:] {
+        didSet { writeRunningGames() }
+    }
 
     /// Whether a game runs now, either build: changing or removing a build then would pull its
     /// files from under it.
```

**File**: `Sources/HighballKit/Library.swift` (modified, +8/-4)
```diff
@@ -455,21 +455,25 @@ public enum LibraryListing {
         public let title: String
         public let source: String
         public let environment: String?
-        public let installed: Bool
+        /// Installed in a Highball environment. Named for what it is beside installedOnMac: a plain
+        /// "installed" read as "installed anywhere" (highball#432).
+        public let installedOnWindows: Bool
         public let installedOnMac: Bool
+        /// Hidden from the library by the player, so a frontend can leave it out too (highball#432).
+        public let hidden: Bool
     }
 
     /// `title` is the name shown in the app: a custom one (NameStore) or the store's.
-    public static func entry(_ item: LibraryItem, title: String) -> Entry {
+    public static func entry(_ item: LibraryItem, title: String, hidden: Bool = false) -> Entry {
         Entry(id: item.id, title: title, source: item.source.rawValue, environment: item.bottleName,
-              installed: item.installed, installedOnMac: item.installedOnMac)
+              installedOnWindows: item.installed, installedOnMac: item.installedOnMac, hidden: hidden)
     }
 
     public static func line(_ entry: Entry) -> String {
         func field(_ text: String) -> String {
             text.replacingOccurrences(of: "[\t\r\n]+", with: " ", options: .regularExpression)
         }
-        let state = entry.installed ? "installed" : entry.installedOnMac ? "installed on Mac" : "not installed"
+        let state = entry.installedOnWindows ? "installed" : entry.installedOnMac ? "installed on Mac" : "not installed"
         return [entry.id, field(entry.title), field(entry.environment ?? "-"), state].joined(separator: "\t")
     }
 }
```

**File**: `Sources/highball/main.swift` (modified, +5/-3)
```diff
@@ -976,9 +976,11 @@ struct LibraryCommand: AsyncParsableCommand {
     func run() async throws {
         let paths = HighballPaths()
         let names = NameStore(paths: paths).names()
+        let hiddenIDs = LibraryStore(paths: paths).hiddenIDs()
         let entries = currentLibrary(paths: paths, epic: true)
             .filter { !installed || $0.installedAnywhere }
-            .map { LibraryListing.entry($0, title: NameStore.name(for: $0.id, in: names) ?? $0.title) }
+            .map { LibraryListing.entry($0, title: NameStore.name(for: $0.id, in: names) ?? $0.title,
+                                        hidden: LibraryStore.isHidden($0.id, in: hiddenIDs)) }
             .sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
         if json {
             let enc = JSONEncoder(); enc.outputFormatting = [.prettyPrinted, .sortedKeys]
@@ -999,9 +1001,9 @@ struct Play: AsyncParsableCommand {
             With --wait the command returns once the game has quit, for frontends such as ES-DE, \
             and Highball and Steam keep running. A game that isn't installed fails the command at once, \
             with or without --wait, after Highball shows what it can do with it. It follows the games Highball runs in its \
-            environments, so a game Steam for Mac starts ends the wait only at --start-timeout.
+            environments and the Mac builds it starts, Steam for Mac's included.
             """)
-    @Argument(help: "The game's library id.") var id: String
+    @Argument(help: "The game's library id, as `highball library` lists it (for example steam:620).") var id: String
     @Flag(help: "Return only once the game has quit.") var wait = false
     @Option(help: "With --wait, how many seconds the game has to start before the command gives up.") var startTimeout: Int = 600
 
```

**File**: `Tests/HighballKitTests/PlayFromCommandLineTests.swift` (modified, +12/-0)
```diff
@@ -50,6 +50,18 @@ final class PlayFromCommandLineTests: XCTestCase {
         XCTAssertEqual(LibraryListing.line(LibraryListing.entry(game, title: "Portal Deux")), "steam:620\tPortal Deux\tGames\tinstalled")
     }
 
+    /// The JSON names the Windows install for what it is and says what the player hid (highball#432).
+    func testTheJSONSaysWhereAGameIsInstalledAndWhetherItIsHidden() throws {
+        let pin = HighballKit.LibraryItem(source: .pin, id: "pin:EA:FBB214D7-6752-4D99-AADE-4913311A953D", title: "regedit", bottleName: "EA", installed: true)
+        let entry = LibraryListing.entry(pin, title: "regedit (EA)", hidden: true)
+        let json = try XCTUnwrap(try JSONSerialization.jsonObject(with: JSONEncoder().encode(entry)) as? [String: Any])
+        XCTAssertEqual(json["installedOnWindows"] as? Bool, true)
+        XCTAssertEqual(json["installedOnMac"] as? Bool, false)
+        XCTAssertEqual(json["hidden"] as? Bool, true)
+        XCTAssertNil(json["installed"], "renamed before the command ships")
+        XCTAssertEqual(LibraryListing.entry(pin, title: "regedit").hidden, false)
+    }
+
     func testRunningGamesRoundTripAndAGoneAppReadsAsNothingKnown() throws {
         let home = FileManager.default.temporaryDirectory.appending(path: "hb-running-\(UUID().uuidString)")
         defer { try? FileManager.default.removeItem(at: home) }
```

---

### Incident Patch 2: `7c512cbd` (2026-11-23)
**Commit Message**: DXMT counts as unavailable below macOS 15, so a new environment on macOS 14 starts on DXVK, an environment set to DXMT falls back with a note, and Play says why. Every DXMT build Highball has shipped, from the Wine 10 r19 engine to Wine 11 r35, carries a built-in shader library compiled for macOS 15 (air64-apple-macosx15.0.0 next to the macOS 14 one, measured in winemetal.so of r19, r28, r30, r31 and r33), and on macOS 14 Metal refuses those shaders ('Function cs_clear_buffer_uint is using language version 3.2 which is incompatible with this OS', highball#584: Palia drew only its cursor on an M2 Pro on macOS 14.8.5). Renderer.minimumMacOS holds the floor, availability returns needsMacOS(15) where the engine has DXMT but macOS is older, the reason says to update macOS or pick another mode, and the CLI's engine list shows it. Only 3 of 1,286 database reports come from macOS 14, none on DXMT. New test in RendererAvailabilityTests, 42 renderer tests pass. Not tried on a macOS 14 Mac.

**File**: `Sources/HighballApp/AppState.swift` (modified, +1/-1)
```diff
@@ -747,7 +747,7 @@ final class AppState {
             case .needsLicence:
                 pendingD3DMetal = (item, bottle, engine)
                 return
-            case .notShipped:
+            case .notShipped, .needsMacOS:
                 // The mode the game's recipe names comes first: the per-game mode a player chose on another route
                 // follows the game to an engine that lacks it (D3DMetal, on the native arm64 line).
                 let named = fixRecipe(for: item)?.renderer.flatMap { $0.availability(in: engine) == .available ? $0 : nil }
```

**File**: `Sources/HighballKit/Bottle.swift` (modified, +27/-8)
```diff
@@ -183,20 +183,39 @@ public enum Renderer: String, Codable, CaseIterable, Sendable {
         case available
         case needsLicence(String)
         case notShipped
+        /// The engine has it, but this Mac's macOS is older than the mode needs.
+        case needsMacOS(Int)
     }
 
-    public func availability(in engine: InstalledEngine) -> Availability {
+    /// The macOS major version a mode needs, where it needs more than Highball itself (macOS 14).
+    /// Every DXMT build Highball has shipped, from the Wine 10 r19 engine to Wine 11 r35, carries a
+    /// built-in shader library compiled for macOS 15 (Metal language 3.2) next to its macOS 14 one,
+    /// and on macOS 14 Metal refuses those shaders ("language version 3.2 which is incompatible with
+    /// this OS", cs_clear_buffer_uint), so games drew nothing but the cursor (highball#584, Palia on
+    /// an M2 Pro). Below it DXMT counts as unavailable, so a new environment starts on DXVK, a
+    /// setting falls back with a note, and Play says why.
+    public static let minimumMacOS: [Renderer: Int] = [.dxmt: 15]
+
+    /// This Mac's macOS major version.
+    public static var hostMacOSMajor: Int { ProcessInfo.processInfo.operatingSystemVersion.majorVersion }
+
+    public func availability(in engine: InstalledEngine, macOSMajor: Int = Renderer.hostMacOSMajor) -> Availability {
         if self == .wined3d { return .available }
-        if engine.rendererDir(rawValue) != nil { return .available }
+        if engine.rendererDir(rawValue) != nil {
+            if let floor = Self.minimumMacOS[self], macOSMajor < floor { return .needsMacOS(floor) }
+            return .available
+        }
         if let gate = EngineManifest.gatedRenderers[rawValue], engine.ships(rawValue) { return .needsLicence(gate) }
         return .notShipped
     }
 
     /// One sentence for a person: what stops this renderer in `engine` and what to do. Nil when it runs.
-    public func unavailableReason(in engine: InstalledEngine) -> String? {
+    public func unavailableReason(in engine: InstalledEngine, macOSMajor: Int = Renderer.hostMacOSMajor) -> String? {
         let name = Self.displayName(self)
-        switch availability(in: engine) {
+        switch availability(in: engine, macOSMajor: macOSMajor) {
         case .available: return nil
+        case let .needsMacOS(floor):
+            return "\(name) needs macOS \(floor) or later, and this Mac runs macOS \(macOSMajor). Update macOS, or choose another graphics mode."
         case .needsLicence:
             return "\(name) is in engine \(engine.id), but Apple's licence has not been accepted for that engine. Accept it in the environment's settings (Graphics → Review licence…), or choose another graphics mode."
         case .notShipped:
@@ -209,15 +228,15 @@ public enum Renderer: String, Codable, CaseIterable, Sendable {
     public static let fallbackOrder: [Renderer] = [.dxmt, .dxvk, .wined3d]
 
     /// The best renderer `engine` can run in place of `wanted`. Never `wanted` itself.
-    public static func fallback(for wanted: Renderer, in engine: InstalledEngine) -> Renderer {
-        fallbackOrder.first { $0 != wanted && $0.availability(in: engine) == .available } ?? .wined3d
+    public static func fallback(for wanted: Renderer, in engine: InstalledEngine, macOSMajor: Int = Renderer.hostMacOSMajor) -> Renderer {
+        fallbackOrder.first { $0 != wanted && $0.availability(in: engine, macOSMajor: macOSMajor) == .available } ?? .wined3d
     }
 
     /// The mode a new environment starts on: the first in `fallbackOrder` this engine can run.
     /// DXMT on every Intel engine, as before; DXVK on an engine without DXMT (the arm64 line),
     /// rather than a DXMT setting that would degrade at every launch.
-    public static func defaultMode(for engine: InstalledEngine) -> Renderer {
-        fallbackOrder.first { $0.availability(in: engine) == .available } ?? .wined3d
+    public static func defaultMode(for engine: InstalledEngine, macOSMajor: Int = Renderer.hostMacOSMajor) -> Renderer {
+        fallbackOrder.first { $0.availability(in: engine, macOSMajor: macOSMajor) == .available } ?? .wined3d
     }
 
     public static func displayName(_ r: Renderer) -> String {
```

**File**: `Sources/highball/main.swift` (modified, +1/-0)
```diff
@@ -46,6 +46,7 @@ struct Engine: AsyncParsableCommand {
                     switch r.availability(in: e) {
                     case .available: return r.rawValue
                     case .needsLicence: return "\(r.rawValue) (licence not accepted)"
+                    case let .needsMacOS(v): return "\(r.rawValue) (needs macOS \(v))"
                     case .notShipped: return nil
                     }
                 }.joined(separator: ",")
```

**File**: `Tests/HighballKitTests/RendererAvailabilityTests.swift` (modified, +17/-0)
```diff
@@ -55,6 +55,23 @@ final class RendererAvailabilityTests: EnglishCopyTestCase {
         XCTAssertEqual(Renderer.defaultMode(for: try engine(ships: [], accepted: false)), .wined3d)
     }
 
+    /// DXMT's built-in shaders need macOS 15 (highball#584: Palia drew only its cursor on macOS 14.8
+    /// on an M2 Pro). Below it DXMT is unavailable, so nothing picks it on its own.
+    func testDXMTNeedsMacOS15() throws {
+        let e = try engine(accepted: false)
+        XCTAssertEqual(Renderer.dxmt.availability(in: e, macOSMajor: 14), .needsMacOS(15))
+        XCTAssertEqual(Renderer.dxmt.availability(in: e, macOSMajor: 15), .available)
+        XCTAssertEqual(Renderer.dxvk.availability(in: e, macOSMajor: 14), .available, "DXVK has no such floor")
+        XCTAssertEqual(Renderer.defaultMode(for: e, macOSMajor: 14), .dxvk, "a new environment on macOS 14 starts on DXVK")
+        XCTAssertEqual(Renderer.defaultMode(for: e, macOSMajor: 27), .dxmt)
+        XCTAssertEqual(Renderer.fallback(for: .dxmt, in: e, macOSMajor: 14), .dxvk)
+        let why = try XCTUnwrap(Renderer.dxmt.unavailableReason(in: e, macOSMajor: 14))
+        XCTAssertTrue(why.contains("macOS 15"), why)
+        XCTAssertNil(Renderer.dxmt.unavailableReason(in: e, macOSMajor: 26))
+        // An engine without DXMT says so, whatever the macOS.
+        XCTAssertEqual(Renderer.dxmt.availability(in: try engine(ships: ["dxvk"], accepted: false), macOSMajor: 14), .notShipped)
+    }
+
     // MARK: Direct3D 12-only programs (highball#139)
 
     func testADirect3D12OnlyProgramGetsAModeThatHasIt() throws {
```

---

### Incident Patch 3: `f7dd70ce` (2026-11-21)
**Commit Message**: A preview engine a player took for a game also shows its line's later revisions. hsuanice took arm64 r4 from Play for Forza Horizon 6, and r5, which carried the 7.1.4 sound fix the game needed, never appeared: the opt-in counted r4 alone, so the environment's Engine picker listed one arm64 engine and stayed hidden, and only a defaults write showed r5 (highball#672). EngineChannels.visible now counts an opt-in for the same engine and every later revision of its line, never earlier ones or another line, the same rule Play already follows when it moves an environment to the revision a recipe pins (EngineChannels.runsLine). A recipe pinning a later revision is no longer hidden for such a player, and Play then offers the move once, as before. The old test's other engine is now on another line.

**File**: `Sources/HighballKit/EngineChannels.swift` (modified, +4/-2)
```diff
@@ -23,10 +23,12 @@ public enum EngineChannels {
         }
     }
 
-    /// The same rule for one engine, counting the player's opt-ins: a preview engine they took for a game.
+    /// The same rule for one engine, counting the player's opt-ins: a preview engine they took for a game, and the
+    /// later revisions of its line. A player who took r4 for Forza Horizon 6 never saw r5, which carried the sound fix
+    /// the game needed: the environment's Engine picker listed r4 alone and so stayed hidden (highball#672).
     public static func visible(_ manifest: EngineManifest, beta: Bool, preview: Bool, optedIn: Set<String>) -> Bool {
         visible(channel: manifest.channel, beta: beta, preview: preview)
-            || (manifest.channel == Self.preview && optedIn.contains(manifest.id))
+            || (manifest.channel == Self.preview && optedIn.contains { EngineManifest.isAtOrAfter(current: manifest.id, wanted: $0) })
     }
 
     /// Whether a recipe's engine pin names a bundled engine this install may not see. Such a recipe
```

**File**: `Tests/HighballKitTests/EngineChannelsTests.swift` (modified, +14/-1)
```diff
@@ -46,7 +46,7 @@ final class EngineChannelsTests: XCTestCase {
 
     func testAPreviewEngineTakenForAGameIsSeenAndNoOtherIs() throws {
         let line = try manifest(id: "arm64-line-r1", channel: "preview")
-        let other = try manifest(id: "arm64-line-r2", channel: "preview")
+        let other = try manifest(id: "arm64-other-r2", channel: "preview")
         let betaLine = try manifest(id: "x64-beta-r1", channel: "beta")
         XCTAssertTrue(EngineChannels.visible(line, beta: false, preview: false, optedIn: ["arm64-line-r1"]))
         XCTAssertFalse(EngineChannels.visible(other, beta: false, preview: false, optedIn: ["arm64-line-r1"]))
@@ -56,6 +56,19 @@ final class EngineChannelsTests: XCTestCase {
         XCTAssertTrue(EngineChannels.hidesPin("arm64-line-r1", bundled: [line], beta: false, preview: false, optedIn: []))
     }
 
+    func testAPreviewOptInAlsoShowsTheLaterRevisionsOfItsLine() throws {
+        let r3 = try manifest(id: "arm64-line-r3", channel: "preview")
+        let r4 = try manifest(id: "arm64-line-r4", channel: "preview")
+        let r5 = try manifest(id: "arm64-line-r5", channel: "preview")
+        let other = try manifest(id: "arm64-other-r5", channel: "preview")
+        let opted: Set<String> = ["arm64-line-r4"]
+        XCTAssertTrue(EngineChannels.visible(r5, beta: false, preview: false, optedIn: opted), "the revision after the one taken")
+        XCTAssertTrue(EngineChannels.visible(r4, beta: false, preview: false, optedIn: opted))
+        XCTAssertFalse(EngineChannels.visible(r3, beta: false, preview: false, optedIn: opted), "not the ones before it")
+        XCTAssertFalse(EngineChannels.visible(other, beta: false, preview: false, optedIn: opted), "not another line")
+        XCTAssertFalse(EngineChannels.hidesPin("arm64-line-r5", bundled: [r4, r5], beta: false, preview: false, optedIn: opted))
+    }
+
     func testPlayOffersAHiddenPreviewPinAndNothingElse() throws {
         let bundled = [try manifest(id: "arm64-line-r1", channel: "preview"), try manifest(id: "x64-line-r9", channel: nil),
                        try manifest(id: "x64-beta-r1", channel: "beta")]
```

#### Recent Merged Pull Requests:
- **PR #783** (2026-11-24): CLI: --wait follows Mac builds, JSON gets installedOnWindows and hidden (@gauthierpiarrette)
- **PR #782** (2026-11-24): DXMT needs macOS 15: macOS 14 environments use DXVK instead (@gauthierpiarrette)
- **PR #774** (2026-11-22): Two Chinese lines from #759 in the translator's wording (@gauthierpiarrette)
- **PR #769** (2026-11-22): A preview engine opt-in also shows the later revisions of its line (@gauthierpiarrette)
- **PR #762** (2026-11-24): Show progress while games load (@aswanth6000)
- **PR #759** (2026-11-21): Move a program to another environment, and pick the environment when running a program (@gauthierpiarrette)

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

## X. highball play --wait follows Mac builds, Steam for Mac's included, and the libra

**RULE**:
When implementing operations in `Sources/HighballApp/AppState.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in gauthierpiarrette/highball. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `7d471e91`: highball play --wait follows Mac builds, Steam for Mac's included, and the library JSON says installedOnWindows and hidden (highball#432). RunningGames, which --wait reads, held only the sessions in environments, so a wait on a game Steam for Mac started ran to --start-timeout and gave up while the game played (Terraforming Mars, udance4ever timed 49 s). It now also holds the Epic and GOG Mac builds Highball started and the Steam for Mac games Play opened, followed by their process under steamapps/common for up to ten minutes to appear and then until they quit. The JSON's installed is now installedOnWindows, beside installedOnMac, since the command hasn't shipped yet, and hidden says what the player hid from the library. play's id help names the form. New test in PlayFromCommandLineTests, 16 tests pass, and highball library --json lists the real library with both fields. The Steam for Mac wait is not tried live yet.. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `Sources/HighballApp/AppState.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
        if openInSteamForMac(URL(string: "steam://run/\(appid)")!),
           let game = macSteamGames.first(where: { $0.appid == appid }), !game.installdir.isEmpty {
            watchMacSteamGame(item.id, markers: SessionWatch.markers(installdir: game.installdir))
        }
    }

    /// Follows a game Steam for Mac started for Highball by its process, whose path runs through
    /// its steamapps/common folder: up to ten minutes for it to appear (Steam may update it first),
    /// then until it quits. Only `highball play --wait` reads it (writeRunningGames).
    private func watchMacSteamGame(_ id: String, markers: [String]) {
        Task { [weak self] in
            var seen = false
            for _ in 0..<300 {
                try? await Task.sleep(for: .seconds(2))
                let alive = SessionWatch.isAlive(markers: markers, ps: await Self.processList())
                guard let self else { return }
                if alive, !seen { seen = true; self.macSteamRunning.insert(id) }
                if seen, !alive { self.macSteamRunning.remove(id); return }
            }
            while seen {
                try? await Task.sleep(for: .seconds(2))
                gu
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
        _ = openInSteamForMac(URL(string: "steam://run/\(appid)")!)
        didSet {
            let ids = runningSessions.compactMap(\.libraryID)
            if ids != oldValue.compactMap(\.libraryID) { RunningGames.write(ids, paths: paths) }
        }
    var macGameProcesses: [String: Process] = [:]
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `7d471e91` are properly handled with clean fallback behavior.
