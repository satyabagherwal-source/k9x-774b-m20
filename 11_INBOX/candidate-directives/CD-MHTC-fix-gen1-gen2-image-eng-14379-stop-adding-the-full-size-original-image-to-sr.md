# Candidate Directive: [CD-MHTC] fix[gen1][gen2][image]: ENG-14379 stop adding the full-size original image to sr

<!-- PROVENANCE_START
{
  "source_repository": "BuilderIO/builder",
  "source_url": "https://github.com/BuilderIO/builder",
  "source_version": "aa20a509",
  "license": "MIT",
  "timestamp": "2026-11-17T17:50:04.464Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-builderio-builder",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [BuilderIO/builder](https://github.com/BuilderIO/builder) (Revision: `aa20a509`).  
> **License**: MIT | **Timestamp**: `2026-11-17T17:50:04.464Z`  
> **Learning ID**: `learn-github-builderio-builder`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `packages/react/src/blocks/Image.tsx`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in BuilderIO/builder. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d02cc7ea`: fix[gen1][gen2][image]: ENG-14379 stop adding the full-size original image to srcset. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/react/src/blocks/Image.tsx`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
    const widthInSrc = Number(url.match(/[?&]width=(\d+)/)?.[1]);
    // A candidate without a width descriptor is treated as 1x and can win over
    // the resized ones, so the original is only kept when its width is known.
      .concat(isNaN(widthInSrc) ? [] : [`${url} ${widthInSrc}w`])
    const candidates = sizes
      .map(([sizeUrl, size]) => `${sizeUrl} ${size}w`);

    return candidates.length ? candidates.join(', ') : url;
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
    let srcUrl = url;
    const widthInSrc = Number(url.split('?width=')[1]);
    if (!isNaN(widthInSrc)) {
      srcUrl = `${srcUrl} ${widthInSrc}w`;
    }
      .concat([srcUrl])
    return sizes
      .map(([sizeUrl, size]) => `${sizeUrl} ${size}w`)
      .concat([url])
      .join(', ');
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d02cc7ea` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T17:50:04.462Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794937804462",
    "title": "fix[gen1][gen2][image]: ENG-14379 stop adding the full-size original image to sr",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "BuilderIO/builder",
    "source_uri": "https://github.com/BuilderIO/builder",
    "source_version": "HEAD",
    "content_hash": "320b075504285b7bd5b49f66e7f94512a6bb8363fb6e85ed753938191b5f7944"
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
        "Harvested/verified timestamp recorded: 2026-11-17T17:50:04.462Z"
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
  "auth_token": "cc7664571031678f46e00b91390c8eef1faf3d806087b4017f7e1ce9cb9f7063"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
