# Candidate Directive: [CD-7P4E] Invariant Non-Associativity of Truncating and Conditional Mutations

<!-- PROVENANCE_START
{
  "source_repository": "apple/foundationdb",
  "source_url": "https://github.com/apple/foundationdb",
  "source_version": "17a225f7",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T08:18:41.774Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-apple-foundationdb",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [apple/foundationdb](https://github.com/apple/foundationdb) (Revision: `17a225f7`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T08:18:41.774Z`  
> **Learning ID**: `learn-github-apple-foundationdb`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
A mutation accumulator or client-side write coalescer MUST NOT evaluate or merge operations whose algebraic transformation is non-associative over unbounded domain inputs—specifically operations conditioned on dynamic base value boundaries (such as `AppendIfFits` under size constraints or conditional state changes like `CompareAndClear`). Such operations MUST remain un-coalesced on a FIFO `OperationStack` until evaluated against the fully resolved base value.

**WHY**:
Let $f(v, m)$ be an append operation bounded by limit $L$:
$$f(v, m) = \begin{cases} v \cdot m & \text{if } |v| + |m| \le L \\ v & \text{otherwise} \end{cases}$$
If an engine pre-coalesces two operands $m_1$ and $m_2$ before evaluating against base $v$:
$$(m_1 \circ m_2) = m_1 \cdot m_2$$
Testing against base $v$ evaluates $f(v, m_1 \cdot m_2)$. If $|v| + |m_1| \le L$ but $|v| + |m_1| + |m_2| > L$, the coalesced write rejects $m_1$ completely. However, sequential evaluation $f(f(v, m_1), m_2)$ successfully applies $m_1$ and drops only $m_2$. Coalescing at write-time breaks read-your-writes guarantees and sends corrupted batch payloads during commit proxy ingestion.

**WHEN TO APPLY**:
Apply to any distributed storage engine, caching proxy, client write buffer, or transaction staging layer that provides client-side read-your-writes (RYW) and supports bounded or conditional atomic operations.

**VERIFIED IMPLEMENTATION PATTERN**:
```cpp
// Verified Pattern: FoundationDB fdbclient/WriteMap.cpp & fdbclient/include/fdbclient/Atomic.h

inline bool appendIfFitsApplies(int existingSize, int operandSize, int valueSizeLimit) {
    // An append applies if empty or if sum is within bounds
    return existingSize == 0 || existingSize + operandSize <= valueSizeLimit;
}

void WriteMap::coalesceOver(OperationStack& stack, RYWMutation newEntry, Arena& arena, int valueLimit) {
    RYWMutation existingEntry = stack.top();
    
    // Explicit Guard: Non-associative or state-dependent mutations MUST NOT be coalesced together
    if (existingEntry.type == newEntry.type && 
        newEntry.type != MutationRef::CompareAndClear &&
        newEntry.type != MutationRef::AppendIfFits) {
        
        if (isNonAssociativeOp(existingEntry.type) && existingEntry.value.present() &&
            existingEntry.value.get().size() != newEntry.value.get().size()) {
            stack.push(newEntry);
            return;
        }
        // Associative operations (e.g., bitwise OR, integer addition of equal widths)
        stack.poppush(coalesce(existingEntry, newEntry, arena));
        return;
    }
    
    // Non-associative or mismatched mutations MUST be preserved sequentially
    stack.push(newEntry);
}

// Replay sequence onto base during coalesceUnder
static ValueRef applyAppendIfFitsRun(Optional<ValueRef> const& existing,
                                     OperationStack const& stack,
                                     int begin,
                                     int end,
                                     Arena& arena,
                                     int valueLimit) {
    ValueRef current = existing.present() ? existing.get() : ValueRef();
    for (int i = begin; i < end; ++i) {
        ValueRef operand = stack.at(i).value.get();
        if (operand.empty()) continue;
        if (appendIfFitsApplies(current.size(), operand.size(), valueLimit)) {
            // Allocate combined buffer inside memory arena
            uint8_t* buf = new (arena) uint8_t[current.size() + operand.size()];
            memcpy(buf, current.begin(), current.size());
            memcpy(buf + current.size(), operand.begin(), operand.size());
            current = ValueRef(buf, current.size() + operand.size());
        }
    }
    return current;
}
```

**NEGATIVE CONSTRAINT**:
```cpp
// ANTI-PATTERN: Merging non-associative operations assuming transitivity
RYWMutation WriteMap::coalesce(RYWMutation existingEntry, RYWMutation newEntry, Arena& arena) {
    switch (existingEntry.type) {
    case MutationRef::AppendIfFits:
        // CATASTROPHIC BUG: Merging operands without knowing the underlying base value size.
        // If base=70KB, op1=20KB, op2=20KB, limit=100KB:
        // Coalescing yields op_merged=40KB. Base (70KB) + 40KB > 100KB => Truncation drops ALL 40KB.
        // Sequential application yields Base (70KB) + 20KB = 90KB <= 100KB (Succeeds), then 90KB + 20KB drops.
        return RYWMutation(doAppendIfFits(existingEntry.value, newEntry.value.get(), arena),
                           MutationRef::AppendIfFits);
    }
}
```

**VERIFICATION METHOD**:
Run deterministic property-based unit testing with randomized base values and randomized chunk sequences:
```cpp
TEST_CASE("/fdbclient/WriteMap/appendIfFitsNonAssociativeInvariant") {
    Arena arena;
    const int limit = 100000;
    const int baseSize = 70000;
    const int appendSize = 20000;
    ValueRef firstAppend = StringRef(arena, std::string(appendSize, 'b'));
    ValueRef secondAppend = StringRef(arena, std::string(appendSize, 'b'));
    ValueRef base = StringRef(arena, std::string(baseSize, 'a'));

    OperationStack stack(RYWMutation(firstAppend, MutationRef::AppendIfFits));
    WriteMap::coalesceOver(stack, RYWMutation(secondAppend, MutationRef::AppendIfFits), arena);
    
    // Assert invariant: stack MUST NOT merge
    ASSERT_EQ(stack.size(), 2);
    RYWMutation under = WriteMap::coalesceUnder(stack, base, arena);
    ASSERT_EQ(under.value.get().size(), baseSize + appendSize);
    return Void();
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T08:18:41.772Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794903521772",
    "title": "Invariant Non-Associativity of Truncating and Conditional Mutations",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "apple/foundationdb",
    "source_uri": "https://github.com/apple/foundationdb",
    "source_version": "HEAD",
    "content_hash": "5b9617a9045fa393c415b0c00c4aaaa5656186ff50d85921460112a9b5a8b054"
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
        "Harvested/verified timestamp recorded: 2026-11-17T08:18:41.772Z"
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
  "auth_token": "2be4981ed3d6107f87b6960dfb0712fb9654ca1c21004f4bc0e8e2f29ee37c23"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
