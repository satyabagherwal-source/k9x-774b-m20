# Forensic Learning Record (Deep Inspection): CodeEditApp/CodeEdit

> **Canonical Artifact**: `07_PROJECT_LEARNING/codeeditapp-codeedit-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/CodeEditApp/CodeEdit](https://github.com/CodeEditApp/CodeEdit))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:04:08.840Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `CodeEditApp/CodeEdit`
- **Description**: 📝 CodeEdit App for macOS – Elevate your code editing experience. Open source, free forever.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 23062 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `CodeEdit/Features/Documents/WorkspaceDocument/WorkspaceDocument+SearchState.swift`
```
//
//  WorkspaceDocument+SearchState.swift
//  CodeEdit
//
//  Created by Tom Ludwig on 16.01.24.
//

import Foundation

extension WorkspaceDocument {
    final class SearchState: ObservableObject {
        enum IndexStatus: Equatable {
            case none
            case indexing(progress: Double)
            case done
        }

        enum FindNavigatorStatus: Equatable {
            case none
            case searching
            case replacing
            case found
            case replaced(updatedFiles: Int)
            case failed(errorMessage: String)
        }

        @Published var searchResult: [SearchResultModel] = []
        @Published var searchResultsFileCount: Int = 0
        @Published var searchResultsCount: Int = 0
        /// Stores the user's input, shown when no files are found, and persists across navigation items.
        @Published var searchQuery: String = ""
        @Published var replaceText: String = ""

        @Published var indexStatus: IndexStatus = .none

        @Published var findNavigatorStatus: FindNavigatorStatus = .none

        @Published var shouldFocusSearchField: Bool = false

        unowned var workspace: WorkspaceDocument
        var tempSearchResults = [SearchResultModel]()
        var caseSensitive: Bool = false
        var indexer: SearchIndexer?
        var selectedMode: [SearchModeModel] = [
            .Find,
            .Text,
            .Containing
        ]

        init(_ workspace: WorkspaceDocument) {
            self.workspace = workspace
            self.indexer = SearchIndexer.Memory.create()
            addProjectToIndex()
        }

        /// Represents the compare options to be used for find and replace.
        ///
        /// The `replaceOptions` property is a lazy, computed property that dynamically calculates
        /// the compare options based on the values of `selectedMode` and `ignoreCase`. It is used
        /// for controlling string replacement behavior for the find and replace functions.
        ///
        /// - Note: This property is implemented as a lazy property in the main class body because
        /// extensions cannot contain stored properties directly.
        lazy var replaceOptions: NSString.CompareOptions = {
            var options: NSString.CompareOptions = []

            if selectedMode.second == .RegularExpression {
                options.insert(.regularExpression)
            }

            if !caseSensitive {
                options.insert(.caseInsensitive)
            }

            return options
        }()
    }
}

```

### Core Architecture Module: `CodeEdit/Features/Documents/WorkspaceDocument/WorkspaceStateKey.swift`
```
//
//  WorkspaceStateKey.swift
//  CodeEdit
//
//  Created by Khan Winter on 7/3/23.
//

enum WorkspaceStateKey: String {
    case utilityAreaCollapsed
    case utilityAreaMaximized
    case utilityAreaHeight
    case openTabs
    case workspaceWindowSize
    case splitViewWidth
    case navigatorCollapsed
    case inspectorCollapsed
    case toolbarCollapsed
}

```

### Core Architecture Module: `CodeEdit/Features/Editor/Models/EditorLayout/EditorLayout+StateRestoration.swift`
```
//
//  Editor+StateRestoration.swift
//  CodeEdit
//
//  Created by Khan Winter on 7/3/23.
//

import Foundation
import SwiftUI
import OrderedCollections

extension EditorManager {
    /// Restores the tab manager from a captured state obtained using `saveRestorationState`
    /// - Parameter workspace: The workspace to retrieve state from.
    func restoreFromState(_ workspace: WorkspaceDocument) {
        defer {
            // No matter what, set the workspace on each editor. Even if we fail to read data.
            flattenedEditors.forEach { editor in
                editor.workspace = workspace
            }
        }

        do {
            guard let data = workspace.getFromWorkspaceState(.openTabs) as? Data else {
                return
            }

            let state = try JSONDecoder().decode(EditorRestorationState.self, from: data)

            guard !state.groups.isEmpty else {
                logger.warning("Empty Editor State found, restoring to clean editor state.")
                initCleanState()
                return
            }

            guard let activeEditor = state.groups.find(
                editor: state.activeEditor
            ) ?? state.groups.findSomeEditor() else {
                logger.warning("Editor state could not restore active editor.")
                initCleanState()
                return
            }

            try fixRestoredEditorLayout(state.groups, workspace: workspace)

            self.editorLayout = state.groups
            self.activeEditor = activeEditor
            switchToActiveEditor()
        } catch {
            logger.warning(
                "Could not restore editor state from saved data: \(error.localizedDescription, privacy: .public)"
            )
        }
    }

    /// Fix any hanging files after restoring from saved state.
    ///
    /// After decoding the state, we're left with `CEWorkspaceFile`s that don't exist in the file manager
    /// so this function maps all those to 'real' files. Works recursively on all the tab groups.
    /// - Parameters:
    ///   - group: The tab group to fix.
    ///   - fileManager: The file manager to use to map files.
    private func fixRestoredEditorLayout(_ group: EditorLayout, workspace: WorkspaceDocument) throws {
        switch group {
        case let .one(data):
            try fixEditor(data, workspace: workspace)
        case let .vertical(splitData):
            try splitData.editorLayouts.forEach { group in
                try fixRestoredEditorLayout(group, workspace: workspace)
            }
        case let .horizontal(splitData):
            try splitData.editorLayouts.forEach { group in
                try fixRestoredEditorLayout(group, workspace: workspace)
            }
        }
    }

    private func findEditorLayout(group: EditorLayout, searchFor id: UUID) throws -> Editor? {
        switch group {
        case let .one(data):
            return data.id == id ? data : nil
        case let .vertical(splitData):
            return try splitData.editorLayouts.compactMap { try findEditorLayout(group: $0, searchFor: id) }.first
        case let .horizontal(splitData):
            return try splitData.editorLayouts.compactMap { try findEditorLayout(group: $0, searchFor: id) }.first
        }
    }

    /// Fixes any hanging files after restoring from saved state.
    ///
    /// Resolves all file references with the workspace's file manager to ensure any referenced files use their shared
    /// object representation.
    ///
    /// - Parameters:
    ///   - data: The tab group to fix.
    ///   - fileManager: The file manager to use to map files.a
    private func fixEditor(_ editor: Editor, workspace: WorkspaceDocument) throws {
        guard let fileManager = workspace.workspaceFileManager else { return }
        let resolvedTabs = editor
            .tabs
            .compactMap({ fileManager.getFile($0.file.url.path(percentEncoded: false), createIfNotFound: true) })
            .map({ EditorInstance(workspace: workspace, file: $0) })

        for tab in resolvedTabs {
            try tab.file.loadCodeFile()
        }

        editor.workspace = workspace
        editor.tabs = OrderedSet(resolvedTabs)

        if let selectedTab = editor.selectedTab {
            if let resolvedFile = fileManager.getFile(
                selectedTab.file.url.path(percentEncoded: false),
                createIfNotFound: true
            ) {
                editor.setSelectedTab(resolvedFile)
            } else {
                editor.setSelectedTab(nil)
            }
        }
    }

    func saveRestorationState(_ workspace: WorkspaceDocument) {
        if let data = try? JSONEncoder().encode(
            EditorRestorationState(activeEditor: activeEditor.id, groups: editorLayout)
        ) {
            workspace.addToWorkspaceState(key: .openTabs, value: data)
        } else {
            workspace.addToWorkspaceState(key: .openTabs, value: nil)
        }
    }
}

struct EditorRestorationState: Codable {
    var activeEditor: UUID
    var groups: EditorLayout
}

extension EditorLayout: Codable {
    fileprivate enum EditorLayoutType: String, Codable {
        case one
        case vertical
        case horizontal
    }

    enum CodingKeys: String, CodingKey {
        case type
        case tabs
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(EditorLayoutType.self, forKey: .type)
        switch type {
        case .one:
            let editor = try container.decode(Editor.self, forKey: .tabs)
            self = .one(editor)
        case .vertical:
            let editor = try container.decode(SplitViewData.self, forKey: .tabs)
            self = .vertical(editor)
        case .horizontal:
            let editor = try container.decode(SplitViewData.self, forKey: .tabs)
            self = .horizontal(editor)
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case let .one(data):
            try container.encode(EditorLayoutType.one, forKey: .type)
            try container.encode(data, forKey: .tabs)
        case let .vertical(data):
            try container.encode(EditorLayoutType.vertical, forKey: .type)
            try container.encode(data, forKey: .tabs)
        case let .horizontal(data):
            try container.encode(EditorLayoutType.horizontal, forKey: .type)
            try container.encode(data, forKey: .tabs)
        }
    }
}

extension SplitViewData: Codable {
    fileprivate enum SplitViewAxis: String, Codable {
        case vertical, horizontal

        init(_ swiftUI: Axis) {
            switch swiftUI {
            case .vertical: self = .vertical
            case .horizontal: self = .horizontal
            }
        }

        var swiftUI: Axis {
            switch self {
            case .vertical: return .vertical
            case .horizontal: return .horizontal
            }
        }
    }

    enum CodingKeys: String, CodingKey {
        case editorLayouts
        case axis
    }

    convenience init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let axis = try container.decode(SplitViewAxis.self, forKey: .axis).swiftUI
        let editorLayouts = try container.decode([EditorLayout].self, forKey: .editorLayouts)
        self.init(axis, editorLayouts: editorLayouts)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(editorLayouts, forKey: .editorLayouts)
        try container.encode(SplitViewAxis(axis), forKey: .axis)
    }
}

extension Editor: Codable {
    enum CodingKeys: String, CodingKey {
        case tabs
        case selectedTab
        case id
    }

    convenience init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let fileURLs = try container.decode([URL].self, forKey: .tabs)
        let selectedTab = try? container.decode(URL.self, forKey: .selectedTab)
        let id = try container.decode(UUID.self, forKey: .id)
        self.init(
            files: OrderedSet(fileURLs.map { CEWorkspaceFile(url: $0) }),
            selectedTab: selectedTab == nil ? nil : EditorInstance(
                workspace: nil,
                file: CEWorkspaceFile(url: selectedTab!)
            ),
            parent: nil,
            workspace: nil
        )
        self.id = id
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(tabs.map { $0.file.url }, forKey: .tabs)
        try container.encode(selectedTab?.file.url, forKey: .selectedTab)
        try container.encode(id, forKey: .id)
    }
}

```

### Core Architecture Module: `CodeEdit/Features/Editor/Models/Restoration/EditorStateRestoration.swift`
```
//
//  EditorStateRestoration.swift
//  CodeEdit
//
//  Created by Khan Winter on 6/20/25.
//

import Foundation
import GRDB
import CodeEditSourceEditor
import OSLog

/// CodeEdit attempts to store and retrieve editor state for open tabs to restore the user's scroll position and
/// cursor positions between sessions. This class manages the storage mechanism to facilitate that feature.
///
/// This creates a sqlite database in the application support directory named `editor-restoration.db`.
///
/// To ensure we can query this quickly, this class is shared globally (to avoid having to use a database pool) and
/// all writes and reads are synchronous.
///
/// # If changes are required
///
/// Use the database migrator in the initializer for this class, see GRDB's documentation for adding a migration
/// version. **Do not ever** delete migration versions that have made it to a released version of CodeEdit.
final class EditorStateRestoration {
    /// Optional here so we can gracefully catch errors.
    /// The nice thing is this feature is optional in that if we don't have it available the user's experience is
    /// degraded but not catastrophic.
    static let shared: EditorStateRestoration? = try? EditorStateRestoration()

