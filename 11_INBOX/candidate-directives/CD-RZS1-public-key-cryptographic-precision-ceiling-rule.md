# Candidate Directive: [CD-RZS1] Public-Key Cryptographic Precision Ceiling Rule

<!-- PROVENANCE_START
{
  "source_repository": "meshtastic-meshtastic-android-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-15T09:27:07.392Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-meshtastic-meshtastic-android-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [meshtastic-meshtastic-android-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-15T09:27:07.392Z`  
> **Learning ID**: `LEARN-EVO-meshtastic-meshtastic-android-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When an application entity broadcasts telemetry (such as GNSS coordinates) over a communication channel whose encryption key is shared, default, or publicly decryptable, the serialization engine **MUST** programmatically clamp precision parameters to a predetermined security ceiling (e.g., $\le 15$ bits of precision, roughly equivalent to ~100-meter uncertainty). Omitted precision configurations on public channels **MUST NOT** default to raw precision; they **MUST** be explicitly normalized to degraded or disabled status.

**WHY**:
In mesh and IoT radio topologies, users share channels using standard public default pre-shared keys (e.g., Meshtastic's `LongFast` default PSK). If an imported profile or UI setting fails to specify explicit precision bits for a channel, legacy firmware/nodes treat the absence of precision configuration as an authorization to broadcast full 32-bit centimetre-level GPS coordinates. This leaks the physical location of emergency responders, activists, or private citizens to anyone possessing the public default key within radio frequency range.

**WHEN TO APPLY**:
Every system where data can traverse multiple cryptographic tiers (public broadcast vs. private pre-shared key groups) and physical privacy/telemetry is serialized into protobufs or wire frames.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
package org.meshtastic.core.model.util

import okio.ByteString
import org.meshtastic.core.model.Channel
import org.meshtastic.proto.ChannelSettings
import org.meshtastic.proto.ModuleSettings

const val MAX_PUBLIC_KEY_PRECISION_BITS = 15

fun onWirePrecisionBits(precisionBits: Int, usesPublicKey: Boolean): Int =
    if (usesPublicKey) precisionBits.coerceAtMost(MAX_PUBLIC_KEY_PRECISION_BITS) else precisionBits

fun ChannelSettings.withOnWirePrecision(usesPublicKey: Boolean): ChannelSettings {
    val module = module_settings
    // Crucial: absent module settings MUST become explicit 0 (disabled) on public keys
    val onWire = onWirePrecisionBits(module?.position_precision ?: 0, usesPublicKey)
    if (!usesPublicKey || onWire == module?.position_precision) return this
    
    val capped = (module ?: ModuleSettings.Builder().build())
        .newBuilder()
        .also { wb -> wb.position_precision = onWire }
        .build()
        
    return newBuilder().also { wb -> wb.module_settings = capped }.build()
}

fun List<ChannelSettings>.withOnWirePrecision(): List<ChannelSettings> {
    val primary = firstOrNull()
    return mapIndexed { index, settings ->
        settings.withOnWirePrecision(Channel.usesPublicKey(settings, primary.takeIf { index > 0 }))
    }
}
```

**NEGATIVE CONSTRAINT**:
```kotlin
// ANTI-PATTERN: Trusting the imported profile or UI model directly onto the wire
fun ChannelSet.exportToRadio(): ChannelSet {

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T09:27:07.488Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794734827488",
    "title": "Public-Key Cryptographic Precision Ceiling Rule",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "meshtastic-meshtastic-android-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "f6219a67d32407379768f1bba63f3dc0834c3bcc72e4e5efbd49ffd97f8f57f8"
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
        "Expresses generalized engineering invariants (2 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-15T09:27:07.488Z"
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
  "auth_token": "5c924a23d4846aaa885b0ea0b2039d04abeaa53fda3fe0df5a2d4d9ed29ec93f"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
