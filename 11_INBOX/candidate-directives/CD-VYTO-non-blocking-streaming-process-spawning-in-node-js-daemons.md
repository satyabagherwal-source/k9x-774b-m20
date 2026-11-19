# Candidate Directive: [CD-VYTO] Non-Blocking Streaming Process Spawning In Node.js Daemons

<!-- PROVENANCE_START
{
  "source_repository": "Mintplex-Labs/anything-llm",
  "source_url": "https://github.com/Mintplex-Labs/anything-llm",
  "source_version": "2f6a451f",
  "license": "MIT",
  "timestamp": "2026-11-19T09:08:54.156Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-mintplex-labs-anything-llm",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Mintplex-Labs/anything-llm](https://github.com/Mintplex-Labs/anything-llm) (Revision: `2f6a451f`).  
> **License**: MIT | **Timestamp**: `2026-11-19T09:08:54.156Z`  
> **Learning ID**: `learn-github-mintplex-labs-anything-llm`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
        if (!child.killed) child.kill("SIGKILL");
      }, 250);
    };

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      if (isTerminated) return;
      stdoutBytes += Buffer.byteLength(chunk);
      if (stdoutBytes > maxBytes) {
        terminate();
        return;
      }

      if (typeof onLine === "function") {
        const lines = (pendingLine + chunk).split("\n");
        pendingLine = lines.pop(); // Keep uncompleted trailing chunk
        for (const line of lines) {
          const cleanLine = line.replace(/\r$/, "");
          if (cleanLine && onLine(cleanLine) === true) {
            terminate();
            return;
          }
        }
      } else {
        stdoutAcc += chunk;
      }
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      if (stderrAcc.length < 4096) stderrAcc += chunk;
    });

    child.on("error", (err) => {
      isTerminated = true;
      reject(err);
    });

    child.on("close", (code) => {
      if (isTerminated) {
        return resolve({ stdout: stdoutAcc, stderr: stderrAcc, exitCode: code });
      }
      if (code !== 0 && code !== null) {
        return reject(
          new Error(`Process ${binary} exited with code ${code}: ${stderrAcc.trim()}`)
        );
      }
      if (pendingLine && typeof onLine === "function") {
        onLine(pendingLine.replace(/\r$/, ""));
      }
      resolve({ stdout: stdoutAcc, stderr: stderrAcc, exitCode: code });
    });
  });
}
```

**NEGATIVE CONSTRAINT**:
```javascript
// CRITICAL DEFECT: NEVER BLOCK EVENT LOOP IN BACKEND DAEMON
const { spawnSync } = require("child_process");

function convertAudio(input, output) {
  // Freezes node server for minutes on 50MB audio files!
  const result = spawnSync("ffmpeg", ["-i", input, output], { encoding: "utf8" });
  if (result.status !== 0) throw new Error("FFmpeg failed");
  return true;
}
```

**VERIFICATION METHOD**:
Execute an automated concurrency test: Run an HTTP server providing a `/ping` endpoint and a `/transcode` endpoint. Fire continuous `/ping` requests on a 10ms interval using an autonomous test runner while triggering a 50MB audio file conversion on `/transcode`. Assert that `/ping` latency P99 remains `< 15ms` throughout process execution.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T09:08:54.153Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795079334153",
    "title": "Non-Blocking Streaming Process Spawning In Node.js Daemons",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "Mintplex-Labs/anything-llm",
    "source_uri": "https://github.com/Mintplex-Labs/anything-llm",
    "source_version": "HEAD",
    "content_hash": "3971f43c7c8ed6dd4a690d3e52a990f8646bcdf47736ae2cd6f79c6d203195a7"
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
        "Harvested/verified timestamp recorded: 2026-11-19T09:08:54.153Z"
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
  "auth_token": "f065696f1f929559dae5bcc4519dcc386bc48cdab561102152fcb73b14c003c9"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
