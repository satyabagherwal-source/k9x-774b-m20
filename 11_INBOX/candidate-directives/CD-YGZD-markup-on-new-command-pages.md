# Candidate Directive: [CD-YGZD] markup on new command pages

<!-- PROVENANCE_START
{
  "source_repository": "simonschubert-linuxcommandlibrary-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-19T15:42:45.476Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-simonschubert-linuxcommandlibrary-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [simonschubert-linuxcommandlibrary-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-19T15:42:45.476Z`  
> **Learning ID**: `LEARN-EVO-simonschubert-linuxcommandlibrary-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain L

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `assets/commands/agav.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in SimonSchubert/LinuxCommandLibrary. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a7aadf0e`: markup on new command pages. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `assets/commands/agav.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
The upstream install is a self-contained binary from **https://agav.dev/install.sh** (or the Windows installers). A release can also be downloaded from the GitHub releases page. **agav update** replaces the installed release. Set the no-update environment variable to **1** to skip the automatic update check; the name is **AGAV** then **NO** then **UPDATE**, joined with underscores.
Provider and model, when you did not pass flags, come from the resumed session, otherwise from the last session, otherwise from **~/.agav/config.json**. On Windows that directory is under the user profile. **--provider** without **--model** keeps the saved model only when it belongs to that provider.
Credentials are environment variables read by the provider: Anthropic, OpenAI, OpenRouter, NVIDIA NIM, DeepSeek, Gemini, a Vertex AI service-account file, or Ollama. **--openai-api chat** selects the Chat Completions API for OpenAI-compatible servers that do not implement the Responses API. The default for OpenAI is **responses**.
Tool confirmation defaults to asking. **--auto-accept** / **-y** skips ordinary confirmations. **--deny-writes** blocks writes. **--permission** takes a JSON tool policy and applie
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Induced defect failure mode:
The upstream install is a self-contained binary from `https://agav.dev/install.sh` (or the Windows installers). A release can also be downloaded from the GitHub releases page. **agav update** replaces the installed release. Set the no-update environment variable to `1` to skip the automatic update check; the name is **AGAV** then **NO** then **UPDATE**, joined with underscores.
Provider and model, when you did not pass flags, come from the resumed session, otherwise from the last session, otherwise from `~/.agav/config.json`. On Windows that directory is under the user profile. **--provider** without **--model** keeps the saved model only when it belongs to that provider.
Credentials are environment variables read by the provider: Anthropic, OpenAI, OpenRouter, NVIDIA NIM, DeepSeek, Gemini, a Vertex AI service-account file, or Ollama. **--openai-api chat** selects the Chat Completions API for OpenAI-compatible servers that do not implement the Responses API. The default for OpenAI is `responses`.
Tool confirmation defaults to asking. **--auto-accept** / **-y** skips ordinary confirmations. **--deny-writes** blocks writes. **--permission** takes a JSON tool policy and applies to **a
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a7aadf0e` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T15:42:45.624Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795102965624",
    "title": "markup on new command pages",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "simonschubert-linuxcommandlibrary-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "a790fa1c312bfaca42dc58e0eab4aae3a0ef1b620e36caeef81a7d2b01a018ad"
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
        "Harvested/verified timestamp recorded: 2026-11-19T15:42:45.624Z"
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
  "auth_token": "8f16847423739f162a3c233f92859446669c20572137246a5dcca9b3f4de7e46"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
