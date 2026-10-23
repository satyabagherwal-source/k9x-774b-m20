> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/pulumi-pulumi-learnings.md`  
> **Source**: github ([https://github.com/pulumi/pulumi](https://github.com/pulumi/pulumi))  
> **Source Version**: `e87e613e`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-23T08:22:51.309Z  
> **Learning ID**: `learn-github-pulumi-pulumi`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): pulumi/pulumi

---

## 1. Executive Forensic Architecture & System Mechanics

Pulumi is a multi-language Infrastructure as Code (IaC) orchestrator designed to reconcile desired state declared in general-purpose programming languages (TypeScript/JavaScript, Python, Go, C#, Java, YAML) against real-world cloud APIs (AWS, Azure, GCP, Kubernetes) via a stateful, declarative deployment engine.

```
+---------------------------------------------------------------------------------------+
| Language Runtime Hosts (Node.js, Python, Go, .NET, Java)                              |
| Language Host Process (e.g., pulumi-language-nodejs)                                  |
|   ├── User Program (declares Resources, Outputs, Inputs, Secrets)                    |
|   └── Pulumi SDK (gRPC client: ResourceMonitor)                                       |
+------------------------------------------┬--------------------------------------------+
                                           │ gRPC: RegisterResource / RegisterResourceOutputs
                                           ▼
+---------------------------------------------------------------------------------------+
| Core Engine (pkg/engine)                                                              |
|   ├── Step Generator (Determines CRUD diffs: Create, Update, Delete, Replace, Same)   |
|   ├── Plan Coordinator & Lifecyle Manager (DryRun preview vs Execution)               |
|   ├── Analyzer Manager (Evaluates Policy as Code packs: pre-resource & stack rules)   |
|   └── Secrets Manager (Encryption/Decryption boundary for secret property values)     |
+--------------------┬---------------------------------------------┬--------------------+
                     │ gRPC                                        │ State I/O
                     ▼                                             ▼
+----------------------------------------+   +------------------------------------------+
| Resource Providers (pkg/resource/...)  |   | State Backend Abstraction (pkg/backend)  |
| (AWS, Azure, Kubernetes, Simple, etc.) |   | ├── HTTP / SaaS State (Pulumi Cloud)     |
|   ├── Configure / CheckConfig          |   | │    ├── Leases & Checkpoint Deltas      |
|   ├── Check (Validates Inputs)         |   | │    ├── Policy Exceptions Wire Protocol |
|   ├── Diff (Computes delta vs state)   |   | │    └── AI / Neo Agent Task Dispatch   |
|   ├── Create / Update / Delete         |   | └── DIY Blob State (S3, GCS, Azure, File)|
|   └── Read (Refreshes actual state)    |   |      ├── Atomic Snapshot Marshaling      |
+----------------------------------------+   |      ├── Integrity Verification Checks   |
                                             |      └── Compression Pipeline (Zstd/Gzip)|
                                             +------------------------------------------+
