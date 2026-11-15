# Candidate Directive: [CD-JCAX] Inode-Anchored Read Verification for Sensitive Local Artifacts

<!-- PROVENANCE_START
{
  "source_repository": "MelnixDev/seo-crawl-audit",
  "source_url": "https://github.com/MelnixDev/seo-crawl-audit",
  "source_version": "abed0505",
  "license": "MIT",
  "timestamp": "2026-11-15T08:52:24.201Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-melnixdev-seo-crawl-audit",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [MelnixDev/seo-crawl-audit](https://github.com/MelnixDev/seo-crawl-audit) (Revision: `abed0505`).  
> **License**: MIT | **Timestamp**: `2026-11-15T08:52:24.201Z`  
> **Learning ID**: `learn-github-melnixdev-seo-crawl-audit`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
      postStat.dev !== handleStat.dev ||
      postStat.size !== handleStat.size ||
      postStat.mtimeMs !== handleStat.mtimeMs
    ) {
      throw new Error(`File content mutated during read operation: ${fullPath}`);
    }

    return { content, size: handleStat.size, mtimeMs: handleStat.mtimeMs };
  } finally {
    await fileHandle.close();
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// CRITICAL ANTI-PATTERN: Direct readFile vulnerable to TOCTOU and symlink injection
import { readFile } from "node:fs/promises";

async function unsafeReadHistory(directory: string, filename: string): Promise<string> {
  // FAILS: No traversal guard, no symlink verification, no inode pinning
  return await readFile(`${directory}/${filename}`, "utf8");
}
```

**VERIFICATION METHOD**:
Verify using a concurrent integration test: spawn a child process that alternates a target file between a genuine file and a symlink pointing outside the workspace (`symlinkSync`) while the reading function executes 1,000 rapid reads. Confirm that 100% of attempts either return valid, untampered content or throw the expected mutation error, with 0 arbitrary read escapes.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T08:52:24.200Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.66,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 66%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794732744200",
    "title": "Inode-Anchored Read Verification for Sensitive Local Artifacts",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "MelnixDev/seo-crawl-audit",
    "source_uri": "https://github.com/MelnixDev/seo-crawl-audit",
    "source_version": "HEAD",
    "content_hash": "fbac659941f5e3de3e670f5a9546a4cc5c35e9664917420b66e165fdca2cac4a"
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
        "Harvested/verified timestamp recorded: 2026-11-15T08:52:24.200Z"
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
  "auth_token": "565ddd814995ad156fb074bac525067959a0a91995e39a1cf2b6b8112cbd5ef8"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
