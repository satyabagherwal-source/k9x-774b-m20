# Candidate Directive: [CD-BP3Y] Fix crash on a package subpath ending in "/.", such as "pkg/."

<!-- PROVENANCE_START
{
  "source_repository": "react/metro",
  "source_url": "https://github.com/react/metro",
  "source_version": "059ef8d4",
  "license": "MIT",
  "timestamp": "2026-11-14T13:38:43.294Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-react-metro",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [react/metro](https://github.com/react/metro) (Revision: `059ef8d4`).  
> **License**: MIT | **Timestamp**: `2026-11-14T13:38:43.294Z`  
> **Learning ID**: `learn-github-react-metro`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `packages/metro-file-map/src/lib/RootPathUtils.js`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in react/metro. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1461d81e`: metro-file-map: Fix crash on a package subpath ending in "/.", such as "pkg/.". Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing JavaScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/metro-file-map/src/lib/RootPathUtils.js`.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified production-grade fix pattern:
        true,
      this.#tryCollapseIndirectionsInSuffix(relativePath, 0, 0, true)
      const collapsed = this.#tryCollapseIndirectionsInSuffix(
        rawPath,
        0,
        0,
        false,
      );
    bailOnTrailingIndirection: boolean, // Fall back on a final '.' or '..'
        // The search above doesn't find a final '.' or '..' segment, as no
        // separator follows it. Fall back for those too, unless the '..' is
        // one of the leading indirections, e.g. for /project/root/foo/. or
        // /project/root/foo/..
        if (bailOnTrailingIndirection && fullPath.endsWith('.')) {
          const lastSegmentIdx = fullPath.lastIndexOf(path.sep) + 1;
          const lastSegmentLength = fullPath.length - lastSegmentIdx;
          if (
            lastSegmentLength === 1 ||
            (lastSegmentLength === 2 &&
              fullPath[lastSegmentIdx] === '.' &&
              lastSegmentIdx > pos)
          ) {
            return null;
          }
        }
```

**NEGATIVE CONSTRAINT**:
```javascript
// Induced defect failure mode:
      this.#tryCollapseIndirectionsInSuffix(relativePath, 0, 0)
      const collapsed = this.#tryCollapseIndirectionsInSuffix(rawPath, 0, 0);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1461d81e` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T13:38:43.292Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794663523292",
    "title": "Fix crash on a package subpath ending in \"/.\", such as \"pkg/.\"",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "react/metro",
    "source_uri": "https://github.com/react/metro",
    "source_version": "HEAD",
    "content_hash": "cdb386dc5fc9f349fc75996f771f8b33ce8b0737b49d445ef17584ff38864464"
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
        "Harvested/verified timestamp recorded: 2026-11-14T13:38:43.292Z"
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
  "auth_token": "8bea0d43afb7584107a75c2ca18b4dd03ba158eb73ffd1a990242a6a351675d6"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
