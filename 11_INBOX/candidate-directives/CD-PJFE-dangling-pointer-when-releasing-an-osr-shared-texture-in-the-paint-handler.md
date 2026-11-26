# Candidate Directive: [CD-PJFE] dangling pointer when releasing an OSR shared texture in the paint handler

<!-- PROVENANCE_START
{
  "source_repository": "electron/electron",
  "source_url": "https://github.com/electron/electron",
  "source_version": "b5e057ba",
  "license": "MIT",
  "timestamp": "2026-11-26T11:49:33.722Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-electron-electron",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [electron/electron](https://github.com/electron/electron) (Revision: `b5e057ba`).  
> **License**: MIT | **Timestamp**: `2026-11-26T11:49:33.722Z`  
> **Learning ID**: `learn-github-electron-electron`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `shell/browser/osr/README.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in electron/electron. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e1dee6a9`: dangling pointer when releasing an OSR shared texture in the paint handler. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `shell/browser/osr/README.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
3. The `WebContents::OnPaint` uses `gin_converter` (`osr_converter.cc`) to convert the `OffscreenSharedTextureValue` to a `v8::Object`. It converts most of the value to a corresponding `v8::Value`, and the handle is converted to a `Buffer`. It also creates a `release` function that drops the JS object's reference to the ref-counted `OffscreenReleaserHolder`. Once that reference and the in-flight `OffscreenSharedTextureValue` are both gone, the holder is destroyed and the frame can be reused for further capturing. `release` may be called synchronously from the `paint` handler. Finally, it creates a release monitor to detect if the `release` function is called before the garbage collector destroys the JS object; if not, it prints a warning and intentionally leaks the frame, so any `textureInfo` the app kept keeps referring to a valid handle.
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
3. The `WebContents::OnPaint` uses `gin_converter` (`osr_converter.cc`) to convert the `OffscreenSharedTextureValue` to a `v8::Object`. It converts most of the value to a corresponding `v8::Value`, and the handle is converted to a `Buffer`. It also creates a `release` function to destroy the releaser and free the frame we previously took ownership of. The frame can now be reused for further capturing. Finally, it creates a release monitor to detect if the `release` function is called before the garbage collector destroys the JS object; if not, it prints a warning.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e1dee6a9` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T11:49:33.719Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795693773719",
    "title": "dangling pointer when releasing an OSR shared texture in the paint handler",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "electron/electron",
    "source_uri": "https://github.com/electron/electron",
    "source_version": "HEAD",
    "content_hash": "a56e92d4001da110c5dc43ae5b4e84a17b936b049ded38ad8bedeb1ec6829d90"
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
        "Harvested/verified timestamp recorded: 2026-11-26T11:49:33.719Z"
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
  "auth_token": "062d15cddf5ef43e8be308f03f0c34aae4c54f2ebf608695b9cc5e51bcca5ace"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
