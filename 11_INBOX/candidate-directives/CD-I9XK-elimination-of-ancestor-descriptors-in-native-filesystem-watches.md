# Candidate Directive: [CD-I9XK] Elimination of Ancestor Descriptors in Native Filesystem Watches

<!-- PROVENANCE_START
{
  "source_repository": "GitoxideLabs/gitoxide",
  "source_url": "https://github.com/GitoxideLabs/gitoxide",
  "source_version": "ab7c5dc0",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T02:50:59.912Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-gitoxidelabs-gitoxide",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [GitoxideLabs/gitoxide](https://github.com/GitoxideLabs/gitoxide) (Revision: `ab7c5dc0`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T02:50:59.912Z`  
> **Learning ID**: `learn-github-gitoxidelabs-gitoxide`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
Filesystem watchers monitoring deeply nested repositories **MUST NOT** register native kernel watches on ancestral directory paths above the verified canonical repository boundary (e.g., using macOS `kFSEventStreamCreateFlagWatchRoot` indiscriminately). Instead, watchers **MUST** resolve canonical physical roots, monitor only the reduced root paths, and validate root identity stability using periodic, non-scanning stat fences.

**WHY**:
Registering ancestor directory descriptors via OS-level APIs (such as Darwin's FSEvents `WatchRoot`) retains open file descriptors on all parent and sibling directories. In systems running concurrent repository workers, this leads to rapid file descriptor exhaustion (`EMFILE`), prevents clean unmounting of parent disks, and triggers duplicate cross-talk events when sibling directories are modified.

**WHEN TO APPLY**:
Filesystem event monitors, file watchers, language servers, and Git background workers across Linux (`inotify`), macOS (`FSEvents`), and Windows.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Production Pattern from gix-notify/src/backend/fsevents/mod.rs
// Loop guard with non-scanning stat check and timeout handling:
let mut checked = Instant::now();
loop {
    if options
        .root_check_interval
        .is_some_and(|interval| checked.elapsed() >= interval)
    {
        // Non-scanning O(1) inode/dev check on reduced roots
        let _ = check_roots(&mut stream, &sender);
        checked = Instant::now();
    }
    
    let timeout = options
        .root_check_interval
        .map(|interval| interval.saturating_sub(checked.elapsed()));
        
    let command = match timeout {
        Some(t) => receive.recv_timeout(t),
        None => receive.recv().map_err(|_| mpsc::RecvTimeoutError::Disconnected),
    };
    
    match command {
        Ok(Command::Replace(watches, reply)) => {
            // Explicit teardown of previous streams before recreation
            drop(stream.take());
            let replacement = Stream::new(&watches, sender.clone())?;
            stream = Some(replacement);
            let _ = reply.send(Ok(()));
        }
        Ok(Command::Synchronize { directory, generation, deadline, reply }) => {
            // Delivery fence with pre- and post-validation of root identities
            let result = check_roots(&mut stream, &sender).and_then(|()| {
                let s = stream.as_ref().ok_or(SynchronizeError::CoverageLost)?;
                let sync_res = s.synchronize_at(&directory, generation, deadline);
                check_roots(&mut stream, &sender)?;
                sync_res
            });
            let _ = reply.send(result);
        }
        Err(mpsc::RecvTimeoutError::Timeout) => {},
        Err(mpsc::RecvTimeoutError::Disconnected) => break,
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Passing native recursive watch-root flags on raw input paths
let flags = kFSEventStreamCreateFlagWatchRoot | kFSEventStreamCreateFlagFileEvents;
// BUG: Locks ancestor directories up to `/`, duplicates events across workspaces,
// leaks kernel descriptors, and leaks unmount locks on parent mount points.
let stream = FSEventStreamCreate(kCFAllocatorDefault, callback, &ctx, paths, kFSEventStreamEventIdSinceNow, 0.1, flags);
```

**VERIFICATION METHOD**:
Automated integration test verifying that replacing a parent folder or creating sibling directories does not trigger watch loss or retain locked directory handles:
```rust
#[test]
fn identity_checks_cover_reduced_native_roots() -> gix_error::TestResult {
    // Verify that nested logical watches reduce to single canonical directory
    let stream = Stream::new(&[Watch { path: child, recursive: true }, Watch { path: alias, recursive: false }], sender)?;
    assert_eq!(stream.roots.len(), 1, "nested logical watches MUST collapse into 1 native root");
    Ok(())
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T02:50:59.911Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794883859911",
    "title": "Elimination of Ancestor Descriptors in Native Filesystem Watches",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "GitoxideLabs/gitoxide",
    "source_uri": "https://github.com/GitoxideLabs/gitoxide",
    "source_version": "HEAD",
    "content_hash": "ee7176975ff2fa4c6be0edbc7ab12a1ee74684bd6c1b1f0cf4a9bf774dea8c00"
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
        "Harvested/verified timestamp recorded: 2026-11-17T02:50:59.911Z"
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
  "auth_token": "4584a064c8573cffb3d7440805ea81a0f57373029f1d60b1d9d4513d4b676178"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
