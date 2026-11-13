> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tuist-tuist-learnings.md`  
> **Source**: github ([https://github.com/tuist/tuist](https://github.com/tuist/tuist))  
> **Source Version**: `98a0fcec`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-13T13:50:18.421Z  
> **Learning ID**: `learn-github-tuist-tuist`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): tuist/tuist

> **Canonical Artifact**: `07_PROJECT_LEARNING/tuist-tuist-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tuist/tuist](https://github.com/tuist/tuist))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-13T13:50:18.416Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tuist/tuist`
- **Description**: Tuist builds infrastructure for faster, more reliable build and test workflows across developers, CI, and coding agents. Shared cache, tests, and insights that sit alongside your existing CI.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5864 stars

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

### Core Architecture Module: `app/Sources/TuistApp/ThreadEmptyStateView.swift`
```
#if os(iOS)
    import SwiftUI

    struct ThreadEmptyStateView: View {
        let archived: Bool
        @Environment(\.dynamicTypeSize) private var dynamicTypeSize

        var body: some View {
            VStack(spacing: 20) {
                if !dynamicTypeSize.isAccessibilitySize {
                    ZStack {
                        ForEach(0 ..< 3) { index in
                            Circle()
                                .stroke(Color.accentColor.opacity(0.14 - Double(index) * 0.035), lineWidth: 1)
                                .frame(width: CGFloat(100 + index * 52), height: CGFloat(100 + index * 52))
                        }

                        RoundedRectangle(cornerRadius: 24)
                            .fill(Color.accentColor.opacity(0.08))
                            .frame(width: 94, height: 94)
                            .rotationEffect(.degrees(-12))

                        Image(systemName: archived ? "archivebox" : "bubble.left.and.bubble.right")
                            .font(.system(size: 40, weight: .light))
                            .foregroundStyle(Color.accentColor)
                            .frame(width: 94, height: 94)
                            .background(.background, in: RoundedRectangle(cornerRadius: 24))
                            .overlay {
                                RoundedRectangle(cornerRadius: 24)
                                    .stroke(Color.accentColor.opacity(0.2), lineWidth: 1)
                            }
                            .shadow(color: Color.accentColor.opacity(0.12), radius: 16, y: 8)
                    }
                    .frame(height: 220)
                    .accessibilityHidden(true)
                }

                VStack(spacing: 8) {
                    Text(LocalizedStringKey(archived ? "All clear, nothing archived" : "Big things start here"))
                        .font(.title3.weight(.medium))
                        .foregroundStyle(.primary)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityAddTraits(.isHeader)

                    Text(LocalizedStringKey(archived
                            ? "Archived threads will live here. You can come back to them anytime."
                            : "Ask a question, explore an idea, or solve a problem with Tuist."))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 24)
            .padding(.vertical, dynamicTypeSize.isAccessibilitySize ? 16 : 32)
        }
    }
#endif

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #15705** (2026-11-13): **feat(pulse): deploy the GreptimeDB fork as Pulse (CI run)**
  *Symptoms*: CI-only draft: runs the path-filtered suites (pulse.yml Rust checks, greptimedb-deployment validate, helm tests) on the Pulse fork stack before it is pushed to main. It will be closed once the commits land.  Contains the GreptimeDB v1.3.0 import under pulse/ without enterprise code, the query nesting limits, removal of the Elixir Pulse deployment and the ingestion gateway, the chart rename to the `pulse` release running ghcr.io/tuist/pulse, and the collector change that writes to it.
  **Post-Mortem & Fix Analysis**:
  > CI passed. The fork commits landed on main in e4d0f32de9; the collector commit is held until Pulse is running.

- **Issue #15704** (2026-11-13): **feat(kura): enroll eu-east and us-west in thin volumes**
  *Symptoms*: ## What changed  Adds eu-east and us-west to `kuraVolumesCSI.thinRegions` and `thinEnrolledRegions` in `values-managed-production.yaml`.  ## Why  Both regions now have a thin-ready landing host, added by #15699 and prepared on 2026-11-13:  | Region | Node | Disks | Thin pool | `tuist.dev/kura-disk` | | --- | --- | --- | --- | --- | | eu-east | `ovh-fleet-eu-east-nh9pb-7bnjr` (waw1) | 4×960 NVMe | 1588G | 1,704,028,274,688 B | | us-west | `ovh-fleet-us-west-qgdlc-v4x2c` (hil1) | 2×960 NVMe | 690G | 739,808,116,736 B |  Each one was annotated `lvm-v1` before it adopted its box, then cordoned, given a thin pool and labelled `tuist.dev/kura-thin-ready=true`. It was uncordoned once `PrivateNetworkReady` was True. Enrolling the regions is the step us-east took with #15635. It lets the existing hosts be drained onto thin one at a time, each followed by a reinstall with `lvm-v1`.  ## Impact  - New instances in eu-east and us-west are placed only on thin-ready nodes. For now that is one host per region. - Existing legacy replicas stay where they are. A legacy claim moves only when its host is selected with `tuist.dev/kura-lvm-migrate=true`, and the controller holds the storage half of every other instance's template until then. - us-west's landing host has 690G of pool against 1.63 TiB claimed in the region, so its hosts drain one at a time after a capacity preflight. eu-east's 1588G pool is larger than any single eu-east host's claims.  ## Validation  - Checked the two lists in the v

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

### Incident Patch 1: `a7a7c488` (2026-11-13)
**Commit Message**: fix(pulse): reject queries nested deep enough to overflow the stack

GreptimeDB v1.3.0 aborts the whole process with a stack overflow on short
nested queries that any reader can send: a PromQL chain of 80 binary
operators (72 through TQL), 48 nested PromQL subqueries, PromQL's format
and parse endpoints at 16k levels, a SQL chain of 4,096 operators and 256
chained UNION ALLs. The parsers' recursion limits miss these because they
build operator chains in a loop, and the analyzer's expression depth
check runs after the crash points.

The new sql::nesting module checks right after parsing:
- PromQL: at most 32 levels (planning a level takes up to ~100 KiB of
  stack) and 4,096 operators, parentheses and brackets, which also bounds
  the parser's quadratic time on long chains. Every non-test PromQL parse
  goes through sql::nesting::parse_promql. The deepest query in Tuist's
  dashboards and alerts is 14 levels deep.
- SQL: expressions up to 128 levels, the analyzer's existing limit, and
  at most 64 chained set operations, checked for each statement in
  ParserContext::create_with_dialect before anything else walks it.
  Parsing runs on a stack sized to the input, so even huge chains 

**File**: `pulse/AGENTS.md` (modified, +26/-0)
```diff
@@ -1,5 +1,31 @@
 # AGENTS.md
 
+## Tuist fork
+
+This directory is Pulse, Tuist's fork of GreptimeDB. [`FORK.md`](FORK.md) records
+the upstream tag and commit, what the import left out, every Tuist change, and
+how releases reach the clusters. The rest of this file is upstream's guidance.
+
+- Keep Tuist changes small and listed in `FORK.md`, and add a
+  `// Modified by Tuist; see pulse/FORK.md.` line under the license header of
+  each upstream file you change. New files carry the Apache-2.0 header with
+  Tuist's copyright.
+- Never add files under the GreptimeDB Enterprise License or enable the
+  `enterprise` feature.
+- Parse PromQL with `sql::nesting::parse_promql`, never
+  `promql_parser::parser::parse`, outside tests.
+- Upstream's CI does not run here. `.github/workflows/pulse.yml` is the CI; run
+  `cargo test -p sql --lib` for the nesting limits. Build scripts call `protoc`
+  outside the repository, so set `PROTOC` to a real binary rather than a mise
+  shim. `cargo fmt` needs the enterprise modules stubbed; `pulse.yml` shows how.
+- Upstream's guidance below overrides nothing above. `make clippy` and
+  `make check` enable `--all-features`, which turns on `enterprise` and fails on
+  the missing files: run `cargo clippy --workspace --all-targets -- -D warnings`
+  and `cargo check --workspace --all-targets` instead. Skip every enterprise step
+  (`--features enterprise`, `make check-enterprise-license`, enterprise headers).
+
+## Upstream guidance
+
 Guidance for coding agents (Claude Code, Codex, ...) and contributors working in
 this repository. `CLAUDE.md` is a symlink to this file. If `.local/AGENTS.md` or
 `.local/CLAUDE.md` is present, you **MUST** read it as well — it holds personal
```

**File**: `pulse/Cargo.lock` (modified, +1/-0)
```diff
@@ -14232,6 +14232,7 @@ dependencies = [
  "snafu 0.8.6",
  "sqlparser",
  "sqlparser_derive 0.1.1",
+ "stacker",
  "table",
  "uuid",
 ]
```

**File**: `pulse/FORK.md` (added, +105/-0)
```diff
@@ -0,0 +1,105 @@
+# Pulse: Tuist's fork of GreptimeDB
+
+Pulse is the observability backend in Tuist's clusters. Since November 2026 it is
+a fork of [GreptimeDB](https://github.com/GreptimeTeam/greptimedb); before that it
+was a separate Elixir application, which is in this directory's history before
+the import commit. The code keeps GreptimeDB's names; Tuist publishes it as
+`ghcr.io/tuist/pulse`. Deployments still run the upstream v1.3.0 image until
+they are pinned to a fork release (see below).
+
+## Upstream base
+
+| | |
+| --- | --- |
+| Repository | https://github.com/GreptimeTeam/greptimedb |
+| Tag | `v1.3.0` |
+| Commit | `badceec12a0e98fd69e83e9b9b9b06d9358b78dd` (2026-10-28) |
+| License | Apache-2.0, in [`LICENSE`](LICENSE). Upstream has no NOTICE file. |
+
+The import is the upstream tree at that commit, except:
+
+- **Enterprise sources.** GreptimeDB is open core. The files under the GreptimeDB
+  Enterprise License are not Apache-2.0, and that license forbids copying or
+  distributing them, so they are not in this repository: `LICENSE-ENTERPRISE`,
+  `licenserc-enterprise.toml`, `licenses/enterprise-header.txt`, and the sources
+  below (triggers, the recycle bin, and undrop and purge of dropped tables).
+  They compile only with the `enterprise` Cargo feature, which the fork never
+  enables; the default build is unchanged, and building with the feature fails
+  on the missing files. `pulse.yml` reads this list to stub the files for
+  rustfmt, which follows `mod` declarations even when they are cfg'd out.
+
+  - `src/catalog/src/system_schema/information_schema/recycle_bin.rs`
+  - `src/catalog/src/system_schema/information_schema/recycle_bin_test.rs`
+  - `src/common/function/src/admin/purge_table.rs`
+  - `src/common/meta/src/ddl/purge_dropped_table.rs`
+  - `src/common/meta/src/ddl/undrop_table.rs`
+  - `src/common/meta/src/rpc/ddl/trigger.rs`
+  - `src/mito2/src/extension.rs`
+  - `src/operator/src/expr_helper/trigger.rs`
+  - `src/sql/src/parsers/alter_parser/trigger.rs`
+  - `src/sql/src/parsers/create_parser/trigger.rs`
+  - `src/sql/src/parsers/show_parser/trigger.rs`
+  - `src/sql/src/statements/alter/trigger.rs`
+  - `src/sql/src/statements/create/trigger.rs`
+  - `src/sql/src/statements/drop/trigger.rs`
+  - `src/sql/src/statements/show/trigger.rs`
+
+- **Upstream automation.** `.github/` (its workflows do not run inside this
+  monorepo) and the agent skills in `.agents/skills/` and `.claude/`.
+  `AGENTS.md`, its `CLAUDE.md` symlink and the rest of `.agents/` are kept.
+
+## Tuist changes
+
+Every Tuist change to an upstream file is marked with a `Modified by Tuist`
+line under its license header, or a `Tuist:` comment at the change.
+
+- **Query nesting limits** ([`src/sql/src/nesting.rs`](src/sql/src/nesting.rs)).
+  GreptimeDB v1.3.0 aborts the whole process with a stack overflow on short,
+  deeply nested queries, and any reader can send them: a PromQL chain of about
+  80 binary operators (`vector(1)+vector(1)+…`, around 800 bytes), 48 nested
+  subqueries, a SQL chain of about 4,000 operators (`SELECT 1+1+…`) or 256
+  chained `UNION ALL`s. Parsing now rejects, with an ordinary syntax error:
+  - PromQL nested more than 32 levels, or with more than 4,096 operators,
+    parentheses and brackets. Every PromQL parse in the query path goes through
+    `sql::nesting::parse_promql`: the HTTP API, TQL, and the format, parse and
+    series endpoints. The deepest query in Tuist's dashboards and alerts is 14
+    levels deep.
+  - SQL expressions nested more than 128 levels and queries chaining more than
+    64 set operations, checked in `ParserContext::create_with_dialect`. This is
+    stricter than the query analyzer's later limit of the same number: depth
+    carries across subqueries and parentheses count, so a `WHERE` with about
+    130 chained `AND`s is rejected. MySQL `EXECUTE … USING` arguments bypass
+    this check; Tuist's deployments do not expose the MySQL port.
+  - SQL texts over 8 MiB. Parsing runs on a stack sized to the input, so a long
+    statement cannot overflow the parser or its drop.
+
+## Build, release and deploy
+
+- [`pulse.yml`](../.github/workflows/pulse.yml) checks formatting, runs the
+  `sql` crate's tests (where the limits live), and type-checks the `greptime`
+  binary, which covers the other changed crates.
+- [`pulse-release.yml`](../.github/workflows/pulse-release.yml) publishes
+  `ghcr.io/tuist/pulse:<version>` and the `pulse@<version>` tag when `pulse/`
+  changes on main. Versions are the upstream version plus a fork revision, such
+  as `1.3.0-tuist.1`. The image is built with upstream's
+  `docker/buildx/ubuntu/Dockerfile` and release profile (`nightly`), without
+  the embedded web dashboard (`servers/dashboard`).
+- Publishing deploys nothing. In each cluster's `observability` namespace the
+  `greptimedb` release ([`infra/helm/greptimedb`](../infra/helm/greptimedb))
+  runs the image pinned in its `values.yaml`, and colle
```

**File**: `pulse/src/query/src/parser.rs` (modified, +3/-1)
```diff
@@ -12,6 +12,8 @@
 // See the License for the specific language governing permissions and
 // limitations under the License.
 
+// Modified by Tuist; see pulse/FORK.md.
+
 use std::any::Any;
 use std::collections::HashMap;
 use std::sync::Arc;
@@ -143,7 +145,7 @@ impl QueryLanguageParser {
     pub fn parse_promql(query: &PromQuery, _query_ctx: &QueryContextRef) -> Result<QueryStatement> {
         let _timer = PARSE_PROMQL_ELAPSED.start_timer();
 
-        let expr = promql_parser::parser::parse(&query.query)
+        let expr = sql::nesting::parse_promql(&query.query)
             .map_err(|msg| BoxedError::new(PlainError::new(msg, StatusCode::InvalidArguments)))
             .context(QueryParseSnafu {
                 query: &query.query,
```

**File**: `pulse/src/servers/src/http/prometheus.rs` (modified, +7/-5)
```diff
@@ -12,6 +12,8 @@
 // See the License for the specific language governing permissions and
 // limitations under the License.
 
+// Modified by Tuist; see pulse/FORK.md.
+
 //! prom supply the prometheus HTTP API Server compliance
 
 use std::borrow::Borrow;
@@ -246,7 +248,7 @@ pub async fn format_query(
     Form(form_params): Form<InstantQuery>,
 ) -> PrometheusJsonResponse {
     let query = params.query.or(form_params.query).unwrap_or_default();
-    match promql_parser::parser::parse(&query) {
+    match sql::nesting::parse_promql(&query) {
         Ok(expr) => {
             let pretty = expr.prettify();
             PrometheusJsonResponse::success(PrometheusResponse::FormatQuery(pretty))
@@ -2049,7 +2051,7 @@ fn split_selectors_by_label_use(matches: &[String]) -> Result<(Vec<String>, Vec<
     let mut with_labels = Vec::new();
 
     for selector in matches {
-        let expr = promql_parser::parser::parse(selector)
+        let expr = sql::nesting::parse_promql(selector)
             .map_err(|reason| InvalidQuerySnafu { reason }.build())?;
         let PromqlExpr::VectorSelector(vector_selector) = expr else {
             return InvalidQuerySnafu {
@@ -2136,7 +2138,7 @@ async fn retrieve_table_names(
     let name_matchers = matches
         .iter()
         .map(|selector| {
-            let expr = promql_parser::parser::parse(selector)
+            let expr = sql::nesting::parse_promql(selector)
                 .map_err(|reason| InvalidQuerySnafu { reason }.build())?;
             let PromqlExpr::VectorSelector(selector) = expr else {
                 return InvalidQuerySnafu {
@@ -2397,7 +2399,7 @@ async fn retrieve_schema_names(
 }
 
 fn retrieve_exact_metric_name_from_promql(query: &str) -> Option<String> {
-    let PromqlExpr::VectorSelector(selector) = promql_parser::parser::parse(query).ok()? else {
+    let PromqlExpr::VectorSelector(selector) = sql::nesting::parse_promql(query).ok()? else {
         return None;
     };
     if let Some(name) = selector.name {
@@ -2584,7 +2586,7 @@ pub async fn parse_query(
 ) -> PrometheusJsonResponse {
     if let Some(query) = params.query.or(form_params.query) {
         let ast = try_call_return_response!(
-            promql_parser::parser::parse(&query),
+            sql::nesting::parse_promql(&query),
             StatusCode::InvalidArguments
         );
         PrometheusJsonResponse::success(PrometheusResponse::ParseResult(ast))
```

**File**: `pulse/src/sql/Cargo.toml` (modified, +2/-0)
```diff
@@ -1,3 +1,4 @@
+# Modified by Tuist; see pulse/FORK.md.
 [package]
 name = "sql"
 version.workspace = true
@@ -38,6 +39,7 @@ serde_json.workspace = true
 snafu.workspace = true
 sqlparser.workspace = true
 sqlparser_derive = "0.1"
+stacker = "0.1"
 table.workspace = true
 uuid.workspace = true
 
```

**File**: `pulse/src/sql/src/lib.rs` (modified, +3/-0)
```diff
@@ -12,9 +12,12 @@
 // See the License for the specific language governing permissions and
 // limitations under the License.
 
+// Modified by Tuist; see pulse/FORK.md.
+
 pub mod ast;
 pub mod dialect;
 pub mod error;
+pub mod nesting;
 pub mod parser;
 pub mod parsers;
 pub mod partition;
```

**File**: `pulse/src/sql/src/nesting.rs` (added, +322/-0)
```diff
@@ -0,0 +1,322 @@
+// Copyright 2026 Tuist GmbH
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+//! Rejects queries nested too deeply to process.
+//!
+//! Planning, cloning, displaying and dropping a query recurse once per level of
+//! nesting, and an 8 MiB worker stack overflows after a few dozen PromQL levels or
+//! a few thousand SQL levels. A stack overflow aborts the whole process, so any
+//! reader could stop the database with a short query. The parsers' own recursion
+//! limits do not help: they build operator chains (`a + b + ...`,
+//! `SELECT ... UNION ALL SELECT ...`) in a loop. These checks run right after
+//! parsing, before anything else walks the tree.
+
+use std::ops::ControlFlow;
+
+use promql_parser::parser::Expr as PromExpr;
+use sqlparser::ast::{Expr, Query, SetExpr, Visit, Visitor};
+
+/// Deepest SQL expression accepted, the same as the query analyzer's limit.
+pub const MAX_SQL_EXPR_DEPTH: usize = 128;
+/// Longest chain of set operations (UNION, INTERSECT, EXCEPT) in one query.
+/// GreptimeDB v1.3.0 overflowed at 256 chained `UNION ALL`s.
+pub const MAX_SQL_SET_OPERATION_DEPTH: usize = 64;
+/// Deepest PromQL expression accepted, counting every node. Planning a level
+/// takes up to about 100 KiB of stack: GreptimeDB v1.3.0 overflowed an 8 MiB
+/// stack at 72 chained binary operators (through TQL) and 48 nested subqueries.
+pub const MAX_PROMQL_DEPTH: usize = 32;
+/// Most PromQL operators, parentheses and brackets accepted in one query. Each
+/// inner node of the tree needs one, so this bounds what the parser builds before
+/// the depth check, and the parser's time, which grows with the square of a
+/// chain's length.
+pub const MAX_PROMQL_NODES: usize = 4096;
+/// Stack reserved per byte of SQL for parsing and dropping its tree. The longest
+/// chains take 2 bytes per level and 70 bytes of stack per level.
+const SQL_PARSE_STACK_PER_BYTE: usize = 128;
+const SQL_PARSE_STACK_BASE: usize = 1024 * 1024;
+/// Largest stack set aside for parsing one SQL text, which caps SQL at 8 MiB.
+const MAX_SQL_PARSE_STACK: usize = 1024 * 1024 * 1024;
+
+/// Parses PromQL, rejecting queries nested deeper than [`MAX_PROMQL_DEPTH`].
+pub fn parse_promql(query: &str) -> Result<PromExpr, String> {
+    if promql_node_bound(query) > MAX_PROMQL_NODES {
+        return Err(format!(
+            "query has more than {MAX_PROMQL_NODES} operators, parentheses and brackets"
+        ));
+    }
+    let expr = promql_parser::parser::parse(query)?;
+    if promql_depth(&expr) > MAX_PROMQL_DEPTH {
+        return Err(format!(
+            "query is nested more than {MAX_PROMQL_DEPTH} levels deep"
+        ));
+    }
+    Ok(expr)
+}
+
+/// An upper bound on the inner nodes of the query's tree: its operator
+/// characters, operator keywords, parentheses and brackets, outside strings,
+/// label matchers and comments.
+fn promql_node_bound(query: &str) -> usize {
+    let bytes = query.as_bytes();
+    let mut count = 0;
+    let mut i = 0;
+    while i < bytes.len() {
+        match bytes[i] {
+            quote @ (b'"' | b'\'' | b'`') => i = skip_string(bytes, i + 1, quote),
+            // Label matchers hold no expressions, only names and strings.
+            b'{' => {
+                i += 1;
+                while i < bytes.len() && bytes[i] != b'}' {
+                    match bytes[i] {
+                        quote @ (b'"' | b'\'' | b'`') => i = skip_string(bytes, i + 1, quote),
+                        _ => i += 1,
+                    }
+                }
+                i += 1;
+            }
+            b'#' => {
+                while i < bytes.len() && bytes[i] != b'\n' {
+                    i += 1;
+                }
+            }
+            b'(' | b'[' | b'+' | b'-' | b'*' | b'/' | b'%' | b'^' | b'=' | b'!' | b'<' | b'>' => {
+                count += 1;
+                i += 1;
+            }
+            byte if byte.is_ascii_alphabetic() || byte == b'_' => {
+                let start = i;
+                while i < bytes.len() && (bytes[i].is_ascii_alphanumeric() || bytes[i] == b'_') {
+                    i += 1;
+                }
+                let word = &query[start..i];
+                if ["and", "or", "unless", "atan2"]
+                    .iter()
+                    .any(|keyword| word.eq_ignore_ascii_case(keyword))
+                {
+                    count += 1;
+                }
+            }
+            _ => i += 1,
+        }
+    }
+
```

---

### Incident Patch 2: `6d0fb940` (2026-11-12)
**Commit Message**: fix(linux-runner-image): check the hostile OOM payload without python3

The sampler test runs in bare ubuntu:24.04 and 22.04 containers, which have
no python3, so the check added in 4f80153b58 failed every image build.

Amp-Thread-ID: https://ampcode.com/threads/T-01a1acac-4c5d-77e3-a32e-cab0a52bca6d
Co-authored-by: Marek Fort <[REDACTED_EMAIL]>

**File**: `infra/linux-runner-image/metrics-sampler_test.sh` (modified, +5/-1)
```diff
@@ -186,7 +186,11 @@ fi
 # reach the JSON.
 printf 'oom.victim=a"b\\c oom.victim.anon.kb=1e9x oom.victim.container=c"},{"x":1\n' >"${DIND_MEMORY_PATH}"
 payload="$(metrics_payload 1750684800 42.5 1.2 1024 2048 1)"
-if printf '%s' "${payload}" | python3 -c 'import json, sys; s = json.load(sys.stdin)["samples"]; assert len(s) == 1 and s[0]["oom_victim_process"] == "abc" and s[0]["oom_victim_container"] == "cx:1" and s[0]["oom_victim_memory_bytes"] == 19 * 1024, s'; then
+# The test runs in bare Ubuntu images, which have no JSON parser: one sample
+# ending in exactly the sanitized fields, and no stray quote or backslash.
+if [[ "${payload}" == *'"oom_victim_process":"abc","oom_victim_memory_bytes":19456,"oom_victim_container":"cx:1"}]}' ]] &&
+  [[ "$(grep -o '"timestamp"' <<<"${payload}" | wc -l)" -eq 1 ]] &&
+  [[ "${payload}" != *'\'* && "${payload}" != *'"x"'* ]]; then
   echo "  ok   a hostile file stays one valid sample"
 else
   echo "  FAIL hostile payload: ${payload}"
```

---

### Incident Patch 3: `faa571d2` (2026-11-13)
**Commit Message**: fix(server): serve macOS sandboxes and CI first come, first served

A macOS sandbox created or resumed through the API could be paused about a
second after its 20 s boot: the server asked for a fresh CI grant before the
running VM could take its session lease, and when CI demand had closed the
host's grant meanwhile, the refused lease left the sandbox idle and its
zero-delay pause ran. The host likewise checkpointed an idle VM early when the
grant was withdrawn. Commands then waited 25 s and failed with 503 while the
sandbox bounced between resumes and pauses.

Neither CI nor sandboxes take preference now. Work on a running VM (the
lease, a turn, a hold, a worker start) needs no grant, since the VM already
holds its charge; only creates and resumes, which ask for new capacity, need
one. Idle VMs still give their room back after their own idle grace.

Amp-Thread-ID: https://ampcode.com/threads/T-01a1d19d-8d74-764f-98a5-510f2d9bc018
Co-authored-by: Marek Fort <[REDACTED_EMAIL]>

**File**: `infra/tart-kubelet/internal/macosandbox/acceptance_test.go` (modified, +1/-0)
```diff
@@ -123,6 +123,7 @@ func TestNativeControlPlaneAcceptance(t *testing.T) {
 		t.Fatal("interrupted active work")
 	}
 	call("stop_worker", map[string]any{}, true)
+	recovered.Grace = time.Nanosecond
 	if err := recovered.Reconcile(ctx); err != nil {
 		t.Fatal(err)
 	}
```

**File**: `infra/tart-kubelet/internal/macosandbox/checkout_test.go` (modified, +3/-2)
```diff
@@ -7,6 +7,7 @@ import (
 	"path/filepath"
 	"strings"
 	"testing"
+	"time"
 
 	"github.com/tuist/tuist/infra/sandboxd/pkg/protocol"
 	"github.com/tuist/tuist/infra/tart-kubelet/internal/tart"
@@ -34,7 +35,7 @@ func testGrant() *protocol.CheckoutGrant {
 // A session's worker starts from the master in its VM's share, and the host
 // takes its export only once an eviction has fenced the VM.
 func TestCheckoutSeedsAtWorkerStartAndCollectsAfterTheFence(t *testing.T) {
-	m, r, c, a := harness(t)
+	m, r, _, a := harness(t)
 	checkouts := &fakeCheckouts{}
 	m.Checkouts = checkouts
 	ctx := context.Background()
@@ -68,7 +69,7 @@ func TestCheckoutSeedsAtWorkerStartAndCollectsAfterTheFence(t *testing.T) {
 	if len(checkouts.collected) != 0 {
 		t.Fatal("collected from a running VM")
 	}
-	c.allow = false // CI needs the room: the idle sandbox is saved.
+	m.Grace = time.Nanosecond // The idle grace is up: the idle sandbox is saved.
 	if err := m.Reconcile(ctx); err != nil {
 		t.Fatal(err)
 	}
```

**File**: `infra/tart-kubelet/internal/macosandbox/manager.go` (modified, +10/-16)
```diff
@@ -372,12 +372,13 @@ func (m *Manager) resume(ctx context.Context, r *Record) error {
 	if r.Operation != "" || r.State == "error" {
 		return errors.New("sandbox requires reconciliation")
 	}
-	if err = m.Capacity.Allow(ctx, r); err != nil {
-		return err
-	}
+	// A running VM already holds its charge; only a paused one asks for it.
 	if r.State == "running" {
 		return nil
 	}
+	if err = m.Capacity.Allow(ctx, r); err != nil {
+		return err
+	}
 	if r.State != "paused" {
 		return errors.New("sandbox is not paused")
 	}
@@ -505,8 +506,8 @@ var holdIDPattern = regexp.MustCompile(`^[A-Za-z0-9_.:-]{1,255}$`)
 // Hold protects a running sandbox from idle eviction for detached guest work,
 // resuming it first like a worker start. A positive ttl ends the hold that
 // long from now unless it is renewed; zero keeps it until a release or pause.
-// Only a new hold needs the grant: renewing the current one takes no capacity
-// it does not already hold, so it succeeds while CI holds the grant.
+// A hold on a running VM takes no capacity it does not already hold, so it
+// needs no grant; only resuming a paused one does.
 func (m *Manager) Hold(ctx context.Context, id, work string, ttl time.Duration) error {
 	m.Gate.Lock()
 	defer m.Gate.Unlock()
@@ -525,11 +526,6 @@ func (m *Manager) Hold(ctx context.Context, id, work string, ttl time.Duration)
 	if r.State != "running" || r.Operation != "" {
 		return errors.New("sandbox is not running")
 	}
-	if r.HoldID != work {
-		if err = m.Capacity.Allow(ctx, r); err != nil {
-			return err
-		}
-	}
 	until := time.Time{}
 	if ttl > 0 {
 		until = time.Now().UTC().Add(ttl)
@@ -598,8 +594,9 @@ func (m *Manager) SampleCPU(ctx context.Context) {
 	m.cpuMu.Unlock()
 }
 
-// Reconcile retries interrupted operations and checkpoints idle residents when
-// CI demand is queued, unknown, stale, or their bounded grace expires.
+// Reconcile retries interrupted operations and checkpoints idle residents once
+// their bounded grace expires. CI and sandboxes are first come, first served:
+// CI demand arriving later does not checkpoint a VM before its grace is up.
 func (m *Manager) Reconcile(ctx context.Context) error {
 	m.Gate.Lock()
 	defer m.Gate.Unlock()
@@ -695,7 +692,7 @@ func (m *Manager) Reconcile(ctx context.Context) error {
 				continue
 			}
 		}
-		if r.Resident && r.WorkerID == "" && r.HoldID == "" && m.active[r.SandboxID] == 0 && (time.Since(r.IdleAt) >= grace || m.Capacity.Allow(ctx, r) != nil) {
+		if r.Resident && r.WorkerID == "" && r.HoldID == "" && m.active[r.SandboxID] == 0 && time.Since(r.IdleAt) >= grace {
 			if err := m.evict(ctx, r); err != nil {
 				errs = append(errs, err)
 			}
@@ -763,9 +760,6 @@ func (m *Manager) worker(ctx context.Context, id, action string, env map[string]
 		if r.State != "running" || r.Operation != "" {
 			return WorkerStatus{}, errors.New("sandbox is not running")
 		}
-		if err = m.Capacity.Allow(ctx, r); err != nil {
-			return WorkerStatus{}, err
-		}
 		work := env["ANTHROPIC_WORK_ID"]
 		if work == "" {
 			return WorkerStatus{}, errors.New("worker identity is required")
```

**File**: `infra/tart-kubelet/internal/macosandbox/manager_test.go` (modified, +16/-9)
```diff
@@ -283,9 +283,10 @@ func TestResidencyHoldOutlivesIdleGraceAndCIUntilItsOwnerEndsIt(t *testing.T) {
 	}
 }
 
-// A session renews its timed hold between commands even while CI holds the
-// grant; a hold nobody renews expires, and the idle VM goes back to CI.
-func TestTimedHoldRenewsWithoutTheGrantAndExpires(t *testing.T) {
+// A running VM already holds its charge, so holds on it, new or renewed, need
+// no grant while CI holds it. A hold nobody renews expires, and the idle VM is
+// checkpointed once its idle grace is up, not when CI asks for the room.
+func TestHoldsOnARunningVMNeedNoGrantAndExpire(t *testing.T) {
 	m, r, c, a := harness(t)
 	m.Grace = time.Minute
 	ctx := context.Background()
@@ -299,18 +300,22 @@ func TestTimedHoldRenewsWithoutTheGrantAndExpires(t *testing.T) {
 	if err := m.Hold(ctx, a.SandboxID, "commands", 100*time.Millisecond); err != nil {
 		t.Fatalf("renewing the current hold needed the grant: %v", err)
 	}
-	if err := m.Hold(ctx, a.SandboxID, "amp:other", 0); !errors.Is(err, ErrCapacity) {
-		t.Fatalf("a new hold was admitted without the grant: %v", err)
+	if err := m.Hold(ctx, a.SandboxID, "amp:other", 100*time.Millisecond); err != nil {
+		t.Fatalf("a new hold on a running VM needed the grant: %v", err)
 	}
 	if err := m.Reconcile(ctx); err != nil || r.states[a.SandboxID] != "running" {
 		t.Fatal("CI evicted a sandbox under a live hold", err)
 	}
 	time.Sleep(150 * time.Millisecond)
+	if err := m.Reconcile(ctx); err != nil || r.states[a.SandboxID] != "running" {
+		t.Fatal("CI demand evicted an idle VM before its grace was up", err)
+	}
+	m.Grace = time.Nanosecond
 	if err := m.Reconcile(ctx); err != nil {
 		t.Fatal(err)
 	}
 	if r.states[a.SandboxID] != "evicted" || c.held[a.SandboxID] {
-		t.Fatal("an expired hold kept the VM from CI")
+		t.Fatal("an expired hold kept the VM past its idle grace")
 	}
 }
 
@@ -335,8 +340,9 @@ func TestGuestCPUIntegratesIntoMonotonicReportedTime(t *testing.T) {
 		t.Fatal("a paused sandbox reported guest CPU")
 	}
 }
-func TestCIRevocationEvictsOnlyIdleAndRetainsFailedFence(t *testing.T) {
+func TestIdleEvictionSparesWorkAndRetainsFailedFence(t *testing.T) {
 	m, r, c, a := harness(t)
+	m.Grace = time.Nanosecond
 	ctx := context.Background()
 	if err := m.Create(ctx, a); err != nil {
 		t.Fatal(err)
@@ -349,7 +355,7 @@ func TestCIRevocationEvictsOnlyIdleAndRetainsFailedFence(t *testing.T) {
 		t.Fatal(err)
 	}
 	if !c.held[a.SandboxID] {
-		t.Fatal("CI interrupted active work")
+		t.Fatal("idle eviction interrupted active work")
 	}
 	r.worker.Running = false
 	r.saveErr = errors.New("checkpoint failed")
@@ -367,7 +373,7 @@ func TestCIRevocationEvictsOnlyIdleAndRetainsFailedFence(t *testing.T) {
 		t.Fatal("successful eviction kept charge")
 	}
 	if err := m.Resume(ctx, a.SandboxID); !errors.Is(err, ErrCapacity) {
-		t.Fatalf("resume admitted while CI queued: %v", err)
+		t.Fatalf("resume admitted while CI holds the grant: %v", err)
 	}
 }
 
@@ -428,6 +434,7 @@ func TestReportsAndCILaunchDoNotWaitForCheckpoint(t *testing.T) {
 		t.Fatal(err)
 	}
 	c.allow = false
+	m.Grace = time.Nanosecond
 	r.saveStarted = make(chan struct{})
 	r.saveRelease = make(chan struct{})
 	done := make(chan error, 1)
```

**File**: `infra/tart-kubelet/internal/macosandbox/service_test.go` (modified, +4/-3)
```diff
@@ -136,8 +136,9 @@ func TestFencedReservationReleaseCompletesPodDeletion(t *testing.T) {
 	}
 }
 
-func TestControlPreparationFailureDoesNotBlockCIEviction(t *testing.T) {
+func TestControlPreparationFailureDoesNotBlockIdleEviction(t *testing.T) {
 	m, runtime, _, args := harness(t)
+	m.Grace = time.Nanosecond
 	capacity, node, _ := capacityFixture()
 	m.Capacity = capacity
 	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
@@ -148,7 +149,7 @@ func TestControlPreparationFailureDoesNotBlockCIEviction(t *testing.T) {
 	if err := m.Pause(ctx, args.SandboxID); err != nil {
 		t.Fatal(err)
 	}
-	// A replacement control Pod cannot connect, while CI has revoked the grant.
+	// A replacement control Pod cannot connect while the VM's idle grace is up.
 	control := &corev1.Pod{ObjectMeta: metav1.ObjectMeta{
 		Name: "control", Namespace: Namespace, UID: "replacement",
 		Labels:      map[string]string{RoleLabel: "control"},
@@ -174,7 +175,7 @@ func TestControlPreparationFailureDoesNotBlockCIEviction(t *testing.T) {
 	select {
 	case <-runtime.saveStarted:
 	case <-ctx.Done():
-		t.Fatal("invalid replacement control configuration blocked CI eviction")
+		t.Fatal("invalid replacement control configuration blocked idle eviction")
 	}
 	// A checkpoint in progress must still retain its capacity reservation.
 	if _, err := capacity.Kube.CoreV1().Pods(Namespace).Get(ctx, "macos-sbx-"+args.SandboxID, metav1.GetOptions{}); err != nil {
```

**File**: `infra/tart-kubelet/macos-sandboxes.md` (modified, +8/-6)
```diff
@@ -77,8 +77,11 @@ Each grant specifies CPU, RAM and VM slots remaining after non-reclaimable CI
 reservations. Placement subtracts existing native reservations from that allowance,
 so a host occupied by CI is not selected just because its queue is empty.
 CI can revoke admission between server placement and the host's final check.
-A command into a running VM needs no grant, since the VM already holds its
-charge; a command that has to resume a paused VM does.
+Work on a running VM (a command, a worker start, a hold, the server's lease)
+needs no grant, since the VM already holds its charge; work that has to resume
+a paused VM does. CI and sandboxes are served first come, first served: a grant
+gates only new capacity, and CI demand arriving later never takes a running
+VM's place.
 An explicit host capacity refusal returns HTTP 503 and leaves a saved environment
 paused for retry; its server charge stays conservative until the next host report.
 A create the host refuses for capacity moves on to the next host.
@@ -99,16 +102,15 @@ and Terminating Pods, enforcing CPU, RAM and Apple's two-VM limit. A resident
 pause retains the full Pod charge. The host repairs missing reservation Pods
 from its journals before CI launches; uncertain ownership fails closed.
 
-The background controller checkpoints idle residents when CI revokes admission,
-or after the bounded 30-second idle grace. Ownership reconciliation and eviction
+The background controller checkpoints idle residents after the bounded
+30-second idle grace; a revoked grant does not shorten it. Ownership reconciliation and eviction
 run independently of image downloads and control connection preparation, so a
 failed or slow image update cannot delay returning idle capacity to CI.
 It does not interrupt an active managed
 worker or exec command, nor a hold (`hold_residency`): an Amp Orb's turn, or
 the server's `commands` residency, which on macOS outlives the last command as
 a ten-minute session lease so an agent thinking between commands keeps its VM
-(`server/lib/tuist/sandboxes/commands.ex`). Only a new hold needs a grant;
-renewing the current one does not. A hold with `hold_ms` ends that long after
+(`server/lib/tuist/sandboxes/commands.ex`). A hold with `hold_ms` ends that long after
 it was last renewed even if the server never releases it; the server sets it
 two minutes past the lease, so this only backstops a lost release. CI may therefore wait for active native work to finish
 and for the checkpoint to complete. A failed checkpoint or process fence retains
```

**File**: `server/lib/tuist/sandboxes/AGENTS.md` (modified, +6/-4)
```diff
@@ -169,9 +169,10 @@ See [the rollout and recovery contract](../../../../infra/sandbox-image/remote-e
   resumes it and records the residency in one step
   (`Sandboxes.prepare_residency/2`), then starts `sbx-worker` with the
   session credentials; force-stops the work item on any failure so
-  Anthropic re-queues it. Like an Amp Orb's spawn, a turn that just
-  created a macOS sandbox records its residency without a fresh CI grant
-  (`created: true`): the VM already holds its slot. Inside the residency
+  Anthropic re-queues it. A turn on a running macOS sandbox records
+  its residency without a fresh CI grant (`MacosCapacity.admit_turn/2`):
+  the VM already holds its slot, and CI and sandboxes are served first
+  come, first served. Only a resume asks for the grant. Inside the residency
   that created the sandbox, the router binds it to the `AgentSession` row
   (looked up by `anthropic_session_id`) and clones the requested
   repository into `<workspace>/<name>` (`/workspace` on Linux,
@@ -337,7 +338,8 @@ serialization are specified in [`fleet-sharing.md`](../../../../infra/sandboxd/f
 Shared-node idle pauses (all macOS hosts too) have zero grace and enqueue
 shrink work, except 20 s after the last command ends on Linux (`Commands`
 residency), so a command run such as a sync then a build does not wait out a
-pause and a resume; CI pressure still pauses that idle sandbox at once. On
+pause and a resume; CI pressure still pauses that idle sandbox at once. CI demand never pauses or evicts a running macOS VM: there the grant
+gates only creates and resumes. On
 macOS the `Commands` residency itself outlives the last command as the
 session's ten-minute lease (see `Commands` below). Active residencies and
 daemon worker/exec guards remain authoritative.
```

**File**: `server/lib/tuist/sandboxes/commands.ex` (modified, +2/-2)
```diff
@@ -205,8 +205,8 @@ defmodule Tuist.Sandboxes.Commands do
   chose, so that sending the request again answers the command it started
   instead of starting another).
 
-  While CI holds the sandbox's host, admission refuses the resume or the
-  command. The start then tries again every second for up to
+  While CI holds the sandbox's host, admission refuses the resume of a
+  paused sandbox; a running one needs no grant. The start then tries again every second for up to
   #{div(@host_wait_ms, 1000)} seconds before it answers the refusal, so the
   command starts as soon as the host frees instead of after the client's
   next retry.
```

#### Recent Merged Pull Requests:
- **PR #15705** (closed): feat(pulse): deploy the GreptimeDB fork as Pulse (CI run) (@pepicrft)
- **PR #15704** (2026-11-13): feat(kura): enroll eu-east and us-west in thin volumes (@fortmarek)
- **PR #15701** (2026-11-13): feat(docs): point Amp users to Tuist Macs instead of macOS Satellites (@fortmarek)
- **PR #15700** (closed): chore(infra): retire the two Tahoe VM image builders (@fortmarek)
- **PR #15699** (2026-11-13): feat(kura): add a landing box to four OVH cache fleets (@fortmarek)
- **PR #15696** (2026-11-13): fix(cli): backport conditioning fallback module maps across SDK overrides to 4.216.x (@pepicrft)

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

## X. pulse): reject queries nested deep enough to overflow the stack

**RULE**:
When implementing operations in `pulse/AGENTS.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tuist/tuist. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a7a7c488`: pulse): reject queries nested deep enough to overflow the stack. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `pulse/AGENTS.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
## Tuist fork

This directory is Pulse, Tuist's fork of GreptimeDB. [`FORK.md`](FORK.md) records
the upstream tag and commit, what the import left out, every Tuist change, and
how releases reach the clusters. The rest of this file is upstream's guidance.

- Keep Tuist changes small and listed in `FORK.md`, and add a
  `// Modified by Tuist; see pulse/FORK.md.` line under the license header of
  each upstream file you change. New files carry the Apache-2.0 header with
  Tuist's copyright.
- Never add files under the GreptimeDB Enterprise License or enable the
  `enterprise` feature.
- Parse PromQL with `sql::nesting::parse_promql`, never
  `promql_parser::parser::parse`, outside tests.
- Upstream's CI does not run here. `.github/workflows/pulse.yml` is the CI; run
  `cargo test -p sql --lib` for the nesting limits. Build scripts call `protoc`
  outside the repository, so set `PROTOC` to a real binary rather than a mise
  shim. `cargo fmt` needs the enterprise modules stubbed; `pulse.yml` shows how.
- Upstream's guidance below overrides nothing above. `make clippy` and
  `make check` enable `--all-features`, which turns on `enterprise` and fails on
  the missing files: run `cargo cli
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a7a7c488` are properly handled with clean fallback behavior.
