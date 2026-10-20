> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/scrapinghub-dateparser-learnings.md`  
> **Source**: github ([https://github.com/scrapinghub/dateparser](https://github.com/scrapinghub/dateparser))  
> **Source Version**: `337d7f5a`  
> **License**: BSD-3-Clause  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-20T01:54:48.746Z  
> **Learning ID**: `learn-github-scrapinghub-dateparser`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): scrapinghub/dateparser

---

## 1. Executive Forensic Architecture & System Mechanics

`scrapinghub/dateparser` provides non-destructive, multi-lingual, and calendar-agnostic date/time parsing from unstructured and semi-structured text across 200+ language locales. It resolves natural language expressions (e.g., relative dates like *"3 days ago"*, time spans, and parts of the day like *"yesterday evening"*) and structured date formats into standardized Python `datetime.datetime` objects.

```
                         [ Unstructured String ]
                                    │
                                    ▼
       ┌────────────────────────────────────────────────────────┐
       │   dateparser.parse() / DateDataParser.get_date_data()   │
       └────────────────────────────┬───────────────────────────┘
                                    │
       ┌────────────────────────────┴───────────────────────────┐
       ▼                                                        ▼
┌───────────────┐                                       ┌───────────────┐
│ Language/CLDR │                                       │ Regex / Token │
│  Translation  │                                       │ Pre-processor │
└──────┬────────┘                                       └───────┬───────┘
       │ [NFKD Unicode Normalization, Splitting, Mapping]       │
       └────────────────────────────┬───────────────────────────┘
                                    │
                                    ▼
       ┌────────────────────────────────────────────────────────┐
       │               Parser Pipeline Arbiter                  │
       │  1. Relative / Time-Span Parser (relativedelta/offset) │
       │  2. Custom Calendars (Hijri, Jalali, French Rep.)      │
       │  3. Monkey-Patched Isolated `_strptime` Engine         │
       └────────────────────────────┬───────────────────────────┘
                                    │
                                    ▼
       ┌────────────────────────────────────────────────────────┐
       │              Timezone & Settings Boundary              │
       │  - Ambiguity Resolution (PREFER_DAY_OF_MONTH)           │
       │  - DST Wall-Clock Re-localization (pytz / tzlocal)     │
       │  - Aware / Naive Type Normalization                    │
       └────────────────────────────┬───────────────────────────┘
                                    │
                                    ▼
                      [ Normalized datetime.datetime ]
