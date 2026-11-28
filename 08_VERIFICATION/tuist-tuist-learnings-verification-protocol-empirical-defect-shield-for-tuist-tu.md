# Verification Protocol: Verification Protocol: Empirical Defect Shield for tuist-tuist-learnings

<!-- PROVENANCE_START
{
  "source_repository": "tuist-tuist-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-28T15:19:38.998Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-tuist-tuist-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tuist-tuist-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-28T15:19:38.998Z`  
> **Learning ID**: `LEARN-EVO-tuist-tuist-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `tuist-tuist-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tuist-tuist-learnings.md`  
> **Source**: github ([https://github.com/tuist/tuist](https://github.com/tuist/tuist))  
> **Source Version**: `8b30c334`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-28T15:19:19.707Z  
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
> **Harvest Timestamp**: 2026-11-28T15:19:19.599Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tuist/tuist`
- **Description**: Tuist builds infrastructure for faster, more reliable build and test workflows across developers, CI, and coding agents. Shared cache, tests, and insights that sit alongside your existing CI.
- **Primary Language / Ecosystem**: Elixir
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5870 stars

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
- **Issue #15834** (2026-11-27): **chore(cli): update Tuist CLI to 4.220.0-canary.35**
  *Symptoms*: Bumps the `tuist` dev-tooling pin in `mise.toml` and `luft/mise.toml` to `4.220.0-canary.35` (latest release, including canary prereleases) with `mise.lock` regenerated in the same commit so CI's `MISE_LOCKED=1` install resolves, and the sandbox image's Tuist CLI to the same release.  Opened by the `update-tuist-cli` workflow.
  **Post-Mortem & Fix Analysis**:
  > ### 🛠️ Tuist Run Report 🛠️  #### Tests 🧪  | Scheme | Status | Module cache hit rate | Xcode cache hit rate | Ran test modules | Commit | |:-:|:-:|:-:|:-:|:-:|:-:| | [TuistAcceptanceTests](https://tuist.dev/tuist/tuist/tests/test-runs/01a21c49-d762-7b0f-972f-7cab127a2a95) | ✅ | - | - | 0/6 | [fdf46fcc2](https://github.com/tuist/tuist/commit/fdf46fcc2aa9efcc66f76e96595d66ac02135f1f) | | [TuistApp](https://tuist.dev/tuist/tuist/tests/test-runs/01a21c49-064c-7267-b2f8-d4fe06f6cde9) | ✅ | - | - | 0/1 | [fdf46fcc2](https://github.com/tuist/tuist/commit/fdf46fcc2aa9efcc66f76e96595d66ac02135f1f) | | [TuistAppSnapshots](https://tuist.dev/tuist/tuist/tests/test-runs/01a21c49-4ac0-794b-a18a-ced5c181be33) | ✅ | - | - | 0/1 | [fdf46fcc2](https://github.com/tuist/tuist/commit/fdf46fcc2aa9efcc66f76e96595d66ac02135f1f) | | [TuistUnitTests](https://tuist.dev/tuist/tuist/tests/test-runs/13337aff-f662-4022-b0e3-8e6bc696923f) | ✅ | 100 % | 95 % | 11/50 | [fdf46fcc2](https://github.com/tuist/tuist/commi

- **Issue #15833** (2026-11-26): **chore(cli): update Tuist CLI to 4.220.0-canary.34**
  *Symptoms*: Bumps the `tuist` dev-tooling pin in `mise.toml` and `luft/mise.toml` to `4.220.0-canary.34` (latest release, including canary prereleases) with `mise.lock` regenerated in the same commit so CI's `MISE_LOCKED=1` install resolves, and the sandbox image's Tuist CLI to the same release.  Opened by the `update-tuist-cli` workflow.
  **Post-Mortem & Fix Analysis**:
  > ### 🛠️ Tuist Run Report 🛠️  #### Previews 📦  | App | Commit | | - | - | | [tuist](https://tuist.dev/tuist/tuist/previews/01a2190f-d692-7a3c-b271-dc1452429420)<br/>`tuist run https://tuist.dev/tuist/tuist/previews/01a2190f-d692-7a3c-b271-dc1452429420` | [90da2de2f](https://github.com/tuist/tuist/commit/90da2de2fe00576bb7f18683cd4b93b57a8ac752) |   #### Tests 🧪  | Scheme | Status | Module cache hit rate | Xcode cache hit rate | Ran test modules | Commit | |:-:|:-:|:-:|:-:|:-:|:-:| | [TuistAcceptanceTests](https://tuist.dev/tuist/tuist/tests/test-runs/6e6391df-8107-4bb6-b445-5658d2012493) | ✅ | 100 % | 100 % | 4/6 | [38189d6fe](https://github.com/tuist/tuist/commit/38189d6fe6db58d00079be684fa0ecd283a55b19) | | [TuistApp](https://tuist.dev/tuist/tuist/tests/test-runs/01a21929-778e-7a76-ab14-5dc591a15b85) | ✅ | - | - | 0/1 | [38189d6fe](https://github.com/tuist/tuist/commit/38189d6fe6db58d00079be684fa0ecd283a55b19) | | [TuistAppSnapshots](https://tuist.dev/tuist/tuist/tests/test-runs/01

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

### Incident Patch 1: `82fcb16e` (2026-11-28)
**Commit Message**: fix(sandboxd): cap template builds and prebuild only with room

A template build ran in the vmm container's cgroup with no limit of its
own. When a template tag rolled out, the daemon prebuilt the new tag's
shapes (16x8192, 16x4096) right away, often while the server had shrunk
the carve-out to its 1 GiB floor or a running sandbox filled it. The
build pushed vmm past its limit, and the kubelet's memory.oom.group
killed every VM in the container (four vmm OOMKills on Nov 26-27, one
of which surfaced as a sandbox's "lost vmm: EOF").

Each build now runs in its own vm-tmpl-* cgroup whose memory.max is its
guest memory plus 512 MiB, lowered to the container's remaining room
less 256 MiB, so an OOM kills only the build. Prebuilds at startup and
on a tag change run only when the container has room for the shape plus
768 MiB (inactive page cache counted free); otherwise the first create
builds the shape after the server grew the carve-out, and the tag
switch does not wait on it.

Amp-Thread-ID: https://ampcode.com/threads/T-01a22133-b1aa-7491-bb8c-d18e691196a4
Co-authored-by: Marek Fort <[REDACTED_EMAIL]>

**File**: `infra/sandboxd/AGENTS.md` (modified, +1/-1)
```diff
@@ -801,7 +801,7 @@ agent so the manager runs end to end without KVM).
 | `FIRECRACKER_BIN`, `JAILER_BIN` | `/usr/local/bin/{firecracker,jailer}` | |
 | `JAILER_ENABLED` | `true` | `false` runs Firecracker directly under `ip netns exec` with absolute paths (debug only). |
 | `JAIL_UID_BASE` | `10000` | Jail uid/gid = base + slot index. |
-| `PREBUILD_SHAPES` | | Comma-separated shapes to build at startup, e.g. `2x4096,4x8192`. Must be a subset of `ALLOWED_SHAPES` when that is set. |
+| `PREBUILD_SHAPES` | | Comma-separated shapes to build at startup and for each new template tag, e.g. `2x4096,4x8192`. Must be a subset of `ALLOWED_SHAPES` when that is set. With per-VM memory cgroups, a prebuild runs only when the VMs' container has room for the shape's guest memory plus 768 MiB (`memory.max` less `memory.current`, inactive page cache counted free); otherwise the first create that needs the shape builds it, after the server grew the carve-out, and a new tag is switched to without it. Every template build runs in its own `vm-tmpl-*` cgroup with `memory.max` at its guest memory plus 512 MiB, lowered to the container's room less 256 MiB, so a build that outgrows it fails alone: the kubelet's `memory.oom.group` on the container kills every VM when the container's own limit is hit (the Nov 26–27 production vmm OOMKills). |
 | `ALLOWED_SHAPES` | | The only shapes `create` and template builds accept. Empty accepts any valid shape. |
 | `DISK_BUDGET_GIB` | `0` | Share of the data filesystem sandboxes may reserve, reported as `disk.budget_bytes`; the server reserves each sandbox's ceiling against it. `0` reports no budget. |
 | `DIRECT_EXEC_ADDR` | | Listen address for claims of claimed execs, e.g. `$(POD_IP):7071`. Empty disables claims. |
```

**File**: `infra/sandboxd/cmd/sandboxd/main.go` (modified, +12/-3)
```diff
@@ -378,6 +378,11 @@ func main() {
 			}
 		},
 	}
+	// Each build gets its own capped cgroup, so a build the container has
+	// no room for fails alone instead of OOMing every VM with it.
+	if vmCgroups != nil {
+		builder.Cgroups = vmCgroups
+	}
 	// The node's runner-cache agent seeds workers' repositories from its
 	// checkout masters and takes their exports. It authorizes this Pod by
 	// name and address; without either, workers clone as before.
@@ -526,7 +531,7 @@ func main() {
 			if ctx.Err() != nil {
 				return
 			}
-			if _, err := builder.Ensure(ctx, defaultTemplate, shape); err != nil {
+			if _, err := builder.Prebuild(ctx, defaultTemplate, shape); err != nil {
 				logger.Error("prebuilding template shape", "shape", shape.String(), "error", err)
 			}
 		}
@@ -854,7 +859,9 @@ var (
 // installer completed last. The prebuilt shapes are built first, so the
 // first sandbox on the new tag does not wait for a template boot, and the
 // switch happens only once they are ready; until then creates keep using the
-// previous tag. Sandboxes already created keep their own tag. Tags nothing
+// previous tag. A shape the VMs' container has no room to build
+// (Builder.Prebuild) does not hold the switch back: the first create that
+// needs it builds it. Sandboxes already created keep their own tag. Tags nothing
 // uses any longer are removed after each switch, and report announces the
 // new default to the server.
 func followTemplate(ctx context.Context, logger *slog.Logger, store *template.Store, builder *template.Builder, manager *sandbox.Manager,
@@ -892,7 +899,9 @@ func followTemplate(ctx context.Context, logger *slog.Logger, store *template.St
 		tmpl, err := store.Get(name, tag)
 		if err == nil {
 			for _, shape := range prebuild {
-				if _, err = builder.Ensure(ctx, tmpl, shape); err != nil {
+				// A shape the container has no room for is left to its
+				// first create on the new tag.
+				if _, err = builder.Prebuild(ctx, tmpl, shape); err != nil {
 					break
 				}
 			}
```

**File**: `infra/sandboxd/internal/hostinfo/cgroups.go` (modified, +58/-0)
```diff
@@ -196,6 +196,64 @@ func (c *VMCgroups) Open(id string, guaranteeMilli, lowBytes uint64) (*os.File,
 	return os.Open(dir)
 }
 
+// OpenCapped creates (or reuses) a cgroup for a VM that holds nobody's
+// sandbox, a template build, and limits it to maxBytes (memory.max). The
+// kubelet sets memory.oom.group on the container's cgroup, so an OOM the
+// container's limit drives kills every VM in it; one this cgroup's own
+// limit drives kills only its processes. The caller keeps maxBytes below
+// what the container has left (MemoryRoom). It fails without the memory
+// controller, since the VM could not be held to its cap.
+func (c *VMCgroups) OpenCapped(id string, maxBytes uint64) (*os.File, error) {
+	if !c.memory {
+		return nil, errors.New("per-VM memory limits need the memory controller")
+	}
+	dir := filepath.Join(c.dir, vmCgroupPrefix+id)
+	if err := os.Mkdir(dir, 0o755); err != nil && !errors.Is(err, os.ErrExist) {
+		return nil, err
+	}
+	if err := os.WriteFile(filepath.Join(dir, "memory.max"), []byte(strconv.FormatUint(maxBytes, 10)), 0o644); err != nil {
+		return nil, fmt.Errorf("limiting the memory of %s: %w", filepath.Base(dir), err)
+	}
+	return os.Open(dir)
+}
+
+// MemoryRoom is what the container's cgroup can still charge before its
+// limit: memory.max less memory.current, with the inactive page cache
+// (memory.stat inactive_file) counted as free, since reclaim drops it
+// before anything OOMs. False when the container has no limit or it cannot
+// be read.
+func (c *VMCgroups) MemoryRoom() (uint64, bool) {
+	if c == nil {
+		return 0, false
+	}
+	return memoryRoom(c.dir)
+}
+
+func memoryRoom(dir string) (uint64, bool) {
+	limit, ok := ReadCgroupValue(dir, "", "memory.max", false)
+	if !ok {
+		return 0, false
+	}
+	used, ok := ReadCgroupValue(dir, "", "memory.current", false)
+	if !ok {
+		return 0, false
+	}
+	if data, err := os.ReadFile(filepath.Join(dir, "memory.stat")); err == nil {
+		for _, line := range strings.Split(string(data), "\n") {
+			if value, found := strings.CutPrefix(line, "inactive_file "); found {
+				if inactive, err := strconv.ParseUint(strings.TrimSpace(value), 10, 64); err == nil {
+					used -= min(inactive, used)
+				}
+				break
+			}
+		}
+	}
+	if used >= limit {
+		return 0, true
+	}
+	return limit - used, true
+}
+
 // MemoryCurrent is everything charged to the VM's cgroup (memory.current):
 // the guest memory its process touched plus the page cache its disk I/O
 // filled. False without per-VM memory accounting or a readable cgroup.
```

**File**: `infra/sandboxd/internal/hostinfo/hostinfo_test.go` (modified, +60/-0)
```diff
@@ -316,3 +316,63 @@ func TestAdoptVMCgroupsRefusesACgroupWithoutCPU(t *testing.T) {
 		t.Fatal("adopted a cgroup that delegates no cpu controller")
 	}
 }
+
+// Room is the limit less usage, with inactive page cache counted free;
+// a cgroup at or over its limit has none.
+func TestMemoryRoomCountsInactivePageCacheAsFree(t *testing.T) {
+	for _, tc := range []struct {
+		name, max, current, stat string
+		want                     uint64
+		ok                       bool
+	}{
+		{"cache counted free", "10000", "8000", "anon 5000\ninactive_file 3000\nactive_file 0\n", 5000, true},
+		{"no stat", "10000", "8000", "", 2000, true},
+		{"over the limit", "10000", "12000", "inactive_file 1000\n", 0, true},
+		{"no limit", "max", "8000", "", 0, false},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			dir := t.TempDir()
+			files := map[string]string{"memory.max": tc.max, "memory.current": tc.current}
+			if tc.stat != "" {
+				files["memory.stat"] = tc.stat
+			}
+			for name, content := range files {
+				if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0o644); err != nil {
+					t.Fatal(err)
+				}
+			}
+			got, ok := memoryRoom(dir)
+			if got != tc.want || ok != tc.ok {
+				t.Fatalf("room = %d, %v; want %d, %v", got, ok, tc.want, tc.ok)
+			}
+		})
+	}
+}
+
+// A capped VM cgroup gets memory.max; without the memory controller it
+// cannot be capped and is refused.
+func TestOpenCappedSetsMemoryMax(t *testing.T) {
+	root := fakeCgroup(t, "cpu memory")
+	cgroups, err := setupVMCgroups(root, "/pod/container", daemonCgroup, 250)
+	if err != nil {
+		t.Fatal(err)
+	}
+	file, err := cgroups.OpenCapped("tmpl-x", 4<<30)
+	if err != nil {
+		t.Fatal(err)
+	}
+	file.Close()
+	data, _ := os.ReadFile(filepath.Join(root, "pod", "container", "vm-tmpl-x", "memory.max"))
+	if string(data) != strconv.FormatUint(4<<30, 10) {
+		t.Fatalf("memory.max = %q", data)
+	}
+
+	root = fakeCgroup(t, "cpu")
+	cgroups, err = setupVMCgroups(root, "/pod/container", daemonCgroup, 250)
+	if err != nil {
+		t.Fatal(err)
+	}
+	if _, err := cgroups.OpenCapped("tmpl-x", 4<<30); err == nil {
+		t.Fatal("capped a VM without the memory controller")
+	}
+}
```

**File**: `infra/sandboxd/internal/template/builder.go` (modified, +89/-2)
```diff
@@ -24,8 +24,29 @@ const (
 	// TemplateHostname is the hostname baked into the snapshot; configure
 	// replaces it in every sandbox.
 	TemplateHostname = "sandbox"
+	// BuildOverheadBytes is what a build may hold beyond its guest's memory:
+	// Firecracker and the jailer, and the snapshot's page cache not yet
+	// written back.
+	BuildOverheadBytes = 512 << 20
+	// BuildMarginBytes stays free in the VMs' container next to a build's
+	// cap, for vmm and the running guests while the build runs, so the
+	// build's own limit is reached before the container's.
+	BuildMarginBytes = 256 << 20
+	// MinBuildBytes is the smallest cap a build is started with; below it
+	// the build fails without booting.
+	MinBuildBytes = 256 << 20
 )
 
+// BuildCgroups holds template builds to a memory cap below what the VMs'
+// container has left (hostinfo.VMCgroups). The kubelet makes an OOM of the
+// container kill every VM in it, so a build that outgrew the room left by
+// running sandboxes used to take them down with it; capped, it fails alone.
+type BuildCgroups interface {
+	MemoryRoom() (uint64, bool)
+	OpenCapped(id string, maxBytes uint64) (*os.File, error)
+	Remove(id string) error
+}
+
 // Builder boots a template with a shape and snapshots it. Builds are
 // serialized per (template, shape); concurrent Ensure calls wait for the
 // running build.
@@ -57,6 +78,9 @@ type Builder struct {
 	// Balloon gives every shape snapshot firecracker.ReportingBalloon, so
 	// guests restored from it return their free memory to the host.
 	Balloon bool
+	// Cgroups, when set, spawns every build into its own capped cgroup and
+	// lets Prebuild skip a shape the container has no room for.
+	Cgroups BuildCgroups
 
 	mu     sync.Mutex
 	builds map[string]*build
@@ -109,6 +133,47 @@ func (b *Builder) Ensure(ctx context.Context, t Template, shape Shape) (Artifact
 	return t.Artifacts(shape)
 }
 
+// Prebuild is Ensure for a build nothing waits on (PREBUILD_SHAPES, a new
+// template tag): with Cgroups set it builds only when the VMs' container
+// has room for the shape's guest memory, the build overhead and the margin,
+// and otherwise answers false and leaves the shape to the first create that
+// needs it, for which the server grows the container first. Room is read
+// once; a sandbox placed meanwhile can still take it, and the cap then
+// fails the build rather than the container.
+func (b *Builder) Prebuild(ctx context.Context, t Template, shape Shape) (bool, error) {
+	if b.Cgroups != nil && !t.ShapeReady(shape) {
+		need := shapeBytes(shape) + BuildOverheadBytes + BuildMarginBytes
+		if room, ok := b.Cgroups.MemoryRoom(); ok && room < need {
+			b.logger().Info("leaving a template shape for its first create; the VMs' container has no room to build it",
+				"template", t.Name, "tag", t.Tag, "shape", shape.String(), "room_bytes", room, "needed_bytes", need)
+			return false, nil
+		}
+	}
+	if _, err := b.Ensure(ctx, t, shape); err != nil {
+		return false, err
+	}
+	return true, nil
+}
+
+func shapeBytes(shape Shape) uint64 {
+	return uint64(shape.MemoryMB) << 20 //nolint:gosec // Validated positive.
+}
+
+// buildCap is a build's memory.max: its guest memory plus the overhead,
+// lowered to what the container has left less the margin. It fails when
+// the container is too full to start one.
+func (b *Builder) buildCap(shape Shape) (uint64, error) {
+	limit := shapeBytes(shape) + BuildOverheadBytes
+	room, ok := b.Cgroups.MemoryRoom()
+	if !ok {
+		return limit, nil
+	}
+	if room < MinBuildBytes+BuildMarginBytes {
+		return 0, fmt.Errorf("the VMs' container has %d bytes left, too few for a template build", room)
+	}
+	return min(limit, room-BuildMarginBytes), nil
+}
+
 func (b *Builder) run(t Template, shape Shape, key string, bld *build) {
 	timeout := b.BootTimeout
 	if timeout == 0 {
@@ -211,10 +276,32 @@ func (b *Builder) build(ctx context.Context, t Template, shape Shape) (err error
 		}
 	}()
 
-	inst, err := b.Launcher.Launch(ctx, vm.Spec{
+	spec := vm.Spec{
 		ID: id, JailBase: b.JailBase, FirecrackerBin: b.FirecrackerBin, JailerBin: b.JailerBin,
 		JailerEnabled: b.JailerEnabled, UID: uid, GID: uid, NetNS: ns,
-	})
+	}
+	if b.Cgroups != nil {
+		limit, err := b.buildCap(shape)
+		if err != nil {
+			return err
+		}
+		// Without a cap (no memory controller) the build runs in the
+		// container's cgroup, as before.
+		if cgroup, err := b.Cgroups.OpenCapped(id, limit); err != nil {
+			log.Warn("capping the template build's memory failed; it runs uncapped", "error", err)
+		} else {
+			defer cgroup.Close()
+			spec.Cgroup = cgroup
+			// Registered before the kill below, so it runs after it.
+			defer func() {
+				if rmErr := b.Cgroups.Remove(id); rmErr != nil {
+					log.Warn("removing the template build's cgroup failed", "error", rmErr)
+				}
+			}()
+			log.Info("template build capped", "memory_max", limit)
+		}
+	}
+	inst, err := b.Launcher.Launch(ctx, spec)
 	if err != nil {
 		return fmt.Errorf("launching 
```

**File**: `infra/sandboxd/internal/template/template_test.go` (modified, +113/-0)
```diff
@@ -537,3 +537,116 @@ func TestPreviousTagIsTheOtherTagTheNodeRanLast(t *testing.T) {
 		t.Fatalf("previous tag of rolled-back %q %v, want current", tag, err)
 	}
 }
+
+// buildCgroups stands in for hostinfo.VMCgroups: a fixed room and the caps
+// builds were opened with.
+type buildCgroups struct {
+	mu      sync.Mutex
+	dir     string
+	room    uint64
+	known   bool
+	caps    map[string]uint64
+	removed []string
+}
+
+func (c *buildCgroups) MemoryRoom() (uint64, bool) { return c.room, c.known }
+
+func (c *buildCgroups) OpenCapped(id string, maxBytes uint64) (*os.File, error) {
+	c.mu.Lock()
+	defer c.mu.Unlock()
+	if c.caps == nil {
+		c.caps = map[string]uint64{}
+	}
+	c.caps[id] = maxBytes
+	return os.Open(c.dir)
+}
+
+func (c *buildCgroups) Remove(id string) error {
+	c.mu.Lock()
+	defer c.mu.Unlock()
+	c.removed = append(c.removed, id)
+	return nil
+}
+
+// A build is capped at its guest memory plus overhead when the container
+// has room, and lowered to the room less the margin when it has less, so
+// the build's own limit, not the container's, is what it hits.
+func TestBuilderCapsEachBuildBelowTheContainersRoom(t *testing.T) {
+	shape := Shape{VCPUs: 2, MemoryMB: 4096}
+	full := uint64(4096)<<20 + BuildOverheadBytes
+	for _, tc := range []struct {
+		name string
+		room uint64
+		want uint64
+	}{
+		{"plenty of room", 64 << 30, full},
+		{"less room than the build", 3 << 30, 3<<30 - BuildMarginBytes},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			dataDir := t.TempDir()
+			tmpl := seedTemplate(t, filepath.Join(dataDir, "templates"), "default", "t1")
+			b := newBuilder(t, dataDir, &fakevm.Launcher{}, &fakevm.Network{}, &eventSink{})
+			cg := &buildCgroups{dir: dataDir, room: tc.room, known: true}
+			b.Cgroups = cg
+			if _, err := b.Ensure(context.Background(), tmpl, shape); err != nil {
+				t.Fatal(err)
+			}
+			id := BuildID(tmpl, shape)
+			if got := cg.caps[id]; got != tc.want {
+				t.Fatalf("memory.max = %d, want %d", got, tc.want)
+			}
+			if len(cg.removed) != 1 || cg.removed[0] != id {
+				t.Fatalf("removed cgroups %v", cg.removed)
+			}
+		})
+	}
+}
+
+// A container too full for any build fails the build without booting a VM.
+func TestBuilderRefusesABuildTheContainerHasNoRoomFor(t *testing.T) {
+	dataDir := t.TempDir()
+	tmpl := seedTemplate(t, filepath.Join(dataDir, "templates"), "default", "t1")
+	launcher := &fakevm.Launcher{}
+	b := newBuilder(t, dataDir, launcher, &fakevm.Network{}, &eventSink{})
+	b.Cgroups = &buildCgroups{dir: dataDir, room: MinBuildBytes + BuildMarginBytes - 1, known: true}
+	shape := Shape{VCPUs: 2, MemoryMB: 4096}
+	if _, err := b.Ensure(context.Background(), tmpl, shape); err == nil {
+		t.Fatal("expected the build to be refused")
+	}
+	if len(launcher.Instances()) != 0 || tmpl.ShapeReady(shape) {
+		t.Fatal("a refused build booted a VM or marked the shape ready")
+	}
+}
+
+// Prebuild leaves a shape for its first create when the container cannot
+// hold the guest, the overhead and the margin, and builds it when it can.
+func TestPrebuildWaitsForRoom(t *testing.T) {
+	shape := Shape{VCPUs: 16, MemoryMB: 8192}
+	need := uint64(8192)<<20 + BuildOverheadBytes + BuildMarginBytes
+	for _, tc := range []struct {
+		name  string
+		room  uint64
+		known bool
+		built bool
+	}{
+		{"1 GiB floor, as in the production OOMs", 1 << 30, true, false},
+		{"one byte short", need - 1, true, false},
+		{"exactly enough", need, true, true},
+		{"no limit to read", 0, false, true},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			dataDir := t.TempDir()
+			tmpl := seedTemplate(t, filepath.Join(dataDir, "templates"), "default", "t1")
+			launcher := &fakevm.Launcher{}
+			b := newBuilder(t, dataDir, launcher, &fakevm.Network{}, &eventSink{})
+			b.Cgroups = &buildCgroups{dir: dataDir, room: tc.room, known: tc.known}
+			built, err := b.Prebuild(context.Background(), tmpl, shape)
+			if err != nil {
+				t.Fatal(err)
+			}
+			if built != tc.built || tmpl.ShapeReady(shape) != tc.built || (len(launcher.Instances()) > 0) != tc.built {
+				t.Fatalf("built=%v ready=%v launches=%d, want built=%v", built, tmpl.ShapeReady(shape), len(launcher.Instances()), tc.built)
+			}
+		})
+	}
+}
```

---

### Incident Patch 2: `cf9413eb` (2026-11-28)
**Commit Message**: fix(infra): stop taking diff snapshots when production sandboxes pause

Since the readiness ping logging went in, both node-local resumes after a
failed pre-pause guest sync were of Diff images (generations 2 and 3),
and both guests never answered within BOOT_TIMEOUT: every ping timed out,
the restore cold booted, and the guest lost what it had not synced.
Earlier failures predate diff snapshots, so Diff is not the only cause,
but it is the one we can switch off. Pauses take full snapshots again; a
VM restored with tracking keeps it until its next restore.

Amp-Thread-ID: https://ampcode.com/threads/T-01a2139d-e501-7641-9d1f-be0eae549a5f
Co-authored-by: Marek Fort <[REDACTED_EMAIL]>

**File**: `infra/helm/tuist/values-managed-production.yaml` (modified, +4/-3)
```diff
@@ -2496,9 +2496,10 @@ sandboxes:
   # Memory bursting: guests return the memory they free (and, once idle,
   # their page cache) to the host, and pauses punch zeros out of images.
   balloonFreePageReporting: true
-  # Pauses of a VM restored from its own memory image write only the pages
-  # it changed, merged onto a clone of that image.
-  diffSnapshots: true
+  # Off: resumes of Diff images whose pre-pause guest sync failed hung past
+  # BOOT_TIMEOUT (2 of 2 on 2026-11-27) and cold booted, losing unsynced
+  # data. Pauses take full snapshots until that is understood.
+  diffSnapshots: false
   # What the daemons were started with, so raising maxCpu (read by the
   # server) restarts none of them.
   daemonMaxCpu: "250m"
```

---

### Incident Patch 3: `8bfa7e37` (2026-11-28)
**Commit Message**: fix(server): count a tracked-file fallback's tests on its tracked files

A tracked_file_changed fallback decides no test one by one, so it stores
no decision rows, and the Changed files tab read each file's selected
tests only from those rows: every file, the tracked ones included,
showed 0. Each tracked changed file is now credited with the tests the
run selected, since any one of them alone runs them all; the run only
records the first in path order.

Co-authored-by: Eduardo Nunes <[REDACTED_EMAIL]>
Amp-Thread-ID: https://ampcode.com/threads/T-01a2204e-98a2-719a-aef4-2e831fd5b587

**File**: `server/docs/coverage-test-selection.md` (modified, +1/-1)
```diff
@@ -344,7 +344,7 @@ There's no separate accuracy measurement. Default-branch runs are the safety net
 | Test run page, Selective Testing tab (`TuistWeb.TestSelection.RunTab`) | Outcome, counts and baseline, then the Tests, Modules, Changed files and Debug sub-tabs. A sharded run's shards are on the Overview tab, and the Tests tab shows each test's shard. The rest of the invocation (scheme, destination, commit) is on the run's Overview tab. The counts are the selected tests out of requested and the skipped tests; the skip rate as on the Test Selection page; the skipped modules (the keys of `skipped_modules`) out of all requested modules; and the estimated time saved, from the baseline durations of every skipped test, in skipped modules too. The test run's overview card, Selective Testing, shows the selected tests out of requested and the skipped tests for a run with a baseline, the skip rate as on the Test Selection page, and the modules hashing skipped out of all requested modules. Whether a run shows as a selection depends only on its baseline (`Selections.has_baseline?/1`): a run with a reason and a baseline (`tracked_file_changed`, for one) shows its counts, baseline and sub-tabs, its Tests the tests that ran under its reason. A run without a baseline shows the reason, titled Coverage not applied, followed by the run page's existing selective testing table when the run has default selective testing data. The tab shows for a run with a `test_impact_run_id`, or when the run has default selective testing data, which alone shows only that table. A run without a baseline also shows only that table when it has one: coverage decided nothing to show. Once the impact run expired, the tab says so instead of hiding. | The run's impact run |
 | &nbsp;&nbsp;Tests | Every requested test, its decision and the rule, and its shard, filterable by decision, reason and shard; the outcome is on the Overview tab | The stored decision's bitmaps (`test_impact_run_decisions`), expanded only for the page shown and named through the checkpoint's tests (`test_impact_snapshot_tests`); a decision that's incomplete or expired lists none. The baseline's tests in the keys of `skipped_modules` follow, with reason `module_skipped`. For a run with a reason that found its baseline, nothing is stored: the baseline's tests in `requested_modules` are selected under the run's reason. The rows name the rule, not the file that triggered it; a test case run's tab shows the file |
 | &nbsp;&nbsp;Modules | Per module left to decide, tests selected of requested, skip rate within the module, why it runs and estimated time saved, then the modules hashing found not changed, each with its number of tests in the baseline. A test run with module-level selective testing data shows the run page's existing selective testing table here instead. | The Tests rows grouped by module, then `test_impact_runs.skipped_modules`; the replacement reads Xcode's `xcode_targets` (`Xcode.has_selective_testing_data?/1`) |
-| &nbsp;&nbsp;Changed files | Path and status, the tracked-file pattern that matches it, and how many tests it selected, filterable by tracked; a note when the diff was capped at 5,000 files. For a dirty checkout it lists only the uncommitted changes, saying so, from `test_impact_runs.dirty_files`. Without any stored files the tab shows no count and says why: a dirty checkout whose client didn't mark its changes, or a diff past retention | `test_impact_diffs`, and the selected bitmaps' cardinality per `matched_path` |
+| &nbsp;&nbsp;Changed files | Path and status, the tracked-file pattern that matches it, and how many tests it selected (in a `tracked_file_changed` fallback, which stores no decision, each tracked file is credited with every test the run selected, since any one of them alone runs them all), filterable by tracked; a note when the diff was capped at 5,000 files. For a dirty checkout it lists only the uncommitted changes, saying so, from `test_impact_runs.dirty_files`. Without any stored files the tab shows no count and says why: a dirty checkout whose client didn't mark its changes, or a diff past retention | `test_impact_diffs`, and the selected bitmaps' cardinality per `matched_path` (a tracked-file fallback's `selected_count`) |
 | &nbsp;&nbsp;Config | The run's tracked-file patterns, 20 a page with the one a fallback matched first, each with its source (a Tuist default or the build system's configuration file) and the file it matched; the only tab of a fallback without a baseline | `Selections.tracked_patterns/3`: the defaults and the run's `tracked_files` |
 | &nbsp;&nbsp;Debug | Tuist operators only (`Accounts.tuist_operator?/1`): the rule trace (selected, skipped and verdict per rule, aborts highlighted), then the reason coverage evidence wasn't applied and its matched path and pattern, when there is one | `test_impact_runs` |
 | Test case run page, Selective Testing tab (`TuistWeb.TestSelection.TestCaseRunTab`, `?tab=selective-testing`
```

**File**: `server/lib/tuist/tests/selections.ex` (modified, +9/-1)
```diff
@@ -408,7 +408,7 @@ defmodule Tuist.Tests.Selections do
       Map.merge(file, %{
         tracked: not is_nil(match),
         matched_pattern: match && match.pattern,
-        selected_tests_count: Map.get(counts, file.path, 0)
+        selected_tests_count: selected_tests_count(run, counts, file.path, match)
       })
     end)
     |> Enum.filter(
@@ -429,6 +429,14 @@ defmodule Tuist.Tests.Selections do
 
   defp tracked_matcher(project, run), do: TrackedFiles.matcher(project, run.tracked_files)
 
+  # A tracked-file fallback decides no test, so it stores no decision rows to
+  # count: every test it ran is down to its tracked files, any one of which
+  # alone runs them all (the run records only the first, in path order).
+  defp selected_tests_count(%Run{reason: "tracked_file_changed"} = run, _counts, path, match)
+       when not is_nil(match) or path == run.matched_path, do: run.selected_count
+
+  defp selected_tests_count(_run, counts, path, _match), do: Map.get(counts, path, 0)
+
   # Read off the decision's bitmaps, keyed by the path that selected them.
   defp selected_counts_by_path(%Run{} = run) do
     from(d in decision_rows(run),
```

**File**: `server/test/tuist/tests/selections_test.exs` (modified, +32/-0)
```diff
@@ -468,6 +468,38 @@ defmodule Tuist.Tests.SelectionsTest do
       assert {[%{path: "docs/README.md"}], _meta} = Selections.changed_files(project, run, diff, search: "readme")
       assert Selections.get_diff(%{run | baseline_sha: nil}) == nil
     end
+
+    test "credit a tracked-file fallback's tests to each tracked file, which stores no decision", %{
+      project: project
+    } do
+      %{run: run} =
+        run(project,
+          outcome: "fallback",
+          reason: "tracked_file_changed",
+          matched_path: "App/Project.swift",
+          selected: [],
+          requested_count: 7,
+          selected_count: 3,
+          skipped_count: 4
+        )
+
+      TestSelectionFixtures.diff_fixture(
+        project_id: project.id,
+        changed_files: [
+          %{path: "App/Project.swift"},
+          %{path: "Sources/Search/Search.swift"},
+          %{path: "Tuist/Package.swift"}
+        ]
+      )
+
+      {rows, _meta} = Selections.changed_files(project, run, Selections.get_diff(run))
+
+      assert Enum.map(rows, &{&1.path, &1.tracked, &1.selected_tests_count}) == [
+               {"App/Project.swift", true, 3},
+               {"Tuist/Package.swift", true, 3},
+               {"Sources/Search/Search.swift", false, 0}
+             ]
+    end
   end
 
   describe "counted_by_module?/1 and module_counts/1" do
```

#### Recent Merged Pull Requests:
- **PR #15834** (2026-11-27): chore(cli): update Tuist CLI to 4.220.0-canary.35 (@tuist-automation[bot])
- **PR #15833** (2026-11-26): chore(cli): update Tuist CLI to 4.220.0-canary.34 (@tuist-automation[bot])
- **PR #15832** (2026-11-26): fix(cli): handle compound canImport conditions in dependency inspection (@musiienko)
- **PR #15831** (2026-11-26): chore(cli): update Tuist CLI to 4.220.0-canary.31 (@tuist-automation[bot])
- **PR #15830** (closed): chore(cli): update Tuist CLI to 4.220.0-canary.26 (@tuist-automation[bot])
- **PR #15829** (closed): chore(deps): bump i18next to 26.3.4 [security] (@pepicrft)

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

## X. sandboxd): cap template builds and prebuild only with room

**RULE**:
When implementing operations in `infra/sandboxd/AGENTS.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tuist/tuist. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `82fcb16e`: sandboxd): cap template builds and prebuild only with room. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Elixir data structures, boundary deserialization, API parsing, or resource lifecycles matching `infra/sandboxd/AGENTS.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```elixir
// Verified production-grade fix pattern:
| `PREBUILD_SHAPES` | | Comma-separated shapes to build at startup and for each new template tag, e.g. `2x4096,4x8192`. Must be a subset of `ALLOWED_SHAPES` when that is set. With per-VM memory cgroups, a prebuild runs only when the VMs' container has room for the shape's guest memory plus 768 MiB (`memory.max` less `memory.current`, inactive page cache counted free); otherwise the first create that needs the shape builds it, after the server grew the carve-out, and a new tag is switched to without it. Every template build runs in its own `vm-tmpl-*` cgroup with `memory.max` at its guest memory plus 512 MiB, lowered to the container's room less 256 MiB, so a build that outgrows it fails alone: the kubelet's `memory.oom.group` on the container kills every VM when the container's own limit is hit (the Nov 26–27 production vmm OOMKills). |
```

**NEGATIVE CONSTRAINT**:
```elixir
// Induced defect failure mode:
| `PREBUILD_SHAPES` | | Comma-separated shapes to build at startup, e.g. `2x4096,4x8192`. Must be a subset of `ALLOWED_SHAPES` when that is set. |
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `82fcb16e` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
