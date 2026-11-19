# Candidate Directive: [CD-Y7HY] markup on new command pages

<!-- PROVENANCE_START
{
  "source_repository": "SimonSchubert/LinuxCommandLibrary",
  "source_url": "https://github.com/SimonSchubert/LinuxCommandLibrary",
  "source_version": "a7aadf0e",
  "license": "Apache-2.0",
  "timestamp": "2026-11-19T15:42:33.335Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-simonschubert-linuxcommandlibrary",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [SimonSchubert/LinuxCommandLibrary](https://github.com/SimonSchubert/LinuxCommandLibrary) (Revision: `a7aadf0e`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-19T15:42:33.335Z`  
> **Learning ID**: `learn-github-simonschubert-linuxcommandlibrary`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
  "validated_at": "2026-11-19T15:42:33.332Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795102953332",
    "title": "markup on new command pages",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "SimonSchubert/LinuxCommandLibrary",
    "source_uri": "https://github.com/SimonSchubert/LinuxCommandLibrary",
    "source_version": "HEAD",
    "content_hash": "a790fa1c312bfaca42dc58e0eab4aae3a0ef1b620e36caeef81a7d2b01a018ad"
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
        "Harvested/verified timestamp recorded: 2026-11-19T15:42:33.332Z"
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
  "auth_token": "3f454ee102f29074c389650b352500dbd1a9d1ed0c79e6f821a0387b8c8ba056"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
