# Forensic Learning Record (Deep Inspection): kucherenko/jscpd

> **Canonical Artifact**: `07_PROJECT_LEARNING/kucherenko-jscpd-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/kucherenko/jscpd](https://github.com/kucherenko/jscpd))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:46:24.021Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kucherenko/jscpd`
- **Description**: Copy/paste detector for source code. 220+ languages, Rust engine, SARIF/HTML/badge reporters, GitHub Action, MCP server for AI agents.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 6304 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/rust-cpd-finder/src/main.rs`
```
//! Minimal example of running the jscpd v5 engine from Rust.
//!
//! Usage: `cargo run -- [PATH]...` (defaults to the current directory).

use std::env;

use cpd_finder::orchestrate::{RunConfig, run};

fn main() {
    let mut paths: Vec<_> = env::args().skip(1).map(Into::into).collect();
    if paths.is_empty() {
        paths.push(".".into());
    }

    let config = RunConfig {
        paths,
        min_tokens: 50,
        ..Default::default()
    };

    match run(&config) {
        Ok(result) => {
            println!("Found {} clones", result.clones.len());
            println!("Analyzed {} files", result.statistics.total.sources);
            for clone in result.clones.iter().take(10) {
                println!(
                    "{}:{} <-> {}:{} ({} lines)",
                    clone.fragment_a.source_id,
                    clone.fragment_a.start.line,
                    clone.fragment_b.source_id,
                    clone.fragment_b.start.line,
                    clone.fragment_a.end.line - clone.fragment_a.start.line + 1,
                );
            }
        }
        Err(err) => {
            eprintln!("jscpd failed: {err}");
            std::process::exit(1);
        }
    }
}

```

### Core Architecture Module: `fixtures/clike/file1.c`
```
/*
 * Copy the size of snapshot frame "sn" to frame "fr".  Do the same for all
 * following frames and children.
 * Returns a pointer to the old current window, or NULL.
 */
static win_T *restore_snapshot_rec(frame_T *sn, frame_T *fr)
{
  win_T       *wp = NULL;
  win_T       *wp2;

  fr->fr_height = sn->fr_height;
  fr->fr_width = sn->fr_width;
  if (fr->fr_layout == FR_LEAF) {
    frame_new_height(fr, fr->fr_height, FALSE, FALSE);
    frame_new_width(fr, fr->fr_width, FALSE, FALSE);
    wp = sn->fr_win;
  }
  return wp;
}

```

### Core Architecture Module: `fixtures/clike/file1.cpp`
```
#ifndef CP5_STRVEC_H_
#define CP5_STRVEC_H_

#include <memory>
#include <string>
#include <initializer_list>

#ifndef _MSC_VER
#define NOEXCEPT noexcept
#else
#define NOEXCEPT
#endif

class StrVec
{
    friend bool operator==(const StrVec&, const StrVec&);
    friend bool operator!=(const StrVec&, const StrVec&);
    friend bool operator< (const StrVec&, const StrVec&);
    friend bool operator> (const StrVec&, const StrVec&);
    friend bool operator<=(const StrVec&, const StrVec&);
    friend bool operator>=(const StrVec&, const StrVec&);

public:
    StrVec() : elements(nullptr), first_free(nullptr), cap(nullptr) { }
    StrVec(std::initializer_list<std::string>);
    StrVec(const StrVec&);
    StrVec& operator=(const StrVec&);
    StrVec(StrVec&&) NOEXCEPT;
    StrVec& operator=(StrVec&&)NOEXCEPT;
    ~StrVec();

    void push_back(const std::string&);
    size_t size() const { return first_free - elements; }
    size_t capacity() const { return cap - elements; }
    std::string *begin() const { return elements; }
    std::string *end() const { return first_free; }

    std::string& at(size_t pos) { return *(elements + pos); }
    const std::string& at(size_t pos) const { return *(elements + pos); }

    void reserve(size_t new_cap);
    void resize(size_t count);
    void resize(size_t count, const std::string&);

    StrVec() : elements(nullptr), first_free(nullptr), cap(nullptr) { }
    StrVec(std::initializer_list<std::string>);
    StrVec(const StrVec&);
    StrVec& operator=(const StrVec&);
    StrVec(StrVec&&) NOEXCEPT;
    StrVec& operator=(StrVec&&)NOEXCEPT;
    ~StrVec();

    void push_back(const std::string&);
    size_t size() const { return first_free - elements; }
    size_t capacity() const { return cap - elements; }
    std::string *begin() const { return elements; }
    std::string *end() const { return first_free; }

    std::string& at(size_t pos) { return *(elements + pos); }
    const std::string& at(size_t pos) const { return *(elements + pos); }

    void reserve(size_t new_cap);
    void resize(size_t count);
    void resize(size_t count, const std::string&);

private:
    std::pair<std::string*, std::string*> alloc_n_copy(const std::string*, const std::string*);
    void free();
    void chk_n_alloc() { if (size() == capacity()) reallocate(); }
    void reallocate();
    void alloc_n_move(size_t new_cap);
    void range_initialize(const std::string*, const std::string*);

private:
    std::string *elements;
    std::string *first_free;
    std::string *cap;
    std::allocator<std::string> alloc;
};

bool operator==(const StrVec&, const StrVec&);
bool operator!=(const StrVec&, const StrVec&);
bool operator< (const StrVec&, const StrVec&);
bool operator> (const StrVec&, const StrVec&);
bool operator<=(const StrVec&, const StrVec&);
bool operator>=(const StrVec&, const StrVec&);

#endif

```

### Core Architecture Module: `fixtures/clike/file1.h`
```
/*
 * Copy the size of snapshot frame "sn" to frame "fr".  Do the same for all
 * following frames and children.
 * Returns a pointer to the old current window, or NULL.
 */
static win_T *restore_snapshot_rec(frame_T *sn, frame_T *fr)
{
  win_T       *wp = NULL;
  win_T       *wp2;

  fr->fr_height = sn->fr_height;
  fr->fr_width = sn->fr_width;
  if (fr->fr_layout == FR_LEAF) {
    frame_new_height(fr, fr->fr_height, FALSE, FALSE);
    frame_new_width(fr, fr->fr_width, FALSE, FALSE);
    wp = sn->fr_win;
  }
  return wp;
}

```

### Core Architecture Module: `fixtures/clike/file2.c`
```
/*
 * Copy the size of snapshot frame "sn" to frame "fr".  Do the same for all
 * following frames and children.
 * Returns a pointer to the old current window, or NULL.
 */
static win_T *restore_snapshot_rec(frame_T *sn, frame_T *fr)
{
  win_T       *wp = NULL;
  win_T       *wp2;

  fr->fr_height = sn->fr_height;
  fr->fr_width = sn->fr_width;
  if (fr->fr_layout == FR_LEAF) {
    frame_new_height(fr, fr->fr_height, FALSE, FALSE);
    frame_new_width(fr, fr->fr_width, FALSE, FALSE);
    wp = sn->fr_win;
  }
  win_T       *wp = NULL;
  win_T       *wp2;

  fr->fr_height = sn->fr_height;
  fr->fr_width = sn->fr_width;
  if (fr->fr_layout == FR_LEAF) {
    frame_new_height(fr, fr->fr_height, FALSE, FALSE);
    frame_new_width(fr, fr->fr_width, FALSE, FALSE);
    wp = sn->fr_win;
  }
  return wp;
}

```

### Core Architecture Module: `fixtures/clike/file2.cpp`
```
#ifndef CP5_STRVEC_H_
#define CP5_STRVEC_H_

#include <memory>
#include <string>
#include <initializer_list>

#ifndef _MSC_VER
#define NOEXCEPT noexcept
#else
#define NOEXCEPT
#endif

class StrVec
{
    friend bool operator==(const StrVec&, const StrVec&);
    friend bool operator!=(const StrVec&, const StrVec&);
    friend bool operator< (const StrVec&, const StrVec&);
    friend bool operator> (const StrVec&, const StrVec&);
    friend bool operator<=(const StrVec&, const StrVec&);
    friend bool operator>=(const StrVec&, const StrVec&);

public:
    StrVec() : elements(nullptr), first_free(nullptr), cap(nullptr) { }
    StrVec(std::initializer_list<std::string>);
    StrVec(const StrVec&);
    StrVec& operator=(const StrVec&);
    StrVec(StrVec&&) NOEXCEPT;
    StrVec& operator=(StrVec&&)NOEXCEPT;
    ~StrVec();

    void push_back(const std::string&);
    size_t size() const { return first_free - elements; }
    size_t capacity() const { return cap - elements; }
    std::string *begin() const { return elements; }
    std::string *end() const { return first_free; }

    std::string& at(size_t pos) { return *(elements + pos); }
    const std::string& at(size_t pos) const { return *(elements + pos); }

    void reserve(size_t new_cap);
    void resize(size_t count);
    void resize(size_t count, const std::string&);

    StrVec() : elements(nullptr), first_free(nullptr), cap(nullptr) { }
    StrVec(std::initializer_list<std::string>);
    StrVec(const StrVec&);
    StrVec& operator=(const StrVec&);
    StrVec(StrVec&&) NOEXCEPT;
    StrVec& operator=(StrVec&&)NOEXCEPT;
    ~StrVec();

    void push_back(const std::string&);
    size_t size() const { return first_free - elements; }
    size_t capacity() const { return cap - elements; }
    std::string *begin() const { return elements; }
    std::string *end() const { return first_free; }

    std::string& at(size_t pos) { return *(elements + pos); }
    const std::string& at(size_t pos) const { return *(elements + pos); }

    void reserve(size_t new_cap);
    void resize(size_t count);
    void resize(size_t count, const std::string&);

private:
    std::pair<std::string*, std::string*> alloc_n_copy(const std::string*, const std::string*);
    void free();
    void chk_n_alloc() { if (size() == capacity()) reallocate(); }
    void reallocate();
    void alloc_n_move(size_t new_cap);
    void range_initialize(const std::string*, const std::string*);

private:
    std::string *elements;
    std::string *first_free;
    std::string *cap;
    std::allocator<std::string> alloc;
};

bool operator==(const StrVec&, const StrVec&);
bool operator!=(const StrVec&, const StrVec&);
bool operator< (const StrVec&, const StrVec&);
bool operator> (const StrVec&, const StrVec&);
bool operator<=(const StrVec&, const StrVec&);
bool operator>=(const StrVec&, const StrVec&);

#endif

```

### Core Architecture Module: `fixtures/clike/file2.h`
```
/*
 * Copy the size of snapshot frame "sn" to frame "fr".  Do the same for all
 * following frames and children.
 * Returns a pointer to the old current window, or NULL.
 */
static win_T *restore_snapshot_rec(frame_T *sn, frame_T *fr)
{
  win_T       *wp = NULL;
  win_T       *wp2;

  fr->fr_height = sn->fr_height;
  fr->fr_width = sn->fr_width;
  if (fr->fr_layout == FR_LEAF) {
    frame_new_height(fr, fr->fr_height, FALSE, FALSE);
    frame_new_width(fr, fr->fr_width, FALSE, FALSE);
    wp = sn->fr_win;
  }
  win_T       *wp = NULL;
  win_T       *wp2;

  fr->fr_height = sn->fr_height;
  fr->fr_width = sn->fr_width;
  if (fr->fr_layout == FR_LEAF) {
    frame_new_height(fr, fr->fr_height, FALSE, FALSE);
    frame_new_width(fr, fr->fr_width, FALSE, FALSE);
    wp = sn->fr_win;
  }
  return wp;
}

```

### Core Architecture Module: `fixtures/compare-demo/python/billing.py`
```
"""Invoice arithmetic of the old billing service."""

from datetime import date, timedelta

REGION_TAX = {"eu": 0.21, "uk": 0.20, "us": 0.0725}


def line_total(lines):
    """Sum of quantity times unit price, in cents."""
    total = 0
    for line in lines:
        if line["quantity"] <= 0:
            raise ValueError("quantity must be positive")
        total += line["quantity"] * line["unit_price"]
    return total


def apply_discount(amount, percent, cap):
    """A percentage off, never more than the cap."""
    if percent < 0 or percent > 100:
        raise ValueError("percent must be between 0 and 100")
    discount = amount * percent // 100
    if discount > cap:
        discount = cap
    return amount - discount


def tax_for_region(amount, region, exempt):
    """Sales tax for a region; exempt customers pay none."""
    if exempt:
        return 0
    rate = REGION_TAX.get(region.lower())
    if rate is None:
        raise KeyError(f"no tax rate for region {region}")
    return round(amount * rate)


def format_invoice_number(year, sequence, prefix):
    """INV-2026-000042 style numbers."""
    if sequence < 1:
        raise ValueError("sequence starts at 1")
    padded = str(sequence).rjust(6, "0")
    return f"{prefix.upper()}-{year}-{padded}"


def due_date(issued, terms_days, holidays):
    """The first working day on or after the end of the payment terms."""
    due = issued + timedelta(days=terms_days)
    while due.weekday() >= 5 or due in holidays:
        due += timedelta(days=1)
    return due

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1090** (2026-09-23): **Prose between embedded code blocks is counted as duplicated lines**
  *Symptoms*: ### Engine, version, install method, OS  v5 (Rust engine), built from master at 416b9702 (`rust/target/release/cpd`). macOS arm64 (Darwin 25.6). Also visible in 5.3.1 from npm.  ### Command and configuration  ```shell cpd . ```  No `.jscpd.json`, no flags.  ### What happens  Markdown, Vue, Svelte and Astro files are scanned as multi-format: every embedded code block becomes a synthetic source carrying the sub-language's format. That part works. What goes wrong is that the synthetic source keeps the parent file's line numbers, and two pieces of the statistics read those numbers as if the token stream were contiguous. It is not — there is prose between the blocks, and that prose ends up counted as duplicated code.  Take two markdown files, each with five identical 12-line `ts` blocks with 200 lines of text between them. That is 60 lines of TypeScript per file, 120 altogether:  ``` Clone found (typescript)  - one.md:typescript [202:1 - 1069:40] (868 lines, 720 tokens)    two.md:typescript [202:1 - 1069:40]  │ Format     │ Files analyzed │ Total lines │ Total tokens │ Clones found │ Duplicated lines │ │ typescript │ 2              │ 2138        │ 1440         │ 2            │ 1520 (71.09%)    │ ```  868 lines holding 720 tokens. Roughly 60 of those lines are code and the other 800 are the text between the blocks. The token counts, by contrast, are right: 1440 tokens is what 120 lines of that code really is. Only the line columns are wrong.  Two separate places produce this:  1. `

