# Forensic Learning Record (Deep Inspection): tach-org/tach

> **Canonical Artifact**: `07_PROJECT_LEARNING/tach-org-tach-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tach-org/tach](https://github.com/tach-org/tach))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:14:41.273Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tach-org/tach`
- **Description**: A Python tool to visualize + enforce dependencies, using modular architecture 🌎 Open source 🐍 Installable via pip 🔧 Able to be adopted incrementally - ⚡ Implemented with no runtime impact ♾️ Interoperable with your existing systems 🦀 Written in rust
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md
- **Stars / Engagement**: 2827 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `python/tach/__init__.py`
```
from __future__ import annotations

__version__: str = "0.35.1"

__all__ = ["__version__"]

```

### Core Architecture Module: `python/tach/__main__.py`
```
from __future__ import annotations

from tach.start import start

if __name__ == "__main__":
    start()

```

### Core Architecture Module: `python/tach/cache/__init__.py`
```
from __future__ import annotations

from tach.cache.access import get_latest_version, get_uid

__all__ = ["get_latest_version", "get_uid"]

```

### Core Architecture Module: `python/tach/cache/access.py`
```
from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from tach.cache.setup import resolve_dot_tach

if TYPE_CHECKING:
    from pathlib import Path


def get_uid(project_root: Path) -> uuid.UUID | None:
    info_path = project_root / ".tach" / "tach.info"
    if not info_path.exists():
        resolve_dot_tach(project_root)
    contents = info_path.read_text().strip()
    uid = uuid.UUID(contents)
    return uid


def get_latest_version(project_root: Path) -> str | None:
    latest_version_path = project_root / ".tach" / ".latest-version"
    if not latest_version_path.exists():
        return
    version = latest_version_path.read_text().strip()
    return version

```

### Core Architecture Module: `python/tach/cache/setup.py`
```
from __future__ import annotations

import uuid
from pathlib import Path

from tach import __version__


def resolve_dot_tach(project_root: Path) -> Path | None:
    def _create(path: Path, is_file: bool = False, file_content: str = "") -> None:
        if not path.exists():
            if is_file:
                path.write_text(file_content.strip())
            else:
                path.mkdir()

    # Create .tach
    tach_path = project_root / ".tach"
    _create(tach_path)
    # Create info
    info_path = tach_path / "tach.info"
    _create(info_path, is_file=True, file_content=str(uuid.uuid4()))
    # Create .gitignore
    gitignore_content = """
# This folder is for tach. Do not edit.

# gitignore all content, including this .gitignore
*
    """
    gitignore_path = tach_path / ".gitignore"
    _create(gitignore_path, is_file=True, file_content=gitignore_content)
    # Create version
    version_path = tach_path / ".latest-version"
    _create(version_path, is_file=True, file_content=__version__)
    return Path(tach_path)

```

### Core Architecture Module: `python/tach/check_external.py`
```
from __future__ import annotations

from tach.extension import check_external_dependencies as check_external

__all__ = ["check_external"]

```