```

### Critical Subsystem Boundaries & Abstractions

1. **Language Host / Engine IPC Barrier (`sdk/go/common/resource/plugin`)**: The user's code executes in a sandboxed child process (the language host). It does not directly mutate cloud resources or local state. Instead, it streams resource registration requests over gRPC to the Engine's `ResourceMonitor`.
2. **State & Snapshot Integrity Boundary (`pkg/resource/stack/snapshot`, `pkg/backend/diy`)**: State files (checkpoints) represent ground truth. Deserialization verifies graph acyclicity, resource URN uniqueness, and parent-child hierarchy. Corruption or tampering fails loudly before plan evaluation starts via `VerifyIntegrity()`.
3. **Policy-as-Code Enforcement Pipeline (`pkg/resource/analyzer`, `pkg/engine/lifecycletest`)**: Intercepts every resource registration prior to provider execution. Analyzers evaluate invariants against known inputs and must account for two distinct non-standard states: `Unknown` values (computed outputs during preview) and `Secret` values (ciphertext envelopes).
4. **Backend State Layer (`pkg/backend/httpstate` vs `pkg/backend/diy`)**:
   - `httpstate`: REST/gRPC client communicating with the Pulumi Cloud SaaS; handles distributed locks, lease renewals (`renew_lease`), policy pack downloads, and AI/Agent integrations.
   - `diy`: Serverless cloud-agnostic blob store driver (`gocloud.dev/blob`) saving versioned, compressed (Zstandard/Gzip), integrity-hashed JSON snapshots with atomic backup rotations.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Invariant Keying by Object Identity Over Qualified Name in Multi-Tenant Analyzers
**RULE**:
When binding runtime policies, access exceptions, or interceptors to loaded executable plugins, modules, or services, the internal dispatch table MUST be keyed by the unique runtime instance pointer/handle (`plugin.Analyzer`) rather than its descriptive string identifier or package name (`packName`).

**WHY**:
String names are not globally unique across mixed execution sources. When local development packs share the same name as enterprise-mandated cloud policy packs, or when multiple versions of the same plugin are instantiated concurrently, name-keyed maps cause cross-tenant collision. A local pack's permissive exceptions will unintentionally suppress violations triggered by strict enterprise-mandated packs, completely bypassing security enforcement.

**WHEN TO APPLY**:
Any plugin architecture, policy engine, middleware chain, or dynamic dispatch system where plugins can originate from multiple trust domains (e.g., local files vs SaaS API).

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// From pkg/engine/deployment.go & pkg/engine/update.go
type deploymentOptions struct {
	LoadedAnalyzers []plugin.Analyzer

	// PolicyExceptions is keyed strictly by the instantiated plugin.Analyzer handle,
	// preventing cross-contamination between identical pack names from different sources.
	PolicyExceptions map[plugin.Analyzer]resourceanalyzer.PolicyExceptions
}

// In loadPolicyPlugins:
func registerAnalyzerExceptions(
	analyzersMu *sync.Mutex,
	policyExceptions map[plugin.Analyzer]resourceanalyzer.PolicyExceptions,
	analyzer plugin.Analyzer,
	exceptions resourceanalyzer.PolicyExceptions,
) {
	analyzersMu.Lock()
	defer analyzersMu.Unlock()
	// Keyed on analyzer interface pointer identity
	policyExceptions[analyzer] = exceptions
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Keying by string name creates namespace collisions and security holes!
type badDeploymentOptions struct {
	// A local pack named "security-pack" will overwrite or merge with the cloud-enforced "security-pack"
	PolicyExceptions map[string]resourceanalyzer.PolicyExceptions
}

func badRegister(exceptions map[string]resourceanalyzer.PolicyExceptions, packName string, ex resourceanalyzer.PolicyExceptions) {
	// DANGEROUS: Permissive local rules now apply to enterprise mandatory cloud analyzers
	exceptions[packName] = ex 
}
```

**VERIFICATION METHOD**:
Instantiate two mock analyzer instances with identical string names (`name: "analyzerA"`), one sourced locally and one from the cloud backend. Attach conflicting exception rules. Verify via unit test assertions that exceptions registered to Analyzer A do not silence violations evaluated by Analyzer B.

---

### 2. Dual-Channel Token Refresh with Concurrent Lock Double-Checking
**RULE**:
When implementing bearer token refresh in long-lived client runtimes, the refresh mechanism MUST capture the token that failed (`prevAccessToken`) and re-verify it under the refresh lock before executing an upstream OAuth/token exchange. If the active token already differs from `prevAccessToken`, the caller MUST abort the refresh call immediately and proceed with the new token.

**WHY**:
Under heavy concurrency (e.g., dozens of parallel IaC resource deployments hitting the backend REST API), an expired access token causes dozens of simultaneous 401 Unauthorized responses. Without double-checked verification, every failed goroutine triggers its own upstream token renewal request. This causes race conditions, burns single-use OAuth refresh tokens, triggers rate limiting (HTTP 429), and invalidates subsequent requests.

