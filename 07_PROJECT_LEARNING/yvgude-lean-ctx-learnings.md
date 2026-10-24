> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/yvgude-lean-ctx-learnings.md`  
> **Source**: github ([https://github.com/yvgude/lean-ctx](https://github.com/yvgude/lean-ctx))  
> **Source Version**: `4310d162`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-24T20:31:20.356Z  
> **Learning ID**: `learn-github-yvgude-lean-ctx`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): yvgude/lean-ctx

---

## 1. Executive Forensic Architecture & System Mechanics

LeanCTX (`lean-ctx`) operates as an in-process and edge **Context Gateway** sitting intermediately between AI developer agents (Claude Code, Cursor, Codex, OpenCode, Windsurf, Copilot) and the filesystem/runtime substrate. 

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AI Developer Agent Loop                         │
│             (Claude Code, OpenCode, Cursor, Codex CLI)                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Tool Invocations (MCP / CLI)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        LeanCTX Context Gateway                         │
│                                                                        │
│  ┌───────────────────────┐  ┌───────────────────────────────────────┐  │
│  │     Pathjail Core     │  │       Context Admission Pipeline      │  │
│  │  Canonical Root Check │  │  Regex Prefilters -> Luhn / Format    │  │
│  │ Symlink Self-Resolve  │  │  Go-PseudoVersion Stamp Disambiguator │  │
│  │  Workspace Isolation  │  │  PII / Secret / Injection Scrubbing   │  │
│  └───────────┬───────────┘  └───────────────────┬───────────────────┘  │
│              │                                  │                      │
│              ▼                                  ▼                      │
│  ┌───────────────────────┐  ┌───────────────────────────────────────┐  │
│  │   Output Rate-Limiter │  │        Bounded Note Ledger            │  │
│  │ 2000 Lines / 50KB Cap │  │  BLAKE3 Keyed Circular Buffer (512)   │  │
│  │ UTF-8 Character Slicer│  │  Content-Free Admission Counts Record │  │
│  │  Continuation Hints   │  │  Excerpt-Accurate HUD Line Generator  │  │
│  └───────────────────────┘  └───────────────────────────────────────┘  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Sanitized, Budgeted Context
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         Host OS & Tool Runners                         │
│              (Filesystem, Git, Bash, Compilers, LSP)                   │
└────────────────────────────────────────────────────────────────────────┘
```

