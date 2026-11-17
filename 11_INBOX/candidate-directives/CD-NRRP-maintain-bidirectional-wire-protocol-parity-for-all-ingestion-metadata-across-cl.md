# Candidate Directive: [CD-NRRP] Maintain Bidirectional Wire Protocol Parity for All Ingestion Metadata across Client-Server Architecture

<!-- PROVENANCE_START
{
  "source_repository": "aquasecurity/trivy",
  "source_url": "https://github.com/aquasecurity/trivy",
  "source_version": "00b73947",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T08:31:11.701Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-aquasecurity-trivy",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [aquasecurity/trivy](https://github.com/aquasecurity/trivy) (Revision: `00b73947`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T08:31:11.701Z`  
> **Learning ID**: `learn-github-aquasecurity-trivy`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
// ANTI-PATTERN: Partial conversion silently discarding internal identifiers
func ConvertPolicyBad(meta types.PolicyMetadata) *rpc.PolicyMetadata {
	return &rpc.PolicyMetadata{
		Id:          meta.ID,
		Title:       meta.Title,
		Severity:    string(meta.Severity),
		// Aliases omitted: Client ignore-rules referring to check aliases will fail!
	}
}
```

**VERIFICATION METHOD**:
Implement bidirectional round-trip property-based fuzz tests verifying zero field loss across conversion layers:
```go
func TestPolicyMetadataRPCParity(t *testing.T) {
	orig := types.PolicyMetadata{
		ID:      "AVD-AWS-0001",
		Aliases: []string{"aws-s3-enable-bucket-encryption", "S3-001"},
	}
	rpcMsg := ConvertToRPCBlob(orig)
	reconstructed := ConvertFromRPCBlob(rpcMsg)
	require.Equal(t, orig.Aliases, reconstructed.Aliases, "Metadata wire drop detected")
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T08:31:11.700Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794904271700",
    "title": "Maintain Bidirectional Wire Protocol Parity for All Ingestion Metadata across Client-Server Architecture",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "aquasecurity/trivy",
    "source_uri": "https://github.com/aquasecurity/trivy",
    "source_version": "HEAD",
    "content_hash": "a91d29b035fff124a43d47cb1b0eb22817c1067291bb889ba616e9bdf28976ef"
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
        "Harvested/verified timestamp recorded: 2026-11-17T08:31:11.700Z"
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
  "auth_token": "b33aef812167a58932623e880e9927a4b51fe3c63f7e03825d96920846e206e8"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
