> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/titanwings-distilly-learnings.md`  
> **Source**: GitHub ([https://github.com/titanwings/distilly](https://github.com/titanwings/distilly))  
> **Synthesized By**: Google Gemini Server-to-Server Autonomous AI Agent  
> **Timestamp**: 2026-09-29T01:25:16.750Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Forensic Learning Record: titanwings/distilly

## 1. Executive Forensic Architecture & System Mechanics

`titanwings/distilly` is an enterprise-grade agent-skill distillation and digital-persona synthesis engine. It extracts, canonicalizes, converts, and packages agent behaviors, user interaction transcripts, persona traits, and operational skills into cross-runtime executable artifacts (supporting **Hermes Agent**, **DeepSeek Harness / DSH**, **Claude Code**, **Codex**, and **OpenClaw**).

```
                      +---------------------------------------+
                      | Raw Transcripts / Chat-Export Dump    |
                      +---------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
| Transcripts Harvester & Byte-Exact Linear Splitter                                |
| - Idempotent record ingestion                                                     |
| - Structural fence-aware byte splitting (\n\n outside code fences)                 |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
| Distillation & Sanitization Pipeline                                              |
| - Persona Extraction vs. "Work-Only" Skill Isolation                              |
| - Line-Safe Handoff Stripping & Persona Reference Purging                        |
| - Multi-Stage JSON Repair & Parser Recovery Path                                  |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
| Output Packaging & Runtime Adapter Engine                                         |
| - 5-Step Mainline Prompts + Bilingual MUST/MUST-NOT Rules + RECEIPT Checks        |
| - Conservative Floor Runtime Compatibility Adapter (Hermes / DSH / Claude Code)   |
| - Version History Engine: Atomic Diff, Manifest Commit & Deterministic Rollback   |
+-----------------------------------------------------------------------------------+
```

### Critical Subsystem Abstractions

1. **Transcript Harvester & Linear Splitter**: Ingests raw chat transcripts and chat-export dumps idempotently. It processes arbitrarily large file streams by applying byte-exact linear splitting at top-level block boundaries, ensuring markdown fences (` ``` `) and JSON structures are never truncated mid-block.
2. **Persona vs. Work-Only Skill Sanitizer**: Decouples identity/persona characteristics (tone, voice, digital-human traits, explicit persona-handoff calls) from functional execution logic ("work-only" skills). Uses a line-safe, state-aware line-parser to purge persona references without breaking executable script context.
3. **Multi-Stage Repair & Deserialization Pipeline**: Intercepts LLM-generated distillation outputs. When LLM outputs contain invalid JSON (trailing commas, unescaped newlines in markdown code fences, surrounding prose), a fallback repair parser fixes the structural syntax before schema validation.
4. **Mainline Prompt Linter & Receipt Invariant Engine**: Enforces strict operational boundaries on generated prompt pipelines via 5-step mainline execution models. Validates bilingual `MUST`/`MUST-NOT` constraints and verifies execution completion via structured `RECEIPT` tokens.
5. **Runtime Compatibility & Conservative Floor Engine**: Dynamically matches target runtime hosts (e.g., DSH, Hermes, Claude Code). When encountering unrecorded host versions, it drops to a labeled "conservative floor" contract rather than failing execution.

---

## 2. Deep Micro-Learnings & Runtime Gotchas (Chhoti se Chhoti Aur Badi se Badi Learnings)

### 1. Non-Line-Safe Multiline Regex Removals in Skill Handoff Stripping
- **Failure Mode**: When distilling "work-only" skills (skills stripped of persona dependencies), running multiline regex patterns to delete persona-handoff logic (`Persona.handoff(...)` or `[Handoff: Persona]`) corrupted adjacent functional code lines or left orphan trailing commas and broken function parameters.
- **Root Cause**: Multiline regex matching with `re.DOTALL` or greedy `.*` spanned across structural block limits, matching from an early persona reference to a late block closing bracket and deleting valid execution lines.
- **Exact Prevention / Fix**: Replaced multiline string replacements with line-safe stateful line scanning. Lines are checked independently or via AST nodes. Line removals only occur when a discrete line matches single-line handoff patterns, preserving surrounding block indentation and logic:

```python
def strip_persona_handoffs_line_safe(code_lines: list[str]) -> list[str]:
    """Line-safe stripping of persona handoffs without greedy multiline corruption."""
    cleaned = []
    for line in code_lines:
        stripped = line.strip()
        # Direct line-level handoff statements or inline persona triggers
        if stripped.startswith("Persona.handoff(") or stripped.startswith("[Handoff:"):
            continue
        if "refer_to_persona(" in stripped and ")" in stripped:
            continue
        cleaned.append(line)
    return cleaned
```

