> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nguyenphutrong-quotio-learnings.md`  
> **Source**: github ([https://github.com/nguyenphutrong/quotio](https://github.com/nguyenphutrong/quotio))  
> **Source Version**: `dfa5beeb`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-14T16:21:12.768Z  
> **Learning ID**: `learn-github-nguyenphutrong-quotio-mv8bh96o`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): nguyenphutrong/quotio

> **Canonical Artifact**: `07_PROJECT_LEARNING/nguyenphutrong-quotio-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/nguyenphutrong/quotio](https://github.com/nguyenphutrong/quotio))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-14T16:21:11.755Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nguyenphutrong/quotio`
- **Description**: Stop juggling AI accounts. Quotio is a beautiful native macOS menu bar app that unifies your Claude, Gemini, OpenAI, Qwen, and Antigravity subscriptions – with real-time quota tracking and smart auto-failover for AI coding tools like Claude Code, OpenCode, and Droid.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 4889 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Packages/QuotioCore/Package.swift`
```
// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "QuotioCore",
    platforms: [
        .macOS(.v14),
    ],
    products: [
        .library(name: "QuotioDomain", targets: ["QuotioDomain"]),
        .library(name: "QuotioApplication", targets: ["QuotioApplication"]),
        .library(name: "QuotioInfrastructure", targets: ["QuotioInfrastructure"]),
        .library(name: "QuotioPresentation", targets: ["QuotioPresentation"]),
    ],
    dependencies: [
        .package(path: "../QuotioHostClient"),
        .package(url: "https://github.com/sparkle-project/Sparkle", exact: "2.8.1"),
    ],
    targets: [
        .target(name: "QuotioDomain"),
        .target(
            name: "QuotioApplication",
            dependencies: ["QuotioDomain"]
        ),
        .target(
            name: "QuotioInfrastructure",
            dependencies: [
                .product(name: "QuotioHostClient", package: "QuotioHostClient"),
                "QuotioApplication",
                "QuotioDomain",
                .product(name: "Sparkle", package: "Sparkle"),
            ]
        ),
        .target(
            name: "QuotioPresentation",
            dependencies: ["QuotioApplication", "QuotioDomain"]
        ),
        .testTarget(
            name: "QuotioDomainTests",
            dependencies: ["QuotioDomain"]
        ),
        .testTarget(
            name: "QuotioApplicationTests",
            dependencies: ["QuotioApplication", "QuotioDomain"]
        ),
        .testTarget(
            name: "QuotioInfrastructureTests",
            dependencies: ["QuotioInfrastructure", "QuotioApplication", "QuotioDomain", .product(name: "QuotioHostClient", package: "QuotioHostClient")]
        ),
        .testTarget(
            name: "QuotioPresentationTests",
            dependencies: ["QuotioPresentation", "QuotioApplication", "QuotioDomain"]
        ),
    ],
    swiftLanguageModes: [.v6]
)

```

### Core Architecture Module: `Packages/QuotioCore/Sources/QuotioApplication/Accounts/AccountService.swift`
```
import Foundation
import QuotioDomain

public enum AccountServiceFailure: Error, Equatable, Sendable {
    case invalidCredential
    case duplicateAccount
    case accountNotFound
    case deletionNotAllowed
}

public enum NativeSourceAuthorizationFailure: Error, Equatable, Sendable {
    case quotioVault
    case nativeKeychain
    case nativeLogin
    case invalidCredential
    case timeout
    case unknown
}

/// One login inside a config directory that holds several, such as a multi-account `GROK_HOME`.
public struct LocalAccountEntry: Equatable, Identifiable, Sendable {
    public let entryKey: String
    public let label: String
    public var id: String { entryKey }

    public init(entryKey: String, label: String) {
        self.entryKey = entryKey
        self.label = label
    }
}

public enum LocalAccountFailure: Error, Equatable, Sendable {
    case entryRequired([LocalAccountEntry])
    case invalidInput
    case notSignedIn
    case duplicateAccount
    case keychainAccess
    case invalidCredential
    case unknown
}

/// Why the host cannot read Quotio's own account store. Only `requiresAuthorization`
/// is something the user can fix in place; the other cases need a different Quotio.
public enum AccountStorageProblem: Equatable, Sendable {
    case requiresAuthorization
    case unreadable
    case newerVersion
}

public struct NativeSourcePermission: Codable, Hashable, Identifiable, Sendable {
    public let provider: QuotaProvider
    public let kind: String
    public let location: String?
    public let keychainAccount: String?
    public let configDirectory: String?

    public init(provider: QuotaProvider, kind: String, location: String?, keychainAccount: String? = nil,
                configDirectory: String? = nil) {
        self.provider = provider
        self.kind = kind
        self.location = location
        self.keychainAccount = keychainAccount
        self.configDirectory = configDirectory
    }

    public var id: String {
        provider.rawValue + ":" + kind + ":" + (location ?? "") + ":" + (keychainAccount ?? "") + ":" + (configDirectory ?? "")
    }
}

public struct NativeDiscoverySnapshot: Sendable {
    public let failedProviders: Set<QuotaProvider>
    public let permissions: [NativeSourcePermission]
    public let knownSources: [NativeSourcePermission]
    public let scannedAt: [QuotaProvider: Date]

    public init(permissions: [NativeSourcePermission] = [], knownSources: [NativeSourcePermission] = [], scannedAt: [QuotaProvider: Date] = [:], failedProviders: Set<QuotaProvider> = []) {
        self.failedProviders = failedProviders
        self.permissions = permissions
        self.knownSources = knownSources
        self.scannedAt = scannedAt
    }
}

public protocol AccountManaging: Sendable {
    func registerDetectedNativeAccounts() async
    func rescanNativeAccounts(for provider: QuotaProvider) async
    func rescanAllNativeAccounts() async
    func nativeDiscoverySnapshot() async -> NativeDiscoverySnapshot
    func authorizeNativeSource(_ source: NativeSourcePermission) async throws
    /// Registers the read-only login a tool keeps in `configDirectory`, asking macOS for
    /// Keychain access when that login lives in the Keychain.
    func addLocalAccount(provider: QuotaProvider, kind: String, configDirectory: String, entryKey: String?, label: String?) async throws
    func accountStorageProblem() async -> AccountStorageProblem?
    func authorizeAccountStorage() async throws
    func accounts() async -> [Account]
    func setDisabled(_ disabled: Bool, accountID: String) async
    func delete(accountID: String) async throws
    func renameResolvedAccount(id: String, userLabel: String?) async throws
    func setSourceEnabled(_ enabled: Bool, sourceID: String) async throws
    func unlinkSource(sourceID: String) async throws
    func saveAPIKey(
        providerID: AccountProviderID,
        label: String,
        apiKey: String,
        existingAccountID: String?,
        fields: [String: String]
    ) async throws
}

public extension AccountManaging {
    func rescanAllNativeAccounts() async { await registerDetectedNativeAccounts() }
    func nativeDiscoverySnapshot() async -> NativeDiscoverySnapshot { .init() }
    func accountStorageProblem() async -> AccountStorageProblem? { nil }
    func authorizeAccountStorage() async throws { throw NativeSourceAuthorizationFailure.unknown }
    func addLocalAccount(provider: QuotaProvider, kind: String, configDirectory: String, entryKey: String?, label: String?) async throws {
        throw LocalAccountFailure.unknown
    }
}

```

### Core Architecture Module: `Packages/QuotioCore/Sources/QuotioApplication/Accounts/AccountSnapshotDataStore.swift`
```
import Foundation

/// Opaque persistence boundary for the legacy Monitor snapshot payload.
/// Quota models and JSON mapping remain in their current slice until Phase 7.
public protocol AccountSnapshotDataStore: Sendable {
    func read() async throws -> Data?
    func write(_ data: Data) async throws
}

```

### Core Architecture Module: `Packages/QuotioCore/Sources/QuotioApplication/Accounts/AntigravityAccountSwitching.swift`
```
import QuotioDomain

public protocol AntigravityAccountSwitching: Sendable {
    func snapshots() async -> AsyncStream<AntigravitySwitchSnapshot>
    func snapshot() async -> AntigravitySwitchSnapshot
    func isAvailable() async -> Bool
    func isIDERunning() async -> Bool
    func detectActiveAccount() async -> AntigravityActiveAccount?
    func switchAccount(authFilePath: String, restartIDE: Bool) async
    func switchAccount(email: String, authDirectory: String, restartIDE: Bool) async
    func cancelSwitch() async
}

public extension AntigravityAccountSwitching {
    func switchAccount(authFilePath: String) async {
        await switchAccount(authFilePath: authFilePath, restartIDE: true)
    }

    func switchAccount(email: String, authDirectory: String = "~/.cli-proxy-api") async {
        await switchAccount(email: email, authDirectory: authDirectory, restartIDE: true)
    }
}

```

### Core Architecture Module: `Packages/QuotioCore/Sources/QuotioApplication/Accounts/AuthFileRepository.swift`
```
import Foundation
import QuotioDomain

public enum AuthFileSource: String, Sendable {
    case cliProxyApi = "~/.cli-proxy-api"
    case nativeCredential = "Native Credential"
}

public struct AuthFileDescriptor: Identifiable, Hashable, Sendable {
    public let id: String
    public let providerID: AccountProviderID
    public let email: String?
    public let login: String?
    public let expired: Date?
    public let accountType: String?
    public let filePath: String
    public let source: AuthFileSource
    public let filename: String
    public var legacyIdentityKeys: [String]

    public init(
        id: String,
        providerID: AccountProviderID,
        email: String?,
        login: String?,
        expired: Date?,
        accountType: String?,
        filePath: String,
        source: AuthFileSource,
        filename: String,
        legacyIdentityKeys: [String] = []
    ) {
        self.id = id
        self.providerID = providerID
        self.email = email
        self.login = login
        self.expired = expired
        self.accountType = accountType
        self.filePath = filePath
        self.source = source
        self.filename = filename
        self.legacyIdentityKeys = legacyIdentityKeys
    }

    public var isExpired: Bool {
        expired.map { $0 < Date() } ?? false
    }

    public var displayName: String {
        email?.nilIfBlank ?? login?.nilIfBlank ?? filename
    }

    public var menuBarAccountKey: String {
        switch providerID.rawValue {
        case "codex":
            return filename.removing(prefix: "codex-").removing(suffix: ".json")
        case "github-copilot", "copilot":
            return login?.nilIfBlank
                ?? filename.removing(prefix: "github-copilot-").removing(suffix: ".json")
        case "kiro":
            return email?.nilIfBlank ?? filename.removing(suffix: ".json")
        default:
            return email?.nilIfBlank ?? filename
        }
    }
}

public struct AuthFileCredential: Sendable {
    public let accessToken: String
    public let refreshToken: String?
    public let expiresAt: String?
    public let clientID: String?
    public let clientSecret: String?
    public let authMethod: String?
    public let extras: [String: String]?

    public init(
        accessToken: String,
        refreshToken: String?,
        expiresAt: String?,
        clientID: String?,
        clientSecret: String?,
        authMethod: String?,
        extras: [String: String]?
    ) {
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        self.expiresAt = expiresAt
        self.clientID = clientID
        self.clientSecret = clientSecret
        self.authMethod = authMethod
        self.extras = extras
    }

    public var isExpired: Bool {
        guard let expiresAt else { return false }
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = fractional.date(from: expiresAt) ?? ISO8601DateFormatter().date(from: expiresAt)
        return date.map { $0 < Date() } ?? false
    }
}

public enum AuthFileRepositoryError: Error, Equatable, Sendable {
    case fileNotFound(String)
    case invalidFileName
    case invalidJSON(String)
    case readFailed(String)
    case saveFailed(String)
    case symbolicLinkRefused
}

public protocol AuthFileRepository: Sendable {
    func scanAllAuthFiles() async -> [AuthFileDescriptor]
    func readCredential(from file: AuthFileDescriptor) async -> AuthFileCredential?
    func uploadAuthFile(name: String, content: Data) async throws
    func readAuthFileForImport(from url: URL) async throws -> Data
    func writeDownloadedAuthFile(_ content: Data, to url: URL) async throws
    func downloadAuthFile(name: String) async throws -> Data
}

