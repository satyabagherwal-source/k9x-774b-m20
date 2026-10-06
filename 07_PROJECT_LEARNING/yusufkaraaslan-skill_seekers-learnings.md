# Forensic Learning Record (Deep Inspection): yusufkaraaslan/Skill_Seekers

> **Canonical Artifact**: `07_PROJECT_LEARNING/yusufkaraaslan-skill_seekers-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/yusufkaraaslan/Skill_Seekers](https://github.com/yusufkaraaslan/Skill_Seekers))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:17:53.902Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `yusufkaraaslan/Skill_Seekers`
- **Description**: Convert documentation websites, GitHub repositories, and PDFs into Claude AI skills with automatic conflict detection
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 15105 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/llama-index-query-engine/quickstart.py`
```
#!/usr/bin/env python3
"""
LlamaIndex Query Engine Quickstart

This example shows how to:
1. Load Skill Seekers nodes
2. Create a VectorStoreIndex
3. Build a query engine
4. Query the documentation with chat mode

Requirements:
    pip install llama-index llama-index-llms-openai llama-index-embeddings-openai

Environment:
    export OPENAI_API_KEY=sk-...
"""

import json
from pathlib import Path

from llama_index.core.schema import TextNode
from llama_index.core import VectorStoreIndex, StorageContext


def load_nodes(json_path: str) -> list[TextNode]:
    """
    Load TextNodes from Skill Seekers JSON output.

    Args:
        json_path: Path to skill-seekers generated JSON file

    Returns:
        List of LlamaIndex TextNode objects
    """
    with open(json_path) as f:
        nodes_data = json.load(f)

    nodes = [
        TextNode(
            text=node["text"],
            metadata=node["metadata"],
            id_=node["id_"]
        )
        for node in nodes_data
    ]

    print(f"✅ Loaded {len(nodes)} nodes")

    # Show category breakdown
    categories = {}
    for node in nodes:
        cat = node.metadata.get('category', 'unknown')
        categories[cat] = categories.get(cat, 0) + 1

    print(f"   Categories: {dict(sorted(categories.items()))}")

    return nodes


def create_index(nodes: list[TextNode], persist_dir: str = "./storage") -> VectorStoreIndex:
    """
    Create a VectorStoreIndex from nodes.

    Args:
        nodes: List of TextNode objects
        persist_dir: Directory to persist the index

    Returns:
        VectorStoreIndex instance
    """
    # Create index
    index = VectorStoreIndex(nodes)

    # Persist to disk
    index.storage_context.persist(persist_dir=persist_dir)

    print(f"✅ Index created and persisted to: {persist_dir}")
    print(f"   Nodes indexed: {len(nodes)}")

    return index


def query_examples(index: VectorStoreIndex) -> None:
    """
    Run example queries to demonstrate functionality.

    Args:
        index: VectorStoreIndex instance
    """
    print("\n" + "="*60)
    print("EXAMPLE QUERIES")
    print("="*60 + "\n")

    # Create query engine
    query_engine = index.as_query_engine(
        similarity_top_k=3,
        response_mode="compact"
    )

    example_queries = [
        "What is this documentation about?",
        "How do I get started?",
        "Show me some code examples",
    ]

    for query in example_queries:
        print(f"QUERY: {query}")
        print("-" * 60)

        response = query_engine.query(query)
        print(f"ANSWER:\n{response}\n")

        print("SOURCES:")
        for i, node in enumerate(response.source_nodes, 1):
            cat = node.metadata.get('category', 'unknown')
            file_name = node.metadata.get('file', 'unknown')
            score = node.score if hasattr(node, 'score') else 'N/A'
            print(f"  {i}. {cat} ({file_name}) - Score: {score}")
        print("\n")


def interactive_chat(index: VectorStoreIndex) -> None:
    """
    Start an interactive chat session.

    Args:
        index: VectorStoreIndex instance
    """
    print("="*60)
    print("INTERACTIVE CHAT MODE")
    print("="*60)
    print("Ask questions about the documentation (type 'quit' to exit)\n")

    # Create chat engine with memory
    chat_engine = index.as_chat_engine(
        chat_mode="condense_question",
        verbose=False
    )

    while True:
        user_input = input("You: ").strip()

        if user_input.lower() in ['quit', 'exit', 'q']:
            print("\n👋 Goodbye!")
            break

        if not user_input:
            continue

        try:
            response = chat_engine.chat(user_input)
            print(f"\nAssistant: {response}\n")

            # Show sources
            if hasattr(response, 'source_nodes') and response.source_nodes:
                print("Sources:")
                for node in response.source_nodes[:3]:  # Show top 3
                    cat = node.metadata.get('category', 'unknown')
                    file_name = node.metadata.get('file', 'unknown')
                    print(f"  - {cat} ({file_name})")
                print()

        except Exception as e:
            print(f"\n❌ Error: {e}\n")


def main():
    """
    Main execution flow.
    """
    print("="*60)
    print("LLAMAINDEX QUERY ENGINE QUICKSTART")
    print("="*60)
    print()

    # Configuration
    DOCS_PATH = "../../output/django-llama-index.json"  # Adjust path as needed
    STORAGE_DIR = "./storage"

    # Check if documents exist
    if not Path(DOCS_PATH).exists():
        print(f"❌ Documents not found at: {DOCS_PATH}")
        print("\nGenerate documents first:")
        print("  1. skill-seekers create --config configs/django.json")
        print("  2. skill-seekers package output/django --target llama-index")
        print("\nOr adjust DOCS_PATH in the script to point to your documents.")
        return

    # Step 1: Load nodes
    print("Step 1: Loading nodes...")
    nodes = load_nodes(DOCS_PATH)
    print()

    # Step 2: Create index
    print("Step 2: Creating index...")
    index = create_index(nodes, STORAGE_DIR)
    print()

    # Step 3: Run example queries
    print("Step 3: Running example queries...")
    query_examples(index)

    # Step 4: Interactive chat
    interactive_chat(index)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n👋 Interrupted. Goodbye!")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        print("\nMake sure you have:")
        print("  1. Set OPENAI_API_KEY environment variable")
        print("  2. Installed required packages:")
        print("     pip install llama-index llama-index-llms-openai llama-index-embeddings-openai")

```

### Core Architecture Module: `scripts/render_sponsors.py`
```
#!/usr/bin/env python3
"""Render sponsor placements from ``sponsors.json`` into the READMEs and SPONSORS.md.

``sponsors.json`` is the single source of truth. This script rewrites the content
between the sponsor markers in every ``README*.md`` and regenerates ``SPONSORS.md``,
so adding a sponsor is a one-file edit instead of 13 hand edits.

Markers (already present in each README)::

    <!-- SPONSORS:START -->  ... generated ...  <!-- SPONSORS:END -->

All tiers render in that single block as ``###`` subheadings, ordered from the
highest tier down - the layout used by FastAPI and every comparable project.
Tier value is expressed by order and logo size, not by scattering placements
across the page.

Only logos/links are generated; the surrounding prose stays hand-maintained so the
translated READMEs keep their own wording.

Usage::

    python scripts/render_sponsors.py --write   # apply
    python scripts/render_sponsors.py --check   # CI drift guard (non-zero on drift)
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

REPO_ROOT = Path(__file__).resolve().parent.parent
SPONSORS_FILE = REPO_ROOT / "sponsors.json"
SPONSORS_MD = REPO_ROOT / "SPONSORS.md"

# Tier render order, highest first. Order and logo size carry the hierarchy.
TIERS = ("partners", "platinum", "gold", "silver", "bronze")

# Logo width (px) per tier - Gold "large", Silver "medium", Bronze "small".
TIER_WIDTH = {
    "partners": 200,
    "platinum": 200,
    "gold": 180,
    "silver": 140,
    "bronze": 100,
}

TIER_LABEL = {
    "partners": "Launch Partner",
    "platinum": "Platinum Sponsors",
    "gold": "Gold Sponsors",
    "silver": "Silver Sponsors",
    "bronze": "Bronze Sponsors",
}

# Caption under each logo. Rule 2 requires paid placements to be explicitly
# labelled, so every tier except the grandfathered partner says "Sponsor".
TIER_CAPTION = {
    "partners": "Launch Partner",
    "platinum": "Sponsor — Platinum",
    "gold": "Sponsor — Gold",
    "silver": "Sponsor — Silver",
    "bronze": "Sponsor — Bronze",
}

# SPONSORSHIP.md rule 4 (link policy): standard UTM parameters are allowed for
# traffic measurement. Affiliate, referral and click-tracking parameters are not.
#
# This is a blocklist rather than an allowlist on purpose - sponsors legitimately
# use product parameters (?plan=pro, ?lang=en) that the policy says nothing about.
DISALLOWED_PARAMS = re.compile(
    r"^("
    r"ref|referrer|referral|refid|"  # referral
    r"aff|affid|affiliate|partner|pid|"  # affiliate
    r"fbclid|gclid|msclkid|dclid|twclid|ttclid|irclickid|clickid|"  # click IDs
    r"mc_[a-z]+|_hs[a-z]*"  # mailchimp / hubspot analytics
    r")$",
    re.I,
)


class PolicyError(ValueError):
    """Raised when sponsor data violates the published sponsorship policy."""


def _assert_clean_url(name: str, url: str) -> None:
    """Reject sponsor URLs carrying affiliate or click-tracking parameters.

    SPONSORSHIP.md rule 4 permits standard UTM parameters (``utm_source``,
    ``utm_medium``, ``utm_campaign``) so sponsors can measure traffic, but
    forbids affiliate/referral parameters and analytics injection.
    """
    query = urlsplit(url).query
    if not query:
        return
    offenders = sorted(k for k in parse_qs(query) if DISALLOWED_PARAMS.match(k))
    if offenders:
        raise PolicyError(
            f"{name}: sponsor URL carries affiliate/tracking parameters {offenders} - "
            f"rule 4 of SPONSORSHIP.md permits standard UTM parameters only.\n  {url}"
        )


def load_sponsors() -> dict:
    """Load and validate sponsors.json."""
    data = json.loads(SPONSORS_FILE.read_text(encoding="utf-8"))
    for tier in TIERS:
        for entry in data.get(tier, []):
            _assert_clean_url(entry["name"], entry["url"])
            for key in ("logo", "logo_svg"):
                path = entry.get(key)
                if path and not (REPO_ROOT / path).is_file():
                    raise PolicyError(f"{entry['name']}: {key} not found at {path}")
    return data


def _logo_html(entry: dict, tier: str) -> str:
    """Render one logo, captioned with its paid-placement label (rule 2).

    ``logo`` is deliberately a raster: README.md is also the PyPI project
    description, and SVG is not reliably rendered there. ``logo_svg`` keeps the
    vector source alongside it for the website.
    """
    width = entry.get("width", TIER_WIDTH[tier])
    caption = TIER_CAPTION.get(tier, "Sponsor")
    return (
        f'  <a href="{entry["url"]}">'
        f'<img src="{entry["logo"]}" alt="{entry["name"]}" width="{width}"></a>'
        f"<br/><sub><b>{caption}</b></sub>"
    )


def render_sponsors(data: dict) -> str:
    """Render every tier into one block, highest tier first."""
    out: list[str] = []
    for tier in TIERS:
        entries = data.get(tier, [])
        if not entries:
            continue
        out.append(f"### {TIER_LABEL[tier]}\n")
        out.append('<p align="center">')
        out.extend(_logo_html(e, tier) for e in entries)
        out.append("</p>\n")
        # Platinum (and grandfathered partners) may carry a short approved blurb.
        for e in entries:
            if e.get("blurb"):
                out.append(f"[{e['name']}]({e['url']}) — {e['blurb']}\n")
    return "\n".join(out).rstrip() if out else ""


def _replace_block(text: str, marker: str, body: str) -> str:
    """Replace everything between the ``START``/``END`` markers for ``marker``."""
    pattern = re.compile(
        rf"<!-- {marker}:START -->.*?<!-- {marker}:END -->",
        re.DOTALL,
    )
    if not pattern.search(text):
        return text
    rendered = f"<!-- {marker}:START -->\n{body}\n<!-- {marker}:END -->"
    # lambda avoids backslash/group-reference interpretation in the replacement
    return pattern.sub(lambda _m: rendered, text)


def render_sponsors_md(data: dict) -> str:
    """Full sponsor roll, including the Supporter tier (names only)."""
    lines = [
        "# Sponsors",
        "",
        "Skill Seekers is maintained in the open. These sponsors keep it that way.",
        "",
        f"Interested? See **[SPONSORSHIP.md]({data['policy']})** for tiers and rules, "
        f"or sponsor directly at [GitHub Sponsors]({data['sponsors_url']}).",
        "",
        "> All placements on this page are paid sponsorships and are labelled as such.",
        "> Sponsorship buys placement, not endorsement - see the rules in SPONSORSHIP.md.",
        "",
    ]
    any_listed = False
    for tier in TIERS:
        entries = data.get(tier, [])
        if not entries:
            continue
        any_listed = True
        lines += [f"## {TIER_LABEL[tier]}", ""]
        for e in entries:
            detail = e.get("note") or (f"since {e['since']}" if e.get("since") else "")
            suffix = f" — {detail}" if detail else ""
            lines.append(f"- [{e['name']}]({e['url']}){suffix}")
        lines.append("")

    supporters = data.get("supporters", [])
    lines += ["## Supporters", ""]
    if supporters:
        any_listed = True
        lines += [f"- {s}" for s in supporters]
    else:
        lines.append(f"_No supporters yet - [be the first]({data['sponsors_url']})._")
    lines.append("")

    if not any_listed:
        lines.insert(6, "_No sponsors yet._\n")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--write", action="store_true", help="apply changes")
    group.add_argument("--check", action="store_true", help="fail if files are out of date")
    args = parser.parse_args(argv)

    try:
        data = load_sponsors()
    except PolicyError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    block = render_sponsors(data)
    drifted: list[str] = []

    for readme in sorted(REPO_ROOT.glob("README*.md")):
        original = readme.read_text(encoding="utf-8")
        updated = _replace_block(original, "SPONSORS", block)
        if updated != original:
            drifted.append(readme.name)
            if args.write:
                readme.write_text(updated, encoding="utf-8")

    sponsors_md = render_sponsors_md(data)
    if not SPONSORS_MD.is_file() or SPONSORS_MD.read_text(encoding="utf-8") != sponsors_md:
        drifted.append(SPONSORS_MD.name)
        if args.write:
            SPONSORS_MD.write_text(sponsors_md, encoding="utf-8")

    if args.check and drifted:
        print(
            "error: sponsor placements are out of date with sponsors.json:\n  "
            + "\n  ".join(drifted)
            + "\n\nRun: python scripts/render_sponsors.py --write",
            file=sys.stderr,
        )
        return 1

    action = "updated" if args.write else "would update"
    print(f"{action} {len(drifted)} file(s)" if drifted else "sponsor placements up to date")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

```

### Core Architecture Module: `src/skill_seekers/cli/browser_renderer.py`
```
"""
Browser Renderer — Playwright-based headless browser for JavaScript SPA sites.

When documentation sites use client-side rendering (React, Vue, etc.),
requests.get() returns empty HTML shells. This module uses Playwright
to render JavaScript before extracting content.

Optional dependency: pip install "skill-seekers[browser]"
"""

from __future__ import annotations

import logging
import subprocess
import sys

logger = logging.getLogger(__name__)


def _check_playwright_available() -> bool:
    """Check if playwright package is installed."""
    try:
        import playwright  # noqa: F401

        return True
    except ImportError:
        return False


def _auto_install_chromium() -> bool:
    """Auto-install Chromium browser on first use.

    Returns:
        True if install succeeded or already installed, False on failure.
    """
    logger.info("Installing Chromium browser for headless rendering...")
    try:
        result = subprocess.run(
            [sys.executable, "-m", "playwright", "install", "chromium"],
            capture_output=True,
            text=True,
            timeout=300,
        )
        if result.returncode == 0:
            logger.info("Chromium installed successfully.")
            return True
        logger.error("Chromium install failed: %s", result.stderr)
        return False
    except Exception as e:
        logger.error("Failed to install Chromium: %s", e)
        return False


class BrowserRenderer:
    """Render JavaScript pages using Playwright headless Chromium.

    Usage:
        renderer = BrowserRenderer()
        html = renderer.render_page("https://docs.discord.com")
        renderer.close()

    Or as context manager:
        with BrowserRenderer() as renderer:
            html = renderer.render_page(url)
    """

    def __init__(
        self,
        timeout: int = 60000,
        wait_until: str = "domcontentloaded",
        extra_wait: int = 0,
    ):
        """Initialize renderer.

        Args:
            timeout: Page load timeout in milliseconds (default: 60s)
            wait_until: Playwright wait condition — "networkidle", "load", "domcontentloaded"
                        Default changed to "domcontentloaded" for better compatibility
                        with heavy sites (Unity docs, DocFX, etc.) that never reach networkidle.
            extra_wait: Additional milliseconds to wait after page load for lazy-loaded
                        navigation/content (e.g., 5000 for DocFX sidebar). Default: 0.
        """
        if not _check_playwright_available():
            raise ImportError(
                "Playwright is required for --browser mode.\n"
                "Install it with: pip install 'skill-seekers[browser]'\n"
                "Then run: playwright install chromium"
            )

        self._timeout = timeout
        self._wait_until = wait_until
        self._extra_wait = extra_wait
        self._playwright = None
        self._browser = None
        self._context = None

    def _ensure_browser(self) -> None:
        """Launch browser if not already running. Auto-installs chromium if needed."""
        if self._browser is not None:
            return

        from playwright.sync_api import sync_playwright

        self._playwright = sync_playwright().start()

        try:
            self._browser = self._playwright.chromium.launch(headless=True)
        except Exception:
            # Browser not installed — try auto-install
            logger.warning("Chromium not found. Attempting auto-install...")
            if _auto_install_chromium():
                self._browser = self._playwright.chromium.launch(headless=True)
            else:
                self._playwright.stop()
                self._playwright = None
                raise RuntimeError(
                    "Could not launch Chromium. Run: playwright install chromium"
                ) from None

        self._context = self._browser.new_context(user_agent="Mozilla/5.0 (Documentation Scraper)")

    def render_page(self, url: str) -> str:
        """Render a page with JavaScript execution and return the HTML.

        Args:
            url: URL to render

        Returns:
            Fully-rendered HTML string after JavaScript execution

        Raises:
            RuntimeError: If browser cannot be launched
            TimeoutError: If page load times out
        """
        self._ensure_browser()

        page = self._context.new_page()
        try:
            page.goto(url, wait_until=self._wait_until, timeout=self._timeout)
            if self._extra_wait > 0:
                page.wait_for_timeout(self._extra_wait)
            html = page.content()
            return html
        finally:
            page.close()

    def close(self) -> None:
        """Shut down browser and Playwright."""
        if self._context:
            self._context.close()
            self._context = None
        if self._browser:
            self._browser.close()
            self._browser = None
        if self._playwright:
            self._playwright.stop()
            self._playwright = None

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()

```

### Core Architecture Module: `src/skill_seekers/cli/parsers/extractors/quality_scorer.py`
```
"""
Quality Scoring for Document Content

Provides consistent quality scoring across all parsers for:
- Code blocks (syntax, structure, patterns)
- Tables (completeness, formatting)
- Content blocks (readability, structure)
"""

import re

from .unified_structure import Table, ContentBlock


class QualityScorer:
    """Score the quality of extracted content."""

    # Language patterns for detection and validation
    LANGUAGE_PATTERNS = {
        "python": {
            "keywords": ["def ", "class ", "import ", "from ", "return ", "if ", "for ", "while"],
            "syntax_checks": [
                (r":\s*$", "colon_ending"),  # Python uses colons for blocks
                (r"def\s+\w+\s*\([^)]*\)\s*:", "function_def"),
                (r"class\s+\w+", "class_def"),
            ],
        },
        "javascript": {
            "keywords": ["function", "const ", "let ", "var ", "=>", "return ", "if(", "for("],
            "syntax_checks": [
                (r"function\s+\w+\s*\(", "function_def"),
                (r"const\s+\w+\s*=", "const_decl"),
                (r"=>", "arrow_function"),
            ],
        },
        "typescript": {
            "keywords": ["interface ", "type ", ": string", ": number", ": boolean", "implements"],
            "syntax_checks": [
                (r"interface\s+\w+", "interface_def"),
                (r":\s*(string|number|boolean|any)", "type_annotation"),
            ],
        },
        "java": {
            "keywords": ["public ", "private ", "class ", "void ", "String ", "int ", "return "],
            "syntax_checks": [
                (r"public\s+class\s+\w+", "class_def"),
                (r"public\s+\w+\s+\w+\s*\(", "method_def"),
            ],
        },
        "cpp": {
            "keywords": [
                "#include",
                "using namespace",
                "std::",
                "cout",
                "cin",
                "public:",
                "private:",
            ],
            "syntax_checks": [
                (r'#include\s*[<"]', "include"),
                (r"std::", "std_namespace"),
            ],
        },
        "csharp": {
            "keywords": ["namespace ", "public class", "private ", "void ", "string ", "int "],
            "syntax_checks": [
                (r"namespace\s+\w+", "namespace"),
                (r"public\s+class\s+\w+", "class_def"),
            ],
        },
        "go": {
            "keywords": ["package ", "func ", "import ", "return ", "if ", "for ", "range "],
            "syntax_checks": [
                (r"func\s+\w+\s*\(", "function_def"),
                (r"package\s+\w+", "package_decl"),
            ],
        },
        "rust": {
            "keywords": ["fn ", "let ", "mut ", "impl ", "struct ", "enum ", "match ", "use "],
            "syntax_checks": [
                (r"fn\s+\w+\s*\(", "function_def"),
                (r"impl\s+\w+", "impl_block"),
            ],
        },
        "gdscript": {  # Godot
            "keywords": [
                "extends ",
                "class_name ",
                "func ",
                "var ",
                "const ",
                "signal ",
                "export",
                "onready",
            ],
            "syntax_checks": [
                (r"extends\s+\w+", "extends"),
                (r"func\s+_\w+", "built_in_method"),
                (r"signal\s+\w+", "signal_def"),
                (r"@export", "export_annotation"),
            ],
        },
        "yaml": {
            "keywords": [],
            "syntax_checks": [
                (r"^\w+:\s*", "key_value"),
                (r"^-\s+\w+", "list_item"),
            ],
        },
        "json": {
            "keywords": [],
            "syntax_checks": [
                (r'["\']\w+["\']\s*:', "key_value"),
                (r"\{[^}]*\}", "object"),
                (r"\[[^\]]*\]", "array"),
            ],
        },
        "xml": {
            "keywords": [],
            "syntax_checks": [
                (r"<\w+[^>]*>", "opening_tag"),
                (r"</\w+>", "closing_tag"),
            ],
        },
        "sql": {
            "keywords": [
                "SELECT",
                "FROM",
                "WHERE",
                "INSERT",
                "UPDATE",
                "DELETE",
                "CREATE",
                "TABLE",
            ],
            "syntax_checks": [
                (r"SELECT\s+.+\s+FROM", "select_statement"),
                (r"CREATE\s+TABLE", "create_table"),
            ],
        },
        "bash": {
            "keywords": ["#!/bin/", "echo ", "if [", "then", "fi", "for ", "do", "done"],
            "syntax_checks": [
                (r"#!/bin/\w+", "shebang"),
                (r"\$\w+", "variable"),
            ],
        },
    }

    def score_code_block(self, code: str, language: str | None = None) -> float:
        """
        Score a code block for quality (0-10).

        Args:
            code: The code content
            language: Detected or specified language

        Returns:
            Quality score from 0-10
        """
        score = 5.0  # Start neutral

        if not code or not code.strip():
            return 0.0

        code = code.strip()
        lines = [line for line in code.split("\n") if line.strip()]

        # Factor 1: Length appropriateness
        code_len = len(code)
        if 50 <= code_len <= 1000:
            score += 1.0
        elif code_len > 2000:
            score -= 1.0  # Too long
        elif code_len < 20:
            score -= 2.0  # Too short

        # Factor 2: Line count
        if 3 <= len(lines) <= 50:
            score += 1.0
        elif len(lines) > 100:
            score -= 0.5

        # Factor 3: Language-specific validation
        if language and language in self.LANGUAGE_PATTERNS:
            lang_patterns = self.LANGUAGE_PATTERNS[language]

            # Check for keywords
            keyword_matches = sum(1 for kw in lang_patterns["keywords"] if kw in code)
            if keyword_matches >= 2:
                score += 1.0

            # Check for syntax patterns
            syntax_matches = sum(
                1
                for pattern, _ in lang_patterns["syntax_checks"]
                if re.search(pattern, code, re.MULTILINE)
            )
            if syntax_matches >= 1:
                score += 1.0

        # Factor 4: Structural quality
        # Check for function/class definitions
        if re.search(r"\b(def|function|func|fn|class|public class)\b", code):
            score += 1.5

        # Check for meaningful variable names (not just x, y, i)
        meaningful_vars = re.findall(r"\b[a-z_][a-z0-9_]{3,}\b", code.lower())
        if len(meaningful_vars) >= 3:
            score += 0.5

        # Factor 5: Syntax validation (generic)
        is_valid, issues = self._validate_syntax(code, language)
        if is_valid:
            score += 1.0
        else:
            score -= len(issues) * 0.3

        # Factor 6: Comment/code ratio
        comment_lines = sum(
            1 for line in lines if line.strip().startswith(("#", "//", "/*", "*", "--", "<!--"))
        )
        if len(lines) > 0:
            comment_ratio = comment_lines / len(lines)
            if 0.1 <= comment_ratio <= 0.4:
                score += 0.5  # Good comment ratio
            elif comment_ratio > 0.6:
                score -= 1.0  # Too many comments

        # Clamp to 0-10
        return max(0.0, min(10.0, score))

    def _validate_syntax(self, code: str, language: str | None) -> tuple[bool, list[str]]:
        """Basic syntax validation."""
        issues = []

        # Check for balanced braces/brackets
        pairs = [("{", "}"), ("[", "]"), ("(", ")")]
        for open_char, close_char in pairs:
            open_count = code.count(open_char)
            close_count = code.count(close_char)
            if abs(open_count - close_count) > 2:
                issues.append(f"Unbalanced {open_char}{close_char}")

        # Check for common natural language indicators
        common_words = ["the", "and", "for", "with", "this", "that", "have", "from", "they"]
        word_count = sum(1 for word in common_words if f" {word} " in code.lower())
        if word_count > 5 and len(code.split()) < 100:
            issues.append("May be natural language")

        # Language-specific checks
        if language == "python":
            # Check for mixed indentation
            indent_chars = set()
            for line in code.split("\n"):
                if line.startswith(" "):
                    indent_chars.add("space")
                elif line.startswith("\t"):
                    indent_chars.add("tab")
            if len(indent_chars) > 1:
                issues.append("Mixed tabs and spaces")

        elif language == "json":
            try:
                import json

                json.loads(code)
            except Exception as e:
                issues.append(f"Invalid JSON: {str(e)[:50]}")

        return len(issues) == 0, issues

    def score_table(self, table: Table) -> float:
        """
        Score a table for quality (0-10).

        Args:
            table: The table to score

        Returns:
            Quality score from 0-10
        """
        score = 5.0

        # Factor 1: Has headers
        if table.headers:
            score += 1.0

        # Factor 2: Consistent column count
        if table.rows:
            col_counts = [len(row) for row in table.rows]
            if len(set(col_counts)) == 1:
                score += 1.0  # Consistent
            else:
                score -= 1.0  # Inconsistent

        # Factor 3: Reasonable size
        if 2 <= table.num_rows <= 100:
            score += 0.5
        elif table.num_rows > 500:
            score -= 0.5

        if 2 <= table.num_cols <= 10:
            score += 0.5
        elif table.num_cols > 20:
            score -= 0.5

        # Factor 4: Non-empty cells
        if tab
```

