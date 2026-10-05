# Forensic Learning Record (Deep Inspection): lancedb/lancedb

> **Canonical Artifact**: `07_PROJECT_LEARNING/lancedb-lancedb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/lancedb/lancedb](https://github.com/lancedb/lancedb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T14:03:07.051Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `lancedb/lancedb`
- **Description**: Developer-friendly OSS embedded retrieval library for multimodal AI. Search More; Manage Less.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 11562 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `ci/check_breaking_changes.py`
```
"""
Check whether there are any breaking changes in the PRs between the base and head commits.
If there are, assert that we have incremented the minor version.
"""

import argparse
import os
from packaging.version import parse

from github import Github

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("base")
    parser.add_argument("head")
    parser.add_argument("last_stable_version")
    parser.add_argument("current_version")
    args = parser.parse_args()

    repo = Github(os.environ["GITHUB_TOKEN"]).get_repo(os.environ["GITHUB_REPOSITORY"])
    commits = repo.compare(args.base, args.head).commits
    prs = (pr for commit in commits for pr in commit.get_pulls())

    for pr in prs:
        if any(label.name == "breaking-change" for label in pr.labels):
            print(f"Breaking change in PR: {pr.html_url}")
            break
    else:
        print("No breaking changes found.")
        exit(0)

    last_stable_version = parse(args.last_stable_version)
    current_version = parse(args.current_version)
    if current_version.minor <= last_stable_version.minor:
        print("Minor version is not greater than the last stable version.")
        exit(1)

```

### Core Architecture Module: `ci/check_lance_release.py`
```
#!/usr/bin/env python3
"""Determine whether a newer Lance tag exists and expose results for CI."""

from __future__ import annotations

import argparse
import functools
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Sequence, Tuple, Union

try:  # Python >=3.11
    import tomllib  # type: ignore
except ModuleNotFoundError:  # pragma: no cover - fallback for older Python
    import tomli as tomllib  # type: ignore

LANCE_REPO = "lance-format/lance"

SEMVER_RE = re.compile(
    r"^\s*(?P<major>0|[1-9]\d*)\.(?P<minor>0|[1-9]\d*)\.(?P<patch>0|[1-9]\d*)"
    r"(?:-(?P<prerelease>[0-9A-Za-z.-]+))?"
    r"(?:\+[0-9A-Za-z.-]+)?\s*$"
)


@functools.total_ordering
@dataclass(frozen=True)
class SemVer:
    major: int
    minor: int
    patch: int
    prerelease: Tuple[Union[int, str], ...]

    def __lt__(self, other: "SemVer") -> bool:  # pragma: no cover - simple comparison
        if (self.major, self.minor, self.patch) != (
            other.major,
            other.minor,
            other.patch,
        ):
            return (self.major, self.minor, self.patch) < (
                other.major,
                other.minor,
                other.patch,
            )
        if self.prerelease == other.prerelease:
            return False
        if not self.prerelease:
            return False  # release > anything else
        if not other.prerelease:
            return True
        for left, right in zip(self.prerelease, other.prerelease):
            if left == right:
                continue
            if isinstance(left, int) and isinstance(right, int):
                return left < right
            if isinstance(left, int):
                return True
            if isinstance(right, int):
                return False
            return str(left) < str(right)
        return len(self.prerelease) < len(other.prerelease)

    def __eq__(self, other: object) -> bool:  # pragma: no cover - trivial
        if not isinstance(other, SemVer):
            return NotImplemented
        return (
            self.major == other.major
            and self.minor == other.minor
            and self.patch == other.patch
            and self.prerelease == other.prerelease
        )


def parse_semver(raw: str) -> SemVer:
    match = SEMVER_RE.match(raw)
    if not match:
        raise ValueError(f"Unsupported version format: {raw}")
    prerelease = match.group("prerelease")
    parts: Tuple[Union[int, str], ...] = ()
    if prerelease:
        parsed: List[Union[int, str]] = []
        for piece in prerelease.split("."):
            if piece.isdigit():
                parsed.append(int(piece))
            else:
                parsed.append(piece)
        parts = tuple(parsed)
    return SemVer(
        major=int(match.group("major")),
        minor=int(match.group("minor")),
        patch=int(match.group("patch")),
        prerelease=parts,
    )


@dataclass
class TagInfo:
    tag: str  # e.g. v1.0.0-beta.2
    version: str  # e.g. 1.0.0-beta.2
    semver: SemVer


def run_command(cmd: Sequence[str]) -> str:
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(
            f"Command {' '.join(cmd)} failed with {result.returncode}: {result.stderr.strip()}"
        )
    return result.stdout.strip()


def fetch_remote_tags() -> List[TagInfo]:
    output = run_command(
        [
            "gh",
            "api",
            "-X",
            "GET",
            f"repos/{LANCE_REPO}/releases",
            "--jq",
            ".[].tag_name",
            "-F",
            "per_page=20",
        ]
    )
    tags: List[TagInfo] = []
    for line in output.splitlines():
        tag = line.strip()
        if not tag.startswith("v"):
            continue
        version = tag.lstrip("v")
        try:
            tags.append(TagInfo(tag=tag, version=version, semver=parse_semver(version)))
        except ValueError:
            continue
    if not tags:
        raise RuntimeError("No Lance releases could be parsed from GitHub API output")
    return tags


def read_current_version(repo_root: Path) -> str:
    cargo_path = repo_root / "Cargo.toml"
    with cargo_path.open("rb") as fh:
        data = tomllib.load(fh)
    try:
        deps = data["workspace"]["dependencies"]
        entry = deps["lance"]
    except KeyError as exc:  # pragma: no cover - configuration guard
        raise RuntimeError(
            "Failed to locate workspace.dependencies.lance in Cargo.toml"
        ) from exc

    if isinstance(entry, str):
        raw_version = entry
    elif isinstance(entry, dict):
        raw_version = entry.get("version", "")
    else:  # pragma: no cover - defensive
        raise RuntimeError("Unexpected lance dependency format")

    raw_version = raw_version.strip()
    if not raw_version:
        raise RuntimeError("lance dependency does not declare a version")
    return raw_version.lstrip("=")


def determine_latest_tag(tags: Iterable[TagInfo]) -> TagInfo:
    # Stable releases (no prerelease) are always preferred over pre-releases.
    # Within each group, standard semver ordering applies.
    return max(tags, key=lambda tag: (not tag.semver.prerelease, tag.semver))


def write_outputs(args: argparse.Namespace, payload: dict) -> None:
    target = getattr(args, "github_output", None)
    if not target:
        return
    with open(target, "a", encoding="utf-8") as handle:
        for key, value in payload.items():
            handle.write(f"{key}={value}\n")


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--repo-root",
        default=Path(__file__).resolve().parents[1],
        type=Path,
        help="Path to the lancedb repository root",
    )
    parser.add_argument(
        "--github-output",
        default=os.environ.get("GITHUB_OUTPUT"),
        help="Optional file path for writing GitHub Action outputs",
    )
    args = parser.parse_args(argv)

    repo_root = Path(args.repo_root)
    current_version = read_current_version(repo_root)
    current_semver = parse_semver(current_version)

    tags = fetch_remote_tags()
    latest = determine_latest_tag(tags)
    needs_update = latest.semver > current_semver

    payload = {
        "current_version": current_version,
        "current_tag": f"v{current_version}",
        "latest_version": latest.version,
        "latest_tag": latest.tag,
        "needs_update": "true" if needs_update else "false",
    }

    print(json.dumps(payload))
    write_outputs(args, payload)
    return 0


if __name__ == "__main__":
    sys.exit(main())

```

### Core Architecture Module: `ci/mock_openai.py`
```
# SPDX-License-Identifier: Apache-2.0
# SPDX-FileCopyrightText: Copyright The LanceDB Authors
"""A zero-dependency mock OpenAI embeddings API endpoint for testing purposes."""

import argparse
import json
import http.server


class MockOpenAIRequestHandler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers["Content-Length"])
        post_data = self.rfile.read(content_length)
        post_data = json.loads(post_data.decode("utf-8"))
        # See: https://platform.openai.com/docs/api-reference/embeddings/create

        if isinstance(post_data["input"], str):
            num_inputs = 1
        else:
            num_inputs = len(post_data["input"])

        model = post_data.get("model", "text-embedding-ada-002")

        data = []
        for i in range(num_inputs):
            data.append(
                {
                    "object": "embedding",
                    "embedding": [0.1] * 1536,
                    "index": i,
                }
            )

        response = {
            "object": "list",
            "data": data,
            "model": model,
            "usage": {
                "prompt_tokens": 0,
                "total_tokens": 0,
            },
        }

        self.send_response(200)
        self.send_header("Content-type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(response).encode("utf-8"))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Mock OpenAI embeddings API endpoint")
    parser.add_argument("--port", type=int, default=8000, help="Port to listen on")
    args = parser.parse_args()
    port = args.port

    print(f"server started on port {port}. Press Ctrl-C to stop.")
    print(f"To use, set OPENAI_BASE_URL=http://localhost:{port} in your environment.")

    with http.server.HTTPServer(("0.0.0.0", port), MockOpenAIRequestHandler) as server:
        server.serve_forever()

```

### Core Architecture Module: `ci/parse_requirements.py`
```
import argparse
import toml


def parse_dependencies(pyproject_path, extras=None):
    with open(pyproject_path, "r") as file:
        pyproject = toml.load(file)

    dependencies = pyproject.get("project", {}).get("dependencies", [])
    for dependency in dependencies:
        print(dependency)

    optional_dependencies = pyproject.get("project", {}).get(
        "optional-dependencies", {}
    )

    if extras:
        for extra in extras.split(","):
            for dep in optional_dependencies.get(extra, []):
                print(dep)


def main():
    parser = argparse.ArgumentParser(
        description="Generate requirements.txt from pyproject.toml"
    )
    parser.add_argument("path", type=str, help="Path to pyproject.toml")
    parser.add_argument(
        "--extras",
        type=str,
        help="Comma-separated list of extras to include",
        default="",
    )

    args = parser.parse_args()

    parse_dependencies(args.path, args.extras)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `ci/semver_sort.py`
```
"""
Takes a list of semver strings and sorts them in ascending order.
"""

import sys
from packaging.version import parse, InvalidVersion

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("prefix", default="v")
    args = parser.parse_args()

    # Read the input from stdin
    lines = sys.stdin.readlines()

    # Parse the versions
    versions = []
    for line in lines:
        line = line.strip()
        try:
            version_str = line.removeprefix(args.prefix)
            version = parse(version_str)
        except InvalidVersion:
            # There are old tags that don't follow the semver format
            print(f"Invalid version: {line}", file=sys.stderr)
            continue
        versions.append((line, version))

    # Sort the versions
    versions.sort(key=lambda x: x[1])

    # Print the sorted versions as original strings
    for line, _ in versions:
        print(line)

```

