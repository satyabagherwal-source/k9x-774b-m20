# Candidate Directive: [CD-EWY9] In-Flight Dial Backlog Throttling for Loopback Test Servers

<!-- PROVENANCE_START
{
  "source_repository": "tailscale/tailscale",
  "source_url": "https://github.com/tailscale/tailscale",
  "source_version": "1db8e79a",
  "license": "BSD-3-Clause",
  "timestamp": "2026-11-21T23:26:47.121Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-tailscale-tailscale",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tailscale/tailscale](https://github.com/tailscale/tailscale) (Revision: `1db8e79a`).  
> **License**: BSD-3-Clause | **Timestamp**: `2026-11-21T23:26:47.121Z`  
> **Learning ID**: `learn-github-tailscale-tailscale`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain B

## Original Learning Payload (100% Preserved)
**RULE**: Any test suite or client component executing concurrent requests over fresh TCP/TLS connections against an in-process or loopback server MUST strictly limit maximum in-flight dials using a bounded concurrency primitive (such as a semaphore) to a value less than the operating system's default `SOMAXCONN` listen backlog (typically 8 to 128 depending on platform/container).  
**WHY**: Under Windows, macOS, and Linux network namespaces where `somaxconn` is constrained (or `tcp_abort_on_overflow=1`), unbounded goroutines dialing a single `httptest.Server` trigger listen backlog overflows. When the backlog overflows, Windows immediately drops or resets the connection with `WSAECONNREFUSED` or returns empty payloads, resulting in flaky, false-positive network failures (e.g., HTTP 502 Bad Gateway) completely unrelated to the logic under test.  
**WHEN TO APPLY**: High-concurrency integration tests, reverse-proxy regression harnesses, and internal microservice scrapers initiating bursts of short-lived loopback TCP connections.  
**VERIFIED IMPLEMENTATION PATTERN**:
```go
package integration_test

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
)

// BoundedConcurrentCaller limits concurrent dials to prevent OS backlog overflows.
func RunBoundedProbe(t *testing.T, srv *httptest.Server, totalRequests int, maxConcurrency int) {
	sem := make(chan struct{}, maxConcurrency)
	var wg sync.WaitGroup
	errCh := make(chan error, totalRequests)

	for i := 0; i < totalRequests; i++ {
		wg.Add(1)
		go func(reqID int) {
			defer wg.Done()

			// Invariant: Must acquire semaphore token before initiating dial
			sem <- struct{}{}
			defer func() { <-sem }()

			req, err := http.NewRequestWithContext(context.Background(), "GET", srv.URL+"/probe", nil)
			if err != nil {
				errCh <- fmt.Errorf("req build failed: %w", err)
				return
			}

			resp, err := srv.Client().Do(req)
			if err != nil {
				errCh <- fmt.Errorf("dial/exec failed: %w", err)
				return
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				errCh <- fmt.Errorf("unexpected status code: %d", resp.StatusCode)
				return
			}
		}(i)
	}

	wg.Wait()
	close(errCh)

	for err := range errCh {
		if err != nil {
			t.Fatalf("concurrent probe encountered failure: %v", err)
		}
	}
}
```
**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Spawning hundreds of simultaneous goroutines dialing
// the same listener without concurrency bounds.
func RunFlakyUnboundedProbe(t *testing.T, srv *httptest.Server, count int) {
	var wg sync.WaitGroup
	for i := 0; i < count; i++ { // count = 400
		wg.Add(1)
		go func() { // Fails on Windows / hardened Linux due to SOMAXCONN overflow
			defer wg.Done()
			resp, err := http.Get(srv.URL + "/test")
			if err != nil || resp.StatusCode != 200 {
				t.Errorf("connection refused or 502 returned")
			}
		}()
	}
	wg.Wait()
}
```
**VERIFICATION METHOD**: Execute the test inside a Linux network namespace configured with constrained network buffers:
```bash
sudo ip netns add testns
sudo ip netns exec testns sysctl -w net.core.somaxconn=8
sudo ip netns exec testns sysctl -w net.ipv4.tcp_abort_on_overflow=1
sudo ip netns exec testns go test -v -race -run TestConcurrentStreams ./... -count=100
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T23:26:47.119Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795303607119",
    "title": "In-Flight Dial Backlog Throttling for Loopback Test Servers",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "tailscale/tailscale",
    "source_uri": "https://github.com/tailscale/tailscale",
    "source_version": "HEAD",
    "content_hash": "8311dc777badab52ad7a8165b374205d3d767e3de2e37bbc4ba982593ff060b4"
  },
  "evidence_fingerprint": "94110ab92c61e587",
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
        "Direct empirical evidence ratio: 0% (0/2)",
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
        "Expresses generalized engineering invariants (3 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-21T23:26:47.119Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "a322fe79f8d93ef45aebbb9f9743b133f14fb839261f0459408ea93b5652dfe3"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
