# Forensic Learning Record (Deep Inspection): unclecode/crawl4ai

> **Canonical Artifact**: `07_PROJECT_LEARNING/unclecode-crawl4ai-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/unclecode/crawl4ai](https://github.com/unclecode/crawl4ai))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:54:24.279Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `unclecode/crawl4ai`
- **Description**: Open-source web crawler and scraper for LLMs and AI agents: any website into clean, LLM-ready Markdown. Run it yourself, or use Crawl4AI Cloud with one key.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 84785 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crawl4ai/deep_crawling/scorers.py`
```
from abc import ABC, abstractmethod
from typing import List, Dict, Optional
from dataclasses import dataclass
from urllib.parse import urlparse, unquote
import re
import logging
from functools import lru_cache
from array import array
import ctypes
import platform
PLATFORM = platform.system()

# Pre-computed scores for common year differences
_SCORE_LOOKUP = [1.0, 0.5, 0.3333333333333333, 0.25]

# Pre-computed scores for common year differences
_FRESHNESS_SCORES = [
   1.0,    # Current year
   0.9,    # Last year
   0.8,    # 2 years ago
   0.7,    # 3 years ago
   0.6,    # 4 years ago
   0.5,    # 5 years ago
]

class ScoringStats:
    __slots__ = ('_urls_scored', '_total_score', '_min_score', '_max_score')
    
    def __init__(self):
        self._urls_scored = 0
        self._total_score = 0.0
        self._min_score = None  # Lazy initialization
        self._max_score = None
    
    def update(self, score: float) -> None:
        """Optimized update with minimal operations"""
        self._urls_scored += 1
        self._total_score += score
        
        # Lazy min/max tracking - only if actually accessed
        if self._min_score is not None:
            if score < self._min_score:
                self._min_score = score
        if self._max_score is not None:
            if score > self._max_score:
                self._max_score = score
                
    def get_average(self) -> float:
        """Direct calculation instead of property"""
        return self._total_score / self._urls_scored if self._urls_scored else 0.0
    
    def get_min(self) -> float:
        """Lazy min calculation"""
        if self._min_score is None:
            self._min_score = self._total_score / self._urls_scored if self._urls_scored else 0.0
        return self._min_score
        
    def get_max(self) -> float:
        """Lazy max calculation"""
        if self._max_score is None:
            self._max_score = self._total_score / self._urls_scored if self._urls_scored else 0.0
        return self._max_score
class URLScorer(ABC):
    __slots__ = ('_weight', '_stats')
    
    def __init__(self, weight: float = 1.0):
        # Store weight directly as float32 for memory efficiency
        self._weight = ctypes.c_float(weight).value
        self._stats = ScoringStats()
    
    @abstractmethod
    def _calculate_score(self, url: str) -> float:
        """Calculate raw score for URL."""
        pass
    
    def score(self, url: str) -> float:
        """Calculate weighted score with minimal overhead."""
        score = self._calculate_score(url) * self._weight
        self._stats.update(score)
        return score
    
    @property
    def stats(self):
        """Access to scoring statistics."""
        return self._stats
    
    @property
    def weight(self):
        return self._weight

class CompositeScorer(URLScorer):
    __slots__ = ('_scorers', '_normalize', '_weights_array', '_score_array')
    
    def __init__(self, scorers: List[URLScorer], normalize: bool = True):
        """Initialize composite scorer combining multiple scoring strategies.
        
        Optimized for:
        - Fast parallel scoring
        - Memory efficient score aggregation
        - Quick short-circuit conditions
        - Pre-allocated arrays
        
        Args:
            scorers: List of scoring strategies to combine
            normalize: Whether to normalize final score by scorer count
        """
        super().__init__(weight=1.0)
        self._scorers = scorers
        self._normalize = normalize
        
        # Pre-allocate arrays for scores and weights
        self._weights_array = array('f', [s.weight for s in scorers])
        self._score_array = array('f', [0.0] * len(scorers))

    @lru_cache(maxsize=10000)
    def _calculate_score(self, url: str) -> float:
        """Calculate combined score from all scoring strategies.
        
        Uses:
        1. Pre-allocated arrays for scores
        2. Short-circuit on zero scores
        3. Optimized normalization
        4. Vectorized operations where possible
        
        Args:
            url: URL to score
            
        Returns:
            Combined and optionally normalized score
        """
        total_score = 0.0
        scores = self._score_array
        
        # Get scores from all scorers
        for i, scorer in enumerate(self._scorers):
            # Use public score() method which applies weight
            scores[i] = scorer.score(url)
            total_score += scores[i]
            
        # Normalize if requested
        if self._normalize and self._scorers:
            count = len(self._scorers)
            return total_score / count
            
        return total_score

    def score(self, url: str) -> float:
        """Public scoring interface with stats tracking.
        
        Args:
            url: URL to score
            
        Returns:
            Final combined score
        """
        score = self._calculate_score(url)
        self.stats.update(score)
        return score

class KeywordRelevanceScorer(URLScorer):
    __slots__ = ('_weight', '_stats', '_keywords', '_case_sensitive')
    
    def __init__(self, keywords: List[str], weight: float = 1.0, case_sensitive: bool = False):
        super().__init__(weight=weight)
        self._case_sensitive = case_sensitive
        # Pre-process keywords once
        self._keywords = [k if case_sensitive else k.lower() for k in keywords]
    
    @lru_cache(maxsize=10000)
    def _url_bytes(self, url: str) -> bytes:
        """Cache decoded URL bytes"""
        return url.encode('utf-8') if self._case_sensitive else url.lower().encode('utf-8')
    
    
    def _calculate_score(self, url: str) -> float:
        """Fast string matching without regex or byte conversion"""
        if not self._case_sensitive:
            url = url.lower()
            
        matches = sum(1 for k in self._keywords if k in url)
        
        # Fast return paths
        if not matches:
            return 0.0
        if matches == len(self._keywords):
            return 1.0
            
        return matches / len(self._keywords)

class PathDepthScorer(URLScorer):
    __slots__ = ('_weight', '_stats', '_optimal_depth')  # Remove _url_cache
    
    def __init__(self, optimal_depth: int = 3, weight: float = 1.0):
        super().__init__(weight=weight)
        self._optimal_depth = optimal_depth

    @staticmethod
    @lru_cache(maxsize=10000)
    def _quick_depth(path: str) -> int:
        """Ultra fast path depth calculation.
        
        Examples:
            - "http://example.com" -> 0  # No path segments
            - "http://example.com/" -> 0  # Empty path
            - "http://example.com/a" -> 1
            - "http://example.com/a/b" -> 2
        """
        if not path or path == '/':
            return 0
            
        if '/' not in path:
            return 0
            
        depth = 0
        last_was_slash = True
        
        for c in path:
            if c == '/':
                if not last_was_slash:
                    depth += 1
                last_was_slash = True
            else:
                last_was_slash = False
                
        if not last_was_slash:
            depth += 1
            
        return depth

    @lru_cache(maxsize=10000)  # Cache the whole calculation
    def _calculate_score(self, url: str) -> float:
        pos = url.find('/', url.find('://') + 3)
        if pos == -1:
            depth = 0
        else:
            depth = self._quick_depth(url[pos:])
            
        # Use lookup table for common distances
        distance = depth - self._optimal_depth
        distance = distance if distance >= 0 else -distance  # Faster than abs()
        
        if distance < 4:
            return _SCORE_LOOKUP[distance]
            
        return 1.0 / (1.0 + distance)                                             

class ContentTypeScorer(URLScorer):
    __slots__ = ('_weight', '_exact_types', '_regex_types')

    def __init__(self, type_weights: Dict[str, float], weight: float = 1.0):
        """Initialize scorer with type weights map.
        
        Args:
            type_weights: Dict mapping file extensions/patterns to scores (e.g. {'.html$': 1.0})
            weight: Overall weight multiplier for this scorer
        """
        super().__init__(weight=weight)
        self._exact_types = {}  # Fast lookup for simple extensions
        self._regex_types = []  # Fallback for complex patterns
        
        # Split into exact vs regex matchers for performance
        for pattern, score in type_weights.items():
            if pattern.startswith('.') and pattern.endswith('$'):
                ext = pattern[1:-1]
                self._exact_types[ext] = score
            else:
                self._regex_types.append((re.compile(pattern), score))
                
        # Sort complex patterns by score for early exit
        self._regex_types.sort(key=lambda x: -x[1])

    @staticmethod
    @lru_cache(maxsize=10000)
    def _quick_extension(url: str) -> str:
        """Extract file extension ultra-fast without regex/splits.
        
        Handles:
        - Basic extensions: "example.html" -> "html"
        - Query strings: "page.php?id=1" -> "php" 
        - Fragments: "doc.pdf#page=1" -> "pdf"
        - Path params: "file.jpg;width=100" -> "jpg"
        
        Args:
            url: URL to extract extension from
            
        Returns:
            Extension without dot, or empty string if none found
        """
        pos = url.rfind('.')
        if pos == -1:
            return ''
        
        # Find first non-alphanumeric char after extension
        end = len(url)
        for i in range(pos + 1, len(url)):
            c = url[i]
            # Stop at query string, fragment, path param or any non-alphanumeric
            if c in '?#;' or not c.isalnum():
                end = i
                break

```

### Core Architecture Module: `crawl4ai/html2text/utils.py`
```
import html.entities
from typing import Dict, List, Optional

from . import config

unifiable_n = {
    html.entities.name2codepoint[k]: v
    for k, v in config.UNIFIABLE.items()
    if k != "nbsp"
}


def hn(tag: str) -> int:
    if tag[0] == "h" and len(tag) == 2:
        n = tag[1]
        if "0" < n <= "9":
            return int(n)
    return 0


def dumb_property_dict(style: str) -> Dict[str, str]:
    """
    :returns: A hash of css attributes
    """
    return {
        x.strip().lower(): y.strip().lower()
        for x, y in [z.split(":", 1) for z in style.split(";") if ":" in z]
    }


def dumb_css_parser(data: str) -> Dict[str, Dict[str, str]]:
    """
    :type data: str

    :returns: A hash of css selectors, each of which contains a hash of
    css attributes.
    :rtype: dict
    """
    # remove @import sentences
    data += ";"
    importIndex = data.find("@import")
    while importIndex != -1:
        data = data[0:importIndex] + data[data.find(";", importIndex) + 1 :]
        importIndex = data.find("@import")

    # parse the css. reverted from dictionary comprehension in order to
    # support older pythons
    pairs = [x.split("{") for x in data.split("}") if "{" in x.strip()]
    try:
        elements = {a.strip(): dumb_property_dict(b) for a, b in pairs}
    except ValueError:
        elements = {}  # not that important

    return elements


def element_style(
    attrs: Dict[str, Optional[str]],
    style_def: Dict[str, Dict[str, str]],
    parent_style: Dict[str, str],
) -> Dict[str, str]:
    """
    :type attrs: dict
    :type style_def: dict
    :type style_def: dict

    :returns: A hash of the 'final' style attributes of the element
    :rtype: dict
    """
    style = parent_style.copy()
    if "class" in attrs:
        assert attrs["class"] is not None
        for css_class in attrs["class"].split():
            css_style = style_def.get("." + css_class, {})
            style.update(css_style)
    if "style" in attrs:
        assert attrs["style"] is not None
        immediate_style = dumb_property_dict(attrs["style"])
        style.update(immediate_style)

    return style


def google_list_style(style: Dict[str, str]) -> str:
    """
    Finds out whether this is an ordered or unordered list

    :type style: dict

    :rtype: str
    """
    if "list-style-type" in style:
        list_style = style["list-style-type"]
        if list_style in ["disc", "circle", "square", "none"]:
            return "ul"

    return "ol"


def google_has_height(style: Dict[str, str]) -> bool:
    """
    Check if the style of the element has the 'height' attribute
    explicitly defined

    :type style: dict

    :rtype: bool
    """
    return "height" in style


def google_text_emphasis(style: Dict[str, str]) -> List[str]:
    """
    :type style: dict

    :returns: A list of all emphasis modifiers of the element
    :rtype: list
    """
    emphasis = []
    if "text-decoration" in style:
        emphasis.append(style["text-decoration"])
    if "font-style" in style:
        emphasis.append(style["font-style"])
    if "font-weight" in style:
        emphasis.append(style["font-weight"])

    return emphasis


def google_fixed_width_font(style: Dict[str, str]) -> bool:
    """
    Check if the css of the current element defines a fixed width font

    :type style: dict

    :rtype: bool
    """
    font_family = ""
    if "font-family" in style:
        font_family = style["font-family"]
    return "courier new" == font_family or "consolas" == font_family


def list_numbering_start(attrs: Dict[str, Optional[str]]) -> int:
    """
    Extract numbering from list element attributes

    :type attrs: dict

    :rtype: int or None
    """
    if "start" in attrs:
        assert attrs["start"] is not None
        try:
            return int(attrs["start"]) - 1
        except ValueError:
            pass

    return 0


def skipwrap(
    para: str, wrap_links: bool, wrap_list_items: bool, wrap_tables: bool
) -> bool:
    # If it appears to contain a link
    # don't wrap
    if not wrap_links and config.RE_LINK.search(para):
        return True
    # If the text begins with four spaces or one tab, it's a code block;
    # don't wrap
    if para[0:4] == "    " or para[0] == "\t":
        return True

    # If the text begins with only two "--", possibly preceded by
    # whitespace, that's an emdash; so wrap.
    stripped = para.lstrip()
    if stripped[0:2] == "--" and len(stripped) > 2 and stripped[2] != "-":
        return False

    # I'm not sure what this is for; I thought it was to detect lists,
    # but there's a <br>-inside-<span> case in one of the tests that
    # also depends upon it.
    if stripped[0:1] in ("-", "*") and not stripped[0:2] == "**":
        return not wrap_list_items

    # If text contains a pipe character it is likely a table
    if not wrap_tables and config.RE_TABLE.search(para):
        return True

    # If the text begins with a single -, *, or +, followed by a space,
    # or an integer, followed by a ., followed by a space (in either
    # case optionally proceeded by whitespace), it's a list; don't wrap.
    return bool(
        config.RE_ORDERED_LIST_MATCHER.match(stripped)
        or config.RE_UNORDERED_LIST_MATCHER.match(stripped)
    )


def escape_md(text: str) -> str:
    """
    Escapes markdown-sensitive characters within other markdown
    constructs.
    """
    return config.RE_MD_CHARS_MATCHER.sub(r"\\\1", text)


def escape_md_section(
    text: str,
    escape_backslash: bool = True,
    snob: bool = False,
    escape_dot: bool = True,
    escape_plus: bool = True,
    escape_dash: bool = True,
) -> str:
    """
    Escapes markdown-sensitive characters across whole document sections.
    Each escaping operation can be controlled individually.
    """
    if escape_backslash:
        text = config.RE_MD_BACKSLASH_MATCHER.sub(r"\\\1", text)

    if snob:
        text = config.RE_MD_CHARS_MATCHER_ALL.sub(r"\\\1", text)

    if escape_dot:
        text = config.RE_MD_DOT_MATCHER.sub(r"\1\\\2", text)

    if escape_plus:
        text = config.RE_MD_PLUS_MATCHER.sub(r"\1\\\2", text)

    if escape_dash:
        text = config.RE_MD_DASH_MATCHER.sub(r"\1\\\2", text)

    return text


def reformat_table(lines: List[str], right_margin: int) -> List[str]:
    """
    Given the lines of a table
    padds the cells and returns the new lines
    """
    # find the maximum width of the columns
    max_width = [len(x.rstrip()) + right_margin for x in lines[0].split("|")]
    max_cols = len(max_width)
    for line in lines:
        cols = [x.rstrip() for x in line.split("|")]
        num_cols = len(cols)

        # don't drop any data if colspan attributes result in unequal lengths
        if num_cols < max_cols:
            cols += [""] * (max_cols - num_cols)
        elif max_cols < num_cols:
            max_width += [len(x) + right_margin for x in cols[-(num_cols - max_cols) :]]
            max_cols = num_cols

        max_width = [
            max(len(x) + right_margin, old_len) for x, old_len in zip(cols, max_width)
        ]

    # reformat
    new_lines = []
    for line in lines:
        cols = [x.rstrip() for x in line.split("|")]
        if set(line.strip()) == set("-|"):
            filler = "-"
            new_cols = [
                x.rstrip() + (filler * (M - len(x.rstrip())))
                for x, M in zip(cols, max_width)
            ]
            new_lines.append("|-" + "|".join(new_cols) + "|")
        else:
            filler = " "
            new_cols = [
                x.rstrip() + (filler * (M - len(x.rstrip())))
                for x, M in zip(cols, max_width)
            ]
            new_lines.append("| " + "|".join(new_cols) + "|")
    return new_lines


def pad_tables_in_text(text: str, right_margin: int = 1) -> str:
    """
    Provide padding for tables in the text
    """
    lines = text.split("\n")
    table_buffer = []  # type: List[str]
    table_started = False
    new_lines = []
    for line in lines:
        # Toggle table started
        if config.TABLE_MARKER_FOR_PAD in line:
            table_started = not table_started
            if not table_started:
                table = reformat_table(table_buffer, right_margin)
                new_lines.extend(table)
                table_buffer = []
                new_lines.append("")
            continue
        # Process lines
        if table_started:
            table_buffer.append(line)
        else:
            new_lines.append(line)
    return "\n".join(new_lines)

```

### Core Architecture Module: `crawl4ai/processors/pdf/utils.py`
```
import re

def apply_png_predictor(data, width, bits, color_channels):
    """Decode PNG predictor (PDF 1.5+ filter)"""
    bytes_per_pixel = (bits * color_channels) // 8
    if (bits * color_channels) % 8 != 0:
        bytes_per_pixel += 1
        
    stride = width * bytes_per_pixel
    scanline_length = stride + 1  # +1 for filter byte
    
    if len(data) % scanline_length != 0:
        raise ValueError("Invalid scanline structure")
    
    num_lines = len(data) // scanline_length
    output = bytearray()
    prev_line = b'\x00' * stride
    
    for i in range(num_lines):
        line = data[i*scanline_length:(i+1)*scanline_length]
        filter_type = line[0]
        filtered = line[1:]
        
        if filter_type == 0:  # None
            decoded = filtered
        elif filter_type == 1:  # Sub
            decoded = bytearray(filtered)
            for j in range(bytes_per_pixel, len(decoded)):
                decoded[j] = (decoded[j] + decoded[j - bytes_per_pixel]) % 256
        elif filter_type == 2:  # Up
            decoded = bytearray([(filtered[j] + prev_line[j]) % 256 
                               for j in range(len(filtered))])
        elif filter_type == 3:  # Average
            decoded = bytearray(filtered)
            for j in range(len(decoded)):
                left = decoded[j - bytes_per_pixel] if j >= bytes_per_pixel else 0
                up = prev_line[j]
                avg = (left + up) // 2
                decoded[j] = (decoded[j] + avg) % 256
        elif filter_type == 4:  # Paeth
            decoded = bytearray(filtered)
            for j in range(len(decoded)):
                left = decoded[j - bytes_per_pixel] if j >= bytes_per_pixel else 0
                up = prev_line[j]
                up_left = prev_line[j - bytes_per_pixel] if j >= bytes_per_pixel else 0
                paeth = paeth_predictor(left, up, up_left)
                decoded[j] = (decoded[j] + paeth) % 256
        else:
            raise ValueError(f"Unsupported filter type: {filter_type}")
        
        output.extend(decoded)
        prev_line = decoded
    
    return bytes(output)

def paeth_predictor(a, b, c):
    p = a + b - c
    pa = abs(p - a)
    pb = abs(p - b)
    pc = abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    elif pb <= pc:
        return b
    else:
        return c

import re
import html

def clean_pdf_text_to_html(page_number, text):
    # Decode Unicode escapes and handle surrogate pairs
    try:
        decoded = text.encode('latin-1').decode('unicode-escape')
        decoded = decoded.encode('utf-16', 'surrogatepass').decode('utf-16')
    except Exception as e:
        decoded = text  # Fallback if decoding fails
    
    article_title_detected = False
    # decoded = re.sub(r'\.\n', '.\n\n', decoded)
    # decoded = re.sub(r'\.\n', '<|break|>', decoded)
    lines = decoded.split('\n')
    output = []
    current_paragraph = []
    in_header = False
    email_pattern = re.compile(r'\{.*?\}')
    affiliation_pattern = re.compile(r'^†')
    quote_pattern = re.compile(r'^["“]')
    author_pattern = re.compile(
        r'^\s*[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*\s*(?:[†*0-9]+)?'
        r'(?:,\s*[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*\s*(?:[†*0-9]+)?)*'
        r'(?:,\s*(?:and|&)\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*\s*(?:[†*0-9]+)?)?\s*$'
    )
    
    def flush_paragraph():
        if current_paragraph:
            para = ' '.join(current_paragraph)
            para = re.sub(r'\s+', ' ', para).strip()
            if para:
                # Paragraph text comes verbatim from the PDF and is attacker-
                # controlled. Escape it so markup like <img onerror=...> cannot
                # survive into cleaned_html and execute when the result is
                # rendered (DOM XSS). Every other sink in this function already
                # escapes; this one was the gap.
                escaped_para = html.escape(para)
                # Whitespace was collapsed above, so this split yields a single
                # element -- kept only to preserve the original structure.
                escaped_para = escaped_para.split('.\n\n')
                # Wrap each part in <p> tag
                escaped_para = [f'<p>{part}</p>' for part in escaped_para]
                output.append(f'<div class="paragraph">{"".join(escaped_para)}</div><hr/>')
            current_paragraph.clear()
    
    for i, line in enumerate(lines):
        line = line.strip()
        
        # Handle empty lines
        if not line:
            flush_paragraph()
            continue
            
        # Detect article title (first line with reasonable length)
        if not article_title_detected and i == 0 and 3 <= len(line.split()) <= 8 and len(lines) > 1:
            flush_paragraph()
            escaped_line = html.escape(line)
            output.append(f'<h2>{escaped_line}</h2>')
            article_title_detected = True
            continue
            
        # Detect numbered headers like "2.1 Background"
        numbered_header = re.match(r'^(\d+(?:\.\d+)*)\s+(.+)$', line)
        if i > 0 and not lines[i-1].strip() and numbered_header:
            flush_paragraph()
            level = numbered_header.group(1).count('.') + 1
            header_text = numbered_header.group(2)
            md_level = min(level + 1, 6)
            escaped_header = html.escape(header_text)
            output.append(f'<h{md_level}>{escaped_header}</h{md_level}>')
            in_header = True
            continue
            
        # Detect authors
        if page_number == 1 and author_pattern.match(line):
            authors = re.sub(r'[†â€]', '', line)
            authors = re.split(r', | and ', authors)
            formatted_authors = []
            for author in authors:
                if author.strip():
                    parts = [p for p in author.strip().split() if p]
                    formatted = ' '.join(parts)
                    escaped_author = html.escape(formatted)
                    formatted_authors.append(f'<strong>{escaped_author}</strong>')
            
            if len(formatted_authors) > 1:
                joined = ', '.join(formatted_authors[:-1]) + ' and ' + formatted_authors[-1]
            else:
                joined = formatted_authors[0]
            
            output.append(f'<p>{joined}</p>')
            continue
            
        # Detect affiliation
        if affiliation_pattern.match(line):
            escaped_line = html.escape(line)
            output.append(f'<p><em>{escaped_line}</em></p>')
            continue
            
        # Detect emails
        if email_pattern.match(line):
            escaped_line = html.escape(line)
            output.append(f'<p><code>{escaped_line}</code></p>')
            continue
            
        # Detect section headers
        if re.match(r'^(Abstract|\d+\s+[A-Z]|References|Appendix|Figure|Table)', line):
            flush_paragraph()
            escaped_line = html.escape(line)
            output.append(f'<h2 class="section-header"><em>{escaped_line}</em></h2>')
            in_header = True
            continue
            
        # Handle quotes
        if quote_pattern.match(line):
            flush_paragraph()
            escaped_line = html.escape(line)
            output.append(f'<blockquote><p>{escaped_line}</p></blockquote>')
            continue
            
        # Handle hyphenated words
        if line.endswith('-'):
            current_paragraph.append(line[:-1].strip())
        else:
            current_paragraph.append(line)
            
        # Handle paragraph breaks after headers
        if in_header and not line.endswith(('.', '!', '?')):
            flush_paragraph()
            in_header = False
    
    flush_paragraph()
    
    # Post-process HTML
    html_output = '\n'.join(output)
    
    # Fix common citation patterns
    html_output = re.sub(r'\(([A-Z][a-z]+ et al\. \d{4})\)', r'<cite>\1</cite>', html_output)
    
    # Fix escaped characters
    html_output = html_output.replace('\\ud835', '').replace('\\u2020', '†')
    
    # Remove leftover hyphens and fix spacing
    html_output = re.sub(r'\s+-\s+', '', html_output)
    html_output = re.sub(r'\s+([.,!?)])', r'\1', html_output)
    
    return html_output

def clean_pdf_text(page_number, text):
    # Decode Unicode escapes and handle surrogate pairs
    try:
        decoded = text.encode('latin-1').decode('unicode-escape')
        decoded = decoded.encode('utf-16', 'surrogatepass').decode('utf-16')
    except Exception as e:
        decoded = text  # Fallback if decoding fails
    
    article_title_detected = False
    decoded = re.sub(r'\.\n', '.\n\n', decoded)
    lines = decoded.split('\n')
    output = []
    current_paragraph = []
    in_header = False
    email_pattern = re.compile(r'\{.*?\}')
    affiliation_pattern = re.compile(r'^†')
    quote_pattern = re.compile(r'^["“]')
    author_pattern = re.compile(
        r'^\s*[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*\s*(?:[†*0-9]+)?'
        r'(?:,\s*[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*\s*(?:[†*0-9]+)?)*'
        r'(?:,\s*(?:and|&)\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*\s*(?:[†*0-9]+)?)?\s*$'
    )
    
    def flush_paragraph():
        if current_paragraph:
            para = ' '.join(current_paragraph)
            para = re.sub(r'\s+', ' ', para).strip()
            if para:
                output.append(para)
            current_paragraph.clear()
    
    for i, line in enumerate(lines):
        line = line.strip()
        
        # Handle special patterns
        if not line:
            flush_paragraph()
            continue
            
        # Detect headline (first line, reasonable length, surrounded by empty lines)
        if not article_title_detected and i == 0 and 3 <= len(line.split()) <= 8 and (len(lines) > 1):
            flush_paragraph()
            output.append(f'## {line}')
            continue
            
        # Detect paragraph breaks for ALL pa
```

