# Forensic Learning Record (Deep Inspection): github/CopilotForXcode

> **Canonical Artifact**: `07_PROJECT_LEARNING/github-copilotforxcode-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/github/CopilotForXcode](https://github.com/github/CopilotForXcode))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:29:34.496Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `github/CopilotForXcode`
- **Description**: AI coding assistant for Xcode
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 6315 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Core/Package.swift`
```
// swift-tools-version: 5.7
// The swift-tools-version declares the minimum version of Swift required to build this package.

import Foundation
import PackageDescription

// MARK: - Package

let package = Package(
    name: "Core",
    platforms: [.macOS(.v13)],
    products: [
        .library(
            name: "Service",
            targets: [
                "Service",
                "SuggestionInjector",
                "FileChangeChecker",
                "LaunchAgentManager",
                "UpdateChecker",
            ]
        ),
        .library(
            name: "Client",
            targets: [
                "Client",
            ]
        ),
        .library(
            name: "HostApp",
            targets: [
                "HostApp",
                "Client",
                "LaunchAgentManager",
                "UpdateChecker",
                "GitHubCopilotViewModel",
            ]
        ),
    ],
    dependencies: [
        .package(path: "../Tool"),
        .package(url: "https://github.com/apple/swift-async-algorithms", from: "1.0.0"),
        .package(url: "https://github.com/gonzalezreal/swift-markdown-ui", from: "2.4.0"),
        .package(url: "https://github.com/sparkle-project/Sparkle", from: "2.0.0"),
        .package(url: "https://github.com/pointfreeco/swift-parsing", from: "0.12.1"),
        .package(url: "https://github.com/pointfreeco/swift-dependencies", from: "1.0.0"),
        .package(
            url: "https://github.com/pointfreeco/swift-composable-architecture",
            from: "1.10.4"
        ),
        // quick hack to support custom UserDefaults
        // https://github.com/sindresorhus/KeyboardShortcuts
            .package(url: "https://github.com/devm33/KeyboardShortcuts", branch: "main"),
        .package(url: "https://github.com/devm33/CGEventOverride", branch: "devm33/fix-stale-AXIsProcessTrusted"),
        .package(url: "https://github.com/devm33/Highlightr", branch: "master"),
        .package(url: "https://github.com/globulus/swiftui-flow-layout", from: "1.0.5"),
        .package(url: "https://github.com/tree-sitter/swift-tree-sitter.git", from: "0.25.0"),
        .package(url: "https://github.com/tree-sitter/tree-sitter-bash", from: "0.25.1")
    ],
    targets: [
        // MARK: - Main
        
        .target(
            name: "Client",
            dependencies: [
                .product(name: "XPCShared", package: "Tool"),
                .product(name: "SuggestionProvider", package: "Tool"),
                .product(name: "SuggestionBasic", package: "Tool"),
                .product(name: "Logger", package: "Tool"),
                .product(name: "Preferences", package: "Tool"),
                .product(name: "GitHubCopilotService", package: "Tool"),
            ]),
        .target(
            name: "Service",
            dependencies: [
                "SuggestionWidget",
                "SuggestionService",
                "SuggestionInjector",
                "ChatService",
                "PromptToCodeService",
                "ConversationTab",
                "KeyBindingManager",
                "XcodeThemeController",
                .product(name: "TelemetryService", package: "Tool"),
                .product(name: "XPCShared", package: "Tool"),
                .product(name: "SuggestionProvider", package: "Tool"),
                .product(name: "ConversationServiceProvider", package: "Tool"),
                .product(name: "Workspace", package: "Tool"),
                .product(name: "UserDefaultsObserver", package: "Tool"),
                .product(name: "AppMonitoring", package: "Tool"),
                .product(name: "SuggestionBasic", package: "Tool"),
                .product(name: "Status", package: "Tool"),
                .product(name: "StatusBarItemView", package: "Tool"),
                .product(name: "ChatTab", package: "Tool"),
                .product(name: "Logger", package: "Tool"),
                .product(name: "ChatAPIService", package: "Tool"),
                .product(name: "Preferences", package: "Tool"),
                .product(name: "AXHelper", package: "Tool"),
                .product(name: "WorkspaceSuggestionService", package: "Tool"),
                .product(name: "AsyncAlgorithms", package: "swift-async-algorithms"),
                .product(name: "ComposableArchitecture", package: "swift-composable-architecture"),
                .product(name: "Dependencies", package: "swift-dependencies"),
                .product(name: "KeyboardShortcuts", package: "KeyboardShortcuts"),
            ]),
        .testTarget(
            name: "ServiceTests",
            dependencies: [
                "Service",
                "Client",
                "SuggestionInjector",
                .product(name: "XPCShared", package: "Tool"),
                .product(name: "SuggestionProvider", package: "Tool"),
                .product(name: "SuggestionBasic", package: "Tool"),
                .product(name: "Preferences", package: "Tool"),
                .product(name: "ConversationServiceProvider", package: "Tool"),
            ]
        ),
        
        // MARK: - Host App
        
            .target(
                name: "HostApp",
                dependencies: [
                    "Client",
                    "LaunchAgentManager",
                    "GitHubCopilotViewModel",
                    "UpdateChecker",
                    .product(name: "SuggestionProvider", package: "Tool"),
                    .product(name: "Toast", package: "Tool"),
                    .product(name: "SharedUIComponents", package: "Tool"),
                    .product(name: "SuggestionBasic", package: "Tool"),
                    .product(name: "MarkdownUI", package: "swift-markdown-ui"),
                    .product(name: "ChatAPIService", package: "Tool"),
                    .product(name: "Preferences", package: "Tool"),
                    .product(name: "ComposableArchitecture", package: "swift-composable-architecture"),
                    .product(name: "KeyboardShortcuts", package: "KeyboardShortcuts"),
                    .product(name: "GitHubCopilotService", package: "Tool"),
                    .product(name: "Persist", package: "Tool"),
                    .product(name: "UserDefaultsObserver", package: "Tool"),
                ]),
        
        // MARK: - Suggestion Service
        
            .target(
                name: "SuggestionService",
                dependencies: [
                    .product(name: "UserDefaultsObserver", package: "Tool"),
                    .product(name: "Preferences", package: "Tool"),
                    .product(name: "SuggestionBasic", package: "Tool"),
                    .product(name: "SuggestionProvider", package: "Tool"),
                    .product(name: "BuiltinExtension", package: "Tool"),
                    .product(name: "GitHubCopilotService", package: "Tool"),
                ]),
        .target(
            name: "SuggestionInjector",
            dependencies: [.product(name: "SuggestionBasic", package: "Tool")]
        ),
        .testTarget(
            name: "SuggestionInjectorTests",
            dependencies: ["SuggestionInjector"]
        ),
        
        // MARK: - Prompt To Code
        
            .target(
                name: "PromptToCodeService",
                dependencies: [
                    .product(name: "SuggestionBasic", package: "Tool"),
                    .product(name: "ChatAPIService", package: "Tool"),
                    .product(name: "AppMonitoring", package: "Tool"),
                    .product(name: "ComposableArchitecture", package: "swift-composable-architecture"),
                ]),
        
        // MARK: - Chat
        
            .target(
                name: "ChatService",
                dependencies: [
                    "PersistMiddleware",
                    .product(name: "AppMonitoring", package: "Tool"),
                    .product(name: "Parsing", package: "swift-parsing"),
                    .product(name: "ChatAPIService", package: "Tool"),
                    .product(name: "Preferences", package: "Tool"),
                    .product(name: "AXHelper", package: "Tool"),
                    .product(name: "ConversationServiceProvider", package: "Tool"),
                    .product(name: "GitHubCopilotService", package: "Tool"),
                    .product(name: "Workspace", package: "Tool"),
                    .product(name: "Terminal", package: "Tool"),
                    .product(name: "SystemUtils", package: "Tool"),
                    .product(name: "AppKitExtension", package: "Tool"),
                    .product(name: "WebContentExtractor", package: "Tool"),
                    .product(name: "GitHelper", package: "Tool"),
                    .product(name: "SuggestionBasic", package: "Tool"),
                    .product(name: "SwiftTreeSitter", package: "swift-tree-sitter"),
                    .product(name: "SwiftTreeSitterLayer", package: "swift-tree-sitter"),
                    .product(name: "TreeSitterBash", package: "tree-sitter-bash"),
                ]),
            .testTarget(
                name: "ChatServiceTests",
                dependencies: ["ChatService"]
            ),

            .target(
                name: "ConversationTab",
                dependencies: [
                    "ChatService",
                    "GitHubCopilotViewModel",
                    .product(name: "SharedUIComponents", package: "Tool"),
                    .product(name: "ChatAPIService", package: "Tool"),
                    .product(name: "Logger", package: "Tool"),
                    .product(name: "ChatTab", package: "Tool"),
                    .product(name: "Terminal", package: "Tool"),
                    .product(name: "Cache", package: "Tool"),
                    .product(name: "MarkdownUI", package: "swift-markdown-ui"),
                    .product(name: "ComposableArchi
```

