# Forensic Learning Record (Deep Inspection): Jeffallan/claude-skills

> **Canonical Artifact**: `07_PROJECT_LEARNING/jeffallan-claude-skills-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Jeffallan/claude-skills](https://github.com/Jeffallan/claude-skills))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:29:32.098Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Jeffallan/claude-skills`
- **Description**: 67 Specialized Skills for Full-Stack Developers. Transform Claude Code into your expert pair programmer.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 11686 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.astro/content-assets.mjs`
```
export default new Map();
```

### Core Architecture Module: `.astro/content-modules.mjs`
```
export default new Map();
```

### Core Architecture Module: `.astro/content.d.ts`
```
declare module 'astro:content' {
	export interface RenderResult {
		Content: import('astro/runtime/server/index.js').AstroComponentFactory;
		headings: import('astro').MarkdownHeading[];
		remarkPluginFrontmatter: Record<string, any>;
	}
	interface Render {
		'.md': Promise<RenderResult>;
	}

	export interface RenderedContent {
		html: string;
		metadata?: {
			imagePaths: Array<string>;
			[key: string]: unknown;
		};
	}
}

declare module 'astro:content' {
	type Flatten<T> = T extends { [K: string]: infer U } ? U : never;

	export type CollectionKey = keyof AnyEntryMap;
	export type CollectionEntry<C extends CollectionKey> = Flatten<AnyEntryMap[C]>;

	export type ContentCollectionKey = keyof ContentEntryMap;
	export type DataCollectionKey = keyof DataEntryMap;

	type AllValuesOf<T> = T extends any ? T[keyof T] : never;
	type ValidContentEntrySlug<C extends keyof ContentEntryMap> = AllValuesOf<
		ContentEntryMap[C]
	>['slug'];

	export type ReferenceDataEntry<
		C extends CollectionKey,
		E extends keyof DataEntryMap[C] = string,
	> = {
		collection: C;
		id: E;
	};
	export type ReferenceContentEntry<
		C extends keyof ContentEntryMap,
		E extends ValidContentEntrySlug<C> | (string & {}) = string,
	> = {
		collection: C;
		slug: E;
	};
	export type ReferenceLiveEntry<C extends keyof LiveContentConfig['collections']> = {
		collection: C;
		id: string;
	};

	/** @deprecated Use `getEntry` instead. */
	export function getEntryBySlug<
		C extends keyof ContentEntryMap,
		E extends ValidContentEntrySlug<C> | (string & {}),
	>(
		collection: C,
		// Note that this has to accept a regular string too, for SSR
		entrySlug: E,
	): E extends ValidContentEntrySlug<C>
		? Promise<CollectionEntry<C>>
		: Promise<CollectionEntry<C> | undefined>;

	/** @deprecated Use `getEntry` instead. */
	export function getDataEntryById<C extends keyof DataEntryMap, E extends keyof DataEntryMap[C]>(
		collection: C,
		entryId: E,
	): Promise<CollectionEntry<C>>;

	export function getCollection<C extends keyof AnyEntryMap, E extends CollectionEntry<C>>(
		collection: C,
		filter?: (entry: CollectionEntry<C>) => entry is E,
	): Promise<E[]>;
	export function getCollection<C extends keyof AnyEntryMap>(
		collection: C,
		filter?: (entry: CollectionEntry<C>) => unknown,
	): Promise<CollectionEntry<C>[]>;

	export function getLiveCollection<C extends keyof LiveContentConfig['collections']>(
		collection: C,
		filter?: LiveLoaderCollectionFilterType<C>,
	): Promise<
		import('astro').LiveDataCollectionResult<LiveLoaderDataType<C>, LiveLoaderErrorType<C>>
	>;

	export function getEntry<
		C extends keyof ContentEntryMap,
		E extends ValidContentEntrySlug<C> | (string & {}),
	>(
		entry: ReferenceContentEntry<C, E>,
	): E extends ValidContentEntrySlug<C>
		? Promise<CollectionEntry<C>>
		: Promise<CollectionEntry<C> | undefined>;
	export function getEntry<
		C extends keyof DataEntryMap,
		E extends keyof DataEntryMap[C] | (string & {}),
	>(
		entry: ReferenceDataEntry<C, E>,
	): E extends keyof DataEntryMap[C]
		? Promise<DataEntryMap[C][E]>
		: Promise<CollectionEntry<C> | undefined>;
	export function getEntry<
		C extends keyof ContentEntryMap,
		E extends ValidContentEntrySlug<C> | (string & {}),
	>(
		collection: C,
		slug: E,
	): E extends ValidContentEntrySlug<C>
		? Promise<CollectionEntry<C>>
		: Promise<CollectionEntry<C> | undefined>;
	export function getEntry<
		C extends keyof DataEntryMap,
		E extends keyof DataEntryMap[C] | (string & {}),
	>(
		collection: C,
		id: E,
	): E extends keyof DataEntryMap[C]
		? string extends keyof DataEntryMap[C]
			? Promise<DataEntryMap[C][E]> | undefined
			: Promise<DataEntryMap[C][E]>
		: Promise<CollectionEntry<C> | undefined>;
	export function getLiveEntry<C extends keyof LiveContentConfig['collections']>(
		collection: C,
		filter: string | LiveLoaderEntryFilterType<C>,
	): Promise<import('astro').LiveDataEntryResult<LiveLoaderDataType<C>, LiveLoaderErrorType<C>>>;

	/** Resolve an array of entry references from the same collection */
	export function getEntries<C extends keyof ContentEntryMap>(
		entries: ReferenceContentEntry<C, ValidContentEntrySlug<C>>[],
	): Promise<CollectionEntry<C>[]>;
	export function getEntries<C extends keyof DataEntryMap>(
		entries: ReferenceDataEntry<C, keyof DataEntryMap[C]>[],
	): Promise<CollectionEntry<C>[]>;

	export function render<C extends keyof AnyEntryMap>(
		entry: AnyEntryMap[C][string],
	): Promise<RenderResult>;

	export function reference<C extends keyof AnyEntryMap>(
		collection: C,
	): import('astro/zod').ZodEffects<
		import('astro/zod').ZodString,
		C extends keyof ContentEntryMap
			? ReferenceContentEntry<C, ValidContentEntrySlug<C>>
			: ReferenceDataEntry<C, keyof DataEntryMap[C]>
	>;
	// Allow generic `string` to avoid excessive type errors in the config
	// if `dev` is not running to update as you edit.
	// Invalid collection names will be caught at build time.
	export function reference<C extends string>(
		collection: C,
	): import('astro/zod').ZodEffects<import('astro/zod').ZodString, never>;

	type ReturnTypeOrOriginal<T> = T extends (...args: any[]) => infer R ? R : T;
	type InferEntrySchema<C extends keyof AnyEntryMap> = import('astro/zod').infer<
		ReturnTypeOrOriginal<Required<ContentConfig['collections'][C]>['schema']>
	>;

	type ContentEntryMap = {
		
	};

	type DataEntryMap = {
		
	};

	type AnyEntryMap = ContentEntryMap & DataEntryMap;

	type ExtractLoaderTypes<T> = T extends import('astro/loaders').LiveLoader<
		infer TData,
		infer TEntryFilter,
		infer TCollectionFilter,
		infer TError
	>
		? { data: TData; entryFilter: TEntryFilter; collectionFilter: TCollectionFilter; error: TError }
		: { data: never; entryFilter: never; collectionFilter: never; error: never };
	type ExtractDataType<T> = ExtractLoaderTypes<T>['data'];
	type ExtractEntryFilterType<T> = ExtractLoaderTypes<T>['entryFilter'];
	type ExtractCollectionFilterType<T> = ExtractLoaderTypes<T>['collectionFilter'];
	type ExtractErrorType<T> = ExtractLoaderTypes<T>['error'];

	type LiveLoaderDataType<C extends keyof LiveContentConfig['collections']> =
		LiveContentConfig['collections'][C]['schema'] extends undefined
			? ExtractDataType<LiveContentConfig['collections'][C]['loader']>
			: import('astro/zod').infer<
					Exclude<LiveContentConfig['collections'][C]['schema'], undefined>
				>;
	type LiveLoaderEntryFilterType<C extends keyof LiveContentConfig['collections']> =
		ExtractEntryFilterType<LiveContentConfig['collections'][C]['loader']>;
	type LiveLoaderCollectionFilterType<C extends keyof LiveContentConfig['collections']> =
		ExtractCollectionFilterType<LiveContentConfig['collections'][C]['loader']>;
	type LiveLoaderErrorType<C extends keyof LiveContentConfig['collections']> = ExtractErrorType<
		LiveContentConfig['collections'][C]['loader']
	>;

	export type ContentConfig = typeof import("../src/content.config.mjs");
	export type LiveContentConfig = never;
}

```

### Core Architecture Module: `.astro/types.d.ts`
```
/// <reference types="astro/client" />
/// <reference path="content.d.ts" />
```

### Core Architecture Module: `assets/capture-screenshot.js`
```
const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.setViewport({ width: 1280, height: 640 });

  const htmlPath = path.join(__dirname, 'social-preview.html');
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });

  // Wait for fonts to load
  await new Promise((resolve) => setTimeout(resolve, 2000));

  await page.screenshot({
    path: path.join(__dirname, 'social-preview.png'),
    type: 'png',
    clip: { x: 0, y: 0, width: 1280, height: 640 },
  });

  console.log('Screenshot saved to assets/social-preview.png');
  await browser.close();
})();

