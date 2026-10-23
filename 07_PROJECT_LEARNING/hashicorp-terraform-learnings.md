> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/hashicorp-terraform-learnings.md`  
> **Source**: github ([https://github.com/hashicorp/terraform](https://github.com/hashicorp/terraform))  
> **Source Version**: `cdbff3ee`  
> **License**: NOASSERTION  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-23T07:39:25.452Z  
> **Learning ID**: `learn-github-hashicorp-terraform`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): hashicorp/terraform

---

## 1. Executive Forensic Architecture & System Mechanics

Terraform is a deterministic infrastructure-as-code state synchronization engine written in Go. Its core problem space is resolving the graph difference between a declared declarative target state (expressed in HashiCorp Configuration Language, HCL), a recorded historical snapshot state (`terraform.tfstate`), and the actual real-world control-plane infrastructure state via out-of-process provider plugins.

```
                    +------------------------------------+
                    |        Configuration (HCL)         |
                    +-----------------+------------------+
                                      |
                                      v
                    +------------------------------------+
                    |          Graph Builder             |
                    |     (DAG Node Expansion & Walk)    |
                    +-----------------+------------------+
                                      |
         +----------------------------+----------------------------+
         |                                                         |
         v                                                         v
+------------------+                                      +------------------+
| Dynamic Schema   |                                      | Out-of-Process   |
| Engine & Marks   |                                      | RPC Providers    |
| (Deprecations,   |                                      | (go-plugin via   |
| Sensitive, etc.) |                                      | gRPC over IPC)   |
+--------+---------+                                      +--------+---------+
         |                                                         |
         +----------------------------+----------------------------+
                                      |
                                      v
                    +------------------------------------+
                    |           State Machine            |
                    |    (statemgr.Full / statemgr.Lock) |
                    +-----------------+------------------+
                                      |
             +------------------------+------------------------+
             |                                                 |
             v                                                 v