### Core Architecture Module: `crawl4ai/utils.py`
```
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from bs4 import BeautifulSoup, Comment, element, Tag, NavigableString
import json
import html
import lxml
import re
import os
import subprocess
import platform
from .prompts import PROMPT_EXTRACT_BLOCKS
from array import array
from .html2text import html2text, CustomHTML2Text
# from .config import *
from .config import MIN_WORD_THRESHOLD, IMAGE_DESCRIPTION_MIN_WORD_THRESHOLD, IMAGE_SCORE_THRESHOLD, DEFAULT_PROVIDER, PROVIDER_MODELS
import httpx
from socket import gaierror
from pathlib import Path
from typing import Dict, Any, List, Optional, Callable, Generator, Tuple, Iterable
from urllib.parse import urljoin
import requests
from requests.exceptions import InvalidSchema
import xxhash
import textwrap
import cProfile
import pstats
from functools import wraps
import asyncio
from lxml import etree, html as lhtml
import sqlite3
import hashlib

from urllib.robotparser import RobotFileParser
import aiohttp
from functools import lru_cache

from packaging import version
from . import __version__
from .egress_policy import proxy_url
from typing import Sequence

from itertools import chain
from collections import deque
import psutil
import numpy as np

from urllib.parse import (
    urljoin, urlparse, urlunparse,
    parse_qsl, urlencode, quote, unquote
)
import inspect


# Monkey patch to fix wildcard handling in urllib.robotparser.
# Python 3.14 rewrote robotparser with native wildcard, '$' and RFC 9309
# longest-match support, and its applies_to returns a match *length* used to
# rank rules. Patching it there returns a bool, which collapses every wildcard
# rule to the lowest priority and breaks Allow: overrides -- so only patch the
# older implementation, which has no wildcard support at all.
import sys

if sys.version_info < (3, 14):
    from urllib.robotparser import RuleLine

    original_applies_to = RuleLine.applies_to

    def patched_applies_to(self, filename):
       # Handle wildcards in paths
       if '*' in self.path or '%2A' in self.path or self.path in ("*", "%2A"):
           pattern = self.path.replace('%2A', '*')
           pattern = re.escape(pattern).replace('\\*', '.*')
           pattern = '^' + pattern
           if pattern.endswith('\\$'):
               pattern = pattern[:-2] + '$'
           try:
               return bool(re.match(pattern, filename))
           except re.error:
               return original_applies_to(self, filename)
       return original_applies_to(self, filename)

    RuleLine.applies_to = patched_applies_to
# Monkey patch ends

def chunk_documents(
    documents: Iterable[str],
    chunk_token_threshold: int,
    overlap: int,
    word_token_rate: float = 0.75,
    tokenizer: Optional[Callable[[str], List[str]]] = None,
) -> Generator[str, None, None]:
    """
    Efficiently chunks documents into token-limited sections with overlap between chunks.

    Args:
        documents: Iterable of document strings
        chunk_token_threshold: Maximum tokens per chunk
        overlap: Number of tokens to overlap between chunks
        word_token_rate: Token estimate per word when not using a tokenizer
        tokenizer: Function that splits text into tokens (if available)

    Yields:
        Text chunks as strings
    """
    token_queue = deque()
    contribution_queue = deque()
    current_token_count = 0.0

    for doc in documents:
        # Tokenize document
        if tokenizer:
            tokens = tokenizer(doc)
            contributions = [1.0] * len(tokens)
        else:
            tokens = doc.split()
            contributions = [word_token_rate] * len(tokens)

        # Add to processing queues
        token_queue.extend(tokens)
        contribution_queue.extend(contributions)
        current_token_count += sum(contributions)

        # Process full chunks
        while current_token_count >= chunk_token_threshold:
            # Find chunk split point
            chunk_tokens = []
            chunk_contrib = []
            chunk_total = 0.0
            
            # Build chunk up to threshold
            while contribution_queue:
                next_contrib = contribution_queue[0]
                if chunk_total + next_contrib > chunk_token_threshold:
                    break
                
                chunk_total += next_contrib
                chunk_contrib.append(contribution_queue.popleft())
                chunk_tokens.append(token_queue.popleft())

            # Handle edge case where first token exceeds threshold
            if not chunk_contrib:  # Single token exceeds threshold
                chunk_contrib.append(contribution_queue.popleft())
                chunk_tokens.append(token_queue.popleft())

            # Calculate overlap
            overlap_total = 0.0
            overlap_idx = 0
            for contrib in reversed(chunk_contrib):
                if overlap_total + contrib > overlap:
                    break
                overlap_total += contrib
                overlap_idx += 1

            # Prepend overlap to queues
            if overlap_idx > 0:
                overlap_tokens = chunk_tokens[-overlap_idx:]
                overlap_contrib = chunk_contrib[-overlap_idx:]
                
                token_queue.extendleft(reversed(overlap_tokens))
                contribution_queue.extendleft(reversed(overlap_contrib))
                current_token_count += overlap_total

            # Update current token count and yield chunk
            current_token_count -= sum(chunk_contrib)
            yield " ".join(chunk_tokens[:len(chunk_tokens)-overlap_idx] if overlap_idx else chunk_tokens)

    # Yield remaining tokens
    if token_queue:
        yield " ".join(token_queue)

def merge_chunks(
    docs: Sequence[str], 
    target_size: int,
    overlap: int = 0,
    word_token_ratio: float = 1.0,
    splitter: Callable = None
) -> List[str]:
    """
    Merges a sequence of documents into chunks based on a target token count, with optional overlap.
    
    Each document is split into tokens using the provided splitter function (defaults to str.split). Tokens are distributed into chunks aiming for the specified target size, with optional overlapping tokens between consecutive chunks. Returns a list of non-empty merged chunks as strings.
    
    Args:
        docs: Sequence of input document strings to be merged.
        target_size: Target number of tokens per chunk.
        overlap: Number of tokens to overlap between consecutive chunks.
        word_token_ratio: Multiplier to estimate token count from word count.
        splitter: Callable used to split each document into tokens.
    
    Returns:
        List of merged document chunks as strings, each not exceeding the target token size.
    """
    # Pre-tokenize all docs and store token counts
    splitter = splitter or str.split
    token_counts = array('I')
    all_tokens: List[List[str]] = []
    total_tokens = 0
    
    for doc in docs:
        tokens = splitter(doc)
        count = int(len(tokens) * word_token_ratio)
        if count:  # Skip empty docs
            token_counts.append(count)
            all_tokens.append(tokens)
            total_tokens += count
    
    if not total_tokens:
        return []

    # Pre-allocate chunks
    num_chunks = max(1, (total_tokens + target_size - 1) // target_size)
    chunks: List[List[str]] = [[] for _ in range(num_chunks)]
    
    curr_chunk = 0
    curr_size = 0
    
    # Distribute tokens
    for tokens in chain.from_iterable(all_tokens):
        if curr_size >= target_size and curr_chunk < num_chunks - 1:
            if overlap > 0:
                overlap_tokens = chunks[curr_chunk][-overlap:]
                curr_chunk += 1
                chunks[curr_chunk].extend(overlap_tokens)
                curr_size = len(overlap_tokens)
            else:
                curr_chunk += 1
                curr_size = 0
                
        chunks[curr_chunk].append(tokens)
        curr_size += 1

    # Return only non-empty chunks
    return [' '.join(chunk) for chunk in chunks if chunk]


class VersionManager:
    def __init__(self):
        self.home_dir = Path(os.getenv("CRAWL4_AI_BASE_DIRECTORY", Path.home())) / ".crawl4ai"
        self.version_file = self.home_dir / "version.txt"

    def get_installed_version(self):
        """Get the version recorded in home directory"""
        if not self.version_file.exists():
            return None
        try:
            return version.parse(self.version_file.read_text().strip())
        except Exception as _ex:
            return None

    def update_version(self):
        """Update the version file to current library version"""
        self.version_file.write_text(__version__.__version__)

    def needs_update(self):
        """Check if database needs update based on version"""
        installed = self.get_installed_version()
        current = version.parse(__version__.__version__)
        return installed is None or installed < current


def _preserve_bare_query(rules_text: str) -> str:
    """Append '*' to Allow/Disallow values ending in a bare '?' (e.g. '/*?').

    Only correct below Python 3.14, and only called there. Those parsers drop a
    trailing '?' when normalizing the rule path, collapsing '/*?' to '/*' and
    blocking the whole site; they also take the first matching rule, so making a
    rule longer cannot change which one wins.

    From 3.14 the stdlib keeps the '?' and ranks rules by match length, and the
    rewrite becomes actively wrong: '/*?*' matches to end of string, so it
    outranks a competing 'Allow: /*?q=' that the raw '/*?' would have lost to.
    """
    fixed = []
    for raw_line in rules_text.splitlines():
        body, _, _ = raw_line.partition("#")
        key, sep, value = body.partition(":")
        if sep and key.strip().lower() in ("allow", "disallow") and value.strip().endswith("?"):
            raw_line = f"{key.strip()}: {value.strip()}*"
        fixed.app
```

### Core Architecture Module: `deploy/docker/hook_registry.py`
```
"""
Declarative hook registry - the safe replacement for the exec-based hook system.

The old hook_manager.py compiled and exec()'d user-supplied Python at crawl hook
points. Its sandbox was unsound (escapable via __subclasses__ MRO walks, injected
module __globals__, frame inspection), giving unauthenticated RCE when hooks were
enabled. There is no safe way to run attacker Python in-process.

Instead, a request may only choose from a fixed set of declarative ACTIONS whose
parameters are schema-validated scalars. Each action maps to a server-authored
async function that calls exactly one specific Playwright API - no user string
ever reaches an interpreter. This covers the documented hook use cases (block
assets, inject auth cookies/headers, scroll for lazy content, wait).

Power users who genuinely need arbitrary hook code use a self-hosted in-process
build where crawler_strategy.set_hook(...) remains available and trusted.
"""

from __future__ import annotations

import re
from typing import Any, Callable, Dict, List

from pydantic import BaseModel, Field, field_validator


class HookValidationError(ValueError):
    """A declarative hook spec was invalid. The Docker layer maps this to 400."""


_HEADER_NAME_RE = re.compile(r"^[A-Za-z0-9-]{1,64}$")
_ALLOWED_RESOURCE_TYPES = {"image", "stylesheet", "font", "media"}
_MAX_SCROLL_STEPS = 50
_MAX_SCROLL_DELAY_MS = 5000
_MAX_WAIT_MS = 60_000
_MAX_COOKIES = 20
_MAX_HEADERS = 20


# ───────────────────────── per-action parameter schemas ─────────────────────────
class BlockResourcesParams(BaseModel):
    resource_types: List[str] = Field(..., min_length=1)

    @field_validator("resource_types")
    @classmethod
    def _check(cls, v):
        bad = sorted(set(v) - _ALLOWED_RESOURCE_TYPES)
        if bad:
            raise ValueError(f"unsupported resource_types {bad}; allowed: {sorted(_ALLOWED_RESOURCE_TYPES)}")
        return v


class _Cookie(BaseModel):
    name: str = Field(..., min_length=1, max_length=256)
    value: str = Field(..., max_length=4096)
    domain: str = Field(..., min_length=1, max_length=253)
    path: str = "/"
    secure: bool = True
    httpOnly: bool = False


class AddCookiesParams(BaseModel):
    cookies: List[_Cookie] = Field(..., min_length=1, max_length=_MAX_COOKIES)


class SetHeadersParams(BaseModel):
    headers: Dict[str, str]

    @field_validator("headers")
    @classmethod
    def _check(cls, v):
        if len(v) > _MAX_HEADERS:
            raise ValueError(f"too many headers (max {_MAX_HEADERS})")
        for name, value in v.items():
            if not _HEADER_NAME_RE.match(name):
                raise ValueError(f"invalid header name {name!r}")
            if any(c in value for c in "\r\n\x00"):
                raise ValueError(f"control characters in value for header {name!r}")
        return v


class ScrollToBottomParams(BaseModel):
    max_steps: int = Field(10, ge=1, le=_MAX_SCROLL_STEPS)
    delay_ms: int = Field(500, ge=0, le=_MAX_SCROLL_DELAY_MS)


class WaitForTimeoutParams(BaseModel):
    timeout_ms: int = Field(..., ge=0, le=_MAX_WAIT_MS)


# ───────────────────────── server-authored hook factories ─────────────────────────
def _factory_block_resources(p: BlockResourcesParams):
    types = set(p.resource_types)

    async def hook(page, **kwargs):
        context = kwargs.get("context")

        async def _route(route):
            try:
                if route.request.resource_type in types:
                    await route.abort()
                else:
                    await route.continue_()
            except Exception:
                # never let a routing decision crash the crawl
                await route.continue_()

        if context is not None:
            await context.route("**/*", _route)
        return page

    return hook


def _factory_add_cookies(p: AddCookiesParams):
    cookies = [c.model_dump() for c in p.cookies]

    async def hook(page, **kwargs):
        context = kwargs.get("context")
        if context is not None:
            await context.add_cookies(cookies)
        return page

    return hook


def _factory_set_headers(p: SetHeadersParams):
    headers = dict(p.headers)

    async def hook(page, **kwargs):
        await page.set_extra_http_headers(headers)
        return page

    return hook


def _factory_scroll_to_bottom(p: ScrollToBottomParams):
    max_steps, delay_ms = p.max_steps, p.delay_ms

    async def hook(page, **kwargs):
        for _ in range(max_steps):
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            if delay_ms:
                await page.wait_for_timeout(delay_ms)
        return page

    return hook


def _factory_wait_for_timeout(p: WaitForTimeoutParams):
    timeout_ms = p.timeout_ms

    async def hook(page, **kwargs):
        await page.wait_for_timeout(timeout_ms)
        return page

    return hook


# action name -> (hook_point, params model, factory, human description)
HOOK_REGISTRY: Dict[str, dict] = {
    "block_resources": {
        "hook_point": "on_page_context_created",
        "params_model": BlockResourcesParams,
        "factory": _factory_block_resources,
        "description": "Abort matching resource types (image/stylesheet/font/media).",
    },
    "add_cookies": {
        "hook_point": "on_page_context_created",
        "params_model": AddCookiesParams,
        "factory": _factory_add_cookies,
        "description": "Add cookies to the browser context before navigation (auth).",
    },
    "set_headers": {
        "hook_point": "before_goto",
        "params_model": SetHeadersParams,
        "factory": _factory_set_headers,
        "description": "Set extra HTTP request headers before navigating.",
    },
    "scroll_to_bottom": {
        "hook_point": "before_retrieve_html",
        "params_model": ScrollToBottomParams,
        "factory": _factory_scroll_to_bottom,
        "description": "Scroll to the page bottom in bounded steps (lazy-load).",
    },
    "wait_for_timeout": {
        "hook_point": "before_retrieve_html",
        "params_model": WaitForTimeoutParams,
        "factory": _factory_wait_for_timeout,
        "description": "Wait a bounded number of milliseconds before retrieving HTML.",
    },
}


def build_declarative_hooks(specs: List[Any]) -> Dict[str, Callable]:
    """Validate declarative hook specs and return {hook_point: composed async hook}.

    Each spec is an object/dict with `action` and `params`. Multiple specs that
    target the same hook point are composed and run in order. Raises
    HookValidationError on an unknown action or invalid params.
    """
    if not specs:
        return {}
    if len(specs) > 10:
        raise HookValidationError("too many hooks (max 10)")

    grouped: Dict[str, List[Callable]] = {}
    for spec in specs:
        action = spec.get("action") if isinstance(spec, dict) else getattr(spec, "action", None)
        raw_params = (spec.get("params", {}) if isinstance(spec, dict) else getattr(spec, "params", {})) or {}
        entry = HOOK_REGISTRY.get(action)
        if entry is None:
            raise HookValidationError(
                f"unknown hook action {action!r}; allowed: {sorted(HOOK_REGISTRY)}"
            )
        try:
            params = entry["params_model"](**raw_params)
        except Exception as e:
            raise HookValidationError(f"invalid params for hook '{action}': {e}")
        sub_hook = entry["factory"](params)
        grouped.setdefault(entry["hook_point"], []).append(sub_hook)

    hooks: Dict[str, Callable] = {}
    for hook_point, sub_hooks in grouped.items():
        def _compose(sub_hooks):
            async def composed(page, **kwargs):
                for fn in sub_hooks:
                    await fn(page, **kwargs)
                return page
            return composed
        hooks[hook_point] = _compose(sub_hooks)
    return hooks


def describe_registry() -> dict:
    """Enumerate the available declarative actions for /hooks/info."""
    return {
        action: {
            "hook_point": entry["hook_point"],
            "description": entry["description"],
            "params_schema": entry["params_model"].model_json_schema(),
        }
        for action, entry in HOOK_REGISTRY.items()
    }

```

### Core Architecture Module: `deploy/docker/utils.py`
```
import dns.resolver
import logging
import yaml
import os
from datetime import datetime
from enum import Enum
from pathlib import Path
from fastapi import Request
from typing import Dict, Optional

class TaskStatus(str, Enum):
    PROCESSING = "processing"
    FAILED = "failed"
    COMPLETED = "completed"

class FilterType(str, Enum):
    RAW = "raw"
    FIT = "fit"
    BM25 = "bm25"
    LLM = "llm"

DEFAULT_CONFIG = {
    "app": {
        "title": "Crawl4AI API",
        "version": "1.0.0",
        "host": "0.0.0.0",
        "port": 11235,
        "reload": False,
        "workers": 1,
        "timeout_keep_alive": 300,
    },
    "llm": {
        "provider": "openai/gpt-4o-mini",
    },
    "redis": {
        "host": "localhost",
        "port": 6379,
        "db": 0,
        "password": "",
        "task_ttl_seconds": 3600,
        "ssl": False,
    },
    "rate_limiting": {
        "enabled": True,
        "default_limit": "1000/minute",
        "trusted_proxies": [],
        "storage_uri": "memory://",
    },
    "security": {
        "enabled": False,
        "jwt_enabled": False,
        "api_token": "",
        "https_redirect": False,
        "trusted_hosts": ["*"],
        "headers": {
            "x_content_type_options": "nosniff",
            "x_frame_options": "DENY",
            "content_security_policy": "default-src 'self'",
            "strict_transport_security": "max-age=63072000; includeSubDomains",
        },
    },
    "crawler": {
        "base_config": {"simulate_user": True},
        "memory_threshold_percent": 95.0,
        "rate_limiter": {"enabled": True, "base_delay": [1.0, 2.0]},
        "timeouts": {"stream_init": 30.0, "batch_process": 300.0},
        "pool": {"max_pages": 40, "idle_ttl_sec": 300, "max_pages_before_recycle": 200},
        "browser": {
            "kwargs": {"headless": True, "text_mode": True},
            "extra_args": [
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--disable-software-rasterizer",
                "--allow-insecure-localhost",
                "--ignore-certificate-errors",
            ],
        },
    },
    "logging": {
        "level": "INFO",
        "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    },
    "observability": {
        "prometheus": {"enabled": True, "endpoint": "/metrics"},
        "health_check": {"endpoint": "/health"},
    },
    "webhooks": {
        "enabled": True,
        "default_url": None,
        "data_in_payload": False,
        "retry": {
            "max_attempts": 5,
            "initial_delay_ms": 1000,
            "max_delay_ms": 32000,
            "timeout_ms": 30000,
        },
        "headers": {"User-Agent": "Crawl4AI-Webhook/1.0"},
    },
}


def _deep_merge(base: dict, override: dict) -> dict:
    """Recursively merge override into base. Override values take precedence."""
    merged = base.copy()
    for key, value in override.items():
        if key in merged and isinstance(merged[key], dict) and isinstance(value, dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def load_config() -> Dict:
    """Load and return application configuration with environment variable overrides."""
    config_path = Path(__file__).parent / "config.yml"
    with open(config_path, "r") as config_file:
        user_config = yaml.safe_load(config_file) or {}

    # Deep-merge user config on top of defaults so missing keys get safe values
    config = _deep_merge(DEFAULT_CONFIG, user_config)

    for section in DEFAULT_CONFIG:
        if section not in user_config:
            logging.warning(
                f"Config section '{section}' missing from config.yml, using defaults"
            )
    
    # Override LLM provider from environment if set
    llm_provider = os.environ.get("LLM_PROVIDER")
    if llm_provider:
        config["llm"]["provider"] = llm_provider
        logging.info(f"LLM provider overridden from environment: {llm_provider}")
    
    # Also support direct API key from environment if the provider-specific key isn't set
    llm_api_key = os.environ.get("LLM_API_KEY")
    if llm_api_key and "api_key" not in config["llm"]:
        config["llm"]["api_key"] = llm_api_key
        logging.info("LLM API key loaded from LLM_API_KEY environment variable")

    # Override Redis task TTL from environment if set
    redis_task_ttl = os.environ.get("REDIS_TASK_TTL")
    if redis_task_ttl:
        try:
            config["redis"]["task_ttl_seconds"] = int(redis_task_ttl)
            logging.info(f"Redis task TTL overridden from REDIS_TASK_TTL: {redis_task_ttl}s")
        except ValueError:
            logging.warning(f"Invalid REDIS_TASK_TTL value: {redis_task_ttl}, using default")

    return config

class CRLFSafeFilter(logging.Filter):
    """Strip CR/LF/control chars from log records (log-injection / forging).

    A crawl URL or error reflected into a log line could otherwise inject
    newlines and forge additional log entries.
    """

    _BAD = {ord(c): None for c in "\r\n"} | {i: None for i in range(0, 32) if i not in (9,)}

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            msg = record.getMessage()
            cleaned = msg.translate(self._BAD)
            if cleaned != msg:
                record.msg = cleaned
                record.args = ()
        except Exception:
            pass
        return True


def setup_logging(config: Dict) -> None:
    """Configure application logging with CRLF-safe records."""
    logging.basicConfig(
        level=config["logging"]["level"],
        format=config["logging"]["format"]
    )
    crlf = CRLFSafeFilter()
    for handler in logging.getLogger().handlers:
        handler.addFilter(crlf)

def get_base_url(request: Request) -> str:
    """Get base URL including scheme and host."""
    return f"{request.url.scheme}://{request.url.netloc}"

def is_task_id(value: str) -> bool:
    """Check if the value matches task ID pattern."""
    return value.startswith("llm_") and "_" in value

def datetime_handler(obj: any) -> Optional[str]:
    """Handle datetime serialization for JSON."""
    if hasattr(obj, 'isoformat'):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

def should_cleanup_task(created_at: str, ttl_seconds: int = 3600) -> bool:
    """Check if task should be cleaned up based on creation time."""
    created = datetime.fromisoformat(created_at)
    return (datetime.now() - created).total_seconds() > ttl_seconds

def decode_redis_hash(hash_data: Dict[bytes, bytes]) -> Dict[str, str]:
    """Decode Redis hash data from bytes to strings."""
    return {k.decode('utf-8'): v.decode('utf-8') for k, v in hash_data.items()}


def get_redis_task_ttl(config: Dict) -> int:
    """Get Redis task TTL in seconds from config.

    Args:
        config: The application configuration dictionary

    Returns:
        TTL in seconds (default 3600). Returns 0 if TTL is disabled.
    """
    return config.get("redis", {}).get("task_ttl_seconds", 3600)


def get_llm_api_key(config: Dict, provider: Optional[str] = None) -> Optional[str]:
    """Get the appropriate API key based on the LLM provider.
    
    Args:
        config: The application configuration dictionary
        provider: Optional provider override (e.g., "openai/gpt-4")
    
    Returns:
        The API key if directly configured, otherwise None to let litellm handle it
    """
    # Check if direct API key is configured (for backward compatibility)
    if "api_key" in config["llm"]:
        return config["llm"]["api_key"]
    
    # Return None - litellm will automatically find the right environment variable
    return None


def validate_llm_provider(config: Dict, provider: Optional[str] = None) -> tuple[bool, str]:
    """Validate that the LLM provider has an associated API key.
    
    Args:
        config: The application configuration dictionary
        provider: Optional provider override (e.g., "openai/gpt-4")
    
    Returns:
        Tuple of (is_valid, error_message)
    """
    # If a direct API key is configured, validation passes
    if "api_key" in config["llm"]:
        return True, ""
    
    # Otherwise, trust that litellm will find the appropriate environment variable
    # We can't easily validate this without reimplementing litellm's logic
    return True, ""


def get_llm_temperature(config: Dict, provider: Optional[str] = None) -> Optional[float]:
    """Get temperature setting based on the LLM provider.
    
    Priority order:
    1. Provider-specific environment variable (e.g., OPENAI_TEMPERATURE)
    2. Global LLM_TEMPERATURE environment variable
    3. None (to use litellm/provider defaults)
    
    Args:
        config: The application configuration dictionary
        provider: Optional provider override (e.g., "openai/gpt-4")
    
    Returns:
        The temperature setting if configured, otherwise None
    """
    # Check provider-specific temperature first
    if provider:
        provider_name = provider.split('/')[0].upper()
        provider_temp = os.environ.get(f"{provider_name}_TEMPERATURE")
        if provider_temp:
            try:
                return float(provider_temp)
            except ValueError:
                logging.warning(f"Invalid temperature value for {provider_name}: {provider_temp}")
    
    # Check global LLM_TEMPERATURE
    global_temp = os.environ.get("LLM_TEMPERATURE")
    if global_temp:
        try:
            return float(global_temp)
        except ValueError:
            logging.warning(f"Invalid global temperature value: {global_temp}")
    
    # Return None to use litellm/provider defaults
    return None


def get_llm_base_url(config: Dict, provider: Optional[str] = None) -> Optional[str]:
    """Get base URL setting based on the LLM provider.
    
    Priority order:
    1. Provid
```

