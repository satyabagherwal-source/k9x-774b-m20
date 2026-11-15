# Candidate Directive: [CD-W2FH] Sign nightly APKs with the release keystore

<!-- PROVENANCE_START
{
  "source_repository": "shifthackz-sdai-kmp-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-15T00:38:24.735Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-shifthackz-sdai-kmp-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [shifthackz-sdai-kmp-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-15T00:38:24.735Z`  
> **Learning ID**: `LEARN-EVO-shifthackz-sdai-kmp-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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
  "validated_at": "2026-11-15T00:38:24.840Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794703104840",
    "title": "Sign nightly APKs with the release keystore",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "shifthackz-sdai-kmp-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "813d7a9225e104937ed6bf51e32df1803f26233da04f6dced1903a1b2467057a"
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
        "Harvested/verified timestamp recorded: 2026-11-15T00:38:24.841Z"
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
  "auth_token": "0c809306a15b40d4b79f271d06c6dc3b15685d50f6548594a7c7b4e1049bf396"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
