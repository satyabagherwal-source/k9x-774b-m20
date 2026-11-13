# Verification Protocol: Verification Protocol: Empirical Defect Shield for String)? {

<!-- PROVENANCE_START
{
  "source_repository": "String)? {",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T12:39:41.067Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-REEXTRACT-string",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [String)? {](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T12:39:41.067Z`  
> **Learning ID**: `LEARN-REEXTRACT-string`


## 1. Scope & Verification Target
- **Target Repository**: `String)? {` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/jarvis322-macos-sysdata-learnings.md`  
> **Source**: github ([https://github.com/Jarvis322/macos-sysdata](https://github.com/Jarvis322/macos-sysdata))  
> **Source Version**: `bcfd205a`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-08T04:26:47.825Z  
> **Learning ID**: `learn-github-jarvis322-macos-sysdata`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): Jarvis322/macos-sysdata

> **Canonical Artifact**: `07_PROJECT_LEARNING/jarvis322-macos-sysdata-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Jarvis322/macos-sysdata](https://github.com/Jarvis322/macos-sysdata))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-08T04:26:47.554Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Jarvis322/macos-sysdata`
- **Description**: See what is really inside macOS System Data and delete it item by item. A free menu bar app that explains every category and shows each command before it runs.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2032 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Package.swift`
```
// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "SysDataMenu",
    defaultLocalization: "en",
    platforms: [.macOS(.v14)],
    targets: [
        .target(
            name: "WidgetSnapshot",
            path: "Sources/WidgetSnapshot"
        ),
        // The desktop widget. Built as an executable and packed into the app
        // as PlugIns/SysDataWidget.appex by scripts/build-app.sh, since SwiftPM
        // has no app-extension product.
        .executableTarget(
            name: "SysDataWidget",
            dependencies: ["WidgetSnapshot"],
            path: "Sources/SysDataWidget"
        ),
        .executableTarget(
            name: "SysDataMenu",
            dependencies: ["WidgetSnapshot"],
            path: "Sources/SysDataMenu",
            // The catalogue is the source the .lproj tables are generated
            // from, not a resource. Xcode's build system, which the universal
            // build uses, compiles it into the same files scripts/compile-
            // strings.sh already produced, and the two collide.
            exclude: ["Resources/Localizable.xcstrings"],
            resources: [.process("Resources")]
        ),
        .testTarget(
            name: "SysDataMenuTests",
            dependencies: ["SysDataMenu"],
            path: "Tests/SysDataMenuTests"
        ),
    ]
)

```

### Core Architecture Module: `Sources/SysDataMenu/Intents/ShortcutsIntents.swift`
```
import AppIntents
import Foundation

/// Frees the Safe, password-free items — the same set the low-space button
/// frees — so the clean can run on a schedule from Shortcuts. Nothing that
/// needs review or a password is ever in it, which is what makes it fit to
/// run without anyone watching.
struct FreeSafeItemsIntent: AppIntent {
    static let title: LocalizedStringResource = "Free Safe Items"
    static let description = IntentDescription(
        "Scans System Data and deletes the items marked Safe — caches that regenerate on their own. Nothing that needs review or a password is touched."
    )

    @MainActor
    func perform() async throws -> some IntentResult & ReturnsValue<Int> & ProvidesDialog {
        // Inside the running app, the app's own model: the list and the
        // widget then show what the Shortcut freed instead of going stale.
        let model = MainWindow.shared.model ?? ScanModel(scansAutomatically: false)
        await model.scan()
        // `scan()` returns at once when one is already under way, and the
        // list it is building is not the whole picture yet.
        guard !model.isScanning else {
            return .result(value: 0, dialog: "System Data Unpacked is still scanning. Try again when it finishes.")
        }
        let before = model.reclaimedBytes
        await model.reclaimSafeNow()
        let freed = model.reclaimedBytes - before
        return .result(value: Int(freed), dialog: "Freed \(freed.byteString).")
    }
}

/// System Data's current size, for a shortcut that decides what to do next.
struct SystemDataSizeIntent: AppIntent {
    static let title: LocalizedStringResource = "Get System Data Size"
    static let description = IntentDescription("Scans and returns how much System Data this app found, in bytes.")

    @MainActor
    func perform() async throws -> some IntentResult & ReturnsValue<Int> & ProvidesDialog {
        let model = ScanModel(scansAutomatically: false)
        await model.scan()
        return .result(value: Int(model.measuredBytes), dialog: "System Data: \(model.measuredBytes.byteString).")
    }
}

struct SystemDataShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: FreeSafeItemsIntent(),
            phrases: ["Free safe items with \(.applicationName)"],
            shortTitle: "Free Safe Items",
            systemImageName: "internaldrive"
        )
        AppShortcut(
            intent: SystemDataSizeIntent(),
            phrases: ["How much System Data in \(.applicationName)"],
            shortTitle: "System Data Size",
            systemImageName: "chart.bar"
        )
    }
}

```

### Core Architecture Module: `Sources/SysDataMenu/Model/ProjectFootprint.swift`
```
import Foundation

/// Everything one project costs on this disk, gathered from wherever the scan
/// found it: its own build folders, and its folder in DerivedData.
///
/// Every tool lists those places one at a time, so the question people
/// actually have — what is this old project still costing me — was left to
/// arithmetic. Only what the project's build recreates is counted here; its
/// source files are never an item, so archiving one can never touch them.
struct ProjectFootprint: Identifiable, Sendable {
    let folder: URL
    let items: [StorageItem]
    /// Whether the project folder is still there. DerivedData outlives the
    /// projects it was built for, and one whose project is gone is pure
    /// waste. Read once when grouping, not on every redraw.
    let exists: Bool
    /// How much its build output grew since a scan about a week old, from the
    /// items both scans measured; nil when the history does not reach back.
    var weeklyGrowth: Int64? = nil
    /// Whether any of its build output was written in the past week: it is
    /// being built, and an archive holds only until the next build. Read from
    /// the newest file the scan already found inside each build folder.
    var builtRecently = false

    var id: String { folder.path }
    var name: String { folder.lastPathComponent }
    var totalBytes: Int64 { items.reduce(0) { $0 + ($1.sizeBytes ?? 0) } }
    /// The newest activity any of its items saw. Items are dated by the
    /// project's own files, so this is when someone last worked on it.
    var lastActivity: Date? { items.compactMap(\.lastModified).max() }

    var idleDays: Int? {
        guard let lastActivity else { return nil }
        return Calendar.current.dateComponents([.day], from: lastActivity, to: .now).day.map { max($0, 0) }
    }

    /// The items an archive deletes: all of them but anything that can only
    /// be done by hand.
    var archivableItems: [StorageItem] { items.filter { !$0.action.isManual } }

    /// Largest first; a project with a single tiny build folder is still a
    /// project, and dropping it would hide a place the person may look for.
    static let recentBuildDays = 7

    static func group(
        _ items: [StorageItem], changes: [String: Int64] = [:], now: Date = .now
    ) -> [ProjectFootprint] {
        let recent = now.addingTimeInterval(-Double(recentBuildDays) * 86_400)
        return Dictionary(grouping: items.filter { $0.project != nil }) { $0.project!.standardizedFileURL.path }
            .map { path, items in
                let folder = URL(fileURLWithPath: path)
                let known = items.compactMap { changes[$0.id] }
                return ProjectFootprint(
                    folder: folder,
                    items: items.sorted { ($0.sizeBytes ?? 0) > ($1.sizeBytes ?? 0) },
                    exists: folder.exists,
                    weeklyGrowth: known.isEmpty ? nil : known.reduce(0, +),
                    builtRecently: items.contains { ($0.builtAt ?? .distantPast) > recent }
                )
            }
            .sorted { $0.totalBytes > $1.totalBytes }
    }
}

extension StorageItem {
    /// What this item is within its project, for a project's breakdown:
    /// "node_modules", ".next", "DerivedData", "Docker images".
    var partName: String {
        if category == .xcode { return "DerivedData" }
        if category == .docker { return name.components(separatedBy: ":").first ?? name }
        return revealURL?.lastPathComponent ?? name
    }
}

```

### Core Architecture Module: `Sources/SysDataMenu/Model/ScanModel.swift`
```
import Foundation
import WidgetKit
import WidgetSnapshot
import Observation
import ServiceManagement