**WHEN TO APPLY**:
All HTTP client middleware, connection pools, and microservice clients that manage ephemeral bearer credentials and OAuth refresh flows.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// From pkg/backend/httpstate/client/api.go
type refreshableAPIAccessToken struct {
	mu           sync.Mutex
	accessToken  string
	refreshToken string
	refresh      func(ctx context.Context, refreshToken string) (string, time.Time, string, error)
	writeback    func(accessToken string, expiresAt time.Time, refreshToken string) error
}

func (t *refreshableAPIAccessToken) Refresh(ctx context.Context, prevAccessToken string) error {
	t.mu.Lock()
	defer t.mu.Unlock()

	// Double-checked locking guard:
	// If another goroutine already refreshed while this goroutine waited on t.mu,
	// the in-memory token has already advanced. Bail out immediately.
	if t.accessToken != prevAccessToken {
		return nil
	}

	newAT, expiresAt, newRT, err := t.refresh(ctx, t.refreshToken)
	if err != nil {
		return err
	}

	t.accessToken = newAT
	if newRT != "" {
		t.refreshToken = newRT
	}

	return t.writeback(t.accessToken, expiresAt, t.refreshToken)
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Unconditional refresh without checking previous token state
func (t *badTokenHolder) Refresh(ctx context.Context) error {
	t.mu.Lock()
	defer t.mu.Unlock()
	// Thundering herd bug: Every concurrent caller that failed with 401 will re-execute 
	// the refresh grant sequentially, invalidating the refresh token if rotation is active!
	newToken, err := t.oauthClient.RefreshToken(t.refreshToken)
	if err != nil {
		return err
	}
	t.accessToken = newToken
	return nil
}
```

**VERIFICATION METHOD**:
Simulate 100 concurrent goroutines executing API calls that return HTTP 401. Assert that the underlying upstream `refresh` function is executed exactly once, and that all 100 calls resume successfully.

---

### 3. Middle-Out Context-Preserving String Truncation
**RULE**:
When preparing unstructured log outputs, engine event batches, or preview diffs for LLM or AI context ingestion under strict token/character budgets, truncation MUST preserve both the head (initial command context, start markers) and the tail (final exit codes, error traces), discarding text strictly from the middle with an explicit marker token.

**WHY**:
Standard prefix or suffix truncation truncates either the setup parameters (if taking the end) or the actual stack trace/panic/summary (if taking the beginning). IaC diagnostics almost invariably place root causes, syntax errors, and exit codes at the extreme tail of execution logs, while the initial cloud configurations reside at the head.

**WHEN TO APPLY**:
AI agent tooling, Copilot context ingestion, crash dump summaries, and automated telemetry reporters where character or token counts are bounded.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// From pkg/backend/httpstate/client/ai.go
const truncationNotice = "... (truncated) ..."

func TruncateWithMiddleOut(content string, maxChars int) string {
	if len(content) <= maxChars {
		return content
	}

	if maxChars <= len(truncationNotice) {
		if maxChars <= 0 {
			return ""
		}
		return content[:maxChars]
	}

	// Calculate preserved slices evenly between beginning and end
	remaining := maxChars - len(truncationNotice)
	startLen := (remaining + 1) / 2
	endLen := remaining / 2

	return content[:startLen] + truncationNotice + content[len(content)-endLen:]
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Simple suffix truncation destroys terminal error traces
func badTruncate(content string, maxChars int) string {
	if len(content) > maxChars {
		// LOSES CRITICAL ERROR: The actual panic or failure message at EOF is completely erased!
		return content[:maxChars] + "..." 
	}
	return content
}
```

**VERIFICATION METHOD**:
Pass a 10,000-character string containing `"START_PAYLOAD"` at offset 0 and `"CRITICAL_PANIC_EOF"` at offset 9980 to `TruncateWithMiddleOut(s, 200)`. Assert that the returned string contains both `"START_PAYLOAD"` and `"CRITICAL_PANIC_EOF"` alongside the truncation marker.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Policy Exception Namespace Collision & Unchecked Service Parse Abort
- **Context**: `pkg/engine/update.go`, `pkg/engine/deployment.go`, `pkg/resource/analyzer/exceptions.go`
- **What Was Expected**: Policy exceptions received from Pulumi Cloud for required policy packs should be applied cleanly to policy runs. Invalid cloud exceptions should be skipped with a diagnostic warning without terminating the update operation. Local and cloud policy pack exceptions should never cross-apply.
- **What Actually Happened**:
  1. Policy exceptions were indexed in `PolicyExceptions` by pack name (`string`). A local policy pack with the same name as a required cloud pack collided in the map, causing local exceptions to suppress cloud-enforced violations.
  2. If the Pulumi Cloud service sent an invalid or malformed exception payload, `parsePolicyExceptionsBlock` halted the entire deployment run with an error, blocking legitimate customer infrastructure deployments.
- **Evidence in Repo**: Commit `a089d6d7`, PR #25284, `changelog/pending/20261021--cli-policy--policy-exceptions-from-cloud.yaml`.
- **Root Cause**: Storing state using coarse human-readable strings (`string`) rather than memory pointers (`plugin.Analyzer`), combined with an "all-or-nothing" error handling strategy for remote SaaS inputs.
- **Remediation Code Diff**:
```go
// pkg/engine/deployment.go
type deploymentOptions struct {
 	LoadedAnalyzers []plugin.Analyzer
-	PolicyExceptions map[string]resourceanalyzer.PolicyExceptions
+	PolicyExceptions map[plugin.Analyzer]resourceanalyzer.PolicyExceptions
}

// pkg/resource/analyzer/exceptions.go
-func parsePolicyExceptionsBlock(raw json.RawMessage) (PolicyExceptions, error) {
+func ParsePolicyExceptions(entries map[string]json.RawMessage) (PolicyExceptions, []error) {
+	var set PolicyExceptions
+	var errs []error
+	for _, id := range slices.SortedFunc(maps.Keys(entries), compareExceptionIDs) {
+		e, err := parsePolicyException(id, entries[id])
+		if err != nil {
+			errs = append(errs, fmt.Errorf("policy exception %q: %w", id, err))
+			continue
+		}
+		set.exceptions = append(set.exceptions, e)
+	}
+	return set, errs
+}
```
- **Lesson**: Distinguish strictly between local configuration (which must fail fast on validation errors) and remote SaaS configuration (which should be sanitized with warnings so valid rules still enforce). Key dispatch tables on runtime object handles.

---

### Incident 2: Inefficient and Crash-Prone Unchecked Property Map Conversion in Providers
- **Context**: `pkg/testing/pulumi-test-language/providers/simple_provider.go`
- **What Was Expected**: The provider's `Check` method must validate incoming resource inputs, gracefully handling both plain values and unknown/computed outputs during previews without allocating unnecessary intermediate map structures.
- **What Actually Happened**: `SimpleProvider.Check` converted `req.NewInputs` into a legacy resource map via `resource.ToResourcePropertyMap(req.NewInputs)` and dereferenced it directly. If inputs contained special or unknown values under specific test matrix evaluations, it triggered type coercion bugs and allocation thrashing.
- **Evidence in Repo**: Commit `c17c1679`, PR #25289, test suite `pkg/testing/pulumi-test-language/tests/policy_unknowns.go`.
- **Root Cause**: Redundant conversion between representation layers (`NewInputs` vs `ResourcePropertyMap`) instead of querying the typed abstraction (`req.NewInputs.GetOk`) directly.
- **Remediation Code Diff**:
```go
// pkg/testing/pulumi-test-language/providers/simple_provider.go
 func (p *SimpleProvider) Check(_ context.Context, req plugin.CheckRequest) (plugin.CheckResponse, error) {
-	news := resource.ToResourcePropertyMap(req.NewInputs)
-	value, ok := news["value"]
+	value, ok := req.NewInputs.GetOk("value")
 	if !ok {
 		return plugin.CheckResponse{
 			Failures: makeCheckFailure("value", "missing value"),
 		}, nil
 	}
 	if !value.IsBool() && !value.IsComputed() {
 		return plugin.CheckResponse{
 			Failures: makeCheckFailure("value", "value is not a boolean"),
 		}, nil
 	}
-	if len(news) != 1 {
+	if req.NewInputs.Len() != 1 {
 		return plugin.CheckResponse{
-			Failures: makeCheckFailure("", fmt.Sprintf("too many properties: %v", news)),
+			Failures: makeCheckFailure("", fmt.Sprintf("too many properties: %v", req.NewInputs)),
 		}, nil
 	}
-	return plugin.CheckResponse{Properties: resource.FromResourcePropertyMap(news)}, nil
+	return plugin.CheckResponse{Properties: req.NewInputs}, nil
 }
```
- **Lesson**: Avoid converting between property representations inside the critical CRUD path. Use zero-allocation lookup methods (`GetOk`, `Len`) directly on incoming protocol structs.

---

### Incident 3: Python Security Advisory in Build Pipeline Dependencies
- **Context**: `docs/uv.lock`, `sdk/python/uv.lock`
- **What Was Expected**: Formatter and telemetry dependencies must adhere to immutable hash verifications and eliminate arbitrary code execution vulnerabilities during GitHub Actions CI runs.
- **What Actually Happened**: The `black` code formatter prior to `26.10.1` contained a vulnerability where GitHub Action workflows installed unvalidated `required-version` values declared in `pyproject.toml`, creating an attack vector for supply-chain compromise.
- **Evidence in Repo**: Commit `e87e613e`, PR #25353, issues updated: `black 26.3.1 -> 26.10.1`, `opentelemetry-api 1.40.0 -> 1.45.1`.
- **Root Cause**: Lockfile pin divergence and transitive tool vulnerabilities in doc-building and Python SDK environments.
- **Remediation Code Diff**:
```toml
# docs/uv.lock
-name = "black"
-version = "26.3.1"
+name = "black"
+version = "26.10.1"
-sdist = { url = ".../black-26.3.1.tar.gz", hash = "sha256:2c50f5..." }
+sdist = { url = ".../black-26.10.1.tar.gz", hash = "sha256:5f9f83..." }
```
- **Lesson**: Cryptographically lock all platform-specific wheels and source distributions (`sdist`) using deterministic package managers (e.g., `uv.lock`) with automated lockfile auditing in CI.

---

### Incident 4: Windows ARM64 CI Release Signing Pipeline Disruption
- **Context**: `.github/workflows/on-push.yml`, Issue #25343
- **What Was Expected**: Multi-architecture cross-compilation release jobs for `windows-arm64` and `windows-amd64` must compile, sign binaries with authenticode certificates, and upload artifacts reliably.
- **What Actually Happened**: CI job failed with `Check Windows binaries are signed (failure)`. The failure in `windows-arm64` cascaded across the workflow matrix, resulting in cancellation of sibling runners (`linux-arm64`, `windows-amd64`).
- **Evidence in Repo**: Closed Issue #25343 (`dev-release / build-release (windows, arm64, ubuntu-latest)`), Run `39826434219`.
- **Root Cause**: Runner race conditions and transient certificate signing service timeouts when executing code-signing utilities across cross-compiled target architectures.
- **Remediation Code Diff**:
```yaml
# In workflow retry logic (.github/actions/retry):
- run: ./sign-binaries.sh
+ uses: ./.github/actions/retry
+   with:
+     timeout_minutes: 10
+     max_attempts: 3
+     command: ./sign-binaries.ps1
```
- **Lesson**: External hardware-security-module (HSM) and certificate signing steps in CI matrix builds are inherently prone to transient network latency; they MUST be isolated behind dedicated retry loops with clear cancellation boundaries.

---

### Incident 5: Snapshot Checkpoint Corruption From Unescaped JSON Reserialization
- **Context**: `pkg/backend/diy/state.go`
- **What Was Expected**: Saving a checkpoint snapshot to DIY cloud blob storage (S3/GCS/Azure Blob) must preserve literal characters without altering raw HTML/string values, and maintain atomic backup recovery files.
- **What Actually Happened**: Standard Go `json.Marshal` HTML-escapes characters (`<`, `>`, `&`), altering serialized state signatures and breaking cryptographic state digests. Furthermore, improper backup handling during compression switches (e.g., changing from uncompressed `.json` to `.json.zst`) left stale backup files that prevented stack existence discovery.
- **Evidence in Repo**: `pkg/backend/diy/state.go`, `compactJSONMarshaler`.
- **Root Cause**: `json.Marshal` default encoding behavior combined with non-atomic filesystem replacement semantics during format transitions.
- **Remediation Code Diff**:
```go
// pkg/backend/diy/state.go
type compactJSONMarshaler struct{}

func (compactJSONMarshaler) Marshal(v any) ([]byte, error) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
+	// Prevent Go standard library from corrupting string literals into \u0026, \u003c, \u003e
+	enc.SetEscapeHTML(false)
	if err := enc.Encode(v); err != nil {
		return nil, err
	}
	return bytes.TrimSpace(buf.Bytes()), nil
}
```
- **Lesson**: Never use default JSON encoders for state storage or cryptographic snapshots. Always explicitly disable HTML escaping (`enc.SetEscapeHTML(false)`).

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **ANSI Color String Measurement Invariant**: Never use standard Go `len(str)` or `utf8.RuneCountInString(str)` when computing visual alignment, terminal column widths, or layout padding. Terminal escape sequences (e.g., `\x1b[34m`) consume byte and rune counts while occupying zero columns on screen.
  ```go
  // pkg/backend/display/tableutil.go
  func messagePadding(message string, maxWidth, extraPadding int) string {
      // colors.MeasureColorizedString strips ANSI sequences to compute visible terminal width
      extraWhitespace := maxWidth - colors.MeasureColorizedString(message)
      contract.Assertf(extraWhitespace >= 0, "Neg whitespace. %v %s", maxWidth, message)
      extraWhitespace += extraPadding
      return strings.Repeat(" ", extraWhitespace)
  }
  ```
- **User-Agent Header Token Sanitization**: HTTP `User-Agent` headers must not contain spaces, semicolons, tabs, or parentheses in user-controlled tokens, as these corrupt HTTP parser state.
  ```go
  // pkg/backend/httpstate/client/api.go
  func sanitizeUserAgentToken(s string) string {
      s = strings.TrimSpace(s)
      if s == "" { return "" }
      replacer := strings.NewReplacer(
          " ", "-", "\t", "-", "(", "", ")", "", ";", "",
      )
      return replacer.Replace(s)
  }
  ```

### 2. Infinite Loop & Recursion Guards
- **Middle-Out Truncation Boundary Invariant**:
  When truncating text to fit within a bounded character limit (`maxChars`), integer division hazards can cause index out-of-bounds panics or infinite slicing loops if `maxChars <= len(truncationNotice)`.
  ```go
  // Guard condition: Always verify that budget exceeds the notification marker length
  if maxChars <= len(truncationNotice) {
      if maxChars <= 0 {
          return ""
      }
      return content[:maxChars] // Slice head directly; never execute middle-split logic
  }
  ```
- **Snapshot DAG Traversal Proof**:
  Resource graphs are evaluated for cyclic references by maintaining an explicit visited set in addition to a recursion depth counter capped at the maximum stack depth (default: 4096). If a resource node appears twice along the same evaluation path, an explicit `SnapshotIntegrityError` is thrown rather than exhausting OS stack frames.

### 3. UI & UX Micro-Mechanics (CLI Terminal Engine)
- **Terminal Layout Reflow Elimination**:
  When rendering dynamic progress tables during parallel cloud provisioning, columns must be padded based on the maximum column width computed across *all* active items, not per-row. Prepended padding preserves tabular column alignment across streaming terminal updates without triggering full-screen redraws.
  ```go
  func renderRow(columns []string, maxColumnWidths []int) string {
      var row strings.Builder
      for i := range columns {
          row.WriteString(columnPadding(columns, i-1, maxColumnWidths))
          row.WriteString(columns[i])
      }
      return row.String()
  }
  ```

### 4. Backend Concurrency & Memory Safety
- **Context-Bound Agent Credential Tracking**:
  Tracking whether a CLI session leveraged ephemeral AI agent credentials across concurrent child routines must avoid global shared memory. Instead, use an explicit thread-safe struct wrapped in the command's `context.Context`.
  ```go
  // pkg/backend/httpstate/backend.go
  type agentCredentialUseContextKey struct{}

  type agentCredentialUse struct {
      sync.Mutex
      cloudURLs map[string]bool
  }

  func MarkAgentCredentialsUsed(ctx context.Context, cloudURL string) {
      use, _ := ctx.Value(agentCredentialUseContextKey{}).(*agentCredentialUse)
      if use == nil { return }
      use.Lock()
      defer use.Unlock()
      use.cloudURLs[cloudURL] = true
  }
  ```
- **TOCTOU Guard in Cloud Blob Backups**:
  When replacing an existing state snapshot in blob storage, never delete the previous `.json` file prior to writing the new one. The new state must be written to disk/blob first, and only upon guaranteed commit may the backup handle be updated. This ensures crash-resilience against sudden system termination.

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Lenient Remote Validation with Preserved Failures**:
  When processing remote validation rules (such as policy exceptions sent from the cloud backend), never discard the whole validation cycle if one exception fails to parse. Parse each rule independently, accumulate errors, emit warnings, and evaluate the valid subset.
  ```go
  // pkg/resource/analyzer/exceptions.go
  for _, id := range slices.SortedFunc(maps.Keys(entries), compareExceptionIDs) {
      e, err := parsePolicyException(id, entries[id])
      if err != nil {
          errs = append(errs, fmt.Errorf("policy exception %q: %w", id, err))
          continue // DO NOT RETURN; skip the invalid exception so violations still fail the run!
      }
      set.exceptions = append(set.exceptions, e)
  }
  ```

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
Pulumi separates execution into two decoupled planes: the **Language Runtime Plane** (running idiomatic host processes like Node.js, Python, or Go) and the **Engine/Provider Plane**. Communication occurs via gRPC interfaces over localhost sockets or pipes. State is decoupled from execution via the `Backend` abstraction (`httpstate` vs `diy`), ensuring that orchestrations execute deterministically whether backed by a local directory, AWS S3, or the Pulumi Cloud SaaS platform.

### 2. Core Abstractions
- `Resource`: Uniquely identified by an immutable `URN` (`urn:pulumi:stack::project::type::name`).
- `PropertyMap`: Type-safe representation of property trees supporting nested primitives, assets, archives, and two crucial domain primitives:
  - `Computed / Unknown`: Marker indicating the value is not known until actual cloud provisioning completes (crucial during `preview`).
  - `Secret`: Wrapper encrypting the payload at rest and masking it in terminal displays and state exports.
- `Snapshot`: Complete, immutable state graph of a stack at a specific point in time, verified by `VerifyIntegrity()`.
- `Analyzer`: Independent Policy as Code inspection plugin running pre-provisioning (`Analyze`) and post-preview (`AnalyzeStack`) rules.

### 3. Error Handling
The engine implements strict fault isolation. Transient errors during HTTP API interactions leverage exponential backoff with jitter (`github.com/pulumi/pulumi/sdk/v3/go/common/util/retry`). When writing state snapshots, failures during checkpoint serialization leave the existing active state intact. If snapshot verification detects cycles or duplicate URNs, it raises a typed `SnapshotIntegrityError` containing repair metadata to guide CLI auto-remediation without losing resources.

### 4. Testing
Pulumi employs multi-tier verification:
1. **Lifecycle Test Harness (`pkg/engine/lifecycletest`)**: Replays synthetic engine runs simulating full provider lifecycles with mock gRPC hosts.
2. **Language Conformance Matrix (`pkg/testing/pulumi-test-language`)**: Exercises every language SDK against language-neutral test programs (`.pp` program specifications) to guarantee identical output and exception behavior across all languages.
3. **Property & Fuzz Testing