# Candidate Directive: [CD-RCAU] Public-Key Cryptographic Precision Ceiling Rule

<!-- PROVENANCE_START
{
  "source_repository": "meshtastic/Meshtastic-Android",
  "source_url": "https://github.com/meshtastic/Meshtastic-Android",
  "source_version": "fd407372",
  "license": "GPL-3.0",
  "timestamp": "2026-11-15T09:26:37.062Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-meshtastic-meshtastic-android",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [meshtastic/Meshtastic-Android](https://github.com/meshtastic/Meshtastic-Android) (Revision: `fd407372`).  
> **License**: GPL-3.0 | **Timestamp**: `2026-11-15T09:26:37.062Z`  
> **Learning ID**: `learn-github-meshtastic-meshtastic-android`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
    // SECURITY DISASTER: If position_precision is null or set to 32 bits on the
    // default public channel, physical coordinates are broadcast in the clear.
    return this 
}
```

**VERIFICATION METHOD**:
Execute property-based or parameterized unit tests against `ChannelSettings.withOnWirePrecision()`:
1. Public default key with `precision = 32` -> yields `precision = 15`.
2. Public default key with `precision = null` -> yields explicit `precision = 0`.
3. Private key with `precision = 32` -> yields preserved `precision = 32`.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T09:26:37.062Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794734797062",
    "title": "Public-Key Cryptographic Precision Ceiling Rule",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "meshtastic/Meshtastic-Android",
    "source_uri": "https://github.com/meshtastic/Meshtastic-Android",
    "source_version": "HEAD",
    "content_hash": "1390a64b73f4878aeb6c41269cbd57d8c287106370885454087cae327aee8cfb"
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
        "Harvested/verified timestamp recorded: 2026-11-15T09:26:37.062Z"
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
  "auth_token": "f4d9131aa983d81895799157633d87a89f8a05da617c769e76e4dfc0d5f419fc"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
