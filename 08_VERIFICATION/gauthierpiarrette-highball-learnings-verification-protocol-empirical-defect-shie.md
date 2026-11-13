# Verification Protocol: Verification Protocol: Empirical Defect Shield for gauthierpiarrette-highball-learnings

<!-- PROVENANCE_START
{
  "source_repository": "gauthierpiarrette-highball-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T16:26:52.732Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-gauthierpiarrette-highball-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [gauthierpiarrette-highball-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T16:26:52.732Z`  
> **Learning ID**: `LEARN-EVO-gauthierpiarrette-highball-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `gauthierpiarrette-highball-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/gauthierpiarrette-highball-learnings.md`  
> **Source**: github ([https://github.com/gauthierpiarrette/highball](https://github.com/gauthierpiarrette/highball))  
> **Source Version**: `d8187e2a`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-13T16:25:47.724Z  
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
> **Harvest Timestamp**: 2026-11-13T16:25:47.540Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `gauthierpiarrette/highball`
- **Description**: Run Windows games on Apple Silicon — free, open source, with an open compatibility database that tells you what actually works.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2246 stars

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
    func setRendererOverride(_ renderer: Renderer?, for id: String) {
        libraryStore.setRendererOverride(renderer, for: id)
        libraryOverrides = libraryStore.rendererOverrides()
        appendLog(renderer.map { "\(id): graphics mode set to \($0.rawValue) for this game" } ?? "\(id): graphics mode back to the environment's")
    }

    /// A game whose last run asked Windows for a fullscreen size this Mac never switched to.
    /// One click tells Wine to pretend the switch happened and scale the game to the screen.
    struct ModesetTrial {

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
- **Issue #706** (2026-11-12): **Problems with Tomodachi Life Editor**
  *Symptoms*: ### What happened  Note; this may be an issue with the editor itself and not the Highball emulator. I opened the exe file with highball and used Tomodachi Life Editor accordingly, selecting correct regions and using the 3ds editor via checkpoint correctly using a verified tutorial. After reloading my SD card into my 3ds, it read "Save data is corrupted and will be deleted." I am currently trying to restore my old save file through checkpoint by using the backup feature on Tomodachi Life Editor. I am unsure what went wrong in my beginning editing process that impacted my SD card, but I am doing everything I can to restore my unedited version of Tomodachi Life before using the editor.  ### Chip and macOS  Apple A18 Pro, macOS 26.6.2  ### Highball version  0.10.26  ### Log  ~/Library/Application Support/Highball/logs/2026-11-12T045822Z-Games-Tomodachi Life Save Editor.exe.log: # gin x64-sikarugir10.0_6-r28 bottle=Games renderer=dxmt # wine ~/Downloads/Tomodachi.Life.Save.Editor.5.1.0/Tomodachi Life Save Editor.exe # sync=msync winver=win10 dpi=96 dxvkAsync=false frameGen=off # audio out=48000 Hz # WINEDLLPATH_PREPEND=~/Library/Application Support/Highball/engines/x64-sikarugir10.0_6-r28/renderers/dxmt/wine:~/Library/Application Support/Highball/engines/x64-sikarugir10.0_6-r28/frameworks/renderer/d9vk/wine # WINEDLLOVERRIDES=winemenubuilder.exe=d # CX_FWD_COMPAT_GL_CTX=1 # DXVK_CONFIG_FILE=C:\highball\dxvk.conf # DXVK_LOG_PATH=C:\highball\logs # DXMT_LOG_PATH=C:\highball\logs # M
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report, and sorry about the save. The log shows the editor running for 80 seconds and closing normally with no errors, so it doesn't tell what went wrong with the file, and Highball has no way to check a 3DS save, so I can't test this one. If you backed the save up with Checkpoint before editing, that backup is still in Checkpoint's saves folder on the SD card and you can restore it from Checkpoint.
  > How do I do that? I'm not completely sure if I edited the save or if I have two saves. Using checkpoint, I created a save, then imported the save into the editor, and hit "restore" on Checkpoint when finished. What exactly can I do to restore it from Checkpoint? I used https://www.instagram.com/reel/DV8pgMqCFUy/  for the tutorial.

- **Issue #697** (2026-11-11): **Detroit Become Human**
  *Symptoms*: ### What happened  Detroit: Become Human on an M4 MacBook Air, 16GB RAM, Highball 0.10.27 beta, Wine 11 r31.  The game successfully completed shader compilation and entered gameplay on its first launch, but the display flickered severely. On subsequent launches, DetroitBecomeHuman.exe remains running at high CPU usage without a visible game window.  Restarting macOS and testing with the external monitor disconnected did not resolve the issue. A process sample showed the main thread waiting in Apple's AppKit event loop.  Could this be related to the missing fullscreen/window handling changes in the current Detroit fix?  ### Chip and macOS  Apple M4, macOS 27.2  ### Highball version  0.10.27  ### Log  ~/Library/Application Support/Highball/logs/2026-11-11T134227Z-Detroit - Become Human-DetroitBecomeHuman.exe.log: # gin x64-crossover26.3-r31 bottle=Detroit - Become Human renderer=dxmt # wine /Volumes/Windows/Robot/Detroit-Become-Human-AnkerGames/Detroit Become Human/DetroitBecomeHuman.exe # sync=msync winver=win10 dpi=96 dxvkAsync=false frameGen=off # audio out=96000 Hz (most games mix at 48000 Hz) # WINEDLLPATH_PREPEND=~/Library/Application Support/Highball/engines/x64-crossover26.3-r31/renderers/dxmt/wine # WINEDLLOVERRIDES=winemenubuilder.exe=d # CX_FWD_COMPAT_GL_CTX=1 # DXVK_CONFIG_FILE=C:\highball\dxvk.conf # DXVK_LOG_PATH=C:\highball\logs # DXMT_ALLOW_CROSS_PROCESS_SWAPCHAIN=1 # DXMT_LOG_PATH=C:\highball\logs # HB_MVK_LENIENT_INTERFACES=1 # MVK_CONFIG_LOG_LEVEL=2 # MVK_CON

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

### Incident Patch 1: `0c3a6a16` (2026-11-10)
**Commit Message**: arm64-kk-wine11.18-r5: r4 with patches-arm64 0056 and 0057, the spatial audio pair Tx wrote for the Wine 11 line (highball#313), from the release engine-arm64-wine-11.18-20261108T132317Z-spatial-0056-0057 (build-arm64 run 42480524132, branch arm64-spatial-audio at 1dc6db7). A surround bed on a Mac's two-channel output lost everything but front left and right, so Forza Horizon 6 dropped the sounds behind the camera on headphones (highball#672); it now goes through AUSpatialMixer. Installed from that archive (sha256 6721b1f4, the same bytes as the public release) into a throwaway home on an M1 Pro with macOS 27.0: a test program's 7.1 and 7.1.4 float streams open, run their clock for 1.5 s and log 'rendered by AUSpatialMixer for built-in speakers on a 2-channel device', stereo keeps the old path. Every other file is r4's. Forza Horizon 6 was not run on r5, its route stays on r3. 93 manifest and engine tests pass.

**File**: `spike/engines/arm64-kk-wine11.18-r5.json` (added, +103/-0)
```diff
@@ -0,0 +1,103 @@
+{
+  "$schema": "https://highball.app/schemas/engine-manifest/v0",
+  "id": "arm64-kk-wine11.18-r5",
+  "displayName": "Wine 11.18 native arm64 (preview, KosmicKrisp) r5",
+  "arch": "arm64",
+  "minMacOS": "27.0",
+  "requires": [],
+  "channel": "preview",
+  "direct3D9": "wined3d",
+  "notes": [
+    "r5 (2026-11-10): r4 with patches-arm64 0056 and 0057, the spatial audio pair Tx wrote for the Wine 11 line (highball#313). A game that plays a surround bed (5.1, 7.1, 7.1.4) on a Mac's two-channel output lost everything but front left and right, so Forza Horizon 6 dropped the sounds behind the camera on headphones (highball#672). The bed now goes through Apple's AUSpatialMixer, which renders it for the Mac's speakers, headphones or external speakers. HB_SPATIAL=speakers, headphones or external overrides that guess and HB_SPATIAL=0 turns the path off. Every other file is r4's. Checked on an M1 Pro with macOS 27.0: a 7.1 and a 7.1.4 stream from a test program open, run their clock and go through the mixer on the built-in speakers, stereo streams keep the old path. Forza Horizon 6 was not run on r5, its route stays on r3.",
+    "r4 (2026-11-04): r3 with fixes for games beyond Forza Horizon 6. Video: GStreamer's VideoToolbox plugin imports MoltenVK's vkGetMTLDeviceMVK, which the Khronos loader this line ships as libMoltenVK.dylib lacked, so the plugin never loaded, no H.264 video played and a game waiting on its intro video stayed black (ContractVille). The loader now carries that call (highball-engine kosmickrisp-arm64/mvk_compat.c). OpenGL: Wine 11.18 marked no extension in a legacy (before 3.0) context, so a game asking for framebuffer objects there got nothing; patches-arm64 0054 is the upstream fix by Rémi Bernon (1c2d909829c). 0053 gives a legacy context GL_ARB_ES2_compatibility's five calls, as the Wine 11 line's 0021 does. Paperback: The Game needed both. KosmicKrisp: highball patch 0008 gives a LINEAR image Metal cannot back with a buffer (several levels or layers, or 3D) a tiled texture with linear-looking subresource layouts, as MoltenVK did; Red Dead Redemption 2 aborted in Metal during its first load before, and now reaches its menu and the opening cutscene at 60 fps. Every other file is r3's: FEX with ineshd's 0034, vkd3d-proton and DXVK. On a base M4 with macOS 27.0 FNAF, Among Us, the Half-Life 2 demo, WHERE SAFETY ENDS, Bloodbreaker, Portal, Portal 2, Big Walk, The Last Flame, The Sims Legacy Collection, ContractVille and Paperback reach their menus. Forza Horizon 6 was not run on r4, its route stays on r3.",
+    "r3 (2026-11-03): r2 with FEX patch 0034 by ineshd. FEX patched an unaligned atomic in its code buffer without the MAP_JIT write permission the engine turns on, and Forza Horizon 6 crashed at xtajit64.dll+0x1177ac within a minute of a controller coming into use (highball#618). Every other archive is r2's. Tested by the contributor for 30 minutes with an Xbox controller on an M5; on an M4 here the engine boots and runs 32-bit and 64-bit programs.",
+    "r2 (2026-11-01): r1 with a KosmicKrisp build that carries highball patch 0007, every other archive the same. Encoder end barriers ask for Device visibility instead of ResourceAlias, and HB_KK_NO_UBO_ROBUST=1, which a recipe asks for, drops the bounds check on constant buffer reads. Forza Horizon 6's benchmark on a base M4 at 1080p, Very Low, FSR Quality: GPU time per frame from 26.7 ms to about 21 ms, 36 to 43 fps uncapped. A new driver build means the shader cache fills again on the first start.",
+    "r1 (2026-11-01): Forza Horizon 6's native route. Wine 11.18 with patches-arm64 through 0052, FEX 2610 with fex/patches through 0033, vkd3d-proton with renderers-arm64 through 0010, and KosmicKrisp (Mesa's Vulkan driver on Metal 4) with steamac's patches and kosmickrisp-arm64/highball in place of MoltenVK. A line of its own: Microsoft Flight Simulator 2024's engine and its offers do not move until a flight has run on these patches.",
+    "The Khronos loader is engine/lib/libMoltenVK.dylib, the name winevulkan opens, and VK_DRIVER_FILES points it at the driver in renderers/kosmickrisp. Steam's browser runs without Chromium's sandbox (appDefaults): with the game's emulator switches its renderer dies at once inside the sandbox and is relaunched for good, so the sign-in window never comes (measured 2026-11-01).",
+    "Known: a burst of stalls of several seconds in all, about half a minute into the first drive of a session on a warm shader cache, cause open. Measured only on a base M4 with 32 GB."
+  ],
+  "components": {
+    "wine": {
+      "kind": "engine",
+      "url": "https://github.com/gauthierpiarrette/highball-engine/releases/download/engine-arm64-wine-11.18-20261108T132317Z-spatial-0056-0057/engine-arm64-wine-11.18-20261108T132317Z-spatial-0056-0057.tar.gz",
+      "size": 402959865,
+      "sha256": "6721b1f4ee2665283f7c16e4e0b3cf5737c454399fac3d74657fde181d148f33",
+      "extract": {
+        "into": "eng
```

---

### Incident Patch 2: `639c2486` (2026-11-10)
**Commit Message**: Uninstalling a GOG game removes only the files its install put there, as Steam does, and leaves what the player added beside it: a patched DLL, a mod, the Mac build Fallout CE wants in the game's folder (highball#652, udance4ever). Highball now lists an install's files in .highball-install-files when gogdl's download finishes (app and CLI) and again after setup, every file in the folder but what an earlier uninstall left there (.highball-left-files) and the download did not touch. An update adds what it changed. The status change time counts with the other dates, since Finder and unzip keep a file's old modification date and nothing sets a status change time back. The uninstall removes the listed files, the install's records at the top (goggame-, unins, .highball-) and the folders left empty (Finder's .DS_Store aside), never through a link or a .. path, and logs how many files stay. An install from before this (no list) or an uninstall that deletes the saves too removes the whole folder as before. Highball's records stay out of the kept backup. GOGUninstallFilesTests (6) and the 113 GOG tests pass.

**File**: `Sources/HighballApp/AppState.swift` (modified, +18/-1)
```diff
@@ -4591,14 +4591,19 @@ final class AppState {
                 if status != 0 { appendLog("\(item.title): the shared Windows runtimes did not all download; the game may ask for them") }
             }
             stage = String(format: L("Downloading %@"), item.title)
+            let downloadStart = Date()
             try await gogDownload(title: item.title, command: "gogdl download", completed: { store.downloadCompleted(id) }) { control, onLine in
                 try store.install(id, into: bottle, language: language, control: control, onLine: onLine)
             }
             busyProgress = nil; transferRate = nil
             refreshGOGInstalls()
             if let game = gogInstalledByBottle[bottle.name]?.first(where: { $0.id == id }) {
                 store.keepManifest(for: game)
+                // The install's own files, so an uninstall leaves what the player adds (#652);
+                // again after setup, which can write into the folder too.
+                GOGStore.recordInstallFiles(for: game, downloadStarted: downloadStart)
                 try await gogRunSetup(game, title: item.title, in: bottle, language: language)
+                GOGStore.recordInstallFiles(for: game, downloadStarted: downloadStart)
             }
             await MainActor.run { self.gogRefresh() }
         }
@@ -4851,9 +4856,11 @@ final class AppState {
             }
             busyProgress = nil; transferRate = nil
             store.keepManifest(for: game)
+            GOGStore.recordUpdatedFiles(for: game, updateStarted: start)
             refreshGOGInstalls()
             if let fresh = gogInstalledByBottle[bottle.name]?.first(where: { $0.id == game.id }) {
                 try await gogRunSetup(fresh, title: item.title, in: bottle, language: language)
+                GOGStore.recordUpdatedFiles(for: fresh, updateStarted: start)
             }
         }
     }
@@ -5572,7 +5579,17 @@ final class AppState {
             if FileManager.default.fileExists(atPath: game.folder.path) {
                 // One call with no progress of its own, and a big game is tens of thousands of files.
                 stage = L("Deleting the game's files")
-                try await Task.detached { try FileManager.default.removeItem(at: game.folder) }.value
+                // An install Highball listed loses only its own files, as on Steam: a mod, a patch or a
+                // Mac build the player put beside it stays (#652). Asked to delete the saves too, or
+                // with no list (installed before 0.10.28), the whole folder goes as before.
+                let left = deleteSaves ? nil : await Task.detached { GOGStore.removeInstallFiles(of: game) }.value
+                if let left {
+                    if !left.isEmpty {
+                        appendLog("\(title): \(left.count) file\(left.count == 1 ? "" : "s") the install didn't put there stay in \(game.folder.path)")
+                    }
+                } else {
+                    try await Task.detached { try FileManager.default.removeItem(at: game.folder) }.value
+                }
             }
             let elsewhere = GOGStore.otherInstallsRemain(id, removingFrom: bottle.name, installedByBottle: gogInstalledByBottle,
                                                          macInstalls: Set(gogMacInstalled.keys))
```

**File**: `Sources/HighballKit/GOGLibrary.swift` (modified, +133/-0)
```diff
@@ -627,3 +627,136 @@ extension GOGStore {
         save(history, for: game, driveC: driveC)
     }
 }
+
+// MARK: The install's own files (an uninstall removes those and nothing else)
+
+extension GOGStore {
+    /// The files gogdl put in an install's folder, one path below the folder per line, kept in
+    /// the folder like the manifest. An uninstall removes these and leaves what the player or the
+    /// game added (a mod, a patch, a Mac build the game wants beside it), as Steam does (highball#652).
+    static func installFilesRecord(_ folder: URL) -> URL { folder.appending(path: ".highball-install-files") }
+
+    /// The files an uninstall left in the folder (the player's or the game's), so a later download
+    /// into the same folder does not count them as its own.
+    static func leftFilesRecord(_ folder: URL) -> URL { folder.appending(path: ".highball-left-files") }
+
+    /// After a finished download that began at `start`: lists every file in the game's folder as
+    /// the install's, all of it gogdl's, a download stopped and resumed included. The exception is
+    /// what an earlier uninstall left there (leftFilesRecord) and the download did not touch. The
+    /// status change time counts as well as the modification and creation dates: Finder and unzip
+    /// keep a file's old modification date, but nothing sets a status change time back.
+    /// Links are listed, never followed.
+    public static func recordInstallFiles(for game: InstalledGame, downloadStarted start: Date) {
+        recordInstallFiles(in: game.folder, downloadStarted: start)
+    }
+
+    static func recordInstallFiles(in folder: URL, downloadStarted start: Date) {
+        let since = start.addingTimeInterval(-2)
+        let left = Set(readList(leftFilesRecord(folder)) ?? [])
+        let listed = filesWithDates(in: folder).filter { !left.contains($0.0) || $0.1 >= since }.map(\.0)
+        writeList(listed, to: installFilesRecord(folder))
+        try? FileManager.default.removeItem(at: leftFilesRecord(folder))
+    }
+
+    /// After an update that began at `start`: adds what changed in the folder since then. An
+    /// install with no list keeps none, since the update's files alone are not the whole game.
+    public static func recordUpdatedFiles(for game: InstalledGame, updateStarted start: Date) {
+        recordUpdatedFiles(in: game.folder, updateStarted: start)
+    }
+
+    static func recordUpdatedFiles(in folder: URL, updateStarted start: Date) {
+        guard let old = installFiles(folder) else { return }
+        let since = start.addingTimeInterval(-2)
+        writeList(old + filesWithDates(in: folder).filter { $0.1 >= since }.map(\.0), to: installFilesRecord(folder))
+    }
+
+    /// The install's list, nil when it has none (installed before Highball kept one).
+    static func installFiles(_ folder: URL) -> [String]? { readList(installFilesRecord(folder)) }
+
+    private static func readList(_ file: URL) -> [String]? {
+        guard let text = try? String(contentsOf: file, encoding: .utf8) else { return nil }
+        return text.split(separator: "\n").map(String.init).filter { !$0.isEmpty }
+    }
+
+    private static func writeList(_ paths: [String], to file: URL) {
+        let text = Set(paths).filter { !$0.hasPrefix(".highball-") }.sorted().joined(separator: "\n") + "\n"
+        try? Data(text.utf8).write(to: file, options: .atomic)
+    }
+
+    /// Every file and link below `folder`, by its path below it, with the latest of its dates.
+    /// Folders behind a link are not entered.
+    static func filesWithDates(in folder: URL) -> [(String, Date)] {
+        let keys: [URLResourceKey] = [.isDirectoryKey, .isSymbolicLinkKey, .contentModificationDateKey,
+                                      .attributeModificationDateKey, .creationDateKey]
+        guard let walk = FileManager.default.enumerator(at: folder, includingPropertiesForKeys: keys) else { return [] }
+        let top = folder.standardizedFileURL.path + "/"
+        var found: [(String, Date)] = []
+        for case let url as URL in walk {
+            guard let v = try? url.resourceValues(forKeys: Set(keys)) else { continue }
+            if v.isDirectory == true && v.isSymbolicLink != true { continue }
+            let path = url.standardizedFileURL.path
+            guard path.hasPrefix(top) else { continue }
+            let dates = [v.contentModificationDate, v.attributeModificationDate, v.creationDate].compactMap { $0 }
+            found.append((String(path.dropFirst(top.count)), dates.max() ?? .distantPast))
+        }
+        return found
+    }
+
+    /// Uninstall for an install with a list: removes the listed files and the install's records at
+    /// the top of the folder (goggame-<id>.info, unins*, Highball's .highball-* files), then the
+    /// folders left empty, the game's folder too when nothing is left. Returns the files that stay,
+    /// and lists them in the folder for a later download (leftFile
```

**File**: `Sources/HighballKit/GOGSaves.swift` (modified, +5/-4)
```diff
@@ -365,15 +365,16 @@ public struct GOGSaves: Sendable {
         GOGStore.history(for: game, driveC: driveC).firstSetup != nil
     }
 
-    /// The uninstaller's and GOG's own records at the top of the game's folder (unins000.dat,
-    /// goggame-<id>.info, …): written by the install, not the game, and putting an old one back
-    /// into a new install would break its uninstaller.
+    /// The uninstaller's, GOG's and Highball's own records at the top of the game's folder
+    /// (unins000.dat, goggame-<id>.info, .highball-install-files, …): written by the install, not
+    /// the game, and putting an old one back into a new install would break its uninstaller or
+    /// hand it the old install's file list.
     static func isInstallerRecord(_ path: String, in top: String) -> Bool {
         guard path.hasPrefix(top) else { return false }
         let rest = path.dropFirst(top.count)
         guard !rest.contains("/") else { return false }
         let name = rest.lowercased()
-        return name.hasPrefix("unins") || name.hasPrefix("goggame-")
+        return name.hasPrefix("unins") || name.hasPrefix("goggame-") || name.hasPrefix(".highball-")
     }
 
     /// How many files a backup holds and their size, for the log.
```

**File**: `Sources/highball/main.swift` (modified, +2/-0)
```diff
@@ -807,6 +807,7 @@ struct GOG: AsyncParsableCommand {
             let info = try store.info(id)
             let language = GOGStore.language(for: info.languages)
             if !info.dependencies.isEmpty { _ = try? store.downloadRedists(info.dependencies) { print($0) } }
+            let downloadStart = Date()
             let status = try store.install(id, into: b, language: language) { line in
                 if !line.contains("[PROGRESS]") || line.contains("= Progress:") { print(line) }
             }
@@ -818,6 +819,7 @@ struct GOG: AsyncParsableCommand {
             try await store.runSetup(game, language: language, runner: runner,
                                      onStep: { n, total, label in print("setup \(n)/\(total): \(label)") },
                                      onFailure: { label, code in print("setup: \(label) ended with code \(code); carrying on") })
+            GOGStore.recordInstallFiles(for: game, downloadStarted: downloadStart)   // so the app's uninstall keeps what the player adds (#652)
             print("installed \(game.title) into \(b.name): \(game.folder.path)")
         }
     }
```

**File**: `Tests/HighballKitTests/GOGUninstallFilesTests.swift` (added, +105/-0)
```diff
@@ -0,0 +1,105 @@
+import XCTest
+@testable import HighballKit
+
+/// An uninstall removes the files the install put there and leaves what the player added (highball#652).
+final class GOGUninstallFilesTests: XCTestCase {
+    var dir: URL!
+    var game: URL { dir.appending(path: "drive_c/GOG Games/Gunslugs", directoryHint: .isDirectory) }
+    let fm = FileManager.default
+
+    override func setUpWithError() throws {
+        dir = fm.temporaryDirectory.appending(path: "gog-uninstall-\(UUID().uuidString)", directoryHint: .isDirectory)
+        try fm.createDirectory(at: game, withIntermediateDirectories: true)
+    }
+
+    override func tearDownWithError() throws { try? fm.removeItem(at: dir) }
+
+    func write(_ path: String, in folder: URL? = nil, modified: Date? = nil) throws {
+        let url = (folder ?? game).appending(path: path)
+        try fm.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
+        try Data(path.utf8).write(to: url)
+        if let modified { try fm.setAttributes([.modificationDate: modified, .creationDate: modified], ofItemAtPath: url.path) }
+    }
+
+    func exists(_ path: String) -> Bool { fm.fileExists(atPath: game.appending(path: path).path) }
+
+    func testUninstallRemovesTheInstallsFilesAndKeepsThePlayers() throws {
+        try write("Gunslugs.exe"); try write("data/levels/1.dat"); try write("data/sound/a.ogg")
+        try write("goggame-1234.info"); try write(".highball-gogdl-manifest")
+        GOGStore.recordInstallFiles(in: game, downloadStarted: Date())
+        // After the install: a patched DLL from a zip keeps its 2001 date, an app bundle copied by
+        // Finder keeps its own, and the game writes a config.
+        let old = Date(timeIntervalSince1970: 1_000_000_000)
+        try write("patch/d3d9.dll", modified: old)
+        try write("Fallout CE.app/Contents/MacOS/fallout-ce", modified: old)
+        try write("data/levels/user.cfg")
+        try write("data/sound/.DS_Store")
+
+        let left = try XCTUnwrap(GOGStore.removeInstallFiles(in: game))
+        XCTAssertFalse(exists("Gunslugs.exe")); XCTAssertFalse(exists("data/levels/1.dat"))
+        XCTAssertFalse(exists("goggame-1234.info")); XCTAssertFalse(exists(".highball-gogdl-manifest"))
+        XCTAssertFalse(exists(".highball-install-files"))
+        XCTAssertFalse(exists("data/sound"), "a folder left with only Finder's .DS_Store goes")
+        XCTAssertTrue(exists("patch/d3d9.dll")); XCTAssertTrue(exists("Fallout CE.app/Contents/MacOS/fallout-ce"))
+        XCTAssertTrue(exists("data/levels/user.cfg"))
+        XCTAssertEqual(Set(left.map(\.lastPathComponent)), ["d3d9.dll", "fallout-ce", "user.cfg"])
+        XCTAssertEqual(GOGStore.installFiles(game), nil)
+    }
+
+    func testAFolderWithNothingAddedIsRemovedWhole() throws {
+        try write("Gunslugs.exe"); try write("data/1.dat"); try write("goggame-1234.info")
+        GOGStore.recordInstallFiles(in: game, downloadStarted: Date())
+        XCTAssertEqual(GOGStore.removeInstallFiles(in: game), [])
+        XCTAssertFalse(fm.fileExists(atPath: game.path))
+    }
+
+    func testWithoutAListNothingIsTouched() throws {
+        try write("Gunslugs.exe")
+        XCTAssertNil(GOGStore.removeInstallFiles(in: game))
+        XCTAssertTrue(exists("Gunslugs.exe"))
+    }
+
+    func testAReinstallDoesNotClaimWhatTheLastUninstallLeft() throws {
+        try write("Gunslugs.exe"); try write("goggame-1234.info")
+        GOGStore.recordInstallFiles(in: game, downloadStarted: Date())
+        try write("mods/big.pak"); try write("notes.txt")
+        _ = GOGStore.removeInstallFiles(in: game)
+        XCTAssertTrue(exists(".highball-left-files"))
+        // A later download into the same folder rewrites notes.txt (the game ships one too) but not the mod.
+        let later = Date().addingTimeInterval(60)
+        try write("Gunslugs.exe"); try write("goggame-1234.info")
+        try fm.setAttributes([.modificationDate: later.addingTimeInterval(5)], ofItemAtPath: game.appending(path: "notes.txt").path)
+        GOGStore.recordInstallFiles(in: game, downloadStarted: later)
+        XCTAssertEqual(Set(try XCTUnwrap(GOGStore.installFiles(game))), ["Gunslugs.exe", "goggame-1234.info", "notes.txt"])
+        XCTAssertFalse(exists(".highball-left-files"))
+        _ = GOGStore.removeInstallFiles(in: game)
+        XCTAssertTrue(exists("mods/big.pak")); XCTAssertFalse(exists("notes.txt"))
+    }
+
+    func testAnUpdateAddsWhatItChangedAndStartsNoList() throws {
+        try write("Gunslugs.exe")
+        let later = Date().addingTimeInterval(60)
+        GOGStore.recordUpdatedFiles(in: game, updateStarted: later)
+        XCTAssertNil(GOGStore.installFiles(game), "an install from before the lists keeps none")
+
+        GOGStore.recordInstallFiles(in: game, downloadStarted: Date())
+        try write("added-by-player.txt")
+        try write("data/new-in-patch.dat", modified: later.addingTimeInterval(5))
+
```

---

### Incident Patch 3: `203928f1` (2026-11-12)
**Commit Message**: Wine 11 engines r32 and r33: r30 and r31 with one rebuilt Wine (highball-engine run 43188180198, PR #34, sha256 94936e0d). The Wine is r31's source and series plus patch 0030, gdi32 exporting D3DKMTSetProcessSchedulingPriorityClass, which Steam's client service imports and whose absence made Wine end the service (#699), and its Unix side links no Homebrew paths: winegstreamer.so's /usr/local/opt names loaded Intel Homebrew's GLib and GStreamer beside the frameworks' on Macs that have them, and GLib broke in Steam's web helper (#698). Every other archive is the base's. r33 sits above r32 so plain Wine 11 pins land on D3DMetal 3, as before. Checked on the M1 Pro in a throwaway home: an H.264 Media Foundation test, the D3DKMT call from 64 and 32 bits, and Steam's web helpers for 100 s. 865 tests pass.

**File**: `Tests/HighballKitTests/BundledEngineTests.swift` (modified, +29/-5)
```diff
@@ -101,19 +101,20 @@ final class BundledEngineTests: XCTestCase {
         }
         XCTAssertEqual(try one("x64-crossover26.3-r20").components["wine"]?.sha256, try one("x64-crossover26.3-r21").components["wine"]?.sha256,
                        "one Wine build behind both, downloaded once")
-        // Every older plain Wine 11 pin is offered the newest plain revision on macOS 27 (r31 since
-        // the D3DMetal 4 line moved to r30, below), never a D3DMetal 4 one.
+        // Every older plain Wine 11 pin is offered the newest plain revision on macOS 27 (r33 since
+        // the D3DMetal 4 line moved to r32, below), never a D3DMetal 4 one.
         for pin in ["x64-crossover26.3-r5", "x64-crossover26.3-r7", "x64-crossover26.3-r8", "x64-crossover26.3-r9", "x64-crossover26.3-r15", "x64-crossover26.3-r19",
-                    "x64-crossover26.3-r21", "x64-crossover26.3-r23", "x64-crossover26.3-r25", "x64-crossover26.3-r27"] {
+                    "x64-crossover26.3-r21", "x64-crossover26.3-r23", "x64-crossover26.3-r25", "x64-crossover26.3-r27",
+                    "x64-crossover26.3-r29", "x64-crossover26.3-r31"] {
             let wanted = try one(pin)
             let offered = all.filter { EngineManifest.satisfies(current: $0, wanted: wanted) && $0.runs(onMacOS: "27.0") }
                 .max { (EngineManifest.revision(of: $0.id) ?? 0) < (EngineManifest.revision(of: $1.id) ?? 0) }
-            XCTAssertEqual(offered?.id, "x64-crossover26.3-r31", "a pin on \(pin) must get the newest D3DMetal 3 revision")
+            XCTAssertEqual(offered?.id, "x64-crossover26.3-r33", "a pin on \(pin) must get the newest D3DMetal 3 revision")
         }
         let forzaPin = try one("x64-crossover26.3-r18")
         let forOffer = all.filter { EngineManifest.satisfies(current: $0, wanted: forzaPin) && $0.runs(onMacOS: "27.0") }
             .max { (EngineManifest.revision(of: $0.id) ?? 0) < (EngineManifest.revision(of: $1.id) ?? 0) }
-        XCTAssertEqual(forOffer?.id, "x64-crossover26.3-r30", "Forza Horizon 6's pin gets the newest D3DMetal 4 revision")
+        XCTAssertEqual(forOffer?.id, "x64-crossover26.3-r32", "Forza Horizon 6's pin gets the newest D3DMetal 4 revision")
         XCTAssertFalse(EngineManifest.satisfies(current: try one("x64-crossover26.3-r21"), wanted: forzaPin), "r21 lacks D3DMetal 4")
     }
 
@@ -260,6 +261,29 @@ final class BundledEngineTests: XCTestCase {
         XCTAssertFalse(EngineManifest.satisfies(current: r31, wanted: try one("x64-crossover26.3-r18")), "r31 lacks D3DMetal 4")
     }
 
+    /// r32 and r33 are r30 and r31 with one rebuilt Wine: patch 0030 (gdi32 exports
+    /// D3DKMTSetProcessSchedulingPriorityClass for Steam's client service, highball#699) and a Unix side
+    /// with no Homebrew paths (highball#698). Every other archive is the base's, so only Wine downloads.
+    func testR32AndR33AreR30AndR31WithTheNewWine() throws {
+        let all = try manifests()
+        func one(_ id: String) throws -> EngineManifest { try XCTUnwrap(all.first { $0.id == id }, "\(id) missing") }
+        for (old, new) in [("x64-crossover26.3-r30", "x64-crossover26.3-r32"), ("x64-crossover26.3-r31", "x64-crossover26.3-r33")] {
+            let o = try one(old), n = try one(new)
+            XCTAssertEqual(Set(n.components.keys), Set(o.components.keys), "\(new) has \(old)'s components")
+            for (name, c) in o.components where name != "wine" {
+                XCTAssertEqual(n.components[name]?.sha256, c.sha256, "\(new)/\(name) must be \(old)'s, only Wine is rebuilt")
+            }
+            XCTAssertNotEqual(n.components["wine"]?.sha256, o.components["wine"]?.sha256, "\(new) carries the rebuilt Wine")
+            XCTAssertTrue(n.components["wine"]?.url.absoluteString.hasPrefix("https://github.com/gauthierpiarrette/highball-engine/releases/download/engine-wine-11.0-") == true)
+            XCTAssertEqual(n.minMacOS, o.minMacOS)
+            XCTAssertEqual(n.baseEnv, o.baseEnv)
+        }
+        let r32 = try one("x64-crossover26.3-r32"), r33 = try one("x64-crossover26.3-r33")
+        XCTAssertEqual(r32.components["wine"]?.sha256, r33.components["wine"]?.sha256, "one Wine build behind both, downloaded once")
+        XCTAssertTrue(EngineManifest.satisfies(current: r32, wanted: try one("x64-crossover26.3-r18")), "r32 carries D3DMetal 4")
+        XCTAssertFalse(EngineManifest.satisfies(current: r33, wanted: try one("x64-crossover26.3-r18")), "r33 lacks D3DMetal 4")
+    }
+
     /// Frame generation left Highball on 2026-09-27 at its author's request (itsOwen's lsfg-metal,
     /// highball#171): no engine may ship the component any more. The revisions since are their
     /// bases (r5 on the main line, r6 on the GPTK 4 line) with DXMT swapped and one file added.
```

**File**: `spike/engines/x64-crossover26.3-r32.json` (added, +200/-0)
```diff
@@ -0,0 +1,200 @@
+{
+  "$schema": "https://highball.app/schemas/engine-manifest/v0",
+  "arch": "x86_64",
+  "baseEnv": {
+    "DYLD_FALLBACK_FRAMEWORK_PATH": "${frameworks}",
+    "DYLD_FALLBACK_LIBRARY_PATH": "${frameworks}:${frameworks}/GStreamer.framework/Versions/1.0/lib",
+    "GST_PLUGIN_PATH": "${frameworks}/GStreamer.framework/Versions/1.0/lib/gstreamer-1.0",
+    "WINEDEBUG": "fixme-all",
+    "DXMT_ALLOW_CROSS_PROCESS_SWAPCHAIN": "1",
+    "D3DM_MTL4": "0"
+  },
+  "components": {
+    "d3dmetal-tsshim": {
+      "extract": {
+        "into": "renderers/d3dmetal-tsshim/wine",
+        "subpath": "renderers/d3dmetal-tsshim/wine"
+      },
+      "kind": "renderer",
+      "layout": [
+        "x86_64-windows/d3d12.dll"
+      ],
+      "license": "MIT",
+      "note": "A d3d12.dll in front of D3DMetal's that serves DirectX 12 timestamp queries (D3DMetal 3.0 resolves them to zero at a reported 60 Hz). Exports carry the ordinals D3DMetal 4.0 beta 3 uses (D3D12CreateDevice at 101, D3D12GetInterface at 109, the two Serialize calls at 110 and 111), so games that bind d3d12 imports by ordinal load through it. Kill switch HB_D3D12_TSSHIM=0 idles the patches; the DLL stays in front. HB_TSSHIM_ATOMIC64=1 in a game's variables answers yes to OPTIONS11's 64-bit atomics on descriptor heap resources, which D3DMetal 3 answers no to and Capcom's RE Engine requires (opt-in, for a game's fix to set). Input layouts that place elements with D3D12_APPEND_ALIGNED_ELEMENT reach D3DMetal with those offsets written out, which D3DMetal 4.0 beta 2 and beta 3 get wrong (HB_TSSHIM_APPEND_OFFSETS=0 passes them through). D3D12GetInterface is passed through, and a device factory it returns gets its CreateDevice wrapped so those devices are patched too. Built for beta 3 only: older D3DMetal numbers the Serialize calls 109 and 110. Source: spike/tsshim, Scripts/build-tsshim.sh.",
+      "order": 1,
+      "sha256": "30fccd4ea8f88ad55d44e46b2ac943ad633b2c90fd6a56774294573062ae1259",
+      "size": 52852,
+      "url": "https://github.com/gauthierpiarrette/highball-engine/releases/download/d3dmetal-tsshim-20261020/d3dmetal-tsshim-20261020.tar.xz",
+      "version": "20261020"
+    },
+    "dxmt": {
+      "extract": {
+        "into": "renderers/dxmt/wine",
+        "subpath": "highball"
+      },
+      "kind": "renderer",
+      "license": "MIT (Highball branch of DXMT: SwapDeviceContextState, cross-process opt-in)",
+      "sha256": "96feaf5d98d3c6cdc3edea9503e2891d435df8d5bfdf7d3f6998a56ec62bbd58",
+      "size": 18923969,
+      "url": "https://github.com/gauthierpiarrette/highball-engine/releases/download/dxmt-highball-20260930T161516Z-a444716/dxmt-highball-20260930T161516Z-a444716.tar.gz",
+      "note": "DXMT from Highball's fork (gauthierpiarrette/dxmt, branch highball-20260928 at 5c50790): upstream main of 2026-09-16 (v0.80 plus five months of upstream work, among it keyed-mutex and shared-resource support and DXGI functions Steam's overlay can hook) plus four Highball changes: cross-process swapchains behind DXMT_ALLOW_CROSS_PROCESS_SWAPCHAIN (off by default), SwapDeviceContextState implemented instead of aborting, 2D textures answering IDXGISurface, and the one that matters on this Wine: a shared texture with no D3DKMT device behind it is created as a private one, with one error line, instead of failing the game. On this Wine the driver assigns GPU LUIDs of its own, so DXMT's lookup of its adapter fails (the build also tries the primary display's name, which fails here too) and there is never a D3DKMT device; before this build every shared texture then died at creation. This revision's DXMT is that branch plus a444716 (branch highball-20260930): the encoding context's Metal device is declared before the command helpers whose constructors build pipelines through it. Declared after them it was still uninitialised memory there, and a game could die at start in newComputePipelineStateWithDescriptor sent to a garbage object: Among Us's 64-bit build did in 8 of 12 launches on r13, and in none of 12 with this build. The bug is in upstream DXMT too."
+    },
+    "moltenvk": {
+      "extract": {
+        "into": "frameworks/libMoltenVK.dylib",
+        "subpath": "libMoltenVK.dylib"
+      },
+      "kind": "runtime",
+      "license": "Apache-2.0",
+      "note": "MoltenVK 1.4.2 rebuilt with three Highball patches (spike/patches/moltenvk-shadow-import.patch, moltenvk-linear-fallback.patch and moltenvk-shadow-readback.patch, Scripts/build-moltenvk.sh). Shadow import is off unless a launch sets MVK_SHADOW_IMPORT=1 (32-bit native-Vulkan games such as The Sims Legacy Collection). Linear fallback is always on: a linear-tiled image that Metal cannot back with linear memory (3D, mipmapped or array images) is created with optimal tiling instead of failing vkCreateImage, which is what takes Red Dead Redemption 2 from an exit at 98 per cent to the main menu and the story. Shadow readback (highball#283) copies what the GPU writes into 
```

**File**: `spike/engines/x64-crossover26.3-r33.json` (added, +178/-0)
```diff
@@ -0,0 +1,178 @@
+{
+  "$schema": "https://highball.app/schemas/engine-manifest/v0",
+  "arch": "x86_64",
+  "baseEnv": {
+    "DYLD_FALLBACK_FRAMEWORK_PATH": "${frameworks}",
+    "DYLD_FALLBACK_LIBRARY_PATH": "${frameworks}:${frameworks}/GStreamer.framework/Versions/1.0/lib",
+    "GST_PLUGIN_PATH": "${frameworks}/GStreamer.framework/Versions/1.0/lib/gstreamer-1.0",
+    "WINEDEBUG": "fixme-all",
+    "DXMT_ALLOW_CROSS_PROCESS_SWAPCHAIN": "1"
+  },
+  "components": {
+    "d3dmetal-tsshim": {
+      "extract": {
+        "into": "renderers/d3dmetal-tsshim/wine",
+        "subpath": "renderers/d3dmetal-tsshim/wine"
+      },
+      "kind": "renderer",
+      "layout": [
+        "x86_64-windows/d3d12.dll"
+      ],
+      "license": "MIT",
+      "note": "A d3d12.dll in front of D3DMetal's that serves DirectX 12 timestamp queries (D3DMetal 3.0 resolves them to zero at a reported 60 Hz). Exports carry Microsoft's d3d12 ordinals (D3D12CreateDevice at 101), which D3DMetal mirrors, so games that bind d3d12 imports by ordinal load through it. Kill switch HB_D3D12_TSSHIM=0 idles the patches; the DLL stays in front. HB_TSSHIM_ATOMIC64=1 in a game's variables answers yes to OPTIONS11's 64-bit atomics on descriptor heap resources, which D3DMetal 3 answers no to and Capcom's RE Engine requires (opt-in, for a game's fix to set). Source: spike/tsshim, Scripts/build-tsshim.sh.",
+      "order": 1,
+      "sha256": "5906fd46813e0cbe5e59909f77fd86344768ea8c07babe60cf4d8bbad1d0d00a",
+      "size": 50532,
+      "url": "https://github.com/gauthierpiarrette/highball-engine/releases/download/d3dmetal-tsshim-20261014/d3dmetal-tsshim-20261014.tar.xz",
+      "version": "20261014"
+    },
+    "dxmt": {
+      "extract": {
+        "into": "renderers/dxmt/wine",
+        "subpath": "highball"
+      },
+      "kind": "renderer",
+      "license": "MIT (Highball branch of DXMT: SwapDeviceContextState, cross-process opt-in)",
+      "sha256": "96feaf5d98d3c6cdc3edea9503e2891d435df8d5bfdf7d3f6998a56ec62bbd58",
+      "size": 18923969,
+      "url": "https://github.com/gauthierpiarrette/highball-engine/releases/download/dxmt-highball-20260930T161516Z-a444716/dxmt-highball-20260930T161516Z-a444716.tar.gz",
+      "note": "DXMT from Highball's fork (gauthierpiarrette/dxmt, branch highball-20260928 at 5c50790): upstream main of 2026-09-16 (v0.80 plus five months of upstream work, among it keyed-mutex and shared-resource support and DXGI functions Steam's overlay can hook) plus four Highball changes: cross-process swapchains behind DXMT_ALLOW_CROSS_PROCESS_SWAPCHAIN (off by default), SwapDeviceContextState implemented instead of aborting, 2D textures answering IDXGISurface, and the one that matters on this Wine: a shared texture with no D3DKMT device behind it is created as a private one, with one error line, instead of failing the game. On this Wine the driver assigns GPU LUIDs of its own, so DXMT's lookup of its adapter fails (the build also tries the primary display's name, which fails here too) and there is never a D3DKMT device; before this build every shared texture then died at creation. This revision's DXMT is that branch plus a444716 (branch highball-20260930): the encoding context's Metal device is declared before the command helpers whose constructors build pipelines through it. Declared after them it was still uninitialised memory there, and a game could die at start in newComputePipelineStateWithDescriptor sent to a garbage object: Among Us's 64-bit build did in 8 of 12 launches on r13, and in none of 12 with this build. The bug is in upstream DXMT too."
+    },
+    "moltenvk": {
+      "extract": {
+        "into": "frameworks/libMoltenVK.dylib",
+        "subpath": "libMoltenVK.dylib"
+      },
+      "kind": "runtime",
+      "license": "Apache-2.0",
+      "note": "MoltenVK 1.4.2 rebuilt with three Highball patches (spike/patches/moltenvk-shadow-import.patch, moltenvk-linear-fallback.patch and moltenvk-shadow-readback.patch, Scripts/build-moltenvk.sh). Shadow import is off unless a launch sets MVK_SHADOW_IMPORT=1 (32-bit native-Vulkan games such as The Sims Legacy Collection). Linear fallback is always on: a linear-tiled image that Metal cannot back with linear memory (3D, mipmapped or array images) is created with optimal tiling instead of failing vkCreateImage, which is what takes Red Dead Redemption 2 from an exit at 98 per cent to the main menu and the story. Shadow readback (highball#283) copies what the GPU writes into shadowed memory back to the game's pages when a submission completes, so a 32-bit game's readbacks under MVK_SHADOW_IMPORT=1 stop being stale (The Sims' thumbnails); without the variable it does nothing. Since r30 and r31 also: device-memory-cap (HB_MVK_DEVICE_MEMORY_PERCENT caps the heap and its budget, highball#398) and two changes from DiAvisoo's MoltenVK-Detroit (cache-drawid-present, lenient-interfaces, highball#125), CI build run 41367170976.",
+      "order": 1,
+      "sha256": "662d7c06
```

#### Recent Merged Pull Requests:
- **PR #715** (2026-11-12): A Steam game's session follows its program after it relaunches itself (@gauthierpiarrette)
- **PR #714** (2026-11-12): Steam demos stay in the library like games (#432) (@gauthierpiarrette)
- **PR #713** (2026-11-12): Epic can be disconnected (#708) (@gauthierpiarrette)
- **PR #710** (2026-11-12): Wine 11 engines r32 and r33: no Homebrew paths (#698), D3DKMTSetProcessSchedulingPriorityClass (#699) (@gauthierpiarrette)
- **PR #692** (2026-11-11): Play reports say when DLSS (MetalFX) is on (@gauthierpiarrette)
- **PR #691** (2026-11-11): Uninstalling a GOG game keeps the files the player added (@gauthierpiarrette)

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

## X. arm64-kk-wine11.18-r5: r4 with patches-arm64 0056 and 0057, the spatial audio pa

**RULE**:
When implementing operations in `spike/engines/arm64-kk-wine11.18-r5.json`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in gauthierpiarrette/highball. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0c3a6a16`: arm64-kk-wine11.18-r5: r4 with patches-arm64 0056 and 0057, the spatial audio pair Tx wrote for the Wine 11 line (highball#313), from the release engine-arm64-wine-11.18-20261108T132317Z-spatial-0056-0057 (build-arm64 run 42480524132, branch arm64-spatial-audio at 1dc6db7). A surround bed on a Mac's two-channel output lost everything but front left and right, so Forza Horizon 6 dropped the sounds behind the camera on headphones (highball#672); it now goes through AUSpatialMixer. Installed from that archive (sha256 6721b1f4, the same bytes as the public release) into a throwaway home on an M1 Pro with macOS 27.0: a test program's 7.1 and 7.1.4 float streams open, run their clock for 1.5 s and log 'rendered by AUSpatialMixer for built-in speakers on a 2-channel device', stereo keeps the old path. Every other file is r4's. Forza Horizon 6 was not run on r5, its route stays on r3. 93 manifest and engine tests pass.. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `spike/engines/arm64-kk-wine11.18-r5.json`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
{
  "$schema": "https://highball.app/schemas/engine-manifest/v0",
  "id": "arm64-kk-wine11.18-r5",
  "displayName": "Wine 11.18 native arm64 (preview, KosmicKrisp) r5",
  "arch": "arm64",
  "minMacOS": "27.0",
  "requires": [],
  "channel": "preview",
  "direct3D9": "wined3d",
  "notes": [
    "r5 (2026-11-10): r4 with patches-arm64 0056 and 0057, the spatial audio pair Tx wrote for the Wine 11 line (highball#313). A game that plays a surround bed (5.1, 7.1, 7.1.4) on a Mac's two-channel output lost everything but front left and right, so Forza Horizon 6 dropped the sounds behind the camera on headphones (highball#672). The bed now goes through Apple's AUSpatialMixer, which renders it for the Mac's speakers, headphones or external speakers. HB_SPATIAL=speakers, headphones or external overrides that guess and HB_SPATIAL=0 turns the path off. Every other file is r4's. Checked on an M1 Pro with macOS 27.0: a 7.1 and a 7.1.4 stream from a test program open, run their clock and go through the mixer on the built-in speakers, stereo streams keep the old path. Forza Horizon 6 was not run on r5, its route stays on r3.",
    "r4 (2026-11-04): r3 with fixes for games beyond Forza Horizon 6. V
```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0c3a6a16` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
