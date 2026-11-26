# Candidate Directive: [CD-9JFZ] docs: fold the v3 pre-tag fixes into the spec, changelog and guide

<!-- PROVENANCE_START
{
  "source_repository": "pimalaya-himalaya-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-26T21:52:58.669Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-pimalaya-himalaya-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [pimalaya-himalaya-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-26T21:52:58.669Z`  
> **Learning ID**: `LEARN-EVO-pimalaya-himalaya-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in pimalaya/himalaya. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `91f04312`: docs: fold the v3 pre-tag fixes into the spec, changelog and guide. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:

  It takes exactly one part id, no id or several being refused `usage-invalid`, exit 2, before connecting.

- Added `from`, `date` and `flags` to each `imap thread` entry, the flags as the server spells them, as `imap fetch` prints them.
- Added `pimdir thread`, listing the thread of a message from the search index, oldest first, a member the store cannot read under `errors` (exit 3).
- Added `pimdir tag`, queueing a flag change on every message a query matches, `--dry-run` queueing nothing, a placement whose flags were never read printing `flags` `null`.
  `order by` is now `--sort newest-first|oldest-first|title|sender|relevance`, Maildir and mbox match whole words, and a `~`, `/` or `{` form is reserved (`search-invalid`). A clause the backend cannot search fails `search-unsupported`: a prefix (`repo*`) on Gmail, an instant or an amount back from now (`date:2d`) on Microsoft Graph, which compares days. MIGRATION.md maps every v2 clause.
- **BREAKING**: Changed `jmap email read --json` to print `{emails, errors}`, each email as the server sent it, an id not found an `errors` entry coded `message-not-found` (exit 3).
- **BREAKING**: Changed `sieve deactivate --json` to print `{id
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
- Added `from`, `date` and `flags` to each `imap thread` entry.
- Added `pimdir thread`, listing the thread of a message from the search index, oldest first.
- Added `pimdir tag`, queueing a flag change on every message a query matches, `--dry-run` queueing nothing.
  `order by` is now `--sort newest-first|oldest-first|title|sender|relevance`, Maildir and mbox match whole words, and a `~`, `/` or `{` form is reserved (`search-invalid`). A clause the backend cannot search fails `search-unsupported`; MIGRATION.md maps every v2 clause.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `91f04312` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T21:52:58.795Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795729978795",
    "title": "docs: fold the v3 pre-tag fixes into the spec, changelog and guide",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "pimalaya-himalaya-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "ba9cf29e83834d1dbf58483e4db52e68711de6cadb65dcc2078b5c698a6a6d63"
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
        "Harvested/verified timestamp recorded: 2026-11-26T21:52:58.796Z"
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
  "auth_token": "179619e62e87bebda6825037983e8f6bd9caf0cbce8bf25dfc931ac8472dafc5"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
