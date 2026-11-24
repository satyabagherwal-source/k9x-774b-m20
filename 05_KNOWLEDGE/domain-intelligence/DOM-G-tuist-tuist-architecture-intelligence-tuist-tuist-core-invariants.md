# Domain G — Architecture Intelligence: Architecture Intelligence: tuist/tuist Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "tuist/tuist",
  "source_url": "https://github.com/tuist/tuist",
  "source_version": "0d1e4df6",
  "license": "NOASSERTION",
  "timestamp": "2026-11-24T02:04:11.242Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-tuist-tuist",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tuist/tuist](https://github.com/tuist/tuist) (Revision: `0d1e4df6`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-24T02:04:11.242Z`  
> **Learning ID**: `learn-github-tuist-tuist`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), K (Quality & Verification Intelligence), D (Research & Knowledge Intelligence), F (Design Intelligence), M (Feedback & Evolution Intelligence), L (Deployment & Operations Intelligence), I (Content & Information Intelligence), A (Human & Need Intelligence)
- **Confidence Rating**: 60%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from tuist/tuist:

# Forensic Learning Record (Deep Inspection): tuist/tuist

> **Canonical Artifact**: `07_PROJECT_LEARNING/tuist-tuist-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tuist/tuist](https://github.com/tuist/tuist))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-24T02:04:09.668Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tuist/tuist`
- **Description**: Tuist builds infrastructure for faster, more reliable build and test workflows across developers, CI, and coding agents. Shared cache, tests, and insights that sit alongside your existing CI.
- **Primary Language / Ecosystem**: Elixir
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5869 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `android/app/src/main/java/dev/tuist/app/data/model/AuthState.kt`
```
package dev.tuist.app.data.model

sealed interface AuthState {
    data class LoggedIn(val account: Account) : AuthState
    data object LoggedOut : AuthState
    data object Authenticating : AuthState
}

```

### Core Architecture Module: `app/Sources/TuistAuthentication/AuthenticationState.swift`
```
import Foundation
import TuistAppStorage

public struct Account: Equatable, Codable {
    public let email: String
    public let handle: String

    public init(email: String, handle: String) {
        self.email = email
        self.handle = handle
    }
}

public enum AuthenticationState: Equatable {
    /// `server` is the self-hosted server the session belongs to, or `nil` for Tuist-hosted.
    case loggedIn(account: Account, server: AppServerConfiguration? = nil)
    case loggedOut
}

/// Tuist-hosted sessions keep the format older app versions read. Self-hosted sessions use a key
/// those versions don't recognize, so after a downgrade they fall back to logged out instead of
/// treating the session as Tuist-hosted.
extension AuthenticationState: Codable {
    private enum CodingKeys: String, CodingKey {
        case loggedIn
        case loggedInSelfHosted
        case loggedOut
    }

    private struct Session: Codable {
        let account: Account
        let server: AppServerConfiguration?
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let session = try container.decodeIfPresent(Session.self, forKey: .loggedInSelfHosted) {
            self = .loggedIn(account: session.account, server: session.server)
        } else if let session = try container.decodeIfPresent(Session.self, forKey: .loggedIn) {
            self = .loggedIn(account: session.account)
        } else if container.contains(.loggedOut) {
            self = .loggedOut
        } else {
            throw DecodingError.dataCorrupted(
                DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Unknown authentication state")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case let .loggedIn(account, nil):
            try container.encode(Session(account: account, server: nil), forKey: .loggedIn)
        case let .loggedIn(account, server):
            try container.encode(Session(account: account, server: server), forKey: .loggedInSelfHosted)
        case .loggedOut:
            try container.encode([String: String](), forKey: .loggedOut)
        }
    }
}

public struct AuthenticationStateKey: AppStorageKey {
    public static let key = "authenticationState"
    public static let defaultValue: AuthenticationState = .loggedOut
}

```

### Core Architecture Module: `app/Sources/TuistMenuBar/Utilities/ErrorHandling.swift`
```
import AppKit
import Foundation
import OpenAPIRuntime
import TuistAuthentication
import TuistHTTP
import TuistLogging
import TuistServer
import TuistSupport

final class ErrorHandling: ObservableObject, Sendable {
    func handle(error: Error) {
        let handle = handle
        DispatchQueue.main.async {
            let alert = NSAlert()
            if let error = error as? FatalError {
                alert.messageText = error.description
            } else if error is ClientAuthenticationError {
                // When we fail to authenticate, we sign out the user and force them to sign in again.
                Task {
                    try await ServerCredentialsStore.current.delete(serverURL: AppServerEnvironmentService().url())
                }
                return
            } else if let error = error as? ClientError {
                handle(error.underlyingError)
                return
            } else {
                alert.messageText = error.localizedDescription
            }
            alert.alertStyle = .warning
            alert.runModal()
        }
    }
}

extension ErrorHandling {
    func fireAndHandleError(_ action: @escaping () async throws -> Void) {
        Task {
            do {
                try await action()
            } catch {
                handle(error: error)
            }
        }
    }
}

```

### Core Architecture Module: `app/Sources/TuistMenuBar/Utilities/ErrorViewHandling.swift`
```
import Foundation
import SwiftUI

protocol ErrorViewHandling: View {
    var errorHandling: ErrorHandling { get }
}

extension ErrorViewHandling {
    func tryWithErrorHandler(_ operation: @escaping () async throws -> Void) {
        Task {
            do {
                try await operation()
            } catch {
                errorHandling.handle(error: error)
            }
        }
    }

    func tryWithErrorErrorHandler(_ operation: @escaping () throws -> Void) {
        do {
            try operation()
        } catch {
            errorHandling.handle(error: error)
        }
    }
}

```

### Core Architecture Module: `app/Sources/TuistMenuBar/Utilities/StatusReporter/TaskProgress.swift`
```
import Foundation

/// The progress of a running task.
enum TaskProgress: Equatable {
    /// The task does not report progress.
    case indeterminate
    /// The task has measurable progress.
    case determinate(totalUnitCount: Double, pendingUnitCount: Double)
}

```

### Core Architecture Module: `app/Sources/TuistMenuBar/Utilities/StatusReporter/TaskState.swift`
```
import Foundation

/// The state of a running task.
enum TaskState: Equatable {
    /// The task is preparing to run.
    case preparing
    /// The task is currently running.
    case running(message: String, progress: TaskProgress = .indeterminate)
    /// The task is fully complete and will not perform any further operations.
    case done(message: String?)
}

```

### Core Architecture Module: `app/Sources/TuistMenuBar/Utilities/StatusReporter/TaskStatus.swift`
```
import Foundation

/// The status of one running task.
///
/// A `TaskStatus` can be updated over time in the context of the task it
/// represents to notify subscribers that the status of the task has changed.
///
/// You must tell the application about the task status for it to be reported in the
/// UI. To do this, the task must be registered in the application's task status
/// reporter using ``TaskStatusReporter/register(taskStatus:)``.
final class TaskStatus: Identifiable, ObservableObject {
    typealias ID = String

    let id: ID
    let displayName: String

    @Published private(set) var state: TaskState

    init(displayName: String, initialState state: TaskState) {
        id = UUID().uuidString
        self.displayName = displayName
        self.state = state
    }

    /// Updates the state of the task.
    /// - Parameter state: The new state of the task.
    @MainActor func update(state: TaskState) {
        self.state = state
    }

    /// Convenience for setting the state of the task to ``TaskState/done``.
    @MainActor func markAsDone(
        message: String? = nil
    ) {
        update(state: .done(message: message))
    }
}

// MARK: - Hashable

extension TaskStatus: Hashable {
    static func == (lhs: TaskStatus, rhs: TaskStatus) -> Bool {
        lhs.id == rhs.id
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
}

```

