# Candidate Directive: [CD-7P4F] Copy-on-Write Prefix Invariant for Concurrently Snapped Mutation Stacks

<!-- PROVENANCE_START
{
  "source_repository": "apple/foundationdb",
  "source_url": "https://github.com/apple/foundationdb",
  "source_version": "17a225f7",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T08:18:41.775Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-apple-foundationdb",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [apple/foundationdb](https://github.com/apple/foundationdb) (Revision: `17a225f7`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T08:18:41.775Z`  
> **Learning ID**: `learn-github-apple-foundationdb`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When mutation stacks are shared across iterator snapshots (such as transactional read versions or RYW read iterators) and updated by subsequent in-place writes, the shared storage backing the stack MUST enforce Copy-on-Write (CoW) branching whenever the stack being modified does not match the exact head of the shared backing history (`history->entries.size() != historyCount`).

**WHY**:
Transactional iterators capture pointers or lightweight references to in-flight `WriteMap` segments. If a subsequent write pushes to an iterator's underlying history without cloning divergent branches, it will overwrite the history array or append entries into snapshots that were taken at an earlier logical state. This results in time-travel data corruption and race conditions across transaction iteration.

**WHEN TO APPLY**:
In-memory transaction stores, redo-log structures, or undo-buffers where cheap iteration snapshots (e.g. `tr.getRange()`) are constructed without deep copying the entire write buffer.

**VERIFIED IMPLEMENTATION PATTERN**:
```cpp
// Verified Pattern: FoundationDB OperationStack Structural Sharing
struct History : ReferenceCounted<History> {
    std::vector<RYWMutation> entries;
};

class OperationStack {
private:
    Reference<History> history;
    int historyCount = 0;       // Snapshot-local depth view into history
    RYWMutation topOperation;
    bool defaultConstructed = true;

public:
    void push(RYWMutation entry) {
        if (defaultConstructed) {
            topOperation = entry;
            defaultConstructed = false;
            return;
        }
        if (!history) {
            history = makeReference<History>();
        } else if (static_cast<int>(history->entries.size()) != historyCount) {
            // INVARIANT GUARD: Another snapshot or branch has appended to the shared history vector.
            // MUST fork and clone prefix matching this stack's logical view before appending.
            auto prefix = makeReference<History>();
            prefix->entries.assign(history->entries.begin(), history->entries.begin() + historyCount);
            history = prefix;
        }
        history->entries.push_back(topOperation);
        ++historyCount;
        topOperation = entry;
    }

    const RYWMutation& at(int n) const {
        // Safe bounded access within snapshot visibility boundary
        return n < historyCount ? history->entries[n] : topOperation;
    }
};
```

**NEGATIVE CONSTRAINT**:
```cpp
// ANTI-PATTERN: Direct in-place mutation of shared vector without prefix branch isolation
void OperationStack::push(RYWMutation entry) {
    if (!sharedHistory) {
        sharedHistory = std::make_shared<std::vector<RYWMutation>>();
    }
    // CATASTROPHIC BUG: Modifies shared underlying buffer directly.
    // Any prior iterator that saved 'sharedHistory' now observes entries pushed AFTER its creation.
    sharedHistory->push_back(topOperation);
    topOperation = entry;
}
```

**VERIFICATION METHOD**:
Instantiate an iterator snapshot, perform 10,000 pushes on the parent write map, and verify that the snapshot's observed `op().size()` and element values at indices remain strictly invariant.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T08:18:41.774Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794903521774",
    "title": "Copy-on-Write Prefix Invariant for Concurrently Snapped Mutation Stacks",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "apple/foundationdb",
    "source_uri": "https://github.com/apple/foundationdb",
    "source_version": "HEAD",
    "content_hash": "4f185c3aedffacef27bc9a91c43985ce687d2974903d64178188dbed03a7933d"
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
        "Harvested/verified timestamp recorded: 2026-11-17T08:18:41.774Z"
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
  "auth_token": "a386d1912fada225b79a663b10aec6480ba99f6289f5c483b55cedcdee617217"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
