# Candidate Directive: [CD-3ZGY] Inode/Device-Bound Symlink Traversal Verification (O_NOFOLLOW & Same-Device Pinning)

<!-- PROVENANCE_START
{
  "source_repository": "vercel-labs/agent-desktop",
  "source_url": "https://github.com/vercel-labs/agent-desktop",
  "source_version": "8ffecc1d",
  "license": "Apache-2.0",
  "timestamp": "2026-11-15T21:44:16.978Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-vercel-labs-agent-desktop",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [vercel-labs/agent-desktop](https://github.com/vercel-labs/agent-desktop) (Revision: `8ffecc1d`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-15T21:44:16.978Z`  
> **Learning ID**: `learn-github-vercel-labs-agent-desktop`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence (LOCAL_MACHINE_PATH_DETECTED: Contains local workstation or hardcoded developer path)
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
    my $written = syswrite($out, $content);
    defined $written && $written == length($content)
        or die "Incomplete write to target: $!";
    close($out) or die "Failed to flush/close descriptor: $!";
}
```

**NEGATIVE CONSTRAINT**:
```bash
# FATAL ANTI-PATTERN: Blindly writing into an untrusted guest/container mount point
mount -o loop guest_disk.img /mnt/guest
# If guest ran: ln -s /Users/host_user/.ssh/authorized_keys /private/etc/ssh/ssh_host_ed25519_key
# The line below overwrites the host's credentials!
cat "$HOST_SSH_KEY" > /mnt/guest/private/etc/ssh/ssh_host_ed25519_key
```

**VERIFICATION METHOD**:
Set up an integration harness that creates malicious symbolic links at each path depth:
```bash
ln -s /etc/shadow $FAKE_VOLUME/private/etc/ssh/ssh_host_ed25519_key
# Run the key rotation routine. It MUST fail with exit code 1 or 2,
# verify that /etc/shadow is untouched, and confirm the guest disk is detached.
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T21:44:16.976Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence (LOCAL_MACHINE_PATH_DETECTED: Contains local workstation or hardcoded developer path)",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.64,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 64%). Source=PASS (TIER_2_OFFICIAL_ECOSYSTEM), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=WARN, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794779056976",
    "title": "Inode/Device-Bound Symlink Traversal Verification (O_NOFOLLOW & Same-Device Pinning)",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "vercel-labs/agent-desktop",
    "source_uri": "https://github.com/vercel-labs/agent-desktop",
    "source_version": "HEAD",
    "content_hash": "ebd31fa4184552a8a08e6ff475ab7974dc986c45a1618c5869a7a6dcafcf4545"
  },
  "evidence_fingerprint": "f4ebc73b386fdfdf",
  "dimensions": {
    "source_reliability": {
      "status": "PASS",
      "score": 0.75,
      "tier": "TIER_2_OFFICIAL_ECOSYSTEM",
      "findings": [],
      "details": [
        "Source belongs to recognized official ecosystem (TIER_2_OFFICIAL_ECOSYSTEM)",
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
        "Direct empirical evidence ratio: 0% (0/3)",
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
      "status": "WARN",
      "score": 0.5,
      "is_generic_pattern": false,
      "has_local_paths": true,
      "findings": [
        "LOCAL_MACHINE_PATH_DETECTED: Contains local workstation or hardcoded developer path"
      ],
      "details": [
        "Expresses generalized engineering invariants (4 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-15T21:44:16.976Z"
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
    "Repository-specific scope; not generalized for universal construction",
    "Staleness risk: MEDIUM"
  ],
  "evidence_references": [
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "36477420ffeab3d45a0d89b4ca5543dc604f0494bfde93b158f3e75bf94bad5a"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
