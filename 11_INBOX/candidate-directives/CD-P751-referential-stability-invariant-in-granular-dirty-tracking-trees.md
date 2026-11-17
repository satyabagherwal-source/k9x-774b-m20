# Candidate Directive: [CD-P751] Referential Stability Invariant in Granular Dirty-Tracking Trees

<!-- PROVENANCE_START
{
  "source_repository": "react-hook-form-react-hook-form-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T08:32:18.161Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-react-hook-form-react-hook-form-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [react-hook-form-react-hook-form-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T08:32:18.161Z`  
> **Learning ID**: `LEARN-EVO-react-hook-form-react-hook-form-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When updating a nested tree of dirty field states (`formState.dirtyFields`), mutation algorithms MUST NOT clone or reconstruct branch objects whose internal state did not experience a boolean or structural transition. If an already dirty leaf field is updated to another dirty value, the top-level `dirtyFields` container and all ancestor references MUST maintain strict referential equality (`===`).

**WHY**:
Modern reactive frameworks (React, Solid) and memoized selectors (`useMemo`, `React.memo`, `useSyncExternalStore`) rely on shallow reference equality checks. Reconstructing `dirtyFields` on every keystroke when an input is already dirty forces every downstream subscriber to re-render, destroying the primary performance guarantee of decoupled form architectures.

**WHEN TO APPLY**:
State-management libraries tracking deep path diffs (forms, AST transformations, collaborative document editing, JSON patch processors).

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
export type DirtyStateTree = {
  [key: string]: boolean | DirtyStateTree | Array<DirtyStateTree | boolean>;
};

/**
 * Updates a dirty state tree while preserving referential stability.
 * Returns the exact same tree reference if the mutation would be a no-op.
 */
export function setDirtyFieldDeep(
  currentTree: DirtyStateTree,
  path: string[],
  isLeafDirty: boolean,
): { tree: DirtyStateTree; hasChanged: boolean } {
  if (path.length === 0) {
    return { tree: currentTree, hasChanged: false };
  }

  const [currentKey, ...remainingPath] = path;
  const currentValue = currentTree[currentKey];

  if (remainingPath.length === 0) {
    // Terminal leaf node
    const currentBool = currentValue === true;
    if (currentBool === isLeafDirty) {
      return { tree: currentTree, hasChanged: false };
    }

    const nextTree = { ...currentTree };
    if (isLeafDirty) {
      nextTree[currentKey] = true;
    } else {
      delete nextTree[currentKey];
    }
    return { tree: nextTree, hasChanged: true };
  }

  // Internal branch node
  const currentSubTree = (typeof currentValue === 'object' && currentValue !== null)

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T08:32:18.277Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794904338277",
    "title": "Referential Stability Invariant in Granular Dirty-Tracking Trees",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "react-hook-form-react-hook-form-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "6fd86381ab3c1dc44b311c81fc2a8b13c4459931654fbd19a1a96ba515bfc66e"
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
        "Expresses generalized engineering invariants (3 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-17T08:32:18.277Z"
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
  "auth_token": "0f529c046e61649756f3b0e86dd64dcdc8095308c0ce981749aa28deb035d3a1"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
