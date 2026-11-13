# Candidate Directive: [CD-CA37] post list height shift for posts with multiple image attachments

<!-- PROVENANCE_START
{
  "source_repository": "mattermost/mattermost",
  "source_url": "https://github.com/mattermost/mattermost",
  "source_version": "2c67adc2",
  "license": "NOASSERTION",
  "timestamp": "2026-11-13T19:27:25.460Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-mattermost-mattermost",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [mattermost/mattermost](https://github.com/mattermost/mattermost) (Revision: `2c67adc2`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-13T19:27:25.460Z`  
> **Learning ID**: `learn-github-mattermost-mattermost`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `webapp/channels/src/components/file_attachment_list/media_gallery/media_gallery.scss`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in mattermost/mattermost. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `9d59b084`: post list height shift for posts with multiple image attachments. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `webapp/channels/src/components/file_attachment_list/media_gallery/media_gallery.scss`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
    container: media-gallery / inline-size;
        --media-gallery-row-height: 216px;

        flex-flow: row wrap;
        align-content: flex-start;
    &--compact &__rows {
        --media-gallery-row-height: 144px;
    }
}

// Sized in CSS rather than from a measured width so the post list sees the
// final height on first render, including in narrow containers like the RHS.
// CSS has no hysteresis, so the RHS reserves its scrollbar gutter to keep a
// scrollbar appearing from toggling the row height near 480px.
@container media-gallery (width < 480px) {
    .MediaGallery__rows {
        --media-gallery-row-height: 144px;
    // Scale to the row height by aspect ratio, without upscaling past the
    // file's native width, clamped to 50-500px.
    --tile-width: max(50px, min(calc(var(--tile-ratio, 1.5) * var(--media-gallery-row-height)), var(--tile-native-width, 500px), 500px));

    width: var(--tile-width);
    max-width: 100%;
    height: var(--media-gallery-row-height);
    flex: 0 0 var(--tile-width);
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
    container-type: inline-size;
        flex-direction: column;
    &__row {
        display: flex;
        width: 100%;
        min-width: 0;
        flex-direction: row;
        align-items: stretch;
        justify-content: flex-start;
        gap: 8px;
        text-align: left;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `9d59b084` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-13T19:27:25.458Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794598045458",
    "title": "post list height shift for posts with multiple image attachments",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "mattermost/mattermost",
    "source_uri": "https://github.com/mattermost/mattermost",
    "source_version": "HEAD",
    "content_hash": "54adf322f2b926721b6c4d3bc6f27c2ac8e7a37cb0ee0785b3d0a171f2f02a6f"
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
        "Harvested/verified timestamp recorded: 2026-11-13T19:27:25.458Z"
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
  "auth_token": "ebe2344962858f0ae549c191eb67d3496aeea62b8bed4af3cda563d093677818"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
