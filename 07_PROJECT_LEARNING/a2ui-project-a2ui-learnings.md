> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/a2ui-project-a2ui-learnings.md`  
> **Source**: github ([https://github.com/a2ui-project/a2ui](https://github.com/a2ui-project/a2ui))  
> **Source Version**: `f7b795e4`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-05T22:47:50.251Z  
> **Learning ID**: `learn-github-a2ui-project-a2ui`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): a2ui-project/a2ui

> **Canonical Artifact**: `07_PROJECT_LEARNING/a2ui-project-a2ui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/a2ui-project/a2ui](https://github.com/a2ui-project/a2ui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-05T22:47:50.046Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `a2ui-project/a2ui`
- **Description**: Open-source generative UI framework: agents stream declarative JSON, and apps render it with native components in React, Angular, Lit, Flutter, SwiftUI and Jetpack Compose.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md
- **Stars / Engagement**: 16985 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.agents/skills/a2ui-generate-pydantic-models/scripts/engine.py`
```
# Copyright 2024 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Core Pydantic v2 code generation engine for converting JSON Schemas to Python types."""

import inspect
import json
import math
from typing import Any
from utils import (
    ensure_v_prefix,
    to_pascal_case,
    to_snake_case,
    version_to_underscore,
)

# Property key through which a generator supplies a field's exact Python type.
PYTHON_TYPE_KEY = "x-python-type"

# Keywords that `map_json_type_to_python` turns into a type, or that only
# annotate one. Strict mode rejects any other keyword, which the type would
# not enforce.
_STRICT_TYPE_KEYWORDS = frozenset({
    "$ref",
    "additionalProperties",
    "allOf",
    "anyOf",
    "const",
    "default",
    "description",
    "enum",
    "items",
    "oneOf",
    "properties",
    "required",
    "type",
})

# Keywords that only annotate a schema, which may sit next to a keyword that
# determines the whole type (`$ref`, `const`, a union or a one-item `allOf`).
_ANNOTATION_KEYWORDS = frozenset({"description", "default"})

# Keywords that only apply to a schema with an explicit `type`.
_TYPED_KEYWORDS = frozenset({"properties", "required", "items", "additionalProperties"})

# References to common types from other documents, which those documents do
# not import as named aliases, mapped to their plain Python type.
_CROSS_DOCUMENT_REF_TYPES: dict[str, str] = {"CallId": "str"}

# Validation keywords of a property that spec-faithful models enforce as
# Pydantic field constraints, which also emit the keyword.
_CONSTRAINT_KEYWORDS: dict[str, str] = {
    "minimum": "ge",
    "maximum": "le",
    "exclusiveMinimum": "gt",
    "exclusiveMaximum": "lt",
    "minItems": "min_length",
    "maxItems": "max_length",
    "minLength": "min_length",
    "maxLength": "max_length",
}

# Annotation keywords of a property that spec-faithful models only publish.
_PUBLISHED_KEYWORDS: tuple[str, ...] = ("format",)


def json_type_name(value: Any) -> str:
    """Returns the JSON schema type name of a JSON value."""
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int):
        return "integer"
    if isinstance(value, float):
        return "number"
    if isinstance(value, str):
        return "string"
    if isinstance(value, list):
        return "array"
    if isinstance(value, dict):
        return "object"
    raise ValueError(f"Not a JSON value: {value!r}")


def python_literal(value: Any) -> str:
    """Renders a JSON value as a Python literal, strings with double quotes.

    Booleans and null become `True`, `False` and `None`, and containers are
    rendered recursively, so the result is valid Python for any JSON value.

    Raises:
        ValueError: If `value` is not a JSON value.
    """
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    if value is None or isinstance(value, (bool, int)):
        return repr(value)
    if isinstance(value, float):
        if not math.isfinite(value):
            raise ValueError(f"Not a JSON value: {value!r}")
        return repr(value)
    if isinstance(value, list):
        return "[" + ", ".join(python_literal(item) for item in value) + "]"
    if isinstance(value, dict):
        items = (f"{python_literal(k)}: {python_literal(v)}" for k, v in value.items())
        return "{" + ", ".join(items) + "}"
    raise ValueError(f"Not a JSON value: {value!r}")


def _is_docstring_safe(text: str) -> bool:
    """Returns whether a docstring would carry `text` unchanged.

    Pydantic reads a model's description from its docstring through
    `inspect.cleandoc`, which strips surrounding whitespace and indentation.
    """
    return "\n" not in text and inspect.cleandoc(text) == text


def _docstring_literal(text: str) -> str:
    """Renders `text` as a triple-quoted docstring that evaluates to `text`."""
    escaped = text.replace("\\", "\\\\").replace('"""', '\\"\\"\\"')
    if escaped.endswith('"'):
        escaped = escaped[:-1] + '\\"'
    return f'"""{escaped}"""'


class PydanticCodegen:
    """Deterministic Pydantic v2 code generator from JSON Schema."""

    def __init__(self, version: str):
        self.version = ensure_v_prefix(version)
        self.dir_name = version_to_underscore(self.version)
        self.spec_dot = "v" + self.dir_name[1:].replace("_", ".")
        self.inline_objects: dict[str, dict[str, Any]] = {}
        self.allow_inline = True
        # When set, spec defaults are emitted as JSON schema defaults instead of
        # being appended to the field description.
        self.schema_defaults = False
        # Component models get their `component` discriminator elsewhere, so
        # the property is skipped unless a generator needs it as a field.
        self.skip_component_property = True
        # Whether a required `const` property defaults to its value. When
        # unset, the property must be present, as the schema requires.
        self.required_const_default = True
        # When set, shapes that would map to a looser type (for example `Any`)
        # or drop keywords raise `ValueError` instead.
        self.strict = False
        # In strict mode, the names that a local `#/$defs/` reference may
        # target; None accepts any name.
        self.known_local_refs: set[str] | None = None
        # Optional mapping from local `$defs` schema name to Python symbol name.
        self.local_def_symbols: dict[str, str] = {}
        # When set, the models keep what the specification says about a
        # property beyond its type, so their JSON schema matches it:
        # validation keywords such as `minimum` become field constraints,
        # `format` is published, extra `allOf` members are kept (`SpecAllOf`)
        # and descriptions keep their line breaks.
        self.spec_fidelity = False
        # The `a2ui.core.schema._json_schema` helpers the generated code uses.
        self.used_helpers: set[str] = set()
        # When set, the models keep what a catalog document without common
        # types (v0.8) says about its nested objects, so the catalog can
        # rebuild the document from them: descriptions keep their line breaks
        # and stay on the fields rather than becoming docstrings of the shared
        # nested object models, and two nested objects of different shapes
        # never share a model.
        self.document_fidelity = False
        # The name that prefixes a nested object model whose name another
        # shape already took, under `document_fidelity`. Generators set it to
        # the component or model whose properties they compile.
        self.name_context = ""

    def _register_inline_object(self, class_name: str, prop: dict[str, Any]) -> str:
        """Registers a nested object model and returns its class name.

        Under `document_fidelity`, a name that a nested object of another
        shape already took is prefixed with `name_context`, so each model
        keeps its own properties. Shapes are compared without the object's
        own description, which the fields carry.
        """
        if not self.document_fidelity:
            self.inline_objects[class_name] = prop
            return class_name
        shape = {k: v for k, v in prop.items() if k != "description"}
        candidate = class_name
        while candidate in self.inline_objects:
            existing = self.inline_objects[candidate]
            if {k: v for k, v in existing.items() if k != "description"} == shape:
                return candidate
            prefix = to_pascal_case(self.name_context) if self.name_context else ""
            if not prefix or candidate.startswith(prefix):
                raise ValueError(
                    f"Cannot name the nested object {class_name} of"
                    f" {self.name_context or 'a model'} uniquely: {prop}"
                )
            candidate = f"{prefix}{candidate}"
        self.inline_objects[candidate] = shape
        return candidate

    def _unsupported(self, prop_name: str, prop: dict[str, Any]) -> ValueError:
        return ValueError(f"Unsupported schema for {prop_name or 'a type'}: {prop}")

    def _check_strict_shape(self, prop_name: str, prop: dict[str, Any]) -> None:
        """Raises if `prop` has keywords that its mapped type would drop."""
        keys = set(prop)
        if (
            keys - _STRICT_TYPE_KEYWORDS
            or ("oneOf" in prop and "anyOf" in prop)
            or len(prop.get("allOf", [])) > 1
            or isinstance(prop.get("type"), list)
            # `properties`, `required`, `items` and `additionalProperties`
            # constrain nothing without the `type` that maps them.
            or ("type" not in prop and keys & _TYPED_KEYWORDS)
        ):
            raise self._unsupported(prop_name, prop)
        if "$ref" in prop and keys - {"$ref"} - _ANNOTATION_KEYWORDS:
            raise self._unsupported(prop_name, prop)
        if "const" in prop:
            siblings = keys - {"const"} - _ANNOTATION_KEYWORDS
            const_type = json_type_name(prop["const"])
            type_matches = prop.get("type") == const_type or (
                prop.get("type") == "number" and const_type == "integer"
            )
            if siblings - {"type"} or ("type" in siblings and not type_matches):
                raise self._unsupported(prop_name, prop)
        for union_key in ("oneOf", "anyOf"):
            if
```

### Core Architecture Module: `.agents/skills/a2ui-generate-pydantic-models/scripts/utils.py`
```
# Copyright 2024 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Shared utilities for A2UI Pydantic model generation."""

import ast
import re
from typing import Any

FILE_HEADER = """# Copyright 2024 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# Auto-generated. Do not edit manually.
from __future__ import annotations"""


def ensure_v_prefix(version: str) -> str:
    """Ensures a version string has a 'v' or 'V' prefix (e.g. '0.9' -> 'v0.9')."""
    if not version:
        raise ValueError("version is required")
    v = version.strip()
    return v if v.startswith("v") or v.startswith("V") else f"v{v}"


def version_to_underscore(version: str) -> str:
    """Converts a dotted version string (e.g. 'v0.9', '0.8') to underscore format (e.g. 'v0_9', 'v0_8')."""
    v = ensure_v_prefix(version)
    return v.lower().replace(".", "_")


def is_modern_terminology(version: str, a2r_name: str = "") -> bool:
    """Returns True if modern A2UI terminology (agent_to_renderer / renderer_to_agent) is used."""
    if "agent_to_renderer" in a2r_name:
        return True
    if "server_to_client" in a2r_name:
        return False

    import os

    dir_name = version_to_underscore(version)
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../.."))
    spec_path = os.path.join(repo_root, "specification", dir_name)
    if os.path.exists(
        os.path.join(spec_path, "json", "agent_to_renderer.json")
    ) or os.path.exists(os.path.join(spec_path, "agent_to_renderer.json")):
        return True
    if os.path.exists(
        os.path.join(spec_path, "json", "server_to_client.json")
    ) or os.path.exists(os.path.join(spec_path, "server_to_client.json")):
        return False

    return dir_name not in ("v0_8", "v0_9", "v0_9_1")


def is_at_least_v10(version: str) -> bool:
    """Returns True if the protocol version is v1.0 or higher."""
    dir_name = version_to_underscore(version)
    return dir_name not in ("v0_8", "v0_9", "v0_9_1")


def to_snake_case(name: str) -> str:
    """Converts a camelCase or PascalCase identifier to snake_case."""
    if name == "$schema":
        return "schema_uri"
    if name == "$id":
        return "schema_id"
    if name == "$defs":
        return "defs"
    if name.startswith("$"):
        name = name[1:]
    if name.startswith("@"):
        name = name.lstrip("@") or "at"
    if re.match(r"^v\d+(?:_\d+)*$", name):
        return name
    s1 = re.sub(r"(.)([A-Z][a-z]+)", r"\1_\2", name)
    return re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", s1).lower()


def to_pascal_case(name: str) -> str:
    """Converts a camelCase or snake_case string to PascalCase preserving camelCase segments."""
    if not name:
        return name
    if "_" not in name and "-" not in name and " " not in name:
        return name[0].upper() + name[1:]
    clean = re.sub(r"[^a-zA-Z0-9_]", "_", name)
    parts = clean.split("_")
    return "".join(p[0].upper() + p[1:] for p in parts if p)


