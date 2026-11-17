# Candidate Directive: [CD-7X6Z] State Checkpoint Atomic Swap and Integrity Gate

<!-- PROVENANCE_START
{
  "source_repository": "pulumi-pulumi-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T08:46:51.698Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-pulumi-pulumi-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [pulumi-pulumi-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T08:46:51.698Z`  
> **Learning ID**: `LEARN-EVO-pulumi-pulumi-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
State backends writing checkpoints **MUST** enforce atomic swap semantics (never write directly to the target state file or delete the source before replacement finishes) and **MUST** execute strict cryptographic and relational snapshot integrity verification on read. If integrity checking fails, execution **MUST** halt immediately and refuse to run the engine unless an explicit, logged override is provided.

**WHY**:
A half-written state file, a crashed process during file modification, or reading a checkpoint with corrupted parent-child URN relationships produces "split-brain" infrastructure state. The engine would lose track of live cloud resources, leading to dangling billable assets or destructive recreation of existing production infrastructure.

**WHEN TO APPLY**:
Any database, state store, or persistence layer managing deployment state, resource ownership trees, or financial/audit ledgers.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Extracted from pkg/backend/diy/state.go
func (b *diyBackend) getSnapshot(ctx context.Context, secretsProvider secrets.Provider, ref *diyBackendReference) (*deploy.Snapshot, error) {
    contract.Requiref(ref != nil, "ref", "must not be nil")

    checkpoint, _, _, err := b.getCheckpoint(ctx, ref)
    if err != nil {
        return nil, fmt.Errorf("failed to load checkpoint: %w", err)
    }

    snap, err := stack.DeserializeCheckpoint(ctx, secretsProvider, checkpoint)
    if err != nil {
        return nil, err
    }

    // Strict integrity gate: Never proceed with corrupted DAG state
    if !backend.DisableIntegrityChecking {
        if err := snap.VerifyIntegrity(); err != nil {
            if sie, ok := snapshot.AsSnapshotIntegrityError(err); ok {
                var metadata *apitype.SnapshotIntegrityErrorMetadataV1
                if snap.Metadata.IntegrityErrorMetadata != nil {
                    metadata = &apitype.SnapshotIntegrityErrorMetadataV1{
                        Version: snap.Metadata.IntegrityErrorMetadata.Version,
                        Command: snap.Metadata.IntegrityErrorMetadata.Command,
                        Error:   snap.Metadata.IntegrityErrorMetadata.Error,
                    }
                }
                return nil, fmt.Errorf("snapshot integrity failure; refusing to use it: %w", sie.ForReadWithMetadata(metadata))
            }
            return nil, fmt.Errorf("snapshot integrity failure; refusing to use it: %w", err)
        }
    }

    return snap, nil
}
```

**NEGATIVE CONSTRAINT**:
```go

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T08:46:51.850Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794905211850",
    "title": "State Checkpoint Atomic Swap and Integrity Gate",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "pulumi-pulumi-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "0a7883e19a595ea4dc8b44bb3470ddcd5841f8153dfd9deeef193bd42a02e840"
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
        "Harvested/verified timestamp recorded: 2026-11-17T08:46:51.850Z"
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
  "auth_token": "899da1cb76a38ff763c42c91d056b2444a78c64e7f02fbf87ff0f26eaed99a1f"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
