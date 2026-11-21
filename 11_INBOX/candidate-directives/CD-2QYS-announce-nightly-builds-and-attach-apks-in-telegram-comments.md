# Candidate Directive: [CD-2QYS] Announce nightly builds and attach APKs in Telegram comments

<!-- PROVENANCE_START
{
  "source_repository": "shifthackz-sdai-kmp-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T06:01:33.593Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-shifthackz-sdai-kmp-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [shifthackz-sdai-kmp-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T06:01:33.593Z`  
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
Prevents defects observed in production commit `82ebd42d`: Announce nightly builds and attach APKs in Telegram comments. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/nightly_android.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
  TELEGRAM_BOT_API_REVISION: 7232881b39dfcd048a0d569f1983c5184249ee05
          functional_pattern='^(app/|core/|data/|demo/|domain/|feature/|network/|presentation/|storage/|build-logic/|gradle/|scripts/nightly/|build\.gradle\.kts$|settings\.gradle\.kts$|gradle\.properties$|gradlew$|gradlew\.bat$|\.github/workflows/nightly_android\.yml$)'
      - name: Prepare nightly announcements
        id: announcement
            '{
              version: $version,
              installation_note: "Installs alongside stable SDAI with separate app data.",
              changes: $changes[:1000],
              links: [
                [{text: "Download latest APK", url: $download_url}, {text: "Release details", url: $release_url}],
                [{text: ("Commit " + $commit[:8]), url: $commit_url}, {text: "Build", url: $run_url},
                 {text: "Report an issue", url: $feedback_url}]
              ],
              footer: "Preview build for testing. The download link always serves the latest nightly."
            }' > "${output_dir}/announcement.json"

          jq '{allowed_mentions: {parse: []}, embeds: [{
            title: .title,
            url: .links[0][1].url,
            colo
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Induced defect failure mode:
          functional_pattern='^(app/|core/|data/|demo/|domain/|feature/|network/|presentation/|storage/|build-logic/|gradle/|build\.gradle\.kts$|settings\.gradle\.kts$|gradle\.properties$|gradlew$|gradlew\.bat$|\.github/workflows/nightly_android\.yml$)'
      - name: Announce nightly on Discord
          DISCORD_WEBHOOK_URL: ${{ secrets.DISCORD_NIGHTLY_WEBHOOK_URL }}
          if [[ -z "${DISCORD_WEBHOOK_URL}" ]]; then
            echo "::notice::Discord notification skipped: DISCORD_NIGHTLY_WEBHOOK_URL is not configured."
            exit 0
          fi

            '{allowed_mentions: {parse: []}, embeds: [{
              url: $release_url,
              color: 7684269,

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T06:01:33.696Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795240893696",
    "title": "Announce nightly builds and attach APKs in Telegram comments",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "shifthackz-sdai-kmp-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "a37ef340eb204105610de8db3d42086d08235156efe0846b77a7e3410a9ed6d8"
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
        "Harvested/verified timestamp recorded: 2026-11-21T06:01:33.697Z"
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
  "auth_token": "63ab735e8f7155962878a44c37269584a10d04984fbf9a7159a1c0360b53f121"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
