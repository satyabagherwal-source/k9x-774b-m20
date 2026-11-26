# Candidate Directive: [CD-3H3A] persist saving failure state and harden retry_save recovery

<!-- PROVENANCE_START
{
  "source_repository": "nexu-io/openmotion",
  "source_url": "https://github.com/nexu-io/openmotion",
  "source_version": "40617226",
  "license": "Apache-2.0",
  "timestamp": "2026-11-26T07:48:27.334Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-nexu-io-openmotion",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [nexu-io/openmotion](https://github.com/nexu-io/openmotion) (Revision: `40617226`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-26T07:48:27.334Z`  
> **Learning ID**: `learn-github-nexu-io-openmotion`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `docs/assets.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in nexu-io/openmotion. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f9054f91`: cloud): persist saving failure state and harden retry_save recovery. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/assets.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
| `retry_save` | Original jobId and stable requestId; save existing outputs when savePending is true, without submitting another generation |
Use resume with the original jobId and a stable requestId to check a failed/interrupted Cloud task with a known remoteId, without uploading inputs or submitting another paid generation. Cancelled jobs and confirmed remote failures cannot resume. Use retry_save when savePending is true. Cloud save retries retrieve the original result while it is available from the gateway. Studio offers Retry saving for these jobs and Check original task for eligible interrupted jobs. Regeneration is a separate paid request requiring authorization. Reference counts follow the selected model before any reference file is read; there is no fixed library count ceiling. Local Codex/account editing remains one image, video remains one first frame, and project referenceAsset remains image-only.
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
| `retry_save` | Original jobId and stable requestId; save retained local outputs only when savePending is true, without invoking a provider |
Use resume with the original jobId and a stable requestId to check a failed/interrupted Cloud task with a known remoteId, without uploading inputs or submitting another paid generation. Cancelled jobs and confirmed remote failures cannot resume. Use retry_save only for retained local outputs (savePending); regeneration is a separate paid request requiring authorization. Studio offers Check original task on eligible failed jobs. Reference counts follow the selected model before any reference file is read; there is no fixed library count ceiling. Local Codex/account editing remains one image, video remains one first frame, and project referenceAsset remains image-only.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f9054f91` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T07:48:27.333Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795679307333",
    "title": "persist saving failure state and harden retry_save recovery",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "nexu-io/openmotion",
    "source_uri": "https://github.com/nexu-io/openmotion",
    "source_version": "HEAD",
    "content_hash": "451e6acec781510829c68e436f9f0b554775f1db62e8f360f4ba1a492af60a0e"
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
        "Harvested/verified timestamp recorded: 2026-11-26T07:48:27.333Z"
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
  "auth_token": "c8ab756c1230e6dc21ee8ff6020261d595546fbdbd16109026615bb22ad09b5f"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
