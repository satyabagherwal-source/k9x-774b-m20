> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/max-sixty-worktrunk-learnings.md`  
> **Source**: GitHub ([https://github.com/max-sixty/worktrunk](https://github.com/max-sixty/worktrunk))  
> **Synthesized By**: Google Gemini Server-to-Server Autonomous AI Agent  
> **Timestamp**: 2026-09-28T19:15:14.331Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Forensic Learning Record: max-sixty/worktrunk

## 1. Executive Forensic Architecture & System Mechanics
`worktrunk` is a high-level orchestration layer built over Git worktrees. It abstracts the complexity of managing multiple concurrent Git environments (worktrees) by providing a unified TUI/CLI interface. 

**Architectural Boundaries:**
*   **Git Plumbing Layer:** Interacts directly with `git` CLI/plumbing commands. The system is inherently fragile because it relies on the state of the `.git` directory, which is often mutated by external processes.
*   **State Synchronization Layer:** Maintains a "registration" of worktrees that may drift from the actual filesystem state.
*   **Hook Execution Engine:** A synchronous/asynchronous event-driven system that triggers lifecycle events (pre-start, post-remove, etc.).
*   **TUI/Picker Layer:** A stateful interactive interface that must mirror the underlying Git state in real-time.

---

## 2. Deep Micro-Learnings & Runtime Gotchas

1.  **The "Stale Registration" Trap:**
    *   **Failure:** `wt list` reports worktrees that no longer exist or are in a different state (e.g., rebase).
    *   **Root Cause:** The application caches worktree metadata. Git's internal state (rebase/merge) is often stored in files within the worktree's `.git` directory, which the application fails to re-poll after external Git operations.
    *   **Fix:** Implement a "lazy-refresh" pattern where the registration is validated against the filesystem *before* any command execution.

2.  **Delimiter Collision in Snapshot Testing:**
    *   **Failure:** `snapshot_formatting_guard` incorrectly identified output sections.
    *   **Root Cause:** Using `content.find("---")` as a naive delimiter parser.
    *   **Fix:** Use structured parsing (e.g., regex with line-start anchors `^---$`) to ensure the delimiter is not a substring of the content.

3.  **Hook Bypass in TUI Actions:**
    *   **Failure:** Interactive picker actions (e.g., `alt-r` for remove) skipped lifecycle hooks.
    *   **Root Cause:** Logic duplication. The CLI command path and the TUI path invoked different code paths for the same logical operation.
    *   **Fix:** Centralize all operations into a "Command Executor" service that enforces hook execution regardless of the entry point.

4.  **Submodule/Index Corruption during Squash:**
    *   **Failure:** Squash operations aborted due to hidden submodule changes.
    *   **Root Cause:** Git index manipulation during a squash can conflict with submodule state if the index is not properly backed up/restored.
    *   **Fix:** Always perform a `git write-tree` and `git read-tree` (plumbing) to snapshot the index state before performing high-level operations.

---

## 3. 8-Dimensional Multi-Axis Forensic Analysis

*   **D1: Structural Boundaries:** The system suffers from "Command-TUI Coupling." Logic should be moved to a pure `Service` layer, with CLI and TUI acting as thin transport layers.
*   **D2: Concurrency Defense:** Git is not thread-safe for concurrent writes. The system must implement a file-based lock (e.g., `.git/index.lock`) before any mutation.
*   **D3: Error Boundaries:** The transition from `FailFast` to `Warn` for hooks indicates a need for a "Graceful Degradation" policy in automation tools.
*   **D4: Resource Lifecycle:** Worktree removal is a destructive operation. The system needs a "Pre-flight Check" that verifies no processes are holding file descriptors in the target directory.
*   **D5: Deserialization:** The use of `jsonschema` suggests heavy reliance on configuration files. Ensure strict schema validation to prevent "State Injection."
*   **D6: Cross-Platform:** macOS/Linux filesystem differences (case sensitivity, symlink behavior) are the primary source of flakiness in tests. Use `tempfile` crates with strict cleanup.
*   **D7: CI/CD:** The reliance on `pre-commit` and `dependabot` is standard, but the "fork trace event" test failure suggests that CI environments often lack the necessary permissions for deep system calls.
*   **D8: Forensic Patches:** The fix for `remove` (not pointing at a detached worktree) highlights the danger of "Dangling Pointers" in logical state management.

---

## 4. Net-New Universal Engineering Rules

## 72. The "Unified Execution Path" Rule

**RULE**:
All state-mutating operations must be routed through a single, non-UI-aware service function. The UI (TUI/CLI) must never contain business logic or hook-triggering code.

**WHY**:
Reduces "Action Drift" where CLI commands and TUI shortcuts diverge in behavior, leading to inconsistent system states and skipped lifecycle hooks.

**WHEN TO APPLY**:
Any CLI tool that provides both a command-line interface and an interactive TUI.

---

## 5. Actionable Agent Skill & Implementation Checklist

- [ ] **Verify Hook Parity:** Ensure every action (remove, switch, create) has a single entry point that executes `pre-` and `post-` hooks.
- [ ] **Implement "State-Validation" Middleware:** Before any command, verify the Git worktree registration against the actual `.git/worktrees` directory.
- [ ] **Sanitize Delimiters:** Replace all `string.find()` calls used for parsing output with regex-based line-anchored parsers.
- [ ] **Locking Strategy:** Implement a `FileLock` mechanism for all Git-mutating operations to prevent race conditions between the TUI and background processes.
- [ ] **Test Isolation:** Ensure test threads do not share global state (e.g., environment variables, current working directory) to eliminate flakiness.