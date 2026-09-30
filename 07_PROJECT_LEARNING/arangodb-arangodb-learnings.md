# Forensic Learning Record (Deep Inspection): arangodb/arangodb

> **Canonical Artifact**: `07_PROJECT_LEARNING/arangodb-arangodb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/arangodb/arangodb](https://github.com/arangodb/arangodb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:29:15.541Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `arangodb/arangodb`
- **Description**: 🥑 ArangoDB is a native multi-model database with flexible data models for documents, graphs, and key-values. Build high performance applications using a convenient SQL-like query language or JavaScript extensions.
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 14280 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.circleci/generate_config.py`
```
#!/usr/bin/env python3
"""
Generate CircleCI configuration from test definitions.

This script reads test definition YAML files and generates a complete
CircleCI configuration file with workflows for different architectures
and build configurations.
"""

import sys
import traceback
from dataclasses import replace
from typing import List
import click

from src.config_lib import (
    TestDefinitionFile,
    BuildVariant,
    TestArguments,
)
from src.filters import FilterCriteria
from src.output_generators.base import (
    GeneratorConfig,
    TestExecutionConfig,
    CircleCIConfig,
)
from src.output_generators.circleci import CircleCIGenerator


def parse_driver_branches(driver_branch_overrides: str) -> dict:
    """
    Parse driver-branch-overrides argument into a dictionary.

    Args:
        driver_branch_overrides: Colon-separated list like "main=branch1:driver=branch2"

    Returns:
        Dictionary mapping prefix to branch name

    Raises:
        ValueError: If the format is invalid
    """
    if not driver_branch_overrides:
        return {}

    result = {}
    try:
        for pair in driver_branch_overrides.split(":"):
            if not pair:
                continue
            name, branch = pair.split("=")
            result[name] = branch
    except ValueError as ex:
        raise ValueError(
            f"Invalid --driver-branch-overrides format: '{pair}'. "
            "Expected format: 'name=branch:name2=branch2'"
        ) from ex

    return result


def apply_branch_overrides(
    test_def: TestDefinitionFile, filename: str, branch_overrides: dict
) -> TestDefinitionFile:
    """
    Apply git branch overrides to a test definition.

    The --driver_branch_overrides feature allows overriding git branches for driver tests.
    For example: --driver_branch_overrides go=feature-branch:js=main

    When a test definition filename contains a key from branch_overrides (e.g., "go.yml"
    contains "go"), the corresponding branch overrides the repository's default branch.

    Args:
        test_def: TestDefinitionFile to apply overrides to
        filename: Filename to match against override keys
        branch_overrides: Dictionary mapping filename prefix to branch override

    Returns:
        New TestDefinitionFile with branch overrides applied (immutable)
    """
    if not branch_overrides:
        return test_def

    # Extract base filename from path for matching
    base_filename = filename.split("/")[-1] if "/" in filename else filename

    # Find matching override (only apply first match)
    override_branch = None
    for prefix, branch in branch_overrides.items():
        if prefix in base_filename:
            override_branch = branch
            break

    if not override_branch:
        return test_def  # No matching override

    # Create new jobs dict with branch overrides applied
    updated_jobs = {}
    for job_name, job in test_def.jobs.items():
        if job.repository:
            # Create new job with overridden repository branch
            updated_job = replace(
                job, repository=replace(job.repository, git_branch=override_branch)
            )
            updated_jobs[job_name] = updated_job
        else:
            updated_jobs[job_name] = job

    return TestDefinitionFile(jobs=updated_jobs)


def load_test_definitions(
    definition_files: List[str], test_branches: dict
) -> List[TestDefinitionFile]:
    """
    Load test definition files with optional branch overrides.

    Args:
        definition_files: List of paths to test definition YAML files
        test_branches: Dictionary mapping file prefix to branch override

    Returns:
        List of loaded TestDefinitionFile objects with branch overrides applied
    """
    test_defs = []

    for filepath in definition_files:
        # Add "tests/" prefix if path doesn't contain a directory separator
        if "/" not in filepath:
            filepath = f"tests/{filepath}"

        # Load the test definition file
        test_def = TestDefinitionFile.from_yaml_file(filepath)

        # Apply branch overrides as separate step
        test_def = apply_branch_overrides(test_def, filepath, test_branches)

        test_defs.append(test_def)

    return test_defs


def create_generator_config(
    tsan: bool,
    alubsan: bool,
    no_sanitizer: bool,
    coverage: bool,
    test_image: str,
    arangosh_args: str,
    extra_args: str,
    arangod_without_v8: bool,
    gtest: bool,
    full: bool,
    clang_tidy: bool,
    replication_two: bool,
    create_test_docker_images: str,
    validate_only: bool,
    test_suite: str,
) -> GeneratorConfig:
    """
    Create GeneratorConfig from command line arguments.

    Args:
        All CLI parameters as individual arguments

    Returns:
        GeneratorConfig object
    """
    # Build list of requested build variants
    build_variants = []

    if no_sanitizer or (not tsan and not alubsan and not coverage):
        # Include non-instrumented build if explicitly requested or no variants specified
        build_variants.append(BuildVariant.NORMAL)
    if tsan:
        build_variants.append(BuildVariant.TSAN)
    if alubsan:
        build_variants.append(BuildVariant.ALUBSAN)
    if coverage:
        build_variants.append(BuildVariant.COVERAGE)

    assert build_variants, "build_variants must not be empty (logic error)"

    # Create filter criteria
    filter_criteria = FilterCriteria(
        gtest=gtest,
        full=full,
        clang_tidy=clang_tidy,
        v8=not arangod_without_v8,
        test_suite=test_suite,
    )

    # Create test execution config
    arangosh_args_list = TestArguments.parse_args_string(arangosh_args or "")
    extra_args_list = TestArguments.parse_args_string(
        extra_args or "",
        add_skip_server_js=arangod_without_v8,
    )

    test_execution = TestExecutionConfig(
        arangosh_args=arangosh_args_list,
        extra_args=extra_args_list,
        replication_two=replication_two,
    )

    # Create CircleCI-specific config
    circleci_config = CircleCIConfig(
        create_test_docker_images=create_test_docker_images,
        test_image=test_image,
    )

    return GeneratorConfig(
        filter_criteria=filter_criteria,
        test_execution=test_execution,
        circleci=circleci_config,
        validate_only=validate_only,
        build_variants=build_variants,
    )


@click.command()
@click.argument("base_config", type=click.Path(exists=True))
@click.argument("definitions", nargs=-1, required=False)
@click.option(
    "-o",
    "--output",
    required=True,
    type=click.Path(),
    help="Output filename for generated config",
)
@click.option(
    "--tsan",
    is_flag=True,
    help="Enable Thread Sanitizer (TSAN)",
)
@click.option(
    "--alubsan",
    is_flag=True,
    help="Enable Address+Leak+UndefinedBehavior Sanitizer (ALUBSAN)",
)
@click.option(
    "--no-sanitizer",
    is_flag=True,
    help="Enable non-sanitizer build (can be combined with --tsan/--alubsan/--coverage)",
)
@click.option(
    "--coverage",
    is_flag=True,
    help="Enable coverage build",
)
@click.option(
    "-t",
    "--test-image",
    required=True,
    help="Test image to be used",
)
@click.option(
    "-b",
    "--driver-branch-overrides",
    help="Colon-separated list of driver=branch (e.g., 'go=feature:java=main')",
)
@click.option(
    "--arangosh-args",
    help="Additional arguments to append to arangosh",
)
@click.option(
    "--extra-args",
    help="Additional arguments to append to testing.js",
)
@click.option(
    "--arangod-without-v8",
    is_flag=True,
    help="Run without JavaScript (V8 disabled)",
)
@click.option(
    "--gtest",
    is_flag=True,
    help="Only run gtest tests",
)
@click.option(
    "--full",
    is_flag=True,
    help="Include full test set",
)
@click.option(
    "--clang-tidy",
    is_flag=True,
    help="Schedule the clang-tidy job",
)
@click.option(
    "-rt",
    "--replication-two",
    is_flag=T
```

### Core Architecture Module: `.circleci/generate_nightly_packages_config.py`
```
#!/usr/bin/env python3
"""Generate the nightly-packages continuation config.

Reads base_nightly_packages.yml and removes the workflow jobs disabled by
pipeline parameters, including their entries in other jobs' requires lists,
so a disabled job never occupies an executor (the former in-job
"circleci-agent step halt" skipping kept scheduling a node per skipped job).

Invoked by the generate-nightly-packages-config job in nightly_packages.yml (the
setup config); the boolean pipeline parameters are passed through as
true/false CLI options.

With --pr-run true the workflow is emitted as "nightly-packages-pr" instead
of "nightly-packages": same job graph, but the run is recognizable as a PR
test everywhere the workflow name shows up, and the publish job (which reads
the pr-run pipeline parameter itself) degrades to a dry run.
"""

import argparse
import sys
from typing import Any, Dict, List, Set, Tuple, Union

import yaml

WORKFLOW_NAME = "nightly-packages"
PR_WORKFLOW_NAME = "nightly-packages-pr"
ARCHES = ("amd64", "arm64")
PACKAGE_FORMATS = ("deb", "rpm", "tar")
DOCKER_DISTROS = ("alpine", "deb")

JobEntry = Union[str, Dict[str, Any]]


def parse_bool(value: str) -> bool:
    if value not in ("true", "false"):
        raise argparse.ArgumentTypeError(f"expected 'true' or 'false', got {value!r}")
    return value == "true"


def disabled_jobs(
    deb: bool,
    rpm: bool,
    tar: bool,
    alpine_image: bool,
    deb_image: bool,
    sign: bool,
    scan: bool,
    security: bool,
) -> Set[str]:
    """Workflow job names (workflow-level "name", not job type) to drop."""
    formats = {"deb": deb, "rpm": rpm, "tar": tar}
    drop: Set[str] = set()

    for fmt, enabled in formats.items():
        if not enabled:
            drop.update(f"{fmt}-enterprise-{arch}" for arch in ARCHES)
        if not enabled or not security:
            drop.update(f"security-check-{fmt}-{arch}" for arch in ARCHES)

    # Each distro image has its own build-*-image flag, and every built
    # image gets its own Trivy job.
    distros = {"alpine": alpine_image, "deb": deb_image}
    for distro, enabled in distros.items():
        if not enabled:
            drop.update(f"docker-enterprise-{distro}-{arch}" for arch in ARCHES)
        if not enabled or not security:
            drop.update(
                f"security-check-docker-{distro}-{arch}" for arch in ARCHES
            )

    # scan/sign cover packages only; without any package format they would
    # find nothing to work on.
    any_packages = any(formats.values())
    if not scan or not any_packages:
        drop.add("scan-packages")
    if not sign or not any_packages:
        drop.add("sign-packages")

    return drop


def entry_name(entry: JobEntry) -> str:
    if isinstance(entry, str):
        return entry
    [(job_type, job_config)] = entry.items()
    if job_config and "name" in job_config:
        return job_config["name"]
    return job_type


def dep_name(dep: JobEntry) -> str:
    """Job name of one requires entry: either "job" or, for CircleCI's
    status-qualified requires, {"job": <status or [statuses]>}."""
    if isinstance(dep, str):
        return dep
    [(name, _)] = dep.items()
    return name


def dep_statuses(dep: JobEntry) -> List[str]:
    """Upstream statuses this requires entry accepts. A plain string entry
    means the CircleCI default, success."""
    if isinstance(dep, str):
        return ["success"]
    [(name, statuses)] = dep.items()
    if isinstance(statuses, str):
        statuses = [statuses]
    if not isinstance(statuses, list) or not all(
        isinstance(s, str) for s in statuses
    ):
        raise ValueError(f"requires entry {name!r} has a malformed status list")
    return statuses


def blocks_on(dep: JobEntry) -> bool:
    """Whether this requires entry actually gates the depending job, i.e.
    only a successful upstream lets it run."""
    return dep_statuses(dep) == ["success"]


def workflow_name(pr_run: bool) -> str:
    """PR test runs get their own workflow name so they never look like a
    real nightly-packages run (in the CircleCI UI and in GitHub PR checks)
    and so cancel-redundant-pipelines can tell the two apart."""
    return PR_WORKFLOW_NAME if pr_run else WORKFLOW_NAME


def prune_workflow(
    config: Dict[str, Any], drop: Set[str], name: str = WORKFLOW_NAME
) -> None:
    workflow = config["workflows"][name]
    kept: List[JobEntry] = []
    for entry in workflow["jobs"]:
        if entry_name(entry) in drop:
            continue
        if isinstance(entry, dict):
            [(_, job_config)] = entry.items()
            if job_config and "requires" in job_config:
                job_config["requires"] = [
                    dep for dep in job_config["requires"] if dep_name(dep) not in drop
                ]
                if not job_config["requires"]:
                    del job_config["requires"]
            # publish-nightly verifies one gate verdict per security-check
            # job; the list has to shrink with the jobs, or the publish
            # would fail waiting for verdicts of pruned scans.
            if job_config and "expected-gate-items" in job_config:
                job_config["expected-gate-items"] = " ".join(
                    item
                    for item in job_config["expected-gate-items"].split()
                    if f"security-check-{item}" not in drop
                )
        kept.append(entry)
    workflow["jobs"] = kept


def check_workflow(config: Dict[str, Any], name: str = WORKFLOW_NAME) -> None:
    """The pruned graph must be self-consistent, or the continuation would
    be rejected by CircleCI after the heavy pipeline has already started."""
    workflow = config["workflows"][name]
    names = [entry_name(entry) for entry in workflow["jobs"]]
    duplicates = {name for name in names if names.count(name) > 1}
    if duplicates:
        raise ValueError(f"duplicate workflow job names: {sorted(duplicates)}")
    known = set(names)
    for entry in workflow["jobs"]:
        if not isinstance(entry, dict):
            continue
        [(_, job_config)] = entry.items()
        for dep in (job_config or {}).get("requires", []):
            if dep_name(dep) not in known:
                raise ValueError(
                    f"{entry_name(entry)} requires pruned/unknown job {dep_name(dep)!r}"
                )
    if "publish-nightly" not in known:
        raise ValueError("publish-nightly is missing from the workflow")

    # publish-nightly must gate on every artifact-producing job that is
    # still in the workflow — DIRECTLY, not only transitively through the
    # scan/sign/security jobs, which can all be disabled. Without this,
    # a gates-all-off run would let publish race the packaging jobs.
    artifact_prefixes = (
        "deb-enterprise",
        "rpm-enterprise",
        "tar-enterprise",
        "docker-enterprise",
    )
    publish_requires: Dict[str, JobEntry] = {}
    publish_config: Dict[str, Any] = {}
    for entry in workflow["jobs"]:
        if entry_name(entry) == "publish-nightly" and isinstance(entry, dict):
            [(_, job_config)] = entry.items()
            publish_config = job_config or {}
            publish_requires = {
                dep_name(dep): dep for dep in publish_config.get("requires", [])
            }
    missing = sorted(
        name
        for name in known
        if name.startswith(artifact_prefixes) and name not in publish_requires
    )
    if missing:
        raise ValueError(
            "publish-nightly must directly require every artifact-producing "
            f"job in the workflow; missing: {missing}"
        )

    # The security-check jobs failing (on findings, recorded after their
    # reports are delivered) are the only failures the publish tolerates:
    # a finding must alert without stopping a pre-release nightly.
    # Anything else tolerated anywhere in the graph would let a job run
    # on missing artifacts or missing rep
```

