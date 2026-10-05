# Forensic Learning Record (Deep Inspection): oraios/serena

> **Canonical Artifact**: `07_PROJECT_LEARNING/oraios-serena-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/oraios/serena](https://github.com/oraios/serena))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:27:43.540Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `oraios/serena`
- **Description**: A powerful MCP toolkit for coding, providing semantic retrieval and editing capabilities  - the IDE for your agent
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 29914 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `repo_dir_sync.py`
```
# -*- coding: utf-8 -*-
import glob
import os
import shutil
from subprocess import Popen, PIPE
import re
import sys
from typing import List, Optional, Sequence
import platform


def popen(cmd):
    shell = platform.system() != "Windows"
    p = Popen(cmd, shell=shell, stdin=PIPE, stdout=PIPE)
    return p


def call(cmd):
    p = popen(cmd)
    return p.stdout.read().decode("utf-8")


def execute(cmd, exceptionOnError=True):
    """
    :param cmd: the command to execute
    :param exceptionOnError: if True, raise on exception on error (return code not 0); if False return
        whether the call was successful
    :return: True if the call was successful, False otherwise (if exceptionOnError==False)
    """
    p = popen(cmd)
    p.wait()
    success = p.returncode == 0
    if exceptionOnError:
        if not success:
            raise Exception("Command failed: %s" % cmd)
    else:
        return success


def gitLog(path, arg):
    oldPath = os.getcwd()
    os.chdir(path)
    lg = call("git log --no-merges " + arg)
    os.chdir(oldPath)
    return lg


def gitCommit(msg):
    with open(COMMIT_MSG_FILENAME, "wb") as f:
        f.write(msg.encode("utf-8"))
    gitCommitWithMessageFromFile(COMMIT_MSG_FILENAME)


def gitCommitWithMessageFromFile(commitMsgFilename):
    if not os.path.exists(commitMsgFilename):
        raise FileNotFoundError(f"{commitMsgFilename} not found in {os.path.abspath(os.getcwd())}")
    os.system(f"git commit --file={commitMsgFilename}")
    os.unlink(commitMsgFilename)


COMMIT_MSG_FILENAME = "commitmsg.txt"


class OtherRepo:
    SYNC_COMMIT_ID_FILE_LIB_REPO = ".syncCommitId.remote"
    SYNC_COMMIT_ID_FILE_THIS_REPO = ".syncCommitId.this"
    SYNC_COMMIT_MESSAGE = f"Updated %s sync commit identifiers"
    SYNC_BACKUP_DIR = ".syncBackup"
    
    def __init__(self, name, branch, pathToLib):
        self.pathToLibInThisRepo = os.path.abspath(pathToLib)
        if not os.path.exists(self.pathToLibInThisRepo):
            raise ValueError(f"Repository directory '{self.pathToLibInThisRepo}' does not exist")
        self.name = name
        self.branch = branch
        self.libRepo: Optional[LibRepo] = None

    def isSyncEstablished(self):
        return os.path.exists(os.path.join(self.pathToLibInThisRepo, self.SYNC_COMMIT_ID_FILE_LIB_REPO))
    
    def lastSyncIdThisRepo(self):
        with open(os.path.join(self.pathToLibInThisRepo, self.SYNC_COMMIT_ID_FILE_THIS_REPO), "r") as f:
            commitId = f.read().strip()
        return commitId

    def lastSyncIdLibRepo(self):
        with open(os.path.join(self.pathToLibInThisRepo, self.SYNC_COMMIT_ID_FILE_LIB_REPO), "r") as f:
            commitId = f.read().strip()
        return commitId

    def gitLogThisRepoSinceLastSync(self):
        lg = gitLog(self.pathToLibInThisRepo, '--name-only HEAD "^%s" .' % self.lastSyncIdThisRepo())
        lg = re.sub(r'commit [0-9a-z]{8,40}\n.*\n.*\n\s*\n.*\n\s*(\n.*\.syncCommitId\.(this|remote))+', r"", lg, flags=re.MULTILINE)  # remove commits with sync commit id update
        indent = "  "
        lg = indent + lg.replace("\n", "\n" + indent)
        return lg

    def gitLogLibRepoSinceLastSync(self, libRepo: "LibRepo"):
        syncIdFile = os.path.join(self.pathToLibInThisRepo, self.SYNC_COMMIT_ID_FILE_LIB_REPO)
        if not os.path.exists(syncIdFile):
            return ""
        with open(syncIdFile, "r") as f:
            syncId = f.read().strip()
        lg = gitLog(libRepo.libPath, '--name-only HEAD "^%s" .'  % syncId)
        lg = re.sub(r"Sync (\w+)\n\s*\n", r"Sync\n\n", lg, flags=re.MULTILINE)
        indent = "  "
        lg = indent + lg.replace("\n", "\n" + indent)
        return "\n\n" + lg

    def _userInputYesNo(self, question) -> bool:
        result = None
        while result not in ("y", "n"):
            result = input(question + " [y|n]: ").strip()
        return result == "y"

    def pull(self, libRepo: "LibRepo"):
        """
        Pulls in changes from this repository into the lib repo
        """
        # switch to branch in lib repo
        os.chdir(libRepo.rootPath)
        execute("git checkout %s" % self.branch)

        # check if the branch contains the commit that is referenced as the remote commit
        remoteCommitId = self.lastSyncIdLibRepo()
        remoteCommitExists = execute("git rev-list HEAD..%s" % remoteCommitId, exceptionOnError=False)
        if not remoteCommitExists:
            if not self._userInputYesNo(f"\nWARNING: The referenced remote commit {remoteCommitId} does not exist "
                                        f"in your {self.libRepo.name} branch '{self.branch}'!\nSomeone else may have "
                                        f"pulled/pushed in the meantime.\nIt is recommended that you do not continue. "
                                        f"Continue?"):
                return

        # check if this branch is clean
        lgLib = self.gitLogLibRepoSinceLastSync(libRepo).strip()
        if lgLib != "":
            print(f"The following changes have been added to this branch in the library:\n\n{lgLib}\n\n")
            print(f"ERROR: You must push these changes before you can pull or reset this branch to {remoteCommitId}")
            sys.exit(1)

        # get log with relevant commits in this repo that are to be pulled
        lg = self.gitLogThisRepoSinceLastSync()

        os.chdir(libRepo.rootPath)

        # create commit message file
        commitMsg = f"Sync {self.name}\n\n" + lg
        with open(COMMIT_MSG_FILENAME, "w") as f:
            f.write(commitMsg)

        # ask whether to commit these changes
        print("Relevant commits:\n\n" + lg + "\n\n")
        if not self._userInputYesNo(f"The above changes will be pulled from {self.name}.\n"
                f"You may change the commit message by editing {os.path.abspath(COMMIT_MSG_FILENAME)}.\n"
                "Continue?"):
            os.unlink(COMMIT_MSG_FILENAME)
            return

        # prepare restoration of ignored files
        self.prepare_restoration_of_ignored_files(libRepo.rootPath)

        # remove library tree in lib repo
        shutil.rmtree(self.libRepo.libDirectory)

        # copy tree from this repo to lib repo (but drop the sync commit id files)
        shutil.copytree(self.pathToLibInThisRepo, self.libRepo.libDirectory)
        for fn in (self.SYNC_COMMIT_ID_FILE_LIB_REPO, self.SYNC_COMMIT_ID_FILE_THIS_REPO):
            p = os.path.join(self.libRepo.libDirectory, fn)
            if os.path.exists(p):
                os.unlink(p)

        # restore ignored directories/files
        self.restore_ignored_files(libRepo.rootPath)

        # make commit in lib repo
        os.system("git add %s" % self.libRepo.libDirectory)
        gitCommitWithMessageFromFile(COMMIT_MSG_FILENAME)
        newSyncCommitIdLibRepo = call("git rev-parse HEAD").strip()

        # update commit ids in this repo
        os.chdir(self.pathToLibInThisRepo)
        newSyncCommitIdThisRepo = call("git rev-parse HEAD").strip()
        with open(self.SYNC_COMMIT_ID_FILE_LIB_REPO, "w") as f:
            f.write(newSyncCommitIdLibRepo)
        with open(self.SYNC_COMMIT_ID_FILE_THIS_REPO, "w") as f:
            f.write(newSyncCommitIdThisRepo)
        execute('git add %s %s' % (self.SYNC_COMMIT_ID_FILE_LIB_REPO, self.SYNC_COMMIT_ID_FILE_THIS_REPO))
        execute(f'git commit -m "{self.SYNC_COMMIT_MESSAGE % self.libRepo.name} (pull)"')

        print(f"\n\nIf everything was successful, you should now push your changes to branch "
              f"'{self.branch}'\nand get your branch merged into develop (issuing a pull request where appropriate)")
        
    def push(self, libRepo: "LibRepo"):
        """
        Pushes changes from the lib repo to this repo
        """
        os.chdir(libRepo.rootPath)

        # switch to the source repo branch
        execute(f"git checkout {self.branch}")

        if self.isSyncEstablished():

            # check if there are any commits that have not yet been pull
```

### Core Architecture Module: `scripts/add_spdx_headers.py`
```
# SPDX-License-Identifier: GPL-3.0-or-later
"""
Adds SPDX-License-Identifier headers to Python source files according to the component
licensing structure documented in LICENSE.

Idempotent: files that already contain an SPDX identifier are left untouched.
Existing copyright notices and module docstrings are never modified; the identifier is
inserted after any shebang/encoding lines and after a leading module docstring (if present).
"""

import ast
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPDX_PREFIX = "# SPDX-License-Identifier:"


@dataclass(frozen=True)
class LicensedTree:
    """A directory tree whose Python files fall under a single license."""

    relative_path: str
    spdx_id: str


TREES = [
    LicensedTree("src/solidlsp", "MIT"),
    LicensedTree("src/serena", "GPL-3.0-or-later"),
    LicensedTree("src/interprompt", "GPL-3.0-or-later"),
    LicensedTree("scripts", "GPL-3.0-or-later"),
]


def _header_end_line(source: str) -> int:
    """
    Determines the 0-based line index at which the SPDX line is to be inserted, i.e. after
    shebang/encoding lines and after a leading module docstring.
    """
    lines = source.splitlines(keepends=True)
    idx = 0
    while idx < len(lines) and (lines[idx].startswith("#!") or (lines[idx].startswith("#") and "coding" in lines[idx])):
        idx += 1
    try:
        module = ast.parse(source)
    except SyntaxError:
        return idx
    if (
        module.body
        and isinstance(module.body[0], ast.Expr)
        and isinstance(module.body[0].value, ast.Constant)
        and isinstance(module.body[0].value.value, str)
    ):
        return max(idx, module.body[0].end_lineno)
    return idx


def add_header(path: Path, spdx_id: str) -> bool:
    """Adds the SPDX header to the given file; returns whether the file was modified."""
    with path.open(encoding="utf-8", newline="") as f:
        source = f.read()
    if SPDX_PREFIX in source:
        return False

    # keep empty files (e.g. package markers) untouched
    if not source.strip():
        return False

    # insert header, keeping the file's newline convention
    newline = "\r\n" if "\r\n" in source else "\n"
    lines = source.splitlines(keepends=True)
    idx = _header_end_line(source)
    header = f"{SPDX_PREFIX} {spdx_id}{newline}"
    if idx < len(lines) and lines[idx].strip() != "":
        header += newline
    lines.insert(idx, header)
    path.write_text("".join(lines), encoding="utf-8", newline="")
    return True


def main() -> None:
    modified = 0
    for tree in TREES:
        for path in sorted((ROOT / tree.relative_path).rglob("*.py")):
            if "__pycache__" in path.parts:
                continue
            if add_header(path, tree.spdx_id):
                modified += 1
                print(f"{tree.spdx_id:18} {path.relative_to(ROOT)}")
    print(f"{modified} file(s) modified", file=sys.stderr)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `scripts/agno_agent.py`
```
# SPDX-License-Identifier: GPL-3.0-or-later

from agno.models.anthropic.claude import Claude
from agno.models.google.gemini import Gemini
from agno.os import AgentOS
from sensai.util import logging
from sensai.util.helper import mark_used

from serena.agno import SerenaAgnoAgentProvider

mark_used(Gemini, Claude)

# initialize logging
if __name__ == "__main__":
    logging.configure(level=logging.INFO)

# Define the model to use (see Agno documentation for supported models; these are just examples)
# model = Claude(id="claude-3-7-sonnet-20250219")
model = Gemini(id="gemini-2.5-pro")

# Create the Serena agent using the existing provider
serena_agent = SerenaAgnoAgentProvider.get_agent(model)

# Create AgentOS app with the Serena agent
agent_os = AgentOS(
    description="Serena coding assistant powered by AgentOS",
    id="serena-agentos",
    agents=[serena_agent],
)

app = agent_os.get_app()

if __name__ == "__main__":
    # Start the AgentOS server
    agent_os.serve(app="agno_agent:app", reload=False)

```