```

### Core Architecture Module: `scripts/migrate-frontmatter.py`
```
#!/usr/bin/env python3
"""
Migrate skill SKILL.md frontmatter to Agent Skills spec-compliant structure.

Moves triggers, role, scope, output-format under metadata key.
Adds license, metadata.author, metadata.version, metadata.domain.

Usage:
    python scripts/migrate-frontmatter.py              # Migrate all skills
    python scripts/migrate-frontmatter.py --dry-run    # Preview changes
    python scripts/migrate-frontmatter.py --skill react-expert  # Single skill
    python scripts/migrate-frontmatter.py --related-skills       # Add related-skills metadata
    python scripts/migrate-frontmatter.py --related-skills --dry-run  # Preview related-skills
"""

import argparse
from pathlib import Path
import re
import sys

# Try to import PyYAML, fall back to simple parser if not available
try:
    import yaml

    HAS_PYYAML = True
except ImportError:
    HAS_PYYAML = False

SKILLS_DIR = Path("skills")

# Skill-to-domain mapping derived from SKILLS_GUIDE.md
SKILL_DOMAIN_MAP = {
    # language
    "python-pro": "language",
    "typescript-pro": "language",
    "javascript-pro": "language",
    "golang-pro": "language",
    "rust-engineer": "language",
    "sql-pro": "language",
    "cpp-pro": "language",
    "swift-expert": "language",
    "kotlin-specialist": "language",
    "csharp-developer": "language",
    "php-pro": "language",
    "java-architect": "language",
    # backend
    "nestjs-expert": "backend",
    "django-expert": "backend",
    "fastapi-expert": "backend",
    "spring-boot-engineer": "backend",
    "laravel-specialist": "backend",
    "rails-expert": "backend",
    "dotnet-core-expert": "backend",
    # frontend
    "react-expert": "frontend",
    "nextjs-developer": "frontend",
    "vue-expert": "frontend",
    "vue-expert-js": "frontend",
    "angular-architect": "frontend",
    "react-native-expert": "frontend",
    "flutter-expert": "frontend",
    # infrastructure
    "kubernetes-specialist": "infrastructure",
    "terraform-engineer": "infrastructure",
    "postgres-pro": "infrastructure",
    "cloud-architect": "infrastructure",
    "database-optimizer": "infrastructure",
    # api-architecture
    "graphql-architect": "api-architecture",
    "api-designer": "api-architecture",
    "websocket-engineer": "api-architecture",
    "microservices-architect": "api-architecture",
    "mcp-developer": "api-architecture",
    "architecture-designer": "api-architecture",
    # quality
    "test-master": "quality",
    "playwright-expert": "quality",
    "code-reviewer": "quality",
    "code-documenter": "quality",
    "debugging-wizard": "quality",
    # devops
    "devops-engineer": "devops",
    "monitoring-expert": "devops",
    "sre-engineer": "devops",
    "chaos-engineer": "devops",
    "cli-developer": "devops",
    # security
    "secure-code-guardian": "security",
    "security-reviewer": "security",
    "fullstack-guardian": "security",
    # data-ml
    "pandas-pro": "data-ml",
    "spark-engineer": "data-ml",
    "ml-pipeline": "data-ml",
    "prompt-engineer": "data-ml",
    "rag-architect": "data-ml",
    "fine-tuning-expert": "data-ml",
    # platform
    "salesforce-developer": "platform",
    "shopify-expert": "platform",
    "wordpress-pro": "platform",
    "atlassian-mcp": "platform",
    # specialized
    "legacy-modernizer": "specialized",
    "embedded-systems": "specialized",
    "game-developer": "specialized",
    # workflow
    "feature-forge": "workflow",
    "spec-miner": "workflow",
}


def parse_frontmatter(content: str) -> tuple[dict | None, str]:
    """Parse YAML frontmatter and return (frontmatter_dict, body).

    Returns (None, content) if no valid frontmatter found.
    """
    if not content.startswith("---"):
        return None, content

    parts = content.split("---", 2)
    if len(parts) < 3:
        return None, content

    yaml_str = parts[1]
    body = parts[2]

    if HAS_PYYAML:
        frontmatter = yaml.safe_load(yaml_str) or {}
    else:
        # Simple parser for basic key-value and list structures
        frontmatter = {}
        current_key = None
        current_list = None

        for line in yaml_str.strip().split("\n"):
            if not line.strip():
                continue
            if line.startswith("  - ") or line.startswith("    - "):
                if current_key and current_list is not None:
                    item = line.strip().lstrip("- ").strip()
                    current_list.append(item)
                continue
            if ":" in line and not line.startswith(" "):
                if current_key and current_list is not None:
                    frontmatter[current_key] = current_list
                key, _, value = line.partition(":")
                key = key.strip()
                value = value.strip()
                if not value:
                    current_key = key
                    current_list = []
                else:
                    frontmatter[key] = value
                    current_key = None
                    current_list = None

        if current_key and current_list is not None:
            frontmatter[current_key] = current_list

    return frontmatter, body


def build_new_frontmatter(fm: dict, skill_name: str) -> str:
    """Build spec-compliant YAML frontmatter string with controlled key order.

    Hand-constructs YAML to avoid yaml.dump() reordering keys.
    """
    lines = ["---"]

    # Top-level spec fields: name, description
    lines.append(f"name: {fm['name']}")

    # Description may contain special YAML characters, quote if needed
    desc = fm["description"]
    if any(c in desc for c in ":#{}[]|>&*!%@`"):
        lines.append(f'description: "{desc}"')
    else:
        lines.append(f"description: {desc}")

    # license (new)
    lines.append("license: MIT")

    # allowed-tools (spec field, kept top-level if present)
    if "allowed-tools" in fm:
        lines.append(f"allowed-tools: {fm['allowed-tools']}")

    # metadata block
    lines.append("metadata:")

    # metadata.author (new)
    lines.append("  author: https://github.com/Jeffallan")

    # metadata.version (new)
    lines.append('  version: "1.0.0"')

    # metadata.domain (new, from map)
    domain = SKILL_DOMAIN_MAP.get(skill_name, "unknown")
    lines.append(f"  domain: {domain}")

    # metadata.triggers (converted from array to comma-separated string)
    triggers = fm.get("triggers", [])
    triggers_str = ", ".join(triggers) if isinstance(triggers, list) else str(triggers)
    lines.append(f"  triggers: {triggers_str}")

    # metadata.role (moved from top-level)
    if "role" in fm:
        lines.append(f"  role: {fm['role']}")

    # metadata.scope (moved from top-level)
    if "scope" in fm:
        lines.append(f"  scope: {fm['scope']}")

    # metadata.output-format (moved from top-level)
    if "output-format" in fm:
        lines.append(f"  output-format: {fm['output-format']}")

    lines.append("---")

    return "\n".join(lines)


def extract_related_skills(body: str, valid_dirs: set[str]) -> str:
    """Extract related skill names from the ## Related Skills body section.

    Parses bold display names (e.g., **Fullstack Guardian**), converts to
    directory-name format (lowercase, spaces to hyphens), and filters to only
    names that exist as directories under skills/.

    Returns a comma-separated string of valid skill directory names,
    or empty string if none found.
    """
    # Find the ## Related Skills section
    match = re.search(r"## Related Skills\s*\n(.*?)(?=\n## |\Z)", body, re.DOTALL)
    if not match:
        return ""

    section = match.group(1)

    # Extract bold display names: **Name**
    display_names = re.findall(r"\*\*(.+?)\*\*", section)

    # Convert to directory-name format and filter to existing directories
    related = []
    for name in display_names:
        dir_name = name.lower().replace(" ", "-")
        if dir_name in valid_dirs:
            related.append(dir_name)

    return ", ".joi
```

### Core Architecture Module: `scripts/validate-markdown.py`
```
#!/usr/bin/env python3
"""
Validate markdown files for common parsing errors.

Checks for:
- HTML comments breaking tables
- Unclosed code blocks
- Missing table separator rows
- Inconsistent column counts in tables

Usage:
    python scripts/validate-markdown.py [--check] [--path PATH]
"""

import argparse
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path
import re
import sys


class IssueType(StrEnum):
    HTML_IN_TABLE = "html-in-table"
    UNCLOSED_CODE_BLOCK = "unclosed-code-block"
    MISSING_SEPARATOR = "missing-table-separator"
    COLUMN_MISMATCH = "column-count-mismatch"


@dataclass
class MarkdownIssue:
    file: Path
    line: int
    issue_type: IssueType
    message: str

    def __str__(self) -> str:
        return f"{self.file}:{self.line}: [{self.issue_type}] {self.message}"


def count_columns(line: str) -> int:
    """Count table columns, accounting for escaped pipes."""
    cleaned = line.strip().replace("\\|", "\x00")
    return cleaned.count("|") - 1


