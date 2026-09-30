# Forensic Learning Record (Deep Inspection): GreptimeTeam/greptimedb

> **Canonical Artifact**: `07_PROJECT_LEARNING/greptimeteam-greptimedb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/GreptimeTeam/greptimedb](https://github.com/GreptimeTeam/greptimedb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:36:28.812Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `GreptimeTeam/greptimedb`
- **Description**: The open-source observability database. One columnar engine for metrics, logs, and traces, on object storage.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 6724 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.agents/skills/greptimedb-development-docker-image/scripts/binary_platform.py`
```
#!/usr/bin/env python3
# Copyright 2023 Greptime Team
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Validate that a binary is an executable ELF for a requested Linux platform."""

import argparse
import stat
import struct
import sys
from pathlib import Path
from typing import Optional

PLATFORM_MACHINES = {"linux/amd64": 0x3E, "linux/arm64": 0xB7}


def validate_platform(platform: str) -> int:
    try:
        return PLATFORM_MACHINES[platform]
    except KeyError as error:
        raise ValueError("platform must be linux/amd64 or linux/arm64") from error


def inspect_elf(path: Path) -> int:
    executable_bits = stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH
    if path.is_symlink() or not path.is_file() or not (path.stat().st_mode & executable_bits):
        raise ValueError("binary must be an executable regular file")
    try:
        with path.open("rb") as handle:
            header = handle.read(64)
    except OSError as error:
        raise ValueError(f"cannot read binary: {error}") from error
    if len(header) != 64 or header[:4] != b"\x7fELF":
        raise ValueError("binary is not ELF")
    if header[4] != 2 or header[5] != 1 or header[6] != 1:
        raise ValueError("binary must be a 64-bit little-endian ELF")
    if header[7] not in (0, 3):
        raise ValueError("binary must use the System V or Linux ELF ABI")
    elf_type, machine, version = struct.unpack_from("<HHI", header, 16)
    header_size = struct.unpack_from("<H", header, 52)[0]
    if elf_type not in (2, 3) or version != 1 or header_size != 64:
        raise ValueError("binary has an unsupported ELF executable header")
    return machine


def validate_binary(path: Path, platform: str) -> None:
    expected = validate_platform(platform)
    actual = inspect_elf(path)
    if actual != expected:
        raise ValueError("binary architecture does not match requested platform")


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary", required=True, type=Path)
    parser.add_argument("--platform", required=True)
    args = parser.parse_args(argv)
    try:
        validate_binary(args.binary, args.platform)
    except ValueError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

```

### Core Architecture Module: `.agents/skills/greptimedb-development-docker-image/scripts/collect_context.py`
```
#!/usr/bin/env python3
# Copyright 2023 Greptime Team
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Collect read-only build context for a GreptimeDB development image."""

import argparse
import json
import os
import platform
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional, cast

from next_image_tag import increment_tag
from binary_platform import PLATFORM_MACHINES, inspect_elf
from image_config import image_reference, parse_env_file, validate_values


ENV_KEYS = ("IMAGE_REGISTRY", "IMAGE_REPOSITORY", "IMAGE_TAG")
PROFILE_DIRECTORIES = {"dev": "debug", "test": "debug", "bench": "release"}
PLATFORM_ARCHITECTURES = {
    "x86_64": "linux/amd64",
    "amd64": "linux/amd64",
    "aarch64": "linux/arm64",
    "arm64": "linux/arm64",
}


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--bin", dest="binary", default="greptime")
    parser.add_argument("--profile", default="nightly")
    parser.add_argument("--target", help="Rust target triple for cross-compilation")
    parser.add_argument("--package", help="Cargo package containing the selected binary")
    parser.add_argument("--platform", choices=("linux/amd64", "linux/arm64"))
    parser.add_argument("--engine", choices=("auto", "docker", "podman"), default="auto")
    parser.add_argument("--registry")
    parser.add_argument("--repository")
    parser.add_argument("--tag")
    parser.add_argument(
        "--check-registry-tag",
        action="store_true",
        help="inspect the configured image tag with Docker without modifying it",
    )
    return parser.parse_args()


def native_platform(architecture: str) -> Optional[str]:
    return PLATFORM_ARCHITECTURES.get(architecture.lower())


def parse_env(env_path: Path) -> dict[str, object]:
    values = parse_env_file(env_path)
    missing = [key for key in ("IMAGE_REPOSITORY", "IMAGE_TAG") if not values.get(key)]
    try:
        if not missing:
            validate_values(values)
        error = None
    except ValueError as exc:
        error = str(exc)
    return {"path": str(env_path), "exists": env_path.is_file(), "values": values, "missing": missing, "error": error}


def cargo_metadata(source: Path) -> dict[str, Any]:
    command = ["cargo", "metadata", "--locked", "--format-version=1", "--no-deps"]
    try:
        result = subprocess.run(command, cwd=source, text=True, capture_output=True, check=True)
    except FileNotFoundError as error:
        raise RuntimeError("cargo is not installed or is not on PATH") from error
    except subprocess.CalledProcessError as error:
        detail = error.stderr.strip() or error.stdout.strip()
        raise RuntimeError(f"cargo metadata failed: {detail}") from error
    return json.loads(result.stdout)


def binary_targets(metadata: dict[str, Any]) -> list[dict[str, Any]]:
    targets = []
    for package in metadata["packages"]:
        for target in package["targets"]:
            if "bin" in target["kind"]:
                targets.append({
                    "package": package["name"],
                    "name": target["name"],
                    "path": target["src_path"],
                    "required_features": target.get("required-features", []),
                })
    return sorted(targets, key=lambda target: (target["name"], target["package"]))


def expected_binary(target_dir: Path, binary: str, profile: str, rust_target: Optional[str]) -> Path:
    profile_directory = PROFILE_DIRECTORIES.get(profile, profile)
    output_dir = target_dir / rust_target if rust_target else target_dir
    return output_dir / profile_directory / binary


def engine_status(engine: str) -> dict[str, object]:
    if engine == "docker":
        command = ["docker", "version", "--format", "{{.Server.Os}}/{{.Server.Arch}}"]
    else:
        command = ["podman", "info", "--format", "{{.Host.Os}}/{{.Host.Arch}}"]
    try:
        result = subprocess.run(command, text=True, capture_output=True, check=True)
    except (FileNotFoundError, subprocess.CalledProcessError):
        return {"available": False, "server_platform": None}
    return {"available": True, "server_platform": result.stdout.strip()}


def registry_tag_status(values: dict[str, str], enabled: bool, engine: str, source: str) -> dict[str, object]:
    if not enabled:
        return {"checked": False, "status": "not_checked", "candidate_tag": None}

    try:
        reference = image_reference(values)
    except ValueError:
        return {"checked": False, "status": "not_configured", "candidate_tag": None, "configuration_source": source}
    command = ["docker", "buildx", "imagetools", "inspect", reference] if engine == "docker" else ["podman", "manifest", "inspect", reference]
    try:
        subprocess.run(command, text=True, capture_output=True, check=True)
    except FileNotFoundError:
        return {"checked": True, "status": "unknown", "candidate_tag": None, "reference": reference, "engine": engine, "configuration_source": source}
    except subprocess.CalledProcessError:
        return {"checked": True, "status": "unknown", "candidate_tag": None, "reference": reference, "engine": engine, "configuration_source": source}

    try:
        candidate_tag = increment_tag(values["IMAGE_TAG"])
    except ValueError:
        candidate_tag = None
    return {"checked": True, "status": "exists", "candidate_tag": candidate_tag, "reference": reference, "engine": engine, "configuration_source": source}


def collect_report(args: argparse.Namespace) -> dict[str, object]:
    source = args.source.expanduser().resolve()
    if not (source / "Cargo.toml").is_file():
        raise RuntimeError(f"not a Cargo workspace: {source}")

    metadata = cargo_metadata(source)
    targets = binary_targets(metadata)
    target_dir = Path(metadata["target_directory"])
    expected = expected_binary(target_dir, args.binary, args.profile, args.target)
    host_architecture = platform.machine()
    selected_target = next((target for target in targets if target["name"] == args.binary), None)
    environment = parse_env(source / ".env")
    supplied_values = (args.registry, args.repository, args.tag)
    if any(value is not None for value in supplied_values) and not all(value is not None for value in supplied_values):
        raise RuntimeError("--registry, --repository, and --tag must be supplied together")
    values: dict[str, str] = {"IMAGE_REGISTRY": args.registry or "", "IMAGE_REPOSITORY": args.repository or "", "IMAGE_TAG": args.tag or ""} if all(value is not None for value in supplied_values) else cast(dict[str, str], environment["values"])
    configuration_source = "arguments" if all(value is not None for value in supplied_values) else "environment"
    docker = engine_status("docker")
    podman = engine_status("podman")
    engine = args.engine if args.engine != "auto" else "docker" if docker["available"] else "podman"
    binary_details: dict[str, object] = {"platform": None, "error": None}
    if expected.is_file():
        try:
            machine = inspect_elf(expected)
            binary_details["platform"] = next(
                (name for name, expected_machine in PLATFORM_MACHINES.items() if expected_machine == machine),
                None,
            )
            if binary_details["platform"] is None:
                binary_details["error"] = 
```

### Core Architecture Module: `.agents/skills/greptimedb-development-docker-image/scripts/image_config.py`
```
#!/usr/bin/env python3
# Copyright 2023 Greptime Team
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Bounded parsing and safe updating of the image settings in a .env file."""

import os
import re
import tempfile
from pathlib import Path
from typing import Mapping

MANAGED_KEYS = ("IMAGE_REGISTRY", "IMAGE_REPOSITORY", "IMAGE_TAG")
_REGISTRY = re.compile(r"[a-z0-9][a-z0-9.-]*(?::[0-9]+)?(?:/[a-z0-9][a-z0-9._-]*)*")
_REPOSITORY = re.compile(r"[a-z0-9][a-z0-9._-]*(?:/[a-z0-9][a-z0-9._-]*)*")
_TAG = re.compile(r"[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}")


def _value(text: str) -> str:
    text = text.strip()
    if not text:
        return ""
    quote = text[0] if text[0] in "'\"" else None
    if quote:
        end = text.find(quote, 1)
        if end < 0 or text[end + 1 :].strip() and not text[end + 1 :].lstrip().startswith("#"):
            raise ValueError("unmatched quote or trailing value syntax")
        return text[1:end]
    # A comment is inline only when introduced by whitespace.  This keeps
    # valid values such as an image tag containing '#'.
    match = re.search(r"\s+#", text)
    if match:
        text = text[: match.start()].rstrip()
    if any(character in text for character in "'\";$`"):
        raise ValueError("unsupported shell syntax in .env value")
    return text


def parse_env(text: str) -> dict[str, str]:
    """Parse the three managed keys, without validating their values."""
    lines = text.splitlines()
    result: dict[str, str] = {}
    for number, original in enumerate(lines, 1):
        line = original.strip()
        if not line or line.startswith("#"):
            continue
        export = re.match(r"export[ \t]+", line)
        if export:
            line = line[export.end() :].lstrip()
        key, separator, raw = line.partition("=")
        if not separator:
            continue
        key = key.strip()
        if key in MANAGED_KEYS:
            try:
                result[key] = _value(raw)
            except ValueError as error:
                raise ValueError(f"line {number}: {error}") from error
    return result


def parse_env_file(path: Path) -> dict[str, str]:
    return parse_env(path.read_text() if path.exists() else "")


def normalize_values(values: Mapping[str, str]) -> dict[str, str]:
    return {
        "IMAGE_REGISTRY": values.get("IMAGE_REGISTRY", ""),
        "IMAGE_REPOSITORY": values.get("IMAGE_REPOSITORY", ""),
        "IMAGE_TAG": values.get("IMAGE_TAG", ""),
    }


def validate_values(values: Mapping[str, str]) -> None:
    values = normalize_values(values)
    missing = [key for key in ("IMAGE_REPOSITORY", "IMAGE_TAG") if not values.get(key)]
    if missing:
        raise ValueError("missing managed values: " + ", ".join(missing))
    registry = values.get("IMAGE_REGISTRY", "")
    if registry and (
        not _REGISTRY.fullmatch(registry)
    ):
        raise ValueError("invalid registry")
    if registry:
        host = registry.split("/", 1)[0]
        if host != "localhost" and "." not in host and ":" not in host:
            raise ValueError("ambiguous registry; use an FQDN, explicit port, or localhost")
    if not _REPOSITORY.fullmatch(values["IMAGE_REPOSITORY"]):
        raise ValueError("invalid repository")
    if not _TAG.fullmatch(values["IMAGE_TAG"]):
        raise ValueError("invalid tag")
    if any(any(character.isspace() for character in value) for value in values.values()):
        raise ValueError("managed values cannot contain whitespace")


def image_reference(values: Mapping[str, str]) -> str:
    values = normalize_values(values)
    validate_values(values)
    prefix = values.get("IMAGE_REGISTRY", "")
    repository = values["IMAGE_REPOSITORY"]
    return f"{prefix}/{repository}:{values['IMAGE_TAG']}" if prefix else f"{repository}:{values['IMAGE_TAG']}"


def update_env(path: Path, values: Mapping[str, str]) -> bool:
    """Atomically update managed entries; return whether the file changed."""
    values = normalize_values(values)
    validate_values(values)
    if path.is_symlink():
        raise ValueError("refusing to update symlink .env")
    old = path.read_text() if path.exists() else ""
    parse_env(old)  # detect malformed managed syntax before changing anything
    lines = old.splitlines()
    output: list[str] = []
    written: set[str] = set()
    for line in lines:
        stripped = line.strip()
        export = re.match(r"export[ \t]+", stripped)
        candidate = stripped[export.end() :].lstrip() if export else stripped
        key = candidate.split("=", 1)[0].strip() if "=" in candidate else ""
        if key in MANAGED_KEYS:
            if key in written:
                continue
            output.append(f"{key}={values[key]}")
            written.add(key)
        else:
            output.append(line)
    output.extend(f"{key}={values.get(key, '')}" for key in MANAGED_KEYS if key not in written)
    new = "\n".join(output) + "\n"
    if old == new:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    mode = os.stat(path).st_mode & 0o777 if path.exists() else 0o600
    fd, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        os.fchmod(fd, mode)
        with os.fdopen(fd, "w") as handle:
            handle.write(new)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    return True

```

### Core Architecture Module: `.agents/skills/greptimedb-development-docker-image/scripts/next_image_tag.py`
```
#!/usr/bin/env python3
# Copyright 2023 Greptime Team
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Print a tag with its final numeric component incremented."""

import argparse
import re
import sys


def increment_tag(tag: str) -> str:
    match = re.search(r"(\d+)$", tag)
    if match is None:
        raise ValueError("tag must end with a numeric version component")

    number = match.group(1)
    return f"{tag[:match.start()]}{int(number) + 1:0{len(number)}d}"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Increment the final numeric component of a Docker image tag."
    )
    parser.add_argument("--tag", required=True, help="existing Docker image tag")
    args = parser.parse_args()

    try:
        print(increment_tag(args.tag))
    except ValueError as error:
        print(f"error: {error}: {args.tag!r}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())

```

### Core Architecture Module: `.agents/skills/greptimedb-development-docker-image/scripts/update_image_env.py`
```
#!/usr/bin/env python3
# Copyright 2023 Greptime Team
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Create or update non-secret GreptimeDB image settings in a .env file."""

import argparse
import sys
from pathlib import Path

