# Forensic Learning Record (Deep Inspection): letta-ai/letta

> **Canonical Artifact**: `07_PROJECT_LEARNING/letta-ai-letta-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/letta-ai/letta](https://github.com/letta-ai/letta))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:34:03.316Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `letta-ai/letta`
- **Description**: Platform for stateful agents: AI with advanced memory that can learn and self-improve over time.
- **Primary Language / Ecosystem**: Multi-language
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 25028 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3390** (2026-09-10): **[Bug]: Missing ClientTimeout in AsyncComposioToolSet leads to severe coroutine starvation**
  *Symptoms*: ### AI Disclosure  - [ ] This issue was written entirely by a human - [x] This issue was written with AI assistance (e.g. Copilot, ChatGPT, Claude) and **reviewed and edited by a human** - [x] I have read the [AI Policy](https://github.com/letta-ai/letta/blob/main/AI_POLICY.md) and agree to its terms  ### Human Verification  I have read the AI policy and I confirm this issue was reviewed by a human.  ### Describe the bug  What happened? In letta/functions/async_composio_toolset.py, the execute_action() method initiates an asynchronous external API call using aiohttp.ClientSession() without specifying a timeout parameter.  By default, aiohttp applies a 300-second (5-minute) global timeout when none is provided. When the Letta Agent interacts with real-world 3rd-party SaaS via Composio, unreliable network conditions or API tarpit delays will force the session.post operation to hang for up to 5 minutes per request. In a highly concurrent task bus, this lack of fail-fast configuration will quickly drain and starve all available worker coroutines, effectively stalling the entire Agent's event loop and rendering it unresponsive.  What did you expect to happen? A defensive, explicit system-level or framework-level timeout (e.g., aiohttp.ClientTimeout(total=15)) should be injected into the session instantiation. This ensures a "fail-fast" behavior, throwing a timeout exception promptly to free up the event loop instead of silently starving the task scheduling bus.  ### How are you ru
  **Post-Mortem & Fix Analysis**:
  > Confirmed the missing explicit `ClientTimeout` at `letta/functions/async_composio_toolset.py:72`, but I want to push back on the suggested `total=15` value and widen the scope — the same pattern exists in five other call sites in the codebase, and a unilateral 15 s cap on Composio actions would break legitimate long-running SaaS calls.  ## The 15 s suggestion is too aggressive for this site  Letta's own convention for outbound LLM/3rd-party API calls is `httpx.AsyncClient(timeout=300.0)`, used by `anthropic.py:145,201,314`, `zai.py:141,197,310`, and others. The aiohttp default of 300 s that this issue calls out actually matches that convention in practice — the real defect here is that the timeout is *implicit* (relying on aiohttp's default) rather than *explicit* in code, which makes it invisible to reviewers and easy to regress. Making it explicit with `aiohttp.ClientTimeout(total=300.0)` (or a project-wide constant) preserves current behavior while protecting against aiohttp changin
  > Thanks for the detailed analysis and the excellent proposal!  I completely agree that introducing a configurable timeout via settings.py is a much more robust and elegant approach than a hardcoded 15s limit. The 60s default and the bonus cleanup for the stray print statements sound great to me as well.  Please feel free to go ahead and open the PR with your proposed shape (a single sweeping PR for all call sites and cleanups would be awesome). Thanks for taking the time to drive this and improve the codebase!
  > I've implemented a fix on a branch: https://github.com/Vivekpatil200320/letta/tree/fix/composio-execute-action-timeout  Following the direction from the thread (configurable rather than hardcoded), it adds `ToolSettings.composio_execute_action_timeout` (default 60s, env `LETTA_COMPOSIO_EXECUTE_ACTION_TIMEOUT`) and passes it as an `aiohttp.ClientTimeout` to the session in `execute_action`. A timeout now surfaces as a clear `ComposioSDKError` ("... timed out after Ns") instead of hanging. I intentionally scoped it to the Composio tool-execution call only — the other `aiohttp.ClientSession()` sites are LLM-provider calls where generation can legitimately run for minutes, so a short tool-execution timeout shouldn't apply there. Includes two unit tests.  I went to open a PR but the repo currently limits PR creation to collaborators, so I can't submit it directly. Happy to open one if that can be enabled, or feel free to pull the branch — whatever's easiest for the team.

- **Issue #3388** (2026-09-10): **[Bug]: Cross-Session State Leakage via Persistent Core Memory Poisoning (Sandbox Isolation Failure)**
  *Symptoms*: ### AI Disclosure  - [ ] This issue was written entirely by a human - [x] This issue was written with AI assistance (e.g. Copilot, ChatGPT, Claude) and **reviewed and edited by a human** - [x] I have read the [AI Policy](https://github.com/letta-ai/letta/blob/main/AI_POLICY.md) and agree to its terms  ### Human Verification  I have read the AI policy and I confirm this issue was reviewed by a human.  ### Describe the bug  Letta's architecture persists agent core memory (e.g., persona, human blocks) to the backend database via update_memory_if_changed and block_manager.update_block. When Letta is deployed in continuous execution environments—such as automated LLM benchmark clusters or shared-daemon test runners—agents can utilize internal tools (e.g., core_memory_replace via ToolType.LETTA_MEMORY_CORE) to maliciously alter their persona.  Because the server lacks a hard tear-down or atomic block-flushing mechanism between independent tasks on the same daemon, these malicious memory modifications are permanently written to the database. Consequently, the poisoned context permanently leaks into subsequent, independent evaluation runs, breaking sandbox isolation and compromising the integrity of future test cases.  ### How are you running Letta?  From source  ### Operating System  macos 26.4.1 (25E253)  ### Letta Version  main (Latest)  ### Model  N/A  ### Steps to Reproduce  1. Initialize a SyncServer daemon and create an agent for an automated task/evaluation.  2. During the ta
  **Post-Mortem & Fix Analysis**:
  > This looks like a task-boundary problem as much as a memory-poisoning problem.  For benchmark clusters / shared daemons, I would separate:  - task-local writable memory: can be mutated during the run - canonical core memory: durable persona / human blocks - commit step: explicit promotion from task-local changes into canonical memory - teardown step: discard uncommitted task-local mutations  The invariant should be: an agent can use memory tools inside a task, but those writes do not become canonical continuity unless a trusted boundary promotes them. That gives you an atomic rollback point after each benchmark/evaluation.  Otherwise the memory tool becomes a cross-session privilege escalation path: a malicious task does not need to escape the sandbox if it can persist a new instruction into the next task's starting state.  This is one of the governance boundaries in my Enterprise AI OS architecture work: memory writes need scope, authority, and promotion semantics, not only storage du
  > I put together a candidate fix for this on my fork — [`DhruvaMyakeri/letta@fix/3388-ephemeral-memory-isolation`](https://github.com/DhruvaMyakeri/letta/tree/fix/3388-ephemeral-memory-isolation). The repo currently rejects external PRs so I wasn't able to open one, but I wanted to leave the approach here in case it's useful to whoever picks this up.  ## Approach  Add a session-scoped `ephemeral_memory: bool` field to `AgentState` using `Field(default=False, exclude=True)` — this keeps the flag out of the ORM round-trip so **no DB migration is required** and existing behavior is unchanged (default off).  When the flag is set on the in-memory `AgentState`:  - `Agent.update_memory_if_changed` (sync, `letta/agent.py`) short-circuits and returns `False` before touching `block_manager.update_block`. - `AgentManager.update_memory_if_changed_async` accepts a matching `ephemeral: bool = False` parameter and returns before the async block write. - All 9 call sites in `letta/services/tool_executor

- **Issue #3353** (2026-07-03): **[BUG]: MCP server refresh does not recover tools for legacy/flattened server config**
  *Symptoms*: ### AI Disclosure  - [x] This issue was written entirely by a human - [ ] This issue was written with AI assistance (e.g. Copilot, ChatGPT, Claude) and **reviewed and edited by a human** - [x] I have read the [AI Policy](https://github.com/letta-ai/letta/blob/main/AI_POLICY.md) and agree to its terms  ### Human Verification  I have read the AI policy and I confirm this issue was reviewed by a human.  ### Describe the bug  An existing MCP server can show zero tools after refresh even though the MCP service is valid and Letta can discover its tools through the connect/create paths.  This appears to be a Letta server/API config-normalization issue for persisted MCP server records, likely when an existing row has a legacy/flattened shape such as `mcp_server_type` / `server_url` instead of the current nested `config` shape.  ## Environment  - Letta Code CLI: `0.26.1` - Backend mode: Letta API / Constellation - MCP server type: `streamable_http` - MCP URL shape: OAuth-protected MCP endpoint  ## Observed behavior  In Letta Code `/mcp`, an existing MCP server was listed correctly, but its tools list was empty.  Calling:  ```http GET /v1/mcp-servers/{id}/tools ```  returned 0 tools.  Refreshing:  ```http PATCH /v1/mcp-servers/{id}/refresh ```  with the relevant `agent_id` also returned/synced 0 tools. The server record exposed flattened fields similar to:  ```json {   "id": "mcp_server-...",   "server_name": "dragonnet",   "mcp_server_type": "streamable_http",   "server_url": "https:/
  **Post-Mortem & Fix Analysis**:
  > Hi @ZanzyTHEbar (or maintainers), I'd like to take a stab at fixing this. Could someone assign it to me?  I've traced the issue to the refresh and tool-fetch paths not normalizing legacy/flattened server records before attempting discovery. My plan is to: - Add a `normalize_mcp_server_config()` helper - Apply it in the `PATCH /refresh` and `GET /tools` handlers - Surface a 422 error instead of silently returning 0 tools  Happy to open a PR once assigned. Thanks!
  > This looks like a classic issue with handling legacy configurations in the MCP server refresh logic. In our experience, we’ve encountered similar scenarios where flattened configurations lead to inconsistencies when the API normalizes data.   Here are a couple of suggestions to troubleshoot and potentially fix this:  - **Check Configuration Normalization**: Ensure that the normalization process properly handles legacy entries. You might need to add a migration script that converts existing rows to the expected nested structure before they hit the refresh logic.    - **Debug Logging**: Add more verbose logging around the `PATCH /v1/mcp-servers/{id}/refresh` endpoint. This can help you trace how the request is being processed and where it might be failing to retrieve the tools.  - **Manual Verification**: As a temporary workaround, you can manually update the server configuration to match the expected shape to see if that resolves the issue. This helps confirm whether the problem is stri
  > This is a useful issue to frame around memory reliability as an operational contract, not just a feature toggle.  For `MCP server refresh does not recover tools for legacy config`, I would try to capture a regression fixture with four visible states: what was accepted into the memory/tool pipeline, what was rejected or transformed, what was persisted, and what later recall returns. That makes it possible to distinguish retrieval quality problems from write-path corruption, provider mismatch, or context-budget behavior.  In production agent systems the failure mode is often silent: a memory write looks successful, a tool output is compressed or cached, then a later agent turn reasons from incomplete state. A small end-to-end test that records the write, index/update, recall, and trace metadata would make this much easier to debug and safer for self-hosted deployments. 