- **Issue #1082** (2026-09-19): **dead-code: WXT extensions read as ~28% dead — entrypoints/ not recognized as entry points**
  *Symptoms*: ## Problem  basta's entry-point detection doesn't know the [WXT](https://wxt.dev) browser-extension framework, so on a WXT project the entry files themselves (`entrypoints/background.ts`, `entrypoints/content.ts`, `entrypoints/popup/…`) are reported as unused files — and since dead code cascades through the reachability walk, everything only they import goes down with them.  Real-world case: [Tencent/BrowserSkill](https://github.com/Tencent/BrowserSkill) at `fa953dc`, as shown on [jscpd.dev/trending/Tencent/BrowserSkill](https://jscpd.dev/trending/Tencent/BrowserSkill):  - `jscpd --dead-code` reports **27.91% unused, 318 findings, 115 unused files** - 312 of the 318 findings (~27.8k of ~29.7k dead lines) sit under `apps/extension/src` — a WXT extension (`wxt.config.ts`, `"build": "wxt build"`, `srcDir: "src"`) - `background.ts` imports the whole `tools/`, `lib/`, `browser-driver/`, `content/` tree via `@/` aliases; none of it is dead - Cross-check: fallow (which resolves WXT) reports **11** unused files instead of 115, none of them in the extension; knip without WXT handling flags the entrypoints too but doesn't cascade  So roughly 98% of the reported dead code on such a project is one missing framework convention.  ## Expected  Treat WXT entrypoints as entry points, the way basta already reads Nuxt/Nitro directory conventions and SvelteKit's `$lib`:  - Detect WXT via `wxt.config.{ts,js,mjs}` (or the `wxt` dependency/scripts in `package.json`) - Read `srcDir` (default: projec

- **Issue #1059** (2026-09-15): **--follow-symlinks: symlinked files are reported by their real path and counted twice**
  *Symptoms*: ### Engine, version, install method, OS  v5 (Rust engine). `jscpd --version` prints `jscpd 5.2.0`. Reproduced with the npm launcher (`npx -p jscpd@5.2.0 jscpd`) on macOS arm64 (Darwin 25.6) and with the `jscpd-linux-arm64-gnu` binary from the 5.2.0 tarball on Debian 13 arm64. Not tried on Windows.  ### Command and configuration  ```shell jscpd --silent --reporters json --output .r --min-tokens 20 --follow-symlinks . ```  No `.jscpd.json`, no `jscpd` key in package.json.  ### What happens  When the walk reaches a file through a symlink, the report names that file by its resolved real path, not by the path it was found at.  Layout (script at the bottom): `root/candidate/app.js`, a directory symlink `root/corpus -> ../outside` where `outside/S1/app.js` is a copy of the same file, and a file symlink `root/linked.js -> candidate/app.js`. Scanning `.` from `root` with `--follow-symlinks` prints:  ``` Clone found (javascript)  - /lab/outside/S1/app.js [1:1 - 8:24] (8 lines, 56 tokens)    candidate/app.js [1:1 - 8:24] ```  Three things are off here:  1. One fragment is an absolute path outside the scan root, the other one is relative. The name the walker actually used, `corpus/S1/app.js`, appears nowhere in the report. `--absolute` was not passed. 2. `--ignore` and the report disagree about what the path of this file is. `--ignore 'corpus/**'` does exclude it, because the glob is matched against the walked path. `--ignore '**/outside/**'` does nothing, although `outside` is the only 
  **Post-Mortem & Fix Analysis**:
  > Released in [v5.2.1](https://github.com/kucherenko/jscpd/releases/tag/v5.2.1).  A file reached through a symlink keeps the path it was found at, `--ignore` matches that same path, and a file reachable through several paths is scanned once. The v5 default (links skipped unless `--follow-symlinks`, where v4 followed them unless `--noSymlinks`) is now in the README and the migration table. Demo under `fixtures/follow-symlinks-demo/`.  One deliberate detail: `--skip-local folder1 folder2` treats a file found through a link inside `folder1` as part of `folder1`, matching v4, so only cross-folder clones survive.

- **Issue #1047** (2026-09-11): **Exit code is 0 for unknown --format, nonexistent paths and failed reporters**
  *Symptoms*: ## Summary  jscpd 5.2.0 exits with code 0 in three situations where the scan did not actually happen or the report was not written. A CI job that only checks the exit code sees a green run and an empty (or missing) report.  Reported by the [GitTested review](https://gittested.com/reviews/jscpd/) (tested on `56b65069`, v5.0.16 line); reproduced on 5.2.0.  ## Reproduction  ```bash # 1. Unknown format: empty report, exit 0 jscpd --format nosuchlang --reporters json --output out1 . echo $?   # 0, out1/jscpd-report.json exists with 0 sources  # 2. Nonexistent scan path: empty report, exit 0 jscpd /definitely/not/here --reporters json --output out2 echo $?   # 0, out2/jscpd-report.json exists with 0 sources  # 3. Unwritable output directory: error printed, exit 0 jscpd --reporters json --output /nonexistent-root/out . # Reporter 'json' error: I/O error in reporter: Read-only file system (os error 30) echo $?   # 0 ```  ## Expected  - `--format` with a name that is not in `jscpd --list` (and not added via `--formats-exts` / `--formats-names`) is a usage error: exit non-zero with a message naming the unknown format. - A scan path that does not exist is an error: exit non-zero. Same when none of the given paths exist. - A reporter that fails to write its output makes the run exit non-zero. The other reporters may still run, but the final code must reflect the failure.  Open question: should "no files matched" (paths exist, but nothing to analyze after `--ignore` / `--pattern` / `--for

- **Issue #1033** (2026-09-08): **Detector: an open clone is extended by any matching stored window, not by its own anchor, so pairs are silently lost on N-way copies**
  *Symptoms*: ## Summary  In `detect_in_group` (`rust/crates/cpd-core/src/detect.rs`) an open clone is enlarged whenever the next window matches *any* occurrence in the window store, without checking that the clone's own anchor (`stored_occurrence`) continues. When the match is picked up by a window stored from a different file, the anchored fragment is stretched past what the anchor file actually contains. If the anchor file ends there, `make_fragment` returns `None` and the whole clone is dropped silently. If the anchor file has more tokens, the reported pair can be longer than the real common region.  ## Repro (5.2.0)  Three JavaScript files, default thresholds:  - `f1.js`: a 10-line function `normalizeAddress` (152 tokens) - `f5.js`: the same function twice, under the names `normalizeA` and `normalizeB` - `f6.js`: `normalizeAddress` followed by a second, unrelated function  | Scanned set | f1 ↔ f6 pair | |---|---| | `f1 f6` | `f1.js:2-11 <-> f6.js:2-11 (152 tokens)` | | `f1 f5 f6` | **missing**; only `f5.js:8-13 <-> f6.js:8-12 (51 tokens)` from the secondary pass | | `f1 f5 f6`, with a trailing function appended to `f1` | `f1.js:2-13 <-> f6.js:2-12 (154 tokens)`: back, two tokens longer |  What happens in `f1 f5 f6`: while scanning `f5`, the windows around `} export function normalizeB` do not match `f1` and are inserted into the store. While scanning `f6`, the clone anchored on `f1` extends through the body; at the body's end the window `… } export function` matches the occurrence `f5

- **Issue #1023** (2026-09-07): **Detector drops all a↔b clones when b contains a second copy of the first half of a duplicated block**
  *Symptoms*: Found while reviewing #1020; reproduces on `master` with default options (no `--max-gap-lines`, so the merge pass is not involved).  **Setup.** `a.js` holds a block `P + Q` (two halves, each above `--min-tokens`). `b.js` holds `P + <inserted line> + Q` **and a second copy of `P`** further down.  **Expected.** At least the exact clones a.P↔b.P (twice) and a.Q↔b.Q.  **Actual.** Every a↔b clone disappears, including the unrelated 100-token a.Q↔b.Q match; only b's self-clone (P↔P inside b.js) is reported.  The primary pass keeps the first stored occurrence per window, and the secondary pass's coverage filter then appears to suppress the a↔b pairs. Worth a focused test in `rust/crates/cpd-core/src/detect.rs` around `add_secondary_clones` / `LineCoverage`.   <!-- brian settings start --><!--{}--><!-- brian settings end -->
  **Post-Mortem & Fix Analysis**:
  > Root cause is in the tokenizer, not the detector: any oxc parse diagnostic (here the redeclaration of `saveUser`) sent the file to the word-split fallback tokenizer, so its tokens could not match an oxc-tokenized file. Fix in #1024: only a parser that gives up (`panicked`) or yields no tokens falls back; recoverable diagnostics keep the lexer's token stream. Demo in `fixtures/parse-errors-demo`.

- **Issue #623** (2026-09-01): **PHP Multiline strings causing line number to be reported incorrectly**
  *Symptoms*: **Describe the bug** When scanning two PHP files that contain a duplicate block, but where one file also has a multi-line string before the block, the line number for the reported error will be off by the number of newlines within the PHP string (like the string is always assumed to be one line in the code that calculates this).  **To Reproduce** Steps to reproduce the behavior: Create one file with contexnts: ``` <?php  final class FirstClass {     /** @inheritDoc * */     public function someFunction(): void     {         $sql = "SELECT                      LINE1,                     LINE2,                     LINE3                 FROM mysql.table";     }      public function imageUri(mixed $result, string $subdomain): string     {         $portPart = '';         if ($this->environment->isDeveloperEnv()) {             $port = (int) $this->environment->getHttpPort();             if (!in_array($port, [80, 443])) {                 $portPart = ":$port";             }         }          return "ABC123";     } } ```  Create a second file with: ``` <?php  final class SecondClass {     public function getImageUriBasePath(): string     {         $portPart = '';         if ($this->environment->isDeveloperEnv()) {             $port = (int) $this->environment->getHttpPort();             if (!in_array($port, [80, 443])) {                 $portPart = ":$port";             }         }          $subdomain = $this->environment->getSubDoma
  **Post-Mortem & Fix Analysis**:
  > Oh darn, I just encountered this too. I'll see if I can dig in the code to help.
  > Alright, I looked into it and the package reprism is definitely to blame since it probably forked a now very old version of PrismJS.  I rolled back Prism versions until I encountered the bug to guess around what version multiline strings weren't working and it was around 1.8.0 which fits the range of time around when reprism forked. Reprism was created with the intend of being an esm compatible port, but wasn't really updated whereas Prism is still updated and they're currently working on v2 which will be the modernized esm version. I'll look into another approach to solve my problem and report my findings.
  > Found it. Not sure it's related to the version of Prism that much anymore, granted the new syntax definition is more accurate at times because of new PHP language features, but nonetheless, here's the guilty part[: there's a place where the alias gets passed as the lang argument]. (https://github.com/kucherenko/jscpd/blob/c1f369912bb77b67f029bf396fb36c94f5f772d0/packages/tokenizer/src/tokenize.ts#L119).  ```javascript         (t: IToken) => (res = res.concat(createTokens(t, token.alias ? sanitizeLangName(token.alias as string) : lang))), ```  Not sure why, this piece of code is there, but that why some of the tokens don't go through when they're a few levels deep (string -> heredoc / string -> double-quoted-string + interpolations, etc.).  A simple fix for PHP right is to simply replace that line with :  ```javascript (t: IToken) => (res = res.concat(createTokens(t, lang))), ```  But that breaks the tests with some other languages so I'd need to investigate further.

- **Issue #612** (2026-09-01): **consoleFull/html reporter shows wrong code block than line number gives**
  *Symptoms*: **Describe the bug** consoleFull/html reporter shows wrong code block than line number gives  **To Reproduce** `jscpd  -r consoleFull --skipLocal --mode strict b/utsname.c  a/utsname.c`  **Screenshots** error code block as following: ```bash $ jscpd  -r consoleFull --skipLocal --mode strict b/utsname.c  a/utsname.c Clone found (c):  - b/utsname.c [6:27 - 16:1] (10 lines, 68 tokens)    a/utsname.c [31:1 - 41:1]  Clone found (c):  - b/utsname.c [6:27 - 16:1] (10 lines, 68 tokens)    a/utsname.c [31:1 - 41:1]   6  │ 31 │ ude <linux/uts.h>  7  │ 32 │ #include <linux/utsname.h>  8  │ 33 │ #include <linux/err.h>  9  │ 34 │  10 │ 35 │ // only in testing hahahha  11 │ 36 │ static struct uts_namespace *create_uts_ns(void)  12 │ 37 │ {  13 │ 38 │      struct uts_namespace *uts_ns;  14 │ 39 │  15 │ 40 │      uts_ns = kmalloc(sizeof(  Found 1 clones. Detection time:: 46.558ms  ```  **Expected behavior** output shows correct, full matched code.   **Desktop (please complete the following information):**  - OS: Ubuntu  - OS Version 18.04  - NodeJS Version v16.20.2  - jscpd version 3.5.10   **Additional context** b/utsname.c ```c #include <linux/export.h> #include <linux/uts.h> #include <linux/utsname.h> #include <linux/err.h>  // only in testing hahahha static struct uts_namespace *create_uts_ns(void) // line 6 here. {         struct uts_namespace *uts_ns;          uts_ns = kmalloc(sizeof(struct uts_namespace), GFP_KERNEL);         i
  **Post-Mortem & Fix Analysis**:
  > will check, thank you
  > Not reproducible on v5.1.1.  Verified with `-r console-full --mode strict` on two C files holding the same block at different offsets: the printed code matches the reported range line-for-line in both fragments.  Closing; please reopen with a sample if you still see the block and the line numbers disagree on v5. 

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & Real Production Code Patches
Observed empirical fixes and code patches:

### Incident Patch 1: `7f565c8b` (2026-09-30)
**Commit Message**: fix(lsp): a file written during a background run waits for the next one

A snapshot taken after a run could describe a newer text than the one
the run read, when the file was saved again meanwhile, and the findings
then showed at stale offsets until the next run. A file modified after
the run started now gets no snapshot, so its findings stay hidden until
the run that read its new text.

**File**: `rust/crates/cpd/src/lsp/dead_code.rs` (modified, +2/-1)
```diff
@@ -39,6 +39,7 @@ pub struct Run {
 
 /// Run basta and resolve each finding to its file.
 pub fn run(config: &basta::config::BastaConfig) -> Run {
+    let started = std::time::SystemTime::now();
     let result = basta::analyze::run(config);
     let graph = &result.graph;
     // A report names a file relative to its root, and two roots can each
@@ -77,7 +78,7 @@ pub fn run(config: &basta::config::BastaConfig) -> Run {
         .map(|(path, _)| path)
         .collect::<HashSet<_>>()
         .into_iter()
-        .filter_map(|path| Some((path.clone(), Snapshot::of_disk(path)?)))
+        .filter_map(|path| Some((path.clone(), Snapshot::of_disk(path, started)?)))
         .collect();
     Run {
         findings,
```

**File**: `rust/crates/cpd/src/lsp/findings.rs` (modified, +10/-2)
```diff
@@ -116,8 +116,16 @@ pub struct Snapshot {
 }
 
 impl Snapshot {
-    /// The file at `path` as it is on disk now.
-    pub fn of_disk(path: &Path) -> Option<Self> {
+    /// The file at `path` as a run that started at `started` read it: the
+    /// file as it is on disk now, when nothing wrote it since the start.
+    /// A file written during the run may have been read before or after
+    /// the write, so it has no snapshot, and its findings wait for the next
+    /// run.
+    pub fn of_disk(path: &Path, started: std::time::SystemTime) -> Option<Self> {
+        let modified = std::fs::metadata(path).ok()?.modified().ok()?;
+        if modified > started {
+            return None;
+        }
         let text = Text::from_disk(std::fs::read_to_string(path).ok()?);
         Some(Self {
             hash: text.hash(),
```

**File**: `rust/crates/cpd/src/lsp/server.rs` (modified, +2/-1)
```diff
@@ -1614,6 +1614,7 @@ fn semantic_clones(
     excluded: &[PathBuf],
     options: &cpd_semantic::SemanticOptions,
 ) -> Result<SemanticRun, String> {
+    let started = std::time::SystemTime::now();
     let embedder = cpd_semantic::embedder(options, &run.paths, true)?;
     let mut config = run.clone();
     // The index finds the other kinds; this run is for the pairs alone.
@@ -1636,7 +1637,7 @@ fn semantic_clones(
         .map(|id| PathBuf::from(host_file(id)))
         .collect::<BTreeSet<_>>()
         .into_iter()
-        .filter_map(|path| Some((path.clone(), Snapshot::of_disk(&path)?)))
+        .filter_map(|path| Some((path.clone(), Snapshot::of_disk(&path, started)?)))
         .collect();
     Ok(SemanticRun { clones, snapshots })
 }
```

---

### Incident Patch 2: `249e78a8` (2026-09-30)
**Commit Message**: docs(lsp): the editors page follows the review fixes

Ignored files and folders, findings hidden after an unsaved edit, the
refused --config and paths, settings mistakes shown to the user, the
safer placement of the ignore markers, the Sublime LSP key
initialization_options, and two limits: a search per edit over a very
large pool, and followSymlinks.

**File**: `docs/editors.md` (modified, +14/-10)
```diff
@@ -1,6 +1,6 @@
 # Editors
 
-`jscpd --lsp` runs jscpd as a language server on stdin and stdout. An editor starts it for a workspace, and the server reports what jscpd finds as diagnostics in the files you edit. The diagnostics follow the text in the editor, saved or not: after you stop typing for 300 ms, the server tokenizes the file again from the buffer and searches its pool again. Files that change outside the editor, such as in a `git checkout`, reach the server when the editor watches files for it; the server reads them again and searches each pool they touch once.
+`jscpd --lsp` runs jscpd as a language server on stdin and stdout. An editor starts it for a workspace, and the server reports what jscpd finds as diagnostics in the files you edit. The diagnostics follow the text in the editor, saved or not: after you stop typing for 300 ms, the server tokenizes the file again from the buffer and searches its pool again. Files that change outside the editor, such as in a `git checkout`, reach the server when the editor watches files for it; the server reads them again and searches each pool they touch once. A folder deleted or moved in one piece counts for the files under it, and files the scan skips (ignored by `.gitignore` or `.ignore`, or over `maxSize`) stay out, whether they appear on disk or open in the editor.
 
 The server runs five analyses. Only clones are on unless you turn the others on:
 
@@ -81,7 +81,7 @@ With the [LSP](https://packagecontrol.io/packages/LSP) package, in Preferences >
 }
 ```
 
-The editor's settings go in `initializationOptions`.
+The editor's settings go in `initialization_options`.
 
 ### Emacs
 
@@ -115,7 +115,7 @@ The `.jscpd.json` files split the workspace into projects, and the server looks
 - Each `.jscpd.json` makes its folder a project with that config. A config in a subfolder of another project splits that subfolder out, so a file belongs to the project of the nearest config above it.
 - The files under no config form one more project, with the defaults.
 
-When it starts, the server looks for `.jscpd.json` files, skipping `.git`, `node_modules` and what git ignores, and it scans the workspace again when the editor reports that a config appeared, changed or went away. Only `.jscpd.json` makes a project: the server does not read `.config/jscpd.json` or the `jscpd` key of `package.json`, which the CLI also reads.
+When it starts, the server looks for `.jscpd.json` files, skipping `.git`, `node_modules` and what git ignores. It scans the workspace again when a config is saved in the editor, and when the editor reports that a config, a `.gitignore` or an `.ignore` file appeared, changed or went away. Only `.jscpd.json` makes a project: the server does not read `.config/jscpd.json` or the `jscpd` key of `package.json`, which the CLI also reads.
 
 A `.jscpd.json` that is not valid JSON leaves its project on the defaults, and the editor shows the parse error. A key in the `semantic` section that looks like a secret, such as `apiKey`, stops the project: the editor shows why, and the project gets no diagnostics until the key is gone. Other warnings about a config, such as an unknown key, go to the editor's log.
 
@@ -127,7 +127,9 @@ Options come from three places, and each wins over the one before it:
 2. The project's `.jscpd.json`.
 3. The editor's settings, which the editor sends when it starts the server (`initializationOptions`) and when they change (`workspace/didChangeConfiguration`). They take the keys of `.jscpd.json`, at the top level or under a `jscpd` key, and apply to every project on top of its config.
 
-A change to a config file or to the editor's settings applies at once, without a restart. jscpd refuses `--semantic`, `--dead-code` and `--complexity` together with `--lsp`; turn those analyses on with `--lsp-analyses` or in the `lsp` section instead.
+A change to a config file or to the editor's settings applies at once, without a restart. jscpd refuses `--semantic`, `--dead-
```

---

### Incident Patch 3: `d4c6a7fa` (2026-09-30)
**Commit Message**: fix(lsp): what a review of the server found

Four reviews of #1121 (the server, the index and projects, positions and
findings, the public API) turned up these, each reproduced first.

Public API
- RunConfig and WalkConfig keep the fields they were released with: a new
  field broke struct literals in jscpd 5.3.3 and basta 0.3.0 against a
  patch release of cpd-finder. The folders of nested projects now go to
  walk_excluding, prepare_files_in and run_excluding as an argument.

Index and projects
- A file that .gitignore, .ignore or maxSize leaves out of the walk no
  longer joins the index when it appears on disk or opens in the editor;
  after an npm install the index had grown from 11 files to 1,823.
- A folder deleted or moved in one event counts for the files under it.
- A file that changes on disk is updated in every project whose scan
  reaches it, not only the project of the nearest config.
- Open files, pending edits and watched changes are updated in one batch,
  one search per pool: a rescan with four open files took 41 s, now 11 s.
- An opened file whose tokens match the index skips the search.
- Relative skipIsolated folders are the config folder's, not the
  server's 

**File**: `rust/crates/basta/src/analyze.rs` (modified, +0/-1)
```diff
@@ -239,7 +239,6 @@ fn discover(config: &BastaConfig) -> Vec<cpd_finder::walker::DiscoveredFile> {
         formats_exts: config.formats_exts.clone(),
         formats_names: Default::default(),
         pattern: None,
-        exclude_dirs: Vec::new(),
     };
     walk(&walk_config)
 }