### Core Architecture Module: `app/Sources/TuistMenuBar/Utilities/StatusReporter/TaskStatusReporter.swift`
```
import AppKit
import Collections
import Combine
import Mockable

@Mockable
protocol TaskStatusReporting: ObservableObject {
    @MainActor func add(status: TaskStatus)
}

/// Manages task statuses and publishes changes to them.
final class TaskStatusReporter: TaskStatusReporting {
    private var cancellables: Set<AnyCancellable> = []

    /// A set of the statuses of all currently active tasks.
    @Published private(set) var statuses: OrderedSet<TaskStatus> = [] {
        didSet {
            updateSubscriptions()
        }
    }

    /// Adds a task status.
    ///
    /// When a task reaches a ``TaskState/done`` state, the status is
    /// automatically removed from the list of tasks after a short delay.
    /// - Parameter status: The task status to add.
    @MainActor func add(status: TaskStatus) {
        var cancellable: AnyCancellable?
        cancellable = status.$state
            .sink { taskState in
                _ = cancellable

                switch taskState {
                case .done:
                    cancellable = nil
                case .preparing, .running:
                    break
                }
            }

        statuses = statuses.filter {
            switch $0.state {
            case .done:
                return false
            case .preparing, .running:
                return true
            }
        }
        statuses.append(status)
    }

    /// Removes a task status.
    /// - Parameters:
    ///   - status: The task status to remove.
    ///   - withDelay: Whether to delay removal by a few seconds.
    @MainActor func remove(status: TaskStatus, withDelay: Bool = false) {
        Task {
            if withDelay {
                try await Task.sleep(for: .seconds(2))
            }

            statuses.remove(status)
        }
    }

    private func updateSubscriptions() {
        let newCancellables = statuses.map { taskStatus in
            taskStatus.objectWillChange.sink { [weak self] in
                self?.objectWillChange.send()
            }
        }

        cancellables = Set(newCancellables)
    }
}

```

### Core Architecture Module: `app/Sources/TuistMenuBar/Views/AppPreviews/AppPreviewsEmptyStateView.swift`
```
import SwiftUI

struct AppPreviewsEmptyStateView: View {
    var body: some View {
        VStack(alignment: .center, spacing: 4) {
            Text("No Previews")

            Text("Install latest previews with one click.")
                .font(.caption2)
                .opacity(0.8)
                .foregroundColor(.secondary)
        }
        .padding(.bottom, 4)
        .frame(minWidth: 0, maxWidth: .infinity)
        .multilineTextAlignment(.center)
    }
}

```

### Core Architecture Module: `app/Sources/TuistPreviews/PreviewsView/PreviewsEmptyStateView.swift`
```
import SwiftUI
import TuistNoora

struct PreviewsEmptyStateView: View {
    let title: LocalizedStringKey
    let subtitle: LocalizedStringKey

    var body: some View {
        VStack(spacing: Noora.Spacing.spacing6) {
            Image("iPhoneMockup")
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: 120, height: 240)
                .shadow(color: Color.black.opacity(0.09), radius: 4.28, x: 0, y: 3.67)
                .shadow(color: Color.black.opacity(0.08), radius: 8.56, x: 0, y: 17.11)
                .shadow(color: Color.black.opacity(0.05), radius: 11.0, x: 0, y: 37.89)
                .shadow(color: Color.black.opacity(0.01), radius: 13.45, x: 0, y: 66.0)
                .padding(.top, Noora.Spacing.spacing8)

            Text(title)
                .font(.title3.weight(.medium))
                .foregroundColor(Noora.Colors.surfaceLabelSecondary)
                .multilineTextAlignment(.center)

            Text(subtitle)
                .font(.subheadline)
                .foregroundColor(Noora.Colors.surfaceLabelSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Noora.Spacing.spacing8)
        .padding(.horizontal, Noora.Spacing.spacing7)
        .listRowSeparator(.hidden)
        .listRowInsets(EdgeInsets())
        .listRowBackground(Noora.Colors.surfaceBackgroundPrimary)
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #15827** (2026-11-23): **feat(cli): backport parallel resumable shard downloads to 4.219.x**
  *Symptoms*: Backports e1844304643c3d40af1a9d3f4137277c557be8d5 to the 4.219 line, so it ships with next Monday's stable 4.219.0 (promoted from 4.219.0-rc.2).  ## What  `tuist test --shard-index` downloads shard artifacts with the new `FileClient.downloadInParallel`. It requests the first 8 MiB to get the object's size and ETag, then fetches the rest as up to eight byte ranges at once, each on its own large-transfer session. Without separate sessions, an HTTP/2 host puts every range on one connection. If an attempt fails, the retry asks each range only for the bytes it hasn't received yet. Every 206 must start at the requested offset and carry the ETag from the first request. Tigris ignores `If-Range`, so `If-Range` alone isn't enough. On a 200, a 416 or a changed object, the download falls back to the existing single-stream resumable `download`.  ## Why  A single GET is limited by one TCP stream. From GitHub-hosted Macs in the US to RustFS in Gravelines that's about 160 Mbit/s, so a 500 MiB artifact took about 26 s. Tigris's US region took about 18 s for the same artifact. Customers off our runners, such as Zocdoc, can't move off Tigris until downloads are at least as fast. Tigris has timed out on these downloads twice, on Oct 22 and Nov 16, and each retry started the download over from zero.  ## Validation  - On a Tuist macOS sandbox, `FileClientTests` and `ShardServiceTests` passed five iterations each, run on main (50 and 45 runs). The new tests cover resuming a single failed range, a
  **Post-Mortem & Fix Analysis**:
  > ### 🛠️ Tuist Run Report 🛠️  #### Previews 📦  | App | Commit | | - | - | | [tuist](https://tuist.dev/tuist/tuist/previews/01a208d7-82d8-7cc7-80d9-823e215de0aa)<br/>`tuist run https://tuist.dev/tuist/tuist/previews/01a208d7-82d8-7cc7-80d9-823e215de0aa` | [50895a925](https://github.com/tuist/tuist/commit/50895a925aa37b58a6273042bc0b82c91ea41a11) |   #### Tests 🧪  | Scheme | Status | Module cache hit rate | Xcode cache hit rate | Ran test modules | Commit | |:-:|:-:|:-:|:-:|:-:|:-:| | [TuistAcceptanceTests](https://tuist.dev/tuist/tuist/tests/test-runs/c3e9ca62-61e7-4a57-bd76-3f2c2059e984) | ✅ | 89 % | 41 % | 6/6 | [50895a925](https://github.com/tuist/tuist/commit/50895a925aa37b58a6273042bc0b82c91ea41a11) | | [TuistApp](https://tuist.dev/tuist/tuist/tests/test-runs/ff0edf85-df21-40a4-b21f-30a4ee65d6f7) | ✅ | 93 % | 69 % | 1/1 | [50895a925](https://github.com/tuist/tuist/commit/50895a925aa37b58a6273042bc0b82c91ea41a11) | | [TuistAppSnapshots](https://tuist.dev/tuist/tuist/tests/test-run