### Core Architecture Module: `scripts/bump_version.py`
```
# SPDX-License-Identifier: GPL-3.0-or-later

from __future__ import annotations

import logging
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Literal

import click

from serena.constants import REPO_ROOT
from serena.util.git import get_git_status

log = logging.getLogger(__name__)

VersionPart = Literal["major", "minor", "patch"]
#: a version part to bump or, in the case of "current", the version already reserved by the current .dev version
VersionTarget = Literal["major", "minor", "patch", "current"]
_VERSION_PATTERN = re.compile(r"^(?P<major>\d+)\.(?P<minor>\d+)\.(?P<patch>\d+)(\.\w+)?$")
_INIT_VERSION_PATTERN = re.compile(r'^(?P<before>__version__\s*=\s*")(?P<version>\d+\.\d+\.\d+(?:\.\w+)?)(?P<after>"\s*)$', re.MULTILINE)
_PYPROJECT_VERSION_PATTERN = re.compile(
    r'(?m)^(?P<before>\[project\]\n(?:.*\n)*?^version\s*=\s*")(?P<version>\d+\.\d+\.\d+(?:\.\w+)?)(?P<after>"\s*)$'
)
_VERSION_SUFFIX_PATTERN = re.compile(r"^\d+\.\d+\.\d+\.(?P<suffix>\w+)$")
_UNRELEASED_HEADER = "# Unreleased (main)\n"


_version_target_argument = click.argument("version_target", type=click.Choice(["current", "major", "minor", "patch"]))
_version_part_argument = click.argument("version_part", type=click.Choice(["major", "minor", "patch"]))
_dry_run_option = click.option("--dry-run", is_flag=True, help="Show what would change without writing any files.")


@click.group()
def cli() -> None:
    """Manages the Serena version."""


@cli.command()
@_version_target_argument
@_dry_run_option
def release(version_target: VersionTarget, dry_run: bool) -> None:
    """Bumps the version for a release and starts the next dev iteration.

    Bumps the version, updates the changelog, commits and tags the release, and then commits
    the subsequent .dev0 version.

    VERSION_TARGET is either "current", releasing the version already reserved by the current .dev version
    (the usual case), or the part of the version to bump beyond it (major, minor or patch).
    """
    require_clean_working_directory()
    log.info("release called: version_target=%s", version_target)

    repo_root = find_repo_root()
    log.info("Repo root: %s", repo_root)

    # bump to the release version
    new_version = bump_repo_version(repo_root, version_target=version_target, dry_run=dry_run)
    log.info("New version: %s", new_version)
    if dry_run:
        click.echo(f"Dry run complete. Version would be bumped to {new_version}")
        return

    # commit and tag the release version
    commit_version_change(new_version, message=f"Release v{new_version}")
    os.system(f"git tag v{new_version}")

    # bump patch and add the suffix for the next dev iteration
    new_snapshot_version = bump_repo_version(repo_root, version_target="patch", dry_run=dry_run, target_version_suffix=".dev0")
    log.info("New snapshot version: %s", new_snapshot_version)
    commit_version_change(new_snapshot_version, message=f"Set version to v{new_snapshot_version}")


@cli.command()
@_version_part_argument
@_dry_run_option
def dev(version_part: VersionPart, dry_run: bool) -> None:
    """Bumps the development version without creating a release.

    Sets the version to a new .dev0 version and commits it; no tag is created and the changelog
    is not modified.

    VERSION_PART is the part of the version to bump (major, minor or patch).
    """
    require_clean_working_directory()
    log.info("dev called: version_part=%s", version_part)

    repo_root = find_repo_root()
    log.info("Repo root: %s", repo_root)

    new_version = bump_repo_version(repo_root, version_target=version_part, dry_run=dry_run, target_version_suffix=".dev0")
    log.info("New version: %s", new_version)
    if dry_run:
        click.echo(f"Dry run complete. Version would be bumped to {new_version}")
        return

    commit_version_change(new_version, message=f"Set version to v{new_version}")


def require_clean_working_directory() -> None:
    if not get_git_status().is_clean:
        raise click.ClickException("Working directory is not clean. Please commit or stash your changes first.")


def commit_version_change(new_version: str, *, message: str) -> None:
    os.system("uv lock")
    click.echo(f"Bumped version to {new_version}")
    os.system("git add -u")
    os.system(f'git commit -m "{message}"')


def find_repo_root() -> Path:
    return Path(REPO_ROOT)


def bump_repo_version(
    repo_root: Path,
    *,
    version_target: VersionTarget,
    dry_run: bool = False,
    target_version_suffix: str | None = None,
) -> str:
    pyproject_path = repo_root / "pyproject.toml"
    init_path = repo_root / "src" / "serena" / "__init__.py"
    changelog_path = repo_root / "CHANGELOG.md"

    log.info("Reading pyproject.toml from %s", pyproject_path)
    pyproject_text = pyproject_path.read_text(encoding="utf-8")
    log.info("Reading __init__.py from %s", init_path)
    init_text = init_path.read_text(encoding="utf-8")
    log.info("Reading CHANGELOG.md from %s", changelog_path)
    changelog_text = changelog_path.read_text(encoding="utf-8")

    log.info("Extracting versions")
    current_version = extract_version(pyproject_text, _PYPROJECT_VERSION_PATTERN, "pyproject.toml")
    init_version = extract_version(init_text, _INIT_VERSION_PATTERN, "src/serena/__init__.py")
    log.info("pyproject.toml version: %s, __init__.py version: %s", current_version, init_version)
    if current_version != init_version:
        raise click.ClickException(
            f"Version mismatch between pyproject.toml and src/serena/__init__.py: {current_version} != {init_version}"
        )

    if version_target == "current" and _VERSION_SUFFIX_PATTERN.search(current_version) is None:
        raise click.ClickException(
            f"The current version {current_version} is not a development version, so there is no reserved version to release. "
            f"Use major, minor or patch to bump the version instead."
        )
    new_version = increment_version(current_version, version_target)
    if target_version_suffix is not None:
        new_version += target_version_suffix
    log.info("New version will be: %s", new_version)

    new_pyproject_text = replace_version(pyproject_text, _PYPROJECT_VERSION_PATTERN, new_version, "pyproject.toml")
    new_init_text = replace_version(init_text, _INIT_VERSION_PATTERN, new_version, "src/serena/__init__.py")

    file_changes: list[tuple[Path, str, str]] = [
        (pyproject_path, pyproject_text, new_pyproject_text),
        (init_path, init_text, new_init_text),
    ]

    # update changelog only for actual releases (not -dev versions with suffixes)
    if target_version_suffix is None:
        new_changelog_text = update_changelog(changelog_text, new_version)
        file_changes.append((changelog_path, changelog_text, new_changelog_text))

    if dry_run:
        for path, old, new in file_changes:
            if old != new:
                rel = path.relative_to(repo_root)
                click.echo(f"\n--- {rel}")
                _print_diff(old, new)
    else:
        for path, _old, new in file_changes:
            log.info("Writing %s", path)
            path.write_text(new, encoding="utf-8")
        log.info("All files written successfully")

    return new_version


def _print_diff(old: str, new: str) -> None:
    import difflib

    diff = difflib.unified_diff(old.splitlines(), new.splitlines(), lineterm="")
    # Skip the --- / +++ header lines from unified_diff
    lines = list(diff)
    for line in lines[2:]:
        click.echo(line)


def extract_version(text: str, pattern: re.Pattern[str], file_label: str) -> str:
    """
    Extracts the core version Major.Minor.Patch in the given text
    :param text:
    :param pattern: the pattern to search for
    :param file_label: file reference for error messages
    :return: the core version
    """
    match = pattern.search(text)
    if match is None:
        raise click.ClickException(f"Could not find version in {file
```

### Core Architecture Module: `scripts/demo_cli_call.py`
```
# SPDX-License-Identifier: GPL-3.0-or-later

from serena.cli import top_level

if __name__ == "__main__":
    top_level(["--help"])

```

### Core Architecture Module: `scripts/demo_diagnostics.py`
```
"""
Demonstrates diagnostics tools and edit-tool diagnostic reporting on the Serena repo itself.

The script creates a temporary Python file inside this repository, introduces one warning,
shows file and symbol diagnostics, then introduces another warning and verifies that the
second edit reports only the newly introduced warning.
"""
# SPDX-License-Identifier: GPL-3.0-or-later

import json
import shutil
import tempfile
from pathlib import Path
from pprint import pprint

from serena.agent import SerenaAgent
from serena.config.serena_config import ProjectConfig, RegisteredProject, SerenaConfig
from serena.constants import REPO_ROOT
from serena.language_backend import BuiltinLanguageBackend
from serena.project import Project
from serena.tools import (
    CreateTextFileTool,
    EditingToolWithDiagnostics,
    GetDiagnosticsForFileTool,
    GetDiagnosticsForSymbolTool,
    ReplaceContentTool,
)
from solidlsp.ls_config import LanguageServerId

SEPARATOR = "=" * 80
REPO_PATH = Path(REPO_ROOT)
EDIT_RESULT_PREFIX = "Edit introduced new warning-or-higher diagnostics: "


def make_agent() -> SerenaAgent:
    """Create an LSP-backed Serena agent for the Serena repository."""
    serena_config = SerenaConfig.from_config_file()
    serena_config.web_dashboard = False
    serena_config.set_builtin_language_backend(BuiltinLanguageBackend.LSP)

    project = Project(
        project_root=str(REPO_PATH),
        project_config=ProjectConfig(
            project_name="demo_serena_repo",
            language_servers=[LanguageServerId.PYTHON],
            ignored_paths=[],
            excluded_tools=[],
            read_only=False,
            ignore_all_files_in_gitignore=True,
            initial_prompt="",
            encoding="utf-8",
        ),
        serena_config=serena_config,
    )
    serena_config.projects = [RegisteredProject.from_project_instance(project)]
    return SerenaAgent(project="demo_serena_repo", serena_config=serena_config)


def print_section(title: str) -> None:
    """Print a visibly separated section header."""
    print(f"\n{SEPARATOR}")
    print(title)
    print(SEPARATOR)


def parse_json_result(result: str) -> object:
    """Parse and pretty-print JSON tool output."""
    parsed = json.loads(result)
    pprint(parsed, width=200)
    return parsed


def parse_edit_diagnostics_result(result: str) -> dict:
    """Extract the grouped diagnostics payload from an edit-tool result."""
    assert result.startswith(EDIT_RESULT_PREFIX), result
    return json.loads(result[len(EDIT_RESULT_PREFIX) :])


if __name__ == "__main__":
    EditingToolWithDiagnostics.ENABLE_DIAGNOSTICS = True

    temp_dir = Path(tempfile.mkdtemp(prefix="serena_demo_", dir=REPO_PATH))
    temp_file = temp_dir / "demo_temp_diagnostics.py"
    relative_path = temp_file.relative_to(REPO_PATH).as_posix()

    initial_content = """def demo_existing_issue() -> int:
    value = 1
    return value
"""

    agent = make_agent()

    try:
        # letting the language server finish startup
        agent.execute_task(lambda: None)

        create_text_file_tool = agent.get_tool(CreateTextFileTool)
        replace_content_tool = agent.get_tool(ReplaceContentTool)
        get_diagnostics_for_file_tool = agent.get_tool(GetDiagnosticsForFileTool)
        get_diagnostics_for_symbol_tool = agent.get_tool(GetDiagnosticsForSymbolTool)

        # creating a clean temporary file
        print_section("Create Temporary File")
        create_result = agent.execute_task(lambda: create_text_file_tool.apply(relative_path=relative_path, content=initial_content))
        print(create_result)

        # showing file diagnostics before introducing any warning
        print_section("Initial File Diagnostics")
        initial_diagnostics_result = agent.execute_task(
            lambda: get_diagnostics_for_file_tool.apply(relative_path=relative_path, min_severity=2)
        )
        initial_diagnostics = parse_json_result(initial_diagnostics_result)
        assert initial_diagnostics == {}, initial_diagnostics

        # introducing the first warning
        print_section("First Edit Result")
        first_edit_result = agent.execute_task(
            lambda: replace_content_tool.apply(
                relative_path=relative_path,
                needle="value = 1",
                repl="value = missing_one",
                mode="literal",
            )
        )
        print(first_edit_result)
        first_edit_diagnostics = parse_edit_diagnostics_result(first_edit_result)
        pprint(first_edit_diagnostics, width=200)
        assert "missing_one" in json.dumps(first_edit_diagnostics), first_edit_diagnostics

        # showing the file- and symbol-level diagnostics after the first warning
        print_section("File Diagnostics After First Edit")
        diagnostics_after_first_edit_result = agent.execute_task(
            lambda: get_diagnostics_for_file_tool.apply(relative_path=relative_path, min_severity=2)
        )
        diagnostics_after_first_edit = parse_json_result(diagnostics_after_first_edit_result)
        assert "missing_one" in json.dumps(diagnostics_after_first_edit), diagnostics_after_first_edit

        print_section("Symbol Diagnostics After First Edit")
        symbol_diagnostics_result = agent.execute_task(
            lambda: get_diagnostics_for_symbol_tool.apply(
                name_path="demo_existing_issue",
                reference_file=relative_path,
                min_severity=2,
            )
        )
        symbol_diagnostics = parse_json_result(symbol_diagnostics_result)
        assert "missing_one" in json.dumps(symbol_diagnostics), symbol_diagnostics

        # introducing a second warning while keeping the first one unchanged
        print_section("Second Edit Result")
        second_edit_result = agent.execute_task(
            lambda: replace_content_tool.apply(
                relative_path=relative_path,
                needle="    return value\n",
                repl="    other = missing_two\n    return value + other\n",
                mode="literal",
            )
        )
        print(second_edit_result)
        second_edit_diagnostics = parse_edit_diagnostics_result(second_edit_result)
        pprint(second_edit_diagnostics, width=200)
        second_edit_json = json.dumps(second_edit_diagnostics)
        assert "missing_two" in second_edit_json, second_edit_diagnostics
        assert "missing_one" not in second_edit_json, second_edit_diagnostics
        print("\nVerified: the second edit result reports only the newly introduced warning.")

        # showing the complete file diagnostics after both warnings exist
        print_section("File Diagnostics After Second Edit")
        diagnostics_after_second_edit_result = agent.execute_task(
            lambda: get_diagnostics_for_file_tool.apply(relative_path=relative_path, min_severity=2)
        )
        diagnostics_after_second_edit = parse_json_result(diagnostics_after_second_edit_result)
        diagnostics_after_second_edit_json = json.dumps(diagnostics_after_second_edit)
        assert "missing_one" in diagnostics_after_second_edit_json, diagnostics_after_second_edit
        assert "missing_two" in diagnostics_after_second_edit_json, diagnostics_after_second_edit
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
        agent.shutdown()

```