@MainActor
@Observable
final class ScanModel {
    private(set) var items: [StorageItem] = []
    private(set) var isScanning = false
    private(set) var hasScanned = false
    private(set) var freeBytes: Int64 = DiskSize.freeSpace()
    private(set) var capacityBytes: Int64 = DiskSize.capacity()
    private(set) var reclaimedBytes: Int64 = 0
    private(set) var busyItemIDs: Set<String> = []
    /// Short description of what the scan is doing right now.
    private(set) var phase = ""
    /// How far through the probes the scan is. The window shows the count
    /// because the first scan on a full disk takes long enough that silence
    /// reads as a hang.
    private(set) var probesFinished = 0
    private(set) var probesTotal = 0
    private(set) var hasFullDiskAccess = ScanModel.checkFullDiskAccess()
    private(set) var launchesAtLogin = SMAppService.mainApp.status == .enabled
    var shutsDownSimulatorsAtPowerOff = PowerOffGuard.isEnabled {
        didSet { PowerOffGuard.isEnabled = shutsDownSimulatorsAtPowerOff }
    }
    private(set) var purgeableBytes: Int64 = DiskSize.purgeableSpace()
    private(set) var lastScan: Date?
    /// Items the user chose not to see again. Persisted; ids are path-based.
    private(set) var hiddenIDs: Set<String>
    var selectedIDs: Set<String> = []
    /// Narrows the list to matching items. The selection survives it: ticking
    /// "Select safe" and then typing a filter to untick two of them is the
    /// obvious way to use the two together, and dropping the selection on the
    /// first keystroke made that impossible.
    ///
    /// What the selection must never do is act on rows nobody can see, so the
    /// footer says how many of them the filter is hiding instead
    /// (`selectedHiddenByFilterCount`). The shift-click anchor is dropped,
    /// because the row it measures from may no longer be listed.
    var filterText = "" {
        didSet {
            guard filterText != oldValue else { return }
            selectionAnchorID = nil
        }
    }
    /// Categories folded shut. It lives here rather than in the view because
    /// it decides the same thing the filter does — what is on screen — and the
    /// selection rules are written in terms of that.
    var collapsedCategories: Set<StorageCategory> = [] {
        didSet {
            guard collapsedCategories != oldValue else { return }
            selectionAnchorID = nil
        }
    }
    /// Where a shift-click measures its range from.
    private var selectionAnchorID: String?
    /// What previous scans and deletions recorded. Read once per scan rather
    /// than per row, because the list redraws far more often than it changes.
    private(set) var history = ScanHistory.load()
    /// Whether scans and deletions are written down at all. On by default:
    /// the app already knows everything the log holds, and without it the
    /// list cannot say anything about change. Turning it off deletes the file.
    var keepsHistory: Bool = UserDefaults.standard.object(forKey: ScanModel.historyKey) as? Bool ?? true {
        didSet {
            UserDefaults.standard.set(keepsHistory, forKey: Self.historyKey)
            if !keepsHistory {
                ScanHistory.forget()
                history = ScanHistory.Log()
            }
        }
    }
    /// What the rows inside a category are ordered by. Size answers "what is
    /// big"; age answers "what is dead". Sorting by age and shift-clicking a
    /// range is how the untouched things get selected, which is safer than a
    /// button that ticks them all on the person's behalf.
    var sortOrder: SortOrder = SortOrder(rawValue: UserDefaults.standard.string(forKey: ScanModel.sortKey) ?? "") ?? .size {
        didSet { UserDefaults.standard.set(sortOrder.rawValue, forKey: Self.sortKey) }
    }
    /// Whether the app puts an icon in the menu bar at all. With it off the
    /// app lives in its window, and the Dock is what reopens it.
    var showsMenuBarIcon: Bool = UserDefaults.standard.object(forKey: ScanModel.menuBarIconKey) as? Bool ?? true {
        didSet { UserDefaults.standard.set(showsMenuBarIcon, forKey: Self.menuBarIconKey) }
    }
    /// What the menu bar shows at rest.
    var menuBarContent: MenuBarContent = MenuBarContent(rawValue: UserDefaults.standard.string(forKey: ScanModel.menuBarKey) ?? "") ?? .systemData {
        didSet { UserDefaults.standard.set(menuBarContent.rawValue, forKey: Self.menuBarKey) }
    }
    /// Send Safe items to the Trash instead of deleting them outright, so a
    /// delete can be undone until the Trash is emptied. Off by default: Safe
    /// items regenerate, and trashing them frees no space until the Trash goes.
    var movesSafeToTrash: Bool = UserDefaults.standard.bool(forKey: ScanModel.safeToTrashKey) {
        didSet { UserDefaults.standard.set(movesSafeToTrash, forKey: Self.safeToTrashKey) }
    }
    /// Ask for Touch ID, an Apple Watch or the Mac's password before a delete
    /// confirmed in the window runs. Off by default.
    var requiresAuthenticationToDelete: Bool = UserDefaults.standard.bool(forKey: ScanModel.authenticationKey) {
        didSet { UserDefaults.standard.set(requiresAuthenticationToDelete, forKey: Self.authenticationKey) }
    }
    /// The category a growth notification was about, set when it is opened.
    /// The history view reads it to say which items made that category grow.
    var growthFocus: StorageCategory?
    /// Whether items marked Review are deleted outright instead of going to
    /// the Trash first. Chosen in the confirmation, where it is shown next to
    /// what it does, and remembered. Off by default: the Trash is the undo.
    var deletesReviewItemsImmediately: Bool = UserDefaults.standard.bool(forKey: ScanModel.reviewImmediatelyKey) {
        didSet { UserDefaults.standard.set(deletesReviewItemsImmediately, forKey: Self.reviewImmediatelyKey) }
    }
    /// Also look for projects on plugged-in drives. Off by default.
    var scansExternalDrives: Bool = UserDefaults.standard.bool(forKey: ExternalVolumes.preferenceKey) {
        didSet { UserDefaults.standard.set(scansExternalDrives, forKey: ExternalVolumes.preferenceKey) }
    }
    var errorMessage: String?
    /// Set when a delete gave back less than it removed and local snapshots
    /// are why. The notice explains it; this puts the way out next to it
    /// instead of leaving the person to find the row.
    var offersSnapshotCleanup = false
    /// Failures collected during one batch, shown together when it ends.
    @ObservationIgnored private var failures: [String] = []
    /// Whether anything in this batch was trashed rather than deleted. The
    /// Trash frees nothing until it is emptied, which the notice already says.
    @ObservationIgnored private var anythingWentToTheTrash = false
    /// Items deleted while a scan was still running, kept out of its results.
    @ObservationIgnored private var deletedDuringScan: Set<String> = []
    /// Non-error feedback, such as "moved to the Trash".
    var notice: String?
    /// When each item was last shrunk, so the button does not come back
    /// until the folder has been written to since.
    private var shrunkDates: [String: Date] =
        (UserDefaults.standard.dictionary(forKey: ScanModel.shrunkKey) as? [String: Date]) ?? [:]

    /// False for the headless modes and the Shortcuts actions, which run a
    /// model of their own and must not overwrite what the widget shows.
    @ObservationIgnored private let scansAutomatically: Bool

    private static let hiddenKey = "hiddenItemIDs"
    private static let shrunkKey = "shrunkItemDates"
    private static let sortKey = "sortOrder"
    private static let historyKey = "keepsHistory"
    private static let menuBarKey = "menuBarContent"
    /// Read by the app scene too, which needs `@AppStorage` to notice the
    /// change: an app scene does not track this model the way a view does.
    static let menuBarIconKey = "showsMenuBarIcon"
    private static let safeToTrashKey = "movesSafeToTrash"
    private static let authenticationKey = "requiresAuthenticationToDelete"
    private static let reviewImmediatelyKey = "deletesReviewItemsImmediately"
    private static let rescanInterval: Duration = .seconds(24 * 60 * 60)

    /// `scansAutomatically` is off for the headless modes, which drive the
    /// scan themselves. `items` starts the model on a known list instead of
    /// whichever machine the tests happen to run on.
    init(scansAutomatically: Bool = true, items: [StorageItem] = []) {
        self.scansAutomatically = scansAutomatically
        self.items = items
        hiddenIDs = Set(UserDefaults.standard.stringArray(forKey: Self.hiddenKey) ?? [])
        if scansAutomatically {
            // Before the first scan measures them as part of their folders.
            Task.detached(priority: .utility) { FolderCompression.removeLeftovers() }
            Task { await runBackgroundScans() }
        }
    }

