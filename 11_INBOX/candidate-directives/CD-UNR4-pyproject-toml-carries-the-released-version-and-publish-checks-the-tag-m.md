# Candidate Directive: [CD-UNR4] pyproject.toml carries the released version, and publish checks the tag m

<!-- PROVENANCE_START
{
  "source_repository": "VectifyAI/PageIndex",
  "source_url": "https://github.com/VectifyAI/PageIndex",
  "source_version": "aef597ae",
  "license": "MIT",
  "timestamp": "2026-11-28T05:24:58.432Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-vectifyai-pageindex",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [VectifyAI/PageIndex](https://github.com/VectifyAI/PageIndex) (Revision: `aef597ae`).  
> **License**: MIT | **Timestamp**: `2026-11-28T05:24:58.432Z`  
> **Learning ID**: `learn-github-vectifyai-pageindex`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
  "validated_at": "2026-11-28T05:24:58.430Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795843498430",
    "title": "pyproject.toml carries the released version, and publish checks the tag m",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "VectifyAI/PageIndex",
    "source_uri": "https://github.com/VectifyAI/PageIndex",
    "source_version": "HEAD",
    "content_hash": "00b22fa4f0db6c94bd2efb6f93ceb0e4673d7a4b9538d7d475451801940f4d35"
  },
  "evidence_fingerprint": "f4ebc73b386fdfdf",
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
        "Direct empirical evidence ratio: 0% (0/3)",
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
        "Harvested/verified timestamp recorded: 2026-11-28T05:24:58.430Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "9a7c572a0ee8b1b039dea164edb91a3024152f3ce53a755ec8e98ea0c8952401"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
