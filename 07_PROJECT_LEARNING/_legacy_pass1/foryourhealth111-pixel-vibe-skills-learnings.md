# Forensic Learning Record (Deep Inspection): foryourhealth111-pixel/Vibe-Skills

> **Canonical Artifact**: `07_PROJECT_LEARNING/foryourhealth111-pixel-vibe-skills-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/foryourhealth111-pixel/Vibe-Skills](https://github.com/foryourhealth111-pixel/Vibe-Skills))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:13:54.842Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `foryourhealth111-pixel/Vibe-Skills`
- **Description**: Intelligent Skill routing and workflow orchestration for AI agents — +21.12 pp reward, −29.6% tokens on SkillsBench with DeepSeekV4Flash-VE.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 3507 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `_python_source_roots.py`
```
from vgo_python_source_roots import PYTHON_SOURCE_ROOTS, REPO_ROOT

__all__ = ["PYTHON_SOURCE_ROOTS", "REPO_ROOT"]

```

### Core Architecture Module: `apps/vgo-cli/src/vgo_cli/__init__.py`
```
__all__ = ['main']

```

### Core Architecture Module: `apps/vgo-cli/src/vgo_cli/commands.py`
```
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess
import sys

from .core_bridge import run_canonical_entry_core, run_compatibility_exit_core, run_entry_locator_core, run_inspect_run_core, run_local_kernel_core, run_router_core, run_skill_index_core
from .errors import (
    CliError,
    CliIoError,
    CliMissingResourceError,
    CliPermissionError,
    CliStateError,
    CliUnavailableError,
)
from .output import print_json_payload
from .process import print_process_output, run_powershell_file, run_subprocess
from .repo import get_installed_runtime_config, get_local_release_metadata
from .workspace import extend_workspace_package_path


PROJECT_URL = "https://github.com/foryourhealth111-pixel/Vibe-Skills"


def _installer_cli_error(exc: RuntimeError | OSError | ValueError) -> CliError:
    if isinstance(exc, PermissionError):
        return CliPermissionError(str(exc))
    if isinstance(exc, FileNotFoundError):
        return CliMissingResourceError(str(exc))
    if isinstance(exc, TimeoutError):
        return CliUnavailableError(str(exc))
    if isinstance(exc, OSError):
        return CliIoError(str(exc))
    return CliStateError(str(exc))


def _resolve_skills_dir(raw_value: str) -> Path:
    if str(raw_value or '').strip():
        return Path(raw_value).expanduser().resolve()
    return (Path.home() / '.agents' / 'skills').resolve()