- **Issue #15826** (2026-11-24): **chore(cli): update Tuist CLI to 4.220.0-canary.7**
  *Symptoms*: Bumps the `tuist` dev-tooling pin in `mise.toml` and `luft/mise.toml` to `4.220.0-canary.7` (latest release, including canary prereleases) with `mise.lock` regenerated in the same commit so CI's `MISE_LOCKED=1` install resolves, and the sandbox image's Tuist CLI to the same release.  Opened by the `update-tuist-cli` workflow.
  **Post-Mortem & Fix Analysis**:
  > ### 🛠️ Tuist Run Report 🛠️  #### Previews 📦  | App | Commit | | - | - | | [tuist](https://tuist.dev/tuist/tuist/previews/01a20aaf-7de4-7904-a7b4-85167ac85b6f)<br/>`tuist run https://tuist.dev/tuist/tuist/previews/01a20aaf-7de4-7904-a7b4-85167ac85b6f` | [27c96bcc0](https://github.com/tuist/tuist/commit/27c96bcc09e27ea7ff898c4521044687c1185fa5) |   #### Tests 🧪  | Scheme | Status | Ran test modules | Commit | |:-:|:-:|:-:|:-:| | [TuistAcceptanceTests](https://tuist.dev/tuist/tuist/tests/test-runs/01a20b3b-419d-71dc-bd77-b7ddae31072b) | ✅ | 0/6 | [98f242091](https://github.com/tuist/tuist/commit/98f242091040d6d0c3a8e16e66f9b6b95bd183f2) | | [TuistApp](https://tuist.dev/tuist/tuist/tests/test-runs/01a20b3a-b3c5-74f5-9365-319b106cc724) | ✅ | 0/1 | [98f242091](https://github.com/tuist/tuist/commit/98f242091040d6d0c3a8e16e66f9b6b95bd183f2) | | [TuistAppSnapshots](https://tuist.dev/tuist/tuist/tests/test-runs/01a20b3a-d182-7f98-b4d7-f0ab655bfa3c) | ✅ | 0/1 | [98f242091](https://github.com/

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

### Incident Patch 1: `4b0405f1` (2026-11-23)
**Commit Message**: fix(kura): set aside floor memory for write replies

A BatchUpdateBlobs or UpdateActionResult reserves its reply from the floor
without waiting. While a read waits on a full floor, the semaphore hands
every released permit to that waiter first, so each try-only reply was
refused however small it was. Under a read burst nearly every write was
refused with RESOURCE_EXHAUSTED and filed as a decode refusal.

Floors of 64 MiB or more now keep a 1 MiB slice that only write replies
draw on, still floor memory and never borrowed headroom. Limits sized
from the floor keep using the whole floor. Reply refusals get their own
memory action, grpc_write_reply_admission_rejected.

Mixed read/write stress against main (3 runs each, 45-60 readers plus
16 zstd writers): refused write items per phase went from about 1,800 to
0, written bytes from about 190 MiB to 650 MiB, write latency from about
100 ms to 34 ms; read throughput, latency and CPU unchanged within noise.

Amp-Thread-ID: https://ampcode.com/threads/T-01a20777-066f-74ac-8b42-e8e6416e81d8
Co-authored-by: Marek Fort <[REDACTED_EMAIL]>

**File**: `infra/helm/k8s-monitoring/alerts.md` (modified, +9/-6)
```diff
@@ -5538,17 +5538,20 @@ The transient budget on the remote-execution surface: decoding a write's
 messages, staging a ByteStream upload, decoding a compressed `BatchUpdateBlobs`
 item, or a write whose reply the floor cannot cover, each refused before it
 stores anything. The counter is the only place it shows. ByteStream staging
-refusals (`bytestream_staging_admission_rejected`) and decode refusals
-(`grpc_write_decode_admission_rejected`) both file under this kind; the memory
+refusals (`bytestream_staging_admission_rejected`), decode refusals
+(`grpc_write_decode_admission_rejected`) and reply refusals
+(`grpc_write_reply_admission_rejected`) all file under this kind; the memory
 action separates them.
 
 Write decoding and staging borrow the ceiling headroom above the
 floor-derived budget while pressure is normal, so a shed means the pod spent
 its floor *and* that headroom, or it was above normal pressure and the borrow
-was closed. The one exception is a write's reply, which never borrows: it is
-refused when the floor cannot cover it, which happens only after that write's
-own decode borrowed, so `transient_ceiling_headroom_borrowed` in
-`kura_memory_actions_total_total` rises in the same window. A shed burst with
+was closed. The one exception is a write's reply, which never borrows: it draws
+on a 1 MiB slice of the floor set aside for replies (outside
+`kura_memory_transient_capacity_bytes`), so reads queued on a full floor cannot
+refuse it. Reply refusals mean that slice and the shared floor were both spent;
+older pods without the slice refused every write behind a queued read, filed
+as decode refusals. A shed burst with
 no borrows at normal pressure is a pod predating compressed items borrowing,
 which refused them on a full floor with the headroom idle. Read
 `kura_memory_elastic_transient_reserved_bytes` against
```

**File**: `kura/README.md` (modified, +1/-1)
```diff
@@ -462,7 +462,7 @@ The second estimate applies to default 60%/85% watermarks without a limiting mem
 
 Prefer reducing client concurrency or increasing pod memory before overriding `KURA_MEMORY_SOFT_LIMIT_BYTES` / `KURA_MEMORY_HARD_LIMIT_BYTES`. Lowering the soft watermark sheds optional work earlier; raising the hard watermark reduces the safety reserve beneath the container limit. Neither creates physical memory. Use explicit watermarks only after measuring the application's baseline and mixed-load peaks.
 
-Watch `kura_memory_transient_{capacity,reserved}_bytes`, `kura_memory_elastic_transient_{capacity,reserved}_bytes`, pressure state, and `kura_memory_actions_total_total{action="bytestream_staging_admission_rejected"}` / `grpc_write_decode_admission_rejected`, together with `kura_capacity_sheds_total_total`. Short bursts can be absorbed by bounded client retries, including against older Kura versions without RetryInfo. Persistent refusals mean the offered concurrency exceeds capacity or requests exceed an individual budget; longer retries alone do not fix that.
+Watch `kura_memory_transient_{capacity,reserved}_bytes`, `kura_memory_elastic_transient_{capacity,reserved}_bytes`, pressure state, and `kura_memory_actions_total_total{action="bytestream_staging_admission_rejected"}` / `grpc_write_decode_admission_rejected` / `grpc_write_reply_admission_rejected`, together with `kura_capacity_sheds_total_total`. Short bursts can be absorbed by bounded client retries, including against older Kura versions without RetryInfo. Persistent refusals mean the offered concurrency exceeds capacity or requests exceed an individual budget; longer retries alone do not fix that.
 
 ## 📊 Observability
 
```

