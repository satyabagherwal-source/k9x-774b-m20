# Candidate Directive: [CD-GCDF] Strict Standard Stream Partitioning for Structured IPC Plugins

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
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing an executable invoked by an external orchestrator that parses standard output (`os.Stdout`) as structured IPC data (e.g., CNI plugins, Git credential helpers, HashiCorp Packer/Terraform drivers, CLI JSON formatters), application runtime code and all linked dependencies MUST NEVER write arbitrary log messages, debug text, or panic traces to `os.Stdout`. All logging, diagnostic outputs, and panic traces MUST be redirected exclusively to `os.Stderr`.

**WHY**:
External orchestrators (such as the Kubernetes `kubelet` invoking CNI binaries via Containerd/CRI-O) read `stdout` until `EOF` and execute `json.Unmarshal()` directly against that byte slice. If an embedded logging framework or an imported third-party library writes even a single byte of plain text (e.g., `"2026-11-16T10:00:00Z INFO starting plugin..."`) to `stdout`, the JSON parser fails with a syntactic unmarshal error (e.g., `invalid character '2' looking for beginning of value`). This causes container sandbox creation to permanently fail with `ContainerCreating` crash loops across the entire cluster.

**WHEN TO APPLY**:
- Kubernetes CNI plugins and network drivers.
- Custom CLI tools emitting output destined for JSON/YAML Unix piping (`| jq`).
- Microservices communicating across POSIX standard streams.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// app/cni/pkg/install/utils.go
package install

import (
	"os"

	"github.com/go-logr/logr"
	"github.com/kumahq/kuma/v3/pkg/core"
	kuma_log "github.com/kumahq/kuma/v3/pkg/log"
)

// CreateNewLogger ensures all log emissions bypass stdout entirely.
// kubelet expects a specific JSON payload on stdout; writing any diagnostic text
// to stdout corrupts the CNI protocol exchange.
func CreateNewLogger(name string, logLevel kuma_log.LogLevel) logr.Logger {
	return core.NewLoggerTo(os.Stderr, logLevel).WithName(name)
}

func SetLogLevel(logger *logr.Logger, level string, name string) error {
	logLevel, err := kuma_log.ParseLogLevel(level)
	if err != nil {
		return err
	}

	*logger = CreateNewLogger(name, logLevel)
	return nil
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Defaulting loggers to stdout or using global print statements
func BadCNIInit() {
    // FATAL: Pollutes stdout with non-JSON text, breaking kubelet sandbox initialization!
    fmt.Println("Configuring pod network interface...")
    logger := zap.NewExample() // Defaults to stdout

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T03:17:29.376Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794885449375",
    "title": "Strict Standard Stream Partitioning for Structured IPC Plugins",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "kumahq-kuma-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "05a98a1b056df980cc18484c5cc5e8ac87df478199654c8aeb8dbb5346ab6e8a"
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
        "Harvested/verified timestamp recorded: 2026-11-17T03:17:29.376Z"
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
  "auth_token": "f0c01b42e25ae552a026fb3f25d3761307532debe97610a9ed6cb23361801419"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
