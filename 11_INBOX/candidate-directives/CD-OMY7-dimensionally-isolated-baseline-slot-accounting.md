# Candidate Directive: [CD-OMY7] Dimensionally Isolated Baseline Slot Accounting

<!-- PROVENANCE_START
{
  "source_repository": "fallow-rs/fallow",
  "source_url": "https://github.com/fallow-rs/fallow",
  "source_version": "202f6188",
  "license": "MIT",
  "timestamp": "2026-11-20T01:22:58.735Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-fallow-rs-fallow",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [fallow-rs/fallow](https://github.com/fallow-rs/fallow) (Revision: `202f6188`).  
> **License**: MIT | **Timestamp**: `2026-11-20T01:22:58.735Z`  
> **Learning ID**: `learn-github-fallow-rs-fallow`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
A baseline tracking system MUST maintain strict orthogonal dimension boundaries for finding categories and MUST NOT aggregate findings of differing semantics (e.g., file-length violations vs. function-complexity violations) into shared severity buckets.

**WHY**:
If findings from different architectural dimensions share a generic bucket (e.g., `complexity_moderate`), fixing a violation in one dimension (e.g., refactoring a complex function) frees up a slot that can be silently consumed by an introduced defect in another dimension (e.g., an oversized file exceeding line-count thresholds). This invalidates CI/CD regression gates.

**WHEN TO APPLY**:
Audit baselines, linters, static code metrics, and static quality gates supporting ratchet/shrink-only baseline enforcement.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum HealthFindingDimension {
    Complexity,
    Crap,
    FileLength,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct HealthFindingCategory {
    pub dimension: HealthFindingDimension,
    pub severity: FindingSeverity,
}

impl HealthFindingCategory {
    pub const fn key(self) -> &'static str {
        match (self.dimension, self.severity) {
            (HealthFindingDimension::Complexity, FindingSeverity::Moderate) => "complexity_moderate",
            (HealthFindingDimension::Complexity, FindingSeverity::High) => "complexity_high",
            (HealthFindingDimension::Complexity, FindingSeverity::Critical) => "complexity_critical",
            (HealthFindingDimension::Crap, FindingSeverity::Moderate) => "crap_moderate",
            (HealthFindingDimension::Crap, FindingSeverity::High) => "crap_high",
            (HealthFindingDimension::Crap, FindingSeverity::Critical) => "crap_critical",
            (HealthFindingDimension::FileLength, FindingSeverity::Moderate) => "file_lines_moderate",
            (HealthFindingDimension::FileLength, FindingSeverity::High) => "file_lines_high",
            (HealthFindingDimension::FileLength, FindingSeverity::Critical) => "file_lines_critical",
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER collapse heterogeneous violations into a single dimension
fn map_finding_to_bucket(finding: &Finding) -> &'static str {
    // ANTI-PATTERN: File lines categorized as cyclomatic/cognitive complexity!
    // Fixing a complex function frees a slot for a runaway 5000-line file.
    match finding.severity {
        Severity::Moderate => "complexity_moderate",
        Severity::High => "complexity_high",
    }
}
```

**VERIFICATION METHOD**:
Construct a baseline test fixture containing one complex function and zero file-length findings. In the next iteration, assert that fixing the function while simultaneously introducing a file crossing `maxFileLines` results in an `introduced: true` violation.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T01:22:58.735Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795137778735",
    "title": "Dimensionally Isolated Baseline Slot Accounting",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "fallow-rs/fallow",
    "source_uri": "https://github.com/fallow-rs/fallow",
    "source_version": "HEAD",
    "content_hash": "83de7ece47615539a1b427e7c0eec2ad3619e2ff4a0c1fb98dbe19871ecc4553"
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
        "Expresses generalized engineering invariants (2 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-20T01:22:58.735Z"
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
  "auth_token": "f39d686ce47da5bb5f1ca5d9ddc26cbe05e50ee6a8d953c7a574e6c68c237e92"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