def _git_text(repo_root: Path, *args: str) -> str:
    result = subprocess.run(
        ['git', *args],
        cwd=repo_root,
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        raise CliError(f"Unable to read source git state: {result.stderr.strip()}")
    return result.stdout.strip()


def _source_git_state(repo_root: Path) -> tuple[str, bool]:
    try:
        commit = _git_text(repo_root, 'rev-parse', 'HEAD')
        dirty = bool(_git_text(repo_root, 'status', '--porcelain'))
    except CliError:
        return "unknown", True
    return commit, dirty


def _load_public_release_bundle(source_root: Path) -> dict[str, object] | None:
    bundle_path = source_root / "release-bundle.json"
    if not bundle_path.is_file():
        return None
    try:
        payload = json.loads(bundle_path.read_text(encoding="utf-8"))
    except ValueError as exc:
        raise CliStateError(f"Unreadable public release bundle: {bundle_path}") from exc
    if not isinstance(payload, dict):
        raise CliStateError(f"Expected JSON object: {bundle_path}")
    return payload


def _bundle_mapping(
    bundle: dict[str, object],
    field_name: str,
    bundle_path: Path,
) -> dict[str, object]:
    value = bundle.get(field_name)
    if not isinstance(value, dict):
        raise CliStateError(f"Public release bundle field '{field_name}' must be an object: {bundle_path}")
    return value


def _bundle_required_text(
    mapping: dict[str, object],
    field_name: str,
    bundle_path: Path,
) -> str:
    value = mapping.get(field_name)
    if not isinstance(value, str) or not value.strip():
        raise CliStateError(f"Public release bundle field '{field_name}' must be non-empty text: {bundle_path}")
    return value.strip()


def _local_release_version(source_root: Path) -> str:
    try:
        return str(get_local_release_metadata(source_root).get("version") or "").strip()
    except Exception:
        return ""


def _install_source_kwargs(source_root: Path) -> dict[str, object]:
    bundle = _load_public_release_bundle(source_root)
    if bundle is not None:
        public_install_value = bundle.get("public_install")
        if public_install_value is None:
            public_install: dict[str, object] = {}
        elif isinstance(public_install_value, dict):
            public_install = public_install_value
        else:
            raise CliStateError(
                f"Public release bundle field 'public_install' must be an object: "
                f"{source_root / 'release-bundle.json'}"
            )
        source_kind = public_install.get("source_kind")
        if source_kind is not None and not isinstance(source_kind, str):
            raise CliStateError(
                f"Public release bundle field 'source_kind' must be text: "
                f"{source_root / 'release-bundle.json'}"
            )
        if str(source_kind or "").strip() == "public_release":
            bundle_path = source_root / "release-bundle.json"
            release = _bundle_mapping(bundle, "release", bundle_path)
            asset = _bundle_mapping(bundle, "asset", bundle_path)
            version = _bundle_required_text(release, "version", bundle_path)
            asset_name = _bundle_required_text(asset, "file_name", bundle_path)
            digest_value = asset.get("payload_digest_sha256")
            if digest_value is not None and not isinstance(digest_value, str):
                raise CliStateError(
                    f"Public release bundle field 'payload_digest_sha256' must be text: {bundle_path}"
                )
            digest = str(digest_value or "").strip()
            return {
                "source_kind": "public_release",
                "release_version": version,
                "release_asset_name": asset_name,
                "release_asset_digest": digest,
                "installer_version": version,
                "package_version": version,
            }

    commit, dirty = _source_git_state(source_root)
    version = _local_release_version(source_root) or "0.1.0"
    return {
        "source_kind": "developer_repo",
        "source_git_commit": commit,
        "source_git_dirty": dirty,
        "installer_version": version,
        "package_version": version,
    }


def install_command(args: argparse.Namespace) -> int:
    repo_root = Path(args.repo_root).resolve()
    skills_dir = _resolve_skills_dir(args.skills_dir)
    extend_workspace_package_path(repo_root)
    from vgo_installer.simple_skill_installer import install_vibe_skill

    try:
        receipt = install_vibe_skill(
            repo_root=repo_root,
            skills_dir=skills_dir,
            installed_at_utc=datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z'),
            **_install_source_kwargs(repo_root),
        )
    except (RuntimeError, OSError, ValueError) as exc:
        raise _installer_cli_error(exc) from exc
    print_json_payload(receipt)
    return 0


def uninstall_command(args: argparse.Namespace) -> int:
    repo_root = Path(args.repo_root).resolve()
    skills_dir = _resolve_skills_dir(args.skills_dir)
    extend_workspace_package_path(repo_root)
    from vgo_installer.simple_skill_installer import uninstall_vibe_skill

    try:
        result = uninstall_vibe_skill(skills_dir=skills_dir)
    except (RuntimeError, OSError, ValueError) as exc:
        raise _installer_cli_error(exc) from exc
    print_json_payload(result)
    if not result.get("ok"):
        message = "Vibe uninstall is incomplete; retry after resolving the reported failures."
        if result.get("unavailable_files") or result.get("unavailable_directories"):
            raise CliUnavailableError(message)
        if result.get("permission_denied_files") or result.get("permission_denied_directories"):
            raise CliPermissionError(message)
        raise CliIoError(message)
    return 0


def update_command(args: argparse.Namespace) -> int:
    repo_root = Path(args.repo_root).resolve()
    skills_dir = _resolve_skills_dir(args.skills_dir)
    extend_workspace_package_path(repo_root)
    from vgo_installer.simple_skill_installer import update_vibe_skill

    try:
        receipt = update_vibe_skill(
            repo_root=repo_root,
            skills_dir=skills_dir,
            installed_at_utc=datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z'),
            **_install_source_kwargs(repo_root),
        )
    except (Runt
```

### Core Architecture Module: `apps/vgo-cli/src/vgo_cli/core_bridge.py`
```
from __future__ import annotations

from pathlib import Path
import subprocess
from typing import Sequence

from .process import invoke_python_core
from .workspace import extend_workspace_package_path


def run_installer_core(repo_root: Path, argv: Sequence[str]) -> subprocess.CompletedProcess[str]:
    extend_workspace_package_path(repo_root)
    from vgo_installer.install_runtime import main as installer_main

    return invoke_python_core(installer_main, list(argv))


def run_uninstaller_core(repo_root: Path, argv: Sequence[str]) -> subprocess.CompletedProcess[str]:
    extend_workspace_package_path(repo_root)
    from vgo_installer.uninstall_runtime import main as uninstaller_main

    return invoke_python_core(uninstaller_main, list(argv))


def run_router_core(repo_root: Path, argv: Sequence[str]) -> subprocess.CompletedProcess[str]:
    extend_workspace_package_path(repo_root)
    from vgo_runtime.runtime_bridge import main as router_main

    return invoke_python_core(router_main, list(argv))


def run_canonical_entry_core(repo_root: Path, argv: Sequence[str]) -> subprocess.CompletedProcess[str]:
    extend_workspace_package_path(repo_root)
    from vgo_runtime.canonical_entry import main as canonical_entry_main

    return invoke_python_core(canonical_entry_main, list(argv))


def run_skill_index_core(repo_root: Path, argv: Sequence[str]) -> subprocess.CompletedProcess[str]:
    extend_workspace_package_path(repo_root)
    from vgo_runtime.kernel.skill_index import main as skill_index_main

    return invoke_python_core(skill_index_main, list(argv))


def run_local_kernel_core(repo_root: Path, argv: Sequence[str]) -> subprocess.CompletedProcess[str]:
    extend_workspace_package_path(repo_root)
    from vgo_runtime.kernel.loop import main as local_kernel_main

    return invoke_python_core(local_kernel_main, list(argv))


def run_inspect_run_core(repo_root: Path, argv: Sequence[str]) -> subprocess.CompletedProcess[str]:
    extend_workspace_package_path(repo_root)
    from vgo_runtime.kernel.loop import inspect_main as inspect_run_main

    return invoke_python_core(inspect_run_main, list(argv))


def run_entry_locator_core(repo_root: Path, argv: Sequence[str]) -> subprocess.CompletedProcess[str]:
    extend_workspace_package_path(repo_root)
    from vgo_runtime.entry_locator import main as entry_locator_main

    return invoke_python_core(entry_locator_main, list(argv))


def run_compatibility_exit_core(repo_root: Path, argv: Sequence[str]) -> subprocess.CompletedProcess[str]:
    extend_workspace_package_path(repo_root)
    from vgo_runtime.compatibility_exit import main as compatibility_exit_main

    return invoke_python_core(compatibility_exit_main, list(argv))

```

### Core Architecture Module: `apps/vgo-cli/src/vgo_cli/errors.py`
```
from __future__ import annotations

from enum import IntEnum


class CliExitCode(IntEnum):
    FAILURE = 1
    USAGE = 2
    INVALID_STATE = 3
    MISSING_RESOURCE = 4
    PERMISSION_DENIED = 5
    UNAVAILABLE = 6
    IO_ERROR = 7


class CliError(RuntimeError):
    exit_code = CliExitCode.FAILURE


class CliStateError(CliError):
    exit_code = CliExitCode.INVALID_STATE


class CliMissingResourceError(CliError):
    exit_code = CliExitCode.MISSING_RESOURCE


class CliPermissionError(CliError):
    exit_code = CliExitCode.PERMISSION_DENIED


class CliUnavailableError(CliError):
    exit_code = CliExitCode.UNAVAILABLE


class CliIoError(CliError):
    exit_code = CliExitCode.IO_ERROR

```

### Core Architecture Module: `apps/vgo-cli/src/vgo_cli/external.py`
```
from __future__ import annotations

import os
import shutil
import subprocess
import sys

from .errors import CliError


def _load_optional_install_timeout_seconds() -> int:
    raw = os.environ.get('VGO_OPTIONAL_INSTALL_TIMEOUT_SECONDS', '15')
    try:
        value = int(raw)
    except (TypeError, ValueError):
        value = 15
    return max(1, value)


OPTIONAL_INSTALL_TIMEOUT_SECONDS = _load_optional_install_timeout_seconds()


def report_external_fallback_usage(external_fallback_used: list[str], *, strict_offline: bool) -> None:
    uniq_fallback = ','.join(sorted(set(str(item) for item in external_fallback_used if str(item).strip())))
    if not uniq_fallback:
        return
    if strict_offline:
        raise CliError(f'StrictOffline rejected external fallback usage: {uniq_fallback}')
    print(f'[WARN] External fallback skills were used (non-reproducible install): {uniq_fallback}')


def _run_optional_install(command: list[str]) -> None:
    command_text = ' '.join(command)
    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=OPTIONAL_INSTALL_TIMEOUT_SECONDS,
        )
    except (FileNotFoundError, OSError) as exc:
        print(f'[WARN] Optional install skipped for {command_text}: {exc}')
        return
    except subprocess.TimeoutExpired:
        print(
            f'[WARN] Optional install timed out for {command_text} after '
            f'{OPTIONAL_INSTALL_TIMEOUT_SECONDS}s; continuing without it.'
        )
        return

    if result.returncode != 0:
        detail = (result.stderr or result.stdout or '').strip()
        suffix = f': {detail}' if detail else f' (exit {result.returncode})'
        print(f'[WARN] Optional install failed for {command_text}{suffix}')


def maybe_install_external_dependencies(repo_root: object, install_mode: str, *, strict_offline: bool = False) -> None:
    if strict_offline:
        return
    if shutil.which('npm'):
        if install_mode == 'governed':
            _run_optional_install(['npm', 'install', '-g', '@th0rgal/ralph-wiggum'])
    if shutil.which('xan') is None:
        print('[WARN] xan CLI not detected. Install manually (brew/pixi/conda/cargo) to enable large CSV acceleration.')
    ivy_probe = subprocess.run([sys.executable, '-c', 'import ivy'], capture_output=True, text=True)
    if ivy_probe.returncode != 0:
        print('[WARN] ivy Python package not detected. Install manually (pip install ivy) to enable framework-interop analyzer hints.')
    if shutil.which('fuck-u-code') is None:
        print('[WARN] fuck-u-code CLI not detected. Install manually if you want external quality-debt analyzer hints (quality-debt-overlay still works without it).')

```

### Core Architecture Module: `apps/vgo-cli/src/vgo_cli/hosts.py`
```
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from types import ModuleType

from .errors import CliError, CliUnavailableError
from .workspace import extend_workspace_package_path


@lru_cache(maxsize=1)
def _resolve_workspace_repo_root() -> Path:
    current = Path(__file__).resolve()
    if current.is_file():
        current = current.parent

    while True:
        registry_exists = (current / 'adapters' / 'index.json').exists() or (current / 'config' / 'adapter-registry.json').exists()
        if registry_exists:
            return current
        if current.parent == current:
            break
        current = current.parent

    raise CliError('Unable to resolve workspace repo root for CLI host registry.')


@lru_cache(maxsize=1)
def _contract_modules() -> tuple[Path, ModuleType, ModuleType]:
    repo_root = _resolve_workspace_repo_root()
    extend_workspace_package_path(repo_root)
    from vgo_contracts import adapter_registry_support as registry_module
    from vgo_contracts import target_root_contract as target_root_module

    return repo_root, registry_module, target_root_module


def _load_registry() -> tuple[Path, dict[str, object], ModuleType, ModuleType]:
    repo_root, registry_module, target_root_module = _contract_modules()
    registry = dict(registry_module.load_adapter_registry(repo_root))
    return repo_root, registry, registry_module, target_root_module


def _default_host_id(registry: dict[str, object]) -> str:
    return str(registry.get('default_adapter_id') or 'codex').strip().lower() or 'codex'


def _resolve_host_entry(host_id: str | None) -> tuple[str, dict[str, object]]:
    _repo_root, registry, registry_module, _target_root_module = _load_registry()
    requested_host = str(host_id or os.environ.get('VCO_HOST_ID') or '').strip()
    normalized = str(registry_module.normalize_adapter_host_id(requested_host, registry)).strip().lower()
    if not normalized:
        normalized = _default_host_id(registry)
    try:
        entry = dict(registry_module.resolve_adapter_entry(registry, normalized))
    except ValueError:
        normalized = _default_host_id(registry)
        try:
            entry = dict(registry_module.resolve_adapter_entry(registry, normalized))
        except ValueError as exc:
            raise CliUnavailableError(
                f'Unable to resolve host registry entry for: {host_id}'
            ) from exc
    return normalized, entry


def _target_root_spec(host_id: str | None) -> tuple[str, dict[str, str]]:
    normalized, entry = _resolve_host_entry(host_id)
    target = dict(entry.get('default_target_root') or {})
    return normalized, {
        'env': str(target.get('env') or '').strip(),
        'rel': str(target.get('rel') or '').strip(),
        'kind': str(target.get('kind') or '').strip(),
        'install_mode': str(entry.get('install_mode') or '').strip(),
    }


def normalize_host_id(host_id: str | None) -> str:
    normalized, _ = _resolve_host_entry(host_id)
    return normalized


def resolve_default_target_root(host_id: str) -> Path:
    normalized, spec = _target_root_spec(host_id)
    _repo_root, _registry, _registry_module, target_root_module = _load_registry()
    target_root_text = target_root_module.resolve_target_root_text(
        default_target_root=spec['rel'],
        default_target_root_env=spec['env'],
        env=dict(os.environ),
        home=str(Path.home()),
        descriptor_id=normalized,
    )
    return Path(str(target_root_text)).expanduser().resolve()


def resolve_target_root(host_id: str, target_root: str | None) -> Path:
    if target_root and str(target_root).strip():
        return Path(str(target_root)).expanduser().resolve()
    return resolve_default_target_root(host_id)


def install_mode_for_host(host_id: str) -> str:
    _, spec = _target_root_spec(host_id)
    return spec['install_mode']

```

### Core Architecture Module: `apps/vgo-cli/src/vgo_cli/install_gates.py`
```
from __future__ import annotations

from pathlib import Path
import subprocess
import sys

from .errors import CliError
from .process import (
    choose_powershell,
    print_process_output,
    run_powershell_file,
    run_subprocess,
)
from .repo import get_installed_runtime_config, resolve_canonical_repo_root


def run_runtime_neutral_freshness_gate(repo_root: Path, target_root: Path, gate_relpath: str) -> subprocess.CompletedProcess[str]:
    gate_path = repo_root / gate_relpath
    if not gate_path.exists():
        raise CliError(f'Runtime-neutral freshness gate script missing: {gate_path}')
    return run_subprocess([sys.executable, str(gate_path), '--target-root', str(target_root)])


def run_runtime_freshness_gate(repo_root: Path, target_root: Path, *, skip_gate: bool, include_frontmatter: bool) -> None:
    if skip_gate:
        print('[WARN] Skipping runtime freshness gate by request.')
        return

    canonical_root = resolve_canonical_repo_root(repo_root)
    if canonical_root is None:
        print('[WARN] Runtime freshness gate requires the canonical repo root; skipping because no outer .git root was found.')
        return

    runtime_cfg = get_installed_runtime_config(canonical_root)
    neutral_result = run_runtime_neutral_freshness_gate(canonical_root, target_root, str(runtime_cfg['neutral_freshness_gate']))
    print_process_output(neutral_result)
    if neutral_result.returncode != 0:
        raise CliError('Runtime freshness gate failed after install.')

    receipt_path = target_root / str(runtime_cfg['receipt_relpath'])
    if not receipt_path.exists():
        raise CliError(f'Runtime freshness receipt missing after install: {receipt_path}')

    if include_frontmatter:
        frontmatter_gate = canonical_root / str(runtime_cfg['frontmatter_gate'])
        if not frontmatter_gate.exists():
            raise CliError(f'frontmatter gate script missing: {frontmatter_gate}')
        result = run_powershell_file(frontmatter_gate, '-TargetRoot', str(target_root))
        print_process_output(result)
        if result.returncode != 0:
            raise CliError('Frontmatter BOM gate failed after install.')


def run_offline_gate(repo_root: Path, target_root: Path) -> None:
    gate_path = repo_root / 'scripts' / 'verify' / 'vibe-offline-required-skills-audit.ps1'
    if not gate_path.exists():
        raise CliError(f'StrictOffline requested, but offline gate script is missing: {gate_path}')
    if not choose_powershell():
        raise CliError('StrictOffline requires an available PowerShell host to run the offline gate')
    result = run_powershell_file(
        gate_path,
        '-SkillsRoot', str(target_root / 'skills'),
        '-RuntimeCorePackagingPath', str(repo_root / 'config' / 'runtime-core-packaging.json'),
    )
    print_process_output(result)
    if result.returncode != 0:
        raise CliError('StrictOffline validation failed (vibe-offline-required-skills-audit).')

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #307** (2026-08-31): **installer: recover partial uninstalls and type CLI exits**
  *Symptoms*: ## Summary  - preserve receipt-backed ownership across partial uninstall failures and process termination - recover interrupted install/update transactions with a persistent journal and bounded cross-process lock - validate receipt, manifest, metadata, symlink, junction, hardlink, and Windows path-alias boundaries - hash managed files through no-follow handles and report leaf links as drift while safely unlinking them during uninstall - expose stable typed CLI exit codes for state, missing-resource, permission, timeout/unavailable, and I/O failures - retain detailed failed, permission-denied, and unavailable file/directory results for retry  ## Surfaces touched  - `packages/installer-core/src/vgo_installer/simple_skill_installer.py` - `apps/vgo-cli/src/vgo_cli/{commands,errors,hosts,main,process}.py` - focused installer, CLI, infrastructure, integration, and runtime-neutral tests  No Z0, mirror, vendor, or generated output surfaces are changed.  ## Proof  - Command: `py -3 -m pytest tests/unit/test_simple_skill_installer.py tests/unit/test_vgo_cli_commands.py tests/unit/test_vgo_cli_infra_split.py -q`   - Output: `125 passed, 7 skipped in 60.39s`   - Claim: focused recovery, path-boundary, exit-code, host, and process behavior passes on Windows. - Command: targeted 17-file CLI, installer, wrapper, integration, and runtime-neutral suite   - Output: `203 passed, 7 skipped in 74.87s`   - Claim: the related lifecycle and compatibility matrix passes on Windows. - Command: `wsl.exe
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/foryourhealth111-pixel/Vibe-Skills/pull/307)  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: defaults  **Review profile**: CHILL  **Plan**: Pro Plus  **Run ID**: `1752579c-e05d-423d-b880-3ed8acce469a`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between d583d27ed8a963beb8a8bda486c2ded8efe2364b and 8ca4e2d435175b1703bb124cc3934d2199cd31ab.  </details>  <details> <summary>📒 Files selected for processing (1)</summary>  * `tests/unit/test_simple_skill_installer.py` 

