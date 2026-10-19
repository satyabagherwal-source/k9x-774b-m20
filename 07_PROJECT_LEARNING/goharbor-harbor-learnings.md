> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/goharbor-harbor-learnings.md`  
> **Source**: github ([https://github.com/goharbor/harbor](https://github.com/goharbor/harbor))  
> **Source Version**: `9e79066f`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-19T08:06:56.926Z  
> **Learning ID**: `learn-github-goharbor-harbor`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): goharbor/harbor

---

## 1. Executive Forensic Architecture & System Mechanics

Harbor is a CNCF-graduated enterprise-class cloud-native artifact registry extending the OCI Distribution specification with role-based access control (RBAC), multi-tenant isolation, policy-based replication, asynchronous vulnerability/SBOM scanning, and cryptographic signing.

```
                              +---------------------------------------+
                              |         Ingress / Envoy / NGINX       |
                              +---------------------------------------+
                                                  |
                     +----------------------------+----------------------------+
                     |                                                         |
                     v                                                         v
          +--------------------+                                    +--------------------+
          |    harbor-core     | <-------- [Token Exchange] -------> |  distribution/v2   |
          |  (RBAC/Auth/API)   |                                    | (OCI Registry Svc) |
          +--------------------+                                    +--------------------+
            |        |      |                                                  ^
            |        |      +---------------------+                            |
            |        |                            |                            |
            v        v                            v                            |
    +-----------+ +------------+       +--------------------+                  |
    | PostgreSQL| | Redis K-V  |       | harbor-jobservice  | -----------------+
    | (Metadata)| | (Job/Sess) |       | (Async Tasks/Cron) |  (Replication/GC/Scan Dispatch)
    +-----------+ +------------+       +--------------------+
                                                  |
                                                  v
                                       +--------------------+
                                       |  Scanner Adapters  |
                                       |   (Trivy, etc.)    |
                                       +--------------------+
