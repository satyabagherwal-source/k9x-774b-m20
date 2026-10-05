# Forensic Learning Record (Deep Inspection): tach-org/tach

> **Canonical Artifact**: `07_PROJECT_LEARNING/tach-org-tach-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tach-org/tach](https://github.com/tach-org/tach))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:58:47.846Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tach-org/tach`
- **Description**: A Python tool to visualize + enforce dependencies, using modular architecture 🌎 Open source 🐍 Installable via pip 🔧 Able to be adopted incrementally - ⚡ Implemented with no runtime impact ♾️ Interoperable with your existing systems 🦀 Written in rust
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md
- **Stars / Engagement**: 2832 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `python/tach/hooks/__init__.py`
```
from __future__ import annotations

from tach.hooks.pre_commit import build_pre_commit_hook_content

__all__ = ["build_pre_commit_hook_content"]

```

### Core Architecture Module: `python/tach/hooks/pre_commit.py`
```
from __future__ import (  # noqa: EXE002 TODO: i dont think this file needs to be executable
    annotations,
)

from tach.constants import TOOL_NAME

template = """#!/bin/sh
# Pre-commit script that validates dependencies locally
set -e

{command}"""


def build_pre_commit_hook_content() -> str:
    return template.format(command=f"{TOOL_NAME} check")

```

### Core Architecture Module: `python/tach/utils/display.py`
```
from __future__ import annotations

import sys
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from pathlib import Path


def is_interactive() -> bool:
    return sys.stdout.isatty() and sys.stderr.isatty()


class BCOLORS:
    HEADER = "\033[95m"
    OKBLUE = "\033[94m"
    OKCYAN = "\033[96m"
    OKGREEN = "\033[92m"
    WARNING = "\033[93m"
    FAIL = "\033[91m"
    ENDC = "\033[0m"
    BOLD = "\033[1m"
    UNDERLINE = "\033[4m"


def colorize(text: str, color_start: str, color_end: str = BCOLORS.ENDC) -> str:
    if is_interactive():
        return f"{color_start}{text}{color_end}"
    return text


def create_clickable_link(file_path: Path, line: int | None = None) -> str:
    if line is not None:
        return f"{file_path}:{line}"
    return str(file_path)

```

### Core Architecture Module: `python/tach/utils/exclude.py`
```
from __future__ import annotations

import fnmatch
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from collections.abc import Generator
    from pathlib import Path


def _with_optional_trailing_slashes(patterns: list[str]) -> Generator[str, None, None]:
    for pattern in patterns:
        yield pattern
        if pattern.endswith("/"):
            yield pattern[:-1]


# Assumes 'relative_path' is a path relative to the project root
def is_path_excluded(exclude_paths: list[str], relative_path: Path) -> bool:
    if not exclude_paths:
        return False

    return any(
        (fnmatch.fnmatch(str(relative_path), exclude_path))
        for exclude_path in _with_optional_trailing_slashes(exclude_paths)
    )

```

### Core Architecture Module: `python/tach/utils/external.py`
```
from __future__ import annotations

import re
import sys
from functools import cache

KNOWN_MODULE_SPECIAL_CASES = {
    "__future__",
    "typing_extensions",
}


def is_stdlib_module(module: str) -> bool:
    if module in KNOWN_MODULE_SPECIAL_CASES:
        return True

    if module in sys.builtin_module_names:
        return True
    return module in sys.stdlib_module_names


def get_stdlib_modules() -> list[str]:
    modules = set(sys.builtin_module_names)
    modules.update(sys.stdlib_module_names)
    modules.update(KNOWN_MODULE_SPECIAL_CASES)
    return sorted(modules)


@cache
def get_module_mappings():
    from importlib.metadata import packages_distributions

    return packages_distributions()


PYPI_PACKAGE_REGEX = re.compile(r"[-_.]+")


def get_package_name(import_module_path: str) -> str:
    top_level_name = import_module_path.split(".")[0]
    module_mappings = get_module_mappings()
    # Ignoring the case of multiple packages providing this module,
    # using the first one in the mapping
    return module_mappings.get(top_level_name, [top_level_name])[0]


def normalize_package_name(import_module_path: str) -> str:
    return PYPI_PACKAGE_REGEX.sub("-", get_package_name(import_module_path)).lower()


__all__ = [
    "get_module_mappings",
    "get_package_name",
    "is_stdlib_module",
    "normalize_package_name",
]

```

### Core Architecture Module: `src/config/utils.rs`
```
// for serde
pub fn default_true() -> bool {
    true
}

pub fn is_true(value: &bool) -> bool {
    *value
}

pub fn is_default<T: Default + PartialEq>(value: &T) -> bool {
    value == &T::default()
}

```

