> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/jordan-gibbs-hyperresearch-learnings.md`  
> **Source**: GitHub ([https://github.com/jordan-gibbs/hyperresearch](https://github.com/jordan-gibbs/hyperresearch))  
> **License**: MIT  
> **Synthesized By**: Universal Multi-Provider Autonomous AI Agent  
> **Timestamp**: 2026-10-04T20:16:54.830Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Personal emails/PII sanitized at ingestion.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation or use as an AI/ML training dataset is prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): jordan-gibbs/hyperresearch

---

## 1. Executive Forensic Architecture & System Mechanics

### Core System Mission & Problem Space
`hyperresearch` is an autonomous deep-research harness designed for LLM agents (Claude Code and OpenAI Codex). It solves the problem of agent hallucination, uncontrolled context bloat, non-reproducible research state, and unverified source citations during multi-hour research workflows. The system structures web crawling, academic retrieval, claim extraction, graph centrality scoring, adversarial critique, and report synthesis into a multi-step deterministic pipeline operating over a local Markdown + SQLite research vault (`.hyperresearch/db.sqlite`).

### Subsystem Boundaries & Decoupling

```
                     ┌────────────────────────────────────────────────────────┐
                     │            CLI / MCP / Agent Entry Point               │
                     │  (typer CLI, FastMCP server, Codex TOML translation)   │
                     └───────────────────────────┬────────────────────────────┘
                                                 │
                                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   RESEARCH VAULT ENGINE                                         │