**File**: `kura/crates/kura-core/src/memory/mod.rs` (modified, +78/-12)
```diff
@@ -428,6 +428,18 @@ impl MemoryController {
         self.inner.pools.elastic_transient_capacity_bytes() as u64
     }
 
+    /// Floor bytes set aside for write replies, outside
+    /// `transient_capacity_bytes`.
+    pub fn write_reply_reserve_bytes(&self) -> u64 {
+        self.inner.pools.write_reply_reserve_bytes() as u64
+    }
+
+    /// Floor bytes held, across the shared floor pool and the slice set aside
+    /// for write replies.
+    pub fn floor_reserved_bytes(&self) -> u64 {
+        self.transient_reserved_bytes() + self.inner.pools.write_reply_reserved_bytes() as u64
+    }
+
     pub fn elastic_transient_reserved_bytes(&self) -> u64 {
         self.inner.pools.elastic_transient_reserved_bytes() as u64
     }
@@ -455,11 +467,13 @@ impl MemoryController {
     /// independent byte permits. Pressure stops elastic borrowing and halves
     /// ceiling-derived capacity. Already-open sessions may drain above this cap.
     pub fn multipart_upload_capacity(&self) -> usize {
+        // Sized from the whole floor, the reply slice included, like the other
+        // floor-derived limits.
+        let floor_bytes = self.transient_capacity_bytes() + self.write_reply_reserve_bytes();
+        let ceiling_bytes = floor_bytes + self.elastic_transient_capacity_bytes();
         let capacity_bytes = match self.pressure() {
-            MemoryPressure::Normal => self.foreground_transient_capacity_bytes(),
-            MemoryPressure::Constrained => self
-                .transient_capacity_bytes()
-                .min(self.foreground_transient_capacity_bytes() / 2),
+            MemoryPressure::Normal => ceiling_bytes,
+            MemoryPressure::Constrained => floor_bytes.min(ceiling_bytes / 2),
             MemoryPressure::Critical => return 0,
         };
         usize::try_from(capacity_bytes / (1024 * 1024))
@@ -1675,7 +1689,7 @@ mod tests {
             None,
         );
         assert_eq!(
-            unbounded.transient_capacity_bytes(),
+            unbounded.transient_capacity_bytes() + unbounded.write_reply_reserve_bytes(),
             ceiling_headroom as u64
         );
 
@@ -1687,7 +1701,10 @@ mod tests {
             hard_limit,
             Some(anon_budget),
         );
-        assert_eq!(bounded.transient_capacity_bytes(), anon_budget);
+        assert_eq!(
+            bounded.transient_capacity_bytes() + bounded.write_reply_reserve_bytes(),
+            anon_budget
+        );
         assert!(bounded.transient_capacity_bytes() < unbounded.transient_capacity_bytes());
 
         // A floor roomier than the ceiling allows cannot inflate the budget past
@@ -1699,7 +1716,10 @@ mod tests {
             hard_limit,
             Some(runtime_limit * 4),
         );
-        assert_eq!(generous.transient_capacity_bytes(), ceiling_headroom as u64);
+        assert_eq!(
+            generous.transient_capacity_bytes() + generous.write_reply_reserve_bytes(),
+            ceiling_headroom as u64
+        );
     }
 
     /// A controller whose floor-derived budget is a fraction of its ceiling
@@ -1717,22 +1737,28 @@ mod tests {
             forced,
             Some(anon_budget),
         );
-        (controller, anon_budget, hard_limit - soft_limit)
+        // The shared floor pool: the published floor less the reply slice.
+        let floor_pool = controller.transient_capacity_bytes();
+        assert_eq!(
+            floor_pool + controller.write_reply_reserve_bytes(),
+            anon_budget
+        );
+        (controller, floor_pool, hard_limit - soft_limit)
     }
 
     #[test]
     fn the_elastic_pool_is_exactly_the_headroom_the_floor_clamp_discards() {
-        let (controller, anon_budget, ceiling_headroom) = elastic_controller(None);
+        let (controller, floor_pool, ceiling_headroom) = elastic_controller(None);
+        let reply_slice = controller.write_reply_reserve_bytes();
 
-        assert_eq!(controller.transient_capacity_bytes(), anon_budget);
         assert_eq!(
             controller.elastic_transient_capacity_bytes(),
-            ceiling_headroom - anon_budget
+            ceiling_headroom - floor_pool - reply_slice
         );
         // Borrowing can never take anonymous admission past what a node with no
         // published floor would already have granted.
         assert_eq!(
-            controller.foreground_transient_capacity_bytes(),
+            controller.foreground_transient_capacity_bytes() + reply_slice,
             ceiling_headroom
         );
     }
@@ -1815,6 +1841,46 @@ mod tests {
         assert!(held.try_resize(0).is_ok());
     }
 
+    // A read queued on a full floor takes every permit the floor releases, so
+    // a try-only reply there fails however small it is. Replies draw on their
+    // own floor slice instead, or a read burst refuses every write.
+    #[tokio::test]
+    async fn a_write_reply_is_admitted_while_a_read_waits_on_a_full_floor() {
+        let (controller, _, _) = elastic_controller(None);
+        let f
```

**File**: `kura/crates/kura-core/src/memory/pools.rs` (modified, +40/-5)
```diff
@@ -13,6 +13,11 @@ const MIN_REAPI_RESPONSE_BUDGET_BYTES: usize = 8 * 1024 * 1024;
 const MAX_REAPI_RESPONSE_BUDGET_BYTES: usize = 64 * 1024 * 1024;
 const MAX_REAPI_MATERIALIZATION_POOL_BYTES: usize = 128 * 1024 * 1024;
 const MAX_MMAP_SERVING_POOL_BYTES: usize = 512 * 1024 * 1024;
+/// Slice of the floor set aside for write replies. A reply is a few hundred
+/// bytes per item, so this covers thousands of concurrent items. Floors below
+/// `MIN_FLOOR_FOR_WRITE_REPLY_RESERVE_BYTES` keep the whole floor shared.
+const WRITE_REPLY_RESERVE_BYTES: usize = 1024 * 1024;
+const MIN_FLOOR_FOR_WRITE_REPLY_RESERVE_BYTES: usize = 64 * WRITE_REPLY_RESERVE_BYTES;
 const MAX_ENCODED_RESPONSE_STREAM_CHUNK_BYTES: usize =
     RESPONSE_STREAM_CHUNK_BYTES + RESPONSE_STREAM_MIN_CHUNK_BYTES;
 const MAX_RESPONSE_STREAM_RESERVATION_BYTES: usize = MAX_ENCODED_RESPONSE_STREAM_CHUNK_BYTES * 4;
@@ -32,6 +37,13 @@ pub(super) struct MemoryPools {
     /// Caps how much of the elastic pool borrowed batch-read responses may
     /// hold at once. The whole elastic pool.
     read_borrow: Arc<Semaphore>,
+    /// Floor bytes only write replies draw on. A reply is reserved without
+    /// waiting, and a semaphore hands every released permit to its queued
+    /// waiters first, so while a read waits on the shared floor every
+    /// try-only acquisition there fails, however small. Carved out of the
+    /// floor, so it is protected memory like the rest of it.
+    write_reply: Arc<Semaphore>,
+    write_reply_reserve_bytes: usize,
     reapi_materialization_limit_bytes: usize,
     foreground_response_streaming: Arc<Semaphore>,
     elastic_foreground_response_streaming: Arc<Semaphore>,
@@ -68,9 +80,15 @@ impl MemoryPools {
         // it, which keeps the floor-to-ceiling gap for page cache and
         // mmap-served segments instead. Without one, fall back to the
         // ceiling-derived headroom.
-        let transient_capacity_bytes = semaphore_capacity(
+        let floor_bytes = semaphore_capacity(
             anon_budget_bytes.map_or(headroom_bytes, |budget| budget.min(headroom_bytes)),
         );
+        let write_reply_reserve_bytes = if floor_bytes >= MIN_FLOOR_FOR_WRITE_REPLY_RESERVE_BYTES {
+            WRITE_REPLY_RESERVE_BYTES
+        } else {
+            0
+        };
+        let transient_capacity_bytes = floor_bytes - write_reply_reserve_bytes;
         // What the floor clamp above discards, held in its own pool. A caller
         // that opts in may draw on it while pressure is normal, so a burst that
         // outgrows the floor is answered from headroom the ceiling already
@@ -81,9 +99,8 @@ impl MemoryPools {
         // floor is unprotected by `memory.min`, so it must stop being granted
         // before the kernel is left with the OOM killer as its only remedy.
         let elastic_transient_capacity_bytes =
-            semaphore_capacity(headroom_bytes).saturating_sub(transient_capacity_bytes);
-        let reapi_materialization_limit_bytes =
-            reapi_materialization_limit_bytes(transient_capacity_bytes);
+            semaphore_capacity(headroom_bytes).saturating_sub(floor_bytes);
+        let reapi_materialization_limit_bytes = reapi_materialization_limit_bytes(floor_bytes);
         let mmap_serving_bytes = mmap_serving_bytes(headroom_bytes);
         let response_streaming_bytes =
             response_streaming_pool_bytes(runtime_limit_bytes, hard_limit_bytes, headroom_bytes);
@@ -98,7 +115,7 @@ impl MemoryPools {
         // metrics, and enforce it through this exact partition.
         let elastic_foreground_response_streaming_bytes =
             elastic_foreground_response_streaming_bytes(
-                transient_capacity_bytes,
+                floor_bytes,
                 response_streaming_bytes,
                 foreground_response_streaming_bytes,
             );
@@ -134,6 +151,8 @@ impl MemoryPools {
             transient_capacity_bytes,
             elastic_transient_capacity_bytes,
             read_borrow: Arc::new(Semaphore::new(elastic_transient_capacity_bytes)),
+            write_reply: Arc::new(Semaphore::new(write_reply_reserve_bytes)),
+            write_reply_reserve_bytes,
             reapi_materialization_limit_bytes,
             foreground_response_streaming: Arc::new(Semaphore::new(
                 foreground_response_streaming_bytes,
@@ -210,6 +229,22 @@ impl MemoryPools {
             .map_err(|_| ())
     }
 
+    pub(super) fn write_reply_reserve_bytes(&self) -> usize {
+        self.write_reply_reserve_bytes
+    }
+
+    pub(super) fn write_reply_reserved_bytes(&self) -> usize {
+        self.write_reply_reserve_bytes
+            .saturating_sub(self.write_reply.available_permits())
+    }
+
+    pub(super) fn try_acquire_write_reply(&self, permits: u32) -> Result<OwnedSemaphorePermit, ()> {
+        self.write_reply
+            .clone()
+            .try_acquire_many_owned(permits)
+            .map_err(|_| ())
+    }
+
     pub(super) fn ela
```

