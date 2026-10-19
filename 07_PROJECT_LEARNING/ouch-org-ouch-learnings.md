> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/ouch-org-ouch-learnings.md`  
> **Source**: github ([https://github.com/ouch-org/ouch](https://github.com/ouch-org/ouch))  
> **Source Version**: `6df14b05`  
> **License**: NOASSERTION  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-19T08:06:47.285Z  
> **Learning ID**: `learn-github-ouch-org-ouch`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): ouch-org/ouch

---

## 1. Executive Forensic Architecture & System Mechanics

`ouch` (Obvious Unified Compression Helper) is an autonomous command-line compression, decompression, and archive inspection tool written in Rust. It solves the fragmentation, ergonomic inconsistency, and security vulnerabilities inherent in legacy Unix compression utilities (`tar`, `unzip`, `gzip`, `xz`, `bzip2`, `zstd`, `7z`, `unrar`).

### Core Problem Space
1. **Format Chaining & Polymorphism**: Legacy CLI tools require distinct flag sets, mental models, and invocation pipelines (e.g., `tar -xvf foo.tar.gz` vs `unzip foo.zip` vs `xz -d foo.xz`). `ouch` collapses all multi-format operations into declarative extension chaining (e.g., `.tar.gz.zst`), where the order of nested codecs and archive containers is derived and enforced bidirectionally.
2. **Streaming vs Random Access Invariance**: Codecs like Gzip, Bzip2, LZ4, and Zstandard operate over linear, forward-only stream abstractions (`std::io::Read` and `std::io::Write`). Container formats like ZIP, 7-Zip, and RAR require non-streaming random-access abstractions (`std::io::Seek`) to query directory headers and central directories. `ouch` provides strict boundary isolation between linear non-archive compression and seek-dependent archive containers.
3. **ZipSlip, Symlink Traversal, and Bomb Security**: Extracting untrusted archives poses directory traversal vulnerabilities (`../../etc/shadow`), symlink pivot attacks (where an earlier archive entry creates a symlink pointing outside the root, and a later entry writes through it), and recursive decompression bombs. `ouch` enforces path validation, strict lexical containment, Landlock OS sandboxing (on Linux), and finite byte reader wrappers (`LimitedReader`).

```
                              [ CLI / User Input ]
                                       │
                         [ CLI Flag Parsing (clap v4) ]
                                       │
                      ┌────────────────┴────────────────┐
                      ▼                                 ▼
             [ Format Resolution ]            [ Threading & Logger Init ]
          (Extension Chaining & Magic)       (Dedicated Logger Thread MPSC)
                      │                                 │
                      ▼                                 ▼
         ┌─────────────────────────┐         ┌───────────────────────┐
         │ Archive vs Stream Check │         │ Landlock Security     │
         │ (Position Invariants)   │         │ Sandbox Enclosure     │
         └────────────┬────────────┘         └───────────┬───────────┘
                      │                                  │
                      ▼                                  ▼
      ┌───────────────────────────────┐        ┌───────────────────────┐
      │     Pipeline Construction     │        │ FS Conflict & Safety  │
      │ ┌───────────────────────────┐ │        │ - validate_entry_path │
      │ │ Archive Driver (zip, tar, │ │◄──────┤ - symlink traversal   │
      │ │   7z, rar)                │ │        │ - CwdGuard RAII       │
      │ └─────────────┬─────────────┘ │        │ - LimitedReader cap   │
      │               ▼               │        └───────────────────────┘
      │ │ Stream Chain Encoders/    │ │
      │ │   Decoders (gz, bz2, zst) │ │
      │ └───────────────────────────┘ │
      └───────────────┬───────────────┘
                      │
                      ▼
               [ Final Output ]