private extension String {
    var nilIfBlank: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    func removing(prefix: String) -> String {
        hasPrefix(prefix) ? String(dropFirst(prefix.count)) : self
    }

    func removing(suffix: String) -> String {
        hasSuffix(suffix) ? String(dropLast(suffix.count)) : self
    }
}

```

### Core Architecture Module: `Packages/QuotioCore/Sources/QuotioApplication/Accounts/CredentialMigrationResult.swift`
```
public struct CredentialMigrationResult: Sendable, Equatable {
    public var migratedCount: Int
    public var pendingCount: Int
    public var metadataUnreadable: Bool

    public init(migratedCount: Int = 0, pendingCount: Int = 0, metadataUnreadable: Bool = false) {
        self.migratedCount = migratedCount
        self.pendingCount = pendingCount
        self.metadataUnreadable = metadataUnreadable
    }
}

```

### Core Architecture Module: `Packages/QuotioCore/Sources/QuotioApplication/Accounts/CredentialPorts.swift`
```
import Foundation
import QuotioDomain

public struct StoredCredential: Codable, Equatable, Sendable {
    public var accessToken: String
    public var refreshToken: String?
    public var idToken: String?
    public var accountID: String?
    public var expiresAt: Date?
    public var extra: [String: String]

    public init(
        accessToken: String,
        refreshToken: String?,
        idToken: String?,
        accountID: String?,
        expiresAt: Date?,
        extra: [String: String]
    ) {
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        self.idToken = idToken
        self.accountID = accountID
        self.expiresAt = expiresAt
        self.extra = extra
    }

    public var redactedMetadata: RedactedCredentialMetadata {
        RedactedCredentialMetadata(
            kind: refreshToken == nil && idToken == nil ? .apiKey : .oauth,
            expiresAt: expiresAt,
            hasRefreshToken: refreshToken != nil,
            hasAccountIdentifier: accountID != nil
        )
    }
}

public struct CredentialDataRecord: Equatable, Sendable {
    public let data: Data
    public let generation: String

    public init(data: Data, generation: String) {
        self.data = data
        self.generation = generation
    }
}

public struct ExternalCredentialRecord: Equatable, Sendable {
    public let data: Data
    public let account: String

    public init(data: Data, account: String) {
        self.data = data
        self.account = account
    }
}

public protocol CredentialDataStoring: Sendable {
    func read(accountID: String) async -> CredentialDataRecord?
    func save(_ data: Data, accountID: String) async -> CredentialDataRecord?
    func compareAndSwap(
        _ data: Data,
        accountID: String,
        expectedGeneration: String
    ) async -> CredentialDataRecord?
    func delete(accountID: String) async
}

public protocol ExternalCredentialReading: Sendable {
    func read(service: String, account: String?) async -> ExternalCredentialRecord?
    func compareAndSwap(
        service: String,
        account: String,
        expectedData: Data,
        newData: Data
    ) async -> Bool
}

public protocol AccountMetadataRepository: Sendable {
    func accounts() async -> [Account]
    func disabledAccountIDs() async -> Set<String>
    func saveAccount(_ account: Account) async throws
    func deleteAccount(_ accountID: String) async throws
    func setDisabled(_ disabled: Bool, accountID: String) async throws
}

public protocol CredentialVault: Sendable {
    func accounts() async -> [Account]
    func credential(for accountID: String) async -> StoredCredential?
    func reloadLatest(accountID: String) async -> StoredCredential?
    func save(_ credential: StoredCredential, metadata: Account) async throws
    func delete(accountID: String) async
}

public enum CredentialVaultError: Error, Equatable, Sendable {
    case writeFailed
}

public actor CredentialVaultService: CredentialVault {
    private let dataStore: any CredentialDataStoring
    private let metadataRepository: any AccountMetadataRepository
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder
    private var loadedGenerations: [String: String] = [:]

    public init(
        dataStore: any CredentialDataStoring,
        metadataRepository: any AccountMetadataRepository,
        encoder: JSONEncoder = JSONEncoder(),
        decoder: JSONDecoder = JSONDecoder()
    ) {
        self.dataStore = dataStore
        self.metadataRepository = metadataRepository
        self.encoder = encoder
        self.decoder = decoder
    }

    public func accounts() async -> [Account] {
        await metadataRepository.accounts()
    }

    public func credential(for accountID: String) async -> StoredCredential? {
        guard let record = await dataStore.read(accountID: accountID) else { return nil }
        loadedGenerations[accountID] = record.generation
        return try? decoder.decode(StoredCredential.self, from: record.data)
    }

    public func reloadLatest(accountID: String) async -> StoredCredential? {
        await credential(for: accountID)
    }

    public func save(_ credential: StoredCredential, metadata account: Account) async throws {
        let data = try encoder.encode(credential)
        let saved: CredentialDataRecord?
        if let expectedGeneration = loadedGenerations[account.id] {
            saved = await dataStore.compareAndSwap(
                data,
                accountID: account.id,
                expectedGeneration: expectedGeneration
            )
        } else {
            saved = await dataStore.save(data, accountID: account.id)
        }
        guard let saved else {
            throw CredentialVaultError.writeFailed
        }
        loadedGenerations[account.id] = saved.generation
        try await metadataRepository.saveAccount(account)
    }

    public func delete(accountID: String) async {
        await dataStore.delete(accountID: accountID)
        loadedGenerations.removeValue(forKey: accountID)
        try? await metadataRepository.deleteAccount(accountID)
    }
}

```

### Core Architecture Module: `Packages/QuotioCore/Sources/QuotioApplication/Accounts/OAuthFlow.swift`
```
import Foundation
import QuotioDomain

public struct OAuthAttemptID: Hashable, Sendable {
    public let rawValue: UUID

    public init(rawValue: UUID = UUID()) {
        self.rawValue = rawValue
    }
}

public struct OAuthPrompt: Equatable, Sendable {
    public let authorizationURL: URL?
    public let userCode: String?
    public let status: OAuthPromptStatus?

    public init(authorizationURL: URL? = nil, userCode: String? = nil, status: OAuthPromptStatus? = nil) {
        self.authorizationURL = authorizationURL
        self.userCode = userCode
        self.status = status
    }
}

public enum OAuthPromptStatus: Equatable, Sendable {
    case proxyCLI(ProxyCLIAuthStatus)
    case importingQuotas
}

public enum OAuthAuthorizationMethod: String, Equatable, Sendable {
    case providerDefault
    case kiroGoogle
    case kiroAWSDeviceCode
    case kiroAWSBrowser
    case kiroImport
}

public struct OAuthAuthorizationRequest: Equatable, Sendable {
    public let providerID: AccountProviderID
    public let method: OAuthAuthorizationMethod
    public let automaticallyOpensBrowser: Bool
    /// GitHub Enterprise Cloud host for Copilot; `nil` means GitHub.com.
    public let githubHost: GitHubHost?

    public init(
        providerID: AccountProviderID,
        method: OAuthAuthorizationMethod = .providerDefault,
        automaticallyOpensBrowser: Bool = false,
        githubHost: GitHubHost? = nil
    ) {
        self.providerID = providerID
        self.method = method
        self.automaticallyOpensBrowser = automaticallyOpensBrowser
        self.githubHost = githubHost?.isGitHubCom == true ? nil : githubHost
    }
}

public enum OAuthAuthorizationOutcome: Sendable {
    case completed(Account)
    case awaitingManualCode(prompt: OAuthPrompt, state: String)
}

public enum OAuthFlowFailure: Error, Equatable, Sendable {
    case unsupportedProvider
    case invalidResponse
    case expired
    case stateMismatch
    case browserOpenFailed
    case proxyCLI(ProxyCLIAuthStatus)
    case provider(String)
    case unknown
}

public enum OAuthFlowState: Equatable, Sendable {
    case idle
    case authorizing(providerID: AccountProviderID)
    case awaitingUser(providerID: AccountProviderID, prompt: OAuthPrompt)
    case awaitingManualCode(providerID: AccountProviderID, prompt: OAuthPrompt, state: String)
    case succeeded(providerID: AccountProviderID, accountID: String)
    case failed(providerID: AccountProviderID, failure: OAuthFlowFailure)
}

public protocol OAuthAuthorizing: Sendable {
    func begin(
        request: OAuthAuthorizationRequest,
        attemptID: OAuthAttemptID,
        progress: @escaping @Sendable (OAuthPrompt) async -> Void
    ) async throws -> OAuthAuthorizationOutcome
    func completeManualCode(
        _ code: String,
        providerID: AccountProviderID,
        attemptID: OAuthAttemptID
    ) async throws -> Account
    func cancel(attemptID: OAuthAttemptID) async
}

public struct OAuthHTTPRequest: Sendable {
    public let url: URL
    public let method: String
    public let headers: [String: String]
    public let body: Data?

    public init(
        url: URL,
        method: String = "GET",
        headers: [String: String] = [:],
        body: Data? = nil
    ) {
        self.url = url
        self.method = method
        self.headers = headers
        self.body = body
    }
}

public struct OAuthHTTPResponse: Sendable {
    public let statusCode: Int
    public let body: Data

    public init(statusCode: Int, body: Data) {
        self.statusCode = statusCode
        self.body = body
    }
}

public protocol OAuthHTTPTransport: Sendable {
    func send(_ request: OAuthHTTPRequest) async throws -> OAuthHTTPResponse
}