### Core Architecture Module: `Core/Sources/ChatService/ChatInjector.swift`
```
import SuggestionBasic
import AppKit
import XcodeInspector
import AXHelper
import ApplicationServices
import AppActivator
import LanguageServerProtocol

public struct ChatInjector {
    public init() {}
    
    public func insertCodeBlock(codeBlock: String) {
        do {
            guard let editorContent = XcodeInspector.shared.focusedEditor?.getContent(),
                  let focusElement = XcodeInspector.shared.focusedElement,
                  focusElement.description == "Source Editor"
            else { return }
            
            var cursorPosition = editorContent.cursorPosition
            guard cursorPosition.line >= 0, cursorPosition.character >= 0 else { return }
            
            var lines = editorContent.content.splitByNewLine(
                omittingEmptySubsequences: false
            ).map { String($0) }
            
            guard cursorPosition.line <= lines.count else { return }
            
            var modifications: [Modification] = []
            
            // Handle selection deletion
            if let selection = editorContent.selections.first,
               selection.isValid,
               selection.start.line < lines.endIndex {
                let selectionEndLine = min(selection.end.line, lines.count - 1)
                let deletedSelection = CursorRange(
                    start: selection.start,
                    end: .init(line: selectionEndLine, character: selection.end.character)
                )
                modifications.append(.deletedSelection(deletedSelection))
                lines = lines.applying([.deletedSelection(deletedSelection)])
                cursorPosition = selection.start
            }
            
            let insertionRange = CursorRange(
                start: cursorPosition,
                end: cursorPosition
            )
            
            try Self.performInsertion(
                content: codeBlock,
                range: insertionRange,
                lines: &lines,
                modifications: &modifications,
                focusElement: focusElement
            )
            
        } catch {
            print("Failed to insert code block: \(error)")
        }
    }
    
    public static func insertSuggestion(suggestion: String, range: CursorRange, lines: [String]) {
        do {
            guard let focusElement = XcodeInspector.shared.focusedElement,
                  focusElement.description == "Source Editor"
            else { return }

            guard range.start.line >= 0,
                  range.start.line < lines.count,
                  range.end.line >= 0,
                  range.end.line < lines.count
            else { return }
            
            var lines = lines
            var modifications: [Modification] = []
            
            if range.isValid {
                modifications.append(.deletedSelection(range))
                lines = lines.applying([.deletedSelection(range)])
            }
            
            try performInsertion(
                content: suggestion,
                range: range,
                lines: &lines,
                modifications: &modifications,
                focusElement: focusElement
            )
            
        } catch {
            print("Failed to insert suggestion: \(error)")
        }
    }
    
    private static func performInsertion(
        content: String,
        range: CursorRange,
        lines: inout [String],
        modifications: inout [Modification],
        focusElement: AXUIElement
    ) throws {
        let targetLine = lines[range.start.line]
        let leadingWhitespace = range.start.character > 0 ? targetLine.prefix { $0.isWhitespace } : ""
        let indentation = String(leadingWhitespace)
        
        let index = targetLine.index(targetLine.startIndex, offsetBy: min(range.start.character, targetLine.count))
        let before = targetLine[..<index]
        let after = targetLine[index...]
        
        let contentLines = content.splitByNewLine(
            omittingEmptySubsequences: false
        ).enumerated().map { (index, element) -> String in
            return index == 0 ? String(element) : indentation + String(element)
        }
        
        var toBeInsertedLines = [String]()
        if contentLines.count > 1 {
            toBeInsertedLines.append(String(before) + contentLines.first!)
            toBeInsertedLines.append(contentsOf: contentLines.dropFirst().dropLast())
            toBeInsertedLines.append(contentLines.last! + String(after))
        } else {
            toBeInsertedLines.append(String(before) + contentLines.first! + String(after))
        }
        
        lines.replaceSubrange((range.start.line)...(range.start.line), with: toBeInsertedLines)
        
        let newContent = String(lines.joined(separator: "\n"))
        let newCursorPosition = CursorPosition(
            line: range.start.line + contentLines.count - 1,
            character: contentLines.last?.count ?? 0
        )
        
        modifications.append(.inserted(range.start.line, toBeInsertedLines))
        
        try AXHelper().injectUpdatedCodeWithAccessibilityAPI(
            .init(
                content: newContent,
                newSelection: .cursor(newCursorPosition),
                modifications: modifications
            ),
            focusElement: focusElement,
            onSuccess: {
                NSWorkspace.activatePreviousActiveXcode()
            }
        )
    }
}

```