### Core Architecture Module: `ci/set_lance_version.py`
```
import argparse
import re
import sys
import json

LANCE_GIT_URL = "https://github.com/lance-format/lance.git"


def run_command(command: str) -> str:
    """
    Run a shell command and return stdout as a string.
    If exit code is not 0, raise an exception with the stderr output.
    """
    import subprocess

    result = subprocess.run(command, shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        raise Exception(f"Command failed with error: {result.stderr.strip()}")
    return result.stdout.strip()


def get_latest_stable_version() -> str:
    version_line = run_command("cargo info lance | grep '^version:'")
    # Example output: "version: 0.35.0 (latest 0.37.0)"
    match = re.search(r"\(latest ([0-9.]+)\)", version_line)
    if match:
        return match.group(1)
    # Fallback: use the first version after 'version:'
    return version_line.split("version:")[1].split()[0].strip()


def get_latest_preview_version() -> str:
    lance_tags = run_command(
        f"git ls-remote --tags {LANCE_GIT_URL} | grep 'refs/tags/v[0-9beta.-]\\+$'"
    ).splitlines()
    lance_tags = (
        tag.split("refs/tags/")[1]
        for tag in lance_tags
        if "refs/tags/" in tag and "beta" in tag
    )
    from packaging.version import Version

    latest = max(
        (tag[1:] for tag in lance_tags if tag.startswith("v")), key=lambda t: Version(t)
    )
    return str(latest)


def extract_features(line: str) -> list:
    """
    Extracts the features from a line in Cargo.toml.
    Example: 'lance = { "version" = "=0.29.0", "features" = ["dynamodb"] }'
    Returns: ['dynamodb']
    """
    import re

    match = re.search(r'"features"\s*=\s*\[\s*(.*?)\s*\]', line, re.DOTALL)
    if match:
        features_str = match.group(1)
        return [f.strip().strip('"') for f in features_str.split(",") if f.strip()]
    return []


def extract_default_features(line: str) -> bool:
    """
    Checks if default-features = false is present in a line in Cargo.toml.
    Example: 'lance = { "version" = "=0.29.0", default-features = false, "features" = ["dynamodb"] }'
    Returns: True if default-features = false is present, False otherwise
    """
    import re

    match = re.search(r"default-features\s*=\s*false", line)
    return match is not None


def dict_to_toml_line(package_name: str, config: dict) -> str:
    """
    Converts a configuration dictionary to a TOML dependency line.
    Dictionary insertion order is preserved (Python 3.7+), so the caller
    controls the order of fields in the output.

    Args:
        package_name: The name of the package (e.g., "lance", "lance-io")
        config: Dictionary with keys like "version", "path", "git", "tag", "features", "default-features"
                The order of keys in this dict determines the order in the output.

    Returns:
        A properly formatted TOML line with a trailing newline
    """
    # If only version is specified, use simple format
    if len(config) == 1 and "version" in config:
        return f'{package_name} = "{config["version"]}"\n'

    # Otherwise, use inline table format
    parts = []
    for key, value in config.items():
        if key == "default-features" and not value:
            parts.append("default-features = false")
        elif key == "features":
            parts.append(f'"features" = {json.dumps(value)}')
        elif isinstance(value, str):
            parts.append(f'"{key}" = "{value}"')
        else:
            # This shouldn't happen with our current usage
            parts.append(f'"{key}" = {json.dumps(value)}')

    return f"{package_name} = {{ {', '.join(parts)} }}\n"


def update_cargo_toml(line_updater):
    """
    Updates the Cargo.toml file by applying the line_updater function to each line.
    The line_updater function should take a line as input and return the updated line.
    """
    with open("Cargo.toml", "r") as f:
        lines = f.readlines()

    new_lines = []
    lance_line = ""
    is_parsing_lance_line = False
    for line in lines:
        if re.match(r"^lance(?:\s|[-_])", line):
            # Check if this is a single-line or multi-line entry
            # Single-line entries either:
            # 1. End with } (complete inline table)
            # 2. End with " (simple version string)
            # Multi-line entries start with { but don't end with }
            if line.strip().endswith("}") or line.strip().endswith('"'):
                # Single-line entry - process immediately
                new_lines.append(line_updater(line))
            elif "{" in line and not line.strip().endswith("}"):
                # Multi-line entry - start accumulating
                lance_line = line
                is_parsing_lance_line = True
            else:
                # Single-line entry without quotes or braces (shouldn't happen but handle it)
                new_lines.append(line_updater(line))
        elif is_parsing_lance_line:
            lance_line += line
            if line.strip().endswith("}"):
                new_lines.append(line_updater(lance_line))
                lance_line = ""
                is_parsing_lance_line = False
        else:
            # Keep the line unchanged
            new_lines.append(line)

    with open("Cargo.toml", "w") as f:
        f.writelines(new_lines)


def set_stable_version(version: str):
    """
    Sets lines to
    lance = { "version" = "=0.29.0", default-features = false, "features" = ["dynamodb"] }
    lance-io = { "version" = "=0.29.0", default-features = false }
    ...
    """

    def line_updater(line: str) -> str:
        package_name = line.split("=", maxsplit=1)[0].strip()

        # Build config in desired order: version, default-features, features
        config = {"version": f"={version}"}

        if extract_default_features(line):
            config["default-features"] = False

        features = extract_features(line)
        if features:
            config["features"] = features

        return dict_to_toml_line(package_name, config)

    update_cargo_toml(line_updater)


def set_preview_version(version: str):
    """
    Sets lines to
    lance = { "version" = "=0.29.0", default-features = false, "features" = ["dynamodb"], "tag" = "v0.29.0-beta.2", "git" = LANCE_GIT_URL }
    lance-io = { "version" = "=0.29.0", default-features = false, "tag" = "v0.29.0-beta.2", "git" = LANCE_GIT_URL }
    ...
    """

    def line_updater(line: str) -> str:
        package_name = line.split("=", maxsplit=1)[0].strip()
        # Build config in desired order: version, default-features, features, tag, git
        config = {"version": f"={version}"}

        if extract_default_features(line):
            config["default-features"] = False

        features = extract_features(line)
        if features:
            config["features"] = features

        config["tag"] = f"v{version}"
        config["git"] = LANCE_GIT_URL

        return dict_to_toml_line(package_name, config)

    update_cargo_toml(line_updater)


def set_local_version():
    """
    Sets lines to
    lance = { "path" = "../lance/rust/lance", default-features = false, "features" = ["dynamodb"] }
    lance-io = { "path" = "../lance/rust/lance-io", default-features = false }
    ...
    """

    def line_updater(line: str) -> str:
        package_name = line.split("=", maxsplit=1)[0].strip()

        # Build config in desired order: path, default-features, features
        config = {"path": f"../lance/rust/{package_name}"}

        if extract_default_features(line):
            config["default-features"] = False

        features = extract_features(line)
        if features:
            config["features"] = features

        return dict_to_toml_line(package_name, config)

    update_cargo_toml(line_updater)


def update_lockfiles(version: str, fallback_to_git: bool = False):
    """
    Update Cargo metadata and optionally fall back to using the git tag if the
    requested crates.io version is unavailabl
```

### Core Architecture Module: `ci/update_lance_dependency.py`
```
#!/usr/bin/env python3
"""Prepare a Lance dependency update for LanceDB."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Sequence

try:
    from check_lance_release import parse_semver
except ModuleNotFoundError:
    # Supports importing as ci.update_lance_dependency from tests or ad hoc checks.
    from ci.check_lance_release import parse_semver  # type: ignore


def normalize_version(raw: str) -> str:
    value = raw.strip()
    value = value.removeprefix("refs/tags/")
    value = value.removeprefix("v")
    try:
        parse_semver(value)
    except ValueError:
        raise ValueError(f"Unsupported Lance version or tag: {raw}")
    return value


def normalized_tag(version: str) -> str:
    return f"v{version}"


def branch_name(version: str) -> str:
    suffix = re.sub(r"[^a-zA-Z0-9]+", "-", version).strip("-")
    suffix = re.sub(r"-+", "-", suffix)
    return f"codex/update-lance-{suffix}"


def commit_type(version: str) -> str:
    prerelease = version.split("-", maxsplit=1)[1] if "-" in version else ""
    return "chore" if "beta" in prerelease or "rc" in prerelease else "feat"


def metadata_for(version: str) -> dict[str, str]:
    kind = commit_type(version)
    message = f"{kind}: update lance dependency to v{version}"
    return {
        "version": version,
        "tag": normalized_tag(version),
        "branch_name": branch_name(version),
        "commit_type": kind,
        "commit_message": message,
        "pr_title": message,
    }


def run_command(cmd: Sequence[str], *, cwd: Path) -> None:
    subprocess.run(cmd, cwd=cwd, check=True)


def update_java_lance_core_version(repo_root: Path, version: str) -> None:
    pom_path = repo_root / "java" / "pom.xml"
    contents = pom_path.read_text(encoding="utf-8")
    updated, count = re.subn(
        r"(<lance-core\.version>)[^<]+(</lance-core\.version>)",
        rf"\g<1>{version}\g<2>",
        contents,
        count=1,
    )
    if count != 1:
        raise RuntimeError(
            "Expected exactly one <lance-core.version> entry in java/pom.xml"
        )
    pom_path.write_text(updated, encoding="utf-8")


def write_github_outputs(path: str | None, payload: dict[str, str]) -> None:
    if not path:
        return
    with open(path, "a", encoding="utf-8") as output:
        for key, value in payload.items():
            output.write(f"{key}={value}\n")


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "tag_or_version",
        help="Lance tag or version, for example refs/tags/v7.2.0-beta.1 or 7.2.0",
    )
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
        help="Path to the lancedb repository root",
    )
    parser.add_argument(
        "--github-output",
        default=None,
        help="Optional GitHub Actions output file to receive metadata fields",
    )
    parser.add_argument(
        "--metadata-only",
        action="store_true",
        help="Only print derived metadata; do not modify dependency files",
    )
    args = parser.parse_args(argv)

    repo_root = args.repo_root.resolve()
    version = normalize_version(args.tag_or_version)
    payload = metadata_for(version)

    if not args.metadata_only:
        run_command([sys.executable, "ci/set_lance_version.py", version], cwd=repo_root)
        update_java_lance_core_version(repo_root, version)

    write_github_outputs(args.github_output, payload)
    print(json.dumps(payload, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())

```

