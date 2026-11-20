# Candidate Directive: [CD-W365] Two-Tiered State Persistence Invariant (Intermediate vs Durable Sync)

<!-- PROVENANCE_START
{
  "source_repository": "hashicorp-terraform-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T01:56:45.845Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hashicorp-terraform-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hashicorp-terraform-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T01:56:45.845Z`  
> **Learning ID**: `LEARN-EVO-hashicorp-terraform-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
Systems managing mutable external infrastructure MUST decouple synchronous in-memory transaction checkpoints from durable storage writes via a two-tiered persistence contract (`WriteState` vs `PersistState`), and MUST force an unconditional synchronous durable flush during execution cancellation/SIGINT hooks.

**WHY**:
Network round-trips to remote storage (e.g., Azure Blob, S3, Consul) during massive parallel graph evaluations (e.g., hundreds of resources concurrently updating) cause I/O saturation, rate limiting, and severe throughput collapse. However, buffering state purely in memory causes state desynchronization if the process is terminated (OOM or SIGKILL). A two-tier persistence model allows high-frequency local checkpoints with rate-limited or interval-based remote flushes, with a strict termination hook that flushes before exiting.

**WHEN TO APPLY**:
Apply to any distributed or local engine coordinating external system mutations (IaC, migration engines, distributed workflows, orchestrators).

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Extracted from internal/backend/local/hook_state.go
type StateHook struct {
    sync.Mutex
    StateMgr            statemgr.Writer
    PersistInterval     time.Duration
    Schemas             *schemarepo.Schemas
    intermediatePersist statemgr.IntermediateStatePersistInfo
}

func (h *StateHook) PostStateUpdate(new *states.State) (terraform.HookAction, error) {
    h.Lock()
    defer h.Unlock()

    h.intermediatePersist.RequestedPersistInterval = h.PersistInterval
    if h.intermediatePersist.LastPersist.IsZero() {
        h.intermediatePersist.LastPersist = time.Now()
    }

    if h.StateMgr != nil {
        // Tier 1: In-memory/local fast state write
        if err := h.StateMgr.WriteState(new); err != nil {
            return terraform.HookActionHalt, err
        }

        // Tier 2: Conditional remote durable persistence
        if mgrPersist, ok := h.StateMgr.(statemgr.Persister); ok && h.PersistInterval != 0 && h.Schemas != nil {
            if h.shouldPersist() {
                if err := mgrPersist.PersistState(h.Schemas); err != nil {
                    return terraform.HookActionHalt, err
                }
                h.intermediatePersist.LastPersist = time.Now()
            }
        }
    }
    return terraform.HookActionContinue, nil
}

// Emergency termination handler guarantees durable write before SIGKILL

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T01:56:45.961Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795139805961",
    "title": "Two-Tiered State Persistence Invariant (Intermediate vs Durable Sync)",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hashicorp-terraform-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "c5681683bcfa9541d3ef25013cdb0ea40a0dbd6b47931698abbe4451b8e6408b"
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
      "score": 0.85,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-20T01:56:45.962Z"
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
  "auth_token": "d4e5c6928591a208e5445734e6d4b15bcedda4c6fbab9444a1638c6cfab16802"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