### Core Architecture Module: `Core/Sources/ChatService/ChatService.swift`
```
import ChatAPIService
import Combine
import Foundation
import GitHubCopilotService
import Preferences
import ConversationServiceProvider
import BuiltinExtension
import JSONRPC
import Status
import Persist
import PersistMiddleware
import ChatTab
import Logger
import Workspace
import XcodeInspector
import OrderedCollections
import SystemUtils
import GitHelper
import LanguageServerProtocol
import SuggestionBasic

public protocol ChatServiceType {
    var memory: ContextAwareAutoManagedChatMemory { get set }
    func send(
        _ id: String,
        content: String,
        contentImages: [ChatCompletionContentPartImage],
        contentImageReferences: [ImageReference],
        skillSet: [ConversationSkill],
        references: [ConversationAttachedReference],
        model: String?,
        modelProviderName: String?,
        reasoningEffort: String?,
        agentMode: Bool,
        customChatModeId: String?,
        userLanguage: String?,
        turnId: String?
    ) async throws
    func stopReceivingMessage() async
    func upvote(_ id: String, _ rating: ConversationRating) async
    func downvote(_ id: String, _ rating: ConversationRating) async
    func copyCode(_ id: String) async
}

struct ToolCallRequest {
    let requestId: JSONId
    let turnId: String
    let roundId: Int
    let toolCallId: String
    let completion: (AnyJSONRPCResponse) -> Void
}

struct ConversationTurnTrackingState {
    var turnParentMap: [String: String] = [:] // Maps subturn ID to parent turn ID
    var validConversationIds: Set<String> = [] // Tracks all valid conversation IDs including subagents
    
    mutating func reset() {
        turnParentMap.removeAll()
        validConversationIds.removeAll()
    }
}

public final class ChatService: ChatServiceType, ObservableObject {
    
    public var memory: ContextAwareAutoManagedChatMemory
    @Published public internal(set) var chatHistory: [ChatMessage] = []
    @Published public internal(set) var isReceivingMessage = false
    @Published public internal(set) var isSummarizingConversation = false
    @Published public internal(set) var fileEditMap: OrderedDictionary<URL, FileEdit> = [:]
    @Published public internal(set) var contextSizeInfo: ContextSizeInfo? = nil
    public internal(set) var requestType: RequestType? = nil
    public private(set) var chatTabInfo: ChatTabInfo
    private let conversationProvider: ConversationServiceProvider?
    private let conversationProgressHandler: ConversationProgressHandler
    private let compressionHandler: CompressionHandler
    private let conversationContextHandler: ConversationContextHandler = ConversationContextHandlerImpl.shared
    // sync all the files in the workspace to watch for changes.
    private let watchedFilesHandler: WatchedFilesHandler = WatchedFilesHandlerImpl.shared
    private var cancellables = Set<AnyCancellable>()
    private var activeRequestId: String?
    private(set) public var conversationId: String?
    private var skillSet: [ConversationSkill] = []
    private var lastUserRequest: ConversationRequest?
    private var isRestored: Bool = false
    private var pendingToolCallRequests: [String: ToolCallRequest] = [:]
    // Workaround: toolConfirmation request does not have parent turnId
    private var conversationTurnTracking = ConversationTurnTrackingState()

    /// Single source of truth for an in-flight streaming thinking block. Sealed when the turn ends
    /// or a non-thinking payload arrives. `clientEntryId` is stable across server delta `id` churn.
    private struct ActiveThinkingCursor {
        let clientEntryId: UUID
        let targetMessageId: String
        let originTurnId: String
    }
    private var activeThinking: ActiveThinkingCursor? = nil
    
    init(provider: any ConversationServiceProvider,
         memory: ContextAwareAutoManagedChatMemory = ContextAwareAutoManagedChatMemory(),
         conversationProgressHandler: ConversationProgressHandler = ConversationProgressHandlerImpl.shared,
         compressionHandler: CompressionHandler = CompressionHandlerImpl.shared,
         chatTabInfo: ChatTabInfo) {
        self.memory = memory
        self.conversationProvider = provider
        self.conversationProgressHandler = conversationProgressHandler
        self.compressionHandler = compressionHandler
        self.chatTabInfo = chatTabInfo
        memory.chatService = self
        
        subscribeToNotifications()
        subscribeToConversationContextRequest()
        subscribeToClientToolInvokeEvent()
        subscribeToClientToolConfirmationEvent()
    }
    
    deinit {
        Task { [weak self] in
            await self?.stopReceivingMessage()
        }
        
        // Clear all subscriptions
        cancellables.forEach { $0.cancel() }
        cancellables.removeAll()
        
        // Memory will be deallocated automatically
    }
    
    public func updateChatTabInfo(_ tabInfo: ChatTabInfo) {
        // Only isSelected need to be updated
        chatTabInfo.isSelected = tabInfo.isSelected
    }
    
    private func subscribeToNotifications() {
        memory.observeHistoryChange { [weak self] in
            Task { [weak self] in
                guard let memory = self?.memory else { return }
                self?.chatHistory = await memory.history
            }
        }
        
        conversationProgressHandler.onBegin.sink { [weak self] (token, progress) in
            self?.handleProgressBegin(token: token, progress: progress)
        }.store(in: &cancellables)
        
        conversationProgressHandler.onProgress.sink { [weak self] (token, progress) in
            self?.handleProgressReport(token: token, progress: progress)
        }.store(in: &cancellables)
        
        conversationProgressHandler.onEnd.sink { [weak self] (token, progress) in
            self?.handleProgressEnd(token: token, progress: progress)
        }.store(in: &cancellables)

        compressionHandler.onCompressionStarted.sink { [weak self] compressionConversationId in
            guard let self, self.conversationId == compressionConversationId else { return }
            self.isSummarizingConversation = true
        }.store(in: &cancellables)

        compressionHandler.onCompressionCompleted.sink { [weak self] completedNotification in
            guard let self, self.conversationId == completedNotification.conversationId else { return }
            self.isSummarizingConversation = false
            if let contextInfo = completedNotification.contextInfo {
                self.contextSizeInfo = contextInfo
            }
        }.store(in: &cancellables)
    }
    
    private func subscribeToConversationContextRequest() {
        self.conversationContextHandler.onConversationContext.sink(receiveValue: { [weak self] (request, completion) in
            guard let skills = self?.skillSet, !skills.isEmpty, request.params!.conversationId == self?.conversationId else { return }
            skills.forEach { skill in
                if (skill.applies(params: request.params!)) {
                    skill.resolveSkill(request: request, completion: completion)
                }
            }
        }).store(in: &cancellables)
    }

    private func subscribeToClientToolConfirmationEvent() {
        ClientToolHandlerImpl.shared.onClientToolConfirmationEvent.sink(receiveValue: { [weak self] (request, completion) in
            self?.handleClientToolConfirmationEvent(request: request, completion: completion)
        }).store(in: &cancellables)
    }

    private func subscribeToClientToolInvokeEvent() {
        ClientToolHandlerImpl.shared.onClientToolInvokeEvent.sink(receiveValue: { [weak self] (request, completion) in
            guard let params = request.params else { return }
            
            // Check if this conversationId is valid (main conversation or subagent conversation)
            guard let validIds = self?.conversationTurnTracking.validConversationIds, validIds.contains(params.conversationId) else {
                return
            }
            
            guard let copilotTool = CopilotToolRegistry.shared.getTool(name: params.name) else {
                completion(AnyJSONRPCResponse(id: request.id,
                                              result: JSONValue.array([
                                                  JSONValue.null,
                                                  JSONValue.hash(
                                                    [
                                                        "code": .number(-32601),
                                                        "message": .string("Tool function not found")
                                                    ])
                                              ])
                                             )
                )
                return
            }

            _ = copilotTool.invokeTool(request, completion: completion, contextProvider: self)
        }).store(in: &cancellables)
    }

    func appendToolCallHistory(turnId: String, editAgentRounds: [AgentRound], fileEdits: [FileEdit] = [], parentTurnId: String? = nil) {
        let chatTabId = self.chatTabInfo.id
        Task {
            let turnStatus: ChatMessage.TurnStatus? = {
                guard let round = editAgentRounds.first, let toolCall = round.toolCalls?.first else {
                    return nil
                }
                
                switch toolCall.status {
                case .waitForConfirmation: return .waitForConfirmation
                case .accepted, .running, .completed, .error: return .inProgress
                case .cancelled: return .cancelled
                }
            }()
            
            let message = ChatMessage(
                assistantMessageWithId: turnId,
                chatTabID: chatTabId,
                editAgentRounds: editAgentRounds,
                parentTurnId: parentTurnId,
                fileEdits: fileEdits,
                turnStatus: turnStatus
```

