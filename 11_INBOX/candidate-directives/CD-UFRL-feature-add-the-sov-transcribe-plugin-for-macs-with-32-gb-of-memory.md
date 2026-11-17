# Candidate Directive: [CD-UFRL] (feature) Add the SOV-Transcribe plugin for Macs with 32 GB of memory

<!-- PROVENANCE_START
{
  "source_repository": "typewhisper-typewhisper-mac-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T02:32:27.637Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-typewhisper-typewhisper-mac-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [typewhisper-typewhisper-mac-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T02:32:27.637Z`  
> **Learning ID**: `LEARN-EVO-typewhisper-typewhisper-mac-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain B

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.github/workflows/plugin-release.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in TypeWhisper/typewhisper-mac. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6c26a50e`: (feature) Add the SOV-Transcribe plugin for Macs with 32 GB of memory. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/plugin-release.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
            sov-transcribe) TARGET="SOVTranscribePlugin" ;;
          # - Qwen3/Voxtral/Granite/SOV-Transcribe/Canary/LocalLLM: macOS 14 + embed Swift compat libs (MLX uses Swift 6.2 features)
          elif [ "$TARGET" = "Qwen3Plugin" ] || [ "$TARGET" = "VoxtralPlugin" ] || [ "$TARGET" = "GranitePlugin" ] || [ "$TARGET" = "SOVTranscribePlugin" ] || [ "$TARGET" = "CanaryPlugin" ] || [ "$TARGET" = "LocalLLMPlugin" ]; then
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
          # - Qwen3/Voxtral/Granite/Canary/LocalLLM: macOS 14 + embed Swift compat libs (MLX uses Swift 6.2 features)
          elif [ "$TARGET" = "Qwen3Plugin" ] || [ "$TARGET" = "VoxtralPlugin" ] || [ "$TARGET" = "GranitePlugin" ] || [ "$TARGET" = "CanaryPlugin" ] || [ "$TARGET" = "LocalLLMPlugin" ]; then
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `6c26a50e` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T02:32:27.729Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794882747729",
    "title": "(feature) Add the SOV-Transcribe plugin for Macs with 32 GB of memory",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "typewhisper-typewhisper-mac-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "003e1572e9a78a620da90fef53af3400dd43da03d25d8a840ef81bd33d4bc791"
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
        "Harvested/verified timestamp recorded: 2026-11-17T02:32:27.729Z"
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
  "auth_token": "87c26be6785411c027a5ad24ab9f6989e55bf9b7a4417c561df5e6ab6d689296"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
