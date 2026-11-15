# Candidate Directive: [CD-UU3X] Sign nightly APKs with the release keystore

<!-- PROVENANCE_START
{
  "source_repository": "ShiftHackZ/SDAI-KMP",
  "source_url": "https://github.com/ShiftHackZ/SDAI-KMP",
  "source_version": "3d9670a7",
  "license": "AGPL-3.0",
  "timestamp": "2026-11-15T00:37:27.405Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-shifthackz-sdai-kmp",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [ShiftHackZ/SDAI-KMP](https://github.com/ShiftHackZ/SDAI-KMP) (Revision: `3d9670a7`).  
> **License**: AGPL-3.0 | **Timestamp**: `2026-11-15T00:37:27.405Z`  
> **Learning ID**: `learn-github-shifthackz-sdai-kmp`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.github/workflows/nightly_android.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in ShiftHackZ/SDAI-KMP. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `3d9670a7`: Sign nightly APKs with the release keystore. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/nightly_android.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
    environment: android-release
      - name: Sign APK with release JKS
          ANDROID_RELEASE_KEYSTORE_BASE64: ${{ secrets.ANDROID_RELEASE_KEYSTORE_BASE64 }}
          ANDROID_RELEASE_STORE_PASSWORD: ${{ secrets.ANDROID_RELEASE_STORE_PASSWORD }}
          ANDROID_RELEASE_KEY_ALIAS: ${{ secrets.ANDROID_RELEASE_KEY_ALIAS }}
          ANDROID_RELEASE_KEY_PASSWORD: ${{ secrets.ANDROID_RELEASE_KEY_PASSWORD }}
          ANDROID_RELEASE_CERT_SHA256: ${{ vars.ANDROID_RELEASE_CERT_SHA256 }}
          : "${ANDROID_RELEASE_KEYSTORE_BASE64:?Missing ANDROID_RELEASE_KEYSTORE_BASE64 secret.}"
          : "${ANDROID_RELEASE_STORE_PASSWORD:?Missing ANDROID_RELEASE_STORE_PASSWORD secret.}"
          : "${ANDROID_RELEASE_KEY_ALIAS:?Missing ANDROID_RELEASE_KEY_ALIAS secret.}"
          : "${ANDROID_RELEASE_CERT_SHA256:?Missing ANDROID_RELEASE_CERT_SHA256 variable.}"
          export ANDROID_RELEASE_KEY_PASSWORD="${ANDROID_RELEASE_KEY_PASSWORD:-${ANDROID_RELEASE_STORE_PASSWORD}}"
          trap 'rm -rf -- "${signing_dir}"' EXIT
          keystore="${signing_dir}/release.jks"
          printf "%s" "${ANDROID_RELEASE_KEYSTORE_BASE64}" | base64 --decode > "${keystore}"
          chmod 600 "${keystore
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Induced defect failure mode:
      - name: Sign APK with apksigner key and certificate
          ANDROID_NIGHTLY_CERT_PEM_BASE64: ${{ secrets.ANDROID_NIGHTLY_CERT_PEM_BASE64 }}
          ANDROID_NIGHTLY_KEY_PK8_BASE64: ${{ secrets.ANDROID_NIGHTLY_KEY_PK8_BASE64 }}
          : "${ANDROID_NIGHTLY_CERT_PEM_BASE64:?Missing ANDROID_NIGHTLY_CERT_PEM_BASE64 secret.}"
          : "${ANDROID_NIGHTLY_KEY_PK8_BASE64:?Missing ANDROID_NIGHTLY_KEY_PK8_BASE64 secret.}"
          key_file="${signing_dir}/nightly.pk8"
          cert_file="${signing_dir}/nightly.x509.pem"
          printf "%s" "${ANDROID_NIGHTLY_KEY_PK8_BASE64}" | base64 --decode > "${key_file}"
          printf "%s" "${ANDROID_NIGHTLY_CERT_PEM_BASE64}" | base64 --decode > "${cert_file}"
          chmod 600 "${key_file}" "${cert_file}"
          "${apksigner}" sign --key "${key_file}" --cert "${cert_file}" --out "${signed_apk}" "${aligned_apk}"
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `3d9670a7` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T00:37:27.402Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794703047402",
    "title": "Sign nightly APKs with the release keystore",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "ShiftHackZ/SDAI-KMP",
    "source_uri": "https://github.com/ShiftHackZ/SDAI-KMP",
    "source_version": "HEAD",
    "content_hash": "813d7a9225e104937ed6bf51e32df1803f26233da04f6dced1903a1b2467057a"
  },
  "evidence_fingerprint": "94110ab92c61e587",
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
        "Direct empirical evidence ratio: 0% (0/2)",
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
        "Harvested/verified timestamp recorded: 2026-11-15T00:37:27.402Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "55def8a5b922c5ef8377db0e024c31c8f1153d9b7a95e7c8c19e0d59ae1d8fe3"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
