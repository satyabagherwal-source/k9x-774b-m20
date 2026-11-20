# Candidate Directive: [CD-TXCJ] Gradle Plugin Portal Tag Lexical Invariant Rule

<!-- PROVENANCE_START
{
  "source_repository": "yshrsmz/BuildKonfig",
  "source_url": "https://github.com/yshrsmz/BuildKonfig",
  "source_version": "56c6977f",
  "license": "Apache-2.0",
  "timestamp": "2026-11-20T07:03:00.883Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-yshrsmz-buildkonfig",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [yshrsmz/BuildKonfig](https://github.com/yshrsmz/BuildKonfig) (Revision: `56c6977f`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-20T07:03:00.883Z`  
> **Learning ID**: `learn-github-yshrsmz-buildkonfig`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
Tags published to the Gradle Plugin Portal inside `gradlePlugin.plugins { tags.set(...) }` MUST be strictly lowercase, alphanumeric, hyphen-delimited or underscore-delimited strings without whitespace, and MUST adhere to plugin portal search index constraints.

**WHY**:
The Gradle Plugin Portal publishing API and backend search index reject or fail to index tags containing spaces, uppercase characters, or invalid UTF-8 control tokens. A tag such as `"Kotlin Multiplatform"` breaks automated publish pipelines or results in silent publishing validation rejections at the portal gateway, whereas `"kotlin-multiplatform"` is compliant and indexed.

**WHEN TO APPLY**:
Any Gradle plugin project configuring `gradlePlugin` metadata blocks in `build.gradle.kts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// In build.gradle.kts of Gradle Plugin module
gradlePlugin {
    plugins {
        create("buildkonfig") {
            id = "com.codingfeline.buildkonfig"
            implementationClass = "com.codingfeline.buildkonfig.gradle.BuildKonfigPlugin"
            displayName = POM_NAME
            description = POM_DESCRIPTION
            // STRICT REQUIREMENT: Lowercase, kebab-case tags, zero whitespace
            tags.set(listOf("buildconfig", "kotlin", "kotlin-multiplatform"))
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```kotlin
// ANTI-PATTERN: Mixed case and whitespace
tags.set(listOf("BuildConfig", "Kotlin", "Kotlin Multiplatform")) // Fails Portal validation!
```

**VERIFICATION METHOD**:
Unit/property test validating the tag specification format:
```kotlin
@Test
fun verifyPluginPortalTagsAreCompliant() {
    val tagRegex = Regex("^[a-z0-9]+(-[a-z0-9]+)*$")
    val tags = listOf("buildconfig", "kotlin", "kotlin-multiplatform")
    
    tags.forEach { tag ->
        assertTrue(tagRegex.matches(tag), "Tag '$tag' violates Gradle Plugin Portal conventions")
    }
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T07:03:00.882Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795158180882",
    "title": "Gradle Plugin Portal Tag Lexical Invariant Rule",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "yshrsmz/BuildKonfig",
    "source_uri": "https://github.com/yshrsmz/BuildKonfig",
    "source_version": "HEAD",
    "content_hash": "d5311d1f20c47f364402de8dcdb864481a85cefb19af57a3fac93b235a4a6124"
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
        "Harvested/verified timestamp recorded: 2026-11-20T07:03:00.882Z"
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
  "auth_token": "de2ca3235279cb136bc46bc33125f3a10e66714b3326fa749bc42f04445e6070"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
