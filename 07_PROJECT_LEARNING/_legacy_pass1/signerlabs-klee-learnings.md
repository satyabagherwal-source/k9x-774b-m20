# Forensic Learning Record (Deep Inspection): signerlabs/Klee

> **Canonical Artifact**: `07_PROJECT_LEARNING/signerlabs-klee-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/signerlabs/Klee](https://github.com/signerlabs/Klee))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:54:14.943Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `signerlabs/Klee`
- **Description**: A native macOS AI chat app powered by MLX. 100% local inference on Apple Silicon, no cloud required. Built with ShipSwift.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1765 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Klee/Model/AppState.swift`
```
//
//  AppState.swift
//  Klee
//
//  State enums and data models.
//  Phase 1 refactor: removed process management types, added MLX inference layer models.
//

import Foundation

// MARK: - LLM State

/// Runtime state of the LLM inference engine
enum LLMState: Equatable {
    case idle           // No model loaded
    case loading        // Loading model (downloading/reading cache)
    case ready          // Model loaded, awaiting input
    case generating     // Streaming generation in progress
    case error(String)  // An error occurred

    var label: String {
        switch self {
        case .idle:             return "Not Loaded"
        case .loading:          return "Loading..."
        case .ready:            return "Ready"
        case .generating:       return "Generating..."
        case .error(let msg):   return "Error: \(msg)"
        }
    }

    var isReady: Bool {
        self == .ready || self == .generating
    }
}

// MARK: - Model Info

/// Describes an available MLX model
struct ModelInfo: Identifiable, Equatable, Hashable {
    /// HuggingFace model ID (e.g., "mlx-community/Qwen3.5-9B-4bit")
    let id: String
    /// User-friendly display name
    let name: String
    /// Estimated model file size (e.g., "~2.5 GB")
    let size: String
    /// Minimum system RAM (GB) required to run this model
    let minRAM: Int
    /// Estimated download size in bytes (used for progress calculation)
    let expectedBytes: Int64
    /// Whether this model supports vision (image/video) input
    let supportsVision: Bool

    init(id: String, name: String, size: String, minRAM: Int, expectedBytes: Int64, supportsVision: Bool = false) {
        self.id = id
        self.name = name
        self.size = size
        self.minRAM = minRAM
        self.expectedBytes = expectedBytes
        self.supportsVision = supportsVision
    }

    /// Label describing the RAM requirement
    var ramLabel: String {
        "Requires \(minRAM)GB+ RAM"
    }
}

// MARK: - Chat Message

/// A single message in the conversation
struct ChatMessage: Identifiable, Equatable, Codable {
    let id: UUID
    let role: Role
    var content: String
    let timestamp: Date
    /// File URLs of attached images (stored as strings for Codable compatibility)
    var imageURLs: [String]

    enum Role: String, Equatable, Codable {
        case user
        case assistant
        case system
    }

    init(role: Role, content: String, imageURLs: [String] = []) {
        self.id = UUID()
        self.role = role
        self.content = content
        self.timestamp = Date()
        self.imageURLs = imageURLs
    }

    /// Custom decoder for backward compatibility with existing JSON files that lack imageURLs
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        role = try container.decode(Role.self, forKey: .role)
        content = try container.decode(String.self, forKey: .content)
        timestamp = try container.decode(Date.self, forKey: .timestamp)
        imageURLs = try container.decodeIfPresent([String].self, forKey: .imageURLs) ?? []
    }
}


```

### Core Architecture Module: `Klee/Model/DownloadState.swift`
```
//
//  DownloadState.swift
//  Klee
//
//  Data types for model download state tracking: status, progress, and HF file entries.
//

import Foundation

// MARK: - Download Status

/// Download status for a single model
enum DownloadStatus: Equatable, Sendable {
    case idle
    case downloading
    case paused
    case completed
    case failed(String)
    case cancelling

    nonisolated static func == (lhs: Self, rhs: Self) -> Bool {
        switch (lhs, rhs) {
        case (.idle, .idle), (.downloading, .downloading), (.paused, .paused),
             (.completed, .completed), (.cancelling, .cancelling): return true
        case (.failed(let a), .failed(let b)): return a == b
        default: return false
        }
    }
}

// MARK: - Download Progress

/// Download progress snapshot (for UI display)
struct DownloadProgress: Sendable {
    /// Fraction completed 0.0 ~ 1.0
    var fractionCompleted: Double = 0
    /// Number of completed files
    var completedFiles: Int64 = 0
    /// Total number of files
    var totalFiles: Int64 = 0
    /// Current download speed (bytes/sec), nil if unknown
    var speed: Double? = nil

    /// Formatted speed string
    var speedLabel: String {
        guard let speed, speed > 0 else { return "" }
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return "\(formatter.string(fromByteCount: Int64(speed)))/s"
    }

    /// Formatted progress percentage
    var percentLabel: String {
        "\(Int(fractionCompleted * 100))%"
    }
}

// MARK: - HF API File Entry

/// A file entry returned by the HuggingFace API tree endpoint
struct HFFileEntry: Decodable {
    let type: String      // "file" or "directory"
    let path: String      // e.g. "config.json", "model-00001-of-00002.safetensors"
    let size: Int64?      // file size in bytes (nil for directories)
}

```

### Core Architecture Module: `Klee/Data/RecommendedModels.swift`
```
//
//  RecommendedModels.swift
//  Klee
//
//  Predefined recommended model list, tiered by system RAM.
//  Add or modify models by editing this file only.
//

import Foundation

extension ModelInfo {

    /// Predefined recommended model list (tiered by RAM)
    /// expectedBytes is an estimated download size for progress bar calculation (does not need to be exact)
    static let recommended: [ModelInfo] = [

        // 16GB devices
        ModelInfo(
            id: "mlx-community/Qwen3.5-9B-4bit",
            name: "Qwen 3.5 9B",
            size: "~6 GB",
            minRAM: 16,
            expectedBytes: 6_000_000_000,
            supportsVision: true
        ),
        ModelInfo(
            id: "mlx-community/Qwen3-8B-4bit",
            name: "Qwen 3 8B",
            size: "~4.3 GB",
            minRAM: 16,
            expectedBytes: 4_300_000_000
        ),
        ModelInfo(
            id: "mlx-community/gemma-3-12b-it-qat-4bit",
            name: "Gemma 3 12B",
            size: "~8 GB",
            minRAM: 16,
            expectedBytes: 8_000_000_000
        ),
        ModelInfo(
            id: "mlx-community/DeepSeek-R1-0528-Qwen3-8B-4bit",
            name: "DeepSeek R1 8B",
            size: "~4.6 GB",
            minRAM: 16,
            expectedBytes: 4_600_000_000
        ),

        // 32GB devices
        ModelInfo(
            id: "mlx-community/Qwen3.5-27B-4bit",
            name: "Qwen 3.5 27B",
            size: "~16 GB",
            minRAM: 32,
            expectedBytes: 16_000_000_000,
            supportsVision: true
        ),
        ModelInfo(
            id: "mlx-community/Qwen3.5-35B-A3B-4bit",
            name: "Qwen 3.5 35B MoE",
            size: "~20 GB",
            minRAM: 32,
            expectedBytes: 20_000_000_000,
            supportsVision: true
        ),

        // 64GB+ devices
        ModelInfo(
            id: "mlx-community/gemma-3-27b-it-qat-4bit",
            name: "Gemma 3 27B",
            size: "~17 GB",
            minRAM: 64,
            expectedBytes: 17_000_000_000
        ),
        ModelInfo(
            id: "mlx-community/DeepSeek-R1-Distill-Qwen-32B-4bit",
            name: "DeepSeek R1 32B",
            size: "~18 GB",
            minRAM: 64,
            expectedBytes: 18_400_000_000
        ),

        // 96GB+ devices
        ModelInfo(
            id: "mlx-community/Qwen3.5-122B-A10B-4bit",
            name: "Qwen 3.5 122B MoE",
            size: "~70 GB",
            minRAM: 96,
            expectedBytes: 70_000_000_000,
            supportsVision: true
        ),
    ]
}

```

### Core Architecture Module: `Klee/Data/ToolDefinitions.swift`
```
//
//  ToolDefinitions.swift
//  Klee
//
//  Native tool calling definitions (OpenAI function calling schema).
//  Passed to mlx-swift-lm via UserInput(chat:tools:).
//  Add new tools here as modules are implemented.
//

import Foundation

/// Registry of all available tool definitions for native tool calling.
enum ToolDefinitions {

    // MARK: - Built-in Tools (always available)

    /// File and shell tools — no module required, always enabled.
    static let builtIn: [[String: any Sendable]] = [
        function(
            name: "file_write",
            description: "Create or overwrite a file at the given path. Parent directories are created automatically.",
            parameters: [
                param("path", "Absolute file path (~ expands to home directory)"),
                param("content", "Content to write to the file"),
            ],
            required: ["path", "content"]
        ),
        function(
            name: "file_read",
            description: "Read the contents of a file. Returns the text content, truncated if too large.",
            parameters: [param("path", "Absolute file path (~ expands to home directory)")],
            required: ["path"]
        ),
        function(
            name: "file_list",
            description: "List files and directories at the given path.",
            parameters: [param("path", "Absolute directory path (~ expands to home directory)")],
            required: ["path"]
        ),
        function(
            name: "file_delete",
            description: "Delete a file or directory at the given path.",
            parameters: [param("path", "Absolute file path (~ expands to home directory)")],
            required: ["path"]
        ),
        function(
            name: "shell_exec",
            description: "Execute a shell command via /bin/zsh. Has a 30-second timeout. Use for system operations, running scripts, or checking system state.",
            parameters: [param("command", "Shell command to execute")],
            required: ["command"]
        ),
    ]

    // MARK: - Web Search Tools (requires web_search module)

    static let webSearch: [[String: any Sendable]] = [
        function(
            name: "web_search",
            description: "Search the web for information. Returns top results with titles, URLs, and content snippets.",
            parameters: [param("query", "Search query string")],
            required: ["query"]
        ),
        function(
            name: "web_fetch",
            description: "Fetch a webpage and extract its content as clean text. Uses Jina Reader for markdown extraction.",
            parameters: [param("url", "Full URL to fetch (e.g. https://example.com)")],
            required: ["url"]
        ),
    ]

    // MARK: - Helpers

    /// Build a function tool spec from simple parameters.
    private static func function(
        name: String,
        description: String,
        parameters: [(String, String)],
        required: [String]
    ) -> [String: any Sendable] {
        var properties: [String: any Sendable] = [:]
        for (pName, pDesc) in parameters {
            properties[pName] = ["type": "string", "description": pDesc] as [String: any Sendable]
        }
        return [
            "type": "function",
            "function": [
                "name": name,
                "description": description,
                "parameters": [
                    "type": "object",
                    "properties": properties,
                    "required": required as [any Sendable],
                ] as [String: any Sendable],
            ] as [String: any Sendable],
        ] as [String: any Sendable]
    }

    private static func param(_ name: String, _ description: String) -> (String, String) {
        (name, description)
    }
}

```

### Core Architecture Module: `Klee/KleeApp.swift`
```
//
//  KleeApp.swift
//  Klee
//
//  App entry point. Injects all service objects via SwiftUI Environment.
//

import SwiftUI

@main
struct KleeApp: App {
    @State private var llmService = LLMService()
    @State private var modelManager = ModelManager()
    @State private var downloadManager = DownloadManager()
    @State private var chatStore = ChatStore()
    @State private var moduleManager = ModuleManager()

    init() {
        // Auto-detect region: use HuggingFace mirror for users in mainland China
        if Locale.current.region?.identifier == "CN" {
            LLMService.huggingFaceMirror = "https://hf-mirror.com"
        }
    }

    var body: some Scene {
        WindowGroup {
            HomeView()
                .environment(llmService)
                .environment(modelManager)
                .environment(downloadManager)
                .environment(chatStore)
                .environment(moduleManager)
        }
        .defaultSize(width: 960, height: 640)
        .commands {
            // Single-window app: remove the default "New Window" command
            CommandGroup(replacing: .newItem) {}
        }
    }
}

```

### Core Architecture Module: `Klee/Model/Conversation.swift`
```
//
//  Conversation.swift
//  Klee
//
//  Data model for a single conversation (chat session).
//  Each conversation is persisted as a separate JSON file.
//

import Foundation

/// A single conversation containing a list of messages
struct Conversation: Identifiable, Codable, Equatable {
    let id: UUID
    var title: String
    var messages: [ChatMessage]
    var inspectorItems: [InspectorItem]
    let createdAt: Date
    var updatedAt: Date

    /// Whether the title is still the default placeholder
    var hasDefaultTitle: Bool {
        title == Conversation.defaultTitle
    }

    static let defaultTitle = "New Task"

    init(id: UUID = UUID(), title: String = Conversation.defaultTitle, messages: [ChatMessage] = [], inspectorItems: [InspectorItem] = [], createdAt: Date = Date(), updatedAt: Date = Date()) {
        self.id = id
        self.title = title
        self.messages = messages
        self.inspectorItems = inspectorItems
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    /// Custom decoder for backward compatibility with existing JSON files that lack inspectorItems
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        title = try container.decode(String.self, forKey: .title)
        messages = try container.decode([ChatMessage].self, forKey: .messages)
        inspectorItems = try container.decodeIfPresent([InspectorItem].self, forKey: .inspectorItems) ?? []
        createdAt = try container.decode(Date.self, forKey: .createdAt)
        updatedAt = try container.decode(Date.self, forKey: .updatedAt)
    }
}

```

### Core Architecture Module: `Klee/Model/GenerationChunk.swift`
```
//
//  GenerationChunk.swift
//  Klee
//
//  A single piece of streaming generation output.
//

@preconcurrency import MLXLMCommon

/// A single piece of generation output — either a text chunk or a tool call.
enum GenerationChunk: Sendable {
    case text(String)
    case toolCall(ToolCall)
}

```

### Core Architecture Module: `Klee/Model/KleeError.swift`
```
//
//  KleeError.swift
//  Klee
//
//  Unified error types for the Klee application.
//  Consolidates model and download errors into a single enum.
//

import Foundation

// MARK: - KleeError

enum KleeError: LocalizedError {

    // MARK: Model Errors

    case modelLoadFailed(String)
    case generationFailed(String)
    case modelNotLoaded
    case insufficientMemory(required: Int, available: Int)

    // MARK: Download Errors

    case downloadFailed(String)

    var errorDescription: String? {
        switch self {
        case .modelLoadFailed(let detail):
            return "Failed to load model: \(detail)"
        case .generationFailed(let detail):
            return "Generation failed: \(detail)"
        case .modelNotLoaded:
            return "No model loaded. Please select and download a model first."
        case .insufficientMemory(let required, let available):
            return "Insufficient memory: this model requires \(required)GB, but only \(available)GB available."
        case .downloadFailed(let detail):
            return "Model download failed: \(detail)"
        }
    }
}

```

### Core Architecture Module: `Klee/Model/KleeModule.swift`
```
//
//  KleeModule.swift
//  Klee
//
//  Data model for a configurable module (web search connectors, platform services, etc.).
//

import Foundation

/// How a module authenticates
enum ModuleAuthType: String, Codable {
    case apiKey   // User provides an API key (e.g., Jina, Notion)
    case login    // User logs in via QR/OAuth (e.g., XiaoHongShu, Douyin)
    case none     // No auth needed
}

struct KleeModule: Identifiable, Codable, Equatable {
    let id: String              // "web_search", "xiaohongshu", "douyin"
    let name: String            // "Web Search", "小红书", "抖音"
    let icon: String            // SF Symbol name
    let authType: ModuleAuthType
    let skillPrompt: String     // Natural language capability description (~120 tokens)
    var isEnabled: Bool
    var apiKey: String?         // For .apiKey auth type
    var isAuthenticated: Bool   // For .login auth type

    /// Whether this module is ready to use
    var isReady: Bool {
        guard isEnabled else { return false }
        switch authType {
        case .apiKey: return apiKey != nil && !apiKey!.isEmpty
        case .login: return isAuthenticated
        case .none: return true
        }
    }

    /// Whether this module's skill should be injected into the system prompt
    var shouldInjectSkill: Bool { isReady }

}

```

### Core Architecture Module: `Klee/Service/ChatStore.swift`
```
//
//  ChatStore.swift
//  Klee
//
//  Manages all conversations: CRUD operations and JSON file persistence.
//  Each conversation is saved as a separate JSON file under Application Support/Klee/chats/.
//

import Foundation
import Observation

@Observable
class ChatStore {

    // MARK: - Observable Properties

    /// All conversations, sorted by updatedAt descending (newest first)
    private(set) var conversations: [Conversation] = []

    /// Currently selected conversation ID
    var selectedConversationId: UUID? {
        didSet {
            // Persist last selected conversation
            if let id = selectedConversationId {
                UserDefaults.standard.set(id.uuidString, forKey: "lastSelectedConversationId")
            }
        }
    }

    /// The currently selected conversation (convenience accessor)
    var currentConversation: Conversation? {
        get {
            conversations.first { $0.id == selectedConversationId }
        }
        set {
            guard let newValue else { return }
            if let idx = conversations.firstIndex(where: { $0.id == newValue.id }) {
                conversations[idx] = newValue
            }
        }
    }

    // MARK: - Private Properties

    private let chatsDirectory: URL
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    // MARK: - Init

    init() {
        // ~/Library/Application Support/Klee/chats/
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        chatsDirectory = appSupport.appendingPathComponent("Klee/chats", isDirectory: true)

        encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]

        decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        // Ensure directory exists
        try? FileManager.default.createDirectory(at: chatsDirectory, withIntermediateDirectories: true)

        // Load existing conversations
        loadAll()

        // Restore last selected conversation
        if let lastId = UserDefaults.standard.string(forKey: "lastSelectedConversationId"),
           let uuid = UUID(uuidString: lastId),
           conversations.contains(where: { $0.id == uuid }) {
            selectedConversationId = uuid
        } else if let first = conversations.first {
            selectedConversationId = first.id
        }
    }

    // MARK: - CRUD

    /// Create a new empty conversation and select it
    @discardableResult
    func createConversation() -> Conversation {
        let conversation = Conversation()
        conversations.insert(conversation, at: 0)
        selectedConversationId = conversation.id
        save(conversation)
        return conversation
    }

    /// Delete a conversation by ID
    func deleteConversation(id: UUID) {
        conversations.removeAll { $0.id == id }

        // Remove file
        let fileURL = chatsDirectory.appendingPathComponent("\(id.uuidString).json")
        try? FileManager.default.removeItem(at: fileURL)

        // If deleted the selected one, select the first available
        if selectedConversationId == id {
            selectedConversationId = conversations.first?.id
        }
    }

    /// Append a message to the given conversation and save
    func appendMessage(_ message: ChatMessage, to conversationId: UUID) {
        guard let idx = conversations.firstIndex(where: { $0.id == conversationId }) else { return }
        conversations[idx].messages.append(message)
        conversations[idx].updatedAt = Date()
        sortConversations()
        save(conversations[idx])
    }

    /// Update a specific message in a conversation (e.g., streaming content update)
    func updateMessage(id messageId: UUID, in conversationId: UUID, content: String) {
        guard let cIdx = conversations.firstIndex(where: { $0.id == conversationId }),
              let mIdx = conversations[cIdx].messages.firstIndex(where: { $0.id == messageId }) else { return }
        conversations[cIdx].messages[mIdx].content = content
    }

    /// Remove a specific message from a conversation
    func removeMessage(id messageId: UUID, from conversationId: UUID) {
        guard let cIdx = conversations.firstIndex(where: { $0.id == conversationId }) else { return }
        conversations[cIdx].messages.removeAll { $0.id == messageId }
    }

    /// Update the title of a conversation
    func updateTitle(_ title: String, for conversationId: UUID) {
        guard let idx = conversations.firstIndex(where: { $0.id == conversationId }) else { return }
        conversations[idx].title = title
        save(conversations[idx])
    }

    /// Remove all empty conversations (no messages + default title), ensuring at least one remains.
    /// Returns the IDs of removed conversations.
    @discardableResult
    func removeEmptyConversations(excluding excludedId: UUID? = nil) -> [UUID] {
        let emptyIds = conversations
            .filter { $0.messages.isEmpty && $0.hasDefaultTitle && $0.id != excludedId }
            .map(\.id)

        for id in emptyIds {
            conversations.removeAll { $0.id == id }
            let fileURL = chatsDirectory.appendingPathComponent("\(id.uuidString).json")
            try? FileManager.default.removeItem(at: fileURL)
        }

        // If we deleted the selected conversation, re-select
        if let selected = selectedConversationId, emptyIds.contains(selected) {
            selectedConversationId = conversations.first?.id
        }

        return emptyIds
    }

    /// Update inspector items for a conversation (in-memory only; call saveConversation to persist)
    func updateInspectorItems(_ items: [InspectorItem], for conversationId: UUID) {
        guard let idx = conversations.firstIndex(where: { $0.id == conversationId }) else { return }
        conversations[idx].inspectorItems = items
    }

    /// Save the current state of a conversation to disk
    func saveConversation(id: UUID) {
        guard let conversation = conversations.first(where: { $0.id == id }) else { return }
        save(conversation)
    }

    // MARK: - Persistence

    /// Save a single conversation to its JSON file
    private func save(_ conversation: Conversation) {
        let fileURL = chatsDirectory.appendingPathComponent("\(conversation.id.uuidString).json")
        do {
            let data = try encoder.encode(conversation)
            try data.write(to: fileURL, options: .atomic)
        } catch {
            print("[ChatStore] Failed to save conversation \(conversation.id): \(error)")
        }
    }

    /// Load all conversations from disk
    private func loadAll() {
        guard let files = try? FileManager.default.contentsOfDirectory(at: chatsDirectory, includingPropertiesForKeys: nil)
            .filter({ $0.pathExtension == "json" }) else {
            return
        }

        var loaded: [Conversation] = []
        for file in files {
            do {
                let data = try Data(contentsOf: file)
                let conversation = try decoder.decode(Conversation.self, from: data)
                loaded.append(conversation)
            } catch {
                print("[ChatStore] Failed to load \(file.lastPathComponent): \(error)")
            }
        }

        // Sort by updatedAt descending
        loaded.sort { $0.updatedAt > $1.updatedAt }
        conversations = loaded
    }

    /// Re-sort conversations by updatedAt descending
    private func sortConversations() {
        conversations.sort { $0.updatedAt > $1.updatedAt }
    }
}

```

