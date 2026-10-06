# Forensic Learning Record (Deep Inspection): bridgecrewio/checkov

> **Canonical Artifact**: `07_PROJECT_LEARNING/bridgecrewio-checkov-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/bridgecrewio/checkov](https://github.com/bridgecrewio/checkov))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:05:22.148Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `bridgecrewio/checkov`
- **Description**: Prevent cloud misconfigurations and find vulnerabilities during build-time in infrastructure as code, container images and open source packages with Checkov by Bridgecrew.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 9056 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `checkov/ansible/utils.py`
```
from __future__ import annotations

import logging
import os
import re
from pathlib import Path
from typing import Any, List

from checkov.ansible.graph_builder.graph_components.resource_types import ResourceType
from checkov.common.parallelizer.parallel_runner import parallel_runner
from checkov.common.parsers.yaml.parser import parse
from checkov.common.resource_code_logger_filter import add_resource_code_filter_to_logger
from checkov.common.runners.base_runner import filter_ignored_paths
from checkov.common.util.consts import START_LINE, END_LINE
from checkov.common.util.file_utils import read_file_with_any_encoding
from checkov.common.util.suppression import collect_suppressions_for_context
from checkov.runner_filter import RunnerFilter

TASK_NAME_PATTERN = re.compile(r"^\s*-\s+name:\s+", re.MULTILINE)

# https://docs.ansible.com/ansible/latest/reference_appendices/playbooks_keywords.html#task
TASK_RESERVED_KEYWORDS = {
    "action",
    "any_errors_fatal",
    "args",
    "async",
    "become",
    "become_exe",
    "become_flags",
    "become_method",
    "become_user",
    "changed_when",
    "check_mode",
    "collections",
    "connection",
    "debugger",
    "delay",
    "delegate_facts",
    "delegate_to",
    "diff",
    "environment",
    "failed_when",
    "ignore_errors",
    "ignore_unreachable",
    "local_action",
    "loop",
    "loop_control",
    "module_defaults",
    "name",
    "no_log",
    "notify",
    "poll",
    "port",
    "register",
    "remote_user",
    "retries",
    "run_once",
    "tags",
    "throttle",
    "timeout",
    "until",
    "vars",
    "when",
}

logger = logging.getLogger(__name__)
add_resource_code_filter_to_logger(logger)


def get_scannable_file_paths(root_folder: str | Path) -> set[Path]:
    """Finds yaml files"""

    file_paths: set[Path] = set()

    if root_folder:
        root_path = root_folder if isinstance(root_folder, Path) else Path(root_folder)
        file_paths = {file_path for file_path in root_path.rglob("*.[y][am]*[l]") if file_path.is_file()}

    return file_paths


def get_relevant_file_content(file_path: str | Path) -> str | None:
    if not str(file_path).endswith((".yaml", ".yml")):
        return None

    content = read_file_with_any_encoding(file_path=file_path)
    if "name:" not in content:
        # the following regex will search more precisely, but no need to further process
        return None

    match_task_name = re.search(TASK_NAME_PATTERN, content)
    if match_task_name:
        # there are more files, which belong to an ansible playbook,
        # but we are currently only interested in 'tasks'
        return content

    return None


def parse_file(
    f: str | Path, file_content: str | None = None
) -> tuple[dict[str, Any] | list[dict[str, Any]], list[tuple[int, str]]] | None:
    file_content = get_relevant_file_content(file_path=f)
    if file_content:
        content = parse(filename=str(f), file_content=file_content)
        return content

    return None


def generate_task_name(task: dict[str, Any], prefix: str = "") -> str | None:
    # grab the task name at the beginning before trying to find the actual module name
    task_name = task.get("name") or "unknown"

    for name in task:
        if name in TASK_RESERVED_KEYWORDS:
            continue

        if prefix:
            # if the task is found in a block, then prefix the module name with 'block'
            name = f"{prefix}{name}"

        return f"{ResourceType.TASKS}.{name}.{task_name}"

    return None


def build_definitions_context(
    definitions: dict[str, dict[str, Any] | list[dict[str, Any]]],
    definitions_raw: dict[str, list[tuple[int, str]]],
) -> dict[str, dict[str, Any]]:
    definitions_context: dict[str, dict[str, Any]] = {}

    for file_path, definition in definitions.items():
        file_path_context: dict[str, Any] = {}
        definition_raw = definitions_raw[file_path]

        if not isinstance(definition, list):
            logger.info(f"File {file_path} has the wrong type {type(definition)}")
            continue

        for code_block in definition:
            if ResourceType.TASKS in code_block:
                tasks = code_block[ResourceType.TASKS]
                if tasks:  # Check if tasks is not empty
                    for task in tasks:
                        _process_blocks(definition_raw=definition_raw, file_path_context=file_path_context, task=task)
                else:
                    _process_blocks(definition_raw=definition_raw, file_path_context=file_path_context, task=code_block)
            else:
                _process_blocks(definition_raw=definition_raw, file_path_context=file_path_context, task=code_block)

        definitions_context[file_path] = file_path_context

    return definitions_context


def _process_blocks(
    definition_raw: list[tuple[int, str]],
    file_path_context: dict[str, Any],
    task: Any,
    prefix: str = "",
) -> None:
    """Checks for possible block usage"""

    if not task or not isinstance(task, dict):
        return

    if ResourceType.BLOCK in task and isinstance(task[ResourceType.BLOCK], list):
        prefix += f"{ResourceType.BLOCK}."  # with each nested level an extra block prefix is added
        block_name = f"{prefix}.{task.get('name') or 'unknown'}"
        resource_context = _create_resource_context(definition_raw=definition_raw, resource=task)
        file_path_context[block_name] = resource_context

        for block_task in task[ResourceType.BLOCK]:
            _process_blocks(
                definition_raw=definition_raw, file_path_context=file_path_context, task=block_task, prefix=prefix
            )
    else:
        resource_context = _create_resource_context(definition_raw=definition_raw, resource=task)
        task_name = generate_task_name(task=task, prefix=prefix)
        if task_name:
            file_path_context[task_name] = resource_context


def _create_resource_context(definition_raw: list[tuple[int, str]], resource: dict[str, Any]) -> dict[str, Any]:
    """Creates the resource context block"""

    start_line = resource[START_LINE]
    end_line = resource[END_LINE]
    code_lines = definition_raw[start_line - 1 : end_line - 1]  # lines start with index 0
    skipped_checks = collect_suppressions_for_context(code_lines=code_lines)

    return {
        "start_line": start_line,
        "end_line": end_line - 1,
        "code_lines": code_lines,
        "skipped_checks": skipped_checks,
    }


def create_definitions(
        root_folder: str | None,
        files: list[str] | None = None,
        runner_filter: RunnerFilter | None = None
) -> tuple[dict[str, dict[str, Any]], dict[str, list[tuple[int, str]]]]:
    runner_filter = runner_filter or RunnerFilter()
    definitions: dict[str, dict[str, Any]] = {}
    definitions_raw: dict[str, list[tuple[int, str]]] = {}
    if files:
        create_file_definition(files, definitions, definitions_raw)

    if root_folder:
        for root, d_names, f_names in os.walk(root_folder):
            filter_ignored_paths(root, d_names, runner_filter.excluded_paths)
            filter_ignored_paths(root, f_names, runner_filter.excluded_paths)
            files_to_load = [os.path.join(root, f_name) for f_name in f_names]
            create_file_definition(files_to_load, definitions, definitions_raw)

    return definitions, definitions_raw


def create_file_definition(files_to_load: List[str], definitions: dict[str, dict[str, Any]], definitions_raw: dict[str, list[tuple[int, str]]]) -> None:
    results = parallel_runner.run_function(lambda f: (f, parse_file(f)), files_to_load)
    for file_result_pair in results:
        if file_result_pair is None:
            # this only happens, when an uncaught exception occurs
            continue

        file, result = file_result_pair
        if result:
            (definitions[file], definitions_raw[file]) = result  # type: ignore[assignment]

```

### Core Architecture Module: `checkov/arm/checks/resource/AppServiceFTPSState.py`
```
from checkov.common.models.enums import CheckCategories
from checkov.arm.base_resource_value_check import BaseResourceValueCheck
from typing import List
from typing import Any


class AppServiceFTPSState(BaseResourceValueCheck):
    def __init__(self) -> None:
        name = "Ensure FTP deployments are disabled"
        id = "CKV_AZURE_78"
        supported_resources = ('Microsoft.Web/sites',)
        categories = (CheckCategories.APPLICATION_SECURITY,)
        super().__init__(name=name, id=id, categories=categories, supported_resources=supported_resources)

    def get_inspected_key(self) -> str:
        return "properties/siteConfig/ftpsState"

    def get_expected_value(self) -> Any:
        return "Disabled"

    def get_expected_values(self) -> List[Any]:
        return ["Disabled", "FtpsOnly"]


check = AppServiceFTPSState()

```

### Core Architecture Module: `checkov/arm/checks/resource/StorageAccountLoggingQueueServiceEnabled.py`
```
from __future__ import annotations

from typing import Any, List

from checkov.common.models.enums import CheckResult, CheckCategories
from checkov.arm.base_resource_check import BaseResourceCheck


class StorageAccountLoggingQueueServiceEnabled(BaseResourceCheck):
    def __init__(self) -> None:
        # https://docs.microsoft.com/en-us/azure/templates/microsoft.storage/storageaccounts
        # https://docs.microsoft.com/en-us/azure/templates/microsoft.storage/storageaccounts/queueservices
        # https://github.com/MicrosoftDocs/azure-docs/issues/13195
        # This check is only relevant for storageAccounts with Queue Service enabled

        # properties.networkAcls.bypass == "AzureServices"
        # Fail if apiVersion less than 2017 as this setting wasn't available
        name = "Ensure Storage logging is enabled for Queue service for read, write and delete requests"
        id = "CKV_AZURE_33"
        supported_resources = ('Microsoft.Storage/storageAccounts/queueServices/providers/diagnosticsettings',)
        categories = (CheckCategories.LOGGING,)
        super().__init__(name=name, id=id, categories=categories, supported_resources=supported_resources)

    def scan_resource_conf(self, conf: dict[str, Any]) -> CheckResult:
        if "properties" in conf:
            if "logs" in conf["properties"]:
                if conf["properties"]["logs"]:
                    storage = {}
                    for log in conf["properties"]["logs"]:
                        if "category" in log and "enabled" in log:
                            if str(log["enabled"]).lower() == "true":
                                storage[log["category"]] = True
                    if "StorageRead" in storage.keys() and \
                            "StorageWrite" in storage.keys() and \
                            "StorageDelete" in storage.keys():
                        if storage["StorageRead"] and storage["StorageWrite"] and storage["StorageDelete"]:
                            return CheckResult.PASSED
        return CheckResult.FAILED

    def get_evaluated_keys(self) -> List[str]:
        return ['properties', 'properties/logs']


check = StorageAccountLoggingQueueServiceEnabled()

```

### Core Architecture Module: `checkov/arm/utils.py`
```
from __future__ import annotations

import logging
import os
from enum import Enum
from typing import Iterable, Callable, Any
from collections.abc import Collection
from pathlib import Path

from checkov.arm.parser.parser import parse
from checkov.common.output.report import Report
from checkov.common.runners.base_runner import filter_ignored_paths
from checkov.common.util.data_structures_utils import pickle_deepcopy
from checkov.runner_filter import RunnerFilter

ARM_POSSIBLE_ENDINGS = [".json"]


class ArmElements(str, Enum):
    OUTPUTS = "outputs"
    PARAMETERS = "parameters"
    RESOURCES = "resources"
    VARIABLES = "variables"

    def __str__(self) -> str:
        # needed, because of a Python 3.11 change
        return self.value


def get_scannable_file_paths(root_folder: str | None = None, excluded_paths: list[str] | None = None) -> set[str]:
    """Finds ARM files"""

    file_paths: "set[str]" = set()
    if not root_folder:
        return file_paths

    for root, d_names, f_names in os.walk(root_folder):
        filter_ignored_paths(root, d_names, excluded_paths)
        filter_ignored_paths(root, f_names, excluded_paths)
        for file in f_names:
            file_ending = os.path.splitext(file)[1]
            if file_ending in ARM_POSSIBLE_ENDINGS:
                file_paths.add(os.path.join(root, file))

    return file_paths


def create_definitions(
    root_folder: str,
    files: Collection[Path] | None = None,
    runner_filter: RunnerFilter | None = None,
) -> tuple[dict[str, dict[str, Any]], dict[str, list[tuple[int, str]]]]:
    definitions: dict[str, dict[str, Any]] = {}
    definitions_raw: dict[str, list[tuple[int, str]]] = {}
    parsing_errors: list[str] = []
    runner_filter = runner_filter or RunnerFilter()

    if root_folder:
        file_paths = get_scannable_file_paths(root_folder, runner_filter.excluded_paths)
        definitions, definitions_raw, parsing_errors = get_files_definitions(files=file_paths)

    if parsing_errors:
        logging.warning(f"[arm] found errors while parsing definitions: {parsing_errors}")

    return definitions, definitions_raw


