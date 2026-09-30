# Forensic Learning Record (Deep Inspection): crewAIInc/crewAI

> **Canonical Artifact**: `07_PROJECT_LEARNING/crewaiinc-crewai-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/crewAIInc/crewAI](https://github.com/crewAIInc/crewAI))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:04:45.246Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `crewAIInc/crewAI`
- **Description**: Framework for orchestrating role-playing, autonomous AI agents. By fostering collaborative intelligence, CrewAI empowers agents to work together seamlessly, tackling complex tasks.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 59232 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `lib/cli/src/crewai_cli/__init__.py`
```
__version__ = "1.15.23"

```

### Core Architecture Module: `lib/cli/src/crewai_cli/add_crew_to_flow.py`
```
from pathlib import Path

import click
from crewai_core.printer import PRINTER

from crewai_cli.utils import copy_template


def add_crew_to_flow(crew_name: str) -> None:
    """Add a new crew to the current flow."""
    if not Path("pyproject.toml").exists():
        PRINTER.print(
            "This command must be run from the root of a flow project.", color="red"
        )
        raise click.ClickException(
            "This command must be run from the root of a flow project."
        )

    flow_folder = Path.cwd()
    crews_folder = flow_folder / "src" / flow_folder.name / "crews"

    if not crews_folder.exists():
        PRINTER.print("Crews folder does not exist in the current flow.", color="red")
        raise click.ClickException("Crews folder does not exist in the current flow.")

    create_embedded_crew(crew_name, parent_folder=crews_folder)

    click.echo(
        f"Crew {crew_name} added to the current flow successfully!",
    )


def create_embedded_crew(crew_name: str, parent_folder: Path) -> None:
    """Create a new crew within an existing flow project."""
    folder_name = crew_name.replace(" ", "_").replace("-", "_").lower()
    class_name = crew_name.replace("_", " ").replace("-", " ").title().replace(" ", "")

    crew_folder = parent_folder / folder_name

    if crew_folder.exists():
        if not click.confirm(
            f"Crew {folder_name} already exists. Do you want to override it?"
        ):
            click.secho("Operation cancelled.", fg="yellow")
            return
        click.secho(f"Overriding crew {folder_name}...", fg="green", bold=True)
    else:
        click.secho(f"Creating crew {folder_name}...", fg="green", bold=True)
        crew_folder.mkdir(parents=True)

    config_folder = crew_folder / "config"
    config_folder.mkdir(exist_ok=True)

    templates_dir = Path(__file__).parent / "templates" / "crew"
    config_template_files = ["agents.yaml", "tasks.yaml"]
    crew_template_file = f"{folder_name}.py"

    for file_name in config_template_files:
        src_file = templates_dir / "config" / file_name
        dst_file = config_folder / file_name
        copy_template(src_file, dst_file, crew_name, class_name, folder_name)

    src_file = templates_dir / "crew.py"
    dst_file = crew_folder / crew_template_file
    copy_template(src_file, dst_file, crew_name, class_name, folder_name)

    click.secho(
        f"Crew {crew_name} added to the flow successfully!", fg="green", bold=True
    )

```

### Core Architecture Module: `lib/cli/src/crewai_cli/authentication/__init__.py`
```
"""CLI authentication entry point."""

from __future__ import annotations

from crewai_cli.authentication.main import AuthenticationCommand


__all__ = ["AuthenticationCommand"]

```

### Core Architecture Module: `lib/cli/src/crewai_cli/authentication/constants.py`
```
"""Re-export of authentication constants from ``crewai_core.auth.constants``."""

from __future__ import annotations

from crewai_core.auth.constants import ALGORITHMS as ALGORITHMS


__all__ = ["ALGORITHMS"]

```

### Core Architecture Module: `lib/cli/src/crewai_cli/authentication/main.py`
```
"""CLI-side authentication wiring.

Re-exports the OAuth2 primitives from ``crewai_core.auth`` and overrides the
``_post_login`` hook to also log into the tool repository.
"""

from __future__ import annotations

from crewai_core.auth.oauth2 import (
    AuthenticationCommand as _BaseAuthenticationCommand,
    Oauth2Settings as Oauth2Settings,
    ProviderFactory as ProviderFactory,
    console,
)
from crewai_core.settings import Settings


__all__ = ["AuthenticationCommand", "Oauth2Settings", "ProviderFactory"]


class AuthenticationCommand(_BaseAuthenticationCommand):
    """CLI-side login that also signs the user into the tool repository."""

    def _post_login(self) -> None:
        self._login_to_tool_repository()

    def _login_to_tool_repository(self) -> None:
        from crewai_cli.tools.main import ToolCommand

        try:
            console.print(
                "Now logging you in to the Tool Repository... ",
                style="bold blue",
                end="",
            )

            ToolCommand().login()

            console.print(
                "Success!\n",
                style="bold green",
            )

            settings = Settings()

            console.print(
                f"You are now authenticated to the tool repository for organization [bold cyan]'{settings.org_name if settings.org_name else settings.org_uuid}'[/bold cyan]",
                style="green",
            )
        except (Exception, SystemExit):
            console.print(
                "\n[bold yellow]Warning:[/bold yellow] Authentication with the Tool Repository failed.",
                style="yellow",
            )
            console.print(
                "Other features will work normally, but you may experience limitations "
                "with downloading and publishing tools."
                "\nRun [bold]crewai login[/bold] to try logging in again.\n",
                style="yellow",
            )

```

### Core Architecture Module: `lib/cli/src/crewai_cli/authentication/providers/__init__.py`
```
"""OAuth2 authentication providers — re-exported from ``crewai_core.auth.providers``."""

```

### Core Architecture Module: `lib/cli/src/crewai_cli/authentication/providers/auth0.py`
```
"""Re-export of ``Auth0Provider`` from ``crewai_core.auth.providers.auth0``."""

from __future__ import annotations

from crewai_core.auth.providers.auth0 import Auth0Provider as Auth0Provider


__all__ = ["Auth0Provider"]

```

### Core Architecture Module: `lib/cli/src/crewai_cli/authentication/providers/base_provider.py`
```
"""Re-export of ``BaseProvider`` from ``crewai_core.auth.providers.base_provider``."""

from __future__ import annotations

from crewai_core.auth.providers.base_provider import BaseProvider as BaseProvider


__all__ = ["BaseProvider"]

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7434** (2026-09-14): **[BUG] TUI crashes with TypeError: Object of type ellipsis is not JSON serializable when streamed output contains a literal [...]**
  *Symptoms*: ### Description  **Environment**   - crewai 1.15.21 (CLI and library, from PyPI), Python 3.12.10, macOS Tahoe.  **Summary** > Running a crew via `crewai run` crashes the live TUI and cancels the in-progress run whenever an agent's streamed text output happens to contain a literal [...] (three dots inside square brackets). The crew's actual execution (LLM calls, tool calls) is unaffected; only the terminal renderer crashes, taking the whole session down with it.  **Root cause** > In crewai_cli/crew_run_tui.py, _format_json_in_text() scans streamed text for bracketed spans and passes each candidate to _try_parse_structured(). That function tries json.loads() first, then falls back to ast.literal_eval() for non-JSON text, accepting the result as long as it's a dict or list — without checking that its contents are JSON-serializable. ast.literal_eval("[...]") is valid Python and returns [Ellipsis] (bare ... is the Ellipsis singleton), which passes the isinstance(obj, (dict, list)) check. _format_json_in_text then calls json.dumps([Ellipsis], ...), which raises TypeError: Object of type ellipsis is not JSON serializable. This propagates up through _render_main_content → _tick and crashes the whole CrewRunApp, cancelling the run.  ### Steps to Reproduce  Minimal, deterministic repro (no LLM needed): ``` from crewai_cli.crew_run_tui import _format_json_in_text _format_json_in_text("pandas,[...]") # TypeError: Object of type ellipsis is not JSON serializable ```  Full CLI repro: 1. Cr

- **Issue #7358** (2026-09-16): **[BUG] SQLiteFlowPersistence crashes with TypeError when Flow state contains datetime, UUID, or set fields**
  *Symptoms*: ### Description  When persisting Flow state via `@persist` or `SQLiteFlowPersistence`, workflows with structured Pydantic state models containing standard fields like `datetime`, `UUID`, `set`, `Decimal`, or `Path` crash during state saving with:  `RuntimeError: State persistence failed: Object of type datetime is not JSON serializable`  #### Root Cause: In `lib/crewai/src/crewai/flow/persistence/sqlite.py`: 1. `_to_state_dict` calls `state_data.model_dump()` without specifying `mode="json"`. In Pydantic v2, `model_dump()` keeps native Python types (`datetime.datetime`, `uuid.UUID`, `set`, etc.) instead of converting them to JSON primitives. 2. In `_save_state_sql` (line 142) and `save_pending_feedback` (line 241), `json.dumps(state_dict)` is called directly without a serializer fallback (`default=str`), which immediately raises a `TypeError` on any non-primitive type.  ### Steps to Reproduce  1. Define a Flow with a Pydantic state model containing a `datetime` (or `uuid.UUID`, `set`). 2. Attach `SQLiteFlowPersistence` using `@persist` on a flow step. 3. Call `flow.kickoff()`. 4. Observe the flow crashing upon completing the persisted method.  ### Expected behavior  `SQLiteFlowPersistence` should serialize Pydantic state models in JSON mode (`model_dump(mode="json")`) and handle fallback dicts gracefully with `default=str`. When loaded back via `load_state`, Pydantic's `model_validate` restores them to their native types (`datetime`, `UUID`, `set`) without data loss.  ### Scr
  **Post-Mortem & Fix Analysis**:
  > Hi Maintainers,  I would love to work on this! I've already tested the fix locally with full roundtrip serialization and deserialization across `datetime`, `UUID`, and `set` fields, and have the patch and unit tests ready to submit. If the proposal solutions looks good to you, I can work on it, Could you please assign this issue to me? Thanks!
  > Sounds good @Rohitkanithi 
  > Hi @Vidit-Ostwal, Just following up on this, I've raised PR #7376 with the complete fix and regression test coverage. Whenever you have a moment, could you please take a look and review Thanks

- **Issue #7356** (2026-09-10): **[BUG] DOCXSearchTool crashes with ValidationError when initialized with a fixed docx**
  *Symptoms*: ### Description  When `DOCXSearchTool` is initialized with a fixed document path: `tool = DOCXSearchTool(docx="document.docx")` the tool sets `self.args_schema = FixedDOCXSearchToolSchema`.  However, in `FixedDOCXSearchToolSchema`, the `docx` field is mistakenly marked as required (`Field(...)`). When an agent executes the tool with only `{"search_query": "..."}`, Pydantic raises a ValidationError: `ValidationError: 1 validation error for FixedDOCXSearchToolSchema: docx: Field required`  Unlike all sibling tools (CSVSearchTool, PDFSearchTool, JSONSearchTool, DirectorySearchTool), DOCXSearchTool accidentally inverted its schema inheritance, making the fixed mode require `docx` and breaking agent tool calls.  ### Steps to Reproduce  1. Initialize DOCXSearchTool with a fixed document:    tool = DOCXSearchTool(docx="sample.docx")  2. Validate the input that an agent sends during tool execution:    tool.args_schema.model_validate({"search_query": "quarterly revenue"})  3. Pydantic raises:    ValidationError: 1 validation error for FixedDOCXSearchToolSchema    docx: Field required [type=missing, input_value={'search_query': '...'}, input_type=dict]  ### Expected behavior  When `DOCXSearchTool` is initialized with a fixed `docx` file, `FixedDOCXSearchToolSchema` should only require `search_query`. `DOCXSearchToolSchema` should inherit from `FixedDOCXSearchToolSchema` and add `docx: str = Field(...)` for runtime/dynamic mode.  ### Screenshots/Code snippets  # Current buggy definition
  **Post-Mortem & Fix Analysis**:
  > Hi maintainers,  I would love to work on this issue!  I have already developed the patch aligning DOCXSearchTool with the standard RAG schema pattern (matching CSVSearchTool, PDFSearchTool, and JSONSearchTool), along with dedicated unit tests in test_docx_search_tool.py. All local checks (pytest, mypy, and ruff) are passing cleanly.  Could you please assign this issue to me, If the proposed solution looks good to you, I can open the PR right away.  Thanks!
  > @Rohitkanithi, sure assigning it to you.
  > <!-- linear-linkback --> <p><a href="https://linear.app/crewai/issue/OSS-147">OSS-147</a></p>