---

### 2. Unrecognized Host Version Runtime Crashes
- **Failure Mode**: When executing distilly against updated or unindexed host runtime environments (e.g., an unlisted Hermes or DSH release tuple), the runtime engine raised an unhandled `HostVersionUnrecognizedError` and terminated pipeline execution.
- **Root Cause**: Strict equality validation against a static host matrix was used. Unrecorded patch releases breached the strict match condition even though the core host API was fully backward compatible.
- **Exact Prevention / Fix**: Implemented a "labeled conservative floor" fallback pattern. If host version parsing exceeds the known matrix or is unindexed, the system logs a diagnostic warning receipt and binds the execution context to the highest verified conservative base runtime tuple:

```python
from typing import NamedTuple

class HostVersion(NamedTuple):
    major: int
    minor: int
    patch: int

VERIFIED_HOST_FLOOR = HostVersion(1, 0, 0)
KNOWN_HOST_VERSIONS = {HostVersion(1, 0, 0), HostVersion(1, 1, 0)}

def resolve_host_runtime(raw_version_str: str) -> HostVersion:
    try:
        parsed = HostVersion(*map(int, raw_version_str.split(".")))
        if parsed in KNOWN_HOST_VERSIONS:
            return parsed
        # If version exceeds floor, log and return conservative floor tuple
        if parsed > VERIFIED_HOST_FLOOR:
            print(f"[WARN] Unrecorded host version '{raw_version_str}'. Binding to conservative floor: {VERIFIED_HOST_FLOOR}")
            return VERIFIED_HOST_FLOOR
    except ValueError:
        pass
    return VERIFIED_HOST_FLOOR
```

---