- **Issue #3346** (2026-07-03): **OpenAI-compatible /v1/chat/completions endpoint rejects standard image_url content blocks**
  *Symptoms*: ### AI Disclosure  - [ ] This issue was written entirely by a human - [x] This issue was written with AI assistance (e.g. Copilot, ChatGPT, Claude) and **reviewed and edited by a human** - [x] I have read the [AI Policy](https://github.com/letta-ai/letta/blob/main/AI_POLICY.md) and agree to its terms  ### Human Verification  I have read the AI policy and I confirm this issue was reviewed by a human.  ### Describe the bug  ### Summary Letta's OpenAI-compatible POST /v1/chat/completions endpoint rejects the standard OpenAI image_url content block format with a Pydantic validation error. The endpoint's internal MessageContentType enum only accepts Letta's native image tag, so any OpenAI-compatible client that sends an image in the documented OpenAI format is blocked at validation. Letta's native API at POST /v1/agents/{id}/messages accepts image inputs correctly using the documented {"type": "image", "source": {...}} shape. The bug is specifically in the OpenAI-compat translation layer, which does not normalize image_url content blocks into Letta's native image + source shape before validation. This affects any integration that points an OpenAI-style client at Letta as a provider. In our case it surfaces through Open WebUI, where Letta is registered as an OpenAI API connection and users cannot upload images to their agents.   ### Why this matters Any OpenAI-compatible client that supports vision will send the OpenAI standard format. That includes Open WebUI, LiteLLM-wrapped clie
  **Post-Mortem & Fix Analysis**:
  > I dug into this and confirmed the root cause: `letta/server/rest_api/routers/v1/chat_completions.py` (the `/v1/chat/completions` "agent as model" endpoint) forwards `last_user_message.get("content", "")` straight into `MessageCreate` without any normalization. Letta's native `MessageCreate.content` discriminated union only knows `{"type": "text", ...}` and `{"type": "image", "source": {...}}`, so any `{"type": "image_url", "image_url": {"url": ...}}` block (the OpenAI standard vision format) gets rejected at validation with the 422 you saw.  I implemented and tested a fix (it's small — adds one normalization helper and wires it into the one call site):  **`letta/helpers/message_helper.py`** — add a `translate_openai_content_to_letta()` helper that walks the content list and converts `image_url` blocks into Letta's native shape, reusing the existing `_validate_image_source_url`/`_parse_data_image_url` helpers (the same ones the native `/v1/agents/{id}/messages` image path already uses, 
  > Thanks @rahulsolanki001, this matches the intent of the original report exactly.   **Confirming as the reporter:**  **Root cause is the same one I traced:** chat_completions.py passes last_user_message content into MessageCreate with no normalization, so the OpenAI-standard image_url block dies at the discriminated union.  Your translate_openai_content_to_letta() approach is the right shape, and reusing the existing _validate_image_source_url / _parse_data_image_url helpers keeps scheme validation consistent with the native /v1/agents/{id}/messages image path, which is better than the standalone translation sketch in my report. The test coverage (round-trip through MessageCreate validation, data URL and remote URL paths, scheme rejection) covers the failure mode I hit through Open WebUI.  **For maintainers:** the fix is small and self-contained (one helper plus one call site), and the working branch is at devteamaegis/letta@3fb9ffb. Reporter and fixer are aligned, so this should be a c
  > Closing as stale: no activity in 2+ weeks (cleanup on 2026-07-02). If this is still an issue, please comment or reopen and we'll take another look.

- **Issue #3339** (2026-06-28): **ADE crashes with "useUMIWorker must be used within a UMIWorkerProvider" on self-hosted server**
  *Symptoms*: ### AI Disclosure  - [ ] This issue was written entirely by a human - [x] This issue was written with AI assistance (e.g. Copilot, ChatGPT, Claude) and **reviewed and edited by a human** - [x] I have read the [AI Policy](https://github.com/letta-ai/letta/blob/main/AI_POLICY.md) and agree to its terms  ### Human Verification  I have read the AI policy and I confirm this issue was reviewed by a human.  ### Describe the bug  When using a self-hosted Letta server connected via app.letta.com (Self-Hosted servers), clicking "Open in ADE" on any agent causes the ADE to crash with the generic error:  > There was a severe error in this application, please refresh this page.  The browser console reveals the actual React error:  Error: useUMIWorker must be used within a UMIWorkerProvider     at $ (https://web-cdn.letta.com/_next/static/chunks/9525-e27633abb0a4715e.js:1:8747766)     at _ (https://web-cdn.letta.com/_next/static/chunks/9525-e27633abb0a4715e.js:1:8781837)     at l9 (https://web-cdn.letta.com/_next/static/chunks/87c73c54-666c9ffaf9cb0562.js:1:51511)     at HTMLLinkElement.r (https://web-cdn.letta.com/_next/static/chunks/5598-d96220050ff3690e.js:17:4527)  The self-hosted server API is healthy — all network requests return HTTP 200. The crash is purely a frontend React context issue in app.letta.com.  ### How are you running Letta?  Docker  ### Operating System  Windows 11   ### Letta Version  _No response_  ### Model  _No response_  ### Steps to Reproduce  1. Register a self-
  **Post-Mortem & Fix Analysis**:
  > This issue is stale because it has been open for 30 days with no activity.
  > This issue was closed because it has been inactive for 14 days since being marked as stale.

