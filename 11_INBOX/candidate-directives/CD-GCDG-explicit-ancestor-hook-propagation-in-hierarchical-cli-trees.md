# Candidate Directive: [CD-GCDG] Explicit Ancestor Hook Propagation in Hierarchical CLI Trees

<!-- PROVENANCE_START
{
  "source_repository": "kumahq-kuma-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T03:17:29.282Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-kumahq-kuma-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [kumahq-kuma-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T03:17:29.282Z`  
> **Learning ID**: `LEARN-EVO-kumahq-kuma-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When building CLI tools with nested command hierarchies using frameworks where parent pre-run hooks are superseded by child command hooks (such as Cobra's `PersistentPreRun` / `PersistentPreRunE`), any child command defining its own `PersistentPreRunE` MUST explicitly invoke the parent's `PersistentPreRunE` up the ancestor chain.

**WHY**:
In `github.com/spf13/cobra`, if a root or intermediate command defines a `PersistentPreRunE` (e.g., to load configuration files, initialize authentication contexts, or set up tracing), and a subcommand subsequently defines its own `PersistentPreRunE`, Cobra only executes the subcommand's hook, silently dropping the parent's hook. This causes child commands to execute with uninitialized configuration structs, missing credentials, unparsed flags, or nil-pointer dereferences on shared service clients.

**WHEN TO APPLY**:
- All Go CLI architectures utilizing `spf13/cobra`.
- Nested CLI command trees requiring hierarchical context setup.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// app/kumactl/pkg/cmd/util.go
package cmd

import "github.com/spf13/cobra"

// RunParentPreRunE checks if the parent command has a PersistentPreRunE set and
// executes it. This is for use in PersistentPreRun and is necessary because
// only the first PersistentPreRun* of the command's ancestors is executed by cobra.
func RunParentPreRunE(cmd *cobra.Command, args []string) error {
	if p := cmd.Parent(); p != nil && p.PersistentPreRunE != nil {
		if err := p.PersistentPreRunE(p, args); err != nil {
			return err
		}
	}
	return nil
}
```

```go
// Usage inside subcommand definition:
var subCmd = &cobra.Command{
	Use:   "sub",
	Short: "Subcommand requiring root context",
	PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
		// Explicitly propagate execution to parent/root PersistentPreRunE
		if err := cmd_util.RunParentPreRunE(cmd, args); err != nil {
			return err
		}
		// Now safe to run subcommand-specific setup
		return initSubcommandResources()
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		return execute()
	},
}
```

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T03:17:29.380Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794885449380",
    "title": "Explicit Ancestor Hook Propagation in Hierarchical CLI Trees",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "kumahq-kuma-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "40f7098145a9dc7e1ec10253393646017feb1ab464c761fe53224f2d77b23c8e"
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
      "score": 0.8,
      "is_generic_pattern": true,
      "has_local_paths": false,
      "findings": [],
      "details": [
        "Free of local workstation path artifacts",
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
        "Harvested/verified timestamp recorded: 2026-11-17T03:17:29.380Z"
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
  "auth_token": "b9f2fc6505451345a7fe635c7fdb1bee457ad4f175d91515ea78e8f28ab0b305"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
