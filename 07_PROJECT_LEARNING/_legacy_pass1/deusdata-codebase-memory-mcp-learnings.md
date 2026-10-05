> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/deusdata-codebase-memory-mcp-learnings.md`  
> **Source**: GitHub ([https://github.com/DeusData/codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp))  
> **Synthesized By**: Universal Multi-Provider Autonomous AI Agent  
> **Timestamp**: 2026-09-30T06:55:41.122Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): DeusData/codebase-memory-mcp

## 1. Executive Forensic Architecture & System Mechanics
`codebase-memory-mcp` is a high-performance, native C-based knowledge graph engine designed to provide LLM agents with structured, indexed, and queryable codebase context. It bypasses the latency of file-by-file RAG by building a persistent graph of definitions, call chains, and semantic relationships using Tree-sitter for AST parsing and SQLite for storage. 

**Architectural Boundaries:**
- **Extraction Layer**: Language-agnostic AST walker that maps source code to a normalized graph schema.
- **Registry Layer**: A centralized symbol resolution system that handles cross-language and cross-file reference resolution.
- **Daemon/IPC Layer**: A long-running process that manages shared state, preventing redundant indexing and providing a stable endpoint for multiple agent sessions.
- **MCP Surface**: A standard-compliant Model Context Protocol server that exposes graph-traversal tools to LLMs.

---

## 2. Forensic Real Incidents & Production Patches

### Incident 1: Enclosing Gitignore Inheritance (BUG-GIT-01)
- **Context**: `src/discover/discover.c`
- **What Was Expected**: Subfolders in a git-less directory should honor the root `.gitignore` of the enclosing repository.
- **What Actually Happened**: The discovery walker only checked the immediate directory's `.git` folder, ignoring parent repository rules.
- **Evidence**: PR #2181, Commit `92910147`.
- **Root Cause**: The `gitignore_link` structure was not designed to traverse upward to parent directories for ignore-rule inheritance.
- **Remediation**:
```c
// - link->prefix = ... (only local)
// + link->base = ... (supports parent-anchored paths)
```
- **Lesson**: Ignore-rule resolution must be recursive and anchored to the repository root, not the current working directory.

### Incident 2: False All-Clear on Corrupt DB (BUG-SQL-02)
- **Context**: `src/mcp/mcp.c`, `src/store/store.c`
- **What Was Expected**: Failed SQL reads should return an error state.
- **What Actually Happened**: `cbm_store_count_nodes` returned `0` on failure, causing the UI to report "empty" instead of "error".
- **Evidence**: PR #2065, Commit `5621a1c9`.
- **Root Cause**: Implicit assumption that `sqlite3_step` failure equals an empty result set.
- **Remediation**:
```c
// - int count = 0;
// + int count = CBM_STORE_ERR;
```
- **Lesson**: Never conflate "empty data" with "failed read" in storage layers.

### Incident 3: AST Walker Stack Overflow (BUG-AST-03)
- **Context**: `internal/cbm/extract_defs.c`
- **What Was Expected**: AST walkers should process arbitrarily large files.
- **What Actually Happened**: Fixed-size stack arrays (`BT_STACK = 512`) caused silent truncation of AST traversal.
- **Evidence**: PR #2375, Commit `17718126`.
- **Root Cause**: Fixed-size stack allocation for recursive-to-iterative conversion.
- **Remediation**:
```c
// - TSNode bt_stack[BT_STACK];
// + TSNode *bt_stack = malloc(...); // Growable heap-backed stack
```
- **Lesson**: Any traversal depth limit must be dynamic or explicitly error-prone, never silently truncating.

---

## 3. The 9 Deep Learning Dimensions
1. **Architecture**: Decoupled into `discover` (FS), `extract` (AST), `pipeline` (Registry), and `daemon` (IPC).
2. **Core Abstractions**: `CBMDefinition`, `CBMFileResult`, and `cbm_registry_t` act as the domain primitives.
3. **Error Handling**: Uses sentinel values (e.g., `CBM_STORE_ERR`) and explicit error reporting rather than exceptions.
4. **Testing**: Heavy use of `th_mktempdir` and `setup_snippet_server` for integration-level unit tests.
5. **Security**: Local-only execution; no network egress; strict input sanitization in `cbm_client_adapter`.
6. **Performance**: Zero-copy parsing where possible; heap-spilling stacks for AST traversal.
7. **Deployment**: Single-binary distribution; `install.sh` handles profile migration.
8. **Agent Patterns**: Uses `SessionStart` and `PreToolUse` hooks to inject context into LLM sessions.
9. **Data Flow**: SQLite-backed graph storage; immutable snapshots for incremental indexing.

---

## 4. The 8 Learning Extraction Artifacts
1. **Pattern**: **Growable Stack Walker**: Use an inline buffer for common cases, spill to heap for large trees.
2. **Rule**: **Sentinel Invariants**: Never return `0` for a failed read; use a distinct error sentinel.
3. **Architecture Principle**: **Registry-First Resolution**: Decouple symbol registration from file-path resolution.
4. **Failure Mode**: **Silent Truncation**: Fixed-size buffers in recursive algorithms lead to invisible data loss.
5. **Reusable Skill**: **Cross-Build Conflict Resolution**: Always provide a "remedy" string in error messages (pid, version, stop command).
6. **Decision**: **SQLite over Custom Binary**: SQLite provides robust ACID properties for graph storage without custom serialization overhead.
7. **Anti-pattern**: **Implicit Error Mapping**: Mapping `SQLITE_ERROR` to `0` (empty).
8. **Verification Method**: **Deterministic Fuzzing**: Use `th_mktempdir` to create isolated environments for every test case.

---

## 5. Net-New Universal Engineering Rules

## 1. The "Failed Read" Invariant
**RULE**:
A storage layer function MUST NEVER return a valid data value (e.g., `0`, `NULL`) to represent a failed operation.
**WHY**:
Conflating "no data" with "error" leads to silent data corruption and false-positive "empty" states in downstream UI/logic.
**VERIFIED IMPLEMENTATION PATTERN**:
```c
int get_count(void) {
    if (db_error) return -1; // Distinct error sentinel
    return count;
}
```
**NEGATIVE CONSTRAINT**:
```c
int get_count(void) {
    if (db_error) return 0; // NEVER DO THIS
    return count;
}
```

---

## 6. Actionable Agent Skill & Implementation Checklist
- [ ] **Stack Safety**: Audit all recursive-to-iterative conversions for fixed-size stack arrays.
- [ ] **Error Propagation**: Verify that every `sqlite3` call has a corresponding error-handling branch.
- [ ] **Conflict Resolution**: Ensure all daemon/process-based tools provide a `remedy` string in error responses.
- [ ] **Path Invariants**: Ensure all file-system walkers respect parent-directory configuration (e.g., `.gitignore`).
- [ ] **Test Isolation**: Use `th_mktempdir` or equivalent to ensure tests do not leak state into the host environment.