- **Issue #305** (2026-08-31): **`CliError` has no exit-code contract, so every failure exits 1 undifferentiated**
  *Symptoms*: Small but it bites scripting. `apps/vgo-cli/src/vgo_cli/errors.py` is the entire error surface:  ```python class CliError(RuntimeError):     pass ```  No code field, no subclasses. Meanwhile `main.py` already has a `compatibility_exit_command` in its import list (`main.py:6`), which implies the CLI *does* care about distinguishing exit conditions somewhere.  Consequence: a CI wrapper cannot tell "unknown host" from "python too old" from "install target not writable" without string-matching the message. Adding `class CliError(RuntimeError): exit_code = 1` and letting subclasses override is a ~10 line change that makes the CLI scriptable.
  **Post-Mortem & Fix Analysis**:
  > Thank you for your report. We are investigating.

- **Issue #304** (2026-08-31): **Failed `uninstall_vibe_skill` bricks the install: the receipt is deleted first, and reinstall then refuses to proceed**
  *Symptoms*: Order of operations in the simple installer's uninstall:  ```python # packages/installer-core/src/vgo_installer/simple_skill_installer.py:350     for entry in receipt.get("files") or []:         ...         if file_path.is_file():             file_path.unlink()             removed_files.append(relpath)      receipt_path.unlink() ```  Now the reinstall guard:  ```python # packages/installer-core/src/vgo_installer/simple_skill_installer.py:220     if install_root.exists() and not receipt_path.is_file():         raise RuntimeError(f"Install root already exists without a Vibe install receipt: {install_root}") ```  Trigger: uninstall hits `PermissionError` on one file (open handle on Windows, root-owned file, read-only mount) after unlinking a few hundred others. Or the process is killed mid-loop.  Observed: some files removed, receipt gone or about to be. Re-running uninstall → `RuntimeError: Vibe install receipt is missing` (`simple_skill_installer.py:345`). Running install → `RuntimeError: Install root already exists without a Vibe install receipt`. Both doors locked; the user's only recourse is `rm -rf` by hand, which is precisely the operation the receipt system exists to avoid.  Expected: (1) delete the receipt *last*, and only after all owned files are gone; (2) tolerate per-file failures by collecting them into a returned `failed_files` list rather than aborting; (3) give install an escape hatch — `--adopt`/`--force` that re-derives ownership — so a partially-uninstalled t
  **Post-Mortem & Fix Analysis**:
  > Thank you for your report. We are investigating.