### Core Architecture Module: `.circleci/src/__init__.py`
```
"""
ArangoDB test configuration library.

Shared data models and utilities for test definitions used by CircleCI and Jenkins.
"""

from .config_lib import (
    DeploymentType,
    ResourceSize,
    TestOptions,
    TestArguments,
    SuiteConfig,
    RepositoryConfig,
    TestJob,
    TestDefinitionFile,
    BuildConfig,
)

__all__ = [
    "DeploymentType",
    "ResourceSize",
    "TestOptions",
    "TestArguments",
    "SuiteConfig",
    "RepositoryConfig",
    "TestJob",
    "TestDefinitionFile",
    "BuildConfig",
]

```

### Core Architecture Module: `.circleci/src/config_lib.py`
```
"""
Shared library for parsing and processing ArangoDB test configuration files.

This module provides type-safe data models and utilities for working with YAML
test definition files used by both CircleCI and Jenkins test systems.

Architecture:
- Data models defined as dataclasses with validation
- Parsing functions to convert YAML dicts to typed objects
- Validation logic in __post_init__ methods
- Merging logic for option inheritance
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Any, Union, TypeVar, Mapping
import yaml

# ============================================================================
# Enumerations
# ============================================================================

E = TypeVar("E", bound=Enum)


def _enum_from_string(
    enum_class: type[E], value: str, aliases: Optional[Mapping[str, E]] = None
) -> E:
    """
    Generic helper to parse enum from string, case-insensitive.

    Args:
        enum_class: The enum class to parse into
        value: String value to parse
        aliases: Optional dict mapping alias strings to enum values

    Returns:
        Enum member

    Raises:
        ValueError: If value doesn't match any enum member or alias
    """
    normalized = value.lower()

    # Check aliases first if provided
    if aliases and normalized in aliases:
        return aliases[normalized]

    # Check enum members
    for member in enum_class:
        if member.value == normalized:
            return member

    # Build error message
    valid_values = [m.value for m in enum_class]
    if aliases:
        valid_values.extend(f"{alias} (alias)" for alias in aliases.keys())

    raise ValueError(
        f"Invalid {enum_class.__name__}: {value}. Valid options: {', '.join(valid_values)}"
    )


class DeploymentType(Enum):
    """Test deployment type: single server, cluster, or mixed."""

    SINGLE = "single"
    CLUSTER = "cluster"
    MIXED = "mixed"

    @classmethod
    def from_string(cls, value: str) -> "DeploymentType":
        """Parse deployment type from string, case-insensitive."""
        return _enum_from_string(cls, value)


class ResourceSize(Enum):
    """Resource allocation size for test execution."""

    SMALL = "small"
    MEDIUM = "medium"
    MEDIUM_PLUS = "medium+"
    LARGE = "large"
    CIRCLECI_LARGE = "circleci-large"
    XLARGE = "xlarge"
    XXLARGE = "2xlarge"

    @classmethod
    def from_string(cls, value: str) -> "ResourceSize":
        """Parse resource size from string, case-insensitive."""
        return _enum_from_string(cls, value)


class BuildVariant(Enum):
    """
    Build instrumentation variant.

    Represents different types of build instrumentation that can be enabled.
    """

    NORMAL = "normal"  # Non-instrumented build
    TSAN = "tsan"  # Thread Sanitizer
    ALUBSAN = "alubsan"  # Address + Leak + UB Sanitizer
    COVERAGE = "coverage"  # Coverage build

    @classmethod
    def from_string(cls, value: str) -> "BuildVariant":
        """Parse build variant from string, case-insensitive."""
        return _enum_from_string(cls, value)

    def get_suffix(self) -> str:
        """Get workflow name suffix for this variant."""
        if self == BuildVariant.NORMAL:
            return ""
        return f"-{self.value}"

    @property
    def is_instrumented(self) -> bool:
        """Check if this is an instrumented build (TSAN, ALUBSAN, or COVERAGE)."""
        return self in (BuildVariant.TSAN, BuildVariant.ALUBSAN, BuildVariant.COVERAGE)

    @property
    def is_tsan(self) -> bool:
        """Check if this is a Thread Sanitizer build."""
        return self == BuildVariant.TSAN

    @property
    def is_alubsan(self) -> bool:
        """Check if this is an Address+Leak+UB Sanitizer build."""
        return self == BuildVariant.ALUBSAN

    @property
    def is_coverage(self) -> bool:
        """Check if this is a coverage build."""
        return self == BuildVariant.COVERAGE


class Architecture(Enum):
    """
    CPU architecture for builds.

    X64 = x86-64 / AMD64 architecture
    AARCH64 = ARM64 architecture
    """

    X64 = "x64"
    AARCH64 = "aarch64"

    @classmethod
    def from_string(cls, value: str) -> "Architecture":
        """Parse architecture from string, supporting common aliases."""
        aliases = {
            "x86_64": cls.X64,
            "amd64": cls.X64,
            "arm64": cls.AARCH64,
        }
        return _enum_from_string(cls, value, aliases)


# ============================================================================
# Data Models
# ============================================================================


@dataclass
class TestRequirements:
    """
    Requirements that determine when a test job should be included.

    These are filtering criteria checked against the build context.
    All fields are optional to support partial specifications.
    """

    full: Optional[bool] = None  # Only run if full test set is enabled
    instrumentation: Optional[bool] = (
        None  # Include/exclude for instrumented builds (TSAN/ALUBSAN/COVERAGE)
    )
    coverage: Optional[bool] = None  # Include/exclude for coverage builds only
    v8: Optional[bool] = None  # Include/exclude for v8 builds
    architecture: Optional[Architecture] = None  # Allowed architecture (None = all)

    @classmethod
    def from_dict(cls, data: Optional[Dict[str, Any]]) -> "TestRequirements":
        """
        Create TestRequirements from a dictionary.

        Args:
            data: Dictionary from YAML 'requires' section, or None

        Returns:
            TestRequirements instance with all None fields if data is None
        """
        if data is None:
            return cls()

        kwargs: Dict[str, Any] = {}

        # Direct field mappings
        if "full" in data:
            kwargs["full"] = data["full"]
        if "instrumentation" in data:
            kwargs["instrumentation"] = data["instrumentation"]
        if "coverage" in data:
            kwargs["coverage"] = data["coverage"]
        if "v8" in data:
            kwargs["v8"] = data["v8"]

        # Handle arch field
        if "arch" in data and data["arch"] is not None:
            kwargs["architecture"] = Architecture.from_string(data["arch"])

        return cls(**kwargs)

    def merge_with(self, override: Optional["TestRequirements"]) -> "TestRequirements":
        """
        Create a new TestRequirements with values from override taking precedence.

        Args:
            override: TestRequirements that should override self's values

        Returns:
            New TestRequirements with merged values
        """
        if override is None:
            return TestRequirements(
                full=self.full,
                instrumentation=self.instrumentation,
                coverage=self.coverage,
                v8=self.v8,
                architecture=self.architecture,
            )

        def merge_field(override_val, self_val):
            return override_val if override_val is not None else self_val

        return TestRequirements(
            full=merge_field(override.full, self.full),
            instrumentation=merge_field(override.instrumentation, self.instrumentation),
            coverage=merge_field(override.coverage, self.coverage),
            v8=merge_field(override.v8, self.v8),
            architecture=merge_field(override.architecture, self.architecture),
        )


@dataclass
class TestOptions:
    """
    Test execution configuration options at job or suite level.

    Suite-level options override job-level options. All fields are optional
    to support partial overrides.
    """

    deployment_type: Optional[DeploymentType] = None
    size: Optional[ResourceSize] = None
    priority: Optional[int] = None
    parallelity: Optional[int] = None
    buckets: Optional[Union[int, str]] = None  # int or "auto"
    replication_version: Optional[str] = None
    suf
```

