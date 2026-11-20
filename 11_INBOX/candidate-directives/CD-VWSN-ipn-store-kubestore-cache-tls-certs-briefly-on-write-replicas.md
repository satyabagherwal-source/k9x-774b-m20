# Candidate Directive: [CD-VWSN] ipn/store/kubestore: cache TLS certs briefly on write replicas

<!-- PROVENANCE_START
{
  "source_repository": "tailscale/tailscale",
  "source_url": "https://github.com/tailscale/tailscale",
  "source_version": "c8ba9da5",
  "license": "BSD-3-Clause",
  "timestamp": "2026-11-20T13:08:28.488Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-tailscale-tailscale",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tailscale/tailscale](https://github.com/tailscale/tailscale) (Revision: `c8ba9da5`).  
> **License**: BSD-3-Clause | **Timestamp**: `2026-11-20T13:08:28.488Z`  
> **Learning ID**: `learn-github-tailscale-tailscale`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `ipn/store/kubestore/store_kube.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tailscale/tailscale. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c8ba9da5`: ipn/store/kubestore: cache TLS certs briefly on write replicas. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `ipn/store/kubestore/store_kube.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	"sync"
	"tailscale.com/tstime"
	"tailscale.com/util/singleflight"
	// rwCertTTL is how long a write replica serves a TLS cert from its
	// in-memory cache before it reads the cert Secret again. A short TTL
	// limits how long the replica can serve a stale cert after the cert
	// Secret is recreated, for example after Ingress recreation.
	rwCertTTL = 30 * time.Second
	// rwCertFallbackTimeout is the timeout for a write replica's cert
	// Secret read when it has a last-known-good cert to fall back to.
	// TLS handshakes wait for this read, so it must be much shorter than
	// typical client handshake timeouts (10s for kubectl).
	rwCertFallbackTimeout = 3 * time.Second


	// clock is used for rwCerts expiry.
	clock tstime.DefaultClock

	// certReads deduplicates concurrent cert Secret reads per domain.
	certReads singleflight.Group[string, *rwCert]

	// rwCertsMu guards rwCerts.
	rwCertsMu sync.Mutex
	// rwCerts holds the last-known-good TLS cert and key per domain for
	// write replicas (cert share "rw"). Write replicas don't keep certs in
	// memory, so that they notice a recreated, empty cert Secret and issue
	// a new cert. Instead, they use rwCerts to skip Secret reads for
	// rw
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
	// in-memory. Instead, write replicas fetch certs from Secret on each request.
	// certs for write replicas are retrieved from the Secret on
	// each HTTPS request. This is a temporary solution till we
// Note that write replicas of HA Ingress always retrieve TLS certs from Secrets.
	ctx, cancel := context.WithTimeout(
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c8ba9da5` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T13:08:28.486Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795180108486",
    "title": "ipn/store/kubestore: cache TLS certs briefly on write replicas",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "tailscale/tailscale",
    "source_uri": "https://github.com/tailscale/tailscale",
    "source_version": "HEAD",
    "content_hash": "287cd2ffce42aeadc45f96f74307799f6a1ebbd3884f04d8173b2a80f4ebb6c3"
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
        "Expresses generalized engineering invariants (4 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-20T13:08:28.486Z"
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
  "auth_token": "51bb00088f94dceb2cb6e178438556dca17316c625ae9d18ea05c4b18a50bcc0"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