def get_files_definitions(
        files: Iterable[str],
        filepath_fn: Callable[[str], str] | None = None,
) -> tuple[dict[str, dict[str, Any]], dict[str, list[tuple[int, str]]], list[str]]:
    """Parses ARM files into its definitions and raw data"""

    definitions = {}
    definitions_raw = {}
    parsing_errors = []

    for file in files:
        result = parse(file)

        definition, definition_raw = result
        if definition is not None and definition_raw is not None:  # this has to be a 'None' check
            path = filepath_fn(file) if filepath_fn else file
            definitions[path] = definition
            definitions_raw[path] = definition_raw
        else:
            parsing_errors.append(os.path.normpath(file))

    return definitions, definitions_raw, parsing_errors


def extract_resource_name_from_resource_id_func(resource_id: str) -> str:
    '''
        Examples:
            resourceId('Microsoft.Network/virtualNetworks/', virtualNetworkName) -> virtualNetworkName
    '''
    return clean_string(resource_id.split(',')[1].split(')')[0])


def extract_resource_name_from_reference_func(reference: str) -> str:
    '''
        Examples:
                reference('storageAccountName') -> storageAccountName
                reference('myStorage').primaryEndpoints -> myStorage
                reference('myStorage', '2022-09-01', 'Full').location -> myStorage
                reference(resourceId('storageResourceGroup', 'Microsoft.Storage/storageAccounts', 'storageAccountName')), '2022-09-01') -> storageAccountName
                reference(resourceId('Microsoft.Network/publicIPAddresses', 'ipAddressName')) -> ipAddressName
    '''
    resource_name = ')'.join(reference.split('reference(', 1)[1].split(')')[:-1])
    if 'resourceId' in resource_name:
        return clean_string(
            ''.join(resource_name.split('resourceId(', 1)[1].split(')')[0]).split(',')[-1])
    else:
        return clean_string(resource_name.split(',')[0].split('/')[-1])


def clean_string(input: str) -> str:
    return input.replace("'", '').replace(" ", "")


def clean_file_path(file_path: Path) -> Path:
    path_parts = [part for part in file_path.parts if part not in (".", "..")]

    return Path(*path_parts)


def filter_failed_checks_with_unrendered_resources(report: Report) -> Report:
    """Returns a new report with filtered checks instead of modifying the original"""
    arm_function_patterns = ['toLower(', 'trim(', 'join(', 'split(', 'substring(']

    filtered_report = pickle_deepcopy(report)
    filtered_report.failed_checks = [
        check for check in report.failed_checks
        if not any(func in str(check.resource) for func in arm_function_patterns)
    ]

    return filtered_report

```

### Core Architecture Module: `checkov/azure_pipelines/common/resource_id_utils.py`
```
from __future__ import annotations

from typing import Any, Dict, List

from checkov.common.util.consts import START_LINE, END_LINE


def _get_resource_from_code_block(start_line: int, end_line: int, block_to_inspect: dict[str, Any], inspected_key: str | None) -> str | None:
    if block_to_inspect[START_LINE] <= start_line <= end_line <= block_to_inspect[END_LINE]:
        block_name = block_to_inspect.get('displayName',
                                          block_to_inspect.get('name',
                                                               block_to_inspect.get('job',
                                                                                    block_to_inspect.get('stage',
                                                                                                         False))))
        inspected_key = f'{inspected_key}({block_name})' if block_name else inspected_key
        if block_to_inspect[START_LINE] == start_line:
            return inspected_key
        return generate_resource_key_recursive(start_line, end_line, block_to_inspect, resource_key=inspected_key)
    return None


def generate_resource_key_recursive(start_line: int, end_line: int,
                                    file_conf: Dict[str, Any] | List[Dict[str, Any]], resource_key: str | None = None
                                    ) -> str | None:
    if not isinstance(file_conf, dict):
        return resource_key

    for code_block_name, code_block in file_conf.items():
        if isinstance(code_block, dict):
            new_key = f'{resource_key}.{code_block_name}' if resource_key else code_block_name
            resource = _get_resource_from_code_block(start_line, end_line, code_block, new_key)
            if resource:
                return resource
        elif isinstance(code_block, list):
            for index, item in enumerate(code_block):
                if isinstance(item, dict):
                    resource_key_to_inspect = f'{resource_key}.{code_block_name}[{index}]' if resource_key else f'{code_block_name}[{index}]'
                    resource = _get_resource_from_code_block(start_line, end_line, item, resource_key_to_inspect)
                    if resource:
                        return resource
    return resource_key

```

### Core Architecture Module: `checkov/bicep/utils.py`
```
from __future__ import annotations

import logging
import os
import re
from collections.abc import Collection
from pathlib import Path
from typing import TYPE_CHECKING

from checkov.common.runners.base_runner import filter_ignored_paths
from checkov.runner_filter import RunnerFilter
from checkov.bicep.parser import Parser

if TYPE_CHECKING:
    from pycep.typing import BicepJson


BICEP_POSSIBLE_ENDINGS = [".bicep"]
BICEP_START_LINE = "__start_line__"
BICEP_END_LINE = "__end_line__"


def get_scannable_file_paths(
    root_folder: str | Path | None = None, files: list[str] | None = None, excluded_paths: list[str] | None = None
) -> set[Path]:
    """Finds Bicep files"""

    file_paths: set[Path] = set()

    if root_folder:
        root_path = Path(root_folder)
        file_paths = {file_path for file_path in root_path.rglob("*.bicep") if file_path.is_file()}

        if excluded_paths:
            compiled = [re.compile(p.replace(".terraform", r"\.terraform")) for p in excluded_paths]
            file_paths = {
                file_path for file_path in file_paths if not any(pattern.search(str(file_path)) for pattern in compiled)
            }
    if files:
        for file in files:
            if file.endswith(".bicep"):
                file_paths.add(Path(file))

    return file_paths


def clean_file_path(file_path: Path) -> Path:
    path_parts = [part for part in file_path.parts if part not in (".", "..")]

    return Path(*path_parts)


def get_folder_definitions(
    root_folder: str, excluded_paths: list[str] | None
) -> tuple[dict[Path, BicepJson], dict[Path, list[tuple[int, str]]], list[str]]:
    files_list: set[Path] = set()
    for root, d_names, f_names in os.walk(root_folder):
        filter_ignored_paths(root, d_names, excluded_paths)
        filter_ignored_paths(root, f_names, excluded_paths)
        for file in f_names:
            file_ending = os.path.splitext(file)[1]
            if file_ending in BICEP_POSSIBLE_ENDINGS:
                full_path = os.path.join(root, file)
                files_list.add(Path(full_path))
    parser = Parser()

    return parser.get_files_definitions(files_list)


def create_definitions(
    root_folder: str,
    files: "Collection[Path] | None" = None,
    runner_filter: RunnerFilter | None = None,
) -> tuple[dict[Path, BicepJson], dict[Path, list[tuple[int, str]]]]:
    definitions: dict[Path, BicepJson] = {}
    definitions_raw: dict[Path, list[tuple[int, str]]] = {}
    parsing_errors: list[str] = []
    runner_filter = runner_filter or RunnerFilter()

    if files:
        parser = Parser()
        definitions, definitions_raw, parsing_errors = parser.get_files_definitions(file_paths=files)

    if root_folder:
        definitions, definitions_raw, parsing_errors = get_folder_definitions(root_folder, runner_filter.excluded_paths)

    if parsing_errors:
        logging.warning(f"[bicep] found errors while parsing definitions: {parsing_errors}")

    return definitions, definitions_raw

```

### Core Architecture Module: `checkov/cloudformation/cfn_utils.py`
```
from __future__ import annotations

import logging
import os
from typing import Optional, List, Tuple, Dict, Any, Callable

import dpath

from checkov.cloudformation.checks.resource.base_registry import Registry
from checkov.cloudformation.checks.resource.registry import cfn_registry
from checkov.cloudformation.context_parser import ContextParser, ENDLINE, STARTLINE
from checkov.cloudformation.parser import parse, TemplateSections
from checkov.common.parallelizer.parallel_runner import parallel_runner
from checkov.common.parsers.node import DictNode, StrNode
from checkov.common.runners.base_runner import filter_ignored_paths
from checkov.runner_filter import RunnerFilter
from checkov.common.models.consts import YAML_COMMENT_MARK
from checkov.common.util.data_structures_utils import pickle_deepcopy

CF_POSSIBLE_ENDINGS = frozenset((".yml", ".yaml", ".json", ".template"))
TAG_FIELD_NAMES = ("Key", "Value")


def get_resource_tags(entity: dict[str, dict[str, Any]], registry: Registry = cfn_registry) -> Optional[Dict[str, str]]:
    entity_details = registry.extract_entity_details(entity)

    if not entity_details:
        return None

    entity_config = entity_details[-1]

    if not isinstance(entity_config, dict):
        return None

    try:
        properties = entity_config.get("Properties")
        if properties:
            tags = properties.get("Tags")
            if tags:
                return parse_entity_tags(tags)
    except Exception:
        logging.warning(f"Failed to parse tags for entity {entity}")

    return None


def parse_entity_tags(tags: Any) -> dict[str, str] | None:
    if isinstance(tags, list):
        tag_dict = {
            get_entity_value_as_string(tag["Key"]): get_entity_value_as_string(tag["Value"])
            for tag in tags
            if all(field in tag for field in TAG_FIELD_NAMES)
        }
        return tag_dict
    elif isinstance(tags, dict):
        tag_dict = {
            get_entity_value_as_string(key): get_entity_value_as_string(value)
            for key, value in tags.items()
            if key not in (STARTLINE, ENDLINE)
        }
        return tag_dict
    return None


def get_entity_value_as_string(value: Any) -> str:
    """
    Handles different type of entities with possible CFN function substitutions. Returns the simplest possible string value
    (without performing any function calls).

    Examples:
    Key: Value  # returns simple string

    Key: !Ref ${AWS::AccountId}-data  # returns ${AWS::AccountId}-data

    Key:
    - ${account}-data
    - account: !Ref ${AWS::AccountId}

    # returns ${account}-data

    :param value:
    :return:
    """
    if isinstance(value, dict):
        (function, value) = next(iter(value.items()))
        # If the value is a long-form function, then the first element is the template string (technically str_node)
        # Otherwise the dict value is the template string
        if isinstance(value, list):
            if "Join" in function:
                # Join looks like !Join [, [V1, V2, V3]]
                join_str = str(value[0])
                return join_str.join([str(v) for v in value[1]])
            else:
                return str(value[0])
        else:
            return str(value)
    else:
        return str(value)


def get_folder_definitions(
        root_folder: str, excluded_paths: list[str] | None, out_parsing_errors: dict[str, str] | None = None
) -> tuple[dict[str, dict[str, Any]], dict[str, list[tuple[int, str]]]]:
    out_parsing_errors = {} if out_parsing_errors is None else out_parsing_errors
    files_list = []
    for root, d_names, f_names in os.walk(root_folder):
        filter_ignored_paths(root, d_names, excluded_paths)
        filter_ignored_paths(root, f_names, excluded_paths)
        for file in f_names:
            file_ending = os.path.splitext(file)[1]
            if file_ending in CF_POSSIBLE_ENDINGS:
                files_list.append(os.path.join(root, file))

    definitions, definitions_raw = get_files_definitions(files_list, out_parsing_errors)
    return definitions, definitions_raw


def build_definitions_context(
        definitions: dict[str, dict[str, Any]], definitions_raw: Dict[str, List[Tuple[int, str]]]
) -> Dict[str, Dict[str, Any]]:
    definitions_context: Dict[str, Dict[str, Any]] = {}
    # iterate on the files
    for file_path, file_path_definitions in definitions.items():
        # iterate on the definitions (Parameters, Resources, Outputs...)
        for file_path_definition, definition in file_path_definitions.items():
            if (
                    isinstance(file_path_definition, StrNode)
                    and file_path_definition.upper() in TemplateSections.__members__
                    and isinstance(definition, DictNode)
            ):
                # iterate on the actual objects of each definition
                for attribute, attr_value in definition.items():
                    if isinstance(attr_value, DictNode):
                        start_line = attr_value.start_mark.line
                        end_line = attr_value.end_mark.line
                        # fix lines number for yaml and json files
                        first_line_index = 0
                        while not str.strip(definitions_raw[file_path][first_line_index][1]):
                            first_line_index += 1
                        # check if the file is a json file
                        if str.strip(definitions_raw[file_path][first_line_index][1])[0] == "{":
                            start_line += 1
                            end_line += 1
                        else:
                            # add resource comments to definition lines
                            current_line = str.strip(definitions_raw[file_path][start_line - 1][1])
                            while not current_line or current_line[0] == YAML_COMMENT_MARK:
                                start_line -= 1
                                current_line = str.strip(definitions_raw[file_path][start_line - 1][1])

                            # remove next resource comments from definition lines
                            current_line = str.strip(definitions_raw[file_path][end_line - 1][1])
                            while not current_line or current_line[0] == YAML_COMMENT_MARK:
                                end_line -= 1
                                current_line = str.strip(definitions_raw[file_path][end_line - 1][1])

                        code_lines = definitions_raw[file_path][start_line - 1: end_line]
                        dpath.new(
                            definitions_context,
                            [file_path, str(file_path_definition), str(attribute)],
                            {"start_line": start_line, "end_line": end_line, "code_lines": code_lines},
                        )
                        if file_path_definition.upper() == TemplateSections.RESOURCES.value.upper():
                            skipped_checks = ContextParser.collect_skip_comments(
                                entity_code_lines=code_lines,
                                resource_config=attr_value,
                            )
                            dpath.new(
                                definitions_context,
                                [file_path, str(file_path_definition), str(attribute), "skipped_checks"],
                                skipped_checks,
                            )
    return definitions_context


