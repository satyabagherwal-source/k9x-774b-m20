# Candidate Directive: [CD-F8FS] Empirical Invariant Guard in copilot-instructions.md

<!-- PROVENANCE_START
{
  "source_repository": "permify-permify-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T00:56:39.441Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-permify-permify-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [permify-permify-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T00:56:39.441Z`  
> **Learning ID**: `LEARN-EVO-permify-permify-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records; LOCAL_MACHINE_PATH_DETECTED: Contains local workstation or hardcoded developer path
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.github/copilot-instructions.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Permify/permify. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `18fcfdda`: . Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/copilot-instructions.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
- Use only public artifacts: the published `ghcr.io/permify/permify` images, public docs
  (`docs/`), and public client libraries. You may read this repo's source to understand intended
  behavior, but reproduce the bug by calling the running service's API, not by reading code and
  guessing. Never build or run Permify from this checkout's source — always use a released image.
- **Latest** (the newest published release) should already be running at `http://localhost:3476`
  (REST) / `localhost:3478` (gRPC). Check it first: `curl -s http://localhost:3476/healthz`. If
  that fails, start it yourself and wait up to about 5 minutes:
  `docker compose -p triage -f .github/triage/docker-compose.yml up -d db-latest permify-latest`.
- If the issue names a released version (for example `v1.7.4`), start a second instance pinned to
  that exact tag:
  `/healthz` to answer. If the image tag cannot be pulled, say so in your report and test latest
  only. If the issue does not name a version, test latest only.
- **Pin down exactly what you tested while it is running, not from a later registry lookup.**
  Tags like `latest` and `v1.7.4` are mutable and can move; only the digest attached to the im
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
- Use only public artifacts: this repo's own `Dockerfile.local` build, the published
  `ghcr.io/permify/permify` images, public docs (`docs/`), and public client libraries. You may
  read the source to understand intended behavior, but reproduce the bug by calling the running
  service's API, not by reading code and guessing.
- **HEAD** (this checkout, i.e. the default branch) should already be running at
  `http://localhost:3476` (REST) / `localhost:3478` (gRPC). Check it first:
  `curl -s http://localhost:3476/healthz`. If that fails, start it yourself and wait up to about
  5 minutes: `docker compose -p triage -f .github/triage/docker-compose.yml up -d --build database permify-latest`.
- If the issue names a released version (for example `v1.7.4`), start a second instance to test
  exactly what shipped:
  `/healthz` to answer. If the image tag cannot be pulled, say so in your report and test HEAD only.
   steps on HEAD.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `18fcfdda` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T00:56:39.543Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records; LOCAL_MACHINE_PATH_DETECTED: Contains local workstation or hardcoded developer path",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=WARN, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794876999543",
    "title": "Empirical Invariant Guard in copilot-instructions.md",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "permify-permify-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "0408ad2c9c06751af5d2e30a8dad210978c1094d70bf273448e9d45e81bef595"
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
      "status": "WARN",
      "score": 0.5,
      "is_generic_pattern": false,
      "has_local_paths": true,
      "findings": [
        "LOCAL_MACHINE_PATH_DETECTED: Contains local workstation or hardcoded developer path"
      ],
      "details": [
        "Expresses generalized engineering invariants (5 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-17T00:56:39.543Z"
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
    "Repository-specific scope; not generalized for universal construction",
    "Staleness risk: MEDIUM"
  ],
  "evidence_references": [],
  "auth_token": "7fce7b58c1c391c5b44328e951d7044eb29700f7be5609dfaece63195dca6d90"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