```

### Critical Subsystem Boundaries
- **Format Pipeline Engine (`src/extension.rs`, `src/check.rs`)**: Parses file extensions and magic headers into an ordered vector of `Extension` enums. Enforces the structural invariant that an **archive format** (`tar`, `zip`, `7z`, `rar`) can only appear as the outermost container (position 0 in compression chains), followed by zero or more stream compression codecs.
- **Filesystem Integrity & Conflict Engine (`src/utils/fs.rs`, `src/utils/question.rs`)**: Mediates all mutations. Prior to file writes, atomic checks verify whether paths exist, detect collisions, prevent deletion of the current working directory (`Handle::from_path(cwd) == Handle::from_path(target)`), and offer interactive conflict resolution strategies (`Overwrite`, `Rename`, `Merge`, `Cancel`).
- **Asynchronous Decoupled Logger (`src/utils/logger.rs`)**: Workhorse threads never write directly to standard error or standard output. All output is dispatched via an unbounded `std::sync::mpsc` channel to a dedicated background logging thread to prevent interleaving, broken pipes on interactive prompts, and terminal injection attacks.
- **Terminal Display Sanitizer (`src/utils/formatting.rs`)**: Neutralizes terminal injection attacks (Trojan Source bidirectional overrides, ANSI escape injection, zero-width characters) by scrubbing untrusted filenames before terminal presentation.

---

## 2. Universal Engineering Rules (Candidates for Master Brain)

### 1. Invariant Range Clamping Across Signed-to-Unsigned Cast Boundaries
**RULE**:
When mapping user-provided signed integers (e.g., `i16`, `i32`, `isize`) into bounded unsigned types (e.g., `u8`, `u32`, `usize`), code MUST clamp values on the signed type **before** performing the cast (`as u32`). Code MUST NOT cast a signed integer to an unsigned integer prior to boundary checking or clamping.

**WHY**:
In twos-complement architectures, casting any negative signed number to an unsigned integer produces a value near the maximum capacity of that unsigned type (e.g., `-1i16 as u32` evaluates to `4_294_967_295`). If this cast value is subsequently clamped with `.clamp(min, max)`, the out-of-bounds large number clamps directly to `max` rather than `min`. In compression algorithms, this causes a negative compression level (requesting fastest/lightest effort) to silently execute as maximum compression (level 9/max), consuming orders of magnitude more CPU cycles and RAM.

**WHEN TO APPLY**:
Any systems software, CLI parameter normalization layer, network serializer, or driver wrapper where signed integer user inputs are normalized into unsigned configuration bounds (e.g., compression levels, concurrency limits, buffer capacities, timeouts).

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// CORRECT: Clamp on the signed domain before converting to unsigned
pub fn normalize_compression_level(level: Option<i16>, default_val: u32, min_val: i16, max_val: i16) -> u32 {
    level.map_or(default_val, |l| {
        // Invariant: min_val and max_val match signed bounds
        l.clamp(min_val, max_val) as u32
    })
}
```

**NEGATIVE CONSTRAINT**:
```rust
// VIOLATION: Casting to unsigned before clamping produces silent wrap-around
pub fn dangerous_compression_level(level: Option<i16>, default_val: u32) -> u32 {
    level.map_or(default_val, |l| {
        // BUG: -1i16 as u32 == 4294967295; (4294967295).clamp(0, 9) returns 9!
        (l as u32).clamp(0, 9)
    })
}
```

**VERIFICATION METHOD**:
Enforce via unit tests validating extreme boundary inputs (`-1`, `i16::MIN`, `0`, `i16::MAX`):
```rust
#[test]
fn verify_negative_level_clamping() {
    let min_boundary = normalize_compression_level(Some(-1), 6, 0, 9);
    assert_eq!(min_boundary, 0, "Negative levels must normalize to lower bound (0), not upper bound (9)");
    
    let extreme_min = normalize_compression_level(Some(i16::MIN), 6, 0, 9);
    assert_eq!(extreme_min, 0);
}
```

---

### 2. Symlink Pivot and Writing-Through-Symlink Extraction Invariant
**RULE**:
Archive extraction engines MUST inspect every path segment between the destination root and the final write target on disk using `symlink_metadata` (lstat) immediately prior to writing file contents. If ANY intermediate on-disk component is a symbolic link, the extraction MUST be aborted immediately.

