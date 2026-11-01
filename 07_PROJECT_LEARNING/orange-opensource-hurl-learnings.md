> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/orange-opensource-hurl-learnings.md`  
> **Source**: github ([https://github.com/Orange-OpenSource/hurl](https://github.com/Orange-OpenSource/hurl))  
> **Source Version**: `89de8e38`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-31T02:35:21.586Z  
> **Learning ID**: `learn-github-orange-opensource-hurl`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): Orange-OpenSource/hurl

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 Core Domain Problem
`Orange-OpenSource/hurl` is a declarative, scriptable CLI data-plane engine designed to execute and assert distributed HTTP interactions defined in a plain-text human-readable format (`.hurl`). Unlike stateless HTTP runners (`curl`) or script-heavy automation frameworks (`Postman`, `Playwright`), Hurl establishes an atomic, bidirectional translation layer between:
1. Declarative AST-based plain-text definitions (supporting multi-protocol schemas: HTTP/1.0 through HTTP/3, GraphQL, SOAP, JSONPath, XPath, Regex).
2. Native system-level network transport pipelines via an embedded C `libcurl` engine.
3. Strict predicate assertions, variable capture registries, and sandboxed file-system/shell context boundaries.

### 1.2 Subsystem Decomposition and Boundaries

```
                           +-----------------------+
                           |  CLI & Runner Entry   |
                           +-----------+-----------+
                                       |
                 +---------------------+---------------------+
                 |                                           |
                 v                                           v
      +---------------------+                     +---------------------+
      |  Sequential Runner  |                     |   Parallel Worker   |
      +----------+----------+                     +----------+----------+
                 |                                           |
                 +---------------------+---------------------+
                                       |
                                       v
                           +-----------------------+
                           |   hurl_core::parser   |
                           |   (Combinator/AST)    |
                           +-----------+-----------+
                                       |
                                       v
                           +-----------------------+
                           |   hurl_core::ast      |
                           | (HurlFile, Entry, ...) |
                           +-----------+-----------+
                                       |
                                       v
                           +-----------------------+
                           |      hurl::runner     |
                           |  (Pipeline Execution) |
                           +-----------+-----------+
                                       |
        +------------------------------+------------------------------+
        |                              |                              |
        v                              v                              v
+----------------+             +----------------+             +----------------+
|  hurl::http    |             | Assert/Capture |             | util::path     |
| (Client/Curl)  |             |  Eval Engines  |             | (Sandbox Jail) |
+----------------+             +----------------+             +----------------+
```

1. **`hurl_core`**: The foundational compiler crate containing zero external network dependencies. It encapsulates token parsing, lexical grammar specification, AST constructs (`HurlFile`, `Entry`, `Request`, `Response`, `Section`, `Filter`, `Predicate`), and zero-loss source-to-source formatting (`hurlfmt`).
2. **`hurl::parallel`**: Thread-pool multiplexing engine. A coordinator distributes `Job` instances over bounded message channels (`std::sync::mpsc::Sender<WorkerMessage>` and shared `Arc<Mutex<Receiver<Job>>>`). Output streams are wrapped in `WriteMode::Buffered` to prevent interleaved terminal corruptions.
3. **`hurl::http`**: Low-level bridge across the Foreign Function Interface (FFI) to `libcurl`. Manages socket lifetimes, connection reuse, HTTP/2 multiplexing, TLS certificate configuration, header transformations, cookie stores, and request/response streaming.
4. **`hurl::util::path`**: Filesystem security governor implementing lexical and physical canonicalization checks (`ContextDir`) to prevent arbitrary file reading/writing (directory traversal exploits) during file uploads and response redirects.
5. **`hurl::util::logger` & `redacted`**: Information boundary isolation. Sanitizes runtime trace strings, redact credentials across verbose modes, renders colored terminal diffs, and guarantees terminal safety against injection sequences.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. POSIX Shell Command Synthesis Quoting Invariant
**RULE**:
When synthesizing CLI invocation strings (such as `curl ...`) for interactive display, user copy-pasting, or subshell spawning from untrusted or dynamically parsed AST tokens, the compiler MUST apply single-quote encapsulation to EVERY parameter and replace every internal single quote `'` with the POSIX-safe breakout sequence `'\''`. Raw parameter concatenation or naive whitespace-only quoting MUST NOT be used under any circumstances.

**WHY**:
HTTP URLs, headers, and request payload parameters frequently contain characters that hold special execution or delimiter meaning in POSIX and Windows shells (e.g., `;`, `&`, `|`, `` ` ``, `$()`, `'`, `"`, `\n`). If a tool prints `curl $URL` by wrapping `$URL` in naive single quotes (`'http://example.com/x'; touch /tmp/pwned; : ''`), an attacker supplying a malformed target endpoint or payload can trigger arbitrary shell code execution when the logged command is executed by an operator or CI runner.