def create_definitions(
        root_folder: str | None,
        files: list[str] | None = None,
        runner_filter: RunnerFilter | None = None,
        out_parsing_errors: dict[str, str] | None = None
) -> tuple[dict[str, dict[str, Any]], dict[str, list[tuple[int, str]]]]:
    runner_filter = runner_filter or RunnerFilter()
    out_parsing_errors = {} if out_parsing_errors is None else out_parsing_errors
    definitions: dict[str, dict[str, Any]] = {}
    definitions_raw: dict[str, list[tuple[int, str]]] = {}
    if files:
        files_list = [file for file in files if os.path.splitext(file)[1] in CF_POSSIBLE_ENDINGS]
        definitions, definitions_raw = get_files_definitions(files_list, out_parsing_errors)

    if root_folder:
        definitions, definitions_raw = get_folder_definitions(root_folder, runner_filter.excluded_paths,
                                                              out_parsing_errors)

    return definitions, definitions_raw


def get_files_definitions(
    files: List[str], out_parsing_errors: Dict[str, str], filepath_fn: Callable[[str], str] | None = None
) -> tuple[dict[str, dict[str, Any]], dict[str, list[tuple[int, str]]]]:
    results = parallel_runner.run_function(_parse_file, files)

    definitions = {}
    definitions_raw = {}
    for file, parse_result, parsing_errors in results:
        out_parsing_errors.update(parsing_errors)
        path = filepath_fn(file) if filepath_fn else file
        try:
            template, template_lines = parse_result
            if isinstance(template, dict) and isinstance(template.get("Resources"), dict) and isinstance(template_lines, list):
                if validate_properties_in_resources_are_dict(template):
                    template = enrich_resources_with_globals(template)
                    definitions[path] = template
                    definitions_raw[path] = template_lines
                else:
                    out_parsing_errors.update({file: 'Resource Properties is not a dictionary'})
            else:
                if parsing_errors:
                    logging.debug(f'File {file} had the following parsing errors: {parsing_errors}')
                logging.debug(f"Parsed file {file} incorrectly {template}")
        except (TypeError, ValueError):
            logging.warning(f"CloudFormation skipping {file} as it is not a valid CF template")
            continue

    return definitions, definitions_raw


def _parse_file(
    file: str
) -> tuple
```

### Core Architecture Module: `checkov/cloudformation/checks/resource/aws/LambdaFunctionLevelConcurrentExecutionLimit.py`
```
from typing import Any

from checkov.cloudformation.checks.resource.base_resource_value_check import BaseResourceValueCheck
from checkov.common.models.consts import ANY_VALUE
from checkov.common.models.enums import CheckCategories


class LambdaFunctionLevelConcurrentExecutionLimit(BaseResourceValueCheck):
    def __init__(self) -> None:
        name = "Ensure that AWS Lambda function is configured for function-level concurrent execution limit"
        id = "CKV_AWS_115"
        supported_resources = ("AWS::Lambda::Function", "AWS::Serverless::Function")
        categories = (CheckCategories.GENERAL_SECURITY,)
        super().__init__(name=name, id=id, categories=categories, supported_resources=supported_resources)

    def get_inspected_key(self) -> str:
        return "Properties/ReservedConcurrentExecutions"

    def get_expected_value(self) -> Any:
        return ANY_VALUE


check = LambdaFunctionLevelConcurrentExecutionLimit()

```

### Core Architecture Module: `checkov/cloudformation/checks/resource/aws/SQSQueueEncryption.py`
```
from typing import Any

from checkov.common.models.enums import CheckCategories
from checkov.cloudformation.checks.resource.base_resource_value_check import BaseResourceValueCheck
from checkov.common.models.consts import ANY_VALUE


class SQSQueueEncryption(BaseResourceValueCheck):
    def __init__(self) -> None:
        name = "Ensure all data stored in the SQS queue is encrypted"
        id = "CKV_AWS_27"
        supported_resources = ['AWS::SQS::Queue']
        categories = [CheckCategories.ENCRYPTION]
        super().__init__(name=name, id=id, categories=categories, supported_resources=supported_resources)

    def get_inspected_key(self) -> str:
        return 'Properties/KmsMasterKeyId'

    def get_expected_value(self) -> Any:
        return ANY_VALUE


check = SQSQueueEncryption()

```

### Core Architecture Module: `checkov/cloudformation/checks/utils/iam_cloudformation_document_to_policy_converter.py`
```
from __future__ import annotations

from typing import Any

from checkov.common.util.data_structures_utils import pickle_deepcopy


def convert_cloudformation_conf_to_iam_policy(conf: dict[str, Any]) -> dict[str, Any]:
    """
        converts terraform parsed configuration to iam policy document
    """
    result = pickle_deepcopy(conf)
    if "Statement" in result.keys():
        result["Statement"] = result.pop("Statement")
        for statement in map(dict, result["Statement"]):
            if "Action" in statement:
                statement["Action"] = str(statement.pop("Action")[0])
            if "Resource" in statement:
                resources = statement.pop("Resource")
                if isinstance(resources, list):
                    statement["Resource"] = str(resources[0])
                else:
                    statement["Resource"] = str(resources)
            if "NotAction" in statement:
                statement["NotAction"] = str(statement.pop("NotAction")[0])
            if "NotResource" in statement:
                not_resources = statement.pop("NotResource")
                if isinstance(not_resources, list):
                    statement["NotResource"] = str(not_resources[0])
                else:
                    statement["NotResource"] = str(not_resources)
            if "Effect" in statement:
                statement["Effect"] = str(statement.pop("Effect"))
            if "Effect" not in statement:
                statement["Effect"] = "Allow"
    return result

```

### Core Architecture Module: `checkov/common/sca/reachability/package_alias_mapping/nodejs/utils.py`
```
from __future__ import annotations

import logging
import os.path
from json import JSONDecodeError
from typing import Dict, Set, Any
import re
import json
import os


MODULE_EXPORTS_PATTERN = r'module\.exports\s*=\s*({.*?});'
EXPORT_DEFAULT_PATTERN = r'export\s*default\s*({.*?});'


def load_json_with_comments(json_str: str) -> Any:
    # Regular expression to remove comments (both single line and multi-line)
    pattern = r'(?<!\\)(["\'])(?:(?=(\\?))\2.)*?\1|//.*?$|/\*[\s\S]*?\*/'
    regex = re.compile(pattern, re.MULTILINE)
    clean_json_str = regex.sub(lambda match: match.group(0) if match.group(1) else '', json_str)
    return json.loads(clean_json_str)


def _parse_export(file_content: str, pattern: str) -> Dict[str, Any] | None:
    module_export_match = re.search(pattern, file_content, re.DOTALL)

    if module_export_match:
        module_exports_str = module_export_match.group(1)
        # for having for all the keys and values double quotes and removing spaces
        module_exports_str = re.sub(r'\s+', '', re.sub(r'([{\s,])(\w+):', r'\1"\2":', module_exports_str)
                                    .replace("'", "\""))
        module_exports: Dict[str, Any] = json.loads(module_exports_str)
        return module_exports
    return None


def parse_webpack_file(file_content: str, relevant_packages: Set[str]) -> Dict[str, Any]:
    output: Dict[str, Any] = {"packageAliases": {}}
    module_exports_json = _parse_export(file_content, MODULE_EXPORTS_PATTERN)
    if module_exports_json:
        aliases = module_exports_json.get("resolve", {}).get("alias", {})
        for imported_name in aliases:
            package_name = aliases[imported_name]
            if package_name in relevant_packages:
                output["packageAliases"].setdefault(package_name, {"packageAliases": []})["packageAliases"].append(imported_name)
    return output


def parse_tsconfig_file(file_content: str, relevant_packages: Set[str]) -> Dict[str, Any]:
    output: Dict[str, Any] = {"packageAliases": {}}
    tsconfig_json = load_json_with_comments(file_content)
    paths = tsconfig_json.get("compilerOptions", {}).get("paths", {})
    for imported_name in paths:
        for package_relative_path in paths[imported_name]:
            package_name = os.path.basename(package_relative_path)
            if package_name in relevant_packages:
                output["packageAliases"].setdefault(package_name, {"packageAliases": []})["packageAliases"].append(imported_name)
    return output


def parse_babel_file(file_content: str, relevant_packages: Set[str]) -> Dict[str, Any]:
    output: Dict[str, Any] = {"packageAliases": {}}
    babelrc_json = load_json_with_comments(file_content)
    plugins = babelrc_json.get("plugins", {})
    for plugin in plugins:
        if len(plugin) > 1:
            plugin_object = plugin[1]
            aliases = plugin_object.get("alias", {})
            for imported_name in aliases:
                package_name = aliases[imported_name]
                if package_name in relevant_packages:
                    output["packageAliases"].setdefault(package_name, {"packageAliases": []})["packageAliases"].append(imported_name)
    return output


def parse_rollup_file(file_content: str, relevant_packages: Set[str]) -> Dict[str, Any]:
    output: Dict[str, Any] = {"packageAliases": {}}
    export_default_match = re.search(EXPORT_DEFAULT_PATTERN, file_content, re.DOTALL)
    if export_default_match:
        export_default_str = export_default_match.group(1)
        # for having for all the keys and values double quotes and removing spaces
        export_default_str = re.sub(r'\s+', '', re.sub(r'([{\s,])(\w+):', r'\1"\2":', export_default_str)
                                    .replace("'", "\""))

        # Defining a regular expression pattern to match the elements within the "plugins" list
        pattern = r'alias\(\{[^)]*\}\)'
        matches = re.findall(pattern, export_default_str)

        for alias_object_str in matches:
            alias_object = json.loads(alias_object_str[6:-1])  # removing 'alias(' and ')'
            for entry in alias_object.get("entries", []):
                package_name = entry["replacement"]
                if entry["replacement"] in relevant_packages:
                    imported_name = entry["find"]
                    output["packageAliases"].setdefault(package_name, {"packageAliases": []})["packageAliases"].append(imported_name)
    return output


def parse_package_json_file(file_content: str, relevant_packages: Set[str]) -> Dict[str, Any]:
    output: Dict[str, Any] = {"packageAliases": {}}
    try:
        package_json = load_json_with_comments(file_content)
    except JSONDecodeError:
        logging.warning('unable to parse package json file')
        return output

    aliases: Dict[str, str] = dict()
    if "alias" in package_json:
        aliases.update(package_json["alias"])
    if package_json.get("aliasify", {}).get("aliases"):
        aliases.update(package_json["aliasify"]["aliases"])
    for imported_name in aliases:
        package_name = aliases[imported_name]
        if package_name in relevant_packages:
            output["packageAliases"].setdefault(package_name, {"packageAliases": []})["packageAliases"].append(imported_name)
    return output


def parse_snowpack_file(file_content: str, relevant_packages: Set[str]) -> Dict[str, Any]:
    output: Dict[str, Any] = {"packageAliases": {}}
    module_exports_json = _parse_export(file_content, MODULE_EXPORTS_PATTERN)
    if module_exports_json:
        aliases = module_exports_json.get("alias", {})
        for imported_name in aliases:
            package_name = aliases[imported_name]
            if package_name in relevant_packages:
                if package_name in relevant_packages:
                    output["packageAliases"].setdefault(package_name, {"packageAliases": []})["packageAliases"].append(imported_name)
    return output