### Core Architecture Module: `Core/Sources/ChatService/CodeReview/CodeReviewProvider.swift`
```
import ChatAPIService
import ConversationServiceProvider
import Foundation
import Logger
import GitHelper

public struct CodeReviewServiceProvider {
    public var conversationServiceProvider: (any ConversationServiceProvider)?
}

public struct CodeReviewProvider {
    public static func invoke(
        _ request: CodeReviewRequest,
        context: CodeReviewServiceProvider
    ) async -> (fileComments: [CodeReviewResponse.FileComment], errorMessage: String?) {
        var fileComments: [CodeReviewResponse.FileComment] = []
        var errorMessage: String?
        
        do {
            if let result = try await requestReviewChanges(request.fileChange.selectedChanges, context: context) {
                for comment in result.comments {
                    guard let change = request.fileChange.selectedChanges.first(where: { $0.uri == comment.uri }) else {
                        continue
                    }
                    
                    if let index = fileComments.firstIndex(where: { $0.uri == comment.uri }) {
                        var currentFileComments = fileComments[index]
                        currentFileComments.comments.append(comment)
                        fileComments[index] = currentFileComments
                        
                    } else {
                        fileComments.append(
                            .init(uri: change.uri, originalContent: change.originalContent, comments: [comment])
                        )
                    }
                }
            }
        } catch {
            Logger.gitHubCopilot.error("Failed to review change: \(error)")
            errorMessage = "Oops, failed to review changes."
        }
        
        return (fileComments, errorMessage)
    }
    
    private static func requestReviewChanges(
        _ changes: [PRChange],
        context: CodeReviewServiceProvider
    ) async throws -> CodeReviewResult? {
        return try await context.conversationServiceProvider?
            .reviewChanges(
                changes.map {
                    .init(uri: $0.uri, path: $0.path, baseContent: $0.baseContent, headContent: $0.headContent)
                }
            )
    }
}

```

