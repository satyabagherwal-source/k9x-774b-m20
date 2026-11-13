# Verification Protocol: Verification Protocol: Empirical Defect Shield for a2ui-project-a2ui-learnings

<!-- PROVENANCE_START
{
  "source_repository": "a2ui-project-a2ui-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T16:05:41.237Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-a2ui-project-a2ui-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [a2ui-project-a2ui-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T16:05:41.237Z`  
> **Learning ID**: `LEARN-EVO-a2ui-project-a2ui-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `a2ui-project-a2ui-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/a2ui-project-a2ui-learnings.md`  
> **Source**: github ([https://github.com/a2ui-project/a2ui](https://github.com/a2ui-project/a2ui))  
> **Source Version**: `f2c410ae`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-13T16:04:56.722Z  
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
> **Harvest Timestamp**: 2026-11-13T16:04:56.717Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `a2ui-project/a2ui`
- **Description**: Open-source generative UI framework: agents stream layout data, and apps render it with native components in React, Angular, Lit, Flutter, SwiftUI and Jetpack Compose.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md
- **Stars / Engagement**: 17289 stars

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
    if name.isalnum():
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
        for dep in sorted(graph.get(name, set()), key=spec_index.__getitem__):
            visit(dep)
        
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

### Core Architecture Module: `python/a2ui_adk/src/a2ui/adk/renderer_calls_store.py`
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

"""Module for the A2uiRendererCallsStore.

A `RendererFunctionCalls` holds the agent's pending `callRendererFunction`
calls of one conversation, as asyncio futures, so like an
`A2uiRequestProcessor` it can't be kept in ADK session state.
`A2uiRendererCallsStore` keeps one per session in memory. A tool gets the
session's instance to call a renderer function, and the callback from
`a2ui_rpc_callback` gets the same instance to settle the call when the
renderer's `rendererFunctionResponse` arrives.

Usage Example:

  ```python
  renderer_calls = A2uiRendererCallsStore()

  # In the agent
  agent = LlmAgent(
      ...,
      before_agent_callback=a2ui_rpc_callback(
          catalogs=catalogs, renderer_calls=renderer_calls.get
      ),
  )

  # In a tool
  message, result = renderer_calls.get(tool_context).call(
      catalog_id=CATALOG_ID, name="getLocation"
  )

  # When the session ends
  renderer_calls.remove(session.id)
  ```
"""

from __future__ import annotations

from google.adk.agents.readonly_context import ReadonlyContext
from google.adk.utils.feature_decorator import experimental

from a2ui.rpc import DEFAULT_RENDERER_CALL_TIMEOUT, RendererFunctionCalls


@experimental
class A2uiRendererCallsStore:
    """Keeps a `RendererFunctionCalls` for each session, outside session state.

    `get` creates the session's instance the first time it is asked for, with
    the store's `default_timeout` and `max_pending`. Call `remove` when a
    session ends: it disposes the session's instance, which fails its pending
    calls. Nothing is evicted on its own.
    """

    def __init__(
        self,
        *,
        default_timeout: float | None = DEFAULT_RENDERER_CALL_TIMEOUT,
        max_pending: int | None = None,
    ) -> None:
        """Initializes the store.

        Args:
            default_timeout: The `default_timeout` of each session's
                `RendererFunctionCalls`.
            max_pending: The `max_pending` of each session's
                `RendererFunctionCalls`.

        Raises:
            ValueError: If `default_timeout` is not a finite positive number
                or None, or `max_pending` is less than 1, as for
                `RendererFunctionCalls`.
        """
        # Checks the settings the way each session's instance will.
        RendererFunctionCalls(default_timeout=default_timeout, max_pending=max_pending)
        self._default_timeout = default_timeout
        self._max_pending = max_pending
        self._calls: dict[str, RendererFunctionCalls] = {}

    def get(self, ctx: ReadonlyContext) -> RendererFunctionCalls:
        """Returns the `RendererFunctionCalls` of the context's session.

        It has the signature of a `RendererFunctionCallsProvider`, so it can be
        passed as the `renderer_calls` of `a2ui_rpc_callback`.
        """
        return self.get_for_session(ctx.session.id)

    def get_for_session(self, session_id: str) -> RendererFunctionCalls:
        """Returns the session's `RendererFunctionCalls`, creating it if needed.

        An instance that was disposed outside the store is replaced.
        """
        calls = self._calls.get(session_id)
        if calls is None or calls.disposed:
            calls = RendererFunctionCalls(
                default_timeout=self._default_timeout, max_pending=self._max_pending
            )
            self._calls[session_id] = calls
        return calls

    def remove(self, session_id: str, reason: str = "The session was removed.") -> None:
        """Removes and disposes the session's instance, if it has one.

        Its pending calls fail with `A2uiRpcError(reason)`.
        """
        calls = self._calls.pop(session_id, None)
        if calls is not None:
            calls.dispose(reason)

    def dispose(self, reason: str = "The store was disposed.") -> None:
        """Removes and disposes every session's instance, as on shutdown."""
        calls, self._calls = self._calls, {}
        for instance in calls.values():
            instance.dispose(reason)

    def __contains__(self, session_id: object) -> bool:
        return session_id in self._calls

    def __len__(self) -> int:
        return len(self._calls)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4231** (2026-11-13): **Support zod >= 4.6.6 in @a2ui/web_core and @a2ui/react**
  *Symptoms*: `@a2ui/web_core` (latest 0.15.0) depends on `zod ^3.25.76`, and `@a2ui/react` pulls it in. Zod versions below 4.6.6 have two open security advisories (reported as Dependabot alerts in consuming projects), and there is no patched zod 3 release, so consumers cannot resolve them without upstream moving to zod 4.  Request: support zod >= 4.6.6 (ideally as the supported major, or via a peer range that allows both) in `@a2ui/web_core` and `@a2ui/react`.  Consumers currently can only mitigate by bounding input size before validation.
  **Post-Mortem & Fix Analysis**:
  > Closing as a duplicate of #4192 (and related #2160).

- **Issue #4218** (2026-11-13): **docs(site): update L+R Alder copy and walkthrough video on Get Help page**
  *Symptoms*: Updates the L+R (Alder) entry on the Get Help page (`docs/site/src/pages/get-help.astro`) and replaces `docs/public/assets/consultants/lr-walkthrough.mp4` per email feedback from Alex Levin:  - Updated `appTagline` to `Conversational stylist for fashion retail` - Updated `summary` to: "Pairs a guided style chat with a live outfit-building 'dressing room' cart across foldable phones and web ecommerce. Host code validates catalog and bag state locally, and an in-app inspector displays raw A2UI message batches." - Updated `videoLabel` to `Walkthrough` and `videoCaption` to `L+R · Alder walkthrough` - Replaced `docs/public/assets/consultants/lr-walkthrough.mp4` with the provided `ALDER-walkthrough.mp4` video - Verified `agencyUrl` (`https://www.levinriegner.com/integrated-offerings/a2ui-consulting-development/`) is already up to date  ### Verification - `npm --prefix docs/site test`: 21 passed, 1 skipped (pre-build dist check) - `npm --prefix docs/site run build`: 36 pages built, 2402 internal links and 2226 fragment anchors verified with 0 errors

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

### Incident Patch 1: `0d2fcf37` (2026-11-12)
**Commit Message**: fix(swift/core): drop theme from a v1.0 createSurface in relaxed mode (#4099)

* fix(swift/core): drop theme from a v1.0 createSurface in relaxed mode

The v1.0 spec says a createSurface carrying theme fails strict validation
and relaxed renderers drop it. web_core drops it when unknown elements are
allowed, but the Swift V10VersionAdapter rejected it in every mode.

Add an allowUnknownElements overload of VersionAdapter.extractOperations,
mirroring web_core's options argument. V10VersionAdapter removes theme from
each createSurface when it is set, and MessageProcessor passes its
validation config's allowUnknownElements. Strict mode still rejects theme,
and other unknown createSurface keys are still rejected, as in web_core.

Un-skip v10_theme_dropped_in_permissive_mode_renders_like_none in the
SwiftUI adapter harness and add core tests for both modes.

* fix(swift/core): strip v1.0 createSurface theme without recursion

The relaxed-mode theme stripper now only visits the one-level shapes
extractOperations accepts (single message, array, messages wrapper),
so deeply nested untrusted payloads can't drive unbounded recursion.

* refactor(swift/core): drop v1.0 theme through a per-mes

**File**: `swift/core/Sources/A2UICore/Processing/Adapters/BaseVersionAdapter.swift` (modified, +49/-10)
```diff
@@ -48,23 +48,49 @@ open class BaseVersionAdapter: VersionAdapter, @unchecked Sendable {
   }
 
   open func extractOperations(from payload: JSONValue) throws -> [InternalOperation] {
+    try extractOperations(from: payload, allowUnknownElements: false)
+  }
+
+  /// Validates the payload as ``extractOperations(from:)`` does, passing `allowUnknownElements`
+  /// to ``preparePayloadForValidation(_:action:allowUnknownElements:)`` for each message.
+  open func extractOperations(
+    from payload: JSONValue,
+    allowUnknownElements: Bool
+  ) throws -> [InternalOperation] {
     switch payload {
     case .null:
       return []
     case .array(let items):
-      return try extractOperationsFromArray(items)
-    case .object(let dict):
-      if let messages = dict["messages"]?.arrayValue {
-        return try extractOperationsFromArray(messages)
+      return try extractOperationsFromArray(items, allowUnknownElements: allowUnknownElements)
+    case .object(let messageObject):
+      if let messages = messageObject["messages"]?.arrayValue {
+        return try extractOperationsFromArray(
+          messages,
+          allowUnknownElements: allowUnknownElements
+        )
       }
-      return try extractOperationsFromSingleMessageObject(dict)
+      return try extractOperationsFromSingleMessageObject(
+        messageObject,
+        allowUnknownElements: allowUnknownElements
+      )
     default:
       return []
     }
   }
 
+  /// Lets subclasses normalize a single message before validation, such as dropping properties
+  /// that relaxed renderers ignore. The default returns `message` unchanged.
+  open func preparePayloadForValidation(
+    _ message: OrderedDictionary<String, JSONValue>,
+    action: String,
+    allowUnknownElements: Bool
+  ) -> OrderedDictionary<String, JSONValue> {
+    message
+  }
+
   private func extractOperationsFromArray(
-    _ items: [JSONValue]
+    _ items: [JSONValue],
+    allowUnknownElements: Bool
   ) throws -> [InternalOperation] {
     guard !items.isEmpty else { return [] }
     for (index, item) in items.enumerated() {
@@ -88,17 +114,23 @@ open class BaseVersionAdapter: VersionAdapter, @unchecked Sendable {
     }
     return try items.enumerated().flatMap { index, item -> [InternalOperation] in
       do {
-        return try extractOperations(from: item)
+        return try extractOperations(from: item, allowUnknownElements: allowUnknownElements)
       } catch let error as A2UIValidationError {
         throw rewriteMessageIndex(in: error, to: index)
       }
     }
   }
 
   private func extractOperationsFromSingleMessageObject(
-    _ dict: OrderedDictionary<String, JSONValue>
+    _ rawMessage: OrderedDictionary<String, JSONValue>,
+    allowUnknownElements: Bool
   ) throws -> [InternalOperation] {
-    let action = try extractSingleAction(from: dict)
+    let action = try extractSingleAction(from: rawMessage)
+    let dict = preparePayloadForValidation(
+      rawMessage,
+      action: action,
+      allowUnknownElements: allowUnknownElements
+    )
     guard let actionObj = dict[action]?.objectValue else {
       throw A2UIValidationError(
         "Payload for action '\(action)' must be an object",
@@ -118,11 +150,18 @@ open class BaseVersionAdapter: VersionAdapter, @unchecked Sendable {
   }
 
   open func adaptMessage(_ message: AgentToRendererMessage) throws -> [InternalOperation] {
+    try adaptMessage(message, allowUnknownElements: false)
+  }
+
+  open func adaptMessage(
+    _ message: AgentToRendererMessage,
+    allowUnknownElements: Bool
+  ) throws -> [InternalOperation] {
     let encoder = JSONEncoder()
     encoder.userInfo[.a2uiProtocolVersion] = message.version
     let data = try encoder.encode(message)
     let jsonValue = try JSONValue.parse(data)
-    let ops = try extractOperations(from: jsonValue)
+    let ops = try extractOperations(from: jsonValue, allowUnknownElements: allowUnknownElements)
     if case .updateDataModel(let msg) = message, msg.value == nil {
       return ops.map { op in
         if case .updateDataModel(let updateOp) = op {
```

**File**: `swift/core/Sources/A2UICore/Processing/Adapters/V10VersionAdapter.swift` (modified, +21/-1)
```diff
@@ -19,7 +19,8 @@ import OrderedJSON
 ///
 /// Supports `createSurface`, `updateComponents`, `updateDataModel`, `deleteSurface`,
 /// `callRendererFunction`, and `agentFunctionResponse`. Per the v1.0 specification and
-/// core blueprint rule 6, `theme` is not extracted on `createSurface`.
+/// core blueprint rule 6, `theme` is not extracted on `createSurface`: a `createSurface` that
+/// carries it is rejected, unless unknown elements are allowed, in which case `theme` is dropped.
 public final class V10VersionAdapter: BaseVersionAdapter, @unchecked Sendable {
   private static let supportedActions: Set<String> = Set(InternalOperation.allOperationTypes)
   private static let supportedCatalogVersions: Set<String> = ["1.0"]
@@ -36,6 +37,25 @@ public final class V10VersionAdapter: BaseVersionAdapter, @unchecked Sendable {
     Self.supportedCatalogVersions
   }
 
+  /// Drops `theme` from a `createSurface` before validation when `allowUnknownElements` is set,
+  /// as relaxed renderers do; otherwise `theme` is rejected as an unrecognized property.
+  public override func preparePayloadForValidation(
+    _ message: OrderedDictionary<String, JSONValue>,
+    action: String,
+    allowUnknownElements: Bool
+  ) -> OrderedDictionary<String, JSONValue> {
+    guard allowUnknownElements,
+      action == "createSurface",
+      var createSurface = message["createSurface"]?.objectValue,
+      createSurface.removeValue(forKey: "theme") != nil
+    else {
+      return message
+    }
+    var updatedMessage = message
+    updatedMessage["createSurface"] = .object(createSurface)
+    return updatedMessage
+  }
+
   public override func extractOperationsFromObject(
     _ message: OrderedDictionary<String, JSONValue>,
     action: String,
```

**File**: `swift/core/Sources/A2UICore/Processing/Adapters/VersionAdapter.swift` (modified, +38/-0)
```diff
@@ -35,8 +35,46 @@ public protocol VersionAdapter: Sendable {
   /// Validates a raw JSON payload and normalizes it into version-neutral operations.
   func extractOperations(from payload: JSONValue) throws -> [InternalOperation]
 
+  /// Validates a raw JSON payload and normalizes it into version-neutral operations, applying
+  /// the processor's unknown-element policy where the protocol version defines one.
+  ///
+  /// - Parameters:
+  ///   - payload: The raw JSON message payload or message array.
+  ///   - allowUnknownElements: Whether the caller's validation config permits unknown elements
+  ///     (see ``ValidationConfig/allowUnknownElements``).
+  func extractOperations(
+    from payload: JSONValue,
+    allowUnknownElements: Bool
+  ) throws -> [InternalOperation]
+
   /// Normalizes a decoded ``AgentToRendererMessage`` into version-neutral operations.
   func adaptMessage(_ message: AgentToRendererMessage) throws -> [InternalOperation]
+
+  /// Normalizes a decoded ``AgentToRendererMessage`` into version-neutral operations, applying
+  /// the same unknown-element policy as ``extractOperations(from:allowUnknownElements:)``.
+  func adaptMessage(
+    _ message: AgentToRendererMessage,
+    allowUnknownElements: Bool
+  ) throws -> [InternalOperation]
+}
+
+extension VersionAdapter {
+  /// Ignores `allowUnknownElements` and validates the payload as
+  /// ``extractOperations(from:)`` does.
+  public func extractOperations(
+    from payload: JSONValue,
+    allowUnknownElements: Bool
+  ) throws -> [InternalOperation] {
+    try extractOperations(from: payload)
+  }
+
+  /// Ignores `allowUnknownElements` and adapts the message as ``adaptMessage(_:)`` does.
+  public func adaptMessage(
+    _ message: AgentToRendererMessage,
+    allowUnknownElements: Bool
+  ) throws -> [InternalOperation] {
+    try adaptMessage(message)
+  }
 }
 
 /// Evaluates whether a catalog's declared protocol version is compatible with an expected
```

**File**: `swift/core/Sources/A2UICore/Processing/MessageProcessor.swift` (modified, +8/-2)
```diff
@@ -640,7 +640,10 @@ public final class MessageProcessor: ObservableObject {
     do {
       let adapter = try adapterFactory.resolveFromPayload(payload)
       envelopeVersion = adapter.version
-      operations = try adapter.extractOperations(from: payload)
+      operations = try adapter.extractOperations(
+        from: payload,
+        allowUnknownElements: validationConfig.allowUnknownElements
+      )
     } catch {
       let rawContext = extractRawEnvelopeContext(from: payload, error: error)
       let surfaceID = extractSurfaceID(from: error, fallback: rawContext.surfaceID ?? "")
@@ -822,7 +825,10 @@ public final class MessageProcessor: ObservableObject {
 
   private func adaptToOperations(_ message: AgentToRendererMessage) throws -> [InternalOperation] {
     let adapter = adapterFactory.getAdapter(for: message.version)
-    return try adapter.adaptMessage(message)
+    return try adapter.adaptMessage(
+      message,
+      allowUnknownElements: validationConfig.allowUnknownElements
+    )
   }
 
   private func extractSurfaceID(from error: Error, fallback: String) -> String {
```

**File**: `swift/core/Tests/A2UICoreTests/MessageProcessorTests.swift` (modified, +72/-0)
```diff
@@ -218,6 +218,78 @@ struct MessageProcessorTests {
     #expect(try processor.getRendererDataModel() == nil)
   }
 
+  // MARK: - v1.0 createSurface theme
+
+  private static let v10CreateSurfaceWithTheme = """
+    {
+      "version": "1.0",
+      "createSurface": {
+        "surfaceId": "s1",
+        "catalogId": "cat-v10",
+        "theme": { "primaryColor": "#FF00AA" }
+      }
+    }
+    """
+
+  private func makeV10Catalog() throws -> Catalog<AnyComponentAPI> {
+    Catalog(
+      id: "cat-v10",
+      protocolVersion: .v10,
+      components: [
+        AnyComponentAPI(name: "Text", schema: try Schema(instance: "{\"type\": \"object\"}"))
+      ]
+    )
+  }
+
+  @Test func relaxedProcessorDropsV10CreateSurfaceTheme() throws {
+    let processor = MessageProcessor(catalogs: [try makeV10Catalog()])
+    try processor.processMessages(try JSONValue.parse(Self.v10CreateSurfaceWithTheme))
+    let surface = try #require(processor.surfaceGroupModel["s1"])
+    #expect(surface.theme == nil)
+  }
+
+  @Test func strictProcessorRejectsV10CreateSurfaceTheme() throws {
+    let processor = MessageProcessor(
+      catalogs: [try makeV10Catalog()],
+      validationConfig: .strict
+    )
+    let error = try #require(throws: A2UIValidationError.self) {
+      try processor.processMessages(try JSONValue.parse(Self.v10CreateSurfaceWithTheme))
+    }
+    #expect(error.message.contains("unrecognized property 'theme'"))
+    #expect(processor.surfaceGroupModel["s1"] == nil)
+  }
+
+  @Test(arguments: [true, false])
+  func processMessageAppliesUnknownElementPolicyToV10CreateSurfaceTheme(
+    allowUnknownElements: Bool
+  ) throws {
+    let handler = TestProcessorActionHandler()
+    let processor = MessageProcessor(
+      catalogs: [try makeV10Catalog()],
+      actionHandler: handler,
+      validationConfig: allowUnknownElements ? .relaxed : .strict
+    )
+    processor.process(
+      message: .createSurface(
+        CreateSurfaceMessage(
+          surfaceID: "s1",
+          catalogID: "cat-v10",
+          theme: ["primaryColor": .string("#FF00AA")],
+          version: .v10
+        )
+      )
+    )
+    if allowUnknownElements {
+      let surface = try #require(processor.surfaceGroupModel["s1"])
+      #expect(surface.theme == nil)
+      #expect(handler.capturedErrors.isEmpty)
+    } else {
+      #expect(processor.surfaceGroupModel["s1"] == nil)
+      #expect(handler.capturedErrors.count == 1)
+    }
+  }
+
   @Test func getRendererDataModelMultiVersionRequiresExplicitVersion() throws {
     let v091Catalog = Catalog(
       id: "cat-v091",
```

**File**: `swift/core/Tests/A2UICoreTests/VersionAdapterTests.swift` (modified, +56/-0)
```diff
@@ -172,6 +172,62 @@ struct VersionAdapterTests {
     }
   }
 
+  private static let v10CreateSurfaceWithThemeMessage = """
+    {
+      "version": "1.0",
+      "createSurface": {
+        "surfaceId": "s1",
+        "catalogId": "basic",
+        "theme": { "primaryColor": "#FF0000" }
+      }
+    }
+    """
+
+  @Test(
+    arguments: [
+      v10CreateSurfaceWithThemeMessage,
+      "[\(v10CreateSurfaceWithThemeMessage)]",
+      "{ \"messages\": [\(v10CreateSurfaceWithThemeMessage)] }",
+    ]
+  )
+  func v10AdapterDropsCreateSurfaceThemeOnlyWhenUnknownElementsAllowed(
+    rawPayload: String
+  ) throws {
+    let adapter = V10VersionAdapter()
+    let payload = try JSONValue.parse(rawPayload)
+
+    #expect(throws: A2UIValidationError.self) {
+      _ = try adapter.extractOperations(from: payload, allowUnknownElements: false)
+    }
+    let operations = try adapter.extractOperations(from: payload, allowUnknownElements: true)
+    #expect(operations.count == 1)
+    guard case .createSurface(let createOperation) = try #require(operations.first) else {
+      Issue.record("Expected .createSurface operation")
+      return
+    }
+    #expect(createOperation.surfaceID == "s1")
+    #expect(createOperation.catalogID == "basic")
+    #expect(createOperation.theme == nil)
+  }
+
+  @Test func v10AdapterStillRejectsOtherUnknownCreateSurfaceKeysWhenUnknownElementsAllowed()
+    throws
+  {
+    let adapter = V10VersionAdapter()
+    let payload: JSONValue = try .parse(
+      """
+      {
+        "version": "1.0",
+        "createSurface": { "surfaceId": "s1", "catalogId": "basic", "styles": {} }
+      }
+      """
+    )
+    let error = try #require(throws: A2UIValidationError.self) {
+      _ = try adapter.extractOperations(from: payload, allowUnknownElements: true)
+    }
+    #expect(error.message.contains("unrecognized property 'styles'"))
+  }
+
   // MARK: - Action Validation & Cross-Version Action Errors
 
   @Test func crossVersionActionRejectedWithSpecificErrorMessage() throws {
```

**File**: `swift/swiftui/Tests/A2UISwiftUITests/AdapterHarness.swift` (modified, +1/-4)
```diff
@@ -306,10 +306,7 @@ enum AdapterHarness {
 
   /// Reasoned skip entries keyed by `"<case>"` or `"<case>/<op|expectKey>"`.
   @MainActor
-  static let unsupported: [String: String] = [
-    "v10_theme_dropped_in_permissive_mode_renders_like_none":
-      "Theme dropping in permissive mode not yet implemented in A2UICore Swift V10VersionAdapter"
-  ]
+  static let unsupported: [String: String] = [:]
 
   @MainActor private static var matchedUnsupportedKeys: Set<String> = []
   @MainActor private static var completedCasesBySuite: [String: Set<String>] = [:]
```

---

### Incident Patch 2: `b4365c1d` (2026-11-12)
**Commit Message**: a11y(swiftui): announce visible text changes in live regions (#4021)

* a11y(swiftui): announce visible text changes in live regions

A live component announced only its explicit accessibility label, so a
live Text or a live Column/Card banner without a label stayed silent when
its text changed.

Components now report their visible text through A2UIAccessibleTextKey
(.a2uiAccessibleText(_:)). A2UIText reports its text without Markdown
syntax. A live, non-hidden node announces its explicit label if set,
otherwise the joined subtree text, whenever it changes. Hidden subtrees
report no text, and a live region doesn't pass its text to ancestors, so
nested live regions announce once.

Part 1 of #3147.

* a11y(swiftui): report text only inside live regions and keep list numbers

Components now build and report their visible text only inside a live
region, so surfaces without one don't parse Markdown a second time.
Ordered list items keep their numbers in the announced text.

* a11y(swiftui): read an ordered list item's number once

A list item with several paragraphs repeated its number before each one.
Number only the item's first block, as the screen shows it.

* fix(swiftui): make att

**File**: `swift/CHANGELOG.md` (modified, +5/-0)
```diff
@@ -11,6 +11,11 @@
   `A2UIChoicePicker` Dynamic Type scaling, multi-line `TextField(axis: .vertical)` for `longText`
   `A2UITextField`, and SVG path parsing improvements in `SVGPathParser` / `SVGPathShape`).
   [#4023](https://github.com/a2ui-project/a2ui/pull/4023)
+- Announce visible text changes in `live` regions: a live component or container now announces its
+  explicit `label` followed by the text its subtree reports with the new `.a2uiAccessibleText(_:)`
+  modifier (collected through `A2UIAccessibleTextKey`). `A2UIText` reports its text without
+  Markdown syntax, and custom components that render text can call the modifier too.
+  [#4021](https://github.com/a2ui-project/a2ui/pull/4021)
 
 ## 0.10.0
 
```

**File**: `swift/swiftui/README.md` (modified, +12/-5)
```diff
@@ -80,11 +80,17 @@ extra work:
 - `label`: `accessibilityLabel`
 - `description`: `accessibilityHint`
 - `hidden`: `accessibilityHidden` for the whole subtree
-- `live` (`polite` / `assertive`) announces the explicit `label` whenever it changes, for
-  example when it is bound to the data model
+- `live` (`polite` / `assertive`) announces the explicit `label` followed by the visible text
+  inside the component whenever either changes, for example when it is bound to the data model
 
 Only values the agent sets are applied, so SwiftUI keeps inferring labels from visible text.
 
+A live region reads the text that components inside it report. If your component renders text,
+call `.a2uiAccessibleText(text)` with the text as it reads on screen (for example without Markdown
+syntax), before any `.a2uiAccessibilityElement(for:children:)`, so an explicit label on a
+`.combine` element replaces it. The basic catalog's `Text` does this. Outside a live region the
+text is not built.
+
 SwiftUI applies a label set on a stack to every element inside it. If your component's root is a
 stack:
 
@@ -104,9 +110,10 @@ the selected trait. On iOS 17 and macOS 14 and later, the row of tab headers als
 bar trait.
 
 Limitations: SwiftUI drops an accessibility hint on a group, so `description` has no effect on
-layout containers or other `.contain` groups (for example `ChoicePicker`). Announcing changes to
-a live component's visible text, rather than its label, is tracked in
-[#3147](https://github.com/a2ui-project/a2ui/issues/3147).
+layout containers or other `.contain` groups (for example `ChoicePicker`), tracked in
+[#3147](https://github.com/a2ui-project/a2ui/issues/3147). Of the basic catalog components, only
+`Text` reports its visible text to live regions so far. On iOS 17 and macOS 14, changing a bound
+`hidden` value rebuilds the component's subtree, which resets its state.
 
 ---
 
```

**File**: `swift/swiftui/Sources/A2UISwiftUI/A2UIAccessibilityHiddenKey.swift` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+// Copyright 2024 Google LLC
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     https://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+import SwiftUI
+
+/// Environment key that is `true` inside a subtree hidden from assistive technologies, where a
+/// live region announces nothing.
+struct A2UIAccessibilityHiddenKey: EnvironmentKey {
+  static let defaultValue = false
+}
+
+extension EnvironmentValues {
+  /// Whether an ancestor hides this view from assistive technologies with `hidden`.
+  var a2uiAccessibilityHidden: Bool {
+    get { self[A2UIAccessibilityHiddenKey.self] }
+    set { self[A2UIAccessibilityHiddenKey.self] = newValue }
+  }
+}
```

**File**: `swift/swiftui/Sources/A2UISwiftUI/A2UIAccessibilityModifier.swift` (modified, +73/-14)
```diff
@@ -25,9 +25,12 @@ import SwiftUI
 /// - `description` becomes `accessibilityHint`. SwiftUI only keeps a hint on a single
 ///   accessibility element, so it is dropped on layout containers and other groups.
 /// - `hidden` becomes `accessibilityHidden` for the whole subtree.
-/// - `live` (`polite` or `assertive`) posts an announcement of the explicit label whenever it
-///   changes, for example when it is bound to the data model. Announcing changes to a component's
-///   visible text is tracked in https://github.com/a2ui-project/a2ui/issues/3147.
+/// - `live` (`polite` or `assertive`) posts an announcement whenever the region's text changes:
+///   the explicit label if set, followed by the visible text that components in the subtree
+///   report with ``SwiftUI/View/a2uiAccessibleText(_:)``. This works for a live `Text` and for a
+///   live container such as a `Column` or `Card`. A label on a `Text` replaces its visible text,
+///   so it is read once. Nothing is announced while the region or an ancestor is hidden. See
+///   ``A2UIAccessibleTextKey``.
 ///
 /// SwiftUI applies a label set on a stack to every element inside it. A component whose root is
 /// a stack should call ``SwiftUI/View/a2uiAccessibilityControl(for:)`` on its focusable control,
@@ -88,32 +91,88 @@ public struct A2UIAccessibilityModifier: ViewModifier {
     attributes?.live == "assertive"
   }
 
-  /// The text announced when it changes: the explicit label of a live component. `nil` when
-  /// nothing is announced.
+  /// The text announced when it changes, for a component whose subtree reports no visible
+  /// text. Same as ``announcementText(subtreeText:)`` with no text.
   public var announcementText: String? {
+    announcementText(subtreeText: [])
+  }
+
+  /// The text announced when it changes: the explicit label of a live component followed by
+  /// the visible text its subtree reports through ``A2UIAccessibleTextKey``, one entry per line.
+  /// `nil` when nothing is announced.
+  public func announcementText(subtreeText: [String]) -> String? {
     guard isLiveRegion, !isHidden else { return nil }
-    return label
+    let parts = ([label].compactMap { $0 } + subtreeText).filter { !$0.isEmpty }
+    return parts.isEmpty ? nil : parts.joined(separator: "\n")
   }
 
   public func body(content: Content) -> some View {
-    hidden(
-      content
-        .a2uiOptionalAccessibilityIdentifier(appliesAccessibilityIdentifier ? identifier : nil)
-        .a2uiOptionalAccessibilityLabel(appliesLabelAndHint ? label : nil)
-        .a2uiOptionalAccessibilityHint(appliesLabelAndHint ? hint : nil)
+    liveRegion(
+      hidden(
+        labelText(
+          content
+            .a2uiOptionalAccessibilityIdentifier(appliesAccessibilityIdentifier ? identifier : nil)
+            .a2uiOptionalAccessibilityLabel(appliesLabelAndHint ? label : nil)
+            .a2uiOptionalAccessibilityHint(appliesLabelAndHint ? hint : nil)
+        )
+      )
     )
-    .modifier(AnnouncementTrigger(text: announcementText, assertive: isAssertive))
   }
 
-  @ViewBuilder
+  /// Reports the explicit label of a component inside a live region, ahead of its subtree text,
+  /// so the region reads it too. A live component announces its own label instead.
+  private func labelText<V: View>(_ view: V) -> some View {
+    view.a2uiAccessibleText(isLiveRegion ? nil : label)
+  }
+
+  /// Hides the view and its subtree from assistive technologies when `hidden` is set.
+  ///
+  /// `hidden` can be bound to the data model. On iOS 18 and macOS 15 and later the view tree is
+  /// the same either way, so changing it keeps the component's state. The live region trigger
+  /// sits outside this modifier, so it stays mounted on every version.
   private func hidden<V: View>(_ view: V) -> some View {
-    if isHidden {
+    let isHidden = isHidden
+    return
+      accessibilityHiddenIfNeeded(view, isHidden: isHidden)
+      // Text that assistive technologies can't reach is not announced by a live ancestor.
+      .transformPreference(A2UIAccessibleTextKey.self) { text in
+        if isHidden { text = [] }
+      }
+      .transformEnvironment(\.a2uiInLiveRegion) { isInLiveRegion in
+        if isHidden { isInLiveRegion = false }
+      }
+      .transformEnvironment(\.a2uiAccessibilityHidden) { isAncestorHidden in
+        if isHidden { isAncestorHidden = true }
+      }
+  }
+
+  /// Applies `accessibilityHidden(true)` only when the component is hidden. An outer
+  /// `accessibilityHidden(false)` would expose descendants that hide themselves, such as a
+  /// `hidden` child of a `Column` or the title `Text` of a `TextField`.
+  @ViewBuilder
+  private func accessibilityHiddenIfNeeded<V: View>(_ view: V, isHidden: Bool) -> some View {
+    if #available(iOS 18, macOS 15, tvOS 18, watchOS 11, visionOS 2, *) {
+      // With `isEnabled: false` the modifier does nothing, and the view tree doesn't change.
+      view.accessibilityHidden(true, isEnabled: isHidd
```

**File**: `swift/swiftui/Sources/A2UISwiftUI/A2UIAccessibleTextKey.swift` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+// Copyright 2024 Google LLC
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     https://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+import SwiftUI
+
+/// Collects the visible text that components report with
+/// ``SwiftUI/View/a2uiAccessibleText(_:)``, in tree order.
+///
+/// ``A2UIAccessibilityModifier`` reads this key on a live region (`live` is `polite` or
+/// `assertive`) and announces the joined text when it changes, so a live `Text` and a live
+/// container such as a `Column` or `Card` both announce their updates without the adapter
+/// knowing any catalog property names. A hidden subtree reports no text, and a live region
+/// reports none to its ancestors, so an update is announced once, by the nearest live region.
+/// Components report text only inside a live region, so the rest of a surface does no extra work.
+public struct A2UIAccessibleTextKey: PreferenceKey {
+  public static let defaultValue: [String] = []
+
+  public static func reduce(value: inout [String], nextValue: () -> [String]) {
+    value.append(contentsOf: nextValue())
+  }
+}
```

**File**: `swift/swiftui/Sources/A2UISwiftUI/A2UIAccessibleTextReporter.swift` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+// Copyright 2024 Google LLC
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     https://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+import SwiftUI
+
+/// Reports a view's text through ``A2UIAccessibleTextKey`` when the view is inside a live
+/// region, ahead of any text its subtree reports. Outside one, the text is never evaluated.
+struct A2UIAccessibleTextReporter: ViewModifier {
+  @Environment(\.a2uiInLiveRegion) private var isInLiveRegion
+
+  let text: () -> String?
+
+  func body(content: Content) -> some View {
+    let reportedText = reportedText
+    return content.transformPreference(A2UIAccessibleTextKey.self) { subtreeText in
+      subtreeText.insert(contentsOf: reportedText, at: 0)
+    }
+  }
+
+  private var reportedText: [String] {
+    guard isInLiveRegion, let text = text(), !text.isEmpty else { return [] }
+    return [text]
+  }
+}
```

**File**: `swift/swiftui/Sources/A2UISwiftUI/A2UIAnnouncer.swift` (added, +36/-0)
```diff
@@ -0,0 +1,36 @@
+// Copyright 2024 Google LLC
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     https://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+import SwiftUI
+
+/// Posts the announcements of live regions (`live` is `polite` or `assertive`).
+///
+/// The default posts an `AccessibilityNotification.Announcement`. Tests replace it through the
+/// `a2uiAnnouncer` environment value to observe what a live region announces.
+@_spi(Testing)
+public struct A2UIAnnouncer: Sendable {
+  /// Posts `text`. `isAssertive` is `true` when the announcement interrupts current speech.
+  public let announce: @MainActor @Sendable (_ text: String, _ isAssertive: Bool) -> Void
+
+  public init(
+    announce: @escaping @MainActor @Sendable (_ text: String, _ isAssertive: Bool) -> Void
+  ) {
+    self.announce = announce
+  }
+
+  /// Posts an `AccessibilityNotification.Announcement`, with high priority when assertive.
+  public static let accessibilityNotification = A2UIAnnouncer { text, isAssertive in
+    A2UIAccessibilityModifier.announce(text, assertive: isAssertive)
+  }
+}
```

**File**: `swift/swiftui/Sources/A2UISwiftUI/A2UIAnnouncerKey.swift` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+// Copyright 2024 Google LLC
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     https://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+import SwiftUI
+
+/// Environment key for the ``A2UIAnnouncer`` that live regions post their announcements with.
+struct A2UIAnnouncerKey: EnvironmentKey {
+  static let defaultValue = A2UIAnnouncer.accessibilityNotification
+}
+
+extension EnvironmentValues {
+  /// Posts the announcements of live regions. Set it to observe them in tests.
+  @_spi(Testing)
+  public var a2uiAnnouncer: A2UIAnnouncer {
+    get { self[A2UIAnnouncerKey.self] }
+    set { self[A2UIAnnouncerKey.self] = newValue }
+  }
+}
```

---

### Incident Patch 3: `dada9a12` (2026-11-11)
**Commit Message**: refactor(swift): adopt iOS 17+ SwiftUI idioms, split multi-type files, and cache SVG paths (#4023)

* refactor(swift): adopt iOS 17+ SwiftUI idioms, split multi-type files, and cache SVG paths

- Replace EnvironmentKey boilerplate with @Entry in A2UIThemeKey, A2UICatalogsKey, and A2UISurfaceMetadataKey
- Replace multiline TextEditor + manual placeholder inset hack in A2UITextField with native TextField(..., axis: .vertical) and .lineLimit(3...8)
- Split MarkdownBlockView out of A2UIText and use positional enumeration so identical Markdown blocks do not collide in ForEach
- Split SVGPathShape and SVGPathParser out of A2UIIcon, cache parsed Path in SVGPathShape.init, and use @ScaledMetric for Dynamic Type icon scaling
- Split FlowLayout out of A2UIChoicePicker, remove dead type cast, and add 44pt minimum tap height + .contentShape(.rect) on checkbox rows
- Remove redundant iOS 17 availability check in A2UITabs, adopt .scrollIndicators(_:) in A2UITabs and A2UIList, and replace deprecated .cornerRadius(_:) with .clipShape(.rect(cornerRadius:)) in InspectorPanes

Signed-off-by: Peter Friese <[REDACTED_EMAIL]>

* fix(swift): address review feedback on environment keys, layout, Markdown, 

**File**: `swift/CHANGELOG.md` (modified, +6/-0)
```diff
@@ -5,6 +5,12 @@
 - Report the component definition ID rather than the synthesized `:index` instance ID as
   `sourceComponentID` on actions dispatched from template-expanded components.
   [#4043](https://github.com/a2ui-project/a2ui/pull/4043)
+- Deprecate `A2UICatalogsKey`, `A2UIDefaultCatalogIDKey`, and `A2UIThemeKey` in `A2UISwiftUI` in
+  favor of `EnvironmentValues.a2uiCatalogs`, `EnvironmentValues.a2uiDefaultCatalogID`, and
+  `EnvironmentValues.a2uiTheme`, and update `BasicCatalogSwiftUI` components (`A2UIIcon` and
+  `A2UIChoicePicker` Dynamic Type scaling, multi-line `TextField(axis: .vertical)` for `longText`
+  `A2UITextField`, and SVG path parsing improvements in `SVGPathParser` / `SVGPathShape`).
+  [#4023](https://github.com/a2ui-project/a2ui/pull/4023)
 
 ## 0.10.0
 
```

**File**: `swift/sample/Sources/A2UISampleClient/Views/InspectorPanes.swift` (modified, +2/-2)
```diff
@@ -61,7 +61,7 @@ public struct MessageStreamPane: View {
                 index == currentStepIndex
                   ? Color.blue.opacity(0.1) : Color(.secondarySystemBackground)
               )
-              .cornerRadius(6)
+              .clipShape(.rect(cornerRadius: 6))
               .overlay(
                 RoundedRectangle(cornerRadius: 6)
                   .stroke(index == currentStepIndex ? Color.blue : Color.clear, lineWidth: 1.5)
@@ -108,7 +108,7 @@ public struct DataModelPane: View {
           .frame(maxWidth: .infinity, alignment: .leading)
           .padding(12)
           .background(Color(.secondarySystemBackground))
-          .cornerRadius(8)
+          .clipShape(.rect(cornerRadius: 8))
           .padding(.horizontal, 16)
 
         Spacer()
```

**File**: `swift/swiftui/Sources/A2UISwiftUI/A2UICatalogsKey.swift` (modified, +6/-12)
```diff
@@ -15,28 +15,22 @@
 import A2UICore
 import SwiftUI
 
-/// Environment key for propagating the active component catalogs through
-/// the SwiftUI view hierarchy.
+/// Environment key storing the active A2UI component catalogs for SwiftUI rendering.
+@available(*, deprecated, message: "Use EnvironmentValues.a2uiCatalogs instead.")
 public struct A2UICatalogsKey: EnvironmentKey {
   public static let defaultValue: [String: Catalog<ComponentImplementation>] = [:]
 }
 
-/// Environment key for propagating the default catalog ID through
-/// the SwiftUI view hierarchy.
+/// Environment key storing the default catalog ID used for unqualified component lookups.
+@available(*, deprecated, message: "Use EnvironmentValues.a2uiDefaultCatalogID instead.")
 public struct A2UIDefaultCatalogIDKey: EnvironmentKey {
   public static let defaultValue: String? = nil
 }
 
 extension EnvironmentValues {
   /// The active A2UI component catalogs for SwiftUI rendering.
-  public var a2uiCatalogs: [String: Catalog<ComponentImplementation>] {
-    get { self[A2UICatalogsKey.self] }
-    set { self[A2UICatalogsKey.self] = newValue }
-  }
+  @Entry public var a2uiCatalogs: [String: Catalog<ComponentImplementation>] = [:]
 
   /// The default catalog ID used for unqualified component lookups.
-  public var a2uiDefaultCatalogID: String? {
-    get { self[A2UIDefaultCatalogIDKey.self] }
-    set { self[A2UIDefaultCatalogIDKey.self] = newValue }
-  }
+  @Entry public var a2uiDefaultCatalogID: String? = nil
 }
```

**File**: `swift/swiftui/Sources/A2UISwiftUI/A2UISurfaceMetadataKey.swift` (modified, +1/-8)
```diff
@@ -15,14 +15,7 @@
 import OrderedJSON
 import SwiftUI
 
-struct A2UISurfaceMetadataKey: EnvironmentKey {
-  static let defaultValue: [String: JSONValue]? = nil
-}
-
 extension EnvironmentValues {
   /// The A2UI surface metadata dictionary injected by ``Surface``.
-  public var a2uiSurfaceMetadata: [String: JSONValue]? {
-    get { self[A2UISurfaceMetadataKey.self] }
-    set { self[A2UISurfaceMetadataKey.self] = newValue }
-  }
+  @Entry public var a2uiSurfaceMetadata: [String: JSONValue]? = nil
 }
```

**File**: `swift/swiftui/Sources/A2UISwiftUI/A2UIThemeKey.swift` (modified, +3/-7)
```diff
@@ -12,20 +12,16 @@
 // See the License for the specific language governing permissions and
 // limitations under the License.
 
-import A2UICore
 import OrderedJSON
 import SwiftUI
 
-/// Environment key for propagating the active surface theme through
-/// the SwiftUI view hierarchy.
+/// Environment key storing the active A2UI surface theme.
+@available(*, deprecated, message: "Use EnvironmentValues.a2uiTheme instead.")
 public struct A2UIThemeKey: EnvironmentKey {
   public static let defaultValue: [String: JSONValue]? = nil
 }
 
 extension EnvironmentValues {
   /// The active A2UI surface theme, if any.
-  public var a2uiTheme: [String: JSONValue]? {
-    get { self[A2UIThemeKey.self] }
-    set { self[A2UIThemeKey.self] = newValue }
-  }
+  @Entry public var a2uiTheme: [String: JSONValue]? = nil
 }
```

**File**: `swift/swiftui/Sources/BasicCatalog/A2UIChoicePicker.swift` (modified, +4/-67)
```diff
@@ -29,58 +29,7 @@ extension BasicCatalogImplementation {
   }
 }
 
-// MARK: - Layout
-
-/// A custom SwiftUI layout arranging child views in wrapping horizontal rows.
-struct FlowLayout: Layout {
-  var spacing: CGFloat = 8
-  var lineSpacing: CGFloat = 8
-
-  func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
-    guard !subviews.isEmpty else { return .zero }
-    let maxWidth = proposal.width ?? .infinity
-    var currentX: CGFloat = 0
-    var currentY: CGFloat = 0
-    var lineHeight: CGFloat = 0
-    var maxLineWidth: CGFloat = 0
-
-    for subview in subviews {
-      let size = subview.sizeThatFits(.unspecified)
-      if currentX + size.width > maxWidth && currentX > 0 {
-        maxLineWidth = max(maxLineWidth, currentX - spacing)
-        currentX = 0
-        currentY += lineHeight + lineSpacing
-        lineHeight = 0
-      }
-      currentX += size.width + spacing
-      lineHeight = max(lineHeight, size.height)
-    }
-    maxLineWidth = max(maxLineWidth, currentX > 0 ? currentX - spacing : 0)
-
-    return CGSize(width: maxLineWidth, height: currentY + lineHeight)
-  }
-
-  func placeSubviews(
-    in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()
-  ) {
-    guard !subviews.isEmpty else { return }
-    var currentX: CGFloat = bounds.minX
-    var currentY: CGFloat = bounds.minY
-    var lineHeight: CGFloat = 0
-
-    for subview in subviews {
-      let size = subview.sizeThatFits(.unspecified)
-      if currentX + size.width > bounds.maxX && currentX > bounds.minX {
-        currentX = bounds.minX
-        currentY += lineHeight + lineSpacing
-        lineHeight = 0
-      }
-      subview.place(at: CGPoint(x: currentX, y: currentY), proposal: ProposedViewSize(size))
-      currentX += size.width + spacing
-      lineHeight = max(lineHeight, size.height)
-    }
-  }
-}
+// MARK: - View
 
 /// SwiftUI component view for the A2UI Basic Catalog `ChoicePicker` selection component.
 public struct A2UIChoicePicker: View {
@@ -137,20 +86,6 @@ public struct A2UIChoicePicker: View {
       }
     }
 
-    if let rawArray = node.properties["options"] as? [Any] {
-      return rawArray.enumerated().compactMap { index, element in
-        if let str = element as? String {
-          return OptionItem(id: str, label: str, value: str)
-        }
-        if let dict = element as? [String: Any] {
-          let label = (dict["label"] as? String) ?? "Option \(index + 1)"
-          let value = (dict["value"] as? String) ?? "\(index)"
-          return OptionItem(id: value, label: label, value: value)
-        }
-        return nil
-      }
-    }
-
     if let json = node.jsonValue(for: "options"), let array = json.arrayValue {
       return array.enumerated().map { index, item in
         if let str = item.stringValue {
@@ -247,7 +182,7 @@ public struct A2UIChoicePicker: View {
         }
         .padding(8)
         .background(Color.gray.opacity(0.12))
-        .cornerRadius(8)
+        .clipShape(.rect(cornerRadius: 8))
         .accessibilityIdentifier("A2UIChoicePicker_Search_\(node.id)")
       }
 
@@ -314,6 +249,8 @@ public struct A2UIChoicePicker: View {
             Spacer()
           }
           .padding(.vertical, 4)
+          .frame(minHeight: 44)
+          .contentShape(.rect)
         }
         .buttonStyle(.plain)
         .a2uiOptionAccessibility(
```

**File**: `swift/swiftui/Sources/BasicCatalog/A2UIIcon.swift` (modified, +9/-243)
```diff
@@ -15,6 +15,7 @@
 import A2UICore
 import A2UISwiftUI
 import BasicCatalog
+import Foundation
 import OrderedJSON
 import SwiftUI
 
@@ -29,232 +30,13 @@ extension BasicCatalogImplementation {
 
 // MARK: - View
 
-/// A SwiftUI shape rendering an SVG path `d` attribute data string.
-public struct SVGPathShape: Shape {
-  public let pathData: String
-
-  public init(pathData: String) {
-    self.pathData = pathData
-  }
-
-  public func path(in rect: CGRect) -> Path {
-    let rawPath = SVGPathParser.parse(pathData)
-    let boundingBox = rawPath.boundingRect
-    guard boundingBox.width > 0, boundingBox.height > 0 else {
-      return rawPath
-    }
-
-    let contentWidth = max(boundingBox.width, boundingBox.maxX)
-    let contentHeight = max(boundingBox.height, boundingBox.maxY)
-    let refSize = max(max(contentWidth, contentHeight), 24.0)
-
-    let scale = min(rect.width / refSize, rect.height / refSize)
-
-    var transform = CGAffineTransform.identity
-    let scaledWidth = boundingBox.width * scale
-    let scaledHeight = boundingBox.height * scale
-    let offsetX = rect.minX + (rect.width - scaledWidth) / 2.0 - (boundingBox.minX * scale)
-    let offsetY = rect.minY + (rect.height - scaledHeight) / 2.0 - (boundingBox.minY * scale)
-
-    transform = transform.translatedBy(x: offsetX, y: offsetY)
-    transform = transform.scaledBy(x: scale, y: scale)
-
-    return rawPath.applying(transform)
-  }
-}
-
-/// Lightweight parser converting SVG path data strings into SwiftUI `Path` instances.
-public enum SVGPathParser {
-  public static func parse(_ d: String) -> Path {
-    var path = Path()
-    var currentPoint: CGPoint = .zero
-    var startPoint: CGPoint = .zero
-    var lastControlPoint: CGPoint? = nil
-
-    let tokens = tokenize(d)
-    var index = 0
-
-    func nextNumber() -> CGFloat? {
-      guard index < tokens.count else { return nil }
-      if case .number(let val) = tokens[index] {
-        index += 1
-        return CGFloat(val)
-      }
-      return nil
-    }
-
-    func nextPoint(relative: Bool) -> CGPoint? {
-      guard let x = nextNumber(), let y = nextNumber() else { return nil }
-      return relative ? CGPoint(x: currentPoint.x + x, y: currentPoint.y + y) : CGPoint(x: x, y: y)
-    }
-
-    while index < tokens.count {
-      guard case .command(let cmd) = tokens[index] else {
-        index += 1
-        continue
-      }
-      index += 1
-
-      switch cmd {
-      case "M", "m":
-        let isRel = (cmd == "m")
-        if let pt = nextPoint(relative: isRel) {
-          currentPoint = pt
-          startPoint = pt
-          path.move(to: pt)
-          lastControlPoint = nil
-          while let nextPt = nextPoint(relative: isRel) {
-            currentPoint = nextPt
-            path.addLine(to: nextPt)
-          }
-        }
-
-      case "L", "l":
-        let isRel = (cmd == "l")
-        while let pt = nextPoint(relative: isRel) {
-          currentPoint = pt
-          path.addLine(to: pt)
-          lastControlPoint = nil
-        }
-
-      case "H", "h":
-        let isRel = (cmd == "h")
-        while let x = nextNumber() {
-          let targetX = isRel ? currentPoint.x + x : x
-          currentPoint = CGPoint(x: targetX, y: currentPoint.y)
-          path.addLine(to: currentPoint)
-          lastControlPoint = nil
-        }
-
-      case "V", "v":
-        let isRel = (cmd == "v")
-        while let y = nextNumber() {
-          let targetY = isRel ? currentPoint.y + y : y
-          currentPoint = CGPoint(x: currentPoint.x, y: targetY)
-          path.addLine(to: currentPoint)
-          lastControlPoint = nil
-        }
-
-      case "C", "c":
-        let isRel = (cmd == "c")
-        while let cp1 = nextPoint(relative: isRel),
-          let cp2 = nextPoint(relative: isRel),
-          let endPt = nextPoint(relative: isRel)
-        {
-          path.addCurve(to: endPt, control1: cp1, control2: cp2)
-          lastControlPoint = cp2
-          currentPoint = endPt
-        }
-
-      case "S", "s":
-        let isRel = (cmd == "s")
-        while let cp2 = nextPoint(relative: isRel),
-          let endPt = nextPoint(relative: isRel)
-        {
-          let cp1: CGPoint
-          if let last = lastControlPoint {
-            cp1 = CGPoint(x: 2 * currentPoint.x - last.x, y: 2 * currentPoint.y - last.y)
-          } else {
-            cp1 = currentPoint
-          }
-          path.addCurve(to: endPt, control1: cp1, control2: cp2)
-          lastControlPoint = cp2
-          currentPoint = endPt
-        }
-
-      case "Q", "q":
-        let isRel = (cmd == "q")
-        while let cp = nextPoint(relative: isRel),
-          let endPt = nextPoint(relative: isRel)
-        {
-          path.addQuadCurve(to: endPt, control: cp)
-          lastControlPoint = cp
-          currentPoint = endPt
-        }
-
-      case "T", "t":
-        let isRel = (cmd == "t")
-        while let endPt = nextPoint(relative: isRel) {
-          let cp: CGPoint
-     
```

**File**: `swift/swiftui/Sources/BasicCatalog/A2UIList.swift` (modified, +4/-2)
```diff
@@ -51,7 +51,7 @@ public struct A2UIList: View {
 
   public var body: some View {
     if direction == "horizontal" {
-      ScrollView(.horizontal, showsIndicators: false) {
+      ScrollView(.horizontal) {
         LazyHStack(alignment: verticalAlignment, spacing: 12) {
           ForEach(children) { childNode in
             ComponentNodeView(node: childNode)
@@ -62,9 +62,10 @@ public struct A2UIList: View {
         }
         .padding(.horizontal, 4)
       }
+      .scrollIndicators(.hidden, axes: .horizontal)
       .a2uiAccessibilityElement(for: node, children: .contain)
     } else {
-      ScrollView(.vertical, showsIndicators: true) {
+      ScrollView(.vertical) {
         LazyVStack(alignment: horizontalAlignment, spacing: 8) {
           ForEach(children) { childNode in
             ComponentNodeView(node: childNode)
@@ -74,6 +75,7 @@ public struct A2UIList: View {
         }
         .padding(.vertical, 4)
       }
+      .scrollIndicators(.automatic, axes: .vertical)
       .frame(maxWidth: align == "stretch" ? .infinity : nil)
       .a2uiAccessibilityElement(for: node, children: .contain)
     }
```

#### Recent Merged Pull Requests:
- **PR #4218** (2026-11-13): docs(site): update L+R Alder copy and walkthrough video on Get Help page (@abdallahshaban557)
- **PR #4213** (2026-11-13): docs: remove docs/public and MkDocs scaffolding (#4209) (@ditman)
- **PR #4212** (2026-11-13): docs: retarget workflows, context7, and repo links away from docs/public (#4209) (@ditman)
- **PR #4211** (2026-11-13): docs: move active assets and CNAME out of docs/public (#4209) (@ditman)
- **PR #4198** (2026-11-12): fix(samples): combine VegaChart and basic components into single v0.9 catalog (@josemontespg)
- **PR #4182** (2026-11-12): Fix/renderers decouple v09 and universal imports (@ditman)

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

## X. swift/core): drop theme from a v1.0 createSurface in relaxed mode (#4099)

**RULE**:
When implementing operations in `swift/core/Sources/A2UICore/Processing/Adapters/BaseVersionAdapter.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in a2ui-project/a2ui. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0d2fcf37`: swift/core): drop theme from a v1.0 createSurface in relaxed mode (#4099). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `swift/core/Sources/A2UICore/Processing/Adapters/BaseVersionAdapter.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
    try extractOperations(from: payload, allowUnknownElements: false)
  }

  /// Validates the payload as ``extractOperations(from:)`` does, passing `allowUnknownElements`
  /// to ``preparePayloadForValidation(_:action:allowUnknownElements:)`` for each message.
  open func extractOperations(
    from payload: JSONValue,
    allowUnknownElements: Bool
  ) throws -> [InternalOperation] {
      return try extractOperationsFromArray(items, allowUnknownElements: allowUnknownElements)
    case .object(let messageObject):
      if let messages = messageObject["messages"]?.arrayValue {
        return try extractOperationsFromArray(
          messages,
          allowUnknownElements: allowUnknownElements
        )
      return try extractOperationsFromSingleMessageObject(
        messageObject,
        allowUnknownElements: allowUnknownElements
      )
  /// Lets subclasses normalize a single message before validation, such as dropping properties
  /// that relaxed renderers ignore. The default returns `message` unchanged.
  open func preparePayloadForValidation(
    _ message: OrderedDictionary<String, JSONValue>,
    action: String,
    allowUnknownElements: Bool
  ) -> OrderedDictionary
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
      return try extractOperationsFromArray(items)
    case .object(let dict):
      if let messages = dict["messages"]?.arrayValue {
        return try extractOperationsFromArray(messages)
      return try extractOperationsFromSingleMessageObject(dict)
    _ items: [JSONValue]
        return try extractOperations(from: item)
    _ dict: OrderedDictionary<String, JSONValue>
    let action = try extractSingleAction(from: dict)
    let ops = try extractOperations(from: jsonValue)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0d2fcf37` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