### Core Architecture Module: `python/tach/cli.py`
```
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import TYPE_CHECKING, Any

from tach import __version__, cache, extension, icons
from tach import filesystem as fs
from tach.check_external import check_external
from tach.console import console_err
from tach.constants import CONFIG_FILE_NAME, TOOL_NAME
from tach.errors import (
    TachCircularDependencyError,
    TachClosedBetaError,
    TachError,
    TachSetupError,
    TachVisibilityError,
)
from tach.extension import Direction, ProjectConfig
from tach.filesystem import install_pre_commit
from tach.init import init_project
from tach.logging import CallInfo, logger
from tach.modularity import export_report, upload_report_to_gauge
from tach.parsing import combine_exclude_paths, parse_project_config
from tach.report import external_dependency_report, report
from tach.show import (
    generate_module_graph_dot_file,
    generate_module_graph_dot_string,
    generate_module_graph_mermaid,
    generate_module_graph_mermaid_string,
    upload_show_report,
)
from tach.test import run_affected_tests

if TYPE_CHECKING:
    from tach.extension import UnusedDependencies


import signal


def handle_sigint(_signum: int, _frame: Any) -> None:
    print("Exiting...")
    sys.exit(1)


signal.signal(signal.SIGINT, handle_sigint)


def print_unused_dependencies(
    all_unused_dependencies: list[UnusedDependencies],
) -> None:
    constraint_messages = "\n".join(
        f"{icons.FAIL} [bold]'{unused_dependencies.path}'[/] does not depend on: [bold]{[dependency.path for dependency in unused_dependencies.dependencies]}[/]"
        for unused_dependencies in all_unused_dependencies
    )
    console_err.print(
        "[red bold]Unused Dependencies[/]\n" + f"[yellow]{constraint_messages}[/]"
    )
    console_err.print(
        f"\nRemove the unused dependencies from {CONFIG_FILE_NAME}.toml, "
        f"or consider running '{TOOL_NAME} sync' to update module configuration and "
        f"remove all unused dependencies.\n",
        style="yellow",
    )


def print_no_config_found(
    output_format: str = "text", *, config_file_name: str = CONFIG_FILE_NAME
) -> None:
    if output_format == "json":
        json.dump({"error": "No config file found"}, sys.stdout)
    else:
        console_err.print(
            f"Configuration file not found. Run [cyan]'{TOOL_NAME} init'[/] to get started!",
            style="yellow",
        )


def print_no_modules_found() -> None:
    console_err.print(
        "No modules have been defined yet. Run [cyan]'tach init'[/] to get started!",
        style="yellow",
    )


def print_no_dependencies_found() -> None:
    console_err.print(
        "No dependency rules were found for your modules. You may need to run [cyan]'tach sync'[/] or adjust your source root.",
        style="yellow",
    )


def print_show_web_suggestion(is_mermaid: bool = False) -> None:
    if is_mermaid:
        console_err.print(
            "NOTE: You are generating a Mermaid graph locally representing your module graph. For a remotely hosted visualization, use the '--web' argument.\nTo visualize your graph, you will need to use Mermaid.js: https://mermaid.js.org/config/usage.html\n",
            style="cyan",
        )
    else:
        console_err.print(
            "NOTE: You are generating a DOT file locally representing your module graph. For a remotely hosted visualization, use the '--web' argument.\nTo visualize your graph, you will need a program like GraphViz: https://www.graphviz.org/download/\n",
            style="cyan",
        )


def print_generated_module_graph_file(
    output_filepath: Path, is_mermaid: bool = False
) -> None:
    if is_mermaid:
        console_err.print(
            f"Generated a Mermaid file containing your module graph at '{output_filepath}'",
            style="green",
        )
    else:
        console_err.print(
            f"Generated a DOT file containing your module graph at '{output_filepath}'",
            style="green",
        )


def print_circular_dependency_error(
    module_paths: list[str], output_format: str = "text"
) -> None:
    if output_format == "json":
        json.dump(
            {"error": "Circular dependency", "dependencies": module_paths}, sys.stdout
        )
    else:
        console_err.print(
            "\n".join(
                [
                    f"{icons.FAIL} [red]Circular dependency detected for module [/]'{module_path}'"
                    for module_path in module_paths
                ]
            )
            + f"\n\n[yellow]Resolve circular dependencies.\n"
            f"Remove or unset 'forbid_circular_dependencies' from "
            f"'{CONFIG_FILE_NAME}.toml' to allow circular dependencies.[/]",
        )


def print_visibility_errors(
    visibility_errors: list[tuple[str, str, list[str]]], output_format: str = "text"
) -> None:
    if output_format == "json":
        json.dump(
            {"error": "Visibility error", "visibility_errors": visibility_errors},
            sys.stdout,
        )
    else:
        for dependent_module, dependency_module, visibility in visibility_errors:
            console_err.print(
                f"{icons.FAIL} [red]Module configuration error:[/] [yellow]'{dependent_module}' cannot depend on '{dependency_module}' because '{dependent_module}' does not match its visibility: {visibility}.[/]"
                "\n"
                f"[yellow]Adjust 'visibility' for '{dependency_module}' to include '{dependent_module}', or remove the dependency.[/]"
                "\n",
            )


def add_base_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "-e",
        "--exclude",
        required=False,
        type=str,
        metavar="file_or_path,...",
        help="Comma separated path list to exclude. tests/, ci/, etc.",
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog=TOOL_NAME,
        add_help=True,
    )
    parser.add_argument(
        "--version", action="version", version=f"{TOOL_NAME} {__version__}"
    )

    subparsers = parser.add_subparsers(title="commands", dest="command")

    ## tach mod
    mod_parser = subparsers.add_parser(
        "mod",
        prog=f"{TOOL_NAME} mod",
        help="Configure module boundaries interactively",
        description="Configure module boundaries interactively",
    )
    mod_parser.add_argument(
        "-d",
        "--depth",
        type=int,
        nargs="?",
        default=None,
        help="The number of child directories to expand from the root",
    )
    add_base_arguments(mod_parser)

    ## tach check
    check_parser = subparsers.add_parser(
        "check",
        prog=f"{TOOL_NAME} check",
        help="Check existing boundaries against your dependencies and module interfaces",
        description="Check existing boundaries against your dependencies and module interfaces",
    )
    check_parser.add_argument(
        "--exact",
        action="store_true",
        help="When checking dependencies, raise errors if any dependencies are unused.",
    )
    check_parser.add_argument(
        "--dependencies",
        action="store_true",
        help="Check dependency constraints between modules. When present, all checks must be explicitly enabled.",
    )
    check_parser.add_argument(
        "--interfaces",
        action="store_true",
        help="Check interface implementations. When present, all checks must be explicitly enabled.",
    )
    check_parser.add_argument(
        "--output",
        choices=["text", "json"],
        default="text",
        help="Output format (default: text)",
    )
    add_base_arguments(check_parser)

    ## tach check-external
    check_parser_external = subparsers.add_parser(
        "check-external",
        prog=f"{TOOL_NAME} check-external",
        help="Perform che
```