### Core Architecture Module: `scripts/demo_find_defining_symbol.py`
```
"""
Demonstrates both defining-symbol tools on the Python test repository.
"""
# SPDX-License-Identifier: GPL-3.0-or-later

import json
import re
from pathlib import Path
from pprint import pprint

from serena.agent import SerenaAgent
from serena.config.serena_config import ProjectConfig, RegisteredProject, SerenaConfig
from serena.constants import REPO_ROOT
from serena.language_backend import BuiltinLanguageBackend
from serena.project import Project
from serena.tools import FindDeclarationTool
from solidlsp.ls_config import LanguageServerId

SEPARATOR = "=" * 80
PYTHON_TEST_REPO = Path(REPO_ROOT) / "test" / "resources" / "repos" / "python" / "test_repo"
SERVICES_FILE = Path("test_repo") / "services.py"


def make_agent(project_root: Path, language: LanguageServerId, project_name: str) -> SerenaAgent:
    """Create an LSP-backed Serena agent for a single explicit project."""
    serena_config = SerenaConfig.from_config_file()
    serena_config.web_dashboard = False
    serena_config.set_builtin_language_backend(BuiltinLanguageBackend.LSP)

    project = Project(
        project_root=str(project_root),
        project_config=ProjectConfig(
            project_name=project_name,
            language_servers=[language],
            ignored_paths=[],
            excluded_tools=[],
            read_only=False,
            ignore_all_files_in_gitignore=True,
            initial_prompt="",
            encoding="utf-8",
        ),
        serena_config=serena_config,
    )
    serena_config.projects = [RegisteredProject.from_project_instance(project)]
    return SerenaAgent(project=project_name, serena_config=serena_config)


def print_section(title: str) -> None:
    """Print a visibly separated section header."""
    print(f"\n{SEPARATOR}")
    print(title)
    print(SEPARATOR)


def find_identifier_occurrence_position(file_path: Path, identifier: str, occurrence_index: int = 0) -> tuple[int, int]:
    """Find the 0-based position of an identifier occurrence in a file."""
    pattern = re.compile(r"\b" + re.escape(identifier) + r"\b")
    current_occurrence_index = 0
    with file_path.open(encoding="utf-8") as f:
        for line_index, line in enumerate(f):
            for match in pattern.finditer(line):
                if current_occurrence_index == occurrence_index:
                    return line_index, match.start()
                current_occurrence_index += 1
    raise ValueError(f"Could not find occurrence {occurrence_index} of {identifier!r} in {file_path}")


if __name__ == "__main__":
    agent = make_agent(PYTHON_TEST_REPO, LanguageServerId.PYTHON, "demo_python_test_repo")

    try:
        # letting the language server finish startup
        agent.execute_task(lambda: None)

        relative_path = SERVICES_FILE.as_posix()
        services_abs_path = PYTHON_TEST_REPO / SERVICES_FILE

        # resolving via regex over the full file
        find_by_regex_tool = agent.get_tool(FindDeclarationTool)
        regex_result = agent.execute_task(
            lambda: find_by_regex_tool.apply(
                regex=r"from \.models import Item, (User)",
                relative_path=relative_path,
                include_info=True,
            )
        )

        print_section("FindDefiningSymbolTool (File Regex)")
        regex_symbol = json.loads(regex_result)
        pprint(regex_symbol, width=200)

        # resolving via regex restricted to one containing symbol body
        contained_regex_result = agent.execute_task(
            lambda: find_by_regex_tool.apply(
                regex=r"=\s+(User)\(",
                relative_path=relative_path,
                containing_symbol_name_path="UserService/create_user",
                include_info=True,
            )
        )

        print_section("FindDefiningSymbolTool (Contained Regex)")
        contained_regex_symbol = json.loads(contained_regex_result)
        pprint(contained_regex_symbol, width=200)

        # validating the demonstrated result
        for symbol in [regex_symbol, contained_regex_symbol]:
            assert symbol is not None, "Expected a defining symbol result"
            assert symbol.get("relative_path") is not None
            assert "models.py" in symbol["relative_path"], symbol
            assert "User" in json.dumps(symbol), symbol
        print("\nVerified definition target: User in models.py")
    finally:
        agent.shutdown()

```

### Core Architecture Module: `scripts/demo_find_implementing_symbol.py`
```
"""
Demonstrates FindImplementationsTool on the Go test repository.
"""
# SPDX-License-Identifier: GPL-3.0-or-later

import json
from pathlib import Path
from pprint import pprint

from serena.agent import SerenaAgent
from serena.config.serena_config import ProjectConfig, RegisteredProject, SerenaConfig
from serena.constants import REPO_ROOT
from serena.language_backend import BuiltinLanguageBackend
from serena.project import Project
from serena.tools import FindImplementationsTool
from solidlsp.ls_config import LanguageServerId

SEPARATOR = "=" * 80
GO_TEST_REPO = Path(REPO_ROOT) / "test" / "resources" / "repos" / "go" / "test_repo"


def make_agent(project_root: Path, language: LanguageServerId, project_name: str) -> SerenaAgent:
    """Create an LSP-backed Serena agent for a single explicit project."""
    serena_config = SerenaConfig.from_config_file()
    serena_config.web_dashboard = False
    serena_config.set_builtin_language_backend(BuiltinLanguageBackend.LSP)

    project = Project(
        project_root=str(project_root),
        project_config=ProjectConfig(
            project_name=project_name,
            language_servers=[language],
            ignored_paths=[],
            excluded_tools=[],
            read_only=False,
            ignore_all_files_in_gitignore=True,
            initial_prompt="",
            encoding="utf-8",
        ),
        serena_config=serena_config,
    )
    serena_config.projects = [RegisteredProject.from_project_instance(project)]
    return SerenaAgent(project=project_name, serena_config=serena_config)


def print_section(title: str) -> None:
    """Print a visibly separated section header."""
    print(f"\n{SEPARATOR}")
    print(title)
    print(SEPARATOR)


if __name__ == "__main__":
    agent = make_agent(GO_TEST_REPO, LanguageServerId.GO, "demo_go_test_repo")

    try:
        # letting the language server finish startup
        agent.execute_task(lambda: None)

        # running the implementation lookup
        find_implementations_tool = agent.get_tool(FindImplementationsTool)
        result = agent.execute_task(
            lambda: find_implementations_tool.apply(
                name_path="Greeter/FormatGreeting",
                relative_path="main.go",
                include_info=True,
            )
        )

        print_section("Find Implementations Result")
        implementations = json.loads(result)
        pprint(implementations, width=200)

        # validating the demonstrated result
        assert any(implementation["name_path"] == "(ConsoleGreeter).FormatGreeting" for implementation in implementations), result
        print("\nVerified implementation target: (ConsoleGreeter).FormatGreeting")
    finally:
        agent.shutdown()

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1597** (2026-06-28): **Windows C#: OmniSharp startup can hang; Roslyn backend fails under deep SERENA_HOME path**
  *Symptoms*: ## Summary  On Windows, Serena's C# path has two related blockers that make it hard to use in an agent pipeline:  1. `csharp_omnisharp` can hang indefinitely during language-server startup/indexing. 2. `csharp` (Roslyn LS) works quickly with a short `SERENA_HOME`, but fails to install/extract when `SERENA_HOME` is under a deep workspace path because extracted NuGet paths exceed the classic Windows 260-character path limit.  For the same private .NET solution, the practical difference was:  - `csharp_omnisharp`: timed out after ~10 minutes and produced no C# symbol cache. - `csharp` with deep `SERENA_HOME`: failed in ~4 seconds during Roslyn package extraction. - `csharp` with short `SERENA_HOME=C:\tmp\cfg-serena`: indexed successfully in ~7.5 seconds, including first-time Roslyn package download/extract.  This makes it look like the repo itself is not slow. The slow/failing behavior is in backend startup/install handling.  ## Environment  - Serena: `1.5.3-8949fda1-dirty` via `uv tool install serena-agent` - OS: Windows - Shell: Windows PowerShell - .NET SDK: `10.0.300` - .NET runtimes: `Microsoft.NETCore.App 8.0.27`, `Microsoft.NETCore.App 10.0.8` - `pwsh`: not installed / not on PATH - Project: private .NET solution, 6 `.csproj` files, 44 C# files indexed by Roslyn when it works  ## Reproduction A: `csharp_omnisharp` hangs  Project config:  ```yaml languages:   - csharp_omnisharp read_only: true ```  Command:  ```powershell $env:SERENA_HOME = "C:\Users\<user>\Documents\GitHu
  **Post-Mortem & Fix Analysis**:
  > Thank you for the detailed report. We'd be happy to review a PR to fix this.
  > I have just opened a PR to fix this issue.

- **Issue #1578** (2026-06-24): **Serena cli commands may start IDE**
  *Symptoms*: With the recent jetbrains autolaunch by default, commands that rely on SerenaAgent launch an IDE. This affects at least `serena print-system-prompt`, but possibly other commands as well.  In that command there are also issues with log-level not being respected.
  **Post-Mortem & Fix Analysis**:
  > @opcode81 FYI. Unless this is already fixed on main (I may have an earlier checkout)
  > Two commands are affected: * the `print-system-prompt` command activates a project for no reason; not passing `project` would fix it * the `health-check` command probably should do this (as it reflects normal operation) 
  > I am taking care of this. I also did some enhancements to print-system-prompt that I needed for benchmarking which I'll commit along the way. I suspect most of our users don't use these commands, at least not often :)

- **Issue #1370** (2026-04-20): **Prompt of newly activated mode is not passed to LLM when using dynamic project activation**
  *Symptoms*: Im using a custom mode (project.yml - default_modes:), it is correctly displayed in Dashboard under my project.  When are the modes injected?  I dont see the custom modes prompt during MCP initialize (which would be expected for a project based mode) or "activate project". Do i need to put a placeholder or include into .serena/project.yml initial_prompt?  (im debugging with mcp inspector)  _Originally posted by @tomelgato in https://github.com/oraios/serena/discussions/1369_
  **Post-Mortem & Fix Analysis**:
  > @tomelgato this is a bug. The added mode's prompt is considered only if the project is activated at startup. If it is dynamically activated, it is not considered.
  > The trouble is: Providing the new mode prompts in a way that is ideal for all clients makes this a bit complicated.  Reason: Many clients do not read the MCP server's initial instructions anymore. Therefore, the way they receive all instructions (including newly activated modes) is through the `initial_instructions` tool which models are told to apply upon project activation if they have not yet read them. So if we provide the newly activated modes upon project activation and the model then applies the `initial_instructions` tool, it would get these instructions twice (unless we explicitly exclude them for the initial instructions in case the tool is applied after project activation).  Clients that do read the initial instructions are fine only receiving the new mode prompts upon activation.
  > Provide a project_instructions tool!? This would avoid the double reading and the projects mode prompt would be an addon

