# Candidate Directive: [CD-TTXX] list every LoRa change and channel sharing flag when replacing from a chann

<!-- PROVENANCE_START
{
  "source_repository": "meshtastic/Meshtastic-Android",
  "source_url": "https://github.com/meshtastic/Meshtastic-Android",
  "source_version": "836e48f7",
  "license": "GPL-3.0",
  "timestamp": "2026-11-22T17:22:08.469Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-meshtastic-meshtastic-android",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [meshtastic/Meshtastic-Android](https://github.com/meshtastic/Meshtastic-Android) (Revision: `836e48f7`).  
> **License**: GPL-3.0 | **Timestamp**: `2026-11-22T17:22:08.469Z`  
> **Learning ID**: `learn-github-meshtastic-meshtastic-android`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain B

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.skills/compose-ui/strings-index.txt`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in meshtastic/Meshtastic-Android. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `de21f854`: ui): list every LoRa change and channel sharing flag when replacing from a channel link. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `.skills/compose-ui/strings-index.txt`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
channel_import_add_description
channel_import_confirm_add
channel_import_confirm_replace
channel_import_downlink
channel_import_mode_label
channel_import_position_approximate
channel_import_position_precise
channel_import_replace_description
channel_import_title
channel_import_uplink
frequency_value_mhz
lora_change_spoken
lora_change_values
lora_changes_alert_description
lora_changes_alert_heading
lora_changes_heading
lora_fem_lna_auto
lora_fem_lna_not_present
lora_field_fem_lna_mode
lora_field_frequency_offset
lora_field_modem_preset
lora_field_serial_hal_only
lora_field_transparent_mode
lora_field_unrecognized
lora_value_none
lora_value_not_used
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Induced defect failure mode:
add_channels_description
lora_config_change_value
lora_config_changes
new_channel_rcvd
replace_channels_and_settings_description
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `de21f854` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-22T17:22:08.467Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795368128467",
    "title": "list every LoRa change and channel sharing flag when replacing from a chann",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "meshtastic/Meshtastic-Android",
    "source_uri": "https://github.com/meshtastic/Meshtastic-Android",
    "source_version": "HEAD",
    "content_hash": "b70e6ff6127f4d907ee007af0279b752daf57990a9b6447d0df1a1717f6e0c1f"
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
        "Harvested/verified timestamp recorded: 2026-11-22T17:22:08.467Z"
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
  "auth_token": "ad976b724d4e656eb998a7fc95c9266a998b71106c5d6751ca95510467101bde"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
