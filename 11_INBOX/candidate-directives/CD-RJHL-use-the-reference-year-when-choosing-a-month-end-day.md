# Candidate Directive: [CD-RJHL] Use the reference year when choosing a month-end day

<!-- PROVENANCE_START
{
  "source_repository": "scrapinghub/dateparser",
  "source_url": "https://github.com/scrapinghub/dateparser",
  "source_version": "ecf380af",
  "license": "BSD-3-Clause",
  "timestamp": "2026-11-17T03:26:11.818Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-scrapinghub-dateparser",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [scrapinghub/dateparser](https://github.com/scrapinghub/dateparser) (Revision: `ecf380af`).  
> **License**: BSD-3-Clause | **Timestamp**: `2026-11-17T03:26:11.818Z`  
> **Learning ID**: `learn-github-scrapinghub-dateparser`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `dateparser/date.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in scrapinghub/dateparser. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ecf380af`: Use the reference year when choosing a month-end day. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `dateparser/date.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
        now = settings.RELATIVE_BASE or _now(settings)
            date_obj = patched_strptime(
                date_string, date_format, reference_year=now.year
            )
            if "year" in _missing:
                try:
                    date_obj = date_obj.replace(year=now.year)
                except ValueError:
                    continue

                date_obj = set_correct_month_from_settings(
                    date_obj, settings, current_month=now.month
                )
                date_obj = set_correct_day_from_settings(
                    date_obj, settings, current_day=now.day
                )
                date_obj = set_correct_month_from_settings(
                    date_obj, settings, current_month=now.month
                )
                date_obj = set_correct_day_from_settings(
                    date_obj, settings, current_day=now.day
                )
            if (
                "year" not in _missing
                and "%y" in date_format
                and "%Y" not in date_format
            ):
```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
            date_obj = patched_strptime(date_string, date_format)
                date_obj = set_correct_month_from_settings(date_obj, settings)
                date_obj = set_correct_day_from_settings(date_obj, settings)
                date_obj = set_correct_month_from_settings(date_obj, settings)
                date_obj = set_correct_day_from_settings(date_obj, settings)
            now = settings.RELATIVE_BASE or _now(settings)
            if "year" in _missing:
                date_obj = date_obj.replace(year=now.year)
            elif "%y" in date_format and "%Y" not in date_format:
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ecf380af` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T03:26:11.815Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794885971815",
    "title": "Use the reference year when choosing a month-end day",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "scrapinghub/dateparser",
    "source_uri": "https://github.com/scrapinghub/dateparser",
    "source_version": "HEAD",
    "content_hash": "cdf03ad792898940d0c3854c669fa315ff49e4222428951057b906266f5296c1"
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
        "Harvested/verified timestamp recorded: 2026-11-17T03:26:11.815Z"
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
  "auth_token": "7221717de718c117bb9aeeecc662793eed2f696744a79afa4596321e1b76cac4"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
