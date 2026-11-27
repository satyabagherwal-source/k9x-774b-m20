# Candidate Directive: [CD-U9FK] harden the image verification matching rules

<!-- PROVENANCE_START
{
  "source_repository": "siderolabs-talos-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-27T21:56:45.883Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-siderolabs-talos-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [siderolabs-talos-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-27T21:56:45.883Z`  
> **Learning ID**: `LEARN-EVO-siderolabs-talos-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `internal/pkg/containers/image/imageref/imageref.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in siderolabs/talos. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c5d94504`: harden the image verification matching rules. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `internal/pkg/containers/image/imageref/imageref.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	// hubDockerHubDomain is one more name the Docker Hub registry endpoint is served under.
	hubDockerHubDomain = "registry.hub.docker.com"

	// defaultPort is the port a registry is reached on when the reference carries none: an
	// image is always pulled over HTTPS unless a registry mirror is configured to do otherwise.
	defaultPort = "443"

// lower-cased, as registry domains are DNS names and DNS is case-insensitive, the port is reduced to
// its canonical decimal spelling and dropped when it is the default one (`registry:443/image` and
// `registry:0443/image` are both `registry/image`), and the alternative spellings of the Docker Hub
// domain, `index.docker.io`, `registry-1.docker.io` and `registry.hub.docker.com`, are folded into
// `docker.io`.
// NormalizePattern normalizes an image reference glob pattern, so that the pattern is matched in
// the same namespace the output of [RepositoryKey] is in.
// The pattern is lower-cased as a whole: a repository key is always lower-case, so a pattern
// written in any other case would match nothing at all. The registry domain of the pattern is then
// normalized the way the domain of a reference is.
	domain, repository, hasRepository 
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// lower-cased, as registry domains are DNS names and DNS is case-insensitive, and the alternative
// spellings of the Docker Hub domain, `index.docker.io` and `registry-1.docker.io`, are folded
// into `docker.io`.
// NormalizePattern normalizes the registry domain of an image reference glob pattern, so that the
// pattern is matched in the same namespace the output of [RepositoryKey] is in.
// Only the domain part of the pattern is normalized: the repository part of a canonical reference
// is always lower-case already, so folding its case would make a pattern match references it was
// not written for.
	domain, repository, hasRepository := strings.Cut(pattern, "/")
// normalizeDomainPattern normalizes the glob pattern matched against a registry domain.
	globIdx := strings.IndexRune(domain, '*')
	// reference, so that literal is normalized, while whatever the glob itself covers is matched
	// as written

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T21:56:46.015Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795816606015",
    "title": "harden the image verification matching rules",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "siderolabs-talos-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "9b9cf4a60002c4f413b8f05a32a6db252c35800e9634335f5b515f76e3a8e818"
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
        "Harvested/verified timestamp recorded: 2026-11-27T21:56:46.015Z"
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
  "auth_token": "185ad3eab7a16f4e978ff051bdfbb7820edf616cf082e988150e10a702340c29"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