### Core Architecture Module: `Klee/Service/DownloadManager.swift`
```
//
//  DownloadManager.swift
//  Klee
//
//  Download orchestrator: coordinates HuggingFaceAPI, FileDownloader, and TokenizerPatcher
//  to download model files and load them into memory.
//
//  Download phase: fetches file list from HF API, then downloads each file with resume support.
//  Load phase: once all files are downloaded, loads the model from the local directory.
//

import Foundation
import Observation
import MLXLLM
@preconcurrency import MLXLMCommon

// MARK: - DownloadManager

@Observable
class DownloadManager {

    // MARK: - Observable Properties

    /// Current download status
    private(set) var status: DownloadStatus = .idle

    /// Download progress
    private(set) var progress: DownloadProgress = .init()

    /// ID of the model being downloaded
    private(set) var downloadingModelId: String?

    // MARK: - Private Properties

    /// Current download+load task (for cancellation)
    private var downloadTask: Task<ModelContainer?, Never>?

    /// File downloader instance (owns the URLSession + delegate)
    private let fileDownloader = FileDownloader()

    // MARK: - Download and Load Model

    /// Download model files and load into memory, returning a ModelContainer
    /// - Parameter id: HuggingFace model ID
    /// - Returns: The loaded ModelContainer, or nil if cancelled or failed
    @discardableResult
    func downloadAndLoad(id: String) async -> ModelContainer? {
        // Don't start a duplicate download for the same model
        if downloadingModelId == id && status == .downloading {
            return nil
        }

        // Cancel any previous task
        cancelCurrentTask()

        // Reset state
        downloadingModelId = id
        status = .downloading
        progress = .init()

        // Wire up progress callback from FileDownloader
        fileDownloader.onProgress = { [weak self] fractionCompleted, speed in
            guard let self, self.status == .downloading else { return }
            self.progress.fractionCompleted = fractionCompleted
            if let speed {
                self.progress.speed = speed
            }
        }

        let task = Task<ModelContainer?, Never> { [weak self] in
            guard let self else { return nil }

            do {
                // Phase 1: Download all required files
                let localDir = self.cacheDirectory(for: id)
                try await self.downloadAllFiles(modelId: id, to: localDir)

                // Check cancellation between phases
                if Task.isCancelled {
                    await MainActor.run { [weak self] in
                        self?.status = .idle
                        self?.downloadingModelId = nil
                    }
                    return nil
                }

                // Phase 2: Load model from local directory
                let configuration = ModelConfiguration(directory: localDir)
                let container = try await loadModelContainer(
                    configuration: configuration
                ) { [weak self] loadProgress in
                    Task { @MainActor [weak self] in
                        guard let self, self.status == .downloading else { return }
                        // During loading phase, show progress as 95-100%
                        let loadFraction = loadProgress.fractionCompleted
                        self.progress.fractionCompleted = 0.95 + loadFraction * 0.05
                    }
                }

                // Check if cancelled
                if Task.isCancelled {
                    await MainActor.run { [weak self] in
                        self?.status = .idle
                        self?.downloadingModelId = nil
                    }
                    return nil
                }

                // Download + load complete
                await MainActor.run { [weak self] in
                    self?.status = .completed
                    self?.progress.fractionCompleted = 1.0
                }

                return container

            } catch {
                if Task.isCancelled {
                    await MainActor.run { [weak self] in
                        self?.status = .idle
                        self?.downloadingModelId = nil
                    }
                } else {
                    await MainActor.run { [weak self] in
                        self?.status = .failed(error.localizedDescription)
                    }
                }
                return nil
            }
        }

        downloadTask = task
        return await task.value
    }

    // MARK: - Cancel Download

    /// Cancel the current download task
    /// .incomplete files are retained; the next download automatically resumes
    func cancel() {
        guard status == .downloading else { return }
        status = .cancelling
        cancelCurrentTask()
        status = .idle
        downloadingModelId = nil
        progress = .init()
    }

    // MARK: - Reset State

    /// Reset to initial state (for cleanup after download completion)
    func reset() {
        cancelCurrentTask()
        status = .idle
        downloadingModelId = nil
        progress = .init()
    }

    // MARK: - Private: File Download Pipeline

    /// Download all required files for a model
    private func downloadAllFiles(modelId: String, to localDir: URL) async throws {
        // Step 1: Fetch file list from HuggingFace API
        let files = try await HuggingFaceAPI.fetchFileList(modelId: modelId)
        let filteredFiles = HuggingFaceAPI.filterFiles(files)

        guard !filteredFiles.isEmpty else {
            throw KleeError.downloadFailed("No downloadable files found for model \(modelId)")
        }

        // Calculate total bytes
        let totalBytes = filteredFiles.reduce(Int64(0)) { $0 + ($1.size ?? 0) }
        let fileCount = Int64(filteredFiles.count)

        await MainActor.run { [weak self] in
            self?.progress.totalFiles = fileCount
            self?.progress.completedFiles = 0
        }

        // Create local directory
        try FileManager.default.createDirectory(at: localDir, withIntermediateDirectories: true)

        // Step 2: Download each file
        var downloadedBytes: Int64 = 0

        for (index, file) in filteredFiles.enumerated() {
            try Task.checkCancellation()

            let fileURL = localDir.appendingPathComponent(file.path)

            // Create subdirectories if needed (for nested paths)
            let parentDir = fileURL.deletingLastPathComponent()
            if parentDir != localDir {
                try FileManager.default.createDirectory(at: parentDir, withIntermediateDirectories: true)
            }

            // Check if file already exists with correct size
            let expectedSize = file.size ?? 0
            if let attrs = try? FileManager.default.attributesOfItem(atPath: fileURL.path),
               let existingSize = attrs[.size] as? Int64,
               existingSize == expectedSize, expectedSize > 0 {
                // File already complete, skip
                downloadedBytes += expectedSize
                let snapshot1 = downloadedBytes
                await MainActor.run { [weak self] in
                    self?.progress.completedFiles = Int64(index + 1)
                    if totalBytes > 0 {
                        self?.progress.fractionCompleted = Double(snapshot1) / Double(totalBytes) * 0.95
                    }
                }
                continue
            }

            // Download the file (with resume support)
            let bytesForFile = try await fileDownloader.downloadFile(
                modelId: modelId,
                remotePath: file.path,
                to: fileURL,
                expectedSize: expectedSize,
                totalBytes: totalBytes,
                previouslyDownloaded: downloadedBytes
            )
            downloadedBytes += bytesForFile

            let snapshot2 = downloadedBytes
            await MainActor.run { [weak self] in
                self?.progress.completedFiles = Int64(index + 1)
                if totalBytes > 0 {
                    self?.progress.fractionCompleted = Double(snapshot2) / Double(totalBytes) * 0.95
                }
            }
        }

        // Step 3: Validate safetensors files are non-empty
        let fm = FileManager.default
        for file in filteredFiles where file.path.hasSuffix(".safetensors") {
            let fileURL = localDir.appendingPathComponent(file.path)
            guard fm.fileExists(atPath: fileURL.path) else {
                throw KleeError.downloadFailed("Missing safetensors file: \(file.path)")
            }
            let attrs = try fm.attributesOfItem(atPath: fileURL.path)
            let size = attrs[.size] as? Int64 ?? 0
            if size == 0 {
                throw KleeError.downloadFailed("Downloaded safetensors file is 0 bytes: \(file.path)")
            }
        }

        // Step 4: Patch tokenizer_config.json if chat_template is missing
        await TokenizerPatcher.patchTokenizerConfigIfNeeded(modelId: modelId, localURL: localDir)
    }

    // MARK: - Helpers

    /// Model cache directory: ~/.klee/models/{org}/{model-name}/
    private func cacheDirectory(for id: String) -> URL {
        FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent(".klee/models/\(id)")
    }

    private func cancelCurrentTask() {
        fileDownloader.cancelActiveTask()
        downloadTask?.cancel()
        downloadTask = nil
    }
}

```

### Core Architecture Module: `Klee/Service/FileDownloader.swift`
```
//
//  FileDownloader.swift
//  Klee
//
//  Single-file HTTP downloader with resume support via URLSessionDownloadDelegate.
//  Manages a dedicated URLSession and reports progress via a callback closure.
//

import Foundation

// MARK: - Download Progress Callback

/// Progress update from the downloader to the orchestrator (DownloadManager).
/// - Parameters:
///   - fractionCompleted: Overall fraction (0.0 ~ 1.0), accounting for all files
///   - speed: Current download speed in bytes/sec, nil if not yet measured
typealias DownloadProgressCallback = @MainActor (_ fractionCompleted: Double, _ speed: Double?) -> Void

// MARK: - DelegateContext

/// Mutable state accessed from URLSessionDownloadDelegate callbacks on background threads.
/// Stored as a `nonisolated let` reference so delegate methods can read/write it
/// without crossing the @MainActor boundary.
final class DelegateContext: @unchecked Sendable {
    nonisolated(unsafe) var continuation: CheckedContinuation<(URL, URLResponse), any Error>?
    nonisolated(unsafe) var stagingDirectory: URL = FileManager.default
        .temporaryDirectory.appendingPathComponent("klee-download-staging")
    nonisolated(unsafe) var speedBytesAccumulator: Int64 = 0
    nonisolated(unsafe) var lastSpeedUpdate: Date = .now
    nonisolated(unsafe) var lastReportedTotalWritten: Int64 = 0
    nonisolated(unsafe) var filePreviouslyDownloaded: Int64 = 0
    nonisolated(unsafe) var fileResumeOffset: Int64 = 0
    nonisolated(unsafe) var fileTotalBytes: Int64 = 0
}

// MARK: - FileDownloader

class FileDownloader: NSObject, URLSessionDownloadDelegate {

    /// Delegate context for background-thread progress tracking
    nonisolated private let ctx = DelegateContext()

    /// Dedicated URLSession with delegate for progress callbacks
    private var downloadSession: URLSession = .shared

    /// Active URLSessionDownloadTask reference (for cancellation)
    private var activeDownloadTask: URLSessionDownloadTask?

    /// Progress callback invoked on MainActor
    var onProgress: DownloadProgressCallback?

    // MARK: - Init

    nonisolated override init() {
        super.init()
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForResource = 3600
        downloadSession = URLSession(configuration: config, delegate: self, delegateQueue: nil)
        try? FileManager.default.createDirectory(at: ctx.stagingDirectory, withIntermediateDirectories: true)
    }

    // MARK: - Cancel

    /// Cancel the currently active download task
    func cancelActiveTask() {
        activeDownloadTask?.cancel()
        activeDownloadTask = nil
    }

    // MARK: - Download Single File

    /// Download a single file with resume support using URLSessionDownloadTask.
    /// Returns the number of bytes this file occupies (resumeOffset + newly downloaded).
    /// - Parameters:
    ///   - modelId: HuggingFace model ID
    ///   - remotePath: Remote file path within the model repo
    ///   - localURL: Destination file URL on disk
    ///   - expectedSize: Expected file size in bytes
    ///   - totalBytes: Total bytes across all files (for progress calculation)
    ///   - previouslyDownloaded: Bytes already downloaded by prior files
    func downloadFile(
        modelId: String,
        remotePath: String,
        to localURL: URL,
        expectedSize: Int64,
        totalBytes: Int64,
        previouslyDownloaded: Int64
    ) async throws -> Int64 {
        let endpoint = HuggingFaceAPI.resolvedEndpoint()
        // URL-encode the path components (but not the slashes)
        let encodedPath = remotePath.split(separator: "/").map {
            $0.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? String($0)
        }.joined(separator: "/")
        let urlString = "\(endpoint)/\(modelId)/resolve/main/\(encodedPath)?download=true"

        guard let url = URL(string: urlString) else {
            throw KleeError.downloadFailed("Invalid download URL for \(remotePath)")
        }

        let incompleteURL = localURL.appendingPathExtension("incomplete")
        let fm = FileManager.default

        // Check for existing incomplete file (for resume)
        var resumeOffset: Int64 = 0
        if fm.fileExists(atPath: incompleteURL.path) {
            let attrs = try fm.attributesOfItem(atPath: incompleteURL.path)
            resumeOffset = attrs[.size] as? Int64 ?? 0
        }

        // If already fully downloaded (complete file exists), return expected size
        if fm.fileExists(atPath: localURL.path) {
            if let attrs = try? fm.attributesOfItem(atPath: localURL.path),
               let size = attrs[.size] as? Int64, size == expectedSize, expectedSize > 0 {
                return expectedSize
            }
            // Existing file has wrong size, re-download
            try? fm.removeItem(at: localURL)
        }

        // Build request with Range header for resume
        var request = URLRequest(url: url)
        request.timeoutInterval = 600
        if resumeOffset > 0 {
            request.setValue("bytes=\(resumeOffset)-", forHTTPHeaderField: "Range")
        }

        // Set up delegate context for progress reporting
        ctx.speedBytesAccumulator = 0
        ctx.lastSpeedUpdate = .now
        ctx.lastReportedTotalWritten = 0
        ctx.filePreviouslyDownloaded = previouslyDownloaded
        ctx.fileResumeOffset = resumeOffset
        ctx.fileTotalBytes = totalBytes

        // Use URLSessionDownloadTask via continuation
        // (delegate moves temp file to staging before system deletes it)
        let (stagedURL, response) = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<(URL, URLResponse), any Error>) in
            self.ctx.continuation = continuation
            let task = self.downloadSession.downloadTask(with: request)
            self.activeDownloadTask = task
            task.resume()
        }

        // Clear active task reference after completion
        activeDownloadTask = nil

        guard let httpResponse = response as? HTTPURLResponse else {
            try? fm.removeItem(at: stagedURL)
            throw KleeError.downloadFailed("Invalid response for \(remotePath)")
        }

        // Handle response codes
        switch httpResponse.statusCode {
        case 200:
            // Full content — server ignored Range or fresh download
            resumeOffset = 0
            try? fm.removeItem(at: incompleteURL)
            try fm.moveItem(at: stagedURL, to: incompleteURL)

        case 206:
            // Partial content — stream-append staged file to .incomplete in chunks
            // (avoid Data(contentsOf:) which loads gigabytes into memory)
            if !fm.fileExists(atPath: incompleteURL.path) {
                fm.createFile(atPath: incompleteURL.path, contents: nil)
            }
            let writeHandle = try FileHandle(forWritingTo: incompleteURL)
            let readHandle = try FileHandle(forReadingFrom: stagedURL)
            do {
                try writeHandle.seekToEnd()
                let chunkSize = 4 * 1024 * 1024 // 4 MB
                while true {
                    let chunk = readHandle.readData(ofLength: chunkSize)
                    if chunk.isEmpty { break }
                    try writeHandle.write(contentsOf: chunk)
                }
                try writeHandle.close()
                try readHandle.close()
            } catch {
                try? writeHandle.close()
                try? readHandle.close()
                throw error
            }
            try? fm.removeItem(at: stagedURL)

        case 416:
            // Range not satisfiable — .incomplete is stale, delete and retry
            try? fm.removeItem(at: incompleteURL)
            try? fm.removeItem(at: stagedURL)
            return try await downloadFile(
                modelId: modelId,
                remotePath: remotePath,
                to: localURL,
                expectedSize: expectedSize,
                totalBytes: totalBytes,
                previouslyDownloaded: previouslyDownloaded
            )

        default:
            try? fm.removeItem(at: stagedURL)
            throw KleeError.downloadFailed("HTTP \(httpResponse.statusCode) downloading \(remotePath)")
        }

        // Validate downloaded size
        let finalAttrs = try fm.attributesOfItem(atPath: incompleteURL.path)
        let bytesWritten = finalAttrs[.size] as? Int64 ?? 0

        if expectedSize > 0 && bytesWritten != expectedSize {
            // Size mismatch — keep .incomplete for future resume attempt
            throw KleeError.downloadFailed(
                "Size mismatch for \(remotePath): expected \(expectedSize), got \(bytesWritten)"
            )
        }

        // Rename .incomplete to final path
        try? fm.removeItem(at: localURL)
        try fm.moveItem(at: incompleteURL, to: localURL)

        return bytesWritten
    }

    // MARK: - URLSessionDownloadDelegate

    /// Progress callback from URLSession — called on background thread
    nonisolated func urlSession(
        _ session: URLSession,
        downloadTask: URLSessionDownloadTask,
        didWriteData bytesWritten: Int64,
        totalBytesWritten: Int64,
        totalBytesExpectedToWrite: Int64
    ) {
        // Calculate speed from delta since last report
        let delta = totalBytesWritten - ctx.lastReportedTotalWritten
        ctx.lastReportedTotalWritten = totalBytesWritten
        ctx.speedBytesAccumulator += delta

        let now = Date.now
        let elapsed = now.timeIntervalSince(ctx.lastSpeedUpdate)

        var currentSpeed: Double? = nil
        if elapsed >= 0.5 {
            currentSpeed = Double(ctx.speedBytesAccumulator) / elapsed
            ctx.speedBytesAccumulator = 0
            ctx.lastSpeedUpdate = now
        }

        // Overall progress = (previous files + resume offset + this file's written) / total
        let overallDownloaded = ctx.filePreviouslyDo
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #34** (2025-10-31): **v2.0**
  *Symptoms*: 

- **Issue #33** (2026-03-09): **feat: optimize output display**
  *Symptoms*: The think tag is not always effective, so the output is divided into three parts: thinking process, text, and code, and the following functions have been added 1. The thinking process is separately placed in the 'think' tag(#22 ) 2. Add a one click copying function to the code 

- **Issue #27** (2025-03-17): **Dev**
  *Symptoms*: 

- **Issue #25** (2025-03-17): **When trying to delete a response, an error appears.**
  *Symptoms*: ## Issue When attempting to delete a response from Klee, an error box pops up, and does not allow the message to be deleted.  ``` Failed method DELETE at URL http://localhost:6190/chat/message/82897021-7c11-477b-b6db-9693836cc9e8. Exception: InvalidRequestError("Can't operate on closed transaction inside context manager. Please complete the context manager before emitting further commands.") ```  This is on Windows 11 with nvidia GPU
  **Post-Mortem & Fix Analysis**:
  > fixed with version 1.5.1

- **Issue #19** (2025-03-14): **chore: update parse.ts**
  *Symptoms*: arbitary -> arbitrary

- **Issue #17** (2025-03-17): **Make klee work offline**
  *Symptoms*: In order to start, Klee needs a working internet connection.  For remote llm services, this makes sense, but for local hosted llm models there is no reason to require a data connection to just use the app.  Do you think it would be possible to make Klee start when network is offline? 
  **Post-Mortem & Fix Analysis**:
  > Starting from version 1.5, KLEE supports fully offline usage.  Upon startup, it checks whether a version update is required. If there is no network connection, KLEE will skip the check and launch directly.  Of course, the first time you download and run KLEE, an internet connection is still required because it needs to download the embedding model, LLMs, and other related dependencies.  However, our goal has always been to ensure that, starting from the second time you open KLEE locally, it can run completely offline.   If your experience does not match my description, please provide more details, appreciated!  
  > @w-zhong Can it be packaged into a single portable zip file to avoid networking altogether?
  > @w-zhong It doesn't work offline though, I m using version 1.5.0 on windows as you can see:  ![Image](https://github.com/user-attachments/assets/dce0d1a6-af64-42bd-bc11-cbc63f0a75bc)  ![Image](https://github.com/user-attachments/assets/f9356691-20e1-4a3b-abe6-28182014db92)  Can we avoid networking altogether as other user mentioned? I totally understand that you want to build a saas model and monetize it, but it is difficult to use something that  "phones home" to some aws server and downloads god-knows-what each time you open Klee. Maybe an optional button that enables or disables automatic updates?   Btw, really neat RAG application, appreciate it and keep up the good work.

- **Issue #15** (2025-03-17): **enhancement: Opt out for update checks at initialization**
  *Symptoms*: The update check step can't be skipped when you don't have internet connection. A simple skip button would be helpful. Also, a button that leads to the model directory.
  **Post-Mortem & Fix Analysis**:
  > fixed with version 1.5.1, auto update will be skipped if no internect connection

- **Issue #12** (2025-03-17): **timeouts and lack of model download**
  *Symptoms*: This seems like a promising project to help non-tech savvy people use local AIs, but it has two major issue at the moment:  - it timeouts wayyy too quickly. Some PCs take time to load the model in memory, and Klee will think the loading failed when it was still on-going, timing out. - it lacks model download, proposing only very small ones and missing popular models such as QWQ or Mistral-Small-3.
  **Post-Mortem & Fix Analysis**:
  > Hello, may I ask what size of model is loaded when the model loads too quickly and times out? We will update the list of downloadable models provided next week.
  > I was testing the new QWQ 32B thinking model that dropped very recently. It takes a little while to load into memory on my end. I tried other software which work fine, but Klee always timeout while loading.
  > fixed with new relase of Ollama and Klee version 1.5.1

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

### Incident Patch 1: `5e0f5b60` (2026-03-12)
**Commit Message**: feat: Enhance MCP server management with built-in connectors and download progress tracking

**File**: `Klee/Model/MCPServerConfig.swift` (modified, +98/-1)
```diff
@@ -16,20 +16,117 @@ struct MCPServerConfig: Identifiable, Codable, Equatable {
     var args: [String]          // Extra CLI arguments
     var env: [String: String]   // Environment variables (API keys, tokens)
     var isEnabled: Bool
+    var isBuiltIn: Bool         // true = official built-in connector, immutable by user
 
     init(
         id: UUID = UUID(),
         name: String = "",
         command: String = "",
         args: [String] = [],
         env: [String: String] = [:],
-        isEnabled: Bool = true
+        isEnabled: Bool = true,
+        isBuiltIn: Bool = false
     ) {
         self.id = id
         self.name = name
         self.command = command
         self.args = args
         self.env = env
         self.isEnabled = isEnabled
+        self.isBuiltIn = isBuiltIn
+    }
+
+    // Handle decoding from older JSON that lacks isBuiltIn field
+    init(from decoder: Decoder) throws {
+        let container = try decoder.container(keyedBy: CodingKeys.self)
+        id = try container.decode(UUID.self, forKey: .id)
+        name = try container.decode(String.self, forKey: .name)
+        command = try container.decode(String.self, forKey: .command)
+        args = try container.decode([String].self, forKey: .args)
+        env = try container.decode([String: String].self, forKey: .env)
+        isEnabled = try container.decode(Bool.self, forKey: .isEnabled)
+        isBuiltIn = try container.decodeIfPresent(Bool.self, forKey: .isBuiltIn) ?? false
+    }
+}
+
+// MARK: - Built-in Connector Definitions
+
+/// Static definitions for official built-in connectors.
+/// These are injected automatically on first launch or app update.
+struct BuiltInConnector {
+    let stableID: String        // Stable identifier (never changes across versions)
+    let name: String
+    let description: String
+    let command: String
+    let args: [String]
+    let icon: String            // SF Symbol name
+
+    /// Deterministic UUID derived from stableID so built-in connectors survive re-injection
+    var id: UUID {
+        UUID(uuidString: stableIDToUUID(stableID)) ?? UUID()
+    }
+
+    /// Convert stable string ID to deterministic UUID v5-style (simple hash approach)
+    private func stableIDToUUID(_ string: String) -> String {
+        // Use a fixed namespace to generate deterministic UUIDs
+        let hashable = "com.signerlabs.klee.builtin.\(string)"
+        var hash = hashable.utf8.reduce(into: [UInt8](repeating: 0, count: 16)) { result, byte in
+            for i in 0..<16 {
+                result[i] = result[i] &+ byte &+ UInt8(i)
+            }
+        }
+        // Set UUID version 5 bits
+        hash[6] = (hash[6] & 0x0F) | 0x50
+        hash[8] = (hash[8] & 0x3F) | 0x80
+
+        let hex = hash.map { String(format: "%02x", $0) }.joined()
+        let idx = hex.startIndex
+        func sub(_ start: Int, _ len: Int) -> String {
+            let s = hex.index(idx, offsetBy: start)
+            let e = hex.index(s, offsetBy: len)
+            return String(hex[s..<e])
+        }
+        return "\(sub(0,8))-\(sub(8,4))-\(sub(12,4))-\(sub(16,4))-\(sub(20,12))"
+    }
+
+    func toConfig(enabled: Bool = true) -> MCPServerConfig {
+        MCPServerConfig(
+            id: id,
+            name: name,
+            command: command,
+            args: args,
+            env: [:],
+            isEnabled: enabled,
+            isBuiltIn: true
+        )
+    }
+
+    /// All official built-in connectors
+    static let all: [BuiltInConnector] = [
+        BuiltInConnector(
+            stableID: "web-browser",
+            name: "Web Browser",
+            description: "Browse and interact with any website",
+            command: "@playwright/mcp",
+            args: [
+                "--user-data-dir",
+                FileManager.default.homeDirectoryForCurrentUser
+                    .appendingPathComponent("Library/Caches/Klee/browser-profile").path
+            ],
+            icon: "globe"
+        ),
+        BuiltInConnector(
+            stableID: "filesystem",
+            name: "Filesystem",
+            description: "Read and write local files",
+            command: "@modelcontextprotocol/server-filesystem",
+            args: ["/Users"],
+            icon: "folder"
+        ),
+    ]
+
+    /// Look up a built-in definition by UUID
+    static func find(by id: UUID) -> BuiltInConnector? {
+        all.first { $0.id == id }
     }
 }
```