### Core Architecture Module: `deploy/docker/webhook.py`
```
"""
Webhook delivery service for Crawl4AI.

This module provides webhook notification functionality with exponential backoff retry logic.
"""
import asyncio
import logging
import re
import socket
from typing import Dict, List, Optional
from datetime import datetime, timezone

import aiohttp
from aiohttp.abc import AbstractResolver

logger = logging.getLogger(__name__)

_MAX_WEBHOOK_REDIRECTS = 5


class _WebhookBlocked(Exception):
    """Webhook target (or a redirect hop) resolved to a non-global address."""


class _PinnedResolver(AbstractResolver):
    """aiohttp resolver that returns a single pre-pinned IP for the target host.

    aiohttp connects to this IP but still performs TLS SNI / certificate
    verification against the original hostname, so this pins the connection
    (closing DNS rebinding) without weakening TLS or doing a MITM.
    """

    def __init__(self, host: str, ip: str):
        self._host = host
        self._ip = ip

    async def resolve(self, host, port=0, family=socket.AF_INET):
        return [{
            "hostname": host,
            "host": self._ip,
            "port": port,
            "family": family,
            "proto": 0,
            "flags": 0,
        }]

    async def close(self):
        pass

# Webhook request-header policy: user-controlled outbound headers could inject
# hop-by-hop / smuggling headers or CRLF. Allow only well-formed names, reject
# control chars in values, and deny sensitive/hop-by-hop names.
_WEBHOOK_HEADER_NAME = re.compile(r"^[A-Za-z0-9-]{1,64}$")
_WEBHOOK_DENY_HEADERS = {
    "host", "content-length", "transfer-encoding", "connection",
    "content-type", "proxy-authorization", "authorization", "cookie",
    "expect", "upgrade", "te", "trailer",
}
_MAX_WEBHOOK_HEADERS = 20
_MAX_WEBHOOK_HEADER_VALUE = 2048


def sanitize_webhook_headers(headers: Optional[Dict[str, str]]) -> Dict[str, str]:
    """Validate user-supplied webhook headers; raise ValueError on any bad one."""
    if not headers:
        return {}
    if len(headers) > _MAX_WEBHOOK_HEADERS:
        raise ValueError("too many webhook headers")
    clean: Dict[str, str] = {}
    for name, value in headers.items():
        if not isinstance(name, str) or not _WEBHOOK_HEADER_NAME.match(name):
            raise ValueError(f"invalid webhook header name: {name!r}")
        if name.lower() in _WEBHOOK_DENY_HEADERS:
            raise ValueError(f"webhook header not allowed: {name}")
        sval = str(value)
        if len(sval) > _MAX_WEBHOOK_HEADER_VALUE or any(c in sval for c in "\r\n\x00"):
            raise ValueError(f"invalid value for webhook header {name}")
        clean[name] = sval
    return clean


class WebhookDeliveryService:
    """Handles webhook delivery with exponential backoff retry logic."""

    def __init__(self, config: Dict):
        """
        Initialize the webhook delivery service.

        Args:
            config: Application configuration dictionary containing webhook settings
        """
        self.config = config.get("webhooks", {})
        self.max_attempts = self.config.get("retry", {}).get("max_attempts", 5)
        self.initial_delay = self.config.get("retry", {}).get("initial_delay_ms", 1000) / 1000
        self.max_delay = self.config.get("retry", {}).get("max_delay_ms", 32000) / 1000
        self.timeout = self.config.get("retry", {}).get("timeout_ms", 30000) / 1000

    async def send_webhook(
        self,
        webhook_url: str,
        payload: Dict,
        headers: Optional[Dict[str, str]] = None
    ) -> bool:
        """
        Send webhook with exponential backoff retry logic.

        Args:
            webhook_url: The URL to send the webhook to
            payload: The JSON payload to send
            headers: Optional custom headers

        Returns:
            bool: True if delivered successfully, False otherwise
        """
        default_headers = self.config.get("headers", {})
        try:
            safe_custom = sanitize_webhook_headers(headers)
        except ValueError as e:
            # Defense in depth (the schema validator rejects these at request
            # time); never send a forged/unsafe header.
            logger.warning(f"Dropping unsafe webhook headers: {e}")
            safe_custom = {}
        merged_headers = {**default_headers, **safe_custom}
        merged_headers["Content-Type"] = "application/json"

        for attempt in range(self.max_attempts):
            try:
                status = await self._deliver(webhook_url, payload, merged_headers)
                if 200 <= status < 300:
                    logger.info("Webhook delivered successfully")
                    return True
                if status < 500:
                    logger.warning(f"Webhook rejected with status {status}")
                    return False  # client error - don't retry
                logger.warning(f"Webhook failed with status {status}, will retry")
            except _WebhookBlocked as exc:
                # SSRF: target (or a redirect hop) resolved non-global. Do not
                # retry - it will not become safe.
                logger.warning(f"Webhook blocked (SSRF protection): {exc}")
                return False
            except Exception as exc:
                logger.error(f"Webhook delivery error (attempt {attempt + 1}): {exc}")

            if attempt < self.max_attempts - 1:
                delay = min(self.initial_delay * (2 ** attempt), self.max_delay)
                await asyncio.sleep(delay)
        return False

    async def _deliver(self, url: str, payload: Dict, headers: Dict[str, str]) -> int:
        """POST with the connection pinned to the validated IP, following (and
        re-validating) redirects manually. Returns the final status code."""
        from egress_broker import resolve_and_pin, check_redirect, EgressBlocked, ALLOW_INSECURE_TLS

        current = url
        for _hop in range(_MAX_WEBHOOK_REDIRECTS + 1):
            try:
                pin = resolve_and_pin(current)
            except EgressBlocked as e:
                raise _WebhookBlocked(str(e))

            connector = aiohttp.TCPConnector(resolver=_PinnedResolver(pin.host, pin.ip))
            ssl = None if not ALLOW_INSECURE_TLS else False
            timeout = aiohttp.ClientTimeout(total=self.timeout)
            async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
                async with session.post(
                    current, json=payload, headers=headers,
                    allow_redirects=False, ssl=ssl,
                ) as resp:
                    if resp.status in (301, 302, 303, 307, 308):
                        loc = resp.headers.get("Location")
                        if not loc:
                            return resp.status
                        # Re-validate every redirect hop before following it.
                        try:
                            check_redirect(loc)
                        except EgressBlocked as e:
                            raise _WebhookBlocked(f"redirect to blocked target: {e}")
                        current = loc
                        continue
                    return resp.status
        raise _WebhookBlocked("too many webhook redirects")

        logger.error(
            f"Webhook delivery failed after {self.max_attempts} attempts to {webhook_url}"
        )
        return False

    async def notify_job_completion(
        self,
        task_id: str,
        task_type: str,
        status: str,
        urls: list,
        webhook_config: Optional[Dict],
        result: Optional[Dict] = None,
        error: Optional[str] = None
    ):
        """
        Notify webhook of job completion.

        Args:
            task_id: The task identifier
            task_type: Type of task (e.g., "crawl", "llm_extraction")
            status: Task status ("completed" or "failed")
            urls: List of URLs that were crawled
            webhook_config: Webhook configuration from the job request
            result: Optional crawl result data
            error: Optional error message if failed
        """
        # Determine webhook URL
        webhook_url = None
        data_in_payload = self.config.get("data_in_payload", False)
        custom_headers = None

        if webhook_config:
            webhook_url = webhook_config.get("webhook_url")
            data_in_payload = webhook_config.get("webhook_data_in_payload", data_in_payload)
            custom_headers = webhook_config.get("webhook_headers")

        if not webhook_url:
            webhook_url = self.config.get("default_url")

        if not webhook_url:
            logger.debug("No webhook URL configured, skipping notification")
            return

        # Check if webhooks are enabled
        if not self.config.get("enabled", True):
            logger.debug("Webhooks are disabled, skipping notification")
            return

        # Build payload
        payload = {
            "task_id": task_id,
            "task_type": task_type,
            "status": status,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "urls": urls
        }

        if error:
            payload["error"] = error

        if data_in_payload and result:
            payload["data"] = result

        # Send webhook (fire and forget - don't block on completion)
        await self.send_webhook(webhook_url, payload, custom_headers)

```

### Core Architecture Module: `deploy/docker/work_queue.py`
```
"""
work_queue.py - bounded background-job execution with per-principal quotas.

/crawl/job and /llm/job used FastAPI BackgroundTasks with no bound: a client
could enqueue unlimited background jobs and exhaust memory / browser slots, and
one caller could starve others.

This replaces that with a fixed worker pool draining an asyncio.Queue, plus an
optional per-principal concurrency cap. Everything is configurable, and any
limit set to 0 (or null) means "unbounded" - i.e. the previous behavior is fully
recoverable:

    limits.queue.maxsize        0 => unbounded queue (never 503)
    limits.queue.workers        worker pool size (>=1)
    limits.queue.per_principal  0 => no per-caller cap (never 429)
"""

from __future__ import annotations

import asyncio
import logging
from typing import Awaitable, Callable, Dict, Optional

logger = logging.getLogger("crawl4ai.workqueue")

JobFactory = Callable[[], Awaitable[None]]


class QueueFull(Exception):
    """The bounded job queue is full -> 503 Retry-After."""


class QuotaExceeded(Exception):
    """The principal has too many concurrent jobs -> 429."""


class WorkQueue:
    def __init__(self, maxsize: int = 0, workers: int = 4, per_principal: int = 0):
        self.maxsize = max(0, int(maxsize))          # 0 = unbounded
        self.workers = max(1, int(workers))
        self.per_principal = max(0, int(per_principal))  # 0 = unlimited
        self._q: Optional[asyncio.Queue] = None
        self._tasks: list = []
        self._counts: Dict[str, int] = {}

    @property
    def started(self) -> bool:
        return self._q is not None

    async def start(self) -> None:
        self._q = asyncio.Queue(maxsize=self.maxsize)
        self._tasks = [asyncio.create_task(self._worker()) for _ in range(self.workers)]
        logger.info(
            "work queue started (maxsize=%s, workers=%s, per_principal=%s)",
            self.maxsize or "unbounded", self.workers, self.per_principal or "unlimited",
        )

    async def stop(self) -> None:
        for t in self._tasks:
            t.cancel()
        self._tasks = []
        self._q = None

    async def _worker(self) -> None:
        assert self._q is not None
        while True:
            principal, factory = await self._q.get()
            try:
                await factory()
            except Exception:
                logger.exception("background job failed")
            finally:
                self._release(principal)
                self._q.task_done()

    def _release(self, principal: Optional[str]) -> None:
        if not principal:
            return
        n = self._counts.get(principal, 0) - 1
        if n <= 0:
            self._counts.pop(principal, None)
        else:
            self._counts[principal] = n

    def submit(self, factory: JobFactory, principal: Optional[str] = None) -> None:
        """Enqueue a job. Raises QuotaExceeded / QueueFull (mapped to 429 / 503)."""
        if self._q is None:
            raise RuntimeError("work queue not started")
        if self.per_principal and principal:
            if self._counts.get(principal, 0) >= self.per_principal:
                raise QuotaExceeded()
        try:
            self._q.put_nowait((principal, factory))
        except asyncio.QueueFull:
            raise QueueFull()
        if principal:
            self._counts[principal] = self._counts.get(principal, 0) + 1


# Process-wide singleton, set at server boot.
_JOB_QUEUE: Optional[WorkQueue] = None


def set_job_queue(q: Optional[WorkQueue]) -> None:
    global _JOB_QUEUE
    _JOB_QUEUE = q


def get_job_queue() -> Optional[WorkQueue]:
    return _JOB_QUEUE

```

### Core Architecture Module: `crawl4ai/__init__.py`
```
# __init__.py
import warnings

from .async_webcrawler import AsyncWebCrawler, CacheMode
# MODIFIED: Add SeedingConfig and VirtualScrollConfig here
from .async_configs import BrowserConfig, CrawlerRunConfig, HTTPCrawlerConfig, LLMConfig, ProxyConfig, GeolocationConfig, SeedingConfig, VirtualScrollConfig, LinkPreviewConfig, MatchMode, DomainMapperConfig

from .content_scraping_strategy import (
    ContentScrapingStrategy,
    LXMLWebScrapingStrategy,
    WebScrapingStrategy,  # Backward compatibility alias
)
from .processors.pdf import PDFContentScrapingStrategy
from .async_logger import (
    AsyncLoggerBase,
    AsyncLogger,
)
from .proxy_strategy import (
    ProxyRotationStrategy,
    RoundRobinProxyStrategy,
)
from .extraction_strategy import (
    ExtractionStrategy,
    LLMExtractionStrategy,
    CosineStrategy,
    JsonCssExtractionStrategy,
    JsonXPathExtractionStrategy,
    JsonLxmlExtractionStrategy,
    RegexExtractionStrategy
)
from .chunking_strategy import ChunkingStrategy, RegexChunking
from .markdown_generation_strategy import DefaultMarkdownGenerator
from .table_extraction import (
    TableExtractionStrategy,
    DefaultTableExtraction,
    NoTableExtraction,
    LLMTableExtraction,
)
from .content_filter_strategy import (
    PruningContentFilter,
    BM25ContentFilter,
    LLMContentFilter,
    RelevantContentFilter,
)
from .content_filter_strategy_lxml import PruningContentFilterLXML
from .models import CrawlResult, MarkdownGenerationResult, DisplayMode
from .components.crawler_monitor import CrawlerMonitor
from .link_preview import LinkPreview
from .async_dispatcher import (
    MemoryAdaptiveDispatcher,
    SemaphoreDispatcher,
    RateLimiter,
    BaseDispatcher,
)
from .docker_client import Crawl4aiDockerClient
from .hub import CrawlerHub
from .browser_profiler import BrowserProfiler
from .deep_crawling import (
    DeepCrawlStrategy,
    BFSDeepCrawlStrategy,
    FilterChain,
    URLPatternFilter,
    DomainFilter,
    ContentTypeFilter,
    URLFilter,
    FilterStats,
    SEOFilter,
    KeywordRelevanceScorer,
    URLScorer,
    CompositeScorer,
    DomainAuthorityScorer,
    FreshnessScorer,
    PathDepthScorer,
    BestFirstCrawlingStrategy,
    DFSDeepCrawlStrategy,
    DeepCrawlDecorator,
    ContentRelevanceFilter,
    ContentTypeScorer,
)
# NEW: Import AsyncUrlSeeder
from .async_url_seeder import AsyncUrlSeeder
from .domain_mapper import DomainMapper
# Adaptive Crawler
from .adaptive_crawler import (
    AdaptiveCrawler,
    AdaptiveConfig,
    CrawlState,
    CrawlStrategy,
    StatisticalStrategy
)

# C4A Script Language Support
from .script import (
    compile as c4a_compile,
    validate as c4a_validate,
    compile_file as c4a_compile_file,
    CompilationResult,
    ValidationResult,
    ErrorDetail
)

# Browser Adapters
from .browser_adapter import (
    BrowserAdapter,
    PlaywrightAdapter,
    UndetectedAdapter
)

from .utils import (
    start_colab_display_server,
    setup_colab_environment,
    hooks_to_string
)

__all__ = [
    "AsyncLoggerBase",
    "AsyncLogger",
    "AsyncWebCrawler",
    "BrowserProfiler",
    "LLMConfig",
    "GeolocationConfig",
    # NEW: Add SeedingConfig and VirtualScrollConfig
    "SeedingConfig",
    "VirtualScrollConfig",
    # NEW: Add AsyncUrlSeeder
    "AsyncUrlSeeder",
    # DomainMapper
    "DomainMapper",
    "DomainMapperConfig",
    # Adaptive Crawler
    "AdaptiveCrawler",
    "AdaptiveConfig", 
    "CrawlState",
    "CrawlStrategy",
    "StatisticalStrategy",
    "DeepCrawlStrategy",
    "BFSDeepCrawlStrategy",
    "BestFirstCrawlingStrategy",
    "DFSDeepCrawlStrategy",
    "FilterChain",
    "URLPatternFilter",
    "ContentTypeFilter",
    "DomainFilter",
    "FilterStats",
    "URLFilter",
    "SEOFilter",
    "KeywordRelevanceScorer",
    "URLScorer",
    "CompositeScorer",
    "DomainAuthorityScorer",
    "FreshnessScorer",
    "PathDepthScorer",
    "DeepCrawlDecorator",
    "CrawlResult",
    "CrawlerHub",
    "CacheMode",
    "MatchMode",
    "ContentScrapingStrategy",
    "WebScrapingStrategy",
    "LXMLWebScrapingStrategy",
    "BrowserConfig",
    "CrawlerRunConfig",
    "HTTPCrawlerConfig",
    "ExtractionStrategy",
    "LLMExtractionStrategy",
    "CosineStrategy",
    "JsonCssExtractionStrategy",
    "JsonXPathExtractionStrategy",
    "JsonLxmlExtractionStrategy",
    "RegexExtractionStrategy",
    "ChunkingStrategy",
    "RegexChunking",
    "DefaultMarkdownGenerator",
    "TableExtractionStrategy",
    "DefaultTableExtraction",
    "NoTableExtraction",
    "LLMTableExtraction",
    "RelevantContentFilter",
    "PruningContentFilter",
    "PruningContentFilterLXML",
    "BM25ContentFilter",
    "LLMContentFilter",
    "BaseDispatcher",
    "MemoryAdaptiveDispatcher",
    "SemaphoreDispatcher",
    "RateLimiter",
    "CrawlerMonitor",
    "LinkPreview",
    "DisplayMode",
    "MarkdownGenerationResult",
    "Crawl4aiDockerClient",
    "ProxyRotationStrategy",
    "RoundRobinProxyStrategy",
    "ProxyConfig",
    "start_colab_display_server",
    "setup_colab_environment",
    "hooks_to_string",
    # C4A Script additions
    "c4a_compile",
    "c4a_validate", 
    "c4a_compile_file",
    "CompilationResult",
    "ValidationResult",
    "ErrorDetail",
    # Browser Adapters
    "BrowserAdapter",
    "PlaywrightAdapter", 
    "UndetectedAdapter",
    "LinkPreviewConfig"
]


# def is_sync_version_installed():
#     try:
#         import selenium # noqa

#         return True
#     except ImportError:
#         return False


# if is_sync_version_installed():
#     try:
#         from .web_crawler import WebCrawler

#         __all__.append("WebCrawler")
#     except ImportError:
#         print(
#             "Warning: Failed to import WebCrawler even though selenium is installed. This might be due to other missing dependencies."
#         )
# else:
#     WebCrawler = None
#     # import warnings
#     # print("Warning: Synchronous WebCrawler is not available. Install crawl4ai[sync] for synchronous support. However, please note that the synchronous version will be deprecated soon.")

# Disable all Pydantic warnings
warnings.filterwarnings("ignore", module="pydantic")
# pydantic_warnings.filter_warnings()
```

### Core Architecture Module: `crawl4ai/__version__.py`
```
# crawl4ai/__version__.py

# This is the version that will be used for stable releases
__version__ = "0.9.4"

# For nightly builds, this gets set during build process
__nightly_version__ = None


```

### Core Architecture Module: `crawl4ai/adaptive_crawler.py`
```
"""
Adaptive Web Crawler for Crawl4AI

This module implements adaptive information foraging for efficient web crawling.
It determines when sufficient information has been gathered to answer a query,
avoiding unnecessary crawls while ensuring comprehensive coverage.
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Set, Tuple, Any, Union
from dataclasses import dataclass, field
import asyncio
import pickle
import os
import json
import math
from collections import defaultdict, Counter
import re
from pathlib import Path

from crawl4ai.async_webcrawler import AsyncWebCrawler
from crawl4ai.async_configs import CrawlerRunConfig, LinkPreviewConfig, LLMConfig
from crawl4ai.models import Link, CrawlResult
import numpy as np

@dataclass
class CrawlState:
    """Tracks the current state of adaptive crawling"""
    crawled_urls: Set[str] = field(default_factory=set)
    knowledge_base: List[CrawlResult] = field(default_factory=list)
    pending_links: List[Link] = field(default_factory=list)
    query: str = ""
    metrics: Dict[str, float] = field(default_factory=dict)
    
    # Statistical tracking
    term_frequencies: Dict[str, int] = field(default_factory=lambda: defaultdict(int))
    document_frequencies: Dict[str, int] = field(default_factory=lambda: defaultdict(int))
    documents_with_terms: Dict[str, Set[int]] = field(default_factory=lambda: defaultdict(set))
    total_documents: int = 0
    
    # History tracking for saturation
    new_terms_history: List[int] = field(default_factory=list)
    crawl_order: List[str] = field(default_factory=list)
    
    # Embedding-specific tracking (only if strategy is embedding)
    kb_embeddings: Optional[Any] = None  # Will be numpy array
    query_embeddings: Optional[Any] = None  # Will be numpy array
    expanded_queries: List[str] = field(default_factory=list)
    coverage_shape: Optional[Any] = None  # Alpha shape
    semantic_gaps: List[Tuple[List[float], float]] = field(default_factory=list)  # Serializable
    embedding_model: str = ""
    
    def save(self, path: Union[str, Path]):
        """Save state to disk for persistence"""
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        # Convert CrawlResult objects to dicts for serialization
        state_dict = {
            'crawled_urls': list(self.crawled_urls),
            'knowledge_base': [self._crawl_result_to_dict(cr) for cr in self.knowledge_base],
            'pending_links': [link.model_dump() for link in self.pending_links],
            'query': self.query,
            'metrics': self.metrics,
            'term_frequencies': dict(self.term_frequencies),
            'document_frequencies': dict(self.document_frequencies),
            'documents_with_terms': {k: list(v) for k, v in self.documents_with_terms.items()},
            'total_documents': self.total_documents,
            'new_terms_history': self.new_terms_history,
            'crawl_order': self.crawl_order,
            # Embedding-specific fields (convert numpy arrays to lists for JSON)
            'kb_embeddings': self.kb_embeddings.tolist() if self.kb_embeddings is not None else None,
            'query_embeddings': self.query_embeddings.tolist() if self.query_embeddings is not None else None,
            'expanded_queries': self.expanded_queries,
            'semantic_gaps': self.semantic_gaps,
            'embedding_model': self.embedding_model
        }
        
        with open(path, 'w') as f:
            json.dump(state_dict, f, indent=2)
    
    @classmethod
    def load(cls, path: Union[str, Path]) -> 'CrawlState':
        """Load state from disk"""
        path = Path(path)
        with open(path, 'r') as f:
            state_dict = json.load(f)
        
        state = cls()
        state.crawled_urls = set(state_dict['crawled_urls'])
        state.knowledge_base = [cls._dict_to_crawl_result(d) for d in state_dict['knowledge_base']]
        state.pending_links = [Link(**link_dict) for link_dict in state_dict['pending_links']]
        state.query = state_dict['query']
        state.metrics = state_dict['metrics']
        state.term_frequencies = defaultdict(int, state_dict['term_frequencies'])
        state.document_frequencies = defaultdict(int, state_dict['document_frequencies'])
        state.documents_with_terms = defaultdict(set, {k: set(v) for k, v in state_dict['documents_with_terms'].items()})
        state.total_documents = state_dict['total_documents']
        state.new_terms_history = state_dict['new_terms_history']
        state.crawl_order = state_dict['crawl_order']
        
        # Load embedding-specific fields (convert lists back to numpy arrays)
        
        state.kb_embeddings = np.array(state_dict['kb_embeddings']) if state_dict.get('kb_embeddings') is not None else None
        state.query_embeddings = np.array(state_dict['query_embeddings']) if state_dict.get('query_embeddings') is not None else None
        state.expanded_queries = state_dict.get('expanded_queries', [])
        state.semantic_gaps = state_dict.get('semantic_gaps', [])
        state.embedding_model = state_dict.get('embedding_model', '')
        
        return state
    
    @staticmethod
    def _crawl_result_to_dict(cr: CrawlResult) -> Dict:
        """Convert CrawlResult to serializable dict"""
        # Extract markdown content safely
        markdown_content = ""
        if hasattr(cr, 'markdown') and cr.markdown:
            if hasattr(cr.markdown, 'raw_markdown'):
                markdown_content = cr.markdown.raw_markdown
            else:
                markdown_content = str(cr.markdown)
        
        return {
            'url': cr.url,
            'content': markdown_content,
            'links': cr.links if hasattr(cr, 'links') else {},
            'metadata': cr.metadata if hasattr(cr, 'metadata') else {}
        }
    
    @staticmethod
    def _dict_to_crawl_result(d: Dict):
        """Convert dict back to CrawlResult"""
        # Create a mock object that has the minimal interface we need
        class MockMarkdown:
            def __init__(self, content):
                self.raw_markdown = content
        
        class MockCrawlResult:
            def __init__(self, url, content, links, metadata):
                self.url = url
                self.markdown = MockMarkdown(content)
                self.links = links
                self.metadata = metadata
        
        return MockCrawlResult(
            url=d['url'],
            content=d.get('content', ''),
            links=d.get('links', {}),
            metadata=d.get('metadata', {})
        )


@dataclass
class AdaptiveConfig:
    """Configuration for adaptive crawling"""
    confidence_threshold: float = 0.7
    max_depth: int = 5
    max_pages: int = 20
    top_k_links: int = 3
    min_gain_threshold: float = 0.1
    strategy: str = "statistical"  # statistical, embedding, llm
    
    # Advanced parameters
    saturation_threshold: float = 0.8
    consistency_threshold: float = 0.7
    coverage_weight: float = 0.4
    consistency_weight: float = 0.3
    saturation_weight: float = 0.3
    
    # Link scoring parameters
    relevance_weight: float = 0.5
    novelty_weight: float = 0.3
    authority_weight: float = 0.2
    
    # Persistence
    save_state: bool = False
    state_path: Optional[str] = None
    
    # Embedding strategy parameters
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    embedding_llm_config: Optional[Union[LLMConfig, Dict]] = None  # Separate config for embeddings
    query_llm_config: Optional[Union[LLMConfig, Dict]] = None  # Config for query expansion (chat completion)
    n_query_variations: int = 10
    coverage_threshold: float = 0.85
    alpha_shape_alpha: float = 0.5
    
    # Minimum confidence threshold for relevance
    embedding_min_confidence_threshold: float = 0.1  # Below this, content is considered completely irrelevant
    # Example: If confidence < 0.1, stop immediately as query and content are unrelated
    
    # Embedding confidence calculation parameters
    embedding_coverage_radius: float = 0.2  # Distance threshold for "covered" query points
    # Example: With radius=0.2, a query point is considered covered if ANY document 
    # is within cosine distance 0.2 (very similar). Smaller = stricter coverage requirement
    
    embedding_k_exp: float = 1.0  # Exponential decay factor for distance-to-score mapping
    # Example: score = exp(-k_exp * distance). With k_exp=1, distance 0.2 → score 0.82,
    # distance 0.5 → score 0.61. Higher k_exp = steeper decay = more emphasis on very close matches
    
    embedding_nearest_weight: float = 0.7  # Weight for nearest neighbor in hybrid scoring
    embedding_top_k_weight: float = 0.3  # Weight for top-k average in hybrid scoring
    # Example: If nearest doc has score 0.9 and top-3 avg is 0.6, final = 0.7*0.9 + 0.3*0.6 = 0.81
    # Higher nearest_weight = more focus on best match vs neighborhood density
    
    # Embedding link selection parameters  
    embedding_overlap_threshold: float = 0.85  # Similarity threshold for penalizing redundant links
    # Example: Links with >0.85 similarity to existing KB get penalized to avoid redundancy
    # Lower = more aggressive deduplication, Higher = allow more similar content
    
    # Link preview timeout (seconds)
    link_preview_timeout: float = 5.0

    # Embedding stopping criteria parameters
    embedding_min_relative_improvement: float = 0.1  # Minimum relative improvement to continue
    # Example: If confidence is 0.6, need improvement > 0.06 per batch to continue crawling
    # Lower = more patient crawling, Higher = stop earlier when progress slows
    
    embedding_validation_min_score: float = 0.3  # Minimum validation score to trust convergence
    # Example: Even if learning converged, keep crawling if validation score < 0.4
    # This prevents premature stopping when we haven't truly covered the qu
```

