> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/browser-use-browser-use-learnings.md`  
> **Source**: GitHub ([https://github.com/browser-use/browser-use](https://github.com/browser-use/browser-use))  
> **Synthesized By**: Google Gemini Server-to-Server Autonomous AI Agent  
> **Timestamp**: 2026-09-28T19:14:20.331Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Forensic Learning Record: browser-use/browser-use

## 1. Executive Forensic Architecture & System Mechanics
`browser-use` acts as an abstraction layer between LLM reasoning engines and browser automation primitives (Playwright/CDP). Its core architecture relies on a **ReAct (Reasoning + Acting) loop** that translates natural language goals into a sequence of browser-specific actions. 

**Critical Subsystems:**
*   **Action Dispatcher:** Maps LLM tool calls to Playwright/CDP commands.
*   **Message Serializer:** Normalizes multi-modal inputs (screenshots, text) across heterogeneous LLM providers (OpenAI, Anthropic, Google).
*   **State Manager:** Tracks browser DOM state, history, and session persistence.
*   **Watchdogs:** Monitors action execution for hangs or invalid state transitions.

---

## 2. Deep Micro-Learnings & Runtime Gotchas

1.  **Case-Sensitive Schema Validation:**
    *   **Failure:** `AnthropicMessageSerializer` failed on valid data URLs due to case-sensitive checks on schemes/media types.
    *   **Root Cause:** Assumption that input data follows strict lowercase RFC standards.
    *   **Fix:** Always normalize input strings (`.lower()`) before schema validation or serialization.

2.  **System Instruction Erasure:**
    *   **Failure:** `GoogleMessageSerializer` dropped system instructions if an assistant message preceded the first user message.
    *   **Root Cause:** Rigid sequential parsing logic that assumes a specific turn-taking order.
    *   **Fix:** Implement a "State-Aware Message Reconstructor" that buffers system instructions and injects them into the final payload regardless of turn order.

3.  **The "Plus" Key Trap:**
    *   **Failure:** `send_keys` treated `+` as an empty key combination.
    *   **Root Cause:** Naive string splitting on `+` to identify key modifiers (e.g., `Ctrl+C`).
    *   **Fix:** Use an explicit key-mapping dictionary or a formal grammar parser rather than `split('+')`.

4.  **Hidden DOM Leakage:**
    *   **Failure:** `extract_clean_markdown` included text from `display:none` elements.
    *   **Root Cause:** Incomplete CSS selector filtering; failure to account for mixed-case CSS property values.
    *   **Fix:** Use `get_computed_style` via CDP to verify visibility rather than relying on static attribute parsing.

---

## 3. 8-Dimensional Multi-Axis Forensic Analysis

*   **D1: Structural Boundaries:** The system suffers from "Serializer Proliferation." Each LLM provider has a custom serializer, leading to drift. *Recommendation: Abstract to a unified `BaseMessageSerializer` with a strict `SchemaValidator` interface.*
*   **D2: Asynchronous State:** The `AgentHistory` management is prone to race conditions during rapid-fire tool execution.
*   **D3: Error Boundaries:** The system previously masked real step errors with generic "format errors." *Fix: Implement a `ResultWrapper` that separates `ExecutionStatus` from `ParsingStatus`.*
*   **D4: Resource Lifecycle:** Browser sessions are prone to "wedging." The introduction of explicit teardown handlers is a mandatory pattern for long-running automation.
*   **D5: Deserialization:** High risk of JSON injection/malformation from LLM outputs. *Fix: Use Pydantic models with strict `extra='forbid'` for all tool inputs.*
*   **D6: Cross-Platform:** CDP primitives behave differently across headless vs. headed modes.
*   **D7: CI/CD:** Automated test issue creation failed, indicating a lack of robust integration testing for the agent's own feedback loop.
*   **D8: Forensic Patches:** The shift to "Actor input semantics" suggests a move toward a more formal state machine for browser interactions.

---

## 4. Net-New Universal Engineering Rules

## 72. The "Normalization-First" Invariant

**RULE**:
All external inputs (LLM tool outputs, user strings, browser attributes) must be normalized to a canonical format (lowercase, stripped, validated) *before* entering the business logic layer.

**WHY**:
Case-sensitivity bugs in serialization and DOM parsing are the #1 cause of "flaky" agent behavior. Relying on the LLM to output "perfect" casing is a violation of the Robustness Principle.

**WHEN TO APPLY**:
Any subsystem handling cross-service communication, serialization, or DOM scraping.

---

## 5. Actionable Agent Skill & Implementation Checklist

- [ ] **Sanitization Layer:** Does the input parser handle mixed-case CSS properties and URL schemes?
- [ ] **State Reconstruction:** Does the message serializer handle out-of-order system/assistant/user turns?
- [ ] **Redaction Audit:** Are sensitive fields (API keys, PII) explicitly scrubbed from `AgentHistory` before disk persistence?
- [ ] **Teardown Guard:** Is there a `try...finally` block wrapping the browser session to ensure `browser.close()` executes even on fatal exceptions?
- [ ] **Error Transparency:** Does the agent report the *actual* browser execution error (e.g., `ElementNotInteractable`) rather than a generic `JSONDecodeError`?
- [ ] **Visibility Check:** Are you using `get_computed_style` to verify element visibility instead of checking `display: none` attributes?