### Core Architecture Module: `.circleci/src/filters.py`
```
"""
Filtering logic for test jobs based on environment and CLI arguments.

This module provides functions to filter test jobs based on various criteria
such as full runs, test types, platform exclusions, etc.
"""

from typing import List, Optional
from dataclasses import dataclass
from .config_lib import (
    TestJob,
    TestDefinitionFile,
    DeploymentType,
    SuiteConfig,
    Architecture,
    TestRequirements,
    BuildVariant,
)


# Prefix for gtest suite names
GTEST_PREFIX = "gtest"


@dataclass
class FilterCriteria:
    """Criteria for filtering test jobs."""

    # Test type filters
    full: bool = False  # Include full test set (not just PR subset)
    gtest: bool = False
    clang_tidy: bool = False  # Schedule the clang-tidy job

    # Build configuration
    architecture: Optional[Architecture] = None  # Current build architecture
    v8: bool = True  # Whether V8 (JavaScript) is enabled in this build
    build_variant: Optional[BuildVariant] = None  # Build variant (for instrumentation)

    # Deployment type filter (None = accept all deployment types)
    deployment_type: Optional[DeploymentType] = None

    # Feature flags
    enterprise: bool = True

    # filter for testsuites if commanded
    test_suite: str = ""

    @property
    def is_full_run(self) -> bool:
        """Check if this is a full run."""
        return self.full

    @property
    def is_instrumented_build(self) -> bool:
        """Check if this is an instrumented build (TSAN/ALUBSAN/COVERAGE)."""
        return self.build_variant is not None and self.build_variant.is_instrumented

    @property
    def is_v8_build(self) -> bool:
        """Check if this is a V8-enabled build."""
        return self.v8


def is_gtest_suite(suite: SuiteConfig) -> bool:
    """
    Check if a suite is a gtest suite.

    Args:
        suite: Suite configuration to check

    Returns:
        True if suite name starts with 'gtest'
    """
    return suite.name.startswith(GTEST_PREFIX)


def _check_requirements_match(requires: TestRequirements, criteria: FilterCriteria
) -> bool:
    """
    Check if test requirements match filter criteria.

    This implements the common filtering logic for both jobs and suites:
    - Architecture compatibility
    - Full flag compatibility
    - Instrumentation flag compatibility (TSAN/ALUBSAN/COVERAGE)
    - Coverage flag compatibility (COVERAGE only)
    - V8 flag compatibility

    Args:
        requires: TestRequirements to check
        criteria: FilterCriteria to apply

    Returns:
        True if requirements match criteria, False otherwise
    """
    # Check architecture compatibility FIRST
    # If test specifies architecture, current architecture must match
    if requires.architecture is not None and criteria.architecture is not None:
        if criteria.architecture != requires.architecture:
            return False

    # Check full flag compatibility with build type
    # - full=True: Only for full runs
    # - full=False: Only for PR builds
    # - full=None (unspecified): Include in both
    if requires.full is True and not criteria.is_full_run:
        return False  # Requires full run, but we're in PR mode
    if requires.full is False and criteria.is_full_run:
        return False  # PR-only, but we're in full mode

    # Check coverage flag compatibility (specific to COVERAGE builds)
    # - coverage=True: Only for coverage builds
    # - coverage=False: Only for non-coverage builds
    # - coverage=None (unspecified): Include in both
    if requires.coverage is True and (
        criteria.build_variant is None or not criteria.build_variant.is_coverage
    ):
        return False  # Requires coverage build, but we're not in coverage mode
    if requires.coverage is False and (
        criteria.build_variant is not None and criteria.build_variant.is_coverage
    ):
        return False  # Non-coverage-only, but we're in coverage mode

    # Check instrumentation flag compatibility
    # - instrumentation=True: Only for instrumented builds (TSAN/ALUBSAN/COVERAGE)
    # - instrumentation=False: Only for non-instrumented builds
    # - instrumentation=None (unspecified): Include in both
    if requires.instrumentation is True and not criteria.is_instrumented_build:
        return False  # Requires instrumented build, but we're in regular mode
    if requires.instrumentation is False and criteria.is_instrumented_build:
        return False  # Regular-build-only, but we're in instrumented mode

    # Check v8 flag compatibility
    # - v8=True: Only for V8-enabled builds
    # - v8=False: Only for non-V8 builds (JavaScript disabled)
    # - v8=None (unspecified): Include in both
    if requires.v8 is True and not criteria.is_v8_build:
        return False  # Requires V8 build, but we're in non-V8 mode
    if requires.v8 is False and criteria.is_v8_build:
        return False  # Non-V8-only, but we're in V8 mode

    return True


def should_include_job(job: TestJob, criteria: FilterCriteria) -> bool:
    """
    Determine if a job should be included based on filter criteria.

    Args:
        job: TestJob to check
        criteria: FilterCriteria to apply

    Returns:
        True if job should be included, False otherwise
    """
    # Check common requirements (architecture, full, instrumentation)
    if not _check_requirements_match(job.requires, criteria):
        return False

    # if we should filter for a name:
    if (criteria.test_suite is not None and
        criteria.test_suite != "" and
        criteria.test_suite not in job.name):
        return False

    # Check deployment type filter
    if criteria.deployment_type is not None:
        job_deployment = job.options.deployment_type

        # If job has no deployment type specified, it runs in all modes
        if job_deployment is None:
            pass  # Include job
        # If job specifies MIXED, it should be included in both single and cluster filters
        elif job_deployment == DeploymentType.MIXED:
            pass  # Include job
        # Otherwise, deployment types must match
        elif job_deployment != criteria.deployment_type:
            return False

    # Check gtest filter
    if criteria.gtest and not any(is_gtest_suite(suite) for suite in job.suites):
        return False

    # Platform exclusions would be checked at suite level in the original code
    # For now, we accept all jobs at the job level
    # Suite-level filtering would happen during job execution

    return True


def should_include_suite(suite: SuiteConfig, criteria: FilterCriteria) -> bool:
    """
    Determine if a suite should be included based on filter criteria.

    This applies suite-level filtering that may override job-level settings.

    Args:
        suite: SuiteConfig to check
        criteria: FilterCriteria to apply

    Returns:
        True if suite should be included, False otherwise
    """
    # Check common requirements (architecture, full, instrumentation)
    return _check_requirements_match(suite.requires, criteria)


def filter_suites(job: TestJob, criteria: FilterCriteria) -> List[SuiteConfig]:
    """
    Filter suites from a job based on criteria.

    This uses job.get_resolved_suites() to ensure job-level requirements
    (like full, instrumentation, etc.) are properly inherited by suites
    that don't have their own requirements specified.

    Args:
        job: TestJob containing suites to filter
        criteria: FilterCriteria to apply

    Returns:
        Filtered list of SuiteConfig objects with job-level options merged
    """
    return [
        suite
        for suite in job.get_resolved_suites()
        if should_include_suite(suite, criteria)
    ]


def filter_jobs(
    test_def: TestDefinitionFile, criteria: FilterCriteria
) -> List[TestJob]:
    """
    Filter jobs from a test definition file based on criteria.

    Args:
        test_def: TestDefinitionFile containing jobs to filter
        criteria: FilterCriteria to app
```

### Core Architecture Module: `.circleci/src/output_generators/__init__.py`
```
"""Output generators for test configuration."""

from .base import OutputGenerator

__all__ = ["OutputGenerator"]

```

### Core Architecture Module: `.circleci/src/output_generators/base.py`
```
"""
Base class for output generators.

Output generators take parsed test definitions and build-specific configuration,
then produce output in a specific format (CircleCI YAML, Jenkins launcher format, etc.).
"""

from abc import ABC, abstractmethod
from typing import Any, List
from dataclasses import dataclass, field

from ..config_lib import TestJob, TestDefinitionFile, BuildVariant
from ..filters import FilterCriteria, filter_jobs


@dataclass
class TestExecutionConfig:
    """Configuration for test execution."""

    arangosh_args: List[str] = field(default_factory=list)
    extra_args: List[str] = field(default_factory=list)
    replication_two: bool = False


@dataclass
class CircleCIConfig:
    """CircleCI-specific configuration."""

    # Test Docker image to build and publish: "none", "alpine" or "deb"
    create_test_docker_images: str = "none"
    test_image: str = ""


@dataclass
class GeneratorConfig:
    """
    Configuration for output generators.

    This consolidates all configuration that generators need, organized
    by concern.
    """

    filter_criteria: FilterCriteria
    test_execution: TestExecutionConfig = field(default_factory=TestExecutionConfig)
    circleci: CircleCIConfig = field(default_factory=CircleCIConfig)
    validate_only: bool = False
    build_variants: List[BuildVariant] = field(default_factory=list)


class OutputGenerator(ABC):
    """
    Abstract base class for output generators.

    Subclasses implement specific output formats (CircleCI, Jenkins, etc.)
    """

    def __init__(self, config: GeneratorConfig):
        """
        Initialize the generator with configuration.

        Args:
            config: Generator configuration
        """
        self.config = config

    @abstractmethod
    def generate(self, test_defs: List[TestDefinitionFile], **kwargs) -> Any:
        """
        Generate output from test definitions.

        Args:
            test_defs: List of TestDefinitionFile objects to process
            **kwargs: Additional generator-specific arguments

        Returns:
            Generated output in the appropriate format
        """

    @abstractmethod
    def write_output(self, output: Any, destination: str) -> None:
        """
        Write generated output to a file or stdout.

        Args:
            output: Output from generate()
            destination: Where to write (filename or special value like '-' for stdout)
        """

    def filter_jobs(self, test_def: TestDefinitionFile) -> List[TestJob]:
        """
        Apply filtering to jobs based on configuration.

        This is a convenience method that subclasses can override or use.

        Args:
            test_def: Test definition file

        Returns:
            Filtered list of jobs
        """
        return filter_jobs(test_def, self.config.filter_criteria)

```

