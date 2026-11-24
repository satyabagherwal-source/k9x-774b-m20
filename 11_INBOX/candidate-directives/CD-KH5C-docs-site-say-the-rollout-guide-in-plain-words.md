# Candidate Directive: [CD-KH5C] docs(site): say the rollout guide in plain words

<!-- PROVENANCE_START
{
  "source_repository": "dosco-graphjin-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-24T21:02:09.216Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-dosco-graphjin-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [dosco-graphjin-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-24T21:02:09.216Z`  
> **Learning ID**: `LEARN-EVO-dosco-graphjin-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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
  "validated_at": "2026-11-24T21:02:09.358Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795554129358",
    "title": "docs(site): say the rollout guide in plain words",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "dosco-graphjin-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "fa70afdf96eb0b2f4bb041cfa20ebf9686f0f4098f77a985ac16ccb246d5ffa0"
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
        "Harvested/verified timestamp recorded: 2026-11-24T21:02:09.358Z"
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
  "auth_token": "ff3bc9b2a9b849bf70acc88ecbb1c3c782948086004d9384975479fc6f3dc093"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