def is_table_row(line: str) -> bool:
    """Check if a line is a table row."""
    stripped = line.strip()
    return stripped.startswith("|") and stripped.endswith("|") and len(stripped) > 2


def is_separator_row(line: str) -> bool:
    """Check if a line is a table separator row."""
    stripped = line.strip()
    return bool(re.match(r"^\|[\s\-:|]+\|$", stripped))


def is_html_comment(line: str) -> bool:
    """Check if a line contains an HTML comment."""
    return "<!--" in line


def validate_file(path: Path) -> list[MarkdownIssue]:
    """Validate a single markdown file for issues."""
    issues: list[MarkdownIssue] = []

    with open(path, encoding="utf-8") as f:
        lines = f.readlines()

    # Check for unclosed code blocks
    in_code_block = False
    last_fence_line = 0

    for i, line in enumerate(lines, 1):
        if line.strip().startswith("```"):
            if not in_code_block:
                last_fence_line = i
            in_code_block = not in_code_block

    if in_code_block:
        issues.append(
            MarkdownIssue(
                file=path,
                line=last_fence_line,
                issue_type=IssueType.UNCLOSED_CODE_BLOCK,
                message=f"Code block opened at line {last_fence_line} is never closed",
            )
        )

    # Check tables
    in_code_block = False
    i = 0

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # Track code blocks
        if stripped.startswith("```"):
            in_code_block = not in_code_block
            i += 1
            continue

        if in_code_block:
            i += 1
            continue

        # Check for table
        if is_table_row(line):
            header_cols = count_columns(line)

            # Check next line
            i += 1
            if i >= len(lines):
                break

            next_line = lines[i]

            # Check for HTML comment between header and separator
            if is_html_comment(next_line):
                issues.append(
                    MarkdownIssue(
                        file=path,
                        line=i + 1,
                        issue_type=IssueType.HTML_IN_TABLE,
                        message="HTML comment interrupts table structure",
                    )
                )
                i += 1
                continue

            # Check for separator row
            if not is_separator_row(next_line):
                issues.append(
                    MarkdownIssue(
                        file=path,
                        line=i + 1,
                        issue_type=IssueType.MISSING_SEPARATOR,
                        message="Table header not followed by separator row",
                    )
                )
                i += 1
                continue

            # Check data rows
            i += 1
            while i < len(lines):
                data_line = lines[i]
                data_stripped = data_line.strip()

                # Check for HTML comment in table
                if is_html_comment(data_line):
                    issues.append(
                        MarkdownIssue(
                            file=path,
                            line=i + 1,
                            issue_type=IssueType.HTML_IN_TABLE,
                            message="HTML comment interrupts table structure",
                        )
                    )

                # End of table
                if data_stripped == "" or not is_table_row(data_line):
                    break

                # Check column count
                cols = count_columns(data_line)
                if cols != header_cols:
                    issues.append(
                        MarkdownIssue(
                            file=path,
                            line=i + 1,
                            issue_type=IssueType.COLUMN_MISMATCH,
                            message=f"Expected {header_cols} columns, got {cols}",
                        )
                    )

                i += 1
        else:
            i += 1

    return issues


def validate_directory(root: Path) -> list[MarkdownIssue]:
    """Validate all markdown files in a directory."""
    all_issues: list[MarkdownIssue] = []

    for md_file in sorted(root.rglob("*.md")):
        issues = validate_file(md_file)
        all_issues.extend(issues)

    return all_issues


def main() -> int:
    """Main entry point. Returns exit code."""
    parser = argparse.ArgumentParser(description="Validate markdown files for parsing errors")
    parser.add_argument(
        "--check",
        action="store_true",
        help="Check only, don't output suggestions (for CI)",
    )
    parser.add_argument(
        "--path",
        type=Path,
        default=Path("skills"),
        help="Path to validate (default: skills/)",
    )
    parser.add_argument(
        "--format",
        choices=["text", "json"],
        default="text",
        help="Output format (default: text)",
    )

    args = parser.parse_args()

    if not args.path.exists():
        print(f"Error: Path does not exist: {args.path}", file=sys.stderr)
        return 1

    issues = validate_file(args.path) if args.path.is_file() else validate_directory(args.path)

    if args.format == "json":
        import json

        output = [
            {
                "file": str(i.file),
                "line": i.line,
                "type": str(i.issue_type),
                "message": i.message,
            }
            for i in issues
        ]
        print(json.dumps(output, indent=2))
    else:
        # Group by issue type
        by_type: dict[IssueType, list[MarkdownIssue]] = {}
        for issue in issues:
            by_type.setdefault(issue.issue_type, []).append(issue)

        if issues:
            for issue_type, type_issues in sorted(by_type.items()):
                print(f"\n{issue_type.upper()} ({len(type_issues)} issues):")
                for issue in type_issues:
                    print(f"  {issue}")

            print(f"\nTotal: {len(issues)} issues found")
        else:
            print("No markdown issues found.")

    return 1 if issues else 0


if __name__ == "__main__":
    sys.exit(main())

```

### Core Architecture Module: `scripts/validate-skills.py`
```
#!/usr/bin/env python3
"""
Skill Validation Script for Claude Skills Repository

Validates skill structure, YAML frontmatter, and count consistency.
Run before releases to prevent broken skills from being published.

Usage:
    python scripts/validate-skills.py              # Run all checks
    python scripts/validate-skills.py --check yaml # YAML-related checks only
    python scripts/validate-skills.py --check references  # Reference checks only
    python scripts/validate-skills.py --check workflows   # Workflow definition checks only
    python scripts/validate-skills.py --check crossrefs   # Cross-reference validation only
    python scripts/validate-skills.py --skill react-expert  # Single skill
    python scripts/validate-skills.py --format json  # JSON for CI

Exit codes:
    0 = Success (warnings allowed)
    1 = Errors found
"""

from abc import ABC, abstractmethod
import argparse
from dataclasses import dataclass, field
from enum import Enum, IntEnum
import json
from pathlib import Path
import re
import sys

# Try to import PyYAML, fall back to simple parser if not available
try:
    import yaml

    HAS_PYYAML = True
except ImportError:
    HAS_PYYAML = False


def simple_yaml_parse(yaml_str: str) -> dict:
    """
    Simple YAML frontmatter parser for skill files.
    Handles the basic structure used in this project:
    - Simple key: value pairs
    - Lists with - prefix
    - One level of nested mappings (e.g., metadata: with indented key: value)
    """
    result = {}
    current_key = None
    current_collection = None  # list or dict
    collection_type = None  # "list" or "dict" or None (undetermined)

    def _save_current():
        nonlocal current_key, current_collection, collection_type
        if current_key and current_collection is not None:
            result[current_key] = current_collection
        current_key = None
        current_collection = None
        collection_type = None

    for line in yaml_str.strip().split("\n"):
        # Skip empty lines
        if not line.strip():
            continue

        # Check for list item (indented with -)
        if line.startswith("  - ") or line.startswith("    - "):
            if current_key is not None:
                if collection_type is None:
                    # First child is a list item — this is a list
                    current_collection = []
                    collection_type = "list"
                if collection_type == "list":
                    item = line.strip().lstrip("- ").strip()
                    current_collection.append(item)  # type: ignore[union-attr]
            continue

        # Check for nested key: value (indented, part of a mapping)
        if line.startswith("  ") and ":" in line and not line.startswith("  - "):
            if current_key is not None:
                if collection_type is None:
                    # First child is a key: value — this is a dict
                    current_collection = {}
                    collection_type = "dict"
                if collection_type == "dict":
                    nested_parts = line.strip().split(":", 1)
                    nested_key = nested_parts[0].strip()
                    nested_value = nested_parts[1].strip() if len(nested_parts) > 1 else ""
                    # Strip surrounding quotes from values
                    if nested_value.startswith('"') and nested_value.endswith('"'):
                        nested_value = nested_value[1:-1]
                    current_collection[nested_key] = nested_value  # type: ignore[index]
            continue

        # Check for top-level key: value pair
        if ":" in line and not line.startswith(" "):
            _save_current()

            parts = line.split(":", 1)
            key = parts[0].strip()
            value = parts[1].strip() if len(parts) > 1 else ""

            if not value:
                # Starts a collection — type determined by first child
                current_key = key
                current_collection = None
                collection_type = None
            else:
                # Strip surrounding quotes from values
                if value.startswith('"') and value.endswith('"'):
                    value = value[1:-1]
                result[key] = value

    # Save any remaining collection
    if current_key is not None:
        if current_collection is None:
            # Key with no children — store as empty dict
            result[current_key] = {}
        else:
            result[current_key] = current_collection

    return result


def parse_yaml(yaml_str: str) -> dict:
    """Parse YAML using PyYAML if available, otherwise use simple parser."""
    if HAS_PYYAML:
        return yaml.safe_load(yaml_str) or {}
    return simple_yaml_parse(yaml_str)


# =============================================================================
# Constants
# =============================================================================

SKILLS_DIR = "skills"
REQUIRED_FIELDS = ["name", "description"]
MAX_DESCRIPTION_LENGTH = 1024
DESCRIPTION_TRIGGER = "Use when"
NAME_PATTERN = re.compile(r"^[a-zA-Z0-9-]+$")