### Core Architecture Module: `.circleci/src/output_generators/circleci.py`
```
"""
CircleCI configuration generator.

Generates CircleCI workflow YAML from test definitions and build configuration.
"""

import json
import os
from typing import List, Dict, Any, Optional, Callable
from datetime import date
import yaml

from ..config_lib import (
    TestJob,
    TestDefinitionFile,
    BuildConfig,
    BuildVariant,
    DeploymentType,
    ResourceSize,
    Architecture,
    SuiteConfig,
)
from ..filters import filter_suites
from .base import OutputGenerator, GeneratorConfig
from .sizing import ResourceSizer


class CircleCIGenerator(OutputGenerator):
    """Generate CircleCI workflow configuration from test definitions."""

    # ========================================================================
    # Special Case Overrides
    #
    # These jobs require CircleCI-specific overrides that differ from their
    # YAML definitions or need runtime-dependent adjustments.
    # ========================================================================

    # Job-specific size overrides (applied conditionally)
    # shell_client_aql: Nightly single-server runs need more memory due to
    # extended test coverage and data volume
    def _get_size_override(
        self, job_name: str, build_config: BuildConfig, is_cluster: bool
    ) -> Optional[ResourceSize]:
        """Get size override for specific jobs based on runtime conditions."""
        if job_name == "shell_client_aql" and build_config.nightly and not is_cluster:
            return ResourceSize.MEDIUM_PLUS
        return None

    # ========================================================================

    def __init__(
        self,
        config: GeneratorConfig,
        base_config_path: Optional[str] = None,
        base_config: Optional[Dict[str, Any]] = None,
        env_getter: Optional[Callable[[str, str], str]] = None,
        date_provider: Optional[Callable[[], date]] = None,
    ):
        """
        Initialize CircleCI generator.

        Args:
            config: Generator configuration
            base_config_path: Path to base CircleCI config YAML (optional if base_config provided)
            base_config: Pre-loaded base config dict (for testing)
            env_getter: Function to get environment variables (defaults to os.environ.get)
            date_provider: Function to get current date (defaults to date.today)
        """
        super().__init__(config)
        self.base_config_path = base_config_path
        self._base_config = base_config
        self.env_getter = env_getter or os.environ.get
        self.date_provider = date_provider or date.today
        self.sizer = ResourceSizer()

    def generate(self, test_defs: List[TestDefinitionFile], **kwargs) -> Dict[str, Any]:
        """
        Generate CircleCI configuration.

        Args:
            test_defs: List of test definition files
            **kwargs: Additional arguments (unused)

        Returns:
            Complete CircleCI configuration dict
        """
        # Load or use base configuration
        if self._base_config is not None:
            circleci_config = self._base_config.copy()
        elif self.base_config_path:
            with open(self.base_config_path, "r", encoding="utf-8") as f:
                circleci_config = yaml.safe_load(f)
        else:
            raise ValueError("Either base_config or base_config_path must be provided")

        # Collect all jobs from all test definition files (no architecture filtering yet)
        all_jobs: List[TestJob] = []
        for test_def in test_defs:
            all_jobs.extend(test_def.jobs.values())

        # Generate workflows for different build configurations
        if "workflows" not in circleci_config:
            circleci_config["workflows"] = {}

        # Generate workflows for each build variant and architecture
        build_variants = self.config.build_variants
        architectures = [Architecture.X64, Architecture.AARCH64]

        for build_variant in build_variants:
            for architecture in architectures:
                build_config = BuildConfig(
                    architecture=architecture,
                    build_variant=build_variant,
                    nightly=self.config.filter_criteria.is_full_run,
                )
                self._add_workflow(circleci_config["workflows"], all_jobs, build_config)

        if self.config.circleci.create_test_docker_images != "none":
            self._add_docker_images_workflow(circleci_config["workflows"])

        return circleci_config

    def write_output(self, output: Dict[str, Any], destination: str) -> None:
        """
        Write CircleCI configuration to file.

        Args:
            output: Generated config dict
            destination: Output file path
        """
        with open(destination, "w", encoding="utf-8") as f:
            yaml.dump(output, f)

    def _add_workflow(
        self, workflows: Dict[str, Any], jobs: List[TestJob], build_config: BuildConfig
    ) -> None:
        """
        Add a workflow for a specific build configuration.

        Args:
            workflows: Workflows dict to add to
            jobs: List of test jobs
            build_config: Build configuration
        """
        workflow_name = self._generate_workflow_name(build_config)
        workflow: Dict[str, Any] = {"jobs": []}
        workflows[workflow_name] = workflow

        # Add build jobs
        build_jobs = self._add_build_jobs(workflow, build_config)

        # Add optional jobs
        self._add_optional_jobs(workflow, build_config, build_jobs)

        # Add test jobs
        self._add_test_jobs(workflow, jobs, build_config, build_jobs)

    def _generate_workflow_name(self, build_config: BuildConfig) -> str:
        """Generate workflow name from build configuration."""
        suffix = "nightly" if build_config.nightly else "pr"

        suffix += build_config.build_variant.get_suffix()

        if self.config.test_execution.replication_two:
            suffix += "-repl2"

        return f"{build_config.architecture.value}-{suffix}"

    def _add_build_jobs(
        self, workflow: Dict[str, Any], build_config: BuildConfig
    ) -> List[str]:
        """
        Add compilation and frontend build jobs.

        Returns:
            List of build job names that tests depend on
        """
        build_job = self._create_build_job(build_config)
        frontend_job = self._create_frontend_build_job(build_config)

        workflow["jobs"].append(build_job)
        workflow["jobs"].append(frontend_job)

        # Add non-maintainer smoke build (non-instrumented builds only)
        if not build_config.build_variant.is_instrumented:
            non_maintainer_job = self._create_non_maintainer_build_job(build_config)
            workflow["jobs"].append(non_maintainer_job)

        # Extract job names from the dicts
        build_job_name = build_job["compile-linux"]["name"]
        frontend_job_name = frontend_job["build-frontend"]["name"]

        return [build_job_name, frontend_job_name]

    def _create_build_job(self, build_config: BuildConfig) -> Dict[str, Any]:
        """Create compilation job definition."""
        preset = "pr"

        if build_config.architecture == Architecture.AARCH64:
            preset += "-arm64"
        else:
            preset += "-x64"

        preset += build_config.build_variant.get_suffix()

        # Coverage has plain pr-*-coverage presets but no -no-v8 combos
        # (coverage is a rare, CLI-only variant); when combined with
        # arangod-without-v8 it keeps the coverage preset and gets USE_V8
        # forced off via the Configure step's command-line override.
        if (
            not self.config.filter_criteria.v8
            and not build_config.build_variant.is_coverage
        ):
            preset += "-no-v8"

        suffix = build_config.build_variant.get_suffix()
        name = f"build-{build_config.architecture.value}{suffix}"

        params = {
            "contex
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #23388** (2026-09-30): **[COR-745] MATCH overlapping path merge**
  *Symptoms*: ProjectionBuilder already handles prefix-overlapping paths by retaining the shorter path and dropping the longer one. For example, KEEP profile, profile.name keeps only profile the child path is not merged into the parent object.  As part of this ticket I added unit test cases in ProjectionBuilderTest.cpp to cover this behavior:  - profile + profile.name → keeps only profile  - a.b + a.b.c.d → keeps only a.b  - Quoted "profile.name" is not treated as a child path of profile

- **Issue #23379** (2026-09-29): **[BTS-2461] Backport to 3.12.12: do not exit early in insertDistributeInputCalculation**
  *Symptoms*: Backport of #23328 to `3.12.12`, requested for a 3.12.12.x patch release.  BTS-2461 / ES-3043: on a disjoint SmartGraph, one of two sibling subqueries with chained traversals silently returns an empty result. Reported on 3.12.9, reproduced on 3.12.11, still present in the released 3.12.12 because #23328 merged one day after the 3.12.12 tag.  Commits: * Cherry-pick of 0506da59614 (`Do not exit early, but continue with other distrbute nodes. (#23328)`), applied cleanly. `insertDistributeInputCalculation` returned out of the whole loop when one DistributeNode needed no key-generation calculation, so every later DistributeNode was left without its input calculation. * CHANGELOG entry under a new `3.12.12.1` section. #23328 never got one, so this is also the first written record of the fix.  Enterprise counterpart: https://github.com/arangodb/enterprise/pull/1716 (same branch name).

- **Issue #23378** (2026-09-29): **AQL queries with sparse MDI indexes accept non-comparison filter conditions**
  *Symptoms*: ## Summary  On a collection with a sparse `mdi` or `mdi-prefixed` index, a query whose `FILTER` contains a condition that is not a comparison, such as `IS_STRING(d.t1)` or `NOT d.t1`, failed with `member out of range`, even if it did not reference the indexed fields. These queries now run normally.  Fixes #23356  ## Root cause  For sparse indexes, `mdi::extractBoundsFromCondition` first calls `canUseConditionPart()` on every conjunct of the condition to find attributes that cannot be null. It read `getMember(0)` and `getMember(1)` of each conjunct without checking the node type. Function calls and unary operators have only one member, so `getMember(1)` threw.  ## Fix  The pre-pass skips conjuncts that are not comparison operators (`isComparisonOperator()`). Those are the only nodes `canUseConditionPart()` handles, so the index-usable conditions are the same as before. 

- **Issue #23377** (2026-09-29): **AQL REGEX_MATCHES evaluates the regex for empty input strings**
  *Symptoms*: ### Summary  `REGEX_MATCHES()` matches an empty input string like any other string. A pattern that can match the empty string, such as `^$`, returns `[""]`, and one that can't, such as `^[a-z0-9_-]{3,16}$`, returns `null`. Before, it returned `[""]` for every empty input with a non-empty pattern.  Fixes #23362  ### Root cause  `RegexMatches` in `arangod/Aql/Function/RegexFunctions.cpp` returned `[""]` early for an empty input with a non-empty pattern, without running the matcher. That shortcut belongs to `REGEX_SPLIT`, where splitting an empty string gives `[""]`, but it's wrong for matching.  ### Fix  Remove the shortcut and the `isEmptyExpression` flag it used. An empty input goes through `RegexMatcher::find()` like any other string. New cases in `testToRegexMatchesValues` cover empty input with matching and non-matching patterns. 

- **Issue #23376** (2026-09-29): **AQL REVERSE keeps characters above U+FFFF intact**
  *Symptoms*: ### Summary  AQL `REVERSE` on a string broke every character above U+FFFF (emoji, for example) into two U+FFFD replacement characters, and it silently dropped the part of the string before a U+FFFF. `REVERSE` now reverses strings by code point, so those characters stay whole and the whole string gets reversed.  Fixes #23360.  ### Root cause  `functions::Reverse` in `arangod/Aql/Function/MiscFunctions.cpp` walked the ICU `UnicodeString` backwards with `StringCharacterIterator::previous()`, which returns one UTF-16 code unit at a time. A character above U+FFFF is a surrogate pair, so it came out as two lone surrogates in swapped order, and `toUTF8String` replaced each of them with U+FFFD. The loop also ended as soon as a code unit equalled `CharacterIterator::DONE` (0xFFFF), so a U+FFFF in the input cut the reversal short.  ### Fix  The code-unit loop is replaced with `UnicodeString::reverse()`. ICU reverses the code units and then swaps each surrogate pair back into order, and it doesn't depend on a sentinel value. The now-unused `<unicode/schriter.h>` include is removed.  `REVERSE` still works on code points, not grapheme clusters. Combining marks and multi-code-point emoji (ZWJ sequences, flags) still come out in reversed order. Changing that would change the function's semantics, so this PR leaves it alone. 

- **Issue #23366** (2026-09-29): **Fix use-after-free in jwt-token renewal**
  *Symptoms*: `getBodyVelocyPack()` returns a temporary, so we have to keep it alive by assigning it to a variable.

- **Issue #23364** (2026-09-29): **Get rid of race in rest dump handler failure point**
  *Symptoms*: The RestDumpHandler::fetch-delay failure point goes into an infinite loop on the first fetch-call, such that the created activity can be read in the test. A second fetch-call is supposed to stop the infinite loop. But in the test it happend that the failure point was cleared before the second fetch-call was executed - resulting in an ongoing infinite loop. Seen [here](https://app.circleci.com/pipelines/github/arangodb/arangodb/57523/workflows/140f1a64-3de5-4c56-85b3-d215c441ca3a/jobs/4747940).   This PR gets of the race both in the RestDumpHandler and in the test: - RestDumpHandler: the infinite loop is stopped when the failure point does not exist any more - test: we first wait for the fetch jobs to finish before clearing the failure point  Either one of the two fixes would fix the failing test.

- **Issue #23362** (2026-09-29): **`REGEX_MATCHES` reports a match for an empty string that cannot match**
  *Symptoms*: `REGEX_MATCHES` returns the empty string as a match for an anchored pattern that requires at least three characters. The same pattern returns `null` for a one-character nonmatch and returns the expected match for `"abc"`.  ## Reproduction  ```aql RETURN [   REGEX_MATCHES("", "^[a-z0-9_-]{3,16}$", false),   REGEX_MATCHES("a", "^[a-z0-9_-]{3,16}$", false),   REGEX_MATCHES("abc", "^[a-z0-9_-]{3,16}$", false) ] ```  ## Expected  The first two inputs do not match; the third does. Consistent with the documented nonmatching example, no match should be represented as `null`:  ```json [null, null, ["abc"]] ```  ## Actual  ```json [[""], null, ["abc"]] ``` 

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

### Incident Patch 1: `77b99fe2` (2026-09-30)
**Commit Message**: Fix changelog

**File**: `CHANGELOG` (modified, +5/-5)
```diff
@@ -1,5 +1,10 @@
 3.12.13 (XXXX-XX-XX)
 --------------------
+* COR-1012 The client tools started with `--server.username`/`--server.password`
+  now obtain a JWT via `POST /_open/auth` like arangosh and renew it before
+  it expires, which also makes them work against servers in RBAC mode; they
+  fall back to HTTP basic authentication if the server issues no token.
+
 * COR-1018: Cap vector index search result buffers at the collection's
   document count and track their memory against the query memory limit.
 
@@ -68,11 +73,6 @@
   Fix remote SmartGraph edge modifications so returnNew/returnOld response data
   is not persisted in the _to shadow collection.
 
-* COR-1012 The client tools started with `--server.username`/`--server.password`
-  now obtain a JWT via `POST /_open/auth` like arangosh and renew it before
-  it expires, which also makes them work against servers in RBAC mode; they
-  fall back to HTTP basic authentication if the server issues no token.
-
 * arangodump, arangorestore and arangobackup now report the server's error (e.g.
   "HTTP 401 (Unauthorized): ArangoError 11: User not authenticated") together
   with the "Could not connect to endpoint" message when the initial connection
```

---

### Incident Patch 2: `e5c00eb2` (2026-09-29)
**Commit Message**: Merge pull request #23353 from arangodb/bug-fix/substitute-on-empty-replacement

Fix `SUBSTITUTE` when using empty replacement

**File**: `CHANGELOG` (modified, +4/-0)
```diff
@@ -16,6 +16,10 @@
 
 * Updated ArangoDB Starter to v0.19.28.
 
+* Fix AQL SUBSTITUTE() with an empty search string. It previously returned
+  null with a warning; it now matches at every character position, e.g.
+  SUBSTITUTE('abc', '', '_') returns '_a_b_c_'.
+
 * COR-994: arangodump, arangorestore and arangosh now renew a JWT passed via
   `--server.jwt-token` before it expires, using `POST /_open/auth/renew`
   and controlled by `--server.jwt-renewal-threshold`. Long-running dumps
```

**File**: `arangod/Aql/Function/StringFunctions.cpp` (modified, +55/-98)
```diff
@@ -52,6 +52,7 @@
 #include <unicode/uchar.h>
 #include <unicode/unistr.h>
 
+#include <algorithm>
 #include <cstdint>
 #include <cstring>
 #include <string_view>
@@ -772,21 +773,21 @@ AqlValue functions::Substitute(ExpressionContext* expressionContext,
   velocypack::StringSink adapter(buffer.get());
 
   appendAsString(vopts, adapter, value);
-  if (buffer->empty()) {
-    // ICU's StringSearch rejects an empty text with U_ILLEGAL_ARGUMENT_ERROR
-    return AqlValue(*buffer);
-  }
   icu_64_64::UnicodeString unicodeStr(buffer->data(),
                                       static_cast<int32_t>(buffer->length()));
 
   auto& server = trx->vocbase().server();
   auto locale = server.getFeature<LanguageFeature>().getLocale();
-  // we can't copy the search instances, thus use pointers:
+  // we can't copy the search instances, thus use pointers.
+  // ICU's StringSearch rejects empty patterns and texts
   std::vector<std::unique_ptr<icu_64_64::StringSearch>> searchVec;
   searchVec.reserve(matchPatterns.size());
   UErrorCode status = U_ZERO_ERROR;
   for (auto const& searchStr : matchPatterns) {
-    // create a vector of string searches
+    if (searchStr.isEmpty() || unicodeStr.isEmpty()) {
+      searchVec.push_back(nullptr);
+      continue;
+    }
     searchVec.push_back(std::make_unique<icu_64_64::StringSearch>(
         searchStr, unicodeStr, locale, nullptr, status));
     if (U_FAILURE(status)) {
@@ -795,118 +796,74 @@ AqlValue functions::Substitute(ExpressionContext* expressionContext,
     }
   }
 
-  std::vector<std::pair<int32_t, int32_t>> srchResultPtrs;
+  // pair of the position and length of the found match
+  using Match = std::pair<int32_t, int32_t>;
+  auto const fromSearch = [&](size_t which, int32_t pos) -> Match {
+    if (pos == USEARCH_DONE) {
+      return {pos, 0};
+    }
+    return {pos, searchVec[which]->getMatchedLength()};
+  };
+  auto const firstMatch = [&](size_t which) -> Match {
+    if (searchVec[which] == nullptr) {
+      return {matchPatterns[which].isEmpty() ? 0 : USEARCH_DONE, 0};
+    }
+    return fromSearch(which, searchVec[which]->first(status));
+  };
+  auto const nextMatch = [&](size_t which, int32_t pos) -> Match {
+    if (searchVec[which] == nullptr) {
+      return {pos < unicodeStr.length() ? unicodeStr.moveIndex32(pos, 1)
+                                        : USEARCH_DONE,
+              0};
+    }
+    return fromSearch(which, searchVec[which]->next(status));
+  };
+
+  std::vector<Match> srchResultPtrs;
   std::string utf8;
   srchResultPtrs.reserve(matchPatterns.size());
-  for (auto& search : searchVec) {
+  for (size_t i = 0; i < matchPatterns.size(); ++i) {
     // We now find the first hit for each search string.
-    auto pos = search->first(status);
+    srchResultPtrs.push_back(firstMatch(i));
     if (U_FAILURE(status)) {
       registerICUWarning(expressionContext, AFN, status);
       return AqlValue(AqlValueHintNull());
     }
-
-    int32_t len = 0;
-    if (pos != USEARCH_DONE) {
-      len = search->getMatchedLength();
-    }
-    srchResultPtrs.push_back(std::make_pair(pos, len));
   }
 
   icu_64_64::UnicodeString result;
   int32_t lastStart = 0;
-  int64_t count = 0;
-  while (true) {
-    int which = -1;
-    int32_t pos = USEARCH_DONE;
-    int32_t mLen = 0;
-    int i = 0;
-    for (auto resultPair : srchResultPtrs) {
-      // We locate the nearest matching search result.
-      int32_t thisPos;
-      thisPos = resultPair.first;
-      if ((pos == USEARCH_DONE) || (pos > thisPos)) {
-        if (thisPos != USEARCH_DONE) {
-          pos = thisPos;
-          which = i;
-          mLen = resultPair.second;
-        }
-      }
-      i++;
-    }
-    if (which == -1) {
+  for (int64_t count = 0; limit == -1 || count < limit; ++count) {
+    auto best = std::ranges::min_element(
+        srchResultPtrs, [](Match const& a, Match const& b) {
+          return a.first != USEARCH_DONE &&
+                 (b.first == USEARCH_DONE || a.first < b.fi
```

**File**: `tests/js/client/aql/aql-functions-string.js` (modified, +12/-0)
```diff
@@ -1344,6 +1344,14 @@ function ahuacatlStringFunctionsTestSuite () {
         [ '', '', [ 'foo', 'baz' ], [ 'bar', 'qux' ] ],
         [ '', '', { foo: 'bar' } ],
         [ '', '', 'foo', 'bar', 1 ],
+        [ '_a_b_c_', 'abc', '', '_' ],
+        [ '_a_bc', 'abc', '', '_', 2 ],
+        [ '_a_b_c_', 'abc', [ '' ], [ '_' ] ],
+        [ '_a_b_c_', 'abc', { '': '_' } ],
+        [ '_a_bc', 'abc', { '': '_' }, 2 ],
+        [ '-ö-ü-', 'öü', '', '-' ],
+        [ 'x', '', '', 'x' ],
+        [ '_a-_c_', 'abc', [ 'b', '' ], [ '-', '_' ] ],
       ];
 
       values.forEach(function (value) {
@@ -1359,6 +1367,10 @@ function ahuacatlStringFunctionsTestSuite () {
       });
     },
     
+    testSubstituteDuplicateEmptyKeyUsesFirst: function () {
+      assertEqual([ '_a_b_c_' ], getQueryResults(`RETURN SUBSTITUTE('abc', { '': '_', '': '-' })`));
+    },
+
 // //////////////////////////////////////////////////////////////////////////////
 // / @brief test substitute function
 // //////////////////////////////////////////////////////////////////////////////
```

---

### Incident Patch 3: `ed2ca987` (2026-09-24)
**Commit Message**: Fix empty search and simplify

**File**: `arangod/Aql/Function/StringFunctions.cpp` (modified, +54/-98)
```diff
@@ -52,6 +52,7 @@
 #include <unicode/uchar.h>
 #include <unicode/unistr.h>
 
+#include <algorithm>
 #include <cstdint>
 #include <cstring>
 #include <string_view>
@@ -772,21 +773,21 @@ AqlValue functions::Substitute(ExpressionContext* expressionContext,
   velocypack::StringSink adapter(buffer.get());
 
   appendAsString(vopts, adapter, value);
-  if (buffer->empty()) {
-    // ICU's StringSearch rejects an empty text with U_ILLEGAL_ARGUMENT_ERROR
-    return AqlValue(*buffer);
-  }
   icu_64_64::UnicodeString unicodeStr(buffer->data(),
                                       static_cast<int32_t>(buffer->length()));
 
   auto& server = trx->vocbase().server();
   auto locale = server.getFeature<LanguageFeature>().getLocale();
-  // we can't copy the search instances, thus use pointers:
+  // we can't copy the search instances, thus use pointers.
+  // ICU's StringSearch rejects empty patterns and texts
   std::vector<std::unique_ptr<icu_64_64::StringSearch>> searchVec;
   searchVec.reserve(matchPatterns.size());
   UErrorCode status = U_ZERO_ERROR;
   for (auto const& searchStr : matchPatterns) {
-    // create a vector of string searches
+    if (searchStr.isEmpty() || unicodeStr.isEmpty()) {
+      searchVec.push_back(nullptr);
+      continue;
+    }
     searchVec.push_back(std::make_unique<icu_64_64::StringSearch>(
         searchStr, unicodeStr, locale, nullptr, status));
     if (U_FAILURE(status)) {
@@ -795,118 +796,73 @@ AqlValue functions::Substitute(ExpressionContext* expressionContext,
     }
   }
 
-  std::vector<std::pair<int32_t, int32_t>> srchResultPtrs;
+  using Match = std::pair<int32_t, int32_t>;
+  auto const fromSearch = [&](size_t which, int32_t pos) -> Match {
+    if (pos == USEARCH_DONE) {
+      return {pos, 0};
+    }
+    return {pos, searchVec[which]->getMatchedLength()};
+  };
+  auto const firstMatch = [&](size_t which) -> Match {
+    if (searchVec[which] == nullptr) {
+      return {matchPatterns[which].isEmpty() ? 0 : USEARCH_DONE, 0};
+    }
+    return fromSearch(which, searchVec[which]->first(status));
+  };
+  auto const nextMatch = [&](size_t which, int32_t pos) -> Match {
+    if (searchVec[which] == nullptr) {
+      return {pos < unicodeStr.length() ? unicodeStr.moveIndex32(pos, 1)
+                                        : USEARCH_DONE,
+              0};
+    }
+    return fromSearch(which, searchVec[which]->next(status));
+  };
+
+  std::vector<Match> srchResultPtrs;
   std::string utf8;
   srchResultPtrs.reserve(matchPatterns.size());
-  for (auto& search : searchVec) {
+  for (size_t i = 0; i < matchPatterns.size(); ++i) {
     // We now find the first hit for each search string.
-    auto pos = search->first(status);
+    srchResultPtrs.push_back(firstMatch(i));
     if (U_FAILURE(status)) {
       registerICUWarning(expressionContext, AFN, status);
       return AqlValue(AqlValueHintNull());
     }
-
-    int32_t len = 0;
-    if (pos != USEARCH_DONE) {
-      len = search->getMatchedLength();
-    }
-    srchResultPtrs.push_back(std::make_pair(pos, len));
   }
 
   icu_64_64::UnicodeString result;
   int32_t lastStart = 0;
-  int64_t count = 0;
-  while (true) {
-    int which = -1;
-    int32_t pos = USEARCH_DONE;
-    int32_t mLen = 0;
-    int i = 0;
-    for (auto resultPair : srchResultPtrs) {
-      // We locate the nearest matching search result.
-      int32_t thisPos;
-      thisPos = resultPair.first;
-      if ((pos == USEARCH_DONE) || (pos > thisPos)) {
-        if (thisPos != USEARCH_DONE) {
-          pos = thisPos;
-          which = i;
-          mLen = resultPair.second;
-        }
-      }
-      i++;
-    }
-    if (which == -1) {
+  for (int64_t count = 0; limit == -1 || count < limit; ++count) {
+    auto best = std::ranges::min_element(
+        srchResultPtrs, [](Match const& a, Match const& b) {
+          return a.first != USEARCH_DONE &&
+                 (b.first == USEARCH_DONE || a.first < b.first);
+        });
+    if (best->first == USEARCH_DONE) 
```

---

### Incident Patch 4: `2f53bade` (2026-09-29)
**Commit Message**: Fix PR comments

**File**: `CHANGELOG` (modified, +0/-5)
```diff
@@ -1,10 +1,5 @@
 3.12.13 (XXXX-XX-XX)
 --------------------
-* COR-1012 The client tools started with `--server.username`/`--server.password`
-  now obtain a JWT via `POST /_open/auth` like arangosh and renew it before
-  it expires, which also makes them work against servers in RBAC mode; they
-  fall back to HTTP basic authentication if the server issues no token.
-
 * COR-1018: Cap vector index search result buffers at the collection's
   document count and track their memory against the query memory limit.
 
```

**File**: `client-tools/Utils/RenewingJwtToken.cpp` (modified, +3/-0)
```diff
@@ -134,6 +134,9 @@ auto parseTokenResponse(httpclient::SimpleHttpResult const& response)
           TRI_ERROR_INTERNAL,
           "unexpected reply from /_open/auth: jwt is not a string");
     }
+    if (jwt.isEqualString("")) {
+      return TokenOutcome::success(std::nullopt);
+    }
     if (jwt.isEqualString("invalid")) {
       // the server issues no tokens while authentication is disabled
       return TokenOutcome::success(std::nullopt);
```

**File**: `tests/ClientTools/RenewingJwtTokenTest.cpp` (modified, +9/-0)
```diff
@@ -223,6 +223,15 @@ TEST(RenewingJwtTokenTest, rejectsUnexpectedResponseBodies) {
   EXPECT_TRUE(parseTokenResponse(*completeResponse(200, "not json")).fail());
 }
 
+TEST(RenewingJwtTokenTest, parsesEmptyTokenAsNotTokenIssued) {
+  // the server answers with the token "invalid" when authentication is off
+  auto const outcome =
+      parseTokenResponse(*completeResponse(200, R"({"jwt":""})"));
+
+  ASSERT_TRUE(outcome.ok());
+  EXPECT_EQ(outcome.get(), std::nullopt);
+}
+
 // RenewingJwtToken
 
 TEST(RenewingJwtTokenTest, currentReturnsTheTokenWithoutRenewingIt) {
```

---

### Incident Patch 5: `06fc1678` (2026-09-29)
**Commit Message**: Merge pull request #23364 from arangodb/bugfix/fix-race-in-rest-dump-handler-failure-point

Get rid of race in rest dump handler failure point

**File**: `arangod/RestHandler/RestDumpHandler.cpp` (modified, +11/-5)
```diff
@@ -221,13 +221,19 @@ void RestDumpHandler::handleCommandDumpNext() {
   }
 
   TRI_IF_FAILURE("RestDumpHandler::fetch-delay") {
-    // busy loop when we are the first fetch
-    // exist busy loop with second fetch
+    // the first fetch waits here until a second fetch arrives, so that it
+    // stays observable as a running activity in the meantime.
+    // the wait also ends when the failure point is cleared or the server
+    // stops: otherwise a second fetch that never reaches this point would
+    // keep this handler, and with it the dump context and its collection
+    // locks, alive forever.
     static std::atomic<bool> firstFetch{false};
-    if (!firstFetch.load()) {
-      firstFetch.store(true);
-      while (firstFetch.load()) {
+    if (!firstFetch.exchange(true)) {
+      while (firstFetch.load() && !server().isStopping() &&
+             TRI_ShouldFailDebugging("RestDumpHandler::fetch-delay")) {
+        std::this_thread::sleep_for(std::chrono::milliseconds(1));
       }
+      firstFetch.store(false);
     } else {
       firstFetch.store(false);
     }
```

**File**: `tests/js/client/shell/api/activities.js` (modified, +20/-4)
```diff
@@ -68,6 +68,19 @@ function activityRegistrySuite() {
     return res.headers["x-arango-async-id"];
   }
 
+  function waitForAsyncJobToFinish(jobId) {
+    const deadline = Date.now() + 60 * 1000;
+    while (true) {
+      // fetching the result also removes the finished job from the server
+      const res = internal.arango.PUT_RAW(`/_api/job/${jobId}`, "");
+      if (res.code !== 204) {
+        return res;
+      }
+      assertTrue(Date.now() < deadline, `async job ${jobId} did not finish in time`);
+      internal.wait(0.5);
+    }
+  }
+
   return {
     setUpAll: function () {
       db._create(c);
@@ -134,7 +147,7 @@ function activityRegistrySuite() {
       try {
         IM.debugSetFailAt("RestDumpHandler::fetch-delay");
         
-        const cursorId = fetchDumpAsynchronously(dumpId, server); // Rest call is kept busy with failure point
+        const fetchJobId = fetchDumpAsynchronously(dumpId, server); // Rest call is kept busy with failure point
 
         // make sure that dump context fetch activity is created before activities are requested
         let maxWait = 5;
@@ -163,9 +176,12 @@ function activityRegistrySuite() {
           .filter((id) => dumpContextFetchActivityParents.includes(id)), 0);
 
         // stop first dump-fetch Rest call with a second call
-        const cursorId2 = fetchDumpAsynchronously(dumpId, server);
-        internal.arango.DELETE_RAW(`/_api/job/${cursorId}`);
-        internal.arango.DELETE_RAW(`/_api/job/${cursorId2}`);
+        const secondFetchJobId = fetchDumpAsynchronously(dumpId, server);
+        // both fetches only pass the failure point together: wait for both
+        // before the failure point is cleared, otherwise a fetch that reaches
+        // the failure point after it was cleared leaves the other one waiting
+        waitForAsyncJobToFinish(fetchJobId);
+        waitForAsyncJobToFinish(secondFetchJobId);
 
       } finally {
         IM.debugClearFailAt();
```

---

### Incident Patch 6: `f6008472` (2026-09-29)
**Commit Message**: Merge pull request #23366 from arangodb/bugfix/fix-jwt-token-renewals

Fix use-after-free in jwt-token renewal

**File**: `client-tools/Utils/RenewingJwtToken.cpp` (modified, +2/-1)
```diff
@@ -118,7 +118,8 @@ auto parseRenewalResponse(httpclient::SimpleHttpResult const& response)
     return check;
   }
   try {
-    auto const body = response.getBodyVelocyPack()->slice();
+    auto const builder = response.getBodyVelocyPack();
+    auto const body = builder->slice();
     if (!body.isObject()) {
       return RenewalOutcome::error(
           TRI_ERROR_INTERNAL,
```

**File**: `tests/ClientTools/RenewingJwtTokenTest.cpp` (modified, +1/-1)
```diff
@@ -104,7 +104,7 @@ TEST(RenewingJwtTokenTest, renewalIsNeverDueWithoutExpiry) {
   auto const state = JwtTokenState{
       .token = "t", .obtainedAt = at(0), .expiresAt = std::nullopt};
 
-  EXPECT_FALSE(isRenewalDue(state, at(1'000'000'000'000), threshold));
+  EXPECT_FALSE(isRenewalDue(state, at(1'000'000'000), threshold));
 }
 
 TEST(RenewingJwtTokenTest, renewalIsDueOnceWithinThresholdOfExpiry) {
```

---

### Incident Patch 7: `3d566e40` (2026-09-29)
**Commit Message**: Merge remote-tracking branch 'origin/devel' into bugfix/fix-race-in-rest-dump-handler-failure-point

**File**: `CHANGELOG` (modified, +16/-0)
```diff
@@ -1,5 +1,16 @@
 3.12.13 (XXXX-XX-XX)
 --------------------
+* COR-1018: Cap vector index search result buffers at the collection's
+  document count and track their memory against the query memory limit.
+
+* AQL `REGEX_MATCHES()` matches empty strings like any other input.
+  This fixes issue #23362.
+
+* AQL `REVERSE` keeps characters above U+FFFF, such as emoji, intact when
+  reversing a string, and reverses strings containing U+FFFF completely.
+  This fixes issue #23360.
+
+* Updated ArangoDB Starter to v0.19.28.
 
 * COR-994: arangodump, arangorestore and arangosh now renew a JWT passed via
   `--server.jwt-token` before it expires, using `POST /_open/auth/renew`
@@ -21,6 +32,11 @@
 * COR-1025: Escape double quotes, backslashes and line feeds in metric label
   values according to the Prometheus text exposition format.
 
+* AQL queries on collections with a sparse `mdi` or `mdi-prefixed` index
+  accept any `FILTER` condition, including conditions that are not
+  comparisons, such as `IS_STRING(doc.attr)` or `NOT doc.attr`. Such queries
+  failed with `member out of range` before. This fixes issue #23356.
+
 * COR-917: AQL UPDATE with keepNull: false leaves the attribute in place in the 
   _to_ shadow collection of a non-disjoint SmartGraph.
   Fixed an issue where updating an edge attribute with keepNull: false in a 
```

**File**: `VERSIONS` (modified, +3/-3)
```diff
@@ -1,7 +1,7 @@
 CXX_STANDARD "20"
-STARTER_REV "v0.19.27"
-STARTER_SHA256_AMD64 "fabe4a062ddbf6ed3e36779c442c6340e8120830c2695b728ebaeadfd4d0de9e"
-STARTER_SHA256_ARM64 "a35b92ea32057f45cabb1d8a07c65015e4cdb79fd05e9c5902fd98d78c7b32a3"
+STARTER_REV "v0.19.28"
+STARTER_SHA256_AMD64 "d3f616cf77ccd4e35d0e45c4df4c804da481fa1a41102bed8f1894567e45f890"
+STARTER_SHA256_ARM64 "1f5a7f4db8b2c762d6d5e508df5ae772b4ebd259ca4a6daeea6906413c3f08f4"
 GCC_LINUX "13.2.0"
 CLANG_LINUX "19.1.7"
 OPENSSL_LINUX "3.5.8"
```

**File**: `arangod/Agency/AgencyComm.cpp` (modified, +6/-4)
```diff
@@ -40,6 +40,7 @@
 #include "Metrics/LogScale.h"
 #include "Rest/GeneralRequest.h"
 #include "RestServer/DatabaseFeature.h"
+#include "RestServer/IDatabaseProvider.h"
 #include "RestServer/ServerFeature.h"
 #include "StorageEngine/HealthData.h"
 #include "StorageEngine/StorageEngine.h"
@@ -659,10 +660,10 @@ AgencyComm::AgencyComm(application_features::ApplicationServer& server)
 
 AgencyComm::AgencyComm(ApplicationServer& server,
                        ClusterFeature& clusterFeature,
-                       DatabaseFeature& databaseFeature)
+                       IDatabaseProvider& databaseProvider)
     : _server(server),
       _clusterFeature(clusterFeature),
-      _databaseFeature(databaseFeature),
+      _databaseProvider(databaseProvider),
       _agency_comm_request_time_ms(
           _clusterFeature.agency_comm_request_time_ms()) {}
 
@@ -680,7 +681,8 @@ AgencyCommResult AgencyComm::sendServerState(double timeout) {
 
     if (ServerState::instance()->isDBServer()) {
       // use storage engine health self-assessment and send it to agency too
-      arangodb::HealthData hd = _databaseFeature.engine().healthCheck();
+      arangodb::HealthData hd =
+          _server.getFeature<StorageEngine>().healthCheck();
       hd.toVelocyPack(builder, /*withDetails*/ false);
     }
 
@@ -1317,7 +1319,7 @@ bool AgencyComm::tryInitializeStructure() {
           builder.add(StaticStrings::DatabaseId, VPackValue("1"));
           builder.add(StaticStrings::ReplicationVersion,
                       arangodb::replication::versionToString(
-                          _databaseFeature.defaultReplicationVersion()));
+                          _databaseProvider.defaultReplicationVersion()));
           // We need to also take care of the `cluster.force-one-shard` option
           // here. If set, the entire cluster is forced to be a OneShard
           // deployment.
```

**File**: `arangod/Agency/AgencyComm.h` (modified, +3/-4)
```diff
@@ -35,13 +35,12 @@
 #include "Network/types.h"
 #include "Rest/CommonDefines.h"
 #include "Metrics/Fwd.h"
-#include "RestServer/DatabaseFeature.h"
 
 namespace arangodb {
 class Endpoint;
 class Result;
 class ClusterFeature;
-class DatabaseFeature;
+struct IDatabaseProvider;
 
 namespace application_features {
 class ApplicationServer;
@@ -586,7 +585,7 @@ class AgencyComm {
       "dependency")]] explicit AgencyComm(application_features::
                                               ApplicationServer&);
   AgencyComm(application_features::ApplicationServer&, ClusterFeature&,
-             DatabaseFeature&);
+             IDatabaseProvider&);
 
   AgencyCommResult sendServerState(double timeout);
 
@@ -664,7 +663,7 @@ class AgencyComm {
 
   application_features::ApplicationServer& _server;
   ClusterFeature& _clusterFeature;
-  DatabaseFeature& _databaseFeature;
+  IDatabaseProvider& _databaseProvider;
   metrics::Histogram<metrics::LogScale<uint64_t>>& _agency_comm_request_time_ms;
 };
 
```

**File**: `arangod/Aql/Executor/EnumerateNearVectorExecutor.cpp` (modified, +33/-5)
```diff
@@ -37,6 +37,7 @@
 #include "VocBase/LogicalCollection.h"
 #include "Aql/ExecutionBlockImpl.tpp"
 
+#include <algorithm>
 #include <cmath>
 
 // Activate logging
@@ -54,12 +55,22 @@ struct Collection;
 
 using Stats = NoStats;
 
+namespace {
+
+std::uint64_t resultBufferBytes(std::size_t topK) noexcept {
+  return static_cast<std::uint64_t>(topK) *
+         (sizeof(vector::LabelId) + sizeof(vector::Distance));
+}
+
+}  // namespace
+
 EnumerateNearVectorsExecutor::EnumerateNearVectorsExecutor(Fetcher& /*unused*/,
                                                            Infos& infos)
     : _infos(infos),
       _trx(_infos.queryContext.newTrxContext()),
       _collection(_infos.collection),
-      _vectorIndex(resolveVectorIndex(_infos)) {}
+      _vectorIndex(resolveVectorIndex(_infos)),
+      _resultBuffersMemory(_infos.queryContext.resourceMonitor()) {}
 
 RocksDBVectorIndex const& EnumerateNearVectorsExecutor::resolveVectorIndex(
     Infos const& infos) {
@@ -124,7 +135,6 @@ void EnumerateNearVectorsExecutor::fillInput(
 
   AqlValue value = _inputRow.getValue(docRegId);
 
-  // TODO currently we do not accept anything else then array
   if (!value.isArray()) {
     THROW_ARANGO_EXCEPTION_MESSAGE(
         TRI_ERROR_QUERY_FUNCTION_ARGUMENT_TYPE_MISMATCH,
@@ -157,24 +167,42 @@ void EnumerateNearVectorsExecutor::fillInput(
 }
 
 void EnumerateNearVectorsExecutor::searchResults() {
+  _currentProcessedResultCount = 0;
+  // Release the previous batch first so the tracked memory below matches
+  // what is actually allocated during readBatch.
+  _labels = {};
+  _distances = {};
+  _documents.clear();
+  _resultBuffersMemory.revert();
+
+  TRI_ASSERT(_infos.searchConfig.topK > 0) << "LIMIT cannot be 0";
+  // A search can never return more hits than the collection holds, so size
+  // the result buffers by the document count rather than by LIMIT + OFFSET.
+  auto searchConfig = _infos.searchConfig;
+  searchConfig.topK = std::min(searchConfig.topK, _collectionCount);
+  if (searchConfig.topK == 0) {
+    // Only reachable for an empty collection; faiss rejects k == 0.
+    return;
+  }
+  _resultBuffersMemory.increase(resultBufferBytes(searchConfig.topK));
+
   vector::VectorSearchContext ctx{
       .inputs = &_inputRowConverted,
       .inputRow = &_inputRow,
       .trx = &_trx,
       .queryContext = &_infos.queryContext,
   };
-  auto result = _vectorIndex.readBatch(_infos.searchConfig, ctx);
+  auto result = _vectorIndex.readBatch(searchConfig, ctx);
   _labels = std::move(result.labels);
   _distances = std::move(result.distances);
   _documents = std::move(result.capturedDocuments);
-  _currentProcessedResultCount = 0;
 
   auto validCount = std::count_if(_labels.begin(), _labels.end(),
                                   [](auto const& l) { return l != -1; });
   LOG_TOPIC("f1a2b", DEBUG, Logger::ENGINES) << std::format(
       "EnumerateNearVectors::searchResults: requested={}, returned={}, "
       "validLabels={}, collectionCount={}",
-      _infos.searchConfig.topK, _labels.size(), validCount, _collectionCount);
+      searchConfig.topK, _labels.size(), validCount, _collectionCount);
 
   LOG_INTERNAL << "Results: " << _labels << " and distances: " << _distances;
 }
```

---

### Incident Patch 8: `6794da26` (2026-09-29)
**Commit Message**: Merge pull request #23336 from arangodb/bug-fix/cor-1018-vector-index-topk-limit

[COR-1018] Manage memory resource of topK in ANN search

**File**: `CHANGELOG` (modified, +2/-0)
```diff
@@ -1,5 +1,7 @@
 3.12.13 (XXXX-XX-XX)
 --------------------
+* COR-1018: Cap vector index search result buffers at the collection's
+  document count and track their memory against the query memory limit.
 
 * AQL `REVERSE` keeps characters above U+FFFF, such as emoji, intact when
   reversing a string, and reverses strings containing U+FFFF completely.
```

**File**: `arangod/Aql/Executor/EnumerateNearVectorExecutor.cpp` (modified, +33/-5)
```diff
@@ -37,6 +37,7 @@
 #include "VocBase/LogicalCollection.h"
 #include "Aql/ExecutionBlockImpl.tpp"
 
+#include <algorithm>
 #include <cmath>
 
 // Activate logging
@@ -54,12 +55,22 @@ struct Collection;
 
 using Stats = NoStats;
 
+namespace {
+
+std::uint64_t resultBufferBytes(std::size_t topK) noexcept {
+  return static_cast<std::uint64_t>(topK) *
+         (sizeof(vector::LabelId) + sizeof(vector::Distance));
+}
+
+}  // namespace
+
 EnumerateNearVectorsExecutor::EnumerateNearVectorsExecutor(Fetcher& /*unused*/,
                                                            Infos& infos)
     : _infos(infos),
       _trx(_infos.queryContext.newTrxContext()),
       _collection(_infos.collection),
-      _vectorIndex(resolveVectorIndex(_infos)) {}
+      _vectorIndex(resolveVectorIndex(_infos)),
+      _resultBuffersMemory(_infos.queryContext.resourceMonitor()) {}
 
 RocksDBVectorIndex const& EnumerateNearVectorsExecutor::resolveVectorIndex(
     Infos const& infos) {
@@ -124,7 +135,6 @@ void EnumerateNearVectorsExecutor::fillInput(
 
   AqlValue value = _inputRow.getValue(docRegId);
 
-  // TODO currently we do not accept anything else then array
   if (!value.isArray()) {
     THROW_ARANGO_EXCEPTION_MESSAGE(
         TRI_ERROR_QUERY_FUNCTION_ARGUMENT_TYPE_MISMATCH,
@@ -157,24 +167,42 @@ void EnumerateNearVectorsExecutor::fillInput(
 }
 
 void EnumerateNearVectorsExecutor::searchResults() {
+  _currentProcessedResultCount = 0;
+  // Release the previous batch first so the tracked memory below matches
+  // what is actually allocated during readBatch.
+  _labels = {};
+  _distances = {};
+  _documents.clear();
+  _resultBuffersMemory.revert();
+
+  TRI_ASSERT(_infos.searchConfig.topK > 0) << "LIMIT cannot be 0";
+  // A search can never return more hits than the collection holds, so size
+  // the result buffers by the document count rather than by LIMIT + OFFSET.
+  auto searchConfig = _infos.searchConfig;
+  searchConfig.topK = std::min(searchConfig.topK, _collectionCount);
+  if (searchConfig.topK == 0) {
+    // Only reachable for an empty collection; faiss rejects k == 0.
+    return;
+  }
+  _resultBuffersMemory.increase(resultBufferBytes(searchConfig.topK));
+
   vector::VectorSearchContext ctx{
       .inputs = &_inputRowConverted,
       .inputRow = &_inputRow,
       .trx = &_trx,
       .queryContext = &_infos.queryContext,
   };
-  auto result = _vectorIndex.readBatch(_infos.searchConfig, ctx);
+  auto result = _vectorIndex.readBatch(searchConfig, ctx);
   _labels = std::move(result.labels);
   _distances = std::move(result.distances);
   _documents = std::move(result.capturedDocuments);
-  _currentProcessedResultCount = 0;
 
   auto validCount = std::count_if(_labels.begin(), _labels.end(),
                                   [](auto const& l) { return l != -1; });
   LOG_TOPIC("f1a2b", DEBUG, Logger::ENGINES) << std::format(
       "EnumerateNearVectors::searchResults: requested={}, returned={}, "
       "validLabels={}, collectionCount={}",
-      _infos.searchConfig.topK, _labels.size(), validCount, _collectionCount);
+      searchConfig.topK, _labels.size(), validCount, _collectionCount);
 
   LOG_INTERNAL << "Results: " << _labels << " and distances: " << _distances;
 }
```

**File**: `arangod/Aql/Executor/EnumerateNearVectorExecutor.h` (modified, +2/-0)
```diff
@@ -29,6 +29,7 @@
 #include "Aql/ExecutionBlock.h"
 #include "Aql/OutputAqlItemRow.h"
 #include "Aql/Stats.h"
+#include "Basics/ResourceUsage.h"
 #include "Containers/FlatHashMap.h"
 #include "Containers/NodeHashMap.h"
 #include "VectorIndex/VectorReadBatch.h"
@@ -127,6 +128,7 @@ class EnumerateNearVectorsExecutor {
   transaction::Methods _trx;
   aql::Collection const* _collection;
   RocksDBVectorIndex const& _vectorIndex;
+  ResourceUsageScope _resultBuffersMemory;
 
   InputAqlItemRow _inputRow = InputAqlItemRow{CreateInvalidInputRowHint{}};
   std::vector<float> _inputRowConverted;
```

**File**: `arangod/RocksDBEngine/RocksDBVectorIndex.cpp` (modified, +4/-4)
```diff
@@ -419,17 +419,17 @@ RocksDBVectorIndex::bruteForceSearch(
     return true;
   });
 
-  // Truncate labels and distances to min(topK, total_no_of_documents)
-  labels.resize(n);
-  distances.resize(n);
-
   // Reorder heap so results are sorted
   if (isDescending) {
     faiss::minheap_reorder(topK, distances.data(), labels.data());
   } else {
     faiss::maxheap_reorder(topK, distances.data(), labels.data());
   }
 
+  // Truncate labels and distances to min(topK, total_no_of_documents)
+  labels.resize(n);
+  distances.resize(n);
+
   // L2: fvec_L2sqr returns squared distances, take sqrt
   if (_definition.metric == vector::SimilarityMetric::kL2) {
     std::ranges::transform(distances, distances.begin(),
```

**File**: `tests/js/client/aql/vector/aql-vector-create-and-remove.js` (modified, +49/-0)
```diff
@@ -58,6 +58,35 @@ function VectorIndexCreateAndRemoveTestSuite() {
     const insertedDocsCount = 1500 * insertedDocsCountFactor;
     let insertedDocs = [];
 
+    const assertUsesVectorIndex = (query, bindVars) => {
+        const plan = db._createStatement({
+            query,
+            bindVars
+        }).explain().plan;
+        const indexNodes = plan.nodes.filter(
+            n => n.type === "EnumerateNearVectorNode");
+        assertEqual(1, indexNodes.length);
+    };
+
+    const assertSearchOnEmptyCollectionReturnsNothing = () => {
+        const query = "FOR d IN " +
+            collection.name() +
+            " SORT APPROX_NEAR_L2(d.vector, @qp, {nProbe: 10}) " +
+            "LIMIT 5 RETURN d._key";
+        const bindVars = {
+            qp: randomPoint
+        };
+        assertUsesVectorIndex(query, bindVars);
+
+        assertEqual([], db._query(query, bindVars).toArray());
+
+        const withFullCount = db._query(query, bindVars, {
+            fullCount: true
+        });
+        assertEqual([], withFullCount.toArray());
+        assertEqual(0, withFullCount.getExtra().stats.fullCount);
+    };
+
     return {
         setUp: function() {
             db._useDatabase("_system");
@@ -206,6 +235,26 @@ function VectorIndexCreateAndRemoveTestSuite() {
 
             assertNotEqual(closesDocKeysPreRemove, closesDocKeysPostRemove);
         },
+
+        testSearchOnTruncatedCollectionKeepsReadyIndexAndReturnsNothing: function() {
+            collection.truncate();
+            assertEqual(0, collection.count());
+            assertTrue(waitForVectorIndexState(collection, "vector_l2",
+                VectorIndexTrainingState.kReady, 1));
+
+            assertSearchOnEmptyCollectionReturnsNothing();
+        },
+
+        testSearchAfterRemovingAllDocumentsReturnsNothing: function() {
+            collection.remove(insertedDocs.map(item => ({
+                "_key": item._key
+            })));
+            assertEqual(0, collection.count());
+            assertTrue(waitForVectorIndexState(collection, "vector_l2",
+                VectorIndexTrainingState.kReady, 1));
+
+            assertSearchOnEmptyCollectionReturnsNothing();
+        },
     };
 }
 
```

---

### Incident Patch 9: `51b1e3ab` (2026-09-22)
**Commit Message**: Track memory in EnumerateNearVectorExecutor

**File**: `arangod/Aql/Executor/EnumerateNearVectorExecutor.cpp` (modified, +35/-5)
```diff
@@ -37,6 +37,7 @@
 #include "VocBase/LogicalCollection.h"
 #include "Aql/ExecutionBlockImpl.tpp"
 
+#include <algorithm>
 #include <cmath>
 
 // Activate logging
@@ -54,12 +55,22 @@ struct Collection;
 
 using Stats = NoStats;
 
+namespace {
+
+std::uint64_t resultBufferBytes(std::size_t topK) noexcept {
+  return static_cast<std::uint64_t>(topK) *
+         (sizeof(vector::LabelId) + sizeof(vector::Distance));
+}
+
+}  // namespace
+
 EnumerateNearVectorsExecutor::EnumerateNearVectorsExecutor(Fetcher& /*unused*/,
                                                            Infos& infos)
     : _infos(infos),
       _trx(_infos.queryContext.newTrxContext()),
       _collection(_infos.collection),
-      _vectorIndex(resolveVectorIndex(_infos)) {}
+      _vectorIndex(resolveVectorIndex(_infos)),
+      _resultBuffersMemory(_infos.queryContext.resourceMonitor()) {}
 
 RocksDBVectorIndex const& EnumerateNearVectorsExecutor::resolveVectorIndex(
     Infos const& infos) {
@@ -124,7 +135,6 @@ void EnumerateNearVectorsExecutor::fillInput(
 
   AqlValue value = _inputRow.getValue(docRegId);
 
-  // TODO currently we do not accept anything else then array
   if (!value.isArray()) {
     THROW_ARANGO_EXCEPTION_MESSAGE(
         TRI_ERROR_QUERY_FUNCTION_ARGUMENT_TYPE_MISMATCH,
@@ -157,24 +167,44 @@ void EnumerateNearVectorsExecutor::fillInput(
 }
 
 void EnumerateNearVectorsExecutor::searchResults() {
+  _currentProcessedResultCount = 0;
+  // Release the previous batch first so the tracked memory below matches
+  // what is actually allocated during readBatch.
+  _labels = {};
+  _distances = {};
+  _documents.clear();
+  _resultBuffersMemory.revert();
+
+  TRI_ASSERT(_infos.searchConfig.topK > 0) << "LIMIT cannot be 0";
+  // A search can never return more hits than the collection holds, so size
+  // the result buffers by the document count rather than by LIMIT + OFFSET.
+  // This trusts the RocksDB document counter: if it underreports, matching
+  // documents are cut off until the count is recalculated.
+  auto searchConfig = _infos.searchConfig;
+  searchConfig.topK = std::min(searchConfig.topK, _collectionCount);
+  if (searchConfig.topK == 0) {
+    // Only reachable for an empty collection; faiss rejects k == 0.
+    return;
+  }
+  _resultBuffersMemory.increase(resultBufferBytes(searchConfig.topK));
+
   vector::VectorSearchContext ctx{
       .inputs = &_inputRowConverted,
       .inputRow = &_inputRow,
       .trx = &_trx,
       .queryContext = &_infos.queryContext,
   };
-  auto result = _vectorIndex.readBatch(_infos.searchConfig, ctx);
+  auto result = _vectorIndex.readBatch(searchConfig, ctx);
   _labels = std::move(result.labels);
   _distances = std::move(result.distances);
   _documents = std::move(result.capturedDocuments);
-  _currentProcessedResultCount = 0;
 
   auto validCount = std::count_if(_labels.begin(), _labels.end(),
                                   [](auto const& l) { return l != -1; });
   LOG_TOPIC("f1a2b", DEBUG, Logger::ENGINES) << std::format(
       "EnumerateNearVectors::searchResults: requested={}, returned={}, "
       "validLabels={}, collectionCount={}",
-      _infos.searchConfig.topK, _labels.size(), validCount, _collectionCount);
+      searchConfig.topK, _labels.size(), validCount, _collectionCount);
 
   LOG_INTERNAL << "Results: " << _labels << " and distances: " << _distances;
 }
```

**File**: `arangod/Aql/Executor/EnumerateNearVectorExecutor.h` (modified, +2/-0)
```diff
@@ -29,6 +29,7 @@
 #include "Aql/ExecutionBlock.h"
 #include "Aql/OutputAqlItemRow.h"
 #include "Aql/Stats.h"
+#include "Basics/ResourceUsage.h"
 #include "Containers/FlatHashMap.h"
 #include "Containers/NodeHashMap.h"
 #include "VectorIndex/VectorReadBatch.h"
@@ -127,6 +128,7 @@ class EnumerateNearVectorsExecutor {
   transaction::Methods _trx;
   aql::Collection const* _collection;
   RocksDBVectorIndex const& _vectorIndex;
+  ResourceUsageScope _resultBuffersMemory;
 
   InputAqlItemRow _inputRow = InputAqlItemRow{CreateInvalidInputRowHint{}};
   std::vector<float> _inputRowConverted;
```

---

### Incident Patch 10: `040e73b5` (2026-09-29)
**Commit Message**: Merge pull request #23376 from arangodb/bug-fix/gh-23360-reverse-corrupts-astral-characters

AQL REVERSE keeps characters above U+FFFF intact

**File**: `CHANGELOG` (modified, +4/-0)
```diff
@@ -1,6 +1,10 @@
 3.12.13 (XXXX-XX-XX)
 --------------------
 
+* AQL `REVERSE` keeps characters above U+FFFF, such as emoji, intact when
+  reversing a string, and reverses strings containing U+FFFF completely.
+  This fixes issue #23360.
+
 * Updated ArangoDB Starter to v0.19.28.
 
 * COR-994: arangodump, arangorestore and arangosh now renew a JWT passed via
```

**File**: `arangod/Aql/Function/MiscFunctions.cpp` (modified, +3/-12)
```diff
@@ -38,7 +38,6 @@
 #include <velocypack/Sink.h>
 #include <velocypack/Slice.h>
 
-#include <unicode/schriter.h>
 #include <unicode/unistr.h>
 
 using namespace arangodb;
@@ -195,17 +194,9 @@ AqlValue functions::Reverse(ExpressionContext* expressionContext,
     appendAsString(vopts, adapter, value);
     icu_64_64::UnicodeString uBuf(buf1->data(),
                                   static_cast<int32_t>(buf1->length()));
-    // reserve the result buffer, but need to set empty afterwards:
-    icu_64_64::UnicodeString result;
-    result.getBuffer(uBuf.length());
-    result = "";
-    icu_64_64::StringCharacterIterator iter(uBuf, uBuf.length());
-    UChar c = iter.previous();
-    while (c != icu_64_64::CharacterIterator::DONE) {
-      result.append(c);
-      c = iter.previous();
-    }
-    result.toUTF8String(utf8);
+    // reverse() keeps surrogate pairs intact
+    uBuf.reverse();
+    uBuf.toUTF8String(utf8);
 
     return AqlValue(utf8);
   } else {
```

**File**: `tests/js/client/aql/aql-functions.js` (modified, +26/-0)
```diff
@@ -456,6 +456,32 @@ function ahuacatlFunctionsTestSuite () {
       }
     },
 
+////////////////////////////////////////////////////////////////////////////////
+/// @brief test reverse function with characters outside the BMP and U+FFFF
+////////////////////////////////////////////////////////////////////////////////
+
+    testReverseKeepsAllCodePoints : function () {
+      // TO_CHAR builds the input, so the client never encodes surrogate pairs
+      let actual = getQueryResults(`
+        LET single = TO_CHAR(65536)
+        LET mixed = CONCAT("a", TO_CHAR(128512), "b", TO_CHAR(65536))
+        LET nonCharacter = CONCAT("a", TO_CHAR(65535), "b")
+        RETURN {
+          single: TO_HEX(REVERSE(single)),
+          singleLength: CHAR_LENGTH(REVERSE(single)),
+          mixed: TO_HEX(REVERSE(mixed)),
+          mixedLength: CHAR_LENGTH(REVERSE(mixed)),
+          nonCharacter: TO_HEX(REVERSE(nonCharacter))
+        }`);
+      assertEqual([{
+        single: "f0908080",
+        singleLength: 1,
+        mixed: "f090808062f09f988061",
+        mixedLength: 4,
+        nonCharacter: "62efbfbf61"
+      }], actual);
+    },
+
 ////////////////////////////////////////////////////////////////////////////////
 /// @brief test reverse function
 ////////////////////////////////////////////////////////////////////////////////
```

#### Recent Merged Pull Requests:
- **PR #23388** (2026-09-30): [COR-745] MATCH overlapping path merge (@bluepal-avanthi-dundigala)
- **PR #23379** (2026-09-29): [BTS-2461] Backport to 3.12.12: do not exit early in insertDistributeInputCalculation (@maierlars)
- **PR #23378** (2026-09-29): AQL queries with sparse MDI indexes accept non-comparison filter conditions (@maierlars)
- **PR #23377** (2026-09-29): AQL REGEX_MATCHES evaluates the regex for empty input strings (@maierlars)
- **PR #23376** (2026-09-29): AQL REVERSE keeps characters above U+FFFF intact (@maierlars)
- **PR #23366** (2026-09-29): Fix use-after-free in jwt-token renewal (@jvolmer)
- **PR #23364** (2026-09-29): Get rid of race in rest dump handler failure point (@jvolmer)
- **PR #23353** (2026-09-29): Fix `SUBSTITUTE` when using empty replacement (@jbajic)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