```

### Architectural Subsystem Boundaries & Invariants
1. **harbor-core (API Gateway & Control Plane)**: Owns metadata persistence (PostgreSQL via beego ORM / sqlx), user identity (DB, LDAP, OIDC), project-level tenancy, robot account delegation, and issuance of ephemeral RS256/ECDSA JWT tokens to Docker/OCI clients via the `/service/token` endpoint. Core mediates all write actions to ensure quota enforcement before blob allocation.
2. **registry (Data Plane Engine)**: An upstream Docker Distribution registry instance backed by storage drivers (Filesystem, S3, GCS, Azure Blob, Swift, OSS). It enforces content-addressable storage through digest verification (`sha256:...`). Read and write requests carry bearer tokens minted by `harbor-core`.
3. **harbor-jobservice (Execution Engine & Orchestration)**: An asynchronous job execution subsystem running on top of Redis queues (using gocraft/work abstractions and custom periodic dispatchers). It controls long-running tasks: replication (pull/push sync with external registries like AWS ECR, Docker Hub, Quay), garbage collection (sweeping unreferenced manifests and orphan blobs), and vulnerability scan execution.
4. **Data Isolation Invariant**: Multi-tenancy in Harbor is strictly project-scoped. While blob storage is deduplicated globally by content digest across the data plane, logical access (scans, deletions, tag mutability, retention policies) must map strictly to the scoped relational database `artifact.ID` and `project.ID` to prevent cross-tenant contamination.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Verification of Temporal Reachability for Disjoint Cron Specifications
**RULE**:
Any parser validating a multi-field cron expression MUST NOT rely solely on independent field-syntax parsing. The system MUST compute a forward reachability projection across a complete calendar cycle (for the Gregorian calendar: 400 years / 146,097 days) before persisting or scheduling the spec. Furthermore, all scheduling loops stepping forward with `schedule.Next(t)` MUST explicitly check `!t.IsZero()` and terminate execution immediately if a zero-value timestamp is returned.

**WHY**:
Standard cron parsers (such as `robfig/cron`) validate field grammars orthogonally. Expressions like `0 0 3 30 2 *` (Feb 30) or `0 0 0 31 4 *` (April 31) pass syntax parsing because `30 <= 31` and `2 <= 12`. When executing `schedule.Next(now)`, the library searches within a finite forward horizon (typically 5 years). Finding no match, it returns Go’s zero value `time.Time{}` (Unix epoch `-62135596800`). An iteration loop `for t := schedule.Next(now); t.Before(horizon); t = schedule.Next(t)` encounters an immediate condition failure: `time.Time{}` is always before any current or future horizon. The loop advances with `t = schedule.Next(time.Time{})`, which repeatedly fails to match and returns `time.Time{}`, triggering an unyielding 100% CPU lockup and thread starvation.

**WHEN TO APPLY**:
Apply in any distributed task scheduler, asynchronous worker, cron runner, or API input validation layer written in Go, Rust, Java, or C++ where cron strings configure automated background jobs.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
package cronutil

import (
	"fmt"
	"time"
	"github.com/robfig/cron/v3"
)

// StandardParser returns a 6-field parser (Seconds, Minutes, Hours, Dom, Month, Dow).
func StandardParser() cron.Parser {
	return cron.NewParser(cron.Second | cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
}

// IsCronReachable proves the cron schedule fires at least once within a 400-year Gregorian cycle.
// Robfig/cron searches at most 5 years forward per Next() invocation. Probing in 80 consecutive
// 5-year intervals ensures valid, rare dates (e.g. leap year February 29 bridging non-leap century
// years like 2100) are not falsely marked unreachable, while mathematically impossible specs return false.
func IsCronReachable(schedule cron.Schedule) bool {
	// 2000 was a 400-year leap century; provides an ideal reference base.
	base := time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC)
	for i := 0; i < 80; i++ {
		next := schedule.Next(base)
		if !next.IsZero() {
			return true
		}
		base = base.AddDate(5, 0, 0)
	}
	return false
}

// SafeNextOccurrences gathers scheduled fire times between 'from' and 'horizon' without infinite spin risk.
func SafeNextOccurrences(schedule cron.Schedule, from, horizon time.Time) ([]time.Time, error) {
	if !IsCronReachable(schedule) {
		return nil, fmt.Errorf("cron schedule is unreachable; will never fire")
	}

	var occurrences []time.Time
	// Invariant: Guard against both zero-time and horizon overflow
	for t := schedule.Next(from); !t.IsZero() && t.Before(horizon); t = schedule.Next(t) {
		occurrences = append(occurrences, t)
	}
	return occurrences, nil
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Field parsing without cross-field calendar reachability verification
func ScheduleTaskUnsafe(spec string, horizon time.Time) error {
	p := cron.NewParser(cron.Second | cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
	sched, err := p.Parse(spec) // Returns nil error for "0 0 3 30 2 *"
	if err != nil {
		return err
	}
	// CRITICAL BUG: When sched.Next returns time.Time{}, time.Time{}.Before(horizon) is TRUE.
	// Next(time.Time{}) returns time.Time{}, causing an infinite busy spin locking an OS thread.
	for t := sched.Next(time.Now()); t.Before(horizon); t = sched.Next(t) {
		enqueue(t)
	}
	return nil
}
```

**VERIFICATION METHOD**:
Run property-based boundary testing passing impossible dates (`Feb 30`, `April 31`, `Feb 29 on non-leap years`) and rare valid dates (`Feb 29 across leap century`). Ensure impossible dates return validation errors upon submission and the loop returns in `< 5ms`.
```go
func TestCronSafetyInvariants(t *testing.T) {
	parser := StandardParser()
	impossible := "0 0 3 30 2 *"
	sched, err := parser.Parse(impossible)
	require.NoError(t, err)
	assert.False(t, IsCronReachable(sched), "Feb 30 must be unreachable")

	// Ensure SafeNextOccurrences terminates immediately
	done := make(chan struct{})
	go func() {
		_, _ = SafeNextOccurrences(sched, time.Now(), time.Now().Add(24*time.Hour))
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(500 * time.Millisecond):
		t.Fatal("Deadlock or infinite loop detected: failed to terminate on unreachable cron")
	}
}
```

