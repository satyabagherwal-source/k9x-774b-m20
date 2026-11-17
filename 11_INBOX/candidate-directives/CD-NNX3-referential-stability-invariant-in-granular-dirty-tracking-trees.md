# Candidate Directive: [CD-NNX3] Referential Stability Invariant in Granular Dirty-Tracking Trees

<!-- PROVENANCE_START
{
  "source_repository": "react-hook-form/react-hook-form",
  "source_url": "https://github.com/react-hook-form/react-hook-form",
  "source_version": "66f4d72b",
  "license": "MIT",
  "timestamp": "2026-11-17T08:31:06.711Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-react-hook-form-react-hook-form",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [react-hook-form/react-hook-form](https://github.com/react-hook-form/react-hook-form) (Revision: `66f4d72b`).  
> **License**: MIT | **Timestamp**: `2026-11-17T08:31:06.711Z`  
> **Learning ID**: `learn-github-react-hook-form-react-hook-form`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
    ? (currentValue as DirtyStateTree)
    : {};

  const { tree: nextSubTree, hasChanged } = setDirtyFieldDeep(
    currentSubTree,
    remainingPath,
    isLeafDirty,
  );

  if (!hasChanged) {
    return { tree: currentTree, hasChanged: false };
  }

  const nextTree = { ...currentTree };
  if (Object.keys(nextSubTree).length === 0) {
    delete nextTree[currentKey];
  } else {
    nextTree[currentKey] = nextSubTree;
  }

  return { tree: nextTree, hasChanged: true };
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Indiscriminately allocating new objects at every tree level
// regardless of whether any leaf value actually transitioned.
function badSetDirty(dirtyTree: Record<string, any>, path: string[]) {
  const cloned = JSON.parse(JSON.stringify(dirtyTree)); // Destroys references unconditionally!
  lodashSet(cloned, path, true);
  return cloned; // Forces re-render on every keystroke even if field was already dirty
}
```

**VERIFICATION METHOD**:
Execute consecutive modifications to an already-dirty path and assert referential equality of the root `dirtyFields` container:
```typescript
const stateBefore = control._formState.dirtyFields;
control.setValue("profile.firstName", "Alpha", { shouldDirty: true });
const stateMiddle = control._formState.dirtyFields;
control.setValue("profile.firstName", "Beta", { shouldDirty: true });
const stateAfter = control._formState.dirtyFields;

expect(stateBefore).not.toBe(stateMiddle); // Transition from clean to dirty: Identity MUST change
expect(stateMiddle).toBe(stateAfter);       // Transition from dirty to dirty: Identity MUST be stable
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T08:31:06.710Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794904266710",
    "title": "Referential Stability Invariant in Granular Dirty-Tracking Trees",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "react-hook-form/react-hook-form",
    "source_uri": "https://github.com/react-hook-form/react-hook-form",
    "source_version": "HEAD",
    "content_hash": "67c682b0588e1f441dbb9a7bc2f3a5529d56414163cea06d243f14b8bddd1fbe"
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
        "Harvested/verified timestamp recorded: 2026-11-17T08:31:06.710Z"
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
  "auth_token": "32d999f8394a6061919af31343583c14f7be3edc5b90acd1dc06134a10f29732"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
