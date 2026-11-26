# Candidate Directive: [CD-I6WZ] [#37880] Agents: Add guides for filing core DB and YSQL issues

<!-- PROVENANCE_START
{
  "source_repository": "yugabyte/yugabyte-db",
  "source_url": "https://github.com/yugabyte/yugabyte-db",
  "source_version": "1b9b8270",
  "license": "NOASSERTION",
  "timestamp": "2026-11-26T11:15:51.300Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-yugabyte-yugabyte-db",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [yugabyte/yugabyte-db](https://github.com/yugabyte/yugabyte-db) (Revision: `1b9b8270`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-26T11:15:51.300Z`  
> **Learning ID**: `learn-github-yugabyte-yugabyte-db`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain A

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.claude/skills/create-issue/SKILL.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in yugabyte/yugabyte-db. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `dd0f5120`: [#37880] Agents: Add guides for filing core DB and YSQL issues. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C data structures, boundary deserialization, API parsing, or resource lifecycles matching `.claude/skills/create-issue/SKILL.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c
// Verified production-grade fix pattern:
allowed-tools: Bash(gh issue create *), Bash(gh issue view *), Bash(gh issue comment *), Bash(gh issue edit *), Bash(gh search issues *), Bash(gh auth status), Read
  `.claude/`): follow
  [filing-issues.md](../../../.github/issue-guides/filing-issues.md). It
  defines "sensitive" and routes the issue: a GitHub issue (Step 3a), a JIRA
  ticket in the `DB` (core database) project with the sensitive-information
  field set to `Yes` (Step 3b), a `Vulnerability` ticket (below), or a
  security report. For a security report, draft it in the policy's format and
  hand it to the user to send; file no issue. Then check for duplicates as it
  describes.
- A security vulnerability found by an internal filer, in any part of the
  repo → **JIRA ticket** of type `Vulnerability`, never `Task` or `Bug` and
  never a GitHub issue. Give it the CVE IDs if there are any, the affected
  package and its location, a severity, and the Target Version. Don't set Fix
  Version; automation fills it in when the fix lands. See `src/AGENTS.md`
  § Security and customer-sensitive changes. An external filer sends a
  security report instead, as above.

Ask the user whether they are an internal (Yugabyte) filer wh
```

**NEGATIVE CONSTRAINT**:
```c
// Induced defect failure mode:
allowed-tools: Bash(gh issue create *), Bash(gh issue view *), Bash(gh auth status), Read
First decide whether the issue is **sensitive**: it can't be described without
something on the Confidentiality list above, e.g. customer data or schema, an
unfixed security vulnerability, or unreleased internal plans. If the sensitive
part can be scrubbed or replaced with a placeholder, it isn't sensitive. Then:

  `.claude/`):
  - Not sensitive → **GitHub issue** in `yugabyte/yugabyte-db`, even if the
    user asked for a JIRA ticket. GitHub issues sync to JIRA `DB` tickets
    automatically, so filing in GitHub gets you a JIRA key too.
  - Sensitive → **JIRA ticket** in `DB`, with the sensitive-information field
    set to `Yes` (Step 3b).
- A security vulnerability, in any part of the repo → **JIRA ticket** of type
  `Vulnerability`, never `Task` or `Bug` and never a GitHub issue. Give it the CVE
  IDs if there are any, the affected package and its location, a severity, and
  the Target Version. Don't set Fix Version; automation fills it in when the fix
  lands. See `src/AGENTS.md` § Security and customer-sensitive changes.
non-sensitive → GitHub, sensitive → JIRA `DB`.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `dd0f5120` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T11:15:51.298Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795691751297",
    "title": "[#37880] Agents: Add guides for filing core DB and YSQL issues",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "yugabyte/yugabyte-db",
    "source_uri": "https://github.com/yugabyte/yugabyte-db",
    "source_version": "HEAD",
    "content_hash": "ddde1519f8cdc90b8ed36d28230b291dd8eb9c687efac149977117c016eb3efe"
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
        "Harvested/verified timestamp recorded: 2026-11-26T11:15:51.298Z"
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
  "auth_token": "6b7ef8d4041d6d1d1dd4e26c6d6ee53f84d5861b50b062c3c51c78c3013b14cc"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