from image_config import image_reference, normalize_values, update_env, validate_values

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env", type=Path)
    parser.add_argument("--registry", required=True)
    parser.add_argument("--repository", required=True)
    parser.add_argument("--tag", required=True)
    parser.add_argument("--validate-only", action="store_true")
    args = parser.parse_args()

    try:
        values = normalize_values({"IMAGE_REGISTRY": args.registry, "IMAGE_REPOSITORY": args.repository, "IMAGE_TAG": args.tag})
        validate_values(values)
    except ValueError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2

    if args.validate_only:
        print(image_reference(values))
        return 0
    if args.env is None:
        parser.error("--env is required unless --validate-only is set")
    if update_env(args.env, values):
        print(f"updated {args.env}")
    else:
        print(f"unchanged {args.env}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

```

### Core Architecture Module: `cyborg/bin/bump-versions.ts`
```
/*
 * Copyright 2023 Greptime Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as core from "@actions/core";
import {obtainClient} from "@/common";
import {docsWorkflowDispatch, WorkflowDispatch} from "@/docs-version";

interface RepoConfig {
  tokenEnv: string;
  repo: string;
  workflowLogic: (version: string) => WorkflowDispatch | null | Promise<WorkflowDispatch | null>;
}

const REPO_CONFIGS: Record<string, RepoConfig> = {
  website: {
    tokenEnv: "WEBSITE_REPO_TOKEN",
    repo: "website",
    workflowLogic: (version: string) => {
      // Skip nightly versions for website
      if (version.includes('nightly')) {
        console.log('Nightly version detected for website, skipping workflow trigger.');
        return null;
      }
      return {
        workflowId: 'bump-patch-version.yml',
        inputs: {version},
      };
    }
  },
  demo: {
    tokenEnv: "DEMO_REPO_TOKEN",
    repo: "demo-scene",
    workflowLogic: (version: string) => {
      // Skip nightly versions for demo
      if (version.includes('nightly')) {
        console.log('Nightly version detected for demo, skipping workflow trigger.');
        return null;
      }
      return {
        workflowId: 'bump-patch-version.yml',
        inputs: {version},
      };
    }
  },
  docs: {
    tokenEnv: "DOCS_REPO_TOKEN",
    repo: "docs",
    workflowLogic: async (version: string): Promise<WorkflowDispatch | null> => {
      // Nightly versions do not need the current docs version list.
      if (version.includes('nightly')) {
        return docsWorkflowDispatch(version, []);
      }

      const client = obtainClient('DOCS_REPO_TOKEN');
      const {data} = await client.rest.repos.getContent({
        owner: 'GreptimeTeam',
        repo: 'docs',
        path: 'versions.json',
        ref: 'main',
      });
      if (Array.isArray(data) || data.type !== 'file') {
        throw new Error('Expected docs versions.json to be a file');
      }

      const versions = JSON.parse(Buffer.from(data.content, 'base64').toString('utf-8'));
      if (!Array.isArray(versions) || !versions.every((entry) => typeof entry === 'string')) {
        throw new Error('Expected docs versions.json to be a string array');
      }

      return docsWorkflowDispatch(version, versions);
    }
  }
};

async function triggerWorkflow(repoConfig: RepoConfig, dispatch: WorkflowDispatch) {
  const client = obtainClient(repoConfig.tokenEnv);
  try {
    await client.rest.actions.createWorkflowDispatch({
      owner: "GreptimeTeam",
      repo: repoConfig.repo,
      workflow_id: dispatch.workflowId,
      ref: "main",
      inputs: dispatch.inputs,
    });
    console.log(`Successfully triggered ${dispatch.workflowId} workflow for ${repoConfig.repo} with version ${dispatch.inputs.version}`);
  } catch (error) {
    core.setFailed(`Failed to trigger workflow for ${repoConfig.repo}: ${error.message}`);
    throw error;
  }
}

async function processRepo(repoName: string, version: string) {
  const repoConfig = REPO_CONFIGS[repoName];
  if (!repoConfig) {
    throw new Error(`Unknown repository: ${repoName}`);
  }

  try {
    const dispatch = await repoConfig.workflowLogic(version);
    if (dispatch === null) {
      // Skip this repo (e.g., nightly version for website)
      return;
    }

    await triggerWorkflow(repoConfig, dispatch);
  } catch (error) {
    core.setFailed(`Error processing ${repoName} with version ${version}: ${error.message}`);
    throw error;
  }
}

async function main() {
  const version = process.env.VERSION;
  if (!version) {
    core.setFailed("VERSION environment variable is required");
    process.exit(1);
  }

  // Remove 'v' prefix if exists
  const cleanVersion = version.startsWith('v') ? version.slice(1) : version;

  // Get target repositories from environment variable
  // Default to both if not specified
  const targetRepos = process.env.TARGET_REPOS?.split(',').map(repo => repo.trim()) || ['website', 'docs'];

  console.log(`Processing version ${cleanVersion} for repositories: ${targetRepos.join(', ')}`);

  const errors: string[] = [];

  // Process each repository
  for (const repo of targetRepos) {
    try {
      await processRepo(repo, cleanVersion);
    } catch (error) {
      errors.push(`${repo}: ${error.message}`);
    }
  }

  if (errors.length > 0) {
    core.setFailed(`Failed to process some repositories: ${errors.join('; ')}`);
    process.exit(1);
  }

  console.log('All repositories processed successfully');
}

// Execute main function
main().catch((error) => {
  core.setFailed(`Unexpected error: ${error.message}`);
  process.exit(1);
});

```

### Core Architecture Module: `cyborg/bin/check-pull-request.ts`
```
/*
 * Copyright 2023 Greptime Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as core from '@actions/core'
import {handleError, obtainClient} from "@/common";
import {context} from "@actions/github";
import {PullRequestEvent} from "@octokit/webhooks-types";
import {Options, sync as conventionalCommitsParser} from 'conventional-commits-parser';
import conventionalCommitTypes from 'conventional-commit-types';
import _ from "lodash";

const defaultTypes = Object.keys(conventionalCommitTypes.types)
const breakingChangeLabel = "breaking-change"

// These options are copied from [1].
// [1] https://github.com/conventional-changelog/conventional-changelog/blob/3f60b464/packages/conventional-changelog-conventionalcommits/src/parser.js
export const parserOpts: Options = {
    headerPattern: /^(\w*)(?:\((.*)\))?!?: (.*)$/,
    breakingHeaderPattern: /^(\w*)(?:\((.*)\))?!: (.*)$/,
    headerCorrespondence: [
        'type',
        'scope',
        'subject'
    ],
    noteKeywords: ['BREAKING CHANGE', 'BREAKING-CHANGE'],
    revertPattern: /^(?:Revert|revert:)\s"?([\s\S]+?)"?\s*This reverts commit (\w*)\./i,
    revertCorrespondence: ['header', 'hash'],
    issuePrefixes: ['#']
}

async function main() {
    if (!context.payload.pull_request) {
        throw new Error(`Only pull request event supported. ${context.eventName} is unsupported.`)
    }

    const client = obtainClient("GITHUB_TOKEN")
    const payload = context.payload as PullRequestEvent
    const { owner, repo, number } = {
        owner: payload.pull_request.base.user.login,
        repo: payload.pull_request.base.repo.name,
        number: payload.pull_request.number,
    }
    const { data: pull_request } = await client.rest.pulls.get({
        owner, repo, pull_number: number,
    })

    const commit = conventionalCommitsParser(pull_request.title, parserOpts)
    core.info(`Receive commit: ${JSON.stringify(commit)}`)

    if (!commit.type) {
        throw Error(`Malformed commit: ${JSON.stringify(commit)}`)
    }

    if (!defaultTypes.includes(commit.type)) {
        throw Error(`Unexpected type ${JSON.stringify(commit.type)} of commit: ${JSON.stringify(commit)}`)
    }

    const breakingChanges = _.filter(commit.notes, _.matches({ title: 'BREAKING CHANGE'}))
    if (breakingChanges.length > 0) {
        await client.rest.issues.addLabels({
            owner, repo, issue_number: number, labels: [breakingChangeLabel]
        })
    }
}

main().catch(handleError)

```

### Core Architecture Module: `cyborg/bin/report-ci-failure.ts`
```
/*
 * Copyright 2023 Greptime Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as core from '@actions/core'
import {handleError, obtainClient} from "@/common"
import {context} from "@actions/github"
import _ from "lodash"

async function main() {
    const success = process.env["CI_REPORT_STATUS"] === "true"
    core.info(`CI_REPORT_STATUS=${process.env["CI_REPORT_STATUS"]}, resolved to ${success}`)

    const client = obtainClient("GITHUB_TOKEN")
    const title = `Workflow run '${context.workflow}' failed`
    const url = `${process.env["GITHUB_SERVER_URL"]}/${process.env["GITHUB_REPOSITORY"]}/actions/runs/${process.env["GITHUB_RUN_ID"]}`
    const failure_comment = `@GreptimeTeam/db-approver\nNew failure: ${url} `
    const success_comment = `@GreptimeTeam/db-approver\nBack to success: ${url}`

    const {owner, repo} = context.repo
    const labels = ['O-ci-failure']

    const issues = await client.paginate(client.rest.issues.listForRepo, {
        owner,
        repo,
        labels: labels.join(','),
        state: "open",
        sort: "created",
        direction: "desc",
    });
    const issue = _.find(issues, (i) => i.title === title);

    if (issue) { // exist issue
        core.info(`Found previous issue ${issue.html_url}`)
        if (!success) {
            await client.rest.issues.createComment({
                owner,
                repo,
                issue_number: issue.number,
                body: failure_comment,
            })
        } else {
            await client.rest.issues.createComment({
                owner,
                repo,
                issue_number: issue.number,
                body: success_comment,
            })
            await client.rest.issues.update({
                owner,
                repo,
                issue_number: issue.number,
                state: "closed",
                state_reason: "completed",
            })
        }
        core.setOutput("html_url", issue.html_url)
    } else if (!success) { // create new issue for failure
        const issue = await client.rest.issues.create({
            owner,
            repo,
            title,
            labels,
            body: failure_comment,
        })
        core.info(`Created issue ${issue.data.html_url}`)
        core.setOutput("html_url", issue.data.html_url)
    }
}

main().catch(handleError)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #9420** (2026-09-30): **fix(mito2): truncate parquet column index min/max for SST writes**
  *Symptoms*: I hereby agree to the terms of the [GreptimeDB CLA](https://github.com/GreptimeTeam/.github/blob/main/CLA.md).  ## Refer to a related PR or issue link (optional)  #6977 turned off both statistics truncation and column index truncation in the SST writers.  ## What's changed and what's your intention?  The SST writer (`ParquetWriter`) and `BulkPartEncoder` write the parquet column index with untruncated min/max values, so every page of a large string or binary field stores its full min and max values, uncompressed. Mito never reads the column index: it loads metadata with `PageIndexPolicy::Skip` for it and strips it before caching.  Both writers now truncate the column index to the parquet default of 64 bytes. Chunk statistics stay untruncated, since primary key pruning decodes them; `test_scan_corrupt` from #6977 still covers that case. A test pins both: truncated column index for a large field, exact `__primary_key` chunk statistics for a key longer than 64 bytes.  Measured on an agent trace workload where span payloads (LLM prompts) have a p50 of about 350KB, 36.66GB raw, written to S3 (MinIO) through a standalone instance:  | | main | This PR | Change | |---|---|---|---| | SST size after flush | 10.72 GB | 6.22 GB | −42% | | SST size after compaction | 9.18 GB | 6.20 GB | −32% | | Write throughput | 417 MB/s | 448 MB/s | +7% |  Query latency and bytes read from object storage are unchanged. On log-like data with 109-byte messages the file size does not change; the column in

- **Issue #9410** (2026-09-30): **feat(mito): wait for WAL durability before publishing a manifest watermark**
  *Symptoms*: I hereby agree to the terms of the [GreptimeDB CLA](https://github.com/GreptimeTeam/.github/blob/main/CLA.md).  ## Refer to a related PR or issue link (optional)  - RFC: #9195 - Tracking issue: #9197  ## What's changed and what's your intention?  This is the "Cross-region and cross-restart recovery tests" item of #9197, together with the Mito half of the durability barrier that the `enqueued` acknowledgement mode (#9358) left for the wiring (#9386).  **Durability barrier in Mito**  In the `enqueued` mode the object store WAL acknowledges an append before its object exists, so an entry id Mito holds may still be lost by a crash. If the manifest named such an id as flushed, a restart would skip the entries that get that id again. Mito now waits on `LogStore::wait_durable` before it records an entry id in the manifest: - A flush waits for its `last_entry_id` after the SSTs are written and before the manifest edit. The wait observes the flush's cancellation, so a drop or truncate that cancels the flush is not held up behind the upload. - A full truncate waits for its `truncated_entry_id`, and a discard of unflushed data for its `discarded_entry_id`, before the manifest action. A failed wait becomes the result of the request. - `WaitWalDurable` carries the log store's error. With the `durable` mode and with every other log store the wait returns at once (the trait default).  **Engine tests on the object store WAL**  `object_store_wal_recovery_test.rs` runs Mito on a real `ObjectSt
  **Post-Mortem & Fix Analysis**:
  > @codex review  When you finish, append exactly this marker to the review summary: <!-- review-bridge-request-id: rbreq-a4259b2c4aad583e2920917f52908bfe -->

- **Issue #9408** (2026-09-30): **perf: batch schema export requests**
  *Symptoms*: I hereby agree to the terms of the [GreptimeDB CLA](https://github.com/GreptimeTeam/.github/blob/main/CLA.md).  ## Refer to a related PR or issue link (optional)  Part of #9120 (PR10: Faster schema export).  ## What's changed and what's your intention?  Schema export currently builds a new HTTP client and sends one SHOW CREATE request per object. Reuse the client connection pool and share bounded multi-statement requests across legacy and V2 export: at most 128 statements and 128 KiB of escaped UTF-8 SQL per request. Validate every response without exposing arbitrary SQL or response bodies in client errors, and preserve database/physical-table/table/view order. Legacy schema failures now reach the command result and prevent a subsequent data export. V2 writes each schema's DDL after assembling it, reducing intermediate copies.  Focused tests cover batch boundaries, quoting, response errors, connection reuse, request context, legacy command failures and credential-safe errors. CLI regressions, real-server V1/packed roundtrips, targeted Clippy and formatting passed locally on macOS. The packed roundtrip crosses the batch boundary and verifies restored schema and values. Linux and Windows CI remain pending.  Diagnostic benchmark: actual debug CLI binaries, 10k one-row logical tables, 5 ms injected per HTTP request, A/B/B/A order. SHOW CREATE requests fell from 10004 to 79; median schema-only total time was 92.573 s vs 3.264 s, and full packed export was 90.068 s vs 6.516 s. All 

- **Issue #9395** (2026-09-29): **ci(query-regression): bump RUNNER_IMAGE_EPOCH to 7**
  *Symptoms*: Auto-generated by the `Rebuild query-regression runner image` job in https://github.com/GreptimeTeam/greptimedb/actions/runs/36513576720 for image `m-0xihbfzm5xpbxolybo6i`. Merging this invalidates the query-regression target cache (RUNNER_IMAGE_EPOCH 6 → 7). The `QUERY_REGRESSION_ECS_IMAGE_ID` repo variable already points at the new image; the epoch bump is belt-and-suspenders for image-content drift.

- **Issue #9394** (2026-09-29): **ci: retry failed nightly release on following weekdays**
  *Symptoms*:   I hereby agree to the terms of the [GreptimeDB CLA](https://github.com/GreptimeTeam/.github/blob/main/CLA.md).  ## Refer to a related PR or issue link (optional)  ## What's changed and what's your intention?  Previously the nightly release was scheduled only on Mondays, so a failed run left users without nightly builds for a whole week.  Now the schedule triggers every weekday at 00:00 UTC, but the release only proceeds when the latest published nightly release is older than NIGHTLY_RELEASE_MAX_AGE_DAYS (5) days. The check runs in allocate-runners before any EC2 runner is allocated, and gates all schedule-driven jobs (including the Slack notification, so a skipped nightly is silent). Tag pushes and manual dispatches are unaffected.  ## PR Checklist Please convert it to a draft if some of the following conditions are not met.  - [ ] I have written the necessary rustdoc comments. - [ ] I have added the necessary unit tests and integration tests. - [ ] This PR requires documentation updates. - [ ] API changes are backward compatible. - [ ] Schema or data changes are backward compatible. - [ ] This PR needs to be backported to release branches, and I have added the `backport-<target>` labels (e.g. `backport-v1.3` targets `release/v1.3`). 

- **Issue #9392** (2026-09-29): **chore: bump version to 1.3.0-beta.1**
  *Symptoms*: I hereby agree to the terms of the [GreptimeDB CLA](https://github.com/GreptimeTeam/.github/blob/main/CLA.md).  ## Refer to a related PR or issue link (optional)  Part of #9184.  ## What's changed and what's your intention?  Bump the workspace version on `main` from `1.3.0-alpha.1` to `1.3.0-beta.1` and update Cargo.lock for the first 1.3 beta release.  ## PR Checklist Please convert it to a draft if some of the following conditions are not met.  - [ ] I have written the necessary rustdoc comments. - [ ] I have added the necessary unit tests and integration tests. - [ ] This PR requires documentation updates. - [x] API changes are backward compatible. - [x] Schema or data changes are backward compatible. - [ ] This PR needs to be backported to release branches, and I have added the `backport-<target>` labels (e.g. `backport-v1.3` targets `release/v1.3`). 

- **Issue #9391** (2026-09-29): **fix(promql): resolve dotted column names as unqualified columns**
  *Symptoms*: I hereby agree to the terms of the [GreptimeDB CLA](https://github.com/GreptimeTeam/.github/blob/main/CLA.md).  ## Refer to a related PR or issue link (optional)  Close #9390  ## What's changed and what's your intention?  The PromQL planner fails with `No field named x.y` when a tag, field or time index column name contains a dot (e.g. `service.name` written by OTLP without name translation).  DataFusion's `col()`, `From<&str>` / `From<String> for Column`, and string join keys all go through `Column::from_qualified_name`, which parses `service.name` as column `name` of relation `service`. It also lowercases unquoted identifiers, so a column named `Host` breaks the same way.  This PR builds every column reference in `query::promql` and the `promql` crate with `Column::from_name` / `ident()`:  - `and` / `unless` join keys (any dotted tag or time index column, with or without `on(...)`) - `count_values` label, `topk` / `bottomk` sort key - negation and scalar-vector arithmetic on the field column - `timestamp()`, date functions (`minute()`, `hour()`, ...), field projection after aggregation - native histogram filters and the mixed classic/native `histogram_quantile` projection - Prometheus remote read label matchers and time range filter (`prom_store::query_to_plan`) - `expressions()` of the extension plan nodes (not observable today, but these expressions are supposed to reference the real columns)  A clippy `disallowed-methods` rule was considered and dropped: it catches direc

- **Issue #9390** (2026-09-29): **PromQL: and/unless, count_values and topk fail on column names containing a dot**
  *Symptoms*: ## What type of bug is this?  Incorrect result (query error)  ## What subsystems are affected?  Query Engine  ## Minimal reproduce step  ```sql CREATE TABLE "otel.m" (ts TIMESTAMP TIME INDEX, val DOUBLE, "service.name" STRING, PRIMARY KEY("service.name")); INSERT INTO "otel.m" VALUES (0, 1, 'a'), (0, 2, 'b');  TQL EVAL (0, 0, '1s') {"otel.m"} and {"otel.m"}; TQL EVAL (0, 0, '1s') {"otel.m"} unless on("service.name") {"otel.m", "service.name"="a"}; TQL EVAL (0, 0, '1s') count_values("v.name", {"otel.m"});  CREATE TABLE "otel.f" ("my.ts" TIMESTAMP TIME INDEX, "cpu.usage" DOUBLE, host STRING, PRIMARY KEY(host)); INSERT INTO "otel.f" VALUES (0, 1, 'a'), (0, 2, 'b');  TQL EVAL (0, 0, '1s') topk(1, {"otel.f"}); TQL EVAL (0, 0, '1s') {"otel.f"} and {"otel.f"}; ```  Column names like `service.name` are not SQL-only: OTLP metrics ingested with `x-greptime-otlp-metric-translation-strategy: NoUTF8EscapingWithSuffixes` or `NoTranslation` keep attribute names such as `service.name` as-is.  ## What did you expect to see?  The same results as for columns without dots. Selectors, `by`/`without` aggregations, `on`/`ignoring`/`group_left` arithmetic, `or`, `sort_by_label`, `label_join`, `absent`, `rate`, `scalar` and subqueries already work on these tables.  ## What did you see instead?  All of the queries above fail with, e.g.:  ``` Error: 3001(EngineExecuteQuery), No field named service.name. Did you mean '"otel.m"."service.name"'? ```  The planner builds column references from plain strings

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

### Incident Patch 1: `a314ac42` (2026-09-30)
**Commit Message**: fix(mito2): truncate parquet column index min/max for SST writes (#9420)

* fix(mito2): truncate parquet column index min/max for SST writes

The SST writer and the bulk part encoder disabled column index truncation
together with statistics truncation in #6977. Mito never reads the column
index, but every page of a large string or binary column still stored its
full min and max values, uncompressed. Truncate the column index to the
parquet default of 64 bytes and keep chunk statistics untruncated, since
primary key pruning decodes them.

Signed-off-by: Dennis Zhuang <killme2008@gmail.com>

* docs(mito2): note that the column index must not be used to decode primary keys

Signed-off-by: Dennis Zhuang <killme2008@gmail.com>

---------

Signed-off-by: Dennis Zhuang <killme2008@gmail.com>

**File**: `src/mito2/src/memtable/bulk/part.rs` (modified, +4/-2)
```diff
@@ -71,7 +71,9 @@ use crate::sst::SeriesEstimator;
 use crate::sst::index::IndexOutput;
 use crate::sst::parquet::flat_format::primary_key_column_index;
 use crate::sst::parquet::format::{PrimaryKeyArray, PrimaryKeyArrayBuilder};
-use crate::sst::parquet::{PARQUET_METADATA_KEY, SstInfo, apply_float_field_encoding};
+use crate::sst::parquet::{
+    COLUMN_INDEX_TRUNCATE_LENGTH, PARQUET_METADATA_KEY, SstInfo, apply_float_field_encoding,
+};
 
 const INIT_DICT_VALUE_CAPACITY: usize = 8;
 
@@ -1334,7 +1336,7 @@ impl BulkPartEncoder {
             .set_write_batch_size(row_group_size)
             .set_max_row_group_row_count(Some(row_group_size))
             .set_compression(Compression::ZSTD(ZstdLevel::default()))
-            .set_column_index_truncate_length(None)
+            .set_column_index_truncate_length(COLUMN_INDEX_TRUNCATE_LENGTH)
             .set_statistics_truncate_length(None);
         props = apply_float_field_encoding(props, &metadata, float_field_encoding);
         let writer_props = Some(props.build());
```

**File**: `src/mito2/src/sst/parquet.rs` (modified, +114/-0)
```diff
@@ -77,6 +77,18 @@ pub(crate) struct Json2TargetLayout {
 /// batching without changing the row group layout of newly written SSTs.
 pub const DEFAULT_ROW_GROUP_SIZE: usize = 100 * 1024;
 
+/// Truncation length of min/max values in the parquet column index.
+///
+/// Mito never reads the column index (it is skipped or stripped on load), so truncating
+/// it is safe. Chunk statistics stay untruncated because pruning decodes primary keys
+/// from them. Without truncation every page of a large string column stores its whole
+/// min and max values, uncompressed.
+///
+/// Truncated values are only bounds: code that starts reading the column index must not
+/// decode primary keys from it.
+pub(crate) const COLUMN_INDEX_TRUNCATE_LENGTH: Option<usize> =
+    parquet::file::properties::DEFAULT_COLUMN_INDEX_TRUNCATE_LENGTH;
+
 /// Applies the configured encoding to direct floating-point field columns.
 pub(crate) fn apply_float_field_encoding(
     mut builder: WriterPropertiesBuilder,
@@ -901,6 +913,82 @@ mod tests {
         .await;
     }
 
+    #[tokio::test]
+    async fn test_column_index_truncates_large_field_values() {
+        let mut env = TestEnv::new().await;
+        let object_store = env.init_object_store_manager();
+        let handle = sst_file_handle(0, 1000);
+        let file_path = FixedPathProvider {
+            region_file_id: handle.file_id(),
+        };
+        let metadata = build_test_binary_test_region_metadata();
+        // A tag long enough that the encoded primary key exceeds the 64-byte truncation length.
+        let tag = "t".repeat(100);
+        let values: Vec<Vec<u8>> = (0..64)
+            .map(|i| format!("{i:08}").into_bytes().repeat(4 * 1024))
+            .collect();
+        let batch = new_record_batch_with_binary_values(&tag, &values);
+        let mut metrics = Metrics::new(WriteType::Flush);
+        let mut writer = ParquetWriter::new_with_object_store(
+            object_store.clone(),
+            metadata.clone(),
+            IndexConfig::default(),
+            NoopIndexBuilder,
+            file_path,
+            &mut metrics,
+        )
+        .await;
+        writer
+            .write_all_flat_as_primary_key(
+                new_flat_source_from_record_batches(vec![batch]),
+                None,
+                &WriteOptions::default(),
+            )
+            .await
+            .unwrap();
+
+        let path = handle.file_path(FILE_DIR, PathType::Bare);
+        let bytes = object_store.read(&path).await.unwrap().to_bytes();
+        let options = parquet::arrow::arrow_reader::ArrowReaderOptions::new()
+            .with_page_index_policy(PageIndexPolicy::Required);
+        let builder =
+            ParquetRecordBatchReaderBuilder::try_new_with_options(bytes, options).unwrap();
+        let parquet_meta = builder.metadata().clone();
+        let schema = parquet_meta.file_metadata().schema_descr();
+        let column = |name: &str| {
+            (0..schema.num_columns())
+                .find(|i| schema.column(*i).name() == name)
+                .unwrap()
+        };
+
+        let field_index = &parquet_meta.column_index().unwrap()[0][column("field_0")];
+        let parquet::file::page_index::column_index::ColumnIndexMetaData::BYTE_ARRAY(field_index) =
+            field_index
+        else {
+            panic!("unexpected column index: {field_index:?}");
+        };
+        let mut pages = 0;
+        for (min, max) in field_index
+            .min_values_iter()
+            .zip(field_index.max_values_iter())
+        {
+            assert!(min.unwrap().len() <= 64);
+            assert!(max.unwrap().len() <= 64);
+            pages += 1;
+        }
+        assert!(pages > 1, "values should span several pages");
+
+        // Chunk statistics keep exact primary keys; pruning decodes them.
+        let pk_stats = parquet_meta
+            .row_group(0)
+            .column(column(store_api::storage::consts::PRIMARY_KEY_COLUMN_NAME))
+           
```

**File**: `src/mito2/src/sst/parquet/writer.rs` (modified, +3/-2)
```diff
@@ -62,7 +62,8 @@ use crate::sst::parquet::flat_format::{
 };
 use crate::sst::parquet::format::{PrimaryKeyArray, PrimaryKeyWriteFormat};
 use crate::sst::parquet::{
-    PARQUET_METADATA_KEY, SstInfo, WriteOptions, apply_float_field_encoding,
+    COLUMN_INDEX_TRUNCATE_LENGTH, PARQUET_METADATA_KEY, SstInfo, WriteOptions,
+    apply_float_field_encoding,
 };
 use crate::sst::{
     DEFAULT_WRITE_CONCURRENCY, FlatSchemaOptions, SeriesEstimator, maybe_wrap_schema,
@@ -544,7 +545,7 @@ where
                 .set_compression(Compression::ZSTD(ZstdLevel::default()))
                 .set_encoding(Encoding::PLAIN)
                 .set_max_row_group_row_count(Some(opts.row_group_size))
-                .set_column_index_truncate_length(None)
+                .set_column_index_truncate_length(COLUMN_INDEX_TRUNCATE_LENGTH)
                 .set_statistics_truncate_length(None);
             let ts_col = ColumnPath::new(vec![
                 self.metadata.time_index_column().column_schema.name.clone(),
```

---

### Incident Patch 2: `78a7b932` (2026-09-30)
**Commit Message**: fix(promql): align timestamp(), label_join and label_replace with Prometheus semantics (#9385)

* fix(promql): align timestamp() and label_join with Prometheus semantics

- timestamp() over a selector reports the selected sample's timestamp, without adding the offset.
- timestamp() over any other expression reports the evaluation time instead of the input value.
- label_join that overwrites an existing label rejects duplicate label sets at runtime.

Signed-off-by: Dennis Zhuang <killme2008@gmail.com>

* fix(promql): align label_replace and label_join edge cases with Prometheus

- label_replace leaves non-matching series unchanged instead of copying the source value into the destination label.
- label_replace may overwrite an existing label; duplicate label sets are rejected at runtime like label_join.
- label_join with no source labels removes the destination label, and an empty source label name is rejected.
- Empty label values produced by these functions are NULL, the same as an absent label.

Signed-off-by: Dennis Zhuang <killme2008@gmail.com>

* fix(promql): join absent labels as empty strings in label_join

concat_ws skips NULL arguments together with their separator, so a la

**File**: `src/promql/src/functions/vector_matching.rs` (modified, +5/-0)
```diff
@@ -34,6 +34,8 @@ pub enum MatchGroupViolation {
     ImplicitManyToOne,
     /// A group modifier left several matches with the same result label set.
     AmbiguousGroupLabels,
+    /// A function rewrote labels so that several series share the same label set.
+    DuplicateLabelSet,
 }
 
 impl MatchGroupViolation {
@@ -54,6 +56,9 @@ impl MatchGroupViolation {
             Self::AmbiguousGroupLabels => format!(
                 "multiple matches for labels {group}: grouping labels must ensure unique matches"
             ),
+            Self::DuplicateLabelSet => {
+                "vector cannot contain metrics with the same labelset".to_string()
+            }
         }
     }
 }
```

**File**: `src/query/src/promql/error.rs` (modified, +0/-7)
```diff
@@ -217,12 +217,6 @@ pub enum Error {
         location: Location,
     },
 
-    #[snafu(display("vector cannot contain metrics with the same labelset"))]
-    SameLabelSet {
-        #[snafu(implicit)]
-        location: Location,
-    },
-
     #[snafu(display("Invalid regular expression in label_replace(): {}", regex))]
     InvalidRegularExpression {
         regex: String,
@@ -256,7 +250,6 @@ impl ErrorExt for Error {
             | CombineTableColumnMismatch { .. }
             | UnexpectedPlanExpr { .. }
             | UnsupportedMatcherOp { .. }
-            | SameLabelSet { .. }
             | TimestampOutOfRange { .. }
             | SystemTimeOutOfRange { .. }
             | AtModifierTimestampOutOfRange { .. }
```

**File**: `src/query/src/promql/planner.rs` (modified, +167/-138)
```diff
@@ -107,7 +107,7 @@ use crate::promql::error::{
     CatalogSnafu, ColumnNotFoundSnafu, DataFusionPlanningSnafu, ExpectRangeSelectorSnafu,
     FunctionInvalidArgumentSnafu, InvalidDestinationLabelNameSnafu, InvalidRegularExpressionSnafu,
     InvalidTimeRangeSnafu, MultiFieldsNotSupportedSnafu, MultipleMetricMatchersSnafu,
-    MultipleVectorSnafu, NoMetricMatcherSnafu, Result, SameLabelSetSnafu, TableNameNotFoundSnafu,
+    MultipleVectorSnafu, NoMetricMatcherSnafu, Result, TableNameNotFoundSnafu,
     TimeIndexNotFoundSnafu, UnexpectedPlanExprSnafu, UnexpectedTokenSnafu, UnknownTableSnafu,
     UnsupportedExprSnafu, UnsupportedMatcherOpSnafu, ValueNotFoundSnafu, ZeroRangeSelectorSnafu,
 };
@@ -1752,47 +1752,9 @@ impl PromPlanner {
                     DfExpr::Column(Column::new(qualifier.cloned(), field.name().clone()))
                 })
                 .collect::<Vec<_>>();
-            // `timestamp()` preserves the shifted selector timeline even though
-            // SeriesNormalize now retains raw native timestamp storage. Decimal
-            // arithmetic shifts before truncating to milliseconds.
-            let unit_factor = match ident(&time_index_column)
-                .get_type(normalize.schema())
-                .context(DataFusionPlanningSnafu)?
-            {
-                ArrowDataType::Timestamp(ArrowTimeUnit::Second, _) => (1_000_i128, 4, 0),
-                ArrowDataType::Timestamp(ArrowTimeUnit::Millisecond, _) => (1, 1, 0),
-                ArrowDataType::Timestamp(ArrowTimeUnit::Microsecond, _) => (1, 4, 3),
-                ArrowDataType::Timestamp(ArrowTimeUnit::Nanosecond, _) => (1, 7, 6),
-                _ => unreachable!("time index is a timestamp"),
-            };
-            let sample_time = ident(&time_index_column)
-                .cast_to(&ArrowDataType::Int64, normalize.schema())
-                .context(DataFusionPlanningSnafu)?
-                .cast_to(&ArrowDataType::Decimal128(19, 0), normalize.schema())
-                .context(DataFusionPlanningSnafu)?;
-            let sample_time = DfExpr::BinaryExpr(BinaryExpr {
-                left: Box::new(sample_time),
-                op: Operator::Multiply,
-                right: Box::new(lit(ScalarValue::Decimal128(
-                    Some(unit_factor.0),
-                    unit_factor.1,
-                    unit_factor.2,
-                ))),
-            });
-            let sample_time = DfExpr::BinaryExpr(BinaryExpr {
-                left: Box::new(sample_time),
-                op: Operator::Plus,
-                right: Box::new(lit(ScalarValue::Decimal128(Some(offset_ms as i128), 19, 0))),
-            })
-            .cast_to(&ArrowDataType::Int64, normalize.schema())
-            .context(DataFusionPlanningSnafu)?
-            .cast_to(&ArrowDataType::Float64, normalize.schema())
-            .context(DataFusionPlanningSnafu)?;
-            let sample_time = DfExpr::BinaryExpr(BinaryExpr {
-                left: Box::new(sample_time),
-                op: Operator::Divide,
-                right: Box::new(lit(1000.0)),
-            });
+            // The time index still holds the raw sample timestamp here, which is what
+            // `timestamp()` reports regardless of `offset` and `@`.
+            let sample_time = Self::timestamp_seconds_expr(&time_index_column, normalize.schema())?;
             project_exprs.push(sample_time.alias(&timestamp_value_column));
             let normalize = LogicalPlanBuilder::from(normalize)
                 .project(project_exprs)
@@ -1846,47 +1808,60 @@ impl PromPlanner {
             }),
         };
         if let Some(timestamp_value_column) = timestamp_value_column {
-            self.create_timestamp_func_plan(manipulate, &timestamp_value_column)
+            self.create_timestamp_func_plan(manipulate, ident(timestamp_value_column))
         } else {
             Ok(manipulate)
         }
     }
 
-    /// Builds a projection plan for the PromQL `timestamp()` fu
```

**File**: `src/query/src/promql/planner/test.rs` (modified, +12/-11)
```diff
@@ -1699,12 +1699,13 @@ async fn single_timestamp_plan_preserves_source_value() {
         "Filter: value IS NOT NULL [timestamp:Timestamp(ms), value:Float64, tag_0:Utf8]\
             \n  Projection: some_metric.timestamp, value AS value, some_metric.tag_0 [timestamp:Timestamp(ms), value:Float64, tag_0:Utf8]\
             \n    Projection: some_metric.timestamp, __promql_timestamp_value_ AS value, some_metric.tag_0 [timestamp:Timestamp(ms), value:Float64, tag_0:Utf8]\
-            \n      PromInstantManipulate: range=[0..100000000], lookback=[1000], interval=[5000], time index=[timestamp] [tag_0:Utf8, timestamp:Timestamp(ms), field_0:Float64;N, __promql_timestamp_value_:Float64]\
-            \n        Projection: some_metric.tag_0, some_metric.timestamp, some_metric.field_0, CAST(CAST(CAST(CAST(some_metric.timestamp AS Int64) AS Decimal128(19, 0)) * Decimal128(1,1,0) + Decimal128(0,19,0) AS Int64) AS Float64) / Float64(1000) AS __promql_timestamp_value_ [tag_0:Utf8, timestamp:Timestamp(ms), field_0:Float64;N, __promql_timestamp_value_:Float64]\
-            \n          PromSeriesDivide: tags=[\"tag_0\"] [tag_0:Utf8, timestamp:Timestamp(ms), field_0:Float64;N]\
-            \n            Sort: some_metric.tag_0 ASC NULLS FIRST, some_metric.timestamp ASC NULLS FIRST [tag_0:Utf8, timestamp:Timestamp(ms), field_0:Float64;N]\
-            \n              Filter: some_metric.tag_0 != Utf8(\"bar\") AND some_metric.timestamp >= TimestampMillisecond(-999, None) AND some_metric.timestamp <= TimestampMillisecond(100000000, None) [tag_0:Utf8, timestamp:Timestamp(ms), field_0:Float64;N]\
-            \n                TableScan: some_metric [tag_0:Utf8, timestamp:Timestamp(ms), field_0:Float64;N]",
+            \n      Filter: some_metric.field_0 IS NOT NULL [tag_0:Utf8, timestamp:Timestamp(ms), field_0:Float64;N, __promql_timestamp_value_:Float64]\
+            \n        PromInstantManipulate: range=[0..100000000], lookback=[1000], interval=[5000], time index=[timestamp] [tag_0:Utf8, timestamp:Timestamp(ms), field_0:Float64;N, __promql_timestamp_value_:Float64]\
+            \n          Projection: some_metric.tag_0, some_metric.timestamp, some_metric.field_0, CAST(CAST(some_metric.timestamp AS Int64) AS Float64) / Float64(1000) AS __promql_timestamp_value_ [tag_0:Utf8, timestamp:Timestamp(ms), field_0:Float64;N, __promql_timestamp_value_:Float64]\
+            \n            PromSeriesDivide: tags=[\"tag_0\"] [tag_0:Utf8, timestamp:Timestamp(ms), field_0:Float64;N]\
+            \n              Sort: some_metric.tag_0 ASC NULLS FIRST, some_metric.timestamp ASC NULLS FIRST [tag_0:Utf8, timestamp:Timestamp(ms), field_0:Float64;N]\
+            \n                Filter: some_metric.tag_0 != Utf8(\"bar\") AND some_metric.timestamp >= TimestampMillisecond(-999, None) AND some_metric.timestamp <= TimestampMillisecond(100000000, None) [tag_0:Utf8, timestamp:Timestamp(ms), field_0:Float64;N]\
+            \n                  TableScan: some_metric [tag_0:Utf8, timestamp:Timestamp(ms), field_0:Float64;N]",
     );
 
     assert_eq!(plan.display_indent_schema().to_string(), expected);
@@ -2413,9 +2414,9 @@ async fn at_modifier_keeps_multi_series_roots_out_of_promoted_subtree() {
 async fn at_modifier_does_not_promote_label_join() {
     for query in [
         // Directly above the anchored instant selector...
-        "label_join(some_metric @ 300, \"tag_0\", \"-\", \"\")",
+        "label_join(some_metric @ 300, \"tag_0\", \"-\", \"tag_0\", \"tag_0\")",
         // ... and below another call, which is planned as usual over the join.
-        "abs(label_join(some_metric @ 300, \"tag_0\", \"-\", \"\"))",
+        "abs(label_join(some_metric @ 300, \"tag_0\", \"-\", \"tag_0\", \"tag_0\"))",
     ] {
         let plan = build_at_modifier_plan(query, 0, 1000).await;
         let plan_str = plan.display_indent_schema().to_string();
@@ -2448,7 +2449,7 @@ async fn at_modifier_does_not_promote_label_join() {
     // A range call below the join is still 
```

**File**: `src/query/src/promql/planner/test/delta.rs` (modified, +2/-2)
```diff
@@ -1102,12 +1102,12 @@ async fn delta_offsets_survive_optimized_plan_serialization() {
         (
             "timestamp positive offset",
             r#"timestamp(delta_metric{series="cumulative"} offset 60s)"#,
-            120.0,
+            60.0,
         ),
         (
             "timestamp negative offset",
             r#"timestamp(delta_metric{series="cumulative"} offset -60s)"#,
-            120.0,
+            180.0,
         ),
         (
             "range positive offset",
```

---

### Incident Patch 3: `3131cdbc` (2026-09-29)
**Commit Message**: fix: bound decompressed request size and close memory-admission gaps for compressed requests (#9264)

* fix: bound decompressed request size and close memory-admission gaps for compressed requests

The request-memory accounting only bounds and charges the encoded bytes on
the wire, but a compressed body can expand far beyond that during
decompression, so tiny requests could allocate disproportionate frontend
memory before any protobuf validation or quota charge.

- Handler-level decompression (Prometheus remote read/write v1+v2, Loki)
  now enforces a hard 512 MiB decoded-size cap, checked before any output
  buffer is allocated, and charges the decoded bytes to the shared
  ServerMemoryLimiter, holding the permits for the lifetime of the
  decompressed buffer.
- gRPC requests with transport compression reserve the configured
  max_recv_message_size before tonic decompresses, so the decoding phase
  is admitted against max_in_flight_write_bytes; the later per-message
  charge is skipped to avoid double accounting.
- The HTTP memory-limit middleware keeps its upfront Content-Length charge
  but now also accounts the bytes actually streamed beyond it, so chunked
  requests and unders

**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -13589,6 +13589,7 @@ dependencies = [
  "hex",
  "hostname 0.3.1",
  "http 1.5.0",
+ "http-body 1.0.1",
  "humantime",
  "humantime-serde",
  "hyper 1.6.0",
```

**File**: `src/servers/Cargo.toml` (modified, +1/-0)
```diff
@@ -70,6 +70,7 @@ headers = "0.4"
 hex.workspace = true
 hostname = "0.3"
 http.workspace = true
+http-body = "1"
 humantime.workspace = true
 humantime-serde.workspace = true
 hyper = { workspace = true, features = ["full"] }
```

**File**: `src/servers/src/error.rs` (modified, +13/-0)
```diff
@@ -319,6 +319,18 @@ pub enum Error {
         error: std::io::Error,
     },
 
+    #[snafu(display(
+        "Decompressed request body is too large: {} bytes exceeds the limit {} bytes",
+        size,
+        limit
+    ))]
+    DecompressedBodyTooLarge {
+        size: u64,
+        limit: u64,
+        #[snafu(implicit)]
+        location: Location,
+    },
+
     #[snafu(display("Failed to compress prometheus remote request"))]
     CompressPromRemoteRequest {
         #[snafu(implicit)]
@@ -785,6 +797,7 @@ impl ErrorExt for Error {
             | DecompressSnappyPromRemoteRequest { .. }
             | DecompressSnappyLokiRequest { .. }
             | DecompressZstdPromRemoteRequest { .. }
+            | DecompressedBodyTooLarge { .. }
             | InvalidPromRemoteRequest { .. }
             | InvalidFlightTicket { .. }
             | InvalidPrepareStatement { .. }
```

**File**: `src/servers/src/grpc.rs` (modified, +10/-8)
```diff
@@ -50,6 +50,7 @@ use tonic::{Request, Response, Status};
 use tonic_reflection::server::v1::{ServerReflection, ServerReflectionServer};
 
 use crate::error::{AlreadyStartedSnafu, InternalSnafu, Result, StartGrpcSnafu, TcpBindSnafu};
+use crate::grpc::memory_limit::MemoryLimiterExtensionService;
 use crate::install_default_crypto_provider;
 use crate::metrics::MetricsMiddlewareLayer;
 use crate::otel_arrow::{HeaderInterceptor, OtelArrowServiceHandler};
@@ -213,6 +214,14 @@ impl FlightCompression {
     }
 }
 
+/// The wrapped OTLP Arrow service type used by [`GrpcServer`].
+type OtelArrowService = MemoryLimiterExtensionService<
+    InterceptedService<
+        ArrowMetricsServiceServer<OtelArrowServiceHandler<OpenTelemetryProtocolHandlerRef>>,
+        HeaderInterceptor,
+    >,
+>;
+
 pub struct GrpcServer {
     // states
     shutdown_tx: Mutex<Option<Sender<()>>>,
@@ -224,14 +233,7 @@ pub struct GrpcServer {
     // tls config
     tls_config: Option<ServerTlsConfig>,
     // Otel arrow service
-    otel_arrow_service: Mutex<
-        Option<
-            InterceptedService<
-                ArrowMetricsServiceServer<OtelArrowServiceHandler<OpenTelemetryProtocolHandlerRef>>,
-                HeaderInterceptor,
-            >,
-        >,
-    >,
+    otel_arrow_service: Mutex<Option<OtelArrowService>>,
     bind_addr: Option<SocketAddr>,
     name: Option<String>,
     config: GrpcServerConfig,
```

**File**: `src/servers/src/grpc/builder.rs` (modified, +15/-4)
```diff
@@ -34,12 +34,13 @@ use tonic::codegen::Service;
 use tonic::service::RoutesBuilder;
 use tonic::service::interceptor::InterceptedService;
 use tonic::transport::{Identity, ServerTlsConfig};
-use tower::Layer;
+use tower::{Layer, ServiceBuilder};
 
 use crate::grpc::database::DatabaseService;
 use crate::grpc::flight::{FlightCraftRef, FlightCraftWrapper};
 use crate::grpc::frontend_grpc_handler::FrontendGrpcHandler;
 use crate::grpc::greptime_handler::GreptimeRequestHandler;
+use crate::grpc::memory_limit::{MemoryLimiterExtensionLayer, MemoryLimiterExtensionService};
 use crate::grpc::prom_query_gateway::PrometheusGatewayService;
 use crate::grpc::region_server::{RegionServerHandlerRef, RegionServerRequestHandler};
 use crate::grpc::{GrpcServer, GrpcServerConfig};
@@ -71,6 +72,7 @@ macro_rules! add_service {
         let service_with_limiter = $crate::tower::ServiceBuilder::new()
             .layer(MemoryLimiterExtensionLayer::new(
                 $builder.memory_limiter().clone(),
+                max_recv_message_size,
             ))
             .service(service_builder);
 
@@ -87,9 +89,11 @@ pub struct GrpcServerBuilder {
     routes_builder: RoutesBuilder,
     tls_config: Option<ServerTlsConfig>,
     otel_arrow_service: Option<
-        InterceptedService<
-            ArrowMetricsServiceServer<OtelArrowServiceHandler<OpenTelemetryProtocolHandlerRef>>,
-            HeaderInterceptor,
+        MemoryLimiterExtensionService<
+            InterceptedService<
+                ArrowMetricsServiceServer<OtelArrowServiceHandler<OpenTelemetryProtocolHandlerRef>>,
+                HeaderInterceptor,
+            >,
         >,
     >,
     memory_limiter: ServerMemoryLimiter,
@@ -185,6 +189,13 @@ impl GrpcServerBuilder {
             .accept_compressed(CompressionEncoding::Zstd)
             .send_compressed(CompressionEncoding::Zstd);
         let svc = InterceptedService::new(server, HeaderInterceptor {});
+        // Same pre-decode memory admission as `add_service!`.
+        let svc = ServiceBuilder::new()
+            .layer(MemoryLimiterExtensionLayer::new(
+                self.memory_limiter.clone(),
+                self.config.max_recv_message_size,
+            ))
+            .service(svc);
         self.otel_arrow_service = Some(svc);
         self
     }
```

---

### Incident Patch 4: `218000e2` (2026-09-29)
**Commit Message**: fix(promql): resolve dotted column names as unqualified columns (#9391)

* fix(promql): resolve dotted column names as unqualified columns

col(), From<&str>/From<String> for Column and string join keys go through
Column::from_qualified_name, which splits `service.name` into relation
`service` and column `name` and lowercases unquoted identifiers. Build
PromQL column references with Column::from_name / ident() instead.

Signed-off-by: Dennis Zhuang <killme2008@gmail.com>

* fix(servers): resolve remote read matcher labels as unqualified columns

Signed-off-by: Dennis Zhuang <killme2008@gmail.com>

* test(promql): cover same-name columns differing in case and without()

Signed-off-by: Dennis Zhuang <killme2008@gmail.com>

---------

Signed-off-by: Dennis Zhuang <killme2008@gmail.com>

**File**: `src/promql/src/extension_plan/absent.rs` (modified, +2/-2)
```diff
@@ -34,7 +34,7 @@ use datafusion::physical_plan::{
     Partitioning, PhysicalExpr, PlanProperties, RecordBatchStream, SendableRecordBatchStream,
 };
 use datafusion_common::DFSchema;
-use datafusion_expr::{EmptyRelation, col};
+use datafusion_expr::{EmptyRelation, ident};
 use datatypes::arrow;
 use datatypes::arrow::array::{ArrayRef, Float64Array, TimestampMillisecondArray};
 use datatypes::arrow::datatypes::{DataType, Field, SchemaRef, TimeUnit};
@@ -108,7 +108,7 @@ impl UserDefinedLogicalNodeCore for Absent {
             return vec![];
         }
 
-        vec![col(&self.time_index_column)]
+        vec![ident(&self.time_index_column)]
     }
 
     fn necessary_children_exprs(&self, _output_columns: &[usize]) -> Option<Vec<Vec<usize>>> {
```

**File**: `src/promql/src/extension_plan/empty_metric.rs` (modified, +2/-2)
```diff
@@ -40,7 +40,7 @@ use datafusion::physical_plan::{
     SendableRecordBatchStream, StatisticsArgs,
 };
 use datafusion::physical_planner::PhysicalPlanner;
-use datafusion::prelude::{Expr, col, lit};
+use datafusion::prelude::{Expr, ident, lit};
 use datafusion_expr::LogicalPlanBuilder;
 use datatypes::arrow::array::TimestampMillisecondArray;
 use datatypes::arrow::datatypes::SchemaRef;
@@ -409,7 +409,7 @@ fn build_ts_only_schema(column_name: &str) -> DFSchema {
 pub fn build_special_time_expr(time_index_column_name: &str) -> Expr {
     let input_schema = build_ts_only_schema(time_index_column_name);
     // safety: should not failed (UT covers this)
-    col(time_index_column_name)
+    ident(time_index_column_name)
         .cast_to(&DataType::Int64, &input_schema)
         .unwrap()
         .cast_to(&DataType::Float64, &input_schema)
```

**File**: `src/promql/src/extension_plan/histogram_fold.rs` (modified, +5/-5)
```diff
@@ -41,7 +41,7 @@ use datafusion::physical_plan::{
     SendableRecordBatchStream, StatisticsArgs,
 };
 use datafusion::prelude::{Column, Expr};
-use datafusion_expr::{EmptyRelation, col};
+use datafusion_expr::{EmptyRelation, ident};
 use datatypes::arrow_array::string_array_value_at_index;
 use datatypes::prelude::{ConcreteDataType, DataType as GtDataType};
 use datatypes::value::{OrderedF64, Value, ValueRef};
@@ -141,14 +141,14 @@ impl UserDefinedLogicalNodeCore for HistogramFold {
         }
 
         let mut exprs = vec![
-            col(&self.le_column),
-            col(&self.ts_column),
-            col(&self.field_column),
+            ident(&self.le_column),
+            ident(&self.ts_column),
+            ident(&self.field_column),
         ];
         exprs.extend(self.input.schema().fields().iter().filter_map(|f| {
             let name = f.name();
             if name != &self.le_column && name != &self.ts_column && name != &self.field_column {
-                Some(col(name))
+                Some(ident(name))
             } else {
                 None
             }
```

**File**: `src/promql/src/extension_plan/instant_manipulate.rs` (modified, +3/-3)
```diff
@@ -37,7 +37,7 @@ use datafusion::physical_plan::{
     PhysicalExpr, PlanProperties, RecordBatchStream, SendableRecordBatchStream, Statistics,
     StatisticsArgs,
 };
-use datafusion_expr::col;
+use datafusion_expr::ident;
 use datatypes::arrow::compute;
 use datatypes::timestamp::timestamp_array_to_primitive;
 use futures::{Stream, StreamExt, ready};
@@ -140,8 +140,8 @@ impl UserDefinedLogicalNodeCore for InstantManipulate {
             return vec![];
         }
 
-        let mut exprs = vec![col(&self.time_index_column)];
-        exprs.extend(self.staleness_field_columns().map(col));
+        let mut exprs = vec![ident(&self.time_index_column)];
+        exprs.extend(self.staleness_field_columns().map(ident));
         exprs
     }
 
```

**File**: `src/promql/src/extension_plan/normalize.rs` (modified, +3/-3)
```diff
@@ -33,7 +33,7 @@ use datafusion::physical_plan::{
     InputDistributionRequirements, PhysicalExpr, PlanProperties, RecordBatchStream,
     SendableRecordBatchStream, StatisticsArgs,
 };
-use datafusion_expr::col;
+use datafusion_expr::ident;
 use datatypes::arrow::array::TimestampMillisecondArray;
 use datatypes::arrow::datatypes::{SchemaRef, TimestampMillisecondType};
 use datatypes::arrow::record_batch::RecordBatch;
@@ -93,8 +93,8 @@ impl UserDefinedLogicalNodeCore for SeriesNormalize {
 
         self.tag_columns
             .iter()
-            .map(col)
-            .chain(std::iter::once(col(&self.time_index_column_name)))
+            .map(ident)
+            .chain(std::iter::once(ident(&self.time_index_column_name)))
             .collect()
     }
 
```

---

### Incident Patch 5: `abf1396c` (2026-09-29)
**Commit Message**: fix(client): yield Flight batches and affected rows without waiting for next message (#8918)

* fix(client): avoid Flight metrics lookahead stalls

Signed-off-by: discord9 <55937128+discord9@users.noreply.github.com>

* refactor(client): extract trailing Flight metrics task

Signed-off-by: discord9 <55937128+discord9@users.noreply.github.com>

* test(client): synchronize trailing metrics and bound cancellation

Signed-off-by: discord9 <55937128+discord9@users.noreply.github.com>

---------

Signed-off-by: discord9 <55937128+discord9@users.noreply.github.com>

**File**: `src/client/src/database.rs` (modified, +303/-45)
```diff
@@ -16,7 +16,7 @@ use std::collections::HashMap;
 use std::pin::Pin;
 use std::str::FromStr;
 use std::sync::atomic::{AtomicBool, Ordering};
-use std::sync::{Arc, RwLock};
+use std::sync::{Arc, Mutex, RwLock};
 use std::task::{Context, Poll};
 use std::time::Duration;
 
@@ -55,6 +55,7 @@ use futures::future;
 use futures_util::{Stream, StreamExt, TryStreamExt};
 use prost::Message;
 use snafu::{IntoError, ResultExt};
+use tokio::sync::Notify;
 use tonic::metadata::{AsciiMetadataKey, AsciiMetadataValue, MetadataMap, MetadataValue};
 use tonic::transport::Channel;
 
@@ -70,20 +71,47 @@ type FlightDataStream = Pin<Box<dyn Stream<Item = FlightData> + Send>>;
 type DoPutResponseStream = Pin<Box<dyn Stream<Item = Result<DoPutResponse>>>>;
 
 const HINTS_METADATA_KEY: &str = "x-greptime-hints";
+/// Maximum time to wait for the optional trailing metrics message after
+/// affected rows have already been delivered.
+const FLIGHT_TRAILING_METRICS_TIMEOUT: Duration = Duration::from_secs(5);
 
 /// Terminal metrics associated with a query output.
 ///
 /// For streaming outputs, metrics are only final after the stream is fully
-/// drained and [`Self::is_ready`] returns `true`.
+/// drained and [`Self::is_ready`] returns `true`. Affected-row outputs may
+/// briefly await a compatibility trailing metrics message.
 #[derive(Debug, Clone, Default)]
 pub struct OutputMetrics {
     inner: Arc<OutputMetricsInner>,
 }
 
-#[derive(Debug, Default)]
+#[derive(Debug)]
 struct OutputMetricsInner {
     metrics: RwLock<Option<RecordBatchMetrics>>,
+    completion_error: RwLock<Option<String>>,
     ready: AtomicBool,
+    ready_notify: Notify,
+    compatibility_task: Mutex<Option<tokio::task::AbortHandle>>,
+}
+
+impl Default for OutputMetricsInner {
+    fn default() -> Self {
+        Self {
+            metrics: RwLock::new(None),
+            completion_error: RwLock::new(None),
+            ready: AtomicBool::new(false),
+            ready_notify: Notify::new(),
+            compatibility_task: Mutex::new(None),
+        }
+    }
+}
+
+impl Drop for OutputMetricsInner {
+    fn drop(&mut self) {
+        if let Some(handle) = self.compatibility_task.get_mut().unwrap().take() {
+            handle.abort();
+        }
+    }
 }
 
 impl OutputMetrics {
@@ -98,10 +126,45 @@ impl OutputMetrics {
 
     /// Marks the terminal metrics as final for this output.
     pub fn mark_ready(&self) {
-        let _ = self
+        if self
             .inner
             .ready
-            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire);
+            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
+            .is_ok()
+        {
+            self.inner.ready_notify.notify_waiters();
+        }
+    }
+
+    /// Waits until terminal metrics are final.
+    pub async fn wait_ready(&self) {
+        loop {
+            let notified = self.inner.ready_notify.notified();
+            if self.is_ready() {
+                return;
+            }
+            notified.await;
+        }
+    }
+
+    /// Returns an error encountered while completing the output, if any.
+    pub fn completion_error(&self) -> Option<String> {
+        self.inner.completion_error.read().unwrap().clone()
+    }
+
+    fn set_completion_error(&self, error: impl Into<String>) {
+        *self.inner.completion_error.write().unwrap() = Some(error.into());
+    }
+
+    fn set_compatibility_task(&self, handle: tokio::task::AbortHandle) {
+        let mut task = self.inner.compatibility_task.lock().unwrap();
+        if !self.is_ready() {
+            *task = Some(handle);
+        }
+    }
+
+    fn take_compatibility_task(&self) -> Option<tokio::task::AbortHandle> {
+        self.inner.compatibility_task.lock().unwrap().take()
     }
 
     /// Returns whether terminal metrics are final.
@@ -148,7 +211,8 @@ impl OutputMetrics {
 ///
 /// The contained [`OutputMetrics`] lets callers read stream terminal metrics
 /// after consuming `output`. For non-s
```

**File**: `src/client/src/flight.rs` (modified, +2/-39)
```diff
@@ -12,40 +12,18 @@
 // See the License for the specific language governing permissions and
 // limitations under the License.
 
-use std::pin::Pin;
-
 use arrow_flight::FlightData;
 use common_grpc::flight::{FlightDecoder, FlightMessage};
-use futures_util::stream::Peekable;
 use futures_util::{Stream, StreamExt};
 use snafu::{OptionExt, ResultExt};
 
 use crate::Result;
 use crate::error::{ConvertFlightDataSnafu, Error, IllegalFlightMessagesSnafu};
 
-#[derive(Debug, Clone, Copy, PartialEq, Eq)]
-pub(crate) enum FlightMessageKind {
-    Schema,
-    RecordBatch,
-    AffectedRows,
-    Metrics,
-}
-
-impl From<&FlightMessage> for FlightMessageKind {
-    fn from(message: &FlightMessage) -> Self {
-        match message {
-            FlightMessage::Schema(_) => Self::Schema,
-            FlightMessage::RecordBatch(_) => Self::RecordBatch,
-            FlightMessage::AffectedRows { .. } => Self::AffectedRows,
-            FlightMessage::Metrics(_) => Self::Metrics,
-        }
-    }
-}
-
 pub(crate) struct FlightMessageReader<S: Stream + Unpin> {
     /// Remote Flight peer associated with this response stream.
     remote_addr: String,
-    messages: Peekable<S>,
+    messages: S,
 }
 
 impl<S> FlightMessageReader<S>
@@ -55,7 +33,7 @@ where
     pub(crate) fn new(remote_addr: impl Into<String>, messages: S) -> Self {
         Self {
             remote_addr: remote_addr.into(),
-            messages: messages.peekable(),
+            messages,
         }
     }
 
@@ -72,21 +50,6 @@ where
     pub(crate) async fn read_next(&mut self) -> Result<Option<FlightMessage>> {
         self.messages.next().await.transpose()
     }
-
-    pub(crate) async fn peek_next_message_kind(&mut self) -> Result<Option<FlightMessageKind>> {
-        match Pin::new(&mut self.messages).peek().await {
-            Some(Ok(message)) => Ok(Some(message.into())),
-            None => Ok(None),
-            Some(Err(_)) => match self.read_next().await {
-                // `peek` only borrows the error; consume it to preserve the source error.
-                Err(error) => Err(error),
-                Ok(_) => IllegalFlightMessagesSnafu {
-                    reason: "Flight stream changed after peek".to_string(),
-                }
-                .fail(),
-            },
-        }
-    }
 }
 
 pub(crate) fn decode_flight_data(
```

**File**: `src/client/src/region.rs` (modified, +50/-61)
```diff
@@ -48,7 +48,7 @@ use crate::error::{
     self, FlightGetSnafu, IllegalDatabaseResponseSnafu, IllegalFlightMessagesSnafu,
     MissingFieldSnafu, Result, ServerSnafu,
 };
-use crate::flight::{FlightMessageKind, FlightMessageReader, decode_flight_data};
+use crate::flight::{FlightMessageReader, decode_flight_data};
 use crate::{Client, metrics};
 
 const FLIGHT_DO_GET_TIMEOUT: Duration = Duration::from_secs(10);
@@ -247,9 +247,7 @@ where
             "poll_flight_data_stream"
         ));
 
-        let mut stream_ended = false;
-
-        while !stream_ended {
+        loop {
             let flight_message = match reader.read_next().await {
                 Ok(Some(message)) => message,
                 Ok(None) => break,
@@ -262,59 +260,27 @@ where
 
             match flight_message {
                 FlightMessage::RecordBatch(record_batch) => {
-                    let result_to_yield =
-                        RecordBatch::from_df_record_batch(schema_cloned.clone(), record_batch);
-
-                    // Metrics follow a batch so MergeScan can observe them before yielding it.
-                    match reader.peek_next_message_kind().await {
-                        Ok(Some(FlightMessageKind::Metrics)) => {
-                            let metrics_message = match reader.read_next().await {
-                                Ok(Some(FlightMessage::Metrics(metrics))) => metrics,
-                                Ok(Some(_) | None) => {
-                                    yield IllegalFlightMessagesSnafu {
-                                        reason: "Flight stream changed after peek",
-                                    }
-                                    .fail()
-                                    .map_err(BoxedError::new)
-                                    .context(ExternalSnafu);
-                                    break;
-                                }
-                                Err(error) => {
-                                    yield Err(BoxedError::new(flight_stream_error(
-                                        &stream_addr,
-                                        error,
-                                    )))
-                                    .context(ExternalSnafu);
-                                    break;
-                                }
-                            };
-                            let metrics = serde_json::from_str(&metrics_message).ok().map(Arc::new);
-                            metrics_ref.swap(metrics);
-                        }
-                        Ok(Some(FlightMessageKind::RecordBatch)) => {}
-                        Ok(Some(FlightMessageKind::Schema | FlightMessageKind::AffectedRows)) => {
-                            yield IllegalFlightMessagesSnafu {
-                                reason: "A RecordBatch message can only be succeeded by a Metrics message or another RecordBatch message"
-                            }
-                            .fail()
-                            .map_err(BoxedError::new)
-                            .context(ExternalSnafu);
-                            break;
+                    // Deliver each batch immediately. In particular, do not
+                    // wait for a possible following Metrics message; it is
+                    // consumed on the next poll of this stream.
+                    yield Ok(RecordBatch::from_df_record_batch(
+                        schema_cloned.clone(),
+                        record_batch,
+                    ));
+                }
+                FlightMessage::Metrics(s) => {
+                    // Metrics may arrive before the next RecordBatch.
+                    match serde_json::from_str(&s) {
+                        Ok(metrics) => {
+                            metrics_ref.swap(Some(Arc::new(metrics)));
                         }
-                        Ok(None) => stream_ended = true,
                         Err(error) => {
-                            yield Er
```

**File**: `src/flow/src/batching_mode/task.rs` (modified, +6/-0)
```diff
@@ -1400,6 +1400,12 @@ impl BatchingTask {
         match res {
             Ok(res) => {
                 let (affected_rows, _) = res.output.extract_rows_and_cost();
+                if matches!(&res.output.data, common_query::OutputData::AffectedRows(_)) {
+                    res.metrics.wait_ready().await;
+                }
+                if let Some(error) = res.metrics.completion_error() {
+                    warn!("Flow {flow_id} completed with terminal metrics error: {error}");
+                }
                 debug!(
                     "Flow {flow_id} executed, affected_rows: {affected_rows:?}, elapsed: {:?}, watermark: {:?}",
                     elapsed,
```

**File**: `tests-integration/src/grpc/flight.rs` (modified, +2/-1)
```diff
@@ -990,7 +990,7 @@ mod test {
             panic!("expected affected rows output");
         };
         assert_eq!(affected_rows, 9);
-        assert!(result.metrics.is_ready());
+        result.metrics.wait_ready().await;
         assert!(result.region_watermark_map().is_none());
 
         let err = client
@@ -1016,6 +1016,7 @@ mod test {
             panic!("expected affected rows output");
         };
         assert_eq!(affected_rows, 9);
+        result.metrics.wait_ready().await;
         assert_eq!(
             result.region_watermark_map(),
             Some(std::collections::HashMap::from([previous_watermark]))
```

---

### Incident Patch 6: `d6474b96` (2026-09-29)
**Commit Message**: fix(promql): apply offset to subquery evaluation window (#9364)

* fix(promql): apply offset to subquery evaluation window

`prom_subquery_expr_to_plan` destructured `SubqueryExpr` without reading
`offset`, so `<subquery>[range:step] offset <d>` planned exactly the same
window as the un-offset form and silently returned data for the wrong time
range. The plain vector/matrix-selector paths already threaded the offset
through `selector_to_series_normalize_plan` and `RangeManipulate`.

Shift the inner evaluation window back by the offset and pass the offset to
the subquery's `RangeManipulate`, which maps the inner samples forward onto
the evaluation timeline before bucketing them into ranges. This matches
Prometheus, whose `evaluator.subqueryTimeRange` evaluates the inner
expression over `(start - offset - range, end - offset]` and whose
`evalSubquery` then hands the samples to the outer range-vector function as
a `MatrixSelector` that still carries the subquery offset. An offset on the
inner selector composes additively, as `subqueryTimes` documents.

`RangeManipulate`'s protobuf message has no offset field and recovers it on
decode from an immediately underlying `SeriesNormalize`. S

**File**: `src/query/src/promql/planner.rs` (modified, +39/-7)
```diff
@@ -403,18 +403,34 @@ impl PromPlanner {
         subquery_expr: &SubqueryExpr,
     ) -> Result<LogicalPlan> {
         let SubqueryExpr {
-            expr, range, step, ..
+            expr,
+            range,
+            step,
+            offset,
+            ..
         } = subquery_expr;
 
+        // Prometheus evaluates the inner expression over `(start - offset - range, end - offset]`
+        // (`subqueryTimeRange`). Shift the inner window back here; `RangeManipulate` maps the
+        // samples forward again by the same offset.
+        let offset_ms = match offset {
+            Some(Offset::Pos(duration)) => duration.as_millis() as Millisecond,
+            Some(Offset::Neg(duration)) => -(duration.as_millis() as Millisecond),
+            None => 0,
+        };
+
         let current_interval = self.ctx.interval;
         if let Some(step) = step {
             self.ctx.interval = step.as_millis() as _;
         }
         let current_start = self.ctx.start;
-        self.ctx.start -= range.as_millis() as i64 - self.ctx.interval;
+        let current_end = self.ctx.end;
+        self.ctx.start -= offset_ms + range.as_millis() as i64 - self.ctx.interval;
+        self.ctx.end -= offset_ms;
         let input = self.prom_expr_to_plan(expr, query_engine_state).await?;
         self.ctx.interval = current_interval;
         self.ctx.start = current_start;
+        self.ctx.end = current_end;
 
         ensure!(!range.is_zero(), ZeroRangeSelectorSnafu);
         let range_ms = range.as_millis() as _;
@@ -471,26 +487,42 @@ impl PromPlanner {
             .context(DataFusionPlanningSnafu)?;
         let divide_plan = LogicalPlan::Extension(Extension {
             node: Arc::new(SeriesDivide::new(
-                series_key_columns,
+                series_key_columns.clone(),
                 time_index_column.clone(),
                 sort_plan,
             )),
         });
 
+        // `RangeManipulate` has no offset in its protobuf message; decoding recovers it from the
+        // `SeriesNormalize` directly below. Stale markers are not filtered: the input is computed.
+        let divide_plan = if offset_ms != 0 {
+            LogicalPlan::Extension(Extension {
+                node: Arc::new(SeriesNormalize::new(
+                    offset_ms,
+                    time_index_column.clone(),
+                    false,
+                    series_key_columns,
+                    divide_plan,
+                )),
+            })
+        } else {
+            divide_plan
+        };
+
         let manipulate = RangeManipulate::new(
             self.ctx.start,
             self.ctx.end,
             self.ctx.interval,
-            0,
+            offset_ms,
             range_ms,
             time_index_column,
             self.ctx.field_columns.clone(),
             divide_plan,
         )
         .context(DataFusionPlanningSnafu)?;
-        // A subquery always folds with offset 0, so its payload timestamps are already on the
-        // evaluation timeline a function above it reads; see [`Self::create_range_eval_ts_expr`].
-        self.ctx.range_fold_offset = Some(0);
+        // The payload timestamps are shifted by the subquery offset; see
+        // [`Self::create_range_eval_ts_expr`].
+        self.ctx.range_fold_offset = Some(offset_ms);
 
         Ok(LogicalPlan::Extension(Extension {
             node: Arc::new(manipulate),
```

**File**: `src/query/src/promql/planner/test.rs` (modified, +22/-0)
```diff
@@ -5109,6 +5109,28 @@ async fn count_over_time_subquery() {
     indie_query_plan_compare(query, expected).await;
 }
 
+/// `offset` on a subquery must shift the inner evaluation window back and be
+/// carried into the outer range manipulation. See
+/// <https://github.com/GreptimeTeam/greptimedb/issues/9330>.
+#[tokio::test]
+async fn count_over_time_subquery_with_offset() {
+    let query = "count_over_time(some_metric[10m:1m] offset 5m)";
+    let expected = String::from(
+        "Filter: prom_count_over_time(timestamp_range,field_0) IS NOT NULL [timestamp:Timestamp(ms), prom_count_over_time(timestamp_range,field_0):Float64;N, tag_0:Utf8]\
+        \n  Projection: some_metric.timestamp, prom_count_over_time(timestamp_range, field_0) AS prom_count_over_time(timestamp_range,field_0), some_metric.tag_0 [timestamp:Timestamp(ms), prom_count_over_time(timestamp_range,field_0):Float64;N, tag_0:Utf8]\
+        \n    PromRangeManipulate: req range=[0..100000000], interval=[5000], eval range=[600000], time index=[timestamp], values=[\"field_0\"] [tag_0:Utf8, timestamp:Timestamp(ms), field_0:Dictionary(Int64, Float64);N, timestamp_range:Dictionary(Int64, Timestamp(ms))]\
+        \n      PromSeriesNormalize: offset=[300000], time index=[timestamp], filter NaN: [false] [tag_0:Utf8, timestamp:Timestamp(ms), field_0:Float64;N]\
+        \n        PromSeriesDivide: tags=[\"tag_0\"] [tag_0:Utf8, timestamp:Timestamp(ms), field_0:Float64;N]\
+        \n          Sort: some_metric.tag_0 ASC NULLS FIRST, some_metric.timestamp ASC NULLS FIRST [tag_0:Utf8, timestamp:Timestamp(ms), field_0:Float64;N]\
+        \n            PromInstantManipulate: range=[-840000..99700000], lookback=[1000], interval=[60000], time index=[timestamp] [tag_0:Utf8, timestamp:Timestamp(ms), field_0:Float64;N]\
+        \n              PromSeriesDivide: tags=[\"tag_0\"] [tag_0:Utf8, timestamp:Timestamp(ms), field_0:Float64;N]\
+        \n                Sort: some_metric.tag_0 ASC NULLS FIRST, some_metric.timestamp ASC NULLS FIRST [tag_0:Utf8, timestamp:Timestamp(ms), field_0:Float64;N]\
+        \n                  Filter: some_metric.timestamp >= TimestampMillisecond(-840999, None) AND some_metric.timestamp <= TimestampMillisecond(99700000, None) [tag_0:Utf8, timestamp:Timestamp(ms), field_0:Float64;N]\
+        \n                    TableScan: some_metric [tag_0:Utf8, timestamp:Timestamp(ms), field_0:Float64;N]",
+    );
+    indie_query_plan_compare(query, expected).await;
+}
+
 #[tokio::test]
 async fn test_hash_join() {
     let mut eval_stmt = EvalStmt {
```

**File**: `tests/cases/standalone/common/promql/subquery.result` (modified, +100/-0)
```diff
@@ -63,3 +63,103 @@ drop table metric_total;
 
 Affected Rows: 0
 
+-- Offset on a subquery shifts the subquery's own evaluation window back by the offset.
+-- Reference: Prometheus `evaluator.subqueryTimeRange` (promql/engine.go).
+-- The offset cases stay on the subquery step grid so they match Prometheus directly.
+create table subquery_offset_total (
+    ts timestamp time index,
+    host string primary key,
+    val double,
+);
+
+Affected Rows: 0
+
+insert into subquery_offset_total values
+    (0, 'a', 1),
+    (10000, 'a', 2),
+    (20000, 'a', 3),
+    (30000, 'a', 4),
+    (40000, 'a', 5),
+    (50000, 'a', 6),
+    (60000, 'a', 7);
+
+Affected Rows: 7
+
+-- baseline: no offset at t=60 covers the 10s subquery points in (40s, 60s] -> 6 + 7
+tql eval (60, 60, '1s') sum_over_time(subquery_offset_total[20s:10s]);
+
++---------------------+----------------------------------+------+
+| ts                  | prom_sum_over_time(ts_range,val) | host |
++---------------------+----------------------------------+------+
+| 1970-01-01T00:01:00 | 13.0                             | a    |
++---------------------+----------------------------------+------+
+
+-- the same subquery evaluated at t=30 -> 3 + 4
+tql eval (30, 30, '1s') sum_over_time(subquery_offset_total[20s:10s]);
+
++---------------------+----------------------------------+------+
+| ts                  | prom_sum_over_time(ts_range,val) | host |
++---------------------+----------------------------------+------+
+| 1970-01-01T00:00:30 | 7.0                              | a    |
++---------------------+----------------------------------+------+
+
+-- `offset 30s` at t=60 must equal the un-offset subquery at t=30
+tql eval (60, 60, '1s') sum_over_time(subquery_offset_total[20s:10s] offset 30s);
+
++---------------------+----------------------------------+------+
+| ts                  | prom_sum_over_time(ts_range,val) | host |
++---------------------+----------------------------------+------+
+| 1970-01-01T00:01:00 | 7.0                              | a    |
++---------------------+----------------------------------+------+
+
+-- a negative offset looks ahead of the evaluation time
+tql eval (30, 30, '1s') sum_over_time(subquery_offset_total[20s:10s] offset -30s);
+
++---------------------+----------------------------------+------+
+| ts                  | prom_sum_over_time(ts_range,val) | host |
++---------------------+----------------------------------+------+
+| 1970-01-01T00:00:30 | 13.0                             | a    |
++---------------------+----------------------------------+------+
+
+-- an offset on the inner selector composes additively with the subquery offset: Prometheus
+-- `subqueryTimes` accumulates "the sum of offsets and ranges of all subqueries in the path",
+-- and the inner selector subtracts its own offset from the already shifted step timestamps.
+-- 20s + 10s therefore behaves like the un-offset subquery at t=30.
+tql eval (60, 60, '1s') sum_over_time((subquery_offset_total offset 10s)[20s:10s] offset 20s);
+
++---------------------+----------------------------------+------+
+| ts                  | prom_sum_over_time(ts_range,val) | host |
++---------------------+----------------------------------+------+
+| 1970-01-01T00:01:00 | 7.0                              | a    |
++---------------------+----------------------------------+------+
+
+-- ... and the inner offset alone accounts for the same total shift
+tql eval (60, 60, '1s') sum_over_time((subquery_offset_total offset 30s)[20s:10s]);
+
++---------------------+----------------------------------+------+
+| ts                  | prom_sum_over_time(ts_range,val) | host |
++---------------------+----------------------------------+------+
+| 1970-01-01T00:01:00 | 7.0                              | a    |
++---------------------+----------------------------------+------+
+
+-- `predict_linear` predicts from the evaluation time: 4 + 0.1 * 30 = 7 and 7 - 0.1 * 30 = 4
+tql eval (60, 60, '1s') pr
```

**File**: `tests/cases/standalone/common/promql/subquery.sql` (modified, +46/-0)
```diff
@@ -20,3 +20,49 @@ tql eval (10, 10, '1s') rate(metric_total[20s:10s]);
 tql eval (20, 20, '1s') rate(metric_total[20s:5s]);
 
 drop table metric_total;
+
+-- Offset on a subquery shifts the subquery's own evaluation window back by the offset.
+-- Reference: Prometheus `evaluator.subqueryTimeRange` (promql/engine.go).
+-- The offset cases stay on the subquery step grid so they match Prometheus directly.
+create table subquery_offset_total (
+    ts timestamp time index,
+    host string primary key,
+    val double,
+);
+
+insert into subquery_offset_total values
+    (0, 'a', 1),
+    (10000, 'a', 2),
+    (20000, 'a', 3),
+    (30000, 'a', 4),
+    (40000, 'a', 5),
+    (50000, 'a', 6),
+    (60000, 'a', 7);
+
+-- baseline: no offset at t=60 covers the 10s subquery points in (40s, 60s] -> 6 + 7
+tql eval (60, 60, '1s') sum_over_time(subquery_offset_total[20s:10s]);
+
+-- the same subquery evaluated at t=30 -> 3 + 4
+tql eval (30, 30, '1s') sum_over_time(subquery_offset_total[20s:10s]);
+
+-- `offset 30s` at t=60 must equal the un-offset subquery at t=30
+tql eval (60, 60, '1s') sum_over_time(subquery_offset_total[20s:10s] offset 30s);
+
+-- a negative offset looks ahead of the evaluation time
+tql eval (30, 30, '1s') sum_over_time(subquery_offset_total[20s:10s] offset -30s);
+
+-- an offset on the inner selector composes additively with the subquery offset: Prometheus
+-- `subqueryTimes` accumulates "the sum of offsets and ranges of all subqueries in the path",
+-- and the inner selector subtracts its own offset from the already shifted step timestamps.
+-- 20s + 10s therefore behaves like the un-offset subquery at t=30.
+tql eval (60, 60, '1s') sum_over_time((subquery_offset_total offset 10s)[20s:10s] offset 20s);
+
+-- ... and the inner offset alone accounts for the same total shift
+tql eval (60, 60, '1s') sum_over_time((subquery_offset_total offset 30s)[20s:10s]);
+
+-- `predict_linear` predicts from the evaluation time: 4 + 0.1 * 30 = 7 and 7 - 0.1 * 30 = 4
+tql eval (60, 60, '1s') predict_linear(subquery_offset_total[20s:10s] offset 30s, 0);
+
+tql eval (30, 30, '1s') predict_linear(subquery_offset_total[20s:10s] offset -30s, 0);
+
+drop table subquery_offset_total;
```

---

### Incident Patch 7: `886e02f0` (2026-09-29)
**Commit Message**: ci(query-regression): bump RUNNER_IMAGE_EPOCH to 7 (#9395)

ci(query-regression): bump RUNNER_IMAGE_EPOCH to 7 for image m-0xihbfzm5xpbxolybo6i

Signed-off-by: greptimedb-ci <greptimedb-ci@greptime.com>
Co-authored-by: greptimedb-ci <greptimedb-ci@greptime.com>

**File**: `.github/workflows/query-regression.yml` (modified, +1/-1)
```diff
@@ -549,7 +549,7 @@ jobs:
           readonly EXPECTED_SCCACHE_DIR="/home/runner/.cache/sccache"
           readonly EXPECTED_RUSTC_WRAPPER="/usr/local/bin/sccache"
           readonly RUNNER_IMAGE_DIGEST="sha256:e713b294e23b7e15184e558866c90025e59930033e72c97650dbc7f1ca022d11"
-          readonly RUNNER_IMAGE_EPOCH="6"
+          readonly RUNNER_IMAGE_EPOCH="7"
 
           require_expected_root() {
             local name="$1"
```

---

### Incident Patch 8: `28f01d2f` (2026-09-29)
**Commit Message**: revert(ci): pin the query-regression runner toolchain to nightly-2026-03-21 (#9389)

* revert(ci): pin the query-regression runner toolchain to nightly-2026-03-21

The query-regression benchmark compiles both the candidate and the
BASE checkout (the previous nightly build). Base refs can predate the
stable-toolchain migration and still use #![feature] gates, so the
runner toolchain must stay a nightly that can build historical
revisions; deriving it from the workspace rust-toolchain.toml (now
stable 1.96.1) breaks base builds.

Revert the toolchain-toml coupling introduced in #9369 and keep the
parts that were correct:

- query-regression.yml: RUSTUP_TOOLCHAIN hard-pinned to
  nightly-2026-03-21 again (with a comment explaining why), Verify
  assertions back to the exact nightly versions, and the
  test-tooling pin-derivation machinery removed
- runner Dockerfile: ARG RUST_TOOLCHAIN=nightly-2026-03-21 + baked
  ENV restored; the COPY rust-toolchain.toml parsing removed
- build-ecs-image.py: the toml staging in the builder user-data
  removed; base-image auto-resolution kept but retargeted to Ubuntu
  26.04 to match the Verify tool pins (python3 3.14 etc.)
- the rebuild job keeps th

**File**: `.github/runner-scale-sets/query-regression/Dockerfile` (modified, +8/-12)
```diff
@@ -22,14 +22,14 @@ ARG SCCACHE_SHA256=aec995a83ad3dff3d14b6314e08858b7b73d35ca85a5bcf3d3a9ec07dee35
 ARG RUSTUP_INIT_VERSION=1.29.0
 ARG RUSTUP_INIT_TARGET=x86_64-unknown-linux-gnu
 ARG RUSTUP_INIT_SHA256=4acc9acc76d5079515b46346a485974457b5a79893cfb01112423c89aeb5aa10
-
-# Single source of truth for the Rust toolchain: parsed from
-# rust-toolchain.toml at build time, so the image always bakes the
-# workspace toolchain without a second hard-coded pin here.
-COPY rust-toolchain.toml /opt/rust-toolchain.toml
+# Pinned to a nightly deliberately: the benchmark compiles historical base
+# checkouts (previous nightly builds) that still use #![feature] gates, so
+# the runner cannot follow the workspace's rust-toolchain.toml (now stable).
+ARG RUST_TOOLCHAIN=nightly-2026-03-21
 
 ENV RUSTUP_HOME=/opt/rustup \
     CARGO_HOME=/opt/cargo \
+    RUSTUP_TOOLCHAIN=${RUST_TOOLCHAIN} \
     RUSTUP_AUTO_INSTALL=0 \
     PATH=/opt/cargo/bin:${PATH}
 
@@ -73,14 +73,12 @@ RUN curl --fail --location --silent --show-error \
     && install --mode=0755 /tmp/sccache/sccache /usr/local/bin/sccache \
     && rm -rf /tmp/sccache.tar.gz /tmp/sccache
 
-RUN rust_toolchain="$(grep -E '^channel' /opt/rust-toolchain.toml | cut -d'"' -f2)" \
-    && test -n "${rust_toolchain}" \
-    && curl --fail --location --silent --show-error \
+RUN curl --fail --location --silent --show-error \
         --output /tmp/rustup-init \
         "https://static.rust-lang.org/rustup/archive/${RUSTUP_INIT_VERSION}/${RUSTUP_INIT_TARGET}/rustup-init" \
     && echo "${RUSTUP_INIT_SHA256}  /tmp/rustup-init" | sha256sum --check --status - \
     && chmod 0755 /tmp/rustup-init \
-    && /tmp/rustup-init -y --profile minimal --default-toolchain "${rust_toolchain}" --no-modify-path \
+    && /tmp/rustup-init -y --profile minimal --default-toolchain "${RUST_TOOLCHAIN}" --no-modify-path \
     && rm -f /tmp/rustup-init \
     && chown -R root:root /opt/rustup /opt/cargo \
     && chmod -R go-w /opt/rustup /opt/cargo \
@@ -91,8 +89,6 @@ USER runner
 
 RUN set -eu \
     && test "$(id -u)" = "1001" \
-    && rust_toolchain="$(grep -E '^channel' /opt/rust-toolchain.toml | cut -d'"' -f2)" \
-    && test -n "${rust_toolchain}" \
     && temporary_cargo_home="$(mktemp --directory)" \
     && temporary_proto_dir="" \
     && cleanup() { rm -rf "${temporary_cargo_home}" "${temporary_proto_dir}"; } \
@@ -104,7 +100,7 @@ RUN set -eu \
     && rustc --version \
     && active_toolchain="$(rustup show active-toolchain)" \
     && printf 'Active toolchain: %s\n' "${active_toolchain}" \
-    && case "${active_toolchain}" in "${rust_toolchain}-x86_64-unknown-linux-gnu"|"${rust_toolchain}-x86_64-unknown-linux-gnu "*) ;; *) exit 1;; esac \
+    && case "${active_toolchain}" in "${RUST_TOOLCHAIN}-x86_64-unknown-linux-gnu"|"${RUST_TOOLCHAIN}-x86_64-unknown-linux-gnu "*) ;; *) exit 1;; esac \
     && test ! -w /opt/rustup \
     && test ! -w /opt/cargo/bin \
     && test -r /usr/include/google/protobuf/any.proto \
```

**File**: `.github/runner-scale-sets/query-regression/README.md` (modified, +18/-14)
```diff
@@ -88,12 +88,17 @@ sweep.
 The runner `Dockerfile` in the parent directory stays the single source of the
 tool contract. The image is rebuilt **automatically** by the
 `rebuild-query-regression-runner-image` job in
-`.github/workflows/release-dev-builder-images.yaml` whenever
-`rust-toolchain.toml` or anything under this directory changes on main (or via
-manual dispatch): it runs the ops tool below, then bumps
-`RUNNER_IMAGE_EPOCH` in `query-regression.yml` and points the
-`QUERY_REGRESSION_ECS_IMAGE_ID` repo variable at the new image, so the next
-regression run picks up image and epoch together.
+`.github/workflows/release-dev-builder-images.yaml` whenever anything under
+this directory changes on main (or via manual dispatch): it runs the ops tool
+below, opens an epoch-bump PR for `RUNNER_IMAGE_EPOCH` in
+`query-regression.yml`, and points the `QUERY_REGRESSION_ECS_IMAGE_ID` repo
+variable at the new image.
+
+The runner toolchain is **pinned inside the Dockerfile** to
+`nightly-2026-03-21` and deliberately does NOT follow the workspace
+`rust-toolchain.toml`: the benchmark also compiles the BASE checkout (the
+previous nightly build), which may predate the stable-toolchain migration and
+still require a nightly compiler.
 
 The manual fallback (also what the workflow runs):
 
@@ -105,10 +110,10 @@ uv run .github/runner-scale-sets/query-regression/ecs-image/build-ecs-image.py \
 ```
 
 `--base-image-id` is optional: the script defaults to the latest public
-Ubuntu 24.04 image in the region (the Dockerfile pins every tool version
-itself, so base drift is low-risk); pass it — or set the
-`ALIYUN_ECS_BASE_IMAGE_ID` repo variable consumed by the automated job —
-to pin a specific base image.
+Ubuntu 26.04 image in the region (26.04 matches the tool-version pins the
+Verify step asserts, e.g. python3 3.14; keep the two in sync); pass it — or
+set the `ALIYUN_ECS_BASE_IMAGE_ID` repo variable consumed by the automated
+job — to pin a specific base image.
 
 The script boots a temporary builder instance, `docker build`s the runner
 image, materializes `/opt/rustup`, `/opt/cargo`, `/usr/local/bin` tools, and
@@ -173,11 +178,10 @@ overridable via `QUERY_REGRESSION_RUNNER_UID`/`QUERY_REGRESSION_RUNNER_GID`)
 and exact tool versions: `libprotoc 3.21.12`, `uv 0.11.26`, `mold 2.40.4`,
 `Python 3.14.4`, `sccache 0.16.0`, `otelgen` commit
 `863a3f395d062c7322cc1de08a38774b7fdaa6c8`, root-owned `rustup 1.29.0`, and
-the image-baked Rust toolchain matching `rust-toolchain.toml` (the image
-parses the pin from the toml at build time, and the workflow asserts it
-dynamically at run time — there is no separately pinned toolchain version).
+the image-baked Rust toolchain `nightly-2026-03-21` pinned in the runner
+Dockerfile (deliberately independent of `rust-toolchain.toml` — see above).
 `mold` and `python3`
-come from apt at image-build time (not Ubuntu 24.04's default 3.12); if the
+come from apt at image-build time; if the
 Ubuntu archive ships a newer package revision between rebuilds, the Verify
 step fails with the observed version — bump those pins in `query-regression.yml`
 when that happens. Everything else (toolchain, uv, sccache, otelgen, rustup,
```

**File**: `.github/runner-scale-sets/query-regression/ecs-image/build-ecs-image.py` (modified, +16/-23)
```diff
@@ -25,7 +25,7 @@
 
 """Build the query-regression ECS custom image (manual ops tool).
 
-Boots a temporary pay-as-you-go ECS instance from a public Ubuntu 24.04 image,
+Boots a temporary pay-as-you-go ECS instance from a public Ubuntu 26.04 image,
 builds the existing runner container image (the Dockerfile in the parent
 directory remains the single source of the tool contract), materializes the
 tool directories onto the host filesystem so the workflow's "Verify runner
@@ -52,17 +52,15 @@
 from pathlib import Path
 
 ASSETS_DIR = Path(__file__).resolve().parent
-# Repo root: ecs-image -> query-regression -> runner-scale-sets -> .github -> root.
-REPO_ROOT = ASSETS_DIR.parents[3]
 DONE_MARKER = "QREG_IMAGE_BUILD_DONE"
 FAILED_MARKER = "QREG_IMAGE_BUILD_FAILED"
 POLL_INTERVAL_SECONDS = 15
 CONSOLE_POLL_INTERVAL_SECONDS = 30
 BUILD_TIMEOUT_SECONDS = 60 * 60
 
-# Same apt package contract as the runner Dockerfile; the base
-# actions-runner image is Ubuntu 24.04, so an Ubuntu 24.04 host resolves the
-# same tool versions (protoc 3.21.12, mold 2.40.4, Python 3.14.4).
+# Same apt package contract as the runner Dockerfile; the base is an
+# Ubuntu 26.04 image, so an Ubuntu 26.04 host resolves the same tool
+# versions (protoc 3.21.12, mold 2.40.4, Python 3.14.4).
 # Docker itself comes from Docker's official repository (docker-ce), not the
 # distribution-packaged docker.io.
 APT_PACKAGES = [
@@ -94,9 +92,8 @@
 DOCKER_CE_PACKAGES = "docker-ce docker-ce-cli containerd.io docker-buildx-plugin"
 
 
-def render_user_data(dockerfile: str, rust_toolchain_toml: str, start_runner: str, unit: str) -> str:
+def render_user_data(dockerfile: str, start_runner: str, unit: str) -> str:
     dockerfile_b64 = base64.b64encode(dockerfile.encode()).decode()
-    rust_toolchain_b64 = base64.b64encode(rust_toolchain_toml.encode()).decode()
     start_runner_b64 = base64.b64encode(start_runner.encode()).decode()
     unit_b64 = base64.b64encode(unit.encode()).decode()
     packages = " ".join(APT_PACKAGES)
@@ -125,11 +122,6 @@ def render_user_data(dockerfile: str, rust_toolchain_toml: str, start_runner: st
 {dockerfile_b64}
 EOF
 mkdir -p /tmp/image-context
-# The Dockerfile COPYies rust-toolchain.toml (single source of truth for
-# the baked toolchain); stage it into the build context.
-base64 -d > /tmp/image-context/rust-toolchain.toml <<'EOF'
-{rust_toolchain_b64}
-EOF
 docker build --platform linux/amd64 -f /tmp/Dockerfile -t qreg-runner:local /tmp/image-context
 
 # Materialize the tool contract onto the host filesystem.
@@ -238,20 +230,22 @@ def call_api_with_retry(fn, description: str, attempts: int = 5):
 
 
 def resolve_base_image_id(client, region_id: str) -> str:
-    """Resolve the latest public Ubuntu 24.04 x86_64 system image.
+    """Resolve the latest public Ubuntu 26.04 x86_64 system image.
 
     Used as the default for --base-image-id: the runner Dockerfile pins
-    every tool version itself, so a current stock Ubuntu 24.04 base is all
+    every tool version itself, so a current stock Ubuntu LTS base is all
     the builder needs. Pass --base-image-id (or ALIYUN_ECS_BASE_IMAGE_ID)
     to pin a specific base image deterministically.
     """
     from alibabacloud_ecs20140526 import models as ecs_models
 
-    def _is_ubuntu_2404(image) -> bool:
-        # osname is localized (e.g. "Ubuntu 24.04 64位"), osname_en the
-        # English form; accept either.
+    def _is_target_ubuntu(image) -> bool:
+        # osname is localized (e.g. "Ubuntu 26.04 64位"), osname_en the
+        # English form; accept either. Keep the Ubuntu version in sync with
+        # the tool-version pins asserted by the Verify step in
+        # query-regression.yml (e.g. python3 3.14 comes from 26.04).
         for os_name in (image.osname_en, image.osname):
-            if os_name and "Ubuntu" in os_name and "24.04" in os_name:
+            if os_name and "Ubuntu" in os_name and "26.04" in os_name:
                 return True
         return False
 
@@ -277
```

**File**: `.github/workflows/query-regression.yml` (modified, +14/-18)
```diff
@@ -120,23 +120,12 @@ jobs:
     # Ordinary PRs also run the same tests from checks.yml.
     runs-on: ubuntu-latest
     timeout-minutes: 10
-    outputs:
-      # The Rust toolchain pin, resolved from rust-toolchain.toml so the
-      # benchmark always runs the workspace toolchain without a second
-      # hard-coded copy in this workflow.
-      rust_toolchain: ${{ steps.rust-toolchain.outputs.pin }}
     steps:
       - name: Checkout
         uses: actions/checkout@v4
         with:
           persist-credentials: false
 
-      - name: Resolve Rust toolchain pin
-        id: rust-toolchain
-        run: |
-          pin="$(grep -E '^channel' rust-toolchain.toml | cut -d'"' -f2)"
-          echo "pin=${pin}" >> "$GITHUB_OUTPUT"
-
       - name: Test query regression tooling
         run: |
           python3 tests/perf/test_query_regression_runner_compaction_toctou.py
@@ -201,7 +190,13 @@ jobs:
       CARGO_HOME: /home/runner/.cargo
       UV_CACHE_DIR: /home/runner/.cargo/uv-cache
       RUSTUP_HOME: /opt/rustup
-      RUSTUP_TOOLCHAIN: ${{ needs.test-tooling.outputs.rust_toolchain }}
+      # Deliberately NOT derived from rust-toolchain.toml: the benchmark
+      # also compiles the BASE checkout (the previous nightly build, which
+      # may predate the stable-toolchain migration and still uses
+      # #![feature] gates), so the runner must keep a nightly toolchain
+      # that can build historical revisions. This pin moves only via a
+      # deliberate runner-image rebuild.
+      RUSTUP_TOOLCHAIN: nightly-2026-03-21
       RUSTUP_AUTO_INSTALL: "0"
       CARGO_TARGET_DIR: /home/runner/query-regression-target
       QUERY_REGRESSION_CACHE_META: /home/runner/query-regression-cache-meta
@@ -515,16 +510,17 @@ jobs:
           require_eq cargo_path "$(command -v cargo || true)" "/opt/cargo/bin/cargo"
           require_eq rustc_path "$(command -v rustc || true)" "/opt/cargo/bin/rustc"
           require_match rustup "$(capture rustup --version)" '^rustup[[:space:]]1\.29\.0([[:space:]]|$)'
-          # The toolchain pin flows from rust-toolchain.toml (resolved in the
-          # test-tooling job); escape it for the regex assertions below.
-          pin_regex="${RUSTUP_TOOLCHAIN//./\\.}"
+          # The runner toolchain is pinned to nightly-2026-03-21 (see the
+          # RUSTUP_TOOLCHAIN comment): it must compile historical base
+          # checkouts, so it intentionally does not follow rust-toolchain.toml.
           require_match cargo "$(capture cargo --version)" \
-            "^cargo[[:space:]]${pin_regex}[[:space:]]\([0-9a-f]+[[:space:]][0-9]{4}-[0-9]{2}-[0-9]{2}\)$"
+            '^cargo[[:space:]]1\.96\.0-nightly[[:space:]]\(cbb9bb8bd[[:space:]][0-9]{4}-[0-9]{2}-[0-9]{2}\)$'
           require_match rustc "$(capture rustc --version)" \
-            "^rustc[[:space:]]${pin_regex}[[:space:]]\([0-9a-f]+[[:space:]][0-9]{4}-[0-9]{2}-[0-9]{2}\)$"
+            '^rustc[[:space:]]1\.96\.0-nightly[[:space:]]\(ac7f9ec7d[[:space:]][0-9]{4}-[0-9]{2}-[0-9]{2}\)$'
           require_match active_toolchain "$(capture rustup show active-toolchain)" \
-            "^${pin_regex}-x86_64-unknown-linux-gnu([[:space:]]|$)"
+            '^nightly-2026-03-21-x86_64-unknown-linux-gnu([[:space:]]|$)'
           require_eq RUSTUP_HOME "${RUSTUP_HOME}" "/opt/rustup"
+          require_eq RUSTUP_TOOLCHAIN "${RUSTUP_TOOLCHAIN}" "nightly-2026-03-21"
           require_eq RUSTUP_AUTO_INSTALL "${RUSTUP_AUTO_INSTALL}" "0"
           require "readable /opt/rustup" test -r /opt/rustup
           require "executable /opt/rustup" test -x /opt/rustup
```

**File**: `.github/workflows/release-dev-builder-images.yaml` (modified, +44/-16)
```diff
@@ -71,9 +71,13 @@ jobs:
           files="$(git diff --name-only "${base}" "${head}")"
           dev_builder=false
           query_regression_runner=false
+          # rust-toolchain.toml only gates the dev-builder images: they bake
+          # the workspace toolchain. The query-regression runner toolchain is
+          # pinned inside its Dockerfile (nightly-2026-03-21) and must NOT
+          # follow the workspace pin, so its rebuild triggers only on changes
+          # under its own directory.
           if grep -qx 'rust-toolchain.toml' <<<"${files}"; then
             dev_builder=true
-            query_regression_runner=true
           fi
           if grep -q '^docker/dev-builder/' <<<"${files}"; then
             dev_builder=true
@@ -335,18 +339,21 @@ jobs:
     # Rebuilds the query-regression ECS runner image via the ops tool in
     # .github/runner-scale-sets/query-regression/ecs-image/: boots a
     # temporary pay-as-you-go ECS builder, snapshots a new custom image,
-    # then completes the documented lockstep updates in order:
+    # then completes the documented lockstep updates:
     #   1. bumps RUNNER_IMAGE_EPOCH in query-regression.yml (target-cache
-    #      invalidation) and pushes the commit to main, and only then
+    #      invalidation) via a PR from a timestamped ci/ branch (main is
+    #      branch-protected; mirrors update-dev-builder-version.sh), and
     #   2. points the repo variable QUERY_REGRESSION_ECS_IMAGE_ID at the
-    #      new image, so the next regression run picks up image and epoch
-    #      together.
+    #      new image. The runner toolchain is pinned inside the Dockerfile
+    #      (nightly-2026-03-21, independent of rust-toolchain.toml — the
+    #      benchmark must compile historical base checkouts), so image
+    #      rebuilds do not change the cache ABI.
     #
     # Required repository configuration (same names the provisioning job
     # uses): vars ALIYUN_ECS_REGION_ID, ALIYUN_ECS_VSWITCH_ID,
     # ALIYUN_ECS_SECURITY_GROUP_ID, optionally ALIYUN_ECS_RESOURCE_GROUP_ID
     # and ALIYUN_ECS_BASE_IMAGE_ID (deterministic base-image pin; otherwise
-    # the rebuild auto-resolves the latest public Ubuntu 24.04 image).
+    # the rebuild auto-resolves the latest public Ubuntu 26.04 image).
     # Secrets: ALICLOUD_ECS_ACCESS_KEY_ID, ALICLOUD_ECS_ACCESS_KEY_SECRET,
     # GH_PERSONAL_ACCESS_TOKEN (repo push + actions-variable write).
     name: Rebuild query-regression runner image
@@ -392,7 +399,7 @@ jobs:
           echo "## Rebuilt runner image" >> "$GITHUB_STEP_SUMMARY"
           echo "New image: \`${image_id}\`" >> "$GITHUB_STEP_SUMMARY"
 
-      - name: Bump RUNNER_IMAGE_EPOCH and update the image id variable
+      - name: Open the epoch-bump PR and update the image id variable
         env:
           GH_TOKEN: ${{ secrets.GH_PERSONAL_ACCESS_TOKEN }}
         run: |
@@ -405,21 +412,42 @@ jobs:
             exit 1
           fi
           new_epoch=$((old_epoch + 1))
-          sed -i "s/readonly RUNNER_IMAGE_EPOCH=\"${old_epoch}\"/readonly RUNNER_IMAGE_EPOCH=\"${new_epoch}\"/" \
-            .github/workflows/query-regression.yml
 
+          # main is branch-protected (required reviews + status checks), so
+          # the epoch bump cannot be pushed there directly. Mirror
+          # .github/scripts/update-dev-builder-version.sh: timestamped bot
+          # branch, plain push, and a PR with reviewers. Do NOT use [skip ci]
+          # on the commit: the required checks must be able to run for the PR
+          # to become mergeable.
+          BRANCH="ci/update-query-regression-epoch-$(date +%Y%m%d%H%M%S)"
           git config user.name "greptimedb-ci"
-          git config user.email "greptimedb-ci@users.noreply.github.com"
+          git config user.email "greptimedb-ci@greptime.com"
+          git fetch origin main
+          git checkout -b "${BRANCH}" origin/main
+          sed -i "s/readonly RUNNER_IMAGE_EPOCH=\"${old_epoch}\"/readonly RUN
```

---

### Incident Patch 9: `dd2c1d1a` (2026-09-29)
**Commit Message**: fix(meta-srv): use NoTls for disabled and Unix socket Postgres KV backends (#9059)

* fix(meta-srv): use NoTls for disabled and Unix socket Postgres KV backends

Signed-off-by: Tyagiquamar <mohdquamartyagi@gmail.com>

* fix(meta-srv): treat Postgres config as unix socket only when every host is a socket

tokio-postgres dials hostaddr over TCP even when host is a socket path,
and a mixed host list with Require/VerifyFull TLS would otherwise end up
sending plaintext over TCP. is_unix_socket_url now parses via
tokio_postgres::Config and requires no hostaddr and all-Unix hosts.
Adds regression cases for the libpq keyword form, the user@ percent
encoded socket URL, and the mixed host / hostaddr negatives.

Signed-off-by: Tyagiquamar <mohdquamartyagi@gmail.com>

---------

Signed-off-by: Tyagiquamar <mohdquamartyagi@gmail.com>

**File**: `src/meta-srv/src/utils/postgres.rs` (modified, +108/-12)
```diff
@@ -12,6 +12,9 @@
 // See the License for the specific language governing permissions and
 // limitations under the License.
 
+#[cfg(unix)]
+use std::str::FromStr;
+
 use common_error::ext::BoxedError;
 use common_meta::election::ElectionRef;
 use common_meta::election::rds::postgres::{ElectionPgClient, PgElection};
@@ -20,10 +23,13 @@ use common_meta::kv_backend::rds::PgStore;
 use common_meta::kv_backend::rds::postgres::{
     TlsMode as PgTlsMode, TlsOption as PgTlsOption, create_postgres_tls_connector,
 };
+use common_telemetry::warn;
 use deadpool_postgres::{Config, Runtime};
 use servers::tls::TlsOption;
 use snafu::{OptionExt, ResultExt};
 use tokio_postgres::NoTls;
+#[cfg(unix)]
+use tokio_postgres::config::Host;
 
 use crate::error::{self, Result};
 
@@ -60,23 +66,57 @@ pub async fn create_postgres_pool(
     })?;
     cfg.url = Some(postgres_url.clone());
 
-    let pool = if let Some(tls_config) = tls_config {
-        let pg_tls_config = convert_tls_option(&tls_config);
-        let tls_connector =
-            create_postgres_tls_connector(&pg_tls_config).map_err(|e| error::Error::Other {
-                source: BoxedError::new(e),
-                location: snafu::Location::new(file!(), line!(), 0),
-            })?;
-        cfg.create_pool(Some(Runtime::Tokio1), tls_connector)
-            .context(error::CreatePostgresPoolSnafu)?
-    } else {
-        cfg.create_pool(Some(Runtime::Tokio1), NoTls)
-            .context(error::CreatePostgresPoolSnafu)?
+    let is_unix_socket = is_unix_socket_url(postgres_url);
+    if is_unix_socket
+        && matches!(tls_config.as_ref(), Some(t) if t.mode != servers::tls::TlsMode::Disable)
+    {
+        warn!(
+            "TLS is not supported for Unix domain socket PostgreSQL connections, falling back to NoTls"
+        );
+    }
+
+    let pool = match tls_config {
+        Some(tls_config)
+            if tls_config.mode != servers::tls::TlsMode::Disable && !is_unix_socket =>
+        {
+            let pg_tls_config = convert_tls_option(&tls_config);
+            let tls_connector =
+                create_postgres_tls_connector(&pg_tls_config).map_err(|e| error::Error::Other {
+                    source: BoxedError::new(e),
+                    location: snafu::Location::new(file!(), line!(), 0),
+                })?;
+            cfg.create_pool(Some(Runtime::Tokio1), tls_connector)
+                .context(error::CreatePostgresPoolSnafu)?
+        }
+        _ => cfg
+            .create_pool(Some(Runtime::Tokio1), NoTls)
+            .context(error::CreatePostgresPoolSnafu)?,
     };
 
     Ok(pool)
 }
 
+#[cfg(unix)]
+fn is_unix_socket_url(url: &str) -> bool {
+    let Ok(cfg) = tokio_postgres::Config::from_str(url) else {
+        return false;
+    };
+    // tokio-postgres dials `hostaddr` over TCP even when `host` is a socket path,
+    // so treat the config as a socket only when every host is a Unix socket and
+    // no `hostaddr` is set.
+    cfg.get_hostaddrs().is_empty()
+        && !cfg.get_hosts().is_empty()
+        && cfg
+            .get_hosts()
+            .iter()
+            .all(|host| matches!(host, Host::Unix(_)))
+}
+
+#[cfg(not(unix))]
+fn is_unix_socket_url(_: &str) -> bool {
+    false
+}
+
 /// Builds a Postgres-backed metadata [`KvBackendRef`].
 ///
 /// * `store_addrs` - Postgres connection URLs; only the first address is used.
@@ -150,3 +190,59 @@ pub async fn build_postgres_election(
     .await
     .context(error::KvBackendSnafu)
 }
+
+#[cfg(test)]
+mod tests {
+    use super::is_unix_socket_url;
+
+    #[test]
+    fn detects_postgres_unix_socket_url() {
+        #[cfg(unix)]
+        {
+            // libpq keyword-value form (issue #7734)
+            assert!(is_unix_socket_url(
+                "host=/var/run/postgresql dbname=greptime user=greptime password=secret"
+            ));
+            // standard postgres URL with percent-encoded unix socket directory
+            assert!(is_unix_socket_url(
+                "
```

---

### Incident Patch 10: `a310ca2b` (2026-09-28)
**Commit Message**: ci(query-regression): bump RUNNER_IMAGE_EPOCH to 6 (#9381)

ci(query-regression): bump RUNNER_IMAGE_EPOCH to 6 for image m-0xidkbbavm3suxqd0y1m

Co-authored-by: greptimedb-ci <greptimedb-ci@users.noreply.github.com>

**File**: `.github/workflows/query-regression.yml` (modified, +1/-1)
```diff
@@ -553,7 +553,7 @@ jobs:
           readonly EXPECTED_SCCACHE_DIR="/home/runner/.cache/sccache"
           readonly EXPECTED_RUSTC_WRAPPER="/usr/local/bin/sccache"
           readonly RUNNER_IMAGE_DIGEST="sha256:e713b294e23b7e15184e558866c90025e59930033e72c97650dbc7f1ca022d11"
-          readonly RUNNER_IMAGE_EPOCH="5"
+          readonly RUNNER_IMAGE_EPOCH="6"
 
           require_expected_root() {
             local name="$1"
```

#### Recent Merged Pull Requests:
- **PR #9420** (2026-09-30): fix(mito2): truncate parquet column index min/max for SST writes (@killme2008)
- **PR #9410** (2026-09-30): feat(mito): wait for WAL durability before publishing a manifest watermark (@fengjiachun)
- **PR #9408** (2026-09-30): perf: batch schema export requests (@fengjiachun)
- **PR #9395** (2026-09-29): ci(query-regression): bump RUNNER_IMAGE_EPOCH to 7 (@MichaelScofield)
- **PR #9394** (2026-09-29): ci: retry failed nightly release on following weekdays (@sunng87)
- **PR #9392** (2026-09-29): chore: bump version to 1.3.0-beta.1 (@WenyXu)
- **PR #9391** (2026-09-29): fix(promql): resolve dotted column names as unqualified columns (@killme2008)
- **PR #9389** (2026-09-29): revert(ci): pin the query-regression runner toolchain to nightly-2026-03-21 (@sunng87)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