**File**: `Klee/Service/MCPServerManager.swift` (modified, +56/-2)
```diff
@@ -29,6 +29,13 @@ class MCPServerManager {
     /// Maps server UUID to its current runtime status
     var serverStatuses: [UUID: MCPServerStatus] = [:]
 
+    /// Download progress for servers that need first-time setup (e.g. Playwright Chromium).
+    /// Value range: 0.0 to 1.0. Nil means no download in progress.
+    var downloadProgress: [UUID: Double] = [:]
+
+    /// Human-readable download status text (e.g. "Downloading Chrome... 45%")
+    var downloadStatusText: [UUID: String] = [:]
+
     // MARK: - Private State
 
     /// Active subprocesses keyed by server ID
@@ -140,13 +147,19 @@ class MCPServerManager {
             self.stdoutPipes[server.id] = stdoutPipe
             self.processes[server.id] = process
 
-            // Log stderr output for debugging
+            // Log stderr output and parse download progress
             let serverId = server.id
             let serverName = server.name
-            stderrPipe.fileHandleForReading.readabilityHandler = { handle in
+            stderrPipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
                 let data = handle.availableData
                 if !data.isEmpty, let text = String(data: data, encoding: .utf8) {
                     print("[MCP:\(serverName)] stderr: \(text)")
+
+                    // Parse Playwright Chromium download progress from stderr.
+                    // Format: "|■■■■■■■■              |  10% of 162.3 MiB"
+                    Task { @MainActor [weak self] in
+                        self?.parseDownloadProgress(text, serverId: serverId)
+                    }
                 }
             }
 
@@ -268,4 +281,45 @@ class MCPServerManager {
         stdoutPipes[id] = nil
     }
 
+    // MARK: - Download Progress Parsing
+
+    /// Parse Playwright's stderr output for Chromium download progress.
+    /// Expected patterns:
+    ///   "Downloading Chrome for Testing 145.0.7632.6 ..."  → sets status text
+    ///   "|■■■■■■■■                |  10% of 162.3 MiB"     → extracts percentage
+    private func parseDownloadProgress(_ text: String, serverId: UUID) {
+        let lines = text.components(separatedBy: .newlines)
+
+        for line in lines {
+            let trimmed = line.trimmingCharacters(in: .whitespaces)
+
+            // Detect download start
+            if trimmed.hasPrefix("Downloading") {
+                downloadStatusText[serverId] = "Setting up browser..."
+                downloadProgress[serverId] = 0.0
+                continue
+            }
+
+            // Parse percentage from progress bar line: "| ... |  45% of 162.3 MiB"
+            if trimmed.contains("%") {
+                if let range = trimmed.range(of: #"(\d+)%"#, options: .regularExpression) {
+                    let match = trimmed[range].dropLast() // remove the '%'
+                    if let percent = Double(match) {
+                        downloadProgress[serverId] = min(percent / 100.0, 1.0)
+                        downloadStatusText[serverId] = "Setting up browser... \(Int(percent))%"
+
+                        // Download complete — clear progress after a short delay
+                        if percent >= 100 {
+                            Task {
+                                try? await Task.sleep(for: .seconds(1))
+                                self.downloadProgress.removeValue(forKey: serverId)
+                                self.downloadStatusText.removeValue(forKey: serverId)
+                            }
+                        }
+                    }
+                }
+            }
+        }
+    }
+
 }
```

**File**: `Klee/Service/MCPServerStore.swift` (modified, +59/-0)
```diff
@@ -17,6 +17,16 @@ class MCPServerStore {
 
     var servers: [MCPServerConfig] = []
 
+    /// Built-in connectors (read-only definition + current enabled state)
+    var builtInServers: [MCPServerConfig] {
+        servers.filter { $0.isBuiltIn }
+    }
+
+    /// Custom (user-installed) connectors
+    var customServers: [MCPServerConfig] {
+        servers.filter { !$0.isBuiltIn }
+    }
+
     // MARK: - Persistence Path
 
     private let fileURL: URL = {
@@ -30,6 +40,7 @@ class MCPServerStore {
 
     init() {
         load()
+        injectBuiltInConnectors()
     }
 
     // MARK: - CRUD
@@ -46,10 +57,58 @@ class MCPServerStore {
     }
 
     func delete(id: UUID) {
+        // Prevent deletion of built-in connectors
+        guard servers.first(where: { $0.id == id })?.isBuiltIn != true else { return }
         servers.removeAll { $0.id == id }
         save()
     }
 
+    /// Toggle only the enabled state of a built-in connector (name/command/args are immutable)
+    func toggleBuiltIn(id: UUID, enabled: Bool) {
+        guard let index = servers.firstIndex(where: { $0.id == id && $0.isBuiltIn }) else { return }
+        servers[index].isEnabled = enabled
+        save()
+    }
+
+    // MARK: - Built-in Injection
+
+    /// Ensure all official built-in connectors exist in the persisted list.
+    /// Only adds missing ones; preserves user's enabled/disabled state for existing ones.
+    private func injectBuiltInConnectors() {
+        let existingIDs = Set(servers.map(\.id))
+        var didChange = false
+
+        // Remove built-in connectors that are no longer in the official list
+        let validBuiltInIDs = Set(BuiltInConnector.all.map(\.id))
+        let staleCount = servers.count
+        servers.removeAll { $0.isBuiltIn && !validBuiltInIDs.contains($0.id) }
+        if servers.count != staleCount { didChange = true }
+
+        for definition in BuiltInConnector.all {
+            if !existingIDs.contains(definition.id) {
+                // Insert built-in connectors at the beginning
+                servers.insert(definition.toConfig(enabled: true), at: 0)
+                didChange = true
+            } else {
+                // Update name/command/args in case the definition changed across app versions,
+                // but preserve the user's enabled/disabled preference
+                if let index = servers.firstIndex(where: { $0.id == definition.id }) {
+                    let wasEnabled = servers[index].isEnabled
+                    var updated = definition.toConfig(enabled: wasEnabled)
+                    updated.env = servers[index].env  // Preserve user-added env vars
+                    if servers[index] != updated {
+                        servers[index] = updated
+                        didChange = true
+                    }
+                }
+            }
+        }
+
+        if didChange {
+            save()
+        }
+    }
+
     // MARK: - Persistence
 
     private func save() {
```

**File**: `Klee/View/HomeView.swift` (modified, +1/-5)
```diff
@@ -140,10 +140,6 @@ struct HomeView: View {
                 Text("This conversation will be permanently deleted.")
             }
 
-            Divider()
-                .padding(.horizontal, 8)
-                .padding(.top, 8)
-
             // Settings menu at bottom
             Menu {
                 Button {
@@ -176,7 +172,7 @@ struct HomeView: View {
                 .contentShape(.rect)
             }
             .menuStyle(.button)
-            .sidebarHoverButton()
+            .sidebarHoverButton(cornerRadius: 20)
         }
     }
 
```

**File**: `Klee/View/MCPServerListView.swift` (modified, +137/-52)
```diff
@@ -2,7 +2,9 @@
 //  MCPServerListView.swift
 //  Klee
 //
-//  Displays configured MCP servers with status indicators, toggle, and delete.
+//  Displays configured MCP servers split into Built-in and Custom sections.
+//  Built-in connectors show toggle only (no edit/delete).
+//  Custom connectors retain full edit/delete capabilities.
 //  Embedded inside SettingsView's Form.
 //
 
@@ -18,70 +20,140 @@ struct MCPServerListView: View {
     @State private var showDeleteConfirm = false
 
     var body: some View {
-        @Bindable var store = store
+        builtInSection
+        customSection
+            .sheet(isPresented: $showAddSheet) {
+                MCPServerEditView(mode: .create) { newServer in
+                    store.add(server: newServer)
+                }
+            }
+            .sheet(item: $editingServer) { server in
+                MCPServerEditView(mode: .edit(server)) { updated in
+                    store.update(server: updated)
+                }
+            }
+            .alert("Delete Server", isPresented: $showDeleteConfirm, presenting: serverToDelete) { server in
+                Button("Delete", role: .destructive) {
+                    manager.stop(id: server.id)
+                    store.delete(id: server.id)
+                }
+                Button("Cancel", role: .cancel) {}
+            } message: { server in
+                Text("Remove \"\(server.name)\" from your MCP servers? This cannot be undone.")
+            }
+    }
 
-        if store.servers.isEmpty {
-            emptyState
-        } else {
-            serverList
-        }
+    // MARK: - Built-in Section
 
-        // Add Server button
-        Button {
-            showAddSheet = true
-        } label: {
-            Label("Add Connector", systemImage: "plus")
-        }
-        .sheet(isPresented: $showAddSheet) {
-            MCPServerEditView(mode: .create) { newServer in
-                store.add(server: newServer)
+    @ViewBuilder
+    private var builtInSection: some View {
+        Section("Built-in") {
+            ForEach(store.builtInServers) { server in
+                builtInRow(server)
             }
         }
-        .sheet(item: $editingServer) { server in
-            MCPServerEditView(mode: .edit(server)) { updated in
-                store.update(server: updated)
+    }
+
+    // MARK: - Custom Section
+
+    @ViewBuilder
+    private var customSection: some View {
+        Section {
+            if store.customServers.isEmpty {
+                customEmptyState
+            } else {
+                ForEach(store.customServers) { server in
+                    customRow(server)
+                }
             }
-        }
-        .alert("Delete Server", isPresented: $showDeleteConfirm, presenting: serverToDelete) { server in
-            Button("Delete", role: .destructive) {
-                manager.stop(id: server.id)
-                store.delete(id: server.id)
+
+            // Add Connector button
+            Button {
+                showAddSheet = true
+            } label: {
+                Label("Add Connector", systemImage: "plus")
             }
-            Button("Cancel", role: .cancel) {}
-        } message: { server in
-            Text("Remove \"\(server.name)\" from your MCP servers? This cannot be undone.")
+        } header: {
+            Text("Custom")
+        } footer: {
+            Text("Connectors let Klee talk to external tools and services — like browsing the web, reading files, or querying databases. Each connector is a small plugin (called an MCP server) that gives the AI new abilities beyond just chatting.")
         }
     }
 
-    // MARK: - Empty State
+    // MARK: - Built-in Row
 
-    private var emptyState: some View {
-        VStack(spacing: 8) {
-            Image(systemName: "server.rack")
-                .font(.title2)
-                .foregroundStyle(.quaternary)
-            Text("No MCP servers configured")
-                .font(.subheadline)
+    private func builtInRow(_ server: MCPServerConfig) -> some View {
+        let status = manager.status(for: server.id)
+        let definition = BuiltInConnector.find(by: server.id)
+        let progress = manager.downloadProgress[server.id]
+        let progressText = manager.downloadStatusText[server.id]
+
+        return HStack(spacing: 10) {
+            // Icon
+            Image(systemName: definition?.icon ?? "puzzlepiece.extension")
                 .foregroundStyle(.secondary)
-            Text("Add one to enable Agent capabilities.")
-                .font(.caption)
-                .foregroundStyle(.tertiary)
-        }
-        .frame(maxWidth: .infinity)
-        .padding(.vertical, 24)
-    }
+                .frame(width: 20)
+
+            // Server info
+            VStack(alignment: .leading, spacing: 2) {
+                Text(server.name)
+                    .fontWeight(.medium)
+
+                // Show download progress or normal description
+   
```

**File**: `Klee/View/SettingsView.swift` (modified, +1/-5)
```diff
@@ -69,11 +69,7 @@ struct SettingsView: View {
 
     @ViewBuilder
     private var connectorsContent: some View {
-        Section {
-            MCPServerListView()
-        } footer: {
-            Text("Connectors let Klee talk to external tools and services — like browsing the web, reading files, or querying databases. Each connector is a small plugin (called an MCP server) that gives the AI new abilities beyond just chatting.")
-        }
+        MCPServerListView()
     }
 
     // MARK: - Models Panel
```

**File**: `README.md` (modified, +16/-1)
```diff
@@ -10,6 +10,8 @@ Klee uses [MLX](https://github.com/ml-explore/mlx-swift) to run large language m
 - **No account or API key required** -- download and start chatting
 - **One-click model download** -- pick a model, Klee handles the rest
 - **Streaming responses** -- tokens appear as they're generated
+- **Connectors (MCP)** -- extend the AI with external tools (web browsing, file access, databases, and more)
+- **Inspector panel** -- see the AI's thinking process and tool usage in real-time
 - **Lightweight** -- native SwiftUI app, no Electron, no Docker, no background services
 
 ## System Requirements
@@ -72,7 +74,20 @@ cd Klee
 open Klee.xcodeproj
 ```
 
-Select the **Klee** scheme, then build and run (Cmd+R). SPM dependencies (mlx-swift-lm) will resolve automatically on first build.
+Select the **Klee** scheme, then build and run (Cmd+R). SPM dependencies (mlx-swift-lm, swift-sdk) will resolve automatically on first build.
+
+## Connectors
+
+Connectors let Klee talk to external tools and services via the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/). Each connector is a small plugin that gives the AI new abilities beyond just chatting.
+
+To add a connector:
+
+1. Open **Settings > Connectors** from the sidebar
+2. Click **Add Server**
+3. Enter the npx command for the MCP server (e.g., `@anthropic-ai/mcp-server-filesystem`)
+4. Enable the connector -- Klee will start it automatically
+
+Klee bundles Node.js so you don't need to install anything separately.
 
 ## License
 
