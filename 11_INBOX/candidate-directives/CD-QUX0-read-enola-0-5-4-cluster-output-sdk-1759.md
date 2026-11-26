# Candidate Directive: [CD-QUX0] Read enola 0.5.4 cluster output (SDK-1759)

<!-- PROVENANCE_START
{
  "source_repository": "topoteretes/cognee",
  "source_url": "https://github.com/topoteretes/cognee",
  "source_version": "c78a56ff",
  "license": "Apache-2.0",
  "timestamp": "2026-11-26T16:58:31.044Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-topoteretes-cognee",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [topoteretes/cognee](https://github.com/topoteretes/cognee) (Revision: `c78a56ff`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-26T16:58:31.044Z`  
> **Learning ID**: `learn-github-topoteretes-cognee`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `cognee/tasks/code_graph/cluster.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in topoteretes/cognee. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f508a230`: code_graph): Read enola 0.5.4 cluster output (SDK-1759). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `cognee/tasks/code_graph/cluster.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
listing them, and writes the whole linked graph once, to a directory of the
dataset's own outside the repositories (see :func:`cluster_snapshot_dir`).
import os
    """The working directory enola keeps inside each member for a dataset's cluster runs.
    It holds the member's extractor cache, not a snapshot. A remote clone is
    shared by every dataset that adds its URL, so the name is the dataset's
    own rather than the ``.enola`` a single-repository run writes its snapshot
    to. enola takes the name relative to each repository.
def cluster_snapshot_dir(dataset_id: UUID) -> Path:
    """Where a dataset's cluster snapshot is written: one directory per dataset.
    enola writes a cluster's graph once and refuses a directory inside a
    member repository, so it lives next to the clones, under
    ``BaseConfig.repos_root_directory`` (``COGNEE_REPOS_DIR``), which is a
    local directory whatever the storage backend. A clone's directory name
    never starts with a dot, so no clone can take this one's place.
    from cognee.tasks.code_graph.resolve_repo import default_clones_dir
    return default_clones_dir() / ".enola-clusters" / str(dataset_id)
def resolve_member_labels(repo_p
```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
listing them, and writes the whole linked graph into every member, under a
directory of the dataset's own (``.enola-<dataset_id>``, see
:func:`cluster_output_dir`) rather than the shared ``.enola``.
    snapshot_identity,
    """Where, inside each member repository, a dataset's cluster snapshot is written.
    A remote clone is shared by every dataset that adds its URL, and a cluster
    snapshot holds the facts of all the dataset's repositories. One directory
    per dataset keeps a cluster run from overwriting the snapshot another
    dataset is reading. enola takes the name relative to each repository.
def _written_label(repo_path: Path, output_dir: str, snapshot_id: str | None) -> str | None:
    """The label enola gave a member in the snapshot just taken, or None.
    A cluster run writes ``snapshot.meta.json`` into every member's
    ``output_dir`` with the member's own ``repo_label`` — the exact name its
    facts carry. The file is enola's own bookkeeping rather than part of the
    documented snapshot contract, so it is only trusted when it describes
    this snapshot (same ``snapshot_id``) and the caller falls back to
    deriving the label when it is missing or stale.
  
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f508a230` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T16:58:31.042Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795712311042",
    "title": "Read enola 0.5.4 cluster output (SDK-1759)",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "topoteretes/cognee",
    "source_uri": "https://github.com/topoteretes/cognee",
    "source_version": "HEAD",
    "content_hash": "d217fc01a503f87a3d5ca4ca9351e2654acb56e282ac420e9767ac9cc12f8a0d"
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
        "Harvested/verified timestamp recorded: 2026-11-26T16:58:31.042Z"
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
  "auth_token": "6a8f0e150695272bc01faf4705577d28d7cb24c4f3aef0f947b1e7c3ea1ca337"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
