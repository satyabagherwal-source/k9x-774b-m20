# Candidate Directive: [CD-UKIB] Two-Tiered State Persistence Invariant (Intermediate vs Durable Sync)

<!-- PROVENANCE_START
{
  "source_repository": "hashicorp/terraform",
  "source_url": "https://github.com/hashicorp/terraform",
  "source_version": "cefb61b7",
  "license": "NOASSERTION",
  "timestamp": "2026-11-20T01:55:35.123Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-hashicorp-terraform",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hashicorp/terraform](https://github.com/hashicorp/terraform) (Revision: `cefb61b7`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-20T01:55:35.123Z`  
> **Learning ID**: `learn-github-hashicorp-terraform`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
func (h *StateHook) Stopping() {
    h.Lock()
    defer h.Unlock()

    if mgrPersist, ok := h.StateMgr.(statemgr.Persister); ok && h.Schemas != nil {
        h.intermediatePersist.ForcePersist = true
        if h.shouldPersist() {
            if err := mgrPersist.PersistState(h.Schemas); err != nil {
                log.Printf("[ERROR] Failed to persist state after interruption: %s", err)
            }
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Direct, un-throttled synchronous remote call inside evaluation loop
// OR ignoring cancellation signals leading to state corruption.
func (h *UnsafeStateHook) PostStateUpdate(new *states.State) error {
    // Blocks every concurrent worker on remote I/O; causes rate limit failure
    return h.remoteClient.UploadPayloadToStorage(new)
}
```

**VERIFICATION METHOD**:
Automated integration test simulating sudden SIGINT/cancellation:
```go
func TestStateHook_InterruptFlushesState(t *testing.T) {
    mockMgr := &mockStatePersister{}
    hook := &StateHook{
        StateMgr:        mockMgr,
        PersistInterval: 10 * time.Minute, // Normal persist is blocked by interval
        Schemas:         &schemarepo.Schemas{},
    }
    hook.PostStateUpdate(states.NewState())
    if mockMgr.persistCalled {
        t.Fatal("Persist should have been deferred by PersistInterval")
    }
    hook.Stopping()
    if !mockMgr.persistCalled {
        t.Fatal("Stopping() MUST force immediate state persistence")
    }
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T01:55:35.120Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795139735120",
    "title": "Two-Tiered State Persistence Invariant (Intermediate vs Durable Sync)",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hashicorp/terraform",
    "source_uri": "https://github.com/hashicorp/terraform",
    "source_version": "HEAD",
    "content_hash": "bbebd3f767fe8992a3c0da6c04766a99581aad2b36b4c5b3a2fa6fa644a00c11"
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
        "Harvested/verified timestamp recorded: 2026-11-20T01:55:35.121Z"
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
  "auth_token": "aac5b49e8baa86f6cd3f488d0068cf92ac6e56313f2ad3c1e8da8922e05aaacc"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
