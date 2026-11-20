# Candidate Directive: [CD-UF7P] Asymmetric State Machine Cache Eviction with Probe Loop Guard

<!-- PROVENANCE_START
{
  "source_repository": "juicedata/juicefs",
  "source_url": "https://github.com/juicedata/juicefs",
  "source_version": "23d2a456",
  "license": "Apache-2.0",
  "timestamp": "2026-11-20T07:03:24.037Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-juicedata-juicefs",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [juicedata/juicefs](https://github.com/juicedata/juicefs) (Revision: `23d2a456`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-20T07:03:24.037Z`  
> **Learning ID**: `learn-github-juicedata-juicefs`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing an automated degraded-state machine for I/O devices (transitioning through `Normal`, `Unstable`, `Down`), recovery from `Unstable` to `Normal` MUST require an absolute volume minimum of successful I/O probes alongside a strictly bounded error percentage. The probe loop MUST operate on a dedicated timer-guarded worker channel and enforce concurrency caps during instability.

**WHY**:
Failing storage drives (NVMe/SSD) exhibit intermittent burst latency and sporadic I/O faults. If a state machine switches back from `Unstable` to `Normal` merely based on an elapsed time window or zero errors during an idle phase, user read/write workloads will immediately slam the degraded drive, triggering systemic queue saturation, FUSE thread lockups, and unhandled I/O timeouts.

**WHEN TO APPLY**:
Local caching tiers, multi-tier storage engines, distributed block volume attachments, or remote storage drivers implementing automatic fail-over and circuit breaking.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Language: Go
// Location: pkg/chunk/disk_cache_state.go

func (dc *unstableDC) tick() {
    go dc.probe()
    go func() {
        ticker := time.NewTicker(tickDurForUnstable)
        defer ticker.Stop()

        for {
            select {
            case <-dc.stopCh:
                return
            case <-ticker.C:
                errCnt := atomic.LoadUint32(&dc.ioErrCnt)
                ioCnt := atomic.LoadUint32(&dc.ioCnt)
                
                // CRITICAL DUAL-CONDITION:
                // 1. Must satisfy a minimum sample count (ioCnt >= minIOSuccToNormal)
                // 2. Error percentage must be under threshold (float64(errCnt)/float64(ioCnt) <= maxIOErrPercentageToNormal)
                if ioCnt >= minIOSuccToNormal && float64(errCnt)/float64(ioCnt) <= maxIOErrPercentageToNormal {
                    dc.cache.event(eventToNormal)
                } else if time.Since(dc.startTime) >= maxDurToDown {
                    dc.cache.event(eventToDown)
                } else {
                    // Reset sliding window counters for next evaluation tick
                    atomic.StoreUint32(&dc.ioErrCnt, 0)
                    atomic.StoreUint32(&dc.ioCnt, 0)
                }
            }
        }
    }()
}

// Bounded concurrency throttling while in unstable state
func (dc *unstableDC) checkCacheOp() error {
    if dc.concurrency.Load() >= maxConcurrencyForUnstable {
        return errUnstableCoLimit
    }
    return nil
}
```

**NEGATIVE CONSTRAINT**:
```go
// Language: Go
// ANTI-PATTERN: Recovering state solely on a timer tick without measuring traffic volume
func (dc *badState) tick() {
    go func() {
        <-time.After(1 * time.Minute)
        // DANGEROUS: If 0 operations occurred, errCnt is 0. 
        // The drive might still be completely broken/hung!
        if dc.errCnt == 0 {
            dc.state = StateNormal // False-positive recovery
        }
    }()
}
```

**VERIFICATION METHOD**:
Simulate an unstable cache disk returning `EIO` on 1 out of every 5 requests. Run synthetic traffic below `minIOSuccToNormal`. Verify via telemetry that state machine remains pinned in `dcUnstable` and eventually transitions to `dcDown` after `maxDurToDown` expires.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T07:03:24.036Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795158204036",
    "title": "Asymmetric State Machine Cache Eviction with Probe Loop Guard",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "juicedata/juicefs",
    "source_uri": "https://github.com/juicedata/juicefs",
    "source_version": "HEAD",
    "content_hash": "559ff0f2daf7e5088c9adf693e1561672ddd491b9193d2fb70c881459cc04df7"
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
        "Harvested/verified timestamp recorded: 2026-11-20T07:03:24.036Z"
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
  "auth_token": "2059fd9987244e2730d086d230bda31c9f8e794682a0a0989916fa8ef03199a8"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