**File**: `kura/crates/kura-core/src/memory/reservation.rs` (modified, +28/-10)
```diff
@@ -296,10 +296,11 @@ impl Drop for ForegroundWaiter {
 }
 
 impl TransientMemoryReservation {
-    /// A floor-backed reservation of `bytes`: this reservation's floor-derived
-    /// bytes first, the floor pool for the rest, and never borrowed ceiling
-    /// headroom. Leaves this reservation untouched when the floor cannot cover
-    /// it.
+    /// A floor-backed reservation of `bytes` for a write's reply, never
+    /// borrowed ceiling headroom: this reservation's floor-derived bytes when
+    /// they cover it, else the floor slice set aside for replies, else this
+    /// reservation's floor bytes plus the shared floor pool for the rest.
+    /// Leaves this reservation untouched when none of them can cover it.
     fn try_split_off_floor_backed(&mut self, bytes: u64) -> Result<Self, ()> {
         let requested = usize::try_from(bytes).map_err(|_| ())?;
         let floor_held = self
@@ -308,15 +309,32 @@ impl TransientMemoryReservation {
             .map_or(0, OwnedSemaphorePermit::num_permits);
         let from_self = requested.min(floor_held);
         let from_pool = requested - from_self;
+        if from_pool > 0 {
+            if !self
+                .controller
+                .allow_transient_admission(AdmissionClass::Foreground)
+            {
+                return Err(());
+            }
+            // The shared floor refuses every try-only acquisition while a read
+            // is queued on it, so a reply tries its own slice first. The whole
+            // reply comes from the slice: permits of different semaphores
+            // cannot merge.
+            let permits = u32::try_from(requested).map_err(|_| ())?;
+            if let Ok(permit) = self.controller.inner.pools.try_acquire_write_reply(permits) {
+                return Ok(Self {
+                    controller: self.controller.clone(),
+                    permit: Some(permit),
+                    elastic_permit: None,
+                    _read_borrow_permit: None,
+                    elasticity: TransientElasticity::Fixed,
+                    bytes,
+                });
+            }
+        }
         let mut permit = match from_pool {
             0 => None,
             permits => {
-                if !self
-                    .controller
-                    .allow_transient_admission(AdmissionClass::Foreground)
-                {
-                    return Err(());
-                }
                 let permits = u32::try_from(permits).map_err(|_| ())?;
                 Some(self.controller.inner.pools.try_acquire_transient(permits)?)
             }
```

**File**: `kura/crates/kura-core/src/metrics.rs` (modified, +11/-0)
```diff
@@ -465,6 +465,7 @@ impl ReapiLatencyMetrics {
 
 pub struct GrpcWriteAdmissionMetrics {
     decode_rejected: Counter,
+    reply_rejected: Counter,
     staging_rejected: Counter,
     capacity_shed: Counter,
 }
@@ -475,6 +476,13 @@ impl GrpcWriteAdmissionMetrics {
         self.capacity_shed.inc();
     }
 
+    /// A write refused because the floor could not cover its reply, before
+    /// anything decoded. Same shed kind as decoding, its own memory action.
+    pub fn record_reply_rejected(&self) {
+        self.reply_rejected.inc();
+        self.capacity_shed.inc();
+    }
+
     pub fn record_staging_rejected(&self) {
         self.staging_rejected.inc();
         self.capacity_shed.inc();
@@ -943,6 +951,9 @@ impl Metrics {
             decode_rejected: memory_actions.get_or_create_owned(&MemoryActionLabels {
                 action: "grpc_write_decode_admission_rejected".to_owned(),
             }),
+            reply_rejected: memory_actions.get_or_create_owned(&MemoryActionLabels {
+                action: "grpc_write_reply_admission_rejected".to_owned(),
+            }),
             staging_rejected: memory_actions.get_or_create_owned(&MemoryActionLabels {
                 action: "bytestream_staging_admission_rejected".to_owned(),
             }),
```

**File**: `kura/crates/kura-core/src/store.rs` (modified, +5/-2)
```diff
@@ -24047,7 +24047,10 @@ mod tests {
             config.memory_soft_limit_bytes = 64 * MIB;
             config.memory_hard_limit_bytes = 128 * MIB;
         });
-        assert_eq!(store.memory.transient_capacity_bytes(), 64 * MIB);
+        assert_eq!(
+            store.memory.transient_capacity_bytes() + store.memory.write_reply_reserve_bytes(),
+            64 * MIB
+        );
         let upload_id = store
             .try_start_multipart_upload("acme", "ios", "builds", "large", "Module")
             .expect("session should start");
@@ -24063,7 +24066,7 @@ mod tests {
         // is charged one drop interval rather than the whole window.
         let _other_uploads = store
             .memory
-            .try_reserve_foreground_memory(48 * MIB)
+            .try_reserve_foreground_memory(store.memory.transient_capacity_bytes() - 16 * MIB)
             .expect("the pool should admit the other uploads");
 
         tokio::time::timeout(
```

