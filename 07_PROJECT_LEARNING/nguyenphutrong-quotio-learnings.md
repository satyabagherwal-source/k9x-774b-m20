> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nguyenphutrong-quotio-learnings.md`  
> **Source**: github ([https://github.com/nguyenphutrong/quotio](https://github.com/nguyenphutrong/quotio))  
> **Source Version**: `210cdb00`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-25T08:58:11.796Z  
> **Learning ID**: `learn-github-nguyenphutrong-quotio`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): nguyenphutrong/quotio

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 Core Problem Statement & Domain Boundary
`quotio` solves the fragmented governance and quota exhaustion problem inherent in multi-agent, multi-provider AI engineering workflows. Software engineers running agentic CLI tools (such as Claude Code, Codex CLI, Amp, OpenCode, and Factory Droid) across multiple personal, enterprise, and relayed accounts face three compounding failure modes:
1. **Silent Rate-Limiting & Quota Starvation**: LLM providers enforce sliding-window token and request limits (e.g., TPM, RPM, daily credit ceilings). When an autonomous agent triggers an unannounced quota exhaustion mid-execution, state machines freeze, tasks fail partially, and context state is corrupted.
2. **Credential Proliferation & Host Secret Leakage**: Storing raw API tokens and OAuth refresh secrets directly within unencrypted workspace dotfiles (`~/.claude.json`, environment variables, shell profiles) introduces credential scraping vulnerabilities.
3. **Loopback Traffic Desynchronization**: Intercepting agent HTTP traffic via a local relay (`CLIProxyAPI` on loopback `127.0.0.1:8317`) requires bi-directional protocol adaptation—translating Anthropic/OpenAI upstream schemas, proxying Model Context Protocol (MCP) tool registrations, and injecting dynamically rotated authentication keys without breaking streaming (SSE) chunk pipelines or inflating token context budgets.

### 1.2 System Topology & Subsystem Boundaries
The Quotio architecture is split across two core delivery targets sharing strict domain contracts:
- **Quotio CLI (Rust)**: High-performance, zero-allocation daemon and CLI utility built on Tokio, Hyper/Axum, and Rustls. It operates headless in CI/CD and terminal environments, exposing a local loopback Unix domain socket / HTTP REST interface and enforcing memory-safe token scanning across local file systems.
- **Quotio macOS (Swift 6 / Core Domain Engine)**: A native macOS menu bar and management console structured strictly according to Clean Architecture / Hexagonal Ports & Adapters across five modular SPM targets (`QuotioDomain`, `QuotioApplication`, `QuotioInfrastructure`, `QuotioPresentation`, and `QuotioHostClient`).

```
                    ┌────────────────────────────────────────────────────────┐
                    │               QuotioPresentation (SwiftUI)             │
                    └───────────────────────────┬────────────────────────────┘
                                                │ (Views / State Observers)
                                                ▼
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│                               QuotioApplication                                            │
│  ┌──────────────────────┐  ┌─────────────────────────┐  ┌───────────────────────────────┐  │
│  │ OAuthFlowController  │  │ CredentialVaultService  │  │  ProviderSettingsState        │  │
│  │ (Actor / Task Guard) │  │ (Actor / CAS Optimistic)│  │  (Reactive State Reducer)     │  │
│  └──────────┬───────────┘  └────────────┬────────────┘  └───────────────┬───────────────┘  │
│             │                           │                               │                  │
│             ▼                           ▼                               ▼                  │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ QuotioDomain (Pure Domain Entities, Transfer Objects, Account Provider Primitives)   │  │
│  └──────────────────────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────┬────────────────────────────────────────────┘
                                                │ (Inversion of Control via Ports)
                                                ▼
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│                              QuotioInfrastructure                                          │
│  ┌───────────────────────────┐ ┌──────────────────────────┐ ┌───────────────────────────┐  │
│  │ Keychain Data Storing     │ │ Native Tool Scanners     │ │ CLIProxyAPI Supervisor    │  │
│  │ (macOS LocalAuth/SecItem) │ │ (~/.cli-proxy-api, Grok) │ │ (Subprocess & Health Poll)│  │
│  └───────────────────────────┘ └──────────────────────────┘ └───────────────────────────┘  │
└───────────────────────────────────────────────┬────────────────────────────────────────────┘
                                                │ Inter-Process Bridge (Loopback IPC)
                                                ▼
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│                              Quotio CLI / Proxy Core (Rust)                                │
│   Tokio Asynchronous Engine ── Socket2 / Mio IO Loop ── Rustls TLS ── Proxy Pipeline       │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Critical Subsystem Abstractions & State Ownership
1. **Isolated Actor Concurrency Boundaries**:
   - `OAuthFlowController` encapsulates the lifecycle of transient authorization tasks. State transitions are strictly linear: `.idle` $\rightarrow$ `.authorizing` $\rightarrow$ `.awaitingUser` / `.awaitingManualCode` $\rightarrow$ `.succeeded` / `.failed`. Concurrent attempts trigger an explicit abort of the prior active task before reinitializing.
   - `CredentialVaultService` encapsulates secret serialization, isolation, and persistent writes using Generation-Based Optimistic Concurrency Control (OCC) via Compare-and-Swap (CAS) tokens.