### Core Architecture Module: `python/tach/console.py`
```
from __future__ import annotations

from rich.console import Console

console = Console(highlight=False)
console_err = Console(highlight=False, stderr=True)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #739** (2025-06-04): **Tach crash with layer config**
  *Symptoms*: Using the layers feature in my `tach.toml` I'm running into a crash. The returned version also seems to be reporting incorrectly.  Config: ``` layers = [     "views",     { name = "services", closed = true },     "models" ]  [[modules]] path = "views" layer = "views"  [[modules]] path= "services" layer = "services"  [[modules]] path = "models" layer = "models" ```  CLI: ``` > pip install --no-cache tach==0.28.5 ...snip... Successfully installed tach-0.28.5 > tach --version tach 0.28.4 > tach check thread '<unnamed>' panicked at src/processors/import.rs:98:28: range end index 18446744073709551615 out of range for slice of length 2 note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace Traceback (most recent call last):   File ".virtualenv/bin/tach", line 8, in <module>     sys.exit(start())   File ".virtualenv/lib/python3.9/site-packages/tach/start.py", line 10, in start     main()   File ".virtualenv/lib/python3.9/site-packages/tach/cli.py", line 1263, in main     tach_check(   File ".virtualenv/lib/python3.9/site-packages/tach/cli.py", line 550, in tach_check     diagnostics = extension.check( pyo3_runtime.PanicException: range end index 18446744073709551615 out of range for slice of length 2 ```
  **Post-Mortem & Fix Analysis**:
  > In `0.29.0` there is a [fix](https://github.com/gauge-sh/tach/pull/741) for the specific panic you're seeing, but the connection to closed layers isn't so clear to me yet. Could you let me know if upgrading fixes this issue or causes any other strange behavior?

- **Issue #738** (2025-04-18): **local imports behavior introduced in 0.28.2 introduces regression**
  *Symptoms*: With the new local imports config, the old default behavior of deprecated dependencies isn't possible anymore:  We can force all locally imported deps (violations or deprecated) to be warnings, errors, or ignored, but we can't let them follow the default rules for the dependency (warn for deprecated, error for a violation)  e.g. when not explicitly configured or set to "error", a locally imported deprecated dependency still has the deprecated message in tach check output, but it has a red X and tach check returns "not valid". 

- **Issue #696** (2026-09-01): **tach falsely identifies external dependencies as undeclared when compiling dependencies from `pyproject.toml` -> `requirements.txt`**
  *Symptoms*: In this case, `requirements.txt` contains dependencies of the dependencies in `pyproject.toml`. It's the dependency diff (i.e. those that are in `requirements.txt` but not in `pyproject.toml`) that is being flagged by `tach check-external`. I imagine this would likely be an issue for projects that use [uv](https://docs.astral.sh/uv/)'s `uv.lock` file or [poetry's](https://python-poetry.org/) `poetry.lock` as well (but that's not what my team is blocked by).
  **Post-Mortem & Fix Analysis**:
  > Appreciate the patience on this issue! If I understand correctly, you are saying that `tach check-external` emits errors when you use packages which are only declared in your compiled `requirements.txt`, but not in your `pyproject.toml`.  If you are distributing this package to other users or orgs with the `pyproject.toml` file, then I would actually recommend declaring all dependencies in `pyproject.toml` if they are ever imported in your code, rather than relying on the transitive dependencies to be stable. This is the use case that Tach assumes.  But if you are just building/deploying this package internally and are using `requirements.txt` as the source of truth for that purpose, I can see why this should take precedence over `pyproject.toml`. This might generally the case when both are present, so I'm okay with making `requirements.txt` always take precedence over `pyproject.toml` for dependency declarations. Will put this into the next release.
  > Actually just realized this won't quite work - the compiled `requirements.txt` will definitely contain a ton of 'unused' dependencies which would pollute your diagnostics unless you disable that check. I tend to think that the dependencies should actually be declared in `pyproject.toml`, is there a reason not to do so @cameronbrill ?
  > closing this as per the comments above

- **Issue #679** (2025-03-11): **Don't style text when output terminal is not interactive**
  *Symptoms*: When writing the report to a file, the styling doesn't get removed and results in ascii escape sequences in the file:  ``` tach report my_module > report.txt ```  opening this in my IDE:  ![Image](https://github.com/user-attachments/assets/18251b0f-bd3f-414d-823c-71bb8147a30d)  I would expect something like this instead (also without the warning, xref #676):  ![Image](https://github.com/user-attachments/assets/b7da1272-328b-4b6a-a486-90bdc590ab62)
  **Post-Mortem & Fix Analysis**:
  > @pavelzw I'll fix this! We have functions to detect this but they are scattered across the Python/Rust boundary. This output is entirely rendered in Rust I believe, so should be a straightforward fix.  It'll take some time to work through the rest of the formatting/stdout issues you've raised but they seem reasonable. Could I ask about your use case? I'd love to learn more about how you're using Tach's output so that we can build in that direction :)
  > Basically i'm trying to build a tool that checks within my project that i only use certain external dependencies in certain submodules  ```yml allow:   # only allow importing the `logging` module in the following submodules   logging:     - my_project.log     # The below directories should be migrated in the near future.     # We should remove each directory as they are migrated.     - my_project.legacy    # ...  deny:   # Packages that exist under this tag will be denied usage   # in precisely these modules.   pandas:     - my_project.new ```  The idea was to leverage `tach report --output json` (#678) and then just ensure all of these requirements are met. But since #678 is not yet done, I planned to parse the output of `tach report` myself for now.
  > Ok I see! I just made the changes to fix styling in the report, this will merge and release later today. Note that the paths in the non-interactive report will be absolute.  Your actual use-case is something that Tach will support first-class very soon. Do you have a strong preference to define these rules on the external dependencies vs. opt-in on each module? The most natural extensions for Tach config would be `external_depends_on`/`external_cannot_depend_on`.

- **Issue #650** (2025-02-28): **Visibility does not work in submodules**
  *Symptoms*: Visibility should work as depends_on by specifiying relate or absolute/global patch.  Instead of "submodule.country.api" We should be able to write:     - country.api or      - //submodule.country.api  Example: ``` [[modules]] paths = ["country.api"] depends_on = [     "country" ]  [[modules]] path = "country" depends_on = [     "country.api",     "onboarding.api",     "onboarding", ] visibility = [     "submodule.country.api", ] ```  Based on the docs: ``` depends_on = [   "//tach.hooks",  # This refers to "tach.hooks" (outside of this domain)   "service",  # This refers to "tach.filesystem.service" ] ``` 
  **Post-Mortem & Fix Analysis**:
  > @matejsp thanks for raising this issue! Just to clarify, you are referring to `tach.domain.toml` here right?
  > Yes correct, I was referring to tach.domain.toml.
  > @matejsp This is fixed in `0.27.2`! Please let me know if it works for you.

- **Issue #580** (2025-01-29): **adding `_typeshed` to `external.excludes` no longer works**
  *Symptoms*: when the fake `_typeshed` module is added to `external.exclude`, `tach check-external` seems to still report usages of it: ```toml # tach.toml [external] exclude = [   "_typeshed", # fake TYPE_CHECKING only module that doesn't exist at runtime ] ``` ``` >tach check-external ❌: Undeclared dependencies in 'foo.py':         _typeshed ``` this seems to have been caused by a recent update, since this used to work on 0.20.0. interestingly this only seems to happen with the `_typeshed` module, but other modules in the `exclude` list are correctly ignored
  **Post-Mortem & Fix Analysis**:
  > Sounds like this is a regression due to changes in #563 -- will investigate.

- **Issue #564** (2025-02-25): **Dependencies do not get parsed correctly in monorepo with multiple packages**
  *Symptoms*: Heyo!  Thanks for the really cool project first of all :)  I have a big monorepo with a ton of packages that depend on each other, but also other dependencies. I am using uv and workspaces for that. No namespace packages!  ``` my_repo/   tach.toml   package1/     pyproject.toml     src/       package1/         __init__.py         module1.py         module2/           __init__.py           service.py         module3.py   package2/     pyproject.toml     src/       package2/         __init__.py         module1.py         module2/           __init__.py           service.py         module3.py   docs/   tests/ ``` In this example, `package2` depends on `package1` - which is installed using uv workspaces.   ---  I am struggeling a bit to set up tach to detect the dependencies correctly.   I have managed to have tach detect the dirs by using this (full) config. I have no marked anything as modules yet: ``` source_roots = [     "package2/src",     "package1/src", ] ```  Using the `uv run tach check-external` command, I would have expected it to see what depencies are used in `package2` and to double check these via their repective `package2.pyproject.toml` file. However I get errors that packages are not installed that are in defined in the corresponding `pyproject.toml`. And the depency to `package1` is not shown as missing when that is removed from the `pyproject.toml`.  ---   I am a bit unsure what I am supposed to do / if this layout is even supported. I have tried most combinati
  **Post-Mortem & Fix Analysis**:
  > Heyo, anyone had any chance to take a peek at this yet? Cheers! :) 
  > @Kigstn I apologize for letting this sit for so long, we've made some very significant changes to Tach internals since you raised this, and had some direct customer requests that we prioritized.  Unfortunately, the current `check-external` can't handle cases like yours due to bad assumptions about how these projects would be structured. A workaround for now could be to use a separate `tach.toml` in each package, with `source_roots = ["src"]` in each, and running `tach check-external` from within each. Alternatively, it may even work to change `source_roots` to `["src"]` in the root config, although this would only work if the source roots in all checked packages are identical.  I'm now working on true support for monorepos as well as specific support for `uv` workspaces, so that this can be configured in a single root config file.  Really appreciate the patience, I will tag this issue in relevant PRs as I create them.
  > @Kigstn Just merged in changes specifically to address this issue -- they aren't released yet but I will post back here with a version number when they are available.  I'll also be writing documentation shortly, but given the config you showed in your initial example, the behavior you want should happen immediately without any changes on your end!

