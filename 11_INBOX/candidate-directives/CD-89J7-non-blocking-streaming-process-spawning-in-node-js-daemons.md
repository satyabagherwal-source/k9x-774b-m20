# Candidate Directive: [CD-89J7] Non-Blocking Streaming Process Spawning In Node.js Daemons

<!-- PROVENANCE_START
{
  "source_repository": "mintplex-labs-anything-llm-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-19T09:18:27.774Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-mintplex-labs-anything-llm-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [mintplex-labs-anything-llm-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-19T09:18:27.774Z`  
> **Learning ID**: `LEARN-EVO-mintplex-labs-anything-llm-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
Daemons handling asynchronous I/O MUST NEVER execute long-running CLI tools, transcoders, or search binaries using `child_process.spawnSync` or `child_process.execSync`. External binaries with non-deterministic runtimes MUST be executed via `child_process.spawn`, wrapped in an event-driven `Promise`, streaming chunks via stdout/stderr, bounded by strict byte buffers, and aborted via explicit process signal propagation (`SIGTERM`/`SIGKILL`).

**WHY**:
Node.js runs on a single-threaded libuv event loop. Executing `spawnSync` for operations like FFmpeg audio transcode or Ripgrep search blocks the entire V8 thread. During process execution, zero network packets, HTTP requests, timer callbacks, or WebSocket/SSE heartbeats can be processed, causing cluster-wide connection dropouts, reverse-proxy gateway timeouts (HTTP 504), and false health-check probe terminations.

**WHEN TO APPLY**:
Any Node.js/TypeScript backend service executing system-level binaries (FFmpeg, Ripgrep, Pandoc, ImageMagick, Git, LibreOffice) where target data sizes or process runtimes exceed 5 milliseconds.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// collector/utils/process/safeSpawn.js
const { spawn } = require("child_process");

/**
 * Spawns an external binary asynchronously without stalling the libuv event loop.
 * Implements strict byte caps, line streaming, and resource cleanup.
 *
 * @param {string} binary Path to executable
 * @param {string[]} args CLI arguments array
 * @param {Object} options Options object
 * @param {number} [options.maxBytes=10485760] Stdout buffer threshold (10MB default)
 * @param {(line: string) => boolean|void} [options.onLine] Stream consumer; return true to abort early
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number|null}>}
 */
function safeSpawnBinary(binary, args, { maxBytes = 10 * 1024 * 1024, onLine = null } = {}) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(binary, args, {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (err) {
      return reject(new Error(`Failed to spawn binary ${binary}: ${err.message}`));
    }

    let stdoutAcc = "";
    let stderrAcc = "";
    let stdoutBytes = 0;
    let pendingLine = "";
    let isTerminated = false;

    const terminate = () => {
      if (isTerminated) return;
      isTerminated = true;
      child.kill("SIGTERM");
      // Fallback force-kill if binary ignores SIGTERM
      setTimeout(() => {

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T09:18:27.904Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795079907904",
    "title": "Non-Blocking Streaming Process Spawning In Node.js Daemons",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "mintplex-labs-anything-llm-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "444acea25210035a7de48d68d3a7c515c91b1a0d61ff7f4b960ef3c113f1c715"
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
        "Harvested/verified timestamp recorded: 2026-11-19T09:18:27.905Z"
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
  "auth_token": "f5cce0b152fcc3bf506d9c39ff36c2f9183373db77a6ab5ef26a8e88671908ac"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