│  ┌─────────────────────────┐   ┌───────────────────────────┐   ┌─────────────────────────────┐  │
│  │ Vault State & Storage   │   │     SQLite Database       │   │    Sync & Parser Engine     │  │
│  │ (research/notes/*.md)   │   │  (notes, sources, claims, │   │ (parse_frontmatter,         │  │
│  │ (research/runs/<tag>/)  │   │   links, FTS5, embeddings)│   │  strip_code, WIKI_LINK_RE)  │  │
│  └────────────┬────────────┘   └─────────────┬─────────────┘   └──────────────┬──────────────┘  │
└───────────────┼──────────────────────────────┼────────────────────────────────┼─────────────────┘
                │                              │                                │
                ▼                              ▼                                ▼
┌──────────────────────────────┐┌─────────────────────────────┐┌──────────────────────────────────┐
│   CRAWLING & RESCUE LANES    ││  SCHOLAR & OA RESOLUTION    ││   AUDIT & VERIFICATION GATES     │
│  ┌────────────────────────┐  ││  ┌───────────────────────┐  ││  ┌────────────────────────────┐  │
│  │ Builtin HTTP (safe_get)│  ││  │ OpenAlex / Crossref   │  ││  │ Cite-Checker & Triage      │  │
│  ├────────────────────────┤  ││  ├───────────────────────┤  ││  ├────────────────────────────┤  │
│  │ Crawl4AI (Headless)    │  ││  │ Semantic Scholar (S2) │  ││  │ Quote Integrity & Lints    │  │
│  ├────────────────────────┤  ││  ├───────────────────────┤  ││  ├────────────────────────────┤  │
│  │ Browser (Visible/CDP)  │  ││  │ OA Rescue (Unpaywall, │  ││  │ Adversarial Patch/Polish   │  │
│  ├────────────────────────┤  ││  │ Europe PMC, CORE)     │  ││  │ Ship Gate (verify_run)     │  │
│  │ PDF Extraction (PyMuPDF│  ││  └───────────────────────┘  ││  └────────────────────────────┘  │
│  └────────────────────────┘  │└─────────────────────────────┘└──────────────────────────────────┘
└──────────────────────────────┘
```

1. **Vault Engine (`core/vault.py`, `core/db.py`, `core/sync.py`)**: Manages the local Zettelkasten. Files are saved as YAML frontmatter + Markdown in `research/notes/`. A SQLite WAL-mode database acts as a read-side cache and index (FTS5 full-text search, link graph edges, claims table).
2. **Network & Crawling Layer (`web/safe_http.py`, `web/builtin.py`, `web/crawl4ai_provider.py`, `web/pdf.py`)**: Enforces Server-Side Request Forgery (SSRF) security, TLS certificate verification, response size caps, and headless/visible browser automation.
3. **Scholar & Open-Access Pipeline (`core/scholar.py`, `core/oa.py`)**: Interrogates academic APIs (OpenAlex, Crossref, Semantic Scholar) to retrieve paper metadata, citation counts, venue tiering, and retraction notices. Recovers full text from open-access mirrors (Unpaywall, Europe PMC, CORE).
4. **Graph & Source Ranking Engine (`core/graphrank.py`, `core/enrich.py`)**: Recomputes vault PageRank centrality across citation links and `--suggested-by` provenance edges.
5. **Verification & Audit Subsystem (`core/citecheck.py`, `cli/lint.py`, `core/runs.py`)**: Implements deterministic triage for claim support, quote integrity verification via regex/fuzzy matching, numeric consistency checks, and ship-gate verification (`verify_run`).

---

## 2. Forensic Real Incidents & Production Patches

### Incident 1: Erasure of Retraction Status Under Third-Party API Outage (BUG-HYPER-01)
- **Context**: `src/hyperresearch/core/scholar.py` -> `score_sources()`
- **What Was Expected**: If OpenAlex is unavailable (5xx error or timeout), enrichment falls back to Semantic Scholar (S2) to update citation counts. Existing retraction data (`is_retracted = True`) in the local vault database MUST NEVER be overwritten by "unknown" status from S2, which lacks retraction endpoints.
- **What Actually Happened**: S2 returned `is_retracted = None`. During a `--fresh` enrichment sweep while OpenAlex was down, the DB update executed `SET is_retracted = None` (coerced from S2's result). This set `is_retracted` to `NULL` in the database and `None` in note frontmatter, allowing previously flagged retracted papers to pass the ship gate.
- **Evidence in Repo**: Commit `750a51ba`, File: `src/hyperresearch/core/scholar.py`, Test: `tests/test_core/test_scholar_enrichment.py::test_openalex_outage_keeps_a_known_retraction`.
- **Root Cause**: Unconditional overwrite of database fields with API payload values without checking nullability against existing state invariants.
- **Remediation Code Diff**:
```python
// - DB update
// conn.execute(
//     "UPDATE notes SET citation_count = ?, venue = ?, is_retracted = ? WHERE id = ?",
//     (
//         meta_result["citation_count"],
//         meta_result["venue"],
//         None if meta_result["is_retracted"] is None else int(meta_result["is_retracted"]),
//         row["id"],
//     ),
// )

+ # Only OpenAlex reports retractions. When it errors (5xx, timeout) the
+ # lookup falls through to Semantic Scholar, which answers "unknown".
+ # Unknown must never erase a retraction OpenAlex already reported.
+ is_retracted = meta_result["is_retracted"]
+ if is_retracted is None and row["is_retracted"] == 1:
+     is_retracted = True

+ conn.execute(
+     "UPDATE notes SET citation_count = ?, venue = ?, is_retracted = ? WHERE id = ?",
+     (
+         meta_result["citation_count"],
+         meta_result["venue"],
+         None if is_retracted is None else int(is_retracted),
+         row["id"],
+     ),
+ )
```
- **Lesson**: When merging multi-source enrichment data where schema capabilities differ per vendor, missing attributes from lower-capability providers must behave as `NOOP` rather than replacing ground-truth data stored from higher-capability providers.

---

### Incident 2: Chromium Flag Injection Bypassing TLS Verification in Browser Automation (BUG-HYPER-02)
- **Context**: `src/hyperresearch/web/crawl4ai_provider.py` -> `_strip_cert_ignore_flags()`
- **What Was Expected**: Setting `browser_verify_tls = True` in settings should enforce valid TLS certificates when fetching HTML pages via `crawl4ai` (Playwright Chromium wrapper).
- **What Actually Happened**: `crawl4ai` defaulted `BrowserConfig.ignore_https_errors = True` AND internal strategy modules (`BrowserManager._build_browser_args` and `ManagedBrowser.build_browser_flags`) unconditionally appended `--ignore-certificate-errors` and `--ignore-certificate-errors-spki-list` to Chromium CLI launch flags. Setting `ignore_https_errors = False` on the high-level config was silently bypassed by Chromium's low-level process flags.
- **Evidence in Repo**: Commit `6f05dbf9`, Issue #137, File: `src/hyperresearch/web/crawl4ai_provider.py`.
- **Root Cause**: Third-party framework abstraction leak where command-line arguments passed to sub-processes overrode high-level API context configurations.
- **Remediation Code Diff**:
```python
+ _CERT_IGNORE_FLAGS = frozenset({
+     "--ignore-certificate-errors",
+     "--ignore-certificate-errors-spki-list",
+ })

+ def _strip_cert_ignore_flags(strategy: AsyncPlaywrightCrawlerStrategy) -> None:
+     bm = strategy.browser_manager
+     build_args = getattr(bm, "_build_browser_args", None)
+     if not callable(build_args):
+         raise RuntimeError("crawl4ai's BrowserManager._build_browser_args is missing...")

+     def _verified_args() -> dict:
+         args = build_args()
+         args["args"] = [a for a in args.get("args", []) if a not in _CERT_IGNORE_FLAGS]
+         return args

+     bm._build_browser_args = _verified_args
```
- **Lesson**: High-level wrapper configs are insufficient when third-party libraries launch underlying binary processes; you must inspect and mutate the actual command-line argument lists passed to binaries (e.g., Chromium).

---

### Incident 3: Superlinear Backtracking & Wiki-Link Leakage via Code Fence Mismatch (BUG-HYPER-03)
- **Context**: `src/hyperresearch/core/patterns.py` -> `strip_code()`
- **What Was Expected**: Markdown code stripping prior to wiki-link parsing must correctly match opening code fence lengths (e.g., ```` ```` ````) to closing fences of equal or greater length, operating in $O(N)$ linear time.
- **What Actually Happened**: The code stripper used regexes `CODE_BLOCK_RE = re.compile(r"```.*?```", re.DOTALL)` and `INLINE_CODE_RE = re.compile(r"`[^`]+`")`. When HTML `<pre>` tags containing code with nested triple backticks were converted into outer 4-backtick code blocks, `CODE_BLOCK_RE` matched the opening 4-backtick fence against the *first inner 3-backtick run*. This terminated the fence prematurely, leaving remaining code (e.g., bash test conditionals like `[[ -n "$kernel" ]]`) exposed to the wiki-link regex. `repair` then generated dozens of junk stub notes named after shell syntax (`-n "$kernel".md`). Furthermore, variable-length backreference regexes caused catastrophic $O(N^2)$ re-scanning on backtick-dense payloads.
- **Evidence in Repo**: Commit `54af04b0`, Issue #140, File: `src/hyperresearch/core/patterns.py`.
- **Root Cause**: Using non-backtracking naive regexes for stateful block parsing with variable delimiter lengths.
- **Remediation Code Diff**:
```python
// - CODE_BLOCK_RE = re.compile(r"```.*?```", re.DOTALL)
// - INLINE_CODE_RE = re.compile(r"`[^`]+`")

+ def _strip_fenced_blocks(text: str) -> str:
+     lines = text.split("\n")
+     # O(N) multi-pass scanner calculating delimiter run lengths per line
+     # and matching opening fences to valid closing lines (>= length of opener).
+     ...
+ def _strip_inline_code(text: str) -> str:
+     # Groups backtick runs by length; matches N backticks to next EXACT run of N backticks.
+     ...
+ def strip_code(text: str) -> str:
+     return _strip_inline_code(_strip_fenced_blocks(text))
```
- **Lesson**: Never use simple regular expressions to parse structural markdown fences with variable delimiter lengths on attacker-controlled web content; use a linear state scanner.

---

### Incident 4: Arbitrary File Write & Path Traversal via Unsanitized Wiki-Link Targets (BUG-HYPER-04)
- **Context**: `src/hyperresearch/core/note.py` -> `write_note()` & `src/hyperresearch/core/patterns.py` -> `is_valid_wiki_link_target()`
- **What Was Expected**: Target identifiers inside `[[target]]` links must be strictly validated so that link resolution (`graph stub` / `repair`) cannot create files outside the designated vault directory or generate invalid filenames on Windows.
- **What Actually Happened**: `write_note` built the disk filename using the raw `note_id` argument (`path = vault.notes_dir / f"{note_id}.md"`), whereas the frontmatter `id` field was slugified via `NoteMeta.ensure_slug`. When fetched code contained raw shell conditionals (e.g., `[[../../outside]]` or `[[-n "$kernel"]]`), the repair loop attempted to materialize stub files using the unslugified target. `[[../../outside]]` wrote files outside the vault root, and `[[-n "$kernel"]]` crashed on Windows due to invalid filename characters (`"`, `$`, `<`).
- **Evidence in Repo**: Commit `a2623559`, Issue #126 / #114, File: `src/hyperresearch/core/note.py`, Test: `tests/test_core/test_note.py::test_write_note_traversal_id_stays_in_the_vault`.
- **Root Cause**: Divergence between the disk file path creation logic (raw string) and the internal domain model identifier (slugified string).
- **Remediation Code Diff**:
```python
// - nid = note_id or slugify(title)
+ # The id must be a fixed point of the slugifier. NoteMeta.ensure_slug
+ # already slugifies the FRONTMATTER id, so an unslugified note_id here
+ # made the filename diverge from the note's own frontmatter.
+ nid = slugify(note_id) if note_id else slugify(title)

+ # In patterns.py: Reject traversal and shell syntax at link extraction time
+ _SHELL_FRAGMENT_CHARS_RE = re.compile(r'[$\"`=\\<>;]')
+ if _SHELL_FRAGMENT_CHARS_RE.search(ref) or ref.startswith(("-", "!")):
+     return False
+ if any(part in ("..", ".") for part in ref.split("/")):
+     return False
```
- **Lesson**: Disk filenames MUST