- **Issue #277** (2024-08-28): **tach vscode extension not working with `.toml`**
  *Symptoms*: it appears the vscode extension is still looking for a `.yml` file after setting a root with a  `tach.toml` in the vscode extension settings.   ```   File "/Users/wjmeijer/.vscode/extensions/gauge.tach-0.5.2-darwin-arm64/bundled/tool/lsp_server.py", line 273, in _run_tool_on_document     boundary_errors = run_tach_check(argv=argv, path=document.path)                       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   File "/Users/wjmeijer/.vscode/extensions/gauge.tach-0.5.2-darwin-arm64/bundled/tool/tach_util.py", line 22, in run_tach_check     raise TachSetupError( tach.errors.TachSetupError: [91m tach.(yml|yaml) not found in ~/Repositories/<REDACTED>[0m  2024-08-28 12:00:06.815 [info] Failed to handle notification "textDocument/didSave": DidSaveTextDocumentParams(text_document=TextDocumentIdentifier(uri='file:///Users/wjmeijer/Repositories/<REDACTED>'), text=None) Traceback (most recent call last):   File "/Users/wjmeijer/.vscode/extensions/gauge.tach-0.5.2-darwin-arm64/bundled/libs/pygls/protocol/json_rpc.py", line 245, in _handle_notification     self._execute_notification(handler, params)   File "/Users/wjmeijer/.vscode/extensions/gauge.tach-0.5.2-darwin-arm64/bundled/libs/pygls/protocol/json_rpc.py", line 153, in _execute_notification     handler(*params)   File "/Users/wjmeijer/.vscode/extensions/gauge.tach-0.5.2-darwin-arm64/bundled/tool/lsp_server.py", line 86, in did_save     diagnostics: list[lsp.Diagnostic] = _linting_helper(document)       
  **Post-Mortem & Fix Analysis**:
  > It looks like the extension is still shipping with tach 0.5.2! I'll make sure an up-to-date version is shipped today.
  > @emdoyle tach-vscode was updated to 0.10.0 in a recent PR. There are some other fixes I had opened, https://github.com/gauge-sh/tach-vscode/pulls if someone you can review there.
  > @sparshg @h0uter the extension should be updated and published. I'm still seeing some finicky behavior in some cases so lmk if it's working on your end!

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

### Incident Patch 1: `950cc83f` (2026-09-01)
**Commit Message**: fixes for new ruff version

**File**: `.basedpyright/baseline.json` (modified, +24/-56)
```diff
@@ -4683,24 +4683,24 @@
             {
                 "code": "reportUnknownArgumentType",
                 "range": {
-                    "startColumn": 33,
-                    "endColumn": 41,
+                    "startColumn": 37,
+                    "endColumn": 45,
                     "lineCount": 1
                 }
             },
             {
                 "code": "reportUnknownArgumentType",
                 "range": {
-                    "startColumn": 18,
-                    "endColumn": 26,
+                    "startColumn": 13,
+                    "endColumn": 21,
                     "lineCount": 1
                 }
             },
             {
                 "code": "reportUnknownVariableType",
                 "range": {
-                    "startColumn": 32,
-                    "endColumn": 40,
+                    "startColumn": 27,
+                    "endColumn": 35,
                     "lineCount": 1
                 }
             },
@@ -4875,24 +4875,24 @@
             {
                 "code": "reportUnknownArgumentType",
                 "range": {
-                    "startColumn": 33,
-                    "endColumn": 41,
+                    "startColumn": 37,
+                    "endColumn": 45,
                     "lineCount": 1
                 }
             },
             {
                 "code": "reportUnknownArgumentType",
                 "range": {
-                    "startColumn": 18,
-                    "endColumn": 26,
+                    "startColumn": 13,
+                    "endColumn": 21,
                     "lineCount": 1
                 }
             },
             {
                 "code": "reportUnknownVariableType",
                 "range": {
-                    "startColumn": 32,
-                    "endColumn": 40,
+                    "startColumn": 27,
+                    "endColumn": 35,
                     "lineCount": 1
                 }
             }
@@ -10895,18 +10895,10 @@
                 }
             },
             {
-                "code": "reportArgumentType",
+                "code": "reportOptionalIterable",
                 "range": {
-                    "startColumn": 45,
-                    "endColumn": 72,
-                    "lineCount": 1
-                }
-            },
-            {
-                "code": "reportArgumentType",
-                "range": {
-                    "startColumn": 45,
-                    "endColumn": 72,
+                    "startColumn": 36,
+                    "endColumn": 63,
                     "lineCount": 1
                 }
             },
@@ -10935,18 +10927,10 @@
                 }
             },
             {
-                "code": "reportArgumentType",
-                "range": {
-                    "startColumn": 45,
-                    "endColumn": 72,
-                    "lineCount": 1
-                }
-            },
-            {
-                "code": "reportArgumentType",
+                "code": "reportOptionalIterable",
                 "range": {
-                    "startColumn": 45,
-                    "endColumn": 72,
+                    "startColumn": 36,
+                    "endColumn": 63,
                     "lineCount": 1
                 }
             },