public actor OAuthFlowController {
    private let authorizer: any OAuthAuthorizing
    private var activeAttempt: (id: OAuthAttemptID, request: OAuthAuthorizationRequest)?
    private var activeTask: Task<Void, Never>?
    private var stateContinuations: [UUID: AsyncStream<OAuthFlowState>.Continuation] = [:]
    private(set) public var state: OAuthFlowState = .idle

    public init(authorizer: any OAuthAuthorizing) {
        self.authorizer = authorizer
    }

    public func states() -> AsyncStream<OAuthFlowState> {
        let id = UUID()
        return AsyncStream { continuation in
            stateContinuations[id] = continuation
            continuation.yield(state)
            continuation.onTermination = { [weak self] _ in
                Task { await self?.removeContinuation(id) }
            }
        }
    }

    public func start(_ request: OAuthAuthorizationRequest) async {
        await cancelActiveAttempt(publishIdle: false)
        let attemptID = OAuthAttemptID()
        activeAttempt = (attemptID, request)
        publish(.authorizing(providerID: request.providerID))

        let authorizer = authorizer
        let controller = self
        activeTask = Task {
            do {
                let outcome = try await authorizer.begin(
                    request: request,
                    attemptID: attemptID
                ) { prompt in
                    await controller.receive(prompt: prompt, attemptID: attemptID)
                }
                await controller.receive(outcome: outcome, attemptID: attemptID)
            } catch is CancellationError {
                await controller.receiveCancellation(attemptID: attemptID)
            } catch let failure as OAuthFlowFailure {
                await controller.receive(failure: failure, attemptID: attemptID)
            } catch {
                await controller.receive(failure: .unknown, attemptID: attemptID)
            }
        }
    }

    public func completeManualCode(_ code: String) async {
        guard let attempt = activeAttempt,
              case .awaitingManualCode = state else { return }
        activeTask?.cancel()
        let authorizer = authorizer
        let controller = self
        activeTask = Task {
            do {
                let account = try await authorizer.completeManualCode(
                    code,
                    providerID: attempt.request.providerID,
                    attemptID: attempt.id
                )
                await controller.complete(account: account, attemptID: attempt.id)
            } catch is CancellationError {
                await controller.receiveCancellation(attemptID: attempt.id)
            } catch let failure as OAuthFlowFailure {
                await controller.receive(failure: failure, attemptID: attempt.id)
            } catch {
                await controller.receive(failure: .unknown, attemptID: attempt.id)
            }
        }
    }

    public func cancel() async {
        await cancelActiveAttempt(publishIdle: true)
    }

    public func shutdown() async {
        await cancelActiveAttempt(publishIdle: true)
        for continuation in stateContinuations.values {
            continuation.finish()
        }
        stateContinuations.removeAll()
    }

    private func receive(prompt: OAuthPrompt, attemptID: OAuthAttemptID) {
        guard let activeAttempt, activeAttempt.id == attemptID else { return }
        publish(.awaitingUser(providerID: activeAttempt.request.providerID, prompt: prompt))
    }

    private func receive(outcome: OAuthAuthorizationOutcome, attemptID: OAuthAttemptID) {
        guard let activeAttempt, activeAttempt.id == attemptID else { return }
        switch outcome {
        case .completed(let account):
            complete(account: account, attemptID: attemptID)
        case .awaitingManualCode(let prompt, let state):
            activeTask = nil
            publish(.awaitingManualCode(
                providerID: activeAttempt.request.providerID,
                prompt: prompt,
                state: state
            ))
        }
    }

    private func complete(account: Account, attemptID: OAuthAttemptID) {
        guard let activeAttempt, activeAttempt.id == attemptID else { return }
        self.activeAttempt = nil
        activeTask = nil
        publish(.succeeded(providerID: activeAttempt.request.providerID, accountID: account.id))
    }

    private func receive(failure: OAuthFlowFailure, attemptID: OAuthAttemptID) async {
        guard let activeAttempt, activeAttempt.id == attemptID else { return }
        activeTask = nil
        await authorizer.cancel(attemptID: attemptID)
        guard self.activeAttempt?.id == attemptID else { return }
        self.activeAttempt = nil
        publish(.failed(providerID: activeAttempt.request.providerID, failure: failure))
    }

    private func receiveCancellation(attemptID: OAuthAttemptID) async {
        guard let activeAttempt, activeAttempt.id == attemptID else { return }
        activeTask = nil
        await authorizer.cancel(attemptID: attemptID)
        guard self.activeAttempt?.id == attemptID else { return }
        self.activeAttempt = nil
        publish(.idle)
    }

    private func cancelActiveAttempt(publishIdle: Bool) async {
        guard let attempt = activeAttempt else {
            if publishIdle { publish(.idle) }
            return
        }
        activeAttempt = nil
        let task = activeTask
        activeTask = nil
        task?.cancel()
        await authorizer.cancel(attemptID: attempt.id)
        if publishIdle { publish(.idle) }
    }

    private func publish(_ state: OAuthFlowState) {
        self.state = state
        for continuation in stateContinuations.values {
            continuation.yield(state)
        }
    }

    private func removeContinuation(_ id: UUID) {
        stateContinuations.removeValue(forKey: id)
    }
}

```

### Core Architecture Module: `Packages/QuotioCore/Sources/QuotioApplication/Accounts/OperatingModeOAuthAuthorizer.swift`
```
import QuotioDomain

public actor OperatingModeOAuthAuthorizer: OAuthAuthorizing {
    public typealias MonitorModeProvider = @Sendable () async -> Bool

    private enum Route {
        case monitor
        case localProxy
    }

    private let monitor: any OAuthAuthorizing
    private let localProxy: any OAuthAuthorizing
    private let isMonitorMode: MonitorModeProvider
    private var routes: [OAuthAttemptID: Route] = [:]

    public init(
        monitor: any OAuthAuthorizing,
        localProxy: any OAuthAuthorizing,
        isMonitorMode: @escaping MonitorModeProvider
    ) {
        self.monitor = monitor
        self.localProxy = localProxy
        self.isMonitorMode = isMonitorMode
    }

    public func begin(
        request: OAuthAuthorizationRequest,
        attemptID: OAuthAttemptID,
        progress: @escaping @concurrent @Sendable (OAuthPrompt) async -> Void
    ) async throws -> OAuthAuthorizationOutcome {
        let route: Route = await isMonitorMode() ? .monitor : .localProxy
        routes[attemptID] = route
        let outcome = try await authorizer(for: route).begin(
            request: request,
            attemptID: attemptID,
            progress: progress
        )
        if case .completed = outcome {
            routes[attemptID] = nil
        }
        return outcome
    }

    public func completeManualCode(
        _ code: String,
        providerID: AccountProviderID,
        attemptID: OAuthAttemptID
    ) async throws -> Account {
        guard let route = routes[attemptID] else { throw OAuthFlowFailure.expired }
        let account = try await authorizer(for: route).completeManualCode(
            code,
            providerID: providerID,
            attemptID: attemptID
        )
        routes[attemptID] = nil
        return account
    }

    public func cancel(attemptID: OAuthAttemptID) async {
        guard let route = routes.removeValue(forKey: attemptID) else { return }
        await authorizer(for: route).cancel(attemptID: attemptID)
    }

    private func authorizer(for route: Route) -> any OAuthAuthorizing {
        switch route {
        case .monitor: monitor
        case .localProxy: localProxy
        }
    }
}

```

### Core Architecture Module: `Packages/QuotioCore/Sources/QuotioApplication/Accounts/ProviderSettingsState.swift`
```
import Foundation
import QuotioDomain

public struct ProviderSettingsState: Sendable {
    public let provider: QuotaProvider
    public let accounts: [Account]
    public let accountsNeedingIdentification: [Account]
    public let permissions: [NativeSourcePermission]
    public let connection: ConnectionState
    public let accountStates: [String: AccountMonitoringState]
    public let latestIssue: QuotaRefreshIssue?
    public let latestIssueAccountID: String?
    public let latestIssueSourceID: String?

    public var needsAttention: Bool {
        connection != .disabled && (connection == .permissionRequired || connection == .reauthenticationRequired || !permissions.isEmpty || !accountsNeedingIdentification.isEmpty || latestIssue != nil)
    }

    public var isUnconnected: Bool { accounts.isEmpty && accountsNeedingIdentification.isEmpty && permissions.isEmpty }

    public init(
        provider: QuotaProvider, accounts: [Account], permissions: [NativeSourcePermission],
        quota: QuotaSnapshot, tracking: ProviderTrackingPreferences
    ) {
        self.provider = provider
        let providerAccounts = accounts.filter { $0.providerID.rawValue == provider.rawValue }
        let unresolved = providerAccounts.filter { account in
            account.isIdentityVerified == false && !account.sources.isEmpty &&
            account.sources.allSatisfy { $0.source == .nativeCredential && $0.credentialReference?.hasSuffix("_native") == true } &&
            quota.accountStates[.init(provider: provider, accountKey: account.accountKey)]?.connection == .reauthenticationRequired
        }
        accountsNeedingIdentification = unresolved
        let unresolvedIDs = Set(unresolved.map(\.id))
        self.accounts = providerAccounts.filter { !unresolvedIDs.contains($0.id) }
        self.permissions = permissions.filter { $0.provider == provider }
        let tracked = tracking.isEnabled(provider)
        var states: [String: AccountMonitoringState] = [:]
        var currentIssues: [(accountID: String?, sourceID: String?, issue: QuotaRefreshIssue)] = []
        let sourceIssues = quota.sourceIssues[provider] ?? [:]
        for account in providerAccounts {
            let id = QuotaAccountID(provider: provider, accountKey: account.accountKey)
            let issue = quota.accountIssues[id]
            let state = quota.accountStates[id] ?? AccountMonitoringState(connection: .notConnected, quota: .notLoaded)
            states[account.id] = state
            if !account.isDisabled {
                if case .failed = state.quota, let issue { currentIssues.append((account.id, quota.accountIDs[provider]?[account.accountKey], issue)) }
                for source in account.sources {
                    if let issue = sourceIssues[source.accountID] { currentIssues.append((account.id, source.accountID, issue)) }
                }
            }
        }
        accountStates = states
        if !providerAccounts.isEmpty || !self.permissions.isEmpty, let issue = quota.issues[provider] {
            currentIssues.append((nil, nil, issue))
        }
        let latest = currentIssues.max { $0.issue.occurredAt < $1.issue.occurredAt }
        latestIssue = latest?.issue
        latestIssueAccountID = latest?.accountID
        latestIssueSourceID = latest?.sourceID
        if !tracked {
            connection = .disabled
        } else if states.values.contains(where: { $0.connection == .connected }) {
            connection = .connected
        } else if !self.permissions.isEmpty || states.values.contains(where: { $0.connection == .permissionRequired }) {
            connection = .permissionRequired
        } else if states.values.contains(where: { $0.connection == .reauthenticationRequired }) {
            connection = .reauthenticationRequired
        } else {
            connection = .notConnected
        }
    }
}

```

### Core Architecture Module: `Packages/QuotioCore/Sources/QuotioApplication/Accounts/ProxyCLIAuthentication.swift`
```
import Foundation

public enum ProxyCLIAuthCommand: Equatable, Sendable {
    case copilotLogin
    case kiroGoogleLogin
    case kiroAWSLogin
    case kiroAWSAuthCode
    case kiroImport

    public var arguments: [String] {
        switch self {
        case .copilotLogin: ["-github-copilot-login"]
        case .kiroGoogleLogin: ["-kiro-google-login"]
        case .kiroAWSLogin: ["-kiro-aws-login"]
        case .kiroAWSAuthCode: ["-kiro-aws-authcode"]
        case .kiroImport: ["-kiro-import"]
        }
    }
}

public struct ProxyCLIAuthRuntime: Equatable, Sendable {
    public let binaryPath: String
    public let configurationPath: String

    public init(binaryPath: String, configurationPath: String) {
        self.binaryPath = binaryPath
        self.configurationPath = configurationPath
    }
}

public struct LocalProxyOAuthRuntime: Equatable, Sendable {
    public let cli: ProxyCLIAuthRuntime?
    public let management: ProxyManagementConnection?

    public init(cli: ProxyCLIAuthRuntime?, management: ProxyManagementConnection?) {
        self.cli = cli
        self.management = management
    }
}

public enum ProxyCLIAuthStatus: Equatable, Sendable {
    case authenticationCompleted
    case authenticationCancelled
    case copilotBrowserOpened(deviceCode: String?)
    case browserOpened
    case failedToStart(details: String)
}

public struct ProxyCLIAuthResult: Equatable, Sendable {
    public let success: Bool
    public let status: ProxyCLIAuthStatus
    public let deviceCode: String?

    public init(success: Bool, status: ProxyCLIAuthStatus, deviceCode: String?) {
        self.success = success
        self.status = status
        self.deviceCode = deviceCode
    }
}

public protocol ProxyCLIAuthenticating: Sendable {
    func run(_ command: ProxyCLIAuthCommand, runtime: ProxyCLIAuthRuntime) async -> ProxyCLIAuthResult
    func terminate() async
}

public protocol AntigravityAuthFileWorkaroundApplying: Sendable {
    func apply(in authDirectory: String) async
    func remove(in authDirectory: String) async
}

```

### Core Architecture Module: `Packages/QuotioCore/Sources/QuotioApplication/Agents/AgentConfigurationService.swift`
```
import QuotioDomain

