# Candidate Directive: [CD-FLDT] Strict Standard Stream Partitioning for Structured IPC Plugins

<!-- PROVENANCE_START
{
  "source_repository": "kumahq/kuma",
  "source_url": "https://github.com/kumahq/kuma",
  "source_version": "a71f8a93",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T03:16:54.402Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-kumahq-kuma",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [kumahq/kuma](https://github.com/kumahq/kuma) (Revision: `a71f8a93`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T03:16:54.402Z`  
> **Learning ID**: `learn-github-kumahq-kuma`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
    logger.Info("CNI network plugin executed successfully")
}
```

**VERIFICATION METHOD**:
Enforce stream separation using a unit test that captures `os.Stdout` during mock execution and asserts that the captured stream contains solely valid JSON without prefix/suffix garbage:
```go
func TestCNIStdoutPurity(t *testing.T) {
	oldStdout := os.Stdout
	r, w, _ := os.Pipe()
	os.Stdout = w

	// Execute logger and CNI setup logic
	logger := CreateNewLogger("cni-test", kuma_log.InfoLevel)
	logger.Info("This must not leak to stdout")
	
	// Emit dummy response
	_, _ = w.Write([]byte(`{"cniVersion": "1.0.0", "interfaces": []}`))
	_ = w.Close()
	os.Stdout = oldStdout

	out, _ := io.ReadAll(r)
	var dummy map[string]any
	if err := json.Unmarshal(out, &dummy); err != nil {
		t.Fatalf("stdout was corrupted with non-JSON data: %v (raw: %q)", err, string(out))
	}
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T03:16:54.400Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.66,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 66%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794885414400",
    "title": "Strict Standard Stream Partitioning for Structured IPC Plugins",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "kumahq/kuma",
    "source_uri": "https://github.com/kumahq/kuma",
    "source_version": "HEAD",
    "content_hash": "3779095f82a5b002d759c82d404da41ea4dbcd8f7eff0bda1a3333b7f07b6104"
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
        "Harvested/verified timestamp recorded: 2026-11-17T03:16:54.400Z"
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
  "auth_token": "5e923b46bfbf61f1a7757a21d34095f1cd29076d30466c2007a72ae87b1da2b6"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