**File**: `kura/crates/kura-reapi/src/admission.rs` (modified, +1/-1)
```diff
@@ -245,7 +245,7 @@ impl GrpcWriteAdmission {
             .file_cache
             .try_reserve_reply(bytes)
             .map_err(|_| {
-                self.metrics.record_decode_rejected();
+                self.metrics.record_reply_rejected();
                 write_admission_rejected(
                     "server is limiting concurrent remote-execution writes; retry the write",
                 )
```

---

### Incident Patch 2: `1ba60806` (2026-11-23)
**Commit Message**: fix(pulse): validate retained recovery and preserve fractional budgets

Validate source TTL against the aligned recovery scope before scheduling writes. Preserve nanosecond precision and checked wide multiplication for window budgets, and compare source age without constructing overflowing finite-TTL cutoffs.

Amp-Thread-ID: https://ampcode.com/threads/T-01a1fd73-6d99-72c6-b9b7-be982bd87267
Co-authored-by: Pedro Piñera Buendía <[REDACTED_EMAIL]>

**File**: `pulse/FORK.md` (modified, +5/-0)
```diff
@@ -62,6 +62,11 @@ covered by this list.
   expired preceding dirty window cannot consume the retained-window budget.
   SQL window planning rejects unrepresentable bounds before consuming dirty
   work instead of falling back to an unfiltered scan outside retention.
+  Retained recovery validates source TTL against the aligned lower bound on
+  its frozen clock before marking or writing work. Window budgets and splits
+  retain nanosecond precision so fractional strides cannot consume future bins.
+  Budget multiplication is checked without narrowing counts to 32 bits, and
+  finite TTL validation compares source age without overflowing timestamp cutoffs.
 - **Exact count-rollup prototype.** `tests/perf/count_aggregate_benchmark.py`
   compares raw dashboard-style counts with minute summaries plus uncovered raw
   rows in a disposable local database. Immutable ingestion batches and an
```

**File**: `pulse/src/flow/src/batching_mode/state.rs` (modified, +100/-25)
```diff
@@ -600,28 +600,40 @@ impl DirtyTimeWindows {
     /// Get the effective count of time windows, which is the number of time windows that can be
     /// used for query, compute from total time window range divided by `window_size`.
     pub fn effective_count(&self, window_size: &Duration) -> usize {
-        if self.windows.is_empty() {
+        if self.windows.is_empty() || window_size.is_zero() {
             return 0;
         }
-        let window_size =
-            chrono::Duration::from_std(*window_size).unwrap_or(chrono::Duration::zero());
-        let total_window_time_range =
-            self.windows
-                .iter()
-                .fold(chrono::Duration::zero(), |acc, (start, end)| {
-                    if let Some(end) = end {
-                        acc + end.sub(start).unwrap_or(chrono::Duration::zero())
-                    } else {
-                        acc + window_size
-                    }
-                });
-
-        // not sure window_size is zero have any meaning, but just in case
-        if window_size.num_seconds() == 0 {
-            0
-        } else {
-            (total_window_time_range.num_seconds() / window_size.num_seconds()) as usize
-        }
+        let total_nanos: u128 = self
+            .windows
+            .iter()
+            .map(|(start, end)| {
+                if let Some(end) = end {
+                    end.sub(start)
+                        .and_then(|duration| duration.to_std().ok())
+                        .unwrap_or_default()
+                        .as_nanos()
+                } else {
+                    window_size.as_nanos()
+                }
+            })
+            .sum();
+        usize::try_from(total_nanos / window_size.as_nanos()).unwrap_or(usize::MAX)
+    }
+
+    fn window_range(window_size: chrono::Duration, count: u128) -> Result<chrono::Duration, Error> {
+        let nanos = window_size
+            .to_std()
+            .ok()
+            .and_then(|duration| duration.as_nanos().checked_mul(count));
+        nanos
+            .and_then(|nanos| {
+                let seconds = u64::try_from(nanos / 1_000_000_000).ok()?;
+                chrono::Duration::from_std(Duration::new(seconds, (nanos % 1_000_000_000) as u32))
+                    .ok()
+            })
+            .context(UnexpectedSnafu {
+                reason: "time-window budget exceeds the supported duration range",
+            })
     }
 
     /// Generate all filter expressions consuming all time windows
@@ -639,7 +651,7 @@ impl DirtyTimeWindows {
         task_ctx: Option<&BatchingTask>,
     ) -> Result<Option<FilterExprInfo>, Error> {
         ensure!(
-            window_size.num_seconds() > 0,
+            window_size > chrono::Duration::zero(),
             UnexpectedSnafu {
                 reason: "window_size is zero, can't generate filter exprs",
             }
@@ -681,7 +693,7 @@ impl DirtyTimeWindows {
         }
 
         // get the first `window_cnt` time windows
-        let max_time_range = window_size * window_cnt as i32;
+        let max_time_range = Self::window_range(window_size, window_cnt as u128)?;
 
         let mut to_be_query = BTreeMap::new();
         let mut new_windows = self.windows.clone();
@@ -713,13 +725,14 @@ impl DirtyTimeWindows {
                 // too large a window, split it
                 // split at window_size * times
                 let surplus = max_time_range - cur_time_range;
-                if surplus.num_seconds() < window_size.num_seconds() {
+                if surplus < window_size {
                     // Skip splitting if surplus is smaller than window_size
                     break;
                 }
-                let times = surplus.num_seconds() / window_size.num_seconds();
+                let times =
+                    surplus.to_std().unwrap().as_nanos() / window_size.to_std().unwrap().as_nanos();
 
-                let split_offset = window_size * times as i32;
+                let split_offset = Self::window_range(window_size, times)?;
                 let split_at = start
                     .add_duration(split_offset.to_std().unwrap())
                     .context(TimeSnafu)?;
@@ -1198,6 +1211,68 @@ mod test {
         }
     }
 
+    #[test]
+    fn test_large_fractional_window_budget_preserves_future_dirty_work() {
+        for days in [30, 60] {
+            let mut dirty = DirtyTimeWindows::default();
+            let start = Timestamp::new_millisecond(0);
+            let boundary = Timestamp::new_millisecond(days * 24 * 3600 * 1000);
+            let end = Timestamp::new_millisecond(boundary.value() + 1);
+            dirty.add_window(start, Some(boundary));
+            let budget = dirty.effective_count(&Duration::from_millis(1));
+            assert_eq!(budget as i64, days * 86_400_000);
+            dirty.add_window(boundary, Some(end));
+            let selected = dirty
+                .gen_filter_exprs(
+                    "ts",
+              
```

