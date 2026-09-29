> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/fosowl-agenticseek-learnings.md`  
> **Source**: GitHub ([https://github.com/Fosowl/agenticSeek](https://github.com/Fosowl/agenticSeek))  
> **Synthesized By**: Google Gemini Server-to-Server Autonomous AI Agent  
> **Timestamp**: 2026-09-29T16:25:02.150Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Forensic Learning Record: Fosowl/agenticSeek

## 1. Executive Forensic Architecture & System Mechanics
`agenticSeek` is a modular, agent-based orchestration framework designed to bridge LLM reasoning (DeepSeek/Anthropic/etc.) with external tool execution (Browser automation, File I/O, Search). 

**Architectural Boundaries:**
*   **Orchestration Layer:** A router-based agent system that classifies user intent to delegate tasks to specialized sub-agents.
*   **Execution Layer:** A browser-automation subsystem (Selenium/Playwright-based) and a file-system interface.
*   **Memory Layer:** A session-based state management system requiring strict initialization sequences (compression/persistence).
*   **API/Gateway:** A FastAPI-like interface requiring dynamic authentication injection.

---

## 2. Deep Micro-Learnings & Runtime Gotchas

1.  **The "None" String-Search Trap:**
    *   **Failure:** `rfind` operations on unvalidated LLM output strings causing `AttributeError`.
    *   **Root Cause:** Assuming LLM output is always a non-null string.
    *   **Fix:** `(output or "").rfind(...)` or explicit `if output is None: return`.

2.  **Browser Interception Race Conditions:**
    *   **Failure:** `ElementClickInterceptedException` during automated UI interaction.
    *   **Root Cause:** DOM state changes between element location and interaction.
    *   **Fix:** Implement a retry-decorator with a JS-click fallback (executing `arguments[0].click()` via `execute_script`).

3.  **Session Recovery Sequencing:**
    *   **Failure:** Memory corruption during session restoration.
    *   **Root Cause:** Attempting to load/decompress session state before the compression engine/buffer is initialized.
    *   **Fix:** Strict Dependency Injection: `MemoryManager` must enforce `__init__` order: `CompressionEngine` -> `PersistenceLayer` -> `SessionLoader`.

4.  **Hardcoded Provider Model Drift:**
    *   **Failure:** Function-calling providers ignoring user-configured model overrides.
    *   **Root Cause:** Hardcoding model strings in provider-specific function wrappers.
    *   **Fix:** Pass `model_name` as a mandatory parameter through the provider factory, never as a constant.

---

## 3. 8-Dimensional Multi-Axis Forensic Analysis

*   **D1: Structural Boundaries:** The system suffers from "God-Agent" coupling. The router is tightly coupled to the prompt language; multilingual support requires a decoupled classification layer (e.g., embedding-based routing rather than one-shot prompt classification).
*   **D2: Asynchronous State:** Memory recovery is non-atomic. If a crash occurs during compression, the session file is left in a corrupted state.
*   **D3: Error Boundaries:** The system lacks a global "Safe-Exit" handler, leading to the observed `BUS error` on exit (likely due to unclosed browser drivers or dangling thread pools).
*   **D4: Resource Lifecycle:** Browser drivers are not consistently managed via context managers (`with` statements), leading to orphaned processes.
*   **D5: Deserialization:** API tokens are handled via environment variables but lack runtime validation, leading to "silent failure" if the token is malformed.
*   **D6: Cross-Platform:** Windows pathing and font-loading issues suggest a lack of abstraction for OS-specific resource paths.
*   **D7: CI/CD:** The `Module not found` error indicates a fragile build pipeline where frontend/backend assets are not correctly bundled in the container.
*   **D8: Forensic Patches:** The shift from hardcoded models to dynamic configuration is the most critical architectural improvement for long-term maintainability.

---

## 4. Net-New Universal Engineering Rules

## 72. The "Initialization-Before-Recovery" Invariant

**RULE**:
Any system utilizing persistent state (memory, sessions, caches) must enforce a strict, non-optional initialization sequence where the *Decompression/Deserialization* engine is fully instantiated and verified before the *Data Recovery* logic is invoked.

**WHY**:
Prevents "Partial State Injection," where a system attempts to load data into an uninitialized or default-state object, leading to silent data corruption or runtime crashes.

**WHEN TO APPLY**:
Any agentic framework, database connector, or stateful service.

---

## 5. Actionable Agent Skill & Implementation Checklist

- [ ] **Dependency Injection Audit**: Ensure all providers (LLM, Browser, Memory) receive configuration via constructor, not global constants.
- [ ] **Browser Resilience**: Wrap all `click()` and `send_keys()` calls in a retry-loop that catches `ElementClickInterceptedException` and falls back to `execute_script`.
- [ ] **Atomic Memory**: Implement a "Write-Ahead-Log" (WAL) for session memory. Write to a `.tmp` file, then `os.replace()` to ensure the session file is never partially written.
- [ ] **Input Sanitization**: Force all LLM-generated string operations (find, split, replace) to handle `None` or empty strings via a utility wrapper.
- [ ] **Graceful Shutdown**: Register `atexit` handlers to explicitly call `.quit()` on all browser drivers and close all file handles.
- [ ] **Multilingual Routing**: Move from prompt-based classification to embedding-based classification for agent routing to ensure language-agnostic performance.