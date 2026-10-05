> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/feder-cr-invisible_playwright_mcp-learnings.md`  
> **Source**: GitHub ([https://github.com/feder-cr/invisible_playwright_mcp](https://github.com/feder-cr/invisible_playwright_mcp))  
> **Synthesized By**: Google Gemini Server-to-Server Autonomous AI Agent  
> **Timestamp**: 2026-09-29T01:25:45.688Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Forensic Learning Record: feder-cr/invisible_playwright_mcp

## 1. Executive Forensic Architecture & System Mechanics
The repository functions as an **MCP (Model Context Protocol) Server** that abstracts Playwright browser automation into a set of LLM-consumable tools. Its core architecture acts as a **Bridge Pattern** between high-latency, stateful browser sessions and stateless, request-response LLM interactions. 

**Critical Subsystems:**
*   **Browser Orchestrator:** Manages the lifecycle of headless Chromium instances.
*   **Session State Manager:** Maintains context across multiple LLM turns to prevent browser re-initialization overhead.
*   **Navigation/Interaction Layer:** Translates natural language intent into DOM-specific Playwright actions (clicks, navigation, extraction).

## 2. Deep Micro-Learnings & Runtime Gotchas
*   **Failure Mode: Redirect-Induced Stalls.**
    *   **Root Cause:** Navigating to a URL that triggers an immediate client-side redirect often leaves the Playwright `page` object in a "pending" state, causing subsequent interaction commands to hang.
    *   **Fix:** Implement a `wait_until="networkidle"` or `domcontentloaded` guard with a strict timeout wrapper around all navigation primitives.
*   **Failure Mode: Windows/POSIX Path/Process Incompatibility.**
    *   **Root Cause:** MCP servers running under Claude Desktop on Windows often fail due to shell-specific path resolution or lack of proper `stdin/stdout` pipe handling for the MCP protocol.
    *   **Fix:** Use `sys.executable` to spawn sub-processes and ensure `stdio` is explicitly set to binary mode to prevent encoding corruption.
*   **Failure Mode: Long-Session Memory Bloat.**
    *   **Root Cause:** Accumulation of DOM nodes and event listeners in long-running browser sessions leads to memory exhaustion.
    *   **Fix:** Implement a "Session TTL" or a `page.close()` + `context.close()` cycle after a specific number of interactions or time threshold.
*   **Failure Mode: Ghost Click/Action Failure.**
    *   **Root Cause:** Attempting to interact with an element before the JS hydration completes or after a dynamic DOM update (SPA re-render).
    *   **Fix:** Use `page.wait_for_selector` with `state="visible"` before every interaction, coupled with a retry-logic decorator.

## 3. 8-Dimensional Multi-Axis Forensic Analysis
*   **D1: Structural Boundaries:** The system separates the MCP protocol layer from the Playwright execution layer. This allows for swapping the browser engine without breaking the MCP contract.
*   **D2: Asynchronous State:** Uses `asyncio` to manage concurrent browser tasks. **Risk:** Unbounded task creation. **Defense:** Use `asyncio.Semaphore` to limit concurrent browser tabs.
*   **D3: Error Boundaries:** The system relies on try-except blocks around browser actions. **Gap:** Needs a centralized "Browser Recovery" routine to reset the context if a navigation fails.
*   **D4: Resource Lifecycle:** Browser contexts are often leaked if the parent process terminates unexpectedly. **Defense:** Use `contextlib.AsyncExitStack` to ensure browser cleanup on shutdown.
*   **D5: Deserialization:** MCP inputs are JSON-RPC. **Risk:** Malicious prompts injecting JS into selectors. **Defense:** Strict schema validation using `Pydantic` before passing strings to `page.evaluate()`.
*   **D6: Cross-Platform:** Windows requires specific handling for `asyncio` event loops (ProactorEventLoop).
*   **D7: CI/CD:** The repo uses a "required gate" for README/Measurement consistency—a high-maturity practice for documentation-as-code.
*   **D8: Forensic Patches:** Recent fixes focus on "self-redirecting pages" and "long session stability," indicating a shift from MVP to production-grade robustness.

## 4. Net-New Universal Engineering Rules

## 72. The "Browser-as-a-Service" Lifecycle Invariant

**RULE**:
Every browser context must be bound to a `contextlib.AsyncExitStack` and initialized with a mandatory `timeout` and `max_lifetime` constraint.

**WHY**:
Browser automation is inherently non-deterministic. Without a hard `max_lifetime`, memory leaks in Chromium are inevitable. Without a `timeout` on every navigation, the entire MCP server will hang, blocking all subsequent LLM requests.

**WHEN TO APPLY**:
Any system wrapping headless browsers (Playwright, Puppeteer, Selenium) for agentic use.

## 5. Actionable Agent Skill & Implementation Checklist
- [ ] **Initialization:** Does the browser launch with `--disable-gpu` and `--no-sandbox` (for containerized environments)?
- [ ] **Navigation:** Is every `page.goto()` wrapped in a `try/except` block with a `wait_until` condition?
- [ ] **Interaction:** Are you using `page.wait_for_selector` *immediately* before every `click()` or `fill()`?
- [ ] **Cleanup:** Is there a `finally` block that ensures `context.close()` is called even if the agent crashes?
- [ ] **Observability:** Does the system log the URL and the specific DOM selector involved in every failed interaction?
- [ ] **Protocol:** Is the MCP server using `stdio` transport, and is it configured to ignore non-protocol stderr logs?