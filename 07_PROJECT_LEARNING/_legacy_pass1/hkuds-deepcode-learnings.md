> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/hkuds-deepcode-learnings.md`  
> **Source**: GitHub ([https://github.com/HKUDS/DeepCode](https://github.com/HKUDS/DeepCode))  
> **Synthesized By**: Google Gemini Server-to-Server Autonomous AI Agent  
> **Timestamp**: 2026-09-29T07:45:02.095Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Forensic Learning Record: HKUDS/DeepCode

## 1. Executive Forensic Architecture & System Mechanics
DeepCode functions as an **Agentic Orchestration Harness** designed to bridge LLM reasoning with local filesystem operations. Its architecture is built on a **"Plan-Execute-Verify"** loop, where the system maintains a virtualized file tree state to prevent LLM hallucination of non-existent files. The core abstraction is a **Stateful Agent Runtime** that manages tool-use (MCP), credential lifecycle, and multi-model routing (OpenAI/DeepSeek/Opper). The system is highly sensitive to "boundary leakage," where LLM output (HTML/Markdown) bleeds into structured data pipelines.

---

## 2. Deep Micro-Learnings & Runtime Gotchas
1.  **The "HTML-in-JSON" Poisoning**: LLMs often return diagnostic HTML (e.g., OpenRouter error pages) when API calls fail. If the parser expects JSON, the entire pipeline crashes.
    *   *Fix*: Implement a strict schema-validation layer (Pydantic) that rejects any response containing `<!DOCTYPE` or `<html>` tags before processing.
2.  **Path Traversal in SPA Routing**: The catch-all route `/{full_path:path}` allowed arbitrary file reads.
    *   *Fix*: Use `pathlib.Path.resolve()` and verify the resulting path is a child of the intended base directory using `path.is_relative_to(base_dir)`.
3.  **Python 3.10+ `types.UnionType` Incompatibility**: Using `|` for type hinting in environments running older Python versions (or misconfigured environments) causes `TypeError`.
    *   *Fix*: Use `from __future__ import annotations` and `typing.Union` for maximum compatibility.
4.  **Encoding Fragility**: Reading system files (like `.git/info/exclude`) or process output without explicit `encoding='utf-8'` leads to `UnicodeDecodeError` on non-UTF-8 system locales.
    *   *Fix*: Always enforce `open(file, encoding='utf-8')` and `subprocess.run(..., encoding='utf-8')`.
5.  **Font/Resource Probing**: Using `document.fonts.check()` in browser-based UI components is unreliable for local font detection.
    *   *Fix*: Use `local()` CSS lookups to verify availability without triggering unnecessary layout reflows or false negatives.

---

## 3. 8-Dimensional Multi-Axis Forensic Analysis
*   **D1: Structural Boundaries**: The system relies on a "File Tree" as the source of truth. If the tree is not initialized, the agent fails. This is a **Hard Dependency Inversion** failure.
*   **D2: Asynchronous State**: The "repeat_guard" and "evidence ledger" suggest a need for stateful tracking of LLM outputs to prevent infinite loops.
*   **D3: Error Boundaries**: The system lacks a robust "Retry-with-Context" mechanism, leading to "Unexpected API Error" crashes.
*   **D4: Resource Lifecycle**: The transition to OS-keychain fallbacks for credentials indicates a move away from insecure `.env` storage.
*   **D5: Boundary Deserialization**: High risk of prompt injection via `AGENTS.md`. The system must treat all local config files as untrusted user input.
*   **D6: Cross-Platform**: Heavy reliance on `pathlib` is good, but the fix for `.git/info/exclude` proves that cross-platform encoding is a major blind spot.
*   **D7: Build/CI/CD**: The "smoke output" fix indicates that CI/CD pipelines were failing due to unhandled stream encodings.
*   **D8: Forensic Patches**: The move to "neutralize every tag spelling" in the data boundary is a critical security hardening against LLM-injected XSS/Injection.

---

## 4. Net-New Universal Engineering Rules

## 73. The "Boundary-Sanity" Invariant

**RULE**:
All LLM-generated outputs must pass through a "Sanity Gate" that validates the MIME-type/Schema before the data reaches the application logic.

**WHY**:
LLMs are prone to "context-bleeding," where they return error pages, conversational filler, or HTML instead of the requested JSON/Code. Allowing this into the pipeline causes cascading failures in downstream parsers.

**WHEN TO APPLY**:
Any system where an LLM acts as a data provider for a programmatic pipeline.

---

## 5. Actionable Agent Skill & Implementation Checklist
- [ ] **Pre-Flight Check**: Verify `file_tree` existence before any `write` or `edit` operation.
- [ ] **Encoding Enforcement**: Audit all `open()` and `subprocess` calls; ensure `encoding='utf-8'` is explicitly set.
- [ ] **Injection Shield**: Sanitize all local configuration files (`AGENTS.md`, `.env`, etc.) before passing them into the LLM context window.
- [ ] **Schema Validation**: Use Pydantic models to parse LLM responses; if validation fails, trigger a "Self-Correction" loop rather than a hard crash.
- [ ] **Path Security**: Use `pathlib` to resolve and validate that all file operations are contained within the project root.
- [ ] **Credential Hygiene**: Never store raw tokens in text files; implement a fallback to OS-native keychains (e.g., `keyring` library).