def parse_vite_file(file_content: str, relevant_packages: Set[str]) -> Dict[str, Any]:
    output: Dict[str, Any] = {"packageAliases": {}}
    export_default_match = _parse_export(file_content, EXPORT_DEFAULT_PATTERN)
    if export_default_match:
        aliases = export_default_match.get("resolve", {}).get("alias", {})
        for imported_name in aliases:
            package_name = aliases[imported_name]
            if package_name in relevant_packages:
                output["packageAliases"].setdefault(package_name, {"packageAliases": []})["packageAliases"].append(imported_name)
    return output

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5928** (2025-01-06): **Lot of checks have a misleading title : "Ensure Codecommit associates an approval rule"**
  *Symptoms*: **Describe the issue** I am working on checkov tool rollout on our infrastruture. I want to analyse the Docs to prioritize the checks based on our context. On the documentation [Policy Index](https://github.com/bridgecrewio/checkov/blob/main/docs/5.Policy%20Index/terraform.md)  There is a lot of checks with misleading Policy Title.    **Examples** In Terraform Checks Doc : https://github.com/bridgecrewio/checkov/blob/main/docs/5.Policy%20Index/terraform.md There is more than 500 checks with the title "Ensure Codecommit associates an approval rule" .  Is this normal ? Or this is an error in documentation generation ?   **Version (please complete the following information):**  - Checkov Version :  Latest  **Additional context** Add any other context about the problem here. 
  **Post-Mortem & Fix Analysis**:
  > Not normal, bug in generation i imagine.
  > Thx, you think this may be resolved rapidly or it will takes longer time to be resolved ?
  > Hello, Any new about this bug ?

- **Issue #5742** (2023-11-21): **Chekov GitHub Actions Workflow Schema Outdated & not Scanning**
  *Symptoms*: **Describe the issue** When running checkov, various GH workflow files are being ignored. After doing some digging, it looks like the [actions workflow schema](https://github.com/bridgecrewio/checkov/blob/4875adc472f409bc7039a879347b404468e88215/checkov/github_actions/schemas.py#L657) is outdated. Any workflow that contains the [run-name](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#run-name) property is not scanned. Adding this property to the schema on my local install fixes this.   I also did some more digging to see if there are other outdated properties in this schema since it looks like it has not been updated in about a year, and I found a few probably worth mentioning.   - The `check_suit` event trigger should only have `completed` as an activity type, not [these](https://github.com/bridgecrewio/checkov/blob/4875adc472f409bc7039a879347b404468e88215/checkov/github_actions/schemas.py#L1648) 3. Here are the [GitHub docs](https://docs.github.com/en/enterprise-cloud@latest/actions/using-workflows/events-that-trigger-workflows#check_suite). -  I don’t think [member events](https://github.com/bridgecrewio/checkov/blob/4875adc472f409bc7039a879347b404468e88215/checkov/github_actions/schemas.py#L1821) can trigger workflows anymore. - I don't think `project` events can trigger a workflow on `update` events. Here are the [GitHub docs](https://docs.github.com/en/enterprise-cloud@latest/actions/using-workflows/events-that-trigger-work
  **Post-Mortem & Fix Analysis**:
  > Hi @bakosa, thank you for reaching out with this issue.  It is indeed looks like a case Checkov doesn't support, and it seems like you've found the right spots in code that should be addressed. How do you feel about contributing a PR with the solution? 😄  
  > Fixed by @bakosa 😄 

- **Issue #4333** (2023-02-06): **broken links in policy index**
  *Symptoms*: https://www.checkov.io/5.Policy%20Index/all.html  782 links to files directly in [`main/checkov/terraform/checks/graph_checks/`](https://github.com/bridgecrewio/checkov/tree/main/checkov/terraform/checks/graph_checks) (missing the provider subdirectories before the direct file name)  ---  unrelated, it'd also be nice if all policy index links were clickable as well
  **Post-Mortem & Fix Analysis**:
  > hey @PatMyron thanks for reaching out. Nice catch 🥇 should be no problem to add the provider to the link. For the link I need to check, where exactly the docs are generated 🧐 

- **Issue #4278** (2023-05-16): **Suppression is failing for docker graph checks**
  *Symptoms*: On an M1 mac:  Cant suppress any of the CKV2_DOCKER issues:  In the following dockerfile we have a violation of CKV2_DOCKER_2 and a suppression of it: ``` FROM arm64v8/alpine:3.17.1 # checkov:skip=CKV_DOCKER_3: Not a service # checkov:skip=CKV_DOCKER_2: Not a service # checkov:skip=CKV2_DOCKER_2: Not a service  RUN apk --no-cache add build-base git curl jq bash RUN curl -s -k https://api.github.com/repos/bridgecrewio/yor/releases/latest | jq '.assets[] | select(.name | contains("linux_arm64")) | select(.content_type | contains("gzip")) | .browser_download_url' -r | awk '{print "curl -L -k " $0 " -o /usr/bin/yor.tar.gz"}' | sh RUN tar -xf /usr/bin/yor.tar.gz -C /usr/bin/ && rm /usr/bin/yor.tar.gz && chmod +x /usr/bin/yor && echo 'alias yor="/usr/bin/yor"' >> ~/.bashrc COPY entrypoint.sh /entrypoint.sh  # Code file to execute when the docker container starts up (`entrypoint.sh`) ENTRYPOINT ["/entrypoint.sh"] ```  The latest checkov- -2.2.278 gives us: ` check: CKV2_DOCKER_2: "Ensure that certificate validation isn't disabled with curl"         FAILED for resource: /Dockerfile.RUN         File: /Dockerfile:7-7                  7 | RUN curl -s -k https://api.github.com/repos/bridgecrewio/yor/releases/latest | jq '.assets[] | select(.name | contains("linux_386")) | select(.content_type | contains("gzip")) | .browser_download_url' -r | awk '{print "curl -L -k " $0 " -o /usr/bin/yor.tar.gz"}' | sh   `
  **Post-Mortem & Fix Analysis**:
  > I also stumbled upon this issue.   After a bit of code review it looks like `checkov\dockerfile\runner.py` contains code for skipping checks implemented in python (see `checkov\dockerfile\runner.py:142`) using comments, but similar code for graph checks seems to be missing.  `checkov\dockerfile\runner.py:211` calls `BaseRunner.run_graph_checks_results(...)` which relies on the `runner_filter` to decide which result to include in the return value. A quick scan of the `RunnerFilter` class didn't come up with anything related to checking suppression comments in the scanned file. So it looks like the functionality to skip yaml based policies in dockerfiles is missing.  Maybe these findings help you to get to the core of the issue faster.

- **Issue #3551** (2022-09-22): **docs(general): Fix TOC rendering issue on checkov.io**
  *Symptoms*: **By submitting this pull request, I confirm that my contribution is made under the terms of the Apache 2.0 license.**  ## Title Fix TOC rendering issue on checkov.io  ## Description  Rendering doesn't like 4 layers of markdown titles on our current stylesheets  ## Checklist:  - [X] My code follows the style guidelines of this project - [X] I have performed a self-review of my own code - [X] I have commented my code, particularly in hard-to-understand areas - [X] I have made corresponding changes to the documentation - [X] I have added tests that prove my feature, policy, or fix is effective and works - [X] New and existing tests pass locally with my changes - [X] Any dependent changes have been merged and published in downstream modules 
  **Post-Mortem & Fix Analysis**:
  > @gruebel @schosterbarak Could one of you approve my humongous chunk of a code change? 😂 

- **Issue #3475** (2022-11-16): **Prisma Policy Labels not working**
  *Symptoms*: **Description**  At the company I work at we are using Checkov together with Prisma Cloud Code Security, and I'm having trouble using the policy labels in Prisma to filter checks.  On Prisma's side, I've added a label to the "Default namespace is used" policy check called "mikko-testaa". ![image](https://user-images.githubusercontent.com/35505856/188586726-f6b34b89-58fd-425a-8927-954af6fe7222.png)  Filtering on Prisma via this label works, as it only shows the namespace policy check. ![image](https://user-images.githubusercontent.com/35505856/188586865-2bcbec64-178f-46df-92d8-45025864267b.png)  **Execution and Results**  With that in mind these are the checkov commands that I used both locally and on Jenkins; checkov -d . --framework helm -o json --output-file-path . --prisma-api-url [PRISMAURL] --bc-api-key [PRISMAUSER::PRISMAKEY]] --policy-metadata-filter policy.label=mikko-testaa  I tried running as-is and also running via a config file, both returning the same result; ![image](https://user-images.githubusercontent.com/35505856/188587531-7377bffb-65e6-4f8c-8518-4dccbb18672e.png)  Have I misunderstood the policy-metadata-filter parameter? What am I doing wrong?  **Version** Checkov version 2.1.179
  **Post-Mortem & Fix Analysis**:
  > The fact that the Available options: shows empty makes me think there is something wrong with getting policies from prisma?
  > Hey @MikkoMyllyniemi I haven't been able to reproduce this issue. I applied a similar label to the poicy and it worked as expected.  ``` ❯ ckv -l --policy-metadata-filter policy.label=kartik-test --bc-api-key "$PC_ACCESS_KEY::$PC_SECRET_KEY" |    | Id         | Type     | Entity                            | Policy                    | IaC       | |----|------------|----------|-----------------------------------|---------------------------|-----------| |  0 | CKV_K8S_21 | resource | kubernetes_config_map             | Default namespace is used | Terraform | |  1 | CKV_K8S_21 | resource | kubernetes_cron_job               | Default namespace is used | Terraform | |  2 | CKV_K8S_21 | resource | kubernetes_daemonset              | Default namespace is used | Terraform | |  3 | CKV_K8S_21 | resource | kubernetes_deployment             | Default namespace is used | Terraform | |  4 | CKV_K8S_21 | resource | kubernetes_ingress                | Default namespace is used | Terraform |
  > Never mind, I found the issue. It appears that  `GET https://api.prismacloud.io/filter/policy/suggest` returns only "recently used" filters and therefore a new label may or may not be returned. I'll fix this to use this method instead https://prisma.pan.dev/api/cloud/cspm/policy#operation/get-policy-filter-options

- **Issue #2632** (2022-03-25): **Bicep false CKV_AZURE_23**
  *Symptoms*: Hi, I get CKV_AZURE_23 on this simple bicep file:  ` @description('SQL Logical server.') param sqlLogicalServer object  @description('The SQL Logical Server password.') @secure() param password string  param tags object  var defaultAuditActionsAndGroups = [   'SUCCESSFUL_DATABASE_AUTHENTICATION_GROUP'   'FAILED_DATABASE_AUTHENTICATION_GROUP'   'BATCH_COMPLETED_GROUP' ]  resource sqlLogicalServerRes 'Microsoft.Sql/servers@2021-02-01-preview' = {   name: sqlLogicalServer.name   location: resourceGroup().location   tags: tags   identity: {     type: sqlLogicalServer.systemManagedIdentity ? 'SystemAssigned' : 'None'   }   properties: {     administratorLogin: sqlLogicalServer.userName     administratorLoginPassword: password     version: '12.0'     minimalTlsVersion: sqlLogicalServer.minimalTlsVersion     publicNetworkAccess: sqlLogicalServer.publicNetworkAccess   } }  // Audit settings need for enabling auditing to Log Analytics workspace resource auditSettings 'Microsoft.Sql/servers/auditingSettings@2021-02-01-preview' = {   name: 'default'   parent: sqlLogicalServerRes   properties: {     state: 'Enabled'     auditActionsAndGroups: defaultAuditActionsAndGroups     storageEndpoint: ''     storageAccountAccessKey: ''     storageAccountSubscriptionId: '00000000-0000-0000-0000-000000000000'     retentionDays: 0     isAzureMonitorTargetEnabled: sqlLogicalServer.diagnosticLogsAndMetrics.auditLogs     isDevopsAuditEnabled: sqlLogicalServ
  **Post-Mortem & Fix Analysis**:
  > hi @acorbos thanks for creating this issue and I'm happy that you gave the Bicep runner a try. It is still in an early stage and I'm improving it step by step.
  > @gruebel thanks for looking into it, I couldn't find the code. Is it somehow converting to ARM and then using the ARM checks? I'm asking because I wanted to switch to ARM and I have the same problem with it. See https://github.com/bridgecrewio/checkov/blob/master/checkov/arm/checks/resource/SQLServerAuditingEnabled.py I think it should check on server level, not on database level if the message is "Ensure that 'Auditing' is set to 'Enabled' **for SQL servers**". By the way, that blank there... shouldn't it be a slash between MicrosoftSql and servers? "Microsoft.Sql servers/databases/auditingSettings"  Why is it not working for me: This code expects a resource with type "auditingSettings" nested inside "Microsoft.Sql/servers". I have a resource with type "Microsoft.Sql/servers/auditingSettings" outside resource "Microsoft.Sql/servers". This is how the Azure portal exports templates.  
  > @acorbos you are right, but it is even a bit more complicated, but I'm working on a fix. It won't cover all possibilities, but it should be better than now 🙂 

- **Issue #2457** (2022-02-21): **Kustomize reorders yaml and crashes checkov**
  *Symptoms*: **Describe the issue**  Checkov should be able to scan Kubernetes objects with arbitrary element names when using kustomize.  I am scanning a rook-ceph deployment, that contains a Storage class with a key `allowVolumeExpansion`. The storage class is included through a `kustomization.yaml`.   This key will be listed before `apiVersion`, and make Checkov break - at it expects the apiVersion to be [the first entry](https://github.com/bridgecrewio/checkov/blob/master/checkov/kustomize/runner.py#L328). However, this is not guaranteed - kustomize will order the items in the .yaml file alphabetically.  **Examples** Please share an example code sample (in the IaC of your choice) + the expected outcomes.  Storageclass: ```yaml apiVersion: storage.k8s.io/v1 kind: StorageClass metadata:   name: rook-ceph-block   annotations:     storageclass.kubernetes.io/is-default-class: "true" # Change "rook-ceph" provisioner prefix to match the operator namespace if needed provisioner: rook-ceph.rbd.csi.ceph.com parameters:   # [...] allowVolumeExpansion: true reclaimPolicy: Delete ```  Kustomization: ```yaml apiVersion: kustomize.config.k8s.io/v1beta1 kind: Kustomization  resources: - storageclass.yaml ```  Storageclass.yaml built with kustomize:  ```sh /code/components/rook-ceph/bases/v1.7.8 # kustomize build allowVolumeExpansion: true apiVersion: storage.k8s.io/v1 kind: StorageClass metadata:   annotations:     storageclass.kubernetes.io/is-default-cla
  **Post-Mortem & Fix Analysis**:
  > Hey @MajorFlamingo many thanks for the detailed issue report!  I've never actually seen a Kubernetes manifest that didn't start with the API line, or a Kustomize example that did that!  Could you point me to the rook-ceph deployment codebase if it's public for my own intrigue?   Currently working on an alternative check for file sanity when processing the kustomize output!
  > See https://github.com/bridgecrewio/checkov/pull/2478 
  > Thanks for responding and submitting a fix so quickly.   I think this storageclass example might help you recreate this issue: [storageclass.yaml](https://github.com/rook/rook/blob/master/deploy/examples/csi/cephfs/storageclass.yaml).  Even though the file starts with the apiVersion, kustomize will sort the file internally - meaning that the `allowVolumeExpansion` key will be ordered before the `apiVersion` key. 

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

### Incident Patch 1: `06b86ed0` (2026-10-05)
**Commit Message**: fix(sca): apply --skip-path regex and hidden-dir filtering to sca_package (#7712)

* fix(sca): use filter_ignored_paths in sca_package runner

* test(sca): mock bc_api_key in sca_package skip-path tests

* fix(sca): keep scanning hidden dirs in sca_package

**File**: `checkov/version.py` (modified, +1/-1)
```diff
@@ -1 +1 @@
-version = '3.3.22'
+version = '3.3.23'
```

**File**: `kubernetes/requirements.txt` (modified, +1/-1)
```diff
@@ -1 +1 @@
-checkov==3.3.22
+checkov==3.3.23
```

---

### Incident Patch 2: `e7d3dd92` (2026-10-05)
**Commit Message**: fix(sca): apply --skip-path regex and hidden-dir filtering to sca_package (#7712)

* fix(sca): use filter_ignored_paths in sca_package runner

* test(sca): mock bc_api_key in sca_package skip-path tests

* fix(sca): keep scanning hidden dirs in sca_package

**File**: `checkov/sca_package_2/runner.py` (modified, +21/-11)
```diff
@@ -3,7 +3,7 @@
 import logging
 import os
 from pathlib import Path
-from typing import Any, List
+from typing import Any, Iterable, List
 
 from checkov.common.bridgecrew.bc_source import IDEsSourceTypes
 from checkov.common.sca.commons import should_run_scan
@@ -15,7 +15,7 @@
 from checkov.common.models.enums import ErrorStatus
 from checkov.common.output.report import Report
 from checkov.common.bridgecrew.check_type import CheckType
-from checkov.common.runners.base_runner import BaseRunner, ignored_directories
+from checkov.common.runners.base_runner import BaseRunner, filter_ignored_paths
 from checkov.runner_filter import RunnerFilter
 from checkov.sca_package_2.scanner import Scanner
 
@@ -69,14 +69,11 @@ def prepare_and_scan(
             bc_integration.setup_http_manager()
             bc_integration.set_s3_client()
 
-        excluded_paths = {*ignored_directories}
-        if runner_filter.excluded_paths:
-            excluded_paths.update(runner_filter.excluded_paths)
-
+        # ignored directories (ex. 'node_modules') are handled by 'filter_ignored_paths'
         uploaded_files: List[FileToPersist] | None = self.upload_package_files(
             root_path=self._code_repo_path,
             files=files,
-            excluded_paths=excluded_paths,
+            excluded_paths=set(runner_filter.excluded_paths or []),
             excluded_file_names=excluded_file_names,
         )
         if uploaded_files is None:
@@ -147,6 +144,19 @@ def run(
 
         return report
 
+    def _walk_files(self, root_path: Path, excluded_paths: Iterable[str]) -> Iterable[Path]:
+        """Walks the given root path and yields the not excluded files via 'filter_ignored_paths'"""
+        excluded_paths_list = list(excluded_paths)
+        for root, d_names, f_names in os.walk(root_path):
+            # unlike other frameworks, hidden directories and files are scanned to keep the existing SCA coverage,
+            # therefore they are passed as included paths. Ignored directories (ex. 'node_modules') are still skipped.
+            hidden_names = [name for name in (*d_names, *f_names) if name.startswith(".")]
+            filter_ignored_paths(root, d_names, excluded_paths_list, hidden_names)
+            filter_ignored_paths(root, f_names, excluded_paths_list, hidden_names)
+            for file_name in f_names:
+                # 'Path' normalizes the path and drops a leading './' to keep it aligned with 'Path.glob()' output
+                yield Path(root) / file_name
+
     def _persist_file_if_required(self, package_files_to_persist: List[FileToPersist],
                                   file_path: Path, root_path: Path | None) -> None:
         if file_path.name in SCANNABLE_PACKAGE_FILES or file_path.suffix in SCANNABLE_PACKAGE_FILES_EXTENSIONS:
@@ -167,8 +177,8 @@ def upload_package_files(
         package_files_to_persist: List[FileToPersist] = []
         try:
             if root_path:
-                for file_path in root_path.glob("**/*"):
-                    if any(p in file_path.parts for p in excluded_paths) or file_path.name in excluded_file_names:
+                for file_path in self._walk_files(root_path, excluded_paths):
+                    if file_path.name in excluded_file_names:
                         logging.debug(f"[sca_package:runner](upload_package_files) - File {file_path} was excluded")
                         continue
                     self._persist_file_if_required(package_files_to_persist, file_path, root_path)
@@ -205,8 +215,8 @@ def find_scannable_files(
         if root_path:
             input_paths = {
                 file_path
-                for file_path in root_path.glob("**/*")
-                if file_path.name in SUPPORTED_PACKAGE_FILES.union(extra_supported_package_files) and not any(p in file_path.parts for p in excluded_paths)
+                for file_path in self._walk_files(root_path, excluded_paths)
+                if file_path.name in SUPPORTED_PACKAGE_FILES.union(extra_supported_package_files)
             }
 
             package_json_lock_parent_paths = set()
```

**File**: `tests/sca_package_2/test_runner.py` (modified, +179/-1)
```diff
@@ -1,13 +1,17 @@
 import os
+import re
 from pathlib import Path
 from unittest.mock import MagicMock
 
+import pytest
 from pytest_mock import MockerFixture
 from packaging import version as packaging_version
 
 from checkov.common.bridgecrew.bc_source import SourceTypes, BCSourceType
 from checkov.common.bridgecrew.code_categories import CodeCategoryType
 from checkov.common.bridgecrew.platform_integration import bc_integration, FileToPersist
+from checkov.common.models.consts import SCANNABLE_PACKAGE_FILES, SCANNABLE_PACKAGE_FILES_EXTENSIONS
+from checkov.common.runners.base_runner import ignored_directories
 from checkov.runner_filter import RunnerFilter
 from checkov.sca_package_2.runner import Runner
 from checkov.common.bridgecrew.check_type import CheckType
@@ -287,4 +291,178 @@ def test_run_with_ide_source_and_bc_api_key(mocker: MockerFixture):
     assert report.error_status == ErrorStatus.SUCCESS  # shouldn't be ERROR
 
     # scanner shouldn't be invoked
-    scanner_mock.assert_not_called()
\ No newline at end of file
+    scanner_mock.assert_not_called()
+
+HIDDEN_CACHE_FILE = ".cache/14.5.2/Cypress/resources/app/packages/errors/package.json"
+TREE_FILES = (
+    "app/package.json",
+    HIDDEN_CACHE_FILE,
+    ".github/actions/foo/package.json",
+    "node_modules/x/package.json",
+    "sub/dir1/requirements.txt",
+)
+
+
+@pytest.fixture()
+def mock_bc_api_key(mocker: MockerFixture) -> None:
+    # patched (not assigned) to avoid leaking the api key into other tests
+    mocker.patch.object(bc_integration, "bc_api_key", "abcd1234-abcd-1234-abcd-1234abcd1234")
+
+
+def _create_tree(base: Path) -> None:
+    for rel in TREE_FILES:
+        file_path = base / rel
+        file_path.parent.mkdir(parents=True, exist_ok=True)
+        file_path.write_text("{}")
+
+
+def _upload_relative(tmp_path: Path, excluded_paths, excluded_file_names=None):
+    """simulates 'checkov -d .' from within tmp_path"""
+    _create_tree(tmp_path)
+    origin_cwd = os.getcwd()
+    try:
+        os.chdir(tmp_path)
+        return Runner().upload_package_files(
+            root_path=Path("."),
+            files=None,
+            excluded_paths=excluded_paths,
+            excluded_file_names=excluded_file_names,
+        )
+    finally:
+        os.chdir(origin_cwd)
+
+
+def _s3_keys(uploaded):
+    return {item.s3_file_key for item in uploaded}
+
+
+@pytest.mark.usefixtures("mock_bc_api_key")
+def test_upload_package_files_default_filtering(tmp_path: Path):
+    uploaded = _upload_relative(tmp_path, excluded_paths=set())
+
+    # only ignored directories (ex. node_modules) are skipped, hidden directories are still scanned
+    assert set(uploaded) == {
+        FileToPersist(full_file_path="app/package.json", s3_file_key="app/package.json"),
+        FileToPersist(full_file_path=HIDDEN_CACHE_FILE, s3_file_key=HIDDEN_CACHE_FILE),
+        FileToPersist(full_file_path=".github/actions/foo/package.json",
+                      s3_file_key=".github/actions/foo/package.json"),
+        FileToPersist(full_file_path="sub/dir1/requirements.txt", s3_file_key="sub/dir1/requirements.txt"),
+    }
+
+
+@pytest.mark.parametrize("ignore_hidden", [True, False])
+@pytest.mark.usefixtures("mock_bc_api_key")
+def test_upload_package_files_same_files_as_glob_without_skip_path(
+    tmp_path: Path, mocker: MockerFixture, ignore_hidden: bool
+):
+    # without '--skip-path' the scanned files must stay the same as in the previous 'Path.glob' based implementation,
+    # independent of the 'CKV_IGNORE_HIDDEN_DIRECTORIES' setting
+    mocker.patch("checkov.common.runners.base_runner.IGNORE_HIDDEN_DIRECTORY_ENV", ignore_hidden)
+    for rel in (
+        *TREE_FILES,
+        ".hidden.csproj",
+        ".venv/lib/requirements.txt",
+        ".config/.nested/go.sum",
+        "app/.yarn/cache/package.json",
+        "app/node_modules/y/package.json",
+        "infra/.terraform/modules/m/package.json",
+        "svc/.serverless/package.json",
+        "svc/Pipfile",
+        "svc/Pipfile.lock",
+        "svc/README.md",
+    ):
+        file_path = tmp_path / rel
+        file_path.parent.mkdir(parents=True, exist_ok=True)
+        file_path.write_text("{}")
+
+    uploaded = Runner().upload_package_files(root_path=tmp_path, files=None, excluded_paths=set())
+
+    # previous implementation
+    expected = set()
+    for file_path in tmp_path.glob("**/*"):
+        if any(p in file_path.parts for p in ignored_directories):
+            continue
+        if file_path.name in SCANNABLE_PACKAGE_FILES or file_path.suffix in SCANNABLE_PACKAGE_FILES_EXTENSIONS:
+            expected.add(FileToPersist(str(file_path), os.path.relpath(str(file_path), tmp_path)))
+
+    assert set(uploaded) == expected
+    assert {item.s3_file_key for item in expected} >= {
+        ".hidden.csproj", ".venv/lib/requirements.txt", ".config/.nested/go.sum", "app/.yarn/cache/package.json"
+    }
+
+
+@pytest.mark.parametrize("skip_path", [r"^\./\.cache(/|$)", r"\./\.ca
```

---

### Incident Patch 3: `e8c8decf` (2026-09-30)
**Commit Message**: fix(terraform_json): handle HCL JSON array and single-dict block formats in parser (#7707)

initial impl

Co-authored-by: eshmayovitz <[REDACTED_EMAIL]>

**File**: `checkov/terraform_json/parser.py` (modified, +25/-2)
```diff
@@ -53,6 +53,8 @@ def parse(file_path: Path) -> tuple[dict[str, Any], list[tuple[int, str]]] | tup
                 logger.error(f"Tried to parse {file_path} as JSON", exc_info=True)
     except YAMLError:
         pass
+    except Exception:
+        logger.error(f"Failed to parse template: {file_path}", exc_info=True)
 
     if template is None or template_lines is None:
         return None, None
@@ -91,9 +93,28 @@ def prepare_definition(definition: dict[str, Any]) -> dict[str, Any]:
     return definition_new
 
 
-def handle_block_type(block_type: str, blocks: dict[str, Any]) -> list[dict[str, Any]]:
+def handle_block_type(block_type: str, blocks: dict[str, Any] | list[dict[str, Any]]) -> list[dict[str, Any]]:
     result: list[dict[str, Any]] = []
 
+    # HCL JSON spec allows block types as an array of single-key objects
+    if isinstance(blocks, list):
+        normalized: dict[str, Any] = {}
+        for block_obj in blocks:
+            if isinstance(block_obj, dict):
+                for key, value in block_obj.items():
+                    if key in normalized:
+                        # Multiple blocks with same name — merge into list
+                        existing = normalized[key]
+                        if isinstance(existing, list):
+                            existing.append(value)
+                        else:
+                            normalized[key] = [existing, value]
+                    else:
+                        normalized[key] = value
+            else:
+                logger.debug(f"Skipping non-dict element in '{block_type}' blocks array: {type(block_obj).__name__}")
+        blocks = normalized
+
     for block_name, config in blocks.items():
         if block_name == COMMENT_FIELD_NAME or block_name in LINE_FIELD_NAMES:
             continue
@@ -105,7 +126,9 @@ def handle_block_type(block_type: str, blocks: dict[str, Any]) -> list[dict[str,
                     continue
                 result.append({block_name: {resource_name: hclify(obj=resource_config)}})
         elif block_type == BlockType.PROVIDER:
-            # provider are stored as a list, which we need to move one level higher to add the name
+            # provider can be a list of configs or a single dict; normalize to list
+            if isinstance(config, dict):
+                config = [config]
             for provider_config in config:
                 result.append({block_name: hclify(obj=provider_config)})
         elif block_type == BlockType.LOCALS:
```

**File**: `tests/terraform_json/examples/provider_array_with_null.tf.json` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+{
+  "provider": [
+    {
+      "aws": {
+        "region": "us-west-2",
+        "profile": null
+      }
+    }
+  ],
+  "resource": {
+    "aws_instance": {
+      "example": {
+        "ami": "abc-123",
+        "instance_type": "t2.micro"
+      }
+    }
+  }
+}
```

**File**: `tests/terraform_json/examples/provider_single_dict.tf.json` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+{
+  "provider": {
+    "artifactory": {
+      "url": "https://example.com",
+      "access_token": "token123"
+    }
+  },
+  "resource": {
+    "aws_instance": {
+      "example": {
+        "ami": "abc-123",
+        "instance_type": "t2.micro"
+      }
+    }
+  }
+}
```

**File**: `tests/terraform_json/examples/provider_top_level_array.tf.json` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+{
+  "provider": [
+    {"aws": {"region": "us-east-1"}},
+    {"aws": {"alias": "west", "region": "us-west-2"}}
+  ],
+  "resource": {
+    "aws_instance": {
+      "example": {
+        "ami": "abc-123",
+        "instance_type": "t2.micro"
+      }
+    }
+  }
+}
```

**File**: `tests/terraform_json/test_parser.py` (modified, +143/-1)
```diff
@@ -1,4 +1,8 @@
-from checkov.terraform_json.parser import hclify, prepare_definition
+from pathlib import Path
+
+from checkov.terraform_json.parser import handle_block_type, hclify, parse, prepare_definition
+
+EXAMPLES_DIR = Path(__file__).parent / "examples"
 
 
 def test_hclify():
@@ -60,3 +64,141 @@ def test_prepare_definition_locals():
             }
         ]
     }
+
+
+def test_handle_block_type_provider_single_dict_config():
+    """Provider config as a single dict (not wrapped in a list) should be handled without crashing.
+
+    When a provider has a single configuration in .tf.json, the HCL JSON spec allows it
+    as a plain dict. The parser must normalize it to a list before iterating, otherwise
+    iterating a dict yields its keys (strings) and hclify() crashes with
+    'Exception: this method receives only dicts'.
+    """
+    # given — provider name maps to a dict (not a list)
+    blocks = {"artifactory": {"url": "https://example.com", "access_token": "token123"}}
+
+    # when / then — should NOT crash, should return valid parsed result
+    result = handle_block_type(block_type="provider", blocks=blocks)
+
+    assert isinstance(result, list)
+    assert len(result) == 1
+    assert "artifactory" in result[0]
+    # The inner dict should be hclified (values wrapped in lists)
+    assert result[0]["artifactory"] == {
+        "url": ["https://example.com"],
+        "access_token": ["token123"],
+    }
+
+
+def test_handle_block_type_provider_list_config():
+    """Provider config as a list of dicts (the existing working case).
+
+    This should continue to work — it's the format the current code already handles.
+    """
+    # given — provider name maps to a list of dicts
+    blocks = {"aws": [{"region": "us-east-1"}, {"alias": "west", "region": "us-west-2"}]}
+
+    # when
+    result = handle_block_type(block_type="provider", blocks=blocks)
+
+    # then
+    assert isinstance(result, list)
+    assert len(result) == 2
+    assert result[0] == {"aws": {"region": ["us-east-1"]}}
+    assert result[1] == {"aws": {"alias": ["west"], "region": ["us-west-2"]}}
+
+
+def test_parse_provider_single_dict_config_file():
+    """End-to-end parse of a .tf.json file where a provider config is a plain dict.
+
+    This exercises the full parse → loads → prepare_definition → handle_block_type pipeline
+    with the single-dict provider crash scenario.
+    """
+    # given
+    fixture = EXAMPLES_DIR / "provider_single_dict.tf.json"
+
+    # when
+    template, file_lines = parse(file_path=fixture)
+
+    # then — should not crash and should return a valid template
+    assert template is not None
+    assert file_lines is not None
+
+    # Provider block should be parsed correctly
+    assert "provider" in template
+    provider_blocks = template["provider"]
+    assert isinstance(provider_blocks, list)
+    assert len(provider_blocks) == 1
+    assert "artifactory" in provider_blocks[0]
+    assert provider_blocks[0]["artifactory"]["url"] == ["https://example.com"]
+    assert provider_blocks[0]["artifactory"]["access_token"] == ["token123"]
+
+    # Resource block should also be parsed correctly
+    assert "resource" in template
+    resource_blocks = template["resource"]
+    assert isinstance(resource_blocks, list)
+    assert len(resource_blocks) == 1
+    assert "aws_instance" in resource_blocks[0]
+
+
+def test_parse_provider_array_of_objects_file():
+    """End-to-end parse of a .tf.json file where provider is a top-level array of objects.
+
+    The HCL JSON spec also allows:
+      "provider": [{"aws": {"region": "us-east-1"}}, {"aws": {...}}]
+    This is a different format from the dict-of-lists format and exercises another code path.
+    """
+    # given
+    fixture = EXAMPLES_DIR / "provider_top_level_array.tf.json"
+
+    # when
+    template, file_lines = parse(file_path=fixture)
+
+    # then — should not crash and should return a valid template
+    assert template is not None
+    assert file_lines is not None
+
+    # Provider block should be parsed correctly
+    assert "provider" in template
+    provider_blocks = template["provider"]
+    assert isinstance(provider_blocks, list)
+    assert len(provider_blocks) == 2
+    assert "aws" in provider_blocks[0]
+    assert provider_blocks[0]["aws"]["region"] == ["us-east-1"]
+    assert "aws" in provider_blocks[1]
+    assert provider_blocks[1]["aws"]["region"] == ["us-west-2"]
+    assert provider_blocks[1]["aws"]["alias"] == ["west"]
+
+
+def test_parse_provider_array_with_null_values():
+    """End-to-end parse of a .tf.json file where provider is a top-level array with null values.
+
+    The HCL JSON spec allows null values in provider configurations:
+      "provider": [{"aws": {"region": "us-west-2", "profile": null}}]
+    The parser must preserve null as [None] after hclification.
+    """
+    # given
+    fixture = EXAMPLES_DIR / "provider_array_with_null.tf.json"
+
+    # when
+    template, file_lines = pars
```

---

### Incident Patch 4: `d89e8dd4` (2026-07-10)
**Commit Message**: fix(terraform_plan): skip resources being removed from state ('forget' action)

**File**: `checkov/version.py` (modified, +1/-1)
```diff
@@ -1 +1 @@
-version = '3.3.19'
+version = '3.3.20'
```

**File**: `kubernetes/requirements.txt` (modified, +1/-1)
```diff
@@ -1 +1 @@
-checkov==3.3.19
+checkov==3.3.20
```

---

### Incident Patch 5: `06ac5717` (2026-09-27)
**Commit Message**: fix(terraform_plan): skip resources being removed from state ('forget' action) (#7676)

**File**: `checkov/terraform/plan_parser.py` (modified, +8/-1)
```diff
@@ -19,6 +19,7 @@
 TF_PLAN_RESOURCE_ADDRESS = CustomAttributes.TF_RESOURCE_ADDRESS
 TF_PLAN_RESOURCE_CHANGE_ACTIONS = "__change_actions__"
 TF_PLAN_RESOURCE_CHANGE_KEYS = "__change_keys__"
+TF_PLAN_RESOURCE_FORGET_ACTION = "forget"
 TF_PLAN_RESOURCE_PROVISIONERS = "provisioners"
 TF_PLAN_RESOURCE_AFTER_UNKNOWN = 'after_unknown'
 
@@ -211,7 +212,13 @@ def _prepare_resource_block(
 
         changes = resource_changes.get(resource_address)  # type:ignore[arg-type]  # because it can be None
         if changes:
-            resource_conf[TF_PLAN_RESOURCE_CHANGE_ACTIONS] = changes.get("change", {}).get("actions") or []
+            actions = changes.get("change", {}).get("actions") or []
+            # Skip resources being removed from state ('forget' action). 'Forgotten' resources are mistakenly
+            # included with no values in planned_values due to Terraform bug (issue: hashicorp/terraform#38641).
+            if actions == [TF_PLAN_RESOURCE_FORGET_ACTION]:
+                return resource_block, block_type, False
+
+            resource_conf[TF_PLAN_RESOURCE_CHANGE_ACTIONS] = actions
             resource_conf[TF_PLAN_RESOURCE_CHANGE_KEYS] = changes.get(TF_PLAN_RESOURCE_CHANGE_KEYS) or []
             # enrich conf with after_unknown values
             _eval_after_unknown(changes, resource_conf)
```

**File**: `tests/terraform/runner/resources/plan_forget_action/tfplan.json` (added, +238/-0)
```diff
@@ -0,0 +1,238 @@
+{
+  "format_version": "1.2",
+  "terraform_version": "1.9.8",
+  "planned_values": {
+    "root_module": {
+      "resources": [
+        {
+          "address": "aws_s3_bucket.forgotten",
+          "mode": "managed",
+          "type": "aws_s3_bucket",
+          "name": "forgotten",
+          "provider_name": "registry.terraform.io/hashicorp/aws",
+          "schema_version": 0,
+          "sensitive_values": false
+        }
+      ]
+    }
+  },
+  "resource_changes": [
+    {
+      "address": "aws_s3_bucket.forgotten",
+      "mode": "managed",
+      "type": "aws_s3_bucket",
+      "name": "forgotten",
+      "provider_name": "registry.terraform.io/hashicorp/aws",
+      "change": {
+        "actions": [
+          "forget"
+        ],
+        "before": {
+          "acceleration_status": "",
+          "acl": null,
+          "arn": "arn:aws:s3:::forgotten-bucket",
+          "bucket": "forgotten-bucket",
+          "bucket_domain_name": "forgotten-bucket.s3.amazonaws.com",
+          "bucket_prefix": "",
+          "bucket_regional_domain_name": "forgotten-bucket.s3.us-west-2.amazonaws.com",
+          "cors_rule": [],
+          "force_destroy": false,
+          "grant": [
+            {
+              "id": "75aa57f09aa0c8caeab4f8c24e99d10f8e7faeebf76c078efc7c6caea54ba06a",
+              "permissions": [
+                "FULL_CONTROL"
+              ],
+              "type": "CanonicalUser",
+              "uri": ""
+            }
+          ],
+          "hosted_zone_id": "Z3BJ6K6RIION7M",
+          "id": "forgotten-bucket",
+          "lifecycle_rule": [],
+          "logging": [],
+          "object_lock_configuration": [],
+          "object_lock_enabled": false,
+          "policy": "",
+          "region": "us-west-2",
+          "replication_configuration": [],
+          "request_payer": "BucketOwner",
+          "server_side_encryption_configuration": [
+            {
+              "rule": [
+                {
+                  "apply_server_side_encryption_by_default": [
+                    {
+                      "kms_master_key_id": "arn:aws:kms:us-west-2:123456789012:key/12345678-1234-1234-1234-123456789012",
+                      "sse_algorithm": "aws:kms"
+                    }
+                  ],
+                  "bucket_key_enabled": false
+                }
+              ]
+            }
+          ],
+          "tags": null,
+          "tags_all": {},
+          "timeouts": null,
+          "versioning": [
+            {
+              "enabled": false,
+              "mfa_delete": false
+            }
+          ],
+          "website": [],
+          "website_domain": null,
+          "website_endpoint": null
+        },
+        "after": null,
+        "after_unknown": {},
+        "before_sensitive": {
+          "cors_rule": [],
+          "grant": [
+            {
+              "permissions": [
+                false
+              ]
+            }
+          ],
+          "lifecycle_rule": [],
+          "logging": [],
+          "object_lock_configuration": [],
+          "replication_configuration": [],
+          "server_side_encryption_configuration": [
+            {
+              "rule": [
+                {
+                  "apply_server_side_encryption_by_default": [
+                    {}
+                  ]
+                }
+              ]
+            }
+          ],
+          "tags_all": {},
+          "versioning": [
+            {}
+          ],
+          "website": []
+        },
+        "after_sensitive": false
+      },
+      "action_reason": "delete_because_no_resource_config"
+    }
+  ],
+  "prior_state": {
+    "format_version": "1.0",
+    "terraform_version": "1.9.8",
+    "values": {
+      "root_module": {
+        "resources": [
+          {
+            "address": "aws_s3_bucket.forgotten",
+            "mode": "managed",
+            "type": "aws_s3_bucket",
+            "name": "forgotten",
+            "provider_name": "registry.terraform.io/hashicorp/aws",
+            "schema_version": 0,
+            "values": {
+              "acceleration_status": "",
+              "acl": null,
+              "arn": "arn:aws:s3:::forgotten-bucket",
+              "bucket": "forgotten-bucket",
+              "bucket_domain_name": "forgotten-bucket.s3.amazonaws.com",
+              "bucket_prefix": "",
+              "bucket_regional_domain_name": "forgotten-bucket.s3.us-west-2.amazonaws.com",
+              "cors_rule": [],
+              "force_destroy": false,
+              "grant": [
+                {
+                  "id": "75aa57f09aa0c8caeab4f8c24e99d10f8e7faeebf76c078efc7c6caea54ba06a",
+                  "permissions": [
+                    "FULL_CONTROL"
+                  ],
+                  "type": "CanonicalUser",
+                  "uri": ""
+                }
+              ],
+              "hosted_zone_id": "Z3BJ6K6RIION7M",
+              "id": "forgotten-bucket",
+              "
```

**File**: `tests/terraform/runner/test_plan_runner.py` (modified, +21/-0)
```diff
@@ -397,6 +397,27 @@ def test_runner_root_module_resources_no_values_route53(self):
 
         self.assertCountEqual(passed_check_ids, expected_passed_check_ids)
 
+    def test_runner_skip_forget_action_resources(self):
+        # A resource being removed from state (no destroy) via a 'removed' block has a 'forget' change action and will
+        # appear in planned_values without values due to a Terraform bug (issue: hashicorp/terraform#38641), causing false positives.
+        # This test verifies 'forgotten' resources are getting skipped to account for the bug.
+        current_dir = os.path.dirname(os.path.realpath(__file__))
+        plan_path = current_dir + "/resources/plan_forget_action/tfplan.json"
+
+        report = Runner().run(
+            root_folder=None,
+            files=[plan_path],
+            external_checks_dir=None,
+            runner_filter=RunnerFilter(framework=["terraform_plan"]),
+        )
+
+        scanned_resources = {
+            record.resource
+            for record in itertools.chain(report.passed_checks, report.failed_checks, report.skipped_checks)
+        }
+
+        self.assertNotIn("aws_s3_bucket.forgotten", scanned_resources)
+
     def test_runner_data_resource_partial_values(self):
         # In rare circumstances a data resource with partial values in the plan could cause false negatives
         # Often 'data' does not even appear in the *_modules[x].resources field within planned_values and is not scanned as expected
```

---

### Incident Patch 6: `f6824442` (2026-09-10)
**Commit Message**: fix(general): honour scope.provider for platform-downloaded custom po… (#7677)

fix(general): honour scope.provider for platform-downloaded custom policies

Co-authored-by: mblonder <[REDACTED_EMAIL]>

**File**: `checkov/version.py` (modified, +1/-1)
```diff
@@ -1 +1 @@
-version = '3.3.16'
+version = '3.3.17'
```

**File**: `kubernetes/requirements.txt` (modified, +1/-1)
```diff
@@ -1 +1 @@
-checkov==3.3.16
+checkov==3.3.17
```

---

### Incident Patch 7: `ba421a3a` (2026-09-10)
**Commit Message**: fix(general): honour scope.provider for platform-downloaded custom po… (#7677)

fix(general): honour scope.provider for platform-downloaded custom policies

Co-authored-by: mblonder <[REDACTED_EMAIL]>

**File**: `checkov/common/bridgecrew/integration_features/features/custom_policies_integration.py` (modified, +2/-2)
```diff
@@ -68,7 +68,7 @@ def pre_scan(self) -> None:
                         policy['severity'] = Severities[policy['severity']]
                         self.bc_cloned_checks[source_incident_id].append(policy)
                         continue
-                    resource_types = Registry._get_resource_types(converted_check['metadata'])
+                    resource_types = Registry._get_resource_types(converted_check)
 
                     if policy.get('category') == LICENSES_CATEGORY:
                         continue
@@ -105,10 +105,10 @@ def _convert_raw_check(policy: dict[str, Any]) -> dict[str, Any]:
             'name': policy['title'],
             'category': policy['category'],
             'frameworks': policy.get('frameworks', []),
-            'scope': {'provider': policy.get('provider', '').lower()}
         }
         check = {
             'metadata': metadata,
+            'scope': {'provider': policy.get('provider', '').lower()},
             'definition': json.loads(policy['code'])
         }
         return check
```

**File**: `tests/common/integration_features/test_custom_policies_integration.py` (modified, +33/-2)
```diff
@@ -495,8 +495,39 @@ def test_policy_load_with_resources_types_as_str(self):
             Path(__file__).parent.parent.parent.parent / "checkov" / "terraform" / "checks" / "graph_checks"))
         checks = [parser.parse_raw_check(CustomPoliciesIntegration._convert_raw_check(p)) for p in policies]
         registry.checks = checks  # simulate that the policy downloader will do
-        
-        
+
+    def test_convert_raw_check_places_scope_at_top_level(self):
+        policy = {
+            "id": "test_azure_taggable_1",
+            "title": "Ensure taggable Azure resources are tagged",
+            "category": "General",
+            "provider": "azure",
+            "frameworks": ["Terraform"],
+            "severity": "MEDIUM",
+            "code": json.dumps({
+                "cond_type": "attribute",
+                "resource_types": "taggable",
+                "attribute": "tags",
+                "operator": "exists",
+            }),
+        }
+
+        converted = CustomPoliciesIntegration._convert_raw_check(policy)
+
+        self.assertEqual(converted["scope"], {"provider": "azure"})
+        self.assertNotIn("scope", converted["metadata"])
+
+        parser = GraphCheckParser()
+        resource_types = Registry._get_resource_types(converted)
+        check = parser.parse_raw_check(converted, resources_types=resource_types)
+        self.assertTrue(check.resource_types)
+        self.assertTrue(
+            all(rt.startswith("azurerm_") for rt in check.resource_types),
+            f"Azure-scoped taggable policy leaked to non-azure resources: "
+            f"{[rt for rt in check.resource_types if not rt.startswith('azurerm_')][:5]}"
+        )
+
+
 def mock_custom_policies_response():
     return {
         "customPolicies": [
```

**File**: `tests/terraform/graph/runner/test_graph_builder.py` (modified, +5/-0)
```diff
@@ -48,6 +48,11 @@ def test_build_graph_new_tf_module(self):
     def test_run_clean(self):
         resources_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "resources", "graph_files_test")
         runner = Runner(db_connector=self.db_connector())
+        # Isolate from cross-test pollution of the shared terraform graph_checks
+        # registry (same pattern used by tests in tests/terraform/runner/test_runner.py,
+        # e.g. lines 1220-1221) so the hard-coded pass/fail counts below stay stable.
+        runner.graph_registry.checks = []
+        runner.graph_registry.load_checks()
         report = runner.run(root_folder=resources_path)
         self.assertEqual(6, len(report.failed_checks))
         self.assertEqual(5, len(report.passed_checks))
```

---

### Incident Patch 8: `48dbc906` (2026-08-30)
**Commit Message**: fix(terraform): Added current Azure Terraform resources and taggable resources as of hashicorp/azurerm provider version 4.81 (#7652)

* Added current Azure Terraform resources as of provider version 4.81

* Fixed copy/past issues with azure resource types

---------

Co-authored-by: Joshua Brule <[REDACTED_EMAIL]>

**File**: `checkov/version.py` (modified, +1/-1)
```diff
@@ -1 +1 @@
-version = '3.3.15'
+version = '3.3.16'
```

**File**: `kubernetes/requirements.txt` (modified, +1/-1)
```diff
@@ -1 +1 @@
-checkov==3.3.15
+checkov==3.3.16
```

---

### Incident Patch 9: `8c7c152b` (2026-08-30)
**Commit Message**: fix(terraform): Added current Azure Terraform resources and taggable resources as of hashicorp/azurerm provider version 4.81 (#7652)

* Added current Azure Terraform resources as of provider version 4.81

* Fixed copy/past issues with azure resource types

---------

Co-authored-by: Joshua Brule <[REDACTED_EMAIL]>



---

### Incident Patch 10: `9514f12d` (2026-08-26)
**Commit Message**: fix(sca): match CVE suppressions case-insensitively (#7659)

* fix(sca): match CVE suppressions case-insensitively

* chore(ci): pin pipenv on all python versions

* chore(ci): pin pipenv and bump danger-check to node 20

**File**: `checkov/version.py` (modified, +1/-1)
```diff
@@ -1 +1 @@
-version = '3.3.14'
+version = '3.3.15'
```

**File**: `kubernetes/requirements.txt` (modified, +1/-1)
```diff
@@ -1 +1 @@
-checkov==3.3.14
+checkov==3.3.15
```

---

### Incident Patch 11: `2637543b` (2026-08-26)
**Commit Message**: fix(sca): match CvesAccounts suppressions on unprefixed account ids (#7660)

**File**: `checkov/common/bridgecrew/integration_features/features/suppressions_integration.py` (modified, +2/-1)
```diff
@@ -232,7 +232,8 @@ def _check_suppression(self, record: Record, suppression: dict[str, Any]) -> boo
         elif type == 'CvesAccounts':
             if 'accountIds' not in suppression:
                 return False
-            if self.bc_integration.source_id in suppression['accountIds']:
+            if self.bc_integration.source_id in suppression['accountIds'] or \
+                    any(self.bc_integration.repo_matches(account) for account in suppression['accountIds']):
                 if record.vulnerability_details and record.vulnerability_details['id'].lower() in {
                         cve.lower() for cve in suppression['cves']}:
                     return True
```

**File**: `tests/common/integration_features/test_suppressions_integration.py` (modified, +30/-0)
```diff
@@ -352,6 +352,36 @@ def test_suppress_by_cve_accounts_with_repo_id_package_scan(self):
         self.assertTrue(suppressions_integration._check_suppression(record2, suppression))
         self.assertFalse(suppressions_integration._check_suppression(record3, suppression))
 
+    def test_suppress_by_cve_accounts_unprefixed_account_id(self):
+        instance = BcPlatformIntegration()
+        instance.repo_id = 'some/repo'
+        instance.source_id = f"customer_{instance.repo_id}"
+        suppressions_integration = SuppressionsIntegration(instance)
+        suppressions_integration._init_repo_regex()
+
+        suppression = {
+            'suppressionType': 'CvesAccounts',
+            'policyId': 'BC_VUL_2',
+            'comment': 'suppress by accounts',
+            'cves': ['CVE-2021-44420'],
+            'accountIds': ['some/repo'],
+            'checkovPolicyId': 'BC_VUL_2'
+        }
+
+        matching = Record(check_id='BC_VUL_2', check_name=None, check_result=None,
+                          code_block=None, file_path=None, file_line_range=None,
+                          resource=None, evaluations=None, check_class=None,
+                          file_abs_path='.', entity_tags=None,
+                          vulnerability_details={'id': 'CVE-2021-44420'})
+        other_repo = Record(check_id='BC_VUL_2', check_name=None, check_result=None,
+                            code_block=None, file_path=None, file_line_range=None,
+                            resource=None, evaluations=None, check_class=None,
+                            file_abs_path='.', entity_tags=None,
+                            vulnerability_details={'id': 'CVE-2021-99999'})
+
+        self.assertTrue(suppressions_integration._check_suppression(matching, suppression))
+        self.assertFalse(suppressions_integration._check_suppression(other_repo, suppression))
+
     def test_suppress_by_cve_accounts_without_repo_id_package_scan(self):
         instance = BcPlatformIntegration()
         suppressions_integration = SuppressionsIntegration(instance)
```

---

### Incident Patch 12: `317f4a68` (2026-08-26)
**Commit Message**: fix(sca): match CVE suppressions case-insensitively (#7659)

* fix(sca): match CVE suppressions case-insensitively

* chore(ci): pin pipenv on all python versions

* chore(ci): pin pipenv and bump danger-check to node 20

**File**: `checkov/version.py` (modified, +1/-1)
```diff
@@ -1 +1 @@
-version = '3.3.13'
+version = '3.3.14'
```

**File**: `kubernetes/requirements.txt` (modified, +1/-1)
```diff
@@ -1 +1 @@
-checkov==3.3.13
+checkov==3.3.14
```

---

### Incident Patch 13: `8519304f` (2026-08-26)
**Commit Message**: fix(sca): match CVE suppressions case-insensitively (#7659)

* fix(sca): match CVE suppressions case-insensitively

* chore(ci): pin pipenv on all python versions

* chore(ci): pin pipenv and bump danger-check to node 20

**File**: `.github/workflows/pr-test.yml` (modified, +2/-7)
```diff
@@ -22,7 +22,7 @@ jobs:
       - name: Install Node.js
         uses: actions/setup-node@cdca7365b2dadb8aad0a33bc7601856ffabcc48e  # v4
         with:
-          node-version: "18"
+          node-version: "20"
       - name: Install and run DangerJS
         env:
           GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
@@ -92,12 +92,7 @@ jobs:
           github-token: ${{ secrets.GITHUB_TOKEN }}
       - name: Install pipenv
         run: |
-          if [ "${{ matrix.python }}" = "3.12" ] || [ "${{ matrix.python }}" = "3.13" ]; then
-            # needed for numpy
-            python -m pip install --no-cache-dir --upgrade pipenv==2024.4.0
-          else
-            python -m pip install --no-cache-dir --upgrade pipenv
-          fi
+          python -m pip install --no-cache-dir --upgrade pipenv==2024.4.0
       - name: Install dependencies
         run: |
           # remove venv, if exists
```

**File**: `checkov/common/bridgecrew/integration_features/features/suppressions_integration.py` (modified, +6/-3)
```diff
@@ -184,8 +184,10 @@ def _check_cve_suppression(self, record: Record, suppression: dict[str, Any]) ->
                     file_abs_path.endswith("".join([repo_name, suppression_path])) or \
                     removeprefix(repo_file_path, '/') == removeprefix(suppression_path, '/') \
                     or record.file_path == suppression_path:
-                return any(record.vulnerability_details and record.vulnerability_details['id'] == cve['cve']
-                           for cve in suppression['cves'])
+                if not record.vulnerability_details:
+                    return False
+                record_cve_id = record.vulnerability_details['id'].lower()
+                return any(record_cve_id == cve['cve'].lower() for cve in suppression['cves'])
         return False
 
     def _check_suppression(self, record: Record, suppression: dict[str, Any]) -> bool:
@@ -231,7 +233,8 @@ def _check_suppression(self, record: Record, suppression: dict[str, Any]) -> boo
             if 'accountIds' not in suppression:
                 return False
             if self.bc_integration.source_id in suppression['accountIds']:
-                if record.vulnerability_details and record.vulnerability_details['id'] in suppression['cves']:
+                if record.vulnerability_details and record.vulnerability_details['id'].lower() in {
+                        cve.lower() for cve in suppression['cves']}:
                     return True
             return False
 
```

**File**: `tests/common/integration_features/test_suppressions_integration.py` (modified, +31/-0)
```diff
@@ -529,6 +529,37 @@ def test_supress_by_cve_for_package_scan(self):
         self.assertFalse(suppressions_integration._check_suppression(record4, suppression))
         self.assertTrue(suppressions_integration._check_suppression(record5, suppression))
 
+    def test_supress_by_cve_is_case_insensitive(self):
+        instance = BcPlatformIntegration()
+        instance.repo_id = 'some/repo'
+        instance.source_id = f"customer_{instance.repo_id}"
+        suppressions_integration = SuppressionsIntegration(instance)
+        suppressions_integration._init_repo_regex()
+
+        suppression = {
+            'suppressionType': 'Cves',
+            'policyId': 'BC_VUL_2',
+            'comment': 'suppress ghsa',
+            'accountIds': ['customer_some/repo'],
+            'cves': [{'uuid': '11111111-2222-3333-4444-555555555555', 'id': '/package.json',
+                      'cve': 'GHSA-aaaa-bbbb-cccc'}],
+            'checkovPolicyId': 'BC_VUL_2'
+        }
+
+        matching = Record(check_id='BC_VUL_2', check_name=None, check_result=None,
+                          code_block=None, file_path=None, file_line_range=None,
+                          resource=None, evaluations=None, check_class=None,
+                          file_abs_path='package.json', entity_tags=None,
+                          vulnerability_details={'id': 'GHSA-AAAA-BBBB-CCCC'})
+        other_cve = Record(check_id='BC_VUL_2', check_name=None, check_result=None,
+                           code_block=None, file_path=None, file_line_range=None,
+                           resource=None, evaluations=None, check_class=None,
+                           file_abs_path='package.json', entity_tags=None,
+                           vulnerability_details={'id': 'GHSA-dddd-eeee-ffff'})
+
+        self.assertTrue(suppressions_integration._check_suppression(matching, suppression))
+        self.assertFalse(suppressions_integration._check_suppression(other_cve, suppression))
+
     def test_suppress_by_cve_with_empty_cves(self):
         instance = BcPlatformIntegration()
         instance.repo_id = 'repo/path'
```

---

### Incident Patch 14: `e5745d49` (2026-08-20)
**Commit Message**: fix(kubernetes): Fix K8S suppressions annotations (#7651)

fix k8s supressions

**File**: `checkov/kubernetes/kubernetes_utils.py` (modified, +2/-1)
```diff
@@ -24,6 +24,7 @@
 K8_POSSIBLE_ENDINGS = {".yaml", ".yml", ".json"}
 DEFAULT_NESTED_RESOURCE_TYPE = "Pod"
 SUPPORTED_POD_CONTAINERS_TYPES = {"Deployment", "DeploymentConfig", "DaemonSet", "Job", "ReplicaSet", "ReplicationController", "StatefulSet"}
+SKIP_ANNOTATION_PREFIXES = ("checkov.io/skip", "bridgecrew.io/skip", "cortex.io/skip")
 PARENT_RESOURCE_KEY_NAME = "_parent_resource"
 PARENT_RESOURCE_ID_KEY_NAME = "_parent_resource_id"
 FILTERED_RESOURCES_FOR_EDGE_BUILDERS = ["NetworkPolicy"]
@@ -96,7 +97,7 @@ def get_skipped_checks(entity_conf: dict[str, Any]) -> list[_SkippedCheck]:
                 continue
             for key in annotation:
                 skipped_item: "_SkippedCheck" = {}
-                if "checkov.io/skip" in key or "bridgecrew.io/skip" in key:
+                if any(prefix in key for prefix in SKIP_ANNOTATION_PREFIXES):
                     if "=" in annotation[key]:
                         (skipped_item["id"], skipped_item["suppress_comment"]) = annotation[key].split("=")
                     else:
```

**File**: `tests/kubernetes/checks/example_Suppressed/suppress-checks-PASSED.yaml` (modified, +32/-0)
```diff
@@ -64,6 +64,38 @@ spec:
         - -c
         - touch /tmp/healthy; sleep 30; rm -rf /tmp/healthy; sleep 600
 ---
+apiVersion: v1
+kind: Pod
+metadata:
+  labels:
+    test: cortexliveness
+  name: cortexliveness-exec
+  annotations:
+    cortex.io/skip1: CKV_K8S_20=I don't care about Privilege Escalation in the first container in this pod
+    cortex.io/skip2: CKV_K8S_14
+    cortex.io/skip3: CKV_K8S_11=I don't care about CPU limits
+spec:
+  containers:
+    - name: cortexliveness
+      image: k8s.gcr.io/busybox
+      args:
+        - /bin/sh
+        - -c
+        - touch /tmp/healthy; sleep 30; rm -rf /tmp/healthy; sleep 600
+      livenessProbe:
+        exec:
+          command:
+            - cat
+            - /tmp/healthy
+        initialDelaySeconds: 5
+        periodSeconds: 5
+    - name: cortexnoliveness
+      image: k8s.gcr.io/busybox
+      args:
+        - /bin/sh
+        - -c
+        - touch /tmp/healthy; sleep 30; rm -rf /tmp/healthy; sleep 600
+---
 apiVersion: apps/v1
 kind: StatefulSet
 metadata:
```

**File**: `tests/kubernetes/checks/test_SuppressedAnnotations.py` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ def test_summary(self):
 
         self.assertEqual(summary['passed'], 0)
         self.assertEqual(summary['failed'], 1)
-        self.assertEqual(summary['skipped'], 8)
+        self.assertEqual(summary['skipped'], 9)
         self.assertEqual(summary['parsing_errors'], 0)
 
 
```

**File**: `tests/kubernetes/test_kubernetes_utils.py` (modified, +66/-0)
```diff
@@ -56,3 +56,69 @@ def test_get_skipped_checks():
         ],
         key=itemgetter("id"),
     )
+
+
+def test_get_skipped_checks_supported_prefixes():
+    # given
+    manifest = {
+        "apiVersion": "v1",
+        "kind": "Pod",
+        "metadata": {
+            "name": "nginx",
+            "annotations": {
+                "checkov.io/skip1": "CKV_K8S_11=checkov prefix",
+                "bridgecrew.io/skip1": "CKV_K8S_14=bridgecrew prefix",
+                "cortex.io/skip1": "CKV_K8S_16=cortex prefix",
+                "__startline__": 6,
+                "__endline__": 9,
+            },
+            "__startline__": 4,
+            "__endline__": 9,
+        },
+        "spec": {"containers": [], "__startline__": 10, "__endline__": 10},
+        "__startline__": 1,
+        "__endline__": 10,
+    }
+
+    # when
+    skipped = get_skipped_checks(entity_conf=manifest)
+
+    # then
+    for skip in skipped:
+        skip.pop("bc_id", None)
+
+    assert sorted(skipped, key=itemgetter("id")) == sorted(
+        [
+            {"id": "CKV_K8S_11", "suppress_comment": "checkov prefix"},
+            {"id": "CKV_K8S_14", "suppress_comment": "bridgecrew prefix"},
+            {"id": "CKV_K8S_16", "suppress_comment": "cortex prefix"},
+        ],
+        key=itemgetter("id"),
+    )
+
+
+def test_get_skipped_checks_ignores_unknown_prefix():
+    # given
+    manifest = {
+        "apiVersion": "v1",
+        "kind": "Pod",
+        "metadata": {
+            "name": "nginx",
+            "annotations": {
+                "example.com/skip1": "CKV_K8S_16=unsupported prefix",
+                "__startline__": 6,
+                "__endline__": 7,
+            },
+            "__startline__": 4,
+            "__endline__": 7,
+        },
+        "spec": {"containers": [], "__startline__": 8, "__endline__": 8},
+        "__startline__": 1,
+        "__endline__": 8,
+    }
+
+    # when
+    skipped = get_skipped_checks(entity_conf=manifest)
+
+    # then
+    assert skipped == []
```

---

### Incident Patch 15: `bbacb3a1` (2026-08-19)
**Commit Message**: fix(sca): correct Windows path handling in image referencer (#7650)

* fix(sca): correct Windows path handling in image referencer rootless paths

* fix(sca): align platform image paths to forward slashes on Windows

* fix(sca): apply Windows path handling only on Windows

* test(sca): drop version-dependent path case from rootless path test

* chore(secrets): bump detect-secrets to 1.5.50

**File**: `checkov/version.py` (modified, +1/-1)
```diff
@@ -1 +1 @@
-version = '3.3.11'
+version = '3.3.12'
```

**File**: `kubernetes/requirements.txt` (modified, +1/-1)
```diff
@@ -1 +1 @@
-checkov==3.3.11
+checkov==3.3.12
```

#### Recent Merged Pull Requests:
- **PR #7712** (2026-10-05): fix(sca): apply --skip-path regex and hidden-dir filtering to sca_package (@omriyoffe-panw)
- **PR #7708** (2026-10-01): chore(secrets): bump bc-detect-secrets from 1.5.50 to 1.5.52 (@mayblo)
- **PR #7707** (2026-09-30): fix(terraform_json): handle HCL JSON array and single-dict block formats in parser (@talazuri)
- **PR #7688** (2026-09-17): fix(secrets): disable spawn mode in frozen environment (@AdamDev)
- **PR #7687** (2026-09-17): chore(general): upgrade parallelism and drain (@GillSami)
- **PR #7677** (2026-09-10): fix(general): honour scope.provider for platform-downloaded custom po… (@mayblo)
- **PR #7676** (2026-09-27): fix(terraform_plan): skip resources being removed from state ('forget' action) (@v3n7i)
- **PR #7662** (closed): fix(terraform): create edges to outputs of modules called with count or for_each (@AlexKantor87)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
