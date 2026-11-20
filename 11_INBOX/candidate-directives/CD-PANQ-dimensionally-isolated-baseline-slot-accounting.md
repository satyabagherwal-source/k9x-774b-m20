# Candidate Directive: [CD-PANQ] Dimensionally Isolated Baseline Slot Accounting

<!-- PROVENANCE_START
{
  "source_repository": "fallow-rs-fallow-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T01:23:29.349Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-fallow-rs-fallow-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [fallow-rs-fallow-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T01:23:29.349Z`  
> **Learning ID**: `LEARN-EVO-fallow-rs-fallow-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T01:23:29.461Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795137809461",
    "title": "Dimensionally Isolated Baseline Slot Accounting",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "fallow-rs-fallow-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "f3cd413d01061c3a1836f305c736e3f7e6201a6a0bfd987834befb09f48ca849"
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
        "Harvested/verified timestamp recorded: 2026-11-20T01:23:29.461Z"
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
  "auth_token": "9f6545040744c685c5de55689ec22fea91f648ca4963ff5c593a8c334b459edc"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