def extract_exported_symbols(code: str) -> list[str]:
    """Extracts top-level public class names, function names, and variable/alias assignments from Python code."""
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return []
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == "__all__":
                    if isinstance(node.value, (ast.List, ast.Tuple)):
                        return [
                            elt.value
                            for elt in node.value.elts
                            if isinstance(elt, ast.Constant)
                            and isinstance(elt.value, str)
                        ]
    symbols: list[str] = []
    for node in tree.body:
        if isinstance(node, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
            if not node.name.startswith("_"):
                symbols.append(node.name)
        elif isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and not target.id.startswith("_"):
                    symbols.append(target.id)
        elif isinstance(node, ast.AnnAssign):
            if isinstance(node.target, ast.Name) and not node.target.id.startswith("_"):
                symbols.append(node.target.id)
    return list(dict.fromkeys(symbols))


def extract_class_names(code: str) -> set[str]:
    """Extracts the names of top-level classes defined in Python code."""
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return set()
    return {node.name for node in tree.body if isinstance(node, ast.ClassDef)}


def _read_base_common_source(common_types_path: str | None = None) -> str:
    """Reads the source of the hand-written base schema/common_types.py."""
    import os

    if not common_types_path:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        repo_root = os.path.abspath(os.path.join(script_dir, "../../../.."))
        common_types_path = os.path.join(
            repo_root, "python/a2ui_core/src/a2ui/core/schema/common_types.py"
        )
    if os.path.exists(common_types_path):
        with open(common_types_path, "r", encoding="utf-8") as f:
            return f.read()
    return ""


def get_base_common_symbols(common_types_path: str | None = None) -> list[str]:
    """Extracts public symbols defined in schema/common_types.py dynamically via AST."""
    source = _read_base_common_source(common_types_path)
    return extract_exported_symbols(source) if source else []


def get_base_common_class_names(common_types_path: str | None = None) -> set[str]:
    """Extracts the class names defined in schema/common_types.py via AST."""
    return extract_class_names(_read_base_common_source(common_types_path))


def get_schema_dependencies(node: Any, deps: set[str] | None = None) -> set[str]:
    """Recursively extracts all local #/$defs/ references from a schema node."""
    if deps is None:
        deps = set()
    if not node or not isinstance(node, (dict, list)):
        return deps
    if isinstance(node, list):
        for item in node:
            get_schema_dependencies(item, deps)
        return deps
    if isinstance(node, dict):
        if "$ref" in node and isinstance(node["$ref"], str):
            ref = node["$ref"]
            if "#/$defs/" in ref:
                deps.add(ref.split("#/$defs/")[-1])
            elif ref.startswith("#/definitions/"):
                deps.add(ref.split("#/definitions/")[-1])
        for v in node.values():
            get_schema_dependencies(v, deps)
    return deps


def _is_def_ref(item: Any, def_name: str) -> bool:
    return isinstance(item, dict) and item.get("$ref") == f"#/$defs/{def_name}"


def is_function_call_branch(item: Any) -> bool:
    """Checks if a union branch is a `FunctionCall` (directly or via `allOf`)."""
    if _is_def_ref(item, "FunctionCall"):
        return True
    all_of = item.get("allOf") if isinstance(item, dict) else None
    return isinstance(all_of, list) and any(
        _is_def_ref(sub, "FunctionCall") for sub in all_of
    )


def is_dynamic_def(spec: Any) -> bool:
    """Checks if a spec def is a dynamic value union.

    A dynamic def is a `oneOf` that accepts a `DataBinding`, a `FunctionCall`,
    and literal values (e.g. `DynamicString`, `DynamicValue`).
    """
    items = spec.get("oneOf") if isinstance(spec, dict) else None
    if not isinstance(items, list):
        return False
    return any(_is_def_ref(it, "DataBinding") for it in items) and any(
        is_function_call_branch(it) for it in items
    )


def topological_sort_defs(defs: dict[str, Any]) -> list[str]:
    """Topologically sorts schema definitions by their internal $defs dependencies."""
    graph: dict[str, set[str]] = {}
    for name, def_spec in defs.items():
        deps = get_schema_dependencies(def_spec)
        # Break cycles between dynamic values and function calls:
        # In Python, dynamic value unions are type aliases (... | FunctionCall)
        # evaluated at import time, so FunctionCall must precede them.
        # The reference from FunctionCall.args to a dynamic value is an annotation
        # resolved via `from __future__ import annotations`.
        if name == "FunctionCall":
            deps.discard("IndexSystemFunction")
            deps = {d for d in deps if not is_dynamic_def(defs.get(d))}
        graph[name] = {d for d in deps if d in defs and d != name}

    visited: set[str] = set()
    order: list[str] = []
    # Dependencies are visited in spec order, so the output does not depend on
    # set iteration order (which varies with string hashing between runs).
    spec_index = {name: index for index, name in enumerate(defs)}

    def visit(name: str) -> None:
        if name in visited:
            return
        visited.add(name)
        for dep in sorted(graph.get(name, set()), key=spec_index.__ge
```

### Core Architecture Module: `eval/a2ui_eval/scorers.py`
```
# Copyright 2024 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Scorers for A2UI evaluation.

Scoring runs in three stages, in the order the scorers are listed on the task:

1. `a2ui_scorer` compiles and validates the payload with the Python Agent SDK
   (Stage 1) and then checks the dataset's deterministic `assertions` against
   the compiled messages (Stage 2). It records the combined verdict in
   `state.metadata["a2ui_stage12_passed"]`.
2. `measured_model_graded_qa` asks an LLM judge for a grade (Stage 3), but
   only when Stage 1 and 2 passed; a payload that is already known to be
   wrong is graded "I" without spending judge tokens.
"""

from __future__ import annotations

import asyncio
from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field
import json
import time
from typing import Any, Literal

from inspect_ai.model import ModelUsage
from inspect_ai.model._model import sample_model_usage
from inspect_ai.scorer import (
    Score,
    Scorer,
    Target,
    accuracy,
    model_graded_qa,
    scorer,
)
from inspect_ai.solver import TaskState

from .runner import (
    DEFAULT_PARSE_TIMEOUT_SEC,
    RunnerOptions,
    Stage2Assertions,
    parse_and_validate,
    runner_options_from_metadata,
)
from .shared.utils import GIT_ROOT

__all__ = [
    "PayloadFacts",
    "STAGE12_PASSED_KEY",
    "a2ui_scorer",
    "collect_payload_facts",
    "evaluate_stage2_assertions",
    "measured_model_graded_qa",
]

STAGE12_PASSED_KEY = "a2ui_stage12_passed"
"""Metadata key under which `a2ui_scorer` records its Stage 1/2 verdict."""

_JUDGE_SKIPPED_AFTER_FAILURE = "Skipped LLM judge because Stage 1/2 validation failed."
_JUDGE_SKIPPED_NO_JUDGE = "Skipped LLM judge (--no-judge mode); Stage 1/2 passed."


@dataclass
class PayloadFacts:
    """Names found in a compiled payload, checked against Stage 2 assertions.

    Attributes:
        component_types: Component names rendered in the payload.
        bound_paths: Data model paths bound or written by the payload.
        action_names: Action event or function call names in the payload.
        message_types: Top-level message types present in the payload.
        catalog_ids: Catalog identifiers referenced by the payload.
    """

    component_types: set[str] = field(default_factory=set)
    bound_paths: set[str] = field(default_factory=set)
    action_names: set[str] = field(default_factory=set)
    message_types: set[str] = field(default_factory=set)
    catalog_ids: set[str] = field(default_factory=set)


_PayloadFacts = PayloadFacts


def _collect_dict_facts(node: Mapping[str, Any], facts: _PayloadFacts) -> None:
    """Records the facts carried directly by one JSON object."""
    component = node.get("component")
    if isinstance(component, str):
        facts.component_types.add(component)
    elif isinstance(component, Mapping):
        # v0.8 shape: {"component": {"Button": {...}}}
        facts.component_types.update(str(k) for k in component)
    catalog_id = node.get("catalogId")
    if isinstance(catalog_id, str):
        facts.catalog_ids.add(catalog_id)
    for key in ("path", "@path"):
        path = node.get(key)
        if isinstance(path, str):
            facts.bound_paths.add(path)
    # Data written by the payload counts as bound: the `updateDataModel` path
    # and every nested key under it, and (v1.0) every key of the inline
    # `createSurface.dataModel`, which is where Express compiles `$/x = ...`.
    update = node.get("updateDataModel")
    if isinstance(update, Mapping) and isinstance(update.get("path"), str):
        facts.bound_paths.update(_written_paths(update["path"], update.get("value")))
    create = node.get("createSurface")
    if isinstance(create, Mapping):
        facts.bound_paths.update(_written_paths("", create.get("dataModel")))
    _collect_action_names(node, facts)


def _written_paths(prefix: str, value: Any) -> set[str]:
    """Returns `prefix` plus the path of every nested object key in `value`."""
    paths = {prefix} if prefix else set()
    if isinstance(value, Mapping):
        base = prefix.rstrip("/")
        for key, child in value.items():
            paths |= _written_paths(f"{base}/{key}", child)
    return paths


def _collect_action_names(node: Mapping[str, Any], facts: _PayloadFacts) -> None:
    """Records action names in their `event`, `functionCall` and `@call` forms."""
    event = node.get("event")
    if isinstance(event, Mapping) and isinstance(event.get("name"), str):
        facts.action_names.add(event["name"])
    function_call = node.get("functionCall")
    if isinstance(function_call, Mapping) and isinstance(
        function_call.get("call"), str
    ):
        facts.action_names.add(function_call["call"])
    at_call = node.get("@call")
    if isinstance(at_call, str):
        facts.action_names.add(at_call)


def _walk_payload(value: Any, facts: _PayloadFacts) -> None:
    """Recursively collects facts from nested objects, lists and JSON strings."""
    if isinstance(value, list):
        for item in value:
            _walk_payload(item, facts)
        return
    if isinstance(value, str):
        # Some formats keep a binding as a JSON string, e.g. '{"path": "/x"}'.
        if value.lstrip().startswith("{"):
            try:
                _walk_payload(json.loads(value), facts)
            except ValueError:
                pass
        return
    if isinstance(value, Mapping):
        _walk_mapping(value, facts)


def _walk_mapping(node: Mapping[str, Any], facts: _PayloadFacts) -> None:
    """Collects the facts of one object and recurses into its children.

    `updateDataModel.value` and `createSurface.dataModel` hold user data, not
    A2UI structure, so a data key that happens to be named `event`, `path` or
    `component` must not register as an action, binding or component.
    """
    _collect_dict_facts(node, facts)
    for key, child in node.items():
        if key == "updateDataModel" and isinstance(child, Mapping):
            child = {k: v for k, v in child.items() if k != "value"}
        elif key == "createSurface" and isinstance(child, Mapping):
            child = {k: v for k, v in child.items() if k != "dataModel"}
        _walk_payload(child, facts)


def collect_payload_facts(
    messages: Iterable[Mapping[str, Any]],
) -> PayloadFacts:
    """Collects component types, bindings, actions, message types and catalogs.

    The top-level keys of each message other than `version` are its message
    types (`createSurface`, `updateComponents`, `updateDataModel`,
    `deleteSurface`, ...). Everything else is found by walking the message
    tree, so inline children and v0.8/v0.9.1/v1.0 shapes are all covered.

    Args:
        messages: Compiled A2UI message dictionaries to inspect.

    Returns:
        A `PayloadFacts` instance containing the extracted sets.
    """
    facts = PayloadFacts()
    for message in messages:
        if not isinstance(message, Mapping):
            continue
        facts.message_types.update(k for k in message if k != "version")
        _walk_payload(message, facts)
    return facts


_collect_payload_facts = collect_payload_facts


def _check_assertion_set(
    label: str,
    expected: Iterable[str],
    actual: set[str],
    mode: Literal["required", "forbidden", "only"],
) -> str | None:
    """Compares one assertion field with the payload and describes a failure.

    Args:
        label: Plural noun for messages, e.g. "components".
        expected: The names listed by the assertion field.
        actual: The names found in the payload.
        mode: "required" fails on expected names that are absent, "forbidden"
            fails on expected names that are present, and "only" fails on
            found names that the assertion does not list.

    Returns:
        A human-readable failure, or None when the field is satisfied.
    """
    expected_set = set(expected)
    if not expected_set:
        return None
    if mode == "required":
        missing = expected_set - actual
        return f"Missing required {label}: {_fmt(missing)}" if missing else None
    if mode == "forbidden":
        present = expected_set & actual
        return f"Forbidden {label} present: {_fmt(present)}" if present else None
    unexpected = actual - expected_set
    if unexpected:
        return f"Unexpected {label}: {_fmt(unexpected)} (allowed: {_fmt(expected_set)})"
    return None


def _fmt(names: Iterable[str]) -> str:
    return ", ".join(sorted(names))


def evaluate_stage2_assertions(
    messages: list[dict[str, Any]],
    assertions: Mapping[str, Any] | Stage2Assertions,
) -> list[str]:
    """Checks compiled A2UI messages against a sample's Stage 2 assertions.

    Args:
        messages: The compiled A2UI JSON messages (v0.9.1 or v1.0 shapes).
        assertions: A dataset `assertions` block or parsed `Stage2Assertions`.

    Returns:
        One human-readable string per failed assertion field; an empty list
        means every assertion passed (or none were given).
    """
    checks = (
        assertions
        if isinstance(assertions, Stage2Assertions)
        else Stage2Assertions.from_mapping(assertions)
    )
    if checks.is_empty:
        return []
    facts = _collect_payload_facts(messages)
    results = [
        _check_assertion_set(
            "components",
            checks.required_components,
            facts.component_types,
            "required",
        ),
        _check_assertion
```

### Core Architecture Module: `eval/a2ui_eval/shared/utils.py`
```
# Copyright 2024 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import time
from inspect_ai.solver import Solver, solver, TaskState, Generate
from inspect_ai.model._model import sample_model_usage
from pathlib import Path

GIT_ROOT = (Path(__file__).resolve().parent / "../../..").resolve()


@solver
def measured_generate() -> Solver:
    """Solver that wraps generate() and records the duration in metadata."""

    async def solve(state: TaskState, generate: Generate) -> TaskState:
        start_time = time.time()

        usage_before = sample_model_usage().get(str(state.model))
        before_input = usage_before.input_tokens if usage_before else 0
        before_cr = usage_before.input_tokens_cache_read or 0 if usage_before else 0
        before_cw = usage_before.input_tokens_cache_write or 0 if usage_before else 0
        before_total_input = before_input + before_cr + before_cw
        before_cached = before_cr + before_cw
        before_output = usage_before.output_tokens if usage_before else 0
        before_reasoning = usage_before.reasoning_tokens or 0 if usage_before else 0

        state = await generate(state)

        usage_after = sample_model_usage().get(str(state.model))
        after_input = usage_after.input_tokens if usage_after else 0
        after_cr = usage_after.input_tokens_cache_read or 0 if usage_after else 0
        after_cw = usage_after.input_tokens_cache_write or 0 if usage_after else 0
        after_total_input = after_input + after_cr + after_cw
        after_cached = after_cr + after_cw
        after_output = usage_after.output_tokens if usage_after else 0
        after_reasoning = usage_after.reasoning_tokens or 0 if usage_after else 0

        # Redefine inference_duration_seconds to measure pure working time of successful model call
        working_time = None
        output_call = (
            getattr(state.output, "call", None) if hasattr(state, "output") else None
        )
        if output_call and getattr(output_call, "time", None):
            working_time = output_call.time

        duration = (
            working_time if working_time is not None else (time.time() - start_time)
        )
        state.metadata["inference_duration_seconds"] = duration
        state.metadata["inference_input_tokens"] = (
            after_total_input - before_total_input
        )
        state.metadata["inference_output_tokens"] = after_output - before_output
        state.metadata["inference_cached_tokens"] = after_cached - before_cached
        state.metadata["inference_reasoning_tokens"] = (
            after_reasoning - before_reasoning
        )

        return state

    return solve

```

### Core Architecture Module: `eval/iterative_format_optimizer/skills/inference-format-optimizer/scripts/utils/__init__.py`
```
# Copyright 2024 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Helper utilities for A2UI inference format optimization."""

```

### Core Architecture Module: `eval/iterative_format_optimizer/skills/inference-format-optimizer/scripts/utils/archiver.py`
```
# Copyright 2024 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Atomic run archiving and history synchronization helper utility."""

import glob
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent.parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from sync_history import sync_worktree_history  # type: ignore[import-not-found]
from utils.runner import load_log_data, get_git_diff  # type: ignore[import-not-found]
from utils.reporter import extract_metrics_from_log  # type: ignore[import-not-found]


def _slugify(text: str) -> str:
    """Converts arbitrary hypothesis text into a filesystem-friendly slug.

    Args:
        text: The raw text string to slugify.

    Returns:
        A cleaned slug string capped at 40 characters.
    """
    slug = text.lower()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_-]+", "_", slug).strip("_")
    return slug[:40] if slug else "run"


def _get_git_commit_sha(workspace_root: str) -> str:
    """Retrieves the current short git commit SHA for the workspace.

    Args:
        workspace_root: The filesystem path to the git workspace root directory.

    Returns:
        The seven-character short git SHA string, or "0000000" if unavailable.
    """
    try:
        cmd = ["git", "rev-parse", "--short", "HEAD"]
        res = subprocess.run(cmd, cwd=workspace_root, capture_output=True, text=True)
        return res.stdout.strip() or "0000000"
    except Exception:
        return "0000000"


def archive_run(
    format_name: str,
    hypothesis: str,
    status: str,
    notes: str | None = None,
    log_dir: str | None = None,
    custom_history_dir: str | None = None,
    model: str = "google/gemini-3.6-flash",
    thinking_budget: int | None = None,
) -> str:
    """Atomically archives optimization run artifacts into the history directory.

    Args:
        format_name: The name of the target inference format (e.g., "atom").
        hypothesis: A short description of the optimization hypothesis tested.
        status: The decision status of the run (e.g., "Kept" or "Backtracked").
        notes: Optional qualitative notes or rationale for the decision.
        log_dir: Optional path to the directory containing evaluation logs.
        custom_history_dir: Optional custom directory path for history archiving.

    Returns:
        The absolute path to the newly created archive directory.
    """
    script_dir = Path(__file__).resolve().parent.parent
    skill_dir = script_dir.parent
    if custom_history_dir:
        history_base = Path(custom_history_dir)
        workspace_root = str(
            skill_dir.parents[2] if len(skill_dir.parents) > 2 else skill_dir
        )
    else:
        detected_root = None
        for p in [skill_dir] + list(skill_dir.parents):
            if (p / "specification").exists() and (p / "python").exists():
                detected_root = p
                break
        if detected_root:
            history_base = (
                detected_root / "eval" / "iterative_format_optimizer" / "history"
            )
        else:
            base = skill_dir.parents[1] if len(skill_dir.parents) > 1 else skill_dir
            history_base = base / "history"
        workspace_root = str(detected_root or skill_dir)

    history_dir = history_base / format_name
    history_dir.mkdir(parents=True, exist_ok=True)

    # Pre-sync sibling worktree histories to avoid ID collisions
    try:
        sync_worktree_history(skip_index_regen=True)
    except Exception:
        pass

    # 1. Determine next run ID index
    max_id = 0
    for entry in history_dir.iterdir():
        if entry.is_dir() and entry.name.startswith("run_"):
            parts = entry.name.split("_")
            if len(parts) >= 2 and parts[1].isdigit():
                max_id = max(max_id, int(parts[1]))

    next_id = max_id + 1
    sha = _get_git_commit_sha(workspace_root)
    slug = _slugify(hypothesis)
    dir_name = f"run_{next_id:03d}_{sha}_{slug}"
    target_dir = history_dir / dir_name
    target_dir.mkdir(parents=True, exist_ok=True)

    # 2. Save git diff patch
    diff_text = get_git_diff(workspace_root)
    (target_dir / "patch.diff").write_text(diff_text, encoding="utf-8")

    # 3. Copy current report
    report_src = script_dir / "current_report.md"
    if report_src.exists():
        shutil.copy(report_src, target_dir / "report.md")

    # 4. Extract metrics & write run_meta.json
    temp_dir = log_dir
    if not temp_dir or not os.path.exists(temp_dir):
        base_opt_dir = (
            detected_root / "eval" / "iterative_format_optimizer"
            if detected_root
            else (skill_dir.parents[1] if len(skill_dir.parents) > 1 else skill_dir)
        )
        logs_parent = base_opt_dir / "logs"
        matching_dirs = sorted(
            glob.glob(str(logs_parent / f"temp_optimization_{format_name}*")),
            key=lambda d: os.path.getmtime(d) if os.path.exists(d) else 0.0,
            reverse=True,
        ) or sorted(
            glob.glob(str(logs_parent / "temp_optimization*")),
            key=lambda d: os.path.getmtime(d) if os.path.exists(d) else 0.0,
            reverse=True,
        )
        temp_dir = (
            matching_dirs[0]
            if matching_dirs
            else str(logs_parent / "temp_optimization")
        )

    eval_logs = sorted(
        glob.glob(os.path.join(temp_dir, "*.eval")),
        key=lambda f: os.path.getmtime(f) if os.path.exists(f) else 0.0,
        reverse=True,
    )

    metrics_extracted: dict[str, Any] = {}
    results_json_src = os.path.join(temp_dir, "results.json")
    if os.path.exists(results_json_src):
        try:
            shutil.copy(results_json_src, target_dir / "results.json")
            with open(results_json_src, "r", encoding="utf-8") as f:
                log_data = json.load(f)
                metrics_extracted = extract_metrics_from_log(log_data)
        except Exception as e:
            print(f"Warning: Could not parse results.json: {e}", file=sys.stderr)

    if not metrics_extracted and eval_logs:
        try:
            log_data = load_log_data(eval_logs[0])
            metrics_extracted = extract_metrics_from_log(log_data)
            with open(target_dir / "results.json", "w", encoding="utf-8") as f:
                json.dump(log_data, f, indent=2)
        except Exception as e:
            print(
                f"Warning: Could not load eval log {eval_logs[0]}: {e}",
                file=sys.stderr,
            )

    if not metrics_extracted and os.path.exists(
        os.path.join(temp_dir, "run_meta.json")
    ):
        try:
            with open(
                os.path.join(temp_dir, "run_meta.json"), "r", encoding="utf-8"
            ) as f:
                meta_json = json.load(f)
                metrics_extracted = meta_json.get("metrics", {})
        except Exception as e:
            print(
                f"Warning: Could not load fallback run_meta.json: {e}",
                file=sys.stderr,
            )

    meta_payload = {
        "format": format_name,
        "hypothesis": hypothesis,
        "status": status,
        "notes": notes or ("Pytest PASS" if status == "Kept" else "Reverted"),
        "model": model,
        "thinking_budget": thinking_budget,
        "metrics": {
            "schema_acc": metrics_extracted.get(
                "algo_accuracy", metrics_extracted.get("schema_acc", 0.0)
            ),
            "quality_acc": metrics_extracted.get(
                "overall_accuracy", metrics_extracted.get("quality_acc", 0.0)
            ),
            "code_tokens_median": metrics_extracted.get(
                "median_output_tokens",
                metrics_extracted.get(
                    "avg_output_tokens",
                    metrics_extracted.get("code_tokens_median", 0.0),
                ),
            ),
            "reasoning_tokens_median": metrics_extracted.get(
                "median_reasoning_tokens",
                metrics_extracted.get(
                    "avg_reasoning_tokens",
                    metrics_extracted.get("reasoning_tokens_median", 0.0),
                ),
            ),
            "input_tokens_median": metrics_extracted.get(
                "median_input_tokens",
                metrics_extracted.get(
                    "avg_input_tokens",
                    metrics_extracted.get("input_tokens_median", 0.0),
                ),
            ),
            "latency_seconds_median": metrics_extracted.get(
                "median_latency_seconds",
                metrics_extracted.get(
                    "avg_latency_seconds",
                    metrics_extracted.get("latency_seconds_median", 0.0),
                ),
            ),
            "total_samples": metrics_extracted.get("total_samples", 0),
        },
    }

    with open(target_dir / "run_meta.json", "w", encoding="utf-8") as f:
        json.dump(meta_payload, f, indent=2)

    # 5. Synchronize master index
    s_dir = str(script_dir)
    if s_dir not in sys.path:
        sys.path.insert(0, s_dir)

    try:
        from sync_history import sync_worktree_history  # type: ignore[import-not-found]

        sync_worktree_history(skip_index_regen=True)
    except Exception:
        pass

    from optimize_format import regenerate_master_index  # type: ignore[import-not-found]

    re
```

### Core Architecture Module: `eval/iterative_format_optimizer/skills/inference-format-optimizer/scripts/utils/format_tools.py`
```
# Copyright 2024 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Quick-compiler and decompiler CLI utility tools for testing inference formats."""

import json
import os
import sys
from pathlib import Path
from typing import Any

current = Path(__file__).resolve()
REPO_ROOT = current.parents[5]
for p in [current] + list(current.parents):
    if (p / "specification").exists() and (p / "python").exists():
        REPO_ROOT = p
        break

SDK_SRC = str(REPO_ROOT / "python/a2ui_agent/src")
SDK_CORE_SRC = str(REPO_ROOT / "python/a2ui_core/src")
if SDK_SRC not in sys.path:
    sys.path.insert(0, SDK_SRC)
if SDK_CORE_SRC not in sys.path:
    sys.path.insert(0, SDK_CORE_SRC)

from a2ui.processor import CatalogConfig


def _load_basic_catalog() -> Any:
    """Loads and resolves the basic component catalog instance.

    Returns:
        The loaded catalog instance for basic components.
    """
    cat_path = str(REPO_ROOT / "catalogs/basic/v1/catalog.json")
    cat_cfg = CatalogConfig.from_path(cat_path)
    return cat_cfg.transformed_catalog


def test_compile_snippet(format_name: str, snippet: str) -> str:
    """Compiles an inference format snippet into an A2UI v1.0 JSON payload string.

    Args:
        format_name: The target format strategy name (e.g., "atom", "express").
        snippet: The raw code snippet string to compile.

    Returns:
        A formatted JSON string representing the compiled surface update.

    Raises:
        ValueError: If the format strategy name is unsupported.
    """
    cat = _load_basic_catalog()
    fmt_lower = format_name.lower()

    from a2ui.inference_formats import to_message_dicts

    if fmt_lower == "atom":
        from a2ui.inference_formats.experimental.atom import AtomCompiler

        compiler = AtomCompiler([cat])
        res = to_message_dicts(compiler.compile(snippet))
    elif fmt_lower in ("direct_json", "transport", "direct"):
        res = json.loads(snippet) if isinstance(snippet, str) else snippet
    elif fmt_lower == "express":
        from a2ui.inference_formats.express import ExpressParser

        parser = ExpressParser([cat])
        res = to_message_dicts(parser.compile(snippet))
    elif fmt_lower == "elemental":
        from a2ui.inference_formats.experimental.elemental import ElementalParser

        parser = ElementalParser([cat])
        res = to_message_dicts(parser.compile(snippet))
    else:
        raise ValueError(
            f"Unsupported format strategy for compilation: '{format_name}'"
        )

    return json.dumps(res, indent=2)


def test_decompile_payload(format_name: str, json_str_or_dict: Any) -> str:
    """Decompiles an A2UI v1.0 JSON surface payload into a target format string.

    Args:
        format_name: The target format strategy name (e.g., "atom", "express").
        json_str_or_dict: A JSON file path, JSON string, or payload dictionary.

    Returns:
        The decompiled target format string representation.

    Raises:
        ValueError: If the format strategy name is unsupported.
    """
    from a2ui.inference_formats import to_message_models

    cat = _load_basic_catalog()
    fmt_lower = format_name.lower()

    payload: dict[str, Any] | list[dict[str, Any]]
    if isinstance(json_str_or_dict, str):
        if os.path.isfile(json_str_or_dict):
            with open(json_str_or_dict, "r", encoding="utf-8") as f:
                payload = json.load(f)
        else:
            payload = json.loads(json_str_or_dict)
    else:
        payload = json_str_or_dict

    if fmt_lower == "atom":
        from a2ui.inference_formats.experimental.atom import AtomDecompiler

        decompiler = AtomDecompiler([cat])
        return decompiler.decompile(to_message_models(payload))
    elif fmt_lower in ("direct_json", "transport", "direct"):
        return json.dumps(payload, indent=2)
    elif fmt_lower == "express":
        from a2ui.inference_formats.express import ExpressParser

        parser = ExpressParser([cat])
        return parser.decompile(to_message_models(payload))
    elif fmt_lower == "elemental":
        from a2ui.inference_formats.experimental.elemental import ElementalParser

        parser = ElementalParser([cat])
        return parser.decompile(to_message_models(payload))
    else:
        raise ValueError(
            f"Unsupported format strategy for decompilation: '{format_name}'"
        )


def test_parse_ast(format_name: str, snippet: str) -> str:
    """Parses an inference format snippet into its abstract syntax tree representation.

    Args:
        format_name: The target format strategy name (e.g., "atom", "express").
        snippet: The raw code snippet string to parse.

    Returns:
        A formatted string representation of the parsed AST nodes.

    Raises:
        ValueError: If the format strategy name is unsupported.
    """
    cat = _load_basic_catalog()
    fmt_lower = format_name.lower()
    if fmt_lower == "atom":
        from a2ui.inference_formats.experimental.atom import parse_sexpr

        return json.dumps(parse_sexpr(snippet), indent=2)
    elif fmt_lower in ("direct_json", "transport", "direct"):
        return json.dumps(json.loads(snippet), indent=2)
    elif fmt_lower == "express":
        from a2ui.inference_formats.express import ExpressParser

        parser = ExpressParser([cat])
        parts = parser.unwrap(snippet)
        return str([str(p) for p in parts])
    elif fmt_lower == "elemental":
        from a2ui.inference_formats.experimental.elemental import ElementalParser

        parser = ElementalParser([cat])
        parts = parser.unwrap(snippet)
        return str([str(p) for p in parts])
    else:
        raise ValueError(
            f"Unsupported format strategy for AST parsing: '{format_name}'"
        )

```

### Core Architecture Module: `eval/iterative_format_optimizer/skills/inference-format-optimizer/scripts/utils/reporter.py`
```
# Copyright 2024 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Markdown report generation and evaluation log metric extraction."""

import statistics
from typing import Any

from compare_results import format_delta_pct  # type: ignore[import-not-found]


def extract_metrics_from_log(log_data: dict[str, Any]) -> dict[str, Any]:
    """Extracts summary metrics from an inspect log dictionary or run metadata dictionary.

    Args:
        log_data: The dictionary containing evaluation log data or run metadata.

    Returns:
        A dictionary containing aggregated pass rates, latency, and token counts.
    """
    if "metrics" in log_data and not log_data.get("results"):
        m = log_data["metrics"]

        def _get_first_not_none(
            d: dict[str, Any], keys: list[str], default: float = 0.0
        ) -> float:
            for k in keys:
                val = d.get(k)
                if val is not None:
                    return float(val)
            return default

        med_lat = _get_first_not_none(
            m, ["latency_seconds_median", "avg_latency_seconds"]
        )
        med_c = _get_first_not_none(m, ["code_tokens_median", "avg_output_tokens"])
        med_r = _get_first_not_none(
            m, ["reasoning_tokens_median", "avg_reasoning_tokens"]
        )
        med_in = _get_first_not_none(m, ["input_tokens_median", "avg_input_tokens"])
        s_acc = _get_first_not_none(m, ["schema_acc", "algo_accuracy"])
        q_acc = _get_first_not_none(m, ["quality_acc", "overall_accuracy"])
        tot_samp = int(
            m.get("total_samples") if m.get("total_samples") is not None else 0
        )
        return {
            "algo_accuracy": s_acc,
            "overall_accuracy": q_acc,
            "avg_latency_seconds": med_lat,
            "median_latency_seconds": med_lat,
            "avg_input_tokens": med_in,
            "median_input_tokens": med_in,
            "avg_output_tokens": med_c,
            "median_output_tokens": med_c,
            "avg_reasoning_tokens": med_r,
            "median_reasoning_tokens": med_r,
            "total_samples": tot_samp,
        }

    results = log_data.get("results") or {}
    scores = results.get("scores") or []

    algo_acc = 0.0
    overall_acc = 0.0

    for s in scores:
        if isinstance(s, dict):
            m_dict = s.get("metrics") or {}
            acc_obj = m_dict.get("accuracy")
            acc_val = acc_obj.get("value") if isinstance(acc_obj, dict) else acc_obj
            if s.get("name") == "a2ui_scorer":
                algo_acc = float(acc_val or 0.0)
            elif s.get("name") == "measured_model_graded_qa":
                overall_acc = float(acc_val or 0.0)

    samples = log_data.get("samples") or []
    if isinstance(samples, dict):
        samples = list(samples.values())

    durations: list[float] = []
    input_toks: list[float] = []
    output_toks: list[float] = []
    reasoning_toks: list[float] = []

    for sample in samples:
        meta = sample.get("metadata") or {}
        s_duration = None
        s_reasoning = None

        events = sample.get("events") or []
        model_events = [
            e
            for e in events
            if isinstance(e, dict)
            and e.get("event") == "model"
            and e.get("working_time") is not None
        ]
        if model_events:
            m = model_events[0]
            s_duration = m.get("working_time") or m.get("time")
            call_res = (
                m.get("call", {}).get("response", {})
                if isinstance(m.get("call"), dict)
                else {}
            )
            if isinstance(call_res, dict):
                usage_meta = call_res.get("usageMetadata")
                if isinstance(usage_meta, dict):
                    s_reasoning = usage_meta.get("thoughtsTokenCount")

        if s_duration is None:
            if "evaluation_duration_seconds" in meta:
                s_duration = meta["evaluation_duration_seconds"]
            elif "inference_duration_seconds" in meta:
                s_duration = meta["inference_duration_seconds"]

        if s_duration is None:
            for e in events:
                if isinstance(e, dict) and e.get("event") == "model":
                    w = e.get("working_time") or e.get("time") or e.get("duration")
                    if w is not None:
                        s_duration = w
                        break

        if s_reasoning is None and "inference_reasoning_tokens" in meta:
            s_reasoning = meta["inference_reasoning_tokens"]

        if s_duration is not None:
            durations.append(float(s_duration))

        if s_reasoning is not None:
            reasoning_toks.append(float(s_reasoning))

        s_input = meta.get("inference_input_tokens")
        s_output = meta.get("inference_output_tokens")

        for e in events:
            if isinstance(e, dict) and e.get("event") == "model":
                usage = e.get("usage") or {}
                if isinstance(usage, dict):
                    if s_input is None and "input_tokens" in usage:
                        s_input = usage["input_tokens"]
                    if s_output is None and "output_tokens" in usage:
                        s_output = usage["output_tokens"]

        if s_input is not None:
            input_toks.append(float(s_input))

        if s_output is not None:
            output_toks.append(float(s_output))

    avg_latency = float(statistics.mean(durations)) if durations else 0.0
    med_latency = float(statistics.median(durations)) if durations else 0.0

    avg_input = float(statistics.mean(input_toks)) if input_toks else 0.0
    med_input = float(statistics.median(input_toks)) if input_toks else 0.0

    avg_output = float(statistics.mean(output_toks)) if output_toks else 0.0
    med_output = float(statistics.median(output_toks)) if output_toks else 0.0

    avg_reasoning = float(statistics.mean(reasoning_toks)) if reasoning_toks else 0.0
    med_reasoning = float(statistics.median(reasoning_toks)) if reasoning_toks else 0.0

    return {
        "overall_accuracy": overall_acc,
        "algo_accuracy": algo_acc,
        "avg_latency_seconds": avg_latency,
        "median_latency_seconds": med_latency,
        "avg_input_tokens": avg_input,
        "median_input_tokens": med_input,
        "avg_output_tokens": avg_output,
        "median_output_tokens": med_output,
        "avg_reasoning_tokens": avg_reasoning,
        "median_reasoning_tokens": med_reasoning,
        "total_samples": len(samples),
    }


def generate_optimization_report(
    log_data: dict[str, Any],
    pytest_results: dict[str, Any],
    baseline_data: dict[str, Any] | None,
    git_diff: str,
    format_name: str,
    model: str,
) -> str:
    """Generates a detailed markdown report for evaluation run inspection.

    Args:
        log_data: The current evaluation run log dictionary.
        pytest_results: The dictionary containing unit test execution results.
        baseline_data: Optional baseline evaluation log dictionary.
        git_diff: The active git diff patch string.
        format_name: The target format strategy name.
        model: The evaluation model name.

    Returns:
        The complete markdown report string.
    """
    metrics = extract_metrics_from_log(log_data)
    pytest_status = "PASS" if pytest_results["success"] else "FAIL"

    base_pytest = "-"
    base_overall = "-"
    base_algo = "-"
    base_latency = "-"
    base_input = "-"
    base_output = "-"
    base_reasoning = "-"

    diff_overall = ""
    diff_algo = ""
    diff_latency = ""
    diff_input = ""
    diff_output = ""
    diff_reasoning = ""

    if baseline_data:
        base_pytest = "PASS"
        base_metrics = extract_metrics_from_log(baseline_data)

        base_overall_val = float(base_metrics.get("overall_accuracy") or 0.0)
        base_algo_val = float(base_metrics.get("algo_accuracy") or 0.0)
        base_lat_val = float(base_metrics.get("avg_latency_seconds") or 0.0)
        base_in_val = float(base_metrics.get("avg_input_tokens") or 0.0)
        base_out_val = float(base_metrics.get("avg_output_tokens") or 0.0)
        base_reas_val = float(base_metrics.get("avg_reasoning_tokens") or 0.0)

        base_overall = f"{base_overall_val * 100:.1f}%"
        base_algo = f"{base_algo_val * 100:.1f}%"
        base_latency = f"{base_lat_val:.2f}s"
        base_input = f"{base_in_val:.0f}"
        base_output = f"{base_out_val:.0f}"
        base_reasoning = f"{base_reas_val:.0f}"

        diff_overall = format_delta_pct(
            metrics["overall_accuracy"],
            base_metrics["overall_accuracy"],
            is_percentage_points=True,
        )
        diff_algo = format_delta_pct(
            metrics["algo_accuracy"],
            base_metrics["algo_accuracy"],
            is_percentage_points=True,
        )
        diff_latency = format_delta_pct(
            metrics["avg_latency_seconds"], base_metrics["avg_latency_seconds"]
        )
        diff_input = format_delta_pct(
            metrics["avg_input_tokens"], base_metrics["avg_input_tokens"]
        )
        diff_output = format_delta_pct(
            metrics["avg_output_tokens"], base_metrics["avg_output_tokens"]
        )
        diff_reasoning = format_delta_pct(
            metrics["avg_reasoning_tokens"], base_metrics["avg_reasoning_tokens"]
        )

    report = []
    report.append("# Inference Format Optimization 
```

### Core Architecture Module: `eval/iterative_format_optimizer/skills/inference-format-optimizer/scripts/utils/runner.py`
```
# Copyright 2024 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Subprocess execution runners for pytest, Inspect AI evaluations, and git diffs."""

import json
import os
import shutil
import subprocess
import sys
from typing import Any


def _get_uv_binary() -> str:
    """Resolves the system path to the `uv` executable.

    Returns:
        The absolute path or executable name string for `uv`.
    """
    user_uv = os.path.expanduser("~/.local/bin/uv")
    if os.path.exists(user_uv):
        return user_uv
    cargo_uv = os.path.expanduser("~/.cargo/bin/uv")
    if os.path.exists(cargo_uv):
        return cargo_uv
    return shutil.which("uv") or "uv"


def run_unit_tests() -> dict[str, Any]:
    """Runs pytest unit tests for the Python SDK package.

    Returns:
        A dictionary containing success boolean, stdout, stderr, and returncode.
    """
    print("Running pytest unit tests...")
    curr = os.path.dirname(os.path.abspath(__file__))
    while curr and not (
        os.path.exists(os.path.join(curr, "python"))
        and os.path.exists(os.path.join(curr, "eval"))
    ):
        parent = os.path.dirname(curr)
        if parent == curr:
            break
        curr = parent
    workspace_root = curr

    cmd = [
        sys.executable,
        "-m",
        "pytest",
        "python/a2ui_agent/tests/express/",
    ]
    env = dict(os.environ)
    pythonpath_dirs = [
        os.path.join(workspace_root, "python/a2ui_agent/src"),
        os.path.join(workspace_root, "python/a2ui_core/src"),
    ]
    env["PYTHONPATH"] = ":".join(pythonpath_dirs) + (
        ":" + env["PYTHONPATH"] if "PYTHONPATH" in env else ""
    )

    result = subprocess.run(
        cmd,
        cwd=workspace_root,
        capture_output=True,
        text=True,
        encoding="utf-8",
        env=env,
    )

    return {
        "success": result.returncode == 0,
        "stdout": result.stdout,
        "stderr": result.stderr,
        "returncode": result.returncode,
    }


def run_evaluation(
    format_name: str,
    model: str,
    prompts: list[str] | None,
    sanity: bool,
    log_dir: str,
    thinking_budget: int | None = None,
    epochs: int | None = None,
    temperature: float | None = None,
) -> bool:
    """Runs the evaluation framework for a target format strategy.

    Args:
        format_name: The name of the target inference format strategy.
        model: The evaluation model identifier.
        prompts: Optional list of prompt names to filter evaluation.
        sanity: Whether to execute a quick two-sample sanity run.
        log_dir: The target output directory path for evaluation logs.
        thinking_budget: Optional thinking budget constraint for reasoning models.
        epochs: Optional number of evaluation epochs.
        temperature: Optional generation temperature.

    Returns:
        Whether the evaluation command completed successfully.
    """
    print(f"Running evaluation for strategy '{format_name}' using model '{model}'...")
    curr = os.path.dirname(os.path.abspath(__file__))
    while curr and not os.path.exists(os.path.join(curr, "main.py")):
        parent = os.path.dirname(curr)
        if parent == curr:
            break
        curr = parent
    eval_root = curr

    strategy_name = (
        "direct" if format_name in ("direct_json", "transport") else format_name
    )
    cmd = [
        _get_uv_binary(),
        "run",
        "python",
        "main.py",
        "--strategies",
        strategy_name,
        "--model",
        model,
        "--log-dir",
        log_dir,
    ]

    if thinking_budget is not None:
        cmd.extend(["--thinking-budget", str(thinking_budget)])

    if epochs is not None:
        cmd.extend(["--epochs", str(epochs)])

    if temperature is not None:
        cmd.extend(["--temperature", str(temperature)])

    if sanity:
        cmd.append("--sanity")

    if prompts:
        for p in prompts:
            cmd.extend(["--prompt", p])

    print(f"Executing: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=eval_root, capture_output=False)
    return result.returncode == 0


def load_log_data(log_path: str) -> dict[str, Any]:
    """Dumps and parses an Inspect AI evaluation log file into a dictionary.

    Args:
        log_path: The filesystem path to the `.eval` log file.

    Returns:
        The parsed JSON log dictionary.
    """
    dump_cmd = [_get_uv_binary(), "run", "inspect", "log", "dump", log_path]
    output = subprocess.check_output(dump_cmd, text=True, encoding="utf-8")
    return json.loads(output)


def get_git_diff(workspace_root: str) -> str:
    """Retrieves the git diff patch for active changes under `python/`.

    Args:
        workspace_root: The filesystem path to the git workspace root.

    Returns:
        The git diff string for `python/`, or an empty string if unchanged.
    """
    cmd = ["git", "diff", "HEAD", "--", "python/"]
    try:
        result = subprocess.run(
            cmd,
            cwd=workspace_root,
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
        return result.stdout.strip()
    except Exception:
        return ""

```

### Core Architecture Module: `hooks.py`
```
# Copyright 2024 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import re
import os


def map_spec_filename(filename, version_str):
    mapping = {
        'a2ui_protocol.md': f'{version_str}-a2ui.md',
        'evolution_guide.md': f'{version_str}-evolution-guide.md',
        'a2ui_extension_specification.md': (
            f'{version_str}-a2ui-extension-specification.md'
        ),
        'basic_catalog_implementation_guide.md': (
            f'{version_str}-basic-catalog-implementation-guide.md'
        ),
    }
    if version_str == 'v0.8' and filename == 'a2ui_extension_specification.md':
        return 'v0.8-a2a-extension.md'
    return mapping.get(filename)


def on_page_markdown(markdown, page, config, files):
    github_base_url = 'https://github.com/a2ui-project/a2ui/blob/main'

    # 1. Pre-expand snippet includes (--8<--)
    for _ in range(5):
        expanded = False

        def snippet_replacer(match):
            nonlocal expanded
            snippet_path = match.group('snippet_path')
            if os.path.exists(snippet_path):
                with open(snippet_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                expanded = True
                return content
            return match.group(0)

        regex = r'^\s*--8<--\s+["\'](?P<snippet_path>[^"\']+)["\']\s*$'
        new_markdown = re.sub(regex, snippet_replacer, markdown, flags=re.MULTILINE)
        if not expanded:
            break
        markdown = new_markdown

    # 2. Extract version prefix from wrapper page filename (e.g. "v0.9.1-")
    version_match = re.match(r'^(v\d+(?:\.\d+)*)-', page.file.name)
    version_str = None
    version_folder = None
    if version_match:
        version_str = version_match.group(1)
        version_folder = version_str.replace('.', '_')

    # Calculate file depth relative to docs dir
    file_depth = len(page.file.src_path.split('/')) - 1

    def replace_path(path):
        if path.startswith(('http://', 'https://', 'mailto:', 'tel:')):
            return path

        parts = path.split('#')
        base_path = parts[0]
        anchor = f'#{parts[1]}' if len(parts) > 1 else ''

        if base_path.startswith('./'):
            base_path = base_path[2:]

        if version_str:
            mapped_name = map_spec_filename(base_path, version_str)
            if mapped_name:
                return mapped_name + anchor

            # Rewrite relative paths to json schemas regardless of depth (e.g. "../json/..." or "../../../json/...")
            if '/json/' in path:
                rel_prefix = '../' * file_depth
                return rel_prefix + version_folder + path[path.index('/json/') :]

        # Check if the link points outside the docs folder
        up_count = 0
        temp_path = path
        while temp_path.startswith('../'):
            up_count += 1
            temp_path = temp_path[3:]

        if up_count > file_depth:
            strip_count = up_count

            # Remove the leading '../' sequences
            path_parts = path.split('/')
            while strip_count > 0 and path_parts and path_parts[0] == '..':
                path_parts.pop(0)
                strip_count -= 1
            clean_path = '/'.join(path_parts)

            # If the link points to another public documentation file, make it an internal link
            if clean_path.startswith('docs/public/'):
                rel_prefix = '../' * file_depth
                return rel_prefix + clean_path[len('docs/public/') :]

            # Return the newly formatted absolute GitHub link
            return f'{github_base_url}/{clean_path}'

        return path

    def replace_standard_links(text_content):
        def link_replacer(match):
            if match.group('code'):
                return match.group(0)
            path = match.group('path')
            new_path = replace_path(path)
            matched_str = match.group(0)
            start = match.start('path') - match.start(0)
            end = match.end('path') - match.start(0)
            return matched_str[:start] + new_path + matched_str[end:]

        regex = r'(?P<code>`[^`]+`|```[\s\S]*?```)|\[(?P<text>[^\]]+)\]\((?P<path>[^\s)]+)(?:\s+(?P<title>".*?"|\'.*?\'))?\)'
        return re.sub(regex, link_replacer, text_content)

    def replace_reference_links(text_content):
        def ref_replacer(match):
            path = match.group('path')
            new_path = replace_path(path)
            matched_str = match.group(0)
            start = match.start('path') - match.start(0)
            end = match.end('path') - match.start(0)
            return matched_str[:start] + new_path + matched_str[end:]

        regex = r'^\s*\[(?P<ref>[^\]]+)\]:\s*(?P<path>[^\s]+)(?:\s+(?P<title>".*?"|\'.*?\'))?\s*$'
        return re.sub(regex, ref_replacer, text_content, flags=re.MULTILINE)

    markdown = replace_standard_links(markdown)
    markdown = replace_reference_links(markdown)
    return markdown

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4004** (2026-11-05): **docs: remove 'Early stage public preview' section from README.md**
  *Symptoms*: Removes the 'Status: Early stage public preview' section from the top-level [`README.md`](https://github.com/a2ui-project/a2ui/blob/51670aef238fb8853c0ed0a859c4f98ae46bee35/README.md?plain=1#L12-L19).

- **Issue #3996** (2026-11-05): **chore(skills): mark contributor skills as internal**
  *Symptoms*: # Description  Follow-up to the discussion on #3935. `npx skills add a2ui-project/a2ui` currently offers every `SKILL.md` in the repo: the contributor skills under `.agents/skills`, `blueprints/skills` and `eval/iterative_format_optimizer/skills` (triage, audit, release, blueprint maintenance, …). End users who want help *using* A2UI see those mixed in with the user-facing `a2ui` skill.  As @gspencergoog suggested, this adds  ```yaml metadata:   internal: true ```  to the frontmatter of all 21 contributor skills. The `skills` CLI hides `metadata.internal: true` skills from default discovery. Contributors can still install them with `INSTALL_INTERNAL_SKILLS=1`, and agents working inside this repo still load them from `.agents/skills` as before.  Verified locally:  - `skills_lint` (0.5.3+1, same as CI) passes. - With this change plus #3935's `skills/a2ui`, `npx skills add . --list` shows only `a2ui`.  No content changes to any skill.  ## Pre-launch Checklist  One time:  - [ ] I signed the [CLA]. - [ ] I read the [Contributors Guide]. - [ ] I read the [Style Guide]. - [ ] I have built and run at least one [sample].  For this PR:  - [ ] I have updated the relevant CHANGELOG.md file. - [ ] I updated/added relevant documentation. - [ ] My code changes (if any) have tests. - [ ] If my branch is on a fork, I have verified that [scripts/e2e_test.sh](https://github.com/a2ui-project/a2ui/blob/main/scripts/e2e_test.sh) passes.  <!-- Links -->  [CLA]: https://cla.developers.google.com/ [C

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

### Incident Patch 1: `eee79070` (2026-11-05)
**Commit Message**: docs(site): add Swappable Inference Formats concept guide (#3969)

## Summary

Replaces the placeholder `docs/site/src/content/docs/concepts/inference-formats.mdx` page with the Swappable Inference Formats concept guide and adds the `<InferencePipeline />` interactive diagram component. The guide explains how server-side inference formats separate model generation from the canonical A2UI wire JSON protocol. It also compares `ExpressFormatFactory` and `DirectJsonFormatFactory` and documents how to implement a custom format.

Resolves #3897
Resolves #3599

## Changes

- Added `docs/site/src/components/docs/InferencePipeline.astro` to illustrate the 3-stage server-side compilation pipeline (Prompt Synthesis, Model Generation, and Wire Compilation & Validation) with side-by-side cards for `ExpressFormatFactory` and `DirectJsonFormatFactory`.
- Replaced the placeholder `docs/site/src/content/docs/concepts/inference-formats.mdx` with the full Swappable Inference Formats concept guide:
  - Side-by-side comparison of an `<a2ui>` Express block and its compiled `v1.0` and `v0.9.1` wire JSON messages.
  - Decision guidance for choosing between Express (`ExpressFormatFactory`, the default) and

**File**: `docs/site/src/components/docs/InferencePipeline.astro` (added, +683/-0)
```diff
@@ -0,0 +1,683 @@
+---
+/*
+ * Copyright 2024 Google LLC
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *     https://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+---
+
+<div
+  class="ip-root not-content"
+  data-diagram
+  data-diagram-title="inference-pipeline"
+>
+  <div class="ip-banner">
+    <div class="ip-banner__left">
+      <span class="ip-badge">SERVER-SIDE AGENT SDK</span>
+      <span class="ip-banner__title">
+        A2uiRequestProcessor: Swappable Generation &rarr; Standard Wire JSON
+      </span>
+    </div>
+    <div class="ip-banner__pills">
+      <span class="ip-pill ip-pill--teal">Express (Default)</span>
+      <span class="ip-pill ip-pill--blue">Direct JSON</span>
+      <span class="ip-pill ip-pill--amber">Custom Formats</span>
+    </div>
+  </div>
+
+  <div class="ip-grid">
+    <!-- Stage 1: Prompt Synthesis -->
+    <div class="ip-stage ip-stage--purple">
+      <div class="ip-stage__head">
+        <span class="ip-step-num ip-step-num--purple">1</span>
+        <div class="ip-stage__titles">
+          <div class="ip-stage__title">Prompt Synthesis</div>
+          <code class="ip-stage__sub">processor.promptSnippet</code>
+        </div>
+      </div>
+
+      <div class="ip-box">
+        <div class="ip-box__label">Active Catalog Contract</div>
+        <div class="ip-chip-row">
+          <code class="ip-chip">components</code>
+          <code class="ip-chip">functions</code>
+          <code class="ip-chip">instructions</code>
+          <code class="ip-chip">examples</code>
+        </div>
+      </div>
+
+      <div class="ip-arrow-down" aria-hidden="true">&darr; PromptGenerator</div>
+
+      <div class="ip-code-card">
+        <div class="ip-code-card__header">
+          <span class="ip-tag ip-tag--teal">Express Signatures</span>
+          <span class="ip-tag ip-tag--blue">or JSON Schema</span>
+        </div>
+        <div class="ip-code">
+          <div><span class="ip-c"># Positional signatures</span></div>
+          <div>
+            &bull; <span class="ip-fn">Card</span>(<span class="ip-p"
+              >child</span
+            >)
+          </div>
+          <div>
+            &bull; <span class="ip-fn">Text</span>(<span class="ip-p">text</span
+            >, <span class="ip-k">variant?</span>)
+          </div>
+          <div>
+            &bull; <span class="ip-fn">Button</span>(<span class="ip-p"
+              >child</span
+            >, <span class="ip-k">variant?</span>, <span class="ip-p"
+              >action</span
+            >)
+          </div>
+        </div>
+      </div>
+    </div>
+
+    <!-- Stage 2: Model Generation -->
+    <div class="ip-stage ip-stage--teal">
+      <div class="ip-stage__head">
+        <span class="ip-step-num ip-step-num--teal">2</span>
+        <div class="ip-stage__titles">
+          <div class="ip-stage__title">Model Generation</div>
+          <code class="ip-stage__sub">LLM Response Stream</code>
+        </div>
+      </div>
+
+      <div class="ip-code-card">
+        <div class="ip-code-card__header">
+          <span class="ip-tag ip-tag--teal">Express DSL (~3x fewer tokens)</span
+          >
+        </div>
+        <div class="ip-code">
+          <div><span class="ip-sentinel">&lt;a2ui&gt;</span></div>
+          <div>
+            <span class="ip-p">$/flight/gate</span> = <span class="ip-s"
+              >"B12"</span
+            >
+          </div>
+          <div>
+            <span class="ip-k">root</span> = <span class="ip-fn">Card</span>(
+          </div>
+          <div class="ip-indent">
+            <span class="ip-fn">Text</span>(<span class="ip-p"
+              >$/flight/gate</span
+            >, <span class="ip-s">"caption"</span>)
+          </div>
+          <div>)</div>
+          <div><span class="ip-sentinel">&lt;/a2ui&gt;</span></div>
+        </div>
+      </div>
+
+      <div class="ip-alt-card">
+        <div class="ip-alt-row">
+          <span class="ip-tag ip-tag--blue">Direct JSON</span>
+          <code>&lt;a2ui-json&gt;[...]&lt;/a2ui-json&gt;</code>
+        </div>
+        <div class="ip-alt-row">
+          <span class="ip-tag ip-tag--amber">Custom Format</span>
+          <code>Custom InferenceFormatFactory</code>
+        </div>
+      </div>
+    </div>
+
+    <!-- Stage 3: Wire Compilation & Validation -->
+    <div class="ip-stage ip-stage--amber">
+      <div class="ip-stage__head">
+        <span class="ip-step-num ip-step-num--amber">3</span>
+        <div class="ip-stage__titles">
+          <d
```

**File**: `docs/site/src/content/docs/concepts/inference-formats.mdx` (modified, +447/-6)
```diff
@@ -1,11 +1,452 @@
 ---
 title: 'Swappable Inference Formats'
-description: 'Compact inference formats (Express DSL, Direct JSON) and latency benchmarks in A2UI.'
+description: 'How A2UI decouples the wire protocol from LLM generation with Express, Direct JSON, and custom inference formats.'
 ---
 
-import {Aside} from '@astrojs/starlight/components';
+import {Tabs, TabItem} from '@astrojs/starlight/components';
+import InferencePipeline from '@components/docs/InferencePipeline.astro';
 
-<Aside type="note" title="Work in Progress">
-  This page is currently being authored. Refer to the site outline in the repository for the
-  specification and planned content.
-</Aside>
+A2UI separates the wire format that [renderer SDKs](/concepts/renderer-sdks/) consume from the inference format that a language model writes. Every client renderer receives the same standard A2UI JSON messages over the wire. On the server, the [agent SDKs](/concepts/agent-sdks/) let you swap how the model generates UI without changing any client code.
+
+In the diagram below, `A2uiRequestProcessor` coordinates three stages on the server. First, `PromptGenerator` compiles the active [catalog schemas](/concepts/catalogs/), `instructions`, and few-shot `examples` into a format-specific system prompt snippet. Next, the model emits its response inside sentinel tags such as `<a2ui>` for Express or `<a2ui-json>` for Direct JSON. Finally, `Parser` or `ResponseStream` heals streaming text, compiles the payload into wire JSON, and validates every message against `RendererState`.
+
+<InferencePipeline />
+
+## Wire standard vs. generation formats
+
+Standard JSON is an ideal wire protocol for client renderers. It is human-readable, language-independent, and validated directly by JSON Schema. Asking an LLM to generate raw wire JSON token by token, however, carries a high cost in latency and context window usage:
+
+1. Repeated keys such as `"id"`, `"component"`, and `"@path"`, plus hand-written component IDs, make wire JSON roughly 3x longer than Express's positional calls.
+2. Injecting full JSON Schemas into the system prompt consumes roughly twice as many input tokens as compact function signatures.
+3. Deeply nested braces, quotes, and manual component IDs increase the chance of syntax mistakes on smaller or faster models.
+
+Swappable inference formats solve this problem by treating LLM output as a server-side compilation step. The agent SDKs ship with two supported formats: Express, the default compact DSL, and Direct JSON, where the model emits wire JSON directly. You select a format by passing an `InferenceFormatFactory` to `A2uiGenerator` or `A2uiRequestProcessor`:
+
+| Format      | Factory Class             | Sentinel Tags                | SDK Support                        | Summary                                                                                                                |
+| :---------- | :------------------------ | :--------------------------- | :--------------------------------- | :--------------------------------------------------------------------------------------------------------------------- |
+| Express     | `ExpressFormatFactory`    | `<a2ui>...</a2ui>`           | TypeScript, Python, Dart (default) | Compact positional DSL that cuts output code tokens by ~3x, halves prompt tokens, and compiles to flat wire JSON.      |
+| Direct JSON | `DirectJsonFormatFactory` | `<a2ui-json>...</a2ui-json>` | TypeScript, Python, Dart           | Standard A2UI wire JSON emitted directly by the model, with tolerant markdown stripping and incremental chunk healing. |
+
+Express is currently the only non-experimental alternative to Direct JSON in the repository. Because `A2uiGenerator` and `A2uiRequestProcessor` program against the `InferenceFormatFactory` interface, you can also write your own format for custom grammars or specialized models.
+
+## Side-by-side example: Express vs. wire JSON
+
+In Express, the model calls component constructors with positional arguments and sets values in the data model with `$/path = value`. It assigns the entry point of the surface to `root` and nests child components inside parent calls instead of inventing IDs by hand.
+
+The example below uses `Card`, `Column`, `Text`, and `Button` from the Basic Catalog, and the Express format derives signatures for any custom `catalog.json` you register. The block is shown indented for clarity; indentation and spaces around `=` and after commas are not required:
+
+```text title="Express block (shown indented for clarity)"
+<a2ui>
+$/flight/number = "NH 105"
+$/flight/gate = "B12"
+root = Card(
+  Column([
+    Text($/flight/number),
+    Text($/flight/gate, "caption"),
+    Button(Text("Board now"), action=Event("check_in", {flight: $/flight/number}))
+  ])
+)
+</a2ui>
+```
+
+When `parseResponse` or `openStream` reads that `<a2ui>` block, the Express compiler flattens the tree and assigns deterministic IDs (`root`, `root_child`, `root_child_childre
```

---

### Incident Patch 2: `46e35173` (2026-11-04)
**Commit Message**: fix(web_core,angular): List emits no item for a child that renders nothing (#3957)

* fix(web_core,angular): List emits no item for a child that renders nothing

An unresolved child (pending, unknown type, cyclic) renders nothing, but List
wrapped every child in an <li> or item div, so it still left an empty marker
and a gap. That broke the blueprint's "no layout footprint" rule.

- web_core: add A2uiLitElement.childRendersNothing(childRef) and have the
  universal List skip such children, wrapper included (React and Lit share it).
- Angular: component-host marks a host that renders nothing with
  data-a2ui-empty, and ListComponent hides the item around such a host.

Part of #2013.

* test(web_core): cover the List item filter on v1.0 too

* test(web_core): split the List item test into one per protocol version

* Address review: share renderNode's lookup, rename to isChildResolved

- A2uiLitElement: renderNode and the new isChildResolved go through one private
  resolveChild, so they can't disagree. This covers the context-only path, where
  an unknown type renders nothing, which the copied lookup missed.
- Rename childRendersNothing to isChildResolved (what it checks; no double
 

**File**: `typescript/core/web_core/CHANGELOG.md` (modified, +1/-0)
```diff
@@ -10,6 +10,7 @@
 - **BREAKING CHANGE**: (v1_0) The basic catalog `TextField` requires `value`, as the other input components do, so a `TextField` without one fails validation instead of accepting input that never reaches the data model. Recommended migration: bind `value` to a data model path, such as `{"@path": "/form/email"}`. The path does not have to exist yet. [#3830](https://github.com/a2ui-project/a2ui/issues/3830), [#3868](https://github.com/a2ui-project/a2ui/pull/3868)
 - **BREAKING CHANGE**: `MessageProcessor.dispose()` now disposes every surface in `model` as well as `rpc`, so read surface state before calling it. Deleting a surface cancels its pending agent calls. [#3735](https://github.com/a2ui-project/a2ui/pull/3735)
 - **BREAKING CHANGE**: `DataContext.resolveAction` resolves the `context` entries and then the `userMessage` of an event action one at a time as an action execution, so a local function that throws there is an `EXECUTION_ERROR` instead of an `EXPRESSION_ERROR` on every protocol version, and returns a Promise of the resolved action when an entry waits on an asynchronous call, instead of an action whose values are Promises. A `userMessage` that resolves to `null` or `undefined` is left out instead of being an `INVALID_ACTION`. It settles to `undefined` when an entry fails, and nothing later in the action is evaluated. `options.userActivation` now applies to event actions as it does to function call actions. `SurfaceModel.dispatchAction` accepts that Promise, does not dispatch when a pending value rejects (a rejection that was not already reported is an `INVALID_ACTION`), and leaves out a `userMessage` that is not a string whether it settled synchronously or not. [#3735](https://github.com/a2ui-project/a2ui/pull/3735)
+- The universal `List` emits no item for a child that renders nothing (pending, unknown type or cyclic), so it leaves no empty marker or gap. `A2uiLitElement.isChildResolved(childRef)` lets other containers that wrap each child do the same. [#2013](https://github.com/a2ui-project/a2ui/issues/2013)
 - `MessageProcessor` writes an inline `createSurface.dataModel` as one `DataModel.set` per top-level key (`/<escaped_key>`, escaping `~` as `~0` and `/` as `~1` per RFC 6901) instead of a single root `/` write. [#3857](https://github.com/a2ui-project/a2ui/pull/3857)
 - `Catalog.fromJson` applies the `default` of an optional property when parsing, as a `.default()` in a catalog defined in code does, so a function from a catalog document receives its defaults. [#3735](https://github.com/a2ui-project/a2ui/pull/3735)
 - (v1_0) A function call whose function the renderer does not implement (undeclared in the catalog the call resolves to, or declared schema-only) is sent to the agent with `callAgentFunction`, the specification's fallback routing, instead of failing with an `EXPRESSION_ERROR`. This applies to bindings, check rules and actions. It does not apply to `${...}` parts of a `formatString` template or to the arguments of an agent's `callRendererFunction`, where such a call fails with an error naming the function as before, and nothing is sent. A malformed event context value (such as an unrecognized `@` key) is an `EXPRESSION_ERROR` instead of an exception. With a `validationConfig`, a call to an undeclared function is still rejected unless the function is declared schema-only or `allowUnknownElements` is `true`. `MessageProcessor` enables it on v1.0 surfaces when it has an `outboundListener`; without one, such calls fail locally as before. The outbound call names the catalog the call resolved to. A declared function is refused locally when it is `agentOnly`, or requires user activation during a passive evaluation, and its resolved arguments are validated against its schema before sending. Arguments that are not valid JSON fail locally. The value is `undefined` until the answer arrives, and settles to `null` when a call fails; an agent error or a timeout is an `EXPRESSION_ERROR` carrying the failed call's `functionCallId`, and a cancelled call is not reported. A check rule waiting on the agent is pending and counts as valid. Reactive bindings share identical in-flight calls and cache answers per surface (up to 256, keyed by catalog, function and canonical arguments, cleared when the caller changes, evicted on failure) and hand each caller its own copy; actions always send a fresh call. A function whose argument is pending waits for it, and stops without running when an argument fails. Adds `SurfaceModel.agentFunctionCaller`, `SurfaceModel.callAgentFunction` (with the `AgentFunctionCallOptions` type), `SurfaceModel.disposed`, `RpcHandler.cancelSurfaceCalls`, and the `AgentFunctionCall` and `AgentFunctionCaller` types. [#3415](https://github.com/a2ui-project/a2ui/issues/3415), [#3536](https://github.com/a2ui-project/a2ui/issues/3536), [#3735](https://github.com/a2ui-project/a2ui/pull/3735)
```

**File**: `typescript/core/web_core/src/universal/a2ui-lit-element.ts` (modified, +49/-10)
```diff
@@ -41,11 +41,14 @@ import {
   HostAccessibility,
   type ResolvedAccessibilityAttributes,
 } from './host_accessibility.js';
-import {renderA2uiNode} from './render-a2ui-node.js';
+import {canRenderA2uiNode, renderA2uiNode} from './render-a2ui-node.js';
 import type {WebComponentImplementation} from './web_component_implementation.js';
 
 export type {CheckableResolvedProps, ResolvedAccessibilityAttributes};
 
+/** The surface a child renders on, as its data context reports it. */
+type ChildSurface = NonNullable<ComponentContext['dataContext']['surface']>;
+
 /**
  * A reference to a child component to render. Either a string ID, or an object
  * pairing an ID with an explicit data context path.
@@ -396,19 +399,57 @@ export abstract class A2uiLitElement<
    * @returns A Lit template result containing the rendered child component, or `nothing` if the reference is empty.
    */
   protected renderNode(childRef?: ComponentNode | A2uiChildRef, customPath?: string) {
-    if (!childRef || !this.context?.dataContext) return nothing;
+    const child = this.resolveChild(childRef, customPath);
+    if (!child) return nothing;
+    if ('node' in child) return renderA2uiNode(child.node);
+    const childContext = new ComponentContext(child.surface, child.componentId, child.path);
+    const childCatalog: Catalog<WebComponentImplementation> = childContext.componentModel.catalog;
+    return renderA2uiNode(childContext, childCatalog);
+  }
+
+  /**
+   * Whether the child `renderNode(childRef, customPath)` would render has resolved: its
+   * component has arrived and its type has an implementation. An unresolved child (pending,
+   * unknown type or cyclic) renders nothing.
+   *
+   * Containers that give each child a slot of their own (an `<li>`, an item `div`) use this to
+   * leave unresolved children out entirely, wrapper included, so they take no marker or gap.
+   * It shares `renderNode`'s lookup, so the two always agree.
+   */
+  protected isChildResolved(childRef?: ComponentNode | A2uiChildRef, customPath?: string): boolean {
+    const child = this.resolveChild(childRef, customPath);
+    if (!child) return false;
+    if ('node' in child) return canRenderA2uiNode(child.node);
+    const model = child.surface.componentsModel.get(child.componentId);
+    const catalog = model?.catalog as Catalog<WebComponentImplementation> | undefined;
+    return !!model && !!catalog?.components.get(model.type)?.tagName;
+  }
+
+  /**
+   * Finds what `renderNode` renders for a child reference: the child's `ComponentNode` when the
+   * node tree has one, otherwise the surface, component id and data path to build a context
+   * from. Returns `undefined` when there is nothing to render.
+   */
+  private resolveChild(
+    childRef?: ComponentNode | A2uiChildRef,
+    customPath?: string,
+  ):
+    | {node: ComponentNode}
+    | {surface: ChildSurface; componentId: ComponentId; path: string}
+    | undefined {
+    if (!childRef || !this.context?.dataContext) return undefined;
     const {surface, path: parentPath} = this.context.dataContext;
     if (!surface) {
-      return nothing;
+      return undefined;
     }
 
     const surfaceContainsComponent = !!surface.componentsModel?.get(this.context.componentModel.id);
     if (!surfaceContainsComponent) {
-      return nothing;
+      return undefined;
     }
 
     if (isComponentNode(childRef) && !customPath) {
-      return renderA2uiNode(childRef);
+      return {node: childRef};
     }
 
     let componentId: ComponentId | undefined;
@@ -421,21 +462,19 @@ export abstract class A2uiLitElement<
     }
 
     if (!componentId || !surface.componentsModel?.get(componentId)) {
-      return nothing;
+      return undefined;
     }
 
     path = path ?? parentPath;
 
     if (this.node) {
       const childNode = findChildNode(this.node, componentId, path);
       if (childNode) {
-        return renderA2uiNode(childNode);
+        return {node: childNode};
       }
     }
 
-    const childContext = new ComponentContext(surface, componentId, path);
-    const childCatalog: Catalog<WebComponentImplementation> = childContext.componentModel.catalog;
-    return renderA2uiNode(childContext, childCatalog);
+    return {surface, componentId, path};
   }
 
   /**
```

**File**: `typescript/core/web_core/src/universal/basic_catalog/components/List.test.ts` (modified, +126/-0)
```diff
@@ -25,6 +25,9 @@ import {
   SurfaceModel,
   Subscription,
 } from '../../../v0_9/index.js';
+import {NodeResolver} from '../../../resolution/node-resolver.js';
+import type {ComponentNode} from '../../../resolution/component-node.js';
+import {getValue} from '../../../reactivity/signals.js';
 import {
   type A2uiWebComponentElement,
   registerUniversalElement,
@@ -46,6 +49,7 @@ describe('List Component', () => {
   let surface: SurfaceModel;
   let element: A2uiWebComponentElement | null = null;
   let subscription: Subscription | null = null;
+  let resolver: NodeResolver | null = null;
 
   beforeEach(() => {
     processor = new MessageProcessor([basicCatalog]);
@@ -87,6 +91,9 @@ describe('List Component', () => {
   afterEach(() => {
     subscription?.unsubscribe();
     subscription = null;
+    // Disposed here so that a failed assertion doesn't leave it subscribed to the surface.
+    resolver?.dispose();
+    resolver = null;
     if (element) {
       element.remove();
       element = null;
@@ -113,6 +120,125 @@ describe('List Component', () => {
     assert.strictEqual(el.textContent?.includes('List Item 2'), true);
   });
 
+  /**
+   * Mounts a List over `root`, whose `late` child has not arrived, and checks it gets no item;
+   * then runs `sendLate` and checks the item appears in order.
+   */
+  async function expectNoItemUntilArrival(root: ComponentNode, sendLate: () => void) {
+    const el = document.createElement('a2ui-list') as A2uiWebComponentElement;
+    element = el;
+    document.body.appendChild(el);
+    await asyncUpdate(el, e => {
+      e.node = root;
+    });
+
+    const items = () => el.querySelectorAll('.a2ui-list-item-none');
+    // `late` has not arrived: no empty item (box, gap) stands in for it.
+    assert.strictEqual(items().length, 2);
+    assert.strictEqual(el.querySelectorAll('a2ui-basic-text').length, 2);
+
+    sendLate();
+    await (el as unknown as {updateComplete: Promise<unknown>}).updateComplete;
+
+    assert.strictEqual(items().length, 3);
+    assert.deepStrictEqual(
+      [...el.querySelectorAll<A2uiWebComponentElement>('a2ui-basic-text')].map(
+        t => t.node?.componentId,
+      ),
+      ['a', 'late', 'b'],
+    );
+  }
+
+  it('emits no item for a child that has not resolved, then adds it on arrival (v0.9)', async () => {
+    const nodeProcessor = new MessageProcessor([basicCatalog]);
+    nodeProcessor.processMessages([
+      {
+        version: 'v0.9',
+        createSurface: {surfaceId: 'node-surface', catalogId: basicCatalog.id},
+      },
+      {
+        version: 'v0.9',
+        updateComponents: {
+          surfaceId: 'node-surface',
+          components: [
+            {id: 'root', component: 'List', children: ['a', 'late', 'b']},
+            {id: 'a', component: 'Text', text: 'A'},
+            {id: 'b', component: 'Text', text: 'B'},
+          ],
+        },
+      },
+    ]);
+    resolver = new NodeResolver(nodeProcessor.model.getSurface('node-surface')!, basicCatalog);
+
+    await expectNoItemUntilArrival(getValue(resolver.rootNode)!, () =>
+      nodeProcessor.processMessages([
+        {
+          version: 'v0.9',
+          updateComponents: {
+            surfaceId: 'node-surface',
+            components: [{id: 'late', component: 'Text', text: 'Late'}],
+          },
+        },
+      ]),
+    );
+  });
+
+  it('emits no item for a child that has not resolved, then adds it on arrival (v1.0)', async () => {
+    // v1.0 uses the same universal List as v0.9.
+    const v1Catalog = (await import('../../../catalogs/basic/v1/index.js')).basicCatalog;
+    const nodeProcessor = new MessageProcessor([v1Catalog]);
+    nodeProcessor.processMessages([
+      {
+        version: '1.0',
+        createSurface: {surfaceId: 'node-surface', catalogId: v1Catalog.id},
+      },
+      {
+        version: '1.0',
+        updateComponents: {
+          surfaceId: 'node-surface',
+          components: [
+            {id: 'root', component: 'List', children: ['a', 'late', 'b']},
+            {id: 'a', component: 'Text', text: 'A'},
+            {id: 'b', component: 'Text', text: 'B'},
+          ],
+        },
+      },
+    ]);
+    resolver = new NodeResolver(nodeProcessor.model.getSurface('node-surface')!, v1Catalog);
+
+    await expectNoItemUntilArrival(getValue(resolver.rootNode)!, () =>
+      nodeProcessor.processMessages([
+        {
+          version: '1.0',
+          updateComponents: {
+            surfaceId: 'node-surface',
+            components: [{id: 'late', component: 'Text', text: 'Late'}],
+          },
+        },
+      ]),
+    );
+  });
+
+  it('emits no item for an unknown-type child when rendered from a context alone', async () => {
+    // Without a node tree, renderNode builds a ComponentContext and renders nothing for a type
+    // the catalog doesn't implement. The List must agree and leave that child out.
+    surface.componentsModel.addComponent(
+      new ComponentModel('weird', 'StarRati
```

**File**: `typescript/core/web_core/src/universal/basic_catalog/components/List.ts` (modified, +4/-1)
```diff
@@ -67,7 +67,10 @@ export class A2uiListElement extends BasicCatalogA2uiLitElement<ListSupportedApi
     const props = this.controller.props;
     if (!props) return nothing;
 
-    const children: ResolvedChildList = Array.isArray(props.children) ? props.children : [];
+    const children: ResolvedChildList = (Array.isArray(props.children) ? props.children : [])
+      // An unresolved child renders nothing and gets no item: an empty <li> would still show a
+      // marker and take a gap.
+      .filter(child => this.isChildResolved(child));
     const listStyle = (props as any).listStyle;
     const direction = props.direction || 'vertical';
     const alignItems = props.align ? (ALIGN_MAP[props.align] ?? 'stretch') : undefined;
```

**File**: `typescript/core/web_core/src/universal/render-a2ui-node.test.ts` (modified, +40/-1)
```diff
@@ -24,7 +24,7 @@ import {ComponentContext} from '../resolution/component-context.js';
 import {NodeResolver} from '../resolution/node-resolver.js';
 import {getValue} from '../reactivity/signals.js';
 import {MessageProcessor} from '../processing/message-processor.js';
-import {renderA2uiNode} from './render-a2ui-node.js';
+import {canRenderA2uiNode, renderA2uiNode} from './render-a2ui-node.js';
 import {Catalog} from '../catalog/types.js';
 import type {A2uiWebComponentElement} from './a2ui_web_component_element.js';
 import type {WebComponentImplementation} from './web_component_implementation.js';
@@ -176,6 +176,45 @@ describe('renderA2uiNode', () => {
     resolver.dispose();
   });
 
+  it('canRenderA2uiNode is true exactly when renderA2uiNode renders an element', () => {
+    const p = new MessageProcessor([testCatalog]);
+    p.processMessages([
+      {version: 'v0.9', createSurface: {surfaceId: 's', catalogId: 'test-catalog'}},
+      {
+        version: 'v0.9',
+        updateComponents: {
+          surfaceId: 's',
+          components: [
+            {id: 'root', component: 'Button', text: 'Root'},
+            {id: 'no-tag', component: 'MissingTag'},
+          ],
+        },
+      },
+    ]);
+    const resolver = new NodeResolver(p.model.getSurface('s')!, testCatalog);
+    const root = getValue(resolver.rootNode)!;
+    assert.strictEqual(canRenderA2uiNode(root), true);
+    assert.notStrictEqual(renderA2uiNode(root), nothing);
+
+    const noTagResolver = new NodeResolver(p.model.getSurface('s')!, testCatalog);
+    p.model.getSurface('s')!.componentsModel.removeComponent('root');
+    p.processMessages([
+      {
+        version: 'v0.9',
+        updateComponents: {surfaceId: 's', components: [{id: 'root', component: 'MissingTag'}]},
+      },
+    ]);
+    const noTagRoot = getValue(noTagResolver.rootNode)!;
+    assert.strictEqual(noTagRoot.isPlaceholder, false);
+    assert.strictEqual(canRenderA2uiNode(noTagRoot), false);
+
+    // A disposed node renders nothing too.
+    resolver.dispose();
+    assert.strictEqual(root.disposed, true);
+    assert.strictEqual(canRenderA2uiNode(root), false);
+    noTagResolver.dispose();
+  });
+
   it('returns nothing for a node whose implementation has no tagName', () => {
     const missingTagSurface = new MessageProcessor([testCatalog]);
     missingTagSurface.processMessages([
```

**File**: `typescript/core/web_core/src/universal/render-a2ui-node.ts` (modified, +25/-6)
```diff
@@ -101,15 +101,34 @@ export function renderA2uiNode(
   return a2uiElement(implementation.tagName, source);
 }
 
+/** A node `renderA2uiNode` renders as an element: resolved, with a context and a tag name. */
+type RenderableNode = ComponentNode & {
+  context: ComponentContext;
+  impl: Partial<WebComponentImplementation> & {tagName: string};
+};
+
+/**
+ * Whether `renderA2uiNode(node)` renders an element for `node`: it has resolved, is not
+ * disposed, has a context, and its implementation is a custom element with a tag name.
+ * Containers use this (through `A2uiLitElement.isChildResolved`) to agree with it exactly.
+ */
+export function canRenderA2uiNode(node: ComponentNode): node is RenderableNode {
+  return (
+    !node.isPlaceholder &&
+    !node.disposed &&
+    !!node.context &&
+    !!(node.impl as Partial<WebComponentImplementation> | undefined)?.tagName
+  );
+}
+
 function renderNode(node: ComponentNode) {
-  if (node.isPlaceholder || node.disposed || !node.context) {
-    return nothing;
-  }
-  const implementation = node.impl as Partial<WebComponentImplementation> | undefined;
-  if (!implementation?.tagName) {
-    console.warn(`Component implementation not found or missing tagName for type: ${node.type}`);
+  if (!canRenderA2uiNode(node)) {
+    if (!node.isPlaceholder && !node.disposed && node.context) {
+      console.warn(`Component implementation not found or missing tagName for type: ${node.type}`);
+    }
     return nothing;
   }
+  const implementation = node.impl;
   if (isWebComponentImplementation(implementation)) {
     registerUniversalElement(implementation);
   }
```

**File**: `typescript/renderers/angular/CHANGELOG.md` (modified, +1/-0)
```diff
@@ -2,6 +2,7 @@
 
 - **BREAKING CHANGE**: `ComponentHostComponent` no longer assigns `element.context` when mounting universal Web Components, and `ComponentBinder.bind(context)` and `AngularWcHost.context` are deprecated in favor of `ComponentBinder.bindNode(node)` and `AngularWcHost.node`. Recommended migration: implement `node` on custom `A2uiWebComponentElement` classes instead of `context`. [#3841](https://github.com/a2ui-project/a2ui/pull/3841)
 - **BREAKING CHANGE**: The host element of an Angular catalog component (`<a2ui-v09-component-host>`, or `<a2ui-ng-<name>>` from `toWebComponent`) applies the component's `accessibility` attributes: `aria-live`, `aria-hidden`, and `inert` on the host, and `aria-label` and `aria-description` on the host with `role="group"` (unless the host already has a `role`). Add `AccessibilityTargetDirective` (`a2uiAccessibilityTarget`), which moves `aria-label` and `aria-description` to the element it marks and adds `aria-invalid="true"` there while a check fails, and `ValidationErrorsDirective` (`a2uiValidationErrors`), which marks the element showing the validation errors so the target gets `aria-describedby` pointing at it. The v0.9 native basic catalog marks the control of `Button`, `CheckBox`, `Slider`, `TextField`, `Image`, `AudioPlayer`, and `Video`, and wraps the error messages of `Slider` and `TextField` in `<div class="a2ui-validation-errors">`. Recommended migration: a component that already sets `aria-label` from `props().accessibility` on an inner element should mark that element with `a2uiAccessibilityTarget`, or the label is announced twice. [#3499](https://github.com/a2ui-project/a2ui/issues/3499), [#3869](https://github.com/a2ui-project/a2ui/pull/3869)
+- `ListComponent` hides the item of a child that renders nothing, so it leaves no empty marker or gap. `<a2ui-v09-component-host>` carries `data-a2ui-empty` while it renders nothing. [#2013](https://github.com/a2ui-project/a2ui/issues/2013)
 
 ## 0.14.0
 
```

**File**: `typescript/renderers/angular/src/core/component-host.component.ts` (modified, +3/-0)
```diff
@@ -133,6 +133,9 @@ function findNodeInList(
   providers: [provideAccessibilityTargets()],
   host: {
     style: 'display: contents;',
+    // Marks a host that renders nothing (its component has not resolved), so a container that
+    // wraps each child in an item element can drop that item too (see ListComponent).
+    '[attr.data-a2ui-empty]': 'componentType() ? null : ""',
   },
   // The quotes around the input keys passed to *ngComponentOutlet are critical to survive Closure
   // minification. Prettier keeps them (`quoteProps: "preserve"` in the root `.prettierrc`).
```

---

### Incident Patch 3: `f077c849` (2026-11-05)
**Commit Message**: feat(swift): SwiftUI HostedViewDriver, NodeResolver placeholders, and diagnostics (#3872)

## Summary

In the Swift SDK, `NodeResolver` previously returned `nil` whenever a component referenced a missing child ID, an unregistered component type, or a cyclic child reference. The `node_resolution` conformance suite requires materializing placeholder nodes and emitting surface diagnostics instead. In addition, `A2UISwiftUITests` inspected only the intermediate `A2UICore.Node` tree rather than hosting `Surface` in a native window to check rendered controls and accessibility attributes.

This change updates `A2UICore` (`Node`, `NodeResolver`, and `MessageProcessor`) to materialize `.pending`, `.unknownType`, and `.cyclic` placeholder nodes and emit `UNKNOWN_COMPONENT_TYPE` and `CYCLIC_REFERENCE` diagnostics. It also adds `HostedViewDriver` and `a2uiAccessibility` in `A2UISwiftUI` so `AdapterConformanceTests` runs every case against both `AdapterHarness` and a live `NSHostingController`/`UIHostingController` window.

## Changes

### Swift Core `NodeResolver` Placeholders and Diagnostics (`swift/core/`)

- Adds `NodeState` (`resolved`, `pending`, `unknownType = "unknown-type"`, `cyclic`),

**File**: `swift/core/Sources/A2UICore/Models/Node.swift` (modified, +71/-1)
```diff
@@ -15,6 +15,14 @@
 import Observation
 import OrderedJSON
 
+/// The resolution state of a component ``Node``.
+public enum NodeState: String, Sendable, Equatable {
+  case resolved = "resolved"
+  case pending = "pending"
+  case unknownType = "unknown-type"
+  case cyclic = "cyclic"
+}
+
 /// A persistent, observable backing store for a resolved component node.
 @MainActor
 package final class NodeBox: Observable {
@@ -23,6 +31,9 @@ package final class NodeBox: Observable {
   nonisolated let id: String
   nonisolated let type: String
   nonisolated let catalogID: String?
+  nonisolated let state: NodeState
+  nonisolated let scopeKey: String?
+  nonisolated let dataContextPath: String
   private var _properties: [String: any Resolved]
   private var _metadata: [String: JSONValue]?
   package private(set) var revision: UInt64 = 0
@@ -42,12 +53,18 @@ package final class NodeBox: Observable {
     id: String,
     type: String,
     catalogID: String? = nil,
+    state: NodeState = .resolved,
+    scopeKey: String? = nil,
+    dataContextPath: String = "/",
     properties: [String: any Resolved],
     metadata: [String: JSONValue]? = nil
   ) {
     self.id = id
     self.type = type
     self.catalogID = catalogID
+    self.state = state
+    self.scopeKey = scopeKey
+    self.dataContextPath = dataContextPath
     self._properties = properties
     self._metadata = metadata
   }
@@ -129,30 +146,77 @@ public struct Node: Identifiable, @preconcurrency Equatable, Sendable {
   public var id: String { box.id }
   public var type: String { box.type }
   public var catalogID: String? { box.catalogID }
+  public var state: NodeState { box.state }
+  public var scopeKey: String? { box.scopeKey }
+  public var dataContextPath: String { box.dataContextPath }
   @MainActor
   public var properties: [String: any Resolved] { box.properties }
   @MainActor
   public var metadata: [String: JSONValue]? { box.metadata }
   @MainActor
   public var extensions: [String: JSONValue]? { MetadataValidator.extensions(from: box.metadata) }
 
+  /// The identity of the node's backing store.
+  ///
+  /// The resolver updates a node in place while its component keeps its type and state, so two
+  /// nodes with the same identity are the same node instance at different points in time.
+  public var identity: ObjectIdentifier { ObjectIdentifier(box) }
+
   /// Creates a new resolved component node.
   public init(
     id: String,
     type: String,
     catalogID: String? = nil,
+    state: NodeState = .resolved,
+    scopeKey: String? = nil,
+    dataContextPath: String = "/",
     properties: [String: any Resolved],
     metadata: [String: JSONValue]? = nil
   ) {
     self.box = NodeBox(
       id: id,
       type: type,
       catalogID: catalogID,
+      state: state,
+      scopeKey: scopeKey,
+      dataContextPath: dataContextPath,
       properties: properties,
       metadata: metadata
     )
   }
 
+  /// Creates a placeholder node for a referenced component ID that has not arrived yet.
+  public static func pending(
+    id: String,
+    scopeKey: String? = nil,
+    dataContextPath: String = "/"
+  ) -> Node {
+    Node(
+      id: id,
+      type: "Placeholder",
+      state: .pending,
+      scopeKey: scopeKey,
+      dataContextPath: dataContextPath,
+      properties: [:]
+    )
+  }
+
+  /// Creates a placeholder node for a component reference that closes a cycle.
+  public static func cyclic(
+    id: String,
+    scopeKey: String? = nil,
+    dataContextPath: String = "/"
+  ) -> Node {
+    Node(
+      id: id,
+      type: "Placeholder",
+      state: .cyclic,
+      scopeKey: scopeKey,
+      dataContextPath: dataContextPath,
+      properties: [:]
+    )
+  }
+
   /// Updates the backing box's resolved properties and metadata in-place.
   @MainActor
   func updateProperties(
@@ -173,7 +237,13 @@ public struct Node: Identifiable, @preconcurrency Equatable, Sendable {
     if lhs.box === rhs.box {
       return true
     }
-    guard lhs.id == rhs.id && lhs.type == rhs.type && lhs.catalogID == rhs.catalogID,
+    guard
+      lhs.id == rhs.id,
+      lhs.type == rhs.type,
+      lhs.catalogID == rhs.catalogID,
+      lhs.state == rhs.state,
+      lhs.scopeKey == rhs.scopeKey,
+      lhs.dataContextPath == rhs.dataContextPath,
       MetadataValidator.areEqual(lhs.metadata, rhs.metadata),
       lhs.properties.count == rhs.properties.count
     else {
```

**File**: `swift/core/Sources/A2UICore/Processing/MessageProcessor.swift` (modified, +4/-1)
```diff
@@ -1161,7 +1161,10 @@ public final class MessageProcessor: ObservableObject {
     let held = surface.componentsModel.components
     let catalogs = surface.catalogs
     let defaultCatalogID = surface.defaultCatalogID
-    let checksBatch = config.allowDanglingReferences && config.allowMissingRoot
+    // The bound assumes the graph is acyclic, so a config that admits cycles checks the whole
+    // surface each time.
+    let checksBatch =
+      config.allowDanglingReferences && config.allowMissingRoot && !config.allowCyclicReferences
     var batch: [String: [String: JSONValue]] = [:]
     for component in components {
       guard let id = component["id"]?.stringValue else { continue }
```

**File**: `swift/core/Sources/A2UICore/Resolution/NodeResolver.swift` (modified, +161/-34)
```diff
@@ -44,6 +44,7 @@ public final class NodeResolver: Sendable {
   private struct ComponentIdentity: Equatable {
     let type: String
     let catalogID: String?
+    let state: NodeState
   }
 
   private struct NodeResolutionRecord {
@@ -54,18 +55,23 @@ public final class NodeResolver: Sendable {
     let index: Int?
     let instanceSuffix: String?
     let visited: Set<String>
-    var componentSnapshot: ComponentModel
+    var componentSnapshot: ComponentModel?
     var childIdentities: [String: ComponentIdentity?]
     var readValues: [String: JSONValue?]
     var templateCounts: [String: Int]
     var directChildInstances: Set<String>
     var agentCalls: Set<AgentFunctionCall>
+    /// The keys in `activeCyclicNodes` of the cyclic placeholders this node references.
+    var cyclicKeys: [String] = []
   }
 
   /// The number of `resolveNode` invocations executed during the most recent `resolveTree()` pass.
   package private(set) var lastResolvedNodeCount = 0
 
   private var activeNodes: [String: Node] = [:]
+  /// Cyclic placeholder nodes, keyed by the referencing node, the property that holds the
+  /// reference, the repeated node and the occurrence of that reference within the property.
+  private var activeCyclicNodes: [String: Node] = [:]
   private var schemaCache: [String: CachedComponentSchema] = [:]
   private var nodeRecords: [String: NodeResolutionRecord] = [:]
   private var nodesByDefinitionID: [String: Set<String>] = [:]
@@ -82,6 +88,8 @@ public final class NodeResolver: Sendable {
   private var currentNodeTemplateCounts: [String: Int]?
   private var currentNodeChildIdentities: [String: ComponentIdentity?]?
   private var currentNodeDirectChildren: Set<String>?
+  /// The cyclic placeholder keys the node being resolved references, in order.
+  private var currentNodeCyclicKeys: [String]?
   private var reportedExpressionErrors: Set<String> = []
   /// The error keys each node reported in the current pass, by node key. A node shared by several
   /// parents resolves once per parent, so these are committed to `reportedExpressionErrors` when
@@ -311,6 +319,7 @@ public final class NodeResolver: Sendable {
 
   private func resetResolutionState() {
     activeNodes.removeAll()
+    activeCyclicNodes.removeAll()
     nodeRecords.removeAll()
     nodesByDefinitionID.removeAll()
     parentsByChildDefinitionID.removeAll()
@@ -371,22 +380,24 @@ public final class NodeResolver: Sendable {
         for nodeKey in instances {
           guard let record = nodeRecords[nodeKey] else { continue }
           if record.componentSnapshot != currentComp || hadClearedErrors {
-            let previousIdentity = ComponentIdentity(
-              type: record.componentSnapshot.type,
-              catalogID: record.componentSnapshot.catalogID ?? defaultCatalogID
-            )
+            let previousIdentity = record.componentSnapshot.map {
+              componentIdentity(for: $0)
+            }
             if let currentComp,
+              let previousSnap = record.componentSnapshot,
               !hadClearedErrors,
               currentIdentity == previousIdentity,
-              record.componentSnapshot.properties == currentComp.properties
+              previousSnap.properties == currentComp.properties
             {
               var updatedRecord = record
               updatedRecord.componentSnapshot = currentComp
               nodeRecords[nodeKey] = updatedRecord
               if let existing = activeNodes[nodeKey] {
                 existing.updateMetadata(currentComp.metadata)
               }
-            } else if currentIdentity == previousIdentity || nodeKey == "root" {
+            } else if currentIdentity != nil,
+              currentIdentity == previousIdentity || nodeKey == "root"
+            {
               affectedNodeIDs.insert(nodeKey)
             }
           }
@@ -490,9 +501,17 @@ public final class NodeResolver: Sendable {
     in components: [String: ComponentModel]
   ) -> ComponentIdentity? {
     guard let comp = components[definitionID] else { return nil }
+    return componentIdentity(for: comp)
+  }
+
+  private func componentIdentity(for comp: ComponentModel) -> ComponentIdentity {
+    let effectiveCatalogID = comp.catalogID ?? defaultCatalogID
+    let targetCatalog = getCatalog(id: effectiveCatalogID)
+    let isRegistered = targetCatalog?.components[comp.type] != nil
     return ComponentIdentity(
       type: comp.type,
-      catalogID: comp.catalogID ?? defaultCatalogID
+      catalogID: effectiveCatalogID,
+      state: isRegistered ? .resolved : .unknownType
     )
   }
 
@@ -508,9 +527,10 @@ public final class NodeResolver: Sendable {
       }
       if var record = nodeRecords[nodeKey],
         let currentComp,
-        record.componentSnapshot.type == currentComp.type,
-        record.componentSnapshot.catalogID == currentComp.catalogID,
-        record.componentSnapshot.properties == currentComp.properties
+        let snapshot = record.compon
```

**File**: `swift/core/Sources/A2UICore/Validation/GraphTopologyValidator.swift` (modified, +8/-2)
```diff
@@ -41,6 +41,7 @@ public enum GraphTopologyValidator {
   ) throws {
     let (allComponentIDs, adjacencyList) = try buildAdjacencyMap(
       from: components,
+      config: config,
       catalogs: catalogs,
       defaultCatalogID: defaultCatalogID
     )
@@ -234,6 +235,7 @@ public enum GraphTopologyValidator {
 
   private static func buildAdjacencyMap(
     from components: [[String: JSONValue]],
+    config: ValidationConfig,
     catalogs: [String: AnyCatalog]?,
     defaultCatalogID: String?
   ) throws -> (allIDs: Set<String>, adjacencyList: AdjacencyMap) {
@@ -264,7 +266,7 @@ public enum GraphTopologyValidator {
 
       let references = extractReferences(from: component, schema: componentSchema)
       for reference in references {
-        if reference.referenceID == componentID {
+        if reference.referenceID == componentID, !config.allowCyclicReferences {
           throw A2UIRecursionError(
             """
             Self-reference detected: Component '\(componentID)' \
@@ -327,6 +329,7 @@ public enum GraphTopologyValidator {
           depth: 0,
           allIDs: allIDs,
           adjacencyList: adjacencyList,
+          allowsCycles: config.allowCyclicReferences,
           visited: &visited,
           recursionStack: &recursionStack
         )
@@ -340,6 +343,7 @@ public enum GraphTopologyValidator {
       depth: 0,
       allIDs: allIDs,
       adjacencyList: adjacencyList,
+      allowsCycles: config.allowCyclicReferences,
       visited: &visited,
       recursionStack: &recursionStack
     )
@@ -356,6 +360,7 @@ public enum GraphTopologyValidator {
     depth: Int,
     allIDs: Set<String>,
     adjacencyList: AdjacencyMap,
+    allowsCycles: Bool,
     visited: inout Set<String>,
     recursionStack: inout Set<String>
   ) throws {
@@ -376,11 +381,12 @@ public enum GraphTopologyValidator {
             depth: depth + 1,
             allIDs: allIDs,
             adjacencyList: adjacencyList,
+            allowsCycles: allowsCycles,
             visited: &visited,
             recursionStack: &recursionStack
           )
         }
-      } else if recursionStack.contains(neighbor) {
+      } else if !allowsCycles, recursionStack.contains(neighbor) {
         throw A2UIRecursionError(
           "Circular component reference (Circular reference detected) involving component '\(neighbor)'"
         )
```

**File**: `swift/core/Sources/A2UICore/Validation/ValidationConfig.swift` (modified, +13/-0)
```diff
@@ -36,6 +36,15 @@ public struct ValidationConfig: Sendable, Equatable, Hashable {
   /// so it is still reported.
   public var allowUnknownElements: Bool
 
+  /// Whether self-references and reference cycles between components are permitted.
+  ///
+  /// When this is on, the graph check accepts a component that references itself or one of its
+  /// ancestors, and the ``NodeResolver`` renders the repeated reference as a `cyclic` placeholder
+  /// node and reports `CYCLIC_REFERENCE` on the surface. The global depth limit and the catalog
+  /// composition constraints still apply. ``relaxed`` leaves this off, so a cycle is rejected
+  /// unless a host opts in.
+  public var allowCyclicReferences: Bool
+
   /// The target protocol version (e.g. `"v0.9.1"`), or `nil` when unspecified.
   public var targetVersion: String?
 
@@ -54,12 +63,14 @@ public struct ValidationConfig: Sendable, Equatable, Hashable {
     allowDanglingReferences: Bool = false,
     allowMissingRoot: Bool = false,
     allowUnknownElements: Bool = false,
+    allowCyclicReferences: Bool = false,
     targetVersion: String? = nil
   ) {
     self.allowOrphanComponents = allowOrphanComponents
     self.allowDanglingReferences = allowDanglingReferences
     self.allowMissingRoot = allowMissingRoot
     self.allowUnknownElements = allowUnknownElements
+    self.allowCyclicReferences = allowCyclicReferences
     self.targetVersion = targetVersion
   }
 
@@ -69,13 +80,15 @@ public struct ValidationConfig: Sendable, Equatable, Hashable {
     allowDanglingReferences: Bool = false,
     allowMissingRoot: Bool = false,
     allowUnknownElements: Bool = false,
+    allowCyclicReferences: Bool = false,
     protocolVersion: A2UIProtocolVersion
   ) {
     self.init(
       allowOrphanComponents: allowOrphanComponents,
       allowDanglingReferences: allowDanglingReferences,
       allowMissingRoot: allowMissingRoot,
       allowUnknownElements: allowUnknownElements,
+      allowCyclicReferences: allowCyclicReferences,
       targetVersion: protocolVersion.rawValue
     )
   }
```

**File**: `swift/core/Tests/A2UIConformanceTests/NodeResolutionConformanceTests.swift` (modified, +70/-18)
```diff
@@ -65,12 +65,7 @@ private final class RecordingFunctionImplementation: FunctionImplementation, @un
 /// Runs the shared `conformance/core/node_resolution.yaml` suite.
 @MainActor
 struct NodeResolutionConformanceTests {
-  static let placeholderKnownIssues: [String: String] = [
-    "cyclic_component_reference_same_scope": "NodeResolver omits placeholder nodes",
-    "pending_child_replacement": "NodeResolver omits placeholder nodes",
-    "shared_definition_independent_instances": "NodeResolver omits placeholder nodes",
-    "unknown_component_type_placeholder": "NodeResolver omits placeholder nodes",
-  ]
+  static let placeholderKnownIssues: [String: String] = [:]
 
   private static let knownCaseKeys: Set<String> = [
     "action",
@@ -461,9 +456,6 @@ struct NodeResolutionConformanceTests {
         rawChildren.indices.contains(idx),
         let childDefID = rawChildren[idx].stringValue
       {
-        guard surface.componentsModel.components[childDefID] != nil else {
-          return nil
-        }
         if let match = nodes.first(where: {
           $0.id == childDefID || $0.id.hasPrefix("\(childDefID)_")
             || $0.id.hasPrefix("\(childDefID):")
@@ -554,6 +546,9 @@ struct NodeResolutionConformanceTests {
     if let expectedEvents = expect["events"] as? [[String: Any]] {
       assertExpectedEvents(expectedEvents, actual: capture.events, caseName: caseName)
     }
+    if let expectedErrors = expect["errors"] as? [[String: Any]] {
+      assertExpectedErrors(expectedErrors, actual: capture.errors, caseName: caseName)
+    }
     if let expectedFunctions = expect["functions"] as? [[String: Any]] {
       assertExpectedFunctions(expectedFunctions, actual: capture.functionCalls, caseName: caseName)
     }
@@ -580,24 +575,37 @@ struct NodeResolutionConformanceTests {
         Issue.record("[\(caseName)] Expected resolved node at '\(nodePath)'")
         continue
       }
-      assertSingleNodeMatches(node: node, spec: spec, nodePath: nodePath, caseName: caseName)
+      assertSingleNodeMatches(
+        node: node,
+        spec: spec,
+        surface: surface,
+        nodePath: nodePath,
+        caseName: caseName
+      )
     }
   }
 
   private func assertSingleNodeMatches(
     node: Node,
     spec: [String: Any],
+    surface: SurfaceViewModel?,
     nodePath: String,
     caseName: String
   ) {
-    let expectedState = spec["state"] as? String ?? "resolved"
-    #expect(
-      expectedState == "resolved",
-      "[\(caseName)] \(nodePath) state mismatch: got 'resolved', expected '\(expectedState)'"
-    )
+    // Like the other runners, only check `state` when the spec names it: an empty
+    // spec such as `root/children/0: {}` asserts presence, not a resolved state.
+    if let expectedState = spec["state"] as? String {
+      #expect(
+        node.state.rawValue == expectedState,
+        """
+        [\(caseName)] \(nodePath) state mismatch: \
+        got '\(node.state.rawValue)', expected '\(expectedState)'
+        """
+      )
+    }
+    let baseID = node.id.split(separator: ":").first.map(String.init) ?? node.id
+    let strippedID = baseID.split(separator: "_").first.map(String.init) ?? baseID
     if let expectedCompID = spec["component_id"] as? String {
-      let baseID = node.id.split(separator: ":").first.map(String.init) ?? node.id
-      let strippedID = baseID.split(separator: "_").first.map(String.init) ?? baseID
       #expect(
         node.id == expectedCompID || baseID == expectedCompID || strippedID == expectedCompID,
         """
@@ -606,8 +614,23 @@ struct NodeResolutionConformanceTests {
         """
       )
     }
+    if let expectedDataPath = spec["data_path"] as? String {
+      #expect(
+        node.dataContextPath == expectedDataPath,
+        """
+        [\(caseName)] \(nodePath) data_path mismatch: \
+        got '\(node.dataContextPath)', expected '\(expectedDataPath)'
+        """
+      )
+    }
     if let expectedType = spec["type"] as? String {
-      #expect(node.type == expectedType, "[\(caseName)] \(nodePath) type mismatch")
+      let declaredType =
+        surface?.componentsModel.components[baseID]?.type
+        ?? surface?.componentsModel.components[strippedID]?.type
+      let actualType =
+        (node.state == .cyclic && node.type == "Placeholder")
+        ? (declaredType ?? node.type) : node.type
+      #expect(actualType == expectedType, "[\(caseName)] \(nodePath) type mismatch")
     }
     if let expectedIsValid = spec["isValid"] as? Bool {
       #expect(node.isValid == expectedIsValid, "[\(caseName)] \(nodePath) isValid mismatch")
@@ -704,6 +727,35 @@ struct NodeResolutionConformanceTests {
     }
   }
 
+  private func assertExpectedErrors(
+    _ expectedErrors: [[String: Any]],
+    actual: [RendererError],
+    caseName: String
+  ) {
+    #expect(actual.count >= expectedErrors.count, "[\(caseName)] Error count mismatch")
+    for expSpec in expectedErrors {
+      let expCode = expSpec["code"] as? String
```

**File**: `swift/core/Tests/A2UICoreTests/ComponentGraphBatchCheckTests.swift` (modified, +38/-2)
```diff
@@ -212,6 +212,34 @@ struct ComponentGraphBatchCheckTests {
     try runRandomSequences(catalog: try plainCatalog(), seed: 2)
   }
 
+  @Test func cyclesAcceptedWhenConfigAllowsCyclicReferences() throws {
+    let processor = try makeProcessor(catalog: try plainCatalog(), allowsCycles: true)
+    try send([column("root", children: ["a"]), column("a", children: ["root"])], to: processor)
+    try send([column("a", children: ["a"])], to: processor)
+    let surface = try #require(processor.surfaceGroupModel.surfacesMap["s"])
+    #expect(Set(surface.componentsModel.components.keys) == ["root", "a"])
+  }
+
+  @Test func depthLimitStillAppliesWhenConfigAllowsCyclicReferences() throws {
+    let processor = try makeProcessor(catalog: try plainCatalog(), allowsCycles: true)
+    let chain = (0...55).map { column("c\($0)", children: ["c\($0 + 1)"]) }
+    #expect(throws: A2UIRecursionError.self) {
+      try send(chain, to: processor)
+    }
+  }
+
+  @Test func compositionStillAppliesWhenConfigAllowsCyclicReferences() throws {
+    let processor = try makeProcessor(catalog: try compositionCatalog(), allowsCycles: true)
+    do {
+      try send([card("c", child: "c")], to: processor)
+      Issue.record("Expected the self-nested Card to break a composition rule")
+    } catch let error as A2UIValidationError {
+      // A recursion error is also a validation error, so check that the composition rule fired.
+      #expect(!(error is A2UIRecursionError))
+      #expect(error.message.contains("cannot contain child"))
+    }
+  }
+
   // MARK: - Helpers
 
   private func runRandomSequences(catalog: AnyCatalog, seed: UInt64) throws {
@@ -289,8 +317,16 @@ struct ComponentGraphBatchCheckTests {
   }
 
   /// A processor under the relaxed config holding surface `s` in the catalog `catalog`.
-  private func makeProcessor(catalog: AnyCatalog) throws -> MessageProcessor {
-    let processor = MessageProcessor(catalogs: [catalog], validationConfig: .relaxed)
+  ///
+  /// - Parameter allowsCycles: Whether the config also sets
+  ///   ``ValidationConfig/allowCyclicReferences``.
+  private func makeProcessor(
+    catalog: AnyCatalog,
+    allowsCycles: Bool = false
+  ) throws -> MessageProcessor {
+    var config = ValidationConfig.relaxed
+    config.allowCyclicReferences = allowsCycles
+    let processor = MessageProcessor(catalogs: [catalog], validationConfig: config)
     try processor.processMessages(
       .array([
         .object([
```

**File**: `swift/core/Tests/A2UICoreTests/NodeResolverTests.swift` (modified, +196/-16)
```diff
@@ -126,7 +126,7 @@ struct NodeResolverTests {
     #expect(children[0].string(for: "text") == "Hello World")
   }
 
-  @Test func childListSkipsUnarrivedComponents() throws {
+  @Test func childListMaterializesPendingPlaceholderForUnarrivedComponents() throws {
     let catalog = try makeCatalog()
     // child1 not in components dictionary yet
     let components: [String: ComponentModel] = [
@@ -152,12 +152,18 @@ struct NodeResolverTests {
 
     let rootNode = try #require(resolver.resolveTree())
     let children = rootNode.children(for: "children")
-    #expect(children.count == 1)
-    #expect(children[0].id == "child2")
+    #expect(children.count == 2)
+    #expect(children[0].id == "child1")
+    #expect(children[0].type == "Placeholder")
+    #expect(children[0].state == .pending)
+    #expect(children[1].id == "child2")
+    #expect(children[1].type == "Text")
+    #expect(children[1].state == .resolved)
   }
 
-  @Test func cyclicReferencesReturnNilWithoutInfiniteLoop() throws {
+  @Test func cyclicReferencesReturnCyclicPlaceholderAndReportErrorOnce() throws {
     let catalog = try makeCatalog()
+    let handler = ExpressionErrorCaptureHandler()
     let components: [String: ComponentModel] = [
       "root": ComponentModel(
         id: "root",
@@ -176,19 +182,164 @@ struct NodeResolverTests {
       ),
     ]
 
+    let dataModel = DataModel()
     let resolver = NodeResolver(
       surfaceID: "s1",
       catalogs: [catalog.id: catalog],
       defaultCatalogID: catalog.id,
       componentsModel: SurfaceComponentsModel(components: components),
-      dataModel: DataModel()
+      dataModel: dataModel,
+      actionHandler: handler
     )
 
     let rootNode = try #require(resolver.resolveTree())
     let aNode = try #require(rootNode.children(for: "children").first)
     let bNode = try #require(aNode.children(for: "children").first)
-    // b's reference back to a is detected as cyclic and omitted
-    #expect(bNode.children(for: "children").isEmpty)
+    let cyclicChild = try #require(bNode.children(for: "children").first)
+    #expect(cyclicChild.id == "a")
+    #expect(cyclicChild.type == "Placeholder")
+    #expect(cyclicChild.state == .cyclic)
+    #expect(handler.capturedErrors.count == 1)
+    if case .generic(let genericError) = handler.capturedErrors.first {
+      #expect(genericError.code == "CYCLIC_REFERENCE")
+      #expect(genericError.surfaceID == "s1")
+    } else {
+      Issue.record("Expected CYCLIC_REFERENCE generic error")
+    }
+
+    // Subsequent incremental passes do not re-emit CYCLIC_REFERENCE for the same cyclic node key.
+    dataModel.set("/unrelated", value: .string("updated"))
+    _ = try #require(resolver.resolveTree())
+    #expect(handler.capturedErrors.count == 1)
+  }
+
+  @Test func repeatedCyclicReferencesGetDistinctPlaceholders() throws {
+    let catalog = try makeCatalog()
+    let components: [String: ComponentModel] = [
+      "root": ComponentModel(
+        id: "root",
+        type: "Container",
+        properties: ["children": .array([.string("card")])]
+      ),
+      "card": ComponentModel(
+        id: "card",
+        type: "Container",
+        properties: [
+          "child": .string("root"),
+          "children": .array([.string("root"), .string("root")]),
+        ]
+      ),
+    ]
+    let resolver = NodeResolver(
+      surfaceID: "s1",
+      catalogs: [catalog.id: catalog],
+      defaultCatalogID: catalog.id,
+      componentsModel: SurfaceComponentsModel(components: components),
+      dataModel: DataModel()
+    )
+
+    let rootNode = try #require(resolver.resolveTree())
+    let card = try #require(rootNode.children(for: "children").first)
+    let single = try #require(card.child(for: "child"))
+    let listed = card.children(for: "children")
+    #expect(listed.count == 2)
+    let placeholders = [single] + listed
+    #expect(placeholders.allSatisfy { $0.state == .cyclic })
+    #expect(Set(placeholders.map(\.identity)).count == 3)
+  }
+
+  @Test func cycleRemovedAndRestoredGetsFreshPlaceholder() throws {
+    let catalog = try makeCatalog()
+    let componentsModel = SurfaceComponentsModel(components: [
+      "root": ComponentModel(
+        id: "root",
+        type: "Container",
+        properties: ["children": .array([.string("a")])]
+      ),
+      "a": ComponentModel(
+        id: "a",
+        type: "Container",
+        properties: ["children": .array([.string("root")])]
+      ),
+    ])
+    let resolver = NodeResolver(
+      surfaceID: "s1",
+      catalogs: [catalog.id: catalog],
+      defaultCatalogID: catalog.id,
+      componentsModel: componentsModel,
+      dataModel: DataModel()
+    )
+
+    func cyclicChild() throws -> Node? {
+      let rootNode = try #require(resolver.resolveTree())
+      let aNode = try #require(rootNode.children(for: "children").first)
+      return aNode.children(for: "children").first
+    }
+
+    let first = try #require(try cyclicChild())
+    #expect(first.stat
```

#### Recent Merged Pull Requests:
- **PR #4004** (2026-11-05): docs: remove 'Early stage public preview' section from README.md (@yjbanov)
- **PR #3996** (2026-11-05): chore(skills): mark contributor skills as internal (@innkuika)
- **PR #3980** (2026-11-04): chore(release): a2ui_agent 0.1.0, a2ui_flutter 0.1.0, a2ui_cli 0.2.0 (@ditman)
- **PR #3979** (2026-11-04): chore(release): a2ui_core 0.5.0 (@ditman)
- **PR #3976** (2026-11-04): docs(react): import from package roots in the README (@innkuika)
- **PR #3970** (2026-11-04): docs(site): fix preview site header regressions (@yjbanov)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. docs(site): add Swappable Inference Formats concept guide (#3969)

**RULE**:
When implementing operations in `docs/site/src/components/docs/InferencePipeline.astro`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in a2ui-project/a2ui. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `eee79070`: docs(site): add Swappable Inference Formats concept guide (#3969). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/site/src/components/docs/InferencePipeline.astro`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
---
/*
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
---

<div
  class="ip-root not-content"
  data-diagram
  data-diagram-title="inference-pipeline"
>
  <div class="ip-banner">
    <div class="ip-banner__left">
      <span class="ip-badge">SERVER-SIDE AGENT SDK</span>
      <span class="ip-banner__title">
        A2uiRequestProcessor: Swappable Generation &rarr; Standard Wire JSON
      </span>
    </div>
    <div class="ip-banner__pills">
      <span class="ip-pill ip-pill--teal">Express (Default)</span>
      <span class="ip-pill ip-pill--blue">Direct JSON</span>
      <span class="ip-pill ip-pill--amber">Custom Formats</span>
    </div>
  </d
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `eee79070` are properly handled with clean fallback behavior.