### Subsystem Boundaries & Invariant Contracts
1. **Context Admission Engine (`core::context_admission`)**: Enforces pre-delivery filtering of all textual context before insertion into agent prompts. It performs multi-pass inspection: secrets scanning, checksummed PII detection (IBAN, Luhn-checked credit cards, Swiss AHV), prompt-injection mitigation, and classification marking enforcement.
2. **Pathjail Sandbox Subsystem (`core::pathjail`)**: A virtual filesystem boundary enforcing project isolation. It prevents path traversal, canonicalizes paths to unmask symlink tricks, restricts file operations to designated project roots, and arbitrates access to IDE-specific scratch directories (e.g., Cursor's `~/.cursor/projects/<slug>/agent-tools`).
3. **Bounded Note Ledger (`core::context_admission::notes`)**: A global, content-free, BLAKE3-keyed FIFO buffer (`VecDeque<(Key, Note)>` capped at 512 entries) that tracks what transformations and redactions were performed on admitted buffers. This decouples the mutation pass from downstream partial readers (e.g., sliced reads or grep matches) so that HUD status lines never report stale or global counts on partial output slices.
4. **Agent Output Governor (`packages/pi-lean-ctx`)**: An adapter layer preventing agent context window blowups. It enforces hard boundaries (e.g., 2,000 lines or 50 KB per tool call), performs UTF-8 character boundary-safe byte truncations, and synthesizes dynamic continuation prompts containing offset math (`start_line=N`) to steer the model towards targeted range-reading rather than re-requesting oversized files.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Checksum-Validated PII Disambiguation Against Segmented Domain Identifiers
**RULE**:
When scanning arbitrary text streams for checksummed sensitive identifiers (such as Luhn-validated 13-to-19 digit Payment Card Numbers), the detection engine **MUST NOT** classify an extracted digit sequence as a sensitive credential if that sequence forms an alphanumeric-delimited token matching an established technical grammar (specifically, Go module pseudo-version timestamps `v0.0.0-YYYYMMDDHHMMSS-abcdef123456`), even if the extracted digit sequence yields a valid checksum.

**WHY**:
Go module pseudo-version timestamps are composed of a 14-digit UTC timestamp (`yyyymmddhhmmss`). In base-10 modular arithmetic, exactly 10% (1 in 10) of random or incrementing 14-digit valid timestamp strings satisfy the Luhn algorithm checksum ($O(10^{-1})$ collision probability). Blindly scrubbing Luhn-valid numbers without verifying semantic and syntactic token boundaries mutates dependency locks (`go.mod`, `go.sum`), corrupts agent-assisted compilation, causes build failures, and triggers false-positive audit alerts.

**WHEN TO APPLY**:
Apply in any data-loss prevention (DLP), context gateway, prompt sanitizer, or audit pipeline operating over technical artifacts (codebases, lockfiles, terminal traces, and configuration specs).

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Production-grade Luhn disambiguator in Rust
use regex::Match;

/// Verifies whether candidate string passes standard Luhn mod-10 validation.
pub fn luhn_valid(digits: &[u8]) -> bool {
    if digits.len() < 13 || digits.len() > 19 {
        return false;
    }
    let mut sum = 0u32;
    let mut double = false;
    for &d in digits.iter().rev() {
        let mut val = d as u32;
        if double {
            val *= 2;
            if val > 9 {
                val -= 9;
            }
        }
        sum += val;
        double = !double;
    }
    sum % 10 == 0
}

/// Plausible UTC timestamp validation for Go pseudo-version (yyyymmddhhmmss).
fn is_pseudo_version_stamp(digits: &str) -> bool {
    if digits.len() != 14 || !digits.bytes().all(|b| b.is_ascii_digit()) {
        return false;
    }
    let parse_field = |range: std::ops::Range<usize>| -> u32 {
        digits[range].parse::<u32>().unwrap_or(u32::MAX)
    };
    
    let year = parse_field(0..4);
    let month = parse_field(4..6);
    let day = parse_field(6..8);
    let hour = parse_field(8..10);
    let minute = parse_field(10..12);
    let second = parse_field(12..14);

    (1970..=2099).contains(&year)
        && (1..=12).contains(&month)
        && (1..=31).contains(&day)
        && hour < 24
        && minute < 60
        && second < 60
}

/// Invariant: Must verify syntactic boundary delimiters on both ends of the match.
pub fn inside_version_token(text: &str, matched: &Match<'_>) -> bool {
    let mut before = text[..matched.start()].chars().rev();
    let mut after = text[matched.end()..].chars();
    
    let glued = |separator: Option<char>, segment: Option<char>| -> bool {
        matches!(separator, Some('-' | '.')) && segment.is_some_and(|c| c.is_ascii_alphanumeric())
    };

    is_pseudo_version_stamp(matched.as_str())
        && glued(before.next(), before.next())
        && glued(after.next(), after.next())
}

/// Evaluates if a regex card match is an authentic credit card vs a version stamp.
pub fn is_authentic_card(text: &str, candidate: &Match<'_>) -> bool {
    let raw = candidate.as_str();
    let digits: Vec<u8> = raw.bytes().filter(|b| b.is_ascii_digit()).map(|b| b - b'0').collect();
    
    luhn_valid(&digits) && !inside_version_token(text, candidate)
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Blindly matching digits and applying Luhn validation
fn redact_cards_bad(text: &str, card_re: &regex::Regex) -> String {
    card_re.replace_all(text, |caps: &regex::Captures| {
        let candidate = caps.get(0).unwrap().as_str();
        let digits: Vec<u8> = candidate.bytes().filter(|b| b.is_ascii_digit()).map(|b| b - b'0').collect();
        // BUG: Corrupts go.mod! 10% of Go pseudo-version timestamps will be wiped.
        if luhn_valid(&digits) {
            "[REDACTED:card]".to_string()
        } else {
            candidate.to_string()
        }
    }).into_owned()
}
```

**VERIFICATION METHOD**:
Enforce unit regression testing with a test battery evaluating known Luhn-valid pseudo-versions generated across the entire calendar domain (`2020..2030` timestamps). Ensure zero false positives on Go module paths while preserving 100% true positives on ANSI/ISO format card variations (Visa, Mastercard, Amex):
```rust
#[test]
fn verify_luhn_pseudo_version_exclusion() {
    let stamp = (0..10)
        .map(|d| format!("2026090112454{d}"))
        .find(|s| luhn_valid(&s.bytes().map(|b| b - b'0').collect::<Vec<_>>()))
        .expect("At least one check-digit must satisfy Luhn");
    let go_mod_line = format!("require github.com/foo/bar v0.0.0-{stamp}-abcdef123456");
    assert!(!has_credit_card(&go_mod_line));
}
```

---

### 2. Symlink Target Confinement with Non-Canonical Identity Proofs
**RULE**:
When an agent or tool sandbox creates an exception to permit read access to a specific external tool execution directory (e.g., `~/.cursor/projects/<id>/agent-tools`), the sandbox **MUST** verify that the admitted path resolves strictly to itself (`canonicalize(path) == path`). The sandbox **MUST NOT** admit directories that contain symlink traversals or whose leaf is a symlink pointing to another location on disk.

**WHY**:
If an external tool directory is admitted into a pathjail based merely on string prefix checks or path component parsing without strict canonical identity invariance, an attacker or compromised agent can plant a symbolic link (e.g., `ln -s ~/.ssh ~/.cursor/projects/<slug>/agent-tools`) inside the writable output directory. Subsequent read requests to the admitted prefix will resolve to the target of the symlink, completely subverting the sandbox and exfiltrating SSH keys, cloud credentials, or host secrets.

**WHEN TO APPLY**:
Apply in all sandbox mechanisms, language cache readers (`node_modules`, `.cargo`), IDE tool integration bridges, and file admission controllers permitting selective escape outside primary workspace boundaries.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::path::{Path, PathBuf};

pub fn canonicalize_secure(path: &Path) -> PathBuf {
    dunce::canonicalize(path).unwrap_or_else(|_| path.to_path_buf())
}

/// Validates whether an external tool scratch directory is safe for selective admission.
pub fn is_safe_admitted_root(root: &Path) -> bool {
    // Invariant 1: Root must exist
    if !root.exists() || !root.is_dir() {
        return false;
    }

    // Invariant 2: The path MUST resolve exactly to itself.
    // If root contains any symlink in any component, canonicalize will differ from raw path.
    let canonical = match root.canonicalize() {
        Ok(c) => dunce::simplified(&c).to_path_buf(),
        Err(_) => return false,
    };

    canonical == root
}

/// Evaluates candidate access against the tightly scoped admitted root.
pub fn admit_tool_scratch_path(candidate: &Path, admitted_root: &Path) -> bool {
    if !is_safe_admitted_root(admitted_root) {
        return false;
    }
    
    let canonical_candidate = match candidate.canonicalize() {
        Ok(c) => dunce::simplified(&c).to_path_buf(),
        Err(_) => return false,
    };

    // Invariant 3: Target of candidate must reside strictly inside the verified non-symlinked root.
    canonical_candidate.starts_with(admitted_root)
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Permitting external directory admission without self-resolution verification
pub fn unsafe_admit_root(candidate: &Path, expected_pattern: &str) -> bool {
    // BUG: If ~/.cursor/projects/x/agent-tools points to ~/.ssh, this check passes!
    if candidate.to_string_lossy().contains(expected_pattern) {
        return true; 
    }
    false
}
```

**VERIFICATION METHOD**:
Implement a security harness that plants symbolic links pointing to sensitive directories inside temporary scratch roots and asserts that path admission fails:
```rust
#[test]
fn symlinked_scratch_directory_denied() {
    let tmp = tempfile::tempdir().unwrap();
    let real_dir = tmp.path().join("real");
    let secret_dir = tmp.path().join("secret");
    let symlinked_dir = tmp.path().join("symlinked");
    std::fs::create_dir(&real_dir).unwrap();
    std::fs::create_dir(&secret_dir).unwrap();
    std::os::unix::fs::symlink(&secret_dir, &symlinked_dir).unwrap();

    assert!(is_safe_admitted_root(&real_dir));
    assert!(!is_safe_admitted_root(&symlinked_dir), "Symlinked root must fail self-resolution");
}
```

---

### 3. UTF-8 Character-Boundary Preserving Byte Bounding with Adaptive Continuation
**RULE**:
When bounding tool output to prevent LLM context saturation, the truncating mechanism **MUST** enforce both line count and byte length caps simultaneously. If slicing across a byte boundary, the slicer **MUST** rewind to a valid UTF-8 leading code unit sequence ($O(1)$ backtrack, testing `(byte & 0xC0) === 0x80`). Furthermore, the output **MUST** supply deterministic, verified continuation coordinates (`start_line=N`) if and only if the returned content is a verified contiguous prefix of the source file (`isSourcePrefix == true`); otherwise, it **MUST** emit generic structural recovery hints.

**WHY**:
Arbitrary byte slicing splits multi-byte UTF-8 sequences (e.g., emojis, localized text, mathematical symbols), creating invalid unicode replacement characters (`\uFFFD`) or crashing downstream JSON-RPC parsers. Additionally, if an agent is handed an erroneous `start_line` for an output that was already reshaped, compressed, or transformed (such as signature outlines or blank-line collapsed views), the agent will issue range reads targeting the wrong lines, resulting in incorrect code patches and hallucinated logic repairs.

**WHEN TO APPLY**:
Apply to all context aggregators, MCP tool output processors, CLI command capture hooks, and agent middleware layers.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
import { Buffer } from "node:buffer";

export const READ_OUTPUT_MAX_LINES = 2000;
export const READ_OUTPUT_MAX_BYTES = 50 * 1024; // 50 KB

export interface BoundReadOptions {
  sourceText?: string;
  maxLines?: number;
  maxBytes?: number;
}

export interface BoundReadResult {
  text: string;
  truncated: boolean;
  continuation?: string;
}

/** Rewinds up to 3 bytes if sliced inside a multi-byte UTF-8 sequence. */
export function utf8Prefix(str: string, maxBytes: number): string {
  const buf = Buffer.from(str, "utf8");
  if (buf.length <= maxBytes) return str;
  let end = maxBytes;
  // While byte is a UTF-8 continuation byte (10xxxxxx), walk backwards
  while (end > 0 && (buf[end] & 0xc0) === 0x80) {
    end--;
  }
  return buf.subarray(0, end).toString("utf8");
}

function isSourcePrefix(kept: string[], source?: string): boolean {
  if (source === undefined) return false;
  let pos = 0;
  for (const line of kept) {
    if (!source.startsWith(line, pos)) return false;
    pos += line.length;
    if (source.startsWith("\r\n", pos)) pos += 2;
    else if (source.startsWith("\n", pos)) pos += 1;
    else return false;
  }
  return true;
}

export function boundReadOutput(text: string, opts: BoundReadOptions = {}): BoundReadResult {
  const maxLines = opts.maxLines ?? READ_OUTPUT_MAX_LINES;
  const maxBytes = opts.maxBytes ?? READ_OUTPUT_MAX_BYTES;
  const totalBytes = Buffer.byteLength(text, "utf8");
  const lines = text.split("\n");

  if (lines.length <= maxLines && totalBytes <= maxBytes) {
    return { text, truncated: false };
  }

  const kept: string[] = [];
  let currentBytes = 0;

  for (const line of lines) {
    if (kept.length >= maxLines) break;
    const lineCost = Buffer.byteLength(line, "utf8") + (kept.length > 0 ? 1 : 0);
    if (currentBytes + lineCost > maxBytes) break;
    kept.push(line);
    currentBytes += lineCost;
  }

  if (kept.length === 0) {
    // Single line exceeds limit on its own
    const body = utf8Prefix(lines[0], maxBytes);
    const notice = `\n\n[ctx_read truncated: single line exceeds byte limit (${maxBytes}B)]`;
    return { text: body + notice, truncated: true };
  }

  const body = kept.join("\n");
  const isVerbatim = isSourcePrefix(kept, opts.sourceText);
  const nextLine = isVerbatim ? kept.length + 1 : undefined;

  const hint = nextLine !== undefined
    ? `Continue with ctx_read(path, start_line=${nextLine}, limit=${maxLines})`
    : `Output was transformed/filtered; continue with mode="lines:N-M" or structural query`;

  const notice = `\n\n[ctx_read output truncated: showing ${kept.length}/${lines.length} lines. ${hint}]`;
  return { text: body + notice, truncated: true, continuation: hint };
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Naive string slicing and blind line continuation hints
function naiveBound(text: string, limit: number): string {
  // BUG 1: Slices across code point boundary in UTF-16 and UTF-8
  // BUG 2: Assumes line count in transformed text matches raw file line numbers
  if (text.length > limit) {
    const sliced = text.slice(0, limit);
    const nextLine = sliced.split("\n").length + 1; 
    return sliced + `\n[Truncated. Read next with line=${nextLine}]`; // FAILS!
  }
  return text;
}
```

**VERIFICATION METHOD**:
Run property-based and boundary tests injecting multi-byte UTF-8 streams (CJK, Cyrillic, 4-byte astral emojis) and verify zero instances of `\uFFFD`, combined with prefix checks confirming that continuation lines map 1:1 to original disk files.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Uncapped Full Read Saturating LLM Context in CLI-Only Mode (BUG-LEAN-01)
- **Context**: `packages/pi-lean-ctx/extensions/index.ts`, `packages/pi-lean-ctx/extensions/read-output.ts`
- **What Was Expected**: Executing `ctx_read` via the CLI adapter path (`LEAN_CTX_PI_ENABLE_MCP=0`) should adhere to strict context window consumption caps (2000 lines / 50 KB max) identical to the persistent MCP server path.
- **What Actually Happened**: When running without the active MCP bridge daemon, the adapter called `lean-ctx read` directly via child process CLI execution. The CLI had no turn budget constraint. When an agent called `mode=full` on a 30,000-line pretty-printed JSON file, 4.1 MB of raw text was passed unfiltered directly into the model context, exhausting the LLM's attention budget and terminating the session.
- **Evidence in Repo**: Commit `bf71f595`, PR #2138, Issue #2138, file `read-output.ts`.
- **Root Cause**: Architectural discrepancy between execution vectors: MCP turn budget was enforced in the daemon server, but the fallback/direct CLI process runner lacked output length guards.
- **Remediation Code Diff**:
```typescript
// packages/pi-lean-ctx/extensions/index.ts
+ import { boundReadOutput, READ_OUTPUT_MAX_BYTES, READ_OUTPUT_MAX_LINES } from "./read-output.js";

+ function boundedReadResult(text: string, details: Record<string, unknown>, sourceText?: string) {
+   const bounded = boundReadOutput(text, { sourceText });
+   return {
+     content: [{ type: "text" as const, text: bounded.text }],
+     details: bounded.truncation ? { ...details, truncation: bounded.truncation } : details,
+   };
+ }

- return {
-   content: [{ type: "text", text: decorated.text }],
-   details: { path: absolutePath, lines: originalSlice.lines, source: "lean-ctx", mode, compression: decorated.stats },
- };
+ return boundedReadResult(decorated.text, { path: absolutePath, lines: originalSlice.lines, source: "lean-ctx", mode, compression: decorated.stats });
```
- **Lesson**: Output bounding MUST be applied at the lowest common egress adapter before model context injection, completely agnostic of whether context was fetched via IPC, MCP, CLI, or filesystem read.

---

### Incident 2: Go Pseudo-Version Timestamps Falsely Flagged and Redacted as Credit Cards (BUG-LEAN-02)
- **Context**: `rust/src/core/input_filters/pii.rs`, `rust/src/core/sensitivity/classify.rs`
- **What Was Expected**: Context admission filters should redact 13-19 digit credit card numbers conforming to the Luhn checksum while leaving source code dependency specs unmodified.
- **What Actually Happened**: Lines in `go.mod` containing pseudo-versions (e.g. `v0.0.0-20260901124541-abcdef123456`) were modified: the 14-digit timestamp segment was scrubbed and replaced with `[REDACTED:card]`. This occurred across approximately 10% of all Go pseudo-versions.
- **Evidence in Repo**: Commit `bf71f595`, Issue #2135, PR #2135.
- **Root Cause**: The card classification filter matched any digit sequence passing the Luhn algorithm. The UTC timestamp `yyyymmddhhmmss` contains 14 digits, falling directly into the 13–19 digit card length span. Due to the properties of modular arithmetic in Luhn mod-10, exactly 1 out of 10 valid timestamps mathematically evaluates to a valid Luhn checksum.
- **Remediation Code Diff**:
```rust
// rust/src/core/input_filters/pii.rs
+ pub(crate) fn inside_version_token(text: &str, matched: &regex::Match<'_>) -> bool {
+     let mut before = text[..matched.start()].chars().rev();
+     let mut after = text[matched.end()..].chars();
+     let glued = |separator: Option<char>, segment: Option<char>| {
+         matches!(separator, Some('-' | '.')) && segment.is_some_and(|c| c.is_ascii_alphanumeric())
+     };
+     is_pseudo_version_stamp(matched.as_str())
+         && glued(before.next(), before.next())
+         && glued(after.next(), after.next())
+ }

  if (rule.validate)(m) && valid_phone_shape
+     && (rule.kind != PiiKind::Card || !inside_version_token(&source, &matched))
  {
      n += 1;
      format!("[REDACTED:{}]", rule.kind.as_str())
  }
```
- **Lesson**: Mathematical checksums alone cannot establish semantic entity identity; structural context and grammar delimiters of the enclosing environment are mandatory filters.

---

### Incident 3: Cursor Agent Endless Retry Loop on Sandbox Pathjail Refusals (BUG-LEAN-03)
- **Context**: `rust/src/core/pathjail.rs`, `rust/src/core/pathjail_scope.rs`
- **What Was Expected**: Cursor agent tool outputs written to `~/.cursor/projects/<slug>/{agent-tools,terminals}` should be readable by the agent that generated them, without opening security vulnerabilities.
- **What Actually Happened**: LeanCTX's pathjail sandbox intercepted all requests targeting paths outside the repo root and refused them as protected system locations. The Cursor agent attempted to grep its own terminal outputs, encountered the refusal, and looped 99 consecutive times issuing identical failing calls.
- **Evidence in Repo**: Commit `d2af4233`, PR #2129, Issue #2129.
- **Root Cause**: Sandbox was unaware of Cursor's internal agent log locations. Furthermore, the error messages returned to the model did not explicitly state that retries were impossible, leading LLM reasoning engines to re-attempt the tool invocation under minor variations.
- **Remediation Code Diff**:
```rust
// rust/src/core/pathjail.rs
+ const CURSOR_AGENT_OUTPUT_DIRS: &[&str] = &["agent-tools", "terminals"];
+ const CURSOR_AGENT_OUTPUT_LABEL: &str = "Cursor agent output";

+ fn detect_agent_instruction_root(candidate: &Path) -> Option<(&'static str, PathBuf)> {
+     // ...
+     cursor_agent_output_root(rel)
+         .map(|root| canon_home.join(root))
+         .filter(|root| canonicalize_secure(root) == *root)
+         .map(|root| (CURSOR_AGENT_OUTPUT_LABEL, root))
+ }

// rust/src/core/pathjail_scope.rs
- const TAIL: &str = " — the user runs this in their own terminal; it takes effect immediately, no restart.";
+ const TAIL: &str = " — the user runs this in their own terminal; it takes effect immediately, no restart. \
+                     Until then every call on this path is refused the same way: do not retry it, ask \
+                     the user or continue without it.";
```
- **Lesson**: When a security sandbox halts an autonomous agent, the error payload MUST contain explicit anti-loop steering directives ("do not retry; will fail identically"). External paths must be permitted strictly through verified, non-symlinked canonical equivalence checks.

---

### Incident 4: Non-Interactive Bash Shell Hook Silent Failure in OpenCode (BUG-LEAN-04)
- **Context**: `shell-hook.bash`, Issue #2092
- **What Was Expected**: Initializing LeanCTX global shell hooks (`lean-ctx init --global`) should intercept commands like `git`, `cargo`, and `npm` to compress outputs before agent ingestion.
- **What Actually Happened**: In OpenCode, the shell hook was completely bypassed. Commands executed natively, and `lean-ctx-status` displayed nothing. Agents ingested raw, uncompressed compiler and git outputs.
- **Evidence in Repo**: Issue #2092 ("bug: Shell hook aliases silently no-op under OpenCode").
- **Root Cause**: Two-fold failure in Unix shell assumptions:
  1. Bash **disables alias expansion by default in non-interactive shells** unless `shopt -s expand_aliases` is explicitly executed. OpenCode invokes bash non-interactively without allocating a PTY.
  2. The diagnostics script gated output behind `[ -t 1 ] && echo ...`, which fails in non-interactive pipelines because stdout is a pipe, not a terminal TTY.
- **Remediation Code Diff**:
```bash
# In shell-hook.bash entrypoint
+ # Ensure alias expansion is enabled even in non-interactive subprocesses
+ if [ -n "$BASH_VERSION" ]; then
+     shopt -s expand_aliases
+ fi

# In lean-ctx-status diagnostic reporter
- [ -t 1 ] && echo "lean-ctx active: $LEAN_CTX_ACTIVE"
+ if [ -t 1 ] || [ -n "$LEAN_CTX_AGENT" ] || [ -n "$OPENCODE_ENV" ]; then
+     echo "lean-ctx active: ${LEAN_CTX_ACTIVE:-0}"
+ fi
```
- **Lesson**: Never rely on shell aliases in automated agent environments without forcing `expand_aliases`. Diagnostic telemetry must not be gated exclusively behind TTY checks (`[ -t 1 ]`).

---

### Incident 5: Over-Compression Silencing Critical Deprecation Semantics (BUG-LEAN-05)
- **Context**: `core::semantic_compression`, Issue #2124
- **What Was Expected**: LeanCTX context compression on Python modules should reduce structural boilerplate while preserving operational semantics required for benchmark verification.
- **What Actually Happened**: In benchmark `beets-empty-string-field-split-v2`, OpenCode with LeanCTX produced identical failing patches across multiple runs (0/2 pass vs 18/18 pass in bare run). The agent placed a guard around an entire execution block rather than checking an empty string field, preventing a deprecation warning from firing.
- **Evidence in Repo**: Issue #2124 ("bug: OpenCode integration fails beets-empty-string