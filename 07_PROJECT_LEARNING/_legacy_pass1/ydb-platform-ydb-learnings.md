# Forensic Learning Record (Deep Inspection): ydb-platform/ydb

> **Canonical Artifact**: `07_PROJECT_LEARNING/ydb-platform-ydb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ydb-platform/ydb](https://github.com/ydb-platform/ydb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:36:43.871Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ydb-platform/ydb`
- **Description**: YDB is an open source Distributed SQL Database that combines high availability and scalability with strong consistency and ACID transactions
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 4773 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.agents/skills/ydb-agent-instructions/scripts/check.py`
```
#!/usr/bin/env python3
"""Check instruction files for AI agents: SKILL.md, AGENTS.md, CLAUDE.md.

Usage:
    python3 check.py PATH [PATH ...] [--root DIR] [--warnings-as-errors]

PATH is a directory or a file. The script checks only what is under PATH.
It prints one finding per line: "ERROR path:line: message" or
"WARN path:line: message". Exit code 0 means no errors, 1 means errors,
2 means a usage problem such as a missing PATH.

Written for Python 3.9 with the standard library only.
"""
import argparse
import ast
import importlib.util
import os
import re
import subprocess
import sys
import sysconfig

PY_VERSION = (3, 9)
SKILL_NAME_RE = re.compile(r"^ydb(-[a-z0-9]+)+$")
SKILL_NAME_MAX_CHARS = 64
DESCRIPTION_MAX_CHARS = 1024
SKILL_SOFT_LINES = 200
SKILL_HARD_LINES = 500
AGENTS_MAX_LINES = 50
AGENTS_CHAIN_MAX_BYTES = 32 * 1024
SENTENCE_MAX_WORDS = 40
CLAUDE_INCLUDE = "@./AGENTS.md"
CLAUDE_SKILLS_HEADER = "Skills, read the one that matches your task:"
LINK_RE = re.compile(r"\[[^\]]*\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)")
PATH_RE = re.compile(r"(?<![\w@/.-])((?:\.\.?/)?[\w.-]+(?:/[\w.-]+)+\.(?:md|py))\b")
TODO_RE = re.compile(r"^\s*(?:[-*]\s+)?TODO\b")
SKIP_DIRS = {".git", ".claude", "contrib", "vendor", "node_modules", "__pycache__"}


class Report:
    def __init__(self):
        self.items = []

    def error(self, path, line, msg):
        self.items.append(("ERROR", path, line, msg))

    def warn(self, path, line, msg):
        self.items.append(("WARN", path, line, msg))

    def counts(self):
        errors = sum(1 for item in self.items if item[0] == "ERROR")
        return errors, len(self.items) - errors

    def print_all(self, root):
        for level, path, line, msg in sorted(self.items, key=lambda item: (item[1], item[2], item[0])):
            print("%s %s:%d: %s" % (level, os.path.relpath(path, root), line, msg))


def run_git(args, root, stdin=None):
    """Run git in root. Return the CompletedProcess, or None when git is not installed."""
    try:
        return subprocess.run(["git"] + args, cwd=root, input=stdin, capture_output=True, text=True, check=False)
    except OSError:
        return None


def find_repo_root(start):
    out = run_git(["rev-parse", "--show-toplevel"], start)
    if out is not None and out.returncode == 0 and out.stdout.strip():
        return os.path.realpath(out.stdout.strip())
    cur = os.path.realpath(start)
    while True:
        if os.path.exists(os.path.join(cur, ".git")):
            return cur
        parent = os.path.dirname(cur)
        if parent == cur:
            return None
        cur = parent


def read_text(path):
    """Text of a UTF-8 file (a BOM is allowed). Raises UnicodeDecodeError otherwise."""
    with open(path, "r", encoding="utf-8-sig") as handle:
        return handle.read()


def load_text(path, report):
    """Text of the file, or None after reporting that it is not UTF-8."""
    try:
        return read_text(path)
    except UnicodeDecodeError as exc:
        report.error(path, 0, "not valid UTF-8: %s" % exc.reason)
        return None


def ignored_paths(paths, root):
    """The subset of paths that git ignores; None when git is not installed."""
    if not paths:
        return set()
    out = run_git(["check-ignore", "--stdin"], root, stdin="\n".join(paths) + "\n")
    if out is None:
        return None
    if out.returncode not in (0, 1):
        return set()
    return set(line for line in out.stdout.splitlines() if line)


def repo_skill_names(root):
    """Map skill folder name -> SKILL.md path for every skill in the repo; None when git is not installed."""
    out = run_git(["ls-files", "--cached", "--others", "--exclude-standard", "--", "*/.agents/skills/*/SKILL.md", ".agents/skills/*/SKILL.md"], root)
    if out is None:
        return None
    names = {}
    for line in out.stdout.splitlines():
        if line.startswith(("contrib/", "vendor/")):
            continue
        parts = line.split("/")
        if len(parts) >= 4 and parts[-4] == ".agents" and parts[-3] == "skills":
            names[parts[-2]] = os.path.join(root, line)
    return names


def parse_frontmatter(lines):
    """Return (fields, end_line, error). Supports key: value, quoted values over several lines, and block scalars."""
    if not lines or lines[0].strip() != "---":
        return None, 0, "frontmatter must start with --- on line 1"
    fields = {}
    key = None
    block = None
    quote = None
    index = 1
    while index < len(lines):
        line = lines[index]
        if quote is not None:
            fields[key] += " " + line.strip()
            if line.rstrip().endswith(quote):
                fields[key] = fields[key][:-1]
                quote = None
            index += 1
            continue
        if line.strip() == "---":
            if key is not None and block is not None:
                fields[key] = " ".join(block).strip()
            return fields, index + 1, None
        if line.startswith((" ", "\t")):
            if key is not None and block is not None:
                block.append(line.strip())
            index += 1
            continue
        if key is not None and block is not None:
            fields[key] = " ".join(block).strip()
            block = None
        match = re.match(r"^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$", line)
        if match:
            key = match.group(1)
            value = match.group(2).strip()
            if value in (">", "|", ">-", "|-"):
                block = []
            elif len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                fields[key] = value[1:-1]
            elif value and value[0] in "\"'":
                quote = value[0]
                fields[key] = value[1:]
            else:
                fields[key] = value
        index += 1
    return None, index, "frontmatter is not closed with ---"


def path_targets(line):
    """Markdown link targets and bare paths in one line of text."""
    found = []
    for target in LINK_RE.findall(line):
        if target.startswith(("http://", "https://", "mailto:", "#")):
            continue
        target = target.split("#", 1)[0]
        if target:
            found.append(target)
    found.extend(PATH_RE.findall(LINK_RE.sub("", line)))
    return found


def check_paths(path, text, root, report):
    """Every file the text points to must exist, relative to the file or to the repo root.

    Covers markdown links [text](target) and bare paths such as ydb/core/blobstorage/README.md.
    Fenced code blocks and inline code are skipped: paths there are examples.
    Tokens with < > * { } are placeholders and are skipped too.
    """
    base = os.path.dirname(path)
    in_code = False
    for number, line in enumerate(text.splitlines(), start=1):
        if line.strip().startswith("```"):
            in_code = not in_code
            continue
        if in_code:
            continue
        line = re.sub(r"`[^`]*`", "", line)
        for target in path_targets(line):
            if any(mark in target for mark in "<>*{}"):
                continue
            if os.path.exists(os.path.join(base, target)) or os.path.exists(os.path.join(root, target)):
                continue
            report.error(path, number, "path does not exist: %s" % target)


def check_sentences(path, text, start_line, report):
    in_code = False
    for number, line in enumerate(text.splitlines(), start=1):
        if number < start_line:
            continue
        if line.strip().startswith("```"):
            in_code = not in_code
            continue
        if in_code or line.strip().startswith("|"):
            continue
        for sentence in re.split(r"(?<=[.!?])\s+", line):
            if len(sentence.split()) > SENTENCE_MAX_WORDS:
                report.warn(path, number, "sentence longer than %d words; split it" % SENTENCE_MAX_WORDS)


def is_stdlib_module(name):
    """True when the running interpreter finds `name` inside its standard library."""
    names = getat
```

### Core Architecture Module: `.agents/skills/ydb-agent-instructions/scripts/create_skill.py`
```
#!/usr/bin/env python3
"""Create the files for a new agent skill in one directory.

Usage:
    python3 create_skill.py DIR SKILL_NAME --description TEXT [--dry-run] [--root DIR]

DIR is the directory the skill is about. SKILL_NAME starts with ydb- and
uses lowercase letters, digits and dashes. The script creates:

    DIR/.agents/skills/SKILL_NAME/SKILL.md   skill text with TODO lines
    DIR/AGENTS.md                            rules of the directory, only when absent
    DIR/CLAUDE.md                            @./AGENTS.md plus one line per skill with its path and description

The files are written in DIR itself, never in a parent directory: Claude
Code loads DIR/CLAUDE.md when it works on files in DIR. When DIR/CLAUDE.md
already exists, the script adds the line of the new skill to it and changes
nothing else. It never overwrites a file and never
removes a line. When anything conflicts it writes nothing and exits with
code 1. A second run with the same arguments does nothing.
After writing it runs check.py on DIR; exit code 1 then means check.py
found errors in the files (the files stay in place, fix them).
Exit code 2 means a bad SKILL_NAME, a missing DIR, or no repository root.

Written for Python 3.9 with the standard library only.
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import check  # noqa: E402

SKILL_TEMPLATE = """---
name: {name}
description: "{description}"
---

# {title}

TODO: one or two sentences: what this skill is for and which directory it covers.

## Source map

TODO: table "Responsibility | Source" for the main files in {dir_text}. Point to existing docs or README files instead of copying text.

## Trace the changed contract

TODO: what to read on both sides of a change (producer and consumer), and which invariants to keep.

## Validation

TODO: the smallest test target to run first, then wider targets.
"""

AGENTS_TEMPLATE = """# {title}

These instructions apply to {dir_text}.

TODO: one or two rules that always apply here; steps of a task go to the skill.
"""

def claude_with_skill(text, skill_line):
    """Text of an existing CLAUDE.md with skill_line in the list, or None when it is already there."""
    lines = text.splitlines()
    stripped = [line.strip() for line in lines]
    if skill_line in stripped:
        return None
    if check.CLAUDE_SKILLS_HEADER in stripped:
        start = stripped.index(check.CLAUDE_SKILLS_HEADER) + 1
        end = start
        while end < len(lines) and stripped[end].startswith("- .agents/skills/"):
            end += 1
        lines[start:end] = sorted(lines[start:end] + [skill_line])
    else:
        if lines and lines[-1].strip():
            lines.append("")
        lines += [check.CLAUDE_SKILLS_HEADER, skill_line]
    return "\n".join(lines) + "\n"


def claude_content(owner_dir, name, description):
    """CLAUDE.md for owner_dir: the include, the header and one line per skill (the new one included)."""
    lines = check.skill_lines(owner_dir)
    lines[name] = "- .agents/skills/%s/SKILL.md: %s" % (name, description)
    return check.CLAUDE_INCLUDE + "\n\n" + check.CLAUDE_SKILLS_HEADER + "\n" + "\n".join(lines[key] for key in sorted(lines)) + "\n"


def title_from_name(name):
    return " ".join(part.capitalize() for part in name.split("-"))


def relative_link(from_dir, to_path):
    return os.path.relpath(to_path, from_dir).replace(os.sep, "/")


def yaml_double_quoted(text):
    """One-line YAML double-quoted scalar body: collapse whitespace, escape backslash and quote."""
    return " ".join(text.split()).replace("\\", "\\\\").replace('"', '\\"')


def plan_actions(args, root):
    """Return (actions, conflicts, notes). Each action is (path, content)."""
    actions = []
    conflicts = []
    notes = []
    target_dir = os.path.realpath(args.dir)
    skill_dir = os.path.join(target_dir, ".agents", "skills", args.skill_name)
    skill_md = os.path.join(skill_dir, "SKILL.md")
    agents_md = os.path.join(target_dir, "AGENTS.md")
    claude_md = os.path.join(target_dir, "CLAUDE.md")
    rel_dir = relative_link(root, target_dir)
    dir_text = "the repo root" if rel_dir == "." else "`%s/`" % rel_dir
    fields = {
        "name": args.skill_name,
        "title": title_from_name(args.skill_name),
        "description": yaml_double_quoted(args.description),
        "dir_text": dir_text,
    }

    if os.path.exists(skill_md):
        notes.append("exists, not touched: %s" % skill_md)
    else:
        actions.append(("create", skill_md, SKILL_TEMPLATE.format(**fields)))

    if os.path.isfile(agents_md):
        notes.append("exists, not touched: %s" % agents_md)
    elif os.path.exists(agents_md):
        conflicts.append("%s exists but is not a file" % agents_md)
    else:
        actions.append(("create", agents_md, AGENTS_TEMPLATE.format(**fields)))

    skill_line = "- .agents/skills/%s/SKILL.md: %s" % (args.skill_name, " ".join(args.description.split()))
    if os.path.isfile(claude_md):
        text = check.read_text(claude_md)
        if check.CLAUDE_INCLUDE not in [line.strip() for line in text.splitlines()]:
            conflicts.append("%s exists without the line %s; add it or move its rules to AGENTS.md" % (claude_md, check.CLAUDE_INCLUDE))
        else:
            updated = claude_with_skill(text, skill_line)
            if updated is None:
                notes.append("exists and lists the skill: %s" % claude_md)
            else:
                actions.append(("update", claude_md, updated))
    elif os.path.exists(claude_md):
        conflicts.append("%s exists but is not a file" % claude_md)
    else:
        actions.append(("create", claude_md, claude_content(target_dir, args.skill_name, " ".join(args.description.split()))))

    names = check.repo_skill_names(root)
    taken = None if names is None else names.get(args.skill_name)
    if taken and os.path.realpath(taken) != os.path.realpath(skill_md):
        conflicts.append("skill name %r is already used by %s" % (args.skill_name, os.path.relpath(taken, root)))
    return actions, conflicts, notes


def apply_actions(actions):
    for kind, path, content in actions:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        if kind == "create":
            with open(path, "x", encoding="utf-8") as handle:
                handle.write(content)
            print("created %s" % path)
        else:
            with open(path, "w", encoding="utf-8") as handle:
                handle.write(content)
            print("updated %s" % path)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("dir", metavar="DIR", help="directory the skill is about")
    parser.add_argument("skill_name", metavar="SKILL_NAME", help="ydb- plus lowercase words joined by dashes")
    parser.add_argument("--description", required=True, help="one sentence: component, task types, what it is not for")
    parser.add_argument("--dry-run", action="store_true", help="print the plan and exit")
    parser.add_argument("--root", help="repository root (default: found with git)")
    args = parser.parse_args(argv)

    if not check.SKILL_NAME_RE.match(args.skill_name) or len(args.skill_name) > check.SKILL_NAME_MAX_CHARS:
        print("SKILL_NAME must be ydb- followed by words of lowercase letters and digits joined by single dashes, at most %d characters" % check.SKILL_NAME_MAX_CHARS, file=sys.stderr)
        return 2
    if not os.path.isdir(args.dir):
        print("DIR does not exist: %s" % args.dir, file=sys.stderr)
        return 2
    root = os.path.realpath(args.root) if args.root else check.find_repo_root(args.dir)
    if root is None:
        print("cannot find the repository root; pass --root DIR", file=sys.stderr)
        return 2
    target = os.path.realpath(args.dir)
    if not (target == root or target.startswith(root + os.sep)):
        print("DIR must be inside th
```

### Core Architecture Module: `.agents/skills/ydb-agent-instructions/scripts/find.py`
```
#!/usr/bin/env python3
"""List existing instruction files for AI agents, the files that mention a topic, and the skills.

Usage:
    python3 find.py [TOPIC] [--skills] [--root DIR]

