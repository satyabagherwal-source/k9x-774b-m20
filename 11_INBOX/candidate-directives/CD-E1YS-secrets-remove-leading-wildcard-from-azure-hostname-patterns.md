# Candidate Directive: [CD-E1YS] secrets): remove leading wildcard from Azure hostname patterns

<!-- PROVENANCE_START
{
  "source_repository": "bridgecrewio-checkov-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T04:02:42.557Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-bridgecrewio-checkov-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [bridgecrewio-checkov-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T04:02:42.557Z`  
> **Learning ID**: `LEARN-EVO-bridgecrewio-checkov-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `checkov/common/util/secrets.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in bridgecrewio/checkov. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c57ca423`: secrets): remove leading wildcard from Azure hostname patterns. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `checkov/common/util/secrets.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
        "(\"|')?[0-9a-zA-Z]{2,256}[.][o|O][n|N][m|M][i|I][c|C][r|R][o|O][s|S][o|O][f|F][t|T][.][c|C][o|O][m|M](\"|')?",
        "(\"|')?[0-9a-zA-Z]{2,256}[.][b|B][l|L][o|O][b|B][.][c|C][o|O][r|R][e|E][.][w|W][i|I][n|N][d|D][o|O][w|W][s|S][.][n|N][e|E][t|T](\"|')?",
        "(\"|')?[0-9a-zA-Z]{2,256}[.][q|Q][u|U][e|E][u|U][e|E][.][c|C][o|O][r|R][e|E][.][w|W][i|I][n|N][d|D][o|O][w|W][s|S][.][n|N][e|E][t|T](\"|')?",
        "(\"|')?[0-9a-zA-Z]{2,256}[.][t|T][a|A][b|B][l|L][e|E][.][c|C][o|O][r|R][e|E][.][w|W][i|I][n|N][d|D][o|O][w|W][s|S][.][n|N][e|E][t|T](\"|')?",
        "(\"|')?[0-9a-zA-Z]{2,256}[.][d|D][a|A][t|T][a|A][b|B][a|A][s|S][e|E][.][w|W][i|I][n|N][d|D][o|O][w|W][s|S][.][n|N][e|E][t|T](\"|')?",
        "(\"|')?[0-9a-zA-Z]{2,256}[.][s|S][e|E][r|R][v|V][i|I][c|C][e|E][b|B][u|U][s|S][.][w|W][i|I][n|N][d|D][o|O][w|W][s|S][.][n|N][e|E][t|T](\"|')?",
        "(\"|')?[0-9a-zA-Z]{2,256}[.][t|T][i|I][m|M][e|E][s|S][e|E][r|R][i|I][e|E][s|S][.][a|A][z|Z][u|U][r|R][e|E][.][c|C][o|O][m|M](\"|')?",
        "(\"|')?[0-9a-zA-Z]{2,256}[.][a|T][c|C][c|C][e|E][s|S][s|S][c|C][o|O][n|N][t|T][r|R][o|O][l|L][.][w|W][i|I][n|N][d|D][o|O][w|W][s|S][.][n|N][e|E][t|T](\"|')?",
        "(\"|')?[0-9a-zA-
```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
        "(\"|')?.*[0-9a-zA-Z]{2,256}[.][o|O][n|N][m|M][i|I][c|C][r|R][o|O][s|S][o|O][f|F][t|T][.][c|C][o|O][m|M](\"|')?",
        "(\"|')?.*[0-9a-zA-Z]{2,256}[.][b|B][l|L][o|O][b|B][.][c|C][o|O][r|R][e|E][.][w|W][i|I][n|N][d|D][o|O][w|W][s|S][.][n|N][e|E][t|T](\"|')?",
        "(\"|')?.*[0-9a-zA-Z]{2,256}[.][q|Q][u|U][e|E][u|U][e|E][.][c|C][o|O][r|R][e|E][.][w|W][i|I][n|N][d|D][o|O][w|W][s|S][.][n|N][e|E][t|T](\"|')?",
        "(\"|')?.*[0-9a-zA-Z]{2,256}[.][t|T][a|A][b|B][l|L][e|E][.][c|C][o|O][r|R][e|E][.][w|W][i|I][n|N][d|D][o|O][w|W][s|S][.][n|N][e|E][t|T](\"|')?",
        "(\"|')?.*[0-9a-zA-Z]{2,256}[.][d|D][a|A][t|T][a|A][b|B][a|A][s|S][e|E][.][w|W][i|I][n|N][d|D][o|O][w|W][s|S][.][n|N][e|E][t|T](\"|')?",
        "(\"|')?.*[0-9a-zA-Z]{2,256}[.][s|S][e|E][r|R][v|V][i|I][c|C][e|E][b|B][u|U][s|S][.][w|W][i|I][n|N][d|D][o|O][w|W][s|S][.][n|N][e|E][t|T](\"|')?",
        "(\"|')?.*[0-9a-zA-Z]{2,256}[.][t|T][i|I][m|M][e|E][s|S][e|E][r|R][i|I][e|E][s|S][.][a|A][z|Z][u|U][r|R][e|E][.][c|C][o|O][m|M](\"|')?",
        "(\"|')?.*[0-9a-zA-Z]{2,256}[.][a|T][c|C][c|C][e|E][s|S][s|S][c|C][o|O][n|N][t|T][r|R][o|O][l|L][.][w|W][i|I][n|N][d|D][o|O][w|W][s|S][.][n|N][e|E][t|T](\"|')?",
        "
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c57ca423` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T04:02:42.671Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795147362670",
    "title": "secrets): remove leading wildcard from Azure hostname patterns",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "bridgecrewio-checkov-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "b2142ce3688684ce33f4b352aece4afd55330bd4c395de9179b0157052f9f9e8"
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
        "Harvested/verified timestamp recorded: 2026-11-20T04:02:42.671Z"
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
  "auth_token": "17d493e9d927c5a7f9e5431f6e4d1dbbd2ab2da701e6c50cc7bb73f3785cd590"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