### Core Architecture Module: `src/skill_seekers/cli/scraper_utils.py`
```
"""
Shared helpers for the source-type scrapers.

Single home for small utilities that were copy-pasted across many
``*_scraper.py`` modules:

- ``score_code_quality``: a 0-10 heuristic for code blocks. Six scrapers had a
  byte-identical version and asciidoc a formatting-only variant; jupyter added
  notebook-specific rules (docstring/magic-line bonuses, all-magic penalty),
  now gated behind ``notebook_mode``.
- ``extract_table_from_html``: pull headers/rows from a BeautifulSoup ``<table>``
  (was byte-identical in the word and epub scrapers).
- ``reference_filename``: basename for a category's reference .md file (was
  near-identical in the word/pdf/epub/html/pptx/asciidoc/jupyter scrapers).
"""

import logging
import re
from pathlib import Path

logger = logging.getLogger(__name__)


def reference_filename(
    pages: list[dict],
    section_num: int,
    total_sections: int,
    base_stem: str = "",
    *,
    number_key: str = "section_number",
    prefix: str = "s",
) -> str:
    """Basename of a category's reference file — the single source of truth
    shared by the file writer, index.md, and the SKILL.md nav, so the links
    can't drift from the actual filenames (DOC-07).

    Args:
        pages: The category's page/section dicts.
        section_num: 1-based category index (used for the empty fallback).
        total_sections: Total number of categories being written.
        base_stem: Source-file stem (e.g. ``Path(self.docx_path).stem``).
        number_key: Dict key holding each page's number (pdf uses
            ``"page_number"``; everything else ``"section_number"``).
        prefix: Range prefix in the filename (pdf uses ``"p"``).
    """
    if not pages:
        return f"section_{section_num:02d}.md"
    nums = [p.get(number_key, i + 1) for i, p in enumerate(pages)]
    if total_sections == 1:
        return f"{base_stem}.md" if base_stem else "main.md"
    base_name = base_stem or "section"
    return f"{base_name}_{prefix}{min(nums)}-{prefix}{max(nums)}.md"


def parse_leading_int(value, default: int = 0) -> int:
    """Parse the leading integer from a dimension-ish value, defensively.

    HTML/EPUB/Word width/height attributes can be ``"100%"``, ``"50px"``,
    ``""`` or ``None``; a bare ``int("100%")`` raises ``ValueError`` (crashing
    image extraction) or silently drops the image. Returns the leading integer
    (``"100%"`` -> 100, ``"50px"`` -> 50) or ``default`` when there's none
    (``"auto"``/``""``/``None`` -> ``default``).
    """
    if value is None:
        return default
    match = re.match(r"\s*(-?\d+)", str(value))
    return int(match.group(1)) if match else default


def score_code_quality(code: str, *, notebook_mode: bool = False) -> float:
    """Heuristic quality score for a code block (0.0-10.0).

    Scores on line count, definitions, imports, indentation and operators;
    short snippets are penalized. With ``notebook_mode=True`` (Jupyter), also
    rewards docstrings and ``%`` magic lines, and penalizes cells that are
    entirely ``%``/``!`` magic/shell lines.

    Args:
        code: Source code string.
        notebook_mode: Enable Jupyter-notebook-specific scoring rules.

    Returns:
        Quality score between 0.0 and 10.0.
    """
    if not code:
        return 0.0

    score = 5.0
    lines = code.strip().split("\n")
    line_count = len(lines)

    # More lines = more substantial
    if line_count >= 10:
        score += 2.0
    elif line_count >= 5:
        score += 1.0

    # Has function/class definitions
    if re.search(r"\b(def |class |function |func |fn )", code):
        score += 1.5

    # Has imports/require
    if re.search(r"\b(import |from .+ import|require\(|#include|using )", code):
        score += 0.5

    # Has indentation (structured code)
    if re.search(r"^    ", code, re.MULTILINE):
        score += 0.5

    # Has assignment, operators, or common code syntax
    if re.search(r"[=:{}()\[\]]", code):
        score += 0.3

    if notebook_mode:
        # Has a docstring
        if re.search(r'""".*?"""|\'\'\'.*?\'\'\'', code, re.DOTALL):
            score += 0.3
        # Has a magic line
        if re.search(r"^%", code, re.MULTILINE):
            score += 0.2

    # Very short snippets get penalized
    if len(code) < 30:
        score -= 2.0

    if notebook_mode:
        # Penalize cells that are entirely magic/shell commands
        non_magic = [ln for ln in lines if ln.strip() and not ln.strip().startswith(("%", "!"))]
        if line_count > 0 and not non_magic:
            score -= 1.0

    return min(10.0, max(0.0, score))


def extract_table_from_html(table_elem) -> dict | None:
    """Extract headers and rows from a BeautifulSoup <table> element."""
    headers = []
    rows = []

    # Try <thead> first for headers
    thead = table_elem.find("thead")
    if thead:
        header_row = thead.find("tr")
        if header_row:
            headers = [th.get_text(strip=True) for th in header_row.find_all(["th", "td"])]

    # Body rows. Prefer an explicit <tbody>; otherwise take rows directly under
    # the table but skip any that belong to <thead> — skipping STRUCTURALLY, not
    # by value, so a legitimate body row that merely duplicates the header text
    # isn't dropped.
    tbody = table_elem.find("tbody")
    if tbody is not None:
        body_rows = tbody.find_all("tr")
    else:
        body_rows = [r for r in table_elem.find_all("tr") if r.find_parent("thead") is None]
    for row in body_rows:
        cells = [td.get_text(strip=True) for td in row.find_all(["td", "th"])]
        if cells:
            rows.append(cells)

    # If no explicit thead, use first row as header
    if not headers and rows:
        headers = rows.pop(0)

    if not headers and not rows:
        return None

    return {"headers": headers, "rows": rows}


def read_reference_markdown(
    references_dir: Path | str,
    *,
    max_chars: int = 200_000,
    max_file_chars: int = 30_000,
) -> dict[str, str]:
    """Read ``*.md`` files under ``references_dir`` into a bounded mapping.

    Single reader shared by the platform adaptors and the unified enhancement
    path so an enhancement prompt can never grow without limit: each file is
    capped at ``max_file_chars`` and reading stops once ``max_chars`` have been
    collected. Unified builds copy whole PDF/EPUB reference trees under
    ``references/`` (#453), so an unbounded read would exceed any model's
    context window on a multi-book config.

    Keys are POSIX paths relative to ``references_dir`` so same-name files in
    different sub-skill namespaces (``pdf/0_a/references/index.md`` vs
    ``pdf/1_b/references/index.md``) do not overwrite each other. Files are
    visited in sorted order so truncation is deterministic.
    """
    references_dir = Path(references_dir)
    if not references_dir.exists():
        return {}

    references: dict[str, str] = {}
    total_chars = 0
    for ref_file in sorted(references_dir.rglob("*.md")):
        if total_chars >= max_chars:
            break
        try:
            content = ref_file.read_text(encoding="utf-8", errors="ignore")
        except OSError as exc:
            logger.warning("Could not read %s: %s", ref_file, exc)
            continue
        if len(content) > max_file_chars:
            content = content[:max_file_chars] + "\n\n...(truncated)"
        references[ref_file.relative_to(references_dir).as_posix()] = content
        total_chars += len(content)
    return references

```

### Core Architecture Module: `src/skill_seekers/cli/utils.py`
```
#!/usr/bin/env python3
"""
Utility functions for Skill Seeker CLI tools
"""

import bisect
import logging
import os
import platform
import subprocess
import time
from collections.abc import Callable
from pathlib import Path
from typing import TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")


def setup_logging(verbose: bool = False, quiet: bool = False) -> None:
    """Configure root logging level based on verbosity flags.

    Args:
        verbose: Enable DEBUG level logging
        quiet: Enable WARNING level logging only (suppress INFO)
    """
    if quiet:
        level = logging.WARNING
    elif verbose:
        level = logging.DEBUG
    else:
        level = logging.INFO
    logging.basicConfig(level=level, format="%(message)s", force=True)


def open_folder(folder_path: str | Path) -> bool:
    """
    Open a folder in the system file browser

    Args:
        folder_path: Path to folder to open

    Returns:
        bool: True if successful, False otherwise
    """
    folder_path = Path(folder_path).resolve()

    if not folder_path.exists():
        print(f"⚠️  Folder not found: {folder_path}")
        return False

    system = platform.system()

    try:
        if system == "Linux":
            # Try xdg-open first (standard)
            subprocess.run(["xdg-open", str(folder_path)], check=True)
        elif system == "Darwin":  # macOS
            subprocess.run(["open", str(folder_path)], check=True)
        elif system == "Windows":
            subprocess.run(["explorer", str(folder_path)], check=True)
        else:
            print(f"⚠️  Unknown operating system: {system}")
            return False

        return True

    except subprocess.CalledProcessError:
        print("⚠️  Could not open folder automatically")
        return False
    except FileNotFoundError:
        print("⚠️  File browser not found on system")
        return False


def has_api_key() -> bool:
    """
    Check if any AI API key is set in environment.

    Checks: ANTHROPIC_API_KEY, MOONSHOT_API_KEY, GOOGLE_API_KEY, OPENAI_API_KEY

    Returns:
        bool: True if any API key is set, False otherwise
    """
    for env_var in ("ANTHROPIC_API_KEY", "MOONSHOT_API_KEY", "GOOGLE_API_KEY", "OPENAI_API_KEY"):
        if os.environ.get(env_var, "").strip():
            return True
    return False


def get_api_key() -> str | None:
    """
    Get the first available AI API key from environment.

    Checks: ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, MOONSHOT_API_KEY,
            GOOGLE_API_KEY, OPENAI_API_KEY

    Returns:
        str: API key or None if not set
    """
    for env_var in (
        "ANTHROPIC_API_KEY",
        "ANTHROPIC_AUTH_TOKEN",
        "MOONSHOT_API_KEY",
        "GOOGLE_API_KEY",
        "OPENAI_API_KEY",
    ):
        key = os.environ.get(env_var, "").strip()
        if key:
            return key
    return None


def get_upload_url() -> str:
    """
    Get the skills upload URL

    Returns:
        str: Skills upload URL
    """
    return "https://claude.ai/skills"


def print_upload_instructions(zip_path: str | Path) -> None:
    """
    Print clear upload instructions for manual upload

    Args:
        zip_path: Path to the .zip file to upload
    """
    zip_path = Path(zip_path)

    print()
    print("╔══════════════════════════════════════════════════════════╗")
    print("║                     NEXT STEP                            ║")
    print("╚══════════════════════════════════════════════════════════╝")
    print()
    print(f"📤 Upload to platform: {get_upload_url()}")
    print()
    print(f"1. Go to {get_upload_url()}")
    print('2. Click "Upload Skill"')
    print(f"3. Select: {zip_path}")
    print("4. Done! ✅")
    print()


def format_file_size(size_bytes: int) -> str:
    """
    Format file size in human-readable format

    Args:
        size_bytes: Size in bytes

    Returns:
        str: Formatted size (e.g., "45.3 KB")
    """
    if size_bytes < 1024:
        return f"{size_bytes} bytes"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    else:
        return f"{size_bytes / (1024 * 1024):.1f} MB"


def validate_skill_directory(skill_dir: str | Path) -> tuple[bool, str | None]:
    """
    Validate that a directory is a valid skill directory

    Args:
        skill_dir: Path to skill directory

    Returns:
        tuple: (is_valid, error_message)
    """
    skill_path = Path(skill_dir)

    if not skill_path.exists():
        return False, f"Directory not found: {skill_dir}"

    if not skill_path.is_dir():
        return False, f"Not a directory: {skill_dir}"

    skill_md = skill_path / "SKILL.md"
    if not skill_md.exists():
        return False, f"SKILL.md not found in {skill_dir}"

    return True, None


def validate_zip_file(zip_path: str | Path) -> tuple[bool, str | None]:
    """
    Validate that a file is a valid skill .zip file

    Args:
        zip_path: Path to .zip file

    Returns:
        tuple: (is_valid, error_message)
    """
    zip_path = Path(zip_path)

    if not zip_path.exists():
        return False, f"File not found: {zip_path}"

    if not zip_path.is_file():
        return False, f"Not a file: {zip_path}"

    if zip_path.suffix != ".zip":
        return False, f"Not a .zip file: {zip_path}"

    return True, None


def read_reference_files(
    skill_dir: str | Path, max_chars: int = 100000, preview_limit: int = 40000
) -> dict[str, dict]:
    """Read reference files from a skill directory with enriched metadata.

    This function reads markdown files from the references/ subdirectory
    of a skill, applying both per-file and total content limits.
    Returns enriched metadata including source type, confidence, and path.

    Args:
        skill_dir (str or Path): Path to skill directory
        max_chars (int): Maximum total characters to read (default: 100000)
        preview_limit (int): Maximum characters per file (default: 40000)

    Returns:
        dict: Dictionary mapping filename to metadata dict with keys:
            - 'content': File content
            - 'source': Source type (documentation/github/pdf/api/codebase_analysis)
            - 'confidence': Confidence level (high/medium/low)
            - 'path': Relative path from references directory
            - 'repo_id': Repository identifier for multi-source (e.g., 'encode_httpx'), None for single-source

    Example:
        >>> refs = read_reference_files('output/react/', max_chars=50000)
        >>> refs['documentation/api.md']['source']
        'documentation'
        >>> refs['documentation/api.md']['confidence']
        'high'
    """
    from pathlib import Path

    skill_path = Path(skill_dir)
    references_dir = skill_path / "references"
    references: dict[str, dict] = {}

    if not references_dir.exists():
        print(f"⚠ No references directory found at {references_dir}")
        return references

    def _determine_source_metadata(relative_path: Path) -> tuple[str, str, str | None]:
        """Determine source type, confidence level, and repo_id from path.

        For multi-source support, extracts repo_id from paths like:
        - codebase_analysis/encode_httpx/ARCHITECTURE.md -> repo_id='encode_httpx'
        - github/README.md -> repo_id=None (single source)

        Returns:
            tuple: (source_type, confidence_level, repo_id)
        """
        path_str = str(relative_path)
        repo_id = None  # Default: no repo identity

        # Documentation sources (official docs)
        if path_str.startswith("documentation/"):
            return "documentation", "high", None

        # GitHub sources
        elif path_str.startswith("github/"):
            # README and releases are medium confidence
            if "README" in path_str or "releases" in path_str:
                return "github", "medium", None
            # Issues are low confidence (user reports)
            elif "issues" in path_str:
                return "github", "low", None
            else:
                return "github", "medium", None

        # PDF sources (books, manuals)
        elif path_str.startswith("pdf/"):
            return "pdf", "high", None

        # Merged API (synthesized from multiple sources)
        elif path_str.startswith("api/"):
            return "api", "high", None

        # Codebase analysis (C3.x automated analysis)
        elif path_str.startswith("codebase_analysis/"):
            # Extract repo_id from path: codebase_analysis/{repo_id}/...
            parts = Path(path_str).parts
            if len(parts) >= 2:
                repo_id = parts[1]  # e.g., 'encode_httpx', 'encode_httpcore'

            # ARCHITECTURE.md is high confidence (comprehensive)
            if "ARCHITECTURE" in path_str:
                return "codebase_analysis", "high", repo_id
            # Patterns and examples are medium (heuristic-based)
            elif "patterns" in path_str or "examples" in path_str:
                return "codebase_analysis", "medium", repo_id
            # Configuration is high (direct extraction)
            elif "configuration" in path_str:
                return "codebase_analysis", "high", repo_id
            else:
                return "codebase_analysis", "medium", repo_id

        # Video tutorial sources (video_*.md from video scraper)
        elif relative_path.name.startswith("video_"):
            return "video_tutorial", "high", None

        # Conflicts report (discrepancy detection)
        elif "conflicts" in path_str:
            return "conflicts", "medium", None

        # Fallback
        else:
            return "unknown", "medium", None

    total_chars = 0
    # Search recursively for all .md files (including subdirectories like github/README.md)
    for ref_file in sorted(references_dir.rglob("*.md")):
        # Note: We now include index.md files as they contain important content
        # (patterns, examples, configuration analysis)

        content = 
```

### Core Architecture Module: `src/skill_seekers/mcp/tools/subprocess_utils.py`
```
"""
Shared subprocess helper for MCP tools.

Runs a subprocess while concurrently draining stdout/stderr on reader threads,
so a child that produces a lot of output never deadlocks on a full OS pipe
buffer. This replaces the old ``select``-based polling loop, which did not work
on Windows (``select`` does not support pipes there) and would freeze on large
outputs such as documentation scraping.

All MCP tool modules import ``run_subprocess_with_streaming`` from here so the
implementation lives in exactly one place.
"""

import subprocess
import threading

# Grace period (seconds) for the reader threads to drain buffered output once
# the process has exited or been killed. Normally they hit EOF immediately when
# the write ends close; the bound prevents a grandchild that inherited the pipe
# from hanging the caller forever (so ``timeout`` always bounds wall-clock).
_DRAIN_GRACE_SECONDS = 10


def run_subprocess_with_streaming(cmd: list[str], timeout: int = None) -> tuple[str, str, int]:
    """
    Run a subprocess, streaming stdout/stderr via concurrent reader threads.

    The reader threads keep the OS pipe buffers drained, so the child never
    blocks writing to a full pipe (the deadlock the old ``select`` loop hit on
    Windows). On timeout the process is killed and a marker is appended to
    stderr.

    Args:
        cmd: Command to run as a list of strings.
        timeout: Maximum seconds to wait (None for no timeout).

    Returns:
        Tuple of (stdout, stderr, returncode).
    """
    try:
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )

        stdout_lines: list[str] = []
        stderr_lines: list[str] = []

        def _read(stream, target: list[str]) -> None:
            for line in stream:
                target.append(line)

        t_out = threading.Thread(target=_read, args=(process.stdout, stdout_lines), daemon=True)
        t_err = threading.Thread(target=_read, args=(process.stderr, stderr_lines), daemon=True)
        t_out.start()
        t_err.start()

        try:
            process.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()  # Ensure the process has terminated
            stderr_lines.append(f"\nTimeout: process killed after exceeding {timeout} seconds.")

        # Bounded join: the threads normally finish as soon as the write ends
        # close; the grace stops an inherited-pipe grandchild from hanging us.
        t_out.join(_DRAIN_GRACE_SECONDS)
        t_err.join(_DRAIN_GRACE_SECONDS)

        return "".join(stdout_lines), "".join(stderr_lines), process.returncode or 0

    except Exception as e:
        return "", f"Error running subprocess: {str(e)}", 1

```

### Core Architecture Module: `ui/src/hooks/use-draft.ts`
```
import { useEffect, useState } from 'react';

/** Preserve non-secret form drafts across navigation and refresh in this tab. */
export function useDraft<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(key);
      return raw === null ? initial : JSON.parse(raw) as T;
    } catch { return initial; }
  });
  useEffect(() => {
    try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
  }, [key, value]);
  return [value, setValue] as const;
}

```

### Core Architecture Module: `ui/src/hooks/use-mobile.ts`
```
import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}

```

### Core Architecture Module: `ui/src/hooks/use-pagination.ts`
```
import { useState } from 'react';
import { PAGE_SIZES } from '@/lib/data';

// ── Paging ───────────────────────────────────────────────────────────────────
const DEFAULT_PAGE_SIZE = 25;

function readPageSize(listKey: string): number {
  try {
    const v = Number(localStorage.getItem(`seeker.pageSize.${listKey}`));
    return (PAGE_SIZES as readonly number[]).includes(v) ? v : DEFAULT_PAGE_SIZE;
  } catch {
    return DEFAULT_PAGE_SIZE;
  }
}

export function usePagination<T>(items: T[], listKey: string, resetKey: string) {
  const [pageSize, setPageSizeState] = useState<number>(() => readPageSize(listKey));
  // page is remembered together with the filter key + size it was chosen for;
  // any change to either means "start over at page 1" without an effect
  const [pageState, setPageState] = useState({ page: 1, key: resetKey, size: pageSize });
  const page = pageState.key === resetKey && pageState.size === pageSize ? pageState.page : 1;

  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pageCount);
  const slice = items.slice((current - 1) * pageSize, current * pageSize);

  const setPage = (p: number) => setPageState({ page: p, key: resetKey, size: pageSize });
  const setPageSize = (n: number) => {
    setPageSizeState(n);
    try {
      localStorage.setItem(`seeker.pageSize.${listKey}`, String(n));
    } catch {
      /* storage unavailable — size still applies for this session */
    }
  };

  return { slice, page: current, pageCount, pageSize, total, setPage, setPageSize };
}

```

### Core Architecture Module: `ui/src/hooks/use-payload.ts`
```
import { useEffect, useRef, useState } from 'react';

/**
 * Load one read-only payload for a routed page.
 *
 * Read endpoints (skill detail, config detail, workflows, environment, recent
 * analyses) bypass the store on purpose — only mutations need `act`'s shared
 * in-flight guard. `key` is the identity of what is being loaded: the fetch
 * re-runs when it changes, a late response for a previous key is dropped, and
 * a result is only handed back while it still belongs to the current key (so
 * switching skills shows the loading state, never the previous skill).
 */
export function usePayload<T>(load: () => Promise<T>, key: string) {
  // The loader closes over props and is a new function every render; keeping
  // it in a ref keeps `key` the only trigger. The ref is refreshed in its own
  // effect — effects run in declaration order, so it is current before the
  // fetch below runs.
  const loadRef = useRef(load);
  const [state, setState] = useState<{ key: string | null; data: T | null; error: string }>(
    { key: null, data: null, error: '' },
  );
  const [nonce, setNonce] = useState(0);

  useEffect(() => { loadRef.current = load; });

  useEffect(() => {
    let active = true;
    loadRef.current()
      .then((data) => { if (active) setState({ key, data, error: '' }); })
      .catch((e) => { if (active) setState({ key, data: null, error: e instanceof Error ? e.message : String(e) }); });
    return () => { active = false; };
  }, [key, nonce]);

  const fresh = state.key === key;
  return {
    data: fresh ? state.data : null,
    error: fresh ? state.error : '',
    reload: () => setNonce((n) => n + 1),
  };
}

```

