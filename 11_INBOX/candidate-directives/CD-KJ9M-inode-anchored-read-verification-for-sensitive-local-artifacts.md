# Candidate Directive: [CD-KJ9M] Inode-Anchored Read Verification for Sensitive Local Artifacts

<!-- PROVENANCE_START
{
  "source_repository": "melnixdev-seo-crawl-audit-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-15T08:53:19.789Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-melnixdev-seo-crawl-audit-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [melnixdev-seo-crawl-audit-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-15T08:53:19.789Z`  
> **Learning ID**: `LEARN-EVO-melnixdev-seo-crawl-audit-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When reading local serialized files where modification or link replacement during the read cycle could cause data corruption or arbitrary file read vulnerabilities, systems MUST open the path with `O_NOFOLLOW`, capture the file descriptor’s device (`dev`) and inode (`ino`) metadata via `stat()`, verify they match the initial directory traversal `lstat()`, and perform a post-read `fstat()` verification to confirm `ino`, `dev`, `size`, and `mtimeMs` have not drifted prior to processing.

**WHY**:
Standard `fs.readFile()` calls are vulnerable to race conditions where an external process replaces a valid file with a symlink or overwrites the content during the I/O window (TOCTOU). In crawl audit and snapshot systems, loading an invalid or mutated snapshot introduces corrupt differential baselines, generates false-positive regressions, or risks directory traversal exploits.

**WHEN TO APPLY**:
Apply in any CLI, daemon, or engine that loads stored local caches, security baselines, state snapshots, or historical database dumps from user-controlled or shared workspace directories.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { join } from "node:path";

export interface VerifiedFileRead {
  content: string;
  size: number;
  mtimeMs: number;
}

export async function readVerifiedLocalFile(directory: string, filename: string): Promise<VerifiedFileRead> {
  // Reject directory separators to enforce single-level resolution
  if (filename.includes("/") || filename.includes("\\")) {
    throw new Error(`Insecure filename contains directory traversal characters: ${filename}`);
  }

  const fullPath = join(directory, filename);
  const initialStat = await lstat(fullPath);

  if (!initialStat.isFile() || initialStat.isSymbolicLink()) {
    throw new Error(`Target is not a regular file or is a symbolic link: ${fullPath}`);
  }

  // Open with O_NOFOLLOW to atomically reject symlink swaps
  const fileHandle = await open(fullPath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const handleStat = await fileHandle.stat();
    if (!handleStat.isFile() || handleStat.ino !== initialStat.ino || handleStat.dev !== initialStat.dev) {
      throw new Error(`File identity mutation detected while acquiring handle: ${fullPath}`);
    }

    const content = await fileHandle.readFile("utf8");

    // Post-read check: verify size and modification timestamp have not changed mid-read
    const postStat = await lstat(fullPath);
    if (
      !postStat.isFile() ||
      postStat.ino !== handleStat.ino ||

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T08:53:19.880Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794732799879",
    "title": "Inode-Anchored Read Verification for Sensitive Local Artifacts",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "melnixdev-seo-crawl-audit-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "2656c53ee785d5992c13ed33788df79b43e1600bd4c56322dfc5a67ba0904646"
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
        "Harvested/verified timestamp recorded: 2026-11-15T08:53:19.880Z"
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
  "auth_token": "427fce61d8ac0ffdaf3d56824a200c3340ae1b12cf3a562e6943215b619f8dcc"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
