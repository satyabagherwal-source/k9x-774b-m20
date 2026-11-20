# Candidate Directive: [CD-W365] Suffix-Stripping Block-Level AST Normalization

<!-- PROVENANCE_START
{
  "source_repository": "hashicorp-terraform-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T01:56:45.845Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hashicorp-terraform-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hashicorp-terraform-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T01:56:45.845Z`  
> **Learning ID**: `LEARN-EVO-hashicorp-terraform-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T01:56:45.965Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795139805965",
    "title": "Suffix-Stripping Block-Level AST Normalization",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hashicorp-terraform-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "27b1d8f8e46758575e49417be4f4ef276c25048c595c9a27e0b23354ffbe26dc"
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
        "Harvested/verified timestamp recorded: 2026-11-20T01:56:45.965Z"
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
  "auth_token": "623bfe5407918f9710c2cc2cb2f3208fbf268e636154a04fa31e3f6273339274"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
