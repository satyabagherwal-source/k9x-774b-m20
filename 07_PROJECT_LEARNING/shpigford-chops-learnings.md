# Forensic Learning Record (Deep Inspection): Shpigford/chops

> **Canonical Artifact**: `07_PROJECT_LEARNING/shpigford-chops-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Shpigford/chops](https://github.com/Shpigford/chops))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:50:19.741Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Shpigford/chops`
- **Description**: Your AI agent skills, finally organized. A macOS app to browse, edit, and manage skills across Claude Code, Cursor, Codex, Windsurf, and Amp.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1933 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Chops/App/AppState.swift`
```
import SwiftUI

@Observable
final class AppState {
    var selectedTool: ToolSource?
    var selectedSkill: Skill?
    var searchText: String = ""
    var showingNewSkillSheet: Bool = false
    var showingRegistrySheet: Bool = false
    var showingCommandPalette: Bool = false
    /// Action chosen in the command palette, run after the palette sheet dismisses
    /// (so we never present two sheets at once).
    var pendingPaletteAction: PaletteAction?
    var newItemKind: ItemKind = .skill
    var sidebarFilter: SidebarFilter = .allSkills
    /// Filter by item kind within a tool view (nil = show all)
    var toolKindFilter: ItemKind?
}

enum PaletteAction: Equatable {
    case navigate(SidebarFilter)
    case openDiscovery
    case newItem(ItemKind)
}

enum SidebarFilter: Hashable {
    case allSkills
    case allAgents
    case allRules
    case favorites
    case tool(ToolSource)
    case collection(String)
    case server(String)
}

```

### Core Architecture Module: `Chops/Utilities/FrontmatterParser.swift`
```
import Foundation

struct ParsedSkill {
    var frontmatter: [String: String]
    var content: String
    var name: String
    var description: String
}

enum FrontmatterParser {
    static func parse(_ text: String) -> ParsedSkill {
        let lines = text.components(separatedBy: "\n")

        guard lines.first?.trimmingCharacters(in: .whitespaces) == "---" else {
            return ParsedSkill(frontmatter: [:], content: text, name: "", description: "")
        }

        var endIndex: Int?
        for i in 1..<lines.count {
            if lines[i].trimmingCharacters(in: .whitespaces) == "---" {
                endIndex = i
                break
            }
        }

        guard let end = endIndex else {
            return ParsedSkill(frontmatter: [:], content: text, name: "", description: "")
        }

        var frontmatter: [String: String] = [:]
        for i in 1..<end {
            let line = lines[i]
            if let colonIndex = line.firstIndex(of: ":") {
                let key = String(line[line.startIndex..<colonIndex]).trimmingCharacters(in: .whitespaces)
                let value = String(line[line.index(after: colonIndex)...]).trimmingCharacters(in: .whitespaces)
                if !key.isEmpty {
                    frontmatter[key] = value
                }
            }
        }

        let contentStartIndex = min(end + 1, lines.count)
        let contentLines = Array(lines[contentStartIndex...])
        let content = contentLines.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)

        return ParsedSkill(
            frontmatter: frontmatter,
            content: content,
            name: frontmatter["name"] ?? "",
            description: frontmatter["description"] ?? ""
        )
    }
}

```

### Core Architecture Module: `Chops/Utilities/MDCParser.swift`
```
import Foundation

/// Parser for Cursor .mdc rule files.
/// MDC files use a frontmatter-like format with YAML between --- delimiters,
/// followed by markdown content.
enum MDCParser {
    static func parse(_ text: String) -> ParsedSkill {
        // MDC files use the same frontmatter format as SKILL.md
        FrontmatterParser.parse(text)
    }
}

```

### Core Architecture Module: `Chops/Utilities/MarkdownRenderer.swift`
```
import Foundation
import Highlightr
import JavaScriptCore
import cmark

enum MarkdownRenderer {
    static func renderHTML(_ markdown: String, isDarkMode: Bool) -> String {
        guard !markdown.isEmpty else { return "" }

        let len = markdown.utf8.count
        let options = Int32(CMARK_OPT_STRIKETHROUGH_DOUBLE_TILDE)

        guard let buf = cmark_gfm_markdown_to_html(markdown, len, options) else { return "" }
        let html = String(cString: buf)
        free(buf)

        return PreviewCodeHighlighter.shared.highlightCodeBlocks(in: html, isDarkMode: isDarkMode)
    }

    static func themeCSS(isDarkMode: Bool) -> String {
        PreviewCodeHighlighter.shared.themeCSS(isDarkMode: isDarkMode)
    }
}

private final class PreviewCodeHighlighter {
    static let shared = PreviewCodeHighlighter()

    private static let codeBlockRegex = try! NSRegularExpression(
        pattern: #"<pre([^>]*)><code(?: class="([^"]*)")?>([\s\S]*?)</code></pre>"#,
        options: []
    )

    private let bundle: Bundle?
    private let hljs: JSValue?
    private var cssCache: [String: String] = [:]

    private init() {
        self.bundle = Self.resourceBundle()

        guard let jsContext = JSContext(),
              let bundle,
              let highlightPath = bundle.path(forResource: "highlight.min", ofType: "js"),
              let highlightJS = try? String(contentsOfFile: highlightPath, encoding: .utf8) else {
            self.hljs = nil
            return
        }

        jsContext.evaluateScript(highlightJS)
        self.hljs = jsContext.objectForKeyedSubscript("hljs")
    }

    func highlightCodeBlocks(in html: String, isDarkMode: Bool) -> String {
        let nsHTML = html as NSString
        let matches = Self.codeBlockRegex.matches(in: html, range: NSRange(location: 0, length: nsHTML.length))

        guard !matches.isEmpty else { return html }

        var rendered = ""
        var currentLocation = 0

        for match in matches {
            let blockRange = match.range(at: 0)
            rendered += nsHTML.substring(with: NSRange(location: currentLocation, length: blockRange.location - currentLocation))

            let preAttributes = substring(in: nsHTML, range: match.range(at: 1))
            let classNames = substring(in: nsHTML, range: match.range(at: 2))
            let encodedCode = substring(in: nsHTML, range: match.range(at: 3)) ?? ""

            let language = languageName(classNames: classNames, preAttributes: preAttributes)
            let code = decodeHTML(encodedCode)

            if let highlighted = highlightedHTML(for: code, language: language, isDarkMode: isDarkMode) {
                rendered += highlighted
            } else {
                rendered += nsHTML.substring(with: blockRange)
            }

            currentLocation = blockRange.location + blockRange.length
        }

        rendered += nsHTML.substring(from: currentLocation)
        return rendered
    }

    func themeCSS(isDarkMode: Bool) -> String {
        let themeName = isDarkMode ? "atom-one-dark" : "atom-one-light"

        if let cached = cssCache[themeName] {
            return cached
        }

        guard let bundle,
              let themePath = bundle.path(forResource: themeName + ".min", ofType: "css"),
              let css = try? String(contentsOfFile: themePath, encoding: .utf8) else {
            return ""
        }

        cssCache[themeName] = css
        return css
    }

    private func highlightedHTML(for code: String, language: String?, isDarkMode: Bool) -> String? {
        guard let hljs else { return nil }

        let result: JSValue?
        if let language, !language.isEmpty {
            let highlighted = hljs.invokeMethod("highlight", withArguments: [language, code, false])
            if highlighted?.isUndefined == false {
                result = highlighted
            } else {
                result = hljs.invokeMethod("highlightAuto", withArguments: [code])
            }
        } else {
            result = hljs.invokeMethod("highlightAuto", withArguments: [code])
        }

        guard let html = result?.objectForKeyedSubscript("value")?.toString() else {
            return nil
        }

        let languageClass = language.map { " language-\($0)" } ?? ""
        let themeClass = isDarkMode ? "dark" : "light"

        return """
        <pre class="highlighted-code \(themeClass)"><code class="hljs\(languageClass)">\(html)</code></pre>
        """
    }

    private func languageName(classNames: String?, preAttributes: String?) -> String? {
        if let classNames {
            for className in classNames.split(separator: " ") {
                if className.hasPrefix("language-") {
                    return String(className.dropFirst("language-".count))
                }
                if className.hasPrefix("lang-") {
                    return String(className.dropFirst("lang-".count))
                }
            }
        }

        guard let preAttributes else { return nil }

        let pattern = #"lang="([^"]+)""#
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let match = regex.firstMatch(in: preAttributes, range: NSRange(location: 0, length: (preAttributes as NSString).length)) else {
            return nil
        }

        return substring(in: preAttributes as NSString, range: match.range(at: 1))
    }

    private func substring(in string: NSString, range: NSRange) -> String? {
        guard range.location != NSNotFound else { return nil }
        return string.substring(with: range)
    }

    private func decodeHTML(_ string: String) -> String {
        string
            .replacingOccurrences(of: "&amp;", with: "&")
            .replacingOccurrences(of: "&lt;", with: "<")
            .replacingOccurrences(of: "&gt;", with: ">")
            .replacingOccurrences(of: "&quot;", with: "\"")
            .replacingOccurrences(of: "&#39;", with: "'")
    }

    private static func resourceBundle() -> Bundle? {
        let bundleName = "Highlightr_Highlightr"
        let overrides: [URL]

        if let override = ProcessInfo.processInfo.environment["PACKAGE_RESOURCE_BUNDLE_PATH"]
            ?? ProcessInfo.processInfo.environment["PACKAGE_RESOURCE_BUNDLE_URL"] {
            overrides = [URL(fileURLWithPath: override)]
        } else {
            overrides = []
        }

        let candidates = overrides + [
            Bundle.main.resourceURL,
            Bundle(for: ResourceBundleFinder.self).resourceURL,
            Bundle.main.bundleURL
        ]

        for candidate in candidates {
            let bundlePath = candidate?.appendingPathComponent(bundleName + ".bundle")
            if let bundle = bundlePath.flatMap(Bundle.init(url:)) {
                return bundle
            }
        }

        return nil
    }
}

private final class ResourceBundleFinder {}

```

### Core Architecture Module: `Chops/App/ChopsApp.swift`
```
import SwiftUI
import SwiftData
import Sparkle

@main
struct ChopsApp: App {
    @State private var appState = AppState()
    @AppStorage("AgentDebugLogging") private var debugLoggingEnabled = false
    private let updaterController: SPUStandardUpdaterController

    init() {
        updaterController = SPUStandardUpdaterController(
            startingUpdater: true,
            updaterDelegate: nil,
            userDriverDelegate: nil
        )
    }

    var sharedModelContainer: ModelContainer = {
        let schema = Schema(versionedSchema: SchemaV1.self)

        do {
            let config = try StoreBootstrap.makeConfiguration(schema: schema)
            return try ModelContainer(
                for: schema,
                migrationPlan: ChopsMigrationPlan.self,
                configurations: [config]
            )
        } catch {
            fatalError("Could not create ModelContainer: \(error)")
        }
    }()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(appState)
        }
        .modelContainer(sharedModelContainer)
        .commands {
            TextEditingCommands()
            CommandGroup(after: .sidebar) {
                Button("Toggle Sidebar") {
                    NotificationCenter.default.post(name: .toggleSidebar, object: nil)
                }
                .keyboardShortcut("b", modifiers: .command)

                Button("Go to Skills") {
                    appState.sidebarFilter = .allSkills
                }
                .keyboardShortcut("l", modifiers: [.command, .shift])

                Button("Command Palette") {
                    appState.showingCommandPalette = true
                }
                .keyboardShortcut("k", modifiers: .command)

                Divider()
            }
            CommandGroup(replacing: .saveItem) {
                Button("Save") {
                    NotificationCenter.default.post(name: .saveCurrentSkill, object: nil)
                }
                .keyboardShortcut("s", modifiers: .command)
                .disabled(appState.selectedSkill == nil)
            }
            CommandGroup(after: .appInfo) {
                CheckForUpdatesView(updater: updaterController.updater)
            }
            CommandGroup(after: .help) {
                Toggle("Enable Debug Logging", isOn: $debugLoggingEnabled)
                Divider()
                Button("Export Diagnostic Log…") {
                    let context = sharedModelContainer.mainContext
                    DiagnosticExporter.export(modelContext: context)
                }
            }
        }

        Settings {
            SettingsView(updater: updaterController.updater)
                .environment(appState)
                .modelContainer(sharedModelContainer)
        }
    }
}

// MARK: - Sparkle Check for Updates menu item

struct CheckForUpdatesView: View {
    @ObservedObject private var checkForUpdatesViewModel: CheckForUpdatesViewModel
    let updater: SPUUpdater

    init(updater: SPUUpdater) {
        self.updater = updater
        self.checkForUpdatesViewModel = CheckForUpdatesViewModel(updater: updater)
    }

    var body: some View {
        Button("Check for Updates…") {
            updater.checkForUpdates()
        }
        .disabled(!checkForUpdatesViewModel.canCheckForUpdates)
    }
}

final class CheckForUpdatesViewModel: ObservableObject {
    @Published var canCheckForUpdates = false
    private var observation: Any?

    init(updater: SPUUpdater) {
        observation = updater.observe(\.canCheckForUpdates, options: [.initial, .new]) { [weak self] updater, change in
            DispatchQueue.main.async {
                self?.canCheckForUpdates = updater.canCheckForUpdates
            }
        }
    }
}

```

### Core Architecture Module: `Chops/App/ContentView.swift`
```
import SwiftUI
import SwiftData

struct ContentView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(AppState.self) private var appState
    @Query(sort: \Skill.name) private var skills: [Skill]
    @State private var scanner: SkillScanner?
    @State private var fileWatcher: FileWatcher?
    @State private var columnVisibility: NavigationSplitViewVisibility = .all

    var body: some View {
        @Bindable var appState = appState

        NavigationSplitView(columnVisibility: $columnVisibility) {
            SidebarView()
        } content: {
            SkillListView()
        } detail: {
            if let skill = appState.selectedSkill {
                SkillDetailView(skill: skill)
            } else {
                ContentUnavailableView(
                    "Select a Skill",
                    systemImage: "doc.text",
                    description: Text("Choose a skill from the sidebar to view and edit it.")
                )
            }
        }
        .searchable(text: $appState.searchText, prompt: "Search skills...")
        .onAppear {
            startScanning()
        }
        .sheet(isPresented: $appState.showingNewSkillSheet) {
            NewSkillSheet()
        }
        .sheet(isPresented: $appState.showingRegistrySheet) {
            RegistrySheet()
        }
        .sheet(isPresented: $appState.showingCommandPalette, onDismiss: runPaletteAction) {
            CommandPaletteView()
        }
        .onChange(of: appState.sidebarFilter) {
            appState.toolKindFilter = nil
        }
        .frame(minWidth: 900, minHeight: 500)
        .onReceive(NotificationCenter.default.publisher(for: .customScanPathsChanged)) { _ in
            scanner?.scanAll()
        }
        .onReceive(NotificationCenter.default.publisher(for: .toggleSidebar)) { _ in
            columnVisibility = columnVisibility == .doubleColumn ? .all : .doubleColumn
        }
    }

    /// Runs the action chosen in the command palette, after that sheet has
    /// fully dismissed — avoids presenting two sheets simultaneously.
    private func runPaletteAction() {
        guard let action = appState.pendingPaletteAction else { return }
        appState.pendingPaletteAction = nil
        switch action {
        case .navigate(let filter):
            appState.sidebarFilter = filter
        case .openDiscovery:
            appState.showingRegistrySheet = true
        case .newItem(let kind):
            appState.newItemKind = kind
            appState.showingNewSkillSheet = true
        }
    }

    private func startScanning() {
        AppLogger.ui.notice("App started, beginning initial scan")
        let scanner = SkillScanner(modelContext: modelContext)
        self.scanner = scanner
        scanner.removeDeletedSkills()
        scanner.scanAll()

        var allPaths: [String] = []
        for tool in ToolSource.allCases {
            allPaths.append(contentsOf: tool.globalPaths)
            allPaths.append(contentsOf: tool.globalAgentPaths)
            allPaths.append(contentsOf: tool.globalRulePaths)
        }
        let fm = FileManager.default
        let home = fm.homeDirectoryForCurrentUser.path
        let claudePlugins = "\(home)/.claude/plugins"
        let claudePluginCache = "\(claudePlugins)/cache"
        let claudePluginManifest = "\(claudePlugins)/installed_plugins.json"
        for path in [claudePlugins, claudePluginCache, claudePluginManifest] where fm.fileExists(atPath: path) {
            allPaths.append(path)
        }
        let claudeDesktopSessions = "\(home)/Library/Application Support/Claude/local-agent-mode-sessions"
        if fm.fileExists(atPath: claudeDesktopSessions) {
            allPaths.append(claudeDesktopSessions)
        }
        allPaths = Array(Set(allPaths)).sorted()

        let watcher = FileWatcher { _ in
            scanner.scanAll()
            scanner.removeDeletedSkills()
        }
        watcher.watchDirectories(allPaths)
        self.fileWatcher = watcher
        AppLogger.ui.notice("File watchers active on \(allPaths.count) directories")

        // Sync remote servers in the background
        Task {
            await scanner.syncAllRemoteServers()
        }
    }
}

```

### Core Architecture Module: `Chops/Models/AgentConfiguration.swift`
```
import Foundation

/// Stable identifier for the supported coding agents. Currently just Claude Code and
/// Codex — both driven directly by spawning the user's installed binary.
enum AgentID: String, Codable, CaseIterable, Identifiable, Sendable {
    case claude
    case codex

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .claude: "Claude Code"
        case .codex:  "Codex"
        }
    }

    var description: String {
        switch self {
        case .claude: "Anthropic's Claude Code, driven via a one-shot `claude --print` invocation."
        case .codex:  "OpenAI Codex, driven via a one-shot `codex exec` invocation."
        }
    }

    /// Where the user can install the binary if it isn't already on disk.
    var installURL: URL {
        switch self {
        case .claude: URL(string: "https://claude.ai/download")!
        case .codex:  URL(string: "https://github.com/openai/codex/releases")!
        }
    }

    /// `ToolSource` we look at to detect the binary on disk.
    var toolSource: ToolSource {
        switch self {
        case .claude: .claude
        case .codex:  .codex
        }
    }
}

/// Tracks which agents the user has enabled. The list of *supported* agents is fixed.
@Observable
@MainActor
final class AgentConfiguration {
    static let shared = AgentConfiguration()

    private static let enabledIdsKey = "agentEnabledIds"

    /// Currently-supported agents, in display order.
    let supported: [AgentID] = AgentID.allCases