### Core Architecture Module: `ci/validate_stable_lance.py`
```
import tomllib

found_preview_lance = False

with open("Cargo.toml", "rb") as f:
    cargo_data = tomllib.load(f)

    for name, dep in cargo_data["workspace"]["dependencies"].items():
        if name == "lance" or name.startswith("lance-"):
            if isinstance(dep, str):
                version = dep
            elif isinstance(dep, dict):
                # Version doesn't have the beta tag in it, so we instead look
                # at the git tag.
                version = dep.get("tag", dep.get("version"))
            else:
                raise ValueError("Unexpected type for dependency: " + str(dep))

            if "beta" in version:
                found_preview_lance = True
                print(f"Dependency '{name}' is a preview version: {version}")

with open("python/pyproject.toml", "rb") as f:
    py_proj_data = tomllib.load(f)

    for dep in py_proj_data["project"]["dependencies"]:
        if dep.startswith("pylance"):
            if "b" in dep:
                found_preview_lance = True
                print(f"Dependency '{dep}' is a preview version")
            break  # Only one pylance dependency

if found_preview_lance:
    raise ValueError("Found preview version of Lance in dependencies")

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4344** (2026-09-29): **fix(python): apply the default limit of 10 to sync hybrid queries**
  *Symptoms*: ## Summary  A synchronous hybrid query without an explicit `.limit()` can return up to 20 rows. The documented default is 10, and `AsyncHybridQuery` already falls back to `DEFAULT_HYBRID_LIMIT` (10).  In `LanceHybridQueryBuilder`, each sub-query (vector and FTS) falls back to its own default of 10 rows. The fused result was then sliced with `limit=None`, i.e. not truncated at all. When the two legs match different rows, the caller gets the union.      t = db.create_table("t", [{"text": ("dog" if i >= 20 else "cat") + f" {i}", "vector": [float(i), 0.0]} for i in range(40)])     t.create_index("text", config=FTS())     len(t.search(query_type="hybrid").vector([0.0, 0.0]).text("dog").to_arrow())     # before: 20, after: 10  For the same reason, `.offset(n)` without `.limit()` did not raise the sub-query limits to cover the skipped prefix; that only happened inside `if self._limit:`.  ## Changes  - Use `DEFAULT_HYBRID_LIMIT` when no limit is set, both for the sub-query limits (`limit + offset`) and for the final slice of the reranked results, matching `AsyncHybridQuery`.  ## Test plan  - [x] New `test_hybrid_query_default_limit` in `test_hybrid_query.py`. It is the sync counterpart of `test_async_hybrid_query_default_limit`, plus an `offset()`-without-`limit()` check. It fails before the fix (20 rows) and passes after. - [x] `pytest python/tests/test_hybrid_query.py python/tests/test_rerankers.py` - [x] `ruff format --check` / `ruff check`  I have no local Rust toolchain, so I ra

- **Issue #4337** (2026-09-29): **fix(python): warn when optimize cleans up all old versions**
  *Symptoms*: ## Why  `optimize(cleanup_older_than=timedelta(0))` deletes the data files of every version except the latest. Any other handle still on an older version then fails with a missing-file error, and nothing tells the caller this can happen. #2470 asks for a docs note and a runtime warning.  Fixes #2470  ## Scope  - `AsyncTable.optimize` emits a `UserWarning` when `cleanup_older_than` rounds to 0 ms or less. `LanceTable.optimize` runs through it, so sync callers get the warning too. - The `cleanup_older_than` docstring on `Table.optimize`, `LanceTable.optimize`, and `AsyncTable.optimize` gets a `.. warning::` block, in the same style as the existing `delete_unverified` one. - Removed the function-local `import warnings` in `AsyncTable.optimize`. `warnings` is already imported at module level, and the local import would shadow it for the new check (`UnboundLocalError`). - `test_optimize` and `test_optimize_delete_unverified` intentionally use a 0 cleanup, so they now assert the warning with `pytest.warns`.  Nodejs `cleanupOlderThan` is out of scope, since the issue is filed against the Python SDK.  ## Tradeoffs  Like the existing `retrain` deprecation warning, the warning is raised inside the async coroutine. For sync callers it is attributed to `asyncio/events.py` rather than the caller's line. Warning from both the sync and async entry points would duplicate the check for a small gain.  ## Verification  - Repro: a second handle checked out at an older version, then `optimize(cle

- **Issue #4330** (2026-09-29): **fix(rust): list indices when an FTS index's files are missing**
  *Symptoms*: Fixes #4250.  `list_indices()` reads each FTS index's files to fill `index_details`. When those files were missing, the error failed the whole call, so the caller could not list any index, including the damaged one it needs to rebuild. Scalar indexes were not affected because their listing reads only the manifest.  Now a failed read logs a warning and leaves that index's `index_details` as `None`. The other fields still come from the manifest, and `tokenize()` already returns a clear error when an FTS index has no details.  The new test `test_list_indices_with_missing_fts_index_files` creates an FTS index and a BTree index, deletes the FTS index directory, and reopens the table. It then checks that both indexes are still listed. Without the change, it fails with the same `Not found` error as the issue.

- **Issue #4327** (2026-09-29): **fix(node): write NaN and Infinity as SQL literals in table.update**
  *Symptoms*: ## What's wrong  `toSQL` renders numbers with `toString()`, so `NaN` becomes `NaN` and `Infinity` becomes `Infinity`. SQL reads those as column names:  ```ts await table.update({ values: { price: NaN }, where: "id = 1" }); // Error: Invalid input, Schema error: No field named "NaN". Valid fields are id, price. ```  `Infinity` and `-Infinity` fail the same way. The only workaround today is `valuesSql`.  ## Fix  Emit `CAST('NaN' AS DOUBLE)`, `CAST('Infinity' AS DOUBLE)` and `CAST('-Infinity' AS DOUBLE)` for these values. Finite numbers render as before.  ## Tests  - `__test__/util.test.ts` adds `toSQL` cases for `NaN`, `Infinity` and `-Infinity`. - `__test__/table.test.ts` adds "should let me update float values to NaN and Infinity", which updates a float column and reads the values back. - On `main`, the new cases fail with `No field named "NaN"`. - With the fix, all of `util.test.ts` and `table.test.ts` pass (344 tests). These were run against the published `@lancedb/lancedb@0.40.0-beta.11` native binary. - `biome check` is clean on the changed files.  The Python SDK has the same issue in `value_to_sql`. That fix is in #4326.  The fix was found and written by an AI agent (Breken) and checked against the tests above. 

- **Issue #4326** (2026-09-29): **fix(python): write NaN and infinity as SQL literals in table.update**
  *Symptoms*: ## What's wrong  `value_to_sql` renders floats with `str()`, so `float("nan")` becomes `nan` and `float("inf")` becomes `inf`. SQL reads those as column names:  ```python table.update(where="id = 1", values={"price": float("nan")}) # ValueError: Invalid input, Schema error: No field named nan. Valid fields are id, price. ```  The same happens for `math.inf`, `-math.inf`, `np.nan` and `np.float32("inf")`, which go through the same float path. The only workaround today is `values_sql`.  ## Fix  Emit `CAST('NaN' AS DOUBLE)`, `CAST('Infinity' AS DOUBLE)` and `CAST('-Infinity' AS DOUBLE)` for these values. Finite floats render as before. The cast also lands correctly in `float32` columns.  ## Tests  `test_value_to_sql_nan_and_infinity` in `python/python/tests/test_util.py` updates `float64` and `float32` columns to NaN, +inf and -inf, then reads them back:  - On `main`, it fails with `ValueError: Invalid input, Schema error: No field named nan`. - With the fix, it passes. All of `test_util.py` passes (75 passed, 1 skipped), and so do the update tests in `test_table.py` (`-k update`, 8 passed). - `ruff format --check` and `ruff check` are clean.  NaN inside a list value (for example a vector) still fails, because Lance only accepts literals inside array values. This PR covers scalar columns only.  The fix was found and written by an AI agent (Breken) and checked against the tests above. 

- **Issue #4325** (2026-09-29): **fix(python): rank each result list separately in RRF multivector rerank**
  *Symptoms*: ## What's wrong  `RRFReranker.rerank_multivector` concatenates every vector result list and passes the concatenation to `rerank_hybrid` as a single list. `rerank_hybrid` then scores each row by its position in that concatenation, so a row's rank depends on how many rows came before it in *earlier* lists.  With two searches of 3 rows each (`K=60`):  | row | rank in its own list | score today | RRF score | |---|---|---|---| | 1 (top of list 1) | 1 | 1/61 | 1/61 | | 3 (third of list 1) | 3 | 1/63 | 1/63 | | 4 (top of list 2) | 1 | **1/64** | 1/61 | | 5 (second of list 2) | 2 | **1/65** | 1/62 |  So the best hit of the second search ranks below the worst hit of the first, and the order of the lists passed in decides the fused ranking. `MRRReranker.rerank_multivector` already scores each list on its own ("MRR semantics require treating each vector result as a separate ranking system"). RRF is defined the same way.  ## Fix  Score each result list with its own ranks (`1 / (rank + K)`, summed across lists for rows found by more than one), then dedupe the concatenation by `_rowid`, attach `_relevance_score`, and sort. The `return_score` handling is unchanged.  ## Tests  `test_rrf_multivector_ranks_each_result_list` in `python/python/tests/test_rerankers.py`:  - On `main`, it fails with `assert 0.015625 == 0.01639344262295082` (the top hit of list 2 got `1/64` instead of `1/61`). - With the fix, it passes, and so do the other tests in `test_rerankers.py` (16 passed, 12 skipped for miss

- **Issue #4319** (2026-09-29): **fix(python): prevent negative int64 writer panic**
  *Symptoms*: ## Cause  Lance's block compressor selector chose out-of-line bitpacking for a dictionary whose negative `int64` values occupied the full 64-bit width. A partial 1,024-value chunk then hit the encoder's debug assertion that bit savings must be positive.  ## Fix  Guard the selector against full-width bitpacking. The patch carries a local copy of `lance-encoding` at the current `v13.0.0-beta.15` dependency version until Lance releases the guard. The Python binding inherits the local path dependency so source distributions include it.  ## Validation  - The `create_table` regression that reproduced the original debug panic passes on Lance beta.15 and verifies all 9,216 values roundtrip against the rebuilt Python extension. - `cargo check --quiet --features remote --tests --examples`, `cargo fmt --all`, Python formatting and lint, and Node lint, build, and docs passed after merging the current base. - A beta.15 Python source distribution contains the patched encoder, and Cargo resolves that local crate after extraction.  Fixes #4315  <!-- lance-gatekeeper-fix:v1 agent=7343b52c79d6c232eab2541099f8f939 generation=1 --> 
  **Post-Mortem & Fix Analysis**:
  > Blocked: PR #4319 still requires a maintainer approval before it can merge.  The verified remote head is 90295dd9e493889df0ab2be7265c4729988a05ca. GitHub reports REVIEW_REQUIRED and a BLOCKED merge state on this Ready PR; current-head checks have completed without failures.  I reviewed the current Reviews and inline threads. The latest Gatekeeper review repeats a non-blocking future vendoring note, and there is no current code request to address.  A maintainer can review and approve this head. If a change is needed instead, leave a concrete review request on the PR so the repair can continue.  <!-- lance-gatekeeper-fix-blocker:v1 agent=7343b52c79d6c232eab2541099f8f939 generation=1 wake=60681 head=90295dd9e493889df0ab2be7265c4729988a05ca --> 
  > Blocked: PR #4319 still requires a maintainer approval before it can merge.  The verified remote head is 617ee19b68cf6380724f95a0bbd99000a1667686. GitHub reports REVIEW_REQUIRED and a BLOCKED merge state on this Ready PR.  I reviewed the current Issue, Reviews, PR comments, and inline threads. The latest Gatekeeper Review repeats only a non-blocking future vendoring note, and there is no current code request to address. The beta.14 guard and its Python regression were validated on this head.  A maintainer can review and approve this head. If a change is needed instead, leave a concrete review request so the repair can continue.  <!-- lance-gatekeeper-fix-blocker:v1 agent=7343b52c79d6c232eab2541099f8f939 generation=1 wake=67500 head=617ee19b68cf6380724f95a0bbd99000a1667686 --> 
  > Blocked: The current-head aarch64 Python wheel check cannot complete because its manylinux container cannot download EPEL metadata.  At remote head `311306fe4e52e09c70fac1aaf62f5b9f029bb2f1`, the `Python lancedb aarch64 manylinux2_28` check (job `108897917962`) failed during `yum install -y clang`. EPEL returned 404 for its repository metadata across mirrors, before Rust or Python compilation. The Ready PR has no merge conflict.  I inspected the completed job log and confirmed this wheel setup step is inherited unchanged from `main`; a repair-code change cannot fix the package mirror.  Please rerun the aarch64 wheel job once EPEL metadata is available. Alternatively, a maintainer can update the CI image or mirror configuration in a separate workflow change.  <!-- lance-gatekeeper-fix-blocker:v2 agent=7343b52c79d6c232eab2541099f8f939 generation=1 head=311306fe4e52e09c70fac1aaf62f5b9f029bb2f1 evidence=58088591d76b8c0373956f8c --> 

- **Issue #4318** (2026-09-24): **fix(python): warn instead of failing on local imports in @udf source**
  *Symptoms*: Since 0.40.0b8 (#4254), `@udf` raises when the packaged source imports a module from a local source tree that is neither shipped with `code=` nor named by a declared pip/conda package. That turned registrations that used to succeed into errors:  - Callers that rewrite the packaged source before registering it now fail at decoration. Sophon's datagen integration suite inlines its test-module helpers this way, and `test_registered_udf_source_stands_alone_on_a_worker` fails on 0.40.0b8. - The check cannot know which modules a distribution installs. A declared package whose distribution name differs from its module (for example an internal library installed editable) is reported as local, and there was no way to proceed.  This keeps the diagnosis but makes it a `UserWarning`, so registration behaves as it did before #4254 and still tells the author, at registration time, why the worker is likely to fail. 

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

### Incident Patch 1: `ad79112b` (2026-09-29)
**Commit Message**: fix(node): support LargeUtf8 and LargeBinary Arrow columns (#4287)

## Cause

The Arrow type sanitizer handled Utf8 and Binary but omitted LargeUtf8
and LargeBinary, so Arrow tables from another Arrow installation failed
schema sanitization before reaching LanceDB.

## Fix

Reconstruct both large Arrow types during sanitization. Regression tests
cover createTable and add with Arrow 15–18 and adding a LargeBinary
Arrow column to a blob table.

## Validation

- Confirmed the new table test failed before the fix with `Unrecognized
type id in schema: 20` on all four Arrow versions.
- The table, sanitizer, and Arrow Jest suites passed: 604 tests.
- `pnpm lint`, `pnpm build`, and `pnpm run docs` passed.

Fixes #4266

<!-- lance-gatekeeper-fix:v1 agent=1090de3c0ddeca587956632b79f0193c
generation=1 -->

Co-authored-by: Gatefixer <313497061+lancedb-gatefixer[bot]@users.noreply.github.com>

**File**: `nodejs/__test__/table.test.ts` (modified, +53/-0)
```diff
@@ -92,6 +92,38 @@ describe.each([arrow15, arrow16, arrow17, arrow18])(
       await expect(table.countRows()).resolves.toBe(3);
     });
 
+    it("creates and adds Arrow tables with large string and binary columns", async () => {
+      const data = new arrow.Table({
+        text: arrow.vectorFromArray(["alpha", "beta"], new arrow.LargeUtf8()),
+        bytes: arrow.vectorFromArray(
+          [Buffer.from("one"), Buffer.from("two")],
+          new arrow.LargeBinary(),
+        ),
+      });
+      const conn = await connect(tmpDir.name);
+      const largeTable = await conn.createTable("large_columns", data);
+      await largeTable.add(data);
+
+      const rows = await largeTable.query().toArray();
+      expect(rows.map((row) => row.text)).toEqual([
+        "alpha",
+        "beta",
+        "alpha",
+        "beta",
+      ]);
+      expect(rows.map((row) => Buffer.from(row.bytes).toString())).toEqual([
+        "one",
+        "two",
+        "one",
+        "two",
+      ]);
+      const fields = (await largeTable.schema()).fields;
+      expect(fields.map((field) => field.type.typeId)).toEqual([
+        arrow.Type.LargeUtf8,
+        arrow.Type.LargeBinary,
+      ]);
+    });
+
     it("should support a foreign Float64 vector schema end to end", async () => {
       const conn = await connect(tmpDir.name);
       const schema = new arrow.Schema([
@@ -2601,6 +2633,27 @@ describe("when dealing with blob columns", () => {
     expect(Buffer.from(await files[1]!.read()).toString()).toBe("beta");
   });
 
+  it("adds a LargeBinary Arrow column to a blob table", async () => {
+    const db = await connect(tmpDir.name);
+    const schema = new Schema([new Field("id", new Int64()), blob("image")]);
+    const table = await db.createTable(
+      "blobs",
+      [{ id: 1n, image: Buffer.from("alpha") }],
+      { schema },
+    );
+    const payload = Buffer.from("beta");
+    const data = new arrow18.Table({
+      id: arrow18.vectorFromArray([2n], new arrow18.Int64()),
+      image: arrow18.vectorFromArray([payload], new arrow18.LargeBinary()),
+    });
+    await table.add(data);
+
+    const rows = await table.query().withRowId().toArray();
+    const rowId = rows.find((row) => row.id === 2n)!._rowid as bigint;
+    const [actual] = await table.fetchBlobs("image", [rowId]);
+    expect(actual).toEqual(payload);
+  });
+
   it("reads a half-open range", async () => {
     const { table, rowIds } = await openBlobTable();
     const files = await table.fetchBlobFiles("image", rowIds);
```

**File**: `nodejs/lancedb/sanitize.ts` (modified, +6/-0)
```diff
@@ -43,6 +43,8 @@ import {
   Interval,
   IntervalDayTime,
   IntervalYearMonth,
+  LargeBinary,
+  LargeUtf8,
   List,
   Map_,
   Null,
@@ -465,8 +467,12 @@ function sanitizeTypeById(
       return sanitizeFloat(typeLike);
     case Type.Binary:
       return new Binary();
+    case Type.LargeBinary:
+      return new LargeBinary();
     case Type.Utf8:
       return new Utf8();
+    case Type.LargeUtf8:
+      return new LargeUtf8();
     case Type.Bool:
       return new Bool();
     case Type.Decimal:
```

---

### Incident Patch 2: `85b0eba1` (2026-09-29)
**Commit Message**: fix(python): support typed embedding vector fields (#3826)

## Summary

- infer fixed-size float32 Arrow vectors from `VectorField` metadata
when a model uses the standard `list[float]` annotation
- document the mypy-compatible embedding-field declaration while
preserving the existing `Vector(dim)` runtime API
- add regression coverage for schema conversion and model construction

## Root cause

`Vector(dim)` is a runtime constrained-type factory, but Python's static
typing rules do not permit call expressions in annotation positions.
Mypy's suggested `Vector[...]` spelling also cannot represent a
dimension computed at runtime and fails because `Vector` is a function.
`VectorField` already carries the embedding function and its dimension,
but schema conversion previously ignored that metadata for a statically
valid `list[float]` annotation.

The runtime factory remains available for dimension-constrained Pydantic
validation. Embedding-backed models that require mypy compatibility can
now use `list[float] = embedding.VectorField()`; LanceDB derives the
same nullable fixed-size float32 Arrow type from the field metadata.

## Validation

- `cd python && uv run --extra tests pytest
pyt

**File**: `python/python/lancedb/embeddings/base.py` (modified, +5/-1)
```diff
@@ -182,7 +182,11 @@ def SourceField(self, **kwargs):
     def VectorField(self, **kwargs):
         """
         Creates a pydantic Field that can automatically annotate
-        the target vector column for this embedding function
+        the target vector column for this embedding function.
+
+        The field can be annotated as ``list[float]`` for compatibility with
+        static type checkers. LanceDB will infer the fixed vector dimension from
+        this embedding function.
         """
         return Field(json_schema_extra={"vector_column_for": self}, **kwargs)
 
```

**File**: `python/python/lancedb/pydantic.py` (modified, +39/-0)
```diff
@@ -88,6 +88,17 @@ def Vector(
     ...     pa.field("url", pa.utf8(), False),
     ...     pa.field("embeddings", pa.list_(pa.float32(), 768))
     ... ])
+
+    Notes
+    -----
+    ``Vector`` creates a type dynamically, so calls such as ``Vector(768)`` are
+    not valid static type annotations. For an embedding field, use the standard
+    ``list[float]`` annotation when running mypy; ``VectorField`` supplies the
+    fixed dimension to LanceDB::
+
+        class MyModel(LanceModel):
+            text: str = embeddings.SourceField()
+            vector: list[float] = embeddings.VectorField()
     """
 
     # TODO: make a public parameterized type.
@@ -313,6 +324,10 @@ def _unwrap_optional_annotation(annotation: Any) -> Any | None:
 
 def _pydantic_to_arrow_type(field: FieldInfo) -> pa.DataType:
     """Convert a Pydantic FieldInfo to Arrow DataType"""
+    embedding_vector_type = _embedding_vector_to_arrow_type(field)
+    if embedding_vector_type is not None:
+        return embedding_vector_type
+
     unwrapped = _unwrap_optional_annotation(field.annotation)
     if unwrapped is not None:
         return _pydantic_type_to_arrow_type(unwrapped, field)
@@ -326,8 +341,32 @@ def _pydantic_to_arrow_type(field: FieldInfo) -> pa.DataType:
     return _pydantic_type_to_arrow_type(field.annotation, field)
 
 
+def _embedding_vector_to_arrow_type(field: FieldInfo) -> pa.DataType | None:
+    """Infer a fixed-size vector type from ``VectorField`` metadata."""
+    if not _is_embedding_vector_annotation(field):
+        return None
+
+    function = get_extras(field, "vector_column_for")
+    return pa.list_(pa.float32(), function.ndims())
+
+
+def _is_embedding_vector_annotation(field: FieldInfo) -> bool:
+    if get_extras(field, "vector_column_for") is None:
+        return False
+
+    annotation = _unwrap_optional_annotation(field.annotation)
+    if annotation is None:
+        annotation = field.annotation
+
+    origin = getattr(annotation, "__origin__", None)
+    args = getattr(annotation, "__args__", ())
+    return origin is list and args == (float,)
+
+
 def is_nullable(field: FieldInfo) -> bool:
     """Check if a Pydantic FieldInfo is nullable."""
+    if _is_embedding_vector_annotation(field):
+        return True
     if _unwrap_optional_annotation(field.annotation) is not None:
         return True
     if isinstance(field.annotation, (_GenericAlias, GenericAlias)):
```

**File**: `python/python/tests/test_pydantic.py` (modified, +20/-0)
```diff
@@ -9,6 +9,7 @@
 import pyarrow as pa
 import pydantic
 import pytest
+from lancedb.conftest import MockTextEmbeddingFunction
 from lancedb.pydantic import (
     LanceModel,
     MultiVector,
@@ -425,6 +426,25 @@ def test_bare_vector_raises_clear_error():
         exec("class TestModel(LanceModel):\n    vector: Vector", namespace)
 
 
+def test_embedding_vector_list_annotation():
+    embedding = MockTextEmbeddingFunction.create()
+
+    class StaticTypingModel(LanceModel):
+        text: str = embedding.SourceField()
+        vector: list[float] = embedding.VectorField()
+
+    schema = pydantic_to_schema(StaticTypingModel)
+    assert schema == pa.schema(
+        [
+            pa.field("text", pa.utf8(), False),
+            pa.field("vector", pa.list_(pa.float32(), embedding.ndims()), True),
+        ]
+    )
+
+    model = StaticTypingModel(text="hello", vector=[0.0] * embedding.ndims())
+    assert model.vector == [0.0] * embedding.ndims()
+
+
 def test_fixed_size_list_field():
     class TestModel(pydantic.BaseModel):
         vec: Vector(16)
```

---

### Incident Patch 3: `166c1147` (2026-09-29)
**Commit Message**: fix(rust): list indices when an FTS index's files are missing (#4330)

Fixes #4250.

`list_indices()` reads each FTS index's files to fill `index_details`.
When those files were missing, the error failed the whole call, so the
caller could not list any index, including the damaged one it needs to
rebuild. Scalar indexes were not affected because their listing reads
only the manifest.

Now a failed read logs a warning and leaves that index's `index_details`
as `None`. The other fields still come from the manifest, and
`tokenize()` already returns a clear error when an FTS index has no
details.

The new test `test_list_indices_with_missing_fts_index_files` creates an
FTS index and a BTree index, deletes the FTS index directory, and
reopens the table. It then checks that both indexes are still listed.
Without the change, it fails with the same `Not found` error as the
issue.

**File**: `rust/lancedb/src/table.rs` (modified, +14/-1)
```diff
@@ -3791,7 +3791,20 @@ impl BaseTable for NativeTable {
             let Some(segment) = segments.first() else {
                 continue;
             };
-            let params = load_segment_params(&dataset, segment).await?;
+            // The listing itself only needs the manifest. Missing index files must
+            // not hide every other index, or callers cannot find the one to repair.
+            let params = match load_segment_params(&dataset, segment).await {
+                Ok(params) => params,
+                Err(err) => {
+                    log::warn!(
+                        "Failed to read full text search configuration for index '{}': {}",
+                        index.name,
+                        err
+                    );
+                    index.index_details = None;
+                    continue;
+                }
+            };
             let details = serde_json::to_string(&params).map_err(|source| Error::Other {
                 message: format!(
                     "Failed to serialize full text search configuration for index '{}'",
```

**File**: `rust/lancedb/src/table/create_index.rs` (modified, +44/-0)
```diff
@@ -2078,6 +2078,50 @@ mod tests {
         assert_eq!(index.columns, vec!["tags".to_string()]);
     }
 
+    #[tokio::test]
+    async fn test_list_indices_with_missing_fts_index_files() {
+        let tmp_dir = tempdir().unwrap();
+        let uri = tmp_dir.path().to_str().unwrap();
+        let conn = connect(uri).execute().await.unwrap();
+        let batch = record_batch!(
+            ("id", Int32, [1, 2, 3]),
+            ("text", Utf8, ["alpha", "beta", "gamma"])
+        )
+        .unwrap();
+        let table = conn.create_table("t", batch).execute().await.unwrap();
+        table
+            .create_index(&["text"], Index::FTS(FtsIndexBuilder::default()))
+            .execute()
+            .await
+            .unwrap();
+        table
+            .create_index(&["id"], Index::BTree(BTreeIndexBuilder::default()))
+            .execute()
+            .await
+            .unwrap();
+
+        let fts_uuid = table
+            .list_indices()
+            .await
+            .unwrap()
+            .into_iter()
+            .find(|index| index.name == "text_idx")
+            .and_then(|index| index.index_uuid)
+            .unwrap();
+        std::fs::remove_dir_all(tmp_dir.path().join("t.lance/_indices").join(fts_uuid)).unwrap();
+
+        // A new connection, so the index cache cannot serve the deleted files.
+        let conn = connect(uri).execute().await.unwrap();
+        let table = conn.open_table("t").execute().await.unwrap();
+        let mut indices = table.list_indices().await.unwrap();
+        indices.sort_by(|a, b| a.name.cmp(&b.name));
+        let names = indices.iter().map(|i| i.name.as_str()).collect::<Vec<_>>();
+        assert_eq!(names, vec!["id_idx", "text_idx"]);
+        assert_eq!(indices[1].index_type, crate::index::IndexType::FTS);
+        assert_eq!(indices[1].index_details, None);
+        assert!(indices[0].index_details.is_some());
+    }
+
     #[tokio::test]
     async fn test_create_inverted_index() {
         let conn = connect("memory://").execute().await.unwrap();
```

---

### Incident Patch 4: `629f39d4` (2026-09-29)
**Commit Message**: fix(python): preserve mixed blob values before Arrow conversion (#4304)

## Cause
Python list and pandas rows were converted to Arrow before the target
blob v2 schema was applied. In a mixed bytes and URI batch, Arrow
inferred a binary column and encoded the URI as inline bytes; dict and
`lance.Blob` values could fail conversion.

## Fix
Build blob v2 columns from the original Python values using the target
field's storage type before converting the rest of each row. This
preserves inline bytes, external URIs, descriptor dictionaries, blob
objects, and nulls for `add`, `merge_insert`, and `create_table`.

## Validation
- `python/tests/test_blob.py`: 76 passed, 1 skipped.
- Python project Ruff check passed.
- Repository-wide Ruff check still reports 29 existing findings in `ci/`
files outside this change.

Fixes #4271

<!-- lance-gatekeeper-fix:v1 agent=54c95f06f11c88187b07a430aac6be2f
generation=1 -->

Co-authored-by: Gatefixer <313497061+lancedb-gatefixer[bot]@users.noreply.github.com>

**File**: `python/python/lancedb/table.py` (modified, +105/-2)
```diff
@@ -261,6 +261,101 @@ def _maybe_add_fts_error_note(
 KNOWN_METRICS = {"l2", "cosine", "dot", "hamming"}
 
 
+def _blob_value_to_storage(value: Any) -> Optional[dict]:
+    """Keep a Python blob's inline data or external URI before Arrow infers it."""
+    if value is None:
+        return None
+    if isinstance(value, (bytes, bytearray, memoryview)):
+        return {"data": bytes(value)}
+    if isinstance(value, str):
+        if not value:
+            raise ValueError("Blob uri cannot be empty")
+        return {"uri": value}
+    if isinstance(value, dict):
+        unknown = value.keys() - {"data", "uri", "position", "size"}
+        if unknown:
+            raise ValueError(f"Unknown blob fields: {sorted(unknown)}")
+        return value
+
+    try:
+        from lance.blob import Blob
+    except ModuleNotFoundError as err:
+        if err.name not in ("lance", "lance.blob"):
+            raise
+    else:
+        if isinstance(value, Blob):
+            return {
+                "data": value.data,
+                "uri": value.uri,
+                "position": value.position,
+                "size": value.size,
+            }
+    raise TypeError(f"Unsupported blob value: {type(value).__name__}")
+
+
+def _blob_input_to_arrow(data: Any, schema: Optional[pa.Schema]) -> Optional[pa.Table]:
+    """Convert Python rows with blob fields before Arrow loses their value types."""
+    if schema is None:
+        return None
+
+    if isinstance(data, list) and data and isinstance(data[0], dict):
+        names = {
+            field.name
+            for field in schema
+            if is_blob_v2_field(field)
+            and any(isinstance(row, dict) and field.name in row for row in data)
+        }
+        if not names:
+            return None
+        values = {name: [row.get(name) for row in data] for name in names}
+        rows = [{**row, **{name: None for name in names}} for row in data]
+        table = pa.Table.from_pylist(rows)
+    elif _check_for_pandas(data) and isinstance(data, pd.DataFrame):
+        names = {
+            field.name
+            for field in schema
+            if is_blob_v2_field(field) and field.name in data.columns
+        }
+        if not names:
+            return None
+        values = {
+            name: [
+                None
+                if value is pd.NA or isinstance(value, float) and np.isnan(value)
+                else value
+                for value in data[name]
+            ]
+            for name in names
+        }
+        table = pa.Table.from_pandas(
+            data.assign(**{name: None for name in names}), preserve_index=False
+        ).replace_schema_metadata(None)
+    else:
+        return None
+
+    for field in schema:
+        if field.name not in names:
+            continue
+        storage_type = (
+            field.type.storage_type
+            if isinstance(field.type, pa.ExtensionType)
+            else field.type
+        )
+        storage = pa.array(
+            [_blob_value_to_storage(value) for value in values[field.name]],
+            type=storage_type,
+        )
+        column = (
+            pa.ExtensionArray.from_storage(field.type, storage)
+            if isinstance(field.type, pa.ExtensionType)
+            else storage
+        )
+        table = table.set_column(
+            table.schema.get_field_index(field.name), field, column
+        )
+    return table
+
+
 def _into_pyarrow_reader(
     data, schema: Optional[pa.Schema] = None
 ) -> pa.RecordBatchReader:
@@ -303,9 +398,14 @@ def _into_pyarrow_reader(
             return pa.Table.from_batches(data).to_reader()
         else:
             data = _serialize_json_values(data, schema)
-            return pa.Table.from_pylist(data).to_reader()
+            table = _blob_input_to_arrow(data, schema)
+            return (
+                table if table is not None else pa.Table.from_pylist(data)
+            ).to_reader()
     elif _check_for_pandas(data) and isinstanc
```

**File**: `python/python/tests/test_blob.py` (modified, +128/-1)
```diff
@@ -7,10 +7,11 @@
 import textwrap
 
 import lance
+import pandas as pd
 import pyarrow as pa
 import pyarrow.compute as pc
 import pytest
-from lance.blob import BlobType as LanceBlobType
+from lance.blob import Blob, BlobType as LanceBlobType
 
 import lancedb
 from lancedb._blob import (
@@ -1432,3 +1433,129 @@ def test_add_external_uri_string_round_trips_with_flag(tmp_path):
     hits = table.search().to_arrow()
     blobs = table.fetch_blobs("image", hits)
     assert blobs[0].as_py() == payload
+
+
+@pytest.mark.parametrize("as_pandas", [False, True])
+def test_add_bytes_and_uri_in_one_batch_preserves_external_uri(tmp_path, as_pandas):
+    payload = b"external-payload"
+    blob_path = tmp_path / "payload.bin"
+    blob_path.write_bytes(payload)
+    rows = [
+        {"id": 1, "image": b"inline"},
+        {"id": 2, "image": blob_path.as_uri()},
+    ]
+    db = lancedb.connect(tmp_path / "db")
+    schema = pa.schema([pa.field("id", pa.int64()), lancedb.blob("image")])
+    table = db.create_table("mixed", schema=schema)
+
+    table.add(
+        pd.DataFrame(rows) if as_pandas else rows,
+        allow_external_blob_outside_bases=True,
+    )
+
+    by_id = _row_ids_by_id(table)
+    assert table.fetch_blobs("image", [by_id[1], by_id[2]]).to_pylist() == [
+        b"inline",
+        payload,
+    ]
+
+
+@pytest.mark.parametrize("as_pandas", [False, True])
+def test_add_mixed_python_blob_values_preserves_external_uris(tmp_path, as_pandas):
+    payload = b"external-payload"
+    blob_path = tmp_path / "payload.bin"
+    blob_path.write_bytes(payload)
+    uri = blob_path.as_uri()
+    rows = [
+        {"id": 1, "image": b"inline"},
+        {"id": 2, "image": uri},
+        {"id": 3, "image": {"data": b"from-dict"}},
+        {"id": 4, "image": Blob.from_bytes(b"from-blob")},
+        {"id": 5, "image": Blob.from_uri(uri)},
+        {"id": 6, "image": {"uri": uri}},
+        {"id": 7, "image": None},
+    ]
+    db = lancedb.connect(tmp_path / "db")
+    schema = pa.schema([pa.field("id", pa.int64()), lancedb.blob("image")])
+    table = db.create_table("mixed", schema=schema)
+
+    table.add(
+        pd.DataFrame(rows) if as_pandas else rows,
+        allow_external_blob_outside_bases=True,
+    )
+
+    by_id = _row_ids_by_id(table)
+    assert table.fetch_blobs("image", [by_id[i] for i in range(1, 8)]).to_pylist() == [
+        b"inline",
+        payload,
+        b"from-dict",
+        b"from-blob",
+        payload,
+        payload,
+        None,
+    ]
+
+
+@pytest.mark.parametrize("as_pandas", [False, True])
+def test_merge_insert_mixed_python_blobs_validates_external_uri(tmp_path, as_pandas):
+    blob_path = tmp_path / "payload.bin"
+    blob_path.write_bytes(b"external-payload")
+    table = _blob_table("merge_mixed_uri", [{"id": 1, "image": b"before"}])
+    rows = [
+        {"id": 1, "image": b"updated"},
+        {"id": 2, "image": blob_path.as_uri()},
+    ]
+
+    with pytest.raises(ValueError, match="allow_external_blob_outside_bases"):
+        (
+            table.merge_insert("id")
+            .when_matched_update_all()
+            .when_not_matched_insert_all()
+            .execute(pd.DataFrame(rows) if as_pandas else rows)
+        )
+    assert table.count_rows() == 1
+
+
+@pytest.mark.parametrize("as_pandas", [False, True])
+def test_merge_insert_python_blob_dicts_and_objects(as_pandas):
+    table = _blob_table("merge_python_blobs", [{"id": 1, "image": b"before"}])
+    rows = [
+        {"id": 1, "image": b"updated"},
+        {"id": 2, "image": {"data": b"from-dict"}},
+        {"id": 3, "image": Blob.from_bytes(b"from-blob")},
+    ]
+
+    result = (
+        table.merge_insert("id")
+        .when_matched_update_all()
+        .when_not_matched_insert_all()
+        .execute(pd.DataFrame(rows) if as_pandas else rows)
+    )
+
+    assert result.num_updated_rows == 1
+    assert result.num_inserted_rows == 2
+    by_id = _row_ids_by_id(table)
+    assert table.fetch_blobs("image
```

---

### Incident Patch 5: `51ea02ea` (2026-09-29)
**Commit Message**: fix: pin remote BlobFile reads to the opened version (#4295)

## Cause

On latest-tracking remote tables, `fetch_blob_files` probed a concrete
table version but retained `None` on each handle. Later range reads
resolved the latest version again, so an update or delete could make an
opened handle fail.

## Fix

For nonempty blobs, capture `x-lancedb-version` from the 206 size probe
and include it on every later range request. Reject a nonempty probe
without a valid version. Accept an empty-blob 416 probe with or without
that header, because an empty handle makes no later data range request.
The Python remote mock now covers both response shapes.

## Limitation

A table dropped and recreated with the same name can reuse version
numbers and row addresses. Version pinning does not identify the table
itself, so an old handle can still return data from the recreated table.
That identity case needs a separate fix. Callers that replace a table
should discard its old blob handles.

## Validation

- `cargo test --quiet --features remote -p lancedb --lib
remote::table::blobs::tests` (24 passed)
- Rebuilt the Python extension; `uv run --extra tests pytest
python/tests/test_remote_db.py -q -k r

**File**: `python/python/tests/test_remote_db.py` (modified, +16/-4)
```diff
@@ -2403,11 +2403,16 @@ def handler(request):
         elif request.path.startswith("/v1/table/test/blob/image/"):
             path = request.path.partition("?")[0]
             row_id = int(path.split("/")[-2])
-            payload = {10: b"alpha", 20: None, 30: b"gamma"}[row_id]
+            payload = {10: b"alpha", 20: None, 30: b"gamma", 40: b""}[row_id]
             if payload is None:
                 request.send_response(204)
                 request.end_headers()
                 return
+            if not payload:
+                request.send_response(416)
+                request.send_header("Content-Range", "bytes */0")
+                request.end_headers()
+                return
             byte_range = request.headers["Range"].removeprefix("bytes=")
             start_text, end_text = byte_range.split("-", maxsplit=1)
             start = int(start_text)
@@ -2416,6 +2421,9 @@ def handler(request):
             request.send_response(206)
             request.send_header("Content-Range", f"bytes {start}-{end}/{len(payload)}")
             request.send_header("Content-Length", str(len(chunk)))
+            request.send_header(
+                "x-lancedb-version", str(BLOB_DESCRIBE_RESPONSE["version"])
+            )
             request.end_headers()
             request.wfile.write(chunk)
         elif request.path == "/v1/table/test/query/":
@@ -2459,17 +2467,21 @@ def test_remote_blob_columns_and_fetch():
 
 def test_remote_blob_files_are_lazy_seekable_handles():
     with blob_remote_table() as table:
-        files = table.fetch_blob_files("image", [10, 20, 30])
+        files = table.fetch_blob_files("image", [10, 20, 30, 40])
 
-        assert len(files) == 3
-        alpha, null_row, gamma = files
+        assert len(files) == 4
+        alpha, null_row, gamma, empty = files
         assert null_row is None
         assert alpha is not None
         assert gamma is not None
+        assert empty is not None
         assert alpha.size() == 5
         assert alpha.read_range(1, 3) == b"lph"
         gamma.seek(2)
         assert gamma.read() == b"mma"
+        assert empty.size() == 0
+        assert empty.read() == b""
+        assert empty.read_range(0, 0) == b""
         alpha.close()
         assert alpha.closed
         with pytest.raises(RuntimeError, match="already closed"):
```

**File**: `rust/lancedb/src/remote/table.rs` (modified, +1/-0)
```diff
@@ -5326,6 +5326,7 @@ mod tests {
                     "bytes=0-0" => http::Response::builder()
                         .status(206)
                         .header(reqwest::header::CONTENT_RANGE, "bytes 0-0/10")
+                        .header(VERSION_HEADER, "42")
                         .body(b"0".to_vec())
                         .unwrap(),
                     "bytes=0-" => http::Response::builder()
```

**File**: `rust/lancedb/src/remote/table/blobs.rs` (modified, +135/-12)
```diff
@@ -22,7 +22,8 @@ use crate::remote::client::{HttpSend, RequestResultExt, RestfulLanceDbClient};
 use crate::table::BaseTable;
 
 use super::{
-    FreshnessHeaders, FreshnessState, ReadSnapshot, RemoteTable, freshness_headers_snapshot,
+    FreshnessHeaders, FreshnessState, ReadSnapshot, RemoteTable, VERSION_HEADER,
+    freshness_headers_snapshot,
 };
 
 // The Cloud route rejects larger row-id lists. Its separate 64 MiB byte limit
@@ -50,6 +51,7 @@ trait BlobRangeRequester: Send + Sync + std::fmt::Debug {
         &self,
         range_header: &str,
         mode: RangeRequestMode,
+        version: Option<u64>,
     ) -> Result<(String, Response)>;
 }
 
@@ -71,13 +73,14 @@ impl<S: HttpSend> BlobRangeRequester for TableBlobRangeRequester<S> {
         &self,
         range_header: &str,
         mode: RangeRequestMode,
+        version: Option<u64>,
     ) -> Result<(String, Response)> {
         let freshness_request =
             freshness_headers_snapshot(&self.freshness, self.read_consistency_interval);
         let mut request = freshness_request
             .apply(self.client.get(&self.path))
             .header(header::RANGE, range_header);
-        if let Some(version) = self.version {
+        if let Some(version) = version.or(self.version) {
             request = request.query(&[("version", version)]);
         }
         if let Some(branch) = &self.branch {
@@ -112,21 +115,25 @@ struct RemoteBlobState {
 }
 
 /// Seekable Cloud blob handle over HTTP Range.
+///
+/// Nonempty handles read the table version returned by their size probe.
 #[derive(Debug)]
 pub struct RemoteBlobFile {
     requester: Arc<dyn BlobRangeRequester>,
     state: Mutex<RemoteBlobState>,
     closed: AtomicBool,
     size: u64,
+    version: Option<u64>,
 }
 
 impl RemoteBlobFile {
-    fn new(requester: Arc<dyn BlobRangeRequester>, size: u64) -> Self {
+    fn new(requester: Arc<dyn BlobRangeRequester>, size: u64, version: Option<u64>) -> Self {
         Self {
             requester,
             state: Mutex::new(RemoteBlobState::default()),
             closed: AtomicBool::new(false),
             size,
+            version,
         }
     }
 
@@ -175,7 +182,7 @@ impl RemoteBlobFile {
         let range_header = format!("bytes={}-{}", range.start, range.end - 1);
         let (request_id, response) = self
             .requester
-            .request_range(&range_header, RangeRequestMode::DataRead)
+            .request_range(&range_header, RangeRequestMode::DataRead, self.version)
             .await
             .map_err(remote_blob_error)?;
         self.ensure_open()?;
@@ -251,7 +258,7 @@ impl RemoteBlobFile {
                 let range_header = format!("bytes={cursor}-");
                 let (request_id, response) = self
                     .requester
-                    .request_range(&range_header, RangeRequestMode::DataRead)
+                    .request_range(&range_header, RangeRequestMode::DataRead, self.version)
                     .await
                     .map_err(remote_blob_error)?;
                 self.ensure_open()?;
@@ -579,12 +586,25 @@ async fn probe_blob_files(
 
 const BLOB_REQUEST_CONCURRENCY: usize = 8;
 
+fn probe_blob_version(response: &Response, request_id: &str) -> Result<u64> {
+    response
+        .headers()
+        .get(&VERSION_HEADER)
+        .and_then(|value| value.to_str().ok())
+        .and_then(|value| value.parse().ok())
+        .ok_or_else(|| Error::Http {
+            source: "blob size probe returned a missing or invalid x-lancedb-version header".into(),
+            request_id: request_id.to_string(),
+            status_code: Some(response.status()),
+        })
+}
+
 /// Probe one blob's size.
 ///
 /// `204` represents null. `416` with `bytes */0` represents an empty blob.
 async fn probe_blob_file(requester: Arc<dyn BlobRangeRequester>) -> Result<Option<BlobFile>> {
     let (request_id, response) = requester
-        .request_range("bytes=0-0", RangeRequestMode::SizeProbe
```

---

### Incident Patch 6: `8e3606fb` (2026-09-29)
**Commit Message**: fix: handle remote blob fetch request caps (#4309)

## Cause

Remote `fetch_blobs` sent every row ID in one Cloud request, exceeding
the server's 1024-row or 64 MiB byte cap. A single blob over the byte
cap could not be read through this method.

## Fix

- Send at most 1024 row IDs per request and split batches further when
the server reports the blob-byte cap, preserving input order and nulls.
- Resolve one exact dataset version before multi-request reads. If an
initial single request hits the byte cap, resolve the version before any
successful split or Range read; use that version for every resulting
request.
- Read an individual oversized blob through the existing Range route.
- Document the per-request caps and transparent handling in the Rust,
Python, and TypeScript APIs and generated JS docs.

## Validation

- Focused Rust `fetch_blobs` tests: 26 passed, including row-count,
byte-cap, Range fallback, and exact-version assertions.
- Rust clippy and formatting passed.
- Focused Python blob tests: 13 passed; Ruff lint and formatting passed.
- Node build, lint, docs generation, and focused `fetchBlobs` test
passed.

Fixes #4275

<!-- lance-gatekeeper-fix:v1 agent=6ae94d49bf1d4cae

**File**: `docs/src/js/classes/Table.md` (modified, +4/-0)
```diff
@@ -548,6 +548,10 @@ Bytes for `column` at row IDs from [Query.withRowId](Query.md#withrowid).
 Reads the table's current checkout. IDs from another version can fail after
 compaction unless stable row ids are enabled. Results keep input order and
 duplicates. Null blobs are `null`. Empty blobs are empty buffers.
+Remote servers limit each request to 1024 row IDs and 64 MiB of blob bytes.
+The client splits requests automatically and reads an individual larger
+blob through the Range route. This method still materializes all bytes in
+memory; use [Table.fetchBlobFiles](Table.md#fetchblobfiles) for large values.
 
 #### Parameters
 
```

**File**: `nodejs/lancedb/table.ts` (modified, +4/-0)
```diff
@@ -537,6 +537,10 @@ export abstract class Table {
    * Reads the table's current checkout. IDs from another version can fail after
    * compaction unless stable row ids are enabled. Results keep input order and
    * duplicates. Null blobs are `null`. Empty blobs are empty buffers.
+   * Remote servers limit each request to 1024 row IDs and 64 MiB of blob bytes.
+   * The client splits requests automatically and reads an individual larger
+   * blob through the Range route. This method still materializes all bytes in
+   * memory; use {@link Table.fetchBlobFiles} for large values.
    */
   abstract fetchBlobs(
     column: string,
```

**File**: `python/python/lancedb/table.py` (modified, +4/-2)
```diff
@@ -1963,8 +1963,10 @@ def fetch_blobs(
         ``_rowid`` values stay valid after compaction when the table has stable
         row ids.
 
-        Convenience for small payloads. For large values use
-        :meth:`fetch_blob_files`.
+        Remote servers limit each request to 1024 row IDs and 64 MiB of blob
+        bytes. The client splits requests automatically and reads an individual
+        larger blob through the Range route. This method still materializes all
+        bytes in memory; for large values use :meth:`fetch_blob_files`.
         """
 
     @abstractmethod
```

**File**: `rust/lancedb/src/remote/table.rs` (modified, +186/-0)
```diff
@@ -5187,6 +5187,192 @@ mod tests {
         assert_eq!(blobs.value(2), b"gamma");
     }
 
+    #[tokio::test]
+    async fn test_fetch_blobs_splits_row_ids_at_one_version_and_preserves_order() {
+        let request_sizes = Arc::new(std::sync::Mutex::new(Vec::new()));
+        let seen = request_sizes.clone();
+        let table = Table::new_with_handler_version(
+            "my_table",
+            semver::Version::new(0, 5, 0),
+            move |request| {
+                if request.url().path() == "/v1/table/my_table/describe/" {
+                    return http::Response::builder()
+                        .status(200)
+                        .body(br#"{"version":7,"schema":{"fields":[]}}"#.to_vec())
+                        .unwrap();
+                }
+                assert_eq!(request.url().path(), "/v1/table/my_table/fetch_blobs/");
+                let body = request_body_json(&request);
+                assert_eq!(body["version"], 7);
+                let ids = body["row_ids"].as_array().unwrap();
+                seen.lock().unwrap().push(ids.len());
+                if ids.len() > 1024 {
+                    return http::Response::builder()
+                        .status(400)
+                        .body(b"fetch_blobs accepts at most 1024 row IDs".to_vec())
+                        .unwrap();
+                }
+                let mut builder = LargeBinaryBuilder::new();
+                for id in ids {
+                    let id = id.as_u64().unwrap();
+                    if id == 1023 {
+                        builder.append_null();
+                    } else {
+                        builder.append_value(id.to_string().as_bytes());
+                    }
+                }
+                let batch = RecordBatch::try_new(
+                    Arc::new(Schema::new(vec![Field::new(
+                        "image",
+                        DataType::LargeBinary,
+                        true,
+                    )])),
+                    vec![Arc::new(builder.finish())],
+                )
+                .unwrap();
+                http::Response::builder()
+                    .status(200)
+                    .header(CONTENT_TYPE, ARROW_STREAM_CONTENT_TYPE)
+                    .body(write_ipc_stream_uncompressed(&batch))
+                    .unwrap()
+            },
+        );
+
+        let ids: Vec<u64> = (0..1024).chain([42]).collect();
+        let blobs = table.fetch_blobs("image", &ids).await.unwrap();
+        assert_eq!(blobs.len(), 1025);
+        assert_eq!(blobs.value(0), b"0");
+        assert_eq!(blobs.value(1022), b"1022");
+        assert!(blobs.is_null(1023));
+        assert_eq!(blobs.value(1024), b"42");
+        assert_eq!(request_sizes.lock().unwrap().as_slice(), &[1024, 1]);
+    }
+
+    #[tokio::test]
+    async fn test_fetch_blobs_splits_byte_limited_requests_and_reads_large_blob_by_range() {
+        // Simulate a lower byte cap so this test exercises the same 400 response
+        // without allocating 64 MiB of blob data.
+        let requests = Arc::new(std::sync::Mutex::new(Vec::new()));
+        let seen = requests.clone();
+        let table = Table::new_with_handler_version(
+            "my_table",
+            semver::Version::new(0, 5, 0),
+            move |request| {
+                let path = request.url().path();
+                if path == "/v1/table/my_table/describe/" {
+                    return http::Response::builder()
+                        .status(200)
+                        .body(br#"{"version":42,"schema":{"fields":[]}}"#.to_vec())
+                        .unwrap();
+                }
+                if path == "/v1/table/my_table/fetch_blobs/" {
+                    let body = request_body_json(&request);
+                    let ids = body["row_ids"].as_array().unwrap();
+                    if body["version"].is_null() {
+                        // Only the initial failed request may read live latest.
+                        a
```

**File**: `rust/lancedb/src/remote/table/blobs.rs` (modified, +82/-2)
```diff
@@ -21,7 +21,22 @@ use crate::error::Result;
 use crate::remote::client::{HttpSend, RequestResultExt, RestfulLanceDbClient};
 use crate::table::BaseTable;
 
-use super::{FreshnessHeaders, FreshnessState, RemoteTable, freshness_headers_snapshot};
+use super::{
+    FreshnessHeaders, FreshnessState, ReadSnapshot, RemoteTable, freshness_headers_snapshot,
+};
+
+// The Cloud route rejects larger row-id lists. Its separate 64 MiB byte limit
+// is handled by splitting a rejected request below.
+const MAX_FETCH_BLOBS_ROW_IDS: usize = 1024;
+
+fn is_fetch_blobs_byte_limit_error(error: &Error) -> bool {
+    matches!(error, Error::Http {
+        source,
+        status_code: Some(StatusCode::BAD_REQUEST),
+        ..
+    } if source.to_string().contains("fetch_blobs accepts at most")
+        && source.to_string().contains("total blob bytes"))
+}
 
 #[derive(Debug, Clone, Copy)]
 enum RangeRequestMode {
@@ -369,7 +384,62 @@ impl<S: HttpSend> RemoteTable<S> {
                 message: "fetch_blobs is not supported on this LanceDB Cloud server".into(),
             });
         }
-        let read_snapshot = self.snapshot_read_state().await;
+        let mut read_snapshot = self.snapshot_read_state().await;
+        // A selection spanning requests must use one exact dataset version.
+        // Resolve latest before the first chunk; a checked-out version is exact already.
+        if row_ids.len() > MAX_FETCH_BLOBS_ROW_IDS && read_snapshot.version.is_none() {
+            read_snapshot.version = Some(self.describe_read_snapshot(read_snapshot).await?.version);
+        }
+        let mut pending: Vec<&[u64]> = row_ids.chunks(MAX_FETCH_BLOBS_ROW_IDS).rev().collect();
+        let mut chunks = Vec::new();
+        while let Some(ids) = pending.pop() {
+            match self.fetch_blobs_chunk(column, ids, read_snapshot).await {
+                Ok(blobs) => chunks.push(blobs),
+                Err(error) if is_fetch_blobs_byte_limit_error(&error) => {
+                    // A single-request call may turn into several requests after a
+                    // byte-cap error. No bytes from the failed request were used.
+                    if read_snapshot.version.is_none() {
+                        read_snapshot.version =
+                            Some(self.describe_read_snapshot(read_snapshot).await?.version);
+                    }
+                    if ids.len() == 1 {
+                        // The whole-byte route cannot serve this blob. The Range route
+                        // has no aggregate response limit and preserves null alignment.
+                        let mut files = self
+                            .fetch_blob_files_with_snapshot(column, ids, read_snapshot)
+                            .await?;
+                        let blob = match files.pop().unwrap() {
+                            Some(file) => Some(file.read().await?),
+                            None => None,
+                        };
+                        chunks.push(LargeBinaryArray::from(vec![blob.as_deref()]));
+                    } else {
+                        let mid = ids.len() / 2;
+                        pending.push(&ids[mid..]);
+                        pending.push(&ids[..mid]);
+                    }
+                }
+                Err(error) => return Err(error),
+            }
+        }
+
+        if chunks.len() == 1 {
+            return Ok(chunks.pop().unwrap());
+        }
+        let chunk_refs: Vec<&dyn Array> = chunks.iter().map(|chunk| chunk as &dyn Array).collect();
+        Ok(arrow::compute::concat(&chunk_refs)?
+            .as_any()
+            .downcast_ref::<LargeBinaryArray>()
+            .expect("concatenating LargeBinary arrays returns LargeBinary")
+            .clone())
+    }
+
+    async fn fetch_blobs_chunk(
+        &self,
+        column: &str,
+        row_ids: &[u64],
+        read_snapshot: ReadSnapshot,
+    ) -> Result<LargeBinaryArray> {
         let mut body = serde_json::json!({
      
```

---

### Incident Patch 7: `c119f0c8` (2026-09-29)
**Commit Message**: fix(python): rank each result list separately in RRF multivector rerank (#4325)

## What's wrong

`RRFReranker.rerank_multivector` concatenates every vector result list
and passes the concatenation to `rerank_hybrid` as a single list.
`rerank_hybrid` then scores each row by its position in that
concatenation, so a row's rank depends on how many rows came before it
in *earlier* lists.

With two searches of 3 rows each (`K=60`):

| row | rank in its own list | score today | RRF score |
|---|---|---|---|
| 1 (top of list 1) | 1 | 1/61 | 1/61 |
| 3 (third of list 1) | 3 | 1/63 | 1/63 |
| 4 (top of list 2) | 1 | **1/64** | 1/61 |
| 5 (second of list 2) | 2 | **1/65** | 1/62 |

So the best hit of the second search ranks below the worst hit of the
first, and the order of the lists passed in decides the fused ranking.
`MRRReranker.rerank_multivector` already scores each list on its own
("MRR semantics require treating each vector result as a separate
ranking system"). RRF is defined the same way.

## Fix

Score each result list with its own ranks (`1 / (rank + K)`, summed
across lists for rows found by more than one), then dedupe the
concatenation by `_rowid`, attach `_relevance_score`, an

**File**: `python/python/lancedb/rerankers/rrf.py` (modified, +19/-3)
```diff
@@ -107,8 +107,24 @@ def rerank_multivector(
                     `search().with_row_id(True)`"
             )
 
+        # RRF ranks each result list on its own, so a document's rank is its
+        # position within the list it came from, not within the concatenation.
+        rrf_score_map = defaultdict(float)
+        for result in vector_results:
+            for i, result_id in enumerate(result["_rowid"].to_pylist(), 1):
+                rrf_score_map[result_id] += 1 / (i + self.K)
+
         combined = pa.concat_tables(vector_results, **self._concat_tables_args)
-        empty_table = pa.Table.from_arrays([], names=[])
-        reranked = self.rerank_hybrid(query, combined, empty_table)
+        combined = self._deduplicate(combined)
+        relevance_scores = [
+            rrf_score_map[row_id] for row_id in combined["_rowid"].to_pylist()
+        ]
+        combined = combined.append_column(
+            "_relevance_score", pa.array(relevance_scores, type=pa.float32())
+        )
+        combined = combined.sort_by([("_relevance_score", "descending")])
+
+        if self.score == "relevance":
+            combined = self._keep_relevance_score(combined)
 
-        return reranked
+        return combined
```

**File**: `python/python/tests/test_rerankers.py` (modified, +32/-0)
```diff
@@ -395,6 +395,38 @@ def ranking(row_ids):
     assert result["_rowid"].to_pylist()[0] == 2
 
 
+def test_rrf_multivector_ranks_each_result_list():
+    # RRF scores a document by its rank *within each* result list. The top hit
+    # of the second list must score the same as the top hit of the first list,
+    # not as if it were ranked after every row of the first list.
+    reranker = RRFReranker(K=60)
+
+    def ranking(row_ids):
+        return pa.table({"_rowid": pa.array(row_ids, type=pa.int64())})
+
+    rs1 = ranking([1, 2, 3])
+    rs2 = ranking([4, 5, 6])
+
+    result = reranker.rerank_multivector([rs1, rs2])
+    scores = dict(
+        zip(result["_rowid"].to_pylist(), result["_relevance_score"].to_pylist())
+    )
+
+    assert scores[1] == pytest.approx(1 / 61)
+    assert scores[4] == pytest.approx(1 / 61)
+    assert scores[5] == pytest.approx(1 / 62)
+    # the second-ranked hit of the second list beats the third hit of the first
+    assert scores[5] > scores[3]
+
+    # A document found by both lists sums its reciprocal ranks from each list.
+    result = reranker.rerank_multivector([ranking([1, 2]), ranking([2, 3])])
+    scores = dict(
+        zip(result["_rowid"].to_pylist(), result["_relevance_score"].to_pylist())
+    )
+    assert scores[2] == pytest.approx(1 / 62 + 1 / 61)
+    assert result["_rowid"].to_pylist() == [2, 1, 3]
+
+
 def test_rrf_reranker_distance():
     data = pa.table(
         {
```

---

### Incident Patch 8: `70a11234` (2026-09-29)
**Commit Message**: fix(python): write NaN and infinity as SQL literals in table.update (#4326)

## What's wrong

`value_to_sql` renders floats with `str()`, so `float("nan")` becomes
`nan` and `float("inf")` becomes `inf`. SQL reads those as column names:

```python
table.update(where="id = 1", values={"price": float("nan")})
# ValueError: Invalid input, Schema error: No field named nan. Valid fields are id, price.
```

The same happens for `math.inf`, `-math.inf`, `np.nan` and
`np.float32("inf")`, which go through the same float path. The only
workaround today is `values_sql`.

## Fix

Emit `CAST('NaN' AS DOUBLE)`, `CAST('Infinity' AS DOUBLE)` and
`CAST('-Infinity' AS DOUBLE)` for these values. Finite floats render as
before. The cast also lands correctly in `float32` columns.

## Tests

`test_value_to_sql_nan_and_infinity` in
`python/python/tests/test_util.py` updates `float64` and `float32`
columns to NaN, +inf and -inf, then reads them back:

- On `main`, it fails with `ValueError: Invalid input, Schema error: No
field named nan`.
- With the fix, it passes. All of `test_util.py` passes (75 passed, 1
skipped), and so do the update tests in `test_table.py` (`-k update`, 8
passed).
- `ruff format --

**File**: `python/python/lancedb/util.py` (modified, +8/-0)
```diff
@@ -5,6 +5,7 @@
 import binascii
 import functools
 import importlib
+import math
 import os
 import pathlib
 import warnings
@@ -351,6 +352,13 @@ def _(value: int):
 
 @value_to_sql.register(float)
 def _(value: float):
+    # str() gives "nan" / "inf", which SQL would read as column names.
+    if math.isnan(value):
+        return "CAST('NaN' AS DOUBLE)"
+    if math.isinf(value):
+        return (
+            "CAST('Infinity' AS DOUBLE)" if value > 0 else "CAST('-Infinity' AS DOUBLE)"
+        )
     return str(value)
 
 
```

**File**: `python/python/tests/test_util.py` (modified, +29/-0)
```diff
@@ -213,6 +213,35 @@ def test_value_to_sql_numpy_scalars():
     assert value_to_sql(np.bool_(False)) == "FALSE"
 
 
+def test_value_to_sql_nan_and_infinity(tmp_path):
+    # str(float("nan")) is "nan", which SQL reads as a column named nan, so
+    # table.update(values={"x": float("nan")}) failed with "No field named nan".
+    import math
+
+    import numpy as np
+
+    db = lancedb.connect(tmp_path)
+    table = db.create_table(
+        "test",
+        pa.table(
+            {
+                "id": [1, 2, 3, 4],
+                "f64": [1.0, 2.0, 3.0, 4.0],
+                "f32": pa.array([1.0, 2.0, 3.0, 4.0], pa.float32()),
+            }
+        ),
+    )
+    table.update(where="id = 1", values={"f64": float("nan"), "f32": np.nan})
+    table.update(where="id = 2", values={"f64": math.inf, "f32": np.float32("inf")})
+    table.update(where="id = 3", values={"f64": -math.inf, "f32": -math.inf})
+
+    rows = {row["id"]: row for row in table.to_arrow().to_pylist()}
+    assert math.isnan(rows[1]["f64"]) and math.isnan(rows[1]["f32"])
+    assert rows[2]["f64"] == math.inf and rows[2]["f32"] == math.inf
+    assert rows[3]["f64"] == -math.inf and rows[3]["f32"] == -math.inf
+    assert rows[4]["f64"] == 4.0 and rows[4]["f32"] == 4.0
+
+
 def test_append_vector_columns():
     registry = EmbeddingFunctionRegistry.get_instance()
     registry.register("test")(MockTextEmbeddingFunction)
```

---

### Incident Patch 9: `58024027` (2026-09-29)
**Commit Message**: fix(python): apply the default limit of 10 to sync hybrid queries (#4344)

## Summary

A synchronous hybrid query without an explicit `.limit()` can return up
to 20 rows. The documented default is 10, and `AsyncHybridQuery` already
falls back to `DEFAULT_HYBRID_LIMIT` (10).

In `LanceHybridQueryBuilder`, each sub-query (vector and FTS) falls back
to its own default of 10 rows. The fused result was then sliced with
`limit=None`, i.e. not truncated at all. When the two legs match
different rows, the caller gets the union.

t = db.create_table("t", [{"text": ("dog" if i >= 20 else "cat") + f"
{i}", "vector": [float(i), 0.0]} for i in range(40)])
    t.create_index("text", config=FTS())
len(t.search(query_type="hybrid").vector([0.0,
0.0]).text("dog").to_arrow())
    # before: 20, after: 10

For the same reason, `.offset(n)` without `.limit()` did not raise the
sub-query limits to cover the skipped prefix; that only happened inside
`if self._limit:`.

## Changes

- Use `DEFAULT_HYBRID_LIMIT` when no limit is set, both for the
sub-query limits (`limit + offset`) and for the final slice of the
reranked results, matching `AsyncHybridQuery`.

## Test plan

- [x] New `test_hybrid_query_defau

**File**: `python/python/lancedb/query.py` (modified, +8/-8)
```diff
@@ -2296,7 +2296,7 @@ def _run_hybrid(self, *, timeout: Optional[timedelta] = None) -> pa.Table:
             norm=self._norm,
             fts_query=self._fts_query._query,
             reranker=self._reranker,
-            limit=self._limit,
+            limit=self._limit or DEFAULT_HYBRID_LIMIT,
             with_row_ids=True,
             offset=self._offset,
         )
@@ -2748,13 +2748,13 @@ def _create_query_builders(self):
         )
 
         # Apply common configurations
-        if self._limit:
-            # The final offset/limit window is sliced out of the combined,
-            # reranked results, so each sub-query must fetch enough rows to
-            # cover the skipped prefix as well as the window itself.
-            sub_query_limit = self._limit + (self._offset or 0)
-            self._vector_query.limit(sub_query_limit)
-            self._fts_query.limit(sub_query_limit)
+        # The final offset/limit window is sliced out of the combined,
+        # reranked results, so each sub-query must fetch enough rows to
+        # cover the skipped prefix as well as the window itself.
+        limit = self._limit or DEFAULT_HYBRID_LIMIT
+        sub_query_limit = limit + (self._offset or 0)
+        self._vector_query.limit(sub_query_limit)
+        self._fts_query.limit(sub_query_limit)
         # WAL-PK-FUSION: without the fallback, select `self._columns` as is.
         self._pk_fusion = None
         columns = self._columns
```

**File**: `python/python/tests/test_hybrid_query.py` (modified, +27/-0)
```diff
@@ -315,6 +315,33 @@ def test_hybrid_query_offset(sync_table: Table):
     assert offset_result["_rowid"].to_pylist() == full["_rowid"].to_pylist()[2:]
 
 
+def test_hybrid_query_default_limit(sync_table: Table):
+    # The vector and FTS legs match disjoint rows, so fusing their results
+    # yields more rows than the default limit.
+    new_rows = []
+    for i in range(20):
+        new_rows.append({"text": "close_vec", "vector": [0.1, 0.1]})
+        new_rows.append({"text": "dog", "vector": [50.0 + i, 50.0 + i]})
+    sync_table.add(new_rows)
+
+    def query():
+        return (
+            sync_table.search(query_type="hybrid")
+            .vector([0.1, 0.1])
+            .text("dog")
+            .with_row_id(True)
+        )
+
+    # Like the async hybrid query, the default limit is 10.
+    result = query().to_arrow()
+    assert len(result) == 10
+
+    # The offset window is taken after the default limit is applied.
+    full = query().limit(15).to_arrow()
+    offset_result = query().offset(5).to_arrow()
+    assert offset_result["_rowid"].to_pylist() == full["_rowid"].to_pylist()[5:]
+
+
 def test_hybrid_query_minimum_nprobes_zero_raises(sync_table: Table):
     # minimum_nprobes(0) must raise the same validation error a plain vector
     # query raises, not silently no-op because 0 is falsy.
```

---

### Incident Patch 10: `1a463f36` (2026-09-29)
**Commit Message**: fix(python): warn when optimize cleans up all old versions (#4337)

## Why

`optimize(cleanup_older_than=timedelta(0))` deletes the data files of
every version except the latest. Any other handle still on an older
version then fails with a missing-file error, and nothing tells the
caller this can happen. #2470 asks for a docs note and a runtime
warning.

Fixes #2470

## Scope

- `AsyncTable.optimize` emits a `UserWarning` when `cleanup_older_than`
rounds to 0 ms or less. `LanceTable.optimize` runs through it, so sync
callers get the warning too.
- The `cleanup_older_than` docstring on `Table.optimize`,
`LanceTable.optimize`, and `AsyncTable.optimize` gets a `.. warning::`
block, in the same style as the existing `delete_unverified` one.
- Removed the function-local `import warnings` in `AsyncTable.optimize`.
`warnings` is already imported at module level, and the local import
would shadow it for the new check (`UnboundLocalError`).
- `test_optimize` and `test_optimize_delete_unverified` intentionally
use a 0 cleanup, so they now assert the warning with `pytest.warns`.

Nodejs `cleanupOlderThan` is out of scope, since the issue is filed
against the Python SDK.

## Tradeoffs

Like th

**File**: `python/python/lancedb/table.py` (modified, +59/-17)
```diff
@@ -134,6 +134,34 @@ def _polars_predicate_pushdown_barrier(frame: Any) -> Any:
 )
 
 
+def _optimize_cleanup_since_ms(
+    cleanup_older_than: Optional[timedelta], retrain: bool
+) -> Optional[int]:
+    # Called directly by both the sync and async optimize so stacklevel=3
+    # names the user's call site rather than the background event loop.
+    cleanup_since_ms: Optional[int] = None
+    if cleanup_older_than is not None:
+        cleanup_since_ms = round(cleanup_older_than.total_seconds() * 1000)
+        if cleanup_since_ms <= 0:
+            warnings.warn(
+                "optimize(cleanup_older_than=0) removes every version except "
+                "the latest. Any concurrent reader or writer still using an "
+                "older version will fail. Use a longer cleanup_older_than "
+                "unless no other process is working on this table.",
+                UserWarning,
+                stacklevel=3,
+            )
+
+    if retrain:
+        warnings.warn(
+            "The 'retrain' parameter is deprecated and will be removed in a "
+            "future version.",
+            DeprecationWarning,
+            stacklevel=3,
+        )
+    return cleanup_since_ms
+
+
 def _add_unique_note(exception: BaseException, note: str) -> None:
     existing_notes = getattr(exception, "__notes__", ()) or ()
     message = (
@@ -2217,6 +2245,13 @@ def optimize(
             All files belonging to versions older than this will be removed.  Set
             to 0 days to remove all versions except the latest.  The latest version
             is never removed.
+
+            .. warning::
+
+                Setting this to 0 deletes the data files of every older
+                version, so any other reader or writer still using an older
+                version of the table will fail. Only set it to 0 if no other
+                process is working on this dataset.
         delete_unverified: bool, default False
             Files leftover from a failed transaction may appear to be part of an
             in-progress operation (e.g. appending new data) and these files will not
@@ -4423,6 +4458,13 @@ def optimize(
             All files belonging to versions older than this will be removed.  Set
             to 0 days to remove all versions except the latest.  The latest version
             is never removed.
+
+            .. warning::
+
+                Setting this to 0 deletes the data files of every older
+                version, so any other reader or writer still using an older
+                version of the table will fail. Only set it to 0 if no other
+                process is working on this dataset.
         delete_unverified: bool, default False
             Files leftover from a failed transaction may appear to be part of an
             in-progress operation (e.g. appending new data) and these files will not
@@ -4447,10 +4489,9 @@ def optimize(
         modification operations.
         """
         LOOP.run(
-            self._table.optimize(
-                cleanup_older_than=cleanup_older_than,
-                delete_unverified=delete_unverified,
-                retrain=retrain,
+            self._table._do_optimize(
+                _optimize_cleanup_since_ms(cleanup_older_than, retrain),
+                delete_unverified,
             )
         )
 
@@ -6958,6 +6999,13 @@ async def optimize(
             All files belonging to versions older than this will be removed.  Set
             to 0 days to remove all versions except the latest.  The latest version
             is never removed.
+
+            .. warning::
+
+                Setting this to 0 deletes the data files of every older
+                version, so any other reader or writer still using an older
+                version of the table will fail. Only set it to 0 if no other
+                process is working on this dataset.
         delete_unverified: bool, default False
             Files leftover from a failed transactio
```

**File**: `python/python/tests/test_table.py` (modified, +28/-4)
```diff
@@ -4307,7 +4307,8 @@ async def test_optimize(mem_db_async: AsyncConnection):
     assert stats.prune.bytes_removed == 0
     assert stats.prune.old_versions_removed == 0
 
-    stats = await table.optimize(cleanup_older_than=timedelta(seconds=0))
+    with pytest.warns(UserWarning, match="concurrent"):
+        stats = await table.optimize(cleanup_older_than=timedelta(seconds=0))
     assert stats.prune.bytes_removed > 0
     assert stats.prune.old_versions_removed == 3
 
@@ -4335,12 +4336,35 @@ async def test_optimize_delete_unverified(tmp_db_async: AsyncConnection, tmp_pat
 
     stats = await table.optimize(delete_unverified=False)
     assert stats.prune.old_versions_removed == 0
-    stats = await table.optimize(
-        cleanup_older_than=timedelta(seconds=0), delete_unverified=True
-    )
+    with pytest.warns(UserWarning, match="concurrent"):
+        stats = await table.optimize(
+            cleanup_older_than=timedelta(seconds=0), delete_unverified=True
+        )
     assert stats.prune.old_versions_removed == 2
 
 
+@pytest.mark.asyncio
+async def test_optimize_warns_on_zero_cleanup(mem_db_async: AsyncConnection):
+    table = await mem_db_async.create_table("test", data=[{"x": [1]}])
+    with pytest.warns(UserWarning, match="concurrent"):
+        await table.optimize(cleanup_older_than=timedelta(0))
+
+    with warnings.catch_warnings():
+        warnings.simplefilter("error")
+        await table.optimize(cleanup_older_than=timedelta(days=1))
+        await table.optimize()
+
+
+def test_optimize_warns_on_zero_cleanup_sync(mem_db: DBConnection):
+    table = mem_db.create_table("test", data=[{"x": [1]}])
+    with warnings.catch_warnings(record=True) as seen:
+        warnings.simplefilter("default")
+        table.optimize(cleanup_older_than=timedelta(0))
+        table.optimize(cleanup_older_than=timedelta(0))
+    assert [w.filename for w in seen] == [__file__, __file__]
+    assert all("concurrent" in str(w.message) for w in seen)
+
+
 def test_replace_field_metadata(tmp_path):
     db = lancedb.connect(tmp_path)
     table = db.create_table("my_table", data=[{"x": 0}])
```

#### Recent Merged Pull Requests:
- **PR #4350** (2026-09-29): feat(node): accept an AbortSignal to cancel blob reads (@BilalAtique)
- **PR #4348** (2026-09-29): feat(node): expose seek, tell, bounded read, readRanges and close on BlobFile (@BilalAtique)
- **PR #4344** (2026-09-29): fix(python): apply the default limit of 10 to sync hybrid queries (@MohammadHijjawi97)
- **PR #4341** (2026-09-29): feat(functions): address Functions by namespace path (@jmhsieh)
- **PR #4340** (2026-09-29): feat(sql): expose composable native vector relations (@BubbleCal)
- **PR #4339** (2026-09-29): chore: update lance dependency to v13.0.0-beta.18 (@Xuanwo)
- **PR #4337** (2026-09-29): fix(python): warn when optimize cleans up all old versions (@jayzhou2309)
- **PR #4330** (2026-09-29): fix(rust): list indices when an FTS index's files are missing (@BilalAtique)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