    private static let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "",
        category: "EditorStateRestoration"
    )

    struct StateRestorationRecord: Codable, TableRecord, FetchableRecord, PersistableRecord {
        let uri: String
        let data: Data
    }

    struct StateRestorationData: Codable, Equatable {
        // Cursor positions as range values (not row/column!)
        let cursorPositions: [Range<Int>]
        let scrollPositionX: Double
        let scrollPositionY: Double

        var scrollPosition: CGPoint {
            CGPoint(x: scrollPositionX, y: scrollPositionY)
        }

        var editorCursorPositions: [CursorPosition] {
            cursorPositions.map { CursorPosition(range: NSRange(start: $0.lowerBound, end: $0.upperBound)) }
        }

        init(cursorPositions: [CursorPosition], scrollPosition: CGPoint) {
            self.cursorPositions = cursorPositions
                .compactMap { $0.range }
                .map { $0.location..<($0.location + $0.length) }
            self.scrollPositionX = scrollPosition.x
            self.scrollPositionY = scrollPosition.y
        }
    }

    private var databaseQueue: DatabaseQueue?
    private var databaseURL: URL

    /// Create a new editor restoration object. Will connect to or create a SQLite db.
    /// - Parameter databaseURL: The database URL to use. Must point to a file, not a directory. If left `nil`, will
    ///                          create a new database named `editor-restoration.db` in the application support
    ///                          directory.
    init(_ databaseURL: URL? = nil) throws {
        self.databaseURL = databaseURL ?? FileManager.default
            .homeDirectoryForCurrentUser
            .appending(path: "Library/Application Support/CodeEdit", directoryHint: .isDirectory)
            .appending(path: "editor-restoration.db", directoryHint: .notDirectory)
        try attemptMigration(retry: true)
    }

    func attemptMigration(retry: Bool) throws {
        do {
            let databaseQueue = try DatabaseQueue(path: self.databaseURL.absolutePath, configuration: .init())

            var migrator = DatabaseMigrator()

            migrator.registerMigration("Version 0") {
                try $0.create(table: "stateRestorationRecord") { table in
                    table.column("uri", .text).primaryKey().notNull()
                    table.column("data", .blob).notNull()
                }
            }

            try migrator.migrate(databaseQueue)
            self.databaseQueue = databaseQueue
        } catch {
            if retry {
                // Try to delete the database on failure, might fix a corruption or version error.
                try? FileManager.default.removeItem(at: databaseURL)
                try attemptMigration(retry: false)

                return // Ignore the original error if we're retrying
            }
            Self.logger.error("Failed to start database connection: \(error)")
            throw error
        }
    }

    /// Update saved restoration state of a document.
    /// - Parameters:
    ///   - documentUrl: The URL of the document.
    ///   - data: The data to store for the file, retrieved using ``restorationState(for:)``.
    func updateRestorationState(for documentUrl: URL, data: StateRestorationData) {
        do {
            let serializedData = try JSONEncoder().encode(data)
            let dbRow = StateRestorationRecord(uri: documentUrl.absolutePath, data: serializedData)
            try databaseQueue?.write { try dbRow.upsert($0) }
        } catch {
            Self.logger.error("Failed to save editor state: \(error)")
        }
    }

    /// Find the restoration state for a document.
    /// - Parameter documentUrl: The URL of the document.
    /// - Returns: Any data saved for this file.
    func restorationState(for documentUrl: URL) -> StateRestorationData? {
        do {
            guard let row = try databaseQueue?.read({
                try StateRestorationRecord.fetchOne($0, key: documentUrl.absolutePath)
            }) else {
                return nil
            }
            let decodedData = try JSONDecoder().decode(StateRestorationData.self, from: row.data)
            return decodedData
        } catch {
            Self.logger.error("Failed to find editor state for '\(documentUrl.absolutePath)': \(error)")
        }
        return nil
    }
}

```

### Core Architecture Module: `CodeEdit/Features/LSP/LSPUtil.swift`
```
//
//  LSPUtil.swift
//  CodeEdit
//
//  Created by Abe Malla on 2/10/24.
//

import Foundation
import LanguageServerProtocol

enum LSPCompletionItemsUtil {

    /// Helper function to get the edits from a completion item
    /// - Parameters:
    ///  - startPosition: The position where the completion was requested
    ///  - item: The completion item
    ///  - Returns: An array of TextEdit objects
    static func getCompletionItemEdits(startPosition: Position, item: CompletionItem) -> [TextEdit] {
        var edits: [TextEdit] = []

        // If a TextEdit or InsertReplaceEdit value was provided
        if let edit = item.textEdit {
            editOrReplaceItem(edit: edit, &edits)
        } else if let insertText = item.insertText {
            // If the `insertText` value was provided
            insertTextItem(startPosition: startPosition, insertText: insertText, &edits)
        } else if !item.label.isEmpty {
            // Fallback to the label
            labelItem(startPosition: startPosition, label: item.label, &edits)
        }

        // If additional edits were provided
        // An example would be to also include an 'import' statement at the top of the file
        if let additionalEdits = item.additionalTextEdits {
            edits.append(contentsOf: additionalEdits)
        }

        return edits
    }

    private static func editOrReplaceItem(edit: TwoTypeOption<TextEdit, InsertReplaceEdit>, _ edits: inout [TextEdit]) {
        switch edit {
        case .optionA(let textEdit):
            edits.append(textEdit)
        case .optionB(let insertReplaceEdit):
            edits.append(
                TextEdit(range: insertReplaceEdit.insert, newText: insertReplaceEdit.newText)
            )
            edits.append(
                TextEdit(range: insertReplaceEdit.replace, newText: insertReplaceEdit.newText)
            )
        }
    }

    private static func insertTextItem(startPosition: Position, insertText: String, _ edits: inout [TextEdit]) {
        let endPosition = Position((startPosition.line, startPosition.character + insertText.count))
        edits.append(
            TextEdit(
                range: LSPRange(start: startPosition, end: endPosition),
                newText: insertText
            )
        )
    }

    private static func labelItem(startPosition: Position, label: String, _ edits: inout [TextEdit]) {
        let endPosition = Position((startPosition.line, startPosition.character + label.count))
        edits.append(
            TextEdit(
                range: LSPRange(start: startPosition, end: endPosition),
                newText: label
            )
        )
    }
}

```

### Core Architecture Module: `CodeEdit/Features/SourceControl/Accounts/GitLab/Model/GitLabProjectHook.swift`
```
//
//  GitLabProjectHook.swift
//  CodeEditModules/GitAccounts
//
//  Created by Nanashi Li on 2022/03/31.
//

import Foundation

class GitLabProjectHook: Codable {
    var id: Int?
    var url: URL?
    var projectID: Int?
    var pushEvents: Bool?
    var issuesEvents: Bool?
    var mergeRequestsEvents: Bool?
    var tagPushEvents: Bool?
    var noteEvents: Bool?
    var buildEvents: Bool?
    var pipelineEvents: Bool?
    var wikiPageEvents: Bool?
    var enableSSLVerification: Bool?
    var createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case url
        case projectID = "project_id"
        case pushEvents = "push_events"
        case issuesEvents = "issues_events"
        case mergeRequestsEvents = "merge_requests_events"
        case tagPushEvents = "tag_push_events"
        case noteEvents = "note_events"
        case buildEvents = "build_events"
        case pipelineEvents = "pipeline_events"
        case wikiPageEvents = "wiki_page_events"
        case enableSSLVerification = "enable_ssl_verification"
        case createdAt = "created_at"
    }
}

extension GitLabAccount {

    /**
     Get a list of project hooks.
     - parameter id: The ID of the project or namespace/project name.
     Make sure that the namespace/project-name is URL-encoded, eg. "%2F" for "/".
     - parameter completion: Callback for the outcome of the fetch.
     */
    func projectHooks(
        _ session: GitURLSession = URLSession.shared,
        id: String,
        completion: @escaping (_ response: Result<GitLabProjectHook, Error>) -> Void
    ) -> GitURLSessionDataTaskProtocol? {
        let router = GitLabProjectRouter.readProjectHooks(configuration: configuration, id: id)

        return router.load(
            session,
            dateDecodingStrategy: .formatted(GitTime.rfc3339DateFormatter),
            expectedResultType: GitLabProjectHook.self
        ) { json, error in

            if let error {
                completion(Result.failure(error))
            }

            if let json {
                completion(Result.success(json))
            }
        }
    }

    /**
     Get a specific hook from a project.
     - parameter id: The ID of the project or namespace/project name.
     Make sure that the namespace/project-name is URL-encoded, eg. "%2F" for "/".
     - parameter hookId: The ID of the hook in the project
     (you can get the ID of a hook by searching for it with the **allProjectHooks** request).
     - parameter completion: Callback for the outcome of the fetch.
     */
    func projectHook(
        _ session: GitURLSession = URLSession.shared,
        id: String,
        hookId: String,
        completion: @escaping (_ response: Result<GitLabProjectHook, Error>) -> Void
    ) -> GitURLSessionDataTaskProtocol? {
        let router = GitLabProjectRouter.readProjectHook(
            configuration: configuration,
            id: id,
            hookId: hookId
        )

        return router.load(
            session,
            dateDecodingStrategy: .formatted(GitTime.rfc3339DateFormatter),
            expectedResultType: GitLabProjectHook.self
        ) { json, error in

            if let error {
                completion(Result.failure(error))
            }

            if let json {
                completion(Result.success(json))
            }
        }
    }
}

```

### Core Architecture Module: `CodeEdit/Features/SourceControl/Accounts/Utils/GitTime.swift`
```
//
//  GitTime.swift
//  CodeEditModules/GitAccounts
//
//  Created by Nanashi Li on 2022/03/31.
//

import Foundation

// TODO: DOCS (Nanashi Li)
enum GitTime {

    /**
     A date formatter for RFC 3339 style timestamps.
     Uses POSIX locale and GMT timezone so that date values are parsed as absolutes.
     - (https://tools.ietf.org/html/rfc3339)
     - (https://developer.apple.com/library/mac/qa/qa1480/_index.html)
     */
    static var rfc3339DateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy'-'MM'-'dd'T'HH':'mm':'ss'Z'"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        return formatter
    }()

    /**
     Parses RFC 3339 date strings into NSDate
     - parameter string: The string representation of the date
     - returns: An `NSDate` with a successful parse, otherwise `nil`
     */
    static func rfc3339Date(_ string: String?) -> Date? {
        guard let string else { return nil }
        return GitTime.rfc3339DateFormatter.date(from: string)
    }
}

```

### Core Architecture Module: `CodeEdit/Features/SourceControl/Accounts/Utils/String+PercentEncoding.swift`
```
//
//  String+PercentEncoding.swift
//  CodeEditModules/GitAccounts
//
//  Created by Nanashi Li on 2022/03/31.
//

import Foundation

extension String {

    /// Percent-encodes a string to be URL-safe
    ///
    /// See https://useyourloaf.com/blog/how-to-percent-encode-a-url-string/ for more info
    /// - returns: An optional string, with percent encoding to match RFC3986
    func stringByAddingPercentEncodingForRFC3986() -> String? {
        let unreserved = "-._~/?"
        var allowed = CharacterSet.alphanumerics
        allowed.insert(charactersIn: unreserved)
        return addingPercentEncoding(withAllowedCharacters: allowed)
    }
}

```

### Core Architecture Module: `CodeEdit/Features/SourceControl/Accounts/Utils/String+QueryParameters.swift`
```
//
//  String+QueryParameters.swift
//  CodeEditModules/GitAccounts
//
//  Created by Nanashi Li on 2022/03/31.
//

import Foundation

extension String {
    var bitbucketQueryParameters: [String: String] {
        let parametersArray = components(separatedBy: "&")
        var parameters = [String: String]()
        parametersArray.forEach { parameter in
            let keyValueArray = parameter.components(separatedBy: "=")
            let (key, value) = (keyValueArray.first, keyValueArray.last)
            if let key = key?.removingPercentEncoding, let value = value?.removingPercentEncoding {
                parameters[key] = value
            }
        }
        return parameters
    }
}

```

### Core Architecture Module: `CodeEdit/Features/StatusBar/Views/StatusBarItems/StatusBarToggleUtilityAreaButton.swift`
```
//
//  StatusBarToggleUtilityAreaButton.swift
//  CodeEdit
//
//  Created by Lukas Pistrol on 22.03.22.
//

import SwiftUI

internal struct StatusBarToggleUtilityAreaButton: View {
    @Environment(\.controlActiveState)
    var controlActiveState

    @EnvironmentObject private var utilityAreaViewModel: UtilityAreaViewModel

    internal var body: some View {
        Button {
            utilityAreaViewModel.togglePanel()
        } label: {
            Image(systemName: "square.bottomthird.inset.filled")
        }
        .buttonStyle(.icon)
        .keyboardShortcut("Y", modifiers: [.command, .shift])
        .help(utilityAreaViewModel.isCollapsed ? "Show the Utility area" : "Hide the Utility area")
        .onHover { isHovering($0) }
        .onChange(of: controlActiveState) { _, newValue in
            if newValue == .key {
                CommandManager.shared.addCommand(
                    name: "Toggle Utility Area",
                    title: "Toggle Utility Area",
                    id: "open.drawer",
                    command: { [weak utilityAreaViewModel] in utilityAreaViewModel?.togglePanel() }
                )
            }
        }
        .onAppear {
            CommandManager.shared.addCommand(
                name: "Toggle Utility Area",
                title: "Toggle Utility Area",
                id: "open.drawer",
                command: { [weak utilityAreaViewModel] in utilityAreaViewModel?.togglePanel() }
            )
        }
    }
}

```

### Core Architecture Module: `CodeEdit/Features/UtilityArea/DebugUtility/TaskOutputActionsView.swift`
```
//
//  TaskOutputActionsView.swift
//  CodeEdit
//
//  Created by Tommy Ludwig on 27.06.24.
//

import SwiftUI

struct TaskOutputActionsView: View {
    @ObservedObject var activeTask: CEActiveTask
    @ObservedObject var taskManager: TaskManager
    @Binding var scrollProxy: ScrollViewProxy?

    @Namespace var bottomID
    var body: some View {
        HStack {
            Spacer()

            Button {
                Task {
                    await taskManager.runTask(task: activeTask.task)
                }
            } label: {
                Image(systemName: "memories")
                    .foregroundStyle(.green)
            }
            .buttonStyle(.icon)
            .help("Run Task")

            Button {
                taskManager.terminateTask(taskID: activeTask.task.id)
            } label: {
                Image(systemName: "stop.fill")
                    .foregroundStyle(
                        (activeTask.status == .running || activeTask.status == .stopped) ? .red : .gray
                    )
            }
            .buttonStyle(.icon)
            .disabled(!(activeTask.status == .running || activeTask.status == .stopped))
            .help("Stop Task")

            Button {
                if activeTask.status == .stopped {
                    activeTask.resume()
                } else if activeTask.status == .running {
                    activeTask.suspend()
                }
            } label: {
                if activeTask.status == .stopped {
                    Image(systemName: "play")
                } else {
                    Image(systemName: "pause")
                }
            }
            .buttonStyle(.icon)
            .disabled(!(activeTask.status == .running || activeTask.status == .stopped))
            .opacity(activeTask.status == .running || activeTask.status == .stopped ? 1 : 0.5)
            .help(activeTask.status == .stopped ? "Resume Task" : "Suspend Task")

            Divider()

            Button {
                withAnimation {
                    scrollProxy?.scrollTo(bottomID, anchor: .bottom)
                }
            } label: {
                Image(systemName: "text.append")
            }
            .buttonStyle(.icon)
            .help("Scroll down to the bottom")

            Button {
                activeTask.clearOutput()
            } label: {
                Image(systemName: "trash")
            }
            .buttonStyle(.icon)
            .help("Clear Output")
        }
    }
}