### Core Architecture Module: `vscode/src/common/utilities.ts`
```
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs-extra';
import * as path from 'path';
import { LogLevel, Uri, WorkspaceFolder } from 'vscode';
import { Trace } from 'vscode-jsonrpc/node';
import { getWorkspaceFolders } from './vscodeapi';

function logLevelToTrace(logLevel: LogLevel): Trace {
    switch (logLevel) {
        case LogLevel.Error:
        case LogLevel.Warning:
        case LogLevel.Info:
            return Trace.Messages;

        case LogLevel.Debug:
        case LogLevel.Trace:
            return Trace.Verbose;

        case LogLevel.Off:
        default:
            return Trace.Off;
    }
}

export function getLSClientTraceLevel(channelLogLevel: LogLevel, globalLogLevel: LogLevel): Trace {
    if (channelLogLevel === LogLevel.Off) {
        return logLevelToTrace(globalLogLevel);
    }
    if (globalLogLevel === LogLevel.Off) {
        return logLevelToTrace(channelLogLevel);
    }
    const level = logLevelToTrace(channelLogLevel <= globalLogLevel ? channelLogLevel : globalLogLevel);
    return level;
}

export async function getProjectRoot(): Promise<WorkspaceFolder> {
    const workspaces: readonly WorkspaceFolder[] = getWorkspaceFolders();
    if (workspaces.length === 0) {
        return {
            uri: Uri.file(process.cwd()),
            name: path.basename(process.cwd()),
            index: 0,
        };
    } else if (workspaces.length === 1) {
        return workspaces[0];
    } else {
        let rootWorkspace = workspaces[0];
        let root = undefined;
        for (const w of workspaces) {
            if (await fs.pathExists(w.uri.fsPath)) {
                root = w.uri.fsPath;
                rootWorkspace = w;
                break;
            }
        }

        for (const w of workspaces) {
            if (root && root.length > w.uri.fsPath.length && (await fs.pathExists(w.uri.fsPath))) {
                root = w.uri.fsPath;
                rootWorkspace = w;
            }
        }
        return rootWorkspace;
    }
}

```

### Core Architecture Module: `python/tach/__init__.py`
```
from __future__ import annotations

__version__: str = "0.35.2"

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

### Incident Patch 1: `5841076f` (2026-10-01)
**Commit Message**: Add Windows ARM64 builds (#951)

* Add Windows ARM64 build

* Skip gnumake on Windows ARM64

The runners already have make.

* Clarify architecture override for setup-python

**File**: `.github/workflows/publish.yml` (modified, +5/-1)
```diff
@@ -83,13 +83,17 @@ jobs:
             target: x64
           - runner: windows-latest
             target: x86
+            # only set for x86; other targets default to the host machine's architecture
+            setup_python_architecture: x86
+          - runner: windows-11-arm
+            target: aarch64
     steps:
       - uses: actions/checkout@v4
       - name: Enable long paths
         run: git config --system core.longpaths true
       - uses: actions/setup-python@v5
         with:
-          architecture: ${{ matrix.platform.target }}
+          architecture: ${{ matrix.platform.setup_python_architecture }}
       - name: Build wheels
         uses: PyO3/maturin-action@v1
         with:
```

**File**: `.github/workflows/publish_vscode.yml` (modified, +3/-1)
```diff
@@ -22,6 +22,8 @@ jobs:
           # windows (no windows 32 bit build because that doesn't seem to be supported by vsce)
           - os: windows-latest
             code-target: win32-x64
+          - os: windows-11-arm
+            code-target: win32-arm64
 
           # manylinux
           - os: ubuntu-latest
@@ -50,7 +52,7 @@ jobs:
       - uses: actions/checkout@v4
 
       - name: Enable long paths
