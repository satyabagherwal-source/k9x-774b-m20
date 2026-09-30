# Forensic Learning Record (Deep Inspection): MaxMiksa/Auto-Company

> **Canonical Artifact**: `07_PROJECT_LEARNING/maxmiksa-auto-company-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/MaxMiksa/Auto-Company](https://github.com/MaxMiksa/Auto-Company))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:14:36.035Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `MaxMiksa/Auto-Company`
- **Description**: An auto-company works for 24/7 on your own PC - Windows/Linux/macOS.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3112 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.claude/skills/code-review-security/scripts/security-scan.py`
```
#!/usr/bin/env python3
"""
security-scan.py — AST-based security scanner for common Python vulnerability patterns.

Scans Python source files for:
  - eval() / exec() / compile() calls
  - subprocess with shell=True
  - pickle.loads() on potentially untrusted data
  - Raw SQL string construction (f-strings with SELECT/INSERT/UPDATE/DELETE)
  - yaml.load() without SafeLoader
  - Hardcoded secret patterns (API keys, passwords in source)
  - Weak hash functions (MD5, SHA1 for passwords)
  - os.system() calls

Usage:
  python security-scan.py --path ./app --output-dir ./security-results
  python security-scan.py --path ./app --output-dir ./results --severity high

Options:
  --path         Directory or file to scan (required)
  --output-dir   Directory to write JSON results (default: ./security-results)
  --severity     Minimum severity to report: critical, high, medium, low (default: low)
"""

import argparse
import ast
import json
import os
import re
import sys
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


# ─── Data Structures ─────────────────────────────────────────────────────────────

SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}


@dataclass
class Finding:
    """A single security finding."""
    rule_id: str
    severity: str
    category: str
    message: str
    file: str
    line: int
    col: int
    snippet: str
    cwe: Optional[str] = None


# ─── AST-Based Rules ─────────────────────────────────────────────────────────────

class SecurityVisitor(ast.NodeVisitor):
    """AST visitor that checks for common security anti-patterns."""

    def __init__(self, filepath: str, source_lines: list[str]):
        self.filepath = filepath
        self.source_lines = source_lines
        self.findings: list[Finding] = []

    def _get_snippet(self, lineno: int) -> str:
        """Get the source line for a finding."""
        if 1 <= lineno <= len(self.source_lines):
            return self.source_lines[lineno - 1].strip()
        return ""

    def _add_finding(
        self,
        rule_id: str,
        severity: str,
        category: str,
        message: str,
        node: ast.AST,
        cwe: Optional[str] = None,
    ):
        self.findings.append(Finding(
            rule_id=rule_id,
            severity=severity,
            category=category,
            message=message,
            file=self.filepath,
            line=getattr(node, "lineno", 0),
            col=getattr(node, "col_offset", 0),
            snippet=self._get_snippet(getattr(node, "lineno", 0)),
            cwe=cwe,
        ))

    def visit_Call(self, node: ast.Call):
        """Check function calls for dangerous patterns."""
        func_name = self._get_func_name(node)

        # Rule: eval / exec / compile
        if func_name in ("eval", "exec", "compile"):
            self._add_finding(
                rule_id="SEC001",
                severity="critical",
                category="OWASP A03: Injection",
                message=f"Use of {func_name}() can lead to code execution. "
                        f"Remove or use ast.literal_eval() for safe parsing.",
                node=node,
                cwe="CWE-95",
            )

        # Rule: pickle.loads / pickle.load
        if func_name in ("pickle.loads", "pickle.load"):
            self._add_finding(
                rule_id="SEC002",
                severity="critical",
                category="OWASP A08: Software and Data Integrity",
                message="pickle.loads() can execute arbitrary code on untrusted data. "
                        "Use JSON or msgpack for deserialization.",
                node=node,
                cwe="CWE-502",
            )

        # Rule: os.system
        if func_name == "os.system":
            self._add_finding(
                rule_id="SEC003",
                severity="high",
                category="OWASP A03: Injection",
                message="os.system() is vulnerable to command injection. "
                        "Use subprocess.run([...], shell=False) instead.",
                node=node,
                cwe="CWE-78",
            )

        # Rule: subprocess with shell=True
        if func_name in ("subprocess.run", "subprocess.call", "subprocess.Popen",
                         "subprocess.check_output", "subprocess.check_call"):
            for kw in node.keywords:
                if kw.arg == "shell" and isinstance(kw.value, ast.Constant) and kw.value.value is True:
                    self._add_finding(
                        rule_id="SEC004",
                        severity="high",
                        category="OWASP A03: Injection",
                        message=f"{func_name}() with shell=True is vulnerable to "
                                f"command injection. Use shell=False and pass args as a list.",
                        node=node,
                        cwe="CWE-78",
                    )

        # Rule: yaml.load without SafeLoader
        if func_name == "yaml.load":
            has_safe_loader = False
            for kw in node.keywords:
                if kw.arg == "Loader":
                    if isinstance(kw.value, ast.Attribute) and "Safe" in kw.value.attr:
                        has_safe_loader = True
                    elif isinstance(kw.value, ast.Name) and "Safe" in kw.value.id:
                        has_safe_loader = True
            if not has_safe_loader:
                self._add_finding(
                    rule_id="SEC005",
                    severity="high",
                    category="OWASP A08: Software and Data Integrity",
                    message="yaml.load() without SafeLoader can execute arbitrary code. "
                            "Use yaml.safe_load() or yaml.load(data, Loader=yaml.SafeLoader).",
                    node=node,
                    cwe="CWE-502",
                )

        # Rule: hashlib.md5 / hashlib.sha1 (potential password hashing)
        if func_name in ("hashlib.md5", "hashlib.sha1"):
            self._add_finding(
                rule_id="SEC006",
                severity="medium",
                category="OWASP A02: Cryptographic Failures",
                message=f"{func_name}() is a weak hash function. "
                        f"If used for passwords, switch to bcrypt via passlib.",
                node=node,
                cwe="CWE-328",
            )

        self.generic_visit(node)

    def visit_JoinedStr(self, node: ast.JoinedStr):
        """Check f-strings for potential SQL injection."""
        # Reconstruct the f-string content to check for SQL keywords
        string_parts = []
        for value in node.values:
            if isinstance(value, ast.Constant):
                string_parts.append(str(value.value))

        full_text = " ".join(string_parts).upper()
        sql_keywords = ["SELECT ", "INSERT ", "UPDATE ", "DELETE ", "DROP ", "ALTER "]

        if any(kw in full_text for kw in sql_keywords):
            self._add_finding(
                rule_id="SEC007",
                severity="critical",
                category="OWASP A03: Injection",
                message="SQL query constructed with f-string interpolation. "
                        "This is vulnerable to SQL injection. Use parameterized queries.",
                node=node,
                cwe="CWE-89",
            )

        self.generic_visit(node)

    def _get_func_name(self, node: ast.Call) -> str:
        """Extract the function name from a Call node."""
        if isinstance(node.func, ast.Name):
            return node.func.id
        elif isinstance(node.func, ast.Attribute):
            parts = []
            current = node.func
            while isinstance(current, ast.Attribute):
                parts.append(current.attr)
                current = current.value
            if isinstance(current, ast.Name):
                parts.append(current.id)
        
```

### Core Architecture Module: `.claude/skills/deep-research/scripts/citation_manager.py`
```
#!/usr/bin/env python3
"""
Citation Management System
Tracks sources, generates citations, and maintains bibliography
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional
from datetime import datetime
from urllib.parse import urlparse
import hashlib


@dataclass
class Citation:
    """Represents a single citation"""
    id: str
    title: str
    url: str
    authors: Optional[List[str]] = None
    publication_date: Optional[str] = None
    retrieved_date: str = field(default_factory=lambda: datetime.now().strftime('%Y-%m-%d'))
    source_type: str = "web"  # web, academic, documentation, book, paper
    doi: Optional[str] = None
    citation_count: int = 0

    def to_apa(self, index: int) -> str:
        """Generate APA format citation"""
        author_str = ""
        if self.authors:
            if len(self.authors) == 1:
                author_str = f"{self.authors[0]}."
            elif len(self.authors) == 2:
                author_str = f"{self.authors[0]} & {self.authors[1]}."
            else:
                author_str = f"{self.authors[0]} et al."

        date_str = f"({self.publication_date})" if self.publication_date else "(n.d.)"

        return f"[{index}] {author_str} {date_str}. {self.title}. Retrieved {self.retrieved_date}, from {self.url}"

    def to_inline(self, index: int) -> str:
        """Generate inline citation [index]"""
        return f"[{index}]"

    def to_markdown(self, index: int) -> str:
        """Generate markdown link format"""
        return f"[{index}] [{self.title}]({self.url}) (Retrieved: {self.retrieved_date})"


class CitationManager:
    """Manages citations and bibliography"""

    def __init__(self):
        self.citations: Dict[str, Citation] = {}
        self.citation_order: List[str] = []

    def add_source(
        self,
        url: str,
        title: str,
        authors: Optional[List[str]] = None,
        publication_date: Optional[str] = None,
        source_type: str = "web",
        doi: Optional[str] = None
    ) -> str:
        """Add a source and return its citation ID"""
        # Generate unique ID based on URL
        citation_id = hashlib.md5(url.encode()).hexdigest()[:8]

        if citation_id not in self.citations:
            citation = Citation(
                id=citation_id,
                title=title,
                url=url,
                authors=authors,
                publication_date=publication_date,
                source_type=source_type,
                doi=doi
            )
            self.citations[citation_id] = citation
            self.citation_order.append(citation_id)

        # Increment citation count
        self.citations[citation_id].citation_count += 1

        return citation_id

    def get_citation_number(self, citation_id: str) -> Optional[int]:
        """Get the citation number for a given ID"""
        try:
            return self.citation_order.index(citation_id) + 1
        except ValueError:
            return None

    def get_inline_citation(self, citation_id: str) -> str:
        """Get inline citation marker [n]"""
        num = self.get_citation_number(citation_id)
        return f"[{num}]" if num else "[?]"

    def generate_bibliography(self, style: str = "markdown") -> str:
        """Generate full bibliography"""
        if style == "markdown":
            lines = ["## Bibliography\n"]
            for i, citation_id in enumerate(self.citation_order, 1):
                citation = self.citations[citation_id]
                lines.append(citation.to_markdown(i))
            return "\n".join(lines)

        elif style == "apa":
            lines = ["## Bibliography\n"]
            for i, citation_id in enumerate(self.citation_order, 1):
                citation = self.citations[citation_id]
                lines.append(citation.to_apa(i))
            return "\n".join(lines)

        return "Unsupported citation style"

    def get_statistics(self) -> Dict[str, any]:
        """Get citation statistics"""
        return {
            'total_sources': len(self.citations),
            'total_citations': sum(c.citation_count for c in self.citations.values()),
            'source_types': self._count_by_type(),
            'most_cited': self._get_most_cited(5),
            'uncited': self._get_uncited()
        }

    def _count_by_type(self) -> Dict[str, int]:
        """Count sources by type"""
        counts = {}
        for citation in self.citations.values():
            counts[citation.source_type] = counts.get(citation.source_type, 0) + 1
        return counts

    def _get_most_cited(self, n: int = 5) -> List[tuple]:
        """Get most cited sources"""
        sorted_citations = sorted(
            self.citations.items(),
            key=lambda x: x[1].citation_count,
            reverse=True
        )
        return [(self.get_citation_number(cid), c.title, c.citation_count)
                for cid, c in sorted_citations[:n]]

    def _get_uncited(self) -> List[str]:
        """Get sources that were added but never cited"""
        return [c.title for c in self.citations.values() if c.citation_count == 0]

    def export_to_file(self, filepath: str, style: str = "markdown"):
        """Export bibliography to file"""
        with open(filepath, 'w') as f:
            f.write(self.generate_bibliography(style))


# Example usage
if __name__ == '__main__':
    manager = CitationManager()

    # Add sources
    id1 = manager.add_source(
        url="https://example.com/article1",
        title="Understanding Deep Research",
        authors=["Smith, J.", "Johnson, K."],
        publication_date="2025"
    )

    id2 = manager.add_source(
        url="https://example.com/article2",
        title="AI Research Methods",
        source_type="academic"
    )

    # Use citations
    print(f"Inline citation: {manager.get_inline_citation(id1)}")
    print(f"\nBibliography:\n{manager.generate_bibliography()}")
    print(f"\nStatistics:\n{manager.get_statistics()}")

```

### Core Architecture Module: `.claude/skills/deep-research/scripts/md_to_html.py`
```
#!/usr/bin/env python3
"""
Markdown to HTML converter for research reports
Properly converts markdown sections to HTML while preserving structure and formatting
"""

import re
from typing import Tuple
from pathlib import Path


def convert_markdown_to_html(markdown_text: str) -> Tuple[str, str]:
    """
    Convert markdown to HTML in two parts: content and bibliography

    Args:
        markdown_text: Full markdown report text

    Returns:
        Tuple of (content_html, bibliography_html)
    """
    # Split content and bibliography
    parts = markdown_text.split('## Bibliography')
    content_md = parts[0]
    bibliography_md = parts[1] if len(parts) > 1 else ""

    # Convert content (everything except bibliography)
    content_html = _convert_content_section(content_md)

    # Convert bibliography separately
    bibliography_html = _convert_bibliography_section(bibliography_md)

    return content_html, bibliography_html


def _convert_content_section(markdown: str) -> str:
    """Convert main content sections to HTML"""
    html = markdown

    # Remove title and front matter (first ## heading is handled separately)
    lines = html.split('\n')
    processed_lines = []
    skip_until_first_section = True

    for line in lines:
        # Skip everything until we hit "## Executive Summary" or first major section
        if skip_until_first_section:
            if line.startswith('## ') and not line.startswith('### '):
                skip_until_first_section = False
                processed_lines.append(line)
            continue
        processed_lines.append(line)

    html = '\n'.join(processed_lines)

    # Convert headers
    # ## Section Title → <div class="section"><h2 class="section-title">Section Title</h2></div>
    html = re.sub(
        r'^## (.+)$',
        r'<div class="section"><h2 class="section-title">\1</h2>',
        html,
        flags=re.MULTILINE
    )

    # ### Subsection → <h3 class="subsection-title">Subsection</h3>
    html = re.sub(
        r'^### (.+)$',
        r'<h3 class="subsection-title">\1</h3>',
        html,
        flags=re.MULTILINE
    )

    # #### Subsubsection → <h4 class="subsubsection-title">Title</h4>
    html = re.sub(
        r'^#### (.+)$',
        r'<h4 class="subsubsection-title">\1</h4>',
        html,
        flags=re.MULTILINE
    )

    # Convert **bold** text
    html = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', html)

    # Convert *italic* text
    html = re.sub(r'\*(.+?)\*', r'<em>\1</em>', html)

    # Convert inline code `code`
    html = re.sub(r'`(.+?)`', r'<code>\1</code>', html)

    # Convert unordered lists
    html = _convert_lists(html)

    # Convert tables
    html = _convert_tables(html)

    # Convert paragraphs (wrap non-HTML lines in <p> tags)
    html = _convert_paragraphs(html)

    # Close all open sections
    html = _close_sections(html)

    # Wrap executive summary if present
    html = html.replace(
        '<h2 class="section-title">Executive Summary</h2>',
        '<div class="executive-summary"><h2 class="section-title">Executive Summary</h2>'
    )
    if '<div class="executive-summary">' in html:
        # Close executive summary at the next section
        html = html.replace(
            '</h2>\n<div class="section">',
            '</h2></div>\n<div class="section">',
            1
        )

    return html


def _convert_bibliography_section(markdown: str) -> str:
    """Convert bibliography section to HTML"""
    if not markdown.strip():
        return ""

    html = markdown

    # Convert each [N] citation to a proper bibliography entry
    # Look for patterns like [1] Title - URL
    html = re.sub(
        r'\[(\d+)\]\s*(.+?)\s*-\s*(https?://[^\s\)]+)',
        r'<div class="bib-entry"><span class="bib-number">[\1]</span> <a href="\3" target="_blank">\2</a></div>',
        html
    )

    # Convert any remaining **bold** sections
    html = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', html)

    # Wrap in bibliography content div
    html = f'<div class="bibliography-content">{html}</div>'

    return html


def _convert_lists(html: str) -> str:
    """Convert markdown lists to HTML lists"""
    lines = html.split('\n')
    result = []
    in_list = False
    list_level = 0

    for i, line in enumerate(lines):
        stripped = line.strip()

        # Check for unordered list item
        if stripped.startswith('- ') or stripped.startswith('* '):
            if not in_list:
                result.append('<ul>')
                in_list = True
                list_level = len(line) - len(line.lstrip())

            # Get the content after the marker
            content = stripped[2:]
            result.append(f'<li>{content}</li>')

        # Check for ordered list item
        elif re.match(r'^\d+\.\s', stripped):
            if not in_list:
                result.append('<ol>')
                in_list = True
                list_level = len(line) - len(line.lstrip())

            # Get the content after the number and period
            content = re.sub(r'^\d+\.\s', '', stripped)
            result.append(f'<li>{content}</li>')

        else:
            # Not a list item
            if in_list:
                # Check if we're still in the list (indented continuation)
                current_level = len(line) - len(line.lstrip())
                if current_level > list_level and stripped:
                    # Continuation of previous list item
                    if result[-1].endswith('</li>'):
                        result[-1] = result[-1][:-5] + ' ' + stripped + '</li>'
                    continue
                else:
                    # End of list
                    result.append('</ul>' if '<ul>' in '\n'.join(result[-10:]) else '</ol>')
                    in_list = False
                    list_level = 0

            result.append(line)

    # Close any remaining open list
    if in_list:
        result.append('</ul>' if '<ul>' in '\n'.join(result[-10:]) else '</ol>')

    return '\n'.join(result)


def _convert_tables(html: str) -> str:
    """Convert markdown tables to HTML tables"""
    lines = html.split('\n')
    result = []
    in_table = False

    for i, line in enumerate(lines):
        if '|' in line and line.strip().startswith('|'):
            if not in_table:
                result.append('<table>')
                in_table = True
                # This is the header row
                cells = [cell.strip() for cell in line.split('|')[1:-1]]
                result.append('<thead><tr>')
                for cell in cells:
                    result.append(f'<th>{cell}</th>')
                result.append('</tr></thead>')
                result.append('<tbody>')
            elif '---' in line:
                # Skip separator row
                continue
            else:
                # Data row
                cells = [cell.strip() for cell in line.split('|')[1:-1]]
                result.append('<tr>')
                for cell in cells:
                    result.append(f'<td>{cell}</td>')
                result.append('</tr>')
        else:
            if in_table:
                result.append('</tbody></table>')
                in_table = False
            result.append(line)

    if in_table:
        result.append('</tbody></table>')

    return '\n'.join(result)


def _convert_paragraphs(html: str) -> str:
    """Wrap non-HTML lines in paragraph tags"""
    lines = html.split('\n')
    result = []
    in_paragraph = False

    for line in lines:
        stripped = line.strip()

        # Skip empty lines
        if not stripped:
            if in_paragraph:
                result.append('</p>')
                in_paragraph = False
            result.append(line)
            continue

        # Skip lines that are already HTML tags
        if (stripped.startswith('<') and stripped.endswith('>')) or \
           stripped.startswith('</') or \
           '<h' in stripped or '<div' in stripped or '<ul
```

