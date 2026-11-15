# Candidate Directive: [CD-4LGZ] Inode/Device-Bound Symlink Traversal Verification (O_NOFOLLOW & Same-Device Pinning)

<!-- PROVENANCE_START
{
  "source_repository": "vercel-labs-agent-desktop-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-15T21:44:45.402Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-vercel-labs-agent-desktop-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [vercel-labs-agent-desktop-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-15T21:44:45.402Z`  
> **Learning ID**: `LEARN-EVO-vercel-labs-agent-desktop-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When writing into untrusted or externally mounted filesystem trees, the caller **MUST NOT** use recursive path resolution or standard shell redirection (`>`). The process **MUST** open every path segment individually using `O_NOFOLLOW | O_NONBLOCK`, verify with `fstat(2)` that each segment resides on the exact target volume root device (`st_dev`), confirm directory types via `S_ISDIR`, and verify target file types via `S_ISREG` before performing zero-truncation or writing.

**WHY**:
An untrusted guest or unprivileged worker can create a symbolic link targeting arbitrary host files (e.g., `/etc/passwd`, `~/.ssh/authorized_keys`, or host kernel artifacts). Simple operations like `cat key > $mount/private/etc/ssh/ssh_host_ed25519_key` resolve the symlink on the host kernel, causing arbitrary host file overwrite (arbitrary file write / host compromise).

**WHEN TO APPLY**:
Any orchestration system, container agent, hypervisor host, or build tool that modifies guest disks, virtual machine volume mounts, or non-root user workspaces.

**VERIFIED IMPLEMENTATION PATTERN**:
```perl
use strict;
use warnings;
use Fcntl qw(:mode O_WRONLY O_CREAT O_NOFOLLOW O_NONBLOCK);

sub secure_write_volume_file {
    my ($volume_root, $relative_dir_path, $file_name, $content) = @_;

    chdir $volume_root or die "Cannot chdir to target volume: $!";
    my @root_stat = stat "." or die "Cannot stat volume root: $!";
    my $volume_dev = $root_stat[0]; # st_dev

    my @segments = split m{/+}, $relative_dir_path;
    for my $segment (@segments) {
        next if $segment eq '' || $segment eq '.';
        die "Path traversal attempt detected" if $segment eq '..';

        my @lstat_info = lstat $segment or die "Failed lstat for $segment: $!";
        # Invariant 1: Must belong to identical device/volume
        $lstat_info[0] == $volume_dev or die "Symlink or bind mount crossed device boundary: $segment";
        # Invariant 2: Segment MUST be a directory, never a link
        S_ISDIR($lstat_info[2]) or die "$segment is not a directory";

        chdir $segment or die "Failed chdir into $segment: $!";
        my @entered = stat "." or die "Failed stat inside $segment: $!";
        ($entered[0] == $lstat_info[0] && $entered[1] == $lstat_info[1])
            or die "TOCTOU race detected while stepping into $segment";
    }

    # Open file strictly without following symlinks and non-blocking
    sysopen(my $out, $file_name, O_WRONLY | O_CREAT | O_NOFOLLOW | O_NONBLOCK, 0644)
        or die "Refusing to open file (possible symlink): $!";

    my @held = stat $out or die "stat failed on opened descriptor: $!";
    (S_ISREG($held[2]) && $held[0] == $volume_dev)
        or die "Opened file is not a regular file on the designated volume";

    truncate($out, 0) or die "Failed to truncate destination: $!";

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T21:44:45.487Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794779085487",
    "title": "Inode/Device-Bound Symlink Traversal Verification (O_NOFOLLOW & Same-Device Pinning)",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "vercel-labs-agent-desktop-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "84af2e51e74daf47543fa2bf4e71ea6ce3bd6ea03158ff71c909e752387178c5"
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
        "Expresses generalized engineering invariants (4 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-15T21:44:45.488Z"
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
  "auth_token": "8fb708862e3c2e8f7a858dc1939aaeae7f591137919087d01ba487b0c99c726d"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
