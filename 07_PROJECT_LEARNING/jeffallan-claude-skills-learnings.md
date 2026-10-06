# Forensic Learning Record (Deep Inspection): Jeffallan/claude-skills

> **Canonical Artifact**: `07_PROJECT_LEARNING/jeffallan-claude-skills-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Jeffallan/claude-skills](https://github.com/Jeffallan/claude-skills))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:09:28.779Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Jeffallan/claude-skills`
- **Description**: 67 Specialized Skills for Full-Stack Developers. Transform Claude Code into your expert pair programmer.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 11741 stars

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

    return ", ".join(related)


def add_related_skills_to_frontmatter(content: str, related_skills: str) -> str:
    """Insert related-skills into an existing metadata block in the frontmatter.

    Adds the related-skills line after output-format (or as the last metadata
    field if output-format is not present).
    """
    parts = content.split("---", 2)
    if len(parts) < 3:
        return content

    fm_str = parts[1]
    body = parts[2]

    # Check if related-skills already exists
    if "  related-skills:" in fm_str:
        return content

    lines = fm_str.split("\n")
    new_lines = []
    inserted = False

    for line in lines:
        new_lines.append(line)
        # Insert after output-format line
        if not inserted and line.strip().startswith("output-format:"):
            new_lines.append(f"  related-skills: {related_skills}")
            inserted = True

    # If output-format wasn't found, insert before the last line (which is empty/closing)
    if not inserted:
        # Find the last metadata field line and insert after it
        for i in range(len(new_lines) - 1, -1, -1):
            if new_lines[i].startswith("  ") and ":" in new_lines[i]:
                new_lines.insert(i + 1, f"  related-skills: {related_skills}")
                inserted = True
                break

    new_fm = "\n".join(new_lines)
    return f"---{new_fm}---{body}"


