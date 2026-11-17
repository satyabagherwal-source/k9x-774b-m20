# Candidate Directive: [CD-P7XE] Maintain Bidirectional Wire Protocol Parity for All Ingestion Metadata across Client-Server Architecture

<!-- PROVENANCE_START
{
  "source_repository": "aquasecurity-trivy-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T08:32:19.198Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-aquasecurity-trivy-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [aquasecurity-trivy-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T08:32:19.198Z`  
> **Learning ID**: `LEARN-EVO-aquasecurity-trivy-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**: In distributed scanning systems where inspection/parsing occurs on a client node and policy/vulnerability evaluation occurs on a centralized server, all metadata fields added to client domain models (e.g., policy aliases, suppression rules, location tags, source file offsets) MUST be simultaneously implemented in the intermediate RPC IDL (Protobuf/gRPC schema) and mapped across the translation boundary. Furthermore, the storage cache key MUST invalidate or version when wire-format metadata structures are augmented.

**WHY**: Omitting metadata fields in transit schemas creates silent execution divergences between standalone and distributed execution modes. For example, when client-side security policies contain alias mappings (e.g., `AVD-DS-0002` -> `no-ssh-port`), dropping the alias in the gRPC layer causes the evaluation server to return findings without aliases. Client-side ignore files referencing aliases will then match nothing on the server, causing suppressed vulnerabilities to be falsely flagged as unresolved blocking violations exclusively in CI/CD server mode.

**WHEN TO APPLY**: Multi-tier architectures, gRPC/Protobuf client-server engines, and distributed caching scanners.

**VERIFIED IMPLEMENTATION PATTERN**:
```protobuf
// File: rpc/common/service.proto
syntax = "proto3";
package rpc.cache;

message PolicyMetadata {
  string id = 1;
  string title = 2;
  string description = 3;
  string severity = 4;
  // Field MUST be explicitly preserved across wire protocol
  repeated string aliases = 5;
  int64 schema_version = 6;
}
```

```go
// File: pkg/rpc/convert.go
func ConvertToRPCBlob(meta types.PolicyMetadata) *rpc.PolicyMetadata {
	return &rpc.PolicyMetadata{
		Id:            meta.ID,
		Title:         meta.Title,
		Description:   meta.Description,
		Severity:      string(meta.Severity),
		Aliases:       meta.Aliases, // Explicit wire transfer
		SchemaVersion: 2,
	}
}

func ConvertFromRPCBlob(rpcMeta *rpc.PolicyMetadata) types.PolicyMetadata {
	return types.PolicyMetadata{
		ID:          rpcMeta.Id,
		Title:       rpcMeta.Title,
		Description: rpcMeta.Description,
		Severity:    types.Severity(rpcMeta.Severity),
		Aliases:     rpcMeta.Aliases, // Restored finding parity
	}
}
```

**NEGATIVE CONSTRAINT**:
```go

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T08:32:19.297Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794904339297",
    "title": "Maintain Bidirectional Wire Protocol Parity for All Ingestion Metadata across Client-Server Architecture",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "aquasecurity-trivy-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "8a566a5b1defc255911fd70d432c3b212844d83638bd0323a72218120c159482"
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
        "Harvested/verified timestamp recorded: 2026-11-17T08:32:19.297Z"
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
  "auth_token": "9465aefe160dfd8bd9ee664b03a18443159b29f3c3e83e72b6928b4d544fb1b9"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