---

### 2. Request-Origin Anchored Location Redirection Invariant
**RULE**:
When an HTTP client executes chunked or multi-step uploads where subsequent operations depend on an upstream `Location` response header, the client MUST validate that the target URI shares the exact scheme, host, and port of the *effective answering request* (`resp.Request.URL`), NOT the initially configured static endpoint. Cross-origin responses, scheme-downgrades, network-path references (`//attacker.com`), and userinfo credentials (`user:pass@host`) MUST fail closed.

**WHY**:
Modern cloud registries (e.g., AWS ECR, GCP Artifact Registry) use request authorizers or regional API gateways that dynamically rewrite target hosts (e.g., rewriting `https://api.ecr.<region>.amazonaws.com` to `https://<account>.dkr.ecr.<region>.amazonaws.com`). Validating `Location` against the static endpoint causes valid uploads to break. Conversely, blindly trusting upstream `Location` headers allows an upstream registry (or a MitM on an unpinned endpoint) to inject arbitrary absolute URIs. When the client executes subsequent `PATCH`/`PUT` requests, it sends binary data alongside sensitive authorization credentials (`Authorization: Basic ...` or `Bearer ...`) to internal cloud metadata endpoints (`http://169.254.169.254`) or malicious hosts (CWE-918 SSRF and Credential Exfiltration).

**WHEN TO APPLY**:
Apply to all HTTP clients handling chunked uploads, OCI registry replication clients, multipart S3-compatible adapters, and webhook dispatch engines following HTTP 307/308 redirects or OCI distribution `Location` mechanics.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
package httputil

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

// SameOrigin verifies both URLs share identical scheme, hostname, and explicit port.
func SameOrigin(a, b *url.URL) bool {
	if a == nil || b == nil {
		return false
	}
	return strings.EqualFold(a.Scheme, b.Scheme) &&
		strings.EqualFold(a.Hostname(), b.Hostname()) &&
		a.Port() == b.Port()
}

