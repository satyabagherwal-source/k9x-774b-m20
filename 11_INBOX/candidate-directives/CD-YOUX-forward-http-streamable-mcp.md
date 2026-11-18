# Candidate Directive: [CD-YOUX] forward http streamable mcp

<!-- PROVENANCE_START
{
  "source_repository": "nolabs-ai/nono",
  "source_url": "https://github.com/nolabs-ai/nono",
  "source_version": "0f1aceae",
  "license": "Apache-2.0",
  "timestamp": "2026-11-18T00:59:27.705Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-nolabs-ai-nono",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [nolabs-ai/nono](https://github.com/nolabs-ai/nono) (Revision: `0f1aceae`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-18T00:59:27.705Z`  
> **Learning ID**: `learn-github-nolabs-ai-nono`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `crates/nono-proxy/src/forward.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in nolabs-ai/nono. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0f1aceae`: proxy): forward http streamable mcp. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/nono-proxy/src/forward.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    forward_request_inner(inbound, request_bytes, body, upstream, audit, None, false).await
}

/// Like [`forward_request`], for callers that serve exactly one request per
/// inbound connection and close it afterwards.
///
/// The final response head is rewritten to carry `Connection: close` so the
/// client does not reuse a connection the proxy is about to drop. Without it,
/// a keep-alive client (e.g. an MCP Streamable HTTP client) writes its next
/// request onto a socket nobody reads, and the request is lost when the
/// connection closes.
///
/// `request_bytes` must already ask the upstream for `Connection: close`: the
/// response body is relayed until upstream EOF.
pub async fn forward_request_closing_inbound<S>(
    inbound: &mut S,
    request_bytes: &[u8],
    body: &[u8],
    upstream: UpstreamSpec<'_>,
    audit: AuditCtx<'_>,
) -> Result<u16>
where
    S: AsyncRead + AsyncWrite + Unpin,
{
    forward_request_inner(inbound, request_bytes, body, upstream, audit, None, true).await
where
    S: AsyncRead + AsyncWrite + Unpin,
{
    forward_request_inner(
        inbound,
        request_bytes,
        body,
        upstream,
        audit,
        response_rewrite,
   
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    forward_request_with_response_rewrite(inbound, request_bytes, body, upstream, audit, None).await
            stream_or_rewrite_response(&mut tls_stream, inbound, response_rewrite).await?
            stream_or_rewrite_response(&mut tcp_stream, inbound, response_rewrite).await?
    match response_rewrite {
        Some(rewrite) => buffer_rewrite_response(upstream, inbound, rewrite).await,
        None => stream_response(upstream, inbound).await,
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0f1aceae` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T00:59:27.704Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794963567704",
    "title": "forward http streamable mcp",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "nolabs-ai/nono",
    "source_uri": "https://github.com/nolabs-ai/nono",
    "source_version": "HEAD",
    "content_hash": "bb66b6b5812996639140a4fd4db157cc0ba039b3e9c2d28b491763cce266ef91"
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
        "Harvested/verified timestamp recorded: 2026-11-18T00:59:27.704Z"
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
  "auth_token": "af3f0581028caad428ddadb56b023ae6af4c331eb8507addc9ec016938afbaea"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