### Core Architecture Module: `ui/src/lib/utils.ts`
```
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #425** (2026-07-16): **FactoryDetector matches 'get' as a substring: every getter inflates Factory confidence (plain POJO -> Factory 0.90); Singleton unreachable in Java; dependency graph emits 0 edges**
  *Symptoms*: ## Summary  `FactoryDetector` matches its keywords as **substrings**, so **every Java class with a getter is reported as a `Factory` pattern** — and because `"getInstance"` contains `"get"`, a canonical Singleton is *misclassified* as `Factory` rather than detected as `Singleton`.  Separately, `SingletonDetector.detect_deep()` is **structurally unreachable for Java/C#/C++**, so it can never correct the misclassification.  Net effect: on Java input, GoF detection has very low precision, and `Singleton` never fires.  Verified against **v3.8.0 (current PyPI release)** and the **`development` branch** (both identical in the relevant code).  ### Why this is not fixable by tuning confidence thresholds  This is likely the **root cause** behind the over-detection already reported in **#240** (905 patterns across 173 files; Strategy ×206; Decorator ×225) and **#362** (9238 patterns detected). #240 was addressed by *raising confidence thresholds* — but that cannot fix this class of false positive:  ```java public class Person {                       // plain data class, zero patterns     private String name; private int age;     public String getName() { return name; }     public void setName(String n) { this.name = n; }     public int getAge() { return age; } } ``` **Actual: `Factory(0.80)`** — at/above the *critical* (0.8) tier.  Worse: **confidence scales monotonically with the number of getters**, because each getter matches `"get"` and adds to the score:  | plain data class with… 
  **Post-Mortem & Fix Analysis**:
  > Triage confirmed — all three claims verified against `pattern_recognizer.py`: (1) `factory_method_names` includes bare `"get"` with substring matching (:567-571), and `detect_deep` adds +0.3 per matching method +0.2 for ≥2, reproducing the reported 0.6/0.8/0.9 getter scaling; (2) the Singleton constructor check only matches `__new__/__init__/constructor`, so Java class-named constructors are unreachable and the instance-field check is a commented-out future enhancement — 0.4 < 0.5 threshold, exactly as reported; (3) the dependency-graph edge fix in v3.8.0 (dotted→slash suffix resolution) evidently doesn't cover your case, and the suggested warn-on-0-edges is not implemented. Your proposed fixes (drop `"get"", word-boundary matching, class-named constructors, instance-field check) all look right — a PR would be very welcome!
  > Fixed in #429 (merged) — and thank you @saitrsh for an outstanding report. 🙏 Every claim reproduced *exactly* as written: POJO → `Factory(0.80)`, getter-count confidence scaling, `Config.java` → `Factory(0.60)`, the 0.4 Singleton cap, and your "why the test suite doesn't catch this" section turned out even more right than you knew — fixing the Factory bug *broke* `test_analyze_singleton_code`, which had been passing **only because** the substring bug emitted a bogus Factory for its genuine Python singleton.  What shipped: - **Factory**: creation verbs (`create/make/build/new/construct`) match as prefixes at a word boundary; `get*/set*/is*/has*` excluded outright — your suggested fix #1, as specified. - **Singleton**: class-named constructors recognized (your fix #2), plus an overridden `__new__` now counts by itself. Canonical `Config.java` → `Singleton(0.70)`. Your fix #4 (precedence) became unnecessary — the `getInstance` conflict resolves naturally once `get` stops matching. - **Re

- **Issue #412** (2026-07-16): **Docs: documented `docker pull` images aren't pullable + image name is inconsistent across docs**
  *Symptoms*: ## Summary  The `docker pull` commands in the docs don't work for an anonymous user, and the image name is written three different (inconsistent) ways across the docs. A user following any of the install/deployment guides cannot actually pull the image.  ## What I verified  The Docker Publish workflow **succeeds** and pushes two images — `${DOCKER_USERNAME}/skill-seekers` and `${DOCKER_USERNAME}/skill-seekers-mcp` (see `.github/workflows/docker-publish.yml` matrix). But none of the documented tags are anonymously pullable:  - `https://hub.docker.com/v2/repositories/skillseekers/skill-seekers/` → **HTTP 404** - Registry manifest with a valid **anonymous** pull token → **HTTP 401** for `3.8.0`, `3.7.0`, **and** `latest`  A 404 on the Hub API plus a 401 on the registry (even with an anon token) across every tag is the signature of a **private** repository — i.e. the published repo is private, or it lives under a `DOCKER_USERNAME` namespace different from the documented `skillseekers`. Either way, the documented `docker pull` fails for end users.  This is **not new to v3.8.0** — `3.7.0` and `latest` behave identically, so it's a long-standing state of the publish/visibility setup.  ## Inconsistent image names in the docs  Three different names are used, only one of which matches the workflow's image (`skill-seekers`):  | File | Line | Documented reference | |------|------|----------------------| | `docs/getting-started/01-installation.md` | 232 / 238 | `skillseekers/skill-seekers
  **Post-Mortem & Fix Analysis**:
  > The image reference should have one source of truth shared by the publish workflow and docs, ideally a repository variable or generated snippet, so namespace changes cannot drift across four guides. CI can authenticate only for push, then run an anonymous manifest pull for every documented tag after publication; that catches a private repository as well as a wrong name. The same check should cover the MCP image and pin examples to a release tag while explaining what `latest` means. 

- **Issue #222** (2025-12-30): **fix: Missing py.typed file in package_data**
  *Symptoms*: ## 🐛 Issue Description  The `pyproject.toml` declares `py.typed` in package_data, but the file doesn't exist in the repository:  ```toml [tool.setuptools.package-data] skill_seekers = ["py.typed"] ```  **File Status:** ❌ `src/skill_seekers/py.typed` does not exist  ## 📊 Impact  - **Severity:** LOW - **Affects:** Type checker tools (mypy, pyright, pylance) - **User Impact:** Minimal - only affects developers using type checkers - **Current Behavior:** Warning during package build (non-critical)  ## ✅ Solution Options  ### Option 1: Create the file (Recommended) Enable PEP 561 type checking support: ```bash touch src/skill_seekers/py.typed git add src/skill_seekers/py.typed git commit -m "feat: Add py.typed for PEP 561 type checking support" ```  **Benefits:** - Enables type checkers to use inline type hints - Follows Python typing best practices - Improves IDE autocomplete/intellisense  ### Option 2: Remove from package_data If type checking support is not needed: ```toml # Remove this section from pyproject.toml: [tool.setuptools.package-data] skill_seekers = ["py.typed"] ```  ## 🔍 Discovery  Found during comprehensive packaging audit after PR #221. See audit report for details.  ## 📋 Related  - PR #221: Fixed missing `skill_seekers.cli.adaptors` package - Post-v2.5.1 packaging improvements  ## 💡 Recommendation  **Create the py.typed file** (Option 1) to enable proper type checking support for the package. This is a one-line fix and follows Python packaging best practice

- **Issue #169** (2026-07-17): **fix: Reduce token bloat - Stop scraping closed issues and unnecessary metadata**
  *Symptoms*: ## Community Feedback  > "I'm also concerned that it's scraping things that don't need to be scraped. 'GitHub Issues (open/closed, labels, milestones)'. Why are you scraping anything but open issues? I could see maybe scraping some closed issues that are recent (and prior to a release that hasn't arrived), but I'm not sure a lot of these things are relevant. **People have token usage concerns.**"  ## The Problem  **Current behavior** (`cli/github_scraper.py:403`): ```python # Fetch recent issues (open + closed) issues = self.repo.get_issues(state='all', sort='updated', direction='desc')  # Default: max_issues = 100 ```  **What gets scraped:** - ✅ Open issues (relevant - active bugs/features) - ❌ **Closed issues** (often irrelevant historical noise) - ❌ Issue body (500 chars each × 100 issues = 50KB text) - ❌ All labels (metadata bloat) - ❌ All milestones (often outdated) - ❌ Created/updated/closed timestamps (unnecessary)  **Example:** React repo has 12,000+ closed issues. Why include these in a skill?  ## Why This Is Critical: Token Economy  ### The Token Problem  Users **pay per token** when using Claude: - Claude Pro: 200K context window, but costs more for larger skills - API usage: Direct token costs ($$$) - Sonnet: ~$3 per million input tokens  **Bloated skills = higher costs for users.**  ### Current Token Waste  Example: Scraping `facebook/react`: ``` 100 issues scraped: - 100 titles × 50 chars = 5,000 chars - 100 bodies × 500 chars = 50,000 chars - 100 × labels/miles
  **Post-Mortem & Fix Analysis**:
  > I like the idea of `Option 3: Configurable (Most Flexible)`. It would also be really useful to choose how the issues are sorted. For example, if I set a limit on the number of issues, I would like to sort them with `sort:comments-desc` so more active issues are included first.

- **Issue #115** (2025-10-20): **[H1.2] Investigate Issue #7: Laravel scraping issue**
  *Symptoms*: **Category:** 📚 Community Response | **Time:** 1-2 hours  Debug why Laravel docs don't scrape properly. **See:** FLEXIBLE_ROADMAP.md - Task H1.2
  **Post-Mortem & Fix Analysis**:
  > ## ✅ Task H1.2 Complete!  **Status:** Done  **What Was Accomplished:**  ### 1. Investigated and Fixed Issue #7 ✅  **Problem Identified:** - Django config using wrong selector (div.document doesn't exist) - Laravel config didn't exist at all - Astro config using homepage URL without proper structure - Tailwind config using wrong selector (article doesn't exist)  ### 2. Fixed All Broken Configs ✅  **Django (configs/django.json):** - ❌ Was using: `div.document` (selector doesn't exist) - ✅ Now using: `article` (extracts 6,468 chars of content) - Verified on: https://docs.djangoproject.com/en/stable/  **Laravel (configs/laravel.json) - NEW!:** - ✅ Created complete Laravel 9.x config from scratch - ✅ Selector: `#main-content` (extracts 16,131 chars) - ✅ Base URL: https://laravel.com/docs/9.x/ - ✅ Includes: 8 start_urls, proper categories - ✅ max_pages: 500  **Astro (configs/astro.json):** - ❌ Was using: homepage URL (no article element) - ✅ Now using: `/en/getting-started/` with article sel

- **Issue #98** (2025-10-22): **[F1.6] Fix package path output bug**
  *Symptoms*: **Category:** ⚡ Performance & Reliability | **Time:** 30 min  Fix incorrect path in doc_scraper.py output. **Location:** cli/doc_scraper.py:789 | **See:** FLEXIBLE_ROADMAP.md - Task F1.6
  **Post-Mortem & Fix Analysis**:
  > ✅ **This issue has been fixed!**  **Fixed in:** Commit 581dbc7 (Oct 22, 2025) - "Fix CLI path references in Python code"  **What was fixed:** All path references in `cli/doc_scraper.py` now correctly use `cli/` prefix: - Line 1153: `enhance_cmd = ['python3', 'cli/enhance_skill.py', ...]` - Line 1174: `enhance_cmd = ['python3', 'cli/enhance_skill_local.py', ...]` - Line 1183: Print statement shows correct path - Line 1189: Print statement shows correct path  **Related fixes:** The entire codebase was updated to use correct `cli/` prefixes: - cli/doc_scraper.py: 9 references fixed - cli/enhance_skill_local.py: 6 references fixed - cli/enhance_skill.py: 5 references fixed - cli/package_skill.py: 4 references fixed - cli/estimate_pages.py: 3 references fixed  **Verification:** ```bash grep "package_skill.py" cli/doc_scraper.py # Output shows: python3 cli/package_skill.py ✅ ```  **Related commits:** - 581dbc7 - Fix CLI path references in Python code - 66719cd - Fix CLI path references in do

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

### Incident Patch 1: `5b5d8dfc` (2026-09-30)
**Commit Message**: Merge main (release gate fix) into development

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `.github/workflows/release.yml` (modified, +4/-3)
```diff
@@ -33,13 +33,14 @@ jobs:
         python -m pip install --upgrade pip
         pip install -r requirements.txt
         if [ -f skill_seeker_mcp/requirements.txt ]; then pip install -r skill_seeker_mcp/requirements.txt; fi
-        # Install package in editable mode for tests (required for src/ layout)
-        pip install -e .
+        # Install package in editable mode for tests (required for src/ layout);
+        # the [ui] extra (fastapi) is needed by the Seeker HUD API tests, matching tests.yml
+        pip install -e ".[ui]"
 
     - name: Run tests
       timeout-minutes: 30
       run: |
-        pip install pytest-timeout
+        pip install pytest-timeout psutil
         python -m pytest tests/ -v \
           -m "not slow and not integration and not e2e and not network and not serial and not mcp_only" \
           --timeout=120
```

---

### Incident Patch 2: `d26c2e3e` (2026-09-30)
**Commit Message**: ci(release): install the [ui] extra and psutil for the release test gate

The tag-triggered release gate ran the fast test set without fastapi or
psutil, so the Seeker HUD API tests and the safe-runner test failed at
collection and v3.10.0 never reached the publish steps. Match tests.yml.

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `.github/workflows/release.yml` (modified, +4/-3)
```diff
@@ -33,13 +33,14 @@ jobs:
         python -m pip install --upgrade pip
         pip install -r requirements.txt
         if [ -f skill_seeker_mcp/requirements.txt ]; then pip install -r skill_seeker_mcp/requirements.txt; fi
-        # Install package in editable mode for tests (required for src/ layout)
-        pip install -e .
+        # Install package in editable mode for tests (required for src/ layout);
+        # the [ui] extra (fastapi) is needed by the Seeker HUD API tests, matching tests.yml
+        pip install -e ".[ui]"
 
     - name: Run tests
       timeout-minutes: 30
       run: |
-        pip install pytest-timeout
+        pip install pytest-timeout psutil
         python -m pytest tests/ -v \
           -m "not slow and not integration and not e2e and not network and not serial and not mcp_only" \
           --timeout=120
```

---

### Incident Patch 3: `50ffc380` (2026-09-30)
**Commit Message**: release: 3.10.0 — Seeker HUD (beta), export-workflow fix

- Bump version 3.10.0.dev0 → 3.10.0 (pyproject, _version fallbacks, uv.lock, ui package)
- Promote CHANGELOG [Unreleased] → [3.10.0] - 2026-09-30; add Seeker HUD (beta) headline,
  beta notice, #456 doctor console-script fix, #470/#471/#450 entries, merge duplicate Fixed
- Mark the Seeker HUD as beta: sidebar pill, launcher banner, docs/guides/WEB_UI.md, AGENTS.md
- Fix .github/workflows/vector-db-export.yml: inline python3 -c blocks were indented inside
  the string and raised IndentationError on every scheduled run

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `.github/workflows/vector-db-export.yml` (modified, +15/-15)
```diff
@@ -107,12 +107,12 @@ jobs:
 
           # Use adaptor directly via CLI
           python3 -c "
-          from pathlib import Path
-          from skill_seekers.cli.adaptors import get_adaptor
-          adaptor = get_adaptor('$target')
-          package_path = adaptor.package(Path('$SKILL_DIR'), Path('output'))
-          print(f'Exported to {package_path}')
-          "
+        from pathlib import Path
+        from skill_seekers.cli.adaptors import get_adaptor
+        adaptor = get_adaptor('$target')
+        package_path = adaptor.package(Path('$SKILL_DIR'), Path('output'))
+        print(f'Exported to {package_path}')
+        "
 
           if [ $? -eq 0 ]; then
             echo "✅ $target export complete"
@@ -130,15 +130,15 @@ jobs:
           echo "📊 Generating quality metrics..."
 
           python3 -c "
-          from pathlib import Path
-          from skill_seekers.cli.quality_metrics import QualityAnalyzer
-          analyzer = QualityAnalyzer(Path('$SKILL_DIR'))
-          report = analyzer.generate_report()
-          formatted = analyzer.format_report(report)
-          print(formatted)
-          with open('quality_report_${SKILL_NAME}.txt', 'w') as f:
-              f.write(formatted)
-          "
+        from pathlib import Path
+        from skill_seekers.cli.quality_metrics import QualityAnalyzer
+        analyzer = QualityAnalyzer(Path('$SKILL_DIR'))
+        report = analyzer.generate_report()
+        formatted = analyzer.format_report(report)
+        print(formatted)
+        with open('quality_report_${SKILL_NAME}.txt', 'w') as f:
+            f.write(formatted)
+        "
         fi
       continue-on-error: true
 
```

**File**: `AGENTS.md` (modified, +3/-1)
```diff
@@ -182,7 +182,9 @@ docs/                        # Documentation (guides, integrations, architecture
 
 **Supported platforms (21):** claude, gemini, openai, minimax, opencode, kimi, deepseek, qwen, openrouter, together, fireworks, markdown, langchain, llama-index, haystack, weaviate, chroma, faiss, qdrant, pinecone.
 
-## Web UI (Seeker HUD)
+## Web UI (Seeker HUD) — beta
+
+**Status: beta** (since 3.10.0). Screens, API routes and `~/.skill-seekers/ui/` state may change between minor releases; the CLI and MCP server are unaffected.
 
 Local web app: React 19 + Vite + Tailwind/shadcn frontend in `ui/`, FastAPI backend in `src/skill_seekers/web/`.
 
```

**File**: `CHANGELOG.md` (modified, +11/-4)
```diff
@@ -5,14 +5,17 @@ All notable changes to Skill Seeker will be documented in this file.
 The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
 and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
 
-## [Unreleased]
+## [3.10.0] - 2026-09-30
 
-_Development version: 3.10.0.dev0_
+**Theme:** Seeker HUD (beta) — a local web UI for the whole toolchain — plus a path-traversal security fix, three machine-readable CLI commands, an opt-in SQLite skill search index, MiniMax video input, and PDF vector-figure extraction.
+
+> **The Seeker HUD web UI is in beta.** It ships in this release for early feedback: screens, `/api/*` routes, and the UI state stored under `~/.skill-seekers/ui/` may change between minor releases without a deprecation period. The CLI, the MCP server, and every existing platform adaptor are unaffected. Please report HUD issues on GitHub.
 
 ### Security
 - **Path traversal in the `fetch_config` MCP tool (CWE-22)** (#462 reported by @Harmenszoon, fixed in PR #464 by @emecii) — the git-URL mode passed the raw `config_name` argument into `cache_dir / f"temp_{name}"`, and `clone_or_pull` both deletes that path (on `refresh` or a failed pull) and clones attacker-chosen content into it, so a crafted name could delete or overwrite directories outside the cache. The shared clone boundary now validates the cache name, and `fetch_config` validates `config_name` once for all three modes in both MCP servers (the named-source and API modes wrote `<destination>/<name>.json` from the raw name too). All name checks now go through one allowlist (`services/path_safety.validate_path_segment`: leading letter or digit, then letters, digits, `.`, `_`, `-`), which also rejects NUL bytes, whitespace and dot-files such as `.git`; the workflow, config-publisher and marketplace validators delegate to it. A failed pull on a cached clone now falls through to a fresh clone instead of deleting the cache and reporting an error.
 
 ### Added
+- **Seeker HUD (beta) — a local web app for the whole toolchain.** `pip install "skill-seekers[ui]"` then `skill-seekers ui` opens a React + FastAPI interface on `http://127.0.0.1:8770` (loopback only) with Overview, Create, Skills, Configs, Workflows, Analyze, Environment, and job-history screens; every long-running action runs as a streamed job. The built frontend is bundled into the wheel, so no Node toolchain is needed to use it. The beta status is shown in the sidebar and the launcher banner and documented in `docs/guides/WEB_UI.md`; the HUD-specific entries below describe the screens in detail.
 - **MiniMax-M3 video input and thinking modes** (#468 by @octo-patch) — `AgentClient.call_with_video()` sends a local MP4/AVI/MOV/MKV clip as an OpenAI-compatible `video_url` part (MiniMax-M3 only, 50 MB inline cap enforced before the request), and `MINIMAX_THINKING=adaptive|disabled` (or a `thinking=` call argument) is carried in the request body. Both are registry-driven — `supports_video`, `video_models`, `video_max_bytes`, `thinking_modes`, `thinking_env` on the provider entry — so `_call_api` still never branches on a provider name. The thinking mode is validated once at client construction; under the Anthropic protocol it is ignored with a warning instead of silently dropped. No built-in pipeline calls the video path yet.
 - **Opt-in SQLite search index for generated skills** (#393, PR #463 by @emecii) — `skill-seekers create <source> --index` (or `"index": true` in a config file) writes `scripts/index.db` (FTS5 with BM25, LIKE-style fallback where FTS5 is unavailable) and a stdlib-only `scripts/search.py` that returns ranked `file#anchor` pointers, and appends a search-first block to SKILL.md. Off by default, Markdown untouched, zero new dependencies; the Claude packager already ships `scripts/`. Sections are split at headings outside fenced code blocks, `index.md` table-of-contents pages are skipped, anchors follow GitHub's rules, query tokens are quoted so `NOT`/`OR` are plain words, and nothing is installed when a skill has no indexable references. Enhancement and indexing now resolve the skill directory the same way the scrapers do, including a config-file `output_dir`.
 - **`skill-seekers doctor --json`** (#459 by @Whxuan0701) — machine-readable diagnostics for CI and agents: `version`, per-check results, pass/warn/fail `summary`, `healthy` and `exit_code`, as exactly one JSON document on stdout. Import-time noise from dependencies is forwarded to stderr, a crashing check is reported as `{"error": ...}`, and `verbose_detail` (which carries masked API-key fragments) is only populated with `--verbose`, matching the human report. The `doctor` command now has a section in the CLI reference.
@@ -25,7 +28,7 @@ _Development version: 3.10.0.dev0_
   - `--min-image-size` now applies to vector figures on the same pixel basis as rasters; previously the flag silently did nothing for them.
   - Raster/vector de-duplication compares *
```

**File**: `docs/guides/WEB_UI.md` (modified, +2/-0)
```diff
@@ -1,5 +1,7 @@
 # Seeker HUD
 
+> **Beta.** The HUD ships with 3.10.0 for early feedback. Screens, `/api/*` routes, and the UI state stored under `~/.skill-seekers/ui/` may change between minor releases without a deprecation period. The CLI and MCP server are stable and unaffected; please report HUD issues on GitHub.
+
 The HUD is a local React/FastAPI interface to Skill Seekers. Install the API dependencies and build the frontend before launching from a checkout:
 
 ```bash
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ build-backend = "setuptools.build_meta"
 
 [project]
 name = "skill-seekers"
-version = "3.10.0.dev0"
+version = "3.10.0"
 description = "Convert documentation websites, GitHub repositories, and PDFs into Claude AI skills. International support with Chinese (简体中文) documentation."
 readme = "README.md"
 requires-python = ">=3.10"
```

**File**: `src/skill_seekers/_version.py` (modified, +3/-3)
```diff
@@ -28,7 +28,7 @@ def get_version() -> str:
     """
     if tomllib is None:
         # Fallback if TOML library not available
-        return "3.10.0.dev0"  # Hardcoded fallback
+        return "3.10.0"  # Hardcoded fallback
 
     try:
         # Get path to pyproject.toml (3 levels up from this file)
@@ -37,7 +37,7 @@ def get_version() -> str:
 
         if not pyproject_path.exists():
             # Fallback for installed package
-            return "3.10.0.dev0"  # Hardcoded fallback
+            return "3.10.0"  # Hardcoded fallback
 
         with open(pyproject_path, "rb") as f:
             pyproject_data = tomllib.load(f)
@@ -46,7 +46,7 @@ def get_version() -> str:
 
     except Exception:
         # Fallback if anything goes wrong
-        return "3.10.0.dev0"  # Hardcoded fallback
+        return "3.10.0"  # Hardcoded fallback
 
 
 __version__ = get_version()
```

**File**: `src/skill_seekers/cli/ui_command.py` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ def execute(self) -> int:
         app = create_app(root)
 
         url = f"http://{'[::1]' if self.args.host == '::1' else '127.0.0.1'}:{port}"
-        print(f"Seeker HUD · serving {root}")
+        print(f"Seeker HUD (beta) · serving {root}")
         print(f"→ {url}")
         if not DIST_DIR.is_dir():
             print(
```

**File**: `ui/package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "skill-seekers-ui",
-  "version": "3.9.0",
+  "version": "3.10.0",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "skill-seekers-ui",
-      "version": "3.9.0",
+      "version": "3.10.0",
       "dependencies": {
         "@hookform/resolvers": "^5.2.2",
         "@radix-ui/react-accordion": "^1.2.12",
```

---

### Incident Patch 4: `c413bc30` (2026-09-20)
**Commit Message**: fix(enhance): honour the configured default enhance level; correct enhance docs (#473)

Follow-up from triaging #465 (closed: its reported error only exists on 3.4.0 and earlier). The "Default level" set with `skill-seekers config` had been ignored by `create` since the unified command (Feb 2026); `create` now resolves CLI flag → config-file level → user default → shipped default (2), side-effect free. Test suite isolates the developer's real user config. Docstring and docs corrected; troubleshooting entry for the ≤3.4.0 error.

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -44,6 +44,8 @@ _Development version: 3.10.0.dev0_
 - Seeker HUD: opening a skill or config from any table, card, or job output now navigates to its routed page instead of opening a drawer; `/mcp` redirects to `/environment`, where the MCP tools catalogue is a collapsible panel rather than its own screen.
 
 ### Fixed
+- **The default enhancement level set with `skill-seekers config` is honoured again** — `create` resolves the level as CLI `--enhance-level` → config-file `enhancement.level` → the user's `ai_enhancement.default_enhance_level` → the shipped default (2). It had been consumed by the old dispatcher until the unified `create` command (Feb 2026) and silently ignored since, while `skill-seekers config` kept displaying it. The fresh default is now 2 everywhere (it was 1 in the config manager and 2 on the CLI). The read is side-effect free: a plain `create` still never creates a config directory.
+- **Docs** — `HOW_TO_GUIDES.md` no longer tells you to run `skill-seekers-enhance` on a single `.md` file (it takes the skill directory), and `TROUBLESHOOTING.md` explains the `unrecognized arguments: --enhance-level` error seen on 3.4.0 and earlier (raised in #465; the call path was removed in 3.5.0 — upgrade). The `arguments/enhance.py` docstring no longer claims `enhance_skill_local.py` builds from the shared table; that worker has its own narrower parser.
 - Seeker HUD: installed-plugin scan no longer reads `~/.claude/plugins/{marketplaces,repos,data}/` (catalogue clones), which over-reported skills from plugins that were never installed.
 - Seeker HUD: MCP HTTP transport is reported live only when /health identifies Skill Seekers' own server (was any listener on the port); packaging an external skill no longer writes the archive into the plugin cache.
 - Seeker HUD: a `SKILL.md` nested inside a skill directory (e.g. vercel's `ai-sdk/upstream/`) no longer shows up as a separate skill; pressing Enter in the top-bar search no longer triggers the opened drawer's first action; the Seeker MCP status cards no longer overflow; the web API test fixture now owns its own `JobManager`, so test jobs stop leaking into `~/.skill-seekers/ui/`.
```

**File**: `docs/TROUBLESHOOTING.md` (modified, +17/-0)
```diff
@@ -445,6 +445,23 @@ curl https://api.anthropic.com/v1/messages \
   -d '{"model":"claude-sonnet-4.5","max_tokens":1024,"messages":[{"role":"user","content":"Hello"}]}'
 ```
 
+### Issue: `skill-seekers-enhance: error: unrecognized arguments: --enhance-level`
+
+**Symptoms:** `skill-seekers create <url>` finishes with `⚠ Enhancement failed, but skill was still built` and the log shows `skill-seekers-enhance: error: unrecognized arguments: --enhance-level 2`. The skill is generated but `SKILL.md` is not AI-enhanced.
+
+**Cause:** Skill Seekers **3.4.0 and earlier** shelled out from the scrapers to `skill-seekers-enhance` with a flag that command never accepted. Since 3.5.0 enhancement runs inside `create` and this call no longer exists.
+
+**Solution:** upgrade.
+
+```bash
+pip install --upgrade skill-seekers
+skill-seekers doctor   # confirms the installed version
+```
+
+On 3.4.0 or earlier, run the enhancement by hand as a workaround: `skill-seekers-enhance output/<name>/` (without `--enhance-level`).
+
+---
+
 ### Issue: Enhancement Hangs/Timeouts
 
 **Symptoms:**
```

**File**: `docs/features/HOW_TO_GUIDES.md` (modified, +3/-3)
```diff
@@ -390,13 +390,13 @@ skill-seekers create tests/ --enhance-level 3
 skill-seekers create tests/ --enhance-level 0
 ```
 
-**Issue: Want to skip enhancement for specific guides**
+**Issue: Want to generate guides without AI, then enhance later**
 ```bash
 # Generate basic guides first
 skill-seekers-how-to-guides examples.json --ai-mode none
 
-# Then enhance only specific guides manually
-skill-seekers-enhance output/codebase/tutorials/user_management.md
+# Then enhance the skill (enhance works on the skill directory, not on a single guide)
+skill-seekers enhance output/codebase/
 ```
 
 ---
```

**File**: `src/skill_seekers/cli/arguments/create.py` (modified, +3/-2)
```diff
@@ -60,10 +60,11 @@
         "kwargs": {
             "type": int,
             "choices": [0, 1, 2, 3],
-            "default": 2,
+            "default": None,  # None = your configured default (skill-seekers config), else 2
             "help": (
                 "AI enhancement level (auto-detects API vs LOCAL mode): "
-                "0=disabled, 1=SKILL.md only, 2=+architecture/config (default), 3=full enhancement. "
+                "0=disabled, 1=SKILL.md only, 2=+architecture/config, 3=full enhancement. "
+                "Default: the level set with `skill-seekers config` (2 unless changed). "
                 "Mode selection: uses API if API key is set (ANTHROPIC_API_KEY, MOONSHOT_API_KEY, etc.), otherwise LOCAL (AI coding agent)"
             ),
             "metavar": "LEVEL",
```

**File**: `src/skill_seekers/cli/arguments/enhance.py` (modified, +8/-3)
```diff
@@ -1,8 +1,13 @@
 """Enhance command argument definitions.
 
-This module defines ALL arguments for the enhance command in ONE place.
-Both enhance_command.py (dispatcher), enhance_skill_local.py (standalone),
-and parsers/enhance_parser.py (unified CLI) import and use these definitions.
+This module defines ALL arguments for the ``enhance`` command in ONE place.
+Both enhance_command.py (``skill-seekers-enhance`` / dispatcher) and
+parsers/enhance_parser.py (unified CLI) build their parser from it.
+
+enhance_skill_local.py is NOT built from this table: it is the LOCAL-agent
+worker the MCP server and the install pipeline spawn as a subprocess with a
+deliberately narrower, hand-built parser. Do not assume a flag added here
+reaches it.
 """
 
 import argparse
```

**File**: `src/skill_seekers/cli/config_manager.py` (modified, +19/-2)
```diff
@@ -50,7 +50,7 @@ class ConfigManager:
         "resume": {"auto_save_interval_seconds": 60, "keep_progress_days": 7},
         "api_keys": {"anthropic": None, "google": None, "openai": None, "moonshot": None},
         "ai_enhancement": {
-            "default_enhance_level": 1,  # Default AI enhancement level (0-3)
+            "default_enhance_level": 2,  # Default AI enhancement level (0-3); matches defaults.json
             "default_agent": None,  # "claude", "gemini", "openai", "kimi", or None (auto-detect)
             "local_batch_size": 20,  # Patterns per CLI agent call (default was 5)
             "local_parallel_workers": 3,  # Concurrent CLI agent calls
@@ -409,7 +409,24 @@ def cleanup_old_progress(self):
 
     def get_default_enhance_level(self) -> int:
         """Get default AI enhancement level (0-3)."""
-        return self.config.get("ai_enhancement", {}).get("default_enhance_level", 1)
+        return self.config.get("ai_enhancement", {}).get("default_enhance_level", 2)
+
+    @classmethod
+    def read_user_default_enhance_level(cls, fallback: int) -> int:
+        """Return the user's configured default level without touching the filesystem.
+
+        ``ExecutionContext`` calls this on every ``create`` run, so unlike
+        ``ConfigManager()`` it must not create directories or write a default
+        config file. Anything missing or invalid yields ``fallback``.
+        """
+        try:
+            if not cls.CONFIG_FILE.is_file():
+                return fallback
+            with open(cls.CONFIG_FILE, encoding="utf-8") as f:
+                level = json.load(f).get("ai_enhancement", {}).get("default_enhance_level")
+        except (OSError, ValueError, AttributeError):
+            return fallback
+        return level if isinstance(level, int) and level in (0, 1, 2, 3) else fallback
 
     def set_default_enhance_level(self, level: int):
         """Set default AI enhancement level (0-3)."""
```

**File**: `src/skill_seekers/cli/execution_context.py` (modified, +9/-1)
```diff
@@ -301,10 +301,18 @@ def _default_data(cls) -> dict[str, Any]:
         output = DEFAULTS["output"]
         analysis = DEFAULTS["analysis"]
 
+        # The level a user set with `skill-seekers config` sits between the
+        # shipped default and everything explicit (config file, CLI flag).
+        # It was honoured until the unified `create` command (Feb 2026) and
+        # silently dropped since, while `skill-seekers config` kept showing it.
+        from skill_seekers.cli.config_manager import ConfigManager
+
+        default_level = ConfigManager.read_user_default_enhance_level(enhancement["level"])
+
         return {
             "enhancement": {
                 "enabled": enhancement["enabled"],
-                "level": enhancement["level"],
+                "level": default_level,
                 # Env-var-based mode detection (lowest priority — CLI and config override this)
                 "mode": "api"
                 if any(
```

**File**: `tests/conftest.py` (modified, +16/-0)
```diff
@@ -31,6 +31,22 @@ def anyio_backend():
     return "asyncio"
 
 
+@pytest.fixture(autouse=True)
+def _isolate_user_config(monkeypatch, tmp_path_factory):
+    """Never let a developer's real ~/.config/skill-seekers/config.json leak into tests.
+
+    ExecutionContext now reads the user's default enhancement level from it,
+    so a machine with `default_enhance_level: 1` persisted would fail every
+    "default is 2" assertion. Tests that need a user config point
+    ConfigManager.CONFIG_FILE at their own file.
+    """
+    from skill_seekers.cli.config_manager import ConfigManager
+
+    monkeypatch.setattr(
+        ConfigManager, "CONFIG_FILE", tmp_path_factory.mktemp("user-config") / "config.json"
+    )
+
+
 @pytest.fixture(autouse=True)
 def _reset_execution_context():
     """Reset the ExecutionContext singleton before and after every test.
```

---

### Incident Patch 5: `2bcab0d6` (2026-09-20)
**Commit Message**: fix(security): validate Git config cache names (#464)

Fixes CWE-22 path traversal in the `fetch_config` MCP tool (#462, reported by @Harmenszoon): the git-URL mode passed the raw `config_name` argument into `cache_dir / f"temp_{name}"`, where `clone_or_pull` both deletes the path and clones attacker-chosen content into it. Closes #462.

Contributed by @emecii. Review follow-ups added on top: `config_name` validated once for all three modes in both MCP servers; one shared allowlist validator (`services/path_safety`) replacing the denylist and the three earlier copies (workflow, config publisher, marketplace), also rejecting NUL bytes, whitespace and dot-files such as `.git`; the CLI fetcher validates too; a failed pull now falls through to a fresh clone instead of deleting the cache and reporting an error; accurate error text; tests; CHANGELOG `Security` entry.

Co-authored-by: emecii <[REDACTED_EMAIL]>
Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +3/-0)
```diff
@@ -9,6 +9,9 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 _Development version: 3.10.0.dev0_
 
+### Security
+- **Path traversal in the `fetch_config` MCP tool (CWE-22)** (#462 reported by @Harmenszoon, fixed in PR #464 by @emecii) — the git-URL mode passed the raw `config_name` argument into `cache_dir / f"temp_{name}"`, and `clone_or_pull` both deletes that path (on `refresh` or a failed pull) and clones attacker-chosen content into it, so a crafted name could delete or overwrite directories outside the cache. The shared clone boundary now validates the cache name, and `fetch_config` validates `config_name` once for all three modes in both MCP servers (the named-source and API modes wrote `<destination>/<name>.json` from the raw name too). All name checks now go through one allowlist (`services/path_safety.validate_path_segment`: leading letter or digit, then letters, digits, `.`, `_`, `-`), which also rejects NUL bytes, whitespace and dot-files such as `.git`; the workflow, config-publisher and marketplace validators delegate to it. A failed pull on a cached clone now falls through to a fresh clone instead of deleting the cache and reporting an error.
+
 ### Added
 - **Opt-in SQLite search index for generated skills** (#393, PR #463 by @emecii) — `skill-seekers create <source> --index` (or `"index": true` in a config file) writes `scripts/index.db` (FTS5 with BM25, LIKE-style fallback where FTS5 is unavailable) and a stdlib-only `scripts/search.py` that returns ranked `file#anchor` pointers, and appends a search-first block to SKILL.md. Off by default, Markdown untouched, zero new dependencies; the Claude packager already ships `scripts/`. Sections are split at headings outside fenced code blocks, `index.md` table-of-contents pages are skipped, anchors follow GitHub's rules, query tokens are quoted so `NOT`/`OR` are plain words, and nothing is installed when a skill has no indexable references. Enhancement and indexing now resolve the skill directory the same way the scrapers do, including a config-file `output_dir`.
 - **`skill-seekers doctor --json`** (#459 by @Whxuan0701) — machine-readable diagnostics for CI and agents: `version`, per-check results, pass/warn/fail `summary`, `healthy` and `exit_code`, as exactly one JSON document on stdout. Import-time noise from dependencies is forwarded to stderr, a crashing check is reported as `{"error": ...}`, and `verbose_detail` (which carries masked API-key fragments) is only populated with `--verbose`, matching the human report. The `doctor` command now has a section in the CLI reference.
```

**File**: `src/skill_seekers/cli/config_fetcher.py` (modified, +9/-0)
```diff
@@ -46,6 +46,15 @@ def fetch_config_from_api(
     if config_name.startswith("configs/"):
         config_name = config_name[8:]
 
+    # The name becomes <destination>/<name>.json — keep it to one segment.
+    from skill_seekers.services.path_safety import validate_path_segment
+
+    try:
+        validate_path_segment(config_name, label="config name")
+    except ValueError as e:
+        logger.error(f"❌ {e}")
+        return None
+
     try:
         with httpx.Client(timeout=timeout) as client:
             # Get config details first
```

**File**: `src/skill_seekers/mcp/server_legacy.py` (modified, +12/-1)
```diff
@@ -1187,6 +1187,7 @@ async def scrape_github_tool(args: dict) -> list[TextContent]:
 async def fetch_config_tool(args: dict) -> list[TextContent]:
     """Fetch config from API, git URL, or named source"""
     from skill_seekers.services.git_repo import GitConfigRepo
+    from skill_seekers.services.path_safety import validate_path_segment
     from skill_seekers.services.source_manager import SourceManager
 
     config_name = args.get("config_name")
@@ -1201,6 +1202,14 @@ async def fetch_config_tool(args: dict) -> list[TextContent]:
     token = args.get("token")
     force_refresh = args.get("refresh", False)
 
+    # config_name becomes a path segment in every mode (cache dir, destination
+    # file), so validate it once here rather than per mode (#462, CWE-22).
+    if config_name:
+        try:
+            validate_path_segment(config_name, label="config name")
+        except ValueError as e:
+            return [TextContent(type="text", text=f"❌ {e}")]
+
     try:
         # MODE 1: Named Source (highest priority)
         if source_name:
@@ -1237,6 +1246,8 @@ async def fetch_config_tool(args: dict) -> list[TextContent]:
                     token=token,
                     force_refresh=force_refresh,
                 )
+            except ValueError as e:
+                return [TextContent(type="text", text=f"❌ {str(e)}")]
             except Exception as e:
                 return [TextContent(type="text", text=f"❌ Git error: {str(e)}")]
 
@@ -1297,7 +1308,7 @@ async def fetch_config_tool(args: dict) -> list[TextContent]:
                     force_refresh=force_refresh,
                 )
             except ValueError as e:
-                return [TextContent(type="text", text=f"❌ Invalid git URL: {str(e)}")]
+                return [TextContent(type="text", text=f"❌ {str(e)}")]
             except Exception as e:
                 return [TextContent(type="text", text=f"❌ Git error: {str(e)}")]
 
```

**File**: `src/skill_seekers/mcp/tools/source_tools.py` (modified, +12/-1)
```diff
@@ -79,6 +79,7 @@ async def fetch_config_tool(args: dict) -> list[TextContent]:
         List of TextContent with fetch results or config list
     """
     from skill_seekers.services.git_repo import GitConfigRepo
+    from skill_seekers.services.path_safety import validate_path_segment
     from skill_seekers.services.source_manager import SourceManager
 
     config_name = args.get("config_name")
@@ -93,6 +94,14 @@ async def fetch_config_tool(args: dict) -> list[TextContent]:
     token = args.get("token")
     force_refresh = args.get("refresh", False)
 
+    # config_name becomes a path segment in every mode (cache dir, destination
+    # file), so validate it once here rather than per mode (#462, CWE-22).
+    if config_name:
+        try:
+            validate_path_segment(config_name, label="config name")
+        except ValueError as e:
+            return [TextContent(type="text", text=f"❌ {e}")]
+
     try:
         # MODE 1: Named Source (highest priority)
         if source_name:
@@ -129,6 +138,8 @@ async def fetch_config_tool(args: dict) -> list[TextContent]:
                     token=token,
                     force_refresh=force_refresh,
                 )
+            except ValueError as e:
+                return [TextContent(type="text", text=f"❌ {str(e)}")]
             except Exception as e:
                 return [TextContent(type="text", text=f"❌ Git error: {str(e)}")]
 
@@ -189,7 +200,7 @@ async def fetch_config_tool(args: dict) -> list[TextContent]:
                     force_refresh=force_refresh,
                 )
             except ValueError as e:
-                return [TextContent(type="text", text=f"❌ Invalid git URL: {str(e)}")]
+                return [TextContent(type="text", text=f"❌ {str(e)}")]
             except Exception as e:
                 return [TextContent(type="text", text=f"❌ Git error: {str(e)}")]
 
```

**File**: `src/skill_seekers/mcp/tools/workflow_tools.py` (modified, +4/-5)
```diff
@@ -11,7 +11,6 @@
 
 from __future__ import annotations
 
-import os
 from pathlib import Path
 
 import yaml
@@ -30,10 +29,10 @@ def __init__(self, type: str, text: str):
 
 
 def _validate_name(name: str) -> str:
-    """Validate workflow name to prevent path traversal (CWE-22)."""
-    if not name or ".." in name or "/" in name or "\\" in name or os.path.isabs(name):
-        raise ValueError(f"Invalid workflow name: {name!r}")
-    return name
+    """Validate workflow name to prevent path traversal (CWE-22) — shared allowlist."""
+    from skill_seekers.services.path_safety import validate_path_segment
+
+    return validate_path_segment(name, label="workflow name")
 
 
 def _ensure_user_dir() -> Path:
```

**File**: `src/skill_seekers/services/config_publisher.py` (modified, +4/-6)
```diff
@@ -122,12 +122,10 @@ def publish(
         if not config_name:
             raise ValueError("Config JSON must have a 'name' field")
 
-        # Validate config_name to prevent path traversal
-        if "/" in config_name or "\\" in config_name or ".." in config_name:
-            raise ValueError(
-                f"Invalid config name '{config_name}'. "
-                "Path separators (/, \\) and traversal sequences (..) are not allowed."
-            )
+        # Validate config_name to prevent path traversal (shared allowlist)
+        from skill_seekers.services.path_safety import validate_path_segment
+
+        validate_path_segment(config_name, label="config name")
 
         try:
             from skill_seekers.cli.config_validator import validate_config
```

**File**: `src/skill_seekers/services/git_repo.py` (modified, +13/-5)
```diff
@@ -13,6 +13,13 @@
 import git
 from git.exc import GitCommandError, InvalidGitRepositoryError
 
+from skill_seekers.services.path_safety import validate_path_segment
+
+
+# Re-exported so ``from skill_seekers.services.git_repo import validate_path_segment``
+# keeps working; the single definition lives in path_safety.
+__all__ = ["GitConfigRepo", "validate_path_segment"]
+
 
 class GitConfigRepo:
     """Manages git operations for config repositories."""
@@ -68,7 +75,7 @@ def clone_or_pull(
             raise ValueError(f"Invalid git URL: {git_url}")
 
         # Determine cache path
-        repo_path = self.cache_dir / source_name
+        repo_path = self.cache_dir / validate_path_segment(source_name, label="source name")
 
         # Force refresh: delete existing cache
         if force_refresh and repo_path.exists():
@@ -94,11 +101,12 @@ def clone_or_pull(
                     origin.pull(branch)
                     return repo_path
                 except (InvalidGitRepositoryError, GitCommandError):
-                    # Corrupted repo - delete and re-clone
-                    shutil.rmtree(repo_path)
-                    raise  # Re-raise to trigger clone below
+                    # Corrupted or unpullable cache: drop it and fall through to a
+                    # fresh clone. (A `raise` here used to leave the outer try, so
+                    # the cache was deleted and *no* clone happened — #462.)
+                    shutil.rmtree(repo_path, ignore_errors=True)
 
-            # Repository doesn't exist - clone
+            # Repository doesn't exist (or was just discarded) - clone
             git.Repo.clone_from(
                 clone_url,
                 repo_path,
```

**File**: `src/skill_seekers/services/marketplace_publisher.py` (modified, +3/-9)
```diff
@@ -8,7 +8,6 @@
 import json
 import logging
 import os
-import re
 import shutil
 from pathlib import Path
 
@@ -221,14 +220,9 @@ def _validate_skill_name(name: str) -> str:
         Raises:
             ValueError: If name contains invalid characters
         """
-        if not name or not re.match(r"^[a-zA-Z0-9][a-zA-Z0-9._-]*$", name):
-            raise ValueError(
-                f"Invalid skill name '{name}'. "
-                "Must start with alphanumeric and contain only alphanumeric, hyphens, underscores, or dots."
-            )
-        if ".." in name or "/" in name or "\\" in name:
-            raise ValueError(f"Invalid skill name '{name}'. Path traversal characters not allowed.")
-        return name
+        from skill_seekers.services.path_safety import validate_path_segment
+
+        return validate_path_segment(name, label="skill name")
 
     def _read_frontmatter(self, skill_md_path: Path) -> dict:
         """Parse YAML frontmatter from SKILL.md."""
```

---

### Incident Patch 6: `f540a5a3` (2026-09-20)
**Commit Message**: fix(doctor): restore the skill-seekers-doctor console script (#456)

The COMMAND_CLASSES migration (#327) dropped doctor.main() and the module's __main__ block but left `skill-seekers-doctor` in [project.scripts], so the published console script raised ImportError in v3.7.0 through v3.9.1 and `python -m skill_seekers.cli.doctor` exited 0 without running anything.

Diagnosed by @michaeldhendricks12-cell (who proposed removing the entry point); resolved by restoring a thin main() built from the central DoctorParser instead, plus a guard test that resolves every [project.scripts] target and dispatch tests for DoctorCommand.

Co-authored-by: michaeldhendricks12-cell <[REDACTED_EMAIL]>
Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -69,6 +69,7 @@ _Development version: 3.10.0.dev0_
 - **`QWEN.md` reduced from 719 to 64 lines** — it duplicated `AGENTS.md` while advertising three different version numbers at once (v3.6.0, 3.3.0, and "17+ source types" beside "18 source types"). It is now a pointer to `AGENTS.md` that keeps the essential commands and conventions inline and carries no hardcoded version.
 
 ### Fixed
+- **`skill-seekers-doctor` console script and `python -m skill_seekers.cli.doctor` work again** (#456, reported by @michaeldhendricks12-cell) — the COMMAND_CLASSES migration (#327) removed `doctor.main()` but left the console script pointing at it, so it raised `ImportError` in v3.7.0 through v3.9.1 and the module ran as a silent no-op. A thin `main()` built from the central `DoctorParser` restores both without duplicating flag definitions. A new test resolves every `[project.scripts]` target so a dangling entry point cannot ship again.
 - **Stale and incorrect README claims corrected against the codebase** — version badge 3.7.0 → 3.9.0; the documented `scan --quick|--comprehensive|--enhance` flags do not exist and are now `create --preset quick|standard|comprehensive`; export targets "16 formats"/"21 platforms" → 22; CLI reference "all 20 commands" → 19; the `install-agent` table 15 → 19 entries; workflow presets "24+" → 68; and the dead `# skill-seekers list-configs` line removed.
 - **Three overlapping troubleshooting guides unified** — root `TROUBLESHOOTING.md` (485 lines), `docs/TROUBLESHOOTING.md` (1,102) and `docs/user-guide/06-troubleshooting.md` (108) shared only 2 of 22 headings, so none was a stale copy. `docs/TROUBLESHOOTING.md` is now the single comprehensive reference (1,398 lines) with the five sections that existed only at root merged in; the user-guide chapter stays as the short entry in the numbered series.
 - **92 broken relative links repaired across the docs tree** (109 → 17) — targets relinked to their real locations, case/separator mismatches fixed (`integrations/cursor.md` → `CURSOR.md`, `advanced/api-reference.md` → `reference/API_REFERENCE.md`), and links to never-written docs unlinked rather than left as 404s. The remaining 17 are intentional (template placeholders, illustrative generated-output samples, archived snapshots).
```

**File**: `src/skill_seekers/cli/doctor.py` (modified, +20/-0)
```diff
@@ -305,3 +305,23 @@ def __init__(self, args) -> None:
     def execute(self) -> int:
         results = run_all_checks()
         return print_report(results, verbose=getattr(self.args, "verbose", False))
+
+
+def main(args=None) -> int:
+    """Standalone entry point (``skill-seekers-doctor`` / ``python -m skill_seekers.cli.doctor``).
+
+    Builds its parser from the central ``DoctorParser`` so the flag set has a
+    single definition, then runs the same ``DoctorCommand`` the unified CLI
+    dispatches to. This was dropped by mistake in the COMMAND_CLASSES migration
+    (#327), which left the published console script raising ImportError.
+    """
+    if args is None:
+        from skill_seekers.cli.parsers.doctor_parser import DoctorParser
+
+        parser = DoctorParser().build_standalone(prog="skill-seekers-doctor")
+        args = parser.parse_args()
+    return DoctorCommand(args).execute()
+
+
+if __name__ == "__main__":
+    raise SystemExit(main())
```

**File**: `tests/test_cli_paths.py` (modified, +46/-0)
```diff
@@ -10,6 +10,8 @@
 import unittest
 from pathlib import Path
 
+import pytest
+
 # Add parent directory to path
 sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
 
@@ -205,3 +207,47 @@ def test_main_cli_file_exists(self):
 
 if __name__ == "__main__":
     unittest.main()
+
+
+def _console_script_targets() -> list[tuple[str, str, str]]:
+    """Parse ``[project.scripts]`` from pyproject.toml without a TOML library (3.10 has none)."""
+    import re
+
+    text = (Path(__file__).resolve().parent.parent / "pyproject.toml").read_text(encoding="utf-8")
+    section = re.search(r"^\[project\.scripts\]\n(.*?)^\[", text, re.M | re.S)
+    assert section, "[project.scripts] not found in pyproject.toml"
+    targets = []
+    for line in section.group(1).splitlines():
+        m = re.match(r'^([\w-]+)\s*=\s*"([\w.]+):(\w+)"', line)
+        if m:
+            targets.append(m.groups())
+    assert len(targets) > 20, targets
+    return targets
+
+
+class TestConsoleScriptTargets:
+    """Every ``skill-seekers-*`` console script must point at a function that exists.
+
+    ``skill-seekers-doctor`` shipped broken for four releases (v3.7.0-v3.9.1)
+    after the COMMAND_CLASSES migration removed ``doctor.main`` but left the
+    pyproject entry behind (#456). Nothing imported the target, so nothing
+    failed. This does.
+    """
+
+    @pytest.mark.parametrize(
+        "script,module,attr",
+        _console_script_targets(),
+        ids=[t[0] for t in _console_script_targets()],
+    )
+    def test_target_resolves(self, script, module, attr):
+        import importlib
+        import importlib.util
+
+        assert importlib.util.find_spec(module) is not None, f"{script}: module {module} missing"
+        try:
+            mod = importlib.import_module(module)
+        except ModuleNotFoundError as exc:
+            if exc.name and not exc.name.startswith("skill_seekers"):
+                pytest.skip(f"{script}: optional dependency {exc.name} not installed")
+            raise
+        assert callable(getattr(mod, attr, None)), f"{script}: {module} has no callable {attr}()"
```

**File**: `tests/test_doctor.py` (modified, +44/-0)
```diff
@@ -7,6 +7,7 @@
 
 from skill_seekers.cli.doctor import (
     CheckResult,
+    DoctorCommand,
     check_api_keys,
     check_core_deps,
     check_git,
@@ -15,6 +16,7 @@
     check_output_directory,
     check_package_installed,
     check_python_version,
+    main,
     print_report,
     run_all_checks,
 )
@@ -173,3 +175,45 @@ def test_no_verbose_hides_detail(self, capsys):
         print_report(results, verbose=False)
         captured = capsys.readouterr()
         assert "secret: hidden" not in captured.out
+
+
+class TestDoctorEntryPoints:
+    """The unified CLI dispatch, the console script and ``python -m`` all reach the same code."""
+
+    _ok = [CheckResult("python", "pass", "3.12")]
+
+    def test_command_class_dispatch_contract(self, capsys):
+        from argparse import Namespace
+
+        with patch("skill_seekers.cli.doctor.run_all_checks", return_value=self._ok):
+            assert DoctorCommand(Namespace(verbose=True)).execute() == 0
+        assert "python" in capsys.readouterr().out
+
+    def test_main_parses_argv_from_central_parser(self, capsys):
+        with (
+            patch("skill_seekers.cli.doctor.run_all_checks", return_value=self._ok),
+            patch("skill_seekers.cli.doctor.print_report", return_value=0) as report,
+            patch("sys.argv", ["skill-seekers-doctor", "--verbose"]),
+        ):
+            assert main() == 0
+        assert report.call_args.kwargs["verbose"] is True
+
+    def test_main_accepts_preparsed_namespace(self):
+        from argparse import Namespace
+
+        with patch("skill_seekers.cli.doctor.run_all_checks", return_value=self._ok):
+            assert main(Namespace(verbose=False)) == 0
+
+    def test_module_is_runnable(self):
+        """``python -m skill_seekers.cli.doctor`` must run the checks, not silently exit 0."""
+        import subprocess
+        import sys
+
+        proc = subprocess.run(
+            [sys.executable, "-m", "skill_seekers.cli.doctor", "--help"],
+            capture_output=True,
+            text=True,
+            timeout=60,
+        )
+        assert proc.returncode == 0
+        assert "--verbose" in proc.stdout
```

---

### Incident Patch 7: `4cca1e69` (2026-09-20)
**Commit Message**: fix(unified): preserve source reference trees (#454)

Unified multi-source builds dropped every converter-backed source's readable references (PDF, EPUB, Word, PPTX, video, ...) — the final skill held only an index or raw JSON while the Markdown sat unused in the scrape cache, and the synthesized SKILL.md linked to files that did not exist. Closes #453.

Contributed by @Iams4kura; review follow-ups (bounded enhancement input, SKILL.md link rewriting, managed references wipe, namespaced data JSON, copy-error tolerance, single naming source for sub-skill dirs and cache stems) added on top.

Co-authored-by: Iams4kura <[REDACTED_EMAIL]>
Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +6/-0)
```diff
@@ -49,6 +49,12 @@ _Development version: 3.10.0.dev0_
 - Seeker HUD: unmatched `/api/*` paths now 404 for every HTTP method, without widening the SPA catch-all route's accepted methods.
 - Seeker HUD: Doctor check levels are normalised (`pass`/`warn`/`fail` → `ok`/`warning`/`error`) so the status pill reflects real failures, and agent install paths resolve under the HUD's workspace root instead of the server process's working directory.
 
+### Fixed
+- **Unified multi-source builds preserve readable source references** (#453) — converter-backed sources such as PDF and EPUB no longer leave their generated Markdown stranded in the scrape cache while the final skill contains only an index or raw JSON. Each source's `references/` tree and adjacent assets are copied into an indexed namespace, preventing same-name collisions and preserving relative asset links; visual video frames and `skip_scrape` reference locations are preserved too.
+  - Namespaces are `<scrape index>_<sanitized id>` (raw data JSON included), so URL/path ids are filesystem-safe and same-named inputs stay apart. Links in the synthesized SKILL.md are rewritten to the unified locations instead of pointing at the sub-skill's `references/*.md`.
+  - The builder now recreates the `references/` entries it owns on every build (source-type directories, `api/`, `codebase_analysis/`, `conflicts.md`); user files kept elsewhere under `references/` are left alone. A copy failure inside a cached sub-skill is logged and the build continues.
+  - The unified API-mode enhancement prompt reads references through the same bounded reader the platform adaptors use (200k chars total, 30k per file, keyed by relative path). Previously it inlined every reference file unbounded, which the full PDF/EPUB trees would have pushed past any model's context window.
+
 ## [3.9.1] - 2026-08-02
 
 **Theme:** Documentation and project-infrastructure release. No runtime code changed — the package is functionally identical to 3.9.0.
```

**File**: `docs/features/UNIFIED_SCRAPING.md` (modified, +23/-3)
```diff
@@ -399,22 +399,42 @@ output/skill-name/
 │   │   ├── issues.md
 │   │   └── releases.md
 │   ├── pdf/                     # PDF references (if applicable)
-│   │   └── index.md
+│   │   ├── index.md
+│   │   └── 0_manual/          # One namespace per input document
+│   │       ├── references/     # Readable extracted Markdown
+│   │       └── assets/         # Images used by those references
 │   ├── video/                   # Video transcripts (if applicable)
 │   │   └── index.md
 │   ├── openapi/                 # OpenAPI spec (if applicable)
 │   │   └── index.md
 │   ├── jupyter/                 # Notebook content (if applicable)
 │   │   └── index.md
-│   ├── <source-type>/           # Other source type references
-│   │   └── index.md
+│   ├── <source-type>/           # Other converter-backed sources
+│   │   ├── index.md
+│   │   ├── 0_<source>_data.json # Raw extracted data
+│   │   └── 0_<source>/        # Readable references + assets
 │   ├── api/                     # Merged API reference
 │   │   └── merged_api.md
 │   └── conflicts.md             # Detailed conflict report
 ├── scripts/                     # Empty (for user scripts)
 └── assets/                      # Empty (for user assets)
 ```
 
+Converter-backed sources such as PDF, Word, EPUB, Jupyter, and PowerPoint keep
+each input's generated reference tree in its own indexed namespace. This avoids
+filename collisions when multiple inputs contain files such as `content.md` and
+keeps relative links from the Markdown to adjacent assets intact. Video sources
+use the same layout and preserve adjacent visual-extraction `frames/` as well.
+The namespace is `<scrape index>_<sanitized id>`, so URL or path ids are
+filesystem-safe and two inputs with the same file name stay apart. Links in the
+synthesized SKILL.md are rewritten to these locations.
+
+Every build recreates the directories it owns under `references/`
+(`documentation/`, `github/`, `pdf/`, the converter-backed types, `api/`,
+`codebase_analysis/`, `conflicts.md`), so a source removed from the config
+cannot leave stale content behind. Files you keep under `references/` outside
+those entries are left untouched.
+
 ### SKILL.md Format
 
 ```markdown
```

**File**: `src/skill_seekers/cli/adaptors/base.py` (modified, +6/-25)
```diff
@@ -217,39 +217,20 @@ def _read_reference_files(
         """
         Read reference markdown files from skill directory.
 
-        Single canonical copy — claude/openai/gemini carried byte-identical
-        versions and openai_compatible a cosmetic variant.
+        Delegates to the shared bounded reader in ``scraper_utils`` (also used
+        by the unified enhancement path) so every enhancement prompt observes
+        the same size limits. Keys are paths relative to ``references_dir``.
 
         Args:
             references_dir: Path to references directory
             max_chars: Maximum total characters to read
 
         Returns:
-            Dictionary mapping filename to content
+            Dictionary mapping relative file path to content
         """
-        if not references_dir.exists():
-            return {}
-
-        references = {}
-        total_chars = 0
-
-        for ref_file in sorted(references_dir.rglob("*.md")):
-            if total_chars >= max_chars:
-                break
-
-            try:
-                content = ref_file.read_text(encoding="utf-8")
-                # Truncate very large files
-                if len(content) > 30000:
-                    content = content[:30000] + "\n\n...(truncated)"
-
-                references[ref_file.name] = content
-                total_chars += len(content)
-
-            except Exception as e:
-                print(f"  ⚠ Could not read {ref_file.name}: {e}")
+        from skill_seekers.cli.scraper_utils import read_reference_markdown
 
-        return references
+        return read_reference_markdown(references_dir, max_chars=max_chars)
 
     def _enhance_skill_md_via_client(
         self,
```

**File**: `src/skill_seekers/cli/scraper_utils.py` (modified, +45/-0)
```diff
@@ -14,7 +14,11 @@
   near-identical in the word/pdf/epub/html/pptx/asciidoc/jupyter scrapers).
 """
 
+import logging
 import re
+from pathlib import Path
+
+logger = logging.getLogger(__name__)
 
 
 def reference_filename(
@@ -162,3 +166,44 @@ def extract_table_from_html(table_elem) -> dict | None:
         return None
 
     return {"headers": headers, "rows": rows}
+
+
+def read_reference_markdown(
+    references_dir: Path | str,
+    *,
+    max_chars: int = 200_000,
+    max_file_chars: int = 30_000,
+) -> dict[str, str]:
+    """Read ``*.md`` files under ``references_dir`` into a bounded mapping.
+
+    Single reader shared by the platform adaptors and the unified enhancement
+    path so an enhancement prompt can never grow without limit: each file is
+    capped at ``max_file_chars`` and reading stops once ``max_chars`` have been
+    collected. Unified builds copy whole PDF/EPUB reference trees under
+    ``references/`` (#453), so an unbounded read would exceed any model's
+    context window on a multi-book config.
+
+    Keys are POSIX paths relative to ``references_dir`` so same-name files in
+    different sub-skill namespaces (``pdf/0_a/references/index.md`` vs
+    ``pdf/1_b/references/index.md``) do not overwrite each other. Files are
+    visited in sorted order so truncation is deterministic.
+    """
+    references_dir = Path(references_dir)
+    if not references_dir.exists():
+        return {}
+
+    references: dict[str, str] = {}
+    total_chars = 0
+    for ref_file in sorted(references_dir.rglob("*.md")):
+        if total_chars >= max_chars:
+            break
+        try:
+            content = ref_file.read_text(encoding="utf-8", errors="ignore")
+        except OSError as exc:
+            logger.warning("Could not read %s: %s", ref_file, exc)
+            continue
+        if len(content) > max_file_chars:
+            content = content[:max_file_chars] + "\n\n...(truncated)"
+        references[ref_file.relative_to(references_dir).as_posix()] = content
+        total_chars += len(content)
+    return references
```

**File**: `src/skill_seekers/cli/unified_scraper.py` (modified, +132/-57)
```diff
@@ -549,7 +549,7 @@ def _scrape_github(self, source: dict[str, Any]):
         # Create config for GitHub scraper
         github_config = {
             "repo": repo,
-            "name": f"{self.name}_github_{idx}_{repo_id}",
+            "name": self._sub_skill_name("github", idx, repo_id),
             "github_token": source.get("github_token"),
             "include_issues": source.get("include_issues", True),
             "max_issues": source.get("max_issues", 100),
@@ -605,7 +605,9 @@ def _scrape_github(self, source: dict[str, Any]):
             logger.info(f"📁 Repository clone saved for future use: {cloned_repo_path}")
 
         # Save data to unified location with unique filename
-        github_data_file = os.path.join(self.data_dir, f"github_data_{idx}_{repo_id}.json")
+        github_data_file = os.path.join(
+            self.data_dir, f"{self._cache_stem('github', idx, repo_id)}.json"
+        )
         with open(github_data_file, "w", encoding="utf-8") as f:
             json.dump(github_data, f, indent=2, ensure_ascii=False)
 
@@ -622,6 +624,7 @@ def _scrape_github(self, source: dict[str, Any]):
                 "idx": idx,
                 "data": github_data,
                 "data_file": github_data_file,
+                "refs_dir": os.path.join(github_skill_dir, "references"),
             }
         )
 
@@ -639,6 +642,23 @@ def _scrape_github(self, source: dict[str, Any]):
 
         logger.info("✅ GitHub: Repository scraped successfully")
 
+    def _sub_skill_name(self, bucket: str, idx: int, source_id: str | None = None) -> str:
+        """Cache sub-skill directory name for one source.
+
+        ``{name}_{bucket}_{idx}_{source_id}`` (``{name}_{bucket}_{idx}`` for
+        types without an id, i.e. video). Fresh scrapes name the standalone
+        sub-skill with this and cached loads reconstruct ``refs_dir`` from it,
+        so the two paths cannot drift.
+        """
+        suffix = f"_{source_id}" if source_id is not None else ""
+        return f"{self.name}_{bucket}_{idx}{suffix}"
+
+    @staticmethod
+    def _cache_stem(bucket: str, idx: int, source_id: str | None = None) -> str:
+        """Cache data filename stem for one source: ``{bucket}_data_{idx}[_{source_id}]``."""
+        suffix = f"_{source_id}" if source_id is not None else ""
+        return f"{bucket}_data_{idx}{suffix}"
+
     def _scrape_with_converter(
         self,
         *,
@@ -701,7 +721,14 @@ def _scrape_with_converter(
         shutil.copy(data_file, cache_data_file)
 
         # Append to list instead of overwriting (multi-source support)
-        self.scraped_data[bucket].append({**record, "data": data, "data_file": cache_data_file})
+        self.scraped_data[bucket].append(
+            {
+                **record,
+                "data": data,
+                "data_file": cache_data_file,
+                "refs_dir": os.path.join(source_skill_dir, "references"),
+            }
+        )
 
         # Build standalone SKILL.md for synthesis
         try:
@@ -727,15 +754,15 @@ def _scrape_pdf(self, source: dict[str, Any]):
             bucket="pdf",
             converter_type="pdf",
             config={
-                "name": f"{self.name}_pdf_{idx}_{pdf_id}",
+                "name": self._sub_skill_name("pdf", idx, pdf_id),
                 "pdf_path": source["path"],  # Fixed: use pdf_path instead of pdf
                 "description": f"{source.get('name', pdf_id)} documentation",
                 "extract_tables": source.get("extract_tables", True),
                 "ocr": source.get("ocr", False),
                 "password": source.get("password"),
             },
             record={"pdf_path": pdf_path, "pdf_id": pdf_id, "idx": idx},
-            cache_stem=f"pdf_data_{idx}_{pdf_id}",
+            cache_stem=self._cache_stem("pdf", idx, pdf_id),
             label="PDF",
             summary_key="pages",
             summary_noun="pages",
@@ -756,7 +783,7 @@ def _scrape_word(self, source: dict[str, Any]):
             bucket="word",
             converter_type="word",
             config={
-                "name": f"{self.name}_word_{idx}_{docx_id}",
+                "name": self._sub_skill_name("word", idx, docx_id),
                 "docx_path": source["path"],
                 "description": f"{source.get('name', docx_id)} documentation",
             },
@@ -766,7 +793,7 @@ def _scrape_word(self, source: dict[str, Any]):
                 "word_id": docx_id,  # Alias for generic reference generation
                 "idx": idx,
             },
-            cache_stem=f"word_data_{idx}_{docx_id}",
+            cache_stem=self._cache_stem("word", idx, docx_id),
             label="Word",
             summary_key="pages",
             summary_noun="sections",
@@ -794,7 +821,7 @@ def _scrape_video(self, source: dict[str, Any]):
 
         # Create config for video scraper
         video_config = {
-            "name": f"{self.name}_video_{idx}",
+            "name": self._sub_
```

**File**: `src/skill_seekers/cli/unified_skill_builder.py` (modified, +207/-46)
```diff
@@ -35,6 +35,39 @@ class UnifiedSkillBuilder:
     by design.
     """
 
+    # Converter-backed source types beyond the three bespoke ones
+    # (documentation / github / pdf). Shared by SKILL.md synthesis and
+    # reference generation so the two cannot disagree about what exists.
+    _EXTRA_SOURCE_TYPES = (
+        "word",
+        "epub",
+        "video",
+        "jupyter",
+        "html",
+        "openapi",
+        "asciidoc",
+        "pptx",
+        "confluence",
+        "notion",
+        "rss",
+        "manpage",
+        "chat",
+    )
+
+    # Entries under references/ that this builder owns and rebuilds from
+    # scratch on every build. A source dropped from the config must not leave
+    # stale content behind for enhancement (#453), but anything else a user
+    # keeps under references/ is theirs and is left alone.
+    _MANAGED_REFERENCE_ENTRIES = (
+        "documentation",
+        "github",
+        "pdf",
+        *_EXTRA_SOURCE_TYPES,
+        "api",
+        "codebase_analysis",
+        "conflicts.md",
+    )
+
     def __init__(
         self,
         config: dict,
@@ -96,6 +129,7 @@ def _load_source_skill_mds(self) -> dict[str, str]:
             e.g., {'documentation': '...', 'github': '...', 'pdf': '...'}
         """
         skill_mds = {}
+        namespaces = self._reference_namespaces_by_source_dir()
 
         # Determine base directory for source SKILL.md files
         sources_dir = Path(self.cache_dir) / "sources" if self.cache_dir else Path("output")
@@ -149,7 +183,9 @@ def _load_source_skill_mds(self) -> dict[str, str]:
             pdf_skill_path = pdf_dir / "SKILL.md"
             if pdf_skill_path.exists():
                 try:
-                    content = pdf_skill_path.read_text(encoding="utf-8")
+                    content = self._relink_sub_skill_references(
+                        pdf_skill_path.read_text(encoding="utf-8"), pdf_dir, namespaces
+                    )
                     pdf_sources.append(content)
                     logger.debug(f"Loaded PDF SKILL.md from {pdf_dir.name} ({len(content)} chars)")
                 except OSError as e:
@@ -162,28 +198,15 @@ def _load_source_skill_mds(self) -> dict[str, str]:
 
         # Load additional source types using generic glob pattern
         # Each source type uses: {name}_{type}_{idx}_*/ or {name}_{type}_*/
-        _extra_types = [
-            "word",
-            "epub",
-            "video",
-            "jupyter",
-            "html",
-            "openapi",
-            "asciidoc",
-            "pptx",
-            "confluence",
-            "notion",
-            "rss",
-            "manpage",
-            "chat",
-        ]
-        for source_type in _extra_types:
+        for source_type in self._EXTRA_SOURCE_TYPES:
             type_sources = []
             for type_dir in sources_dir.glob(f"{self.name}_{source_type}_*"):
                 type_skill_path = type_dir / "SKILL.md"
                 if type_skill_path.exists():
                     try:
-                        content = type_skill_path.read_text(encoding="utf-8")
+                        content = self._relink_sub_skill_references(
+                            type_skill_path.read_text(encoding="utf-8"), type_dir, namespaces
+                        )
                         type_sources.append(content)
                         logger.debug(
                             f"Loaded {source_type} SKILL.md from {type_dir.name} "
@@ -258,6 +281,45 @@ def _parse_skill_md_sections(self, skill_md: str) -> dict[str, str]:
         logger.debug(f"Parsed {len(sections)} sections from SKILL.md")
         return sections
 
+    def _reference_namespaces_by_source_dir(self) -> dict[str, tuple[str, str]]:
+        """Map each cached sub-skill directory to its final references namespace.
+
+        Keyed by the normalized sub-skill directory (the parent of ``refs_dir``)
+        and valued by ``(source_type, namespace)``, computed with the same
+        function the reference copier uses so SKILL.md links and the copied
+        tree always agree.
+        """
+        mapping: dict[str, tuple[str, str]] = {}
+        for source_type in ("pdf", *self._EXTRA_SOURCE_TYPES):
+            for position, source_data in enumerate(self.scraped_data.get(source_type, [])):
+                refs_dir = source_data.get("refs_dir")
+                if not refs_dir:
+                    continue
+                _source_id, namespace = self._reference_namespace(
+                    source_type, source_data, position
+                )
+                key = os.path.normpath(os.path.abspath(os.path.dirname(refs_dir)))
+                mapping[key] = (source_type, namespace)
+        return mapping
+
+    @staticmethod
+    def _relink_sub_skill_references(
+        content: str, source_dir: Path | str, namespaces: dict[str, tuple[str, str]]
+    ) -> str:
+        """Rewrite a standalone sub-skill's ``references/...`` links to their unifie
```

**File**: `tests/test_multi_source.py` (modified, +359/-0)
```diff
@@ -502,6 +502,307 @@ def test_creates_pdf_index_with_count(self):
             content = f.read()
             self.assertIn("3 PDF document", content)
 
+    def test_copies_each_pdf_reference_tree_without_name_collisions(self):
+        """Unified PDF output preserves every source's readable references and assets."""
+        from skill_seekers.cli.unified_skill_builder import UnifiedSkillBuilder
+
+        first_skill_dir = os.path.join(self.temp_dir, "first")
+        second_skill_dir = os.path.join(self.temp_dir, "second")
+        first_refs = os.path.join(first_skill_dir, "references")
+        second_refs = os.path.join(second_skill_dir, "references")
+        first_assets = os.path.join(first_skill_dir, "assets")
+        second_assets = os.path.join(second_skill_dir, "assets")
+        for path in [first_refs, second_refs, first_assets, second_assets]:
+            os.makedirs(path)
+
+        with open(os.path.join(first_refs, "content.md"), "w") as f:
+            f.write("FIRST SENTINEL\n\n![first](../assets/cover.png)\n")
+        with open(os.path.join(second_refs, "content.md"), "w") as f:
+            f.write("SECOND SENTINEL\n\n![second](../assets/cover.png)\n")
+        with open(os.path.join(first_assets, "cover.png"), "wb") as f:
+            f.write(b"first image")
+        with open(os.path.join(second_assets, "cover.png"), "wb") as f:
+            f.write(b"second image")
+
+        config = {"name": "test_pdf_refs", "description": "Test", "sources": []}
+        scraped_data = {
+            "documentation": [],
+            "github": [],
+            "pdf": [
+                {"pdf_id": "book_one", "idx": 0, "refs_dir": first_refs},
+                {"pdf_id": "book_two", "idx": 1, "refs_dir": second_refs},
+            ],
+        }
+
+        builder = UnifiedSkillBuilder(config, scraped_data)
+        builder._generate_pdf_references(scraped_data["pdf"])
+
+        pdf_dir = os.path.join(builder.skill_dir, "references", "pdf")
+        first_output = os.path.join(pdf_dir, "0_book_one")
+        second_output = os.path.join(pdf_dir, "1_book_two")
+        with open(os.path.join(first_output, "references", "content.md")) as f:
+            self.assertIn("FIRST SENTINEL", f.read())
+        with open(os.path.join(second_output, "references", "content.md")) as f:
+            self.assertIn("SECOND SENTINEL", f.read())
+        self.assertTrue(os.path.exists(os.path.join(first_output, "assets", "cover.png")))
+        self.assertTrue(os.path.exists(os.path.join(second_output, "assets", "cover.png")))
+
+        with open(os.path.join(pdf_dir, "index.md")) as f:
+            index = f.read()
+        self.assertIn("0_book_one/references/content.md", index)
+        self.assertIn("1_book_two/references/content.md", index)
+
+    def test_rebuild_removes_references_for_deleted_pdf_source(self):
+        """Rebuilding cannot leave removed source content available to enhancers."""
+        from skill_seekers.cli.unified_skill_builder import UnifiedSkillBuilder
+
+        first_refs = os.path.join(self.temp_dir, "first", "references")
+        second_refs = os.path.join(self.temp_dir, "second", "references")
+        os.makedirs(first_refs)
+        os.makedirs(second_refs)
+        for refs_dir in [first_refs, second_refs]:
+            with open(os.path.join(refs_dir, "content.md"), "w") as f:
+                f.write("content")
+
+        config = {"name": "test_pdf_rebuild", "description": "Test", "sources": []}
+        scraped_data = {
+            "documentation": [],
+            "github": [],
+            "pdf": [
+                {"pdf_id": "keep", "idx": 0, "refs_dir": first_refs},
+                {"pdf_id": "remove", "idx": 1, "refs_dir": second_refs},
+            ],
+        }
+        builder = UnifiedSkillBuilder(config, scraped_data)
+        builder._generate_pdf_references(scraped_data["pdf"])
+
+        pdf_dir = os.path.join(builder.skill_dir, "references", "pdf")
+        self.assertTrue(os.path.isdir(os.path.join(pdf_dir, "1_remove")))
+
+        builder._generate_pdf_references(scraped_data["pdf"][:1])
+
+        self.assertFalse(os.path.exists(os.path.join(pdf_dir, "1_remove")))
+
+    def test_rebuild_removes_pdf_directory_when_source_type_is_deleted(self):
+        """A source type removed from config cannot survive in the final references."""
+        from skill_seekers.cli.unified_skill_builder import UnifiedSkillBuilder
+
+        refs_dir = os.path.join(self.temp_dir, "pdf_source", "references")
+        os.makedirs(refs_dir)
+        with open(os.path.join(refs_dir, "content.md"), "w") as f:
+            f.write("content")
+
+        config = {"name": "test_pdf_type_removal", "description": "Test", "sources": []}
+        scraped_data = {
+            "documentation": [],
+            "github": [],
+            "pdf": [{"pdf_id": "manual", "idx": 0, "refs_dir": refs_dir}],
+        }
+        builder = UnifiedSkillBuilder(config, scraped_data)
+        bui
```

**File**: `tests/test_scraper_utils.py` (modified, +44/-0)
```diff
@@ -168,3 +168,47 @@ def test_pdf_page_number_variant(self):
     def test_missing_numbers_fall_back_to_index(self):
         pages = [{}, {}]
         self.assertEqual(reference_filename(pages, 1, 2, "x"), "x_s1-s2.md")
+
+
+class TestReadReferenceMarkdown:
+    """Bounded reader shared by the adaptors and the unified enhancement path."""
+
+    def test_keys_are_relative_posix_paths_and_nested_same_names_do_not_collide(self, tmp_path):
+        from skill_seekers.cli.scraper_utils import read_reference_markdown
+
+        (tmp_path / "pdf" / "0_a" / "references").mkdir(parents=True)
+        (tmp_path / "pdf" / "1_b" / "references").mkdir(parents=True)
+        (tmp_path / "pdf" / "0_a" / "references" / "index.md").write_text("A")
+        (tmp_path / "pdf" / "1_b" / "references" / "index.md").write_text("B")
+        (tmp_path / "top.md").write_text("T")
+
+        refs = read_reference_markdown(tmp_path)
+
+        assert refs == {
+            "pdf/0_a/references/index.md": "A",
+            "pdf/1_b/references/index.md": "B",
+            "top.md": "T",
+        }
+
+    def test_total_and_per_file_caps(self, tmp_path):
+        from skill_seekers.cli.scraper_utils import read_reference_markdown
+
+        (tmp_path / "a.md").write_text("x" * 50)
+        (tmp_path / "b.md").write_text("y" * 50)
+        (tmp_path / "c.md").write_text("z" * 50)
+
+        refs = read_reference_markdown(tmp_path, max_chars=80, max_file_chars=30)
+
+        # a and b are read (a alone is under the cap, b pushes it over), c is skipped
+        assert list(refs) == ["a.md", "b.md"]
+        assert refs["a.md"].startswith("x" * 30) and refs["a.md"].endswith("...(truncated)")
+
+    def test_missing_dir_and_unreadable_file(self, tmp_path):
+        from skill_seekers.cli.scraper_utils import read_reference_markdown
+
+        assert read_reference_markdown(tmp_path / "nope") == {}
+        (tmp_path / "ok.md").write_text("fine")
+        (tmp_path / "bad.md").write_bytes(b"\xff\xfe not utf8")
+        refs = read_reference_markdown(tmp_path)
+        assert refs["ok.md"] == "fine"
+        assert "bad.md" in refs  # decoded with errors="ignore", never aborts the read
```

---

### Incident Patch 8: `be447345` (2026-09-20)
**Commit Message**: feat(sponsors): add Fluxion AI as Bronze sponsor (#472)

Sponsorship confirmed active on GitHub Sponsors ($50/mo Bronze, since
2026-09-16). Placement assets received from the sponsor: a utm_*-only
registration link (rule 4, verified by render_sponsors.py) and a
transparent PNG wordmark (rule 6: no scripts, external references or
embedded content — the SVG they sent is the same PNG wrapped in an
<image> tag, so it adds nothing over the raster and is not shipped).

- sponsors.json: Fluxion AI under bronze, with `since: September 2026`
- logo trimmed and downscaled from 1822x450 (300 KB) to 400x81 (28 KB);
  Bronze renders at 100px, so this keeps 4x headroom for HiDPI
- all 12 READMEs + SPONSORS.md regenerated via render_sponsors.py --write
- CHANGELOG entry under Unreleased

Co-authored-by: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -10,6 +10,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 _Development version: 3.10.0.dev0_
 
 ### Added
+- **Fluxion AI joins as a Bronze sponsor** — small logo in the README sponsor section across all 12 languages, captioned "Sponsor — Bronze" per rule 2, listed in `SPONSORS.md` with `since: September 2026`. Sponsorship active on GitHub Sponsors since 2026-09-16; link carries standard `utm_*` parameters only (rule 4) and the transparent PNG passed asset review (rule 6).
 - **Vector figures are extracted from PDF pages** (#434, PR #451 by @bferanmi806-sketch) — PDF image extraction relied on `page.get_images()` + `doc.extract_image(xref)`, which only see embedded raster objects, so vector-only diagrams reached neither the extracted assets nor the generated skill. Meaningful vector drawing clusters are now rendered as PNG assets alongside the raster path, with nearby labels kept in the clip. Entries in `extracted_images` carry `source` (`raster`/`vector`) and `bbox`, and pages gain `vector_figures_count` (`images_count` stays raster-only, so `total_images` keeps its meaning for the generated statistics).
   - Detection is deliberately conservative and rejects page frames, separator rules, line-ruled tables and small decorative marks. A cluster made entirely of wide fill-only bands is page furniture — that is what a shaded code block, callout or admonition looks like — and is rejected, so ordinary docs PDFs do not emit PNGs of their own code samples.
   - Figures are emitted in reading order rather than by area, so the `vectorN` suffix and the order in the generated reference markdown follow the page.
```

**File**: `README.ar.md` (modified, +4/-0)
```diff
@@ -28,7 +28,11 @@
 ## 💛 الرعاة
 
 <!-- SPONSORS:START -->
+### Bronze Sponsors
 
+<p align="center">
+  <a href="https://fluxionai.world/register?utm_source=github&utm_medium=sponsor&utm_campaign=skillseekers"><img src="docs/assets/sponsors/fluxion-ai.png" alt="Fluxion AI" width="100"></a><br/><sub><b>Sponsor — Bronze</b></sub>
+</p>
 <!-- SPONSORS:END -->
 
 **[كن راعيًا](SPONSORSHIP.md)** · [GitHub Sponsors](https://github.com/sponsors/yusufkaraaslan)
```

**File**: `README.de.md` (modified, +4/-0)
```diff
@@ -30,7 +30,11 @@
 ## 💛 Sponsoren
 
 <!-- SPONSORS:START -->
+### Bronze Sponsors
 
+<p align="center">
+  <a href="https://fluxionai.world/register?utm_source=github&utm_medium=sponsor&utm_campaign=skillseekers"><img src="docs/assets/sponsors/fluxion-ai.png" alt="Fluxion AI" width="100"></a><br/><sub><b>Sponsor — Bronze</b></sub>
+</p>
 <!-- SPONSORS:END -->
 
 **[Sponsor werden](SPONSORSHIP.md)** · [GitHub Sponsors](https://github.com/sponsors/yusufkaraaslan)
```

**File**: `README.es.md` (modified, +4/-0)
```diff
@@ -30,7 +30,11 @@
 ## 💛 Patrocinadores
 
 <!-- SPONSORS:START -->
+### Bronze Sponsors
 
+<p align="center">
+  <a href="https://fluxionai.world/register?utm_source=github&utm_medium=sponsor&utm_campaign=skillseekers"><img src="docs/assets/sponsors/fluxion-ai.png" alt="Fluxion AI" width="100"></a><br/><sub><b>Sponsor — Bronze</b></sub>
+</p>
 <!-- SPONSORS:END -->
 
 **[Conviértete en patrocinador](SPONSORSHIP.md)** · [GitHub Sponsors](https://github.com/sponsors/yusufkaraaslan)
```

**File**: `README.fr.md` (modified, +4/-0)
```diff
@@ -30,7 +30,11 @@
 ## 💛 Sponsors
 
 <!-- SPONSORS:START -->
+### Bronze Sponsors
 
+<p align="center">
+  <a href="https://fluxionai.world/register?utm_source=github&utm_medium=sponsor&utm_campaign=skillseekers"><img src="docs/assets/sponsors/fluxion-ai.png" alt="Fluxion AI" width="100"></a><br/><sub><b>Sponsor — Bronze</b></sub>
+</p>
 <!-- SPONSORS:END -->
 
 **[Devenir sponsor](SPONSORSHIP.md)** · [GitHub Sponsors](https://github.com/sponsors/yusufkaraaslan)
```

**File**: `README.hi.md` (modified, +4/-0)
```diff
@@ -30,7 +30,11 @@
 ## 💛 प्रायोजक
 
 <!-- SPONSORS:START -->
+### Bronze Sponsors
 
+<p align="center">
+  <a href="https://fluxionai.world/register?utm_source=github&utm_medium=sponsor&utm_campaign=skillseekers"><img src="docs/assets/sponsors/fluxion-ai.png" alt="Fluxion AI" width="100"></a><br/><sub><b>Sponsor — Bronze</b></sub>
+</p>
 <!-- SPONSORS:END -->
 
 **[प्रायोजक बनें](SPONSORSHIP.md)** · [GitHub Sponsors](https://github.com/sponsors/yusufkaraaslan)
```

**File**: `README.ja.md` (modified, +4/-0)
```diff
@@ -30,7 +30,11 @@
 ## 💛 スポンサー
 
 <!-- SPONSORS:START -->
+### Bronze Sponsors
 
+<p align="center">
+  <a href="https://fluxionai.world/register?utm_source=github&utm_medium=sponsor&utm_campaign=skillseekers"><img src="docs/assets/sponsors/fluxion-ai.png" alt="Fluxion AI" width="100"></a><br/><sub><b>Sponsor — Bronze</b></sub>
+</p>
 <!-- SPONSORS:END -->
 
 **[スポンサーになる](SPONSORSHIP.md)** · [GitHub Sponsors](https://github.com/sponsors/yusufkaraaslan)
```

**File**: `README.ko.md` (modified, +4/-0)
```diff
@@ -30,7 +30,11 @@
 ## 💛 스폰서
 
 <!-- SPONSORS:START -->
+### Bronze Sponsors
 
+<p align="center">
+  <a href="https://fluxionai.world/register?utm_source=github&utm_medium=sponsor&utm_campaign=skillseekers"><img src="docs/assets/sponsors/fluxion-ai.png" alt="Fluxion AI" width="100"></a><br/><sub><b>Sponsor — Bronze</b></sub>
+</p>
 <!-- SPONSORS:END -->
 
 **[스폰서 되기](SPONSORSHIP.md)** · [GitHub Sponsors](https://github.com/sponsors/yusufkaraaslan)
```

---

### Incident Patch 9: `0709580b` (2026-09-13)
**Commit Message**: fix(hud): final review — working vector uploads, merged analysis manifests, unsaved-edit guard, install path, sync copy

run_upload filtered the packager's output on .zip/.gz, so every vector/RAG
target (which writes <name>-<target>.json) failed with "produced no archive";
it now takes the newest regular file in the target's own directory, and a
missing directory raises the same RuntimeError instead of a FileNotFoundError.

run_analyze no longer rmtree's the whole run directory: it clears only the
outputs of the tools this invocation runs and merges into the existing
manifest, so a per-tool re-run keeps its siblings' results. The manifest is
written in a finally, recording "<tool> exited <code>" when a tool fails
instead of leaving the Analysis cards with nothing to read.

POST /api/environment/agents/{agent}/install no longer accepts a
caller-supplied skill_dir — the source is always the workspace bootstrap
output. UPLOAD_TARGETS is derived from adaptors.get_upload_platforms(), so
faiss/qdrant are rejected with a 400 rather than queued into an argparse
failure.

The store gains dirty/setDirty/confirmLeave; SkillPage and ConfigPage publish
their editor dirtiness and the sidebar, he

**File**: `CHANGELOG.md` (modified, +6/-3)
```diff
@@ -23,8 +23,8 @@ _Development version: 3.10.0.dev0_
 - Seeker HUD: `GET /api/mcp/status` probes the stdio/HTTP transports; the Seeker MCP tab shows real status and copyable client config.
 - Seeker HUD: live skill search shared between the top bar and the grid; configs search; 25/50/100 paging on the skills, configs and workflows lists.
 - Seeker HUD: routed skill page at `/skills/<id>` with Overview, SKILL.md, Files, Installs, Enhance, Analysis, Export, and History tabs, replacing the skill drawer.
-- Seeker HUD: routed config page at `/configs/<id>` with Overview, JSON, Validate, Estimate, Sync, Push/Submit, and Generate tabs, replacing the config drawer.
-- Seeker HUD: Workflows screen at `/workflows/<name>` lists, views, copies, edits, validates, and deletes enhancement-workflow YAML.
+- Seeker HUD: routed config page at `/configs/<id>` with Overview, JSON, Validate, Estimate, Sync, Push/Submit, and Generate tabs.
+- Seeker HUD: Workflows screen at `/workflows` (rows select `/workflows/<name>`) lists, views, copies, edits, validates, and deletes enhancement-workflow YAML.
 - Seeker HUD: Analyze screen at `/analyze` runs the C3.x codebase-analysis tools against a directory, skill, or owner/repo target and records manifests under `output/_analysis/`.
 - Seeker HUD: Environment screen at `/environment` adds Doctor, Servers (start/stop the MCP HTTP and embedding servers), and Agents (install/reinstall a skill) panels alongside the MCP tools catalogue.
 - Seeker HUD: twelve new job types — `upload`, `translate`, `update`, `quality`, `analyze`, `split`, `push`, `submit`, `sync-check`, `generate-config`, `install-agent`, `server` — back the new page actions; servers started from Environment run as jobs, and stopping the server cancels the job.
@@ -41,7 +41,10 @@ _Development version: 3.10.0.dev0_
 - Seeker HUD: a `SKILL.md` nested inside a skill directory (e.g. vercel's `ai-sdk/upstream/`) no longer shows up as a separate skill; pressing Enter in the top-bar search no longer triggers the opened drawer's first action; the Seeker MCP status cards no longer overflow; the web API test fixture now owns its own `JobManager`, so test jobs stop leaking into `~/.skill-seekers/ui/`.
 - Seeker HUD: config sync-state paths are read and written through one sanitised `sync_state_path()` helper, closing a path-traversal read of arbitrary `*_sync.json` files via an unsanitised config `name`.
 - Seeker HUD: sync checks now detect and report unreachable pages (non-zero exit, `status: "error"`, unreachable-page count) instead of silently recording a down docs site as zero changes.
-- Seeker HUD: analysis runs are isolated per target by a hashed run directory, so concurrent runs no longer share state, and a stale previous run's leftover test output no longer falsely triggers the guides step.
+- Seeker HUD: analysis runs are isolated per target by a hashed run directory, so concurrent runs no longer share state, and a stale previous run's leftover test output no longer falsely triggers the guides step. Running one tool now merges into the target's manifest instead of replacing it (a re-run clears only that tool's own output), and the manifest is written even when a tool exits non-zero, recording the failure alongside the results that survived.
+- Seeker HUD: uploads to the vector/RAG targets work again — the packager's `<name>-<target>.json` output was filtered out by an archive-only extension check, so every Chroma/Weaviate/Pinecone upload failed with "produced no archive".
+- Seeker HUD: `POST /api/environment/agents/{agent}/install` no longer accepts a caller-supplied `skill_dir`; the install source is always the workspace's own bootstrap output. Upload targets are derived from the adaptor registry, so `faiss`/`qdrant` are rejected up front instead of queueing a job that dies in argparse.
+- Seeker HUD: leaving a skill or config page with unsaved SKILL.md / JSON edits now asks for confirmation — the sidebar, header search and breadcrumbs used to discard the draft silently, since `BrowserRouter` has no `useBlocker`.
 - Seeker HUD: unmatched `/api/*` paths now 404 for every HTTP method, without widening the SPA catch-all route's accepted methods.
 - Seeker HUD: Doctor check levels are normalised (`pass`/`warn`/`fail` → `ok`/`warning`/`error`) so the status pill reflects real failures, and agent install paths resolve under the HUD's workspace root instead of the server process's working directory.
 
```

**File**: `CLAUDE.md` (modified, +5/-0)
```diff
@@ -190,6 +190,11 @@ Local codebase analysis features, all opt-out (`--skip-*` flags):
 - **Tools run in-process** via `run_cli_main()` in `mcp/tools/_common.py`: same argv parsed by the command's REAL parser (sys.argv patch under a lock), stdout/stderr capture + contextvar log capture, identical `(stdout, stderr, returncode)` contract. No subprocess startup; old hard timeouts are advisory.
 - **Exceptions BY DESIGN**: `enhance_skill` (LOCAL agent) and `install_skill`'s enhancement step stay subprocess — the agent must be a real child process for the fork-bomb-guard env semantics (`SKILL_SEEKER_ENHANCE_ACTIVE`). Never make these in-process.
 - **Domain logic lives in `skill_seekers.services/`** (marketplace_manager, marketplace_publisher, config_publisher, source_manager, git_repo) — importable by CLI without the `[mcp]` extra; old `skill_seekers.mcp.*` paths are back-compat shims. No `sys.path` hacks anywhere in `mcp/`.
+
+### Seeker HUD (web UI)
+
+FastAPI backend in `src/skill_seekers/web/`, React app in `ui/`; see `docs/guides/WEB_UI.md`.
+
 - HUD routes live in `src/skill_seekers/web/routes/` (one module per screen, `register(app, ctx)`); `app.py` keeps the original routes.
 
 ### Enhancement (AgentClient is the single AI transport)
```

**File**: `src/skill_seekers/web/analysis_store.py` (modified, +11/-0)
```diff
@@ -33,6 +33,17 @@ def slug_for(value: str) -> str:
     return f"{stem}-{hashlib.sha256(value.encode('utf-8')).hexdigest()[:8]}"
 
 
+def read_manifest(root: Path, slug: str) -> dict[str, Any]:
+    """The manifest already recorded for ``slug``, or ``{}`` if there is none.
+
+    A run of one tool merges into whatever earlier runs of the other tools
+    recorded, so the reader has to tolerate a missing or malformed file.
+    """
+    safe_name(slug)
+    data = read_json(analysis_root(root) / slug / "manifest.json", {})
+    return data if isinstance(data, dict) else {}
+
+
 def write_manifest(root: Path, slug: str, data: dict[str, Any]) -> Path:
     """Record one analysis run; ``slug`` must be a single path component."""
     safe_name(slug)
```

**File**: `src/skill_seekers/web/routes/environment.py` (modified, +5/-10)
```diff
@@ -9,7 +9,6 @@
 from __future__ import annotations
 
 import time
-from pathlib import Path
 from typing import Any
 
 from fastapi import FastAPI, HTTPException
@@ -25,7 +24,9 @@
 # Module level on purpose: this file uses `from __future__ import annotations`,
 # and FastAPI cannot resolve a request model defined inside register().
 class InstallAgentRequest(BaseModel):
-    skill_dir: str | None = None
+    # No skill_dir field on purpose: the source is always the workspace's own
+    # bootstrap output, so a request body can never point the installer at an
+    # arbitrary directory on this machine.
     force: bool = False
 
 
@@ -160,16 +161,10 @@ def install_agent_route(agent: str, req: InstallAgentRequest) -> dict[str, Any]:
 
         if agent not in get_available_agents():
             raise HTTPException(400, "Unsupported agent")
-        skill_dir = (
-            Path(req.skill_dir).expanduser()
-            if req.skill_dir
-            else workspace_dir(ctx.root, "output") / "skill-seekers"
-        )
+        skill_dir = workspace_dir(ctx.root, "output") / "skill-seekers"
         if not (skill_dir / "SKILL.md").is_file():
             raise HTTPException(
-                409,
-                "Build the Skill Seekers skill first (scripts/bootstrap_skill.sh) "
-                "or choose a skill directory",
+                409, "Build the Skill Seekers skill first (scripts/bootstrap_skill.sh)"
             )
         job = ctx.submit_job(
             "install-agent",
```

**File**: `src/skill_seekers/web/routes/skill_detail.py` (modified, +12/-12)
```diff
@@ -10,17 +10,17 @@
 from .. import registry
 from ..context import HudContext
 
-UPLOAD_TARGETS = {
-    "claude",
-    "gemini",
-    "openai",
-    "kimi",
-    "chroma",
-    "faiss",
-    "qdrant",
-    "weaviate",
-    "pinecone",
-}
+
+def upload_targets() -> set[str]:
+    """Targets whose adaptor actually uploads.
+
+    Derived from the adaptor registry rather than hand-listed: faiss and qdrant
+    package fine but have no uploading adaptor, so accepting them here queued a
+    job that died in ``upload_skill``'s argparse.
+    """
+    from skill_seekers.cli.adaptors import get_upload_platforms
+
+    return set(get_upload_platforms())
 
 
 class UploadRequest(BaseModel):
@@ -109,7 +109,7 @@ def skill_enhance_status(skill_id: str) -> dict[str, Any] | None:
     def upload_skill(skill_id: str, req: UploadRequest) -> dict[str, Any]:
         from ..paths import workspace_dir
 
-        if req.target not in UPLOAD_TARGETS:
+        if req.target not in upload_targets():
             raise HTTPException(400, f"Unsupported upload target: {req.target}")
         skill_dir = ctx.skill_dir_for(skill_id)
         job = ctx.submit_job(
```

**File**: `src/skill_seekers/web/runner.py` (modified, +134/-93)
```diff
@@ -508,10 +508,16 @@ def run_upload(spec: dict[str, Any]) -> int:
     )
     if code != 0:
         return code
-    archives = [p for p in (out / target).iterdir() if p.suffix in (".zip", ".gz")]
-    if not archives:
-        raise RuntimeError(f"packaging for {target} produced no archive under {out / target}")
-    newest = max(archives, key=lambda p: p.stat().st_mtime)
+    # Not every target produces an archive: the vector/RAG adaptors (chroma,
+    # weaviate, pinecone…) write <name>-<target>.json. run_package gives each
+    # target a directory holding exactly this run's output, so take the newest
+    # regular file in it whatever the extension — filtering on .zip/.gz made
+    # every vector upload fail with "produced no archive".
+    target_dir = out / target
+    outputs = [p for p in target_dir.iterdir() if p.is_file()] if target_dir.is_dir() else []
+    if not outputs:
+        raise RuntimeError(f"packaging for {target} produced no output under {target_dir}")
+    newest = max(outputs, key=lambda p: p.stat().st_mtime)
     argv = [str(newest), "--target", target]
     for key, flag in UPLOAD_OPTION_FLAGS.items():
         value = (spec.get("options") or {}).get(key)
@@ -587,6 +593,28 @@ def _analysis_count(tool: str, path: Path) -> float | None:
     return None
 
 
+def _analysis_output(tool: str, out_dir: Path) -> Path:
+    """The file or directory ``tool`` owns inside an analysis run directory."""
+    if tool in ("patterns", "router"):
+        return out_dir / tool
+    return out_dir / f"{tool}.json"
+
+
+def _clear_analysis_outputs(tools: list[str], out_dir: Path) -> None:
+    """Remove only what this run rewrites.
+
+    Clearing the whole directory would delete the results of tools this run did
+    not select, which the merged manifest still points at; leaving a re-run
+    tool's own file behind would let it be recorded as a fresh result.
+    """
+    for tool in tools:
+        path = _analysis_output(tool, out_dir)
+        if path.is_dir():
+            shutil.rmtree(path, ignore_errors=True)
+        else:
+            path.unlink(missing_ok=True)
+
+
 def _tool_output(path: Path, nested: str | None = None) -> Path | None:
     """Resolve a tool's result: the path itself, or a known file inside it."""
     if path.is_file():
@@ -642,115 +670,128 @@ def _analysis_target(spec: dict[str, Any]):
 
 def run_analyze(spec: dict[str, Any]) -> int:
     """Run the selected C3.x tools over a target and record a manifest."""
-    from .analysis_store import slug_for, write_manifest
+    from .analysis_store import read_manifest, slug_for, write_manifest
 
     root = Path(spec["cwd"])
     slug = slug_for(spec["target"]["value"])
     out_dir = Path(spec["output_dir"]) / "_analysis" / slug
-    # Start from an empty run directory: otherwise a file left by an earlier run
-    # (say tests.json when only `guides` was selected) is picked up and recorded
-    # as a fresh result under this run's timestamp.
-    shutil.rmtree(out_dir, ignore_errors=True)
-    out_dir.mkdir(parents=True, exist_ok=True)
     depth = ANALYZE_DEPTH.get(spec.get("depth", "basic"), "surface")
     ai_mode = spec.get("ai_mode", "off")
     no_ai = ai_mode == "off"
-    results: dict[str, Any] = {}
-    ran: list[str] = []
-    skipped: list[str] = []
     tools = sorted(
         spec["tools"],
         key=lambda t: (
             ANALYZE_TOOL_ORDER.index(t) if t in ANALYZE_TOOL_ORDER else len(ANALYZE_TOOL_ORDER)
         ),
     )
-    with _analysis_target(spec) as target:
-        for i, tool in enumerate(tools):
-            progress(10 + int((i / len(tools)) * 85), f"{tool}…")
-            out = out_dir / f"{tool}.json"
-            nested = None
-            if tool == "patterns":
-                out, nested = out_dir / "patterns", PATTERN_RESULT_NAME
-                code = _run_cli_main(
-                    "skill_seekers.cli.pattern_recognizer",
-                    ["--directory", target, "--output", str(out), "--depth", depth, "--json"],
-                )
-            elif tool == "tests":
-                code = _capture_json(
-                    "skill_seekers.cli.test_example_extractor",
-                    [
-                        target,
-                        "--json",
-                        "--recursive",
-                        "--min-confidence",
-                        str(spec.get("min_confidence", 0.7)),
-                    ],
-                    out,
-                )
-            elif tool == "guides":
-                # Gate on what THIS run produced, never on a leftover file.
-                if "tests" not in ran:
-                    print("skipping guides: select the tests tool to feed it", flush=True)
-                    skipped.append(tool)
-                    continue
-                # --json-output makes the builder print the collection and
-                # ignore --output, so capture stdout instead.
-                argv = ["--input", str(out_dir / "test
```

**File**: `tests/test_web_environment.py` (modified, +16/-0)
```diff
@@ -63,3 +63,19 @@ def test_server_start_stop_and_agent_install_jobs(workspace, monkeypatch):
     assert client.post("/api/environment/agents/claude/install", json={}).status_code == 200
     assert submitted[-1][3]["type"] == "install-agent" and submitted[-1][3]["agent"] == "claude"
     assert client.post("/api/environment/agents/nope/install", json={}).status_code == 400
+
+
+def test_agent_install_ignores_a_caller_supplied_skill_dir(workspace, monkeypatch):
+    """The install source is the workspace bootstrap output, never request input."""
+    root, client = workspace
+    submitted = []
+    monkeypatch.setattr(
+        get_job_manager(),
+        "submit",
+        lambda *a: submitted.append(a) or Job("srv", a[0], a[1], a[2], status="running", spec=a[3]),
+    )
+    _mk_skill(root / "output/skill-seekers")
+    response = client.post("/api/environment/agents/claude/install", json={"skill_dir": "/etc"})
+    assert response.status_code in (200, 422)
+    if response.status_code == 200:
+        assert submitted[-1][3]["skill_dir"] == str(root / "output" / "skill-seekers")
```

**File**: `tests/test_web_runner_jobs.py` (modified, +68/-3)
```diff
@@ -5,19 +5,23 @@
 import os
 from pathlib import Path
 
+import pytest
+
 from tests.test_web_api import _mk_skill, workspace  # noqa: F401
 from skill_seekers.cli import estimate_pages as estimate_pages_mod
 from skill_seekers.web import analysis_store, runner
 
 
 def test_run_upload_packages_then_uploads(workspace, monkeypatch):
+    """The vector/RAG adaptors write <name>-<target>.json, never an archive."""
     root, _ = workspace
     calls = []
 
     def fake_cli(module, argv):
         calls.append((module, argv))
         if module.endswith("package_skill"):
-            Path(argv[0]).with_suffix(".zip").write_text("zip")
+            staged = Path(argv[0])
+            staged.with_name(f"{staged.name}-chroma.json").write_text("{}")
         return 0
 
     monkeypatch.setattr(runner, "_run_cli_main", fake_cli)
@@ -30,10 +34,25 @@ def fake_cli(module, argv):
     }
     assert runner.run_upload(spec) == 0
     upload = next(c for c in calls if c[0].endswith("upload_skill"))
-    assert upload[1][0].endswith("chroma/demo.zip")
+    assert upload[1][0].endswith("chroma/demo-chroma.json")
     assert upload[1][1:5] == ["--target", "chroma", "--persist-directory", "./chroma_db"]
 
 
+def test_run_upload_fails_cleanly_when_packaging_wrote_nothing(workspace, monkeypatch):
+    """No target directory at all must raise the same RuntimeError, not an OSError."""
+    root, _ = workspace
+    monkeypatch.setattr(runner, "run_package", lambda _spec: 0)
+    spec = {
+        "skill_dir": str(root / "output/demo"),
+        "output_dir": str(root / "output/_packages"),
+        "target": "chroma",
+        "options": {},
+        "cwd": str(root),
+    }
+    with pytest.raises(RuntimeError, match="produced no output"):
+        runner.run_upload(spec)
+
+
 def test_run_upload_picks_newest_archive_by_mtime(workspace, monkeypatch):
     """Regression: run_package's collision naming keeps the ORIGINAL <name>.zip
     and suffixes every later regeneration (<name>-<suffix>.zip). Since "-"
@@ -216,7 +235,53 @@ def test_run_analyze_never_reports_a_previous_runs_files(workspace, monkeypatch)
     manifest = analysis_store.list_recent(root)[0]
     assert "guides" not in manifest["results"]
     assert manifest["tools"] == [] and manifest["skipped"] == ["guides"]
-    assert not (stale / "tests.json").exists()
+    # Cleanup is per tool now, so a sibling tool's file survives this run — but
+    # it is still neither an input for `guides` nor a result of this run.
+    assert (stale / "tests.json").exists()
+
+
+def _patterns_cli(_module, argv):
+    """Stand-in for pattern_recognizer: --output is a directory."""
+    out = Path(argv[argv.index("--output") + 1])
+    out.mkdir(parents=True, exist_ok=True)
+    (out / "detected_patterns.json").write_text(json.dumps({"total_patterns_detected": 5}))
+    return 0
+
+
+def test_run_analyze_merges_results_across_per_tool_runs(workspace, monkeypatch):
+    """Re-running one tool must not erase the sibling results already recorded."""
+    root, _ = workspace
+
+    def fake_cli(module, argv):
+        if module.endswith("pattern_recognizer"):
+            return _patterns_cli(module, argv)
+        Path(argv[argv.index("--output") + 1]).write_text(json.dumps({"metrics": {"overall": 88}}))
+        return 0
+
+    monkeypatch.setattr(runner, "_run_cli_main", fake_cli)
+    assert runner.run_analyze(_analyze_spec(root, root, ["patterns"])) == 0
+    assert runner.run_analyze(_analyze_spec(root, root, ["quality"])) == 0
+    manifest = analysis_store.list_recent(root)[0]
+    assert set(manifest["results"]) == {"patterns", "quality"}
+    assert manifest["results"]["patterns"]["count"] == 5
+    assert manifest["results"]["quality"]["count"] == 88
+    assert sorted(manifest["tools"]) == ["patterns", "quality"]
+    assert "error" not in manifest
+
+
+def test_run_analyze_records_a_failing_tool_and_keeps_prior_results(workspace, monkeypatch):
+    """A tool that exits non-zero must still leave a manifest behind."""
+    root, _ = workspace
+    monkeypatch.setattr(runner, "_run_cli_main", _patterns_cli)
+    assert runner.run_analyze(_analyze_spec(root, root, ["patterns"])) == 0
+
+    monkeypatch.setattr(runner, "_run_cli_main", lambda _m, _a: 3)
+    assert runner.run_analyze(_analyze_spec(root, root, ["quality"])) == 3
+    manifest = analysis_store.list_recent(root)[0]
+    assert manifest["error"] == "quality exited 3"
+    assert manifest["results"]["patterns"]["count"] == 5
+    assert "quality" not in manifest["results"]
+    assert manifest["tools"] == ["patterns"]
 
 
 def test_slug_for_separates_targets_sharing_a_basename():
```

---

### Incident Patch 10: `d53262e2` (2026-09-13)
**Commit Message**: fix(hud): clamp analyze confidence; slug column label

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01CjVnprDdTWsh8N6fqc37pP

**File**: `ui/src/sections/Analyze.tsx` (modified, +11/-3)
```diff
@@ -85,14 +85,20 @@ export default function Analyze() {
     ...(tools.includes('quality') ? ['--quality-check'] : []),
   ].join(' ');
 
-  const runDisabled = store.pending || selectedTools.length === 0 || !targetValue.trim();
+  // The number input's min/max only constrain the spinner, not typed text —
+  // a typed 2 must disable the run rather than reach the backend, which
+  // rejects min_confidence outside 0–1 with a 400.
+  const minConfidenceNumber = Number(minConfidence);
+  const minConfidenceInvalid = minConfidence.trim() === '' || Number.isNaN(minConfidenceNumber) || minConfidenceNumber < 0 || minConfidenceNumber > 1;
+
+  const runDisabled = store.pending || selectedTools.length === 0 || !targetValue.trim() || minConfidenceInvalid;
 
   const run = async () => {
     const body: AnalyzeBody = {
       target: { kind: targetKind, value: targetValue.trim() },
       tools: selectedTools,
       depth,
-      min_confidence: Number(minConfidence) || 0,
+      min_confidence: Math.min(1, Math.max(0, Number(minConfidence) || 0)),
       ai_mode: aiMode,
       attach_to: attachTo || null,
     };
@@ -224,8 +230,10 @@ export default function Analyze() {
                   step={0.05}
                   value={minConfidence}
                   onChange={(e) => setMinConfidence(e.target.value)}
+                  aria-invalid={minConfidenceInvalid}
                   className="mt-1 h-8 font-mono-hud text-xs bg-secondary/50"
                 />
+                {minConfidenceInvalid && <p className="mt-1 text-[10px] text-destructive">must be between 0 and 1</p>}
               </div>
               <div>
                 <FL>AI enhancement</FL>
@@ -274,7 +282,7 @@ export default function Analyze() {
               <table className="w-full min-w-[520px] text-sm">
                 <thead>
                   <tr className="border-b border-border font-mono-hud text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
-                    <th className="px-3 py-2.5 text-left font-medium">target</th>
+                    <th className="px-3 py-2.5 text-left font-medium">slug</th>
                     <th className="px-3 py-2.5 text-left font-medium">tools</th>
                     <th className="px-3 py-2.5 text-left font-medium">started</th>
                     <th className="px-3 py-2.5 text-left font-medium">attached to</th>
```

**File**: `ui/tests/pages.spec.ts` (modified, +11/-2)
```diff
@@ -199,8 +199,17 @@ test('analyze submits the selected tools for a directory', async ({ page }) => {
   await page.getByRole('textbox', { name: 'local path' }).fill('~/dev/lazy-bird');
   await page.getByRole('checkbox', { name: /Design patterns/ }).check();
   await page.getByRole('checkbox', { name: /Quality check/ }).check();
-  await page.getByRole('button', { name: 'Run analysis' }).click();
-  await expect.poll(() => body).toMatchObject({ target: { kind: 'dir', value: '~/dev/lazy-bird' }, tools: ['patterns', 'quality'], depth: 'basic' });
+  const runButton = page.getByRole('button', { name: 'Run analysis' });
+  const confidence = page.getByRole('spinbutton', { name: 'Minimum confidence' });
+  // The number input's min/max only constrain the spinner, not typed text —
+  // a typed 2 must disable the run rather than reach the backend, which
+  // rejects min_confidence outside 0-1 with a 400.
+  await confidence.fill('2');
+  await expect(runButton).toBeDisabled();
+  await confidence.fill('0.5');
+  await expect(runButton).toBeEnabled();
+  await runButton.click();
+  await expect.poll(() => body).toMatchObject({ target: { kind: 'dir', value: '~/dev/lazy-bird' }, tools: ['patterns', 'quality'], depth: 'basic', min_confidence: 0.5 });
 });
 
 // The skill page packs eight tabs of tables, chip rows and card grids into the
```

---

### Incident Patch 11: `54e30abc` (2026-09-13)
**Commit Message**: fix(hud): Use in Create waits for workspace settings

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01CjVnprDdTWsh8N6fqc37pP

**File**: `ui/src/sections/Workflows.tsx` (modified, +19/-1)
```diff
@@ -1,5 +1,6 @@
 import { useState } from 'react';
 import { useNavigate } from 'react-router';
+import { toast } from 'sonner';
 import { Panel, SectionHeader } from '@/components/hud';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
@@ -57,6 +58,16 @@ export default function Workflows({ selected }: { selected: string | null }) {
   const openWorkflow = (name: string) => navigate(`/workflows/${encodeURIComponent(name)}`);
 
   const stashForCreate = (name: string) => {
+    // `/api/workflows` and `/api/settings` load in parallel — `store.root`
+    // reads '' until settings arrive, and a draft stashed under
+    // `seeker.create..workflows` (empty root) is never read back by
+    // sections/Create.tsx (its draftKey is keyed by the real root). The
+    // button is disabled until settings load (see WorkflowDetail below),
+    // but guard here too rather than trust only the disabled prop.
+    if (!store.root) {
+      toast.error('Workspace settings not loaded yet');
+      return;
+    }
     // Mirrors sections/Create.tsx's draft key exactly (`seeker.create.<root>.`
     // + field name) so the Create screen picks this up as its `workflows`
     // draft on the next load.
@@ -294,7 +305,14 @@ function WorkflowDetail({ row, reload, onUseInCreate }: {
           <Button size="sm" variant="outline" disabled={store.pending} onClick={validate} className="font-mono-hud text-[11px] uppercase tracking-wider">
             <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Validate
           </Button>
-          <Button size="sm" variant="outline" onClick={onUseInCreate} className="font-mono-hud text-[11px] uppercase tracking-wider">
+          <Button
+            size="sm"
+            variant="outline"
+            disabled={!store.settings}
+            title={store.settings ? undefined : 'Loading workspace settings…'}
+            onClick={onUseInCreate}
+            className="font-mono-hud text-[11px] uppercase tracking-wider"
+          >
             <Wand2 className="mr-1.5 h-3.5 w-3.5" /> Use in Create
           </Button>
           {row.origin === 'bundled' ? (
```

**File**: `ui/tests/pages.spec.ts` (modified, +15/-0)
```diff
@@ -174,6 +174,21 @@ test('workflows install dialog PUTs a new user workflow and closes on success',
   await expect(page.getByRole('dialog')).toHaveCount(0);
 });
 
+test('Use in Create waits for workspace settings before stashing the create draft', async ({ page }) => {
+  await page.route('**/api/settings', async route => {
+    await new Promise((resolve) => setTimeout(resolve, 1500));
+    return route.fulfill({ json: payloads['/api/settings'] });
+  });
+  await page.goto('/workflows/default');
+  const button = page.getByRole('button', { name: 'Use in Create' });
+  await expect(button).toBeDisabled();
+  await expect(button).toBeEnabled({ timeout: 5000 });
+  await button.click();
+  await expect(page).toHaveURL(/\/create$/);
+  const stashed = await page.evaluate(() => sessionStorage.getItem('seeker.create./ws.workflows'));
+  expect(stashed).toBe('["default"]');
+});
+
 // The skill page packs eight tabs of tables, chip rows and card grids into the
 // same column the nav sections use; every one of them has to fit the narrow
 // viewports hud.spec.ts pins for the rest of the HUD.