- **Issue #303** (2026-08-29): **Readme**
  *Symptoms*:   <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Documentation**   * Removed the Star History chart and related section from the English README.   * Removed the corresponding Star History content from the Chinese README.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/foryourhealth111-pixel/Vibe-Skills/pull/303)  <!-- review_stack_entry_end --> <!-- This is an auto-generated comment: failure by coderabbit.ai -->  > [!CAUTION] > ## Review failed >  > The pull request is closed.  <!-- end of auto-generated comment: failure by coderabbit.ai -->  <!-- recent_review_start -->  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: defaults  **Review profile**: CHILL  **Plan**: Pro Plus  **Run ID**: `aabfbf94-304f-4794-b876-49d3b70827f6`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between be2b48fef5f5ed56ae772ad2508ef8609f83bd19 and 48db377e9d082d0ba3249cf2dd3be6

- **Issue #302** (2026-08-29): **Readme fix**
  *Symptoms*:   <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Documentation**   * Added benchmark analysis explaining how clearer objectives, task decomposition, selective skill usage, dependency-aware execution, planning, and pre-delivery checks improve task performance.   * Documented reductions in ineffective tool loops, repeated context reading, rework, token usage, and tool calls.   * Added corresponding performance insights to the Chinese documentation.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/foryourhealth111-pixel/Vibe-Skills/pull/302)  <!-- review_stack_entry_end --> <!-- walkthrough_start -->  <details> <summary>📝 Walkthrough</summary>  ## Walkthrough  The README files add English and Chinese benchmark analysis. The text attributes improved performance to task planning, decomposition, selective Skill use, dependency-ordered execution, and pre-delivery checks.  ### Changes  **Benchmark analysis documentation**  |Layer / File(s)|Summary| |---|---| |**Document benchmark workflow analysis** <br> `README.md`, `README.zh.md`|The README files describe the workflow factors associated with benchmark performance and reduced ineffective tool calls, repeated context processing, token usage, and rework.|  **Estimated code revi

- **Issue #301** (2026-08-29): **feat(runtime): carry Skill guidance through planning and delivery**
  *Symptoms*: ## Summary  - Extend the existing production Skill Card pipeline to retain or derive `inputs`, `outputs`, `plan_hints`, and `verify_hints`. - Carry user-confirmed Skill guidance into WorkPlan and bound ModuleAssignments while removing automatic candidate guidance before confirmation or after an agent-direct choice. - Validate explicit module dependencies, apply a stable topological order, and preserve dependency links in delivery artifacts. - Add a concise WorkDossier delivery summary that reports verified results, locations, checks, and genuine blockers while excluding scaffolds. - Harden Markdown guidance parsing for matching long or nested code fences, and invalidate completed work when dependencies, verification, or accepted Skill guidance changes. - Bind resumed work to content identity: persist the selected Skill's SHA-256 and each completed artifact's SHA-256, rerun legacy records without hashes, and send post-completion artifact changes back for rework. - Release the integrated runtime as `4.1.0`, synchronized across version governance, all Python packages, bilingual README/install surfaces, and generated distribution manifests. - Make `release-cut.ps1` honor `legacy_write_mode=disabled`, keeping retired Markdown release surfaces externalized while updating the version authority, ledger, Skill marker, and distribution manifests. - Surface the public SkillsBench evidence near the top of both READMEs, with high-resolution task-outcome and resource-use figures, concise m
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/foryourhealth111-pixel/Vibe-Skills/pull/301)  <!-- review_stack_entry_end --> <!-- This is an auto-generated comment: review paused by coderabbit.ai -->  > [!NOTE] > ## Reviews paused >  > It looks like this branch is under active development. To avoid overwhelming you with review comments due to an influx of new commits, CodeRabbit has automatically paused this review. You can configure this behavior by changing the `reviews.auto_review.auto_pause_after_reviewed_commits` setting. >  > Use the following commands to manage reviews: > - `@coderabbitai resume` to resume automatic reviews. > - `@coderabbitai review` to trigger a single review. >  > Use the checkboxes below for quick actions: > - [ ] <!-- {"checkboxId":"7f6cc2e2-2e4e-
  > CodeRabbit follow-up:  - Fixed the stale-resume finding in `50f6749`: `_can_reuse_previous_work` now compares `depends_on`, `verification`, `task_verification`, `plan_hints`, and `verify_hints` in addition to the existing Skill and acceptance fields. Regression tests cover dependency, verification, and Skill-guidance changes. - The dependent-unit observation was reviewed against the current kernel contract. `execute_work_unit` only writes `needs_execution` scaffolds (`artifact_kind=scaffold`, `proof_ready=false`, `used_skill=None`); it does not perform domain execution or mark a prerequisite completed. Creating the complete scaffold set is intentional so the Agent can execute the dependency-ordered plan. The existing Agent contract controls real progression by dependency readiness, and the verifier rejects scaffold-only results. No runtime change was made for this point. - Focused verification after both fixes: `61 passed, 3 skipped`. Canonical validation: `165 passed`.
  > Follow-up hardening is now included in this PR:  - `6e08f10` persists the selected Skill content SHA-256 and completed artifact SHA-256 values, invalidates legacy or changed resume records, and makes the verifier return changed artifacts for rework. - `686bb4b` appends the final `4.1.0` release-ledger record bound to that runtime fix.  Focused behavior now passes with 74 tests and 3 skips. Canonical Python validation passes with 165 tests. The final release-ledger/release-cut set passes with 29 tests, and both version gates pass 9/9 after the ledger update. 

- **Issue #287** (2026-08-11): **governance: collapse the live documentation control plane**
  *Symptoms*: ## Summary  This PR implements the direct runtime and governance cleanup requested for #264.  - Route generated requirements, plans, status, proof, and manifests through the canonical `.vibeskills/runs/<run_id>` sink. - Disable default legacy documentation writes in the live contract. - Add a tracked-Markdown census with migration and strict modes. - Reduce the governed live-document registry to 28 registered documents plus 1 explicit legal exclusion, with zero unregistered documents. - Remove dated governance, plan, status, proof, archive, and superseded control-plane records from the main tree. - Update gates, runtime-neutral contracts, integration tests, and navigation to use executable contracts and current entrypoints. - Keep `bundled/skills` unchanged.  ## Verification  - Strict live-document census: PASS (`registered=28`, `excluded=1`, `unregistered=0`) - Live contract and document gate tests: 73 passed - Runtime artifact and local-kernel tests: 75 passed, 3 skipped - Runtime-neutral issue-scope tests: 49 passed - Version consistency gate: 9/9 PASS - Release truth consistency gate: PASS - `git diff --check`: PASS  The full local pytest invocation exceeded the 20-minute execution limit; the focused suites above and the completed integration/unit baselines cover the changed contracts.  ## Scope  - Version remains `4.0.0`. - No GitHub Release, tag, or publication workflow is included. - No new financial content is introduced.  Refs #264
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- This is an auto-generated comment: rate limited by coderabbit.ai -->  > [!IMPORTANT] > ## Review skipped >  > Too many files! >  > This PR contains 729 files, which is 429 over the limit of 300. >  > To get a review, reduce the PR to 300 files or fewer by splitting it into smaller PRs or changing its base branch. >  > Usage-priced reviews support at most 300 files. >  > <details> > <summary>⚙️ Run configuration</summary> >  > **Configuration used**: defaults >  > **Review profile**: CHILL >  > **Plan**: Pro Plus >  > **Run ID**: `eadd46e2-b92a-4b7a-ada1-2e94748abd78` >  > </details> >  > <details> > <summary>📥 Commits</summary> >  > Reviewing files that changed from the base of the PR and between ef32a8a9c17721e66825beb8f03815f6b60d6d48 and 204753e077c06fed320a34e57a2c2f8ee3cb759b. >  > </details> >  > <details> > <summary>📒 Files selected for processing (729)</summary> >  > * `CONTRIBUTING.md` > * `README.md