def migrate_related_skills(
    skill_dir: Path,
    valid_dirs: set[str],
    dry_run: bool = False,
) -> tuple[bool, str]:
    """Add related-skills metadata to a single skill's frontmatter.

    Returns (success, message).
    """
    skill_name = skill_dir.name
    skill_md = skill_dir / "SKILL.md"

    if not skill_md.exists():
        return False, f"{skill_name}: SKILL.md not found"

    content = skill_md.read_text()
    fm, body = parse_frontmatter(content)

    if fm is None:
        return False, f"{skill_name}: No valid frontmatter found"

    # Check if already has related-skills
    metadata = fm.get("
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
# =============================================================================


class Severity(Enum):
    ERROR = "error"
    WARNING = "warning"


class DFSColor(IntEnum):
    """Colors for DFS cycle detection."""

    WHITE = 0  # Unvisited
    GRAY = 1  # In progress
    BLACK = 2  # Completed


@dataclass
class FrontmatterResult:
    """Result of frontmatter extraction."""

    frontmatter: dict
    body: str
    skill_md: Path


@dataclass
class ValidationIssue:
    """Individual validation issue."""

    skill: str
    check: str
    severity: Severity
    message: str
    file: str | None = None

    def to_dict(self) -> dict:
        return {
            "skill": self.skill,
            "check": self.check,
            "severity": self.severity.value,
            "message": self.message,
            "file": self.file,
        }


@dataclass
class ValidationResult:
    """Per-skill validation results."""

    skill: str
    issues: list[ValidationIssue] = field(default_factory=list)

    @property
    def has_errors(self) -> bool:
        return any(i.severity == Severity.ERROR for i in self.issues)

    @property
    def has_warnings(self) -> bool:
        return any(i.severity == Severity.WARNING for i in self.issues)

    def to_dict(self) -> dict:
        return {
            "skill": self.skill,
            "issues": [i.to_dict() for i in self.issues],
            "has_errors": self.has_errors,
            "has_warnings": self.has_warnings,
        }


@dataclass
class ValidationReport:
    """Full validation report."""

    results: list[ValidationResult] = field(default_factory=list)
    count_issues: list[ValidationIssue] = field(default_factory=list)
    workflow_issues: list[ValidationIssue] = field(default_factory=list)
    crossref_issues: list[ValidationIssue] = field(default_factory=list)

    @property
    def has_errors(self) -> bool:
        return (
            any(r.has_errors for r in self.results)
            or any(i.severity == Severity.ERROR for i in self.count_issues)

```

### Core Architecture Module: `site/astro.config.mjs`
```
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://jeffallan.github.io',
  base: '/claude-skills',
  integrations: [
    starlight({
      title: 'Claude Skills',
      description:
        '67 specialized skills for Claude Code — progressive disclosure, context engineering, and full-stack coverage.',
      customCss: ['./src/styles/custom.css'],
      head: [
        {
          tag: 'meta',
          attrs: {
            name: 'google-site-verification',
            content: 'F01KE0U-EHMrEHtYf5nOpt5tlbWeoMoil6Wkp0x5ONQ',
          },
        },
        {
          tag: 'script',
          attrs: {
            async: true,
            src: 'https://www.googletagmanager.com/gtag/js?id=G-QVMEHEZBXE',
          },
        },
        {
          tag: 'script',
          content: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-QVMEHEZBXE');
          `,
        },
        {
          tag: 'link',
          attrs: {
            rel: 'alternate',
            type: 'text/plain',
            href: '/claude-skills/llms.txt',
            title: 'LLM-friendly content',
          },
        },
        {
          tag: 'script',
          attrs: {
            type: 'module',
          },
          content: `
            import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
            mermaid.initialize({ startOnLoad: false, theme: 'dark' });

            function renderMermaid() {
              document.querySelectorAll('pre[data-language="mermaid"]').forEach((pre, i) => {
                const lines = pre.querySelectorAll('.ec-line');
                const code = Array.from(lines).map(line => line.textContent).join('\\n');
                const div = document.createElement('div');
                div.className = 'mermaid';
                div.id = 'mermaid-' + i;
                div.textContent = code;
                pre.closest('.expressive-code').replaceWith(div);
              });
              mermaid.run();
            }

            renderMermaid();
            document.addEventListener('astro:page-load', renderMermaid);
          `,
        },
      ],
      components: {
        SocialIcons: './src/components/SocialIcons.astro',
        Header: './src/components/Header.astro',
        Footer: './src/components/Footer.astro',
      },
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/jeffallan/claude-skills',
        },
      ],
      sidebar: [
        { label: 'Home', link: '/' },
        { label: 'Getting Started', link: '/getting-started/' },
        { label: 'Skills Guide', link: '/skills-guide/' },
        {
          label: 'Guides',
          items: [
            { label: 'Workflow Commands', link: '/guides/workflow-commands/' },
            { label: 'Common Ground', link: '/guides/common-ground/' },
            {
              label: 'Atlassian MCP Setup',
              link: '/guides/atlassian-mcp-setup/',
            },
            {
              label: 'Local Development',
              link: '/guides/local-development/',
            },
            {
              label: 'Supported Agents',
              link: '/guides/supported-agents/',
            },
          ],
        },
        {
          label: 'Workflows',
          collapsed: true,
          items: [
            {
              label: 'Intake Phase',
              collapsed: true,
              items: [
                { label: 'Overview', link: '/workflows/intake-phase/' },
                { label: 'intake:document-codebase', link: '/workflows/intake-document-codebase/' },
                { label: 'intake:capture-behavior', link: '/workflows/intake-capture-behavior/' },
                { label: 'intake:create-system-description', link: '/workflows/intake-create-system-description/' },
              ],
            },
            {
              label: 'Discovery Phase',
              collapsed: true,
              items: [
                { label: 'Overview', link: '/workflows/discovery-phase/' },
                { label: 'discovery:create', link: '/workflows/discovery-create/' },
                { label: 'discovery:synthesize', link: '/workflows/discovery-synthesize/' },
                { label: 'discovery:approve', link: '/workflows/discovery-approve/' },
              ],
            },
            {
              label: 'Planning Phase',
              collapsed: true,
              items: [
                { label: 'Overview', link: '/workflows/planning-phase/' },
                { label: 'planning:epic-plan', link: '/workflows/planning-epic-plan/' },
                { label: 'planning:impl-plan', link: '/workflows/planning-impl-plan/' },
              ],
            },
            {
              label: 'Execution Phase',
              collapsed: true,
              items: [
                { label: 'Overview', link: '/workflows/execution-phase/' },
                { label: 'execution:execute-ticket', link: '/workflows/execution-execute-ticket/' },
                { label: 'execution:complete-ticket', link: '/workflows/execution-complete-ticket/' },
              ],
            },
            {
              label: 'Retrospective Phase',
              collapsed: true,
              items: [
                { label: 'Overview', link: '/workflows/retrospective-phase/' },
                { label: 'retrospectives:complete-epic', link: '/workflows/retrospective-complete-epic/' },
              ],
            },
            { label: 'common-ground', link: '/workflows/common-ground/' },
            { label: 'Workflow Definition Schema', link: '/workflows/workflow-definition-schema/' },
          ],
        },
        {
          label: 'Language',
          collapsed: true,
          autogenerate: { directory: 'skills/language' },
        },
        {
          label: 'Backend Frameworks',
          collapsed: true,
          autogenerate: { directory: 'skills/backend' },
        },
        {
          label: 'Frontend & Mobile',
          collapsed: true,
          autogenerate: { directory: 'skills/frontend' },
        },
        {
          label: 'Infrastructure & Cloud',
          collapsed: true,
          autogenerate: { directory: 'skills/infrastructure' },
        },
        {
          label: 'API & Architecture',
          collapsed: true,
          autogenerate: { directory: 'skills/api-architecture' },
        },
        {
          label: 'Quality & Testing',
          collapsed: true,
          autogenerate: { directory: 'skills/quality' },
        },
        {
          label: 'DevOps & Operations',
          collapsed: true,
          autogenerate: { directory: 'skills/devops' },
        },
        {
          label: 'Security',
          collapsed: true,
          autogenerate: { directory: 'skills/security' },
        },
        {
          label: 'Data & ML',
          collapsed: true,
          autogenerate: { directory: 'skills/data-ml' },
        },
        {
          label: 'Platform',
          collapsed: true,
          autogenerate: { directory: 'skills/platform' },
        },
        {
          label: 'Specialized',
          collapsed: true,
          autogenerate: { directory: 'skills/specialized' },
        },
        {
          label: 'Workflow Skills',
          collapsed: true,
          autogenerate: { directory: 'skills/workflow' },
        },
        {
          label: 'Project',
          items: [
            { label: 'README', link: '/readme/' },
            { label: 'Contributing', link: '/contributing/' },
            { label: 'Changelog', link: '/changelog/' },
            { label: 'Roadmap', link: '/roadmap/' },
          ],
        },
      ],
    }),
  ],
});

```

### Core Architecture Module: `site/scripts/sync-content.mjs`
```
#!/usr/bin/env node

/**
 * sync-content.mjs
 *
 * Pre-build script that transforms repo-root content into Starlight-compatible
 * pages under site/src/content/docs/. Run via `npm run sync`.
 */

import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const DOCS_DIR = path.resolve(import.meta.dirname, '..', 'src', 'content', 'docs');
const PUBLIC_DIR = path.resolve(import.meta.dirname, '..', 'public');

const GITHUB_BLOB = 'https://github.com/jeffallan/claude-skills/blob/main';
const BASE_PATH = '/claude-skills';

const pageManifest = []; // { siteUrl, title, description, category, contentFile }

// ─── Domain label mapping ───────────────────────────────────────────
const DOMAIN_LABELS = {
  language: 'Language',
  backend: 'Backend Frameworks',
  frontend: 'Frontend & Mobile',
  infrastructure: 'Infrastructure & Cloud',
  'api-architecture': 'API & Architecture',
  quality: 'Quality & Testing',
  devops: 'DevOps & Operations',
  security: 'Security',
  'data-ml': 'Data & ML',
  platform: 'Platform',
  specialized: 'Specialized',
  workflow: 'Workflow Skills',
};

// ─── Core docs mapping (source relative to ROOT → dest relative to DOCS_DIR)
const CORE_DOCS = [
  {
    src: 'QUICKSTART.md',
    dest: 'getting-started.md',
    title: 'Getting Started',
    description: 'Installation and first steps',
    category: 'docs',
  },
  {
    src: 'SKILLS_GUIDE.md',
    dest: 'skills-guide.md',
    title: 'Skills Guide',
    description: 'Decision trees and skill combinations for choosing the right skill',
    category: 'docs',
  },
  {
    src: 'README.md',
    dest: 'readme.md',
    title: 'README',
    description: 'Project overview, architecture, and usage patterns',
    category: 'project',
  },
  {
    src: 'CONTRIBUTING.md',
    dest: 'contributing.md',
    title: 'Contributing',
    description: 'How to contribute new skills and improve existing ones',
    category: 'project',
  },
  {
    src: 'CHANGELOG.md',
    dest: 'changelog.md',
    title: 'Changelog',
    description: 'Version history and release notes',
    category: 'project',
  },
  {
    src: 'ROADMAP.md',
    dest: 'roadmap.md',
    title: 'Roadmap',
    description: 'Planned features and future direction',
    category: 'project',
  },
];

// ─── Guide docs mapping ─────────────────────────────────────────────
const GUIDE_DOCS = [
  {
    src: 'docs/WORKFLOW_COMMANDS.md',
    dest: 'guides/workflow-commands.md',
    title: 'Workflow Commands',
    description: 'Project workflow commands for managing development lifecycle',
  },
  {
    src: 'docs/COMMON_GROUND.md',
    dest: 'guides/common-ground.md',
    title: 'Common Ground',
    description: 'Surface and validate hidden assumptions about projects',
  },
  {
    src: 'docs/ATLASSIAN_MCP_SETUP.md',
    dest: 'guides/atlassian-mcp-setup.md',
    title: 'Atlassian MCP Setup',
    description: 'Configure Jira and Confluence MCP integration',
  },
  {
    src: 'docs/local_skill_development.md',
    dest: 'guides/local-development.md',
    title: 'Local Development',
    description: 'Develop and test skills locally',
  },
  {
    src: 'docs/SUPPORTED_AGENTS.md',
    dest: 'guides/supported-agents.md',
    title: 'Supported Agents',
    description: 'Agents and frameworks compatible with the Agent Skills specification',
  },
];

// ─── Link rewrite map (built during sync) ───────────────────────────
const linkMap = new Map();

function buildLinkMap() {
  // Core docs
  for (const { src, dest } of CORE_DOCS) {
    const slug = dest.replace(/\.md$/, '');
    addLinkVariants(src, `${BASE_PATH}/${slug}/`);
  }
  // Guide docs
  for (const { src, dest } of GUIDE_DOCS) {
    const slug = dest.replace(/\.md$/, '');
    addLinkVariants(src, `${BASE_PATH}/${slug}/`);
    // Also map the dest path for cross-references between guides
    const destSlug = dest.replace(/\.md$/, '').replace('guides/', '');
    linkMap.set(`/guides/${destSlug}/`, `${BASE_PATH}/guides/${destSlug}/`);
  }
  // README is now synced via CORE_DOCS, but add extra variant without path prefix
  linkMap.set('README.md', `${BASE_PATH}/readme/`);
  linkMap.set('./README.md', `${BASE_PATH}/readme/`);
  // Workflow cross-links (relative .md references between workflow files)
  const workflowDir = path.join(ROOT, 'docs', 'workflow');
  if (fs.existsSync(workflowDir)) {
    for (const file of fs.readdirSync(workflowDir).filter((f) => f.endsWith('.md'))) {
      const slug = file.replace(/\.md$/, '');
      linkMap.set(file, `${BASE_PATH}/workflows/${slug}/`);
      linkMap.set(`workflow/${file}`, `${BASE_PATH}/workflows/${slug}/`);
      linkMap.set(`/workflows/${slug}/`, `${BASE_PATH}/workflows/${slug}/`);
    }
  }
  // Map common internal paths that may appear without base path
  const coreSlugs = ['getting-started', 'skills-guide', 'readme', 'contributing', 'changelog', 'roadmap'];
  for (const slug of coreSlugs) {
    linkMap.set(`/${slug}/`, `${BASE_PATH}/${slug}/`);
  }
  // Map command source files to their doc site equivalents
  linkMap.set('../commands/common-ground/COMMAND.md', `${BASE_PATH}/guides/common-ground/`);
  linkMap.set('commands/common-ground/COMMAND.md', `${BASE_PATH}/guides/common-ground/`);
  // Map source-only files to GitHub
  linkMap.set('LICENSE', `${GITHUB_BLOB}/LICENSE`);
  linkMap.set('docs/v0.5.0-plan.md', `${GITHUB_BLOB}/docs/v0.5.0-plan.md`);
}

function addLinkVariants(srcPath, siteUrl) {
  const variants = [srcPath, `./${srcPath}`, path.basename(srcPath)];
  for (const v of variants) {
    linkMap.set(v, siteUrl);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function stripFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (match) return { frontmatter: match[1], body: match[2] };
  return { frontmatter: null, body: content };
}

function parseFrontmatter(content) {
  const { frontmatter, body } = stripFrontmatter(content);
  const data = frontmatter ? yaml.load(frontmatter) : {};
  return { data, body };
}

function extractH1(body) {
  const match = body.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

function removeH1(body) {
  return body.replace(/^#\s+.+\n*/m, '');
}

function starlightFrontmatter(fields) {
  const fm = yaml.dump(fields, { lineWidth: -1, quotingType: '"' });
  return `---\n${fm}---\n`;
}

function rewriteLinks(body) {
  // Rewrite markdown links [text](url) using linkMap
  return body.replace(/\[([^\]]*)\]\(([^)]+)\)/g, (_match, text, url) => {
    // Skip external URLs and anchors
    if (url.startsWith('http') || url.startsWith('#')) return _match;

    // Strip anchor from URL for lookup, preserve anchor
    const [urlPath, anchor] = url.split('#');
    const suffix = anchor ? `#${anchor}` : '';

    // Check linkMap first
    const resolved = linkMap.get(urlPath) || linkMap.get(urlPath.replace(/^\.\//, ''));
    if (resolved) {
      return `[${text}](${resolved}${suffix})`;
    }

    // Handle absolute paths that need base path prefix
    if (urlPath.startsWith('/') && !urlPath.startsWith(BASE_PATH)) {
      // Check if it's an internal site path (skills, guides, workflows, etc.)
      if (
        urlPath.match(
          /^\/(skills|guides|workflows|getting-started|skills-guide|readme|contributing|changelog|roadmap)\//,
        )
      ) {
        return `[${text}](${BASE_PATH}${urlPath}${suffix})`;
      }
    }

    return _match;
  });
}

function stripHtmlCommentTags(body) {
  // Remove <!-- SKILL_COUNT -->65<!-- /SKILL_COUNT --> style tags, keep inner text
  return body.replace(/<!--\s*\w+\s*-->([^<]+?)<!--\s*\/\w+\s*-->/g, '$1');
}

// ─── Clean synced content ────────────────────────────────────────────

function cleanSyncedContent() {
  const syncedDirs = ['skills', 'guides', 'workflows'];
  for (const dir of syncedDirs) {
    const full = path.join(DOCS_DIR, dir);
    if (fs.existsSync(full)) {
      fs.rmSync(full, { recursive: true });
    }
  }

  const syncedFiles = CORE_DOCS.map((d) => d.dest);
  for (const file of syncedFiles) {
    const full = path.join(DOCS_DIR, file);
    if (fs.existsSync(full)) {
      fs.unlinkSync(full);
    }
  }
}

// ─── Sync core docs ─────────────────────────────────────────────────

function syncCoreDocs() {
  for (const { src, dest, title, description, category } of CORE_DOCS) {
    const srcPath = path.join(ROOT, src);
    if (!fs.existsSync(srcPath)) {
      console.warn(`  SKIP ${src} (not found)`);
      continue;
    }

    let content = fs.readFileSync(srcPath, 'utf-8');
    const { body: rawBody } = stripFrontmatter(content);
    let body = removeH1(rawBody);
    body = stripHtmlCommentTags(body);
    body = rewriteLinks(body);

    // Remove GitHub-specific HTML (badges, images, typing SVGs)
    body = body.replace(/<p align="center">[\s\S]*?<\/p>/g, '');

    const fm = starlightFrontmatter({ title, description });
    const destPath = path.join(DOCS_DIR, dest);
    ensureDir(path.dirname(destPath));
    fs.writeFileSync(destPath, fm + '\n' + body.trim() + '\n');
    console.log(`  ${src} → ${dest}`);

    const slug = dest.replace(/\.md$/, '');
    pageManifest.push({ siteUrl: `/${slug}/`, title, description, category, contentFile: dest });
  }
}

// ─── Sync guide docs ────────────────────────────────────────────────

function syncGuideDocs() {
  for (const { src, dest, title, description } of GUIDE_DOCS) {
    const srcPath = path.join(ROOT, src);
    if (!fs.existsSync(srcPath)) {
      console.warn(`  SKIP ${src} (not found)`);
      continue;
    }

    let content = fs.readFileSync(srcPath, 'utf-8');
    const { body: rawBody } = stripFrontmatter(content);
    let body = removeH1(rawBody);
    body = stripHtmlCommentTags(body);
    body = rewriteLinks(body);

    const fm = starlightFrontmatter({ title, description });
    const destPath = path.join(DOCS_DIR
```

### Core Architecture Module: `site/src/content.config.ts`
```
import { defineCollection } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
};

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

### Incident Patch 1: `eae31de6` (2026-10-03)
**Commit Message**: fix(skills): clear legacy-modernizer and code-documenter validator warnings; correct ROADMAP dates

- legacy-modernizer: output-format code+analysis -> analysis-and-code
  (the validator's enum); drop code+analysis from CLAUDE.md's list
- code-documenter: When to Use section as a bullet list
- ROADMAP header: release and last-updated dates match v0.4.17

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01HkedNdra6Vrj4rfWvWEF2V

**File**: `CHANGELOG.md` (modified, +5/-0)
```diff
@@ -10,6 +10,11 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 ### Changed
 - Maintainer credit in skills authored by @jeffallan: the bare `[Synergetic Solutions](https://synergetic.solutions)` line above the Documentation backlink now reads "Maintained by [@jeffallan](https://github.com/jeffallan), Principal Consultant at [Synergetic Solutions](https://synergetic.solutions)", matching the docs site footer. `syncSkillPages` strips the new line; CLAUDE.md's "Company Backlink" section is now "Maintainer Credit"
 
+### Fixed
+- `legacy-modernizer`: `metadata.output-format` was `code+analysis`, which the validator rejects; now `analysis-and-code`. Removed `code+analysis` from the allowed values listed in CLAUDE.md so the docs match the validator
+- `code-documenter`: "When to Use This Skill" was a prose sentence instead of the bullet list every other skill uses; rewritten as bullets drawn from its description
+- ROADMAP header showed "Released January 2026" and "Last updated: February 2026" next to v0.4.17; dates corrected (`update-docs.py` updates the version marker only)
+
 ## [0.4.17] - 2026-10-03
 
 ### Added
```

**File**: `CLAUDE.md` (modified, +1/-1)
```diff
@@ -68,7 +68,7 @@ metadata:
 - `triggers`: Comma-separated searchable keywords
 - `role`: `specialist` | `expert` | `architect` | `engineer`
 - `scope`: `implementation` | `review` | `design` | `system-design` | `testing` | `analysis` | `infrastructure` | `optimization` | `architecture`
-- `output-format`: `code` | `document` | `report` | `architecture` | `specification` | `schema` | `manifests` | `analysis` | `analysis-and-code` | `code+analysis`
+- `output-format`: `code` | `document` | `report` | `architecture` | `specification` | `schema` | `manifests` | `analysis` | `analysis-and-code`
 - `related-skills`: Comma-separated skill directory names (e.g., `fullstack-guardian, test-master`). Must resolve to existing skill directories.
 
 **Domain values:**
```

**File**: `ROADMAP.md` (modified, +2/-2)
```diff
@@ -2,7 +2,7 @@
 
 ## Current Status
 
-**Version:** v<!-- VERSION -->0.4.17<!-- /VERSION --> (Released January 2026)
+**Version:** v<!-- VERSION -->0.4.17<!-- /VERSION --> (Released October 2026)
 
 - **<!-- SKILL_COUNT -->67<!-- /SKILL_COUNT --> Skills** across 12 domains
 - **<!-- REFERENCE_COUNT -->371<!-- /REFERENCE_COUNT --> Reference Files** with progressive disclosure architecture
@@ -202,4 +202,4 @@ We welcome community input on the roadmap direction. Here's how you can contribu
 
 ---
 
-*This roadmap is a living document and subject to change based on community feedback, technical constraints, and emerging priorities. Last updated: February 2026 (v0.4.17)*
+*This roadmap is a living document and subject to change based on community feedback, technical constraints, and emerging priorities. Last updated: October 2026 (v0.4.17)*
```

**File**: `skills/code-documenter/SKILL.md` (modified, +5/-1)
```diff
@@ -20,7 +20,11 @@ Documentation specialist for inline documentation, API specs, documentation site
 
 ## When to Use This Skill
 
-Applies to any task involving code documentation, API specs, or developer-facing guides. See the reference table below for specific sub-topics.
+- Adding docstrings to functions, classes, and modules
+- Writing OpenAPI/Swagger specs or JSDoc annotations
+- Creating API documentation for REST or GraphQL endpoints
+- Building documentation sites or developer portals
+- Writing getting-started guides, tutorials, and user guides
 
 ## Core Workflow
 
```

**File**: `skills/legacy-modernizer/SKILL.md` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ metadata:
   triggers: legacy modernization, strangler fig, incremental migration, technical debt, legacy refactoring, system migration, legacy system, modernize codebase
   role: specialist
   scope: architecture
-  output-format: code+analysis
+  output-format: analysis-and-code
   related-skills: test-master, devops-engineer
 ---
 
```

---

### Incident Patch 2: `087d42b0` (2026-10-03)
**Commit Message**: fix(plugin): add maintainer contact email to plugin and marketplace author

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01HkedNdra6Vrj4rfWvWEF2V

**File**: `.claude-plugin/marketplace.json` (modified, +1/-0)
```diff
@@ -19,6 +19,7 @@
       "version": "0.4.16",
       "author": {
         "name": "jeffallan",
+        "email": "jeff@synergetic.solutions",
         "url": "https://github.com/jeffallan"
       },
       "homepage": "https://jeffallan.github.io/claude-skills/",
```

**File**: `.claude-plugin/plugin.json` (modified, +1/-0)
```diff
@@ -4,6 +4,7 @@
   "description": "Comprehensive skill pack with 67 specialized skills for full-stack developers: 12 language experts (Python, TypeScript, Go, Rust, C++, Swift, Kotlin, C#, PHP, Java, SQL, JavaScript), 10 backend frameworks, 6 frontend/mobile, plus infrastructure, DevOps, security, and testing. Features progressive disclosure architecture for 50% faster loading.",
   "author": {
     "name": "jeffallan",
+    "email": "jeff@synergetic.solutions",
     "url": "https://github.com/jeffallan"
   },
   "homepage": "https://jeffallan.github.io/claude-skills/",
```

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - `security-reviewer` and `spec-miner`: removed `Bash` from `allowed-tools`. An unscoped `Bash` entry pre-approves every shell command while the skill is active, which the Claude plugin directory holds for policy review. spec-miner never runs shell commands; security-reviewer's scanners (and active tools such as nmap and sqlmap) now go through normal per-command user approval, closing #243
 
 ### Fixed
-- Plugin metadata: `marketplace.json` listed `author.email` as `github@jeffallan`, which is not a valid address; replaced with `author.url`. `plugin.json` now sets `author.url` and `homepage`, and both manifests point `homepage` at the docs site (#246)
+- Plugin metadata: `marketplace.json` listed `author.email` as `github@jeffallan`, which is not a valid address; replaced with a real contact address plus `author.url`. `plugin.json` now sets the same `author.email` and `author.url`, plus `homepage`, and both manifests point `homepage` at the docs site (#246)
 - `flutter-expert/SKILL.md`: the Riverpod provider example used `StateNotifierProvider`/`StateNotifier`, legacy since Riverpod 2.0 and contradicting the skill's own `references/riverpod-state.md`; replaced with the equivalent `NotifierProvider`/`Notifier` pattern and updated the troubleshooting table to match (#237)
 - Plugin install commands in README, QUICKSTART, the docs site landing page, and generated `llms.txt` used `fullstack-dev-skills@jeffallan`, which fails because the marketplace is declared as `fullstack-dev-skills`; corrected to `fullstack-dev-skills@fullstack-dev-skills`, including the QUICKSTART uninstall troubleshooting step, closing #234 (#236)
 - README banner (capsule-render URL) still displayed 66 skills after the v0.4.16 release; the counts are URL-encoded inside the image URL where no `<!-- SKILL_COUNT -->` marker can live, so `update-docs.py` never touched them. The script now rewrites the banner's `desc=` parameter from computed counts
```

---

### Incident Patch 3: `bbb6cc82` (2026-10-03)
**Commit Message**: fix(plugin): correct author metadata and add homepage

marketplace.json listed author.email as `github@jeffallan`, which is not
a valid address; replace it with author.url. Add author.url and homepage
to plugin.json, and point both manifests' homepage at the docs site.
Refs #246.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01HkedNdra6Vrj4rfWvWEF2V

**File**: `.claude-plugin/marketplace.json` (modified, +2/-2)
```diff
@@ -19,9 +19,9 @@
       "version": "0.4.16",
       "author": {
         "name": "jeffallan",
-        "email": "github@jeffallan"
+        "url": "https://github.com/jeffallan"
       },
-      "homepage": "https://github.com/jeffallan/claude-skills",
+      "homepage": "https://jeffallan.github.io/claude-skills/",
       "repository": "https://github.com/jeffallan/claude-skills",
       "license": "MIT",
       "keywords": [
```

**File**: `.claude-plugin/plugin.json` (modified, +4/-2)
```diff
@@ -3,8 +3,10 @@
   "version": "0.4.16",
   "description": "Comprehensive skill pack with 67 specialized skills for full-stack developers: 12 language experts (Python, TypeScript, Go, Rust, C++, Swift, Kotlin, C#, PHP, Java, SQL, JavaScript), 10 backend frameworks, 6 frontend/mobile, plus infrastructure, DevOps, security, and testing. Features progressive disclosure architecture for 50% faster loading.",
   "author": {
-        "name": "Jeffallan"
-      },
+    "name": "jeffallan",
+    "url": "https://github.com/jeffallan"
+  },
+  "homepage": "https://jeffallan.github.io/claude-skills/",
   "license": "MIT",
   "repository": "https://github.com/jeffallan/claude-skills",
   "keywords": [
```

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -17,6 +17,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - `security-reviewer` and `spec-miner`: removed `Bash` from `allowed-tools`. An unscoped `Bash` entry pre-approves every shell command while the skill is active, which the Claude plugin directory holds for policy review. spec-miner never runs shell commands; security-reviewer's scanners (and active tools such as nmap and sqlmap) now go through normal per-command user approval, closing #243
 
 ### Fixed
+- Plugin metadata: `marketplace.json` listed `author.email` as `github@jeffallan`, which is not a valid address; replaced with `author.url`. `plugin.json` now sets `author.url` and `homepage`, and both manifests point `homepage` at the docs site (#246)
 - `flutter-expert/SKILL.md`: the Riverpod provider example used `StateNotifierProvider`/`StateNotifier`, legacy since Riverpod 2.0 and contradicting the skill's own `references/riverpod-state.md`; replaced with the equivalent `NotifierProvider`/`Notifier` pattern and updated the troubleshooting table to match (#237)
 - Plugin install commands in README, QUICKSTART, the docs site landing page, and generated `llms.txt` used `fullstack-dev-skills@jeffallan`, which fails because the marketplace is declared as `fullstack-dev-skills`; corrected to `fullstack-dev-skills@fullstack-dev-skills`, including the QUICKSTART uninstall troubleshooting step, closing #234 (#236)
 - README banner (capsule-render URL) still displayed 66 skills after the v0.4.16 release; the counts are URL-encoded inside the image URL where no `<!-- SKILL_COUNT -->` marker can live, so `update-docs.py` never touched them. The script now rewrites the banner's `desc=` parameter from computed counts
```

---

### Incident Patch 4: `75580524` (2026-10-03)
**Commit Message**: feat(release): publish the plugin from a CI-built distribution branch

The repo root shipped as the plugin, including the docs site, scripts,
research, and contributor files, which the Claude plugin directory held
for review (BINARIES_NOT_INSPECTED). Moving skills/ into a subdirectory
would break external deep links, and plugins can neither symlink outside
their root nor exclude files.

scripts/build-plugin-dist.sh assembles only the shipped paths from
committed HEAD; publish-plugin.yml rebuilds the `plugin` branch from it
on release tags (and workflow_dispatch). Tags only, since the directory
auto-publishes each new version on its tracked branch. Covered by
scripts/test-build-plugin-dist.sh in CI and make test.

The marketplace switch to the plugin branch follows once the branch
exists. Refs #242.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01HkedNdra6Vrj4rfWvWEF2V

**File**: `.github/workflows/publish-plugin.yml` (added, +69/-0)
```diff
@@ -0,0 +1,69 @@
+name: Publish Plugin Branch
+
+# Rebuilds the `plugin` branch, which holds only the files the plugin ships
+# (see scripts/build-plugin-dist.sh). The marketplace entry and the Claude
+# plugin directory both read from that branch. Runs on release tags only,
+# not on every push to main, because the directory auto-publishes each new
+# version it sees on the tracked branch.
+
+on:
+  push:
+    tags:
+      - 'v*'
+  workflow_dispatch:
+
+concurrency:
+  group: publish-plugin
+  cancel-in-progress: false
+
+jobs:
+  validate:
+    name: Validate
+    uses: ./.github/workflows/validate.yml
+
+  publish:
+    name: Publish plugin branch
+    needs: validate
+    runs-on: ubuntu-latest
+    permissions:
+      contents: write
+
+    steps:
+      - name: Checkout repository
+        uses: actions/checkout@v6
+        with:
+          fetch-depth: 0
+
+      - name: Build distribution tree
+        run: bash scripts/build-plugin-dist.sh "$RUNNER_TEMP/dist"
+
+      - name: Commit and push to plugin branch
+        env:
+          SOURCE_REF: ${{ github.ref_name }}
+          SOURCE_SHA: ${{ github.sha }}
+        run: |
+          git config user.name "github-actions[bot]"
+          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
+
+          WT="$RUNNER_TEMP/plugin-branch"
+          if git ls-remote --exit-code --heads origin plugin >/dev/null; then
+            git fetch origin plugin
+            git worktree add -B plugin "$WT" origin/plugin
+          else
+            git worktree add --detach "$WT"
+            git -C "$WT" checkout --orphan plugin
+          fi
+
+          cd "$WT"
+          git rm -rq --cached --ignore-unmatch .
+          find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
+          cp -a "$RUNNER_TEMP/dist/." .
+          git add -A
+
+          if git diff --cached --quiet; then
+            echo "plugin branch already matches ${SOURCE_REF}; nothing to publish"
+            exit 0
+          fi
+
+          git commit -m "Publish plugin from ${SOURCE_REF} (${SOURCE_SHA})"
+          git push origin plugin
```

**File**: `.github/workflows/validate.yml` (modified, +3/-0)
```diff
@@ -29,6 +29,9 @@ jobs:
       - name: Check docs in sync
         run: python scripts/update-docs.py --check
 
+      - name: Test plugin distribution build
+        run: bash scripts/test-build-plugin-dist.sh
+
   lint:
     name: Lint & Format Check
     runs-on: ubuntu-latest
```

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -8,6 +8,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 ## [Unreleased]
 
 ### Added
+- `plugin` distribution branch: `scripts/build-plugin-dist.sh` assembles only what the plugin ships (`.claude-plugin/plugin.json`, `skills/`, `commands/`, `references/`, `README.md`, `LICENSE`) from committed HEAD, and `.github/workflows/publish-plugin.yml` rebuilds the `plugin` branch from it on release tags. The repo root previously shipped as the plugin, including the docs site, scripts, research, and contributor files, which the Claude plugin directory held for review. `main` keeps its layout so external links into `skills/` keep working. Covered by `scripts/test-build-plugin-dist.sh`, now run in CI and `make test` (#242)
 - `CLAUDE.md`: "When Accepting Contributions" section documenting the maintainer procedure for external issues and PRs (the `gratitude` label on every contribution, fit discussion before merge, squash-merge subject format, separate changelog commit under `[Unreleased]`, count sync in the same push, and the `### Contributors` credit format at release). Previously this lived only in git history
 
 ### Changed
```

**File**: `CLAUDE.md` (modified, +8/-0)
```diff
@@ -320,6 +320,14 @@ After running validation, manually verify:
 grep -r "OLD_VERSION" --include="*.md" --include="*.json" --include="*.html"
 ```
 
+### 8. Plugin Branch
+
+The plugin ships from the `plugin` branch, not from `main`. Pushing the `vX.Y.Z` tag runs `.github/workflows/publish-plugin.yml`, which rebuilds that branch from `scripts/build-plugin-dist.sh` (only `.claude-plugin/plugin.json`, `skills/`, `commands/`, `references/`, `README.md`, `LICENSE`). Both the marketplace entry and the Claude plugin directory read from it.
+
+- Never edit the `plugin` branch by hand; the next publish overwrites it
+- After the tag push, confirm the workflow succeeded and the branch's latest commit names the new tag
+- A file the plugin needs at runtime must live under one of the shipped paths, or it will be missing from installs
+
 ---
 
 ## Attribution
```

**File**: `Makefile` (modified, +1/-0)
```diff
@@ -48,6 +48,7 @@ validate:
 
 test:
 	bash scripts/test-makefile.sh
+	bash scripts/test-build-plugin-dist.sh
 
 site-dev:
 	cd site && npm run dev
```

**File**: `scripts/build-plugin-dist.sh` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+#!/usr/bin/env bash
+#
+# Assemble the plugin distribution tree published to the `plugin` branch.
+# Only the files the plugin needs ship; the docs site, scripts, research,
+# and contributor files stay on main. Content comes from committed HEAD
+# via `git archive`, so untracked and uncommitted files never ship.
+#
+# Usage: bash scripts/build-plugin-dist.sh <empty-output-dir>
+# Exit codes: 0 = success, 1 = usage error
+
+set -euo pipefail
+
+OUT="${1:-}"
+if [ -z "$OUT" ]; then
+    echo "usage: $0 <empty-output-dir>" >&2
+    exit 1
+fi
+
+mkdir -p "$OUT"
+if [ -n "$(ls -A "$OUT")" ]; then
+    echo "error: output directory is not empty: $OUT" >&2
+    exit 1
+fi
+
+REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
+
+git -C "$REPO_ROOT" archive --format=tar HEAD -- \
+    .claude-plugin \
+    ':(exclude).claude-plugin/marketplace.json' \
+    skills \
+    commands \
+    references \
+    README.md \
+    LICENSE \
+    | tar -x -C "$OUT"
+
+echo "Built plugin distribution in $OUT"
```

**File**: `scripts/test-build-plugin-dist.sh` (added, +100/-0)
```diff
@@ -0,0 +1,100 @@
+#!/usr/bin/env bash
+#
+# Test scripts/build-plugin-dist.sh, which assembles the plugin
+# distribution tree published to the `plugin` branch.
+#
+# Usage: bash scripts/test-build-plugin-dist.sh
+# Exit codes: 0 = all tests pass, 1 = failure
+
+set -euo pipefail
+
+PASS=0
+FAIL=0
+CLEANUP_DIRS=()
+
+cleanup() {
+    for dir in "${CLEANUP_DIRS[@]}"; do
+        rm -rf "$dir"
+    done
+}
+trap cleanup EXIT
+
+# Helpers
+pass() { PASS=$((PASS + 1)); echo "  PASS: $1"; }
+fail() { FAIL=$((FAIL + 1)); echo "  FAIL: $1"; }
+
+assert_exists() {
+    if [ -e "$1" ]; then pass "$2"; else fail "$2 (missing)"; fi
+}
+
+assert_not_exists() {
+    if [ ! -e "$1" ]; then pass "$2"; else fail "$2 (should not be shipped)"; fi
+}
+
+assert_exit_nonzero() {
+    if [ "$1" -ne 0 ]; then pass "$2"; else fail "$2 (expected failure, got exit 0)"; fi
+}
+
+assert_exit_zero() {
+    if [ "$1" -eq 0 ]; then pass "$2"; else fail "$2 (expected exit 0, got $1)"; fi
+}
+
+assert_equal() {
+    if [ "$1" = "$2" ]; then pass "$3"; else fail "$3 (expected $2, got $1)"; fi
+}
+
+REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
+BUILD="$REPO_ROOT/scripts/build-plugin-dist.sh"
+
+echo "build-plugin-dist.sh"
+
+# Missing output argument fails
+set +e
+bash "$BUILD" >/dev/null 2>&1
+rc=$?
+set -e
+assert_exit_nonzero "$rc" "fails without an output directory"
+
+# Non-empty output directory is refused
+OUT=$(mktemp -d)
+CLEANUP_DIRS+=("$OUT")
+touch "$OUT/existing"
+set +e
+bash "$BUILD" "$OUT" >/dev/null 2>&1
+rc=$?
+set -e
+assert_exit_nonzero "$rc" "refuses a non-empty output directory"
+
+# Successful build into an empty directory
+OUT=$(mktemp -d)
+CLEANUP_DIRS+=("$OUT")
+set +e
+bash "$BUILD" "$OUT" >/dev/null 2>&1
+rc=$?
+set -e
+assert_exit_zero "$rc" "builds into an empty directory"
+
+# Shipped content
+assert_exists "$OUT/.claude-plugin/plugin.json" "ships plugin.json"
+assert_exists "$OUT/skills" "ships skills/"
+assert_exists "$OUT/commands" "ships commands/"
+assert_exists "$OUT/references/common-ground" "ships references/common-ground/"
+assert_exists "$OUT/README.md" "ships README.md"
+assert_exists "$OUT/LICENSE" "ships LICENSE"
+
+# Repo-only content stays out
+for path in .claude-plugin/marketplace.json CLAUDE.md site docs scripts assets research specs .serena .github version.json; do
+    assert_not_exists "$OUT/$path" "excludes $path"
+done
+
+# Untracked files never ship
+assert_equal "$(find "$OUT" -name 'v0.5.0-*' | wc -l | tr -d ' ')" "0" "excludes untracked files"
+
+# Every tracked skill ships
+src_count=$(cd "$REPO_ROOT" && git ls-files 'skills/*/SKILL.md' | wc -l | tr -d ' ')
+dist_count=$(find "$OUT/skills" -mindepth 2 -maxdepth 2 -name SKILL.md | wc -l | tr -d ' ')
+assert_equal "$dist_count" "$src_count" "ships every tracked skill"
+
+echo ""
+echo "Results: $PASS passed, $FAIL failed"
+[ "$FAIL" -eq 0 ]
```

---

### Incident Patch 5: `f7982b45` (2026-10-03)
**Commit Message**: fix(common-ground): move reference files out of commands/

Files under commands/ are treated as commands, so the plugin directory
validator flagged the three reference files for missing frontmatter
(FRONTMATTER_MISSING). Move them to references/common-ground/ and
point COMMAND.md at them via ${CLAUDE_PLUGIN_ROOT}, which Claude Code
substitutes in command bodies; a bare relative path has no documented
base directory for commands. Closes #244.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01HkedNdra6Vrj4rfWvWEF2V

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -11,6 +11,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - `CLAUDE.md`: "When Accepting Contributions" section documenting the maintainer procedure for external issues and PRs (the `gratitude` label on every contribution, fit discussion before merge, squash-merge subject format, separate changelog commit under `[Unreleased]`, count sync in the same push, and the `### Contributors` credit format at release). Previously this lived only in git history
 
 ### Changed
+- `common-ground` command: moved its three reference files from `commands/common-ground/references/` to `references/common-ground/` and pointed `COMMAND.md` at them via `${CLAUDE_PLUGIN_ROOT}`. Files under `commands/` are treated as commands (the plugin directory flagged them for missing frontmatter), and a bare relative `references/` path in a command body has no documented base directory to resolve against, closing #244
 - `security-reviewer` and `spec-miner`: removed `Bash` from `allowed-tools`. An unscoped `Bash` entry pre-approves every shell command while the skill is active, which the Claude plugin directory holds for policy review. spec-miner never runs shell commands; security-reviewer's scanners (and active tools such as nmap and sqlmap) now go through normal per-command user approval, closing #243
 
 ### Fixed
```

**File**: `commands/common-ground/COMMAND.md` (modified, +7/-7)
```diff
@@ -35,9 +35,9 @@ Load detailed guidance based on context:
 
 | Topic | Reference | Load When |
 |-------|-----------|-----------|
-| Assumption Types & Tiers | `references/assumption-classification.md` | Classifying assumptions, determining type or tier |
-| File Management | `references/file-management.md` | Storage operations, project ID, ground file format |
-| Reasoning Graph | `references/reasoning-graph.md` | Using --graph flag, generating mermaid diagrams |
+| Assumption Types & Tiers | `${CLAUDE_PLUGIN_ROOT}/references/common-ground/assumption-classification.md` | Classifying assumptions, determining type or tier |
+| File Management | `${CLAUDE_PLUGIN_ROOT}/references/common-ground/file-management.md` | Storage operations, project ID, ground file format |
+| Reasoning Graph | `${CLAUDE_PLUGIN_ROOT}/references/common-ground/reasoning-graph.md` | Using --graph flag, generating mermaid diagrams |
 
 ---
 
@@ -70,7 +70,7 @@ When no flags provided, execute the two-phase interactive flow.
    - Check existing ground file for tracked assumptions
 
 2. **Classify each assumption** by type and proposed tier:
-   - See `references/assumption-classification.md` for classification rules
+   - See `${CLAUDE_PLUGIN_ROOT}/references/common-ground/assumption-classification.md` for classification rules
 
 3. **Present to user via AskUserQuestion:**
 
@@ -117,7 +117,7 @@ When no flags provided, execute the two-phase interactive flow.
 4. **Write ground file:**
    - Save to `~/.claude/common-ground/{project_id}/COMMON-GROUND.md`
    - Update `ground.index.json` for machine-readable access
-   - See `references/file-management.md` for file formats
+   - See `${CLAUDE_PLUGIN_ROOT}/references/common-ground/file-management.md` for file formats
 
 ### Output
 
@@ -231,7 +231,7 @@ Make the shape of Claude's reasoning visible:
    - What alternatives were considered at each branch?
    - What confidence level exists at each node?
 
-3. **Generate mermaid diagram** following conventions in `references/reasoning-graph.md`
+3. **Generate mermaid diagram** following conventions in `${CLAUDE_PLUGIN_ROOT}/references/common-ground/reasoning-graph.md`
 
 4. **Output files:**
    - Update `COMMON-GROUND.md` with embedded `## Reasoning Graph` section
@@ -286,7 +286,7 @@ Run `/common-ground --list` to view assumptions.
 Run `/common-ground --graph` to regenerate after changes.
 ```
 
-See `references/reasoning-graph.md` for detailed mermaid conventions and node styling.
+See `${CLAUDE_PLUGIN_ROOT}/references/common-ground/reasoning-graph.md` for detailed mermaid conventions and node styling.
 
 ---
 
```

---

### Incident Patch 6: `6a02aba8` (2026-10-03)
**Commit Message**: fix(skills): remove unscoped Bash from security-reviewer and spec-miner allowed-tools

An unscoped Bash entry pre-approves every shell command while the skill
is active, which the Claude plugin directory holds for policy review
(ALLOWED_TOOLS_BROAD). spec-miner never runs shell commands, and
security-reviewer's scanners and active tools (nmap, sqlmap) should go
through per-command user approval. Closes #243.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01HkedNdra6Vrj4rfWvWEF2V

**File**: `CHANGELOG.md` (modified, +3/-0)
```diff
@@ -10,6 +10,9 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 ### Added
 - `CLAUDE.md`: "When Accepting Contributions" section documenting the maintainer procedure for external issues and PRs (the `gratitude` label on every contribution, fit discussion before merge, squash-merge subject format, separate changelog commit under `[Unreleased]`, count sync in the same push, and the `### Contributors` credit format at release). Previously this lived only in git history
 
+### Changed
+- `security-reviewer` and `spec-miner`: removed `Bash` from `allowed-tools`. An unscoped `Bash` entry pre-approves every shell command while the skill is active, which the Claude plugin directory holds for policy review. spec-miner never runs shell commands; security-reviewer's scanners (and active tools such as nmap and sqlmap) now go through normal per-command user approval, closing #243
+
 ### Fixed
 - `flutter-expert/SKILL.md`: the Riverpod provider example used `StateNotifierProvider`/`StateNotifier`, legacy since Riverpod 2.0 and contradicting the skill's own `references/riverpod-state.md`; replaced with the equivalent `NotifierProvider`/`Notifier` pattern and updated the troubleshooting table to match (#237)
 - Plugin install commands in README, QUICKSTART, the docs site landing page, and generated `llms.txt` used `fullstack-dev-skills@jeffallan`, which fails because the marketplace is declared as `fullstack-dev-skills`; corrected to `fullstack-dev-skills@fullstack-dev-skills`, including the QUICKSTART uninstall troubleshooting step, closing #234 (#236)
```

**File**: `skills/security-reviewer/SKILL.md` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 name: security-reviewer
 description: Identifies security vulnerabilities, generates structured audit reports with severity ratings, and provides actionable remediation guidance. Use when conducting security audits, reviewing code for vulnerabilities, or analyzing infrastructure security. Invoke for SAST scans, penetration testing, DevSecOps practices, cloud security reviews, dependency audits, secrets scanning, or compliance checks. Produces vulnerability reports, prioritized recommendations, and compliance checklists.
 license: MIT
-allowed-tools: Read, Grep, Glob, Bash
+allowed-tools: Read, Grep, Glob
 metadata:
   author: https://github.com/Jeffallan
   version: "1.1.1"
```

**File**: `skills/spec-miner/SKILL.md` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 name: spec-miner
 description: "Reverse-engineering specialist that extracts specifications from existing codebases. Use when working with legacy or undocumented systems, inherited projects, or old codebases with no documentation. Invoke to map code dependencies, generate API documentation from source, identify undocumented business logic, figure out what code does, or create architecture documentation from implementation. Trigger phrases: reverse engineer, old codebase, no docs, no documentation, figure out how this works, inherited project, legacy analysis, code archaeology, undocumented features."
 license: MIT
-allowed-tools: Read, Grep, Glob, Bash
+allowed-tools: Read, Grep, Glob
 metadata:
   author: https://github.com/Jeffallan
   version: "1.1.0"
```

---

### Incident Patch 7: `0e810290` (2026-10-03)
**Commit Message**: docs(changelog): record #237 flutter-expert Notifier fix under Unreleased

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01HkedNdra6Vrj4rfWvWEF2V

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -11,6 +11,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - `CLAUDE.md`: "When Accepting Contributions" section documenting the maintainer procedure for external issues and PRs (the `gratitude` label on every contribution, fit discussion before merge, squash-merge subject format, separate changelog commit under `[Unreleased]`, count sync in the same push, and the `### Contributors` credit format at release). Previously this lived only in git history
 
 ### Fixed
+- `flutter-expert/SKILL.md`: the Riverpod provider example used `StateNotifierProvider`/`StateNotifier`, legacy since Riverpod 2.0 and contradicting the skill's own `references/riverpod-state.md`; replaced with the equivalent `NotifierProvider`/`Notifier` pattern and updated the troubleshooting table to match (#237)
 - Plugin install commands in README, QUICKSTART, the docs site landing page, and generated `llms.txt` used `fullstack-dev-skills@jeffallan`, which fails because the marketplace is declared as `fullstack-dev-skills`; corrected to `fullstack-dev-skills@fullstack-dev-skills`, including the QUICKSTART uninstall troubleshooting step, closing #234 (#236)
 - README banner (capsule-render URL) still displayed 66 skills after the v0.4.16 release; the counts are URL-encoded inside the image URL where no `<!-- SKILL_COUNT -->` marker can live, so `update-docs.py` never touched them. The script now rewrites the banner's `desc=` parameter from computed counts
 
```

---

### Incident Patch 8: `236d367a` (2026-10-03)
**Commit Message**: fix(flutter-expert): replace legacy StateNotifier example with modern Notifier pattern (#237)

Replace the StateNotifierProvider/StateNotifier example in SKILL.md with the equivalent NotifierProvider/Notifier pattern (legacy since Riverpod 2.0), matching references/riverpod-state.md. Update the troubleshooting table mention for consistency.

**File**: `skills/flutter-expert/SKILL.md` (modified, +6/-7)
```diff
@@ -56,13 +56,12 @@ Load detailed guidance based on context:
 ### Riverpod Provider + ConsumerWidget (correct pattern)
 
 ```dart
-// provider definition
-final counterProvider = StateNotifierProvider<CounterNotifier, int>(
-  (ref) => CounterNotifier(),
-);
+// provider definition — Notifier, not the legacy StateNotifier
+final counterProvider = NotifierProvider<CounterNotifier, int>(CounterNotifier.new);
 
-class CounterNotifier extends StateNotifier<int> {
-  CounterNotifier() : super(0);
+class CounterNotifier extends Notifier<int> {
+  @override
+  int build() => 0;
   void increment() => state = state + 1; // new instance, never mutate
 }
 
@@ -127,7 +126,7 @@ class GoodCounter extends ConsumerWidget {
 | Widget test assertion failures | Widget tree mismatch or async state not settled | Use `tester.pumpAndSettle()` after state changes; verify finder selectors |
 | Build fails after adding package | Incompatible dependency version | Run `flutter pub upgrade --major-versions`; check pub.dev compatibility |
 | Jank / dropped frames | Expensive `build()` calls, uncached widgets, heavy main-thread work | Use `RepaintBoundary`, move heavy work to `compute()`, add `const` |
-| Hot reload not reflecting changes | State held in `StateNotifier` not reset | Use hot restart (`R` in terminal) to reset full app state |
+| Hot reload not reflecting changes | State held in `Notifier` not reset | Use hot restart (`R` in terminal) to reset full app state |
 
 ## Output Templates
 
```

---

### Incident Patch 9: `7d835a6c` (2026-10-03)
**Commit Message**: docs(changelog): record #236 marketplace install command fix under Unreleased

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01HkedNdra6Vrj4rfWvWEF2V

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -11,6 +11,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - `CLAUDE.md`: "When Accepting Contributions" section documenting the maintainer procedure for external issues and PRs (the `gratitude` label on every contribution, fit discussion before merge, squash-merge subject format, separate changelog commit under `[Unreleased]`, count sync in the same push, and the `### Contributors` credit format at release). Previously this lived only in git history
 
 ### Fixed
+- Plugin install commands in README, QUICKSTART, the docs site landing page, and generated `llms.txt` used `fullstack-dev-skills@jeffallan`, which fails because the marketplace is declared as `fullstack-dev-skills`; corrected to `fullstack-dev-skills@fullstack-dev-skills`, including the QUICKSTART uninstall troubleshooting step, closing #234 (#236)
 - README banner (capsule-render URL) still displayed 66 skills after the v0.4.16 release; the counts are URL-encoded inside the image URL where no `<!-- SKILL_COUNT -->` marker can live, so `update-docs.py` never touched them. The script now rewrites the banner's `desc=` parameter from computed counts
 
 ## [0.4.16] - 2026-08-07
```

---

### Incident Patch 10: `86faa977` (2026-10-03)
**Commit Message**: fix(docs): correct marketplace name in install commands (#236)

Use the declared `fullstack-dev-skills` marketplace name in plugin install and uninstall examples across README, QUICKSTART, docs site index, and generated llms text. Fixes #234.

**File**: `QUICKSTART.md` (modified, +2/-2)
```diff
@@ -10,7 +10,7 @@ Get up and running with the Fullstack Dev Skills Plugin.
 /plugin marketplace add jeffallan/claude-skills
 
 # Install the plugin
-/plugin install fullstack-dev-skills@jeffallan
+/plugin install fullstack-dev-skills@fullstack-dev-skills
 
 # Restart Claude Code when prompted
 ```
@@ -120,7 +120,7 @@ Include relevant information:
 ### Skills Not Loading After Install
 1. Verify the plugin is installed: `/plugin list`
 2. Check for conflicting skill names in `~/.claude/skills/`
-3. Try reinstalling: `/plugin uninstall fullstack-dev-skills@jeffallan` then reinstall
+3. Try reinstalling: `/plugin uninstall fullstack-dev-skills@fullstack-dev-skills` then reinstall
 
 ### How to Update
 ```bash
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@
 ```
 **Then, install the skills:**
 ```bash
-/plugin install fullstack-dev-skills@jeffallan
+/plugin install fullstack-dev-skills@fullstack-dev-skills
 ```
 
 For all installation methods and first steps, see the [**Quick Start Guide**](QUICKSTART.md).
```

**File**: `site/scripts/sync-content.mjs` (modified, +1/-1)
```diff
@@ -576,7 +576,7 @@ Transform Claude Code into your expert pair programmer across the entire develop
 \`\`\`
 
 \`\`\`bash
-/plugin install fullstack-dev-skills@jeffallan
+/plugin install fullstack-dev-skills@fullstack-dev-skills
 \`\`\`
 
 ## Stats
```

**File**: `site/src/content/docs/index.mdx` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ import { Card, CardGrid } from '@astrojs/starlight/components';
 ```
 
 ```bash
-/plugin install fullstack-dev-skills@jeffallan
+/plugin install fullstack-dev-skills@fullstack-dev-skills
 ```
 
 See the [Getting Started guide](/claude-skills/getting-started/) for all installation methods and first steps.
```

---

### Incident Patch 11: `882ef55e` (2026-08-07)
**Commit Message**: fix(docs): update skill count in README banner; teach update-docs.py to manage it

The capsule-render banner embeds counts URL-encoded in the image URL,
where no marker comment can live, so it stayed at 66 skills through the
v0.4.16 release. update-docs.py now rewrites the banner's desc=
parameter from computed counts, matching the existing marker-less
version-badge treatment.

Co-Authored-By: Claude Fable 5 <[REDACTED_EMAIL]>
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

### Incident Patch 12: `fb678157` (2026-08-07)
**Commit Message**: fix(devops-engineer): operationalize production-deploy approval gate in core workflow

The constraints said never to deploy to production without explicit
approval, but the workflow's deploy step proceeded straight to rollout.
The workflow now determines the target environment and, for production
or customer-facing targets, requires presenting the deployment summary
and rollback plan and receiving explicit approval first. Mirrors the
terraform-engineer gate added in #213. Closes #196, closes #212.

Co-Authored-By: Claude Fable 5 <[REDACTED_EMAIL]>
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

### Incident Patch 13: `d0e7f4e8` (2026-08-07)
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

### Incident Patch 14: `10fe40c8` (2026-08-07)
**Commit Message**: docs(changelog): record #216 Cohere key fix under Unreleased

Co-Authored-By: Claude Fable 5 <[REDACTED_EMAIL]>
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

### Incident Patch 15: `d759b157` (2026-08-07)
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

#### Recent Merged Pull Requests:
- **PR #249** (2026-10-03): chore: release v0.4.18 (@Jeffallan)
- **PR #248** (2026-10-03): chore: release v0.4.17 (@Jeffallan)
- **PR #237** (2026-10-03): fix(flutter-expert): replace legacy StateNotifier example with modern Notifier pattern (@KoreaMango)
- **PR #236** (2026-10-03): Fix marketplace name in installation commands (@shijian0-eng)
- **PR #230** (closed): fix(readme): repair broken star history chart (@Dessalines39394)
- **PR #227** (2026-08-07): chore: release v0.4.16 (@Jeffallan)
- **PR #225** (2026-08-07): fix: broken relative reference paths in vue-expert-js and react-expert (@vasugarg09)
- **PR #224** (closed): feat: add lms-platform-architect skill (@MD-ALL-SHAHRIA)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
