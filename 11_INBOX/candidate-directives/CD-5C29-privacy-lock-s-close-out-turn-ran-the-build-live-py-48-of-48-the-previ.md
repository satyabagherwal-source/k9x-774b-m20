# Candidate Directive: [CD-5C29] privacy-lock's close-out turn ran: the build, live.py 48 of 48, the previ

<!-- PROVENANCE_START
{
  "source_repository": "Saffsanity/sill",
  "source_url": "https://github.com/Saffsanity/sill",
  "source_version": "c33d1057",
  "license": "Apache-2.0",
  "timestamp": "2026-11-21T03:15:36.658Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-saffsanity-sill",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Saffsanity/sill](https://github.com/Saffsanity/sill) (Revision: `c33d1057`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-21T03:15:36.658Z`  
> **Learning ID**: `learn-github-saffsanity-sill`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `docs/steps/2026-11-18-privacy-lock.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Saffsanity/sill. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `3919e780`: Steps: privacy-lock's close-out turn ran: the build, live.py 48 of 48, the previews, run-all, H2 as main's. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/steps/2026-11-18-privacy-lock.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
  close-out's turn ran at 22:37 at 34c899ed: `swift build -c release` passed; `Scripts/privacy-check/live.py OUT all`,
  48 of 48 verdicts hold, the nosleep and away cases among them; the previews drawn from the bare binary (326, the
  eight lock panes among them, SillMenuBar's lock keys in this Mac's defaults as they were); run-all, every check
  passed. H2 again (the CLI's stdout without the flag): idle, identical to main's recorded lines; with a Desktop
  client, five runs differ from the lines recorded in the first round only in the statistics line of the second the
  client leaves (which counters it holds, and whether it still counts the client), and main's own CLI (eb48ac9f), run
  twice the same night, differs from its own recorded lines in the same way, line for line as the branch's last two
  runs: the branch's stdout is main's.
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
  close-out's turn (`swift build -c release`, `Scripts/privacy-check/live.py OUT all` with the nosleep and away cases,
  H2 again against main's recorded lines, the previews from the bare binary, run-all) waits in heavy.sh's queue, with
  four other agents' jobs in it at 15:45: its results go in the pull request and here.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `3919e780` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T03:15:36.656Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795230936656",
    "title": "privacy-lock's close-out turn ran: the build, live.py 48 of 48, the previ",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "Saffsanity/sill",
    "source_uri": "https://github.com/Saffsanity/sill",
    "source_version": "HEAD",
    "content_hash": "1158e419d59d2afacc3a2fc58d88646c54c7513782175deb242fa5f55e9ff182"
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
        "Harvested/verified timestamp recorded: 2026-11-21T03:15:36.656Z"
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
  "auth_token": "8211dfb46b4e7403a581066815be02383206565ae3fee58323bacfb5daa24f45"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
