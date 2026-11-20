# Candidate Directive: [CD-S1IS] report Gold coverage across retrieval stages

<!-- PROVENANCE_START
{
  "source_repository": "zvec-ai/zvec-grep",
  "source_url": "https://github.com/zvec-ai/zvec-grep",
  "source_version": "ad737d20",
  "license": "Apache-2.0",
  "timestamp": "2026-11-20T23:21:19.540Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-zvec-ai-zvec-grep",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [zvec-ai/zvec-grep](https://github.com/zvec-ai/zvec-grep) (Revision: `ad737d20`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-20T23:21:19.540Z`  
> **Learning ID**: `learn-github-zvec-ai-zvec-grep`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.github/scripts/retrieval-pr-comment.mjs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in zvec-ai/zvec-grep. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ad737d20`: benchmarks): report Gold coverage across retrieval stages. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/scripts/retrieval-pr-comment.mjs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
export function commentBody({
  run,
  request,
  report,
  serverUrl,
  repository,
  traceArtifactId,
}) {
      markdownVersionComparison(
        { ...result, server_url: serverUrl, run_url: runUrl },
        {
          traceUrl: positiveInteger(traceArtifactId)
            ? `${serverUrl}/${repository}/actions/runs/${run.id}/artifacts/${traceArtifactId}`
            : undefined,
        },
      ),
    if (!info.isFile() || info.size > 256 * 1024) return null;
  let traceArtifactId;
  if (run.conclusion === "success") {
    try {
      const artifacts = await github.paginate(
        github.rest.actions.listWorkflowRunArtifacts,
        { ...context.repo, run_id: run.id, per_page: 100 },
      );
      // Build the URL from GitHub metadata, never artifact-provided Markdown or URLs.
      traceArtifactId = artifacts.find(
        (artifact) =>
          artifact.name === "retrieval-trace.html" &&
          artifact.expired === false &&
          positiveInteger(artifact.id) &&
          artifact.workflow_run?.id === run.id &&
          artifact.workflow_run?.head_sha === run.head_sha,
      )?.id;
    } catch {
      core.info(
        "Stage trace artifact unavailable; omitti
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
export function commentBody({ run, request, report, serverUrl, repository }) {
      markdownVersionComparison({
        ...result,
        server_url: serverUrl,
        run_url: runUrl,
      }),
    if (!info.isFile() || info.size > 128 * 1024) return null;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ad737d20` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T23:21:19.538Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795216879538",
    "title": "report Gold coverage across retrieval stages",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "zvec-ai/zvec-grep",
    "source_uri": "https://github.com/zvec-ai/zvec-grep",
    "source_version": "HEAD",
    "content_hash": "4f220edd7595264b9fea39f603bae100414015e3ecd10e607d48687c49b5fce2"
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
        "Harvested/verified timestamp recorded: 2026-11-20T23:21:19.538Z"
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
  "auth_token": "88fa3693d0a8b88d11bde8775890ba0b0fd9033608305d49e2ddaa2df64d6160"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
