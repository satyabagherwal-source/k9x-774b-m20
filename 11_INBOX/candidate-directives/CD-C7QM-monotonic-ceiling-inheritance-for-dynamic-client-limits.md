# Candidate Directive: [CD-C7QM] Monotonic Ceiling Inheritance for Dynamic Client Limits

<!-- PROVENANCE_START
{
  "source_repository": "prometheus/prometheus",
  "source_url": "https://github.com/prometheus/prometheus",
  "source_version": "cb4e01dd",
  "license": "Apache-2.0",
  "timestamp": "2026-11-19T06:33:34.510Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-prometheus-prometheus",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [prometheus/prometheus](https://github.com/prometheus/prometheus) (Revision: `cb4e01dd`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-19T06:33:34.510Z`  
> **Learning ID**: `learn-github-prometheus-prometheus`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Silently clamping or allowing client overrides to raise ceilings
func ResolveInsecureLimit(requested uint64, serverCeiling uint64) uint64 {
	if requested > serverCeiling {
		// DANGEROUS: Masks mismatch from caller while risking unverified behavior
		return serverCeiling 
	}
	if requested == 0 {
		return serverCeiling
	}
	return requested
}
```

**VERIFICATION METHOD**:
Write a table-driven unit test verifying:
1. `requested == 0` returns `serverCeiling`.
2. `requested < serverCeiling` returns `requested`.
3. `requested > serverCeiling` returns `ErrLimitAboveCeiling` and rejects execution before entering storage or evaluation layers.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T06:33:34.509Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795070014509",
    "title": "Monotonic Ceiling Inheritance for Dynamic Client Limits",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "prometheus/prometheus",
    "source_uri": "https://github.com/prometheus/prometheus",
    "source_version": "HEAD",
    "content_hash": "9ed832367311bda96e4779e74a4c65b3730c4f5b9f39a98e86089e359b453b54"
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
        "Expresses generalized engineering invariants (5 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-19T06:33:34.509Z"
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
  "auth_token": "96943b811e09d44e566c872322ac576bac4d84e467768de15520a355b44c01e7"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
