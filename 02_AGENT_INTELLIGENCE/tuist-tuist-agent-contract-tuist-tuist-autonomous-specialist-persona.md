# Agent Contract: Agent Contract: tuist/tuist Autonomous Specialist Persona

<!-- PROVENANCE_START
{
  "source_repository": "tuist/tuist",
  "source_url": "https://github.com/tuist/tuist",
  "source_version": "d7dac153",
  "license": "NOASSERTION",
  "timestamp": "2026-11-22T18:44:06.614Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-tuist-tuist",
  "canonical_classification": "agent_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tuist/tuist](https://github.com/tuist/tuist) (Revision: `d7dac153`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-22T18:44:06.614Z`  
> **Learning ID**: `learn-github-tuist-tuist`


## 1. Agent Role & Persona Contract
- **Role Identifier**: `tuist-tuist-specialist`
- **Governing Capability**: Autonomous execution and domain-specialized problem resolution.
- **Trust Boundary**: Reads and modifies only authorized workspace resources.

## 2. Operational Capabilities
# Forensic Learning Record (Deep Inspection): tuist/tuist

> **Canonical Artifact**: `07_PROJECT_LEARNING/tuist-tuist-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tuist/tuist](https://github.com/tuist/tuist))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-22T18:44:05.066Z  
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
- **Issue #15805** (2026-11-19): **docs(handbook): manage the Tuist Digest in Atlas**
  *Symptoms*: <!-- CURSOR_AGENT_PR_BODY_BEGIN --> The Tuist Digest page still told the team to send the newsletter, and to manage subscribers, templates, and campaigns, in Loops. Newsletter and lifecycle email now go through Tuist's self-hosted Atlas, so the handbook should describe the current tool.  This updates the overview in `handbook/handbook/community/tuist-digest.md`:  - The newsletter is sent in Tuist's self-hosted Atlas. - Subscribers, templates, and campaigns are managed in Atlas. - The `app.loops.so` link is removed.  The public subscribe form at tuist.dev/newsletter and the unsubscribe link in each edition are unchanged. This is a docs-only change.  A short historical note that Loops used to send the digest would leave the operating procedure pointing at a tool the team no longer uses, so the page describes Atlas only.  ### How to test locally  From `handbook/`, run `mise run build`. The VitePress build completed successfully, including its dead-link check.  Review requested from @tuist/company.  <!-- CURSOR_AGENT_PR_BODY_END -->  <div><a href="https://cursor.com/agents/bc-7e634cae-4cf3-5466-bc7a-5fa1afe4338f?cursor_ref=pr_footer&cursor_cta=open_in_web"><picture><source media="(prefers-color-scheme: dark)" srcset="https://cursor.com/assets/images/open-in-web-dark.png"><source media="(prefers-color-scheme: light)" srcset="https://cursor.com/assets/images/open-in-web-light.png"><img alt="Open in Web" width="114" height="28" src="https://cursor.com/assets/images/open-in-web-dark.

- **Issue #15803** (2026-11-19): **feat(infra): move larch-edge-a's BMC to larch-tor-b port 21**
  *Symptoms*: ## What  Moves larch-edge-a's BMC management link from `larch-tor-b` port 28 to copper port 21, re-rendered: the site file, `cables/larch.md` and the `larch-tor-b` RackSwitch object (port 21 now native VLAN 20, port 28 back to VLAN 1, the port map entry moved).  ## Why  Marek decided on 19 Nov that the planned 10G inter-site link between larch and rack 1 lands on `larch-tor-b` port 28. Port 28 stays empty here; the inter-site port entry and its VLAN come once a carrier is chosen.  Port 21 is free on main. The minis use 1–8 under the 20-Mac plan, and 22–24 are management. The BMC stays on the ToR opposite the one larch-edge-a provisions (larch-tor-a), so the opposite-ToR rule (`fleet_check_management_links`) still holds.  ## Rollout  Physically, edge-a's BMC cable is in tor-b 28 today. After this merges and tor-b converges, port 28 no longer carries the management VLAN, so edge-a's BMC is unreachable until the cable moves to port 21. Nothing uses that BMC yet (edge-a isn't up), so merge it around the next DC visit and recable then. The move is on the visit checklist, along with a replacement label pair.  #15626 also re-renders `k8s/larch/larch-tor-b.yaml`; whichever merges second needs a rebase and `mise run rack:fleet --site larch render`.  ## Validation  - `mise run rack:fleet --site larch render`, then `render --check` clean for all sites. - `mise run rack:fleet-test`: 310 ok, 0 failed, 12 files. 
  **Post-Mortem & Fix Analysis**:
  > Closing: the team no longer works through pull requests.

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

### Incident Patch 1: `9c6c3a84` (2026-11-21)
**Commit Message**: fix(server): stop failed macOS sandbox creates from holding their host

A macOS create that failed kept its row in `error` with the host
reservation it was placed with: `resident` held CPU, memory and a VM slot
(only an error report cleared it, which a host that already deleted the
VM never sends), and an errored VM the host still listed held its disk
budget, both until the 14-day retention. Enough of them refused every
macOS create on the fleet.

A failed create never ran, so the server now deletes it from its host at
once and keeps the row in `error` without a node, the form a create
refused for room has. A host that cannot be reached deletes it when it
next reports it in `error`. A report that no longer lists an errored
macOS row clears its `resident` and releases a failed create's node,
which also frees rows already stuck this way.

Managed Agents and Claude Code sessions now replace an errored Mac
without a node instead of answering `sandbox_recovery_required`, as Amp
Orbs already did. The row stays as the failure's record, and `failed`
sandbox events now keep the error, node and template so the failure
outlives the row.

Amp-Thread-ID: https://ampcode.com/threads/T-01a1fe45-0

**File**: `infra/tart-kubelet/macos-sandboxes.md` (modified, +6/-0)
```diff
@@ -198,6 +198,12 @@ its reservation. No capacity is released merely because a save was requested.
 A VM the runtime proves lost (its process gone with no checkpoint, or its VM
 missing) holds no CPU or memory and never cold-boots, so it releases its
 reservation once and stays in `error`, with its disk, until the server deletes it.
+A create that failed never ran, so the server deletes it from the host as soon
+as the create fails, or when the host next reports it in `error`, and keeps its
+row in `error` without a node. The host also deletes a create or claim still
+journaled as failed by itself; a report that no longer lists an errored VM
+clears the row's `resident`, so it stops holding CPU, memory and a slot
+(`server/lib/tuist/sandboxes/AGENTS.md`, Invariants).
 Node hello/report frames always include the resident boolean, including false
 after eviction, so the server releases its reservation after the host's fence.
 
```

**File**: `server/data-export.md` (modified, +1/-1)
```diff
@@ -657,7 +657,7 @@ Successful server pauses atomically clear the sandbox's residency. Node reports
 
 - **Sandbox uploads** (object storage: `sandbox-uploads/<account_id>/<sandbox_id>/<uuid>` in the account's storage): one object per `POST /api/accounts/:account_handle/sandboxes/:sandbox_id/uploads`, a file a client puts there through a presigned URL for a command in the sandbox to download, such as the compressed worktree files `tuist sandbox sync` sends, or one the server writes for a Tuist thread's sandbox: an uncompressed tar of a one-commit bare Git repository with a thread's repository at its base commit, which the server fetched from GitHub with the account's GitHub App installation (`Tuist.Threads.Checkout`; the server's temporary copy is removed when the upload ends). It is customer content. Its URLs expire after an hour and `Tuist.Sandboxes.Workers.DeleteUploadWorker` deletes it five minutes later, whether or not it was used. There is nothing to export: a used upload's content is in the sandbox.
 - **Sandbox commands** (Postgres `sandbox_commands`): one row per command started through `POST /api/accounts/:account_handle/sandboxes/:sandbox_id/commands`, or by a Thread run's agent tools (`Tuist.Threads.Sandbox`: a `Bash` command, a dev-server service or a terminal), keyed by UUID. A Thread command's UUID is derived from its Condukt process id (the session and tool call ids), its `command` is the agent-authored shell script, and its row is deleted when the run stops the process; a row the run never stopped, as when the run crashed or its session went away while the command was parked, follows the retention below. While such a command is parked, one Oban job per command (`oban_jobs`, worker `Tuist.Threads.ExitWatchWorker`) waits for its end; its `args` hold the sandbox, account and command ids, the Condukt session id, the signal module name, and the wake key (the tool call id). It completes once the end is delivered and is pruned with other Oban jobs. Columns: `id` (PK), `sandbox_id`, `account_id`, `command` (the customer-authored shell script, or the program and arguments quoted as one), `cwd`, `stdin` (whether stdin was kept open), `status` (`running | exited | timed_out | cancelled | lost`), `exit_code`, `deadline_at`, `finished_at`, `inserted_at`, and `updated_at`. The command's environment is never stored. Its output and stdin live only in the guest under `$HOME/.cache/tuist/commands/<id>/` as VM content and follow the sandbox VM export procedure above. Finished rows are deleted seven days after they finished, the next time a command starts in the sandbox, and rows are deleted with their sandbox or account. Export by filtering `sandbox_commands.account_id`.
-- **Sandbox lifecycle events** (ClickHouse `sandbox_events`): one row per sandbox state change, written when a sandbox is created, starts running (on boot, resume or restore), is paused, is archived, fails, or is deleted. Columns: `id` (UUIDv7), `account_id`, `sandbox_id`, `event` (`created | started | paused | archived | failed | deleted | setup`), `source` (`amp`, `claude` or `api`), the sandbox's `vcpus`, `memory_mb` and `workspace_gb` at the time, `guaranteed_cpu_milli` (the CPU it was guaranteed, in millicores; 0 on rows from before it was recorded), `boot_source` (on the `started` row of a boot: `template`, `disk_snapshot` or `archive`), `duration_ms` (how long that boot took, or how long an Amp Orb's `.agents/setup` ran on a `setup` row, which the server reads from the times of the setup log in the guest, never its contents) and `inserted_at`. Rows hold no names, prompts or VM content; they feed the sandboxes dashboard's counts, session durations, setup, time to start and peak vCPU and memory charts, and the vCPU-hours and memory GiB-hours on the Usage page. They outlive the `sandboxes` row and expire after 730 days. Export by filtering `sandbox_events.account_id`.
+- **Sandbox lifecycle events** (ClickHouse `sandbox_events`): one row per sandbox state change, written when a sandbox is created, starts running (on boot, resume or restore), is paused, is archived, fails, or is deleted. Columns: `id` (UUIDv7), `account_id`, `sandbox_id`, `event` (`created | started | paused | archived | failed | deleted | setup`), `source` (`amp`, `claude` or `api`), the sandbox's `vcpus`, `memory_mb` and `workspace_gb` at the time, `guaranteed_cpu_milli` (the CPU it was guaranteed, in millicores; 0 on rows from before it was recorded), `boot_source` (on the `started` row of a boot: `template`, `disk_snapshot` or `archive`), `duration_ms` (how long that boot took, or how long an Amp Orb's `.agents/setup` ran on a `setup` row, which the server reads from the times of the setup log in the guest, never its contents), on a `failed` row what the sandbox failed with (`error_message`, the server's or the node's error text, such as a guest provisioning command's exit status; empty on other rows and on rows from before it was recorded), the cluster `node_name` it
```

**File**: `server/lib/tuist/sandboxes.ex` (modified, +105/-7)
```diff
@@ -616,6 +616,8 @@ defmodule Tuist.Sandboxes do
   crashes in the analytics. Its row is still kept in `error` like any failed
   create, since callers such as Amp Orbs and threads replace it on their
   next attempt, and `Tuist.Runners.MacosSandboxWarmPools` counts it as demand.
+  A macOS create that fails otherwise is deleted from its host at once and
+  keeps its row the same way, without a node (`release_failed_create/1`).
   """
   def create_sandbox(%Account{id: account_id}, attrs \\ %{}, opts \\ []) when is_map(attrs) do
     attrs = Map.drop(attrs, [:purpose, "purpose"])
@@ -760,13 +762,66 @@ defmodule Tuist.Sandboxes do
 
         {:error, :no_capacity}
 
+      # Reloaded for the node placement recorded, which the `failed` event
+      # keeps with the error.
       {:error, reason} ->
         Logger.warning("sandboxes: sandbox creation failed", sandbox_id: sandbox.id, reason: inspect(reason))
-        {:ok, _} = update_sandbox(sandbox, %{state: :error, hostname: hostname, error_message: error_message(reason)})
+
+        {:ok, failed} =
+          sandbox
+          |> Repo.reload!()
+          |> update_sandbox(%{state: :error, hostname: hostname, error_message: error_message(reason)})
+
+        release_failed_create(failed)
         {:error, reason}
     end
   end
 
+  # A macOS create that failed never ran, so nothing on its host is worth
+  # keeping, while its reservation (CPU, memory and a VM slot while
+  # `resident`, its disk while the host lists it) refuses every create
+  # after it. Its host deletes the VM at once and the row keeps no node:
+  # an `error` row without one holds nothing, and Amp Orbs, Claude Code
+  # sessions and Managed Agents sessions replace it with a fresh create.
+  # The row stays as the failure's record, with its error, shape, template
+  # and account, until a retry or the retention removes it; its `failed`
+  # event also names the host. A host that cannot delete it now does it
+  # when it reports the sandbox (`reconcile_reported/3`).
+  defp release_failed_create(
+         %Sandbox{platform: :darwin, state: :error, last_active_at: nil, node_name: node_name} = sandbox
+       )
+       when is_binary(node_name) do
+    case node_call(sandbox, "delete", %{sandbox_id: sandbox.id}, []) do
+      {:ok, _data} ->
+        Logger.info("sandboxes: deleted a failed macOS create from its host", sandbox_id: sandbox.id, node: node_name)
+        release_failed_row(sandbox)
+
+      {:error, reason} ->
+        Logger.warning("sandboxes: failed to delete a failed macOS create from its host",
+          sandbox_id: sandbox.id,
+          node: node_name,
+          reason: inspect(reason)
+        )
+    end
+
+    :ok
+  end
+
+  defp release_failed_create(_sandbox), do: :ok
+
+  # `updated_at` stays the failure's time, which the retention counts from.
+  defp release_failed_row(%Sandbox{} = sandbox) do
+    Repo.update_all(
+      from(s in Sandbox,
+        where:
+          s.id == ^sandbox.id and s.state == :error and s.node_name == ^sandbox.node_name and is_nil(s.last_active_at)
+      ),
+      set: [node_name: nil, node_uid: nil, resident: false]
+    )
+
+    :ok
+  end
+
   # Places and boots the sandbox, placing it again every few seconds while
   # every node refuses it for room, until `deadline`. A refused placement
   # holds no node (a refusing macOS host is released before the next is
@@ -2150,7 +2205,8 @@ defmodule Tuist.Sandboxes do
             inc: [residency_epoch: 1]
           )
 
-        if released == 1 and sandbox.state != :error, do: Events.record(sandbox, "failed")
+        if released == 1 and sandbox.state != :error,
+          do: Events.record(sandbox, "failed", %{error_message: "node left the cluster"})
       end
     end)
   end
@@ -2178,9 +2234,41 @@ defmodule Tuist.Sandboxes do
       end
     end)
 
-    :ok
+    release_unlisted_macos_errors(node_name, reported_ids, generation, settled_before)
+  end
+
+  # An errored macOS VM its host no longer lists holds nothing there: the
+  # host deleted it (it deletes a create that did not finish by itself) or
+  # lost it. `resident` is only cleared by an error report, which such a
+  # host never sends, so it is cleared here, and a failed create that never
+  # ran also gives up its node, as `release_failed_create/1` does.
+  defp release_unlisted_macos_errors(node_name, reported_ids, generation, settled_before) when is_binary(generation) do
+    Sandbox
+    |> where(node_name: ^node_name, node_uid: ^generation, platform: :darwin, state: :error)
+    |> where(
+      [s],
+      s.id not in ^reported_ids and s.updated_at < ^settled_before and (s.resident or is_nil(s.last_active_at))
+    )
+    |> Repo.all()
+    |> Enum.each(fn sandbox ->
+      Logger.info("sandboxes: releasing an errored macOS sandbox its host no longer lists",
+        sandbox_id: sandbox.id,
+        node: node_name
+      )
+
+      if is_nil(sandbox.last_active_at) do
+        release_failed_row(sandbox)
+    
```

**File**: `server/lib/tuist/sandboxes/AGENTS.md` (modified, +22/-1)
```diff
@@ -571,7 +571,8 @@ See [the rollout and recovery contract](../../../../infra/sandbox-image/remote-e
   is paused.
 - `Tuist.Sandboxes.Workers.RetentionWorker`: daily cron (shared crons in
   `Tuist.Oban.RuntimeConfig`) that deletes sandboxes paused, or errored,
-  for longer than 14 days (both still hold their disk), falling back to
+  for longer than 14 days (both may still hold their disk; a failed macOS
+  create no longer does, see Invariants), falling back to
   the row's last update when the node paused the sandbox without the
   server recording `paused_at`.
 - Idle pauses: a create, a resume or an exec that leaves a sandbox
@@ -675,6 +676,26 @@ socket, the poller and the caller share a replica:
   `failed` for a row that had started running and drops its
   `loading_since`. An error report from a node the row is not on is a
   stale copy: only that node's jail is deleted, never the row changed.
+- A failed macOS create holds nothing. It never ran (`last_active_at` is
+  nil), so `boot/5` deletes it from its host at once and the row keeps
+  `error` and its `error_message` with no node, `node_uid` or `resident`:
+  the form a create refused for room has, which Amp Orbs, Claude Code
+  sessions, Managed Agents sessions (`Router.find_or_create_sandbox/3`,
+  `MacosCapacity.admission/2`) replace with a fresh create, while a placed
+  errored Mac still answers `:sandbox_recovery_required`. A host that
+  cannot delete it then does when it next reports it in `error`. A report
+  that no longer lists an errored macOS row clears its `resident` (only an
+  error report did, and a host lists none for a VM it deleted, so the row
+  held CPU, memory and a slot for the 14-day retention) and releases a
+  failed create's node. In production (2026-11-21) such rows, resident
+  ones and ones on the disk budget of hosts that still listed them,
+  refused every macOS create on a whole rack. We kept
+  the row rather than deleting it: it is the failure's record, the API,
+  the dashboard and `Tuist.Runners.MacosSandboxWarmPools` (refused and
+  failed creates are demand) read it, and the retention removes it like
+  any errored row, counting from the failure. Every `failed` event keeps
+  the error, node and template (`Events.record/3`), so the failure
+  outlives the row when a retry, a delete or the retention removes it.
 - A node that left the cluster never reports again. Every minute
   `ReleaseRemovedNodesWorker` (`Sandboxes.release_removed_nodes/0`) errors
   the Linux agent rows of a node that is not connected and whose Kubernetes
```

**File**: `server/lib/tuist/sandboxes/claude_code_runners.ex` (modified, +2/-1)
```diff
@@ -56,7 +56,8 @@ defmodule Tuist.Sandboxes.ClaudeCodeRunners do
           %Sandbox{residency_work_id: work_id} when is_binary(work_id) ->
             {:ok, :running}
 
-          %Sandbox{platform: :darwin, state: :error} ->
+          # As in `Router.find_or_create_sandbox/3`: only a placed one.
+          %Sandbox{platform: :darwin, state: :error, node_name: node_name} when is_binary(node_name) ->
             {:error, :sandbox_recovery_required}
 
           _sandbox ->
```

**File**: `server/lib/tuist/sandboxes/events.ex` (modified, +9/-1)
```diff
@@ -17,9 +17,14 @@ defmodule Tuist.Sandboxes.Events do
   @doc """
   Records `event` for the sandbox now. `:boot_source` and `:duration_ms`
   describe a boot on its `started` event, and `:inserted_at` dates an event
-  that happened before it was observed.
+  that happened before it was observed. A `failed` row also keeps what the
+  sandbox failed with (the row's `error_message`, or `:error_message`), its
+  node and its template, so the failure outlives the row, which a caller's
+  retry or a delete removes.
   """
   def record(%Sandbox{} = sandbox, event, extra \\ %{}) when event in @events do
+    failed? = event == "failed"
+
     SandboxEvent.Buffer.insert(%{
       id: UUIDv7.generate(),
       account_id: sandbox.account_id,
@@ -32,6 +37,9 @@ defmodule Tuist.Sandboxes.Events do
       boot_source: Map.get(extra, :boot_source, ""),
       duration_ms: Map.get(extra, :duration_ms, 0),
       guaranteed_cpu_milli: Sandbox.guaranteed_cpu_milli(sandbox),
+      error_message: (failed? && Map.get(extra, :error_message, sandbox.error_message)) || "",
+      node_name: (failed? && sandbox.node_name) || "",
+      template: (failed? && sandbox.template) || "",
       inserted_at: Map.get_lazy(extra, :inserted_at, &NaiveDateTime.utc_now/0)
     })
 
```

**File**: `server/lib/tuist/sandboxes/macos_capacity.ex` (modified, +4/-2)
```diff
@@ -136,10 +136,12 @@ defmodule Tuist.Sandboxes.MacosCapacity do
       %Sandbox{state: :archived} = sandbox ->
         with :ok <- quota(sandbox), do: placement(environment)
 
-      %Sandbox{} = sandbox ->
+      %Sandbox{state: state, node_name: node_name} = sandbox when state != :error or is_binary(node_name) ->
         with :ok <- quota(sandbox), do: host_admission(sandbox)
 
-      nil ->
+      # Nothing, or an errored one without a node, which is replaced
+      # (`Router.find_or_create_sandbox/3`).
+      _new ->
         with :ok <- Capacity.quota(environment.account_id, environment), do: placement(environment)
     end
   end
```

**File**: `server/lib/tuist/sandboxes/router.ex` (modified, +4/-1)
```diff
@@ -212,7 +212,10 @@ defmodule Tuist.Sandboxes.Router do
       %Sandbox{state: state} = sandbox when state in [:running, :paused, :creating, :resuming, :archived] ->
         {:ok, sandbox, false}
 
-      %Sandbox{platform: :darwin, state: :error} ->
+      # A placed macOS sandbox keeps its disk for recovery. One without a
+      # node (a create refused for room, or a failed create whose host
+      # deleted it) holds nothing and is replaced below.
+      %Sandbox{platform: :darwin, state: :error, node_name: node_name} when is_binary(node_name) ->
         {:error, :sandbox_recovery_required}
 
       # A sandbox that died or was deleted from under us cannot be
```

---

### Incident Patch 2: `cb5add2b` (2026-11-22)
**Commit Message**: fix(infra): roll rack edges one at a time for real

The rack-edge DaemonSet rolls one edge at a time, each held 90 s, but the
ConfigMap its installers read is updated in place: the kubelet refreshes it
in every installer pod, the old ones too, within a minute of helm changing
it. Each old installer then copied the new static pod manifest onto its
node, so every edge restarted at once, and an edge whose turn had not come
lost its static pod until its new installer created the configuration
directory the manifest names.

On 2026-11-21 that restarted both of larch's edges within a second at
08:46:39, and larch-edge-a ran no static pod until 08:50:51; its new
installer, at 08:49, found the manifest already installed.

An installer now installs only when the ConfigMap's static pod carries the
hash it was rolled out with. The static pod and the edge files render
unchanged, so this deploy restarts no edge.

Amp-Thread-ID: https://ampcode.com/threads/T-01a1feb4-81b2-742b-9e6b-66fc025745b3
Co-authored-by: Marek Fort <[REDACTED_EMAIL]>

**File**: `infra/helm/rack-edge/templates/daemonset.yaml` (modified, +10/-1)
```diff
@@ -88,7 +88,16 @@ spec:
                 fi
               }
               while :; do
-                install
+                # Only the configuration this pod was rolled out with. The
+                # kubelet refreshes the mounted ConfigMap in every installer
+                # as soon as helm changes it, the old ones too, so without
+                # this each edge's old installer put the new static pod in
+                # at once (2026-11-21: both of larch's edges within a second,
+                # edge-a's static pod then gone four minutes for want of its
+                # configuration directory), and minReadySeconds held nothing back.
+                if grep -qF "tuist.dev/rack-edge-hash: \"$RACK_EDGE_HASH\"" /config/rack-edge.yaml; then
+                  install
+                fi
                 if [ "$(cat /host/run/rack-edge/started 2>/dev/null)" = "$RACK_EDGE_HASH" ]; then
                   for d in /host/etc/rack-edge/*; do
                     case "$d" in
```

---

### Incident Patch 3: `bcb31a38` (2026-11-22)
**Commit Message**: fix(server): carry targets skipped by hash across tracked-file changes

A commit that changed a tracked file (Package.resolved, a manifest, an
xcconfig, a test plan) carried no coverage at all, and a target skipped by
its selective-testing hash was refused at later commits whenever its source
predated such a change. A branch that tests selectively therefore stayed
partial after every dependency bump until a full run measured it again.

The hash covers the target's whole graph, its dependencies' revisions and
the compiler version, and selective testing already trusts it to skip the
target, so coverage now trusts it the same way: a target skipped by hash
carries from its source whatever tracked files changed. Tests carried one by
one keep the full tracked-file check, and on a commit that changed a tracked
file they are gaps without their evidence being read.

Amp-Thread-ID: https://ampcode.com/threads/T-01a1ef10-0711-724d-a8e9-08ca9104cead
Co-authored-by: Eduardo Nunes <[REDACTED_EMAIL]>

**File**: `server/docs/code-coverage.md` (modified, +3/-3)
```diff
@@ -87,10 +87,10 @@ A commit's figure is folded again whenever more of its data lands: another run,
 1. **Store and merge.** Each report is stored per run and shard (`coverage_run_files`, `coverage_runs`), each file's version (blob, executable lines, functions) once a week (`coverage_file_layouts`). The fold merges every clean run of the commit: a line is covered when any run covered it, and a file counts once however many schemes compiled it.
 2. **Find what was skipped.** Only runs set up to collect coverage are read (`coverage_enabled` isn't `false`). What they skipped is the targets selective testing hit, with their hashes; the tests the runs' skip identifiers name (`--skip-test-targets`, `-skip-testing`, but not quarantine: see [What was skipped](#what-was-skipped)); the tests their coverage-based test selection skipped, which the client leaves out without naming; and whether the caller narrowed a scheme's runs (`only_test_identifiers`). A target a run of the same scheme executed, or a named test any run executed, among the runs that measured the commit, is dropped first, before anything below is decided, so it is never carried nor a gap (`tracked_file_changed`, `test_list_changed`, `target_without_history`); a target counts only when that run's `-only-testing` doesn't name it, and a `Module` or `Module/Suite` identifier only when none of that run's identifiers name the target. A skipped target's tests come from the run recorded under its hash (`coverage_target_sources`), whatever branch it ran on, since the same hash means the same tests. Otherwise they come from the commit's **baseline**: a baseline run of the scheme that skipped the target, or, when none of those ran it, another scheme's baseline run that did, as long as none of the target's test files changed since the baseline and none was added beside them. If one did, the target is a gap (`test_list_changed`). Without both commits' listings, the baseline's tests are taken as they were. If the baseline didn't run the target, it's `target_without_history`. An identifier naming a test (`Module/Suite/test`) resolves to that test directly. Tests that ran at the commit anyway aren't skipped. See [What was skipped](#what-was-skipped).
 3. **Measured?** If nothing was skipped, no scheme was narrowed, and no run reused uninstrumented code (`uninstrumented_code`), the figure is `measured` and the fold stops here. `Commits` then makes a `measured` figure `partial` when every run of one of its schemes is partial, for example a run still missing a shard with no complete run of the scheme beside it.
-4. **Tracked files changed?** If the commit's tracked files differ from every parent's, nothing is carried. They're the project's build system's build inputs (`Tuist.GitHistory` `tracked_file_globs`): Xcode's are `Package.resolved`, `Project.swift`, `*.xcconfig` and the like, Mix's are `mix.exs`, `mix.lock` and `config/**` (see [Mix](#mix)), Cargo's are `Cargo.toml`, `Cargo.lock` and `build.rs` (see [Cargo](#cargo)), and a build system without its own list uses Xcode's. Another toolchain's build files in the same repository aren't tracked. Every earlier run's evidence predates the change, so the figure is `partial` (`tracked_file_changed`) and no evidence is read. In the code this check runs right after step 2 drops what another run executed, before any skipped target's tests are looked up: when anything is left, none of it is resolved, so such a commit reports no skipped tests (`skipped_tests_count` 0). A merge whose tracked files match one parent's still carries from that side. A commit with no repository or no ancestor carries nothing either (`no_ancestor`).
+4. **Tracked files changed?** If the commit's tracked files differ from every parent's, nothing is carried. They're the project's build system's build inputs (`Tuist.GitHistory` `tracked_file_globs`): Xcode's are `Package.resolved`, `Project.swift`, `*.xcconfig` and the like, Mix's are `mix.exs`, `mix.lock` and `config/**` (see [Mix](#mix)), Cargo's are `Cargo.toml`, `Cargo.lock` and `build.rs` (see [Cargo](#cargo)), and a build system without its own list uses Xcode's. Another toolchain's build files in the same repository aren't tracked. Every earlier run's evidence predates the change, so the figure is `partial` (`tracked_file_changed`) and no evidence is read. In the code this check runs right after step 2 drops what another run executed, before any skipped target's tests are looked up: when anything is left, none of it is resolved, so such a commit reports no skipped tests (`skipped_tests_count` 0). The exception is a target skipped by its selective-testing hash, which is trusted for every build input: when the commit skipped targets by hash, the skipped tests are resolved, those targets go on to step 5, and every other skipped test is a `tracked_file_changed` gap without its evidence being read. A merge whose tracked files match one parent's still carries from that side. A commit with no repository 
```

**File**: `server/docs/coverage-test-selection.md` (modified, +1/-1)
```diff
@@ -122,7 +122,7 @@ Each candidate map (`Tuist.TestImpactAnalysis.Candidate`) gives each test the re
 
 The baseline isn't a rule: it's resolved first, and a run without one records the reason there's none. `diff_too_large` isn't a rule either: `Runs` checks the count before reading any map.
 
-**Tracked files are the coverage carry list.** The check reads the setting coverage carry already stops at, so a test selection skips gets carried coverage, and a commit where carry stops makes selection fall back. A narrower list would skip tests whose coverage then shows as unknown; a wider one would fall back for no reason. The list is the project's build system's (`GitHistory.settings/1` picks it by `build_system`, with no per-project override), so a monorepo commit that only touches another toolchain's build files doesn't make selection fall back. Xcode's is under [Rule inputs on Xcode](#rule-inputs-on-xcode).
+**Tracked files are the coverage carry list.** The check reads the setting coverage carry already stops at, so a test selection skips gets carried coverage, and a commit where carry stops makes selection fall back. A narrower list would skip tests whose coverage then shows as unknown; a wider one would fall back for no reason. The list is the project's build system's (`GitHistory.settings/1` picks it by `build_system`, with no per-project override), so a monorepo commit that only touches another toolchain's build files doesn't make selection fall back. Carry doesn't stop at them for a target skipped by its hash, which it trusts for every build input ([Code coverage](code-coverage.md#the-pipeline), step 5), so a fallback's modules that hashing skipped still carry. Xcode's is under [Rule inputs on Xcode](#rule-inputs-on-xcode).
 
 **`affected_modules` come from the client's graph.** For each changed file the client lists the test modules that depend, directly or not, on the module that owns it. An empty list means no module owns the file (a README, CI configuration); absent (`nil`) means the graph can't attribute it to one module, and such files belong on the tracked list instead.
 
```

**File**: `server/lib/tuist/test_impact_analysis/carry.ex` (modified, +30/-13)
```diff
@@ -28,8 +28,9 @@ defmodule Tuist.TestImpactAnalysis.Carry do
   that overlay when its files are unchanged since that run.
 
   Both keep `Reported`'s guards: the test passed there, the tracked files
-  are the same (`context.validity`), and the evidence holds lines for every
-  file that counts.
+  are the same (`context.validity`; a module carried by hash isn't checked,
+  since the hash covers its build inputs), and the evidence holds lines for
+  every file that counts.
   """
   import Ecto.Query
 
@@ -57,8 +58,9 @@ defmodule Tuist.TestImpactAnalysis.Carry do
   `Tuist.Tests.Coverage.ExcludedPaths` pattern), `blobs` (the blob of every
   file the commit's runs reported), `run_blobs` and `blobs_now`, functions
   from run ids to the blobs those runs reported and from paths to their
-  blobs at the commit, and `validity`, a function from a commit to `:ok` or
-  why its evidence doesn't hold here.
+  blobs at the commit, `validity`, a function from a commit to `:ok` or
+  why its evidence doesn't hold here, and `only_hashed`, true when the commit's own tracked-file change leaves only
+  modules carried by their hash to carry.
   """
   def units(%{repository_id: repository_id}, _skipped) when repository_id in [nil, 0], do: {[], %{}}
 
@@ -68,7 +70,7 @@ defmodule Tuist.TestImpactAnalysis.Carry do
     {target_units, target_reasons} = in_hits |> Enum.group_by(& &1.module_name) |> target_units(context, hashes)
     carried_modules = MapSet.new(target_units, & &1.module)
     rest = others ++ Enum.reject(in_hits, &MapSet.member?(carried_modules, &1.module_name))
-    {test_units, test_reasons} = test_units(rest, context)
+    {test_units, test_reasons} = test_units(rest, context, target_reasons)
     {target_units ++ test_units, Map.merge(target_reasons, test_reasons)}
   end
 
@@ -275,7 +277,8 @@ defmodule Tuist.TestImpactAnalysis.Carry do
 
     failed = failed_modules(context.project.id, units)
     {failing, units} = Enum.split_with(units, &MapSet.member?(failed, {&1.snapshot_id, &1.module}))
-    {kept, reasons} = guard(units, context)
+    # The hash is trusted for every build input, so no tracked file is compared.
+    {kept, reasons} = guard(units, context, fn _sha -> :ok end)
     {kept, Map.merge(Map.new(failing, &{&1.key, :test_failed}), reasons)}
   end
 
@@ -357,9 +360,22 @@ defmodule Tuist.TestImpactAnalysis.Carry do
 
   # Tests
 
-  defp test_units([], _context), do: {[], %{}}
+  defp test_units([], _context, _target_reasons), do: {[], %{}}
+
+  # The commit changed a tracked file and only targets skipped by their hash
+  # carry: every test's evidence predates the change, so none is read, and a test is a gap
+  # for its target's reason, or for the change.
+  defp test_units(tests, %{only_hashed: true}, target_reasons) do
+    {[],
+     for(
+       test <- tests,
+       !Map.has_key?(target_reasons, {:module, test.module_name}),
+       into: %{},
+       do: {test.test_case_id, :tracked_file_changed}
+     )}
+  end
 
-  defp test_units(tests, context) do
+  defp test_units(tests, context, _target_reasons) do
     baseline = baseline_results(tests, context)
     from_overlays = baseline |> Enum.reject(&match?({_test, {{:ok, _unit}, _ran_at}}, &1)) |> overlay_results(context)
 
@@ -372,7 +388,7 @@ defmodule Tuist.TestImpactAnalysis.Carry do
         end
       end)
 
-    {kept, guard_reasons} = guard(units, context)
+    {kept, guard_reasons} = guard(units, context, context.validity)
     {kept, Map.merge(reasons, guard_reasons)}
   end
 
@@ -572,11 +588,12 @@ defmodule Tuist.TestImpactAnalysis.Carry do
   end
 
   # The units whose source still applies: its tracked files are the same as
-  # the commit's, and its evidence holds lines for every file that counts.
-  defp guard([], _context), do: {[], %{}}
+  # the commit's as far as `validity` compares them, and its evidence holds
+  # lines for every file that counts.
+  defp guard([], _context, _validity), do: {[], %{}}
 
-  defp guard(units, context) do
-    validity = units |> Enum.map(& &1.source.sha) |> Enum.uniq() |> Map.new(&{&1, context.validity.(&1)})
+  defp guard(units, context, validity) do
+    validity = units |> Enum.map(& &1.source.sha) |> Enum.uniq() |> Map.new(&{&1, validity.(&1)})
     unlined = unlined(context, units)
 
     Enum.reduce(units, {[], %{}}, fn unit, {kept, reasons} ->
```

**File**: `server/lib/tuist/tests/coverage/reported.ex` (modified, +41/-19)
```diff
@@ -39,9 +39,11 @@ defmodule Tuist.Tests.Coverage.Reported do
   processes' lines in the snapshot of the run that hashed the target the
   same way the commit's run did: the same inputs, so the same tests over
   the same code. The guards above apply to it as to a test, but for the
-  blobs, which the hash covers. It needs no observer scope per test, so it
-  covers Swift Testing without the attribution trait and tests that ran in
-  parallel.
+  blobs and the tracked files: the hash is trusted for every build input,
+  so a commit that changes a tracked file still carries its targets skipped
+  by hash, and nothing else.
+  It needs no observer scope per test, so it covers Swift Testing without
+  the attribution trait and tests that ran in parallel.
 
   A skipped test that fails any of these is a **gap**: nothing is carried for
   it and the figure is a lower bound, which `kind` says (`partial`), and
@@ -199,7 +201,8 @@ defmodule Tuist.Tests.Coverage.Reported do
       blobs: run_blobs(project.id, run_ids),
       excluded: ExcludedPaths.compile(excluded),
       baseline: skipping.baseline,
-      impact_run_ids: skipping.impact_run_ids
+      impact_run_ids: skipping.impact_run_ids,
+      only_hashed: Map.get(skipping, :only_hashed, false)
     }
 
     {units, reasons, plan} = carry_units(context, skipped)
@@ -238,18 +241,28 @@ defmodule Tuist.Tests.Coverage.Reported do
     {units, reasons, Carry.plan(units)}
   end
 
-  # A commit whose tracked files differ from every parent's carries nothing:
-  # every ancestor's evidence predates the change, so it is decided before
-  # any of it is read. Only an ancestor from before a change this commit
-  # undoes would still qualify, which is not worth carrying for. A merge
-  # whose tracked files match one parent's can still carry from that side.
-  # Without the listings, each source is checked as usual.
-  defp changes_tracked_files?(%{repository_id: repository_id}) when repository_id in [nil, 0], do: false
-
-  defp changes_tracked_files?(context) do
+  # Which of the skipped tests a commit's own tracked-file change leaves
+  # carriable: `:all` when its tracked files match some parent's, and
+  # otherwise `:hashed` when targets were skipped by their hash, which is
+  # trusted for every build input, or `:none`. Every ancestor's evidence
+  # predates such a change, so it is decided before any of it is read. Only
+  # an ancestor from before a change this commit undoes would still qualify,
+  # which is not worth carrying for. A merge whose tracked files match one
+  # parent's can still carry from that side. Without the listings, each
+  # source is checked as usual.
+  defp carriable(%{repository_id: repository_id}, _hits) when repository_id in [nil, 0], do: :all
+
+  defp carriable(context, hits) do
     case GitHistory.parents(context.repository_id, context.sha) do
-      [] -> false
-      parents -> Enum.all?(parents, &(validity(context, &1) == :tracked_file_changed))
+      [] ->
+        :all
+
+      parents ->
+        cond do
+          not Enum.all?(parents, &(validity(context, &1) == :tracked_file_changed)) -> :all
+          hits != [] -> :hashed
+          true -> :none
+        end
     end
   end
 
@@ -502,10 +515,19 @@ defmodule Tuist.Tests.Coverage.Reported do
   defp tuist_skipped(_context, {_runs, [], [], _clean}, []), do: %{skipped: [], gaps: [], baseline: [], indexed: %{}}
 
   defp tuist_skipped(%{project: project, repository_id: repository_id, sha: sha} = context, runs, impact_skipped) do
-    # A commit that changes a tracked file carries nothing.
-    if changes_tracked_files?(context),
-      do: %{skipped: [], gaps: [:tracked_file_changed], baseline: [], indexed: %{}},
-      else: skipped_tests(project, repository_id, sha, runs, impact_skipped)
+    {_runs, hits, _skips, _clean} = runs
+
+    # A commit that changes a tracked file carries nothing, but for the
+    # targets skipped by their hash.
+    case carriable(context, hits) do
+      :none ->
+        %{skipped: [], gaps: [:tracked_file_changed], baseline: [], indexed: %{}}
+
+      carriable ->
+        project
+        |> skipped_tests(repository_id, sha, runs, impact_skipped)
+        |> Map.put(:only_hashed, carriable == :hashed)
+    end
   end
 
   defp skipped_tests(_project, repository_id, _sha, _runs, _impact_skipped) when repository_id in [nil, 0],
```

**File**: `server/test/tuist/tests/coverage/reported_test.exs` (modified, +59/-0)
```diff
@@ -1511,6 +1511,65 @@ defmodule Tuist.Tests.Coverage.ReportedTest do
     end
   end
 
+  # A target's selective-testing hash is trusted for every build input, so a
+  # tracked-file change never stops carrying a target skipped by its hash.
+  test "carries a target skipped by hash across a commit that changes any tracked file", %{
+    project: project,
+    account: account
+  } do
+    track_default_files()
+    target_only_runs(project, account)
+    sources = Map.new(["Sources/Math.swift", "Sources/Text.swift", "Tests/AppTests.swift"], &{&1, "blob-" <> &1})
+
+    for input <- ["Package.resolved", "App.xcodeproj/project.pbxproj", "App.xctestplan", "Podfile.lock"] do
+      record_build_inputs(account, Map.put(sources, input, "one"), Map.put(sources, input, "two"))
+
+      assert %{kind: "reported", skipped_tests_count: 1, carried_tests_count: 1} =
+               reported = Reported.compute(project, "head")
+
+      assert reasons(reported) == []
+    end
+  end
+
+  test "carries a target skipped by hash from a source that predates a build-input change its hash covers", %{
+    project: project,
+    account: account
+  } do
+    track_default_files()
+    target_only_runs(project, account, head: :none)
+
+    CoverageFixtures.seed_history(account, [
+      CoverageFixtures.commit("bump", ["base"], 2),
+      CoverageFixtures.commit("tip", ["bump"], 3)
+    ])
+
+    tip =
+      CoverageFixtures.run_with_coverage(project, account, head_files(), %{
+        git_commit_sha: "tip",
+        partial: true,
+        test_modules: modules([test_case("testAdd()", "MathTests")])
+      })
+
+    selective_testing(project, tip, [{"AppTests", :miss, "app-changed"}, {"TextKitTests", :local, "text"}])
+
+    repository_id = CoverageFixtures.repository_id(account)
+    sources = Enum.map(["Sources/Math.swift", "Sources/Text.swift", "Tests/AppTests.swift"], &{&1, "blob-" <> &1})
+
+    for {sha, resolved} <- [{"base", "one"}, {"bump", "two"}, {"tip", "two"}] do
+      listing =
+        Enum.map([{"Package.resolved", resolved} | sources], fn {path, blob} ->
+          %{path: path, git_blob_id: blob, mode: 0o100644}
+        end)
+
+      GitHistory.record_listing(repository_id, sha, listing, files_count: length(listing))
+    end
+
+    assert %{kind: "reported", carried_tests_count: 1, carried_from: ["base"]} =
+             reported = Reported.compute(project, "tip")
+
+    assert reasons(reported) == []
+  end
+
   defp record_build_inputs(account, base, head) do
     repository_id = CoverageFixtures.repository_id(account)
 
```

#### Recent Merged Pull Requests:
- **PR #15805** (2026-11-19): docs(handbook): manage the Tuist Digest in Atlas (@pepicrft)
- **PR #15803** (closed): feat(infra): move larch-edge-a's BMC to larch-tor-b port 21 (@fortmarek)
- **PR #15797** (closed): perf(kura): sub-millisecond TTFB buckets and batched BatchReadBlobs lookups (@pepicrft)
- **PR #15796** (2026-11-19): docs(handbook): send production errors to the self-hosted ingest (@pepicrft)
- **PR #15794** (2026-11-19): docs(handbook): describe self-managed ClickHouse in the shared responsibility model (@pepicrft)
- **PR #15793** (closed): docs(atlas): pin the patched ingress-nginx images in the onboarding runbook (@esnunes)

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

## X. server): stop failed macOS sandbox creates from holding their host

**RULE**:
When implementing operations in `infra/tart-kubelet/macos-sandboxes.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tuist/tuist. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `9c6c3a84`: server): stop failed macOS sandbox creates from holding their host. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Elixir data structures, boundary deserialization, API parsing, or resource lifecycles matching `infra/tart-kubelet/macos-sandboxes.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```elixir
// Verified production-grade fix pattern:
A create that failed never ran, so the server deletes it from the host as soon
as the create fails, or when the host next reports it in `error`, and keeps its
row in `error` without a node. The host also deletes a create or claim still
journaled as failed by itself; a report that no longer lists an errored VM
clears the row's `resident`, so it stops holding CPU, memory and a slot
(`server/lib/tuist/sandboxes/AGENTS.md`, Invariants).
```

**NEGATIVE CONSTRAINT**:
```elixir
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `9c6c3a84` are properly handled with clean fallback behavior.


## 3. Decision Protocol & Boundary Restrictions
- Must NOT delete canonical verification records without authorization.
- Must execute independent read-back verification after every mutation.