    /// Scans on launch and once a day after that, so the menu bar total is
    /// meaningful without opening the window.
    private func runBackgroundScans() async {
        while !Task.isCancelled {
            await scan(quietly: true)
            // A scan the person started was already running, so this pass
            // found a list still being built. The clean waits for tomorrow
            // rather than act on part of the picture.
            if isScanning {
                try? await Task.sleep(for: Self.rescanInterval)
                continue
            }
            // These run only on the unattended scans, never on a Rescan the
            // person is watching: the weekly note, then the optional automatic
            // clean of the safe subset. Both are no-ops unless switched on.
            await WeeklyDigest.check(log: history)
            await GrowthAlert
```

### Core Architecture Module: `Sources/SysDataMenu/Model/SpacePlan.swift`
```
import Foundation

/// "I need 20 GB": the least worrying set of items that frees that much.
///
/// The list answers what is taking space. The question people arrive with is
/// the other way round — an update needs 14 GB, a video 30 — and answering it
/// by hand means reading two hundred rows and adding them up. The plan does
/// the adding, in the order a careful person would: everything marked Safe
/// first, largest first so it takes the fewest rows; then, only if that is
/// not enough, the Review items that have sat untouched longest, because an
/// item nobody has touched in a year is the cheapest thing to be wrong about.
///
/// It selects. Nothing is deleted by it: the result goes through the same
/// confirmation as any other batch, with every command shown.
struct SpacePlan: Equatable, Sendable {
    let target: Int64
    /// What the plan selects. When the target is out of reach this is only
    /// the Safe items, never everything: a batch of sixty rows including what
    /// was used this morning is not something to pre-select on someone's
    /// behalf for a goal it cannot meet.
    let items: [StorageItem]
    /// Everything this app could free in all, selected or not.
    let available: Int64

    var totalBytes: Int64 { items.reduce(0) { $0 + ($1.sizeBytes ?? 0) } }
    var safeCount: Int { items.filter { $0.safety == .safe }.count }
    var reviewCount: Int { items.count - safeCount }
    /// How far short of the target everything the app could free falls.
    var shortfall: Int64 { max(target - available, 0) }
    var reachesTarget: Bool { target > 0 && totalBytes >= target }

    static func == (lhs: SpacePlan, rhs: SpacePlan) -> Bool {
        lhs.target == rhs.target && lhs.items.map(\.id) == rhs.items.map(\.id)
    }

    /// What may be offered at all: measured, and something this app can
    /// delete. Manual items are instructions, not actions. The Trash is
    /// eligible but always last, because emptying it forgets files for good.
    static func isEligible(_ item: StorageItem) -> Bool {
        guard let bytes = item.sizeBytes, bytes > 0 else { return false }
        return !item.action.isManual && item.safety != .manual
    }

    /// Eligible items in the order they would be taken.
    static func preferenceOrder(_ items: [StorageItem]) -> [StorageItem] {
        func tier(_ item: StorageItem) -> Int {
            if item.category == .trash { return 2 }
            return item.safety == .safe ? 0 : 1
        }
        return items.filter(isEligible).sorted { a, b in
            let (ta, tb) = (tier(a), tier(b))
            if ta != tb { return ta < tb }
            if ta == 1 {
                // Review: longest untouched first. An item with no age is
                // treated as in use, which is the cautious reading.
                let (ia, ib) = (a.idleDays ?? 0, b.idleDays ?? 0)
                if ia != ib { return ia > ib }
            }
            return (a.sizeBytes ?? 0) > (b.sizeBytes ?? 0)
        }
    }

    static func build(freeing target: Int64, from items: [StorageItem]) -> SpacePlan {
        let ordered = preferenceOrder(items)
        let available = ordered.reduce(0) { $0 + ($1.sizeBytes ?? 0) }
        guard target > 0 else { return SpacePlan(target: target, items: [], available: available) }
        guard available >= target else {
            let safe = ordered.filter { $0.safety == .safe && $0.category != .trash }
            return SpacePlan(target: target, items: safe, available: available)
        }

        var chosen: [StorageItem] = []
        var sum: Int64 = 0
        for item in ordered {
            chosen.append(item)
            sum += item.sizeBytes ?? 0
            if sum >= target { break }
        }

        // Taking items in order can overshoot: a small item early on that the
        // large one after it made unnecessary. Drop the least preferred first.
        if sum >= target {
            for item in chosen.reversed() {
                let size = item.sizeBytes ?? 0
                if sum - size >= target {
                    chosen.removeAll { $0.id == item.id }
                    sum -= size
                }
            }
        }
        return SpacePlan(target: target, items: chosen, available: available)
    }
}

```

### Core Architecture Module: `Sources/SysDataMenu/Model/StorageItem.swift`
```
import Foundation

/// Groups in the menu, in display order.
enum StorageCategory: String, CaseIterable, Identifiable, Sendable {
    case snapshots, simulators, runtimes, xcode, packages, tools, ai, logs, temp, docker
    case vms, trash, backups, shared, android, apps, projects, system, other

    var id: String { rawValue }

    var title: String {
        switch self {
        case .snapshots: L("Time Machine snapshots")
        case .simulators: L("Simulator devices")
        case .runtimes: L("Simulator runtimes")
        case .xcode: L("Xcode")
        case .packages: L("Package managers")
        case .tools: L("Developer tool data")
        case .ai: L("AI models and tools")
        case .logs: L("Logs & diagnostics")
        case .temp: L("Temporary files")
        case .docker: L("Docker")
        case .vms: L("Virtual machines")
        case .trash: L("Trash")
        case .backups: L("iOS device backups")
        case .shared: L("Shared & other users")
        case .android: L("Android")
        case .apps: L("App data & caches")
        case .projects: L("Project build folders")
        case .system: L("System")
        case .other: L("Other large folders")
        }
    }
}

/// How much thought a deletion needs. Drives the badge and the confirmation copy.
enum Safety: Sendable {
    /// Regenerated automatically by macOS or the owning tool.
    case safe
    /// Deletable, but the user loses something they may want (a device, a login, a download).
    case review
    /// Cannot be removed by this app; instructions are shown instead.
    case manual

    var label: String {
        switch self {
        case .safe: L("Safe")
        case .review: L("Review")
        case .manual: L("Manual")
        }
    }
}

enum ReclaimAction: Sendable {
    case removePaths([URL])
    case emptyDirectories([URL])
    case pruneOlderThan(URL, days: Int)
    case command(executable: String, arguments: [String])
    case privilegedScript(String)
    /// Shuts every simulator down, ignoring the result. Files a booted
    /// simulator has mapped cannot be deleted, not even by root.
    case shutdownSimulators
    /// Resets one simulator to factory state. It is shut down first, and a
    /// refusal is retried once, because a booted device will not erase.
    case eraseSimulator(udid: String)
    /// Runs several actions in order, stopping at the first failure.
    indirect case steps([ReclaimAction])
    case manual(String)

    /// Whether running it stops simulators that may be in use, which is not
    /// something a run nobody is watching may do.
    var shutsDownSimulators: Bool {
        switch self {
        case .shutdownSimulators, .eraseSimulator: true
        case .steps(let actions): actions.contains(where: \.shutsDownSimulators)
        default: false
        }
    }

    var isManual: Bool {
        if case .manual = self { return true }
        return false
    }

    var manualInstructions: String? {
        if case .manual(let text) = self { return text }
        return nil
    }

    /// Exactly what this action does, one line per operation.
    ///
    /// The README says the source is published so anyone can see what the app
    /// does to their machine. This is that promise inside the app: the person
    /// about to type an administrator password can read the command first,
    /// which is the one moment reading it matters.
    var plan: [String] {
        switch self {
        case .removePaths(let urls):
            urls.map { L("Delete %@", $0.path) }
        case .emptyDirectories(let urls):
            urls.map { L("Delete everything inside %@", $0.path) }
        case .pruneOlderThan(let url, let days):
            [L("Delete files older than %lld days in %@", days, url.path)]
        case .command(let executable, let arguments):
            [([executable] + arguments).joined(separator: " ")]
        case .privilegedScript(let script):
            [L("As administrator: %@", script)]
        case .shutdownSimulators:
            [L("Shut every simulator down first")]
        case .eraseSimulator(let udid):
            ["/usr/bin/xcrun simctl shutdown \(udid)", "/usr/bin/xcrun simctl erase \(udid)"]
        case .steps(let actions):
            actions.flatMap(\.plan)
        case .manual:
            []
        }
    }

    /// Whether running this asks for an administrator password.
    ///
    /// A privileged script always does. So does a plain delete of something
    /// this user cannot unlink: `Reclaimer` falls back to `rm -rf` as root
    /// rather than failing, which is the right behaviour and an invisible one
    /// — the confirmation used to count only the scripts and promise a single
    /// prompt above a batch that would ask several times.
    var needsAdministrator: Bool {
        switch self {
        case .privilegedScript: true
        case .steps(let actions): actions.contains(where: \.needsAdministrator)
        default: !pathsNeedingRoot.isEmpty
        }
    }

    /// Paths this action would have to delete as root, using the same test the
    /// reclaimer uses before it decides.
    var pathsNeedingRoot: [URL] {
        paths.filter { $0.exists && !FileManager.default.isDeletableFile(atPath: $0.path) }
    }

    /// Whether one password prompt covers this action. Privileged scripts in a
    /// batch are folded into a single script; a root-owned path is deleted by
    /// its own `rm`, so each one asks again.
    var asksForThePasswordSeparately: Bool {
        switch self {
        case .privilegedScript: false
        case .steps(let actions): actions.contains(where: \.asksForThePasswordSeparately)
        default: !pathsNeedingRoot.isEmpty
        }
    }

    /// Filesystem locations this action touches.
    var paths: [URL] {
        switch self {
        case .removePaths(let urls), .emptyDirectories(let urls): urls
        case .pruneOlderThan(let url, _): [url]
        case .steps(let actions): actions.flatMap(\.paths)
        case .command, .privilegedScript, .shutdownSimulators, .eraseSimulator, .manual: []
        }
    }
}

struct StorageItem: Identifiable, Sendable {
    let id: String
    let category: StorageCategory
    let name: String
    let detail: String
    /// `nil` when the size cannot be measured (APFS snapshots).
    let sizeBytes: Int64?
    let safety: Safety
    let action: ReclaimAction
    let revealURL: URL?
    /// When anything inside this item last changed. `nil` when the item is not
    /// a place on disk this app measured — a `docker system prune` estimate,
    /// an APFS snapshot — rather than "never used".
    let lastModified: Date?
    /// Locations this item accounts for beyond its action and reveal paths
    /// (for example the second half of the unified log store).
    let alsoClaims: [URL]
    /// The project this item was built for, when it belongs to one: its
    /// node_modules or .build, or its folder in DerivedData. The Projects view
    /// groups by it.
    let project: URL?
    /// For a project's build output, when anything inside it was last
    /// written: the last build. `lastModified` is the project's own activity
    /// instead, so the two answer different questions.
    let builtAt: Date?
    /// The id of a row this one replaced. Someone who hid that row to keep
    /// what was in it — the README suggests it for Ollama models — has hidden
    /// the rows it was split into as well, rather than meeting every one of
    /// them again the day the split shipped.
    let hiddenWith: String?

    init(
        id: String,
        category: StorageCategory,
        name: String,
        detail: String,
        sizeBytes: Int64?,
        safety: Safety,
        action: ReclaimAction,
        revealURL: URL? = nil,
        lastModified: Date? = nil,
        alsoClaims: [URL] = [],
        project: URL? = nil,
        builtAt: Date? = nil,
        hiddenWith: String? = nil
    ) {
        self.id = id
        self.category = category
        self.name = name
        self.detail = detail
        self.sizeBytes = sizeBytes
        self.safety = safety
        self.action = action
        self.revealURL = revealURL
        self.lastModified = lastModified
        self.alsoClaims = alsoClaims
        self.project = project
        self.builtAt = builtAt
        self.hiddenWith = hiddenWith
    }

    /// The same item at a new size, after it was shrunk in place.
    func resized(to bytes: Int64) -> StorageItem {
        StorageItem(
            id: id, category: category, name: name, detail: detail, sizeBytes: bytes,
            safety: safety, action: action, revealURL: revealURL, lastModified: lastModified,
            alsoClaims: alsoClaims, project: project, builtAt: builtAt, hiddenWith: hiddenWith
        )
    }

    /// Whole days since anything inside changed.
    var idleDays: Int? {
        guard let lastModified else { return nil }
        return Calendar.current.dateComponents([.day], from: lastModified, to: .now).day.map { max($0, 0) }
    }

    /// Short "untouched for" phrase, or nil when the item is too recent to be
    /// worth a badge. Below a fortnight the age says nothing useful: a cache
    /// touched yesterday and one touched last week are both simply in use.
    var idleLabel: String? {
        idleDays.flatMap(Self.idlePhrase)
    }

    /// "3 months idle", or nil under a fortnight. Shared with the Projects
    /// view, so a project and its rows describe the same age the same way.
    static func idlePhrase(days: Int) -> String? {
        guard days >= 14 else { return nil }
        let months = days / 30
        let years = days / 365
        if years >= 1 { return years == 1 ? L("1 year idle") : L("%lld years idle", years) }
        if months >= 1 { return months == 1 ? L("1 month idle") : L("%lld months idle", months) }
        return L("%lld days idle", days)
    }

    /// Every location this item accounts for, so the catch-all scan can skip it.
    var claimedURLs: [U
```

### Core Architecture Module: `Sources/SysDataMenu/Probes/AIModelProbes.swift`
```
import Foundation

// MARK: - Downloaded models, one row each

/// Ollama and Hugging Face keep every model in one folder, so the old rows
/// said "Ollama models: 41 GB" and offered to delete all of it. The one-model
/// question people actually have — which of these did I stop using — needs a
/// row per model, and for Ollama a delete that goes through `ollama rm`,
/// because its layers are shared and removing blobs by hand corrupts the rest.
struct AIModelProbe: StorageProbe {
    private static let threshold = 100 * ProbeSupport.megabyte

    func probe() async -> [StorageItem] {
        let environment = ProcessInfo.processInfo.environment
        let ollamaRoot = environment["OLLAMA_MODELS"].map { URL(fileURLWithPath: $0) } ?? .home(".ollama/models")
        let hubRoot = Self.huggingFaceHub(environment: environment)

        var items = Self.ollamaItems(root: ollamaRoot, ollama: Shell.which("ollama"))
        items += await Self.huggingFaceItems(hub: hubRoot)
        items += await Self.aggregateIfUnreadable(items: items, ollamaRoot: ollamaRoot)
        return items.sorted { ($0.sizeBytes ?? 0) > ($1.sizeBytes ?? 0) }
    }

    // MARK: Ollama

    struct OllamaModel: Equatable {
        /// The name `ollama pull` and `ollama rm` take: `llama3:latest`,
        /// `someone/model:tag`, or with the registry when it is not Ollama's.
        let name: String
        /// Bytes that go when this model goes: layers no other model uses.
        let ownBytes: Int64
        let modified: Date?
    }

    struct OllamaLibrary: Equatable {
        let models: [OllamaModel]
        /// Layers two or more models use, counted once. They are freed when
        /// the last of those models is removed.
        let sharedBytes: Int64
    }

    private struct Manifest: Decodable {
        struct Layer: Decodable {
            let digest: String
            let size: Int64
        }
        let config: Layer?
        let layers: [Layer]?
    }

    /// Reads `manifests/<registry>/<namespace>/<model>/<tag>` and sizes each
    /// model from its own manifest, without touching the weights.
    static func readOllamaLibrary(root: URL) -> OllamaLibrary? {
        let manifests = root.appending(path: "manifests")
        guard let walker = FileManager.default.enumerator(
            at: manifests, includingPropertiesForKeys: [.isRegularFileKey, .contentModificationDateKey]
        ) else { return nil }

        var parsed: [(name: String, layers: [Manifest.Layer], modified: Date?)] = []
        for case let file as URL in walker {
            let values = try? file.resourceValues(forKeys: [.isRegularFileKey, .contentModificationDateKey])
            guard values?.isRegularFile == true,
                  let data = try? Data(contentsOf: file),
                  let manifest = try? JSONDecoder().decode(Manifest.self, from: data),
                  let name = ollamaName(components: relativeComponents(of: file, in: manifests))
            else { continue }
            parsed.append((name, (manifest.config.map { [$0] } ?? []) + (manifest.layers ?? []), values?.contentModificationDate))
        }
        guard !parsed.isEmpty else { return nil }

        var users: [String: Int] = [:]
        var sizes: [String: Int64] = [:]
        for model in parsed {
            for layer in Set(model.layers.map(\.digest)) { users[layer, default: 0] += 1 }
            for layer in model.layers { sizes[layer.digest] = layer.size }
        }
        let models = parsed.map { model in
            OllamaModel(
                name: model.name,
                ownBytes: Set(model.layers.map(\.digest)).filter { users[$0] == 1 }.reduce(0) { $0 + (sizes[$1] ?? 0) },
                modified: model.modified
            )
        }
        let shared = users.filter { $0.value > 1 }.keys.reduce(0) { $0 + (sizes[$1] ?? 0) }
        return OllamaLibrary(models: models.sorted { $0.name < $1.name }, sharedBytes: shared)
    }

    private static func relativeComponents(of file: URL, in base: URL) -> [String] {
        let prefix = base.standardizedFileURL.pathComponents
        return Array(file.standardizedFileURL.pathComponents.dropFirst(prefix.count))
    }

    static func ollamaName(components: [String]) -> String? {
        guard components.count >= 4 else { return nil }
        let tag = components[components.count - 1]
        let model = components[components.count - 2]
        let namespace = components[components.count - 3]
        let registry = components.dropLast(3).joined(separator: "/")
        if registry == "registry.ollama.ai" {
            return namespace == "library" ? "\(model):\(tag)" : "\(namespace)/\(model):\(tag)"
        }
        return "\(registry)/\(namespace)/\(model):\(tag)"
    }

    static func ollamaItems(root: URL, ollama: String?) -> [StorageItem] {
        guard let library = readOllamaLibrary(root: root) else { return [] }
        var items: [StorageItem] = library.models.compactMap { model in
            guard model.ownBytes >= threshold else { return nil }
            return StorageItem(
                id: "ai-ollama-\(model.name)", category: .ai, name: "Ollama: \(model.name)",
                detail: ollama == nil
                    ? "Run `ollama rm \(model.name)`. `ollama pull \(model.name)` fetches it again."
                    : "Removed with `ollama rm`, which needs Ollama running. `ollama pull \(model.name)` fetches it again.",
                sizeBytes: model.ownBytes, safety: ollama == nil ? .manual : .review,
                action: ollama.map { .command(executable: $0, arguments: ["rm", model.name]) }
                    ?? .manual("ollama rm \(model.name)"),
                revealURL: root, lastModified: model.modified, hiddenWith: "tool-.ollama/models"
            )
        }
        if library.sharedBytes >= threshold {
            items.append(StorageItem(
                id: "ai-ollama-shared", category: .ai, name: "Ollama: layers shared by several models",
                detail: "Freed on their own when the last model that uses them is removed.",
                sizeBytes: library.sharedBytes, safety: .manual,
                action: .manual("Remove the models that use these layers with `ollama rm`."),
                revealURL: root, hiddenWith: "tool-.ollama/models"
            ))
        }
        return items
    }

    // MARK: Hugging Face

    static func huggingFaceHub(environment: [String: String]) -> URL {
        if let hub = environment["HF_HUB_CACHE"] { return URL(fileURLWithPath: hub) }
        if let home = environment["HF_HOME"] { return URL(fileURLWithPath: home).appending(path: "hub") }
        return .home(".cache/huggingface/hub")
    }

    /// `models--meta-llama--Llama-3` is the repository `meta-llama/Llama-3`;
    /// `datasets--` and `spaces--` are kept apart from models by their prefix.
    static func huggingFaceName(folder: String) -> (kind: String, repository: String)? {
        for kind in ["models", "datasets", "spaces"] where folder.hasPrefix("\(kind)--") {
            let repository = folder.dropFirst(kind.count + 2).replacingOccurrences(of: "--", with: "/")
            guard !repository.isEmpty else { return nil }
            return (String(kind.dropLast()), repository)
        }
        return nil
    }

    static func huggingFaceItems(hub: URL) async -> [StorageItem] {
        var items: [StorageItem] = []
        for folder in hub.children(includeHidden: false) where folder.isDirectory {
            guard let name = huggingFaceName(folder: folder.lastPathComponent),
                  let item = await ProbeSupport.directoryItem(
                    id: "ai-hf-\(folder.lastPathComponent)", category: .ai,
                    name: "Hugging Face \(name.kind): \(name.repository)",
                    detail: "Downloaded from Hugging Face. It is fetched again the next time a program asks for it.",
                    url: folder, safety: .review, action: .removePaths([folder]), minimumBytes: threshold
                  )
            else { continue }
            items.append(StorageItem(
                id: item.id, category: item.category, name: item.name, detail: item.detail,
                sizeBytes: item.sizeBytes, safety: item.safety, action: item.action,
                revealURL: item.revealURL, lastModified: item.lastModified,
                hiddenWith: "tool-.cache/huggingface"
            ))
        }
        let xet = hub.deletingLastPathComponent().appending(path: "xet")
        if let item = await ProbeSupport.directoryItem(
            id: "ai-hf-xet", category: .ai, name: "Hugging Face download chunks",
            detail: "Chunks kept to speed up downloads. Fetched again when needed.",
            url: xet, safety: .review, action: .removePaths([xet]), minimumBytes: threshold
        ) {
            items.append(item)
        }
        return items
    }

    // MARK: Fallback

    /// The folders used to be one row each. If a layout this probe does not
    /// understand left a large folder with no rows at all, the whole folder is
    /// reported again, so a change in either tool never hides gigabytes.
    private static func aggregateIfUnreadable(items: [StorageItem], ollamaRoot: URL) async -> [StorageItem] {
        var extra: [StorageItem] = []
        if !items.contains(where: { $0.id.hasPrefix("ai-ollama") }),
           let item = await ProbeSupport.directoryItem(
            id: "tool-.ollama/models", category: .ai, name: "Ollama models",
            detail: "Downloaded LLM weights. `ollama pull` fetches them again.",
            url: ollamaRoot, safety: .review, action: .removePaths([ollamaRoot]), minimumBytes: 10 * ProbeSupport.megabyte
           ) {
            extra.append(item)
        }
        let huggingFace = URL.home(".cache/huggingface")
        if !items.contains(where: { $0.id.hasPrefix("ai-hf") }),
           let item = await ProbeSupport.directoryItem(
            id: "tool-.cache/huggingface", category: .ai, name: "Huggin
```

### Core Architecture Module: `Sources/SysDataMenu/Probes/CatchAllProbes.swift`
```
import Foundation

// MARK: - Developer tool data in hidden home folders

/// Version managers, model caches and language toolchains that hide in
/// dot-folders. Known ones get a name and a safety level; anything else over
/// the threshold is listed generically so nothing large stays invisible.
struct DeveloperToolProbe: StorageProbe {
    private struct Known {
        let path: String
        let name: String
        let detail: String
        let safety: Safety
        /// Tool whose own clean command should be used, if installed.
        let tool: (name: String, arguments: [String])?
        let category: StorageCategory
        /// False when `AIModelProbe` reports the folder model by model. The
        /// folder is still claimed, so the catch-all does not list it again.
        let reports: Bool

        init(_ path: String, _ name: String, _ detail: String, _ safety: Safety,
             tool: (name: String, arguments: [String])? = nil,
             category: StorageCategory = .tools, reports: Bool = true) {
            self.path = path
            self.name = name
            self.detail = detail
            self.safety = safety
            self.tool = tool
            self.category = category
            self.reports = reports
        }
    }

    private static let known: [Known] = [
        Known(".ollama/models", "Ollama models", "Downloaded LLM weights. `ollama pull` fetches them again.", .review, category: .ai, reports: false),
        Known(".cache/huggingface", "Hugging Face cache", "Downloaded models and datasets.", .review, category: .ai, reports: false),
        Known(".cache/torch", "PyTorch cache", "Downloaded model weights.", .review, category: .ai),
        Known(".lmstudio", "LM Studio models", "Downloaded LLM weights.", .review, category: .ai),
        Known(".nvm/versions", "nvm Node versions", "Every Node.js installed with nvm. `nvm install` again.", .review),
        Known(".rustup/toolchains", "Rust toolchains", "`rustup toolchain install` again.", .review),
        Known(".pyenv/versions", "pyenv Python versions", "`pyenv install` again.", .review),
        Known(".rbenv/versions", "rbenv Ruby versions", "`rbenv install` again.", .review),
        Known(".sdkman/candidates", "SDKMAN toolchains", "`sdk install` again.", .review),
        Known("miniconda3", "Miniconda", "Conda environments and packages.", .review),
        Known("anaconda3", "Anaconda", "Conda environments and packages.", .review),
        Known(".conda/pkgs", "Conda package cache", "Downloaded packages.", .safe, tool: ("conda", ["clean", "--all", "-y"])),
        Known(".m2/repository", "Maven repository", "Downloaded jars. Re-fetched on the next build.", .safe),
        Known(".ivy2", "Ivy cache", "Downloaded jars for sbt.", .safe),
        Known(".cocoapods/repos", "CocoaPods specs repos", "`pod setup` rebuilds them.", .safe),
        Known(".gradle/wrapper/dists", "Gradle distributions", "Downloaded Gradle versions.", .safe),
        Known(".android/cache", "Android SDK download cache", "Re-downloaded on demand.", .safe),
        Known("go/pkg/mod", "Go module cache", "Downloaded modules.", .safe, tool: ("go", ["clean", "-modcache"])),
        Known(".bun/install/cache", "Bun cache", "Package tarballs.", .safe),
        // Found unexplained under "Other large folders" at 0.8 GB. `npm cache
        // clean` does not touch it.
        Known(".npm/_npx", "npx cache", "Packages npx downloaded to run once. npx fetches them again the next time.", .safe),
        Known(".deno", "Deno cache", "Cached modules.", .safe),
        Known(".vscode/extensions", "VS Code extensions", "Installed extensions. Reinstall from the marketplace.", .review),
        Known(".cursor/extensions", "Cursor extensions", "Installed extensions.", .review),
        Known(".docker", "Docker CLI data", "Contexts and build history, not images.", .review),
        Known(".orbstack", "OrbStack data", "Virtual machines and containers.", .review),
        Known(".lima", "Lima virtual machines", "VM disks.", .review),
        Known(".colima", "Colima virtual machine", "VM disk.", .review),
        Known(".claude", "Claude Code data", "Session transcripts, memory, plugins and caches. Deleting loses history.", .review, category: .ai),
        Known(".codex", "Codex CLI data", "Sessions and caches.", .review, category: .ai),
        // Reported as unrecognised in issue #1. Named so the list says what
        // made the folder, but left at Review: these hold sessions and signed-in
        // state as often as they hold cache, and none of them is safe to delete
        // unseen.
        Known(".grok", "Grok CLI data", "Sessions, settings and caches. Deleting loses history.", .review, category: .ai),
        Known(".copilot", "GitHub Copilot CLI data", "Sessions, settings and caches. Deleting signs you out.", .review, category: .ai),
        Known(".kilo", "Kilo Code data", "Sessions, settings and caches. Deleting loses history.", .review, category: .ai),
        Known(".gemini", "Gemini CLI data", "Settings and IDE support files.", .review, category: .ai),
        // Same shape as the VS Code and Cursor entries above: almost all of it
        // is installed extensions, which reinstall from the marketplace.
        Known(".antigravity-ide/extensions", "Antigravity extensions", "Installed extensions. Reinstall from the marketplace.", .review),
    ]

    private static func claim(_ entry: Known, into topLevel: inout Set<String>, _ cache: inout Set<String>) {
        let top = entry.path.split(separator: "/").first.map(String.init) ?? entry.path
        topLevel.insert(top)
        if top == ".cache", let sub = entry.path.split(separator: "/").dropFirst().first {
            cache.insert(String(sub))
        }
    }

    /// Top-level dot-folders another probe already reports.
    private static let coveredTopLevel: Set<String> = [
        ".npm", ".cargo", ".Trash", ".android", ".gradle", ".cache",
    ]
    private static let threshold = 100 * ProbeSupport.megabyte

    func probe() async -> [StorageItem] {
        var items: [StorageItem] = []
        var claimedTopLevel: Set<String> = Self.coveredTopLevel
        var claimedCache: Set<String> = ["uv", "huggingface", "torch"]

        for entry in Self.known {
            let url = URL.home(entry.path)
            if !entry.reports {
                Self.claim(entry, into: &claimedTopLevel, &claimedCache)
                continue
            }
            let action: ReclaimAction
            if let tool = entry.tool, let executable = Shell.which(tool.name) {
                action = .command(executable: executable, arguments: tool.arguments)
            } else {
                action = .removePaths([url])
            }
            if let item = await ProbeSupport.directoryItem(
                id: "tool-\(entry.path)", category: entry.category, name: entry.name, detail: entry.detail,
                url: url, safety: entry.safety, action: action, minimumBytes: 10 * ProbeSupport.megabyte
            ) {
                items.append(item)
            }
            Self.claim(entry, into: &claimedTopLevel, &claimedCache)
        }

        for folder in URL.home.children(includeHidden: true)
        where folder.isDirectory && folder.lastPathComponent.hasPrefix(".") && !claimedTopLevel.contains(folder.lastPathComponent) {
            if let item = await ProbeSupport.directoryItem(
                id: "tool-hidden-\(folder.lastPathComponent)", category: .tools,
                name: "Hidden folder \(folder.lastPathComponent)",
                detail: "Not recognised by this app. Usually a tool's data or cache; check what created it.",
                url: folder, safety: .review, action: .removePaths([folder]), minimumBytes: Self.threshold
            ) {
                items.append(item)
            }
        }

        for folder in URL.home(".cache").children(includeHidden: true)
        where folder.isDirectory && !claimedCache.contains(folder.lastPathComponent) {
            if let item = await ProbeSupport.directoryItem(
                id: "tool-cache-\(folder.lastPathComponent)", category: .tools,
                name: "Cache: \(folder.lastPathComponent)",
                detail: "~/.cache entry. Tools rebuild their caches on demand.",
                url: folder, safety: .safe, action: .removePaths([folder]), minimumBytes: Self.threshold
            ) {
                items.append(item)
            }
        }

        return items.sorted { ($0.sizeBytes ?? 0) > ($1.sizeBytes ?? 0) }
    }
}

// MARK: - Anything large that no other probe explained

/// Walks the locations Finder folds into System Data and reports every folder
/// over the threshold that no other item accounts for. This is the safety net
/// that keeps the inventory complete on machines with software this app has
/// never heard of.
struct LargeFolderProbe: StorageProbe {
    let claimed: [URL]

    private static let roots: [URL] = [
        .home,
        URL(fileURLWithPath: "/Library"),
        URL(fileURLWithPath: "/private/var"),
        URL(fileURLWithPath: "/opt"),
        URL(fileURLWithPath: "/usr/local"),
        URL(fileURLWithPath: "/Users/Shared"),
    ]

    /// Locations Finder attributes to their own category (Photos, Music,
    /// Messages, Mail, Applications), so they are not System Data.
    ///
    /// Desktop, Documents and Downloads are on the list for a second reason:
    /// Storage settings counts them as Documents, and what is in them is the
    /// user's own work, which no delete regenerates. Listing "~/Desktop" at
    /// 102 GB beside a Delete button is one wrong click away from a very bad
    /// afternoon. The probes that have business there still run — build
    /// folders, virtual machines and Final Cut render files each have their
    /// own item, with a name that says what it is.
    private static let excluded: [URL] = [
        .home("Pictures"), .home("Music"), .home("Movies"),
    
```

### Core Architecture Module: `Sources/SysDataMenu/Probes/DeveloperProbes.swift`
```
import Foundation

private let xcrun = "/usr/bin/xcrun"

// MARK: - Time Machine local snapshots

/// APFS keeps hourly Time Machine snapshots on the boot volume. Finder counts
/// their blocks as System Data and APFS refuses to report their size.
struct SnapshotProbe: StorageProbe {
    func probe() async -> [StorageItem] {
        guard let result = try? await Shell.run("/usr/bin/tmutil", ["listlocalsnapshots", "/"], timeout: Shell.probeTimeout) else { return [] }
        let count = result.output
            .split(separator: "\n")
            .filter { $0.contains("com.apple.TimeMachine") }
            .count
        guard count > 0 else { return [] }

        return [StorageItem(
            id: "snapshots",
            category: .snapshots,
            name: "\(count) local snapshot\(count == 1 ? "" : "s")",
            detail: "Hidden APFS snapshots kept between Time Machine runs. Size is not reported by APFS; the next backup recreates one.",
            sizeBytes: nil,
            safety: .safe,
            action: .privilegedScript("tmutil deletelocalsnapshots / ; tmutil thinlocalsnapshots / 9999999999999 4")
        )]
    }
}

// MARK: - Simulator devices

struct SimulatorProbe: StorageProbe {
    private let root = URL.home("Library/Developer/CoreSimulator")

    func probe() async -> [StorageItem] {
        var items: [StorageItem] = []
        var cacheDirectories: [URL] = []
        var cacheBytes: Int64 = 0
        var deviceCount = 0

        if let json = await ProbeSupport.json(xcrun, ["simctl", "list", "devices", "-j"]),
           let byRuntime = json["devices"] as? [String: [[String: Any]]] {
            for (runtime, devices) in byRuntime {
                for device in devices {
                    guard let name = device["name"] as? String,
                          let udid = device["udid"] as? String,
                          let dataPath = device["dataPath"] as? String else { continue }
                    let dataSize = (device["dataPathSize"] as? NSNumber)?.int64Value
                    let available = device["isAvailable"] as? Bool ?? false
                    let runtimeName = runtime.replacingOccurrences(of: "com.apple.CoreSimulator.SimRuntime.", with: "")

                    if !available {
                        items.append(StorageItem(
                            id: "sim-unavailable-\(udid)",
                            category: .simulators,
                            name: "Unavailable: \(name)",
                            detail: "Its runtime (\(runtimeName)) is no longer installed, so this device can never boot.",
                            sizeBytes: dataSize,
                            safety: .safe,
                            action: .command(executable: xcrun, arguments: ["simctl", "delete", udid]),
                            revealURL: URL(fileURLWithPath: dataPath)
                        ))
                        continue
                    }

                    deviceCount += 1
                    let data = URL(fileURLWithPath: dataPath)
                    let deviceCaches = [data.appending(path: "Library/Caches"), data.appending(path: "tmp")]
                        .filter(\.exists)
                    cacheDirectories += deviceCaches
                    var deviceCacheBytes: Int64 = 0
                    for directory in deviceCaches { deviceCacheBytes += await DiskSize.allocated(at: directory) }
                    cacheBytes += deviceCacheBytes
                    // The device's caches are their own row above; counted in
                    // the erase row as well, the total said the same bytes twice.
                    let eraseBytes = dataSize.map { max($0 - deviceCacheBytes, 0) }

                    // Erasing keeps the device, so an erased one comes back on
                    // the next scan at a few megabytes and reads as a delete
                    // that did not happen. Below this there is nothing to reset.
                    if let eraseBytes, eraseBytes < 100 * ProbeSupport.megabyte { continue }

                    items.append(StorageItem(
                        id: "sim-erase-\(udid)",
                        category: .simulators,
                        name: "Erase \(name)",
                        detail: "Resets this \(runtimeName) simulator to factory state. Installed apps and their data are lost.",
                        sizeBytes: eraseBytes,
                        safety: .review,
                        action: .eraseSimulator(udid: udid),
                        revealURL: data
                    ))
                }
            }
        }

        let sharedDyld = root.appending(path: "Caches/dyld")
        if sharedDyld.exists {
            cacheDirectories.append(sharedDyld)
            cacheBytes += await DiskSize.allocated(at: sharedDyld)
        }

        if !cacheDirectories.isEmpty {
            let total = cacheBytes
            if total > 0 {
                items.insert(StorageItem(
                    id: "sim-caches",
                    category: .simulators,
                    name: "Device caches (\(deviceCount) devices)",
                    detail: "Per-device Caches and tmp plus the shared dyld cache. Rebuilt on the next boot.",
                    sizeBytes: total,
                    safety: .safe,
                    action: .steps([.shutdownSimulators, .emptyDirectories(cacheDirectories)]),
                    revealURL: root.appending(path: "Devices")
                ), at: 0)
            }
        }

        // macOS refuses to unlink anything under this folder, even for root
        // (verified on macOS 26: rm as uid 0 returns EPERM on an empty
        // subdirectory). Only CoreSimulator's own daemon can remove it, which
        // happens when the runtime it belongs to is deleted.
        let systemDyld = URL(fileURLWithPath: "/Library/Developer/CoreSimulator/Caches/dyld")
        if let item = await ProbeSupport.directoryItem(
            id: "sim-system-dyld",
            category: .simulators,
            name: "System dyld cache",
            detail: "One shared cache per installed runtime, built by CoreSimulator. Protected by macOS: it goes away with its runtime, not on its own.",
            url: systemDyld,
            safety: .manual,
            action: .manual("Delete the runtime it belongs to (Simulator runtimes above), or:\nxcrun simctl runtime delete <UUID>\nThe cache is rebuilt when the runtime is installed again."),
            minimumBytes: 50 * ProbeSupport.megabyte
        ) {
            items.append(item)
        }

        return items
    }
}

// MARK: - Simulator runtimes

struct RuntimeProbe: StorageProbe {
    func probe() async -> [StorageItem] {
        guard let json = await ProbeSupport.json(xcrun, ["simctl", "runtime", "list", "-j"]) else { return [] }
        // Which runtime each installed SDK builds against, and which runtimes
        // still have a simulator on them. Either answer missing means nothing
        // is claimed about use at all: "unused" has to be known, not guessed.
        let chosenBuilds = await ProbeSupport.json(xcrun, ["simctl", "runtime", "match", "list", "-j"])
            .map(Self.chosenBuilds)
        let devices = await ProbeSupport.json(xcrun, ["simctl", "list", "devices", "-j"])?["devices"] as? [String: [Any]]

        return json.compactMap { identifier, value -> StorageItem? in
            guard let runtime = value as? [String: Any],
                  runtime["deletable"] as? Bool ?? false,
                  let version = runtime["version"] as? String,
                  let build = runtime["build"] as? String else { return nil }
            let platform = platformName(runtime["platformIdentifier"] as? String ?? "")
            let size = (runtime["sizeBytes"] as? NSNumber)?.int64Value
            // simctl knows when a runtime was last booted, which is a truer
            // answer than any file date under the image: mounting it for a
            // build touches nothing the way running a simulator does.
            let lastUsedAt = (runtime["lastUsedAt"] as? String).flatMap(Self.parseTimestamp)
            let lastUsed = (runtime["lastUsedAt"] as? String).map { "Last used \($0.prefix(10)). " } ?? ""
            let unused = chosenBuilds.map { chosen in
                Self.isUnused(
                    build: build, runtimeIdentifier: runtime["runtimeIdentifier"] as? String,
                    chosenBuilds: chosen, devices: devices
                )
            } ?? false
            let detail = unused
                ? "\(lastUsed)No installed Xcode builds against this runtime, and no simulator is on it. Xcode > Settings > Components downloads it again if you ever need it."
                : "\(lastUsed)Simulators on this runtime stop working. Xcode > Settings > Components downloads it again."

            return StorageItem(
                id: "runtime-\(identifier)",
                category: .runtimes,
                name: unused ? "\(platform) \(version) (\(build)) · unused" : "\(platform) \(version) (\(build))",
                detail: detail,
                sizeBytes: size,
                safety: .review,
                action: .command(executable: xcrun, arguments: ["simctl", "runtime", "delete", identifier]),
                revealURL: (runtime["path"] as? String).map { URL(fileURLWithPath: $0) },
                lastModified: lastUsedAt
            )
        }
        .sorted { ($0.sizeBytes ?? 0) > ($1.sizeBytes ?? 0) }
    }

    /// The runtime builds the installed SDKs are matched to, from
    /// `simctl runtime match list -j`.
    static func chosenBuilds(from match: [String: Any]) -> Set<String> {
        Set(match.values.compactMap { ($0 as? [String: Any])?["chosenRuntimeBuild"] as? String })
    }

    /// A runtime no installed SDK is matched to, with no simulator on it, is
    /// one nothing on this Mac can reach: building for the platform picks a
    /// different one, and there i
```

### Core Architecture Module: `Sources/SysDataMenu/Probes/DockerProjects.swift`
```
import Foundation

/// What each Docker Compose project costs, traced back to its folder so the
/// Projects view can put it next to that project's node_modules and
/// DerivedData.
///
/// Compose labels every container with the folder it was started from, which
/// is the only link from Docker's world back to a project on disk. Images and
/// volumes are reached through those containers, which also keeps the rows
/// here apart from the Docker category's prune rows: an image no container
/// uses and a volume nothing is attached to are already counted there, as
/// reclaimable, and counting them again would inflate every total.
///
/// Sizes come from the Engine API rather than `docker system df`, because
/// only the API gives each image's shared size as a number. Images share
/// layers — every Node project's image starts from the same base — so an
/// image is sized by what only it holds: the part deleting it would free.
enum DockerProjects {
    static let workingDirLabel = "com.docker.compose.project.working_dir"
    static let projectLabel = "com.docker.compose.project"

    /// The parts of a `GET /system/df?verbose=1` response this reads. API
    /// 1.52 moved the lists under `ImagesUsage.Items` and friends, and 1.53
    /// dropped the old top-level `Images`, `Containers` and `Volumes`; both
    /// shapes are read, so neither an old daemon nor a new one is missed.
    struct Usage: Decodable {
        var images: [Image] = []
        var containers: [Container] = []
        var volumes: [Volume] = []

        struct Image: Decodable {
            let Id: String
            let RepoTags: [String]?
            let Size: Int64
            let SharedSize: Int64
            let Created: Int64?

            /// What deleting it frees. `SharedSize` is -1 when the daemon did
            /// not compute it, and then nothing is claimed rather than the
            /// full size, which would count shared layers once per image.
            var uniqueSize: Int64 { SharedSize >= 0 ? max(Size - SharedSize, 0) : 0 }
        }

        struct Container: Decodable {
            let Id: String
            let ImageID: String?
            let Labels: [String: String]?
            /// `running`, `exited`, `paused`... Absent from older fixtures.
            let State: String?

            /// A container that is up, or about to be: it holds its image
            /// and its data, and removing it would stop someone's work.
            var isActive: Bool { ["running", "paused", "restarting"].contains(State ?? "") }
        }

        struct Volume: Decodable {
            let Name: String
            let Labels: [String: String]?
            let UsageData: UsageData?

            struct UsageData: Decodable {
                let Size: Int64
                let RefCount: Int64
            }
        }

        private struct List<Item: Decodable>: Decodable {
            let Items: [Item]?
        }

        private enum Keys: String, CodingKey {
            case Images, Containers, Volumes
            case ImagesUsage, ContainersUsage, VolumesUsage
            // The API reference spells these in the singular.
            case ImageUsage, ContainerUsage, VolumeUsage
        }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: Keys.self)
            func list<T: Decodable>(_ legacy: Keys, _ current: [Keys]) throws -> [T] {
                for key in current {
                    if let items = try c.decodeIfPresent(List<T>.self, forKey: key)?.Items { return items }
                }
                return try c.decodeIfPresent([T].self, forKey: legacy) ?? []
            }
            images = try list(.Images, [.ImagesUsage, .ImageUsage])
            containers = try list(.Containers, [.ContainersUsage, .ContainerUsage])
            volumes = try list(.Volumes, [.VolumesUsage, .VolumeUsage])
        }
    }

    /// Asks the daemon the CLI is pointed at, over its socket, at the API
    /// version the daemon itself reports. Nil when any step fails: no Docker,
    /// not running, a remote context, or an answer that does not parse.
    static func usage(docker: String) async -> Usage? {
        guard let host = try? await Shell.run(
                  docker, ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"],
                  mergeStderr: false, timeout: Shell.probeTimeout),
              host.succeeded,
              let socket = socketPath(fromHost: host.output),
              let version = try? await Shell.run(
                  docker, ["version", "--format", "{{.Server.APIVersion}}"],
                  mergeStderr: false, timeout: Shell.probeTimeout),
              version.succeeded
        else { return nil }
        let api = version.output.trimmingCharacters(in: .whitespacesAndNewlines)
        guard api.allSatisfy({ $0.isNumber || $0 == "." }), !api.isEmpty,
              let df = try? await Shell.run(
                  "/usr/bin/curl",
                  ["--silent", "--fail", "--max-time", "60", "--unix-socket", socket,
                   "http://localhost/v\(api)/system/df?verbose=1"],
                  mergeStderr: false, timeout: .seconds(70)),
              df.succeeded
        else { return nil }
        return try? JSONDecoder().decode(Usage.self, from: Data(df.output.utf8))
    }

    /// `unix:///Users/me/.docker/run/docker.sock` → its path. A TCP or SSH
    /// context points at another machine, whose disk is not this one's.
    static func socketPath(fromHost host: String) -> String? {
        let trimmed = host.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.hasPrefix("unix://") else { return nil }
        let path = String(trimmed.dropFirst("unix://".count))
        return path.isEmpty ? nil : path
    }

    /// One row per Compose project for its images, and one for its volumes.
    ///
    /// An image counts toward a project only when every container using it
    /// is that project's: a postgres image two projects run belongs to
    /// neither, and removing it for one would break the other.
    static func items(
        from usage: Usage, docker: String, now: Date = .now,
        projectRoot: (URL) -> URL = { ProjectProbe.projectRoot(of: $0) }
    ) -> [StorageItem] {
        struct Compose {
            var folder: URL
            var containerIDs: [String] = []
            var activeCount = 0
        }
        var projects: [String: Compose] = [:]
        var projectsUsingImage: [String: Set<String>] = [:]
        for container in usage.containers {
            let labels = container.Labels ?? [:]
            let project = labels[projectLabel]
            if let image = container.ImageID {
                projectsUsingImage[image, default: []].insert(project ?? "")
            }
            guard let project, let dir = labels[workingDirLabel], dir.hasPrefix("/") else { continue }
            projects[project, default: Compose(folder: URL(fileURLWithPath: dir))].containerIDs.append(container.Id)
            if container.isActive { projects[project]?.activeCount += 1 }
        }

        var items: [StorageItem] = []
        for (name, compose) in projects.sorted(by: { $0.key < $1.key }) {
            let root = compose.folder.exists ? projectRoot(compose.folder) : compose.folder
            let images = usage.images.filter { projectsUsingImage[$0.Id] == [name] }
            let imageBytes = images.reduce(0) { $0 + $1.uniqueSize }
            if imageBytes > 0 {
                // A tag is removed by name; an image with several tags cannot
                // be removed by ID without forcing, and one with none can.
                let references = images.flatMap { image -> [String] in
                    let tags = (image.RepoTags ?? []).filter { $0 != "<none>:<none>" }
                    return tags.isEmpty ? [image.Id] : tags
                }
                let created = images.compactMap(\.Created).max().map { Date(timeIntervalSince1970: TimeInterval($0)) }
                // Containers that are up are never removed from here. Their
                // images are in use and could not go anyway, and removing a
                // running container would stop someone's database mid-work.
                let isRunning = compose.activeCount > 0
                items.append(StorageItem(
                    id: "docker-project-images-\(name)", category: .docker,
                    name: "Docker images: \(name)",
                    detail: isRunning
                        ? "\(compose.folder.abbreviatedPath). \(compose.activeCount) of its containers are running, so its images are in use."
                        : "\(compose.folder.abbreviatedPath). Its containers and the images only they use; "
                            + "volumes are kept. docker compose up builds or pulls them again.",
                    sizeBytes: imageBytes, safety: isRunning ? .manual : .review,
                    action: isRunning
                        ? .manual("Stop the project first, keeping its volumes:\ndocker compose -p \(name) down")
                        : .steps([
                            .command(executable: docker, arguments: ["container", "rm"] + compose.containerIDs),
                            .command(executable: docker, arguments: ["image", "rm"] + references),
                        ]),
                    revealURL: compose.folder, project: root, builtAt: created
                ))
            }

            let volumes = usage.volumes.filter {
                $0.Labels?[projectLabel] == name && ($0.UsageData?.RefCount ?? 0) > 0
            }
            let volumeBytes = volumes.reduce(0) { $0 + max($1.UsageData?.Size ?? 0, 0) }
            if volumeBytes > 0 {
                items.append(StorageItem(
                    id: "docker-project-volumes-\(name)", category: .docker,
                    name: "Docker volumes: \(name)",
                    detail: "\(compose.folder.abbreviatedPath). Data its containe
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #27** (2026-11-06): **Bug: Scanning hangs at the last location (22/23 completed), progress cannot finish**
  *Symptoms*: **macOS version:** macOS 27.2 (Apple M1 Pro)  **App version:** 1.11.1  **What you did** 1. Launched the application. 2. Started the system data scan/calculation. 3. Waited for the progress to iterate through the scanned locations.  **What happened** The progress bar got stuck at "Calculating size... Completed 22 of 23 locations" (the 23rd/last location). It hangs indefinitely with no further progress, preventing the scan from finishing.  **What expected** The application should successfully iterate through all 23 locations, complete the scan, and display the final results without freezing.  A screenshot of the row involved usually tells the whole story. [Optional: Attach a screenshot here if you can] 
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report. I found and fixed one way the scan can stop at its last place: a command the app runs to measure something could leave a background process behind, and the app waited for that process to end, which could be never. The fix is in [1.11.2](https://github.com/Jarvis322/macos-sysdata/releases/tag/v1.11.2), out now:  ``` brew upgrade --cask jarvis322/tap/sysdata ```  or the app's own update check, or the disk image from the release page.  To make sure that is what you were seeing: if a scan still gets stuck on 1.11.2, could you run these two commands in Terminal while it is stuck and paste the output here?  ``` pgrep -lP $(pgrep -x SysDataMenu) sample SysDataMenu 3 -file ~/Desktop/sysdata-sample.txt ```  The first lists any program the app is still waiting on; the second writes a short trace to your Desktop that shows where it is stuck. Please attach that file too. 
  > jiang@DanieldeMacBook-Pro ~ % pgrep -lP $(pgrep -x SysDataMenu) jiang@DanieldeMacBook-Pro ~ % sample SysDataMenu 3 -file ~/Desktop/sysdata-sample.txt Sampling process 2399 for 3 seconds with 1 millisecond of run time between samples Sampling completed, processing symbols... Sample analysis of process 2399 written to file /Users/jiang/Desktop/sysdata-sample.txt  [sysdata-sample.txt](https://github.com/user-attachments/files/34475714/sysdata-sample.txt)

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

### Incident Patch 1: `18f2dafd` (2026-11-06)
**Commit Message**: fix(scan): give up on folders that stop answering

A folder read on a file system that has stopped answering, such as a
network share that went away, a cloud-synced folder waiting on its
provider or a stuck FUSE mount, blocks in the kernel for good. The
sample attached to #27 showed two walks there, holding the scan at
22 of 23.

Each walk now counts the entries it reads and is given up on after
reading nothing for 30 seconds; a long walk that keeps reading is
never cut short. The location is listed as could not be measured,
without a size or a delete, and the catch-all is guarded the same way.
Walks run on dispatch threads so blocked ones do not hold the
concurrency pool, at most one per core and at user-initiated QoS,
which keeps the scan as fast as before.

Fixes #27

**File**: `Sources/SysDataMenu/Probes/CatchAllProbes.swift` (modified, +20/-15)
```diff
@@ -218,22 +218,27 @@ struct LargeFolderProbe: StorageProbe {
                     guard DiskSize.isOnBootVolume(child),
                           !skipping.contains(DiskSize.realPath(child.path)) else { continue }
                     group.addTask {
-                        await Task.detached(priority: .utility) {
-                            // Nothing under a claimed or excluded directory can
-                            // ever be reported: `visit` returns on both before it
-                            // looks at a size. Their bytes only ever fed the totals
-                            // of parents, and a parent holding a claimed child is
-                            // recursed into rather than listed, so leaving those
-                            // bytes out cannot hide an item — a child that survives
-                            // the filters is smaller than the reduced parent total
-                            // by definition.
-                            let sizes = DiskSize.directorySizes(
-                                under: child, maxDepth: Self.maxDepth - 1, skipping: skipping
+                        // Nothing under a claimed or excluded directory can
+                        // ever be reported: `visit` returns on both before it
+                        // looks at a size. Their bytes only ever fed the totals
+                        // of parents, and a parent holding a claimed child is
+                        // recursed into rather than listed, so leaving those
+                        // bytes out cannot hide an item — a child that survives
+                        // the filters is smaller than the reduced parent total
+                        // by definition.
+                        let walked = await DiskSize.watched { progress in
+                            DiskSize.directorySizes(
+                                under: child, maxDepth: Self.maxDepth - 1, skipping: skipping, progress: progress
                             )
-                            var items: [StorageItem] = []
-                            Self.visit(child, depth: 1, sizes: sizes, claimed: claimedPaths, excluded: excludedPaths, apps: apps, into: &items)
-                            return items
-                        }.value
+                        }
+                        guard let sizes = walked else {
+                            return [ProbeSupport.unansweredItem(
+                                id: "other-\(child.path)", category: .other, name: child.abbreviatedPath, url: child
+                            )]
+                        }
+                        var items: [StorageItem] = []
+                        Self.visit(child, depth: 1, sizes: sizes, claimed: claimedPaths, excluded: excludedPaths, apps: apps, into: &items)
+                        return items
                     }
                 }
             }
```

**File**: `Sources/SysDataMenu/Probes/StorageProbe.swift` (modified, +23/-0)
```diff
@@ -18,8 +18,16 @@ enum ProbeSupport {
         action: ReclaimAction,
         minimumBytes: Int64 = 1
     ) async -> StorageItem? {
+        // Checked before the walk rather than inside it: most locations a
+        // probe asks about do not exist on a given Mac, and each would
+        // otherwise wait for a walk slot behind the real walks. What hangs
+        // on a file system that has stopped answering is reading a folder's
+        // entries, which the walk does and is watched for (#27).
         guard url.exists else { return nil }
         let measured = await DiskSize.measure(at: url)
+        if measured.stalled {
+            return unansweredItem(id: id, category: category, name: name, url: url)
+        }
         guard measured.bytes >= minimumBytes else { return nil }
         return StorageItem(
             id: id,
@@ -53,6 +61,21 @@ enum ProbeSupport {
         }
     }
 
+    /// A location whose file system stopped answering while it was measured.
+    ///
+    /// Listed rather than dropped, so the scan says where it gave up instead
+    /// of quietly showing less, and claimed, so the catch-all does not walk
+    /// into the same place. It has no size, so nothing offers to delete it.
+    static func unansweredItem(id: String, category: StorageCategory, name: String, url: URL) -> StorageItem {
+        StorageItem(
+            id: id, category: category, name: name,
+            detail: "Could not be measured: reading this folder stopped getting answers. It may be on a network drive, a disconnected disk, or in a cloud-synced folder.",
+            sizeBytes: nil, safety: .manual,
+            action: .manual("Open it in Finder to see what it is. If it is on a network or cloud drive, check that the drive is connected or the files are downloaded, then scan again."),
+            revealURL: url
+        )
+    }
+
     /// Runs a JSON-producing command and decodes its top-level object.
     static func json(_ executable: String, _ arguments: [String]) async -> [String: Any]? {
         guard let result = try? await Shell.run(executable, arguments, mergeStderr: false, timeout: Shell.probeTimeout),
```

**File**: `Sources/SysDataMenu/Services/DiskSize.swift` (modified, +107/-5)
```diff
@@ -1,4 +1,5 @@
 import Foundation
+import os
 
 enum DiskSize {
     /// What one walk of a location reports: how much it takes up, and when
@@ -14,6 +15,104 @@ enum DiskSize {
         /// Newest modification date under the location, or nil when it holds
         /// no regular files.
         var lastModified: Date?
+        /// The walk stopped getting answers and was given up on, so `bytes`
+        /// is not the size of the location (see `watched`).
+        var stalled = false
+    }
+
+    /// Counts the entries a walk has read, so a walk that has stopped reading
+    /// can be told apart from one that is merely long.
+    final class WalkProgress: Sendable {
+        private let entries = OSAllocatedUnfairLock(initialState: 0)
+
+        func advance() { entries.withLock { $0 += 1 } }
+        var count: Int { entries.withLock { $0 } }
+    }
+
+    /// How many walks read the disk at once. The concurrency pool used to
+    /// set this by having one thread per core; dispatch has no such limit,
+    /// and forty walks at once made the scan slower, not faster.
+    private static let walkSlots = WalkSlots(count: ProcessInfo.processInfo.activeProcessorCount)
+
+    /// A counting gate for walks. A slot is given back when its walk ends or
+    /// is given up on, whichever comes first, so walks stuck in the kernel
+    /// never hold slots the rest of the scan needs.
+    private actor WalkSlots {
+        private var free: Int
+        private var waiting: [CheckedContinuation<Void, Never>] = []
+
+        init(count: Int) { free = max(count, 1) }
+
+        func acquire() async {
+            if free > 0 {
+                free -= 1
+                return
+            }
+            await withCheckedContinuation { waiting.append($0) }
+        }
+
+        func release() {
+            if waiting.isEmpty {
+                free += 1
+            } else {
+                waiting.removeFirst().resume()
+            }
+        }
+    }
+
+    /// How long a walk may go without reading a single entry before the scan
+    /// stops waiting for it. A large folder keeps reading; this only ever
+    /// catches one whose file system has stopped answering.
+    static let stallLimit: Duration = .seconds(30)
+
+    /// Runs a walk off the concurrency pool and returns its result, or nil if
+    /// it read nothing for `stallLimit`.
+    ///
+    /// A directory read on a file system that has stopped answering — a
+    /// network share that went away, a cloud-synced folder waiting on its
+    /// provider, a stuck FUSE mount — blocks in the kernel and never returns,
+    /// and nothing can cancel it. The scan used to wait with it and sit at
+    /// "22 of 23" for good (#27). The walk still blocks, on a dispatch thread
+    /// that is left to it; the scan goes on without that location.
+    static func watched<T: Sendable>(
+        stallLimit: Duration = DiskSize.stallLimit, checkEvery: Duration = .seconds(2),
+        _ walk: @escaping @Sendable (WalkProgress) -> T
+    ) async -> T? {
+        let progress = WalkProgress()
+        let slots = walkSlots
+        await slots.acquire()
+        return await withCheckedContinuation { (continuation: CheckedContinuation<T?, Never>) in
+            let resumed = OSAllocatedUnfairLock(initialState: false)
+            let finish: @Sendable (T?) -> Void = { value in
+                let first = resumed.withLock { done in
+                    defer { done = true }
+                    return !done
+                }
+                guard first else { return }
+                continuation.resume(returning: value)
+                Task { await slots.release() }
+            }
+            // Not a detached task: a walk blocked in the kernel would hold one
+            // of the concurrency pool's few threads for good, and enough of
+            // them would stall every other probe. Dispatch adds threads.
+            // User-initiated, not utility: on a dispatch queue utility walks
+            // had their disk reads throttled, and the scan took 30% longer
+            // than the same walks run as utility tasks had.
+            DispatchQueue.global(qos: .userInitiated).async { finish(walk(progress)) }
+            Task.detached(priority: .utility) {
+                var lastCount = -1
+                var quietFor: Duration = .zero
+                while !resumed.withLock({ $0 }) {
+                    try? await Task.sleep(for: checkEvery)
+                    let count = progress.count
+                    if count == lastCount { quietFor += checkEvery } else { lastCount = count; quietFor = .zero }
+                    if quietFor >= stallLimit {
+                        finish(nil)
+                        return
+                    }
+                }
+            }
+        }
     }
 
     /// Allocated bytes under `url`, following the same rules Finder uses for
@@ -23,16 +122,15 @@ enum DiskSize {
     }
 
     static func measure(at url: URL, old
```

**File**: `Tests/SysDataMenuTests/StalledWalkTests.swift` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+import Foundation
+import Testing
+@testable import SysDataMenu
+
+/// A directory read on a file system that stopped answering never returns.
+/// The scan must give up on that one location and finish (#27), and must
+/// never give up on a walk that is merely long.
+@Suite struct StalledWalkTests {
+    @Test(.timeLimit(.minutes(1))) func aWalkThatStopsReadingIsGivenUpOn() async {
+        let release = DispatchSemaphore(value: 0)
+        defer { release.signal() }
+
+        let result = await DiskSize.watched(stallLimit: .milliseconds(600), checkEvery: .milliseconds(100)) { progress in
+            progress.advance()
+            // Blocked, the way a read on a dead network share is.
+            release.wait()
+            return 42
+        }
+
+        #expect(result == nil)
+    }
+
+    /// Slow is not stalled: a walk that keeps reading entries is waited for
+    /// however long it takes.
+    @Test(.timeLimit(.minutes(1))) func aSlowWalkThatKeepsReadingIsWaitedFor() async {
+        let result = await DiskSize.watched(stallLimit: .milliseconds(600), checkEvery: .milliseconds(100)) { progress in
+            for _ in 0..<12 {
+                progress.advance()
+                Thread.sleep(forTimeInterval: 0.2)
+            }
+            return 42
+        }
+
+        #expect(result == 42, "2.4 s of steady reading outlasts the 0.6 s limit and still finishes")
+    }
+
+    @Test func anUnansweredLocationIsListedWithoutASizeOrADelete() {
+        let url = URL(fileURLWithPath: "/Volumes/share/stuck")
+        let item = ProbeSupport.unansweredItem(id: "x", category: .apps, name: "stuck", url: url)
+
+        #expect(item.sizeBytes == nil)
+        #expect(item.action.isManual, "a folder nobody could measure is not offered for deletion")
+        #expect(item.claimedURLs.contains(url), "the catch-all must not walk into it again")
+    }
+}
```

---

### Incident Patch 2: `32ecae38` (2026-11-06)
**Commit Message**: fix(shell): stop waiting on children left running

After a command exited normally, the output pipe was read until it
closed. A child the command left behind, such as a daemon a CLI starts
on first use or a shim's helper, keeps it open for as long as it lives,
so the probe that ran the command never finished and the scan stayed
at its last place. The pipe now gets two seconds after the exit; what
the command wrote is already in it by then.

Refs #27

**File**: `Sources/SysDataMenu/Services/Shell.swift` (modified, +10/-4)
```diff
@@ -63,6 +63,8 @@ enum Shell {
 
     /// How long a program has to exit after SIGTERM before it is killed.
     private static let terminationGrace: Double = 5
+    /// How long the output pipe may stay open after the program has exited.
+    private static let pipeGrace: Double = 2
 
     /// The blocking half of `run`, kept synchronous because it waits on the
     /// pipe and the process; it only ever runs on the queue above.
@@ -123,11 +125,15 @@ enum Shell {
         exited.withLock { $0 = true }
         deadline?.cancel()
         let wasStopped = timedOut.withLock { $0 }
-        if wasStopped {
-            // Whatever still holds the pipe is not waited for.
+        // Whatever still holds the pipe is not waited for. After a timeout
+        // that is the program's own children; after a normal exit it is a
+        // child the program left behind — a daemon a CLI starts on first
+        // use, a shim's helper — which can live for as long as the Mac is
+        // up, and waiting for it held the scan at its last place (#27).
+        // What the program itself wrote is in the pipe by the time it
+        // exits, so a short grace reads all of it.
+        if wasStopped || ended.wait(timeout: .now() + pipeGrace) == .timedOut {
             pipe.fileHandleForReading.readabilityHandler = nil
-        } else {
-            ended.wait()
         }
 
         return CommandResult(
```

**File**: `Tests/SysDataMenuTests/ShellTimeoutTests.swift` (modified, +15/-0)
```diff
@@ -37,4 +37,19 @@ struct ShellTimeoutTests {
         #expect(result.succeeded)
         #expect(result.output == "hello\n")
     }
+
+    /// A program that exits normally but leaves a child holding the output
+    /// pipe — a daemon a CLI starts on first use, a shim's helper — used to
+    /// leave the scan on "22 of 23" for as long as that child lived (#27).
+    /// The child here sleeps for 60 seconds; the run must not wait for it.
+    @Test(.timeLimit(.minutes(1))) func aChildLeftRunningAfterANormalExitIsNotWaitedFor() async throws {
+        let clock = ContinuousClock()
+        let start = clock.now
+        let result = try await Shell.run(
+            "/bin/sh", ["-c", "echo done; sleep 60 &"], timeout: .seconds(20)
+        )
+        #expect(result.succeeded)
+        #expect(result.output.contains("done"))
+        #expect(clock.now - start < .seconds(15))
+    }
 }
```

#### Recent Merged Pull Requests:
- **PR #23** (closed): fix(localization): declare CFBundleLocalizations so macOS 27 matches non-English languages (@Souitou-iop)
- **PR #22** (2026-09-25): fix(localization): declare packaged languages in the app bundle (@VailElla)
- **PR #19** (2026-09-07): feat(i18n): add Simplified Chinese localization (@Mavlan)
- **PR #18** (closed): fix: avoid inventory layout crashes while scanning and scrolling (@dzy1997)
- **PR #17** (2026-09-07): Copy the plan from the confirmation (@peechycreation)
- **PR #16** (2026-09-07): Keep the selection through a filter, and let Select safe untick (@peechycreation)

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

## X. scan): give up on folders that stop answering

**RULE**:
When implementing operations in `Sources/SysDataMenu/Probes/CatchAllProbes.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Jarvis322/macos-sysdata. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `18f2dafd`: scan): give up on folders that stop answering. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `Sources/SysDataMenu/Probes/CatchAllProbes.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
                        // Nothing under a claimed or excluded directory can
                        // ever be reported: `visit` returns on both before it
                        // looks at a size. Their bytes only ever fed the totals
                        // of parents, and a parent holding a claimed child is
                        // recursed into rather than listed, so leaving those
                        // bytes out cannot hide an item — a child that survives
                        // the filters is smaller than the reduced parent total
                        // by definition.
                        let walked = await DiskSize.watched { progress in
                            DiskSize.directorySizes(
                                under: child, maxDepth: Self.maxDepth - 1, skipping: skipping, progress: progress
                        }
                        guard let sizes = walked else {
                            return [ProbeSupport.unansweredItem(
                                id: "other-\(child.path)", category: .other, name: child.abbreviatedPath, url: child
                            )]
                        }
                        var items: [Stora
```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern to NEVER write (induced failure mode):
                        await Task.detached(priority: .utility) {
                            // Nothing under a claimed or excluded directory can
                            // ever be reported: `visit` returns on both before it
                            // looks at a size. Their bytes only ever fed the totals
                            // of parents, and a parent holding a claimed child is
                            // recursed into rather than listed, so leaving those
                            // bytes out cannot hide an item — a child that survives
                            // the filters is smaller than the reduced parent total
                            // by definition.
                            let sizes = DiskSize.directorySizes(
                                under: child, maxDepth: Self.maxDepth - 1, skipping: skipping
                            var items: [StorageItem] = []
                            Self.visit(child, depth: 1, sizes: sizes, claimed: claimedPaths, excluded: excludedPaths, apps: apps, into: &items)
                            return items
                        }.value
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `18f2dafd` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
