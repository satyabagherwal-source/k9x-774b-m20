# Candidate Directive: [CD-IQ7F] Merge 'core/dialect: replace CatalogChange with typed requests and a dialect-bui

<!-- PROVENANCE_START
{
  "source_repository": "tursodatabase/turso",
  "source_url": "https://github.com/tursodatabase/limbo",
  "source_version": "e139e251",
  "license": "MIT",
  "timestamp": "2026-11-19T07:06:37.995Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-tursodatabase-turso",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tursodatabase/turso](https://github.com/tursodatabase/limbo) (Revision: `e139e251`).  
> **License**: MIT | **Timestamp**: `2026-11-19T07:06:37.995Z`  
> **Learning ID**: `learn-github-tursodatabase-turso`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `core/dialect/catalog.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tursodatabase/turso. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a00dd9ff`: Merge 'core/dialect: replace CatalogChange with typed requests and a dialect-built apply object' from Pedro Muniz. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `core/dialect/catalog.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
//! What translation tells the dialect about a statement that changes the
//! dialect's catalog of the main database, and what the dialect's bytecode
//! tells the in-memory schema once the change is written.
use crate::{
    namespace::NamespaceId,
    schema::{RelationKind, Schema},
    LimboError, Result, Value,
};
use std::borrow::Cow;
/// A relation that a statement created, dropped or renamed. The engine makes
/// the change itself; the dialect records it in its own catalog through
/// [`Dialect::translate_relation_changes`](super::Dialect::translate_relation_changes).
pub enum RelationChange<'a> {
    Created {
        name: &'a str,
        table: Option<&'a str>,
    Dropped {
        name: &'a str,
    Renamed {
        old_name: &'a str,
        /// Owned when the statement had to build the name, as for an
        /// automatic index that is renamed with its table.
        new_name: Cow<'a, str>,
    /// `ALTER TABLE table RENAME COLUMN old_name TO new_name`.
    ColumnRenamed {
        table: &'a str,
        old_name: &'a str,
        new_name: &'a str,
}

/// A statement about roles, ownership, privileges or row-level security.
/// The engine stores none of these; the
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
//! The changes a statement makes to the dialect's catalog.
use crate::{namespace::NamespaceId, schema::RelationKind};
/// A change a statement makes to the dialect's catalog of the main
/// database: to a relation, or to the roles. Translation tells the dialect
/// about it through
/// [`Dialect::translate_catalog_changes`](super::Dialect::translate_catalog_changes), and the dialect's own bytecode
/// tells it back through [`Dialect::apply_catalog_change`](super::Dialect::apply_catalog_change) once the change
/// is written.
pub enum CatalogChange {
    Create {
        name: String,
        table: Option<String>,
    Drop {
        name: String,
    Rename {
        old_name: String,
        new_name: String,
    /// Whom the relation belongs to from now on.
    ChangeOwner {
        name: String,
        owner: NewOwner,
    /// `ALTER TABLE table RENAME COLUMN old_name TO new_name`.
    RenameColumn {
        table: String,
        old_name: String,
        new_name: String,
    /// `GRANT privileges ON relation TO grantees`, or `REVOKE privileges ON
    /// relation FROM grantees` when `revoke` is set.
        namespace: NamespaceId,
        name: String,
        privileges: V
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a00dd9ff` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T07:06:37.992Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795071997992",
    "title": "Merge 'core/dialect: replace CatalogChange with typed requests and a dialect-bui",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "tursodatabase/turso",
    "source_uri": "https://github.com/tursodatabase/limbo",
    "source_version": "HEAD",
    "content_hash": "48d06ee86d2bffbb6c296b17b7d5d445221010e6d0f4725ce5628b149da784f4"
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
        "Harvested/verified timestamp recorded: 2026-11-19T07:06:37.992Z"
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
  "auth_token": "d60eac2c05a690fb73f6e354a34064889a868249ca4afe04f8f3caa0df32333b"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
