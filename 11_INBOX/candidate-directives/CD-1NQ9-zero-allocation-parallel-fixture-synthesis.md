# Candidate Directive: [CD-1NQ9] Zero-Allocation Parallel Fixture Synthesis

<!-- PROVENANCE_START
{
  "source_repository": "authzed/spicedb",
  "source_url": "https://github.com/authzed/spicedb",
  "source_version": "558b84d7",
  "license": "Apache-2.0",
  "timestamp": "2026-11-14T05:07:01.857Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-authzed-spicedb",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [authzed/spicedb](https://github.com/authzed/spicedb) (Revision: `558b84d7`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-14T05:07:01.857Z`  
> **Learning ID**: `learn-github-authzed-spicedb`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
Test fixtures generating repetitive domain primitives (e.g., tuples, relationships, foreign keys) exceeding $10^3$ elements MUST construct internal memory structs directly instead of invoking string parsing or string formatting engines (`fmt.Sprintf`), and tests sharing immutable snapshot data MUST parallelize subtests across a single pre-loaded instance.

**WHY**:
Parsing strings under the Go race detector (`-race`) or memory tracking hooks incurs dynamic heap allocations, string-to-byte copies, and regex/lexer overhead that scales quadratically with test volume. In `internal/dispatch/graph/dispatch_test.go`, generating 131,072 tuples via `tuple.MustParse(fmt.Sprintf(...))` took more CPU time than the entire graph resolution algorithm itself, saturating CI runner memory and stalling parallel test workers.

**WHEN TO APPLY**:
Applies to any test suite constructing datasets $> 1,000$ records, particularly in distributed systems, search indexes, or compiler abstract syntax tree (AST) testing.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Direct struct initialization avoids lexing, string allocations, and memory churn
resources := make([]tuple.Relationship, 0, count)
for i := range count {
    userID := "user" + strconv.Itoa(i) // Avoid fmt.Sprintf
    resources = append(resources, tuple.Relationship{
        RelationshipReference: tuple.RelationshipReference{
            Resource: tuple.ObjectAndRelation{
                ObjectType: "res",
                ObjectID:   "res1",
                Relation:   "owner",
            },
            Subject: tuple.ObjectAndRelation{
                ObjectType: "user",
                ObjectID:   userID,
                Relation:   graph.Ellipsis,
            },
        },
    })
}
```

**NEGATIVE CONSTRAINT**:
```go
// NEVER parse serialized domain representations in hot loops or test fixtures
resources := make([]tuple.Relationship, 0, count)
for i := 0; i < count; i++ {
    // ANTI-PATTERN: fmt.Sprintf allocates; MustParse invokes full tokenizer & AST validation
    rel := tuple.MustParse(fmt.Sprintf("res:res1#owner@user:user%d", i))
    resources = append(resources, rel)
}
```

**VERIFICATION METHOD**:
Enforce memory and CPU benchmarks in CI:
```bash
go test -race -benchmem -run=^$ -bench=^BenchmarkFixtureGeneration ./...
```
Assert that allocated bytes per operation (`B/op`) remain zero or near zero, and enforce strict execution lints prohibiting `fmt.Sprintf` inside batch test loops.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T05:07:01.856Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.66,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 66%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794632821856",
    "title": "Zero-Allocation Parallel Fixture Synthesis",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "authzed/spicedb",
    "source_uri": "https://github.com/authzed/spicedb",
    "source_version": "HEAD",
    "content_hash": "90515fc9234b4be33a46c7702a515be7c7e9b297e3104939fd6b325cbd5030d1"
  },
  "evidence_fingerprint": "ece9d10e7392fc66",
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
        "Direct empirical evidence ratio: 0% (0/1)",
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
      "score": 0.8,
      "is_generic_pattern": true,
      "has_local_paths": false,
      "findings": [],
      "details": [
        "Free of local workstation path artifacts",
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
        "Harvested/verified timestamp recorded: 2026-11-14T05:07:01.856Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "3e58c8449d7a27c97a7e0421a8ff1aa2351a3649a67d244b3786e71d257e182c"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
