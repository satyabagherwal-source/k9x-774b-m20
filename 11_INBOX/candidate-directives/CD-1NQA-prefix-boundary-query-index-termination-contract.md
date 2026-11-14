# Candidate Directive: [CD-1NQA] Prefix-Boundary Query Index Termination Contract

<!-- PROVENANCE_START
{
  "source_repository": "authzed/spicedb",
  "source_url": "https://github.com/authzed/spicedb",
  "source_version": "558b84d7",
  "license": "Apache-2.0",
  "timestamp": "2026-11-14T05:07:01.858Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-authzed-spicedb",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [authzed/spicedb](https://github.com/authzed/spicedb) (Revision: `558b84d7`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-14T05:07:01.858Z`  
> **Learning ID**: `learn-github-authzed-spicedb`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
In composite relational index matching engines, whenever an equality query filter transitions to a prefix, range, or slice match on a column (e.g., `OptionalResourceIDPrefix`), the index optimizer MUST immediately terminate matching across any subsequent index columns (`columnFilterStop`).

**WHY**:
B-Tree indexes cannot perform efficient point lookups on column $N+1$ if column $N$ is filtered via a range or prefix predicate (`LIKE 'prefix%'`). If the matching engine counts trailing columns as active matches, it generates forced index hints or query planner overrides that cause full-index range scans, degrading query latency from $O(\log N)$ to $O(M)$.

**WHEN TO APPLY**:
Custom query planners, SQL generator layers, and relational indexing adapters (such as CockroachDB forced indexing algorithms).

**VERIFIED IMPLEMENTATION PATTERN**:
```go
case columnFilterStop:
    // Prefix scan detected: no subsequent index columns may be leveraged
    allowAdditionalColumns = false
    if columnIndex > lastMatchingColIndex+1 {
        return doesNotMatch, nil // Gap in index column matching
    }
    lastMatchingColIndex = columnIndex

case columnFilterMatch:
    // Disallow matches if a prior prefix scan halted column progression
    if !allowAdditionalColumns {
        return doesNotMatch, nil
    }
    if columnIndex > lastMatchingColIndex+1 {
        return doesNotMatch, nil
    }
    lastMatchingColIndex = columnIndex
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Blindly matching subsequent columns when earlier column is prefix-bound
if filter.OptionalResourceIDPrefix != "" {
    // Treating prefix as a normal match allows the loop to continue
    // and match userset_namespace, leading to invalid index forcing!
    matchedColumns++
}
```

**VERIFICATION METHOD**:
Unit test composite index selection by supplying a filter with a prefix constraint and verifying that the index matcher ignores all subsequent columns.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T05:07:01.858Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794632821858",
    "title": "Prefix-Boundary Query Index Termination Contract",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "authzed/spicedb",
    "source_uri": "https://github.com/authzed/spicedb",
    "source_version": "HEAD",
    "content_hash": "93a58b7ff375b893a232ea60028b9425a1ca9254d948e97fb62eefd9ed7f5fac"
  },
  "evidence_fingerprint": "ece9d10e7392fc66",
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
        "Direct empirical evidence ratio: 0% (0/1)",
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
        "Harvested/verified timestamp recorded: 2026-11-14T05:07:01.858Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "2d9f566a65e6518c033a00e1f4fef859eb86b164927a78658dcec213f59f6693"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