**WHY**:
Static lexical verification of an archive entry (`foo/bar/baz.txt`) is insufficient to prevent ZipSlip and root escape attacks. If entry #1 in a malicious archive creates a symlink named `foo` pointing to `/etc`, and entry #2 writes to `foo/passwd`, lexical checks on entry #2 pass (it looks like a safe child of `./foo`). When written to disk, the operating system traverses the on-disk symlink created by entry #1 and overwrites the host system file outside the extraction root.

**WHEN TO APPLY**:
All file archive unpackers (ZIP, TAR, 7Z, RAR, CPIO) and file sync tools handling untrusted input directory trees.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::path::{Path, PathBuf};
use fs_err as fs;

pub fn validate_dest_inside_root(root: &Path, dest: &Path) -> Result<(), &'static str> {
    let rel = dest.strip_prefix(root).map_err(|_| "Target is outside extraction root")?;
    let mut probe = root.to_path_buf();
    
    for comp in rel.components() {
        probe.push(comp);
        // Query filesystem metadata WITHOUT following symlinks
        match fs::symlink_metadata(&probe) {
            Ok(md) if md.file_type().is_symlink() => {
                return Err("Security invariant violation: intermediate on-disk component is a symlink");
            }
            Ok(_) => continue,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                // If a path component does not yet exist, subsequent children cannot pivot through it
                break;
            }
            Err(_) => return Err("Filesystem metadata inspection failed"),
        }
    }
    Ok(())
}
```

**NEGATIVE CONSTRAINT**:
```rust
// VIOLATION: Relying only on lexical normalization (e.g., path components check)
pub fn unsafe_extract_entry(root: &Path, entry_path: &Path) -> Result<PathBuf, &'static str> {
    let mut safe_path = root.to_path_buf();
    for comp in entry_path.components() {
        if let std::path::Component::Normal(c) = comp {
            safe_path.push(c);
        } else {
            return Err("Disallowed component");
        }
    }
    // DANGER: If 'safe_path' parent components were unpacked earlier as symlinks,
    // this directly overwrites arbitrary files on the host system!
    Ok(safe_path)
}
```

**VERIFICATION METHOD**:
Automated integration test attempting multi-entry symlink injection:
```rust
#[test]
fn test_prevent_symlink_pivot_write() {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path();
    let evil_symlink = root.join("link");
    // Simulate entry 1: creates symlink to root's parent
    std::os::unix::fs::symlink(root.parent().unwrap(), &evil_symlink).unwrap();
    
    // Simulate entry 2: tries to write through the symlink
    let target_file = evil_symlink.join("pwned.txt");
    let result = validate_dest_inside_root(root, &target_file);
    assert!(result.is_err(), "Must block writes traversing on-disk symlinks");
}
```

---

### 3. Bidirectional and Terminal Control Character Sanitization Invariant
**RULE**:
Before rendering arbitrary user, file, or archive strings (such as filenames or paths embedded within untrusted containers) to a TTY or stderr, software MUST scrub all C0/C1 control characters, line breaks, zero-width spaces, and Unicode Bidirectional (BiDi) formatting markers (`U+202A` through `U+202E`, `U+2066` through `U+2069`), replacing them with standard replacement characters (`\u{FFFD}`).

**WHY**:
Unsanitized strings printed to terminals enable critical terminal injection vulnerabilities. Attackers use BiDi control codes (CVE-2021-42574, Trojan Source) to visually invert filenames (e.g., displaying `innocent.txt` in the terminal when the actual file is `txt.tneconni.exe`). Control characters (`\x1b`, `\r`, `\x08`) allow overwriting prompt lines, spoofing interactive confirmation dialogs, or altering user decisions during collision checks.

**WHEN TO APPLY**:
All CLI tools, log formatters, error reporters, and terminal UI frameworks presenting untrusted external strings to operators.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::borrow::Cow;

pub fn is_unsafe_display_char(ch: char) -> bool {
    matches!(ch,
        c if c.is_control() => true,
        '\u{2028}' | '\u{2029}' => true,             // Line / Paragraph separators
        '\u{202A}'..='\u{202E}' => true,             // LRE, RLE, PDF, LRO, RLO
        '\u{2066}'..='\u{2069}' => true,             // LRI, RLI, FSI, PDI
        '\u{200B}' | '\u{200C}' | '\u{200D}' |      // Zero-width spaces & joiners
        '\u{FEFF}' | '\u{00AD}' | '\u{180E}' |
        '\u{034F}' | '\u{061C}' => true,             // Invisible marks & Arabic letter marks
        _ => false,
    )
}

pub fn sanitize_for_display(text: &str) -> Cow<'_, str> {
    if !text.chars().any(is_unsafe_display_char) {
        return Cow::Borrowed(text);
    }
    let mut sanitized = String::with_capacity(text.len());
    for ch in text.chars() {
        if is_unsafe_display_char(ch) {
            sanitized.push('\u{FFFD}');
        } else {
            sanitized.push(ch);
        }
    }
    Cow::Owned(sanitized)
}
```

