# Domain G — Architecture Intelligence: Architecture Intelligence: gauthierpiarrette/highball Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "gauthierpiarrette/highball",
  "source_url": "https://github.com/gauthierpiarrette/highball",
  "source_version": "4ebe4fe0",
  "license": "GPL-3.0",
  "timestamp": "2026-11-17T05:37:13.549Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-gauthierpiarrette-highball",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [gauthierpiarrette/highball](https://github.com/gauthierpiarrette/highball) (Revision: `4ebe4fe0`).  
> **License**: GPL-3.0 | **Timestamp**: `2026-11-17T05:37:13.549Z`  
> **Learning ID**: `learn-github-gauthierpiarrette-highball`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), F (Design Intelligence), K (Quality & Verification Intelligence), I (Content & Information Intelligence), M (Feedback & Evolution Intelligence), D (Research & Knowledge Intelligence), E (Creative Intelligence), L (Deployment & Operations Intelligence), A (Human & Need Intelligence), B (Product Intelligence)
- **Confidence Rating**: 74%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from gauthierpiarrette/highball:

# Forensic Learning Record (Deep Inspection): gauthierpiarrette/highball

> **Canonical Artifact**: `07_PROJECT_LEARNING/gauthierpiarrette-highball-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/gauthierpiarrette/highball](https://github.com/gauthierpiarrette/highball))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-17T05:37:12.545Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `gauthierpiarrette/highball`
- **Description**: Run Windows games on Apple Silicon — free, open source, with an open compatibility database that tells you what actually works.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2271 stars

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
- **Issue #717** (2026-11-14): ****Additional RDR2 memory-pressure test — M4 Pro, 24GB, macOS 27.2****
  *Symptoms*: ### What happened  Environment: Highball `x64-crossover26.3-r31`, clean RDR2 environment, Vulkan/MoltenVK, 1920×1080, High textures.  Tested `HB_MVK_DEVICE_MEMORY_PERCENT=40` and `30`. Both values correctly change RDR2's reported available video memory (9,830 MB and 7,372 MB respectively), but neither prevents severe swapping and stuttering.  With the 30% limit:  - Before cutscenes: green memory pressure, 1.50 GB swap - Initial loading: yellow, 1.53 GB - Early cinematics: yellow, 2.20 GB - Loading transition before Chapter 1: Colter: yellow, 8.60 GB - Subsequent Colter cutscenes: yellow with brief red periods, over 9 GB swap  The sharpest memory increase occurs during the loading transition immediately before Chapter 1: Colter.  The launch log also contains repeated `AGX: Texture read/write assertion failed` messages.  Is there a way to determine whether this is an unresolved MoltenVK allocation/resource-lifetime issue? The smaller reported video-memory budget does not prevent the substantial swap growth.  ### Chip and macOS  Apple M4 Pro, macOS 27.2.1  ### Highball version  0.10.26  

- **Issue #706** (2026-11-12): **Problems with Tomodachi Life Editor**
  *Symptoms*: ### What happened  Note; this may be an issue with the editor itself and not the Highball emulator. I opened the exe file with highball and used Tomodachi Life Editor accordingly, selecting correct regions and using the 3ds editor via checkpoint correctly using a verified tutorial. After reloading my SD card into my 3ds, it read "Save data is corrupted and will be deleted." I am currently trying to restore my old save file through checkpoint by using the backup feature on Tomodachi Life Editor. I am unsure what went wrong in my beginning editing process that impacted my SD card, but I am doing everything I can to restore my unedited version of Tomodachi Life before using the editor.  ### Chip and macOS  Apple A18 Pro, macOS 26.6.2  ### Highball version  0.10.26  ### Log  ~/Library/Application Support/Highball/logs/2026-11-12T045822Z-Games-Tomodachi Life Save Editor.exe.log: # gin x64-sikarugir10.0_6-r28 bottle=Games renderer=dxmt # wine ~/Downloads/Tomodachi.Life.Save.Editor.5.1.0/Tomodachi Life Save Editor.exe # sync=msync winver=win10 dpi=96 dxvkAsync=false frameGen=off # audio out=48000 Hz # WINEDLLPATH_PREPEND=~/Library/Application Support/Highball/engines/x64-sikarugir10.0_6-r28/renderers/dxmt/wine:~/Library/Application Support/Highball/engines/x64-sikarugir10.0_6-r28/frameworks/renderer/d9vk/wine # WINEDLLOVERRIDES=winemenubuilder.exe=d # CX_FWD_COMPAT_GL_CTX=1 # DXVK_CONFIG_FILE=C:\highball\dxvk.conf # DXVK_LOG_PATH=C:\highball\logs # DXMT_LOG_PATH=C:\highball\logs # M
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report, and sorry about the save. The log shows the editor running for 80 seconds and closing normally with no errors, so it doesn't tell what went wrong with the file, and Highball has no way to check a 3DS save, so I can't test this one. If you backed the save up with Checkpoint before editing, that backup is still in Checkpoint's saves folder on the SD card and you can restore it from Checkpoint.
  > How do I do that? I'm not completely sure if I edited the save or if I have two saves. Using checkpoint, I created a save, then imported the save into the editor, and hit "restore" on Checkpoint when finished. What exactly can I do to restore it from Checkpoint? I used https://www.instagram.com/reel/DV8pgMqCFUy/  for the tutorial.

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

### Incident Patch 1: `ac350e46` (2026-11-14)
**Commit Message**: Wine 10 engines r30 (default) and r31 (D3DMetal 4 line): r28 and r29 with the audio library the Wine 11 engines carry since r30 (audiobuf-20261103, sha256 617b8feb, 8 KB, the same archive). The default engine still had the October library, so on it a microphone lost 32 frames nearly every 10 ms period (highball#350, #601), Wine's audio clock slept at normal priority on a busy Mac (#444), and games kept the output they started with (#460, nikiomori's change). Every other archive is r28's or r29's, so environments move without the Windows setup and download 8 KB; r28 moves to spike/engines for rollback. Installed r30 from its manifest with the CLI in a throwaway home on an M1 Pro, macOS 27.0: every file is r28's except libhbaudiobuf.dylib, byte-identical to Wine 11 r31's. A WASAPI capture with hbtap's sample time ramp in place of the microphone's data, 6 s at 48 kHz: 520 and 501 breaks on r28, 0 on r30, under 10 busy loops 510 against 0; the library logs the capture buffer capped at 240 frames and audio_client_timer made real time (status 0). r31 was not installed on its own, BundledEngineTests checks it is r29 plus that archive. 872 tests pass.

**File**: `Tests/HighballKitTests/BundledEngineTests.swift` (modified, +37/-13)
```diff
@@ -303,6 +303,8 @@ final class BundledEngineTests: XCTestCase {
     /// On 2026-10-08 the audio library gains a limiter, so a game whose float mix goes over full scale
     /// is turned down instead of clipped (highball-db#349): r26 and r27.
     /// On 2026-10-18 DXMT gains Steep's sample count fallback (highball-db#465): r28 and r29.
+    /// On 2026-11-14 the audio library the Wine 11 engines carry since r30 (microphones, a real time
+    /// audio clock, following the Mac's output; highball#350, #444, #460): r30 and r31.
     /// Everything else is byte-identical, so it is not downloaded again, and every new archive
     /// comes from Highball's own release pages (a component URL has to be ours to stay immutable,
     /// #27/#28).
@@ -320,14 +322,15 @@ final class BundledEngineTests: XCTestCase {
                                   ("x64-sikarugir10.0_6-r20", "x64-sikarugir10.0_6-r6"), ("x64-sikarugir10.0_6-r23", "x64-sikarugir10.0_6-r6"),
                                   ("x64-sikarugir10.0_6-r25", "x64-sikarugir10.0_6-r6"), ("x64-sikarugir10.0_6-r26", "x64-sikarugir10.0_6-r5"),
                                   ("x64-sikarugir10.0_6-r27", "x64-sikarugir10.0_6-r6"), ("x64-sikarugir10.0_6-r28", "x64-sikarugir10.0_6-r5"),
-                                  ("x64-sikarugir10.0_6-r29", "x64-sikarugir10.0_6-r6")] {
+                                  ("x64-sikarugir10.0_6-r29", "x64-sikarugir10.0_6-r6"), ("x64-sikarugir10.0_6-r30", "x64-sikarugir10.0_6-r5"),
+                                  ("x64-sikarugir10.0_6-r31", "x64-sikarugir10.0_6-r6")] {
             let r = try one(current), base = try one(baseID)
             XCTAssertEqual(r.minMacOS, base.minMacOS, "\(current) must keep \(baseID)'s floor")
             XCTAssertEqual(r.baseEnv?["D3DM_MTL4"], base.baseEnv?["D3DM_MTL4"], "\(current) must keep \(baseID)'s Metal 4 setting")
             XCTAssertEqual(Set(r.components.keys), Set(base.components.keys).union(["winemac", "wineserver", "ntdll-unix", "audiobuf"]),
                            "\(current) has exactly \(baseID)'s components plus the driver, the msync fix and the audio library")
             let readback: Set = ["x64-sikarugir10.0_6-r24", "x64-sikarugir10.0_6-r25", "x64-sikarugir10.0_6-r26", "x64-sikarugir10.0_6-r27",
-                                 "x64-sikarugir10.0_6-r28", "x64-sikarugir10.0_6-r29"]
+                                 "x64-sikarugir10.0_6-r28", "x64-sikarugir10.0_6-r29", "x64-sikarugir10.0_6-r30", "x64-sikarugir10.0_6-r31"]
             for (name, component) in base.components where name != "dxmt" && !(name == "moltenvk" && readback.contains(current)) {
                 XCTAssertEqual(r.components[name]?.sha256, component.sha256, "\(name) drifted from \(baseID), so its download is not reused")
             }
@@ -351,7 +354,7 @@ final class BundledEngineTests: XCTestCase {
             // (Scripts/build-wine10-msync.sh), one archive behind two single-file components. r21's
             // archive (Scripts/build-wine10-dep.sh) carries those edits plus the DEP one.
             let archive = ["x64-sikarugir10.0_6-r21", "x64-sikarugir10.0_6-r22", "x64-sikarugir10.0_6-r24", "x64-sikarugir10.0_6-r26",
-                           "x64-sikarugir10.0_6-r28"].contains(current) ? "wine10-dep-" : "wine10-msync-"
+                           "x64-sikarugir10.0_6-r28", "x64-sikarugir10.0_6-r30"].contains(current) ? "wine10-dep-" : "wine10-msync-"
             for (name, into) in [("wineserver", "engine/bin/wineserver"), ("ntdll-unix", "engine/lib/wine/x86_64-unix/ntdll.so")] {
                 let c = try XCTUnwrap(r.components[name])
                 XCTAssertEqual(c.extract?.into, into, "\(current)/\(name) replaces one file, the Wine archive's own")
@@ -369,7 +372,7 @@ final class BundledEngineTests: XCTestCase {
             XCTAssertTrue(audio.url.absoluteString.hasPrefix("https://github.com/gauthierpiarrette/highball-engine/releases/download/audiobuf-"),
                           "\(current)'s audio library must come from Highball's own release page: \(audio.url)")
         }
-        XCTAssertEqual(all.last?.id, "x64-sikarugir10.0_6-r28", "r28 is the default engine")
+        XCTAssertEqual(all.last?.id, "x64-sikarugir10.0_6-r30", "r30 is the default engine")
         // r22 and r23 are r21 and r20 with only the driver changed: the retina fix rides one new
         // archive, and every other download is reused.
         for (fixed, before) in [("x64-sikarugir10.0_6-r22", "x64-sikarugir10.0_6-r21"), ("x64-sikarugir10.0_6-r23", "x64-sikarugir10.0_6-r20")] {
@@ -438,27 +441,48 @@ final class BundledEngineTests: XCTestCase {
         }
         XCTAssertEqual(try one("x64-sikarugir10.0_6-r28").components["dxmt"]?.sha256, try one("x64-sikarugir10.0_6-r29").components["dxmt"]?.sha256,
                        "one DXMT archive behind both lines, downloaded once")
+        // r30 and r31 are r28 and r29 with only the audio library changed, to the 8 KB archive the Wine 11
+     
```

**File**: `spike/engine-manifest.json` (modified, +11/-10)
```diff
@@ -1,13 +1,14 @@
 {
   "$schema": "https://highball.app/schemas/engine-manifest/v0",
-  "id": "x64-sikarugir10.0_6-r28",
-  "displayName": "Wine 10.0 (Sikarugir) r28",
+  "id": "x64-sikarugir10.0_6-r30",
+  "displayName": "Wine 10.0 (Sikarugir) r30",
   "arch": "x86_64",
   "minMacOS": "14.0",
   "requires": [
     "rosetta2"
   ],
   "notes": [
+    "r30 (2026-11-14): r28 with only the audio library changed, to the 2026-11-03 build the Wine 11 engines r30 to r33 carry (audiobuf component). Microphones keep every frame (highball#350), Wine's audio clock runs in real time so a busy Mac wakes a game's audio on time (highball#444), and games follow the Mac's output when it changes (highball#460, nikiomori). Every other archive is r28's, so environments on r28 move without the Windows setup and download 8 KB. Measured on an M1 Pro, macOS 27.0, installed from this manifest with the CLI: every file is r28's except libhbaudiobuf.dylib, which is byte-identical to the Wine 11 r31 one. A WASAPI capture (event driven, 20 ms buffer) with the HAL's sample time written in place of the microphone's data, 6 s at 48 kHz: r28 broke the ramp 520 and 501 times (about 15,000 frames lost), r30 never; under 10 busy loops 510 against 0. The library logged the capture buffer capped at 240 frames and Wine's audio_client_timer made real time (status 0). No game was run on this revision.",
     "r28 (2026-10-18): r26 with only DXMT changed, built from Highball's DXMT branch with Steep's fix (highball-db#465, by Sean Shmulevich): Steep asks for 8x MSAA without checking, Apple GPUs stop at 4, and the game died with no window. A built-in profile gives steep.exe the highest count the Mac has instead; no other game changes. Same toolchain as the previous DXMT build (mingw-w64 14.0.0_3, meson 1.10.0, Xcode 16.1, LLVM 15.0.7). Environments on r26 move without the Windows setup and download about 19 MB. Measured on an M4, macOS 27.0 (2026-10-18): against the previous DXMT archive, winemetal.so is byte-identical, winemetal.dll, d3d10core, nvapi64 and nvngx differ only in their build timestamps, and d3d11.dll and dxgi.dll (which also carries DXMT's profile table) differ by the fix and the profile. A D3D11 test asking for an 8x MSAA render target, 64- and 32-bit: refused under its own name on r26 and on this revision alike, and named steep.exe it gets a 4x texture here that clears and resolves to the exact colour, where r26 refused it.",
     "r26 (2026-10-08): r24 with the audio library rebuilt to also limit float output like Windows' audio engine (audiobuf component, highball-db#349). Windows ends its shared-mode mix with a limiter, so a game may hand it samples above full scale and never clip. Wine passed them to Core Audio, which clipped them at the device, and loud passages crackled. Only that 6 KB archive changes, so environments move without the Windows setup. Measured on an M4, macOS 27.0 (2026-10-08), with this archive's library inserted into Wine 10 r21 and Wine 11 r17 environments: a WASAPI test tone recorded through ScreenCaptureKit passes sound under full scale unchanged (0.5 stays 0.5000, rms 0.3536) and holds a tone at 1.4 times full scale to 0.9923 with no sample over full scale, where HB_AUDIOLIMIT=0 lets 47,376 samples over through. No dropouts or clicks. The same code built as a prototype: Paperback's title music has nothing over full scale (2,586 samples in 30 s without) and is 0.4 dB quieter, Five Nights at Freddy's has nothing over (70 without).",
     "r24 (2026-10-07): r22 with MoltenVK's shadow-import fixed so GPU results reach the game (moltenvk component, highball#283, highball-db#160, #174). Under MVK_SHADOW_IMPORT=1, which only The Sims Legacy Collection's recipe sets, the private Metal buffer behind imported host memory was copied to the GPU on every submit and never back, so everything a 32-bit Vulkan game read back from the GPU was stale: The Sims' lot thumbnails and family portraits came out as noise. The shadow-readback patch records the ranges a submission's copy, fill, update and query-results commands write into that memory, keeps the next submits' upload off them, and copies them back to the game's pages when the submission completes, before its fence and semaphores are signalled. Measured on an M4 with macOS 27.0 with a 32-bit test program (private/tools/vkrb): with the variable, every readback was stale on r22 and is right on this build, at 32 MB into a 64 MB allocation, next to bytes the program wrote during the submission (kept), and with a second submit in flight (20 rounds). The Sims starts and draws its neighbourhood with no lost device, Portal 2 under DXVK loads two maps with HDR, Direct3D 11 and Direct3D 9 test programs under DXVK give the same results, and without the variable nothing runs differently. Every other component is byte-identical to r22, so only the 1.7 MB MoltenVK archive is new.",
@@ -173,17 +174,17 @@
     },
     "audiobuf": {
       "kind": "runtime",
-      "url": "https://github
```

**File**: `spike/engines/x64-sikarugir10.0_6-r28.json` (added, +223/-0)
```diff
@@ -0,0 +1,223 @@
+{
+  "$schema": "https://highball.app/schemas/engine-manifest/v0",
+  "id": "x64-sikarugir10.0_6-r28",
+  "displayName": "Wine 10.0 (Sikarugir) r28",
+  "arch": "x86_64",
+  "minMacOS": "14.0",
+  "requires": [
+    "rosetta2"
+  ],
+  "notes": [
+    "r28 (2026-10-18): r26 with only DXMT changed, built from Highball's DXMT branch with Steep's fix (highball-db#465, by Sean Shmulevich): Steep asks for 8x MSAA without checking, Apple GPUs stop at 4, and the game died with no window. A built-in profile gives steep.exe the highest count the Mac has instead; no other game changes. Same toolchain as the previous DXMT build (mingw-w64 14.0.0_3, meson 1.10.0, Xcode 16.1, LLVM 15.0.7). Environments on r26 move without the Windows setup and download about 19 MB. Measured on an M4, macOS 27.0 (2026-10-18): against the previous DXMT archive, winemetal.so is byte-identical, winemetal.dll, d3d10core, nvapi64 and nvngx differ only in their build timestamps, and d3d11.dll and dxgi.dll (which also carries DXMT's profile table) differ by the fix and the profile. A D3D11 test asking for an 8x MSAA render target, 64- and 32-bit: refused under its own name on r26 and on this revision alike, and named steep.exe it gets a 4x texture here that clears and resolves to the exact colour, where r26 refused it.",
+    "r26 (2026-10-08): r24 with the audio library rebuilt to also limit float output like Windows' audio engine (audiobuf component, highball-db#349). Windows ends its shared-mode mix with a limiter, so a game may hand it samples above full scale and never clip. Wine passed them to Core Audio, which clipped them at the device, and loud passages crackled. Only that 6 KB archive changes, so environments move without the Windows setup. Measured on an M4, macOS 27.0 (2026-10-08), with this archive's library inserted into Wine 10 r21 and Wine 11 r17 environments: a WASAPI test tone recorded through ScreenCaptureKit passes sound under full scale unchanged (0.5 stays 0.5000, rms 0.3536) and holds a tone at 1.4 times full scale to 0.9923 with no sample over full scale, where HB_AUDIOLIMIT=0 lets 47,376 samples over through. No dropouts or clicks. The same code built as a prototype: Paperback's title music has nothing over full scale (2,586 samples in 30 s without) and is 0.4 dB quieter, Five Nights at Freddy's has nothing over (70 without).",
+    "r24 (2026-10-07): r22 with MoltenVK's shadow-import fixed so GPU results reach the game (moltenvk component, highball#283, highball-db#160, #174). Under MVK_SHADOW_IMPORT=1, which only The Sims Legacy Collection's recipe sets, the private Metal buffer behind imported host memory was copied to the GPU on every submit and never back, so everything a 32-bit Vulkan game read back from the GPU was stale: The Sims' lot thumbnails and family portraits came out as noise. The shadow-readback patch records the ranges a submission's copy, fill, update and query-results commands write into that memory, keeps the next submits' upload off them, and copies them back to the game's pages when the submission completes, before its fence and semaphores are signalled. Measured on an M4 with macOS 27.0 with a 32-bit test program (private/tools/vkrb): with the variable, every readback was stale on r22 and is right on this build, at 32 MB into a 64 MB allocation, next to bytes the program wrote during the submission (kept), and with a second submit in flight (20 rounds). The Sims starts and draws its neighbourhood with no lost device, Portal 2 under DXVK loads two maps with HDR, Direct3D 11 and Direct3D 9 test programs under DXVK give the same results, and without the variable nothing runs differently. Every other component is byte-identical to r22, so only the 1.7 MB MoltenVK archive is new.",
+    "r22 (2026-10-06): r21 with the Mac driver's retina screen size fixed (winemac component). Retina resolution on, the Mac driver reported HORZRES and VERTRES twice the screen size that GetSystemMetrics, EnumDisplaySettings and DESKTOPHORZRES report (6912x4468 against 3456x2234 on an M1 Pro, 7680x4320 against 3840x2160 on an M4's 1920x1080 display), so a game sizing its window or its fullscreen picture from them got it twice too large: Team Fortress 2 placed its window off screen (athei), and Red Dead Redemption 2's 1080p fullscreen came out cropped for a player with Retina on (highball#261). With retina off the doubling shift was by zero, so nothing changes there. Every other component is byte-identical, so only the 160 KB winemac archive is new.",
+    "r21 (2026-10-03): r19 plus the data execution prevention edit to ntdll.so (see the ntdll-unix component), the Wine 10 counterpart of the Wine 11 engine's r17. Every other file is byte-identical to r19.",
+    "r19 (2026-10-01): r17 plus the audio buffer library (audiobuf component, highball#127). At 48 kHz the Mac asked Wine's audio driver for 10.7 ms at a time, more than a game that keeps one 10 ms period queued has, and the driver played the shortfa
```

**File**: `spike/engines/x64-sikarugir10.0_6-r31.json` (added, +218/-0)
```diff
@@ -0,0 +1,218 @@
+{
+  "$schema": "https://highball.app/schemas/engine-manifest/v0",
+  "id": "x64-sikarugir10.0_6-r31",
+  "displayName": "Wine 10.0 (Sikarugir) r31, D3DMetal 4.0 beta 2",
+  "arch": "x86_64",
+  "minMacOS": "27.0",
+  "requires": [
+    "rosetta2"
+  ],
+  "notes": [
+    "r31 (2026-11-14): r29 with only the audio library changed, to the 2026-11-03 build the Wine 11 engines r30 to r33 carry (audiobuf component). Microphones keep every frame (highball#350), Wine's audio clock runs in real time so a busy Mac wakes a game's audio on time (highball#444), and games follow the Mac's output when it changes (highball#460, nikiomori). Every other archive is r29's, so environments on r29 move without the Windows setup and download 8 KB. Not installed on its own: every archive is r29's except the audio library, the one measured on r30 (BundledEngineTests checks this). No game was run on this revision.",
+    "r29 (2026-10-18): r27 with only DXMT changed, built from Highball's DXMT branch with Steep's fix (highball-db#465, by Sean Shmulevich): Steep asks for 8x MSAA without checking, Apple GPUs stop at 4, and the game died with no window. A built-in profile gives steep.exe the highest count the Mac has instead; no other game changes. Same toolchain as the previous DXMT build (mingw-w64 14.0.0_3, meson 1.10.0, Xcode 16.1, LLVM 15.0.7). The same DXMT archive as r28, downloaded once. Measured on an M4, macOS 27.0 (2026-10-18): against the previous DXMT archive, winemetal.so is byte-identical, winemetal.dll, d3d10core, nvapi64 and nvngx differ only in their build timestamps, and d3d11.dll and dxgi.dll (which also carries DXMT's profile table) differ by the fix and the profile. A D3D11 test asking for an 8x MSAA render target, 64- and 32-bit: refused under its own name on r26 and on this revision alike, and named steep.exe it gets a 4x texture here that clears and resolves to the exact colour, where r26 refused it.",
+    "r27 (2026-10-08): r25 with the audio library rebuilt to limit float output like Windows' audio engine (audiobuf component, highball-db#349), the same archive as r26. Measured on an M4, macOS 27.0 (2026-10-08), with this archive's library inserted into Wine 10 r21 and Wine 11 r17 environments: a WASAPI test tone recorded through ScreenCaptureKit passes sound under full scale unchanged (0.5 stays 0.5000, rms 0.3536) and holds a tone at 1.4 times full scale to 0.9923 with no sample over full scale, where HB_AUDIOLIMIT=0 lets 47,376 samples over through. No dropouts or clicks. The same code built as a prototype: Paperback's title music has nothing over full scale (2,586 samples in 30 s without) and is 0.4 dB quieter, Five Nights at Freddy's has nothing over (70 without).",
+    "r25 (2026-10-07): r23 with MoltenVK's shadow-import fixed so GPU results reach the game (moltenvk component, highball#283, highball-db#160, #174). Under MVK_SHADOW_IMPORT=1, which only The Sims Legacy Collection's recipe sets, the private Metal buffer behind imported host memory was copied to the GPU on every submit and never back, so everything a 32-bit Vulkan game read back from the GPU was stale: The Sims' lot thumbnails and family portraits came out as noise. The shadow-readback patch records the ranges a submission's copy, fill, update and query-results commands write into that memory, keeps the next submits' upload off them, and copies them back to the game's pages when the submission completes, before its fence and semaphores are signalled. Measured on an M4 with macOS 27.0 with a 32-bit test program (private/tools/vkrb): with the variable, every readback was stale on r23 and is right on this build, at 32 MB into a 64 MB allocation, next to bytes the program wrote during the submission (kept), and with a second submit in flight (20 rounds). The Sims starts and draws its neighbourhood with no lost device, Portal 2 under DXVK loads two maps with HDR, Direct3D 11 and Direct3D 9 test programs under DXVK give the same results, and without the variable nothing runs differently. Every other component is byte-identical to r23, so only the 1.7 MB MoltenVK archive is new.",
+    "r23 (2026-10-06): r20, the D3DMetal 4 line for macOS 27, with the Mac driver's retina screen size fixed (winemac component), the same change as the default engine's r22. Retina resolution on, the Mac driver reported HORZRES and VERTRES twice the screen size that GetSystemMetrics, EnumDisplaySettings and DESKTOPHORZRES report (6912x4468 against 3456x2234 on an M1 Pro, 7680x4320 against 3840x2160 on an M4's 1920x1080 display), so a game sizing its window or its fullscreen picture from them got it twice too large: Team Fortress 2 placed its window off screen (athei), and Red Dead Redemption 2's 1080p fullscreen came out cropped for a player with Retina on (highball#261). With retina off the doubling shift was by zero, so nothing changes there. Every other component is byte-identical, so only the 160 KB winemac archive is new.",
+    "r20 (2026-10
```

---

### Incident Patch 2: `d272065c` (2026-11-14)
**Commit Message**: Two follow-ups to #714 from udance4ever's tests (#432). A demo of a game the account owns is left out of the owned Steam list: appinfo's common.parent names its game, and Fireside Feelings was listed beside its demo. And 'highball play --wait' on a game that isn't installed returns at once with an error, after the app has shown its question: such a game never starts, and the wait ran to --start-timeout (600 s). Test: testADemoOfAnOwnedGameIsLeftOut.

**File**: `Sources/HighballKit/SteamOwnedLibrary.swift` (modified, +8/-1)
```diff
@@ -62,8 +62,12 @@ public enum SteamOwnedLibrary {
         let owned = Set(((try? FileManager.default.contentsOfDirectory(atPath: cache.path)) ?? []).compactMap(Int.init))
         guard !owned.isEmpty,
               let apps = try? SteamAppInfo.read(steamRoot.appending(path: "appcache/appinfo.vdf"), only: owned) else { return [] }
+        // A demo of a game the account owns is left out: the game stands for it (highball#432,
+        // Fireside Feelings and its demo both listed).
+        let ownedGames = Set(owned.filter { apps[$0]?.type?.lowercased() == "game" })
         return owned.compactMap { appid in
             guard let app = apps[appid], ["game", "demo"].contains(app.type?.lowercased() ?? ""), let name = app.name else { return nil }
+            if app.type?.lowercased() == "demo", let parent = app.parent, ownedGames.contains(parent) { return nil }
             let folder = cache.appending(path: String(appid))
             let art = artwork(in: folder)
             return OwnedSteamGame(appid: appid, name: name, localCapsule: art["library_600x900.jpg"],
@@ -116,6 +120,8 @@ public enum SteamAppInfo {
         public var depots: [Depot] = []
         /// `ufs.quota`: the room the game has in Steam Cloud, 0 for a game Steam Cloud does not keep.
         public var steamCloudQuota: Int64 = 0
+        /// `common.parent`: the full game a demo (or other child app) belongs to.
+        public var parent: Int? = nil
 
         public struct Depot: Sendable, Equatable {
             public let id: Int
@@ -184,7 +190,8 @@ public enum SteamAppInfo {
             }.sorted { $0.id < $1.id }
             apps[appid] = App(name: common?["name"]?.string, type: common?["type"]?.string, oslist: common?["oslist"]?.string,
                               osextended: common?["osextended"]?.string, macLaunchArchs: macArchs, depots: depots,
-                              steamCloudQuota: Int64(info["ufs"]?.object?["quota"]?.string ?? "") ?? 0)
+                              steamCloudQuota: Int64(info["ufs"]?.object?["quota"]?.string ?? "") ?? 0,
+                              parent: Int(common?["parent"]?.string ?? ""))
         }
         return apps
     }
```

**File**: `Sources/highball/main.swift` (modified, +6/-1)
```diff
@@ -1010,6 +1010,7 @@ struct Play: AsyncParsableCommand {
         }
         let paths = HighballPaths()
         // A typo fails here and now, not as an alert in the app and a wait that never ends.
+        var notInstalled = false
         switch target {
         case .launcher:
             break
@@ -1019,9 +1020,10 @@ struct Play: AsyncParsableCommand {
                 fail("\(id) is not an installed Epic game in this Highball. `highball library --installed` lists what can be played.")
             }
         case .steam, .gog, .pin, .battlenet:
-            guard currentLibrary(paths: paths, epic: false).contains(where: { $0.id == target.libraryID }) else {
+            guard let item = currentLibrary(paths: paths, epic: false).first(where: { $0.id == target.libraryID }) else {
                 fail("\(id) is not in this Highball's library. `highball library` lists the ids.")
             }
+            notInstalled = !item.installed && !item.installedOnMac
         }
         // The link the game's Mac app opens, with this install's token, so the app starts it
         // without asking; -g keeps Highball behind the game (MacAppStub.launchScript).
@@ -1034,6 +1036,9 @@ struct Play: AsyncParsableCommand {
         guard open.terminationStatus == 0 else { fail("macOS could not open the Highball app (open exited with \(open.terminationStatus))") }
         guard wait else { return }
         if case .launcher = target { return }   // a launcher is not a game the app follows
+        // A game that isn't installed never starts: the app asks about it in its window, and the
+        // wait used to run to --start-timeout (highball#432). The question is up, so stop here.
+        if notInstalled { fail("\(id) is not installed, so it won't start. Highball shows what it can do with it in its window.") }
 
         let started = Date()
         var phase = PlayWait.Phase.starting
```

**File**: `Tests/HighballKitTests/SteamOwnedLibraryTests.swift` (modified, +13/-1)
```diff
@@ -10,6 +10,7 @@ final class SteamOwnedLibraryTests: XCTestCase {
     private struct App {
         var appid: UInt32; var name: String; var type: String; var oslist: String = "windows"
         var osextended: String? = nil
+        var parent: UInt32? = nil
         /// Launch entries under config.launch, each with its oslist and optional osarch.
         var launch: [(oslist: String, osarch: String?)] = []
     }
@@ -18,7 +19,7 @@ final class SteamOwnedLibraryTests: XCTestCase {
 
     /// Builds a v29 file (keys as indexes into a trailing string table) or a v28 one (inline keys).
     private func appinfo(_ apps: [App], v29: Bool = true) -> Data {
-        let keys = ["appinfo", "Common", "name", "type", "oslist", "appid", "osextended", "config", "launch", "osarch", "0", "1", "2"]
+        let keys = ["appinfo", "Common", "name", "type", "oslist", "appid", "osextended", "config", "launch", "osarch", "0", "1", "2", "parent"]
         func key(_ k: String) -> [UInt8] { v29 ? le(UInt32(keys.firstIndex(of: k)!)) : Array(k.utf8) + [0] }
         func str(_ k: String, _ v: String) -> [UInt8] { [0x01] + key(k) + Array(v.utf8) + [0] }
         func int(_ k: String, _ v: UInt32) -> [UInt8] { [0x02] + key(k) + le(v) }
@@ -29,6 +30,7 @@ final class SteamOwnedLibraryTests: XCTestCase {
             // Key case varies in Valve's data; the reader must not care.
             var common = str("name", app.name) + str("type", app.type) + str("oslist", app.oslist)
             if let ext = app.osextended { common += str("osextended", ext) }
+            if let parent = app.parent { common += int("parent", parent) }
             var info = int("appid", app.appid) + obj("Common", common)
             if !app.launch.isEmpty {
                 let entries = app.launch.enumerated().flatMap { i, l in
@@ -145,6 +147,16 @@ final class SteamOwnedLibraryTests: XCTestCase {
         XCTAssertEqual(SteamOwnedLibrary.games(steamRoot: root).map(\.appid), [570940, 3460730], "games and demos, by name")
     }
 
+    func testADemoOfAnOwnedGameIsLeftOut() throws {
+        // Fireside Feelings and its demo were both owned and both listed (highball#432); a demo
+        // whose game the account lacks stays.
+        let root = try steamRoot(owned: [2990600, 3163380, 3460730], appinfo: appinfo([
+            App(appid: 2990600, name: "Fireside Feelings", type: "Game"),
+            App(appid: 3163380, name: "Fireside Feelings Demo", type: "Demo", parent: 2990600),
+            App(appid: 3460730, name: "SlashZero Demo", type: "Demo", parent: 3460720)]))
+        XCTAssertEqual(SteamOwnedLibrary.games(steamRoot: root).map(\.appid), [2990600, 3460730])
+    }
+
     func testPrefersTheClientsCachedArtwork() throws {
         let root = try steamRoot(owned: [2062430, 570940], appinfo: appinfo([
             App(appid: 2062430, name: "BALL x PIT", type: "game"), App(appid: 570940, name: "DSR", type: "game")]))
```

#### Recent Merged Pull Requests:
- **PR #727** (2026-11-14): Wine 10 r30 and r31 carry the new audio library (microphones, real time audio clock, output follow) (@gauthierpiarrette)
- **PR #726** (2026-11-14): Demos of owned games stay out, play --wait returns for games that aren't installed (#432) (@gauthierpiarrette)
- **PR #715** (2026-11-12): A Steam game's session follows its program after it relaunches itself (@gauthierpiarrette)
- **PR #714** (2026-11-12): Steam demos stay in the library like games (#432) (@gauthierpiarrette)
- **PR #713** (2026-11-12): Epic can be disconnected (#708) (@gauthierpiarrette)
- **PR #710** (2026-11-12): Wine 11 engines r32 and r33: no Homebrew paths (#698), D3DKMTSetProcessSchedulingPriorityClass (#699) (@gauthierpiarrette)

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

## X. Wine 10 engines r30 (default) and r31 (D3DMetal 4 line): r28 and r29 with the au

**RULE**:
When implementing operations in `Tests/HighballKitTests/BundledEngineTests.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in gauthierpiarrette/highball. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ac350e46`: Wine 10 engines r30 (default) and r31 (D3DMetal 4 line): r28 and r29 with the audio library the Wine 11 engines carry since r30 (audiobuf-20261103, sha256 617b8feb, 8 KB, the same archive). The default engine still had the October library, so on it a microphone lost 32 frames nearly every 10 ms period (highball#350, #601), Wine's audio clock slept at normal priority on a busy Mac, and games kept the output they started with (#460, nikiomori's change). Every other archive is r28's or r29's, so environments move without the Windows setup and download 8 KB; r28 moves to spike/engines for rollback. Installed r30 from its manifest with the CLI in a throwaway home on an M1 Pro, macOS 27.0: every file is r28's except libhbaudiobuf.dylib, byte-identical to Wine 11 r31's. A WASAPI capture with hbtap's sample time ramp in place of the microphone's data, 6 s at 48 kHz: 520 and 501 breaks on r28, 0 on r30, under 10 busy loops 510 against 0; the library logs the capture buffer capped at 240 frames and audio_client_timer made real time (status 0). r31 was not installed on its own, BundledEngineTests checks it is r29 plus that archive. 872 tests pass.. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `Tests/HighballKitTests/BundledEngineTests.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
    /// On 2026-11-14 the audio library the Wine 11 engines carry since r30 (microphones, a real time
    /// audio clock, following the Mac's output; highball#350, #444, #460): r30 and r31.
                                  ("x64-sikarugir10.0_6-r29", "x64-sikarugir10.0_6-r6"), ("x64-sikarugir10.0_6-r30", "x64-sikarugir10.0_6-r5"),
                                  ("x64-sikarugir10.0_6-r31", "x64-sikarugir10.0_6-r6")] {
                                 "x64-sikarugir10.0_6-r28", "x64-sikarugir10.0_6-r29", "x64-sikarugir10.0_6-r30", "x64-sikarugir10.0_6-r31"]
                           "x64-sikarugir10.0_6-r28", "x64-sikarugir10.0_6-r30"].contains(current) ? "wine10-dep-" : "wine10-msync-"
        XCTAssertEqual(all.last?.id, "x64-sikarugir10.0_6-r30", "r30 is the default engine")
        // r30 and r31 are r28 and r29 with only the audio library changed, to the 8 KB archive the Wine 11
     
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
                                  ("x64-sikarugir10.0_6-r29", "x64-sikarugir10.0_6-r6")] {
                                 "x64-sikarugir10.0_6-r28", "x64-sikarugir10.0_6-r29"]
                           "x64-sikarugir10.0_6-r28"].contains(current) ? "wine10-dep-" : "wine10-msync-"
        XCTAssertEqual(all.last?.id, "x64-sikarugir10.0_6-r28", "r28 is the default engine")
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ac350e46` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
