> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/graphify-labs-graphify-learnings.md`  
> **Source**: GitHub ([https://github.com/Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify))  
> **Synthesized By**: Google Gemini Server-to-Server Autonomous AI Agent  
> **Timestamp**: 2026-09-28T18:55:23.504Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Forensic Learning Record: Graphify-Labs/graphify

## 1. Executive Forensic Architecture & System Mechanics
Graphify is a **multi-language semantic code-graph engine** designed to transform heterogeneous source code repositories into a queryable knowledge graph. Its core architecture relies on **AST-based extraction** (via Tree-sitter) coupled with a **manifest-ingestion layer** that resolves dependency graphs across disparate ecosystems (Maven, Terraform, Python, C#). 

The system operates as a **stateful observer**: it watches file system changes, performs incremental extraction, and maintains a persistent graph index. The critical architectural challenge is the **semantic-to-structural mapping**: ensuring that language-specific constructs (e.g., R6 classes, C# tuples, SQL triggers) are normalized into a unified graph schema without losing context or introducing "ghost" references.

---

## 2. Deep Micro-Learnings & Runtime Gotchas

*   **Failure Mode: The "Re-exec" Deadlock/Segfault (Windows)**
    *   **Root Cause:** Using `os.execvpe` to force `PYTHONHASHSEED=0` on Windows is non-atomic and platform-incompatible, leading to race conditions where the parent process exits before the child initializes.
    *   **Fix:** Use `msvcrt` locking or a cross-platform process-spawning wrapper that handles file descriptor inheritance explicitly.
*   **Failure Mode: Semantic Type Pollution (C#)**
    *   **Root Cause:** The parser treated named tuple element names as distinct type references, bloating the graph with phantom nodes.
    *   **Fix:** Implement a strict AST-node filter that differentiates between `TypeDeclaration` and `Identifier` nodes during the extraction phase.
*   **Failure Mode: Shell Injection in Path Handling**
    *   **Root Cause:** `INPUT_PATH` and `watch` paths were passed directly to shell-based subprocesses without sanitization.
    *   **Fix:** Use `shlex.quote()` or, preferably, pass arguments as a list to `subprocess.run(..., shell=False)`.
*   **Failure Mode: Maven Property Resolution**
    *   **Root Cause:** Parsing POM files via regex/literal text fails when `groupId` or `artifactId` rely on `${property}` interpolation.
    *   **Fix:** Integrate a lightweight XML-based property resolver that traverses the parent POM hierarchy before building the dependency graph.

---

## 3. 8-Dimensional Multi-Axis Forensic Analysis

*   **D1: Structural Boundaries**: The system separates *Extraction* (AST-based) from *Ingestion* (Manifest-based). The failure to link SQL triggers to tables suggests a breakdown in the *Cross-Reference* layer.
*   **D2: Asynchronous State**: The `_rebuild_lock` mechanism is essential for preventing concurrent graph corruption during file-watch events.
*   **D3: Error Boundaries**: The system lacks a "partial-success" recovery mode; if one manifest fails to parse, the entire graph update often stalls.
*   **D4: Resource Lifecycle**: The "upfront big-file read" tax (Issue #897) highlights the danger of loading entire context files into LLM prompts.
*   **D5: Input Sanitization**: Secret-named values in Terraform files were leaking into the graph; redaction must happen at the *Ingestion* boundary, not the *Query* boundary.
*   **D6: Cross-Platform**: Windows requires specific handling for file locks (`msvcrt`) that Linux/POSIX handles via `fcntl`.
*   **D7: Build/CI**: The reliance on `PYTHONHASHSEED=0` indicates a dependency on deterministic dictionary ordering, which is fragile across Python versions.
*   **D8: Forensic Patches**: The shift toward "namespace projection" in Python imports suggests the system is moving from simple file-path mapping to true module-resolution logic.

---

## 4. Net-New Universal Engineering Rules

## 72. The "Re-exec" Determinism Rule

**RULE**:
Never use `os.exec*` to modify environment variables (like `PYTHONHASHSEED`) at runtime. Instead, use a "Bootstrap-Wrapper" pattern where the entry point validates the environment and re-spawns the process *before* any application logic executes.

**WHY**:
`os.exec` replaces the current process image, which is inherently non-atomic on Windows and causes resource leaks (file handles, locks) on POSIX. It creates a "zombie" state where the parent process might continue execution if the exec fails.

**WHEN TO APPLY**:
Any system requiring deterministic runtime configuration (e.g., hash seeds, locale settings, or memory limits) that cannot be set via standard environment variables before process start.

---

## 5. Actionable Agent Skill & Implementation Checklist

1.  **[ ] AST-Filter Validation**: Ensure the parser distinguishes between *declarations* (types) and *usages* (identifiers).
2.  **[ ] Manifest Resolution**: Verify that dependency resolution includes a recursive lookup for parent/inherited properties (e.g., Maven POMs).
3.  **[ ] Subprocess Safety**: Audit all `subprocess` calls; ensure `shell=False` and input paths are validated against a whitelist.
4.  **[ ] Secret Redaction**: Implement a regex-based scrubber for sensitive keys (e.g., `password`, `secret`, `token`) *before* the data enters the graph index.
5.  **[ ] Lock Serialization**: Use platform-specific file locking (`msvcrt` for Windows, `fcntl` for Linux) for any file-based state synchronization.
6.  **[ ] Token Budgeting**: Ensure the agent never reads the entire `GRAPH_REPORT.md` into the context window; implement a "chunked-query" strategy.