### Core Architecture Module: `Core/Sources/ChatService/CodeReview/CodeReviewService.swift`
```
import Collections
import ConversationServiceProvider
import Foundation
import LanguageServerProtocol

public struct DocumentReview: Equatable {
    public var comments: [ReviewComment]
    public let originalContent: String
}

public typealias DocumentReviewsByUri = OrderedDictionary<DocumentUri, DocumentReview>

@MainActor
public class CodeReviewService: ObservableObject {
    @Published public private(set) var documentReviews: DocumentReviewsByUri = [:]
    
    public static let shared = CodeReviewService()
    
    private init() {}
    
    public func updateComments(for uri: DocumentUri, comments: [ReviewComment], originalContent: String) {
        if var existing = documentReviews[uri] {
            existing.comments.append(contentsOf: comments)
            existing.comments = sortedComments(existing.comments)
            documentReviews[uri] = existing
        } else {
            documentReviews[uri] = .init(comments: comments, originalContent: originalContent)
        }
    }
    
    public func updateComments(_ fileComments: [CodeReviewResponse.FileComment]) {
        for fileComment in fileComments {
            updateComments(
                for: fileComment.uri,
                comments: fileComment.comments,
                originalContent: fileComment.originalContent
            )
        }
    }
    
    private func sortedComments(_ comments: [ReviewComment]) -> [ReviewComment] {
        return comments.sorted { $0.range.end.line < $1.range.end.line }
    }
    
    public func resetComments() {
        documentReviews = [:]
    }
}

```

### Core Architecture Module: `Core/Sources/ChatService/ContextAwareAutoManagedChatMemory.swift`
```
import Foundation
import ChatAPIService

public final class ContextAwareAutoManagedChatMemory: ChatMemory {
    private let memory: AutoManagedChatMemory
    weak var chatService: ChatService?

    public var history: [ChatMessage] {
        get async { await memory.history }
    }

    func observeHistoryChange(_ observer: @escaping () -> Void) {
        memory.observeHistoryChange(observer)
    }

    init() {
        memory = AutoManagedChatMemory(
            systemPrompt: ""
        )
    }
    
    deinit { }

    public func mutateHistory(_ update: (inout [ChatMessage]) -> Void) async {
        await memory.mutateHistory(update)
    }
}


```

### Core Architecture Module: `Core/Sources/ChatService/CustomCommandTemplateProcessor.swift`
```
import AppKit
import Foundation
import SuggestionBasic
import XcodeInspector

public struct CustomCommandTemplateProcessor {
    public init() {}
    
    public func process(_ text: String) async -> String {
        let info = await getEditorInformation()
        let editorContent = info.editorContent
        let updatedText = text
            .replacingOccurrences(of: "{{selected_code}}", with: """
            \(editorContent?.selectedContent.trimmingCharacters(in: .whitespacesAndNewlines) ?? "")
            """)
            .replacingOccurrences(
                of: "{{active_editor_language}}",
                with: info.language.rawValue
            )
            .replacingOccurrences(
                of: "{{active_editor_file_url}}",
                with: info.documentURL?.path ?? ""
            )
            .replacingOccurrences(
                of: "{{active_editor_file_name}}",
                with: info.documentURL?.lastPathComponent ?? ""
            )
            .replacingOccurrences(
                of: "{{clipboard}}",
                with: NSPasteboard.general.string(forType: .string) ?? ""
            )
        return updatedText
    }

    struct EditorInformation {
        let editorContent: SourceEditor.Content?
        let language: CodeLanguage
        let documentURL: URL?
    }

    func getEditorInformation() async -> EditorInformation {
        let editorContent = await XcodeInspector.shared.safe.focusedEditor?.getContent()
        let documentURL = await XcodeInspector.shared.safe.activeDocumentURL
        let language = documentURL.map(languageIdentifierFromFileURL) ?? .plaintext

        return .init(
            editorContent: editorContent,
            language: language,
            documentURL: documentURL
        )
    }
}


```