```

**File**: `rust/crates/cpd-finder/src/orchestrate.rs` (modified, +26/-13)
```diff
@@ -2,7 +2,7 @@
 
 use crate::pass::{ClonePass, PassContext, PassSource};
 use crate::statistics;
-use crate::walker::{WalkConfig, walk};
+use crate::walker::{WalkConfig, walk_excluding};
 use cpd_core::detect::{
     PathFilters, PathLabel, PreparedSource, detect_prepared, merge_gapped_clones,
 };
@@ -61,8 +61,6 @@ pub struct RunConfig {
     /// [`crate::pass`]); `--semantic` adds one. Empty: none runs, and no
     /// file is read for them.
     pub passes: Vec<Arc<dyn ClonePass>>,
-    /// Folders the walk leaves out (see [`WalkConfig::exclude_dirs`]).
-    pub exclude_dirs: Vec<PathBuf>,
 }
 
 impl Default for RunConfig {
@@ -95,7 +93,6 @@ impl Default for RunConfig {
             cross_formats: vec![],
             kinds: vec![],
             passes: vec![],
-            exclude_dirs: vec![],
         }
     }
 }
@@ -171,13 +168,25 @@ pub fn build_thread_pool(workers: Option<usize>) -> rayon::ThreadPool {
 /// Fails only when a clone pass of `config.passes` fails; without one,
 /// `run(&config).unwrap()` never panics.
 pub fn run(config: &RunConfig) -> Result<RunResult, RunError> {
+    run_excluding(config, &[])
+}
+
+/// [`run`], leaving out the folders `exclude_dirs` (see
+/// [`crate::walker::walk_excluding`]).
+pub fn run_excluding(config: &RunConfig, exclude_dirs: &[PathBuf]) -> Result<RunResult, RunError> {
     let pool = build_thread_pool(config.workers);
 
     // 1-2. Walk + tokenize.
-    let PreparedScan {
-        sources: source_files,
-        prepared: prepared_sources,
-    } = prepare_scan_in(&pool, config);
+    let (source_files, prepared_sources) = prepare_files_in(&pool, config, exclude_dirs)
+        .into_iter()
+        .fold(
+            (Vec::new(), Vec::new()),
+            |(mut ss, mut ps): (Vec<SourceFile>, Vec<PreparedSource>), file| {
+                ss.extend(file.sources);
+                ps.extend(file.prepared);
+                (ss, ps)
+            },
+        );
 
     // Function signatures must be taken before the pools consume the
     // prepared sources; empty unless --similarity is set.
@@ -285,7 +294,7 @@ pub fn canonicalize_all(paths: &[std::path::PathBuf]) -> Vec<std::path::PathBuf>
 /// [`run`]; callers that need to keep prepared sources around (e.g. the MCP
 /// server's snippet checks) use it directly and run detection themselves.
 pub fn prepare_scan_in(pool: &rayon::ThreadPool, config: &RunConfig) -> PreparedScan {
-    let (sources, prepared) = prepare_files_in(pool, config).into_iter().fold(
+    let (sources, prepared) = prepare_files_in(pool, config, &[]).into_iter().fold(
         (Vec::new(), Vec::new()),
         |(mut ss, mut ps): (Vec<SourceFile>, Vec<PreparedSource>), file| {
             ss.extend(file.sources);
@@ -322,14 +331,18 @@ pub fn walk_config(config: &RunConfig) -> WalkConfig {
         formats_exts: config.formats_exts.clone(),
         formats_names: config.formats_names.clone(),
         pattern: config.pattern.clone(),
-        exclude_dirs: config.exclude_dirs.clone(),
     }
 }
 
-/// [`prepare_scan_in`], file by file.
-pub fn prepare_files_in(pool: &rayon::ThreadPool, config: &RunConfig) -> Vec<PreparedFile> {
+/// [`prepare_scan_in`], file by file, leaving out the folders `exclude_dirs`
+/// (see [`crate::walker::walk_excluding`]).
+pub fn prepare_files_in(
+    pool: &rayon::ThreadPool,
+    config: &RunConfig,
+    exclude_dirs: &[PathBuf],
+) -> Vec<PreparedFile> {
     // 1. Walk files
-    let discovered = walk(&walk_config(config));
+    let discovered = walk_excluding(&walk_config(config), exclude_dirs);
 
     // 2. Read + tokenize files in parallel.
     use rayon::prelude::*;
```

**File**: `rust/crates/cpd-finder/src/walker.rs` (modified, +126/-12)
```diff
@@ -23,10 +23,6 @@ pub struct WalkConfig {
     pub formats_exts: HashMap<String, Vec<String>>,
     pub formats_names: HashMap<String, Vec<String>>,
     pub pattern: Option<String>,
-    /// Folders the walk leaves out, whole: `--lsp` gives each nested project
-    /// its own scan. Absolute paths, compared with the walked paths of an
-    /// absolute root.
-    pub exclude_dirs: Vec<PathBuf>,
 }
 
 #[derive(Debug)]
@@ -105,9 +101,16 @@ fn build_ignore_glob_set(patterns: &[String]) -> GlobSet {
 }
 
 pub fn walk(config: &WalkConfig) -> Vec<DiscoveredFile> {
+    walk_excluding(config, &[])
+}
+
+/// [`walk`], leaving out the folders `exclude_dirs` whole: `--lsp` gives each
+/// nested project a scan of its own. The folders are absolute paths,
+/// compared with the walked paths of an absolute root.
+pub fn walk_excluding(config: &WalkConfig, exclude_dirs: &[PathBuf]) -> Vec<DiscoveredFile> {
     let mut results = Vec::new();
     for root in &config.paths {
-        walk_one(root, config, &mut results);
+        walk_one(root, config, exclude_dirs, &mut results);
     }
     if config.follow_symlinks || config.paths.len() > 1 {
         dedup_by_real_path(&mut results);
@@ -142,13 +145,18 @@ fn anchor_at_root(path: &Path, root: &Path, root_canon: &Path) -> PathBuf {
     }
 }
 
-fn walk_one(root: &Path, config: &WalkConfig, results: &mut Vec<DiscoveredFile>) {
+fn walk_one(
+    root: &Path,
+    config: &WalkConfig,
+    exclude_dirs: &[PathBuf],
+    results: &mut Vec<DiscoveredFile>,
+) {
     let mut builder = WalkBuilder::new(root);
     builder.follow_links(config.follow_symlinks);
     builder.git_ignore(!config.no_gitignore);
     builder.hidden(false);
-    if !config.exclude_dirs.is_empty() {
-        let excluded = config.exclude_dirs.clone();
+    if !exclude_dirs.is_empty() {
+        let excluded = exclude_dirs.to_vec();
         builder.filter_entry(move |entry| !excluded.iter().any(|dir| entry.path() == dir));
     }
 
@@ -266,10 +274,11 @@ fn walk_one(root: &Path, config: &WalkConfig, results: &mut Vec<DiscoveredFile>)
 }
 
 /// Whether a walk with `config` would take the file at `path`, under the scan
-/// root `root`, and in which format. The format filters, `--pattern` and
-/// `--ignore` apply; `.gitignore`, the size limit and symlinks do not: a
-/// language server asks this about a file an editor has open, which may not
-/// even be on disk yet.
+/// root `root`, and in which format: the format filters, `--pattern`,
+/// `--ignore`, the ignore files (see [`ignored_by_files`]) and, for a file on
+/// disk, the size limit. A language server asks this about a file an editor
+/// has open, which may not be on disk yet, and about files that appear
+/// while it runs.
 pub fn accepts(path: &Path, root: &Path, config: &WalkConfig) -> Option<String> {
     if let Some(pattern) = config.pattern.as_deref() {
         let set = build_positive_glob_set(pattern);
@@ -288,9 +297,88 @@ pub fn accepts(path: &Path, root: &Path, config: &WalkConfig) -> Option<String>
     if !ignore.is_empty() && ignore.is_match(path) {
         return None;
     }
+    if let Some(max) = config.max_size
+        && std::fs::metadata(path).is_ok_and(|meta| meta.len() > max)
+    {
+        return None;
+    }
+    if ignored_by_files(path, root, false, config.no_gitignore) {
+        return None;
+    }
     Some(format)
 }
 
+/// Whether the ignore files leave `path` out of a walk from `root`, as they
+/// do in the walk itself: `.ignore` files, and inside a git repository its
+/// `.gitignore` files and `.git/info/exclude` (unless `no_gitignore`). A
+/// walk checks every entry below its root and skips an ignored folder whole,
+/// so the folders between `root` and `path` count as well as `path`; `root`
+/// itself and the folders above it do not. The nearest ignore file decides,
+/// and `.ignore` beats `.gitignore` in one folder.
+pub fn ignored_by_files(path: &Path, root: &Path, is_dir: bool, no_gitignore: bool) -> bool {
+    us
```

**File**: `rust/crates/cpd/src/cli.rs` (modified, +1/-1)
```diff
@@ -476,7 +476,7 @@ pub struct Cli {
     /// edits, updated as the text changes. Clones by default; --lsp-analyses
     /// picks the analyses. Each .jscpd.json in the workspace is a project of
     /// its own
-    #[arg(long, conflicts_with_all = ["mcp", "compare", "dashboard", "health", "history", "history_since"])]
+    #[arg(long, conflicts_with_all = ["mcp", "compare", "dashboard", "health", "history", "history_since", "config", "paths"])]
     pub lsp: bool,
 
     /// The analyses --lsp runs, comma-separated: clones, ast (similar
```

**File**: `rust/crates/cpd/src/dead_code.rs` (modified, +42/-17)
```diff
@@ -77,6 +77,27 @@ pub fn config(
     paths: &[PathBuf],
     strict: bool,
 ) -> Result<Option<BastaConfig>, i32> {
+    let mut notes = Vec::new();
+    let config = config_noting(cli, opts, paths, strict, true, &mut notes);
+    for note in notes {
+        eprintln!("{note}");
+    }
+    config.map_err(|()| 1)
+}
+
+/// [`config`], with its errors and warnings (`Error: …`, `Warning: …`) in
+/// `notes` rather than on stderr, for `--lsp`, whose output is the
+/// protocol's. Without `rust`, Rust diagnostics are left out: the language
+/// server leaves Rust to rust-analyzer, and a `-` for them would read the
+/// protocol's stdin.
+pub(crate) fn config_noting(
+    cli: &Cli,
+    opts: &Options,
+    paths: &[PathBuf],
+    strict: bool,
+    rust: bool,
+    notes: &mut Vec<String>,
+) -> Result<Option<BastaConfig>, ()> {
     // A bad --dead-code-categories or --min-confidence is a refusal (or, for
     // confidence, a clamp-with-warning) whether or not a dead-code section
     // ends up running at all: they are the same option misused, not a
@@ -92,8 +113,8 @@ pub fn config(
         match raw.parse::<Category>() {
             Ok(category) => categories.push(category),
             Err(message) => {
-                eprintln!("Error: --dead-code-categories: {message}");
-                return Err(1);
+                notes.push(format!("Error: --dead-code-categories: {message}"));
+                return Err(());
             }
         }
     }
@@ -107,9 +128,9 @@ pub fn config(
     // so the same clamp belongs here too.
     let min_confidence = match cli.min_confidence.or(opts.min_confidence) {
         Some(value) if value > 100 => {
-            eprintln!(
+            notes.push(format!(
                 "Warning: --min-confidence: {value} is above 100, which would hide every finding; using 100"
-            );
+            ));
             100
         }
         Some(value) => value,
@@ -126,21 +147,21 @@ pub fn config(
         .cloned()
         .partition(|f| supported.contains(&f.as_str()));
     if strict && !skipped.is_empty() {
-        eprintln!(
+        notes.push(format!(
             "Warning: --dead-code does not analyze {}; it supports {}",
             skipped.join(", "),
             supported.join(", ")
-        );
+        ));
     }
     if !opts.formats.is_empty() && formats.is_empty() {
         if !strict {
             return Ok(None);
         }
-        eprintln!(
+        notes.push(format!(
             "Error: --format selected no format --dead-code can analyze (supported: {})",
             supported.join(", ")
-        );
-        return Err(1);
+        ));
+        return Err(());
     }
 
     // jscpd has no flags of its own for frameworks; the config file's
@@ -156,9 +177,9 @@ pub fn config(
     });
     if !problems.is_empty() {
         for problem in problems {
-            eprintln!("Error: dead-code frameworks: {problem}");
+            notes.push(format!("Error: dead-code frameworks: {problem}"));
         }
-        return Err(1);
+        return Err(());
     }
 
     Ok(Some(BastaConfig {
@@ -189,7 +210,10 @@ pub fn config(
         formats,
         formats_exts: opts.formats_exts.clone(),
         // A file only: jscpd's stdin is not basta's to read.
-        rust_diagnostics: rust_diagnostics(cli, opts)?,
+        rust_diagnostics: match rust {
+            true => rust_diagnostics(cli, opts, notes)?,
+            false => None,
+        },
     }))
 }
 
@@ -199,7 +223,8 @@ pub fn config(
 fn rust_diagnostics(
     cli: &Cli,
     opts: &Options,
-) -> Result<Option<basta::config::RustDiagnostics>, i32> {
+    notes: &mut Vec<String>,
+) -> Result<Option<basta::config::RustDiagnostics>, ()> {
     let (path, what) = match (
         &cli.rust_diagnostics,
         &opts.dead_code_section.rust_diagnostics,
@@ -213,8 +238,8 @@ fn rust_diagnostics(
         return match std::io::Read::read_to_string(&mut std::io::stdin(), &mut text) {
             Ok(_) => Ok(S
```

---

### Incident Patch 4: `f941b05e` (2026-09-30)
**Commit Message**: fix(lsp): allFiles covers dead code, broken configs show, two action details

- allFiles publishes the files with dead code or semantic pairs too, not
  only the files with clones.
- A .jscpd.json that is not valid JSON still leaves its project on the
  defaults, but the editor now shows the parse error.
- A semantic pair offers "Go to the similar function", like an ast pair.
- "Ignore this clone" at the end of a file counts the last column in
  UTF-8 when the client asked for it.

**File**: `rust/crates/cpd/src/lsp/project.rs` (modified, +45/-5)
```diff
@@ -133,18 +133,33 @@ impl Project {
             .or_else(|| plan.roots.first().cloned())
             .unwrap_or_default();
         let config_path = base.join(CONFIG_NAME);
+        // A file that does not parse, often one the user is typing into,
+        // leaves the project on the defaults and says why.
+        let mut unparsed = None;
         let mut value = match &plan.config_dir {
-            Some(dir) => std::fs::read_to_string(dir.join(CONFIG_NAME))
-                .ok()
-                .and_then(|text| serde_json::from_str(&text).ok())
-                .unwrap_or_else(|| serde_json::json!({})),
+            Some(_) => match std::fs::read_to_string(&config_path)
+                .map_err(|e| (None, e.to_string()))
+                .and_then(|text| {
+                    serde_json::from_str(&text).map_err(|e| (Some(e.line()), e.to_string()))
+                }) {
+                Ok(value) => value,
+                Err((line, error)) => {
+                    unparsed = Some(ConfigDiagnostic::ParseError {
+                        source: config_path.clone(),
+                        line,
+                        error,
+                    });
+                    serde_json::json!({})
+                }
+            },
             None => serde_json::json!({}),
         };
         if !value.is_object() {
             value = serde_json::json!({});
         }
         merge_json(&mut value, settings);
-        let result = config_from_json(value, &config_path, &base);
+        let mut result = config_from_json(value, &config_path, &base);
+        result.diagnostics.extend(unparsed);
         let refused = result
             .diagnostics
             .iter()
@@ -336,4 +351,29 @@ mod tests {
             serde_json::json!({"minTokens": 30, "lsp": {"clones": {"enabled": true}, "complexity": {"enabled": true}}})
         );
     }
+
+    #[test]
+    fn a_config_that_does_not_parse_leaves_the_defaults_and_says_why() {
+        use clap::Parser;
+        let dir = std::env::temp_dir().join(format!("jscpd-lsp-unparsed-{}", std::process::id()));
+        std::fs::create_dir_all(&dir).unwrap();
+        std::fs::write(dir.join(CONFIG_NAME), "{\n  \"minTokens\": 20,\n}\n").unwrap();
+        let cli = Cli::parse_from(["jscpd", "--lsp"]);
+        let plan = Plan {
+            config_dir: Some(dir.clone()),
+            roots: vec![dir.clone()],
+            excluded: Vec::new(),
+        };
+        let project = Project::new(plan, &cli, &[Analysis::Clones], &serde_json::json!({}));
+        assert_eq!(project.options.min_tokens, 50, "the defaults");
+        assert!(
+            matches!(
+                project.diagnostics.as_slice(),
+                [ConfigDiagnostic::ParseError { line: Some(3), .. }]
+            ),
+            "{:?}",
+            project.diagnostics
+        );
+        let _ = std::fs::remove_dir_all(dir);
+    }
 }
```

**File**: `rust/crates/cpd/src/lsp/server.rs` (modified, +32/-20)
```diff
@@ -12,7 +12,7 @@ use super::index::ScanIndex;
 use super::position::{Encoding, path_to_uri, uri_to_path};
 use super::project::{CONFIG_NAME, Project, find_config_dirs, plan};
 use super::settings::Analysis;
-use crate::cli::Cli;
+use crate::cli::{Cli, ConfigDiagnostic};
 use crossbeam_channel::{Receiver, Sender};
 use lsp_server::{Connection, ErrorCode, Message, Notification, Request, RequestId, Response};
 use lsp_types::notification::Notification as _;
@@ -305,14 +305,23 @@ impl Server {
             .collect();
         for project in &mut self.projects {
             for diagnostic in &project.diagnostics {
-                let _ = self
-                    .sender
-                    .send(notify::<lsp_types::notification::LogMessage>(
-                        lsp_types::LogMessageParams {
+                // A config that does not parse is left out as a whole, which
+                // the user has to see; the rest goes to the log.
+                let message = match diagnostic {
+                    ConfigDiagnostic::ParseError { .. } => {
+                        notify::<lsp_types::notification::ShowMessage>(ShowMessageParams {
+                            typ: MessageType::WARNING,
+                            message: format!("jscpd: {diagnostic}; using the defaults"),
+                        })
+                    }
+                    _ => {
+                        notify::<lsp_types::notification::LogMessage>(lsp_types::LogMessageParams {
                             typ: MessageType::WARNING,
                             message: diagnostic.to_string(),
-                        },
-                    ));
+                        })
+                    }
+                };
+                let _ = self.sender.send(message);
             }
             if let Some(reason) = &project.refused {
                 let _ = self
@@ -635,13 +644,13 @@ impl Server {
             if !project.analyses.all_files {
                 continue;
             }
-            if let Some(index) = &project.index {
-                for clone in index.clones() {
-                    for fragment in [&clone.fragment_a, &clone.fragment_b] {
-                        files.insert(PathBuf::from(super::index::host_file(&fragment.source_id)));
-                    }
+            let clones = project.index.iter().flat_map(|index| index.clones());
+            for clone in clones.chain(project.semantic.iter()) {
+                for fragment in [&clone.fragment_a, &clone.fragment_b] {
+                    files.insert(PathBuf::from(super::index::host_file(&fragment.source_id)));
                 }
             }
+            files.extend(project.dead_code.iter().map(|(path, _)| path.clone()));
         }
         let stale: Vec<PathBuf> = self
             .published
@@ -943,7 +952,9 @@ impl Server {
         for finding in self.findings_at(uri, params.range) {
             for target in &finding.targets {
                 let title = match finding.analysis {
-                    Analysis::Ast => format!("Go to the similar function in {}", target.label),
+                    Analysis::Ast | Analysis::Semantic => {
+                        format!("Go to the similar function in {}", target.label)
+                    }
                     _ => format!("Go to the other copy in {}", target.label),
                 };
                 actions.push(CodeActionOrCommand::CodeAction(CodeAction {
@@ -981,13 +992,14 @@ impl Server {
         let after = finding.last_line + 1;
         let end = match (after as usize) < text.index.line_count() {
             true => Position::new(after, 0),
-            false => Position::new(
-                finding.last_line,
-                text.index
-                    .line(&text.text, finding.last_line as usize)
-                    .encode_utf16()
-                    .count() as u32,
-            ),
+            false => {
+                let last = text.index.line(&text.text, finding.last_line as u
```

---

### Incident Patch 5: `68a0ec7e` (2026-09-29)
**Commit Message**: fix(compare): review fixes for the html page

The map:
- the wheel scrolls the page past a tall map again; Ctrl or Cmd with
  the wheel (a trackpad pinch too) zooms it, and so do new - and +
  buttons beside "Fit the map". On a phone a vertical swipe scrolls
  the page and a pinch zooms it.
- past 1,500 marks it asks for bigger marks or the table instead of
  laying them out: the layout compares every two marks of a side, so
  4,000 functions a side froze the tab for 20 s. It no longer measures
  the toolbar on every filter change, a forced reflow after drawing
  thousands of elements, and a resize that keeps the width keeps the
  map and its zoom.
- typing a search clears the selected mark, so the hits light up.
- a click on a function ready to port shows the whole map and jumps to
  the mark itself, not to the middle of a tall map.

The table: the code and the tests of one file sort code first, so the
rows of each form one group, and no two marks tie. A sort keeps the
focus on its header, "Show all" hands it to the first new row, and the
rows of "Ready to port" open with Enter or Space.

Elsewhere: the detail names a side given as one file once (the data
says which sides are file

**File**: `docs/rust.md` (modified, +1/-1)
```diff
@@ -688,7 +688,7 @@ Reporters: `console` (the default), `console-full` (adds the list of every pair,
 
 A function is ready to port when it has no counterpart yet and everything it calls has one, so porting it waits for nothing. The JSON report lists these per side as `readyToPort`, each with the number of functions that call it, most called first. jscpd finds calls by name, the way `--semantic` does: a name followed by `(` in a function's code calls the functions of the same side with that name, in a language that can call it. A function in the caller's own file wins, and a name that more than three functions carry is too common to follow. Two unported functions that call each other wait for each other, so neither is ready.
 
-`-r html` writes `jscpd-compare.html`, a page that works offline, with its styles, script and data in the one file. Two tabs at the top show the comparison as a map or as a table, and the filters under them apply to both: code, tests, or both; one mark per folder, file or function; and a search. The address keeps the tab, so a link that ends in `#table` opens the table. The map draws the two sides as dependency graphs facing each other across a channel, the source in orange on the left and the target in green on the right, with a dotted bridge for every pair. A mark is a folder, a file or a function; the page picks the level by size, and a control switches it. Code is a circle and tests are a square. With both shown, thin lines tie each test to the code it calls; the page opens with both when there are tests. A mark fills from the bottom as its functions find counterparts: it is empty when none has one and full when all have. Its place says the same: a ported mark lines the channel, facing its counterpart, and one with nothing ported keeps to the far edge. Thin gray lines are calls within a side. The color of a bridge is the mean similarity of its pairs, light blue at 0.40 and dark blue at 1.00, and a bridge is thicker for more pairs. The dark theme turns the blue scale around, so the closest pairs stay the easiest to see. A dark ring marks the source functions ready to port. Hovering a mark lights up what it calls and what it pairs with, and clicking it lists its functions with their counterparts, calls and callers. The table lists the same bridges as rows: the source mark on the left, the similarity of the bridge in the middle, the target mark on the right, and a status (ported, partly ported, ready to port, not ported, or only in the target). A mark with no bridge gets a row of its own. In the order of one side, the rows of a mark form a group, so its name shows once. A click on a column header sorts the table by it, and a click on a row opens the pairs behind it with what its source mark still lacks, or, for a function, its pairs, calls and callers. Below both views, the page lists the functions ready to port, charts the similarity of the pairs by level, and shows the progress of every folder on both sides, all for what the filters select.
+`-r html` writes `jscpd-compare.html`, a page that works offline, with its styles, script and data in the one file. Two tabs at the top show the comparison as a map or as a table, and the filters under them apply to both: code, tests, or both; one mark per folder, file or function; and a search. The address keeps the tab, so a link that ends in `#table` opens the table. The map draws the two sides as dependency graphs facing each other across a channel, the source in orange on the left and the target in green on the right, with a dotted bridge for every pair. A mark is a folder, a file or a function; the page picks the level by size, and a control switches it. Past 1,500 marks the map asks for bigger marks or the table rather than drawing them. Code is a circle and tests are a square. With both shown, thin lines tie each test to the code it calls; the page opens with both when there are tests. A mark fills from the bottom as its functions find counterparts: it is
```

**File**: `rust/crates/cpd/src/compare/html.rs` (modified, +6/-0)
```diff
@@ -34,6 +34,10 @@ struct Page<'a> {
     model: &'a str,
     /// The two paths as given on the command line.
     sides: [&'a str; 2],
+    /// Whether each side is a single file rather than a folder: its files
+    /// are then named by their file name alone.
+    #[serde(rename = "sideIsFile")]
+    side_is_file: [bool; 2],
     /// `(side, path relative to the side's folder)`.
     files: Vec<(usize, String)>,
     /// `(file, name, first line, last line, flags)`; flags add up
@@ -104,6 +108,7 @@ pub(super) fn page(
         version: env!("CARGO_PKG_VERSION"),
         model,
         sides: paths,
+        side_is_file: root_is_file,
         files,
         functions,
         pairs,
@@ -131,6 +136,7 @@ mod tests {
             version: "0.0.0",
             model: "stand-in",
             sides: ["java/", "python/"],
+            side_is_file: [false, false],
             files: vec![(0, "QrCode.java".into()), (1, "qrcodegen.py".into())],
             functions: vec![
                 (0, "drawVersion", 10, 20, COUNTED),
```

**File**: `rust/crates/cpd/src/compare/page.html` (modified, +160/-30)
```diff
@@ -10,7 +10,7 @@
    and target), and how alike a pair is (one blue ramp, light for 0.40 and
    dark for 1.00 in the light theme; the map reads it continuously and the
    histogram in three levels). */
-.viz-root {
+:root {
   color-scheme: light;
   --page: #f9f9f7;
   --surface: #fcfcfb;
@@ -28,7 +28,7 @@
   --dep: #898781;
 }
 @media (prefers-color-scheme: dark) {
-  :root:where(:not([data-theme="light"])) .viz-root {
+  :root:where(:not([data-theme="light"])) {
     color-scheme: dark;
     --page: #0d0d0d;
     --surface: #1a1a19;
@@ -46,7 +46,7 @@
     --dep: #898781;
   }
 }
-:root[data-theme="dark"] .viz-root {
+:root[data-theme="dark"] {
   color-scheme: dark;
   --page: #0d0d0d;
   --surface: #1a1a19;
@@ -184,7 +184,11 @@
   border-radius: 12px;
   overflow: hidden;
 }
-#map { display: block; width: 100%; cursor: grab; touch-action: none; }
+/* A vertical swipe scrolls the page and a pinch zooms it; a sideways drag
+   moves the map. */
+#map { display: block; width: 100%; cursor: grab; touch-action: pan-y pinch-zoom; }
+.zoom { display: inline-flex; gap: 6px; }
+.zoom .plain-button { min-width: 34px; }
 #map.panning { cursor: grabbing; }
 .channel { fill: var(--page); }
 .dep { stroke: var(--dep); stroke-width: 1; opacity: 0.35; fill: none; }
@@ -415,7 +419,11 @@ <h1 class="shore-name" id="target-name"></h1>
       </div>
     </div>
     <input class="search" id="search" type="search" placeholder="Find a file or function" aria-label="Find a file or function">
-    <button type="button" class="plain-button" id="fit">Fit the map</button>
+    <div class="zoom" id="zoom-control" role="group" aria-label="Zoom the map">
+      <button type="button" class="plain-button" id="zoom-out" aria-label="Zoom out" title="Zoom out">&minus;</button>
+      <button type="button" class="plain-button" id="fit">Fit the map</button>
+      <button type="button" class="plain-button" id="zoom-in" aria-label="Zoom in" title="Zoom in">+</button>
+    </div>
   </nav>
   </div>
 
@@ -513,6 +521,7 @@ <h2>Progress by folder</h2>
   const pct = (part, whole) => (whole === 0 ? 0 : Math.floor((part / whole) * 100));
 
   const hasTests = fns.some((f) => f.test && f.counted);
+  const sideIsFile = DATA.sideIsFile || [false, false];
 
   function kindStats(test) {
     const out = [{ n: 0, paired: 0, ready: 0 }, { n: 0, paired: 0, ready: 0 }];
@@ -775,6 +784,10 @@ <h2>Progress by folder</h2>
   let zoom = { k: 1, x: 0, y: 0 };
   const layouts = new Map();
   let drawn = false;
+  // Past this many marks the layout takes seconds and draws a blur, so the
+  // map asks for bigger marks or the table instead; `view` is null then.
+  const MAX_MARKS = 1500;
+  let declined = 0;
 
   function el(name, attrs, parent) {
     const node = document.createElementNS(SVG, name);
@@ -840,6 +853,14 @@ <h2>Progress by folder</h2>
     const key = state.kind + "/" + state.lod;
     const width = Math.max(640, svg.parentElement.clientWidth);
     const v = getView(state.kind, state.lod);
+    zoom = { k: 1, x: 0, y: 0 };
+    if (v.nodes.length > MAX_MARKS) {
+      view = null;
+      declined = v.nodes.length;
+      geometry = { W: width, H: 360 };
+      drawMap();
+      return;
+    }
     let entry = layouts.get(key);
     if (!entry || entry.W !== width) {
       // The circles that line the channel stand one above another, so
@@ -867,7 +888,6 @@ <h2>Progress by folder</h2>
     }
     view = v;
     geometry = { W: entry.W, H: entry.H };
-    zoom = { k: 1, x: 0, y: 0 };
     drawMap();
   }
 
@@ -878,6 +898,17 @@ <h2>Progress by folder</h2>
     svg.setAttribute("aria-label", "Dependency map: " + DATA.sides[0] + " on the left, " + DATA.sides[1] +
       " on the right, code as circles and tests as squares, with a dotted bridge for every pair. The Table tab lists the same data.");
     const vp = el("g", { id: "viewport" }, svg);
+    if (!view) {
+      const one = { functions: "function", files: "file", folders: "folder" }[state.lod];
+      const nex
```

---

### Incident Patch 6: `f7537dd4` (2026-09-29)
**Commit Message**: fix(compare): a port not started yet gets its calls, so only leaves are ready

compare() returned before it built the call graph when one side had no
functions, so Comparison::ready saw no calls and marked every counted
function of the other side ready to port. The first run of a port, with
an empty target, is where that list helps most. The call graph needs no
model, so it is now built before that return: on QR-Code-generator's
Java against an empty folder, 11 of 41 functions are ready (the ones
that call no other function of the side), not all 41.

The html page also names the sides as the other reports do, so a path
that is not UTF-8 no longer shows as an empty name, and html.rs tells a
pair found by name by its MatchedBy variant rather than its string.

**File**: `rust/crates/cpd-semantic/src/compare.rs` (modified, +22/-3)
```diff
@@ -255,22 +255,24 @@ pub fn compare(
             });
         }
     }
+    let unit = |item: &Item| -> &SemanticUnit { &flat[item.source].2.units[item.unit] };
+    // The calls need no model, so a port not started yet has them too: with
+    // nothing paired, they alone say which functions to port first.
+    let calls = call_graph(&items, unit, |i| functions[i].side);
     let both_sides = [0, 1].map(|side| functions.iter().any(|f| f.side == side));
     if both_sides.contains(&false) {
         return Ok(Comparison {
             functions,
             pairs: Vec::new(),
-            calls: Vec::new(),
+            calls,
         });
     }
 
-    let unit = |item: &Item| -> &SemanticUnit { &flat[item.source].2.units[item.unit] };
     let texts: Vec<&str> = items.iter().map(|item| unit(item).text.as_str()).collect();
     let vectors = embedder.embed(&texts)?;
     let space = VectorSpace::new(&vectors, texts.len())?;
     let grammars = grammar_ids(&items, |item| unit(item).grammar);
     let related = call_pairs(&items, unit);
-    let calls = call_graph(&items, unit, |i| functions[i].side);
 
     // Step 1: the rule of --semantic, across the sides, between functions
     // that count.
@@ -1157,6 +1159,23 @@ mod tests {
         );
     }
 
+    #[test]
+    fn a_port_not_started_yet_is_ready_from_its_leaves() {
+        // The target is empty, so nothing pairs; the function that calls
+        // nothing is ready and its caller waits for it.
+        let java = vec![source(
+            "java/A.java",
+            "java",
+            vec![
+                with_text(unit("java", "run", 1, 9, 60), "void run() { helper(); }"),
+                with_text(unit("java", "helper", 20, 9, 60), "void helper() {}"),
+            ],
+        )];
+        let result = compare([&java, &[]], &table(&[]), &PARAMS).unwrap();
+        assert_eq!(result.calls, vec![(0, 1)]);
+        assert_eq!(result.ready(), vec![false, true]);
+    }
+
     #[test]
     fn a_function_is_ready_when_all_it_calls_is_ported() {
         let f = |side, counted| FunctionRef {
```

**File**: `rust/crates/cpd/src/compare/html.rs` (modified, +2/-2)
```diff
@@ -12,7 +12,7 @@
 //! both) from it.
 
 use super::describe;
-use cpd_semantic::compare::{Comparison, Level};
+use cpd_semantic::compare::{Comparison, Level, MatchedBy};
 use cpd_semantic::search::UnitSource;
 use serde::Serialize;
 use std::collections::HashMap;
@@ -96,7 +96,7 @@ pub(super) fn page(
                 Level::High => 2,
             };
             let similarity = (f64::from(pair.similarity) * 1000.0).round() / 1000.0;
-            let by_name = u8::from(pair.matched_by.as_str() == "name");
+            let by_name = u8::from(matches!(pair.matched_by, MatchedBy::Name));
             (pair.a, pair.b, similarity, level, by_name)
         })
         .collect();
```

**File**: `rust/crates/cpd/src/compare/mod.rs` (modified, +3/-7)
```diff
@@ -105,15 +105,11 @@ pub fn run(opts: &Options, paths: &[PathBuf], run_config: &RunConfig) -> Result<
     let comparison = pool
         .install(|| compare([&sides[0], &sides[1]], embedder.as_ref(), &params))
         .map_err(|e| fatal(format!("--compare: {e}")))?;
-    let report = Report::new(
-        [left, right].map(|p| p.display().to_string()),
-        &roots,
-        &sides,
-        &comparison,
-    );
+    let names = [left, right].map(|p| p.display().to_string());
+    let report = Report::new(names.clone(), &roots, &sides, &comparison);
     let page = || {
         html::page(
-            [left, right].map(|p| p.to_str().unwrap_or_default()),
+            [names[0].as_str(), names[1].as_str()],
             &roots,
             &sides,
             &comparison,
```

---

### Incident Patch 7: `c3f689c5` (2026-09-29)
**Commit Message**: fix(compare): review fixes for test detection and test-case names

From a review of the PR:

- #[cfg(not(test))] and #[cfg(feature = "test-util")] modules are code:
  a cfg condition is a test only when it names `test` as a predicate,
  outside not(…) and outside a string. A file that starts with
  #![cfg(test)] is tests, and so is #[test] fn on one line.
- A test case needs a string title after the call, so a method named
  test (`test(input) { … }`) stays code, and Playwright's test.describe
  and test.step are not test cases.
- A test title goes to the callback alone: a named function-expression
  callback no longer leaves it for the next arrow, and an arrow in
  test.each(table) no longer takes it or the callback's head.
- The `test` marker is stripped from test names only, and only as
  test_, testX or TestX, so testConnection keeps its name and the title
  "tests the rounding" its words.
- In --semantic a test's title is no callable name: a test titled after
  the function it calls still counts as its caller, and callers of that
  function are not related to the test.
- Module links for the name step are counted for tests and code apart.
  On fs-extra this pairs four more cod

**File**: `docs/rust.md` (modified, +1/-1)
```diff
@@ -655,7 +655,7 @@ Only in python (1):
 
 The report has a block for the code and one for the tests, and each shows both directions. A port reads the first line of a block as its progress and "Only in python", the source, as the work left. A parity check reads both lines and both "Only in" lists. Each file gets the number of its functions that have a counterpart, the mean similarity of their pairs, and the file on the other side that holds most of them.
 
-Tests and code are measured apart, and a test pairs only with a test, so a port's tests and its code each get a percentage of their own. jscpd tells a test by the conventions of its language. A file is a test file when its name or a folder on its path says so: `*_test.go`, `test_*.py`, `*_test.py`, `*.test.ts`, `*.spec.js`, `*Test.java`, `*Tests.kt`, `*Tests.swift`, `*Tests.cs`, `*Spec.scala`, `*_spec.rb`, a Rust `tests.rs`, or a folder such as `tests/`, `__tests__/`, `spec/`, `src/test/`, `androidTest/`, `MyAppTests/` or `MyApp.Tests/`. The folder given on the command line counts, so `jscpd --compare node/test rust/tests` compares tests. Inside a code file, a Rust function in a `#[cfg(test)]` module or under a test attribute (`#[test]`, `#[tokio::test]`, `#[rstest]`) is a test, and so is a JavaScript or TypeScript test case such as `it('rounds cents', () => …)`. Without tests on either side, the report has no headings and reads as the code alone.
+Tests and code are measured apart, and a test pairs only with a test, so a port's tests and its code each get a percentage of their own. jscpd tells a test by the conventions of its language. A file is a test file when its name or a folder on its path says so: `*_test.go`, `test_*.py`, `*_test.py`, `*.test.ts`, `*.spec.js`, `*Tests.swift`, `*Tests.cs`, `*_spec.rb`, a Rust `tests.rs`, or a folder such as `tests/`, `__tests__/`, `spec/`, `src/test/`, `androidTest/`, `MyAppTests/` or `MyApp.Tests/`. Java, Kotlin and Scala tests are found by their folder (`src/test/`): a singular `Test` or `Spec` at the end of a file name is left alone, since `ABTest.java` and `OpenApiSpec.ts` are usually code. The folder given on the command line counts, so `jscpd --compare node/test rust/tests` compares tests. Inside a code file, a Rust function in a `#[cfg(test)]` module (not `#[cfg(not(test))]`), in a file that starts with `#![cfg(test)]`, or under a test attribute (`#[test]`, `#[tokio::test]`, `#[rstest]`) is a test, and so is a JavaScript or TypeScript test case such as `it('rounds cents', () => …)`. Playwright's `test.describe` and `test.step`, and a method that happens to be named `test`, are not. Without tests on either side, the report has no headings and reads as the code alone.
 
 "Paired under other names" lists the pairs whose names differ even once case and underscores are ignored: renamed ports, constructors (`QrCode` and `__init__`), and platform names (`startWatch` and `watchPosition`). These are the pairs nobody finds by searching for a name, so the default console report shows them, and `console-full` lists every pair.
 
```

**File**: `rust/crates/cpd-semantic/src/compare.rs` (modified, +55/-28)
```diff
@@ -285,32 +285,36 @@ pub fn compare(
     // Step 2: namesakes among the functions left unpaired.
     let mut paired = vec![false; functions.len()];
     let mut linked_files: FxHashSet<(u32, u32)> = FxHashSet::default();
-    // Code pairs per module and module of the other side.
-    let mut links: FxHashMap<u32, FxHashMap<u32, usize>> = FxHashMap::default();
+    // Step-1 pairs per module and module of the other side, for tests and
+    // for code apart: tests often sit in folders of their own (`tests/`),
+    // and their pairs must not decide which code modules match.
+    let mut links: FxHashMap<(bool, u32), FxHashMap<u32, usize>> = FxHashMap::default();
     for pair in &pairs {
         paired[pair.a] = true;
         paired[pair.b] = true;
+        let kind = functions[pair.a].test;
         let (ma, mb) = (module_of[pair.a], module_of[pair.b]);
-        *links.entry(ma).or_default().entry(mb).or_default() += 1;
-        *links.entry(mb).or_default().entry(ma).or_default() += 1;
+        *links.entry((kind, ma)).or_default().entry(mb).or_default() += 1;
+        *links.entry((kind, mb)).or_default().entry(ma).or_default() += 1;
         linked_files.insert((items[pair.a].file, items[pair.b].file));
     }
-    // Whether `other` holds the most code pairs of `module` (ties count).
-    let main_link = |module: u32, other: u32| {
-        links.get(&module).is_some_and(|counts| {
+    // Whether `other` holds the most pairs of `module` (ties count).
+    let main_link = |kind: bool, module: u32, other: u32| {
+        links.get(&(kind, module)).is_some_and(|counts| {
             let most = counts.values().copied().max().unwrap_or(0);
             counts.get(&other) == Some(&most)
         })
     };
     let may_pair = |a: usize, b: usize| {
+        let kind = functions[a].test;
         let (ma, mb) = (module_of[a], module_of[b]);
-        main_link(ma, mb)
-            || main_link(mb, ma)
-            || !(links.contains_key(&ma) || links.contains_key(&mb))
+        main_link(kind, ma, mb)
+            || main_link(kind, mb, ma)
+            || !(links.contains_key(&(kind, ma)) || links.contains_key(&(kind, mb)))
     };
     let mut by_name: FxHashMap<String, [Vec<usize>; 2]> = FxHashMap::default();
     for (i, item) in items.iter().enumerate() {
-        let key = name_key(&unit(item).name);
+        let key = name_key(&unit(item).name, functions[i].test);
         if !paired[i] && !key.is_empty() {
             by_name.entry(key).or_default()[side_of(i)].push(i);
         }
@@ -423,19 +427,35 @@ fn modules(files: &[&str]) -> Vec<String> {
 /// A function name with case, underscores, spaces and punctuation ignored,
 /// so the names one function gets in different languages meet:
 /// `encodeBinary`, `encode_binary`, `_encode_binary` and `EncodeBinary` are
-/// all `encodebinary`. A leading `test` goes too, the mark of a test in
-/// pytest, Go, XCTest and JUnit 3 that a JavaScript test title does not
-/// carry: `test_rounds_cents`, `TestRoundsCents` and the test titled
-/// `rounds cents` are all `roundscents`.
-pub fn name_key(name: &str) -> String {
-    let key: String = name
-        .chars()
+/// all `encodebinary`. For a `test`, a leading `test` marker goes too, the
+/// mark of a test in pytest, Go, XCTest and JUnit 3 that a JavaScript test
+/// title does not carry: `test_rounds_cents`, `TestRoundsCents` and the
+/// test titled `rounds cents` are all `roundscents`. The marker is `test`
+/// followed by `_` or a capital, so the title `tests the rounding` keeps
+/// its words, and a code function such as `testConnection` keeps its name.
+pub fn name_key(name: &str, test: bool) -> String {
+    let name = match test {
+        true => strip_test_marker(name),
+        false => name,
+    };
+    name.chars()
         .filter(|c| c.is_alphanumeric())
         .flat_map(char::to_lowercase)
-        .collect();
-    match key.strip_prefix("test") {
-        Some(rest) if !rest.is_empty() => rest.to_stri
```

**File**: `rust/crates/cpd-semantic/src/search.rs` (modified, +39/-2)
```diff
@@ -451,7 +451,8 @@ pub(crate) fn call_pairs<'u>(
     let mut by_name: FxHashMap<&str, Vec<usize>> = FxHashMap::default();
     for (i, item) in items.iter().enumerate() {
         let name = unit(item).name.as_str();
-        if name.chars().count() >= MIN_CALLEE_NAME && !name.starts_with('<') {
+        // A test's name is a title (`it('add', …)`), never called.
+        if name.chars().count() >= MIN_CALLEE_NAME && !name.starts_with('<') && !unit(item).test {
             by_name.entry(name).or_default().push(i);
         }
     }
@@ -463,7 +464,9 @@ pub(crate) fn call_pairs<'u>(
         let own = unit(item);
         let mut seen: rustc_hash::FxHashSet<&str> = rustc_hash::FxHashSet::default();
         for callee in called_names(&own.text) {
-            if callee == own.name || !seen.insert(callee) {
+            // A function's own name in its header or a recursive call is
+            // not a call; a test titled after the function it calls is.
+            if (callee == own.name && !own.test) || !seen.insert(callee) {
                 continue;
             }
             for &j in by_name.get(callee).map(Vec::as_slice).unwrap_or_default() {
@@ -1321,6 +1324,40 @@ mod tests {
         );
     }
 
+    #[test]
+    fn a_test_titled_after_its_subject_still_calls_it() {
+        // `it('compute', () => { compute(1) })`: the title is no function
+        // name, so the call to `compute(` relates the test to `compute`,
+        // and the title is nothing another function can call.
+        let items: Vec<Item> = (0..3)
+            .map(|k| Item {
+                source: 0,
+                unit: k,
+                file: k as u32,
+            })
+            .collect();
+        let units = [
+            unit("oxc", "compute", 1, "function compute(x) { return x * 2 }"),
+            SemanticUnit {
+                test: true,
+                ..unit("oxc", "compute", 1, "it('compute', () => { compute (1) })")
+            },
+            unit(
+                "oxc",
+                "caller",
+                1,
+                "function caller() { return compute(2) }",
+            ),
+        ];
+        let related = call_pairs(&items, |item| &units[item.unit]);
+        assert_eq!(related[1], vec![0], "the test calls compute");
+        assert_eq!(
+            related[2],
+            vec![0],
+            "a caller of compute is not related to the test"
+        );
+    }
+
     #[test]
     fn namesakes_are_not_mistaken_for_caller_and_callee() {
         let related = call_pairs(
```

**File**: `rust/crates/cpd-semantic/src/test_code.rs` (modified, +164/-47)
```diff
@@ -10,19 +10,11 @@
 //! `it('title', () => …)`, which Vitest runs from source files too.
 
 use cpd_core::models::Token;
-use cpd_tokenizer::functions::TEST_CASE_CALLS;
+use cpd_tokenizer::functions::{NOT_TEST_CASES, TEST_CASE_CALLS};
 use std::path::{Component, Path};
 
 /// Folders that hold tests, compared without case.
-const TEST_DIRS: &[&str] = &[
-    "test",
-    "tests",
-    "__tests__",
-    "spec",
-    "specs",
-    "androidtest",
-    "uitests",
-];
+const TEST_DIRS: &[&str] = &["test", "tests", "__tests__", "spec", "specs"];
 
 /// Whether `path` names a test file by the conventions of the languages
 /// jscpd compares. `path` starts at the compared folder itself
@@ -42,12 +34,12 @@ pub fn is_test_path(path: &Path) -> bool {
     dirs.iter().any(|dir| is_test_dir(dir)) || is_test_file(file)
 }
 
-/// `tests`, `__tests__`, `src/test`, and the test targets of Xcode and
-/// .NET: `MyAppTests`, `MyApp.Tests`, `MyApp.UITests`.
+/// `tests`, `__tests__`, `src/test`, Android's `androidTest`, and the test
+/// targets of Xcode and .NET: `MyAppTests`, `MyApp.UITests`, `MyApp.Tests`.
 fn is_test_dir(dir: &str) -> bool {
     let lower = dir.to_ascii_lowercase();
     TEST_DIRS.contains(&lower.as_str())
-        || ["Tests", ".Tests", "Test", ".Test"]
+        || ["Tests", "Test"]
             .iter()
             .any(|suffix| dir.len() > suffix.len() && dir.ends_with(suffix))
 }
@@ -65,11 +57,11 @@ fn is_test_file(file: &str) -> bool {
         || lower_stem.ends_with("_tests")
         || lower_stem.ends_with("_spec")
         || lower_stem == "tests"
-        // CartTest.java, CartTests.swift, CartSpec.scala: a capitalized
-        // suffix after another word, so `Contest` and `Request` stay code.
-        || ["Test", "Tests", "Spec"]
-            .iter()
-            .any(|suffix| stem.len() > suffix.len() && stem.ends_with(suffix))
+        // CartTests.swift, CartTests.cs: a capitalized plural after another
+        // word. The singular `CartTest.java` and `CartSpec.scala` are left
+        // to their folders (`src/test/`): as a name alone they would take
+        // `ABTest.java` and `OpenApiSpec.ts` for tests.
+        || (stem.len() > 5 && stem.ends_with("Tests"))
 }
 
 /// Whether the function of `grammar` found at `head..` in `code` is a test
@@ -91,43 +83,132 @@ pub(crate) fn inline_test(
                 .any(|&(from, to)| from <= start && start < to)
                 || has_test_attribute(code, start)
         }
-        "oxc" => {
-            let rest = code.get(head..).unwrap_or_default();
-            let callee: &str = rest
-                .split(|c: char| !(c.is_alphanumeric() || c == '_' || c == '$'))
-                .next()
-                .unwrap_or_default();
-            let after = rest[callee.len()..].trim_start();
-            TEST_CASE_CALLS.contains(&callee) && (after.starts_with('(') || after.starts_with('.'))
-        }
+        "oxc" => code.get(head..).is_some_and(starts_test_case),
         _ => false,
     }
 }
 
-/// Whether the attributes above the Rust item at `start` include a test
+/// Whether `code` starts with a test-case call: a name from
+/// `TEST_CASE_CALLS`, members and calls after it (`.only`, `.each(table)`),
+/// then `(` and a string title, as in `it('rounds cents', …)`. A method
+/// named `test` (`test(input) { … }`) has no title and is code, and
+/// Playwright's `test.describe(…)` and `test.step(…)` are not test cases.
+fn starts_test_case(code: &str) -> bool {
+    let ident = |text: &str| -> usize {
+        text.find(|c: char| !(c.is_alphanumeric() || c == '_' || c == '$'))
+            .unwrap_or(text.len())
+    };
+    let callee_len = ident(code);
+    if !TEST_CASE_CALLS.contains(&&code[..callee_len]) {
+        return false;
+    }
+    let mut rest = &code[callee_len..];
+    loop {
+        rest = rest.trim_start();
+        if let Some(member) = rest.strip_prefix('.') {
+            let member = member.trim_start();
+            let len = ident(me
```

**File**: `rust/crates/cpd-tokenizer/src/functions.rs` (modified, +59/-17)
```diff
@@ -168,11 +168,15 @@ struct Extractor<'i> {
 
 impl Extractor<'_> {
     fn open(&mut self, name: String, start: u32, end: u32) {
-        let head = self
-            .pending_head
-            .take()
-            .filter(|&(_, value)| value == start)
-            .map_or(start, |(head, _)| head);
+        // Only the function the naming code is about takes its head; one
+        // that opens before it (an arrow in `test.each(table)`) leaves it.
+        let head = match self.pending_head {
+            Some((head, value)) if value == start => {
+                self.pending_head = None;
+                head
+            }
+            _ => start,
+        };
         self.frames.push(Frame {
             name,
             head,
@@ -199,6 +203,19 @@ impl Extractor<'_> {
         });
     }
 
+    /// The pending name, for the function that starts at `start`. A test
+    /// title belongs to its callback alone: a function in `.each(table)`
+    /// before it, or one nested in a named callback, does not take it.
+    fn take_name(&mut self, start: u32) -> Option<String> {
+        if self.pending_call.is_some() {
+            if self.pending_head.map(|(_, callback)| callback) != Some(start) {
+                return None;
+            }
+            self.pending_call = None;
+        }
+        self.pending_name.take()
+    }
+
     /// Remember where the code naming the next function starts, for the
     /// function that is the named value itself (`value` starts there), not
     /// one nested in it.
@@ -237,20 +254,19 @@ impl<'a> Visit<'a> for Extractor<'_> {
                 }
             }
             AstKind::Function(f) => {
-                self.pending_call = None;
-                let name =
-                    f.id.as_ref()
-                        .map(|id| id.name.to_string())
-                        .or_else(|| self.pending_name.take())
-                        .unwrap_or_else(|| "<anonymous>".to_string());
+                let own = f.id.as_ref().map(|id| id.name.to_string());
+                let name = match own {
+                    Some(name) => name,
+                    None => self
+                        .take_name(f.span.start)
+                        .unwrap_or_else(|| "<anonymous>".to_string()),
+                };
                 let span = f.span;
                 self.open(name, span.start, span.end);
             }
             AstKind::ArrowFunctionExpression(a) => {
-                self.pending_call = None;
                 let name = self
-                    .pending_name
-                    .take()
+                    .take_name(a.span.start)
                     .unwrap_or_else(|| "<arrow>".to_string());
                 let span = a.span;
                 self.open(name, span.start, span.end);
@@ -293,6 +309,20 @@ impl<'a> Visit<'a> for Extractor<'_> {
 /// tests, while a test case is what a port carries over one by one.
 pub const TEST_CASE_CALLS: &[&str] = &["it", "test", "specify", "fit", "xit", "xtest", "bench"];
 
+/// Members of a test function that declare something other than a test
+/// case: a suite, a step inside a test, a hook, or configuration
+/// (`test.describe`, `test.step`, `test.beforeEach`, `test.use`).
+pub const NOT_TEST_CASES: &[&str] = &[
+    "describe",
+    "step",
+    "beforeEach",
+    "afterEach",
+    "beforeAll",
+    "afterAll",
+    "use",
+    "extend",
+];
+
 /// The title of the test case `call` declares and where its callback
 /// starts, when `call` is `it('rounds cents', () => …)` or one of its
 /// variants and the title is a plain string. The callback then goes by the
@@ -301,12 +331,18 @@ pub const TEST_CASE_CALLS: &[&str] = &["it", "test", "specify", "fit", "xit", "x
 /// title is part of what a model sees.
 fn test_case(call: &oxc_ast::ast::CallExpression<'_>) -> Option<(String, u32)> {
     use oxc_ast::ast::Expression;
-    // `it`, `it.only`, `test.each(table)`, `it.concurrent.each(table)`.
+    // `it`, `it.only`, `test.each(t
```

---

### Incident Patch 8: `c0d2dc43` (2026-09-29)
**Commit Message**: Merge pull request #1116 from kucherenko/fix/crates-publish-fail-loudly

fix(ci): a failed crates.io publish fails the job

**File**: `.github/workflows/crates-publish.yml` (modified, +16/-2)
```diff
@@ -192,8 +192,22 @@ jobs:
             fi
 
             if ! cargo publish --locked -p "${crate}" --allow-dirty; then
-              echo "⚠ Publish failed for ${crate}@${crate_version} (may already exist); continuing"
-              continue
+              # Another run may have published it in the meantime; anything
+              # else is a real failure. Continuing would only make every
+              # crate that depends on this one fail too, and the job would
+              # still end green with crates.io a release behind (5.3.3).
+              max_ver=$(curl -sfH "Accept: application/json" -H "User-Agent: jscpd-ci (github.com/kucherenko/jscpd)" "https://crates.io/api/v1/crates/${crate}" 2>/dev/null \
+                | jq -r '.crate.max_version // empty' || echo "")
+              if [ "$max_ver" = "$crate_version" ]; then
+                echo "${crate}@${crate_version} is on crates.io after all (max_version=${max_ver}); continuing"
+                continue
+              fi
+              if [ -z "$max_ver" ]; then
+                echo "::error::${crate} does not exist on crates.io yet. Trusted publishing cannot create a crate: publish ${crate}@${crate_version} once with a token (cargo publish -p ${crate}), add this repository as its trusted publisher on crates.io, then rerun this job."
+              else
+                echo "::error::cargo publish failed for ${crate}@${crate_version} (crates.io has ${max_ver})"
+              fi
+              exit 1
             fi
 
             echo "Waiting for crates.io index to update for ${crate}@${crate_version}..."
```

---

### Incident Patch 9: `4ca50d5b` (2026-09-29)
**Commit Message**: fix(ci): a failed crates.io publish fails the job

The publish loop treated every failed `cargo publish` as "may already
exist" and went on, so the job ended green whatever happened. In 5.3.3
trusted publishing could not create the new crate cpd-semantic (403),
jscpd 5.3.3 then failed on the missing dependency, and crates.io stayed
at jscpd 5.3.2 while npm, PyPI and the GitHub release had 5.3.3.

After a failed publish the loop now asks crates.io again: when the
version is there after all, another run published it and the loop goes
on; otherwise the job fails with an error annotation. For a crate that
does not exist yet the annotation says what to do: publish its first
version with a token, add the repository as its trusted publisher, and
rerun. release.yml already skips the GitHub release when this job
fails, so a partial crates.io release now stops the run instead of
passing silently.

**File**: `.github/workflows/crates-publish.yml` (modified, +16/-2)
```diff
@@ -192,8 +192,22 @@ jobs:
             fi
 
             if ! cargo publish --locked -p "${crate}" --allow-dirty; then
-              echo "⚠ Publish failed for ${crate}@${crate_version} (may already exist); continuing"
-              continue
+              # Another run may have published it in the meantime; anything
+              # else is a real failure. Continuing would only make every
+              # crate that depends on this one fail too, and the job would
+              # still end green with crates.io a release behind (5.3.3).
+              max_ver=$(curl -sfH "Accept: application/json" -H "User-Agent: jscpd-ci (github.com/kucherenko/jscpd)" "https://crates.io/api/v1/crates/${crate}" 2>/dev/null \
+                | jq -r '.crate.max_version // empty' || echo "")
+              if [ "$max_ver" = "$crate_version" ]; then
+                echo "${crate}@${crate_version} is on crates.io after all (max_version=${max_ver}); continuing"
+                continue
+              fi
+              if [ -z "$max_ver" ]; then
+                echo "::error::${crate} does not exist on crates.io yet. Trusted publishing cannot create a crate: publish ${crate}@${crate_version} once with a token (cargo publish -p ${crate}), add this repository as its trusted publisher on crates.io, then rerun this job."
+              else
+                echo "::error::cargo publish failed for ${crate}@${crate_version} (crates.io has ${max_ver})"
+              fi
+              exit 1
             fi
 
             echo "Waiting for crates.io index to update for ${crate}@${crate_version}..."
```

---

### Incident Patch 10: `78b4ee2b` (2026-09-29)
**Commit Message**: fix(compare): stricter name pairs, modules past stray files, review fixes

From a review of the branch:

- A name pair now needs the medium level (0.5625 across languages with
  CodeRankEmbed), not the code step's threshold. It skips the
  closest-match and z-score checks, so at the lower bar namesakes such
  as load or init paired whatever they did. On QR-Code-generator this
  drops one wrong pair, BitBuffer.getBit with Python's _get_bit (0.53),
  and no right one; the Tauri plugins keep all 63 pairs.
- A file higher than the rest of a side, such as a build script next to
  app/src/main/java/<module>/, no longer pulls the shared folder up to
  it and merges every module into one, which turned off the module gate
  of the name step. It gets no module; the others keep theirs.
- A file's similarity, low count and counterpart come only from the
  pairs of its counted functions, so a short helper paired by name no
  longer shows a similarity next to "0 / 1".
- A side with nothing to count shows 0 of 0 in yellow, not green.
- --compare no longer stands for a typed --semantic: a config file's
  URL on another machine gets the code only with --semantic.
- The name step checks the cheap fi

**File**: `docs/rust.md` (modified, +3/-3)
```diff
@@ -663,9 +663,9 @@ The "Only in" lists group the functions by file, each with its first line, name
 jscpd pairs the functions of the two paths with the model of `--semantic`, so `--semantic-download` has to fetch it first, and every `--semantic-*` option applies except `--semantic-scope`. The walk is the one of a clone run (`--ignore`, `--format`, `--pattern`, `.gitignore`), limited to the formats jscpd finds functions in unless `--format` names others, but no clone detection runs, and functions of one side are never compared with each other. Pairs are found in two steps:
 
 - the rule of `--semantic` between the two sides: each function is the other's closest match (or close to it, above the group floor), the similarity reaches the threshold, and it stands out from the function's background, which is the other side. Functions under `--min-tokens` or `--min-lines` stay out of this step;
-- names, for the functions left over: two functions pair when their names match once case and underscores are ignored (`encodeBinary`, `encode_binary`, `_encode_binary`) and their similarity reaches the same threshold. This step takes functions of any size, since a port often makes a function shorter. A name pair stays within modules the first step has linked: a module is the folder right under the deepest folder all files of a side share, such as `notification` in `android/notification/...`. Two modules are linked when one of them holds the most of the other's code pairs, so a single stray code pair links nothing. Two modules in which the first step paired nothing may pair by name with each other. Among the candidates, two files the first step has linked go first.
+- names, for the functions left over: two functions pair when their names match once case and underscores are ignored (`encodeBinary`, `encode_binary`, `_encode_binary`) and their similarity reaches the `medium` level (see below; 0.5625 across languages with CodeRankEmbed). A name pair skips the closest-match and stand-out checks of the first step, so it needs more than that step's threshold, or namesakes such as `load` and `init` would pair whatever they do. This step takes functions of any size, since a port often makes a function shorter. A name pair stays within modules the first step has linked: a module is the folder right under the deepest folder all files of a side share, such as `notification` in `android/notification/...`, and a file that sits higher than the rest, such as a build script, does not move that folder up. Two modules are linked when one of them holds the most of the other's code pairs, so a single stray code pair links nothing. Two modules in which the first step paired nothing may pair by name with each other. Among the candidates, two files the first step has linked go first.
 
-A side's totals count the functions of at least `--min-tokens` tokens and `--min-lines` lines, the first and the last line included. With `--compare` the default `--min-tokens` is 30 instead of 50, because a function worth porting is often shorter than a clone worth reporting. A smaller function only shows up as the partner of one that counts. Anonymous functions, such as callbacks and closures, take no part.
+A side's totals count the functions of at least `--min-tokens` tokens and `--min-lines` lines, the first and the last line included. That is one line more than `--semantic` counts, so a function of exactly `--min-lines` lines counts here and not there. With `--compare` the default `--min-tokens` is 30 instead of 50, because a function worth porting is often shorter than a clone worth reporting. A smaller function only shows up as the partner of one that counts. Anonymous functions, such as callbacks and closures, take no part.
 
 Reporters: `console` (the default), `console-full` (adds the list of every pair, those found by name marked `by name`), `json` (`jscpd-compare.json`: for each side its `path`, `functions`, `matched`, `percentage`, `files` with `similarity` and `lowPa
```

**File**: `rust/crates/cpd-semantic/src/compare.rs` (modified, +73/-26)
```diff
@@ -11,11 +11,16 @@
 //!    out from their backgrounds, where a function's background is the other
 //!    side. Functions smaller than `--min-tokens` or `--min-lines` stay out
 //!    of this step, as they do in `--semantic`: a short function resembles
-//!    too many others.
+//!    too many others. Lines are counted with the first and the last, one
+//!    more than `--semantic` counts, so a function of exactly `--min-lines`
+//!    lines takes part here and not there.
 //! 2. Names. A function the first step left unpaired pairs with an unpaired
 //!    function of the other side under the same name, once case and
 //!    underscores are ignored (`encodeBinary`, `encode_binary`), when their
-//!    similarity reaches the threshold of step 1. Here size does not matter:
+//!    similarity reaches the `medium` level (see [`Level`]): a name pair
+//!    skips the mutual-best and z-score checks of step 1, so it needs more
+//!    than step 1's threshold, or every `load` and `init` of two flat
+//!    codebases would pair. Here size does not matter:
 //!    a port often makes a function shorter, and a short function is exactly
 //!    the one step 1 cannot see. Names repeat across a codebase (`load`,
 //!    `checkPermissions` in every plugin), so a name pair has to stay within
@@ -101,17 +106,23 @@ impl Level {
     /// The level of `similarity` for a pair within one language or across
     /// two, under `bars`.
     pub fn of(similarity: f32, same_language: bool, bars: &Thresholds) -> Self {
-        let threshold = bars.for_pair(same_language);
-        let high = bars.group_floor.max(threshold);
+        let (medium, high) = Self::floors(same_language, bars);
         if similarity >= high {
             Level::High
-        } else if similarity >= (threshold + high) / 2.0 {
+        } else if similarity >= medium {
             Level::Medium
         } else {
             Level::Low
         }
     }
 
+    /// The lowest similarities of the `medium` and the `high` level.
+    pub fn floors(same_language: bool, bars: &Thresholds) -> (f32, f32) {
+        let threshold = bars.for_pair(same_language);
+        let high = bars.group_floor.max(threshold);
+        ((threshold + high) / 2.0, high)
+    }
+
     pub fn as_str(self) -> &'static str {
         match self {
             Level::Low => "low",
@@ -297,14 +308,14 @@ pub fn compare(
         let mut candidates: Vec<(bool, f32, usize, usize)> = Vec::new();
         for &a in &left {
             for &b in &right {
+                let counts = functions[a].counted || functions[b].counted;
+                if !counts || !may_pair(a, b) || related[a].binary_search(&b).is_ok() {
+                    continue;
+                }
                 let same_language = grammars.of_item[a] == grammars.of_item[b];
+                let (medium, _) = Level::floors(same_language, &params.thresholds);
                 let similarity = dot(space.row(a), space.row(b));
-                let counts = functions[a].counted || functions[b].counted;
-                if counts
-                    && may_pair(a, b)
-                    && similarity >= params.thresholds.for_pair(same_language)
-                    && related[a].binary_search(&b).is_err()
-                {
+                if similarity >= medium {
                     let files = linked_files.contains(&(items[a].file, items[b].file));
                     candidates.push((files, similarity, a, b));
                 }
@@ -338,8 +349,10 @@ pub fn compare(
 }
 
 /// The module of each of `files`, the paths of one side: the folder right
-/// under the deepest folder they all share, or `""` for a file in that
-/// folder itself.
+/// under the deepest folder they share, or `""` for a file in that folder
+/// itself. Files that sit higher than the rest, such as a build script next
+/// to `app/src/main/java/<module>/…`, do not pull the shared folder up to
+/// them: they get `""`, and the others their modules below.
 fn modules(fil
```

**File**: `rust/crates/cpd-semantic/src/pass.rs` (modified, +3/-7)
```diff
@@ -36,6 +36,8 @@ impl UnitReader {
 }
 
 impl ClonePass for UnitReader {
+    /// Named after `--compare`, the one mode that runs it on its own;
+    /// inside [`SemanticPass`] the pass's own name is used.
     fn name(&self) -> &'static str {
         "--compare"
     }
@@ -107,12 +109,6 @@ impl SemanticPass {
             reader: UnitReader::default(),
         }
     }
-
-    /// The functions read since the last call; see
-    /// [`UnitReader::take_sources`].
-    pub fn take_sources(&self) -> Vec<UnitSource> {
-        self.reader.take_sources()
-    }
 }
 
 impl ClonePass for SemanticPass {
@@ -129,7 +125,7 @@ impl ClonePass for SemanticPass {
     }
 
     fn find(&self, context: &PassContext<'_>) -> Result<Vec<CpdClone>, String> {
-        let mut sources = self.take_sources();
+        let mut sources = self.reader.take_sources();
         for source in &mut sources {
             source.path_label = (context.label)(&source.id);
         }
```

**File**: `rust/crates/cpd/src/compare.rs` (modified, +62/-5)
```diff
@@ -321,11 +321,17 @@ impl Report {
                     unmatched.push(described);
                 }
             }
-            for pair in &pairs {
-                let (own, other) = match side {
-                    0 => (&pair.a, &pair.b),
-                    _ => (&pair.b, &pair.a),
+            for (pair, found) in pairs.iter().zip(&comparison.pairs) {
+                let (own, other, own_index) = match side {
+                    0 => (&pair.a, &pair.b, found.a),
+                    _ => (&pair.b, &pair.a, found.b),
                 };
+                // Only the pairs of functions the file's numbers count: a
+                // short function paired by name does not set the file's
+                // similarity or counterpart.
+                if !comparison.functions[own_index].counted {
+                    continue;
+                }
                 if let Some(entry) = files.get_mut(&own.file) {
                     *entry.partners.entry(other.file.clone()).or_default() += 1;
                     entry.similarities.push(pair.similarity);
@@ -670,9 +676,10 @@ const YELLOW: u8 = 33;
 const CYAN: u8 = 36;
 
 /// Green when every function has a counterpart, red when none has, yellow
-/// in between.
+/// in between, and yellow when no function counts at all.
 fn share_color(matched: usize, functions: usize) -> u8 {
     match (matched, functions) {
+        (_, 0) => YELLOW,
         (m, f) if m == f => GREEN,
         (0, _) => RED,
         _ => YELLOW,
@@ -944,6 +951,56 @@ mod tests {
         assert_eq!(stripped, plain);
     }
 
+    #[test]
+    fn a_file_counts_only_the_pairs_of_its_counted_functions() {
+        // QrCode.java's one counted function is unpaired; a short helper of
+        // the same file paired by name. The file says 0 / 1 and nothing
+        // about similarity or a counterpart.
+        let sides = [
+            vec![source(
+                "/p/java/QrCode.java",
+                vec![unit("makeKanji", 10), unit("clear", 30)],
+            )],
+            vec![source("/p/python/qrcodegen.py", vec![unit("clear", 5)])],
+        ];
+        let f = |side, unit, counted| FunctionRef {
+            side,
+            source: 0,
+            unit,
+            counted,
+        };
+        let comparison = Comparison {
+            functions: vec![f(0, 0, true), f(0, 1, false), f(1, 0, true)],
+            pairs: vec![Pair {
+                a: 1,
+                b: 2,
+                similarity: 0.6,
+                level: Level::Medium,
+                matched_by: MatchedBy::Name,
+            }],
+        };
+        let report = Report::new(
+            ["java/".into(), "python/".into()],
+            &[PathBuf::from("/p/java"), PathBuf::from("/p/python")],
+            &sides,
+            &comparison,
+        );
+        let file = &report.sides[0].files[0];
+        assert_eq!((file.matched, file.functions), (0, 1));
+        assert_eq!((file.similarity, file.counterpart.as_deref()), (None, None));
+        // The Python side counts its function, and its pair.
+        let other = &report.sides[1].files[0];
+        assert_eq!((other.matched, other.similarity), (1, Some(0.6)));
+    }
+
+    #[test]
+    fn nothing_to_count_is_not_shown_as_complete() {
+        assert_eq!(share_color(0, 0), YELLOW);
+        assert_eq!(share_color(3, 3), GREEN);
+        assert_eq!(share_color(0, 3), RED);
+        assert_eq!(share_color(1, 3), YELLOW);
+    }
+
     #[test]
     fn an_empty_side_gets_a_note_instead_of_a_report() {
         let sides = [
```

**File**: `rust/crates/cpd/src/options.rs` (modified, +3/-1)
```diff
@@ -422,7 +422,9 @@ fn semantic_options(
         params: section.params.unwrap_or_default(),
         prefix: section.prefix,
         cache: section.cache.unwrap_or(defaults.cache),
-        on_command_line: cli.semantic || cli.compare,
+        // --compare runs the model too, but only a typed --semantic lets a
+        // config file's URL on another machine receive the code.
+        on_command_line: cli.semantic,
         rebuild_cache: cli.semantic_rebuild_cache,
     }
 }
```

#### Recent Merged Pull Requests:
- **PR #1122** (2026-09-30): feat(lsp): progress ends with what the scan found (@kucherenko)
- **PR #1121** (2026-09-30): feat(lsp): jscpd --lsp, every analysis in any editor with a switch of its own (@kucherenko)
- **PR #1119** (2026-09-30): feat(compare): html reporter draws a migration map, JSON lists what is ready to port (@kucherenko)
- **PR #1118** (2026-09-30): feat(compare): tests and code measured apart, test cases in every language (@kucherenko)
- **PR #1117** (2026-09-29): docs(skills): code-migration ports tests first, bound to code by coverage (@kucherenko)
- **PR #1116** (2026-09-29): fix(ci): a failed crates.io publish fails the job (@kucherenko)
- **PR #1115** (2026-09-29): feat(compare): --compare pairs the functions of two folders (@kucherenko)
- **PR #1114** (2026-09-29): docs(changelog): plainer 5.3.3 notes (@kucherenko)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