- **Issue #1360** (2026-04-21): **insert_after_symbol inserts inside multi-line constant/variable values (dict, list, etc.)**
  *Symptoms*: ## Problem  When `insert_after_symbol` is called on a top-level **constant or variable with a multi-line value** (e.g. a dict or list literal), the insertion lands **inside the value** — after the opening `{`/`[` — instead of after the closing `}`/`]`.  The root cause: `find_symbol` reports `body_location.start_line == body_location.end_line` for such constants (the LSP returns only the declaration line, not the full span of the value). `insert_after_symbol` then inserts after that single line, splitting the literal in half.  ## Minimal reproduction  **Input file (`example.py`):**  ```python """Minimal repro."""  SOME_CONFIG: dict[str, dict] = {     "key_a": {         "value": 1,         "notes": "first entry",     },     "key_b": {         "value": 2,         "notes": "second entry",     }, }   def some_function() -> str:     return "hello" ```  **Step 1 — find_symbol reports a single-line body for a 10-line dict:**  ``` find_symbol("SOME_CONFIG", relative_path="example.py", include_body=True) → body_location: {start_line: 2, end_line: 2}   body: "SOME_CONFIG" ```  The dict spans lines 3–12 (1-indexed) but `end_line` equals `start_line`.  **Step 2 — insert_after_symbol inserts inside the dict:**  ``` insert_after_symbol("SOME_CONFIG", "example.py", '\nNEW_CONSTANT = "inserted"\n') → OK ```  **Resulting file (broken):**  ```python """Minimal repro."""  SOME_CONFIG: dict[str, dict] = {   NEW_CONSTANT = "inserted"     "key_a": {         "value": 1,         "notes": "first entry
  **Post-Mortem & Fix Analysis**:
  > We dealt with this by forbidding to insert after constants and declarations. Unfortunately, there is no simple and reliable way to get the full body and make the insertion safe.
  > @Will-hxw I saw that you addressed this problem for the LSP backend. I think it's safer to just avoid such insertions, we instruct the agent to use insert_before instead or some other editing tool if no insertion tool else is suitable

- **Issue #1338** (2026-04-14): **Fix handling of read news**
  *Symptoms*: Current handling saves only a single id, which is insufficient. Add abstraction `ReadNews`, which we persist (backward-compatible).

- **Issue #1333** (2026-04-14): **rename_symbol skips .vue files unless find_referencing_symbols is called first**
  *Symptoms*: ## Bug Description    When calling `rename_symbol` on a TypeScript symbol (e.g. an enum) that is   referenced inside `.vue` files, the rename only applies to the defining `.ts` file.   References inside `<script setup>` blocks of `.vue` files are silently skipped.    If `find_referencing_symbols` is called first on the same symbol, the subsequent   `rename_symbol` correctly renames across all `.vue` files.    ## Root Cause    `request_references` calls `_ensure_vue_files_indexed_on_ts_server()` before   delegating to the TypeScript server. This method opens all `.vue` files via   `textDocument/didOpen` on the companion TS server, which is required for tsserver   to include them in rename edits.    `request_rename_symbol_edit` does not call `_ensure_vue_files_indexed_on_ts_server()`   — it delegates directly to the TS server without pre-indexing `.vue` files:    ```python   # vue_language_server.py   def request_rename_symbol_edit(self, ...):       with self._ts_server.open_file(relative_file_path):           return self._ts_server.request_rename_symbol_edit(...)  # .vue files not indexed   ```    Because `_vue_files_indexed` is `False` in a fresh session, tsserver only sees files   it already has open — i.e., the defining `.ts` file — and returns a rename edit for   that file only.    ## Steps to Reproduce    1. Vue 3 project with TypeScript   2. Define an enum in a `.ts` file, e.g. `FeatureFlags` in `useFeatureFlags.ts`   3. Use that enum in one or more `.vue` files   4. Cal
  **Post-Mortem & Fix Analysis**:
  > Thanks for the analysis and proposal, fixed in 1558a4e3bcf (with a general fix to ensure LS is operational before accepting requests and with an improved server startup, launching additional indexing in a background thread) 

- **Issue #1285** (2026-04-15): **YAML config rewrite causes docstrings following list items to be duplicated**
  *Symptoms*: This is an error in comment normalisation

- **Issue #1232** (2026-05-02): **Follow up after pinning all LS runtime deps - ensure configured version is honored**
  *Symptoms*: Currently for many LS we ignore the version if the binary can be found (we only download if we don't find).  We should consider putting the version into the path where we store the binaries. Also consider migration of some sort.  Idea for migration: For each LS we store the initially used version and we add a postfix to the path only for versions differing for that. Then no migration is necessary (assuming the users didn't override the version in the past - for a few LS it was possible)

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

### Incident Patch 1: `d99d933b` (2026-09-30)
**Commit Message**: Refactoring: Drop suffix naming scheme for language backends

**File**: `src/serena/jetbrains/jetbrains_backend.py` (modified, +2/-1)
```diff
@@ -21,7 +21,7 @@
 log = logging.getLogger(__name__)
 
 
-class LanguageBackendJetBrains(LanguageBackend):
+class JetBrainsLanguageBackend(LanguageBackend):
     def __init__(self, key: str | None = None):
         super().__init__(key or BuiltinLanguageBackend.JETBRAINS.value)
 
@@ -66,6 +66,7 @@ def init_active_project(self, agent: "SerenaAgent") -> None:
 
     @override
     def shutdown_active_project(self, project: "Project", timeout: float) -> None:
+        # Do nothing; IDE lifecycle is user-controlled
         pass
 
     @override
```

**File**: `src/serena/language_backend.py` (modified, +6/-6)
```diff
@@ -153,17 +153,17 @@ def from_str(backend_str: str) -> "BuiltinLanguageBackend":
     @cache
     def get_instance(self) -> LanguageBackend:
         if self == BuiltinLanguageBackend.LSP:
-            from .lsp.lsp_backend import LanguageBackendLSP
+            from .lsp.lsp_backend import LSPLanguageBackend
 
-            return LanguageBackendLSP()
+            return LSPLanguageBackend()
         elif self == BuiltinLanguageBackend.JETBRAINS:
-            from .jetbrains.jetbrains_backend import LanguageBackendJetBrains
+            from .jetbrains.jetbrains_backend import JetBrainsLanguageBackend
 
-            return LanguageBackendJetBrains()
+            return JetBrainsLanguageBackend()
         elif self == BuiltinLanguageBackend.OLB_JVM:
-            from .olb.olb_jvm_backend import LanguageBackendOraiosJVM
+            from .olb.olb_jvm_backend import OraiosJVMLanguageBackend
 
-            return LanguageBackendOraiosJVM()
+            return OraiosJVMLanguageBackend()
         else:
             raise NotImplementedError
 
```

**File**: `src/serena/lsp/lsp_backend.py` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@
 log = logging.getLogger(__name__)
 
 
-class LanguageBackendLSP(LanguageBackend):
+class LSPLanguageBackend(LanguageBackend):
     def __init__(self):
         super().__init__(BuiltinLanguageBackend.LSP.value)
 
```

**File**: `src/serena/olb/olb_jvm_backend.py` (modified, +7/-2)
```diff
@@ -2,15 +2,20 @@
 from typing import TYPE_CHECKING
 
 from serena.jetbrains import launch_coordinator
-from serena.jetbrains.jetbrains_backend import LanguageBackendJetBrains
+from serena.jetbrains.jetbrains_backend import JetBrainsLanguageBackend
 from serena.language_backend import BuiltinLanguageBackend
 
 if TYPE_CHECKING:
     from serena.agent import SerenaAgent
     from serena.repl.facade import ApiScope, Facade
 
 
-class LanguageBackendOraiosJVM(LanguageBackendJetBrains):
+class OraiosJVMLanguageBackend(JetBrainsLanguageBackend):
+    """
+    The Oraios Language Backend (OLB) for JVM-based languages (Java, Kotlin, Groovy).
+    This is a drop-in replacement for the JetBrains backend.
+    """
+
     def __init__(self):
         super().__init__(key=BuiltinLanguageBackend.OLB_JVM.value)
 
```

---

### Incident Patch 2: `7a296833` (2026-09-24)
**Commit Message**: fix(cli): correct duplicated "IS" in ignored-path check output (#2103)

**File**: `src/serena/cli.py` (modified, +1/-1)
```diff
@@ -902,7 +902,7 @@ def is_ignored_path(path: str, project: str) -> None:
         if os.path.isabs(path):
             path = os.path.relpath(path, start=proj.project_root)
         is_ignored = proj.is_ignored_path(path)