**File**: `pulse/src/flow/src/batching_mode/task.rs` (modified, +15/-17)
```diff
@@ -569,17 +569,9 @@ impl BatchingTask {
             }
             .build()
         })?;
-        let now = Timestamp::new_second(
-            SystemTime::now()
-                .duration_since(UNIX_EPOCH)
-                .map_err(|err| {
-                    UnexpectedSnafu {
-                        reason: format!("Failed to read recovery wall clock: {err}"),
-                    }
-                    .build()
-                })?
-                .as_secs() as i64,
-        );
+        let now = self.evaluation_time.unwrap_or_else(|| {
+            Timestamp::current_time(common_time::timestamp::TimeUnit::Nanosecond)
+        });
         let lower = now
             .sub_duration(Duration::from_secs(expire_after))
             .map_err(BoxedError::new)
@@ -702,14 +694,18 @@ impl BatchingTask {
                     for (start, _) in windows {
                         oldest = oldest.min(*start);
                     }
-                    let cutoff = Timestamp::current_millis()
-                        .sub_duration(ttl)
-                        .map_err(BoxedError::new)
-                        .context(ExternalSnafu)?;
-                    if oldest <= cutoff {
+                    let now = self.evaluation_time.unwrap_or_else(|| {
+                        Timestamp::current_time(common_time::timestamp::TimeUnit::Nanosecond)
+                    });
+                    // Compare the source age instead of constructing a cutoff
+                    // that can precede the nanosecond timestamp range.
+                    let age = now.sub(&oldest).context(UnexpectedSnafu {
+                        reason: "Cannot compute source age for recovery retention validation",
+                    })?;
+                    if age.to_std().is_ok_and(|age| age >= ttl) {
                         return UnexpectedSnafu {
                             reason: format!(
-                                "Flow {} recovery requires source table {} data from {oldest:?}, older than TTL {ttl:?} cutoff {cutoff:?}",
+                                "Flow {} recovery requires source table {} data from {oldest:?}, at or beyond TTL {ttl:?} at {now:?}",
                                 self.config.flow_id,
                                 name.join(".")
                             ),
@@ -1000,6 +996,8 @@ impl BatchingTask {
             })),
             ..self.clone()
         };
+        task.validate_recovery_retention(task.recovery_retention_lower_bound()?, &[])
+            .await?;
         let window_count = task.mark_all_windows_as_dirty()?;
         task.execute_once_with_guard(guard, engine, frontend_client, window_count)
             .await
```

**File**: `pulse/src/flow/src/batching_mode/task/test.rs` (modified, +87/-0)
```diff
@@ -522,6 +522,7 @@ async fn test_retained_recovery_preserves_concurrent_arrivals() {
         ..
     } = new_time_window_test_task_with_query(query).await;
     Arc::get_mut(&mut task.config).unwrap().expire_after = Some(60);
+    configure_source_ttl(&query_engine, Some(TimeToLive::Forever)).await;
     register_twe_sink(&query_engine, "missing_sink", 9201);
     let handler = Arc::new(RetainedRecoveryHandler {
         source: std::sync::atomic::AtomicUsize::new(1),
@@ -1155,6 +1156,65 @@ async fn configure_source_capability(
         .unwrap();
 }
 
+#[tokio::test]
+async fn test_retained_recovery_validates_aligned_source_retention_before_writing() {
+    let mut outcomes = Vec::new();
+    for ttl in [
+        Some(TimeToLive::Duration(Duration::from_secs(30))),
+        Some(TimeToLive::Duration(Duration::from_secs(61))),
+        Some(TimeToLive::Duration(Duration::from_secs(64))),
+        Some(TimeToLive::Forever),
+        None,
+    ] {
+        let TestTaskParts {
+            mut task,
+            query_engine,
+            ..
+        } = new_time_window_test_task_with_query(
+            "SELECT number, date_bin(INTERVAL '5 second', ts) AS time_window \
+                 FROM numbers_with_ts GROUP BY time_window, number",
+        )
+        .await;
+        Arc::get_mut(&mut task.config).unwrap().expire_after = Some(60);
+        // The retained lower bound is 63.4s old after alignment, not 60s.
+        task.evaluation_time = Some(Timestamp::new_millisecond(123_400));
+        configure_source_ttl(&query_engine, ttl).await;
+        register_twe_sink(&query_engine, "missing_sink", 9203);
+        let handler = Arc::new(RetainedRecoveryHandler {
+            source: std::sync::atomic::AtomicUsize::new(1),
+            sink: std::sync::atomic::AtomicUsize::new(99),
+            captured: tokio::sync::Notify::new(),
+            release: tokio::sync::Notify::new(),
+            first: AtomicBool::new(false),
+        });
+        let grpc_handler: Arc<
+            dyn crate::batching_mode::frontend_client::GrpcQueryHandlerWithBoxedError,
+        > = handler.clone();
+        let frontend = Arc::new(FrontendClient::from_grpc_handler(
+            Arc::downgrade(&grpc_handler),
+            QueryOptions::default(),
+        ));
+        let result = task
+            .recompute_retained_serialized(&query_engine, &frontend)
+            .await;
+        outcomes.push((
+            result.is_ok(),
+            handler.sink.load(Ordering::SeqCst),
+            task.state.read().unwrap().dirty_time_windows.is_empty(),
+        ));
+    }
+    assert_eq!(
+        outcomes,
+        vec![
+            (false, 99, true), // Source expires before the nominal retention range.
+            (false, 99, true), // Nominal range fits, but the leading aligned bin does not.
+            (true, 1, true),
+            (true, 1, true),
+            (false, 99, true), // Unknown inherited TTL must fail closed.
+        ]
+    );
+}
+
 #[tokio::test]
 async fn test_validate_recovery_retention_explicit_source_ttls() {
     struct Case {
@@ -1258,6 +1318,33 @@ async fn test_validate_recovery_retention_explicit_source_ttls() {
     }
 }
 
+#[tokio::test]
+async fn test_validate_recovery_retention_long_finite_ttl() {
+    let TestTaskParts {
+        mut task,
+        query_engine,
+        ..
+    } = new_test_task_engine_and_plan_with_query("SELECT number, ts FROM numbers_with_ts", "sink")
+        .await;
+    Arc::get_mut(&mut task.config).unwrap().expire_after = Some(60);
+    configure_source_ttl(
+        &query_engine,
+        Some(TimeToLive::Duration(Duration::from_secs(10_000_000_000))),
+    )
+    .await;
+    let now = Timestamp::current_time(common_time::timestamp::TimeUnit::Nanosecond);
+    let oldest = now.sub_duration(Duration::from_secs(65)).unwrap();
+    for clock in [None, Some(now)] {
+        task.evaluation_time = clock;
+        assert!(
+            task.validate_recovery_retention(Some(oldest), &[])
+                .await
+                .is_ok(),
+            "long finite TTL must cover a small retained range with clock {clock:?}"
+        );
+    }
+}
+
 #[tokio::test]
 async fn test_validate_recovery_retention_rejects_unknown_inherited_ttl() {
     let TestTaskParts {
```

---

### Incident Patch 3: `b5f05b3b` (2026-11-23)
**Commit Message**: fix(server): stop reporting superseded reclaims and disconnected idle Orb pauses as failures

ReclaimCapacityWorker failed with {:error, :superseded} when another growth
or shrink rewrote a node's carve-out size while this shrink reclaimed page
cache. That writer resizes the Pod itself, so reconcile_allocation/1 now
succeeds.

PauseIdleOrbWorker failed with {:error, :node_disconnected} when the node's
daemon went away mid-pause (in production, sandboxd OOM kills). The node's
next report settles the Orb and enqueues the pause again if it is still
quiet, so the worker logs it and succeeds. Other refusals still fail.

Amp-Thread-ID: https://ampcode.com/threads/T-01a20973-f5b1-7347-818c-ef37bcb384e8
Co-authored-by: Marek Fort <[REDACTED_EMAIL]>