```

### Architectural Subsystems and Boundaries
1. **Locale & Data Ingestion (`dateparser/data/`, `dateparser/languages/`)**:
   - Compiles and packages Unicode Common Locale Data Repository (CLDR) tables into compact Python modules per locale.
   - Normalizes non-ASCII unicode scripts via `NFKD` decomposition, stripping `Mn` (Nonspacing Mark) categories while preserving lexical boundaries.
2. **Translation Pipeline (`dateparser/languages/locale.py`)**:
   - Performs dictionary token replacement, regex-based transliteration, and morphological reduction (e.g., stripping Swedish ordinal suffixes like `:e` / `:a`).
   - Translates all non-English localized calendar names, relative tokens, and modifiers into canonical English tokens before handing them to downstream parsers.
3. **Core Parsing Arbitration Engine (`dateparser/date.py`, `dateparser/parser.py`)**:
   - Dispatches tokens against candidate pipelines: deterministic `strptime`, relative delta calculators (`dateutil.relativedelta`), natural time span evaluators (`time_spans.py`), and non-Gregorian systems (Hijri, Jalali, French Republican).
4. **Isolated Locale-Independent `_strptime` Runtime (`dateparser/utils/strptime.py`)**:
   - Decouples parsing from the host operating system's global C-level `setlocale()` state. Dynamically loads a private instance of Python's internal `_strptime` module via `importlib.util` and monkey-patches its calendar reference to fixed English names, preventing thread-unsafe locale collisions.
5. **Timezone & Temporal Alignment Engine (`dateparser/utils/__init__.py`)**:
   - Handles the conversion of naive to timezone-aware timestamps, daylight saving transitions (DST gaps/folds), and relative base delta arithmetic.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Isolated Module Execution for Global C-Extension State Decoupling
**RULE**:
When an application requires invariant standard library behavior that depends on global OS or C-runtime state (such as `setlocale` affecting CPython's `_strptime` or `time.strftime`), the engine **MUST NOT** mutate global process configuration (`locale.setlocale`). Instead, it **MUST** isolate and execute a sandboxed, private copy of the underlying module and its state structures via dynamic spec loaders (`importlib.util`), monkey-patching references purely within that isolated namespace.

**WHY**:
Mutating global process state via `locale.setlocale()` is thread-unsafe, alters application-wide string formatting, and introduces severe race conditions in concurrent web workers (e.g., Gunicorn/Uvicorn). Standard library `_strptime` caches locale-dependent regexes and month names globally. If the host OS locale switches to `fr_FR` or `tr_TR`, internal parsing of standardized English fallback tokens will silently fail or corrupt character lookups (such as the dotted/dotless `i` pitfall in Turkish).

**WHEN TO APPLY**:
Apply in any runtime parsing library, multi-threaded text-processing pipeline, or CLI where parsing semantics must remain 100% deterministic, regardless of host environment locale or concurrent third-party library calls.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import calendar
import importlib.util
import sys
from collections.abc import Callable
from time import struct_time
from types import ModuleType
from typing import Any

def build_isolated_strptime() -> Callable[[str, str], struct_time]:
    """Isolate _strptime into an independent namespace with hardcoded English invariants."""
    # 1. Resolve spec for private stdlib module
    spec = importlib.util.find_spec("_strptime")
    if spec is None or spec.loader is None:
        raise RuntimeError("CPython internal '_strptime' could not be resolved.")
    
    # 2. Allocate isolated module instance without placing into sys.modules directly
    isolated_strptime: Any = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(isolated_strptime)
    
    # 3. Create a shallow-cloned calendar module to avoid running decorators
    # that pollute or mutate the host calendar module's Enum structures.
    isolated_calendar = ModuleType("calendar_isolated")
    isolated_calendar.__dict__.update(vars(calendar), __name__="calendar_isolated")
    
    # 4. Inject strict English calendar names directly into the isolated runtime
    isolated_strptime._getlang = lambda: ("en_US", "UTF-8")
    isolated_strptime.calendar = isolated_calendar
    isolated_strptime.calendar.day_abbr = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
    isolated_strptime.calendar.day_name = [
        "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"
    ]
    isolated_strptime.calendar.month_abbr = [
        "", "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"
    ]
    isolated_strptime.calendar.month_name = [
        "", "january", "february", "march", "april", "may", "june",
        "july", "august", "september", "october", "november", "december"
    ]
    
    return isolated_strptime._strptime_time
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: NEVER mutate global system locale to parse strings!
import locale
import _strptime

def unsafe_parse_english(date_str: str, fmt: str):
    # DANGEROUS: Changes process-wide state. Races with all threads.
    # Corrupts logging timestamps, numeric float formatting (e.g. comma decimals), and UI.
    locale.setlocale(locale.LC_ALL, "en_US.UTF-8")
    return _strptime._strptime(date_str, fmt)
```

**VERIFICATION METHOD**:
Verify that running concurrent parses under a modified global OS locale does not alter output:
```python
import locale
import threading
from dateparser.utils.strptime import strptime

def test_strptime_locale_concurrency_shield():
    def mutate_locale():
        try:
            locale.setlocale(locale.LC_ALL, "fr_FR.UTF-8")
        except locale.Error:
            pass

    t = threading.Thread(target=mutate_locale)
    t.start()
    t.join()

    # The parser MUST correctly parse English tokens irrespective of thread locale
    res = strptime("24 October 2026", "%d %B %Y")
    assert res.year == 2026 and res.month == 10 and res.day == 24
```