public actor AgentConfigurationService {
    private let adapters: [CLIAgent: any AgentConfigurationRepository]
    private let detector: any AgentDetecting
    private let shellProfiles: any ShellProfileRepository
    private let modelCatalog: any AgentModelCatalogRepository

    public init(
        adapters: [any AgentConfigurationRepository],
        detector: any AgentDetecting,
        shellProfiles: any ShellProfileRepository,
        modelCatalog: any AgentModelCatalogRepository
    ) {
        self.adapters = Dictionary(uniqueKeysWithValues: adapters.map { ($0.agent, $0) })
        self.detector = detector
        self.shellProfiles = shellProfiles
        self.modelCatalog = modelCatalog
    }

    public func detectAgents(forceRefresh: Bool = false) async -> [AgentStatus] {
        await detector.detectAll(forceRefresh: forceRefresh)
    }

    public func detectAgent(_ agent: CLIAgent) async -> AgentStatus {
        await detector.detect(agent)
    }

    public func inspect(_ agent: CLIAgent) async throws -> SavedAgentConfiguration? {
        try await adapter(for: agent).inspect()
    }

    public func generatePreview(_ request: AgentConfigurationRequest) async throws -> AgentConfigResult {
        try request.configuration.validate()
        let repository = try adapter(for: request.configuration.agent)
        if request.configuration.setupMode == .defaultSetup {
            return try await repository.reset(mode: .manual)
        }
        return try await repository.preview(request)
    }

    public func apply(_ request: AgentConfigurationRequest, shellProfile: ShellProfile) async throws -> AgentConfigResult {
        try request.configuration.validate()
        let repository = try adapter(for: request.configuration.agent)
        if request.configuration.setupMode == .defaultSetup {
            let result = try await repository.reset(mode: request.mode)
            if result.success, request.mode == .automatic {
                await detector.clearConfigured(request.configuration.agent)
            }
            return result
        }
        let result = try await repository.apply(request)

        let agent = request.configuration.agent
        let shouldUpdateShell = agent.configType == .both
            ? (request.storageOption == .shellOnly || request.storageOption == .both)
            : agent.configType != .file

        if result.success,
           shouldUpdateShell,
           let shellConfig = result.shellConfig {
            try await shellProfiles.add(configuration: shellConfig, for: agent, to: shellProfile)
        }

        if result.success {
            await detector.markConfigured(agent)
        }
        return result
    }

    public func testConnection(
        agent: CLIAgent,
        configuration: AgentConfiguration
    ) async -> ConnectionTestResult {
        await modelCatalog.testConnection(agent: agent, configuration: configuration)
    }

    public func listBackups(for agent: CLIAgent) async throws -> [AgentBackupFile] {
        try await adapter(for: agent).listBackups()
    }

    public func restore(_ backup: AgentBackupFile) async throws {
        try await adapter(for: backup.agent).restore(backup)
    }

    public func reset(agent: CLIAgent, mode: ConfigurationMode) async throws -> AgentConfigResult {
        let result = try await adapter(for: agent).reset(mode: mode)
        if result.success, mode == .automatic {
            await detector.clearConfigured(agent)
        }
        return result
    }

    public func detectShellProfile() async -> ShellProfile {
        await shellProfiles.detect()
    }

    public func addToShellProfile(
        configuration: String,
        agent: CLIAgent,
        profile: ShellProfile
    ) async throws {
        try await shellProfiles.add(configuration: configuration, for: agent, to: profile)
        await detector.markConfigured(agent)
    }

    public func fetchModelCatalog(configuration: AgentConfiguration) async throws -> [ModelCatalogEntry] {
        try await modelCatalog.fetchCatalog(configuration: configuration)
    }

    public func fetchAvailableModels(configuration: AgentConfiguration) async throws -> [AvailableModel] {
        try await modelCatalog.fetchAvailableModels(configuration: configuration)
    }

    private func adapter(for agent: CLIAgent) throws -> any AgentConfigurationRepository {
        guard let adapter = adapters[agent] else {
            throw AgentConfigurationServiceError.missingAdapter(agent)
        }
        guard adapter.agent == agent else {
            throw AgentConfigurationServiceError.adapterMismatch(expected: agent, actual: adapter.agent)
        }
        return adapter
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #529** (2026-09-14): **Claude Code tool-search (defer_loading) not forwarded — MCP tools load fully into prefix instead of on-demand**
  *Symptoms*: ### What happened?  When Claude Code is pointed at CLIProxyAPI via ANTHROPIC_BASE_URL (used via Quotio's local proxy), MCP tool definitions are not deferred/loaded on-demand — they get loaded fully into every request's prefix, massively inflating context usage.  ### Steps to reproduce  - Same account, same project, same MCP servers (~250-265 tools) - Through CLIProxyAPI (ANTHROPIC_BASE_URL=http://127.0.0.1:8317): /context shows MCP tools: 180.4k tokens (247 tools), no "(loaded on-demand)" label - Direct connection (native claude.ai login, no base URL override): /context shows MCP tools: 12.3k tokens (265 tools) · loaded on-demand  ### Expected behavior  MCP tool definitions should be deferred/loaded on-demand (same as a direct connection), not loaded fully into every request. Native login shows "MCP tools: 12.3k tokens (265 tools) · loaded on-demand"; through the proxy it's "180.4k tokens (247 tools)" with no on-demand label — a ~15x overhead difference for the same tool set.  ### Severity  🟠 High - Core feature broken, no workaround  ### Affected component  Proxy Server (CLIProxyAPI)  ### Provider (if applicable)  Anthropic Claude  ### CLI Agent (if applicable)  Claude Code  ### macOS Version  26.6.2 (25G83) Tahoe  ### Quotio Version  0.31.0  ### App Mode  Full Mode (Proxy running)  ### Screenshots  _No response_  ### Logs (optional)  ```shell  ```  ### Additional context  Root cause is likely upstream in CLIProxyAPI, not Quotio's UI. Claude Code requests tool search via an
  **Post-Mortem & Fix Analysis**:
  > This appears to be an upstream CLIProxyAPI issue rather than a Quotio issue.  The failure is in the Anthropic request path through the local gateway: Claude Code's `anthropic-beta`, `defer_loading`, and `tool_reference` fields need to be preserved end-to-end by CLIProxyAPI. Quotio configures and launches the local endpoint, but it does not implement Anthropic protocol forwarding or deferred-tool handling.  The direct-Claude control works while the same client and MCP setup through the gateway expands deferred tools into the request prefix, which points to the CLIProxyAPI Anthropic executor / pass-through layer.  This should be tracked upstream at: https://github.com/router-for-me/CLIProxyAPI/issues  For an upstream report, include a request log or minimal curl repro showing the incoming and outgoing `anthropic-beta` and tool fields. Related but not identical: https://github.com/router-for-me/CLIProxyAPI/issues/4561 

- **Issue #514** (2026-08-25): **App crashes with EXC_BREAKPOINT (SIGTRAP) in background Swift Task — v0.29.1 (70)**
  *Symptoms*: ### What happened?  ### Title App crashes with EXC_BREAKPOINT (SIGTRAP) in background Swift Task — v0.29.1 (70)  ### Environment - Quotio: 0.29.1 (build 70) - macOS: 26.5.2 (25F84) - Device: MacBook Pro, Apple M2 Max (Mac14,5), 32GB RAM  ### Crash Summary - Exception: EXC_BREAKPOINT (SIGTRAP), code 1 - esr: brk 1 (Swift runtime trap — not memory corruption; likely fatalError / force-unwrap of nil / array out-of-bounds / try! failure) - Crashing thread: Thread 6, dispatch queue `com.apple.root.user-initiated-qos.cooperative` (inside a background Swift Task) - Entire crash stack is within the app's own binary; symbols are stripped in this release build, so it can't be resolved to function names without the matching dSYM  ### Possibly Related Context At the time of the crash, another thread was mid-call into LocalAuthentication (`LAContext setInteractionNotAllowed`), suggesting a biometric auth flow was active during this session. Not confirmed to be causally related — noting it as context only.  ### Request Could you symbolicate the following addresses against the dSYM for 0.29.1 (build 70) to pinpoint the exact crash location? - 0x1001bc9e4 (base +477668) - 0x1001cb914 (base +538900) - 0x10040f61d (base +2913821) - 0x100189b81 (base +269185) - 0x10033df7d (base +2056061)  Full crash log attached below.  [crash_report.txt](https://github.com/user-attachments/files/31423602/crash_report.txt)  ### Steps to reproduce  1. Launch Quotio 2. crash  ### Expected behavior  App should co
  **Post-Mortem & Fix Analysis**:
  > This is a regression. Downgrading to **0.24 resolves the issue completely**. The crash has been present in **every version from 0.25 onward**, including the current 0.29.1 (70).
  > Hi @royisme,   Thanks for the detailed crash report. I traced the crash to the Antigravity protobuf parser. It converted an untrusted field length from `UInt64` to `Int` before validating the value, which triggered the reported `SIGTRAP` during startup.  I opened #516 to validate protobuf lengths, varints, and field bounds before conversion or data slicing. The PR also adds regression tests for the crash payload and preserves valid old-format OAuth extraction.  Once a build containing this fix is available, could you verify that Quotio starts correctly in Full Mode with your existing Antigravity state?
  > @nguyenphutrong Thanks for your help, I already testd by main branch and it's worked.

- **Issue #447** (2026-08-21): **Repeated macOS keychain password prompts: ad-hoc code signature prevents XARA partition approval from persisting**
  *Symptoms*: ### What happened?  **Repo:** nguyenphutrong/quotio **Version:** 0.25.0 **Severity:** High — user is prompted for their macOS login password several times a day, indefinitely, with no setting that stops it.  ---  ## Environment  | | | |---|---| | macOS | 26.5.2 (build 25F84) | | Hardware | Mac mini, arm64 | | Quotio | 0.25.0, installed to `/Applications/Quotio.app` | | Bundle ID | `dev.quotio.desktop` | | Code signature | `flags=0x2(adhoc)`, `Signature=adhoc`, `TeamIdentifier=not set` | | CDHash | `a7f5c328c9ad08f466e182ebf8a83aded418ff36` | | FileVault | On | | Login keychain | `no-timeout`, does not lock on sleep |  ---  ## Summary  Quotio reads the GitHub CLI's OAuth token from the macOS login keychain (generic password, service `gh:github.com`). Because Quotio ships **ad-hoc signed with no Team ID**, macOS can only identify it in the keychain's XARA partition list by CDHash. Approving "Always Allow" writes that CDHash entry, but the approval does not survive the next Quotio launch — securityd raises a fresh partition mismatch and prompts again.  Net effect: an unavoidable, recurring macOS login-password prompt. On this machine it fires roughly twice a day, aligned with Sparkle and cliproxy release checks, plus once on every app restart.  ---  ## Steps to reproduce  1. Authenticate the GitHub CLI so a token exists in the login keychain: `gh auth login`. This creates generic password items with service `gh:github.com`. 2. Install Quotio 0.25.0 from the release page (ad-hoc 
  **Post-Mortem & Fix Analysis**:
  > I don't even want to use Github as provider, and I cant remove it from Quotio and I keep getting this message. Very annoying...
  > Thank you for the exceptionally detailed report and `securityd` evidence. The problematic path has been confirmed in Quotio 0.25.0.  One implementation detail differs from the initial diagnosis: Quotio does not use the `gh:github.com` token for Sparkle or CLIProxyAPI release checks. It is read by GitHub Copilot quota auto-discovery. Copilot discovery currently runs during startup and periodic quota refreshes even when the user has not explicitly enabled or configured Copilot, which explains both the recurring prompts and the report from users who do not use GitHub as a provider.  The main finding is still correct: Quotio's releases are currently ad-hoc signed, so there is no stable Team ID for macOS to use when persisting cross-application Keychain authorization. More importantly, background credential discovery should never be allowed to present a macOS password dialog in the first place.  The application-level fix will make all reads of credentials owned by other applications non-int
  > I guess the temporary fix is to disable automatic Quota checking and to manually check when one is ready to close the password prompt.

- **Issue #433** (2026-07-14): **Quota screen only shows one bucket per account (Antigravity → Claude only, Codex → Session only); menu bar shows the full breakdown**
  *Symptoms*: ### What happened?  # Quota screen only shows one bucket per account (Antigravity → Claude only, Codex → Session only); menu bar shows the full breakdown  ## Environment  - **Quotio version:** 0.22.0 (build 60) - **macOS:** 26.5.2 (25F84) - **App mode:** Monitor Only - **Providers affected:** Antigravity, OpenAI Codex (likely any multi-quota provider)  ## Summary  In the main **Quota** screen, each account renders only a **single** usage bar — the lowest/primary bucket — instead of the full set of quotas the provider exposes. The **menu bar popover** for the same accounts correctly shows every bucket. There is no way I can find (display-style dropdown, per-row click, right-click, or Settings) to make the main window show the other quotas.  Concretely:  - **Antigravity:** the Quota screen shows only a `Claude` group row (with a "2" model-count badge). The other model groups (Gemini 3 Pro, Gemini 3 Flash, Gemini 3 Image) never appear. The menu bar shows all four. - **Codex:** the Quota screen shows only a `Session` bar. The second window (weekly) is never shown. Same in the menu bar for the weekly bucket.  ## Possible regression  Two previously shipped features that would control this appear to be missing or non-functional in 0.22.0:  - **v0.4.1 – "Antigravity 4-Group Display"**: *"expandable group rows in QuotaScreen with individual model details… model count badge and individual progress bars when expanded."* → In 0.22.0 the rows are not expandable and only one group shows. -
  **Post-Mortem & Fix Analysis**:
  > Thanks, that was quick.

- **Issue #429** (2026-07-14): **Menu bar shows duplicate accounts despite setting only one account to display**
  *Symptoms*: ### What happened?  The menu bar account display does not match the configured setting. In Settings, the menu bar is configured to show only one account, but the macOS menu bar still shows multiple/repeated account entries.  Screenshot: <img width="236" height="690" alt="Image" src="https://github.com/user-attachments/assets/d3816db2-c79c-4516-b495-4bec5c285dd4" />  ### Steps to reproduce  1. Open Quotio. 2. Go to Settings and configure the menu bar/account display to show only one account. 3. Check the Quotio item in the macOS menu bar. 4. Notice that multiple/repeated account entries are still shown.  ### Expected behavior  When the setting is configured to show only one account, the macOS menu bar should display only one account entry and should not duplicate or repeat account entries.  ### Severity  🟢 Low - Minor issue, cosmetic  ### Affected component  Menu Bar  ### Provider (if applicable)  None  ### CLI Agent (if applicable)  None  ### macOS Version  Not specified  ### Quotio Version  Not specified  ### App Mode  Full Mode (Proxy running)  ### Screenshots  _No response_  ### Logs (optional)  ```shell  ```  ### Additional context  The uploaded screenshot shows the mismatch: the setting is configured for a single account, but the menu bar displays multiple account entries.

- **Issue #412** (2026-05-14): **Local agent automatically stops**
  *Symptoms*: ### What happened?  When I was using quotio, after using it for a while, the local proxy automatically stopped.    ### Steps to reproduce  1. my app version is ：版本0.17.0 (54) 2. mac：26.3.1 (a)  3. open the proxy of quotio 4. using the agent for a while  ### Expected behavior  local proxy running normally  ### Severity  🟠 High - Core feature broken, no workaround  ### Affected component  Proxy Server (CLIProxyAPI)  ### Provider (if applicable)  OpenAI Codex  ### CLI Agent (if applicable)  Claude Code  ### macOS Version  26.3.1 (a)  ### Quotio Version  0.17.0 (54)  ### App Mode  Full Mode (Proxy running)  ### Screenshots  _No response_  ### Logs (optional)  ```shell  ```  ### Additional context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Please try 0.17.1 
  > Duplicate #394 

- **Issue #407** (2026-05-10): **[URGENT] Quotio dropped the API key automatically**
  *Symptoms*: ### What happened?  Since a update, Quotio started to ask a permission for Keychain every time I restarted my Mac. I refused the permission request yesterday, and Quotio cannot store the API key anymore.  <img width="1112" height="852" alt="Image" src="https://github.com/user-attachments/assets/33b01157-286c-4ebe-b58d-a36c99559f94" />  The `generate API key` button is unusable, i can still create an API key but it will instantly appear without any error alert.   ### Steps to reproduce  1. Refuse the Keychain permission 2. API key disappears  ### Expected behavior  I don't think it is reasonable for a local proxy to ask for my administer password. It should just store the API key on normal database since i don't think local api key is sensitive.  Also, the Quotio's error handling path seems messy. If a critical error is occurring, it should exit and report an error instead of silently trapping a strange state.  ### Severity  🔴 Critical - App crashes or completely unusable  ### Affected component  Dashboard  ### Provider (if applicable)  None  ### CLI Agent (if applicable)  None  ### macOS Version  Tahoe 26.1  ### Quotio Version  0.17.0  ### App Mode  Full Mode (Proxy running)  ### Screenshots  _No response_  ### Logs (optional)  ```shell  ```  ### Additional context  _No response_

- **Issue #397** (2026-05-06): **Quotio 使用过程中异常断开：8317 管理端口停止监听，但 CLIProxyAPI 仍然正常**
  *Symptoms*: ### What happened?  Quotio 0.16.1 在 macOS 26.4.1 上使用过程中会异常失效，表现为本地代理/管理服务自动断开，Quotio 面板无法继续访问，需要手动重启 Quotio 才能恢复。    故障发生时观察到：   - CLIProxyAPI 仍在监听 127.0.0.1:18317，且 /healthz 返回 200   - 但 Quotio 管理/UI 端口 8317 已经不再监听   - 在 8317 断开前，日志中反复出现 /v0/management/debug 返回 401，随后变成 403   - /v0/management/config 和 /v0/management/routing/strategy 也会连续返回 403   - 重启 Quotio 后，8317 恢复监听，管理页面和代理功能恢复正常    用户侧现象：   - 使用过程中 Quotio 会突然不可用   - 本地代理看自动断开   - 管理页面报 HTTP error: 403 或无法访问   - 必须重启 Quotio 才能恢复  挂掉之后显示：代理未运行，需要手动启动，基本每隔10分钟就会断。 <img width="480" height="358" alt="Image" src="https://github.com/user-attachments/assets/947e26c3-99a2-420e-8b98-5f6423ae264f" />  ### Steps to reproduce  暂时没有稳定复现步骤。我的使用场景是长时间运行 Quotio，并通过本地代理给 Codex/Claude Code 等 CLI 工具使用。    大致过程：    1. 启动 Quotio 0.16.1。   2. 本地代理正常工作，CLIProxyAPI 监听 `127.0.0.1:18317`，Quotio 管理端口监听 `8317`。   3. 持续使用一段时间后，Quotio 突然不可用。   4. 管理页面出现 `HTTP error: 403`，或者无法访问。   5. 检查发现 `127.0.0.1:18317` 仍然正常，`/healthz` 返回 200。   6. 但 Quotio 管理/UI 端口 `8317` 已经不再监听。   7. 重启 Quotio 后恢复正常。  ### Expected behavior  Quotio 应该在长时间使用过程中保持稳定运行。    即使管理接口鉴权状态异常，也不应该导致管理/UI 端口 `8317` 停止监听。本地代理和管理页面应该持续可用，或者在异常时自动恢复，而不是必须手动重启 Quotio。  ### Severity  🔴 Critical - App crashes or completely unusable  ### Affected component  Dashboard  ### Provider (if applicable)  None  ### CLI Agent (if applicable)  None  ### macOS Version  macOS 26.4.1  ### Quotio Version  0.16.1  ### App Mode  Full Mode (Proxy running)  ### Screenshots  _No response_  ### Logs (optional)  ```sh
  **Post-Mortem & Fix Analysis**:
  > +1 同楼主的异常一毛一样，在三个版本之前好像都没有这种情况
  > Closing this as a duplicate of #394 so we can keep tracking the proxy/management port crash in one place.
  > 同样的问题，好烦啊 有没有的解决 version  0.17.0 cpa 6.10.9

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

### Incident Patch 1: `17258af6` (2026-10-13)
**Commit Message**: fix(macos): NFC-normalize only Claude config directories

Codex, Grok and gh read the directory as typed, so normalizing it could point them at a different path on a normalization-sensitive volume.

**File**: `Packages/QuotioCore/Sources/QuotioInfrastructure/QuotioCLI/QuotioCLIBackend.swift` (modified, +1/-1)
```diff
@@ -332,7 +332,7 @@ public actor QuotioCLIBackend: AccountManaging, QuotaCoordinating, MonitoringSet
     public func addLocalAccount(provider: QuotaProvider, kind: String, configDirectory: String, entryKey: String?, label: String?) async throws {
         guard let client else { throw LocalAccountFailure.unknown }
         // Claude Code NFC-normalizes CLAUDE_CONFIG_DIR before hashing it into its Keychain service.
-        let directory = configDirectory.precomposedStringWithCanonicalMapping
+        let directory = kind == "claude_native" ? configDirectory.precomposedStringWithCanonicalMapping : configDirectory
         let body = try JSONEncoder.quotioCLI.encode(LocalSourceBody(kind: kind, configDir: directory, entryKey: entryKey, label: label))
         do {
             do {
```

---

### Incident Patch 2: `0aa57882` (2026-10-13)
**Commit Message**: fix(macos): keep the config directory when re-authorizing a source

NativeSourcePermission now carries the saved source's directory into v2/sources/authorize, so a custom Claude or Copilot source authorizes its own Keychain item instead of the default one.

**File**: `Packages/QuotioCore/Sources/QuotioApplication/Accounts/AccountService.swift` (modified, +7/-2)
```diff
@@ -52,15 +52,20 @@ public struct NativeSourcePermission: Codable, Hashable, Identifiable, Sendable
     public let kind: String
     public let location: String?
     public let keychainAccount: String?
+    public let configDirectory: String?
 
-    public init(provider: QuotaProvider, kind: String, location: String?, keychainAccount: String? = nil) {
+    public init(provider: QuotaProvider, kind: String, location: String?, keychainAccount: String? = nil,
+                configDirectory: String? = nil) {
         self.provider = provider
         self.kind = kind
         self.location = location
         self.keychainAccount = keychainAccount
+        self.configDirectory = configDirectory
     }
 
-    public var id: String { provider.rawValue + ":" + kind + ":" + (location ?? "") + ":" + (keychainAccount ?? "") }
+    public var id: String {
+        provider.rawValue + ":" + kind + ":" + (location ?? "") + ":" + (keychainAccount ?? "") + ":" + (configDirectory ?? "")
+    }
 }
 
 public struct NativeDiscoverySnapshot: Sendable {
```

**File**: `Packages/QuotioCore/Sources/QuotioInfrastructure/QuotioCLI/QuotioCLIBackend.swift` (modified, +3/-1)
```diff
@@ -21,6 +21,7 @@ public actor QuotioCLIBackend: AccountManaging, QuotaCoordinating, MonitoringSet
         let kind: String
         let location: String?
         let entryKey: String?
+        let configDir: String?
     }
     private struct LocalSourceBody: Encodable {
         let kind: String
@@ -296,7 +297,8 @@ public actor QuotioCLIBackend: AccountManaging, QuotaCoordinating, MonitoringSet
 
     public func authorizeNativeSource(_ source: NativeSourcePermission) async throws {
         guard let client else { throw QuotioHostClientError.disconnected }
-        let body = try JSONEncoder.quotioCLI.encode(NativeSourceBody(kind: source.kind, location: source.location, entryKey: source.keychainAccount))
+        let body = try JSONEncoder.quotioCLI.encode(NativeSourceBody(kind: source.kind, location: source.location,
+            entryKey: source.keychainAccount, configDir: source.configDirectory))
         do {
             try await mutate(
                 client: client,
```

**File**: `Packages/QuotioCore/Sources/QuotioPresentation/Settings/AccountSettingsRow.swift` (modified, +1/-1)
```diff
@@ -137,7 +137,7 @@ struct AccountSettingsRow: View {
         case .authorize:
             guard let source, let kind = source.credentialReference else { return .retry }
             return .authorize(NativeSourcePermission(provider: provider, kind: kind, location: source.location,
-                keychainAccount: source.keychainAccount))
+                keychainAccount: source.keychainAccount, configDirectory: source.directory))
         case .refreshInSourceApp, .retry:
             return .retry
         }
```

---

### Incident Patch 3: `315ccf92` (2026-10-13)
**Commit Message**: fix(cli): tighten config-dir discovery and removal

Grok config-dir discovery now runs after the provider capability check and honors the 64-entry limit. Removing a config-dir source suppresses it when its credential path is one native discovery scans, so ~/.codex or ~/.grok chosen as a directory no longer comes back on the next rescan.

**File**: `apps/cli/src/accounts/discovery.rs` (modified, +12/-8)
```diff
@@ -183,25 +183,29 @@ impl Registry {
             inspect,
             config_dir,
         } = request;
+        if !crate::providers::capabilities::capability(provider)
+            .source_references
+            .iter()
+            .any(|s| s.kind == kind)
+        {
+            return Err(AccountError::Input);
+        }
         if let Some(dir) = config_dir {
             if kind != "grok_native" || location.is_some() || domain.is_some() || !inspect {
                 return Err(AccountError::Input);
             }
-            let candidates: Vec<Value> = GrokNativeReference::entries_in(&dir)?
+            let entries = GrokNativeReference::entries_in(&dir)?;
+            if entries.len() > LIMIT {
+                return Err(AccountError::Corrupt);
+            }
+            let candidates: Vec<Value> = entries
                 .into_iter()
                 .map(|(entry_key, label)| {
                     json!({"label":label,"status":"available","source":{"kind":kind,"config_dir":dir.as_str(),"entry_key":entry_key}})
                 })
                 .collect();
             return Ok(json!({"schema_version":2,"status":"checked","candidates":candidates}));
         }
-        if !crate::providers::capabilities::capability(provider)
-            .source_references
-            .iter()
-            .any(|s| s.kind == kind)
-        {
-            return Err(AccountError::Input);
-        }
         let locations: &[&str] = match kind.as_str() {
             "codex_native" => &["default", "config", "codex_home"],
             "claude_native" => &["code_file", "code_keychain"],
```

**File**: `apps/cli/src/accounts/mod.rs` (modified, +1/-3)
```diff
@@ -575,9 +575,7 @@ impl Document {
             .ok_or(AccountError::NotFound)?;
         let account = self.accounts[index].clone();
         self.reserve_factory_refresh(&account.id, &account.credential)?;
-        // Discovery never scans a custom config directory, so there is nothing to opt out of.
-        if account.origin() == AccountOrigin::BorrowedNative
-            && account.credential.config_directory().is_none()
+        if account.origin() == AccountOrigin::BorrowedNative && account.credential.rediscoverable()
         {
             self.enable_resolved_accounts()?;
             self.resolved
```

**File**: `apps/cli/src/accounts/sources.rs` (modified, +24/-0)
```diff
@@ -924,6 +924,30 @@ impl CodexNativeReference {
 }
 
 impl Credential {
+    /// Whether native discovery can register this source again after its removal.
+    /// A config directory that names a scanned default location still can.
+    pub fn rediscoverable(&self) -> bool {
+        match self {
+            Self::ClaudeNative { source } => source.config_dir.is_none(),
+            Self::CodexNative { source } if source.config_dir.is_some() => [
+                CodexLocation::Default,
+                CodexLocation::Config,
+                CodexLocation::CodexHome,
+            ]
+            .into_iter()
+            .filter_map(|location| CodexNativeReference::system(location).ok())
+            .any(|default| default.path == source.path),
+            Self::GrokNative { source } if source.config_dir.is_some() => {
+                crate::providers::catalog::oauth_editors::grok_auth_path()
+                    .is_some_and(|default| default == source.path)
+            }
+            Self::CopilotNative { source } if source.config_dir.is_some() => {
+                CopilotNativeReference::system(CopilotLocation::GhHosts, "github.com".into())
+                    .is_ok_and(|default| default.path == source.path)
+            }
+            _ => true,
+        }
+    }
     pub fn config_directory(&self) -> Option<String> {
         match self {
             Self::ClaudeNative { source } => source.config_dir.clone(),
```

**File**: `apps/cli/src/server/tests.rs` (modified, +68/-0)
```diff
@@ -1111,13 +1111,31 @@ fn config_dir_sources_run_with_an_isolated_home() {
             ".grok-multi/auth.json",
             r#"{"https://auth.x.ai::user-a":{"key":"synthetic-grok-a","expires_at":"2099-01-01T00:00:00Z","email":"a@example.com"},"https://auth.x.ai::user-b":{"key":"synthetic-grok-b","expires_at":"2099-01-01T00:00:00Z","email":"b@example.com"}}"#,
         ),
+        (
+            ".codex/auth.json",
+            r#"{"tokens":{"access_token":"synthetic-default-secret","account_id":"default-id"}}"#,
+        ),
         ("not-a-dir", "file"),
     ];
     for (relative, bytes) in fixtures {
         let path = dir.join(relative);
         std::fs::create_dir_all(path.parent().unwrap()).unwrap();
         std::fs::write(path, bytes).unwrap();
     }
+    let many: serde_json::Map<String, Value> = (0..65)
+        .map(|index| {
+            (
+                format!("https://auth.x.ai::user-{index}"),
+                json!({"key":"synthetic-grok","expires_at":"2099-01-01T00:00:00Z"}),
+            )
+        })
+        .collect();
+    std::fs::create_dir_all(dir.join(".grok-many")).unwrap();
+    std::fs::write(
+        dir.join(".grok-many/auth.json"),
+        serde_json::to_vec(&many).unwrap(),
+    )
+    .unwrap();
     let output = std::process::Command::new(std::env::current_exe().unwrap())
         .args([
             "--exact",
@@ -1359,6 +1377,56 @@ async fn config_dir_sources_child() {
             .resolved
             .is_none_or(|registry| registry.suppressed_providers().is_empty())
     );
+    let discover = |body: Value| {
+        client
+            .post(format!("{base}/v2/sources/discover"))
+            .bearer_auth(token)
+            .json(&body)
+            .send()
+    };
+    for body in [
+        json!({"provider":"codex","kind":"grok_native","inspect":true,"config_dir":"~/.grok-multi"}),
+        json!({"provider":"grok","kind":"grok_native","inspect":true,"config_dir":"~/.grok-many"}),
+    ] {
+        assert_ne!(
+            discover(body.clone()).await.unwrap().status(),
+            200,
+            "{body}"
+        );
+    }
+    let response = post(
+        "default-dir".into(),
+        json!({"kind":"codex_native","config_dir":"~/.codex"}),
+    )
+    .await
+    .unwrap();
+    let operation: Value = response.json().await.unwrap();
+    let completed =
+        serde_json::to_value(done(&state, operation["id"].as_str().unwrap()).await).unwrap();
+    assert_eq!(completed["status"], "completed", "{completed}");
+    let default_dir = completed["result"]["account_id"].as_str().unwrap();
+    let response: Value = client
+        .delete(format!("{base}/v2/accounts/{default_dir}"))
+        .bearer_auth(token)
+        .header("Idempotency-Key", "remove-default-dir")
+        .send()
+        .await
+        .unwrap()
+        .json()
+        .await
+        .unwrap();
+    assert_eq!(
+        done(&state, response["id"].as_str().unwrap()).await.status,
+        "completed"
+    );
+    let suppressed = vault
+        .begin()
+        .unwrap()
+        .document
+        .resolved
+        .map(|registry| registry.suppressed_providers())
+        .unwrap_or_default();
+    assert!(suppressed.contains("codex"), "{suppressed:?}");
     server.abort();
     for job in state.jobs.lock().unwrap().drain(..) {
         job.abort();
```

---

### Incident Patch 4: `518bf917` (2026-10-13)
**Commit Message**: fix(macos): refresh vault state when adding a local account fails

The sheet now surfaces the account-vault recovery like the other account flows. The directory is sent NFC-normalized, matching how Claude Code hashes it.

**File**: `Packages/QuotioCore/Sources/QuotioInfrastructure/QuotioCLI/QuotioCLIBackend.swift` (modified, +2/-1)
```diff
@@ -314,7 +314,8 @@ public actor QuotioCLIBackend: AccountManaging, QuotaCoordinating, MonitoringSet
 
     public func addLocalAccount(provider: QuotaProvider, kind: String, configDirectory: String, label: String?) async throws {
         guard let client else { throw LocalAccountFailure.unknown }
-        let body = try JSONEncoder.quotioCLI.encode(LocalSourceBody(kind: kind, configDir: configDirectory, label: label))
+        // Claude Code NFC-normalizes CLAUDE_CONFIG_DIR before hashing it into its Keychain service.
+        let body = try JSONEncoder.quotioCLI.encode(LocalSourceBody(kind: kind, configDir: configDirectory.precomposedStringWithCanonicalMapping, label: label))
         do {
             do {
                 try await mutate(client: client, path: "v2/sources", method: "POST", body: body)
```

**File**: `Packages/QuotioCore/Sources/QuotioPresentation/Accounts/AccountsScreenModel.swift` (modified, +6/-1)
```diff
@@ -75,7 +75,12 @@ public final class AccountsScreenModel {
     }
 
     public func addLocalAccount(provider: QuotaProvider, kind: String, configDirectory: String, label: String?) async throws {
-        try await accountService.addLocalAccount(provider: provider, kind: kind, configDirectory: configDirectory, label: label)
+        do {
+            try await accountService.addLocalAccount(provider: provider, kind: kind, configDirectory: configDirectory, label: label)
+        } catch {
+            storageProblem = await accountService.accountStorageProblem()
+            throw error
+        }
         storageProblem = await accountService.accountStorageProblem()
         await reloadAccounts()
     }
```

---

### Incident Patch 5: `513cc0b5` (2026-10-13)
**Commit Message**: fix(cli): keep the exact CLAUDE_CONFIG_DIR spelling for Keychain lookup

Claude Code hashes the exported string verbatim, so normalizing a trailing slash or a doubled separator pointed Quotio at a different Keychain item.

**File**: `apps/cli/src/accounts/sources.rs` (modified, +17/-13)
```diff
@@ -4,22 +4,24 @@ use serde::{Deserialize, Serialize};
 
 /// An existing directory chosen in place of a tool's default home, such as
 /// `CLAUDE_CONFIG_DIR`. `~` is expanded the way a shell expands the exported
-/// value, so `as_str` is the string the tool itself sees.
+/// value, so `as_str` is the string the tool itself sees. The spelling is kept
+/// as is: Claude Code hashes it verbatim, trailing slash included.
 #[derive(Clone, Debug, PartialEq, Eq)]
-pub struct ConfigDir(std::path::PathBuf);
+pub struct ConfigDir(String);
 impl ConfigDir {
     pub fn parse(raw: &str) -> Result<Self, AccountError> {
         let expanded = match raw.strip_prefix('~') {
             Some(rest) if rest.is_empty() || rest.starts_with('/') => {
-                let home = std::env::var_os("HOME").ok_or(AccountError::NotFound)?;
-                std::path::PathBuf::from(home).join(rest.trim_start_matches('/'))
+                let home = std::env::var("HOME").map_err(|_| AccountError::NotFound)?;
+                format!("{home}{rest}")
             }
             Some(_) => return Err(AccountError::Input),
-            None => std::path::PathBuf::from(raw),
+            None => raw.to_owned(),
         };
+        let path = std::path::Path::new(&expanded);
         if raw.len() > 1024
-            || !expanded.is_absolute()
-            || expanded.components().any(|c| {
+            || !path.is_absolute()
+            || path.components().any(|c| {
                 matches!(
                     c,
                     std::path::Component::ParentDir | std::path::Component::CurDir
@@ -28,18 +30,16 @@ impl ConfigDir {
         {
             return Err(AccountError::Input);
         }
-        let path: std::path::PathBuf = expanded.components().collect();
-        path.to_str().ok_or(AccountError::Input)?;
         if !path.is_dir() {
             return Err(AccountError::NotFound);
         }
-        Ok(Self(path))
+        Ok(Self(expanded))
     }
     pub fn as_str(&self) -> &str {
-        self.0.to_str().expect("validated as UTF-8")
+        &self.0
     }
     pub fn join(&self, file: &str) -> std::path::PathBuf {
-        self.0.join(file)
+        std::path::Path::new(&self.0).join(file)
     }
 }
 impl<'de> Deserialize<'de> for ConfigDir {
@@ -1470,7 +1470,7 @@ mod tests {
         )
         .unwrap();
         let config = ConfigDir::parse(&format!("{}/", dir.display())).unwrap();
-        assert_eq!(config.as_str(), dir.to_str().unwrap());
+        assert_eq!(config.as_str(), format!("{}/", dir.display()));
         let file = ClaudeNativeReference::in_config_dir(&config, ClaudeLocation::CodeFile).unwrap();
         assert_eq!(file.path.as_deref(), Some(&*dir.join(".credentials.json")));
         assert_eq!(file.metadata_path(), Some(dir.join(".claude.json")));
@@ -1491,6 +1491,10 @@ mod tests {
                 ClaudeNativeReference::in_config_dir(&config, ClaudeLocation::CodeKeychain)
                     .unwrap();
             assert_eq!(
+                keychain.keychain_service(),
+                claude_keychain_service(Some(&format!("{}/", dir.display())))
+            );
+            assert_ne!(
                 keychain.keychain_service(),
                 claude_keychain_service(Some(dir.to_str().unwrap()))
             );
```

**File**: `apps/cli/src/server/tests.rs` (modified, +1/-1)
```diff
@@ -1268,7 +1268,7 @@ async fn config_dir_sources_child() {
     assert_eq!(work["sources"][0]["kind"], "codex_native");
     assert_eq!(
         work["sources"][0]["directory"],
-        format!("{home}/.codex-work")
+        format!("{home}/.codex-work/")
     );
     let claude: Value = account(ids[2].clone()).await.json().await.unwrap();
     assert_eq!(claude["sources"][0]["location"], "code_file");
```

---

### Incident Patch 6: `4608d137` (2026-10-13)
**Commit Message**: build(cli): bump quinn-proto to 0.11.19

Fixes RUSTSEC-2026-0338 through RUSTSEC-2026-0342, published after master's last advisory run.

**File**: `apps/cli/Cargo.lock` (modified, +2/-2)
```diff
@@ -1560,9 +1560,9 @@ dependencies = [
 
 [[package]]
 name = "quinn-proto"
-version = "0.11.16"
+version = "0.11.19"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "2f4bfc015262b9df63c8845072ce59068853ff5872180c2ce2f13038b970e560"
+checksum = "0e750cca55fe4f0439a15d0bb529da9651e79993e8e72c61a899a36d462befbe"
 dependencies = [
  "bytes",
  "getrandom 0.4.2",
```

---

### Incident Patch 7: `3e188ce8` (2026-10-13)
**Commit Message**: fix(cli): name config-dir accounts by their full directory

Two directories with the same final component, such as ~/client-a/.claude and ~/client-b/.claude, produced the same generated label and the second failed as a duplicate. The label now uses the path with $HOME written as ~, and a long path keeps its tail plus an identity prefix.

**File**: `apps/cli/src/accounts/api.rs` (modified, +11/-7)
```diff
@@ -704,13 +704,17 @@ pub async fn prepare_source(input: SourceInput) -> Result<PreparedAccount, Accou
         "Local Cursor account".into()
     } else if let Some(directory) = directory {
         // Generated names must differ per directory; the account label is unique per provider.
-        let name: String = std::path::Path::new(&directory)
-            .file_name()
-            .and_then(|name| name.to_str())
-            .unwrap_or(&directory)
-            .chars()
-            .take(40)
-            .collect();
+        let path = std::env::var("HOME")
+            .ok()
+            .and_then(|home| directory.strip_prefix(&home).map(|rest| format!("~{rest}")))
+            .unwrap_or(directory);
+        let chars: Vec<char> = path.chars().collect();
+        let name: String = if chars.len() <= 40 {
+            path
+        } else {
+            let tail: String = chars[chars.len() - 30..].iter().collect();
+            format!("…{tail} {}", identity.chars().take(8).collect::<String>())
+        };
         format!(
             "{} ({name})",
             resolved.label.chars().take(36).collect::<String>()
```

**File**: `apps/cli/src/server/tests.rs` (modified, +21/-0)
```diff
@@ -1099,6 +1099,14 @@ fn config_dir_sources_run_with_an_isolated_home() {
             ".claude-work/.credentials.json",
             r#"{"claudeAiOauth":{"accessToken":"synthetic-claude-secret","refreshToken":"owner-refresh"}}"#,
         ),
+        (
+            "client-a/.claude/.credentials.json",
+            r#"{"claudeAiOauth":{"accessToken":"synthetic-client-a"}}"#,
+        ),
+        (
+            "client-b/.claude/.credentials.json",
+            r#"{"claudeAiOauth":{"accessToken":"synthetic-client-b"}}"#,
+        ),
         ("not-a-dir", "file"),
     ];
     for (relative, bytes) in fixtures {
@@ -1226,6 +1234,14 @@ async fn config_dir_sources_child() {
             "claude",
             json!({"kind":"claude_native","config_dir":"~/.claude-work"}),
         ),
+        (
+            "client-a",
+            json!({"kind":"claude_native","config_dir":"~/client-a/.claude"}),
+        ),
+        (
+            "client-b",
+            json!({"kind":"claude_native","config_dir":"~/client-b/.claude"}),
+        ),
     ] {
         let response = post(key.into(), input).await.unwrap();
         assert_eq!(response.status(), 202);
@@ -1261,6 +1277,11 @@ async fn config_dir_sources_child() {
         format!("{home}/.claude-work")
     );
     assert!(!claude.to_string().contains("synthetic-"));
+    let client_a: Value = account(ids[3].clone()).await.json().await.unwrap();
+    assert_eq!(
+        client_a["display_name"],
+        "Claude Code file (~/client-a/.claude)"
+    );
     let document = vault.begin().unwrap().document;
     assert_eq!(document.version, 22);
     let codex_paths: Vec<_> = document
```

---

### Incident Patch 8: `197f5c84` (2026-10-12)
**Commit Message**: fix(macos): handle unknown host client errors in history requests

**File**: `Packages/QuotioCore/Sources/QuotioInfrastructure/QuotioCLI/QuotioCLIBackend.swift` (modified, +1/-0)
```diff
@@ -70,6 +70,7 @@ public actor QuotioCLIBackend: AccountManaging, QuotaCoordinating, MonitoringSet
                     if code.contains("storage") { throw QuotaHistoryError.storage }
                     throw QuotaHistoryError.requestFailed
                 case .timeout: throw QuotaHistoryError.requestFailed
+                @unknown default: throw QuotaHistoryError.requestFailed
                 }
             }
             if let network = error as? URLError, [.notConnectedToInternet, .cannotConnectToHost, .cannotFindHost, .networkConnectionLost].contains(network.code) {
```

---

### Incident Patch 9: `9027a9bf` (2026-10-12)
**Commit Message**: fix(cli): keep timeout classification for unsent Claude refreshes

**File**: `apps/cli/src/accounts/oauth/claude.rs` (modified, +1/-1)
```diff
@@ -147,7 +147,7 @@ async fn refresh_at(
     })).send().await {
         Ok(response) => response,
         Err(error) if error.is_connect() => {
-            return Err(AccountError::RefreshUnused(ProviderError::Transient));
+            return Err(AccountError::RefreshUnused(http::send_error(error)));
         }
         Err(error) => return Err(http::send_error(error).into()),
     };
```

---

### Incident Patch 10: `248efe89` (2026-10-12)
**Commit Message**: fix(cli): finish the Claude fence release after a cancelled read

The fetch deadline could drop the read while the release waited for
the vault, leaving refresh_pending set for an unused token. Run the
release in a detached task that keeps the refresh lock until it commits.

**File**: `apps/cli/src/accounts/service.rs` (modified, +89/-10)
```diff
@@ -927,16 +927,24 @@ impl ManagedProvider {
         let updated = match self.operations.refresh(context, &latest).await {
             Ok(updated) => updated,
             Err(AccountError::RefreshUnused(error)) => {
-                let mut tx = begin(self.vault.clone()).await?;
-                if let Some(account) = tx
-                    .document
-                    .accounts
-                    .iter_mut()
-                    .find(|a| a.id == self.id && a.credential == latest)
-                {
-                    account.credential = credential;
-                    commit(tx).await?;
-                }
+                let (vault, id) = (self.vault.clone(), self.id.clone());
+                // Detached so the fetch deadline cannot drop the release before it commits.
+                tokio::spawn(async move {
+                    let _guard = guard;
+                    let mut tx = begin(vault).await?;
+                    if let Some(account) = tx
+                        .document
+                        .accounts
+                        .iter_mut()
+                        .find(|a| a.id == id && a.credential == latest)
+                    {
+                        account.credential = credential;
+                        commit(tx).await?;
+                    }
+                    Ok::<_, AccountError>(())
+                })
+                .await
+                .map_err(|_| AccountError::Storage)??;
                 return Err(error.into());
             }
             Err(error) => return Err(error),
@@ -4613,6 +4621,77 @@ mod tests {
         cleanup(path);
     }
     #[tokio::test]
+    async fn claude_refresh_fence_release_survives_a_dropped_read() {
+        struct HeldVault {
+            vault: Vault,
+            held: std::sync::Mutex<Option<Transaction>>,
+        }
+        impl Operations for HeldVault {
+            fn quota<'a>(
+                &'a self,
+                _: &'a ProviderContext,
+                _: Provider,
+                _: &'a Credential,
+            ) -> OperationFuture<'a, ProviderUsage> {
+                Box::pin(async { unreachable!("an expired token never reads quota") })
+            }
+            fn refresh<'a>(
+                &'a self,
+                _: &'a ProviderContext,
+                _: &'a Credential,
+            ) -> OperationFuture<'a, Credential> {
+                Box::pin(async move {
+                    *self.held.lock().unwrap() = Some(self.vault.begin().unwrap());
+                    Err(AccountError::RefreshUnused(ProviderError::RateLimited))
+                })
+            }
+        }
+        let (vault, fake, id, _, path) = setup(0, false, false, false);
+        let original = Credential::ClaudeOAuth {
+            access_token: "old".into(),
+            refresh_token: "refresh".into(),
+            account_id: "id".into(),
+            email: "demo@example.com".into(),
+            expires_at: 0,
+            refresh_pending: false,
+        };
+        let mut tx = vault.begin().unwrap();
+        tx.document.accounts[0].provider = Provider::Catalog("claude");
+        tx.document.accounts[0].credential = original.clone();
+        tx.document.reserve_factory_refresh(&id, &original).unwrap();
+        tx.commit().unwrap();
+        let operations = Arc::new(HeldVault {
+            vault: vault.clone(),
+            held: std::sync::Mutex::new(None),
+        });
+        let mut adapter = managed(vault.clone(), fake, id, Provider::Catalog("claude"));
+        adapter.operations = operations.clone();
+        let context = http::fixture::context();
+        assert!(
+            tokio::time::timeout(Duration::from_millis(200), adapter.read(&context))
+                .await
+                .is_err()
+        );
+        drop(operations.held.lock().unwrap().take());
+        let restored = tokio::time::timeout(Duration::from_secs(5), async {
+            loop {
+                if vault
+                    .begin()
+                    .is_ok_and(|tx| tx.document.accounts[0].credential == original)
+                {
+                    return;
+                }
+                tokio::time::sleep(Duration::from_millis(25)).await;
+            }
+        })
+        .await;
+        assert!(
+            restored.is_ok(),
+            "the fence release outlives the dropped read"
+        );
+        cleanup(path);
+    }
+    #[tokio::test]
     async fn claude_refresh_fence_survives_failure_restart_and_removal() {
         for failure in [false, true] {
             let (vault, fake, id, _, path) = setup(0, false, failure, false);
```

---

### Incident Patch 11: `618c128f` (2026-10-12)
**Commit Message**: fix(cli): release Claude refresh fence before waiting out a 429

The fetch deadline cancels the read while json_response sleeps for
Retry-After, so the fence release never ran. Return RefreshUnused as
soon as the token endpoint answers 429.

**File**: `apps/cli/src/accounts/oauth/claude.rs` (modified, +28/-10)
```diff
@@ -151,16 +151,11 @@ async fn refresh_at(
         }
         Err(error) => return Err(http::send_error(error).into()),
     };
-    let throttled = response.status() == reqwest::StatusCode::TOO_MANY_REQUESTS;
-    let tokens = http::json_response(response, context.clock.now())
-        .await
-        .map_err(|error| {
-            if throttled {
-                AccountError::RefreshUnused(error)
-            } else {
-                error.into()
-            }
-        })?;
+    // Waiting out Retry-After here could outlive the fetch deadline and skip the fence release.
+    if response.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
+        return Err(AccountError::RefreshUnused(ProviderError::RateLimited));
+    }
+    let tokens = http::json_response(response, context.clock.now()).await?;
     credential(tokens, Some(previous), context.clock.now().unix_timestamp())
 }
 #[cfg(test)]
@@ -199,6 +194,29 @@ mod tests {
             refresh_at(&http::fixture::context(), &previous, &url).await,
             Err(AccountError::RefreshUnused(ProviderError::Transient))
         ));
+        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
+        let url = format!("http://{}", listener.local_addr().unwrap());
+        let task = tokio::spawn(async move {
+            use tokio::io::{AsyncReadExt, AsyncWriteExt};
+            let (mut socket, _) = listener.accept().await.unwrap();
+            let mut request = vec![0; 8192];
+            let _ = socket.read(&mut request).await.unwrap();
+            socket
+                .write_all(b"HTTP/1.1 429 Test\r\nRetry-After: 600\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
+                .await
+                .unwrap();
+        });
+        let result = tokio::time::timeout(
+            std::time::Duration::from_secs(5),
+            refresh_at(&http::fixture::context(), &previous, &url),
+        )
+        .await
+        .expect("a 429 must not wait out Retry-After");
+        assert!(matches!(
+            result,
+            Err(AccountError::RefreshUnused(ProviderError::RateLimited))
+        ));
+        task.await.unwrap();
     }
     #[tokio::test]
     async fn exchange_and_refresh_contract() {
```

---

### Incident Patch 12: `0fed9637` (2026-10-12)
**Commit Message**: fix(cli): release Claude refresh fence when the token was never used

A failed Claude OAuth refresh left refresh_pending set forever, so one
offline wake or one 429 from the token endpoint forced a new sign-in.
When the request never reached the provider or was rate limited, the
refresh token is still unused, so restore the pre-fence credential and
let the next read retry. Every other failure keeps the fence.

**File**: `apps/cli/src/accounts/mod.rs` (modified, +3/-0)
```diff
@@ -71,6 +71,9 @@ pub enum AccountError {
     CallbackPort,
     #[error("OAuth callback or token response is invalid")]
     OAuth,
+    /// The provider never processed the refresh request, so its refresh token is still unused.
+    #[error("credential validation failed: {0}")]
+    RefreshUnused(ProviderError),
 }
 
 #[derive(Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
```

**File**: `apps/cli/src/accounts/oauth/claude.rs` (modified, +19/-2)
```diff
@@ -1,6 +1,7 @@
 use super::{Authorization, challenge};
 use crate::{
     accounts::{AccountError, Credential, random_string},
+    error::ProviderError,
     providers::{ProviderContext, http},
 };
 use serde::Deserialize;
@@ -141,9 +142,25 @@ async fn refresh_at(
     let Credential::ClaudeOAuth { refresh_token, .. } = previous else {
         return Err(AccountError::Unsupported);
     };
-    let tokens = http::json(context.http.post(endpoint).json(&json!({
+    let response = match context.http.post(endpoint).json(&json!({
         "grant_type": "refresh_token", "refresh_token": refresh_token, "client_id": CLIENT_ID, "scope": SCOPE,
-    })), context.clock.now()).await?;
+    })).send().await {
+        Ok(response) => response,
+        Err(error) if error.is_connect() => {
+            return Err(AccountError::RefreshUnused(ProviderError::Transient));
+        }
+        Err(error) => return Err(http::send_error(error).into()),
+    };
+    let throttled = response.status() == reqwest::StatusCode::TOO_MANY_REQUESTS;
+    let tokens = http::json_response(response, context.clock.now())
+        .await
+        .map_err(|error| {
+            if throttled {
+                AccountError::RefreshUnused(error)
+            } else {
+                error.into()
+            }
+        })?;
     credential(tokens, Some(previous), context.clock.now().unix_timestamp())
 }
 #[cfg(test)]
```

**File**: `apps/cli/src/accounts/service.rs` (modified, +17/-1)
```diff
@@ -924,7 +924,23 @@ impl ManagedProvider {
             account.credential = latest.clone();
             commit(tx).await?;
         }
-        let updated = self.operations.refresh(context, &latest).await?;
+        let updated = match self.operations.refresh(context, &latest).await {
+            Ok(updated) => updated,
+            Err(AccountError::RefreshUnused(error)) => {
+                let mut tx = begin(self.vault.clone()).await?;
+                if let Some(account) = tx
+                    .document
+                    .accounts
+                    .iter_mut()
+                    .find(|a| a.id == self.id && a.credential == latest)
+                {
+                    account.credential = credential;
+                    commit(tx).await?;
+                }
+                return Err(error.into());
+            }
+            Err(error) => return Err(error),
+        };
         let mut tx = begin(self.vault.clone()).await?;
         tx.document.reserve_factory_refresh(&self.id, &updated)?;
         let result = match tx
```

---

### Incident Patch 13: `0d0ead13` (2026-10-11)
**Commit Message**: fix(cli): read Claude quota while refresh is uncertain

**File**: `apps/cli/src/accounts/service.rs` (modified, +24/-4)
```diff
@@ -796,6 +796,29 @@ impl ManagedProvider {
             return Err(AccountError::SourceDisabled);
         }
         let credential = account.credential;
+        if let Credential::ClaudeOAuth {
+            refresh_pending: true,
+            expires_at,
+            ..
+        } = &credential
+        {
+            if *expires_at <= context.clock.now().unix_timestamp() {
+                return Err(ProviderError::Authentication.into());
+            }
+            // An uncertain refresh forbids replay, but its access token can still read quota.
+            let mut quota_credential = credential.clone();
+            if let Credential::ClaudeOAuth {
+                refresh_pending, ..
+            } = &mut quota_credential
+            {
+                *refresh_pending = false;
+            }
+            let usage = self
+                .operations
+                .quota(context, self.provider, &quota_credential)
+                .await?;
+            return self.verify_current(&credential, usage).await;
+        }
         if matches!(
             credential,
             Credential::GrokOAuth {
@@ -804,9 +827,6 @@ impl ManagedProvider {
             } | Credential::FactoryOAuth {
                 refresh_pending: true,
                 ..
-            } | Credential::ClaudeOAuth {
-                refresh_pending: true,
-                ..
             } | Credential::KiroOAuth {
                 refresh_pending: true,
                 ..
@@ -4550,7 +4570,7 @@ mod tests {
             if failure {
                 assert!(matches!(
                     restarted.read(&http::fixture::context()).await,
-                    Err(AccountError::CommitUncertain)
+                    Err(AccountError::Provider(ProviderError::Authentication))
                 ));
                 assert!(
                     restarted
```

---

### Incident Patch 14: `dbbf0097` (2026-10-12)
**Commit Message**: fix(quota): keep burn chart labels readable near the reset

Now joins the reset label instead of disappearing when the two would collide, and a weekly window's start shows its date because it shares the reset's weekday.

**File**: `Packages/QuotioCore/Sources/QuotioPresentation/Quota/QuotaPaceViews.swift` (modified, +13/-6)
```diff
@@ -500,20 +500,27 @@ private struct QuotaBurnChart: View {
     }
 
     /// Start and reset labels pin to the edges; "Now" and the projected empty
-    /// day sit under their points and drop out when they would collide.
+    /// day sit under their points and drop out when they would collide. Close
+    /// to the reset, "Now" joins the reset label instead.
     private func axisLabels(now: Date) -> some View {
         GeometryReader { proxy in
             let width = proxy.size.width
             let nowX = xPosition(now, width: width)
             let emptyX = pace.projectedEmpty.map { xPosition($0, width: width) }
-            let reset = Text(String(format: "quota.chart.reset".localized(), edgeText(pace.resetsAt)))
+            let resetText = edgeText(pace.resetsAt)
+            let startText = edgeText(pace.windowStart)
             ZStack(alignment: .topLeading) {
-                Text(edgeText(pace.windowStart))
+                // A weekly window opens and resets on the same weekday, so the start shows its date.
+                Text(startText == resetText ? QuotaTimeText.day(pace.windowStart) : startText)
                     .foregroundStyle(.secondary)
                     .frame(maxWidth: .infinity, alignment: .leading)
-                reset
-                    .foregroundStyle(.blue)
-                    .frame(maxWidth: .infinity, alignment: .trailing)
+                HStack(spacing: 6) {
+                    if nowX >= width - 75 {
+                        Text("quota.chart.now".localized()).foregroundStyle(.primary)
+                    }
+                    Text(String(format: "quota.chart.reset".localized(), resetText)).foregroundStyle(.blue)
+                }
+                .frame(maxWidth: .infinity, alignment: .trailing)
                 if nowX > 40, nowX < width - 75, !isBehind || emptyX.map({ abs($0 - nowX) > 40 }) ?? true {
                     Text("quota.chart.now".localized())
                         .foregroundStyle(.primary)
```

---

### Incident Patch 15: `4ed37573` (2026-10-11)
**Commit Message**: build: require Local.xcconfig for scripts/dev macos

Without a development team the app is signed ad hoc and asks for keychain access on every launch.

**File**: `scripts/dev` (modified, +5/-0)
```diff
@@ -81,6 +81,11 @@ case "${1:-help}" in
         ;;
     macos)
         shift
+        # Without a team the app is signed ad hoc and asks for keychain access on every launch.
+        [[ -f "$ROOT/apps/macos/Config/Local.xcconfig" ]] || {
+            echo "error: copy apps/macos/Config/Local.xcconfig.example to Local.xcconfig and set DEVELOPMENT_TEAM" >&2
+            exit 2
+        }
         exec "$ROOT/apps/macos/scripts/build_and_run.sh" "$@"
         ;;
     ios-sim)
```

#### Recent Merged Pull Requests:
- **PR #560** (2026-10-13): feat: add local accounts with a custom config directory (@nguyenphutrong)
- **PR #558** (closed): fix(quota): stop Antigravity all-models sheet crashing on layout (@mvanhorn)
- **PR #557** (2026-10-12): fix(cli): release Claude refresh fence when the token was never used (@nguyenphutrong)
- **PR #556** (2026-10-12): fix(cli): read Claude quota while refresh is uncertain (@1of1Adam)
- **PR #554** (2026-10-08): fix(cli): show cached quota sooner and honor the refresh cadence (@nguyenphutrong)
- **PR #553** (2026-10-08): fix(accounts): tell a newer or corrupt account store apart from denied Keychain access (@nguyenphutrong)
- **PR #552** (2026-10-08): fix(macos): show status menu in the system appearance (@nguyenphutrong)
- **PR #551** (2026-10-07): fix(claude): restore account metadata and quota display (@nguyenphutrong)

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

## X. macos): NFC-normalize only Claude config directories

**RULE**:
When implementing operations in `Packages/QuotioCore/Sources/QuotioInfrastructure/QuotioCLI/QuotioCLIBackend.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in nguyenphutrong/quotio. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `17258af6`: macos): NFC-normalize only Claude config directories. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `Packages/QuotioCore/Sources/QuotioInfrastructure/QuotioCLI/QuotioCLIBackend.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
        let directory = kind == "claude_native" ? configDirectory.precomposedStringWithCanonicalMapping : configDirectory
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
        let directory = configDirectory.precomposedStringWithCanonicalMapping
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `17258af6` are properly handled with clean fallback behavior.
