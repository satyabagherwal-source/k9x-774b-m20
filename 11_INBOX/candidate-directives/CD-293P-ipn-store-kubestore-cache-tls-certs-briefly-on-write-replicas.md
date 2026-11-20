# Candidate Directive: [CD-293P] ipn/store/kubestore: cache TLS certs briefly on write replicas

<!-- PROVENANCE_START
{
  "source_repository": "tailscale-tailscale-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T13:13:24.262Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-tailscale-tailscale-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tailscale-tailscale-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T13:13:24.262Z`  
> **Learning ID**: `LEARN-EVO-tailscale-tailscale-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T13:13:24.371Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795180404371",
    "title": "ipn/store/kubestore: cache TLS certs briefly on write replicas",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "tailscale-tailscale-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "0d91af2ff391414018d02d95e2af238760c522858ca6bd7ba1d53a6a37cbd318"
  },
  "evidence_fingerprint": "NO_EVIDENCE",
  "dimensions": {
    "source_reliability": {
      "status": "FAIL",
      "score": 0,
      "tier": "UNTRUSTED_EXTERNAL",
      "findings": [
        "MISSING_SOURCE_URI: Knowledge has no source URL or locator"
      ],
      "details": [
        "Source is completely untraceable; origin cannot be verified."
      ]
    },
    "evidence_quality": {
      "status": "WARN",
      "score": 0.2,
      "corroboration_tier": "INDEPENDENCE_UNVERIFIED",
      "effective_sources": 0,
      "direct_evidence_ratio": 0,
      "findings": [
        "NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records"
      ],
      "details": [
        "Claim is uncorroborated; relies solely on raw unverified source text."
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
        "Harvested/verified timestamp recorded: 2026-11-20T13:13:24.371Z"
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
    "Source provenance",
    "Empirical evidence records"
  ],
  "limitations": [
    "Staleness risk: MEDIUM"
  ],
  "evidence_references": [],
  "auth_token": "3b4b1cc740883d87845404d03eeb64c236365f4f837d3f25f68a96a83452f770"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
