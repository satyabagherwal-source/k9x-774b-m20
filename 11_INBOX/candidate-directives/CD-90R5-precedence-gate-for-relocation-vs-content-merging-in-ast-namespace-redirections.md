# Candidate Directive: [CD-90R5] Precedence Gate for Relocation vs Content Merging in AST/Namespace Redirections

<!-- PROVENANCE_START
{
  "source_repository": "gitoxidelabs-gitoxide-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-18T08:07:23.825Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-gitoxidelabs-gitoxide-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [gitoxidelabs-gitoxide-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-18T08:07:23.825Z`  
> **Learning ID**: `LEARN-EVO-gitoxidelabs-gitoxide-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When resolving conflicting transformations in a hierarchical graph or namespace (such as tree renames or AST refactorings), any explicit rename or direct modification that blocks a heuristically inferred relocation MUST be committed at its explicit path and short-circuit the resolution chain *prior* to triggering content-level or scalar diffing. Inferred relocations MUST NOT push heterogeneous entity kinds (e.g., gitlinks vs blobs) into type-specific scalar mergers.

**WHY**:
Heuristic directory renames (e.g., directory `a/` moved to `c/`) will project child changes into the target directory. If side $A$ explicitly modifies or adds an entry at `c/a` and side $B$ moves `a/a` (such as a Gitlink/submodule commit pointer) to `c/a`, passing these two nodes to a standard content differ causes an invariant panic (e.g., `Can only diff blobs, not Commit`). Explicit assignments take precedence over inferred relocations.

**WHEN TO APPLY**:
- Version control merge drivers (three-way file/tree resolution).
- Abstract Syntax Tree (AST) tree-sitter or compiler macro transforms where symbol movements collide with newly introduced symbols.
- Distributed virtual file systems (VFS) synchronizing client directory moves with server renames.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Source derived from gix-merge/src/tree/function/resolve.rs
match (ours, theirs) {
    // Invariant: Modified or explicitly renamed files block inferred directory relocation.
    // Must execute BEFORE the Modify/Rename content-merging arm.
    (
        Change::Rewrite { .. } | Change::Modification { .. },
        Change::Addition { .. } | Change::Rewrite { .. },
    ) if rewritten_location.is_some()
        && (matches!(match_kind, Some(MatchKind::EraseLeaf))
            || matches!(ours, Change::Modification { .. })) =>
    {
        // Retain both changes at their explicit paths; record conflict if types mismatch,
        // but NEVER pass incompatible entry types to content-diff engines.
        apply_change_and_mark(&mut editor, ours, &mut ours_disposition)?;
        apply_change_and_mark(&mut editor, theirs, &mut theirs_disposition)?;
    }
    
    // Fall-through: Standard modify/rename handling (only reached when paths do not collide with inferred moves)
    (Change::Modification { .. }, Change::Rewrite { .. }) => {
        // Content merge logic here...
    }
    _ => {}
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Attempting to resolve modify/rename before evaluating whether
// an inferred directory relocation collided with an explicit path modification.
match (ours, theirs) {
    (Change::Modification { .. }, Change::Rewrite { .. }) => {
        // HAZARD: If `theirs` was an inferred directory relocation of a Commit (gitlink),
        // and `ours` is a Blob modification, this call will panic or corrupt repository state!
        merge_blob_contents(&ours.blob_id()?, &theirs.blob_id()?)?;
    }
    // Blocked relocation check placed too late:

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T08:07:23.917Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794989243917",
    "title": "Precedence Gate for Relocation vs Content Merging in AST/Namespace Redirections",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "gitoxidelabs-gitoxide-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "9666624df750e803fea5b75196438752ed204d55ed207d582bd70ce3e9e0e349"
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
        "Expresses generalized engineering invariants (3 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-18T08:07:23.918Z"
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
  "auth_token": "8528fb594a1d8121ab73a8b5f913bd8a0b1f03d452cfc2a30fe318d46ad863f0"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
