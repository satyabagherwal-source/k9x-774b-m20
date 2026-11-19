# Candidate Directive: [CD-CTNG] Monotonic Ceiling Inheritance for Dynamic Client Limits

<!-- PROVENANCE_START
{
  "source_repository": "prometheus-prometheus-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-19T06:34:02.831Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-prometheus-prometheus-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [prometheus-prometheus-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-19T06:34:02.831Z`  
> **Learning ID**: `LEARN-EVO-prometheus-prometheus-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
Any API or evaluation engine that accepts dynamic, per-request resource limits (such as query memory, execution timeouts, or maximum touched series) MUST enforce monotonic tightening against administrative ceilings. If a request limit exceeds the configured ceiling, the system MUST immediately reject the request with a client error (`400 Bad Request` / typed error) and MUST NOT silently clamp the requested limit to the ceiling.

**WHY**:
Silently clamping a caller's limit provides false guarantees: callers design SLAs assuming their explicit request parameters were executed as configured. When clamped silently, an expensive query runs up to an arbitrary boundary unexpected by the caller, masking configuration discrepancies. Conversely, allowing client-specified values to override operator ceilings creates a severe security vulnerability, allowing untrusted tenants to bypass cluster-wide denial-of-service protections.

**WHEN TO APPLY**:
Apply to all query engines, external RPC endpoints, multi-tenant execution contexts, batch scheduling APIs, and resource isolation barriers.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
package limits

import (
	"fmt"
)

type ErrLimitAboveCeiling struct {
	Limit     string
	Requested uint64
	Ceiling   uint64
}

func (e ErrLimitAboveCeiling) Error() string {
	return fmt.Sprintf("requested %s of %d exceeds the server limit of %d", e.Limit, e.Requested, e.Ceiling)
}

type ExecutionLimits struct {
	MaxSeries uint64
}

func ResolveLimit(limitName string, requested uint64, serverCeiling uint64) (uint64, error) {
	// Zero implies using the default ceiling without override
	if requested == 0 {
		return serverCeiling, nil
	}

	// Invariant: Overrides can ONLY tighten (be smaller than) the ceiling
	if serverCeiling > 0 && requested > serverCeiling {
		return 0, ErrLimitAboveCeiling{
			Limit:     limitName,
			Requested: requested,
			Ceiling:   serverCeiling,
		}
	}

	return requested, nil
}
```

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T06:34:02.908Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795070042908",
    "title": "Monotonic Ceiling Inheritance for Dynamic Client Limits",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "prometheus-prometheus-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "eed50c63dcf7311e0102f68c605d91caec0e49302ade0680572138e97fce9d69"
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
        "Expresses generalized engineering invariants (5 architectural markers)",
        "Explicit WHEN TO APPLY scope defined"
      ]
    },
    "completeness": {
      "status": "PASS",
      "score": 0.85,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-19T06:34:02.908Z"
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
  "auth_token": "f39df943239ec4847b13e1e4c9795bc54c702bc1236ff8be651f7a1d47f19c20"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