-        click.echo(f"Path '{path}' IS {'ignored' if is_ignored else 'IS NOT ignored'} by the project configuration.")
+        click.echo(f"Path '{path}' {'IS' if is_ignored else 'IS NOT'} ignored by the project configuration.")
 
     @staticmethod
     @click.command(
```

---

### Incident Patch 3: `b83b655c` (2026-09-23)
**Commit Message**: fix: zip extract permission bits (#2102)

* Restore Unix executable bits when extracting zip archives

- SafeZipExtractor._extract_member now chmods each extracted file with the
  Unix mode stored in ZipInfo.external_attr (POSIX only, no-op when the
  archive carries no Unix attributes, e.g. Windows-authored zips).
- stdlib zipfile never restores permission bits itself; a fix is tracked
  upstream at https://github.com/python/cpython/pull/150061.
- Fixes archives with more than one executable losing their exec bit after
  extraction, e.g. the bundled JBR inside the Kotlin Language Server
  distribution (jbr/bin/java and native libs), which previously only had
  its single top-level launcher script chmod'd by the language-server code.

Fixes oraios/serena#2100

---------

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>

**File**: `CHANGELOG.md` (modified, +8/-0)
```diff
@@ -107,6 +107,14 @@ Status of the `main` branch. Changes prior to the next official version change w
     thread (#2038)
 
 * Language Servers:
+  - Fix: `SafeZipExtractor` discarded Unix executable permission bits stored in extracted
+    archives' `ZipInfo.external_attr` (a long-standing stdlib `zipfile` limitation,
+    tracked upstream at https://github.com/python/cpython/pull/150061), leaving every
+    extracted file with default, non-executable permissions. This broke language servers
+    whose archive contains more than the single top-level launcher script that
+    per-language-server setup code re-chmods, e.g. the Kotlin Language Server's bundled
+    JetBrains Runtime (`jbr/bin/java` and native libs), whose launcher failed to exec it
+    with a permission error. Executable bits are now restored for every extracted file (#2100)
   - Add Astro language server support via `@astrojs/language-server` with a companion TypeScript language server (`@astrojs/ts-plugin`) for cross-file code intelligence (#2085)
   - Fix: Dart analysis server no longer receives rootUri/rootPath, which added the monorepo root as an extra analysis root and could pin a CPU core at idle (#2045)
   - Fix: The C# language server opened every `.csproj` found anywhere under the repository root,
```

**File**: `src/solidlsp/util/zip.py` (modified, +7/-0)
```diff
@@ -101,6 +101,13 @@ def _extract_member(self, zip_ref: zipfile.ZipFile, member: zipfile.ZipInfo) ->
             with zip_ref.open(member) as source, open(final_path, "wb") as target:
                 target.write(source.read())
 
+            # stdlib zipfile does not restore Unix permission bits on extraction; tracked
+            # upstream at https://github.com/python/cpython/pull/150061
+            if os.name == "posix":
+                unix_mode = member.external_attr >> 16
+                if unix_mode:
+                    os.chmod(final_path, unix_mode)
+
             if self.verbose:
                 log.info(f"Extracted: {member.filename}")
 
```

**File**: `test/solidlsp/util/test_zip.py` (modified, +19/-0)
```diff
@@ -1,3 +1,4 @@
+import os
 import sys
 import zipfile
 from pathlib import Path
@@ -90,6 +91,24 @@ def failing_open(self, member, *args, **kwargs):
     assert (dest_dir / "folder" / "file3.txt").exists()
 
 
+@pytest.mark.skipif(sys.platform.startswith("win"), reason="Unix permission bits are not applicable on Windows")
+def test_restores_executable_permission(tmp_path: Path) -> None:
+    """Executable bits stored in the archive's external_attr should be restored on extraction."""
+    zip_path = tmp_path / "exec.zip"
+    with zipfile.ZipFile(zip_path, "w") as zipf:
+        info = zipfile.ZipInfo("bin/tool")
+        info.external_attr = 0o755 << 16
+        zipf.writestr(info, "#!/bin/sh\necho hi\n")
+
+    dest_dir = tmp_path / "extracted"
+    extractor = SafeZipExtractor(zip_path, dest_dir, verbose=False)
+    extractor.extract_all()
+
+    extracted_file = dest_dir / "bin" / "tool"
+    assert extracted_file.exists()
+    assert os.stat(extracted_file).st_mode & 0o111
+
+
 @pytest.mark.skipif(not sys.platform.startswith("win"), reason="Windows-only test")
 def test_long_path_normalization(temp_zip_file: Path, tmp_path: Path) -> None:
     r"""Ensure _normalize_path adds \\?\\ prefix on Windows."""
```

---

### Incident Patch 4: `637ab7b7` (2026-09-23)
**Commit Message**: Fix AL language server lookup in newer extension layouts (#2087)

The AL adapter built a single executable path with a platform-specific
subdirectory (`bin/win32/...` on Windows) and raised "executable not found"
when it was absent. Compare the two VSIX packages from the marketplace with
the URL the adapter itself uses:

  18.0.2242655 (Serena's pinned version): bin/{win32,linux,darwin}/<host>
  18.0.2732683 (the build reported in #2069):  bin/<host>, no platform subdirectories

decision(al): probe both layouts instead of making the path configurable, since the
  extension build Serena downloads and the one the user has in VS Code differ by design.
constraint(al): keep the platform subdirectory first so existing behaviour is unchanged
  for the pinned version; only a missing executable falls through.
learned(al): neither VSIX declares a targetPlatform, yet the newer package contains no unix or
  darwin binaries at all; why Microsoft changed the packaging is upstream of this fix.

The error message now lists every candidate it tried, so the next layout change upstream is
identifiable from the failure alone rather than by reading the adapter.

Fixes #2069

Co-authored-by: sxh313 <sxh

**File**: `CHANGELOG.md` (modified, +6/-0)
```diff
@@ -192,6 +192,12 @@ Status of the `main` branch. Changes prior to the next official version change w
     symbols, which was applied outside the caches; the processing of language servers that post-process
     symbols (e.g. Go, Nix, Fortran, F#, Vue) was therefore repeated on every request or, if it mutated
     symbols in place, re-applied to already processed cached results
+  - Fix: the AL language server executable was only searched for in a platform-specific subdirectory of
+    the extension's `bin` directory (`bin/win32/...` on Windows). Some AL extension builds (e.g.
+    18.0.2732683, as opposed to the 18.0.2242655 that Serena pins) have no such subdirectories and
+    place the executable directly in `bin`, so activating an AL project failed with "AL Language
+    Server executable not found" for users whose VS Code extension was on such a build. Both layouts
+    are now probed, the platform subdirectory first (#2069)
 
 CLI:
   - Fix `project index-file` command not using only the relevant language server to index the given file (#1965)
```

**File**: `src/solidlsp/language_servers/al_language_server.py` (modified, +26/-14)
```diff
@@ -36,6 +36,9 @@
 DEFAULT_AL_EXTENSION_VERSION = "18.0.2242655"
 DEFAULT_AL_EXTENSION_SHA256 = "3971995e61a59dc4fcce4a65053072a67991ed624a16635c4f2911f12564b2b9"
 
+# Base name of the language server executable within the extension; on Windows it is suffixed with ".exe"
+AL_HOST_EXECUTABLE_NAME = "Microsoft.Dynamics.Nav.EditorServices.Host"
+
 
 def _al_extension_sha(version: str) -> str | None:
     if version == INITIAL_AL_EXTENSION_VERSION:
@@ -188,10 +191,8 @@ def _setup_runtime_dependencies(cls, config: LanguageServerConfig, solidlsp_sett
         3. Configures executable permissions on Unix systems
         4. Returns the properly formatted command string
 
-        The AL Language Server executable is located in different paths based on the platform:
-        - Windows: bin/win32/Microsoft.Dynamics.Nav.EditorServices.Host.exe
-        - Linux: bin/linux/Microsoft.Dynamics.Nav.EditorServices.Host
-        - macOS: bin/darwin/Microsoft.Dynamics.Nav.EditorServices.Host
+        The executable lives in the extension's `bin` directory, whose internal layout depends on
+        the extension version; see `_get_executable_path_candidates`.
         """
         system = platform.system()
 
@@ -209,11 +210,12 @@ def _setup_runtime_dependencies(cls, config: LanguageServerConfig, solidlsp_sett
                 "3. Ensure internet connection for automatic download"
             )
 
-        # Build executable path based on platform
-        executable_path = cls._get_executable_path(extension_path, system)
+        # Build the executable path, tolerating the layouts of the different extension versions
+        candidates = cls._get_executable_path_candidates(extension_path, system)
+        executable_path = next((path for path in candidates if os.path.isfile(path)), None)
 
-        if not os.path.exists(executable_path):
-            raise RuntimeError(f"AL Language Server executable not found at: {executable_path}")
+        if executable_path is None:
+            raise RuntimeError("AL Language Server executable not found. Looked for:\n" + "\n".join(f"  - {path}" for path in candidates))
 
         # Prepare and return the executable command
         return cls._prepare_executable(executable_path, system)
@@ -289,26 +291,36 @@ def _download_and_install_al_extension(cls, solidlsp_settings: SolidLSPSettings)
         return None
 
     @classmethod
-    def _get_executable_path(cls, extension_path: str, system: str) -> str:
+    def _get_executable_path_candidates(cls, extension_path: str, system: str) -> list[str]:
         """
-        Build platform-specific executable path.
+        Build the candidate paths of the language server executable for the given platform.
+
+        The AL extension has shipped the executable in two layouts: in the builds up to at least
+        18.0.2242655 it lies in a platform-specific subdirectory of `bin` (`bin/win32/...exe` on
+        Windows), whereas in build 18.0.2732683 the platform subdirectories are gone and it lies
+        directly in `bin`. Both are queried because the build that Serena downloads and the build
+        that the user has installed in VS Code need not be the same.
 
         Args:
             extension_path: Path to AL extension directory
             system: Operating system name
 
         Returns:
-            Full path to executable
+            Candidate paths to the executable, the platform subdirectory layout first
 
         """
         if system == "Windows":
-            return os.path.join(extension_path, "bin", "win32", "Microsoft.Dynamics.Nav.EditorServices.Host.exe")
+            platform_dir, executable_name = "win32", AL_HOST_EXECUTABLE_NAME + ".exe"
         elif system == "Linux":
-            return os.path.join(extension_path, "bin", "linux", "Microsoft.Dynamics.Nav.EditorServices.Host")
+            platform_dir, executable_name = "linux", AL_HOST_EXECUTABLE_NAME
         elif system == "Darwin":
-            return os.path.join(extension_path
```

**File**: `test/solidlsp/al/test_al_executable_layout.py` (added, +85/-0)
```diff
@@ -0,0 +1,85 @@
+"""Tests for locating the AL language server executable within the VS Code extension.
+
+The AL extension ships the executable in two different directory layouts depending on its build,
+so both must be resolved without downloading the extension (see #2069).
+"""
+
+from pathlib import Path
+from unittest.mock import patch
+
+import pytest
+
+from solidlsp.language_servers.al_language_server import ALLanguageServer
+from solidlsp.ls_config import LanguageServerConfig, LanguageServerId
+from solidlsp.settings import SolidLSPSettings
+
+pytestmark = pytest.mark.al
+
+# the name the AL extension ships in its `bin` directory, independent of Serena's constant
+HOST_EXECUTABLE_NAME = "Microsoft.Dynamics.Nav.EditorServices.Host"
+
+_PLATFORM_SUBDIR = {"Windows": "win32", "Linux": "linux", "Darwin": "darwin"}
+
+
+def _executable_name(system: str) -> str:
+    return HOST_EXECUTABLE_NAME + (".exe" if system == "Windows" else "")
+
+
+def _create_host(extension_root: Path, system: str, *, layout: str) -> Path:
+    """Create a stub executable in either the versioned platform subdirectory or the flat `bin`
+    directory of the given extension root, returning its path.
+    """
+    subdir = _PLATFORM_SUBDIR[system] if layout == "platform-subdir" else ""
+    host_path = extension_root.joinpath("bin", subdir, _executable_name(system))
+    host_path.parent.mkdir(parents=True, exist_ok=True)
+    host_path.write_bytes(b"stub")
+    return host_path
+
+
+def _setup(extension_root: Path, system: str) -> str:
+    with (
+        patch("solidlsp.language_servers.al_language_server.platform.system", return_value=system),
+        patch.object(ALLanguageServer, "_find_al_extension", return_value=str(extension_root)),
+    ):
+        config = LanguageServerConfig(ls_id=LanguageServerId.AL)
+        return ALLanguageServer._setup_runtime_dependencies(config, SolidLSPSettings())
+
+
+@pytest.mark.parametrize("system", sorted(_PLATFORM_SUBDIR))
+@pytest.mark.parametrize("layout", ["platform-subdir", "flat"])
+def test_executable_is_resolved_in_either_extension_layout(tmp_path: Path, system: str, layout: str) -> None:
+    """Regression test for #2069: builds >= 18.0.2732683 place the executable directly in `bin`,
+    while the layout up to 18.0.2242655 keeps it in a platform subdirectory.
+    """
+    host_path = _create_host(tmp_path, system, layout=layout)
+
+    command = _setup(tmp_path, system)
+
+    assert str(host_path) in command
+
+
+@pytest.mark.parametrize("system", sorted(_PLATFORM_SUBDIR))
+def test_platform_subdir_layout_takes_precedence_when_both_are_present(tmp_path: Path, system: str) -> None:
+    flat_host = _create_host(tmp_path, system, layout="flat")
+    versioned_host = _create_host(tmp_path, system, layout="platform-subdir")
+
+    command = _setup(tmp_path, system)
+
+    assert str(versioned_host) in command
+    assert str(flat_host) not in command
+
+
+def test_missing_executable_reports_every_candidate_layout(tmp_path: Path) -> None:
+    with pytest.raises(RuntimeError, match="AL Language Server executable not found") as exc_info:
+        _setup(tmp_path, "Windows")
+
+    message = str(exc_info.value)
+    assert str(tmp_path / "bin" / "win32" / f"{HOST_EXECUTABLE_NAME}.exe") in message
+    assert str(tmp_path / "bin" / f"{HOST_EXECUTABLE_NAME}.exe") in message
+
+
+def test_unsupported_platform_is_rejected(tmp_path: Path) -> None:
+    _create_host(tmp_path, "Windows", layout="flat")
+
+    with pytest.raises(RuntimeError, match="Unsupported platform: FreeBSD"):
+        _setup(tmp_path, "FreeBSD")
```

---

### Incident Patch 5: `d764406a` (2026-09-23)
**Commit Message**: fix(deps): bump PyJWT to 2.13.0, fixing CVE-2026-48526 HMAC key-confusion auth bypass (#2058)

Dependabot-flagged transitive dev dependency, pinned in pyproject.toml's
security-pin block for exactly this reason. Same remedy shape as the
maintainer's own prior pin bumps in this block (e.g. 823d5bbe).

Co-authored-by: Dr. Dominik Jain <dominik.jain@oraios-ai.de>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -199,6 +199,7 @@ CLI:
   - Fix: declare `click` as a direct dependency; all three console scripts (`serena`, `serena-agent`,
     `serena-hooks`) import it but it was only available transitively
   - Remove the redundant `dotenv` dependency; the `dotenv` module is provided by `python-dotenv`
+  - Update `PyJWT` from 2.12.0 to 2.13.0
   - Upgrade the `mcp` SDK from 1.28.1 to 2.2.0
 
 # v1.7.0 (2026-08-09)
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -93,7 +93,7 @@ dev = [
   "tornado==6.5.7",
   "wheel==0.46.3",
   "pyasn1==0.6.4",
-  "PyJWT==2.12.0",
+  "PyJWT==2.13.0",
 ]
 agno = ["agno==2.6.6", "sqlalchemy==2.0.41"]  # agno bumped for session state overwrite CVE
 google = ["google-genai==1.27.0"]
```

**File**: `uv.lock` (modified, +39/-39)
```diff
@@ -428,7 +428,7 @@ name = "clr-loader"
 version = "0.3.1"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
-    { name = "cffi", marker = "python_full_version < '3.13' or sys_platform == 'win32'" },
+    { name = "cffi" },
 ]
 sdist = { url = "https://files.pythonhosted.org/packages/e4/46/7eea92b6aa2d68af78e049cbecec5f757f1aad44ecdecdc16bbad7eead51/clr_loader-0.3.1.tar.gz", hash = "sha256:2e073e9aaf49d1ae2f56ecba27987ad5fb68be4bcd9dd34a5bed8f0e4e128366", size = 86805, upload-time = "2026-04-18T17:49:44.287Z" }
 wheels = [
@@ -951,17 +951,17 @@ resolution-markers = [
     "python_full_version < '3.12'",
 ]
 dependencies = [
-    { name = "colorama", marker = "python_full_version < '3.12' and sys_platform == 'win32'" },
-    { name = "decorator", marker = "python_full_version < '3.12'" },
-    { name = "ipython-pygments-lexers", marker = "python_full_version < '3.12'" },
-    { name = "jedi", marker = "python_full_version < '3.12'" },
-    { name = "matplotlib-inline", marker = "python_full_version < '3.12'" },
-    { name = "pexpect", marker = "python_full_version < '3.12' and sys_platform != 'emscripten' and sys_platform != 'win32'" },
-    { name = "prompt-toolkit", marker = "python_full_version < '3.12'" },
-    { name = "pygments", marker = "python_full_version < '3.12'" },
-    { name = "stack-data", marker = "python_full_version < '3.12'" },
-    { name = "traitlets", marker = "python_full_version < '3.12'" },
-    { name = "typing-extensions", marker = "python_full_version < '3.12'" },
+    { name = "colorama", marker = "sys_platform == 'win32'" },
+    { name = "decorator" },
+    { name = "ipython-pygments-lexers" },
+    { name = "jedi" },
+    { name = "matplotlib-inline" },
+    { name = "pexpect", marker = "sys_platform != 'emscripten' and sys_platform != 'win32'" },
+    { name = "prompt-toolkit" },
+    { name = "pygments" },
+    { name = "stack-data" },
+    { name = "traitlets" },
+    { name = "typing-extensions" },
 ]
 sdist = { url = "https://files.pythonhosted.org/packages/c5/25/daae0e764047b0a2480c7bbb25d48f4f509b5818636562eeac145d06dfee/ipython-9.10.1.tar.gz", hash = "sha256:e170e9b2a44312484415bdb750492699bf329233b03f2557a9692cce6466ada4", size = 4426663, upload-time = "2026-03-27T09:53:26.244Z" }
 wheels = [
@@ -980,16 +980,16 @@ resolution-markers = [
     "python_full_version == '3.12.*'",
 ]
 dependencies = [
-    { name = "colorama", marker = "python_full_version >= '3.12' and sys_platform == 'win32'" },
-    { name = "decorator", marker = "python_full_version >= '3.12'" },
-    { name = "ipython-pygments-lexers", marker = "python_full_version >= '3.12'" },
-    { name = "jedi", marker = "python_full_version >= '3.12'" },
-    { name = "matplotlib-inline", marker = "python_full_version >= '3.12'" },
-    { name = "pexpect", marker = "python_full_version >= '3.12' and sys_platform != 'emscripten' and sys_platform != 'win32'" },
-    { name = "prompt-toolkit", marker = "python_full_version >= '3.12'" },
-    { name = "pygments", marker = "python_full_version >= '3.12'" },
-    { name = "stack-data", marker = "python_full_version >= '3.12'" },
-    { name = "traitlets", marker = "python_full_version >= '3.12'" },
+    { name = "colorama", marker = "sys_platform == 'win32'" },
+    { name = "decorator" },
+    { name = "ipython-pygments-lexers" },
+    { name = "jedi" },
+    { name = "matplotlib-inline" },
+    { name = "pexpect", marker = "sys_platform != 'emscripten' and sys_platform != 'win32'" },
+    { name = "prompt-toolkit" },
+    { name = "pygments" },
+    { name = "stack-data" },
+    { name = "traitlets" },
 ]
 sdist = { url = "https://files.pythonhosted.org/packages/3a/73/7114f80a8f9cabdb13c27732dce24af945b2923dcab80723602f7c8bc2d8/ipython-9.12.0.tar.gz", hash = "sha256:01daa83f504b693ba523b5a407246cabde4eb4513285a3c6acaff11a66735ee4", size = 4428879, upload-time = "2026-03-27T09:42:45.312Z" }
 wheels = [
@@ -1672,7 +1672,7 @@ name = "pexpect"
 version = "4.9.0"
 sour
```

---

### Incident Patch 6: `a4dff9e0` (2026-09-23)
**Commit Message**: fix(typescript): prefer the src subtree over an adjacent tool config when warming up an additional workspace (#2097)

TypeScriptLanguageServer._find_representative_source_file scanned files directly
adjacent to tsconfig.json before checking a src/ subdirectory, so a same-level tool
config that the tsconfig excludes (vitest.config.ts, jest.config.ts, etc.) could be
picked as the file used to trigger project activation for an additional workspace
folder. The wrong inferred TypeScript project then loads, and cross-package
find_referencing_symbols queries silently return {} instead of raising or warning.

Reorder the scan to walk the src/ subtree first (recursively, respecting the usual
ignored-directory rules) and only fall back to a same-level file when no src/
directory exists, matching the fallback the reporter's issue proposed.

Fixes #2090

Signed-off-by: Amir Fathi <amirfathi.me@gmail.com>

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -130,6 +130,10 @@ Status of the `main` branch. Changes prior to the next official version change w
     VTS initialization options now override defaults per top-level key rather than replacing the
     entire configuration; a user-provided `typescript` block replaces the ATA default too.
     `initializationOptions` takes precedence over the legacy `initialization_options` alias.
+  - Fix: activating an additional TypeScript workspace folder could open a root-level tool
+    config (`vitest.config.ts`, `jest.config.ts`, etc.) adjacent to `tsconfig.json` instead of
+    a real source file, starting the wrong inferred project and silently losing cross-package
+    references (#2090)
   - Fix: a C# file created after the project was already indexed was analyzed by Roslyn as a
     standalone Miscellaneous Files document instead of being folded into the loaded project,
     causing phantom diagnostics on the new file and on files referencing its symbols (#1961)
```

**File**: `src/solidlsp/language_servers/typescript_language_server.py` (modified, +12/-7)
```diff
@@ -516,20 +516,25 @@ def progress_handler(params: dict) -> None:
     def _find_representative_source_file(self, directory: str) -> str | None:
         """Find a TypeScript file suitable for triggering project loading.
 
-        Prefers a file adjacent to tsconfig.json (indicating the project root),
-        then falls back to the first .ts/.tsx file found.
+        Prefers a file under a `src` subdirectory adjacent to tsconfig.json (the
+        conventional source root), so a root-level tool config that tsconfig excludes
+        (vitest.config.ts, jest.config.ts, etc.) is not picked over the project's real
+        source tree. Falls back to a file directly adjacent to tsconfig.json, then to
+        the first .ts/.tsx file found anywhere in the directory.
         """
         for root, dirs, files in os.walk(directory):
             dirs[:] = [d for d in dirs if not self.is_ignored_dirname(d)]
             if "tsconfig.json" in files:
+                src_dir = os.path.join(root, "src")
+                if os.path.isdir(src_dir):
+                    for src_root, src_dirs, src_files in os.walk(src_dir):
+                        src_dirs[:] = [d for d in src_dirs if not self.is_ignored_dirname(d)]
+                        for f in src_files:
+                            if f.endswith((".ts", ".tsx")) and not f.endswith(".d.ts"):
+                                return os.path.join(src_root, f)
                 for f in files:
                     if f.endswith((".ts", ".tsx")) and not f.endswith(".d.ts"):
                         return os.path.join(root, f)
-                src_dir = os.path.join(root, "src")
-                if os.path.isdir(src_dir):
-                    for f in os.listdir(src_dir):
-                        if f.endswith((".ts", ".tsx")) and not f.endswith(".d.ts"):
-                            return os.path.join(src_dir, f)
 
         for root, dirs, files in os.walk(directory):
             dirs[:] = [d for d in dirs if not self.is_ignored_dirname(d)]
```

**File**: `test/solidlsp/test_typescript_representative_source_file.py` (added, +68/-0)
```diff
@@ -0,0 +1,68 @@
+"""Regression test for oraios/serena#2090: additional-workspace activation must not pick a
+root-level tool config (vitest.config.ts, jest.config.ts, ...) adjacent to tsconfig.json over
+the project's actual source tree.
+
+Exercises TypeScriptLanguageServer._find_representative_source_file directly against a real
+filesystem layout, without spawning a language server process; same technique as
+test_typescript_timeout_policy.py's _bare_ts_server.
+"""
+
+from solidlsp.language_servers.typescript_language_server import TypeScriptLanguageServer
+
+
+def _bare_ts_server() -> TypeScriptLanguageServer:
+    return object.__new__(TypeScriptLanguageServer)
+
+
+class TestFindRepresentativeSourceFile:
+    def test_prefers_nested_src_file_over_adjacent_tool_config(self, tmp_path) -> None:
+        """The issue's own minimal layout: a tsconfig-adjacent vitest.config.ts must lose to a
+        real source file nested under src/, even when that source file is not directly inside
+        src/ itself (it is one level further down, under src/routes/).
+        """
+        pkg = tmp_path / "apps" / "api"
+        routes = pkg / "src" / "routes"
+        routes.mkdir(parents=True)
+        (pkg / "tsconfig.json").write_text("{}")
+        (pkg / "vitest.config.ts").write_text("export default {};")
+        (routes / "money.ts").write_text("export const x = 1;")
+
+        result = _bare_ts_server()._find_representative_source_file(str(tmp_path))
+
+        assert result == str(routes / "money.ts")
+
+    def test_falls_back_to_adjacent_file_when_no_src_dir_exists(self, tmp_path) -> None:
+        """Projects with source files directly next to tsconfig.json (no src/ subdirectory)
+        must keep working exactly as before.
+        """
+        pkg = tmp_path / "pkg"
+        pkg.mkdir()
+        (pkg / "tsconfig.json").write_text("{}")
+        (pkg / "index.ts").write_text("export const x = 1;")
+
+        result = _bare_ts_server()._find_representative_source_file(str(tmp_path))
+
+        assert result == str(pkg / "index.ts")
+
+    def test_ignores_node_modules_under_src(self, tmp_path) -> None:
+        """The src/ subtree walk must still respect is_ignored_dirname, or a vendored .ts file
+        under src/node_modules could be selected instead of real project source.
+        """
+        pkg = tmp_path / "pkg"
+        vendored = pkg / "src" / "node_modules" / "dep"
+        real_src = pkg / "src" / "lib"
+        vendored.mkdir(parents=True)
+        real_src.mkdir(parents=True)
+        (pkg / "tsconfig.json").write_text("{}")
+        (pkg / "vitest.config.ts").write_text("export default {};")
+        (vendored / "vendored.ts").write_text("export const y = 1;")
+        (real_src / "app.ts").write_text("export const x = 1;")
+
+        result = _bare_ts_server()._find_representative_source_file(str(tmp_path))
+
+        assert result == str(real_src / "app.ts")
+
+    def test_returns_none_when_nothing_matches(self, tmp_path) -> None:
+        (tmp_path / "README.md").write_text("no typescript here")
+
+        assert _bare_ts_server()._find_representative_source_file(str(tmp_path)) is None
```

---

### Incident Patch 7: `714c260e` (2026-09-23)
**Commit Message**: fix(csharp): fold newly created files into the loaded Roslyn project (#1981)

* fix(csharp): fold newly created files into the loaded Roslyn project

Roslyn only learns which files belong to a project from the
solution/open and project/open notifications _open_solution_and_projects
sends once at startup. The generic didChangeWatchedFiles/open-close cycle
that poll_and_notify sends for every backend on file creation does not
make it re-evaluate the project, so a .cs file created after the project
was already indexed stayed a standalone Miscellaneous Files document,
producing phantom diagnostics (e.g. an incorrect "using directive is
unnecessary") instead of the real ones.

Add an overridable SolidLanguageServer.notify_files_created hook, called
by LanguageServerFileChangeNotifier.poll_and_notify before it opens newly
created files. CSharpLanguageServer overrides it to resend the same
solution/project notifications and wait for Roslyn's own reload-complete
log line before the file is opened; every other backend keeps its current
behavior via the no-op default.

Fixes #1961

* fix(test): use get_language_server_manager_or_raise in csharp fold test

project.language_server_manager is t

**File**: `CHANGELOG.md` (modified, +3/-0)
```diff
@@ -130,6 +130,9 @@ Status of the `main` branch. Changes prior to the next official version change w
     VTS initialization options now override defaults per top-level key rather than replacing the
     entire configuration; a user-provided `typescript` block replaces the ATA default too.
     `initializationOptions` takes precedence over the legacy `initialization_options` alias.
+  - Fix: a C# file created after the project was already indexed was analyzed by Roslyn as a
+    standalone Miscellaneous Files document instead of being folded into the loaded project,
+    causing phantom diagnostics on the new file and on files referencing its symbols (#1961)
   - Add FreeBSD mapping to platform detection
   - Remove unnecessary platform checks from the following language servers, expanding the set of
     supported platforms accordingly: Elixir Tools, Intelephense, Perl, TypeScript, VTS
```

**File**: `src/serena/ls_manager.py` (modified, +9/-3)
```diff
@@ -366,9 +366,15 @@ def poll_and_notify(self) -> int:
             # (observed with pyright) to fold a brand-new file into its cross-file reference graph;
             # an open/close cycle forces the parse+bind that Serena's own file tools trigger via
             # SolidLanguageServer.open_file().
-            for rel_path in created_paths:
-                if ls.is_ignored_path(rel_path, ignore_unsupported_files=True):
-                    continue
+            relevant_created_paths = [
+                rel_path for rel_path in created_paths if not ls.is_ignored_path(rel_path, ignore_unsupported_files=True)
+            ]
+            if relevant_created_paths:
+                try:
+                    ls.notify_files_created(relevant_created_paths)
+                except Exception as e:
+                    log.error("Failed to notify language server of newly created files", exc_info=e)
+            for rel_path in relevant_created_paths:
                 try:
                     with ls.open_file(rel_path):
                         pass
```

**File**: `src/solidlsp/language_servers/csharp_language_server.py` (modified, +26/-1)
```diff
@@ -9,7 +9,7 @@
 import shutil
 import tempfile
 import threading
-from collections.abc import Hashable, Iterable
+from collections.abc import Hashable, Iterable, Sequence
 from dataclasses import replace
 from pathlib import Path
 from typing import Any, cast
@@ -223,6 +223,9 @@ def __init__(self, config: LanguageServerConfig, repository_root_path: str, soli
         # Cache for original Roslyn symbol names with type annotations
         # Key: (relative_file_path, line, character) -> Value: original name
         self._original_symbol_names: dict[tuple[str, int, int], str] = {}
+        # Set once Roslyn confirms it finished (re)loading the solution/projects; reused by
+        # notify_files_created to wait out a reload triggered after startup.
+        self._project_reload_complete = threading.Event()
 
     def _create_dependency_provider(self) -> LanguageServerDependencyProvider:
         return self.DependencyProvider(self._custom_settings, self._ls_resources_dir, self._solidlsp_settings, self.repository_root_path)
@@ -553,6 +556,12 @@ def window_log_message(msg: dict) -> None:
 
             log.log(level_map.get(level, logging.DEBUG), f"LSP: {message_text}")
 
+            # workspace/projectInitializationComplete (below) fires too early on a project
+            # *re*-open to signal reload completion; this log line is the reliable one for
+            # notify_files_created's wait.
+            if "Completed (re)load of all projects" in message_text:
+                self._project_reload_complete.set()
+
         def handle_progress(params: dict) -> None:
             """Handle progress notifications from the language server."""
             token = params.get("token", "")
@@ -776,3 +785,19 @@ def _open_solution_and_projects(self) -> None:
     @override
     def _get_wait_time_for_cross_file_referencing(self) -> float:
         return 2
+
+    @override
+    def notify_files_created(self, relative_file_paths: Sequence[str]) -> None:
+        """
+        Roslyn's project system only learns which files belong to a project from the
+        `solution/open`/`project/open` notifications sent once at startup (see
+        `_open_solution_and_projects`); a plain `didChangeWatchedFiles`/open-close cycle
+        does not make it re-evaluate the project, so a file created after startup is
+        analyzed as a standalone Miscellaneous Files document instead of being folded into
+        the already-loaded compilation. Resend the same notifications and wait for the
+        server to confirm the reload before the file is opened.
+        """
+        self._project_reload_complete.clear()
+        self._open_solution_and_projects()
+        if not self._project_reload_complete.wait(30):
+            log.warning("Timeout waiting for project reload after new file(s) were created: %s", list(relative_file_paths))
```

**File**: `src/solidlsp/ls.py` (modified, +11/-1)
```diff
@@ -10,7 +10,7 @@
 import threading
 from abc import ABC, abstractmethod
 from collections import defaultdict
-from collections.abc import Callable, Hashable, Iterator
+from collections.abc import Callable, Hashable, Iterator, Sequence
 from contextlib import contextmanager
 from copy import copy
 from dataclasses import dataclass
@@ -1045,6 +1045,16 @@ def _get_wait_time_for_cross_file_referencing(self) -> float:
         """
         return 2
 
+    def notify_files_created(self, relative_file_paths: Sequence[str]) -> None:
+        """
+        Called when one or more files were newly created on disk (detected outside of Serena's own file
+        tools, e.g. by :class:`serena.ls_manager.LanguageServerFileChangeNotifier`), before those files are
+        opened via :meth:`open_file`. The default implementation does nothing: a `didChangeWatchedFiles`
+        notification followed by an open/close cycle is enough for most backends to fold a new file into
+        their index. Override this for a language server whose project system needs an explicit reload to
+        become aware of a file that did not exist when the project was first loaded.
+        """
+
     # --- Cross-workspace / additional workspace folder support ---
 
     @staticmethod
```

**File**: `test/serena/test_ls_file_sync.py` (modified, +44/-0)
```diff
@@ -3,6 +3,7 @@
 
 Exercises all three ``FileChangeType`` branches against a real pyright backend:
 Created (new caller file), Changed (append a second caller), Deleted (remove the caller file).
+Also covers a Roslyn-specific Created regression (test_new_csharp_file_is_folded_into_compilation).
 """
 
 import json
@@ -192,3 +193,46 @@ def test_find_symbol_tool_reflects_external_change_to_open_buffer(tmp_path):
     of Serena's own edit tools.
     """
     SymbolPositionStaleAfterExternalEditTestCase().run(tmp_path)
+
+
+@pytest.mark.csharp
+def test_new_csharp_file_is_folded_into_compilation(tmp_path):
+    """
+    Regression test for oraios/serena#1961: a .cs file created after the project has already
+    been indexed used to stay a standalone Miscellaneous Files document to Roslyn, since the
+    generic didChangeWatchedFiles/open-close cycle that poll_and_notify sends for every backend
+    is not enough to make Roslyn's project system re-evaluate which files belong to the already-
+    loaded .csproj. The tell is a phantom 'Using directive is unnecessary' (IDE0005) on a using
+    the new file genuinely needs, since Roslyn cannot resolve the type it imports.
+    """
+    repo_root = tmp_path / "repo"
+    shutil.copytree(get_repo_path(LanguageServerId.CSHARP), repo_root)
+    new_file_rel = "UsesPerson.cs"
+    new_file_abs = repo_root / new_file_rel
+
+    with agent_for_project_context(LanguageServerId.CSHARP, str(repo_root)) as agent:
+        project = agent.get_active_project_or_raise()
+        ls = next(iter(agent.get_language_server_manager_or_raise().iter_language_servers()))
+
+        new_file_abs.write_text(
+            "using TestProject.Models;\n\n"
+            "namespace TestProject;\n\n"
+            "public class UsesPerson\n"
+            "{\n"
+            "    public Person Get() => new Person();\n"
+            "}\n",
+            encoding="utf-8",
+        )
+        assert project.ls_sync_file_system_changes() == 1, "expected exactly one Created event"
+
+        diagnostics = ls.request_text_document_diagnostics(new_file_rel, min_severity=4)
+        messages = [d["message"] for d in diagnostics]
+
+        assert not any("unnecessary" in m.lower() for m in messages), (
+            f"new file was analyzed as a standalone document instead of being folded into the "
+            f"already-loaded project (phantom 'using directive is unnecessary'): {messages}"
+        )
+        assert any("Person" in m and "name" in m for m in messages), (
+            f"expected the real compiler diagnostic for the missing Person(name, age, email) "
+            f"argument, which only fires once the file is actually part of the compilation: {messages}"
+        )
```

---

### Incident Patch 8: `cf54869a` (2026-09-23)
**Commit Message**: fix(typescript): drain in-flight indexing on later cross-file queries (#1978)

_wait_for_cross_file_references_if_needed latched after the first cross-file
query and never waited again, even when a later query opened a file from a
project tsserver had not loaded yet and started a fresh $/progress cycle.
find_referencing_symbols and find_references would then return whatever
tsserver had indexed so far, silently partial, with nothing distinguishing it
from a complete answer.

The latch still covers the first query's start-grace wait unchanged. A later
query now also checks whether a progress token is currently active and, if
so, waits for it to drain before returning.

Fixes #1937

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -141,6 +141,10 @@ Status of the `main` branch. Changes prior to the next official version change w
     `(int X, string Y)`, had their name corrupted to include a trailing `:` because the
     parenthesis in the type was mistaken for a method's parameter list; `find_symbol` on
     the real name then returned nothing
+  - Fix: TypeScript's `_has_waited_for_cross_file_references` latch was set after the first
+    cross-file query and never reset, so a later query that opened a file from a project tsserver
+    had not loaded yet (e.g. a monorepo package) skipped the indexing wait even while that
+    project's own `$/progress` indexing was still in flight (#1937)
   - Fix: Nextflow's `_flush_deferred_workspace_scan` marked the workspace scan flushed even when both
     of its `completion` probes failed, permanently skipping the flush (and silencing retries) for the
     rest of the session (#1871)
```

**File**: `src/solidlsp/language_servers/typescript_language_server.py` (modified, +16/-5)
```diff
@@ -575,18 +575,29 @@ def _pre_open_for_cross_file_references(self) -> None:
 
     @override
     def _wait_for_cross_file_references_if_needed(self) -> None:
-        if self._has_waited_for_cross_file_references:
+        timeout = self._get_indexing_timeout()
+        if not self._has_waited_for_cross_file_references:
+            start_grace = self._get_indexing_start_grace()
+            self._log_cross_file_indexing_wait_outcome(
+                self._wait_for_indexing_start_or_completion(timeout=timeout, start_grace=start_grace), timeout
+            )
+            self._has_waited_for_cross_file_references = True
             return
 
-        timeout = self._get_indexing_timeout()
-        start_grace = self._get_indexing_start_grace()
-        if self._wait_for_indexing_start_or_completion(timeout=timeout, start_grace=start_grace):
+        # The latch above only covers the first query; a later one can still open a file from a
+        # project tsserver has not loaded before, starting a fresh $/progress cycle to drain.
+        with self._progress_lock:
+            indexing_in_progress = bool(self._active_progress_tokens)
+        if indexing_in_progress:
+            self._log_cross_file_indexing_wait_outcome(self.wait_for_indexing(timeout=timeout), timeout)
+
+    def _log_cross_file_indexing_wait_outcome(self, completed: bool, timeout: float) -> None:
+        if completed:
             log.info("TypeScript cross-file indexing complete")
         else:
             log.warning(
                 "TypeScript cross-file indexing did not complete within %.0fs; proceeding (%s)", timeout, self.describe_indexing_state()
             )
-        self._has_waited_for_cross_file_references = True
 
     @override
     def _get_preferred_definition(self, definitions: list[ls_types.Location]) -> ls_types.Location:
```

**File**: `test/solidlsp/test_typescript_timeout_policy.py` (modified, +36/-0)
```diff
@@ -284,6 +284,42 @@ def test_second_call_is_a_noop_regardless_of_grace(self) -> None:
         server._wait_for_cross_file_references_if_needed()
         assert time.monotonic() - start < 0.1
 
+    def test_second_call_drains_a_progress_token_already_in_flight(self) -> None:
+        """oraios/serena#1937: a later cross-file query can open a file from a project tsserver
+        has not loaded yet (e.g. a monorepo package), starting a fresh $/progress cycle. The
+        once-only latch must not let that query return while the fresh token is still active.
+        """
+        server = _bare_ts_server(TypeScriptLanguageServer, {"indexing_start_grace": 0.05})
+        server._has_waited_for_cross_file_references = True
+        server._active_progress_tokens.add("tsserver/project-b-load")
+        server._indexing_complete.clear()
+
+        def _drain_shortly() -> None:
+            time.sleep(0.2)
+            with server._progress_lock:
+                server._active_progress_tokens.discard("tsserver/project-b-load")
+                server._indexing_complete.set()
+
+        threading.Thread(target=_drain_shortly, daemon=True).start()
+
+        start = time.monotonic()
+        server._wait_for_cross_file_references_if_needed()
+        elapsed = time.monotonic() - start
+
+        # proves the wait actually blocked for the still-active token, not a fast no-op return
+        assert elapsed >= 0.15
+        assert server._active_progress_tokens == set()
+
+    def test_second_call_proceeds_on_timeout_while_a_token_never_drains(self) -> None:
+        server = _bare_ts_server(TypeScriptLanguageServer, {"indexing_timeout": 0.05})
+        server._has_waited_for_cross_file_references = True
+        server._active_progress_tokens.add("tsserver/project-b-load")
+        server._indexing_complete.clear()
+
+        server._wait_for_cross_file_references_if_needed()  # must log and return, not raise or hang
+
+        assert server._active_progress_tokens == {"tsserver/project-b-load"}
+
 
 class _FakeSolidLSPSettings:
     """Minimal settings stand-in: returns a fixed TypeScript indexing_timeout so the guard tests can
```

---

### Incident Patch 9: `9f19a79a` (2026-09-21)
**Commit Message**: fix(dart): omit rootUri/rootPath (#2045) (#2051)

The Dart analysis server treats rootUri as an additional analysis root on top of
workspaceFolders, with no de-duplication, so on a monorepo root the whole tree is
analysed and the server burns CPU at idle. Always omit rootUri/rootPath and rely on
workspaceFolders alone.

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -104,6 +104,7 @@ Status of the `main` branch. Changes prior to the next official version change w
     thread (#2038)
 
 * Language Servers:
+  - Fix: Dart analysis server no longer receives rootUri/rootPath, which added the monorepo root as an extra analysis root and could pin a CPU core at idle (#2045)
   - Fix: The C# language server opened every `.csproj` found anywhere under the repository root,
     without consulting the project's ignore settings. On repositories that vendor third-party or
     sample C# projects, this loads projects the server cannot restore on every start, and their
```

**File**: `src/solidlsp/initialize_params.py` (modified, +16/-3)
```diff
@@ -40,10 +40,11 @@ def build(self) -> InitializeParams:
 
 
 class DefaultInitializeParamsBuilder(InitializeParamsBuilder):
-    def __init__(self, ls: "SolidLanguageServer", set_workspace_folders: bool = True):
+    def __init__(self, ls: "SolidLanguageServer", set_workspace_folders: bool = True, set_root_uri: bool = True):
         super().__init__()
         self._ls = ls
         self._set_workspace_folders = set_workspace_folders
+        self._set_root_uri = set_root_uri
 
     @staticmethod
     def _create_workspace_folder_entry(path: str) -> WorkspaceFolder:
@@ -54,10 +55,22 @@ def _apply_updates(self):
         root_abs_path = self._ls.repository_root_path
 
         self._set("processId", os.getpid())
-        self._set("rootPath", root_abs_path)
-        self._set("rootUri", pathlib.Path(root_abs_path).as_uri())
         self._set("clientInfo", {"name": "Serena"})
 
+        # Some language servers treat rootUri as an additional analysis root on top of
+        # workspaceFolders, with no de-duplication, which can cause unbounded indexing.
+        # When set_root_uri is False, rootUri/rootPath are omitted so that workspaceFolders
+        # alone determine the analysis roots.
+        if self._set_root_uri:
+            self._set("rootPath", root_abs_path)
+            self._set("rootUri", pathlib.Path(root_abs_path).as_uri())
+        else:
+            # Some servers reject initialize when the key is absent
+            # ("params.rootUri must not be undefined"). Send explicit null so the
+            # field is present but not used as an analysis root (#2045).
+            self._set("rootPath", None)
+            self._set("rootUri", None)
+
         if self._set_workspace_folders:
             abs_workspace_paths = self._ls.config.get_absolute_workspace_folders(root_abs_path)
             log.info("Workspace folders: %s", abs_workspace_paths)
```

**File**: `src/solidlsp/language_servers/dart_language_server.py` (modified, +8/-0)
```diff
@@ -7,6 +7,7 @@
 
 from overrides import override
 
+from solidlsp.initialize_params import DefaultInitializeParamsBuilder, InitializeParamsBuilder
 from solidlsp.ls import RawDocumentSymbol, SolidLanguageServer
 from solidlsp.lsp_protocol_handler.server import ProcessLaunchInfo
 from solidlsp.settings import SolidLSPSettings
@@ -73,6 +74,13 @@ def __init__(self, config: LanguageServerConfig, repository_root_path: str, soli
         # via either notification it sends for this (see _start_server).
         self.analysis_complete = threading.Event()
 
+    def _create_initialize_params_builder(self) -> InitializeParamsBuilder:
+        # The Dart analysis server treats rootUri as an additional analysis root on top of
+        # workspaceFolders, with no de-duplication, so on a monorepo root that is not a Dart
+        # package the whole tree is analysed and the server burns CPU at idle (oraios/serena#2045).
+        # Omit rootUri/rootPath and rely on workspaceFolders alone.
+        return DefaultInitializeParamsBuilder(self, set_root_uri=False)
+
     @override
     def _document_symbols_cache_fingerprint(self) -> Hashable:
         normalize_symbol_name_version = 1
```

**File**: `test/solidlsp/test_dart_root_uri.py` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+# SPDX-License-Identifier: MIT
+
+import tempfile
+from pathlib import Path
+
+from solidlsp.language_servers.dart_language_server import DartLanguageServer
+
+
+def _make_dart_ls() -> DartLanguageServer:
+    ls = object.__new__(DartLanguageServer)
+    ls._custom_settings = {}
+    # Windows: as_uri() rejects drive-less paths like "/tmp/..."
+    project_dir = Path(tempfile.mkdtemp(prefix="fake-dart-project-")) / "project"
+    project_dir.mkdir(parents=True, exist_ok=True)
+    ls.repository_root_path = str(project_dir)
+
+    class _Cfg:
+        @staticmethod
+        def get_absolute_workspace_folders(root):
+            return [root]
+
+        @staticmethod
+        def get_absolute_additional_workspace_folders(root):
+            return []
+
+    ls.config = _Cfg()
+    # custom_settings property reads from _custom_settings on SolidLanguageServer
+    return ls
+
+
+def test_dart_omits_root_uri():
+    builder = _make_dart_ls()._create_initialize_params_builder()
+    params = builder.build()
+    # rootUri must be present (some servers reject an undefined key) but null, so that only
+    # workspaceFolders determine the analysis roots (oraios/serena#2045).
+    assert params["rootUri"] is None
+    assert params["rootPath"] is None
+    assert params["workspaceFolders"]
```

**File**: `test/solidlsp/test_initialize_params_root_uri.py` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+# SPDX-License-Identifier: MIT
+
+import tempfile
+from pathlib import Path
+
+from solidlsp.initialize_params import DefaultInitializeParamsBuilder
+
+
+class _FakeLS:
+    # Windows: as_uri() rejects drive-less paths like "/tmp/..."
+    repository_root_path = str(Path(tempfile.mkdtemp(prefix="fake-project-")) / "root")
+
+    class config:
+        @staticmethod
+        def get_absolute_workspace_folders(root):
+            return [root]
+
+        @staticmethod
+        def get_absolute_additional_workspace_folders(root):
+            return []
+
+    custom_settings: dict = {}
+
+
+def test_default_builder_sets_root_uri():
+    builder = DefaultInitializeParamsBuilder(_FakeLS())
+    params = builder.build()
+    assert "rootUri" in params
+    assert "rootPath" in params
+
+
+def test_builder_sends_null_root_uri_when_disabled():
+    builder = DefaultInitializeParamsBuilder(_FakeLS(), set_root_uri=False)
+    params = builder.build()
+    # keys must be present (some servers reject an undefined rootUri); values are null
+    assert params["rootUri"] is None
+    assert params["rootPath"] is None
+    assert params["processId"] is not None
+    assert params["clientInfo"] == {"name": "Serena"}
```

---

### Incident Patch 10: `24068f7b` (2026-09-21)
**Commit Message**: Stop a tool-context memory rename from aborting on read-only memories (#2081)

Rename propagation
* `rename_memory_and_propagate_references` enumerated `get_full_list()`, which
  includes the memories matched by `read_only_memory_patterns`.
* Writing one of those raises `PermissionError` in `_check_write_access`, so a
  rename of a memory that was referenced from a read-only memory failed *after*
  `move_memory` had already applied the rename.
* The memory graph was then half-updated: the renamed memory existed under its
  new name while the writable referrers still held `mem:OLD_NAME`, and retrying
  the rename failed with "Memory not found".

Fix
* In a tool context, propagate only into the memories that accept writes, sorted
  to keep the enumeration order that `get_full_list()` provided.
* Outside a tool context nothing changes, so read-only memories are still updated
  when the user renames through the CLI.
* A reference which thereby remains in a read-only memory is still reported as
  stale by `validate_referential_integrity`, so it is not hidden.

Documentation
* `docs/02-usage/045_memories.md` promised that the tool rewrites every reference across all
  memories. That is n

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -76,6 +76,10 @@ Status of the `main` branch. Changes prior to the next official version change w
     the write could destroy the previous, valid content instead of just losing the update. Both now
     write through a temp-file-plus-`os.replace` helper, matching the approach `save_yaml()` already
     uses for settings files (#1958)
+  - Fix: renaming a memory through the `rename_memory` tool raised `PermissionError` when another memory
+    marked read-only by `read_only_memory_patterns` referenced it, after the rename had already been
+    applied, leaving the memory graph half-updated; reference propagation in tool contexts now covers
+    only writable memories, as documented, while the CLI still propagates into read-only ones
 
 * JetBrains:
   - Fix: Concurrent Serena sessions activating different projects at the same time with
```

**File**: `docs/02-usage/045_memories.md` (modified, +3/-1)
```diff
@@ -80,7 +80,9 @@ This convention has two practical consequences:
 
 - **Renames keep references intact.** When you rename or move a memory with the `rename_memory`
   tool, Serena rewrites every `` `mem:OLD_NAME` `` occurrence across all memories to point to
-  the new name. References that do not use the `mem:` prefix will not be updated automatically.
+  the new name, except in memories matched by `read_only_memory_patterns`, which the agent cannot
+  write; `serena memories check` reports such a reference as stale.
+  References that do not use the `mem:` prefix will not be updated automatically.
 - **Integrity checks** (see [below](memory-cli)) report any `` `mem:NAME` `` whose target does
   not resolve to an existing memory, and propose similarly-named candidates as likely intended
   targets.
```

**File**: `src/serena/memories/memory_manager.py` (modified, +15/-5)
```diff
@@ -348,22 +348,32 @@ def move_memory(self, old_name: str, new_name: str, is_tool_context: bool) -> st
 
     def rename_memory_and_propagate_references(self, old_name: str, new_name: str, is_tool_context: bool) -> tuple[str, int]:
         """
-        Renames a memory and updates every ``mem:OLD_NAME`` reference across all memories.
+        Renames a memory and updates every ``mem:OLD_NAME`` reference in the memories which
+        accept writes in the given context.
 
         Memories whose content does not contain a reference to ``old_name`` are left
-        untouched (no spurious mtime changes). Memories that do are rewritten via
-        :meth:`save_memory`.
+        untouched (no spurious mtime changes); those that do are rewritten via
+        :meth:`save_memory`. References in a memory which does not accept writes (a read-only
+        memory in a tool context) are not affected and remain reported as stale by
+        :meth:`validate_referential_integrity`.
 
         :param old_name: the current memory name (the source of the rename)
         :param new_name: the target memory name
         :param is_tool_context: forwarded to :meth:`save_memory` for read-only enforcement
         :return: a tuple of (rename message returned by :meth:`move_memory`, total number of
-            ``mem:`` reference occurrences rewritten across all memories).
+            ``mem:`` reference occurrences rewritten in those memories).
         """
         renaming_message = self.move_memory(old_name, new_name, is_tool_context=is_tool_context)
 
+        # propagate the reference, enumerating after the move such that the renamed memory
+        # itself is covered; the read-only memories are excluded in a tool context because
+        # writing to one would raise after the move was already applied, leaving the memory
+        # graph half-updated
+        memories_list = self.list_memories()
+        target_names = sorted(memories_list.memories) if is_tool_context else memories_list.get_full_list()
+
         total_updates = 0
-        for memory_name in self.list_memories().get_full_list():
+        for memory_name in target_names:
             content = self.load_memory(memory_name)
             updated_content, n_replacements = self.rename_references_to_memory(content, old_name, new_name)
             if n_replacements > 0:
```

**File**: `test/serena/test_memories_manager.py` (modified, +38/-0)
```diff
@@ -844,3 +844,41 @@ def test_no_double_prefix_on_repeated_runs(self, fs_manager: MemoryManager) -> N
         # idempotent: the second run should not touch anything
         assert second.total_replacements == 0
         assert fs_manager.load_memory("docs") == "the mem:auth/login process"
+
+
+class TestRenameMemorySparesReadOnlyMemories:
+    """Regression: a tool-context rename enumerated read-only memories, so propagating the
+    reference into one raised ``PermissionError`` after the rename itself had already been applied.
+    """
+
+    @staticmethod
+    def _manager(tmp_path, monkeypatch) -> MemoryManager:
+        manager = MemoryManager(serena_data_folder=tmp_path, read_only_memory_patterns=[r"frozen/.*"])
+        # the global memories of the machine would otherwise join the enumeration as well
+        global_dir = tmp_path / "global"
+        global_dir.mkdir()
+        monkeypatch.setattr(manager, "_global_memory_dir", global_dir)
+        _write(manager, "auth/login", "# login notes")
+        _write(manager, "frozen/notes", "see `mem:auth/login`")
+        _write(manager, "docs", "first `mem:auth/login`, then `mem:auth/login`")
+        return manager
+
+    def test_tool_context_rename_completes_and_leaves_read_only_reference_alone(self, tmp_path, monkeypatch) -> None:
+        manager = self._manager(tmp_path, monkeypatch)
+
+        message, n_updated = manager.rename_memory_and_propagate_references("auth/login", "auth/signin", is_tool_context=True)
+
+        assert "auth/signin" in message
+        assert manager.load_memory("auth/signin") == "# login notes"
+        assert manager.load_memory("docs") == "first `mem:auth/signin`, then `mem:auth/signin`"
+        assert manager.load_memory("frozen/notes") == "see `mem:auth/login`"
+        assert n_updated == 2
+
+    def test_cli_context_rename_still_propagates_into_read_only_memories(self, tmp_path, monkeypatch) -> None:
+        manager = self._manager(tmp_path, monkeypatch)
+
+        _, n_updated = manager.rename_memory_and_propagate_references("auth/login", "auth/signin", is_tool_context=False)
+
+        assert manager.load_memory("frozen/notes") == "see `mem:auth/signin`"
+        assert manager.load_memory("docs") == "first `mem:auth/signin`, then `mem:auth/signin`"
+        assert n_updated == 3
```

#### Recent Merged Pull Requests:
- **PR #2103** (2026-09-24): fix(cli): correct duplicated "IS" in ignored-path check output (@thomascfoley-stack)
- **PR #2102** (2026-09-23): fix: zip extract permission bits (@benkeil)
- **PR #2097** (2026-09-23): fix(typescript): prefer the src subtree over an adjacent tool config for workspace warmup (@AmirF194)
- **PR #2096** (2026-09-21): docs: correct configuration key names and typos (@Yu-0312)
- **PR #2095** (2026-09-21): chore(deps): declare click as a direct dependency (@Yu-0312)
- **PR #2094** (2026-09-21): fix(dashboard): correct unsupported-mode fallback warning f-string (@Yu-0312)
- **PR #2093** (2026-09-21): fix(memories): check read-only access on both names when renaming (@Yu-0312)
- **PR #2092** (2026-09-21): fix(config): derive project lists on access instead of caching them (@Yu-0312)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