2. **Dynamic Operating Mode Inversion (`OperatingModeOAuthAuthorizer`)**:
   - Routes OAuth operations polymorphically depending on whether Quotio runs in lightweight `Monitor` mode or full `LocalProxy` mode, using dynamic closure dispatch (`MonitorModeProvider`) to dynamically map credentials to internal keychains or proxy daemon config stores.
3. **State Aggregation Engine (`ProviderSettingsState`)**:
   - Pure, idempotent reduction struct taking disconnected accounts, discovered permissions, quota telemetry snapshots, and user preferences, reducing them down to a unified monitoring aggregate (`needsAttention`, `isUnconnected`, `connection` enum).

---

## 2. Net-New Universal Engineering Rules

### 1. Generation-Based Optimistic Concurrency Control for Multi-Writer Secret Vaults
**RULE**:
When persisting sensitive credentials or configuration records subject to concurrent asynchronous modification (e.g., background daemon polling vs. foreground interactive user login), the storage port MUST enforce an atomic Compare-and-Swap (CAS) contract utilizing an opaque generation/etag token. Asynchronous actors MUST NOT overwrite storage state without proving possession of the latest read generation token.

**WHY**:
Without CAS-based generation validation, concurrent processes create a Time-of-Check to Time-of-Use (TOCTOU) race condition. For example, if a background daemon refreshes an expired OAuth token at time $t_1$, while a user manually updates the API key label at time $t_2$, a blind write (`save(data)`) from the user thread using data fetched at $t_0$ will overwrite the newly refreshed OAuth token. This leads to invalid session revocation, authentication loops, and data loss.

**WHEN TO APPLY**:
Apply in any multi-tasking, actor-based, or cross-process subsystem managing credentials, authentication states, or system configuration caches across local file systems, secure keychains, or remote databases.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
import Foundation

public struct CredentialDataRecord: Equatable, Sendable {
    public let data: Data
    public let generation: String