### Core Architecture Module: `.claude/skills/deep-research/scripts/research_engine.py`
```
#!/usr/bin/env python3
"""
Deep Research Engine for Claude Code
Orchestrates comprehensive research across multiple sources with verification and synthesis
"""

import argparse
import json
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from enum import Enum


class ResearchPhase(Enum):
    """Research pipeline phases"""
    SCOPE = "scope"
    PLAN = "plan"
    RETRIEVE = "retrieve"
    TRIANGULATE = "triangulate"
    SYNTHESIZE = "synthesize"
    CRITIQUE = "critique"
    REFINE = "refine"
    PACKAGE = "package"


class ResearchMode(Enum):
    """Research depth modes"""
    QUICK = "quick"  # 3 phases: scope, retrieve, package
    STANDARD = "standard"  # 6 phases: skip refine and critique
    DEEP = "deep"  # Full 8 phases
    ULTRADEEP = "ultradeep"  # 8 phases + extended iterations


@dataclass
class Source:
    """Represents a research source"""
    url: str
    title: str
    snippet: str
    retrieved_at: str
    credibility_score: float = 0.0
    source_type: str = "web"  # web, academic, documentation, code
    verification_status: str = "unverified"  # unverified, verified, conflicted

    def to_citation(self, index: int) -> str:
        """Generate citation string"""
        return f"[{index}] {self.title} - {self.url} (Retrieved: {self.retrieved_at})"


@dataclass
class ResearchState:
    """Maintains research state across phases"""
    query: str
    mode: ResearchMode
    phase: ResearchPhase
    scope: Dict[str, Any]
    plan: Dict[str, Any]
    sources: List[Source]
    findings: List[Dict[str, Any]]
    synthesis: Dict[str, Any]
    critique: Dict[str, Any]
    report: str
    metadata: Dict[str, Any]

    def save(self, filepath: Path):
        """Save research state to file with retry logic"""
        max_retries = 3
        for attempt in range(max_retries):
            try:
                with open(filepath, 'w') as f:
                    json.dump(self._serialize(), f, indent=2)
                return  # Success
            except (IOError, OSError) as e:
                if attempt == max_retries - 1:
                    # Final attempt failed
                    raise IOError(f"Failed to save state after {max_retries} attempts: {e}")
                # Wait with exponential backoff before retry
                wait_time = (attempt + 1) * 0.5  # 0.5s, 1s, 1.5s
                time.sleep(wait_time)

    def _serialize(self) -> dict:
        """Convert to serializable dict"""
        return {
            'query': self.query,
            'mode': self.mode.value,
            'phase': self.phase.value,
            'scope': self.scope,
            'plan': self.plan,
            'sources': [asdict(s) for s in self.sources],
            'findings': self.findings,
            'synthesis': self.synthesis,
            'critique': self.critique,
            'report': self.report,
            'metadata': self.metadata
        }

    @classmethod
    def load(cls, filepath: Path) -> 'ResearchState':
        """Load research state from file"""
        with open(filepath, 'r') as f:
            data = json.load(f)

        return cls(
            query=data['query'],
            mode=ResearchMode(data['mode']),
            phase=ResearchPhase(data['phase']),
            scope=data['scope'],
            plan=data['plan'],
            sources=[Source(**s) for s in data['sources']],
            findings=data['findings'],
            synthesis=data['synthesis'],
            critique=data['critique'],
            report=data['report'],
            metadata=data['metadata']
        )


class ResearchEngine:
    """Main research orchestration engine"""

    def __init__(self, mode: ResearchMode = ResearchMode.STANDARD):
        self.mode = mode
        self.state: Optional[ResearchState] = None
        self.output_dir = Path.home() / ".claude" / "research_output"
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def initialize_research(self, query: str) -> ResearchState:
        """Initialize new research session"""
        self.state = ResearchState(
            query=query,
            mode=self.mode,
            phase=ResearchPhase.SCOPE,
            scope={},
            plan={},
            sources=[],
            findings=[],
            synthesis={},
            critique={},
            report="",
            metadata={
                'started_at': datetime.now().isoformat(),
                'version': '1.0'
            }
        )
        return self.state

    def get_phase_instructions(self, phase: ResearchPhase) -> str:
        """Get instructions for current phase"""
        instructions = {
            ResearchPhase.SCOPE: """
# Phase 1: SCOPE

Your task: Define research boundaries and success criteria

## Execute:
1. Decompose the question into 3-5 core components
2. Identify 2-4 key stakeholder perspectives
3. Define what's IN scope and what's OUT of scope
4. List 3-5 success criteria for this research
5. Document 3-5 assumptions that need validation

## Output Format:
```json
{
  "core_components": ["component1", "component2", ...],
  "stakeholder_perspectives": ["perspective1", "perspective2", ...],
  "in_scope": ["item1", "item2", ...],
  "out_of_scope": ["item1", "item2", ...],
  "success_criteria": ["criteria1", "criteria2", ...],
  "assumptions": ["assumption1", "assumption2", ...]
}
```

Use extended reasoning to explore multiple framings before finalizing scope.
""",
            ResearchPhase.PLAN: """
# Phase 2: PLAN

Your task: Create intelligent research roadmap

## Execute:
1. Identify 5-10 primary sources to investigate
2. List 5-10 secondary/backup sources
3. Map knowledge dependencies (what must be understood first)
4. Create 10-15 search query variations
5. Plan triangulation approach (how to verify claims)
6. Define 3-5 quality gates

## Output Format:
```json
{
  "primary_sources": ["source_type1", "source_type2", ...],
  "secondary_sources": ["source_type1", "source_type2", ...],
  "knowledge_dependencies": {"concept1": ["prerequisite1", "prerequisite2"], ...},
  "search_queries": ["query1", "query2", ...],
  "triangulation_strategy": "description of verification approach",
  "quality_gates": ["gate1", "gate2", ...]
}
```

Use Graph-of-Thoughts: branch into 3-4 potential research paths, evaluate, then converge on optimal strategy.
""",
            ResearchPhase.RETRIEVE: """
# Phase 3: RETRIEVE

Your task: Systematically collect information from multiple sources

## Execute:
1. Use WebSearch with iterative query refinement (minimum 10 searches)
2. Use WebFetch to deep-dive into 5-10 most promising sources
3. Extract key passages with metadata
4. Track information gaps
5. Follow 2-3 promising tangents
6. Ensure source diversity (different domains, perspectives)

## Tools to Use:
- WebSearch: For current information and broad coverage
- WebFetch: For detailed extraction from specific URLs
- Grep/Read: For local documentation if relevant
- Task: Spawn 2-3 parallel retrieval agents for efficiency

## Output:
Store all sources with metadata. Each source should include:
- URL/location
- Title
- Key excerpts
- Relevance score
- Source type
- Retrieved timestamp

Aim for 15-30 distinct sources minimum.
""",
            ResearchPhase.TRIANGULATE: """
# Phase 4: TRIANGULATE

Your task: Validate information across multiple independent sources

## Execute:
1. List all major claims from retrieved information
2. For each claim, find 3+ independent confirmatory sources
3. Flag any contradictions or uncertainties
4. Assess source credibility (domain expertise, recency, bias)
5. Document consensus areas vs. debate areas
6. Mark verification status for each claim

## Quality Standards:
- Core claims MUST have 3+ independent sources
- Flag any single-source claims as "unverified"
- Note information recency
- Identify potential biases

## Output Format:
```json
{
  "verified_claims": [
    {
      "clai
```

### Core Architecture Module: `.claude/skills/deep-research/scripts/source_evaluator.py`
```
#!/usr/bin/env python3
"""
Source Credibility Evaluator
Assesses source quality, credibility, and potential biases
"""

from dataclasses import dataclass
from typing import List, Dict, Optional
from urllib.parse import urlparse
from datetime import datetime, timedelta
import re


@dataclass
class CredibilityScore:
    """Represents source credibility assessment"""
    overall_score: float  # 0-100
    domain_authority: float  # 0-100
    recency: float  # 0-100
    expertise: float  # 0-100
    bias_score: float  # 0-100 (higher = more neutral)
    factors: Dict[str, str]
    recommendation: str  # "high_trust", "moderate_trust", "low_trust", "verify"


class SourceEvaluator:
    """Evaluates source credibility and quality"""

    # Domain reputation tiers
    HIGH_AUTHORITY_DOMAINS = {
        # Academic & Research
        'arxiv.org', 'nature.com', 'science.org', 'cell.com', 'nejm.org',
        'thelancet.com', 'springer.com', 'sciencedirect.com', 'plos.org',
        'ieee.org', 'acm.org', 'pubmed.ncbi.nlm.nih.gov',

        # Government & International Organizations
        'nih.gov', 'cdc.gov', 'who.int', 'fda.gov', 'nasa.gov',
        'gov.uk', 'europa.eu', 'un.org',

        # Established Tech Documentation
        'docs.python.org', 'developer.mozilla.org', 'docs.microsoft.com',
        'cloud.google.com', 'aws.amazon.com', 'kubernetes.io',

        # Reputable News (Fact-check verified)
        'reuters.com', 'apnews.com', 'bbc.com', 'economist.com',
        'nature.com/news', 'scientificamerican.com'
    }

    MODERATE_AUTHORITY_DOMAINS = {
        # Tech News & Analysis
        'techcrunch.com', 'theverge.com', 'arstechnica.com', 'wired.com',
        'zdnet.com', 'cnet.com',

        # Industry Publications
        'forbes.com', 'bloomberg.com', 'wsj.com', 'ft.com',

        # Educational
        'wikipedia.org', 'britannica.com', 'khanacademy.org',

        # Tech Blogs (established)
        'medium.com', 'dev.to', 'stackoverflow.com', 'github.com'
    }

    LOW_AUTHORITY_INDICATORS = [
        'blogspot.com', 'wordpress.com', 'wix.com', 'substack.com'
    ]

    def __init__(self):
        pass

    def evaluate_source(
        self,
        url: str,
        title: str,
        content: Optional[str] = None,
        publication_date: Optional[str] = None,
        author: Optional[str] = None
    ) -> CredibilityScore:
        """Evaluate source credibility"""

        domain = self._extract_domain(url)

        # Calculate component scores
        domain_score = self._evaluate_domain_authority(domain)
        recency_score = self._evaluate_recency(publication_date)
        expertise_score = self._evaluate_expertise(domain, title, author)
        bias_score = self._evaluate_bias(domain, title, content)

        # Calculate overall score (weighted average)
        overall = (
            domain_score * 0.35 +
            recency_score * 0.20 +
            expertise_score * 0.25 +
            bias_score * 0.20
        )

        # Determine factors
        factors = self._identify_factors(
            domain, domain_score, recency_score, expertise_score, bias_score
        )

        # Generate recommendation
        recommendation = self._generate_recommendation(overall)

        return CredibilityScore(
            overall_score=round(overall, 2),
            domain_authority=round(domain_score, 2),
            recency=round(recency_score, 2),
            expertise=round(expertise_score, 2),
            bias_score=round(bias_score, 2),
            factors=factors,
            recommendation=recommendation
        )

    def _extract_domain(self, url: str) -> str:
        """Extract domain from URL"""
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        # Remove www prefix
        domain = domain.replace('www.', '')
        return domain

    def _evaluate_domain_authority(self, domain: str) -> float:
        """Evaluate domain authority (0-100)"""
        if domain in self.HIGH_AUTHORITY_DOMAINS:
            return 90.0
        elif domain in self.MODERATE_AUTHORITY_DOMAINS:
            return 70.0
        elif any(indicator in domain for indicator in self.LOW_AUTHORITY_INDICATORS):
            return 40.0
        else:
            # Unknown domain - moderate skepticism
            return 55.0

    def _evaluate_recency(self, publication_date: Optional[str]) -> float:
        """Evaluate information recency (0-100)"""
        if not publication_date:
            return 50.0  # Unknown date

        try:
            pub_date = datetime.fromisoformat(publication_date.replace('Z', '+00:00'))
            age = datetime.now() - pub_date

            # Recency scoring
            if age < timedelta(days=90):  # < 3 months
                return 100.0
            elif age < timedelta(days=365):  # < 1 year
                return 85.0
            elif age < timedelta(days=730):  # < 2 years
                return 70.0
            elif age < timedelta(days=1825):  # < 5 years
                return 50.0
            else:
                return 30.0

        except Exception:
            return 50.0

    def _evaluate_expertise(
        self,
        domain: str,
        title: str,
        author: Optional[str]
    ) -> float:
        """Evaluate source expertise (0-100)"""
        score = 50.0

        # Academic/research domains get high expertise
        if any(d in domain for d in ['arxiv', 'nature', 'science', 'ieee', 'acm']):
            score += 30

        # Government/official sources
        if '.gov' in domain or 'who.int' in domain:
            score += 25

        # Technical documentation
        if 'docs.' in domain or 'documentation' in title.lower():
            score += 20

        # Author credentials (if available)
        if author:
            if any(title in author.lower() for title in ['dr.', 'phd', 'professor']):
                score += 15

        return min(score, 100.0)

    def _evaluate_bias(
        self,
        domain: str,
        title: str,
        content: Optional[str]
    ) -> float:
        """Evaluate potential bias (0-100, higher = more neutral)"""
        score = 70.0  # Start neutral

        # Check for sensationalism in title
        sensational_indicators = [
            '!', 'shocking', 'unbelievable', 'you won\'t believe',
            'secret', 'they don\'t want you to know'
        ]
        title_lower = title.lower()
        if any(indicator in title_lower for indicator in sensational_indicators):
            score -= 20

        # Academic sources are typically less biased
        if any(d in domain for d in ['arxiv', 'nature', 'science', 'ieee']):
            score += 20

        # Check for balance in content (if available)
        if content:
            # Look for balanced language
            balanced_indicators = ['however', 'although', 'on the other hand', 'critics argue']
            if any(indicator in content.lower() for indicator in balanced_indicators):
                score += 10

        return min(max(score, 0), 100.0)

    def _identify_factors(
        self,
        domain: str,
        domain_score: float,
        recency_score: float,
        expertise_score: float,
        bias_score: float
    ) -> Dict[str, str]:
        """Identify key credibility factors"""
        factors = {}

        if domain_score >= 85:
            factors['domain'] = "High authority domain"
        elif domain_score <= 45:
            factors['domain'] = "Low authority domain - verify claims"

        if recency_score >= 85:
            factors['recency'] = "Recent information"
        elif recency_score <= 40:
            factors['recency'] = "Outdated information - verify currency"

        if expertise_score >= 80:
            factors['expertise'] = "Expert source"
        elif expertise_score <= 45:
            factors['expertise'] = "Limited expertise indicators"

        if bias_score >= 80:
            factors['bias'] = "Balanced perspective"
        elif bias_s
```

### Core Architecture Module: `.claude/skills/deep-research/scripts/validate_report.py`
```
#!/usr/bin/env python3
"""
Report Validation Script
Ensures research reports meet quality standards before delivery
"""

import argparse
import re
import sys
from pathlib import Path
from typing import List, Tuple, Dict


class ReportValidator:
    """Validates research report quality"""

    def __init__(self, report_path: Path):
        self.report_path = report_path
        self.content = self._read_report()
        self.errors: List[str] = []
        self.warnings: List[str] = []

    def _read_report(self) -> str:
        """Read report file"""
        try:
            with open(self.report_path, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception as e:
            print(f"❌ ERROR: Cannot read report: {e}")
            sys.exit(1)

    def validate(self) -> bool:
        """Run all validation checks"""
        print(f"\n{'='*60}")
        print(f"VALIDATING REPORT: {self.report_path.name}")
        print(f"{'='*60}\n")

        checks = [
            ("Executive Summary", self._check_executive_summary),
            ("Required Sections", self._check_required_sections),
            ("Citations", self._check_citations),
            ("Bibliography", self._check_bibliography),
            ("Placeholder Text", self._check_placeholders),
            ("Content Truncation", self._check_content_truncation),
            ("Word Count", self._check_word_count),
            ("Source Count", self._check_source_count),
            ("Broken Links", self._check_broken_references),
        ]

        for check_name, check_func in checks:
            print(f"⏳ Checking: {check_name}...", end=" ")
            passed = check_func()
            if passed:
                print("✅ PASS")
            else:
                print("❌ FAIL")

        self._print_summary()

        return len(self.errors) == 0

    def _check_executive_summary(self) -> bool:
        """Check executive summary exists and is under 250 words"""
        pattern = r'## Executive Summary(.*?)(?=##|\Z)'
        match = re.search(pattern, self.content, re.DOTALL | re.IGNORECASE)

        if not match:
            self.errors.append("Missing 'Executive Summary' section")
            return False

        summary = match.group(1).strip()
        word_count = len(summary.split())

        if word_count > 250:
            self.warnings.append(f"Executive summary too long: {word_count} words (should be ≤250)")

        if word_count < 50:
            self.warnings.append(f"Executive summary too short: {word_count} words (should be ≥50)")

        return True

    def _check_required_sections(self) -> bool:
        """Check all required sections are present"""
        required = [
            "Executive Summary",
            "Introduction",
            "Main Analysis",
            "Synthesis",
            "Limitations",
            "Recommendations",
            "Bibliography",
            "Methodology"
        ]

        # Recommended sections (warnings if missing, not errors)
        recommended = [
            "Counterevidence Register",
            "Claims-Evidence Table"
        ]

        missing = []
        for section in required:
            if not re.search(rf'##.*{section}', self.content, re.IGNORECASE):
                missing.append(section)

        if missing:
            self.errors.append(f"Missing sections: {', '.join(missing)}")
            return False

        # Check recommended sections (warnings only)
        missing_recommended = []
        for section in recommended:
            if not re.search(rf'##.*{section}', self.content, re.IGNORECASE):
                missing_recommended.append(section)

        if missing_recommended:
            self.warnings.append(f"Missing recommended sections (for academic rigor): {', '.join(missing_recommended)}")

        return True

    def _check_citations(self) -> bool:
        """Check citation format and presence"""
        # Find all citation references [1], [2], etc.
        citations = re.findall(r'\[(\d+)\]', self.content)

        if not citations:
            self.errors.append("No citations found in report")
            return False

        unique_citations = set(citations)

        if len(unique_citations) < 10:
            self.warnings.append(f"Only {len(unique_citations)} unique sources cited (recommended: ≥10)")

        # Check for consecutive citation numbers
        citation_nums = sorted([int(c) for c in unique_citations])
        if citation_nums:
            max_citation = max(citation_nums)
            expected = set(range(1, max_citation + 1))
            missing = expected - set(citation_nums)

            if missing:
                self.warnings.append(f"Non-consecutive citation numbers, missing: {sorted(missing)}")

        return True

    def _check_bibliography(self) -> bool:
        """Check bibliography exists, matches citations, and has no truncation placeholders"""
        pattern = r'## Bibliography(.*?)(?=##|\Z)'
        match = re.search(pattern, self.content, re.DOTALL | re.IGNORECASE)

        if not match:
            self.errors.append("Missing 'Bibliography' section")
            return False

        bib_section = match.group(1)

        # CRITICAL: Check for truncation placeholders (2025 CiteGuard enhancement)
        truncation_patterns = [
            (r'\[\d+-\d+\]', 'Citation range (e.g., [8-75])'),
            (r'Additional.*citations', 'Phrase "Additional citations"'),
            (r'would be included', 'Phrase "would be included"'),
            (r'\[\.\.\.continue', 'Pattern "[...continue"'),
            (r'\[Continue with', 'Pattern "[Continue with"'),
            (r'etc\.(?!\w)', 'Standalone "etc."'),
            (r'and so on', 'Phrase "and so on"'),
        ]

        for pattern_re, description in truncation_patterns:
            if re.search(pattern_re, bib_section, re.IGNORECASE):
                self.errors.append(f"⚠️ CRITICAL: Bibliography contains truncation placeholder: {description}")
                self.errors.append(f"   This makes the report UNUSABLE - complete bibliography required")
                return False

        # Count bibliography entries [1], [2], etc.
        bib_entries = re.findall(r'^\[(\d+)\]', bib_section, re.MULTILINE)

        if not bib_entries:
            self.errors.append("Bibliography has no entries")
            return False

        # Check citation number continuity (no gaps)
        bib_nums = sorted([int(n) for n in bib_entries])
        if bib_nums:
            expected = list(range(1, bib_nums[-1] + 1))
            actual = bib_nums
            missing = [n for n in expected if n not in actual]
            if missing:
                self.errors.append(f"Bibliography has gaps in numbering: missing {missing}")
                return False

        # Find citations in text
        text_citations = set(re.findall(r'\[(\d+)\]', self.content))
        bib_citations = set(bib_entries)

        # Check all citations have bibliography entries
        missing_in_bib = text_citations - bib_citations
        if missing_in_bib:
            self.errors.append(f"Citations missing from bibliography: {sorted(missing_in_bib)}")
            return False

        # Check for unused bibliography entries
        unused = bib_citations - text_citations
        if unused:
            self.warnings.append(f"Unused bibliography entries: {sorted(unused)}")

        return True

    def _check_placeholders(self) -> bool:
        """Check for placeholder text that shouldn't be in final report"""
        placeholders = [
            'TBD', 'TODO', 'FIXME', 'XXX',
            '[citation needed]', '[needs citation]',
            '[placeholder]', '[TODO]', '[TBD]'
        ]

        found_placeholders = []
        for placeholder in placeholders:
            if placeholder in self.content:
                found_placeholders.append(placeholder)

        if found_placeholders:
            self.errors.append(f"Found placeholder text: {', '.jo
```

### Core Architecture Module: `.claude/skills/deep-research/scripts/verify_citations.py`
```
#!/usr/bin/env python3
"""
Citation Verification Script (Enhanced with CiteGuard techniques)

Catches fabricated citations by checking:
1. DOI resolution (via doi.org)
2. Basic metadata matching (title similarity, year match)
3. URL accessibility verification
4. Hallucination pattern detection (generic titles, suspicious patterns)
5. Flags suspicious entries for manual review

Enhanced in 2025 with:
- Content alignment checking (when URL available)
- Multi-source verification (DOI + URL + metadata cross-check)
- Advanced hallucination detection patterns
- Better false positive reduction

Usage:
    python verify_citations.py --report [path]
    python verify_citations.py --report [path] --strict  # Fail on any unverified

Does NOT require API keys - uses free DOI resolver and heuristics.
"""

import sys
import argparse
import re
from pathlib import Path
from typing import List, Dict, Tuple
from urllib import request, error
from urllib.parse import quote
import json
import time

class CitationVerifier:
    """Verify citations in research report"""

    def __init__(self, report_path: Path, strict_mode: bool = False):
        self.report_path = report_path
        self.strict_mode = strict_mode
        self.content = self._read_report()
        self.suspicious = []
        self.verified = []
        self.errors = []

        # Hallucination detection patterns (2025 CiteGuard enhancement)
        self.suspicious_patterns = [
            # Generic academic-sounding but fake patterns
            (r'^(A |An |The )?(Study|Analysis|Review|Survey|Investigation) (of|on|into)',
             "Generic academic title pattern"),
            (r'^(Recent|Current|Modern|Contemporary) (Advances|Developments|Trends) in',
             "Generic 'advances' title pattern"),
            # Too perfect, templated titles
            (r'^[A-Z][a-z]+ [A-Z][a-z]+: A (Comprehensive|Complete|Systematic) (Review|Analysis|Guide)$',
             "Too perfect, templated structure"),
        ]

    def _read_report(self) -> str:
        """Read report file"""
        try:
            with open(self.report_path, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception as e:
            print(f"L ERROR: Cannot read report: {e}")
            sys.exit(1)

    def extract_bibliography(self) -> List[Dict]:
        """Extract bibliography entries from report"""
        pattern = r'## Bibliography(.*?)(?=##|\Z)'
        match = re.search(pattern, self.content, re.DOTALL | re.IGNORECASE)

        if not match:
            self.errors.append("No Bibliography section found")
            return []

        bib_section = match.group(1)

        # Parse entries: [N] Author (Year). "Title". Venue. URL
        entries = []
        lines = bib_section.strip().split('\n')

        current_entry = None
        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Check if starts with citation number [N]
            match_num = re.match(r'^\[(\d+)\]\s+(.+)$', line)
            if match_num:
                if current_entry:
                    entries.append(current_entry)

                num = match_num.group(1)
                rest = match_num.group(2)

                # Try to parse: Author (Year). "Title". Venue. URL
                year_match = re.search(r'\((\d{4})\)', rest)
                title_match = re.search(r'"([^"]+)"', rest)
                doi_match = re.search(r'doi\.org/(10\.\S+)', rest)
                url_match = re.search(r'https?://[^\s\)]+', rest)

                current_entry = {
                    'num': num,
                    'raw': rest,
                    'year': year_match.group(1) if year_match else None,
                    'title': title_match.group(1) if title_match else None,
                    'doi': doi_match.group(1) if doi_match else None,
                    'url': url_match.group(0) if url_match else None
                }
            elif current_entry:
                # Multi-line entry, append to raw
                current_entry['raw'] += ' ' + line

        if current_entry:
            entries.append(current_entry)

        return entries

    def verify_doi(self, doi: str) -> Tuple[bool, Dict]:
        """
        Verify DOI exists and get metadata.
        Returns (success, metadata_dict)
        """
        if not doi:
            return False, {}

        try:
            # Use content negotiation to get JSON metadata
            url = f"https://doi.org/{quote(doi)}"
            req = request.Request(url)
            req.add_header('Accept', 'application/vnd.citationstyles.csl+json')

            with request.urlopen(req, timeout=10) as response:
                data = json.loads(response.read().decode('utf-8'))

                return True, {
                    'title': data.get('title', ''),
                    'year': data.get('issued', {}).get('date-parts', [[None]])[0][0],
                    'authors': [
                        f"{a.get('family', '')} {a.get('given', '')}"
                        for a in data.get('author', [])
                    ],
                    'venue': data.get('container-title', '')
                }
        except error.HTTPError as e:
            if e.code == 404:
                return False, {'error': 'DOI not found (404)'}
            return False, {'error': f'HTTP {e.code}'}
        except Exception as e:
            return False, {'error': str(e)}

    def verify_url(self, url: str) -> Tuple[bool, str]:
        """
        Verify URL is accessible (2025 CiteGuard enhancement).
        Returns (accessible, status_message)
        """
        if not url:
            return False, "No URL"

        try:
            # HEAD request to check accessibility without downloading
            req = request.Request(url, method='HEAD')
            req.add_header('User-Agent', 'Mozilla/5.0 (Research Citation Verifier)')

            with request.urlopen(req, timeout=10) as response:
                if response.status == 200:
                    return True, "URL accessible"
                else:
                    return False, f"HTTP {response.status}"
        except error.HTTPError as e:
            return False, f"HTTP {e.code}"
        except error.URLError as e:
            return False, f"URL error: {e.reason}"
        except Exception as e:
            return False, f"Connection error: {str(e)[:50]}"

    def detect_hallucination_patterns(self, entry: Dict) -> List[str]:
        """
        Detect common LLM hallucination patterns in citations (2025 CiteGuard).
        Returns list of detected issues.
        """
        issues = []
        title = entry.get('title', '')

        if not title:
            return issues

        # Check against suspicious patterns
        for pattern, description in self.suspicious_patterns:
            if re.match(pattern, title, re.IGNORECASE):
                issues.append(f"Suspicious title pattern: {description}")

        # Check for overly generic titles
        generic_words = ['overview', 'introduction', 'guide', 'handbook', 'manual']
        if any(word in title.lower() for word in generic_words) and len(title.split()) < 5:
            issues.append("Very generic short title")

        # Check for placeholder-like titles
        if any(x in title.lower() for x in ['tbd', 'todo', 'placeholder', 'example']):
            issues.append("Placeholder text in title")

        # Check for inconsistent metadata
        if entry.get('year'):
            year = int(entry['year'])
            # Very recent without DOI or URL is suspicious
            if year >= 2024 and not entry.get('doi') and not entry.get('url'):
                issues.append("Recent year (2024+) with no verification method")
            # Future year is definitely wrong
            if year > 2025:
                issues.append(f"Future year: {year}")
            # Very old with modern phrasing is suspicious
            if ye
```

### Core Architecture Module: `.claude/skills/deep-research/scripts/verify_html.py`
```
#!/usr/bin/env python3
"""
HTML Report Verification Script
Validates that HTML reports are properly generated with all sections from MD
"""

import argparse
import re
from pathlib import Path
from typing import List, Tuple


class HTMLVerifier:
    """Verify HTML research reports"""

    def __init__(self, html_path: Path, md_path: Path):
        self.html_path = html_path
        self.md_path = md_path
        self.errors = []
        self.warnings = []

    def verify(self) -> bool:
        """
        Run all verification checks

        Returns:
            True if all checks pass, False otherwise
        """
        print(f"\n{'='*60}")
        print(f"HTML REPORT VERIFICATION")
        print(f"{'='*60}\n")

        print(f"HTML File: {self.html_path}")
        print(f"MD File: {self.md_path}\n")

        # Read files
        try:
            html_content = self.html_path.read_text()
            md_content = self.md_path.read_text()
        except Exception as e:
            self.errors.append(f"Failed to read files: {e}")
            return False

        # Run checks
        self._check_sections(html_content, md_content)
        self._check_no_placeholders(html_content)
        self._check_no_emojis(html_content)
        self._check_structure(html_content)
        self._check_citations(html_content, md_content)
        self._check_bibliography(html_content, md_content)

        # Report results
        self._print_results()

        return len(self.errors) == 0

    def _check_sections(self, html: str, md: str):
        """Verify all markdown sections are present in HTML"""
        # Extract section headings from markdown
        md_sections = re.findall(r'^## (.+)$', md, re.MULTILINE)

        # Extract sections from HTML
        html_sections = re.findall(r'<h2 class="section-title">(.+?)</h2>', html)

        # Check if we have placeholder sections like <div class="section">#</div>
        placeholder_sections = re.findall(r'<div class="section">#</div>', html)

        if placeholder_sections:
            self.errors.append(
                f"Found {len(placeholder_sections)} placeholder sections (empty '#' divs) - content not converted properly"
            )

        # Compare section counts
        if len(md_sections) > len(html_sections) + 1:  # +1 for bibliography which is separate
            self.errors.append(
                f"Section count mismatch: MD has {len(md_sections)} sections, HTML has only {len(html_sections)} + bibliography"
            )
            missing = set(md_sections) - set(html_sections)
            if missing:
                self.errors.append(f"Missing sections in HTML: {missing}")

        # Verify Executive Summary is present
        if "Executive Summary" in md and "Executive Summary" not in html:
            self.errors.append("Executive Summary missing from HTML")

    def _check_no_placeholders(self, html: str):
        """Check for common placeholders that shouldn't be in final report"""
        placeholders = [
            '{{TITLE}}', '{{DATE}}', '{{CONTENT}}', '{{BIBLIOGRAPHY}}',
            '{{METRICS_DASHBOARD}}', '{{SOURCE_COUNT}}', 'TODO', 'TBD',
            'PLACEHOLDER', 'FIXME'
        ]

        found = []
        for placeholder in placeholders:
            if placeholder in html:
                found.append(placeholder)

        if found:
            self.errors.append(f"Found unreplaced placeholders: {', '.join(found)}")

    def _check_no_emojis(self, html: str):
        """Verify no emojis are present in HTML"""
        # Common emoji patterns
        emoji_pattern = re.compile(
            "["
            "\U0001F600-\U0001F64F"  # emoticons
            "\U0001F300-\U0001F5FF"  # symbols & pictographs
            "\U0001F680-\U0001F6FF"  # transport & map symbols
            "\U0001F1E0-\U0001F1FF"  # flags
            "\U00002702-\U000027B0"
            "\U000024C2-\U0001F251"
            "]+",
            flags=re.UNICODE
        )

        emojis = emoji_pattern.findall(html)
        if emojis:
            unique_emojis = set(emojis)
            self.errors.append(f"Found {len(emojis)} emojis in HTML (should be none): {unique_emojis}")

    def _check_structure(self, html: str):
        """Verify HTML has proper structure"""
        required_elements = [
            ('<html', 'HTML tag'),
            ('<head', 'head tag'),
            ('<body', 'body tag'),
            ('<title>', 'title tag'),
            ('class="header"', 'header section'),
            ('class="content"', 'content section'),
            ('class="bibliography"', 'bibliography section'),
        ]

        for element, name in required_elements:
            if element not in html:
                self.errors.append(f"Missing {name} in HTML")

        # Check for unclosed tags (basic check)
        open_divs = html.count('<div')
        close_divs = html.count('</div>')

        if abs(open_divs - close_divs) > 2:  # Allow small discrepancy
            self.warnings.append(
                f"Possible unclosed divs: {open_divs} opening tags, {close_divs} closing tags"
            )

    def _check_citations(self, html: str, md: str):
        """Verify citations are present"""
        # Extract citations from markdown
        md_citations = set(re.findall(r'\[(\d+)\]', md))

        # Extract citations from HTML (excluding bibliography)
        html_content = html.split('class="bibliography"')[0] if 'class="bibliography"' in html else html
        html_citations = set(re.findall(r'\[(\d+)\]', html_content))

        if len(md_citations) > 0 and len(html_citations) == 0:
            self.errors.append("No citations found in HTML content (but present in MD)")

        if len(md_citations) > len(html_citations) * 1.5:  # Allow some variation
            self.warnings.append(
                f"Fewer citations in HTML ({len(html_citations)}) than MD ({len(md_citations)})"
            )

    def _check_bibliography(self, html: str, md: str):
        """Verify bibliography is present and formatted"""
        if '## Bibliography' in md:
            if 'class="bibliography"' not in html:
                self.errors.append("Bibliography section missing from HTML")
            elif 'class="bib-entry"' not in html:
                self.warnings.append("Bibliography present but entries not properly formatted")

    def _print_results(self):
        """Print verification results"""
        print(f"\n{'-'*60}")
        print("VERIFICATION RESULTS")
        print(f"{'-'*60}\n")

        if self.errors:
            print(f"❌ ERRORS ({len(self.errors)}):")
            for i, error in enumerate(self.errors, 1):
                print(f"  {i}. {error}")
            print()

        if self.warnings:
            print(f"⚠️  WARNINGS ({len(self.warnings)}):")
            for i, warning in enumerate(self.warnings, 1):
                print(f"  {i}. {warning}")
            print()

        if not self.errors and not self.warnings:
            print("✅ All checks passed! HTML report is valid.")
            print()

        print(f"{'-'*60}\n")


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Verify HTML research report')
    parser.add_argument('--html', type=Path, required=True, help='Path to HTML report')
    parser.add_argument('--md', type=Path, required=True, help='Path to markdown report')

    args = parser.parse_args()

    if not args.html.exists():
        print(f"Error: HTML file not found: {args.html}")
        return 1

    if not args.md.exists():
        print(f"Error: Markdown file not found: {args.md}")
        return 1

    verifier = HTMLVerifier(args.html, args.md)
    success = verifier.verify()

    return 0 if success else 1


if __name__ == "__main__":
    exit(main())

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #40** (2026-09-27): **Release v2.0.0: Product Center**
  *Symptoms*: Product Center brings separate local product runs into one searchable dashboard, with read-only imports and explicit continuation requests. One persistent queue owns each full auto-loop and its cleanup; viewing or refreshing never starts work.  This release also fixes the systematic-review findings around stop authorization, P1 queue protection, complete older-cycle history and usage, default exploration creation, visible preparation failures, stopping uncertain work, preview links and keyboard focus. Existing single-runtime entrypoints remain available outside center-managed directories. Installer work is excluded.  Validation: - Independent Astra/high implementation review and release preflight; source behavior is unchanged by release preparation. - Local browser suite: 38 passed and one Text Meter teardown timeout; the unchanged targeted recheck passed (39 unique scenarios covered). JavaScript contracts: 44 passed. - Focused runtime, catalog, identity, journal and HTTP checks passed; platform-specific optional bridge/media checks retain their explicit skips. Prior real Luna, Terra and Sol acceptance is recorded separately and is not represented as an uninterrupted all-green run. - Required PR and merge CI must pass before tagging and publishing v2.0.0. These jobs do not establish complete real macOS Product Center execution coverage.  Version, bilingual README guidance and upgrade documentation are updated. Release notes are bilingual; existing screenshots and private rele

- **Issue #39** (2026-09-25): **feat: bilingual guided installation and managed release packages**
  *Symptoms*: Release downloads currently provide source snapshots without a guided setup path. This adds reproducible Windows, macOS and Linux archives with checksums, plus setup scripts that detect the OS UI language (Chinese or English), show missing dependencies and proposed changes, and install after confirmation. Windows retains the existing WSL2 runtime and Dashboard.  Managed installations receive an isolated local Git baseline and explicit update, rollback, recovery and uninstall commands. Maintenance preserves user projects and configuration, rejects modified distribution files or active writers, and shares the existing project registry lock. Services are prepared stopped; model login and starting the first run remain explicit user actions.  The package version remains 1.6.1 for this review. This PR does not publish assets or a release. Release attachment upload is manual, requires a matching draft release and successful runtime CI, and refuses to replace existing assets.  Validation at `e06a2e7`: all 12 jobs in [CI run 36022242896](https://github.com/MaxMiksa/Auto-Company/actions/runs/36022242896) passed. Standard Python: 508 passed / 21 platform skips, covered by separate real launchd, systemd and media suites; browser: 32 passed; macOS installer: 64 passed / 2 Linux-only skips. Both PowerShell editions and deterministic package builds passed. Independent installer and bootstrap reviews have no remaining actionable findings in their reviewed scope.  Actual Linux tar and Windows

- **Issue #38** (2026-09-23): **Release v1.6.1: protect P1 consensus and runtime ownership**
  *Symptoms*: The consensus guard previously accepted a P1 blocker added and immediately checked off during a model cycle. This change rejects that final state, protects existing P1 entries and their descriptions, preserves rejected drafts for human review when possible, restores the pre-cycle consensus and pauses the loop. Agents can still report unresolved blockers; humans resolve them after stopping and completing any interrupted-cycle recovery.  Prepared for v1.6.1. The release preparation commit changes only package.json; the reviewed runtime and documentation remain unchanged.  This PR also delivers the previously reviewed gap fixes:  - Serialize project registry operations and roll back only the failed operation's own entry. - Keep history and artifact access tied to stable product identity across relocation and same-path replacement. - Validate macOS service ownership before pause and propagate service-manager failures. - Restrict ordinary loopback previews to intended public resources and validate request origins and control tokens. - Align both READMEs with actual runtime boundaries, and document P1 recovery in both languages with the matching Dashboard pause message.  P1 protection compares persisted states at cycle boundaries. It does not guarantee preservation of transient direct edits made while an agent is running, and consensus restoration does not roll back product files or external actions. This PR adds no broad command sandbox, live budget cutoff or business-success gate

- **Issue #37** (2026-09-19): **Release v1.6.0: continuous product cycles and real previews**
  *Symptoms*: Product cycle numbers previously restarted with each process, and exploration cycles could appear as duplicate product history. This release keeps durable product identities and continuous cycle numbers, separates exploration in the Dashboard, and captures actual product screenshots and basic icons through a bounded optional program workflow.  Capture cancellation is recorded before cleanup, so a stop signal arriving during process-state parsing cannot be mistaken for invalid data. A deterministic regression also verifies that repeated stop signals finish cleanup while unrelated processes remain running.  The two README galleries now show the same reviewed examples: ScopeFence, Text Meter and 范围确认单 (Scope Sheet). The main image keeps product cycles 01–04 visible; other Dashboards and product interfaces are arranged in separate tables. Source snapshots exclude private run records, and publication fixes are documented in each product's source notes. Existing TableDelta/CueCheck sources are preserved.  Validation includes focused product-identity/media/loop tests, real browser capture and cleanup, Dashboard regressions, 13 published-example core tests and four browser workflows. Real Luna/high and Terra/high runs verify actual session configuration and recorded data. The Chinese run retains two provider-capacity failures followed by two completed cycles; screenshots and reports do not assert independent business completion. Hosted CI now covers automatic media capture and the pu

- **Issue #36** (2026-09-19): **Release v1.5.0: traceable cycle journal and recorded artifacts**
  *Symptoms*: The Dashboard now connects current and historical cycles in a vertical timeline and shows evidence tied to the selected project and exact cycle. The next-step panel and report fields are removed; the autonomous loop's internal handoff remains intact.  The journal keeps the current cycle prominent, moves project identity and run date into the sidebar, and places circular progress icons between cycle numbers and content. Concise records show the latest check, document registration and work-report update with their own timestamps. Commands, paths and exit codes remain in logs instead of dominating the main page. Check failures, stale or missing evidence and unknown project associations remain explicit.  Project metadata, check results, documents, and static previews use explicit normal-workflow tools. The existing journal API validates identities, timestamps, report hashes and supported machine counts. Titles, summaries and work phases remain structured model reports, separate from program-recorded runtime facts. Local Lucide icons and original progress geometry extend the existing layout without adding a frontend framework or CDN dependency.  Real execution exposed a preview lifecycle issue in short-lived tool terminals. Cycle previews now use persistent foreground command sessions under existing process supervision; cycle background launches are rejected before spawning. Actual PTY and supervisor tests cover clean shutdown and unrelated-process preservation.  Validation at rel

- **Issue #35** (2026-09-19): **feat: show structured cycle progress and confirm stop cleanup**
  *Symptoms*: The dashboard previously depended on free-form final reports, so active cycle progress, actual execution evidence and model configuration were often unavailable. This change adds validated cycle work reports and deterministic Codex event collection while keeping runtime outcomes, model statements and registered checks separate.  - Show concise per-cycle titles, progress, blockers and recorded next actions, with explicit missing/invalid/interrupted fallbacks. Reuse `/api/journal`; no additional model calls for extraction. - Capture bounded command/file events and exact-session model settings. Provide opt-in check, document and static-preview registration with freshness and ownership checks. - Confirm Windows/WSL stop cleanup, preserve interrupted-cycle evidence, and expose failed cleanup for retry. - Include the previously prepared bilingual usage guidance, current dashboard screenshot and side-by-side product examples.  Validation:  - Six actual model calls: three continuous cycles each with Luna/high and Terra/high. Exact session configuration confirmed for every cycle; 12 distinct work reports and 264 live HTTP samples. Prior reports, per-cycle evidence, selection, product language and Human Overrides remained intact. - Local Python: 274 executed and passed, 8 live-platform cases skipped for the separate hosted service suites. - Frontend semantics: 8 passed. Existing Chromium suite: 19 passed. Two additional browser checks used the retained real three-cycle histories. - Fin

- **Issue #34** (2026-09-18): **feat: release v1.4.0 with cycle journal dashboard**
  *Symptoms*: The Dashboard now opens as a cycle-centered work journal. The current or latest cycle is prominent, historical cycles expand on demand, and next steps, output documents and runtime information have a separate side column. The implementation retains the production controls, shared language preference, usage, budget information and diagnostics.  Updates the framework version to 1.4.0. Release notes also cover the CI improvements already merged since v1.3.2.  Cycle reports and logs keep their own record identity. Live cycle numbers require matching runtime evidence, missing usage remains unknown, and daily/weekly totals use completion dates. The journal adds bounded, same-origin document and log access without new dependencies. An optional read-only archive server can use an explicitly supplied external legacy backup.  Validation: [hosted CI](https://github.com/MaxMiksa/Auto-Company/actions/runs/35354695244) passes all 8 selected jobs, including the required gate. The standard Python suite executes 246 tests and skips 8 live-service cases covered by separate systemd (9 tests) and macOS launchd (3 tests) suites. All 17 Chromium tests pass together, as do 7 Node checks, both PowerShell editions and 197 skill-resource references. The 3 unchanged product-example jobs are explicitly skipped. Isolated macOS fixtures now copy the new journal dependency; no real autonomous run was started.  Local legacy backups and internal release documents are excluded from the public change. Release 

- **Issue #33** (2026-09-18): **test: verify CI gate and failure evidence (do not merge)**
  *Symptoms*: Temporary acceptance PR for the approved CI upgrade. Do not merge.  First verify that a documentation-only change receives a successful CI gate with irrelevant jobs explicitly skipped. Then inject a disposable browser assertion failure to verify required-gate failure and uploaded diagnostic evidence. Close this PR and remove its branch after collecting results. No probe changes will be merged into main. 

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

### Incident Patch 1: `b6c04eef` (2026-09-27)
**Commit Message**: fix: close product center control and journal review gaps

**File**: `dashboard/app.js` (modified, +123/-10)
```diff
@@ -30,7 +30,7 @@ OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
   const DEFAULT_HISTORY_LIMIT = 4;
   const productMatch = (globalThis.location?.pathname || '/journal').match(/^\/products\/([^/]+)\/?$/);
   const scope = { center: Boolean(productMatch), entryId: productMatch ? decodeURIComponent(productMatch[1]) : null, token: 0, contextToken: 0, entries: [] };
-  const state = { data: null, language: 'zh-CN', tab: 'work', expanded: new Set(), older: false, selectedLog: scope.center ? '' : 'runtime', logText: '', logLoadedId: '', logRequest: 0, logPending: null, refreshPending: null, signature: '', statusFailed: true, action: '', languageState: null, languageSaving: false, languageLoading: false, languageRevision: 0, languageError: '', languageSaved: false, timer: null, autoChanged: false, currentCycle: null, receivedAt: 0, elapsedTimer: null, centerSummary: null, mediaIntent: null, exploration: { key: '', token: 0, loading: false, loaded: false, failed: false, total: null, cycles: [] } };
+  const state = { data: null, language: 'zh-CN', tab: 'work', expanded: new Set(), older: false, selectedLog: scope.center ? '' : 'runtime', logText: '', logLoadedId: '', logRequest: 0, logPending: null, refreshPending: null, signature: '', statusFailed: true, action: '', languageState: null, languageSaving: false, languageLoading: false, languageRevision: 0, languageError: '', languageSaved: false, timer: null, autoChanged: false, currentCycle: null, receivedAt: 0, elapsedTimer: null, centerSummary: null, scopedUsage: null, usageToken: 0, detailToken: 0, detailLoads: new Map(), mediaIntent: null, exploration: { key: '', token: 0, loading: false, loaded: false, failed: false, total: null, cycles: [] } };
   const message = (key, values = {}) => {
     const dictionary = window.JOURNAL_MESSAGES[state.language] || window.JOURNAL_MESSAGES.en;
     return Object.entries(values).reduce((result, [name, value]) => result.replaceAll(`{${name}}`, String(value)), dictionary[key] || key);
@@ -147,6 +147,73 @@ OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
     try { const url = new URL(value, location.origin); return url.origin === location.origin && url.pathname.startsWith(prefix) ? `${url.pathname}${url.search}` : null; }
     catch (_) { return null; }
   }
+  function safePreviewURL(artifact, data = state.data) {
+    if (!scope.center || artifact?.kind !== 'preview' || artifact.available !== true || typeof artifact.url !== 'string') return null;
+    const productId = data?.project?.stableId || data?.entry?.productId;
+    if (!productId || artifact.productId !== productId) return null;
+    try {
+      const url = new URL(artifact.url);
+      if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password || url.origin === location.origin) return null;
+      return url.href;
+    } catch (_) { return null; }
+  }
+  function journalPageMatches(page, expected) {
+    return Boolean(expected?.entryId && expected?.sourceId && Number.isFinite(expected.sourceRevision)) && page?.entryId === expected.entryId && page?.sourceId === expected.sourceId && page?.sourceRevision === expected.sourceRevision && Array.isArray(page.cycles);
+  }
+  async function fetchFullScopedJournal() {
+    const first = await fetchCenter(`${scopedJournalPath('/journal')}?limit=100`);
+    const expected = { entryId: scope.entryId, sourceId: first?.sourceId, sourceRevision: first?.sourceRevision };
+    if (!journalPageMatches(first, expected)) throw new Error('Invalid scoped journal page');
+    const cycles = [...first.cycles]; const seenCursors = new Set(); const seenCycles = new Set(cycles.map((cycle) => cycle.id));
+    let cursor = first.nextBefore;
+    while (cursor) {
+      if (seenCursors.has(cursor)) throw new Error('Repeated journal cursor');
+      seenCursors.add(cursor);
+      const page = await fetchCenter(`${scopedJournalPath('/journal')}?limit=100&before=${encodeURIComponent(cursor)}&sourceId
```

**File**: `dashboard/center-i18n.js` (modified, +6/-6)
```diff
@@ -28,7 +28,7 @@ window.CENTER_MESSAGES = {
     phase_planning: "梳理方案", phase_implementing: "执行任务", phase_validating: "检查验证", phase_blocked: "遇到阻塞", phase_review: "提交验收",
     currentCycle: "当前第 {number} 轮", startedAt: "{time} 开始", queuePosition: "队列第 {position} 位", queuedCount: "{count} 项等待执行",
     attentionCount: "{count} 项需要处理", queueEmpty: "队列中没有工作请求。", runningSection: "正在执行", queuedSection: "等待执行 · {count}",
-    attentionSection: "需要处理 · {count}", historySection: "历史请求", stopItem: "停止此项", cancelItem: "取消", moveUp: "上移",
+    attentionSection: "需要处理 · {count}", historySection: "历史请求", preparingSection: "正在准备 · {count}", preparationAttentionSection: "准备失败或需处理 · {count}", preparationHistorySection: "准备历史 · {count}", stopItem: "停止此项", cancelItem: "取消", moveUp: "上移",
     moveDown: "下移", reconcile: "核对状态", plannedConfig: "计划：{model} · {effort}", languageConfig: "产品语言：{language}",
     requestCreated: "工作请求已保存。", explorationPrepared: "探索准备请求已保存；准备完成后才可执行。", actionAccepted: "操作已接受，状态将继续更新。",
     requestFailed: "操作未完成：{detail}", actionPending: "正在提交…", queueChanged: "队列顺序已更新。", preferencesSaved: "设置已保存。",
@@ -40,11 +40,11 @@ window.CENTER_MESSAGES = {
     readOnlySource: "来源为只读", contextUnavailable: "无法核对继续工作所需的产品身份或运行记录。请先恢复来源状态。", productRegistrationInvalid: "产品登记与当前源码不一致。请恢复或重新连接登记后再继续。", unresolvedP1: "有未解决的 P1 问题，等待人工决定后继续。", runtimeIncompatible: "运行环境不兼容", slotBusy: "执行槽正被占用",
     dispatchUncertain: "启动状态需要核对", stopUnconfirmed: "停止尚未确认", governancePaused: "治理保护已暂停执行", budgetPaused: "预算保护已暂停执行",
     revisionConflict: "记录已发生变化，请重新读取后再操作。", cursorExpired: "列表已更新，请重新读取。", unsupported: "当前来源不支持此操作",
-    openRequestExists: "此项已有未结束的工作请求。", productLanguageLocked: "已有产品的语言已经锁定，不能由中心改写。", recoveryRequired: "存在未确认的归属或操作，需要先核对恢复。", invalidConfig: "工作配置无效。",
+    openRequestExists: "此项已有未结束的工作请求。", productLanguageLocked: "已有产品的语言已经锁定，不能由中心改写。", recoveryRequired: "存在未确认的归属或操作，需要先核对恢复。", invalidConfig: "工作配置无效。", frameworkUnverified: "无法核验产品中心框架来源。", preparationFailed: "探索准备失败，请核对后重试。",
     unknownError: "未知错误", language_zh: "简体中文", language_en: "English", notRecorded: "未记录", noAttention: "没有需要处理的请求。",
     showHistory: "显示历史", hideHistory: "收起历史", queueOrderHint: "当前工作结束后依次执行", observedStale: "上次成功读取于 {time}",
     archiveSuccess: "产品已归档。", restoreSuccess: "产品已恢复。", detachReferenceSuccess: "参考源码已从中心移除。", detachEntrySuccess: "来源登记已从中心移除。", preparing: "正在准备", fieldMissing: "尚未记录", warningsCount: "{count} 项说明",
-    attentionReason: "原因：{reason}", requestedStop: "已按请求停止", requestedCancel: "等待请求已取消", operationPending: "准备操作已创建", invalidResponse: "服务返回了无法识别的数据。", openQueue: "打开工作队列",
+    attentionReason: "原因：{reason}", requestedStop: "已按请求停止", requestedCancel: "等待请求已取消", operationPending: "准备操作已创建", preparationItem: "新探索准备", preparationSucceeded: "准备完成", recheckPreparation: "重新核对", createdAt: "创建于 {time}", invalidResponse: "服务返回了无法识别的数据。", openQueue: "打开工作队列",
     archivedProduct: "已归档产品", exploreList: "尚未立项的探索", filterExploration: "探索", viewReferences: "查看参考源码", filterReference: "参考源码",
     connectionType: "登记方式", readOnlyProduct: "只读产品档案", readOnlyProductHint: "保留已有产品身份与工作记录，不自动接管执行。", referenceOnly: "仅参考源码", referenceOnlyHint: "只登记源码与 README 摘要，不计入产品，也不可执行。",
     sourceList: "已登记来源", sourceNumber: "来源 {number}", currentSource: "当前来源", sourceProject: "项目 {project}", sourceProjectLabel: "项目", sourceIdShort: "ID …{id}", sourceDetails: "来源详情", sourceLocation: "登记位置", sourceIdentifier: "来源 ID", sourceLastVerified: "最近核验", selectSource: "设为当前来源", reconnectSource: "重新连接目录", reconnectPath: "新的本机目录", reconnectHint: "先只读检查新目录，身份与已有记录一致后再连接。", takeover: "由中心接管", release: "解除中心接管", previewStart: "启动预览", previewStop: "停止预览", captureMedia: "更新产品媒体", detachEntry: "从中心移除", sourceSelected: "当前来源已更新。", sourceReconnected: "来源已重新连接。", managementComplete: "操作已完成。", operationAttention: "操作需要处理：{reason}", selectCurrentFirst: "请先把该来源设为当前来源。", noSources: "没有可用来源。", registeredDocuments: "登记文档", unmanagedSource: "尚未由产品中心管理", sourceUnavailableReason: "
```

**File**: `dashboard/center.js` (modified, +78/-24)
```diff
@@ -7,7 +7,7 @@
   const TERMINAL_STATES = new Set(["ended", "failed", "canceled"]);
   const state = {
     language: "zh-CN", revision: null, centerId: null, observedAt: null,
-    summary: null, entries: [], requests: [], preferences: null,
+    summary: null, entries: [], requests: [], operations: [], preferences: null,
     query: "", filter: "all", loading: true, stale: false, refreshing: null,
     refreshToken: 0, timer: null, menuEntryId: null, historyVisible: false,
     activeEntry: null, managementEntry: null, selectedSourceId: null, sourceToken: 0, probe: null, confirmAction: null, drawerOpen: false, pendingWrites: new Map(), projectionSignature: "", projectionTimer: null,
@@ -28,6 +28,16 @@
   function clear(node) { node.replaceChildren(); return node; }
   function text(value) { return typeof value === "string" ? value.trim() : ""; }
   function knownNumber(value) { return Number.isFinite(value) && value >= 0; }
+  function focusKey(node, value) { node.dataset.focusKey = value; return node; }
+  function rememberFocus() {
+    const active = document.activeElement;
+    return active && active !== document.body ? text(active.dataset?.focusKey) : "";
+  }
+  function restoreFocus(key) {
+    if (!key) return;
+    const node = [...document.querySelectorAll("[data-focus-key]")].find((item) => item.dataset.focusKey === key);
+    if (node && !node.disabled) node.focus({ preventScroll: true });
+  }
   function idempotencyKey() { return globalThis.crypto?.randomUUID?.() || `center-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
 
   class APIError extends Error {
@@ -149,7 +159,7 @@
 
   function capabilityReason(reason, fallback = "capabilityUnavailable") {
     if (!reason) return message(fallback);
-    const known = { unmanaged_source: "unmanagedSource", read_only_source: "readOnlySource", execution_domain_unconfigured: "executionUnavailable", runtime_incompatible: "runtimeIncompatible", slot_busy: "slotBusy", open_request_exists: "openRequestExists", source_unavailable: "sourceUnavailableReason", entry_archived: "archiveBlocked", product_registration_invalid: "productRegistrationInvalid", context_unavailable: "contextUnavailable", governance_pause: "governancePaused", budget_pause: "budgetPaused", stop_unconfirmed: "stopUnconfirmed", unresolved_p1: "unresolvedP1" };
+    const known = { unmanaged_source: "unmanagedSource", read_only_source: "readOnlySource", execution_domain_unconfigured: "executionUnavailable", runtime_incompatible: "runtimeIncompatible", slot_busy: "slotBusy", open_request_exists: "openRequestExists", source_unavailable: "sourceUnavailableReason", entry_archived: "archiveBlocked", product_registration_invalid: "productRegistrationInvalid", context_unavailable: "contextUnavailable", governance_pause: "governancePaused", budget_pause: "budgetPaused", stop_unconfirmed: "stopUnconfirmed", unresolved_p1: "unresolvedP1", framework_unverified: "frameworkUnverified", preparation_failed: "preparationFailed" };
     if (window.CENTER_MESSAGES[state.language][reason]) return message(reason);
     const key = known[reason] || known[String(reason).toLowerCase()];
     return key ? message(key) : errorText({ code: reason });
@@ -159,7 +169,7 @@
     const value = text(reason);
     if (value === "user_stop") return message("requestedStop");
     if (value === "user_cancel") return message("requestedCancel");
-    return /^(?:PRODUCT_REGISTRATION_INVALID|CONTEXT_UNAVAILABLE|GOVERNANCE_PAUSE|BUDGET_PAUSE|STOP_UNCONFIRMED|UNRESOLVED_P1)$/i.test(value) ? capabilityReason(value) : value || message("unknownError");
+    return /^(?:PRODUCT_REGISTRATION_INVALID|CONTEXT_UNAVAILABLE|GOVERNANCE_PAUSE|BUDGET_PAUSE|STOP_UNCONFIRMED|UNRESOLVED_P1|FRAMEWORK_UNVERIFIED|PREPARATION_FAILED)$/i.test(value) ? capabilityReason(value) : value || message("unknownError");
   }
 
   async function allEntries() {
@@ -283,28 +293,28 @@
     if (entry.lastActivityAt) { activity.dateTime = entry.lastActivityAt; activity.titl
```

**File**: `dashboard/center_catalog.py` (modified, +19/-13)
```diff
@@ -442,18 +442,27 @@ def journal(self, entry_id, query=None):
                     available = False
                 data['artifacts'].append({**item, 'kind': 'document', 'available': available,
                                           'url': base + item['id'] + '?sourceId=' + quote(source['sourceId']) if available else None})
-        for row in data['cycles']:
-            row['logUrl'] = base + 'log-' + quote(row['id']) + '?sourceId=' + quote(source['sourceId']) if row.get('logAvailable') else None
-        for item in data['artifacts']:
-            if item.get('id') and not item['id'].startswith('reference-'):
-                item['url'] = base + 'artifact-' + quote(item['id']) + '?sourceId=' + quote(source['sourceId'])
+        self._journal_links(entry_id, source['sourceId'], data['cycles'], data['artifacts'])
         media = data.get('productMedia') or {}
         images = [media.get('icon'), *((media.get('screenshot') or {}).get('latestSuccess') or {}).get('variants', [])]
         for item in images:
             if item and item.get('name'):
                 item['href'] = base + 'media-' + quote(item['name']) + '?sourceId=' + quote(source['sourceId'])
         return data
 
+    def _journal_links(self, entry_id, source_id, cycles, artifacts):
+        base = '/api/center/v1/entries/' + quote(entry_id) + '/resources/'
+        suffix = '?sourceId=' + quote(source_id)
+        items = list(artifacts)
+        for row in cycles:
+            row['logUrl'] = base + 'log-' + quote(row['id']) + suffix if row.get('logAvailable') else None
+            items.extend(row.get('artifacts', []))
+        for item in items:
+            # Preview URLs already passed product ownership and token health
+            # checks. Keep their separate origin; they are not document paths.
+            if item.get('kind') != 'preview' and item.get('id') and not item['id'].startswith('reference-'):
+                item['url'] = base + 'artifact-' + quote(item['id']) + suffix
+
     def usage(self, entry_id, query=None):
         query = query or {}
         entry, source, reader = self.resolve_source(entry_id, query.get('sourceId'))
@@ -499,15 +508,11 @@ def record(self, entry_id, record_id, source_id=None):
         entry, source, reader = self.resolve_source(entry_id, source_id)
         if not isinstance(record_id, str) or not CYCLE_ID.fullmatch(record_id):
             raise CenterError('RECORD_NOT_FOUND', 'Record is unavailable.', 404)
-        row = next((row for row in reader.snapshot()['cycles'] if row['id'] == record_id), None)
+        row = next((row for row in reader.snapshot(detail_cycle_id=record_id)['cycles'] if row['id'] == record_id), None)
         if not row:
             raise CenterError('RECORD_NOT_FOUND', 'Record does not belong to this entry.', 404)
-        if row.get('detailStatus') == 'limited':
-            from cycle_reports import read_report
-            from observability_data import cycle_events
-            row.update(read_report(reader, row))
-            row.update(cycle_events(reader, row))
-            row['detailStatus'] = 'recorded'
+        self._journal_links(entry_id, source['sourceId'], [row], [])
+        row.update(entryId=entry_id, sourceId=source['sourceId'], sourceRevision=source['sourceRevision'])
         return row
 
     def resource(self, entry_id, resource_id, source_id=None):
@@ -529,7 +534,8 @@ def resource(self, entry_id, resource_id, source_id=None):
             return raw.encode('utf-8'), 'text/plain; charset=utf-8'
         if resource_id.startswith('artifact-'):
             artifact_id = resource_id[9:]
-            item = next((item for item in reader.documents() if item.get('id') == artifact_id and item.get('available')), None)
+            item = next((item for item in reader.documents() if item.get('id') == artifact_id
+                         and item.get('kind') != 'preview' and item.get('available')), None)
             if item and item.get('path'):
            
```

**File**: `dashboard/center_runtime.py` (modified, +44/-8)
```diff
@@ -215,10 +215,7 @@ def __init__(self, store, catalog, framework_root, execution_domain=None, *, ada
                 language = system_language(os.environ)
                 tx.put("preferences", "main", {"language": language, "productLanguage": language, "engine": "codex", "model": "", "effort": "high", "revision": 1})
             # A single-item authorization also expires at a center restart.
-            for request in tx.list("requests"):
-                if request["state"] == "queued" and request.get("startAuthorized"):
-                    request["startAuthorized"] = False
-                    tx.put("requests", request["requestId"], request)
+            self._revoke_start_authorizations(tx)
             for operation in tx.list("operations"):
                 if operation.get("state") in {"preparing", "running"}:
                     operation.update(state="attention", reason="recovery_required")
@@ -313,7 +310,20 @@ def _transition(self, tx, request, state, actor, reason=None, body=None, **field
         self._event(tx, request, old, actor, reason, body)
         return request
 
+    @staticmethod
+    def _revoke_start_authorizations(tx):
+        for request in tx.list("requests"):
+            if request["state"] == "queued" and request.get("startAuthorized"):
+                request.update(startAuthorized=False, revision=request["revision"] + 1)
+                tx.put("requests", request["requestId"], request)
+        for operation in tx.list("operations"):
+            if (operation.get("kind") == "exploration" and operation.get("state") in {"preparing", "attention"}
+                    and operation.get("input", {}).get("executionMode") == "start_now" and not operation.get("authorizationRevoked")):
+                operation.update(authorizationRevoked=True, revision=operation["revision"] + 1)
+                tx.put("operations", operation["operationId"], operation)
+
     def _pause(self, tx, reason):
+        self._revoke_start_authorizations(tx)
         queue = tx.get("controls", "queue")
         if queue.get("dispatchEnabled") or queue.get("reason") != reason:
             queue.update(dispatchEnabled=False, reason=reason, revision=queue["revision"] + 1)
@@ -323,11 +333,14 @@ def summary(self):
         with self.store.transaction() as tx:
             requests, queue = tx.list("requests"), tx.get("controls", "queue")
             entries = [entry for entry in tx.list("entries") if not entry.get("detached")]
+            preparations = [row for row in tx.list("operations") if row.get("kind") == "exploration"]
             current = next((request for request in requests if request["state"] in ACTIVE and request.get("dispatchId")), None)
             current = self._request_view(tx, current) if current else None
             return {"dispatchEnabled": queue["dispatchEnabled"], "queueRevision": queue["revision"], "currentRequest": current,
                     "queuedCount": sum(row["state"] == "queued" for row in requests),
-                    "attentionCount": sum(row["state"] == "attention" for row in requests),
+                    "attentionCount": sum(row["state"] == "attention" for row in requests)
+                                      + sum(row["state"] in {"failed", "attention"} for row in preparations),
+                    "preparationCount": sum(row["state"] == "preparing" for row in preparations),
                     "counts": {kind: sum(row.get("kind") == kind for row in entries) for kind in ("product", "exploration", "legacy", "reference")},
                     "language": tx.get("preferences", "main")["language"], "executionDomain": self.domain,
                     "executionAvailable": self.adapter.available, "dispatchReason": queue.get("reason")}
@@ -564,6 +577,7 @@ def queue_action(self, action, body):
                         raise CenterError("RECOVERY_REQUIRED", "Resolve outstanding ownership or operation issues first", 409)
                     queue.update(dispatchEnable
```

---

### Incident Patch 2: `6d4349d9` (2026-09-26)
**Commit Message**: fix product center runtime context states

**File**: `dashboard/app.js` (modified, +28/-8)
```diff
@@ -51,12 +51,33 @@ OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
   }
   function statusLabel(status) {
     if (['not_started', 'startup_unconfirmed'].includes(status)) return message(status);
-    return ['stopping', 'stop_failed', 'completed', 'completed_with_timeout', 'failed', 'interrupted', 'stopped_status', 'running', 'idle', 'paused', 'waiting_limit', 'circuit_break', 'stopped', 'active', 'inactive', 'configured', 'not_configured', 'not_installed', 'mismatched', 'activating', 'deactivating', 'reloading', 'unsupported'].includes(status) ? message(status) : status === 'unavailable' ? message('statusUnavailable') : message('unknown');
+    return ['starting', 'stopping', 'stop_failed', 'completed', 'completed_with_timeout', 'failed', 'interrupted', 'stopped_status', 'running', 'idle', 'paused', 'waiting_limit', 'circuit_break', 'stopped', 'active', 'inactive', 'configured', 'not_configured', 'not_installed', 'mismatched', 'activating', 'deactivating', 'reloading', 'unsupported'].includes(status) ? message(status) : status === 'unavailable' ? message('statusUnavailable') : message('unknown');
   }
   function readOnly() { return state.data?.readOnly !== false; }
   function centerModeKey() { return state.data?.entry?.runtimeId ? 'centerManaged' : 'centerArchive'; }
   function liveProcess() { return !readOnly() && !state.statusFailed && state.data?.runtime?.processState === 'running'; }
-  function runtimeLabel() { return statusLabel(state.action === 'stop' ? 'stopping' : state.data?.control?.stopUnconfirmed ? (state.data?.control?.action === 'stop' ? 'stopping' : 'stop_failed') : state.statusFailed ? 'unavailable' : state.data?.runtime?.state); }
+  function scopedCenterRuntimeState(data = state.data, summary = state.centerSummary) {
+    if (!scope.center) return null;
+    const entry = data?.entry; const execution = entry?.executionSummary; const request = summary?.currentRequest;
+    if (!entry?.entryId || !request?.liveConfirmedAt || request.entryId !== entry.entryId) return null;
+    if (!execution?.requestId || execution.requestId !== request.requestId || execution.state !== request.state) return null;
+    return ['starting', 'running', 'stopping'].includes(request.state) ? request.state : null;
+  }
+  function runtimeLabel() {
+    const centerState = scopedCenterRuntimeState();
+    return statusLabel(centerState || (scope.center ? 'unknown' : state.action === 'stop' ? 'stopping' : state.data?.control?.stopUnconfirmed ? (state.data?.control?.action === 'stop' ? 'stopping' : 'stop_failed') : state.statusFailed ? 'unavailable' : state.data?.runtime?.state));
+  }
+  function requestContextLabel(request) {
+    const name = request?.displayName || message('unknown');
+    const plan = [request?.config?.model, request?.config?.effort].filter(Boolean).join(' · ');
+    return plan ? `${name} · ${plan}` : request?.sourceId ? `${name} · …${String(request.sourceId).slice(-8)}` : name;
+  }
+  function renderCenterRuntimeContext(summary) {
+    const active = summary?.currentRequest;
+    const value = !active ? '' : active.entryId === scope.entryId ? message('viewingRunningProduct') : message('otherProductRunning', { name: requestContextLabel(active) });
+    $('centerRuntimeContext').textContent = value;
+    $('centerRuntimeContext').title = value;
+  }
   function pauseLabel(value) { return message(`pause_${value}`) === `pause_${value}` ? String(value || '') : message(`pause_${value}`); }
   async function fetchJSON(url, options = {}, timeout = 100000) {
     const controller = new AbortController();
@@ -482,13 +503,14 @@ OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
   function renderRuntime() {
     const data = state.data;
     const runtime = data?.runtime || {};
-    const unavailable = state.statusFailed || runtime.available === false;
+    const centerState = scopedCenterRuntimeState();
+    const unavailable = scope.center ? false : state.statusFailed || runtime.available
```

**File**: `dashboard/center-i18n.js` (modified, +2/-2)
```diff
@@ -16,7 +16,7 @@ window.CENTER_MESSAGES = {
     readOnlyProbe: "只读探测", importIntro: "先读取目录身份与能力；不会执行目录中的脚本或启动产品。", folderPath: "目录",
     folderPlaceholder: "输入本机目录路径", probe: "检查目录", confirmImport: "确认接入", centerSettings: "中心设置",
     centerLanguage: "中心界面语言", centerLanguageHint: "只改变产品中心固定文字，不翻译产品记录。", newWorkDefaults: "新工作的默认值",
-    save: "保存", confirm: "确认", loading: "正在读取产品…", noProducts: "尚未接入产品。可新建工作或接入已有产品。",
+    save: "保存", confirm: "确认", loading: "正在读取产品…", noProducts: "尚未接入产品。可新建工作或接入已有产品。", noFormedProducts: "还没有已立项产品。可查看尚未立项的探索，或接入已有产品。", viewExplorations: "查看探索",
     noMatches: "没有符合当前搜索和筛选的产品。", clearFilters: "清除筛选", staleData: "刷新失败。以下为上次读取的记录；执行操作已暂停。",
     loadFailed: "产品中心暂时无法读取。请检查本地服务后重试。", retry: "重试", refreshedAt: "读取于 {time}", unknownTime: "时间未记录",
     purposeMissing: "用途尚未记录", workMissing: "尚无工作汇报", cycleNumber: "第 {number} 轮", phaseRecorded: "记录阶段：{phase}", view: "查看",
@@ -66,7 +66,7 @@ window.CENTER_MESSAGES = {
     readOnlyProbe: "Read-only probe", importIntro: "First inspect identity and capabilities. The center will not execute scripts from the folder or start the product.", folderPath: "Folder",
     folderPlaceholder: "Enter a local folder path", probe: "Check folder", confirmImport: "Confirm connection", centerSettings: "Center settings",
     centerLanguage: "Center interface language", centerLanguageHint: "Changes fixed center labels only. Product records are not translated.", newWorkDefaults: "Defaults for new work",
-    save: "Save", confirm: "Confirm", loading: "Loading products…", noProducts: "No products are connected. Create new work or connect an existing product.",
+    save: "Save", confirm: "Confirm", loading: "Loading products…", noProducts: "No products are connected. Create new work or connect an existing product.", noFormedProducts: "There are no formed products yet. View pre-product explorations or connect an existing product.", viewExplorations: "View explorations",
     noMatches: "No products match the current search and filter.", clearFilters: "Clear filter", staleData: "Refresh failed. These are the last records read; execution actions are paused.",
     loadFailed: "The product center cannot be read right now. Check the local service and retry.", retry: "Retry", refreshedAt: "Read at {time}", unknownTime: "Time not recorded",
     purposeMissing: "Purpose not recorded", workMissing: "No work report yet", cycleNumber: "Cycle {number}", phaseRecorded: "Recorded phase: {phase}", view: "View",
```

**File**: `dashboard/center.js` (modified, +16/-2)
```diff
@@ -175,6 +175,15 @@
     });
   }
 
+  function emptyListState(entries = filteredEntries()) {
+    if (entries.length) return null;
+    if (state.stale && !state.entries.length) return { messageKey: "loadFailed" };
+    if (state.query || state.filter !== "all") return { messageKey: "noMatches", actionKey: "clearFilters", target: "all" };
+    const hasProduct = state.entries.some((entry) => !entry.archived && ["product", "legacy"].includes(entry.kind));
+    if (!hasProduct) return { messageKey: "noFormedProducts", actionKey: "viewExplorations", target: "exploration" };
+    return { messageKey: "noProducts" };
+  }
+
   function safeAssetURL(value) {
     if (typeof value !== "string" || !value.startsWith(`${API}/`)) return null;
     try { const url = new URL(value, location.origin); return url.origin === location.origin && url.pathname.startsWith(`${API}/`) ? `${url.pathname}${url.search}` : null; }
@@ -280,8 +289,13 @@
     const entries = filteredEntries();
     for (const entry of entries) container.append(renderRow(entry));
     if (!entries.length) {
-      const empty = element("span", "", state.stale && !state.entries.length ? message("loadFailed") : state.entries.length ? message("noMatches") : message("noProducts")); listState.append(empty);
-      if (state.entries.length) { const clearButton = element("button", "text-button", message("clearFilters")); clearButton.type = "button"; clearButton.addEventListener("click", clearFilters); listState.append(clearButton); }
+      const emptyState = emptyListState(entries);
+      listState.append(element("span", "", message(emptyState.messageKey)));
+      if (emptyState.actionKey) {
+        const action = element("button", "text-button", message(emptyState.actionKey)); action.type = "button";
+        action.addEventListener("click", () => { state.query = ""; $("productSearch").value = ""; setFilter(emptyState.target); });
+        listState.append(action);
+      }
     }
   }
 
```

**File**: `dashboard/styles.css` (modified, +1/-1)
```diff
@@ -1839,7 +1839,7 @@ dialog .runtime-details {
 .center-back-link::after { content: "/"; margin-left: 13px; color: var(--line-strong); }
 .product-switcher-button { min-width: 0; max-width: 260px; display: inline-flex; align-items: center; gap: 7px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 3px; background: #fff; color: var(--ink); font-weight: 650; cursor: pointer; }
 .product-switcher-button span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
-.center-runtime-context { overflow: hidden; max-width: 240px; color: var(--muted); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
+.center-runtime-context { overflow: hidden; max-width: 360px; color: var(--muted); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
 .product-switcher-dialog { width: min(520px, calc(100vw - 32px)); padding: 24px; }
 .product-switcher-dialog .dialog-header { margin-bottom: 17px; }
 .switcher-search { display: block; margin-bottom: 10px; }
```

**File**: `tests/test_center_frontend.js` (modified, +42/-1)
```diff
@@ -20,11 +20,24 @@ function helpers() {
   vm.runInContext(i18n, context);
   const binding = app.lastIndexOf("\n  applyLanguage(); wire(); renderPage(); refresh();");
   assert.ok(binding > 0, "Center event wiring must follow helper declarations");
-  vm.runInContext(app.slice(0, binding) + "\n globalThis.center = { state, message, entryState, capability, normalizeCounts, filteredEntries, requestState, statusLabel, write };\n})();", context);
+  vm.runInContext(app.slice(0, binding) + "\n globalThis.center = { state, message, entryState, capability, normalizeCounts, filteredEntries, emptyListState, requestState, statusLabel, write };\n})();", context);
   context.center.state.language = "en";
   return { ...context.center, messages: context.window.CENTER_MESSAGES, context };
 }
 
+function journalHelpers() {
+  const context = vm.createContext({
+    window: {}, location: { pathname: "/products/entry-a", origin: "http://127.0.0.1:8843" },
+    document: {}, URL, Intl, Date, Number, Object, Set, Map, String, Math, AbortController, setTimeout, clearTimeout,
+  });
+  vm.runInContext(fs.readFileSync(path.join(dashboard, "i18n.js"), "utf8"), context);
+  const binding = journalApp.indexOf("\n  document.querySelectorAll('[data-tab]')");
+  assert.ok(binding > 0, "Journal event wiring must follow helper declarations");
+  vm.runInContext(journalApp.slice(0, binding) + "\n globalThis.journal = { state, scope, scopedCenterRuntimeState, runtimeLabel, requestContextLabel };\n})();", context);
+  context.journal.state.language = "en";
+  return context.journal;
+}
+
 test("center fixed labels are complete and bilingual", () => {
   const { messages } = helpers();
   assert.deepEqual(Object.keys(messages.en).sort(), Object.keys(messages["zh-CN"]).sort());
@@ -76,6 +89,34 @@ test("catalog filters use recorded state and never search report bodies", () =>
   state.filter = "reference"; assert.deepEqual(Array.from(filteredEntries(), (entry) => entry.entryId), ["e"]);
 });
 
+test("unfiltered catalog without formed products points to explorations", () => {
+  const { state, emptyListState } = helpers();
+  state.entries = [{ entryId: "explore", kind: "exploration", archived: false }]; state.filter = "all"; state.query = "";
+  assert.deepEqual({ ...emptyListState([]) }, { messageKey: "noFormedProducts", actionKey: "viewExplorations", target: "exploration" });
+  state.query = "missing";
+  assert.deepEqual({ ...emptyListState([]) }, { messageKey: "noMatches", actionKey: "clearFilters", target: "all" });
+});
+
+test("product detail trusts only the confirmed matching center request", () => {
+  const { state, scopedCenterRuntimeState, runtimeLabel } = journalHelpers();
+  const request = { requestId: "request-a", entryId: "entry-a", state: "running", liveConfirmedAt: "2026-09-26T23:24:49+08:00" };
+  state.data = { entry: { entryId: "entry-a", executionSummary: { requestId: "request-a", state: "running" } }, cycles: [{ status: "completed", active: false }] };
+  state.centerSummary = { currentRequest: request };
+  assert.equal(scopedCenterRuntimeState(), "running");
+  assert.equal(runtimeLabel(), "Running");
+  state.centerSummary = { currentRequest: { ...request, entryId: "entry-b" } };
+  assert.equal(scopedCenterRuntimeState(), null);
+  assert.equal(runtimeLabel(), "Unknown");
+  state.centerSummary = { currentRequest: { ...request, liveConfirmedAt: null } };
+  assert.equal(scopedCenterRuntimeState(), null);
+});
+
+test("cross-product running context includes the queued-plan identity", () => {
+  const { requestContextLabel } = journalHelpers();
+  assert.equal(requestContextLabel({ displayName: "Auto Company", config: { model: "gpt-5.6-luna", effort: "high" } }), "Auto Company · gpt-5.6-luna · high");
+  assert.equal(requestContextLabel({ displayName: "Auto Company", sourceId: "source_1234567890" }), "Auto Company · …34567890");
+});
+
 test("center actions use the versioned envelope routes and explicit write preconditions", () => {

```

---

### Incident Patch 3: `3f4ba37c` (2026-09-23)
**Commit Message**: fix: protect P1 consensus content across cycles

**File**: `PROMPT.md` (modified, +3/-2)
```diff
@@ -58,7 +58,8 @@
 [逐字保留现有内容；Agent 不得删除、改写、重排或格式化]
 
 ## Priority Issues
-- [ ] P1: [未解决的最高优先级阻断项；没有则写 `- None.`]
+[逐字保留已有 P1 条目及其说明，包括人工已勾选的历史项；可以追加新的未解决项，不得删除、改写、降级或自行勾选]
+- [ ] P1: [新发现且需要人工处理的阻断项；没有任何条目时才写 `- None.`]
 
 ## Open Questions
 - [待思考的问题]
@@ -83,7 +84,7 @@
 ## 人工治理与项目边界（强制）
 
 1. `Human Overrides` 是人类专属区，必须逐字保留；任何改动都会触发整轮共识回滚并暂停循环。
-2. `Priority Issues` 中存在未勾选的 P1 时，本轮会在调用模型前被阻断。只能由人类解决或明确勾选完成。
+2. `Priority Issues` 中存在未勾选的 P1 时，本轮会在调用模型前被阻断。逐字保留运行前已有 P1 条目及其说明，包括人工已勾选的历史项；可以追加未解决 P1，不得删除、改写、降级已有条目或新增已勾选条目。只能由人类在停止运行、完成待处理的中断恢复后解决或明确勾选；不支持运行中直接编辑共识来保证人工问题不被覆盖。
 3. 新产品只能通过 `make project-new NAME=<slug>` 创建；它会成为独立本地 Git 仓库。
 4. 框架仓库只登记项目元数据，不承载产品源码、产品提交或产品远端。
 5. 创建项目后禁止添加远端或 push；只有人类显式执行 `make project-publish ... CONFIRM=PUBLISH` 才能发布。
```

**File**: `README-ZH.md` (modified, +2/-0)
```diff
@@ -299,6 +299,8 @@ Auto-Company 并非简单调用 LLM API，而是一个高度解耦的 **多智
 | **恢复** | `make resume`，回到自主模式 |
 | **审查产出** | 查看 `docs/*/`——每个 Agent 的工作成果 |
 
+模型可以上报未解决的 P1，但必须保留已有 P1 条目，不能新增已勾选条目。人工应在停止运行并完成待处理恢复后解决问题，详见 [P1 问题与人工修改](docs/troubleshooting.md#p1-问题与人工修改)。
+
 ## 安全红线
 
 `CLAUDE.md` 向智能体提供以下行为规则。它们与框架的特定检查共同使用，但不是通用命令拦截机制，也不保证每次违反规则的操作都被阻止：
```

**File**: `README.md` (modified, +2/-0)
```diff
@@ -298,6 +298,8 @@ To change direction, stop the foreground run with `make stop`, pause a macOS/WSL
 | **Resume** | `make resume` |
 | **Review outputs** | Check `docs/*/` for artifacts generated by agents |
 
+Agents may report unresolved P1 blockers, but must preserve existing P1 entries and cannot add checked-off ones. Resolve blockers only after stopping and completing pending recovery; see [P1 issues and human edits](i18n/en/docs/troubleshooting.md#p1-issues-and-human-edits).
+
 ## Safety Guardrails
 
 `CLAUDE.md` gives agents the following behavioral rules. They complement specific framework checks, but are not a general command-denial mechanism or a guarantee that every agent action is blocked when it violates a rule:
```

**File**: `dashboard/i18n.js` (modified, +2/-0)
```diff
@@ -252,6 +252,7 @@ window.JOURNAL_MESSAGES = {
     "pause_budget_exceeded": "达到用量预算，需要检查预算设置",
     "pause_rate_limit": "等待额度恢复",
     "pause_user_requested": "用户请求暂停",
+    "pause_priority_issue_mutated": "P1 问题被修改，需要人工检查",
     "actionPending": "正在处理“{action}”，请稍候…",
     "actionComplete": "“{action}”请求已完成，正在核对实际状态。",
     "actionFailed": "“{action}”未能确认完成：{detail}。已重新读取状态，可在确认后重试。",
@@ -583,6 +584,7 @@ window.JOURNAL_MESSAGES = {
     "pause_budget_exceeded": "Usage budget reached; review the budget settings",
     "pause_rate_limit": "Waiting for quota to recover",
     "pause_user_requested": "Paused by user request",
+    "pause_priority_issue_mutated": "P1 issues changed; human review is required",
     "actionPending": "Processing “{action}”…",
     "actionComplete": "“{action}” request completed. Checking the actual runtime state.",
     "actionFailed": "Could not confirm “{action}”: {detail}. Status has been checked again; review it before retrying.",
```

**File**: `docs/troubleshooting.md` (modified, +12/-0)
```diff
@@ -47,6 +47,18 @@
 
 Linux/WSL、macOS 的后台服务可在原因解决后使用 `make resume`；前台运行先正常停止，再用 `python3 scripts/core/usage.py resume` 清除预算暂停并重新 `make start`。Windows 用户可在对应 WSL 仓库中执行后台恢复命令。恢复不会清空已记录的用量，再次超限仍会暂停。详细规则见 [用量治理](../i18n/zh-CN/docs/usage-governance.md)。
 
+## P1 问题与人工修改
+
+`Priority Issues` 中的 P1 表示必须由人处理的阻断项。模型可以追加未解决的 `- [ ] P1: 描述`；运行前已有的 P1 条目及说明必须原样保留，包括人工已勾选的历史项。模型删除、改写、降级既有条目或新增已勾选条目时，共识会恢复到运行前版本并暂停，原因记为 `priority_issue_mutated`。这项恢复不撤销产品文件或外部操作。
+
+需要随条目保留的说明写在该条目下的缩进续行中；另一条 P1、新标题或同级列表项会开始新的内容。空分隔行不属于条目内容。
+
+违反人工规则或 P1 内容保护时，程序会尝试把被拒绝的原稿保存在 `memories/rejected/`，并在日志中记录位置，供人工审查；它不是成功轮次快照。保存失败会明确记录，循环仍保持暂停并尝试恢复运行前共识。
+
+人工处理时先正常停止前台循环或暂停后台服务，并确认已经停止。若上一轮被强制中断，在对应 Linux/WSL 或 macOS 仓库运行 `bash scripts/core/consensus-guard.sh recover` 完成待处理恢复，再编辑共识。成功恢复会保留暂停并返回 42；没有待恢复轮次时返回 0。若提示恢复失败，先处理原始错误，不要删除恢复标记或基线来绕过。
+
+确认问题解决后，人工可将对应条目改为 `- [x] P1: 描述`，再启动或恢复运行。不要在模型执行期间直接编辑这份文件：周期前后比较无法可靠保留中途新增后又被覆盖的内容，也不是实时中断入口。
+
 ## 提交问题时提供什么
 
 提供操作系统、WSL 发行版（如适用）、项目版本、执行的命令、所选语言、原始错误及相关日志片段。发送前移除密钥、令牌和不应公开的业务内容；无需提供整个配置目录。
```

---

### Incident Patch 4: `aa663ace` (2026-09-22)
**Commit Message**: fix: preserve product ownership and runtime control boundaries

**File**: `README-ZH.md` (modified, +29/-25)
```diff
@@ -2,10 +2,10 @@
 
 # Auto Company
 
-**全自主 AI 公司，24/7 不停歇运行** <a href="README.md"><img alt="[English Documentation]" src="https://img.shields.io/badge/%5BEnglish%20Documentation%5D-2f3640.svg" /></a>
+**支持持续自主工作的 AI 公司框架** <a href="README.md"><img alt="[English Documentation]" src="https://img.shields.io/badge/%5BEnglish%20Documentation%5D-2f3640.svg" /></a>
 
-基于 **Agentic Workflows (代理式工作流)** 驱动，系统编排了 14 个 **Autonomous AI Agent (自主智能体)**，每个都是该领域世界顶级专家的思维分身。
-自主构思产品、做决策、写代码、部署上线、搞营销。没有人类参与。
+基于 **Agentic Workflows（代理式工作流）**，系统提供 14 份 **AI 智能体角色定义**，各自参考相关领域专家的工作方法。
+团队可以在人类设定的目标、权限和预算内自主调研产品、做决策和写代码。部署、发布和营销取决于可用工具及授权范围，持续运行也依赖服务和模型可用性。
 
 默认使用 Claude Code，并支持 [Codex CLI](https://www.npmjs.com/package/@openai/codex)（macOS 原生 + Windows/WSL），两端都可启动本地 Dashboard。
 
@@ -44,23 +44,23 @@ ScopeFence 的真实四轮产品记录：04 展开，03、02、01 逐项收起
 
 ## 这是什么？
 
-你启动一个循环。AI 团队醒来，读取共识记忆，决定干什么，组建 3-5 人小队，执行任务，更新共识记忆，然后睡一觉。接着又醒来。如此往复，永不停歇。
+你启动循环后，每轮会读取工作摘要、决定任务、按需组队、执行并更新摘要，然后等待下一轮。实际组队取决于模型和引擎能力；错误、预算限制或暂停请求可能中止后续运行。
 
 ```
 daemon (launchd / systemd --user, 崩溃自重启)
-  └── scripts/core/auto-loop.sh (永续循环)
+  └── scripts/core/auto-loop.sh (持续循环)
         ├── 读 PROMPT.md + consensus.md
         ├── CLI 调用（Codex CLI / Claude Code）
         │   ├── 读 CLAUDE.md (公司章程 + 安全红线)
         │   ├── 读 .claude/skills/team/SKILL.md (组队方法)
-        │   ├── 组建 Agent Team (3-5 人)
+        │   ├── 按需组建 Agent Team
         │   ├── 执行：调研、写码、部署、营销
-        │   └── 更新 memories/consensus.md (传递接力棒)
+        │   └── 更新 memories/consensus.md (工作摘要)
         ├── 失败处理: 限额等待 / 熔断保护 / consensus 回滚
         └── sleep → 下一轮
 ```
 
-每个周期是一次独立的 CLI 调用。`memories/consensus.md` 是唯一的跨周期状态——类似接力赛传棒。
+每个周期是一次独立的 CLI 调用。`memories/consensus.md` 是下一轮预加载的主要工作摘要，产品文件、仓库、配置、身份记录、日志和用量数据也会跨轮次保留。
 
 ## 运行产物示例
 
@@ -106,7 +106,7 @@ daemon (launchd / systemd --user, 崩溃自重启)
 | 用量与预算 | [治理说明](i18n/zh-CN/docs/usage-governance.md) | [Governance guide](docs/usage-governance.md) |
 | 操作与排错 | [常见操作与排错](docs/troubleshooting.md) | [Common tasks and errors](i18n/en/docs/troubleshooting.md) |
 
-## 团队阵容（14 人）
+## 团队阵容（14 个角色）
 
 不是"你是一个开发者"，而是"你是 DHH"——用真实传奇人物激活 LLM 的深层知识。
 
@@ -224,38 +224,38 @@ Auto-Company 并非简单调用 LLM API，而是一个高度解耦的 **多智
 ```text
 ┌────────────────────────────────────────────────────────────┐
 │ 5. 监控与人机交互层 (Observability & HITL)                 │
-│    [ Dashboard看板 ]  [ 基于文件的操纵杆 (consensus.md) ]  │
+│    [ Dashboard看板 ]  [ 文件式引导 (consensus.md) ]       │
 ├────────────────────────────────────────────────────────────┤
 │ 4. 工作流路由层 (Workflow Routing & Teaming)               │
-│    [ 动态组队路由 (Squad) ]  [ 强制收敛流 (Cycle 1->2->3) ]│
+│    [ 按角色组队 (Squad) ]  [ 提示词工作流指导 ]           │
 ├────────────────────────────────────────────────────────────┤
 │ 3. 智能体模型与认知层 (Agentic Models & Cognition)         │
 │    [ 14 个专家人格 (Personas) ]  [ 30+ 技能库 (Skills) ]   │
 ├────────────────────────────────────────────────────────────┤
 │ 2. 编排与状态控制层 (Orchestration & State Machine)        │
-│    [ 永续主循环 ]  [ 状态机 (Consensus) ]  [ 容错与熔断 ]  │
+│    [ 持续主循环 ]  [ 持久状态 ]  [ 容错与熔断 ]          │
 ├────────────────────────────────────────────────────────────┤
 │ 1. 基础设施与执行引擎层 (Execution Engine & Infrastructure)│
 │    [ 引擎适配器 (Adapters) ]  [ 跨平台守护进程 (Daemon) ] │
 └────────────────────────────────────────────────────────────┘
 ```
 
 ### 第 5 层：监控与人机交互层 (Observability & HITL)
-*   **基于文件的操纵杆 (File-based Steering)**：人类只需编辑 `memories/consensus.md`，修改 `Next Action`，下一个周期醒来的 AI 团队就会立刻“转舵”，实现极简的宏观控制。
+*   **文件式引导 (File-based Steering)**：停止当前运行后，在 `memories/consensus.md` 中修改 `Next Action` 来安排下一步，或修改 `Human Overrides` 来设置持续约束，然后启动或恢复。运行中编辑可能与模型更新和恢复操作冲突，不保证立即改变方向。
 *   **日志与看板 (Dashboard)**：`logs/` 保存引擎实际输出（对已知凭据进行脱敏），以及每轮结果和可用的用量记录。输出详细程度取决于引擎，不保证包含完整思考链。`dashboard/` 按当前与历史轮次组织工作汇报和成果，并提供运行控制、状态、用量、预算与日志，不跟踪各个 Agent 的活跃度。
 
 ### 第 4 层：工作流路由层 (Workflow Routing & Teaming)
-*   **动态组队路由 (Dynamic Squad Formation)**：系统利用 Agent Teams 功能，根据当前 `consensus.md` 中的 "Next Action"，从 14 人池子中动态挑选 2-5 名最适合的专家，并在当前循环中将它们“实例化”为子代理。
-*   **强制收敛流 (Convergenc
```

**File**: `README.md` (modified, +26/-22)
```diff
@@ -2,10 +2,10 @@
 
 # Auto Company
 
-**A fully autonomous AI company running 24/7** <a href="README-ZH.md"><img alt="[中文说明]" src="https://img.shields.io/badge/%5B%E4%B8%AD%E6%96%87%E8%AF%B4%E6%98%8E%5D-2f3640.svg" /></a>
+**An AI company framework for continuous autonomous work** <a href="README-ZH.md"><img alt="[中文说明]" src="https://img.shields.io/badge/%5B%E4%B8%AD%E6%96%87%E8%AF%B4%E6%98%8E%5D-2f3640.svg" /></a>
 
-Powered by **Agentic Workflows**, this project orchestrates 14 **Autonomous AI Agents**, each modeled after world-class experts in their domain.
-They ideate products, make decisions, write code, deploy, and market - without human intervention.
+Powered by **Agentic Workflows**, this project provides 14 **AI agent role definitions**, each drawing on an expert's approach to its domain.
+The team can research products, make decisions, and write code autonomously within human-configured goals, permissions, and budgets. Deployment, publication, and marketing depend on the tools and authorization available; continuous operation depends on services and model availability.
 
 Powered by Claude Code (default) and [Codex CLI](https://www.npmjs.com/package/@openai/codex) on macOS + Windows/WSL, with a local dashboard on both hosts.
 
@@ -44,7 +44,7 @@ Four real ScopeFence product cycles: 04 is expanded; 03, 02 and 01 remain indivi
 
 ## What Is This?
 
-You start a loop. The AI team wakes up, reads shared consensus memory, decides what to do, forms a 3-5 person squad, executes, updates consensus memory, then sleeps briefly. Then it repeats.
+You start a loop. Each cycle reads the shared work summary, decides what to do, forms a team as needed, executes, updates the summary, and waits before the next cycle. Team creation depends on the model and engine capabilities; errors, budget limits, or a pause request can stop continuation.
 
 ```
 daemon (launchd / systemd --user, auto-restart on crash)
@@ -53,14 +53,14 @@ daemon (launchd / systemd --user, auto-restart on crash)
         ├── LLM CLI call (Codex CLI / Claude Code)
         │   ├── reads CLAUDE.md (charter + guardrails)
         │   ├── reads .claude/skills/team/SKILL.md (teaming method)
-        │   ├── forms an Agent Team (3-5 agents)
+        │   ├── forms an Agent Team as needed
         │   ├── executes: research, coding, deploy, marketing
-        │   └── updates memories/consensus.md (handoff baton)
+        │   └── updates memories/consensus.md (work summary)
         ├── failure handling: rate-limit wait / circuit breaker / consensus rollback
         └── sleep -> next cycle
 ```
 
-Each cycle is an independent CLI call. `memories/consensus.md` is the only cross-cycle state.
+Each cycle is an independent CLI call. `memories/consensus.md` is the main work summary loaded for the next cycle. Product files, repositories, configuration, identity records, logs, and usage data also persist across cycles.
 
 ## Generated Applications
 
@@ -106,7 +106,7 @@ All bundled skills are written in English; their user-facing work follows the pr
 | Usage and budgets | [Governance guide](docs/usage-governance.md) | [用量与预算治理](i18n/zh-CN/docs/usage-governance.md) |
 | Operations and troubleshooting | [Common tasks and errors](i18n/en/docs/troubleshooting.md) | [常见操作与排错](docs/troubleshooting.md) |
 
-## Team Lineup (14 Agents)
+## Team Lineup (14 Roles)
 
 This is not "you are a generic developer". It is "you are DHH" style role prompting with real expert mental models.
 
@@ -226,35 +226,35 @@ Auto-Company is not a simple LLM API wrapper, but a highly decoupled **Multi-Age
 │    [ Dashboard ]  [ File-based Steering (consensus.md) ]   │
 ├────────────────────────────────────────────────────────────┤
 │ 4. Workflow Routing & Teaming Layer                        │
-│    [ Dynamic Squad Routing ]  [ Forced Convergence Flow ]  │
+│    [ Role-based Teaming ]  [ Prompt Workflow Guidance ]   │
 ├────────────────────────────────────────────────────────────┤
 │ 3. Agentic Models & Cognition 
```

**File**: `dashboard/app.js` (modified, +1/-0)
```diff
@@ -540,6 +540,7 @@ OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
     finally { state.languageSaving = false; renderLanguage(); }
   }
   function unavailableArtifact(artifact) {
+    if (artifact.associationStatus === 'unknown') return message('artifactUnassociated');
     if (artifact.kind === 'preview') {
       return message(artifact.state === 'stopped' ? 'previewEnded' : artifact.state === 'interrupted' ? 'previewInterrupted' : 'previewUnavailable');
     }
```

**File**: `dashboard/i18n.js` (modified, +2/-0)
```diff
@@ -325,6 +325,7 @@ window.JOURNAL_MESSAGES = {
     "durationUnknown": "耗时未确认",
     "commandTruncated": "命令记录已截断。",
     "artifactStale": "文件已变更或缺失",
+    "artifactUnassociated": "尚未确认所属产品",
     "previewEnded": "预览已结束",
     "previewInterrupted": "预览已中断",
     "previewUnavailable": "预览不可用",
@@ -655,6 +656,7 @@ window.JOURNAL_MESSAGES = {
     "durationUnknown": "Duration unconfirmed",
     "commandTruncated": "The recorded command is truncated.",
     "artifactStale": "File changed or missing",
+    "artifactUnassociated": "Product association unconfirmed",
     "previewEnded": "Preview ended",
     "previewInterrupted": "Preview interrupted",
     "previewUnavailable": "Preview unavailable",
```

**File**: `dashboard/journal_data.py` (modified, +25/-15)
```diff
@@ -326,6 +326,19 @@ def document(self, relative: str) -> tuple[str, bool]:
             raise ValueError("Document is not an advertised artifact")
         return self.read(relative)
 
+    @staticmethod
+    def project_status(cycle, project, recorded_project):
+        # Paths describe historical locations; only the ledger can establish
+        # continuity across a move or distinguish a replacement at that path.
+        stable_id = cycle.get("stableProductId")
+        if cycle.get("identityKind") == "exploration":
+            stable_id = cycle.get("linkedProductId")
+        if stable_id:
+            return "current" if stable_id == project["stableId"] else "other"
+        if project["stableId"] or cycle.get("numbering") == "unavailable":
+            return "unknown"
+        return "current" if recorded_project and recorded_project == project["id"] else "other" if recorded_project else "unknown"
+
     def active_cycle(self, status: dict[str, Any]) -> dict[str, Any] | None:
         """Join a live loop to its reserved identity, never infer from log names."""
         loop = status.get("parsed", {}).get("loop", {})
@@ -515,10 +528,10 @@ def snapshot(self, *, status: dict[str, Any] | None = None,
                 elif cycle["events"]:
                     cycle["report"] = cycle["summary"] = ""
             reported_project = cycle.get("workReport", {}).get("project") if isinstance(cycle.get("workReport"), dict) else None
-            bound = [item for item in registered if item.get("cycleId") == cycle["id"]]
+            bound = [item for item in registered if item.get("cycleId") == cycle["id"] and item.get("associationStatus") == "bound"]
             context = cycle.get("projectIdentity") or self.cycle_context(cycle["id"])
             recorded_project = cycle.get("projectId")
-            artifact_projects = {item["project"] for item in bound}
+            artifact_projects = {item.get("recordedProject", item["project"]) for item in bound}
             if context["status"] == "recorded":
                 cycle_project = context["project"]
             elif context["status"] == "missing" and recorded_project:
@@ -534,22 +547,22 @@ def snapshot(self, *, status: dict[str, Any] | None = None,
             if cycle.get("identityKind") == "exploration" and cycle.get("linkedProductId") == project["stableId"] and project["stableId"]:
                 try:
                     if selected_project in cycle_projects(self.root, cycle["id"]):
-                        cycle_project = selected_project
-                        context = {"project": selected_project, "status": "recorded", "recordedAt": None,
-                                   "source": "product_cycle_ledger", "kind": "linked_exploration"}
+                        # Preserve the recorded product location for report
+                        # validation; the stable link decides current ownership.
+                        cycle_project = cycle_project or (next(iter(artifact_projects)) if len(artifact_projects) == 1 else selected_project)
+                        context = {"project": cycle_project, "status": "recorded", "recordedAt": None,
+                                   "source": "product_cycle_ledger", "kind": "linked_exploration",
+                                   "currentProject": selected_project}
                 except (OSError, ValueError, TypeError, KeyError):
                     warnings.append("exploration_association_unavailable")
             if cycle_project and reported_project and reported_project != cycle_project:
                 cycle["workReport"] = None
                 cycle["workReportStatus"] = "identity_mismatch"
             cycle["projectId"] = cycle_project
             cycle["projectIdentity"] = context
-            cycle["projectStatus"] = ("current" if cycle_project and cycle_project == selected_project else
-                                      "other" if cycle_project else "unknown")
-            if cycle.get("stableProductI
```

---

### Incident Patch 5: `a9685162` (2026-09-19)
**Commit Message**: Fix capture cancellation during process-state reads

**File**: `scripts/core/product_media.py` (modified, +14/-4)
```diff
@@ -347,21 +347,28 @@ def run_worker(project, profile, version, staging):
     atomic_json(staging / "request.json", request)
     command = [node, str(Path(__file__).with_name("product_media_worker.cjs")), str(staging / "request.json")]
     from product_media_process import ProcessScope
-    scope = ProcessScope(command)
-    process = scope.process
+    scope = None
     previous_signal = None
+    interrupted = False
     if threading.current_thread() is threading.main_thread():
         previous_signal = signal.getsignal(signal.SIGTERM)
 
         def interrupt_capture(_signal, _frame):
-            raise MediaError("capture_interrupted")
+            # Do not raise asynchronously: process-stat parsing catches
+            # ValueError, and a repeated signal must not interrupt teardown.
+            nonlocal interrupted
+            interrupted = True
 
         signal.signal(signal.SIGTERM, interrupt_capture)
     try:
+        scope = ProcessScope(command)
+        process = scope.process
         deadline = time.monotonic() + 45
         result_path = staging / "result.json"
         while not result_path.exists():
             scope.observe()
+            if interrupted:
+                raise MediaError("capture_interrupted")
             if process.poll() is not None:
                 raise MediaError("worker_terminated")
             if time.monotonic() >= deadline:
@@ -374,10 +381,13 @@ def interrupt_capture(_signal, _frame):
         return result
     finally:
         try:
-            stop_worker(scope)
+            if scope is not None:
+                stop_worker(scope)
         finally:
             if previous_signal is not None:
                 signal.signal(signal.SIGTERM, previous_signal)
+        if interrupted:
+            raise MediaError("capture_interrupted")
 
 
 def load_record(folder):
```

**File**: `tests/test_product_media.py` (modified, +68/-8)
```diff
@@ -22,7 +22,7 @@
                            content_version, digest, load_profile, media_folder, media_projection,
                            now, read_resource, validate_icon)
 from runtime_artifacts import finalize
-from product_media_process import ProcessScope
+from product_media_process import ProcessScope, proc_identity
 from product_icon_html import inspect_reference
 
 HEAD_REVIEW_CASES = {
@@ -637,21 +637,75 @@ def test_readiness_timeout_cleans_preview_and_does_not_publish_success(self):
 
     @unittest.skipIf(os.name == "nt", "POSIX SIGTERM cleanup is verified on Linux")
     def test_interrupted_capture_reaps_preview_without_waiting_for_watchdog(self):
+        self.assert_interrupted_capture_reaps_scope()
+
+    @unittest.skipUnless(Path("/proc").is_dir(), "Deterministic process-scan interruption requires Linux procfs")
+    def test_sigterm_during_process_scan_is_not_swallowed(self):
+        self.assert_interrupted_capture_reaps_scope(interrupt_scan=True)
+
+    def assert_interrupted_capture_reaps_scope(self, interrupt_scan=False):
         self.node_server(spawn_descendant=True)
         profile = load_profile(self.project)
         profile.update(readySelector="#never-present", timeoutSeconds=15)
         self.write_profile(profile)
         command = [sys.executable, str(ROOT / "scripts/core/runtime_artifacts.py"), "--root", str(self.root), "--project", self.name, "media"]
-        process = subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
+        if interrupt_scan:
+            # Deliver a real SIGTERM inside proc_identity's guarded stat read.
+            # A ValueError raised by the handler used to disappear there.
+            launcher = self.root / "interrupt-scan.py"
+            launcher.write_text("""import os, runpy, signal, sys, time
+from pathlib import Path
+original = Path.read_text
+root = Path(sys.argv[1])
+injected = False
+def read_stat(path, *args, **kwargs):
+    global injected
+    if not injected and path.name == 'stat' and path.parent.parent == Path('/proc') and (root / 'projects/example/.preview-port').exists():
+        injected = True
+        (root / 'scan-ready').touch()
+        deadline = time.monotonic() + 10
+        while not (root / 'interrupt-now').exists() and time.monotonic() < deadline:
+            time.sleep(0.01)
+        os.kill(os.getpid(), signal.SIGTERM)
+    return original(path, *args, **kwargs)
+Path.read_text = read_stat
+sys.argv = sys.argv[2:]
+sys.path.insert(0, str(Path(sys.argv[0]).parent))
+from product_media_process import ProcessScope
+close_scope = ProcessScope.close
+def interrupt_cleanup(scope):
+    os.kill(os.getpid(), signal.SIGTERM)
+    (root / 'cleanup-interrupted').touch()
+    return close_scope(scope)
+ProcessScope.close = interrupt_cleanup
+runpy.run_path(sys.argv[0], run_name='__main__')
+""", encoding="utf-8")
+            command = [sys.executable, str(launcher), str(self.root), *command[1:]]
+        sentinel = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
+        scope = ProcessScope(command)
+        process = scope.process
         try:
             deadline = time.monotonic() + 10
-            while not (self.project / ".preview-port").exists() and time.monotonic() < deadline and process.poll() is None:
+            ready = self.root / "scan-ready" if interrupt_scan else self.project / ".preview-port"
+            while not ready.exists() and time.monotonic() < deadline and process.poll() is None:
+                scope.observe()
                 time.sleep(0.05)
-            self.assertTrue((self.project / ".preview-port").exists())
+            self.assertTrue(ready.exists())
+            scope.observe()
+            owned = dict(scope.members)
+            browser_pids = [pid for pid in owned if (path := Path(f"/proc/{pid}/cmdline")).exists()
+                            and any(name in path.read_bytes() for name i
```

---

### Incident Patch 6: `e05c3751` (2026-09-19)
**Commit Message**: Align regression fixtures with project-bound evidence

**File**: `docs/runtime-observability.md` (modified, +6/-3)
```diff
@@ -97,9 +97,12 @@ a cycle, not an implicit side effect. The loop finalizes unfinished checks as
 interrupted after existing process supervision ends; an unknown end time stays
 null rather than being replaced by cleanup time.
 
-Artifact records live in `logs/artifacts/`. The reader bounds discovery to
-501 entries, checks the newest 100 of those, and exposes up to 20 records and
-three loopback checks per refresh. It is not an unlimited artifact archive.
+Artifact records live in `logs/artifacts/`. The reader enumerates filenames and
+keeps the newest 500 by modification time/name in a fixed-size heap. It reads
+only those 500 records, at most 16 KiB each, and exposes up to 100 records and
+three loopback checks per refresh. `scannedRecords` reports all candidate names;
+`partial`/`truncated` explicitly mark omitted or invalid evidence. This is not
+an unlimited artifact archive.
 Lifecycle cleanup streams all record filenames, reading at most 16 KiB per
 regular file and handling one record at a time. Display limits never cause a
 later cycle-owned process or unfinished check to be excluded from cleanup.
```

**File**: `tests/browser/journal.spec.js` (modified, +12/-2)
```diff
@@ -1,5 +1,6 @@
 import { test as base, expect } from "@playwright/test";
 import { spawn } from "node:child_process";
+import { createHash } from "node:crypto";
 import fs from "node:fs/promises";
 import net from "node:net";
 import os from "node:os";
@@ -56,7 +57,16 @@ const test = base.extend({
     }));
     await fs.writeFile(path.join(directory, ".auto-company.local"), "ACTIVE_PROJECT=projects/journal-fixture\nAUTO_COMPANY_LANGUAGE=zh-CN\n");
     await fs.writeFile(path.join(directory, ".auto-loop-state"), "STATUS=stopped\nENGINE=codex\nMODEL=gpt-6-astra\nLOOP_COUNT=3\n");
-    await fs.writeFile(path.join(directory, "DELIVERY.md"), "# Browser fixture delivery\nThis document stays read-only.\n");
+    const deliveryText = "# Browser fixture delivery\nThis document stays read-only.\n";
+    const deliveryPath = "projects/journal-fixture/DELIVERY.md";
+    await fs.writeFile(path.join(directory, deliveryPath), deliveryText);
+    await fs.mkdir(path.join(directory, "logs/artifacts"), { recursive: true });
+    const recordedAt = new Date().toISOString();
+    await fs.writeFile(path.join(directory, "logs/artifacts/delivery.json"), JSON.stringify({
+      version: 1, id: "a".repeat(32), kind: "document", project: "projects/journal-fixture",
+      cycleId: cycles.at(-1).cycle_id, recordedAt, modifiedAt: recordedAt, source: "runner",
+      path: deliveryPath, sha256: createHash("sha256").update(deliveryText).digest("hex"),
+    }));
     // Exercise the optional backup route without relying on private local files
     // or keeping a second production dashboard in the repository.
     const legacyDirectory = path.join(directory, "legacy-backup");
@@ -142,7 +152,7 @@ test("usage preserves unknown coverage and artifacts open through the real serve
   await page.locator("#tab-usage").click();
   await expect(page.locator("body")).toContainText(/部分|未知|不完整/);
   await page.locator("#tab-work").click();
-  const delivery = page.locator('#projectSidebar a[href="/api/journal/document?path=DELIVERY.md"]');
+  const delivery = page.locator('#projectSidebar a[href="/api/journal/document?path=projects%2Fjournal-fixture%2FDELIVERY.md"]');
   await expect(delivery.first()).toBeVisible();
   const response = await page.request.get(new URL(await delivery.first().getAttribute("href"), journal.url).href);
   expect(response.ok()).toBeTruthy();
```

**File**: `tests/test_engine_adapters.py` (modified, +1/-1)
```diff
@@ -287,7 +287,7 @@ def test_loop_provider_error_exit_zero_is_recorded_as_failure(self) -> None:
         record = json.loads(ledger.read_text().splitlines()[0])
         self.assertEqual(record["status"], "failed")
         self.assertEqual(record["usage"]["total_tokens"], 3)
-        sidecar = json.loads(next((self.workspace / "logs").glob("cycle-*.json")).read_text())
+        sidecar = json.loads((self.workspace / "logs" / f"{record['cycle_id']}.json").read_text())
         self.assertEqual(sidecar["cycle_outcome"], "failure")
         self.assertIn("Adapter reported error", sidecar["failure_reason"])
 
```

---

### Incident Patch 7: `efd3fd75` (2026-09-19)
**Commit Message**: test: include cycle report reader in browser fixture

**File**: `docs/runtime-observability.md` (modified, +10/-7)
```diff
@@ -1,4 +1,4 @@
-# Runtime observations (local prototype)
+# Runtime observations and cycle work reports
 
 The Codex adapter projects its JSONL stream into `logs/<cycle-id>.events.jsonl`.
 The dashboard reads that stream while the cycle runs. No extra model calls or
@@ -53,16 +53,19 @@ require separate runner integration. A preview started inside a model cycle is
 owned by that cycle and ends during normal supervisor cleanup; keeping a preview
 alive is a separate operator action, not an implicit cycle side effect.
 
-Artifact records live in `logs/artifacts/`. The prototype bounds discovery to
+Artifact records live in `logs/artifacts/`. The reader bounds discovery to
 501 entries, checks the newest 100 of those, and exposes up to 20 records and
 three loopback checks per refresh. It is not an unlimited artifact archive.
 
-## Verification model
+## Verification settings
 
-`MODEL=gpt-5.6-luna CODEX_REASONING_EFFORT=high ENGINE=codex`.
-This is the local experiment's policy in ignored `AGENTS.md`; it is not a new
-production default. `CODEX_REASONING_EFFORT` is optional and does not substitute
-for observed configuration in the dashboard.
+Continuous-cycle verification covered both `MODEL=gpt-5.6-luna` and
+`MODEL=gpt-5.6-terra`, each with `CODEX_REASONING_EFFORT=high ENGINE=codex`.
+Each model completed three successive cycles with distinct session identities,
+live and final work reports, preserved historical reports and registered checks.
+These are bounded local verification settings, not new production defaults or a
+long-term reliability guarantee. `CODEX_REASONING_EFFORT` is optional and does
+not substitute for observed configuration in the dashboard.
 
 ## Cycle work report v1
 
```

**File**: `tests/browser/fixture-server.py` (modified, +1/-1)
```diff
@@ -50,7 +50,7 @@ def main():
         shutil.copytree(REPO_ROOT / "dashboard", root / "dashboard")
         core = root / "scripts/core"
         core.mkdir(parents=True)
-        for name in ("localization.py", "usage_lib.py"):
+        for name in ("localization.py", "usage_lib.py", "cycle_reports.py"):
             shutil.copy2(REPO_ROOT / "scripts/core" / name, core / name)
         (root / "memories").mkdir()
         (root / "memories/consensus.md").write_text(
```

---

### Incident Patch 8: `6b632b53` (2026-09-18)
**Commit Message**: fix(runtime): confirm stop cleanup and preserve interrupted cycle evidence

**File**: `.gitignore` (modified, +2/-0)
```diff
@@ -145,6 +145,8 @@ logs/
 .auto-loop-awake.pid
 .auto-loop-awake.stop
 .auto-loop-wsl-anchor.pid
+.auto-loop-wsl-anchor.linux
+.auto-loop-stop-pending
 .auto-loop-wsl-anchor.stop
 memories/consensus.md.bak
 
```

**File**: `dashboard/app.js` (modified, +13/-9)
```diff
@@ -22,11 +22,11 @@
     return text.length > length ? `${text.slice(0, length).trim()}…` : text;
   }
   function statusLabel(status) {
-    return ['completed', 'completed_with_timeout', 'failed', 'interrupted', 'stopped_status', 'running', 'idle', 'paused', 'waiting_limit', 'circuit_break', 'stopped', 'active', 'inactive', 'configured', 'not_configured', 'not_installed', 'mismatched', 'activating', 'deactivating', 'reloading', 'unsupported'].includes(status) ? message(status) : status === 'unavailable' ? message('statusUnavailable') : message('unknown');
+    return ['stopping', 'stop_failed', 'completed', 'completed_with_timeout', 'failed', 'interrupted', 'stopped_status', 'running', 'idle', 'paused', 'waiting_limit', 'circuit_break', 'stopped', 'active', 'inactive', 'configured', 'not_configured', 'not_installed', 'mismatched', 'activating', 'deactivating', 'reloading', 'unsupported'].includes(status) ? message(status) : status === 'unavailable' ? message('statusUnavailable') : message('unknown');
   }
   function readOnly() { return state.data?.readOnly !== false; }
   function liveProcess() { return !readOnly() && !state.statusFailed && state.data?.runtime?.processState === 'running'; }
-  function runtimeLabel() { return statusLabel(state.statusFailed ? 'unavailable' : state.data?.runtime?.state); }
+  function runtimeLabel() { return statusLabel(state.action === 'stop' ? 'stopping' : state.data?.control?.stopUnconfirmed ? (state.data?.control?.action === 'stop' ? 'stopping' : 'stop_failed') : state.statusFailed ? 'unavailable' : state.data?.runtime?.state); }
   function pauseLabel(value) { return message(`pause_${value}`) === `pause_${value}` ? String(value || '') : message(`pause_${value}`); }
   async function fetchJSON(url, options = {}, timeout = 100000) {
     const controller = new AbortController();
@@ -261,13 +261,15 @@
     const runtime = data?.runtime || {};
     const unavailable = state.statusFailed || runtime.available === false;
     const process = runtime.processState || runtime.state;
-    const locked = !data || readOnly() || unavailable || Boolean(state.action);
+    const action = state.action || data?.control?.action;
+    const retryStop = data?.control?.stopUnconfirmed === true;
+    const locked = !data || readOnly() || (unavailable && !retryStop) || Boolean(action);
     $('runtimeState').textContent = runtimeLabel();
     $('runtimeState').dataset.state = unavailable ? 'unavailable' : runtime.state || 'unknown';
-    $('startButton').disabled = locked || !['stopped', 'inactive'].includes(process);
-    $('stopButton').disabled = locked || process !== 'running';
-    $('startButton').textContent = message(state.action === 'start' ? 'starting' : 'start');
-    $('stopButton').textContent = message(state.action === 'stop' ? 'stopping' : 'stop');
+    $('startButton').disabled = locked || retryStop || !['stopped', 'inactive'].includes(process);
+    $('stopButton').disabled = locked || (!retryStop && process !== 'running');
+    $('startButton').textContent = message(action === 'start' ? 'starting' : 'start');
+    $('stopButton').textContent = message(action === 'stop' ? 'stopping' : 'stop');
     $('startButton').title = $('stopButton').title = readOnly() ? message('readOnly') : unavailable ? message('statusUnavailable') : '';
     $('refreshButton').disabled = Boolean(state.refreshPending || state.action);
     $('modeNote').textContent = data ? message(readOnly() ? 'preview' : 'live') : '';
@@ -633,17 +635,19 @@
     clearTimeout(state.timer);
     renderRuntime();
     actionMessage('actionPending', { action: message(action) });
-    if (state.refreshPending) await state.refreshPending;
+    if (action === 'start' && state.refreshPending) await state.refreshPending;
     try {
       // Recheck after any in-flight status read before mutating the runtime.
       const process = state.data?.runtime?.processState || state.data?.runtime?.state;
-      if (readOnly() || state.statusFailed || (a
```

**File**: `dashboard/i18n.js` (modified, +2/-0)
```diff
@@ -129,6 +129,7 @@ window.JOURNAL_MESSAGES = {
     "stop": "停止运行",
     "starting": "正在启动…",
     "stopping": "正在停止…",
+    "stop_failed": "停止未完成，请重试停止",
     "running": "运行中",
     "idle": "等待下一轮",
     "paused": "已暂停",
@@ -344,6 +345,7 @@ window.JOURNAL_MESSAGES = {
     "stop": "Stop run",
     "starting": "Starting…",
     "stopping": "Stopping…",
+    "stop_failed": "Stop incomplete — retry Stop",
     "running": "Running",
     "idle": "Waiting for next cycle",
     "paused": "Paused",
```

**File**: `dashboard/server.py` (modified, +32/-0)
```diff
@@ -14,6 +14,7 @@
 import subprocess
 import sys
 import time
+import threading
 from datetime import datetime, timezone
 from http import HTTPStatus
 from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
@@ -50,6 +51,9 @@
 CONSENSUS_FILE = REPO_ROOT / "memories" / "consensus.md"
 BUDGET_PAUSE_FILE = REPO_ROOT / ".auto-loop-budget-paused"
 
+CONTROL_LOCK = threading.Lock()
+CONTROL_ACTION = ""
+
 WINDOWS_HOST = "windows"
 MACOS_HOST = "macos"
 LINUX_HOST = "linux"
@@ -614,6 +618,12 @@ def gather_journal_payload() -> dict[str, Any]:
     except (OSError, ValueError):
         payload["budgetPause"] = None
         payload["warnings"].append("budget_pause_unavailable")
+    # Keep cleanup failures visible after reload, even if the model already exited.
+    control = {"action": CONTROL_ACTION,
+               "stopUnconfirmed": (REPO_ROOT / ".auto-loop-stop-pending").exists()}
+    payload["control"] = control
+    if control["action"] == "stop" or control["stopUnconfirmed"]:
+        payload["runtime"]["state"] = "stopping" if control["action"] == "stop" else "stop_failed"
     return payload
 
 
@@ -752,6 +762,7 @@ def do_GET(self) -> None:  # noqa: N802
         self._text("Not found", code=404)
 
     def do_POST(self) -> None:  # noqa: N802
+        global CONTROL_ACTION
         if not self._request_allowed():
             return
         if self.headers.get("Content-Type", "").split(";", 1)[0] != "application/json":
@@ -781,12 +792,33 @@ def do_POST(self) -> None:  # noqa: N802
             return
 
         action = path.rsplit("/", 1)[-1]
+        mutating = action in {"start", "stop"}
+        if mutating and not CONTROL_LOCK.acquire(blocking=False):
+            self._json({"ok": False, "error": "A runtime action is already in progress."},
+                       code=HTTPStatus.CONFLICT)
+            return
+        pending = REPO_ROOT / ".auto-loop-stop-pending"
         try:
+            if action == "start" and pending.exists():
+                self._json({"ok": False, "error": "Stop cleanup is unconfirmed. Retry Stop first."},
+                           code=HTTPStatus.CONFLICT)
+                return
+            if mutating:
+                CONTROL_ACTION = action
+            if action == "stop":
+                pending.write_text("stopping\n", encoding="utf-8")
+                (REPO_ROOT / ".auto-loop-stop").touch()
             result = run_dashboard_action(action)
+            if action == "stop" and result["ok"]:
+                pending.unlink(missing_ok=True)
         except (subprocess.TimeoutExpired, OSError) as exc:
             self._json({"ok": False, "output": f"Dashboard action failed: {exc}"},
                        code=HTTPStatus.GATEWAY_TIMEOUT)
             return
+        finally:
+            if mutating:
+                CONTROL_ACTION = ""
+                CONTROL_LOCK.release()
         payload = {
             "timestamp": datetime.now(timezone.utc).isoformat(),
             "action": action,
```

**File**: `scripts/core/auto-loop.sh` (modified, +19/-0)
```diff
@@ -261,6 +261,25 @@ cleanup() {
         final_state="process_cleanup_failed"
         log "Process-tree cleanup could not be confirmed for cycle PGID ${CYCLE_SUPERVISOR_LAST_PGID}"
     else
+        # A signal interrupts adapter_execute before it can publish its output.
+        # Preserve already emitted evidence after the owned process tree exits.
+        if [ -n "${ADAPTER_OUTPUT_FILE:-}" ] && [ -f "$ADAPTER_OUTPUT_FILE" ] &&
+           [ -f "${USAGE_FILE}.pending" ]; then
+            ADAPTER_OUTPUT=$(adapter_redact < "$ADAPTER_OUTPUT_FILE")
+            printf '%s\n' "$ADAPTER_OUTPUT" > "$cycle_log"
+            ADAPTER_RESULT_SOURCE="$ADAPTER_OUTPUT"
+            ADAPTER_EXIT_CODE=130
+            ADAPTER_TIMED_OUT=0
+            engine_adapter_extract_metadata
+            cycle_record="${cycle_log%.log}.json"
+            engine_adapter_write_record "$cycle_record" interrupted "Stopped by operator"
+            cycle_ended_at=$(date '+%Y-%m-%dT%H:%M:%S%z')
+            CYCLE_LEDGER_STATUS=interrupted
+            EXIT_CODE=130
+            record_cycle_usage >/dev/null
+            rm -f "$ADAPTER_OUTPUT_FILE"
+            ADAPTER_OUTPUT_FILE=""
+        fi
         # The engine must be stopped before restoring its interrupted governance baseline.
         "$CONSENSUS_GUARD" recover || true
     fi
```

---

### Incident Patch 9: `3c3eba19` (2026-09-18)
**Commit Message**: test: include journal module in isolated macOS fixtures

**File**: `tests/test_launchd_installation.py` (modified, +2/-1)
```diff
@@ -43,7 +43,8 @@ def setUp(self):
         self.plist.parent.mkdir(parents=True)
         shutil.copytree(REPO / "scripts", self.project / "scripts")
         (self.project / "dashboard").mkdir()
-        shutil.copy2(REPO / "dashboard/server.py", self.project / "dashboard/server.py")
+        for name in ("server.py", "journal_data.py"):
+            shutil.copy2(REPO / "dashboard" / name, self.project / "dashboard" / name)
         for relative in ("scripts/core/launchd-config.py", "scripts/core/stop-loop.sh",
                          "scripts/macos/install-daemon.sh", "scripts/macos/start-daemon.sh",
                          "scripts/macos/launchd-job.py"):
```

**File**: `tests/test_macos_start.py` (modified, +2/-1)
```diff
@@ -28,7 +28,8 @@ def setUp(self):
         self.project = self.root / 'Repo & "trial"'
         shutil.copytree(REPO / "scripts", self.project / "scripts")
         (self.project / "dashboard").mkdir()
-        shutil.copy2(REPO / "dashboard/server.py", self.project / "dashboard/server.py")
+        for name in ("server.py", "journal_data.py"):
+            shutil.copy2(REPO / "dashboard" / name, self.project / "dashboard" / name)
         self.home = self.root / "home"
         self.plist = self.home / f"Library/LaunchAgents/{LABEL}.plist"
         self.plist.parent.mkdir(parents=True)
```

---

### Incident Patch 10: `7c771b80` (2026-09-18)
**Commit Message**: fix: support macOS Bash and isolate native test exit codes

**File**: `.github/workflows/auto-company-runtime-ci.yml` (modified, +1/-0)
```diff
@@ -122,6 +122,7 @@ jobs:
           python3 -m unittest discover -s tests -p test_daemon_installers.py -v
           python3 -m unittest discover -s tests -p test_macos_start.py -v
           python3 -m unittest discover -s tests -p test_log_rotation.py -v
+          python3 -m unittest discover -s tests -p test_ui_messages.py -v
 
       - name: Verify Dashboard Start with a real isolated LaunchAgent
         env:
```

**File**: `scripts/core/ui-messages.sh` (modified, +4/-3)
```diff
@@ -5,13 +5,14 @@ UI_MESSAGES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
 ui_message() {
     local key="$1" value
     shift
-    local arguments=()
+    # Bash 3.2 (macOS) treats an empty array as unset under `set -u`.
+    # Keep fixed arguments in the array so zero-placeholder messages are safe.
+    local arguments=(message --root "${PROJECT_DIR:-$UI_MESSAGES_DIR/../..}" --key "$key")
     for value in "$@"; do
         arguments+=("--arg=$value")
     done
     if command -v python3 >/dev/null 2>&1 && \
-        python3 "$UI_MESSAGES_DIR/localization.py" message \
-            --root "${PROJECT_DIR:-$UI_MESSAGES_DIR/../..}" --key "$key" "${arguments[@]}"; then
+        python3 "$UI_MESSAGES_DIR/localization.py" "${arguments[@]}"; then
         return 0
     fi
     # Python is unavailable: keep dependency diagnostics useful without hiding
```

**File**: `tests/test_ui_messages.py` (modified, +16/-0)
```diff
@@ -106,6 +106,22 @@ def test_check_keeps_exact_machine_language_output(self):
         self.assertEqual(result.stdout, "")
         self.assertIn("Check AUTO_COMPANY_LANGUAGE", result.stderr)
 
+    @unittest.skipUnless(os.name == "posix" and Path("/bin/bash").exists(), "Native POSIX Bash")
+    def test_native_bash_nounset_handles_messages_with_and_without_parameters(self):
+        # /bin/bash is 3.2 on macOS; empty arrays there differ from modern Bash.
+        command = ["/bin/bash", "-uc",
+                   'source "$1/scripts/core/ui-messages.sh"; PROJECT_DIR="$1"; '
+                   'ui_message loop.stopping; ui_message language.saved en',
+                   "message-test", str(ROOT)]
+        for language, saved in (("en", "Saved AUTO_COMPANY_LANGUAGE=en"),
+                                ("zh-CN", "已保存 AUTO_COMPANY_LANGUAGE=en")):
+            result = subprocess.run(command, env=dict(self.env, AUTO_COMPANY_LANGUAGE=language),
+                                    capture_output=True, text=True, encoding="utf-8", timeout=10)
+            self.assertEqual(result.returncode, 0, result.stderr)
+            self.assertEqual(len(result.stdout.splitlines()), 2)
+            self.assertIn(saved, result.stdout)
+            self.assertEqual(result.stderr, "")
+
 
 @unittest.skipUnless(os.name == "posix" and sys.platform == "linux", "Linux/WSL entrypoint fixtures")
 class ShellOperatorMessageTests(unittest.TestCase):
```

**File**: `tests/test_windows_messages.ps1` (modified, +3/-0)
```diff
@@ -259,3 +259,6 @@ try {
 
 Write-Host "Windows message checks: $($script:checks - $script:failures.Count) passed, $($script:failures.Count) failed, 0 skipped"
 if ($script:failures.Count) { throw ($script:failures -join "`n") }
+# The final case deliberately sets a failing native code. Report the assertions'
+# result to CI, whose PowerShell wrapper exits with the last native exit code.
+$global:LASTEXITCODE = 0
```

#### Recent Merged Pull Requests:
- **PR #40** (2026-09-27): Release v2.0.0: Product Center (@MaxMiksa)
- **PR #39** (closed): feat: bilingual guided installation and managed release packages (@MaxMiksa)
- **PR #38** (2026-09-23): Release v1.6.1: protect P1 consensus and runtime ownership (@MaxMiksa)
- **PR #37** (2026-09-19): Release v1.6.0: continuous product cycles and real previews (@MaxMiksa)
- **PR #36** (2026-09-19): Release v1.5.0: traceable cycle journal and recorded artifacts (@MaxMiksa)
- **PR #35** (2026-09-19): feat: show structured cycle progress and confirm stop cleanup (@MaxMiksa)
- **PR #34** (2026-09-18): feat: release v1.4.0 with cycle journal dashboard (@MaxMiksa)
- **PR #33** (closed): test: verify CI gate and failure evidence (do not merge) (@MaxMiksa)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
