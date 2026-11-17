# Domain G — Architecture Intelligence: Architecture Intelligence: pulumi-pulumi-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "pulumi-pulumi-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T08:46:51.698Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-pulumi-pulumi-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [pulumi-pulumi-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T08:46:51.698Z`  
> **Learning ID**: `LEARN-EVO-pulumi-pulumi-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: I (Content & Information Intelligence), H (Technical Construction Intelligence), K (Quality & Verification Intelligence), M (Feedback & Evolution Intelligence), L (Deployment & Operations Intelligence), D (Research & Knowledge Intelligence), A (Human & Need Intelligence), F (Design Intelligence)
- **Confidence Rating**: 73%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from pulumi-pulumi-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/pulumi-pulumi-learnings.md`  
> **Source**: github ([https://github.com/pulumi/pulumi](https://github.com/pulumi/pulumi))  
> **Source Version**: `3f4802f9`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-17T08:42:30.443Z  
> **Learning ID**: `learn-github-pulumi-pulumi`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): pulumi/pulumi

---

## 1. Executive Forensic Architecture & System Mechanics

### Exact Technical Problem Solved
Pulumi solves declarative cloud infrastructure lifecycle management via general-purpose programming languages (TypeScript, Python, Go, C#, Java, YAML) instead of domain-specific configuration languages. The system bridges stateful deployment planning with imperative runtime SDKs over language-agnostic RPC protocols, maintaining deterministic state graphs, resource snapshot integrity, diff isolation, and distributed secret isolation.

### Architectural Boundaries & State Ownership
The codebase enforces rigid architectural boundaries across three decoupled planes:

```
[ Language Runtime SDKs ] (NodeJS, Python, Go, .NET)
          │  gRPC (Language Host Protocol)
          ▼
[ Engine Orchestrator ] (pkg/v3/engine, pkg/v3/resource/deploy)
    ├── State Machine: Plan, Diff, Step generation (Create, Update, Replace, Delete)
    ├── Target & Snapshot Registry (pkg/backend/diy, pkg/backend/httpstate)
    └── Plugin Host & Provider Registry (pkg/resource/plugin)
          │  gRPC (Provider Protocol: CheckConfig2, DiffConfig, Configure, Create, Diff, Update, Delete)
          ▼
[ Resource Plugins / Providers ] (AWS, Azure, GCP, Kubernetes)
```

1. **Language Host Subsystem**: Spawns user code in child worker processes. Marshals language outputs into language-agnostic resource registrations over gRPC.
2. **Engine / Deploy Subsystem**: Maintains the deployment dependency graph (DAG). Computes topological execution order, enforces step-generation invariants, handles rollbacks on failures, tracks step checkpoints, and ensures cryptographically verified snapshot serialization.
3. **Provider Subsystem**: Decouples cloud vendor APIs from core engine mechanics via gRPC provider plugins. Owns schema negotiation, config validation (`CheckConfig` vs `CheckConfig2`), property translation, diff calculations, and state CRUD.
4. **Backend Subsystem**: Manages state checkpoint persistence. Supports multi-tenant REST cloud state (`pkg/backend/httpstate`) and localized/self-managed object stores (`pkg/backend/diy` with S3, GCS, Azure Blob, and file-based state).

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Two-Phase Evolutionary RPC Protocol Migration Invariant
**RULE**:
When evolving a core RPC contract with breaking changes or expanding parameter shapes, the protocol client **MUST** invoke the new versioned method (`MethodV2`) first and catch `codes.Unimplemented`. Upon receiving `codes.Unimplemented`, it **MUST** automatically fall back to the legacy method (`MethodV1`), translating the legacy response types into the unified internal representation. Deprecated SDK stubs **MUST NOT** be removed until complete ecosystem cut-off; they **MUST** explicitly return `codes.Unimplemented`.

**WHY**:
In distributed plugin architectures, engines and plugins are independently versioned and compiled across different runtimes. In-place modification of existing gRPC request/response messages (`CheckRequest`/`CheckResponse`) causes cross-version serialization skew, breaks un-recompiled plugins, or corrupts structural types when distinct domains (e.g., resource checking vs provider configuration checking) share overloaded payload structs.

**WHEN TO APPLY**:
Apply to any client-server or host-plugin interface communicating via Protobuf, gRPC, or versioned JSON-RPC where backward compatibility with out-of-tree plugins is mandatory.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Extracted from pkg/resource/plugin/provider_plugin.go
func (p *provider) CheckConfig(ctx context.Context, req CheckConfigRequest) (CheckConfigResponse, error) {
    molds := propertyrpc.Marshal(req.Olds)
    mnews := propertyrpc.Marshal(req.News)

    var rpcInputs *structpb.Struct
    var failures []CheckConfigFailure

    // Phase 1: Attempt the evolved CheckConfig2 RPC with decoupled schemas
    resp2, err := p.clientRaw.CheckConfig2(p.requestContext(), &pulumirpc.CheckConfigRequest{
        Urn:       string(req.URN),
        Name:      req.URN.Name(),
        Type:      req.URN.Type().String(),
        OldInputs: molds,
        NewInputs: mnews,
    })

    switch {
    case err == nil:
        rpcInputs = resp2.GetInputs()
        failures = slice.Prealloc[CheckConfigFailure](len(resp2.GetFailures()))
        for _, failure := range resp2.GetFailures() {
            failures = append(failures, checkConfigFailureFromRPC(failure))
        }

    // Phase 2: Detect lack of support on older plugins and fall back seamlessly
    case rpcerror.Convert(err).Code() == codes.Unimplemented:
        logging.V(7).Infof("%s CheckConfig2 is unimplemented: falling back to CheckConfig", req.URN)
        resp, err := p.clientRaw.CheckConfig(p.requestContext(), &pulumirpc.CheckRequest{
            Urn:  string(req.URN),
            Name: req.URN.Name(),
            Type: req.URN.Type().String(),
            Olds: molds,
            News: mnews,
        })
        if err != nil {
            rpcErr := rpcerror.Convert(err)
            if rpcErr.Code() == codes.Unimplemented {
                // Logical backwards compatibility: assume provider accepted news
                return CheckConfigResponse{Properties: req.News}, nil
            }
            return CheckConfigResponse{}, err
        }
        rpcInputs = resp.GetInputs()
        failures = slice.Prealloc[CheckConfigFailure](len(resp.GetFailures()))
        for _, failure := range resp.GetFailures() {
            failures = append(failures, CheckConfigFailure{
                Property: resource.PropertyKey(failure.Property),
                Reason:   failure.Reason,
            })
        }

    default:
        return CheckConfigResponse{}, err
    }

    // Unmarshal inputs safely using standardized decoding
    var inputs property.Map
    if ins := rpcInputs; ins != nil {
        raw, err := propertyrpc.Unmarshal(ins)
        if err != nil {
            return CheckConfigResponse{}, err
        }
        inputs = raw
    }

    return CheckConfigResponse{
        Properties: annotateSecrets(inputs, req.News),
        Failures:   failures,
    }, nil
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Modifying the shared legacy gRPC struct or hard-failing without fallback
func (p *provider) CheckConfigBroken(ctx context.Context, req CheckConfigRequest) (CheckConfigResponse, error) {
    // VIOLATION 1: Directly calling new RPC without fallback crashes legacy out-of-tree plugins
    resp, err := p.clientRaw.CheckConfig2(ctx, &pulumirpc.CheckConfigRequest{...})
    if err != nil {
        return CheckConfigResponse{}, err // CRASH: Older providers fail whole deployment!
    }

    // VIOLATION 2: Overloading existing CheckRequest with configuration fields causes
    // unmarshaling failures or type collisions in older compiled SDKs.
    return CheckConfigResponse{Properties: resp.Inputs}, nil
}
```

**VERIFICATION METHOD**:
Mock provider harness executing two parallel test suites:
1. `TestProvider_CheckConfig_prefersCheckConfig2`: Verifies calling client dispatches to `CheckConfig2` when implemented.
2. `TestProvider_CheckConfig_fallsBackToCheckConfig`: Configures `checkConfig2` stub returning `status.Error(codes.Unimplemented, "")` and asserts that `CheckConfig` is invoked and its legacy output structure mapped to `CheckConfigFailure` without data loss.

---

### 2. State Checkpoint Atomic Swap and Integrity Gate
**RULE**:
State backends writing checkpoints **MUST** enforce atomic swap semantics (never write directly to the target state file or delete the source before replacement finishes) and **MUST** execute strict cryptographic and relational snapshot integrity verification on read. If integrity checking fails, execution **MUST** halt immediately and refuse to run the engine unless an explicit, logged override is provided.

**WHY**:
A half-written state file, a crashed process during file modification, or reading a checkpoint with corrupted parent-child URN relationships produces "split-brain" infrastructure state. The engine would lose track of live cloud resources, leading to dangling billable assets or destructive recreation of existing production infrastructure.

**WHEN TO APPLY**:
Any database, state store, or persistence layer managing deployment state, resource ownership trees, or financial/audit ledgers.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Extracted from pkg/backend/diy/state.go
func (b *diyBackend) getSnapshot(ctx context.Context, secretsProvider secrets.Provider, ref *diyBackendReference) (*deploy.Snapshot, error) {
    contract.Requiref(ref != nil, "ref", "must not be nil")

    checkpoint, _, _, err := b.getCheckpoint(ctx, ref)
    if err != nil {
        return nil, fmt.Errorf("failed to load checkpoint: %w", err)
    }

    snap, err := stack.DeserializeCheckpoint(ctx, secretsProvider, checkpoint)
    if err != nil {
        return nil, err
    }

    // Strict integrity gate: Never proceed with corrupted DAG state
    if !backend.DisableIntegrityChecking {
        if err := snap.VerifyIntegrity(); err != nil {
            if sie, ok := snapshot.AsSnapshotIntegrityError(err); ok {
                var metadata *apitype.SnapshotIntegrityErrorMetadataV1
                if snap.Metadata.IntegrityErrorMetadata != nil {
                    metadata = &apitype.SnapshotIntegrityErrorMetadataV1{
                        Version: snap.Metadata.IntegrityErrorMetadata.Version,
                        Command: snap.Metadata.IntegrityErrorMetadata.Command,
                        Error:   snap.Metadata.IntegrityErrorMetadata.Error,
                    }
                }
                return nil, fmt.Errorf("snapshot integrity failure; refusing to use it: %w", sie.ForReadWithMetadata(metadata))
            }
            return nil, fmt.Errorf("snapshot integrity failure; refusing to use it: %w", err)
        }
    }

    return snap, nil
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Overwriting state in-place without backup, omitting verification
func (b *diyBackend) saveCheckpointUnsafe(ctx context.Context, file string, bytes []byte) error {
    // VIOLATION 1: Writing directly to target file without backup or atomic rename
    // If process is SIGKILLed here, the checkpoint is zeroed or truncated!
    return b.bucket.WriteAll(ctx, file, bytes, nil)
}

func (b *diyBackend) getSnapshotUnsafe(ctx context.Context) (*deploy.Snapshot, error) {
    // VIOLATION 2: Returning deserialized checkpoint directly without VerifyIntegrity()
    snap, _ := stack.DeserializeCheckpoint(...)
    return snap, nil // Passes dangling pointers or cyclic dependencies into engine
}
```

**VERIFICATION METHOD**:
Property test injecting artificial corruption into serialized JSON checkpoints:
- Test 1: Cycle in parent-child URN chain. Assert `snap.VerifyIntegrity()` returns `SnapshotIntegrityError` and `getSnapshot` rejects execution.
- Test 2: Process interruption test. Assert state backup remains valid and atomic swap prevents zero-length files when stream write fails midway.

---

### 3. Bidirectional Middle-Out Context Budget Truncation Invariant
**RULE**:
When packaging large CLI event streams, error logs, or command diffs for consumption by an LLM or remote analytics service, the client **MUST** apply bidirectional "middle-out" truncation rather than head or tail truncation. The system **MUST** preserve both the beginning (initial execution commands, configuration, initialization events) and the end (panics, terminal stack traces, final summary counters) while excising content strictly from the center.

**WHY**:
LLMs diagnosing failed infrastructure deployments fail when head-truncated (losing the command invoked and input parameters) or tail-truncated (losing the actual fatal error, panic trace, or exit code). Middle execution logs predominantly consist of repetitive progress events, making them the optimal point for truncation.

**WHEN TO APPLY**:
AI agent tooling, copilot prompt payload synthesizers, log ingestion pipelines, and crash reporting layers with strict token/character quotas.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Extracted from pkg/backend/httpstate/client/ai.go
const truncationNotice = "... (truncated) ..."

func TruncateWithMiddleOut(content string, maxChars int) string {
    // If content fits within quota, return unmodified
    if len(content) <= maxChars {
        return content
    }

    // Boundary condition: Quota smaller than or equal to notice text
    if maxChars <= len(truncationNotice) {
        if maxChars <= 0 {
            return ""
        }
        return content[:maxChars]
    }

    // Allocate remaining character budget evenly between head and tail
    remaining := maxChars - len(truncationNotice)
    startLen := (remaining + 1) / 2
    endLen := remaining / 2

    // Retain head context and tail diagnostics, discarding intermediate spam
    return content[:startLen] + truncationNotice + content[len(content)-endLen:]
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Naive head or tail log slicing
func TruncateLogTail(content string, maxChars int) string {
    // VIOLATION: Throws away root command, flags, and early initialization failures
    if len(content) > maxChars {
        return content[len(content)-maxChars:]
    }
    return content
}

func TruncateLogHead(content string, maxChars int) string {
    // VIOLATION: Throws away panic message, fatal stack trace, and summary statistics
    if len(content) > maxChars {
        return content[:maxChars] + "..."
    }
    return content
}
```

**VERIFICATION METHOD**:
Automated unit test with varied string boundaries:
- Input with length `< maxChars`: Verify exact match.
- Input with `maxChars = len(truncationNotice)`: Verify no out-of-bounds slice indexing.
- 500KB input with `maxChars = 4000`: Verify `len(result) == 4000`, `strings.HasPrefix(result, original[:1989]) == true`, and `strings.HasSuffix(result, original[len-1989:]) == true`.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: CheckConfig Protocol Coupling and Type Collision (BUG-PULUMI-01)
- **Context**: Provider RPC interface evolution (`pkg/resource/plugin/provider_plugin.go`, `pkg/resource/plugin/provider.go`, `pkg/resource/deploy/providers/registry.go`).
- **What Was Expected**: Engine configuration checks (`CheckConfig`) needed to expand payload fields without mutating or interfering with general resource checking (`Check`). Both providers implementing the legacy interface and new providers supporting extended fields must operate without compilation or RPC failures.
- **What Actually Happened**: `Check` and `CheckConfig` shared common message types (`CheckRequest`, `CheckResponse`, `CheckFailure`). Expanding fields for provider configuration checking caused type collisions and forced a hard source break for custom providers.
- **Evidence in Repo**: Commit `3f4802f9`, Issue/PR `#25670`, `#25666`, Discussion `#25598`.
- **Root Cause**: Overloading the same Protobuf/gRPC message structures for two structurally distinct lifecycle phases: general resource input validation vs provider plugin instantiation configuration.
- **Remediation Code Diff**:
```go
// pkg/resource/plugin/provider.go
 type CheckConfigResponse struct {
 	Properties property.Map
-	Failures   []CheckFailure
+	Failures   []CheckConfigFailure
+}
+
+type CheckConfigFailure struct {
+	Property resource.PropertyKey
+	Reason   string
 }

// pkg/resource/plugin/provider_plugin.go
-	resp, err := p.clientRaw.CheckConfig(p.requestContext(), &pulumirpc.CheckRequest{...})
+	resp2, err := p.clientRaw.CheckConfig2(p.requestContext(), &pulumirpc.CheckConfigRequest{...})
+	switch {
+	case err == nil:
+		rpcInputs = resp2.GetInputs()
+		for _, f := range resp2.GetFailures() {
+			failures = append(failures, checkConfigFailureFromRPC(f))
+		}
+	case rpcerror.Convert(err).Code() == codes.Unimplemented:
+		// Fall back to legacy CheckConfig gRPC endpoint
+		resp, err := p.clientRaw.CheckConfig(...)
```
- **Lesson**: Protocol schemas across distinct lifecycle phases must never be shared across domain boundaries. When decoupling, implement dynamic RPC fallback via `codes.Unimplemented`.

---

### Incident 2: Release Artifact Hash Mismatch from Concurrent CI/CD Jobs (BUG-PULUMI-02)
- **Context**: Release pipeline binary packaging (`.github/workflows/release.yml`, Issue `#25685`, PR `#25684`).
- **What Was Expected**: `SHA512SUMS` and `pulumi-*-checksums.txt` (SHA256) published on GitHub Releases must strictly match the binary archives uploaded to both GitHub and `get.pulumi.com`.
- **What Actually Happened**: In release `v3.275.0`, `SHA512SUMS` diverged from every single one of the six distributed CLI binaries (`darwin-arm64`, `darwin-x64`, `linux-arm64`, `linux-x64`, `windows-arm64`, `windows-x64`), breaking automated package managers (Homebrew, Chocolatey).
- **Evidence in Repo**: Issue `#25685` ("v3.275.0: SHA512SUMS don't match any release binary").
- **Root Cause**: A race condition in GitHub Actions release workflows. The job calculating `SHA512SUMS` ran concurrently with the artifact compression and code-signing jobs. The hash was generated from an intermediate binary before the final codesign step mutated the binary headers, whereas the uploaded archives contained the signed outputs.
- **Remediation Code Diff**:
```yaml
# .github/workflows/release.yml (Enforce strict barrier synchronization)
- jobs:
-   build-binaries: ...
-   hash-binaries:
-     needs: [build-binaries] # RACED: Ran prior to sign completion
-   sign-binaries:
-     needs: [build-binaries]
+ jobs:
+   build-binaries: ...
+   sign-binaries:
+     needs: [build-binaries]
+   package-and-hash:
+     needs: [sign-binaries] # INVARIANT: Hashes calculated ONLY after signing completes
```
- **Lesson**: Cryptographic checksum calculation MUST occur at the absolute terminal egress point of a release pipeline, strictly dependent on all in-place modification and code-signing steps.

---

### Incident 3: Dual-Package Fork Drifting and Code Duplication Trap (BUG-PULUMI-03)
- **Context**: Package refactoring and Agent divergence (`sdk/go/common/resource/plugin` vs `pkg/resource/plugin`).
- **What Was Expected**: Engine developers and autonomous coding agents should implement new features and RPC enhancements in `pkg/resource/plugin` only.
- **What Actually Happened**: In PR `#23700`, `sdk/go/common/resource/plugin` was forked to `pkg/resource/plugin`. Because the old package remained in the tree without deprecation markers, autonomous coding agents (Claude Code, Neo) continuously mirrored patches across both packages (e.g., `#25670`), creating dead code and build divergence.
- **Evidence in Repo**: Commit `0fc4bac0`, Issue `#25716`.
- **Root Cause**: Incomplete architectural migration without explicit repository-level metadata (`AGENTS.md`) or Go compiler deprecation directives, causing LLM agent tooling to hallucinate maintenance requirements.
- **Remediation Code Diff**:
```markdown
# sdk/go/AGENTS.md
+## Deprecated code
+
+- `sdk/go/common/resource/plugin` is functionally deprecated. It was forked to `pkg/resource/plugin` (#23700),
+  and the engine and CLI only use the fork. Do not add features or make other changes to the `sdk` copy;
+  make them in `pkg/resource/plugin` instead. The exception is the minimum needed to keep it compiling,
+  such as a stub for a new RPC on its provider server.
```
- **Lesson**: When forking internal packages, you must immediately enforce boundary constraints via machine-readable lint rules or developer/agent instruction manifests (`AGENTS.md`), stubbing out the legacy copy.

---

### Incident 4: Snapshot Integrity Metadata Drop During Error Materialization (BUG-PULUMI-04)
- **Context**: State snapshot deserialization (`pkg/backend/diy/state.go`).
- **What Was Expected**: When reading a corrupted checkpoint file, the engine must return structured diagnostic metadata (CLI version that corrupted it, command invoked, underlying DAG violation) to prevent blind data loss.
- **What Actually Happened**: Deserialization was dropping `IntegrityErrorMetadata` during the conversion of `SnapshotIntegrityError`, obscuring whether the corruption occurred during state read or prior state write.
- **Evidence in Repo**: `pkg/backend/diy/state.go` lines 140-160 (`sie.ForReadWithMetadata(metadata)`).
- **Root Cause**: Generic error wrapping (`fmt.Errorf("%w")`) without preserving nested `IntegrityErrorMetadata` structures on the error object.
- **Remediation Code Diff**:
```go
// pkg/backend/diy/state.go
 if err := snap.VerifyIntegrity(); err != nil {
-    return nil, fmt.Errorf("snapshot integrity failure: %w", err)
+    if sie, ok := snapshot.AsSnapshotIntegrityError(err); ok {
+        var metadata *apitype.SnapshotIntegrityErrorMetadataV1
+        if snap.Metadata.IntegrityErrorMetadata != nil {
+            metadata = &apitype.SnapshotIntegrityErrorMetadataV1{
+                Version: snap.Metadata.IntegrityErrorMetadata.Version,
+                Command: snap.Metadata.IntegrityErrorMetadata.Command,
+                Error:   snap.Metadata.IntegrityErrorMetadata.Error,
+            }
+        }
+        return nil, fmt.Errorf("snapshot integrity failure; refusing to use it: %w", sie.ForReadWithMetadata(metadata))
+    }
     return nil, fmt.Errorf("snapshot integrity failure; refusing to use it: %w", err)
 }
```
- **Lesson**: Custom domain errors containing debugging metadata must be recovered via type assertion before wrapping to avoid flattening structured diagnostics into raw strings.

---

### Incident 5: State Backup Deletion Race Condition in DIY Backends (BUG-PULUMI-05)
- **Context**: Checkpoint storage operations (`pkg/backend/diy/state.go`).
- **What Was Expected**: Checkpoint saves must never delete existing state files before the replacement file has been verified and committed to object storage.
- **What Actually Happened**: Changes in compression format (e.g., switching from raw JSON to GZIP or ZSTD) caused the system to delete the old compression-format file prematurely, leaving zero checkpoint files available if the write failed.
- **Evidence in Repo**: `pkg/backend/diy/state.go` lines 240-275, Issue `#9033`.
- **Root Cause**: Attempting to clean up outdated compression variants before ensuring the new compressed variant was written and acknowledged by the bucket driver.
- **Remediation Code Diff**:
```go
// pkg/backend/diy/state.go
-    // Delete old compression file prior to write
-    b.bucket.Delete(ctx, oldFile)
-    b.bucket.WriteAll(ctx, file, byts, nil)
+    // Back up the existing file if it already exists. Don't delete the original, the following WriteAll will
+    // atomically replace it anyway and various other bits of the system depend on being able to find the
+    // .json file to know the stack currently exists (see #9033).
+    backupFile = backupTarget(ctx, b.bucket, file, true)
+    // Keep the old format active until the replacement has been written successfully.
```
- **Lesson**: In transactional file updates, old formats must remain in place until the new format has been flushed and fsynced/acknowledged.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Empty Interface JSON Escaping Trap**: Standard `json.Marshal` HTML-escapes characters (`<`, `>`, `&`). In IaC systems where IAM policies, Bash `userData`, or JSON-encoded strings contain shell operations (`cat <<EOF > /etc/foo && chmod +x /etc/foo`), using standard `json.Marshal` corrupts remote cloud instances.
```go
// Extracted from pkg/backend/diy/state.go: compactJSONMarshaler
type compactJSONMarshaler struct{}

func (compactJSONMarshaler) Marshal(v any) ([]byte, error) {
    var buf bytes.Buffer
    enc := json.NewEncoder(&buf)
    // CRITICAL: Prevent '<', '>', '&' from becoming '\u003c', '\u003e', '\u0026'
    enc.SetEscapeHTML(false)
    if err := enc.Encode(v); err != nil {
        return nil, err
    }
    // enc.Encode appends a trailing newline; state files and hashes require exact byte trimming
    return bytes.TrimSpace(buf.Bytes()), nil
}
```
- **Secret Annotation Masking**: Passing raw property maps to providers strips secret annotations (`annotateSecrets(inputs, req.News)`). Providers only process plaintext, but the engine must re-annotate output properties to avoid leaking decrypted values into the state checkpoint.

---

### 2. Infinite Loop & Recursion Guards
- **Middle-Out Truncation Boundary Invariant**: When computing string slices based on mathematical division, integer rounding traps can cause index out-of-range panics or infinite allocation.
```go
// Invariant Proof:
// remaining := maxChars - len(truncationNotice)
// startLen := (remaining + 1) / 2
// endLen := remaining / 2
// Proof: startLen + endLen == (remaining + 1) / 2 + remaining / 2 == remaining
// When remaining is odd: (2k+1 + 1)/2 + (2k+1)/2 = (k+1) + k = 2k + 1 = remaining.
// When remaining is even: (2k + 1)/2 + 2k/2 = k + k = 2k = remaining.
// Slicing content[:startLen] and content[len(content)-endLen:] is provably non-overlapping
// as long as len(content) > maxChars.
```

---

### 3. UI & UX Micro-Mechanics
- **ANSI Terminal Padding Calculation**: Standard `len(str)` calculates byte counts, which breaks column alignment when strings contain ANSI color escapes (`\x1b[34m`).
```go
// Extracted from pkg/backend/display/tableutil.go
func messagePadding(message string, maxWidth, extraPadding int) string {
    // colors.MeasureColorizedString strips ANSI sequences before measuring terminal visual width
    extraWhitespace := maxWidth - colors.MeasureColorizedString(message)
    contract.Assertf(extraWhitespace >= 0, "Neg whitespace. %v %s", maxWidth, message)
    extraWhitespace += extraPadding
    return strings.Repeat(" ", extraWhitespace)
}
```

---

### 4. Backend Concurrency & Memory Safety
- **Stampede-Proof Token Refresh Lock**: Preventing multiple concurrent HTTP client goroutines from burning OAuth refresh grants when receiving 401s simultaneously.
```go
// Extracted from pkg/backend/httpstate/client/api.go
func (t *refreshableAPIAccessToken) Refresh(ctx context.Context, prevAccessToken string) error {
    t.mu.Lock()
    defer t.mu.Unlock()

    // TOCTOU GUARD: If another goroutine already refreshed the token while we were
    // waiting on t.mu.Lock(), our sent token is stale.
    // Bail immediately without calling /api/oauth/token again.
    if t.accessToken != prevAccessToken {
        return nil
    }

    newToken, expiresAt, newRefresh, err := t.refresh(ctx, t.refreshToken)
    if err != nil {
        return err
    }

    t.accessToken = newToken
    return t.writeback(newToken, expiresAt, newRefresh)
}
```

---

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Clean Path Root Trailing Slash Guard**: Standard `path.Clean` removes trailing slashes, which breaks HTTP routing muxers expecting root paths.
```go
// Extracted from pkg/backend/httpstate/client/api_endpoints.go
func cleanPath(p string) string {
    if p == "" {
        return "/"
    }
    if p[0] != '/' {
        p = "/" + p
    }
    np := path.Clean(p)
    // path.Clean removes trailing slash except for root; restore if required
    if p[len(p)-1] == '/' && np != "/" {
        np += "/"
    }
    return np
}
```

---

## 5. The 9 Deep Learning Dimensions

### Dimension 1: Architecture
- **State Segregation**: Separation between `engine.Target` (desired state, inputs) and `deploy.Snapshot` (actual recorded state, outputs).
- **Loose Coupling**: Provider plugins execute in separate OS processes communicating over unix domain sockets or loopback TCP using gRPC.

### Dimension 2: Core Abstractions
- **URN (`resource.URN`)**: Universal Resource Name encoding `stack::project::parent_type$child_type::resource_name`.
- **PropertyMap (`property.Map`)**: Strongly typed structural representation representing primitive types, maps, arrays, assets, archives, and secrets.
- **Contract Package (`contract.Assert`, `contract.Requiref`)**: Enforces internal state assertions that terminate execution rather than propagating invalid states.

### Dimension 3: Error Handling
- **Fault Boundaries**: The engine catches provider RPC errors and classifies them into fatal vs non-fatal diff errors.
- **Diagnostic Sinks (`diag.Sink`)**: Errors and warnings are multiplexed across structured event streams rather than written directly to stderr.

### Dimension 4: Testing
- **Conformance Harnesses**: Custom mock providers (`mock.MockProvider`, `checkConfigClient`) simulating `codes.Unimplemented`, network drops, and schema rejections.
- **Parallel Testing**: Mandatory `t.Parallel()` across isolated provider harnesses using `t.Context()`.

### Dimension 5: Security
- **Secret Envelope Isolation**: Secrets are encrypted at the client boundary using backend KMS/Passphrase providers before being persisted to checkpoints.
- **Agent Permission Modes**: `NeoPermissionModeReadOnly` restricts autonomous agents from mutating live cloud infrastructure.

### Dimension 6: Performance
- **Pre-Allocated Slices**: Use of `slice.Prealloc[T](len)` to eliminate reallocations during large resource graph iterations.
- **Zero-Copy Checkpoint Parsing**: Use of `json.RawMessage` in `VersionedCheckpoint` to defer sub-tree parsing until needed.

### Dimension 7: Deployment
- **Homebrew / Package Pipeline Barrier**: Release pipelines enforce strict sequential barriers: compile -> code sign -> package -> hash (`SHA512SUMS`).

### Dimension 8: Agent Patterns
- **Approval & Plan Modes**: Structured agents implement `NeoApprovalMode` (`manual`, `balanced`, `auto`) and `PlanMode` gates preventing mutation tool execution.
- **User-Agent Instrumentation**: All REST calls append `cmd=...` and `agent=...` tokens to track agent-driven deployment metrics.

### Dimension 9: Data Flow
```
CLI Command -> Config Loader -> Engine Plan -> Provider CheckConfig2 (Fallback: CheckConfig) 
 -> Provider Diff -> Step Generation -> Step Execution (Create/Update) 
 -> Snapshot Checkpoint (Atomic File Swap) -> Event Stream (Middle-Out Truncation)
```

---

## 6. The 8 Learning Extraction Artifacts

### 1. Pattern
**Resilient Versioned gRPC Fallback**:
Call `MethodV2`; if `status.Code(err) == codes.Unimplemented`, invoke `MethodV1` and convert legacy response structures into internal domain types.

### 2. Rule
**State Storage Immutability**:
A checkpoint file MUST never be overwritten directly or unlinked prior to verifying that its successor is successfully committed and acknowledged.

### 3. Architecture Principle
**Host-Plugin Process Isolation**:
Plugins MUST run out-of-process and communicate over typed RPC interfaces to prevent cloud SDK crashes or dependency conflicts from corrupting the orchestrator.

### 4. Failure Mode
**Race in Multi-Stage Release Pipelines**:
Generating checksums in parallel with signing jobs results in publishing checksums of unsigned binaries while distributing signed binaries, breaking consumer verification.

### 5. Reusable Skill
**Middle-Out Log Synthesizer**:
When preparing logs for AI agents under strict token budgets, compute `(max - noticeLen) / 2` and slice both head and tail, preserving boundaries while shedding middle cycles.

### 6. Decision
**Retaining Forked SDK Stubs**:
Forked packages slated for deprecation must keep functional compile stubs returning `codes.Unimplemented` to prevent breaking existing conformance suites while new code migrates.

### 7. Anti-Pattern
**Overloading Shared gRPC Payloads**:
Never reuse a shared request/response message across two distinct operational verbs (`Check` vs `CheckConfig`).

### 8. Verification Method
**Integrity Fault Injection**:
Programmatically mutate parent-child relationships in saved JSON snapshots and assert that `snap.VerifyIntegrity()` halts the pipeline with `SnapshotIntegrityError`.

---

## 7. Actionable Agent Skill & Implementation Checklist

```markdown
### AI Coding Agent System-Verification Checklist

- [ ] RPC Evolution Invariant:
      - Does the new method fall back to the legacy method on codes.Unimplemented?
      - Are request/response Protobuf types fully decoupled?

- [ ] Serialization & HTML Safety:
      - Is enc.SetEscapeHTML(false) explicitly configured on JSON encoders outputting state?
      - Is bytes.TrimSpace applied to eliminate trailing newlines before hashing?

- [ ] Checkpoint & Snapshot Integrity:
      - Is snap.VerifyIntegrity() executed immediately following deserialization?
      - Does saving a checkpoint execute via atomic rename/write-new-first semantics?

- [ ] Context Window Optimization:
      - Are error outputs, diffs, and summaries processed through Middle-Out truncation?
      - Is the truncation budget invariant proven against edge cases (budget <= notice length)?

- [ ] Multi-Threaded Auth Safety:
      - Does token refresh verify accessToken != prevAccessToken after acquiring the lock?
```

## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