- **Issue #7305** (2026-09-08): **[BUG] 2 Tests fail when pytest is run with --disable-plugin-autoload -p anyio**
  *Symptoms*: ### Description  anyio is installed so according to args it should be used but there are these 2 failures:  ``` ================================================================================================================== FAILURES ================================================================================================================== ______________________________________________________________________________________ test_async_negative_seconds_is_rejected_when_passed_positionally ______________________________________________________________________________________ async def functions are not natively supported. You need to install a suitable plugin for your async framework, for example:   - anyio   - pytest-asyncio   - pytest-tornasync   - pytest-trio   - pytest-twisted ______________________________________________________________________________________________________ test_async_wait_caps_long_waits _______________________________________________________________________________________________________ async def functions are not natively supported. You need to install a suitable plugin for your async framework, for example:   - anyio   - pytest-asyncio   - pytest-tornasync   - pytest-trio   - pytest-twisted ```  OS: FreeBSD 15.1 Version: 1.15.20 Python-3.12 pytest-9.1.1  ### Steps to Reproduce  tun tests  ### Expected behavior  n/a  ### Screenshots/Code snippets  n/a  ### Operating System  Other (specify in additional context)  ### Python Version  3.12  
  **Post-Mortem & Fix Analysis**:
  > I reproduced this on current main with plugin autoload disabled: the two failures are the only async tests in `wait_tool_test.py`, and both use `@pytest.mark.asyncio` while only the AnyIO plugin is loaded.  I have a minimal test-only patch that switches those two tests to `@pytest.mark.anyio` and pins `anyio_backend` to `asyncio`, matching the `WaitTool.arun()` implementation that uses `asyncio.sleep`. With the isolated plugin configuration, the file changes from 2 failed / 21 passed to 23 passed.  Could you assign this issue to me? I can submit the focused PR. If you prefer keeping pytest-asyncio as a required downstream test dependency instead, I can adjust the scope.
  > These two tests fail only because pytest was invoked with `--disable-plugin-autoload -p anyio`. They are marked `@pytest.mark.asyncio` because this repo's async test runner is **pytest-asyncio** (workspace dep, `asyncio_mode = "strict"`). They pass under the normal test command.  `--disable-plugin-autoload -p anyio` is an incomplete plugin set for this suite. Load pytest-asyncio instead (`-p pytest_asyncio`). This is not a WaitTool bug.  Closing as not planned.
  > <!-- linear-linkback --> <p><a href="https://linear.app/crewai/issue/OSS-147">OSS-147</a></p>

- **Issue #7233** (2026-09-08): **[BUG] DashScope non-Qwen models bypass the native provider and ignore DASHSCOPE_BASE_URL**
  *Symptoms*: ### Description  While working on another Ollama-related fix I noticed that `_matches_provider_pattern` in `llm.py` only treats a DashScope model as natively supported when its name starts with `qwen`. Any other DashScope model skips CrewAI's native OpenAI-compatible provider and falls through to the LiteLLM fallback instead.  That matters because Alibaba's documentation says the same `compatible-mode/v1` endpoint also serves DeepSeek, Kimi, GLM and MiniMax. So the prefix check is excluding models the endpoint genuinely supports, and users of those models quietly lose their DashScope configuration.  ### Steps to Reproduce  1. Set DASHSCOPE_API_KEY and DASHSCOPE_BASE_URL. 2. Build one LLM with a Qwen model and one with a non-Qwen DashScope model. 3. Compare the class that gets created and the resolved base_url.  DASHSCOPE_API_KEY=************  DASHSCOPE_BASE_URL=https://my-dashscope.example.com/v1 python -c " from crewai import LLM for m in ['dashscope/qwen-max', 'dashscope/deepseek-v3']:     l = LLM(model=m)     print(m, type(l).__name__, getattr(l, 'base_url', None)) "  ### Expected behavior  I'd expect both models to use the native OpenAICompatibleCompletion provider and to respect DASHSCOPE_BASE_URL, since DashScope serves them through the same endpoint.  ### Screenshots/Code snippets  Here's what I get:  ``` dashscope/qwen-max                -> OpenAICompatibleCompletion   base_url=https://dashscope-intl.aliyuncs.com/compatible-mode/v1 dashscope/deepseek-v3             ->
  **Post-Mortem & Fix Analysis**:
  > <!-- linear-linkback --> <p><a href="https://linear.app/crewai/issue/OSS-147">OSS-147</a></p>

- **Issue #7124** (2026-08-26): **[BUG] `crewai create` offers 7 retired Anthropic model ids that 404 on first call**
  *Symptoms*: ### Description  `MODELS["anthropic"]` in `lib/cli/src/crewai_cli/constants.py:167-178` (at `56e0e85a`) offers 10 models. **7 of them are no longer served by the Anthropic API**, so a new user scaffolding a project and picking from the menu gets a 404 on their first call.  `GET /v1/models/{id}`, `anthropic-version: 2023-06-01`:  | line | id in menu | result | |---|---|---| | 168 | `claude-opus-4-6` | 200 `Claude Opus 4.6` | | 169 | `claude-sonnet-4-6` | 200 `Claude Sonnet 4.6` | | 170 | `claude-haiku-4-5-20251001` | 200 `Claude Haiku 4.5` | | 171 | `claude-3-7-sonnet-20250219` | **404** `model: claude-3-7-sonnet-20250219` | | 172 | `claude-3-5-sonnet-20241022` | **404** `model: claude-3-5-sonnet-20241022` | | 173 | `claude-3-5-haiku-20241022` | **404** `model: claude-3-5-haiku-20241022` | | 174 | `claude-3-5-sonnet-20240620` | **404** `model: claude-3-5-sonnet-20240620` | | 175 | `claude-3-opus-20240229` | **404** `model: claude-3-opus-20240229` | | 176 | `claude-3-sonnet-20240229` | **404** `model: claude-3-sonnet-20240229` | | 177 | `claude-3-haiku-20240307` | **404** `model: claude-3-haiku-20240307` |  The menu's newest entry is 4.6; Opus 4.7/4.8, Sonnet 5, and Opus 5 are absent.  ### Steps to Reproduce  1. `crewai create crew demo` 2. Select `anthropic` 3. Select any of the 7 ids marked 404 above 4. First `kickoff()` fails with a 404 for that model id  ### Expected behavior  Models that are actually available only show in the CLI  ### Screenshots/Code snippets  `GET /v1/m
  **Post-Mortem & Fix Analysis**:
  > Oops - already fixed by #7077, which merged 26 minutes before I filed. Closing.  

- **Issue #7004** (2026-09-29): **[BUG] LLM().call() doesn't work with Tools**
  *Symptoms*: ### Description  LLM().call() doesn't work with Tools  ### Steps to Reproduce  code  ### Expected behavior  I want to use the LLM() class without Agent() for more control over the "messages" (lower level).  ### Screenshots/Code snippets  ```python import crewai as c import crewai.flow as cf import crewai_tools as ct import logging from pathlib import Path  logging.basicConfig(level=logging.DEBUG)  llm = c.LLM(model="ollama/my", base_url="http://127.0.0.1:8080") print(c.__version__)  ROOT = Path(Path(__file__).parent, "_temp").resolve() ROOT.mkdir(parents=True, exist_ok=True) fwriter = ct.FileWriterTool(base_dir=str(ROOT)) freader = ct.FileReadTool(base_dir=str(ROOT))  print(llm.call(     messages=[{"role":"user","content":"Who are you?"}],     tools=[fwriter, freader], )) ```   ### Operating System  Windows 10  ### Python Version  3.12  ### crewAI Version  1.15.16  ### crewAI Tools Version  1.15.16  ### Virtual Environment  Venv  ### Evidence  DEBUG:asyncio:Using proactor: IocpProactor ERROR:root:OpenAI: Error extracting tool info: Tool must be a dictionary ERROR:root:OpenAI: Tool structure: name='File Writer Tool' description="A tool to write content to a specified file. Accepts filename, content, and optionally a directory path and overwrite flag as input. Writes are confined to the tool's allowed directory; a filename or directory that resolves outside it is rejected." env_vars=[] args_schema=<class 'crewai_tools.tools.file_writer_tool.file_writer_tool.FileWriterToolInput'
  **Post-Mortem & Fix Analysis**:
  > I want to solve this issue 
  > I reproduced this and I'm tracing the difference between the tool-conversion path used by Agent and direct LLM.call(). I'll add regression coverage once I determine whether LLM.call() should normalize BaseTool instances or reuse an existing conversion helper.
  > With patch #7005 , LLM.call() returned: ``` [ChatCompletionMessageFunctionToolCall(id='9HOqZpSsDjmRvNEB1FbXjzUT58VDKFKR', function=Function(arguments='{"content":"I am a large language model, trained by Google.","directory":"","filename":"answer.md","overwrite":true}', name='file_writer_tool'), type='function')] ``` I expected a full cycle of processing "messages" with a call to Tools.

- **Issue #6984** (2026-09-03): **[BUG] Gemini native provider never appends trailing user turn -> 400 'Requests ending with a model turn are not supported'**
  *Symptoms*: ### Description  GeminiCompletion._format_messages_for_gemini (the native Google Gen AI provider used for gemini/... and google/... model strings) converts assistant messages to Gemini's model role but never guards against the resulting contents list ending on a model turn. CrewAI's own agent loop can produce exactly that history -- e.g. handle_max_iterations_exceeded appending an assistant message and re-calling the LLM, or a task guardrail/guardrail_max_retries re-invocation after the last LLM turn -- and the malformed history is sent to Gemini's generateContent API verbatim, which rejects it.  Other providers already guard this exact case in LLM._format_messages_for_provider (Mistral and Ollama append a synthetic trailing user message when the last message is assistant), but that method is only used on the LiteLLM fallback path. The native Gemini/Google provider (crewai/llms/providers/gemini/completion.py), which is what actually handles gemini/* and google/* model strings once google-genai is installed, has no equivalent guard.  ### Steps to Reproduce  - Build a CrewAI Agent/Task/Crew using LLM(model="gemini/gemini-flash-latest") (or any google/.../gemini/... model, with the google-genai extra installed so the native provider is used).  - Give the task a guardrail with guardrail_max_retries set (or otherwise get the agent loop to hit handle_max_iterations_exceeded), so the executor re-invokes the LLM after an assistant/tool-call turn was already appended to history withou
  **Post-Mortem & Fix Analysis**:
  > Solid root-cause work...... the LiteLLM fallback having the guard while the native provider doesn't is exactly why it feels inconsistent. For anyone stuck before a PR merges: raising `max_iterations` and setting `guardrail_max_retries=0` avoids the re-invoke path, and uninstalling `google-genai` makes `gemini/*` fall back to LiteLLM where the trailing-user guard already exists. Hope your PR lands, it's clearly the right fix.
  > This is a very AgentCI-shaped failure: the guardrail/retry path is supposed to make the run **more reliable**, but it leaves a provider-invalid history and the next request dies before the retry can do useful work.  We’re recruiting retry/history breakers like this. A portable fixture could run the same logical trajectory through native providers and bind: pre-retry history → provider-specific effective history → exact wire turn ordering → terminal outcome. If a synthetic turn is required, its provenance should be explicit instead of silently changing the conversation.  If you or an external agent contribute the network-free formatter fixture, we’ll preserve this issue as provenance and give permanent public credit/backlink in AgentCI’s Breaker Hall of Fame, plus help generalize it into a cross-provider retry-history regression.  AgentCI: https://github.com/jinngimk-lang/agentci Recognition: https://github.com/jinngimk-lang/agentci/blob/main/COMMUNITY.md  Affiliation disclosed; no Crew
  > Confirmed this is still present on current `main` — `contents[-1].role == "model"` goes straight into `generate_content` with no guard, while the LiteLLM path has had one since the Mistral/Ollama handling in `_format_messages_for_provider`.  I'm putting up a PR that mirrors the existing Mistral guard at the end of `_format_messages_for_gemini`: when the last content is a model turn, append a synthetic user turn ("Please continue.", same text the Mistral path uses) so the agent loop can safely re-invoke after a guardrail retry or `handle_max_iterations_exceeded`. Regression tests cover the trailing-assistant case plus the no-op cases (already-user-ending, tool-response-ending, system-only). 

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

