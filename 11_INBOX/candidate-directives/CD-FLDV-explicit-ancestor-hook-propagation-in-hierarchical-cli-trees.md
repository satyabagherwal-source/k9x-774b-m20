# Candidate Directive: [CD-FLDV] Explicit Ancestor Hook Propagation in Hierarchical CLI Trees

<!-- PROVENANCE_START
{
  "source_repository": "kumahq/kuma",
  "source_url": "https://github.com/kumahq/kuma",
  "source_version": "a71f8a93",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T03:16:54.403Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-kumahq-kuma",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [kumahq/kuma](https://github.com/kumahq/kuma) (Revision: `a71f8a93`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T03:16:54.403Z`  
> **Learning ID**: `learn-github-kumahq-kuma`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Defining subcommand PersistentPreRunE without invoking parent
var subCmd = &cobra.Command{
	Use: "apply",
	PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
		// BUG: Cobra skips rootCmd.PersistentPreRunE!
		// Config, logger, and KubeClient are nil!
		return setupLocalFlags() 
	},
}
```

**VERIFICATION METHOD**:
Static analysis check or unit test asserting that every command possessing a non-nil `PersistentPreRunE` invokes `RunParentPreRunE` or that parent context properties are non-nil when executing subcommands:
```go
func TestCommandHierarchyContextInitialization(t *testing.T) {
	rootCmd := NewRootCmd()
	subCmd := NewSubCmd()
	rootCmd.AddCommand(subCmd)

	// Set args that target the child command
	rootCmd.SetArgs([]string{"sub", "--dry-run"})
	err := rootCmd.Execute()
	assert.NoError(t, err)
	// Assert root context configuration was populated despite child PersistentPreRunE
	assert.NotNil(t, subCmd.ConfigContext)
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T03:16:54.402Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.66,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 66%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794885414402",
    "title": "Explicit Ancestor Hook Propagation in Hierarchical CLI Trees",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "kumahq/kuma",
    "source_uri": "https://github.com/kumahq/kuma",
    "source_version": "HEAD",
    "content_hash": "e9775a9630f4f64447de32812213f26e4b7e77e08f20b72cd2482fd1109462fd"
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
        "Harvested/verified timestamp recorded: 2026-11-17T03:16:54.402Z"
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
  "auth_token": "28132e4398560872dc468758bb66992974ff5abfffa30811c23d24cbb69b0044"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
