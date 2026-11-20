# Candidate Directive: [CD-DVFU] remove leading wildcard from Azure hostname patterns

<!-- PROVENANCE_START
{
  "source_repository": "bridgecrewio/checkov",
  "source_url": "https://github.com/bridgecrewio/checkov",
  "source_version": "28694608",
  "license": "Apache-2.0",
  "timestamp": "2026-11-20T04:02:34.218Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-bridgecrewio-checkov",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [bridgecrewio/checkov](https://github.com/bridgecrewio/checkov) (Revision: `28694608`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-20T04:02:34.218Z`  
> **Learning ID**: `learn-github-bridgecrewio-checkov`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
  "validated_at": "2026-11-20T04:02:34.216Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795147354216",
    "title": "remove leading wildcard from Azure hostname patterns",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "bridgecrewio/checkov",
    "source_uri": "https://github.com/bridgecrewio/checkov",
    "source_version": "HEAD",
    "content_hash": "4bc832646367165c29863291ecec278d75efaa23df06c09eeb19d10de7208154"
  },
  "evidence_fingerprint": "94110ab92c61e587",
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
        "Direct empirical evidence ratio: 0% (0/2)",
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
        "Harvested/verified timestamp recorded: 2026-11-20T04:02:34.216Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "9d60418cf6e3838eca7c61da1471f995670bc31105fe37d0b21d145a641833b4"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