### Core Architecture Module: `Core/Sources/ChatService/Extensions/ChatService+FileEdit.swift`
```
import Foundation
import ConversationServiceProvider
import ChatAPIService

extension ChatService {
    // MARK: - File Edit
    
    public func updateFileEdits(by fileEdit: FileEdit) {
        if let existingFileEdit = self.fileEditMap[fileEdit.fileURL] {
            self.fileEditMap[fileEdit.fileURL] = .init(
                fileURL: fileEdit.fileURL,
                originalContent: existingFileEdit.originalContent,
                modifiedContent: fileEdit.modifiedContent,
                toolName: existingFileEdit.toolName
            )
        } else {
            self.fileEditMap[fileEdit.fileURL] = fileEdit
        }
    }
    
    public func undoFileEdit(for fileURL: URL) throws {
        guard var fileEdit = self.fileEditMap[fileURL],
              fileEdit.status == .none
        else { return }
        
        switch fileEdit.toolName {
        case .insertEditIntoFile:
            InsertEditIntoFileTool.applyEdit(for: fileURL, content: fileEdit.originalContent)
        case .createFile:
            try CreateFileTool.undo(for: fileURL)
        default:
            return
        }
        
        fileEdit.status = .undone
        self.fileEditMap[fileURL] = fileEdit
    }
    
    public func keepFileEdit(for fileURL: URL) {
        guard var fileEdit = self.fileEditMap[fileURL], fileEdit.status == .none
        else { return }
        
        fileEdit.status = .kept
        self.fileEditMap[fileURL] = fileEdit
    }
    
    public func resetFileEdits() {
        self.fileEditMap = [:]
    }
    
    public func discardFileEdit(for fileURL: URL) throws {
        try self.undoFileEdit(for: fileURL)
        self.fileEditMap.removeValue(forKey: fileURL)
    }
}

```

### Core Architecture Module: `Core/Sources/ChatService/Skills/ConversationSkill.swift`
```
import JSONRPC
import GitHubCopilotService

public typealias JSONRPCResponseHandler = (AnyJSONRPCResponse) -> Void

public protocol ConversationSkill {
    var id: String { get }
    func applies(params: ConversationContextParams) -> Bool
    func resolveSkill(request: ConversationContextRequest, completion: @escaping JSONRPCResponseHandler)
}

```

### Core Architecture Module: `Core/Sources/ChatService/Skills/CurrentEditorSkill.swift`
```
import ConversationServiceProvider
import Foundation
import GitHubCopilotService
import JSONRPC
import SystemUtils
import LanguageServerProtocol

public class CurrentEditorSkill: ConversationSkill {
    public static let ID = "current-editor"
    public let currentFile: ConversationFileReference
    public var id: String {
        return CurrentEditorSkill.ID
    }
    public var currentFilePath: String { currentFile.url.path }
    
    public init(
        currentFile: ConversationFileReference
    ) {
        self.currentFile = currentFile
    }

    public func applies(params: ConversationContextParams) -> Bool {
        return params.skillId == self.id
    }
    
    public static let readabilityErrorMessageProvider: FileUtils.ReadabilityErrorMessageProvider = { status in
        switch status {
        case .readable:
            return nil
        case .notFound:
            return "Copilot can’t find the current file, so it's not included."
        case .permissionDenied:
            return "Copilot can't access the current file. Enable \"Files & Folders\" access in [System Settings](x-apple.systempreferences:com.apple.preference.security?Privacy_FilesAndFolders)."
        }
    }
    
    public func resolveSkill(request: ConversationContextRequest, completion: JSONRPCResponseHandler){
        let uri: String? = self.currentFile.url.absoluteString
        let response: JSONValue
        
        if let fileSelection = currentFile.selection {
            let start = fileSelection.start
            let end = fileSelection.end
            response = .hash([
                "uri": .string(uri ?? ""),
                "selection": .hash([
                    "start": .hash(["line": .number(Double(start.line)), "character": .number(Double(start.character))]),
                    "end": .hash(["line": .number(Double(end.line)), "character": .number(Double(end.character))])
                ])
            ])
        } else {
            // No text selection - only include file URI without selection metadata
            response = .hash(["uri": .string(uri ?? "")])
        }
        
        completion(
            AnyJSONRPCResponse(
                id: request.id,
                result: JSONValue.array([response, JSONValue.null]))
        )
    }
}

```

### Core Architecture Module: `Core/Sources/ChatService/Skills/ProblemsInActiveDocumentSkill.swift`
```
import ConversationServiceProvider
import Foundation
import GitHubCopilotService
import JSONRPC
import XcodeInspector

public class ProblemsInActiveDocumentSkill: ConversationSkill {
    public static let ID = "problems-in-active-document"
    public var id: String {
        return ProblemsInActiveDocumentSkill.ID
    }

    public init() {
    }

    public func applies(params: ConversationContextParams) -> Bool {
        return params.skillId == self.id
    }

    public func resolveSkill(request: ConversationContextRequest, completion: @escaping JSONRPCResponseHandler) {
        Task {
            let editor = await XcodeInspector.shared.getFocusedEditorContent()
            let result: JSONValue = JSONValue.hash([
                "uri": JSONValue.string(editor?.documentURL.absoluteString ?? ""),
                "problems": JSONValue.array(editor?.editorContent?.lineAnnotations.map { annotation in
                    JSONValue.hash([
                        "message": JSONValue.string(annotation.message),
                        "range": JSONValue.hash([
                            "start": JSONValue.hash([
                                "line": JSONValue.number(Double(annotation.line)),
                                "character": JSONValue.number(0)
                                ]),
                            "end": JSONValue.hash([
                                "line": JSONValue.number(Double(annotation.line)),
                                "character": JSONValue.number(0)
                                ])
                            ])
                        ])
                } ?? [])
            ])

            completion(
                AnyJSONRPCResponse(id: request.id,
                                   result: JSONValue.array([
                                        result,
                                        JSONValue.null
                                   ]))
            )
        }
    }
}


```