# Required metadata sub-fields (under the metadata key)
REQUIRED_METADATA_FIELDS = ["triggers", "role", "scope", "output-format", "domain", "related-skills"]

# Known domain values (warning, not error, for unknown)
KNOWN_DOMAINS = {
    "language",
    "backend",
    "frontend",
    "infrastructure",
    "api-architecture",
    "quality",
    "devops",
    "security",
    "data-ml",
    "platform",
    "specialized",
    "workflow",
}

# Valid enum values for metadata fields
VALID_SCOPES = {
    "implementation",
    "review",
    "design",
    "system-design",
    "analysis",
    "testing",
    "infrastructure",
    "optimization",
    "architecture",
}

VALID_OUTPUT_FORMATS = {
    "code",
    "document",
    "report",
    "architecture",
    "analysis",
    "manifests",
    "specification",
    "schema",
    "analysis-and-code",
}

# Canonical section order (H2 headers)
CANONICAL_SECTIONS = [
    "Role Definition",
    "When to Use This Skill",
    "Core Workflow",
    "Reference Guide",
    "Constraints",
    "Output Templates",
    "Knowledge Reference",
    "Related Skills",
]

# Line count thresholds for SKILL.md
MIN_NON_BLANK_LINES = 80
MAX_NON_BLANK_LINES = 100

# Compiled regex patterns for body content checks
CORE_WORKFLOW_PATTERN = re.compile(r"##\s*Core\s+Workflow")
WHEN_TO_USE_PATTERN = re.compile(r"##\s*When\s+to\s+Use(?:\s+This\s+Skill)?", re.IGNORECASE)
NUMBERED_STEP_PATTERN = re.compile(r"^\d+\.\s", re.MULTILINE)
BULLET_PATTERN = re.compile(r"^\s*[-*]\s")
NEXT_SECTION_PATTERN = re.compile(r"\n##\s+")
H2_HEADER_PATTERN = re.compile(r"^##\s+(.+)$", re.MULTILINE)

# Files to check for count consistency
COUNT_FILES = [
    ".claude-plugin/plugin.json",
    ".claude-plugin/marketplace.json",
    "README.md",
    "ROADMAP.md",
    "QUICKSTART.md",
    "assets/social-preview.html",
]


# =============================================================================
# Workflow Constants
# =============================================================================

COMMANDS_DIR_WORKFLOW = "commands"
MANIFEST_FILE = "commands/workflow-manifest.yaml"

# Required fields in per-command YAML definitions
REQUIRED_DEFINITION_FIELDS = [
    "command",
    "path",
    "description",
    "inputs",
    "outputs",
    "requires",
]

# Valid values for workflow definition fields
VALID_INPUT_TYPES = {"string", "url", "list[url]", "list[string]", "flag", "file[]"}
VALID_OUTPUT_TYPES = {"url", "document", "tickets", "report", "file", "directory"}
VALID_REQUIRES = {"ticketing", "documentation"}
VALID_STATUS = {"existing", "planned", "deprecated"}
VALID_PHASES = {"intake", "discovery", "planning", "execution", "retrospective"}
VALID_DEPENDENCY_STRENGTHS = {"required", "recommended"}


# =============================================================================
# Data Classes
# ===================================
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #193** (2026-05-23): **Syntax error in complete ticket command**
  *Symptoms*: Loaded repo to oh-my-pi and noticed error:  ``` │❯▾ {"timestamp":"2026-05-20T10:26:39.674+03:00","level":"warn","pid":12439,"message":"Failed to parse YAML frontmatter","err":"Failed to parse YAML frontmatter                                                                                    │ │   (/Users/user/.omp/plugins/cache/plugins/fullstack-dev-skills___fullstack-dev-skills___0.4.14/commands/project/execution/complete-ticket.md): YAML Parse error: Unexpected token\n\nSource:                                                       │ │   \"/Users/user/.omp/plugins/cache/plugins/fullstack-dev-skills___fullstack-dev-skills___0.4.14/commands/project/execution/complete-ticket.md\"\n\nStack:\nSyntaxError: YAML Parse error: Unexpected token\n    at <parse> (:0)\n    at parse      │ │   (unknown)\n    at parseFrontmatter (/Users/user/node_modules/@oh-my-pi/pi-utils/src/frontmatter.ts:104:23)\n    at parseCommandTemplate (/Users/user/node_modules/@oh-my-pi/pi-coding-agent/src/extensibility/slash-commands.ts:137:32)\n    at   │ │   <anonymous> (/Users/user/node_modules/@oh-my-pi/pi-coding-agent/src/extensibility/slash-commands.ts:166:33)\n    at map (native:1:11)\n    at loadSlashCommands                                                                                  │ │   (/Users/user/node_modules/@oh-my-pi/pi-coding-agent/src/extensibility/slash-commands.ts:165:56)\n    at processTicksAndRejections (native:7:39)"} ```  Github also reports yaml error  https://github.com/Jeffallan/c

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

### Incident Patch 1: `882ef55e` (2026-08-07)
**Commit Message**: fix(docs): update skill count in README banner; teach update-docs.py to manage it

The capsule-render banner embeds counts URL-encoded in the image URL,
where no marker comment can live, so it stayed at 66 skills through the
v0.4.16 release. update-docs.py now rewrites the banner's desc=
parameter from computed counts, matching the existing marker-less
version-badge treatment.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01E6LA4sndtVGyvoXqwYeHoB

**File**: `CHANGELOG.md` (modified, +3/-0)
```diff
@@ -7,6 +7,9 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+### Fixed
+- README banner (capsule-render URL) still displayed 66 skills after the v0.4.16 release; the counts are URL-encoded inside the image URL where no `<!-- SKILL_COUNT -->` marker can live, so `update-docs.py` never touched them. The script now rewrites the banner's `desc=` parameter from computed counts
+
 ## [0.4.16] - 2026-08-07
 
 ### Added
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 <p align="center">
-  <img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=12,14,25,27&height=200&section=header&text=Claude%20Skills&fontSize=80&fontColor=ffffff&animation=fadeIn&fontAlignY=35&desc=66%20Skills%20%E2%80%A2%209%20Workflows%20%E2%80%A2%20Built%20for%20Full-Stack%20Devs&descSize=20&descAlignY=55" width="100%"/>
+  <img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=12,14,25,27&height=200&section=header&text=Claude%20Skills&fontSize=80&fontColor=ffffff&animation=fadeIn&fontAlignY=35&desc=67%20Skills%20%E2%80%A2%209%20Workflows%20%E2%80%A2%20Built%20for%20Full-Stack%20Devs&descSize=20&descAlignY=55" width="100%"/>
 </p>
 
 <p align="center">
```

**File**: `scripts/update-docs.py` (modified, +7/-0)
```diff
@@ -127,6 +127,13 @@ def update_markdown_file(file_path: Path, version: str, counts: dict, dry_run: b
     # Also update version badge URL (no marker needed - URL pattern is unique)
     content = re.sub(r"version-[\d.]+-blue\.svg", f"version-{version}-blue.svg", content)
 
+    # Update counts embedded in the capsule-render banner URL (URL-encoded, no marker possible)
+    content = re.sub(
+        r"desc=\d+%20Skills%20%E2%80%A2%20\d+%20Workflows",
+        f"desc={counts['skillCount']}%20Skills%20%E2%80%A2%20{counts['workflowCount']}%20Workflows",
+        content,
+    )
+
     # Update "Last updated" version reference (e.g., in ROADMAP.md)
     content = re.sub(r"(Last updated:.*?\(v)[\d.]+(\))", rf"\g<1>{version}\2", content)
 
```

---

### Incident Patch 2: `fb678157` (2026-08-07)
**Commit Message**: fix(devops-engineer): operationalize production-deploy approval gate in core workflow

The constraints said never to deploy to production without explicit
approval, but the workflow's deploy step proceeded straight to rollout.
The workflow now determines the target environment and, for production
or customer-facing targets, requires presenting the deployment summary
and rollback plan and receiving explicit approval first. Mirrors the
terraform-engineer gate added in #213. Closes #196, closes #212.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01E6LA4sndtVGyvoXqwYeHoB

**File**: `CHANGELOG.md` (modified, +2/-1)
```diff
@@ -24,6 +24,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - `site/package-lock.json`: follow-up fresh `npm audit fix` clearing post-July advisories (9 findings down to 5). The remaining 5 require a semver-major Astro 7 upgrade (cascading @astrojs/starlight and @astrojs/mdx majors) and are dev-server/SSR-context advisories with low exposure for a statically built site; tracked as separate upgrade work
 - `rag-architect/SKILL.md`: reranking example instantiated the Cohere client with a hard-coded `"YOUR_API_KEY"` placeholder; now reads `COHERE_API_KEY` from the environment with a note on secrets handling, closing #210 (#216)
 - `terraform-engineer/SKILL.md`: core workflow allowed proceeding from `terraform plan` straight to `terraform apply`; now requires presenting a plan summary (highlighting destructive actions) and receiving explicit user approval before apply, refusing when approval is withheld, closing #211 (#213)
+- `devops-engineer/SKILL.md`: the "never deploy to production without explicit approval" constraint was not operationalized in the core workflow; the deploy step now determines the target environment and, for production or customer-facing targets, presents the deployment summary and rollback plan and requires explicit user approval before running deployment commands, closing #196 and #212
 
 ### Contributors
 - @vasugarg09 — Fixed broken relative reference paths in `vue-expert-js` and `react-expert` (#225)
@@ -32,7 +33,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - @awais786 — New `django-storages-s3` skill: production S3 file storage for Django (#218)
 - @snvtac — Replaced hard-coded Cohere API key placeholder in `rag-architect` with environment lookup (#216)
 - @SergiuLupaiescu — Added user-approval gate between `terraform plan` and `apply` in `terraform-engineer` (#213)
-- @specterslient95-lgtm — Reported the missing plan/apply approval gate (#211)
+- @specterslient95-lgtm — Reported the missing plan/apply approval gate (#211) and the non-operationalized production-deploy constraint (#196, #212)
 
 ## [0.4.15] - 2026-05-20
 
```

