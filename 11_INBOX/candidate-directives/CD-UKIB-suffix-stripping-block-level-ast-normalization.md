# Candidate Directive: [CD-UKIB] Suffix-Stripping Block-Level AST Normalization

<!-- PROVENANCE_START
{
  "source_repository": "hashicorp/terraform",
  "source_url": "https://github.com/hashicorp/terraform",
  "source_version": "cefb61b7",
  "license": "NOASSERTION",
  "timestamp": "2026-11-20T01:55:35.123Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-hashicorp-terraform",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hashicorp/terraform](https://github.com/hashicorp/terraform) (Revision: `cefb61b7`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-20T01:55:35.123Z`  
> **Learning ID**: `learn-github-hashicorp-terraform`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When serializing dynamically generated block bodies into AST/formatting engines (e.g., HCL, JSON, XML), code generators MUST NOT format inner blocks repeatedly on raw string concatenation. The generator MUST format the complete synthetic root construct once, and accurately slice off the synthetic header and footer using structural byte offsets.

**WHY**:
Calling formatting/AST parsing engines repeatedly per-node in nested sequences generates $O(N \cdot K)$ string allocations and garbage collector pressure. Repeated re-parsing and formatting causes performance degradation when processing large arrays (e.g., 10,000+ query results). Formatting once inside synthetic delimiters and byte-slicing ensures $O(1)$ formatting overhead.

**WHEN TO APPLY**:
Templating engines, HCL/JSON/YAML configuration synthesis, schema generation, code refactoring tools.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Extracted from internal/genconfig/generate_config.go
func resourceHeader(addr addrs.AbsResourceInstance) string {
    return fmt.Sprintf("resource %q %q {\n", addr.Resource.Resource.Type, addr.Resource.Resource.Name)
}

func GenerateResourceContents(
    addr addrs.AbsResourceInstance,
    schema *configschema.Block,
    provider addrs.LocalProviderConfig,
    configVal cty.Value,
    forceProvider bool,
) (Resource, tfdiags.Diagnostics) {
    var buf strings.Builder
    var diags tfdiags.Diagnostics

    // Assemble internal block body contents
    diags = diags.Append(writeConfigBlocksFromExisting(addr, &buf, configVal, schema.BlockTypes, 2))

    // Wrap in synthetic wrapper, format EXACTLY ONCE, slice wrapper boundaries
    header := resourceHeader(addr)
    formatted := hclwrite.Format([]byte(header + buf.String() + "}"))
    
    // Slice off header and trailing '}'
    return Resource{
        Addr: addr, 
        Body: formatted[len(header) : len(formatted)-1],
    }, diags
}

func (r Resource) String() string {
    var buf strings.Builder
    buf.WriteString(resourceHeader(r.Addr))
    buf.Write(r.Body)
    buf.WriteString("}")
    return buf.String()
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Formatting body on generation, and then re-formatting again on String()
func (r BadResource) String() string {
    var buf strings.Builder
    buf.WriteString(fmt.Sprintf("resource %q %q {\n", r.Type, r.Name))
    buf.Write(r.Body)
    buf.WriteString("}")
    // Catastrophic overhead: re-parses and formats the entire AST on every call
    formatted := hclwrite.Format([]byte(buf.String()))
    return string(formatted)
}
```

**VERIFICATION METHOD**:
Micro-benchmark testing memory allocation ceiling:
```go
func BenchmarkResourceConfigString(b *testing.B) {
    r := Resource{Addr: testAddr, Body: []byte("  attr = \"value\"\n")}
    b.ReportAllocs()
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        _ = r.String()
    }
    // Verifies zero AST parse cycles during simple serialization
    if b.AllocsPerOp() > 2 {
        b.Fatalf("expected <= 2 allocs, got %d", b.AllocsPerOp())
    }
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T01:55:35.123Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795139735123",
    "title": "Suffix-Stripping Block-Level AST Normalization",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hashicorp/terraform",
    "source_uri": "https://github.com/hashicorp/terraform",
    "source_version": "HEAD",
    "content_hash": "b8d557f39c6c5d64c43db2ffa6174e851b6f477f8a901463a8ddfe5073a7cede"
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
        "Harvested/verified timestamp recorded: 2026-11-20T01:55:35.123Z"
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
  "auth_token": "6bb753b010196f195436d2facbb6bf59df269738c8e460674d55a00bf069ca16"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