- **Issue #286** (2026-08-11): **contracts: make governance artifact resolution fail closed**
  *Symptoms*: ## Summary  - Load and validate `config/live-document-contract.json` strictly in Python and PowerShell. - Reject missing or malformed contracts and reject historical documentation roots, including descendants, as artifact workspaces or primary destinations. - Derive canonical run, session receipt, re-entry, and child-stage paths from the executable contract. - Record compatibility destinations, mode, and removal release in manifests and receipts. - Make session ownership, retention, source, and destination boundaries explicit and behavior-tested.  ## Guarded surfaces  - `scripts/runtime/**` - `scripts/verify/vibe-no-duplicate-canonical-surface-gate.ps1` - `config/live-document-contract.json`  ## Proof bundle  | Command | Output | Claim | | --- | --- | --- | | `py -3 -m pytest tests/unit/test_canonical_vibe_entry_launcher.py tests/unit/test_local_kernel_execution.py tests/unit/test_live_governance_contract.py tests/integration/test_shared_run_artifact_contract.py -q` | `210 passed, 3 skipped` | Cross-language resolution, fail-closed validation, compatibility reporting, and canonical launch behavior pass. | | `py -3 -m pytest tests/integration -q` | `253 passed` | The complete integration layer, including PowerShell interoperability, passes. | | Changed runtime-neutral suite | `54 passed, 4 skipped` | Cross-host memory, installed runtime, session ownership, and root-child behavior remain compatible. | | `py -3 -m pytest tests/unit -q` | `622 passed, 3 skipped` | The complete un
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/foryourhealth111-pixel/Vibe-Skills/pull/286?utm_source=github_walkthrough&utm_medium=github&utm_campaign=change_stack)  <!-- review_stack_entry_end --> <!-- walkthrough_start -->  <details> <summary>📝 Walkthrough</summary>  ## Walkthrough  The runtime now uses `config/live-document-contract.json` as the executable artifact authority. Python and PowerShell validate the same contract, resolve session and artifact roots, record compatibility writes, synchronize receipts, and enforce canonical paths for root and child runs.  ### Changes  **Runtime artifact governance**  |Layer / File(s)|Summary| |---|---| |**Contract model and executable governance** <br> `config/live-document-contract.json`, `docs/governance/...`, `packages/contrac

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

### Incident Patch 1: `ddcaa2af` (2026-08-31)
**Commit Message**: Merge pull request #307 from foryourhealth111-pixel/codex/issues-304-305-fix

installer: recover partial uninstalls and type CLI exits

**File**: `apps/vgo-cli/src/vgo_cli/commands.py` (modified, +109/-26)
```diff
@@ -8,7 +8,14 @@
 import sys
 
 from .core_bridge import run_canonical_entry_core, run_compatibility_exit_core, run_entry_locator_core, run_inspect_run_core, run_local_kernel_core, run_router_core, run_skill_index_core
-from .errors import CliError
+from .errors import (
+    CliError,
+    CliIoError,
+    CliMissingResourceError,
+    CliPermissionError,
+    CliStateError,
+    CliUnavailableError,
+)
 from .output import print_json_payload
 from .process import print_process_output, run_powershell_file, run_subprocess
 from .repo import get_installed_runtime_config, get_local_release_metadata
@@ -18,6 +25,18 @@
 PROJECT_URL = "https://github.com/foryourhealth111-pixel/Vibe-Skills"
 
 
+def _installer_cli_error(exc: RuntimeError | OSError | ValueError) -> CliError:
+    if isinstance(exc, PermissionError):
+        return CliPermissionError(str(exc))
+    if isinstance(exc, FileNotFoundError):
+        return CliMissingResourceError(str(exc))
+    if isinstance(exc, TimeoutError):
+        return CliUnavailableError(str(exc))
+    if isinstance(exc, OSError):
+        return CliIoError(str(exc))
+    return CliStateError(str(exc))
+
+
 def _resolve_skills_dir(raw_value: str) -> Path:
     if str(raw_value or '').strip():
         return Path(raw_value).expanduser().resolve()
@@ -50,12 +69,37 @@ def _load_public_release_bundle(source_root: Path) -> dict[str, object] | None:
     bundle_path = source_root / "release-bundle.json"
     if not bundle_path.is_file():
         return None
-    payload = json.loads(bundle_path.read_text(encoding="utf-8"))
+    try:
+        payload = json.loads(bundle_path.read_text(encoding="utf-8"))
+    except ValueError as exc:
+        raise CliStateError(f"Unreadable public release bundle: {bundle_path}") from exc
     if not isinstance(payload, dict):
-        raise CliError(f"Expected JSON object: {bundle_path}")
+        raise CliStateError(f"Expected JSON object: {bundle_path}")
     return payload
 
 
+def _bundle_mapping(
+    bundle: dict[str, object],
+    field_name: str,
+    bundle_path: Path,
+) -> dict[str, object]:
+    value = bundle.get(field_name)
+    if not isinstance(value, dict):
+        raise CliStateError(f"Public release bundle field '{field_name}' must be an object: {bundle_path}")
+    return value
+
+
+def _bundle_required_text(
+    mapping: dict[str, object],
+    field_name: str,
+    bundle_path: Path,
+) -> str:
+    value = mapping.get(field_name)
+    if not isinstance(value, str) or not value.strip():
+        raise CliStateError(f"Public release bundle field '{field_name}' must be non-empty text: {bundle_path}")
+    return value.strip()
+
+
 def _local_release_version(source_root: Path) -> str:
     try:
         return str(get_local_release_metadata(source_root).get("version") or "").strip()
@@ -66,15 +110,34 @@ def _local_release_version(source_root: Path) -> str:
 def _install_source_kwargs(source_root: Path) -> dict[str, object]:
     bundle = _load_public_release_bundle(source_root)
     if bundle is not None:
-        public_install = bundle.get("public_install") or {}
-        if str(public_install.get("source_kind") or "").strip() == "public_release":
-            release = bundle.get("release") or {}
-            asset = bundle.get("asset") or {}
-            version = str(release.get("version") or "").strip()
-            asset_name = str(asset.get("file_name") or "").strip()
-            if not version or not asset_name:
-                raise CliError("Public release bundle is missing release version or asset name.")
-            digest = str(asset.get("payload_digest_sha256") or "").strip()
+        public_install_value = bundle.get("public_install")
+        if public_install_value is None:
+            public_install: dict[str, object] = {}
+        elif isinstance(public_install_value, dict):
+            public_install = public_install_value
+        else:
+            raise CliStateError(
+                f"Public release bundle field 'p
```

**File**: `apps/vgo-cli/src/vgo_cli/errors.py` (modified, +33/-1)
```diff
@@ -1,5 +1,37 @@
 from __future__ import annotations
 
+from enum import IntEnum
+
+
+class CliExitCode(IntEnum):
+    FAILURE = 1
+    USAGE = 2
+    INVALID_STATE = 3
+    MISSING_RESOURCE = 4
+    PERMISSION_DENIED = 5
+    UNAVAILABLE = 6
+    IO_ERROR = 7
+
 
 class CliError(RuntimeError):
-    pass
+    exit_code = CliExitCode.FAILURE
+
+
+class CliStateError(CliError):
+    exit_code = CliExitCode.INVALID_STATE
+
+
+class CliMissingResourceError(CliError):
+    exit_code = CliExitCode.MISSING_RESOURCE
+
+
+class CliPermissionError(CliError):
+    exit_code = CliExitCode.PERMISSION_DENIED
+
+
+class CliUnavailableError(CliError):
+    exit_code = CliExitCode.UNAVAILABLE
+
+
+class CliIoError(CliError):
+    exit_code = CliExitCode.IO_ERROR
```