### Core Architecture Module: `Core/Sources/ChatService/Skills/ProjectContextSkill.swift`
```
import Foundation
import Workspace
import GitHubCopilotService
import JSONRPC
import XcodeInspector

/*
 * project-context is different from others
 * 1. The CLS only request this skill once `after initialized` instead of during conversation / turn.
 * 2. After resolved skill, a file watcher needs to be start for syncing file modification to CLS
 */
public class ProjectContextSkill {
    public static let ID = "project-context"
    public static let ProgressID = "collect-project-context"
    
    public static var resolvedWorkspace: Set<String> = Set()
    
    public static func isWorkspaceResolved(_ path: String) -> Bool {
        return ProjectContextSkill.resolvedWorkspace.contains(path)
    }
    
    public init() { }
    
    /*
     * The request from CLS only contain the projectPath (a initialization paramter for CLS)
     * whereas to get files for xcode workspace, the workspacePath is needed.
     */
    public static func resolveSkill(
        request: WatchedFilesRequest,
        workspacePath: String,
        completion: JSONRPCResponseHandler
    ) {
        guard !ProjectContextSkill.isWorkspaceResolved(workspacePath) else {return }
        
        let params = request.params!
        
        guard params.workspaceFolder.uri != "/" else { return }
        
        /// build workspace URL
        let workspaceURL = URL(fileURLWithPath: workspacePath)
        /// refer to `init` in `Workspace`
        let projectURL = WorkspaceXcodeWindowInspector.extractProjectURL(
            workspaceURL: workspaceURL,
            documentURL: nil
        ) ?? workspaceURL
        
        /// ignore invalid resolve request
        guard projectURL.absoluteString == params.workspaceFolder.uri else { return }
        
        let files = WorkspaceFile.getWatchedFiles(
            workspaceURL: workspaceURL,
            projectURL: projectURL,
            excludeGitIgnoredFiles: params.excludeGitignoredFiles,
            excludeIDEIgnoredFiles: params.excludeIDEIgnoredFiles
        )
        
        let jsonResult = try? JSONEncoder().encode(["files": files])
        let jsonValue = (try? JSONDecoder().decode(JSONValue.self, from: jsonResult ?? Data())) ?? JSONValue.null
        
        completion(AnyJSONRPCResponse(id: request.id, result: jsonValue))
        
        ProjectContextSkill.resolvedWorkspace.insert(workspacePath)
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #954** (2026-10-05): **Bump github/codeql-action/init from 4.38.0 to 4.38.1**
  *Symptoms*: Bumps [github/codeql-action/init](https://github.com/github/codeql-action) from 4.38.0 to 4.38.1. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/github/codeql-action/releases">github/codeql-action/init's releases</a>.</em></p> <blockquote> <h2>v4.38.1</h2> <ul> <li>The CodeQL Action now has experimental support for CodeQL releases for which per-language bundles are available. Per-language bundles support analysis for a single language and are therefore smaller than the combined bundles that allow analysis for all supported languages. As a result, per-language bundles take up less space on disk and are faster to download. We expect to roll this change out to everyone in the coming weeks. <a href="https://redirect.github.com/github/codeql-action/pull/4146">#4146</a></li> </ul> </blockquote> </details> <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/github/codeql-action/blob/main/CHANGELOG.md">github/codeql-action/init's changelog</a>.</em></p> <blockquote> <h1>CodeQL Action Changelog</h1> <p>See the <a href="https://github.com/github/codeql-action/releases">releases page</a> for the relevant changes to the CodeQL CLI and language packs.</p> <h2>[UNRELEASED]</h2> <p>No user facing changes.</p> <h2>4.38.2 - 24 Sept 2026</h2> <ul> <li>Update default CodeQL bundle version to <a href="https://github.com/github/codeql-action/releases/tag/codeql-bundle-v2.27.1">2.27.1</a>. <a href="https://redirect.gith
  **Post-Mortem & Fix Analysis**:
  > Superseded by #958.

- **Issue #953** (2026-10-05): **Bump github/codeql-action/analyze from 4.38.0 to 4.38.1**
  *Symptoms*: Bumps [github/codeql-action/analyze](https://github.com/github/codeql-action) from 4.38.0 to 4.38.1. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/github/codeql-action/releases">github/codeql-action/analyze's releases</a>.</em></p> <blockquote> <h2>v4.38.1</h2> <ul> <li>The CodeQL Action now has experimental support for CodeQL releases for which per-language bundles are available. Per-language bundles support analysis for a single language and are therefore smaller than the combined bundles that allow analysis for all supported languages. As a result, per-language bundles take up less space on disk and are faster to download. We expect to roll this change out to everyone in the coming weeks. <a href="https://redirect.github.com/github/codeql-action/pull/4146">#4146</a></li> </ul> </blockquote> </details> <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/github/codeql-action/blob/main/CHANGELOG.md">github/codeql-action/analyze's changelog</a>.</em></p> <blockquote> <h1>CodeQL Action Changelog</h1> <p>See the <a href="https://github.com/github/codeql-action/releases">releases page</a> for the relevant changes to the CodeQL CLI and language packs.</p> <h2>[UNRELEASED]</h2> <p>No user facing changes.</p> <h2>4.38.2 - 24 Sept 2026</h2> <ul> <li>Update default CodeQL bundle version to <a href="https://github.com/github/codeql-action/releases/tag/codeql-bundle-v2.27.1">2.27.1</a>. <a href="https://redi
  **Post-Mortem & Fix Analysis**:
  > Superseded by #957.

- **Issue #949** (2026-09-27): **Hi**
  *Symptoms*: <!-- Please search existing issues to avoid creating duplicates -->  <!-- Describe the feature you'd like. -->

- **Issue #947** (2026-09-23): **https://docs.github.com/api/article/body?pathname=/en/copilot/get-started/quickstart-for-using-github-copilot-on-github-com**
  *Symptoms*: <!-- Please search existing issues to avoid creating duplicates -->  **Describe the bug** <!-- A clear and concise description of what the bug is. -->  **Versions** - Copilot for Xcode: [e.g. 0.25.0] - Xcode: [e.g. 16.0] - macOS: [e.g. 14.6.1]  **Steps to reproduce** 1.  2.   **Screenshots** <!-- Add screenshots or screen recordings to help explain your problem. -->  **Logs** <!-- Attach relevant logs from `~/Library/Logs/GitHubCopilot/` -->  **Additional context** <!-- Add any other context about the problem here. -->
  **Post-Mortem & Fix Analysis**:
  > Yo
  > > Yo  
  > Yo

- **Issue #942** (2026-09-18): **Pin GitHub Actions to commit SHAs**
  *Symptoms*: Pins GitHub Actions `uses:` references in `github/CopilotForXcode` to immutable commit SHAs.  ## Summary  | Metric | Count | | --- | ---: | | Files changed | 2 | | Files scanned | 1 | | Refs found | 3 | | Refs pinned | 3 | | Skipped refs | 0 | | Warnings | 0 | | Errors | 0 |  ## Why  Pinning actions to full commit SHAs prevents future tag or branch retargeting from changing workflow behavior without review.  ## Reviewer notes  - Original refs are preserved in inline comments when possible. - Pin comments use the Dependabot-compatible original-ref style. - Branch refs were allowed and pinned to their current HEAD; review mutable-branch pins carefully. - No minimum action age was enforced for this run.  ## Pinned refs  | Location | Before | After | Resolved as | | --- | --- | --- | --- | | `.github/workflows/codeql.yml:40` | `actions/checkout@v4` | `actions/checkout@11d5960a326750d5838078e36cf38b85af677262` | `tag` | | `.github/workflows/codeql.yml:44` | `github/codeql-action/init@v4` | `github/codeql-action/init@b96794f015dfd88f77b49b1c93e0fa7110f94c63` | `tag` | | `.github/workflows/codeql.yml:73` | `github/codeql-action/analyze@v4` | `github/codeql-action/analyze@b96794f015dfd88f77b49b1c93e0fa7110f94c63` | `tag` |  ## Dependabot  - Added `.github/dependabot.yml` enabling weekly `github-actions` updates with a 7-day cooldown (`cooldown: default-days: 7`). - The cooldown delays applying a newly published action release for 7 days, reducing exposure to a compromised or broken r
  **Post-Mortem & Fix Analysis**:
  > 29116
  > Main

- **Issue #931** (2026-08-28): **Pre-release 0.51.182**
  *Symptoms*: Automated release PR.

- **Issue #922** (2026-08-18): **Pre-release 0.51.181**
  *Symptoms*: Automated release PR.

- **Issue #915** (2026-08-12): **Release 0.51.0**
  *Symptoms*: Automated release PR.
  **Post-Mortem & Fix Analysis**:
  > Instagram account hack password 

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

### Incident Patch 1: `1e1ce08e` (2024-10-29)
**Commit Message**: Fix the download link in the README

**File**: `README.md` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ As per [GitHub's Terms of Service](https://docs.github.com/en/github/site-policy
 ## Getting Started
 
 1. Download the `dmg` from
-   [the latest release](https://github.com/github/copilot-xcode/releases/latest/download/GitHubCopilotForXcode.dmg).
+   [the latest release](https://github.com/github/CopilotForXcode/releases/latest/download/GitHubCopilotForXcode.dmg).
    Updates can be downloaded and installed by the app.
 
 1. Open the `dmg` and drag the `GitHub Copilot for Xcode.app` into the `Applications` folder.
```

#### Recent Merged Pull Requests:
- **PR #954** (closed): Bump github/codeql-action/init from 4.38.0 to 4.38.1 (@dependabot[bot])
- **PR #953** (closed): Bump github/codeql-action/analyze from 4.38.0 to 4.38.1 (@dependabot[bot])
- **PR #942** (2026-09-18): Pin GitHub Actions to commit SHAs (@github-security-bot)
- **PR #931** (2026-08-28): Pre-release 0.51.182 (@CroffZ)
- **PR #922** (2026-08-18): Pre-release 0.51.181 (@CroffZ)
- **PR #915** (2026-08-12): Release 0.51.0 (@CroffZ)
- **PR #912** (closed): Migrate pull request automation away from pull_request_target (@mrecachinas)
- **PR #911** (closed): Delete SECURITY.md (@ibr101010-bot)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