```

### Core Architecture Module: `CodeEdit/Features/UtilityArea/DebugUtility/TaskOutputView.swift`
```
//
//  TaskOutputView.swift
//  CodeEdit
//
//  Created by Tommy Ludwig on 27.06.24.
//

import SwiftUI

struct TaskOutputView: View {
    @ObservedObject var activeTask: CEActiveTask

    var body: some View {
        if activeTask.output != nil, let workspaceURL = activeTask.workspaceURL {
            TerminalEmulatorView(url: workspaceURL, task: activeTask)
        } else {
            EmptyView()
        }
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2175** (2026-04-17): **🐞 Files save but end up empty**
  *Symptoms*: ### Description  Hey, I ran into a pretty frustrating issue where saving files seems to work… but the contents just don’t actually get written.  ### To Reproduce  1. Open CodeEdit 2. Create or open a file 3. Type anything into it 4. Save using Cmd + S (or the save option in the menu) 5. Check the file afterward (in Finder or by reopening it)  ### Expected Behavior  The file should save normally with whatever content I added.  ### Version Information  macOS version: 26.4 CodeEdit version: v0.3.6   ### Additional Context  This happened consistently every time I tried saving.  I didn’t check whether CodeEdit had Full Disk Access in macOS Privacy settings before uninstalling, so I’m not sure if that could be related.  If it is a permissions issue, maybe the app could warn about it or document it more clearly.  ### Screenshots  _No response_
  **Post-Mortem & Fix Analysis**:
  > Quick update: I tried reproducing this after a fresh macOS reinstall, and the issue still happens consistently.  So it doesn’t seem to be caused by leftover configs or a broken local setup. I still didn’t explicitly verify Full Disk Access permissions, but this was on a clean system.
  > New update: I just looked through the GitHub commit comments, and found out that sidebar files are just "Scratch Pads" for pasting content but don't actually save, instead I just create a new file from the menu bar after I decided to redownload CodeEdit, apologies for not reading thoroughly.

- **Issue #2140** (2025-12-31): **🐞 Renaming in document windows cannot sync with welcome window immediately**
  *Symptoms*: ### Description  When I create a new file, and rename it in document window, the path on welcome window will not update.  ### To Reproduce  1. Create a new file or open a file 2. Rename in document window 3. Close this window, open the welcome window 4. Open the file in recents view  ### Expected Behavior  When I rename the file, list of recents should update the path synchronously.  ### Version Information  CodeEdit: 0.3.6 macOS: 26.1 Xcode: 26.1   ### Additional Context  It seems that I need to open another file to refresh recentsView again, but it should refresh immediately after the file is renamed.  ### Screenshots  https://github.com/user-attachments/assets/67137e2c-dd9b-40af-8a26-ae5cebc47ba0  
  **Post-Mortem & Fix Analysis**:
  > This may require modifying the package "WelcomeWindow". Can you assign this issue to me? I will submit to the repo of WelcomeWindow.
  > Hello @austincondiff , this issue has been solved in CodeEditApp/WelcomeWindow#4 . Please review.
  > Issue needs to be moved to https://github.com/CodeEditApp/WelcomeWindow

- **Issue #2138** (2025-12-31): **🐞 Popup request to Install Command Line Developer Tools appear at every launch**
  *Symptoms*: ### Description  Every time I open the CodeEdit, I see the popup window telling me: The "git" command requires the command line developer tools. Would you like to install the tools now?  I don't use the "git" commands in my projects, and normally I work with `.py` files locally. So, in CodeEdit > Settings > I turned off the Source Control completely. This removes the message-reminder in the application's control bar. However, at every application launch, I still have a popup window with the proposition to install Command Line Developer Tools.  ### To Reproduce  1. Open an application. 2. Close the popup window with request to install Command Line Developer Tools. 3. Open application Settings > Source Control and turn it off completely. 4. Quite and reopen application. 5. See that popup with request to install Command Line Developer Tools appears again.  ### Expected Behavior  Make this popup request relay on the application settings, or even add some special setting to display or not display this exact request.  ### Version Information  CodeEdit: 0.3.6 macOS: 15.6.1 Xcode: Not installed   ### Additional Context  _No response_  ### Screenshots  _No response_
  **Post-Mortem & Fix Analysis**:
  > Hey, can you check if this is still happening, with https://github.com/CodeEditApp/CodeEdit/pull/2148 it should be fixed.
  > I tested it and can confirm that issue is gone now. Thanks for your work. And Happy New Year!

- **Issue #2132** (2025-09-15): **Adjust Git Status Parsing to Better Handle Null Chars**
  *Symptoms*: ### Description  Fixes an issue with git status parsing where the substring indexing was off-by-one when creating the file string due to an index being incremented before creating a substring.  Fixes this by incrementing the current string index *after* returning the correct substring.  The related issue is marked as a Tahoe bug, the Tahoe bug is that Tahoe now shows the null character as a %00 at the end of the label, where previous macOS versions did not. This change is retroactive however as it is a bug fix.  ### Related Issues  * closes #2119   ### Checklist  - [x] I read and understood the [contributing guide](https://github.com/CodeEditApp/CodeEdit/blob/main/CONTRIBUTING.md) as well as the [code of conduct](https://github.com/CodeEditApp/CodeEdit/blob/main/CODE_OF_CONDUCT.md) - [x] The issues this PR addresses are related to each other - [x] My changes generate no new warnings - [x] My code builds and runs on my machine - [x] My changes are all related to the related issue above - [x] I documented my code  ### Screenshots  N/A

- **Issue #2120** (2025-09-11): **🐞 macOS Tahoe Git Clone Pane Broken**
  *Symptoms*: The git clone pane from the welcome window is messed up on Tahoe.  <img width="852" height="576" alt="Image" src="https://github.com/user-attachments/assets/28f64f1f-95c1-49c1-919b-7e479e7dc455" />

- **Issue #2119** (2025-09-15): **🐞 macOS Tahoe Git File Items have an extra character at the end**
  *Symptoms*: <img width="315" height="165" alt="Image" src="https://github.com/user-attachments/assets/fba0b1cd-0572-4c9d-87ee-f88dc3f7860f" />

- **Issue #2118** (2026-08-18): **🐞 macOS Tahoe Navigator won't use correct size**
  *Symptoms*: ### Description  on Tahoe the navigator refuses to use the correct size on launch.  <img width="1378" height="917" alt="Image" src="https://github.com/user-attachments/assets/aaabb164-e016-4b94-8402-c36f4fa60b38" />  ### To Reproduce  .  ### Expected Behavior  .  ### Version Information  tahoe   ### Additional Context  _No response_  ### Screenshots  _No response_

- **Issue #2116** (2025-09-11): **🐞 Can't Compile With Swift 6.2**
  *Symptoms*: ### Description  CodeEdit has a few concurrency related issues when compiling on Xcode 26.  <img width="303" height="351" alt="Image" src="https://github.com/user-attachments/assets/dcc23513-62fb-403e-8c06-29e0020abc19" />  ### To Reproduce  .  ### Expected Behavior  .  ### Version Information  macOS: 26 beta Xcode: 26   ### Additional Context  _No response_  ### Screenshots  _No response_
  **Post-Mortem & Fix Analysis**:
  > Turns out these are all issues with WelcomeWindow. Will create a PR there and link it here.
  > What in the world, these issues don't appear with Swift 6.2 or any of the strict concurrency or the new default actor isolation. Only in Xcode 26.
  > Okay note for future people looking at this, Xcode enables a bunch of 6.2 features by default so just compiling a project using the snapshot toolchain isn't enough. To correctly mimic the errors you'll get on Xcode 26 just use Xcode 26.

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

### Incident Patch 1: `cec6287a` (2025-12-14)
**Commit Message**: Fix: Prevent git popup when Source Control is disabled (#2138) (#2148)

**File**: `CodeEdit/WorkspaceView.swift` (modified, +3/-0)
```diff
@@ -85,6 +85,9 @@ struct WorkspaceView: View {
                     // MARK: - Source Control
 
                     .task {
+                        // Only refresh git data if source control is enabled
+                        guard sourceControlIsEnabled else { return }
+                        
                         do {
                             try await sourceControlManager.refreshRemotes()
                             try await sourceControlManager.refreshStashEntries()
```

---

### Incident Patch 2: `78c3be9c` (2025-12-12)
**Commit Message**: Fix/deprecations memory leak entitlements (#2147)

**File**: `CodeEdit.xcodeproj/project.pbxproj` (modified, +41/-21)
```diff
@@ -397,7 +397,7 @@
 			attributes = {
 				BuildIndependentTargetsInParallel = 1;
 				LastSwiftUpdateCheck = 1330;
-				LastUpgradeCheck = 1640;
+				LastUpgradeCheck = 2610;
 				TargetAttributes = {
 					2BE487EB28245162003F3F64 = {
 						CreatedOnToolsVersion = 13.3.1;
@@ -643,13 +643,14 @@
 				GCC_WARN_UNINITIALIZED_AUTOS = YES_AGGRESSIVE;
 				GCC_WARN_UNUSED_FUNCTION = YES;
 				GCC_WARN_UNUSED_VARIABLE = YES;
-				MACOSX_DEPLOYMENT_TARGET = 13.0;
+				MACOSX_DEPLOYMENT_TARGET = 14.0;
 				MARKETING_VERSION = "";
 				MTL_ENABLE_DEBUG_INFO = NO;
 				MTL_FAST_MATH = YES;
 				OTHER_SWIFT_FLAGS = "-D ALPHA";
 				RUN_DOCUMENTATION_COMPILER = YES;
 				SDKROOT = macosx;
+				STRING_CATALOG_GENERATE_SYMBOLS = YES;
 				SWIFT_COMPILATION_MODE = wholemodule;
 				SWIFT_OPTIMIZATION_LEVEL = "-O";
 				SYSTEM_FRAMEWORK_SEARCH_PATHS = "";
@@ -673,6 +674,7 @@
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "\"CodeEdit/Preview Content\"";
 				DEVELOPMENT_TEAM = "";
+				ENABLE_APP_SANDBOX = YES;
 				ENABLE_HARDENED_RUNTIME = YES;
 				ENABLE_PREVIEWS = YES;
 				GENERATE_INFOPLIST_FILE = NO;
@@ -684,12 +686,14 @@
 					"$(inherited)",
 					"@executable_path/../Frameworks",
 				);
-				MACOSX_DEPLOYMENT_TARGET = 13.0;
+				MACOSX_DEPLOYMENT_TARGET = 14.0;
 				MARKETING_VERSION = "Change in Info.plist";
 				PRODUCT_BUNDLE_IDENTIFIER = app.codeedit.CodeEdit;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				PROVISIONING_PROFILE_SPECIFIER = "";
 				REGISTER_APP_GROUPS = YES;
+				RUNTIME_EXCEPTION_ALLOW_JIT = YES;
+				RUNTIME_EXCEPTION_DISABLE_LIBRARY_VALIDATION = YES;
 				RUN_DOCUMENTATION_COMPILER = NO;
 				SWIFT_EMIT_LOC_STRINGS = YES;
 				SWIFT_OBJC_BRIDGING_HEADER = "";
@@ -715,7 +719,7 @@
 					"@executable_path/../Frameworks",
 					"@loader_path/../Frameworks",
 				);
-				MACOSX_DEPLOYMENT_TARGET = 13.0;
+				MACOSX_DEPLOYMENT_TARGET = 14.0;
 				MARKETING_VERSION = 1.0;
 				PRODUCT_BUNDLE_IDENTIFIER = app.codeedit.CodeEditTests;
 				PRODUCT_NAME = "$(TARGET_NAME)";
@@ -777,7 +781,7 @@
 					"@executable_path/../Frameworks",
 					"@executable_path/../../../../Frameworks",
 				);
-				MACOSX_DEPLOYMENT_TARGET = 13.0;
+				MACOSX_DEPLOYMENT_TARGET = 14.0;
 				MARKETING_VERSION = 1.0;
 				PRODUCT_BUNDLE_IDENTIFIER = app.codeedit.CodeEdit.OpenWithCodeEdit;
 				PRODUCT_NAME = "$(TARGET_NAME)";
@@ -840,13 +844,14 @@
 				GCC_WARN_UNINITIALIZED_AUTOS = YES_AGGRESSIVE;
 				GCC_WARN_UNUSED_FUNCTION = YES;
 				GCC_WARN_UNUSED_VARIABLE = YES;
-				MACOSX_DEPLOYMENT_TARGET = 13.0;
+				MACOSX_DEPLOYMENT_TARGET = 14.0;
 				MARKETING_VERSION = "";
 				MTL_ENABLE_DEBUG_INFO = NO;
 				MTL_FAST_MATH = YES;
 				OTHER_SWIFT_FLAGS = "-D BETA";
 				RUN_DOCUMENTATION_COMPILER = YES;
 				SDKROOT = macosx;
+				STRING_CATALOG_GENERATE_SYMBOLS = YES;
 				SWIFT_COMPILATION_MODE = wholemodule;
 				SWIFT_OPTIMIZATION_LEVEL = "-O";
 				SYSTEM_FRAMEWORK_SEARCH_PATHS = "";
@@ -870,6 +875,7 @@
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "\"CodeEdit/Preview Content\"";
 				DEVELOPMENT_TEAM = "";
+				ENABLE_APP_SANDBOX = YES;
 				ENABLE_HARDENED_RUNTIME = YES;
 				ENABLE_PREVIEWS = YES;
 				GENERATE_INFOPLIST_FILE = NO;
@@ -881,12 +887,14 @@
 					"$(inherited)",
 					"@executable_path/../Frameworks",
 				);
-				MACOSX_DEPLOYMENT_TARGET = 13.0;
+				MACOSX_DEPLOYMENT_TARGET = 14.0;
 				MARKETING_VERSION = "Change in Info.plist";
 				PRODUCT_BUNDLE_IDENTIFIER = app.codeedit.CodeEdit;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				PROVISIONING_PROFILE_SPECIFIER = "";
 				REGISTER_APP_GROUPS = YES;
+				RUNTIME_EXCEPTION_ALLOW_JIT = YES;
+				RUNTIME_EXCEPTION_DISABLE_LIBRARY_VALIDATION = YES;
 				RUN_DOCUMENTATION_COMPILER = NO;
 				SWIFT_EMIT_LOC_STRINGS = YES;
 				SWIFT_OBJC_BRIDGING_HEADER = "";
@@ -912,7 +920,7 @@
 					"@executable_path/../Frameworks",
 					"@loader_path/../Frameworks",
 				);
-				MACOSX_DEPLOYMENT_TARGET = 13.0;
+				MACOSX_DEPLOYMENT_TARGET = 14.0;
 				MARKETING_VERSION = 1.0;
 				PRODUCT_BUNDLE_IDENTIFIER = app.codeedit.CodeEditTests;
 				PRODUCT_NAME = "$(TARGET_NAME)";
@@ -974,7 +982,7 @@
 					"@executable_path/../Frameworks",
 					"@executable_path/../../../../Frameworks",
 				);
-				MACOSX_DEPLOYMENT_TARGET = 13.0;
+				MACOSX_DEPLOYMENT_TARGET = 14.0;
 				MARKETING_VERSION = 1.0;
 				PRODUCT_BUNDLE_IDENTIFIER = app.codeedit.CodeEdit.OpenWithCodeEdit;
 				PRODUCT_NAME = "$(TARGET_NAME)";
@@ -1009,7 +1017,7 @@
 					"@executable_path/../Frameworks",
 					"@executable_path/../../../../Frameworks",
 				);
-				MACOSX_DEPLOYMENT_TARGET = 13.0;
+				MACOSX_DEPLOYMENT_TARGET = 14.0;
 				MARKETING_VERSION = 1.0;
 				PRODUCT_BUNDLE_IDENTIFIER = app.codeedit.CodeEdit.OpenWithCodeEdit;
 				PRODUCT_NAME = "$(TARGET_NAME)";
@@ -1044,7 +1052,7 @@
 					"@executable_path/../Frameworks",
 					"@executable_path/../../../../Frameworks",
 				);
-				MACOSX_DEPLOYMENT_TARGET = 13.0;
+				MACOSX_DEPLOYMENT_TARGET = 14.0;
 				MARKETING_VERSIO
```

**File**: `CodeEdit.xcodeproj/xcshareddata/xcschemes/CodeEdit.xcscheme` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 <?xml version="1.0" encoding="UTF-8"?>
 <Scheme
-   LastUpgradeVersion = "2600"
+   LastUpgradeVersion = "2610"
    version = "1.7">
    <BuildAction
       parallelizeBuildables = "YES"
```

**File**: `CodeEdit.xcodeproj/xcshareddata/xcschemes/OpenWithCodeEdit.xcscheme` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 <?xml version="1.0" encoding="UTF-8"?>
 <Scheme
-   LastUpgradeVersion = "2600"
+   LastUpgradeVersion = "2610"
    wasCreatedForAppExtension = "YES"
    version = "2.0">
    <BuildAction
```

**File**: `CodeEdit/CodeEdit.entitlements` (modified, +8/-4)
```diff
@@ -2,14 +2,18 @@
 <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
 <plist version="1.0">
 <dict>
+	<key>com.apple.security.app-sandbox</key>
+	<true/>
+	<key>com.apple.security.files.user-selected.read-write</key>
+	<true/>
+	<key>com.apple.security.files.bookmarks.app-scope</key>
+	<true/>
+	<key>com.apple.security.network.client</key>
+	<true/>
 	<key>com.apple.security.application-groups</key>
 	<array>
 		<string>app.codeedit.CodeEdit.shared</string>
 		<string>$(TeamIdentifierPrefix)</string>
 	</array>
-	<key>com.apple.security.cs.allow-jit</key>
-	<true/>
-	<key>com.apple.security.cs.disable-library-validation</key>
-	<true/>
 </dict>
 </plist>
```

**File**: `CodeEdit/Features/ActivityViewer/Notifications/TaskNotificationView.swift` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@ struct TaskNotificationView: View {
             }
         }
         .animation(.easeInOut, value: notification)
-        .onChange(of: taskNotificationHandler.notifications) { newValue in
+        .onChange(of: taskNotificationHandler.notifications) { _, newValue in
             withAnimation {
                 notification = newValue.first
             }
```

**File**: `CodeEdit/Features/ActivityViewer/Notifications/TaskNotificationsDetailView.swift` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@ struct TaskNotificationsDetailView: View {
         }
         .padding(15)
         .frame(minWidth: 320)
-        .onChange(of: taskNotificationHandler.notifications) { newValue in
+        .onChange(of: taskNotificationHandler.notifications) { _, newValue in
             if selectedTaskNotificationIndex >= newValue.count {
                 selectedTaskNotificationIndex = 0
             }
```

**File**: `CodeEdit/Features/CEWorkspaceSettings/Views/EnvironmentVariableListItem.swift` (modified, +3/-3)
```diff
@@ -50,7 +50,7 @@ struct EnvironmentVariableListItem: View {
                 .autocorrectionDisabled()
                 .labelsHidden()
         }
-        .onChange(of: isKeyFocused) { isFocused in
+        .onChange(of: isKeyFocused) { _, isFocused in
             if isFocused {
                 if selectedEnvID != environmentVariable.id {
                     selectedEnvID = environmentVariable.id
@@ -62,10 +62,10 @@ struct EnvironmentVariableListItem: View {
                 }
             }
         }
-        .onChange(of: key) { newValue in
+        .onChange(of: key) { _, newValue in
             environmentVariable.key = newValue
         }
-        .onChange(of: value) { newValue in
+        .onChange(of: value) { _, newValue in
             environmentVariable.value = newValue
         }
     }
```

**File**: `CodeEdit/Features/CodeEditUI/Views/KeyValueTable.swift` (modified, +1/-1)
```diff
@@ -203,7 +203,7 @@ struct KeyValueTable<Header: View, ActionBarView: View>: View {
             }
             selection = []
         }
-        .onChange(of: items) { newValue in
+        .onChange(of: items) { _, newValue in
             updateTableItems(newValue)
         }
     }
```

---

### Incident Patch 3: `5c2d8ec4` (2025-09-15)
**Commit Message**: Adjust Git Status Parsing to Better Handle Null Chars (#2132)

### Description

Fixes an issue with git status parsing where the substring indexing was
off-by-one when creating the file string due to an index being
incremented before creating a substring.

Fixes this by incrementing the current string index *after* returning
the correct substring.

The related issue is marked as a Tahoe bug, the Tahoe bug is that Tahoe
now shows the null character as a %00 at the end of the label, where
previous macOS versions did not. This change is retroactive however as
it is a bug fix.

### Related Issues

* closes #2119 

### Checklist

- [x] I read and understood the [contributing
guide](https://github.com/CodeEditApp/CodeEdit/blob/main/CONTRIBUTING.md)
as well as the [code of
conduct](https://github.com/CodeEditApp/CodeEdit/blob/main/CODE_OF_CONDUCT.md)
- [x] The issues this PR addresses are related to each other
- [x] My changes generate no new warnings
- [x] My code builds and runs on my machine
- [x] My changes are all related to the related issue above
- [x] I documented my code

### Screenshots

N/A

**File**: `CodeEdit/Features/SourceControl/Client/GitClient+Status.swift` (modified, +22/-3)
```diff
@@ -36,11 +36,25 @@ extension GitClient {
     /// - Throws: Can throw ``GitClient/GitClientError`` errors if it finds unexpected output.
     func getStatus() async throws -> Status {
         let output = try await run("status -z --porcelain=2 -u")
+        return try parseStatusString(output)
+    }
+
+    /// Parses a status string from ``getStatus()`` and returns a ``Status`` object if possible.
+    /// - Parameter output: The git output from running `status`. Expects a porcelain v2 string.
+    /// - Returns: A status object if parseable.
+    func parseStatusString(_ output: borrowing String) throws -> Status {
+        let endsInNull = output.last == Character(UnicodeScalar(0))
+        let endIndex: String.Index
+        if endsInNull && output.count > 1 {
+            endIndex = output.index(before: output.endIndex)
+        } else {
+            endIndex = output.endIndex
+        }
 
         var status = Status(changedFiles: [], unmergedChanges: [], untrackedFiles: [])
 
         var index = output.startIndex
-        while index < output.endIndex {
+        while index < endIndex {
             let typeIndex = index
 
             // Move ahead no matter what.
@@ -100,7 +114,11 @@ extension GitClient {
             }
             index = newIndex
         }
-        index = output.index(after: index)
+        defer {
+            if index < output.index(before: output.endIndex) {
+                index = output.index(after: index)
+            }
+        }
         return output[startIndex..<index]
     }
 
@@ -147,7 +165,8 @@ extension GitClient {
             try moveToNextSpace(from: &index, output: output)
         }
         try moveOneChar(from: &index, output: output)
-        let filename = String(try substringToNextNull(from: &index, output: output))
+        let substring = try substringToNextNull(from: &index, output: output)
+        let filename = String(substring)
         return GitChangedFile(
             status: status,
             stagedStatus: stagedStatus,
```

**File**: `CodeEditTests/Features/SourceControl/GitClientTests.swift` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+//
+//  GitClientTests.swift
+//  CodeEditTests
+//
+//  Created by Khan Winter on 9/11/25.
+//
+
+import Testing
+@testable import CodeEdit
+
+@Suite
+struct GitClientTests {
+    @Test
+    func statusParseNullAtEnd() throws {
+        try withTempDir { dirURL in
+            // swiftlint:disable:next line_length
+            let string = "1 .M N... 100644 100644 100644 eaef31cfa2a22418c00d7477da0b7151d122681e eaef31cfa2a22418c00d7477da0b7151d122681e CodeEdit/Features/SourceControl/Client/GitClient+Status.swift\01 AM N... 000000 100644 100644 0000000000000000000000000000000000000000 e0f5ce250b32cf6610a284b7a33ac114079f5159 CodeEditTests/Features/SourceControl/GitClientTests.swift\0"
+            let client = GitClient(directoryURL: dirURL, shellClient: .live())
+            let status = try client.parseStatusString(string)
+
+            #expect(status.changedFiles.count == 2)
+            // No null string at the end
+            #expect(status.changedFiles[0].fileURL.lastPathComponent == "GitClient+Status.swift")
+            #expect(status.changedFiles[1].fileURL.lastPathComponent == "GitClientTests.swift")
+        }
+    }
+}
```

---

### Incident Patch 4: `0abc12f2` (2025-09-11)
**Commit Message**: Fix Alignment In Git Clone Panel (#2131)

### Description

Removes all hard-coded locations and widths in the git clone panel,
swapping them out for correct SwiftUI layout.

This fixes an issue on macOS Tahoe but is not limited to Tahoe
intentionally. This should not be hardcoded on any platform and does not
change the layout of the panel on Sequoia or lower.

### Related Issues

* closes #2120  
* closes #2116 

### Checklist

- [x] I read and understood the [contributing
guide](https://github.com/CodeEditApp/CodeEdit/blob/main/CONTRIBUTING.md)
as well as the [code of
conduct](https://github.com/CodeEditApp/CodeEdit/blob/main/CODE_OF_CONDUCT.md)
- [x] The issues this PR addresses are related to each other
- [x] My changes generate no new warnings
- [x] My code builds and runs on my machine
- [x] My changes are all related to the related issue above
- [x] I documented my code

### Screenshots

<img width="513" height="258" alt="Screenshot 2025-09-11 at 1 43 36 PM"
src="https://github.com/user-attachments/assets/f36f379d-e020-40cf-93f2-2a4456f84a5c"
/>

**File**: `CodeEdit.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +2/-2)
```diff
@@ -294,8 +294,8 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/CodeEditApp/WelcomeWindow",
       "state" : {
-        "revision" : "5168cf1ce9579b35ad00706fafef441418d8011f",
-        "version" : "1.0.0"
+        "revision" : "cbd5c0d6f432449e2a8618e2b24e4691acbfcc98",
+        "version" : "1.1.0"
       }
     },
     {
```

**File**: `CodeEdit/Features/SourceControl/Clone/GitCloneView.swift` (modified, +27/-27)
```diff
@@ -28,13 +28,12 @@ struct GitCloneView: View {
 
     var body: some View {
         VStack(spacing: 8) {
-            HStack {
+            HStack(alignment: .top) {
                 Image(nsImage: NSApp.applicationIconImage)
                     .resizable()
                     .frame(width: 64, height: 64)
-                    .padding(.bottom, 50)
                 VStack(alignment: .leading) {
-                    Text("Clone a repository")
+                    Text("Clone a Repository")
                         .bold()
                         .padding(.bottom, 2)
                     Text("Enter a git repository URL:")
@@ -46,9 +45,9 @@ struct GitCloneView: View {
                     TextField("Git Repository URL", text: $viewModel.repoUrlStr)
                         .lineLimit(1)
                         .padding(.bottom, 15)
-                        .frame(width: 300)
 
                     HStack {
+                        Spacer()
                         Button("Cancel") {
                             dismiss()
                         }
@@ -58,11 +57,8 @@ struct GitCloneView: View {
                         .keyboardShortcut(.defaultAction)
                         .disabled(!viewModel.isValidUrl(url: viewModel.repoUrlStr))
                     }
-                    .offset(x: 185)
-                    .alignmentGuide(.leading) { context in
-                        context[.leading]
-                    }
                 }
+                .frame(width: 300)
             }
             .padding(.top, 20)
             .padding(.horizontal, 20)
@@ -71,28 +67,32 @@ struct GitCloneView: View {
                 viewModel.checkClipboard()
             }
             .sheet(isPresented: $viewModel.isCloning) {
-                NavigationStack {
-                    VStack {
-                        ProgressView(
-                            viewModel.cloningProgress.state.label,
-                            value: viewModel.cloningProgress.progress,
-                            total: 100
-                        )
-                    }
-                }
-                .toolbar {
-                    ToolbarItem {
-                        Button("Cancel Cloning") {
-                            viewModel.cloningTask?.cancel()
-                            viewModel.cloningTask = nil
-                            viewModel.isCloning = false
-                        }
-                    }
+                cloningSheet
+            }
+        }
+    }
+
+    @ViewBuilder private var cloningSheet: some View {
+        NavigationStack {
+            VStack {
+                ProgressView(
+                    viewModel.cloningProgress.state.label,
+                    value: viewModel.cloningProgress.progress,
+                    total: 100
+                )
+            }
+        }
+        .toolbar {
+            ToolbarItem {
+                Button("Cancel Cloning") {
+                    viewModel.cloningTask?.cancel()
+                    viewModel.cloningTask = nil
+                    viewModel.isCloning = false
                 }
-                .padding()
-                .frame(width: 350)
             }
         }
+        .padding()
+        .frame(width: 350)
     }
 
     func cloneRepository() {
```

**File**: `CodeEdit/Features/SourceControl/Clone/ViewModels/GitCloneViewModel.swift` (modified, +1/-1)
```diff
@@ -184,7 +184,7 @@ class GitCloneViewModel: ObservableObject {
         dialog.prompt = "Clone"
         dialog.nameFieldStringValue = saveName
         dialog.nameFieldLabel = "Clone as"
-        dialog.title = "Clone"
+        dialog.title = "Clone a Repository"
 
         guard dialog.runModal() == NSApplication.ModalResponse.OK,
               let result = dialog.url else {
```

---

### Incident Patch 5: `82d39ccc` (2025-09-04)
**Commit Message**: Improve LSP Install UX (#2101)

### Description

Implements an installing progress view for language servers from the
mason registry.

- Package managers have been reworked to return a list of 'steps' to
execute.
- Created a model for running steps and waiting for confirmation if
required before a step.
- Added UI that observes the running model for executed steps and
output, as well as errors.

### Related Issues

* #1997 

### Checklist

- [x] I read and understood the [contributing
guide](https://github.com/CodeEditApp/CodeEdit/blob/main/CONTRIBUTING.md)
as well as the [code of
conduct](https://github.com/CodeEditApp/CodeEdit/blob/main/CODE_OF_CONDUCT.md)
- [x] The issues this PR addresses are related to each other
- [x] My changes generate no new warnings
- [x] My code builds and runs on my machine
- [x] My changes are all related to the related issue above
- [x] I documented my code

### Screenshots

https://github.com/user-attachments/assets/6f0f8a62-1034-4c15-bebe-8d01fff0019e

**File**: `CodeEdit/Features/ActivityViewer/Notifications/TaskNotificationHandler.swift` (modified, +1/-0)
```diff
@@ -132,6 +132,7 @@ final class TaskNotificationHandler: ObservableObject {
     ///   - toWorkspace: The workspace to restrict the task to. Defaults to `nil`, which is received by all workspaces.
     ///   - action: The action being taken on the task.
     ///   - model: The task contents.
+    @MainActor
     static func postTask(toWorkspace: URL? = nil, action: Action, model: TaskNotificationModel) {
         NotificationCenter.default.post(name: .taskNotification, object: nil, userInfo: [
             "id": model.id,
```

**File**: `CodeEdit/Features/CodeEditUI/Views/ErrorDescriptionLabel.swift` (added, +36/-0)
```diff
@@ -0,0 +1,36 @@
+//
+//  ErrorDescriptionLabel.swift
+//  CodeEdit
+//
+//  Created by Khan Winter on 8/14/25.
+//
+
+import SwiftUI
+
+struct ErrorDescriptionLabel: View {
+    let error: Error
+
+    var body: some View {
+        VStack(alignment: .leading) {
+            if let error = error as? LocalizedError {
+                if let description = error.errorDescription {
+                    Text(description)
+                }
+
+                if let reason = error.failureReason {
+                    Text(reason)
+                }
+
+                if let recoverySuggestion = error.recoverySuggestion {
+                    Text(recoverySuggestion)
+                }
+            } else {
+                Text(error.localizedDescription)
+            }
+        }
+    }
+}
+
+#Preview {
+    ErrorDescriptionLabel(error: CancellationError())
+}
```

**File**: `CodeEdit/Features/LSP/Registry/Errors/PackageManagerError.swift` (added, +46/-0)
```diff
@@ -0,0 +1,46 @@
+//
+//  PackageManagerError.swift
+//  CodeEdit
+//
+//  Created by Abe Malla on 5/12/25.
+//
+
+import Foundation
+
+enum PackageManagerError: Error, LocalizedError {
+    case unknown
+    case packageManagerNotInstalled
+    case initializationFailed(String)
+    case installationFailed(String)
+    case invalidConfiguration
+
+    var errorDescription: String? {
+        switch self {
+        case .unknown:
+            "Unknown error occurred"
+        case .packageManagerNotInstalled:
+            "The required package manager is not installed."
+        case .initializationFailed:
+            "Installation directory initialization failed."
+        case .installationFailed:
+            "Package installation failed."
+        case .invalidConfiguration:
+            "The package registry contained an invalid installation configuration."
+        }
+    }
+
+    var failureReason: String? {
+        switch self {
+        case .unknown:
+            nil
+        case .packageManagerNotInstalled:
+            nil
+        case .initializationFailed(let string):
+            string
+        case .installationFailed(let string):
+            string
+        case .invalidConfiguration:
+            nil
+        }
+    }
+}
```

**File**: `CodeEdit/Features/LSP/Registry/Errors/RegistryManagerError.swift` (added, +47/-0)
```diff
@@ -0,0 +1,47 @@
+//
+//  RegistryManagerError.swift
+//  CodeEdit
+//
+//  Created by Abe Malla on 5/12/25.
+//
+
+import Foundation
+
+enum RegistryManagerError: Error, LocalizedError {
+    case installationRunning
+    case invalidResponse(statusCode: Int)
+    case downloadFailed(url: URL, error: Error)
+    case maxRetriesExceeded(url: URL, lastError: Error)
+    case writeFailed(error: Error)
+    case failedToSaveRegistryCache
+
+    var errorDescription: String? {
+        switch self {
+        case .installationRunning:
+            "A package is already being installed."
+        case .invalidResponse(let statusCode):
+            "Invalid response received: \(statusCode)"
+        case .downloadFailed(let url, _):
+            "Download for \(url) error."
+        case .maxRetriesExceeded(let url, _):
+            "Maximum retries exceeded for url: \(url)"
+        case .writeFailed:
+            "Failed to write to file."
+        case .failedToSaveRegistryCache:
+            "Failed to write to registry cache."
+        }
+    }
+
+    var failureReason: String? {
+        switch self {
+        case .installationRunning, .invalidResponse, .failedToSaveRegistryCache:
+            return nil
+        case .downloadFailed(_, let error), .maxRetriesExceeded(_, let error), .writeFailed(let error):
+            return if let error = error as? LocalizedError {
+                error.errorDescription
+            } else {
+                error.localizedDescription
+            }
+        }
+    }
+}
```

**File**: `CodeEdit/Features/LSP/Registry/InstallationQueueManager.swift` (removed, +0/-185)
```diff
@@ -1,185 +0,0 @@
-//
-//  InstallationQueueManager.swift
-//  CodeEdit
-//
-//  Created by Abe Malla on 3/13/25.
-//
-
-import Foundation
-
-/// A class to manage queued installations of language servers
-final class InstallationQueueManager {
-    static let shared: InstallationQueueManager = .init()
-
-    /// The maximum number of concurrent installations allowed
-    private let maxConcurrentInstallations: Int = 2
-    /// Queue of pending installations
-    private var installationQueue: [(RegistryItem, (Result<Void, Error>) -> Void)] = []
-    /// Currently running installations
-    private var runningInstallations: Set<String> = []
-    /// Installation status dictionary
-    private var installationStatus: [String: PackageInstallationStatus] = [:]
-
-    /// Add a package to the installation queue
-    func queueInstallation(package: RegistryItem, completion: @escaping (Result<Void, Error>) -> Void) {
-        // If we're already at max capacity and this isn't already running, mark as queued
-        if runningInstallations.count >= maxConcurrentInstallations && !runningInstallations.contains(package.name) {
-            installationStatus[package.name] = .queued
-            installationQueue.append((package, completion))
-
-            // Notify UI that package is queued
-            DispatchQueue.main.async {
-                NotificationCenter.default.post(
-                    name: .installationStatusChanged,
-                    object: nil,
-                    userInfo: ["packageName": package.name, "status": PackageInstallationStatus.queued]
-                )
-            }
-        } else {
-            startInstallation(package: package, completion: completion)
-        }
-    }
-
-    /// Starts the actual installation process for a package
-    private func startInstallation(package: RegistryItem, completion: @escaping (Result<Void, Error>) -> Void) {
-        installationStatus[package.name] = .installing
-        runningInstallations.insert(package.name)
-
-        // Notify UI that installation is now in progress
-        DispatchQueue.main.async {
-            NotificationCenter.default.post(
-                name: .installationStatusChanged,
-                object: nil,
-                userInfo: ["packageName": package.name, "status": PackageInstallationStatus.installing]
-            )
-        }
-
-        Task {
-            do {
-                try await RegistryManager.shared.installPackage(package: package)
-
-                // Notify UI that installation is complete
-                installationStatus[package.name] = .installed
-                DispatchQueue.main.async {
-                    NotificationCenter.default.post(
-                        name: .installationStatusChanged,
-                        object: nil,
-                        userInfo: ["packageName": package.name, "status": PackageInstallationStatus.installed]
-                    )
-                    completion(.success(()))
-                }
-            } catch {
-                // Notify UI that installation failed
-                installationStatus[package.name] = .failed(error)
-                DispatchQueue.main.async {
-                    NotificationCenter.default.post(
-                        name: .installationStatusChanged,
-                        object: nil,
-                        userInfo: ["packageName": package.name, "status": PackageInstallationStatus.failed(error)]
-                    )
-                    completion(.failure(error))
-                }
-            }
-
-            runningInstallations.remove(package.name)
-            processNextInstallations()
-        }
-    }
-
-    /// Process next installations from the queue if possible
-    private func processNextInstallations() {
-        while runningInstallations.count < maxConcurrentInstallations && !installationQueue.isEmpty {
-            let (package, completion) = installationQueue.removeFirst()
-            if runningInstallations.contains(package.name) {
-                continue
-            }
-
-            startInstallation(package: package, completion: completion)
-        }
-    }
-
-    /// Cancel an installation if it's in the queue
-    func cancelInstallation(packageName: String) {
-        installationQueue.removeAll { $0.0.name == packageName }
-        installationStatus[packageName] = .cancelled
-        runningInstallations.remove(packageName)
-
-        // Notify UI that installation was cancelled
-        DispatchQueue.main.async {
-            NotificationCenter.default.post(
-                name: .installationStatusChanged,
-                object: nil,
-                userInfo: ["packageName": packageName, "status": PackageInstallationStatus.cancelled]
-            )
-        }
-        processNextInstallations()
-    }
-
-    /// Get the current status of an installation
-    func getInstallationStatus(packageName: String) -> PackageInstallationStatus {
-        return installa
```

**File**: `CodeEdit/Features/LSP/Registry/Model/InstallationMethod.swift` (renamed, +38/-0)
```diff
@@ -50,4 +50,42 @@ enum InstallationMethod: Equatable {
             return nil
         }
     }
+
+    func packageManager(installPath: URL) -> PackageManagerProtocol? {
+        switch packageManagerType {
+        case .npm:
+            return NPMPackageManager(installationDirectory: installPath)
+        case .cargo:
+            return CargoPackageManager(installationDirectory: installPath)
+        case .pip:
+            return PipPackageManager(installationDirectory: installPath)
+        case .golang:
+            return GolangPackageManager(installationDirectory: installPath)
+        case .github, .sourceBuild:
+            return GithubPackageManager(installationDirectory: installPath)
+        case .nuget, .opam, .gem, .composer:
+            // TODO: IMPLEMENT OTHER PACKAGE MANAGERS
+            return nil
+        default:
+            return nil
+        }
+    }
+
+    var installerDescription: String {
+        guard let packageManagerType else { return "Unknown" }
+        switch packageManagerType {
+        case .npm, .cargo, .golang, .pip, .sourceBuild, .github:
+            return packageManagerType.userDescription
+        case .nuget, .opam, .gem, .composer:
+            return "(Unsupported) \(packageManagerType.userDescription)"
+        }
+    }
+
+    var packageDescription: String? {
+        guard let packageName else { return nil }
+        if let version {
+            return "\(packageName)@\(version)"
+        }
+        return packageName
+    }
 }
```

**File**: `CodeEdit/Features/LSP/Registry/Model/PackageManagerType.swift` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+//
+//  PackageManagerType.swift
+//  CodeEdit
+//
+//  Created by Abe Malla on 5/12/25.
+//
+
+/// Package manager types supported by the system
+enum PackageManagerType: String, Codable {
+    /// JavaScript
+    case npm
+    /// Rust
+    case cargo
+    /// Go
+    case golang
+    /// Python
+    case pip
+    /// Ruby
+    case gem
+    /// C#
+    case nuget
+    /// OCaml
+    case opam
+    /// PHP
+    case composer
+    /// Building from source
+    case sourceBuild
+    /// Binary download
+    case github
+
+    var userDescription: String {
+        switch self {
+        case .npm:
+            "NPM"
+        case .cargo:
+            "Cargo"
+        case .golang:
+            "Go"
+        case .pip:
+            "Pip"
+        case .gem:
+            "Gem"
+        case .nuget:
+            "Nuget"
+        case .opam:
+            "Opam"
+        case .composer:
+            "Composer"
+        case .sourceBuild:
+            "Build From Source"
+        case .github:
+            "Download From GitHub"
+        }
+    }
+}
```

**File**: `CodeEdit/Features/LSP/Registry/Model/PackageSource.swift` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+//
+//  PackageSource.swift
+//  CodeEdit
+//
+//  Created by Khan Winter on 8/18/25.
+//
+
+/// Generic package source information that applies to all installation methods.
+/// Takes all the necessary information from `RegistryItem`.
+struct PackageSource: Equatable, Codable {
+    /// The raw source ID string from the registry
+    let sourceId: String
+    /// The type of the package manager
+    let type: PackageManagerType
+    /// Package name
+    let pkgName: String
+    /// The name in the registry.json file. Used for the folder name when saved.
+    let entryName: String
+    /// Package version
+    let version: String
+    /// URL for repository or download link
+    let repositoryUrl: String?
+    /// Git reference type if this is a git based package
+    let gitReference: GitReference?
+    /// Additional possible options
+    var options: [String: String]
+
+    init(
+        sourceId: String,
+        type: PackageManagerType,
+        pkgName: String,
+        entryName: String,
+        version: String,
+        repositoryUrl: String? = nil,
+        gitReference: GitReference? = nil,
+        options: [String: String] = [:]
+    ) {
+        self.sourceId = sourceId
+        self.type = type
+        self.pkgName = pkgName
+        self.entryName = entryName
+        self.version = version
+        self.repositoryUrl = repositoryUrl
+        self.gitReference = gitReference
+        self.options = options
+    }
+
+    enum GitReference: Equatable, Codable {
+        case tag(String)
+        case revision(String)
+    }
+}
```

---

### Incident Patch 6: `bdf21ac0` (2025-09-03)
**Commit Message**: fix(quickopen): prevent crash by providing UndoManagerRegistration (#2124)

Fix crash in Open Quickly preview caused by missing
UndoManagerRegistration.

Root cause: OpenQuicklyPreviewView renders CodeFileView in a separate
view hierarchy without the environment object.
Fix: Provide UndoManagerRegistration for the preview (non-editable) path
so CodeFileView resolves it.
Reproduce: Open Quickly (CMD+SHIFT+O) -> select a text file ->
previously crashed.
Validation: No crash; normal editing unaffected.

**File**: `CodeEdit/Features/OpenQuickly/Views/OpenQuicklyPreviewView.swift` (modified, +3/-0)
```diff
@@ -15,6 +15,8 @@ struct OpenQuicklyPreviewView: View {
     @StateObject var editorInstance: EditorInstance
     @StateObject var document: CodeFileDocument
 
+    @StateObject var undoRegistration: UndoManagerRegistration = UndoManagerRegistration()
+
     init(item: CEWorkspaceFile) {
         self.item = item
         let doc = try? CodeFileDocument(
@@ -29,6 +31,7 @@ struct OpenQuicklyPreviewView: View {
     var body: some View {
         if let utType = document.utType, utType.conforms(to: .text) {
             CodeFileView(editorInstance: editorInstance, codeFile: document, isEditable: false)
+                .environmentObject(undoRegistration)
         } else {
             NonTextFileView(fileDocument: document)
         }
```

---

### Incident Patch 7: `9e4ef8e9` (2025-08-25)
**Commit Message**: Bump Build Number to 47 (#2112)

Automatically bump build number of all targets to 47

Co-authored-by: GitHub Action <[REDACTED_EMAIL]>

**File**: `CodeEdit.xcodeproj/project.pbxproj` (modified, +25/-25)
```diff
@@ -629,7 +629,7 @@
 				CLANG_WARN_UNREACHABLE_CODE = YES;
 				CLANG_WARN__DUPLICATE_METHOD_MATCH = YES;
 				COPY_PHASE_STRIP = NO;
-				CURRENT_PROJECT_VERSION = 46;
+				CURRENT_PROJECT_VERSION = 47;
 				DEAD_CODE_STRIPPING = YES;
 				DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym";
 				ENABLE_NS_ASSERTIONS = NO;
@@ -669,7 +669,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "-";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 46;
+				CURRENT_PROJECT_VERSION = 47;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "\"CodeEdit/Preview Content\"";
 				DEVELOPMENT_TEAM = "";
@@ -706,7 +706,7 @@
 				BUNDLE_LOADER = "$(TEST_HOST)";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 46;
+				CURRENT_PROJECT_VERSION = 47;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_TEAM = "";
 				GENERATE_INFOPLIST_FILE = YES;
@@ -734,7 +734,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "-";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 46;
+				CURRENT_PROJECT_VERSION = 47;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_TEAM = "";
 				GENERATE_INFOPLIST_FILE = YES;
@@ -763,7 +763,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "-";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 46;
+				CURRENT_PROJECT_VERSION = 47;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_TEAM = "";
 				ENABLE_HARDENED_RUNTIME = YES;
@@ -826,7 +826,7 @@
 				CLANG_WARN_UNREACHABLE_CODE = YES;
 				CLANG_WARN__DUPLICATE_METHOD_MATCH = YES;
 				COPY_PHASE_STRIP = NO;
-				CURRENT_PROJECT_VERSION = 46;
+				CURRENT_PROJECT_VERSION = 47;
 				DEAD_CODE_STRIPPING = YES;
 				DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym";
 				ENABLE_NS_ASSERTIONS = NO;
@@ -866,7 +866,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "-";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 46;
+				CURRENT_PROJECT_VERSION = 47;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "\"CodeEdit/Preview Content\"";
 				DEVELOPMENT_TEAM = "";
@@ -903,7 +903,7 @@
 				BUNDLE_LOADER = "$(TEST_HOST)";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 46;
+				CURRENT_PROJECT_VERSION = 47;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_TEAM = "";
 				GENERATE_INFOPLIST_FILE = YES;
@@ -931,7 +931,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "-";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 46;
+				CURRENT_PROJECT_VERSION = 47;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_TEAM = "";
 				GENERATE_INFOPLIST_FILE = YES;
@@ -960,7 +960,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "-";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 46;
+				CURRENT_PROJECT_VERSION = 47;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_TEAM = "";
 				ENABLE_HARDENED_RUNTIME = YES;
@@ -995,7 +995,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "-";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 46;
+				CURRENT_PROJECT_VERSION = 47;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_TEAM = "";
 				ENABLE_HARDENED_RUNTIME = YES;
@@ -1030,7 +1030,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "-";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 46;
+				CURRENT_PROJECT_VERSION = 47;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_TEAM = "";
 				ENABLE_HARDENED_RUNTIME = YES;
@@ -1094,7 +1094,7 @@
 				CLANG_WARN_UNREACHABLE_CODE = YES;
 				CLANG_WARN__DUPLICATE_METHOD_MATCH = YES;
 				COPY_PHASE_STRIP = NO;
-				CURRENT_PROJECT_VERSION = 46;
+				CURRENT_PROJECT_VERSION = 47;
 				DEAD_CODE_STRIPPING = YES;
 				DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym";
 				ENABLE_NS_ASSERTIONS = NO;
@@ -1135,7 +1135,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "-";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 46;
+				CURRENT_PROJECT_VERSION = 47;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "\"CodeEdit/Preview Content\"";
 				DEVELOPMENT_TEAM = "";
@@ -1172,7 +1172,7 @@
 				BUNDLE_LOADER = "$(TEST_HOST)";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 46;
+				CURRENT_PROJECT_VERSION = 47;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_TEAM = "";
 				GENERATE_INFOPLIST_FILE = YES;
@@ -1200,7 +1200,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "-";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 46;
+				CURRENT_PROJECT_VERSION = 47;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_TEAM = "";
 				GENERATE_INFOPLIST_FILE = YES;
@@ -1229,7 +1229,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "-";
 				CODE_SIGN_STYLE 
```

**File**: `CodeEdit/Info.plist` (modified, +1/-1)
```diff
@@ -1275,7 +1275,7 @@
 		</dict>
 	</array>
 	<key>CFBundleVersion</key>
-	<string>46</string>
+	<string>47</string>
 	<key>LSApplicationCategoryType</key>
 	<string>public.app-category.developer-tools</string>
 	<key>NSHumanReadableCopyright</key>
```

**File**: `OpenWithCodeEdit/Info.plist` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@
 	<key>CFBundleShortVersionString</key>
 	<string>0.3.6</string>
 	<key>CFBundleVersion</key>
-	<string>46</string>
+	<string>47</string>
 	<key>LSUIElement</key>
 	<true/>
 	<key>NSExtension</key>
```

---

### Incident Patch 8: `86a08eb9` (2025-08-25)
**Commit Message**: Correctly Handle Language Server Timeout When Quitting (#2110)

### Description

There has been work done to ensure CodeEdit cleans up language servers
correctly on quit, this fixes a few final bugs with that system.

- Changes the `withTimeout` call's `try` to `try?` in the `AppDelegate`
so a thrown timeout error still allows execution to continue.
- Removes an unnecessary `withTimeout` in the language server shutdown
code.
- Ensures `withTimeout` always cancels all child tasks on either an
error or a return value.

### Related Issues

### Checklist

- [x] I read and understood the [contributing
guide](https://github.com/CodeEditApp/CodeEdit/blob/main/CONTRIBUTING.md)
as well as the [code of
conduct](https://github.com/CodeEditApp/CodeEdit/blob/main/CODE_OF_CONDUCT.md)
- [x] The issues this PR addresses are related to each other
- [x] My changes generate no new warnings
- [x] My code builds and runs on my machine
- [x] My changes are all related to the related issue above
- [x] I documented my code

### Screenshots

**File**: `CodeEdit/AppDelegate.swift` (modified, +2/-2)
```diff
@@ -270,8 +270,8 @@ final class AppDelegate: NSObject, NSApplicationDelegate, ObservableObject {
                 TaskNotificationHandler.postTask(action: .create, model: task)
             }
 
-            try await withTimeout(
-                duration: .seconds(5.0),
+            try? await withTimeout(
+                duration: .seconds(2.0),
                 onTimeout: {
                     // Stop-gap measure to ensure we don't hang on CMD-Q
                     await self.lspService.killAllServers()
```

**File**: `CodeEdit/Features/LSP/LanguageServer/LanguageServer.swift` (modified, +1/-3)
```diff
@@ -258,9 +258,7 @@ class LanguageServer<DocumentType: LanguageServerDocument> {
     /// Shuts down the language server and exits it.
     public func shutdown() async throws {
         self.logger.info("Shutting down language server")
-        try await withTimeout(duration: .seconds(1.0)) {
-            try await self.lspInstance.shutdownAndExit()
-        }
+        try await self.lspInstance.shutdownAndExit()
     }
 }
 
```

**File**: `CodeEdit/Utils/withTimeout.swift` (modified, +8/-4)
```diff
@@ -30,7 +30,7 @@ public func withTimeout<R>(
         }
         // Start timeout child task.
         group.addTask {
-            if .now > deadline {
+            if .now < deadline {
                 try await Task.sleep(until: deadline) // sleep until the deadline
             }
             try Task.checkCancellation()
@@ -39,8 +39,12 @@ public func withTimeout<R>(
             throw TimedOutError()
         }
         // First finished child task wins, cancel the other task.
-        let result = try await group.next()!
-        group.cancelAll()
-        return result
+        defer { group.cancelAll() }
+        do {
+            let result = try await group.next()!
+            return result
+        } catch {
+            throw error
+        }
     }
 }
```

---

### Incident Patch 9: `e2814fea` (2025-08-25)
**Commit Message**: Fix Ventura Crash (#2106)

### Description

Fixes a crash on Ventura where we're referencing a symbol that
apparently doesn't exist in libdispatch. Just replaces `.asyncAndWait`
with a call to `.sync` since we're not on the main thread already.

### Related Issues

* closes #2091

### Checklist

- [x] I read and understood the [contributing
guide](https://github.com/CodeEditApp/CodeEdit/blob/main/CONTRIBUTING.md)
as well as the [code of
conduct](https://github.com/CodeEditApp/CodeEdit/blob/main/CODE_OF_CONDUCT.md)
- [x] The issues this PR addresses are related to each other
- [x] My changes generate no new warnings
- [x] My code builds and runs on my machine
- [x] My changes are all related to the related issue above
- [x] I documented my code

### Screenshots

**File**: `CodeEdit/Features/Documents/CodeFileDocument/CodeFileDocument.swift` (modified, +5/-1)
```diff
@@ -259,7 +259,11 @@ final class CodeFileDocument: NSDocument, ObservableObject {
                     // This blocks the presented item thread intentionally. If we don't wait, we'll receive more updates
                     // that the file has changed and we'll end up dispatching multiple reads.
                     // The presented item thread expects this operation to by synchronous anyways.
-                    DispatchQueue.main.asyncAndWait {
+
+                    // https://github.com/CodeEditApp/CodeEdit/issues/2091
+                    // We can't use `.asyncAndWait` on Ventura as it seems the symbol is missing on that platform.
+                    // Could be just for x86 machines.
+                    DispatchQueue.main.sync {
                         try? self.read(from: fileURL, ofType: fileType)
                     }
                 }
```

---

### Incident Patch 10: `9b1d2e7e` (2025-08-25)
**Commit Message**: Fix Build Warnings (#2107)

Fixes some build warnings and clarifies a test.

**File**: `CodeEdit/Features/LSP/Registry/PackageSourceParser/PackageSourceParser.swift` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ enum PackageSourceParser {
             false
         }
 
-        var source = PackageSource(
+        let source = PackageSource(
             sourceId: sourceId,
             type: isSourceBuild ? .sourceBuild : .github,
             pkgName: packageName,
```

**File**: `CodeEditTests/Features/Tasks/TaskManagerTests.swift` (modified, +22/-3)
```diff
@@ -26,9 +26,28 @@ class TaskManagerTests {
         #expect(taskManager.availableTasks == mockWorkspaceSettings.tasks)
     }
 
-    @Test(arguments: [SettingsData.TerminalShell.zsh, SettingsData.TerminalShell.bash])
-    func executeSelectedTask(_ shell: SettingsData.TerminalShell) async throws {
-        Settings.shared.preferences.terminal.shell = shell
+    @Test
+    func executeTaskInZsh() async throws {
+        Settings.shared.preferences.terminal.shell = .zsh
+
+        let task = CETask(name: "Test Task", command: "echo 'Hello World'")
+        mockWorkspaceSettings.tasks.append(task)
+        taskManager.selectedTaskID = task.id
+        taskManager.executeActiveTask()
+
+        await waitForExpectation(timeout: .seconds(10)) {
+            self.taskManager.activeTasks[task.id]?.status == .finished
+        } onTimeout: {
+            Issue.record("Status never changed to finished.")
+        }
+
+        let outputString = try #require(taskManager.activeTasks[task.id]?.output?.getBufferAsString())
+        #expect(outputString.contains("Hello World"))
+    }
+
+    @Test
+    func executeTaskInBash() async throws {
+        Settings.shared.preferences.terminal.shell = .bash
 
         let task = CETask(name: "Test Task", command: "echo 'Hello World'")
         mockWorkspaceSettings.tasks.append(task)
```

**File**: `CodeEditUITests/Features/UtilityArea/TerminalUtility/TerminalUtilityUITests.swift` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ final class TerminalUtilityUITests: XCTestCase {
     }
 
     func testTerminalsInputData() throws {
-        var terminal = utilityArea.textViews["Terminal Emulator"]
+        let terminal = utilityArea.textViews["Terminal Emulator"]
         XCTAssertTrue(terminal.exists)
         terminal.click()
         terminal.typeText("echo hello world")
```

---

### Incident Patch 11: `f6f2b80a` (2025-08-12)
**Commit Message**: Fix Semantic Highlight Out-Of-Range Bug (#2097)

### Description

Fixes a bug with semantic highlights where the returned highlights would be outside of the requested range. This fixes that by clamping all returned ranges to the requested range.

### Related Issues

* N/A

### Checklist

- [x] I read and understood the [contributing guide](https://github.com/CodeEditApp/CodeEdit/blob/main/CONTRIBUTING.md) as well as the [code of conduct](https://github.com/CodeEditApp/CodeEdit/blob/main/CODE_OF_CONDUCT.md)
- [x] The issues this PR addresses are related to each other
- [x] My changes generate no new warnings
- [x] My code builds and runs on my machine
- [x] My changes are all related to the related issue above
- [x] I documented my code

### Screenshots

N/A

**File**: `CodeEdit/Features/LSP/Features/SemanticTokens/SemanticTokenHighlightProvider.swift` (modified, +14/-1)
```diff
@@ -166,7 +166,20 @@ final class SemanticTokenHighlightProvider<
         let rawTokens = storage.getTokensFor(range: lspRange)
         let highlights = tokenMap
             .decode(tokens: rawTokens, using: textView)
-            .filter({ $0.capture != nil || !$0.modifiers.isEmpty })
+            .compactMap { highlightRange -> HighlightRange? in
+                // Filter out empty ranges
+                guard highlightRange.capture != nil || !highlightRange.modifiers.isEmpty,
+                      // Clamp the highlight range to the queried range.
+                      let intersection = highlightRange.range.intersection(range),
+                      intersection.isEmpty == false else {
+                    return nil
+                }
+                return HighlightRange(
+                    range: intersection,
+                    capture: highlightRange.capture,
+                    modifiers: highlightRange.modifiers
+                )
+            }
         completion(.success(highlights))
     }
 }
```

---

### Incident Patch 12: `39b1d395` (2025-08-08)
**Commit Message**: Fix: Terminals Losing Output (#2100)

### Description

Fixes a bug introduced by #2092 where terminals that were not running a process would lose their cached output. Adds automation tests to ensure this is caught in the future!

### Related Issues

* N/A

### Checklist

- [x] I read and understood the [contributing guide](https://github.com/CodeEditApp/CodeEdit/blob/main/CONTRIBUTING.md) as well as the [code of conduct](https://github.com/CodeEditApp/CodeEdit/blob/main/CODE_OF_CONDUCT.md)
- [x] The issues this PR addresses are related to each other
- [x] My changes generate no new warnings
- [x] My code builds and runs on my machine
- [x] My changes are all related to the related issue above
- [x] I documented my code

### Screenshots


https://github.com/user-attachments/assets/dfeb38d7-ef56-4154-97dd-6d8fdbd641af

**File**: `CodeEdit/Features/TerminalEmulator/Model/ShellIntegration.swift` (modified, +5/-6)
```diff
@@ -65,21 +65,21 @@ enum ShellIntegration {
             // Enable injection in our scripts.
             environment.append("\(Variables.ceInjection)=1")
 
-            if let execArgs = shell.execArguments(interactive: interactive, login: useLogin) {
-                args.append(execArgs)
-            }
-
             switch shell {
             case .bash:
                 try bash(&args)
             case .zsh:
-                try zsh(&args, &environment)
+                try zsh(&environment)
             }
 
             if useLogin {
                 environment.append("\(Variables.shellLogin)=1")
             }
 
+            if let execArgs = shell.execArguments(interactive: interactive, login: useLogin) {
+                args.append(execArgs)
+            }
+
             return args
         } catch {
             // catch so we can log this here
@@ -125,7 +125,6 @@ enum ShellIntegration {
     ///   - useLogin: Whether to use a login shell.
     ///   - interactive: Whether to use an interactive shell.
     private static func zsh(
-        _ args: inout [String],
         _ environment: inout [String]
     ) throws {
         // All injection script URLs
```

**File**: `CodeEdit/Features/TerminalEmulator/Views/CETerminalView.swift` (modified, +41/-0)
```diff
@@ -17,6 +17,17 @@ class CETerminalView: TerminalView {
         }
     }
 
+    override open var frame: CGRect {
+        get {
+            super.frame
+        }
+        set {
+            if newValue.size != .zero {
+                super.frame = newValue
+            }
+        }
+    }
+
     @objc
     override open func copy(_ sender: Any) {
         let range = selectedPositions()
@@ -25,4 +36,34 @@ class CETerminalView: TerminalView {
         pasteboard.clearContents()
         pasteboard.setString(text, forType: .string)
     }
+
+    override open func isAccessibilityElement() -> Bool {
+        true
+    }
+
+    override open func isAccessibilityEnabled() -> Bool {
+        true
+    }
+
+    override open func accessibilityLabel() -> String? {
+        "Terminal Emulator"
+    }
+
+    override open func accessibilityRole() -> NSAccessibility.Role? {
+        .textArea
+    }
+
+    override open func accessibilityValue() -> Any? {
+        terminal.getText(
+            start: Position(col: 0, row: 0),
+            end: Position(col: terminal.buffer.x, row: terminal.getTopVisibleRow() + terminal.rows)
+        )
+    }
+
+    override open func accessibilitySelectedText() -> String? {
+        let range = selectedPositions()
+        let text = terminal.getText(start: range.start, end: range.end)
+        return text
+    }
+
 }
```

**File**: `CodeEdit/Features/UtilityArea/TerminalUtility/UtilityAreaTerminalSidebar.swift` (modified, +1/-0)
```diff
@@ -72,6 +72,7 @@ struct UtilityAreaTerminalSidebar: View {
         }
         .accessibilityElement(children: .contain)
         .accessibilityLabel("Terminals")
+        .accessibilityIdentifier("terminalsList")
     }
 }
 
```

**File**: `CodeEdit/Features/UtilityArea/TerminalUtility/UtilityAreaTerminalTab.swift` (modified, +3/-1)
```diff
@@ -46,7 +46,6 @@ struct UtilityAreaTerminalTab: View {
             }
         } icon: {
             Image(systemName: "terminal")
-                .accessibilityHidden(true)
         }
         .contextMenu {
             Button("Rename...") {
@@ -63,5 +62,8 @@ struct UtilityAreaTerminalTab: View {
                 }
             }
         }
+        .accessibilityElement(children: .contain)
+        .accessibilityLabel(terminalTitle.wrappedValue)
+        .accessibilityIdentifier("terminalTab")
     }
 }
```

**File**: `CodeEdit/Features/UtilityArea/TerminalUtility/UtilityAreaTerminalView.swift` (modified, +2/-0)
```diff
@@ -117,6 +117,7 @@ struct UtilityAreaTerminalView: View {
                             )
                             .frame(height: max(0, constrainedHeight - 1))
                             .id(selectedTerminal.id)
+                            .accessibilityIdentifier("terminal")
                         }
                     }
                 } else {
@@ -167,6 +168,7 @@ struct UtilityAreaTerminalView: View {
             }
             utilityAreaViewModel.initializeTerminals(workspaceURL: workspaceURL)
         }
+        .accessibilityIdentifier("terminal-area")
     }
 
     @ViewBuilder var backgroundEffectView: some View {
```

**File**: `CodeEdit/Features/UtilityArea/Views/UtilityAreaView.swift` (modified, +1/-0)
```diff
@@ -20,5 +20,6 @@ struct UtilityAreaView: View {
         )
         .accessibilityElement(children: .contain)
         .accessibilityLabel("Utility Area")
+        .accessibilityIdentifier("UtilityArea")
     }
 }
```

**File**: `CodeEditUITests/Features/UtilityArea/TerminalUtility/TerminalUtilityUITests.swift` (added, +62/-0)
```diff
@@ -0,0 +1,62 @@
+//
+//  TerminalUtilityUITests.swift
+//  CodeEditUITests
+//
+//  Created by Khan Winter on 8/8/25.
+//
+
+import XCTest
+
+final class TerminalUtilityUITests: XCTestCase {
+    var app: XCUIApplication!
+    var window: XCUIElement!
+    var utilityArea: XCUIElement!
+    var path: String!
+
+    override func setUp() async throws {
+        // MainActor required for async compatibility which is required to make this method throwing
+        try await MainActor.run {
+            (app, path) = try App.launchWithTempDir()
+
+            window = Query.getWindow(app)
+            XCTAssertTrue(window.exists, "Window not found")
+            window.toolbars.firstMatch.click()
+
+            utilityArea = Query.Window.getUtilityArea(window)
+            XCTAssertTrue(utilityArea.exists, "Utility Area not found")
+        }
+    }
+
+    func testTerminalsInputData() throws {
+        var terminal = utilityArea.textViews["Terminal Emulator"]
+        XCTAssertTrue(terminal.exists)
+        terminal.click()
+        terminal.typeText("echo hello world")
+        terminal.typeKey(.enter, modifierFlags: [])
+
+        let value = try XCTUnwrap(terminal.value as? String)
+        XCTAssertEqual(value.components(separatedBy: "hello world").count - 1, 2)
+    }
+
+    func testTerminalsKeepData() throws {
+        var terminal = utilityArea.textViews["Terminal Emulator"]
+        XCTAssertTrue(terminal.exists)
+        terminal.click()
+        terminal.typeText("echo hello world")
+        terminal.typeKey(.enter, modifierFlags: [])
+
+        let terminals = utilityArea.descendants(matching: .any).matching(identifier: "terminalsList").element
+        XCTAssertTrue(terminals.exists)
+        terminals.click()
+
+        let terminalRow = terminals.cells.firstMatch
+        XCTAssertTrue(terminalRow.exists)
+        terminalRow.click()
+
+        terminal = utilityArea.textViews["Terminal Emulator"]
+        XCTAssertTrue(terminal.exists)
+
+        let finalValue = try XCTUnwrap(terminal.value as? String)
+        XCTAssertEqual(finalValue.components(separatedBy: "hello world").count - 1, 2)
+    }
+}
```

**File**: `CodeEditUITests/Query.swift` (modified, +4/-0)
```diff
@@ -39,6 +39,10 @@ enum Query {
         static func getTabBar(_ window: XCUIElement) -> XCUIElement {
             return window.descendants(matching: .any).matching(identifier: "TabBar").element
         }
+
+        static func getUtilityArea(_ window: XCUIElement) -> XCUIElement {
+            return window.descendants(matching: .any).matching(identifier: "UtilityArea").element
+        }
     }
 
     enum Navigator {
```

---

### Incident Patch 13: `edc874ee` (2025-07-09)
**Commit Message**: Bump Build Number to 46 (#2083)

bump build number to 46

Co-authored-by: GitHub Action <[REDACTED_EMAIL]>

**File**: `CodeEdit.xcodeproj/project.pbxproj` (modified, +25/-25)
```diff
@@ -614,7 +614,7 @@
 				CLANG_WARN_UNREACHABLE_CODE = YES;
 				CLANG_WARN__DUPLICATE_METHOD_MATCH = YES;
 				COPY_PHASE_STRIP = NO;
-				CURRENT_PROJECT_VERSION = 45;
+				CURRENT_PROJECT_VERSION = 46;
 				DEAD_CODE_STRIPPING = YES;
 				DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym";
 				ENABLE_NS_ASSERTIONS = NO;
@@ -654,7 +654,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "-";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 45;
+				CURRENT_PROJECT_VERSION = 46;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "\"CodeEdit/Preview Content\"";
 				DEVELOPMENT_TEAM = "";
@@ -691,7 +691,7 @@
 				BUNDLE_LOADER = "$(TEST_HOST)";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 45;
+				CURRENT_PROJECT_VERSION = 46;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_TEAM = "";
 				GENERATE_INFOPLIST_FILE = YES;
@@ -719,7 +719,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "-";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 45;
+				CURRENT_PROJECT_VERSION = 46;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_TEAM = "";
 				GENERATE_INFOPLIST_FILE = YES;
@@ -748,7 +748,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "-";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 45;
+				CURRENT_PROJECT_VERSION = 46;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_TEAM = "";
 				ENABLE_HARDENED_RUNTIME = YES;
@@ -811,7 +811,7 @@
 				CLANG_WARN_UNREACHABLE_CODE = YES;
 				CLANG_WARN__DUPLICATE_METHOD_MATCH = YES;
 				COPY_PHASE_STRIP = NO;
-				CURRENT_PROJECT_VERSION = 45;
+				CURRENT_PROJECT_VERSION = 46;
 				DEAD_CODE_STRIPPING = YES;
 				DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym";
 				ENABLE_NS_ASSERTIONS = NO;
@@ -851,7 +851,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "-";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 45;
+				CURRENT_PROJECT_VERSION = 46;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "\"CodeEdit/Preview Content\"";
 				DEVELOPMENT_TEAM = "";
@@ -888,7 +888,7 @@
 				BUNDLE_LOADER = "$(TEST_HOST)";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 45;
+				CURRENT_PROJECT_VERSION = 46;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_TEAM = "";
 				GENERATE_INFOPLIST_FILE = YES;
@@ -916,7 +916,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "-";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 45;
+				CURRENT_PROJECT_VERSION = 46;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_TEAM = "";
 				GENERATE_INFOPLIST_FILE = YES;
@@ -945,7 +945,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "-";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 45;
+				CURRENT_PROJECT_VERSION = 46;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_TEAM = "";
 				ENABLE_HARDENED_RUNTIME = YES;
@@ -980,7 +980,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "-";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 45;
+				CURRENT_PROJECT_VERSION = 46;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_TEAM = "";
 				ENABLE_HARDENED_RUNTIME = YES;
@@ -1015,7 +1015,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "-";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 45;
+				CURRENT_PROJECT_VERSION = 46;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_TEAM = "";
 				ENABLE_HARDENED_RUNTIME = YES;
@@ -1079,7 +1079,7 @@
 				CLANG_WARN_UNREACHABLE_CODE = YES;
 				CLANG_WARN__DUPLICATE_METHOD_MATCH = YES;
 				COPY_PHASE_STRIP = NO;
-				CURRENT_PROJECT_VERSION = 45;
+				CURRENT_PROJECT_VERSION = 46;
 				DEAD_CODE_STRIPPING = YES;
 				DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym";
 				ENABLE_NS_ASSERTIONS = NO;
@@ -1120,7 +1120,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "-";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 45;
+				CURRENT_PROJECT_VERSION = 46;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "\"CodeEdit/Preview Content\"";
 				DEVELOPMENT_TEAM = "";
@@ -1157,7 +1157,7 @@
 				BUNDLE_LOADER = "$(TEST_HOST)";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 45;
+				CURRENT_PROJECT_VERSION = 46;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_TEAM = "";
 				GENERATE_INFOPLIST_FILE = YES;
@@ -1185,7 +1185,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "-";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 45;
+				CURRENT_PROJECT_VERSION = 46;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_TEAM = "";
 				GENERATE_INFOPLIST_FILE = YES;
@@ -1214,7 +1214,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "-";
 				CODE_SIGN_STYLE 
```

**File**: `CodeEdit/Info.plist` (modified, +1/-1)
```diff
@@ -1275,7 +1275,7 @@
 		</dict>
 	</array>
 	<key>CFBundleVersion</key>
-	<string>45</string>
+	<string>46</string>
 	<key>LSApplicationCategoryType</key>
 	<string>public.app-category.developer-tools</string>
 	<key>NSHumanReadableCopyright</key>
```

**File**: `OpenWithCodeEdit/Info.plist` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@
 	<key>CFBundleShortVersionString</key>
 	<string>0.3.5</string>
 	<key>CFBundleVersion</key>
-	<string>45</string>
+	<string>46</string>
 	<key>LSUIElement</key>
 	<true/>
 	<key>NSExtension</key>
```

---

### Incident Patch 14: `422b7bf4` (2025-06-26)
**Commit Message**: Fix Split View Can't Collapse (#2071)

### Description

Fixes an erroneous overridden method causing split views to not be collapsable.

### Related Issues

* closes #2070

### Checklist

- [x] I read and understood the [contributing guide](https://github.com/CodeEditApp/CodeEdit/blob/main/CONTRIBUTING.md) as well as the [code of conduct](https://github.com/CodeEditApp/CodeEdit/blob/main/CODE_OF_CONDUCT.md)
- [x] The issues this PR addresses are related to each other
- [x] My changes generate no new warnings
- [x] My code builds and runs on my machine
- [x] My changes are all related to the related issue above
- [x] I documented my code

### Screenshots

https://github.com/user-attachments/assets/12c3a5c2-bf70-4131-ad37-21adf5fa4e68

**File**: `CodeEdit/Features/SplitView/Views/SplitViewControllerView.swift` (modified, +0/-4)
```diff
@@ -131,10 +131,6 @@ final class SplitViewController: NSSplitViewController {
         }
     }
 
-    override func splitView(_ splitView: NSSplitView, canCollapseSubview subview: NSView) -> Bool {
-        false
-    }
-
     override func splitView(_ splitView: NSSplitView, shouldHideDividerAt dividerIndex: Int) -> Bool {
         // For some reason, AppKit _really_ wants to hide dividers when there's only one item (and no dividers)
         // so we do this check for them.
```

---

### Incident Patch 15: `6619d164` (2025-06-24)
**Commit Message**: Fix Autosave "changed by another application " Spam (#2072)

### Description

Fixes an issue where a file save would not correctly update the `CodeFileDocument`'s metadata when saving. This caused scheduled autosave operations to fail with a false positive 'changed by another application' error.

To fix, I'm allowing `NSDocument` to handle the actual file system operation, rather than writing the data like we were before. I've kept the extra logic in the overridden `save` method to fix broken directories. There's no good reason to move the file saving operation out of `NSDocument`, since that subclass likely handles it better than we do with an atomic data write.

I've also moved autosave scheduling out of UI and into the document class.

### Related Issues

* closes #2033

### Checklist

- [x] I read and understood the [contributing guide](https://github.com/CodeEditApp/CodeEdit/blob/main/CONTRIBUTING.md) as well as the [code of conduct](https://github.com/CodeEditApp/CodeEdit/blob/main/CODE_OF_CONDUCT.md)
- [x] The issues this PR addresses are related to each other
- [x] My changes generate no new warnings
- [x] My code builds and runs on my machine
- [x] My cha

**File**: `CodeEdit/Features/Documents/CodeFileDocument/CodeFileDocument.swift` (modified, +37/-1)
```diff
@@ -94,6 +94,11 @@ final class CodeFileDocument: NSDocument, ObservableObject {
         isDocumentEditedSubject.eraseToAnyPublisher()
     }
 
+    /// A lock that ensures autosave scheduling happens correctly.
+    private var autosaveTimerLock: NSLock = NSLock()
+    /// Timer used to schedule autosave intervals.
+    private var autosaveTimer: Timer?
+
     // MARK: - NSDocument
 
     override static var autosavesInPlace: Bool {
@@ -130,6 +135,8 @@ final class CodeFileDocument: NSDocument, ObservableObject {
         }
     }
 
+    // MARK: - Data
+
     override func data(ofType _: String) throws -> Data {
         guard let sourceEncoding, let data = (content?.string as NSString?)?.data(using: sourceEncoding.nsValue) else {
             Self.logger.error("Failed to encode contents to \(self.sourceEncoding.debugDescription)")
@@ -138,6 +145,8 @@ final class CodeFileDocument: NSDocument, ObservableObject {
         return data
     }
 
+    // MARK: - Read
+
     /// This function is used for decoding files.
     /// It should not throw error as unsupported files can still be opened by QLPreviewView.
     override func read(from data: Data, ofType _: String) throws {
@@ -161,6 +170,8 @@ final class CodeFileDocument: NSDocument, ObservableObject {
         NotificationCenter.default.post(name: Self.didOpenNotification, object: self)
     }
 
+    // MARK: - Autosave
+
     /// Triggered when change occurred
     override func updateChangeCount(_ change: NSDocument.ChangeType) {
         super.updateChangeCount(change)
@@ -183,6 +194,31 @@ final class CodeFileDocument: NSDocument, ObservableObject {
         self.isDocumentEditedSubject.send(self.isDocumentEdited)
     }
 
+    /// If ``hasUnautosavedChanges`` is `true` and an autosave has not already been scheduled, schedules a new autosave.
+    /// If ``hasUnautosavedChanges`` is `false`, cancels any scheduled timers and returns.
+    ///
+    /// All operations are done with the ``autosaveTimerLock`` acquired (including the scheduled autosave) to ensure
+    /// correct timing when scheduling or cancelling timers.
+    override func scheduleAutosaving() {
+        autosaveTimerLock.withLock {
+            if self.hasUnautosavedChanges {
+                guard autosaveTimer == nil else { return }
+                autosaveTimer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: false) { [weak self] timer in
+                    self?.autosaveTimerLock.withLock {
+                        guard timer.isValid else { return }
+                        self?.autosaveTimer = nil
+                        self?.autosave(withDelegate: nil, didAutosave: nil, contextInfo: nil)
+                    }
+                }
+            } else {
+                autosaveTimer?.invalidate()
+                autosaveTimer = nil
+            }
+        }
+    }
+
+    // MARK: - Close
+
     override func close() {
         super.close()
         NotificationCenter.default.post(name: Self.didCloseNotification, object: fileURL)
@@ -199,7 +235,7 @@ final class CodeFileDocument: NSDocument, ObservableObject {
             let directory = fileURL.deletingLastPathComponent()
             try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true, attributes: nil)
 
-            try data(ofType: fileType ?? "").write(to: fileURL, options: .atomic)
+            super.save(sender)
         } catch {
             presentError(error)
         }
```

**File**: `CodeEdit/Features/Editor/Views/CodeFileView.swift` (modified, +0/-14)
```diff
@@ -91,20 +91,6 @@ struct CodeFileView: View {
             }
             .store(in: &cancellables)
 
-        codeFile
-            .contentCoordinator
-            .textUpdatePublisher
-            .debounce(for: 1.0, scheduler: DispatchQueue.main)
-            .sink { _ in
-                // updateChangeCount is automatically managed by autosave(), so no manual call is necessary
-                codeFile.autosave(withImplicitCancellability: false) { error in
-                    if let error {
-                        CodeFileDocument.logger.error("Failed to autosave document, error: \(error)")
-                    }
-                }
-            }
-            .store(in: &cancellables)
-
         codeFile.undoManager = self.undoManager.manager
     }
 
```

#### Recent Merged Pull Requests:
- **PR #2186** (closed): Add ⌘K Clear to Start for the integrated terminal (@Borisserz)
- **PR #2170** (closed): test ci (@lwcrafts)
- **PR #2169** (closed): Fix: Pass autocompleteBraces setting to source editor (@william-laverty)
- **PR #2167** (closed): fix: Status bar cursor position not updating on workspace open (@william-laverty)
- **PR #2166** (closed): fix: Auto-select name for editing when creating new files/folders (@william-laverty)
- **PR #2165** (closed): feat: Add ⇧⌘T shortcut to reopen recently closed tabs (@william-laverty)
- **PR #2163** (closed): feat: Add ⇧⌘T shortcut to reopen closed tabs (@william-laverty)
- **PR #2162** (closed): Auto-select name for editing when creating new files/folders (@william-laverty)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