```

---

### Incident Patch 2: `f78cd333` (2026-03-11)
**Commit Message**: Refactor ChatView and HomeView: Remove legacy thinking and tool call rendering, introduce InspectorView for better activity tracking

- Removed ThinkingBlock and ToolCallBubble from ChatView.
- Integrated InspectorView to display thinking processes and tool call history.
- Updated ChatViewModel to manage inspector items and handle tool call statuses.
- Simplified HomeView's status badge to focus on loading and error states.
- Enhanced data handling for tool calls and thinking blocks in ChatViewModel.

**File**: `Klee/Model/Conversation.swift` (modified, +14/-1)
```diff
@@ -13,6 +13,7 @@ struct Conversation: Identifiable, Codable, Equatable {
     let id: UUID
     var title: String
     var messages: [ChatMessage]
+    var inspectorItems: [InspectorItem]
     let createdAt: Date
     var updatedAt: Date
 
@@ -23,11 +24,23 @@ struct Conversation: Identifiable, Codable, Equatable {
 
     static let defaultTitle = "New Task"
 
-    init(id: UUID = UUID(), title: String = Conversation.defaultTitle, messages: [ChatMessage] = [], createdAt: Date = Date(), updatedAt: Date = Date()) {
+    init(id: UUID = UUID(), title: String = Conversation.defaultTitle, messages: [ChatMessage] = [], inspectorItems: [InspectorItem] = [], createdAt: Date = Date(), updatedAt: Date = Date()) {
         self.id = id
         self.title = title
         self.messages = messages
+        self.inspectorItems = inspectorItems
         self.createdAt = createdAt
         self.updatedAt = updatedAt
     }
+
+    /// Custom decoder for backward compatibility with existing JSON files that lack inspectorItems
+    init(from decoder: Decoder) throws {
+        let container = try decoder.container(keyedBy: CodingKeys.self)
+        id = try container.decode(UUID.self, forKey: .id)
+        title = try container.decode(String.self, forKey: .title)
+        messages = try container.decode([ChatMessage].self, forKey: .messages)
+        inspectorItems = try container.decodeIfPresent([InspectorItem].self, forKey: .inspectorItems) ?? []
+        createdAt = try container.decode(Date.self, forKey: .createdAt)
+        updatedAt = try container.decode(Date.self, forKey: .updatedAt)
+    }
 }
```

**File**: `Klee/Service/ChatStore.swift` (modified, +6/-0)
```diff
@@ -153,6 +153,12 @@ class ChatStore {
         return emptyIds
     }
 
+    /// Update inspector items for a conversation (in-memory only; call saveConversation to persist)
+    func updateInspectorItems(_ items: [InspectorItem], for conversationId: UUID) {
+        guard let idx = conversations.firstIndex(where: { $0.id == conversationId }) else { return }
+        conversations[idx].inspectorItems = items
+    }
+
     /// Save the current state of a conversation to disk
     func saveConversation(id: UUID) {
         guard let conversation = conversations.first(where: { $0.id == id }) else { return }
```

**File**: `Klee/Service/LLMService.swift` (modified, +18/-7)
```diff
@@ -12,6 +12,12 @@ import Observation
 import MLXLLM
 @preconcurrency import MLXLMCommon
 
+/// A single piece of generation output — either a text chunk or a tool call.
+enum GenerationChunk: Sendable {
+    case text(String)
+    case toolCall(ToolCall)
+}
+
 @Observable
 class LLMService {
 
@@ -137,10 +143,13 @@ class LLMService {
 
     // MARK: - Streaming Chat
 
-    /// Send chat messages and return a streaming token output
-    /// - Parameter messages: Complete conversation history
-    /// - Returns: Async string stream where each element is a token fragment
-    func chat(messages: [ChatMessage]) -> AsyncStream<String> {
+    /// Send chat messages with optional tool definitions and return a streaming output.
+    /// Each element is either a text chunk or a native tool call detected by the model.
+    /// - Parameters:
+    ///   - messages: Complete conversation history
+    ///   - tools: Optional tool specifications for native tool calling
+    /// - Returns: Async stream of GenerationChunk
+    func chat(messages: [ChatMessage], tools: [[String: any Sendable]]? = nil) -> AsyncStream<GenerationChunk> {
         AsyncStream { continuation in
             generationTask = Task { [weak self] in
                 guard let self, let container = self.modelContainer else {
@@ -161,7 +170,7 @@ class LLMService {
                         }
                     }
 
-                    let userInput = UserInput(chat: chatMessages)
+                    let userInput = UserInput(chat: chatMessages, tools: tools)
 
                     // Prepare input (UserInput -> LMInput)
                     let lmInput = try await container.prepare(input: userInput)
@@ -181,11 +190,13 @@ class LLMService {
                     for await result in generateStream {
                         if Task.isCancelled { break }
 
-                        // result contains the generated text fragment
                         if let text = result.chunk {
-                            continuation.yield(text)
+                            continuation.yield(.text(text))
                             tokenCount += 1
                         }
+                        if let toolCall = result.toolCall {
+                            continuation.yield(.toolCall(toolCall))
+                        }
                     }
 
                     // Calculate tok/s
```

**File**: `Klee/Service/MCPClientManager.swift` (modified, +60/-58)
```diff
@@ -9,6 +9,7 @@
 
 import Foundation
 import MCP
+@preconcurrency import MLXLMCommon
 import Observation
 import System
 
@@ -198,7 +199,7 @@ class MCPClientManager {
     }
 
     /// Convert Tool.Content to a readable string
-    private func contentToString(_ content: Tool.Content) -> String {
+    private func contentToString(_ content: MCP.Tool.Content) -> String {
         switch content {
         case .text(let text):
             return text
@@ -213,74 +214,75 @@ class MCPClientManager {
         }
     }
 
-    // MARK: - System Prompt Generation
+    // MARK: - Native Tool Specs (for MLX Swift tool calling API)
 
-    /// Generate a system prompt fragment describing all available MCP tools.
-    /// Uses a compact format with few-shot example to maximize small model compliance.
-    var toolsSystemPrompt: String {
-        guard !allTools.isEmpty else { return "" }
-
-        var prompt = """
-You are a macOS assistant with full access to the tools listed below. You CAN and SHOULD use them to read, write, edit, move, and delete files when the user asks. Never say you cannot perform an action if a tool exists for it.
-
-To use a tool, output a JSON block inside a markdown code fence labeled "tool":
-
-```tool
-{"name": "TOOL_NAME", "arguments": {"key": "value"}}
-```
+    /// Convert all MCP tools to MLX Swift ToolSpec format for native tool calling.
+    /// ToolSpec is [String: any Sendable] matching OpenAI function calling schema.
+    var toolSpecs: [[String: any Sendable]]? {
+        guard !allTools.isEmpty else { return nil }
 
-Example — user asks "delete notes.txt from desktop", you output:
-
-```tool
-{"name": "write_file", "arguments": {"path": "/Users/m4pro/Desktop/notes.txt", "content": ""}}
-```
+        return allTools.map { tool -> [String: any Sendable] in
+            // Convert MCP Value inputSchema to [String: Any] dictionary
+            var parameters: [String: any Sendable] = ["type": "object"]
+            if let data = try? JSONEncoder().encode(tool.inputSchema),
+               let dict = try? JSONSerialization.jsonObject(with: data) as? [String: any Sendable] {
+                parameters = dict
+            }
 
-Rules:
-- Use tools immediately — do NOT tell the user to do it manually.
-- You have FULL permission to read, write, create, edit, move, and search files within the allowed directories.
-- After receiving a tool result, continue your response naturally.
+            return [
+                "type": "function",
+                "function": [
+                    "name": tool.name,
+                    "description": tool.description ?? "",
+                    "parameters": parameters,
+                ] as [String: any Sendable],
+            ] as [String: any Sendable]
+        }
+    }
 
-Tools:
-"""
+    /// Behavioral system prompt for tool calling (no tool definitions — those go via native API).
+    var toolBehaviorPrompt: String {
+        guard !allTools.isEmpty else { return "" }
+        let home = FileManager.default.homeDirectoryForCurrentUser.path
+        return """
+            You are a macOS assistant with full access to tools. Use tools immediately when they can help — do NOT tell the user to do it manually. You have FULL permission to read, write, create, edit, move, and search files within the allowed directories. After receiving a tool result, continue your response naturally to the user.
 
-        for tool in allTools {
-            prompt += "\n- \(tool.name)"
-            if let description = tool.description {
-                // Truncate long descriptions to keep prompt compact
-                let short = description.count > 100 ? String(description.prefix(100)) + "..." : description
-                prompt += ": \(short)"
-            }
-            // Only show required parameters, not the full JSON schema
-            if let params = extractRequiredParams(from: tool.inputSchema) {
-                prompt += " | params: \(params)"
-            }
-        }
+            The current user's home directory is: \(home)
+            Use absolute paths. For example: Desktop = \(home)/Desktop, Documents = \(home)/Documents.
+            """
+    }
 
-        prompt += "\n"
-        return prompt
+    /// Call a tool by name with arguments from MLX's JSONValue format.
+    /// Used when the native tool calling API returns a ToolCall.
+    func callToolFromNative(name: String, arguments: [String: MLXLMCommon.JSONValue]) async throws -> String {
+        // Convert JSONValue arguments to MCP Value arguments
+        let mcpArgs = try convertJSONValueToMCPValues(arguments)
+        return try await callTool(name: name, arguments: mcpArgs)
     }
 
-    /// Extract a compact parameter summary from a JSON Schema Value.
-    /// Returns something like "path (string, required)" instead of the full schema.
-    private func extractRequiredParams(from schema: Value) -> String? {
-        // Encode to JSON, then decode to dictionary for easier trave
```

**File**: `Klee/View/ChatView.swift` (modified, +22/-267)
```diff
@@ -19,122 +19,6 @@ private extension View {
     }
 }
 
-// MARK: - Thinking Block
-
-/// Renders <think> content in a distinct styled block with secondary styling.
-private struct ThinkingBlock: View {
-    let text: String
-
-    var body: some View {
-        VStack(alignment: .leading, spacing: 4) {
-            HStack(spacing: 4) {
-                Image(systemName: "brain")
-                Text("Thinking")
-            }
-            Text(text)
-        }
-        .font(.callout)
-        .foregroundStyle(.secondary)
-        .padding(8)
-        .frame(maxWidth: .infinity, alignment: .leading)
-        .background(.ultraThinMaterial)
-        .clipShape(RoundedRectangle(cornerRadius: 8))
-    }
-}
-
-// MARK: - Tool Call Bubble
-
-/// Renders an MCP tool call block with status indicator and collapsible detail.
-private struct ToolCallBubble: View {
-    let toolName: String
-    let arguments: String
-    let result: String
-    let status: ToolCallDisplayStatus
-
-    @State private var isExpanded = false
-
-    enum ToolCallDisplayStatus {
-        case calling
-        case completed
-        case failed
-    }
-
-    var body: some View {
-        VStack(alignment: .leading, spacing: 6) {
-            // Header row: icon + tool name + status
-            Button {
-                withAnimation(.easeInOut(duration: 0.2)) {
-                    isExpanded.toggle()
-                }
-            } label: {
-                HStack(spacing: 6) {
-                    statusIcon
-                    Text(toolName)
-                        .fontWeight(.medium)
-                        .fontDesign(.monospaced)
-                    Spacer()
-                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
-                        .imageScale(.small)
-                        .foregroundStyle(.tertiary)
-                }
-            }
-            .buttonStyle(.plain)
-
-            // Collapsible detail section
-            if isExpanded {
-                VStack(alignment: .leading, spacing: 4) {
-                    if !arguments.isEmpty {
-                        Text("Arguments")
-                            .font(.caption2)
-                            .foregroundStyle(.tertiary)
-                            .textCase(.uppercase)
-                        Text(arguments)
-                            .font(.caption)
-                            .fontDesign(.monospaced)
-                            .foregroundStyle(.secondary)
-                            .textSelection(.enabled)
-                    }
-                    if !result.isEmpty {
-                        Divider()
-                        Text(status == .failed ? "Error" : "Result")
-                            .font(.caption2)
-                            .foregroundStyle(.tertiary)
-                            .textCase(.uppercase)
-                        Text(result)
-                            .font(.caption)
-                            .fontDesign(.monospaced)
-                            .foregroundStyle(status == .failed ? .red : .secondary)
-                            .textSelection(.enabled)
-                            .lineLimit(isExpanded ? nil : 3)
-                    }
-                }
-                .padding(.leading, 22)
-            }
-        }
-        .font(.callout)
-        .padding(8)
-        .frame(maxWidth: .infinity, alignment: .leading)
-        .background(.ultraThinMaterial)
-        .clipShape(RoundedRectangle(cornerRadius: 8))
-    }
-
-    @ViewBuilder
-    private var statusIcon: some View {
-        switch status {
-        case .calling:
-            ProgressView()
-                .controlSize(.small)
-                .frame(width: 16, height: 16)
-        case .completed:
-            Image(systemName: "checkmark.circle.fill")
-                .foregroundStyle(.green)
-        case .failed:
-            Image(systemName: "xmark.circle.fill")
-                .foregroundStyle(.red)
-        }
-    }
-}
-
 // MARK: - ChatView
 
 struct ChatView: View {
@@ -144,6 +28,7 @@ struct ChatView: View {
     @Environment(MCPClientManager.self) var mcpClientManager
     @Environment(\.openSettings) private var openSettings
     @State private var viewModel = ChatViewModel()
+    @State private var showInspector = false
     @FocusState private var isInputFocused: Bool
 
     /// Whether the user has no downloaded models at all
@@ -166,14 +51,26 @@ struct ChatView: View {
                 errorBanner(message: errorMessage)
             }
             messageList
-            // Active tool call status indicator
-            if let toolCall = viewModel.currentToolCall {
-                activeToolCallBar(toolCall)
-            }
             Divider()
             inputBar
         }
         .frame(minWidth: 400, minHeight: 300)
+        .inspector(isPresented: $showInspector) {
+            InspectorView(items: viewModel.inspectorItems)
+                .inspectorColumnWidth(min: 250, 
```

**File**: `Klee/View/HomeView.swift` (modified, +14/-40)
```diff
@@ -154,53 +154,27 @@ struct HomeView: View {
         }
     }
 
-    // MARK: - Status Badge (model name + state)
+    // MARK: - Status Badge (minimal: only loading spinner or error dot)
 
+    @ViewBuilder
     private var statusBadge: some View {
-        HStack(spacing: 6) {
-            // Model name
-            if let modelId = llmService.currentModelId {
-                let shortName = modelId.components(separatedBy: "/").last ?? modelId
-                Text(shortName)
-                    .font(.caption)
-                    .foregroundStyle(.secondary)
-            }
-
-            // Generation speed
-            if llmService.state == .generating, llmService.tokensPerSecond > 0 {
-                Text(String(format: "%.1f tok/s", llmService.tokensPerSecond))
+        switch llmService.state {
+        case .loading:
+            HStack(spacing: 6) {
+                ProgressView()
+                    .controlSize(.small)
+                Text("Loading…")
                     .font(.caption)
                     .foregroundStyle(.secondary)
-                    .monospacedDigit()
             }
-
-            // Status dot + label
+        case .error:
             Circle()
-                .fill(statusColor)
+                .fill(.red)
                 .frame(width: 8, height: 8)
-            Text(statusLabel)
-                .font(.caption)
-                .foregroundStyle(.secondary)
-        }
-    }
-
-    private var statusColor: Color {
-        switch llmService.state {
-        case .ready:        return .green
-        case .generating:   return .green
-        case .loading:      return .orange
-        case .error:        return .red
-        case .idle:         return .gray
-        }
-    }
-
-    private var statusLabel: String {
-        switch llmService.state {
-        case .ready:        return "Ready"
-        case .generating:   return "Generating"
-        case .loading:      return "Loading..."
-        case .error:        return "Error"
-        case .idle:         return "Not Loaded"
+                .help("Model error — see chat for details")
+        default:
+            // Ready / Generating / Idle — keep toolbar clean
+            EmptyView()
         }
     }
 }
```

**File**: `Klee/View/InspectorView.swift` (added, +206/-0)
```diff
@@ -0,0 +1,206 @@
+//
+//  InspectorView.swift
+//  Klee
+//
+//  Right-side inspector panel showing thinking processes and tool call history
+//  for the current conversation. Displayed via .inspector() modifier on ChatView.
+//
+
+import SwiftUI
+
+struct InspectorView: View {
+    let items: [InspectorItem]
+
+    var body: some View {
+        Group {
+            if items.isEmpty {
+                ContentUnavailableView(
+                    "No Activity Yet",
+                    systemImage: "text.magnifyingglass",
+                    description: Text("Thinking processes and tool calls will appear here.")
+                )
+            } else {
+                itemList
+                    .padding(.vertical, 30)
+            }
+        }
+    }
+
+    // MARK: - Item List
+
+    private var itemList: some View {
+        ScrollViewReader { proxy in
+            List {
+                ForEach(items) { item in
+                    InspectorItemRow(item: item)
+                        .id(item.id)
+                        .listRowSeparator(.hidden)
+                        .listRowBackground(Color.clear)
+                        .listRowInsets(EdgeInsets(top: 4, leading: 12, bottom: 4, trailing: 12))
+                }
+
+                // Invisible bottom anchor for reliable scrolling
+                Color.clear
+                    .frame(height: 1)
+                    .listRowSeparator(.hidden)
+                    .listRowBackground(Color.clear)
+                    .listRowInsets(EdgeInsets())
+                    .id("inspector-bottom")
+            }
+            .listStyle(.plain)
+            .scrollContentBackground(.hidden)
+            .onChange(of: items) {
+                // Fires on count AND content changes (InspectorItem is Equatable)
+                withAnimation(.easeOut(duration: 0.15)) {
+                    proxy.scrollTo("inspector-bottom", anchor: .bottom)
+                }
+            }
+        }
+    }
+}
+
+// MARK: - Inspector Item Row
+
+private struct InspectorItemRow: View {
+    let item: InspectorItem
+    @State private var isExpanded = true
+
+    var body: some View {
+        VStack(alignment: .leading, spacing: 4) {
+            // Header: toggle button
+            Button {
+                withAnimation(.easeInOut(duration: 0.2)) {
+                    isExpanded.toggle()
+                }
+            } label: {
+                HStack(spacing: 6) {
+                    itemIcon
+                    itemLabel
+                        .font(.callout)
+                        .fontWeight(.medium)
+                    Spacer()
+                    // Timestamp
+                    Text(item.timestamp, format: .dateTime.hour().minute().second())
+                        .font(.caption2)
+                        .foregroundStyle(.tertiary)
+                        .monospacedDigit()
+                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
+                        .imageScale(.small)
+                        .foregroundStyle(.tertiary)
+                }
+            }
+            .buttonStyle(.plain)
+
+            // Expandable content
+            if isExpanded {
+                itemDetail
+                    .padding(.leading, 22)
+            }
+        }
+        .padding(8)
+        .background(.ultraThinMaterial)
+        .clipShape(RoundedRectangle(cornerRadius: 8))
+    }
+
+    // MARK: - Icon
+
+    @ViewBuilder
+    private var itemIcon: some View {
+        switch item.content {
+        case .thinking:
+            Image(systemName: "brain")
+                .foregroundStyle(.purple)
+        case .toolCall(_, _, let status):
+            switch status {
+            case .calling:
+                ProgressView()
+                    .controlSize(.small)
+                    .frame(width: 16, height: 16)
+            case .completed:
+                Image(systemName: "checkmark.circle.fill")
+                    .foregroundStyle(.green)
+            case .failed:
+                Image(systemName: "xmark.circle.fill")
+                    .foregroundStyle(.red)
+            }
+        }
+    }
+
+    // MARK: - Label
+
+    @ViewBuilder
+    private var itemLabel: some View {
+        switch item.content {
+        case .thinking:
+            Text("Thinking")
+                .foregroundStyle(.secondary)
+        case .toolCall(let name, _, _):
+            Text(name)
+                .fontDesign(.monospaced)
+                .foregroundStyle(.primary)
+        }
+    }
+
+    // MARK: - Detail Content
+
+    @ViewBuilder
+    private var itemDetail: some View {
+        switch item.content {
+        case .thinking(let text):
+            Text(text)
+                .font(.caption)
+                .foregroundStyle(.secondary)
+                .textSelection(.enabled)
+
+        case .toolCall(_, let arguments, let status):
+            VStack(alignment: .leading, spacing: 4) {
+                if !argument
```

**File**: `Klee/ViewModel/ChatViewModel.swift` (modified, +205/-194)
```diff
@@ -8,9 +8,35 @@
 //
 
 import Foundation
-import MCP
+@preconcurrency import MLXLMCommon
 import Observation
 
+// MARK: - Inspector Item
+
+/// Represents a single entry in the Inspector panel (thinking block or tool call)
+struct InspectorItem: Identifiable, Codable, Equatable {
+    let id: UUID
+    let timestamp: Date
+    var content: Content
+
+    enum Content: Codable, Equatable {
+        case thinking(String)
+        case toolCall(name: String, arguments: String, status: ToolCallStatus)
+    }
+
+    enum ToolCallStatus: Codable, Equatable {
+        case calling
+        case completed(result: String)
+        case failed(error: String)
+    }
+
+    init(timestamp: Date, content: Content) {
+        self.id = UUID()
+        self.timestamp = timestamp
+        self.content = content
+    }
+}
+
 @Observable
 @MainActor
 class ChatViewModel {
@@ -32,6 +58,17 @@ class ChatViewModel {
     /// Current active tool call (nil when no tool is being invoked)
     var currentToolCall: ToolCallState?
 
+    /// All thinking and tool call events for the current conversation, shown in Inspector
+    var inspectorItems: [InspectorItem] = []
+
+    // MARK: - Private Streaming State
+
+    /// Index of the currently streaming thinking item in inspectorItems (nil when not inside a <think> block)
+    private var streamingThinkingIndex: Int?
+
+    /// Whether the current round's think block has been finalized (prevents duplicate processing)
+    private var thinkBlockFinalized = false
+
     // MARK: - Dependencies (injected after init)
 
     var llmService: LLMService?
@@ -83,18 +120,12 @@ class ChatViewModel {
         isStreaming = true
 
         Task {
-            // Determine if we have MCP tools available
             let hasMCPTools = mcpClientManager?.hasTools == true
-            print("[ChatVM] 🚀 Start | hasMCPTools=\(hasMCPTools) | toolCount=\(mcpClientManager?.allTools.count ?? 0)")
+            let toolSpecs = hasMCPTools ? mcpClientManager?.toolSpecs : nil
+            print("[ChatVM] 🚀 Start | hasMCPTools=\(hasMCPTools) | toolCount=\(mcpClientManager?.allTools.count ?? 0) | nativeTools=\(toolSpecs?.count ?? 0)")
 
-            // Build the initial message history (excluding the empty placeholder)
+            // Build the initial message history
             var history = buildHistory(hasMCPTools: hasMCPTools)
-            print("[ChatVM] 📋 History: \(history.count) messages | systemPrompt length=\(history.first(where: { $0.role == .system })?.content.count ?? 0)")
-            // Debug: print each message role and content preview
-            for (i, msg) in history.enumerated() {
-                let preview = String(msg.content.prefix(200))
-                print("[ChatVM] 📋 msg[\(i)] role=\(msg.role.rawValue) | length=\(msg.content.count) | preview: \(preview)")
-            }
 
             // Accumulates the final displayed text across all rounds
             var displayText = ""
@@ -103,85 +134,109 @@ class ChatViewModel {
             // Main inference loop: stream -> check for tool_call -> re-run if needed
             while toolCallRound < maxToolCallRounds {
                 print("[ChatVM] 🔄 Round \(toolCallRound) | Starting LLM inference...")
-                let stream = llm.chat(messages: history)
+                let stream = llm.chat(messages: history, tools: toolSpecs)
 
                 var accumulated = ""
+                var detectedToolCall: ToolCall?
                 var tokenCount = 0
-                for await token in stream {
-                    accumulated += token
-                    tokenCount += 1
-                    // Show the raw streaming output (including tool_call tags) in real time
-                    store.updateMessage(id: assistantID, in: convId, content: displayText + accumulated)
-                }
-                print("[ChatVM] ✅ Streaming done | tokens=\(tokenCount) | length=\(accumulated.count)")
-                print("[ChatVM] 📝 Raw output START >>>")
-                // Print full output in chunks to avoid console truncation
-                let rawOutput = accumulated
-                let chunkSize = 500
-                var offset = rawOutput.startIndex
-                while offset < rawOutput.endIndex {
-                    let end = rawOutput.index(offset, offsetBy: chunkSize, limitedBy: rawOutput.endIndex) ?? rawOutput.endIndex
-                    print(String(rawOutput[offset..<end]))
-                    offset = end
+                streamingThinkingIndex = nil
+                thinkBlockFinalized = false
+
+                for await chunk in stream {
+                    switch chunk {
+                    case .text(let token):
+                        accumulated += token
+                        tokenCount += 1
+                        // Update Inspector with real-time thinking
+                        updateInspectorStreaming(accumulated: accumulated)
+                        // Show only clean text in ChatView (
```

---

### Incident Patch 3: `7e84ccf9` (2026-03-11)
**Commit Message**: feat: Implement MCP server management with CRUD operations and UI integration

- Add MCPServerStore for persisting server configurations to disk.
- Create MCPServerEditView for adding and editing server configurations.
- Develop MCPServerListView to display and manage configured servers.
- Integrate MCP server management into SettingsView.
- Enhance ChatView to handle tool calls with status indicators.
- Update ChatViewModel to manage tool call execution and state.
- Introduce new parsing logic for tool call content in assistant messages.

**File**: `Klee.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +64/-1)
```diff
@@ -1,6 +1,15 @@
 {
-  "originHash" : "facc0ac7c70363ea20f6cd1235de91dea6b06f0d00190946045a6c8ae753abc2",
+  "originHash" : "9fbab2483ad8caeed5a48637a7770f10e28f6d34370cc775b1f25afd34b61e3e",
   "pins" : [
+    {
+      "identity" : "eventsource",
+      "kind" : "remoteSourceControl",
+      "location" : "https://github.com/mattt/eventsource.git",
+      "state" : {
+        "revision" : "a3a85a85214caf642abaa96ae664e4c772a59f6e",
+        "version" : "1.4.1"
+      }
+    },
     {
       "identity" : "mlx-swift",
       "kind" : "remoteSourceControl",
@@ -28,6 +37,24 @@
         "version" : "1.5.1"
       }
     },
+    {
+      "identity" : "swift-async-algorithms",
+      "kind" : "remoteSourceControl",
+      "location" : "https://github.com/apple/swift-async-algorithms.git",
+      "state" : {
+        "revision" : "9d349bcc328ac3c31ce40e746b5882742a0d1272",
+        "version" : "1.1.3"
+      }
+    },
+    {
+      "identity" : "swift-atomics",
+      "kind" : "remoteSourceControl",
+      "location" : "https://github.com/apple/swift-atomics.git",
+      "state" : {
+        "revision" : "b601256eab081c0f92f059e12818ac1d4f178ff7",
+        "version" : "1.3.0"
+      }
+    },
     {
       "identity" : "swift-collections",
       "kind" : "remoteSourceControl",
@@ -55,6 +82,24 @@
         "version" : "2.3.2"
       }
     },
+    {
+      "identity" : "swift-log",
+      "kind" : "remoteSourceControl",
+      "location" : "https://github.com/apple/swift-log.git",
+      "state" : {
+        "revision" : "bbd81b6725ae874c69e9b8c8804d462356b55523",
+        "version" : "1.10.1"
+      }
+    },
+    {
+      "identity" : "swift-nio",
+      "kind" : "remoteSourceControl",
+      "location" : "https://github.com/apple/swift-nio.git",
+      "state" : {
+        "revision" : "e932d3c4d8f77433c8f7093b5ebcbf91463948a0",
+        "version" : "2.95.0"
+      }
+    },
     {
       "identity" : "swift-numerics",
       "kind" : "remoteSourceControl",
@@ -64,6 +109,24 @@
         "version" : "1.1.1"
       }
     },
+    {
+      "identity" : "swift-sdk",
+      "kind" : "remoteSourceControl",
+      "location" : "https://github.com/modelcontextprotocol/swift-sdk",
+      "state" : {
+        "revision" : "6112a3995a992d159ad0e82c2d62a008ce932666",
+        "version" : "0.11.0"
+      }
+    },
+    {
+      "identity" : "swift-system",
+      "kind" : "remoteSourceControl",
+      "location" : "https://github.com/apple/swift-system.git",
+      "state" : {
+        "revision" : "7c6ad0fc39d0763e0b699210e4124afd5041c5df",
+        "version" : "1.6.4"
+      }
+    },
     {
       "identity" : "swift-transformers",
       "kind" : "remoteSourceControl",
```

**File**: `Klee/Data/RecommendedModels.swift` (modified, +1/-24)
```diff
@@ -14,30 +14,7 @@ extension ModelInfo {
     /// expectedBytes is an estimated download size for progress bar calculation (does not need to be exact)
     static let recommended: [ModelInfo] = [
 
-        // 8GB devices
-        ModelInfo(
-            id: "mlx-community/gemma-3-4b-it-qat-4bit",
-            name: "Gemma 3 4B",
-            size: "~3 GB",
-            minRAM: 8,
-            expectedBytes: 3_000_000_000
-        ),
-        ModelInfo(
-            id: "mlx-community/Qwen3-4B-4bit",
-            name: "Qwen3 4B",
-            size: "~2.5 GB",
-            minRAM: 8,
-            expectedBytes: 2_500_000_000
-        ),
-        ModelInfo(
-            id: "mlx-community/Phi-4-mini-instruct-4bit",
-            name: "Phi 4 Mini",
-            size: "~2.2 GB",
-            minRAM: 8,
-            expectedBytes: 2_200_000_000
-        ),
-
-        // 16GB devices
+        // 16GB devices (minimum for MCP tool calling)
         ModelInfo(
             id: "mlx-community/Qwen3-8B-4bit",
             name: "Qwen3 8B",
```

**File**: `Klee/Klee.entitlements` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+<?xml version="1.0" encoding="UTF-8"?>
+<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
+<plist version="1.0">
+<dict>
+<key>com.apple.security.cs.allow-jit</key>
+	<true/>
+	<key>com.apple.security.cs.allow-unsigned-executable-memory</key>
+	<true/>
+	<key>com.apple.security.cs.disable-library-validation</key>
+	<true/>
+</dict>
+</plist>
```

**File**: `Klee/KleeApp.swift` (modified, +34/-1)
```diff
@@ -2,7 +2,7 @@
 //  KleeApp.swift
 //  Klee
 //
-//  App entry point. Injects LLMService, ModelManager, DownloadManager, and ChatStore as environment objects.
+//  App entry point. Injects all service objects via SwiftUI Environment.
 //
 
 import SwiftUI
@@ -13,6 +13,9 @@ struct KleeApp: App {
     @State private var modelManager = ModelManager()
     @State private var downloadManager = DownloadManager()
     @State private var chatStore = ChatStore()
+    @State private var mcpServerStore = MCPServerStore()
+    @State private var mcpServerManager = MCPServerManager()
+    @State private var mcpClientManager = MCPClientManager()
 
     init() {
         // HuggingFace mirror acceleration (uncomment for users in China)
@@ -26,11 +29,41 @@ struct KleeApp: App {
                 .environment(modelManager)
                 .environment(downloadManager)
                 .environment(chatStore)
+                .environment(mcpServerStore)
+                .environment(mcpServerManager)
+                .environment(mcpClientManager)
+                // Auto-connect enabled MCP servers on app launch
+                .task {
+                    await autoConnectEnabledServers()
+                }
+                // Stop all MCP server subprocesses on app termination to prevent orphans
+                .onReceive(NotificationCenter.default.publisher(for: NSApplication.willTerminateNotification)) { _ in
+                    mcpServerManager.stopAll()
+                }
         }
         .defaultSize(width: 960, height: 640)
         .commands {
             // Single-window app: remove the default "New Window" command
             CommandGroup(replacing: .newItem) {}
         }
     }
+
+    // MARK: - Auto-Connect
+
+    /// Start and connect all enabled MCP servers at app launch
+    private func autoConnectEnabledServers() async {
+        let enabledServers = mcpServerStore.servers.filter { $0.isEnabled }
+        guard !enabledServers.isEmpty else { return }
+
+        for server in enabledServers {
+            await mcpServerManager.start(server: server)
+
+            // Only connect if the server started successfully
+            if mcpServerManager.status(for: server.id) == .running,
+               let stdinPipe = mcpServerManager.stdinPipe(for: server.id),
+               let stdoutPipe = mcpServerManager.stdoutPipe(for: server.id) {
+                await mcpClientManager.connect(server: server, stdinPipe: stdinPipe, stdoutPipe: stdoutPipe)
+            }
+        }
+    }
 }
```

**File**: `Klee/Model/MCPServerConfig.swift` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+//
+//  MCPServerConfig.swift
+//  Klee
+//
+//  Configuration for an MCP (Model Context Protocol) server.
+//  Persisted via MCPServerStore.
+//
+
+import Foundation
+
+/// Represents a single MCP server configuration
+struct MCPServerConfig: Identifiable, Codable, Equatable {
+    var id: UUID
+    var name: String            // Display name, e.g. "Playwright Browser"
+    var command: String         // npx command target, e.g. "@playwright/mcp"
+    var args: [String]          // Extra CLI arguments
+    var env: [String: String]   // Environment variables (API keys, tokens)
+    var isEnabled: Bool
+
+    init(
+        id: UUID = UUID(),
+        name: String = "",
+        command: String = "",
+        args: [String] = [],
+        env: [String: String] = [:],
+        isEnabled: Bool = true
+    ) {
+        self.id = id
+        self.name = name
+        self.command = command
+        self.args = args
+        self.env = env
+        self.isEnabled = isEnabled
+    }
+}
```

**File**: `Klee/Service/MCPClientManager.swift` (added, +316/-0)
```diff
@@ -0,0 +1,316 @@
+//
+//  MCPClientManager.swift
+//  Klee
+//
+//  Wraps the MCP Swift SDK Client layer.
+//  Manages connections to running MCP servers, discovers tools,
+//  executes tool calls, and generates system prompts for the LLM.
+//
+
+import Foundation
+import MCP
+import Observation
+import System
+
+// MARK: - MCPTool
+
+/// A tool discovered from an MCP server, enriched with server identity
+struct MCPTool: Identifiable, Sendable {
+    /// Unique identifier (serverName + toolName)
+    var id: String { "\(serverId.uuidString):\(name)" }
+    /// The server this tool belongs to
+    let serverId: UUID
+    /// Display name of the server
+    let serverName: String
+    /// Tool name (used for callTool)
+    let name: String
+    /// Human-readable tool description
+    let description: String?
+    /// JSON Schema for the tool's input parameters
+    let inputSchema: Value
+}
+
+// MARK: - MCPClientManager
+
+@Observable
+@MainActor
+class MCPClientManager {
+
+    // MARK: - Observable State
+
+    /// All tools aggregated from all connected servers
+    private(set) var allTools: [MCPTool] = []
+
+    /// Connection errors per server
+    private(set) var connectionErrors: [UUID: String] = [:]
+
+    // MARK: - Private State
+
+    /// Active MCP Client connections keyed by server ID
+    private var clients: [UUID: Client] = [:]
+
+    /// Active transports keyed by server ID (kept alive to prevent deallocation)
+    private var transports: [UUID: StdioTransport] = [:]
+
+    /// Server names for tool attribution
+    private var serverNames: [UUID: String] = [:]
+
+    // MARK: - Connect
+
+    /// Connect to an MCP server using its subprocess stdio pipes.
+    /// - Parameters:
+    ///   - server: The server configuration
+    ///   - stdinPipe: The pipe connected to the child process's stdin
+    ///   - stdoutPipe: The pipe connected to the child process's stdout
+    func connect(server: MCPServerConfig, stdinPipe: Pipe, stdoutPipe: Pipe) async {
+        // Disconnect any existing connection first
+        await disconnect(id: server.id)
+
+        do {
+            // Create StdioTransport using the child process's file descriptors.
+            // From the MCP client's perspective:
+            //   - input = child's stdout (we read from it)
+            //   - output = child's stdin (we write to it)
+            let readFD = FileDescriptor(rawValue: stdoutPipe.fileHandleForReading.fileDescriptor)
+            let writeFD = FileDescriptor(rawValue: stdinPipe.fileHandleForWriting.fileDescriptor)
+
+            let transport = StdioTransport(
+                input: readFD,
+                output: writeFD
+            )
+
+            let client = Client(
+                name: "Klee",
+                version: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
+            )
+
+            // Initialize the MCP connection (handshake)
+            try await client.connect(transport: transport)
+
+            // Store references
+            self.clients[server.id] = client
+            self.transports[server.id] = transport
+            self.serverNames[server.id] = server.name
+            self.connectionErrors[server.id] = nil
+
+            print("[MCPClientManager] Connected to '\(server.name)'")
+
+            // Discover tools after connection
+            await refreshTools(for: server.id)
+
+        } catch {
+            connectionErrors[server.id] = error.localizedDescription
+            print("[MCPClientManager] Failed to connect to '\(server.name)': \(error)")
+        }
+    }
+
+    // MARK: - Disconnect
+
+    /// Disconnect from a specific MCP server
+    func disconnect(id: UUID) async {
+        if let transport = transports[id] {
+            await transport.disconnect()
+        }
+        clients[id] = nil
+        transports[id] = nil
+        serverNames[id] = nil
+        connectionErrors[id] = nil
+
+        // Remove tools belonging to this server
+        allTools.removeAll { $0.serverId == id }
+    }
+
+    /// Disconnect from all servers
+    func disconnectAll() async {
+        let ids = Array(clients.keys)
+        for id in ids {
+            await disconnect(id: id)
+        }
+    }
+
+    // MARK: - Tool Discovery
+
+    /// Refresh tools from all connected servers
+    func refreshAllTools() async {
+        for id in clients.keys {
+            await refreshTools(for: id)
+        }
+    }
+
+    /// Refresh tools from a specific server
+    private func refreshTools(for serverId: UUID) async {
+        guard let client = clients[serverId],
+              let serverName = serverNames[serverId] else { return }
+
+        do {
+            let result = try await client.listTools()
+            let tools = result.tools
+
+            // Remove old tools for this server
+            allTools.removeAll { $0.serverId == serverId }
+
+            // Add new tools
+            let mcpTools = tools.map { tool in
+          
```

**File**: `Klee/Service/MCPServerManager.swift` (added, +271/-0)
```diff
@@ -0,0 +1,271 @@
+//
+//  MCPServerManager.swift
+//  Klee
+//
+//  Manages the runtime lifecycle of MCP Server subprocesses.
+//  Each server runs as a Node.js child process (via bundled Node.js + npx).
+//  Lifecycle: KleeApp calls stopAll() on willTerminateNotification.
+//  Injected as @Environment(MCPServerManager.self) throughout the app.
+//
+
+import Foundation
+import Observation
+
+@Observable
+@MainActor
+class MCPServerManager {
+
+    // MARK: - Server Status
+
+    enum MCPServerStatus: Equatable {
+        case stopped
+        case starting
+        case running
+        case error(String)
+    }
+
+    // MARK: - Observable State
+
+    /// Maps server UUID to its current runtime status
+    var serverStatuses: [UUID: MCPServerStatus] = [:]
+
+    // MARK: - Private State
+
+    /// Active subprocesses keyed by server ID
+    private var processes: [UUID: Process] = [:]
+
+    /// Stdout pipes for reading child process output (used by MCPClientManager for StdioTransport)
+    private var stdoutPipes: [UUID: Pipe] = [:]
+
+    /// Stdin pipes for writing to child process input (used by MCPClientManager for StdioTransport)
+    private var stdinPipes: [UUID: Pipe] = [:]
+
+    // MARK: - Node.js Path
+
+    /// Resolve the bundled Node.js binary path.
+    /// Looks for node binary inside the app bundle's Resources/node/ directory.
+    private var bundledNodePath: String? {
+        if let resourcePath = Bundle.main.resourcePath {
+            let nodePath = (resourcePath as NSString).appendingPathComponent("node/bin/node")
+            if FileManager.default.isExecutableFile(atPath: nodePath) {
+                return nodePath
+            }
+        }
+        // Fallback: check common system paths
+        let systemPaths = [
+            "/usr/local/bin/node",
+            "/opt/homebrew/bin/node",
+            "/usr/bin/node"
+        ]
+        for path in systemPaths {
+            if FileManager.default.isExecutableFile(atPath: path) {
+                return path
+            }
+        }
+        return nil
+    }
+
+    /// Resolve npx-cli.js path (avoids symlink dereference issues with cp -L).
+    /// Runs as: node /path/to/npx-cli.js -y <package>
+    private func npxCliPath(nodePath: String) -> String? {
+        let binDir = (nodePath as NSString).deletingLastPathComponent
+        let nodeRoot = (binDir as NSString).deletingLastPathComponent
+        let candidates = [
+            "\(nodeRoot)/lib/node_modules/npm/bin/npx-cli.js",
+            "\(nodeRoot)/lib/node_modules/npm/bin/npm-cli.js",  // fallback
+        ]
+        for path in candidates {
+            if FileManager.default.fileExists(atPath: path) {
+                return candidates[0]  // always prefer npx-cli.js
+            }
+        }
+        return nil
+    }
+
+    // MARK: - Start Server
+
+    /// Launch an MCP Server subprocess
+    func start(server: MCPServerConfig) async {
+        // Prevent duplicate launches
+        if let existing = processes[server.id], existing.isRunning {
+            serverStatuses[server.id] = .running
+            return
+        }
+
+        serverStatuses[server.id] = .starting
+
+        guard let nodePath = bundledNodePath else {
+            serverStatuses[server.id] = .error("Node.js not found. Please bundle Node.js in the app.")
+            return
+        }
+
+        guard let npxCli = npxCliPath(nodePath: nodePath) else {
+            serverStatuses[server.id] = .error("npx-cli.js not found in bundled Node.js.")
+            return
+        }
+
+        do {
+            let process = Process()
+            // Run: node /path/to/npx-cli.js -y <command> <args...>
+            process.executableURL = URL(fileURLWithPath: nodePath)
+
+            var arguments = [npxCli, "-y", server.command]
+            arguments.append(contentsOf: server.args)
+            process.arguments = arguments
+
+            // Environment: inherit parent PATH + merge server-specific env vars
+            var environment = ProcessInfo.processInfo.environment
+            for (key, value) in server.env {
+                environment[key] = value
+            }
+            // Ensure the node binary directory is in PATH
+            let nodeDir = (nodePath as NSString).deletingLastPathComponent
+            if let existingPath = environment["PATH"] {
+                environment["PATH"] = "\(nodeDir):\(existingPath)"
+            } else {
+                environment["PATH"] = nodeDir
+            }
+            process.environment = environment
+
+            // Stdio pipes for MCP protocol communication
+            let stdinPipe = Pipe()
+            let stdoutPipe = Pipe()
+            let stderrPipe = Pipe()
+            process.standardInput = stdinPipe
+            process.standardOutput = stdoutPipe
+            process.standardError = stderrPipe
+
+            // Store references before launching
+            self.stdinPipes[server.id] = stdinPipe
+            self.stdoutPip
```

**File**: `Klee/Service/MCPServerStore.swift` (added, +73/-0)
```diff
@@ -0,0 +1,73 @@
+//
+//  MCPServerStore.swift
+//  Klee
+//
+//  Persists MCP server configurations to disk (JSON).
+//  Injected as @Environment(MCPServerStore.self) throughout the app.
+//
+
+import Foundation
+import Observation
+
+@Observable
+@MainActor
+class MCPServerStore {
+
+    // MARK: - Observable State
+
+    var servers: [MCPServerConfig] = []
+
+    // MARK: - Persistence Path
+
+    private let fileURL: URL = {
+        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
+        let dir = appSupport.appendingPathComponent("Klee", isDirectory: true)
+        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
+        return dir.appendingPathComponent("mcp-servers.json")
+    }()
+
+    // MARK: - Init
+
+    init() {
+        load()
+    }
+
+    // MARK: - CRUD
+
+    func add(server: MCPServerConfig) {
+        servers.append(server)
+        save()
+    }
+
+    func update(server: MCPServerConfig) {
+        guard let index = servers.firstIndex(where: { $0.id == server.id }) else { return }
+        servers[index] = server
+        save()
+    }
+
+    func delete(id: UUID) {
+        servers.removeAll { $0.id == id }
+        save()
+    }
+
+    // MARK: - Persistence
+
+    private func save() {
+        do {
+            let data = try JSONEncoder().encode(servers)
+            try data.write(to: fileURL, options: .atomic)
+        } catch {
+            print("[MCPServerStore] Failed to save: \(error)")
+        }
+    }
+
+    private func load() {
+        guard FileManager.default.fileExists(atPath: fileURL.path) else { return }
+        do {
+            let data = try Data(contentsOf: fileURL)
+            servers = try JSONDecoder().decode([MCPServerConfig].self, from: data)
+        } catch {
+            print("[MCPServerStore] Failed to load: \(error)")
+        }
+    }
+}
```

---

### Incident Patch 4: `a6a3c1be` (2026-03-10)
**Commit Message**: Update documentation and refactor UI components for improved clarity and functionality

**File**: `CLAUDE.md` (modified, +9/-6)
```diff
@@ -20,19 +20,22 @@ Klee is a macOS-native local AI chat application powered by MLX Swift for infere
 - **All UI text and code comments must be in English**
 
 ## Directory Conventions
-- Views go in View/ (ChatView, ModelManagerView)
-- Service layer goes in Service/ (LLMService, ModelManager)
-- Data models go in Model/ (AppState)
+- Views go in View/ (ChatView, HomeView, ModelManagerView, SettingsView)
+- ViewModels go in ViewModel/ (ChatViewModel)
+- Service layer goes in Service/ (LLMService, ModelManager, ChatStore, DownloadManager)
+- Data models go in Model/ (AppState, Conversation)
 - Static data goes in Data/ (RecommendedModels)
-- App entry point: KleeApp.swift, ContentView.swift
+- App entry point: KleeApp.swift
 
 ## Tech Stack
 - SwiftUI + @Observable (not ObservableObject; project uses Swift 6 default MainActor isolation)
 - mlx-swift-lm >= 2.30.0 (SPM dependency, includes MLXLLM, MLXLMCommon)
 - Environment injection uses `@Environment(Type.self)` + `.environment()` (not @EnvironmentObject)
 - HuggingFace mirror: default `hf-mirror.com` (configured in KleeApp.init)
+- Chat persistence: JSON files at `~/Library/Application Support/Klee/chats/{uuid}.json`
 
 ## Phase Roadmap
-- **Phase 1 (current)**: Local-only chat, MLX inference, model management
-- **Phase 2**: OpenClaw Gateway integration (Node.js subprocess + WebSocket)
+- **Phase 1 (complete)**: Local-only chat, MLX inference, model management, chat history, settings
+- **Phase 2 (current)**: OpenClaw Gateway integration (Node.js subprocess + WebSocket)
 - **Phase 3**: Deep macOS integration, multimodal, Apple Foundation Models
+- **Distribution (pending)**: Sparkle auto-update, Developer ID signing, Notarization, DMG packaging
```

**File**: `Klee/View/ChatView.swift` (modified, +25/-26)
```diff
@@ -88,39 +88,38 @@ struct ChatView: View {
     // MARK: - Message List
 
     private var messageList: some View {
-        List {
-            if viewModel.messages.isEmpty {
-                emptyState
-                    .flipped()
-                    .listRowSeparator(.hidden)
-                    .listRowBackground(Color.clear)
-                    .listRowInsets(EdgeInsets())
-            }
-
-            if viewModel.isStreaming,
-               let last = viewModel.messages.last,
-               last.role == .assistant,
-               last.content.isEmpty {
-                thinkingBubble
-                    .flipped()
-                    .listRowSeparator(.hidden)
-                    .listRowBackground(Color.clear)
-                    .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
-            }
-
-            ForEach(viewModel.messages.reversed()) { message in
-                if !(message.role == .assistant && message.content.isEmpty && viewModel.isStreaming) {
-                    messageBubble(for: message)
+        ZStack {
+            List {
+                if viewModel.isStreaming,
+                   let last = viewModel.messages.last,
+                   last.role == .assistant,
+                   last.content.isEmpty {
+                    thinkingBubble
                         .flipped()
                         .listRowSeparator(.hidden)
                         .listRowBackground(Color.clear)
                         .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                 }
+
+                ForEach(viewModel.messages.reversed()) { message in
+                    if !(message.role == .assistant && message.content.isEmpty && viewModel.isStreaming) {
+                        messageBubble(for: message)
+                            .flipped()
+                            .listRowSeparator(.hidden)
+                            .listRowBackground(Color.clear)
+                            .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
+                    }
+                }
+            }
+            .listStyle(.plain)
+            .scrollContentBackground(.hidden)
+            .flipped()
+
+            // Empty state sits outside the flipped List to preserve gesture hit testing
+            if viewModel.messages.isEmpty {
+                emptyState
             }
         }
-        .listStyle(.plain)
-        .scrollContentBackground(.hidden)
-        .flipped()
     }
 
     // MARK: - Error Banner
```

**File**: `Klee/View/SettingsView.swift` (modified, +32/-23)
```diff
@@ -9,42 +9,51 @@ import SwiftUI
 
 struct SettingsView: View {
     @Environment(\.dismiss) private var dismiss
-    @Environment(ModelManager.self) var modelManager
-    @Environment(LLMService.self) var llmService
-    @Environment(DownloadManager.self) var downloadManager
 
     var body: some View {
         NavigationStack {
             Form {
                 // MARK: - Device Section
                 Section("Device") {
-                    LabeledContent("Chip", value: chipName)
-                    LabeledContent("Memory", value: "\(systemMemoryGB) GB")
-                    LabeledContent("macOS", value: ProcessInfo.processInfo.operatingSystemVersionString)
+                    LabeledContent {
+                        Text(chipName)
+                    } label: {
+                        Label("Chip", systemImage: "cpu")
+                    }
+                    LabeledContent {
+                        Text("\(systemMemoryGB) GB")
+                    } label: {
+                        Label("Memory", systemImage: "memorychip")
+                    }
+                    LabeledContent {
+                        Text(ProcessInfo.processInfo.operatingSystemVersionString)
+                    } label: {
+                        Label("macOS", systemImage: "apple.logo")
+                    }
                 }
 
                 // MARK: - Models Section
-                Section {
+                Section("Models") {
                     ModelManagerView()
-                } header: {
-                    HStack {
-                        Text("Models")
-                        Spacer()
-                        Button {
-                            modelManager.refreshCachedModels()
-                        } label: {
-                            Image(systemName: "arrow.clockwise")
-                        }
-                        .buttonStyle(.borderless)
-                        .help("Refresh model list")
-                    }
                 }
 
                 // MARK: - About Section
                 Section("About Klee") {
-                    LabeledContent("Version", value: appVersion)
-                    LabeledContent("Build", value: buildNumber)
-                    LabeledContent("Engine", value: "MLX Swift (on-device)")
+                    LabeledContent {
+                        Text(appVersion)
+                    } label: {
+                        Label("Version", systemImage: "app.badge")
+                    }
+                    LabeledContent {
+                        Text(buildNumber)
+                    } label: {
+                        Label("Build", systemImage: "hammer")
+                    }
+                    LabeledContent {
+                        Text("MLX Swift (on-device)")
+                    } label: {
+                        Label("Engine", systemImage: "bolt.fill")
+                    }
                 }
 
                 // MARK: - ShipSwift Showcase Section
@@ -83,11 +92,11 @@ struct SettingsView: View {
                 .frame(width: 24, height: 24)
                 .clipShape(RoundedRectangle(cornerRadius: 6))
             Text("\(app.name) - \(app.tagline)")
-                .foregroundStyle(.accent)
             Spacer()
             Image(systemName: "arrow.up.right")
                 .imageScale(.small)
         }
+        .foregroundStyle(.accent)
     }
 
     // MARK: - Device Info Helpers
```

**File**: `klee-architecture-plan.md` (modified, +14/-7)
```diff
@@ -563,16 +563,23 @@ Phase 1 体积小（~70MB），全量更新也可接受。Phase 2 体积增大
 
 ## 十、下一步行动
 
-### Phase 1：本地聊天（当前重点）
+### Phase 1：本地聊天 ✅ 已完成
 
 **目标**：用户下载 Klee → 选模型 → 自动下载 → 开始聊天
 
-- [ ] 重构现有代码：移除 Ollama ProcessManager，引入 mlx-swift-lm SPM 依赖
-- [ ] 实现 LLMService：模型加载、流式推理、模型切换
-- [ ] 实现 ModelManager：推荐模型列表、下载进度、缓存管理、按内存过滤
-- [ ] 重构 ChatView：对接 MLX 流式输出（替代 Ollama REST API）
-- [ ] 重构 ModelManagerView：展示 HuggingFace 模型列表、下载/删除
-- [ ] Onboarding 流程：检测内存 → 推荐模型 → 引导下载 → 首次对话
+- [x] 重构现有代码：移除 Ollama ProcessManager，引入 mlx-swift-lm SPM 依赖
+- [x] 实现 LLMService：模型加载、流式推理、模型切换
+- [x] 实现 ModelManager：推荐模型列表、下载进度、缓存管理、RAM 兼容性提示
+- [x] 重构 ChatView + ChatViewModel：对接 MLX 流式输出，`<think>` 标签渲染
+- [x] 重构 ModelManagerView：HuggingFace 模型列表、下载/删除，10 个主流模型
+- [x] Onboarding 流程：检测内存 → 推荐模型 → 引导下载 → 首次对话
+- [x] 聊天记录持久化（ChatStore，JSON 文件存储，按对话分文件）
+- [x] 侧边栏聊天历史：AI 自动生成标题、重命名、删除、空对话清理
+- [x] 模型加载错误提示（内联 Banner + Open Settings 跳转）
+- [x] Settings 页面：设备信息、模型管理、About、Apps Built with ShipSwift
+
+### Distribution：签名与发布（功能开发完成后执行）
+
 - [ ] 集成 Sparkle 2.x 自动更新
 - [ ] Developer ID 签名 + Notarization + DMG 打包
 
```

---

### Incident Patch 5: `289ecb96` (2026-03-10)
**Commit Message**: Refactor ModelManager and ChatView for improved model caching and UI responsiveness

- Updated ModelManager to use a new caching structure for models, simplifying the refresh logic and improving performance.
- Introduced DownloadManager to handle model downloads with real-time progress updates and cancellation support.
- Enhanced ChatView with a flipped message list for better user experience during streaming.
- Added MarkdownTextView for rendering AI responses with Markdown support.
- Implemented ThinkingIndicator for visual feedback during AI processing.
- Removed deprecated loading progress UI and integrated download status directly into the model management interface.

**File**: `CLAUDE.md` (modified, +31/-28)
```diff
@@ -1,35 +1,38 @@
 # CLAUDE.md
 
-项目详情见 README.md 和 klee-architecture-plan.md。
+See README.md and klee-architecture-plan.md for full project details.
 
-## 项目简介
-Klee 是一个 macOS 原生本地 AI 聊天应用，使用 MLX Swift 作为推理引擎，面向非开发人员，零配置开箱即用。
+All comments and UI text must be in English (this is a public repo).
 
-## 开发约束
-- Xcode Scheme：`Klee`
-- Deployment Target：macOS 15.0+
-- 推理引擎：mlx-swift-lm（SPM 依赖，进程内推理，无外部子进程）
-- 模型格式：MLX safetensors（从 HuggingFace mlx-community 下载）
-- 模型缓存路径：`~/Library/Caches/huggingface/hub/`
-- App Sandbox：关闭（Phase 2 需要子进程管理）
-- Hardened Runtime：开启
-- 分发方式：Developer ID 直接分发（非 App Store）
-- 不执行 xcodebuild，iOS/macOS 构建由主公在 Xcode 中测试
-- **UI 文案使用英文，代码注释使用中文**
+## Project Overview
+Klee is a macOS-native local AI chat application powered by MLX Swift for inference, designed for non-developers with zero-configuration out-of-the-box experience.
 
-## 目录约定
-- 视图放 View/（ChatView、ModelManagerView）
-- 服务层放 Service/（LLMService、ModelManager）
-- 数据模型放 Model/（AppState）
-- 应用入口：KleeApp.swift、ContentView.swift
+## Development Constraints
+- Xcode Scheme: `Klee`
+- Deployment Target: macOS 15.0+
+- Inference Engine: mlx-swift-lm (SPM dependency, in-process inference, no external subprocesses)
+- Model Format: MLX safetensors (downloaded from HuggingFace mlx-community)
+- Model Cache Path: `~/Library/Caches/models/{org}/{model-name}/`
+- App Sandbox: Disabled (Phase 2 requires subprocess management)
+- Hardened Runtime: Enabled
+- Distribution: Developer ID direct distribution (not App Store)
+- Do not run xcodebuild; macOS builds are tested by the developer in Xcode
+- **All UI text and code comments must be in English**
 
-## 技术栈
-- SwiftUI + @Observable（非 ObservableObject，项目使用 Swift 6 默认 MainActor 隔离）
-- mlx-swift-lm >= 2.30.0（SPM 依赖，含 MLXLLM、MLXLMCommon）
-- 环境注入使用 `@Environment(Type.self)` + `.environment()`（非 @EnvironmentObject）
-- HuggingFace 镜像：默认 `hf-mirror.com`（KleeApp.init 中配置）
+## Directory Conventions
+- Views go in View/ (ChatView, ModelManagerView)
+- Service layer goes in Service/ (LLMService, ModelManager)
+- Data models go in Model/ (AppState)
+- Static data goes in Data/ (RecommendedModels)
+- App entry point: KleeApp.swift, ContentView.swift
 
-## Phase 规划
-- **Phase 1（当前）**：纯本地聊天，MLX 推理，模型管理
-- **Phase 2**：OpenClaw Gateway 集成（Node.js 子进程 + WebSocket）
-- **Phase 3**：macOS 深度整合、多模态、Apple Foundation Models
+## Tech Stack
+- SwiftUI + @Observable (not ObservableObject; project uses Swift 6 default MainActor isolation)
+- mlx-swift-lm >= 2.30.0 (SPM dependency, includes MLXLLM, MLXLMCommon)
+- Environment injection uses `@Environment(Type.self)` + `.environment()` (not @EnvironmentObject)
+- HuggingFace mirror: default `hf-mirror.com` (configured in KleeApp.init)
+
+## Phase Roadmap
+- **Phase 1 (current)**: Local-only chat, MLX inference, model management
+- **Phase 2**: OpenClaw Gateway integration (Node.js subprocess + WebSocket)
+- **Phase 3**: Deep macOS integration, multimodal, Apple Foundation Models
```

**File**: `Klee/ContentView.swift` (modified, +25/-7)
```diff
@@ -2,9 +2,9 @@
 //  ContentView.swift
 //  Klee
 //
-//  主容器视图：NavigationSplitView 布局。
-//  侧边栏：模型管理。详情区：聊天视图。
-//  Phase 1 重构：移除 ProcessManager，使用 LLMService + ModelManager。
+//  Main container view: NavigationSplitView layout.
+//  Sidebar: model management. Detail: chat view.
+//  Phase 1 refactor: removed ProcessManager, now uses LLMService + ModelManager.
 //
 
 import SwiftUI
@@ -22,7 +22,7 @@ struct ContentView: View {
         }
         .navigationTitle("Klee")
         .task {
-            // 启动时自动加载上次使用的模型
+            // Auto-load the last used model on launch
             if let lastModelId = modelManager.selectedModelId,
                modelManager.isCached(lastModelId) {
                 await llmService.loadModel(id: lastModelId)
@@ -35,18 +35,35 @@ struct ContentView: View {
         }
     }
 
-    // MARK: - 侧边栏
+    // MARK: - Sidebar
 
     private var sidebarContent: some View {
         VStack(spacing: 0) {
             ModelManagerView()
         }
     }
 
-    // MARK: - 状态标识
+    // MARK: - Status Badge (model name + state)
 
     private var statusBadge: some View {
-        HStack(spacing: 4) {
+        HStack(spacing: 6) {
+            // Model name
+            if let modelId = llmService.currentModelId {
+                let shortName = modelId.components(separatedBy: "/").last ?? modelId
+                Text(shortName)
+                    .font(.caption)
+                    .foregroundStyle(.secondary)
+            }
+
+            // Generation speed
+            if llmService.state == .generating, llmService.tokensPerSecond > 0 {
+                Text(String(format: "%.1f tok/s", llmService.tokensPerSecond))
+                    .font(.caption)
+                    .foregroundStyle(.secondary)
+                    .monospacedDigit()
+            }
+
+            // Status dot + label
             Circle()
                 .fill(statusColor)
                 .frame(width: 8, height: 8)
@@ -81,4 +98,5 @@ struct ContentView: View {
     ContentView()
         .environment(LLMService())
         .environment(ModelManager())
+        .environment(DownloadManager())
 }
```

**File**: `Klee/Data/RecommendedModels.swift` (modified, +23/-16)
```diff
@@ -2,59 +2,66 @@
 //  RecommendedModels.swift
 //  Klee
 //
-//  预定义的推荐模型列表，按系统内存分级。
-//  新增/修改模型只需编辑此文件。
+//  Predefined recommended model list, tiered by system RAM.
+//  Add or modify models by editing this file only.
 //
 
 import Foundation
 
 extension ModelInfo {
 
-    /// 预定义推荐模型列表（按内存分级）
+    /// Predefined recommended model list (tiered by RAM)
+    /// expectedBytes is an estimated download size for progress bar calculation (does not need to be exact)
     static let recommended: [ModelInfo] = [
 
-        // 8GB 机型
+        // 8GB devices
         ModelInfo(
             id: "mlx-community/Qwen3-4B-4bit",
             name: "Qwen3 4B",
             size: "~2.5 GB",
-            minRAM: 8
+            minRAM: 8,
+            expectedBytes: 2_500_000_000
         ),
 
-        // 16GB 机型
+        // 16GB devices
         ModelInfo(
-            id: "mlx-community/Llama-3.3-8B-Instruct-4bit",
-            name: "Llama 3.3 8B",
-            size: "~5 GB",
-            minRAM: 16
+            id: "mlx-community/Meta-Llama-3.1-8B-Instruct-4bit",
+            name: "Llama 3.1 8B",
+            size: "~4.5 GB",
+            minRAM: 16,
+            expectedBytes: 4_500_000_000
         ),
         ModelInfo(
             id: "mlx-community/Qwen3-8B-4bit",
             name: "Qwen3 8B",
             size: "~5 GB",
-            minRAM: 16
+            minRAM: 16,
+            expectedBytes: 5_000_000_000
         ),
 
-        // 32GB 机型
+        // 32GB devices
         ModelInfo(
             id: "mlx-community/Mistral-Small-24B-Instruct-2501-4bit",
             name: "Mistral Small 24B",
             size: "~12 GB",
-            minRAM: 32
+            minRAM: 32,
+            expectedBytes: 12_000_000_000
         ),
         ModelInfo(
             id: "mlx-community/Qwen3-14B-4bit",
             name: "Qwen3 14B",
             size: "~8 GB",
-            minRAM: 32
+            minRAM: 32,
+            expectedBytes: 8_000_000_000
         ),
 
-        // 64GB+ 机型
+        // 64GB+ devices
         ModelInfo(
             id: "mlx-community/Qwen3-32B-4bit",
             name: "Qwen3 32B",
             size: "~18 GB",
-            minRAM: 64
+            minRAM: 64,
+            expectedBytes: 18_000_000_000
         ),
     ]
 }
```

**File**: `Klee/KleeApp.swift` (modified, +7/-6)
```diff
@@ -2,8 +2,8 @@
 //  KleeApp.swift
 //  Klee
 //
-//  应用入口。注入 LLMService 和 ModelManager 作为环境对象。
-//  Phase 1 重构：移除 ProcessManager 和 AppDelegate（不再需要子进程管理）。
+//  App entry point. Injects LLMService and ModelManager as environment objects.
+//  Phase 1 refactor: removed ProcessManager and AppDelegate (subprocess management no longer needed).
 //
 
 import SwiftUI
@@ -12,22 +12,23 @@ import SwiftUI
 struct KleeApp: App {
     @State private var llmService = LLMService()
     @State private var modelManager = ModelManager()
+    @State private var downloadManager = DownloadManager()
 
     init() {
-        // 国内用户默认启用 HuggingFace 镜像加速
-        // 后续可在设置界面让用户切换
-        LLMService.huggingFaceMirror = "https://hf-mirror.com"
+        // HuggingFace mirror acceleration (uncomment for users in China)
+        // LLMService.huggingFaceMirror = "https://hf-mirror.com"
     }
 
     var body: some Scene {
         WindowGroup {
             ContentView()
                 .environment(llmService)
                 .environment(modelManager)
+                .environment(downloadManager)
         }
         .defaultSize(width: 960, height: 640)
         .commands {
-            // 单窗口应用，移除默认的「新建窗口」命令
+            // Single-window app: remove the default "New Window" command
             CommandGroup(replacing: .newItem) {}
         }
     }
```

**File**: `Klee/Model/AppState.swift` (modified, +21/-19)
```diff
@@ -2,21 +2,21 @@
 //  AppState.swift
 //  Klee
 //
-//  状态枚举与数据模型。
-//  Phase 1 重构：移除进程管理相关类型，新增 MLX 推理层模型。
+//  State enums and data models.
+//  Phase 1 refactor: removed process management types, added MLX inference layer models.
 //
 
 import Foundation
 
-// MARK: - LLM 状态
+// MARK: - LLM State
 
-/// LLM 推理引擎的运行状态
+/// Runtime state of the LLM inference engine
 enum LLMState: Equatable {
-    case idle           // 未加载模型
-    case loading        // 正在加载模型（下载/读取缓存）
-    case ready          // 模型已加载，等待输入
-    case generating     // 正在流式生成
-    case error(String)  // 发生错误
+    case idle           // No model loaded
+    case loading        // Loading model (downloading/reading cache)
+    case ready          // Model loaded, awaiting input
+    case generating     // Streaming generation in progress
+    case error(String)  // An error occurred
 
     var label: String {
         switch self {
@@ -33,28 +33,30 @@ enum LLMState: Equatable {
     }
 }
 
-// MARK: - 模型信息
+// MARK: - Model Info
 
-/// 描述一个可用的 MLX 模型
+/// Describes an available MLX model
 struct ModelInfo: Identifiable, Equatable, Hashable {
-    /// HuggingFace 模型 ID（如 "mlx-community/Qwen3-4B-4bit"）
+    /// HuggingFace model ID (e.g., "mlx-community/Qwen3-4B-4bit")
     let id: String
-    /// 用户友好的显示名
+    /// User-friendly display name
     let name: String
-    /// 预估模型文件大小（如 "~2.5 GB"）
+    /// Estimated model file size (e.g., "~2.5 GB")
     let size: String
-    /// 运行此模型所需的最低系统内存（GB）
+    /// Minimum system RAM (GB) required to run this model
     let minRAM: Int
+    /// Estimated download size in bytes (used for progress calculation)
+    let expectedBytes: Int64
 
-    /// 以内存要求生成描述标签
+    /// Label describing the RAM requirement
     var ramLabel: String {
         "Requires \(minRAM)GB+ RAM"
     }
 }
 
-// MARK: - 聊天消息
+// MARK: - Chat Message
 
-/// 对话中的单条消息
+/// A single message in the conversation
 struct ChatMessage: Identifiable, Equatable {
     let id: UUID
     let role: Role
@@ -75,7 +77,7 @@ struct ChatMessage: Identifiable, Equatable {
     }
 }
 
-// MARK: - 应用错误
+// MARK: - App Errors
 
 enum AppError: LocalizedError {
     case modelLoadFailed(String)
```

**File**: `Klee/Service/DownloadManager.swift` (added, +185/-0)
```diff
@@ -0,0 +1,185 @@
+//
+//  DownloadManager.swift
+//  Klee
+//
+//  Model download manager: wraps HuggingFace Hub download capabilities with real-time progress, speed, and cancel support.
+//  Relies on mlx-swift-lm's loadContainer -> Hub.snapshot -> Downloader pipeline.
+//  Hub's Downloader supports resume (Range header); cancelling and restarting automatically resumes.
+//
+
+import Foundation
+import Observation
+import MLXLLM
+@preconcurrency import MLXLMCommon
+
+// MARK: - Download Status
+
+/// Download status for a single model
+enum DownloadStatus: Equatable {
+    case idle
+    case downloading
+    case paused
+    case completed
+    case failed(String)
+    case cancelling
+}
+
+// MARK: - Download Progress
+
+/// Download progress snapshot (for UI display)
+struct DownloadProgress: Equatable {
+    /// Fraction completed 0.0 ~ 1.0
+    var fractionCompleted: Double = 0
+    /// Number of completed files
+    var completedFiles: Int64 = 0
+    /// Total number of files
+    var totalFiles: Int64 = 0
+    /// Current download speed (bytes/sec), nil if unknown
+    var speed: Double? = nil
+
+    /// Formatted speed string
+    var speedLabel: String {
+        guard let speed, speed > 0 else { return "" }
+        let formatter = ByteCountFormatter()
+        formatter.countStyle = .file
+        return "\(formatter.string(fromByteCount: Int64(speed)))/s"
+    }
+
+    /// Formatted progress percentage
+    var percentLabel: String {
+        "\(Int(fractionCompleted * 100))%"
+    }
+}
+
+// MARK: - DownloadManager
+
+@Observable
+class DownloadManager {
+
+    // MARK: - Observable Properties
+
+    /// Current download status
+    private(set) var status: DownloadStatus = .idle
+
+    /// Download progress
+    private(set) var progress: DownloadProgress = .init()
+
+    /// ID of the model being downloaded
+    private(set) var downloadingModelId: String?
+
+    // MARK: - Private Properties
+
+    /// Current download+load task (for cancellation)
+    private var downloadTask: Task<ModelContainer?, Never>?
+
+    // MARK: - Download and Load Model
+
+    /// Download model files and load into memory, returning a ModelContainer
+    /// - Parameter id: HuggingFace model ID
+    /// - Returns: The loaded ModelContainer, or nil if cancelled or failed
+    @discardableResult
+    func downloadAndLoad(id: String) async -> ModelContainer? {
+        // Don't start a duplicate download for the same model
+        if downloadingModelId == id && status == .downloading {
+            return nil
+        }
+
+        // Cancel any previous task
+        cancelCurrentTask()
+
+        // Reset state
+        downloadingModelId = id
+        status = .downloading
+        progress = .init()
+
+        let task = Task<ModelContainer?, Never> { [weak self] in
+            do {
+                let configuration = ModelConfiguration(id: id)
+
+                // Track download progress via loadContainer's Progress callback
+                // Hub.snapshot creates child Progress per file, callback fires on each chunk write
+                let container = try await LLMModelFactory.shared.loadContainer(
+                    configuration: configuration
+                ) { [weak self] progress in
+                    // Progress object:
+                    //   totalUnitCount = total file count
+                    //   completedUnitCount = completed files (including partial progress)
+                    //   fractionCompleted = overall completion ratio
+                    //   userInfo[.throughputKey] = current speed (bytes/sec)
+                    Task { @MainActor [weak self] in
+                        guard let self, self.status == .downloading else { return }
+                        self.progress.fractionCompleted = progress.fractionCompleted
+                        self.progress.completedFiles = progress.completedUnitCount
+                        self.progress.totalFiles = progress.totalUnitCount
+                        if let speed = progress.userInfo[.throughputKey] as? Double {
+                            self.progress.speed = speed
+                        }
+                    }
+                }
+
+                // Check if cancelled
+                if Task.isCancelled {
+                    await MainActor.run { [weak self] in
+                        self?.status = .idle
+                        self?.downloadingModelId = nil
+                    }
+                    return nil
+                }
+
+                // Download + load complete
+                await MainActor.run { [weak self] in
+                    self?.status = .completed
+                    self?.progress.fractionCompleted = 1.0
+                }
+
+                return container
+
+            } catch {
+                if Task.isCancelled {
+                    await MainActor.run { [weak self] in
+                        self?.status = .idle
+                        self?.downloadingModelId = nil
+
```

**File**: `Klee/Service/LLMService.swift` (modified, +60/-41)
```diff
@@ -2,8 +2,9 @@
 //  LLMService.swift
 //  Klee
 //
-//  MLX Swift 进程内推理服务。
-//  替代 OllamaService，直接使用 mlx-swift-lm 进行本地模型加载和流式生成。
+//  MLX Swift in-process inference service.
+//  Handles model loading (from downloaded local files) and streaming generation.
+//  Download logic has been separated into DownloadManager.
 //
 
 import Foundation
@@ -14,36 +15,36 @@ import MLXLLM
 @Observable
 class LLMService {
 
-    // MARK: - 可观察属性
+    // MARK: - Observable Properties
 
-    /// 当前 LLM 引擎状态
+    /// Current LLM engine state
     private(set) var state: LLMState = .idle
 
-    /// 当前已加载模型的 ID
+    /// ID of the currently loaded model
     private(set) var currentModelId: String?
 
-    /// 最近一次错误信息
+    /// Most recent error message
     private(set) var error: String?
 
-    /// 模型下载/加载进度（0.0 ~ 1.0）
+    /// Model loading progress (0.0 ~ 1.0), only valid during weight loading
     private(set) var loadProgress: Double?
 
-    /// 加载状态描述文字
+    /// Loading status description text
     private(set) var loadingStatus: String?
 
-    /// 当前生成的 token/s 速度
+    /// Current generation speed in tokens/second
     private(set) var tokensPerSecond: Double = 0
 
-    // MARK: - 私有属性
+    // MARK: - Private Properties
 
-    /// 已加载的模型容器
+    /// The loaded model container
     private var modelContainer: ModelContainer?
 
-    /// 当前生成任务（用于取消）
+    /// Current generation task (for cancellation)
     private var generationTask: Task<Void, Never>?
 
-    /// HuggingFace 镜像地址（国内加速）
-    /// 设置后所有模型下载走镜像，设为 nil 恢复官方源
+    /// HuggingFace mirror URL (for acceleration in China)
+    /// When set, all model downloads use the mirror; set to nil to restore the official source
     static var huggingFaceMirror: String? {
         didSet {
             if let mirror = huggingFaceMirror {
@@ -54,35 +55,53 @@ class LLMService {
         }
     }
 
-    // MARK: - 模型加载
+    // MARK: - Use Downloaded Container
+
+    /// Directly set a loaded ModelContainer (provided by DownloadManager)
+    /// - Parameters:
+    ///   - container: The fully loaded model container
+    ///   - id: Model ID
+    func setLoadedContainer(_ container: ModelContainer, id: String) {
+        modelContainer = container
+        currentModelId = id
+        state = .ready
+        loadProgress = nil
+        loadingStatus = nil
+        error = nil
+
+        // Persist the last used model ID
+        UserDefaults.standard.set(id, forKey: "lastUsedModelId")
+    }
+
+    // MARK: - Load Local Downloaded Model
 
-    /// 加载指定模型（从 HuggingFace 下载或读取本地缓存）
-    /// - Parameter id: HuggingFace 模型 ID，如 "mlx-community/Qwen3-4B-4bit"
+    /// Load a specified model (loads from local cache only, does not trigger download)
+    /// If the model is not downloaded, it will attempt to download (for backward compatibility)
+    /// - Parameter id: HuggingFace model ID
     func loadModel(id: String) async {
-        // 如果当前已加载同一模型，无需重复加载
+        // Skip if the same model is already loaded
         if currentModelId == id, modelContainer != nil, state == .ready {
             return
         }
 
         state = .loading
         error = nil
         loadProgress = 0
-        loadingStatus = "Preparing model..."
+        loadingStatus = "Loading model..."
 
         do {
             let configuration = ModelConfiguration(id: id)
 
-            // loadContainer 自动处理下载（含断点续传）和加载
-            loadingStatus = "Downloading and loading model..."
             let container = try await LLMModelFactory.shared.loadContainer(
                 configuration: configuration
-            ) { progress in
-                let fraction = progress.fractionCompleted
-                let total = progress.totalUnitCount
+            ) { [weak self] progress in
                 Task { @MainActor [weak self] in
-                    self?.loadProgress = fraction
+                    guard let self else { return }
+                    self.loadProgress = progress.fractionCompleted
+                    let completed = progress.completedUnitCount
+                    let total = progress.totalUnitCount
                     if total > 0 {
-                        self?.loadingStatus = "Loading (\(Int(fraction * 100))%)"
+                        self.loadingStatus = "Loading \(completed)/\(total) files..."
                     }
                 }
             }
@@ -93,7 +112,7 @@ class LLMService {
             loadProgress = nil
             loadingStatus = nil
 
-            // 持久化上次使用的模型 ID
+            // Persist the last used model ID
             UserDefaults.standard.set(id, forKey: "lastUsedModelId")
 
         } catch {
@@ -104,11 +123,11 @@ class LLMService {
         }
     }
 
-    // MARK: - 流式聊天
+    // MARK: - Streaming Chat
 
-    /// 发送聊天消息，返回流式 token 输出
-    /// - Parameter messages: 完整的对话历史
-    /// - Returns: 异步字符串流，每个元素是一个 token 片段
+    /// Send chat messages and return a streaming token output
+    /// - Parameter messages: Complete conversation history
+    /// - Returns: As
```

**File**: `Klee/Service/ModelManager.swift` (modified, +45/-65)
```diff
@@ -2,8 +2,8 @@
 //  ModelManager.swift
 //  Klee
 //
-//  模型管理器：推荐模型列表、按内存过滤、下载/删除缓存模型。
-//  替代 Ollama 的模型管理方式，直接操作 HuggingFace Hub 本地缓存。
+//  Model manager: recommended model list, RAM-based filtering, download/delete cached models.
+//  Model cache path: ~/Library/Caches/models/{org}/{model-name}/
 //
 
 import Foundation
@@ -12,21 +12,21 @@ import Observation
 @Observable
 class ModelManager {
 
-    // MARK: - 可观察属性
+    // MARK: - Observable Properties
 
-    /// 当前系统可运行的推荐模型（已按内存过滤）
+    /// Recommended models runnable on the current system (filtered by RAM)
     private(set) var availableModels: [ModelInfo] = []
 
-    /// 已下载到本地缓存的模型 ID 集合
+    /// Set of model IDs that have been downloaded to local cache
     private(set) var cachedModelIds: Set<String> = []
 
-    /// 当前选中的模型 ID
+    /// Currently selected model ID
     var selectedModelId: String?
 
-    /// 系统物理内存（GB）
+    /// System physical memory (GB)
     private(set) var systemRAM: Int = 0
 
-    // MARK: - 初始化
+    // MARK: - Initialization
 
     init() {
         let totalBytes = ProcessInfo.processInfo.physicalMemory
@@ -36,97 +36,71 @@ class ModelManager {
         loadLastSelectedModel()
     }
 
-    // MARK: - 按系统内存过滤
+    // MARK: - Filter by System RAM
 
-    /// 检测系统内存，过滤出当前机器可运行的模型
+    /// Detect system memory and filter models runnable on this machine
     func filterBySystemRAM() {
         availableModels = ModelInfo.recommended.filter { $0.minRAM <= systemRAM }
     }
 
-    // MARK: - 刷新缓存模型列表
+    // MARK: - Refresh Cached Models
 
-    /// 扫描 HuggingFace Hub 缓存目录，找出已下载的模型
+    /// Scan the model cache directory to find downloaded models
+    /// mlx-swift-lm cache structure: ~/Library/Caches/models/{org}/{model-name}/
     func refreshCachedModels() {
-        let cacheDir = huggingFaceCacheDir
         var cached = Set<String>()
+        let fm = FileManager.default
 
-        guard let contents = try? FileManager.default.contentsOfDirectory(
-            at: cacheDir,
-            includingPropertiesForKeys: nil
-        ) else {
-            cachedModelIds = cached
-            return
-        }
-
-        // HuggingFace Hub 缓存目录结构：
-        // ~/Library/Caches/huggingface/hub/models--org--model-name/
-        for dir in contents {
-            let dirName = dir.lastPathComponent
-            if dirName.hasPrefix("models--") {
-                // 将目录名转换回 HuggingFace 模型 ID
-                // "models--mlx-community--Qwen3-4B-4bit" -> "mlx-community/Qwen3-4B-4bit"
-                let modelId = dirName
-                    .replacingOccurrences(of: "models--", with: "")
-                    .replacingOccurrences(of: "--", with: "/")
-
-                // 检查是否有实际的模型文件（safetensors）
-                let snapshotsDir = dir.appendingPathComponent("snapshots")
-                if let snapshots = try? FileManager.default.contentsOfDirectory(
-                    at: snapshotsDir,
-                    includingPropertiesForKeys: nil
-                ) {
-                    for snapshot in snapshots {
-                        if let files = try? FileManager.default.contentsOfDirectory(atPath: snapshot.path),
-                           files.contains(where: { $0.hasSuffix(".safetensors") }) {
-                            cached.insert(modelId)
-                            break
-                        }
-                    }
+        // Iterate recommended models, check if directory exists and contains safetensors files
+        for model in ModelInfo.recommended {
+            let modelDir = cacheDirectory(for: model.id)
+            if fm.fileExists(atPath: modelDir.path) {
+                if let files = try? fm.contentsOfDirectory(atPath: modelDir.path),
+                   files.contains(where: { $0.hasSuffix(".safetensors") }) {
+                    cached.insert(model.id)
                 }
             }
         }
 
         cachedModelIds = cached
     }
 
-    // MARK: - 删除模型
+    // MARK: - Delete Model
 
-    /// 删除指定模型的本地缓存
-    /// - Parameter id: HuggingFace 模型 ID
+    /// Delete the local cache for a specified model
+    /// - Parameter id: HuggingFace model ID (e.g., "mlx-community/Qwen3-4B-4bit")
     func deleteModel(id: String) throws {
-        let dirName = "models--" + id.replacingOccurrences(of: "/", with: "--")
-        let modelDir = huggingFaceCacheDir.appendingPathComponent(dirName)
+        let modelDir = cacheDirectory(for: id)
 
         guard FileManager.default.fileExists(atPath: modelDir.path) else {
             return
         }
 
         try FileManager.default.removeItem(at: modelDir)
 
-        // 更新缓存列表
+        // Update cached list
         cachedModelIds.remove(id)
 
-        // 如果删除的是当前选中的模型，清除选择
+        // If the deleted model was selected, clear the selection
         if selectedModelId == id {
             selectedModelId = nil
             UserDefaults.standard.removeObject(forKey: "lastUsedModelId")
         }
     }
 
-    // MARK: - 检查模型是否已缓存
+    // MARK: - Check if Mode
```

---

### Incident Patch 6: `bb714313` (2026-03-09)
**Commit Message**: Refactor Klee architecture to utilize SwiftUI and MLX Swift, replacing Ollama with MLX for local AI agent capabilities. Enhance product positioning, technical architecture, and model management, while optimizing app bundle size and ensuring seamless user experience. Implement Sparkle for automatic updates and streamline node_modules for reduced footprint.

**File**: `.gitignore` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+# Xcode
+build/
+DerivedData/
+*.xcuserstate
+*.xcworkspace/xcuserdata/
+*.xcodeproj/xcuserdata/
+
+# macOS
+.DS_Store
+
+# Legacy Ollama binaries (Phase 1 前的遗留文件，可手动清理)
+Resources/
```

**File**: `CLAUDE.md` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+# CLAUDE.md
+
+项目详情见 README.md 和 klee-architecture-plan.md。
+
+## 项目简介
+Klee 是一个 macOS 原生本地 AI 聊天应用，使用 MLX Swift 作为推理引擎，面向非开发人员，零配置开箱即用。
+
+## 开发约束
+- Xcode Scheme：`Klee`
+- Deployment Target：macOS 15.0+
+- 推理引擎：mlx-swift-lm（SPM 依赖，进程内推理，无外部子进程）
+- 模型格式：MLX safetensors（从 HuggingFace mlx-community 下载）
+- 模型缓存路径：`~/Library/Caches/huggingface/hub/`
+- App Sandbox：关闭（Phase 2 需要子进程管理）
+- Hardened Runtime：开启
+- 分发方式：Developer ID 直接分发（非 App Store）
+- 不执行 xcodebuild，iOS/macOS 构建由主公在 Xcode 中测试
+- **UI 文案使用英文，代码注释使用中文**
+
+## 目录约定
+- 视图放 View/（ChatView、ModelManagerView）
+- 服务层放 Service/（LLMService、ModelManager）
+- 数据模型放 Model/（AppState）
+- 应用入口：KleeApp.swift、ContentView.swift
+
+## 技术栈
+- SwiftUI + @Observable（非 ObservableObject，项目使用 Swift 6 默认 MainActor 隔离）
+- mlx-swift-lm >= 2.30.0（SPM 依赖，含 MLXLLM、MLXLMCommon）
+- 环境注入使用 `@Environment(Type.self)` + `.environment()`（非 @EnvironmentObject）
+- HuggingFace 镜像：默认 `hf-mirror.com`（KleeApp.init 中配置）
+
+## Phase 规划
+- **Phase 1（当前）**：纯本地聊天，MLX 推理，模型管理
+- **Phase 2**：OpenClaw Gateway 集成（Node.js 子进程 + WebSocket）
+- **Phase 3**：macOS 深度整合、多模态、Apple Foundation Models
```

**File**: `Klee.xcodeproj/project.pbxproj` (modified, +42/-6)
```diff
@@ -6,6 +6,11 @@
 	objectVersion = 77;
 	objects = {
 
+/* Begin PBXBuildFile section */
+		9B252D1A2F5F000000000001 /* MLXLLM in Frameworks */ = {isa = PBXBuildFile; productRef = 9B252D1B2F5F000000000001 /* MLXLLM */; };
+		9B252D1C2F5F000000000002 /* MLXLMCommon in Frameworks */ = {isa = PBXBuildFile; productRef = 9B252D1D2F5F000000000002 /* MLXLMCommon */; };
+/* End PBXBuildFile section */
+
 /* Begin PBXFileReference section */
 		9B252CE42F5EE71200DDD7B5 /* Klee.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = Klee.app; sourceTree = BUILT_PRODUCTS_DIR; };
 /* End PBXFileReference section */
@@ -23,6 +28,8 @@
 			isa = PBXFrameworksBuildPhase;
 			buildActionMask = 2147483647;
 			files = (
+				9B252D1A2F5F000000000001 /* MLXLLM in Frameworks */,
+				9B252D1C2F5F000000000002 /* MLXLMCommon in Frameworks */,
 			);
 			runOnlyForDeploymentPostprocessing = 0;
 		};
@@ -65,6 +72,8 @@
 			);
 			name = Klee;
 			packageProductDependencies = (
+				9B252D1B2F5F000000000001 /* MLXLLM */,
+				9B252D1D2F5F000000000002 /* MLXLMCommon */,
 			);
 			productName = Klee;
 			productReference = 9B252CE42F5EE71200DDD7B5 /* Klee.app */;
@@ -94,6 +103,9 @@
 			);
 			mainGroup = 9B252CDB2F5EE71200DDD7B5;
 			minimizedProjectReferenceProxies = 1;
+			packageReferences = (
+				9B252D1E2F5F000000000003 /* XCRemoteSwiftPackageReference "mlx-swift-lm" */,
+			);
 			preferredProjectObjectVersion = 77;
 			productRefGroup = 9B252CE52F5EE71200DDD7B5 /* Products */;
 			projectDirPath = "";
@@ -179,7 +191,7 @@
 				GCC_WARN_UNUSED_FUNCTION = YES;
 				GCC_WARN_UNUSED_VARIABLE = YES;
 				LOCALIZATION_PREFERS_STRING_CATALOGS = YES;
-				MACOSX_DEPLOYMENT_TARGET = 26.2;
+				MACOSX_DEPLOYMENT_TARGET = 15.0;
 				MTL_ENABLE_DEBUG_INFO = INCLUDE_SOURCE;
 				MTL_FAST_MATH = YES;
 				ONLY_ACTIVE_ARCH = YES;
@@ -237,7 +249,7 @@
 				GCC_WARN_UNUSED_FUNCTION = YES;
 				GCC_WARN_UNUSED_VARIABLE = YES;
 				LOCALIZATION_PREFERS_STRING_CATALOGS = YES;
-				MACOSX_DEPLOYMENT_TARGET = 26.2;
+				MACOSX_DEPLOYMENT_TARGET = 15.0;
 				MTL_ENABLE_DEBUG_INFO = NO;
 				MTL_FAST_MATH = YES;
 				SDKROOT = macosx;
@@ -254,16 +266,16 @@
 				COMBINE_HIDPI_IMAGES = YES;
 				CURRENT_PROJECT_VERSION = 1;
 				DEVELOPMENT_TEAM = 5GS4D3667R;
-				ENABLE_APP_SANDBOX = YES;
+				ENABLE_APP_SANDBOX = NO;
 				ENABLE_HARDENED_RUNTIME = YES;
 				ENABLE_PREVIEWS = YES;
-				ENABLE_USER_SELECTED_FILES = readonly;
 				GENERATE_INFOPLIST_FILE = YES;
 				INFOPLIST_KEY_NSHumanReadableCopyright = "";
 				LD_RUNPATH_SEARCH_PATHS = (
 					"$(inherited)",
 					"@executable_path/../Frameworks",
 				);
+				MACOSX_DEPLOYMENT_TARGET = 15.0;
 				MARKETING_VERSION = 1.0;
 				PRODUCT_BUNDLE_IDENTIFIER = com.signerlabs.Klee;
 				PRODUCT_NAME = "$(TARGET_NAME)";
@@ -286,16 +298,16 @@
 				COMBINE_HIDPI_IMAGES = YES;
 				CURRENT_PROJECT_VERSION = 1;
 				DEVELOPMENT_TEAM = 5GS4D3667R;
-				ENABLE_APP_SANDBOX = YES;
+				ENABLE_APP_SANDBOX = NO;
 				ENABLE_HARDENED_RUNTIME = YES;
 				ENABLE_PREVIEWS = YES;
-				ENABLE_USER_SELECTED_FILES = readonly;
 				GENERATE_INFOPLIST_FILE = YES;
 				INFOPLIST_KEY_NSHumanReadableCopyright = "";
 				LD_RUNPATH_SEARCH_PATHS = (
 					"$(inherited)",
 					"@executable_path/../Frameworks",
 				);
+				MACOSX_DEPLOYMENT_TARGET = 15.0;
 				MARKETING_VERSION = 1.0;
 				PRODUCT_BUNDLE_IDENTIFIER = com.signerlabs.Klee;
 				PRODUCT_NAME = "$(TARGET_NAME)";
@@ -331,6 +343,30 @@
 			defaultConfigurationName = Release;
 		};
 /* End XCConfigurationList section */
+
+/* Begin XCRemoteSwiftPackageReference section */
+		9B252D1E2F5F000000000003 /* XCRemoteSwiftPackageReference "mlx-swift-lm" */ = {
+			isa = XCRemoteSwiftPackageReference;
+			repositoryURL = "https://github.com/ml-explore/mlx-swift-lm";
+			requirement = {
+				kind = upToNextMajorVersion;
+				minimumVersion = 2.30.0;
+			};
+		};
+/* End XCRemoteSwiftPackageReference section */
+
+/* Begin XCSwiftPackageProductDependency section */
+		9B252D1B2F5F000000000001 /* MLXLLM */ = {
+			isa = XCSwiftPackageProductDependency;
+			package = 9B252D1E2F5F000000000003 /* XCRemoteSwiftPackageReference "mlx-swift-lm" */;
+			productName = MLXLLM;
+		};
+		9B252D1D2F5F000000000002 /* MLXLMCommon */ = {
+			isa = XCSwiftPackageProductDependency;
+			package = 9B252D1E2F5F000000000003 /* XCRemoteSwiftPackageReference "mlx-swift-lm" */;
+			productName = MLXLMCommon;
+		};
+/* End XCSwiftPackageProductDependency section */
 	};
 	rootObject = 9B252CDC2F5EE71200DDD7B5 /* Project object */;
 }
```

**File**: `Klee.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (added, +87/-0)
```diff
@@ -0,0 +1,87 @@
+{
+  "originHash" : "facc0ac7c70363ea20f6cd1235de91dea6b06f0d00190946045a6c8ae753abc2",
+  "pins" : [
+    {
+      "identity" : "mlx-swift",
+      "kind" : "remoteSourceControl",
+      "location" : "https://github.com/ml-explore/mlx-swift",
+      "state" : {
+        "revision" : "6ba4827fb82c97d012eec9ab4b2de21f85c3b33d",
+        "version" : "0.30.6"
+      }
+    },
+    {
+      "identity" : "mlx-swift-lm",
+      "kind" : "remoteSourceControl",
+      "location" : "https://github.com/ml-explore/mlx-swift-lm",
+      "state" : {
+        "revision" : "7e19e09027923d89ac47dd087d9627f610e5a91a",
+        "version" : "2.30.6"
+      }
+    },
+    {
+      "identity" : "swift-asn1",
+      "kind" : "remoteSourceControl",
+      "location" : "https://github.com/apple/swift-asn1.git",
+      "state" : {
+        "revision" : "810496cf121e525d660cd0ea89a758740476b85f",
+        "version" : "1.5.1"
+      }
+    },
+    {
+      "identity" : "swift-collections",
+      "kind" : "remoteSourceControl",
+      "location" : "https://github.com/apple/swift-collections.git",
+      "state" : {
+        "revision" : "8d9834a6189db730f6264db7556a7ffb751e99ee",
+        "version" : "1.4.0"
+      }
+    },
+    {
+      "identity" : "swift-crypto",
+      "kind" : "remoteSourceControl",
+      "location" : "https://github.com/apple/swift-crypto.git",
+      "state" : {
+        "revision" : "6f70fa9eab24c1fd982af18c281c4525d05e3095",
+        "version" : "4.2.0"
+      }
+    },
+    {
+      "identity" : "swift-jinja",
+      "kind" : "remoteSourceControl",
+      "location" : "https://github.com/huggingface/swift-jinja.git",
+      "state" : {
+        "revision" : "f731f03bf746481d4fda07f817c3774390c4d5b9",
+        "version" : "2.3.2"
+      }
+    },
+    {
+      "identity" : "swift-numerics",
+      "kind" : "remoteSourceControl",
+      "location" : "https://github.com/apple/swift-numerics",
+      "state" : {
+        "revision" : "0c0290ff6b24942dadb83a929ffaaa1481df04a2",
+        "version" : "1.1.1"
+      }
+    },
+    {
+      "identity" : "swift-transformers",
+      "kind" : "remoteSourceControl",
+      "location" : "https://github.com/huggingface/swift-transformers",
+      "state" : {
+        "revision" : "150169bfba0889c229a2ce7494cf8949f18e6906",
+        "version" : "1.1.9"
+      }
+    },
+    {
+      "identity" : "yyjson",
+      "kind" : "remoteSourceControl",
+      "location" : "https://github.com/ibireme/yyjson.git",
+      "state" : {
+        "revision" : "8b4a38dc994a110abaec8a400615567bd996105f",
+        "version" : "0.12.0"
+      }
+    }
+  ],
+  "version" : 3
+}
```

**File**: `Klee/ContentView.swift` (modified, +42/-35)
```diff
@@ -2,76 +2,83 @@
 //  ContentView.swift
 //  Klee
 //
-//  Main container view with NavigationSplitView: ChatView + StatusView sidebar.
+//  主容器视图：NavigationSplitView 布局。
+//  侧边栏：模型管理。详情区：聊天视图。
+//  Phase 1 重构：移除 ProcessManager，使用 LLMService + ModelManager。
 //
 
 import SwiftUI
 
 struct ContentView: View {
-    @EnvironmentObject var processManager: ProcessManager
-    @EnvironmentObject var wsManager: WebSocketManager
+    @Environment(LLMService.self) var llmService
+    @Environment(ModelManager.self) var modelManager
 
     var body: some View {
         NavigationSplitView {
-            StatusView(processManager: processManager, wsManager: wsManager)
-                .navigationSplitViewColumnWidth(min: 260, ideal: 300, max: 400)
+            sidebarContent
+                .navigationSplitViewColumnWidth(min: 260, ideal: 320, max: 420)
         } detail: {
-            ChatView(wsManager: wsManager)
+            ChatView()
         }
         .navigationTitle("Klee")
         .task {
-            // K3: Auto-start services and connect WebSocket on launch
-            await processManager.startAll()
-            wsManager.connect()
+            // 启动时自动加载上次使用的模型
+            if let lastModelId = modelManager.selectedModelId,
+               modelManager.isCached(lastModelId) {
+                await llmService.loadModel(id: lastModelId)
+            }
         }
         .toolbar {
             ToolbarItem(placement: .automatic) {
-                connectionBadge
+                statusBadge
             }
         }
     }
 
-    // MARK: - Connection Badge
+    // MARK: - 侧边栏
+
+    private var sidebarContent: some View {
+        VStack(spacing: 0) {
+            ModelManagerView()
+        }
+    }
 
-    /// Small badge in the toolbar showing overall health.
-    private var connectionBadge: some View {
+    // MARK: - 状态标识
+
+    private var statusBadge: some View {
         HStack(spacing: 4) {
             Circle()
-                .fill(overallStatusColor)
+                .fill(statusColor)
                 .frame(width: 8, height: 8)
-            Text(overallStatusLabel)
+            Text(statusLabel)
                 .font(.caption)
                 .foregroundStyle(.secondary)
         }
     }
 
-    private var overallStatusColor: Color {
-        if processManager.ollamaState.isRunning && processManager.openclawState.isRunning {
-            return wsManager.connectionState == .connected ? .green : .orange
-        }
-        if case .error = processManager.ollamaState { return .red }
-        if case .error = processManager.openclawState { return .red }
-        if processManager.ollamaState == .starting || processManager.openclawState == .starting {
-            return .orange
+    private var statusColor: Color {
+        switch llmService.state {
+        case .ready:        return .green
+        case .generating:   return .green
+        case .loading:      return .orange
+        case .error:        return .red
+        case .idle:         return .gray
         }
-        return .gray
     }
 
-    private var overallStatusLabel: String {
-        if processManager.ollamaState.isRunning && processManager.openclawState.isRunning {
-            return wsManager.connectionState == .connected ? "Ready" : "Connecting..."
-        }
-        if processManager.ollamaState == .starting || processManager.openclawState == .starting {
-            return "Starting..."
+    private var statusLabel: String {
+        switch llmService.state {
+        case .ready:        return "Ready"
+        case .generating:   return "Generating"
+        case .loading:      return "Loading..."
+        case .error:        return "Error"
+        case .idle:         return "Not Loaded"
         }
-        if case .error = processManager.ollamaState { return "Error" }
-        if case .error = processManager.openclawState { return "Error" }
-        return "Stopped"
     }
 }
 
 #Preview {
     ContentView()
-        .environmentObject(ProcessManager())
-        .environmentObject(WebSocketManager(port: 18789, token: "preview"))
+        .environment(LLMService())
+        .environment(ModelManager())
 }
```

**File**: `Klee/KleeApp.swift` (modified, +14/-29)
```diff
@@ -2,48 +2,33 @@
 //  KleeApp.swift
 //  Klee
 //
-//  App entry point. Initializes ProcessManager (which owns WebSocketManager),
-//  handles graceful shutdown on app termination.
+//  应用入口。注入 LLMService 和 ModelManager 作为环境对象。
+//  Phase 1 重构：移除 ProcessManager 和 AppDelegate（不再需要子进程管理）。
 //
 
 import SwiftUI
 
 @main
 struct KleeApp: App {
-    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
-    @StateObject private var processManager = ProcessManager()
+    @State private var llmService = LLMService()
+    @State private var modelManager = ModelManager()
+
+    init() {
+        // 国内用户默认启用 HuggingFace 镜像加速
+        // 后续可在设置界面让用户切换
+        LLMService.huggingFaceMirror = "https://hf-mirror.com"
+    }
 
     var body: some Scene {
         WindowGroup {
             ContentView()
-                .environmentObject(processManager)
-                .environmentObject(processManager.wsManager)
-                .onAppear {
-                    appDelegate.processManager = processManager
-                }
+                .environment(llmService)
+                .environment(modelManager)
         }
-        .defaultSize(width: 900, height: 600)
+        .defaultSize(width: 960, height: 640)
         .commands {
-            // Remove the default "New Window" command — single-window app
+            // 单窗口应用，移除默认的「新建窗口」命令
             CommandGroup(replacing: .newItem) {}
         }
     }
 }
-
-// MARK: - App Delegate for Graceful Shutdown
-
-@MainActor
-final class AppDelegate: NSObject, NSApplicationDelegate {
-    var processManager: ProcessManager?
-
-    /// Called when user quits the app (Cmd+Q, menu, etc.).
-    /// Returns .terminateLater to allow async cleanup before exit.
-    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
-        Task { @MainActor in
-            processManager?.wsManager.disconnect()
-            await processManager?.shutdownAll()
-            NSApplication.shared.reply(toApplicationShouldTerminate: true)
-        }
-        return .terminateLater
-    }
-}
```

**File**: `Klee/Model/AppState.swift` (modified, +54/-52)
```diff
@@ -2,37 +2,59 @@
 //  AppState.swift
 //  Klee
 //
-//  State enums and data models for Klee app.
+//  状态枚举与数据模型。
+//  Phase 1 重构：移除进程管理相关类型，新增 MLX 推理层模型。
 //
 
 import Foundation
 
-// MARK: - Process State
+// MARK: - LLM 状态
 
-/// Lifecycle state for a managed subprocess (Ollama / OpenClaw).
-enum ProcessState: Equatable {
-    case stopped
-    case starting
-    case running
-    case error(String)
+/// LLM 推理引擎的运行状态
+enum LLMState: Equatable {
+    case idle           // 未加载模型
+    case loading        // 正在加载模型（下载/读取缓存）
+    case ready          // 模型已加载，等待输入
+    case generating     // 正在流式生成
+    case error(String)  // 发生错误
 
     var label: String {
         switch self {
-        case .stopped:  return "Stopped"
-        case .starting: return "Starting"
-        case .running:  return "Running"
-        case .error(let msg): return "Error: \(msg)"
+        case .idle:             return "Not Loaded"
+        case .loading:          return "Loading..."
+        case .ready:            return "Ready"
+        case .generating:       return "Generating..."
+        case .error(let msg):   return "Error: \(msg)"
         }
     }
 
-    var isRunning: Bool {
-        self == .running
+    var isReady: Bool {
+        self == .ready || self == .generating
     }
 }
 
-// MARK: - Chat Message
+// MARK: - 模型信息
+
+/// 描述一个可用的 MLX 模型
+struct ModelInfo: Identifiable, Equatable, Hashable {
+    /// HuggingFace 模型 ID（如 "mlx-community/Qwen3-4B-4bit"）
+    let id: String
+    /// 用户友好的显示名
+    let name: String
+    /// 预估模型文件大小（如 "~2.5 GB"）
+    let size: String
+    /// 运行此模型所需的最低系统内存（GB）
+    let minRAM: Int
+
+    /// 以内存要求生成描述标签
+    var ramLabel: String {
+        "Requires \(minRAM)GB+ RAM"
+    }
+}
+
+// MARK: - 聊天消息
 
-/// A single chat message displayed in the conversation.
+/// 对话中的单条消息
 struct ChatMessage: Identifiable, Equatable {
     let id: UUID
     let role: Role
@@ -53,47 +75,27 @@ struct ChatMessage: Identifiable, Equatable {
     }
 }
 
-// MARK: - Agent Activity
-
-/// Indicates what the AI agent is currently doing.
-enum AgentActivity: Equatable {
-    case idle
-    case thinking
-    case executing(String)   // tool name or description
-    case done
-}
-
-// MARK: - WebSocket Connection State
-
-enum WSConnectionState: Equatable {
-    case disconnected
-    case connecting
-    case connected
-    case reconnecting(attempt: Int)
-    case failed(String)
-}
-
-// MARK: - App Errors
+// MARK: - 应用错误
 
 enum AppError: LocalizedError {
-    case ollamaStartTimeout
-    case openclawStartTimeout
-    case processLaunchFailed(String)
-    case portInUse(Int)
-    case webSocketConnectionFailed(String)
+    case modelLoadFailed(String)
+    case generationFailed(String)
+    case modelNotLoaded
+    case downloadFailed(String)
+    case insufficientMemory(required: Int, available: Int)
 
     var errorDescription: String? {
         switch self {
-        case .ollamaStartTimeout:
-            return "Ollama failed to start within the timeout period."
-        case .openclawStartTimeout:
-            return "OpenClaw Gateway failed to start within the timeout period."
-        case .processLaunchFailed(let detail):
-            return "Process launch failed: \(detail)"
-        case .portInUse(let port):
-            return "Port \(port) is already in use by another process."
-        case .webSocketConnectionFailed(let detail):
-            return "WebSocket connection failed: \(detail)"
+        case .modelLoadFailed(let detail):
+            return "Failed to load model: \(detail)"
+        case .generationFailed(let detail):
+            return "Generation failed: \(detail)"
+        case .modelNotLoaded:
+            return "No model loaded. Please select and download a model first."
+        case .downloadFailed(let detail):
+            return "Model download failed: \(detail)"
+        case .insufficientMemory(let required, let available):
+            return "Insufficient memory: this model requires \(required)GB, but only \(available)GB available."
         }
     }
 }
```

**File**: `Klee/Service/LLMService.swift` (added, +199/-0)
```diff
@@ -0,0 +1,199 @@
+//
+//  LLMService.swift
+//  Klee
+//
+//  MLX Swift 进程内推理服务。
+//  替代 OllamaService，直接使用 mlx-swift-lm 进行本地模型加载和流式生成。
+//
+
+import Foundation
+import Observation
+import MLXLLM
+@preconcurrency import MLXLMCommon
+
+@Observable
+class LLMService {
+
+    // MARK: - 可观察属性
+
+    /// 当前 LLM 引擎状态
+    private(set) var state: LLMState = .idle
+
+    /// 当前已加载模型的 ID
+    private(set) var currentModelId: String?
+
+    /// 最近一次错误信息
+    private(set) var error: String?
+
+    /// 模型下载/加载进度（0.0 ~ 1.0）
+    private(set) var loadProgress: Double?
+
+    /// 加载状态描述文字
+    private(set) var loadingStatus: String?
+
+    /// 当前生成的 token/s 速度
+    private(set) var tokensPerSecond: Double = 0
+
+    // MARK: - 私有属性
+
+    /// 已加载的模型容器
+    private var modelContainer: ModelContainer?
+
+    /// 当前生成任务（用于取消）
+    private var generationTask: Task<Void, Never>?
+
+    /// HuggingFace 镜像地址（国内加速）
+    /// 设置后所有模型下载走镜像，设为 nil 恢复官方源
+    static var huggingFaceMirror: String? {
+        didSet {
+            if let mirror = huggingFaceMirror {
+                setenv("HF_ENDPOINT", mirror, 1)
+            } else {
+                unsetenv("HF_ENDPOINT")
+            }
+        }
+    }
+
+    // MARK: - 模型加载
+
+    /// 加载指定模型（从 HuggingFace 下载或读取本地缓存）
+    /// - Parameter id: HuggingFace 模型 ID，如 "mlx-community/Qwen3-4B-4bit"
+    func loadModel(id: String) async {
+        // 如果当前已加载同一模型，无需重复加载
+        if currentModelId == id, modelContainer != nil, state == .ready {
+            return
+        }
+
+        state = .loading
+        error = nil
+        loadProgress = 0
+        loadingStatus = "Preparing model..."
+
+        do {
+            let configuration = ModelConfiguration(id: id)
+
+            // loadContainer 自动处理下载（含断点续传）和加载
+            loadingStatus = "Downloading and loading model..."
+            let container = try await LLMModelFactory.shared.loadContainer(
+                configuration: configuration
+            ) { progress in
+                let fraction = progress.fractionCompleted
+                let total = progress.totalUnitCount
+                Task { @MainActor [weak self] in
+                    self?.loadProgress = fraction
+                    if total > 0 {
+                        self?.loadingStatus = "Loading (\(Int(fraction * 100))%)"
+                    }
+                }
+            }
+
+            modelContainer = container
+            currentModelId = id
+            state = .ready
+            loadProgress = nil
+            loadingStatus = nil
+
+            // 持久化上次使用的模型 ID
+            UserDefaults.standard.set(id, forKey: "lastUsedModelId")
+
+        } catch {
+            self.state = .error(error.localizedDescription)
+            self.error = error.localizedDescription
+            self.loadProgress = nil
+            self.loadingStatus = nil
+        }
+    }
+
+    // MARK: - 流式聊天
+
+    /// 发送聊天消息，返回流式 token 输出
+    /// - Parameter messages: 完整的对话历史
+    /// - Returns: 异步字符串流，每个元素是一个 token 片段
+    func chat(messages: [ChatMessage]) -> AsyncStream<String> {
+        AsyncStream { continuation in
+            generationTask = Task { [weak self] in
+                guard let self, let container = self.modelContainer else {
+                    continuation.finish()
+                    return
+                }
+
+                self.state = .generating
+                self.tokensPerSecond = 0
+
+                do {
+                    // 构建 MLX Chat.Message 数组
+                    let chatMessages: [Chat.Message] = messages.map { msg in
+                        switch msg.role {
+                        case .user: .user(msg.content)
+                        case .assistant: .assistant(msg.content)
+                        case .system: .system(msg.content)
+                        }
+                    }
+
+                    let userInput = UserInput(chat: chatMessages)
+
+                    // 准备输入（UserInput → LMInput）
+                    let lmInput = try await container.prepare(input: userInput)
+
+                    // 生成参数
+                    let parameters = GenerateParameters(temperature: 0.7)
+
+                    // 使用 AsyncStream 版本的 generate API
+                    let generateStream = try await container.generate(
+                        input: lmInput,
+                        parameters: parameters
+                    )
+
+                    var tokenCount = 0
+                    let startTime = Date()
+
+                    for await result in generateStream {
+                        if Task.isCancelled { break }
+
+                        // result 包含生成的文本片段
+                        if let text = result.chunk {
+                            continuation.yield(text)
+                            tokenCount += 1
+                        }
+                    }
+
+                    // 计算 tok/s
+                    let elapsed = Date().timeIntervalSince(startTime)
+                    if elapsed > 0 {
+                
```

---

### Incident Patch 7: `d8b6a193` (2026-03-09)
**Commit Message**: Rewrite Klee as native SwiftUI macOS app

Replace the Electron-based architecture with a native SwiftUI app
that bundles Ollama + OpenClaw Gateway as managed subprocesses.

Key components:
- ProcessManager: Ollama/OpenClaw lifecycle, port isolation, watchdog
- WebSocketManager: Gateway communication with auto-reconnect
- ChatView: Streaming chat interface with agent activity indicator
- StatusView: Service status panel with real-time logs

Old Electron codebase preserved in Archive/ for reference.

Co-Authored-By: Claude Opus 4.6 <[REDACTED_EMAIL]>

**File**: `Archive/.env.example` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+# Apple Developer Configuration (for macOS builds)
+APPLE_ID=your_apple_id@example.com
+APPLE_APP_SPECIFIC_PASSWORD=your_app_specific_password_here
+APPLE_TEAM_ID=your_team_id_here
+
+# Code Signing Configuration (optional)
+# If you need to override the certificate name, uncomment and fill in:
+# CSC_NAME=Your Company Name (TEAM_ID)
+CODESIGN_IDENTITY="Developer ID Application: Your Company Name (TEAM_ID)"
```

**File**: `Archive/.gitattributes` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+# Auto detect text files and perform LF normalization
+* text=auto
```

**File**: `Archive/.gitignore` (added, +75/-0)
```diff
@@ -0,0 +1,75 @@
+# Logs
+logs
+*.log
+npm-debug.log*
+yarn-debug.log*
+yarn-error.log*
+pnpm-debug.log*
+lerna-debug.log*
+
+node_modules
+dist
+dist-ssr
+dist-electron
+release
+*.local
+CLAUDE.md
+package-lock.json
+
+.codex
+.specify
+
+# Editor directories and files
+.vscode/.debug.env
+.vscode/.debug.script.mjs
+.claude/
+.idea
+.DS_Store
+*.suo
+*.ntvs*
+*.njsproj
+*.sln
+*.sw?
+
+#lockfile
+# package-lock.json is needed for npm workspaces
+pnpm-lock.yaml
+yarn.lock
+/test/
+/test-results/
+/playwright-report/
+/playwright/.cache/
+
+CLAUDE.md
+
+# Environment files (keep .env.example files)
+.env
+.env.local
+.env.*.local
+server/.env
+client/.env
+!.env.example
+!server/.env.example
+!client/.env.example
+!server/.env.production.template
+
+# Private Mode data (user-specific, not to be committed)
+*.db
+*.db-shm
+*.db-wal
+vector-db/
+
+# Ollama binaries and models (downloaded at runtime)
+ollama/
+client/resources/ollama/
+
+# Test coverage
+coverage/
+.nyc_output/
+
+# Vitest
+.vitest/
+
+
+# Authentication tokens
+.npmrc
```

**File**: `Archive/.npmrc.example` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+legacy-peer-deps=true
+
+# Tiptap Pro Registry
+# Get your token from https://cloud.tiptap.dev/
+@tiptap-pro:registry=https://registry.tiptap.dev/
+//registry.tiptap.dev/:_authToken=YOUR_TIPTAP_PRO_TOKEN_HERE
```

**File**: `Archive/.vscode/extensions.json` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+{
+  // See http://go.microsoft.com/fwlink/?LinkId=827846
+  // for the documentation about the extensions.json format
+  "recommendations": [
+    "mrmlnc.vscode-json5"
+  ]
+}
```

**File**: `Archive/.vscode/launch.json` (added, +54/-0)
```diff
@@ -0,0 +1,54 @@
+{
+  // Use IntelliSense to learn about possible attributes.
+  // Hover to view descriptions of existing attributes.
+  // For more information, visit: https://go.microsoft.com/fwlink/?linkid=830387
+  "version": "0.2.0",
+  "compounds": [
+    {
+      "name": "Debug App",
+      "preLaunchTask": "Before Debug",
+      "configurations": [
+        "Debug Main Process",
+        "Debug Renderer Process"
+      ],
+      "presentation": {
+        "hidden": false,
+        "group": "",
+        "order": 1
+      },
+      "stopAll": true
+    }
+  ],
+  "configurations": [
+    {
+      "name": "Debug Main Process",
+      "type": "node",
+      "request": "launch",
+      "runtimeExecutable": "${workspaceRoot}/node_modules/.bin/electron",
+      "windows": {
+        "runtimeExecutable": "${workspaceRoot}/node_modules/.bin/electron.cmd"
+      },
+      "runtimeArgs": [
+        "--no-sandbox",
+        "--remote-debugging-port=9229",
+        "."
+      ],
+      "envFile": "${workspaceFolder}/.vscode/.debug.env",
+      "console": "integratedTerminal"
+    },
+    {
+      "name": "Debug Renderer Process",
+      "port": 9229,
+      "request": "attach",
+      "type": "chrome",
+      "timeout": 60000,
+      "skipFiles": [
+        "<node_internals>/**",
+        "${workspaceRoot}/node_modules/**",
+        "${workspaceRoot}/dist-electron/**",
+        // Skip files in host(VITE_DEV_SERVER_URL)
+        "http://127.0.0.1:7777/**"
+      ]
+    },
+  ]
+}
\ No newline at end of file
```

**File**: `Archive/.vscode/settings.json` (added, +110/-0)
```diff
@@ -0,0 +1,110 @@
+{
+  // TypeScript 配置
+  "typescript.tsdk": "node_modules/typescript/lib",
+  "typescript.tsc.autoDetect": "off",
+
+  // JSON Schema 配置
+  "json.schemas": [
+    {
+      "fileMatch": ["/*electron-builder.json5", "/*electron-builder.json"],
+      "url": "https://json.schemastore.org/electron-builder"
+    }
+  ],
+
+  // 编辑器配置
+  "editor.formatOnSave": true,
+  "editor.codeActionsOnSave": {
+    "source.fixAll": "explicit"
+  },
+
+  // 默认格式化器配置
+  "editor.defaultFormatter": "esbenp.prettier-vscode",
+
+  // 特定语言格式化器配置
+  "[javascript]": {
+    "editor.defaultFormatter": "esbenp.prettier-vscode"
+  },
+  "[typescript]": {
+    "editor.defaultFormatter": "esbenp.prettier-vscode"
+  },
+  "[typescriptreact]": {
+    "editor.defaultFormatter": "esbenp.prettier-vscode"
+  },
+  "[javascriptreact]": {
+    "editor.defaultFormatter": "esbenp.prettier-vscode"
+  },
+  "[json]": {
+    "editor.defaultFormatter": "esbenp.prettier-vscode"
+  },
+  "[jsonc]": {
+    "editor.defaultFormatter": "esbenp.prettier-vscode"
+  },
+  "[html]": {
+    "editor.defaultFormatter": "esbenp.prettier-vscode"
+  },
+  "[css]": {
+    "editor.defaultFormatter": "esbenp.prettier-vscode"
+  },
+  "[scss]": {
+    "editor.defaultFormatter": "esbenp.prettier-vscode"
+  },
+  "[markdown]": {
+    "editor.defaultFormatter": "esbenp.prettier-vscode"
+  },
+  "[yaml]": {
+    "editor.defaultFormatter": "esbenp.prettier-vscode"
+  },
+
+  // CSS/SCSS Lint 配置 - 忽略 Tailwind 指令警告
+  "css.lint.unknownAtRules": "ignore",
+  "scss.lint.unknownAtRules": "ignore",
+
+  // Tailwind CSS IntelliSense 配置
+  "tailwindCSS.includeLanguages": {
+    "html": "html",
+    "javascript": "javascript",
+    "typescript": "typescript",
+    "javascriptreact": "javascriptreact",
+    "typescriptreact": "typescriptreact"
+  },
+  "tailwindCSS.emmetCompletions": true,
+
+  // 文件关联
+  "files.associations": {
+    "*.css": "tailwindcss"
+  },
+
+  // 排除文件
+  "files.exclude": {
+    "**/.git": true,
+    "**/.DS_Store": true,
+    "**/node_modules": true,
+    "dist": true,
+    "dist-electron": true
+  },
+
+  // 搜索排除
+  "search.exclude": {
+    "**/node_modules": true,
+    "**/dist": true,
+    "**/dist-electron": true,
+    "**/*.code-search": true
+  },
+  "cSpell.words": [
+    "AXNWILY",
+    "Blbk",
+    "EYHWQ",
+    "Hmsz",
+    "Lcuz",
+    "LHUB",
+    "pooler",
+    "querry",
+    "Rjtzn",
+    "RVXD",
+    "tawtln",
+    "Xecoe",
+    "XVCJ",
+    "YWFE",
+    "zrtckgjmkrttadrjviws"
+  ]
+}
```

**File**: `Archive/.vscode/tasks.json` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+{
+  // See https://go.microsoft.com/fwlink/?LinkId=733558
+  // for the documentation about the tasks.json format
+  "version": "2.0.0",
+  "tasks": [
+    {
+      "label": "Before Debug",
+      "type": "shell",
+      "command": "node .vscode/.debug.script.mjs",
+      "isBackground": true,
+      "problemMatcher": {
+        "owner": "typescript",
+        "fileLocation": "relative",
+        "pattern": {
+          // TODO: correct "regexp"
+          "regexp": "^([a-zA-Z]\\:\/?([\\w\\-]\/?)+\\.\\w+):(\\d+):(\\d+): (ERROR|WARNING)\\: (.*)$",
+          "file": 1,
+          "line": 3,
+          "column": 4,
+          "code": 5,
+          "message": 6
+        },
+        "background": {
+          "activeOnStart": true,
+          "beginsPattern": "^.*VITE v.*  ready in \\d* ms.*$",
+          "endsPattern": "^.*\\[startup\\] Electron App.*$"
+        }
+      }
+    }
+  ]
+}
```

#### Recent Merged Pull Requests:
- **PR #34** (2025-10-31): v2.0 (@w-zhong)
- **PR #33** (closed): feat: optimize output display (@xiaoxiao-fc)
- **PR #27** (2025-03-17): Dev (@ericsigner)
- **PR #19** (2025-03-14): chore: update parse.ts (@eltociear)
- **PR #10** (2025-03-06): release: 1.5.0 (@ericsigner)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
