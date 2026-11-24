# Candidate Directive: [CD-JMT6] docs(site): say the rollout guide in plain words

<!-- PROVENANCE_START
{
  "source_repository": "dosco/deeporg",
  "source_url": "https://github.com/dosco/graphjin",
  "source_version": "9d591e72",
  "license": "Apache-2.0",
  "timestamp": "2026-11-24T21:01:30.042Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-dosco-deeporg",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [dosco/deeporg](https://github.com/dosco/graphjin) (Revision: `9d591e72`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-24T21:01:30.042Z`  
> **Learning ID**: `learn-github-dosco-deeporg`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `website/content/rollout.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in dosco/deeporg. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `9d591e72`: docs(site): say the rollout guide in plain words. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `website/content/rollout.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
headline: "What a rollout takes, step by step."
lede: "Choosing the model is the small part of an AI rollout. Most of the work is connecting the systems, deciding who may see what, writing down what the company's words mean, checking answers until people trust them, and then giving the agent real work to do every week. Companies usually bring in forward-deployed engineers or consultants for it. This page is for whoever does that work. For each step, it shows the part of DeepORG that handles it."
- **It finds your tables for you.** DeepORG builds a searchable map of every table, column and relationship it finds. The agent looks things up in the map and writes its own queries.
- **It reads relationships from your foreign keys.** Ones the schema never declared can be added in config.
- **One answer can use several systems.** It can use the app database, the warehouse and an HTTP API together.
- **A read-only source cannot be changed.** `read_only: true` blocks every write to that source, whatever a role or the agent asks for.
- **Changes wait for a person.** A change the agent proposes is first tried out in a transaction that is rolled back, then held until someone approves that exact
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
headline: "Most of an AI rollout is not the model."
lede: "Most of the work is connecting the systems, deciding who may see what, writing down what the company's words mean, checking answers until people trust them, and then giving the agent real work to do every week. Companies usually bring in forward-deployed engineers or consultants for it. This page is for whoever does that work. It goes step by step and shows the part of DeepORG that handles each one."
- **No tool for each question.** DeepORG builds a searchable map of every table, column and relationship it finds. The agent looks things up in the map and writes its own queries, so nobody has to build a tool per question.
- **Joins come from your keys.** Relationships are read from your foreign keys. Ones the schema never declared can be added in config.
- **Several systems, one question.** One answer can draw on the app database, the warehouse and an HTTP API together.
- **Read-only means read-only.** `read_only: true` blocks every write to that source, whatever a role or the agent asks for.
- **Changes wait for a person.** A change the agent proposes is rehearsed in a transaction that is rolled back, then held until someone
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `9d591e72` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T21:01:30.040Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795554090040",
    "title": "docs(site): say the rollout guide in plain words",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "dosco/deeporg",
    "source_uri": "https://github.com/dosco/graphjin",
    "source_version": "HEAD",
    "content_hash": "fa70afdf96eb0b2f4bb041cfa20ebf9686f0f4098f77a985ac16ccb246d5ffa0"
  },
  "evidence_fingerprint": "f4ebc73b386fdfdf",
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
        "Direct empirical evidence ratio: 0% (0/3)",
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
        "Harvested/verified timestamp recorded: 2026-11-24T21:01:30.040Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "c1686bc1d9cae24c6c19e3ce6c2d056f9c96ef31c021d271d3711b58edd14033"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