**File**: `apps/vgo-cli/src/vgo_cli/hosts.py` (modified, +4/-2)
```diff
@@ -5,7 +5,7 @@
 from pathlib import Path
 from types import ModuleType
 
-from .errors import CliError
+from .errors import CliError, CliUnavailableError
 from .workspace import extend_workspace_package_path
 
 
@@ -59,7 +59,9 @@ def _resolve_host_entry(host_id: str | None) -> tuple[str, dict[str, object]]:
         try:
             entry = dict(registry_module.resolve_adapter_entry(registry, normalized))
         except ValueError as exc:
-            raise CliError(f'Unable to resolve host registry entry for: {host_id}') from exc
+            raise CliUnavailableError(
+                f'Unable to resolve host registry entry for: {host_id}'
+            ) from exc
     return normalized, entry
 
 
```

**File**: `apps/vgo-cli/src/vgo_cli/main.py` (modified, +1/-1)
```diff
@@ -146,7 +146,7 @@ def main(argv: list[str] | None = None) -> int:
         if message:
             for line in message.splitlines():
                 print(f'[FAIL] {line}', file=sys.stderr)
-        return 1
+        return int(exc.exit_code)
 
 
 if __name__ == '__main__':
```

**File**: `apps/vgo-cli/src/vgo_cli/process.py` (modified, +2/-2)
```diff
@@ -11,7 +11,7 @@
 from typing import Any, Callable, Sequence
 import warnings
 
-from .errors import CliError
+from .errors import CliUnavailableError
 
 
 REPO_ROOT = Path(__file__).resolve().parents[4]
@@ -259,7 +259,7 @@ def run_powershell_file(script_path: Path, *args: str) -> subprocess.CompletedPr
         if checked:
             detail_parts.append(f"candidates checked: {', '.join(checked)}")
         detail = f"; {'; '.join(detail_parts)}" if detail_parts else ""
-        raise CliError(f"PowerShell is required to run: {script_path}{detail}")
+        raise CliUnavailableError(f"PowerShell is required to run: {script_path}{detail}")
     shell_path = str(resolution["host_path"])
     leaf = Path(shell_path).name.lower()
     command = [shell_path, '-NoProfile']
```

---

### Incident Patch 2: `686bb4bc` (2026-08-29)
**Commit Message**: chore(release): bind 4.1.0 to content-hash fix

**File**: `references/release-ledger.jsonl` (modified, +1/-0)
```diff
@@ -38,3 +38,4 @@
 {"recorded_at":"2026-07-08T15:35:12","version":"3.2.0","updated":"2026-07-08","git_head":"7c6ac63","actor":"羽裳"}
 {"recorded_at":"2026-07-17T09:42:23","version":"4.0.0","updated":"2026-07-17","git_head":"c1665ba7","actor":"羽裳"}
 {"recorded_at":"2026-08-29T16:51:04","version":"4.1.0","updated":"2026-08-29","git_head":"50f6749","actor":"羽裳"}
+{"recorded_at":"2026-08-29T18:45:46","version":"4.1.0","updated":"2026-08-29","git_head":"6e08f10","actor":"羽裳"}
```

---

### Incident Patch 3: `6e08f100` (2026-08-29)
**Commit Message**: fix(runtime): bind resumed work to content hashes

**File**: `SKILL.md` (modified, +1/-0)
```diff
@@ -250,6 +250,7 @@ Never claim success without evidence. Minimum invariants:
 - Expose failures, fallback, degraded status, or blocked state explicitly.
 - Do not add mock success paths, swallowed errors, or template-only pass results.
 - Treat scaffold or draft artifacts as `needs_execution` with `proof_ready = false`; do not call them completed work.
+- Reuse completed work only while its selected Skill content and delivered artifact hashes remain unchanged; rerun changed units before verification.
 - Do not use fallback or boundary behavior to bypass real execution,
   verification, or root-cause repair.
 - When a check fails within the confirmed scope, make at most one targeted
```

**File**: `packages/runtime-core/src/vgo_runtime/kernel/executor.py` (modified, +35/-1)
```diff
@@ -1,6 +1,7 @@
 from __future__ import annotations
 
-from dataclasses import asdict, dataclass
+from dataclasses import asdict, dataclass, replace
+import hashlib
 import json
 from pathlib import Path
 import re
@@ -26,6 +27,7 @@ class WorkUnitResult:
     failure_reason: str | None = None
     artifact_kind: str = "scaffold"
     proof_ready: bool = False
+    artifact_sha256: tuple[str, ...] = ()
 
     def model_dump(self) -> dict[str, object]:
         return asdict(self)
@@ -34,6 +36,38 @@ def artifact_evidence_paths(self) -> tuple[str, ...]:
         return tuple(path for path in (*self.artifact_paths, *self.proof_artifact_paths) if str(path).strip())
 
 
+def artifact_sha256_for_paths(artifact_paths: tuple[str, ...]) -> tuple[str, ...]:
+    digests: list[str] = []
+    for raw_path in artifact_paths:
+        path = Path(raw_path)
+        try:
+            is_file = path.is_file()
+        except OSError:
+            is_file = False
+        if not is_file:
+            digests.append("")
+            continue
+        digest = hashlib.sha256()
+        try:
+            with path.open("rb") as stream:
+                for chunk in iter(lambda: stream.read(1024 * 1024), b""):
+                    digest.update(chunk)
+        except OSError:
+            digests.append("")
+            continue
+        digests.append(digest.hexdigest())
+    return tuple(digests)
+
+
+def capture_completed_artifact_sha256(result: WorkUnitResult) -> WorkUnitResult:
+    if result.status != "completed":
+        return result
+    return replace(
+        result,
+        artifact_sha256=artifact_sha256_for_paths(result.artifact_paths),
+    )
+
+
 SLUG_PATTERN = re.compile(r"[^a-z0-9]+")
 
 
```

**File**: `packages/runtime-core/src/vgo_runtime/kernel/finder.py` (modified, +2/-0)
```diff
@@ -25,6 +25,7 @@ class SkillCandidate:
     resolved_skill_file: str
     path_contract: str
     path_base: str
+    content_sha256: str = ""
     warnings: tuple[str, ...] = ()
     inputs: tuple[str, ...] = ()
     outputs: tuple[str, ...] = ()
@@ -141,6 +142,7 @@ def find_skill_candidates(task_card: TaskCard, index_payload: dict[str, object],
                 resolved_skill_file=str(source_metadata["resolved_skill_file"]),
                 path_contract=str(source_metadata["path_contract"]),
                 path_base=str(source_metadata["path_base"]),
+                content_sha256=str(raw_entry.get("content_sha256") or "").strip().lower(),
             )
         )
     ranked = sorted(
```

