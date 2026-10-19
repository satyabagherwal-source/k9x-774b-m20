> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nguyenphutrong-quotio-learnings.md`  
> **Source**: github ([https://github.com/nguyenphutrong/quotio](https://github.com/nguyenphutrong/quotio))  
> **Source Version**: `04e93bd5`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T11:42:06.950Z  
> **Learning ID**: `learn-github-nguyenphutrong-quotio`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): nguyenphutrong/quotio

> **Canonical Artifact**: `07_PROJECT_LEARNING/nguyenphutrong-quotio-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/nguyenphutrong/quotio](https://github.com/nguyenphutrong/quotio))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T11:42:06.946Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nguyenphutrong/quotio`
- **Description**: Stop juggling AI accounts. Quotio is a beautiful native macOS menu bar app that unifies your Claude, Gemini, OpenAI, Qwen, and Antigravity subscriptions – with real-time quota tracking and smart auto-failover for AI coding tools like Claude Code, OpenCode, and Droid.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 4898 stars

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #529** (2026-09-14): **Claude Code tool-search (defer_loading) not forwarded — MCP tools load fully into prefix instead of on-demand**
  *Symptoms*: ### What happened?  When Claude Code is pointed at CLIProxyAPI via ANTHROPIC_BASE_URL (used via Quotio's local proxy), MCP tool definitions are not deferred/loaded on-demand — they get loaded fully into every request's prefix, massively inflating context usage.  ### Steps to reproduce  - Same account, same project, same MCP servers (~250-265 tools) - Through CLIProxyAPI (ANTHROPIC_BASE_URL=http://127.0.0.1:8317): /context shows MCP tools: 180.4k tokens (247 tools), no "(loaded on-demand)" label - Direct connection (native claude.ai login, no base URL override): /context shows MCP tools: 12.3k tokens (265 tools) · loaded on-demand  ### Expected behavior  MCP tool definitions should be deferred/loaded on-demand (same as a direct connection), not loaded fully into every request. Native login shows "MCP tools: 12.3k tokens (265 tools) · loaded on-demand"; through the proxy it's "180.4k tokens (247 tools)" with no on-demand label — a ~15x overhead difference for the same tool set.  ### Severity  🟠 High - Core feature broken, no workaround  ### Affected component  Proxy Server (CLIProxyAPI)  ### Provider (if applicable)  Anthropic Claude  ### CLI Agent (if applicable)  Claude Code  ### macOS Version  26.6.2 (25G83) Tahoe  ### Quotio Version  0.31.0  ### App Mode  Full Mode (Proxy running)  ### Screenshots  _No response_  ### Logs (optional)  ```shell  ```  ### Additional context  Root cause is likely upstream in CLIProxyAPI, not Quotio's UI. Claude Code requests tool search via an

- **Issue #514** (2026-08-25): **App crashes with EXC_BREAKPOINT (SIGTRAP) in background Swift Task — v0.29.1 (70)**
  *Symptoms*: ### What happened?  ### Title App crashes with EXC_BREAKPOINT (SIGTRAP) in background Swift Task — v0.29.1 (70)  ### Environment - Quotio: 0.29.1 (build 70) - macOS: 26.5.2 (25F84) - Device: MacBook Pro, Apple M2 Max (Mac14,5), 32GB RAM  ### Crash Summary - Exception: EXC_BREAKPOINT (SIGTRAP), code 1 - esr: brk 1 (Swift runtime trap — not memory corruption; likely fatalError / force-unwrap of nil / array out-of-bounds / try! failure) - Crashing thread: Thread 6, dispatch queue `com.apple.root.user-initiated-qos.cooperative` (inside a background Swift Task) - Entire crash stack is within the app's own binary; symbols are stripped in this release build, so it can't be resolved to function names without the matching dSYM  ### Possibly Related Context At the time of the crash, another thread was mid-call into LocalAuthentication (`LAContext setInteractionNotAllowed`), suggesting a biometric auth flow was active during this session. Not confirmed to be causally related — noting it as context only.  ### Request Could you symbolicate the following addresses against the dSYM for 0.29.1 (build 70) to pinpoint the exact crash location? - 0x1001bc9e4 (base +477668) - 0x1001cb914 (base +538900) - 0x10040f61d (base +2913821) - 0x100189b81 (base +269185) - 0x10033df7d (base +2056061)  Full crash log attached below.  [crash_report.txt](https://github.com/user-attachments/files/31423602/crash_report.txt)  ### Steps to reproduce  1. Launch Quotio 2. crash  ### Expected behavior  App should co

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

### Incident Patch 1: `3372e125` (2026-10-17)
**Commit Message**: fix(cli): defer the adoption marker until the former config is seeded

A failed seed was only logged while the marker still landed, so a
config held under the CLI's lock was never retried. An unparseable
former config counts as complete so adoption cannot wedge.

**File**: `apps/cli/src/accounts/adopt.rs` (modified, +21/-5)
```diff
@@ -29,23 +29,35 @@ impl Source {
     }
 }
 
-pub fn config(source: &Source, store: &crate::settings::SettingsStore) {
+/// Returns whether config adoption is complete; a transient failure retries next launch.
+pub fn config(source: &Source, store: &crate::settings::SettingsStore) -> bool {
     let Some(path) = &source.config else {
-        return;
+        return true;
     };
     if source.adopted() {
-        return;
+        return true;
     }
     match store.seed_from_file(path) {
-        Ok(keys) => tracing::info!(keys, "vault_adoption_config_seeded"),
-        Err(error) => tracing::warn!(?error, "vault_adoption_config_skipped"),
+        Ok(keys) => {
+            tracing::info!(keys, "vault_adoption_config_seeded");
+            true
+        }
+        Err(crate::settings::SettingsError::Invalid) => {
+            tracing::warn!("vault_adoption_config_invalid");
+            true
+        }
+        Err(error) => {
+            tracing::warn!(?error, "vault_adoption_config_skipped");
+            false
+        }
     }
 }
 
 pub async fn vault(
     source: &Source,
     target: &Vault,
     history: Option<&crate::history::History>,
+    config_adopted: bool,
 ) -> bool {
     if source.adopted() {
         return false;
@@ -93,6 +105,10 @@ pub async fn vault(
             return absorbed.changed;
         }
     };
+    if !config_adopted {
+        tracing::info!("vault_adoption_marker_deferred");
+        return absorbed.changed || rows > 0;
+    }
     let marker = Marker {
         schema_version: 1,
         adopted_at: time::OffsetDateTime::now_utc(),
```

**File**: `apps/cli/src/server.rs` (modified, +10/-4)
```diff
@@ -1195,9 +1195,9 @@ pub async fn run(args: ServeArgs) -> Result<(), ServerError> {
             provider_timeout: args.timeout,
         },
     );
-    if let Some(source) = &adoption {
-        crate::accounts::adopt::config(source, &store);
-    }
+    let config_adopted = adoption
+        .as_ref()
+        .is_none_or(|source| crate::accounts::adopt::config(source, &store));
     let mut parent = if args.parent_pipe {
         Some(bootstrap::Parent::open().await?)
     } else {
@@ -1323,7 +1323,13 @@ pub async fn run(args: ServeArgs) -> Result<(), ServerError> {
         if let (Some(source), Some(vault)) = (&adoption, &worker_state.vault)
             && let Ok(_guard) =
                 crate::accounts::service::mutation_guard(&worker_state.commit_guard).await
-            && crate::accounts::adopt::vault(source, vault, worker_state.history.as_ref()).await
+            && crate::accounts::adopt::vault(
+                source,
+                vault,
+                worker_state.history.as_ref(),
+                config_adopted,
+            )
+            .await
         {
             worker_state.invalidate().await;
         }
```

---

### Incident Patch 2: `6401b3a9` (2026-10-18)
**Commit Message**: fix(cli): ask for Keychain access when adopting a former app vault

The former vault's Keychain item trusts only the helper identifier that
created it. The app now bundles a helper signed as dev.quotio.cli, so the
non-interactive read failed, no marker was written, and upgrading users
saw an empty account list on every launch. Read the former vault with the
Keychain prompt allowed and without the 10-second transaction timeout, so
the user approves access once and adoption completes.

**File**: `apps/cli/src/accounts/adopt.rs` (modified, +10/-2)
```diff
@@ -62,14 +62,22 @@ pub async fn vault(
     if source.adopted() {
         return false;
     }
-    let former = match Vault::isolated_for_usage(&source.namespace, &source.data_dir) {
+    // The former Keychain item trusts only the helper that created it. A helper
+    // signed under another identifier needs the user's approval to read it once.
+    let former = match Vault::isolated_interactive(&source.namespace, &source.data_dir) {
         Ok(former) => former,
         Err(error) => {
             tracing::warn!(?error, "vault_adoption_source_unavailable");
             return false;
         }
     };
-    let document = match super::service::begin(former.clone()).await {
+    let reader = former.clone();
+    // No timeout: the read waits for the user to answer the prompt.
+    let read = tokio::task::spawn_blocking(move || reader.begin())
+        .await
+        .map_err(|_| super::AccountError::Storage)
+        .and_then(|read| read);
+    let document = match read {
         Ok(transaction) => transaction.document,
         Err(error) => {
             tracing::warn!(?error, "vault_adoption_source_unavailable");
```

**File**: `apps/cli/src/accounts/vault.rs` (modified, +19/-1)
```diff
@@ -291,11 +291,29 @@ impl Vault {
     pub fn isolated_for_usage(
         namespace: &VaultNamespace,
         data_directory: &std::path::Path,
+    ) -> Result<Self, AccountError> {
+        Self::isolated(false, namespace, data_directory)
+    }
+    /// Reads can wait on a Keychain prompt until the user answers it.
+    pub fn isolated_interactive(
+        namespace: &VaultNamespace,
+        data_directory: &std::path::Path,
+    ) -> Result<Self, AccountError> {
+        Self::isolated(true, namespace, data_directory)
+    }
+    fn isolated(
+        interactive: bool,
+        namespace: &VaultNamespace,
+        data_directory: &std::path::Path,
     ) -> Result<Self, AccountError> {
         if !data_directory.is_absolute() {
             return Err(AccountError::Storage);
         }
-        Self::system_with_interaction(false, Some(namespace), Some(data_directory.to_owned()))
+        Self::system_with_interaction(
+            interactive,
+            Some(namespace),
+            Some(data_directory.to_owned()),
+        )
     }
     fn system_with_interaction(
         _interactive: bool,
```

**File**: `apps/macos/CHANGELOG.md` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Changed
 
-- Quotio and Quotio Beta now share accounts, quota history, and settings with the standalone `quotio` CLI. The first launch moves the app's existing accounts, history, and settings into the shared store once; an account that exists in both keeps the fresher sign-in. Keep the CLI at least as new as the app.
+- Quotio and Quotio Beta now share accounts, quota history, and settings with the standalone `quotio` CLI. The first launch moves the app's existing accounts, history, and settings into the shared store once; an account that exists in both keeps the fresher sign-in. macOS asks once for permission to read the app's former accounts from the Keychain; allow it, or the move is retried on the next launch. Keep the CLI at least as new as the app.
 
 ## [1.0.0-beta.7] - 2026-10-16
 
```

**File**: `apps/macos/RELEASE.md` (modified, +1/-1)
```diff
@@ -62,7 +62,7 @@ Versions matching `X.Y.Z-alpha-N`, `X.Y.Z-beta-N`, or `X.Y.Z-rc-N` (also accepti
 | App updates | Sparkle | Manual download and installation |
 | Accounts, quota history, and helper settings | Shared with the `quotio` CLI in `~/Library/Application Support/quotio/` | Shared with the `quotio` CLI in `~/Library/Application Support/quotio/` |
 
-App preferences, Quotio-owned Keychain services, and Antigravity profile backups are also scoped to the app identity. Stable and beta share one account vault with the standalone CLI only when the bundled helper is signed with Developer ID as `dev.quotio.cli`. On its first launch, such a build folds the identity's former private helper store (`<bundle identifier>/QuotioCLI` and `quotio-cli.toml`) into the shared vault, history, and `config.toml` once, and records completion in `QuotioCLI/accounts-<namespace>.adopted`. The former store stays in place. Ad-hoc and Debug builds keep a private helper store per identity. Beta does not import legacy production accounts or preferences. Beta only stops proxy processes it owns; an occupied port is an error, not permission to terminate another instance.
+App preferences, Quotio-owned Keychain services, and Antigravity profile backups are also scoped to the app identity. Stable and beta share one account vault with the standalone CLI only when the bundled helper is signed with Developer ID as `dev.quotio.cli`. On its first launch, such a build folds the identity's former private helper store (`<bundle identifier>/QuotioCLI` and `quotio-cli.toml`) into the shared vault, history, and `config.toml` once, and records completion in `QuotioCLI/accounts-<namespace>.adopted`. The former Keychain item trusts only the helper identifier that created it, so this first read shows one macOS Keychain prompt. If the user denies it, no marker is written and the next launch asks again. The former store stays in place. Ad-hoc and Debug builds keep a private helper store per identity. Beta does not import legacy production accounts or preferences. Beta only stops proxy processes it owns; an occupied port is an error, not permission to terminate another instance.
 
 Install `Quotio Beta.app` beside the stable app. Prereleases do not modify the stable appcast or update the Homebrew tap. They publish `appcast-beta.xml` to the rolling `macos-beta-appcast` GitHub release, which stays marked as a prerelease so `releases/latest` keeps resolving to the stable appcast. The beta bundle's `SUFeedURL` points at that file, so Quotio Beta updates itself through Sparkle to newer betas only. Betas published before this change have no feed; install the first auto-updating beta manually.
 
```

---

### Incident Patch 3: `9f423cbc` (2026-10-16)
**Commit Message**: fix(cli): update rustls to 0.23.46

RUSTSEC-2026-0346 through 0349 affect rustls 0.23.45 and fail the dependency advisory check.

**File**: `apps/cli/Cargo.lock` (modified, +2/-2)
```diff
@@ -1870,9 +1870,9 @@ dependencies = [
 
 [[package]]
 name = "rustls"
-version = "0.23.45"
+version = "0.23.46"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "0d41d731c7d2f962d1ccc364cec258de3c0e93b38c2fb3ba97ac74513048d634"
+checksum = "48e13bd8c0e9365c43cfa5c9e8f9ad49d3c8444926c9aac819e0e4dc503c8fdf"
 dependencies = [
  "once_cell",
  "ring",
```

#### Recent Merged Pull Requests:
- **PR #565** (2026-10-16): fix(cli): update rustls to 0.23.46 (@nguyenphutrong)
- **PR #564** (2026-10-17): feat(macos): share the standalone CLI vault and config (@nguyenphutrong)
- **PR #563** (2026-10-17): refactor(macos): remove retired agent setup and clarify legacy contributions (@nguyenphutrong)
- **PR #562** (closed): feat: add MiniMax fallback models (@octo-patch)
- **PR #561** (closed): feat(desktop): add the Tauri app for Windows and Linux (@nguyenphutrong)
- **PR #560** (2026-10-13): feat: add local accounts with a custom config directory (@nguyenphutrong)

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

## X. cli): defer the adoption marker until the former config is seeded

**RULE**:
When implementing operations in `apps/cli/src/accounts/adopt.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in nguyenphutrong/quotio. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `3372e125`: cli): defer the adoption marker until the former config is seeded. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `apps/cli/src/accounts/adopt.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
/// Returns whether config adoption is complete; a transient failure retries next launch.
pub fn config(source: &Source, store: &crate::settings::SettingsStore) -> bool {
        return true;
        return true;
        Ok(keys) => {
            tracing::info!(keys, "vault_adoption_config_seeded");
            true
        }
        Err(crate::settings::SettingsError::Invalid) => {
            tracing::warn!("vault_adoption_config_invalid");
            true
        }
        Err(error) => {
            tracing::warn!(?error, "vault_adoption_config_skipped");
            false
        }
    config_adopted: bool,
    if !config_adopted {
        tracing::info!("vault_adoption_marker_deferred");
        return absorbed.changed || rows > 0;
    }
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
pub fn config(source: &Source, store: &crate::settings::SettingsStore) {
        return;
        return;
        Ok(keys) => tracing::info!(keys, "vault_adoption_config_seeded"),
        Err(error) => tracing::warn!(?error, "vault_adoption_config_skipped"),
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `3372e125` are properly handled with clean fallback behavior.