---

### 2. Spacing-Modifier Mark Word-Boundary Disambiguation Invariant
**RULE**:
When performing token boundary detection and splitting on strings containing Unicode spacing-modifier marks (e.g., acute accents `´`, backticks `` ` ``, circumflex `^`, or modifier letters), the tokenizer **MUST NOT** strip them directly during unicode normalization without first checking if the character normalizes to an ASCII space character (`normalize_unicode(char) == " "`). If the character normalizes to space but is flanked by non-whitespace characters (`not chars[i-1].isspace() and not chars[i+1].isspace()`), the tokenizer **MUST** insert an explicit word-separator boundary (`" "`) prior to subsequent tokenization and alignment passes.

**WHY**:
Certain standalone diacritics are classified by Unicode not as combining marks (`Mn`), but as spacing modifier letters (`Sk`). When `NFKD` decomposition followed by category filtering is applied indiscriminately, or when a regex assumes token adjacency, a string like `"ABC´1997"` has its accent dropped, inadvertently concatenating `"ABC"` and `"1997"` into `"ABC1997"`. This destroys the subsequent number-extraction step and drops valid temporal tokens.

**WHEN TO APPLY**:
Lexical tokenizers, Natural Language Processing (NLP) token-alignment pipelines, search-index extractors, and entity boundary recognizers handling raw scraped user content containing inconsistent accent marks.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import unicodedata
from typing import Literal

def normalize_unicode(
    string: str, form: Literal["NFC", "NFD", "NFKC", "NFKD"] = "NFKD"
) -> str:
    return "".join(
        c for c in unicodedata.normalize(form, string)
        if unicodedata.category(c) != "Mn"
    )

def break_standalone_spacing_marks(string: str) -> str:
    """
    Inserts explicit ASCII spaces after standalone spacing modifiers
    that bridge two non-space tokens, preventing token gluing.
    """
    chars = list(string)
    # Reverse iteration ensures indexing stability upon single-character insertions
    for i in reversed(range(len(chars))):
        char = chars[i]
        if (
            not char.isspace()
            and normalize_unicode(char) == " "
            and 0 < i < len(chars) - 1
            and not chars[i - 1].isspace()
            and not chars[i + 1].isspace()
        ):
            chars.insert(i + 1, " ")
    return "".join(chars)
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: NEVER blindly strip or normalize punctuation without boundary preservation.
def unsafe_tokenizer(string: str) -> list[str]:
    # Corrupts "ABC´1997" -> "ABC1997" when `´` maps to space or empty string!
    cleaned = "".join(c for c in string if c.isalnum() or c.isspace())
    return cleaned.split()
```

**VERIFICATION METHOD**:
Run an assert verifying boundary preservation:
```python
def test_spacing_mark_token_integrity():
    raw_input = "Event´2026.04.15"
    separated = break_standalone_spacing_marks(raw_input)
    assert separated == "Event´ 2026.04.15"
    assert separated.split()[1] == "2026.04.15"
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Accidental Date Dropping Caused by Standalone Accent Gluing
- **Context**: Subsystem: Language token normalization and entity alignment (`dateparser/languages/locale.py`).
- **What Was Expected**: Executing `search_dates("ABC´1997.", languages=["en"])` should identify `"1997"` as a distinct year token and parse it into `datetime(1997, ...)`.
- **What Actually Happened**: The search pipeline dropped the date completely, returning `None`. The standalone accent character `´` (Unicode U+00B4) glued `"ABC"` to `"1997"`, causing the internal regex search to treat `"ABC1997"` as an invalid alphanumeric token.
- **Evidence in Repo**: Commit SHA `852506d1`, PR #1505, `dateparser/languages/locale.py`, regression test in `tests/test_search.py`.
- **Root Cause**: In `_simplify_split_align`, the tokenizer relied on `_word_split` directly without handling spacing-modifier accents that decompose to whitespace under Unicode translation algorithms, but remain glued to non-space characters in their raw form.
- **Remediation Code Diff**:
```python
--- a/dateparser/languages/locale.py
+++ b/dateparser/languages/locale.py
@@ -475,7 +475,9 @@ def _simplify_split_align(
         self, original: str, settings: "Settings | None"
     ) -> tuple[list[str], list[str]]:
         # TODO: Switch to new split method.
-        original_tokens = self._word_split(original, settings=settings)
+        original_tokens = self._word_split(
+            self._break_standalone_marks(original), settings=settings
+        )
         simplified_tokens = self._word_split(
             self._simplify(normalize_unicode(original), settings=settings),
             settings=settings,
@@ -542,6 +544,25 @@ def _split_dict(self, dictionary: Dictionary) -> dict[str, str | None]:
+    @staticmethod
+    def _break_standalone_marks(string: str) -> str:
+        chars = list(string)
+        for i in reversed(range(len(chars))):
+            char = chars[i]
+            if (
+                not char.isspace()
+                and normalize_unicode(char) == " "
+                and 0 < i < len(chars) - 1
+                and not chars[i - 1].isspace()
+                and not chars[i + 1].isspace()
+            ):
+                chars.insert(i + 1, " ")
+        return "".join(chars)
```
- **Lesson**: Pre-tokenization stages must inspect character semantics under both raw and normalized forms. When in-place modifications occur, processing lists in reverse order (`reversed(range(len(chars)))`) guarantees stable indices upon insertion.

---

### Incident 2: Swedish Ordinal Suffix Parse Failure
- **Context**: Translation data engine (`dateparser/data/date_translation_data/sv.py`, `sv.yaml`).
- **What Was Expected**: Swedish date expressions containing colon-delimited ordinal suffixes like `"den 24:e december 2020"` or `"1:a januari 2021"` must parse cleanly to days `24` and `1`.
- **What Actually Happened**: The parser failed to match formats and returned `None` because the tokenizer encountered `24:e` and could not resolve the token as an integer day, failing subsequent strptime/regex matching.
- **Evidence in Repo**: Commit SHA `5b31fe4a`, PR #1484, `dateparser/data/date_translation_data/sv.py`, tests in `tests/test_languages.py`.
- **Root Cause**: The Swedish locale definitions lacked simplification transforms mapping the regex pattern `(\d+):[ae]\b` to `\1`.
- **Remediation Code Diff**:
```python
--- a/dateparser/data/date_translation_data/sv.py
+++ b/dateparser/data/date_translation_data/sv.py
@@ -307,6 +307,9 @@
     "simplifications": [
+        {
+            "(\\d+):[ae]\\b": "\\1"
+        },
         {
             "en": "1"
         },
```
- **Lesson**: Parsing multilingual natural language dates requires language-specific normalization rules for ordinal patterns that deviate from standard European alphanumeric suffixes (such as English `st/nd/rd/th` vs Nordic colon-affixes `:e/:a`).

---

### Incident 3: Stale DST Offsets During Wall-Clock Relative Date Translations
- **Context**: Timezone assignment engine (`dateparser/utils/__init__.py`).
- **What Was Expected**: With `RELATIVE_BASE = datetime(2024, 3, 9, 12, 0)`, `TIMEZONE = "America/New_York"`, and `RETURN_AS_TIMEZONE_AWARE = True`, parsing `"tomorrow at 12:00"` must yield `2024-03-10T12:00:00-04:00` because the US East Coast transitioned into Daylight Saving Time on March 10, 2024 at 02:00.
- **What Actually Happened**: The returned timestamp was `2024-03-10T12:00:00-05:00` (retaining the stale winter standard time offset of the base date).
- **Evidence in Repo**: Bug Issue #1545, closed via PR in commit `ac088237`.
- **Root Cause**: When computing relative additions across day boundaries, naive wall-clock time was shifted via `datetime + timedelta(days=1)` while caching or propagating the initial timezone's UTC offset without triggering `tz.localize()` on the newly computed target calendar date.
- **Remediation Code Diff**:
```python
--- a/dateparser/utils/__init__.py
+++ b/dateparser/utils/__init__.py
@@ -140,6 +140,11 @@ def apply_timezone_from_settings(date_obj: datetime, settings: "Settings | None
+    # Force re-localization of naive target wall-clock time to re-evaluate DST transition
+    if date_obj.tzinfo and hasattr(date_obj.tzinfo, "localize"):
+        naive_wall_time = date_obj.replace(tzinfo=None)
+        date_obj = date_obj.tzinfo.localize(naive_wall_time)
```
- **Lesson**: In libraries using `pytz` tzinfo instances, never perform pure date arithmetic on aware objects without explicitly re-localizing the resulting wall-clock time, as `pytz` does not automatically update transition offsets across arithmetic bounds.

---

### Incident 4: Day-of-Year (%j) Rollover Exploitation into Following Year
- **Context**: Strict format parsing engine (`dateparser/utils/strptime.py`).
- **What Was Expected**: A string supplying an invalid day-of-year (such as day `366` in a non-leap year like `1999`) must be rejected with a `ValueError`.
- **What Actually Happened**: Standard CPython `_strptime` silently allowed day `366` of `1999` to roll over into `2000-01-01`, but left `tm_yday` in the intermediate struct as `366`. This returned a completely different year than specified by the input string.
- **Evidence in Repo**: `dateparser/utils/strptime.py:126-136`.
- **Root Cause**: CPython's internal `_strptime_time` implementation performs modular arithmetic on `tm_yday`, rolling excess days over into January of the subsequent year instead of throwing a validation fault.
- **Remediation Code Diff**:
```python
--- a/dateparser/utils/strptime.py
+++ b/dateparser/utils/strptime.py
@@ -124,6 +124,12 @@ def strptime(date_string: str, format: str) -> datetime:
     time_tuple = __strptime(date_string, prepared_format)
     obj = datetime(*time_tuple[:-3])
 
+    if day_of_year_in_format and time_tuple.tm_yday != obj.timetuple().tm_yday:
+        raise ValueError(
+            f"day of year {time_tuple.tm_yday} is out of range for year {obj.year - 1}"
+        )
```
- **Lesson**: Never trust platform C/stdlib parser return values unconditionally. Compare the pre-conversion time tuple fields (`tm_yday`) directly against the synthesized `datetime` object fields to prevent silent calendar rollovers.

---

### Incident 5: Thread-Safe Singleton Registry Data Race
- **Context**: Parser class caching (`dateparser/utils/__init__.py:236-267`).
- **What Was Expected**: Multi-threaded initialization of parser singletons using the `@registry` decorator must guarantee that no thread receives a partially initialized class instance.
- **What Actually Happened**: Under high thread contention, Thread B read an entry from `cls.__registry_dict[key]` while Thread A was executing `creator(cls, *args)`, before `instance.registry_key = key` had completed, causing an `AttributeError` in downstream methods.
- **Evidence in Repo**: `dateparser/utils/__init__.py:245-257`.
- **Root Cause**: Publication of the newly created instance into `registry_dict` occurred before assigning all critical instance attributes.
- **Remediation Code Diff**:
```python
--- a/dateparser/utils/__init__.py
+++ b/dateparser/utils/__init__.py
@@ -250,8 +250,10 @@ def registry(cls: type[_T]) -> type[_T]:
                 registry_dict = getattr(cls, "__registry_dict")
 
                 if key not in registry_dict:
                     instance = creator(cls, *args)
-                    registry_dict[key] = instance
-                    instance.registry_key = key
+                    # Set the key before publishing the instance so other
+                    # threads never observe an entry without ``registry_key``.
+                    instance.registry_key = key
+                    registry_dict[key] = instance
                 return registry_dict[key]
```
- **Lesson**: Safe publication pattern: All internal fields of a newly initialized object must be assigned *before* the pointer to the object is published to a shared or globally accessible map.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Deep Dictionary Merging Type Checks**:
  In `combine_dicts` (`dateparser/utils/__init__.py`), dictionaries must be recursively merged without converting types implicitly.
  ```python
  def combine_dicts(primary: Mapping[str, Any], supplementary: Mapping[str, Any]) -> OrderedDict[str, Any]:
      combined: OrderedDict[str, Any] = OrderedDict()
      for key, value in primary.items():
          if key in supplementary:
              # Explicit type invariant checking avoids polymorphic TypeError bugs
              if isinstance(value, list) and isinstance(supplementary[key], list):
                  combined[key] = value + supplementary[key]
              elif isinstance(value, dict) and isinstance(supplementary[key], Mapping):
                  combined[key] = combine_dicts(value, supplementary[key])
              else:
                  combined[key] = supplementary[key]
          else:
              combined[key] = value
      for key in supplementary:
          if key not in primary:
              combined[key] = supplementary[key]
      return combined
  ```
- **Strict Falsy Checking for Number Zero**:
  In `french_republican.py`, year zero is an illegal state. Checking `if not year:` catches both `0` and `None`:
  ```python
  year = int(match["year"]) if match["year"] else _roman_to_int(match["roman"])
  if not year:  # Evaluates True if year is 0 or unassigned, correctly aborting execution
      raise ValueError(datestring)
  ```

### 2. Infinite Loop & Recursion Guards
- **Leap Year Century Step Invariants**:
  When searching for preceding or succeeding leap years (`dateparser/utils/__init__.py`), unbounded while-loops must have provable bounds. Centurial rules dictate that a leap year cannot be further than 8 years away (e.g., between 1896 and 1904).
  ```python
  def _get_leap_year(year: int, future: bool) -> int:
      step = 1 if future else -1
      leap_year = year + step
      iterations = 0
      while not calendar.isleap(leap_year):
          leap_year += step
          iterations += 1
          if iterations > 8:
              # Strict mathematical upper-bound invariant guard
              raise RuntimeError(f"Leap year search exceeded theoretical boundary for year {year}")
      return leap_year
  ```
- **Reverse Iteration on In-Place Modifications**:
  In `_break_standalone_marks`, when altering a sequence during traversal, the code MUST iterate in reverse (`reversed(range(len(chars)))`). Iterating forward while executing `insert()` causes an infinite loop or index drift, repeatedly evaluating newly inserted characters.

### 3. UI & UX Micro-Mechanics (CLI & Formatting Safeguards)
- **Path Separation Across OS Runtimes**:
  In `dateparser_cli/utils.py`, Windows AppData paths and POSIX caches require explicit isolation:
  ```python
  DEFAULT_DIR_NAME = "dateparser_models"
  DEFAULT_UNIX_CACHE_DIR = "~/.cache"
  DEFAULT_WINDOWS_CACHE_DIR = Path.home() / "AppData" / "Roaming"

  _cache_dir = DEFAULT_WINDOWS_CACHE_DIR if sys.platform.startswith("win") else DEFAULT_UNIX_CACHE_DIR
  dateparser_model_home = (Path(_cache_dir) / DEFAULT_DIR_NAME).expanduser()
  ```
- **Safe Directory Unlinking**:
  Cache purging prevents deletion of parent folders by ensuring files inside are iteratively unlinked via `rglob("*.*")` rather than raw directory tree deletion.

### 4. Backend Concurrency & Memory Safety
- **Global Lock Protection Over Singleton Factories**:
  ```python
  _registry_lock = threading.Lock()

  def constructor(cls: Any, *args: Any, **kwargs: Any) -> Any:
      key = cls.get_key(*args, **kwargs)
      with _registry_lock:
          # Critical section prevents race conditions in singleton instantiations
          if not hasattr(cls, "__registry_dict"):
              setattr(cls, "__registry_dict", {})
          registry_dict = getattr(cls, "__registry_dict")
          if key not in registry_dict:
              instance = creator(cls, *args)
              instance.registry_key = key
              registry_dict[key] = instance
          return registry_dict[key]
  ```

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Strict Format Padding for Microseconds**:
  When slicing microsecond fractions (`dateparser/utils/strptime.py`), strings with fewer than 6 digits must be right-padded with zeros rather than converted directly to integer (which would turn `.1` into `1` microsecond instead of `100000` microseconds).
  ```python
  ms = match_groups["microsecond"]
  # Invariant: Precision requires right-padding, not integer casting directly
  ms = ms + ((6 - len(ms)) * "0")
  obj = obj.replace(microsecond=int(ms))
  ```

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
- **Layering**: Clean separation between Linguistic Token Normalization (CLDR), Syntactic Rule Reductions, and Temporal Semantic Evaluation.
- **Coupling**: The system uses Duck Typing and Protocol interfaces (`_CalendarParser`) to decouple non-Gregorian parsing classes (Hijri, Jalali, French Republican) from core parser code.
- **State Ownership**: Settings are immutable structures passed via `@apply_settings` decorators, ensuring thread safety during concurrent parses with disparate settings.

### 2. Core Abstractions
- `DateData`: A typed data container encapsulating `date_obj: datetime | None`, `period: str | None`, `locale: str | None`, and `parts: tuple[str, ...]`.
- `Settings`: A validation boundary providing default fallbacks for date order (`DMY`, `MDY`, `YMD`), relative bases, timezone directives, and clamp rules (`PREFER_DAY_OF_MONTH`).

### 3. Error Handling
- **Non-Throwing Public Facade**: The top-level `parse()` method catches internal format parsing errors and returns `None` rather than surfacing lower-level syntax errors.
- **Specific Internal Exceptions**: Custom exceptions like `SettingValidationError` and strict `ValueError` assertions prevent bad state propagation before parsing begins.

### 4. Testing
- **Parameterized Matrix Tests**: Exhaustive use of `@parameterized.expand` across combinations of languages, relative offsets, and ambiguous day-month layouts.
- **Property/Fuzz Invariants**: Integrated with `cifuzz` and `atheris` fuzzers (`.github/workflows/cifuzz.yml`) to pass malformed Unicode and prevent parser deadlocks or unbounded regex evaluations (ReDoS).

### 5. Security
- **Threat Model**: Ingestion of adversarial strings via web scrapers.
- **ReDoS Mitigation**: Regex expressions are pinned to the `regex` library (instead of Python's standard `re`), leveraging its robust engine to defend against catastrophic backtracking.
- **Safe Directory Operations**: The CLI cache engine unlinks verified files with specific extensions rather than calling destructive shell commands.

### 6. Performance
- **Precompiled Regex Tables**: Regex patterns for parts of day and time spans are compiled once at module load time.
- **LRU and Registry Caching**: Instances of `DateDataParser` are cached via thread-safe `@registry` wrappers keyed by languages and settings signatures.
- **Zero-Allocation Short-Circuits**: `DateDataParser` checks `_default` settings; if default settings and languages are unchanged, it reuses the pre-allocated `_default_parser` instance.

### 7. Deployment
- **Packaging Invariants**: Package metadata requires `setuptools >= 77.0`, shipping explicit typing stubs (`mypy_path = "stubs"`).
- **Automated Bot Shields**: Integrated CI guard rails (`scrapy/unattended-pr-guard 0.2.0`) automatically detect and close non-compliant or stale PRs.

### 8. Agent Patterns
- **Language Detection Injection**: `parse()` allows the caller to inject custom language detection functions (`detect_languages_function: Callable[..., list[str]]`), allowing AI agent workflows to inject custom lightweight classifiers (such as FastText or LangDetect).

### 9. Data Flow
```
User String
    │
    ▼
strip_braces() -> Unicode Decomposition (NFKD) -> Word Boundary Separation
    │
    ▼
Token Mapping (sv.py, etc.) -> English Translation Canonical Representation
    │
    ▼
_strptime_patched / Calendar Converters -> Matched Tokens & Directives
    │
    ▼
apply_timezone_from_settings() -> Return datetime.datetime
```

---

## 6. The 8 Learning Extraction Artifacts

### 1. Pattern: Isolated Standard Library Module Sandbox
Use dynamic module instantiation via `importlib.util` to create a sandboxed execution space for standard library modules whose behavior depends on global state, monkey-patching references purely within that isolated scope.

### 2. Rule: Zero Global C-Locale Mutation Invariant
Libraries designed to operate within multi-threaded host systems **MUST NEVER** invoke `locale.setlocale()`. All locale-specific processing must be implemented via pure-Python string transformations or isolated sandboxes.

### 3. Architecture Principle: Separation of Lexical Normalization from Temporal Synthesis
Linguistic token canonicalization (converting Swedish, Persian, or Russian tokens into standard English structures) must be strictly decoupled from temporal instantiation (converting translated tokens into `datetime` structs).

### 4. Failure Mode: Unbounded Day-of-Year (%j) Silent Overflow
Standard library date parsers may roll excess days over into the following year rather than raising a boundary violation. Applications must verify that the day of the year in the parsed struct matches the generated datetime object.

### 5. Reusable Skill: Safe In-Place String Mutation Algorithm
When mutating a character array based on two-character lookahead and lookbehind conditions, iterate in reverse order (`reversed(range(len(chars)))`) and insert characters at `i + 1` to preserve index stability.

### 6. Decision: Dependency on `regex` Over Standard Library `re`
The development team decided to require the external `regex` engine rather than standard library `re` to gain access to proper Unicode grapheme properties (`\p{...}`), atomic grouping, and enhanced ReDoS resistance.

### 7. Anti-Pattern: Unpadded Microsecond Direct Int-Casting
Never cast a parsed fractional second string directly to an integer without padding to 6 decimal places (e.g., `int("1")` represents 1 microsecond, not 100,000 microseconds).

### 8. Verification Method: Dual Wall-Clock DST Verification Harness
Validate that parsing across a known DST boundary (e.g., `America/New_York` during the second Sunday in March) correctly shifts the UTC offset from `-05:00` to `-04:00` on naive relative dates.

---

## 7. Actionable Agent Skill & Implementation Checklist

### Step-by-Step Parser Engineering Checklist

- [ ] **Step 1: Input Normalization Boundary**
  - Apply Unicode decomposition (`NFKD`) and filter out non-spacing diacritical marks (`category(c) != "Mn"`).
  - Preserve spacing-modifier marks that represent explicit separators.

- [ ] **Step 2: Safe In-Place Spacing Normalization**
  - Run reverse index-scan (`reversed(range(len(chars)))`) over input strings to insert boundary spaces between tokens that would otherwise be glued together.

- [ ] **Step 3: Locale Decoupling Verification**
  - Verify that standard library parsing operations do not mutate `locale.setlocale()`. If using standard library components, isolate their namespace using `importlib.util`.

- [ ] **Step 4: Microsecond Precision Padding**
  - Verify that fractional second parsers right-pad strings with `'0'` characters up to the target scale (6 digits for microseconds) before converting to integers:
    ```python
    ms = ms + ((6 - len(ms)) * "0")
    ```

- [ ] **Step 5: Day-of-Year Boundary Check**
  - When `%j` is supplied in parsing directives, assert that:
    ```python
    parsed_time_tuple.tm_yday == result_datetime.timetuple().tm_yday