### Incident Patch 1: `243e8199` (2026-09-29)
**Commit Message**: fix(tracing): report tracing sent usage from the grant exporter (#7810)

Since 1.15.22 every crew and flow kickoff owns an execution uuid, so the
legacy TraceBatchManager handlers never finalize a batch and the
`tracing:ephemeral_sent` / `tracing:authenticated_sent` Feature Usage
events stopped. Emit them from GrantSpanExporter.record_export, the point
both upload tiers reach once every span has arrived.

Co-authored-by: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `lib/crewai/src/crewai/telemetry/tracing/grants.py` (modified, +6/-1)
```diff
@@ -27,6 +27,7 @@
     is_tui_mode,
     should_suppress_tracing_messages,
 )
+from crewai.telemetry.telemetry import Telemetry
 from crewai.telemetry.tracing import last_run
 from crewai.telemetry.tracing.session import MAX_EXPORT_BATCH_SIZE, otlp_exporter
 
@@ -293,15 +294,19 @@ def record_export(self) -> None:
             self._recorded = True
             execution_uuid = self._grant.execution_uuid
             api = getattr(self._client, "_api", None)
+            tier = getattr(self._client, "_tier", None)
             last_run.record_last_run(
                 execution_id=execution_uuid,
-                tier=getattr(self._client, "_tier", None),
+                tier=tier,
                 started_at_ns=self._first_start_ns,
                 finished_at_ns=self._last_end_ns,
                 amp_base_url=getattr(api, "base_url", None),
                 trace_url=self._trace_url,
             )
             logger.debug("Traces exported for execution %s", execution_uuid)
+            # Counts that a trace reached AMP, never its contents. The legacy
+            # TraceBatchManager emits the same names for runs outside a kickoff.
+            Telemetry().feature_usage_span(f"tracing:{tier}_sent")
             self._show_trace_link()
 
     def _show_trace_link(self) -> None:
```

**File**: `lib/crewai/tests/telemetry/test_session_trace_export.py` (modified, +139/-0)
```diff
@@ -847,3 +847,142 @@ def test_invalid_buffer_limits_use_safe_defaults(monkeypatch, invalid):
     buffer = EphemeralSpanBuffer()
     assert buffer._max_spans == 1000 and buffer._max_bytes == 8388608
     buffer.shutdown()
+
+
+@pytest.fixture
+def sent_features(monkeypatch):
+    """The `tracing:*` Feature Usage names emitted, in order."""
+    from crewai.telemetry.telemetry import Telemetry
+
+    features = []
+    monkeypatch.setattr(
+        Telemetry,
+        "feature_usage_span",
+        lambda self, feature: features.append(feature)
+        if feature.startswith("tracing:")
+        else None,
+    )
+    return features
+
+
+@pytest.mark.parametrize(
+    ("authenticated", "approved", "grant_status", "export_status", "expected"),
+    [
+        (True, True, 200, 200, ["tracing:authenticated_sent"]),
+        (False, True, 200, 200, ["tracing:ephemeral_sent"]),
+        (False, False, 200, 200, []),
+        (True, True, 200, 401, []),
+        (False, True, 200, 401, []),
+        (False, True, 500, 200, []),
+    ],
+)
+def test_a_trace_that_reaches_amp_is_counted_once_by_tier(
+    collector,
+    sent_features,
+    monkeypatch,
+    authenticated,
+    approved,
+    grant_status,
+    export_status,
+    expected,
+):
+    """Declined consent, a refused grant, or a rejected export never counts."""
+    from crewai.execution import begin_execution, end_execution
+    from crewai.telemetry.tracing.context import get_trace_session
+
+    collector.grant_status = grant_status
+    collector.export_status = export_status
+    if authenticated:
+        monkeypatch.setenv("CREWAI_USER_PAT", "synthetic-pat")
+
+    def run():
+        with trace_consent(lambda: approved):
+            token = begin_execution(tracing=True)
+            try:
+                record(get_trace_session())
+                nested = begin_execution(tracing=True)
+                end_execution(nested)
+            finally:
+                end_execution(token)
+
+    copy_context().run(run)
+    assert sent_features == expected
+
+
+def test_a_deferred_run_is_counted_once_when_it_finally_ends(
+    collector, sent_features, monkeypatch
+):
+    from crewai.execution import begin_execution, end_execution
+    from crewai.telemetry.tracing.context import get_trace_session
+
+    monkeypatch.setenv("CREWAI_USER_PAT", "synthetic-pat")
+    token = begin_execution(tracing=True)
+    try:
+        session = get_trace_session()
+        record(session)
+        session.flush()
+    finally:
+        lifetime = end_execution(token, defer=True)
+    assert sent_features == []  # spans reached AMP, but the run is not over
+
+    token = begin_execution(tracing=True, trace_session=lifetime)
+    try:
+        record(get_trace_session(), "second turn")
+    finally:
+        end_execution(token)
+    assert sent_features == ["tracing:authenticated_sent"]
+
+
+def test_recording_the_same_export_twice_counts_it_once(collector, sent_features):
+    client = TraceGrantClient(None)
+    grant = client.create(str(uuid4()))
+    exporter = GrantSpanExporter(client, grant)
+    session = TraceSession(grant.execution_uuid, [exporter])
+    try:
+        record(session)
+    finally:
+        session.shutdown()
+    exporter.record_export()
+    exporter.record_export()
+    assert sent_features == ["tracing:ephemeral_sent"]
+
+
+def test_a_truncated_ephemeral_trace_is_not_counted(
+    collector, sent_features, monkeypatch
+):
+    """It is uploaded, but like the `crewai eval` record it is not a whole run."""
+    monkeypatch.setenv("CREWAI_EPHEMERAL_TRACE_MAX_SPANS", "1")
+    with trace_consent(lambda: True), ephemeral_tracing(str(uuid4())) as session:
+        record(session, "first")
+        record(session, "second")
+    assert len(collector.batches) == 1
+    assert sent_features == []
+
+
+@pytest.mark.parametrize("authenticated", [True, False])
+@pytest.mark.parametrize("use_async", [False, True])
+def test_a_flow_kickoff_counts_its_trace(
+    coll
```

---

### Incident Patch 2: `19d2ebcc` (2026-09-29)
**Commit Message**: fix(cli): crewai eval exits 1 unless the gate passed, and says to log in when nothing was traced unattended (#7806)

* fix(cli): `crewai eval` exits 1 unless the gate passed, and says to log in when nothing was traced unattended

The exit code is what a CI job reads, and it said only whether the evaluation
finished: a run whose goal gate FAILED exited 0, so a pipeline gating on
`crewai eval` waved it through. It is the gate's now — 0 only for PASSED; a
failed gate, one without a verdict, and an evaluation that stopped are 1. The
command's help says so.

With no terminal and no login, an anonymous run's trace stays on the machine
even with tracing on (nobody is there to approve the upload). `crewai eval` then
told the user to turn tracing on, which they had — the same loop again. When
tracing is on and nobody is logged in, it now says what traces an unattended
run: `crewai login`.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

* fix(cli): an unreadable login is the reason given when nothing was traced unattended

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

* fix(cli): print the unattended reason as text, never markup

Co-Authored-By:

**File**: `lib/cli/src/crewai_cli/cli.py` (modified, +5/-1)
```diff
@@ -693,7 +693,11 @@ def run(
     ),
 )
 def eval_command(run_id: str | None) -> None:
-    """Evaluate the last traced run through CrewAI AMP."""
+    """Evaluate the last traced run through CrewAI AMP.
+
+    Exits 0 only when the goal gate PASSED, and 1 otherwise — a failed gate, no
+    verdict, or an evaluation that could not run — so a CI job can gate on it.
+    """
     eval_crew(run_id=run_id)
 
 
```

**File**: `lib/cli/src/crewai_cli/experimental/eval_crew.py` (modified, +39/-2)
```diff
@@ -168,10 +168,19 @@ def eval_crew(run_id: str | None = None) -> None:
         raise SystemExit(130) from None
     _print_verdict(finished, url)
     _say_where_the_criteria_live(write_eval_config(finished))
-    if finished.get("status") != "done":
+    # The exit code is what a CI job reads, so it is the gate's: 0 only for a
+    # run that PASSED. A failed gate, one without a verdict, and an evaluation
+    # that stopped are all 1 — a pipeline that carried on past any of them would
+    # ship what the evaluation did not vouch for.
+    if not _gate_passed(finished):
         raise SystemExit(1)
 
 
+def _gate_passed(finished: dict[str, Any]) -> bool:
+    verdict = finished.get("verdict") if finished.get("status") == "done" else None
+    return isinstance(verdict, dict) and str(verdict.get("gate")).lower() == "passed"
+
+
 def _ran_just_now(record: dict[str, Any]) -> bool:
     """Did the project record this run in the last few minutes?
 
@@ -506,7 +515,9 @@ def _run_and_let_the_app_evaluate() -> str | None:
         f"  1. add {TRACING_ENV_VAR}=true to .env\n  2. crewai run\n  3. crewai eval"
     )
     if is_dmn_mode_enabled() or not sys.stdin.isatty():
-        console.print(steps, style="yellow")
+        # `Text`, never markup: the reason may be an OS error's own words, and
+        # its `[Errno 13]` would be read as a style tag.
+        console.print(Text(_nothing_traced_unattended() or steps), style="yellow")
         raise SystemExit(1)
     if not click.confirm(
         "No traced run is recorded in this project. Turn tracing on and run the crew now? "
@@ -567,6 +578,32 @@ def _recorded_since(record: dict[str, Any], began: datetime) -> bool:
     return when >= began - timedelta(seconds=1)
 
 
+def _nothing_traced_unattended() -> str | None:
+    """Why a run with tracing on left nothing to evaluate, when nobody was there.
+
+    An anonymous run asks before its trace leaves the machine, and a process with
+    no terminal has nobody to ask — so its trace is kept local, tracing on or
+    not. Telling that user to turn tracing on sends them round the same loop;
+    logging in is what makes an unattended run traced. None when tracing is off
+    or there is a login: the ordinary steps are the right ones then. A login
+    that cannot be read says so instead.
+    """
+    if os.environ.get(TRACING_ENV_VAR, "").strip().lower() not in ("true", "1"):
+        return None
+    try:
+        if saved_login() is not None:
+            return None
+    except EvaluationStoppedError as unreadable:
+        # A login that exists and cannot be read is the reason, and its
+        # sentence says what to do about it.
+        return str(unreadable)
+    return (
+        "No traced run is recorded in this project. Tracing is on, but a run nobody is "
+        "watching is only traced when you are logged in: run `crewai login`, then "
+        "`crewai run` and `crewai eval` again."
+    )
+
+
 def _enable_tracing() -> None:
     """`CREWAI_TRACING_ENABLED=true` in the project's .env, and in this process for the run about to start."""
     env_file = Path.cwd() / ".env"
```

**File**: `lib/cli/tests/experimental/test_eval_crew.py` (modified, +82/-1)
```diff
@@ -241,13 +241,33 @@ def test_run_names_another_execution_and_an_anonymous_caller_sends_no_token(proj
     monkeypatch.setattr(eval_module, "saved_login", lambda: None)
     amp = install(monkeypatch, FakeAMP(statuses=[done("failed")]))
 
-    eval_module.eval_crew(run_id="other-run")
+    with pytest.raises(SystemExit):  # a failed gate is exit 1
+        eval_module.eval_crew(run_id="other-run")
 
     assert amp.api_key is None
     assert amp.calls[0] == ("create", "other-run")
     assert "Goal gate: FAILED" in capsys.readouterr().out
 
 
+@pytest.mark.parametrize(
+    "gate, code", [("passed", None), ("failed", 1), ("inconclusive", 1), ("unknown", 1)]
+)
+def test_the_exit_code_is_the_gates(project, monkeypatch, capsys, gate, code):
+    """A CI job reads the exit code. Only a gate that PASSED is 0: a failed one,
+    and one with no verdict, must stop the pipeline rather than wave it on."""
+    directory, _ = project
+    record_last_run(directory)
+    install(monkeypatch, FakeAMP(statuses=[done(gate)]))
+
+    if code is None:
+        eval_module.eval_crew()
+    else:
+        with pytest.raises(SystemExit) as exited:
+            eval_module.eval_crew()
+        assert exited.value.code == code
+    assert f"Goal gate: {gate.upper()}" in capsys.readouterr().out
+
+
 def test_a_failed_evaluation_exits_one_with_amps_reason(project, monkeypatch, capsys):
     directory, _ = project
     record_last_run(directory)
@@ -1126,3 +1146,64 @@ def test_read_last_run_reads_the_record_crewai_writes(tmp_path):
     record_last_run(tmp_path)
     record = eval_module.read_last_run(tmp_path)
     assert record is not None and record["execution_id"] == EXECUTION_ID and record["amp_base_url"] == "https://amp.test"
+
+
+@pytest.mark.parametrize(
+    "tracing, login, says_login",
+    [
+        ("true", None, True),  # tracing on, nobody logged in: log in
+        ("true", "tok", False),  # logged in: the ordinary steps
+        (None, None, False),  # tracing off: turn it on
+    ],
+)
+def test_an_unattended_run_with_nothing_traced_says_what_would_trace_it(
+    project, monkeypatch, capsys, tracing, login, says_login
+):
+    """With no terminal, an anonymous run's trace stays on the machine even with
+    tracing on. Telling that user to turn tracing on sends them round the same
+    loop; logging in is what makes an unattended run traced."""
+    directory, _ = project
+    (directory / "pyproject.toml").write_text("[project]\nname = 'demo'\n")
+    monkeypatch.setattr(eval_module.sys.stdin, "isatty", lambda: False)
+    monkeypatch.setattr(eval_module, "saved_login", lambda: login)
+    if tracing:
+        monkeypatch.setenv("CREWAI_TRACING_ENABLED", tracing)
+    else:
+        monkeypatch.delenv("CREWAI_TRACING_ENABLED", raising=False)
+
+    with pytest.raises(SystemExit) as exited:
+        eval_module.eval_crew()
+
+    out = capsys.readouterr().out.replace("\n", " ")
+    assert exited.value.code == 1
+    assert ("run `crewai login`" in out) is says_login
+    assert ("add CREWAI_TRACING_ENABLED=true" in out) is not says_login
+
+
+def test_an_unreadable_login_is_the_reason_given_when_nothing_was_traced(
+    project, monkeypatch, capsys
+):
+    """A login that exists and cannot be read is why an unattended run was not
+    traced, and its own sentence says what to do — not "turn tracing on"."""
+    directory, _ = project
+    (directory / "pyproject.toml").write_text("[project]\nname = 'demo'\n")
+    monkeypatch.setattr(eval_module.sys.stdin, "isatty", lambda: False)
+    monkeypatch.setenv("CREWAI_TRACING_ENABLED", "true")
+
+    def unreadable() -> None:
+        raise eval_module.EvaluationStoppedError(
+            "Could not read the saved login (PermissionError: [Errno 13] "
+            "Permission denied: [/Users/me/.config/crewai]). Run `crewai login` again"
+        )
+
+    monkeypatch.setattr(eval_module, "saved_login", unreadable)
+
+    with pytest.raises(SystemExit):
+        eval_module.eval_crew
```

---

### Incident Patch 3: `d183aedb` (2026-09-28)
**Commit Message**: ensure panel for viewing traces is visible (#7803)

**File**: `lib/crewai/src/crewai/telemetry/tracing/grants.py` (modified, +8/-2)
```diff
@@ -17,6 +17,7 @@
 from opentelemetry.sdk.trace import ReadableSpan
 from opentelemetry.sdk.trace.export import SpanExportResult, SpanExporter
 from rich.console import Console
+from rich.panel import Panel
 from rich.style import Style
 from rich.text import Text
 
@@ -304,7 +305,7 @@ def record_export(self) -> None:
             self._show_trace_link()
 
     def _show_trace_link(self) -> None:
-        """One line, once: where to see the run that was just exported.
+        """Show where to see the run that was just exported, once.
 
         The execution id stays out of it — `crewai eval` reads that from the
         record — but whoever wants to open the trace gets AMP's viewer link.
@@ -318,7 +319,12 @@ def _show_trace_link(self) -> None:
             self._trace_url,
             style=Style(color="cyan", underline=True, link=self._trace_url),
         )
-        Console().print(line)
+        title = (
+            "🔗 Ephemeral Execution Traces"
+            if self._client._tier == "ephemeral"
+            else "🔗 Execution Traces"
+        )
+        Console().print(Panel(line, title=title, border_style="green", padding=(1, 2)))
 
     def shutdown(self) -> None:
         with self._lock:
```

**File**: `lib/crewai/tests/telemetry/test_session_trace_export.py` (modified, +2/-0)
```diff
@@ -212,6 +212,8 @@ def run():
     # a run that was exported whole, and not where tracing messages are suppressed.
     shown = recorded and suppression is None
     assert ("View traces:" in output) == shown
+    assert ("Execution Traces" in output and "╭" in output) == shown
+    assert ("Ephemeral Execution Traces" in output) == (shown and not authenticated)
     assert (url in output.replace("\n", "")) == shown
     assert len(collector.batches) == int(authenticated or approved)
     # A run whose spans reached Wharf is recorded for `crewai eval`, silently,
```

---

### Incident Patch 4: `4dcd19aa` (2026-09-28)
**Commit Message**: fix(tracing): turning tracing on is the answer, and an Evaluate button in the TUI (#7765)

* fix(tracing): turning tracing on is the answer; stop asking again

Two things a user who ran `crewai eval` sees today.

`crewai eval` offers to turn tracing on and run the crew. The run finishes —
and the ephemeral buffer asks "Share this execution trace with CrewAI?", which
is the same question again. Turning tracing on IS consent: `tracing_asked_for()`
is true when `CREWAI_TRACING_ENABLED` says so or when `tracing=True` was passed
in this context, and the buffer takes it as the answer. First-time
auto-collection still asks, because nobody asked for that one.

And the offer named the mechanism rather than the effect — "Turn tracing on
(CREWAI_TRACING_ENABLED=true stays in .env) and run the crew now?", then
"Tracing is on for this project (CREWAI_TRACING_ENABLED=true in .env)." The
variable is how it works, not what the user is agreeing to; both lines now say
what happens and leave the plumbing to the .env file it is written in.

491 telemetry tests and 62 eval-CLI tests green.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>

* fix(tracing): the TUI's modal is a prompt t

**File**: `lib/cli/src/crewai_cli/crew_run_tui.py` (modified, +517/-6)
```diff
@@ -5,8 +5,15 @@
 """
 
 import asyncio
+from collections.abc import Callable, Iterator
+import contextlib
+from contextlib import contextmanager
+from contextvars import ContextVar
 import json as _json
+import os
+from pathlib import Path
 import re
+import secrets
 import threading
 import time
 from typing import Any, ClassVar
@@ -289,6 +296,116 @@ def action_consent_no(self) -> None:
         self.dismiss(False)
 
 
+_AUTO_EVAL: ContextVar[dict[str, str | None] | None] = ContextVar(
+    "crewai_tui_auto_eval", default=None
+)
+
+# The same word, for the app that runs in a CHILD process. A project's crew and
+# flow are run through `uv run …` in the project's own environment, and nothing
+# in this process's memory reaches that app — the environment does, and it is
+# the only thing that does. Set and cleared by `evaluating_after_run()` alone:
+# an internal handshake between two parts of one command, never a setting for
+# anyone to turn on.
+#
+# The child loads the project's `.env` over its environment, so the variable
+# alone would be a switch any project could flip — an evaluation started, with
+# the machine's `crewai login`, on a plain `crewai run`. Its value is therefore a
+# random token, and it counts only while the file of that name exists in this
+# user's crewAI data directory: the command writes it before the run and removes
+# it after, and a `.env` cannot create a file.
+_AWAITING_EVAL_ENV = "CREWAI_EVAL_AWAITING_RUN"
+_AWAITING_TOKEN = re.compile(r"[0-9a-f]{32}")
+
+
+def _awaiting_dir() -> Path:
+    import appdirs
+
+    return Path(appdirs.user_data_dir("crewai", "CrewAI")) / "eval-awaiting"
+
+
+@contextmanager
+def evaluating_after_run() -> Iterator[dict[str, str | None]]:
+    """Run the crew for an evaluation that is already under way.
+
+    `crewai eval` with nothing traced offers to run the crew first. The app it
+    opens would otherwise sit there until somebody quits it, with the command
+    waiting behind — so inside this block the app closes itself when the run
+    ends and leaves its execution id in the holder. It does NOT chain into an
+    evaluation of its own: the command that opened it is the one evaluating.
+
+    A run in the same process leaves its id here; a run in a child process
+    leaves it in the project's last-run record, which the caller reads when the
+    holder comes back empty.
+    """
+    holder: dict[str, str | None] = {"execution_id": None}
+    token = _AUTO_EVAL.set(holder)
+    before = os.environ.get(_AWAITING_EVAL_ENV)
+    # Without the file a child app cannot be told, and the command grades the
+    # run itself once the app closes — slower to the verdict, never wrong.
+    marker: Path | None = None
+    with contextlib.suppress(OSError):
+        nonce = secrets.token_hex(16)
+        _awaiting_dir().mkdir(parents=True, exist_ok=True)
+        (_awaiting_dir() / nonce).touch(exist_ok=False)
+        marker = _awaiting_dir() / nonce
+        os.environ[_AWAITING_EVAL_ENV] = nonce
+    try:
+        yield holder
+    finally:
+        _AUTO_EVAL.reset(token)
+        if marker is not None:
+            with contextlib.suppress(OSError):
+                marker.unlink()
+        if before is None:
+            os.environ.pop(_AWAITING_EVAL_ENV, None)
+        else:
+            os.environ[_AWAITING_EVAL_ENV] = before
+
+
+def _an_evaluation_is_waiting() -> dict[str, str | None] | None:
+    """The evaluation this run was started for, if there is one.
+
+    In this process the holder itself; in a child process the environment says
+    an evaluation is waiting and the holder is a local one — the id travels
+    back through the project's last-run record instead, which the child writes
+    when its trace is exported.
+    """
+    holder = _AUTO_EVAL.get()
+    if holder is not None:
+        return holder
+
+    value = os.environ.get(_AWAITING_EVAL_ENV) or ""
+    if not _AWAITING_TOKEN.fullmatch(value):
+        return None
+    try:
+        waiting =
```

**File**: `lib/cli/src/crewai_cli/experimental/eval_crew.py` (modified, +503/-103)
```diff
@@ -14,7 +14,9 @@
 
 from __future__ import annotations
 
+from collections.abc import Callable
 import contextlib
+from datetime import datetime, timedelta, timezone
 from ipaddress import ip_address
 import json
 import os
@@ -44,10 +46,65 @@
 TRACING_ENV_VAR = "CREWAI_TRACING_ENABLED"
 POLL_SECONDS = 3.0
 POLL_RETRIES = 5  # consecutive unreachable / 5xx polls before giving up; the evaluation keeps running
+
+# A run's spans reach AMP a little after the run ends — the exporter sends them
+# as the process closes and AMP has its own queue behind that. A command that
+# just watched the run would otherwise ask for a trace that is still in flight
+# and be told, correctly and uselessly, that there is nothing there. So a run
+# we know is fresh gets a wait; an id somebody typed does not, and fails at
+# once as it always has.
+SPANS_WAIT_SECONDS = 120.0
+SPANS_POLL_SECONDS = 5.0
+RUN_IS_FRESH_SECONDS = 600.0
 FINISHED = {"done", "failed"}
 STATUSES = {"queued", "running"} | FINISHED
 
 
+def _record_usage(*, logged_in: bool) -> None:
+    """Count an evaluation that is actually starting, and whether the caller was
+    logged in.
+
+    Usage stats are anonymous, so nothing that names the run or the account is
+    sent — no execution id, no organization, and nothing about the run's content.
+    Which runs were evaluated, and by whom, is AMP's record, not these stats'.
+
+    The TUI's button counts `cli_usage:evaluate` when it is pressed, so the
+    difference between that and `cli_usage:eval` is intent that never became an
+    evaluation.
+    """
+    try:
+        from crewai_core.telemetry import Telemetry
+
+        telemetry = Telemetry()
+        telemetry.set_tracer()
+        telemetry.feature_usage_span(
+            "cli_usage:eval",
+            {"authenticated": "true" if logged_in else "false"},
+        )
+    except Exception:  # noqa: S110 - telemetry must never break a command
+        pass
+
+
+NOT_TRACED = (
+    "The run finished but no trace was recorded: the run may have failed, sharing the "
+    "trace was declined, or this project's crewai is older than the version that records "
+    f"the last run ({LAST_RUN_FILE}). Run the crew again and accept when asked, then `crewai eval`."
+)
+
+
+class EvaluationStoppedError(RuntimeError):
+    """The evaluation cannot go on, in words meant for a reader.
+
+    Raised rather than printed-and-exited, because the same two functions serve
+    the terminal and the run app: one of them owns the screen, and a line
+    printed underneath it is a smear nobody asked for.
+    """
+
+
+def _note(text: str, style: str = "dim") -> None:
+    console.print(Text(text), style=style)
+
+
 def eval_crew(run_id: str | None = None) -> None:
     """Evaluate the last traced run of this project, or the run RUN_ID."""
     get_or_create_project_id()
@@ -57,10 +114,19 @@ def eval_crew(run_id: str | None = None) -> None:
     record = read_last_run() or {}
     execution_id = run_id or record.get("execution_id")
     if execution_id is None:
-        execution_id = _run_now_or_explain()
+        # Nothing traced here: the crew runs first, and the app that runs it
+        # carries the evaluation on its own screen — link, progress, verdict.
+        # It comes back with the run to grade when the app did NOT get to it: a
+        # conversational session, or a flow that took the terminal instead.
+        execution_id = _run_and_let_the_app_evaluate()
+        if execution_id is None:
+            return
         record = read_last_run() or {}
 
-    client = _amp_client(trusted)
+    try:
+        client = _amp_client(trusted)
+    except EvaluationStoppedError as stopped:
+        _fail(str(stopped))
     recorded_amp = str(record.get("amp_base_url") or "").rstrip("/")
     if not run_id and recorded_amp and recorded_amp != client.base_url.rstrip("/"):
         console.print(
@@ -69,7 +135,18 @@ def eval_crew(run_id: str | None = None) -> None:
             ),
             styl
```

**File**: `lib/cli/src/crewai_cli/plus_api.py` (modified, +13/-3)
```diff
@@ -27,12 +27,22 @@ class PlusAPI(_CorePlusAPI):
     EVALUATION_START_TIMEOUT = 120.0
     EVALUATION_POLL_TIMEOUT = 30.0
 
-    def create_evaluation(self, execution_id: str) -> httpx.Response:
-        """Ask AMP to evaluate the traced run EXECUTION_ID (crewai eval)."""
+    def create_evaluation(
+        self, execution_id: str, *, eval_config: str | None = None
+    ) -> httpx.Response:
+        """Ask AMP to evaluate the traced run EXECUTION_ID (crewai eval).
+
+        EVAL_CONFIG is the project's own `eval.jsonc` when it has one: what
+        good means for this crew, in its own words. Sent as it was written,
+        comments and all, and read by the grader rather than here.
+        """
+        body: dict[str, str] = {"execution_id": execution_id}
+        if eval_config:
+            body["eval_config"] = eval_config
         return self._make_request(
             "POST",
             self.EVALUATIONS_RESOURCE,
-            json={"execution_id": execution_id},
+            json=body,
             timeout=self.EVALUATION_START_TIMEOUT,
         )
 
```

**File**: `lib/cli/src/crewai_cli/run_crew.py` (modified, +42/-0)
```diff
@@ -600,6 +600,48 @@ def _print_post_tui_summary(app: CrewRunApp) -> None:
             )
         )
 
+    _print_evaluation_line(app, console, crewai_teal)
+
+
+def _print_evaluation_line(app: CrewRunApp, console: Any, teal: str) -> None:
+    """The evaluation's link, once the app that showed it has gone.
+
+    An evaluation started inside the app is read there; the terminal is what is
+    left afterwards, and a link that only ever existed on a screen that is now
+    closed is a link nobody can open again.
+    """
+    evaluation = getattr(app, "_evaluation", None) or {}
+    url = str(evaluation.get("url") or "")
+    if not url:
+        return
+
+    from rich.text import Text
+
+    state = str(evaluation.get("state"))
+    line = Text("\n  ")
+    if state == "done":
+        verdict = evaluation.get("verdict") or {}
+        line.append("Evaluated: ", style="dim")
+        line.append(
+            f"goal gate {str(verdict.get('gate') or '').upper()}  ", style="bold"
+        )
+    elif state == "failed":
+        line.append("Evaluation stopped — the report has what it got: ", style="dim")
+    else:
+        line.append("Evaluation still running at ", style="dim")
+    line.append(url, style=f"{teal} underline")
+    console.print(line)
+
+    wrote = evaluation.get("wrote_config")
+    if wrote:
+        note = Text("  ")
+        note.append(f"Wrote {wrote}", style="bold")
+        note.append(
+            " — say what good means for this crew there, and the next evaluation is graded on it.",
+            style="dim",
+        )
+        console.print(note)
+
 
 def run_crew(
     trained_agents_file: str | None = None,
```

**File**: `lib/cli/src/crewai_cli/run_declarative_flow.py` (modified, +4/-0)
```diff
@@ -328,6 +328,10 @@ def _print_flow_post_tui_summary(app: Any) -> None:
             )
         )
 
+    from crewai_cli.run_crew import _print_evaluation_line
+
+    _print_evaluation_line(app, console, crewai_teal)
+
 
 def _resolve_flow_inputs(flow: Any, provided: dict[str, Any]) -> dict[str, Any]:
     """Resolve kickoff inputs from the flow's state schema.
```

---

### Incident Patch 5: `4ed2abc7` (2026-09-25)
**Commit Message**: fix(llm): retry throttled provider calls (#7677)

* feat(llm): add rate limit retry policy foundation

* feat(llm): retry rate limited client calls

* fix(llm): keep throttles out of context recovery

* refactor(llm): use throttling classifier directly

* refactor(llm): clarify retry scope name

* test(llm): keep retry coverage provider neutral

* refactor(llm): simplify retry defaults

* refactor(llm): encapsulate throttling retries

**File**: `lib/crewai/src/crewai/llm.py` (modified, +4/-4)
```diff
@@ -1149,7 +1149,7 @@ def _handle_streaming_response(
             raise
         except Exception as e:
             error_msg = str(e)
-            if LLMContextLengthExceededError._is_context_limit_error(error_msg):
+            if LLMContextLengthExceededError._is_context_length_exceeded_error(e):
                 raise LLMContextLengthExceededError(error_msg) from e
 
             logging.error(f"Error in streaming response: {e!s}")
@@ -1346,7 +1346,7 @@ def _handle_non_streaming_response(
             raise
         except Exception as e:
             error_msg = str(e)
-            if LLMContextLengthExceededError._is_context_limit_error(error_msg):
+            if LLMContextLengthExceededError._is_context_length_exceeded_error(e):
                 raise LLMContextLengthExceededError(error_msg) from e
             raise
 
@@ -1501,7 +1501,7 @@ async def _ahandle_non_streaming_response(
             raise
         except Exception as e:
             error_msg = str(e)
-            if LLMContextLengthExceededError._is_context_limit_error(error_msg):
+            if LLMContextLengthExceededError._is_context_length_exceeded_error(e):
                 raise LLMContextLengthExceededError(error_msg) from e
             raise
 
@@ -1773,7 +1773,7 @@ async def _ahandle_streaming_response(
             raise
         except Exception as e:
             error_msg = str(e)
-            if LLMContextLengthExceededError._is_context_limit_error(error_msg):
+            if LLMContextLengthExceededError._is_context_length_exceeded_error(e):
                 raise LLMContextLengthExceededError(error_msg) from e
 
             if chunk_count == 0:
```

**File**: `lib/crewai/src/crewai/llms/base_llm.py` (modified, +43/-0)
```diff
@@ -11,6 +11,7 @@
 from contextlib import contextmanager
 import contextvars
 from datetime import datetime
+from functools import wraps
 import json
 import logging
 import re
@@ -42,6 +43,7 @@
     ToolUsageFinishedEvent,
     ToolUsageStartedEvent,
 )
+from crewai.llms.retry import arun_with_rate_limit_retry, run_with_rate_limit_retry
 from crewai.types.streaming import StreamSession
 from crewai.types.usage_metrics import UsageMetrics
 from crewai.utilities.pydantic_schema_utils import serialize_model_class
@@ -177,6 +179,47 @@ class BaseLLM(BaseModel, ABC):
 
     model_config = ConfigDict(arbitrary_types_allowed=True, populate_by_name=True)
 
+    def __init_subclass__(cls, **kwargs: Any) -> None:
+        """Wrap concrete client call methods with the shared retry policy."""
+        super().__init_subclass__(**kwargs)
+        cls._wrap_call_method("call")
+        cls._wrap_call_method("acall")
+
+    @classmethod
+    def _wrap_call_method(cls, method_name: str) -> None:
+        """Install one retry wrapper around a subclass-defined public call method."""
+        method = cls.__dict__.get(method_name)
+        if method is None or getattr(method, "_crewai_rate_limit_wrapped", False):
+            return
+
+        if method_name == "call":
+
+            @wraps(method)
+            def wrapped_call(instance: BaseLLM, *args: Any, **kwargs: Any) -> Any:
+                return run_with_rate_limit_retry(
+                    lambda: method(instance, *args, **kwargs)
+                )
+
+            wrapped_call._crewai_rate_limit_wrapped = True  # type: ignore[attr-defined]
+            setattr(cls, method_name, wrapped_call)
+            return
+
+        if method_name == "acall":
+
+            @wraps(method)
+            async def wrapped_acall(
+                instance: BaseLLM, *args: Any, **kwargs: Any
+            ) -> Any:
+                return await arun_with_rate_limit_retry(
+                    lambda: method(instance, *args, **kwargs)
+                )
+
+            wrapped_acall._crewai_rate_limit_wrapped = True  # type: ignore[attr-defined]
+            setattr(cls, method_name, wrapped_acall)
+            return
+
+        raise ValueError(f"Unsupported LLM call method: {method_name}")
+
     llm_type: str = "base"
     model: str
     temperature: float | None = None
```

**File**: `lib/crewai/src/crewai/llms/retry.py` (added, +225/-0)
```diff
@@ -0,0 +1,225 @@
+"""Shared primitives for retrying transient LLM rate limits."""
+
+from __future__ import annotations
+
+import asyncio
+from collections.abc import Awaitable, Callable, Iterator
+import contextvars
+import random
+import time
+from typing import Any, Final, TypeVar, cast
+
+
+_RETRYABLE_ERROR_CODES: Final[frozenset[str]] = frozenset(
+    {
+        "429",
+        "ratelimiterror",
+        "ratelimitexceeded",
+        "resourceexhausted",
+        "throttlingexception",
+        "toomanyrequests",
+    }
+)
+_NON_RETRYABLE_ERROR_CODES: Final[frozenset[str]] = frozenset(
+    {
+        "servicequotaexceededexception",
+    }
+)
+_RETRYABLE_MESSAGE_MARKERS: Final[tuple[str, ...]] = (
+    "rate limit",
+    "rate-limit",
+    "too many requests",
+    "throttled",
+    "resource exhausted",
+)
+_LLM_RATE_LIMIT_MAX_ATTEMPTS: Final = 3
+_LLM_RATE_LIMIT_INITIAL_DELAY_SECONDS: Final = 1.0
+_LLM_RATE_LIMIT_MAX_DELAY_SECONDS: Final = 8.0
+_LLM_RATE_LIMIT_JITTER_RATIO: Final = 0.2
+_T = TypeVar("_T")
+_active_llm_rate_limit_retry: contextvars.ContextVar[bool] = contextvars.ContextVar(
+    "_active_llm_rate_limit_retry", default=False
+)
+
+
+class _ThrottlingErrorClassifier:
+    """Classify provider exceptions without exposing provider SDK details."""
+
+    @classmethod
+    def is_throttling_error(cls, error: BaseException) -> bool:
+        """Return whether an error chain represents a transient provider throttle."""
+        error_chain = tuple(cls.iter_error_chain(error))
+        error_codes = tuple(cls.error_code(candidate) for candidate in error_chain)
+        if any(code in _NON_RETRYABLE_ERROR_CODES for code in error_codes):
+            return False
+
+        for candidate, error_code in zip(error_chain, error_codes, strict=True):
+            if (
+                cls.status_code(candidate) == 429
+                or error_code in _RETRYABLE_ERROR_CODES
+            ):
+                return True
+
+        return any(
+            marker in str(candidate).lower()
+            for candidate in error_chain
+            for marker in _RETRYABLE_MESSAGE_MARKERS
+        )
+
+    @staticmethod
+    def iter_error_chain(error: BaseException) -> Iterator[BaseException]:
+        """Yield an exception and its explicit or implicit causes once each."""
+        seen: set[int] = set()
+        current: BaseException | None = error
+        while current is not None and id(current) not in seen:
+            seen.add(id(current))
+            yield current
+            current = current.__cause__ or current.__context__
+
+    @staticmethod
+    def error_code(error: BaseException) -> str:
+        """Extract and normalize provider error codes across common SDK shapes."""
+        code: Any = getattr(error, "code", None)
+        response = getattr(error, "response", None)
+        if isinstance(response, dict):
+            response_error = response.get("Error") or response.get("error") or {}
+            if isinstance(response_error, dict):
+                code = response_error.get("Code") or response_error.get("code") or code
+        return str(code or error.__class__.__name__).replace("_", "").lower()
+
+    @staticmethod
+    def status_code(error: BaseException) -> int | None:
+        """Extract an HTTP status code when an SDK exposes one."""
+        status_code = getattr(error, "status_code", None)
+        response = getattr(error, "response", None)
+        if status_code is None:
+            status_code = getattr(response, "status_code", None)
+        return status_code if isinstance(status_code, int) else None
+
+
+def get_retry_delay_seconds(
+    retry_number: int,
+    *,
+    retry_after_seconds: float | None = None,
+    random_value: Callable[[], float] = random.random,
+) -> float:
+    """Calculate a jittered backoff delay for a one-based retry number.
+
+    A provider-provided retry delay takes precedence over locally calculated
+    backoff. ``random_value`` is injectable to make 
```

**File**: `lib/crewai/src/crewai/utilities/agent_utils.py` (modified, +2/-2)
```diff
@@ -795,9 +795,9 @@ def is_context_length_exceeded(exception: Exception) -> bool:
     Returns:
         bool: True if the exception is due to context length exceeding
     """
-    return LLMContextLengthExceededError(str(exception))._is_context_limit_error(
+    return LLMContextLengthExceededError(
         str(exception)
-    )
+    )._is_context_length_exceeded_error(exception)
 
 
 def handle_context_length(
```

**File**: `lib/crewai/src/crewai/utilities/exceptions/context_window_exceeding_exception.py` (modified, +11/-3)
```diff
@@ -1,5 +1,7 @@
 from typing import Final
 
+from crewai.llms.retry import _ThrottlingErrorClassifier
+
 
 CONTEXT_LIMIT_ERRORS: Final[list[str]] = [
     "expected a string with maximum length",
@@ -30,15 +32,21 @@ def __init__(self, error_message: str) -> None:
         super().__init__(self._get_error_message(error_message))
 
     @staticmethod
-    def _is_context_limit_error(error_message: str) -> bool:
-        """Check if the error message indicates a context length limit error.
+    def _is_context_length_exceeded_error(error: str | BaseException) -> bool:
+        """Check whether an error represents a context limit, not a throttle.
 
         Args:
-            error_message: The error message to check.
+            error: The provider exception or error message to check.
 
         Returns:
             True if the error message indicates a context length limit error, False otherwise.
         """
+        if isinstance(
+            error, BaseException
+        ) and _ThrottlingErrorClassifier.is_throttling_error(error):
+            return False
+
+        error_message = str(error)
         return any(
             phrase.lower() in error_message.lower() for phrase in CONTEXT_LIMIT_ERRORS
         )
```

---

### Incident Patch 6: `dd4a1062` (2026-09-25)
**Commit Message**: fix(bedrock): fall back to sync calls from acall (#7680)

**File**: `lib/crewai/src/crewai/llms/providers/bedrock/completion.py` (modified, +15/-4)
```diff
@@ -1,5 +1,6 @@
 from __future__ import annotations
 
+import asyncio
 from collections.abc import Mapping, Sequence
 from contextlib import AsyncExitStack
 import json
@@ -485,15 +486,25 @@ async def acall(
             Generated text response or structured output.
 
         Raises:
-            NotImplementedError: If aiobotocore is not installed.
             LLMContextLengthExceededError: If context window is exceeded.
         """
         effective_response_model = response_model or self.response_format
 
         if not AIOBOTOCORE_AVAILABLE:
-            raise NotImplementedError(
-                "Async support for AWS Bedrock requires aiobotocore. "
-                'Install with: uv add "crewai[bedrock]"'
+            logging.warning(
+                "aiobotocore is not installed; falling back to synchronous AWS "
+                "Bedrock calls in a worker thread. Install `crewai[bedrock]` "
+                "for native async support."
+            )
+            return await asyncio.to_thread(
+                self.call,
+                messages,
+                tools=tools,
+                callbacks=callbacks,
+                available_functions=available_functions,
+                from_task=from_task,
+                from_agent=from_agent,
+                response_model=effective_response_model,
             )
 
         with llm_call_context():
```

**File**: `lib/crewai/tests/llms/bedrock/test_bedrock.py` (modified, +41/-0)
```diff
@@ -1,4 +1,6 @@
+import logging
 import os
+import threading
 from unittest.mock import patch, MagicMock
 import pytest
 
@@ -210,6 +212,45 @@ def test_bedrock_completion_call():
         mock_call.assert_called_once_with("Hello, how are you?")
 
 
+@pytest.mark.asyncio
+async def test_bedrock_acall_falls_back_to_sync_call_without_aiobotocore(caplog):
+    """Async Bedrock calls remain usable when only the sync SDK is installed."""
+    llm = LLM(model="bedrock/anthropic.claude-3-5-sonnet-20241022-v2:0")
+    callbacks = [MagicMock()]
+    available_functions = {"lookup": MagicMock()}
+    call_thread_id: int | None = None
+
+    def sync_call(*args, **kwargs):
+        nonlocal call_thread_id
+        call_thread_id = threading.get_ident()
+        return "fallback response"
+
+    with caplog.at_level(logging.WARNING):
+        with (
+            patch.object(bedrock_completion, "AIOBOTOCORE_AVAILABLE", False),
+            patch.object(llm, "call", side_effect=sync_call) as mock_call,
+        ):
+            event_loop_thread_id = threading.get_ident()
+            result = await llm.acall(
+                "Hello, how are you?",
+                callbacks=callbacks,
+                available_functions=available_functions,
+            )
+
+    assert result == "fallback response"
+    assert call_thread_id != event_loop_thread_id
+    assert "falling back to synchronous AWS Bedrock calls" in caplog.text
+    mock_call.assert_called_once_with(
+        "Hello, how are you?",
+        tools=None,
+        callbacks=callbacks,
+        available_functions=available_functions,
+        from_task=None,
+        from_agent=None,
+        response_model=None,
+    )
+
+
 def test_bedrock_completion_called_during_crew_execution():
     """
     Test that BedrockCompletion.call is actually invoked when running a crew
```

---

### Incident Patch 7: `7060bf85` (2026-09-23)
**Commit Message**: Merge pull request #7717 from crewAIInc/security-policy-update

Security policy: security@ and private vulnerability reporting

**File**: `.github/security.md` (modified, +87/-10)
```diff
@@ -1,15 +1,92 @@
-## CrewAI Security Policy
+# Security policy
 
-We are committed to protecting the confidentiality, integrity, and availability of the
-CrewAI ecosystem.
+Thank you for helping keep CrewAI and the people who use it safe. This page
+explains how to report a security issue, what to include, what is in scope,
+and what you can expect from us.
 
-### How to Report
+## How to report
 
-Please submit reports through one of the following channels:
+- **A vulnerability in this repository's code:** open a private report at
+  https://github.com/crewAIInc/crewAI/security/advisories/new. The details
+  stay private, and we can work on the fix, the advisory, and the CVE with
+  you in one place.
+- **Anything else** (the CrewAI platform at app.crewai.com, Factory,
+  crewAI-tools, another CrewAI service, or you are not sure where it
+  belongs): email **security@crewai.com**.
 
-- **crewai-vdp-ess@submit.bugcrowd.com**
-- https://security.crewai.com
+Please do not report security issues through public GitHub issues, pull
+requests, discussions, or social media.
 
-- **Please do not** disclose vulnerabilities via public GitHub issues, pull requests,
-  or social media
-- Reports submitted via channels other than the methods above will not be reviewed and will be dismissed
+## What to include
+
+- The product and the version, commit, or URL affected.
+- Where the problem is: endpoint, file, function, or setting.
+- Steps to reproduce, or a proof of concept. Plain text beats screenshots;
+  please do not send executables.
+- What an attacker could do with it.
+- How you would like to be credited, if at all.
+
+## Scope
+
+- crewAI (this repository) and crewAI-tools
+- The CrewAI AMP platform at app.crewai.com
+- CrewAI Factory releases
+
+## Out of scope
+
+- Third-party services and sites CrewAI does not operate
+- Denial of service, load testing, and other volumetric testing
+- Social engineering and physical attacks
+- Scanner output without demonstrated impact: missing headers, SPF, DMARC
+  or CAA records, version banners, rate limiting
+- Generic "the LLM can be jailbroken" findings without a crewAI-specific
+  defect
+- trust.crewai.com, which is operated by Vanta, except where the finding
+  concerns CrewAI's own content on it
+
+If a report is out of scope, we will tell you so in one reply.
+
+## What we commit to
+
+- Acknowledgment within 2 business days.
+- A substantive response within 10 business days: confirmed, not
+  reproducible, out of scope, already known, or still investigating with a
+  date for the next update.
+- An update at least every 14 days until the report is closed.
+- Coordinated disclosure. We publish the fix and the advisory together, by
+  default within 90 days of acknowledgment; earlier if the fix ships sooner,
+  later only by agreement with you.
+- A CVE, through GitHub's CNA, for confirmed vulnerabilities in publicly
+  distributed CrewAI products.
+- Credit in the advisory if you want it.
+
+## Bounties
+
+CrewAI does not run a paid bug bounty program. We credit reporters who want
+credit.
+
+## Safe harbor
+
+CrewAI will not pursue or support legal action against anyone who reports a
+security issue in good faith and follows these rules:
+
+- Test only against your own account, your own self-hosted Factory instance,
+  or your own copy of our open-source software.
+- Do not access, modify, copy, or keep data that is not yours. If you
+  encounter customer or personal data, stop and tell us immediately.
+- Do not degrade our service: no denial-of-service testing, no bulk automated
+  scanning against AMP, no spam.
+- No social engineering of CrewAI staff, customers, or vendors; no physical
+  attempts against CrewAI property.
+- Report promptly via private vulnerability reporting for this repository's
+  code, or security@crewai.com for other issues. Give us the agreed time to
+  fix before disclosing publicly.
+
+Good-faith research within these rules is authorized access for the p
```

---

### Incident Patch 8: `65361144` (2026-09-23)
**Commit Message**: fix(deps): pin instructor <1.16 to keep OpenAI Mode.TOOLS registered (#7719)

* fix(deps): pin instructor <1.16 to keep OpenAI Mode.TOOLS registered

instructor 1.16.0 removed the OpenAI Mode.TOOLS handler in favor of
Mode.RESPONSES_TOOLS. `InternalInstructor` calls `instructor.from_provider`,
which still defaults to Mode.TOOLS internally, so any native-OpenAI kickoff
that hits a structured-output path (guardrails, output_pydantic, LLM
guardrails) fails immediately with `ModeError: Mode.TOOLS is not registered
for provider Provider.OPENAI`.

Cap the range while we teach `_create_instructor_client` to negotiate a
supported mode against `mode_registry`.

Refs COR-861 (Docusign, deployment 134108).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

* fix: avoid redundant cache saves in tests workflow

Co-authored-by: vinibrsl <5093045+vinibrsl@users.noreply.github.com>

* docs: explain instructor compatibility pin

Co-authored-by: vinibrsl <5093045+vinibrsl@users.noreply.github.com>

---------

Co-authored-by: Daniel Minella <dminella@Mac.home>
Co-authored-by: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
Co-authored-by: copilot-swe-agent[bot] <198982749+Cop

**File**: `.github/workflows/tests.yml` (modified, +1/-1)
```diff
@@ -113,7 +113,7 @@ jobs:
 
 
       - name: Save uv caches
-        if: steps.cache-restore.outputs.cache-hit != 'true'
+        if: steps.cache-restore.outputs.cache-hit != 'true' && matrix.group == 1
         uses: actions/cache/save@0057852bfaa89a56745cba8c7296529d2fc39830 # v4.3.0
         with:
           path: |
```

**File**: `lib/crewai/pyproject.toml` (modified, +3/-1)
```diff
@@ -13,7 +13,9 @@ dependencies = [
     # Core Dependencies
     "pydantic>=2.11.9,<2.13",
     "openai>=2.30.0,<3",
-    "instructor>=1.3.3",
+    # instructor>=1.16 drops OpenAI Mode.TOOLS; remove this cap after
+    # InternalInstructor negotiates a supported mode via mode_registry.
+    "instructor>=1.3.3,<1.16",
     # Text Processing
     "pdfplumber~=0.11.4",
     "regex~=2026.1.15",
```

---

### Incident Patch 9: `9de80df7` (2026-09-22)
**Commit Message**: fix(cli): print whatever areas the evaluation graded (#7701)

`crewai eval` printed a fixed tuple of area names. The areas belong to the
evaluation, not to the client, so a fixed list does two wrong things the
moment the evaluator's vocabulary moves ahead of an installed CLI: it drops
every area it has not heard of, and it invents "not measured" for ones that no
longer exist. A user would see one real grade and three phantom blanks, with
no sign that anything had been dropped.

It now prints the areas it was sent, in the order they arrived. The verdict is
still validated exactly as before — a grade is an int in 1..5 or null — so a
malformed payload is still a protocol error rather than something printed.

This lands before the evaluator's own change so that an installed CLI keeps
working through the rollout rather than after it.

**File**: `lib/cli/src/crewai_cli/eval_crew.py` (modified, +56/-19)
```diff
@@ -31,6 +31,7 @@
 from dotenv import load_dotenv, set_key
 import httpx
 from rich.console import Console
+from rich.text import Text
 
 from crewai_cli.authentication.token import AuthError, get_auth_token
 from crewai_cli.plus_api import PlusAPI
@@ -63,17 +64,22 @@ def eval_crew(run_id: str | None = None) -> None:
     recorded_amp = str(record.get("amp_base_url") or "").rstrip("/")
     if not run_id and recorded_amp and recorded_amp != client.base_url.rstrip("/"):
         console.print(
-            f"The run was traced to {recorded_amp}; evaluating at the configured AMP {client.base_url}.",
+            Text(
+                f"The run was traced to {recorded_amp}; evaluating at the configured AMP {client.base_url}."
+            ),
             style="yellow",
         )
     started = _start_evaluation(client, execution_id)
     url = started.get("url")
-    console.print(f"Evaluating run [bold]{execution_id}[/bold]")
+    console.print(Text("Evaluating run ").append(execution_id, style="bold"))
     if url:
-        console.print(f"Follow it at [cyan underline]{url}[/cyan underline]")
+        # Appended, never interpolated: this line invites a click, so a `url`
+        # carrying `[link=…]` would print a trustworthy label over a hostile
+        # target. The style belongs to the span, not to the string.
+        console.print(Text("Follow it at ").append(url, style="cyan underline"))
         _open(url)
 
-    finished = _wait(client, str(started["id"]), url)
+    finished = _wait(client, started["id"], url)
     _print_verdict(finished, url)
     if finished.get("status") != "done":
         raise SystemExit(1)
@@ -139,8 +145,10 @@ def _amp_client(trusted: set[str]) -> PlusAPI:
         else "would carry the login over plain HTTP"
     )
     console.print(
-        f"Reading anonymously: {client.base_url} {why}. "
-        "Run `crewai enterprise configure <url>` to log in to it.",
+        Text(
+            f"Reading anonymously: {client.base_url} {why}. "
+            "Run `crewai enterprise configure <url>` to log in to it."
+        ),
         style="yellow",
     )
     return PlusAPI()
@@ -244,7 +252,22 @@ def _start_evaluation(client: PlusAPI, execution_id: str) -> dict[str, Any]:
         _fail(f"Could not reach AMP to start the evaluation: {error}")
     if response.status_code in (200, 202):
         payload = _payload(response)
-        if payload and payload.get("id"):
+        # The id is what every later call is made with, so a missing or
+        # non-string one is a protocol error and not something to carry on
+        # with. The url is only ever shown and opened, so a malformed one
+        # costs the link and nothing else: the evaluation is already running
+        # and its verdict is what the user came for.
+        if payload and isinstance(payload.get("id"), str) and payload["id"]:
+            if not isinstance(payload.get("url"), str):
+                if payload.get("url") is not None:
+                    console.print(
+                        Text(
+                            "AMP answered with a report url that is not a string; "
+                            "the link is unavailable for this run."
+                        ),
+                        style="yellow",
+                    )
+                payload["url"] = None
             return payload
         _fail(f"AMP answered without an evaluation id ({response.status_code}).")
     _refused(response, f"run {execution_id}")
@@ -294,7 +317,7 @@ def _wait(client: PlusAPI, evaluation_id: str, url: str | None) -> dict[str, Any
                 )
             time.sleep(POLL_SECONDS)
     except KeyboardInterrupt:
-        console.print(f"\nStill running{where}.", style="yellow")
+        console.print(Text(f"\nStill running{where}."), style="yellow")
         raise SystemExit(130) from None
 
 
@@ -315,25 +338,36 @@ def _a_grade(grade: Any) -> bool:
 
 
 def _print_verdict(finished: dict[str, Any], url: str | None) -> None:

```

**File**: `lib/cli/tests/test_eval_crew.py` (modified, +113/-0)
```diff
@@ -95,6 +95,119 @@ def test_the_last_run_is_evaluated_the_url_opened_and_the_verdict_printed(projec
     assert "Goal gate: PASSED" in out and "goal 5/5" in out and "cost not measured" in out
 
 
+def test_the_verdict_prints_whatever_areas_the_evaluation_graded(project, monkeypatch, capsys):
+    # The areas are the evaluator's to name. A client printing its own list
+    # would drop the ones it had not heard of and invent "not measured" for
+    # ones that no longer exist — which is what happens the moment the
+    # evaluation's vocabulary moves ahead of an installed CLI.
+    directory, _ = project
+    record_last_run(directory)
+    graded = done(grades={"goal": 5, "tasks": 3, "agents": 4, "tools": None})
+    install(monkeypatch, FakeAMP(statuses=[httpx.Response(200, json={"id": "ev-1", "status": "running"}), graded]))
+
+    eval_module.eval_crew()
+
+    out = capsys.readouterr().out
+    # The whole segment, in order: asserting the parts one by one would pass
+    # even if this path sorted them or printed its own list.
+    assert "Goal gate: PASSED · goal 5/5 · tasks 3/5 · agents 4/5 · tools not measured" in out
+    assert "quality" not in out and "process" not in out
+
+
+def test_an_areas_name_is_printed_literally_never_as_markup(project, monkeypatch, capsys):
+    # Every part of this line came over the wire, and a Console parses square
+    # brackets. A fixed list of areas made that impossible; printing what
+    # arrives does not, so an area named `[red]tasks[/red]` must show its own
+    # brackets rather than restyling the verdict.
+    directory, _ = project
+    record_last_run(directory)
+    graded = done(grades={"[red]tasks[/red]": 4, "[bold]goal": 5})
+    install(monkeypatch, FakeAMP(statuses=[httpx.Response(200, json={"id": "ev-1", "status": "running"}), graded]))
+
+    eval_module.eval_crew()
+
+    out = capsys.readouterr().out
+    assert "[red]tasks[/red] 4/5" in out
+    assert "[bold]goal 5/5" in out
+
+
+def test_the_follow_link_cannot_be_retargeted_by_the_url_amp_sends(project, monkeypatch, capsys):
+    # This line invites a click, so a `url` carrying `[link=…]` would print a
+    # trustworthy label over a hostile target. It is the worst place in this
+    # command to let markup through.
+    directory, _ = project
+    record_last_run(directory)
+    hostile = "[link=http://attacker.test/]https://app.crewai.com/e/ev-1[/link]"
+    created = httpx.Response(202, json={"id": "ev-1", "url": hostile, "status": "queued"})
+    install(monkeypatch, FakeAMP(create=created, statuses=[done()]))
+
+    eval_module.eval_crew()
+
+    out = capsys.readouterr().out
+    assert "[link=http://attacker.test/]" in out  # printed, not followed
+
+
+def test_a_url_that_is_not_a_string_costs_the_link_and_nothing_else(project, monkeypatch, capsys):
+    # Composing the line means appending the url rather than interpolating it,
+    # and `Text.append` wants a string. A malformed one must not become a
+    # traceback: the evaluation is already running and its verdict is what the
+    # user came for, so the link is dropped and the run carries on.
+    directory, opened = project
+    record_last_run(directory)
+    created = httpx.Response(202, json={"id": "ev-1", "url": ["not", "a", "string"], "status": "queued"})
+    install(monkeypatch, FakeAMP(create=created, statuses=[done()]))
+
+    eval_module.eval_crew()
+
+    out = capsys.readouterr().out
+    assert "report url that is not a string" in out  # said, not swallowed
+    assert "Goal gate: PASSED" in out  # and the verdict still arrives
+    assert opened == []  # nothing was handed to a browser
+    assert "Follow it at" not in out
+
+
+def test_an_id_that_is_not_a_string_is_a_protocol_error(project, monkeypatch, capsys):
+    # The id is what every later call is made with, so there is nothing to
+    # carry on with — unlike the url, which is only ever shown.
+    directory, _ = project
+    record_last_run(directory)
+    created = httpx.Resp
```

---

### Incident Patch 10: `0a3b8912` (2026-09-21)
**Commit Message**: feat(cli): crewai eval evaluates the last traced run through AMP (#7649)

* feat(cli): crewai eval evaluates the last traced run through AMP

`crewai eval` reads `.crewai/last_run.json` — the record crewAI writes
when a traced run's spans reach Wharf — and asks AMP to evaluate that
run: POST /crewai_plus/api/v1/tracing/evaluations with the execution id,
sending the saved `crewai login` when there is one and nothing otherwise.
AMP answers with an evaluation id and a URL; the command prints the URL,
opens it, waits for the verdict and prints it (goal gate and the four
grades), exit 1 only when the evaluation itself failed. `--run
EXECUTION_ID` evaluates another run.

With no traced run recorded it offers to turn tracing on for the project
(`CREWAI_TRACING_ENABLED=true` in .env, set_key so nothing else in the
file moves) and run the crew now with `crewai run`; without a terminal, or
declined, it prints the three steps instead. A run that leaves no record
behind is explained, never guessed at.

AMP's refusals are printed in its own words: a run that needs an account
(401 account_required), a refused credential (then `crewai login`), a run
AMP does not hold (404), rate limiting (429 wit

**File**: `lib/cli/src/crewai_cli/cli.py` (modified, +23/-0)
```diff
@@ -48,6 +48,12 @@ def run_crew(*args: Any, **kwargs: Any) -> Any:
     return _run_crew(*args, **kwargs)
 
 
+def eval_crew(*args: Any, **kwargs: Any) -> Any:
+    from crewai_cli.eval_crew import eval_crew as _eval_crew
+
+    return _eval_crew(*args, **kwargs)
+
+
 if TYPE_CHECKING:
     # mypy sees the real classes; at runtime the shims below defer the
     # heavy imports until a command actually instantiates them.
@@ -674,6 +680,23 @@ def run(
     )
 
 
+@crewai.command(name="eval")
+@click.option(
+    "--run",
+    "run_id",
+    type=str,
+    default=None,
+    metavar="EXECUTION_ID",
+    help=(
+        "Evaluate this traced run instead of the last one. The execution id "
+        "crewAI recorded for the run."
+    ),
+)
+def eval_command(run_id: str | None) -> None:
+    """Evaluate the last traced run through CrewAI AMP."""
+    eval_crew(run_id=run_id)
+
+
 @crewai.command()
 def update() -> None:
     """Update the pyproject.toml of the Crew project to use uv."""
```

**File**: `lib/cli/src/crewai_cli/eval_crew.py` (added, +377/-0)
```diff
@@ -0,0 +1,377 @@
+"""`crewai eval`: evaluate the last traced run through CrewAI AMP.
+
+crewAI records a traced run in `.crewai/last_run.json` when the run's spans
+reach Wharf. This command reads that record (or takes `--run EXECUTION_ID`),
+asks AMP to evaluate the run, prints and opens the URL AMP answers with,
+waits for the verdict and prints it. With no traced run recorded it offers
+to turn tracing on for the project and run the crew now.
+
+Who may evaluate what is AMP's decision: an anonymous run once without an
+account, then it needs one; a run traced while logged in for that
+organization's members; a deployment execution for members who may see its
+traces. The command sends the saved `crewai login` when there is one.
+"""
+
+from __future__ import annotations
+
+import contextlib
+from ipaddress import ip_address
+import json
+import os
+from pathlib import Path
+import sys
+import time
+from typing import Any
+from urllib.parse import urlparse
+import webbrowser
+
+import click
+from crewai_core.constants import DEFAULT_CREWAI_ENTERPRISE_URL
+from crewai_core.settings import Settings
+from dotenv import load_dotenv, set_key
+import httpx
+from rich.console import Console
+
+from crewai_cli.authentication.token import AuthError, get_auth_token
+from crewai_cli.plus_api import PlusAPI
+from crewai_cli.utils import get_or_create_project_id, is_dmn_mode_enabled
+
+
+console = Console()
+
+LAST_RUN_FILE = Path(".crewai") / "last_run.json"
+TRACING_ENV_VAR = "CREWAI_TRACING_ENABLED"
+POLL_SECONDS = 3.0
+POLL_RETRIES = 5  # consecutive unreachable / 5xx polls before giving up; the evaluation keeps running
+FINISHED = {"done", "failed"}
+STATUSES = {"queued", "running"} | FINISHED
+
+
+def eval_crew(run_id: str | None = None) -> None:
+    """Evaluate the last traced run of this project, or the run RUN_ID."""
+    get_or_create_project_id()
+    # Read before the project's .env is loaded, so a project cannot add itself.
+    trusted = _trusted_amp_origins()
+    _load_project_env()
+    record = read_last_run() or {}
+    execution_id = run_id or record.get("execution_id")
+    if execution_id is None:
+        execution_id = _run_now_or_explain()
+        record = read_last_run() or {}
+
+    client = _amp_client(trusted)
+    recorded_amp = str(record.get("amp_base_url") or "").rstrip("/")
+    if not run_id and recorded_amp and recorded_amp != client.base_url.rstrip("/"):
+        console.print(
+            f"The run was traced to {recorded_amp}; evaluating at the configured AMP {client.base_url}.",
+            style="yellow",
+        )
+    started = _start_evaluation(client, execution_id)
+    url = started.get("url")
+    console.print(f"Evaluating run [bold]{execution_id}[/bold]")
+    if url:
+        console.print(f"Follow it at [cyan underline]{url}[/cyan underline]")
+        _open(url)
+
+    finished = _wait(client, str(started["id"]), url)
+    _print_verdict(finished, url)
+    if finished.get("status") != "done":
+        raise SystemExit(1)
+
+
+def _trusted_amp_origins() -> set[str]:
+    """Where the saved login may be sent: the AMP this machine is configured for
+    (`crewai enterprise configure`), one already exported in this shell, and
+    crewAI's own."""
+    candidates = (
+        os.environ.get("CREWAI_PLUS_URL"),
+        Settings().enterprise_base_url,
+        DEFAULT_CREWAI_ENTERPRISE_URL,
+    )
+    return {origin for origin in map(_origin, candidates) if origin}
+
+
+def _origin(url: str | None) -> str | None:
+    parsed = urlparse(str(url or ""))
+    return (
+        f"{parsed.scheme}://{parsed.netloc}".lower()
+        if parsed.scheme and parsed.netloc
+        else None
+    )
+
+
+def _encrypted(origin: str | None) -> bool:
+    """HTTPS, or plain HTTP to this machine — the rule `TraceGrantClient` already
+    applies to collector grants (localhost, its subdomains, loopback addresses)."""
+    parsed = urlparse(origin or "")
+    if parsed.scheme == "https":
+        retur
```

**File**: `lib/cli/src/crewai_cli/plus_api.py` (modified, +24/-1)
```diff
@@ -18,9 +18,32 @@ class PlusAPI(_CorePlusAPI):
 
     The ZIP deployment methods live here as well as in newer crewai-core
     versions so editable CLI installs still work when an older crewai-core is
-    present in the runtime environment.
+    present in the runtime environment. The evaluation methods live here
+    because only the CLI calls them.
     """
 
+    EVALUATIONS_RESOURCE = f"{_CorePlusAPI.TRACING_RESOURCE}/evaluations"
+    # AMP reads the run's spans from Wharf inside the POST; a large run takes a while.
+    EVALUATION_START_TIMEOUT = 120.0
+    EVALUATION_POLL_TIMEOUT = 30.0
+
+    def create_evaluation(self, execution_id: str) -> httpx.Response:
+        """Ask AMP to evaluate the traced run EXECUTION_ID (crewai eval)."""
+        return self._make_request(
+            "POST",
+            self.EVALUATIONS_RESOURCE,
+            json={"execution_id": execution_id},
+            timeout=self.EVALUATION_START_TIMEOUT,
+        )
+
+    def get_evaluation(self, evaluation_id: str) -> httpx.Response:
+        """The evaluation's status and, once done, its verdict."""
+        return self._make_request(
+            "GET",
+            f"{self.EVALUATIONS_RESOURCE}/{evaluation_id}",
+            timeout=self.EVALUATION_POLL_TIMEOUT,
+        )
+
     def _make_multipart_request(
         self,
         method: HttpMethod,
```

**File**: `lib/cli/tests/test_eval_crew.py` (added, +505/-0)
```diff
@@ -0,0 +1,505 @@
+"""`crewai eval`: the last traced run, evaluated through AMP."""
+
+from __future__ import annotations
+
+import json
+import os
+from pathlib import Path
+from types import SimpleNamespace
+
+from click.testing import CliRunner
+import httpx
+import pytest
+from rich.console import Console
+
+from crewai_cli import eval_crew as eval_module
+from crewai_cli.cli import eval_command
+
+
+EXECUTION_ID = "6f31fe1a-20bd-4bfe-a011-25d6b9341f62"
+URL = "https://evolve.crewai.test/e/ev-1"
+
+
+class FakeAMP:
+    """A PlusAPI double: scripted answers, calls recorded."""
+
+    def __init__(self, create=None, statuses=None):
+        self.create = create if create is not None else httpx.Response(
+            202, json={"id": "ev-1", "url": URL, "status": "queued"}
+        )
+        self.statuses = list(statuses or [])
+        self.calls: list[tuple] = []
+        self.api_key = None
+
+    def create_evaluation(self, execution_id):
+        self.calls.append(("create", execution_id))
+        return self.create
+
+    def get_evaluation(self, evaluation_id):
+        self.calls.append(("get", evaluation_id))
+        return self.statuses.pop(0) if self.statuses else httpx.Response(200, json={"id": evaluation_id, "status": "running"})
+
+
+def done(gate="passed", grades=None):
+    return httpx.Response(200, json={
+        "id": "ev-1", "status": "done", "url": URL,
+        "verdict": {"gate": gate, "grades": grades if grades is not None else {"goal": 5, "quality": 4, "process": 5, "cost": None}},
+    })
+
+
+@pytest.fixture
+def project(tmp_path, monkeypatch):
+    monkeypatch.chdir(tmp_path)
+    monkeypatch.setattr(eval_module, "console", Console(width=240))  # one sentence per line in the captured output
+    monkeypatch.setattr(eval_module, "get_or_create_project_id", lambda: None)
+    monkeypatch.setattr(eval_module, "saved_login", lambda: "login-token")
+    monkeypatch.setattr(eval_module.time, "sleep", lambda seconds: None)
+    monkeypatch.setattr(eval_module, "is_dmn_mode_enabled", lambda: False)
+    # This machine is logged in to https://amp.test (`crewai enterprise configure`).
+    monkeypatch.setattr(eval_module, "Settings", lambda: SimpleNamespace(enterprise_base_url="https://amp.test"))
+    monkeypatch.delenv("CREWAI_PLUS_URL", raising=False)
+    opened: list[str] = []
+    monkeypatch.setattr(eval_module.webbrowser, "open", lambda url: opened.append(url) or True)
+    return tmp_path, opened
+
+
+def record_last_run(directory: Path, execution_id: str = EXECUTION_ID, **fields) -> None:
+    (directory / ".crewai").mkdir(exist_ok=True)
+    record = {"execution_id": execution_id, "tier": "ephemeral", "amp_base_url": "https://amp.test", **fields}
+    (directory / ".crewai" / "last_run.json").write_text(json.dumps(record))
+
+
+def install(monkeypatch, amp: FakeAMP, configured_amp: str = "https://amp.test") -> FakeAMP:
+    def build(api_key=None, base_url=None):
+        # PlusAPI's own resolution: explicit, then CREWAI_PLUS_URL, then the saved settings.
+        amp.api_key = api_key
+        amp.base_url = base_url or os.environ.get("CREWAI_PLUS_URL") or configured_amp
+        return amp
+
+    monkeypatch.setattr(eval_module, "PlusAPI", build)
+    return amp
+
+
+def test_the_last_run_is_evaluated_the_url_opened_and_the_verdict_printed(project, monkeypatch, capsys):
+    directory, opened = project
+    record_last_run(directory)
+    amp = install(monkeypatch, FakeAMP(statuses=[httpx.Response(200, json={"id": "ev-1", "status": "running"}), done()]))
+
+    eval_module.eval_crew()
+
+    out = capsys.readouterr().out
+    assert amp.api_key == "login-token"
+    assert amp.calls == [("create", EXECUTION_ID), ("get", "ev-1"), ("get", "ev-1")]
+    assert opened == [URL]
+    assert EXECUTION_ID in out and URL in out
+    assert "Goal gate: PASSED" in out and "goal 5/5" in out and "cost not measured" in out
+
+
+def test_run_names_another_execution_and_an_anonymous_caller_sends_no_token(p
```

**File**: `lib/cli/tests/test_plus_api.py` (modified, +27/-0)
```diff
@@ -18,6 +18,33 @@ def test_init(self):
         self.assertIn("CrewAI-CLI/", self.api.headers["User-Agent"])
         self.assertTrue(self.api.headers["X-Crewai-Version"])
 
+    @patch("crewai_core.plus_api.PlusAPI._make_request")
+    def test_create_evaluation(self, mock_make_request):
+        mock_response = MagicMock()
+        mock_make_request.return_value = mock_response
+
+        response = self.api.create_evaluation("6f31fe1a-20bd-4bfe-a011-25d6b9341f62")
+
+        mock_make_request.assert_called_once_with(
+            "POST",
+            "/crewai_plus/api/v1/tracing/evaluations",
+            json={"execution_id": "6f31fe1a-20bd-4bfe-a011-25d6b9341f62"},
+            timeout=120.0,  # AMP reads the run's spans inside this request
+        )
+        self.assertEqual(response, mock_response)
+
+    @patch("crewai_core.plus_api.PlusAPI._make_request")
+    def test_get_evaluation(self, mock_make_request):
+        mock_response = MagicMock()
+        mock_make_request.return_value = mock_response
+
+        response = self.api.get_evaluation("ev-1")
+
+        mock_make_request.assert_called_once_with(
+            "GET", "/crewai_plus/api/v1/tracing/evaluations/ev-1", timeout=30.0
+        )
+        self.assertEqual(response, mock_response)
+
     @patch("crewai_core.plus_api.PlusAPI._make_request")
     def test_login_to_tool_repository(self, mock_make_request):
         mock_response = MagicMock()
```

#### Recent Merged Pull Requests:
- **PR #7829** (closed): feat(tools): add Vetto sandbox tool for unprivileged process isolation (@shleder)
- **PR #7817** (closed): feat: Add NTI Guardrail Middleware for post-quantum agent security (@abisheakp197)
- **PR #7815** (2026-09-29): refactor: move message summarization into SummarizeMessages (@Vidit-Ostwal)
- **PR #7811** (2026-09-30): feat(cli): crewai eval --models, and llm_overlay swaps models as well as roles (@joaomdmoura)
- **PR #7810** (2026-09-29): fix(tracing): report tracing sent usage from the grant exporter (@joaomdmoura)
- **PR #7809** (closed): feat(flow): add trace replay and step resume (@aakash665)
- **PR #7806** (2026-09-29): fix(cli): crewai eval exits 1 unless the gate passed, and says to log in when nothing was traced unattended (@joaomdmoura)
- **PR #7805** (2026-09-28): [docs-freeze] docs: snapshot and changelog for v1.15.23 (@lorenzejay)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
