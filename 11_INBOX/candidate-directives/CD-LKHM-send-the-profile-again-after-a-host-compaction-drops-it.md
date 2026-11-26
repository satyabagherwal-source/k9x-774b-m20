# Candidate Directive: [CD-LKHM] send the profile again after a host compaction drops it

<!-- PROVENANCE_START
{
  "source_repository": "volcengine/OpenViking",
  "source_url": "https://github.com/volcengine/OpenViking",
  "source_version": "fe354f74",
  "license": "AGPL-3.0",
  "timestamp": "2026-11-26T15:02:25.786Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-volcengine-openviking",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [volcengine/OpenViking](https://github.com/volcengine/OpenViking) (Revision: `fe354f74`).  
> **License**: AGPL-3.0 | **Timestamp**: `2026-11-26T15:02:25.786Z`  
> **Learning ID**: `learn-github-volcengine-openviking`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `docs/en/agent-integrations/16-capability-reference.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in volcengine/OpenViking. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2b4dc8c4`: plugins): send the profile again after a host compaction drops it. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/en/agent-integrations/16-capability-reference.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
| DSH | Yes, session-aware | Profile, memory index, skills | At 20,000 pending tokens | Yes, with a 3-second budget | Commits, then the host summarizes |
| Codex | `SessionStart` on startup, clear, resume, and compact |
| Cursor, TRAE, TRAE CN, ZCode | `SessionStart` |
| Antigravity | `SessionStart`, and the first turn after each compaction checkpoint in the transcript |
| CodeBuddy Code | `SessionStart`, every source; it can be delivered twice in one session, so the hook is idempotent. CodeBuddy drops `SessionStart` context at a compaction, so the next prompt sends it again |
| OpenCode | The first message of each session and the first after each compaction; not retried after a failure, and skipped for subagent sessions. The list of indexed repositories also goes into the system prompt |
| DSH | At session start, and again on the next model step when a compaction dropped it |
| Codex, TraeCode CLI 2.0 | Host summarizes | `PreCompact` catches up uncaptured turns, commits everything, and starts a new OpenViking session. If the catch-up is incomplete, it does not commit and retries later | `SessionStart` with `source="compact"` sends the profile again; the archive summary is injected
```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
| DSH | Yes, session-aware | Profile, memory index, skills, once per session | At 20,000 pending tokens | Yes, with a 3-second budget | Commits, then the host summarizes |
| Codex | `SessionStart` on startup, clear, and resume |
| Cursor, TRAE, TRAE CN, ZCode, Antigravity | `SessionStart` |
| CodeBuddy Code | `SessionStart`, every source; it can be delivered twice in one session, so the hook is idempotent |
| OpenCode | The first message of each session; not retried after a failure, and skipped for subagent sessions. The list of indexed repositories also goes into the system prompt |
| DSH | Once per session; not sent again after compaction |
| Codex, TraeCode CLI 2.0 | Host summarizes | `PreCompact` catches up uncaptured turns, commits everything, and starts a new OpenViking session. If the catch-up is incomplete, it does not commit and retries later | The archive summary is injected on resume |
| CodeBuddy Code | Host summarizes | `PreCompact` commits | Nothing |
| Antigravity | Not verified | No pre-compaction hook | Nothing |
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2b4dc8c4` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T15:02:25.784Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795705345784",
    "title": "send the profile again after a host compaction drops it",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "volcengine/OpenViking",
    "source_uri": "https://github.com/volcengine/OpenViking",
    "source_version": "HEAD",
    "content_hash": "5abd3a11c05949c32d2ad94c5ee30503b05b540a50f00f58b7737eed43c5e519"
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
        "Expresses generalized engineering invariants (5 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-26T15:02:25.784Z"
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
  "auth_token": "3c2e1b86565f623ed0e9083815a15ee57c4de728075deafdca03997648ff947f"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