**NEGATIVE CONSTRAINT**:
```rust
// VIOLATION: Printing raw paths directly to stderr/stdout
pub fn print_status(filename: &std::path::Path) {
    // DANGER: An attacker embedding ANSI codes (\x1b[2K\r) or BiDi codes
    // can overwrite terminal history or spoof subsequent confirmation prompts!
    eprintln!("Processing file: {}", filename.display());
}
```

**VERIFICATION METHOD**:
Property test ensuring no unsafe codepoint survives sanitization:
```rust
#[test]
fn test_terminal_sanitization_removes_bidi_and_escapes() {
    let malicious = "safe_prefix_\u{202E}txt.exe\x1b[31m";
    let sanitized = sanitize_for_display(malicious);
    assert!(!sanitized.chars().any(is_unsafe_display_char));
    assert!(sanitized.contains('\u{FFFD}'));
}
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Silent Maximum Compression on Negative Level Flags (BUG-COMPRESS-01)
- **Context**: Compression parameter parsing in `src/commands/compress.rs` and CLI validation.
- **What Was Expected**: Passing negative compression levels (such as `--level -1` to designate minimal compression effort or fast deflate) must clamp to the minimum allowable level (e.g., 0 or 1 depending on the codec).
- **What Actually Happened**: Passing `--level -1` resulted in the largest possible archive compression time and highest CPU load, producing identical byte output to `--level 9`.
- **Evidence in Repo**: Commit `410337ac`, regression test `negative_compression_level_is_not_maximum` in `tests/integration.rs`.
- **Root Cause**: The variable `level` was stored as an `Option<i16>`. Inside the builder closure, the code cast `l as u32` before invoking `.clamp(0, 9)`. Under twos-complement arithmetic, `-1i16 as u32` evaluates to `4_294_967_295u32`. Invoking `.clamp(0, 9)` on `4_294_967_295` evaluates to `9` (the upper bound). Consequently, negative inputs silently triggered maximum compression.
- **Remediation Code Diff**:
```diff
--- a/src/commands/compress.rs
+++ b/src/commands/compress.rs
@@ -54,7 +54,7 @@ pub fn compress_files(
                 let parz: ParCompress<gzp::deflate::Gzip, _> = ParCompressBuilder::new()
                     .compression_level(
-                        level.map_or_else(Default::default, |l| gzp::Compression::new((l as u32).clamp(0, 9))),
+                        level.map_or_else(Default::default, |l| gzp::Compression::new(l.clamp(0, 9) as u32)),
                     )
                     .num_threads(logical_thread_count())
```
- **Lesson**: Type casts must be applied only *after* range invariants are asserted or clamped on the native input type.

---

### Incident 2: Misplaced Archive Format in `--format` Flag Triggered Panic (BUG-FORMAT-02)
- **Context**: Archive position validation in `src/check.rs` and `src/commands/mod.rs`.
- **What Was Expected**: Passing an invalid format chain to the `--format` override during decompression (e.g., `--format gz.tar`) should return a clean user-facing error explaining format position invariants.
- **What Actually Happened**: The tool crashed with a panic during pipeline execution because archive position checks were only performed on filename parsing, completely bypassing the `--format` flag argument in decompression dispatch.
- **Evidence in Repo**: Commit `6df14b05`, PR #1080, added test `format_flag_rejects_misplaced_archive` in `tests/decompress_format_flag.rs`.
- **Root Cause**: The function `check_archive_formats_position` was previously invoked only during path-inferred format extraction. When the user supplied an explicit `--format` argument, the parsed `Extension` vector was routed directly to the decompression executor without structural validation, hitting unexpected state assumptions down the stack.
- **Remediation Code Diff**:
```diff
--- a/src/commands/mod.rs
+++ b/src/commands/mod.rs
@@ -184,6 +184,7 @@ pub fn run(args: CliArgs, question_policy: QuestionPolicy, file_visibility_polic
             if let Some(format) = args.format {
                 let format = parse_format_flag(&format)?;
                 for path in files.iter() {
+                    check::check_archive_formats_position(&format, path)?;
                     let file_name = path.file_name().ok_or_else(|| Error::Custom {
```
- **Lesson**: Explicit CLI override paths must be subjected to the exact same contract validators as implicitly inferred path pipelines.

---

### Incident 3: Zip Compression Method 93 (Zstandard) Unsupported Failure (BUG-ZIP-03)
- **Context**: Decompressing and listing ZIP archives containing Zstd-compressed files (`Cargo.toml`, `tests/integration.rs`).
- **What Was Expected**: Archives created with modern compression tools utilizing method 93 (ZIP with Zstandard) should list and decompress seamlessly.
- **What Actually Happened**: Inspecting or unpacking the archive failed with `[ERROR] Unexpected error in zip archive - compression method not supported: 93`.
- **Evidence in Repo**: Issue #1062, Commit `79e0b3e2`, PR #1063, regression test `zip_with_zstd_entries` in `tests/integration.rs`.
- **Root Cause**: The upstream `zip` crate had default features disabled (`default-features = false`). While `ouch` possessed a standalone `zstd` dependency for `.tar.zst` files, it failed to enable the `zstd` feature flag within the `zip` crate dependency configuration. As a result, the `zip` crate compiled without its internal Zstd decompression table.
- **Remediation Code Diff**:
```diff
--- a/Cargo.toml
+++ b/Cargo.toml
@@ -46,6 +46,7 @@ unrar = { package = "unrar-ng", version = "0.7.6", optional = true }
 zip = { version = "8.6.0", default-features = false, features = [
     "time",
     "aes-crypto",
+    "zstd",
 ] }
```
- **Lesson**: Container formats that act as envelopes for arbitrary codecs require feature alignment between the container parser and the constituent codec crates.

---

### Incident 4: Breaking SemVer Dependency Bump in Downstream Builder (BUG-DEPBUMP-04)
- **Context**: Compilation failure across clean `cargo install ouch` installations from crates.io.
- **What Was Expected**: Running `cargo install ouch` should resolve compatible SemVer dependencies and compile successfully.
- **What Actually Happened**: The build broke with `error[E0308]: mismatched types ... expected 'BlockSize', found 'usize'` and `error[E0277]: the '?' operator cannot be applied to type 'bzip3::write::Bz3Encoder<_>'`.
- **Evidence in Repo**: Issue #1076, post-mortem discussion on crates.io build failures.
- **Root Cause**: Upstream dependency `bzip3` released a breaking API change within a minor release (`0.12.1`), changing constructor arguments from `usize` to a strongly typed `BlockSize` enum, and changing the constructor return type from `Result<Bz3Encoder>` to `Bz3Encoder` (breaking the `?` try operator). Because `cargo install` ignores `Cargo.lock` by default unless `--locked` is specified, downstream users pulled the breaking patch.
- **Remediation Code Diff**:
```diff
--- Downstream deployment fix documented in incident response:
- cargo install ouch
+ cargo install ouch --locked
+ # Upstream pin in Cargo.toml:
- bzip3 = { version = "0.12", features = ["bundled"], optional = true }
+ bzip3 = { version = "=0.12.0", features = ["bundled"], optional = true }
```
- **Lesson**: Binary crates distributed via source registries must instruct users to compile with `--locked`, or pin brittle C-wrapper bindings to exact patch versions.

---

### Incident 5: Current Working Directory Deletion during Collision Overwrite (BUG-FS-05)
- **Context**: Directory collision handling in `src/utils/fs.rs`.
- **What Was Expected**: If a user runs `ouch decompress` into an output target that happens to resolve to the current working directory (`.`), a collision overwrite must not destroy the host execution environment.
- **What Actually Happened**: Overwrite operations called `fs::remove_dir_all(path)`, which on certain platforms attempted to recurse and wipe the process's active working directory, causing panic or terminal corruption.
- **Evidence in Repo**: `src/utils/fs.rs` implementation of `remove_file_or_dir`.
- **Root Cause**: Path strings can refer to the current directory under multiple lexical forms (`.`, `./`, `/full/path/to/cwd`). Comparing string equality failed to detect when the target directory was identical to the process root.
- **Remediation Code Diff**:
```diff
--- a/src/utils/fs.rs
+++ b/src/utils/fs.rs
@@ -62,6 +62,17 @@ pub fn remove_file_or_dir(path: &Path) -> Result<()> {
     if path.is_dir() {
+        if let Ok(cwd) = env::current_dir()
+            && matches!(
+                (Handle::from_path(path), Handle::from_path(&cwd)),
+                (Ok(a), Ok(b)) if a == b
+            )
+        {
+            return Err(
+                FinalError::with_title("Refusing to delete the current working directory")
+                    .detail(format!("Path {} is the current directory", PathFmt(path)))
+                    .hint("Use a different output directory with `--dir` / `-d`")
+                    .into(),
+            );
+        }
         fs::remove_dir_all(path)?;
```
- **Lesson**: Filesystem identity checks must rely on OS-level device and inode handles (`same_file::Handle`), never lexical path equality.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **WTF-8 Slicing & ASCII Boundaries**: In `src/utils/formatting.rs`, `strip_path_ascii_prefix` safely slices `Path` without UTF-8 re-encoding by enforcing an ASCII invariant:
  ```rust
  assert!(ascii_prefix.is_ascii());
  let prefix_slice = ascii_prefix.as_bytes();
  let path_slice = path.as_os_str().as_encoded_bytes();
  if let Some(stripped) = path_slice.strip_prefix(prefix_slice) {
      // Invariant: WTF-8 is a strict superset of ASCII. Slicing pure ASCII
      // bytes cannot bisect multi-byte sequences or surrogate pairs.
      let str = unsafe { OsStr::from_encoded_bytes_unchecked(stripped) };
      Cow::from(PathBuf::from(str))
  }
  ```
- **Unsigned Subtraction Underflow in Readers**: In `LimitedReader<R>` (`src/utils/fs.rs`), decrementing byte counters without checked arithmetic causes panic in debug mode and integer wrap in release mode. The invariant is guarded via saturating arithmetic:
  ```rust
  self.remaining = self.remaining.saturating_sub(bytes_read as u64);
  ```
- **Bitmask Sanitization for Unix File Modes**: In `src/utils/fs.rs`, permissions extracted from untrusted archives must never propagate SUID, SGID, or sticky bits:
  ```rust
  pub fn sanitize_archive_mode(mode: u32) -> u32 {
      // Strips 0o4000 (SUID), 0o2000 (SGID), and 0o1000 (Sticky)
      mode & 0o0777
  }
  ```

### 2. Infinite Loop & Resource Starvation Guards
- **Finite Renaming Loop Termination**: In `find_available_filename_by_renaming` (`src/utils/fs.rs`), finding a free filename on disk iterates over `1..`. To prevent disk thrashing or hanging on a malicious directory containing millions of sequential files:
  ```rust
  for i in 1.. {
      let renamed_path = create_path_with_given_index(path, i);
      if !renamed_path.fs_err_try_exists()? {
          return Ok(renamed_path);
      }
  }
  ```
  *Hardening invariant*: A production guard MUST bound this search to an upper bound (e.g., `1..=10_000`) before returning an `ExhaustedNamespaces` error.
- **Decompression Bomb Protection via `LimitedReader`**: Linear stream decompression can expand a 42-kilobyte payload into petabytes of zeros. `LimitedReader` checks bounds on every `read()` block:
  ```rust
  if self.remaining == 0 {
      let mut probe = [0u8; 1];
      return match self.inner.read(&mut probe)? {
          0 => Ok(0), // Clean EOF exactly at the boundary
          _ => Err(io::Error::new(
              io::ErrorKind::InvalidData,
              "decompression output exceeded configured limit (see OUCH_MAX_DECOMPRESSED_BYTES)",
          )),
      };
  }
  ```
- **Dictionary Memory Caps**: Stream allocators for LZMA/XZ can be weaponized with crafted headers requesting gigabytes of RAM. `LZMA_MEMLIMIT_BYTES` bounds allocations to 256 MiB:
  ```rust
  pub const LZMA_MEMLIMIT_BYTES: u32 = 256 * 1024 * 1024;
  ```

### 3. UI & UX Micro-Mechanics
- **Channel-Buffered Log Threading with Barrier Synchronization**: Directly writing to stderr while an interactive CLI prompt is waiting on stdin creates race conditions, mangling escape sequences. `ouch` implements a dedicated logging thread with synchronized barriers (`src/utils/logger.rs`):
  ```rust
  pub(super) fn send_flush_command_and_wait() {
      let barrier = Arc::new(Barrier::new(2));
      get_sender().send(LoggerCommand::Flush {
          finished_barrier: barrier.clone(),
      }).expect("Failed to send flush command");
      barrier.wait(); // Blocks caller until logging thread flushes pending buffer to disk/TTY
  }
  ```
- **Stdin Redirection & `/dev/null` Detection**: If stdin is closed or redirected to `/dev/null` in CI/CD automation without `--yes`, prompting causes an infinite prompt loop or error cascade. `is_stdin_dev_null` detects this upfront (`src/utils/io.rs`):
  ```rust
  #[cfg(unix)]
  pub fn is_stdin_dev_null() -> io::Result<bool> {
      use std::os::unix::fs::MetadataExt;
      let stdin = fs::metadata("/dev/stdin")?;
      let null = fs::metadata("/dev/null")?;
      Ok(stdin.dev() == null.dev() && stdin.ino() == null.ino())
  }
  ```
- **NO_COLOR Standard Compliance**: In `src/utils/colors.rs`, ANSI color codes are zeroed out if non-terminal output is detected or the standard `NO_COLOR` environment variable is defined:
  ```rust
  pub static DISABLE_COLORED_TEXT: LazyLock<bool> = LazyLock::new(|| {
      io::stdout().is_terminal().not() || io::stderr().is_terminal().not() || env::var_os("NO_COLOR").is_some()
  });
  ```

### 4. Backend Concurrency & Memory Safety
- **Atomic File Creation over TOCTOU Probing**: In `create_file_or_prompt_on_conflict` (`src/utils/question.rs`), checking `path.exists()` followed by `File::create()` opens a Time-of-Check to Time-of-Use race window where another process can substitute a symlink. `ouch` forces atomic creation via `create_new(true)`:
  ```rust
  match fs::OpenOptions::new().write(true).create_new(true).open(&path) {
      Ok(file) => return Ok(Some((file, path))),
      Err(e) if e.kind() != io::ErrorKind::AlreadyExists => return Err(Error::from(e)),
      Err(_file_already_exists) => {
          // Path collision confirmed by kernel; enter conflict resolution prompt
      }
  }
  ```
- **RAII Process Directory Restoration (`CwdGuard`)**: Manipulating `std::env::set_current_dir` modifies global process state across all threads. In `src/utils/fs.rs`:
  ```rust
  pub struct CwdGuard(Option<PathBuf>);
  impl Drop for CwdGuard {
      fn drop(&mut self) {
          if let Some(p) = self.0.take() {
              let _ = env::set_current_dir(&p);
          }
      }
  }
  ```

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Lexical ZipSlip Path Normalization**: In `normalize_safe_path` (`src/utils/fs.rs`), paths are sanitized without touching disk to prevent traversal escapes:
  ```rust
  pub fn normalize_safe_path(path: &Path) -> Option<PathBuf> {
      let mut out = PathBuf::new();
      for comp in path.components() {
          match comp {
              std::path::Component::Normal(c) => out.push(c),
              std::path::Component::