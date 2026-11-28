# Candidate Directive: [CD-UUHE] build: pyproject.toml carries the released version, and publish checks the tag m

<!-- PROVENANCE_START
{
  "source_repository": "vectifyai-pageindex-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-28T05:25:07.026Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-vectifyai-pageindex-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [vectifyai-pageindex-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-28T05:25:07.026Z`  
> **Learning ID**: `LEARN-EVO-vectifyai-pageindex-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.github/workflows/publish.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in VectifyAI/PageIndex. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `aef597ae`: build: pyproject.toml carries the released version, and publish checks the tag matches it instead of writing it in. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/publish.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
# Release flow:
#   1. Set `version` in pyproject.toml to the new version on the commit you tag.
#   2. git tag -a v0.2.9 -m "Release 0.2.9"
#   3. git push origin v0.2.9
#   4. This workflow checks the tag matches pyproject.toml, builds, publishes
#      to PyPI via OIDC trusted publishing (no stored secret), and creates a
#      GitHub Release with generated notes (dev tags publish to PyPI only — no
#      GitHub Release).
      - name: Check the tag matches pyproject.toml
        run: grep -qxF "version = \"${GITHUB_REF_NAME#v}\"" pyproject.toml || { echo "::error::Tag $GITHUB_REF_NAME does not match the version in pyproject.toml"; exit 1; }
      - name: Check version and build
```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
# Release flow (the git tag IS the version — nothing to bump in the repo):
#   1. git tag -a v0.2.9 -m "Release 0.2.9"
#   2. git push origin v0.2.9
#   3. This workflow derives the version from the tag, injects it into
#      pyproject.toml, builds, publishes to PyPI via OIDC trusted publishing
#      (no stored secret), and creates a GitHub Release with generated notes
#      (dev tags publish to PyPI only — no GitHub Release).
      - name: Set version from tag and build
          # The git tag is the single source of truth; overwrite the static
          # placeholder in [tool.poetry] so the built artifacts carry $VERSION.
          sed -i "s/^version = .*/version = \"$VERSION\"/" pyproject.toml
          grep '^version = ' pyproject.toml
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `aef597ae` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T05:25:07.152Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795843507152",
    "title": "build: pyproject.toml carries the released version, and publish checks the tag m",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "vectifyai-pageindex-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "3df2e103a1356aac08113e80660f2d7b6c60a0564cd586c34b2c2edfb541eb54"
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
        "Harvested/verified timestamp recorded: 2026-11-28T05:25:07.152Z"
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
  "auth_token": "81ebcb023ffb7ef9acbbed87eea31bcdc4b76121ff81059d9f209cb99e8e7829"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