- **Issue #3331** (2026-05-01): **OSS local MemFS backend requires LETTA_MEMFS_SERVICE_URL even though it ignores the value**
  *Symptoms*: ### AI Disclosure  - [ ] This issue was written entirely by a human - [x] This issue was written with AI assistance (e.g. Copilot, ChatGPT, Claude) and **reviewed and edited by a human** - [x] I have read the [AI Policy](https://github.com/letta-ai/letta/blob/main/AI_POLICY.md) and agree to its terms  ### Human Verification  I have read the AI policy and I confirm this issue was authored by Daimon but reviewed by a human (Amos Elroy).  ### Describe the bug  ## Summary  The OSS `LocalStorageBackend` / `memfs_client_base.py` implementation stores git repositories on the local filesystem and does not connect to any external service. However, `_init_memory_repo_manager()` in `server.py` gates MemFS activation on `LETTA_MEMFS_SERVICE_URL` being set — a check that exists for the cloud/enterprise client but is shared by the OSS implementation despite being irrelevant to it.  When the env var is not set, MemFS silently does nothing. No error is raised, no warning is visible — the `git-memory-enabled` tag on the agent simply has no effect.  ## Root cause  In `letta/server/server.py`:  ```python def _init_memory_repo_manager(self) -> Optional[MemfsClient]:     if not settings.memfs_service_url:         logger.debug("Memory repo manager not configured (memfs_service_url not set)")         return None     return MemfsClient(base_url=settings.memfs_service_url) ```  In `letta/services/memory_repo/memfs_client_base.py` (the OSS implementation):  ```python def __init__(self, base_url: str |
  **Post-Mortem & Fix Analysis**:
  > **This issue was automatically closed** because it does not meet our submission requirements.  **What failed:** - Missing human verification phrase  **To submit an issue, please:** 1. Use one of the [issue templates](https://github.com/letta-ai/letta/issues/new/choose) 2. Fill out the **AI Disclosure** checkboxes 3. Copy the **Human Verification** phrase exactly as shown 4. Read our [AI Policy](https://github.com/letta-ai/letta/blob/main/AI_POLICY.md)  If you believe this was a mistake, please reach out on [Discord](https://discord.gg/9GEQrxmVyE).

- **Issue #3303** (2026-05-27): **Empty `messages` payload reaches agent loop and crashes with `IndexError`**
  *Symptoms*: ### AI Disclosure  - [ ] This issue was written entirely by a human - [x] This issue was written with AI assistance (e.g. Copilot, ChatGPT, Claude) and **reviewed and edited by a human** - [x] I have read the [AI Policy](https://github.com/letta-ai/letta/blob/main/AI_POLICY.md) and agree to its terms  ### Human Verification  I have read the AI policy and I confirm this issue was reviewed by a human.  ### Describe the bug  `LettaRequest.validate_input_or_messages` only rejects `messages is None`; it does not reject `messages=[]`. All V2/V3 agent entrypoints call `_prepare_in_context_messages_no_persist_async`, which immediately dereferences `input_messages[0]`.  Sending `{ "messages": [] }` bypasses validation and crashes with `IndexError`, returning 500 instead of 4xx.  ```python # letta/schemas/letta_request.py if self.input is None and self.messages is None:     raise ValueError("Must specify either 'input' or 'messages'.") # messages=[] passes this check ↑  # letta/agents/helpers.py if input_messages[0].type == "tool_return":  # ← IndexError ```  **Fix**: Reject empty arrays in the validator:  ```python if self.messages is not None and len(self.messages) == 0:     raise ValueError("'messages' must not be empty.") ```  ###   ### How are you running Letta?  From source  ### Operating System  Linux  ### Letta Version  latest main  ### Model  _No response_  ### Steps to Reproduce  curl -X POST http://localhost:8283/v1/agents/{agent_id}/messages \   -H "Content-Type: applicatio
  **Post-Mortem & Fix Analysis**:
  > I'll take this. Missing empty-list validation on `messages` — allows `[]` through to code that does `input_messages[0]`. PR incoming.
  > ChatGPT spam
  > I’m not interested in emotional reactions without structure.  If you think my post is incorrect, point to the causal chain, the technical issue, or the exact part that fails. If your reply is only “ChatGPT spam,” then there is nothing to discuss.  I may not write English perfectly, but I do write with structure. So my question is simple: what exactly is your issue?  If there is no concrete argument, no technical point, and no clear objection, then this is just noise, not discussion.  I’ve reported this comment.

- **Issue #3302** (2026-09-10): **PATCH /tools silently disables parallel execution when the field is omitted**
  *Symptoms*: ### AI Disclosure  - [ ] This issue was written entirely by a human - [x] This issue was written with AI assistance (e.g. Copilot, ChatGPT, Claude) and **reviewed and edited by a human** - [x] I have read the [AI Policy](https://github.com/letta-ai/letta/blob/main/AI_POLICY.md) and agree to its terms  ### Human Verification  I have read the AI policy and I confirm this issue was reviewed by a human.  ### Describe the bug  `ToolUpdate.enable_parallel_execution` defaults to `False` instead of `None`. The patch endpoint passes `ToolUpdate` straight into `update_tool_by_id_async`, which does `tool_update.model_dump(..., exclude_none=True)`. Because default `False` is not `None`, it is serialized even when the client never sent the field.  Any PATCH that only changes description, schema, or tags therefore overwrites a previously-enabled parallel tool with `enable_parallel_execution=false`.  ```python # letta/schemas/tool.py enable_parallel_execution: Optional[bool] = Field(False, ...)  # default False, not None  # letta/services/tool_manager.py update_data = tool_update.model_dump(to_orm=True, exclude_none=True) # False != None, so it's always included ```  **Fix**: Make `ToolUpdate.enable_parallel_execution` default to `None`, or use `exclude_unset=True`.  ### How are you running Letta?  From source  ### Operating System  Linux  ### Letta Version  latest main  ### Model  _No response_  ### Steps to Reproduce  1. Create a tool with `enable_parallel_execution=True` 2. PATCH the too
  **Post-Mortem & Fix Analysis**:
  > I'll take this. Classic Pydantic partial-update bug — `enable_parallel_execution` defaults to `False` instead of `None`, so `exclude_none=True` includes it when unset. PR incoming.
  > I've prepared a fix for this issue:  **Branch**: [`ameenalkhaldi:fix/issue-3302-patch-parallel-execution`](https://github.com/ameenalkhaldi/letta/tree/fix/issue-3302-patch-parallel-execution)  **Changes**: 1. Changed `ToolUpdate.enable_parallel_execution` default from `False` to `None` in `letta/schemas/tool.py` 2. Added regression test in `tests/managers/test_tool_manager.py`  This follows the existing pattern used by `default_requires_approval` (which already defaults to `None`). The `Tool` and `ToolCreate` schemas keep their `False` default since that's correct for creation.  **Compare URL**: https://github.com/letta-ai/letta/compare/main...ameenalkhaldi:letta:fix/issue-3302-patch-parallel-execution  (Having trouble creating the PR via CLI - will submit via web interface)
  > I've investigated this and traced it to a one-line root cause in `letta/schemas/tool.py`:  **Root cause**: `ToolUpdate.enable_parallel_execution` defaults to `False` instead of `None`. Combined with `model_dump(exclude_none=True)` in the update path, this field is *always* serialized into the update payload, silently overwriting the existing DB value on every PATCH.  **Fix**: Change the default from `False` to `Optional[bool] = None`.  I've prepared a branch with the fix + two regression tests (schema-level and manager-level): https://github.com/FBISiri/letta/tree/fix/3302-tool-update-parallel-execution  Unfortunately I can't submit a cross-repo PR because this repo has `pull_request_creation_policy: collaborators_only`. If a maintainer could either: 1. Open a PR from my branch (`FBISiri:fix/3302-tool-update-parallel-execution`, commit `82f02073e`), or 2. Temporarily allow external PRs  I'd appreciate it. The fix is minimal (~7 lines schema change + 55 lines tests). Both tests fail on 

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & Real Production Code Patches
Observed empirical fixes and code patches:

### Incident Patch 1: `5bcdd177` (2026-09-10)
**Commit Message**: docs: limit security reports to maintained projects (#3442)

Co-authored-by: Charles Packer <[REDACTED_EMAIL]>
Co-authored-by: Letta Code <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +2/-5)
```diff
@@ -4,9 +4,6 @@ Build stateful agents with memory that can learn and improve over time.
 
 Letta (f.k.a. MemGPT) is actively developed. The current source code lives in [`letta-ai/letta-code`](https://github.com/letta-ai/letta-code), which includes the agent harness, interactive terminal UI, App Server, channels, and the runtime used by the desktop and web apps.
 
-> [!NOTE]
-> This repository now serves as a landing page for the Letta project. The retired Letta V1 server source is preserved on the [`archive`](https://github.com/letta-ai/letta/tree/archive) branch for historical reference.
-
 ## Get started
 
 Install Letta from npm:
@@ -35,8 +32,8 @@ You can also use Letta through:
 - the [Letta Agent SDK](https://docs.letta.com/letta-agent-sdk/overview) for building agents into TypeScript applications
 - [Letta Cloud](https://github.com/letta-ai/letta-code#letta-cloud) for keeping agent memory, identity, and conversations available across computers
 
-See the [`letta-ai/letta-code`](https://github.com/letta-ai/letta-code) README and the [Letta documentation](https://docs.letta.com) for current installation, development, and deployment instructions.
+See the [Letta documentation](https://docs.letta.com) for current installation, development, and deployment instructions.
 
 ## Historical source
 
-The [`archive`](https://github.com/letta-ai/letta/tree/archive) branch contains the retired Letta V1 API server as it existed when this repository was archived. Existing tags and releases remain available for reproducibility. That source is unsupported, receives no fixes or security updates, and should not be used in production.
+The [`archive`](https://github.com/letta-ai/letta/tree/archive) branch contains the retired Letta V1 API server. Existing tags and releases remain available for reproducibility, but active projects should use the [current source](https://github.com/letta-ai/letta-code).
```

**File**: `SECURITY.md` (modified, +15/-3)
```diff
@@ -1,9 +1,21 @@
 # Security Policy
 
-## Archived source
+## Supported projects
 
-The legacy Letta V1 server preserved on the [`archive`](https://github.com/letta-ai/letta/tree/archive) branch is unsupported and receives no security updates. It should not be used in production.
+We accept vulnerability reports only for actively maintained Letta repositories and supported releases. Follow the security policy in the affected project's repository. The current Letta implementation lives in [`letta-ai/letta-code`](https://github.com/letta-ai/letta-code).
+
+## Out of scope: retired Python server
+
+This repository is a landing page, not an actively maintained server. The legacy Letta V1 Python server is retired, unsupported, and receives no fixes or security updates. It should not be used in production.
+
+Please do not submit vulnerability reports that apply only to:
+
+- The retired server source on the [`archive`](https://github.com/letta-ai/letta/tree/archive) branch or in this repository's historical tags and releases.
+- The legacy Python server packages associated with that code.
+- The retired `letta/letta` Docker images, regardless of tag.
+
+These artifacts are outside the scope of our security reporting policy. If the same vulnerability also affects an actively maintained project, report it with steps to reproduce against a supported version of that project instead.
 
 ## Reporting a vulnerability in current Letta products
 
-Please email support@letta.com with a description of the vulnerability, steps to reproduce, and any relevant details. Do not open a public issue for security vulnerabilities.
+Please email support@letta.com with the affected repository or product, version or commit, a description of the vulnerability, steps to reproduce, and any relevant details. Do not open a public issue for security vulnerabilities.
```

---

### Incident Patch 2: `e0d746e5` (2026-09-10)
**Commit Message**: fix: update privacy policy contact address (#3441)

Co-authored-by: Cameron <[REDACTED_EMAIL]>
Co-authored-by: Letta Code <[REDACTED_EMAIL]>

**File**: `PRIVACY.md` (modified, +1/-1)
```diff
@@ -185,7 +185,7 @@ If your appeal is denied, in some US states (Colorado, Connecticut, and Virginia
 
 ### How to Reach Us
 
-If you have a question about this Privacy Policy, please contact us through our via [email](mailto:contact@charlespacker.com).
+If you have a question about this Privacy Policy, please contact us at [support@letta.com](mailto:support@letta.com).
 
 ### Other Things You Should Know (Keep Reading!)
 
```

---

### Incident Patch 3: `ff19ffea` (2026-08-01)
**Commit Message**: fix: require explicit AI tool disclosure in issues (#3421)

Co-authored-by: Letta Code <[REDACTED_EMAIL]>

**File**: `.github/ISSUE_TEMPLATE/bug_report.yml` (modified, +16/-7)
```diff
@@ -15,23 +15,32 @@ body:
       label: AI Disclosure
       description: |
         We require all issue authors to disclose AI usage per our [AI Policy](https://github.com/letta-ai/letta/blob/main/AI_POLICY.md).
-        Check **all** that apply.
+        Select **exactly one** authorship option, identify every AI tool used below, and acknowledge the policy.
       options:
         - label: This issue was written entirely by a human
-        - label: This issue was written with AI assistance (e.g. Copilot, ChatGPT, Claude) and **reviewed and edited by a human**
+        - label: This issue was written with AI assistance and **reviewed and edited by a human**
         - label: I have read the [AI Policy](https://github.com/letta-ai/letta/blob/main/AI_POLICY.md) and agree to its terms
           required: true
     validations:
       required: true
 
+  - type: input
+    id: ai-tools
+    attributes:
+      label: AI Tool(s) Used
+      description: List every AI tool used to research or write this issue (for example, Claude Code, Cursor, Copilot, or ChatGPT). If no AI tool was used, enter `None`.
+      placeholder: "e.g. Claude Code and ChatGPT, or None"
+    validations:
+      required: true
+
   - type: textarea
-    id: human-verification
+    id: repository-acknowledgment
     attributes:
-      label: Human Verification
+      label: Repository Acknowledgment
       description: |
-        To help us combat spam, please copy and paste the following phrase **exactly** into the box below:
-        `I have read the AI policy and I confirm this issue was reviewed by a human.`
-      placeholder: "I have read the AI policy and I confirm this issue was reviewed by a human."
+        Read [AGENTS.md](https://github.com/letta-ai/letta/blob/main/AGENTS.md), then copy and paste the following phrase **exactly**:
+        `I have read AGENTS.md and understand that issues about the current Letta server, agent harness, CLI, or channel integrations belong in letta-ai/letta-code, not this repository.`
+      placeholder: "I have read AGENTS.md and understand that issues about the current Letta server, agent harness, CLI, or channel integrations belong in letta-ai/letta-code, not this repository."
     validations:
       required: true
 
```

**File**: `.github/ISSUE_TEMPLATE/feature_request.yml` (modified, +16/-7)
```diff
@@ -15,23 +15,32 @@ body:
       label: AI Disclosure
       description: |
         We require all issue authors to disclose AI usage per our [AI Policy](https://github.com/letta-ai/letta/blob/main/AI_POLICY.md).
-        Check **all** that apply.
+        Select **exactly one** authorship option, identify every AI tool used below, and acknowledge the policy.
       options:
         - label: This issue was written entirely by a human
-        - label: This issue was written with AI assistance (e.g. Copilot, ChatGPT, Claude) and **reviewed and edited by a human**
+        - label: This issue was written with AI assistance and **reviewed and edited by a human**
         - label: I have read the [AI Policy](https://github.com/letta-ai/letta/blob/main/AI_POLICY.md) and agree to its terms
           required: true
     validations:
       required: true
 
+  - type: input
+    id: ai-tools
+    attributes:
+      label: AI Tool(s) Used
+      description: List every AI tool used to research or write this issue (for example, Claude Code, Cursor, Copilot, or ChatGPT). If no AI tool was used, enter `None`.
+      placeholder: "e.g. Claude Code and ChatGPT, or None"
+    validations:
+      required: true
+
   - type: textarea
-    id: human-verification
+    id: repository-acknowledgment
     attributes:
-      label: Human Verification
+      label: Repository Acknowledgment
       description: |
-        To help us combat spam, please copy and paste the following phrase **exactly** into the box below:
-        `I have read the AI policy and I confirm this issue was reviewed by a human.`
-      placeholder: "I have read the AI policy and I confirm this issue was reviewed by a human."
+        Read [AGENTS.md](https://github.com/letta-ai/letta/blob/main/AGENTS.md), then copy and paste the following phrase **exactly**:
+        `I have read AGENTS.md and understand that issues about the current Letta server, agent harness, CLI, or channel integrations belong in letta-ai/letta-code, not this repository.`
+      placeholder: "I have read AGENTS.md and understand that issues about the current Letta server, agent harness, CLI, or channel integrations belong in letta-ai/letta-code, not this repository."
     validations:
       required: true
 
```

**File**: `.github/workflows/issue-guard.yml` (modified, +24/-10)
```diff
@@ -80,10 +80,10 @@ jobs:
 
             const failures = [];
 
-            // Check 1: Magic phrase
-            const magicPhrase = 'I have read the AI policy and I confirm this issue was reviewed by a human.';
-            if (!body.includes(magicPhrase)) {
-              failures.push('Missing human verification phrase');
+            // Check 1: Repository acknowledgment phrase
+            const repositoryAcknowledgment = 'I have read AGENTS.md and understand that issues about the current Letta server, agent harness, CLI, or channel integrations belong in letta-ai/letta-code, not this repository.';
+            if (!body.includes(repositoryAcknowledgment)) {
+              failures.push('Missing exact repository acknowledgment phrase');
             }
 
             // Check 2: AI disclosure checkbox (the required one: "I have read the AI Policy")
@@ -93,11 +93,24 @@ jobs:
               failures.push('AI Policy acknowledgment checkbox not checked');
             }
 
-            // Check 3: At least one of the two disclosure options is checked
+            // Check 3: Exactly one authorship option must be checked
             const humanWritten = /- \[[xX]\] This issue was written entirely by a human/.test(body);
             const aiAssisted = /- \[[xX]\] This issue was written with AI assistance/.test(body);
-            if (!humanWritten && !aiAssisted) {
-              failures.push('No AI disclosure option selected (must indicate whether issue is human-written or AI-assisted)');
+            if (humanWritten === aiAssisted) {
+              failures.push('Select exactly one authorship option (human-written or AI-assisted)');
+            }
+
+            // Check 4: AI tools must be explicitly disclosed. GitHub issue forms render
+            // input values under a level-three Markdown heading.
+            const aiToolsMatch = body.match(/### AI Tool\(s\) Used\s*\n+([\s\S]*?)(?=\n### |$)/i);
+            const aiTools = (aiToolsMatch?.[1] || '').trim();
+            const noTools = /^(none|n\/a|no ai(?: tools?)?)\.?$/i.test(aiTools);
+            if (!aiTools || /^_?no response_?$/i.test(aiTools)) {
+              failures.push('AI Tool(s) Used must list every tool used, or state None');
+            } else if (aiAssisted && noTools) {
+              failures.push('AI-assisted issues must name the AI tool(s) used');
+            } else if (humanWritten && !noTools) {
+              failures.push('Human-written issues must state None under AI Tool(s) Used');
             }
 
             if (failures.length === 0) {
@@ -116,9 +129,10 @@ jobs:
               ``,
               `**To submit an issue, please:**`,
               `1. Use one of the [issue templates](https://github.com/${context.repo.owner}/${context.repo.repo}/issues/new/choose)`,
-              `2. Fill out the **AI Disclosure** checkboxes`,
-              `3. Copy the **Human Verification** phrase exactly as shown`,
-              `4. Read our [AI Policy](https://github.com/${context.repo.owner}/${context.repo.repo}/blob/main/AI_POLICY.md)`,
+              `2. Select exactly one **AI Disclosure** authorship option`,
+              `3. Name every AI tool used, or state **None**`,
+              `4. Copy the **Repository Acknowledgment** phrase exactly as shown`,
+              `5. Read our [AI Policy](https://github.com/${context.repo.owner}/${context.repo.repo}/blob/main/AI_POLICY.md) and [AGENTS.md](https://github.com/${context.repo.owner}/${context.repo.repo}/blob/main/AGENTS.md)`,
               ``,
               `If you believe this was a mistake, please reach out on [Discord](https://discord.gg/9GEQrxmVyE).`,
             ].join('\n');
```

**File**: `AI_POLICY.md` (modified, +3/-2)
```diff
@@ -35,9 +35,10 @@ Do not file issues or pull requests in this repository with an expectation that
 Issues that do not comply with this policy will be **automatically closed and locked**.
 Specifically, all issues must:
 
-1. Fill out the **AI Disclosure** checkboxes indicating whether the issue was human-written or AI-assisted.
-2. Include the **Human Verification** phrase as instructed in the issue template.
+1. Select exactly one **AI Disclosure** option indicating whether the issue was human-written or AI-assisted.
+2. Name every AI tool used to research or write the issue, or explicitly state `None` if no AI tool was used.
 3. Acknowledge that they have read this policy.
+4. Include the exact **Repository Acknowledgment** phrase from the issue template confirming that they read [AGENTS.md](AGENTS.md) and understand which issues belong in [letta-ai/letta-code](https://github.com/letta-ai/letta-code).
 
 Members of the [letta-ai](https://github.com/letta-ai) GitHub organization and
 [trusted contributors](.github/TRUSTED_CONTRIBUTORS) are exempt from automated checks,
```

---

### Incident Patch 4: `11315357` (2026-05-14)
**Commit Message**: fix(security): use JSON instead of pickle for sandbox->server tool result transport (#3343)

**File**: `letta/functions/composio_helpers.py` (modified, +1/-1)
```diff
@@ -79,7 +79,7 @@ async def execute_composio_action_async(
         print(type(e))
         raise RuntimeError(f"An unexpected error occurred in Composio SDK while executing action '{action_name}': {str(e)}")
 
-    if "error" in response and response["error"]:
+    if response.get("error"):
         raise RuntimeError(f"Error while executing action '{action_name}': {str(response['error'])}")
 
     return response.get("data")
```

**File**: `letta/llm_api/chatgpt_oauth_client.py` (modified, +0/-1)
```diff
@@ -45,7 +45,6 @@
 from letta.log import get_logger
 from letta.otel.tracing import trace_method
 from letta.schemas.enums import AgentType, ProviderCategory
-from letta.schemas.letta_message_content import TextContent
 from letta.schemas.llm_config import LLMConfig
 from letta.schemas.message import Message as PydanticMessage
 from letta.schemas.openai.chat_completion_response import (
```

**File**: `letta/llm_api/google_vertex_client.py` (modified, +0/-1)
```diff
@@ -40,7 +40,6 @@
 from letta.otel.tracing import trace_method
 from letta.schemas.agent import AgentType
 from letta.schemas.enums import ProviderCategory
-from letta.schemas.letta_message_content import TextContent
 from letta.schemas.llm_config import LLMConfig
 from letta.schemas.message import Message as PydanticMessage
 from letta.schemas.openai.chat_completion_request import Tool, Tool as OpenAITool
```

**File**: `letta/schemas/providers.py` (modified, +4/-3)
```diff
@@ -4,11 +4,11 @@
 
 import aiohttp
 import requests
+from letta.llm_api.azure_openai import get_azure_chat_completions_endpoint, get_azure_embeddings_endpoint
+from letta.llm_api.azure_openai_constants import AZURE_MODEL_TO_CONTEXT_LENGTH
 from pydantic import BaseModel, Field, model_validator
 
 from letta.constants import DEFAULT_EMBEDDING_CHUNK_SIZE, LETTA_MODEL_ENDPOINT, LLM_MAX_TOKENS, MIN_CONTEXT_WINDOW
-from letta.llm_api.azure_openai import get_azure_chat_completions_endpoint, get_azure_embeddings_endpoint
-from letta.llm_api.azure_openai_constants import AZURE_MODEL_TO_CONTEXT_LENGTH
 from letta.schemas.embedding_config import EmbeddingConfig
 from letta.schemas.embedding_config_overrides import EMBEDDING_HANDLE_OVERRIDES
 from letta.schemas.enums import ProviderCategory, ProviderType
@@ -1537,9 +1537,10 @@ class BedrockProvider(Provider):
 
     def check_api_key(self):
         """Check if the Bedrock credentials are valid"""
-        from letta.errors import LLMAuthenticationError
         from letta.llm_api.aws_bedrock import bedrock_get_model_list
 
+        from letta.errors import LLMAuthenticationError
+
         try:
             # For BYOK providers, use the custom credentials
             if self.provider_category == ProviderCategory.byok:
```

**File**: `letta/server/rest_api/routers/openai/chat_completions/chat_completions.py` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 import asyncio
-from typing import TYPE_CHECKING, List, Optional, Union
+from typing import TYPE_CHECKING, List, Union
 
-from fastapi import APIRouter, Body, Depends, Header, HTTPException
+from fastapi import APIRouter, Body, Depends, HTTPException
 from fastapi.responses import StreamingResponse
 from openai.types.chat.completion_create_params import CompletionCreateParams
 
```

**File**: `letta/services/files_agents_manager.py` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 from datetime import datetime, timezone
 from typing import Dict, List, Optional, Union
 
-from sqlalchemy import and_, func, or_, select, tuple_, update
+from sqlalchemy import and_, func, select, tuple_, update
 
 from letta.log import get_logger
 from letta.orm.errors import NoResultFound
```

**File**: `letta/services/helpers/tool_parser_helper.py` (modified, +16/-7)
```diff
@@ -1,6 +1,6 @@
 import ast
 import base64
-import pickle
+import json
 from typing import Any, Union
 
 from letta.constants import REQUEST_HEARTBEAT_DESCRIPTION, REQUEST_HEARTBEAT_PARAM, SEND_MESSAGE_TOOL_NAME
@@ -11,16 +11,25 @@
 
 def parse_stdout_best_effort(text: Union[str, bytes]) -> tuple[Any, AgentState | None]:
     """
-    Decode and unpickle the result from the function execution if possible.
+    Decode the JSON-encoded result emitted by the tool sandbox.
     Returns (function_return_value, agent_state).
+
+    The transport is JSON; AgentState is rehydrated via pydantic validation.
     """
     if not text:
         return None, None
-    if isinstance(text, str):
-        text = base64.b64decode(text)
-    result = pickle.loads(text)
-    agent_state = result["agent_state"]
-    return result["results"], agent_state
+    if isinstance(text, bytes):
+        payload = text.decode("utf-8")
+    else:
+        # Legacy callers (e.g. E2B) may send a base64-encoded blob of JSON bytes.
+        try:
+            payload = base64.b64decode(text, validate=True).decode("utf-8")
+        except Exception:
+            payload = text
+    result = json.loads(payload)
+    agent_state_payload = result.get("agent_state")
+    agent_state = AgentState.model_validate(agent_state_payload) if agent_state_payload else None
+    return result.get("results"), agent_state
 
 
 def parse_function_arguments(source_code: str, tool_name: str):
```

**File**: `letta/services/tool_executor/tool_execution_sandbox.py` (modified, +22/-8)
```diff
@@ -1,7 +1,7 @@
 import base64
 import io
+import json
 import os
-import pickle
 import subprocess
 import sys
 import tempfile
@@ -473,13 +473,17 @@ def list_running_e2b_sandboxes(self):
     # general utility functions
 
     def parse_best_effort(self, text: str) -> Any:
+        """Decode the JSON-encoded payload emitted by the tool sandbox.
+
+        AgentState is rehydrated via pydantic validation.
+        """
         if not text:
             return None, None
-        result = pickle.loads(base64.b64decode(text))
-        agent_state = None
-        if result["agent_state"] is not None:
-            agent_state = result["agent_state"]
-        return result["results"], agent_state
+        decoded = base64.b64decode(text).decode("utf-8")
+        result = json.loads(decoded)
+        agent_state_payload = result.get("agent_state")
+        agent_state = AgentState.model_validate(agent_state_payload) if agent_state_payload else None
+        return result.get("results"), agent_state
 
     def generate_execution_script(self, agent_state: AgentState, wrap_print_with_markers: bool = False) -> str:
         """
@@ -501,6 +505,7 @@ def generate_execution_script(self, agent_state: AgentState, wrap_print_with_mar
         # dump JSON representation of agent state to re-load
         code = "from typing import *\n"
         code += "import pickle\n"
+        code += "import json as _letta_json\n"
         code += "import sys\n"
         code += "import base64\n"
 
@@ -556,14 +561,23 @@ def generate_execution_script(self, agent_state: AgentState, wrap_print_with_mar
 
         # TODO: handle wrapped print
 
+        code += "if agent_state is not None:\n"
+        code += "    try:\n"
+        code += "        _letta_agent_state_payload = agent_state.model_dump(mode='json')\n"
+        code += "    except Exception:\n"
+        code += "        _letta_agent_state_payload = None\n"
+        code += "else:\n"
+        code += "    _letta_agent_state_payload = None\n"
         code += (
             self.LOCAL_SANDBOX_RESULT_VAR_NAME
             + ' = {"results": '
             + self.invoke_function_call(inject_agent_state=inject_agent_state)  # this inject_agent_state is the main difference
-            + ', "agent_state": agent_state}\n'
+            + ', "agent_state": _letta_agent_state_payload}\n'
         )
         code += (
-            f"{self.LOCAL_SANDBOX_RESULT_VAR_NAME} = base64.b64encode(pickle.dumps({self.LOCAL_SANDBOX_RESULT_VAR_NAME})).decode('utf-8')\n"
+            f"{self.LOCAL_SANDBOX_RESULT_VAR_NAME} = base64.b64encode("
+            f"_letta_json.dumps({self.LOCAL_SANDBOX_RESULT_VAR_NAME}, default=str).encode('utf-8')"
+            f").decode('utf-8')\n"
         )
 
         if wrap_print_with_markers:
```

---

### Incident Patch 5: `bb52a890` (2026-04-08)
**Commit Message**: fix: workflows update (#3292)

**File**: `.github/ISSUE_TEMPLATE/bug_report.md` (removed, +0/-53)
```diff
@@ -1,53 +0,0 @@
----
-name: Bug report
-about: Create a report to help us improve
-title: ''
-labels: ''
-assignees: ''
-
----
-
-> [!IMPORTANT]
-> **🚨 Reporting a bug with Letta Code?** 
-> 
-> Please file your issue at **[letta-ai/letta-code](https://github.com/letta-ai/letta-code/issues)** instead!
-> 
-> This repository is for the core Letta Docker server only. Issues related to the Letta Code CLI tool or agentic coding features should be reported in the Letta Code repository.
-
----
-
-**Describe the bug**
-A clear and concise description of what the bug is.
-
-**Please describe your setup**
-- [ ] How are you running Letta?
-  - Docker
-  - pip (legacy)
-  - From source
-  - Desktop
-- [ ] Describe your setup
-  - What's your OS (Windows/MacOS/Linux)?
-  - What is your `docker run ...` command (if applicable)
-
-**Screenshots**
-If applicable, add screenshots to help explain your problem.
-
-**Additional context**
-Add any other context about the problem here.
-- What model you are using
-
-**Agent File (optional)**
-Please attach your `.af` file, as this helps with reproducing issues.
-
-
----
-
-If you're not using OpenAI, please provide additional information on your local LLM setup:
-
-**Local LLM details**
-
-If you are trying to run Letta with local LLMs, please provide the following information:
-
-- [ ] The exact model you're trying to use (e.g. `dolphin-2.1-mistral-7b.Q6_K.gguf`)
-- [ ] The local LLM backend you are using (web UI? LM Studio?)
-- [ ] Your hardware for the local LLM backend (local computer? operating system? remote RunPod?)
```

**File**: `.github/ISSUE_TEMPLATE/bug_report.yml` (added, +101/-0)
```diff
@@ -0,0 +1,101 @@
+name: Bug Report
+description: Create a report to help us improve
+labels: ["bug"]
+body:
+  - type: markdown
+    attributes:
+      value: |
+        > **Reporting a bug with Letta Code?**
+        > Please file your issue at **[letta-ai/letta-code](https://github.com/letta-ai/letta-code/issues)** instead!
+        > This repository is for the core Letta server only.
+
+  - type: checkboxes
+    id: ai-disclosure
+    attributes:
+      label: AI Disclosure
+      description: |
+        We require all issue authors to disclose AI usage per our [AI Policy](https://github.com/letta-ai/letta/blob/main/AI_POLICY.md).
+        Check **all** that apply.
+      options:
+        - label: This issue was written entirely by a human
+        - label: This issue was written with AI assistance (e.g. Copilot, ChatGPT, Claude) and **reviewed and edited by a human**
+        - label: I have read the [AI Policy](https://github.com/letta-ai/letta/blob/main/AI_POLICY.md) and agree to its terms
+          required: true
+    validations:
+      required: true
+
+  - type: textarea
+    id: human-verification
+    attributes:
+      label: Human Verification
+      description: |
+        To help us combat spam, please copy and paste the following phrase **exactly** into the box below:
+        `I have read the AI policy and I confirm this issue was reviewed by a human.`
+      placeholder: "I have read the AI policy and I confirm this issue was reviewed by a human."
+    validations:
+      required: true
+
+  - type: textarea
+    id: description
+    attributes:
+      label: Describe the bug
+      description: A clear and concise description of what the bug is.
+      placeholder: What happened? What did you expect to happen?
+    validations:
+      required: true
+
+  - type: dropdown
+    id: deployment
+    attributes:
+      label: How are you running Letta?
+      options:
+        - Docker
+        - From source
+        - Desktop
+        - pip (legacy)
+    validations:
+      required: true
+
+  - type: input
+    id: os
+    attributes:
+      label: Operating System
+      placeholder: e.g. macOS 15.4, Ubuntu 24.04, Windows 11
+
+  - type: input
+    id: version
+    attributes:
+      label: Letta Version
+      description: Run `letta version` or check your Docker image tag.
+      placeholder: e.g. 0.16.7
+
+  - type: input
+    id: model
+    attributes:
+      label: Model
+      description: Which LLM model are you using?
+      placeholder: e.g. gpt-4o, claude-sonnet-4-20250514, local llama
+
+  - type: textarea
+    id: steps
+    attributes:
+      label: Steps to Reproduce
+      description: How can we reproduce this issue?
+      placeholder: |
+        1. Start Letta server with ...
+        2. Create an agent with ...
+        3. Send message ...
+        4. See error ...
+
+  - type: textarea
+    id: logs
+    attributes:
+      label: Relevant Logs / Screenshots
+      description: Paste any relevant log output, error messages, or screenshots.
+      render: shell
+
+  - type: textarea
+    id: context
+    attributes:
+      label: Additional Context
+      description: Any other context about the problem. Attach `.af` agent files if applicable.
```

**File**: `.github/ISSUE_TEMPLATE/config.yml` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+blank_issues_enabled: false
+contact_links:
+  - name: Letta Code Issues
+    url: https://github.com/letta-ai/letta-code/issues
+    about: For bugs and feature requests related to Letta Code (the CLI tool).
+  - name: Discord
+    url: https://discord.gg/9GEQrxmVyE
+    about: Chat with the Letta community and get help.
+  - name: Documentation
+    url: https://docs.letta.com
+    about: Check the docs before filing an issue.
```

**File**: `.github/ISSUE_TEMPLATE/feature_request.md` (removed, +0/-29)
```diff
@@ -1,29 +0,0 @@
----
-name: Feature request
-about: Suggest an idea for this project
-title: ''
-labels: ''
-assignees: ''
-
----
-
-> [!IMPORTANT]
-> **🚨 Reporting a bug with Letta Code?** 
-> 
-> Please file your issue at **[letta-ai/letta-code](https://github.com/letta-ai/letta-code/issues)** instead!
-> 
-> This repository is for the core Letta Docker server only. Issues related to the Letta Code CLI tool or agentic coding features should be reported in the Letta Code repository.
-
----
-
-**Is your feature request related to a problem? Please describe.**
-A clear and concise description of what the problem is. Ex. I'm always frustrated when [...]
-
-**Describe the solution you'd like**
-A clear and concise description of what you want to happen.
-
-**Describe alternatives you've considered**
-A clear and concise description of any alternative solutions or features you've considered.
-
-**Additional context**
-Add any other context or screenshots about the feature request here.
```

**File**: `.github/ISSUE_TEMPLATE/feature_request.yml` (added, +65/-0)
```diff
@@ -0,0 +1,65 @@
+name: Feature Request
+description: Suggest an idea for this project
+labels: ["enhancement"]
+body:
+  - type: markdown
+    attributes:
+      value: |
+        > **Requesting a feature for Letta Code?**
+        > Please file your issue at **[letta-ai/letta-code](https://github.com/letta-ai/letta-code/issues)** instead!
+        > This repository is for the core Letta server only.
+
+  - type: checkboxes
+    id: ai-disclosure
+    attributes:
+      label: AI Disclosure
+      description: |
+        We require all issue authors to disclose AI usage per our [AI Policy](https://github.com/letta-ai/letta/blob/main/AI_POLICY.md).
+        Check **all** that apply.
+      options:
+        - label: This issue was written entirely by a human
+        - label: This issue was written with AI assistance (e.g. Copilot, ChatGPT, Claude) and **reviewed and edited by a human**
+        - label: I have read the [AI Policy](https://github.com/letta-ai/letta/blob/main/AI_POLICY.md) and agree to its terms
+          required: true
+    validations:
+      required: true
+
+  - type: textarea
+    id: human-verification
+    attributes:
+      label: Human Verification
+      description: |
+        To help us combat spam, please copy and paste the following phrase **exactly** into the box below:
+        `I have read the AI policy and I confirm this issue was reviewed by a human.`
+      placeholder: "I have read the AI policy and I confirm this issue was reviewed by a human."
+    validations:
+      required: true
+
+  - type: textarea
+    id: problem
+    attributes:
+      label: Problem Statement
+      description: Is your feature request related to a problem? Describe it clearly.
+      placeholder: I'm always frustrated when [...]
+    validations:
+      required: true
+
+  - type: textarea
+    id: solution
+    attributes:
+      label: Proposed Solution
+      description: A clear and concise description of what you want to happen.
+    validations:
+      required: true
+
+  - type: textarea
+    id: alternatives
+    attributes:
+      label: Alternatives Considered
+      description: Any alternative solutions or features you've considered.
+
+  - type: textarea
+    id: context
+    attributes:
+      label: Additional Context
+      description: Any other context or screenshots about the feature request.
```

**File**: `.github/TRUSTED_CONTRIBUTORS` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+# Trusted Contributors
+#
+# Users listed here bypass issue validation checks (AI disclosure,
+# human verification phrase). One GitHub username per line.
+#
+# Note: Members of the letta-ai GitHub organization are automatically
+# trusted and do not need to be listed here. This file is for
+# non-org contributors who have earned trust.
+#
+# To add someone, open a PR adding their username to this list.
+
+# Letta community contributors
+ezra-letta
```

**File**: `.github/workflows/issue-guard.yml` (added, +168/-0)
```diff
@@ -0,0 +1,168 @@
+name: "Issue Guard"
+
+on:
+  issues:
+    types: [opened]
+
+permissions:
+  issues: write
+
+jobs:
+  validate:
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v4
+        with:
+          sparse-checkout: .github/TRUSTED_CONTRIBUTORS
+
+      - name: Check issue compliance
+        uses: actions/github-script@v7
+        with:
+          script: |
+            const issue = context.payload.issue;
+            const author = issue.user.login;
+            const body = issue.body || '';
+
+            // --- Allowlist checks ---
+
+            // 1. Bots are allowed (e.g. dependabot, renovate)
+            if (issue.user.type === 'Bot') {
+              console.log(`Skipping: ${author} is a bot`);
+              return;
+            }
+
+            // 2. Check if author has write+ access to the repo.
+            //    This catches org members who have repo access via teams,
+            //    and works with the default GITHUB_TOKEN (no extra scopes).
+            try {
+              const { data } = await github.rest.repos.getCollaboratorPermissionLevel({
+                owner: context.repo.owner,
+                repo: context.repo.repo,
+                username: author,
+              });
+              if (['admin', 'write', 'maintain'].includes(data.permission)) {
+                console.log(`Skipping: ${author} has '${data.permission}' permission on repo`);
+                return;
+              }
+            } catch (e) {
+              console.log(`Collaborator check failed (${e.status}), continuing`);
+            }
+
+            // 3. Check org membership via public membership API (no auth needed).
+            //    Catches org members even if they don't have direct repo access.
+            try {
+              await github.rest.orgs.checkPublicMembershipForUser({
+                org: 'letta-ai',
+                username: author,
+              });
+              console.log(`Skipping: ${author} is a public letta-ai org member`);
+              return;
+            } catch (e) {
+              // 404 = not a public member
+            }
+
+            // 4. Check TRUSTED_CONTRIBUTORS file
+            const fs = require('fs');
+            try {
+              const trusted = fs.readFileSync('.github/TRUSTED_CONTRIBUTORS', 'utf8')
+                .split('\n')
+                .map(line => line.trim())
+                .filter(line => line && !line.startsWith('#'));
+              if (trusted.includes(author)) {
+                console.log(`Skipping: ${author} is in TRUSTED_CONTRIBUTORS`);
+                return;
+              }
+            } catch (e) {
+              console.log('No TRUSTED_CONTRIBUTORS file found, continuing');
+            }
+
+            // --- Validation checks ---
+
+            const failures = [];
+
+            // Check 1: Magic phrase
+            const magicPhrase = 'I have read the AI policy and I confirm this issue was reviewed by a human.';
+            if (!body.includes(magicPhrase)) {
+              failures.push('Missing human verification phrase');
+            }
+
+            // Check 2: AI disclosure checkbox (the required one: "I have read the AI Policy")
+            // YAML form checkboxes render as "- [x] text" when checked.
+            const aiPolicyChecked = /- \[[xX]\] I have read the \[AI Policy\]/.test(body);
+            if (!aiPolicyChecked) {
+              failures.push('AI Policy acknowledgment checkbox not checked');
+            }
+
+            // Check 3: At least one of the two disclosure options is checked
+            const humanWritten = /- \[[xX]\] This issue was written entirely by a human/.test(body);
+            const aiAssisted = /- \[[xX]\] This issue was written with AI assistance/.test(body);
+            if (!humanWritten && !aiAssisted) {
+              failures.push('No AI disclosure option selected (must indicate whether issue is human-written or AI-assisted)');
+            }
+
+            if (failures.length === 0) {
+              console.log(`Issue #${issue.number} passed all checks`);
+              return;
+            }
+
+            // --- Close and lock ---
+
+            console.log(`Issue #${issue.number} failed checks: ${failures.join(', ')}`);
+
+            const comment = [
+              `**This issue was automatically closed** because it does not meet our submission requirements.\n`,
+              `**What failed:**`,
+              ...failures.map(f => `- ${f}`),
+              ``,
+              `**To submit an issue, please:**`,
+              `1. Use one of the [issue templates](https://github.com/${context.repo.owner}/${context.repo.repo}/issues/new/choose)`,
+              `2. Fill out the **AI Disclosure** checkboxes`,
+              `3. Copy the **Human Verification** phrase exactly as shown`,
+              `4. Read our [AI Policy](https://github.com/${context.repo.owner}/${context.repo.repo}/blob/main/AI_POLICY.md)`,
+              ``
```

**File**: `AI_POLICY.md` (added, +63/-0)
```diff
@@ -0,0 +1,63 @@
+# AI Usage Policy
+
+> This policy is adapted from [Ghostty's AI Policy](https://github.com/ghostty-org/ghostty/blob/main/AI_POLICY.md) with modifications for the Letta project.
+
+## Rules
+
+- **All AI usage in any form must be disclosed.** You must state
+  the tool you used (e.g. Claude Code, Cursor, Copilot, ChatGPT) along with
+  the extent that the work was AI-assisted.
+
+- **The human-in-the-loop must fully understand all code.** If you
+  can't explain what your changes do and how they interact with the
+  greater system without the aid of AI tools, do not contribute
+  to this project.
+
+- **Issues and discussions can use AI assistance but must have a full
+  human-in-the-loop.** This means that any content generated with AI
+  must have been reviewed _and edited_ by a human before submission.
+  AI is very good at being overly verbose and including noise that
+  distracts from the main point. Humans must do their research and
+  trim this down.
+
+- **No AI-generated media is allowed (art, images, videos, audio, etc.).**
+  Text and code are the only acceptable AI-generated content, per the
+  other rules in this policy.
+
+## Enforcement
+
+Issues that do not comply with this policy will be **automatically closed and locked**.
+Specifically, all issues must:
+
+1. Fill out the **AI Disclosure** checkboxes indicating whether the issue was human-written or AI-assisted.
+2. Include the **Human Verification** phrase as instructed in the issue template.
+3. Acknowledge that they have read this policy.
+
+Members of the [letta-ai](https://github.com/letta-ai) GitHub organization and
+[trusted contributors](.github/TRUSTED_CONTRIBUTORS) are exempt from automated checks,
+but are still expected to follow the spirit of this policy.
+
+## There are Humans Here
+
+Please remember that Letta is maintained by humans.
+
+Every discussion, issue, and pull request is read and reviewed by
+humans. It is a boundary point at which people interact with each other
+and the work done. It is rude and disrespectful to approach this boundary
+with low-effort, unqualified work, since it puts the burden of
+validation on the maintainer.
+
+## AI is Welcome Here
+
+Letta is a company that builds AI tools — of course we use AI!
+Many of our maintainers use AI tools extensively in their daily workflow.
+As a project, we welcome AI as a tool.
+
+**Our reason for the strict AI policy is not due to an anti-AI stance**, but
+instead due to the volume of low-quality, AI-generated issues and PRs
+that waste maintainer time. It's the quality of the contribution that
+matters, not whether AI was involved in creating it.
+
+Maintainers are exempt from automated enforcement of these rules and
+may use AI tools at their discretion; they've proven themselves
+trustworthy to apply good judgment.
```

---

### Incident Patch 6: `f1800c83` (2026-04-08)
**Commit Message**: fix(issue-guard): accept lowercase checkboxes and harden labeling

**File**: `.github/ISSUE_TEMPLATE/bug_report.yml` (modified, +2/-2)
```diff
@@ -14,12 +14,12 @@ body:
     attributes:
       label: AI Disclosure
       description: |
-        We require all issue authors to disclose AI usage per our [AI Policy](../blob/main/AI_POLICY.md).
+        We require all issue authors to disclose AI usage per our [AI Policy](https://github.com/letta-ai/letta/blob/main/AI_POLICY.md).
         Check **all** that apply.
       options:
         - label: This issue was written entirely by a human
         - label: This issue was written with AI assistance (e.g. Copilot, ChatGPT, Claude) and **reviewed and edited by a human**
-        - label: I have read the [AI Policy](../blob/main/AI_POLICY.md) and agree to its terms
+        - label: I have read the [AI Policy](https://github.com/letta-ai/letta/blob/main/AI_POLICY.md) and agree to its terms
           required: true
     validations:
       required: true
```

**File**: `.github/ISSUE_TEMPLATE/feature_request.yml` (modified, +2/-2)
```diff
@@ -14,12 +14,12 @@ body:
     attributes:
       label: AI Disclosure
       description: |
-        We require all issue authors to disclose AI usage per our [AI Policy](../blob/main/AI_POLICY.md).
+        We require all issue authors to disclose AI usage per our [AI Policy](https://github.com/letta-ai/letta/blob/main/AI_POLICY.md).
         Check **all** that apply.
       options:
         - label: This issue was written entirely by a human
         - label: This issue was written with AI assistance (e.g. Copilot, ChatGPT, Claude) and **reviewed and edited by a human**
-        - label: I have read the [AI Policy](../blob/main/AI_POLICY.md) and agree to its terms
+        - label: I have read the [AI Policy](https://github.com/letta-ai/letta/blob/main/AI_POLICY.md) and agree to its terms
           required: true
     validations:
       required: true
```

**File**: `.github/workflows/issue-guard.yml` (modified, +24/-10)
```diff
@@ -87,15 +87,15 @@ jobs:
             }
 
             // Check 2: AI disclosure checkbox (the required one: "I have read the AI Policy")
-            // YAML form checkboxes render as "- [X] text" when checked
-            const aiPolicyChecked = /- \[X\] I have read the \[AI Policy\]/.test(body);
+            // YAML form checkboxes render as "- [x] text" when checked.
+            const aiPolicyChecked = /- \[[xX]\] I have read the \[AI Policy\]/.test(body);
             if (!aiPolicyChecked) {
               failures.push('AI Policy acknowledgment checkbox not checked');
             }
 
             // Check 3: At least one of the two disclosure options is checked
-            const humanWritten = /- \[X\] This issue was written entirely by a human/.test(body);
-            const aiAssisted = /- \[X\] This issue was written with AI assistance/.test(body);
+            const humanWritten = /- \[[xX]\] This issue was written entirely by a human/.test(body);
+            const aiAssisted = /- \[[xX]\] This issue was written with AI assistance/.test(body);
             if (!humanWritten && !aiAssisted) {
               failures.push('No AI disclosure option selected (must indicate whether issue is human-written or AI-assisted)');
             }
@@ -130,12 +130,26 @@ jobs:
               body: comment,
             });
 
-            await github.rest.issues.addLabels({
-              owner: context.repo.owner,
-              repo: context.repo.repo,
-              issue_number: issue.number,
-              labels: ['spam'],
-            });
+            // Best-effort labeling: prefer "spam", then fall back to labels
+            // that commonly exist on repos.
+            let labelApplied = false;
+            for (const label of ['spam', 'auto-closed', 'invalid']) {
+              try {
+                await github.rest.issues.addLabels({
+                  owner: context.repo.owner,
+                  repo: context.repo.repo,
+                  issue_number: issue.number,
+                  labels: [label],
+                });
+                labelApplied = true;
+                break;
+              } catch (e) {
+                console.log(`Label '${label}' unavailable or failed to apply, trying next`);
+              }
+            }
+            if (!labelApplied) {
+              console.log('No close label could be applied; continuing with close/lock');
+            }
 
             await github.rest.issues.update({
               owner: context.repo.owner,
```

---

### Incident Patch 7: `f0364bc0` (2026-03-31)
**Commit Message**: fix: Update summarizer prompt to remember plan files, github PRs, etc. (#10314)

add plan files, gh links, ticket ids to summarizer prompt

**File**: `letta/prompts/summarizer_prompt.py` (modified, +17/-4)
```diff
@@ -8,7 +8,10 @@
 
 2. **What happened**: The conversations, tasks, and exchanges that took place. What did the user ask for? What did you do? How did things progress? If there is a previous summary being evicted, please extract a concise version of the critical info from it.
 
-3. **Important details**: Enumerate specific files and code sections examined, modified, or created with a summary of why this file read or edit is important. Include specific names, data, configurations, or facts that were discussed. Don't omit details that might be referenced later.
+3. **Important details**: Enumerate specific files and code sections examined, modified, or created, as well as important plan files, GitHub issues/PR links, and Linear ticket IDs. For each item, include why it matters and any relevant names, data, configs, or facts discussed.
+   - **Preserve identifiers verbatim** (plan filename/path, exact URL, issue/PR number, ticket ID); do not paraphrase or truncate.
+   - **Preserve referenced identifiers unless explicitly resolved**: Keep exact URLs/IDs from the conversation unless there is clear evidence they are no longer relevant.
+   - Do not omit details likely to be referenced later.
 
 4. **Errors and fixes**: List all errors that you ran into, and how you fixed them. Pay special attention to specific user feedback that you received and record verbatim if useful.
 
@@ -28,7 +31,10 @@
 
 2. **What happened**: The conversations, tasks, and exchanges that took place. What did the user ask for? What did you do? How did things progress? If there is a previous summary being evicted, please extract a concise version of the critical info from it.
 
-3. **Important details**: Enumerate specific files and code sections examined, modified, or created with a summary of why this file read or edit is important. Include specific names, data, configurations, or facts that were discussed. Don't omit details that might be referenced later.
+3. **Important details**: Enumerate specific files and code sections examined, modified, or created, as well as important plan files, GitHub issues/PR links, and Linear ticket IDs. For each item, include why it matters and any relevant names, data, configs, or facts discussed.
+   - **Preserve identifiers verbatim** (plan filename/path, exact URL, issue/PR number, ticket ID); do not paraphrase or truncate.
+   - **Preserve referenced identifiers unless explicitly resolved**: Keep exact URLs/IDs from the conversation unless there is clear evidence they are no longer relevant.
+   - Do not omit details likely to be referenced later.
 
 4. **Errors and fixes**: List all errors that you ran into, and how you fixed them. Pay special attention to specific user feedback that you received and record verbatim if useful.
 
@@ -47,7 +53,10 @@
 
 2. **What happened**: The conversations, tasks, and exchanges that took place. What did the user ask for? What did you do? How did things progress? If there is a previous summary being evicted, please extract a concise version of the critical info from it.
 
-3. **Important details**: Enumerate specific files and code sections examined, modified, or created with a summary of why this file read or edit is important. Include specific names, data, configurations, or facts that were discussed. Don't omit details that might be referenced later.
+3. **Important details**: Enumerate specific files and code sections examined, modified, or created, as well as important plan files, GitHub issues/PR links, and Linear ticket IDs. For each item, include why it matters and any relevant names, data, configs, or facts discussed.
+   - **Preserve identifiers verbatim** (plan filename/path, exact URL, issue/PR number, ticket ID); do not paraphrase or truncate.
+   - **Preserve referenced identifiers unless explicitly resolved**: Keep exact URLs/IDs from the conversation unless there is clear evidence they are no longer relevant.
+   - Do not omit details likely to be referenced later.
 
 4. **Errors and fixes**: List all errors that you ran into, and how you fixed them. Pay special attention to specific user feedback that you received and record verbatim if useful.
 
@@ -67,7 +76,10 @@
 
 2. **What happened**: The conversations, tasks, and exchanges that took place. What did the user ask for? What did you do? How did things progress? If there is a previous summary being evicted, please extract a concise version of the critical info from it.
 
-3. **Important details**: Enumerate specific files and code sections examined, modified, or created with a summary of why this file read or edit is important. Include specific names, data, configurations, or facts that were discussed. Don't omit details that might be referenced later.
+3. **Important details**: Enumerate specific files and code sections examined, modified, or created, as well as important plan files, GitHub issues/PR links, and Linear ticket IDs. For each item, include why it matters and any relevant names, data, co
```

---

### Incident Patch 8: `54c346f8` (2026-03-30)
**Commit Message**: fix(memfs): remove invalid redis_client kwarg from MemfsClient init (#10350)

GitOperations.__init__() only accepts `storage`, but MemfsClient was
passing `redis_client=None` which crashes the server on startup when
using LETTA_MEMFS_SERVICE_URL=local.

**File**: `letta/services/memory_repo/memfs_client_base.py` (modified, +1/-1)
```diff
@@ -51,7 +51,7 @@ def __init__(self, base_url: str | None = None, local_path: str | None = None, t
         """
         self.local_path = local_path or DEFAULT_LOCAL_PATH
         self.storage = LocalStorageBackend(base_path=self.local_path)
-        self.git = GitOperations(storage=self.storage, redis_client=None)
+        self.git = GitOperations(storage=self.storage)
 
         logger.info(f"MemfsClient initialized with local storage at {self.local_path}")
 
```

---

### Incident Patch 9: `3290121a` (2026-03-27)
**Commit Message**: fix: disallow file:/// prefixed URLs in images (#10329)

disallow file:/// prefixed URLs in images

**File**: `tests/test_message_helper.py` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+import pytest
+
+from letta.errors import LettaInvalidArgumentError
+from letta.helpers.message_helper import convert_message_creates_to_messages, resolve_tool_return_images
+from letta.schemas.letta_message_content import Base64Image, ImageContent, TextContent, UrlImage
+from letta.schemas.message import MessageCreate
+
+
+@pytest.mark.asyncio
+async def test_convert_message_creates_to_messages_rejects_file_image_urls():
+    message = MessageCreate(
+        role="user",
+        content=[
+            TextContent(text="describe this image"),
+            ImageContent(source=UrlImage(url="file:///etc/hostname")),
+        ],
+    )
+
+    with pytest.raises(LettaInvalidArgumentError, match="Unsupported image URL scheme 'file'"):
+        await convert_message_creates_to_messages(
+            [message],
+            agent_id="agent-test",
+            timezone="UTC",
+            run_id="run-test",
+            wrap_user_message=False,
+            wrap_system_message=False,
+        )
+
+
+@pytest.mark.asyncio
+async def test_resolve_tool_return_images_rejects_file_image_urls():
+    with pytest.raises(LettaInvalidArgumentError, match="Unsupported image URL scheme 'file'"):
+        await resolve_tool_return_images([ImageContent(source=UrlImage(url="file:///etc/passwd"))])
+
+
+@pytest.mark.asyncio
+async def test_convert_message_creates_to_messages_keeps_data_urls_supported():
+    message = MessageCreate(
+        role="user",
+        content=[ImageContent(source=UrlImage(url="data:image/png;base64,dGVzdA=="))],
+    )
+
+    converted_messages = await convert_message_creates_to_messages(
+        [message],
+        agent_id="agent-test",
+        timezone="UTC",
+        run_id="run-test",
+        wrap_user_message=False,
+        wrap_system_message=False,
+    )
+
+    image_source = converted_messages[0].content[0].source
+    assert isinstance(image_source, Base64Image)
+    assert image_source.media_type == "image/png"
+    assert image_source.data == "dGVzdA=="
```

---

### Incident Patch 10: `b8367320` (2026-03-27)
**Commit Message**: fix: add glm 5.1 (#10317)

**File**: `letta/schemas/providers/zai.py` (modified, +1/-0)
```diff
@@ -20,6 +20,7 @@
     "glm-5": 180000,
     "glm-5-code": 180000,
     "glm-5-turbo": 180000,
+    "glm-5.1": 180000,
 }
 
 
```

---

### Incident Patch 11: `09c95143` (2026-03-27)
**Commit Message**: fix: initialize model attribute in SimpleGeminiStreamingInterface (#10306)

Fixes letta-ai/letta#3239. The Gemini streaming interface never set
self.model in __init__, so if the stream failed before any events were
processed the provider trace logger would crash with AttributeError.

🐾 Generated with [Letta Code](https://letta.com)

Co-authored-by: Letta Code <[REDACTED_EMAIL]>

**File**: `letta/adapters/simple_llm_stream_adapter.py` (modified, +1/-0)
```diff
@@ -129,6 +129,7 @@ async def invoke_llm(
                 )
         elif self.llm_config.model_endpoint_type in [ProviderType.google_ai, ProviderType.google_vertex]:
             self.interface = SimpleGeminiStreamingInterface(
+                model=self.llm_config.model,
                 requires_approval_tools=requires_approval_tools,
                 run_id=self.run_id,
                 step_id=step_id,
```

**File**: `letta/interfaces/gemini_streaming_interface.py` (modified, +2/-1)
```diff
@@ -46,6 +46,7 @@ class SimpleGeminiStreamingInterface:
 
     def __init__(
         self,
+        model: str | None = None,
         requires_approval_tools: list = [],
         run_id: str | None = None,
         step_id: str | None = None,
@@ -77,7 +78,7 @@ def __init__(
 
         # Premake IDs for database writes
         self.letta_message_id = Message.generate_id()
-        # self.model = model
+        self.model = model
 
         # Sadly, Gemini's encrypted reasoning logic forces us to store stream parts in state
         self.content_parts: List[ReasoningContent | TextContent | ToolCallContent] = []
```

---

### Incident Patch 12: `f5d649fc` (2026-03-26)
**Commit Message**: fix: add missing is_byok to LLM error details (#10311)

Several error handlers in anthropic_client.py and openai_client.py were
missing the is_byok field in their details dict, causing BYOK errors to
not be tagged with [BYOK] in logs.

Fixed:
- anthropic_client.py: InternalServerError handler (3 branches)
- openai_client.py: HTML error case in BadRequestError handler

🤖 Generated with [Letta Code](https://letta.com)

Co-authored-by: Letta Code <[REDACTED_EMAIL]>

**File**: `letta/llm_api/anthropic_client.py` (modified, +3/-0)
```diff
@@ -1099,12 +1099,14 @@ def handle_llm_error(self, e: Exception, llm_config: Optional[LLMConfig] = None)
                     details={
                         "status_code": e.status_code if hasattr(e, "status_code") else None,
                         "transient": True,
+                        "is_byok": is_byok,
                     },
                 )
             if "overloaded" in error_str:
                 return LLMProviderOverloaded(
                     message=f"Anthropic API is overloaded: {str(e)}",
                     code=ErrorCode.INTERNAL_SERVER_ERROR,
+                    details={"is_byok": is_byok},
                 )
             logger.warning(f"[Anthropic] Internal server error: {str(e)}")
             return LLMServerError(
@@ -1113,6 +1115,7 @@ def handle_llm_error(self, e: Exception, llm_config: Optional[LLMConfig] = None)
                 details={
                     "status_code": e.status_code if hasattr(e, "status_code") else None,
                     "response": str(e.response) if hasattr(e, "response") else None,
+                    "is_byok": is_byok,
                 },
             )
 
```

**File**: `letta/llm_api/openai_client.py` (modified, +1/-3)
```diff
@@ -332,8 +332,6 @@ def _apply_system_override(messages: List[PydanticMessage], system: Optional[str
         if messages[0].role != "system":
             raise RuntimeError(f"First message is not a system message, instead has role {messages[0].role}")
 
-        from letta.schemas.letta_message_content import TextContent
-
         system_message = messages[0].model_copy(deep=True)
         system_message.content = [TextContent(text=system)]
         return [system_message, *messages[1:]]
@@ -1291,7 +1289,7 @@ def handle_llm_error(self, e: Exception, llm_config: Optional[LLMConfig] = None)
                 return LLMBadRequestError(
                     message="Upstream endpoint returned HTML error (400 Bad Request). This usually indicates the configured API endpoint is not an OpenAI-compatible API or the request was rejected by a load balancer.",
                     code=ErrorCode.INVALID_ARGUMENT,
-                    details={"raw_body_preview": error_str[:500]},
+                    details={"raw_body_preview": error_str[:500], "is_byok": is_byok},
                 )
 
             error_code = None
```

---

### Incident Patch 13: `775b63ec` (2026-03-26)
**Commit Message**: fix: update step with resolved model info even when auto mode resolution fails partway (#10300)

fix: update step with resolved model info even when auto mode fails

Move update_step_resolved_model_async into a finally block so the step
gets updated with resolved model info even if apply_reroute_rules or
LLMClient.create throws afterward. Previously the step kept placeholder
values (model=auto, model_endpoint=) causing billing to be skipped.

🤖 Generated with [Letta Code](https://letta.com)

Co-authored-by: Letta Code <[REDACTED_EMAIL]>

**File**: `letta/agents/letta_agent_v3.py` (modified, +39/-34)
```diff
@@ -1046,40 +1046,45 @@ async def _step(
                 primary_handle = ""
 
                 if is_auto_mode:
-                    routing_client = await get_llm_routing_client()
-                    active_llm_config, is_primary, primary_handle = await routing_client.resolve_auto_mode_config(
-                        stored_llm_config=self.agent_state.llm_config,
-                        actor=self.actor,
-                    )
-                    if not is_primary:
-                        self.logger.info(f"[LLM ROUTER]: primary {primary_handle} rerouted, falling back to {active_llm_config.handle}")
-                    # Content-based rerouting (e.g. images → vision-capable model)
-                    active_llm_config = routing_client.apply_reroute_rules(
-                        resolved_config=active_llm_config,
-                        messages=messages,
-                        stored_llm_config=self.agent_state.llm_config,
-                        agent_state=self.agent_state,
-                    )
-                    active_llm_client = LLMClient.create(
-                        provider_type=active_llm_config.model_endpoint_type,
-                        put_inner_thoughts_first=True,
-                        actor=self.actor,
-                    )
-                    # Update the adapter to use the resolved client and config
-                    llm_adapter.llm_client = active_llm_client
-                    llm_adapter.llm_config = active_llm_config
-                    # Update persisted step with resolved model info so billing can
-                    # identify the actual model and charge at the correct rate.
-                    # Keep model_handle as the original auto handle so we can still
-                    # identify that the user was on auto mode.
-                    await self.step_manager.update_step_resolved_model_async(
-                        actor=self.actor,
-                        step_id=step_id,
-                        provider_name=active_llm_config.model_endpoint_type,
-                        provider_category=active_llm_config.provider_category or "base",
-                        model=active_llm_config.model,
-                        model_endpoint=active_llm_config.model_endpoint,
-                    )
+                    resolved_llm_config = None
+                    try:
+                        routing_client = await get_llm_routing_client()
+                        active_llm_config, is_primary, primary_handle = await routing_client.resolve_auto_mode_config(
+                            stored_llm_config=self.agent_state.llm_config,
+                            actor=self.actor,
+                        )
+                        resolved_llm_config = active_llm_config
+                        if not is_primary:
+                            self.logger.info(f"[LLM ROUTER]: primary {primary_handle} rerouted, falling back to {active_llm_config.handle}")
+                        # Content-based rerouting (e.g. images → vision-capable model)
+                        active_llm_config = routing_client.apply_reroute_rules(
+                            resolved_config=active_llm_config,
+                            messages=messages,
+                            stored_llm_config=self.agent_state.llm_config,
+                            agent_state=self.agent_state,
+                        )
+                        resolved_llm_config = active_llm_config
+                        active_llm_client = LLMClient.create(
+                            provider_type=active_llm_config.model_endpoint_type,
+                            put_inner_thoughts_first=True,
+                            actor=self.actor,
+                        )
+                        # Update the adapter to use the resolved client and config
+                        llm_adapter.llm_client = active_llm_client
+                        llm_adapter.llm_config = active_llm_config
+                    finally:
+                        # Update persisted step with resolved model info so billing can
+                        # identify the actual model and charge at the correct rate,
+                        # even if resolution fails partway through.
+                        if resolved_llm_config is not None:
+                            await self.step_manager.update_step_resolved_model_async(
+                                actor=self.actor,
+                                step_id=step_id,
+                                provider_name=resolved_llm_config.model_endpoint_type,
+                                provider_category=resolved_llm_config.provider_category or "base",
+                                model=resolved_llm_config.model,
+                                model_endpoint=resolved_llm_config.model_endpoint,
+                            )
                 else:
                     active_llm_config = self.agent_state.llm_config
                     active_llm_client = self
```

---

### Incident Patch 14: `0afb5483` (2026-03-26)
**Commit Message**: fix: add glm-5 turbo (#10285)

**File**: `letta/schemas/providers/zai.py` (modified, +1/-0)
```diff
@@ -19,6 +19,7 @@
     "glm-4.7": 180000,
     "glm-5": 180000,
     "glm-5-code": 180000,
+    "glm-5-turbo": 180000,
 }
 
 
```

---

### Incident Patch 15: `7f2a7bf9` (2026-03-25)
**Commit Message**: fix: bypass default actor check at startup for admin use-cases (#10273)

* perform tool upsert, base provider and model sync irrespective of default actor setting

* enforce no default actor on temporal workers

* revert weird removals

* create defaults even if no_default actor is set

**File**: `letta/server/server.py` (modified, +13/-13)
```diff
@@ -372,19 +372,21 @@ def __init__(
             )
 
     async def init_async(self, init_with_default_org_and_user: bool = True):
-        # Make default user and org
-        if init_with_default_org_and_user:
-            self.default_org = await self.organization_manager.create_default_organization_async()
-            self.default_user = await self.user_manager.create_default_actor_async()
-            print(f"Default user: {self.default_user} and org: {self.default_org}")
-            await self.tool_manager.upsert_base_tools_async(actor=self.default_user)
+        # unfortunately we must always create default org/user
+        self.default_org = await self.organization_manager.create_default_organization_async()
+        self.default_user = await self.user_manager.create_default_actor_async()
+        print(f"Default user: {self.default_user} and org: {self.default_org}")
+
+        # Sync environment-based providers to database (idempotent, safe for multi-pod startup)
+        await self.provider_manager.sync_base_providers(base_providers=self._enabled_providers, actor=self.default_user)
 
-            # Sync environment-based providers to database (idempotent, safe for multi-pod startup)
-            await self.provider_manager.sync_base_providers(base_providers=self._enabled_providers, actor=self.default_user)
+        # Sync provider models to database
+        await self._sync_provider_models_async()
 
-            # Sync provider models to database
-            await self._sync_provider_models_async()
+        await self.tool_manager.upsert_base_tools_async(actor=self.default_user)
 
+        # Make default user and org
+        if init_with_default_org_and_user:
             # For OSS users, create a local sandbox config
             oss_default_user = await self.user_manager.get_default_actor_async()
             use_venv = False if not tool_settings.tool_exec_venv_name else True
@@ -640,9 +642,7 @@ async def create_agent_async(
             # Recompile the system prompt now that git_enabled=True, so the
             # persisted system message uses the git-style memory rendering
             # instead of the legacy <memory_blocks> format.
-            await self.agent_manager.rebuild_system_prompt_async(
-                agent_id=main_agent.id, actor=actor, force=True, update_timestamp=True
-            )
+            await self.agent_manager.rebuild_system_prompt_async(agent_id=main_agent.id, actor=actor, force=True, update_timestamp=True)
 
         log_event(name="start insert_files_into_context_window db")
         # Use folder_ids if provided, otherwise fall back to deprecated source_ids for backwards compatibility
```

#### Recent Merged Pull Requests:
- **PR #3442** (2026-09-10): docs: limit security reports to maintained projects (@cpacker)
- **PR #3441** (2026-09-10): fix: update privacy policy contact address (@letta-integration[bot])
- **PR #3434** (closed): chore: close all retired repository issues (@letta-integration[bot])
- **PR #3433** (2026-08-23): chore: restore issue spam guard (@letta-integration[bot])
- **PR #3430** (2026-08-16): chore: archive the legacy server repository (@letta-integration[bot])
- **PR #3429** (2026-08-14): chore: deter self-promotional issue spam (@letta-integration[bot])
- **PR #3421** (2026-08-01): fix: require explicit AI tool disclosure in issues (@cpacker)
- **PR #3418** (2026-07-30): Update AI_POLICY.md (@cpacker)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