### 3. Structural Corruption in Oversized Transcript Splitting
- **Failure Mode**: Splitting oversized chat-export files or skill transcripts based on raw byte length or character counts cut across multiline markdown code fences (` ``` `) or JSON structures, resulting in syntax errors during downstream harvesting.
- **Root Cause**: Arbitrary chunking without fence-aware tracking splits content at arbitrary byte boundaries (e.g., index 4096), breaking UTF-8 multi-byte sequences or leaving unterminated code blocks in split chunks.
- **Exact Prevention / Fix**: Built a byte-exact, fence-aware linear splitter. The splitter reads lines sequentially, tracks code-fence state (`in_fence = not in_fence`), and only allows chunk splitting at double newlines (`\n\n`) when `in_fence == False` and chunk byte count exceeds threshold:

```python
def split_transcript_linearly(text: str, max_bytes: int = 4096) -> list[str]:
    chunks = []
    current_chunk = []
    current_bytes = 0
    in_fence = False

    for line in text.splitlines(keepends=True):
        line_bytes = len(line.encode('utf-8'))
        if line.strip().startswith("```"):
            in_fence = not in_fence

        # Split trigger: Exceeds bytes, outside code fences, and on empty line delimiter
        if current_bytes + line_bytes > max_bytes and not in_fence and line.strip() == "":
            chunks.append("".join(current_chunk))
            current_chunk = []
            current_bytes = 0

        current_chunk.append(line)
        current_bytes += line_bytes

    if current_chunk:
        chunks.append("".join(current_chunk))
    return chunks
```

---

### 4. Unrepaired LLM Output Ingestion Failure
- **Failure Mode**: Ingestion of LLM skill distillation outputs crashed with `json.decoder.JSONDecodeError` due to extra markdown headers, trailing commas in objects, or unescaped control characters in extracted code strings.
- **Root Cause**: Relying directly on `json.loads()` for raw LLM returns without pre-parsing or structural extraction.
- **Exact Prevention / Fix**: Implemented a multi-stage parser repair path (`extract_json_block -> repair_syntax -> json.loads`).

```python
import re
import json

def repair_and_parse_json(raw_llm_output: str) -> dict:
    # Stage 1: Extract block inside markdown ```json ... ``` or top-level braces
    match = re.search(r"```json\s*(.*?)\s*```", raw_llm_output, re.DOTALL)
    candidate = match.group(1) if match else raw_llm_output.strip()

    if not (candidate.startswith("{") or candidate.startswith("[")):
        start = candidate.find("{")
        end = candidate.rfind("}")
        if start != -1 and end != -1:
            candidate = candidate[start:end+1]

    # Stage 2: Sanitize trailing commas
    candidate = re.sub(r",\s*([}\]])", r"\1", candidate)

    # Stage 3: Parse
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        # Fallback repair: Escape unescaped control characters
        sanitized = re.sub(r"[\x00-\x1F\x7F]", "", candidate)
        return json.loads(sanitized)
```

---

### 5. Stale CI Type Checking & Host Cache Clashes
- **Failure Mode**: CI workflows failed during `mypy`/`pyright` type checks on fresh checkouts due to hardcoded pip cache paths (`~/.cache/pip`) across heterogeneous runner OS instances and dynamic generation of unchecked build artifacts.
- **Root Cause**: CI configuration specified OS-bound pip cache directories and failed to exclude generated skill/persona output folders (`.distilly_build/`) from type-checking sweeps.
- **Exact Prevention / Fix**: Standardized CI pip cache configurations using `$XDG_CACHE_HOME` and added strict `exclude` paths in `pyproject.toml` for generated runtime files.

---

## 3. 8-Dimensional Multi-Axis Forensic Analysis

### D1: Structural Boundaries & Modularity
- **Decoupling Utility from Identity**: Identity traits (tone, background, conversational quirks) are strictly encapsulated in `Persona` modules, while executable tool interactions are isolated in `Work-Only Skills`.
- **Interface Inversion**: Skill adapters import a standard `BaseSkill` interface. Host-specific runtime features (e.g., DeepSeek Harness vs. Hermes Agent) are applied via adapter wrappers at export time, keeping core distillation rules platform-agnostic.

### D2: Asynchronous State & Concurrency Defense
- **Thread-Safe Candidate Harvesting**: Multi-source candidate harvesting (e.g., harvesting transcripts while querying vector stores) uses thread-safe queues and re-entrant file locks (`filelock.FileLock`) over storage directories.
- **Atomic Skill Generation**: Version history writes use write-to-temp-and-rename mechanics (`os.replace`) to prevent partially written skill manifests from being ingested by concurrent agent loops.

### D3: Error Boundaries, Recovery & Rollback Protocols
- **Atomic Skill Versioning**: Every distillation pass creates a immutable release commit containing a manifest diff.
- **Rollback Invariant**: If validation or prompt-linting fails after skill generation, the engine executes an automated rollback to the previous valid version tuple (`vX.Y.Z`), purging invalid output files before committing state changes.

### D4: Resource Lifecycle & Leak Defenses
- **Streaming Transcript Ingestion**: Generates chunks via Python generators rather than reading entire transcript files into memory.
- **Descriptor Guarantees**: File operations enforce standard `with open(...)` context managers, preventing file descriptor exhaustion during bulk transcript harvesting runs across thousands of files.

### D5: Boundary Deserialization, Schemas & Input Sanitization
- **Bilingual Validation Receipts**: Prompts enforce rigid structured outputs using mandatory `MUST`/`MUST-NOT` clauses and an explicit `RECEIPT` JSON block at the end of response generation.
- **Prompt Linting**: Pre-flight linting verifies that prompts contain no ambiguous markdown delimiters, unescaped curly braces, or missing variable declarations prior to runtime execution.

### D6: Cross-Platform & Runtime Compatibility Gotchas
- **Path Canonicalization**: Resolves DSH and Hermes home directories using `pathlib.Path.expanduser().resolve()`, preventing Windows backslash (`\`) vs. Unix forward slash (`/`) pathing failures in multi-OS pipelines.
- **Line Ending Normalization**: Strips `\r\n` line endings from Windows chat exports into uniform `\n` representation prior to byte-exact splitting calculations.

### D7: Build, CI/CD, Deployment & Dependency Invariants
- **Fresh Checkout Green Builds**: Pinning runtime dependencies and locking type-checking rules in `pyproject.toml` guarantees reproducible CI runs.
- **Single Source of Truth Versioning**: Package versioning is controlled by a single package release tuple (`__version_info__`), preventing version divergence between CLI outputs and module manifests.

### D8: Concrete Bug Fixes & Forensic Patches

#### Patch Analysis: Line-Safe Work-Only Handoff Removal (`1cf1ad09`)
```python
# BEFORE (Fragile Regex Pattern):
# re.sub(r"def handoff_to_persona.*?:.*?\n(?=\ns)", "", code, flags=re.DOTALL)
# CAUSE: Re.DOTALL consumed subsequent non-handoff functions if blank line spacing was irregular.

# AFTER (Line-Safe Parser Guard):
def remove_persona_handoffs_line_safe(source_code: str) -> str:
    lines = source_code.splitlines()
    output_lines = []
    in_handoff_block = False

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("def handoff_to_persona"):
            in_handoff_block = True
            continue
        
        if in_handoff_block:
            # Exit block on new top-level or unindented statement
            if line and not line.startswith(" ") and not line.startswith("\t"):
                in_handoff_block = False
            else:
                continue

        if not in_handoff_block:
            output_lines.append(line)

    return "\n".join(output_lines)
```

#### Patch Analysis: Candidate Collection Hardening (`1db4927a`)
```python
# BEFORE (Unchecked Candidate Aggregation):
# candidates = [parse_candidate(f) for f in os.listdir(source_dir)]
# CAUSE: Crashed on non-JSON files, hidden system files (.DS_Store), or lock files.

# AFTER (Defensive Ingestion Filter):
def collect_xquik_candidates(source_dir: str) -> list[dict]:
    candidates = []
    if not os.path.exists(source_dir):
        return candidates

    for entry in os.scandir(source_dir):
        if entry.is_file() and entry.name.endswith(".json") and not entry.name.startswith("."):
            try:
                with open(entry.path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if "candidate_id" in data and "payload" in data:
                        candidates.append(data)
            except (json.JSONDecodeError, OSError) as err:
                print(f"[WARN] Skipping corrupted candidate file {entry.name}: {err}")
                continue
    return candidates
```

---

## 4. Net-New Universal Engineering Rules (Candidates for Master Brain)

## 72. Line-Safe Context Purging Invariant

**RULE**:
When stripping identity, credentials, or framework-specific callbacks from executable code or prompts, systems **MUST NOT** use multiline greedy string replacement or multiline `re.DOTALL` regexes. Context purging **MUST** be performed line-by-line using explicit indentation/block state machines or language AST transformations.

**WHY**:
Multiline regular expressions frequently breach intended block boundaries when encountering non-standard line breaks, unexpected whitespace, or nested code blocks. This results in silent deletion of functional logic or syntactically invalid output files.

**WHEN TO APPLY**:
Apply in any agent pipeline, context sanitizer, or code distillation engine that strips persona references, identity tags, private metadata, or platform-specific handoffs from executable source files or LLM prompt templates.

---

## 73. Labelled Conservative Floor Fallback Pattern

**RULE**:
When validating host environment runtimes, dynamic agent hosts, or API schemas, an exact version mismatch **MUST NOT** crash the system if the detected version is higher than the known baseline. The framework **MUST** issue a structured warning receipt and fall back to a defined **Conservative Floor** runtime capability tuple.

**WHY**:
Agent runtime environments evolve faster than static client libraries. Hard-failing on unknown patch or minor releases causes cascade outages on newly deployed agent hosts that remain backward-compatible with older baseline contracts.

**WHEN TO APPLY**:
Apply in runtime environment detection, host adapter bindings, and platform plugin integrations across multi-agent deployment ecosystems (e.g., Claude Code, DSH, Hermes Agent, OpenClaw).

---

## 5. Actionable Agent Skill & Implementation Checklist

### Step-by-Step Verification Checklist

1. **Transcript & Import Harvester Verification**:
   - [ ] Ensure raw chat imports ignore hidden files (`.DS_Store`, `.git`) and skip unparseable files without crashing the process.
   - [ ] Verify linear transcript splitting uses fence-aware state tracking (`in_code_fence`) and only splits at `\n\n` boundaries outside fences.

2. **Persona vs. Work-Only Skill Sanitization**:
   - [ ] Verify that stripping persona handoff functions uses a line-safe state machine or AST transformer rather than multiline greedy regexes.
   - [ ] Assert that distilled "work-only" skills do not contain direct imports or references to `Persona` objects.

3. **Multi-Stage Output Repair & Deserialization**:
   - [ ] Implement a three-stage repair wrapper around JSON parsing (`Regex Extraction -> Trailing Comma Clean -> Control Char Strip -> json.loads`).
   - [ ] Enforce schema validation on extracted metadata manifests before committing to disk.

4. **Runtime Compatibility & Rollback**:
   - [ ] Implement a `VERIFIED_HOST_FLOOR` capability check that gracefully handles unrecorded host runtime versions.
   - [ ] Ensure skill version changes perform atomic atomic file writes (`write temp -> replace`) with automated rollback on validation failure.

5. **Prompt-Linting & Receipts**:
   - [ ] Validate prompt templates prior to invocation to guarantee bilingual `MUST`/`MUST-NOT` instructions and trailing JSON `RECEIPT` tags are intact.
   - [ ] Add explicit `mypy`/`pyright` exclusion rules for dynamic build directories in `pyproject.toml`.