@@ -11031,34 +11015,18 @@
                 }
             },
             {
-                "code": "reportArgumentType",
-                "range": {
-                    "startColumn": 45,
-                    "endColumn": 63,
-                    "lineCount": 1
-                }
-            },
-            {
-                "code": "reportArgumentType",
-                "range": {
-                    "startColumn": 45,
-                    "endColumn": 63,
-                    "lineCount": 1
-                }
-            },
-            {
-                "code": "reportArgumentType",
+                "code": "reportOptionalIterable",
                 "ran
```

**File**: `.vscode/settings.json` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@
   "python.testing.unittestEnabled": false,
   "python.testing.pytestEnabled": true,
   "testing.automaticallyOpenPeekView": "never",
-  "[python]": {
+  "[python][markdown]": {
     "editor.defaultFormatter": "charliermarsh.ruff"
   },
   "explorer.compactFolders": false,
```

**File**: `docs/usage/deprecate.md` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ depends_on = []
 Then, in `parsing.py`:
 
 ```python
-from core.main import get_data # we want to remove this!
+from core.main import get_data  # we want to remove this!
 
 get_data()
 ```
```

**File**: `docs/usage/tach-ignore.md` (modified, +6/-3)
```diff
@@ -10,7 +10,7 @@ from core.api import private_calculation  # tach-ignore
 
 from core.package import (  # tach-ignore
     service_one,
-    service_two
+    service_two,
 )
 ```
 
@@ -20,11 +20,14 @@ The directive can also be specific about the import to ignore, which is particul
 # tach-ignore private_function
 from core.main import private_function, public_function
 
-from core.api import private_calculation, public_service  # tach-ignore private_calculation
+from core.api import (  # tach-ignore private_calculation
+    private_calculation,
+    public_service,
+)
 
 from core.package import (  # tach-ignore service_two
     service_one,
-    service_two
+    service_two,
 )
 ```
 
```

**File**: `pyproject.toml` (modified, +9/-1)
```diff
@@ -100,7 +100,15 @@ extend-exclude = [
     "pw",
 ]
 lint.extend-select = ["I", "TC", "UP"]
-lint.ignore = ["UP006", "UP007"]
+lint.ignore = [
+    # TODO: why are these rules disabled?
+    "UP006",
+    "UP007",
+
+    # ideally these rulkes should be enabled, but there are too many existing instances in existing code.
+    # should enable them when ruff supports baseline: https://github.com/astral-sh/ruff/issues/1149
+    "BLE001" 
+]
 
 [tool.ruff.lint.isort]
 required-imports = ["from __future__ import annotations"]
```

---

### Incident Patch 2: `ce76b0ed` (2026-09-01)
**Commit Message**: remove workaround for badly typed `pytester.makepyfile` which has since been fixed

**File**: `python/tests/test_pytest_plugin.py` (modified, +5/-15)
```diff
@@ -5,17 +5,11 @@
 pytest_plugins = ["pytester"]
 
 
-def makepyfile(pytester: pytest.Pytester, *args: str | bytes, **kwargs: str | bytes):
-    """workaround for https://github.com/pytest-dev/pytest/pull/14080"""
-    _ = pytester.makepyfile(*args, **kwargs)  # pyright: ignore[reportUnknownMemberType]
-
-
 @pytest.fixture
 def tach_project(pytester: pytest.Pytester):
     """Create a basic tach project structure."""
     _ = pytester.makefile(".toml", tach='source_roots = ["."]')
-    makepyfile(
-        pytester,
+    _ = pytester.makepyfile(
         src_module="""
 def add(a, b):
     return a + b
@@ -71,8 +65,7 @@ def test_no_changes_skips_all_tests(self, tach_project: pytest.Pytester):
     def test_source_change_runs_dependent_tests(self, tach_project: pytest.Pytester):
         """When a source file changes, only tests that import it should run."""
         # Modify the source file
-        makepyfile(
-            tach_project,
+        _ = tach_project.makepyfile(
             src_module="""
 def add(a, b):
     return a + b
@@ -98,8 +91,7 @@ def subtract(a, b):
     def test_test_file_change_runs_that_file(self, tach_project: pytest.Pytester):
         """When a test file is directly modified, it should run."""
         # Modify a test file
-        makepyfile(
-            tach_project,
+        _ = tach_project.makepyfile(
             test_no_import="""
 def test_standalone_1():
     assert True
@@ -156,8 +148,7 @@ def test_verbose_mode_shows_details(self, tach_project: pytest.Pytester):
 class TestPytestPluginCounting:
     def test_counts_all_tests_in_file(self, tach_project: pytest.Pytester):
         """Should correctly count all tests including parametrized ones."""
-        makepyfile(
-            tach_project,
+        _ = tach_project.makepyfile(
             test_parametrized="""
 import pytest
 
@@ -183,8 +174,7 @@ def test_regular():
 
     def test_counts_tests_in_classes(self, tach_project: pytest.Pytester):
         """Should correctly count tests inside test classes."""
-        makepyfile(
-            tach_project,
+        _ = tach_project.makepyfile(
             test_class="""
 class TestGroup:
     def test_one(self):
```

---

### Incident Patch 3: `79459711` (2026-09-01)
**Commit Message**: fix linux s390x build in ci

**File**: `.github/workflows/publish.yml` (modified, +3/-0)
```diff
@@ -27,6 +27,9 @@ jobs:
   linux:
     needs: test
     runs-on: ubuntu-22.04
+    env:
+      # https://github.com/rust-lang/stacker/issues/79#issuecomment-1497479267
+      CFLAGS_s390x_unknown_linux_gnu: -march=z10
     strategy:
       fail-fast: false
       matrix:
```

---

### Incident Patch 4: `9ef5368e` (2026-09-01)
**Commit Message**: fix windows build in ci

**File**: `.github/workflows/publish.yml` (modified, +2/-0)
```diff
@@ -82,6 +82,8 @@ jobs:
             target: x86
     steps:
       - uses: actions/checkout@v4
+      - name: Enable long paths
+        run: git config --system core.longpaths true
       - uses: actions/setup-python@v5
         with:
           architecture: ${{ matrix.platform.target }}
```

**File**: `.github/workflows/publish_vscode.yml` (modified, +4/-0)
```diff
@@ -49,6 +49,10 @@ jobs:
     steps:
       - uses: actions/checkout@v4
 
+      - name: Enable long paths
+        if: ${{ matrix.os == 'windows-latest' }}
+        run: git config --system core.longpaths true
+
       - if: matrix.container
         uses: addnab/docker-run-action@v3
         with:
```

---

### Incident Patch 5: `718677b2` (2026-09-01)
**Commit Message**: fixes for new version of `cached`

**File**: `src/cache.rs` (modified, +2/-2)
```diff
@@ -1,5 +1,5 @@
 use cached::stores::DiskCacheBuildError;
-use cached::{DiskCache, DiskCacheError, IOCached};
+use cached::{ConcurrentCached, DiskCache, DiskCacheError};
 use std::collections::hash_map::DefaultHasher;
 use std::hash::{Hash, Hasher};
 use std::path::{Path, PathBuf};
@@ -45,7 +45,7 @@ fn build_computation_cache<P: AsRef<Path>>(
 ) -> Result<DiskCache<String, ComputationCacheValue>> {
     Ok(
         DiskCache::<String, ComputationCacheValue>::new("computation-cache")
-            .set_disk_directory(
+            .disk_directory(
                 project_root
                     .as_ref()
                     .join(CACHE_DIR)
```

**File**: `src/filesystem.rs` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ use std::io;
 use std::path::StripPrefixError;
 use std::path::{MAIN_SEPARATOR, MAIN_SEPARATOR_STR, Path, PathBuf};
 
-use cached::proc_macro::cached;
+use cached::macros::cached;
 use globset::Glob;
 use globset::GlobSetBuilder;
 use ignore;
```

---

### Incident Patch 6: `99f65beb` (2026-05-12)
**Commit Message**: fix: report syntax errors as errors, not warnings (#931)

* fix: report syntax errors as errors, not warnings

Fixes #845 and #846.

Changes:
- Syntax errors (ImportParse and PythonParse) now create ERROR diagnostics instead of WARNING
- This causes `tach check` to exit with non-zero code when syntax errors are present
- Python parse errors are now properly reported as "syntax error" instead of "unknown error"

Before: Syntax errors showed as warnings and didn't affect exit code
After: Syntax errors are reported as errors and cause non-zero exit

* Add unit test for syntax error reporting

Adds a test to verify that syntax errors are reported as errors (not
warnings) in check_internal. The PR changes DiagnosticError::ImportParse
and DiagnosticError::PythonParse handling to use new_global_error instead
of new_global_warning. This test confirms the new behavior by checking
that a Python file with a syntax error produces a Diagnostic with
Severity::Error.

* Move syntax error fixture to isolated test directory

Per DetachHead's feedback, the syntax_error.py file was placed in the
multi_package source root, causing other tests to fail when they picked
up the file with invalid syntax.



**File**: `pyproject.toml` (modified, +2/-2)
```diff
@@ -112,8 +112,8 @@ exempt-modules = ["typing", "typing_extensions"]
 [tool.pyright]
 include = ["python", "vscode"]
 # https://github.com/DetachHead/basedpyright/issues/31
-ignore = ["pw", "vscode/bundled", "vscode/.nox", "vscode/node_modules"]
-exclude = ["pw", "vscode/bundled", "vscode/.nox", "vscode/node_modules"]
+ignore = ["pw", "vscode/bundled", "vscode/.nox", "vscode/node_modules", "python/tests/example/syntax_error_fixture/**"]
+exclude = ["pw", "vscode/bundled", "vscode/.nox", "vscode/node_modules", "python/tests/example/syntax_error_fixture/**"]
 executionEnvironments = [{ root = "python" }, { root = "vscode" }]
 pythonVersion = "3.10"
 reportImplicitStringConcatenation = false # conflicts with ruff formatter
```

**File**: `python/tests/example/syntax_error_fixture/mymodule/__init__.py` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+# Module with syntax error for testing
+def broken(:
+    pass
```

**File**: `python/tests/example/syntax_error_fixture/tach.toml` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+[[modules]]
+path = "mymodule"
+depends_on = []
```

**File**: `src/commands/check/check_external.rs` (modified, +2/-2)
```diff
@@ -265,8 +265,8 @@ fn check_with_modules(
                             ),
                         )]
                     }
-                    Err(DiagnosticError::ImportParse(_)) => {
-                        vec![Diagnostic::new_global_warning(
+                    Err(DiagnosticError::ImportParse(_)) | Err(DiagnosticError::PythonParse(_)) => {
+                        vec![Diagnostic::new_global_error(
                             DiagnosticDetails::Configuration(
                                 ConfigurationDiagnostic::SkippedFileSyntaxError {
                                     file_path: file_path.display().to_string(),
```

**File**: `src/commands/check/check_internal.rs` (modified, +54/-2)
```diff
@@ -223,8 +223,8 @@ pub fn check(
                             ),
                         )]
                     }
-                    Err(DiagnosticError::ImportParse(_)) => {
-                        vec![Diagnostic::new_global_warning(
+                    Err(DiagnosticError::ImportParse(_)) | Err(DiagnosticError::PythonParse(_)) => {
+                        vec![Diagnostic::new_global_error(
                             DiagnosticDetails::Configuration(
                                 ConfigurationDiagnostic::SkippedFileSyntaxError {
                                     file_path: file_path.display().to_string(),
@@ -255,3 +255,55 @@ pub fn check(
 
     Ok(diagnostics)
 }
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+    use crate::config::ProjectConfig;
+    use crate::diagnostics::Severity;
+    use crate::tests::fixtures::example_dir;
+    use rstest::*;
+
+    #[fixture]
+    fn syntax_error_config() -> ProjectConfig {
+        use crate::config::ModuleConfig;
+
+        ProjectConfig {
+            modules: vec![ModuleConfig::from_path("mymodule")],
+            ..Default::default()
+        }
+    }
+
+    #[rstest]
+    fn check_internal_syntax_error_reports_as_error(
+        example_dir: PathBuf,
+        syntax_error_config: ProjectConfig,
+    ) {
+        let project_root = example_dir.join("syntax_error_fixture");
+        let result = check(&project_root, &syntax_error_config, true, false).unwrap();
+
+        // Find the syntax error diagnostic
+        let syntax_error = result
+            .iter()
+            .find(|d| {
+                matches!(
+                    d.details(),
+                    DiagnosticDetails::Configuration(
+                        ConfigurationDiagnostic::SkippedFileSyntaxError { .. }
+                    )
+                )
+            })
+            .expect("Expected a syntax error diagnostic");
+
+        // The diagnostic should be an error, not a warning
+        assert!(matches!(
+            syntax_error,
+            Diagnostic::Global {
+                severity: Severity::Error,
+                details: DiagnosticDetails::Configuration(
+                    ConfigurationDiagnostic::SkippedFileSyntaxError { .. }
+                )
+            }
+        ));
+    }
+}
```

---

### Incident Patch 7: `e4ff5488` (2026-04-03)
**Commit Message**: fix `tach test` crash caused by the pytest plugin being registered twice

**File**: `python/tach/test.py` (modified, +3/-1)
```diff
@@ -78,7 +78,9 @@ def run_affected_tests(
     except ImportError:
         raise TachSetupError("Cannot run tests, could not find 'pytest'.")
 
-    cmd = ["pytest", "-p", "tach.pytest_plugin"]
+    # the tach pytest plugin is enabled by default, but we don't know whether the user has disabled it in their pytest config
+    # so we disable the default registered version of the plugin and re-enable it explicitly here
+    cmd = ["pytest", "-p", "no:tach", "-p", "tach.pytest_plugin"]
     if pytest_args:
         cmd.extend(pytest_args)
     if base:
```

---

### Incident Patch 8: `118666ce` (2026-04-02)
**Commit Message**: fix exit code 5 false positive when no tests are collected because they were all skipped

**File**: `python/tach/pytest_plugin.py` (modified, +11/-1)
```diff
@@ -6,7 +6,7 @@
 from typing import TYPE_CHECKING, cast
 
 import pytest
-from pytest import Cache, Collector, Config, Item, StashKey
+from pytest import Cache, Collector, Config, ExitCode, Item, Session, StashKey
 from rich.console import Console
 
 if TYPE_CHECKING:
@@ -511,3 +511,13 @@ def _record_test_durations(terminalreporter: TerminalReporter, config: Config) -
 
     # Save updated durations
     _save_durations(config, durations)
+
+
+def pytest_sessionfinish(session: Session, exitstatus: int | ExitCode):
+    tach_state = session.config.stash.get(tach_state_key, None)
+    if (
+        tach_state
+        and tach_state.handler.num_removed_items
+        and exitstatus == ExitCode.NO_TESTS_COLLECTED
+    ):
+        session.exitstatus = ExitCode.OK
```

**File**: `python/tach/test.py` (modified, +1/-6)
```diff
@@ -88,14 +88,9 @@ def run_affected_tests(
 
     returncode, stdout, stderr = run_and_capture(cmd, cwd=project_root)
     tests_ran = returncode != pytest.ExitCode.NO_TESTS_COLLECTED
-    exit_code = (
-        pytest.ExitCode.OK
-        if returncode == pytest.ExitCode.NO_TESTS_COLLECTED
-        else returncode
-    )
 
     return AffectedTestsResult(
-        exit_code=exit_code,
+        exit_code=returncode,
         tests_ran_to_completion=tests_ran,
         stdout=stdout,
         stderr=stderr,
```

**File**: `python/tests/test_pytest_plugin.py` (modified, +1/-0)
```diff
@@ -66,6 +66,7 @@ def test_no_changes_skips_all_tests(self, tach_project: pytest.Pytester):
         result = run_pytest(tach_project, "--tach-base", "HEAD")
         result.assert_outcomes(passed=0)
         result.stdout.fnmatch_lines(["*Skipped 5 test* (2 file*"])
+        assert result.ret == pytest.ExitCode.OK
 
     def test_source_change_runs_dependent_tests(self, tach_project: pytest.Pytester):
         """When a source file changes, only tests that import it should run."""
```

---

### Incident Patch 9: `a393df24` (2026-03-23)
**Commit Message**: fix compile errors

**File**: `src/commands/check/check_external.rs` (modified, +1/-1)
```diff
@@ -132,7 +132,7 @@ struct CheckExternalMetadata {
 
 /// Get metadata for checking external dependencies.
 fn get_check_external_metadata(project_config: &ProjectConfig) -> Result<CheckExternalMetadata> {
-    Python::with_gil(|py| {
+    Python::attach(|py| {
         let external_utils = PyModule::import(py, "tach.utils.external")
             .expect("Failed to import tach.utils.external");
         let mut module_mappings: HashMap<String, Vec<String>> = external_utils
```

**File**: `src/modules/validation.rs` (modified, +2/-1)
```diff
@@ -1,4 +1,5 @@
 use std::collections::HashMap;
+use std::hash::RandomState;
 
 use crate::config::ModuleConfig;
 use crate::config::root_module::{ROOT_MODULE_SENTINEL_TAG, RootModuleTreatment};
@@ -85,7 +86,7 @@ pub fn find_visibility_violations(
 }
 
 pub fn find_modules_with_cycles(modules: &[ModuleConfig]) -> Vec<&String> {
-    let mut graph = DiGraphMap::new();
+    let mut graph: DiGraphMap<&String, Option<()>, RandomState> = DiGraphMap::new();
 
     // Add nodes
     for module in modules {
```

---

### Incident Patch 10: `d2757153` (2026-03-18)
**Commit Message**: fix build on python 3.9

**File**: `pyproject.toml` (modified, +2/-1)
```diff
@@ -68,7 +68,8 @@ dev = [
     "coverage==7.6.0",
     # Rust
     "maturin==1.10.2",
-    "rustup>=1.29.0.1 ; sys_platform != 'win32'", # https://github.com/konstin/rustup-pypi/issues/5
+    "rustup<1.29.0.1 ; sys_platform != 'win32' and python_version < '3.10'", # last version with 3.9 support
+    "rustup>=1.29.0.1 ; sys_platform != 'win32' and python_version >= '3.10'", # https://github.com/konstin/rustup-pypi/issues/5
 ]
 vscode = [
     "nodejs-wheel>=22.20.0",
```

**File**: `uv.lock` (modified, +35/-2)
```diff
@@ -1885,10 +1885,41 @@ wheels = [
     { url = "https://files.pythonhosted.org/packages/a5/1f/93f9b0fad9470e4c829a5bb678da4012f0c710d09331b860ee555216f4ea/ruff-0.14.6-py3-none-win_arm64.whl", hash = "sha256:d43c81fbeae52cfa8728d8766bbf46ee4298c888072105815b392da70ca836b2", size = 13520930, upload-time = "2025-11-21T14:26:13.951Z" },
 ]
 
+[[package]]
+name = "rustup"
+version = "1.28.2.1"
+source = { registry = "https://pypi.org/simple" }
+resolution-markers = [
+    "python_full_version < '3.10'",
+]
+sdist = { url = "https://files.pythonhosted.org/packages/23/f0/6d9a229698333819a0d5e04988591a6052f3c31da8995e77092f532dc66b/rustup-1.28.2.1.tar.gz", hash = "sha256:349474e6d5f8e3a971777dbe22e55be068c1d11a8e1bc395e945bfdbb407e2a7", size = 7156, upload-time = "2025-09-12T11:31:04.453Z" }
+wheels = [
+    { url = "https://files.pythonhosted.org/packages/a3/33/7f2156d76e89fc4329c30e031d6bb673fbcb16c2a10a442e9de93e975b8a/rustup-1.28.2.1-py3-none-linux_armv6l.whl", hash = "sha256:728fb6ce6fbfef543193e0e05bf8b5515715e278bf21e0b4c226db0389cb396d", size = 6888324, upload-time = "2025-09-12T11:30:27.935Z" },
+    { url = "https://files.pythonhosted.org/packages/7c/e5/720063515dd98e0958ddfc6beec834ea550c22ba388a1ca909e4b5793f88/rustup-1.28.2.1-py3-none-macosx_10_12_x86_64.whl", hash = "sha256:a344c4333624038cdf1678b3718b12514e91b4f0eab5f32aeea0c3184a227f24", size = 5260064, upload-time = "2025-09-12T11:30:30.027Z" },
+    { url = "https://files.pythonhosted.org/packages/f8/d7/2ed1cd1db5e98c090714ab0776ec85d11a99549aab9b25f69c113c4a8cc8/rustup-1.28.2.1-py3-none-macosx_11_0_arm64.whl", hash = "sha256:64b6f663ac39ddbe26f99892f4e6749f85ecfb1bba2edf66f1aa32a424f5be98", size = 4869897, upload-time = "2025-09-12T11:30:31.937Z" },
+    { url = "https://files.pythonhosted.org/packages/84/f3/66c6b5c60801ee269aa2ed9034b2bbcccb4145319414f7c69ce81121539b/rustup-1.28.2.1-py3-none-manylinux_2_17_aarch64.whl", hash = "sha256:76493b46a5e9c86e1b472518b63e96e566282ecc2df989ef7cedc8fcf7c6ff14", size = 7964165, upload-time = "2025-09-12T11:30:34.034Z" },
+    { url = "https://files.pythonhosted.org/packages/43/da/2538c814c42f57cdd2e7f58564ecdba33075bbdae98714181204d76d6ef2/rustup-1.28.2.1-py3-none-manylinux_2_17_armv7l.whl", hash = "sha256:b546bd02729e9cad94cd28cc478dab71c4fb576916bd11786e1df2fd84e7890d", size = 6727588, upload-time = "2025-09-12T11:30:36.261Z" },
+    { url = "https://files.pythonhosted.org/packages/e4/c7/242c388c83ea0f40ee7f3fe70b0f46f0024057b84cbf4f376e8dc81013a9/rustup-1.28.2.1-py3-none-manylinux_2_17_i686.whl", hash = "sha256:398b58547628ab5ea87003a0d403bfe2cb158ec3aebcf630add80ff9da9532c5", size = 7188749, upload-time = "2025-09-12T11:30:38.496Z" },
+    { url = "https://files.pythonhosted.org/packages/a1/01/3d6442d3e15c4b7bf2909528dc516ab1e34345f4da553a76e64dfc2a6e49/rustup-1.28.2.1-py3-none-manylinux_2_17_ppc64.whl", hash = "sha256:ae8db47a8e65f71345753bcdea98d211160d72d65013468035bd1e3c9ed85a38", size = 7105152, upload-time = "2025-09-12T11:30:40.859Z" },
+    { url = "https://files.pythonhosted.org/packages/e5/db/ddf8e683d31e8bf416307ef265a20e8a9a5b31ad144dfe05a38c27d03855/rustup-1.28.2.1-py3-none-manylinux_2_17_ppc64le.whl", hash = "sha256:d859c66b40a90a91d53b4179a457effba6915828bdb006fb7dfee9aba1d1b384", size = 6877243, upload-time = "2025-09-12T11:30:43.088Z" },
+    { url = "https://files.pythonhosted.org/packages/3b/9c/c24a77c58e434a11d6b1ccdd3b14a82bb8ff537b9e590152f13f343e3744/rustup-1.28.2.1-py3-none-manylinux_2_17_s390x.whl", hash = "sha256:d17b0ceb8d3c7116fa537120cd6005234af75f2c8877104f6836d89e5f66b75e", size = 8696015, upload-time = "2025-09-12T11:30:45.467Z" },
+    { url = "https://files.pythonhosted.org/packages/67/b2/02246405fc4ec8b9ff2b00cd5b61a12496a28c798d354e0a4ce182a2736f/rustup-1.28.2.1-py3-none-manylinux_2_17_x86_64.whl", hash = "sha256:9de2d71b5e4c8059e61113675be2a6c5b963432d7b2508ee5b08e39adae92f6d", size = 7890937, upload-time = "2025-09-12T11:30:48.708Z" },
+    { url = "https://files.pythonhosted.org/pack
```

#### Recent Merged Pull Requests:
- **PR #949** (2026-09-14): Bump the "all" group with 2 updates across multiple ecosystems (@dependabot[bot])
- **PR #948** (2026-09-01): Bump the "all" group with 2 updates across multiple ecosystems (@dependabot[bot])
- **PR #945** (closed): bump gitpython to 3.1.60 to fix CVE-2026-78676 (@felipe-marques-prolific)
- **PR #944** (closed): Add `tach deadcode` command (@slayton)
- **PR #941** (2026-06-11): fix ai policy (@DetachHead)
- **PR #940** (2026-06-11): ai code policy (@DetachHead)
- **PR #939** (closed): feat: add `tach mcp` — a Model Context Protocol server for AI agents (@YamonBot)
- **PR #934** (2026-08-27): Bump the "all" group with 2 updates across multiple ecosystems (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