Without options: prints every AGENTS.md, SKILL.md, RULES.md and rules/*.md
outside contrib/ and vendor/ (tracked or not yet added, but not ignored).
With TOPIC: also prints the README.md files, the .md files under
ydb/docs/en/core/contributor/ and the instruction files that contain TOPIC
(case does not matter).
With --skills: prints the skills, one per line as "name<TAB>directory", and
then the component directories ydb/<layer>/<component>, so a reader can
compare a new skill name with the existing names.

Written for Python 3.9 with the standard library only.
"""
import argparse
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import check  # noqa: E402

INSTRUCTION_RE = re.compile(r"(^|/)(AGENTS\.md|SKILL\.md|RULES\.md|rules/[^/]+\.md)$")
SKILL_RE = re.compile(r"(^|/)\.agents/skills/([^/]+)/SKILL\.md$")
SKIP_PREFIXES = ("contrib/", "vendor/")
DOCS_DIR = "ydb/docs/en/core/contributor/"


def tracked_files(root):
    """Tracked and new (not ignored) files; None when git is not installed."""
    out = check.run_git(["ls-files", "--cached", "--others", "--exclude-standard"], root)
    if out is None or out.returncode != 0:
        return None
    return [line for line in out.stdout.splitlines() if line and not line.startswith(SKIP_PREFIXES)]


def is_instruction(path):
    return bool(INSTRUCTION_RE.search(path))


def instruction_files(files):
    return [path for path in files if is_instruction(path)]


def skills(files):
    """(name, directory the skill is about) for every SKILL.md."""
    found = []
    for path in files:
        match = SKILL_RE.search(path)
        if match:
            owner = path[: match.start()] or "."
            found.append((match.group(2), owner.rstrip("/") or "."))
    return found


def components(files):
    """Directories ydb/<layer>/<component> that hold tracked files."""
    found = set()
    for path in files:
        parts = path.split("/")
        if len(parts) >= 4 and parts[0] == "ydb" and not parts[1].startswith(".") and not parts[2].startswith("."):
            found.add("/".join(parts[:3]))
    return sorted(found)


def files_mentioning(files, topic, root):
    needle = topic.lower()
    found = []
    for path in files:
        if not path.endswith(".md"):
            continue
        if not (path.endswith("/README.md") or path.startswith(DOCS_DIR) or is_instruction(path)):
            continue
        try:
            text = check.read_text(os.path.join(root, path))
        except (OSError, UnicodeDecodeError):
            continue
        if needle in text.lower():
            found.append(path)
    return found


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("topic", nargs="?", metavar="TOPIC", help="word or phrase to look for, for example a directory or component name")
    parser.add_argument("--skills", action="store_true", help="print skill names with their directories, then the component directories")
    parser.add_argument("--root", help="repository root (default: found with git)")
    args = parser.parse_args(argv)

    root = os.path.realpath(args.root) if args.root else check.find_repo_root(os.getcwd())
    if root is None:
        print("cannot find the repository root; pass --root DIR", file=sys.stderr)
        return 2
    files = tracked_files(root)
    if files is None:
        print("git is not installed or %s is not a git repository" % root, file=sys.stderr)
        return 2

    if args.skills:
        print("skills:")
        for name, owner in skills(files):
            print("  %s\t%s" % (name, owner))
        print("components:")
        for path in components(files):
            print("  " + path)
        return 0
    print("instruction files:")
    for path in instruction_files(files):
        print("  " + path)
    if args.topic:
        print("files that mention %r:" % args.topic)
        for path in files_mentioning(files, args.topic, root):
            print("  " + path)
    return 0


if __name__ == "__main__":
    sys.exit(main())

```

### Core Architecture Module: `contrib/deprecated/http-parser/.yandex_meta/__init__.py`
```
from devtools.yamaker.project import NixProject

http_parser = NixProject(
    arcdir="contrib/deprecated/http-parser",
    nixattr="http-parser",
    # By default maximium header size allowed is 80Kb. To remove the effective limit
    # on the size of the header, we define the macro to a very large number (0x7fffffff).
    cflags=["-DHTTP_MAX_HEADER_SIZE=0x7fffffff"],
)

```

### Core Architecture Module: `contrib/deprecated/http-parser/http_parser.c`
```
/* Copyright Joyent, Inc. and other Node contributors.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */
#include "http_parser.h"
#include <assert.h>
#include <stddef.h>
#include <ctype.h>
#include <string.h>
#include <limits.h>

static uint32_t max_header_size = HTTP_MAX_HEADER_SIZE;

#ifndef ULLONG_MAX
# define ULLONG_MAX ((uint64_t) -1) /* 2^64-1 */
#endif

#ifndef MIN
# define MIN(a,b) ((a) < (b) ? (a) : (b))
#endif

#ifndef ARRAY_SIZE
# define ARRAY_SIZE(a) (sizeof(a) / sizeof((a)[0]))
#endif

#ifndef BIT_AT
# define BIT_AT(a, i)                                                \
  (!!((unsigned int) (a)[(unsigned int) (i) >> 3] &                  \
   (1 << ((unsigned int) (i) & 7))))
#endif

#ifndef ELEM_AT
# define ELEM_AT(a, i, v) ((unsigned int) (i) < ARRAY_SIZE(a) ? (a)[(i)] : (v))
#endif

#define SET_ERRNO(e)                                                 \
do {                                                                 \
  parser->nread = nread;                                             \
  parser->http_errno = (e);                                          \
} while(0)

#define CURRENT_STATE() p_state
#define UPDATE_STATE(V) p_state = (enum state) (V);
#define RETURN(V)                                                    \
do {                                                                 \
  parser->nread = nread;                                             \
  parser->state = CURRENT_STATE();                                   \
  return (V);                                                        \
} while (0);
#define REEXECUTE()                                                  \
  goto reexecute;                                                    \


#ifdef __GNUC__
# define LIKELY(X) __builtin_expect(!!(X), 1)
# define UNLIKELY(X) __builtin_expect(!!(X), 0)
#else
# define LIKELY(X) (X)
# define UNLIKELY(X) (X)
#endif


