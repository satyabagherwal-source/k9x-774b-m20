> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/automattic-harper-learnings.md`  
> **Source**: GitHub ([https://github.com/Automattic/harper](https://github.com/Automattic/harper))  
> **Synthesized By**: Google Gemini Server-to-Server Autonomous AI Agent  
> **Timestamp**: 2026-09-28T19:15:56.406Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Forensic Learning Record: Automattic/harper

## 1. Executive Forensic Architecture & System Mechanics
Harper is a high-performance, Rust-based grammar and style analysis engine designed for cross-platform integration (WASM, Desktop, Browser Extensions). 
*   **Core Abstraction**: A modular "Linter" pipeline that operates on a tokenized representation of text.
*   **Architectural Boundary**: The system separates the **Core Analysis Engine** (Rust/WASM) from the **Presentation Layer** (React/Svelte/Obsidian). 
*   **Critical Subsystem**: The `SplitWords` and `Linter` trait hierarchy. The engine relies on a prioritized execution model where specific linters (e.g., `MassPlurals`) must preempt generic ones (e.g., `SplitWords`) to prevent "shadowing" of errors.

## 2. Deep Micro-Learnings & Runtime Gotchas
1.  **Linter Shadowing (Priority Inversion)**:
    *   **Failure**: `SplitWords` flagging errors that should be caught by specialized linters (e.g., `MassPlurals`).
    *   **Root Cause**: Lack of explicit priority ordering in the linter execution loop.
    *   **Fix**: Implement a `Priority` enum for linters and sort the execution queue before processing.
2.  **Stateful UI Pollution**:
    *   **Failure**: Pasted text adopting the source's CSS styles (color/font).
    *   **Root Cause**: Direct injection of clipboard HTML/Rich Text into the editor DOM.
    *   **Fix**: Force `text/plain` extraction on paste events; strip all style attributes before DOM insertion.
3.  **Race Conditions in Async Test Suites**:
    *   **Failure**: Flaky tests in Chrome Extension integration.
    *   **Root Cause**: Shared state in the test environment (e.g., global `localStorage` or singleton service instances) between parallel test runs.
    *   **Fix**: Use isolated test containers or unique namespaces for each test case.
4.  **False Positives in Linguistic Heuristics**:
    *   **Failure**: Flagging "one of the latter" as a singular noun error.
    *   **Root Cause**: Over-eager regex/pattern matching that fails to account for idiomatic phrases.
    *   **Fix**: Introduce a "whitelist" or "exception" layer in the linter logic that checks for known idiomatic exceptions before flagging.

## 3. 8-Dimensional Multi-Axis Forensic Analysis
*   **D1: Structural Boundaries**: Strong separation between `core` (logic) and `editor` (UI). The core is agnostic of the host environment.
*   **D2: Concurrency**: Desktop tray icons and service states are prone to race conditions; state updates must be atomic and event-driven.
*   **D3: Error Boundaries**: The system lacks a robust "ignore" mechanism for false positives, leading to user frustration.
*   **D4: Resource Lifecycle**: Desktop service lifecycle management (closing settings vs. closing service) is a common failure point.
*   **D5: Deserialization**: Manifest mismatches (Obsidian plugin) indicate fragile contract management between the core engine and plugins.
*   **D6: Cross-Platform**: macOS icon rendering and browser-specific clipboard handling are the primary sources of platform-specific bugs.
*   **D7: CI/CD**: Static analysis is missing from some sub-projects, leading to inconsistent code quality.
*   **D8: Forensic Patches**: Fixes often involve refining regex or adding exceptions to existing linguistic rules.

## 4. Net-New Universal Engineering Rules

## 72. The Linter Precedence Invariant

**RULE**:
In any multi-pass analysis system, specialized rules must be assigned a higher execution priority than generic rules, and the system must explicitly sort the execution queue by this priority.

**WHY**:
Generic rules (e.g., `SplitWords`) act as "catch-alls." If they execute before specialized rules, they consume the input tokens, preventing the specialized rules from identifying more nuanced errors, leading to "shadowing" bugs.

**WHEN TO APPLY**:
Any system involving rule-based engines, linters, or regex-based text processing.

## 73. The Clipboard Sanitization Rule

**RULE**:
All external input (Clipboard, API payloads) must be treated as untrusted and stripped of all metadata (styles, formatting) before entering the internal state representation.

**WHY**:
Pasting rich text into a plain-text editor often carries hidden CSS/DOM nodes that break the UI/UX and introduce security vectors (XSS).

**WHEN TO APPLY**:
Any web-based editor or text-processing application.

## 5. Actionable Agent Skill & Implementation Checklist
- [ ] **Priority Audit**: Verify that all linters have an associated `Priority` constant.
- [ ] **Test Isolation**: Ensure all integration tests use unique, non-shared state (e.g., unique IDs for DOM elements or storage keys).
- [ ] **Input Sanitization**: Implement a `sanitize_input` function that forces `text/plain` conversion on all paste events.
- [ ] **Linguistic Exception Layer**: Create a `KnownIdioms` struct that is checked by the engine before any linter triggers an error.
- [ ] **CI/CD Coverage**: Add a mandatory check to ensure `cargo clippy` and `cargo test` run on all sub-crates, not just the root.