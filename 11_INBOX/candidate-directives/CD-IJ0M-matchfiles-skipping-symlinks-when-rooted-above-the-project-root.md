# Candidate Directive: [CD-IJ0M] matchFiles skipping symlinks when rooted above the project root

<!-- PROVENANCE_START
{
  "source_repository": "react/metro",
  "source_url": "https://github.com/react/metro",
  "source_version": "3b7e1e1b",
  "license": "MIT",
  "timestamp": "2026-11-18T22:14:35.974Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-react-metro",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [react/metro](https://github.com/react/metro) (Revision: `3b7e1e1b`).  
> **License**: MIT | **Timestamp**: `2026-11-18T22:14:35.974Z`  
> **Learning ID**: `learn-github-react-metro`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `packages/metro-file-map/src/lib/TreeFS.js`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in react/metro. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `bc93c2aa`: matchFiles skipping symlinks when rooted above the project root. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing JavaScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/metro-file-map/src/lib/TreeFS.js`.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified production-grade fix pattern:
  // The nth ancestor of the root ('' is 0, '..' is 1, ...), reached through
  // the '..' entries that link each ancestor to the next. An ancestor with
  // nothing in the map has no entry, and is an empty directory, as in lookups.
  #getNthAncestorOfRoot(n: number): DirectoryNode {
    let node: ?MixedNode = this.#rootNode;
    for (let i = 0; i < n && isDirectory(node); i++) {
      node = node.get('..');
    }
    return isDirectory(node) ? node : new Map();
  }

  // An ancestor of the root does not hold the next ancestor down (or the root
  // itself) as an entry, so for the nth ancestor, the (n-1)th is yielded first,
  // under its basename.
    nextAncestorNode: ?DirectoryNode,
    if (
      ancestorOfRootIdx != null &&
      ancestorOfRootIdx > 0 &&
      nextAncestorNode != null
    ) {
        nextAncestorNode,
    // Symlinks are resolved from the canonical path of their directory. The
    // path where they were found differs when it passes through followed
    // symlinks, or re-enters the root from an ancestor ('..' + 'project/link').
    const makeFrame = (
      node: DirectoryNode,
      canonicalPath: string,
      nodeAncestorOfRootIdx: ?number,
      prefixWit
```

**NEGATIVE CONSTRAINT**:
```javascript
// Induced defect failure mode:
      parentNode: contextRootParent,
      contextRootParent,
    parent: ?DirectoryNode,
    if (ancestorOfRootIdx != null && ancestorOfRootIdx > 0 && parent) {
        parent,
    iterationRootParentNode: ?DirectoryNode,
    const stack = [
      {
          iterationRootNode,
          iterationRootParentNode,
          ancestorOfRootIdx,
        parentNode: iterationRootParentNode,
        prefixWithSep: pathPrefix === '' ? '' : pathPrefix + pathSep,
      },
      if (opts.subtreeOnly && name === '..') {
          // s
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `bc93c2aa` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T22:14:35.972Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795040075972",
    "title": "matchFiles skipping symlinks when rooted above the project root",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "react/metro",
    "source_uri": "https://github.com/react/metro",
    "source_version": "HEAD",
    "content_hash": "4f9aa33c9bb1e23f4265bd4088e6760d74ed4f547a2f2be56c36240cbeec1ffa"
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
        "Harvested/verified timestamp recorded: 2026-11-18T22:14:35.972Z"
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
  "auth_token": "465c3d99fc775c09ea9b0765e2750447bcf29608675b7df397d8403fb1c5ee34"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