/* Run the notify callback FOR, returning ER if it fails */
#define CALLBACK_NOTIFY_(FOR, ER)                                    \
do {                                                                 \
  assert(HTTP_PARSER_ERRNO(parser) == HPE_OK);                       \
                                                                     \
  if (LIKELY(settings->on_##FOR)) {                                  \
    parser->state = CURRENT_STATE();                                 \
    if (UNLIKELY(0 != settings->on_##FOR(parser))) {                 \
      SET_ERRNO(HPE_CB_##FOR);                                       \
    }                                                                \
    UPDATE_STATE(parser->state);                                     \
                                                                     \
    /* We either errored above or got paused; get out */             \
    if (UNLIKELY(HTTP_PARSER_ERRNO(parser) != HPE_OK)) {             \
      return (ER);                                                   \
    }                                                                \
  }                                                                  \
} while (0)

/* Run the notify callback FOR and consume the current byte */
#define CALLBACK_NOTIFY(FOR)            CALLBACK_NOTIFY_(FOR, p - data + 1)

/* Run the notify callback FOR and don't consume the current byte */
#define CALLBACK_NOTIFY_NOADVANCE(FOR)  CALLBACK_NOTIFY_(FOR, p - data)

/* Run data callback FOR with LEN bytes, returning ER if it fails */
#define CALLBACK_DATA_(FOR, LEN, ER)                                 \
do {                                                                 \
  assert(HTTP_PARSER_ERRNO(parser) == HPE_OK);                       \
                                                                     \
  if (FOR##_mark) {                                                  \
    if (LIKELY(settings->on_##FOR)) {                                \
      parser->state = CURRENT_STATE();                               \
      if (UNLIKELY(0 !=                                              \
                   settings->on_##FOR(parser, FOR##_mark, (LEN)))) { \
        SET_ERRNO(HPE_CB_##FOR);                                     \
      }                                                              \
      UPDATE_STATE(parser->state);                                   \
                                                                     \
      /* We either errored above or got paused; get out */           \
      if (UNLIKELY(HTTP_PARSER_ERRNO(parser) != HPE_OK)) {           \
        return (ER);                                                 \
      }                                                              \
    }                                                                \
    FOR##_mark = NULL;                                               \
  }                                                                  \
} while (0)

/* Run the data callback FOR and consume the current byte */
#define CALLBACK_DATA(FOR)                                           \
    CALLBACK_DATA_(FOR, p - FOR##_mark, p - data + 1)

/* Run the data callback FOR and don't consume the current byte */
#define CALLBACK_DATA_NOADVANCE(FOR)                                 \
    CALLBACK_DATA_(FOR, p - FOR##_mark, p - data)

/* Set the mark FOR; non-destructive if mark is already set */
#define MARK(FOR)                                                    \
do {                                                                 \
  if (!FOR##_mark) {                                                 \
    FOR##_mark = p;                                                  \
  }                                                                  \
} while (0)

/* Don't allow the total size of the HTTP headers (including the status
 * line) to exceed max_header_size.  This check is here to protect
 * embedders against denial-of-service attacks where the attacker feeds
 * us a never-ending header that the embedder keeps buffering.
 *
 * This check is arguably the responsibility of embedders but we're doing
 * it on the embedder's behalf because most won't bother and this way we
 * make the web a little safer.  max_header_size is still far bigger
 * than any reasonable request or response so this should never affect
 * day-to-day operation.
 */
#define COUNT_HEADER_SIZE(V)                                         \
do {                                                                 \
  nread += (uint32_t)(V);                                            \
  if (UNLIKELY(nread > max_header_size)) {                           \
    SET_ERRNO(HPE_HEADER_OVERFLOW);                                  \
    goto error;                                                      \
  }                                                                  \
} while (0)


#define PROXY_CONNECTION "proxy-connection"
#define CONNECTION "connection"
#define CONTENT_LENGTH "content-length"
#define TRANSFER_ENCODING "transfer-encoding"
#define UPGRADE "upgrade"
#def
```

### Core Architecture Module: `contrib/deprecated/http-parser/http_parser.h`
```
/* Copyright Joyent, Inc. and other Node contributors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */
#ifndef http_parser_h
#define http_parser_h
#ifdef __cplusplus
extern "C" {
#endif

/* Also update SONAME in the Makefile whenever you change these. */
#define HTTP_PARSER_VERSION_MAJOR 2
#define HTTP_PARSER_VERSION_MINOR 9
#define HTTP_PARSER_VERSION_PATCH 4

#include <stddef.h>
#if defined(_WIN32) && !defined(__MINGW32__) && \
  (!defined(_MSC_VER) || _MSC_VER<1600) && !defined(__WINE__)
#include <BaseTsd.h>
typedef __int8 int8_t;
typedef unsigned __int8 uint8_t;
typedef __int16 int16_t;
typedef unsigned __int16 uint16_t;
typedef __int32 int32_t;
typedef unsigned __int32 uint32_t;
typedef __int64 int64_t;
typedef unsigned __int64 uint64_t;
#else
#include <stdint.h>
#endif

/* Compile with -DHTTP_PARSER_STRICT=0 to make less checks, but run
 * faster
 */
#ifndef HTTP_PARSER_STRICT
# define HTTP_PARSER_STRICT 1
#endif

/* Maximium header size allowed. If the macro is not defined
 * before including this header then the default is used. To
 * change the maximum header size, define the macro in the build
 * environment (e.g. -DHTTP_MAX_HEADER_SIZE=<value>). To remove
 * the effective limit on the size of the header, define the macro
 * to a very large number (e.g. -DHTTP_MAX_HEADER_SIZE=0x7fffffff)
 */
#ifndef HTTP_MAX_HEADER_SIZE
# define HTTP_MAX_HEADER_SIZE (80*1024)
#endif

typedef struct http_parser http_parser;
typedef struct http_parser_settings http_parser_settings;


/* Callbacks should return non-zero to indicate an error. The parser will
 * then halt execution.
 *
 * The one exception is on_headers_complete. In a HTTP_RESPONSE parser
 * returning '1' from on_headers_complete will tell the parser that it
 * should not expect a body. This is used when receiving a response to a
 * HEAD request which may contain 'Content-Length' or 'Transfer-Encoding:
 * chunked' headers that indicate the presence of a body.
 *
 * Returning `2` from on_headers_complete will tell parser that it should not
 * expect neither a body nor any futher responses on this connection. This is
 * useful for handling responses to a CONNECT request which may not contain
 * `Upgrade` or `Connection: upgrade` headers.
 *
 * http_data_cb does not return data chunks. It will be called arbitrarily
 * many times for each string. E.G. you might get 10 callbacks for "on_url"
 * each providing just a few characters more data.
 */
typedef int (*http_data_cb) (http_parser*, const char *at, size_t length);
typedef int (*http_cb) (http_parser*);


/* Status Codes */
#define HTTP_STATUS_MAP(XX)                                                 \
  XX(100, CONTINUE,                        Continue)                        \
  XX(101, SWITCHING_PROTOCOLS,             Switching Protocols)             \
  XX(102, PROCESSING,                      Processing)                      \
  XX(200, OK,                              OK)                              \
  XX(201, CREATED,                         Created)                         \
  XX(202, ACCEPTED,                        Accepted)                        \
  XX(203, NON_AUTHORITATIVE_INFORMATION,   Non-Authoritative Information)   \
  XX(204, NO_CONTENT,                      No Content)                      \
  XX(205, RESET_CONTENT,                   Reset Content)                   \
  XX(206, PARTIAL_CONTENT,                 Partial Content)                 \
  XX(207, MULTI_STATUS,                    Multi-Status)                    \
  XX(208, ALREADY_REPORTED,                Already Reported)                \
  XX(226, IM_USED,                         IM Used)                         \
  XX(300, MULTIPLE_CHOICES,                Multiple Choices)                \
  XX(301, MOVED_PERMANENTLY,               Moved Permanently)               \
  XX(302, FOUND,                           Found)                           \
  XX(303, SEE_OTHER,                       See Other)                       \
  XX(304, NOT_MODIFIED,                    Not Modified)                    \
  XX(305, USE_PROXY,                       Use Proxy)                       \
  XX(307, TEMPORARY_REDIRECT,              Temporary Redirect)              \
  XX(308, PERMANENT_REDIRECT,              Permanent Redirect)              \
  XX(400, BAD_REQUEST,                     Bad Request)                     \
  XX(401, UNAUTHORIZED,                    Unauthorized)                    \
  XX(402, PAYMENT_REQUIRED,                Payment Required)                \
  XX(403, FORBIDDEN,                       Forbidden)                       \
  XX(404, NOT_FOUND,                       Not Found)                       \
  XX(405, METHOD_NOT_ALLOWED,              Method Not Allowed)              \
  XX(406, NOT_ACCEPTABLE,                  Not Acceptable)                  \
  XX(407, PROXY_AUTHENTICATION_REQUIRED,   Proxy Authentication Required)   \
  XX(408, REQUEST_TIMEOUT,                 Request Timeout)                 \
  XX(409, CONFLICT,                        Conflict)                        \
  XX(410, GONE,                            Gone)                            \
  XX(411, LENGTH_REQUIRED,                 Length Required)                 \
  XX(412, PRECONDITION_FAILED,             Precondition Failed)             \
  XX(413, PAYLOAD_TOO_LARGE,               Payload Too Large)               \
  XX(414, URI_TOO_LONG,                    URI Too Long)                    \
  XX(415, UNSUPPORTED_MEDIA_TYPE,          Unsupported Media Type)          \
  XX(416, RANGE_NOT_SATISFIABLE,           Range Not Satisfiable)           \
  XX(417, EXPECTATION_FAILED,              Expectation Failed)              \
  XX(421, MISDIRECTED_REQUEST,             Misdirected Request)             \
  XX(422, UNPROCESSABLE_ENTITY,            Unprocessable Entity)            \
  XX(423, LOCKED,                          Locked)                          \
  XX(424, FAILED_DEPENDENCY,               Failed Dependency)               \
  XX(426, UPGRADE_REQUIRED,                Upgrade Required)                \
  XX(428, PRECONDITION_REQUIRED,           Precondition Required)           \
  XX(429, TOO_MANY_REQUESTS,               Too Many Requests)               \
  XX(431, REQUEST_HEADER_FIELDS_TOO_LARGE, Request Header Fields Too Large) \
  XX(451, UNAVAILABLE_FOR_LEGAL_REASONS,   Unavailable For Legal Reasons)   \
  XX(500, INTERNAL_SERVER_ERROR,           Internal Server Error)           \
  XX(501, NOT_IMPLEMENTED,                 Not Implemented)                 \
  XX(502, BAD_GATEWAY,                     Bad Gateway)                     \
  XX(503, SERVICE_UNAVAILABLE,             Service Unavailable)             \
  XX(504, GATEWAY_TIMEOUT,                 Gateway Timeout)                 \
  XX(505, HTTP_VERSION_NOT_SUPPORTED,      HTTP Version Not Supported)      \
  XX(506, VARIANT_ALSO_NEGOTIATES,         Variant Also Negotiates)         \
  XX(5
```

### Core Architecture Module: `contrib/deprecated/python/backports.functools-lru-cache/backports/functools_lru_cache.py`
```
from __future__ import absolute_import

import functools
from collections import namedtuple
from threading import RLock

_CacheInfo = namedtuple("_CacheInfo", ["hits", "misses", "maxsize", "currsize"])


@functools.wraps(functools.update_wrapper)
def update_wrapper(
    wrapper,
    wrapped,
    assigned=functools.WRAPPER_ASSIGNMENTS,
    updated=functools.WRAPPER_UPDATES,
):
    """
    Patch two bugs in functools.update_wrapper.
    """
    # workaround for http://bugs.python.org/issue3445
    assigned = tuple(attr for attr in assigned if hasattr(wrapped, attr))
    wrapper = functools.update_wrapper(wrapper, wrapped, assigned, updated)
    # workaround for https://bugs.python.org/issue17482
    wrapper.__wrapped__ = wrapped
    return wrapper


class _HashedSeq(list):
    __slots__ = 'hashvalue'

    def __init__(self, tup, hash=hash):
        self[:] = tup
        self.hashvalue = hash(tup)

    def __hash__(self):
        return self.hashvalue


def _make_key(
    args,
    kwds,
    typed,
    kwd_mark=(object(),),
    fasttypes=set([int, str, frozenset, type(None)]),
    sorted=sorted,
    tuple=tuple,
    type=type,
    len=len,
):
    'Make a cache key from optionally typed positional and keyword arguments'
    key = args
    if kwds:
        sorted_items = sorted(kwds.items())
        key += kwd_mark
        for item in sorted_items:
            key += item
    if typed:
        key += tuple(type(v) for v in args)
        if kwds:
            key += tuple(type(v) for k, v in sorted_items)
    elif len(key) == 1 and type(key[0]) in fasttypes:
        return key[0]
    return _HashedSeq(key)


def lru_cache(maxsize=100, typed=False):  # noqa: C901
    """Least-recently-used cache decorator.

    If *maxsize* is set to None, the LRU features are disabled and the cache
    can grow without bound.

    If *typed* is True, arguments of different types will be cached separately.
    For example, f(3.0) and f(3) will be treated as distinct calls with
    distinct results.

    Arguments to the cached function must be hashable.

    View the cache statistics named tuple (hits, misses, maxsize, currsize) with
    f.cache_info().  Clear the cache and statistics with f.cache_clear().
    Access the underlying function with f.__wrapped__.

    See:  http://en.wikipedia.org/wiki/Cache_algorithms#Least_Recently_Used

    """

    # Users should only access the lru_cache through its public API:
    #       cache_info, cache_clear, and f.__wrapped__
    # The internals of the lru_cache are encapsulated for thread safety and
    # to allow the implementation to change (including a possible C version).

    def decorating_function(user_function):
        cache = dict()
        stats = [0, 0]  # make statistics updateable non-locally
        HITS, MISSES = 0, 1  # names for the stats fields
        make_key = _make_key
        cache_get = cache.get  # bound method to lookup key or return None
        _len = len  # localize the global len() function
        lock = RLock()  # because linkedlist updates aren't threadsafe
        root = []  # root of the circular doubly linked list
        root[:] = [root, root, None, None]  # initialize by pointing to self
        nonlocal_root = [root]  # make updateable non-locally
        PREV, NEXT, KEY, RESULT = 0, 1, 2, 3  # names for the link fields

        if maxsize == 0:

            def wrapper(*args, **kwds):
                # no caching, just do a statistics update after a successful call
                result = user_function(*args, **kwds)
                stats[MISSES] += 1
                return result

        elif maxsize is None:

            def wrapper(*args, **kwds):
                # simple caching without ordering or size limit
                key = make_key(args, kwds, typed)
                result = cache_get(
                    key, root
                )  # root used here as a unique not-found sentinel
                if result is not root:
                    stats[HITS] += 1
                    return result
                result = user_function(*args, **kwds)
                cache[key] = result
                stats[MISSES] += 1
                return result

        else:

            def wrapper(*args, **kwds):
                # size limited caching that tracks accesses by recency
                key = make_key(args, kwds, typed) if kwds or typed else args
                with lock:
                    link = cache_get(key)
                    if link is not None:
                        # record recent use of the key by moving it
                        # to the front of the list
                        (root,) = nonlocal_root
                        link_prev, link_next, key, result = link
                        link_prev[NEXT] = link_next
                        link_next[PREV] = link_prev
                        last = root[PREV]
                        last[NEXT] = root[PREV] = link
                        link[PREV] = last
                        link[NEXT] = root
                        stats[HITS] += 1
                        return result
                result = user_function(*args, **kwds)
                with lock:
                    (root,) = nonlocal_root
                    if key in cache:
                        # getting here means that this same key was added to the
                        # cache while the lock was released.  since the link
                        # update is already done, we need only return the
                        # computed result and update the count of misses.
                        pass
                    elif _len(cache) >= maxsize:
                        # use the old root to store the new key and result
                        oldroot = root
                        oldroot[KEY] = key
                        oldroot[RESULT] = result
                        # empty the oldest link and make it the new root
                        root = nonlocal_root[0] = oldroot[NEXT]
                        oldkey = root[KEY]
                        root[KEY] = root[RESULT] = None
                        # now update the cache dictionary for the new links
                        del cache[oldkey]
                        cache[key] = oldroot
                    else:
                        # put result in a new link at the front of the list
                        last = root[PREV]
                        link = [last, root, key, result]
                        last[NEXT] = root[PREV] = cache[key] = link
                    stats[MISSES] += 1
                return result

        def cache_info():
            """Report cache statistics"""
            with lock:
                return _CacheInfo(stats[HITS], stats[MISSES], maxsize, len(cache))

        def cache_clear():
            """Clear the cache and cache statistics"""
            with lock:
                cache.clear()
                root = nonlocal_root[0]
                root[:] = [root, root, None, None]
                stats[:] = [0, 0]

        wrapper.__wrapped__ = user_function
        wrapper.cache_info = cache_info
        wrapper.cache_clear = cache_clear
        return update_wrapper(wrapper, user_function)

    return decorating_function

```

### Core Architecture Module: `contrib/deprecated/python/backports.shutil-get-terminal-size/backports/shutil_get_terminal_size/__init__.py`
```
"""A backport of the get_terminal_size function from Python 3.3's shutil."""

__title__ = "backports.shutil_get_terminal_size"
__version__ = "1.0.0"
__license__ = "MIT"
__author__ = "Christopher Rosell"
__copyright__ = "Copyright 2014 Christopher Rosell"

__all__ = ["get_terminal_size"]

from .get_terminal_size import get_terminal_size

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #54282** (2026-09-28): **TSan: tests hang in teardown in TActorCoroImpl::Destroy of a coroutine actor that was never bootstrapped**
  *Symptoms*: ## Summary  In TSan builds a random test of a KQP unit test suite sometimes never finishes and is killed at the 600 s ya test timeout. The test body has already passed: the process hangs in the test server teardown, in `TActorCoroImpl::Destroy`, waiting for the worker thread of a coroutine actor that was never bootstrapped, so the thread does not exist. Only TSan builds are affected, because only there coroutine actors run on threads (`CORO_THROUGH_THREADS`). In the KQP tests the actor is the datashard table stats builder (`TTableStatsCoroBuilder`) registered right before the actor system stops, but any `TActorCoro` registered at that moment hangs the same way.  ## Environment  - `./ya make --build relwithdebinfo --sanitize=thread -tA ydb/core/kqp/ut/join/index_lookup`, 108 tests in 60 chunks. - Hangs seen on main `9445e841a8e` and `de286f42f02`; the fix was tested on `7d08c4d0693`. The code involved is the same in all three. - Default single-node `TKikimrRunner`.  ## Symptom  - About 1 run of the suite in 4 has one test (once two) that never finishes; about 1 test in 400. The test differs from run to run: 13 hangs in 47 TSan runs, 12 different tests. Those marked * come from 15 earlier runs of branch builds with unmerged DQ channel PRs; they were not caught with gdb but look the same (a 600 s kill after a passing body):   - `KqpJoin`: `RightSemiJoin_ComplexKey` (twice, once *), `RightSemiJoin_SimpleKey`*, `RightSemiJoin_KeyPrefix`, `JoinDupColumnRight`*, `JoinDupColumnRightP

- **Issue #53391** (2026-09-19): **Fix increament of CpuUsage for Query**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > <!-- run-tests-table --> <h3>Run Extra Tests</h3>  Run additional tests for this PR. You can customize: - **Test Size**: small, medium, large (default: small, medium) - **Test Targets**: any directory path (default: `ydb/`) - **Sanitizers**: ASAN, MSAN, TSAN - **Coredumps**: enable for debugging (default: off) - **Additional args**: custom ya make arguments  [![▶  Run tests](https://img.shields.io/badge/▶%20%20Run%20tests-4caf50)](https://gh-ci-app.ydb.tech/workflow/trigger?owner=ydb-platform&repo=ydb&workflow_id=run_tests.yml&ref=main&pull_number=53391&test_targets=ydb%2F&test_size=small%2Cmedium&additional_ya_make_args=&build_preset=relwithdebinfo&collect_coredumps=false&return_url=https%3A%2F%2Fgithub.com%2Fydb-platform%2Fydb%2Fpull%2F53391&ui=true)
  > <!-- status pr=53391, preset=relwithdebinfo, run=180020 --> :white_circle: `2026-09-17 11:20:15 UTC` Pre-commit [check](https://github.com/ydb-platform/ydb/actions/runs/35215054806/job/105181508796) **linux-x86_64-relwithdebinfo** for bbce772481663e9230e828f5305fb38f9e67eed6 has started. :white_circle: `2026-09-17 11:20:19 UTC` Artifacts will be uploaded [here](https://storage.yandexcloud.net/ydb-gh-logs/ydb-platform/ydb/PR-check/35215054806/ya-x86-64/index.html) :white_circle: `2026-09-17 11:21:57 UTC` ya make is running... :yellow_circle: `2026-09-17 14:27:19 UTC` Some tests failed, follow the links below. Going to retry failed tests...  <details>   [Ya make output](https://storage.yandexcloud.net/ydb-gh-logs/ydb-platform/ydb/PR-check/35215054806/ya-x86-64/ya_make_output.txt) | [Test bloat](https://storage.yandexcloud.net/ydb-gh-logs/ydb-platform/ydb/PR-check/35215054806/ya-x86-64/try_1/test_bloat/tree_map.html) | TESTS | PASSED | ERRORS | FAILED | SKIPPED | MUTED<sup>[?](https://git
  > <!-- status pr=53391, preset=release-asan, run=180020 --> :white_circle: `2026-09-17 11:21:30 UTC` Pre-commit [check](https://github.com/ydb-platform/ydb/actions/runs/35215054806/job/105181508812) **linux-x86_64-release-asan** for bbce772481663e9230e828f5305fb38f9e67eed6 has started. :white_circle: `2026-09-17 11:21:34 UTC` Artifacts will be uploaded [here](https://storage.yandexcloud.net/ydb-gh-logs/ydb-platform/ydb/PR-check/35215054806/ya-x86-64-asan/index.html) :white_circle: `2026-09-17 11:22:58 UTC` ya make is running... :green_circle: `2026-09-17 13:30:42 UTC` Tests successful.  [Ya make output](https://storage.yandexcloud.net/ydb-gh-logs/ydb-platform/ydb/PR-check/35215054806/ya-x86-64-asan/ya_make_output.txt) | [Test bloat](https://storage.yandexcloud.net/ydb-gh-logs/ydb-platform/ydb/PR-check/35215054806/ya-x86-64-asan/try_1/test_bloat/tree_map.html) | TESTS | PASSED | ERRORS | FAILED | SKIPPED | MUTED<sup>[?](https://github.com/ydb-platform/ydb/tree/main/.github/config/muted_ya

- **Issue #52822** (2026-09-11): **Fix UAF**
  *Symptoms*: ### Changelog entry <!-- a user-readable short description of the changes that goes to CHANGELOG.md and Release Notes -->  Fix issue https://github.com/ydb-platform/ydb/pull/52264#issuecomment-5618845523 
  **Post-Mortem & Fix Analysis**:
  > <!-- run-tests-table --> <h3>Run Extra Tests</h3>  Run additional tests for this PR. You can customize: - **Test Size**: small, medium, large (default: small, medium) - **Test Targets**: any directory path (default: `ydb/`) - **Sanitizers**: ASAN, MSAN, TSAN - **Coredumps**: enable for debugging (default: off) - **Additional args**: custom ya make arguments  [![▶  Run tests](https://img.shields.io/badge/▶%20%20Run%20tests-4caf50)](https://gh-ci-app.ydb.tech/workflow/trigger?owner=ydb-platform&repo=ydb&workflow_id=run_tests.yml&ref=main&pull_number=52822&test_targets=ydb%2F&test_size=small%2Cmedium&additional_ya_make_args=&build_preset=relwithdebinfo&collect_coredumps=false&return_url=https%3A%2F%2Fgithub.com%2Fydb-platform%2Fydb%2Fpull%2F52822&ui=true)
  > <!-- status pr=52822, preset=release-asan, run=177284 --> :white_circle: `2026-09-11 05:42:17 UTC` Pre-commit [check](https://github.com/ydb-platform/ydb/actions/runs/34566734757/job/103160327575) **linux-x86_64-release-asan** for 3a448bd3ba5f0512278fe859111391b8deb4fa97 has started. :white_circle: `2026-09-11 05:42:36 UTC` Artifacts will be uploaded [here](https://storage.yandexcloud.net/ydb-gh-logs/ydb-platform/ydb/PR-check/34566734757/ya-x86-64-asan/index.html) :white_circle: `2026-09-11 05:44:01 UTC` ya make is running... :yellow_circle: `2026-09-11 07:56:27 UTC` Some tests failed, follow the links below. Going to retry failed tests...  <details>   [Ya make output](https://storage.yandexcloud.net/ydb-gh-logs/ydb-platform/ydb/PR-check/34566734757/ya-x86-64-asan/ya_make_output.txt) | [Test bloat](https://storage.yandexcloud.net/ydb-gh-logs/ydb-platform/ydb/PR-check/34566734757/ya-x86-64-asan/try_1/test_bloat/tree_map.html) | TESTS | PASSED | ERRORS | FAILED | SKIPPED | MUTED<sup>[?](
  > <!-- status pr=52822, preset=relwithdebinfo, run=177284 --> :white_circle: `2026-09-11 05:42:33 UTC` Pre-commit [check](https://github.com/ydb-platform/ydb/actions/runs/34566734757/job/103160327577) **linux-x86_64-relwithdebinfo** for 3a448bd3ba5f0512278fe859111391b8deb4fa97 has started. :white_circle: `2026-09-11 05:42:52 UTC` Artifacts will be uploaded [here](https://storage.yandexcloud.net/ydb-gh-logs/ydb-platform/ydb/PR-check/34566734757/ya-x86-64/index.html) :white_circle: `2026-09-11 05:44:21 UTC` ya make is running... :green_circle: `2026-09-11 08:29:48 UTC` Tests successful.  [Ya make output](https://storage.yandexcloud.net/ydb-gh-logs/ydb-platform/ydb/PR-check/34566734757/ya-x86-64/ya_make_output.txt) | [Test bloat](https://storage.yandexcloud.net/ydb-gh-logs/ydb-platform/ydb/PR-check/34566734757/ya-x86-64/try_1/test_bloat/tree_map.html) | TESTS | PASSED | ERRORS | FAILED | SKIPPED | MUTED<sup>[?](https://github.com/ydb-platform/ydb/tree/main/.github/config/muted_ya.txt "All m

- **Issue #48539** (2026-08-10): **VERIFY failed verification=!Extracted**
  *Symptoms*: Got the following verify on scan request to column table: ``` VERIFY failed (2026-07-31T19:58:49.103027+0300): verification=!Extracted;fline=execution.h:361;   ydb/library/actors/core/log.cpp:908   ~TVerifyFormattedRecordWriter(): requirement false failed build: commit e4abf511810b4001eff6cbcad57af966fbc0b8dd (clean) 0. /-S/util/system/yassert.cpp:86: NPrivate::InternalPanicImpl(int, char const*, char const*, int, int, int, TBasicStringBuf<char, std::__y1::char_traits<char>>, char const*, unsigned long) @ 0xA6A332A 1. /-S/util/system/yassert.cpp:55: NPrivate::Panic(NPrivate::TStaticBuf const&, int, char const*, char const*, char const*, ...) @ 0xA69D53B 2. /-S/ydb/library/actors/core/log.cpp:908: NActors::TVerifyFormattedRecordWriter::~TVerifyFormattedRecordWriter() @ 0xB2B26FF 3. /-S/ydb/core/formats/arrow/program/execution.h:361: NKikimr::NArrow::NSSA::TProcessorContext::GetResources() const @ 0x156BF96F 4. /-S/ydb/core/tx/columnshard/engines/reader/common_reader/iterator/fetching.cpp:100: NKikimr::NOlap::NReader::NCommon::TProgramStep::ReportTracing(std::__y1::shared_ptr<NKikimr::NOlap::NReader::NCommon::IDataSource> const&, TDuration, TBasicString<char, std::__y1::char_traits<char>> const&, unsigned int, TBasicString<char, std::__y1::char_traits<char>> const&, std::__y1::shared_ptr<NKikimr::NArrow::NSSA::IResourceProcessor> const&) const @ 0x1583855C 5. /-S/ydb/core/tx/columnshard/engines/reader/common_reader/iterator/fetching.cpp:283: NKikimr::NOlap::NReader::NCommon::TP
  **Post-Mortem & Fix Analysis**:
  > Fixed in https://github.com/ydb-platform/ydb/pull/49129

- **Issue #47131** (2026-07-20): **Fix build on Windows**
  *Symptoms*: ### Changelog entry <!-- a user-readable short description of the changes that goes to CHANGELOG.md and Release Notes -->  ### Changelog category <!-- remove all except one -->  * Not for changelog (changelog entry is not required)  ### Description for reviewers <!-- (optional) description for those who read this PR --> 
  **Post-Mortem & Fix Analysis**:
  > <!-- run-tests-table --> <h3>Run Extra Tests</h3>  Run additional tests for this PR. You can customize: - **Test Size**: small, medium, large (default: small, medium) - **Test Targets**: any directory path (default: `ydb/`) - **Sanitizers**: ASAN, MSAN, TSAN - **Coredumps**: enable for debugging (default: off) - **Additional args**: custom ya make arguments  [![▶  Run tests](https://img.shields.io/badge/▶%20%20Run%20tests-4caf50)](https://gh-ci-app.ydb.tech/workflow/trigger?owner=ydb-platform&repo=ydb&workflow_id=run_tests.yml&ref=main&pull_number=47131&test_targets=ydb%2F&test_size=small%2Cmedium&additional_ya_make_args=&build_preset=relwithdebinfo&collect_coredumps=false&return_url=https%3A%2F%2Fgithub.com%2Fydb-platform%2Fydb%2Fpull%2F47131&ui=true)
  > <!-- status pr=47131, preset=relwithdebinfo, run=152831 --> :white_circle: `2026-07-20 06:50:13 UTC` Pre-commit [check](https://github.com/ydb-platform/ydb/actions/runs/29722597935/job/88288589125) **linux-x86_64-relwithdebinfo** for 636faecb67db7c42f9535d631d552d26560b640d has started. :white_circle: `2026-07-20 06:50:31 UTC` Artifacts will be uploaded [here](https://storage.yandexcloud.net/ydb-gh-logs/ydb-platform/ydb/PR-check/29722597935/ya-x86-64/index.html) :white_circle: `2026-07-20 06:51:58 UTC` ya make is running... :yellow_circle: `2026-07-20 09:29:54 UTC` Some tests failed, follow the links below. Going to retry failed tests...  <details>   [Ya make output](https://storage.yandexcloud.net/ydb-gh-logs/ydb-platform/ydb/PR-check/29722597935/ya-x86-64/ya_make_output.txt) | [Test bloat](https://storage.yandexcloud.net/ydb-gh-logs/ydb-platform/ydb/PR-check/29722597935/ya-x86-64/try_1/test_bloat/tree_map.html) | TESTS | PASSED | ERRORS | FAILED | SKIPPED | MUTED<sup>[?](https://gith
  > <!-- status pr=47131, preset=release-asan, run=152831 --> :white_circle: `2026-07-20 06:50:33 UTC` Pre-commit [check](https://github.com/ydb-platform/ydb/actions/runs/29722597935/job/88288589111) **linux-x86_64-release-asan** for 636faecb67db7c42f9535d631d552d26560b640d has started. :white_circle: `2026-07-20 06:50:53 UTC` Artifacts will be uploaded [here](https://storage.yandexcloud.net/ydb-gh-logs/ydb-platform/ydb/PR-check/29722597935/ya-x86-64-asan/index.html) :white_circle: `2026-07-20 06:52:24 UTC` ya make is running... :yellow_circle: `2026-07-20 09:15:35 UTC` Some tests failed, follow the links below. Going to retry failed tests...  <details>   [Ya make output](https://storage.yandexcloud.net/ydb-gh-logs/ydb-platform/ydb/PR-check/29722597935/ya-x86-64-asan/ya_make_output.txt) | [Test bloat](https://storage.yandexcloud.net/ydb-gh-logs/ydb-platform/ydb/PR-check/29722597935/ya-x86-64-asan/try_1/test_bloat/tree_map.html) | TESTS | PASSED | ERRORS | FAILED | SKIPPED | MUTED<sup>[?](h

- **Issue #46027** (2026-07-13): **Coredump in CreateRegistryScanSnapshotGuard**
  *Symptoms*: ydb-stable-26-2-1-4  Applied the following config on the cluster: ``` selector: {} config: !inherit   column_shard_config: !inherit     enable_cursor_v1: true     s3_client:       executor_threads_count: 64       max_connections_count: 64   feature_flags: !inherit     enable_local_min_max_index: true     enable_cs_dictionary_encoding: true     enable_snapshots_locking: true   memory_controller_config: !inherit     shared_cache_max_percent: 15      query_execution_limit_percent: 30 ```  I **didn't** restart any nodes!!! (so i guess some part of the config was applied without restart), but all nodes got the following coredump:  ``` 0 NKikimr::NColumnShard::CreateRegistryScanSnapshotGuard(unsigned long, unsigned long, NKikimr::NOlap::TSnapshot const&, NKikimr::NOlap::IPathIdTranslator const&, TTrueAtomicSharedPtr<NKikimr::IImmutableSnapshotRegistry>, NKikimrConfig::TLongTxServiceConfig const&) () [contrib/ydb/core/tx/columnshard/scan_snapshot_guard.cpp](ydb/core/tx/columnshard/scan_snapshot_guard.cpp?#L107) +107 1 NKikimr::NColumnShard::CreateScanSnapshotGuard(unsigned long, unsigned long, NKikimr::NOlap::TSnapshot const&, NKikimr::NColumnShard::TInFlightReadsTracker const&, NKikimr::NOlap::IPathIdTranslator const&) () [contrib/ydb/core/tx/columnshard/scan_snapshot_guard.cpp](ydb/core/tx/columnshard/scan_snapshot_guard.cpp?#L170) +170 2 NKikimr::NColumnShard::TColumnShard::GetMinSnapshotForNewReads() const () [contrib/ydb/core/tx/columnshard/columnshard_impl.cpp](ydb/core/tx/col
  **Post-Mortem & Fix Analysis**:
  > 2 types of coredumps, the second one: ``` 0 NKikimr::NColumnShard::CreateRegistryScanSnapshotGuard(unsigned long, unsigned long, NKikimr::NOlap::TSnapshot const&, NKikimr::NOlap::IPathIdTranslator const&, TTrueAtomicSharedPtr<NKikimr::IImmutableSnapshotRegistry>, NKikimrConfig::TLongTxServiceConfig const&) () contrib/ydb/core/tx/columnshard/scan_snapshot_guard.cpp +107 1 NKikimr::NColumnShard::CreateScanSnapshotGuard(unsigned long, unsigned long, NKikimr::NOlap::TSnapshot const&, NKikimr::NColumnShard::TInFlightReadsTracker const&, NKikimr::NOlap::IPathIdTranslator const&) () contrib/ydb/core/tx/columnshard/scan_snapshot_guard.cpp +170 2 NKikimr::NColumnShard::TColumnShard::GetSnapshotHolders() const () contrib/ydb/core/tx/columnshard/columnshard_impl.cpp +218 3 NKikimr::NColumnShard::TColumnShard::SetupCleanupPortions() () contrib/ydb/core/tx/columnshard/columnshard_impl.cpp +902 4 NKikimr::NColumnShard::TColumnShard::EnqueueBackgroundActivities(bool) () contrib/ydb/core/tx/columnshar

- **Issue #45735** (2026-08-04): **Supportive topic partitions create empty topics_per_partition monitoring subgroups**
  *Symptoms*: Служебные (supportive) партиции топика, создаваемые в транзакциях, попадали в мониторинг topics_per_partition.  Причина: TPartition::SetupDetailedMetrics() пропускал supportive-партиции, а TUsersInfoStorage::GetPartitionCounterSubgroupImpl() и TPartition::GetPerPartitionCounterSubgroup() — нет. Вызов GetSubgroup("partition_id", ...) создавал пустые узлы в дереве счётчиков.  Симптом: множество пустых секций partition_id=<большой id> в выгрузке метрик. Объём данных в мониторинг рос, система деградировала.  Исправление: проверка IsSupportive в обоих местах.
  **Post-Mortem & Fix Analysis**:
  > <!-- gh-to-st:ydbbugs-handoff -->  ### This issue has been migrated to **[YDBBUGS-461](http://st/YDBBUGS-461)** 

- **Issue #45732** (2026-08-18): **`/operation/list?kind=import/nfs` returns BAD_REQUEST**
  *Symptoms*: `/operation/list` documents and exposes `import/nfs` as a valid operation kind, but the request returns `BAD_REQUEST`. Root cause seems to be in SchemeShard import listing: schemeshard_import__list.cpp accepts only import/s3 and import/fs, so import/nfs is rejected by TryParseKind(). Expected behavior: import/nfs should be accepted, likely as an alias for import/fs. Related note: export/nfs does not fail, but schemeshard_export__list.cpp also only explicitly handles export/s3 and export/fs; other values fall back to YT, so export/nfs may be silently parsed incorrectly.

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

### Incident Patch 1: `9ccdd72e` (2026-09-30)
**Commit Message**: dq streamlookup/kikimr lookup: fix memory leak on cyclic shared_ptr (YQ-5748) (#54540)

**File**: `ydb/core/kqp/federated_query/actors/lookup_actor/kikimr_lookup_actor.cpp` (modified, +34/-31)
```diff
@@ -113,6 +113,7 @@ namespace {
 
         struct TLookupState {
             using TPtr = std::shared_ptr<TLookupState>;
+            using TWeakPtr = std::weak_ptr<TLookupState>;
             std::weak_ptr<NYql::NDq::IDqAsyncLookupSource::TUnboxedValueMap> Request;
             // ^^^ must not be lock()ed without bound mkql allocator
             // ^^^ (and allocator must not be bound outside actor context)
@@ -130,7 +131,7 @@ namespace {
             using TPtr = std::shared_ptr<TSessionState>;
             TString SessionId;
             NRpcService::TStreamReadProcessorPtr<Ydb::Query::SessionState> StreamProcessor;
-            TLookupState::TPtr PendingLookup; // avoid circular ownership, either PendingLookup or PendingLookup->SessionState must be nullptr
+            TLookupState::TWeakPtr PendingLookup;
         };
 
         // Event ids
@@ -506,7 +507,13 @@ namespace {
             auto actorSystem = TActivationContext::ActorSystem();
             auto selfId = SelfId();
             Y_ABORT_UNLESS(state->StreamProcessor && state->StreamProcessor->HasData());
-            state->StreamProcessor->Read([actorSystem, selfId, state = std::move(state)](Ydb::Query::ExecuteQueryResponsePart&& response) mutable {
+            state->StreamProcessor->Read([actorSystem, selfId, weakState = std::weak_ptr(state)](Ydb::Query::ExecuteQueryResponsePart&& response) {
+                auto state = weakState.lock();
+                if (!state) {
+                    YDB_LOG_ERROR_CTX(*actorSystem, "Read callback: weakState is dead",
+                            {"actorId", selfId});
+                    return;
+                }
                 actorSystem->Send(selfId, new TEvQueryExecuteQueryResponsePart(std::move(response), std::move(state)));
             });
         }
@@ -565,35 +572,34 @@ namespace {
             auto actorSystem = TActivationContext::ActorSystem();
             auto selfId = SelfId();
             Y_ABORT_UNLESS(session->StreamProcessor && session->StreamProcessor->HasData());
-            session->StreamProcessor->Read([actorSystem, selfId, session = std::move(session)](Ydb::Query::SessionState&& response) mutable {
+            session->StreamProcessor->Read([actorSystem, selfId, weakSession = std::weak_ptr(session)](Ydb::Query::SessionState&& response) {
+                auto session = weakSession.lock();
+                if (!session) {
+                    YDB_LOG_ERROR_CTX(*actorSystem, "Read callback: weakSession is dead",
+                            {"actorId", selfId});
+                    return;
+                }
                 actorSystem->Send(selfId, new TEvQuerySessionState(std::move(response), std::move(session)));
             });
         }
 
         void Handle(TEvQuerySessionState::TPtr ev) {
-            auto session = std::move(ev->Get()->State);
-            if (session->PendingLookup) {
-                --InflightCreateSession;
-                if (Y_UNLIKELY(PendingPassAway)) {
-                    SendDeleteSession(session->SessionId);
-                    CleanupStreamProcessor(session);
-                    PassAway();
-                    return;
-                }
-            }
             if (Y_UNLIKELY(PendingPassAway)) {
                 return;
             }
+            auto session = std::move(ev->Get()->State);
+            auto pendingLookup = session->PendingLookup.lock();
+            session->PendingLookup.reset();
             auto& response = ev->Get()->Response;
             YDB_LOG_TRACE("TEvQuerySessionState",
                     COMMON_LOG,
                     {"sessionId", session->SessionId},
                     {"response", response.DebugString()});
             if (Y_UNLIKELY(!session->StreamProcessor)) {
-                YDB_LOG_DEBUG("TEvQuerySessionState called afte CleanupStreamProcessor", COMMON_LOG);
+                YDB_LOG_DEBUG("TEvQuerySessionState called after CleanupStreamProcessor", COMMON_LOG);
                 // possible; TEvQue
```

---

### Incident Patch 2: `20bf8115` (2026-09-30)
**Commit Message**: Fix ANALYZE persistence with optimizer fallback disabled (#54595)

**File**: `ydb/core/kqp/ut/query/kqp_analyze_ut.cpp` (modified, +4/-5)
```diff
@@ -59,8 +59,6 @@ Y_UNIT_TEST_TWIN(AnalyzeScansWithNewRboWithoutFallback, PerShard) {
         }
     });
     const auto failedBefore = FailedNewRboCompilations(runtime);
-    // Exercise generated scans with fallback disabled. Persistence uses a
-    // separate query that still needs the normal optimizer fallback.
     TAnalyzeActor::TConfig config;
     config.ColumnTableWholeTableScanMaxBytes = PerShard ? 0 : (1ULL << 30);
     config.TableBytesSize = 1; // The fixture fits in the whole-table threshold.
@@ -189,9 +187,10 @@ Y_UNIT_TEST_TWIN(AnalyzeOptimizerCache, AnalyzeFirst) {
 
 Y_UNIT_TEST_TWIN(AnalyzeTable, ColumnStore) {
     TTestEnv env(1, 1, true, [](Tests::TServerSettings& settings) {
+        settings.AppConfig->MutableStatisticsConfig()->SetAnalyzeCollectPrimaryKeyHistogram(true);
         auto* tableService = settings.AppConfig->MutableTableServiceConfig();
         tableService->SetEnableNewRBO(true);
-        tableService->SetEnableFallbackToYqlOptimizer(true);
+        tableService->SetEnableFallbackToYqlOptimizer(false);
     });
 
     CreateDatabase(env, "Database");
@@ -243,15 +242,15 @@ Y_UNIT_TEST_TWIN(AnalyzeTable, ColumnStore) {
         Sprintf(R"(ANALYZE `Root/%s/%s`)", "Database", "Table")
     ).GetValueSync();
     UNIT_ASSERT_C(result.IsSuccess(), result.GetIssues().ToString());
-    // Statistics-save queries retain the normal new-RBO fallback path.
-    UNIT_ASSERT_GT(FailedNewRboCompilations(runtime), failedBefore);
+    UNIT_ASSERT_VALUES_EQUAL(FailedNewRboCompilations(runtime), failedBefore);
 
     ui64 saTabletId;
     auto pathId = ResolvePathId(runtime, "/Root/Database/Table", nullptr, &saTabletId);
 
     CheckCountMinSketch(runtime, pathId, {
         {.Tag = 2, .Probes = {{{"Hello,world!", 1500}}}},
     });
+    CheckEqHeightHistogram(runtime, pathId, {1}, 1500, 1);
 }
 
 Y_UNIT_TEST_TWIN(AnalyzeServerlessTable, ColumnStore) {
```

**File**: `ydb/core/statistics/aggregator/ut/ut_analyze_sampling.cpp` (modified, +2/-1)
```diff
@@ -14,7 +14,8 @@ namespace {
 
 auto ObserveScannedShards(TTestActorRuntime& runtime, THashSet<ui64>& shards) {
     return runtime.AddObserver<NKqp::TEvKqp::TEvQueryRequest>([&](auto& ev) {
-        if (ev->Get()->GetRequestType() == NRequestTypes::Analyze) {
+        if (ev->Get()->GetRequestType() == NRequestTypes::Analyze
+                && ev->Get()->GetType() == NKikimrKqp::QUERY_TYPE_SQL_SCAN) {
             const auto& query = ev->Get()->GetQuery();
             TStringBuf prefix, tablet;
             UNIT_ASSERT_C(TStringBuf(query).TrySplit(" WITH TabletId = '", prefix, tablet), query);
```

**File**: `ydb/core/statistics/database/database.cpp` (modified, +4/-1)
```diff
@@ -1,5 +1,6 @@
 #include "database.h"
 
+#include <ydb/core/base/request_types.h>
 #include <ydb/core/statistics/events.h>
 
 #include <ydb/library/table_creator/table_creator.h>
@@ -107,7 +108,9 @@ class TSaveStatisticsQuery : public NKikimr::TQueryBase, public TQueryRetryActor
         : NKikimr::TQueryBase(NKikimrServices::STATISTICS, {}, database, true)
         , PathId(pathId)
         , Items(std::move(items))
-    {}
+    {
+        RequestType = TString(NRequestTypes::Analyze);
+    }
 
     void OnRunQuery() override {
         TStringBuilder sql;
```

---

### Incident Patch 3: `230b1936` (2026-09-30)
**Commit Message**: EXT-2594 Fix stale group info on storage nodes (#54489)

**File**: `ydb/core/blobstorage/nodewarden/node_warden_vdisk.cpp` (modified, +6/-1)
```diff
@@ -575,7 +575,12 @@ namespace NKikimr::NStorage {
         if (!vdisk.GetDoDestroy() && vdisk.GetEntityStatus() != NKikimrBlobStorage::EEntityStatus::DESTROY) {
             const ui32 groupId = vdisk.GetVDiskID().GetGroupID();
             if (TGroupID(groupId).ConfigurationType() == EGroupConfigurationType::Dynamic) {
-                Groups[groupId].MustSubscribe = true;
+                if (!std::exchange(Groups[groupId].MustSubscribe, true) && PipeClientId) {
+                    // A delayed placement may arrive after RegisterNode has omitted this group.
+                    // Subscribe on the current pipe as well as on subsequent reconnects.
+                    SendToController(std::make_unique<TEvBlobStorage::TEvControllerGetGroup>(
+                        LocalNodeId, &groupId, &groupId + 1));
+                }
             }
         }
 
```

**File**: `ydb/core/blobstorage/nodewarden/ut_sequence/dsproxy_config_retrieval.cpp` (modified, +143/-1)
```diff
@@ -186,7 +186,7 @@ NKikimrBlobStorage::TBaseConfig QueryBaseConfig(TTestBasicRuntime& runtime) {
 }
 
 void ReassignGroupDisk(TTestBasicRuntime& runtime, ui64 groupId, ui32 groupGeneration,
-        ui32 targetNodeId, ui32 targetPDiskId) {
+        ui32 targetNodeId, ui32 targetPDiskId, bool suppressDonorMode = false) {
     TActorId edge = runtime.AllocateEdgeActor();
     auto ev = std::make_unique<TEvBlobStorage::TEvControllerConfigRequest>();
     auto *request = ev->Record.MutableRequest();
@@ -199,6 +199,7 @@ void ReassignGroupDisk(TTestBasicRuntime& runtime, ui64 groupId, ui32 groupGener
     cmd->SetFailRealmIdx(0);
     cmd->SetFailDomainIdx(0);
     cmd->SetVDiskIdx(0);
+    cmd->SetSuppressDonorMode(suppressDonorMode);
     auto *targetPDisk = cmd->MutableTargetPDiskId();
     targetPDisk->SetNodeId(targetNodeId);
     targetPDisk->SetPDiskId(targetPDiskId);
@@ -247,6 +248,147 @@ void WaitForNodeWardenGroupGeneration(TTestBasicRuntime& runtime, ui32 nodeIndex
 
 Y_UNIT_TEST_SUITE(NodeWardenDsProxyConfigRetrieval) {
 
+    Y_UNIT_TEST(DelayedPlacementSubscribesWithoutProxy) {
+        TTestBasicRuntime runtime(3);
+        const ui32 groupId = 0x80000000;
+        ui32 ownerNodeId = 0;
+        bool holdUpdates = false;
+        bool awaitingRegistration = false;
+        bool registeredWithoutGroup = false;
+        bool receivedComprehensive = false;
+        ui32 getGroupRequests = 0;
+        std::vector<std::unique_ptr<IEventHandle>> delayedUpdates;
+        THashMap<ui32, TActorId> wardens;
+        THashMap<TActorId, TActorId> clients;
+
+        auto prevReg = runtime.SetRegistrationObserverFunc(
+            [&](TTestActorRuntimeBase& runtime, const TActorId&, const TActorId& actorId) {
+                if (dynamic_cast<NStorage::TNodeWarden*>(runtime.FindActor(actorId))) {
+                    wardens[actorId.NodeId()] = actorId;
+                    runtime.EnableScheduleForActor(actorId);
+                }
+            });
+        auto prev = runtime.SetObserverFunc([&](TAutoPtr<IEventHandle>& ev) {
+            if (auto* msg = ev->CastAsLocal<TEvBlobStorage::TEvControllerNodeServiceSetUpdate>()) {
+                if (holdUpdates && ownerNodeId && msg->Record.GetNodeID() == ownerNodeId) {
+                    receivedComprehensive |= awaitingRegistration && msg->Record.GetComprehensive();
+                    delayedUpdates.emplace_back(ev.Release());
+                    return TTestActorRuntimeBase::EEventAction::DROP;
+                }
+            } else if (auto* msg = ev->CastAsLocal<TEvTabletPipe::TEvClientConnected>()) {
+                if (msg->TabletId == MakeBSControllerID() && msg->Status == NKikimrProto::OK) {
+                    clients[ev->Recipient] = msg->ClientId;
+                }
+            } else if (auto* msg = ev->CastAsLocal<TEvBlobStorage::TEvControllerRegisterNode>()) {
+                if (awaitingRegistration && msg->Record.GetNodeID() == ownerNodeId) {
+                    UNIT_ASSERT_VALUES_EQUAL(msg->Record.GroupsSize(), 0);
+                    registeredWithoutGroup = true;
+                }
+            } else if (auto* msg = ev->CastAsLocal<TEvBlobStorage::TEvControllerGetGroup>()) {
+                if (msg->Record.GetNodeID() == ownerNodeId) {
+                    ++getGroupRequests;
+                }
+            }
+            return TTestActorRuntimeBase::EEventAction::PROCESS;
+        });
+
+        Setup(runtime);
+        auto base = QueryBaseConfig(runtime);
+        ui32 initialNodeId = 0;
+        for (const auto& vslot : base.GetVSlot()) {
+            if (vslot.GetGroupId() == groupId) {
+                initialNodeId = vslot.GetVSlotId().GetNodeId();
+            }
+        }
+        UNIT_ASSERT(initialNodeId);
+        const ui32 ownerNodeIndex = runtime.GetNodeId(0) == initialNodeId ? 1 : 0;
+        ownerNodeId = runtime.GetNodeId(ownerNodeIndex);
+        ui32 ownerPDiskId = 0;
+        std::vector<std::pair<ui32, ui32>> otherDisks;
+     
```

**File**: `ydb/core/blobstorage/ut_blobstorage/donor.cpp` (modified, +129/-0)
```diff
@@ -1,7 +1,136 @@
 #include <ydb/core/blobstorage/ut_blobstorage/lib/env.h>
+#include <ydb/core/blobstorage/nodewarden/node_warden_impl.h>
 
 Y_UNIT_TEST_SUITE(Donor) {
 
+    Y_UNIT_TEST(OfflineDonorDoesNotSubscribeNewNodeProcess) {
+        TEnvironmentSetup env{{
+            .NodeCount = 11,
+            .Erasure = TBlobStorageGroupType::Erasure4Plus2Block,
+            .ControllerNodeId = 11,
+        }};
+        auto& runtime = *env.Runtime;
+        env.EnableDonorMode();
+        env.CreateBoxAndPool(1, 1, 10);
+        env.Sim(TDuration::Seconds(30));
+        const ui32 groupId = env.GetGroups().front();
+        const auto initial = env.GetGroupInfo(groupId);
+        const ui32 owner = initial->GetActorId(0).NodeId();
+        ui32 getGroupRequests = 0;
+        std::optional<bool> registeredWithGroup;
+        runtime.FilterFunction = [&](ui32, std::unique_ptr<IEventHandle>& ev) {
+            if (ev->GetTypeRewrite() == TEvBlobStorage::TEvControllerRegisterNode::EventType && ev->Sender.NodeId() == owner) {
+                const auto& groups = ev->Get<TEvBlobStorage::TEvControllerRegisterNode>()->Record.GetGroups();
+                registeredWithGroup = std::find(groups.begin(), groups.end(), groupId) != groups.end();
+            } else if (ev->GetTypeRewrite() == TEvBlobStorage::TEvControllerGetGroup::EventType && ev->Sender.NodeId() == owner) {
+                ++getGroupRequests;
+            }
+            return true;
+        };
+
+        auto warden = [&]() {
+            const auto id = runtime.GetNode(owner)->ActorSystem->LookupLocalService(MakeBlobStorageNodeWardenID(owner));
+            auto* actor = dynamic_cast<NStorage::TNodeWarden*>(runtime.GetActor(id));
+            UNIT_ASSERT(actor);
+            return actor;
+        };
+        auto move = [&](ui32 position) {
+            const auto info = env.GetGroupInfo(groupId);
+            std::set<ui32> occupied;
+            for (ui32 i = 0; i < info->GetTotalVDisksNum(); ++i) {
+                occupied.insert(info->GetActorId(i).NodeId());
+            }
+            const auto base = env.FetchBaseConfig();
+            NKikimrBlobStorage::TConfigRequest request;
+            request.SetIgnoreGroupFailModelChecks(true);
+            request.SetIgnoreDegradedGroupsChecks(true);
+            request.SetIgnoreDisintegratedGroupsChecks(true);
+            auto* cmd = request.AddCommand()->MutableReassignGroupDisk();
+            const auto id = info->GetVDiskId(position);
+            cmd->SetGroupId(groupId);
+            cmd->SetGroupGeneration(info->GroupGeneration);
+            cmd->SetFailRealmIdx(id.FailRealm);
+            cmd->SetFailDomainIdx(id.FailDomain);
+            cmd->SetVDiskIdx(id.VDisk);
+            for (const auto& pdisk : base.GetPDisk()) {
+                if (pdisk.GetNodeId() != owner && !occupied.contains(pdisk.GetNodeId())) {
+                    cmd->MutableTargetPDiskId()->SetNodeId(pdisk.GetNodeId());
+                    cmd->MutableTargetPDiskId()->SetPDiskId(pdisk.GetPDiskId());
+                    break;
+                }
+            }
+            UNIT_ASSERT(cmd->HasTargetPDiskId());
+            const auto response = env.Invoke(request);
+            UNIT_ASSERT_C(response.GetSuccess(), response.DebugString());
+            env.Sim(TDuration::Seconds(60));
+        };
+
+        // The old process is gone before its VDisk is moved and its donor is dropped.
+        env.StopNode(owner);
+        env.Sim(TDuration::Seconds(2));
+        move(0);
+        const auto afterMove = env.FetchBaseConfig();
+        for (const auto& slot : afterMove.GetVSlot()) {
+            for (const auto& donor : slot.GetDonors()) {
+                UNIT_ASSERT_VALUES_UNEQUAL(donor.GetVSlotId().GetNodeId(), owner);
+            }
+        }
+
+        // A real node restart has no cached group and no MustSubscribe marker.
+        env.StartNode(owner);
+        env.Sim(TDuration::Seconds(10));
+        UNIT_ASSERT(!warden()->Gr
```

**File**: `ydb/core/mind/bscontroller/config.cpp` (modified, +3/-3)
```diff
@@ -663,14 +663,14 @@ namespace NKikimr::NBsController {
                     Y_DEBUG_ABORT_UNLESS(overlay->second->IsReady || overlay->second->IsInVSlotReadyTimestampQ());
                 }
 
-                // Keep node->group subscription in commit path: dynamic groups may appear
-                // after initial RegisterNode, and cleanup for the same index is done below.
+                // Keep subscriptions for placements added after RegisterNode on the current connection.
+                // Disconnected nodes will subscribe to their live placements when they register again.
                 if (overlay->second && !overlay->second->IsBeingDeleted()) {
                     const TGroupId groupId = overlay->second->GroupId;
                     if (NKikimr::IsDynamicGroup(groupId)) {
                         const TNodeId nodeId = overlay->second->VSlotId.NodeId;
                         auto& node = GetNode(nodeId);
-                        if (node.GroupsRequested.insert(groupId).second) {
+                        if (node.ConnectedServerId && node.GroupsRequested.insert(groupId).second) {
                             GroupToNode.emplace(groupId, nodeId);
                         }
                     }
```

---

### Incident Patch 4: `d67675b7` (2026-09-30)
**Commit Message**: Trace id propagation (#54499)

**File**: `ydb/core/grpc_services/query/rpc_execute_script.cpp` (modified, +1/-1)
```diff
@@ -101,7 +101,7 @@ class TExecuteScriptRPC : public TRpcRequestActor<TExecuteScriptRPC, TEvExecuteS
 
         Ydb::StatusIds::StatusCode status = Ydb::StatusIds::SUCCESS;
         if (auto scriptRequest = MakeScriptRequest(issues, status)) {
-            if (Send(NKqp::MakeKqpProxyID(SelfId().NodeId()), scriptRequest.Release())) {
+            if (Send(NKqp::MakeKqpProxyID(SelfId().NodeId()), scriptRequest.Release(), 0, 0, Request->GetWilsonTraceId())) {
                 Become(&TExecuteScriptRPC::StateFunc);
             } else {
                 issues.AddIssue(MakeIssue(NKikimrIssues::TIssuesIds::DEFAULT_ERROR, "Internal error"));
```

**File**: `ydb/core/grpc_services/query/rpc_kqp_tx.cpp` (modified, +2/-2)
```diff
@@ -120,7 +120,7 @@ class TBeginTransactionRPC : public  TActorBootstrapped<TBeginTransactionRPC> {
         }
 
         ev->Record.MutableRequest()->SetAction(NKikimrKqp::QUERY_ACTION_BEGIN_TX);
-        Send(NKqp::MakeKqpProxyID(SelfId().NodeId()), ev.Release());
+        Send(NKqp::MakeKqpProxyID(SelfId().NodeId()), ev.Release(), 0, 0, Request->GetWilsonTraceId());
     }
 
     void Handle(NKqp::TEvKqp::TEvQueryResponse::TPtr& ev) {
@@ -228,7 +228,7 @@ class TFinishTransactionRPC : public  TActorBootstrapped<TFinishTransactionRPC>
 
         Fill(ev->Record.MutableRequest());
 
-        Send(NKqp::MakeKqpProxyID(SelfId().NodeId()), ev.Release());
+        Send(NKqp::MakeKqpProxyID(SelfId().NodeId()), ev.Release(), 0, 0, Request->GetWilsonTraceId());
     }
 
     void Handle(NKqp::TEvKqp::TEvQueryResponse::TPtr& ev) {
```

**File**: `ydb/core/kqp/compile_service/kqp_compile_actor.cpp` (modified, +1/-1)
```diff
@@ -373,7 +373,7 @@ class TKqpCompileActor : public TActorBootstrapped<TKqpCompileActor> {
                 QueryId.Cluster, TlsActivationContext->ActorSystem(), Config, true, TempTablesState, FederatedQuerySetup,
                 CompileActorSpan.GetTraceId());
         Gateway = CreateKikimrIcGateway(QueryId.Cluster, QueryId.Settings.QueryType, QueryId.Database, QueryId.DatabaseId, std::move(loader),
-            ctx.ActorSystem(), ctx.SelfID.NodeId(), counters, QueryServiceConfig);
+            ctx.ActorSystem(), ctx.SelfID.NodeId(), counters, QueryServiceConfig, CompileActorSpan.GetTraceId());
         Gateway->SetToken(QueryId.Cluster, UserToken);
         Gateway->SetClientAddress(ClientAddress);
 
```

**File**: `ydb/core/kqp/executer_actor/kqp_executer.h` (modified, +1/-1)
```diff
@@ -196,7 +196,7 @@ IActor* CreateKqpSchemeExecuter(
     TIntrusiveConstPtr<NACLib::TUserToken> userToken, const TString& clientAddress,
     bool temporary, bool createTmpDir, bool isCreateTableAs, TString tempDirName, TIntrusivePtr<TUserRequestContext> ctx,
     bool expectsResult = false, TTxAllocatorState::TPtr txAlloc = nullptr,
-    const TActorId& kqpTempTablesAgentActor = TActorId());
+    const TActorId& kqpTempTablesAgentActor = TActorId(), NWilson::TTraceId traceId = {});
 
 std::unique_ptr<TEvKqpExecuter::TEvTxResponse> ExecuteLiteral(
     IKqpGateway::TExecPhysicalRequest&& request, TKqpRequestCounters::TPtr counters, TActorId owner, const TIntrusivePtr<TUserRequestContext>& userRequestContext);
```

**File**: `ydb/core/kqp/executer_actor/kqp_partitioned_executer.cpp` (modified, +1/-1)
```diff
@@ -572,7 +572,7 @@ class TKqpPartitionedExecuter : public TActorBootstrapped<TKqpPartitionedExecute
 
         TAutoPtr<TEvTxProxySchemeCache::TEvResolveKeySet> resolveReq(new TEvTxProxySchemeCache::TEvResolveKeySet(request));
 
-        Send(MakeSchemeCacheID(), resolveReq.Release());
+        Send(MakeSchemeCacheID(), resolveReq.Release(), 0, 0, NWilson::TTraceId(Request.TraceId));
     }
 
     void CreateExecutersWithBuffers() {
```

---

### Incident Patch 5: `2b74e6bc` (2026-09-30)
**Commit Message**: wlm: fixes (#54591)

**File**: `ydb/tests/workload_manager/common/workload_manager.py` (modified, +3/-1)
```diff
@@ -133,7 +133,9 @@ def _exists(path: str) -> bool:
             if _exists(f'.metadata/workload_manager/pools/{pool.name}'):
                 sessions_pool.execute_with_retries(f'DROP RESOURCE POOL {pool.name}')
 
-            sessions_pool.execute_with_retries(pool.get_create_users_sql())
+            create_users_sql = pool.get_create_users_sql()
+            if create_users_sql:
+                sessions_pool.execute_with_retries(create_users_sql)
             sessions_pool.execute_with_retries(pool.get_create_sql())
 
     @classmethod
```

**File**: `ydb/tests/ya.make` (modified, +1/-0)
```diff
@@ -15,4 +15,5 @@ RECURSE(
     stress
     supp
     tools
+    workload_manager
 )
```

---

### Incident Patch 6: `cb4dc8a4` (2026-09-30)
**Commit Message**: fix races with failed reassigns (#54433)

**File**: `ydb/core/mind/hive/hive_impl.cpp` (modified, +2/-0)
```diff
@@ -403,6 +403,8 @@ void THive::ExecuteProcessBootQueue(NIceDb::TNiceDb&, TSideEffects& sideEffects)
         }
         if (tablet->IsBooting()) {
             delayedTablets.push_back(record);
+        } else if (!(tablet->IsLeader() && tablet->AsLeader().IsBootingSuppressed())) {
+            tablet->InitiateStop(sideEffects);
         }
     }
     if (waitingTablets.size() == processedItems || BootQueue.WaitQueue.empty()) {
```

**File**: `ydb/core/mind/hive/hive_impl_ut.cpp` (modified, +1/-1)
```diff
@@ -476,7 +476,7 @@ Y_UNIT_TEST_SUITE(THiveImplTest) {
                 UNIT_ASSERT_VALUES_EQUAL(node.GetTabletsScheduled(), id == nodeId ? 1 : 0);
                 UNIT_ASSERT_VALUES_EQUAL(std::get<NMetrics::EResource::CPU>(node.ResourceValues), id == nodeId ? 100 : 0);
                 // Boot failure handling must recognize the new Local and reject the old one.
-                UNIT_ASSERT_VALUES_EQUAL(tablet.IsAliveOnLocal(node.Local), id == nodeId);
+                UNIT_ASSERT_VALUES_EQUAL(tablet.IsPresentOnLocal(node.Local), id == nodeId);
             }
         };
 
```

**File**: `ydb/core/mind/hive/hive_ut.cpp` (modified, +128/-3)
```diff
@@ -3396,6 +3396,129 @@ Y_UNIT_TEST_SUITE(THiveTest) {
         }
     }
 
+    Y_UNIT_TEST(TestTabletDeathDuringUnchangedReassign) {
+        // A tablet that dies while in GroupAssignment state must be restarted,
+        // even if the reassign ends up not changing any groups
+        TTestBasicRuntime runtime(1, false);
+        Setup(runtime, true, 2, [](TAppPrepare& app) {
+            // every reassign following the first one is "too soon"
+            app.HiveConfig.SetMinPeriodBetweenReassign(3600);
+        });
+        const ui64 hiveTablet = MakeDefaultHiveID();
+        const ui64 testerTablet = MakeTabletID(false, 1);
+        CreateTestBootstrapper(runtime, CreateTestTabletInfo(hiveTablet, TTabletTypes::Hive), &CreateDefaultHive);
+
+        ui64 tabletId = SendCreateTestTablet(runtime, hiveTablet, testerTablet,
+            MakeHolder<TEvHive::TEvCreateTablet>(testerTablet, 100500, TTabletTypes::Dummy, BINDED_CHANNELS), 0, true);
+        MakeSureTabletIsUp(runtime, tabletId, 0);
+
+        // The first space reassign goes through and becomes the "last change"
+        SendReassignTabletSpace(runtime, hiveTablet, tabletId, {}, 0);
+        runtime.SimulateSleep(TDuration::Seconds(1));
+        MakeSureTabletIsUp(runtime, tabletId, 0);
+
+        bool tabletDeathReported = false;
+        auto statusObserver = runtime.AddObserver<TEvLocal::TEvTabletStatus>([&](auto&& ev) {
+            const auto& record = ev->Get()->Record;
+            if (record.GetTabletID() == tabletId && record.GetStatus() != TEvLocal::TEvTabletStatus::StatusOk) {
+                tabletDeathReported = true;
+            }
+        });
+
+        {
+            // Hold group assignment back, so that the tablet dies in GroupAssignment state
+            TBlockEvents<TEvBlobStorage::TEvControllerSelectGroupsResult> blockGroups(runtime);
+            SendReassignTabletSpace(runtime, hiveTablet, tabletId, {}, 0);
+            runtime.WaitFor("select groups result", [&] { return !blockGroups.empty(); });
+
+            runtime.Register(CreateTabletKiller(tabletId));
+            runtime.WaitFor("tablet death report", [&] { return tabletDeathReported; });
+            runtime.SimulateSleep(TDuration::MilliSeconds(100));
+
+            // the reassign is rejected as "too soon", so no groups are changed
+            blockGroups.Stop().Unblock();
+        }
+        runtime.SimulateSleep(TDuration::Seconds(1));
+
+        TActorId sender = runtime.AllocateEdgeActor();
+        runtime.SendToPipe(hiveTablet, sender, new TEvHive::TEvRequestHiveInfo({
+            .TabletId = tabletId,
+            .ReturnChannelHistory = true,
+        }));
+        TAutoPtr<IEventHandle> handle;
+        TEvHive::TEvResponseHiveInfo* response = runtime.GrabEdgeEventRethrow<TEvHive::TEvResponseHiveInfo>(handle);
+        UNIT_ASSERT_VALUES_EQUAL(response->Record.TabletsSize(), 1);
+        const auto& tablet = response->Record.GetTablets(0);
+        UNIT_ASSERT_VALUES_EQUAL(tablet.GetTabletChannels(0).GetHistory().size(), 2);
+        UNIT_ASSERT_VALUES_EQUAL(tablet.GetState(), static_cast<ui32>(NHive::ETabletState::ReadyToWork));
+
+        WaitForTabletIsUp(runtime, tabletId, 0);
+    }
+
+    Y_UNIT_TEST(TestBootQueueDuringUnchangedReassign) {
+        // A tablet that is processed by the boot queue while in GroupAssignment state must be booted,
+        // even if the reassign ends up not changing any groups
+        TTestBasicRuntime runtime(1, false);
+        Setup(runtime, true, 2, [](TAppPrepare& app) {
+            // every reassign following the first one is "too soon"
+            app.HiveConfig.SetMinPeriodBetweenReassign(3600);
+        });
+        const ui64 hiveTablet = MakeDefaultHiveID();
+        const ui64 testerTablet = MakeTabletID(false, 1);
+        CreateTestBootstrapper(runtime, CreateTestTabletInfo(hiveTablet, TTabletTypes::Hive), &CreateDefaultHive);
+
+        ui64 tabletId = SendCreateTestTablet(runtime, hiveTablet, testerTablet,
+    
```

**File**: `ydb/core/mind/hive/node_info.cpp` (modified, +2/-2)
```diff
@@ -289,7 +289,7 @@ i32 TNodeInfo::GetPriorityForTablet(const TTabletInfo& tablet, TDataCenterPriori
 }
 
 bool TNodeInfo::IsAbleToRunTablet(const TTabletInfo& tablet, TTabletDebugState* debugState) const {
-    if (tablet.IsAliveOnLocal(Local)) {
+    if (tablet.IsPresentOnLocal(Local)) {
         return !(IsOverloaded() && tablet.HasAllowedMetric(EResourceToBalance::ComputeResources));
     }
     if (tablet.IsLeader()) {
@@ -496,7 +496,7 @@ double TNodeInfo::GetNodeUsageForTablet(const TTabletInfo& tablet, bool neighbou
     }
     tablet.FilterRawValues(nodeValues);
     tablet.FilterRawValues(tabletValues);
-    bool alreadyHere = tablet.IsAliveOnLocal(Local);
+    bool alreadyHere = tablet.IsPresentOnLocal(Local);
     auto current = alreadyHere ? nodeValues : nodeValues + tabletValues;
     // basically, this is: return max(a / b);
     double usage = TTabletInfo::GetUsage(current, maximum);
```

**File**: `ydb/core/mind/hive/node_info.h` (modified, +1/-1)
```diff
@@ -160,7 +160,7 @@ struct TNodeInfo: public TIntrusiveListItem<TNodeInfo, TSegmentNodesTag> {
         auto it = TabletsOfObject.find(tablet.GetObjectId());
         if (it != TabletsOfObject.end()) {
             auto count = it->second.size();
-            if (tablet.IsAliveOnLocal(Local)) {
+            if (tablet.IsPresentOnLocal(Local)) {
                 --count;
             }
             return count;
```

---

### Incident Patch 7: `bb3f00db` (2026-09-30)
**Commit Message**: Fix sensitive HTTP header redaction for overlapping values (#54443)

**File**: `ydb/library/actors/http/http.h` (modified, +3/-3)
```diff
@@ -31,7 +31,7 @@ void CrackAddress(const TString& address, TString& hostname, TIpPort& port);
 [[nodiscard]] TStringBuf TrimEnd(TStringBuf target, char delim);
 [[nodiscard]] TStringBuf Trim(TStringBuf target, char delim);
 void TrimEnd(TString& target, char delim);
-TString GetObfuscatedData(TString data, const THeaders& headers);
+TString GetObfuscatedData(TStringBuf data);
 TString ToHex(size_t value);
 bool IsReadableContent(TStringBuf contentType);
 bool IsValidMethod(TStringBuf s);
@@ -696,7 +696,7 @@ class THttpParser : public HeaderType, public TSocketBuffer {
     }
 
     TString GetObfuscatedData() const {
-        return NHttp::GetObfuscatedData(AsReadableString(), HeaderType::Headers);
+        return NHttp::GetObfuscatedData(AsReadableString());
     }
 };
 
@@ -936,7 +936,7 @@ class THttpRenderer : public HeaderType, public TSocketBuffer {
     }
 
     TString GetObfuscatedData() const {
-        return NHttp::GetObfuscatedData(AsReadableString(), HeaderType::Headers);
+        return NHttp::GetObfuscatedData(AsReadableString());
     }
 
     void Assign(TStringBuf data) {
```

**File**: `ydb/library/actors/http/http_proxy.cpp` (modified, +53/-34)
```diff
@@ -1,5 +1,6 @@
 #include <ydb/library/actors/core/events.h>
 #include <library/cpp/monlib/metrics/metric_registry.h>
+#include <util/generic/algorithm.h>
 #include <cctype>
 #include "http_proxy.h"
 
@@ -436,46 +437,64 @@ void TrimEnd(TString& target, char delim) {
     }
 }
 
-TString GetObfuscatedData(TString data, const THeaders& headers) {
-    TStringBuf authorization(headers["Authorization"]);
-    TStringBuf cookie(headers["Cookie"]);
-    TStringBuf set_cookie(headers["Set-Cookie"]);
-    TStringBuf x_ydb_auth_ticket(headers["x-ydb-auth-ticket"]);
-    TStringBuf x_yacloud_subjecttoken(headers["x-yacloud-subjecttoken"]);
-    if (!authorization.empty()) {
-        auto pos = data.find(authorization);
-        if (pos != TString::npos) {
-            data.replace(pos, authorization.size(), TString("<obfuscated>"));
-        }
-    }
-    if (!cookie.empty()) {
-        auto pos = data.find(cookie);
-        if (pos != TString::npos) {
-            data.replace(pos, cookie.size(), TString("<obfuscated>"));
+TString GetObfuscatedData(TStringBuf data) {
+    static constexpr TStringBuf SensitiveHeaders[] = {
+        "Authorization",
+        "Cookie",
+        "Set-Cookie",
+        "X-Ydb-Auth-Ticket",
+        "X-YaCloud-SubjectToken",
+    };
+
+    TString result;
+    result.reserve(data.size());
+    while (!data.empty()) {
+        const size_t lineEnd = data.find('\n');
+        TStringBuf line = data.substr(0, lineEnd);
+        if (lineEnd != TStringBuf::npos) {
+            // Match the parser's handling of LF and CRLF line endings.
+            line = TrimEnd(line, '\r');
         }
-    }
-    if (!set_cookie.empty()) {
-        auto pos = data.find(set_cookie);
-        if (pos != TString::npos) {
-            data.replace(pos, set_cookie.size(), TString("<obfuscated>"));
+        if (line.empty()) {
+            // The rest is the body and must not be interpreted as headers.
+            result += data;
+            break;
         }
-    }
-    if (!x_ydb_auth_ticket.empty()) {
-        auto pos = data.find(x_ydb_auth_ticket);
-        if (pos != TString::npos) {
-            data.replace(pos, x_ydb_auth_ticket.size(), TString("<obfuscated>"));
+
+        const size_t colon = line.find(':');
+        const TStringBuf headerName = line.substr(0, colon);
+        const auto isSensitiveHeader = [headerName](TStringBuf sensitiveHeader) {
+            return TEqNoCase()(headerName, sensitiveHeader);
+        };
+
+        if (colon != TStringBuf::npos && AnyOf(SensitiveHeaders, isSensitiveHeader)) {
+            size_t valueBegin = colon + 1;
+            while (valueBegin < line.size() && (line[valueBegin] == ' ' || line[valueBegin] == '\t')) {
+                ++valueBegin;
+            }
+
+            result += line.substr(0, valueBegin);
+
+            if (valueBegin < line.size()) {
+                result += "<obfuscated>";
+            }
+        } else {
+            result += line;
         }
-    }
-    if (!x_yacloud_subjecttoken.empty()) {
-        auto pos = data.find(x_yacloud_subjecttoken);
-        if (pos != TString::npos) {
-            data.replace(pos, x_yacloud_subjecttoken.size(), TString("<obfuscated>"));
+
+        if (lineEnd == TStringBuf::npos) {
+            break;
         }
+
+        result += data.substr(line.size(), lineEnd + 1 - line.size());
+        data.Skip(lineEnd + 1);
     }
-    if (data.size() > 2000) {
-        return data.substr(0, 1000) + " --- <truncated> --- " + data.substr(data.size() - 1000);
+
+    if (result.size() > 2000) {
+        return result.substr(0, 1000) + " --- <truncated> --- " + result.substr(result.size() - 1000);
     }
-    return data;
+
+    return result;
 }
 
 TString ToHex(size_t value) {
```

**File**: `ydb/library/actors/http/ut/http_obfuscation_ut.cpp` (added, +172/-0)
```diff
@@ -0,0 +1,172 @@
+#include <ydb/library/actors/http/http.h>
+
+#include <library/cpp/testing/unittest/registar.h>
+
+namespace NHttp {
+namespace {
+
+constexpr TStringBuf SensitiveHeaders[] = {
+    "Authorization",
+    "Cookie",
+    "Set-Cookie",
+    "X-Ydb-Auth-Ticket",
+    "X-YaCloud-SubjectToken",
+};
+
+void CheckHeaderPairs(TStringBuf firstValue, TStringBuf secondValue) {
+    for (TStringBuf firstHeader : SensitiveHeaders) {
+        for (TStringBuf secondHeader : SensitiveHeaders) {
+            const TString raw = TStringBuilder() << firstHeader << ": " << firstValue << "\r\n"
+                                    << secondHeader << ": " << secondValue << "\r\n";
+            const TString expected = TStringBuilder() << firstHeader << ": <obfuscated>\r\n"
+                                        << secondHeader << ": <obfuscated>\r\n";
+            UNIT_ASSERT_VALUES_EQUAL(GetObfuscatedData(raw), expected);
+        }
+    }
+}
+
+} // namespace
+
+Y_UNIT_TEST_SUITE(HttpObfuscation) {
+    Y_UNIT_TEST(SingleHeader) {
+        for (TStringBuf headerName : SensitiveHeaders) {
+            const TString raw = TStringBuilder() << headerName << ": example-secret\r\n";
+            const TString expected = TStringBuilder() << headerName << ": <obfuscated>\r\n";
+            UNIT_ASSERT_VALUES_EQUAL(GetObfuscatedData(raw), expected);
+        }
+    }
+
+    Y_UNIT_TEST(DifferentValues) {
+        CheckHeaderPairs("first-secret", "second-secret");
+    }
+
+    Y_UNIT_TEST(IdenticalValues) {
+        CheckHeaderPairs("example-secret", "example-secret");
+    }
+
+    Y_UNIT_TEST(OverlappingValues) {
+        CheckHeaderPairs("Bearer example-secret", "Bearer example-secret-suffix");
+        CheckHeaderPairs("Bearer example-secret-suffix", "Bearer example-secret");
+    }
+
+    Y_UNIT_TEST(RepeatedMixedCaseHeaders) {
+        const TString raw = "aUtHoRiZaTiOn: first-secret\r\n"
+                            "AUTHORIZATION: second-secret\r\n"
+                            "cOoKiE: cookie-secret\r\n"
+                            "sEt-CoOkIe: first-cookie\r\n"
+                            "SET-COOKIE: second-cookie\r\n"
+                            "x-YdB-aUtH-tIcKeT: ticket-secret\r\n"
+                            "x-YaClOuD-sUbJeCtToKeN: subject-secret\r\n";
+        const TString expected = "aUtHoRiZaTiOn: <obfuscated>\r\n"
+                                    "AUTHORIZATION: <obfuscated>\r\n"
+                                    "cOoKiE: <obfuscated>\r\n"
+                                    "sEt-CoOkIe: <obfuscated>\r\n"
+                                    "SET-COOKIE: <obfuscated>\r\n"
+                                    "x-YdB-aUtH-tIcKeT: <obfuscated>\r\n"
+                                    "x-YaClOuD-sUbJeCtToKeN: <obfuscated>\r\n";
+        UNIT_ASSERT_VALUES_EQUAL(GetObfuscatedData(raw), expected);
+    }
+
+    Y_UNIT_TEST(UnrelatedHeadersAndBody) {
+        const TString prefix = "GET /example-secret HTTP/1.1\r\n"
+                                "X-Comment: Authorization: example-secret\r\n"
+                                "X-Authorization: example-secret\r\n"
+                                "Authorization-Info: example-secret\r\n";
+        const TString body = "\r\nAuthorization: body-value\r\n"
+                                "Cookie: example-secret\r\n";
+        const TString raw = prefix + "Authorization: example-secret\r\n" + body;
+        const TString expected = prefix + "Authorization: <obfuscated>\r\n" + body;
+        UNIT_ASSERT_VALUES_EQUAL(GetObfuscatedData(raw), expected);
+    }
+
+    Y_UNIT_TEST(WhitespaceAndEmptyValues) {
+        const TString raw = "Authorization:secret\r\n"
+                            "Cookie:\t  secret with spaces \t\r\n"
+                            "Set-Cookie:\r\n"
+                            "X-Ydb-Auth-Ticket: \t\r\n";
+        const TString expected = "Authorization:<obfuscated>\r\n"
+                                    "Cookie:\t  <obfuscated>\r\n"
+   
```

**File**: `ydb/library/actors/http/ut/ya.make` (modified, +1/-0)
```diff
@@ -15,6 +15,7 @@ PEERDIR(
 IF (NOT OS_WINDOWS)
 SRCS(
     http_cache_ut.cpp
+    http_obfuscation_ut.cpp
     http_tls_init_ut.cpp
     http_ut.cpp
     http2_ut.cpp
```

---

### Incident Patch 8: `b42a079e` (2026-09-29)
**Commit Message**: Fix and improve doxygen comments
commit_hash:0eba9e2538a9138b472bfb4cf628ce75d23f6ccb

**File**: `library/cpp/containers/cow_string/subst.h` (modified, +16/-12)
```diff
@@ -4,28 +4,32 @@
 
 #include <util/string/subst.h>
 
-/* Replace all occurences of substring `what` with string `with` starting from position `from`.
+/** Replace all occurences of substring \p what with string \p with starting from position \p from.
  *
- * @param text      String to modify.
- * @param what      Substring to replace.
- * @param with      Substring to use as replacement.
- * @param from      Position at with to start replacement.
+ * @param[inout] text   String to modify.
+ * @param[in] what      Substring to replace.
+ * @param[in] with      Substring to use as replacement.
+ * @param[in] from      Position at with to start replacement.
  *
- * @return          Number of replacements occured.
+ * @return              Number of replacements occured.
  */
+/**@{*/
 size_t SubstGlobal(TCowString& text, TStringBuf what, TStringBuf with, size_t from = 0);
 size_t SubstGlobal(TUtf16CowString& text, TWtringBuf what, TWtringBuf with, size_t from = 0);
 size_t SubstGlobal(TUtf32CowString& text, TUtf32StringBuf what, TUtf32StringBuf with, size_t from = 0);
+/**@}*/
 
-/* Replace all occurences of character `what` with character `with` starting from position `from`.
+/** Replace all occurences of substring \p what with string \p with starting from position \p from.
  *
- * @param text      String to modify.
- * @param what      Character to replace.
- * @param with      Character to use as replacement.
- * @param from      Position at with to start replacement.
+ * @param[inout] text   String to modify.
+ * @param[in] what      Character to replace.
+ * @param[in] with      Character to use as replacement.
+ * @param[in] from      Position at with to start replacement.
  *
- * @return          Number of replacements occured.
+ * @return              Number of replacements occured.
  */
+/**@{*/
 size_t SubstGlobal(TCowString& text, char what, char with, size_t from = 0);
 size_t SubstGlobal(TUtf16CowString& text, wchar16 what, wchar16 with, size_t from = 0);
 size_t SubstGlobal(TUtf32CowString& text, wchar32 what, wchar32 with, size_t from = 0);
+/**@}*/
```

**File**: `library/cpp/getopt/small/last_getopt_opt.h` (modified, +1/-1)
```diff
@@ -549,7 +549,7 @@ namespace NLastGetopt {
          *
          * Note: this only works in zsh.
          *
-         * @param arg index of free arg
+         * @param index index of free arg
          */
         TOpt& IfPresentDisableCompletionForFreeArg(size_t index) {
             DisableCompletionForFreeArg_.push_back(index);
```

**File**: `library/cpp/getopt/small/last_getopt_opts.h` (modified, +10/-1)
```diff
@@ -221,6 +221,15 @@ namespace NLastGetopt {
             return GetLongOption(name);
         }
 
+        /// @}
+
+        /**
+         * Search for the option with given short name
+         * @param c        short name for search
+         * @return         ref on result (throw exception if not found)
+         */
+        /// @{
+
         const TOpt& GetOption(char c) const {
             return GetCharOption(c);
         }
@@ -434,7 +443,7 @@ namespace NLastGetopt {
         /**
          * Replace help string with given
          *
-         * @param decr        new help string
+         * @param descr     new help string
          */
         void SetCmdLineDescr(const TString& descr) {
             CustomCmdLineDescr = descr;
```

**File**: `library/cpp/html/entity/htmlentity.h` (modified, +7/-3)
```diff
@@ -54,14 +54,16 @@ size_t HtEntDecodeToChar(ECharset cp, const char* str, size_t len, wchar16* buff
  * @param dst      output buffer
  * @param dstlen   output buffer length
  * @param cpsrc    input buffer encoding, ascii-compatible
- * @param cpdst    output buffer encoding, if different from cpsrc
- * @return         src if no entities and encodings are the same (dst remains untouched)
- *                 NULL if dst was not sufficiently long
+ * @param cpdst    output buffer encoding, if different from @p cpsrc
+ * @return         @p src if no entities and encodings are the same (@p dst remains untouched)
+ *                 NULL if @p dst was not sufficiently long
  *                 dst-based output buffer with decoded string
  * @note           entities must be pure, with the terminating ";"
  */
+/**@{*/
 TStringBuf HtTryEntDecodeAsciiCompat(const TStringBuf& src, char* dst, size_t dstlen, ECharset cpsrc = CODES_UTF8);
 TStringBuf HtTryEntDecodeAsciiCompat(const TStringBuf& src, char* dst, size_t dstlen, ECharset cpsrc, ECharset cpdst);
+/**@}*/
 
 //! decodes HTML entities and converts non-ASCII characters to unicode, then converts unicode to UTF8 and percent-encodes
 //! @param text     zero-terminated text of link
@@ -72,8 +74,10 @@ TStringBuf HtTryEntDecodeAsciiCompat(const TStringBuf& src, char* dst, size_t ds
 //!       converted into unicode using code page object if it is passed to the function,
 //!       then unicode characters converted to UTF8 and percent-encoded,
 //!       percent-encoded text in the link copied into output buffer as is
+/**@{*/
 bool HtLinkDecode(const char* text, char* buffer, size_t buflen, size_t& written, ECharset cp = CODES_UNKNOWN);
 bool HtLinkDecode(const TStringBuf& text, char* buffer, size_t buflen, size_t& written, ECharset cp = CODES_UNKNOWN);
+/**@}*/
 
 static inline bool HtLinkDecode(const char* text, char* buffer, size_t buflen, ECharset cp = CODES_UNKNOWN) {
     size_t written;
```

**File**: `library/cpp/logger/log.h` (modified, +47/-44)
```diff
@@ -15,29 +15,29 @@
 
 using TLogFormatter = std::function<TString(ELogPriority priority, TStringBuf)>;
 
-// Logging facilities interface.
-//
-// ```cpp
-// TLog base;
-// ...
-// auto log = base;
-// log.SetFormatter([reqId](ELogPriority p, TStringBuf msg) {
-//     return TStringBuilder() << "reqid=" << reqId << "; " << msg;
-// });
-//
-// log.Write(TLOG_INFO, "begin");
-// HandleRequest(...);
-// log.Write(TLOG_INFO, "end");
-// ```
-//
-// Users are encouraged to copy `TLog` instance.
+/// Logging facilities interface.
+///
+/// @code
+/// TLog base;
+/// ...
+/// auto log = base;
+/// log.SetFormatter([reqId](ELogPriority p, TStringBuf msg) {
+///     return TStringBuilder() << "reqid=" << reqId << "; " << msg;
+/// });
+///
+/// log.Write(TLOG_INFO, "begin");
+/// HandleRequest(...);
+/// log.Write(TLOG_INFO, "end");
+/// @endcode
+///
+/// Users are encouraged to copy TLog instance.
 class TLog {
 public:
-    // Construct empty logger all writes will be spilled.
+    /// Construct empty logger all writes will be spilled.
     TLog();
-    // Construct file logger.
+    /// Construct file logger.
     TLog(const TString& fname, ELogPriority priority = LOG_MAX_PRIORITY);
-    // Construct any type of logger
+    /// Construct any type of logger
     TLog(THolder<TLogBackend> backend);
     TLog(std::unique_ptr<TLogBackend> backend);
 
@@ -47,53 +47,56 @@ class TLog {
     TLog& operator=(const TLog&);
     TLog& operator=(TLog&&);
 
-    // Change underlying backend.
-    // NOTE: not thread safe.
+    /// Change underlying backend.
+    /// @note: not thread safe.
+    /// @{
     void ResetBackend(THolder<TLogBackend> backend) noexcept;
     void ResetBackend(std::unique_ptr<TLogBackend> backend) noexcept;
-    // Reset underlying backend, `IsNullLog()` will return `true` after this call.
-    // NOTE: not thread safe.
+    /// @}
+
+    /// Reset underlying backend, IsNullLog() will return `true` after this call.
+    /// @note: not thread safe.
     THolder<TLogBackend> ReleaseBackend() noexcept;
-    // Check if underlying backend is defined and is not null.
-    // NOTE: not thread safe with respect to `ResetBackend` and `ReleaseBackend`.
     bool IsNullLog() const noexcept;
+    /// Check if underlying backend is defined and is not null.
+    /// @note: not thread safe with respect to ResetBackend() and ReleaseBackend().
     bool IsNotNullLog() const noexcept {
         return !IsNullLog();
     }
 
-    // Write message to the log.
-    //
-    // @param[in] priority          Message priority to use.
-    // @param[in] message           Message to write.
-    // @param[in] metaFlags         Message meta flags.
+    /// Write message to the log.
+    ///
+    /// @param[in] priority          Message priority to use.
+    /// @param[in] message           Message to write.
+    /// @param[in] metaFlags         Message meta flags.
     void Write(ELogPriority priority, TStringBuf message, TLogRecord::TMetaFlags metaFlags = {}) const;
-    // Write message to the log using `DefaultPriority()`.
+    /// Write message to the log using DefaultPriority().
     void Write(const char* data, size_t len, TLogRecord::TMetaFlags metaFlags = {}) const;
-    // Write message to the log, but pass the message in a c-style.
+    /// Write message to the log, but pass the message in a c-style.
     void Write(ELogPriority priority, const char* data, size_t len, TLogRecord::TMetaFlags metaFlags = {}) const;
 
-    // Write message to the log in a c-like printf style.
+    /// Write message to the log in a c-like printf style.
     void Y_PRINTF_FORMAT(3, 4) AddLog(ELogPriority priority, const char* format, ...) const;
-    // Write message to the log in a c-like printf style with `DefaultPriority()` priority.
+    /// Write message to the log in a c-like printf style with DefaultPriority() priority.
     void Y_PRINTF_FORMAT(2, 3) AddLog(const char* format, ...) const;
 
-    // Call `ReopenLog()` of the underlying backend.
+    
```

---

### Incident Patch 9: `638fdc98` (2026-09-29)
**Commit Message**: Per query IMemoryQuotaManager (#54196)

**File**: `ydb/core/kqp/compute_actor/kqp_compute_actor_factory.cpp` (modified, +7/-1)
```diff
@@ -4,6 +4,7 @@
 #include <ydb/core/base/appdata.h>
 #include <ydb/core/kqp/common/kqp_resolve.h>
 #include <ydb/core/kqp/node_service/kqp_node_state.h>
+#include <ydb/core/kqp/node_service/kqp_query_control_plane.h>
 #include <ydb/core/kqp/rm_service/kqp_resource_estimation.h>
 #include <ydb/core/kqp/tracing/kqp_task_rendering.h>
 
@@ -142,14 +143,19 @@ class TKqpCaFactory : public IKqpNodeComputeActorFactory {
             runtimeSettings.RlPath = args.RlPath;
         }
 
-        runtimeSettings.TerminateHandler = [state=args.State, txId=args.TxId, executerId=args.ExecuterId, taskId=args.Task->GetId()]
+        runtimeSettings.TerminateHandler = [state=args.State, query=args.QueryQuotaManager, initialMemoryLimit=args.InitialMemoryLimit,
+                txId=args.TxId, executerId=args.ExecuterId, taskId=args.Task->GetId()]
             (bool success, const NYql::TIssues& issues) {
                 YDB_LOG_DEBUG("Compute actor terminated",
                     {"problem", "finish_compute_actor"},
                     {"txId", txId},
                     {"taskId", taskId},
                     {"success", success},
                     {"message", issues.ToOneLineString()});
+                if (query) {
+                    // the task memory is freed by now, the task quota manager returns what it grew by when it dies
+                    query->FreeTasks(1, initialMemoryLimit);
+                }
                 if (state) {
                     state->OnTaskFinished(txId, executerId, taskId, success);
                 }
```

**File**: `ydb/core/kqp/compute_actor/kqp_compute_actor_factory.h` (modified, +5/-0)
```diff
@@ -15,6 +15,7 @@
 namespace NKikimr::NKqp {
     struct TKqpFederatedQuerySetup;
     class TNodeState;
+    class IQueryQuotaManager;
 }
 
 namespace NKikimr::NKqp::NComputeActor {
@@ -136,6 +137,10 @@ struct IKqpNodeComputeActorFactory {
 
         TComputeStagesWithScan* ComputesByStages = nullptr;
         std::shared_ptr<TNodeState> State = nullptr;
+        // the execution unit and the initial memory limit (external memory) of the task are returned to it when the
+        // compute actor terminates, see IQueryQuotaManager::FreeTasks
+        std::shared_ptr<IQueryQuotaManager> QueryQuotaManager;
+        ui64 InitialMemoryLimit = 0;
         TIntrusiveConstPtr<NACLib::TUserToken> UserToken;
         TString Database;
 
```

**File**: `ydb/core/kqp/executer_actor/kqp_executer_stats.cpp` (modified, +2/-0)
```diff
@@ -899,6 +899,7 @@ void TNodeExecutionStats::UpdateStats(const NYql::NDqProto::TEvNodeState& state)
         .InputInflightBytes = state.GetInputInflightBytes(),
         .OutputInflightBytes = state.GetOutputInflightBytes(),
         .LocalInflightBytes = state.GetLocalInflightBytes(),
+        .MemQueryAllocated = state.GetMemQueryAllocated(),
     });
 }
 
@@ -1740,6 +1741,7 @@ void TQueryExecutionStats::ExportExecStats(NYql::NDqProto::TDqExecutionStats& st
                         stats.SetInputInflightBytes((usage.InputInflightBytes + 512_KB) / 1_MB);
                         stats.SetOutputInflightBytes((usage.OutputInflightBytes + 512_KB) / 1_MB);
                         stats.SetLocalInflightBytes((usage.LocalInflightBytes + 512_KB) / 1_MB);
+                        stats.SetMemQueryAllocated((usage.MemQueryAllocated + 512_KB) / 1_MB);
                     }
                 }
             }
```

**File**: `ydb/core/kqp/executer_actor/kqp_executer_stats.h` (modified, +1/-0)
```diff
@@ -312,6 +312,7 @@ struct TGlobalMemoryUsage {
     ui64 InputInflightBytes = 0;
     ui64 OutputInflightBytes = 0;
     ui64 LocalInflightBytes = 0;
+    ui64 MemQueryAllocated = 0;
 };
 
 struct TNodeExecutionStats {
```

**File**: `ydb/core/kqp/executer_actor/kqp_executer_stats_ut.cpp` (modified, +15/-0)
```diff
@@ -116,6 +116,21 @@ Y_UNIT_TEST_SUITE(KqpExecuterStats) {
         UNIT_ASSERT_VALUES_EQUAL(stage.Nodes.at(7).Tasks, 1);
         UNIT_ASSERT_VALUES_EQUAL(stage.Nodes.at(7).Finished, 1);
     }
+
+    Y_UNIT_TEST(NodeStateMemQueryAllocated) {
+        TNodeExecutionStats node;
+        node.SetHistorySampleCount(32);
+
+        NYql::NDqProto::TEvNodeState state;
+        state.SetLocalInflightBytes(1_MB);
+        state.SetMemQueryAllocated(3_MB);
+        node.UpdateStats(state);
+
+        UNIT_ASSERT_VALUES_EQUAL(node.GlobalMemoryUsage.Value.LocalInflightBytes, 1_MB);
+        UNIT_ASSERT_VALUES_EQUAL(node.GlobalMemoryUsage.Value.MemQueryAllocated, 3_MB);
+        UNIT_ASSERT(!node.GlobalMemoryUsage.History.empty());
+        UNIT_ASSERT_VALUES_EQUAL(node.GlobalMemoryUsage.History.back().second.MemQueryAllocated, 3_MB);
+    }
 }
 
 } // namespace NKikimr::NKqp
```

---

### Incident Patch 10: `105fac1d` (2026-09-29)
**Commit Message**: Fix UDF UploadModule authentication through the gRPC request proxy (#54310)

**File**: `ydb/core/grpc_services/base/base.h` (modified, +45/-44)
```diff
@@ -886,10 +886,52 @@ struct TYdbGrpcMethodAccessorTraits {
     }
 };
 
+class TEvProxyRuntimeEvent
+    : public IRequestProxyCtx
+    , public TEventLocal<TEvProxyRuntimeEvent, TRpcServices::EvGrpcRuntimeRequest>
+{
+public:
+    const TMaybe<TString> GetSdkBuildInfo() const {
+        return GetPeerMetaValues(NYdb::YDB_SDK_BUILD_INFO_HEADER);
+    }
+
+    const TMaybe<TString> GetGrpcUserAgent() const {
+        return GetPeerMetaValues(NYdbGrpc::GRPC_USER_AGENT_HEADER);
+    }
+
+    virtual NRuntimeEvents::EType GetRuntimeEventType() {
+        return NRuntimeEvents::EType::COMMON;
+    }
+};
+
+template <NRuntimeEvents::EType RuntimeEventType = NRuntimeEvents::EType::COMMON>
+class TEvProxyRuntimeEventWithType : public TEvProxyRuntimeEvent {
+public:
+    NRuntimeEvents::EType GetRuntimeEventType() override {
+        return RuntimeEventType;
+    }
+};
+
+template <ui32 TRpcId, typename TDerived>
+class TEvProxyLegacyEvent
+    : public IRequestProxyCtx
+    , public TEventLocal<TDerived, TRpcId>
+{
+public:
+    const TMaybe<TString> GetSdkBuildInfo() const {
+        return GetPeerMetaValues(NYdb::YDB_SDK_BUILD_INFO_HEADER);
+    }
+
+    const TMaybe<TString> GetGrpcUserAgent() const {
+        return GetPeerMetaValues(NYdbGrpc::GRPC_USER_AGENT_HEADER);
+    }
+};
+
 template <ui32 TRpcId, typename TReq, typename TResp>
 class TGRpcRequestBiStreamWrapper
-    : public IRequestProxyCtx
-    , public TEventLocal<TGRpcRequestBiStreamWrapper<TRpcId, TReq, TResp>, TRpcId>
+    : public std::conditional_t<TRpcId == TRpcServices::EvGrpcRuntimeRequest,
+        TEvProxyRuntimeEvent,
+        TEvProxyLegacyEvent<TRpcId, TGRpcRequestBiStreamWrapper<TRpcId, TReq, TResp>>>
 {
 private:
     void ReplyWithYdbStatus(Ydb::StatusIds::StatusCode status) override {
@@ -940,7 +982,7 @@ class TGRpcRequestBiStreamWrapper
     NJaegerTracing::TRequestDiscriminator GetRequestDiscriminator() const override {
         return {
             .RequestType = AuxSettings.RequestType,
-            .Database = GetDatabaseName(),
+            .Database = this->GetDatabaseName(),
         };
     }
 
@@ -1231,47 +1273,6 @@ class TGrpcResponseSenderImpl : public IRequestOpCtx {
     }
 };
 
-class TEvProxyRuntimeEvent
-    : public IRequestProxyCtx
-    , public TEventLocal<TEvProxyRuntimeEvent, TRpcServices::EvGrpcRuntimeRequest>
-{
-public:
-    const TMaybe<TString> GetSdkBuildInfo() const {
-        return GetPeerMetaValues(NYdb::YDB_SDK_BUILD_INFO_HEADER);
-    }
-
-    const TMaybe<TString> GetGrpcUserAgent() const {
-        return GetPeerMetaValues(NYdbGrpc::GRPC_USER_AGENT_HEADER);
-    }
-
-    virtual NRuntimeEvents::EType GetRuntimeEventType() {
-        return NRuntimeEvents::EType::COMMON;
-    }
-};
-
-template <NRuntimeEvents::EType RuntimeEventType = NRuntimeEvents::EType::COMMON>
-class TEvProxyRuntimeEventWithType : public TEvProxyRuntimeEvent {
-public:
-    NRuntimeEvents::EType GetRuntimeEventType() override {
-        return RuntimeEventType;
-    }
-};
-
-template <ui32 TRpcId, typename TDerived>
-class TEvProxyLegacyEvent
-    : public IRequestProxyCtx
-    , public TEventLocal<TDerived, TRpcId>
-{
-public:
-    const TMaybe<TString> GetSdkBuildInfo() const {
-        return GetPeerMetaValues(NYdb::YDB_SDK_BUILD_INFO_HEADER);
-    }
-
-    const TMaybe<TString> GetGrpcUserAgent() const {
-        return GetPeerMetaValues(NYdbGrpc::GRPC_USER_AGENT_HEADER);
-    }
-};
-
 template <ui32 TRpcId, typename TReq, typename TResp, bool IsOperation, typename TDerived, NRuntimeEvents::EType RuntimeEventType = NRuntimeEvents::EType::COMMON, class TMethodAccessorTraits = TYdbGrpcMethodAccessorTraits<TReq, TResp, IsOperation>>
 class TGRpcRequestWrapperImpl
     : public std::conditional_t<IsOperation,
```

**File**: `ydb/core/grpc_services/rpc_calls.h` (modified, +1/-1)
```diff
@@ -122,7 +122,7 @@ template <ui32 TRpcId, typename TReq, typename TResp>
 void TGRpcRequestBiStreamWrapper<TRpcId, TReq, TResp>::RefreshToken(const TString& token, const TActorContext& ctx, TActorId id, NWilson::TTraceId traceId) {
     using TSelf = typename std::remove_pointer<decltype(this)>::type;
     using TRefreshToken = typename TRefreshTokenTypeForRequest<TSelf>::type;
-    RefreshTokenSendRequest(ctx, new TRefreshToken(token, GetDatabaseName().GetOrElse(""), GetPeerName(), GetTraceId().GetOrElse(""), id), std::move(traceId));
+    RefreshTokenSendRequest(ctx, new TRefreshToken(token, this->GetDatabaseName().GetOrElse(""), GetPeerName(), GetTraceId().GetOrElse(""), id), std::move(traceId));
 }
 
 template <ui32 TRpcId>
```

**File**: `ydb/core/grpc_services/service_udf.h` (modified, +15/-13)
```diff
@@ -1,6 +1,6 @@
 #pragma once
 
-#include <ydb/core/grpc_streaming/grpc_streaming.h>
+#include <ydb/core/grpc_services/base/base.h>
 #include <ydb/public/api/protos/ydb_udf.pb.h>
 
 #include <ydb/library/actors/core/actor.h>
@@ -18,18 +18,20 @@ void DoDeleteModuleRequest(std::unique_ptr<IRequestOpCtx> p, const IFacilityProv
 void DoListModulesRequest(std::unique_ptr<IRequestOpCtx> p, const IFacilityProvider& f);
 void DoDescribeModuleRequest(std::unique_ptr<IRequestOpCtx> p, const IFacilityProvider& f);
 
-using IUploadModuleStreamContext = NGRpcServer::IGRpcStreamingContext<
-    Ydb::Udf::UploadModuleChunk,
-    Ydb::Udf::UploadModuleResponse>;
-
-//! Serves one UploadModule stream. The actor is registered straight from the
-//! accept callback of the gRPC service instead of being routed through
-//! TGRpcRequestProxy, so it authenticates the caller itself through
-//! TEvRequestAuthAndCheck; the request enum the proxy dispatches on is closed
-//! and a new streaming method cannot join it.
-NActors::IActor* CreateUploadModuleStreamActor(
-    TIntrusivePtr<IUploadModuleStreamContext> context,
-    const NActors::TActorId& grpcRequestProxyId);
+template <>
+void FillYdbStatus(Ydb::Udf::UploadModuleResponse& response,
+    const NYql::TIssues& issues, Ydb::StatusIds::StatusCode status);
+
+// UploadModule uses runtime dispatch through the same request proxy as unary RPCs.
+class TEvUploadModuleRequest final
+    : public TGRpcRequestBiStreamWrapper<TRpcServices::EvGrpcRuntimeRequest,
+        Ydb::Udf::UploadModuleChunk, Ydb::Udf::UploadModuleResponse>
+{
+public:
+    using TGRpcRequestBiStreamWrapper::TGRpcRequestBiStreamWrapper;
+
+    void Pass(const IFacilityProvider& facility) override;
+};
 
 }
 }
```

**File**: `ydb/core/udf_api/common.cpp` (modified, +2/-3)
```diff
@@ -60,9 +60,8 @@ void ExecuteYqlAsSystem(
 
 bool IsDatabaseServedHere(const TString& databaseName, TString& error) {
     if (databaseName.empty()) {
-        // No database header at all: the caller gets the tenant of the node it
-        // reached, which is the only store this node has anyway.
-        return true;
+        error = "database name must not be empty";
+        return false;
     }
     const TString requested = CanonizePath(databaseName);
     const TString served = CanonizePath(AppData()->TenantName);
```

**File**: `ydb/core/udf_api/rpc_udf.cpp` (modified, +30/-43)
```diff
@@ -143,37 +143,39 @@ class TDescribeModuleRPC
 constexpr ui64 MaxModuleBodySize = 256ull * 1024 * 1024;
 
 class TUploadModuleStreamActor: public TActorBootstrapped<TUploadModuleStreamActor> {
-    using IContext = IUploadModuleStreamContext;
+    using IContext = TEvUploadModuleRequest::IStreamCtx;
 
 public:
     static constexpr NKikimrServices::TActivity::EType ActorActivityType() {
         return NKikimrServices::TActivity::GRPC_REQ;
     }
 
-    TUploadModuleStreamActor(TIntrusivePtr<IContext> context, const TActorId& grpcRequestProxyId)
+    TUploadModuleStreamActor(std::unique_ptr<TEvUploadModuleRequest> context)
         : Context_(std::move(context))
-        , GRpcRequestProxyId_(grpcRequestProxyId)
     {
     }
 
     void Bootstrap() {
         Become(&TUploadModuleStreamActor::StateWork);
         Context_->Attach(SelfId());
 
-        Database_ = ExtractDatabaseName(Context_->GetPeerMetaValues(NYdb::YDB_DATABASE_HEADER))
-            .GetOrElse(TString());
-        Send(GRpcRequestProxyId_, new TEvRequestAuthAndCheck(
-            Database_,
-            ExtractYdbToken(Context_->GetPeerMetaValues(NYdb::YDB_AUTH_TICKET_HEADER)),
-            SelfId(),
-            TAuditMode::Modifying(TAuditMode::TLogClassConfig::ClusterAdmin),
-            Context_->GetPeerName(),
-            TString()));
+        Database_ = Context_->GetDatabaseName().GetOrElse(TString());
+        TString error;
+        if (!NUdfApi::IsDatabaseServedHere(Database_, error)) {
+            Reply(Ydb::StatusIds::BAD_REQUEST, error);
+            return;
+        }
+
+        UserToken_ = Context_->GetInternalToken();
+        if (NUdfApi::CanDecideWithoutDatabaseOwner(UserToken_.Get())) {
+            Authorize(TString());
+            return;
+        }
+        Send(MakeSchemeCacheID(), NUdfApi::MakeDatabaseOwnerRequest(Database_));
     }
 
     STATEFN(StateWork) {
         switch (ev->GetTypeRewrite()) {
-            hFunc(TEvRequestAuthAndCheckResult, Handle);
             hFunc(TEvTxProxySchemeCache::TEvNavigateKeySetResult, Handle);
             hFunc(IContext::TEvReadFinished, Handle);
             hFunc(IContext::TEvNotifiedWhenDone, Handle);
@@ -184,29 +186,6 @@ class TUploadModuleStreamActor: public TActorBootstrapped<TUploadModuleStreamAct
     }
 
 private:
-    void Handle(TEvRequestAuthAndCheckResult::TPtr& ev) {
-        const auto* msg = ev->Get();
-        if (msg->Status != Ydb::StatusIds::SUCCESS) {
-            Reply(msg->Status, msg->Issues.ToOneLineString());
-            return;
-        }
-
-        TString error;
-        if (!NUdfApi::IsDatabaseServedHere(Database_, error)) {
-            Reply(Ydb::StatusIds::BAD_REQUEST, error);
-            return;
-        }
-
-        UserToken_ = msg->UserToken;
-        // With no database to resolve there is no owner and so no database
-        // administrator; only a cluster administrator can get through.
-        if (Database_.empty() || NUdfApi::CanDecideWithoutDatabaseOwner(UserToken_.Get())) {
-            Authorize(TString());
-            return;
-        }
-        Send(MakeSchemeCacheID(), NUdfApi::MakeDatabaseOwnerRequest(Database_));
-    }
-
     void Handle(TEvTxProxySchemeCache::TEvNavigateKeySetResult::TPtr& ev) {
         TString owner;
         if (!NUdfApi::ParseDatabaseOwner(*ev->Get()->Request, owner)) {
@@ -285,6 +264,8 @@ class TUploadModuleStreamActor: public TActorBootstrapped<TUploadModuleStreamAct
     }
 
     void Handle(IContext::TEvNotifiedWhenDone::TPtr&) {
+        Context_->AuditLogRequestEnd(Ydb::StatusIds::CANCELLED);
+        Context_->FinishSpan(Ydb::StatusIds::CANCELLED);
         PassAway();
     }
 
@@ -332,13 +313,12 @@ class TUploadModuleStreamActor: public TActorBootstrapped<TUploadModuleStreamAct
             NYql::IssueToMessage(NYql::TIssue(error), operation.add_issues());
         }
 
-        Context_->WriteAndFinish(std::move(response), grpc::Status::OK);
+        Context_->WriteAndFinish(std::move(response), status);
 
```

#### Recent Merged Pull Requests:
- **PR #54622** (2026-09-30): Update muted_ya (release-asan) in main (@ydbot)
- **PR #54618** (2026-09-30): Update muted_ya (release-asan) in main (@ydbot)
- **PR #54616** (2026-09-30): EXT-2594 Fix stale group info on storage nodes (@SammyVimes)
- **PR #54613** (2026-09-30): Disable retries in negative vector index test (@asmyasnikov)
- **PR #54611** (2026-09-30): ci: write ci_metrics.job_name as the GitHub job display name (@naspirato)
- **PR #54609** (2026-09-30): Update muted_ya (release-asan) in main (@ydbot)
- **PR #54602** (2026-09-30): Update muted_ya (release-asan) in main (@ydbot)
- **PR #54600** (2026-09-30): Update muted_ya (release-asan) in main (@ydbot)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