    private(set) var enabledIds: Set<AgentID> {
        didSet {
            UserDefaults.standard.set(enabledIds.map(\.rawValue), forKey: Self.enabledIdsKey)
        }
    }

    var enabledAgents: [AgentID] { supported.filter { enabledIds.contains($0) } }
    var hasAnyEnabled: Bool { !enabledIds.isEmpty }

    private init() {
        let defaults = UserDefaults.standard
        // Treat "key has never been written" as first run. We do NOT use empty-array as a
        // signal, since the user might explicitly disable everything.
        let hasStoredValue = defaults.object(forKey: Self.enabledIdsKey) != nil
        let stored = defaults.stringArray(forKey: Self.enabledIdsKey) ?? []
        let migrated = Set(stored.compactMap { raw -> AgentID? in
            // Migrate legacy values from the previous registry-driven scheme.
            switch raw {
            case "claude-acp", "claude": return .claude
            case "codex-acp",  "codex":  return .codex
            default: return nil
            }
        })

        if hasStoredValue {
            self.enabledIds = migrated
        } else {
            // First run: auto-enable every supported agent whose binary we can detect on disk.
            // Saves the user from a no-op trip to Settings just to flip toggles for tools they
            // already have installed.
            var initial = Set<AgentID>()
            for id in AgentID.allCases where id.toolSource.cliBinaryURL != nil {
                initial.insert(id)
            }
            self.enabledIds = initial
            defaults.set(initial.map(\.rawValue), forKey: Self.enabledIdsKey)
        }
    }

    func isEnabled(_ id: AgentID) -> Bool { enabledIds.contains(id) }

    func setEnabled(_ id: AgentID, _ on: Bool) {
        if on { enabledIds.insert(id) } else { enabledIds.remove(id) }
    }
}

```

### Core Architecture Module: `Chops/Models/AgentTarget.swift`
```
import Foundation

struct AgentTarget: Identifiable, Hashable {
    let id: String
    let displayName: String
    let globalSkillsDir: String
    let skillFileName: String

    /// Paths to check — at least one must exist for the agent to be considered installed.
    /// These should be files/dirs that the actual tool creates, NOT dirs that `npx skills add` would create.
    let evidencePaths: [String]

    /// Optional: app bundle name to check in /Applications
    let appBundleName: String?

    /// Optional: CLI binary name to check in PATH
    let cliBinaryName: String?

    var isInstalled: Bool {
        let fm = FileManager.default
        let home = fm.homeDirectoryForCurrentUser.path

        // Check for app bundle
        if let app = appBundleName {
            let appPaths = [
                "/Applications/\(app).app",
                "\(home)/Applications/\(app).app",
            ]
            if appPaths.contains(where: { fm.fileExists(atPath: $0) }) {
                return true
            }
        }

        // Check for CLI binary
        if let cli = cliBinaryName {
            let searchPaths = [
                "/usr/local/bin/\(cli)",
                "/opt/homebrew/bin/\(cli)",
                "\(home)/.local/bin/\(cli)",
            ]
            // Also check nvm paths
            let nvmDir = "\(home)/.nvm/versions/node"
            if let nodeDirs = try? fm.contentsOfDirectory(atPath: nvmDir) {
                for nodeDir in nodeDirs {
                    let binPath = "\(nvmDir)/\(nodeDir)/bin/\(cli)"
                    if fm.fileExists(atPath: binPath) { return true }
                }
            }
            for path in searchPaths where fm.fileExists(atPath: path) {
                return true
            }
        }

        // Check evidence paths — tool-specific config files
        for path in evidencePaths where fm.fileExists(atPath: path) {
            return true
        }

        return false
    }

    var expandedSkillsDir: String {
        (globalSkillsDir as NSString).expandingTildeInPath
    }

    static var installed: [AgentTarget] {
        all.filter(\.isInstalled)
    }

    static let all: [AgentTarget] = {
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        let configHome: String = {
            if let xdg = ProcessInfo.processInfo.environment["XDG_CONFIG_HOME"], !xdg.isEmpty {
                return xdg
            }
            return "\(home)/.config"
        }()

        return [
            // CLI tools — detect via binary or config files
            AgentTarget(
                id: "claude-code",
                displayName: "Claude Code",
                globalSkillsDir: "\(home)/.claude/skills",
                skillFileName: "SKILL.md",
                evidencePaths: [
                    "\(home)/.claude/settings.json",
                    "\(home)/.claude/CLAUDE.md",
                    "\(home)/.claude/cache",
                ],
                appBundleName: nil,
                cliBinaryName: "claude"
            ),
            AgentTarget(
                id: "codex",
                displayName: "Codex",
                globalSkillsDir: "\(home)/.codex/skills",
                skillFileName: "SKILL.md",
                evidencePaths: [
                    "\(home)/.codex/config.toml",
                    "\(home)/.codex/auth.json",
                ],
                appBundleName: nil,
                cliBinaryName: "codex"
            ),
            AgentTarget(
                id: "amp",
                displayName: "Amp",
                globalSkillsDir: "\(configHome)/amp/skills",
                skillFileName: "SKILL.md",
                evidencePaths: [
                    "\(configHome)/amp/config.json",
                    "\(configHome)/amp/settings.json",
                ],
                appBundleName: nil,
                cliBinaryName: "amp"
            ),
            AgentTarget(
                id: "opencode",
                displayName: "OpenCode",
                globalSkillsDir: "\(configHome)/opencode/skills",
                skillFileName: "SKILL.md",
                evidencePaths: [
                    "\(configHome)/opencode/opencode.json",
                    "\(configHome)/opencode/opencode.jsonc",
                    "\(home)/.local/share/opencode",
                ],
                appBundleName: "OpenCode",
                cliBinaryName: "opencode"
            ),
            AgentTarget(
                id: "goose",
                displayName: "Goose",
                globalSkillsDir: "\(configHome)/goose/skills",
                skillFileName: "SKILL.md",
                evidencePaths: [
                    "\(configHome)/goose/config.yaml",
                    "\(configHome)/goose/profiles",
                ],
                appBundleName: nil,
                cliBinaryName: "goose"
            ),

            // IDE/editor apps — detect via /Applications
            AgentTarget(
                id: "cursor",
                displayName: "Cursor",
                globalSkillsDir: "\(home)/.cursor/skills",
                skillFileName: "SKILL.md",
                evidencePaths: [
                    "\(home)/.cursor/argv.json",
                    "\(home)/.cursor/extensions",
                ],
                appBundleName: "Cursor",
                cliBinaryName: nil
            ),
            AgentTarget(
                id: "windsurf",
                displayName: "Windsurf",
                globalSkillsDir: "\(home)/.codeium/windsurf/skills",
                skillFileName: "SKILL.md",
                evidencePaths: [
                    "\(home)/.codeium/windsurf/argv.json",
                    "\(home)/.codeium/windsurf/extensions",
                ],
                appBundleName: "Windsurf",
                cliBinaryName: nil
            ),
            AgentTarget(
                id: "warp",
                displayName: "Warp",
                globalSkillsDir: "\(home)/.warp/skills",
                skillFileName: "SKILL.md",
                evidencePaths: [
                    "\(home)/.warp/launch_configurations",
                ],
                appBundleName: "Warp",
                cliBinaryName: nil
            ),
        ]
    }()
}

```

### Core Architecture Module: `Chops/Models/ChopsSettings.swift`
```
import Foundation

/// User-configurable source-of-truth root directory.
/// Sub-directories for skills, agents, and rules are derived from the root.
struct ChopsSettings {
    private init() {}

    private static let home = FileManager.default.homeDirectoryForCurrentUser.path

    static var sotDir: String {
        get { UserDefaults.standard.string(forKey: "sotDir") ?? "\(home)/.chops" }
        set { UserDefaults.standard.set(newValue, forKey: "sotDir") }
    }

    static var sotSkillsDir: String { "\(sotDir)/skills" }
    static var sotAgentsDir: String { "\(sotDir)/agents" }
    static var sotRulesDir: String { "\(sotDir)/rules" }

    /// When false (default), skills installed by CLI and Desktop plugins are excluded from the library.
    static var includePluginSkills: Bool {
        get { UserDefaults.standard.bool(forKey: "includePluginSkills") }
        set { UserDefaults.standard.set(newValue, forKey: "includePluginSkills") }
    }
}

```

### Core Architecture Module: `Chops/Models/Collection.swift`
```
import Foundation

// SkillCollection is declared inside SchemaV1 so each schema version owns its snapshot.

```

### Core Architecture Module: `Chops/Models/RemoteServer.swift`
```
import Foundation

extension RemoteServer {
    var sshDestination: String {
        "\(username)@\(host)"
    }

    /// Tool used when tagging skills synced from this server (path-based heuristic).
    var inferredRemoteToolSource: ToolSource {
        let p = skillsBasePath.lowercased()
        if p.contains("hermes") { return .hermes }
        if p.contains("openclaw") { return .openclaw }
        return .openclaw
    }
}

```

### Core Architecture Module: `Chops/Models/SchemaVersions.swift`
```
import Foundation
import SwiftData

enum SchemaV1: VersionedSchema {
    static var versionIdentifier = Schema.Version(1, 0, 0)

    static var models: [any PersistentModel.Type] {
        [Skill.self, SkillCollection.self, RemoteServer.self]
    }

    @Model
    final class Skill {
        @Attribute(.unique) var resolvedPath: String
        var filePath: String
        var isDirectory: Bool
        var name: String
        var skillDescription: String
        var content: String
        var frontmatterData: Data?

        var collections: [SkillCollection]
        var isFavorite: Bool
        var lastOpened: Date?
        var fileModifiedDate: Date
        var fileSize: Int
        var isGlobal: Bool

        var remoteServer: RemoteServer?
        var remotePath: String?

        var toolSourcesRaw: String
        var installedPathsData: Data?
        var kind: String = ItemKind.skill.rawValue

        init(
            filePath: String,
            toolSource: ToolSource,
            isDirectory: Bool = false,
            name: String = "",
            skillDescription: String = "",
            content: String = "",
            frontmatter: [String: String] = [:],
            collections: [SkillCollection] = [],
            isFavorite: Bool = false,
            lastOpened: Date? = nil,
            fileModifiedDate: Date = .now,
            fileSize: Int = 0,
            isGlobal: Bool = true,
            resolvedPath: String = "",
            kind: ItemKind = .skill
        ) {
            self.resolvedPath = resolvedPath.isEmpty ? filePath : resolvedPath
            self.filePath = filePath
            self.toolSourcesRaw = toolSource.rawValue
            self.installedPathsData = try? JSONEncoder().encode([filePath])
            self.isDirectory = isDirectory
            self.name = name
            self.skillDescription = skillDescription
            self.content = content
            self.frontmatterData = try? JSONEncoder().encode(frontmatter)
            self.collections = collections
            self.isFavorite = isFavorite
            self.lastOpened = lastOpened
            self.fileModifiedDate = fileModifiedDate
            self.fileSize = fileSize
            self.isGlobal = isGlobal
            self.kind = kind.rawValue
        }
    }

    @Model
    final class SkillCollection {
        @Attribute(.unique) var name: String
        var icon: String
        var sortOrder: Int

        @Relationship(inverse: \Skill.collections)
        var skills: [Skill]

        init(name: String, icon: String = "folder", skills: [Skill] = [], sortOrder: Int = 0) {
            self.name = name
            self.icon = icon
            self.skills = skills
            self.sortOrder = sortOrder
        }
    }

    @Model
    final class RemoteServer {
        @Attribute(.unique) var id: String
        var label: String
        var host: String
        var port: Int
        var username: String
        var skillsBasePath: String
        var sshKeyPath: String?
        var lastSyncDate: Date?
        var lastSyncError: String?

        @Relationship(deleteRule: .cascade, inverse: \Skill.remoteServer)
        var skills: [Skill]

        init(
            label: String,
            host: String,
            port: Int = 22,
            username: String,
            skillsBasePath: String
        ) {
            self.id = UUID().uuidString
            self.label = label
            self.host = host
            self.port = port
            self.username = username
            self.skillsBasePath = skillsBasePath
            self.skills = []
        }
    }
}

typealias Skill = SchemaV1.Skill
typealias SkillCollection = SchemaV1.SkillCollection
typealias RemoteServer = SchemaV1.RemoteServer

enum ChopsMigrationPlan: SchemaMigrationPlan {
    static var schemas: [any VersionedSchema.Type] {
        [SchemaV1.self]
    }

    static var stages: [MigrationStage] { [] }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #78** (2026-03-31): **GitHub API rate limit reached**
  *Symptoms*: ### What happened?    <img width="554" height="497" alt="Image" src="https://github.com/user-attachments/assets/9c933b09-b564-4484-939b-521b7f85841d" />    ### Steps to reproduce  1. Open Chops 2. Click "+" and Browser Registry 3. Search "Figma" 4. Click "figma-use"  ### App version  1.11.0  ### macOS version  26.3  ### Screenshots  _No response_  ### Problematic skill file  _No response_

- **Issue #61** (2026-03-27): **Can't select all in doc Preview mode**
  *Symptoms*: It's impossible to drag-to-select or do select all on text in Preview mode.

- **Issue #55** (2026-03-28): **Custom directories**
  *Symptoms*: - Added a custom directory but doesn't find my skills - Duplicate skills are not ignored from multiple default directories - .agents directory is not detected (but that's the most provider-agnostic one)    <img width="888" height="92" alt="Image" src="https://github.com/user-attachments/assets/6328e1c4-0c6f-4e5a-933e-785a6e92cd3f" />  <img width="338" height="302" alt="Image" src="https://github.com/user-attachments/assets/122595a6-2031-4d8f-8b0f-e522254a2f7c" /> 
  **Post-Mortem & Fix Analysis**:
  > Thanks for sending these in. If you could please create separate bug reports for each issue that way I and others can tackle them separately.

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

### Incident Patch 1: `9d379d58` (2026-08-23)
**Commit Message**: fix: wait for Finder to register the DMG volume before styling it

hdiutil attach returns before Finder registers the mounted volume, so
the styling AppleScript could fail with "Can't get disk Chops" (-1728)
and abort the release under set -e.

Claude-Session: https://claude.ai/code/session_01MsABqqqK3hngmnwt2HNoqb

**File**: `scripts/release.sh` (modified, +8/-0)
```diff
@@ -91,6 +91,14 @@ create_chops_dmg() {
   mkdir -p "/Volumes/Chops/.background"
   cp scripts/dmg-background.png "/Volumes/Chops/.background/background.png"
 
+  # hdiutil attach returns before Finder registers the volume; wait for it
+  for _ in $(seq 1 30); do
+    if [ "$(osascript -e 'tell application "Finder" to exists disk "Chops"')" = "true" ]; then
+      break
+    fi
+    sleep 1
+  done
+
   osascript <<'APPLESCRIPT'
 tell application "Finder"
   tell disk "Chops"
```

---

