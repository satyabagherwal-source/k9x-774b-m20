> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/bee-san-ciphey-learnings.md`  
> **Source**: GitHub ([https://github.com/bee-san/Ciphey](https://github.com/bee-san/Ciphey))  
> **Synthesized By**: Google Gemini Server-to-Server Autonomous AI Agent  
> **Timestamp**: 2026-09-29T07:46:33.967Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Forensic Learning Record: bee-san/Ciphey

## 1. Executive Forensic Architecture & System Mechanics
Ciphey is an automated decryption/decoding engine that treats cryptography as a search problem. It utilizes a heuristic-driven pipeline to identify encodings (Base64, Morse, etc.) and ciphers, applying a "guess-and-check" strategy validated by natural language processing (NLP) models. 

**Architectural Boundaries:**
*   **The Orchestrator:** Manages the execution graph of decoders.
*   **The Decoder Interface:** A standardized contract for plug-and-play decryption modules.
*   **The Validator (The "Brain"):** An NLP-based scoring system that determines if the output of a decoder is "human-readable" (plaintext).
*   **The Execution Sandbox:** A constrained environment for running potentially malicious or infinite-loop-prone code (e.g., Brainfuck interpreters).

## 2. Deep Micro-Learnings & Runtime Gotchas
1.  **Unbounded Interpreter Loops:**
    *   **Failure:** Brainfuck decoders caused the entire process to hang (Issue #800).
    *   **Root Cause:** Lack of instruction-count limits in the interpreter loop.
    *   **Fix:** Implement a `max_instructions` counter that forces a `Result::Err` or `Panic` if the threshold is exceeded.
2.  **Cross-Platform Checksum Mismatch:**
    *   **Failure:** Windows release builds failed verification (Commit `e426bca2`).
    *   **Root Cause:** CRLF vs LF line ending differences in build artifacts affecting hash generation.
    *   **Fix:** Force binary-mode reading/writing and normalize line endings in CI pipelines before checksumming.
3.  **Dependency Version Drift:**
    *   **Failure:** Build instability due to `candle` or `toml` crate updates (Commit `9d6e1e2f`).
    *   **Root Cause:** Over-reliance on semver-compatible updates for critical build-tooling dependencies.
    *   **Fix:** Strict pinning of build-time dependencies in `Cargo.lock` and CI environment snapshots.
4.  **Path/Import Resolution on Windows:**
    *   **Failure:** `python ciphey.py` failing due to relative import resolution (Issue #801).
    *   **Root Cause:** Python's `sys.path` behavior on Windows when executing scripts directly vs. as a module.
    *   **Fix:** Use `python -m ciphey` and ensure `__init__.py` structures are strictly enforced.

## 3. 8-Dimensional Multi-Axis Forensic Analysis
*   **D1: Structural Boundaries:** The system relies on a "Plugin" architecture. The failure to isolate these plugins led to the "hanging" issues.
*   **D2: Asynchronous State:** The "Thinking..." state (Issue #800) suggests a lack of a timeout mechanism on the main event loop.
*   **D3: Error Boundaries:** The system lacks a "Circuit Breaker" pattern. If one decoder hangs, the entire pipeline blocks.
*   **D4: Resource Lifecycle:** No evidence of memory-limit enforcement on decoders, leading to potential OOM on large inputs.
*   **D5: Input Sanitization:** The system is inherently "unsafe" (it executes arbitrary code). It requires a strict sandbox (e.g., WASM or process-level isolation).
*   **D6: Cross-Platform:** High friction on Windows due to path handling and binary distribution (Brew/Pip).
*   **D7: CI/CD:** The recent commits show a transition from "fragile" to "hardened" release pipelines (checksum enforcement).
*   **D8: Forensic Patches:** The fix for Brainfuck (`bound interpreter execution`) is a classic example of adding a "Guard Clause" to a recursive or iterative process.

## 4. Net-New Universal Engineering Rules

## 72. The "Infinite Loop" Guard Clause

**RULE**:
Any interpreter, parser, or recursive solver must implement a hard-coded, non-configurable instruction or depth limit that triggers a hard exit.

**WHY**:
External inputs (especially in security tools) are adversarial. Without a hard limit, an input designed to trigger a `while(true)` or deep recursion will exhaust CPU/Stack resources, effectively turning your tool into a DoS vector.

**WHEN TO APPLY**:
Any module that executes user-provided code, parses complex nested structures, or performs heuristic search.

## 5. Actionable Agent Skill & Implementation Checklist
- [ ] **Instruction Counting:** Does the code have a `max_ops` counter in every loop?
- [ ] **Timeout Wrappers:** Are all external calls wrapped in a `tokio::time::timeout` or equivalent?
- [ ] **Checksum Normalization:** Are release artifacts generated using a platform-agnostic line-ending strategy?
- [ ] **Dependency Pinning:** Is `Cargo.lock` committed and verified in CI?
- [ ] **Module Execution:** Does the documentation explicitly state the use of `python -m` to avoid import path resolution errors?
- [ ] **Resource Limits:** Is there a memory ceiling for the decryption process?