+--------------------------+                     +---------------------------+
| Local Backend            |                     | Remote Backends           |
| (StateHook, In-Memory,   |                     | (Azure Blob, Consul KV,   |
| NonAtomicWriteWithBackup)|                     | S3, GCS - Leases & Chunks)|
+--------------------------+                     +---------------------------+
```

### Architectural Subsystems and Boundaries
1. **The Graph Execution & Evaluation Core (`internal/terraform`)**: Represents infrastructure components as nodes in a Directed Acyclic Graph (DAG). Dependency links enforce strict partial ordering for creation, updates, and destruction. Node traversal uses parallel worker goroutines constrained by an evaluation lock tree.
2. **State Management Subsystem (`internal/states`, `internal/states/statemgr`, `internal/states/remote`)**: Decouples the state data model (`*states.State`) from backend storage drivers (`statemgr.Full`, `statemgr.Persister`, `statemgr.Writer`). It provides distributed pessimistic locking mechanisms (`LockInfo`) and transactional atomic commit protocols (`PersistState`, `RefreshState`).
3. **Pluggable Remote Storage Gateways (`internal/backend/remote-state/*`)**: Implements cloud-native persistence drivers (e.g., Azure Blob via `giovanni`, Consul KV via HashiCorp Consul API). It handles remote distributed lease lifecycles, cross-process lock contention, payload chunking across consensus-bound storage barriers (such as Raft's 512KB limit), and storage-level workspace isolation via path prefixes (`env:`, `-env:`).
4. **Out-of-Process Provider IPC Subsystem (`github.com/hashicorp/go-plugin`)**: Bridges Terraform Core and provider instances across OS process boundaries via gRPC over local Unix domain sockets or Windows named pipes. Process supervisor lifecycles are decoupled from execution goroutines, requiring explicit panic interceptors to avoid orphaned zombie daemon leaks.
5. **Config & Schema Type System (`github.com/zclconf/go-cty`, `internal/configs`)**: Evaluates expressions using a strict type system enriched with runtime attribute "marks" (e.g., `Sensitive`, `Ephemeral`, `Deprecated`). Diagnostic presentation layers must strictly isolate mark processing so that unhandled security marks panic closed, while informational marks (deprecation) gracefully degrade.
6. **Filesystem Mutator (`internal/replacefile`)**: Enforces file-content replacement invariants that reconcile atomic safety with POSIX inode preservation, filesystem permissions, symlink target preservation, and backup-assisted crash recovery.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Inode-Preserving Reversible Non-Atomic Mutation
**RULE**:
When mutating user-controlled configuration or source files on disk in place, the system MUST NOT overwrite files using standard truncating APIs (`os.WriteFile`, `ioutil.WriteFile`) directly, and MUST NOT replace the file with an atomic rename (`rename(temp, target)`) if preserving file metadata (permissions, ownership, filesystem attributes, hardlinks, symlink references) is required. Instead, mutations MUST follow a three-phase backup-write-truncate protocol: create a sibling backup temporary file containing original bytes, open the original file descriptor with `O_WRONLY` (no `O_TRUNC`), write the new payload, truncate to the new byte length (`f.Truncate(n)`), and delete the backup only upon complete write-flush verification.

**WHY**:
`os.WriteFile` opens with `O_TRUNC`. If the process encounters an I/O fault, disk-quota exhaustion (`ENOSPC`), file size limit violation (`SIGXFSZ`/`ulimit -f 0`), or an unexpected panic between truncation and write, the original target file is zeroed out, resulting in catastrophic unrecoverable data loss. Conversely, `AtomicRename` breaks symlinks (replacing the symlink pointer itself with a regular file), wipes platform-specific extended attributes, and disrupts hardlink references. Non-atomic mutation with a sibling backup file guarantees both metadata stability and safe crash recovery.

**WHEN TO APPLY**:
Apply in code formatters, CLI in-place updaters, refactoring engines, linters, and state persistors modifying existing files in Unix and Windows filesystems.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
package replacefile

import (
	"fmt"
	"os"
	"path/filepath"
)

// NonAtomicWriteFileWithBackup mutates filename in-place without breaking symlinks
// or losing inode metadata, while guaranteeing full recoverability against I/O faults.
func NonAtomicWriteFileWithBackup(filename string, originalData, formattedData []byte) error {
	dir := filepath.Dir(filename)
	base := filepath.Base(filename)

	// Phase 1: Create sibling backup file containing exact original content
	backup, err := os.CreateTemp(dir, base+".bak.*")
	if err != nil {
		return fmt.Errorf("failed creating backup file for %s: %w", filename, err)
	}
	backupPath := backup.Name()

	if _, err := backup.Write(originalData); err != nil {
		_ = backup.Close()
		_ = os.Remove(backupPath)
		return fmt.Errorf("failed writing backup file %s: %w", backupPath, err)
	}
	if err := backup.Close(); err != nil {
		_ = os.Remove(backupPath)
		return fmt.Errorf("failed closing backup file %s: %w", backupPath, err)
	}

	// Phase 2: Open original target file without O_TRUNC to avoid premature zeroing
	f, err := os.OpenFile(filename, os.O_WRONLY, 0)
	if err != nil {
		_ = os.Remove(backupPath)
		return fmt.Errorf("failed opening target file %s: %w", filename, err)
	}

	n, writeErr := f.Write(formattedData)
	var truncErr error
	if writeErr == nil {
		truncErr = f.Truncate(int64(n))
	}
	closeErr := f.Close()

	// Phase 3: Error evaluation and restoration
	if writeErr != nil || truncErr != nil || closeErr != nil {
		targetErr := writeErr
		if targetErr == nil {
			targetErr = truncErr
		}
		if targetErr == nil {
			targetErr = closeErr
		}

		// Attempt rollback from the backup file
		restoreErr := os.WriteFile(filename, originalData, 0644)
		if restoreErr == nil {
			_ = os.Remove(backupPath)
			return fmt.Errorf("write failed to %s: %w (original content successfully restored)", filename, targetErr)
		}

		// If rollback fails, preserve backup for manual administrator recovery
		return fmt.Errorf("critical I/O error on %s: %w; rollback also failed: %v; backup preserved at: %s",
			filename, targetErr, restoreErr, backupPath)
	}

	// Success path: remove backup file
	_ = os.Remove(backupPath)
	return nil
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Zeroes out user files if disk is full or limits hit before Write completes.
func BuggyWriteFile(path string, result []byte) error {
    // os.WriteFile calls os.OpenFile(path, O_WRONLY|O_CREATE|O_TRUNC, perm)
    // If Write fails midway, the original data is permanently destroyed.
    return os.WriteFile(path, result, 0644)
}
```

**VERIFICATION METHOD**:
Implement an end-to-end regression harness setting file-size limits (`ulimit -f 0` or wrapping `io.Writer` with an error injector) executing against target files. Assert that on error:
1. Target file content is byte-identical to `originalData`.
2. Target file retains its initial POSIX file mode bits (`fi.Mode().Perm() == originalPerms`).
3. If the file was a symbolic link, verify `fi.Mode().Type() == os.ModeSymlink`.

---

### 2. Process Subreaper Cleanup Guarantee via Explicit Crash Exit Hooks
**RULE**:
Applications managing out-of-process subprocesses (e.g., RPC plugins, child daemons, sidecars) MUST NOT rely exclusively on deferred cleanup calls (`defer client.Cleanup()`) registered in the primary function (`main`). When handling terminal exceptions or unrecovered panics in top-level runtime crash interceptors (`PanicHandler`), the crash handler MUST explicitly invoke global child-process termination routines immediately before triggering terminal termination (`os.Exit(11)`).

**WHY**:
In Go and most compiled runtimes, `os.Exit()` bypasses the call-stack unwinder and skips all runtime `defer` blocks across all goroutines. If a background worker goroutine panics, the global panic handler executes, prints the traceback, and invokes `os.Exit()`. Any child processes spawned during execution remain alive in memory, detached and reparented to the OS init process (PID 1) or systemd subreaper. In infrastructure systems, orphaned plugin processes maintain active database connections, lock states, and consume system memory until manually killed.

**WHEN TO APPLY**:
All systems managing IPC child processes via `exec.Cmd`, gRPC subprocess pools (`go-plugin`), or sidecar executables that implement custom panic/crash handlers.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
package logging

import (
	"fmt"
	"os"
	"runtime/debug"

	"github.com/hashicorp/go-plugin"
)

// PanicHandler intercepts panics across Terraform worker pools.
func PanicHandler() {
	if r := recover(); r != nil {
		fmt.Fprintf(os.Stderr, "FATAL ERROR: Terraform Core encountered an unexpected panic:\n%v\n\n", r)
		debug.PrintStack()

		// CRITICAL INVARIANT: os.Exit skips deferred calls in main().
		// Terminate all managed IPC provider child processes before exiting
		// to avoid process reparenting and daemon leaks.
		plugin.CleanupClients()

		// Exit with designated panic crash code
		os.Exit(11)
	}
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Relying strictly on defer in main() while intercepting panics elsewhere.
func main() {
    defer plugin.CleanupClients() // NEVER runs if a panic handler catches and calls os.Exit()
    runApp()
}

func PanicHandler() {
    if r := recover(); r != nil {
        log.Printf("Crash: %v", r)
        os.Exit(1) // Skips deferred CleanupClients in main, leaking provider binaries!
    }
}
```

**VERIFICATION METHOD**:
Spawn mock plugin subprocesses inside an integration test runner. Induce a controlled panic inside an arbitrary worker goroutine. Inspect OS process tables (`ps aux` / `/proc`) following process exit to verify zero orphaned child PIDs matching the plugin binary signature exist.

---

### 3. Multi-Source Credential Conflict Assertion
**RULE**:
When authentication parameters can be ingested from multiple concurrent sources (e.g., direct CLI argument, backend configuration attribute, file-path reference, or ambient cloud platform runtime environment variables), the ingestion engine MUST NOT silently prefer one source over another or allow contradictory credentials to coexist. The client MUST perform strict binary identity comparisons (`strings.TrimSpace(sourceA) != strings.TrimSpace(sourceB)`). If both sources are populated and divergent, the system MUST halt immediately with a fatal diagnostic error specifying the conflicting input sources.

**WHY**:
Silently overriding an explicit user-supplied secret with an ambient environment variable (or vice versa, such as AKS Workload Identity versus configured Service Principal secrets) produces non-deterministic security contexts. Operators may unintentionally execute state mutations against incorrect production cloud tenants or decrypt sensitive state payloads using an unauthorized identity.

**WHEN TO APPLY**:
Configuration decoders, cloud SDK credential resolvers, backend initializers, and authentication middleware.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
package azure

import (
	"fmt"
	"os"
	"strings"

	"github.com/hashicorp/terraform/internal/backend/backendbase"
)

// ResolveCredentialSafely asserts identity parity between explicit and ambient sources.
func ResolveCredentialSafely(d *backendbase.SDKLikeData, explicitKey, envKey string) (*string, error) {
	configuredVal := strings.TrimSpace(d.String(explicitKey))

	// Ambient or path-based source
	envVal := strings.TrimSpace(os.Getenv(envKey))

	if configuredVal != "" && envVal != "" && configuredVal != envVal {
		return nil, fmt.Errorf(
			"security violation: mismatch detected between explicitly configured %q and ambient environment %q "+
				"- please remove one or align their values", explicitKey, envKey,
		)
	}

	if configuredVal != "" {
		return &configuredVal, nil
	}
	if envVal != "" {
		return &envVal, nil
	}

	return nil, nil
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Silent preference hides operator misconfiguration.
func ResolveCredentialDangerous(configuredVal, ambientVal string) string {
    if configuredVal != "" {
        return configuredVal // Silently drops ambientVal even if ambientVal belongs to a completely different tenant!
    }
    return ambientVal
}
```

**VERIFICATION METHOD**:
Implement property-based test cases where `explicitVal` and `ambientVal` are initialized to randomized non-equal strings. Assert that the resolver returns a non-nil diagnostic error matching `"mismatch detected"`.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: File Truncation Data Loss during Formatting under Write Failure (`BUG-FMT-DATALOSS-01`)
- **Context**: `internal/command/fmt.go`, `internal/replacefile/writefile.go`, `internal/command/e2etest/fmt_test.go`
- **What Was Expected**: Running `terraform fmt` on a directory containing configuration files updates unformatted files without risking content loss. If an I/O error occurs (such as storage exhaustion or file size limit limits enforced via OS `ulimit`), the original configuration file must remain unaltered.
- **What Actually Happened**: `terraform fmt` invoked `os.WriteFile(path, result, 0644)`. Go's `os.WriteFile` implementation invokes `os.OpenFile(name, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, perm)`. Under OS environments where a file write quota was exhausted or write failed midway, the file was truncated to 0 bytes before writing formatted contents. The write subsequently failed, leaving `main.tf` completely empty (0 bytes).
- **Evidence in Repo**: Commit `7a571756`, PR `#39303`, Issue `#39299`. Added unit/e2e tests explicitly verifying `ulimit -f 0` file retention.
- **Root Cause**: Reliance on direct file truncation without pre-write staging. While Terraform Core had an `AtomicWriteFile` implementation, applying it broke symlink resolution and discarded target inode permissions.
- **Remediation Code Diff**:
```go
// File: internal/command/fmt.go
@@ -188,9 +189,9 @@ func (c *FmtCommand) processFile(path string, r io.Reader, w io.Writer, isStdout
 			fmt.Fprintln(w, path)
 		}
 		if c.write {
-			err := os.WriteFile(path, result, 0644)
+			err = replacefile.NonAtomicWriteFileWithBackup(path, src, result)
 			if err != nil {
-				diags = diags.Append(fmt.Errorf("Failed to write %s", path))
+				diags = diags.Append(err)
 				return diags
 			}
 		}
```
- **Lesson**: Destructive in-place file modifications must decouple disk mutation into a staged backup transaction, ensuring zero-truncation exposure on write failures.

---

### Incident 2: Orphaned Provider Plugin Process Leak on Panic (`BUG-PLUGIN-LEAK-02`)
- **Context**: `main.go`, `logging/panic.go`, `github.com/hashicorp/go-plugin`
- **What Was Expected**: If any worker goroutine within Terraform encounters an unexpected panic, Terraform should catch the panic, output diagnostic crash dumps, safely terminate child provider processes, and exit with status code 11.
- **What Actually Happened**: `logging.PanicHandler` printed the crash dump and invoked `os.Exit(11)`. Because `os.Exit` bypasses the call stack, the `defer plugin.CleanupClients()` defined in `realMain` was never evaluated. Provider plugins (e.g., `terraform-provider-aws`) remained running in memory as orphaned background processes, holding network connections and consuming system RAM.
- **Evidence in Repo**: PR `#39408`, Issue `#39399`, closed October 19, 2026. Target release `1.18.x`.
- **Root Cause**: Conflating clean deferred cleanup semantics with abrupt process termination paths. Deferred blocks are not executed when an unrecovered panic terminates through an external crash handler using `os.Exit`.
- **Remediation Code Diff**:
```go
// File: internal/logging/panic.go
func PanicHandler() {
     if r := recover(); r != nil {
         fmt.Fprintln(os.Stderr, "Terraform Core has crashed!")
         debug.PrintStack()
+        // os.Exit skips deferred calls in main(), so managed plugins must be
+        // explicitly terminated here to avoid process leaks.
+        plugin.CleanupClients()
         os.Exit(11)
     }
}
```
- **Lesson**: Process managers that spawn subprocesses must invoke termination routines directly within their top-level signal/panic traps rather than relying on stack unwinding.

---

### Incident 3: Diagnostic Panic on Deprecated Schema Marks in Test Engine (`BUG-TEST-MARK-03`)
- **Context**: `internal/command/test`, diagnostics formatters.
- **What Was Expected**: Executing `terraform test` against module configurations containing deprecated schema values should report warnings or process validations cleanly without crashing.
- **What Actually Happened**: The test harness diagnostic formatting layer panicked with an "unhandled value mark" exception when encountering attributes tagged with deprecation markers from provider schemas.
- **Evidence in Repo**: PR `#39406`, Issue `#39365`, closed October 19, 2026.
- **Root Cause**: The cty value evaluation system uses runtime value marks (e.g., sensitive, ephemeral, deprecated). By design, the core system panics when encountering unhandled marks to prevent leaking sensitive or ephemeral data into unredacted logs. However, the diagnostic formatter for the test command did not handle deprecation marks, triggering a crash.
- **Remediation Code Diff**:
```go
// File: internal/command/test/format.go
- // Unhandled mark check panics generically across all marks
- if val.HasMark(mark) {
-     panic(fmt.Sprintf("unhandled mark %v", mark))
- }
+ // Strip or handle deprecated marks explicitly while retaining fail-safe panic for security marks
+ if val.HasMark(marks.Deprecated) {
+     val = val.UnmarkPath(marks.Deprecated)
+ }
+ if val.HasMarks() {
+     // Intentionally panic on security-critical marks (e.g. Sensitive, Ephemeral)
+     panic(fmt.Sprintf("security invariant: unhandled cty marks in test diagnostics: %v", val.Marks()))
+ }
```
- **Lesson**: Differentiate informational marks (deprecation) from security marks (sensitive, ephemeral) when implementing fail-closed validation engines.

---

### Incident 4: Consul Raft Transaction Payload Limits & Chunk Fragmentation (`BUG-CONSUL-KV-OVERFLOW-04`)
- **Context**: `internal/backend/remote-state/consul/client.go`
- **What Was Expected**: Terraform states exceeding several megabytes should save reliably to Consul backends.
- **What Actually Happened**: Consul’s Raft replication engine limits individual KV operations to 512KB (524,288 bytes). Large enterprise state files caused transactional commit operations (`kv.Txn`) to fail with "payload too large", leading to failed applies and unsaved state snapshots.
- **Evidence in Repo**: `internal/backend/remote-state/consul/client.go`, lines 174–290.
- **Root Cause**: Attempting to store an entire monolithic state file in a single Consul KV entry. Base64 encoding inside Consul transactions further increases payload size by ~33%.
- **Remediation Code Diff**:
```go
// File: internal/backend/remote-state/consul/client.go
@@ -245,6 +245,26 @@ func (c *RemoteClient) Put(data []byte) tfdiags.Diagnostics {
 	if err = store(payload); err == nil {
 		return diags
 	} else if !strings.Contains(err.Error(), "too large") {
 		return diags.Append(err)
 	}

+	// State payload too large: partition into chunks bounded by Consul's Raft limit (512KB)
+	md5 := md5.Sum(data)
+	chunks := split(payload, 524288)
+	chunkPaths := make([]string, 0, len(chunks))
+
+	for i, p := range chunks {
+		path := strings.TrimRight(c.Path, "/") + fmt.Sprintf("/tfstate.%x/%d", md5, i)
+		chunkPaths = append(chunkPaths, path)
+		if _, err := kv.Put(&consulapi.KVPair{Key: path, Value: p}, nil); err != nil {
+			return diags.Append(err)
+		}
+	}
+
+	manifest, _ := json.Marshal(map[string]interface{}{
+		"current-hash": fmt.Sprintf("%x", md5),
+		"chunks":       chunkPaths,
+	})
+	return diags.Append(store(manifest))
```
- **Lesson**: Remote storage engines must handle underlying consensus storage limits by transparently switching to chunked manifest-pointer patterns when payload thresholds are crossed.

---

### Incident 5: Azure Distributed State Inconsistency via Silent Credential Divergence (`BUG-AZURE-AUTH-MISMATCH-05`)
- **Context**: `internal/backend/remote-state/azure/helpers.go`
- **What Was Expected**: If an operator configures an explicit Azure Service Principal while running inside an Azure Kubernetes Service (AKS) cluster that injects Workload Identity variables (`AZURE_CLIENT_ID`, `AZURE_FEDERATED_TOKEN_FILE`), Terraform should operate against the explicitly intended tenant.
- **What Actually Happened**: Prior configurations allowed ambiguous authentication parameters, risking accidental state mutations across unexpected tenant environments if ambient variables did not match configured settings.
- **Evidence in Repo**: `internal/backend/remote-state/azure/helpers.go`, lines 71–138.
- **Root Cause**: Precedence ambiguity between ambient environment variables and explicit configuration blocks.
- **Remediation Code Diff**:
```go
// File: internal/backend/remote-state/azure/helpers.go
@@ -82,6 +82,10 @@ func getClientId(d *backendbase.SDKLikeData) (*string, error) {
 	if d.Bool("use_aks_workload_identity") && os.Getenv("AZURE_CLIENT_ID") != "" {
 		aksClientId := os.Getenv("AZURE_CLIENT_ID")
+		if clientId != "" && clientId != aksClientId {
+			return nil, fmt.Errorf("mismatch between supplied Client ID and that provided by AKS Workload Identity - please remove, ensure they match, or disable use_aks_workload_identity")
+		}
 		clientId = aksClientId
 	}
```
- **Lesson**: Disallow implicit credential precedence. When conflicting identity sources are provided, enforce hard validation failures to prevent accidental cross-tenant execution.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
*   **Gzip Magic Byte Detection**: Rather than relying on file extensions or configuration flags, payload decompression guards inspect stream headers directly:
    ```go
    // Magic byte header detection: 0x1f 0x8b indicates gzip compression
    if len(payload) >= 1 && payload[0] ==