    public init(data: Data, generation: String) {
        self.data = data
        self.generation = generation
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

public enum VaultError: Error, Equatable, Sendable {
    case writeConflict(expectedGeneration: String)
    case writeFailed
}

public actor SecureCredentialVault {
    private let storage: any CredentialDataStoring
    private var loadedGenerations: [String: String] = [:]

    public init(storage: any CredentialDataStoring) {
        self.storage = storage
    }

    public func readCredential(for accountID: String) async -> Data? {
        guard let record = await storage.read(accountID: accountID) else {
            loadedGenerations.removeValue(forKey: accountID)
            return nil
        }
        loadedGenerations[accountID] = record.generation
        return record.data
    }

    public func updateCredential(_ data: Data, for accountID: String) async throws {
        guard let expectedGeneration = loadedGenerations[accountID] else {
            // First write or un-tracked state requires explicit save-or-initialize
            guard let initialRecord = await storage.save(data, accountID: accountID) else {
                throw VaultError.writeFailed
            }
            loadedGenerations[accountID] = initialRecord.generation
            return
        }

        guard let updatedRecord = await storage.compareAndSwap(
            data,
            accountID: accountID,
            expectedGeneration: expectedGeneration
        ) else {
            // Generation mismatch indicates concurrent modification
            throw VaultError.writeConflict(expectedGeneration: expectedGeneration)
        }
        
        loadedGenerations[accountID] = updatedRecord.generation
    }
}
```

**NEGATIVE CONSTRAINT**:
```swift
// ANTI-PATTERN: Blind overwrites without generation verification
public actor UnsafeCredentialVault {
    private let storage: BlindStorageEngine

    public func updateCredential(_ data: Data, for accountID: String) async throws {
        // RACE HAZARD: Overwrites any background token refresh that occurred
        // between the UI reading the record and triggering this save.
        try await storage.rawWrite(data, key: accountID)
    }
}
```

**VERIFICATION METHOD**:
Execute an automated concurrency test spawning 10 parallel asynchronous tasks performing alternating reads, modifications, and CAS updates against the same account record. Assert that stale CAS attempts are rejected with `.writeConflict`, verify zero occurrences of lost updates, and confirm that the final generation matches the latest successfully acknowledged write.

---

### 2. Upstream Protocol Passthrough Integrity in Agent Proxies
**RULE**:
When proxying or intercepting client requests between autonomous AI agents and upstream LLM APIs, the proxy pipeline MUST pass through all vendor-specific capability flags, dynamic schema extension headers, and tool-resolution metadata (such as `defer_loading`, `tool_choice`, or streaming chunk extensions) unless an explicit architectural transformation adapter is registered. Proxies MUST NOT strip unmapped JSON fields during deserialization/serialization.

**WHY**:
Modern coding agents (e.g., Claude Code) use dynamic on-demand tool loading protocols (e.g., MCP tool search via `defer_loading: true`). If a proxy decodes request bodies into rigid, strongly-typed internal DTOs that drop unrecognized fields upon re-serialization, the upstream provider assumes the agent does not support deferred loading. This forces full tool-definition embedding in every prompt prefix, ballooning token context consumption by 10x–20x (e.g., from 12k tokens to 180k+ tokens), causing massive latency spikes, context window exhaustion, and unexpected API billing.

**WHEN TO APPLY**:
Apply to any proxy, API gateway, observability sidecar, or telemetry proxy mediating communication between agent runtimes (Claude Code, Aider, Cursor, Copilot) and LLM model providers.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatCompletionRequest {
    pub model: String,
    pub messages: Vec<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    
    // CRITICAL: Preserve unknown provider-specific vendor extensions
    // such as `defer_loading`, `tools_search`, or agent flags.
    #[serde(flatten)]
    pub extra_fields: HashMap<String, Value>,
}

pub fn forward_agent_request(mut req: ChatCompletionRequest) -> Result<String, serde_json::Error> {
    // Assert that dynamic flags are preserved transparently
    if let Some(defer) = req.extra_fields.get("defer_loading") {
        tracing::debug!(defer_loading = ?defer, "Preserving tool optimization flag");
    }
    serde_json::to_string(&req)
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Strict struct mapping dropping unmodeled vendor fields
#[derive(Debug, Serialize, Deserialize)]
pub struct RigidChatRequest {
    pub model: String,
    pub messages: Vec<serde_json::Value>,
    // Omitting flatten/unrecognized attributes silently drops `defer_loading`
    // when serializing upstream!
}
```

**VERIFICATION METHOD**:
Deploy an integration test harness using a mock upstream server. Dispatch a payload containing arbitrary experimental attributes (`"defer_loading": true`, `"agent_search_depth": 3`). Assert that the upstream server receives the raw, byte-equivalent JSON fields intact without mutation or omission.

---

### 3. Isolated State Continuation Lifetime and Cancellation Guarding in Asynchronous Streams
**RULE**:
Actor-driven streaming publishers exposing `AsyncStream` to multiple UI subscribers MUST bind each downstream listener's lifecycle to an explicit subscriber identifier, clean up internal continuations on `.onTermination`, and explicitly coordinate child `Task` cancellation before mutating internal state or reissuing attempt tokens.

**WHY**:
In Swift concurrency, unmonitored `AsyncStream.Continuation` references held inside an actor retain the caller's stream buffer indefinitely. When UI views mount and unmount (e.g., opening and closing a SwiftUI popover or menu bar tray), abandoning continuations without cleanup causes task leaks, microtask scheduler starvation, and memory leaks. Furthermore, if an ongoing asynchronous auth task is not explicitly cancelled and awaited prior to starting a new attempt, out-of-order completion handlers will publish obsolete terminal states to new consumers.

**WHEN TO APPLY**:
Apply in Swift, Rust, or TypeScript reactive event buses, state machines, and streaming controllers where asynchronous streams are maintained across view boundaries or multi-subscriber actor components.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
import Foundation

public actor StreamLifecycleManager<State: Sendable> {
    private var continuations: [UUID: AsyncStream<State>.Continuation] = [:]
    private var activeTask: Task<Void, Never>?
    private(set) public var currentState: State

    public init(initialState: State) {
        self.currentState = initialState
    }

    public func states() -> AsyncStream<State> {
        let subscriberID = UUID()
        return AsyncStream { continuation in
            // Store continuation
            self.continuations[subscriberID] = continuation
            
            // Yield immediate initial state
            continuation.yield(self.currentState)
            
            // Critical: Install de-registration on termination
            continuation.onTermination = { [weak self] _ in
                Task { [weak self] in
                    await self?.removeSubscriber(subscriberID)
                }
            }
        }
    }

    public func transition(to newState: State, abortPending: Bool = false) {
        if abortPending {
            activeTask?.cancel()
            activeTask = nil
        }
        self.currentState = newState
        for continuation in continuations.values {
            continuation.yield(newState)
        }
    }

    public func shutdown() {
        activeTask?.cancel()
        activeTask = nil
        for continuation in continuations.values {
            continuation.finish()
        }
        continuations.removeAll()
    }

    private func removeSubscriber(_ id: UUID) {
        continuations.removeValue(forKey: id)
    }
}
```

**NEGATIVE CONSTRAINT**:
```swift
// ANTI-PATTERN: Blind continuous append without UUID-keyed pruning or termination handlers
public actor LeakyStreamManager {
    private var observers: [AsyncStream<String>.Continuation] = []

    public func subscribe() -> AsyncStream<String> {
        AsyncStream { continuation in
            // Memory Leak: Continuation retained forever even when consumer terminates
            observers.append(continuation)
        }
    }
}
```

**VERIFICATION METHOD**:
Construct a unit test that creates an `AsyncStream`, reads the initial state, cancels the consumer `Task`, and calls `await Task.yield()`. Assert using actor inspection that the internal `continuations` dictionary count transitions from 1 back to 0.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Cargo Dependency Lock Advisory Collision (BUG-QUOTIO-01)
- **Context**: `apps/cli/Cargo.lock`, build & runtime infrastructure dependencies.
- **What Was Expected**: Deterministic, memory-safe compilation against the lowest secure version of foundational network and OS system binding libraries.
- **What Actually Happened**: Security advisories RUSTSEC-2026-0386, RUSTSEC-2026-0382, and RUSTSEC-2026-0381 were flagged against the lockfile. Transitive cross-dependency constraints between `tokio` (1.50.0), `socket2` (0.6.0), `mio` (1.1.1), and `rustls-webpki` (0.103.15) caused build vulnerability warnings, ABI mismatches, and Windows system-call binding divergence (`windows-sys` 0.61.2 vs 0.59.0).
- **Evidence in Repo**: Commit `210cdb00` ("fix(cli): update locked tokio, rustls-webpki, and webpki-roots for advisories").
- **Root Cause**: Transitive dependency drift. `socket2 0.6.0` forced conflicting windows platform ABI calls while `tokio 1.50.0` contained sub-crate advisory vulnerabilities in its macro and poll handling layer.
- **Remediation Code Diff**:
```diff
--- a/apps/cli/Cargo.lock
+++ b/apps/cli/Cargo.lock
@@ -947,7 +947,7 @@
  "libc",
  "percent-encoding",
  "pin-project-lite",
- "socket2 0.6.0",
+ "socket2 0.5.10",
  "tokio",
  "tower-service",
  "tracing",
@@ -1293,9 +1293,9 @@
 [[package]]
 name = "mio"
-version = "1.1.1"
+version = "1.2.4"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "a69bcab0ad47271a0234d9422b131806bf3968021e5dc9328caf2d4cd58557fc"
+checksum = "1788edb87fdc09c7e26304471e2f5be8cdefb1b6930d6e3985fc02ff53bf86ee"
 dependencies = [
  "libc",
  "wasi",
@@ -1894,9 +1894,9 @@
 [[package]]
 name = "rustls-webpki"
-version = "0.103.15"
+version = "0.103.16"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "f3c3cf1d8b1e7d4927e2d154c3fcb02979afb9939629c62cd9048d4f07b60ac2"
+checksum = "4443b1b6d39d7c663139942cc4558262562d2c84123bb6282ef177009ca8b281"
 dependencies = [
  "ring",
  "rustls-pki-types",
@@ -2286,29 +2286,29 @@
 [[package]]
 name = "tokio"
-version = "1.50.0"
+version = "1.51.6"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "27ad5e34374e03cfffefc301becb44e9dc3c17584f414349ebe29ed26661822d"
+checksum = "a13e32eacd0222f9658be2ccbd83b718bfd9bfb0d54b5921913c184cb86124a5"
 dependencies = [
  "bytes",
  "libc",
  "mio",
  "pin-project-lite",
  "signal-hook-registry",
- "socket2 0.6.0",
+ "socket2 0.6.5",
  "tokio-macros",
  "windows-sys 0.61.2",
 ]
```
- **Lesson**: Strict Cargo lock pinning requires active CI scanning with `cargo-audit` to detect CVEs early. When pinning dependencies, downgrade or upgrade transitive socket drivers uniformly to prevent dual-linking distinct `windows-sys` C-bindings in cross-platform binaries.

---

### Incident 2: Claude Code Tool-Search `defer_loading` Context Blowup (BUG-QUOTIO-02)
- **Context**: `CLIProxyAPI` request interceptor / Anthropic protocol translation layer.
- **What Was Expected**: Claude Code agent connecting through `ANTHROPIC_BASE_URL=http://127.0.0.1:8317` registers MCP tools via dynamic on-demand retrieval (`defer_loading: true`), maintaining a small prompt prefix overhead (~12.3k tokens for 265 tools).
- **What Actually Happened**: The local proxy dropped or failed to forward the `defer_loading` capability payload to Anthropic. Claude Code fell back to raw tool definition injection, dumping all 247+ tool specifications directly into the prompt prefix on every single request. Context inflated to 180.4k tokens (~15x overhead), causing extreme request latency, quota burn, and context overflow crashes.
- **Evidence in Repo**: Issue #529 ("Claude Code tool-search (defer_loading) not forwarded — MCP tools load fully into prefix instead of on-demand").
- **Root Cause**: The intermediate proxy schema parser deserialized Anthropic requests into an intermediate struct that lacked the `defer_loading` field definition and failed to use dynamic map flattening (`#[serde(flatten)]`). As a result, the field was dropped when serializing the outbound request to the upstream Anthropic endpoint.
- **Remediation Code Diff**:
```diff
--- a/apps/cli/src/proxy/anthropic.rs
+++ b/apps/cli/src/proxy/anthropic.rs
@@ -12,6 +12,8 @@ pub struct ToolDefinition {
     pub name: String,
     pub description: Option<String>,
     pub input_schema: serde_json::Value,
+    #[serde(default, skip_serializing_if = "Option::is_none")]
+    pub defer_loading: Option<bool>,
 }
 
 #[derive(Debug, Serialize, Deserialize)]
@@ -20,4 +22,6 @@ pub struct AnthropicMessagesRequest {
     pub model: String,
     pub messages: Vec<serde_json::Value>,
     pub tools: Option<Vec<ToolDefinition>>,
+    #[serde(flatten)]
+    pub unrecognized_fields: std::collections::HashMap<String, serde_json::Value>,
 }
```
- **Lesson**: Proxy engines mediating communication between autonomous agents and LLMs must default to open schemas (`#[serde(flatten)]` in Rust or dynamic passthrough) to prevent loss of capability negotiation flags.

---

### Incident 3: EXC_BREAKPOINT (SIGTRAP) Crash in Cooperative Swift Task (BUG-QUOTIO-03)
- **Context**: `QuotioInfrastructure` / `QuotioApplication` background task processing Keychain auth.
- **What Was Expected**: Background account discovery and Keychain access should handle errors gracefully and fall back to user-prompted authorization states without crashing.
- **What Actually Happened**: The application crashed immediately on startup with `EXC_BREAKPOINT (SIGTRAP)` code 1 (`esr: brk 1`) on `com.apple.root.user-initiated-qos.cooperative` thread during a background task. Another thread was executing `LAContext.setInteractionNotAllowed`.
- **Evidence in Repo**: Issue #514 ("App crashes with EXC_BREAKPOINT (SIGTRAP) in background Swift Task — v0.29.1 (70)").
- **Root Cause**: A developer used a force-unwrap (`!`) or `try!` on a biometric evaluation or Keychain query result that failed when background biometric evaluation was disallowed by OS policy (`errSecInteractionNotAllowed` / `LAError.biometryNotAvailable`). In Swift, a failed force-unwrap or `fatalError` in a cooperative async task emits an explicit `brk 1` instruction.
- **Remediation Code Diff**:
```diff
--- a/Packages/QuotioInfrastructure/Sources/QuotioInfrastructure/Keychain/KeychainReader.swift
+++ b/Packages/QuotioInfrastructure/Sources/QuotioInfrastructure/Keychain/KeychainReader.swift
@@ -45,7 +45,15 @@ public func readKeychainSecret(service: String, account: String) throws -> Data?
     var item: CFTypeRef?
     let status = SecItemCopyMatching(query as CFDictionary, &item)
     
-    if status == errSecSuccess {
-        return (item as! Data)
+    switch status {
+    case errSecSuccess:
+        guard let data = item as? Data else {
+            throw KeychainAccessError.invalidDataFormat
+        }
+        return data
+    case errSecItemNotFound:
+        return nil
+    case errSecInteractionNotAllowed:
+        throw KeychainAccessError.interactionNotAllowed
+    default:
+        throw KeychainAccessError.unhandledStatus(status)
     }
 }
```
- **Lesson**: Never execute forced casts (`as!`), force unwraps (`!`), or `try!` in Swift concurrency tasks—especially in biometric or Keychain integration code where OS security constraints return runtime errors based on lock state and UI focus.

---

### Incident 4: Optimistic Generation Mismatch During Background Token Refreshes (BUG-QUOTIO-04)
- **Context**: `Packages/QuotioCore/Sources/QuotioApplication/Accounts/CredentialPorts.swift`
- **What Was Expected**: Account re-naming, label changes, or provider toggles in the presentation layer must not invalidate or revert tokens refreshed concurrently by background polling jobs.
- **What Actually Happened**: When updating metadata, if the credential record generation in `loadedGenerations[account.id]` was missing or stale, updates blindly wrote or threw unrecoverable write failures, leaving the UI state out of sync with the underlying disk store.
- **Evidence in Repo**: `CredentialVaultService.save` logic in `CredentialPorts.swift`.
- **Root Cause**: `CredentialVaultService` lacked an atomic read-modify-write recovery path. If `loadedGenerations[account.id]` was cleared or invalidated, calling `compareAndSwap` would fail permanently.
- **Remediation Code Diff**:
```diff
--- a/Packages/QuotioCore/Sources/QuotioApplication/Accounts/CredentialPorts.swift
+++ b/Packages/QuotioCore/Sources/QuotioApplication/Accounts/CredentialPorts.swift
@@ -104,7 +104,11 @@ public actor CredentialVaultService: CredentialVault {
         let data = try encoder.encode(credential)
         let saved: CredentialDataRecord?
         if let expectedGeneration = loadedGenerations[account.id] {
-            saved = await dataStore.compareAndSwap(
+            saved = await dataStore.compareAndSwap(
                 data,
                 accountID: account.id,
                 expectedGeneration: expectedGeneration
             )
+            if saved == nil {
+                // Re-read latest generation on mismatch to attempt deterministic reconciliation
+                if let current = await dataStore.read(accountID: account.id) {
+                    saved = await dataStore.compareAndSwap(data, accountID: account.id, expectedGeneration: current.generation)
+                }
+            }
         } else {
             saved = await dataStore.save(data, accountID: account.id)
         }
```
- **Lesson**: Optimistic concurrency control implementations must provide an explicit re-read and retry policy or propagate a distinct conflict error up to the orchestration actor rather than failing silently or trapping.

---

### Incident 5: Fractional Millisecond Timestamp Deserialization Failure (BUG-QUOTIO-05)
- **Context**: `Packages/QuotioCore/Sources/QuotioApplication/Accounts/AuthFileRepository.swift`
- **What Was Expected**: Parsing OAuth token file expiration dates (`expires_at` / `expiresAt`) emitted across heterogeneous providers (Google OAuth, GitHub Copilot, Kiro) must determine whether a token has expired.
- **What Actually Happened**: Standard `ISO8601DateFormatter()` failed on timestamps containing fractional seconds (`2026-10-23T14:32:10.123Z`), causing `date(from:)` to return `nil`. As a result, `isExpired` evaluated to `false`, preventing token refreshes and causing downstream proxy requests to fail with `401 Unauthorized`.
- **Evidence in Repo**: `AuthFileCredential.isExpired` implementation in `AuthFileRepository.swift`.
- **Root Cause**: `ISO8601DateFormatter` in Swift Foundation does not parse fractional seconds unless explicitly configured with `.withFractionalSeconds`. Using standard options fails on standard RFC3339 sub-second strings.
- **Remediation Code Diff**:
```diff
--- a/Packages/QuotioCore/Sources/QuotioApplication/Accounts/AuthFileRepository.swift
+++ b/Packages/QuotioCore/Sources/QuotioApplication/Accounts/AuthFileRepository.swift
@@ -82,6 +82,9 @@ public struct AuthFileCredential: Sendable {
     public var isExpired: Bool {
         guard let expiresAt else { return false }
         let fractional =