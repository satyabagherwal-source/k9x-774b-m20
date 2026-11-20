# Candidate Directive: [CD-VY94] Gradle Plugin Portal Tag Lexical Invariant Rule

<!-- PROVENANCE_START
{
  "source_repository": "yshrsmz-buildkonfig-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T07:04:35.242Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-yshrsmz-buildkonfig-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [yshrsmz-buildkonfig-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T07:04:35.242Z`  
> **Learning ID**: `LEARN-EVO-yshrsmz-buildkonfig-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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
  "validated_at": "2026-11-20T07:04:35.367Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795158275367",
    "title": "Gradle Plugin Portal Tag Lexical Invariant Rule",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "yshrsmz-buildkonfig-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "d5311d1f20c47f364402de8dcdb864481a85cefb19af57a3fac93b235a4a6124"
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
        "Harvested/verified timestamp recorded: 2026-11-20T07:04:35.368Z"
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
  "auth_token": "e676f1ba7ed2f1cfe7a2b86c5b734170e3b1492f60b2aca973c75621f4e7f2e0"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