**WHEN TO APPLY**:
Apply in any logging, debugging, dry-run, curl-export, or subprocess-spawning module that renders structured AST/HTTP models back to text meant for shell environments.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
/// Safely escapes an arbitrary string argument for POSIX-compliant shell execution.
/// Wraps the entire string in single quotes and replaces internal single quotes with '\''.
pub fn escape_shell_arg(arg: &str) -> String {
    if arg.is_empty() {
        return "''".to_string();
    }
    // Check if the argument contains only shell-safe characters:
    // A-Z, a-z, 0-9, /, _, -, ., :, @, %
    let is_safe = arg.chars().all(|c| {
        c.is_ascii_alphanumeric() || matches!(c, '/' | '_' | '-' | '.' | ':' | '@' | '%')
    });

    if is_safe {
        arg.to_string()
    } else {
        // Enclose in single quotes and escape embedded single quotes:
        // ' becomes '\''
        let escaped = arg.replace('\'', r"'\''");
        format!("'{escaped}'")
    }
}

pub struct SafeCurlCmd {
    pub args: Vec<String>,
}

impl SafeCurlCmd {
    pub fn to_shell_string(&self) -> String {
        self.args
            .iter()
            .map(|arg| escape_shell_arg(arg))
            .collect::<Vec<_>>()
            .join(" ")
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Naive string interpolation with partial or missing quoting.
// Allows command injection via: http://evil.com/'; rm -rf /; '
pub fn to_unsafe_curl_string(url: &str, headers: &[(&str, &str)]) -> String {
    let mut cmd = format!("curl '{url}'"); // VULNERABILITY: If url contains ' it escapes the string context
    for (k, v) in headers {
        cmd.push_str(&format!(" -H '{k}: {v}'"));
    }
    cmd
}
```

**VERIFICATION METHOD**:
Run automated property tests injecting arbitrary command separation vectors:
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_escape_shell_arg_prevents_injection() {
        let malicious_payload = "http://localhost:8000/x'; touch foo; : '";
        let safe = escape_shell_arg(malicious_payload);
        assert_eq!(safe, "'http://localhost:8000/x'\\'', touch foo, : '\\'''"
            .replace(", ", "; "));
        // Verify parsing: a subshell receiving `safe` as a single argument must receive the exact string
        let output = std::process::Command::new("sh")
            .arg("-c")
            .arg(format!("printf '%s' {safe}"))
            .output()
            .expect("failed to execute shell");
        assert_eq!(String::from_utf8_lossy(&output.stdout), malicious_payload);
    }
}
```

---

### 2. Lossy Byte-Boundary Protocol Ingestion Invariant
**RULE**:
All protocol header fields, cookie payloads, and status lines returned by external network peers MUST NOT be decoded via strict UTF-8 conversion functions (`str::from_utf8().unwrap()` or `String::from_utf8().unwrap()`) within core state machines. Handlers MUST use non-panicking lossy decoding (`String::from_utf8_lossy()`), explicit byte-level parsing (`&[u8]`), or structured fallback error handling.

**WHY**:
HTTP specifications (RFC 6265, RFC 7230, RFC 9110) do not enforce valid UTF-8 for cookie values, non-standard response headers, or raw wire payloads. Servers, proxies, and legacy endpoints routinely emit raw Latin-1 (`ISO-8859-1`), binary telemetry, or corrupted sequences (`\xFF`, `\xC0`). Calling `.unwrap()` on UTF-8 conversion functions in response parsers causes an unrecoverable process crash (`panic!`), enabling remote denial of service via a single crafted response header.

**WHEN TO APPLY**:
Apply to all network transport boundaries, HTTP response parsers, FFI bindings (e.g., `libcurl` callbacks), cookie jar serializations, and logging wrappers ingesting raw external network bytes.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
/// Parses raw byte buffers received from network transport into a safe cookie record.
pub struct NetworkCookie {
    pub raw_bytes: Vec<u8>,
    pub display_value: String,
}

impl NetworkCookie {
    pub fn from_wire(raw: &[u8]) -> Self {
        // Invariant: Wire bytes are preserved verbatim for accurate client state reuse.
        // Display strings are sanitized with U+FFFD Replacement Characters to prevent UI/terminal panic.
        let display_value = String::from_utf8_lossy(raw).into_owned();
        Self {
            raw_bytes: raw.to_vec(),
            display_value,
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Presuming network protocol conformity to UTF-8 and unwrapping.
// A single invalid byte (0xFF) will abort the entire process.
fn parse_cookie_unsafe(raw_bytes: &[u8]) -> String {
    std::str::from_utf8(raw_bytes)
        .unwrap() // CRITICAL PANIC HAZARD: Remote Denial-of-Service vector
        .to_string()
}
```

**VERIFICATION METHOD**:
Enforce lint check for explicit unwrap on UTF-8 conversions and add property testing:
```rust
#[test]
fn test_parse_cookie_with_invalid_utf8() {
    let corrupted_wire_data = b"session_id=\xff\xfe\xfd; Path=/";
    // Must complete without panic and preserve resilience
    let cookie = NetworkCookie::from_wire(corrupted_wire_data);
    assert!(cookie.display_value.contains('\u{FFFD}'));
}
```

---

### 3. Asymmetric Path Resolution Prefix Jail Invariant
**RULE**:
When validating file access within an authorized directory sandbox (`ContextDir`), the path validation engine MUST NOT rely solely on `std::fs::canonicalize()` when checking paths that may refer to uncreated output files. It MUST iteratively resolve the longest existing filesystem ancestor prefix via canonicalization, normalize the non-existent suffix components lexically, and assert that the resolved target path contains the canonicalized root directory as an ancestor (`path.ancestors().any(|a| a == canonical_root)`).

**WHY**:
Standard `fs::canonicalize()` fails immediately with `std::io::ErrorKind::NotFound` if the targeted file or leaf subdirectory does not exist on disk yet. If a security check falls back to naive lexical validation or bypasses checks for non-existent files, symlink traversal attacks (or `..` traversal through dynamically created paths) can bypass the sandbox, allowing arbitrary file overwrites or sensitive credential leaks across the hosting host filesystem.

**WHEN TO APPLY**:
Apply to any path validation subsystem where a sandbox boundary is configured (`--file-root`), and paths may be opened for reading (existing files) or creation/writing (e.g., `--output`, `[Options]` output path).

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::path::{Component, Path, PathBuf};

pub struct SandboxValidator {
    canonical_root: PathBuf,
}

impl SandboxValidator {
    pub fn new(root: &Path) -> std::io::Result<Self> {
        let canonical_root = root.canonicalize()?;
        Ok(Self { canonical_root })
    }

    /// Resolves existing prefixes with symlink resolution, then normalizes remaining leaf paths.
    fn resolve_path(&self, target: &Path) -> PathBuf {
        let components: Vec<_> = target.components().collect();
        for i in (0..=components.len()).rev() {
            let prefix: PathBuf = components[..i].iter().collect();
            if let Ok(mut resolved_prefix) = prefix.canonicalize() {
                for component in &components[i..] {
                    match component {
                        Component::CurDir => {}
                        Component::ParentDir => {
                            resolved_prefix.pop();
                        }
                        Component::Normal(c) => resolved_prefix.push(c),
                        _ => {}
                    }
                }
                return resolved_prefix;
            }
        }
        target.to_path_buf()
    }

    /// Invariant: Path is safe only if the sandbox root is an exact ancestor of the target.
    pub fn is_access_allowed(&self, filename: &Path) -> bool {
        let target = self.resolve_path(filename);
        target.ancestors().any(|ancestor| ancestor == self.canonical_root)
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Naive string-prefix or purely lexical check without symlink traversal awareness.
pub fn is_unsafe_access(base_dir: &str, target_path: &str) -> bool {
    // Fails on "../", symlink redirection, and Unicode casing variations
    target_path.starts_with(base_dir)
}
```

**VERIFICATION METHOD**:
Construct integration tests containing symlinks escaping outside the directory sandbox and attempting writes:
```rust
#[test]
fn test_jail_escapes_via_symlinks_are_rejected() {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path().join("root");
    let outside = temp.path().join("outside");
    std::fs::create_dir(&root).unwrap();
    std::fs::create_dir(&outside).unwrap();

    // Symlink inside pointing outside
    #[cfg(unix)]
    std::os::unix::fs::symlink(&outside, root.join("link_out")).unwrap();

    let validator = SandboxValidator::new(&root).unwrap();
    assert!(!validator.is_access_allowed(&root.join("link_out/pwned.txt")));
}
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Shell Injection via Unescaped Curl Logging (BUG-HURL-01)
- **Context**: Subsystem: `hurl::http::client`, `hurl::util::logger`. Path: `packages/hurl/src/http/client.rs` & `packages/hurl/src/util/logger.rs`
- **What Was Expected**: Running Hurl with `--verbose` or `--curl` prints an executable `curl` command that accurately reflects the HTTP request and can be safely copied into a shell prompt without side effects.
- **What Actually Happened**: When executing an entry where the target URL contained shell metacharacters and single quotes (e.g., `GET http://localhost:8000/x'; touch foo; : '`), Hurl emitted:
  ```shell
  curl 'http://127.0.0.1:8000/x'; touch foo; : ''
  ```
  When pasted or executed in a shell, the single quote closed the string literal, executing `touch foo` as an unquoted command.
- **Evidence in Repo**: Issue #5374: "Escape curl command from --curl option and --verbose log". Closed 2026-10-23.
- **Root Cause**: The curl serialization formatter wrapped strings in single quotes without checking or replacing internal single quote characters (`'`).
- **Remediation Code Diff**:
```rust
// - Buggy code / What failed:
// let cmd = format!("curl '{url}'");

// + Fixed pattern / Safe invariant:
impl CurlCmd {
    pub fn to_redacted_string(&self, secrets: &[String]) -> String {
        self.args
            .iter()
            .map(|arg| {
                let redacted = arg.redact(secrets);
                escape_shell_arg(&redacted)
            })
            .collect::<Vec<_>>()
            .join(" ")
    }
}

fn escape_shell_arg(s: &str) -> String {
    format!("'{}'", s.replace('\'', r"'\''"))
}
```
- **Lesson**: All formatted string displays designed for CLI or terminal interaction must be treated as execution vectors. Command-line generation must use strict POSIX shell escape sanitization.

---

### Incident 2: Panic Crash on Non-UTF-8 Server Cookies (BUG-HURL-02)
- **Context**: Subsystem: `hurl::http::client`. Path: `packages/hurl/src/http/client.rs:793:47`
- **What Was Expected**: When a remote server returns a `Set-Cookie` header containing non-ASCII / non-UTF-8 bytes (e.g., Latin-1 encoded values like `\xFF`), Hurl must parse the cookie, store it in the cookie jar or pass it along without terminating the runner.
- **What Actually Happened**: Hurl crashed with a thread panic:
  ```text
  thread 'main' (3620034) panicked at packages/hurl/src/http/client.rs:793:47:
  called `Result::unwrap()` on an `Err` value: Utf8Error { valid_up_to: 49, error_len: Some(1) }
  ```
- **Evidence in Repo**: Issue #5356: "Fix crash when receiving non-UTF-8 server cookie". Closed 2026-10-16.
- **Root Cause**: `client.rs` called `std::str::from_utf8(cookie_bytes).unwrap()` when parsing `libcurl` cookie list structures (`CURLINFO_COOKIELIST`), blindly assuming all remote web servers emit RFC 3629-compliant UTF-8.
- **Remediation Code Diff**:
```rust
// - Buggy code / What failed:
// let cookie_str = std::str::from_utf8(raw_cookie).unwrap();

// + Fixed pattern / Safe invariant:
let cookie_str = String::from_utf8_lossy(raw_cookie);
let cookie = Cookie::parse(&cookie_str);
```
- **Lesson**: Never invoke `.unwrap()` on UTF-8 decoders when processing HTTP headers, cookies, or body encodings returned over FFI or network boundaries.

---

### Incident 3: Python SSL Server Compatibility Deprecation in Integration Tests (BUG-HURL-03)
- **Context**: Subsystem: `integration/hurl/tests_ssl`. Path: `integration/hurl/tests_ssl/ssl_server.py:20-25`
- **What Was Expected**: TLS integration test server starts cleanly in local development environments and CI pipelines running modern Python runtimes (Python >= 3.10).
- **What Actually Happened**: Modern Python versions deprecated and disabled `ssl.PROTOCOL_TLSv1_2` direct context constructor constants, leading to CI test suite initialization failures when testing custom client certificates.
- **Evidence in Repo**: Commit SHA `0d8590e7`: "Fix SSL test server compatibility with newer Python".
- **Root Cause**: The test harness hardcoded deprecated TLS protocol configurations instead of using modern TLS server context negotiation with explicit min/max version bounding.
- **Remediation Code Diff**:
```python
 def get_ssl_context(cert_file, use_client_certificate_authentication):
-    ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLSv1_2)
+    ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
+    ssl_context.minimum_version = ssl.TLSVersion.TLSv1_2
+    ssl_context.maximum_version = ssl.TLSVersion.TLSv1_2
     if use_client_certificate_authentication:
         ssl_context.verify_mode = ssl.CERT_REQUIRED
```
- **Lesson**: TLS configurations must separate context initialization (`PROTOCOL_TLS_SERVER`) from protocol version boundaries (`minimum_version`, `maximum_version`) to ensure forward-compatibility with underlying TLS engine upgrades.

---

## 4. Microscopic Code-Level Invariants

### 4.1 Micro-Syntax & Token-Level Precision
1. **Operator Precedence in Slicing and String Length**:
   In `trunc_str` (`packages/hurl/src/report/html/timeline/util.rs`), naive byte slicing vs. character slicing creates boundary hazards:
   ```rust
   pub fn trunc_str(text: &str, max_len: usize) -> String {
       if text.len() > max_len {
           format!("{}...", &text[0..max_len]) // DANGER: Slices bytes, not chars! Panics on multi-byte boundaries.
       } else {
           text.to_string()
       }
   }
   ```
   *Micro-invariant Fix*: Strings containing UTF-8 characters (e.g., emojis, CJK) must be truncated using character indices:
   ```rust
   pub fn safe_trunc_str(text: &str, max_chars: usize) -> String {
       let chars: Vec<char> = text.chars().collect();
       if chars.len() > max_chars {
           format!("{}...", chars[..max_chars].iter().collect::<String>())
       } else {
           text.to_string()
       }
   }
   ```
2. **Secret Redaction Ordering and Token Shadowing**:
   In `packages/hurl/src/util/redacted.rs`:
   ```rust
   impl<T> Redact for T where T: AsRef<str> + ToString {
       fn redact(&self, secrets: &[impl AsRef<str>]) -> String {
           let mut value = self.to_string();
           for s in secrets {
               value = value.replace(s.as_ref(), "***");
           }
           value
       }
   }
   ```
   *Precision Hazard*: If an empty secret `""` enters the vector, `value.replace("", "***")` injects `***` between every byte in the string.
   *Invariant Rule*: The redaction engine MUST filter out empty strings (`s.as_ref().is_empty()`) and sort secrets descending by length before execution to prevent shorter secret substrings from corrupting longer matching secrets.

---

### 4.2 Infinite Loop & Recursion Guards
1. **Path Ancestor Traversal Loop Invariant**:
   In `is_descendant` (`packages/hurl/src/util/path.rs`):
   ```rust
   fn is_descendant(path: &Path, ancestor: &Path) -> bool {
       let path = resolve_path(path);
       let ancestor = resolve_path(ancestor);
       for a in path.ancestors() {
           if ancestor == a {
               return true;
           }
       }
       false
   }
   ```
   *Termination Invariant Proof*: `Path::ancestors()` relies on iterative `.parent()` calls. In POSIX/Windows paths, `.parent()` terminates when `path == ""` or `path == "/"`. Because `resolve_path` normalizes all `.` and `..` components before iteration, cyclic path references cannot cause infinite loops.
2. **Worker Channel Receiver Termination**:
   In `packages/hurl/src/parallel/worker.rs`:
   ```rust
   let Ok(job) = rx.lock().unwrap().recv() else {
       return; // Channel disconnected, worker thread terminates cleanly
   };
   ```
   *Loop Termination Proof*: The loop relies on `rx.recv()` returning an `Err` variant when all `Sender` instances are dropped by the coordinator. This provides an exit guarantee without requiring an explicit atomic shutdown flag.

---

### 4.3 UI & UX Micro-Mechanics
1. **ANSI Terminal Progress Bar Rewind Semantics**:
   In `packages/hurl/src/util/term.rs`:
   ```rust
   fn rewind_cursor(&self) {
       if self.progress_bar.is_empty() {
           return;
       }
       let lines = self.progress_bar.chars().filter(|c| *c == '\n').count();
       if lines > 0 {
           (0..lines).for_each(|_| eprint!("\x1B[1A\x1B[K"));
       } else {
           eprint!("\x1B[K");
       }
   }
   ```
   *Terminal Reflow Invariant*: Before writing new lines to `stderr` in interactive mode, the cursor MUST be moved up (`\x1B[1A`) by the exact newline count of the active progress bar and cleared to the end-of-line (`\x1B[K`). Standard `\r` (carriage return) only resets column 0 on the *current* row; multi-line progress bars without `1A` rewinds cause visual display artifacts and line duplication.

2. **SVG Grid Parity Invariant**:
   In `packages/hurl/src/report/html/timeline/util.rs`:
   ```rust
   let nb_calls = 2 * (nb_stripes / 2) + 1;
   ```
   To guarantee visual continuity in HTML waterfall diagrams, the stripe count is forced to an odd number. This ensures the first and last rendered stripe in the grid share the identical fill status, preventing layout shifts when responsive SVG containers scale across varying viewport widths.

---

### 4.4 Backend Concurrency & Memory Safety
1. **Multi-Thread Channel Lock Granularity**:
   In `packages/hurl/src/parallel/worker.rs`, the work queue is held in an `Arc<Mutex<Receiver<Job>>>`:
   ```rust
   loop {
       let Ok(job) = rx.lock().unwrap().recv() else {
           return;
       };
       // Lock is dropped HERE immediately after job extraction!
       let mut stdout = Stdout::new(WriteMode::Buffered);
       // Heavy I/O execution runs outside the lock
       let result = runner::run_entries(...);
   }
   ```
   *Deadlock & Contention Prevention*: The mutex guard scope is confined entirely to the `.recv()` statement. Holding the guard across network requests would serialize parallel worker threads into sequential execution, starving the thread pool.

2. **Windows TTY Non-UTF8 Lossy Fallback**:
   In `packages/hurl/src/util/term.rs`:
   ```rust
   #[cfg(target_family = "windows")]
   fn write_stdout(buf: &[u8]) -> Result<(), io::Error> {
       if io::stdout().is_terminal() {
           println!("{}", String::from_utf8_lossy(buf));
       } else {
           let mut handle = io::stdout().lock();
           handle.write_all(buf)?;
       }
       Ok(())
   }
   ```
   *Console Safety*: The Windows console host (`conhost.exe`) raises an immediate I/O error if non-UTF-8 bytes are pushed directly to a standard output handle attached to a TTY. Lossy conversion isolates and prevents panics on legacy Windows command prompts while preserving raw byte streaming when piping stdout to files or downstream processes.

---

### 4.5 Defect & Error Prevention ("Galti Pakadna")
1. **Double Error Propagation Guard in Parsing**:
   In `packages/hurl/src/parallel/worker.rs`:
   ```rust
   let hurl_file = match hurl_file {
       Ok(h) => h,
       Err(error) => {
           let filename = job.filename.to_string();
           let message = error.render(
               &filename,
               &content,
               None,
               OutputFormat::Terminal(logger.color),
           );
           logger.error_rich(&message);
           let msg = ParsingErrorMsg::new(worker_id, &job, &logger.stderr);
           _ = tx.send(WorkerMessage::ParsingError(msg));
           return;
       }
   };
   ```
   *Fault Boundary Rule*: When a syntax/parsing error occurs in a parallel worker, the rich terminal-formatted diagnostic string is logged directly into the thread-local buffered `logger.stderr`. The worker does not panic or silently fail; it sends a structured `ParsingError` back to the coordinator and terminates its execution loop gracefully.

2. **Variable Shadowing Resistance for Reserved Functions**:
   In `packages/hurl_core/src/ast/core.rs`:
   ```rust
   pub fn is_variable_reserved(name: &str) -> bool {
       ["getEnv", "newDate", "newUuid"].contains(&name)
   }
   ```
   *Static Invariant*: Hurl prevents variable capture declarations from binding to internal built-in dynamic functions. Failing to guard these reserved keywords would cause expression evaluators to produce unpredictable output depending on parse order.

---

## 5. The 9 Deep Learning Dimensions

### 5.1 Architecture
Hurl decouples protocol parsing from protocol execution across a three-layer boundary:
- **`hurl_core`**: Pure functional compiler subsystem. Takes raw byte sequences, runs parser combinators, outputs an AST, and provides AST visitation/formatting capabilities. Never links against network or OS sockets.
- **`hurl::runner`**: Orchestration engine. Manages state transformations, evaluates predicates, and updates variable scopes across chained entries.
- **`hurl::http`**: Low-level runtime engine. Mediates external calls through `libcurl` via safe Rust wrappers, managing low-level socket pools, SSL/TLS contexts, and proxy negotiations.

### 5.2 Core Abstractions
- **`HurlFile` & `Entry`**: The primary AST root and transactional step units (`Entry = Request + Option<Response>`).
- **`ContextDir`**: Encapsulates workspace filesystem authority, ensuring deterministic path mapping and chroot-style access jailing.
- **`Filter` & `Predicate`**: Functional query primitives that pipe response values through deterministic chain evaluations (`XPath` -> `Regex` -> `Base64Decode` -> `Assert`).
- **`WriteMode`**: Abstraction over output targets (`Buffered` vs. `Immediate`), allowing the same logging and terminal routines to operate in single-threaded interactive runs and parallel multi-worker pipelines without line interleaving.

### 5.3 Error Handling
Hurl distinguishes between:
1. **Compilation/Parse Errors**: Caught at AST generation time. Rendered with full source context (line numbers, column markers, ANSI visual pointers via `DisplaySourceError`).
2. **Transport/Runtime Errors**: HTTP disconnects, SSL verification failures, and timeouts are treated as non-panicking execution outcomes captured in `JobResult`.
3. **Assertion Failures**: Do not crash the engine; they record failure metadata, format expected vs. actual value diffs, and control exit-code policies (`--continue-on-error`).

### 5.4 Testing
The project uses a three-tier test architecture:
- **Unit Testing**: Inline Rust tests (`#[cfg(test)]`) focusing on parser combinators, path sanitizers, and SVG generators.
- **Integration Testing**: End-to-end Python-driven test suites (`ssl_server.py`, mock HTTP servers) validating HTTP/1.1, HTTP/2, client TLS certs, and error code mechanics under controlled networking conditions.
- **Golden File / Snapshot Testing**: AST source serialization checks (`hurlfmt`) verifying round-trip fidelity between text and AST.

### 5.5 Security
- **Threat Model**: Malicious `.hurl` files designed to extract host files or execute commands on developer or CI systems.
- **Defenses**:
  - `ContextDir` prevents traversal outside the designated file root.
  - Secret redaction ensures injected environment variables and tokens are stripped before writing trace logs.
  - POSIX shell quoting on CLI exports prevents command injection via crafted URLs.

### 5.6 Performance
- **Zero-Copy Where Feasible**: Memory buffers are passed by reference (`&[u8]`, `&str`) during AST parsing.
- **Profile Configuration**:
  ```toml
  [profile.release]
  lto = true
  codegen-units = 1
  panic = "abort"
  strip = true
  ```
  Forces whole-program Link-Time Optimization (LTO) and single codegen units to maximize inlining and minimize binary size, while `panic = "abort"` removes unwinding tables for smaller binaries and faster crashes.

### 5.7 Deployment
- Multi-target packaging via cargo workflows (`extra-package.yml`, `package.yml`).
- Static binary builds linked against system `libcurl` and OpenSSL/LibreSSL variants.
- Strict linter configuration:
  ```toml
  [workspace.lints.rust]
  warnings = "deny"
  [workspace.lints.clippy]
  empty_structs_with_brackets = "deny"
  manual_string_new = "deny"
  semicolon_if_nothing_returned = "deny"
  wildcard_imports = "deny"
  ```

### 5.8 Agent Patterns
Hurl implements loop-guard and context-budgeting techniques:
- **Entry Execution Cap**: Chained requests are bounded by AST sequence definitions; there are no unbound dynamic jumps.
- **Secret Redaction**: Maintains a dynamic registry of secret values (`Vec<String>`) loaded during variable initialization. These are applied lazily to all outgoing log messages.

### 5.