```

---

### Incident Patch 12: `57f7164e` (2026-09-13)
**Commit Message**: fix(hud): sync tab refreshes, guarded JSON editor, Generate with AI from Library

Review round 1 fixes for Task 11 (three Important findings):

- SyncTab now takes an onChanged callback (wired to the page's reload) and
  calls it after every successful setSync/syncCheck, so the stats-strip pill
  and the Overview Lifecycle bullet update and a tab switch away-and-back
  re-seeds the switch from fresh data instead of stale mount-time props.
- Lifted the JSON editor's editing/draft/error state out of JsonTab into
  ConfigPage itself (mirrors SkillPage.tsx's editing/draft/dirty/beforeunload
  pattern): the revision sent on save is now pinned at startEdit() rather
  than re-read from `data.revision` at save time; the jobs-driven detail
  reload is skipped while editing; a dirty guard with a confirm dialog now
  gates every path that changes tabs (the tab bar itself and the header's
  Validate/Estimate shortcuts), plus a beforeunload warning while dirty.
- Extracted the Generate tab's form into a shared
  `ui/src/components/generate-config-form.tsx` (`onGenerated?: () => void`)
  and added a "Generate with AI" button to Library's header, next to "Add
  config source", opening a dialog th

**File**: `ui/src/components/generate-config-form.tsx` (added, +89/-0)
```diff
@@ -0,0 +1,89 @@
+// Shared "Generate a config with AI" form — used by ConfigPage's Generate tab
+// and by Library's "Generate with AI" dialog (POST /api/configs/generate).
+import { useState } from 'react';
+import { Button } from '@/components/ui/button';
+import { Input } from '@/components/ui/input';
+import { Checkbox } from '@/components/ui/checkbox';
+import { useStore } from '@/lib/store';
+import { cn } from '@/lib/utils';
+import { Sparkles } from 'lucide-react';
+
+const GENERATE_KINDS: { id: 'url' | 'name' | 'dir'; label: string; placeholder: string }[] = [
+  { id: 'url', label: 'Docs URL', placeholder: 'https://docs.example.com/' },
+  { id: 'name', label: 'Framework name', placeholder: 'react' },
+  { id: 'dir', label: 'Project directory', placeholder: './my-project' },
+];
+
+export function GenerateConfigForm({ onGenerated }: { onGenerated?: () => void }) {
+  const store = useStore();
+  const [kind, setKind] = useState<'url' | 'name' | 'dir'>('url');
+  const [value, setValue] = useState('');
+  const [probe, setProbe] = useState(true);
+  const agents = store.settings?.capabilities.agents ?? [];
+  const [agent, setAgent] = useState(String(store.settings?.defaults.default_agent ?? 'claude'));
+  const active = GENERATE_KINDS.find((k) => k.id === kind) ?? GENERATE_KINDS[0];
+
+  const submit = async () => {
+    if (await store.generateConfig({ kind, value: value.trim(), probe_urls: probe })) {
+      setValue('');
+      onGenerated?.();
+    }
+  };
+
+  return (
+    <div className="space-y-3">
+      <p className="text-xs text-muted-foreground">
+        Writes a new unified config by inspecting a documentation site, resolving a framework name against the registry, or scanning a
+        local project directory. Runs as a background job — check Jobs for progress.
+      </p>
+      <div className="flex flex-wrap gap-1.5">
+        {GENERATE_KINDS.map((k) => (
+          <button
+            key={k.id}
+            aria-pressed={kind === k.id}
+            onClick={() => setKind(k.id)}
+            className={cn(
+              'rounded border px-2.5 py-1 font-mono-hud text-[11px] transition-colors',
+              kind === k.id ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground',
+            )}
+          >
+            {k.label}
+          </button>
+        ))}
+      </div>
+      <div className="space-y-1">
+        <div className="font-mono-hud text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{active.label}</div>
+        <Input
+          aria-label={active.label}
+          value={value}
+          onChange={(e) => setValue(e.target.value)}
+          placeholder={active.placeholder}
+          className="h-8 font-mono-hud text-xs"
+        />
+      </div>
+      <div className="space-y-1">
+        <div className="font-mono-hud text-[10px] uppercase tracking-[0.2em] text-muted-foreground">enhancement agent (display only)</div>
+        <select
+          aria-label="Enhancement agent"
+          value={agent}
+          onChange={(e) => setAgent(e.target.value)}
+          className="h-8 w-full rounded border border-border bg-secondary/40 px-2 font-mono-hud text-xs outline-none focus:border-primary/50"
+        >
+          {agents.map((a) => <option key={a} value={a}>{a}</option>)}
+        </select>
+        <p className="text-[10px] text-muted-foreground">Config generation is not agent-driven — this only previews which agent later enhancement passes would use.</p>
+      </div>
+      <label className="flex items-center gap-2.5 font-mono-hud text-[11px] text-foreground/80 cursor-pointer select-none">
+        <Checkbox checked={probe} onCheckedChange={(v) => setProbe(v === true)} />
+        probe discovered URLs before writing the config
+      </label>
+      <Button
+        className="w-full font-mono-hud text-[11px] uppercase tracking-wider"
+        disabled={store.pending || !value.trim()}
+        onClick={submit}
+      >
+        <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Generate config
+      </Button>
+    </div>
+  );
+}
```

**File**: `ui/src/sections/ConfigPage.tsx` (modified, +109/-112)
```diff
@@ -9,13 +9,14 @@ import { Input } from '@/components/ui/input';
 import { Checkbox } from '@/components/ui/checkbox';
 import { Switch } from '@/components/ui/switch';
 import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