**File**: `server/lib/tuist/sandboxes/capacity.ex` (modified, +7/-4)
```diff
@@ -266,10 +266,7 @@ defmodule Tuist.Sandboxes.Capacity do
           # resume; move them, the ones just paused included, to storage.
           if ci_reclaim?(node_name), do: Archives.move_off_node(node_name)
 
-          case keep_warm(node, pressure) || shrink(node, pressure) do
-            {:error, reason} -> {:error, reason}
-            _ -> :ok
-          end
+          reconcile_result(keep_warm(node, pressure) || shrink(node, pressure))
         else
           :ok
         end
@@ -279,6 +276,12 @@ defmodule Tuist.Sandboxes.Capacity do
     end
   end
 
+  # :superseded means another growth or shrink rewrote the size asked for
+  # while this one reclaimed; that writer resizes the Pod itself.
+  defp reconcile_result({:error, :superseded}), do: :ok
+  defp reconcile_result({:error, reason}), do: {:error, reason}
+  defp reconcile_result(_resized_or_unchanged), do: :ok
+
   # A remote execution worker's share of the compute allocator's floor
   # (`allocation_warm_bytes`): its carve-out grows to it ahead of any
   # action, without waiting for the kubelet; a deferred growth keeps new
```

**File**: `server/lib/tuist/sandboxes/workers/pause_idle_orb_worker.ex` (modified, +7/-0)
```diff
@@ -25,6 +25,13 @@ defmodule Tuist.Sandboxes.Workers.PauseIdleOrbWorker do
       {:error, :locked} ->
         :ok
 
+      # The node's socket went away (a daemon restart pauses or loses its
+      # VMs); its next report settles the Orb's state and, if it still runs
+      # quiet, enqueues this pause again.
+      {:error, reason} when reason in [:node_disconnected, :not_connected] ->
+        Logger.info("sandboxes: idle Orb pause interrupted by its node", sandbox_id: sandbox_id, reason: reason)
+        :ok
+
       {:error, reason} ->
         Logger.warning("sandboxes: idle Orb pause failed", sandbox_id: sandbox_id, reason: inspect(reason))
         {:error, reason}
```

**File**: `server/test/tuist/sandboxes/allocation_test.exs` (modified, +3/-2)
```diff
@@ -174,7 +174,7 @@ defmodule Tuist.Sandboxes.AllocationTest do
   end
 
   test "a newer allocation between desired-state growth and resize cancels the API write", %{node: node} do
-    assert :ok = Capacity.update_allocation(grant(node))
+    assert :ok = Capacity.update_allocation(grant(node, %{"reclaim" => true, "memory_bytes" => 0}))
     # Reclaim sends a command after lowering desired state but before resizing.
     # Simulate a different replica publishing/reconciling a newer desired size.
     expect(Nodes, :call, fn _, "reclaim", _, _ ->
@@ -183,7 +183,8 @@ defmodule Tuist.Sandboxes.AllocationTest do
     end)
 
     reject(&KubernetesClient.resize_sandbox_daemon_memory/3)
-    assert {:error, :superseded} = Capacity.shrink(node, true)
+    # The newer size's writer resizes the Pod, so the reclaim job succeeds.
+    assert :ok = Capacity.reconcile_allocation(node.name)
     assert Repo.get!(SandboxNode, node.name).memory_limit_bytes == 8 * @gib
   end
 
```

**File**: `server/test/tuist/sandboxes/workers/pause_idle_orb_worker_test.exs` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+defmodule Tuist.Sandboxes.Workers.PauseIdleOrbWorkerTest do
+  use TuistTestSupport.Cases.DataCase, async: true
+  use Mimic
+
+  import TuistTestSupport.Fixtures.SandboxesFixtures
+
+  alias Tuist.Repo
+  alias Tuist.Sandboxes.Nodes
+  alias Tuist.Sandboxes.Workers.PauseIdleOrbWorker
+
+  setup do
+    quiet_since = DateTime.truncate(DateTime.add(DateTime.utc_now(), -700, :second), :second)
+
+    sandbox =
+      sandbox_fixture(
+        amp_orb_id: "amp-thread",
+        node_name: "node-a",
+        residency_work_id: "amp:amp-thread",
+        guest_cpu_ms: 1000,
+        last_active_at: quiet_since
+      )
+
+    %{sandbox: sandbox, args: %{sandbox_id: sandbox.id, last_active_at: DateTime.to_iso8601(quiet_since)}}
+  end
+
+  # Every Orb pause reads the guest's setup log first, then pauses.
+  defp stub_pause(result) do
+    stub(Nodes, :call, fn
+      "node-a", "exec", _args, _opts -> {:ok, %{"exit_code" => 0}}
+      "node-a", "pause", _args, _opts -> result
+    end)
+  end
+
+  test "succeeds when the node disconnects mid-pause, leaving the Orb for its next report", %{
+    sandbox: sandbox,
+    args: args
+  } do
+    stub_pause({:error, :node_disconnected})
+
+    assert :ok = perform_job(PauseIdleOrbWorker, args)
+    assert Repo.reload!(sandbox).state == :running
+  end
+
+  test "fails on a refusal from the node", %{args: args} do
+    stub_pause({:error, "exec running"})
+
+    assert {:error, "exec running"} = perform_job(PauseIdleOrbWorker, args)
+  end
+end
```

#### Recent Merged Pull Requests:
- **PR #15827** (2026-11-23): feat(cli): backport parallel resumable shard downloads to 4.219.x (@fortmarek)
- **PR #15826** (2026-11-24): chore(cli): update Tuist CLI to 4.220.0-canary.7 (@tuist-automation[bot])
- **PR #15821** (2026-11-23): feat(server): report coverage in the pull request comment (@esnunes)
- **PR #15808** (2026-11-23): ci(server): instrument the server's coverage once in Build Test Shards (@esnunes)
- **PR #15807** (closed): test(app): taller NooraButton to exercise snapshot review (do not merge) (@fortmarek)
- **PR #15806** (2026-11-23): chore(cli): update Tuist CLI to 4.220.0-canary.5 (@tuist-automation[bot])

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

## X. kura): set aside floor memory for write replies

**RULE**:
When implementing operations in `infra/helm/k8s-monitoring/alerts.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tuist/tuist. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `4b0405f1`: kura): set aside floor memory for write replies. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Elixir data structures, boundary deserialization, API parsing, or resource lifecycles matching `infra/helm/k8s-monitoring/alerts.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```elixir
// Verified production-grade fix pattern:
refusals (`bytestream_staging_admission_rejected`), decode refusals
(`grpc_write_decode_admission_rejected`) and reply refusals
(`grpc_write_reply_admission_rejected`) all file under this kind; the memory
was closed. The one exception is a write's reply, which never borrows: it draws
on a 1 MiB slice of the floor set aside for replies (outside
`kura_memory_transient_capacity_bytes`), so reads queued on a full floor cannot
refuse it. Reply refusals mean that slice and the shared floor were both spent;
older pods without the slice refused every write behind a queued read, filed
as decode refusals. A shed burst with
```

**NEGATIVE CONSTRAINT**:
```elixir
// Induced defect failure mode:
refusals (`bytestream_staging_admission_rejected`) and decode refusals
(`grpc_write_decode_admission_rejected`) both file under this kind; the memory
was closed. The one exception is a write's reply, which never borrows: it is
refused when the floor cannot cover it, which happens only after that write's
own decode borrowed, so `transient_ceiling_headroom_borrowed` in
`kura_memory_actions_total_total` rises in the same window. A shed burst with
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `4b0405f1` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