**File**: `packages/runtime-core/src/vgo_runtime/kernel/loop.py` (modified, +47/-16)
```diff
@@ -5,7 +5,12 @@
 from dataclasses import replace
 from pathlib import Path
 
-from .executor import WorkUnitResult, execute_work_unit
+from .executor import (
+    WorkUnitResult,
+    artifact_sha256_for_paths,
+    capture_completed_artifact_sha256,
+    execute_work_unit,
+)
 from .finder import find_skill_candidates
 from .host_skill_roots import resolve_host_skill_roots
 from .planner import build_work_plan
@@ -72,6 +77,7 @@ def _skill_provenance(candidate: object) -> SkillProvenance:
         source_order=int(getattr(candidate, "source_order")),
         path_contract=str(getattr(candidate, "path_contract")),
         path_base=str(getattr(candidate, "path_base")),
+        content_sha256=str(getattr(candidate, "content_sha256", "")),
     )
 
 
@@ -386,6 +392,7 @@ def _coerce_work_result(payload: dict[str, object]) -> WorkUnitResult:
             else None
         ),
         failure_reason=(str(payload["failure_reason"]) if payload.get("failure_reason") is not None else None),
+        artifact_sha256=tuple(str(value) for value in payload.get("artifact_sha256", [])),
     )
 
 
@@ -402,6 +409,7 @@ def _coerce_skill_provenance(payload: object) -> SkillProvenance | None:
         source_order=int(payload["source_order"]),
         path_contract=str(payload["path_contract"]),
         path_base=str(payload["path_base"]),
+        content_sha256=str(payload.get("content_sha256") or ""),
     )
 
 
@@ -476,6 +484,11 @@ def _unique_non_empty(values: list[str]) -> list[str]:
 def _can_reuse_previous_work(*, previous_work_unit: WorkUnit | None, current_work_unit: WorkUnit) -> bool:
     if previous_work_unit is None:
         return False
+    if current_work_unit.preferred_skill is not None:
+        provenance = current_work_unit.selected_skill_provenance
+        content_sha256 = provenance.content_sha256 if provenance is not None else ""
+        if len(content_sha256) != 64 or any(character not in "0123456789abcdef" for character in content_sha256):
+            return False
     return (
         previous_work_unit.preferred_skill == current_work_unit.preferred_skill
         and previous_work_unit.selected_skill_provenance == current_work_unit.selected_skill_provenance
@@ -488,6 +501,17 @@ def _can_reuse_previous_work(*, previous_work_unit: WorkUnit | None, current_wor
     )
 
 
+def _completed_result_artifacts_are_current(result: WorkUnitResult) -> bool:
+    if result.status != "completed" or not result.artifact_paths:
+        return False
+    if len(result.artifact_paths) != len(result.artifacts):
+        return False
+    recorded = result.artifact_sha256
+    if len(recorded) != len(result.artifact_paths) or any(not digest for digest in recorded):
+        return False
+    return recorded == artifact_sha256_for_paths(result.artifact_paths)
+
+
 def _inspect_host_context(
     *,
     agent_root: Path,
@@ -850,16 +874,12 @@ def _render_work_dossier_markdown(work_dossier: dict[str, object]) -> str:
     closure_payload = closure if isinstance(closure, dict) else {}
     task_card_payload = work_dossier.get("task_card")
     task_card = task_card_payload if isinstance(task_card_payload, dict) else {}
-    work_plan_payload = work_dossier.get("work_plan")
-    work_plan = work_plan_payload if isinstance(work_plan_payload, dict) else {}
     module_assignments_payload = work_dossier.get("module_assignments")
     module_assignments = module_assignments_payload if isinstance(module_assignments_payload, dict) else {}
     work_results_payload = work_dossier.get("work_results")
     work_results = work_results_payload if isinstance(work_results_payload, dict) else {}
     work_payload = closure_payload.get("work")
     work_section = work_payload if isinstance(work_payload, dict) else {}
-    skills_payload = closure_payload.get("skills")
-    skills_section = skills_payload if isinstance(skills_payload, dict) else {}
     outputs_payload = closure_payload.get("outputs")
     outputs_section = outputs_payload if isi
```

**File**: `packages/runtime-core/src/vgo_runtime/kernel/module_assignments.py` (modified, +1/-0)
```diff
@@ -30,6 +30,7 @@ def model_dump(self) -> dict[str, object]:
             payload["skill_source_order"] = provenance["source_order"]
             payload["skill_path_contract"] = provenance["path_contract"]
             payload["skill_path_base"] = provenance["path_base"]
+            payload["skill_content_sha256"] = provenance["content_sha256"]
         return payload
 
 
```

---

### Incident Patch 4: `50f67499` (2026-08-29)
**Commit Message**: fix(runtime): invalidate stale Skill guidance on resume

**File**: `packages/runtime-core/src/vgo_runtime/kernel/loop.py` (modified, +5/-0)
```diff
@@ -480,6 +480,11 @@ def _can_reuse_previous_work(*, previous_work_unit: WorkUnit | None, current_wor
         previous_work_unit.preferred_skill == current_work_unit.preferred_skill
         and previous_work_unit.selected_skill_provenance == current_work_unit.selected_skill_provenance
         and previous_work_unit.acceptance_criteria == current_work_unit.acceptance_criteria
+        and previous_work_unit.depends_on == current_work_unit.depends_on
+        and previous_work_unit.verification == current_work_unit.verification
+        and previous_work_unit.task_verification == current_work_unit.task_verification
+        and previous_work_unit.plan_hints == current_work_unit.plan_hints
+        and previous_work_unit.verify_hints == current_work_unit.verify_hints
     )
 
 
```

**File**: `packages/runtime-core/src/vgo_runtime/kernel/skill_manifest.py` (modified, +12/-4)
```diff
@@ -277,13 +277,21 @@ def _extract_body_guidance(body_lines: list[str], *, limit_per_section: int = 12
         "verify_hints": [],
     }
     active_section = ""
-    in_code_fence = False
+    code_fence: str | None = None
     for line in body_lines:
         stripped = line.strip()
-        if stripped.startswith("```") or stripped.startswith("~~~"):
-            in_code_fence = not in_code_fence
+        fence_match = re.match(r"^(`{3,}|~{3,})", stripped)
+        if code_fence is None and fence_match is not None:
+            code_fence = fence_match.group(1)
             continue
-        if in_code_fence:
+        if code_fence is not None:
+            if (
+                fence_match is not None
+                and fence_match.group(1)[0] == code_fence[0]
+                and len(fence_match.group(1)) >= len(code_fence)
+                and len(fence_match.group(1)) == len(stripped)
+            ):
+                code_fence = None
             continue
         section = _body_guidance_section(stripped)
         if section is not None:
