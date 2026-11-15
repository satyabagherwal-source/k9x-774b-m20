# Candidate Directive: [CD-L0R1] Preserving Terminal Server Build Identity in Asynchronous Distributed Job Waits

<!-- PROVENANCE_START
{
  "source_repository": "lancedb/lancedb",
  "source_url": "https://github.com/lancedb/lancedb",
  "source_version": "f17a07a2",
  "license": "Apache-2.0",
  "timestamp": "2026-11-15T09:21:42.157Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-lancedb-lancedb",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [lancedb/lancedb](https://github.com/lancedb/lancedb) (Revision: `f17a07a2`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-15T09:21:42.157Z`  
> **Learning ID**: `learn-github-lancedb-lancedb`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When an asynchronous distributed task or compute function fails, the system MUST persist and report the build provenance (commit SHA, release version, build date) of the specific worker node that produced the terminal failure. Polling or query nodes MUST NOT substitute their own identity for the recorded terminal identity.

**WHY**:
In distributed architectures where heterogeneous compute nodes process background jobs (e.g., remote data transforms, indexing, serverless function workers) while separate query nodes respond to status polling requests, clusters undergo rolling upgrades. If worker node running version $1.13.0$ crashes or produces a deterministic calculation error, and a client later polls a query node running version $2.0.0$ via `job.wait()`, reporting the query node's version misleads engineers into debugging newer code paths that never ran the failing workload.

**WHEN TO APPLY**:
- Distributed batch/job processing frameworks.
- Long-running async workflows with separate worker and coordination/API tiers.
- Client SDK error propagation paths for background tasks.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Rust remote job terminal identity retention
impl<S: HttpSend> JobHandle for RemoteJob<S> {
    async fn wait(&self) -> Result<TerminalResult> {
        let description = self.poll_until_completed().await?;
        match description.state() {
            JobState::Done => Ok(description.into_terminal_result(request_id)),
            JobState::Failed => {
                let mut failure = description
                    .failure
                    .map(ReportedFailure::into_job_failure)
                    .unwrap_or_default();

                // Persisted terminal server identity MUST take precedence over the responding node.
                // The responding query node may have upgraded since this job failed.
                if let Some(server) = description
                    .result
                    .as_ref()
                    .and_then(|result| result.get("terminal_server"))
                    .and_then(|server| {
                        serde_json::from_value::<crate::server_info::ServerBuildInfo>(
                            server.clone(),
                        )
                        .ok()
                    })
                {
                    let provenance = format!("[server: {server}]");
                    failure.message = Some(match failure.message {
                        Some(message) => format!("{message} {provenance}"),
                        None => provenance,
                    });
                }
                
                Err(Error::JobFailed {
                    job_id: Some(self.job_id.clone()),
                    failure: Box::new(failure),
                })
            }
            JobState::Cancelled => Err(Error::JobCancelled { job_id: self.job_id.clone() }),
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Synthesizing error context from current transport response headers
let response = client.get_job_status(&self.job_id).await?;
if response.status == "FAILED" {
    // FAILS: x-lancedb-server-build is set by the API gateway or query node serving this HTTP GET,
    // NOT the executor worker that crashed hours ago on older binaries.
    let current_node = response.headers().get("x-lancedb-server-build");
    return Err(Error::JobFailed(format!("{}: from {}", response.error, current_node)));
}
```

**VERIFICATION METHOD**:
Mock an HTTP endpoint for `/v1/jobs/describe` returning HTTP 200 with header `x-lancedb-server-build: 2.0.0` and JSON payload containing `result.terminal_server: { release: "1.13.0-beta.0", git_sha: "2a7874ecd589" }`. Call `job.wait()` and verify via string assertions and structured error inspection that `error.to_string()` includes `1.13.0-beta.0` and does NOT contain `2.0.0`.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T09:21:42.156Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794734502156",
    "title": "Preserving Terminal Server Build Identity in Asynchronous Distributed Job Waits",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "lancedb/lancedb",
    "source_uri": "https://github.com/lancedb/lancedb",
    "source_version": "HEAD",
    "content_hash": "0908f112bf365e2186dc14ce21d2be98604f9c9dfd8b145cab4c61c4604b71b2"
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
        "Harvested/verified timestamp recorded: 2026-11-15T09:21:42.156Z"
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
  "auth_token": "54600cac294395c99e7c4083890ce03ed7221c939e6fcad34dfd061c5ffeec2d"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