-        if: ${{ matrix.os == 'windows-latest' }}
+        if: runner.os == 'Windows'
         run: git config --system core.longpaths true
 
       - if: matrix.container
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -59,7 +59,7 @@ dev = [
     "setuptools==84.0.0",
     "twine==7.0.0",
     "build==1.6.0",
-    "gnumake>=4.4.1",
+    "gnumake>=4.4.1 ; sys_platform != 'win32' or platform_machine != 'ARM64'", # no win_arm64 wheel, and the sdist doesn't build there
     # Tests
     "pytest==9.1.1",
     "pytest-mock==3.15.1",
```

**File**: `uv.lock` (modified, +3/-3)
```diff
@@ -1483,7 +1483,7 @@ wheels = [
 
 [[package]]
 name = "tach"
-version = "0.35.0"
+version = "0.35.1"
 source = { editable = "." }
 dependencies = [
     { name = "gitpython" },
@@ -1502,7 +1502,7 @@ dev = [
     { name = "basedpyright" },
     { name = "build" },
     { name = "coverage" },
-    { name = "gnumake" },
+    { name = "gnumake", marker = "platform_machine != 'ARM64' or sys_platform != 'win32'" },
     { name = "maturin" },
     { name = "pip" },
     { name = "pytest" },
@@ -1542,7 +1542,7 @@ dev = [
     { name = "basedpyright", specifier = ">=1.31.7" },
     { name = "build", specifier = "==1.6.0" },
     { name = "coverage", specifier = "==7.16.0" },
-    { name = "gnumake", specifier = ">=4.4.1" },
+    { name = "gnumake", marker = "platform_machine != 'ARM64' or sys_platform != 'win32'", specifier = ">=4.4.1" },
     { name = "maturin", specifier = "==1.15.0" },
     { name = "pip", specifier = "==26.2.1" },
     { name = "pytest", specifier = "==9.1.1" },
```

---

### Incident Patch 2: `14749aff` (2026-09-14)
**Commit Message**: bump dependencies that require manual updates

**File**: `Cargo.lock` (modified, +25/-39)
```diff
@@ -1972,8 +1972,8 @@ dependencies = [
  "ruff_python_ast",
  "ruff_python_parser",
  "ruff_python_trivia",
- "ruff_source_file 0.0.12",
- "ruff_text_size 0.0.12",
+ "ruff_source_file",
+ "ruff_text_size",
  "rustc-hash",
  "salsa",
  "serde",
@@ -1994,7 +1994,7 @@ source = "git+https://github.com/astral-sh/ruff.git?tag=0.16.6#22f65a2ab50529905
 dependencies = [
  "get-size2",
  "is-macro",
- "ruff_text_size 0.0.12",
+ "ruff_text_size",
  "serde",
 ]
 
@@ -2048,8 +2048,8 @@ dependencies = [
  "ruff_python_stdlib",
  "ruff_python_trivia",
  "ruff_ranged_value",
- "ruff_source_file 0.0.12",
- "ruff_text_size 0.0.12",
+ "ruff_source_file",
+ "ruff_text_size",
  "rustc-hash",
  "serde",
  "serde_json",
@@ -2096,8 +2096,8 @@ dependencies = [
  "anyhow",
  "rand 0.10.0",
  "ruff_diagnostics",
- "ruff_source_file 0.0.12",
- "ruff_text_size 0.0.12",
+ "ruff_source_file",
+ "ruff_text_size",
  "serde",
  "serde_json",
  "thiserror 2.0.20",
@@ -2120,8 +2120,8 @@ dependencies = [
  "ruff_cache",
  "ruff_macros",
  "ruff_python_trivia",
- "ruff_source_file 0.0.12",
- "ruff_text_size 0.0.12",
+ "ruff_source_file",
+ "ruff_text_size",
  "rustc-hash",
  "serde",
  "thin-vec",
@@ -2136,8 +2136,8 @@ dependencies = [
  "ruff_python_ast",
  "ruff_python_literal",
  "ruff_python_parser",
- "ruff_source_file 0.0.12",
- "ruff_text_size 0.0.12",
+ "ruff_source_file",
+ "ruff_text_size",
 ]
 
 [[package]]
@@ -2146,8 +2146,8 @@ version = "0.0.12"
 source = "git+https://github.com/astral-sh/ruff.git?tag=0.16.6#22f65a2ab5052990503985c7c794de37598d531e"
 dependencies = [
  "ruff_python_ast",
- "ruff_source_file 0.0.12",
- "ruff_text_size 0.0.12",
+ "ruff_source_file",
+ "ruff_text_size",
 ]
 
 [[package]]
@@ -2160,8 +2160,8 @@ dependencies = [
  "ruff_python_ast",
  "ruff_python_codegen",
  "ruff_python_trivia",
- "ruff_source_file 0.0.12",
- "ruff_text_size 0.0.12",
+ "ruff_source_file",
+ "ruff_text_size",
 ]
 
 [[package]]
@@ -2171,8 +2171,8 @@ source = "git+https://github.com/astral-sh/ruff.git?tag=0.16.6#22f65a2ab50529905
 dependencies = [
  "ruff_python_ast",
  "ruff_python_trivia",
- "ruff_source_file 0.0.12",
- "ruff_text_size 0.0.12",
+ "ruff_source_file",
+ "ruff_text_size",
 ]
 
 [[package]]
@@ -2198,7 +2198,7 @@ dependencies = [
  "memchr",
  "ruff_python_ast",
  "ruff_python_trivia",
- "ruff_text_size 0.0.12",
+ "ruff_text_size",
  "rustc-hash",
  "stacker",
  "static_assertions",
@@ -2221,7 +2221,7 @@ dependencies = [
  "ruff_python_ast",
  "ruff_python_parser",
  "ruff_python_stdlib",
- "ruff_text_size 0.0.12",
+ "ruff_text_size",
  "rustc-hash",
  "smallvec",
 ]
@@ -2241,8 +2241,8 @@ version = "0.0.12"
 source = "git+https://github.com/astral-sh/ruff.git?tag=0.16.6#22f65a2ab5052990503985c7c794de37598d531e"
 dependencies = [
  "itertools 0.15.0",
- "ruff_source_file 0.0.12",
- "ruff_text_size 0.0.12",
+ "ruff_source_file",
+ "ruff_text_size",
  "rustc-hash",
  "unicode-ident",
 ]
@@ -2254,36 +2254,22 @@ source = "git+https://github.com/astral-sh/ruff.git?tag=0.16.6#22f65a2ab50529905
 dependencies = [
  "ruff_db",
  "ruff_python_ast",
- "ruff_text_size 0.0.12",
+ "ruff_text_size",
  "serde",
  "toml 1.0.6+spec-1.1.0",
 ]
 
-[[package]]
-name = "ruff_source_file"
-version = "0.0.11"
-source = "git+https://github.com/astral-sh/ruff.git?tag=0.16.5#9e4938c4a60bed3e87a11ee1e1db1bd23f4d964a"
-dependencies = [
- "memchr",
- "ruff_text_size 0.0.11",
-]
-
 [[package]]
 name = "ruff_source_file"
 version = "0.0.12"
 source = "git+https://github.com/astral-sh/ruff.git?tag=0.16.6#22f65a2ab5052990503985c7c794de37598d531e"
 dependencies = [
  "get-size2",
  "memchr",
- "ruff_text_size 0.0.12",
+ "ruff_text_size",
  "serde",
 ]
 
-[[package]]
-name = "ruff_text_size"
-version = "0.0.11"
-source = "git+https://github.com/astral-sh/ruff.git?tag=0.16.5#9e4938c4a60bed3e87a11ee1e1db1bd23f4d964a"
-
 [[package]]
 name = "ruff_text_size"
 version = "0.0.12"
@@ -2675,8 +2661,8 @@ dependencies = [
  "ruff_linter",
  "ruff_python_ast",
  "ruff_python_parser",
- "ruff_source_file 0.0.11",
- "ruff_text_size 0.0.11",
+ "ruff_source_file",
+ "ruff_text_size",
  "serde",
  "serde_json",
  "serial_test",
```

**File**: `Cargo.toml` (modified, +5/-5)
```diff
@@ -12,11 +12,11 @@ bench = false
 pyo3 = { version = "0.28.3", features = ["abi3-py37"] }
 regex = "1.12.3"
 once_cell = "1.21.4"
-ruff_python_ast = { git = "https://github.com/astral-sh/ruff.git", package="ruff_python_ast", tag = "0.16.6" }
-ruff_python_parser = { git = "https://github.com/astral-sh/ruff.git", package="ruff_python_parser", tag = "0.16.6" }
-ruff_linter = { git = "https://github.com/astral-sh/ruff.git", package="ruff_linter", tag = "0.16.6" }
-ruff_source_file = { git = "https://github.com/astral-sh/ruff.git", package="ruff_source_file", tag = "0.16.5" }
-ruff_text_size = { git = "https://github.com/astral-sh/ruff.git", package="ruff_text_size", tag = "0.16.5" }
+ruff_python_ast = { git = "https://github.com/astral-sh/ruff.git", package = "ruff_python_ast", tag = "0.16.6" }
+ruff_python_parser = { git = "https://github.com/astral-sh/ruff.git", package = "ruff_python_parser", tag = "0.16.6" }
+ruff_linter = { git = "https://github.com/astral-sh/ruff.git", package = "ruff_linter", tag = "0.16.6" }
+ruff_source_file = { git = "https://github.com/astral-sh/ruff.git", package = "ruff_source_file", tag = "0.16.6" }
+ruff_text_size = { git = "https://github.com/astral-sh/ruff.git", package = "ruff_text_size", tag = "0.16.6" }
 cached = { version = "2.0.2", features = ["disk_store"] }
 globset = "0.4.18"
 toml = "1.0.6"
```

**File**: `pw.lock` (modified, +1/-1)
```diff
@@ -1,3 +1,3 @@
 [main]
-requirements = ["uv==0.12.8"]
+requirements = ["uv==0.12.13"]
 hash = "976b6b031038890783158e4585a6297b"
```

---

### Incident Patch 3: `950cc83f` (2026-09-01)
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
                 "range": {
-                    "startColumn": 45,
-                    "endColumn": 63,
+                    "startColumn": 36,
+                    "endColumn": 54,
                     "lineCount": 1
                 }
             },
             {
-                "code": "reportArgumentType",
+                "code": "reportOptionalIterable",
                 "range": {
-                    "startColumn": 45,
-                    "endColumn": 63,
+                    "startColumn": 36,
+                    "endColumn": 54,
                     "lineCount": 1
                 }
             }
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

**File**: `python/tach/cache/__init__.py` (modified, +1/-1)
```diff
@@ -2,4 +2,4 @@
 
 from tach.cache.access import get_latest_version, get_uid
 
-__all__ = ["get_uid", "get_latest_version"]
+__all__ = ["get_latest_version", "get_uid"]
```

**File**: `python/tach/cli.py` (modified, +2/-4)
```diff
@@ -840,9 +840,7 @@ def tach_show(
         print_no_dependencies_found()
         sys.exit(1)
     try:
-        included_paths = list(
-            map(lambda path: project_root / path, included_paths or [])
-        )
+        included_paths = [project_root / path for path in included_paths or []]
         if is_web:
             result = upload_show_report(
                 project_root=project_root,
@@ -1096,7 +1094,7 @@ def tach_map(
             closure_file_path = Path(closure_path).resolve().relative_to(project_root)
             closure = dependent_map.get_closure([closure_file_path])
             output_json = json.dumps(
-                {str(closure_file_path): sorted(list(closure))}, indent=2
+                {str(closure_file_path): sorted(closure)}, indent=2
             )
             if output_path == "-":
                 print(output_json)
```

**File**: `python/tach/constants/__init__.py` (modified, +4/-4)
```diff
@@ -18,11 +18,11 @@
 GAUGE_API_BASE_URL: str = os.getenv("GAUGE_API_BASE_URL", "https://app.gauge.sh")
 
 __all__ = [
-    "PACKAGE_NAME",
-    "TOOL_NAME",
     "CONFIG_FILE_NAME",
-    "PACKAGE_FILE_NAME",
-    "ROOT_MODULE_SENTINEL_TAG",
     "DEFAULT_EXCLUDE_PATHS",
     "GAUGE_API_BASE_URL",
+    "PACKAGE_FILE_NAME",
+    "PACKAGE_NAME",
+    "ROOT_MODULE_SENTINEL_TAG",
+    "TOOL_NAME",
 ]
```

---

### Incident Patch 4: `ce76b0ed` (2026-09-01)
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

### Incident Patch 5: `79459711` (2026-09-01)
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

### Incident Patch 6: `9ef5368e` (2026-09-01)
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

### Incident Patch 7: `718677b2` (2026-09-01)
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

### Incident Patch 8: `03c1042a` (2026-05-22)
**Commit Message**: bump dependencies that require manual bumping

**File**: `Cargo.lock` (modified, +22/-36)
```diff
@@ -1953,8 +1953,8 @@ dependencies = [
  "ruff_python_ast",
  "ruff_python_parser",
  "ruff_python_trivia",
- "ruff_source_file 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.15.13)",
- "ruff_text_size 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.15.13)",
+ "ruff_source_file",
+ "ruff_text_size",
  "rustc-hash",
  "salsa",
  "serde",
@@ -1975,7 +1975,7 @@ source = "git+https://github.com/astral-sh/ruff.git?tag=0.15.13#2afb467ce397e4a8
 dependencies = [
  "get-size2",
  "is-macro",
- "ruff_text_size 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.15.13)",
+ "ruff_text_size",
  "serde",
 ]
 
@@ -2028,8 +2028,8 @@ dependencies = [
  "ruff_python_semantic",
  "ruff_python_stdlib",
  "ruff_python_trivia",
- "ruff_source_file 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.15.13)",
- "ruff_text_size 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.15.13)",
+ "ruff_source_file",
+ "ruff_text_size",
  "rustc-hash",
  "serde",
  "serde_json",
@@ -2077,8 +2077,8 @@ dependencies = [
  "itertools 0.14.0",
  "rand 0.10.0",
  "ruff_diagnostics",
- "ruff_source_file 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.15.13)",
- "ruff_text_size 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.15.13)",
+ "ruff_source_file",
+ "ruff_text_size",
  "serde",
  "serde_json",
  "serde_with",
@@ -2100,8 +2100,8 @@ dependencies = [
  "ruff_cache",
  "ruff_macros",
  "ruff_python_trivia",
- "ruff_source_file 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.15.13)",
- "ruff_text_size 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.15.13)",
+ "ruff_source_file",
+ "ruff_text_size",
  "rustc-hash",
  "serde",
  "thiserror 2.0.18",
@@ -2115,8 +2115,8 @@ dependencies = [
  "ruff_python_ast",
  "ruff_python_literal",
  "ruff_python_parser",
- "ruff_source_file 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.15.13)",
- "ruff_text_size 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.15.13)",
+ "ruff_source_file",
+ "ruff_text_size",
 ]
 
 [[package]]
@@ -2129,8 +2129,8 @@ dependencies = [
  "ruff_python_ast",
  "ruff_python_codegen",
  "ruff_python_trivia",
- "ruff_source_file 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.15.13)",
- "ruff_text_size 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.15.13)",
+ "ruff_source_file",
+ "ruff_text_size",
 ]
 
 [[package]]
@@ -2140,8 +2140,8 @@ source = "git+https://github.com/astral-sh/ruff.git?tag=0.15.13#2afb467ce397e4a8
 dependencies = [
  "ruff_python_ast",
  "ruff_python_trivia",
- "ruff_source_file 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.15.13)",
- "ruff_text_size 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.15.13)",
+ "ruff_source_file",
+ "ruff_text_size",
 ]
 
 [[package]]
@@ -2167,7 +2167,7 @@ dependencies = [
  "memchr",
  "ruff_python_ast",
  "ruff_python_trivia",
- "ruff_text_size 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.15.13)",
+ "ruff_text_size",
  "rustc-hash",
  "static_assertions",
  "unicode-ident",
@@ -2188,7 +2188,7 @@ dependencies = [
  "ruff_python_ast",
  "ruff_python_parser",
  "ruff_python_stdlib",
- "ruff_text_size 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.15.13)",
+ "ruff_text_size",
  "rustc-hash",
  "smallvec",
 ]
@@ -2208,36 +2208,22 @@ version = "0.0.0"
 source = "git+https://github.com/astral-sh/ruff.git?tag=0.15.13#2afb467ce397e4a89c13a0a814c62cfecb0e9e49"
 dependencies = [
  "itertools 0.14.0",
- "ruff_source_file 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.15.13)",
- "ruff_text_size 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.15.13)",
+ "ruff_source_file",
+ "ruff_text_size",
  "unicode-ident",
 ]
 
-[[package]]
-name = "ruff_source_file"
-version = "0.0.0"
-source = "git+https://github.com/astral-sh/ruff.git?tag=0.15.12#66f93cf7ed4d36325f35a452e4afa28268fbcd28"
-dependencies = [
- "memchr",
- "ruff_text_size 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.15.12)",
-]
-
 [[package]]
 name = "ruff_source_file"
 version = "0.0.0"
 source = "git+https://github.com/astral-sh/ruff.git?tag=0.15.13#2afb467ce397e4a89c13a0a814c62cfecb0e9e49"
 dependencies = [
  "get-size2",
  "memchr",
- "ruff_text_size 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.15.13)",
+ "ruff_text_size",
  "serde",
 ]
 
-[[package]]
-name = "ruff_text_size"
-version = "0.0.0"
-source = "git+https://github.com/astral-sh/ruff.git?tag=0.15.12#66f93cf7ed4d36325f35a452e4afa28268fbcd28"
-
 [[package]]
 name = "ruff_text_size"
 version = "0.0.0"
@@ -2638,8 +2624,8 @@ dependencies = [
  "ruff_linter",
  "ruff_python_ast",
  "ruff_python_parser",
- "ruff_source_file 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.15.12)",
- "ruff_text_size 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.15.12)",
+ "ruff_source_file",
+ "ruff_text_size",
  "serde",
  "serde_json",
  "serial_test",
```

**File**: `Cargo.toml` (modified, +2/-2)
```diff
@@ -15,8 +15,8 @@ once_cell = "1.21.4"
 ruff_python_ast = { git = "https://github.com/astral-sh/ruff.git", package="ruff_python_ast", tag = "0.15.13" }
 ruff_python_parser = { git = "https://github.com/astral-sh/ruff.git", package="ruff_python_parser", tag = "0.15.13" }
 ruff_linter = { git = "https://github.com/astral-sh/ruff.git", package="ruff_linter", tag = "0.15.13" }
-ruff_source_file = { git = "https://github.com/astral-sh/ruff.git", package="ruff_source_file", tag = "0.15.12" }
-ruff_text_size = { git = "https://github.com/astral-sh/ruff.git", package="ruff_text_size", tag = "0.15.12" }
+ruff_source_file = { git = "https://github.com/astral-sh/ruff.git", package="ruff_source_file", tag = "0.15.13" }
+ruff_text_size = { git = "https://github.com/astral-sh/ruff.git", package="ruff_text_size", tag = "0.15.13" }
 cached = { version = "0.59.0", features = ["disk_store"] }
 globset = "0.4.18"
 toml = "1.0.6"
```

---

### Incident Patch 9: `7aa77395` (2026-05-12)
**Commit Message**: bump dependencies that require manual bumping

**File**: `Cargo.lock` (modified, +22/-36)
```diff
@@ -1953,8 +1953,8 @@ dependencies = [
  "ruff_python_ast",
  "ruff_python_parser",
  "ruff_python_trivia",
- "ruff_source_file 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.15.12)",
- "ruff_text_size 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.15.12)",
+ "ruff_source_file",
+ "ruff_text_size",
  "rustc-hash",
  "salsa",
  "serde",
@@ -1975,7 +1975,7 @@ source = "git+https://github.com/astral-sh/ruff.git?tag=0.15.12#66f93cf7ed4d3632
 dependencies = [
  "get-size2",
  "is-macro",
- "ruff_text_size 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.15.12)",
+ "ruff_text_size",
  "serde",
 ]
 
@@ -2028,8 +2028,8 @@ dependencies = [
  "ruff_python_semantic",
  "ruff_python_stdlib",
  "ruff_python_trivia",
- "ruff_source_file 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.15.12)",
- "ruff_text_size 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.15.12)",
+ "ruff_source_file",
+ "ruff_text_size",
  "rustc-hash",
  "serde",
  "serde_json",
@@ -2077,8 +2077,8 @@ dependencies = [
  "itertools 0.14.0",
  "rand 0.10.0",
  "ruff_diagnostics",
- "ruff_source_file 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.15.12)",
- "ruff_text_size 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.15.12)",
+ "ruff_source_file",
+ "ruff_text_size",
  "serde",
  "serde_json",
  "serde_with",
@@ -2100,8 +2100,8 @@ dependencies = [
  "ruff_cache",
  "ruff_macros",
  "ruff_python_trivia",
- "ruff_source_file 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.15.12)",
- "ruff_text_size 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.15.12)",
+ "ruff_source_file",
+ "ruff_text_size",
  "rustc-hash",
  "serde",
  "thiserror 2.0.18",
@@ -2115,8 +2115,8 @@ dependencies = [
  "ruff_python_ast",
  "ruff_python_literal",
  "ruff_python_parser",
- "ruff_source_file 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.15.12)",
- "ruff_text_size 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.15.12)",
+ "ruff_source_file",
+ "ruff_text_size",
 ]
 
 [[package]]
@@ -2129,8 +2129,8 @@ dependencies = [
  "ruff_python_ast",
  "ruff_python_codegen",
  "ruff_python_trivia",
- "ruff_source_file 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.15.12)",
- "ruff_text_size 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.15.12)",
+ "ruff_source_file",
+ "ruff_text_size",
 ]
 
 [[package]]
@@ -2140,8 +2140,8 @@ source = "git+https://github.com/astral-sh/ruff.git?tag=0.15.12#66f93cf7ed4d3632
 dependencies = [
  "ruff_python_ast",
  "ruff_python_trivia",
- "ruff_source_file 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.15.12)",
- "ruff_text_size 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.15.12)",
+ "ruff_source_file",
+ "ruff_text_size",
 ]
 
 [[package]]
@@ -2167,7 +2167,7 @@ dependencies = [
  "memchr",
  "ruff_python_ast",
  "ruff_python_trivia",
- "ruff_text_size 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.15.12)",
+ "ruff_text_size",
  "rustc-hash",
  "static_assertions",
  "unicode-ident",
@@ -2188,7 +2188,7 @@ dependencies = [
  "ruff_python_ast",
  "ruff_python_parser",
  "ruff_python_stdlib",
- "ruff_text_size 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.15.12)",
+ "ruff_text_size",
  "rustc-hash",
  "smallvec",
 ]
@@ -2208,36 +2208,22 @@ version = "0.0.0"
 source = "git+https://github.com/astral-sh/ruff.git?tag=0.15.12#66f93cf7ed4d36325f35a452e4afa28268fbcd28"
 dependencies = [
  "itertools 0.14.0",
- "ruff_source_file 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.15.12)",
- "ruff_text_size 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.15.12)",
+ "ruff_source_file",
+ "ruff_text_size",
  "unicode-ident",
 ]
 
-[[package]]
-name = "ruff_source_file"
-version = "0.0.0"
-source = "git+https://github.com/astral-sh/ruff.git?tag=0.14.3#8737a2d5f5138d855ef4b3ff6982bd7684324eab"
-dependencies = [
- "memchr",
- "ruff_text_size 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.14.3)",
-]
-
 [[package]]
 name = "ruff_source_file"
 version = "0.0.0"
 source = "git+https://github.com/astral-sh/ruff.git?tag=0.15.12#66f93cf7ed4d36325f35a452e4afa28268fbcd28"
 dependencies = [
  "get-size2",
  "memchr",
- "ruff_text_size 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.15.12)",
+ "ruff_text_size",
  "serde",
 ]
 
-[[package]]
-name = "ruff_text_size"
-version = "0.0.0"
-source = "git+https://github.com/astral-sh/ruff.git?tag=0.14.3#8737a2d5f5138d855ef4b3ff6982bd7684324eab"
-
 [[package]]
 name = "ruff_text_size"
 version = "0.0.0"
@@ -2638,8 +2624,8 @@ dependencies = [
  "ruff_linter",
  "ruff_python_ast",
  "ruff_python_parser",
- "ruff_source_file 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.14.3)",
- "ruff_text_size 0.0.0 (git+https://github.com/astral-sh/ruff.git?tag=0.14.3)",
+ "ruff_source_file",
+ "ruff_text_size",
  "serde",
  "serde_json",
  "serial_test",
```

**File**: `Cargo.toml` (modified, +2/-2)
```diff
@@ -15,8 +15,8 @@ once_cell = "1.21.4"
 ruff_python_ast = { git = "https://github.com/astral-sh/ruff.git", package="ruff_python_ast", tag = "0.15.12" }
 ruff_python_parser = { git = "https://github.com/astral-sh/ruff.git", package="ruff_python_parser", tag = "0.15.12" }
 ruff_linter = { git = "https://github.com/astral-sh/ruff.git", package="ruff_linter", tag = "0.15.12" }
-ruff_source_file = { git = "https://github.com/astral-sh/ruff.git", package="ruff_source_file", tag = "0.14.3" }
-ruff_text_size = { git = "https://github.com/astral-sh/ruff.git", package="ruff_text_size", tag = "0.14.3" }
+ruff_source_file = { git = "https://github.com/astral-sh/ruff.git", package="ruff_source_file", tag = "0.15.12" }
+ruff_text_size = { git = "https://github.com/astral-sh/ruff.git", package="ruff_text_size", tag = "0.15.12" }
 cached = { version = "0.59.0", features = ["disk_store"] }
 globset = "0.4.18"
 toml = "1.0.6"
```

---

### Incident Patch 10: `99f65beb` (2026-05-12)
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

### Incident Patch 11: `e4ff5488` (2026-04-03)
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

### Incident Patch 12: `118666ce` (2026-04-02)
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

### Incident Patch 13: `a393df24` (2026-03-23)
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

### Incident Patch 14: `d2757153` (2026-03-18)
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
+    { url = "https://files.pythonhosted.org/packages/c7/3f/d1e9cdbd22cfcff0868a53505a4b09c7295ef776571cae9d272c4b6c57ac/rustup-1.28.2.1-py3-none-musllinux_2_17_aarch64.whl", hash = "sha256:2d8c9af0a951285fe0c71b2215b6fabe590b19c1f5d9a5d98658e6889dc407c8", size = 7829498, upload-time = "2025-09-12T11:30:51.14Z" },
+    { url = "https://files.pythonhosted.org/packages/93/af/9eea48c0c439133eb65d1bde1a5c7552d23814f1e88e6feaa93c2f8b65ad/rustup-1.28.2.1-py3-none-musllinux_2_17_ppc64le.whl", hash = "sha256:e6f2437ef62bdd793a7d7a442e20a3d4654026ac0259f4227b28ae9cb0ea9aa9", size = 6652478, upload-time = "2025-09-12T11:30:54.119Z" },
+    { url = "https://files.pythonhosted.org/packages/24/cd/4e9f5bd350e26f5b275c5516079b5be7cfaa2d0212dc3eff01a6ade0dc36/rustup-1.28.2.1-py3-none-musllinux_2_17_x86_64.whl", hash = "sha256:d9e1e5cc456bccf13967280096a3cf4b1f13d631b81d71153512760e254dc38b", size = 8037751, upload-time = "2025-09-12T11:30:56.523Z" },
+    { url = "https://files.pythonhosted.org/packages/25/16/e05922e5924635ca3a580ffc8d439c8cc0689ffb
```

---

### Incident Patch 15: `49b07c22` (2026-03-18)
**Commit Message**: replace pip uage in noxfile with uv to fix crash in new rustup-pypi version

**File**: `.basedpyright/baseline.json` (modified, +8/-0)
```diff
@@ -11356,6 +11356,14 @@
                     "lineCount": 9
                 }
             },
+            {
+                "code": "reportUnusedCallResult",
+                "range": {
+                    "startColumn": 4,
+                    "endColumn": 5,
+                    "lineCount": 9
+                }
+            },
             {
                 "code": "reportAny",
                 "range": {
```

**File**: `vscode/noxfile.py` (modified, +4/-1)
```diff
@@ -19,7 +19,10 @@ def _install_bundle(session: nox.Session) -> None:
         "./bundled/libs",
         external=True,
     )
-    session.install(
+    session.run(
+        "uv",
+        "pip",
+        "install",
         "-v",
         "--target",
         "./bundled/libs",
```

#### Recent Merged Pull Requests:
- **PR #952** (2026-10-01): add python 3.15 to ci (@DetachHead)
- **PR #951** (2026-10-01): Add Windows ARM64 builds (@ndabas)
- **PR #950** (2026-10-01): Bump the "all" group with 2 updates across multiple ecosystems (@dependabot[bot])
- **PR #949** (2026-09-14): Bump the "all" group with 2 updates across multiple ecosystems (@dependabot[bot])
- **PR #948** (2026-09-01): Bump the "all" group with 2 updates across multiple ecosystems (@dependabot[bot])
- **PR #945** (closed): bump gitpython to 3.1.60 to fix CVE-2026-78676 (@felipe-marques-prolific)
- **PR #944** (closed): Add `tach deadcode` command (@slayton)
- **PR #941** (2026-06-11): fix ai policy (@DetachHead)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