### Core Architecture Module: `crawl4ai/antibot_detector.py`
```
"""
Anti-bot detection heuristics for crawl results.

Examines HTTP status codes and HTML content patterns to determine
if a crawl was blocked by anti-bot protection.

Detection philosophy: false positives are cheap (the fallback mechanism
rescues them), false negatives are catastrophic (user gets garbage).
Err on the side of detection.

Detection is layered:
- HTTP 403/503 with HTML content → always blocked (these are never desired content)
- Tier 1 patterns (structural markers) trigger on any page size
- Tier 2 patterns (generic terms) trigger on short pages or any error status
- Tier 3 structural integrity catches silent blocks and empty shells
"""

import re
from typing import Optional, Tuple


# ---------------------------------------------------------------------------
# Tier 1: High-confidence structural markers (single signal sufficient)
# These are unique to block pages and virtually never appear in real content.
# ---------------------------------------------------------------------------
_TIER1_PATTERNS = [
    # Akamai — full reference pattern: Reference #18.2d351ab8.1557333295.a4e16ab
    (re.compile(r"Reference\s*#\s*[\d]+\.[0-9a-f]+\.\d+\.[0-9a-f]+", re.IGNORECASE),
     "Akamai block (Reference #)"),
    # Akamai — "Pardon Our Interruption" challenge page
    (re.compile(r"Pardon\s+Our\s+Interruption", re.IGNORECASE),
     "Akamai challenge (Pardon Our Interruption)"),
    # Cloudflare — challenge form with anti-bot token
    (re.compile(r'challenge-form.*?__cf_chl_f_tk=', re.IGNORECASE | re.DOTALL),
     "Cloudflare challenge form"),
    # Cloudflare — error code spans (1020 Access Denied, 1010, 1012, 1015)
    (re.compile(r'<span\s+class="cf-error-code">\d{4}</span>', re.IGNORECASE),
     "Cloudflare firewall block"),
    # Cloudflare — IUAM challenge script
    (re.compile(r'/cdn-cgi/challenge-platform/\S+orchestrate', re.IGNORECASE),
     "Cloudflare JS challenge"),
    # PerimeterX / HUMAN — block page with app ID assignment (not prose mentions)
    (re.compile(r"window\._pxAppId\s*=", re.IGNORECASE),
     "PerimeterX block"),
    # PerimeterX — captcha CDN
    (re.compile(r"captcha\.px-cdn\.net", re.IGNORECASE),
     "PerimeterX captcha"),
    # DataDome — captcha delivery domain (structural, not the word "datadome")
    (re.compile(r"captcha-delivery\.com", re.IGNORECASE),
     "DataDome captcha"),
    # Imperva/Incapsula — resource iframe
    (re.compile(r"_Incapsula_Resource", re.IGNORECASE),
     "Imperva/Incapsula block"),
    # Imperva/Incapsula — incident ID
    (re.compile(r"Incapsula\s+incident\s+ID", re.IGNORECASE),
     "Imperva/Incapsula incident"),
    # Sucuri firewall
    (re.compile(r"Sucuri\s+WebSite\s+Firewall", re.IGNORECASE),
     "Sucuri firewall block"),
    # Kasada
    (re.compile(r"KPSDK\.scriptStart\s*=\s*KPSDK\.now\(\)", re.IGNORECASE),
     "Kasada challenge"),
    # Network security block — Reddit and other platforms serve large SPA shells
    # with this message buried under 100KB+ of CSS/JS
    (re.compile(r"blocked\s+by\s+network\s+security", re.IGNORECASE),
     "Network security block"),
]

# ---------------------------------------------------------------------------
# Tier 2: Medium-confidence patterns — only match on SHORT pages (< 10KB)
# These terms appear in real content (articles, login forms, security blogs)
# so we require the page to be small to avoid false positives.
# ---------------------------------------------------------------------------
_TIER2_PATTERNS = [
    # Akamai / generic — "Access Denied" (extremely common on legit 403s too)
    (re.compile(r"Access\s+Denied", re.IGNORECASE),
     "Access Denied on short page"),
    # Cloudflare — "Just a moment" / "Checking your browser"
    (re.compile(r"Checking\s+your\s+browser", re.IGNORECASE),
     "Cloudflare browser check"),
    (re.compile(r"<title>\s*Just\s+a\s+moment", re.IGNORECASE),
     "Cloudflare interstitial"),
    # CAPTCHA on a block page (not a login form — login forms are big pages)
    (re.compile(r'class=["\']g-recaptcha["\']', re.IGNORECASE),
     "reCAPTCHA on block page"),
    (re.compile(r'class=["\']h-captcha["\']', re.IGNORECASE),
     "hCaptcha on block page"),
    # PerimeterX block page title
    (re.compile(r"Access\s+to\s+This\s+Page\s+Has\s+Been\s+Blocked", re.IGNORECASE),
     "PerimeterX block page"),
    # Generic block phrases (only on short pages to avoid matching articles)
    (re.compile(r"blocked\s+by\s+security", re.IGNORECASE),
     "Blocked by security"),
    (re.compile(r"Request\s+unsuccessful", re.IGNORECASE),
     "Request unsuccessful (Imperva)"),
]

_TIER2_MAX_SIZE = 10000  # Only check tier 2 patterns on pages under 10KB

# ---------------------------------------------------------------------------
# Tier 3: Structural integrity — catches silent blocks, anti-bot redirects,
# incomplete renders that pass pattern detection but are structurally broken
# ---------------------------------------------------------------------------
_STRUCTURAL_MAX_SIZE = 50000  # Only check pages under 50KB
_CONTENT_ELEMENTS_RE = re.compile(
    r'<(?:p|h[1-6]|article|section|li|td|a|pre)\b', re.IGNORECASE
)
_SCRIPT_TAG_RE = re.compile(r'<script\b', re.IGNORECASE)
_STYLE_TAG_RE = re.compile(r'<style\b[\s\S]*?</style>', re.IGNORECASE)
_SCRIPT_BLOCK_RE = re.compile(r'<script\b[\s\S]*?</script>', re.IGNORECASE)
_TAG_RE = re.compile(r'<[^>]+>')
_BODY_RE = re.compile(r'<body\b', re.IGNORECASE)

# ---------------------------------------------------------------------------
# Thresholds
# ---------------------------------------------------------------------------
_BLOCK_PAGE_MAX_SIZE = 5000   # 403 + short page = likely block
_EMPTY_CONTENT_THRESHOLD = 100  # 200 + near-empty = JS-blocked render


def _looks_like_data(html: str) -> bool:
    """Check if content looks like a JSON/XML API response (not an HTML block page)."""
    stripped = html.strip()
    if not stripped:
        return False
    # Raw JSON/XML (not wrapped in HTML)
    if stripped[0] in ('{', '['):
        return True
    # Browser-rendered JSON: browsers wrap raw JSON in <html><body><pre>{...}</pre>
    if stripped[:10].lower().startswith(('<html', '<!')):
        if re.search(r'<body[^>]*>\s*<pre[^>]*>\s*[{\[]', stripped[:500], re.IGNORECASE):
            return True
        return False
    # Other XML-like content
    return stripped[0] == '<'


def _structural_integrity_check(html: str) -> Tuple[bool, str]:
    """
    Tier 3: Structural integrity check for pages that pass pattern detection
    but are structurally broken — incomplete renders, anti-bot redirects, empty shells.

    Only applies to pages < 50KB that aren't JSON/XML.

    Returns:
        Tuple of (is_blocked, reason).
    """
    html_len = len(html)

    # Skip large pages (unlikely to be block pages) and data responses
    if html_len > _STRUCTURAL_MAX_SIZE or _looks_like_data(html):
        return False, ""

    signals = []

    # Signal 1: No <body> tag — definitive structural failure
    if not _BODY_RE.search(html):
        return True, f"Structural: no <body> tag ({html_len} bytes)"

    # Signal 2: Minimal visible text after stripping scripts/styles/tags
    body_match = re.search(r'<body\b[^>]*>([\s\S]*)</body>', html, re.IGNORECASE)
    body_content = body_match.group(1) if body_match else html
    stripped = _SCRIPT_BLOCK_RE.sub('', body_content)
    stripped = _STYLE_TAG_RE.sub('', stripped)
    visible_text = _TAG_RE.sub('', stripped).strip()
    visible_len = len(visible_text)
    if visible_len < 50:
        signals.append("minimal_text")

    # Signal 3: No content elements (semantic HTML)
    content_elements = len(_CONTENT_ELEMENTS_RE.findall(html))
    if content_elements == 0:
        signals.append("no_content_elements")

    # Signal 4: Script-heavy shell — scripts present but no content
    script_count = len(_SCRIPT_TAG_RE.findall(html))
    if script_count > 0 and content_elements == 0 and visible_len < 100:
        signals.append("script_heavy_shell")

    # Scoring
    signal_count = len(signals)
    if signal_count >= 2:
        return True, f"Structural: {', '.join(signals)} ({html_len} bytes, {visible_len} chars visible)"

    if signal_count == 1 and html_len < 5000:
        return True, f"Structural: {signals[0]} on small page ({html_len} bytes, {visible_len} chars visible)"

    return False, ""


def is_blocked(
    status_code: Optional[int],
    html: str,
    error_message: Optional[str] = None,
) -> Tuple[bool, str]:
    """
    Detect if a crawl result indicates anti-bot blocking.

    Uses layered detection to maximize coverage while minimizing false positives:
    - Tier 1 patterns (structural markers) trigger on any page size
    - Tier 2 patterns (generic terms) only trigger on short pages (< 10KB)
    - Tier 3 structural integrity catches silent blocks and empty shells
    - Status-code checks require corroborating content signals

    Args:
        status_code: HTTP status code from the response.
        html: Raw HTML content from the response.
        error_message: Error message from the crawl result, if any.

    Returns:
        Tuple of (is_blocked, reason). reason is empty string when not blocked.
    """
    html = html or ""
    html_len = len(html)

    # --- HTTP 429 is always rate limiting ---
    if status_code == 429:
        return True, "HTTP 429 Too Many Requests"

    # --- Check for tier 1 patterns (high confidence, any page size) ---
    # First check the raw start of the page (fast path for small pages).
    # Then, for large pages, also check a stripped version (scripts/styles
    # removed) because modern block pages bury text under 100KB+ of CSS/JS.
    snippet = html[:15000]
    if snippet:
        for pattern, reason in _TIER1_PATTERNS:
            if pattern.search(snippet):
                return True, reason

    # Large-page deep scan: strip scripts/styles and re-check tier 1
    if html_len > 15000:
        _stripped_for_t1 = _SCRIPT_BLOCK_RE.sub('', html[:50000
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2337** (2026-10-05): **The cloud launch on main: the docs banner, the docs home, the daily notice, with the soft-launch words**
  *Symptoms*: Brings the cloud-launch branch to main (a clean merge), so the next library release ships what docs.crawl4ai.com already runs:  - the docs site's cloud banner (overrides/partials/cloud-banner.html, its css and js, the mkdocs hook) and the docs home's cloud section; - crawl4ai/cloud_notice.py: the short notice when the library or the CLI runs (daily while the soft launch runs, then once per version; CRAWL4AI_NO_CLOUD_NOTICE=1 turns it off), with its unit tests; - the installation page's cloud note; the README's two-ways table.  Every line says "free credit to start" and "prices can change while we learn, what you buy stays yours": no amount, no end date. Includes #2336.

- **Issue #2336** (2026-10-05): **README and the launch banner: free credit to start, no amount and no end date**
  *Symptoms*: The cloud lines and the banner images stop naming the gift's size and an end date. They say "free credit to start, no card" and "prices can change while we learn, what you buy stays yours", so a price change during the soft launch never contradicts the repo.  - README: the banner alt text, the "Verify your email" line and the price row of the two-ways table. - docs/assets/cloud-launch-banner-dark.svg and -light.svg: the same words in the images.  No code change.

- **Issue #2299** (2026-10-03): **fix(docker): report a refused seed as one failed result, not a dead batch**
  *Symptoms*: Fixes #2288  ## Summary  `_normalize_and_validate_seeds` validated every seed up front and raised on the **first** one the destination check refused, so a single internal address — or a single hostname that simply doesn't resolve, which is what a dead domain in a stale sitemap looks like — failed the whole `/crawl` request with a 400 and zero results. The caller couldn't tell which seed it was, so its only recovery was to split the batch and retry.  A refused seed now comes back as **one failed result among the batch**, the way a `robots.txt` refusal already does inside a batch, on both `/crawl` and `/crawl/stream`:  ``` POST /crawl  {"urls": ["https://example.com/", "https://no-such-host-12345.example/"]}  200 {"success": true, "results": [   {"url": "https://example.com/",                "success": true,  ...},   {"url": "https://no-such-host-12345.example/", "success": false, "status_code": 403,    "error_message": "URL blocked (SSRF protection): URL blocked",    "response_headers": {"X-Egress-Status": "Blocked by egress policy"}} ]} ```  Four decisions a reviewer would otherwise have to reverse-engineer:  - **The message stays opaque, so this isn't a resolution oracle.** `detail` from   `validate_url_destination` is carried through verbatim. `egress_broker._resolve`   turns `socket.gaierror` into `EgressBlocked`, so *resolved to an internal   address* and *does not resolve* both produce the same `URL blocked`. A caller   learns **which** seed was refused — it already know

- **Issue #2281** (2026-09-23): **Release v0.9.4**
  *Symptoms*: ## Summary  Release v0.9.4. Already tagged and published to PyPI from `133e1d9`. This PR brings `main` up to the release.  - Security: closes three coordinated-disclosure advisories. Two SSRF paths (robots.txt fetch and link preview through the URL seeder) now go through the Docker server's pinning egress proxy, and the untrusted-config gate re-checks `{"type": "dict"}` wrappers. - Performance: adds `PruningContentFilterLXML`, about 10x faster pruning with identical output, now the default. `PruningContentFilter` is deprecated. - Bug fixes: deep-crawl speed, tables with `rowspan`/`colspan`, robots.txt rules, pooled browser recycling, and the Docker Playground.  No breaking changes.  Release notes: [docs/blog/release-v0.9.4.md](https://github.com/unclecode/crawl4ai/blob/release/v0.9.4/docs/blog/release-v0.9.4.md)  `origin/main` is an ancestor of this branch, so it merges as a fast-forward. 

- **Issue #2280** (2026-09-23): **docs(security): list fixed issues and features per release through v0.9.3**
  *Symptoms*: ## Summary  Follow-up to #2216 / #2269. That PR fixed the supported-versions table. This PR brings the rest of `SECURITY.md` up to date, since the "Known Security Issues" and "Security Features" sections still stopped at v0.8.1.  - **Known Security Issues**: one table per release from v0.8.0 to v0.9.3, newest first. Each row has ID (GHSA / CVE where one exists), severity, component (Library or Docker API), description, and fix. Covers the 5 GHSA advisories in v0.9.3, the v0.9.0 secure-by-default rework, and the v0.8.5 to v0.8.9 patches. - **Security Features**: tagged by the version that introduced them (v0.9.3+, v0.9.0+, v0.8.7+ to v0.8.9+, v0.8.1+, v0.8.0+). v0.8.0 entries note what v0.9.0 replaced. - **Supported Versions**: one line under the table stating that fixes are not backported and 0.8.x users should upgrade. - **Best practices**: hooks note updated for declarative hooks in 0.9.x. - **Acknowledgments**: now points to `SECURITY-CREDITS.md` instead of a stale two-name list. - "Last updated" bumped to September 2026.  Every row was checked against `CHANGELOG.md`, the release notes in `docs/blog/`, `SECURITY-CREDITS.md`, the git log from v0.8.1 to v0.9.3, and the current code on `develop`.  ## List of files changed and why  - `SECURITY.md` - add per-release security fix tables, version-tagged feature list, no-backport note, and refreshed acknowledgments and date.  ## How Has This Been Tested?  Documentation only, no code change. Each claim was verifi

- **Issue #2279** (2026-09-22): **chore(ci): drop the dead Google Apps Script stargazer step**
  *Symptoms*: ## What  Removes the `Send to Google Apps Script (Stars only)` step from `.github/workflows/main.yml`.  ## Why  The Apps Script endpoint behind `GOOGLE_SCRIPT_ENDPOINT` logged new stargazers to a Google Sheet (added in #1249). It has been returning HTTP 403 on every star, which is what #2255 reported, and the sheet is no longer used.  #2263 added `continue-on-error: true` so the failure stopped blocking the Discord notification. That unblocked the notification but left a curl that fails on every single star, forever. Since nothing consumes the sheet, the step should just go.  ## Effect  - Discord stargazer notification: unchanged, still fires. - All five triggers (`issues`, `issue_comment`, `pull_request`, `discussion`, `watch`): unchanged. - The `GOOGLE_SCRIPT_ENDPOINT` repo secret is now unreferenced anywhere in the repo and can be deleted. - The Apps Script deployment itself lives in a personal Google account and should be unpublished there separately.  ## Note on when this takes effect  `watch` events run the workflow from the **default branch (`main`)**. Both this change and the #2263 fix are on `develop`, so stars will keep failing until `develop` reaches `main`.  Refs #2255

- **Issue #2278** (2026-09-22): **fix(robots): don't patch robotparser on Python 3.14+**
  *Symptoms*: ## Summary  Follow-up to #2229, which fixed the `Disallow: /*?` half of #2225. This fixes two more bugs in the same block of code, both of which only bite on **Python 3.14+**.  Python 3.14 rewrote `urllib.robotparser`: native wildcards, `$`, and RFC 9309 longest-match ranking. Crawl4AI carries two workarounds for the *old* parser, and on 3.14 each one now makes correct stdlib behaviour worse.  ### 1. The wildcard monkey patch flattens rule ranking  `crawl4ai/utils.py` replaces `RuleLine.applies_to` unconditionally. On 3.14 that method returns the **match length**, used to rank competing rules; our patch returns a `bool`, so `True == 1` and every wildcard rule drops to the lowest possible priority.  ``` User-agent: * Disallow: / Allow: /public/*.html ```  | URL | 3.14 stdlib | 3.14 + patch | |---|---|---| | `/public/a.html` | allowed | **denied** 🐞 | | `/private/a.html` | denied | denied |  ### 2. The bare-`?` rewrite outranks a narrower `Allow:`  `_preserve_bare_query` rewrites `/*?` to `/*?*` so the `?` survives path normalization. Below 3.14 that is exactly right and still needed. On 3.14 it is wrong: `/*?*` matches to end of string, so it now **outranks** a narrower `Allow:` that the raw `/*?` would have lost to.  ``` User-agent: * Allow: /*?q= Disallow: /*? ```  | URL | 3.14 stdlib | 3.14 + rewrite | |---|---|---| | `/search?q=1` | allowed | **denied** 🐞 | | `/search?x=1` | denied | denied |  Net effect of both: on 3.14, Crawl4AI skipped pages robots.txt explicitly perm
  **Post-Mortem & Fix Analysis**:
  > Kept this separate from #2229 instead of rolling it in — it's really a different bug that just happens to sit in the same few lines. #2229 fixed the rule text; this one is about the patch itself doing the wrong thing on 3.14.  If you're on 3.14, this is the one to look at. The stdlib parser there is already RFC 9309 compliant, so we were overriding good behavior with worse. Nothing changes below 3.14.  Thanks @Nalhin for #2229 — the `/*?` → `/*?*` trick is what sent me digging here in the first place. 
  > Both findings were right — fixed in 7e17809.  **1 (medium).** Confirmed before fixing, on 3.14.7: with `Allow: /*?q=` + `Disallow: /*?`, the stdlib allows `/search?q=1` and we denied it. My last commit gated the monkey patch and left the rewrite running everywhere, which is half a fix — thanks for catching it. `_preserve_bare_query` is now behind the same `sys.version_info < (3, 14)`, and the docstring says why the two forms are only equivalent below 3.14.  Worth noting the split is real, not something to delete: on 3.12 the rewrite gives the right answers (`/search?q=1` allowed, `/search?x=1` denied), because those parsers take the first matching rule and length can't change the winner.  **2 (low).** Done — `RuleLine` import moved inside the branch, duplicate `import re` dropped. `import sys` stays at module scope since the condition needs it.  Added two tests. `test_query_allow_outranks_bare_query_disallow` is the regression for your case; reverting just the call-site gate fails it o

- **Issue #2269** (2026-09-22): **docs: list 0.9.x as supported**
  *Symptoms*: ## Summary  Add the current 0.9.x release line to the security policy's supported-version table while retaining support for 0.8.x.  Fixes #2216  ## List of files changed and why  - `SECURITY.md` — list the current 0.9.x stable line as supported.  ## How Has This Been Tested?  - `git diff --check` - A targeted Python check verified that the major/minor line in `crawl4ai/__version__.py` has a supported row in `SECURITY.md`.  ## Checklist:  - [x] My code follows the style guidelines of this project - [x] I have performed a self-review of my own code - [x] N/A — this documentation-only change has no code requiring comments - [x] I have made corresponding changes to the documentation - [x] N/A — no unit-testable runtime behavior changed - [x] N/A — the targeted documentation checks pass; existing unit tests are unaffected 
  **Post-Mortem & Fix Analysis**:
  > Thanks for your contribution :)

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

### Incident Patch 1: `133e1d92` (2026-09-23)
**Commit Message**: docs: release notes, changelog, README, and security credits for v0.9.4

Bump the version to 0.9.4 and add the v0.9.4 fixes to SECURITY.md.

**File**: `CHANGELOG.md` (modified, +57/-0)
```diff
@@ -5,6 +5,63 @@ All notable changes to Crawl4AI will be documented in this file.
 The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
 and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
 
+## [0.9.4] - 2026-09-23
+
+0.9.4 is a security release. It closes three coordinated-disclosure advisories: two SSRF paths that bypassed the Docker server's egress controls, and a trust-boundary bypass that let a non-admin API client read server environment variables. It also makes content pruning about 10x faster with the new lxml-native `PruningContentFilterLXML`, now the default, and ships the bug fixes that accumulated on `develop` since 0.9.3. There are no breaking changes. Users who self-host the Docker server should upgrade.
+
+### Security
+
+- **Blind SSRF via the robots.txt fetch (CWE-918, medium)**: `RobotsParser.can_fetch()` fetched `/robots.txt` on a bare `aiohttp` client that followed redirects and re-resolved the host, so `check_robots_txt` in an untrusted request body could make the Docker server reach internal, loopback, and cloud-metadata addresses. The fetch now goes through the server's pinning egress proxy, which checks every hop and dials the pinned IP. Credit: [arpe1618](https://github.com/arpe1618). (GHSA-f77g-77vp-r96v)
+- **SSRF with response disclosure via `link_preview_config` (CWE-918, high)**: the URL seeder fetched every link on a crawled page with its own `httpx` client, outside the egress controls, and returned each page's parsed `<head>` to the caller. The seeder's fetches now go through the same pinning egress proxy, and `LinkPreviewConfig` gets caps on `max_links`, `concurrency`, and `timeout` for untrusted bodies. Credit: Ibrahim AlJaafreh ([LinkedIn](https://www.linkedin.com/in/ibrahim-aljaafreh-glitch/)), Cystack RedTeam ([cystack.ps](https://cystack.ps)). (GHSA-wh5w-hmj3-vgg7)
+- **Untrusted-config gate bypass via dict-wrapper laundering (CWE-501, high)**: wrapping a forbidden typed object such as `LLMConfig` in `{"type": "dict", "value": {...}}` slipped it past `UNTRUSTED_ALLOWED_TYPES`, and `from_kwargs` then rebuilt it as trusted. A non-admin client could read any server environment variable, including LLM keys and `SECRET_KEY`. The unwrapped value is now re-checked under the untrusted gate, and `from_kwargs` carries the caller's provenance instead of defaulting to trusted. Credit: Adam Jordan ([adamyordan](https://github.com/adamyordan)). (GHSA-5w5p-vcv6-mm3f)
+
+The two SSRF fixes share one mechanism: the new `crawl4ai/egress_policy.py` holds a process-wide egress proxy URL for the library's own HTTP clients. The Docker server registers its existing `PinningProxy` there at boot. A plain library caller sets nothing and sees no change.
+
+All reporters are credited in `SECURITY-CREDITS.md`. GitHub Security Advisories accompany this release.
+
+### Added
+
+- `PruningContentFilterLXML`: an lxml-native pruning filter. It computes every per-node metric in one bottom-up pass instead of re-walking each subtree, so pruning is O(N) instead of super-linear. Output is byte-identical to `PruningContentFilter`. Measured pruning time: medium page 134 to 13 ms, 6000-card page 2200 to 260 ms. It is now the default for the Docker server's fit filter and the CLI pruning filter.
+- `CRAWL4AI_MAX_TIMEOUT_MS` sets the ceiling for `page_timeout`, `wait_for_timeout`, and `body_visibility_timeout` on untrusted configs. The default stays 60000 ms. (#2212, thanks @damusix; #2266)
+- Docker server: `crawler.pool.max_pages_before_recycle` (default 200) recycles a pooled browser context after it serves that many pages. A context gets slower with sustained use, and the idle janitor never fires on a busy server. Set it to 0 to disable. (#2232, issue #2231)
+
+### Deprecated
+
+- `PruningContentFilter` emits a `DeprecationWarning` on direct use. Switch to `PruningContentFilterLXML`, which takes the same arguments and gives the same output. Existing import paths keep working.
+
+### Fixed
+
+**Crawler and core**
+
+- Deep crawl: BFS no longer re-scans the whole level to match each result to its parent, and BestFirst no longer enqueues the same URL twice. De-duplication keeps the shallowest depth, so no subtree is lost. (#2265, issue #2242)
+- Tables: `rowspan` and `colspan` are expanded into a grid, and `<th>` row headers are kept instead of shifting the row left. Spans are clamped, so one cell cannot hang the parse. (#2261, issue #2258)
+- robots.txt: `Disallow: /*?` no longer blocks the whole site. (#2229, thanks @Nalhin)
+- robots.txt: the wildcard patch is skipped on Python 3.14+, where the standard library already supports wildcards and the patch broke `Allow:` precedence. (#2278)
+- Timeouts: malformed or non-positive timeout values fall back to the 60 s default instead of the configured ceiling. (#2266)
+- Chrome for Testing no longer crashes under `--headless=new` on macOS arm64. `OptimizationHints` is no longer disabled. (#2241, issue #
```

**File**: `Dockerfile` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 FROM python:3.12-slim-bookworm AS build
 
 # C4ai version
-ARG C4AI_VER=0.9.3
+ARG C4AI_VER=0.9.4
 ENV C4AI_VERSION=$C4AI_VER
 LABEL c4ai.version=$C4AI_VER
 
```

**File**: `README.md` (modified, +21/-2)
```diff
@@ -37,9 +37,11 @@ Limited slots._
 
 Crawl4AI turns the web into clean, LLM ready Markdown for RAG, agents, and data pipelines. Fast, controllable, battle tested by a 50k+ star community.
 
-[✨ Check out latest update v0.9.3](#-recent-updates)
+[✨ Check out latest update v0.9.4](#-recent-updates)
 
-✨ **New in v0.9.3**: Security release. Closes five coordinated-disclosure advisories: arbitrary file write, SSRF, and denial of service in the PDF processing path, plus two XSS issues in the Docker Playground. Also ships 33 bug fixes across the Docker server, crawler, and PDF handling. No new features, no breaking changes. [Release notes →](https://github.com/unclecode/crawl4ai/blob/main/docs/blog/release-v0.9.3.md)
+✨ **New in v0.9.4**: Security release. Closes three coordinated-disclosure advisories: two SSRF paths (robots.txt and link preview) that bypassed the Docker server's egress controls, and a config trust-boundary bypass that leaked server environment variables. Also adds `PruningContentFilterLXML`, about 10x faster pruning, now the default. No breaking changes. [Release notes →](https://github.com/unclecode/crawl4ai/blob/main/docs/blog/release-v0.9.4.md)
+
+✨ Recent v0.9.3: Security release. Closes five coordinated-disclosure advisories: arbitrary file write, SSRF, and denial of service in the PDF processing path, plus two XSS issues in the Docker Playground. Also ships 33 bug fixes across the Docker server, crawler, and PDF handling. No new features, no breaking changes. [Release notes →](https://github.com/unclecode/crawl4ai/blob/main/docs/blog/release-v0.9.3.md)
 
 ✨ Recent v0.9.2: Maintenance patch release. Fixes a `MemoryAdaptiveDispatcher` task/page leak when a streaming crawl is closed, Docker Playground "Advanced Config" and Monitor WebSocket auth, Playwright headless-shell packaging, and GPU (`ENABLE_GPU=true`) Docker builds. [Release notes →](https://github.com/unclecode/crawl4ai/blob/main/docs/blog/release-v0.9.2.md)
 
@@ -567,6 +569,23 @@ async def test_news_crawl():
 ## ✨ Recent Updates
 
 <details open>
+<summary><strong>Version 0.9.4 Release Highlights - Security Release and Faster Pruning</strong></summary>
+
+A security release closing three coordinated-disclosure advisories. Two are SSRF paths that did not go through the Docker server's egress rule: the robots.txt fetch behind `check_robots_txt`, and the URL seeder behind `link_preview_config`, which also returned the fetched `<head>` to the caller. Both now go through the server's pinning egress proxy. The third is a bypass of the untrusted-config gate: a `{"type": "dict"}` wrapper let a forbidden `LLMConfig` through, so a non-admin client could read server environment variables.
+
+It also adds `PruningContentFilterLXML`, an lxml-native pruning filter that is about 10x faster and gives byte-identical output. It is now the default, and `PruningContentFilter` is deprecated. Bug fixes cover deep-crawl speed, tables with `rowspan`/`colspan`, robots.txt rules, pooled browser recycling, and the Docker Playground.
+
+No breaking changes.
+
+```bash
+pip install -U crawl4ai
+```
+
+[Full v0.9.4 Release Notes →](https://github.com/unclecode/crawl4ai/blob/main/docs/blog/release-v0.9.4.md)
+
+</details>
+
+<details>
 <summary><strong>Version 0.9.3 Release Highlights - Security Release</strong></summary>
 
 A security release closing five coordinated-disclosure advisories. Four are in the PDF processing path: an arbitrary file write through `PDFContentScrapingStrategy` image-write fields, an SSRF where the PDF download followed redirects into internal addresses, a denial of service from unbounded PDF size and page count, and an XSS from unescaped PDF text in `cleaned_html`. The fifth is a DOM-based XSS in the Docker Playground that could expose the operator's API token.
```

**File**: `SECURITY-CREDITS.md` (modified, +4/-0)
```diff
@@ -21,3 +21,7 @@ We thank the following security researchers for their responsible disclosure:
 | Zhixi "Jace" Sun | GitHub: [manus-use](https://github.com/manus-use) | Arbitrary file write via unconfined PDFContentScrapingStrategy image-write fields in untrusted config bodies (0.9.3) | 2026-08-24 |
 | Nguyen Tran Thanh Lam | GitHub: [c240030](https://github.com/c240030) | SSRF via PDF download redirects, DoS via unbounded PDF size and page count, XSS via unescaped PDF text in cleaned_html (0.9.3) | 2026-07-27 |
 | e1codes | GitHub: [e1codes](https://github.com/e1codes) | DOM-based XSS in the Docker Playground leading to operator API-token theft (0.9.3) | 2026-07-24 |
+| x0root | GitHub: [x0root](https://github.com/x0root) | SSRF in the hosted service at stage.crawl4ai.com | 2026-09-02 |
+| arpe1618 | GitHub: [arpe1618](https://github.com/arpe1618) | Blind SSRF via the robots.txt fetch in RobotsParser.can_fetch bypassing the Docker egress controls (0.9.4) | 2026-09-04 |
+| Ibrahim AlJaafreh - Cystack RedTeam | [LinkedIn](https://www.linkedin.com/in/ibrahim-aljaafreh-glitch/), [cystack.ps](https://cystack.ps) | SSRF with response disclosure via link_preview_config through the URL seeder (0.9.4) | 2026-09-04 |
+| Adam Jordan | GitHub: [adamyordan](https://github.com/adamyordan) | Untrusted-config gate bypass via dict-wrapper laundering, leaking server env vars (0.9.4) | 2026-09-08 |
```

**File**: `SECURITY.md` (modified, +14/-0)
```diff
@@ -96,6 +96,14 @@ When using Crawl4AI as a Python library:
 
 All issues below are fixed in the version named. Advisories with a GHSA id are published under [Security Advisories](https://github.com/unclecode/crawl4ai/security/advisories). Full detail for every release is in [CHANGELOG.md](CHANGELOG.md); reporter credits are in [SECURITY-CREDITS.md](SECURITY-CREDITS.md).
 
+### Fixed in v0.9.4 (2026-09-23)
+
+| ID | Severity | Component | Description | Fix |
+|----|----------|-----------|-------------|-----|
+| GHSA-f77g-77vp-r96v | MEDIUM | Library + Docker API | Blind SSRF via the robots.txt fetch in `RobotsParser.can_fetch`, outside the egress controls; redirects followed, DNS re-resolved (CWE-918) | Fetch routed through the pinning egress proxy; TLS verification restored |
+| GHSA-wh5w-hmj3-vgg7 | HIGH | Library + Docker API | SSRF with response disclosure via `link_preview_config`: the URL seeder fetched every link outside the egress controls and returned the parsed `<head>` (CWE-918) | Seeder fetches routed through the pinning egress proxy; `LinkPreviewConfig` caps `max_links`, `concurrency`, `timeout` for untrusted bodies |
+| GHSA-5w5p-vcv6-mm3f | HIGH | Docker API | Untrusted-config gate bypass via `{"type": "dict"}` wrapper laundering, leaking server env vars such as LLM keys and `SECRET_KEY` (CWE-501) | Unwrapped value re-checked under the untrusted gate; `from_kwargs` carries the caller's provenance |
+
 ### Fixed in v0.9.3 (2026-08-31)
 
 | ID | Severity | Component | Description | Fix |
@@ -191,6 +199,12 @@ Secure-by-default rework of the Docker API server. The pip library is unchanged.
 
 ## Security Features
 
+### v0.9.4+
+
+- **Library egress proxy**: `crawl4ai/egress_policy.py` routes the library's own HTTP clients (URL seeder, robots.txt) through the Docker server's pinning proxy, so they get the same resolve-and-pin rule as the browser
+- **Link preview caps**: `LinkPreviewConfig` `max_links` (100), `concurrency` (10), and `timeout` (10 s) clamped for untrusted bodies
+- **Nested typed objects gated**: `{"type": "dict"}` wrappers are re-checked against `UNTRUSTED_ALLOWED_TYPES`
+
 ### v0.9.3+
 
 - **PDF egress policy**: PDF downloads validate every redirect hop and the peer IP actually read, so the Docker SSRF policy also covers the out-of-browser `requests` path
```

**File**: `crawl4ai/__version__.py` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 # crawl4ai/__version__.py
 
 # This is the version that will be used for stable releases
-__version__ = "0.9.3"
+__version__ = "0.9.4"
 
 # For nightly builds, this gets set during build process
 __nightly_version__ = None
```

**File**: `docs/blog/release-v0.9.4.md` (added, +140/-0)
```diff
@@ -0,0 +1,140 @@
+# Crawl4AI v0.9.4: Security Release and 10x Faster Pruning
+
+*September 2026 - 4 min read*
+
+---
+
+I'm releasing Crawl4AI v0.9.4. It closes three coordinated-disclosure advisories, makes content pruning about 10x faster, and ships the bug fixes that landed on `develop` since 0.9.3. No breaking changes.
+
+Two of the three advisories share one root cause. The Docker server sends every attacker-influenced fetch through one egress rule: reject any destination that resolves to a non-global IP, re-check each redirect hop, and dial the pinned IP so DNS cannot rebind. The browser, the PDF downloader, and the job webhook all went through it. The robots.txt check and the URL seeder did not. They used their own HTTP clients. The third advisory is a trust-boundary bypass that let an ordinary API client read server environment variables.
+
+If you self-host the Docker server, upgrade.
+
+## What's new at a glance
+
+- **SSRF via robots.txt**: `check_robots_txt` could make the server fetch internal addresses
+- **SSRF via link preview**: the seeder fetched internal links and returned their `<head>` to the caller
+- **Config gate bypass**: a dict wrapper let a forbidden `LLMConfig` through and leaked env vars
+- **10x faster pruning**: new `PruningContentFilterLXML`, now the default
+- **Bug fixes**: deep crawl, tables, robots.txt, timeouts, pooled browsers, and the Playground
+
+## Security fixes
+
+### Blind SSRF via the robots.txt fetch
+
+**GHSA-f77g-77vp-r96v, CWE-918, medium.** Credit: [arpe1618](https://github.com/arpe1618).
+
+`RobotsParser.can_fetch()` built `{scheme}://{host}/robots.txt` from the caller's URL and fetched it on a bare `aiohttp` session. No pinning, redirects followed by default, and TLS verification off. `check_robots_txt` is allowed in an untrusted request body, so any API client could choose the host. A public host whose robots.txt answers `302` to `169.254.169.254` was enough to reach cloud metadata.
+
+The response body was not returned to the caller, so this was blind. It still gave internal request delivery, port discovery through timing, and a small boolean side channel through the robots decision.
+
+### SSRF with response disclosure via link_preview_config
+
+**GHSA-wh5w-hmj3-vgg7, CWE-918, high.** Credit: Ibrahim AlJaafreh ([LinkedIn](https://www.linkedin.com/in/ibrahim-aljaafreh-glitch/)), Cystack RedTeam ([cystack.ps](https://cystack.ps)).
+
+`link_preview_config` is allowed in an untrusted body, and `LinkPreviewConfig` had no field allowlist. A client could set `include_external=True` and `include_patterns=["*"]`, point the crawl at a page it controls, and the server would fetch every link on it. That included internal and metadata addresses. The seeder then parsed each response's `<head>` and returned it in `result.links[*].head_data`. Unlike the robots issue, this one disclosed content.
+
+### The fix for both SSRF issues
+
+A new module, `crawl4ai/egress_policy.py`, holds one process-wide egress proxy URL for the library's own HTTP clients. The seeder and the robots.txt fetch now pass `proxy=proxy_url()`. The Docker server already runs a `PinningProxy` for Chromium, and it registers that proxy here at boot.
+
+A proxy, not a validator hook, because a validator resolves the name, checks it, and throws the address away. The client then resolves again when it connects, and that gap is the DNS rebinding window. The proxy resolves, pins, and dials the same address, and it re-checks every redirect hop.
+
+A plain library caller sets nothing. `proxy_url()` returns `None`, which is the default on both `httpx` and `aiohttp`, so nothing changes.
+
+Also in this fix:
+
+- The robots.txt fetch verifies TLS now.
+- `LinkPreviewConfig` is capped for untrusted bodies: `max_links` 100, `concurrency` 10, `timeout` 10 seconds.
+
+### Untrusted-config gate bypass via dict-wrapper laundering
+
+**GHSA-5w5p-vcv6-mm3f, CWE-501, high.** Credit: Adam Jordan ([adamyordan](https://github.com/adamyordan)).
+
+The Docker server limits which config types an untrusted body may build. `LLMConfig` is not on that list, because it resolves `api_token="env:NAME"` from the server environment. Two defects combined:
+
+1. `from_serializable_dict()` unwrapped `{"type": "dict", "value": X}` by walking `X.items()`. It never checked `X` itself as a typed object, so a forbidden type inside `value` was never seen by the gate.
+2. `CrawlerRunConfig.from_kwargs` and `BrowserConfig.from_kwargs` called `from_serializable_dict()` with no provenance, and the default was trusted. The laundered object was rebuilt as trusted.
+
+The result: an ordinary, non-admin API client could read any server environment variable, including `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and `SECRET_KEY`. With `SECRET_KEY` it could forge an admin JWT.
+
+The unwrapped value is now re-checked under the untrusted gate, and `from_kwargs` carries the caller's provenance. If you run the Docker server with secrets in its environment, rota
```

---

### Incident Patch 2: `e668bb7b` (2026-09-23)
**Commit Message**: Merge pull request #2280 from unclecode/docs-security-md-known-issues

docs(security): list fixed issues and features per release through v0.9.3

**File**: `SECURITY.md` (modified, +134/-21)
```diff
@@ -9,6 +9,8 @@
 | 0.7.x   | :x: (upgrade recommended) |
 | < 0.7   | :x:                |
 
+Fixes are not backported to earlier lines. The 0.9.3 advisories listed below are not patched in any 0.8.x release; if you run 0.8.x, upgrade.
+
 ## Reporting a Vulnerability
 
 We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.
@@ -68,9 +70,9 @@ If you're running the Crawl4AI Docker API in production:
    export SECRET_KEY="your-secure-random-key-here"
    ```
 
-2. **Hooks are Disabled by Default** (v0.8.0+)
-   - Only enable if you trust all API users
-   - Set `CRAWL4AI_HOOKS_ENABLED=true` only when necessary
+2. **Hooks are Declarative** (v0.9.0+)
+   - Request-supplied hook code is no longer accepted; only the fixed action set in `GET /hooks/info`
+   - On 0.8.x, hooks are disabled by default; set `CRAWL4AI_HOOKS_ENABLED=true` only if you trust all API users
 
 3. **Network Security**
    - Run behind a reverse proxy (nginx, traefik)
@@ -92,44 +94,155 @@ When using Crawl4AI as a Python library:
 
 ## Known Security Issues
 
-### Fixed in v0.8.0
+All issues below are fixed in the version named. Advisories with a GHSA id are published under [Security Advisories](https://github.com/unclecode/crawl4ai/security/advisories). Full detail for every release is in [CHANGELOG.md](CHANGELOG.md); reporter credits are in [SECURITY-CREDITS.md](SECURITY-CREDITS.md).
+
+### Fixed in v0.9.3 (2026-08-31)
+
+| ID | Severity | Component | Description | Fix |
+|----|----------|-----------|-------------|-----|
+| GHSA-xpp7-j28w-2gvx | HIGH | Library + Docker API | Arbitrary file write via `PDFContentScrapingStrategy` image-write fields in untrusted config bodies (CWE-22) | `save_images_locally` / `image_save_dir` filtered at the trust boundary; `extract_images` forced off for untrusted bodies |
+| GHSA-q5rj-45vw-vp2g | HIGH | Library | SSRF via PDF download redirects; DNS rebinding (CWE-918) | Redirects resolved manually with a per-hop destination check (max 5 hops); peer IP of the read response validated |
+| GHSA-v2rm-hvrj-2x9q | MEDIUM | Library | Denial of service via unbounded PDF size and page count (CWE-400) | `max_pdf_bytes` (100 MiB) and `max_pdf_pages` (2000) caps; untrusted bodies cannot raise them |
+| GHSA-7g3g-vhm6-79f3 | MEDIUM | Library | XSS via unescaped PDF paragraph text in `cleaned_html` (CWE-79) | Paragraph text escaped like every other sink |
+| GHSA-m446-hp3q-qfxp | HIGH | Docker Playground | DOM-based XSS via `innerHTML` round-trip in the result viewer, leading to API token theft (CWE-79) | Round-trip removed; highlight.js renders from `textContent` |
+
+### Fixed in v0.9.2 (2026-07-15)
+
+| ID | Severity | Component | Description | Fix |
+|----|----------|-----------|-------------|-----|
+| - | LOW | Docker API | `/monitor/ws` WebSocket returned 500 under JWT auth because the router-level token dependency cannot run on WebSocket scopes | Auth enforced by `AuthGateMiddleware`; admin routes keep `require_admin` |
+
+### Fixed in v0.9.1 (2026-07-08)
+
+| ID | Severity | Component | Description | Fix |
+|----|----------|-----------|-------------|-----|
+| - | MEDIUM | Docker API | Rate-limit Redis storage connected without the configured password | Rate limiter authenticates to Redis |
+
+### Fixed in v0.9.0 (2026-06-18)
+
+Secure-by-default rework of the Docker API server. The pip library is unchanged. See `deploy/docker/MIGRATION.md`.
+
+| ID | Severity | Component | Description | Fix |
+|----|----------|-----------|-------------|-----|
+| - | CRITICAL | Docker API | Unauthenticated API served on `0.0.0.0` by default (CWE-306) | Auth on by default; loopback bind unless `CRAWL4AI_API_TOKEN` is set |
+| - | CRITICAL | Docker API | Request-supplied hook code executed on the server (CWE-94) | `hooks.code` removed; fixed set of declarative hook actions |
+| - | HIGH | Docker API | Chromium launch-arg injection via request-supplied `browser_config.extra_args` (CWE-94) | `extra_args` rejected at the network boundary |
+| - | HIGH | Docker API | Path traversal to file write via download sinks (CWE-22) | basename + realpath + `O_NOFOLLOW` confinement |
+| - | HIGH | Docker API | SSRF on `/crawl/stream` and `/crawl` with `stream=true` (CWE-918) | Destination validation added; HTTP 400 on disallowed targets |
+| - | HIGH | Docker API | Request body could drive browser internals (`js_code`, `proxy_config`, `cdp_url`, `user_data_dir`, `cookies`, `headers`, `init_scripts`, `base_url`, ...) | Request trust boundary: scalar declarative options only, HTTP 400 otherwise |
+| - | MEDIUM | Docker API | Weak JWT, unscoped monitor actions, permissive CORS, TLS verification off, unauthenticated Redis, unbounded job queue, verbose 5xx, unvalidated webhook headers | Hardened defaults for each; see CHANGELOG 0.9.0 |
+
+### Fixed in v0.8.9 (2026-06-04)
 
-| ID | Severity | Description | Fix |
-|----|----------|-------------|-----|
-| CVE-pending-1 | CRITICAL | RCE via hooks `__im
```

---

### Incident Patch 3: `06c8acfb` (2026-09-23)
**Commit Message**: docs(security): list fixed issues and features per release through v0.9.3

SECURITY.md stopped at v0.8.1; add per-release tables for v0.8.5 to v0.9.3, tag features by version, and note that fixes are not backported.

**File**: `SECURITY.md` (modified, +134/-21)
```diff
@@ -9,6 +9,8 @@
 | 0.7.x   | :x: (upgrade recommended) |
 | < 0.7   | :x:                |
 
+Fixes are not backported to earlier lines. The 0.9.3 advisories listed below are not patched in any 0.8.x release; if you run 0.8.x, upgrade.
+
 ## Reporting a Vulnerability
 
 We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.
@@ -68,9 +70,9 @@ If you're running the Crawl4AI Docker API in production:
    export SECRET_KEY="your-secure-random-key-here"
    ```
 
-2. **Hooks are Disabled by Default** (v0.8.0+)
-   - Only enable if you trust all API users
-   - Set `CRAWL4AI_HOOKS_ENABLED=true` only when necessary
+2. **Hooks are Declarative** (v0.9.0+)
+   - Request-supplied hook code is no longer accepted; only the fixed action set in `GET /hooks/info`
+   - On 0.8.x, hooks are disabled by default; set `CRAWL4AI_HOOKS_ENABLED=true` only if you trust all API users
 
 3. **Network Security**
    - Run behind a reverse proxy (nginx, traefik)
@@ -92,44 +94,155 @@ When using Crawl4AI as a Python library:
 
 ## Known Security Issues
 
-### Fixed in v0.8.0
+All issues below are fixed in the version named. Advisories with a GHSA id are published under [Security Advisories](https://github.com/unclecode/crawl4ai/security/advisories). Full detail for every release is in [CHANGELOG.md](CHANGELOG.md); reporter credits are in [SECURITY-CREDITS.md](SECURITY-CREDITS.md).
+
+### Fixed in v0.9.3 (2026-08-31)
+
+| ID | Severity | Component | Description | Fix |
+|----|----------|-----------|-------------|-----|
+| GHSA-xpp7-j28w-2gvx | HIGH | Library + Docker API | Arbitrary file write via `PDFContentScrapingStrategy` image-write fields in untrusted config bodies (CWE-22) | `save_images_locally` / `image_save_dir` filtered at the trust boundary; `extract_images` forced off for untrusted bodies |
+| GHSA-q5rj-45vw-vp2g | HIGH | Library | SSRF via PDF download redirects; DNS rebinding (CWE-918) | Redirects resolved manually with a per-hop destination check (max 5 hops); peer IP of the read response validated |
+| GHSA-v2rm-hvrj-2x9q | MEDIUM | Library | Denial of service via unbounded PDF size and page count (CWE-400) | `max_pdf_bytes` (100 MiB) and `max_pdf_pages` (2000) caps; untrusted bodies cannot raise them |
+| GHSA-7g3g-vhm6-79f3 | MEDIUM | Library | XSS via unescaped PDF paragraph text in `cleaned_html` (CWE-79) | Paragraph text escaped like every other sink |
+| GHSA-m446-hp3q-qfxp | HIGH | Docker Playground | DOM-based XSS via `innerHTML` round-trip in the result viewer, leading to API token theft (CWE-79) | Round-trip removed; highlight.js renders from `textContent` |
+
+### Fixed in v0.9.2 (2026-07-15)
+
+| ID | Severity | Component | Description | Fix |
+|----|----------|-----------|-------------|-----|
+| - | LOW | Docker API | `/monitor/ws` WebSocket returned 500 under JWT auth because the router-level token dependency cannot run on WebSocket scopes | Auth enforced by `AuthGateMiddleware`; admin routes keep `require_admin` |
+
+### Fixed in v0.9.1 (2026-07-08)
+
+| ID | Severity | Component | Description | Fix |
+|----|----------|-----------|-------------|-----|
+| - | MEDIUM | Docker API | Rate-limit Redis storage connected without the configured password | Rate limiter authenticates to Redis |
+
+### Fixed in v0.9.0 (2026-06-18)
+
+Secure-by-default rework of the Docker API server. The pip library is unchanged. See `deploy/docker/MIGRATION.md`.
+
+| ID | Severity | Component | Description | Fix |
+|----|----------|-----------|-------------|-----|
+| - | CRITICAL | Docker API | Unauthenticated API served on `0.0.0.0` by default (CWE-306) | Auth on by default; loopback bind unless `CRAWL4AI_API_TOKEN` is set |
+| - | CRITICAL | Docker API | Request-supplied hook code executed on the server (CWE-94) | `hooks.code` removed; fixed set of declarative hook actions |
+| - | HIGH | Docker API | Chromium launch-arg injection via request-supplied `browser_config.extra_args` (CWE-94) | `extra_args` rejected at the network boundary |
+| - | HIGH | Docker API | Path traversal to file write via download sinks (CWE-22) | basename + realpath + `O_NOFOLLOW` confinement |
+| - | HIGH | Docker API | SSRF on `/crawl/stream` and `/crawl` with `stream=true` (CWE-918) | Destination validation added; HTTP 400 on disallowed targets |
+| - | HIGH | Docker API | Request body could drive browser internals (`js_code`, `proxy_config`, `cdp_url`, `user_data_dir`, `cookies`, `headers`, `init_scripts`, `base_url`, ...) | Request trust boundary: scalar declarative options only, HTTP 400 otherwise |
+| - | MEDIUM | Docker API | Weak JWT, unscoped monitor actions, permissive CORS, TLS verification off, unauthenticated Redis, unbounded job queue, verbose 5xx, unvalidated webhook headers | Hardened defaults for each; see CHANGELOG 0.9.0 |
+
+### Fixed in v0.8.9 (2026-06-04)
 
-| ID | Severity | Description | Fix |
-|----|----------|-------------|-----|
-| CVE-pending-1 | CRITICAL | RCE via hooks `__im
```

---

### Incident Patch 4: `a7d4fbfb` (2026-09-23)
**Commit Message**: Merge security fixes for 0.9.4

**File**: `crawl4ai/async_configs.py` (modified, +55/-12)
```diff
@@ -298,6 +298,9 @@ class UntrustedConfigError(ValueError):
 _MAX_VIEWPORT = 4000
 _MAX_PDF_BYTES = 100 * 1024 * 1024
 _MAX_PDF_PAGES = 2000
+_MAX_LINK_PREVIEW_LINKS = 100      # the class default
+_MAX_LINK_PREVIEW_CONCURRENCY = 10  # the class default
+_MAX_LINK_PREVIEW_TIMEOUT_S = 10    # seconds here, not ms
 
 
 def _max_timeout_ms() -> int:
@@ -384,6 +387,18 @@ def _cap_timeout(v):
         # Rasterizing every page is the most expensive thing this strategy can
         # do, and nothing about untrusted crawling needs it.
         params["extract_images"] = False
+    elif type_name == "LinkPreviewConfig":
+        # Also no field allowlist, and each link is a separate outbound fetch:
+        # unclamped, one request body can order millions of them at any
+        # concurrency it likes.
+        for f, cap in (
+            ("max_links", _MAX_LINK_PREVIEW_LINKS),
+            ("concurrency", _MAX_LINK_PREVIEW_CONCURRENCY),
+            ("timeout", _MAX_LINK_PREVIEW_TIMEOUT_S),
+        ):
+            if f in params:
+                v = params[f]
+                params[f] = cap if not isinstance(v, int) or v <= 0 else min(v, cap)
     return params
 
 
@@ -473,6 +488,21 @@ def to_serializable_dict(obj: Any, ignore_default_value : bool = False):
     return str(obj)
 
 
+def _is_typed_shape(data: Any) -> bool:
+    """True for the dict shapes to_serializable_dict() emits:
+    {"type": "<ClassName>", "params": {...}} or {"type": "dict", "value": {...}}.
+
+    Plain business dicts that happen to carry a "type" key (JSON-Schema
+    fragments, JsonCss field specs like {"type": "text", "name": "..."}) have
+    neither "params" nor "value" and are not typed shapes.
+    """
+    return (
+        isinstance(data, dict)
+        and "type" in data
+        and ("params" in data or (data["type"] == "dict" and "value" in data))
+    )
+
+
 def from_serializable_dict(data: Any, provenance: "Provenance" = None) -> Any:
     """
     Recursively convert a serializable dictionary back to an object instance.
@@ -498,14 +528,23 @@ def from_serializable_dict(data: Any, provenance: "Provenance" = None) -> Any:
     # carry a "type" key (e.g. JSON-Schema fragments, JsonCss field specs like
     # {"type": "text", "name": "..."}) have neither "params" nor "value" and
     # must fall through to the raw-dict path below so they are passed as data.
-    if (
-        isinstance(data, dict)
-        and "type" in data
-        and ("params" in data or (data["type"] == "dict" and "value" in data))
-    ):
+    if _is_typed_shape(data):
         # Handle plain dictionaries
         if data["type"] == "dict" and "value" in data:
-            return {k: from_serializable_dict(v, provenance) for k, v in data["value"].items()}
+            unwrapped = {
+                k: from_serializable_dict(v, provenance) for k, v in data["value"].items()
+            }
+            # The unwrap above recurses over .items(), so data["value"] is never
+            # seen as a whole typed object and the type gate below never fires
+            # for it. Without this check an untrusted body launders a forbidden
+            # type past the gate by wrapping it:
+            #   {"type": "dict", "value": {"type": "LLMConfig", "params": {...}}}
+            if provenance == Provenance.UNTRUSTED and _is_typed_shape(unwrapped):
+                raise UntrustedConfigError(
+                    "an untrusted request may not wrap a typed object in "
+                    "{'type': 'dict', 'value': ...}"
+                )
+            return unwrapped
 
         # Security: only allow known-safe types to be deserialized.
         # Unknown types (e.g. logging.Logger serialized by older clients) are
@@ -1012,11 +1051,13 @@ def __init__(
             )
 
     @staticmethod
-    def from_kwargs(kwargs: dict) -> "BrowserConfig":
+    def from_kwargs(kwargs: dict, provenance: "Provenance" = None) -> "BrowserConfig":
         # Auto-deserialize any dict values that use the {"type": ..., "params": ...}
         # serialization format (e.g. from JSON API requests or dump()/load() roundtrips).
         kwargs = {
-            k: from_serializable_dict(v) if isinstance(v, dict) and "type" in v else v
+            k: from_serializable_dict(v, provenance)
+            if isinstance(v, dict) and "type" in v
+            else v
             for k, v in kwargs.items()
         }
         # Only pass keys present in kwargs so that __init__ defaults (and
@@ -1102,7 +1143,7 @@ def load(data: dict, provenance: "Provenance" = None) -> "BrowserConfig":
         # so a body that sends bare kwargs (no {type,params}) cannot bypass it.
         if provenance == Provenance.UNTRUSTED and isinstance(config, dict):
             config = _enforce_untrusted("BrowserConfig", config)
-        return BrowserConfig.from_kwargs(config)
+        return BrowserConfig.from_kwargs(config, provenance)
 
     def set_nstproxy(
         self,
@@ -2143,12 +2184,14 @@ def __setattr__(self, n
```

**File**: `crawl4ai/async_url_seeder.py` (modified, +7/-2)
```diff
@@ -53,6 +53,7 @@
 # You might need to adjust this import based on your exact file structure
 # Import AsyncLogger for default if needed
 from .async_logger import AsyncLoggerBase, AsyncLogger
+from .egress_policy import proxy_url
 
 # Import SeedingConfig for type hints
 from typing import TYPE_CHECKING
@@ -303,7 +304,11 @@ def __init__(
     ):
         self.ttl = ttl
         self._owns_client = client is None  # Track if we created the client
-        self.client = client or httpx.AsyncClient(http2=True, timeout=20, headers={
+        # proxy=None unless an embedder installed one (the Docker server does).
+        # Every request in this class goes through self.client, so this single
+        # kwarg puts the seeder's whole fan-out -- sitemaps, robots, link heads,
+        # and each redirect hop -- behind the egress policy.
+        self.client = client or httpx.AsyncClient(http2=True, timeout=20, proxy=proxy_url(), headers={
             "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) +AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
         })
         self.logger = logger  # Store the logger instance
@@ -1772,7 +1777,7 @@ async def _latest_index(self) -> str:
         self._log("info", "Fetching latest Common Crawl index from {url}",
                   params={"url": COLLINFO_URL}, tag="URL_SEED")
         try:
-            async with httpx.AsyncClient() as c:
+            async with httpx.AsyncClient(proxy=proxy_url()) as c:
                 j = await c.get(COLLINFO_URL, timeout=10)
                 j.raise_for_status()  # Raise an exception for bad status codes
                 idx = j.json()[0]["id"]
```

**File**: `crawl4ai/egress_policy.py` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+"""Process-wide egress proxy for the library's own HTTP clients.
+
+The library deliberately has no egress policy of its own: as a plain library
+the caller already chooses the URL, so there is nothing to defend against.
+It matters when the URL comes from an untrusted API client, which is the
+Docker server's situation -- deploy/docker/server.py starts a pinning forward
+proxy (egress_proxy.PinningProxy) and registers it here at boot, so the
+seeder and robots.txt fetches go through the same resolve-and-pin rule the
+browser path already gets.
+
+A proxy rather than a validator hook (the shape used by
+crawl4ai/processors/pdf) because a validator resolves the name, checks it and
+then throws the address away -- the client re-resolves when it dials, which is
+the DNS-rebinding window egress_broker.py exists to close. The proxy resolves,
+pins and dials the same address, and re-validates every redirect hop because
+each hop is a fresh proxied request.
+
+Unset (the plain-library case) means proxy_url() is None, which is the default
+value of the `proxy=` kwarg on both httpx and aiohttp: no behaviour change.
+"""
+
+from typing import Optional
+
+_proxy_url: Optional[str] = None
+
+
+def set_egress_proxy(url: Optional[str]) -> None:
+    """Route the library's own HTTP clients through `url` (None = direct)."""
+    global _proxy_url
+    _proxy_url = url
+
+
+def proxy_url() -> Optional[str]:
+    """The installed egress proxy, or None for a direct connection."""
+    return _proxy_url
```

**File**: `crawl4ai/utils.py` (modified, +11/-2)
```diff
@@ -36,6 +36,7 @@
 
 from packaging import version
 from . import __version__
+from .egress_policy import proxy_url
 from typing import Sequence
 
 from itertools import chain
@@ -369,8 +370,16 @@ async def can_fetch(self, url: str, user_agent: str = "*") -> bool:
                 scheme = parsed.scheme or 'http'
                 robots_url = f"{scheme}://{domain}/robots.txt"
                 
-                async with aiohttp.ClientSession() as session:
-                    async with session.get(robots_url, timeout=2, ssl=False) as response:
+                # proxy=None unless an embedder installed one (the Docker
+                # server does). Without it this fetch is a caller-chosen URL on
+                # an unguarded client: it reached internal hosts directly and
+                # followed redirects into them.
+                # ssl=False is gone: a bad certificate now raises, and the
+                # except below fails open, so robots is ignored rather than
+                # respected -- more crawling, never a broken crawl.
+                timeout = aiohttp.ClientTimeout(total=2)
+                async with aiohttp.ClientSession(timeout=timeout) as session:
+                    async with session.get(robots_url, proxy=proxy_url()) as response:
                         if response.status == 200:
                             rules = await response.text()
                             self._cache_rules(domain, rules)
```

**File**: `deploy/docker/egress_proxy.py` (modified, +14/-4)
```diff
@@ -103,6 +103,14 @@ def _bracket(ip: str) -> str:
     return f"[{ip}]" if ":" in ip else ip
 
 
+def _drop_connection_header(headers: bytes) -> bytes:
+    """Strip any Connection: header so the caller can set its own."""
+    return b"".join(
+        ln + b"\r\n" for ln in headers.split(b"\r\n")
+        if ln and not ln.lower().startswith(b"connection:")
+    )
+
+
 class PinningProxy:
     """Async HTTP forward-proxy that connects only to pinned, global IPs."""
 
@@ -219,17 +227,19 @@ async def _handle_absolute(self, method, target, request_line, client_reader, cl
         # upstream proxy (which then needs no DNS lookup of its own).
         if upstream is None:
             out = f"{method} {path} HTTP/1.1\r\n".encode("latin-1")
+            # One validated request per origin connection. After this the bytes
+            # are spliced raw, and a keep-alive client would put its next
+            # request on the wire in absolute form (it still thinks it is
+            # talking to a proxy), which some origins answer with 400.
+            headers = _drop_connection_header(headers) + b"Connection: close\r\n"
         else:
             out = f"{method} http://{_bracket(pin.ip)}:{port}{path} HTTP/1.1\r\n".encode("latin-1")
             if upstream[2]:
                 out += upstream[2]
             # One validated request per upstream connection: only this first
             # request is pinned/rewritten, so force close to keep a reused
             # client connection from smuggling unvalidated requests upstream.
-            headers = b"".join(
-                ln + b"\r\n" for ln in headers.split(b"\r\n")
-                if ln and not ln.lower().startswith(b"connection:")
-            ) + b"Connection: close\r\n"
+            headers = _drop_connection_header(headers) + b"Connection: close\r\n"
         out += b"Host: " + sp.hostname.encode("latin-1")
         if sp.port:
             out += f":{sp.port}".encode("latin-1")
```

**File**: `deploy/docker/server.py` (modified, +12/-5)
```diff
@@ -211,11 +211,18 @@ async def lifespan(_: FastAPI):
     from egress_proxy import PinningProxy
     from egress_broker import set_egress_proxy
     app.state.egress_proxy = PinningProxy()
-    set_egress_proxy(await app.state.egress_proxy.start())
-
-    # The pinning proxy only covers Chromium. PDFContentScrapingStrategy fetches
-    # with requests on its own, so hand the library the same destination policy
-    # or that path stays an unguarded SSRF hole.
+    _proxy_url = await app.state.egress_proxy.start()
+    set_egress_proxy(_proxy_url)
+
+    # Chromium is only one of the clients that fetch a caller-chosen URL. The
+    # library's own HTTP clients -- the URL seeder (link previews, sitemaps) and
+    # RobotsParser -- take a proxy kwarg, so point them at the same pinning
+    # proxy or those paths stay unguarded SSRF holes.
+    from crawl4ai.egress_policy import set_egress_proxy as set_library_egress_proxy
+    set_library_egress_proxy(_proxy_url)
+
+    # PDFContentScrapingStrategy fetches with requests, which has no proxy hook
+    # we can rely on here, so it gets the same destination policy by injection.
     _install_pdf_egress_policy()
 
     # Bounded background-job queue (per-principal quotas optional).
```

**File**: `deploy/docker/tests/test_security_ssrf_seeder.py` (added, +233/-0)
```diff
@@ -0,0 +1,233 @@
+"""SSRF on the library's own HTTP clients (2026-09 reports), end to end.
+
+Two channels fetched a caller-influenced URL without going through the egress
+broker: AsyncUrlSeeder (link previews, sitemaps) and RobotsParser. The seeder
+one was not blind -- the internal page's parsed <head> came back to the API
+caller in result.links[*].head_data.
+
+These run the real PinningProxy over real loopback sockets with the real
+resolve_and_pin rule, so 127.0.0.1 and 169.254.169.254 are refused because they
+genuinely are not global. Only "public.example" is stubbed, to stand in for a
+global host without touching the network.
+"""
+
+import asyncio
+import sqlite3
+
+import pytest
+from aiohttp import web
+
+import egress_proxy
+from egress_broker import PinnedTarget, resolve_and_pin
+from egress_proxy import PinningProxy
+
+from crawl4ai import egress_policy
+from crawl4ai.async_url_seeder import AsyncUrlSeeder
+from crawl4ai.utils import RobotsParser
+
+pytestmark = pytest.mark.posture
+
+INTERNAL_PAGE = (
+    '<html><head><title>INTERNAL-MARKER</title>'
+    '<meta name="secret" content="internal-only"></head><body>x</body></html>'
+)
+
+_PROXY_ENV = (
+    "CRAWL4AI_UPSTREAM_PROXY", "HTTP_PROXY", "http_proxy",
+    "HTTPS_PROXY", "https_proxy", "NO_PROXY", "no_proxy",
+)
+
+
+@pytest.fixture(autouse=True)
+def _clear_proxy_env(monkeypatch):
+    for name in _PROXY_ENV:
+        monkeypatch.delenv(name, raising=False)
+
+
+@pytest.fixture(autouse=True)
+def _reset_library_proxy():
+    yield
+    egress_policy.set_egress_proxy(None)
+
+
+async def _serve(handler):
+    """Start a loopback HTTP server; return (runner, port)."""
+    app = web.Application()
+    app.router.add_get("/{tail:.*}", handler)
+    runner = web.AppRunner(app)
+    await runner.setup()
+    site = web.TCPSite(runner, "127.0.0.1", 0)
+    await site.start()
+    return runner, site._server.sockets[0].getsockname()[1]
+
+
+async def _start_proxy():
+    proxy = PinningProxy()
+    egress_policy.set_egress_proxy(await proxy.start())
+    return proxy
+
+
+def _treat_port_as_public(monkeypatch, port):
+    """Let one loopback port through the proxy as if it were a global host.
+
+    Everything else keeps the real not-is_global rule, so the "internal"
+    service on its own port is still refused. Using a loopback port rather
+    than a made-up hostname matters: the unfixed code must be able to reach
+    the first hop, or the test would pass for the wrong reason.
+    """
+    def fake_pin(url):
+        if f":{port}" in url:
+            return PinnedTarget("http", "127.0.0.1", port, "127.0.0.1")
+        return resolve_and_pin(url)
+    monkeypatch.setattr(egress_proxy, "resolve_and_pin", fake_pin)
+
+
+@pytest.mark.asyncio
+class TestSeederEgress:
+    async def test_seeder_head_resolution_to_loopback_is_blocked(self):
+        """_resolve_head is a separate sink from the head fetch."""
+        hits = []
+
+        async def internal(req):
+            hits.append(req.path)
+            return web.Response(text=INTERNAL_PAGE, content_type="text/html")
+
+        runner, port = await _serve(internal)
+        proxy = await _start_proxy()
+        seeder = AsyncUrlSeeder()
+        try:
+            assert await seeder._resolve_head(f"http://127.0.0.1:{port}/") is None
+            assert hits == []
+        finally:
+            await seeder.client.aclose()
+            await proxy.stop()
+            await runner.cleanup()
+
+    async def test_seeder_direct_loopback_is_blocked(self):
+        hits = []
+
+        async def internal(req):
+            hits.append(req.path)
+            return web.Response(text=INTERNAL_PAGE, content_type="text/html")
+
+        runner, port = await _serve(internal)
+        proxy = await _start_proxy()
+        seeder = AsyncUrlSeeder()
+        try:
+            res = await seeder.extract_head_for_urls(
+                [f"http://127.0.0.1:{port}/secret"]
+            )
+            assert hits == [], "the internal service was reached"
+            assert not (res[0].get("head_data") or {}).get("title")
+        finally:
+            await seeder.client.aclose()
+            await proxy.stop()
+            await runner.cleanup()
+
+    async def test_seeder_redirect_into_internal_is_blocked(self, monkeypatch):
+        """A public first hop must not become a free pass for the second."""
+        hits = []
+
+        async def internal(req):
+            hits.append(req.path)
+            return web.Response(text=INTERNAL_PAGE, content_type="text/html")
+
+        irunner, iport = await _serve(internal)
+
+        async def public(req):
+            raise web.HTTPFound(f"http://127.0.0.1:{iport}/secret")
+
+        prunner, pport = await _serve(public)
+        _treat_port_as_public(monkeypatch, pport)
+
+        proxy = await _start_proxy()
+        seeder = AsyncUrlSeeder()
+        try:
+            ok, html, final = await seeder._fetch_head(
+                f"http://127.0.0.1:{
```

**File**: `tests/unit/test_config_provenance.py` (added, +118/-0)
```diff
@@ -0,0 +1,118 @@
+"""Untrusted config provenance gate.
+
+Regression test for the {"type": "dict", "value": <typed object>} laundering
+bypass: wrapping a forbidden typed object in a plain-dict envelope hid it from
+the type gate, and from_kwargs then re-deserialized it as TRUSTED, which
+resolves api_token="env:NAME" through os.getenv.
+"""
+import pytest
+
+from crawl4ai.async_configs import (
+    BrowserConfig,
+    CrawlerRunConfig,
+    Provenance,
+    UntrustedConfigError,
+)
+
+UNTRUSTED = Provenance.UNTRUSTED
+
+
+def _llm_strategy(env_var):
+    return {
+        "type": "LLMExtractionStrategy",
+        "params": {
+            "llm_config": {
+                "type": "dict",
+                "value": {"type": "LLMConfig", "params": {"api_token": f"env:{env_var}"}},
+            }
+        },
+    }
+
+
+def test_forbidden_type_refused_directly():
+    data = {"type": "CrawlerRunConfig", "params": {"extraction_strategy": _llm_strategy("SECRET_KEY")}}
+    with pytest.raises(UntrustedConfigError):
+        CrawlerRunConfig.load(data, provenance=UNTRUSTED)
+
+
+def test_forbidden_type_refused_when_wrapped(monkeypatch):
+    """The bypass: the whole strategy hidden behind {"type":"dict","value":...}."""
+    monkeypatch.setenv("SECRET_KEY", "canary-secret-key-value")
+    data = {
+        "type": "CrawlerRunConfig",
+        "extraction_strategy": {"type": "dict", "value": _llm_strategy("SECRET_KEY")},
+    }
+    with pytest.raises(UntrustedConfigError):
+        CrawlerRunConfig.load(data, provenance=UNTRUSTED)
+
+
+def test_forbidden_type_refused_when_wrapped_in_params(monkeypatch):
+    monkeypatch.setenv("OPENAI_API_KEY", "sk-canary-9f3a")
+    data = {
+        "type": "CrawlerRunConfig",
+        "params": {"extraction_strategy": {"type": "dict", "value": _llm_strategy("OPENAI_API_KEY")}},
+    }
+    with pytest.raises(UntrustedConfigError):
+        CrawlerRunConfig.load(data, provenance=UNTRUSTED)
+
+
+def test_browser_config_wrapped_proxy_refused():
+    """Same envelope, other config class, other forbidden type."""
+    data = {
+        "type": "BrowserConfig",
+        "params": {
+            "proxy_config": {
+                "type": "dict",
+                "value": {"type": "ProxyConfig", "params": {"server": "http://evil:8080"}},
+            }
+        },
+    }
+    with pytest.raises(UntrustedConfigError):
+        BrowserConfig.load(data, provenance=UNTRUSTED)
+
+
+def test_trusted_load_is_unchanged(monkeypatch):
+    """TRUSTED (SDK) callers keep the old behavior: no raise, and the wrapped
+    envelope still unwraps to the same plain dict it did before the fix."""
+    monkeypatch.setenv("CRAWL4AI_TEST_TOKEN", "tok-123")
+    cfg = CrawlerRunConfig.load(
+        {"type": "CrawlerRunConfig", "params": {"extraction_strategy": _llm_strategy("CRAWL4AI_TEST_TOKEN")}}
+    )
+    assert cfg.extraction_strategy.llm_config == {
+        "type": "LLMConfig",
+        "params": {"api_token": "env:CRAWL4AI_TEST_TOKEN"},
+    }
+
+
+def test_trusted_top_level_kwargs_still_deserialize(monkeypatch):
+    """from_kwargs still builds typed objects for TRUSTED callers."""
+    monkeypatch.setenv("CRAWL4AI_TEST_TOKEN", "tok-123")
+    cfg = CrawlerRunConfig.load(
+        {
+            "type": "CrawlerRunConfig",
+            "extraction_strategy": {"type": "dict", "value": _llm_strategy("CRAWL4AI_TEST_TOKEN")},
+        }
+    )
+    assert cfg.extraction_strategy.llm_config.api_token == "tok-123"
+
+
+def test_plain_business_dict_with_type_key_still_passes():
+    """A JsonCss schema carries "type" keys but is data, not a typed object."""
+    schema = {
+        "name": "Items",
+        "baseSelector": ".item",
+        "fields": [{"name": "title", "selector": "h1", "type": "text"}],
+    }
+    cfg = CrawlerRunConfig.load(
+        {
+            "type": "CrawlerRunConfig",
+            "params": {
+                "extraction_strategy": {
+                    "type": "JsonCssExtractionStrategy",
+                    "params": {"schema": {"type": "dict", "value": schema}},
+                }
+            },
+        },
+        provenance=UNTRUSTED,
+    )
+    assert cfg.extraction_strategy.schema["baseSelector"] == ".item"
```

---

### Incident Patch 5: `6218bb81` (2026-09-22)
**Commit Message**: fix(robots): don't patch robotparser on Python 3.14+ (#2278)

* fix(robots): don't patch robotparser on Python 3.14+

The wildcard monkey patch in utils.py overrides RuleLine.applies_to
unconditionally. Python 3.14 rewrote urllib.robotparser with native
wildcard, '$' and RFC 9309 longest-match support, where applies_to
returns the match *length* used to rank competing rules. The patch
returns a bool, so every wildcard rule collapses to the lowest
priority and Allow: overrides stop working:

    User-agent: *
    Disallow: /
    Allow: /public/*.html

denied /public/a.html on 3.14. Gate the patch to Python < 3.14, where
robotparser has no wildcard support and still needs it.

Follow-up to #2229, which fixed the 'Disallow: /*?' half of #2225.

Refs #2225

Co-Authored-By: Claude Opus 5 (1M context) <[REDACTED_EMAIL]>

* fix(robots): don't rewrite bare-'?' rules on Python 3.14+ either

Review follow-up on the previous commit, which gated the RuleLine
monkey patch but left _preserve_bare_query running on every Python.

On 3.14 that rewrite is not just unnecessary, it is wrong. The stdlib
ranks rules by match length, and '/*?*' matches to end of string, so
it outranks a narrower competin

**File**: `crawl4ai/utils.py` (modified, +42/-26)
```diff
@@ -50,27 +50,34 @@
 import inspect
 
 
-# Monkey patch to fix wildcard handling in urllib.robotparser
-from urllib.robotparser import RuleLine
-import re
-
-original_applies_to = RuleLine.applies_to
-
-def patched_applies_to(self, filename):
-   # Handle wildcards in paths
-   if '*' in self.path or '%2A' in self.path or self.path in ("*", "%2A"):
-       pattern = self.path.replace('%2A', '*')
-       pattern = re.escape(pattern).replace('\\*', '.*')
-       pattern = '^' + pattern
-       if pattern.endswith('\\$'):
-           pattern = pattern[:-2] + '$'
-       try:
-           return bool(re.match(pattern, filename))
-       except re.error:
-           return original_applies_to(self, filename)
-   return original_applies_to(self, filename)
-
-RuleLine.applies_to = patched_applies_to
+# Monkey patch to fix wildcard handling in urllib.robotparser.
+# Python 3.14 rewrote robotparser with native wildcard, '$' and RFC 9309
+# longest-match support, and its applies_to returns a match *length* used to
+# rank rules. Patching it there returns a bool, which collapses every wildcard
+# rule to the lowest priority and breaks Allow: overrides -- so only patch the
+# older implementation, which has no wildcard support at all.
+import sys
+
+if sys.version_info < (3, 14):
+    from urllib.robotparser import RuleLine
+
+    original_applies_to = RuleLine.applies_to
+
+    def patched_applies_to(self, filename):
+       # Handle wildcards in paths
+       if '*' in self.path or '%2A' in self.path or self.path in ("*", "%2A"):
+           pattern = self.path.replace('%2A', '*')
+           pattern = re.escape(pattern).replace('\\*', '.*')
+           pattern = '^' + pattern
+           if pattern.endswith('\\$'):
+               pattern = pattern[:-2] + '$'
+           try:
+               return bool(re.match(pattern, filename))
+           except re.error:
+               return original_applies_to(self, filename)
+       return original_applies_to(self, filename)
+
+    RuleLine.applies_to = patched_applies_to
 # Monkey patch ends
 
 def chunk_documents(
@@ -252,8 +259,14 @@ def needs_update(self):
 def _preserve_bare_query(rules_text: str) -> str:
     """Append '*' to Allow/Disallow values ending in a bare '?' (e.g. '/*?').
 
-    '/*?' and '/*?*' allow/deny exactly the same URLs; the rewrite only
-    survives parsers that would otherwise drop the trailing '?'.
+    Only correct below Python 3.14, and only called there. Those parsers drop a
+    trailing '?' when normalizing the rule path, collapsing '/*?' to '/*' and
+    blocking the whole site; they also take the first matching rule, so making a
+    rule longer cannot change which one wins.
+
+    From 3.14 the stdlib keeps the '?' and ranks rules by match length, and the
+    rewrite becomes actively wrong: '/*?*' matches to end of string, so it
+    outranks a competing 'Allow: /*?q=' that the raw '/*?' would have lost to.
     """
     fixed = []
     for raw_line in rules_text.splitlines():
@@ -372,9 +385,12 @@ async def can_fetch(self, url: str, user_agent: str = "*") -> bool:
 
         # Create parser for this check
         parser = RobotFileParser()
-        # Old Pythons drop a trailing '?' from rules, so '/*?' becomes
-        # '/*' and blocks the whole site. '/*?*' matches the same URLs.
-        parser.parse(_preserve_bare_query(rules).splitlines())
+        # Below 3.14, rewrite rules ending in a bare '?' so they survive path
+        # normalization. From 3.14 the stdlib handles them, and the rewrite
+        # would skew its longest-match ranking -- see _preserve_bare_query.
+        if sys.version_info < (3, 14):
+            rules = _preserve_bare_query(rules)
+        parser.parse(rules.splitlines())
         
         # If parser can't read rules, allow access
         if not parser.mtime():
```

**File**: `tests/unit/test_robots_query_rules.py` (modified, +75/-0)
```diff
@@ -6,6 +6,7 @@
 """
 
 import asyncio
+import sys
 
 import pytest
 
@@ -86,3 +87,77 @@ def test_ordinary_rules_still_apply(tmp_path):
     rules = "User-agent: *\nDisallow: /private/\nAllow: /public/\n"
     assert _can_fetch(rules, "/public/page", tmp_path) is True
     assert _can_fetch(rules, "/private/secret", tmp_path) is False
+
+
+def test_wildcard_patch_is_scoped_to_old_pythons():
+    """The patch must be installed exactly where it is needed, and nowhere else.
+
+    Python 3.14 supports wildcards natively and ranks rules by match length; the
+    patch returns a bool, which would flatten that ranking (see crawl4ai.utils).
+    """
+    from urllib.robotparser import RuleLine
+
+    is_patched = RuleLine.applies_to.__name__ == "patched_applies_to"
+    assert is_patched == (sys.version_info < (3, 14))
+
+
+@pytest.mark.parametrize(
+    "path, expected",
+    [("/a.php", False), ("/deep/a.php", False), ("/a.html", True)],
+)
+def test_wildcard_rules_work_on_every_python(path, expected, tmp_path):
+    """Wildcard support is the whole point of the patch - it must survive the gate."""
+    rules = "User-agent: *\nDisallow: /*.php\n"
+    assert _can_fetch(rules, path, tmp_path) is expected
+
+
+@pytest.mark.skipif(
+    sys.version_info < (3, 14),
+    reason="longest-match Allow precedence only exists in the 3.14+ stdlib parser",
+)
+@pytest.mark.parametrize(
+    "path, expected",
+    [("/public/a.html", True), ("/private/a.html", False), ("/public/a.txt", False)],
+)
+def test_allow_overrides_broad_disallow(path, expected, tmp_path):
+    """Regression: the old unconditional patch denied /public/a.html on 3.14."""
+    rules = "User-agent: *\nDisallow: /\nAllow: /public/*.html\n"
+    assert _can_fetch(rules, path, tmp_path) is expected
+
+
+# A narrower Allow: competing with the bare-'?' Disallow:. On 3.14 the stdlib
+# ranks rules by match length, and rewriting '/*?' to '/*?*' makes the Disallow
+# match to end of string -- so the rewrite would beat the Allow: and deny a URL
+# robots.txt permits. Below 3.14 the first matching rule wins regardless of
+# length, so the rewrite is safe there and the Allow: still loses to nothing.
+COMPETING_RULES = "User-agent: *\nAllow: /*?q=\nDisallow: /*?\n"
+
+
+@pytest.mark.skipif(
+    sys.version_info < (3, 14),
+    reason="longest-match Allow precedence only exists in the 3.14+ stdlib parser",
+)
+@pytest.mark.parametrize(
+    "path, expected",
+    [("/search?q=1", True), ("/search?x=1", False), ("/search", True)],
+)
+def test_query_allow_outranks_bare_query_disallow(path, expected, tmp_path):
+    """Regression: _preserve_bare_query must not run on 3.14.
+
+    '/*?*' matches longer than '/*?q=', so the rewrite would flip /search?q=1
+    from allowed to denied.
+    """
+    assert _can_fetch(COMPETING_RULES, path, tmp_path) is expected
+
+
+@pytest.mark.skipif(
+    sys.version_info >= (3, 14),
+    reason="pre-3.14 parsers take the first matching rule, not the longest",
+)
+@pytest.mark.parametrize(
+    "path, expected",
+    [("/search?q=1", True), ("/search?x=1", False), ("/search", True)],
+)
+def test_query_allow_still_wins_below_py314(path, expected, tmp_path):
+    """The same rules must give the same answers below 3.14, via the rewrite."""
+    assert _can_fetch(COMPETING_RULES, path, tmp_path) is expected
```

---

### Incident Patch 6: `a18b08fc` (2026-09-22)
**Commit Message**: Merge pull request #2232 from unclecode/fix/issue-2231-pooled-context-recycle

fix(docker): recycle pooled browser contexts by pages served (#2231)

**File**: `deploy/docker/config.yml` (modified, +8/-0)
```diff
@@ -84,6 +84,14 @@ crawler:
   pool:
     max_pages: 40                          # ← GLOBAL_SEM permits
     idle_ttl_sec: 300                     # ← 30 min janitor cutoff
+    # Pooled browsers are long-lived and reuse one browser context per config.
+    # Real sites leave state in that context (cookies, localStorage, service
+    # workers) which is never cleared, and navigation gets measurably slower as
+    # it builds up. Recycling by pages served bounds it: the context is replaced
+    # inside the same Chromium process, old contexts drain on their own, and it
+    # works under sustained load — unlike the janitor, which only closes *idle*
+    # browsers and so never fires on a busy server. 0 disables. See #2231.
+    max_pages_before_recycle: 200
   browser:
     kwargs:
       headless: true
```

**File**: `deploy/docker/crawler_pool.py` (modified, +19/-2)
```diff
@@ -20,9 +20,26 @@
 # Config
 MEM_LIMIT = CONFIG.get("crawler", {}).get("memory_threshold_percent", 95.0)
 BASE_IDLE_TTL = CONFIG.get("crawler", {}).get("pool", {}).get("idle_ttl_sec", 300)
+RECYCLE_PAGES = CONFIG.get("crawler", {}).get("pool", {}).get("max_pages_before_recycle", 0)
 DEFAULT_CONFIG_SIG = None  # Cached sig for default config
 
 
+def _apply_pool_defaults(cfg: BrowserConfig) -> BrowserConfig:
+    """Apply pool-owned policy to a browser config before it is pooled.
+
+    Browsers handed out by this pool are long-lived, and the endpoints build
+    their BrowserConfig from the request body (see api.py handle_crawl_request),
+    so config.yml's browser kwargs never reach them. Pooling is what makes a
+    browser long-lived, so the pool is where its recycling policy belongs.
+
+    Applied before _sig() so every request shares one signature and pooling is
+    unaffected. An explicit per-request value wins. See #2231.
+    """
+    if RECYCLE_PAGES and not cfg.max_pages_before_recycle:
+        cfg.max_pages_before_recycle = RECYCLE_PAGES
+    return cfg
+
+
 def get_pool_snapshot() -> dict:
     """Return a point-in-time snapshot of pool state for monitoring.
 
@@ -54,7 +71,7 @@ def _is_default_config(sig: str) -> bool:
 
 async def get_crawler(cfg: BrowserConfig) -> AsyncWebCrawler:
     """Get crawler from pool with tiered strategy."""
-    sig = _sig(cfg)
+    sig = _sig(_apply_pool_defaults(cfg))
     async with LOCK:
         # Check permanent browser for default config
         if PERMANENT and _is_default_config(sig):
@@ -135,7 +152,7 @@ async def init_permanent(cfg: BrowserConfig):
     async with LOCK:
         if PERMANENT:
             return
-        DEFAULT_CONFIG_SIG = _sig(cfg)
+        DEFAULT_CONFIG_SIG = _sig(_apply_pool_defaults(cfg))
         logger.info("🔥 Creating permanent default browser")
         PERMANENT = AsyncWebCrawler(config=cfg, thread_safe=False)
         await PERMANENT.start()
```

**File**: `deploy/docker/utils.py` (modified, +1/-1)
```diff
@@ -64,7 +64,7 @@ class FilterType(str, Enum):
         "memory_threshold_percent": 95.0,
         "rate_limiter": {"enabled": True, "base_delay": [1.0, 2.0]},
         "timeouts": {"stream_init": 30.0, "batch_process": 300.0},
-        "pool": {"max_pages": 40, "idle_ttl_sec": 300},
+        "pool": {"max_pages": 40, "idle_ttl_sec": 300, "max_pages_before_recycle": 200},
         "browser": {
             "kwargs": {"headless": True, "text_mode": True},
             "extra_args": [
```

**File**: `tests/docker/test_pool_recycle_config.py` (added, +78/-0)
```diff
@@ -0,0 +1,78 @@
+"""Pooled browsers must recycle their context by pages served (#2231).
+
+The pool's janitor only closes *idle* browsers, so a server under sustained
+load never recycles one. Recycling by page count is what bounds the context
+state (cookies/localStorage/service workers) that slows navigation down.
+
+The policy has to be applied by the pool, not by config.yml's browser kwargs:
+/crawl and /crawl/stream build their BrowserConfig from the request body
+(api.py handle_crawl_request), so those kwargs never reach them.
+"""
+import sys
+from pathlib import Path
+
+import pytest
+import yaml
+
+from crawl4ai import BrowserConfig
+
+ROOT = Path(__file__).resolve().parents[2]
+DOCKER_DIR = ROOT / "deploy" / "docker"
+sys.path.insert(0, str(DOCKER_DIR))
+
+pool = pytest.importorskip("crawler_pool", reason="docker server deps not installed")
+
+
+def test_config_enables_recycling():
+    cfg = yaml.safe_load((DOCKER_DIR / "config.yml").read_text())
+    assert cfg["crawler"]["pool"].get("max_pages_before_recycle", 0) > 0, (
+        "config.yml must set crawler.pool.max_pages_before_recycle > 0, else "
+        "pooled contexts are never recycled under sustained load (#2231)."
+    )
+
+
+def test_pool_applies_recycling_to_a_request_supplied_config():
+    """A config off the wire carries no recycle setting; the pool must add it."""
+    from_request = BrowserConfig()
+    assert from_request.max_pages_before_recycle == 0  # guard the premise
+
+    pool._apply_pool_defaults(from_request)
+    assert from_request.max_pages_before_recycle == pool.RECYCLE_PAGES > 0
+
+
+def test_explicit_caller_value_wins():
+    cfg = BrowserConfig(max_pages_before_recycle=7)
+    pool._apply_pool_defaults(cfg)
+    assert cfg.max_pages_before_recycle == 7
+
+
+@pytest.mark.asyncio
+async def test_get_crawler_applies_it(monkeypatch):
+    """The call site matters, not just the helper: a config handed to
+    get_crawler() must come back carrying the pool's recycle policy."""
+    class _FakeCrawler:
+        def __init__(self, config, **kw):
+            self.config = config
+
+        async def start(self):
+            return self
+
+    monkeypatch.setattr(pool, "AsyncWebCrawler", _FakeCrawler)
+    monkeypatch.setattr(pool, "COLD_POOL", {})
+    monkeypatch.setattr(pool, "HOT_POOL", {})
+    monkeypatch.setattr(pool, "PERMANENT", None)
+    monkeypatch.setattr(pool, "get_container_memory_percent", lambda: 10.0)
+
+    cfg = BrowserConfig()
+    await pool.get_crawler(cfg)
+    assert cfg.max_pages_before_recycle == pool.RECYCLE_PAGES > 0
+
+
+def test_signature_is_stable_across_requests():
+    """Applying the default must not split the pool into two signatures."""
+    a, b = BrowserConfig(), BrowserConfig()
+    assert pool._sig(pool._apply_pool_defaults(a)) == pool._sig(pool._apply_pool_defaults(b))
+
+
+if __name__ == "__main__":
+    sys.exit(pytest.main([__file__, "-v"]))
```

---

### Incident Patch 7: `15f4b29b` (2026-09-22)
**Commit Message**: fix: default max_pages_before_recycle in DEFAULT_CONFIG

load_config() deep-merges config.yml over DEFAULT_CONFIG, so a mounted
custom config.yml without the new key left RECYCLE_PAGES at 0 and kept
the #2231 bug after upgrade. An explicit 0 in config.yml still disables
recycling.

**File**: `deploy/docker/utils.py` (modified, +1/-1)
```diff
@@ -64,7 +64,7 @@ class FilterType(str, Enum):
         "memory_threshold_percent": 95.0,
         "rate_limiter": {"enabled": True, "base_delay": [1.0, 2.0]},
         "timeouts": {"stream_init": 30.0, "batch_process": 300.0},
-        "pool": {"max_pages": 40, "idle_ttl_sec": 300},
+        "pool": {"max_pages": 40, "idle_ttl_sec": 300, "max_pages_before_recycle": 200},
         "browser": {
             "kwargs": {"headless": True, "text_mode": True},
             "extra_args": [
```

---

### Incident Patch 8: `64f124c5` (2026-09-22)
**Commit Message**: Merge pull request #2229 from Nalhin/fix-robots-parsing

fix: preventing disallow: /*? from blocking the whole website.

**File**: `crawl4ai/utils.py` (modified, +20/-2)
```diff
@@ -249,6 +249,22 @@ def needs_update(self):
         return installed is None or installed < current
 
 
+def _preserve_bare_query(rules_text: str) -> str:
+    """Append '*' to Allow/Disallow values ending in a bare '?' (e.g. '/*?').
+
+    '/*?' and '/*?*' allow/deny exactly the same URLs; the rewrite only
+    survives parsers that would otherwise drop the trailing '?'.
+    """
+    fixed = []
+    for raw_line in rules_text.splitlines():
+        body, _, _ = raw_line.partition("#")
+        key, sep, value = body.partition(":")
+        if sep and key.strip().lower() in ("allow", "disallow") and value.strip().endswith("?"):
+            raw_line = f"{key.strip()}: {value.strip()}*"
+        fixed.append(raw_line)
+    return "\n".join(fixed)
+
+
 class RobotsParser:
     # Default 7 days cache TTL
     CACHE_TTL = 7 * 24 * 60 * 60
@@ -355,8 +371,10 @@ async def can_fetch(self, url: str, user_agent: str = "*") -> bool:
             return True
 
         # Create parser for this check
-        parser = RobotFileParser() 
-        parser.parse(rules.splitlines())
+        parser = RobotFileParser()
+        # Old Pythons drop a trailing '?' from rules, so '/*?' becomes
+        # '/*' and blocks the whole site. '/*?*' matches the same URLs.
+        parser.parse(_preserve_bare_query(rules).splitlines())
         
         # If parser can't read rules, allow access
         if not parser.mtime():
```

**File**: `tests/general/test_robot_parser.py` (modified, +39/-0)
```diff
@@ -123,6 +123,45 @@ async def giant_robots(request):
         finally:
             await runner.cleanup()
 
+        # 4b. Test query-string disallow (Disallow: /*?) on a separate host port.
+        # Plain URLs must stay crawlable while query URLs are denied (RFC 9309).
+        async def start_query_server():
+            query_app = web.Application()
+
+            async def query_robots(request):
+                return web.Response(text="User-agent: *\nDisallow: /*?\n")
+
+            query_app.router.add_get('/robots.txt', query_robots)
+            query_runner = web.AppRunner(query_app)
+            await query_runner.setup()
+            query_site = web.TCPSite(query_runner, '127.0.0.1', 0)
+            await query_site.start()
+            query_port = query_runner.addresses[0][1]
+            return query_runner, query_port
+
+        query_runner, query_port = await start_query_server()
+        try:
+            print("\n4b. Testing query-string robots.txt rules...")
+            query_base = f"http://127.0.0.1:{query_port}"
+
+            result = await parser.can_fetch(f"{query_base}/", "bot")
+            print(f"Plain root (/): {'allowed' if result else 'denied'}")
+            assert result, "Plain root should be allowed with Disallow: /*?"
+
+            result = await parser.can_fetch(f"{query_base}/article", "bot")
+            print(f"Plain page (/article): {'allowed' if result else 'denied'}")
+            assert result, "Plain page should be allowed with Disallow: /*?"
+
+            result = await parser.can_fetch(f"{query_base}/?page=2", "bot")
+            print(f"Query root (/?page=2): {'allowed' if result else 'denied'}")
+            assert not result, "Query root should be denied with Disallow: /*?"
+
+            result = await parser.can_fetch(f"{query_base}/article?ref=x", "bot")
+            print(f"Query page (/article?ref=x): {'allowed' if result else 'denied'}")
+            assert not result, "Query page should be denied with Disallow: /*?"
+        finally:
+            await query_runner.cleanup()
+
         # 5. Cache manipulation
         print("\n5. Testing cache manipulation...")
         
```

**File**: `tests/unit/test_robots_query_rules.py` (added, +88/-0)
```diff
@@ -0,0 +1,88 @@
+"""Unit tests for robots.txt rules ending in a bare '?' (e.g. 'Disallow: /*?').
+
+urllib drops the trailing '?', which the wildcard patch in crawl4ai.utils turns
+into the regex '^/.*' - disallowing the whole site. _preserve_bare_query rewrites
+the rule to the equivalent '/*?*', which survives the round trip.
+"""
+
+import asyncio
+
+import pytest
+
+from crawl4ai.utils import RobotsParser, _preserve_bare_query
+
+QUERY_RULES = "User-agent: *\nDisallow: /*?\n"
+
+
+@pytest.mark.parametrize(
+    "line, expected",
+    [
+        # A bare trailing '?' gains an explicit '*'
+        ("Disallow: /*?", "Disallow: /*?*"),
+        ("Allow: /*?", "Allow: /*?*"),
+        ("Disallow: /search?", "Disallow: /search?*"),
+        # Case and spacing are normalised, not required
+        ("disallow: /*?", "disallow: /*?*"),
+        ("DISALLOW:/*?", "DISALLOW: /*?*"),
+        ("Disallow:   /*?   ", "Disallow: /*?*"),
+        # Already explicit, or no trailing '?': left alone
+        ("Disallow: /*?*", "Disallow: /*?*"),
+        ("Disallow: /private/", "Disallow: /private/"),
+        ("Allow: /public/", "Allow: /public/"),
+        # Non-rule directives are never rewritten, even ending in '?'
+        ("User-agent: *", "User-agent: *"),
+        ("Sitemap: https://example.com/sitemap.xml?", "Sitemap: https://example.com/sitemap.xml?"),
+        ("", ""),
+        ("# just a comment", "# just a comment"),
+    ],
+)
+def test_preserve_bare_query_line_rewriting(line, expected):
+    assert _preserve_bare_query(line) == expected
+
+
+def test_preserve_bare_query_keeps_document_structure():
+    """Untouched lines, blank lines and ordering survive verbatim.
+
+    Compared line by line, since the only caller re-splits the result
+    immediately; whether a trailing newline survives is deliberately unpinned.
+    """
+    source = "User-agent: *\nDisallow: /private/\n\nDisallow: /*?\nAllow: /public/\n"
+    assert _preserve_bare_query(source).splitlines() == [
+        "User-agent: *", "Disallow: /private/", "", "Disallow: /*?*", "Allow: /public/",
+    ]
+
+
+def test_preserve_bare_query_is_idempotent():
+    once = _preserve_bare_query(QUERY_RULES)
+    assert _preserve_bare_query(once) == once
+
+
+def _can_fetch(rules, path, tmp_path):
+    """Answer can_fetch for a host whose rules are pre-seeded in the cache.
+
+    Nothing listens on the host, and can_fetch falls back to 'allowed' whenever a
+    fetch fails, so any denial below can only have come from the cached rules.
+    """
+    host = "localhost:8098"
+    parser = RobotsParser(cache_dir=str(tmp_path))
+    parser._cache_rules(host, rules)
+    assert parser._get_cached_rules(host)[1], "seeded rules should be fresh"
+    return asyncio.run(parser.can_fetch(f"http://{host}{path}", "bot"))
+
+
+@pytest.mark.parametrize("path", ["/", "/article", "/a/b/c"])
+def test_query_disallow_keeps_plain_urls_crawlable(path, tmp_path):
+    """'Disallow: /*?' must not take the whole site down."""
+    assert _can_fetch(QUERY_RULES, path, tmp_path) is True
+
+
+@pytest.mark.parametrize("path", ["/?page=2", "/article?ref=x", "/a/b?x=1&y=2"])
+def test_query_disallow_denies_query_urls(path, tmp_path):
+    assert _can_fetch(QUERY_RULES, path, tmp_path) is False
+
+
+def test_ordinary_rules_still_apply(tmp_path):
+    """The rewrite must not disturb rules that never had a trailing '?'."""
+    rules = "User-agent: *\nDisallow: /private/\nAllow: /public/\n"
+    assert _can_fetch(rules, "/public/page", tmp_path) is True
+    assert _can_fetch(rules, "/private/secret", tmp_path) is False
```

---

### Incident Patch 9: `673171ad` (2026-09-22)
**Commit Message**: Merge pull request #2269 from nightcityblade/docs-security-supported-versions-v2

docs: list 0.9.x as supported

**File**: `SECURITY.md` (modified, +2/-1)
```diff
@@ -4,7 +4,8 @@
 
 | Version | Supported          |
 | ------- | ------------------ |
-| 0.8.x   | :white_check_mark: |
+| 0.9.x   | :white_check_mark: |
+| 0.8.x   | :x: (upgrade recommended) |
 | 0.7.x   | :x: (upgrade recommended) |
 | < 0.7   | :x:                |
 
```

---

### Incident Patch 10: `2740268e` (2026-09-14)
**Commit Message**: Merge pull request #2265 from unclecode/fix/2242-deep-crawl-perf

fix(deep-crawl): drop the O(n²) parent scan and the duplicate best-first enqueue

**File**: `crawl4ai/deep_crawling/bff_strategy.py` (modified, +7/-0)
```diff
@@ -179,6 +179,13 @@ async def link_discovery(
             base_url = normalize_url_for_deep_crawl(url, source_url)
             if base_url in visited:
                 continue
+            # Already queued at an equal or shallower depth: a second entry would
+            # be scored and dropped for nothing. A strictly shallower find still
+            # has to re-queue, so the URL is crawled at its true distance from the
+            # start and its own children stay inside max_depth.
+            queued_depth = depths.get(base_url)
+            if queued_depth is not None and queued_depth <= new_depth:
+                continue
             if not await self.can_process_url(base_url, new_depth):
                 self.stats.urls_skipped += 1
                 continue
```

**File**: `crawl4ai/deep_crawling/bfs_strategy.py` (modified, +6/-2)
```diff
@@ -248,6 +248,8 @@ async def _arun_batch(
 
             next_level: List[Tuple[str, Optional[str]]] = []
             urls = [url for url, _ in current_level]
+            # reversed() keeps first-parent-wins if a resumed level repeats a URL
+            parents = dict(reversed(current_level))
 
             # Clone the config to disable deep crawling recursion and enforce batch mode.
             batch_config = config.clone(deep_crawl_strategy=None, stream=False)
@@ -258,7 +260,7 @@ async def _arun_batch(
                 depth = depths.get(url, 0)
                 result.metadata = result.metadata or {}
                 result.metadata["depth"] = depth
-                parent_url = next((parent for (u, parent) in current_level if u == url), None)
+                parent_url = parents.get(url)
                 result.metadata["parent_url"] = parent_url
                 results.append(result)
 
@@ -336,6 +338,8 @@ async def _arun_stream(
 
             next_level: List[Tuple[str, Optional[str]]] = []
             urls = [url for url, _ in current_level]
+            # reversed() keeps first-parent-wins if a resumed level repeats a URL
+            parents = dict(reversed(current_level))
             visited.update(urls)
 
             stream_config = config.clone(deep_crawl_strategy=None, stream=True)
@@ -348,7 +352,7 @@ async def _arun_stream(
                 depth = depths.get(url, 0)
                 result.metadata = result.metadata or {}
                 result.metadata["depth"] = depth
-                parent_url = next((parent for (u, parent) in current_level if u == url), None)
+                parent_url = parents.get(url)
                 result.metadata["parent_url"] = parent_url
                 
                 # Count only successful crawls
```

**File**: `tests/deep_crawling/test_deep_crawl_perf_2242.py` (added, +181/-0)
```diff
@@ -0,0 +1,181 @@
+"""Regression tests for issue #2242.
+
+1. BFS matched a fetched result back to its parent by re-scanning the whole
+   level, which is O(n^2) per level.
+2. Best-First only marked a URL visited when it was dequeued, so two pages
+   linking to the same third page pushed it onto the priority queue twice.
+"""
+
+import asyncio
+from collections import Counter
+from typing import Any, Dict, List
+from unittest.mock import MagicMock
+
+import pytest
+
+from crawl4ai.deep_crawling import BFSDeepCrawlStrategy, BestFirstCrawlingStrategy
+
+
+def make_config(stream: bool = False):
+    config = MagicMock()
+    config.clone = MagicMock(return_value=config)
+    config.stream = stream
+    return config
+
+
+class FakeResult:
+    """Cheap stand-in for CrawlResult (MagicMock is too slow to time against)."""
+
+    def __init__(self, url: str, children: List[str]):
+        self.url = url
+        self.success = True
+        self.metadata: Dict[str, Any] = {}
+        self.links = {
+            "internal": [{"href": child} for child in children],
+            "external": [],
+        }
+
+
+def make_crawler(link_map: Dict[str, List[str]]):
+    """Mock crawler serving a fixed url -> child urls map."""
+
+    async def arun_many(urls, config):
+        results = [FakeResult(url, link_map.get(url, [])) for url in urls]
+
+        if config.stream:
+            async def gen():
+                for result in results:
+                    yield result
+            return gen()
+        return results
+
+    crawler = MagicMock()
+    crawler.arun_many = arun_many
+    return crawler
+
+
+ROOT = "https://example.com"
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("stream", [False, True])
+async def test_bfs_parent_url_is_correct_for_every_child(stream):
+    """Parent bookkeeping must stay correct now that it uses a lookup table."""
+    children = [f"{ROOT}/p{i}" for i in range(50)]
+    link_map = {ROOT: children, **{c: [f"{c}/leaf"] for c in children}}
+
+    strategy = BFSDeepCrawlStrategy(max_depth=1, max_pages=100)
+    crawler, config = make_crawler(link_map), make_config(stream=stream)
+
+    if stream:
+        results = [r async for r in strategy._arun_stream(ROOT, crawler, config)]
+    else:
+        results = await strategy._arun_batch(ROOT, crawler, config)
+
+    parents = {r.url: r.metadata["parent_url"] for r in results}
+    assert parents[ROOT] is None
+    assert len(results) == len(children) + 1
+    for child in children:
+        assert parents[child] == ROOT
+
+
+@pytest.mark.asyncio
+async def test_bfs_level_bookkeeping_scales_linearly():
+    """Matching results back to parents must not re-scan the level per result.
+
+    max_depth=0 keeps link discovery out of the loop and resume_state seeds a
+    level of arbitrary width, so the only per-result work left is the parent
+    lookup. Quadratic bookkeeping shows up as a ~4x cost for 2x the URLs.
+    """
+
+    async def run(n: int) -> float:
+        urls = [f"{ROOT}/p{i}" for i in range(n)]
+        strategy = BFSDeepCrawlStrategy(
+            max_depth=0,
+            max_pages=n + 1,
+            resume_state={
+                "visited": urls,
+                "pending": [{"url": u, "parent_url": ROOT} for u in urls],
+                "depths": {u: 1 for u in urls},
+                "pages_crawled": 0,
+            },
+        )
+        crawler, config = make_crawler({}), make_config()
+        loop = asyncio.get_running_loop()
+        start = loop.time()
+        results = await strategy._arun_batch(ROOT, crawler, config)
+        elapsed = loop.time() - start
+        assert len(results) == n
+        return elapsed
+
+    async def best_of(n: int, rounds: int = 3) -> float:
+        return min([await run(n) for _ in range(rounds)])
+
+    await run(200)  # warm up
+    small = await best_of(2000)
+    large = await best_of(4000)
+
+    # 2x the URLs: linear is ~2x, the old full-level scan was ~4x.
+    assert large / small < 3, f"level bookkeeping looks superlinear: {large / small:.1f}x"
+
+
+@pytest.mark.asyncio
+async def test_best_first_queues_a_shared_url_once():
+    """Two parents at the same depth must enqueue a shared child only once."""
+    link_map = {
+        ROOT: [f"{ROOT}/a", f"{ROOT}/b"],
+        f"{ROOT}/a": [f"{ROOT}/shared"],
+        f"{ROOT}/b": [f"{ROOT}/shared"],
+        f"{ROOT}/shared": [],
+    }
+
+    snapshots: List[List[str]] = []
+
+    async def on_state_change(state: Dict[str, Any]):
+        snapshots.append([item["url"] for item in state["queue_items"]])
+
+    strategy = BestFirstCrawlingStrategy(
+        max_depth=2, max_pages=10, on_state_change=on_state_change
+    )
+    crawled = [
+        r.url
+        async for r in strategy._arun_stream(ROOT, make_crawler(link_map), make_config(stream=True))
+    ]
+
+    for queue in snapshots:
+        assert not [u for u, n in Counter(queue).items() if n > 1], f"duplicate in queue: {queue}"
+    assert sorted(crawled) == s
```

---

### Incident Patch 11: `e5e10118` (2026-09-14)
**Commit Message**: fix(deep-crawl): keep the shallowest depth when de-duplicating best-first links

The first cut of the best-first de-duplication marked a URL seen the moment it
was discovered, which froze it at the depth it was *first* found rather than the
shallowest depth reachable. Best-first does not visit levels in order, so a URL
can be discovered at depth 3 through a high-scoring branch and only later at
depth 2 through a slower one. Freezing depth 3 means link_discovery bails at
4 > max_depth and that whole subtree is silently lost.

The duplicate enqueue was doing double duty: it was also the depth relaxation.
So de-duplicate on depth instead of on identity. A URL already queued at an
equal or shallower depth is skipped, which is the waste the issue reported; a
strictly shallower re-discovery still re-queues, and the existing dequeue guard
drops the stale deeper copy.

This reverts the `visited`-at-discovery change, the removed dequeue guard and
the resume-state compatibility shim, none of which are needed now: `visited`
keeps its original crawled-only meaning and the whole fix is one guard in
link_discovery.

Found in review of #2265.

Co-Authored-By: Claude Opus 5 (1M context) <[REDACTED

**File**: `crawl4ai/deep_crawling/bff_strategy.py` (modified, +12/-6)
```diff
@@ -179,11 +179,17 @@ async def link_discovery(
             base_url = normalize_url_for_deep_crawl(url, source_url)
             if base_url in visited:
                 continue
+            # Already queued at an equal or shallower depth: a second entry would
+            # be scored and dropped for nothing. A strictly shallower find still
+            # has to re-queue, so the URL is crawled at its true distance from the
+            # start and its own children stay inside max_depth.
+            queued_depth = depths.get(base_url)
+            if queued_depth is not None and queued_depth <= new_depth:
+                continue
             if not await self.can_process_url(base_url, new_depth):
                 self.stats.urls_skipped += 1
                 continue
                 
-            visited.add(base_url)
             valid_links.append(base_url)
             
         # Record the new depths and add to next_links
@@ -215,10 +221,6 @@ async def _arun_best_first(
             self._pages_crawled = self._resume_state.get("pages_crawled", 0)
             # Restore queue from saved items
             queue_items = self._resume_state.get("queue_items", [])
-            # Older checkpoints could hold a URL twice and recorded only crawled
-            # URLs in "visited"; drop the repeats and treat everything queued as seen.
-            queue_items = list({item["url"]: item for item in queue_items}.values())
-            visited.update(item["url"] for item in queue_items)
             for item in queue_items:
                 await queue.put((item["score"], item["depth"], item["url"], item["parent_url"]))
             # Initialize shadow list if callback is set
@@ -231,7 +233,7 @@ async def _arun_best_first(
             # Original initialization
             initial_score = self.url_scorer.score(start_url) if self.url_scorer else 0
             await queue.put((-initial_score, 0, start_url, None))
-            visited: Set[str] = {start_url}
+            visited: Set[str] = set()
             depths: Dict[str, int] = {start_url: 0}
             # Initialize shadow list if callback is set
             if self._on_state_change:
@@ -268,6 +270,10 @@ async def _arun_best_first(
                         self._queue_shadow.remove(item)
                     except ValueError:
                         pass  # Item may have been removed already
+                score, depth, url, parent_url = item
+                if url in visited:
+                    continue
+                visited.add(url)
                 batch.append(item)
 
             if not batch:
```

**File**: `tests/deep_crawling/test_deep_crawl_perf_2242.py` (modified, +35/-1)
```diff
@@ -121,7 +121,7 @@ async def best_of(n: int, rounds: int = 3) -> float:
 
 @pytest.mark.asyncio
 async def test_best_first_queues_a_shared_url_once():
-    """Two parents linking to the same page must enqueue it a single time."""
+    """Two parents at the same depth must enqueue a shared child only once."""
     link_map = {
         ROOT: [f"{ROOT}/a", f"{ROOT}/b"],
         f"{ROOT}/a": [f"{ROOT}/shared"],
@@ -145,3 +145,37 @@ async def on_state_change(state: Dict[str, Any]):
     for queue in snapshots:
         assert not [u for u, n in Counter(queue).items() if n > 1], f"duplicate in queue: {queue}"
     assert sorted(crawled) == sorted(link_map)
+
+
+@pytest.mark.asyncio
+async def test_best_first_keeps_the_shallowest_depth_for_a_shared_url():
+    """De-duplicating must not freeze a URL at the depth it was first seen.
+
+    ROOT -> A, B, F0..F11;  A -> C;  C -> X;  B -> X;  X -> LEAF
+
+    The scores crawl C before B, so X is discovered first at depth 3 and only
+    later at depth 2. The twelve fillers push B out of the first BATCH_SIZE
+    pull, which is what lets C run ahead of B - without them both land in one
+    batch and the ordering that exposes this never happens.
+
+    If the shallower re-discovery is dropped as a duplicate, X stays at depth 3
+    and link_discovery bails at 4 > max_depth, losing LEAF.
+    """
+    a, b, c, x, leaf = (f"{ROOT}/{p}" for p in ("a", "b", "c", "x", "leaf"))
+    fillers = [f"{ROOT}/f{i}" for i in range(12)]
+    link_map = {ROOT: [a, b] + fillers, a: [c], c: [x], b: [x], x: [leaf]}
+    scores = {a: 0.9, b: 0.1, c: 0.95, x: 0.5, leaf: 0.5, **{f: 0.8 for f in fillers}}
+
+    class DictScorer:
+        def score(self, url):
+            return scores.get(url, 0.0)
+
+    strategy = BestFirstCrawlingStrategy(max_depth=3, max_pages=100, url_scorer=DictScorer())
+    crawled = {
+        r.url: r.metadata["depth"]
+        async for r in strategy._arun_stream(ROOT, make_crawler(link_map), make_config(stream=True))
+    }
+
+    assert crawled[x] == 2, "X must be crawled at its shallowest depth, not the first one seen"
+    assert leaf in crawled, "LEAF is within max_depth once X sits at depth 2"
+    assert crawled == {ROOT: 0, a: 1, b: 1, c: 2, x: 2, leaf: 3, **{f: 1 for f in fillers}}
```

---

### Incident Patch 12: `06cb0a81` (2026-09-14)
**Commit Message**: Merge pull request #2266 from unclecode/fix/timeout-ceiling-followup

Keep malformed timeouts at the default ceiling

**File**: `crawl4ai/async_configs.py` (modified, +3/-1)
```diff
@@ -357,8 +357,10 @@ def _clamp_untrusted(type_name: str, params: dict) -> dict:
 
     def _cap_timeout(v):
         # 0 historically meant "no timeout"; treat as the cap, never unbounded.
+        # Malformed input is the one value an attacker gets for free, so it
+        # falls back to the 60s default rather than to a raised ceiling.
         if not isinstance(v, (int, float)) or v <= 0:
-            return ceiling
+            return min(_DEFAULT_MAX_TIMEOUT_MS, ceiling)
         return min(int(v), ceiling)
 
     if type_name == "CrawlerRunConfig":
```

**File**: `deploy/docker/MIGRATION.md` (modified, +10/-0)
```diff
@@ -189,6 +189,16 @@ a smaller value tightens it. A value that is not a positive integer is refused
 with a warning and the 60000ms default kept, so a typo cannot silently widen
 the bound.
 
+Raising this ceiling alone is not enough. Two other deadlines cut a crawl
+short first, and both are in `config.yml`:
+
+- `limits.wall_clock_s` (default `300`) — the per-crawl deadline; the request
+  gets a 504 at that point no matter what `page_timeout` says.
+- `crawler.timeouts.batch_process` (default `300.0`) — the batch crawl budget.
+
+So a 300000ms ceiling needs `wall_clock_s` and `batch_process` raised past 300
+too, or the extra timeout can never be reached.
+
 ### Error responses are generic
 
 5xx responses return `{"error": "Internal server error", "correlation_id": "…"}`.
```

**File**: `tests/test_config_defaults.py` (modified, +33/-1)
```diff
@@ -361,7 +361,7 @@ def test_env_can_tighten_the_ceiling(self, monkeypatch):
 
     # A typo must not silently widen a DoS bound, so the default is kept and
     # the operator is told rather than left to find out under load.
-    @pytest.mark.parametrize("value", ["", "abc", "0", "-1", "60_000", "1e5"])
+    @pytest.mark.parametrize("value", ["", "abc", "0", "-1", "1e5"])
     def test_a_non_positive_integer_keeps_the_default(self, monkeypatch, value):
         monkeypatch.setenv("CRAWL4AI_MAX_TIMEOUT_MS", value)
 
@@ -373,6 +373,38 @@ def test_a_non_positive_integer_keeps_the_default(self, monkeypatch, value):
 
         assert config.page_timeout == 60_000
 
+    def test_an_underscored_integer_is_accepted(self, monkeypatch):
+        # int("60_000") == 60000 in Python, so this is a valid ceiling, not a typo.
+        monkeypatch.setenv("CRAWL4AI_MAX_TIMEOUT_MS", "120_000")
+
+        config = CrawlerRunConfig.load(
+            {"page_timeout": 500_000}, provenance=Provenance.UNTRUSTED
+        )
+
+        assert config.page_timeout == 120_000
+
+    def test_malformed_timeout_falls_back_to_the_default_not_the_ceiling(
+        self, monkeypatch
+    ):
+        # The one field an untrusted caller gets for free must not inherit a
+        # raised ceiling just by being junk.
+        monkeypatch.setenv("CRAWL4AI_MAX_TIMEOUT_MS", "300000")
+
+        config = CrawlerRunConfig.load(
+            {"page_timeout": 0}, provenance=Provenance.UNTRUSTED
+        )
+
+        assert config.page_timeout == 60_000
+
+    def test_malformed_timeout_respects_a_tightened_ceiling(self, monkeypatch):
+        monkeypatch.setenv("CRAWL4AI_MAX_TIMEOUT_MS", "5000")
+
+        config = CrawlerRunConfig.load(
+            {"page_timeout": "abc"}, provenance=Provenance.UNTRUSTED
+        )
+
+        assert config.page_timeout == 5_000
+
     @pytest.mark.parametrize("value", ["abc", "0", "-1"])
     def test_a_bad_value_warns(self, monkeypatch, value):
         monkeypatch.setenv("CRAWL4AI_MAX_TIMEOUT_MS", value)
```

---

### Incident Patch 13: `61eb5734` (2026-09-14)
**Commit Message**: fix(config): keep malformed timeouts at the default ceiling

Follow-up to #2212. Three loose ends from review:

- _cap_timeout returned the configured ceiling for any non-numeric or
  non-positive value, so raising CRAWL4AI_MAX_TIMEOUT_MS also raised what
  junk input became. An untrusted caller sending page_timeout 0 or "abc"
  got the full raised ceiling of held browser page. It now falls back to
  the 60s default, still bounded by a tightened ceiling.

- MIGRATION.md's 300000ms example collides with limits.wall_clock_s (300)
  and crawler.timeouts.batch_process (300.0), so an operator following it
  exactly still got a 504 at 300s. Say to raise those too.

- "60_000" sat in the "not a positive integer" parametrize list, but
  int("60_000") is 60000, so it was accepted, not refused. The test passed
  only because that value equals the default. Moved to its own accepted
  case and added coverage for the clamp fallback.

Co-Authored-By: Claude Opus 5 (1M context) <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01PVaRrydnAhwnnRYpe5an1U

**File**: `crawl4ai/async_configs.py` (modified, +3/-1)
```diff
@@ -357,8 +357,10 @@ def _clamp_untrusted(type_name: str, params: dict) -> dict:
 
     def _cap_timeout(v):
         # 0 historically meant "no timeout"; treat as the cap, never unbounded.
+        # Malformed input is the one value an attacker gets for free, so it
+        # falls back to the 60s default rather than to a raised ceiling.
         if not isinstance(v, (int, float)) or v <= 0:
-            return ceiling
+            return min(_DEFAULT_MAX_TIMEOUT_MS, ceiling)
         return min(int(v), ceiling)
 
     if type_name == "CrawlerRunConfig":
```

**File**: `deploy/docker/MIGRATION.md` (modified, +10/-0)
```diff
@@ -189,6 +189,16 @@ a smaller value tightens it. A value that is not a positive integer is refused
 with a warning and the 60000ms default kept, so a typo cannot silently widen
 the bound.
 
+Raising this ceiling alone is not enough. Two other deadlines cut a crawl
+short first, and both are in `config.yml`:
+
+- `limits.wall_clock_s` (default `300`) — the per-crawl deadline; the request
+  gets a 504 at that point no matter what `page_timeout` says.
+- `crawler.timeouts.batch_process` (default `300.0`) — the batch crawl budget.
+
+So a 300000ms ceiling needs `wall_clock_s` and `batch_process` raised past 300
+too, or the extra timeout can never be reached.
+
 ### Error responses are generic
 
 5xx responses return `{"error": "Internal server error", "correlation_id": "…"}`.
```

**File**: `tests/test_config_defaults.py` (modified, +33/-1)
```diff
@@ -361,7 +361,7 @@ def test_env_can_tighten_the_ceiling(self, monkeypatch):
 
     # A typo must not silently widen a DoS bound, so the default is kept and
     # the operator is told rather than left to find out under load.
-    @pytest.mark.parametrize("value", ["", "abc", "0", "-1", "60_000", "1e5"])
+    @pytest.mark.parametrize("value", ["", "abc", "0", "-1", "1e5"])
     def test_a_non_positive_integer_keeps_the_default(self, monkeypatch, value):
         monkeypatch.setenv("CRAWL4AI_MAX_TIMEOUT_MS", value)
 
@@ -373,6 +373,38 @@ def test_a_non_positive_integer_keeps_the_default(self, monkeypatch, value):
 
         assert config.page_timeout == 60_000
 
+    def test_an_underscored_integer_is_accepted(self, monkeypatch):
+        # int("60_000") == 60000 in Python, so this is a valid ceiling, not a typo.
+        monkeypatch.setenv("CRAWL4AI_MAX_TIMEOUT_MS", "120_000")
+
+        config = CrawlerRunConfig.load(
+            {"page_timeout": 500_000}, provenance=Provenance.UNTRUSTED
+        )
+
+        assert config.page_timeout == 120_000
+
+    def test_malformed_timeout_falls_back_to_the_default_not_the_ceiling(
+        self, monkeypatch
+    ):
+        # The one field an untrusted caller gets for free must not inherit a
+        # raised ceiling just by being junk.
+        monkeypatch.setenv("CRAWL4AI_MAX_TIMEOUT_MS", "300000")
+
+        config = CrawlerRunConfig.load(
+            {"page_timeout": 0}, provenance=Provenance.UNTRUSTED
+        )
+
+        assert config.page_timeout == 60_000
+
+    def test_malformed_timeout_respects_a_tightened_ceiling(self, monkeypatch):
+        monkeypatch.setenv("CRAWL4AI_MAX_TIMEOUT_MS", "5000")
+
+        config = CrawlerRunConfig.load(
+            {"page_timeout": "abc"}, provenance=Provenance.UNTRUSTED
+        )
+
+        assert config.page_timeout == 5_000
+
     @pytest.mark.parametrize("value", ["abc", "0", "-1"])
     def test_a_bad_value_warns(self, monkeypatch, value):
         monkeypatch.setenv("CRAWL4AI_MAX_TIMEOUT_MS", value)
```

---

### Incident Patch 14: `8ccfbcd8` (2026-09-14)
**Commit Message**: Merge pull request #2212 from damusix/fix/configurable-max-timeout

Make the untrusted timeout ceiling configurable

**File**: `crawl4ai/async_configs.py` (modified, +40/-3)
```diff
@@ -293,13 +293,48 @@ class UntrustedConfigError(ValueError):
 }
 
 # Upper bounds applied to attacker-influenced quantities after filtering.
-_MAX_TIMEOUT_MS = 60_000
+_DEFAULT_MAX_TIMEOUT_MS = 60_000
 _MAX_SCROLL_STEPS = 1000
 _MAX_VIEWPORT = 4000
 _MAX_PDF_BYTES = 100 * 1024 * 1024
 _MAX_PDF_PAGES = 2000
 
 
+def _max_timeout_ms() -> int:
+    """Ceiling for the untrusted timeout fields, in milliseconds.
+
+    60s is the right bound for a server reachable by untrusted callers, and
+    stays the default. An operator whose deployment is not public — a crawler
+    on a private network fetching pages that legitimately take minutes — can
+    raise it with CRAWL4AI_MAX_TIMEOUT_MS, or lower it to tighten the bound.
+
+    Read per call rather than captured at import so the setting applies
+    wherever the process picked its environment up, and so a test can set it
+    without reloading the module. A value that is not a positive integer is
+    refused loudly and the default kept: a typo here would silently widen a
+    DoS bound, which is the one outcome worse than the timeout being fixed.
+    """
+    raw = os.getenv("CRAWL4AI_MAX_TIMEOUT_MS")
+
+    if raw is None or raw == "":
+        return _DEFAULT_MAX_TIMEOUT_MS
+
+    try:
+        ceiling = int(raw)
+    except ValueError:
+        ceiling = 0
+
+    if ceiling <= 0:
+        warnings.warn(
+            f"CRAWL4AI_MAX_TIMEOUT_MS={raw!r} is not a positive integer; "
+            f"keeping the {_DEFAULT_MAX_TIMEOUT_MS}ms default.",
+            stacklevel=2,
+        )
+        return _DEFAULT_MAX_TIMEOUT_MS
+
+    return ceiling
+
+
 def _filter_untrusted_fields(type_name: str, params: dict) -> dict:
     """Drop non-allowlisted fields and raise on forbidden (power) fields."""
     forbidden = UNTRUSTED_FORBIDDEN_FIELDS.get(type_name, set())
@@ -318,11 +353,13 @@ def _filter_untrusted_fields(type_name: str, params: dict) -> dict:
 
 def _clamp_untrusted(type_name: str, params: dict) -> dict:
     """Clamp attacker-influenced quantities to safe upper bounds."""
+    ceiling = _max_timeout_ms()
+
     def _cap_timeout(v):
         # 0 historically meant "no timeout"; treat as the cap, never unbounded.
         if not isinstance(v, (int, float)) or v <= 0:
-            return _MAX_TIMEOUT_MS
-        return min(int(v), _MAX_TIMEOUT_MS)
+            return ceiling
+        return min(int(v), ceiling)
 
     if type_name == "CrawlerRunConfig":
         for f in ("page_timeout", "wait_for_timeout", "body_visibility_timeout"):
```

**File**: `deploy/docker/MIGRATION.md` (modified, +19/-0)
```diff
@@ -170,6 +170,25 @@ limits:
 
 To keep the previous behavior exactly, set the caps you don't want to `0`.
 
+### Timeouts from a request are capped at 60s
+
+`page_timeout`, `wait_for_timeout`, and `body_visibility_timeout` arriving in a
+request body are clamped to 60000ms, so a client asking for more is given 60s
+and its crawl fails with `Page.goto: Timeout 60000ms exceeded`.
+
+That bound is right for a server reachable by untrusted callers. A deployment
+that is not public — a crawler on a private network fetching pages that
+legitimately take minutes — can raise it:
+
+```bash
+CRAWL4AI_MAX_TIMEOUT_MS=300000
+```
+
+A request still only gets the timeout it asks for; this sets the ceiling, and
+a smaller value tightens it. A value that is not a positive integer is refused
+with a warning and the 60000ms default kept, so a typo cannot silently widen
+the bound.
+
 ### Error responses are generic
 
 5xx responses return `{"error": "Internal server error", "correlation_id": "…"}`.
```

**File**: `tests/test_config_defaults.py` (modified, +79/-1)
```diff
@@ -1,11 +1,12 @@
 """Tests for BrowserConfig.set_defaults / CrawlerRunConfig.set_defaults."""
 
+import warnings
 from types import SimpleNamespace
 from unittest.mock import AsyncMock, MagicMock
 
 import pytest
 
-from crawl4ai.async_configs import BrowserConfig, CrawlerRunConfig
+from crawl4ai.async_configs import BrowserConfig, CrawlerRunConfig, Provenance
 from crawl4ai.async_crawler_strategy import AsyncPlaywrightCrawlerStrategy
 
 
@@ -310,3 +311,80 @@ def test_independent_reset(self):
         BrowserConfig.reset_defaults()
         assert BrowserConfig.get_defaults() == {}
         assert CrawlerRunConfig.get_defaults() == {"verbose": False}
+
+
+# ── Untrusted timeout ceiling ──────────────────────────────────────────
+
+
+class TestMaxTimeoutCeiling:
+    """CRAWL4AI_MAX_TIMEOUT_MS raises (or lowers) the untrusted clamp."""
+
+    TIMEOUT_FIELDS = ("page_timeout", "wait_for_timeout", "body_visibility_timeout")
+
+    @pytest.mark.parametrize("field", TIMEOUT_FIELDS)
+    def test_defaults_to_60s_when_unset(self, monkeypatch, field):
+        monkeypatch.delenv("CRAWL4AI_MAX_TIMEOUT_MS", raising=False)
+
+        config = CrawlerRunConfig.load(
+            {field: 500_000}, provenance=Provenance.UNTRUSTED
+        )
+
+        assert getattr(config, field) == 60_000
+
+    @pytest.mark.parametrize("field", TIMEOUT_FIELDS)
+    def test_env_raises_the_ceiling(self, monkeypatch, field):
+        monkeypatch.setenv("CRAWL4AI_MAX_TIMEOUT_MS", "300000")
+
+        config = CrawlerRunConfig.load(
+            {field: 300_000}, provenance=Provenance.UNTRUSTED
+        )
+
+        assert getattr(config, field) == 300_000
+
+    def test_a_request_over_the_raised_ceiling_is_still_clamped(self, monkeypatch):
+        monkeypatch.setenv("CRAWL4AI_MAX_TIMEOUT_MS", "300000")
+
+        config = CrawlerRunConfig.load(
+            {"page_timeout": 900_000}, provenance=Provenance.UNTRUSTED
+        )
+
+        assert config.page_timeout == 300_000
+
+    def test_env_can_tighten_the_ceiling(self, monkeypatch):
+        monkeypatch.setenv("CRAWL4AI_MAX_TIMEOUT_MS", "5000")
+
+        config = CrawlerRunConfig.load(
+            {"page_timeout": 30_000}, provenance=Provenance.UNTRUSTED
+        )
+
+        assert config.page_timeout == 5_000
+
+    # A typo must not silently widen a DoS bound, so the default is kept and
+    # the operator is told rather than left to find out under load.
+    @pytest.mark.parametrize("value", ["", "abc", "0", "-1", "60_000", "1e5"])
+    def test_a_non_positive_integer_keeps_the_default(self, monkeypatch, value):
+        monkeypatch.setenv("CRAWL4AI_MAX_TIMEOUT_MS", value)
+
+        with warnings.catch_warnings():
+            warnings.simplefilter("ignore")
+            config = CrawlerRunConfig.load(
+                {"page_timeout": 500_000}, provenance=Provenance.UNTRUSTED
+            )
+
+        assert config.page_timeout == 60_000
+
+    @pytest.mark.parametrize("value", ["abc", "0", "-1"])
+    def test_a_bad_value_warns(self, monkeypatch, value):
+        monkeypatch.setenv("CRAWL4AI_MAX_TIMEOUT_MS", value)
+
+        with pytest.warns(UserWarning, match="CRAWL4AI_MAX_TIMEOUT_MS"):
+            CrawlerRunConfig.load(
+                {"page_timeout": 1_000}, provenance=Provenance.UNTRUSTED
+            )
+
+    def test_trusted_config_is_never_clamped(self, monkeypatch):
+        monkeypatch.delenv("CRAWL4AI_MAX_TIMEOUT_MS", raising=False)
+
+        config = CrawlerRunConfig(page_timeout=900_000)
+
+        assert config.page_timeout == 900_000
```

---

### Incident Patch 15: `19f3e5e1` (2026-09-14)
**Commit Message**: fix(deep-crawl): drop the O(n^2) parent scan and the duplicate best-first enqueue

BFS matched each fetched result back to its parent with
`next((parent for (u, parent) in current_level if u == url), None)`, re-scanning
the whole level once per result. On a page with high fan-out that pure-Python
bookkeeping dominates the level. current_level is already a list of
(url, parent) pairs, so build the lookup once per level instead. reversed()
keeps the old first-parent-wins behaviour if a resumed level repeats a URL.

BestFirst only added a URL to `visited` when it was dequeued, so two pages
linking to the same third page pushed it onto the priority queue twice. The
duplicate was dropped at dequeue time, so output stayed correct, but the URL was
scored and queued for nothing. BFS and DFS both already mark URLs at discovery
time; make BestFirst match and the dequeue guard becomes unreachable. Restoring
a checkpoint now de-dupes the saved queue and treats everything queued as seen,
so states written by older builds still resume without a repeat crawl.

Fixes #2242

Co-Authored-By: Claude Opus 5 (1M context) <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01Utx8BTDqXTscjq

**File**: `crawl4ai/deep_crawling/bff_strategy.py` (modified, +6/-5)
```diff
@@ -183,6 +183,7 @@ async def link_discovery(
                 self.stats.urls_skipped += 1
                 continue
                 
+            visited.add(base_url)
             valid_links.append(base_url)
             
         # Record the new depths and add to next_links
@@ -214,6 +215,10 @@ async def _arun_best_first(
             self._pages_crawled = self._resume_state.get("pages_crawled", 0)
             # Restore queue from saved items
             queue_items = self._resume_state.get("queue_items", [])
+            # Older checkpoints could hold a URL twice and recorded only crawled
+            # URLs in "visited"; drop the repeats and treat everything queued as seen.
+            queue_items = list({item["url"]: item for item in queue_items}.values())
+            visited.update(item["url"] for item in queue_items)
             for item in queue_items:
                 await queue.put((item["score"], item["depth"], item["url"], item["parent_url"]))
             # Initialize shadow list if callback is set
@@ -226,7 +231,7 @@ async def _arun_best_first(
             # Original initialization
             initial_score = self.url_scorer.score(start_url) if self.url_scorer else 0
             await queue.put((-initial_score, 0, start_url, None))
-            visited: Set[str] = set()
+            visited: Set[str] = {start_url}
             depths: Dict[str, int] = {start_url: 0}
             # Initialize shadow list if callback is set
             if self._on_state_change:
@@ -263,10 +268,6 @@ async def _arun_best_first(
                         self._queue_shadow.remove(item)
                     except ValueError:
                         pass  # Item may have been removed already
-                score, depth, url, parent_url = item
-                if url in visited:
-                    continue
-                visited.add(url)
                 batch.append(item)
 
             if not batch:
```

**File**: `crawl4ai/deep_crawling/bfs_strategy.py` (modified, +6/-2)
```diff
@@ -248,6 +248,8 @@ async def _arun_batch(
 
             next_level: List[Tuple[str, Optional[str]]] = []
             urls = [url for url, _ in current_level]
+            # reversed() keeps first-parent-wins if a resumed level repeats a URL
+            parents = dict(reversed(current_level))
 
             # Clone the config to disable deep crawling recursion and enforce batch mode.
             batch_config = config.clone(deep_crawl_strategy=None, stream=False)
@@ -258,7 +260,7 @@ async def _arun_batch(
                 depth = depths.get(url, 0)
                 result.metadata = result.metadata or {}
                 result.metadata["depth"] = depth
-                parent_url = next((parent for (u, parent) in current_level if u == url), None)
+                parent_url = parents.get(url)
                 result.metadata["parent_url"] = parent_url
                 results.append(result)
 
@@ -336,6 +338,8 @@ async def _arun_stream(
 
             next_level: List[Tuple[str, Optional[str]]] = []
             urls = [url for url, _ in current_level]
+            # reversed() keeps first-parent-wins if a resumed level repeats a URL
+            parents = dict(reversed(current_level))
             visited.update(urls)
 
             stream_config = config.clone(deep_crawl_strategy=None, stream=True)
@@ -348,7 +352,7 @@ async def _arun_stream(
                 depth = depths.get(url, 0)
                 result.metadata = result.metadata or {}
                 result.metadata["depth"] = depth
-                parent_url = next((parent for (u, parent) in current_level if u == url), None)
+                parent_url = parents.get(url)
                 result.metadata["parent_url"] = parent_url
                 
                 # Count only successful crawls
```

**File**: `tests/deep_crawling/test_deep_crawl_perf_2242.py` (added, +147/-0)
```diff
@@ -0,0 +1,147 @@
+"""Regression tests for issue #2242.
+
+1. BFS matched a fetched result back to its parent by re-scanning the whole
+   level, which is O(n^2) per level.
+2. Best-First only marked a URL visited when it was dequeued, so two pages
+   linking to the same third page pushed it onto the priority queue twice.
+"""
+
+import asyncio
+from collections import Counter
+from typing import Any, Dict, List
+from unittest.mock import MagicMock
+
+import pytest
+
+from crawl4ai.deep_crawling import BFSDeepCrawlStrategy, BestFirstCrawlingStrategy
+
+
+def make_config(stream: bool = False):
+    config = MagicMock()
+    config.clone = MagicMock(return_value=config)
+    config.stream = stream
+    return config
+
+
+class FakeResult:
+    """Cheap stand-in for CrawlResult (MagicMock is too slow to time against)."""
+
+    def __init__(self, url: str, children: List[str]):
+        self.url = url
+        self.success = True
+        self.metadata: Dict[str, Any] = {}
+        self.links = {
+            "internal": [{"href": child} for child in children],
+            "external": [],
+        }
+
+
+def make_crawler(link_map: Dict[str, List[str]]):
+    """Mock crawler serving a fixed url -> child urls map."""
+
+    async def arun_many(urls, config):
+        results = [FakeResult(url, link_map.get(url, [])) for url in urls]
+
+        if config.stream:
+            async def gen():
+                for result in results:
+                    yield result
+            return gen()
+        return results
+
+    crawler = MagicMock()
+    crawler.arun_many = arun_many
+    return crawler
+
+
+ROOT = "https://example.com"
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("stream", [False, True])
+async def test_bfs_parent_url_is_correct_for_every_child(stream):
+    """Parent bookkeeping must stay correct now that it uses a lookup table."""
+    children = [f"{ROOT}/p{i}" for i in range(50)]
+    link_map = {ROOT: children, **{c: [f"{c}/leaf"] for c in children}}
+
+    strategy = BFSDeepCrawlStrategy(max_depth=1, max_pages=100)
+    crawler, config = make_crawler(link_map), make_config(stream=stream)
+
+    if stream:
+        results = [r async for r in strategy._arun_stream(ROOT, crawler, config)]
+    else:
+        results = await strategy._arun_batch(ROOT, crawler, config)
+
+    parents = {r.url: r.metadata["parent_url"] for r in results}
+    assert parents[ROOT] is None
+    assert len(results) == len(children) + 1
+    for child in children:
+        assert parents[child] == ROOT
+
+
+@pytest.mark.asyncio
+async def test_bfs_level_bookkeeping_scales_linearly():
+    """Matching results back to parents must not re-scan the level per result.
+
+    max_depth=0 keeps link discovery out of the loop and resume_state seeds a
+    level of arbitrary width, so the only per-result work left is the parent
+    lookup. Quadratic bookkeeping shows up as a ~4x cost for 2x the URLs.
+    """
+
+    async def run(n: int) -> float:
+        urls = [f"{ROOT}/p{i}" for i in range(n)]
+        strategy = BFSDeepCrawlStrategy(
+            max_depth=0,
+            max_pages=n + 1,
+            resume_state={
+                "visited": urls,
+                "pending": [{"url": u, "parent_url": ROOT} for u in urls],
+                "depths": {u: 1 for u in urls},
+                "pages_crawled": 0,
+            },
+        )
+        crawler, config = make_crawler({}), make_config()
+        loop = asyncio.get_running_loop()
+        start = loop.time()
+        results = await strategy._arun_batch(ROOT, crawler, config)
+        elapsed = loop.time() - start
+        assert len(results) == n
+        return elapsed
+
+    async def best_of(n: int, rounds: int = 3) -> float:
+        return min([await run(n) for _ in range(rounds)])
+
+    await run(200)  # warm up
+    small = await best_of(2000)
+    large = await best_of(4000)
+
+    # 2x the URLs: linear is ~2x, the old full-level scan was ~4x.
+    assert large / small < 3, f"level bookkeeping looks superlinear: {large / small:.1f}x"
+
+
+@pytest.mark.asyncio
+async def test_best_first_queues_a_shared_url_once():
+    """Two parents linking to the same page must enqueue it a single time."""
+    link_map = {
+        ROOT: [f"{ROOT}/a", f"{ROOT}/b"],
+        f"{ROOT}/a": [f"{ROOT}/shared"],
+        f"{ROOT}/b": [f"{ROOT}/shared"],
+        f"{ROOT}/shared": [],
+    }
+
+    snapshots: List[List[str]] = []
+
+    async def on_state_change(state: Dict[str, Any]):
+        snapshots.append([item["url"] for item in state["queue_items"]])
+
+    strategy = BestFirstCrawlingStrategy(
+        max_depth=2, max_pages=10, on_state_change=on_state_change
+    )
+    crawled = [
+        r.url
+        async for r in strategy._arun_stream(ROOT, make_crawler(link_map), make_config(stream=True))
+    ]
+
+    for queue in snapshots:
+        assert not [u for u, n in Counter(queue).items() if n > 1], f"duplicate in queue: {queue}"
+    assert sorted(crawled) == so
```

#### Recent Merged Pull Requests:
- **PR #2337** (2026-10-05): The cloud launch on main: the docs banner, the docs home, the daily notice, with the soft-launch words (@unclecode)
- **PR #2336** (2026-10-05): README and the launch banner: free credit to start, no amount and no end date (@unclecode)
- **PR #2299** (closed): fix(docker): report a refused seed as one failed result, not a dead batch (@wippa-studios)
- **PR #2281** (2026-09-23): Release v0.9.4 (@ntohidi)
- **PR #2280** (2026-09-23): docs(security): list fixed issues and features per release through v0.9.3 (@SohamKukreti)
- **PR #2279** (2026-09-22): chore(ci): drop the dead Google Apps Script stargazer step (@ntohidi)
- **PR #2278** (2026-09-22): fix(robots): don't patch robotparser on Python 3.14+ (@ntohidi)
- **PR #2269** (2026-09-22): docs: list 0.9.x as supported (@nightcityblade)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
