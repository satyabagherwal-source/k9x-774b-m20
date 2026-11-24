# Candidate Directive: [CD-MAV5] Empirical Invariant Guard in config.go

<!-- PROVENANCE_START
{
  "source_repository": "weaviate/weaviate",
  "source_url": "https://github.com/weaviate/weaviate",
  "source_version": "5852883d",
  "license": "NOASSERTION",
  "timestamp": "2026-11-24T00:31:51.425Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-weaviate-weaviate",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [weaviate/weaviate](https://github.com/weaviate/weaviate) (Revision: `5852883d`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-24T00:31:51.425Z`  
> **Learning ID**: `learn-github-weaviate-weaviate`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `adapters/repos/db/vector/hfresh/config.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in weaviate/weaviate. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `9132cef5`: . Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `adapters/repos/db/vector/hfresh/config.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	"os"
	"github.com/dustin/go-humanize"
const singlePostingMaxSizeEnv = "EXPERIMENTAL_HFRESH_SINGLE_POSTING_MAX_SIZE"

// singlePostingMaxSizeFromEnv reads the size, such as 10MiB, up to which an
// index stays in one posting. Unset, zero or invalid leaves the feature off.
func singlePostingMaxSizeFromEnv(logger logrus.FieldLogger) uint64 {
	v := os.Getenv(singlePostingMaxSizeEnv)
	if v == "" {
		return 0
	}

	size, err := humanize.ParseBytes(v)
	if err != nil {
		logger.WithField("value", v).Warnf("invalid %s, single-posting mode stays disabled: %v",
			singlePostingMaxSizeEnv, err)
		return 0
	}
	return size
}

	maxBytes := h.maxPostingSizeKB * 1024 // budget

	return uint32(math.Ceil(float64(maxBytes) / postingEntryBytes(dims)))
}

// postingEntryBytes is the size of one posting entry with dims dimensions.
func postingEntryBytes(dims int) float64 {
	return float64(dims)*bytesPerDim + float64(metadata)
	h.bootstrapThreshold = uint32(min(float64(h.singlePostingMaxSize)/postingEntryBytes(int(dims)), math.MaxUint32))
			"singlePostingMax": h.bootstrapThreshold,
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
	maxBytes := h.maxPostingSizeKB * 1024                 // budget
	vBytes := float64(dims)*bytesPerDim + float64(metadata)

	return uint32(math.Ceil(float64(maxBytes) / vBytes))
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `9132cef5` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T00:31:51.423Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795480311423",
    "title": "Empirical Invariant Guard in config.go",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "weaviate/weaviate",
    "source_uri": "https://github.com/weaviate/weaviate",
    "source_version": "HEAD",
    "content_hash": "c6a8798ff8da5236809fe49ac9a4e6f6a848c6843842bf481e0618b733fcb2c1"
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
        "Harvested/verified timestamp recorded: 2026-11-24T00:31:51.423Z"
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
  "auth_token": "af97a8d05f57cd2c8d337d328f43b9323da9854ffe2dba97821e5599974b00b1"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