```

**File**: `packages/runtime-core/src/vgo_runtime/test_skill_cache_routing.py` (modified, +41/-0)
```diff
@@ -202,6 +202,47 @@ def test_skill_card_derives_execution_guidance_from_standard_sections(tmp_path:
     assert entry["verify_hints"] == ["confirm every artifact exists at its reported location"]
 
 
+def test_skill_card_ignores_guidance_inside_long_code_fence(tmp_path: Path) -> None:
+    agent_root = tmp_path / ".agents"
+    skills_root = agent_root / "skills"
+    skills_root.mkdir(parents=True)
+
+    _write_skill(
+        skills_root,
+        "fenced-guidance",
+        """
+name: Fenced Guidance
+description: Keep examples separate from executable guidance.
+""",
+        """
+## Workflow
+
+- Follow the real workflow step.
+
+````markdown
+## Verification
+
+- ignore the fenced verification example
+```
+## Outputs
+
+- ignore the fenced output example
+````
+
+## Verification
+
+- run the real verification check
+""",
+    )
+
+    result = build_skill_index(agent_root, host_roots=(skills_root,))
+    entry = next(row for row in result["skills"] if row["skill_id"] == "fenced-guidance")
+
+    assert entry["outputs"] == []
+    assert entry["plan_hints"] == ["Follow the real workflow step."]
+    assert entry["verify_hints"] == ["run the real verification check"]
+
+
 def test_route_uses_weak_text_capability_evidence_for_existing_skills_without_capability_fields(tmp_path: Path) -> None:
     agent_root = tmp_path / ".agents"
     skills_root = agent_root / "skills"
```

**File**: `tests/unit/test_local_kernel_execution.py` (modified, +25/-2)
```diff
@@ -1,8 +1,9 @@
 from __future__ import annotations
 
+from dataclasses import replace
 import json
-import shutil
 from pathlib import Path
+import shutil
 import sys
 import uuid
 
@@ -17,7 +18,7 @@
 from vgo_runtime.artifact_contract import _copy_run_tree
 from vgo_runtime.kernel.executor import WorkUnitResult, execute_work_unit
 from vgo_runtime.kernel.finder import find_skill_candidates
-from vgo_runtime.kernel.loop import inspect_local_run, inspect_main, run_local_kernel
+from vgo_runtime.kernel.loop import _can_reuse_previous_work, inspect_local_run, inspect_main, run_local_kernel
 from vgo_runtime.kernel.planner import build_work_plan
 from vgo_runtime.kernel.run_state import load_run_state, write_run_state
 from vgo_runtime.kernel.task_card import build_task_card
@@ -226,6 +227,28 @@ def test_verify_run_reports_needs_execution_for_scaffold_only_result() -> None:
     assert any("requires real execution evidence" in note for note in verification.notes)
 
 
+@pytest.mark.parametrize(
+    ("field_name", "changed_value"),
+    [
+        ("depends_on", ("wu-prerequisite",)),
+        ("verification", ("updated verification",)),
+        ("task_verification", ("updated task verification",)),
+        ("plan_hints", ("updated plan guidance",)),
+        ("verify_hints", ("updated verification guidance",)),
+    ],
+)
+def test_previous_work_is_not_reused_after_guidance_or_dependency_changes(
+    field_name: str,
+    changed_value: tuple[str, ...],
+) -> None:
+    task_card = build_task_card(prompt="Review the runtime change.")
+    previous = build_work_plan(task_card, find_skill_candidates(task_card, _index_payload())).work_units[0]
+    current = replace(previous, **{field_name: changed_value})
+
+    assert _can_reuse_previous_work(previous_work_unit=previous, current_work_unit=previous)
+    assert not _can_reuse_previous_work(previous_work_unit=previous, current_work_unit=current)
+
+
 def test_run_state_round_trip_persists_json(tmp_path: Path) -> None:
     state_path = tmp_path / "run-state.json"
     run_state = write_run_state(
```

---

### Incident Patch 5: `d5ae5604` (2026-08-11)
**Commit Message**: Merge pull request #287 from foryourhealth111-pixel/codex/issue-264-direct-fix

governance: collapse the live documentation control plane

**File**: `CONTRIBUTING.md` (modified, +1/-1)
```diff
@@ -97,7 +97,7 @@ contributor zone table to recognize a new file category.
 Always read:
 
 - [`docs/developer-change-governance.md`](docs/developer-change-governance.md)
-- [`docs/distribution-governance.md`](docs/distribution-governance.md)
+- [`docs/governance/distribution-governance.md`](docs/governance/distribution-governance.md)
 - [`docs/repo-cleanliness-governance.md`](docs/repo-cleanliness-governance.md)
 
 ### Mirror, Fixture, Provenance, or Compliance
```

**File**: `README.md` (modified, +2/-2)
```diff
@@ -408,7 +408,7 @@ completion.
 | `delivery-acceptance-report.json` or `.md` | Stores the final check and shows which items passed |
 
 Maintainers can use the
-[pre-release checklist](docs/status/non-regression-proof-bundle.md). Start with
+[pre-release checks](https://github.com/foryourhealth111-pixel/Vibe-Skills/actions/workflows/vco-gates.yml). Start with
 the checks in that list and run wider audits only when there is a reason.
 
 </details>
@@ -451,7 +451,7 @@ not mean the final result passed its checks.
     <tr><td align="center">See a complete real run</td><td align="center"><strong><a href="./docs/cases/ml-experiment/README.md">Machine-learning experiment case</a></strong></td></tr>
     <tr><td align="center">Install, update, uninstall</td><td align="center"><strong><a href="./docs/install/README.en.md">Simple install</a></strong></td></tr>
     <tr><td align="center">First use</td><td align="center"><strong><a href="./docs/quick-start.en.md">Quick start</a></strong></td></tr>
-    <tr><td align="center">Current release</td><td align="center"><strong><a href="./docs/releases/v4.0.0.md">v4.0.0 notes</a></strong></td></tr>
+    <tr><td align="center">Current release</td><td align="center"><strong><a href="https://github.com/foryourhealth111-pixel/Vibe-Skills/releases/latest">GitHub release metadata</a></strong></td></tr>
     <tr><td align="center">How it works</td><td align="center"><strong><a href="./docs/README.md">Documentation index</a></strong></td></tr>
     <tr><td align="center">Troubleshooting</td><td align="center"><strong><a href="./docs/troubleshooting.md">Troubleshooting guide</a></strong></td></tr>
     <tr><td align="center">Contributing</td><td align="center"><strong><a href="./CONTRIBUTING.md">Contribution guide</a></strong></td></tr>
```

**File**: `README.zh.md` (modified, +2/-2)
```diff
@@ -390,7 +390,7 @@ VibeSkills 会把确认过的需求、计划、执行进度和最终检查保存
 | `module-execution.json` | 保存各部分实际完成的结果，以及完成、失败或被卡住的状态 |
 | `delivery-acceptance-report.json` 或 `.md` | 保存最终检查结果，说明哪些项目已经通过 |
 
-维护项目时，可以使用这份[提交前检查清单](docs/status/non-regression-proof-bundle.md)。
+维护项目时，可以查看 [CI 检查结果](https://github.com/foryourhealth111-pixel/Vibe-Skills/actions/workflows/vco-gates.yml) 和本地 `check.ps1` 输出。
 一般先完成清单里的基础检查；只有发现风险时，再扩大检查范围。
 
 </details>
@@ -433,7 +433,7 @@ VibeSkills 会把确认过的需求、计划、执行进度和最终检查保存
     <tr><td align="center">查看一次完整的真实运行</td><td align="center"><strong><a href="./docs/cases/ml-experiment/README.zh.md">机器学习实验案例</a></strong></td></tr>
     <tr><td align="center">安装、更新、卸载</td><td align="center"><strong><a href="./docs/install/README.md">简明安装指南</a></strong></td></tr>
     <tr><td align="center">第一次使用</td><td align="center"><strong><a href="./docs/quick-start.md">快速开始</a></strong></td></tr>
-    <tr><td align="center">当前发布版本</td><td align="center"><strong><a href="./docs/releases/v4.0.0.md">v4.0.0 发布说明</a></strong></td></tr>
+    <tr><td align="center">当前发布版本</td><td align="center"><strong><a href="https://github.com/foryourhealth111-pixel/Vibe-Skills/releases/latest">GitHub Release 元数据</a></strong></td></tr>
     <tr><td align="center">了解它怎么工作</td><td align="center"><strong><a href="./docs/README.md">文档索引</a></strong></td></tr>
     <tr><td align="center">排查问题</td><td align="center"><strong><a href="./docs/troubleshooting.md">故障排查</a></strong></td></tr>
     <tr><td align="center">参与贡献</td><td align="center"><strong><a href="./CONTRIBUTING.md">贡献指南</a></strong></td></tr>
```

**File**: `THIRD_PARTY_LICENSES.md` (modified, +2/-2)
```diff
@@ -62,9 +62,9 @@ It does not relicense upstream code, prompts, datasets, or services.
 ## Operational References
 
 - Distribution governance policy:
-  [docs/distribution-governance.md](docs/distribution-governance.md)
+  [docs/governance/distribution-governance.md](docs/governance/distribution-governance.md)
 - Upstream governance policy:
-  [docs/governance/upstream-distribution-governance.md](docs/governance/upstream-distribution-governance.md)
+  [docs/governance/distribution-governance.md](docs/governance/distribution-governance.md)
 - Provenance policy:
   [docs/governance/origin-provenance-policy.md](docs/governance/origin-provenance-policy.md)
 - Canonical upstream registry:
```

**File**: `config/current-routing-debt-erasure.json` (modified, +0/-3)
```diff
@@ -81,8 +81,6 @@
       "config",
       "docs/README.md",
       "docs/governance/README.md",
-      "docs/status/README.md",
-      "docs/releases/README.md",
       "docs/governance/vibe-governed-project-delivery-acceptance-governance.md",
       "scripts/router/resolve-pack-route.ps1",
       "scripts/router",
@@ -96,7 +94,6 @@
       "docs/governance/current-routing-contract.md",
       "docs/governance/current-runtime-field-contract.md",
       "docs/install",
-      "docs/status",
       "protocols"
     ],
     "legacy_allowed_paths": [
```

#### Recent Merged Pull Requests:
- **PR #307** (2026-08-31): installer: recover partial uninstalls and type CLI exits (@foryourhealth111-pixel)
- **PR #303** (2026-08-29): Readme (@foryourhealth111-pixel)
- **PR #302** (2026-08-29): Readme fix (@foryourhealth111-pixel)
- **PR #301** (2026-08-29): feat(runtime): carry Skill guidance through planning and delivery (@foryourhealth111-pixel)
- **PR #287** (2026-08-11): governance: collapse the live documentation control plane (@foryourhealth111-pixel)
- **PR #286** (2026-08-11): contracts: make governance artifact resolution fail closed (@foryourhealth111-pixel)
- **PR #273** (2026-08-03): governance: switch live verification and proof contracts (@foryourhealth111-pixel)
- **PR #272** (2026-08-01): runtime: unify Python and PowerShell run artifacts (@foryourhealth111-pixel)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