### Incident Patch 2: `58997348` (2026-04-03)
**Commit Message**: fix: use editor content as diff ground truth, prevent partial fragment overwrites (#90)

The AI Assist diff was showing the entire document as changed because:
1. The original side was read from disk (stale due to auto-save debounce)
   instead of the editor binding which is the actual ground truth.
2. Claude's captureDiffs would overwrite the full file content from
   handleFileWriteRequest with a partial diff fragment (d.newText).
3. attachDiffs trusted the agent's oldText over our own snapshot for
   the currently-open file.

Now: editor content is always used as the original, handleFileWriteRequest
updates partial entries with the full file, and captureDiffs never
overwrites existing content.

**File**: `Chops/Services/ACP/ACPClient.swift` (modified, +19/-0)
```diff
@@ -240,6 +240,12 @@ open class BaseACPAgent: ClientDelegate {
 
     func clearPendingWrites() { pendingWrites = []; deferredContent = [:] }
 
+    /// Seed the virtual file map so same-turn reads see the editor state rather than stale disk.
+    func primeDeferredContent(for path: String, content: String) {
+        let resolved = URL(fileURLWithPath: path).resolvingSymlinksInPath().path
+        deferredContent[resolved] = content
+    }
+
     /// Sends a session/cancel notification to the agent to interrupt the current turn.
     func cancelPrompt() {
         guard let client = acpClient, let sid = sessionId else { return }
@@ -317,6 +323,19 @@ open class BaseACPAgent: ClientDelegate {
                     existedBefore: snapshot.0
                 )
             )
+        } else if let idx = pendingWrites.firstIndex(where: {
+            URL(fileURLWithPath: $0.path).resolvingSymlinksInPath().path == resolvedIncoming
+        }) {
+            // captureDiffs may have set content to a partial diff fragment.
+            // Replace with the full file content from write_text_file.
+            let existing = pendingWrites[idx]
+            pendingWrites[idx] = PendingWrite(
+                path: existing.path,
+                content: content,
+                originalText: existing.originalText,
+                originalData: existing.originalData,
+                existedBefore: existing.existedBefore
+            )
         }
         // Store proposed content so subsequent agent reads return it.
         deferredContent[resolvedIncoming] = content
```

**File**: `Chops/Services/ACP/Agents/ClaudeACPAgent.swift` (modified, +8/-5)
```diff
@@ -104,12 +104,15 @@ final class ClaudeACPAgent: BaseACPAgent {
             if let existing = pendingWrites.firstIndex(where: {
                 URL(fileURLWithPath: $0.path).resolvingSymlinksInPath().path == resolvedPath
             }) {
+                // Preserve the existing content — handleFileWriteRequest may have
+                // already set it to the full file. d.newText can be a partial fragment.
+                let prev = pendingWrites[existing]
                 pendingWrites[existing] = PendingWrite(
-                    path: d.path,
-                    content: d.newText,
-                    originalText: pendingWrites[existing].originalText,
-                    originalData: pendingWrites[existing].originalData,
-                    existedBefore: pendingWrites[existing].existedBefore
+                    path: prev.path,
+                    content: prev.content,
+                    originalText: prev.originalText ?? oldText,
+                    originalData: prev.originalData ?? oldData,
+                    existedBefore: prev.existedBefore
                 )
             } else {
                 pendingWrites.append(
```

**File**: `Chops/Views/Shared/ComposePanel.swift` (modified, +11/-12)
```diff
@@ -777,11 +777,10 @@ struct ComposePanel: View {
         Task {
             do {
                 let fp = filePath
-                let original: String? = await readFile(at: fp)
-                guard let original else {
-                    messages.append(ChatMessage(id: assistantId, role: .assistant, text: "Cannot read file: \(filePath)", isError: true))
-                    return
-                }
+                // Use the editor binding — it's the ground truth the user sees.
+                // readFile(at:) reads disk, which may be stale (auto-save debounce).
+                let original = content
+                client.primeDeferredContent(for: fp, content: original)
                 let prompt = buildPrompt(text: text, originalContent: original)
                 try await client.prompt(prompt)
                 isFirstTurn = false
@@ -872,16 +871,16 @@ struct ComposePanel: View {
             let original: String?
             let originalData: Data?
             let existedBefore: Bool
-            if let embedded = write.originalText {
-                // Agent supplied the pre-edit content (e.g. DiffContent.oldText) — use it directly.
-                original = embedded
-                originalData = write.originalData
-                existedBefore = write.existedBefore
-            } else if write.path == filePath || writtenResolved == resolvedFilePath {
-                // Path matches (accounting for symlinks) — use the in-memory content from before the turn.
+            if write.path == filePath || writtenResolved == resolvedFilePath {
+                // Current file: always use our own snapshot from turn start.
+                // The agent's oldText can be empty or wrong; fallbackOriginal is ground truth.
                 original = fallbackOriginal
                 originalData = fallbackOriginal.data(using: .utf8)
                 existedBefore = true
+            } else if let embedded = write.originalText {
+                original = embedded
+                originalData = write.originalData
+                existedBefore = write.existedBefore
             } else {
                 original = write.originalText
                 originalData = write.originalData
```

---

### Incident Patch 3: `475f071e` (2026-04-03)
**Commit Message**: fix: inject Opus model options into Claude ACP model picker (#89)

Claude Code's ACP adapter omits Opus from the model picker due to an
upstream SDK bug (anthropics/claude-agent-sdk-typescript#117). Work
around it by injecting Opus and Opus (1M context) client-side in
ClaudeACPAgent. Self-healing: skips injection if the upstream fix ships.

**File**: `Chops/Services/ACP/ACPClient.swift` (modified, +4/-3)
```diff
@@ -131,7 +131,7 @@ open class BaseACPAgent: ClientDelegate {
         let sessionResp = try await client.newSession(workingDirectory: cwd.path)
         guard !Task.isCancelled else { await client.terminate(); return }
         sessionId = sessionResp.sessionId
-        sessionConfigOptions = sessionResp.configOptions ?? []
+        sessionConfigOptions = processConfigOptions(sessionResp.configOptions ?? [])
         acpLog.debug("Session created: \(sessionResp.sessionId) (\(sessionConfigOptions.count) config options)")
 
         acpClient = client
@@ -210,7 +210,7 @@ open class BaseACPAgent: ClientDelegate {
     func setConfigOption(id: SessionConfigId, value: SessionConfigValueId) async throws {
         guard let client = acpClient, let sid = sessionId else { return }
         let resp = try await client.setConfigOption(sessionId: sid, configId: id, value: value)
-        sessionConfigOptions = resp.configOptions
+        sessionConfigOptions = processConfigOptions(resp.configOptions)
     }
 
     // MARK: - Prompt
@@ -370,7 +370,7 @@ open class BaseACPAgent: ClientDelegate {
         case .agentThoughtChunk(let c):   onThoughtChunk(c)
         case .toolCall(let t):            onToolCall(t)
         case .toolCallUpdate(let d):      onToolCallUpdate(d)
-        case .configOptionUpdate(let u):  sessionConfigOptions = u
+        case .configOptionUpdate(let u):  sessionConfigOptions = processConfigOptions(u)
         case .sessionInfoUpdate(let i):   if let t = i.title { acpLog.debug("Session: \(t)") }
         default:                          break
         }
@@ -400,6 +400,7 @@ open class BaseACPAgent: ClientDelegate {
 
     func additionalFlags() -> [String] { [] }
     func sessionCwd(for workingDirectory: URL) -> URL { workingDirectory }
+    func processConfigOptions(_ options: [SessionConfigOption]) -> [SessionConfigOption] { options }
     func postProcess(_ text: String) -> String { text }
     func conversationalText(from text: String) -> String { postProcess(text) }
 
```

**File**: `Chops/Services/ACP/Agents/ClaudeACPAgent.swift` (modified, +40/-0)
```diff
@@ -126,6 +126,46 @@ final class ClaudeACPAgent: BaseACPAgent {
         }
     }
 
+    // MARK: - Config Option Enrichment
+
+    /// Claude Code's ACP adapter omits Opus from the model picker due to an upstream SDK bug
+    /// (anthropics/claude-agent-sdk-typescript#117). Inject it client-side so users can select it.
+    /// Self-healing: if the upstream fix ships, hasOpus detects it and skips injection.
+    override func processConfigOptions(_ options: [SessionConfigOption]) -> [SessionConfigOption] {
+        options.map { option in
+            guard option.name == "Model", case .select(let select) = option.kind else { return option }
+
+            let existingOptions: [SessionConfigSelectOption]
+            switch select.options {
+            case .ungrouped(let opts): existingOptions = opts
+            case .grouped(let groups): existingOptions = groups.flatMap(\.options)
+            }
+
+            let hasOpus = existingOptions.contains { $0.value.value == "opus" }
+            guard !hasOpus else { return option }
+
+            var newOptions = existingOptions
+            let insertIndex = newOptions.lastIndex(where: { $0.value.value.contains("sonnet") })
+                .map { newOptions.index(after: $0) } ?? newOptions.endIndex
+
+            newOptions.insert(contentsOf: [
+                SessionConfigSelectOption(value: SessionConfigValueId("opus"), name: "Opus"),
+                SessionConfigSelectOption(value: SessionConfigValueId("opus[1m]"), name: "Opus (1M context)"),
+            ], at: insertIndex)
+
+            return SessionConfigOption(
+                id: option.id,
+                name: option.name,
+                description: option.description,
+                category: option.category,
+                kind: .select(SessionConfigSelect(
+                    currentValue: select.currentValue,
+                    options: .ungrouped(newOptions)
+                ))
+            )
+        }
+    }
+
     // MARK: - Response Post-Processing
 
     override func postProcess(_ text: String) -> String {
```

---

### Incident Patch 4: `4698e045` (2026-03-31)
**Commit Message**: fix: add SwiftData schema versioning to prevent silent data loss (#87)

SwiftData was silently recreating the store when encountering schema
mismatches, destroying user-created SkillCollections (which have no
filesystem backing and are unrecoverable). This adds VersionedSchema
and SchemaMigrationPlan so future schema changes go through proper
migrations instead of store recreation. Also moves the store to an
explicit path (~/Library/Application Support/Chops/Chops.store)
instead of relying on SwiftData's implicit default.store.

**File**: `CLAUDE.md` (modified, +4/-1)
```diff
@@ -38,12 +38,15 @@ No test suite exists. Validate manually by building and running.
 ## Architecture
 
 **Entry:** `Chops/App/ChopsApp.swift` → sets up SwiftData ModelContainer + Sparkle updater.
+SwiftData store path is explicit: `~/Library/Application Support/Chops/Chops.store`. Do not rely on the implicit `default.store`.
 
 **State:** `AppState` is an `@Observable` singleton holding UI filters, search text, and selection state.
 
 **Models (SwiftData):**
 - `Skill` — a discovered skill file. Uniquely identified by resolved symlink path. Tracks which tools it's installed in.
-- `SkillCollection` — user-created groupings of skills.
+- `SkillCollection` — user-created groupings of skills (pure user data, not filesystem-backed — data loss is permanent).
+
+**Schema versioning:** SwiftData models use `VersionedSchema` + `SchemaMigrationPlan` (see `SchemaVersions.swift`). Each schema version must declare its own nested `@Model` snapshots; app code reaches the current version through top-level `typealias`es like `Skill = SchemaV1.Skill`. When adding or changing a stored property, freeze the previous schema in place, add a new schema version (e.g. `SchemaV2`) with its own nested models, move the typealiases to the new version, and add the corresponding `MigrationStage`. Never point an older schema version at live top-level models — future migrations will crash with duplicate checksums.
 
 **Services:**
 - `SkillScanner` — probes tool directories (~/.claude/skills/, ~/.cursor/rules/, etc.), parses frontmatter, upserts into SwiftData. Deduplicates via resolved symlink paths.
```

**File**: `Chops.xcodeproj/project.pbxproj` (modified, +4/-0)
```diff
@@ -50,6 +50,7 @@
 		B5B95B9DA63A734F25470FF5 /* SchemaVersions.swift in Sources */ = {isa = PBXBuildFile; fileRef = B1F8AA042D5D8A9F92F35CA3 /* SchemaVersions.swift */; };
 		BD584933CCE2B650345C4CF1 /* ToolSource.swift in Sources */ = {isa = PBXBuildFile; fileRef = 5487D9027B97F7E9EE9A1F4A /* ToolSource.swift */; };
 		BFF9964529E6C48F4F7BCB97 /* MarkdownSyntaxHighlighter.swift in Sources */ = {isa = PBXBuildFile; fileRef = 135976FA0E8358E099157DE1 /* MarkdownSyntaxHighlighter.swift */; };
+		C2A028F40A1C665D29495DB6 /* StoreBootstrap.swift in Sources */ = {isa = PBXBuildFile; fileRef = 3D23D43EC788E51ED1C265FE /* StoreBootstrap.swift */; };
 		C30BEAE03E54BD36F257A925 /* ToolFilterView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 9A5774429CCE83C2AFBE046C /* ToolFilterView.swift */; };
 		C6CFF37CC0B155E8846344A4 /* ChopsIcon.icon in Resources */ = {isa = PBXBuildFile; fileRef = 04C3C644B72DD508A7CBC403 /* ChopsIcon.icon */; };
 		C983C685C6296C2EF73CE57D /* CursorACPAgent.swift in Sources */ = {isa = PBXBuildFile; fileRef = 07899C351E63B32277272A59 /* CursorACPAgent.swift */; };
@@ -89,6 +90,7 @@
 		3314080A44DEB895223E36D5 /* RemoteServer.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = RemoteServer.swift; sourceTree = "<group>"; };
 		372FA72F2C179B79470DF86A /* MarkdownRenderer.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = MarkdownRenderer.swift; sourceTree = "<group>"; };
 		3A4F680B33C74A38FCF5ADD5 /* MDCParser.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = MDCParser.swift; sourceTree = "<group>"; };
+		3D23D43EC788E51ED1C265FE /* StoreBootstrap.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = StoreBootstrap.swift; sourceTree = "<group>"; };
 		4CA102A49ACFB23BC15794F8 /* CollectionListView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = CollectionListView.swift; sourceTree = "<group>"; };
 		511C5A2149EFF77BDA7D4692 /* ACPLogger.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ACPLogger.swift; sourceTree = "<group>"; };
 		5155D141EF812A3FE9ADF59C /* SkillParser.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SkillParser.swift; sourceTree = "<group>"; };
@@ -248,6 +250,7 @@
 				9FC9D3E83D8640CC258CF361 /* SkillRegistry.swift */,
 				E6A5B26D335C1AFB6CDE8207 /* SkillScanner.swift */,
 				6797D4AC1970DB9ACB5ACA73 /* SSHService.swift */,
+				3D23D43EC788E51ED1C265FE /* StoreBootstrap.swift */,
 				12C5CD1627D4EFF58AEF4F71 /* TemplateManager.swift */,
 				3B8985D8816557B264BF0AD8 /* ACP */,
 			);
@@ -448,6 +451,7 @@
 				E6F4E1CF50F2F78F5BA9BAC9 /* SkillPreviewView.swift in Sources */,
 				846B58F3B105D1734DC6FA75 /* SkillRegistry.swift in Sources */,
 				6A8E0927D95BB14C9F377F4E /* SkillScanner.swift in Sources */,
+				C2A028F40A1C665D29495DB6 /* StoreBootstrap.swift in Sources */,
 				3F0ED402E77D8D25C600BAED /* TemplateManager.swift in Sources */,
 				038F5975DA97A3211EF4D448 /* ThinkingView.swift in Sources */,
 				53C393C13E30EC439317509F /* ToolBadge.swift in Sources */,
```

**File**: `Chops/App/ChopsApp.swift` (modified, +7/-3)
```diff
@@ -17,11 +17,15 @@ struct ChopsApp: App {
     }
 
     var sharedModelContainer: ModelContainer = {
-        let schema = Schema([Skill.self, SkillCollection.self, RemoteServer.self])
-        let config = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)
+        let schema = Schema(versionedSchema: SchemaV1.self)
 
         do {
-            return try ModelContainer(for: schema, configurations: [config])
+            let config = try StoreBootstrap.makeConfiguration(schema: schema)
+            return try ModelContainer(
+                for: schema,
+                migrationPlan: ChopsMigrationPlan.self,
+                configurations: [config]
+            )
         } catch {
             fatalError("Could not create ModelContainer: \(error)")
         }
```

**File**: `Chops/Models/Collection.swift` (modified, +1/-17)
```diff
@@ -1,19 +1,3 @@
-import SwiftData
 import Foundation
 
-@Model
-final class SkillCollection {
-    @Attribute(.unique) var name: String
-    var icon: String
-    var sortOrder: Int
-
-    @Relationship(inverse: \Skill.collections)
-    var skills: [Skill]
-
-    init(name: String, icon: String = "folder", skills: [Skill] = [], sortOrder: Int = 0) {
-        self.name = name
-        self.icon = icon
-        self.skills = skills
-        self.sortOrder = sortOrder
-    }
-}
+// SkillCollection is declared inside SchemaV1 so each schema version owns its snapshot.
```

**File**: `Chops/Models/RemoteServer.swift` (modified, +1/-32)
```diff
@@ -1,37 +1,6 @@
-import SwiftData
 import Foundation
 
-@Model
-final class RemoteServer {
-    @Attribute(.unique) var id: String
-    var label: String
-    var host: String
-    var port: Int
-    var username: String
-    var skillsBasePath: String
-    var sshKeyPath: String?
-    var lastSyncDate: Date?
-    var lastSyncError: String?
-
-    @Relationship(deleteRule: .cascade, inverse: \Skill.remoteServer)
-    var skills: [Skill]
-
-    init(
-        label: String,
-        host: String,
-        port: Int = 22,
-        username: String,
-        skillsBasePath: String
-    ) {
-        self.id = UUID().uuidString
-        self.label = label
-        self.host = host
-        self.port = port
-        self.username = username
-        self.skillsBasePath = skillsBasePath
-        self.skills = []
-    }
-
+extension RemoteServer {
     var sshDestination: String {
         "\(username)@\(host)"
     }
```

**File**: `Chops/Models/SchemaVersions.swift` (modified, +129/-3)
```diff
@@ -1,5 +1,131 @@
-import SwiftData
 import Foundation
+import SwiftData
+
+enum SchemaV1: VersionedSchema {
+    static var versionIdentifier = Schema.Version(1, 0, 0)
+
+    static var models: [any PersistentModel.Type] {
+        [Skill.self, SkillCollection.self, RemoteServer.self]
+    }
+
+    @Model
+    final class Skill {
+        @Attribute(.unique) var resolvedPath: String
+        var filePath: String
+        var isDirectory: Bool
+        var name: String
+        var skillDescription: String
+        var content: String
+        var frontmatterData: Data?
+
+        var collections: [SkillCollection]
+        var isFavorite: Bool
+        var lastOpened: Date?
+        var fileModifiedDate: Date
+        var fileSize: Int
+        var isGlobal: Bool
+
+        var remoteServer: RemoteServer?
+        var remotePath: String?
+
+        var toolSourcesRaw: String
+        var installedPathsData: Data?
+        var kind: String = ItemKind.skill.rawValue
+
+        init(
+            filePath: String,
+            toolSource: ToolSource,
+            isDirectory: Bool = false,
+            name: String = "",
+            skillDescription: String = "",
+            content: String = "",
+            frontmatter: [String: String] = [:],
+            collections: [SkillCollection] = [],
+            isFavorite: Bool = false,
+            lastOpened: Date? = nil,
+            fileModifiedDate: Date = .now,
+            fileSize: Int = 0,
+            isGlobal: Bool = true,
+            resolvedPath: String = "",
+            kind: ItemKind = .skill
+        ) {
+            self.resolvedPath = resolvedPath.isEmpty ? filePath : resolvedPath
+            self.filePath = filePath
+            self.toolSourcesRaw = toolSource.rawValue
+            self.installedPathsData = try? JSONEncoder().encode([filePath])
+            self.isDirectory = isDirectory
+            self.name = name
+            self.skillDescription = skillDescription
+            self.content = content
+            self.frontmatterData = try? JSONEncoder().encode(frontmatter)
+            self.collections = collections
+            self.isFavorite = isFavorite
+            self.lastOpened = lastOpened
+            self.fileModifiedDate = fileModifiedDate
+            self.fileSize = fileSize
+            self.isGlobal = isGlobal
+            self.kind = kind.rawValue
+        }
+    }
+
+    @Model
+    final class SkillCollection {
+        @Attribute(.unique) var name: String
+        var icon: String
+        var sortOrder: Int
+
+        @Relationship(inverse: \Skill.collections)
+        var skills: [Skill]
+
+        init(name: String, icon: String = "folder", skills: [Skill] = [], sortOrder: Int = 0) {
+            self.name = name
+            self.icon = icon
+            self.skills = skills
+            self.sortOrder = sortOrder
+        }
+    }
+
+    @Model
+    final class RemoteServer {
+        @Attribute(.unique) var id: String
+        var label: String
+        var host: String
+        var port: Int
+        var username: String
+        var skillsBasePath: String
+        var sshKeyPath: String?
+        var lastSyncDate: Date?
+        var lastSyncError: String?
+
+        @Relationship(deleteRule: .cascade, inverse: \Skill.remoteServer)
+        var skills: [Skill]
+
+        init(
+            label: String,
+            host: String,
+            port: Int = 22,
+            username: String,
+            skillsBasePath: String
+        ) {
+            self.id = UUID().uuidString
+            self.label = label
+            self.host = host
+            self.port = port
+            self.username = username
+            self.skillsBasePath = skillsBasePath
+            self.skills = []
+        }
+    }
+}
+
+typealias Skill = SchemaV1.Skill
+typealias SkillCollection = SchemaV1.SkillCollection
+typealias RemoteServer = SchemaV1.RemoteServer
+
+enum ChopsMigrationPlan: SchemaMigrationPlan {
+    static var schemas: [any VersionedSchema.Type] {
+        [SchemaV1.self]
+    }
 
-// No versioned schema needed — SwiftData handles additive changes
-// (new optional properties + new entities) via automatic lightweight migration.
+    static var stages: [MigrationStage] { [] }
+}
```

**File**: `Chops/Models/Skill.swift` (modified, +1/-68)
```diff
@@ -31,26 +31,7 @@ enum ItemKind: String, Codable, CaseIterable {
     }
 }
 
-@Model
-final class Skill {
-    @Attribute(.unique) var resolvedPath: String
-    var filePath: String
-    var isDirectory: Bool
-    var name: String
-    var skillDescription: String
-    var content: String
-    var frontmatterData: Data?
-
-    var collections: [SkillCollection]
-    var isFavorite: Bool
-    var lastOpened: Date?
-    var fileModifiedDate: Date
-    var fileSize: Int
-    var isGlobal: Bool
-
-    var remoteServer: RemoteServer?
-    var remotePath: String?
-
+extension Skill {
     var isRemote: Bool { remoteServer != nil }
 
     var isPlugin: Bool {
@@ -63,15 +44,6 @@ final class Skill {
         isPlugin || isBundledOpenClawSkill
     }
 
-    /// Comma-separated tool raw values (e.g. "claude,cursor,codex")
-    var toolSourcesRaw: String
-
-    /// All file paths where this skill is installed (JSON-encoded array)
-    var installedPathsData: Data?
-
-    /// Raw `ItemKind` value. Defaults to `"skill"` for lightweight migration compatibility.
-    var kind: String = ItemKind.skill.rawValue
-
     // MARK: - Computed
 
     var itemKind: ItemKind {
@@ -154,45 +126,6 @@ final class Skill {
         return nil
     }
 
-    // MARK: - Init
-
-    init(
-        filePath: String,
-        toolSource: ToolSource,
-        isDirectory: Bool = false,
-        name: String = "",
-        skillDescription: String = "",
-        content: String = "",
-        frontmatter: [String: String] = [:],
-
-        collections: [SkillCollection] = [],
-        isFavorite: Bool = false,
-        lastOpened: Date? = nil,
-        fileModifiedDate: Date = .now,
-        fileSize: Int = 0,
-        isGlobal: Bool = true,
-        resolvedPath: String = "",
-        kind: ItemKind = .skill
-    ) {
-        self.resolvedPath = resolvedPath.isEmpty ? filePath : resolvedPath
-        self.filePath = filePath
-        self.toolSourcesRaw = toolSource.rawValue
-        self.installedPathsData = try? JSONEncoder().encode([filePath]) // [String] encode never throws
-        self.isDirectory = isDirectory
-        self.name = name
-        self.skillDescription = skillDescription
-        self.content = content
-        self.frontmatterData = try? JSONEncoder().encode(frontmatter) // [String: String] encode never throws
-
-        self.collections = collections
-        self.isFavorite = isFavorite
-        self.lastOpened = lastOpened
-        self.fileModifiedDate = fileModifiedDate
-        self.fileSize = fileSize
-        self.isGlobal = isGlobal
-        self.kind = kind.rawValue
-    }
-
     // MARK: - Merge
 
     /// Merge another location/tool into this skill
```

**File**: `Chops/Services/StoreBootstrap.swift` (added, +156/-0)
```diff
@@ -0,0 +1,156 @@
+import Foundation
+import SwiftData
+
+enum StoreBootstrap {
+    static func makeConfiguration(schema: Schema) throws -> ModelConfiguration {
+        let storeURL = try prepareStoreURL(schema: schema)
+        return ModelConfiguration(schema: schema, url: storeURL)
+    }
+
+    private static func prepareStoreURL(schema: Schema) throws -> URL {
+        let fm = FileManager.default
+        let appSupportURL = try appSupportDirectory(using: fm)
+        let storeURL = appSupportURL.appendingPathComponent("Chops.store")
+
+        if !fm.fileExists(atPath: storeURL.path) {
+            try? removeStoreFiles(at: storeURL)
+            let legacyURL = try legacyStoreURL(using: fm)
+            if fm.fileExists(atPath: legacyURL.path) {
+                try migrateLegacyStore(from: legacyURL, to: storeURL, schema: schema)
+            }
+        }
+
+        return storeURL
+    }
+
+    private static func appSupportDirectory(using fm: FileManager) throws -> URL {
+        guard let baseURL = fm.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
+            throw CocoaError(.fileNoSuchFile)
+        }
+
+        let appSupportURL = baseURL.appendingPathComponent("Chops", isDirectory: true)
+        try fm.createDirectory(at: appSupportURL, withIntermediateDirectories: true)
+        return appSupportURL
+    }
+
+    private static func legacyStoreURL(using fm: FileManager) throws -> URL {
+        guard let baseURL = fm.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
+            throw CocoaError(.fileNoSuchFile)
+        }
+
+        return baseURL.appendingPathComponent("default.store")
+    }
+
+    private static func migrateLegacyStore(from legacyURL: URL, to storeURL: URL, schema: Schema) throws {
+        let legacyConfig = ModelConfiguration(schema: schema, url: legacyURL)
+        let storeConfig = ModelConfiguration(schema: schema, url: storeURL)
+
+        do {
+            let legacyContainer = try ModelContainer(
+                for: schema,
+                migrationPlan: ChopsMigrationPlan.self,
+                configurations: [legacyConfig]
+            )
+            let legacyContext = ModelContext(legacyContainer)
+
+            let storeContainer = try ModelContainer(
+                for: schema,
+                migrationPlan: ChopsMigrationPlan.self,
+                configurations: [storeConfig]
+            )
+            let storeContext = ModelContext(storeContainer)
+
+            try copyRemoteServers(from: legacyContext, to: storeContext)
+            try copyCollections(from: legacyContext, to: storeContext)
+            try copySkills(from: legacyContext, to: storeContext)
+            try storeContext.save()
+        } catch {
+            try? removeStoreFiles(at: storeURL)
+            throw error
+        }
+    }
+
+    private static func copyRemoteServers(from legacyContext: ModelContext, to storeContext: ModelContext) throws {
+        let descriptor = FetchDescriptor<RemoteServer>()
+        for legacyServer in try legacyContext.fetch(descriptor) {
+            let server = RemoteServer(
+                label: legacyServer.label,
+                host: legacyServer.host,
+                port: legacyServer.port,
+                username: legacyServer.username,
+                skillsBasePath: legacyServer.skillsBasePath
+            )
+            server.id = legacyServer.id
+            server.sshKeyPath = legacyServer.sshKeyPath
+            server.lastSyncDate = legacyServer.lastSyncDate
+            server.lastSyncError = legacyServer.lastSyncError
+            storeContext.insert(server)
+        }
+
+        try storeContext.save()
+    }
+
+    private static func copyCollections(from legacyContext: ModelContext, to storeContext: ModelContext) throws {
+        let descriptor = FetchDescriptor<SkillCollection>()
+        for legacyCollection in try legacyContext.fetch(descriptor) {
+            let collection = SkillCollection(
+                name: legacyCollection.name,
+                icon: legacyCollection.icon,
+                sortOrder: legacyCollection.sortOrder
+            )
+            storeContext.insert(collection)
+        }
+
+        try storeContext.save()
+    }
+
+    private static func copySkills(from legacyContext: ModelContext, to storeContext: ModelContext) throws {
+        let remoteServers = try storeContext.fetch(FetchDescriptor<RemoteServer>())
+        let collections = try storeContext.fetch(FetchDescriptor<SkillCollection>())
+
+        let serversByID = Dictionary(uniqueKeysWithValues: remoteServers.map { ($0.id, $0) })
+        let collectionsByName = Dictionary(uniqueKeysWithValues: collections.map { ($0.name, $0) })
+
+        let descriptor = FetchDescriptor<Skill>()
+        for legacySkill in try legacyContext.fetch(descriptor) {
+            let skill = Skill(
+                filePath: legacySkill.filePath,
+                toolSource: legacyS
```

---

### Incident Patch 5: `0f261723` (2026-03-31)
**Commit Message**: fix: show Global tool source in sidebar when skills exist (#85)

The `listable` property was introduced in #69 (ACP support) and
grouped `.agents` with other non-listable tool sources like `.custom`
and `.claudeDesktop`. This was unintentional — `.agents` (display name
"Global") had been visible in the sidebar since it was added in #42,
and the `listable` gate silently hid it.

Users with skills in `~/.agents/skills/` (either created manually or
via the "Make Global" action) could not see or filter by the Global
tool in the sidebar, even though those skills were scanned and stored
correctly.

Remove `.agents` from the non-listable cases so it appears in the
sidebar Tools section like any other installed tool.

Made-with: Cursor

**File**: `Chops/Models/ToolSource.swift` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ enum ToolSource: String, Codable, CaseIterable, Identifiable {
     /// Whether this tool should appear in the sidebar tools list.
     var listable: Bool {
         switch self {
-        case .custom, .claudeDesktop, .agents, .aider:
+        case .custom, .claudeDesktop, .aider:
             return false
         default:
             return true
```

---

### Incident Patch 6: `ac22f511` (2026-03-31)
**Commit Message**: fix: Defer AI Assist file writes until user accepts the diff (#84)

File writes from the ACP agent were hitting disk immediately — before the
user could review the diff. Now writes are deferred until Accept is clicked.
In bypass-permissions mode, writes auto-apply and diffs are shown as accepted.
System prompts updated to tell the agent its writes are proposals, not final.

**File**: `Chops/Services/ACP/ACPClient.swift` (modified, +36/-12)
```diff
@@ -33,7 +33,21 @@ open class BaseACPAgent: ClientDelegate {
     var thoughtText: String = ""
     var currentActivity: String?
     var pendingWrites: [PendingWrite] = []
+    /// Maps resolved file paths to proposed content not yet accepted by the user.
+    /// Lets handleFileReadRequest return the "virtual" state during the same turn.
+    var deferredContent: [String: String] = [:]
     private(set) var sessionConfigOptions: [SessionConfigOption] = []
+
+    /// True when the agent's permission mode is set to bypass — writes should be
+    /// auto-accepted without user review.
+    var isBypassMode: Bool {
+        sessionConfigOptions.contains { option in
+            if case .select(let select) = option.kind {
+                return select.currentValue.value.lowercased().contains("bypass")
+            }
+            return false
+        }
+    }
     private(set) var pendingPermissionRequest: PermissionRequest?
     private(set) var isConnected: Bool = false
     private(set) var isConnecting: Bool = false
@@ -224,7 +238,7 @@ open class BaseACPAgent: ClientDelegate {
         acpLog.debug("Prompt done: \(resp.stopReason)")
     }
 
-    func clearPendingWrites() { pendingWrites = [] }
+    func clearPendingWrites() { pendingWrites = []; deferredContent = [:] }
 
     /// Sends a session/cancel notification to the agent to interrupt the current turn.
     func cancelPrompt() {
@@ -260,13 +274,18 @@ open class BaseACPAgent: ClientDelegate {
 
     public func handleFileReadRequest(_ path: String, sessionId: String, line: Int?, limit: Int?) async throws -> ReadTextFileResponse {
         acpLog.debug("readTextFile: \(path)")
+        let resolved = URL(fileURLWithPath: path).resolvingSymlinksInPath().path
+        if let deferred = deferredContent[resolved] {
+            acpLog.debug("Returning deferred content for: \(path)")
+            return ReadTextFileResponse(content: deferred)
+        }
         let content = try await Task.detached { try String(contentsOfFile: path, encoding: .utf8) }.value
         return ReadTextFileResponse(content: content)
     }
 
     public func handleFileWriteRequest(_ path: String, content: String, sessionId: String) async throws -> WriteTextFileResponse {
         acpLog.debug("Write via ACP: \(path)")
-        // Read original before writing so reject can revert.
+        // Read original snapshot so the diff panel can show before/after.
         // Skip if a diff block already captured this path (e.g. ClaudeACPAgent.captureDiffs).
         // Resolve symlinks on both sides so that e.g. a symlink path and its target compare equal.
         let resolvedIncoming = URL(fileURLWithPath: path).resolvingSymlinksInPath().path
@@ -281,7 +300,7 @@ open class BaseACPAgent: ClientDelegate {
                     do {
                         originalData = try Data(contentsOf: URL(fileURLWithPath: path))
                     } catch {
-                        acpLog.error("Failed to read original for diff revert (\(path)): \(error.localizedDescription)")
+                        acpLog.error("Failed to read original for diff (\(path)): \(error.localizedDescription)")
                         originalData = nil
                     }
                 } else {
@@ -299,15 +318,20 @@ open class BaseACPAgent: ClientDelegate {
                 )
             )
         }
-        // Write to disk — agent expects the file to be persisted.
-        try await Task.detached {
-            let url = URL(fileURLWithPath: path)
-            let parent = url.deletingLastPathComponent()
-            if !FileManager.default.fileExists(atPath: parent.path) {
-                try FileManager.default.createDirectory(at: parent, withIntermediateDirectories: true)
-            }
-            try content.write(to: url, atomically: true, encoding: .utf8)
-        }.value
+        // Store proposed content so subsequent agent reads return it.
+        deferredContent[resolvedIncoming] = content
+        if isBypassMode {
+            // Bypass mode: write to disk immediately — user opted out of review.
+            try await Task.detached {
+                let url = URL(fileURLWithPath: path)
+                let parent = url.deletingLastPathComponent()
+                if !FileManager.default.fileExists(atPath: parent.path) {
+                    try FileManager.default.createDirectory(at: parent, withIntermediateDirectories: true)
+                }
+                try content.write(to: url, atomically: true, encoding: .utf8)
+            }.value
+        }
+        // Non-bypass: do NOT write to disk — deferred until user accepts the diff.
         return WriteTextFileResponse()
     }
 
```

**File**: `Chops/Services/TemplateManager.swift` (modified, +6/-3)
```diff
@@ -274,7 +274,8 @@ final class TemplateManager {
     ## Your role
     When the user asks you to create or update this skill, use the ACP `write_text_file` tool to write the complete updated file content directly to the file path shown above.
     Do not show the content in a code block or ask for confirmation — write it directly via `write_text_file`.
-    Always write the full file, including YAML frontmatter.
+    Write the complete file including YAML frontmatter. Preserve all unchanged lines exactly as they appear — do not reformat, reindent, or alter any content you are not intentionally changing.
+    Important: Your file writes are proposals that the user must review and accept before they take effect. Frame your responses accordingly — say "I've proposed the changes" or "Here are the changes for your review", not "Done" or "I've updated the file".
     """
 
     private static let defaultAgentSystemPrompt = """
@@ -290,7 +291,8 @@ final class TemplateManager {
     ## Your role
     When the user asks you to create or update this agent, use the ACP `write_text_file` tool to write the complete updated file content directly to the file path shown above.
     Do not show the content in a code block or ask for confirmation — write it directly via `write_text_file`.
-    Always write the full file, including YAML frontmatter.
+    Write the complete file including YAML frontmatter. Preserve all unchanged lines exactly as they appear — do not reformat, reindent, or alter any content you are not intentionally changing.
+    Important: Your file writes are proposals that the user must review and accept before they take effect. Frame your responses accordingly — say "I've proposed the changes" or "Here are the changes for your review", not "Done" or "I've updated the file".
     """
 
     private static let defaultRuleSystemPrompt = """
@@ -306,7 +308,8 @@ final class TemplateManager {
     ## Your role
     When the user asks you to create or update this rule, use the ACP `write_text_file` tool to write the complete updated file content directly to the file path shown above.
     Do not show the content in a code block or ask for confirmation — write it directly via `write_text_file`.
-    Always write the full file, including YAML frontmatter.
+    Write the complete file including YAML frontmatter. Preserve all unchanged lines exactly as they appear — do not reformat, reindent, or alter any content you are not intentionally changing.
+    Important: Your file writes are proposals that the user must review and accept before they take effect. Frame your responses accordingly — say "I've proposed the changes" or "Here are the changes for your review", not "Done" or "I've updated the file".
     """
 
 }
```

**File**: `Chops/Views/Shared/ComposePanel.swift` (modified, +73/-39)
```diff
@@ -4,6 +4,11 @@ import SwiftUI
 
 /// Inline panel for composing/editing skill content with ACP
 struct ComposePanel: View {
+    private struct DiffApplyError: Identifiable {
+        let id = UUID()
+        let message: String
+    }
+
     @Binding var content: String
     @Binding var isVisible: Bool
     let skillName: String
@@ -30,6 +35,8 @@ struct ComposePanel: View {
     @State private var panelHeight: CGFloat = ComposeConstants.defaultPanelHeight
     @State private var isDragging = false
     @State private var dragStartHeight: CGFloat?
+    @State private var applyingDiffID: String?
+    @State private var diffApplyError: DiffApplyError?
 
     private static let minPanelHeight: CGFloat = 160
     private static let maxPanelHeight: CGFloat = 700
@@ -109,6 +116,13 @@ struct ComposePanel: View {
                 permissionSheet(request: request)
             }
         }
+        .alert(item: $diffApplyError) { error in
+            Alert(
+                title: Text("Apply Failed"),
+                message: Text(error.message),
+                dismissButton: .default(Text("OK"))
+            )
+        }
     }
 
     @ViewBuilder
@@ -575,7 +589,8 @@ struct ComposePanel: View {
                 original: diff.original ?? "",
                 proposed: diff.proposed,
                 onAccept: { acceptDiff(messageId: messageId, diffIndex: diffIndex) },
-                onReject: { rejectDiff(messageId: messageId, diffIndex: diffIndex) }
+                onReject: { rejectDiff(messageId: messageId, diffIndex: diffIndex) },
+                isApplying: applyingDiffID == diffActionID(messageId: messageId, diffIndex: diffIndex)
             )
             .frame(height: 260)
             .clipShape(RoundedRectangle(cornerRadius: 8))
@@ -805,10 +820,11 @@ struct ComposePanel: View {
 
     /// Attaches diffs from pending writes or disk changes; logs text-only turns.
     private func handleWrites(client: BaseACPAgent, messageId: UUID, filePath: String, originalContent: String) async {
-        acpLog.info("Compose: handleWrites — filePath=\(filePath) originalContent.count=\(originalContent.count)")
+        let autoAccept = client.isBypassMode
+        acpLog.info("Compose: handleWrites — filePath=\(filePath) originalContent.count=\(originalContent.count) autoAccept=\(autoAccept)")
         if !client.pendingWrites.isEmpty {
             acpLog.info("Compose: attaching \(client.pendingWrites.count) diff(s) from write_text_file")
-            await attachDiffs(messageId: messageId, writes: client.pendingWrites, fallbackOriginal: originalContent)
+            await attachDiffs(messageId: messageId, writes: client.pendingWrites, fallbackOriginal: originalContent, autoAccept: autoAccept)
             client.clearPendingWrites()
             return
         }
@@ -826,7 +842,8 @@ struct ComposePanel: View {
                         existedBefore: true
                     )
                 ],
-                fallbackOriginal: originalContent
+                fallbackOriginal: originalContent,
+                autoAccept: autoAccept
             )
         }
     }
@@ -843,7 +860,8 @@ struct ComposePanel: View {
     private func attachDiffs(
         messageId: UUID,
         writes: [PendingWrite],
-        fallbackOriginal: String
+        fallbackOriginal: String,
+        autoAccept: Bool = false
     ) async {
         guard let idx = messages.firstIndex(where: { $0.id == messageId }) else { return }
         let resolvedFilePath = resolvedPath(filePath)
@@ -881,31 +899,17 @@ struct ComposePanel: View {
             )
         }
         messages[idx].diffs = diffs
-    }
-
-    private func pendingDiffs() -> [ChatDiff] {
-        messages.flatMap(\.diffs).filter { $0.status == .pending }
-    }
 
-    nonisolated private static func revertDiffOnDisk(_ diff: ChatDiff) {
-        let url = URL(fileURLWithPath: diff.path)
-        if diff.existedBefore {
-            do {
-                if let originalData = diff.originalData {
-                    try originalData.write(to: url)
-                } else if let original = diff.original {
-                    try original.write(to: url, atomically: true, encoding: .utf8)
-                } else {
-                    acpLog.error("Reject failed: missing original snapshot for \(diff.path)")
+        if autoAccept {
+            // Bypass mode: auto-accept all diffs. Disk writes already happened in handleFileWriteRequest.
+            let resolvedFilePath = resolvedPath(filePath)
+            for i in messages[idx].diffs.indices {
+                messages[idx].diffs[i].status = .accepted
+                let diff = messages[idx].diffs[i]
+                if resolvedPath(diff.path) == resolvedFilePath {
+                    content = diff.proposed
+                    onAccept()
                 }
-            } catch {
-                acpLog.error("Reject failed writing \(diff.path): \(error.localizedDescription)")
-            }
-        } else {
```

**File**: `Chops/Views/Shared/DiffReviewPanel.swift` (modified, +6/-2)
```diff
@@ -100,6 +100,7 @@ struct DiffReviewPanel: View {
     let proposed: String
     let onAccept: () -> Void
     let onReject: () -> Void
+    var isApplying = false
 
     @State private var lines: [DiffLine] = []
 
@@ -146,12 +147,14 @@ struct DiffReviewPanel: View {
             Button("Reject", action: onReject)
                 .buttonStyle(.bordered)
                 .controlSize(.small)
+                .disabled(isApplying)
 
-            Button("Accept", action: onAccept)
+            Button(isApplying ? "Applying..." : "Accept", action: onAccept)
                 .buttonStyle(.borderedProminent)
                 .controlSize(.small)
                 .tint(.green)
                 .keyboardShortcut(.return, modifiers: .command)
+                .disabled(isApplying)
         }
         .padding(.horizontal, 12)
         .padding(.vertical, 6)
@@ -189,7 +192,8 @@ struct DiffReviewPanel: View {
         original: "# My Skill\n\nOld content here.\nLine two.\n",
         proposed: "# My Skill\n\nNew content here.\nLine two.\nLine three added.\n",
         onAccept: {},
-        onReject: {}
+        onReject: {},
+        isApplying: false
     )
     .frame(width: 600, height: 300)
 }
```

---

### Incident Patch 7: `cf006faa` (2026-03-31)
**Commit Message**: fix: Stop .agents symlink dirs from falsely detecting uninstalled tools (#82)

The OpenClaw commit (ef6c614) added globalPaths.contains as a fallback
to every tool's isInstalled check. Since the .agents spec creates
symlink skill directories for tools (e.g. ~/.augment/skills/ ->
~/.agents/skills/), this caused Auggie, OpenCode, Pi, and Antigravity
to appear as installed with skills when they aren't.

Remove the globalPaths fallback from all isInstalled checks. Tools
should only be detected by actual installation artifacts (binaries, app
bundles, config files). Also tighten Augment detection from bare
~/.augment directory check to app bundle check.

**File**: `Chops/Models/ToolSource.swift` (modified, +2/-13)
```diff
@@ -194,42 +194,33 @@ enum ToolSource: String, Codable, CaseIterable, Identifiable {
                 || fm.fileExists(atPath: "\(home)/.claude/CLAUDE.md")
                 || fm.fileExists(atPath: "\(home)/.claude/plugins/installed_plugins.json")
                 || Self.cliBinaryExists("claude")
-                || globalPaths.contains { fm.fileExists(atPath: $0) }
         case .cursor:
             return fm.fileExists(atPath: "/Applications/Cursor.app")
                 || fm.fileExists(atPath: "\(home)/.cursor/argv.json")
-                || globalPaths.contains { fm.fileExists(atPath: $0) }
         case .windsurf:
             return fm.fileExists(atPath: "/Applications/Windsurf.app")
                 || fm.fileExists(atPath: "\(home)/.codeium/windsurf/argv.json")
-                || globalPaths.contains { fm.fileExists(atPath: $0) }
-                || globalRulePaths.contains { fm.fileExists(atPath: $0) }
         case .codex:
             return fm.fileExists(atPath: "\(home)/.codex/config.toml")
                 || fm.fileExists(atPath: "\(home)/.codex/auth.json")
                 || Self.cliBinaryExists("codex")
-                || globalPaths.contains { fm.fileExists(atPath: $0) }
         case .amp:
             let configHome = ProcessInfo.processInfo.environment["XDG_CONFIG_HOME"]
                 .flatMap { $0.isEmpty ? nil : $0 } ?? "\(home)/.config"
             return fm.fileExists(atPath: "\(configHome)/amp/config.json")
                 || fm.fileExists(atPath: "\(configHome)/amp/settings.json")
                 || Self.cliBinaryExists("amp")
-                || globalPaths.contains { fm.fileExists(atPath: $0) }
         case .pi:
             return Self.cliBinaryExists("pi")
-                || globalPaths.contains { fm.fileExists(atPath: $0) }
         case .copilot:
             return fm.fileExists(atPath: "\(home)/.copilot")
                 || Self.cliBinaryExists("copilot")
-                || globalPaths.contains { fm.fileExists(atPath: $0) }
         case .agents:
             return fm.fileExists(atPath: "\(home)/.agents/skills")
         case .antigravity:
             return Self.appBundleExists("Antigravity")
                 || fm.fileExists(atPath: "\(home)/.antigravity")
                 || Self.cliBinaryExists("antigravity")
-                || globalPaths.contains { fm.fileExists(atPath: $0) }
         case .opencode:
             let configHome = ProcessInfo.processInfo.environment["XDG_CONFIG_HOME"]
                 .flatMap { $0.isEmpty ? nil : $0 } ?? "\(home)/.config"
@@ -238,19 +229,17 @@ enum ToolSource: String, Codable, CaseIterable, Identifiable {
                 || fm.fileExists(atPath: "\(configHome)/opencode/opencode.jsonc")
                 || fm.fileExists(atPath: "\(home)/.local/share/opencode")
                 || Self.cliBinaryExists("opencode")
-                || globalPaths.contains { fm.fileExists(atPath: $0) }
         case .augment:
-            return fm.fileExists(atPath: "\(home)/.augment")
+            return Self.appBundleExists("Augment")
+                || fm.fileExists(atPath: "\(home)/.augment/settings.json")
                 || Self.cliBinaryExists("augment")
-                || globalPaths.contains { fm.fileExists(atPath: $0) }
         case .claudeDesktop:
             return Self.appBundleExists("Claude")
         case .openclaw:
             return fm.fileExists(atPath: "\(home)/.openclaw")
                 || Self.cliBinaryExists("openclaw")
                 || fm.fileExists(atPath: "/opt/homebrew/lib/node_modules/openclaw")
                 || fm.fileExists(atPath: "/usr/local/lib/node_modules/openclaw")
-                || globalPaths.contains { fm.fileExists(atPath: $0) }
         case .aider, .custom:
             return true
         }
```

---

### Incident Patch 8: `b94e725a` (2026-03-31)
**Commit Message**: fix: Avoid GitHub API rate limits in Browse Registry (#80)

Try convention-based paths via raw.githubusercontent.com (CDN) before
falling back to the rate-limited GitHub tree API. This eliminates
api.github.com calls for the vast majority of skills.

Fixes #78

**File**: `Chops/Services/SkillRegistry.swift` (modified, +51/-10)
```diff
@@ -5,8 +5,8 @@ final class SkillRegistry {
     var isSearching = false
     var searchError: String?
 
-    // Cache repo trees and default branches to avoid repeated API calls
-    private var treeCache: [String: [String]] = [:] // source -> [SKILL.md paths]
+    // Cache repo metadata to avoid repeated GitHub API calls
+    private var treeCache: [String: [String]] = [:] // source@branch -> [SKILL.md paths]
     private var branchCache: [String: String] = [:] // source -> default branch
 
     // MARK: - Search
@@ -52,9 +52,45 @@ final class SkillRegistry {
 
     func fetchContent(skill: RegistrySkill) async throws -> String {
         let branch = try await getDefaultBranch(source: skill.source)
+
+        if let content = try await fetchContentAtConventionalPaths(skill: skill, branch: branch) {
+            return content
+        }
+
+        return try await fetchContentViaTreeAPI(skill: skill, branch: branch)
+    }
+
+    private func fetchContentAtConventionalPaths(skill: RegistrySkill, branch: String) async throws -> String? {
+        let pathPatterns = [
+            "skills/\(skill.skillId)/SKILL.md",
+            "skills/.curated/\(skill.skillId)/SKILL.md",
+            "skills/.experimental/\(skill.skillId)/SKILL.md",
+            "\(skill.skillId)/SKILL.md",
+            "SKILL.md",
+        ]
+
+        for path in pathPatterns {
+            let rawURL = URL(string: "https://raw.githubusercontent.com/\(skill.source)/\(branch)/\(path)")!
+            guard let (data, response) = try? await URLSession.shared.data(from: rawURL),
+                  let http = response as? HTTPURLResponse, http.statusCode == 200,
+                  let content = String(data: data, encoding: .utf8) else {
+                continue
+            }
+
+            if path == "SKILL.md" {
+                let name = parseFrontmatterName(from: content)
+                if name != skill.skillId && name != skill.name { continue }
+            }
+
+            return content
+        }
+
+        return nil
+    }
+
+    private func fetchContentViaTreeAPI(skill: RegistrySkill, branch: String) async throws -> String {
         let paths = try await getSkillPaths(source: skill.source, branch: branch)
 
-        // Try each SKILL.md path until we find one whose frontmatter name matches
         for path in paths {
             let rawURL = URL(string: "https://raw.githubusercontent.com/\(skill.source)/\(branch)/\(path)")!
             guard let (data, response) = try? await URLSession.shared.data(from: rawURL),
@@ -63,7 +99,6 @@ final class SkillRegistry {
                 continue
             }
 
-            // Check if this SKILL.md's frontmatter name matches the skillId
             let frontmatterName = parseFrontmatterName(from: content)
             if frontmatterName == skill.skillId || frontmatterName == skill.name {
                 return content
@@ -80,9 +115,14 @@ final class SkillRegistry {
 
         let url = URL(string: "https://api.github.com/repos/\(source)")!
         let (data, response) = try await URLSession.shared.data(from: url)
-        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
-            // Fall back to "main" if we can't determine default branch
-            return "main"
+        guard let http = response as? HTTPURLResponse else {
+            throw RegistryError.treeFetchFailed
+        }
+        if http.statusCode == 403 {
+            throw RegistryError.rateLimited
+        }
+        guard http.statusCode == 200 else {
+            throw RegistryError.treeFetchFailed
         }
 
         struct RepoResponse: Codable {
@@ -95,7 +135,8 @@ final class SkillRegistry {
     }
 
     private func getSkillPaths(source: String, branch: String) async throws -> [String] {
-        if let cached = treeCache[source] {
+        let cacheKey = "\(source)@\(branch)"
+        if let cached = treeCache[cacheKey] {
             return cached
         }
 
@@ -121,10 +162,10 @@ final class SkillRegistry {
 
         let tree = try JSONDecoder().decode(TreeResponse.self, from: data)
         let skillPaths = tree.tree
-            .filter { $0.type == "blob" && $0.path.hasSuffix("/SKILL.md") }
+            .filter { $0.type == "blob" && ($0.path == "SKILL.md" || $0.path.hasSuffix("/SKILL.md")) }
             .map(\.path)
 
-        treeCache[source] = skillPaths
+        treeCache[cacheKey] = skillPaths
         return skillPaths
     }
 
```

**File**: `Chops/Views/Shared/RegistrySheet.swift` (modified, +5/-4)
```diff
@@ -101,14 +101,14 @@ struct RegistrySheet: View {
             Divider()
 
             // Results
-            if results.isEmpty && !isSearching && searchText.isEmpty {
+            if results.isEmpty && (isSearching || searchText.count < 2) {
                 ContentUnavailableView {
                     Label("Search the Skills Registry", systemImage: "globe")
                 } description: {
                     Text("Find and install skills from the open agent skills ecosystem.")
                 }
                 .frame(maxHeight: .infinity)
-            } else if results.isEmpty && !isSearching && !searchText.isEmpty {
+            } else if results.isEmpty && !isSearching && searchText.count >= 2 {
                 ContentUnavailableView.search(text: searchText)
                     .frame(maxHeight: .infinity)
             } else {
@@ -286,15 +286,16 @@ struct RegistrySheet: View {
 
         guard query.count >= 2 else {
             results = []
+            isSearching = false
             return
         }
 
+        isSearching = true
+
         searchTask = Task {
             try? await Task.sleep(for: .milliseconds(300))
             guard !Task.isCancelled else { return }
 
-            await MainActor.run { isSearching = true }
-
             do {
                 let skills = try await registry.search(query: query)
                 guard !Task.isCancelled else { return }
```

**File**: `Chops/Views/Sidebar/SkillListView.swift` (modified, +1/-1)
```diff
@@ -230,7 +230,7 @@ struct SkillListView: View {
                             Label("Browse Registry", systemImage: "globe")
                         }
                     } label: {
-                        Image(systemName: "square.and.pencil")
+                        Image(systemName: "plus")
                     }
                     .menuIndicator(.hidden)
                 }
```

---

### Incident Patch 9: `247f5008` (2026-03-31)
**Commit Message**: fix: Discover skills directly inside custom scan directories (#79)

Fixes #68

**File**: `Chops/App/ContentView.swift` (modified, +1/-0)
```diff
@@ -57,6 +57,7 @@ struct ContentView: View {
         for tool in ToolSource.allCases {
             allPaths.append(contentsOf: tool.globalPaths)
             allPaths.append(contentsOf: tool.globalAgentPaths)
+            allPaths.append(contentsOf: tool.globalRulePaths)
         }
         let fm = FileManager.default
         let home = fm.homeDirectoryForCurrentUser.path
```

**File**: `Chops/Services/SkillScanner.swift` (modified, +52/-0)
```diff
@@ -131,6 +131,9 @@ final class SkillScanner {
 
     private static func collectFromCustomDirectory(_ directory: URL, into results: inout [ScannedSkillData]) {
         let fm = FileManager.default
+
+        collectDirectSkillsFromCustomDirectory(directory, into: &results)
+
         guard let projects = try? fm.contentsOfDirectory(
             at: directory,
             includingPropertiesForKeys: [.isDirectoryKey],
@@ -161,6 +164,55 @@ final class SkillScanner {
         }
     }
 
+    /// Custom scan paths serve two different jobs:
+    /// - parent dirs like ~/Development that contain projects with tool-specific folders
+    /// - library dirs that contain skills directly as child folders/files
+    ///
+    /// Only scan direct skill-style entries here so repo-level AGENTS.md files do not become
+    /// bogus custom skills when the user adds a generic project parent directory.
+    private static func collectDirectSkillsFromCustomDirectory(_ directory: URL, into results: inout [ScannedSkillData]) {
+        let fm = FileManager.default
+
+        guard let contents = try? fm.contentsOfDirectory(
+            at: directory,
+            includingPropertiesForKeys: [.isDirectoryKey],
+            options: [.skipsHiddenFiles]
+        ) else { return }
+
+        for item in contents {
+            guard !Task.isCancelled else { return }
+
+            var isDirectory: ObjCBool = false
+            fm.fileExists(atPath: item.path, isDirectory: &isDirectory)
+
+            if isDirectory.boolValue {
+                let skillFile = item.appendingPathComponent("SKILL.md")
+                guard fm.fileExists(atPath: skillFile.path) else { continue }
+                if let data = collectSkillData(
+                    at: skillFile,
+                    toolSource: .custom,
+                    isDirectory: true,
+                    isGlobal: false,
+                    kind: .skill
+                ) {
+                    results.append(data)
+                }
+            } else {
+                guard ["md", "mdc", "toml"].contains(item.pathExtension) else { continue }
+                guard !shouldIgnoreLooseMarkdownFile(named: item.lastPathComponent) else { continue }
+                if let data = collectSkillData(
+                    at: item,
+                    toolSource: .custom,
+                    isDirectory: false,
+                    isGlobal: false,
+                    kind: .skill
+                ) {
+                    results.append(data)
+                }
+            }
+        }
+    }
+
     private static func collectFromDirectory(_ directory: URL, toolSource: ToolSource, isGlobal: Bool, kind: ItemKind = .skill, into results: inout [ScannedSkillData]) {
         let fm = FileManager.default
 
```

**File**: `Chops/Views/Shared/NewSkillSheet.swift` (modified, +0/-6)
```diff
@@ -74,12 +74,6 @@ struct NewSkillSheet: View {
 
     private func createItem() {
         let fm = FileManager.default
-        let configHome: String = {
-            if let xdg = ProcessInfo.processInfo.environment["XDG_CONFIG_HOME"], !xdg.isEmpty {
-                return xdg
-            }
-            return "\(fm.homeDirectoryForCurrentUser.path)/.config"
-        }()
         let sanitizedName = skillName
             .lowercased()
             .replacingOccurrences(of: " ", with: "-")
```

---

### Incident Patch 10: `1fa1b9a0` (2026-03-28)
**Commit Message**: feat: improve ACP compose panel UX

- Remove wizard template dropdown (single-option stub)
- Move model/provider pickers to toolbar right side
- Add centered agent picker empty state with connect flow
- Clear chat when switching skills
- Persist agent connection across skill switches
- Fix input field alignment and send button sizing
- Fix settings window width with ACP section
- Auto-select agent when first enabled in settings

**File**: `Chops/Services/ACP/ACPClient.swift` (modified, +43/-6)
```diff
@@ -12,6 +12,14 @@ struct PermissionRequest: Identifiable, @unchecked Sendable {
     let continuation: CheckedContinuation<RequestPermissionResponse, Error>
 }
 
+struct PendingWrite: Sendable {
+    let path: String
+    let content: String
+    let originalText: String?
+    let originalData: Data?
+    let existedBefore: Bool
+}
+
 /// Base class for ACP agent interaction. Owns an `ACP.Client` actor and conforms to `ClientDelegate`.
 /// Subclass to override vendor-specific hooks: additionalFlags, postProcess, conversationalText,
 /// resolvePermission, and the onXxx stream callbacks.
@@ -24,7 +32,7 @@ open class BaseACPAgent: ClientDelegate {
     var responseText: String = ""
     var thoughtText: String = ""
     var currentActivity: String?
-    var pendingWrites: [(path: String, content: String, original: String?)] = []
+    var pendingWrites: [PendingWrite] = []
     private(set) var sessionConfigOptions: [SessionConfigOption] = []
     private(set) var pendingPermissionRequest: PermissionRequest?
     private(set) var isConnected: Bool = false
@@ -122,6 +130,12 @@ open class BaseACPAgent: ClientDelegate {
         connectTask = nil
         notificationTask?.cancel()
         notificationTask = nil
+        // Resume any parked permission continuation before tearing down —
+        // CheckedContinuation will crash if it is never resumed.
+        if let req = pendingPermissionRequest {
+            pendingPermissionRequest = nil
+            req.continuation.resume(returning: RequestPermissionResponse(outcome: PermissionOutcome(cancelled: true)))
+        }
         let client = acpClient
         acpClient = nil
         sessionId = nil
@@ -153,6 +167,11 @@ open class BaseACPAgent: ClientDelegate {
     private func onAgentDisconnected() {
         if isConnected {
             isConnected = false
+            // Resume any parked permission continuation so it doesn't leak.
+            if let req = pendingPermissionRequest {
+                pendingPermissionRequest = nil
+                req.continuation.resume(returning: RequestPermissionResponse(outcome: PermissionOutcome(cancelled: true)))
+            }
             acpLog.debug("Agent process ended")
         }
     }
@@ -243,11 +262,24 @@ open class BaseACPAgent: ClientDelegate {
             URL(fileURLWithPath: $0.path).resolvingSymlinksInPath().path == resolvedIncoming
         }
         if !alreadyCaptured {
-            let original = await Task.detached {
-                (try? String(contentsOfFile: path, encoding: .utf8))
-                    ?? (try? String(contentsOfFile: path, encoding: .utf16))
+            let snapshot = await Task.detached {
+                let existedBefore = FileManager.default.fileExists(atPath: path)
+                let originalData = existedBefore ? try? Data(contentsOf: URL(fileURLWithPath: path)) : nil
+                return (
+                    existedBefore,
+                    originalData,
+                    Self.decodeText(from: originalData)
+                )
             }.value
-            pendingWrites.append((path: path, content: content, original: original))
+            pendingWrites.append(
+                PendingWrite(
+                    path: path,
+                    content: content,
+                    originalText: snapshot.2,
+                    originalData: snapshot.1,
+                    existedBefore: snapshot.0
+                )
+            )
         }
         // Write to disk — agent expects the file to be persisted.
         try await Task.detached {
@@ -351,6 +383,12 @@ open class BaseACPAgent: ClientDelegate {
         acpLog.error("'\(name)' not found in PATH — launch will likely fail")
         return name
     }
+
+    nonisolated static func decodeText(from data: Data?) -> String? {
+        guard let data else { return nil }
+        return String(data: data, encoding: .utf8)
+            ?? String(data: data, encoding: .utf16)
+    }
 }
 
 // MARK: - Errors
@@ -369,4 +407,3 @@ enum ACPClientError: Error, LocalizedError {
         }
     }
 }
-
```

**File**: `Chops/Services/ACP/Agents/ClaudeACPAgent.swift` (modified, +29/-6)
```diff
@@ -89,15 +89,38 @@ final class ClaudeACPAgent: BaseACPAgent {
         guard let content else { return }
         for item in content {
             guard case .diff(let d) = item else { continue }
-            let oldText: String? = d.oldText
-                ?? (try? String(contentsOfFile: d.path, encoding: .utf8))
-                ?? (try? String(contentsOfFile: d.path, encoding: .utf16))
+            let existedBefore = FileManager.default.fileExists(atPath: d.path)
+            let oldData: Data? = if let oldText = d.oldText {
+                oldText.data(using: .utf8)
+            } else if existedBefore {
+                try? Data(contentsOf: URL(fileURLWithPath: d.path))
+            } else {
+                nil
+            }
+            let oldText = d.oldText ?? BaseACPAgent.decodeText(from: oldData)
             // Replace any existing entry for this path — Claude may emit multiple diff blocks
             // for the same file (preview then final). The last one is the most current.
-            if let existing = pendingWrites.firstIndex(where: { $0.path == d.path }) {
-                pendingWrites[existing] = (path: d.path, content: d.newText, original: pendingWrites[existing].original)
+            let resolvedPath = URL(fileURLWithPath: d.path).resolvingSymlinksInPath().path
+            if let existing = pendingWrites.firstIndex(where: {
+                URL(fileURLWithPath: $0.path).resolvingSymlinksInPath().path == resolvedPath
+            }) {
+                pendingWrites[existing] = PendingWrite(
+                    path: d.path,
+                    content: d.newText,
+                    originalText: pendingWrites[existing].originalText,
+                    originalData: pendingWrites[existing].originalData,
+                    existedBefore: pendingWrites[existing].existedBefore
+                )
             } else {
-                pendingWrites.append((path: d.path, content: d.newText, original: oldText))
+                pendingWrites.append(
+                    PendingWrite(
+                        path: d.path,
+                        content: d.newText,
+                        originalText: oldText,
+                        originalData: oldData,
+                        existedBefore: existedBefore
+                    )
+                )
             }
             acpLog.info("diff intercepted: \(d.path) original=\(oldText?.count ?? -1) chars (\(pendingWrites.count) total)")
         }
```

**File**: `Chops/Services/TemplateManager.swift` (modified, +13/-5)
```diff
@@ -57,14 +57,15 @@ final class TemplateManager {
     }
 
     /// Save updated template content
-    func save(_ template: WizardTemplate) {
+    func save(_ template: WizardTemplate, preserveVersionMarker: Bool = false) {
         let url = templatesDirectory.appendingPathComponent(template.type.fileName)
+        let persistedContent = preserveVersionMarker ? template.content : stripVersionMarker(from: template.content)
         do {
-            try template.content.write(to: url, atomically: true, encoding: .utf8)
+            try persistedContent.write(to: url, atomically: true, encoding: .utf8)
             if let index = templates.firstIndex(where: { $0.type == template.type }) {
                 templates[index] = WizardTemplate(
                     type: template.type,
-                    content: template.content,
+                    content: persistedContent,
                     lastModified: Date()
                 )
             }
@@ -77,7 +78,7 @@ final class TemplateManager {
     func resetToDefault(_ type: WizardTemplateType) {
         guard let bundledContent = loadBundledTemplate(type) else { return }
         let template = WizardTemplate(type: type, content: bundledContent, lastModified: Date())
-        save(template)
+        save(template, preserveVersionMarker: true)
     }
 
     /// Reset all templates to defaults
@@ -128,6 +129,14 @@ final class TemplateManager {
         return Int(content[start.upperBound ..< end.lowerBound])
     }
 
+    private func stripVersionMarker(from content: String) -> String {
+        content.replacingOccurrences(
+            of: #"^<!-- chops-template-version: \d+ -->\n?"#,
+            with: "",
+            options: .regularExpression
+        )
+    }
+
     private func loadTemplates() {
         templates = WizardTemplateType.allCases.compactMap { type in
             let url = templatesDirectory.appendingPathComponent(type.fileName)
@@ -201,4 +210,3 @@ final class TemplateManager {
 
 }
 
-
```

**File**: `Chops/Views/Detail/SkillDetailView.swift` (modified, +1/-0)
```diff
@@ -48,6 +48,7 @@ struct SkillDetailView: View {
                     templateType: .skill,
                     onAccept: { document.save(to: skill) }
                 )
+                .id(skill.filePath)
             }
 
             Divider()
```

**File**: `Chops/Views/Settings/SettingsView.swift` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ struct SettingsView: View {
                     Label("About", systemImage: "info.circle")
                 }
         }
-        .frame(minWidth: 480, minHeight: 550, idealHeight: 600)
+        .frame(minWidth: 480, maxWidth: 480, minHeight: 300)
         .onAppear {
             loadCustomPaths()
         }
```

**File**: `Chops/Views/Shared/ComposeModel.swift` (modified, +4/-2)
```diff
@@ -4,12 +4,14 @@ import Foundation
 
 enum ChatRole { case user, assistant }
 
-enum DiffStatus { case pending, accepted, rejected }
+enum DiffStatus: Sendable { case pending, accepted, rejected }
 
-struct ChatDiff {
+struct ChatDiff: Sendable {
     let path: String
     /// Pre-edit content. `nil` means the file did not exist before the agent wrote it.
     let original: String?
+    let originalData: Data?
+    let existedBefore: Bool
     let proposed: String
     var status: DiffStatus = .pending
 }
```

**File**: `Chops/Views/Shared/ComposePanel.swift` (modified, +234/-101)
```diff
@@ -17,7 +17,7 @@ struct ComposePanel: View {
 
     @State private var selectedTemplateType: WizardTemplateType
     @State private var inputText = ""
-    @State private var selectedAgentId: String?
+    @AppStorage("ACPSelectedAgentId") private var selectedAgentId: String?
     @State private var acpClient: BaseACPAgent?
     @State private var showingDebugLogs = false
 
@@ -70,11 +70,12 @@ struct ComposePanel: View {
 
             if configuredAgents.isEmpty {
                 noToolsConfiguredView
+            } else if !isConnected && messages.isEmpty {
+                agentPickerEmptyState
             } else {
                 VStack(spacing: 0) {
                     topBar
                     Divider()
-                    configOptionsBar
                     chatArea
                     Divider()
                     inputArea
@@ -94,6 +95,11 @@ struct ComposePanel: View {
         .onChange(of: selectedAgentId) { _, _ in
             forceDisconnect()
         }
+        .onChange(of: configuredAgents.map(\.id)) { _, newIds in
+            if selectedAgentId == nil || !newIds.contains(selectedAgentId ?? "") {
+                selectedAgentId = newIds.first
+            }
+        }
         .task { await ACPConfiguration.shared.loadRegistryIfNeeded() }
         .sheet(isPresented: Binding(
             get: { acpClient?.pendingPermissionRequest != nil },
@@ -144,21 +150,101 @@ struct ComposePanel: View {
 
     @Environment(\.openSettings) private var openSettings
 
+    private var agentPickerEmptyState: some View {
+        ZStack(alignment: .topTrailing) {
+            VStack(spacing: 12) {
+                Image(systemName: "sparkles")
+                    .font(.largeTitle)
+                    .foregroundStyle(.tertiary)
+                Text("Choose an agent to get started")
+                    .font(.callout)
+                    .foregroundStyle(.secondary)
+                Picker("", selection: $selectedAgentId) {
+                    Text("Select agent…").tag(nil as String?)
+                    ForEach(configuredAgents) { agent in
+                        Text(agent.name).tag(Optional(agent.id))
+                    }
+                }
+                .labelsHidden()
+                .fixedSize()
+                if selectedAgentId != nil {
+                    if isConnecting {
+                        HStack(spacing: 6) {
+                            ProgressView().controlSize(.small)
+                            Text("Connecting…")
+                                .foregroundStyle(.secondary)
+                        }
+                        .font(.callout)
+                    } else {
+                        Button {
+                            connect()
+                        } label: {
+                            Label("Connect", systemImage: "link")
+                        }
+                        .buttonStyle(.borderedProminent)
+                        .controlSize(.regular)
+                    }
+                }
+            }
+            .frame(maxWidth: .infinity, maxHeight: .infinity)
+
+            closeButton
+                .padding(12)
+        }
+    }
+
+    @State private var configuration = ACPConfiguration.shared
+
     private var noToolsConfiguredView: some View {
-        HStack(spacing: 12) {
-            Image(systemName: "exclamationmark.triangle")
-                .foregroundStyle(.orange)
-            Text("No ACP agents enabled.")
-                .foregroundStyle(.secondary)
-            Button("Open Settings") {
-                openSettings()
+        ZStack(alignment: .topTrailing) {
+            VStack(spacing: 16) {
+                Image(systemName: "sparkles")
+                    .font(.largeTitle)
+                    .foregroundStyle(.tertiary)
+                Text("Enable an agent to get started")
+                    .font(.callout)
+                    .foregroundStyle(.secondary)
+
+                VStack(spacing: 0) {
+                    if configuration.isLoadingRegistry {
+                        HStack(spacing: 6) {
+                            ProgressView().controlSize(.small)
+                            Text("Loading agents…").foregroundStyle(.secondary)
+                        }
+                        .padding(.vertical, 12)
+                    } else {
+                        ForEach(configuration.registryAgents) { agent in
+                            HStack(spacing: 10) {
+                                VStack(alignment: .leading, spacing: 1) {
+                                    Text(agent.name)
+                                        .font(.callout.weight(.medium))
+                                    Text(agent.description)
+                                        .font(.caption)
+                                        .foregroundStyle(.secondary)
+                                        .lineLimit(1)
+                                }
+                                Spacer()
+           
```

**File**: `Chops/Views/Shared/ThinkingView.swift` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ struct ThinkingView: View {
     let text: String
     let isStreaming: Bool
 
-    @State private var isExpanded: Bool = true
+    @State private var isExpanded: Bool = false
     /// Latched true once streaming ends — shows brain icon instead of spinner.
     @State private var settled: Bool = false
 
```

---

### Incident Patch 11: `71ac110d` (2026-03-27)
**Commit Message**: feat: replace MarkdownUI with WKWebView for preview text selection (#64)

Fixes #61

**File**: `Chops.xcodeproj/project.pbxproj` (modified, +16/-16)
```diff
@@ -18,17 +18,16 @@
 		60A6711BAB0C3B8A3ACBF985 /* SkillParser.swift in Sources */ = {isa = PBXBuildFile; fileRef = 5155D141EF812A3FE9ADF59C /* SkillParser.swift */; };
 		6A8E0927D95BB14C9F377F4E /* SkillScanner.swift in Sources */ = {isa = PBXBuildFile; fileRef = E6A5B26D335C1AFB6CDE8207 /* SkillScanner.swift */; };
 		71E92A838AB4D1D6DC6174AF /* NewSkillSheet.swift in Sources */ = {isa = PBXBuildFile; fileRef = F02A00F80E4712872205EA7B /* NewSkillSheet.swift */; };
-		791AA125E9170DBA81BCBE62 /* MarkdownUI in Frameworks */ = {isa = PBXBuildFile; productRef = B79B2B9912FC7D2ADEA22F84 /* MarkdownUI */; };
+		791AA125E9170DBA81BCBE62 /* Highlightr in Frameworks */ = {isa = PBXBuildFile; productRef = 704A14702546BFBD29BE27A8 /* Highlightr */; };
 		7A17C99C5EFAE3AA9E788D50 /* Collection.swift in Sources */ = {isa = PBXBuildFile; fileRef = C9AFE1AF02B0F8057791C2A9 /* Collection.swift */; };
 		7EC6156934D559226BC78859 /* CollectionListView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 4CA102A49ACFB23BC15794F8 /* CollectionListView.swift */; };
 		7FD1DE6640F9339D5E97E09A /* MDCParser.swift in Sources */ = {isa = PBXBuildFile; fileRef = 3A4F680B33C74A38FCF5ADD5 /* MDCParser.swift */; };
-		801A39D725B59A2F2BAF5DF2 /* Highlightr in Frameworks */ = {isa = PBXBuildFile; productRef = 704A14702546BFBD29BE27A8 /* Highlightr */; };
+		801A39D725B59A2F2BAF5DF2 /* cmark in Frameworks */ = {isa = PBXBuildFile; productRef = 9F4BE66CFE1E8401894FEF1F /* cmark */; };
 		846B58F3B105D1734DC6FA75 /* SkillRegistry.swift in Sources */ = {isa = PBXBuildFile; fileRef = 9FC9D3E83D8640CC258CF361 /* SkillRegistry.swift */; };
 		87A469B631CC80C89B14B1C7 /* SkillMetadataBar.swift in Sources */ = {isa = PBXBuildFile; fileRef = 8C812515FD8DC222B89745F2 /* SkillMetadataBar.swift */; };
 		95163AEB7980654C901EC693 /* Skill.swift in Sources */ = {isa = PBXBuildFile; fileRef = 27D6ED655F951177D2152351 /* Skill.swift */; };
 		98434D3DDFEEC7239F6F7B79 /* RegistrySheet.swift in Sources */ = {isa = PBXBuildFile; fileRef = 7FCD6C2A8BE68F553A9CA392 /* RegistrySheet.swift */; };
 		99EE8F6124FE91AC9576D6FD /* FileWatcher.swift in Sources */ = {isa = PBXBuildFile; fileRef = CAD26AA4787A2E0CDC86AADC /* FileWatcher.swift */; };
-		9ED88D6237B36693ABE5CE85 /* HighlightrSyntaxHighlighter.swift in Sources */ = {isa = PBXBuildFile; fileRef = D57F2C41F08F6E1BEFC5ADD4 /* HighlightrSyntaxHighlighter.swift */; };
 		A99BA179E0520DCDC98E1382 /* AppLogger.swift in Sources */ = {isa = PBXBuildFile; fileRef = F45D5C8E8C732B2F4A867E43 /* AppLogger.swift */; };
 		AAC4A3CBF2A9B4DF50608948 /* SSHService.swift in Sources */ = {isa = PBXBuildFile; fileRef = 6797D4AC1970DB9ACB5ACA73 /* SSHService.swift */; };
 		AFDC3DAB708B352A7606F119 /* DiagnosticExporter.swift in Sources */ = {isa = PBXBuildFile; fileRef = D5D3C2567FBF8DBA4DE957B3 /* DiagnosticExporter.swift */; };
@@ -41,6 +40,7 @@
 		CECE9BEEC1D933C543B66A4E /* Assets.xcassets in Resources */ = {isa = PBXBuildFile; fileRef = 17F7FE50C96124BA4EE43A6F /* Assets.xcassets */; };
 		D4C107BE303FC07CAF9C66AF /* ContentView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 60E0F71982C4AF0045962380 /* ContentView.swift */; };
 		E6F4E1CF50F2F78F5BA9BAC9 /* SkillPreviewView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 77E332B9970E6E3D00DCFBA3 /* SkillPreviewView.swift */; };
+		E7ED248D6F94C1B1DEF1E8BA /* MarkdownRenderer.swift in Sources */ = {isa = PBXBuildFile; fileRef = 372FA72F2C179B79470DF86A /* MarkdownRenderer.swift */; };
 		E98F7490B18A194F82ED2C0E /* SkillListView.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA64A368BBF950CD36C4F495 /* SkillListView.swift */; };
 		F98B1E8579B139FD2A801650 /* SearchService.swift in Sources */ = {isa = PBXBuildFile; fileRef = 7FFC47BDE92105F4736B379F /* SearchService.swift */; };
 		FB295303DD30AED03290C726 /* SkillEditorView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 31B4DB87833D5160A11E39C9 /* SkillEditorView.swift */; };
@@ -57,6 +57,7 @@
 		2CF7822031FD82A28978D9C5 /* SidebarView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SidebarView.swift; sourceTree = "<group>"; };
 		31B4DB87833D5160A11E39C9 /* SkillEditorView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SkillEditorView.swift; sourceTree = "<group>"; };
 		3314080A44DEB895223E36D5 /* RemoteServer.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = RemoteServer.swift; sourceTree = "<group>"; };
+		372FA72F2C179B79470DF86A /* MarkdownRenderer.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = MarkdownRenderer.swift; sourceTree = "<group>"; };
 		3A4F680B33C74A38FCF5ADD5 /* MDCParser.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = MDCParser.swift; sourceTree = "<group>"; };
 		4CA102A49ACFB23BC15794F8 /* CollectionListView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = CollectionListView.sw
```

**File**: `Chops.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +9/-27)
```diff
@@ -1,22 +1,22 @@
 {
-  "originHash" : "d0e9b55e5a1f995aa86a208c3c1677dc39f38b65031258ce388e8453d06a06c8",
+  "originHash" : "cced8d2c7e8017967b1fbc19bce1489634e299f796e5c0826981d26ef3f07509",
   "pins" : [
     {
-      "identity" : "highlightr",
+      "identity" : "cmark-gfm",
       "kind" : "remoteSourceControl",
-      "location" : "https://github.com/raspu/Highlightr",
+      "location" : "https://github.com/brokenhandsio/cmark-gfm.git",
       "state" : {
-        "revision" : "05e7fcc63b33925cd0c1faaa205cdd5681e7bbef",
-        "version" : "2.3.0"
+        "revision" : "e97450a77a40f12b4f88f95891621c3b5d8669de",
+        "version" : "2.1.0"
       }
     },
     {
-      "identity" : "networkimage",
+      "identity" : "highlightr",
       "kind" : "remoteSourceControl",
-      "location" : "https://github.com/gonzalezreal/NetworkImage",
+      "location" : "https://github.com/raspu/Highlightr",
       "state" : {
-        "revision" : "2849f5323265386e200484b0d0f896e73c3411b9",
-        "version" : "6.0.1"
+        "revision" : "05e7fcc63b33925cd0c1faaa205cdd5681e7bbef",
+        "version" : "2.3.0"
       }
     },
     {
@@ -27,24 +27,6 @@
         "revision" : "21d8df80440b1ca3b65fa82e40782f1e5a9e6ba2",
         "version" : "2.9.0"
       }
-    },
-    {
-      "identity" : "swift-cmark",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github.com/swiftlang/swift-cmark",
-      "state" : {
-        "revision" : "5d9bdaa4228b381639fff09403e39a04926e2dbe",
-        "version" : "0.7.1"
-      }
-    },
-    {
-      "identity" : "swift-markdown-ui",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github.com/gonzalezreal/swift-markdown-ui",
-      "state" : {
-        "revision" : "5f613358148239d0292c0cef674a3c2314737f9e",
-        "version" : "2.4.1"
-      }
     }
   ],
   "version" : 3
```

**File**: `Chops/Utilities/HighlightrSyntaxHighlighter.swift` (removed, +0/-23)
```diff
@@ -1,23 +0,0 @@
-import MarkdownUI
-import Highlightr
-import SwiftUI
-
-struct HighlightrSyntaxHighlighter: CodeSyntaxHighlighter {
-    private static let shared: Highlightr = Highlightr()!
-
-    private let highlightr: Highlightr
-
-    init() {
-        self.highlightr = Self.shared
-        let isDark = NSApp.effectiveAppearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
-        highlightr.setTheme(to: isDark ? "atom-one-dark" : "atom-one-light")
-    }
-
-    func highlightCode(_ code: String, language: String?) -> Text {
-        let lang = language ?? "plaintext"
-        if let highlighted = highlightr.highlight(code, as: lang) {
-            return Text(AttributedString(highlighted))
-        }
-        return Text(code)
-    }
-}
```

**File**: `Chops/Utilities/MarkdownRenderer.swift` (added, +194/-0)
```diff
@@ -0,0 +1,194 @@
+import Foundation
+import Highlightr
+import JavaScriptCore
+import cmark
+
+enum MarkdownRenderer {
+    static func renderHTML(_ markdown: String, isDarkMode: Bool) -> String {
+        guard !markdown.isEmpty else { return "" }
+
+        let len = markdown.utf8.count
+        let options = Int32(CMARK_OPT_STRIKETHROUGH_DOUBLE_TILDE)
+
+        guard let buf = cmark_gfm_markdown_to_html(markdown, len, options) else { return "" }
+        let html = String(cString: buf)
+        free(buf)
+
+        return PreviewCodeHighlighter.shared.highlightCodeBlocks(in: html, isDarkMode: isDarkMode)
+    }
+
+    static func themeCSS(isDarkMode: Bool) -> String {
+        PreviewCodeHighlighter.shared.themeCSS(isDarkMode: isDarkMode)
+    }
+}
+
+private final class PreviewCodeHighlighter {
+    static let shared = PreviewCodeHighlighter()
+
+    private static let codeBlockRegex = try! NSRegularExpression(
+        pattern: #"<pre([^>]*)><code(?: class="([^"]*)")?>([\s\S]*?)</code></pre>"#,
+        options: []
+    )
+
+    private let bundle: Bundle?
+    private let hljs: JSValue?
+    private var cssCache: [String: String] = [:]
+
+    private init() {
+        self.bundle = Self.resourceBundle()
+
+        guard let jsContext = JSContext(),
+              let bundle,
+              let highlightPath = bundle.path(forResource: "highlight.min", ofType: "js"),
+              let highlightJS = try? String(contentsOfFile: highlightPath, encoding: .utf8) else {
+            self.hljs = nil
+            return
+        }
+
+        jsContext.evaluateScript(highlightJS)
+        self.hljs = jsContext.objectForKeyedSubscript("hljs")
+    }
+
+    func highlightCodeBlocks(in html: String, isDarkMode: Bool) -> String {
+        let nsHTML = html as NSString
+        let matches = Self.codeBlockRegex.matches(in: html, range: NSRange(location: 0, length: nsHTML.length))
+
+        guard !matches.isEmpty else { return html }
+
+        var rendered = ""
+        var currentLocation = 0
+
+        for match in matches {
+            let blockRange = match.range(at: 0)
+            rendered += nsHTML.substring(with: NSRange(location: currentLocation, length: blockRange.location - currentLocation))
+
+            let preAttributes = substring(in: nsHTML, range: match.range(at: 1))
+            let classNames = substring(in: nsHTML, range: match.range(at: 2))
+            let encodedCode = substring(in: nsHTML, range: match.range(at: 3)) ?? ""
+
+            let language = languageName(classNames: classNames, preAttributes: preAttributes)
+            let code = decodeHTML(encodedCode)
+
+            if let highlighted = highlightedHTML(for: code, language: language, isDarkMode: isDarkMode) {
+                rendered += highlighted
+            } else {
+                rendered += nsHTML.substring(with: blockRange)
+            }
+
+            currentLocation = blockRange.location + blockRange.length
+        }
+
+        rendered += nsHTML.substring(from: currentLocation)
+        return rendered
+    }
+
+    func themeCSS(isDarkMode: Bool) -> String {
+        let themeName = isDarkMode ? "atom-one-dark" : "atom-one-light"
+
+        if let cached = cssCache[themeName] {
+            return cached
+        }
+
+        guard let bundle,
+              let themePath = bundle.path(forResource: themeName + ".min", ofType: "css"),
+              let css = try? String(contentsOfFile: themePath, encoding: .utf8) else {
+            return ""
+        }
+
+        cssCache[themeName] = css
+        return css
+    }
+
+    private func highlightedHTML(for code: String, language: String?, isDarkMode: Bool) -> String? {
+        guard let hljs else { return nil }
+
+        let result: JSValue?
+        if let language, !language.isEmpty {
+            let highlighted = hljs.invokeMethod("highlight", withArguments: [language, code, false])
+            if highlighted?.isUndefined == false {
+                result = highlighted
+            } else {
+                result = hljs.invokeMethod("highlightAuto", withArguments: [code])
+            }
+        } else {
+            result = hljs.invokeMethod("highlightAuto", withArguments: [code])
+        }
+
+        guard let html = result?.objectForKeyedSubscript("value")?.toString() else {
+            return nil
+        }
+
+        let languageClass = language.map { " language-\($0)" } ?? ""
+        let themeClass = isDarkMode ? "dark" : "light"
+
+        return """
+        <pre class="highlighted-code \(themeClass)"><code class="hljs\(languageClass)">\(html)</code></pre>
+        """
+    }
+
+    private func languageName(classNames: String?, preAttributes: String?) -> String? {
+        if let classNames {
+            for className in classNames.split(separator: " ") {
+                if className.hasPrefix("language-") {
+                    return String(className.dropFirst("language-".count))
+                }
+                if className.hasPref
```

**File**: `Chops/Views/Detail/SkillPreviewView.swift` (modified, +306/-233)
```diff
@@ -1,54 +1,324 @@
 import SwiftUI
-import MarkdownUI
+import WebKit
 
 struct SkillPreviewView: View {
     let content: String
 
     var body: some View {
+        MarkdownWebView(content: content)
+            .frame(maxWidth: .infinity, maxHeight: .infinity)
+    }
+}
+
+// MARK: - WKWebView Wrapper
+
+private struct MarkdownWebView: NSViewRepresentable {
+    let content: String
+    @Environment(\.colorScheme) private var colorScheme
+
+    private var contentHash: Int {
+        var hasher = Hasher()
+        hasher.combine(content)
+        hasher.combine(colorScheme)
+        return hasher.finalize()
+    }
+
+    func makeCoordinator() -> Coordinator {
+        Coordinator()
+    }
+
+    func makeNSView(context: Context) -> WKWebView {
+        let config = WKWebViewConfiguration()
+        config.preferences.isElementFullscreenEnabled = false
+        config.defaultWebpagePreferences.allowsContentJavaScript = false
+        let webView = WKWebView(frame: .zero, configuration: config)
+        webView.navigationDelegate = context.coordinator
+        webView.underPageBackgroundColor = Self.dynamicBgColor
+        loadHTML(in: webView, context: context)
+        return webView
+    }
+
+    private static let dynamicBgColor = NSColor(name: nil) { appearance in
+        appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
+            ? NSColor(red: 0x1A/255.0, green: 0x1A/255.0, blue: 0x1A/255.0, alpha: 1)
+            : NSColor(red: 0xFA/255.0, green: 0xFA/255.0, blue: 0xFA/255.0, alpha: 1)
+    }
+
+    func updateNSView(_ webView: WKWebView, context: Context) {
+        webView.underPageBackgroundColor = Self.dynamicBgColor
+        if context.coordinator.lastContentHash != contentHash {
+            loadHTML(in: webView, context: context)
+        }
+    }
+
+    private func loadHTML(in webView: WKWebView, context: Context) {
+        context.coordinator.lastContentHash = contentHash
         let parsed = RawFrontmatterParser.parse(content)
+        let isDarkMode = colorScheme == .dark
+        let markdownHTML = MarkdownRenderer.renderHTML(parsed?.content ?? content, isDarkMode: isDarkMode)
+        let themeCSS = MarkdownRenderer.themeCSS(isDarkMode: isDarkMode)
+
+        var bodyHTML = ""
+        if let fm = parsed?.frontmatter {
+            let escaped = fm
+                .replacingOccurrences(of: "&", with: "&amp;")
+                .replacingOccurrences(of: "<", with: "&lt;")
+                .replacingOccurrences(of: ">", with: "&gt;")
+            bodyHTML += "<pre class=\"frontmatter\">\(escaped)</pre>"
+        }
+        bodyHTML += markdownHTML
+
+        let html = """
+        <!DOCTYPE html>
+        <html>
+        <head>
+        <meta charset="utf-8">
+        <meta name="viewport" content="width=device-width, initial-scale=1">
+        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:;">
+        <style>\(themeCSS)
+        \(Self.css)</style>
+        </head>
+        <body>\(bodyHTML)</body>
+        </html>
+        """
+        webView.loadHTMLString(html, baseURL: nil)
+    }
+
+    final class Coordinator: NSObject, WKNavigationDelegate {
+        var lastContentHash: Int?
 
-        ScrollView {
-            VStack(alignment: .leading, spacing: 0) {
-                if let frontmatter = parsed?.frontmatter {
-                    FrontmatterBlockView(frontmatter: frontmatter)
-                        .padding(.bottom, 24)
-                }
-
-                Markdown(parsed?.content ?? content)
-                    .markdownTheme(.clearly)
-                    .markdownCodeSyntaxHighlighter(HighlightrSyntaxHighlighter())
-                    .textSelection(.enabled)
+        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
+            if navigationAction.navigationType == .linkActivated,
+               let url = navigationAction.request.url {
+                NSWorkspace.shared.open(url)
+                decisionHandler(.cancel)
+            } else {
+                decisionHandler(.allow)
             }
-            .padding(24)
-            .frame(maxWidth: 672, alignment: .leading)
-            .frame(maxWidth: .infinity)
         }
-        .background(Color.clearlyBackground)
-        .frame(maxWidth: .infinity, maxHeight: .infinity)
     }
-}
 
-// MARK: - Frontmatter Block
+    // MARK: - CSS
 
-private struct FrontmatterBlockView: View {
-    let frontmatter: String
+    private static let css = """
+    * {
+        margin: 0;
+        padding: 0;
+        box-sizing: border-box;
+    }
 
-    var body: some View {
-        Text(frontmatter)
-            .font(.system(size: 12, design: .monospaced))
-            .foregroundStyle(Color.clearlyFmValue)
-            .textSelection(.enabled)
-            .frame(maxWidth: .infinity, alignment: .leading)
-            .padding(.horiz
```

**File**: `project.yml` (modified, +5/-4)
```diff
@@ -15,12 +15,12 @@ packages:
   Sparkle:
     url: https://github.com/sparkle-project/Sparkle
     from: "2.6.0"
-  MarkdownUI:
-    url: https://github.com/gonzalezreal/swift-markdown-ui
-    from: "2.4.0"
   Highlightr:
     url: https://github.com/raspu/Highlightr
     from: "2.2.1"
+  cmark-gfm:
+    url: https://github.com/brokenhandsio/cmark-gfm.git
+    from: "2.1.0"
 
 targets:
   Chops:
@@ -33,8 +33,9 @@ targets:
           - Info.plist
     dependencies:
       - package: Sparkle
-      - package: MarkdownUI
       - package: Highlightr
+      - package: cmark-gfm
+        product: cmark
     settings:
       base:
         PRODUCT_BUNDLE_IDENTIFIER: com.joshpigford.Chops
```

---

### Incident Patch 12: `6ca9c4dc` (2026-03-27)
**Commit Message**: Add GitHub issue templates and security policy (#57)

**File**: `.github/ISSUE_TEMPLATE/bug_report.yml` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+name: Bug Report
+description: Something isn't working right
+labels: ["bug"]
+body:
+  - type: textarea
+    id: description
+    attributes:
+      label: What happened?
+      description: Describe the bug and what you expected to happen instead.
+      placeholder: "When I do X, Y happens. I expected Z."
+    validations:
+      required: true
+
+  - type: textarea
+    id: steps
+    attributes:
+      label: Steps to reproduce
+      description: How can we see this bug?
+      placeholder: |
+        1. Open Chops...
+        2. Navigate to...
+        3. See...
+    validations:
+      required: true
+
+  - type: input
+    id: app-version
+    attributes:
+      label: App version
+      description: "Found in Chops → Settings → About"
+      placeholder: "e.g. 1.9.0"
+    validations:
+      required: true
+
+  - type: input
+    id: macos-version
+    attributes:
+      label: macOS version
+      description: "Found in  → About This Mac"
+      placeholder: "e.g. 15.3"
+    validations:
+      required: true
+
+  - type: textarea
+    id: screenshots
+    attributes:
+      label: Screenshots
+      description: If applicable, drag and drop screenshots here.
+    validations:
+      required: false
+
+  - type: textarea
+    id: file
+    attributes:
+      label: Problematic skill file
+      description: If a specific skill file triggers the bug, paste its path or contents here.
+    validations:
+      required: false
```

**File**: `.github/ISSUE_TEMPLATE/config.yml` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+blank_issues_enabled: false
+contact_links:
+  - name: Questions or feedback
+    url: https://x.com/Shpigford
+    about: Reach out on X for questions, feedback, or general discussion
```

**File**: `.github/ISSUE_TEMPLATE/feature_request.yml` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+name: Feature Request
+description: Suggest something new
+labels: ["enhancement"]
+body:
+  - type: textarea
+    id: description
+    attributes:
+      label: What would you like?
+      description: Describe the feature or change you'd like to see.
+    validations:
+      required: true
+
+  - type: textarea
+    id: why
+    attributes:
+      label: Why?
+      description: What problem does this solve or what's your use case?
+    validations:
+      required: true
+
+  - type: textarea
+    id: screenshots
+    attributes:
+      label: Screenshots or examples
+      description: Mockups, screenshots from other apps, or anything that helps illustrate the idea.
+    validations:
+      required: false
```

**File**: `SECURITY.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+# Security Policy
+
+If you discover a security vulnerability in Chops, please report it through
+GitHub's [private vulnerability reporting](https://github.com/Shpigford/chops/security/advisories/new)
+rather than opening a public issue.
```

---

### Incident Patch 13: `1f426aba` (2026-03-24)
**Commit Message**: fix: hide tools that aren't installed from sidebar (#39)

Add isInstalled detection to ToolSource that checks for app bundles,
CLI binaries, and tool-specific config files before showing a tool.
Prevents tools like Pi from appearing when only a stale skills directory
exists but the tool itself isn't installed.

**File**: `Chops/Models/ToolSource.swift` (modified, +56/-0)
```diff
@@ -93,4 +93,60 @@ enum ToolSource: String, Codable, CaseIterable, Identifiable {
         case .custom: return []
         }
     }
+
+    /// Whether the tool is actually installed on this machine.
+    /// Checks for app bundles, CLI binaries, tool-specific config files,
+    /// or known global skill locations that imply a real setup is present.
+    var isInstalled: Bool {
+        let fm = FileManager.default
+        let home = fm.homeDirectoryForCurrentUser.path
+
+        switch self {
+        case .claude:
+            return fm.fileExists(atPath: "\(home)/.claude/settings.json")
+                || fm.fileExists(atPath: "\(home)/.claude/CLAUDE.md")
+                || fm.fileExists(atPath: "\(home)/.agents/skills")
+                || Self.cliBinaryExists("claude")
+        case .cursor:
+            return fm.fileExists(atPath: "/Applications/Cursor.app")
+                || fm.fileExists(atPath: "\(home)/.cursor/argv.json")
+        case .windsurf:
+            return fm.fileExists(atPath: "/Applications/Windsurf.app")
+                || fm.fileExists(atPath: "\(home)/.codeium/windsurf/argv.json")
+        case .codex:
+            return fm.fileExists(atPath: "\(home)/.codex/config.toml")
+                || fm.fileExists(atPath: "\(home)/.codex/auth.json")
+                || Self.cliBinaryExists("codex")
+        case .amp:
+            let configHome = ProcessInfo.processInfo.environment["XDG_CONFIG_HOME"]
+                .flatMap { $0.isEmpty ? nil : $0 } ?? "\(home)/.config"
+            return fm.fileExists(atPath: "\(configHome)/amp/config.json")
+                || fm.fileExists(atPath: "\(configHome)/amp/settings.json")
+                || Self.cliBinaryExists("amp")
+        case .pi:
+            return Self.cliBinaryExists("pi")
+        case .copilot, .aider, .openclaw, .custom:
+            return true
+        }
+    }
+
+    private static func cliBinaryExists(_ name: String) -> Bool {
+        let fm = FileManager.default
+        let home = fm.homeDirectoryForCurrentUser.path
+        let paths = [
+            "/usr/local/bin/\(name)",
+            "/opt/homebrew/bin/\(name)",
+            "\(home)/.local/bin/\(name)",
+        ]
+        for path in paths where fm.fileExists(atPath: path) {
+            return true
+        }
+        let nvmDir = "\(home)/.nvm/versions/node"
+        if let nodeDirs = try? fm.contentsOfDirectory(atPath: nvmDir) {
+            for nodeDir in nodeDirs {
+                if fm.fileExists(atPath: "\(nvmDir)/\(nodeDir)/bin/\(name)") { return true }
+            }
+        }
+        return false
+    }
 }
```

**File**: `Chops/Services/SkillScanner.swift` (modified, +3/-0)
```diff
@@ -86,6 +86,9 @@ final class SkillScanner {
 
         for tool in ToolSource.allCases where tool != .custom {
             guard !Task.isCancelled else { return results }
+            guard tool.isInstalled || tool.globalPaths.contains(where: { FileManager.default.fileExists(atPath: $0) }) else {
+                continue
+            }
             for path in tool.globalPaths {
                 let url = URL(fileURLWithPath: path)
                 collectFromDirectory(url, toolSource: tool, isGlobal: true, into: &results)
```

---

### Incident Patch 14: `5ca45e05` (2026-03-24)
**Commit Message**: fix: hide non-skill config files from All Skills view (#38)

Add a blocklist of well-known tool config/meta filenames (README.md,
CLAUDE.md, AGENTS.md, global_rules.md, LICENSE.md, etc.) that are
skipped during scanning. Also narrow Codex and Amp scan paths to their
skills/ subdirectories instead of scanning the root config dirs, and
update NewSkillSheet to create skills in the correct locations.
Previously-scanned non-skill records are cleaned up on next launch.

Fixes #36

**File**: `Chops/Models/AgentTarget.swift` (modified, +2/-2)
```diff
@@ -99,8 +99,8 @@ struct AgentTarget: Identifiable, Hashable {
             AgentTarget(
                 id: "amp",
                 displayName: "Amp",
-                globalSkillsDir: "\(configHome)/amp",
-                skillFileName: "AGENTS.md",
+                globalSkillsDir: "\(configHome)/amp/skills",
+                skillFileName: "SKILL.md",
                 evidencePaths: [
                     "\(configHome)/amp/config.json",
                     "\(configHome)/amp/settings.json",
```

**File**: `Chops/Models/ToolSource.swift` (modified, +8/-2)
```diff
@@ -74,14 +74,20 @@ enum ToolSource: String, Codable, CaseIterable, Identifiable {
 
     var globalPaths: [String] {
         let home = FileManager.default.homeDirectoryForCurrentUser.path
+        let configHome: String = {
+            if let xdg = ProcessInfo.processInfo.environment["XDG_CONFIG_HOME"], !xdg.isEmpty {
+                return xdg
+            }
+            return "\(home)/.config"
+        }()
         switch self {
         case .claude: return ["\(home)/.claude/skills", "\(home)/.agents/skills"]
         case .cursor: return ["\(home)/.cursor/skills", "\(home)/.cursor/rules"]
         case .windsurf: return ["\(home)/.codeium/windsurf/memories", "\(home)/.windsurf/rules"]
-        case .codex: return ["\(home)/.codex"]
+        case .codex: return ["\(home)/.codex/skills"]
         case .copilot: return []
         case .aider: return []
-        case .amp: return ["\(home)/.config/amp"]
+        case .amp: return ["\(configHome)/amp/skills"]
         case .openclaw: return []
         case .pi: return ["\(home)/.pi/agent/skills"]
         case .custom: return []
```

**File**: `Chops/Services/SkillScanner.swift` (modified, +30/-38)
```diff
@@ -23,6 +23,25 @@ final class SkillScanner {
     private var scanTask: Task<Void, Never>?
     private var scanGeneration = 0
 
+    /// Filenames that are tool config/meta files, not skills.
+    private static let ignoredFileNames: Set<String> = [
+        "README.md",
+        "README",
+        "CLAUDE.md",
+        "AGENTS.md",
+        "AGENTS.override.md",
+        "global_rules.md",
+        "SYSTEM.md",
+        "APPEND_SYSTEM.md",
+        "LICENSE.md",
+        "LICENSE",
+        "CHANGELOG.md",
+    ]
+
+    private static func shouldIgnoreLooseMarkdownFile(named fileName: String) -> Bool {
+        return ignoredFileNames.contains(fileName)
+    }
+
     init(modelContext: ModelContext) {
         self.modelContext = modelContext
     }
@@ -32,10 +51,10 @@ final class SkillScanner {
         (".claude/skills", .claude),
         (".cursor/skills", .cursor),
         (".cursor/rules", .cursor),
-        (".codex", .codex),
+        (".codex/skills", .codex),
         (".windsurf/rules", .windsurf),
         (".github", .copilot),
-        (".config/amp", .amp),
+        (".config/amp/skills", .amp),
     ]
 
     func scanAll() {
@@ -119,42 +138,6 @@ final class SkillScanner {
         var isDir: ObjCBool = false
         guard fm.fileExists(atPath: directory.path, isDirectory: &isDir) else { return }
 
-        // Single-file tools like Codex: look for AGENTS.md directly in the directory
-        if toolSource == .codex || toolSource == .amp {
-            let agentsMD = directory.appendingPathComponent("AGENTS.md")
-            if fm.fileExists(atPath: agentsMD.path) {
-                if let data = collectSkillData(at: agentsMD, toolSource: toolSource, isDirectory: false, isGlobal: isGlobal) {
-                    results.append(data)
-                }
-            }
-            let scanDirs = [directory, directory.appendingPathComponent("skills")]
-            for scanDir in scanDirs {
-                guard let contents = try? fm.contentsOfDirectory(
-                    at: scanDir,
-                    includingPropertiesForKeys: [.isDirectoryKey],
-                    options: [.skipsHiddenFiles]
-                ) else { continue }
-                for item in contents {
-                    var itemIsDir: ObjCBool = false
-                    fm.fileExists(atPath: item.path, isDirectory: &itemIsDir)
-                    if itemIsDir.boolValue {
-                        let skillFile = item.appendingPathComponent("SKILL.md")
-                        let agentsFile = item.appendingPathComponent("AGENTS.md")
-                        if fm.fileExists(atPath: skillFile.path) {
-                            if let data = collectSkillData(at: skillFile, toolSource: toolSource, isDirectory: true, isGlobal: isGlobal) {
-                                results.append(data)
-                            }
-                        } else if fm.fileExists(atPath: agentsFile.path) {
-                            if let data = collectSkillData(at: agentsFile, toolSource: toolSource, isDirectory: true, isGlobal: isGlobal) {
-                                results.append(data)
-                            }
-                        }
-                    }
-                }
-            }
-            return
-        }
-
         guard isDir.boolValue else { return }
 
         guard let contents = try? fm.contentsOfDirectory(
@@ -182,6 +165,7 @@ final class SkillScanner {
                     }
                 }
             } else if item.pathExtension == "md" || item.pathExtension == "mdc" {
+                guard !shouldIgnoreLooseMarkdownFile(named: item.lastPathComponent) else { continue }
                 if let data = collectSkillData(at: item, toolSource: toolSource, isDirectory: false, isGlobal: isGlobal) {
                     results.append(data)
                 }
@@ -355,6 +339,14 @@ final class SkillScanner {
 
             // Remote skills are managed by scanRemoteServer(), skip here
             if skill.isRemote { continue }
+
+            // Remove previously-scanned loose markdown files that are now filtered out.
+            let fileName = URL(fileURLWithPath: skill.filePath).lastPathComponent
+            if !skill.isDirectory, Self.shouldIgnoreLooseMarkdownFile(named: fileName) {
+                modelContext.delete(skill)
+                continue
+            }
+
             let validPaths = skill.installedPaths.filter { fm.fileExists(atPath: $0) }
             if validPaths.isEmpty {
                 modelContext.delete(skill)
```

**File**: `Chops/Views/Shared/NewSkillSheet.swift` (modified, +22/-7)
```diff
@@ -55,6 +55,12 @@ struct NewSkillSheet: View {
 
     private func createSkill() {
         let fm = FileManager.default
+        let configHome: String = {
+            if let xdg = ProcessInfo.processInfo.environment["XDG_CONFIG_HOME"], !xdg.isEmpty {
+                return xdg
+            }
+            return "\(fm.homeDirectoryForCurrentUser.path)/.config"
+        }()
         let sanitizedName = skillName
             .lowercased()
             .replacingOccurrences(of: " ", with: "-")
@@ -79,13 +85,17 @@ struct NewSkillSheet: View {
             fileName = "SKILL.md"
             isDirectory = true
         case .codex:
-            basePath = "\(fm.homeDirectoryForCurrentUser.path)/.codex"
-            fileName = "AGENTS.md"
-            isDirectory = false
+            basePath = "\(fm.homeDirectoryForCurrentUser.path)/.codex/skills/\(sanitizedName)"
+            fileName = "SKILL.md"
+            isDirectory = true
         case .amp:
-            basePath = "\(fm.homeDirectoryForCurrentUser.path)/.config/amp"
-            fileName = "AGENTS.md"
-            isDirectory = false
+            basePath = "\(configHome)/amp/skills/\(sanitizedName)"
+            fileName = "SKILL.md"
+            isDirectory = true
+        case .pi:
+            basePath = "\(fm.homeDirectoryForCurrentUser.path)/.pi/agent/skills/\(sanitizedName)"
+            fileName = "SKILL.md"
+            isDirectory = true
         default:
             let firstPath = selectedTool.globalPaths.first ?? "\(fm.homeDirectoryForCurrentUser.path)/.claude/skills/\(sanitizedName)"
             basePath = firstPath
@@ -155,8 +165,13 @@ struct NewSkillSheet: View {
 
             Add your skill instructions here.
             """
-        case .codex, .amp:
+        case .codex, .amp, .pi:
             return """
+            ---
+            name: \(name.lowercased().replacingOccurrences(of: " ", with: "-"))
+            description: \(name)
+            ---
+
             # \(name)
 
             ## Instructions
```

---

### Incident Patch 15: `1e4fa579` (2026-03-23)
**Commit Message**: fix: correct Sparkle minimum macOS version from 26.0 to 15.0 (#35)

The appcast template in release.sh and all existing appcast entries
incorrectly required macOS 26.0, blocking updates for users on 15–25.

**File**: `scripts/release.sh` (modified, +1/-1)
```diff
@@ -215,7 +215,7 @@ cat > build/appcast.xml << APPCAST
       <title>Version $VERSION</title>
       <sparkle:version>$VERSION</sparkle:version>
       <sparkle:shortVersionString>$VERSION</sparkle:shortVersionString>
-      <sparkle:minimumSystemVersion>26.0</sparkle:minimumSystemVersion>
+      <sparkle:minimumSystemVersion>15.0</sparkle:minimumSystemVersion>
       <pubDate>$PUB_DATE</pubDate>
 $DESC_ELEMENT
       <enclosure
```

**File**: `site/public/appcast.xml` (modified, +6/-6)
```diff
@@ -6,7 +6,7 @@
       <title>Version 1.6.0</title>
       <sparkle:version>1.6.0</sparkle:version>
       <sparkle:shortVersionString>1.6.0</sparkle:shortVersionString>
-      <sparkle:minimumSystemVersion>26.0</sparkle:minimumSystemVersion>
+      <sparkle:minimumSystemVersion>15.0</sparkle:minimumSystemVersion>
       <pubDate>Sun, 22 Mar 2026 21:29:20 +0000</pubDate>
       <description><![CDATA[<ul><li>Fix layout freeze when selecting a skill</li><li>Press Enter to quickly create new collections</li><li>Rename collections from the right-click menu</li></ul>]]></description>
       <enclosure
@@ -20,7 +20,7 @@
       <title>Version 1.5.0</title>
       <sparkle:version>1.5.0</sparkle:version>
       <sparkle:shortVersionString>1.5.0</sparkle:shortVersionString>
-      <sparkle:minimumSystemVersion>26.0</sparkle:minimumSystemVersion>
+      <sparkle:minimumSystemVersion>15.0</sparkle:minimumSystemVersion>
       <pubDate>Sat, 21 Mar 2026 17:17:31 +0000</pubDate>
       <description><![CDATA[<ul><li>Connect to remote servers (such as OpenClaw) to discover, browse, and edit skills (@t2)</li></ul>]]></description>
       <enclosure
@@ -34,7 +34,7 @@
       <title>Version 1.4.0</title>
       <sparkle:version>1.4.0</sparkle:version>
       <sparkle:shortVersionString>1.4.0</sparkle:shortVersionString>
-      <sparkle:minimumSystemVersion>26.0</sparkle:minimumSystemVersion>
+      <sparkle:minimumSystemVersion>15.0</sparkle:minimumSystemVersion>
       <pubDate>Sat, 21 Mar 2026 15:26:57 +0000</pubDate>
       <description><![CDATA[<ul><li>Delete skills directly from the context menu or toolbar</li><li>Diagnostic logging and fixes for UI freezing</li></ul>]]></description>
       <enclosure
@@ -48,7 +48,7 @@
       <title>Version 1.3.0</title>
       <sparkle:version>1.3.0</sparkle:version>
       <sparkle:shortVersionString>1.3.0</sparkle:shortVersionString>
-      <sparkle:minimumSystemVersion>26.0</sparkle:minimumSystemVersion>
+      <sparkle:minimumSystemVersion>15.0</sparkle:minimumSystemVersion>
       <pubDate>Sat, 21 Mar 2026 12:59:53 +0000</pubDate>
       <description><![CDATA[<ul><li>Markdown preview mode with syntax highlighting in the skill editor</li></ul>]]></description>
       <enclosure
@@ -62,7 +62,7 @@
       <title>Version 1.2.0</title>
       <sparkle:version>1.2.0</sparkle:version>
       <sparkle:shortVersionString>1.2.0</sparkle:shortVersionString>
-      <sparkle:minimumSystemVersion>26.0</sparkle:minimumSystemVersion>
+      <sparkle:minimumSystemVersion>15.0</sparkle:minimumSystemVersion>
       <pubDate>Sat, 21 Mar 2026 12:00:18 +0000</pubDate>
       <description><![CDATA[<ul><li>Skills registry browser for discovering and installing community skills</li></ul>]]></description>
       <enclosure
@@ -76,7 +76,7 @@
       <title>Version 1.1.0</title>
       <sparkle:version>1.1.0</sparkle:version>
       <sparkle:shortVersionString>1.1.0</sparkle:shortVersionString>
-      <sparkle:minimumSystemVersion>26.0</sparkle:minimumSystemVersion>
+      <sparkle:minimumSystemVersion>15.0</sparkle:minimumSystemVersion>
       <pubDate>Thu, 19 Mar 2026 12:24:55 +0000</pubDate>
       <enclosure
         url="https://github.com/Shpigford/chops/releases/download/v1.1.0/Chops.dmg"
```

#### Recent Merged Pull Requests:
- **PR #103** (closed): feat: expand tool discovery — Cursor/Codex plugins, rules, FNM/Volta/mise binaries (@LaurMost)
- **PR #101** (2026-08-23): Unified Library sidebar, ⌘K command palette, and keyboard/menu polish (@tonkapark)
- **PR #100** (2026-08-23): Trending browse + local filter for skills registry (@tonkapark)
- **PR #96** (2026-04-29): Replace ACP transport with one-shot Claude/Codex CLI agents (@Shpigford)
- **PR #94** (closed): fix: Defer AI Assist file writes until user accepts the diff (#84) (@gustavogarci)
- **PR #93** (2026-04-11): Switch license from MIT to FSL-1.1-MIT (@Shpigford)
- **PR #91** (closed): accidentally created PR, was pushing to my fork (@yigitkonur)
- **PR #90** (2026-04-03): fix: AI Assist diff no longer overwrites entire document (@Shpigford)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
