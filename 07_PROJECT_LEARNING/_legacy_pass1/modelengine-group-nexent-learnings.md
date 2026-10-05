# Forensic Learning Record (Deep Inspection): ModelEngine-Group/nexent

> **Canonical Artifact**: `07_PROJECT_LEARNING/modelengine-group-nexent-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ModelEngine-Group/nexent](https://github.com/ModelEngine-Group/nexent))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:15:50.696Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ModelEngine-Group/nexent`
- **Description**: Nexent is a zero-code platform for auto-generating production-grade AI agents using Harness Engineering principles — unified tools, skills, memory, and orchestration with built-in constraints, feedback loops, and control planes.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 5900 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.claude/skills/skill-creator/scripts/init_skill.py`
```
#!/usr/bin/env python3
"""
Skill Initializer - Creates a new skill from template

Usage:
    init_skill.py <skill-name> --path <path>

Examples:
    init_skill.py my-new-skill --path skills/public
    init_skill.py my-api-helper --path skills/private
    init_skill.py custom-skill --path /custom/location
"""

import sys
from pathlib import Path


SKILL_TEMPLATE = """---
name: {skill_name}
description: [TODO: Complete and informative explanation of what the skill does and when to use it. Include WHEN to use this skill - specific scenarios, file types, or tasks that trigger it.]
---

# {skill_title}

## Overview

[TODO: 1-2 sentences explaining what this skill enables]

## Structuring This Skill

[TODO: Choose the structure that best fits this skill's purpose. Common patterns:

**1. Workflow-Based** (best for sequential processes)
- Works well when there are clear step-by-step procedures
- Example: DOCX skill with "Workflow Decision Tree" → "Reading" → "Creating" → "Editing"
- Structure: ## Overview → ## Workflow Decision Tree → ## Step 1 → ## Step 2...

**2. Task-Based** (best for tool collections)
- Works well when the skill offers different operations/capabilities
- Example: PDF skill with "Quick Start" → "Merge PDFs" → "Split PDFs" → "Extract Text"
- Structure: ## Overview → ## Quick Start → ## Task Category 1 → ## Task Category 2...

**3. Reference/Guidelines** (best for standards or specifications)
- Works well for brand guidelines, coding standards, or requirements
- Example: Brand styling with "Brand Guidelines" → "Colors" → "Typography" → "Features"
- Structure: ## Overview → ## Guidelines → ## Specifications → ## Usage...

**4. Capabilities-Based** (best for integrated systems)
- Works well when the skill provides multiple interrelated features
- Example: Product Management with "Core Capabilities" → numbered capability list
- Structure: ## Overview → ## Core Capabilities → ### 1. Feature → ### 2. Feature...

Patterns can be mixed and matched as needed. Most skills combine patterns (e.g., start with task-based, add workflow for complex operations).

Delete this entire "Structuring This Skill" section when done - it's just guidance.]

## [TODO: Replace with the first main section based on chosen structure]

[TODO: Add content here. See examples in existing skills:
- Code samples for technical skills
- Decision trees for complex workflows
- Concrete examples with realistic user requests
- References to scripts/templates/references as needed]

## Resources

This skill includes example resource directories that demonstrate how to organize different types of bundled resources:

### scripts/
Executable code (Python/Bash/etc.) that can be run directly to perform specific operations.

**Examples from other skills:**
- PDF skill: `fill_fillable_fields.py`, `extract_form_field_info.py` - utilities for PDF manipulation
- DOCX skill: `document.py`, `utilities.py` - Python modules for document processing

**Appropriate for:** Python scripts, shell scripts, or any executable code that performs automation, data processing, or specific operations.

**Note:** Scripts may be executed without loading into context, but can still be read by Claude for patching or environment adjustments.

### references/
Documentation and reference material intended to be loaded into context to inform Claude's process and thinking.

**Examples from other skills:**
- Product management: `communication.md`, `context_building.md` - detailed workflow guides
- BigQuery: API reference documentation and query examples
- Finance: Schema documentation, company policies

**Appropriate for:** In-depth documentation, API references, database schemas, comprehensive guides, or any detailed information that Claude should reference while working.

### assets/
Files not intended to be loaded into context, but rather used within the output Claude produces.

**Examples from other skills:**
- Brand styling: PowerPoint template files (.pptx), logo files
- Frontend builder: HTML/React boilerplate project directories
- Typography: Font files (.ttf, .woff2)

**Appropriate for:** Templates, boilerplate code, document templates, images, icons, fonts, or any files meant to be copied or used in the final output.

---

**Any unneeded directories can be deleted.** Not every skill requires all three types of resources.
"""

EXAMPLE_SCRIPT = '''#!/usr/bin/env python3
"""
Example helper script for {skill_name}

This is a placeholder script that can be executed directly.
Replace with actual implementation or delete if not needed.

Example real scripts from other skills:
- pdf/scripts/fill_fillable_fields.py - Fills PDF form fields
- pdf/scripts/convert_pdf_to_images.py - Converts PDF pages to images
"""

def main():
    print("This is an example script for {skill_name}")
    # TODO: Add actual script logic here
    # This could be data processing, file conversion, API calls, etc.

if __name__ == "__main__":
    main()
'''

EXAMPLE_REFERENCE = """# Reference Documentation for {skill_title}

This is a placeholder for detailed reference documentation.
Replace with actual reference content or delete if not needed.

Example real reference docs from other skills:
- product-management/references/communication.md - Comprehensive guide for status updates
- product-management/references/context_building.md - Deep-dive on gathering context
- bigquery/references/ - API references and query examples

## When Reference Docs Are Useful

Reference docs are ideal for:
- Comprehensive API documentation
- Detailed workflow guides
- Complex multi-step processes
- Information too lengthy for main SKILL.md
- Content that's only needed for specific use cases

## Structure Suggestions

### API Reference Example
- Overview
- Authentication
- Endpoints with examples
- Error codes
- Rate limits

### Workflow Guide Example
- Prerequisites
- Step-by-step instructions
- Common patterns
- Troubleshooting
- Best practices
"""

EXAMPLE_ASSET = """# Example Asset File

This placeholder represents where asset files would be stored.
Replace with actual asset files (templates, images, fonts, etc.) or delete if not needed.

Asset files are NOT intended to be loaded into context, but rather used within
the output Claude produces.

Example asset files from other skills:
- Brand guidelines: logo.png, slides_template.pptx
- Frontend builder: hello-world/ directory with HTML/React boilerplate
- Typography: custom-font.ttf, font-family.woff2
- Data: sample_data.csv, test_dataset.json

## Common Asset Types

- Templates: .pptx, .docx, boilerplate directories
- Images: .png, .jpg, .svg, .gif
- Fonts: .ttf, .otf, .woff, .woff2
- Boilerplate code: Project directories, starter files
- Icons: .ico, .svg
- Data files: .csv, .json, .xml, .yaml

Note: This is a text placeholder. Actual assets can be any file type.
"""


def title_case_skill_name(skill_name):
    """Convert hyphenated skill name to Title Case for display."""
    return ' '.join(word.capitalize() for word in skill_name.split('-'))