+import { GenerateConfigForm } from '@/components/generate-config-form';
 import { usePayload } from '@/hooks/use-payload';
 import { api } from '@/lib/api';
 import type { ConfigDetail, Validation } from '@/lib/api';
 import { useStore } from '@/lib/store';
 import { cn } from '@/lib/utils';
 import {
-  CheckCircle2, Copy, FileJson, Gauge, GitBranch, Pencil, RefreshCw, Rocket, Scissors, Sparkles, UploadCloud, Wand2,
+  CheckCircle2, Copy, FileJson, Gauge, GitBranch, Pencil, RefreshCw, Rocket, Scissors, UploadCloud, Wand2,
 } from 'lucide-react';
 
 // ── static tables ───────────────────────────────────────────────────────────
@@ -35,12 +36,6 @@ const SPLIT_STRATEGIES = ['auto', 'none', 'source', 'category', 'router', 'size'
 // PUT .../sync's argparse-equivalent choices (routes/configs.py:SYNC_INTERVALS).
 const SYNC_INTERVALS = ['hourly', 'daily', 'weekly', 'manual'] as const;
 
-const GENERATE_KINDS: { id: 'url' | 'name' | 'dir'; label: string; placeholder: string }[] = [
-  { id: 'url', label: 'Docs URL', placeholder: 'https://docs.example.com/' },
-  { id: 'name', label: 'Framework name', placeholder: 'react' },
-  { id: 'dir', label: 'Project directory', placeholder: './my-project' },
-];
-
 // registry.list_config_entries origins — same palette as sections/Library.tsx
 // (not exported from there, so this is the one deliberate duplicate).
 const ORIGIN_STYLE: Record<string, string> = {
@@ -121,14 +116,37 @@ export default function ConfigPage({ id }: { id: string }) {
   const [splitStrategy, setSplitStrategy] = useState<(typeof SPLIT_STRATEGIES)[number]>('auto');
   const [splitTarget, setSplitTarget] = useState(5000);
 
+  // JSON editor state lives here, not in JsonTab, so a tab change (or the
+  // header's Validate/Estimate shortcuts, which also change tabs) can guard
+  // against silently discarding a draft — mirrors SkillPage.tsx's
+  // editing/draft/dirty/beforeunload pattern (SkillPage.tsx:172-231).
+  const [editingJson, setEditingJson] = useState(false);
+  const [jsonDraft, setJsonDraft] = useState('');
+  const [jsonError, setJsonError] = useState('');
+  // The revision sent on save is pinned at the moment editing starts, not
+  // re-read from `data.revision` at save time — `data` can be refreshed from
+  // under an open editor (job polling, a manual reload), which would silently
+  // swap in a fresher revision and defeat the 409 conflict check.
+  const [pinnedRevision, setPinnedRevision] = useState('');
+
+  const dirty = editingJson && data !== null && jsonDraft !== JSON.stringify(data.data, null, 2);
+  useEffect(() => {
+    if (!dirty) return;
+    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
+    window.addEventListener('beforeunload', warn);
+    return () => window.removeEventListener('beforeunload', warn);
+  }, [dirty]);
+
   // Estimate/sync-check/push/submit/generate all run as background jobs whose
   // results only land once the job finishes and rewrites the config's
   // sidecar files, so re-read the detail whenever a job's signature changes
   // (mirrors SkillPage's jobsKey effect). Skipped while no job has ever run
-  // for this workspace, so a quiet page does not double-fetch on mount.
+  // for this workspace (so a quiet page does not double-fetch on mount) and
+  // while the JSON editor is open (a background reload would replace `data`
+  // out from under an in-progress edit).
   const jobsKey = store.jobs.map((j) => `${j.id}:${j.status}:${j.progress}`).join(',');
   useEffect(() => {
-    if (jobsKey) reload();
+    if (jobsKey && !editingJson) reload();
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [jobsKey]);
 
@@ -146,6 +164,43 @@ export default function ConfigPage({ id }: { id: string }) {
   const syncStatus = readString(data.sync, 'status');
   const description = typeof data.data.description === 'string' ? data.data.description : '';
 
+  const startEditJson = () => {
+    setJsonDraft(JSON.stringify(data.data, null, 2));
+    setPinnedRevision(data.revision);
+    setJsonError('');
+    setEditingJson(true);
+  };
+
+  // Also used as the JSON tab's "Cancel" button — discarding an edit in
+  // progress goes through the same confirm-if-dirty gate as navigating away.
+  const leaveJsonEditor = () => {
+    if (dirty && !window.confirm('Discard unsaved config edits?')) return false;
+    setJsonDraft(JSON.stringify(data.data, null, 2));
+    setJsonError('');
+    setEditingJson(false);
+    return true;
+  };
+
+  const changeTab = (next: string) => {
+    if (dirty && !leaveJsonEditor()) return;
+    setTab(next);
+  };
+
+  const saveJson = async () => {
+    let parsed: unknown;
+    try {
+     
```

**File**: `ui/src/sections/Library.tsx` (modified, +20/-1)
```diff
@@ -6,7 +6,8 @@ import { usePagination } from '@/hooks/use-pagination';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
-import { GitBranch, Plus, RefreshCw, FileJson, ArrowUpCircle, Trash2, CloudDownload, Search } from 'lucide-react';
+import { GenerateConfigForm } from '@/components/generate-config-form';
+import { GitBranch, Plus, RefreshCw, FileJson, ArrowUpCircle, Sparkles, Trash2, CloudDownload, Search } from 'lucide-react';
 import { cn } from '@/lib/utils';
 
 const ORIGIN_STYLE: Record<ConfigEntry['origin'], string> = {
@@ -38,6 +39,7 @@ export default function Library({
   const { pending } = useStore();
   const [activeSource, setActiveSource] = useState<string>('all');
   const [addOpen, setAddOpen] = useState(false);
+  const [generateOpen, setGenerateOpen] = useState(false);
   const [repo, setRepo] = useState('');
   const [query, setQuery] = useState('');
 
@@ -65,6 +67,9 @@ export default function Library({
               <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
               <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="filter configs…" className="pl-8 h-8 font-mono-hud text-xs bg-secondary/50" />
             </div>
+            <Button size="sm" variant="outline" onClick={() => setGenerateOpen(true)} className="font-mono-hud text-xs uppercase tracking-wider">
+              <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Generate with AI
+            </Button>
             <Button size="sm" onClick={() => setAddOpen(true)} className="font-mono-hud text-xs uppercase tracking-wider">
               <Plus className="mr-1.5 h-3.5 w-3.5" /> Add config source
             </Button>
@@ -200,6 +205,20 @@ export default function Library({
         <Pager page={pager.page} pageCount={pager.pageCount} pageSize={pager.pageSize} total={pager.total} onPage={pager.setPage} onPageSize={pager.setPageSize} />
       </Panel>
 
+      {/* generate with AI dialog */}
+      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
+        <DialogContent className="!fixed hud-panel border-border sm:max-w-md">
+          <DialogHeader>
+            <DialogTitle className="font-mono-hud text-sm uppercase tracking-[0.2em] text-primary">// Generate with AI</DialogTitle>
+            <DialogDescription className="text-xs text-muted-foreground">
+              Draft a new unified config from a docs URL, a framework name, or a local project directory. Runs as a background job and
+              lands in this library when it finishes.
+            </DialogDescription>
+          </DialogHeader>
+          <GenerateConfigForm onGenerated={() => setGenerateOpen(false)} />
+        </DialogContent>
+      </Dialog>
+
       {/* add source dialog */}
       <Dialog open={addOpen} onOpenChange={setAddOpen}>
         <DialogContent className="!fixed hud-panel border-border sm:max-w-md">
```

**File**: `ui/tests/pages.spec.ts` (modified, +35/-0)
```diff
@@ -116,6 +116,41 @@ test('config page validates, edits with revision, and toggles sync', async ({ pa
   await expect(page.getByText(/valid/i).first()).toBeVisible();
 });
 
+test('sync toggle updates the stats strip and survives a tab switch', async ({ page }) => {
+  let syncSettings: unknown = null;
+  await page.route('**/api/configs/cfg-1', route => route.fulfill({ json: { id: 'cfg-1', name: 'react.json', path: '/ws/configs/react.json', source: 'official', origin: 'preset', framework: 'react', version: '2.1', data: { name: 'react', sources: [] }, revision: 'c1', validation: { valid: true, errors: [], warnings: [] }, usedBy: [], sync: null, syncSettings, lastEstimate: null } }));
+  await page.route('**/api/configs/cfg-1/sync', route => { syncSettings = route.request().postDataJSON(); return route.fulfill({ json: { ok: true, syncSettings } }); });
+  await page.goto('/configs/cfg-1');
+  await page.getByRole('tab', { name: 'Sync' }).click();
+  await page.getByRole('switch', { name: 'Watch upstream docs for changes' }).click();
+  await expect(page.getByText(/watching/i).first()).toBeVisible();
+  await page.getByRole('tab', { name: 'JSON' }).click();
+  await page.getByRole('tab', { name: 'Sync' }).click();
+  await expect(page.getByRole('switch', { name: 'Watch upstream docs for changes' })).toBeChecked();
+});
+
+test('json edits ask before discarding on tab change', async ({ page }) => {
+  await page.goto('/configs/cfg-1');
+  await page.getByRole('tab', { name: 'JSON' }).click();
+  await page.getByRole('button', { name: 'Edit', exact: true }).click();
+  const editor = page.getByRole('textbox', { name: 'Config JSON' });
+  await editor.fill('{"name":"changed","sources":[]}');
+  page.once('dialog', d => d.dismiss());
+  await page.getByRole('tab', { name: 'Validate' }).click();
+  await expect(editor).toHaveValue('{"name":"changed","sources":[]}');
+});
+
+test('library generates a config with AI from a docs URL', async ({ page }) => {
+  let generated: unknown = null;
+  await page.route('**/api/configs/generate', route => { generated = route.request().postDataJSON(); return route.fulfill({ json: { ok: true, job: { id: 'g1' } } }); });
+  await page.goto('/configs');
+  await page.getByRole('button', { name: 'Generate with AI' }).click();
+  await page.getByRole('textbox', { name: 'Docs URL' }).fill('https://docs.example.com/start');
+  await page.getByRole('button', { name: 'Generate config' }).click();
+  await expect.poll(() => generated).toEqual({ kind: 'url', value: 'https://docs.example.com/start', probe_urls: true });
+  await expect(page.getByRole('dialog')).toHaveCount(0);
+});
+
 // The skill page packs eight tabs of tables, chip rows and card grids into the
 // same column the nav sections use; every one of them has to fit the narrow
 // viewports hud.spec.ts pins for the rest of the HUD.
```

---

### Incident Patch 13: `d778c1c3` (2026-09-13)
**Commit Message**: fix(hud): working vector exports, embedding select, history logs on the skill page

Review round 1 — three Important findings, all of them the page offering a
control the backend cannot honour:

- Weaviate now sends `weaviate_url`. The adaptor only reads `cluster_url` on
  its Weaviate Cloud branch (use_cloud AND an api key), so the URL typed into
  the panel was silently dropped on the local path. The field keeps its
  "cluster url" label; UPLOAD_OPTION_FLAGS already maps the key to
  --weaviate-url.
- FAISS and Qdrant radios are disabled (still labelled) and the panel says
  "not supported by upload yet — package to this format instead":
  get_upload_platforms() is derived from supports_upload(), which both answer
  no, so their jobs died in argparse. The Export button is disabled for any
  database that cannot upload.
- "embedding function" is a select over the argparse choices (none / openai /
  sentence-transformers, default none, omitted from options when none) instead
  of free text that failed the job with no hint.
- History rows gained the Jobs.tsx log affordance: <details> with a
  "Log (N lines)" summary over a <pre>, open by default for failed jobs.

Covering tests in p

**File**: `ui/src/sections/SkillPage.tsx` (modified, +45/-14)
```diff
@@ -71,13 +71,24 @@ const UPLOAD_CARDS: { target: string; label: string; env: string; fmt: string }[
 // One connection field per database. `key` is the option name the backend maps
 // to an upload_skill flag (web/runner.py:UPLOAD_OPTION_FLAGS); `field` is the
 // human name, and doubles as the input's accessible name.
-const VECTOR_DBS: { id: string; label: string; field: string; key: string; placeholder: string }[] = [
-  { id: 'chroma', label: 'ChromaDB', field: 'persist directory', key: 'persist_directory', placeholder: './chroma_db' },
-  { id: 'faiss', label: 'FAISS', field: 'index path', key: 'persist_directory', placeholder: './skill.faiss' },
-  { id: 'qdrant', label: 'Qdrant', field: 'server url', key: 'cluster_url', placeholder: 'http://localhost:6333' },
-  { id: 'weaviate', label: 'Weaviate', field: 'cluster url', key: 'cluster_url', placeholder: 'http://localhost:8080' },
+//
+// `upload` is whether `upload_skill` can actually reach the store:
+// get_upload_platforms() is derived from each adaptor's supports_upload(), and
+// FAISS/Qdrant answer no — a job for them dies in argparse. Weaviate takes
+// `weaviate_url`, not `cluster_url`: the adaptor only reads cluster_url on the
+// Weaviate Cloud branch (use_cloud AND an api key), so a plain URL sent under
+// that name is silently dropped.
+const VECTOR_DBS: { id: string; label: string; field: string; key: string; placeholder: string; upload: boolean }[] = [
+  { id: 'chroma', label: 'ChromaDB', field: 'persist directory', key: 'persist_directory', placeholder: './chroma_db', upload: true },
+  { id: 'faiss', label: 'FAISS', field: 'index path', key: 'persist_directory', placeholder: './skill.faiss', upload: false },
+  { id: 'qdrant', label: 'Qdrant', field: 'server url', key: 'cluster_url', placeholder: 'http://localhost:6333', upload: false },
+  { id: 'weaviate', label: 'Weaviate', field: 'cluster url', key: 'weaviate_url', placeholder: 'http://localhost:8080', upload: true },
 ];
 
+// argparse `choices` on --embedding-function (cli/arguments/upload.py); any
+// other value fails the job, so the UI offers exactly these.
+const EMBEDDING_FUNCTIONS = ['none', 'openai', 'sentence-transformers'];
+
 const TRANSLATE_LANGS: [string, string][] = [
   ['tr', 'Türkçe'], ['de', 'Deutsch'], ['ja', '日本語'],
   ['es', 'Español'], ['fr', 'Français'], ['zh', '中文'],
@@ -1001,7 +1012,7 @@ function ExportTab({ id, onNavigate }: { id: string; onNavigate: (to: string) =>
   const [targets, setTargets] = useState<string[]>(['claude']);
   const [db, setDb] = useState('chroma');
   const [conn, setConn] = useState<Record<string, string>>({});
-  const [embedding, setEmbedding] = useState('');
+  const [embedding, setEmbedding] = useState('none');
   const available = store.settings?.capabilities.targets ?? [];
   const keys = store.settings?.keys ?? [];
   const active = VECTOR_DBS.find((d) => d.id === db) ?? VECTOR_DBS[0];
@@ -1015,7 +1026,7 @@ function ExportTab({ id, onNavigate }: { id: string; onNavigate: (to: string) =>
 
   const exportToDb = () => {
     const options: Record<string, string> = { [active.key]: connValue.trim() };
-    if (embedding.trim()) options.embedding_function = embedding.trim();
+    if (embedding !== 'none') options.embedding_function = embedding;
     return store.uploadSkill(id, active.id, options);
   };
 
@@ -1097,15 +1108,22 @@ function ExportTab({ id, onNavigate }: { id: string; onNavigate: (to: string) =>
             <label
               key={entry.id}
               className={cn(
-                'flex cursor-pointer items-center gap-2.5 rounded border px-3 py-2.5 transition-colors',
+                'flex items-center gap-2.5 rounded border px-3 py-2.5 transition-colors',
+                entry.upload ? 'cursor-pointer' : 'cursor-not-allowed opacity-50',
                 db === entry.id ? 'border-primary/60 bg-primary/10' : 'border-border bg-secondary/30',
               )}
             >
-              <RadioGroupItem value={entry.id} aria-label={entry.label} />
+              <RadioGroupItem value={entry.id} aria-label={entry.label} disabled={!entry.upload} />
               <span className="font-mono-hud text-[12px]">{entry.label}</span>
             </label>
           ))}
         </RadioGroup>
+        {VECTOR_DBS.some((entry) => !entry.upload) && (
+          <p className="mt-2 text-xs text-muted-foreground">
+            {VECTOR_DBS.filter((entry) => !entry.upload).map((entry) => entry.label).join(' and ')}: not supported by
+            upload yet — package to this format instead.
+          </p>
+        )}
         <div className="mt-3 grid gap-3 sm:grid-cols-2">
           <div className="space-y-1">
             <div className="font-mono-hud text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{active.field}</div>
@@ -1119,19 +1137,22 @@ function ExportTab({ id, onNavigate }: { id: string; onNavigate: (to: string) =>
           </div>
           <div className="space-y-1">
             <div clas
```

**File**: `ui/tests/pages.spec.ts` (modified, +24/-0)
```diff
@@ -75,6 +75,30 @@ test('editor loads full content and preserves a conflicted draft', async ({ page
   await expect(editor).toHaveValue('My unsaved edit');
 });
 
+test('vector export only offers the databases upload can reach', async ({ page }) => {
+  let uploaded: unknown = null;
+  await page.route('**/api/skills/sk-1/upload', route => { uploaded = route.request().postDataJSON(); return route.fulfill({ json: { ok: true, job: { id: 'u' } } }); });
+  await page.goto('/skills/sk-1');
+  await page.getByRole('tab', { name: 'Export' }).click();
+  // FAISS and Qdrant have no uploading adaptor — offering them queues a job that
+  // dies in argparse.
+  await expect(page.getByRole('radio', { name: 'FAISS' })).toBeDisabled();
+  await expect(page.getByRole('radio', { name: 'Qdrant' })).toBeDisabled();
+  await page.getByRole('radio', { name: 'Weaviate' }).check();
+  await page.getByRole('textbox', { name: 'cluster url' }).fill('http://localhost:8080');
+  await page.getByRole('button', { name: /Export to Weaviate/ }).click();
+  // weaviate_url, not cluster_url: the adaptor only reads cluster_url on its
+  // Weaviate Cloud branch.
+  await expect.poll(() => uploaded).toEqual({ target: 'weaviate', options: { weaviate_url: 'http://localhost:8080' } });
+});
+
+test('skill history opens the worker log of a failed job', async ({ page }) => {
+  await page.route('**/api/skills/sk-1/history', route => route.fulfill({ json: [{ id: 'job-9', type: 'enhance', label: 'react-docs', detail: 'level 2 · claude', progress: 40, status: 'failed', startedAt: '2026-09-13 09:02:40', log: ['line one', '\u2717 failed'], error: 'agent exited 1', artifacts: [] }] }));
+  await page.goto('/skills/sk-1');
+  await page.getByRole('tab', { name: 'History' }).click();
+  await expect(page.getByText('line one')).toBeVisible();
+});
+
 // The skill page packs eight tabs of tables, chip rows and card grids into the
 // same column the nav sections use; every one of them has to fit the narrow
 // viewports hud.spec.ts pins for the rest of the HUD.
```

---

### Incident Patch 14: `9958debe` (2026-09-13)
**Commit Message**: fix(hud): resolve agent dirs under the workspace root; normalise doctor levels

- agents(): pass project_root=ctx.root to get_agent_path() so the 8
  project-relative agent ids (cursor, vscode, copilot, roo, cline, bolt,
  kilo, bob) resolve under the HUD's workspace root instead of falling
  back to the server process's cwd.
- _doctor(): map CheckResult.status ("pass"/"warn"/"fail") to the
  frontend's level contract ("ok"/"warning"/"error") instead of passing
  the raw status through, so the doctor pill can actually turn red.

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01CjVnprDdTWsh8N6fqc37pP

**File**: `src/skill_seekers/web/routes/environment.py` (modified, +5/-2)
```diff
@@ -29,14 +29,17 @@ class InstallAgentRequest(BaseModel):
     force: bool = False
 
 
+DOCTOR_LEVELS = {"pass": "ok", "warn": "warning", "fail": "error"}
+
+
 def _doctor() -> dict[str, Any]:
     from skill_seekers.cli.doctor import run_all_checks
 
     checks = [
         {
             "name": result.name,
             "ok": result.status == "pass",
-            "level": result.status,
+            "level": DOCTOR_LEVELS.get(result.status, "error"),
             "found": result.detail,
             "hint": result.verbose_detail,
             "fix": "",
@@ -109,7 +112,7 @@ def agents() -> list[dict[str, Any]]:
         rows = []
         for agent in get_available_agents():
             cli = clis.get(agent, {})
-            agent_dir = get_agent_path(agent)
+            agent_dir = get_agent_path(agent, project_root=ctx.root)
             rows.append(
                 {
                     "id": agent,
```

**File**: `tests/test_web_environment.py` (modified, +6/-1)
```diff
@@ -6,18 +6,23 @@
 
 
 def test_environment_snapshot_shape(workspace):
-    _, client = workspace
+    root, client = workspace
     env = client.get("/api/environment").json()
     assert {c["name"] for c in env["doctor"]["checks"]} >= {"Python version", "Git"} or len(
         env["doctor"]["checks"]
     ) >= 5
+    assert all(c["level"] in ("ok", "warning", "error") for c in env["doctor"]["checks"])
     assert {s["id"] for s in env["servers"]} == {"mcp-stdio", "mcp-http", "embedding"}
     assert all(
         s["state"] in ("installed", "missing", "running", "stopped", "live", "down")
         for s in env["servers"]
     )
     claude = next(a for a in env["agents"] if a["id"] == "claude")
     assert claude["detected"] is True and claude["skillInstalled"] is False
+    # cursor's install path (".cursor/skills/") is project-relative — it must
+    # resolve under the HUD's workspace root, not the server process's cwd.
+    cursor = next(a for a in env["agents"] if a["id"] == "cursor")
+    assert cursor["agentDir"].startswith(str(root))
 
 
 def test_server_start_stop_and_agent_install_jobs(workspace, monkeypatch):
```

---

### Incident Patch 15: `ed2bb036` (2026-09-13)
**Commit Message**: fix(hud): 404 unmatched API paths for all methods without widening the SPA route

Reverts the SPA catch-all to @app.get("/{full_path:path}") exactly as
it was. Instead, a narrow @app.api_route("/api/{full_path:path}", ...)
registered immediately before it (only when a dist exists) 404s an
unmatched "/api/*" path for every method, without changing 405
semantics for non-API paths — the prior fix widened the SPA route's
methods, which silently turned every non-GET request to any unmatched
non-API path into a 200 (index.html) instead of 405.

Adds a regression test next to test_dist_symlink_cannot_serve_external_file
covering DELETE/POST on an unknown API path (404), a GET SPA route
(still serves index.html), and POST on a non-API route (still 405).

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01CjVnprDdTWsh8N6fqc37pP

**File**: `src/skill_seekers/web/app.py` (modified, +13/-8)
```diff
@@ -1424,14 +1424,19 @@ def reprobe() -> dict[str, Any]:
         if (DIST_DIR / "assets").is_dir():
             app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")
 
-        # Registered for every method (not just GET): an unmatched path under
-        # "api/" must 404 regardless of HTTP verb — leaving this GET-only let a
-        # non-GET request to an unknown API path (e.g. after ".." normalization
-        # collapses a path-traversal attempt) fall through to a misleading 405
-        # Method Not Allowed instead of the 404 the handler below returns.
-        @app.api_route(
-            "/{full_path:path}", methods=["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"]
-        )
+        # An unmatched path under "api/" must 404 regardless of HTTP verb.
+        # Without this, a non-GET request to an unknown API path (e.g. after
+        # ".." normalization collapses a path-traversal attempt) would match
+        # the GET-only SPA route below by path template and get Starlette's
+        # generic 405 Method Not Allowed instead of a proper 404 — but only
+        # when a dist exists, so scope this narrowly to "/api/*" rather than
+        # widening the SPA route's methods (which would also change non-GET
+        # semantics for legitimate frontend routes).
+        @app.api_route("/api/{full_path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
+        def api_not_found(full_path: str) -> None:  # noqa: ARG001 — required by FastAPI's path template
+            raise HTTPException(404, "Not found")
+
+        @app.get("/{full_path:path}")
         def spa(full_path: str) -> FileResponse:
             candidate = (DIST_DIR / full_path).resolve()
             if not candidate.is_relative_to(DIST_DIR.resolve()) or full_path.startswith("api/"):
```

**File**: `tests/test_web_regressions.py` (modified, +20/-0)
```diff
@@ -112,6 +112,26 @@ def test_dist_symlink_cannot_serve_external_file(workspace, monkeypatch):
     assert client.get("/api/unknown").status_code == 404
 
 
+def test_unmatched_api_path_404s_for_every_method_when_dist_exists(workspace, monkeypatch):
+    """A dist build makes the SPA route match any path — non-API routes must
+    keep their normal 405 for a disallowed method, but an unmatched path
+    under "api/" must 404 regardless of HTTP verb (see app.py's narrow
+    "/api/{full_path:path}" catch-all, registered only when a dist exists)."""
+    import skill_seekers.web.app as app_module
+    from fastapi.testclient import TestClient
+
+    root, _ = workspace
+    dist = root / "dist"
+    dist.mkdir()
+    (dist / "index.html").write_text("SPA")
+    monkeypatch.setattr(app_module, "DIST_DIR", dist)
+    client = TestClient(app_module.create_app(root), base_url="http://127.0.0.1")
+    assert client.delete("/api/nope").status_code == 404
+    assert client.post("/api/nope", json={}).status_code == 404
+    assert client.get("/skills").text == "SPA"
+    assert client.post("/some-route").status_code == 405
+
+
 def test_identical_names_across_clis_have_distinct_ids(workspace):
     root, client = workspace
     _mk_skill(Path.home() / ".claude/skills/demo")
```

#### Recent Merged Pull Requests:
- **PR #473** (2026-09-20): fix(enhance): honour the configured default enhance level; correct enhance docs (@yusufkaraaslan)
- **PR #472** (2026-09-20): feat(sponsors): add Fluxion AI as Bronze sponsor (@yusufkaraaslan)
- **PR #471** (2026-09-16): test(benchmark): make compare test deterministic (@yusufkaraaslan)
- **PR #470** (2026-09-16): chore(sponsors): remove lapsed RapidProxy and Atlas Cloud placements (@yusufkaraaslan)
- **PR #468** (2026-09-20): feat: support MiniMax video input and thinking modes (@octo-patch)
- **PR #465** (closed): fix(enhance): accept --enhance-level on skill-seekers-enhance (@christianare)
- **PR #464** (2026-09-20): fix(security): validate Git config cache names (@emecii)
- **PR #463** (2026-09-20): feat(index): add opt-in SQLite skill search (@emecii)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