**File**: `skills/devops-engineer/SKILL.md` (modified, +3/-2)
```diff
@@ -42,8 +42,9 @@ You are a senior DevOps engineer with 10+ years of experience. You operate with
 2. **Design** - Pipeline structure, deployment strategy
 3. **Implement** - IaC, Dockerfiles, CI/CD configs
 4. **Validate** - Run `terraform plan`, lint configs, execute unit/integration tests; confirm no destructive changes before proceeding
-5. **Deploy** - Roll out with verification; run smoke tests post-deployment
-6. **Monitor** - Set up observability, alerts; confirm rollback procedure is ready before going live
+5. **Plan rollout** - Determine the target environment; prepare the deployment summary, rollback command, and validation plan
+6. **Approve and deploy** - If the target is production or customer-facing, present the deployment summary and rollback plan and ask for explicit user approval; only run deployment commands after confirmation, and stop with a blocked verdict if approval is withheld. Roll out with verification; run smoke tests post-deployment
+7. **Monitor** - Set up observability, alerts; confirm rollback procedure is ready before going live
 
 ## Reference Guide
 
```

---

### Incident Patch 3: `d0e7f4e8` (2026-08-07)
**Commit Message**: fix(terraform-engineer): require user approval between plan and apply (#213)

**File**: `skills/terraform-engineer/SKILL.md` (modified, +2/-1)
```diff
@@ -24,7 +24,8 @@ Senior Terraform engineer specializing in infrastructure as code across AWS, Azu
 3. **Implement state** — Configure remote backends with locking and encryption
 4. **Secure infrastructure** — Apply security policies, least privilege, encryption
 5. **Validate** — Run `terraform fmt` and `terraform validate`, then `tflint`; if any errors are reported, fix them and re-run until all checks pass cleanly before proceeding
-6. **Plan and apply** — Run `terraform plan -out=tfplan`, review output carefully, then `terraform apply tfplan`; if the plan fails, see error recovery below
+6. **Plan and review** — Run `terraform plan -out=tfplan` and extract a summarized plan highlighting creates, updates, deletes, and especially any destructive actions (recreations or deletions); if the plan fails, see error recovery below
+7. **Approve and apply** — Present the plan summary to the user and ask for explicit approval. Only execute `terraform apply tfplan` after receiving confirmation. Refuse to apply the plan if approval is withheld, or if destructive changes are present and the user has not explicitly accepted them
 
 ### Error Recovery
 
```

---

### Incident Patch 4: `10fe40c8` (2026-08-07)
**Commit Message**: docs(changelog): record #216 Cohere key fix under Unreleased

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01E6LA4sndtVGyvoXqwYeHoB

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -22,12 +22,14 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - `nestjs-expert/references/migration-from-express.md`: cross-reference to legacy-modernizer's strangler-fig reference was a hardcoded contributor-machine absolute path (`/Users/.../claude-skills/skills/...`); corrected to `../legacy-modernizer/references/strangler-fig-pattern.md`. Caught by `ReferencePathChecker` on CI's clean runner; the checker now rejects absolute paths unconditionally so a stale local clone can never mask one
 - `site/package-lock.json`: applied `npm audit fix` to clear docs-site dependency vulnerabilities (14 findings down to 9; the remainder stem from advisories published after the fix was cut). Verified via clean `npm ci`, `npm audit`, and a successful 98-page site build before merge (#220)
 - `site/package-lock.json`: follow-up fresh `npm audit fix` clearing post-July advisories (9 findings down to 5). The remaining 5 require a semver-major Astro 7 upgrade (cascading @astrojs/starlight and @astrojs/mdx majors) and are dev-server/SSR-context advisories with low exposure for a statically built site; tracked as separate upgrade work
+- `rag-architect/SKILL.md`: reranking example instantiated the Cohere client with a hard-coded `"YOUR_API_KEY"` placeholder; now reads `COHERE_API_KEY` from the environment with a note on secrets handling, closing #210 (#216)
 
 ### Contributors
 - @vasugarg09 — Fixed broken relative reference paths in `vue-expert-js` and `react-expert` (#225)
 - @chgreer1070 — Patched docs-site dependency vulnerabilities via `npm audit fix` (#220)
 - @kasymovpost — GitLab CI/CD best-practices reference for devops-engineer (#219)
 - @awais786 — New `django-storages-s3` skill: production S3 file storage for Django (#218)
+- @snvtac — Replaced hard-coded Cohere API key placeholder in `rag-architect` with environment lookup (#216)
 
 ## [0.4.15] - 2026-05-20
 
```

---

### Incident Patch 5: `d759b157` (2026-08-07)
**Commit Message**: fix(rag-architect): avoid hard-coded Cohere API key in reranking example (#216)

**File**: `skills/rag-architect/SKILL.md` (modified, +5/-1)
```diff
@@ -128,10 +128,14 @@ def hybrid_search(query: str, tenant_id: str, top_k: int = 20) -> list:
 
 ### 4. Reranking Top-K Results
 
+Load provider API keys from environment variables or a secrets manager; never commit them to source code.
+
 ```python
+import os
+
 import cohere
 
-co = cohere.Client("YOUR_API_KEY")
+co = cohere.Client(os.environ["COHERE_API_KEY"])
 
 def rerank(query: str, results: list, top_n: int = 5) -> list:
     docs = [r.payload.get("text", "") for r in results]
```

---

### Incident Patch 6: `1508683a` (2026-08-07)
**Commit Message**: fix(devops-engineer): replace archived kaniko with BuildKit rootless in gitlab-ci reference

Post-merge patch for #219: kaniko is archived and unmaintained, so the
flagship build example now uses moby/buildkit:rootless with registry
cache, and principle 8 notes the migration. Also syncs reference-file
counts (366 -> 367) via update-docs.py, fixing the CI failure on the
merge commit. Social preview PNG regen deferred to next release.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01E6LA4sndtVGyvoXqwYeHoB

**File**: `CHANGELOG.md` (modified, +5/-1)
```diff
@@ -9,19 +9,23 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Added
 - `ReferencePathChecker` in `scripts/validate-skills.py`: validates that file paths cited in skill markdown (backtick paths and markdown links) resolve relative to the containing file or the skill root. Broken paths previously failed silently when an agent tried to load deferred reference content; this class of bug has now recurred across several releases and is guarded automatically in CI and `make validate`
+- `devops-engineer`: new `references/gitlab-ci.md` covering GitLab CI/CD best practices (pipeline dedup via `workflow:rules`, `needs:` DAG, cache vs artifacts, CI/CD components, environments, OIDC secrets, runner isolation, MR-widget reporting) plus a routing-table row; the GitLab counterpart to the existing GitHub Actions reference (#219)
+
+### Changed
+- `devops-engineer/references/gitlab-ci.md`: post-merge patch replacing the kaniko build example with BuildKit rootless (`moby/buildkit:rootless` + `buildctl-daemonless.sh` with registry cache) and noting kaniko's archived status in the core principles; kaniko is unmaintained and should not be the recommended build path
 
 ### Fixed
 - `vue-expert-js/SKILL.md`: three shared-Vue reference paths pointed at `vue-expert/references/*.md`, which does not resolve from the skill directory; corrected to `../vue-expert/references/*.md` (#225)
 - `react-expert/references/migration-class-to-modern.md`: self-referencing path `react-expert/references/server-components.md` corrected to `references/server-components.md` (#225)
 - `fastapi-expert/references/migration-from-django.md`: cross-reference to legacy-modernizer used an absolute-style path (`/skills/legacy-modernizer/...`) that resolves nowhere; corrected to `../legacy-modernizer/references/migration-strategies.md`. Found by the new `ReferencePathChecker` audit
 - `nestjs-expert/references/migration-from-express.md`: cross-reference to legacy-modernizer's strangler-fig reference was a hardcoded contributor-machine absolute path (`/Users/.../claude-skills/skills/...`); corrected to `../legacy-modernizer/references/strangler-fig-pattern.md`. Caught by `ReferencePathChecker` on CI's clean runner; the checker now rejects absolute paths unconditionally so a stale local clone can never mask one
-
 - `site/package-lock.json`: applied `npm audit fix` to clear docs-site dependency vulnerabilities (14 findings down to 9; the remainder stem from advisories published after the fix was cut). Verified via clean `npm ci`, `npm audit`, and a successful 98-page site build before merge (#220)
 - `site/package-lock.json`: follow-up fresh `npm audit fix` clearing post-July advisories (9 findings down to 5). The remaining 5 require a semver-major Astro 7 upgrade (cascading @astrojs/starlight and @astrojs/mdx majors) and are dev-server/SSR-context advisories with low exposure for a statically built site; tracked as separate upgrade work
 
 ### Contributors
 - @vasugarg09 — Fixed broken relative reference paths in `vue-expert-js` and `react-expert` (#225)
 - @chgreer1070 — Patched docs-site dependency vulnerabilities via `npm audit fix` (#220)
+- @kasymovpost — GitLab CI/CD best-practices reference for devops-engineer (#219)
 
 ## [0.4.15] - 2026-05-20
 
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -122,4 +122,4 @@ Fullstack engineering, security engineering, compliance, and technical due dilig
 
 ---
 
-**Built for Claude Code** | **<!-- WORKFLOW_COUNT -->9<!-- /WORKFLOW_COUNT --> Workflows** | **<!-- REFERENCE_COUNT -->366<!-- /REFERENCE_COUNT --> Reference Files** | **<!-- SKILL_COUNT -->66<!-- /SKILL_COUNT --> Skills**
+**Built for Claude Code** | **<!-- WORKFLOW_COUNT -->9<!-- /WORKFLOW_COUNT --> Workflows** | **<!-- REFERENCE_COUNT -->367<!-- /REFERENCE_COUNT --> Reference Files** | **<!-- SKILL_COUNT -->66<!-- /SKILL_COUNT --> Skills**
```

**File**: `ROADMAP.md` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@
 **Version:** v<!-- VERSION -->0.4.15<!-- /VERSION --> (Released January 2026)
 
 - **<!-- SKILL_COUNT -->66<!-- /SKILL_COUNT --> Skills** across 12 domains
-- **<!-- REFERENCE_COUNT -->366<!-- /REFERENCE_COUNT --> Reference Files** with progressive disclosure architecture
+- **<!-- REFERENCE_COUNT -->367<!-- /REFERENCE_COUNT --> Reference Files** with progressive disclosure architecture
 - **30+ Frameworks** and technologies covered
 - **<!-- WORKFLOW_COUNT -->9<!-- /WORKFLOW_COUNT --> Project Workflow Commands** for epic planning, discovery, execution, and retrospectives
 - **50% Token Reduction** through selective disclosure architecture
```

**File**: `assets/social-preview.html` (modified, +1/-1)
```diff
@@ -277,7 +277,7 @@ <h2 class="subtitle"><!-- SKILL_COUNT -->66<!-- /SKILL_COUNT --> Specialized Ski
                 <div class="stat">
                     <div class="stat-content">
                         <span class="stat-icon">📚</span>
-                        <span><!-- REFERENCE_COUNT -->366<!-- /REFERENCE_COUNT --> Reference Files</span>
+                        <span><!-- REFERENCE_COUNT -->367<!-- /REFERENCE_COUNT --> Reference Files</span>
                     </div>
                 </div>
                 <div class="stat">
```

**File**: `site/src/content/docs/index.mdx` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ import { Card, CardGrid } from '@astrojs/starlight/components';
     Project workflow commands managing epics from discovery through retrospectives, with Jira and Confluence
     integration.
   </Card>
-  <Card title="366 References" icon="open-book">
+  <Card title="367 References" icon="open-book">
     Deep-dive reference files loaded on-demand for surgical precision when context requires it.
   </Card>
   <Card title="Progressive Disclosure" icon="magnifier">
```

---

### Incident Patch 7: `dff05dcd` (2026-08-07)
**Commit Message**: fix(site): clear post-July dependency advisories via fresh npm audit fix

Follow-up to #220: reduces audit findings from 9 to 5. The remaining
five require a semver-major Astro 7 upgrade and are tracked separately.
Site builds clean (98 pages) with the updated lockfile.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01E6LA4sndtVGyvoXqwYeHoB

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -17,6 +17,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - `nestjs-expert/references/migration-from-express.md`: cross-reference to legacy-modernizer's strangler-fig reference was a hardcoded contributor-machine absolute path (`/Users/.../claude-skills/skills/...`); corrected to `../legacy-modernizer/references/strangler-fig-pattern.md`. Caught by `ReferencePathChecker` on CI's clean runner; the checker now rejects absolute paths unconditionally so a stale local clone can never mask one
 
 - `site/package-lock.json`: applied `npm audit fix` to clear docs-site dependency vulnerabilities (14 findings down to 9; the remainder stem from advisories published after the fix was cut). Verified via clean `npm ci`, `npm audit`, and a successful 98-page site build before merge (#220)
+- `site/package-lock.json`: follow-up fresh `npm audit fix` clearing post-July advisories (9 findings down to 5). The remaining 5 require a semver-major Astro 7 upgrade (cascading @astrojs/starlight and @astrojs/mdx majors) and are dev-server/SSR-context advisories with low exposure for a statically built site; tracked as separate upgrade work
 
 ### Contributors
 - @vasugarg09 — Fixed broken relative reference paths in `vue-expert-js` and `react-expert` (#225)
```

**File**: `site/package-lock.json` (modified, +32/-16)
```diff
@@ -1835,6 +1835,7 @@
       "resolved": "https://registry.npmjs.org/acorn/-/acorn-8.15.0.tgz",
       "integrity": "sha512-NZyJarBfL7nWwIq+FDL6Zp/yHEhePMNnnJ0y3qfieCrmNvYct8uvtiV41UvlSe6apAfk0fY1FbWx+NwfmpvtTg==",
       "license": "MIT",
+      "peer": true,
       "bin": {
         "acorn": "bin/acorn"
       },
@@ -1995,6 +1996,7 @@
       "resolved": "https://registry.npmjs.org/astro/-/astro-5.18.2.tgz",
       "integrity": "sha512-TnFwLnAXty5MXKPDGuKXqK4AMBXG+FH6RUdK7Oyc3gyfNoFIthT+4eRbzOK43bdRlLaZuxgciDSjgtggZ3OtGQ==",
       "license": "MIT",
+      "peer": true,
       "dependencies": {
         "@astrojs/compiler": "^2.13.0",
         "@astrojs/internal-helpers": "0.7.6",
@@ -4440,9 +4442,19 @@
       }
     },
     "node_modules/js-yaml": {
-      "version": "4.1.1",
-      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-4.1.1.tgz",
-      "integrity": "sha512-qQKT4zQxXl8lLwBtHMWwaTcGfFOZviOJet3Oy/xmGk2gZH677CJM9EvtfdSkgWcATZhj/55JZ0rmy3myCT5lsA==",
+      "version": "4.3.1",
+      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-4.3.1.tgz",
+      "integrity": "sha512-CY6crGq313MX8GkwvB7tzgp99vjQxY1++5y10/BKN/GUfHqWaOGQMNZkBvqSzsZKWk/ijwHlWzzkLulsGHhjWQ==",
+      "funding": [
+        {
+          "type": "github",
+          "url": "https://github.com/sponsors/puzrin"
+        },
+        {
+          "type": "github",
+          "url": "https://github.com/sponsors/nodeca"
+        }
+      ],
       "license": "MIT",
       "dependencies": {
         "argparse": "^2.0.1"
@@ -5611,9 +5623,9 @@
       "license": "MIT"
     },
     "node_modules/nanoid": {
-      "version": "3.3.12",
-      "resolved": "https://registry.npmjs.org/nanoid/-/nanoid-3.3.12.tgz",
-      "integrity": "sha512-ZB9RH/39qpq5Vu6Y+NmUaFhQR6pp+M2Xt76XBnEwDaGcVAqhlvxrl3B2bKS5D3NH3QR76v3aSrKaF/Kiy7lEtQ==",
+      "version": "3.3.18",
+      "resolved": "https://registry.npmjs.org/nanoid/-/nanoid-3.3.18.tgz",
+      "integrity": "sha512-DTg4MJbGMWkfi6VZFdNt2/caMbQy4Ou+Op/hJQvGEWcnVfoA1QA+xzRKAzw9jD6+GVOOeYr/mIcuDSdug6F6+w==",
       "funding": [
         {
           "type": "github",
@@ -5863,9 +5875,9 @@
       }
     },
     "node_modules/postcss": {
-      "version": "8.5.15",
-      "resolved": "https://registry.npmjs.org/postcss/-/postcss-8.5.15.tgz",
-      "integrity": "sha512-FfR8sjd4em2T6fb3I2MwAJU7HWVMr9zba+enmQeeWFfCbm+UOC/0X4DS8XtpUTMwWMGbjKYP7xjfNekzyGmB3A==",
+      "version": "8.5.26",
+      "resolved": "https://registry.npmjs.org/postcss/-/postcss-8.5.26.tgz",
+      "integrity": "sha512-u82N74LFzG8ca+dD8puPnplTXoGH4fTPpVGuIbt36G3qvNlkvfD0lEAZSxaly3KX8TS/L1A1gsCEmvKmBcVbkQ==",
       "funding": [
         {
           "type": "opencollective",
@@ -5881,8 +5893,9 @@
         }
       ],
       "license": "MIT",
+      "peer": true,
       "dependencies": {
-        "nanoid": "^3.3.12",
+        "nanoid": "^3.3.17",
         "picocolors": "^1.1.1",
         "source-map-js": "^1.2.1"
       },
@@ -6377,6 +6390,7 @@
       "resolved": "https://registry.npmjs.org/rollup/-/rollup-4.60.4.tgz",
       "integrity": "sha512-WHeFSbZYsPu3+bLoNRUuAO+wavNlocOPf3wSHTP7hcFKVnJeWsYlCDbr3mTS14FCizf9ccIxXA8sGL8zKeQN3g==",
       "license": "MIT",
+      "peer": true,
       "dependencies": {
         "@types/estree": "1.0.8"
       },
@@ -6670,9 +6684,9 @@
       }
     },
     "node_modules/svgo": {
-      "version": "4.0.1",
-      "resolved": "https://registry.npmjs.org/svgo/-/svgo-4.0.1.tgz",
-      "integrity": "sha512-XDpWUOPC6FEibaLzjfe0ucaV0YrOjYotGJO1WpF0Zd+n6ZGEQUsSugaoLq9QkEZtAfQIxT42UChcssDVPP3+/w==",
+      "version": "4.0.2",
+      "resolved": "https://registry.npmjs.org/svgo/-/svgo-4.0.2.tgz",
+      "integrity": "sha512-ekx94z1rRc5LDi6oSUaeRnYhd0UOJxdtQCL2rF8xpWxD3TPAsISWOrxezqGovqS38GRZOdpDfvQe3ts6F7nsng==",
       "license": "MIT",
       "dependencies": {
         "commander": "^11.1.0",
@@ -7133,10 +7147,11 @@
       }
     },
     "node_modules/vite": {
-      "version": "6.4.2",
-      "resolved": "https:/
```

---

### Incident Patch 8: `0f2b80cb` (2026-08-07)
**Commit Message**: fix(site): patch docs-site dependency vulnerabilities via npm audit fix (#220)

Co-authored-by: chris greer <chgreer1079@gmail.com>
Co-authored-by: Devin AI <158243242+devin-ai-integration[bot]@users.noreply.github.com>

**File**: `site/package-lock.json` (modified, +619/-168)
```diff
@@ -25,18 +25,18 @@
       "license": "MIT"
     },
     "node_modules/@astrojs/internal-helpers": {
-      "version": "0.7.5",
-      "resolved": "https://registry.npmjs.org/@astrojs/internal-helpers/-/internal-helpers-0.7.5.tgz",
-      "integrity": "sha512-vreGnYSSKhAjFJCWAwe/CNhONvoc5lokxtRoZims+0wa3KbHBdPHSSthJsKxPd8d/aic6lWKpRTYGY/hsgK6EA==",
+      "version": "0.7.6",
+      "resolved": "https://registry.npmjs.org/@astrojs/internal-helpers/-/internal-helpers-0.7.6.tgz",
+      "integrity": "sha512-GOle7smBWKfMSP8osUIGOlB5kaHdQLV3foCsf+5Q9Wsuu+C6Fs3Ez/ttXmhjZ1HkSgsogcM1RXSjjOVieHq16Q==",
       "license": "MIT"
     },
     "node_modules/@astrojs/markdown-remark": {
-      "version": "6.3.10",
-      "resolved": "https://registry.npmjs.org/@astrojs/markdown-remark/-/markdown-remark-6.3.10.tgz",
-      "integrity": "sha512-kk4HeYR6AcnzC4QV8iSlOfh+N8TZ3MEStxPyenyCtemqn8IpEATBFMTJcfrNW32dgpt6MY3oCkMM/Tv3/I4G3A==",
+      "version": "6.3.11",
+      "resolved": "https://registry.npmjs.org/@astrojs/markdown-remark/-/markdown-remark-6.3.11.tgz",
+      "integrity": "sha512-hcaxX/5aC6lQgHeGh1i+aauvSwIT6cfyFjKWvExYSxUhZZBBdvCliOtu06gbQyhbe0pGJNoNmqNlQZ5zYUuIyQ==",
       "license": "MIT",
       "dependencies": {
-        "@astrojs/internal-helpers": "0.7.5",
+        "@astrojs/internal-helpers": "0.7.6",
         "@astrojs/prism": "3.3.0",
         "github-slugger": "^2.0.0",
         "hast-util-from-html": "^2.0.3",
@@ -50,8 +50,8 @@
         "remark-parse": "^11.0.0",
         "remark-rehype": "^11.1.2",
         "remark-smartypants": "^3.0.2",
-        "shiki": "^3.19.0",
-        "smol-toml": "^1.5.2",
+        "shiki": "^3.21.0",
+        "smol-toml": "^1.6.0",
         "unified": "^11.0.5",
         "unist-util-remove-position": "^5.0.0",
         "unist-util-visit": "^5.0.0",
@@ -60,12 +60,12 @@
       }
     },
     "node_modules/@astrojs/mdx": {
-      "version": "4.3.13",
-      "resolved": "https://registry.npmjs.org/@astrojs/mdx/-/mdx-4.3.13.tgz",
-      "integrity": "sha512-IHDHVKz0JfKBy3//52JSiyWv089b7GVSChIXLrlUOoTLWowG3wr2/8hkaEgEyd/vysvNQvGk+QhysXpJW5ve6Q==",
+      "version": "4.3.14",
+      "resolved": "https://registry.npmjs.org/@astrojs/mdx/-/mdx-4.3.14.tgz",
+      "integrity": "sha512-FBrqJQORVm+rkRa2TS5CjU9PBA6hkhrwLVBSS9A77gN2+iehvjq1w6yya/d0YKC7osiVorKkr3Qd9wNbl0ZkGA==",
       "license": "MIT",
       "dependencies": {
-        "@astrojs/markdown-remark": "6.3.10",
+        "@astrojs/markdown-remark": "6.3.11",
         "@mdx-js/mdx": "^3.1.1",
         "acorn": "^8.15.0",
         "es-module-lexer": "^1.7.0",
@@ -1340,9 +1340,9 @@
       "license": "MIT"
     },
     "node_modules/@rollup/rollup-android-arm-eabi": {
-      "version": "4.57.1",
-      "resolved": "https://registry.npmjs.org/@rollup/rollup-android-arm-eabi/-/rollup-android-arm-eabi-4.57.1.tgz",
-      "integrity": "sha512-A6ehUVSiSaaliTxai040ZpZ2zTevHYbvu/lDoeAteHI8QnaosIzm4qwtezfRg1jOYaUmnzLX1AOD6Z+UJjtifg==",
+      "version": "4.60.4",
+      "resolved": "https://registry.npmjs.org/@rollup/rollup-android-arm-eabi/-/rollup-android-arm-eabi-4.60.4.tgz",
+      "integrity": "sha512-F5QXMSiFebS9hKZj02XhWLLnRpJ3B3AROP0tWbFBSj+6kCbg5m9j5JoHKd4mmSVy5mS/IMQloYgYxCuJC0fxEQ==",
       "cpu": [
         "arm"
       ],
@@ -1353,9 +1353,9 @@
       ]
     },
     "node_modules/@rollup/rollup-android-arm64": {
-      "version": "4.57.1",
-      "resolved": "https://registry.npmjs.org/@rollup/rollup-android-arm64/-/rollup-android-arm64-4.57.1.tgz",
-      "integrity": "sha512-dQaAddCY9YgkFHZcFNS/606Exo8vcLHwArFZ7vxXq4rigo2bb494/xKMMwRRQW6ug7Js6yXmBZhSBRuBvCCQ3w==",
+      "version": "4.60.4",
+      "resolved": "https://registry.npmjs.org/@rollup/rollup-android-arm64/-/rollup-android-arm64-4.60.4.tgz",
+      "integrity": "sha512-GxxTKApUpzRhof7poWvCJHRF51C67u1R7D6DiluBE8wKU1u5GWE8t+v81JvJYtbawoBFX1hLv5Ei4eVjkWokaw==",
       "cpu": [
         "arm64"
       ],
@@ -1366,9 +1366,9 @@
       ]
     },
     "node_modules/@rollup/rollup-darwin-arm64
```

---

### Incident Patch 9: `7f3f3bbc` (2026-08-07)
**Commit Message**: fix(skills): remove hardcoded local path in nestjs-expert; reject absolute refs in ReferencePathChecker

CI caught a contributor-machine absolute path in nestjs-expert that the
local run missed: joining an absolute ref onto a base dir returns it
unchanged, so it "resolved" against a stale clone outside the repo.
The checker now flags absolute paths unconditionally, keeping the check
hermetic across environments.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01E6LA4sndtVGyvoXqwYeHoB

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -14,6 +14,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - `vue-expert-js/SKILL.md`: three shared-Vue reference paths pointed at `vue-expert/references/*.md`, which does not resolve from the skill directory; corrected to `../vue-expert/references/*.md` (#225)
 - `react-expert/references/migration-class-to-modern.md`: self-referencing path `react-expert/references/server-components.md` corrected to `references/server-components.md` (#225)
 - `fastapi-expert/references/migration-from-django.md`: cross-reference to legacy-modernizer used an absolute-style path (`/skills/legacy-modernizer/...`) that resolves nowhere; corrected to `../legacy-modernizer/references/migration-strategies.md`. Found by the new `ReferencePathChecker` audit
+- `nestjs-expert/references/migration-from-express.md`: cross-reference to legacy-modernizer's strangler-fig reference was a hardcoded contributor-machine absolute path (`/Users/.../claude-skills/skills/...`); corrected to `../legacy-modernizer/references/strangler-fig-pattern.md`. Caught by `ReferencePathChecker` on CI's clean runner; the checker now rejects absolute paths unconditionally so a stale local clone can never mask one
 
 ### Contributors
 - @vasugarg09 — Fixed broken relative reference paths in `vue-expert-js` and `react-expert` (#225)
```

**File**: `scripts/validate-skills.py` (modified, +4/-1)
```diff
@@ -843,7 +843,10 @@ def check(self, skill_path: Path, skill_name: str) -> list[ValidationIssue]:
             for ref in sorted(refs):
                 if self._is_exempt(ref):
                     continue
-                if (md_file.parent / ref).exists() or (skill_path / ref).exists():
+                # Absolute paths are never portable, and joining them onto a
+                # base dir returns them unchanged - they would "resolve"
+                # against whatever happens to exist on the local machine.
+                if not Path(ref).is_absolute() and ((md_file.parent / ref).exists() or (skill_path / ref).exists()):
                     continue
                 lineno = next((i for i, line in enumerate(lines, 1) if ref in line), None)
                 location = f" (line {lineno})" if lineno else ""
```

**File**: `skills/nestjs-expert/references/migration-from-express.md` (modified, +1/-1)
```diff
@@ -986,7 +986,7 @@ describe('UsersController (e2e)', () => {
 
 Gradually replace Express routes with NestJS while both run simultaneously.
 
-**Cross-reference:** See `/Users/dmitry/Projects/claude-skills/skills/legacy-modernizer/references/strangler-fig-pattern.md` for detailed implementation.
+**Cross-reference:** See `../legacy-modernizer/references/strangler-fig-pattern.md` for detailed implementation.
 
 ```typescript
 // main.ts - Running both Express and NestJS
```

---

### Incident Patch 10: `d9101ef7` (2026-08-07)
**Commit Message**: fix(skills): correct legacy-modernizer path in fastapi-expert; add ReferencePathChecker

A strict path audit following #225 found one more broken reference:
fastapi-expert's migration-from-django.md cited an absolute-style path
that resolves nowhere. To guard this recurring bug class, add
ReferencePathChecker to validate-skills.py: every backtick or
markdown-link .md path in skill files must resolve relative to the
containing file or the skill root. Runs by default, so CI and
make validate exercise it on every push.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01E6LA4sndtVGyvoXqwYeHoB

**File**: `CHANGELOG.md` (modified, +11/-0)
```diff
@@ -7,6 +7,17 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+### Added
+- `ReferencePathChecker` in `scripts/validate-skills.py`: validates that file paths cited in skill markdown (backtick paths and markdown links) resolve relative to the containing file or the skill root. Broken paths previously failed silently when an agent tried to load deferred reference content; this class of bug has now recurred across several releases and is guarded automatically in CI and `make validate`
+
+### Fixed
+- `vue-expert-js/SKILL.md`: three shared-Vue reference paths pointed at `vue-expert/references/*.md`, which does not resolve from the skill directory; corrected to `../vue-expert/references/*.md` (#225)
+- `react-expert/references/migration-class-to-modern.md`: self-referencing path `react-expert/references/server-components.md` corrected to `references/server-components.md` (#225)
+- `fastapi-expert/references/migration-from-django.md`: cross-reference to legacy-modernizer used an absolute-style path (`/skills/legacy-modernizer/...`) that resolves nowhere; corrected to `../legacy-modernizer/references/migration-strategies.md`. Found by the new `ReferencePathChecker` audit
+
+### Contributors
+- @vasugarg09 — Fixed broken relative reference paths in `vue-expert-js` and `react-expert` (#225)
+
 ## [0.4.15] - 2026-05-20
 
 ### Fixed
```

**File**: `CLAUDE.md` (modified, +1/-0)
```diff
@@ -254,6 +254,7 @@ The script validates:
 - **Name format** - Letters, numbers, hyphens only
 - **Description** - Max 1024 chars, must contain "Use when" trigger clause
 - **References** - Directory exists, has files, proper headers
+- **Reference paths** - File paths cited in skill markdown resolve relative to the containing file or the skill root
 - **Count consistency** - Skills/reference counts match across documentation
 
 **Options:**
```

**File**: `scripts/validate-skills.py` (modified, +57/-0)
```diff
@@ -813,6 +813,62 @@ def check(self, skill_path: Path, skill_name: str) -> list[ValidationIssue]:
         return issues
 
 
+class ReferencePathChecker(BaseChecker):
+    """Validates that relative file paths cited in skill markdown resolve.
+
+    Skill files cite paths to deferred content in backticks (e.g.
+    `references/testing.md` in routing tables) and markdown links. Agents
+    resolve these relative to the containing file or the skill root; a path
+    that resolves from neither base fails silently when an agent tries to
+    load it. Cross-skill references must use the ../other-skill/ form so
+    they resolve from those same bases.
+    """
+
+    name = "reference-paths"
+    category = "references"
+
+    BACKTICK_REF = re.compile(r"`([^`\s]+\.md)`")
+    MARKDOWN_LINK_REF = re.compile(r"\]\(([^)\s#]+\.md)(?:#[^)]*)?\)")
+    FENCED_CODE_BLOCK = re.compile(r"^\s*```.*?^\s*```[^\n]*", re.MULTILINE | re.DOTALL)
+
+    def check(self, skill_path: Path, skill_name: str) -> list[ValidationIssue]:
+        issues = []
+        for md_file in sorted(skill_path.rglob("*.md")):
+            text = md_file.read_text()
+            # Fenced code blocks may cite hypothetical example paths; real
+            # cross-references live in prose, bullets, and routing tables.
+            prose = self.FENCED_CODE_BLOCK.sub("", text)
+            refs = set(self.BACKTICK_REF.findall(prose)) | set(self.MARKDOWN_LINK_REF.findall(prose))
+            lines = text.split("\n")
+            for ref in sorted(refs):
+                if self._is_exempt(ref):
+                    continue
+                if (md_file.parent / ref).exists() or (skill_path / ref).exists():
+                    continue
+                lineno = next((i for i, line in enumerate(lines, 1) if ref in line), None)
+                location = f" (line {lineno})" if lineno else ""
+                issues.append(
+                    ValidationIssue(
+                        skill=skill_name,
+                        check=self.name,
+                        severity=Severity.ERROR,
+                        message=f"Unresolvable file reference '{ref}'{location} - "
+                        "path must resolve relative to the containing file or the skill root",
+                        file=str(md_file),
+                    )
+                )
+        return issues
+
+    @staticmethod
+    def _is_exempt(ref: str) -> bool:
+        """Skip URLs, bare filenames, and template placeholders."""
+        if ref.startswith(("http://", "https://")):
+            return True
+        if "/" not in ref:
+            return True
+        return any(c in ref for c in "{<*")
+
+
 class MetadataEnumChecker(BaseChecker):
     """Generic checker for metadata enum fields."""
 
@@ -2001,6 +2057,7 @@ def __init__(
             ReferencesDirectoryChecker(),
             ReferenceFileCountChecker(),
             NonStandardHeadersChecker(),
+            ReferencePathChecker(),
         ]
 
         # Filter by category if specified
```

**File**: `skills/fastapi-expert/references/migration-from-django.md` (modified, +1/-1)
```diff
@@ -961,7 +961,7 @@ async def create_user(user: UserCreate, db: AsyncSession):
 ## Cross-Reference
 
 For comprehensive migration strategies and modernization patterns:
-- **Legacy Modernizer**: `/skills/legacy-modernizer/references/migration-strategies.md`
+- **Legacy Modernizer**: `../legacy-modernizer/references/migration-strategies.md`
   - Strangler pattern implementation
   - Feature flag strategies
   - Rollback procedures
```

#### Recent Merged Pull Requests:
- **PR #227** (2026-08-07): chore: release v0.4.16 (@Jeffallan)
- **PR #225** (2026-08-07): fix: broken relative reference paths in vue-expert-js and react-expert (@vasugarg09)
- **PR #224** (closed): feat: add lms-platform-architect skill (@MD-ALL-SHAHRIA)
- **PR #223** (closed): docs(rust-engineer): add auto_impl pattern for blanket trait impls (@Teebor-Choka)
- **PR #222** (closed): docs: update golang-pro skill documentation (@poojamk2023-coder)
- **PR #221** (closed): Add Software Graph Analyst skill (@0xsarwagya)
- **PR #220** (2026-08-07): fix: patch docs-site dependency vulnerabilities via npm audit fix (@chgreer1070)
- **PR #219** (2026-08-07): Add: Gitlab ci/cd best practices (@kasymovpost)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