def init_skill(skill_name, path):
    """
    Initialize a new skill directory with template SKILL.md.

    Args:
        skill_name: Name of the skill
        path: Path where the skill directory should be created

    Returns:
        Path to created skill directory, or None if error
    """
    # Determine skill directory path
    skill_dir = Path(path).resolve() / skill_name

    # Check if directory already exists
    if skill_dir.exists():
        print(f"❌ Error: Skill directory already exists: {skill_dir}")
        return None

    # Create skill directory
    try:
        skill_dir.mkdir(parents=True, exist_ok=False)
        print(f"✅ Created skill directory: {skill_dir}")
    except Exception as e:
        print(f"❌ Error creating directory: {e}")
        return None

    # Create SKILL.md from template
    skill_title = title_case_skill_name(skill_name)
    skill_content = SKILL_TEMPLATE.format(
        skill_name=skill_name,
        skill_title=skill_title
 
```

### Core Architecture Module: `.claude/skills/skill-creator/scripts/package_skill.py`
```
#!/usr/bin/env python3
"""
Skill Packager - Creates a distributable .skill file of a skill folder

Usage:
    python utils/package_skill.py <path/to/skill-folder> [output-directory]

Example:
    python utils/package_skill.py skills/public/my-skill
    python utils/package_skill.py skills/public/my-skill ./dist
"""

import sys
import zipfile
from pathlib import Path
from quick_validate import validate_skill


def package_skill(skill_path, output_dir=None):
    """
    Package a skill folder into a .skill file.

    Args:
        skill_path: Path to the skill folder
        output_dir: Optional output directory for the .skill file (defaults to current directory)

    Returns:
        Path to the created .skill file, or None if error
    """
    skill_path = Path(skill_path).resolve()

    # Validate skill folder exists
    if not skill_path.exists():
        print(f"❌ Error: Skill folder not found: {skill_path}")
        return None

    if not skill_path.is_dir():
        print(f"❌ Error: Path is not a directory: {skill_path}")
        return None

    # Validate SKILL.md exists
    skill_md = skill_path / "SKILL.md"
    if not skill_md.exists():
        print(f"❌ Error: SKILL.md not found in {skill_path}")
        return None

    # Run validation before packaging
    print("🔍 Validating skill...")
    valid, message = validate_skill(skill_path)
    if not valid:
        print(f"❌ Validation failed: {message}")
        print("   Please fix the validation errors before packaging.")
        return None
    print(f"✅ {message}\n")

    # Determine output location
    skill_name = skill_path.name
    if output_dir:
        output_path = Path(output_dir).resolve()
        output_path.mkdir(parents=True, exist_ok=True)
    else:
        output_path = Path.cwd()

    skill_filename = output_path / f"{skill_name}.skill"

    # Create the .skill file (zip format)
    try:
        with zipfile.ZipFile(skill_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
            # Walk through the skill directory
            for file_path in skill_path.rglob('*'):
                if file_path.is_file():
                    # Calculate the relative path within the zip
                    arcname = file_path.relative_to(skill_path.parent)
                    zipf.write(file_path, arcname)
                    print(f"  Added: {arcname}")

        print(f"\n✅ Successfully packaged skill to: {skill_filename}")
        return skill_filename

    except Exception as e:
        print(f"❌ Error creating .skill file: {e}")
        return None


def main():
    if len(sys.argv) < 2:
        print("Usage: python utils/package_skill.py <path/to/skill-folder> [output-directory]")
        print("\nExample:")
        print("  python utils/package_skill.py skills/public/my-skill")
        print("  python utils/package_skill.py skills/public/my-skill ./dist")
        sys.exit(1)

    skill_path = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else None

    print(f"📦 Packaging skill: {skill_path}")
    if output_dir:
        print(f"   Output directory: {output_dir}")
    print()

    result = package_skill(skill_path, output_dir)

    if result:
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `.claude/skills/skill-creator/scripts/quick_validate.py`
```
#!/usr/bin/env python3
"""
Quick validation script for skills - minimal version
"""

import sys
import os
import re
import yaml
from pathlib import Path

def validate_skill(skill_path):
    """Basic validation of a skill"""
    skill_path = Path(skill_path)

    # Check SKILL.md exists
    skill_md = skill_path / 'SKILL.md'
    if not skill_md.exists():
        return False, "SKILL.md not found"

    # Read and validate frontmatter
    content = skill_md.read_text()
    if not content.startswith('---'):
        return False, "No YAML frontmatter found"

    # Extract frontmatter
    match = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
    if not match:
        return False, "Invalid frontmatter format"

    frontmatter_text = match.group(1)

    # Parse YAML frontmatter
    try:
        frontmatter = yaml.safe_load(frontmatter_text)
        if not isinstance(frontmatter, dict):
            return False, "Frontmatter must be a YAML dictionary"
    except yaml.YAMLError as e:
        return False, f"Invalid YAML in frontmatter: {e}"

    # Define allowed properties
    ALLOWED_PROPERTIES = {'name', 'description', 'license', 'allowed-tools', 'metadata'}

    # Check for unexpected properties (excluding nested keys under metadata)
    unexpected_keys = set(frontmatter.keys()) - ALLOWED_PROPERTIES
    if unexpected_keys:
        return False, (
            f"Unexpected key(s) in SKILL.md frontmatter: {', '.join(sorted(unexpected_keys))}. "
            f"Allowed properties are: {', '.join(sorted(ALLOWED_PROPERTIES))}"
        )

    # Check required fields
    if 'name' not in frontmatter:
        return False, "Missing 'name' in frontmatter"
    if 'description' not in frontmatter:
        return False, "Missing 'description' in frontmatter"

    # Extract name for validation
    name = frontmatter.get('name', '')
    if not isinstance(name, str):
        return False, f"Name must be a string, got {type(name).__name__}"
    name = name.strip()
    if name:
        # Check naming convention (hyphen-case: lowercase with hyphens)
        if not re.match(r'^[a-z0-9-]+$', name):
            return False, f"Name '{name}' should be hyphen-case (lowercase letters, digits, and hyphens only)"
        if name.startswith('-') or name.endswith('-') or '--' in name:
            return False, f"Name '{name}' cannot start/end with hyphen or contain consecutive hyphens"
        # Check name length (max 64 characters per spec)
        if len(name) > 64:
            return False, f"Name is too long ({len(name)} characters). Maximum is 64 characters."

    # Extract and validate description
    description = frontmatter.get('description', '')
    if not isinstance(description, str):
        return False, f"Description must be a string, got {type(description).__name__}"
    description = description.strip()
    if description:
        # Check for angle brackets
        if '<' in description or '>' in description:
            return False, "Description cannot contain angle brackets (< or >)"
        # Check description length (max 1024 characters per spec)
        if len(description) > 1024:
            return False, f"Description is too long ({len(description)} characters). Maximum is 1024 characters."

    return True, "Skill is valid!"

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python quick_validate.py <skill_directory>")
        sys.exit(1)
    
    valid, message = validate_skill(sys.argv[1])
    print(message)
    sys.exit(0 if valid else 1)
```

### Core Architecture Module: `backend/adapters/__init__.py`
```
from adapters.exception import JiuwenSDKError, JiuwenSDKUnavailableError, NexentCapabilityError

try:
    from adapters.jiuwen_sdk_adapter import JiuwenSDKAdapter
except ModuleNotFoundError:
    JiuwenSDKAdapter = None  # type: ignore[assignment, misc]

__all__ = [
    "JiuwenSDKError",
    "JiuwenSDKUnavailableError",
    "NexentCapabilityError",
    "JiuwenSDKAdapter",
]

```

### Core Architecture Module: `backend/adapters/exception.py`
```
class JiuwenSDKError(Exception):
    """Jiuwen SDK 调用失败的通用异常"""
    pass


class JiuwenSDKUnavailableError(JiuwenSDKError):
    """Jiuwen SDK 不可用（依赖缺失或未启用）"""
    pass


class NexentCapabilityError(Exception):
    """nexent 原生模式不支持该能力"""
    pass

```

### Core Architecture Module: `backend/adapters/jiuwen_sdk_adapter.py`
```
"""
openjiuwen SDK adapter for Nexent.

This module works around circular import bugs in openjiuwen 0.1.13 by:
  1. Stubbing react_agent_evolve (causes the circular import)
  2. Installing a meta-path finder that blocks broken __init__.py files
  3. All of the above runs at MODULE LOAD TIME (before openjiuwen imports)

The adapters/__init__.py wraps the import in try/except so the server
starts even when openjiuwen is not installed.
"""
import asyncio
import importlib.abc
import importlib.machinery
import json
import logging
import os
import sys
import types
from typing import Any, List, Literal, Optional, Tuple

# ----------------------------------------------------------------------
# MUST install bypasser + stubs before any openjiuwen import.
# The module-level `from openjiuwen.dev_tools.tune.base import ...` below
# triggers the entire circular import chain.  Installing the bypasser here
# (before that line executes) breaks the cycle.
# ----------------------------------------------------------------------

# Stub react_agent_evolve so single_agent.__init__.py can import it without
# hitting the circular core.operator dependency.
if "openjiuwen.core.single_agent.agents.react_agent_evolve" not in sys.modules:
    _stub = types.ModuleType("openjiuwen.core.single_agent.agents.react_agent_evolve")
    _stub.__file__ = "<bypasser stub>"

    # Provide a dummy ReActAgentEvolve class.  The real one lives in the
    # actual react_agent_evolve.py which we cannot load at this stage
    # because it imports ToolCallOperator from core.operator (still blocked).
    # The stub class satisfies the import in single_agent.__init__.py.
    class _DummyReActAgentEvolve:  # noqa: N801
        pass

    _stub.ReActAgentEvolve = _DummyReActAgentEvolve
    _stub.__all__ = ["ReActAgentEvolve"]
    sys.modules["openjiuwen.core.single_agent.agents.react_agent_evolve"] = _stub

# NOTE: do NOT stub openjiuwen.core.single_agent.  Its real __init__.py must
# run so that `from .schema.agent_card import AgentCard` and the other
# relative submodule imports resolve correctly.  We only need react_agent_evolve
# stubbed (its real file imports ToolCallOperator from core.operator, which
# the bypasser below blocks).

# Stub missing optional dependencies before openjiuwen import chain reaches them
for _name, _attrs in [
    ("pymilvus", {"is_successful": lambda *a, **kw: True}),
    ("dashscope", {}),
    ("pdfplumber", {}),
]:
    if _name not in sys.modules:
        _mod = types.ModuleType(_name)
        _mod.__path__ = []
        for _k, _v in _attrs.items():
            setattr(_mod, _k, _v)
        sys.modules[_name] = _mod

for _name in ["pymilvus.client", "pymilvus.client.utils"]:
    if _name not in sys.modules:
        _m = types.ModuleType(_name)
        _m.__path__ = []
        if _name == "pymilvus.client.utils":
            _m.is_successful = lambda *a, **kw: True
        sys.modules[_name] = _m

for _name, _attrs in [
    ("dashscope.api_entities", {}),
    ("dashscope.api_entities.data", {}),
    ("dashscope.api_entities.dashscope_response", {"DashScopeAPIResponse": object}),
    ("dashscope.common", {"REQUEST_TIMEOUT_KEYWORD": "timeout"}),
    ("dashscope.common.constants", {"REQUEST_TIMEOUT_KEYWORD": "timeout"}),
]:
    if _name not in sys.modules:
        _m = types.ModuleType(_name)
        _m.__path__ = []
        for _k, _v in _attrs.items():
            setattr(_m, _k, _v)
        sys.modules[_name] = _m

_CIRCULAR_CHAIN = {
    "openjiuwen.agent_evolving",
    "openjiuwen.agent_evolving.trainer",
    "openjiuwen.agent_evolving.trainer.trainer",
    "openjiuwen.agent_evolving.trainer.progress",
    "openjiuwen.core",
    "openjiuwen.dev_tools",
    "openjiuwen.dev_tools.tune",
    "openjiuwen.dev_tools.tune.optimizer",
    "openjiuwen.dev_tools.tune.optimizer.instruction_optimizer",
    "openjiuwen.dev_tools.prompt_builder",
    "openjiuwen.dev_tools.prompt_builder.builder",
}


class _JiuwenInitBypasser(importlib.abc.MetaPathFinder, importlib.abc.Loader):
    """
    Meta path finder that intercepts __init__.py loading within openjiuwen,
    blocking only the packages in the circular import chain while letting
    all other modules (including base.py files) load normally.
    """

    def find_spec(self, fullname: str, path: Any, target: Any = None) -> Any:
        if not fullname.startswith("openjiuwen") or fullname == "openjiuwen":
            return None
        try:
            import openjiuwen as _oj

            pkg_root = _oj.__path__[0]
        except ImportError:
            return None
        parts = fullname.split(".")[1:]
        file_path = pkg_root
        for p in parts:
            file_path = os.path.join(file_path, p)
        is_package = os.path.isdir(file_path)
        if not is_package:
            return None
        init_path = os.path.join(file_path, "__init__.py")
        if not os.path.exists(init_path):
            return None
        if fullname not in _CIRCULAR_CHAIN:
            return None
        spec = importlib.machinery.ModuleSpec(
            fullname, self, is_package=True, origin="<init bypassed>"
        )
        spec.submodule_search_locations = [file_path]
        return spec

    def create_module(self, module: Any) -> None:
        return None

    def exec_module(self, module: Any) -> None:
        import openjiuwen as _oj

        pkg_root = _oj.__path__[0]
        parts = module.__name__.split(".")[1:]
        file_path = pkg_root
        for p in parts:
            file_path = os.path.join(file_path, p)
        module.__path__ = [file_path]
        module.__file__ = os.path.join(file_path, "__init__.py")

    def __getattr__(self, name: str) -> Any:
        """Handle special attributes like find_distributions to prevent recursion."""
        import openjiuwen as _oj
        import importlib

        if name in (
            "find_distributions",
            "find_module",
            "__path__",
            "__name__",
            "__file__",
            "__loader__",
            "__package__",
            "__spec__",
        ):
            raise AttributeError(name)
        pkg_root = _oj.__path__[0]
        parts = self.__name__.split(".")[1:] + [name]
        file_path = pkg_root
        for p in parts:
            file_path = os.path.join(file_path, p)
        if os.path.isdir(file_path) and os.path.exists(os.path.join(file_path, "__init__.py")):
            return importlib.import_module(f"{self.__name__}.{name}")
        if os.path.exists(file_path + ".py"):
            return importlib.import_module(f"{self.__name__}.{name}")
        raise AttributeError(name)


# Install the bypasser into sys.meta_path so it intercepts openjiuwen imports.
for _finder in sys.meta_path:
    if isinstance(_finder, _JiuwenInitBypasser):
        break
else:
    sys.meta_path.insert(0, _JiuwenInitBypasser())

# No-op: bypasser is already installed above.
# Kept for backward compatibility with code that calls it.
_bypasser_installed = True


def _install_jiuwen_bypasser() -> bool:
    """No-op: bypasser is installed at module load time. Kept for compatibility."""
    return True

# Now safe to import openjiuwen — bypasser is active.
from openjiuwen.dev_tools.tune.base import Case as _Case, EvaluatedCase as _EvaluatedCase


def _case_from_inputs_label(inputs: dict, label: dict) -> "_Case":
    # Keep stable keys for schema; allow extra fields to exist.
    return _Case(inputs=inputs, label=label)


def _extract_score_reason(evaluated: Any) -> Tuple[float, str]:
    """Try to normalize Jiuwen EvaluatedCase into (score, reason)."""
    try:
        score = float(getattr(evaluated, "score", 0.0) or 0.0)
    except Exception:
        score = 0.0
    reason = getattr(evaluated, "reason", "") or ""
    return score, str(reason)

logger = logging.getLogger("jiuwen_adapter")

from adapters.exception import JiuwenSDKError


# ----------------------------------------------------------------------
# Language helpers
# ------------------
```

### Core Architecture Module: `backend/agents/agent_run_manager.py`
```
import logging
import threading
import uuid
from typing import Dict, Union

from nexent.core.agents.agent_model import AgentRunInfo
from services.runtime_state_service import runtime_state_service

logger = logging.getLogger("agent_run_manager")


class AgentRunAlreadyActiveError(RuntimeError):
    """Raised when a conversation already has an active agent run."""


class AgentRunConcurrencyExceededError(RuntimeError):
    """Raised when one agent id has reached its admitted run limit."""


class AgentRunManager:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(AgentRunManager, cls).__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if not self._initialized:
            # user_id:conversation_id -> agent_run_info
            self.agent_runs: Dict[str, AgentRunInfo] = {}
            self._reservations: Dict[str, str] = {}
            self._agent_capacity_counts: dict[str, int] = {}
            self._agent_capacity_tokens: dict[str, str] = {}
            self._initialized = True

    def _get_run_key(self, conversation_id: Union[int, str], user_id: str) -> str:
        """Generate unique key for agent run using user_id and conversation_id"""
        return f"{user_id}:{conversation_id}"

    def reserve_agent_run(self, conversation_id: Union[int, str], user_id: str) -> str:
        """Atomically reserve a conversation before asynchronous run preparation."""
        with self._lock:
            run_key = self._get_run_key(conversation_id, user_id)
            if run_key in self.agent_runs or run_key in self._reservations:
                raise AgentRunAlreadyActiveError(
                    f"An agent run is already active for conversation {conversation_id}"
                )
            token = uuid.uuid4().hex
            self._reservations[run_key] = token
            return token

    def reserve_agent_capacity(
        self,
        agent_id: int | str,
        max_concurrent_runs: int,
    ) -> str:
        """Atomically reserve one admitted run slot for an agent id."""
        if max_concurrent_runs <= 0:
            raise ValueError("max_concurrent_runs must be greater than zero")
        agent_key = str(agent_id)
        with self._lock:
            current = self._agent_capacity_counts.get(agent_key, 0)
            if current >= max_concurrent_runs:
                raise AgentRunConcurrencyExceededError(
                    f"Agent {agent_key} has reached its concurrent run limit"
                )
            token = uuid.uuid4().hex
            self._agent_capacity_counts[agent_key] = current + 1
            self._agent_capacity_tokens[token] = agent_key
            return token

    def release_agent_capacity(self, capacity_token: str) -> bool:
        """Release an agent admission slot exactly once."""
        with self._lock:
            agent_key = self._agent_capacity_tokens.pop(capacity_token, None)
            if agent_key is None:
                return False
            remaining = self._agent_capacity_counts[agent_key] - 1
            if remaining > 0:
                self._agent_capacity_counts[agent_key] = remaining
            else:
                del self._agent_capacity_counts[agent_key]
            return True

    def get_agent_capacity_count(self, agent_id: int | str) -> int:
        """Return the current admitted run count for one agent id."""
        with self._lock:
            return self._agent_capacity_counts.get(str(agent_id), 0)

    def release_agent_run_reservation(
        self,
        conversation_id: Union[int, str],
        user_id: str,
        reservation_token: str,
    ) -> bool:
        """Release a reservation only when the caller still owns it."""
        with self._lock:
            run_key = self._get_run_key(conversation_id, user_id)
            if self._reservations.get(run_key) != reservation_token:
                return False
            del self._reservations[run_key]
            return True

    def register_agent_run(
        self,
        conversation_id: Union[int, str],
        agent_run_info,
        user_id: str,
        reservation_token: str | None = None,
    ):
        """register agent run instance"""
        with self._lock:
            run_key = self._get_run_key(conversation_id, user_id)
            if run_key in self.agent_runs:
                raise AgentRunAlreadyActiveError(
                    f"An agent run is already active for conversation {conversation_id}"
                )
            if reservation_token is not None:
                if self._reservations.get(run_key) != reservation_token:
                    raise AgentRunAlreadyActiveError(
                        f"Agent run reservation is no longer valid for conversation {conversation_id}"
                    )
                del self._reservations[run_key]
            elif run_key in self._reservations:
                raise AgentRunAlreadyActiveError(
                    f"An agent run is already being prepared for conversation {conversation_id}"
                )
            self.agent_runs[run_key] = agent_run_info
            logger.info(
                f"register agent run instance, user_id: {user_id}, conversation_id: {conversation_id}"
            )
        runtime_state_service.register_run(
            user_id=user_id, conversation_id=conversation_id
        )

    def unregister_agent_run(
        self,
        conversation_id: Union[int, str],
        user_id: str,
        status: str = "completed",
        agent_run_info=None,
    ) -> bool:
        """unregister agent run instance"""
        removed = False
        with self._lock:
            run_key = self._get_run_key(conversation_id, user_id)
            if run_key in self.agent_runs:
                if (
                    agent_run_info is not None
                    and self.agent_runs[run_key] is not agent_run_info
                ):
                    logger.warning(
                        "ignored stale agent run unregister, user_id: %s, conversation_id: %s",
                        user_id,
                        conversation_id,
                    )
                    return False
                del self.agent_runs[run_key]
                removed = True
                logger.info(
                    f"unregister agent run instance, user_id: {user_id}, conversation_id: {conversation_id}"
                )
            else:
                logger.info(
                    f"no agent run instance found for user_id: {user_id}, conversation_id: {conversation_id}"
                )
        if removed:
            runtime_state_service.mark_run_finished(
                user_id=user_id, conversation_id=conversation_id, status=status
            )
        return removed

    def get_agent_run_info(self, conversation_id: Union[int, str], user_id: str):
        """get agent run instance"""
        run_key = self._get_run_key(conversation_id, user_id)
        return self.agent_runs.get(run_key)

    def get_active_run_count(self) -> int:
        """Return the number of registered live runs."""
        with self._lock:
            return len(self.agent_runs)

    def stop_agent_run(self, conversation_id: Union[int, str], user_id: str) -> bool:
        """stop agent run for specified conversation_id and user_id"""
        remote_signal_set = runtime_state_service.set_cancel_signal(
            user_id=user_id,
            conversation_id=conversation_id,
        )
        agent_run_info = self.get_agent_run_info(conversation_id, user_id)
        if agent_run_info is not None:
            agent_run_info.stop_event.set()
            cancellation_scope = getattr(agent_run_info, "cancellation_scope", None)
            if cancellation_scope is not None:
                cancellation_scope.cancel()
 
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4049** (2026-09-30): **docs: update third-party notices (#4048)**
  *Symptoms*: 

- **Issue #4048** (2026-09-30): **docs: update third-party notices**
  *Symptoms*: Updates the root NOTICE for 2025-2026, documents the current principal third-party components and licenses, and points distributors to the project manifests and lockfiles for the broader dependency set. Documentation-only change; validated with git diff --check.

- **Issue #4047** (2026-09-30): **Release v2.7.0 merge**
  *Symptoms*: Merge main (v2.6.1 hotfix history) back into develop for v2.7.0  The v2.6.1 hotfixes landed on main but were never merged back into develop, so both branches evolved the same files independently. The resulting divergence makes the v2.7.0 release PR (develop -> main) conflict on 45 files. This merge restores the missing back-flow.  Resolution: - Conflicted files take the develop side. develop already carries the   hotfix content through a different lineage (#3973, #3998, #4024) and   its wording is the later evolution, so no fix is lost. - main-only edits that are still live are preserved; files main changed   only on paths that develop has since reorganised (agentConfig/ ->   capability/, agents/ -> agents/[agentId]/) resolve to their new   locations. - v2.6.1_001_remove_human_interaction.sql stays deleted: #4024 already   folded its body into v2.7.0_merged_migrations.sql. - VERSION stays v2.7.0, the release being prepared.  The merged tree is identical to develop's tip; this commit exists only to rejoin the two histories so the release PR merges without conflicts.  Verified: python syntax across merged modules, and the test_model_management_service / test_config_sync_service suites.

- **Issue #4045** (2026-09-30): **Fix/default model backfill select best**
  *Symptoms*: 修改了默认模型配置逻辑， 1.没有默认模型的时候，批量添加直接选上下文最大的 2.如果已有默认模型，就添加模型的时候不会再去变动 3.如果默认模型是空的，那就从新添加的里面选 没有默认模型就选上下文最大 <img width="2192" height="1422" alt="20260930-112409" src="https://github.com/user-attachments/assets/0c4683a6-09d7-4b1d-83d4-52cb195fde50" />  有模型但是没有默认模型，从新添加的模型里面选  <img width="2493" height="1760" alt="20260930-112531" src="https://github.com/user-attachments/assets/e64145c3-d582-4154-a2fa-8246d2921f1c" /> <img width="2492" height="1749" alt="20260930-112539" src="https://github.com/user-attachments/assets/836f1258-3bbe-4daf-b31e-92cd9105a5fe" />   
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/ModelEngine-Group/nexent/pull/4045?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=ModelEngine-Group) Report :x: Patch coverage is `66.00000%` with `17 lines` in your changes missing coverage. Please review. | [Files with missing lines](https://app.codecov.io/gh/ModelEngine-Group/nexent/pull/4045?dropdown=coverage&src=pr&el=tree&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=ModelEngine-Group) | Patch % | Lines | |---|---|---| | [backend/apps/model\_managment\_app.py](https://app.codecov.io/gh/ModelEngine-Group/nexent/pull/4045?src=pr&el=tree&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=ModelEngine-Group#diff-YmFja2VuZC9hcHBzL21vZGVsX21hbmFnbWVudF9hcHAucHk=) | 26.66% | [11 Missing :warning: ](https://app.codecov.io/gh/ModelEngine-Group/nexent/pull/4045?src=pr&el=tree&utm_medium=refer

- **Issue #4044** (2026-09-30): **merge(main): merge v2.7.0 release from develop**
  *Symptoms*: Summary Merge latest develop into main for the v2.7.0 release. No conflicts (develop synchronized with main via #4047).  Changes v2.7.0 release (58 commits) Includes v2.6.1 main hotfixes (enforce explicit CodeAgent termination and silent recovery #3969, plus the v2.6.1 hotfix merges #3971/#3983/#3993) Agent Workbench launch flow, model config redesign, tenant-scoped model management, evaluation and paged agent list fixes, and more SQL migration consolidation into v2.7.0_merged_migrations.sql  Notes v2.7.0 tag: (updated after merge) Docker image build triggered

- **Issue #4043** (2026-09-29): **fix: let tenant admins manage models of their own tenant**
  *Symptoms*: fix: let tenant admins manage models of their own tenant  #4008 restricted the cross-tenant /model/manage/* endpoints to the SU role. The whitelist could not tell a foreign-tenant call from one naming the caller's own tenant, so ADMIN users lost the whole Models tab on /resource-manage: manage/list returned 403 and the page rendered an empty table without surfacing an error.  - Replace _require_manage_role with _require_manage_scope: SU may target any   tenant, ADMIN only the tenant its bearer token belongs to, and every other   role is rejected as before - Allow ADMIN in _MANAGE_ALLOWED_ROLES; the role still has to be checked   separately because ADMIN and SU share the same model:* permission seeds - Apply the scope check to all 8 /manage/* endpoints (list, create, update,   delete, batch_create, healthcheck, provider/list, provider/create) - Update the module docstring to describe the role + tenant scope contract - Reject the ADMIN cross-tenant test's blind spot: the old case used a foreign   tenant_id, which is why losing own-tenant access went uncaught - Add own-tenant list/update coverage, a foreign-tenant update case, and a DEV   case proving require(model:read) alone cannot reach the manage surface
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/ModelEngine-Group/nexent/pull/4043?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=ModelEngine-Group) Report :white_check_mark: All modified and coverable lines are covered by tests.  :loudspeaker: Thoughts on this report? [Let us know!](https://github.com/codecov/feedback/issues/255)

- **Issue #4042** (2026-09-30): **🐛 Fix(evaluation): surface run delete errors and hide the delete button for unauthorized users**
  *Symptoms*: ## Problem  1. On the evaluation page, the run-delete handler awaited `fetch(DELETE /api/agent-evaluations/{id})` and then removed the row from the table **without ever looking at the response**. `fetch` only rejects on network errors, so every HTTP failure was treated as success. For a non-creator DEV user the backend answers 403 `160208` ("Only the creator or a tenant administrator can delete this evaluation run"): the row vanished with no message, the run stayed in the database and "came back" after a refresh — a silent false success. 2. The same unchecked-fetch pattern existed in three more mutating calls on the page: evaluator delete (table view and card view) and evaluator publish. Those refresh the list afterwards, so a failure did not corrupt the list, but the user got no feedback at all (silent no-op). 3. Even with correct error handling, showing a delete button that can only fail is poor UX for restricted roles: the backend allows only the run creator or the admin-like roles (`SU/ADMIN/SPEED/ASSET_OWNER`) to delete a run.  ## Fix  **Run delete (root cause)** - Check the DELETE response: on failure show an error toast — `getI18nErrorMessage` maps the backend codes (`160208`, `000501`; the zh/en `errorCode.*` translations already exist) — and keep the row; remove it from the table only on success.  **Button visibility** - The run delete button renders only when the current user may actually delete that run: `run.created_by === user.id` or the role is in `S

- **Issue #4041** (2026-09-29): **fix(frontend): handle agent name overflow and card tag layout**
  *Symptoms*: 1. 解决名称溢出的问题 <img width="1695" height="1305" alt="image" src="https://github.com/user-attachments/assets/8fdae8b0-80ae-4a60-9b40-81a7358c87a8" /> 2. 调整卡片中tag的位置  3 删除/agents?agentId=xxx链接，使用/agents/123来跳转agent编辑页

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

### Incident Patch 1: `5fb390b8` (2026-09-30)
**Commit Message**: Merge main (v2.6.1 hotfix history) back into develop for v2.7.0

The v2.6.1 hotfixes landed on main but were never merged back into
develop, so both branches evolved the same files independently. The
resulting divergence makes the v2.7.0 release PR (develop -> main)
conflict on 45 files. This merge restores the missing back-flow.

Resolution:
- Conflicted files take the develop side. develop already carries the
  hotfix content through a different lineage (#3973, #3998, #4024) and
  its wording is the later evolution, so no fix is lost.
- main-only edits that are still live are preserved; files main changed
  only on paths that develop has since reorganised (agentConfig/ ->
  capability/, agents/ -> agents/[agentId]/) resolve to their new
  locations.
- v2.6.1_001_remove_human_interaction.sql stays deleted: #4024 already
  folded its body into v2.7.0_merged_migrations.sql.
- VERSION stays v2.7.0, the release being prepared.

The merged tree is identical to develop's tip; this commit exists only
to rejoin the two histories so the release PR merges without conflicts.

Verified: python syntax across merged modules, and the
test_model_management_service / test_config_sync_service suite



---

### Incident Patch 2: `1c928950` (2026-09-30)
**Commit Message**: Fix/default model backfill select best (#4045)

* fix(model): let backfill swap auto-picked defaults for larger-context models

The default-model backfill runs after EVERY model creation, and a slot it
fills is treated as final. Batch adds create models one by one, so the
first-created model permanently occupied the slot before better candidates
landed -- the "available first, then larger context window" ranking never
got to compare across the batch. Observed live: a 5-model batch import
left a 256K-context model as the default LLM while two 1M-context models
arrived right after it.

Distinguish user choices from backfill placeholders via the config row's
user_id: the UI save path (set_single_config) stamps the acting user on
rows it writes, backfill-inserted rows leave it empty. Backfill now:

- never touches a slot whose row carries a user_id (user's explicit choice)
- re-evaluates a previously auto-configured slot on every create and swaps
  in the best candidate (available first, then larger context); the first
  user save flips the row to user-owned and locks it
- repairs dangling rows and fills never-configured slots as before

get_single_config_info now also returns the row'

**File**: `backend/apps/model_managment_app.py` (modified, +42/-1)
```diff
@@ -21,6 +21,7 @@
 
 from consts.model import (
     BatchCreateModelsRequest,
+    BackfillDefaultsRequest,
     CapacitySuggestionFields,
     ModelRequest,
     ModelProbeRequest,
@@ -65,6 +66,8 @@
     pop_capacity_accept_signal,
     _record_capacity_suggestion_accept,
     get_model_reasoning_capability,
+    _ids_for_created_models,
+    _backfill_default_model_slots,
 )
 from permissions.depends import authenticate, require
 from permissions.models import CurrentUser
@@ -266,9 +269,14 @@ async def create_model(
         user_id, tenant_id = current_user.user_id, current_user.tenant_id
         model_data = request.model_dump()
         accept_signal = pop_capacity_accept_signal(model_data)
+        # Batch-import flow control flag: popped here so it never reaches
+        # the service/DB layer (same contract as the accept-signal fields).
+        skip_backfill = bool(model_data.pop("skip_default_backfill", None))
         logger.debug(
             f"Start to create model, user_id: {user_id}, tenant_id: {tenant_id}")
-        create_result = await create_model_for_tenant(user_id, tenant_id, model_data)
+        create_result = await create_model_for_tenant(
+            user_id, tenant_id, model_data,
+            skip_default_backfill=skip_backfill)
         if accept_signal is not None:
             _record_capacity_suggestion_accept(
                 accept_signal["match_kind"], request.model_factory
@@ -290,6 +298,39 @@ async def create_model(
             status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail=str(e))
 
 
+@router.post("/backfill_defaults")
+async def backfill_default_model_slots(
+    request: BackfillDefaultsRequest,
+    current_user: CurrentUser = Depends(require(MODEL_CREATE_PERMISSION)),
+):
+    """Finalize default-model auto-configuration after a batch import.
+
+    The batch dialog creates its rows one HTTP call at a time with
+    skip_default_backfill set; this endpoint runs the auto-configuration
+    ONCE with the whole batch's models as candidates, so empty slots get
+    the best model of the batch instead of whichever row happened to be
+    created first. Occupied slots (user- or system-configured) are never
+    touched.
+    """
+    try:
+        user_id, tenant_id = current_user.user_id, current_user.tenant_id
+        created_ids = _ids_for_created_models(
+            request.display_names, tenant_id)
+        auto_configured = _backfill_default_model_slots(
+            user_id, tenant_id, new_model_ids=created_ids)
+        return JSONResponse(status_code=HTTPStatus.OK, content={
+            "auto_configured_defaults": auto_configured,
+            "message": "Default model backfill completed"
+        })
+    except TokenExpiredError as e:
+        logging.warning("Session expired")
+        raise HTTPException(status_code=HTTPStatus.UNAUTHORIZED, detail=str(e))
+    except Exception as e:
+        logging.error(f"Failed to backfill default model slots: {str(e)}")
+        raise HTTPException(
+            status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail=str(e))
+
+
 @router.post("/suggest-capacity")
 async def suggest_model_capacity(
     request: ModelCapacitySuggestionRequest,
```

**File**: `backend/consts/model.py` (modified, +17/-0)
```diff
@@ -578,6 +578,23 @@ class ModelRequest(BaseModel):
     # forwards them to model_capacity_suggestion_accept_total.
     accepted_suggestion_match_kind: Optional[str] = None
     accepted_capability_profile_version: Optional[str] = None
+    # Batch-import flow control (never persisted). The batch dialog creates
+    # rows one HTTP call at a time; rows marked skip_default_backfill leave
+    # default-model slots untouched so a single finalize call (after the
+    # loop) can fill empty slots from the whole batch at once. Popped by
+    # the app layer before the dict reaches the service/DB layer.
+    skip_default_backfill: Optional[bool] = None
+
+
+class BackfillDefaultsRequest(BaseModel):
+    """Request payload for POST /model/backfill_defaults only.
+
+    Finalizes default-model auto-configuration after a batch import: empty
+    slots are filled from the best model among the given display names.
+    Occupied slots (user- or system-configured) are never touched.
+    """
+    display_names: List[str] = Field(
+        ..., description="Display names of the models created in the batch")
 
 
 class ModelProbeRequest(ModelRequest):
```

**File**: `backend/database/tenant_config_db.py` (modified, +6/-1)
```diff
@@ -98,7 +98,12 @@ def get_single_config_info(tenant_id: str, select_key: str):
         if result:
             record_info = {
                 "config_value": result.config_value,
-                "tenant_config_id": result.tenant_config_id
+                "tenant_config_id": result.tenant_config_id,
+                # The UI config-save path (set_single_config) stamps the
+                # acting user here; auto-backfilled rows leave it empty.
+                # Consumers use it to tell "user chose this" from "system
+                # picked a placeholder".
+                "user_id": result.user_id,
             }
 
             return record_info
```

**File**: `backend/services/model_management_service.py` (modified, +96/-21)
```diff
@@ -410,7 +410,12 @@ async def resolve_embedding_base_url(model_data: Dict[str, Any]) -> Tuple[Option
     return None, None
 
 
-async def create_model_for_tenant(user_id: str, tenant_id: str, model_data: Dict[str, Any]):
+async def create_model_for_tenant(
+    user_id: str,
+    tenant_id: str,
+    model_data: Dict[str, Any],
+    skip_default_backfill: bool = False,
+):
     """Create a single model record for the given tenant.
 
     Raises ValueError on display name conflict or invalid input.
@@ -528,7 +533,16 @@ async def create_model_for_tenant(user_id: str, tenant_id: str, model_data: Dict
                 f"Model {model_data['display_name']} created successfully")
 
         # Auto-configure default-model slots that the tenant never set.
-        auto_configured = _backfill_default_model_slots(user_id, tenant_id)
+        # Only the models created by THIS call are eligible for empty slots.
+        # Batch imports pass skip_default_backfill on their per-row creates
+        # and finalize once after the whole batch (backfill_defaults), so the
+        # first row no longer permanently claims empty slots.
+        if skip_default_backfill:
+            return {"auto_configured_defaults": []}
+        created_ids = _ids_for_created_models(
+            [model_data["display_name"]], tenant_id, model_data.get("model_type"))
+        auto_configured = _backfill_default_model_slots(
+            user_id, tenant_id, new_model_ids=created_ids)
         return {"auto_configured_defaults": auto_configured}
     except ValueError:
         # Let the API layer map conflicts to 409 instead of 500.
@@ -637,11 +651,12 @@ def _resolve_existing_slot_config(tenant_id: str, config_key: str):
     """Classify a default-model slot's existing config row.
 
     Returns (live_model_id, stale_row):
-    - live_model_id set: the configured default still exists -- backfill must
-      skip (user's explicit choice).
+    - live_model_id set: the slot is occupied by a live model (user- or
+      system-configured) -- backfill must never touch it.
     - stale_row set: a row exists but its model has been deleted (dangling
       default) -- backfill repairs that row in place.
-    - both None: the slot was never configured -- backfill inserts a row.
+    - both None: the slot is empty (never configured or cleared by the
+      user) -- backfill fills it from the current call's new models.
     """
     row = get_single_config_info(tenant_id, config_key)
     # Note: the DB helper returns {} (not None) when no row matches.
@@ -657,14 +672,58 @@ def _resolve_existing_slot_config(tenant_id: str, config_key: str):
     return None, row
 
 
-def _backfill_default_model_slots(user_id: str, tenant_id: str) -> List[Dict[str, Any]]:
+def _ids_for_created_models(
+    display_names: List[str],
+    tenant_id: str,
+    model_type: Optional[str] = None,
+) -> set:
+    """Resolve the ids of freshly created models from their display names.
+
+    create_model_record returns only a bool, so the ids are recovered by
+    display-name lookup. An optional model_type restricts the match; for
+    multi_embedding creates the embedding twin is included automatically
+    (both records share the display name).
+    """
+    accepted_types = None
+    if model_type:
+        accepted_types = {model_type}
+        if model_type == "multi_embedding":
+            accepted_types.add("embedding")
+    ids = set()
+    for name in display_names:
+        if not name:
+            continue
+        for record in get_models_by_display_name(name, tenant_id):
+            if accepted_types is None or record.get("model_type") in accepted_types:
+                ids.add(record["model_id"])
+    return ids
+
+
+def _backfill_default_model_slots(
+    user_id: str,
+    tenant_id: str,
+    new_model_ids: Optional[set] = None,
+) -> List[Dict[str, Any]]:
     """Auto-configure default-model slots after models are created.
 
-    A slot is skipped only when its config row points
```

**File**: `frontend/app/[locale]/models/components/model/ModelAddDialog.tsx` (modified, +23/-0)
```diff
@@ -981,6 +981,7 @@ function BatchAddForm({
     setSubmitting(true);
     let created = 0;
     const failed: string[] = [];
+    const createdDisplayNames: string[] = [];
     for (const row of rows) {
       // User-modified overrides win; otherwise use catalog suggestions.
       const override = rowOverrides[row.id] ?? rowSuggestions[row.id];
@@ -1004,6 +1005,11 @@ function BatchAddForm({
           // carry the verified result into the created record instead of
           // resetting to not_detected.
           connectStatus: "available",
+          // Batch rows leave default-slot auto-configuration to the single
+          // finalize call after the loop, so the whole batch competes for
+          // empty slots at once (and occupied slots stay untouched) instead
+          // of the first row permanently claiming them.
+          skipDefaultBackfill: true,
         };
         if (override?.settings) {
           applyAdvancedSettingsToParams(
@@ -1013,12 +1019,29 @@ function BatchAddForm({
           );
         }
         await createModel(tenantId, params);
+        createdDisplayNames.push(
+          override?.displayName?.trim() || row.model_name
+        );
         created++;
       } catch (error: any) {
         failed.push(row.model_name);
         log.error("batch add model failed", row.model_name, error);
       }
     }
+    if (created > 0) {
+      // Single finalize for the whole batch: empty slots get the best model
+      // among the freshly created ones; occupied slots are never touched.
+      // Only the user-facing flow (no tenantId override) — the manage-tenant
+      // path targets another tenant and keeps its own behavior.
+      // Best-effort — a failure here does not fail the import.
+      if (!tenantId) {
+        try {
+          await modelService.backfillDefaults(createdDisplayNames);
+        } catch (error) {
+          log.warn("Failed to finalize default-model backfill:", error);
+        }
+      }
+    }
     setSubmitting(false);
     if (created > 0) {
       if (failed.length === 0) {
```

---

### Incident Patch 3: `04c68c4d` (2026-09-30)
**Commit Message**: 🐛 Fix(evaluation): surface run delete errors and hide the delete button for unauthorized users (#4042)

* 🐛 Fix(evaluation): surface run delete errors and hide button for unauthorized users

* ♻️ Refactor(evaluation): extract shared error-toast helper to fix Sonar duplication

**File**: `frontend/app/[locale]/evaluation/page.tsx` (modified, +106/-41)
```diff
@@ -1,5 +1,12 @@
 "use client";
-import { useState, useEffect, useRef, useCallback, type Key } from "react";
+import {
+  useState,
+  useEffect,
+  useRef,
+  useCallback,
+  type Key,
+  type ReactNode,
+} from "react";
 import {
   Tabs,
   Typography,
@@ -45,6 +52,8 @@ import {
 } from "@/const/agentEvaluation";
 import { useModelList } from "@/hooks/model/useModelList";
 import { useDeployment } from "@/components/providers/deploymentProvider";
+import { useAuthorizationContext } from "@/components/providers/AuthorizationProvider";
+import { USER_ROLES } from "@/const/auth";
 import { getI18nErrorMessage } from "@/const/errorMessageI18n";
 import {
   buildEvaluationTaskQuery,
@@ -54,6 +63,46 @@ import {
 import AnnotationLabels from "./components/AnnotationLabels";
 const { Text, Title } = Typography;
 
+// Roles allowed to delete ANY evaluation run. Mirrors the backend's
+// CAN_EDIT_ALL_USER_ROLES (backend/consts/const.py); all other roles can
+// only delete runs they created themselves.
+const EVALUATION_DELETE_ALL_ROLES = new Set<string>([
+  USER_ROLES.SU,
+  USER_ROLES.ADMIN,
+  USER_ROLES.SPEED,
+  USER_ROLES.ASSET_OWNER,
+]);
+
+/**
+ * Fire a body-less mutating request (DELETE / POST) and surface backend
+ * errors as a toast. Returns true only on success so callers can skip
+ * their success path (local row removal / list refresh).
+ */
+async function requestWithErrorToast(
+  url: string,
+  method: "DELETE" | "POST",
+  failKey: string,
+  t: (key: string) => string,
+  message: { error: (content: ReactNode) => void }
+): Promise<boolean> {
+  try {
+    const resp = await fetch(url, { method, headers: getAuthHeaders() });
+    if (!resp.ok) {
+      const d = await resp.json().catch(() => ({}));
+      message.error(
+        d.code
+          ? getI18nErrorMessage(d.code, t)
+          : d.detail || d.message || t(failKey)
+      );
+      return false;
+    }
+    return true;
+  } catch {
+    message.error(t(failKey));
+    return false;
+  }
+}
+
 function useList(url: string) {
   /**
    * Tiny reusable list fetcher — used for agent/evaluator/evaluation-set
@@ -105,6 +154,14 @@ function RunsTab() {
   const [evalSets, setEvalSets] = useState<any[]>([]);
   const [evaluators, setEvaluators] = useState<any[]>([]);
 
+  // The backend rejects DELETE for non-creators outside the admin-like
+  // roles (error 160208), so hide the delete button for those users
+  // instead of letting them hit the rejection.
+  const { user } = useAuthorizationContext();
+  const canDeleteRun = (r: any) =>
+    (user?.id != null && r?.created_by === user.id) ||
+    EVALUATION_DELETE_ALL_ROLES.has(user?.role ?? "");
+
   // ── Drawer (create-evaluation form) state ─────────────────────────────
   // Short variable names intentionally match the drawer inputs one-to-one:
   //   sA  = selected agent_id
@@ -349,29 +406,36 @@ function RunsTab() {
               }
             />
           </Tooltip>
-          <Popconfirm
-            title={t("agentEvaluation.deleteConfirm")}
-            onConfirm={async () => {
-              await fetch(
-                API_ENDPOINTS.agentEvaluations.delete(r.agent_evaluation_id),
-                { method: "DELETE", headers: getAuthHeaders() }
-              );
-              setRuns((prev) =>
-                prev.filter(
-                  (x) => x.agent_evaluation_id !== r.agent_evaluation_id
-                )
-              );
-            }}
-          >
-            <Tooltip title={t("agentEvaluation.delete")}>
-              <Button
-                type="link"
-                size="small"
-                danger
-                icon={<Trash2 className="size-3.5" />}
-              />
-            </Tooltip>
-          </Popconfirm>
+          {canDeleteRun(r) && (
+            <Popconfirm
+              title={t("agentEvaluation.deleteConfirm")}
+              onConfirm={async () => {
+                const ok = await requestWithErrorToast(
+                  API_ENDPOINTS.a
```

**File**: `frontend/public/locales/en/common.json` (modified, +1/-0)
```diff
@@ -4837,6 +4837,7 @@
   "agentEvaluation.pagination.total": "Total {{total}} items",
   "agentEvaluation.progressLabel": "Progress",
   "agentEvaluation.publish": "Publish",
+  "agentEvaluation.publishFailed": "Failed to publish evaluator",
   "agentEvaluation.published": "Published",
   "agentEvaluation.queryCountRequired": "Please select at least one runtime evaluator",
   "agentEvaluation.save": "Save",
```

**File**: `frontend/public/locales/zh/common.json` (modified, +1/-0)
```diff
@@ -4851,6 +4851,7 @@
   "agentEvaluation.pagination.total": "共 {{total}} 条",
   "agentEvaluation.progressLabel": "进度",
   "agentEvaluation.publish": "发布",
+  "agentEvaluation.publishFailed": "发布失败",
   "agentEvaluation.published": "已发布",
   "agentEvaluation.queryCountRequired": "请选择至少一个运行时评估器",
   "agentEvaluation.save": "保存",
```

---

### Incident Patch 4: `89d92744` (2026-09-29)
**Commit Message**: fix: let tenant admins manage models of their own tenant (#4043)

#4008 closed a horizontal-privilege hole on /model/manage/* by restricting
the endpoints to the SU role. The whitelist did not distinguish a
cross-tenant call from one naming the caller's own tenant, so ADMIN users
lost the whole Models tab on /resource-manage: manage/list returned 403 and
the page rendered an empty table with no error, because the create, update,
delete, healthcheck and provider endpoints share the same guard.

The page always sends the caller's own tenant_id (UserManageComp falls back
to user.tenantId for non-SU), so rejecting ADMIN blocked no cross-tenant
access -- it only broke tenant admins managing their own models.

Replace the role whitelist with a role + tenant scope check: SU may target
any tenant, ADMIN only the tenant its token belongs to, and every other role
is rejected as before. ADMIN and SU share the same model:* permission seeds,
so the role itself still has to be checked -- permissions alone cannot
separate them.

The existing ADMIN cross-tenant test kept passing because it used a foreign
tenant_id, which is why the regression went uncaught. Add own-tenant
coverage for list and upd

**File**: `backend/apps/model_managment_app.py` (modified, +32/-16)
```diff
@@ -10,7 +10,8 @@
 Authorization: Mutating endpoints require RBAC permissions (model:create /
 model:update / model:delete) via ``permissions.depends.require``; read endpoints
 require ``model:read``. Cross-tenant ``/manage/*`` endpoints additionally
-require the SU role. Identity is resolved from the bearer token into a
+require the SU role, or the ADMIN role when the targeted tenant is the
+caller's own. Identity is resolved from the bearer token into a
 ``CurrentUser`` and propagated as ``user_id`` / ``tenant_id`` to services.
 """
 
@@ -77,9 +78,11 @@
 MODEL_READ_PERMISSION = "model:read"
 MODEL_UPDATE_PERMISSION = "model:update"
 MODEL_DELETE_PERMISSION = "model:delete"
-# Cross-tenant manage endpoints are SU-only; ADMIN shares the same MODEL seeds
-# so permission strings cannot separate them.
-_MANAGE_ALLOWED_ROLES = ("SU",)
+# Roles allowed on the cross-tenant /manage/* endpoints. ADMIN shares the same
+# MODEL permission seeds as SU, so permission strings cannot separate the two
+# and the role itself must be checked. ADMIN is scoped to its own tenant by
+# ``_require_manage_scope``; SU may target any tenant.
+_MANAGE_ALLOWED_ROLES = ("SU", "ADMIN")
 
 # Model Catalog loader (with graceful fallback)
 try:
@@ -147,12 +150,25 @@ def _log_safe(value: Any) -> str:
     return _LOG_UNSAFE_CHARS.sub("", str(value))
 
 
-def _require_manage_role(current_user: CurrentUser) -> None:
-    """Restrict cross-tenant manage endpoints to super admins."""
-    if current_user.normalized_role not in _MANAGE_ALLOWED_ROLES:
+def _require_manage_scope(current_user: CurrentUser, target_tenant_id: str) -> None:
+    """Authorize a /manage/* call against the tenant it targets.
+
+    SU may manage any tenant. ADMIN may manage only the tenant its token
+    belongs to -- the tenant-resource page always passes the caller's own
+    tenant_id, so restricting ADMIN outright would break tenant admins
+    managing their own models while blocking no cross-tenant access. Any
+    other role, or an ADMIN naming a foreign tenant, is rejected.
+    """
+    role = current_user.normalized_role
+    if role not in _MANAGE_ALLOWED_ROLES:
+        raise HTTPException(
+            status_code=HTTPStatus.FORBIDDEN,
+            detail="This operation requires SU or tenant ADMIN role",
+        )
+    if role != "SU" and target_tenant_id != current_user.tenant_id:
         raise HTTPException(
             status_code=HTTPStatus.FORBIDDEN,
-            detail="This operation requires SU role",
+            detail="Tenant admins may only manage models of their own tenant",
         )
 
 
@@ -716,7 +732,7 @@ async def manage_check_model_health(
     Returns:
         Connectivity check result with updated status.
     """
-    _require_manage_role(current_user)
+    _require_manage_scope(current_user, request.tenant_id)
     try:
         logger.debug(
             f"Start to check model connectivity for tenant, user_id: {current_user.user_id}, "
@@ -760,7 +776,7 @@ async def manage_create_model(
     Returns:
         Success message on successful creation.
     """
-    _require_manage_role(current_user)
+    _require_manage_scope(current_user, request.tenant_id)
     try:
         user_id = current_user.user_id
         logger.debug(
@@ -811,7 +827,7 @@ async def manage_update_model(
     Returns:
         Success message on successful update.
     """
-    _require_manage_role(current_user)
+    _require_manage_scope(current_user, request.tenant_id)
     try:
         user_id = current_user.user_id
         logger.debug(
@@ -863,7 +879,7 @@ async def manage_delete_model(
     Returns:
         Success message with deleted model name.
     """
-    _require_manage_role(current_user)
+    _require_manage_scope(current_user, request.tenant_id)
     try:
         user_id = current_user.user_id
         logger.debug(
@@ -908,7 +924,7 @@ async def manage_batch_create_models(
     Returns:
         Success message on completion.
     """
-    _require_manage_ro
```

**File**: `test/backend/app/test_model_rbac.py` (modified, +83/-4)
```diff
@@ -2,7 +2,8 @@
 
 Verifies that mutating /model/* endpoints reject the DEV role (which only
 holds model:read), read endpoints stay accessible to DEV, and the
-cross-tenant /manage/* endpoints are restricted to SU.
+/manage/* endpoints accept SU for any tenant plus ADMIN for its own tenant
+only.
 """
 
 import sys
@@ -185,9 +186,9 @@ async def test_admin_can_create_model(admin_client, mocker):
 
 
 @pytest.mark.asyncio
-async def test_admin_cannot_access_manage_endpoints(admin_client, mocker):
-    """ADMIN shares the SU model seeds, so manage/* must fall back to the
-    SU role whitelist."""
+async def test_admin_cannot_access_foreign_tenant_manage_endpoints(admin_client, mocker):
+    """ADMIN shares the SU model seeds, so cross-tenant manage/* calls must be
+    rejected by the role+tenant scope check rather than by permission strings."""
     mocker.patch(
         'backend.apps.model_managment_app.list_models_for_admin',
         return_value={"models": [], "total": 0},
@@ -200,8 +201,86 @@ async def test_admin_cannot_access_manage_endpoints(admin_client, mocker):
     assert response.status_code == HTTPStatus.FORBIDDEN
 
 
+@pytest.mark.asyncio
+async def test_admin_cannot_mutate_foreign_tenant_models(admin_client, mocker):
+    """The own-tenant allowance must not extend to mutating endpoints either."""
+    mock_update = mocker.patch(
+        'backend.apps.model_managment_app.update_single_model_for_tenant',
+        return_value=None,
+    )
+    response = admin_client.post(
+        "/model/manage/update",
+        json={
+            "tenant_id": "other_tenant",
+            "current_display_name": "m",
+            "model_name": "m2",
+        },
+        headers=auth_header,
+    )
+    assert response.status_code == HTTPStatus.FORBIDDEN
+    mock_update.assert_not_awaited()
+
+
+@pytest.mark.asyncio
+async def test_admin_can_list_own_tenant_models(admin_client, mocker):
+    """Tenant admins manage their own tenant via /resource-manage, which always
+    passes the caller's own tenant_id. Regression: manage/list used to be
+    SU-only, so the Models tab rendered an empty table for ADMIN."""
+    mock_list = mocker.patch(
+        'backend.apps.model_managment_app.list_models_for_admin',
+        return_value={"models": [], "total": 0},
+    )
+    response = admin_client.post(
+        "/model/manage/list",
+        json={"tenant_id": "rbac_tenant", "page": 1, "page_size": 10},
+        headers=auth_header,
+    )
+    assert response.status_code == HTTPStatus.OK
+    mock_list.assert_awaited_once()
+    # The own-tenant id must be the one forwarded to the service.
+    assert mock_list.await_args.args[0] == "rbac_tenant"
+
+
+@pytest.mark.asyncio
+async def test_admin_can_mutate_own_tenant_models(admin_client, mocker):
+    """Create/update/delete of the ADMIN's own tenant models stay available."""
+    mock_update = mocker.patch(
+        'backend.apps.model_managment_app.update_single_model_for_tenant',
+        return_value=None,
+    )
+    response = admin_client.post(
+        "/model/manage/update",
+        json={
+            "tenant_id": "rbac_tenant",
+            "current_display_name": "m",
+            "model_name": "m2",
+        },
+        headers=auth_header,
+    )
+    assert response.status_code == HTTPStatus.OK
+    mock_update.assert_awaited_once()
+
+
+@pytest.mark.asyncio
+async def test_dev_cannot_access_own_tenant_manage_endpoints(dev_client, mocker):
+    """DEV holds model:read and passes require(), so the scope check is the only
+    thing keeping it off the manage surface -- even for its own tenant."""
+    mock_list = mocker.patch(
+        'backend.apps.model_managment_app.list_models_for_admin',
+        return_value={"models": [], "total": 0},
+    )
+    response = dev_client.post(
+        "/model/manage/list",
+        json={"tenant_id": "rbac_tenant", "page": 1, "page_size": 10},
+        headers=auth_header,
+    )
+    assert response.status_code == HTTPStatus.FORBI
```

---

### Incident Patch 5: `be69e7b3` (2026-09-29)
**Commit Message**: fix(frontend): handle agent name overflow and card tag layout (#4041)

* update version style

* 删除右下角“联系我们”，优化超级管理员界面

* fix(frontend): keep agent conversations visible after returning

* fix: show repository status in paged agent list

* fix(frontend): move skill listing action to more menu

* fix: restrict agent repository review data in paged list

* fix(frontend): return from chat when thread reload fails

* fix(frontend): handle agent name overflow and card tag layout

---------

Co-authored-by: Summer-Si <mingmingsu22@gmail.com>
Co-authored-by: panyehong <2655992392@qq.com>

**File**: `frontend/app/[locale]/agent-space/agent-space.tsx` (modified, +6/-4)
```diff
@@ -248,14 +248,16 @@ export function AgentSpace({ active }: { active: boolean }) {
                 </span>
               ) : null}
               {listing.version_label ? (
-                <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
+                <span className="flex min-w-0 max-w-full items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                   <span
                     className="size-1.5 shrink-0 rounded-full bg-primary"
                     aria-hidden
                   />
-                  {t("agentRepository.mine.currentVersion", {
-                    version: listing.version_label,
-                  })}
+                  <span className="min-w-0 truncate">
+                    {t("agentRepository.mine.currentVersion", {
+                      version: listing.version_label,
+                    })}
+                  </span>
                 </span>
               ) : null}
             </>
```

**File**: `frontend/app/[locale]/agent-space/components/MineReviewStatusModal.tsx` (modified, +4/-7)
```diff
@@ -53,25 +53,22 @@ export function MineReviewStatusModal({
         icon: Clock,
         label: t("repository.listingStatus.pendingLabel"),
         description: t("repository.listingStatus.pendingDescription"),
-        tone:
-          "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
+        tone: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
         iconClass: "text-amber-600 dark:text-amber-300",
       }
     : isRejected
       ? {
           icon: XCircle,
           label: t("repository.listingStatus.rejectedLabel"),
           description: t("repository.listingStatus.rejectedDescription"),
-          tone:
-            "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200",
+          tone: "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200",
           iconClass: "text-red-600 dark:text-red-300",
         }
       : {
           icon: CheckCircle2,
           label: t("repository.listingStatus.listedLabel"),
           description: t("repository.listingStatus.listedDescription"),
-          tone:
-            "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
+          tone: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
           iconClass: "text-emerald-600 dark:text-emerald-300",
         };
 
@@ -192,7 +189,7 @@ export function MineReviewStatusModal({
       <div className="space-y-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
         <div className="flex justify-between gap-4">
           <span>{t("agentRepository.mine.reviewModal.version")}</span>
-          <span className="font-medium text-slate-700 dark:text-slate-200">
+          <span className="min-w-0 truncate font-medium text-slate-700 dark:text-slate-200">
             {versionLabel}
           </span>
         </div>
```

**File**: `frontend/app/[locale]/agent-space/components/MyAgentCard.tsx` (modified, +66/-52)
```diff
@@ -160,14 +160,16 @@ export function MyAgentCard({
       onClick={onView}
       subtitle={
         versionLabel != null ? (
-          <span className="inline-flex items-center gap-1.5 truncate">
+          <span className="flex min-w-0 items-center gap-1.5">
             <span
               className="size-1.5 shrink-0 rounded-full bg-primary"
               aria-hidden
             />
-            {t("agentRepository.mine.currentVersion", {
-              version: versionLabel,
-            })}
+            <span className="min-w-0 truncate">
+              {t("agentRepository.mine.currentVersion", {
+                version: versionLabel,
+              })}
+            </span>
           </span>
         ) : undefined
       }
@@ -188,29 +190,24 @@ export function MyAgentCard({
           </>
         ) : undefined
       }
-      headerActions={
-        <div className="flex shrink-0 flex-col items-end gap-1.5">
-          {menuItems.length > 0 ? (
-            <Dropdown
-              menu={{ items: menuItems }}
-              open={guideMenuOpen}
-              onOpenChange={onGuideMenuOpenChange}
-              trigger={["click"]}
-            >
-              <Button
-                type="text"
-                size="small"
-                className="size-8 shrink-0 text-slate-400 hover:text-slate-600"
-                icon={<MoreHorizontal className="size-4" aria-hidden />}
-                aria-label={t("agentRepository.mine.menu.more")}
-                aria-haspopup="menu"
-              />
-            </Dropdown>
-          ) : null}
-          <div className="flex flex-wrap items-center justify-end gap-1.5">
+      statusRow={
+        <div className="flex w-full min-w-0 items-center gap-2">
+          <span
+            className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
+              published
+                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
+                : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
+            }`}
+          >
+            {published
+              ? t("agentRepository.mine.lifecycle.published")
+              : t("agentRepository.mine.lifecycle.draft")}
+          </span>
+          <div className="flex min-w-0 flex-1 justify-end">
             {repositoryBadge ? (
               <span
-                className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
+                aria-label={`${t(repositoryBadge.labelKey)}${repositoryBadge.versionLabel ? ` · ${repositoryBadge.versionLabel}` : ""}`}
+                className={`block w-fit max-w-full truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                   repositoryBadge.variant === "pending"
                     ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                     : repositoryBadge.variant === "rejected"
@@ -224,39 +221,56 @@ export function MyAgentCard({
                   : null}
               </span>
             ) : null}
+          </div>
+        </div>
+      }
+      headerActions={
+        menuItems.length > 0 || agent.is_available === false ? (
+          <div className="grid h-[60px] grid-rows-2">
+            <div className="flex items-center justify-end">
+              {menuItems.length > 0 ? (
+                <Dropdown
+                  menu={{ items: menuItems }}
+                  open={guideMenuOpen}
+                  onOpenChange={onGuideMenuOpenChange}
+                  trigger={["click"]}
+                >
+                  <Button
+                    type="text"
+                    size="small"
+                    className="size-8 shrink-0 text-slate-400 hover:text-slate-600"
+                    icon={<MoreHorizontal className="size-4" aria-hidden />}
+                    aria-label={t("agentRepository.mine.menu.more")}
+                    aria-haspopup="menu"
+                  />
+                </Dropdown>
+              ) : null}
```

**File**: `frontend/app/[locale]/agent-space/components/ReviewAgentList.tsx` (modified, +1/-1)
```diff
@@ -100,7 +100,7 @@ export function ReviewAgentList({
                   </h3>
                 </div>
 
-                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
+                <div className="min-w-0 truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                   {versionLabel}
                 </div>
 
```

**File**: `frontend/app/[locale]/agents/page.tsx` (modified, +86/-21)
```diff
@@ -13,7 +13,7 @@ import {
   Pagination,
   Row,
   Spin,
-  Tag,
+  Tooltip,
 } from "antd";
 import { Bot, FileInput, Pencil, Search, Clock } from "lucide-react";
 import { useTranslation } from "react-i18next";
@@ -33,6 +33,8 @@ import { useAgentStore } from "@/stores/agentStore";
 import type { Agent } from "@/types/agentConfig";
 import { AgentDetail } from "@/components/agent/agent-detail";
 import { mapAgentInfoDetail } from "@/lib/myAgentDetail";
+import { getMineCardRepositoryStatusBadge } from "@/lib/agentRepositoryMine";
+import { getUnavailableReasonLabels } from "@/lib/agentLabelMapper";
 
 import AgentConfigActions from "./components/agent-config-actions";
 import AgentAvatar from "./components/agent-avatar";
@@ -92,6 +94,7 @@ export default function AgentsPage() {
     search,
     page,
     pageSize: itemsPerPage,
+    includeRepositoryInfo: true,
   });
   const cardHeight = `calc((100% - ${(rows - 1) * 20}px) / ${rows})`;
 
@@ -243,6 +246,13 @@ export default function AgentsPage() {
                   </Col>
                   {(agents as AgentCardItem[]).map((agent) => {
                     const date = formatAgentDate(agent);
+                    const repositoryBadge = getMineCardRepositoryStatusBadge(
+                      agent.repository_info ?? []
+                    );
+                    const unavailableReasonLabels = getUnavailableReasonLabels(
+                      agent.unavailable_reasons ?? [],
+                      t
+                    );
                     return (
                       <Col
                         key={agent.id}
@@ -257,13 +267,21 @@ export default function AgentsPage() {
                           className="h-full min-h-0"
                           title={getAgentTitle(agent)}
                           subtitle={
-                            agent.current_version_no
-                              ? t("agentRepository.mine.currentVersion", {
-                                  version:
-                                    agent.version_name ||
-                                    `V${agent.current_version_no}`,
-                                })
-                              : undefined
+                            agent.current_version_no ? (
+                              <span className="flex min-w-0 items-center gap-1.5">
+                                <span
+                                  className="size-1.5 shrink-0 rounded-full bg-primary"
+                                  aria-hidden
+                                />
+                                <span className="min-w-0 truncate">
+                                  {t("agentRepository.mine.currentVersion", {
+                                    version:
+                                      agent.version_name ||
+                                      `V${agent.current_version_no}`,
+                                  })}
+                                </span>
+                              </span>
+                            ) : undefined
                           }
                           icon={
                             <AgentAvatar
@@ -277,25 +295,72 @@ export default function AgentsPage() {
                             t("agentRepository.card.noDescription")
                           }
                           descriptionLines={2}
-                          actions={
-                            <div className="flex flex-col items-end gap-1.5">
-                              <AgentConfigActions
-                                agentId={Number(agent.id)}
-                                readOnly={agent.permission === "READ_ONLY"}
-                                variant="menu"
-                                onManageVersions={handleManageVersions}
-                              />
-                              <Tag
-                                color={
-                                  agent.current_version_no ? "green" : "orange"
-                                }

```

---

### Incident Patch 6: `69b8f391` (2026-09-29)
**Commit Message**: 🐛 Bugfix: Fixed the issue with agent redirection when creating agents in the Agent Workbench; fixed the issue where agents were not fully displayed on the agent configuration page. (#4040)

**File**: `backend/database/agent_db.py` (modified, +2/-0)
```diff
@@ -548,6 +548,8 @@ def query_agent_list_candidates_by_tenant_id(
                 AgentInfo.version_no == 0,
                 AgentInfo.delete_flag != 'Y',
                 AgentInfo.enabled.is_(True),
+                or_(AgentInfo.agent_origin.is_(None), AgentInfo.agent_origin != "SYSTEM"),
+                or_(AgentInfo.system_key.is_(None), AgentInfo.system_key == ""),
             )
             .order_by(AgentInfo.create_time.desc(), AgentInfo.agent_id.desc())
             .all()
```

**File**: `frontend/app/[locale]/agent-space/my-agent.tsx` (modified, +2/-4)
```diff
@@ -388,7 +388,7 @@ export function MyAgent({
       invalidateAgentRepositoryCaches(queryClient),
       queryClient.invalidateQueries({ queryKey: [AGENTS_LIST_QUERY_KEY] }),
     ]);
-    router.push(`/${locale}/agents?agent_id=${agentId}`);
+    router.push(`/${locale}/agents/${agentId}`);
   };
 
   const handleEdit = (
@@ -398,9 +398,7 @@ export function MyAgent({
     if (permission === "READ_ONLY") {
       return;
     }
-    router.push(
-      `/${locale}/agents?agent_id=${agentId}&from=agent-space&tab=mine`
-    );
+    router.push(`/${locale}/agents/${agentId}?from=agent-space&tab=mine`);
   };
 
   const handleDeleteAgent = (agent: MyEditableAgentItem) => {
```

**File**: `frontend/app/[locale]/layout.client.tsx` (modified, +9/-2)
```diff
@@ -43,8 +43,15 @@ export function ClientLayout({ children }: { children: ReactNode }) {
   const [collapsed, setCollapsed] = useState(effectivePath === "/workbench");
 
   useEffect(() => {
-    if (effectivePath !== "/workbench") return;
-    const frame = requestAnimationFrame(() => setCollapsed(true));
+    if (
+      effectivePath !== "/workbench" &&
+      !effectivePath.startsWith("/agents/") &&
+      effectivePath !== "/skill-space"
+    )
+      return;
+    const frame = requestAnimationFrame(() =>
+      setCollapsed(effectivePath === "/workbench")
+    );
     return () => cancelAnimationFrame(frame);
   }, [effectivePath]);
 
```

**File**: `frontend/components/navigation/SideNavigation.tsx` (modified, +7/-4)
```diff
@@ -206,16 +206,19 @@ export function SideNavigation({ collapsed }: SideNavigationProps) {
   // Update selected key and expand parent menu when pathname changes
   useEffect(() => {
     const currentPath = getEffectiveRoutePath(pathname);
+    const routePath = currentPath.startsWith("/agents/")
+      ? "/agents"
+      : currentPath;
     const matchedKey =
-      currentPath === "/newchat"
+      routePath === "/newchat"
         ? "/chat"
-        : ROUTE_PATHS.includes(currentPath)
-          ? currentPath
+        : ROUTE_PATHS.includes(routePath)
+          ? routePath
           : null;
     setSelectedKey(matchedKey || "");
 
     // Auto-expand parent menu when visiting child page
-    const parentKey = findParentKey(currentPath);
+    const parentKey = findParentKey(routePath);
     setOpenKeys(parentKey ? [parentKey] : []);
   }, [pathname]);
 
```

**File**: `frontend/features/agentAutomation/components/AutomationProposalMessage.tsx` (modified, +5/-2)
```diff
@@ -86,8 +86,11 @@ export default function AutomationProposalMessage({
 
   const configureAgent = () => {
     const agentId = currentProposal.task?.agent_id;
-    const suffix = agentId ? `?agent_id=${agentId}` : "";
-    router.push(`/${i18n.language}/agents${suffix}`);
+    router.push(
+      agentId
+        ? `/${i18n.language}/agents/${agentId}`
+        : `/${i18n.language}/agents`
+    );
   };
 
   return (
```

---

### Incident Patch 7: `0c9ff869` (2026-09-29)
**Commit Message**: fix: show repository status in paged agent list (#4039)

* update version style

* 删除右下角“联系我们”，优化超级管理员界面

* fix(frontend): keep agent conversations visible after returning

* fix: show repository status in paged agent list

* fix(frontend): move skill listing action to more menu

* fix: restrict agent repository review data in paged list

* fix(frontend): return from chat when thread reload fails

---------

Co-authored-by: Summer-Si <mingmingsu22@gmail.com>

**File**: `backend/apps/agent_app.py` (modified, +5/-0)
```diff
@@ -837,6 +837,9 @@ async def list_agent_page_api(
     search_tag_predicates: Optional[str] = Query(None, description="Text-search tag predicates as JSON"),
     page: int = Query(1, ge=1, description="Page number starting from 1"),
     page_size: int = Query(20, ge=1, le=100, description="Items per page"),
+    include_repository_info: bool = Query(
+        False, description="Include repository listings for agents on this page"
+    ),
     authorization: Optional[str] = Header(None),
     request: Request = None,
 ):
@@ -852,11 +855,13 @@ async def list_agent_page_api(
         kwargs = {
             "tenant_id": resolved_tenant_id,
             "user_id": user_id,
+            "caller_tenant_id": auth_tenant_id,
             "permission": permission,
             "tag": tag,
             "search": search,
             "page": page,
             "page_size": page_size,
+            "include_repository_info": include_repository_info,
         }
         if created_by:
             kwargs["created_by"] = created_by
```

**File**: `backend/database/agent_repository_db.py` (modified, +7/-2)
```diff
@@ -354,14 +354,15 @@ def list_agent_repository_by_agent_ids(
     *,
     statuses: Collection[str],
     publisher_tenant_id: str,
+    publisher_user_id: Optional[str] = None,
 ) -> List[dict]:
     """List repository rows for the given agents, scoped to publisher tenant and statuses."""
     if not agent_ids:
         return []
 
     status_list = list(statuses)
     with get_db_session() as session:
-        rows = (
+        query = (
             session.query(
                 AgentRepository.agent_repository_id,
                 AgentRepository.agent_id,
@@ -377,7 +378,11 @@ def list_agent_repository_by_agent_ids(
                 AgentRepository.agent_id.in_(agent_ids),
                 AgentRepository.status.in_(status_list),
             )
-            .order_by(
+        )
+        if publisher_user_id is not None:
+            query = query.filter(AgentRepository.publisher_user_id == publisher_user_id)
+        rows = (
+            query.order_by(
                 AgentRepository.agent_id,
                 AgentRepository.create_time.desc(),
             )
```

**File**: `backend/management/services/agent/management.py` (modified, +70/-0)
```diff
@@ -14,6 +14,7 @@
 from agents.create_agent_info import create_tool_config_list
 from utils.agent_transfer_utils import portable_tool_params, validate_import_tool_params
 from services.agent_version_service import publish_version_impl
+from consts.agent_repository import STATUS_PENDING_REVIEW, STATUS_REJECTED, STATUS_SHARED
 from consts.const import TOOL_TYPE_MAPPING, \
     MODEL_CONFIG_MAPPING, CAN_EDIT_ALL_USER_ROLES, PERMISSION_PRIVATE
 from consts.exceptions import (
@@ -67,6 +68,7 @@
 )
 from database import skill_db
 from management.services.skill.service import SkillService
+from database.agent_repository_db import list_agent_repository_by_agent_ids
 from database.agent_version_db import batch_search_version_names, query_version_list
 from database.group_db import query_group_ids_by_user
 from database.user_tenant_db import get_user_tenant_by_user_id
@@ -922,6 +924,7 @@ async def list_all_agent_info_impl(
 async def list_agent_page_impl(
     tenant_id: str,
     user_id: str,
+    caller_tenant_id: Optional[str] = None,
     permission: Optional[str] = None,
     tag: Optional[str] = None,
     search: Optional[str] = None,
@@ -932,6 +935,7 @@ async def list_agent_page_impl(
     created_by_not: Optional[str] = None,
     tag_predicates: Optional[list] = None,
     search_tag_predicates: Optional[list] = None,
+    include_repository_info: bool = False,
 ) -> Dict[str, Any]:
     """List visible agents with server-side filters and pagination."""
     if created_by and created_by_not:
@@ -1127,6 +1131,72 @@ async def list_agent_page_impl(
             )
             agent["version_label"] = version.get("version_name")
             agent["version_create_time"] = version.get("create_time")
+    if include_repository_info:
+        for scope_tenant_id in tenant_ids:
+            scoped_agents = [
+                agent for scope, agent in paged_scoped_agents
+                if scope == scope_tenant_id
+            ]
+            if not scoped_agents:
+                continue
+            scoped_agent_ids = [int(agent["agent_id"]) for agent in scoped_agents]
+            shared_records = list_agent_repository_by_agent_ids(
+                scoped_agent_ids,
+                statuses=(STATUS_SHARED,),
+                publisher_tenant_id=scope_tenant_id,
+            )
+            publisher_records = []
+            if scope_tenant_id == caller_tenant_id and user_role == "ADMIN":
+                publisher_records = list_agent_repository_by_agent_ids(
+                    scoped_agent_ids,
+                    statuses=(STATUS_PENDING_REVIEW, STATUS_REJECTED, STATUS_SHARED),
+                    publisher_tenant_id=scope_tenant_id,
+                )
+            elif scope_tenant_id == caller_tenant_id and user_role == "DEV":
+                publisher_records = list_agent_repository_by_agent_ids(
+                    scoped_agent_ids,
+                    statuses=(STATUS_PENDING_REVIEW, STATUS_REJECTED, STATUS_SHARED),
+                    publisher_tenant_id=scope_tenant_id,
+                    publisher_user_id=user_id,
+                )
+            records_by_id = {
+                int(record["agent_repository_id"]): (record, False)
+                for record in shared_records
+                if record["status"] == STATUS_SHARED
+            }
+            records_by_id.update({
+                int(record["agent_repository_id"]): (record, True)
+                for record in publisher_records
+            })
+            repository_by_agent_id: dict[int, list[dict]] = {}
+            for record, is_publisher in records_by_id.values():
+                created_at = record.get("create_time")
+                repository_by_agent_id.setdefault(int(record["agent_id"]), []).append(
+                    {
+                        "agent_repository_id": record["agent_repository_id"],
+                        "status": record["status"],
+                        "version_no": record["version_no"],
+                   
```

**File**: `frontend/app/[locale]/agent-space/components/MyAgentCard.tsx` (modified, +25/-38)
```diff
@@ -1,9 +1,7 @@
 "use client";
 
-import { Button, Dropdown, Spin, Tooltip } from "antd";
+import { Button, Dropdown, Tooltip } from "antd";
 import type { MenuProps } from "antd";
-import { useState } from "react";
-import { useAgentRepositoryListings } from "@/hooks/agentRepository/useAgentRepositoryListings";
 import {
   ClipboardCheck,
   Clock,
@@ -21,7 +19,7 @@ import { getUnavailableReasonLabels } from "@/lib/agentLabelMapper";
 import {
   formatMineDate,
   getMineCardMenuActions,
-  toMineRepositoryInfo,
+  getMineCardRepositoryStatusBadge,
   type MineCardMenuAction,
 } from "@/lib/agentRepositoryMine";
 import type { MyEditableAgentItem } from "@/types/agentRepository";
@@ -69,16 +67,6 @@ export function MyAgentCard({
   isDeleting = false,
 }: MyAgentCardProps) {
   const { t } = useTranslation("common");
-  const [menuOpen, setMenuOpen] = useState(false);
-  const {
-    data: listingData,
-    isLoading: isListingLoading,
-    isError: isListingError,
-    refetch,
-  } = useAgentRepositoryListings(
-    { agent_id: agent.agent_id, page: 1, page_size: 100 },
-    menuOpen || guideMenuOpen === true
-  );
 
   const title = agent.name?.trim() || t("agentRepository.card.untitled");
   const description =
@@ -88,8 +76,6 @@ export function MyAgentCard({
     agent.unavailable_reasons ?? [],
     t
   );
-  const repositoryInfo = toMineRepositoryInfo(listingData?.items ?? []);
-  const agentWithRepository = { ...agent, repository_info: repositoryInfo };
   const { canOpen: published } = getAgentUsageGuideAccess({
     currentVersionNo: agent.current_version_no,
     permission: agent.permission,
@@ -99,9 +85,10 @@ export function MyAgentCard({
   const canEdit = agent.permission !== "READ_ONLY";
   const canView = (agent.current_version_no ?? 0) > 0;
   const canEvaluate = canView;
-  const menuActions = listingData
-    ? getMineCardMenuActions(agentWithRepository)
-    : [];
+  const menuActions = getMineCardMenuActions(agent);
+  const repositoryBadge = getMineCardRepositoryStatusBadge(
+    agent.repository_info
+  );
 
   const menuItems: MenuProps["items"] = menuActions.map((action) => {
     const icon =
@@ -122,29 +109,13 @@ export function MyAgentCard({
           return;
         }
         onViewReview(
-          agentWithRepository,
+          agent,
           action === "reviewUpdate" ? "reviewUpdate" : "review"
         );
       },
     };
   });
 
-  if (isListingLoading) {
-    menuItems.unshift({
-      key: "loading",
-      label: <Spin size="small" />,
-      disabled: true,
-    });
-  } else if (isListingError) {
-    menuItems.unshift({
-      key: "retry",
-      label: t("repository.common.retry"),
-      onClick: () => {
-        void refetch();
-      },
-    });
-  }
-
   if (canEvaluate) {
     menuItems.push({
       key: "evaluate",
@@ -223,7 +194,7 @@ export function MyAgentCard({
             <Dropdown
               menu={{ items: menuItems }}
               open={guideMenuOpen}
-              onOpenChange={onGuideMenuOpenChange ?? setMenuOpen}
+              onOpenChange={onGuideMenuOpenChange}
               trigger={["click"]}
             >
               <Button
@@ -236,7 +207,23 @@ export function MyAgentCard({
               />
             </Dropdown>
           ) : null}
-          <div className="flex items-center gap-1.5">
+          <div className="flex flex-wrap items-center justify-end gap-1.5">
+            {repositoryBadge ? (
+              <span
+                className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
+                  repositoryBadge.variant === "pending"
+                    ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
+                    : repositoryBadge.variant === "rejected"
+                      ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
+                      : "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
+                }`}
+              >
+             
```

**File**: `frontend/app/[locale]/agent-space/my-agent.tsx` (modified, +3/-10)
```diff
@@ -158,6 +158,7 @@ export function MyAgent({
     (): AgentListFilters => ({
       tenantId: user?.tenantId ?? null,
       enabled: active,
+      includeRepositoryInfo: true,
       page,
       pageSize,
       search: searchQuery.trim() || undefined,
@@ -697,15 +698,7 @@ export function MyAgent({
             }`}
           >
             {t(ownershipLabelKey[filter])}
-            <span
-              className={`rounded px-1.5 text-xs ${
-                ownership === filter
-                  ? "bg-white/20"
-                  : "bg-white/70 text-slate-500 dark:bg-slate-900/50 dark:text-slate-400"
-              }`}
-            >
-              {counts[filter]}
-            </span>
+            <span className="text-xs opacity-80">{counts[filter]}</span>
           </button>
         ))}
       </div>
@@ -888,7 +881,7 @@ function toMyAgentItem(agent: Agent): MyEditableAgentItem {
     version_create_time: agent.version_create_time ?? null,
     permission: agent.permission,
     tags: agent.tags,
-    repository_info: [],
+    repository_info: agent.repository_info ?? [],
   };
 }
 
```

---

### Incident Patch 8: `a5b16754` (2026-09-28)
**Commit Message**: Fix: AIDP document list history merge, processing order and creation time (#4016)

* Fix: keep ingested AIDP documents visible when the channel history is used

The document list switched data sources instead of combining them: while the
resolved channel directory was empty the list was served from the knowledge-base
scoped listing, and as soon as one upload landed in that directory the all-status
history took over. The history only covers the resolved channel directory, so
every file ingested into another directory disappeared from the list right after
an upload — reported on 2.6.1 for files that were created before the upgrade.

Merge the two sources instead:

- The knowledge-base scoped listing guarantees membership, the history supplies
  the live statuses, and a file only the history knows about (still uploading,
  or failed before ingestion) is kept exactly as reported.
- Items are matched through every identity they expose, so a file that one
  payload describes with a uuid and the other with an ino number stays one row.
- Files taken from the listing are marked COMPLETED, which is all that listing
  ever returns.

The listing is read in pages of 100, capped at 20 pages, and

**File**: `backend/ext_components/aidp/apps/aidp_mgmt_app.py` (modified, +325/-28)
```diff
@@ -86,7 +86,9 @@
 # every other reported status is counted as work in progress: `processing_count`
 # is what keeps the frontend polling, and a build that reports a stage we do not
 # know yet must not stop it early either.
-_TERMINAL_DOC_STATUSES = ("COMPLETED", "FAILED")
+_DOC_STATUS_COMPLETED = "COMPLETED"
+_DOC_STATUS_FAILED = "FAILED"
+_TERMINAL_DOC_STATUSES = (_DOC_STATUS_COMPLETED, _DOC_STATUS_FAILED)
 
 
 def _upload_failure(file_name: str, reason_zh: str, reason_en: str) -> dict:
@@ -404,6 +406,112 @@ def _resolve_doc_history_channel(
     return channel
 
 
+# How many history pages one document-list request may read. The endpoint is
+# paginated and puts files that are still being processed in front, so a burst
+# of simultaneous uploads can spill past the first page.
+_HISTORY_PAGE_LIMIT = 20
+
+
+def _history_reports_more(payload: dict) -> bool | None:
+    """Whether the payload explicitly says another history page exists.
+
+    Only unambiguous signals are trusted: this endpoint family reports
+    ``total_count`` as the size of the current page elsewhere, so it cannot be
+    read as a grand total. ``None`` means the payload does not say, and the
+    caller has to ask for the next page to find out.
+    """
+    has_more = payload.get("has_more")
+    if isinstance(has_more, bool):
+        return has_more
+    if "next_link" in payload:
+        return bool(payload.get("next_link"))
+    return None
+
+
+async def _load_doc_history_items(
+    server_url: str,
+    api_key: str,
+    kds_id: str,
+    fs_id: str,
+    dir_path: str,
+) -> list[dict]:
+    """Read the channel directory's all-status history across its pages.
+
+    Reading only the first page would drop precisely the files this listing
+    exists to show: the endpoint sorts files that are still being processed to
+    the front, so more simultaneous uploads than fit in a page push the rest out
+    of view.
+
+    The walk stops at an empty page, stops when the payload says there is no
+    further page, and stops when a page adds nothing new — the last one keeps a
+    build that ignores ``page`` from looping over the same files. It is capped
+    at ``_HISTORY_PAGE_LIMIT`` so one list request cannot turn into an unbounded
+    number of upstream calls; reaching the cap is logged because the files
+    beyond it are then unknown.
+    """
+    collected: list[dict] = []
+    seen: set[str] = set()
+    for page in range(1, _HISTORY_PAGE_LIMIT + 1):
+        payload = await run_blocking(
+            "aidp-doc-history",
+            list_aidp_doc_history_impl,
+            server_url,
+            api_key,
+            fs_id,
+            dir_path,
+            kds_id,
+            None,
+            page,
+            lane="control-io",
+            owner="config",
+        )
+        raw_items = payload.get("value") if isinstance(payload, dict) else None
+        page_items = (
+            [item for item in raw_items if isinstance(item, dict)]
+            if isinstance(raw_items, list)
+            else []
+        )
+        if not page_items:
+            return collected
+
+        added = 0
+        for item in page_items:
+            identities = _document_identities(item)
+            key = identities[0] if identities else f"anonymous-{page}-{len(collected)}"
+            if key in seen:
+                continue
+            seen.add(key)
+            collected.append(item)
+            added += 1
+
+        reported_more = (
+            _history_reports_more(payload) if isinstance(payload, dict) else None
+        )
+        if reported_more is False:
+            return collected
+        if added == 0:
+            # The same page came back again, so this build does not honour
+            # `page`: stop instead of looping over the same files, but say so,
+            # because everything beyond the first page stays invisible.
+            logger.warning(
+                "AIDP file history for KB %s answered page %d without 
```

**File**: `backend/ext_components/aidp/services/aidp_service.py` (modified, +71/-12)
```diff
@@ -241,20 +241,68 @@ def _extract_list_payload(payload: Any) -> list | None:
     return None
 
 
+def _timestamp_or_iso(value: Any) -> str | None:
+    """Return an ISO-8601 string for a Unix timestamp or an already-ISO value.
+
+    AIDP spells the creation time two ways: the document listing reports
+    ``first_upload_time`` / ``create_time`` as Unix seconds, while the
+    knowledge-file history already sends the canonical ``created_at`` as an ISO
+    string. Both spellings have to survive normalization, otherwise the history
+    rows lose a column the listing rows keep.
+    """
+    if isinstance(value, str):
+        text = value.strip()
+        if not text:
+            return None
+        try:
+            float(text)
+        except ValueError:
+            # Already an ISO-8601 string: keep it verbatim.
+            return text
+        value = text
+    return _timestamp_to_iso(value)
+
+
+# Spellings AIDP uses for a document timestamp, in priority order. The history
+# endpoint sends the canonical ``created_at``, the listing reports the upload
+# stamp, and ``update_time`` closes the chain because a file AIDP has not
+# finished registering yet reports no creation time at all — for a freshly
+# uploaded file the update stamp is the moment it was accepted, which beats
+# leaving the column empty.
+_CREATED_AT_KEYS = ("first_upload_time", "create_time", "created_at", "update_time")
+_UPDATED_AT_KEYS = ("update_time", "updated_at")
+
+
+def _first_reported(raw: Dict[str, Any], keys: tuple[str, ...]) -> Any:
+    """Return the first value ``raw`` reports for ``keys``, skipping blanks.
+
+    ``None``, an empty string and ``False`` all mean "not reported": AIDP sends
+    any of them for unset fields. Treating the blank spelling as a value would
+    shadow the next key in the chain, which is how an empty ``create_time`` hid a
+    populated ``created_at`` and left the creation time null.
+    """
+    for key in keys:
+        value = raw.get(key)
+        if value is None or value == "" or value is False:
+            continue
+        return value
+    return None
+
+
 def _normalize_aidp_doc(raw: Dict[str, Any]) -> Dict[str, Any]:
     """Map an AIDP document item to the shape the frontend expects.
 
-    AIDP returns ``first_upload_time`` / ``create_time`` as the creation timestamp
-    and ``update_time`` as the last-modified timestamp. The frontend schema
-    expects ``created_at`` (ISO string). This mapper performs that conversion
-    and carries through all other fields unchanged.
+    AIDP spells the timestamps several ways: the document listing reports
+    ``first_upload_time`` / ``create_time`` as Unix seconds, while the
+    knowledge-file history already sends the canonical ``created_at`` as an ISO
+    string, and either side may send an unset field as ``""``. Both spellings
+    therefore have to be accepted, and blank ones skipped, so a history row keeps
+    the creation time instead of losing it here. All other fields are carried
+    through unchanged.
     """
     out = dict(raw)
-    created_raw = raw.get("first_upload_time") or raw.get("create_time")
-    out["created_at"] = _timestamp_to_iso(created_raw)
-
-    updated_raw = raw.get("update_time")
-    out["updated_at"] = _timestamp_to_iso(updated_raw)
+    out["created_at"] = _timestamp_or_iso(_first_reported(raw, _CREATED_AT_KEYS))
+    out["updated_at"] = _timestamp_or_iso(_first_reported(raw, _UPDATED_AT_KEYS))
     return out
 
 
@@ -1732,18 +1780,25 @@ def list_aidp_doc_history_impl(
     dir_path: str,
     kds_id: str,
     tenant_id: str | None = None,
+    page: int = 1,
 ) -> Dict[str, Any]:
-    """List every file in a channel directory regardless of processing status.
+    """List a page of a channel directory regardless of processing status.
 
     Endpoint: ``POST /KnowledgeBase/Tenants/{tenant}/KnowledgeBases/{kds_id}/KnowledgeFiles/History``
-    Body: ``{"fs_id": <str>, "dir_path": <str>}``
+    Body: ``{"fs_id": <str
```

**File**: `test/ext_components/aidp/mock_servers/aidp_mgmt_mock_server.py` (modified, +46/-3)
```diff
@@ -24,6 +24,10 @@
     non-terminal ``UPLOADING`` / ``EXTRACTING`` stages.
   * ``GET .../KnowledgeFiles`` keeps returning COMPLETED documents only (mirrors
     real AIDP), while ``POST .../KnowledgeFiles/History`` returns every status.
+  * ``POST .../KnowledgeFiles/History`` is paginated (body ``page``, ten entries
+    per page) and lists files that are still being processed first, so a burst of
+    simultaneous uploads spills onto the next page and the caller has to walk the
+    pages. Tune the page size with ``POST /_mock/history-page-size?size=N``.
 
 Knowledge base + document state is persisted to ``_state/knowledge_bases.json``
 (next to this file). On restart the mock loads the file, so KBs created by
@@ -90,6 +94,10 @@
 # Overridable at runtime through POST /_mock/processing-seconds.
 _PROCESSING_SECONDS = 8.0
 
+# Entries one history page returns. Real AIDP pages the channel directory, so the
+# backend has to walk the pages; keep this small to exercise that locally.
+_HISTORY_PAGE_SIZE = 10
+
 # Directory for persisted runtime state. Lives next to this file so the mock
 # is self-contained (no absolute paths) and stays out of version control via
 # ``.gitignore``. Only KB + document state is persisted; failure-injection
@@ -343,6 +351,7 @@ class DocHistoryBody(BaseModel):
 
     fs_id: Optional[str] = None
     dir_path: Optional[str] = None
+    page: int = 1
 
 
 class DocStatusBody(BaseModel):
@@ -489,6 +498,21 @@ def set_processing_seconds(
     return JSONResponse(content={"processing_seconds": _PROCESSING_SECONDS})
 
 
+@app.post("/_mock/history-page-size")
+def set_history_page_size(
+    size: int = Query(10, ge=1, le=1000, description="Entries returned per history page"),
+) -> JSONResponse:
+    """Tune how many entries one history page returns.
+
+    Set it to 1 to make every file land on its own page, which is how the
+    multi-page walk is exercised locally.
+    """
+    global _HISTORY_PAGE_SIZE
+    _HISTORY_PAGE_SIZE = size
+    logger.info("MOCK CONFIG  history page size = %s", size)
+    return JSONResponse(content={"history_page_size": _HISTORY_PAGE_SIZE})
+
+
 @app.post("/_mock/doc-status")
 def force_doc_status(body: DocStatusBody) -> JSONResponse:
     """Force one document into a given status (used to render a stage in the UI)."""
@@ -965,11 +989,30 @@ def knowledge_file_history(
         }
         for doc in _DOCUMENTS_BY_KB.get(kds_id, [])
     ]
+    # Real AIDP lists files that are still being processed first and pages the
+    # directory, which is what lets more simultaneous uploads than fit in one
+    # page spill onto the next. Mirrored here, so a caller that reads only the
+    # first page is caught locally instead of in production. The sort is stable,
+    # so documents keep their insertion order inside each group.
+    items.sort(key=lambda item: item["status"] in _TERMINAL_STATUSES)
+    page = body.page if isinstance(body.page, int) and body.page > 0 else 1
+    start = (page - 1) * _HISTORY_PAGE_SIZE
+    end = start + _HISTORY_PAGE_SIZE
+    page_items = items[start:end]
+    next_link = (
+        f"{_KB_PREFIX}/{kds_id}/KnowledgeFiles/History?page={page + 1}"
+        if end < len(items)
+        else None
+    )
     logger.info(
-        "FILE HISTORY  kds_id=%s fs_id=%s dir_path=%s returned=%d",
-        kds_id, body.fs_id, body.dir_path, len(items),
+        "FILE HISTORY  kds_id=%s fs_id=%s dir_path=%s page=%d returned=%d total=%d",
+        kds_id, body.fs_id, body.dir_path, page, len(page_items), len(items),
     )
-    return JSONResponse(content={"value": items})
+    return JSONResponse(content={
+        "value": page_items,
+        "total_count": len(items),
+        "next_link": next_link,
+    })
 
 
 # =============================================================================
```

**File**: `test/ext_components/aidp/test_aidp_mgmt_app.py` (modified, +418/-13)
```diff
@@ -1605,7 +1605,8 @@ def test_history_source_report_statuses_and_processing_count(self):
                           return_value=self._CHANNELS), \
              patch.object(aidp_mgmt_app, "list_aidp_doc_history_impl",
                           return_value=history) as mock_history, \
-             patch.object(aidp_mgmt_app, "list_aidp_docs_impl") as mock_completed, \
+             patch.object(aidp_mgmt_app, "list_aidp_docs_impl",
+                          return_value={"value": []}) as mock_completed, \
              patch.object(aidp_mgmt_app, "count_aidp_docs_impl") as mock_count:
             response = client.get(
                 "/aidp-mgmt/knowledge-bases/kb-1/documents",
@@ -1625,16 +1626,287 @@ def test_history_source_report_statuses_and_processing_count(self):
         assert body["has_more"] is False
         assert body["total_reliable"] is True
         assert body["processing_count"] == 1
-        # The history payload is authoritative: the completed-files listing and
-        # its Count endpoint must not be hit at all.
-        mock_history.assert_called_once()
-        # The call carries the resolved channel plus the KB the path is scoped to.
-        assert mock_history.call_args.args[2:] == (
-            "fs-1", "/aidp/knowledge/kb-1", "kb-1",
+        # The history decides the statuses, but the knowledge-base scoped
+        # listing is still read: the history only covers the resolved channel
+        # directory, so it cannot decide membership on its own.
+        # The history is walked page by page; this stub answers every page with
+        # the same file set, so the walk stops at the page that adds nothing new
+        # instead of looping over it.
+        assert [entry.args[6] for entry in mock_history.call_args_list] == [1, 2]
+        assert mock_history.call_args_list[0].args[2:] == (
+            "fs-1", "/aidp/knowledge/kb-1", "kb-1", None, 1,
         )
-        mock_completed.assert_not_called()
+        mock_completed.assert_called_once()
+        assert mock_completed.call_args.args[2:] == ("kb-1", 1, 100)
+        # The merged set is complete in one pass, so Count is never needed.
         mock_count.assert_not_called()
 
+    def test_files_ingested_outside_the_channel_directory_stay_visible(self):
+        """A directory-scoped history must not hide files ingested elsewhere.
+
+        The regression this guards: while the resolved channel directory is
+        empty the list is served from the knowledge-base scoped listing, and as
+        soon as one upload lands in that directory the history takes over and
+        every file from another directory disappears.
+        """
+        client = _client()
+        from ext_components.aidp.apps import aidp_mgmt_app
+        from ext_components.aidp.services import aidp_permission_service
+
+        history = {
+            "value": [
+                {"file_uuid": "uuid-new", "file_ino_no": "f-new",
+                 "file_name": "new.pdf", "first_upload_time": 1718000900,
+                 "status": "UPLOADING"},
+            ]
+        }
+        listing = {
+            "value": [
+                {"file_ino_no": "f-legacy-a", "file_name": "legacy-a.txt",
+                 "create_time": 1718000000},
+                {"file_ino_no": "f-legacy-b", "file_name": "legacy-b.txt",
+                 "create_time": 1718000100},
+                {"file_ino_no": "f-new", "file_name": "new.pdf",
+                 "create_time": 1718000900},
+            ]
+        }
+
+        with patch.object(aidp_permission_service, "require_permission",
+                          return_value=self._read_only()), \
+             patch.object(aidp_mgmt_app, "get_cached_aidp_channels",
+                          return_value=self._CHANNELS), \
+             patch.object(aidp_mgmt_app, "list_aidp_doc_history_impl",
+                          return_value=history), \
+             patch.object(aidp_mgmt_app, "list_aidp_docs_impl",
+                         
```

**File**: `test/ext_components/aidp/test_aidp_service.py` (modified, +53/-0)
```diff
@@ -914,6 +914,58 @@ def test_falls_back_to_create_time(self, normalize):
         result = normalize({"create_time": 1700000000})
         assert result["created_at"] is not None
 
+    def test_keeps_an_iso_created_at_the_payload_reports(self, normalize):
+        """The history endpoint already spells the creation time ``created_at``."""
+        result = normalize({"created_at": "2024-06-10T06:20:00Z", "file_name": "a.txt"})
+        assert result["created_at"] == "2024-06-10T06:20:00Z"
+        assert result["file_name"] == "a.txt"
+
+    def test_keeps_an_iso_updated_at_the_payload_reports(self, normalize):
+        result = normalize({"updated_at": "2024-06-10T06:20:00Z"})
+        assert result["updated_at"] == "2024-06-10T06:20:00Z"
+
+    def test_numeric_upload_time_wins_over_a_reported_created_at(self, normalize):
+        """A listing row reports both; the upload timestamp stays authoritative."""
+        result = normalize({
+            "first_upload_time": 1700000000,
+            "created_at": "2024-06-10T06:20:00Z",
+        })
+        assert "2023-11-14" in result["created_at"]
+
+    def test_numeric_string_timestamp_is_converted(self, normalize):
+        result = normalize({"created_at": "1700000000"})
+        assert "2023-11-14" in result["created_at"]
+
+    def test_history_item_keeps_its_created_at(self, aidp_service_module):
+        """Regression: the history's ``created_at`` used to be blanked to null."""
+        result = aidp_service_module._normalize_history_doc({
+            "file_uuid": "uuid-1",
+            "created_at": "2024-06-10T06:20:00Z",
+            "status": "uploading",
+        })
+        assert result["created_at"] == "2024-06-10T06:20:00Z"
+        assert result["status"] == "UPLOADING"
+
+    def test_empty_create_time_does_not_hide_a_reported_created_at(self, normalize):
+        """A blank ``create_time`` means "not reported", not a value to keep."""
+        result = normalize({
+            "create_time": "",
+            "created_at": "2024-06-10T06:20:00Z",
+            "update_time": 1700000000,
+        })
+        assert result["created_at"] == "2024-06-10T06:20:00Z"
+        assert "2023-11-14" in result["updated_at"]
+
+    def test_empty_first_upload_time_does_not_hide_create_time(self, normalize):
+        result = normalize({"first_upload_time": "", "create_time": 1700000000})
+        assert "2023-11-14" in result["created_at"]
+
+    def test_falls_back_to_update_time_when_no_creation_time_is_reported(self, normalize):
+        """A file AIDP has not registered yet reports only its update time."""
+        result = normalize({"update_time": 1700000000})
+        assert result["created_at"] is not None
+        assert result["created_at"] == result["updated_at"]
+
     def test_uses_update_time_for_updated_at(self, normalize):
         result = normalize({"update_time": 1700000000, "first_upload_time": 1600000000})
         assert result["updated_at"] is not None
@@ -2825,6 +2877,7 @@ def test_success_posts_body_and_normalizes_status(self, aidp_service_module):
         assert call_args.kwargs["json"] == {
             "fs_id": "fs-1",
             "dir_path": "/aidp/knowledge/kb-1",
+            "page": 1,
         }
         assert call_args.kwargs["headers"]["Authorization"] == "Bearer jwt-token"
 
```

---

### Incident Patch 9: `4e8aca76` (2026-09-28)
**Commit Message**: release(v2.7.0): sync main hotfix history, consolidate SQL migrations, bump version (#4024)

* merge v2.6.1 hotfix release from hotfix/v2.6.1 (#3971)

* 🐛 Fix(evaluation): run trials in runtime service (#3954)

* fix(evaluation): run trials in runtime service

Route trial evaluations through the authenticated Config-to-Runtime proxy and use Config's manager only for creation-stage preparation. Keep Agent execution and evaluator scoring in Runtime.

Co-authored-by: Codex <noreply@openai.com>

Generated-by: gpt-5

* test(evaluation): stub config thread manager

Keep pure-logic service import tests aligned with the Config and Runtime thread-manager split.

Co-authored-by: Codex <noreply@openai.com>

Generated-by: gpt-5

* test(evaluation): stub runtime jwt helper

* test(evaluation): cover trial proxy error paths

* Fix/override delete (#3958)

* Fix: override dialog only shows override values, not model defaults (deleted params no longer reappear)

* Fix: custom param deletion persists (null markers), per-agent capacity overrides take effect, and edit-dialog connectivity probe uses stored api_key

* Fix: rename ModelRequest.model_id to probe_model_id - model_dump() is spread into IN

**File**: `VERSION` (modified, +1/-1)
```diff
@@ -1 +1 @@
-v2.6.0
+v2.7.0
```

**File**: `deploy/sql/migrations/README.md` (modified, +5/-3)
```diff
@@ -35,9 +35,11 @@ COLUMN IF NOT EXISTS`, and conflict-safe inserts where possible.
 Historical migrations through v2.4.0 are consolidated by minor version in
 `v2.2_merged_migrations.sql`, `v2.3_merged_migrations.sql`, and
 `v2.4_merged_migrations.sql`, and migrations since v2.4.0 are consolidated in
-`v2.5.0_merged_migrations.sql` and `v2.6.0_merged_migrations.sql` (which merges
-all migrations applied after the v2.5.1 release, through v2.6.0). Newer
-migrations remain separate until their minor-version history is consolidated.
+`v2.5.0_merged_migrations.sql`, `v2.6.0_merged_migrations.sql` (which merges
+all migrations applied after the v2.5.1 release, through v2.6.0), and
+`v2.7.0_merged_migrations.sql` (which merges all migrations applied after
+the v2.6.1 release, through v2.7.0). Newer migrations remain separate until
+their minor-version history is consolidated.
 
 Important: do NOT modify a `*_merged_migrations.sql` file after it has been
 deployed. Because it bundles many historical migrations, even a comment-only
```

**File**: `deploy/sql/migrations/v2.6.0_z_agent_repository_icon_url.sql` (removed, +0/-23)
```diff
@@ -1,23 +0,0 @@
--- Repository listings now store an optional uploaded image URL. Legacy emoji
--- values fall back to the deterministic agent icon after this migration.
-DO $$
-BEGIN
-  IF EXISTS (
-    SELECT 1 FROM information_schema.columns
-    WHERE table_schema = 'nexent' AND table_name = 'ag_agent_repository_t'
-      AND column_name = 'icon'
-  ) AND NOT EXISTS (
-    SELECT 1 FROM information_schema.columns
-    WHERE table_schema = 'nexent' AND table_name = 'ag_agent_repository_t'
-      AND column_name = 'icon_url'
-  ) THEN
-    ALTER TABLE nexent.ag_agent_repository_t RENAME COLUMN icon TO icon_url;
-    UPDATE nexent.ag_agent_repository_t SET icon_url = NULL;
-  END IF;
-END $$;
-
-ALTER TABLE nexent.ag_agent_repository_t
-  ALTER COLUMN icon_url TYPE VARCHAR(1024);
-
-COMMENT ON COLUMN nexent.ag_agent_repository_t.icon_url IS
-  'Repository icon URL; NULL uses the agent ID based default icon';
```

**File**: `deploy/sql/migrations/v2.6.1_001_remove_human_interaction.sql` (removed, +0/-8)
```diff
@@ -1,8 +0,0 @@
--- Deploy only after all processes using the retired interaction engine have stopped.
--- Ordinary conversation messages and units are intentionally preserved.
-DROP TABLE IF EXISTS nexent.human_event_t;
-DROP TABLE IF EXISTS nexent.human_execution_t;
-DROP TABLE IF EXISTS nexent.human_request_t;
-DROP TABLE IF EXISTS nexent.human_run_t;
--- This function is used exclusively by the four tables removed above.
-DROP FUNCTION IF EXISTS nexent.human_interaction_audit_timestamp();
```

**File**: `deploy/sql/migrations/v2.6.1_002_remove_dev_models_menu.sql` (removed, +0/-10)
```diff
@@ -1,10 +0,0 @@
--- Remove the model management page from the DEV role menu.
--- Developers must not see or manage models; they only consume
--- administrator-configured models. RESOURCE MODEL READ is kept so
--- model pickers in agent editing keep working.
--- Pattern follows v2.3 migration that removed ASSET_OWNER /owner-manage.
-DELETE FROM nexent.role_permission_t
-WHERE user_role = 'DEV'
-  AND permission_category = 'VISIBILITY'
-  AND permission_type = 'LEFT_NAV_MENU'
-  AND permission_subtype = '/models';
```

---

### Incident Patch 10: `b84fae3b` (2026-09-28)
**Commit Message**: fix(agent): 修复输出协议重试与流式显示（develop） (#4023)

* fix(agent): preserve model attempt streaming across semantic retries

(cherry picked from commit e38fd5039af23dc24db5afecd4f2bcf8383fb46b)

* feat(agent): make strict output repair opt-in per agent

* fix(agent): continue bare output and reinforce action protocol

* test(agent): keep context reminder fixture lint clean

* Restore legacy code action routing and accept final strict attempt

* Gate empty model response retries on strict code action mode

* Show a quiet final hint for legacy empty model responses

* test(agent): adapt protocol regression tests to develop

* fix(agent): align protocol tests and preserve guardrail user boundary

**File**: `backend/agents/create_agent_info.py` (modified, +1/-0)
```diff
@@ -1921,6 +1921,7 @@ async def create_agent_config(
         model_name=model_name,
         provide_run_summary=agent_info.get("provide_run_summary", False),
         allow_chat_metadata=agent_info.get("allow_chat_metadata", False),
+        enable_protocol_repair_retry=agent_info.get("enable_protocol_repair_retry") is True,
         managed_agents=managed_agents,
         external_a2a_agents=external_a2a_agents,
         context_manager_config=cm_config,
```

**File**: `backend/consts/model.py` (modified, +2/-0)
```diff
@@ -1325,6 +1325,7 @@ class AgentInfoRequest(BaseModel):
     group_ids: Optional[List[int]] = None
     ingroup_permission: Optional[str] = None
     enable_context_manager: Optional[bool] = None
+    enable_protocol_repair_retry: Optional[bool] = None
     is_a2a: Optional[bool] = None
     verification_config: Optional[Dict[str, Any]] = None
     context_policy: Optional[Dict[str, Any]] = None
@@ -1427,6 +1428,7 @@ class ExportAndImportAgentInfo(BaseModel):
     is_main_agent: bool = True
     provide_run_summary: bool
     allow_chat_metadata: bool = False
+    enable_protocol_repair_retry: bool = False
     verification_config: Optional[Dict[str, Any]] = None
     context_policy: Optional[Dict[str, Any]] = None
     duty_prompt: Optional[str] = None
```

**File**: `backend/database/agent_db.py` (modified, +2/-0)
```diff
@@ -272,6 +272,7 @@ def create_agent(agent_info, tenant_id: str, user_id: str):
     info_with_metadata.setdefault("context_policy", None)
     info_with_metadata.setdefault("model_params_override", None)
     info_with_metadata.setdefault("is_a2a", False)
+    info_with_metadata.setdefault("enable_protocol_repair_retry", False)
     info_with_metadata.update({
         "tenant_id": tenant_id,
         "version_no": 0,  # Default to draft version
@@ -309,6 +310,7 @@ def create_agent(agent_info, tenant_id: str, user_id: str):
             "is_main_agent": new_agent.is_main_agent,
             "provide_run_summary": new_agent.provide_run_summary,
             "allow_chat_metadata": bool(new_agent.allow_chat_metadata),
+            "enable_protocol_repair_retry": new_agent.enable_protocol_repair_retry,
             "business_description": new_agent.business_description,
             "business_logic_model_id": new_agent.business_logic_model_id,
             "business_logic_model_name": new_agent.business_logic_model_name,
```

**File**: `backend/database/db_models.py` (modified, +7/-0)
```diff
@@ -726,6 +726,13 @@ class AgentInfo(TableBase):
         ),
     )
     enable_context_manager = Column(Boolean, default=True, doc="Whether to enable context management (compression) for this agent")
+    enable_protocol_repair_retry = Column(
+        Boolean,
+        default=False,
+        server_default=text("false"),
+        nullable=False,
+        comment="Whether this agent uses strict output validation and silent protocol repair",
+    )
     is_a2a = Column(Boolean, default=False, nullable=False, doc="Whether to publish this agent as an A2A Server agent")
     verification_config = Column(JSONB, doc="Layered ReAct self-verification configuration")
     context_policy = Column(JSONB, doc="Agent-level context processing policy override")
```

**File**: `backend/management/services/agent/management.py` (modified, +3/-0)
```diff
@@ -530,6 +530,7 @@ async def export_agent_by_agent_id(
                                           is_main_agent=agent_info.get("is_main_agent", True),
                                           provide_run_summary=agent_info["provide_run_summary"],
                                           allow_chat_metadata=agent_info.get("allow_chat_metadata", False),
+                                          enable_protocol_repair_retry=agent_info.get("enable_protocol_repair_retry") is True,
                                           verification_config=agent_info.get("verification_config"),
                                           context_policy=agent_info.get("context_policy"),
                                           model_params_override=agent_info.get("model_params_override"),
@@ -698,6 +699,7 @@ async def import_agent_by_agent_id(
                                          "is_main_agent": getattr(import_agent_info, "is_main_agent", True),
                                          "provide_run_summary": import_agent_info.provide_run_summary,
                                          "allow_chat_metadata": import_agent_info.allow_chat_metadata,
+                                         "enable_protocol_repair_retry": getattr(import_agent_info, "enable_protocol_repair_retry", False),
                                          "verification_config": getattr(import_agent_info, "verification_config", None),
                                          "context_policy": getattr(import_agent_info, "context_policy", None),
                                          "model_params_override": getattr(import_agent_info, "model_params_override", None),
@@ -908,6 +910,7 @@ async def list_all_agent_info_impl(
                 "is_a2a_server": agent["agent_id"] in a2a_server_agent_ids,
                 "allow_chat_metadata": bool(agent.get("allow_chat_metadata", False)),
                 "model_params_override": agent.get("model_params_override"),
+                "enable_protocol_repair_retry": agent.get("enable_protocol_repair_retry") is True,
             })
 
         return simple_agent_list
```

#### Recent Merged Pull Requests:
- **PR #4049** (2026-09-30): docs: update third-party notices (#4048) (@WMC001)
- **PR #4048** (2026-09-30): docs: update third-party notices (@WMC001)
- **PR #4047** (2026-09-30): Release v2.7.0 merge (@jeffwu-1999)
- **PR #4045** (2026-09-30): Fix/default model backfill select best (@lijiayang619)
- **PR #4044** (2026-09-30): merge(main): merge v2.7.0 release from develop (@jeffwu-1999)
- **PR #4043** (2026-09-29): fix: let tenant admins manage models of their own tenant (@jeffwu-1999)
- **PR #4042** (2026-09-30): 🐛 Fix(evaluation): surface run delete errors and hide the delete button for unauthorized users (@cj2026-bit)
- **PR #4041** (2026-09-29): fix(frontend): handle agent name overflow and card tag layout (@xuyaqist)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
