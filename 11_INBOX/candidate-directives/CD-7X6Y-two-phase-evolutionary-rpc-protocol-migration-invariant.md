# Candidate Directive: [CD-7X6Y] Two-Phase Evolutionary RPC Protocol Migration Invariant

<!-- PROVENANCE_START
{
  "source_repository": "pulumi-pulumi-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T08:46:51.698Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-pulumi-pulumi-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [pulumi-pulumi-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T08:46:51.698Z`  
> **Learning ID**: `LEARN-EVO-pulumi-pulumi-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When evolving a core RPC contract with breaking changes or expanding parameter shapes, the protocol client **MUST** invoke the new versioned method (`MethodV2`) first and catch `codes.Unimplemented`. Upon receiving `codes.Unimplemented`, it **MUST** automatically fall back to the legacy method (`MethodV1`), translating the legacy response types into the unified internal representation. Deprecated SDK stubs **MUST NOT** be removed until complete ecosystem cut-off; they **MUST** explicitly return `codes.Unimplemented`.

**WHY**:
In distributed plugin architectures, engines and plugins are independently versioned and compiled across different runtimes. In-place modification of existing gRPC request/response messages (`CheckRequest`/`CheckResponse`) causes cross-version serialization skew, breaks un-recompiled plugins, or corrupts structural types when distinct domains (e.g., resource checking vs provider configuration checking) share overloaded payload structs.

**WHEN TO APPLY**:
Apply to any client-server or host-plugin interface communicating via Protobuf, gRPC, or versioned JSON-RPC where backward compatibility with out-of-tree plugins is mandatory.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Extracted from pkg/resource/plugin/provider_plugin.go
func (p *provider) CheckConfig(ctx context.Context, req CheckConfigRequest) (CheckConfigResponse, error) {
    molds := propertyrpc.Marshal(req.Olds)
    mnews := propertyrpc.Marshal(req.News)

    var rpcInputs *structpb.Struct
    var failures []CheckConfigFailure

    // Phase 1: Attempt the evolved CheckConfig2 RPC with decoupled schemas
    resp2, err := p.clientRaw.CheckConfig2(p.requestContext(), &pulumirpc.CheckConfigRequest{
        Urn:       string(req.URN),
        Name:      req.URN.Name(),
        Type:      req.URN.Type().String(),
        OldInputs: molds,
        NewInputs: mnews,
    })

    switch {
    case err == nil:
        rpcInputs = resp2.GetInputs()
        failures = slice.Prealloc[CheckConfigFailure](len(resp2.GetFailures()))
        for _, failure := range resp2.GetFailures() {
            failures = append(failures, checkConfigFailureFromRPC(failure))
        }

    // Phase 2: Detect lack of support on older plugins and fall back seamlessly
    case rpcerror.Convert(err).Code() == codes.Unimplemented:
        logging.V(7).Infof("%s CheckConfig2 is unimplemented: falling back to CheckConfig", req.URN)
        resp, err := p.clientRaw.CheckConfig(p.requestContext(), &pulumirpc.CheckRequest{
            Urn:  string(req.URN),
            Name: req.URN.Name(),
            Type: req.URN.Type().String(),
            Olds: molds,
            News: mnews,
        })
        if err != nil {
            rpcErr := rpcerror.Convert(err)
            if rpcErr.Code() == codes.Unimplemented {

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T08:46:51.848Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794905211848",
    "title": "Two-Phase Evolutionary RPC Protocol Migration Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "pulumi-pulumi-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "59fe62f78cd50ceaa74984c63cb6a5680821d649fb8414934693c73fcb676b5f"
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
        "Expresses generalized engineering invariants (3 architectural markers)",
        "Explicit WHEN TO APPLY scope defined"
      ]
    },
    "completeness": {
      "status": "PASS",
      "score": 0.85,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-17T08:46:51.849Z"
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
  "auth_token": "1c1764e04835e8aef28d9d9c4854f78107205b691f3b42e53ab3490da3dded54"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