// ResolveUploadLocation validates a Location header against the effective request origin.
func ResolveUploadLocation(effectiveReqURL *url.URL, rawLocation string) (*url.URL, error) {
	if strings.TrimSpace(rawLocation) == "" {
		return nil, fmt.Errorf("empty upload location received from server")
	}

	loc, err := url.Parse(rawLocation)
	if err != nil {
		return nil, fmt.Errorf("malformed location header %q: %w", rawLocation, err)
	}

	// Reject network-path references (//host/path) lacking explicit scheme
	if strings.HasPrefix(rawLocation, "//") {
		return nil, fmt.Errorf("protocol-relative network-path references are strictly forbidden")
	}

	// Reject userinfo smuggling within Location headers
	if loc.User != nil {
		return nil, fmt.Errorf("userinfo is prohibited in upload location")
	}

	// Relative URLs resolve against the answering origin
	if !loc.IsAbs() {
		return effectiveReqURL.ResolveReference(loc), nil
	}

	// Absolute URLs MUST share the exact origin of the request that produced the response
	if !SameOrigin(effectiveReqURL, loc) {
		return nil, fmt.Errorf("cross-origin location %q rejected; does not match origin %q",
			loc.Redacted(), effectiveReqURL.Redacted())
	}

	return loc, nil
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Blindly trusting upstream Location headers or validating against static endpoints
func UploadNextChunkUnsafe(configuredEndpoint string, resp *http.Response, chunk []byte) error {
	nextLoc := resp.Header.Get("Location")
	// Fatal Flaw 1: Validating against configuredEndpoint breaks reverse proxies/ECR host rewrites.
	// Fatal Flaw 2: Using nextLoc directly sends Authorization headers to any host specified in Location.
	req, _ := http.NewRequest("PATCH", nextLoc, bytes.NewReader(chunk))
	req.Header.Set("Authorization", "Bearer secret-token")
	_, err := http.DefaultClient.Do(req) // SSRF: Attacker exfiltrates bearer token to their server
	return err
}
```

**VERIFICATION METHOD**:
Implement a mock upstream server returning a `Location: http://169.254.169.254/latest/meta-data/` on the second chunk of an upload. Assert that the client throws an `origin mismatch` error, does not perform the subsequent request, and does not leak credentials.

---

### 3. Identity vs. Content-Address Scoping Invariant for State Mutations
**RULE**:
Any mutation or cancellation operation targeting an artifact (e.g., stopping a scan, triggering retention, pruning tags) MUST scope database queries by the entity's immutable Surrogate Primary Key (`artifact.ID`), NOT by its content digest (`artifact.Digest`). Content digests MUST NOT serve as tenant-isolation boundaries.

**WHY**:
Container images, manifests, and blobs in an OCI registry are content-addressable: two distinct tenants uploading an identical base image (e.g., `alpine:latest` or `golang:1.24`) produce identical SHA256 digests. If an operation (such as `/api/v2.0/projects/{project}/repositories/{repo}/artifacts/{digest}/scan/stop`) resolves backend execution tasks using `WHERE digest = ?`, a malicious or low-privileged user in Tenant A can cancel, modify, or abort active security scans running on Tenant B’s repository. This creates a cross-tenant Availability denial-of-service and blind-spot exploit (CWE-284 / CWE-639).

**WHEN TO APPLY**:
Apply across all multi-tenant storage, registry, or processing architectures where underlying payloads are deduplicated via cryptographic hashes.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
package control

import (
	"context"
	"fmt"
)

type ExecutionQuery struct {
	VendorType string
	VendorID   int64  // Bound to the relational DB ID
	ScopedAttr string
}

type Artifact struct {
	ID             int64  // Immutable Surrogate Primary Key
	ProjectID      int64  // Multi-tenant boundary
	Digest         string // Content hash
	RepositoryName string
}

// StopScan safely halts an in-flight vulnerability scan strictly bounded to the calling tenant's artifact.
func (bc *ExecutionController) StopScan(ctx context.Context, art *Artifact, capType string) error {
	if art == nil {
		return fmt.Errorf("artifact cannot be nil")
	}

	// Invariant: Bind query strictly to art.ID (Surrogate PK), never solely to art.Digest
	query := ExecutionQuery{
		VendorType: "IMAGE_SCAN",
		VendorID:   art.ID,
		ScopedAttr: fmt.Sprintf("%d", art.ID),
	}

	executions, err := bc.execMgr.List(ctx, query)
	if err != nil {
		return fmt.Errorf("failed listing executions: %w", err)
	}

	if len(executions) == 0 {
		return fmt.Errorf("no active scan job for artifact %s (id=%d)", art.RepositoryName, art.ID)
	}

	return bc.execMgr.Stop(ctx, executions[0].ID)
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Using global content digest to query stateful job executions
func StopScanVulnerable(ctx context.Context, art *Artifact) error {
	// BUG: Querying by Digest matches all tenants that hold an identical image layer/manifest.
	// Tenant A can abort scanning on Tenant B's private deployment!
	query := map[string]string{
		"artifact_digest": art.Digest,
	}
	execs, _ := listExecutions(ctx, query)
	return stopExecution(ctx, execs[0].ID)
}
```

**VERIFICATION METHOD**:
Seed two projects (`project-alpha`, `project-beta`) with identical image digests (`sha256:e3b0c442...`) but distinct IDs (`ID: 101`, `ID: 102`). Start scans for both. Issue a `StopScan` request under `project-alpha`. Assert via test mocks that the execution list query explicitly asserts `vendor_id == 101` and that Project Beta's execution remains in the `Running` state.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Unreachable Cron Specification Triggers JobService CPU Starvation (BUG-HARBOR-01)
- **Context**: `src/jobservice/period/enqueuer.go`, `src/common/utils/utils.go`, `src/jobservice/period/basic_scheduler.go`
- **What Was Expected**: Providing an invalid or impossible cron expression (such as `0 0 3 30 2 *` — February 30) should be rejected during request validation. When parsed by the periodic scheduler, the scheduler must identify that the job cannot fire and refrain from spinning.
- **What Actually Happened**: `robfig/cron/v3` validated each field independently. Because day 30 is between 1-31 and month 2 is between 1-12, parsing succeeded. Calling `schedule.Next(t)` returned `time.Time{}` (the Go zero value) because the date never exists within the library's 5-year lookahead window. In `scheduleNextJobs`, the enqueuer executed:
  `for t := schedule.Next(nowTime); t.Before(horizon); t = schedule.Next(t)`
  Since `time.Time{}` represents year 0001, `t.Before(horizon)` evaluated to `true`. Next was repeatedly called with `time.Time{}`, which returned `time.Time{}`. This caused an infinite CPU-bound busy-spin, starving the Go runtime scheduler. Additionally, any dirty jobs stored in Redis with `time.Time{}.Unix()` had negative epoch scores (`-62135596800`), evading cleanup because `clearDirtyJobs` had a hardcoded minimum score bound of `0`.
- **Evidence in Repo**: Commit `bcea998e`. Fixes Issue #23924.
- **Root Cause**: Reliance on orthogonal syntax parsing without semantic Gregorian calendar reachability checking, missing zero-value loop termination guards, and an off-by-domain lower-bound assumption (`0` instead of `math.MinInt64`) in Redis ZSET score queries.
- **Remediation Code Diff**:
```go
--- a/src/jobservice/period/enqueuer.go
+++ b/src/jobservice/period/enqueuer.go
@@ -167,7 +168,13 @@ func (e *enqueuer) scheduleNextJobs(p *Policy, conn redis.Conn) {
 	} else {
-		for t := schedule.Next(nowTime); t.Before(horizon); t = schedule.Next(t) {
+		if schedule.Next(nowTime).IsZero() {
+			e.lastEnqueueErr = fmt.Errorf("cron expression %q has no occurrence within the cron search window", p.CronSpec)
+			logger.Warningf("Skipping periodic policy %s (%s): cron expression %q has no occurrence", p.ID, p.JobName, p.CronSpec)
+			return
+		}
+		for _, t := range fireTimes(schedule, nowTime, horizon) {
 			epoch := t.Unix()
@@ -310,3 +317,16 @@ func cloneParameters(params job.Parameters, epoch int64) job.Parameters {
+func fireTimes(schedule cron.Schedule, from, horizon time.Time) []time.Time {
+	var times []time.Time
+	for t := schedule.Next(from); !t.IsZero() && t.Before(horizon); t = schedule.Next(t) {
+		times = append(times, t)
+	}
+	return times
+}
--- a/src/jobservice/period/basic_scheduler.go
+++ b/src/jobservice/period/basic_scheduler.go
@@ -218,7 +219,10 @@ func (bs *basicScheduler) clearDirtyJobs() {
 	nowEpoch := time.Now().Unix()
 	scope := nowEpoch - int64(enqueuerHorizon/time.Minute)*60
 
-	jobScores, err := rds.GetZsetByScore(conn, rds.RedisKeyScheduled(bs.namespace), []int64{0, scope})
+	// Use math.MinInt64 as lower bound to clean up negative-epoch entries
+	// left by versions before the unreachable-cron fix, where
+	// time.Time{}.Unix() was used as the ZADD score.
+	jobScores, err := rds.GetZsetByScore(conn, rds.RedisKeyScheduled(bs.namespace), []int64{math.MinInt64, scope})
```
- **Lesson**: Parsers of complex domain languages must be verified using semantic evaluation, not just lexical token validity. Scheduling iteration loops must treat zero-value primitives as fatal termination indicators.

---

### Incident 2: Cross-Tenant Scan-Stop Authorization Bypass via Global Digest Lookup (BUG-HARBOR-02)
- **Context**: `src/controller/scan/base_controller.go`
- **What Was Expected**: Stopping a vulnerability scan on a container artifact in Project A should only locate and terminate execution tasks bound directly to Project A’s artifact.
- **What Actually Happened**: The `Stop` handler retrieved active task executions using a filter containing `"extra_attrs.artifact.digest": artifact.Digest`. Because artifact digests are content-addressable and identical across projects when images share common base layers or binaries, a low-privileged user in one project could submit a stop-scan request that matched and terminated an active scan running in another tenant’s private project.
- **Evidence in Repo**: Commit `5c885152`, PR #23948.
- **Root Cause**: Using global, non-unique content hashes (`artifact.Digest`) instead of tenant-isolated relational surrogate keys (`artifact.ID`) for filtering background executions in the shared job database.
- **Remediation Code Diff**:
```go
--- a/src/controller/scan/base_controller.go
+++ b/src/controller/scan/base_controller.go
@@ -369,14 +369,19 @@ func (bc *basicController) Stop(ctx context.Context, artifact *ar.Artifact, capT
 		return errors.New("nil artifact to stop scan")
 	}
 	vendorType := sca.GetScanHandler(capType).JobVendorType()
-	query := q.New(q.KeyWords{"vendor_type": vendorType, "extra_attrs.artifact.digest": artifact.Digest, "extra_attrs.enabled_capabilities.type": capType})
+	query := q.New(q.KeyWords{
+		"vendor_type":                           vendorType,
+		"vendor_id":                             artifact.ID,
+		"extra_attrs.artifact.id":               fmt.Sprintf("%d", artifact.ID),
+		"extra_attrs.enabled_capabilities.type": capType,
+	})
 	executions, err := bc.execMgr.List(ctx, query)
 	if err != nil {
 		return err
 	}
 
 	if len(executions) == 0 {
-		return errors.BadRequestError(nil).WithMessagef("no scan job for artifact digest=%v", artifact.Digest)
+		return errors.BadRequestError(nil).WithMessagef("no scan job for artifact %s (id=%d)", artifact, artifact.ID)
 	}
```
- **Lesson**: Content-addressable hashes must never double as multitenant execution identifiers. Always bind background tasks to unique database surrogate primary keys.

---

### Incident 3: ECR Replication Push Broken by Static Endpoint Location Validation (BUG-HARBOR-03)
- **Context**: `src/pkg/registry/client.go`
- **What Was Expected**: Harbor's replication client, while pushing blobs to AWS Elastic Container Registry (ECR) via chunked upload, must accept the `Location` header returned by AWS while rejecting arbitrary external endpoints to prevent SSRF and credential leaks.
- **What Actually Happened**: A previous security patch addressing GHSA-wjpm-hv5w-gxr6 enforced that any `Location` header returned during chunk uploads must match the static endpoint configured in the replication adapter (`c.url`). AWS ECR is configured with `https://api.ecr.<region>.amazonaws.com`, but the ECR authentication flow rewrites the host dynamically to `https://<account>.dkr.ecr.<region>.amazonaws.com`. When ECR returned its upload `Location`, Harbor’s client compared it against `api.ecr...`, failed the origin check, and aborted all push replications to AWS with `resolves to a different origin`.
- **Evidence in Repo**: Commit `c3295905`, PR #24113.
- **Root Cause**: Validating dynamic HTTP session headers against a stale, static configuration URL instead of the actual `req.URL` of the request that elicited the response after authorizers and middleware had executed.
- **Remediation Code Diff**:
```go
--- a/src/pkg/registry/client.go
+++ b/src/pkg/registry/client.go
@@ -513,11 +521,34 @@ func (c *client) initiateBlobUpload(repository string) (string, string, error) {
 	defer resp.Body.Close()
-	return resp.Header.Get("Location"), resp.Header.Get("Docker-Upload-UUID"), nil
+	location, err := c.uploadLocation(req, resp)
+	if err != nil {
+		return "", "", err
+	}
+	return location, resp.Header.Get("Docker-Upload-UUID"), nil
+}
+
+// uploadLocation returns the upload Location header of resp resolved to an absolute URL.
+// The origin is the URL the request was sent to; when the HTTP client followed
+// redirects, the final request URL is used so that relative values resolve against the URL that
+// actually answered. A redirect that moved to a different origin is rejected.
+func (c *client) uploadLocation(req *http.Request, resp *http.Response) (string, error) {
+	location := resp.Header.Get("Location")
+	if location == "" {
+		return "", nil
+	}
+	origin := req.URL
+	if resp.Request != nil && resp.Request.URL != nil {
+		if !sameRegistryOrigin(origin, resp.Request.URL) {
+			return "", fmt.Errorf("registry upload response redirected to a different origin than %q", origin.Redacted())
+		}
+		origin = resp.Request.URL
+	}
+	return resolveUploadLocation(c.url, origin, location)
 }
```
- **Lesson**: Security validations in multi-stage network protocols must authenticate against the dynamic, effective answering boundary rather than static initialization configurations, while preventing cross-origin escalation.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Time Epoch Negative Precision**: In Go, `time.Time{}` (the zero value) has an internal representation of `January 1, year 1, 00:00:00 UTC`. Calling `.Unix()` yields `-62135596800`. When persisting timestamps to Redis Sorted Sets (ZSET) where scores are signed 64-bit floating point numbers or integers:
  ```go
  // WRONG: Ignores negative epoch entries, leaving zombie records in Redis
  rds.GetZsetByScore(conn, key, []int64{0, scope})

  // CORRECT: Explicitly includes the full negative range of int64
  rds.GetZsetByScore(conn, key, []int64{math.MinInt64, scope})
  ```
- **Redacted URL Formatting in Logs**: Never log `*url.URL` directly using `%s` or `%v`, as embedded user credentials (`http://user:password@host`) will leak to log aggregators. Always invoke `.Redacted()`:
  ```go
  // INVARIANT: Redact before formatting
  logger.Errorf("Failed contacting registry at %s", targetURL.Redacted())
  ```

### 2. Infinite Loop & Recursion Guards
- **Robfig Cron Five-Year Search Horizon Trap**: The library `robfig/cron/v3` enforces a maximum forward lookahead of 5 years. If a valid schedule fires less frequently (e.g. Feb 29 leap years spanning century non-leap years such as 2096 to 2104 — an 8-year gap), `schedule.Next(t)` returns `time.Time{}`.
- **The Termination Proof**: Any loop dependent on `schedule.Next()` MUST check both `.IsZero()` and the time horizon:
  ```go
  // PROOF OF TERMINATION INVARIANT:
  // Let H be horizon, S be cron schedule, T_0 be current time.
  // Loop condition: !t.IsZero() && t.Before(H)
  // Termination guaranteed because:
  // 1. If S matches, t strictly advances: t_{n+1} > t_n. Since H is finite, t >= H in finite steps.
  // 2. If S cannot match within 5 years, t = time.Time{}, !t.IsZero() evaluates to false immediately.
  for t := schedule.Next(from); !t.IsZero() && t.Before(horizon); t = schedule.Next(t) {
      times = append(times, t)
  }
  ```

### 3. UI & UX Micro-Mechanics
- **E2E DOM Selector Stability**: In test automation (e.g. Robot Framework / Playwright), relying on brittle layout-dependent XPath locators (e.g. `//div[2]/form/div[1]/input`) breaks on subtle DOM refactoring.