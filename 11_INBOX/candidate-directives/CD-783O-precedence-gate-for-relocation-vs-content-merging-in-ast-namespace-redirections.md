# Candidate Directive: [CD-783O] Precedence Gate for Relocation vs Content Merging in AST/Namespace Redirections

<!-- PROVENANCE_START
{
  "source_repository": "GitoxideLabs/gitoxide",
  "source_url": "https://github.com/GitoxideLabs/gitoxide",
  "source_version": "c3d18f4b",
  "license": "Apache-2.0",
  "timestamp": "2026-11-18T08:06:00.132Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-gitoxidelabs-gitoxide",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [GitoxideLabs/gitoxide](https://github.com/GitoxideLabs/gitoxide) (Revision: `c3d18f4b`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-18T08:06:00.132Z`  
> **Learning ID**: `learn-github-gitoxidelabs-gitoxide`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
    (Change::Rewrite { .. }, Change::Addition { .. }) if rewritten_location.is_some() => {
        // Unreachable for collisions intercepted by the arm above!
    }
}
```

**VERIFICATION METHOD**:
Construct a synthetic three-way tree harness where base contains `c/a` (Blob), side $A$ replaces `c/a` with a gitlink (`EntryKind::Commit`), and side $B$ renames directory `a/` to `c/` containing `a/a` (gitlink). Ensure that running merge resolution under `ResolveWith::Ours`, `ResolveWith::Ancestor`, and default configurations preserves both explicit paths without invoking the blob diff engine, verifying:
```bash
cargo test -p gix-merge --test merge renamed_gitlink_colliding_with_a_replacement_gitlink
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T08:06:00.130Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794989160130",
    "title": "Precedence Gate for Relocation vs Content Merging in AST/Namespace Redirections",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "GitoxideLabs/gitoxide",
    "source_uri": "https://github.com/GitoxideLabs/gitoxide",
    "source_version": "HEAD",
    "content_hash": "140c4e2c4491be1d9bba2d4d33df1e13a5a1ab6994167551ad468796a9d94276"
  },
  "evidence_fingerprint": "0ea4249640d6d3cc",
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
        "Direct empirical evidence ratio: 0% (0/4)",
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
        "Harvested/verified timestamp recorded: 2026-11-18T08:06:00.130Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "1ed04ad995f7e8214f0caee0b6ad1f6a57d52e76af7bd5ccb47678f665afd72b"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
