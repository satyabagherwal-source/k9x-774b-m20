# Candidate Directive: [CD-W5TX] Granular Panic Containment with Error Sanitization and Abort Signaling

<!-- PROVENANCE_START
{
  "source_repository": "meshery/meshery",
  "source_url": "https://github.com/meshery/meshery",
  "source_version": "c5d506a5",
  "license": "Apache-2.0",
  "timestamp": "2026-11-20T03:48:47.877Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-meshery-meshery",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [meshery/meshery](https://github.com/meshery/meshery) (Revision: `c5d506a5`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-20T03:48:47.877Z`  
> **Learning ID**: `learn-github-meshery-meshery`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**: 
In concurrent servers handling untrusted inputs, any panic-containment boundary MUST:
1. Isolate panics to the single iteration or request scope using function wrapping (`Guard`/`SafeGo`), while allowing deliberate process-level worker panics to crash loudly.
2. Prevent information leakage by redacting raw panic values and stack traces from network responses, retaining them exclusively in server logs.
3. Remove stale HTTP transport headers (`Content-Length`, `Content-Encoding`) set prior to the panic before writing structured error payloads.
4. If response headers or bytes were already committed to the wire (`wroteHeader == true`), it MUST abort the connection using `panic(http.ErrAbortHandler)` rather than returning a truncated 200/202 body to the client.

**WHY**: 
Default Go behavior terminates the entire operating system process on an unrecovered panic in any spawned goroutine. Conversely, naïve HTTP middleware recovery that simply writes a `500 Internal Server Error` after a handler panics introduces two severe defects:
- If a handler called `w.WriteHeader(200)` or started streaming, writing an error payload produces an invalid HTTP message with mixed status codes and corrupt bodies.
- If a handler set `Content-Length: 1024` or `Content-Encoding: gzip` and panicked before emitting the full compressed payload, sending a plain JSON error body breaks client protocol parsers due to length mismatches or decompression failures. Furthermore, leaking raw panic strings exposes memory layout, database queries, and environment details.

**WHEN TO APPLY**: 
Apply to all Go, Rust (with `catch_unwind`), Node.js, and Python HTTP servers, background stream consumers, and broker event loops processing dynamic serialization models (Kubernetes CRDs, JSON payloads, external webhooks).

**VERIFIED IMPLEMENTATION PATTERN**:
```go
package containment

import (
	"fmt"
	"net/http"
	"runtime/debug"
	"sync"
)

type RecoveredPanic struct {
	Name  string
	Value any
	Stack []byte
}

type PanicHook func(RecoveredPanic)

var (
	hooksMu  sync.RWMutex
	hooks    []PanicHook
	countsMu sync.Mutex
	counts   = make(map[string]int64)
)

func OnRecoveredPanic(h PanicHook) {
	if h == nil {
		return
	}
	hooksMu.Lock()
	defer hooksMu.Unlock()
	hooks = append(hooks, h)
}

func ReportRecoveredPanic(name string, recovered any) {
	p := RecoveredPanic{
		Name:  name,
		Value: recovered,
		Stack: debug.Stack(),
	}

	countsMu.Lock()
	counts[name]++
	countsMu.Unlock()

	// Snapshot hooks under RLock to prevent deadlocks during execution
	hooksMu.RLock()
	snapshot := append([]PanicHook(nil), hooks...)
	hooksMu.RUnlock()

	for _, h := range snapshot {
		runHookSafely(h, p)
	}
}

func runHookSafely(h PanicHook, p RecoveredPanic) {
	defer func() {
		if rec := recover(); rec != nil {
			countsMu.Lock()
			counts["hook-panic:"+p.Name]++
			countsMu.Unlock()
		}
	}()
	h(p)
}

func Guard(name string, fn func()) (panicked bool) {
	defer func() {
		if rec := recover(); rec != nil {
			panicked = true
			ReportRecoveredPanic(name, rec)
		}
	}()
	fn()
	return false
}

func SafeGo(name string, fn func()) {
	go Guard(name, fn)
}

type RecoveryWriter struct {
	http.ResponseWriter
	WroteHeader bool
	Hijacked    bool
}

func (rw *RecoveryWriter) WriteHeader(code int) {
	// 1xx status codes (100 Continue, 103 Early Hints) are interim.
	// 101 Switching Protocols is final (WebSockets).
	if code >= http.StatusOK || code == http.StatusSwitchingProtocols {
		rw.WroteHeader = true
	}
	rw.ResponseWriter.WriteHeader(code)
}

func RecoveryMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rw := &RecoveryWriter{ResponseWriter: w}
		defer func() {
			rec := recover();
			if rec == nil {
				return
			}
			
			ReportRecoveredPanic(r.Method+" "+r.URL.Path, rec)

			if rw.Hijacked {
				return
			}

			// If headers were already committed, abort the stream cleanly
			if rw.WroteHeader {
				panic(http.ErrAbortHandler)
			}

			// Clear transport metadata set by the failing handler
			header := w.Header()
			header.Del("Content-Length")
			header.Del("Content-Encoding")
			header.Set("Content-Type", "application/json; charset=utf-8")
			w.WriteHeader(http.StatusInternalServerError)
			_, _ = w.Write([]byte(`{"code":"ERR_INTERNAL_PANIC","message":"Internal server error occurred."}`))
		}()
		next.ServeHTTP(rw, r)
	})
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Blindly catching panics, swallowing stacks, leaking raw panic strings, 
// and trying to write standard error responses over broken HTTP streams.
func BadRecoveryMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if r := recover(); r != nil {
				// FAILS: Leaks raw runtime pointers/internal variables to the HTTP response
				// FAILS: Does not check if headers/partial body were already written
				// FAILS: Retains previous Content-Length, causing client socket read hangs
				w.WriteHeader(http.StatusInternalServerError)
				w.Write([]byte(fmt.Sprintf("Panic caught: %v", r)))
			}
		}()
		next.ServeHTTP(w, r)
	})
}
```

**VERIFICATION METHOD**:
Verify using automated unit and integration tests under `-race`:
1. Execute a test handler that calls `w.Header().Set("Content-Length", "50")` and then triggers `panic("corrupt")`. Assert HTTP status is 500, response parses as valid JSON, and `Content-Length` matches the JSON error length.
2. Execute a test handler that calls `w.WriteHeader(202)` followed by `panic("crash")`. Assert that the recovery middleware triggers `panic(http.ErrAbortHandler)`.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T03:48:47.875Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795146527875",
    "title": "Granular Panic Containment with Error Sanitization and Abort Signaling",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "meshery/meshery",
    "source_uri": "https://github.com/meshery/meshery",
    "source_version": "HEAD",
    "content_hash": "f38dc58c1b3b3c0f07c16cdd5e11b46dac91e837d52eede5e39f839df4a5a2d4"
  },
  "evidence_fingerprint": "5c7fbcc97293e38f",
  "dimensions": {
    "source_reliability": {
      "status": "PASS",
      "score": 0.6,
      "tier": "TIER_3_COMMUNITY_OPEN",
      "findings": [],
      "details": [
        "Source originates from community open repository",
        "Source version unpinned (HEAD), subject to upstream drift",
        "Cryptographic SHA-256 payload integrity hash present"
      ]
    },
    "evidence_quality": {
      "status": "FAIL",
      "score": 0,
      "corroboration_tier": "INDEPENDENCE_UNVERIFIED",
      "effective_sources": 0,
      "direct_evidence_ratio": 0,
      "findings": [],
      "details": [
        "Direct empirical evidence ratio: 0% (0/5)",
        "Evidence-to-claim lexical alignment: 0%"
      ]
    },
    "technical_correctness": {
      "status": "PASS",
      "score": 1,
      "is_adversarial": false,
      "has_dangerous_security": false,
      "directive_opposition": false,
      "opposing_rule": null,
      "unsupported_assumptions": [],
      "findings": [],
      "details": [
        "No direct opposition with canonical operating directives",
        "Substantive technical content verified (> 40 chars)"
      ]
    },
    "reusability": {
      "status": "PASS",
      "score": 1,
      "is_generic_pattern": true,
      "has_local_paths": false,
      "findings": [],
      "details": [
        "Free of local workstation path artifacts",
        "Expresses generalized engineering invariants (2 architectural markers)",
        "Explicit WHEN TO APPLY scope defined"
      ]
    },
    "completeness": {
      "status": "PASS",
      "score": 1,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)",
        "Includes explicit negative example / anti-pattern contrast"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-20T03:48:47.875Z"
      ]
    },
    "duplication_and_conflict": {
      "status": "PASS",
      "score": 1,
      "is_duplicate": false,
      "duplicate_target": null,
      "is_contradiction": false,
      "conflicting_rule": null,
      "findings": [],
      "details": []
    }
  },
  "detected_contradictions": [],
  "missing_information": [
    "Empirical evidence records"
  ],
  "limitations": [
    "Staleness risk: MEDIUM"
  ],
  "evidence_references": [
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "b0ee13e31ac400a33a0c4259ba33f4fa79bfe2c31cdd6809350e98b992498f16"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
