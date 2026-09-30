# Forensic Learning Record (Deep Inspection): yugabyte/yugabyte-db

> **Canonical Artifact**: `07_PROJECT_LEARNING/yugabyte-yugabyte-db-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/yugabyte/yugabyte-db](https://github.com/yugabyte/yugabyte-db))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:33:42.913Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `yugabyte/yugabyte-db`
- **Description**: YugabyteDB - the cloud native distributed SQL database for mission-critical applications.
- **Primary Language / Ecosystem**: C
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 10567 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.agents/scripts/backport-commit.py`
```
#!/usr/bin/env python3
"""Backport a merged commit to one or more release branches.

Python rewrite of backport-commit.sh. Same CLI surface (flags, positional
arguments) and same exit-code contract:

    0  all branches succeeded; PR URLs printed on stdout
    1  pre-flight failure (bad args, dirty workspace, missing remote, ...)
    2  cherry-pick conflict OR lint failure on a task branch -- the user
       resolves / fixes lint, amends, and re-runs with `-x <branch>`

Invoked via the bash shim `.agents/scripts/backport-commit.sh`.

Env overrides:
    YB_BACKPORT     workspace dir; default $HOME/code/backport-ybdb
                    (created as a git worktree off this script's repo,
                    sharing .git so fetches don't duplicate the object DB)
    YB_GH_REPO      upstream owner/name; default yugabyte/yugabyte-db
    YB_GH_FORK      <owner>/<repo> of the fork; default <gh-user>/<repo>
    YB_FORK_URL     full URL of the fork; defaults to mirror upstream protocol
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
from pathlib import Path
from typing import NoReturn, Optional


# --- Process / git plumbing -------------------------------------------------

class CmdError(Exception):
    """A subprocess exited non-zero. .returncode and .output are populated."""
    def __init__(self, cmd, returncode, output, stderr):
        super().__init__(f"command failed (rc={returncode}): {shlex.join(cmd)}")
        self.cmd = cmd
        self.returncode = returncode
        self.output = output
        self.stderr = stderr


def run(cmd, *, cwd=None, check=True, env=None, input_=None):
    """Run a command. By default raises CmdError on non-zero exit.

    Returns CompletedProcess with .stdout / .stderr captured (text).
    """
    proc = subprocess.run(
        cmd, cwd=cwd, env=env, input=input_,
        capture_output=True, text=True,
    )
    if check and proc.returncode != 0:
        raise CmdError(cmd, proc.returncode, proc.stdout, proc.stderr)
    return proc


def git(*args, cwd=None, check=True):
    """Run `git <args>` and return stdout (stripped)."""
    return run(["git", *args], cwd=cwd, check=check).stdout.strip()


def git_ok(*args, cwd=None) -> bool:
    """True iff `git <args>` exits 0."""
    return run(["git", *args], cwd=cwd, check=False).returncode == 0


def gh_json(args, *, check=True):
    """Run `gh api <args>` and parse stdout as JSON. Returns None on failure."""
    proc = run(["gh", "api", *args], check=False)
    if proc.returncode != 0:
        if check:
            raise CmdError(["gh", "api", *args], proc.returncode, proc.stdout, proc.stderr)
        return None
    if not proc.stdout.strip():
        return None
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError:
        # `gh api` occasionally exits 0 with a plain-text body (e.g. for
        # endpoints that returned a 204 with a status line, or pre-flight
        # error pages from a proxy). Treat that the same as no data.
        return None


def info(msg: str) -> None:
    """Print a `==== ...` info line (matches the bash script's output style)."""
    print(f"==== {msg}", flush=True)


def warn(msg: str) -> None:
    print(f"WARN: {msg}", file=sys.stderr, flush=True)


def fail(msg: str, code: int = 1) -> NoReturn:
    print(f"ERROR: {msg}", file=sys.stderr, flush=True)
    sys.exit(code)


# --- Configuration ----------------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent
SCRIPT_REPO_ROOT = SCRIPT_DIR.parent.parent  # /<worktree>


def parse_args(argv):
    p = argparse.ArgumentParser(
        prog="backport-commit",
        description="Backport a merged commit to one or more release branches.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("-n", "--preview", action="store_true",
                   help="Prepare task branches but don't push or create PRs.")
    p.add_argument("-l", "--local", action="store_true",
                   help="Use the current workspace instead of creating a worktree.")
    p.add_argument("-r", "--reviewers", default=None,
                   help="Comma/space separated reviewer list. -r '' disables.")
    p.add_argument("-s", "--stable-limit", default=None,
                   help="Backport to all stable branches >= this branch.")
    p.add_argument("-x", "--accept-branch", action="append", default=[],
                   help="Skip cherry-pick on the given branch (already resolved).")
    p.add_argument("--keep-workspace", action="store_true",
                   help="On success, don't delete local task branches or remove "
                        "the worktree (default cleans up after PRs are created).")
    p.add_argument("commit", help="Commit SHA (>=7 hex chars).")
    p.add_argument("branches", nargs="*", help="Destination branches.")
    args = p.parse_args(argv)

    if not re.fullmatch(r"[0-9a-fA-F]{7,64}", args.commit):
        p.error(f"malformed commit ID: {args.commit!r} (expected 7+ hex chars)")
    if args.stable_limit and args.branches:
        p.error("cannot mix -s / --stable-limit with positional branches")
    return args


def normalize_reviewers(s: Optional[str]) -> Optional[str]:
    """Accept space- or comma-separated, return comma-separated trimmed.

    Returns None if input is None (no -r given). Returns "" if input was -r ''
    (explicit disable).
    """
    if s is None:
        return None
    parts = [p for p in re.split(r"[ ,]+", s) if p]
    return ",".join(parts)


# --- Workspace + remote detection -------------------------------------------

def setup_workspace(workspace: Path, use_local: bool) -> bool:
    """Set up workspace and cd into it.

    For a fresh path, creates a git worktree off SCRIPT_REPO_ROOT (the
    repo containing this script). The worktree shares .git with the
    source repo, so the object database isn't duplicated and fetched
    refs are visible across worktrees. An existing path is reused
    as-is, whether it's a worktree, a clone, or a plain checkout --
    we trust it as long as it's a valid git working directory.

    Returns True iff this call created the worktree (so post-run cleanup
    can safely remove it without clobbering a pre-existing checkout).
    """
    created = False
    if use_local:
        info(f"Using current workspace: {workspace}")
    elif workspace.exists():
        if not git_ok("rev-parse", "--is-inside-work-tree", cwd=workspace):
            fail(f"workspace path exists but is not a git working tree: "
                 f"{workspace}. Remove it (or set YB_BACKPORT to a fresh "
                 f"path) and re-run.")
        info(f"Using workspace: {workspace}")
    else:
        info(f"Creating worktree: {workspace} (from {SCRIPT_REPO_ROOT})")
        workspace.parent.mkdir(parents=True, exist_ok=True)
        run(["git", "-C", str(SCRIPT_REPO_ROOT), "worktree", "add",
             "--detach", str(workspace)])
        created = True

    os.chdir(workspace)
    return created


def detect_upstream_remote(gh_repo: str) -> str:
    """Find the git remote whose URL points at $gh_repo."""
    override = os.environ.get("UPSTREAM_REMOTE")
    if override:
        return override
    remotes = git("remote").splitlines()
    for r in remotes:
        if not r:
            continue
        url = git("remote", "get-url", r, check=False)
        if gh_repo in url:
            return r
    fail(f"no git remote points at {gh_repo}; "
         f"add one with: git remote add upstream git@github.com:{gh_repo}.git")


def check_clean_tree() -> None:
    """Refuse to run if there are tracked-file changes (untracked is fine)."""
    porcelain = git("status", "--porcelain")
    dirty = [line for line in porcelain.splitlines() if not line.startswith("??")]
    if dirty:
        fail("workspace has uncommitted tracked changes; "
             "stash or commit first
```

### Core Architecture Module: `.ycm_extra_conf.py`
```
# This is free and unencumbered software released into the public domain.
#
# Anyone is free to copy, modify, publish, use, compile, sell, or
# distribute this software, either in source code form or as a compiled
# binary, for any purpose, commercial or non-commercial, and by any
# means.
#
# In jurisdictions that recognize copyright laws, the author or authors
# of this software dedicate any and all copyright interest in the
# software to the public domain. We make this dedication for the benefit
# of the public at large and to the detriment of our heirs and
# successors. We intend this dedication to be an overt act of
# relinquishment in perpetuity of all present and future rights to this
# software under copyright law.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
# EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
# MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
# IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR
# OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
# ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
# OTHER DEALINGS IN THE SOFTWARE.
#
# For more information, please refer to <http://unlicense.org/>

# This is a configuration file for YouCompleteMe (YCM), a Vim extension for
# navigation and code completion with C++ and other languages.
#
# To make YCM work with YB, add your YB source directory to the
# g:ycm_extra_conf_globlist variable in your .vimrc file. For details on how to
# install and configure YouCompleteMe, see
# https://github.com/Valloric/YouCompleteMe
#
# This file is based on the example configuration file from YouCompleteMe.

import os
import ycm_core

# These are the compilation flags that will be used in case there's no
# compilation database set (by default, one is not set).
# CHANGE THIS LIST OF FLAGS. YES, THIS IS THE DROID YOU HAVE BEEN LOOKING FOR.
flags = [
    '-x',
    'c++',
    '-DYB_HEADERS_NO_STUBS=1',
    '-Dintegration_tests_EXPORTS',
    '-D__STDC_FORMAT_MACROS',
    '-fno-strict-aliasing',
    '-msse4.2',
    '-Wall',
    '-Wno-sign-compare',
    '-Wno-deprecated',
    '-pthread',
    '-ggdb',
    '-Qunused-arguments',
    '-Wno-ambiguous-member-template',
    '-std=c++11',
    '-g',
    '-fPIC',
    '-I', 'src',
    '-I', 'src/rocksdb',
    '-I', 'src/rocksdb/include',
    '-I', 'src/postgres/src/include',
    '-I', 'build/latest/src',
    '-I', 'build/latest/src',
    '-isystem', 'thirdparty/installed/common/include',
    '-isystem', 'thirdparty/installed/uninstrumented/include',
]

# Set this to the absolute path to the folder (NOT the file!) containing the
# compile_commands.json file to use that instead of 'flags'. See here for
# more details: http://clang.llvm.org/docs/JSONCompilationDatabase.html
#
# You can get CMake to generate this file for you by adding:
#   set( CMAKE_EXPORT_COMPILE_COMMANDS 1 )
# to your CMakeLists.txt file.
#
# Most projects will NOT need to set this to anything; you can just change the
# 'flags' list of compilation flags. Notice that YCM itself uses that approach.
compilation_database_folder = ''

if os.path.exists( compilation_database_folder ):
  database = ycm_core.CompilationDatabase( compilation_database_folder )
else:
  database = None

SOURCE_EXTENSIONS = [ '.cpp', '.cxx', '.cc', '.c', '.m', '.mm' ]

def DirectoryOfThisScript():
  return os.path.dirname( os.path.abspath( __file__ ) )


def MakeRelativePathsInFlagsAbsolute( flags, working_directory ):
  if not working_directory:
    return list( flags )
  new_flags = []
  make_next_absolute = False
  path_flags = [ '-isystem', '-I', '-iquote', '--sysroot=' ]
  for flag in flags:
    new_flag = flag

    if make_next_absolute:
      make_next_absolute = False
      if not flag.startswith( '/' ):
        new_flag = os.path.join( working_directory, flag )

    for path_flag in path_flags:
      if flag == path_flag:
        make_next_absolute = True
        break

      if flag.startswith( path_flag ):
        path = flag[ len( path_flag ): ]
        new_flag = path_flag + os.path.join( working_directory, path )
        break

    if new_flag:
      new_flags.append( new_flag )
  return new_flags


def IsHeaderFile( filename ):
  extension = os.path.splitext( filename )[ 1 ]
  return extension in [ '.h', '.hxx', '.hpp', '.hh' ]


def GetCompilationInfoForFile( filename ):
  # The compilation_commands.json file generated by CMake does not have entries
  # for header files. So we do our best by asking the db for flags for a
  # corresponding source file, if any. If one exists, the flags for that file
  # should be good enough.
  if IsHeaderFile( filename ):
    basename = os.path.splitext( filename )[ 0 ]
    for extension in SOURCE_EXTENSIONS:
      replacement_file = basename + extension
      if os.path.exists( replacement_file ):
        compilation_info = database.GetCompilationInfoForFile(
          replacement_file )
        if compilation_info.compiler_flags_:
          return compilation_info
    return None
  return database.GetCompilationInfoForFile( filename )


def FlagsForFile( filename, **kwargs ):
  if database:
    # Bear in mind that compilation_info.compiler_flags_ does NOT return a
    # python list, but a "list-like" StringVec object
    compilation_info = GetCompilationInfoForFile( filename )
    if not compilation_info:
      return None

    final_flags = MakeRelativePathsInFlagsAbsolute(
      compilation_info.compiler_flags_,
      compilation_info.compiler_working_dir_ )

  else:
    relative_to = DirectoryOfThisScript()
    final_flags = MakeRelativePathsInFlagsAbsolute( flags, relative_to )

  return {
    'flags': final_flags,
    'do_cache': True
  }

```

### Core Architecture Module: `arcanist_util/check-diff-name.py`
```
#!/usr/bin/env python3

import os
import re
import argparse

from subprocess import check_output


DIFF_NAME_RE = re.compile(
    r'(?P<backport>\[BACKPORT [0-9\.\-]+\])?\[(?P<issues>(#[0-9]+, )*#[0-9]+)\] '
    r'(?P<area>[\w,\s]+): (?P<description>.{10,100})$')

# Tests - correct and incorrect samples
CORRECT_NAMES = {
    "multiple issue numbers": "[#1234, #1235] area: Ideally short title",
    "one issue and one backport": "[BACKPORT 2.2-1][#1235] area: Ideally short title",
    "one issue, no backports": "[#1235] area: Ideally short title",
    "different issue numbers": "[BACKPORT 2.2-1][#1235, #1, #10292012] area: Ideally short title",
    "complex area":
        "[BACKPORT 2.2-1][#1235] area of, probably, some 1 Interest: Ideally short title"
}

for reason, cname in CORRECT_NAMES.items():
    assert DIFF_NAME_RE.match(cname), \
        f"New DIFF_NAME_RE doesn't match on '{cname}' which has '{reason}'"

INCORRECT_NAMES = {
    "more than one backport in one diff":
        "[BACKPORT 2.1][BACKPORT 2.2-1][#1235, #1, #10292012] area: Ideally short title",
    "illegal literal in build number for backport":
        "[BACKPORT 2.2-b1][#1235, #1, #10292012] area: Ideally short title",
    "wrong issues list (trailing comma)":
        "[BACKPORT 2.2-1][#1235, #1, #10292012,] area: Ideally short title",
    "wrong issue number (comma)":
        "[BACKPORT 2.2-1][#1,235, #1, #10292012] area: Ideally short title",
    "wrong issues list (leading comma)":
        "[BACKPORT 2.2-1][,#1235, #1, #10292012] area: Ideally short title",
    "wrong issue number (dash)":
        "[BACKPORT 2.2-1][#12-5, #b1, #1029?2012] area: Ideally short title",
    "too short title":
        "[BACKPORT 2.2-1][#1235, #1, #10292012] area: Ideally s",
    "too long title":
        "[BACKPORT 2.2-1][#1235, #1, #10292012] area: Ideally short title Ideally short title "
        "Ideally short title Ideally short title Ideally short title ..."
}

for reason, iname in INCORRECT_NAMES.items():
    assert not DIFF_NAME_RE.match(iname), \
        f"New DIFF_NAME_RE doesn't warn on '{iname}' which has '{reason}'"

parser = argparse.ArgumentParser(
    description="Tool to check Phabricator diff name of current working copy (CWD)")
parser.add_argument('--base', '-b', action='store_true',
                    help='Use master branch as merge base to detect diff (for arc which call)')
parser.add_argument('--repository', '-r', default=os.path.dirname(__file__),
                    help='What repository to inspect')

args = parser.parse_args()

arc_which_cmd = ['arc', 'which']
if args.base:
    arc_which_cmd += ['--base', 'git:merge-base(origin/master)']
arc_which_cmd += ['--']  # end of options marker required
arc_which_out = check_output(arc_which_cmd, cwd=args.repository).decode('utf-8')
diff_descs = re.findall('D[0-9]+.*', arc_which_out)
if diff_descs:
    for diff_desc in diff_descs:
        diff_id, diff_name = re.search('(D[0-9]+) (.*)', diff_desc).groups()
        parsed_diff_name = DIFF_NAME_RE.match(diff_name)
        if parsed_diff_name:
            print(f"ok: Diff {diff_id} has correct name")
        else:
            print(f"error: Diff {diff_id} name "
                  f"should fit '{DIFF_NAME_RE.pattern}' but it is '{diff_name}'")
else:
    print("advice: No diffs were found, time to create one ?")

```

### Core Architecture Module: `bin/parse_contention.py`
```
#! /bin/python

import os
import re
import sys


class Stats():
    def __init__(self):
        self.total_time = 0
        self.counts = 0
        self.stack_traces = []
        self.started = False
        self.ended = False

    def cost(self):
        return self.total_time / self.counts

    def _relevant_trace(self):
        return self.stack_traces[1] if len(self.stack_traces) > 2 else None

    def process_line(self, line):
        if self.ended:
            return
        if "---" in line:
            self.ended = True
            return
        result = re.match("^([0-9]+)\s+([0-9]+)\s+@.*$", line)
        if result:
            self.total_time = int(result.group(1))
            self.counts = int(result.group(2))
            self.started = True
            return
        if self.started:
            self.stack_traces.append(line.strip('\n'))


def process_stats(stats):
    stats = [s for s in stats if s._relevant_trace()]
    stats = sorted(stats, key=lambda s: s.cost(), reverse=True)
    for s in stats:
        print("Cost: {:<20}\nTotal time: {:<20}\nNumber of calls: {:<20}\n{}".format(
              s.cost(), s.total_time, s.counts, "\n".join(s.stack_traces)))


def main():
    if len(sys.argv) != 2:
        print("Usage: {} <contention.txt>".format(sys.argv[0]))
        sys.exit(1)
    stats = []
    with open(sys.argv[1], "rb") as f:
        s = Stats()
        while True:
            line = f.readline()
            if not line:
                break
            s.process_line(line)
            if s.ended:
                stats.append(s)
                s = Stats()
        if s.started:
            stats.append(s)
    process_stats(stats)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `bin/remote_release.py`
```
#!/usr/bin/env python3

#
# Copyright (c) YugabyteDB, Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
# in compliance with the License.  You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distributed under the License
# is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
# or implied.  See the License for the specific language governing permissions and limitations
# under the License.
#

import argparse
import os
import sys
import shlex

# TODO: do not modify system path like this, create a wrapper script instead.
sys.path.insert(0, os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'python'))  # noqa

from yugabyte import remote


def main() -> None:
    parser = argparse.ArgumentParser(prog=sys.argv[0])
    parser.add_argument('--build-args', type=str, default=None,
                        help='build arguments to pass')
    remote.add_common_args(parser)

    args = parser.parse_args()

    remote.load_profile(args, args.profile)
    remote.apply_default_arg_values(args)
    remote.log_args(args)

    os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

    escaped_remote_path = remote.sync_changes_with_args(args)

    if args.skip_build:
        sys.exit(0)

    remote_args = []
    if args.build_type is not None:
        remote_args.append("--build={}".format(args.build_type))
    remote_args.append("--force")
    if args.build_args is not None:
        remote_args.append("--build_args=\"{}\"".format(args.build_args))

    remote.exec_command(
        host=args.host,
        escaped_remote_path=escaped_remote_path,
        script_name='yb_release',
        script_args=remote_args,
        should_quote_args=False,
        extra_ssh_args=remote.process_extra_ssh_args(args.extra_ssh_args))


if __name__ == '__main__':
    main()

```

### Core Architecture Module: `bin/yb-check-consistency.py`
```
#!/usr/bin/env python

import argparse
import glob
import subprocess


LDB_PATH = "/home/yugabyte/tserver/bin/ldb"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--fs_data_dirs', type=str, help="Path to data directories")
    parser.add_argument('--ldb_path', type=str, default=LDB_PATH, help="Path to ldb binary")
    args = parser.parse_args()
    for d in args.fs_data_dirs.split(","):
        print("Checking dir: {}".format(d))
        paths = glob.glob("{}/yb-data/tserver/data/rocksdb/table-*/tablet-*".format(d))
        for p in paths:
            # Ignore snapshots.
            if p.endswith("snapshots"):
                continue
            cmd_list = [args.ldb_path, "--db={}".format(p), "checkconsistency"]
            proc = subprocess.Popen(cmd_list, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            stdout, stderr = proc.communicate()
            if proc.returncode != 0:
                print(stderr)
            else:
                print("OK -- {}".format(p))


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `bin/yb-prof.py`
```
#!/usr/bin/env python3

#
# Copyright (c) YugabyteDB, Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
# in compliance with the License.  You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distributed under the License
# is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
# or implied.  See the License for the specific language governing permissions and limitations
# under the License.
#
import getopt
import os
import re
import subprocess
import sys


class YBProf:
    file_prefix_ = ""

    total_in_use_count_ = 0
    total_in_use_bytes_ = 0
    total_alloc_count_ = 0
    total_alloc_bytes_ = 0
    records_ = []
    symbols_ = {}

    def __init__(self, output_prefix, pprof_url, seconds):
        self.file_prefix_ = output_prefix
        self.pprof_url_ = pprof_url
        self.seconds_ = seconds

    def parse_header_line(self, line):
        print('header: %s' % line)
        m = re.match(r"heap profile: *(\d+): *(\d+) *\[ *(\d+): *(\d+)\]", line)
        if m:
            self.total_in_use_count_ = int(m.group(1))
            self.total_in_use_bytes_ = int(m.group(2))
            self.total_alloc_count_ = int(m.group(3))
            self.total_alloc_bytes_ = int(m.group(4))
        else:
            print("Unexpected header format: %s" % line)

    def parse_stack_line(self, line):
        # print('body: %s' % line)
        m = re.match(r" *(\d+): *(\d+) *\[ *(\d+): *(\d+)\] \@ (.*)\n", line)
        if m:
            in_use_count = int(m.group(1))
            in_use_bytes = int(m.group(2))
            alloc_count = int(m.group(3))
            alloc_bytes = int(m.group(4))
            stack = m.group(5)
            functions = re.split(" ", stack)

            # Add to a set of function addresses that we will symbolize later.
            for f in functions:
                self.symbols_[f] = ""

            # Remember this record (the call stack and associated counters).
            self.records_.append({"in_use_count": in_use_count,
                                  "in_use_bytes": in_use_bytes,
                                  "alloc_count": alloc_count,
                                  "alloc_bytes": alloc_bytes,
                                  "stack": functions})
        else:
            print("Unexpected format in line: %s" % line)

    def invoke_heap_profile_handler(self):
        heap_profile_url = self.pprof_url_ + "/heap?seconds=" + str(self.seconds_)
        raw_output_file = self.file_prefix_ + ".raw.txt"
        print("Invoking heap profile handler: " + heap_profile_url)
        output_fhd = open(raw_output_file, "w")
        result = subprocess.call(["curl", heap_profile_url], stdout=output_fhd)
        print("Raw output: " + raw_output_file)
        self.parse_heap_file(raw_output_file)

    def symbolize_all(self):
        print("Total Symbols " + str(len(self.symbols_)) + " symbols...")

        # Symbolize the above symbols few at a time.
        chunk_of_symbols = []
        cnt = 0
        for key in self.symbols_.keys():
            chunk_of_symbols.append(key)
            cnt = cnt + 1
            if (len(chunk_of_symbols) == 25):
                self.symbolize(chunk_of_symbols)
                chunk_of_symbols = []
                print("Completed symbolizing %d/%d symbols." % (cnt, len(self.symbols_)))

        if (len(chunk_of_symbols) > 0):
            self.symbolize(chunk_of_symbols)

    def symbolize(self, symbols):
        arg = "+".join(symbols)
        result = subprocess.check_output(
          ["curl",
           "--silent",
           "-d",
           arg,
           self.pprof_url_ + "/symbol"])
        lines = result.decode().split("\n")
        for line in lines:
            # Use whitespace as the delimiter, and produce no more than two parts
            # (i.e. max of 1 split). The symbolized function name may itself contain
            # spaces. A few examples below (the latter two are example with spaces
            # in the name of the function).
            #
            # 0x7fff950fcd23  std::__1::basic_string<>::append()
            # 0x7fff950f943e  operator new()
            # 0x102296ceb     yb::tserver::(anonymous namespace)::SetLastRow()
            parts = line.split(None, 1)
            num_parts = len(parts)
            if num_parts == 0:
                continue
            elif num_parts == 2:
                addr = parts[0]
                symbol = parts[1]
                self.symbols_[addr] = symbol
            else:
                print("Unexpected output line: " + line)

    def print_records(self, sort_metric, filename):
        max_call_stacks = 1000
        idx = 0
        print("Writing output to " + filename)
        fhd = open(filename, "w")
        fhd.write("<html>\n")
        fhd.write("<title>Top Call Stacks By: " + sort_metric + "</title>\n")
        fhd.write("<body style=\"font-family: sans-serif\">\n")
        fhd.write("<b>Top " + str(max_call_stacks) + " Call Stacks By: " + sort_metric + "</b>\n")
        fhd.write("<p>\n")
        fhd.write("<table style=\"border-collapse: collapse\" border=1 cellpadding=5>\n")
        fhd.write("<tr>\n")
        fhd.write("<th>In Use Cnt</th>\n")
        fhd.write("<th>In Use Bytes</th>\n")
        fhd.write("<th>In Use Avg Size</th>\n")
        fhd.write("<th>Alloc Cnt</th>\n")
        fhd.write("<th>Alloc Bytes</th>\n")
        fhd.write("<th>Alloc Avg Size</th>\n")
        fhd.write("<th>Call Stack</th>\n")
        fhd.write("</tr>\n")
        sorted_records = sorted(self.records_, key=lambda k: k[sort_metric], reverse=True)
        for record in sorted_records:
            if (idx == max_call_stacks):
                break
            idx = idx + 1
            functions = []
            for addr in record.get("stack"):
                fname = self.symbols_[addr]
                # If the symbolization didn't happen for some reason,
                # print the address itself for the function name.
                if fname == "":
                    fname = addr
                functions.append(fname)

            fhd.write("<tr>\n")

            in_use_count = record.get("in_use_count")
            in_use_bytes = record.get("in_use_bytes")
            in_use_avg = 0 if in_use_count == 0 else in_use_bytes * 1.0 / in_use_count
            alloc_count = record.get("alloc_count")
            alloc_bytes = record.get("alloc_bytes")
            alloc_avg = 0 if alloc_count == 0 else alloc_bytes * 1.0 / alloc_count
            stack = "\n".join(functions)

            fhd.write(("<td>%d</td><td>%d</td><td>%.2f</td><td>%d</td>" +
                       "<td>%d</td><td>%.2f</td><td><pre>%s</pre></td>") %
                      (in_use_count, in_use_bytes, in_use_avg,
                       alloc_count, alloc_bytes, alloc_avg,
                       stack))

            fhd.write("</tr>\n")
        fhd.write("</table>")
        fhd.write("</body>")
        fhd.write("</html>\n")
        fhd.close()

    def parse_heap_file(self, filename):
        line_num = 0
        with open(filename) as f:
            for line in f:
                line_num = line_num + 1
                if line_num == 1:
                    self.parse_header_line(line)
                elif line == "\n":
                    continue
                elif line == "MAPPED_LIBRARIES:\n":
                    print("End of stacks...")
                    break
                else:
                    self.parse_stack_line(line)
        self.symbolize_all()
        self.print_records("in_use_bytes", self.file_prefix_ + ".in_use_bytes.html")
        self.print_records("alloc_bytes", self.file_prefix_ + ".alloc_bytes.html")


def print_usage():
    print("Usage:")
    print('yb-prof.py --profile_url=<url> --output_file_prefix=<file_prefix> ' +
          '--seconds=<t
```

### Core Architecture Module: `bin/ybcontrol.py`
```
#!/usr/bin/env python2
#
# Copyright (c) YugabyteDB, Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
# in compliance with the License.  You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distributed under the License
# is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
# or implied.  See the License for the specific language governing permissions and limitations
# under the License.
#
import argparse
import os
import pipes
import platform
import re
import subprocess
import sys
import time

VERSION_STRING_RE = "^\d+\.\d+\.\d+\.\d+$"
YB_HOME_DIR = "/home/yugabyte"
YB_SOFTWARE_DIR = "/home/yugabyte/yb-software"
YB_SOFTWARE_TEMP_DIR = "/home/yugabyte/yb-software/TEMPORARY"


def list_command(service):
    return "ps auxww | grep [y]b-{0} | grep -v bash".format(service)


def service_command(service, command):
    return "{0}/bin/yb-server-ctl.sh {1} {2}".format(YB_HOME_DIR, service, command)


def stop_command(service):
    return service_command(service, 'stop')


def parse_hosts(inp):
    if isinstance(inp, list):
        result = []
        for item in inp:
            result += parse_hosts(item)
        return result
    else:
        return [host for host in inp.split(' ') if len(host) > 0]


class ClusterManager(object):
    def __init__(self, args):
        self.master_ips = ClusterManager.get_arg(args, 'master_ips')
        self.tserver_ips = ClusterManager.get_arg(args, 'tserver_ips')
        default_pem = os.path.join(os.environ["HOME"], ".yugabyte/no-such-key.pem")
        self.pem_file = ClusterManager.get_arg(args, 'pem_file', default_pem)
        self.user = ClusterManager.get_arg(args, 'user', 'yugabyte')
        self.repo = ClusterManager.get_arg(args, 'repo',
                                           os.path.join(os.environ["HOME"], 'code/yugabyte'))
        self.version_string = file("version.txt").read().strip().split("-")[0]
        if not re.match(VERSION_STRING_RE, self.version_string):
            raise ValueError("Invalid version format {}".format(self.version_string))
        default_tar_prefix = "yugabyte-ee-{0}-{1}-release-{2}-{3}".format(
            self.version_string,
            subprocess.check_output(['git', 'rev-parse', 'HEAD']).strip(),
            platform.linux_distribution(full_distribution_name=False)[0].lower(),
            platform.machine().lower())
        self.tar_prefix = ClusterManager.get_arg(args, 'tar_prefix', default_tar_prefix)
        self.port = ClusterManager.get_arg(args, 'port', 54422)

        self.master_hosts = parse_hosts(self.master_ips)
        self.tserver_hosts = parse_hosts(self.tserver_ips)
        self.all_hosts = list(set(self.master_hosts + self.tserver_hosts))

    @staticmethod
    def setup_parser(parser):
        parser.add_argument('--pem_file',
                            nargs='?',
                            help='name of the pem file')
        parser.add_argument('--master_ips',
                            nargs='?',
                            help="space separated IP of masters (e.g., '10.a.b.c 10.d.e.f')")
        parser.add_argument('--tserver_ips',
                            nargs='?',
                            help="space separated IP of tservers (e.g., '10.a.b.c 10.d.e.f')")
        parser.add_argument('--repo',
                            nargs='?',
                            help="repository base used to pick up TAR file")
        parser.add_argument('--tar_prefix',
                            nargs='?',
                            help="tar file prefix (e.g., "
                                 "yugabyte.2bdf48724db5869d0c88c85e0fa65e9ac3a21511-release)")
        parser.add_argument('--port', type=int, nargs='?', help="ssh port")
        parser.add_argument('--user', nargs='?', help='remote user to ssh or scp as')

    def service_hosts(self, service):
        return getattr(self, service + "_hosts")

    def remote_launch(self, host, command):
        command_args = ['ssh',
                        '-o',
                        'stricthostkeychecking=no',
                        '-i',
                        self.pem_file,
                        '-p',
                        str(self.port),
                        '{0}@{1}'.format(self.user, host),
                        command]
        return subprocess.Popen(command_args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)

    def scp(self, source, destination):
        command_args = [
            'scp',
            '-o',
            'stricthostkeychecking=no',
            '-i',
            self.pem_file,
            '-P',
            str(self.port),
            source,
            destination]
        return subprocess.Popen(command_args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)

    @staticmethod
    def get_arg(args, key, default=None):
        if not hasattr(args, key) or getattr(args, key) is None:
            if default is None:
                error('Please specify: {0}'.format(key))
            else:
                return default
        return getattr(args, key)

    def launch_simple(self, hosts, command, title):
        return [SimpleProcedure(self, host, command, title) for host in hosts]

    def launch_at_service(self, service, command, title):
        return self.launch_simple(self.service_hosts(service), command, title)

    def execute_service_commands(self, services, commands, timeout):
        procedures = []
        for service in services:
            for command in commands:
                procedures += self.launch_simple(self.service_hosts(service),
                                                 service_command(service, command),
                                                 "Perform {0} {1}".format(service, command))
        show_output(procedures, timeout)

    def execute_everywhere(self, command, timeout):
        show_output(self.launch_simple(self.all_hosts, command, '`{0}`'.format(command)), timeout)


help_printer = None


def error(message, print_help=True):
    global help_printer
    sys.stderr.write(message + "\n")
    if print_help and help_printer:
        help_printer()
    sys.exit(1)


def print_output(process, title, host=None):
    if host is not None:
        title = '{0} at {1}'.format(title, host)
    print("================= {0} =================".format(title))
    for line in process.stdout.readlines():
        sys.stdout.write(line.decode('utf-8'))


class Procedure:
    def check(self):
        pass

    def describe(self):
        pass


class SimpleProcedure(Procedure):
    def __init__(self, manager, host, command, title):
        self.process = manager.remote_launch(host, command)
        self.title = title
        self.host = host
        self.return_code = None

    def check(self):
        if self.return_code is None and self.process.poll() is not None:
            self.return_code = self.process.returncode
            print_output(self.process, self.title, self.host)
        return self.return_code is not None

    def describe(self):
        return "{0} at {1}".format(self.title, self.host)


class CopyProcedure(Procedure):
    def __init__(self, manager, upload, host, src_path, dst_path):
        if upload:
            self.src_path = src_path
            self.dst_path = '{0}@{1}:{2}'.format(manager.user, host, dst_path)
        else:
            self.src_path = '{0}@{1}:{2}'.format(manager.user, host, src_path)
            self.dst_path = '{0}.{1}'.format(dst_path, host)
        self.process = manager.scp(self.src_path, self.dst_path)
        self.host = host
        self.return_code = None

    def check(self):
        if self.return_code is None and self.process.poll() is not None:
            self.return_code = self.process.returncode
            print_output(self.process, self.describe())
        return self.return_cod
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #34463** (2026-09-30): **[#34361] docdb: Update cache statistics outside of mutex lock**
  *Symptoms*: Summary: We currently increment cache statistics and metrics under mutex lock. But there is no need to do this under lock, since they are atomics (or thread-local integers for the RPC aggregated case), and there are no expectations of the values being precisely synchronized with cache internals.  This revision moves statistics/metrics update outside of the mutex lock for LRUCache::Lookup and LRUCache::Insert.  Test Plan: Jenkins  Differential Revision: https://phorge.dev.yugabyte.com/D58643  <!-- Reviewable:start --> - - - This change is [<img src="https://reviewable.io/review_button.svg" height="34" align="absmiddle" alt="Reviewable"/>](https://reviewable.io/reviews/yugabyte/yugabyte-db/34463) <!-- Reviewable:end --> 

- **Issue #34448** (2026-09-30): **[YSQL] Full-PK UPDATE on a partition with reordered columns stores NULL**
  *Symptoms*: Jira Link: [DB-23951](https://yugabyte.atlassian.net/browse/DB-23951) ### Description  Repro :  ``` CREATE TABLE a2 (k int PRIMARY KEY, b text, c int) PARTITION BY RANGE (k); CREATE TABLE a2_p1 (c int, b text, k int NOT NULL); ALTER TABLE a2 ATTACH PARTITION a2_p1 FOR VALUES FROM (0) TO (100); INSERT INTO a2 VALUES (1,'one',10); UPDATE a2 SET b = 'uno', c = 99 WHERE k = 1; SELECT * FROM a2; ```  ``` YB # SELECT * FROM a2;  k |  b  | c ---+-----+---  1 | uno | (1 row ```)  ### Issue Type  kind/bug  ### Warning: Please confirm that this issue does not contain any sensitive information  - [x] I confirm this issue does not contain any sensitive information.  [DB-23951]: https://yugabyte.atlassian.net/browse/DB-23951?atlOrigin=eyJpIjoiNWRkNTljNzYxNjVmNDY3MDlhMDU5Y2ZhYzA5YTRkZjUiLCJwIjoiZ2l0aHViLWNvbS1KU1cifQ
  **Post-Mortem & Fix Analysis**:
  > #31828 

- **Issue #34447** (2026-09-30): **[BACKPORT 2.31.0.6390][PLAT-22695] YBA: Remove InstanceExistCheck from the create universe path (#34239)**
  *Symptoms*: ## Summary  `InstanceExistCheck` asks whether an instance exists, not whether it is healthy. A VM left in `Failed` state by a failed create still "exists", so on retry the check waits for a connection that never comes, hard-reboots a VM that cannot boot, and retries — hanging the task for over an hour. Being an early precheck, it also stops the retry from ever reaching the leftover-destroy in the `Adding` group that would have cleaned the node up.  `AnsibleCreateServer` already makes the same `instanceExists()` + `Wait_For_Connection` call on its instance-exists branch, and PLAT-22189 now destroys a leftover instead of adopting it. What does move later is rejection of a name clash with **another** universe's instance: `instanceExists()` throws on a tag mismatch, so that now surfaces in `AnsibleCreateServer` rather than in this precheck — same error, but after capacity reservations are created (and cleaned up by `clearCapacityReservationOnError`). Accepted deliberately; `CheckDuplicateInstance` is not a substitute, since it throws on any instance found for a `ToBeAdded` node and so would reject a retried create that still carries a leftover VM.  `AddNodeToUniverse` keeps its call — there a `Removed` node skips `AnsibleCreateServer`, so this is its only connectivity check. The same hang is reachable via Add Node; fixing that needs fail-fast, not removal (separate ticket).  Original commit: 48d593bdd3a6ae6f1f06cdc407d3f40cc8b59b82 / #34239  ## Test plan  Clean cherry-pick — the 

- **Issue #34443** (2026-09-30): **[BACKPORT 2025.1][#33634] xClusterDDLRepl: Keep PartmanExtension test data inside one month**
  *Symptoms*: Summary: `XClusterDDLReplicationSwitchoverTest.PartmanExtension` fails on the last day of every month.  The test inserts `(current_date, 1), (current_date + 1, 2)` and then asserts an exact count of tables in the `public` schema while `pg_cron` runs `partman.run_maintenance()` every 5 seconds. `run_maintenance` derives its current partition from the highest control value present in the partition set rather than from the clock: it scans the children `DESC` and takes the first non-null `max(order_date)` (`pg_partman/sql/functions/run_maintenance.sql:223`). On a month-end date the two inserted rows straddle the month boundary, so the second one lands in the newest child partition, `v_premade_count` becomes 0 instead of 1, and `premake = 2` makes a single maintenance run create two partitions. The table count therefore jumps from 4 to 6: either the wait for 5 times out, or it catches the transient 5 and `Switchover()` races the second `CREATE TABLE` and fails with `Namespace ... has additional tables that were not added to xCluster DB Scoped replication group backwards_replication`.  Pin both rows to the first two days of the current month so that `current_date + 1` can no longer cross a partition boundary. Each step of the test then creates exactly one partition, which keeps the exact count assertions meaningful.  _automated · Claude Code (Opus 5)_  Original commit: e5b6de8cc1d2b5864ba91d1d7727de9617f77e8e / D58282  Test Plan: `./yb_build.sh debug --cxx-test integration-tests_xc
  **Post-Mortem & Fix Analysis**:
  > Trigger Jenkins
  > [![CLA assistant check](https://cla-assistant.io/pull/badge/not_signed)](https://cla-assistant.io/yugabyte/yugabyte-db?pullRequest=34443) <br/>Thank you for your submission! We really appreciate it. Like many open source projects, we ask that you sign our [Contributor License Agreement](https://cla-assistant.io/yugabyte/yugabyte-db?pullRequest=34443) before we can accept your contribution.<br/><sub>You have signed the CLA already but the status is still pending? Let us [recheck](https://cla-assistant.io/check/yugabyte/yugabyte-db?pullRequest=34443) it.</sub>

- **Issue #34442** (2026-09-30): **[BACKPORT 2025.2][#33634] xClusterDDLRepl: Keep PartmanExtension test data inside one month**
  *Symptoms*: Summary: `XClusterDDLReplicationSwitchoverTest.PartmanExtension` fails on the last day of every month.  The test inserts `(current_date, 1), (current_date + 1, 2)` and then asserts an exact count of tables in the `public` schema while `pg_cron` runs `partman.run_maintenance()` every 5 seconds. `run_maintenance` derives its current partition from the highest control value present in the partition set rather than from the clock: it scans the children `DESC` and takes the first non-null `max(order_date)` (`pg_partman/sql/functions/run_maintenance.sql:223`). On a month-end date the two inserted rows straddle the month boundary, so the second one lands in the newest child partition, `v_premade_count` becomes 0 instead of 1, and `premake = 2` makes a single maintenance run create two partitions. The table count therefore jumps from 4 to 6: either the wait for 5 times out, or it catches the transient 5 and `Switchover()` races the second `CREATE TABLE` and fails with `Namespace ... has additional tables that were not added to xCluster DB Scoped replication group backwards_replication`.  Pin both rows to the first two days of the current month so that `current_date + 1` can no longer cross a partition boundary. Each step of the test then creates exactly one partition, which keeps the exact count assertions meaningful.  _automated · Claude Code (Opus 5)_  Original commit: e5b6de8cc1d2b5864ba91d1d7727de9617f77e8e / D58282  Test Plan: `./yb_build.sh debug --cxx-test integration-tests_xc
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla-assistant.io/pull/badge/not_signed)](https://cla-assistant.io/yugabyte/yugabyte-db?pullRequest=34442) <br/>Thank you for your submission! We really appreciate it. Like many open source projects, we ask that you sign our [Contributor License Agreement](https://cla-assistant.io/yugabyte/yugabyte-db?pullRequest=34442) before we can accept your contribution.<br/><sub>You have signed the CLA already but the status is still pending? Let us [recheck](https://cla-assistant.io/check/yugabyte/yugabyte-db?pullRequest=34442) it.</sub>
  > Trigger Jenkins

- **Issue #34441** (2026-09-30): **[BACKPORT 2026.1][#33634] xClusterDDLRepl: Keep PartmanExtension test data inside one month**
  *Symptoms*: Summary: `XClusterDDLReplicationSwitchoverTest.PartmanExtension` fails on the last day of every month.  The test inserts `(current_date, 1), (current_date + 1, 2)` and then asserts an exact count of tables in the `public` schema while `pg_cron` runs `partman.run_maintenance()` every 5 seconds. `run_maintenance` derives its current partition from the highest control value present in the partition set rather than from the clock: it scans the children `DESC` and takes the first non-null `max(order_date)` (`pg_partman/sql/functions/run_maintenance.sql:223`). On a month-end date the two inserted rows straddle the month boundary, so the second one lands in the newest child partition, `v_premade_count` becomes 0 instead of 1, and `premake = 2` makes a single maintenance run create two partitions. The table count therefore jumps from 4 to 6: either the wait for 5 times out, or it catches the transient 5 and `Switchover()` races the second `CREATE TABLE` and fails with `Namespace ... has additional tables that were not added to xCluster DB Scoped replication group backwards_replication`.  Pin both rows to the first two days of the current month so that `current_date + 1` can no longer cross a partition boundary. Each step of the test then creates exactly one partition, which keeps the exact count assertions meaningful.  _automated · Claude Code (Opus 5)_  Original commit: e5b6de8cc1d2b5864ba91d1d7727de9617f77e8e / D58282  Test Plan: `./yb_build.sh debug --cxx-test integration-tests_xc
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla-assistant.io/pull/badge/not_signed)](https://cla-assistant.io/yugabyte/yugabyte-db?pullRequest=34441) <br/>Thank you for your submission! We really appreciate it. Like many open source projects, we ask that you sign our [Contributor License Agreement](https://cla-assistant.io/yugabyte/yugabyte-db?pullRequest=34441) before we can accept your contribution.<br/><sub>You have signed the CLA already but the status is still pending? Let us [recheck](https://cla-assistant.io/check/yugabyte/yugabyte-db?pullRequest=34441) it.</sub>
  > Trigger Jenkins

- **Issue #34418** (2026-09-30): **[docs] Update YugabyteDB connector docs for lsn.flush.mode, heartbeat…**
  *Symptoms*: Document the connector changes in dz.2.5.2.yb.2026.1.2.0.1:  - Add lsn.flush.mode (yugabyte/debezium#204) and mark flush.lsn.source as deprecated. connector_and_driver must not be used with HYBRID_TIME replication slots; the connector rejects it when slot.lsn.type=HYBRID_TIME. - Add heartbeat.log.interval.ms (yugabyte/debezium#203), along with the previously undocumented heartbeat.interval.ms and heartbeat.action.query. - Note the new versioning scheme, where the YugabyteDB part is the full four-part release followed by the connector patch, starting with dz.2.5.2.yb.2026.1.2.0.1.  The property changes apply to stable, v2025.2, v2025.1, and v2024.2, because the latest connector is recommended for all YugabyteDB versions. The versioning note is added to stable only, which is the only version with a Connector compatibility section.  <!-- Reviewable:start --> - - - This change is [<img src="https://reviewable.io/review_button.svg" height="34" align="absmiddle" alt="Reviewable"/>](https://reviewable.io/reviews/yugabyte/yugabyte-db/34418) <!-- Reviewable:end --> 
  **Post-Mortem & Fix Analysis**:
  > AgentK has started reviewing this pull request — findings will be posted here shortly.  Pushes are not reviewed automatically. Comment `/agentk review` to ask for another pass — but please only after substantial changes, not on every small push, and not for a push that just addresses the review comments.
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *infallible-bardeen-164bc9* ready! Built [without sensitive environment variables](https://docs.netlify.com/configure-builds/environment-variables/#sensitive-variable-policy)  |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | 68063fb694ea457ec352fda81be70a322d2edb12 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/infallible-bardeen-164bc9/deploys/6abd2fef4330ee000846071c | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-34418--infallible-bardeen-164bc9.netlify.app](https://deploy-preview-34418--infallible-bardeen-164bc9.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTM0NDE4LS1pbmZhbGxpYmxlLWJhcmRlZW4tMTY0YmM5L

- **Issue #34403** (2026-09-29): **[#33769] DocDB: Render per-file SST statistics on the tablet status page**
  *Symptoms*: ## Summary  Stack 2/2, on top of 1/2 (the `docdb_sst_*` gauges). Replaces #34401.  The SST stats collector stores five length distributions and eight droppable-age bands in each file's properties, but nothing renders them: the tablet aggregate and the `docdb_sst_*` gauges carry only scalars, and `/rocksdb` prints the raw serialized form. These distributions are what we need to choose thresholds for the compaction trigger.  This adds `/sst-stats?id=<tablet>`, linked from the tablet page. Each request reads every live file's properties (skipping unreadable blocks) and renders a merged tablet view, a per-file table and per-file age bands. Files without collector properties are listed with the reason; files whose chain tracking stopped early are marked partial.  The page notes three caveats:  - Quantiles are bucket lower bounds, so they read low (by up to 12.5%, unbounded in the overflow   bucket). - Row-, byte- and entry-weighted quantiles are all lengths; only the weighting differs. - The merge is per file, so a row spanning several files counts once per file.  No change unless `--docdb_enable_sst_stats_collector` is set.  ## Test plan  Release build, `tserver_path_handlers-itest`:  - [x] `TServerSstStatsPathHandlerItest.RendersPerFileDistributions` (new) - [x] `TServerSstStatsPathHandlerNoCollectorItest.ReportsFileWithoutStatistics` (new) - [x] `TServerPathHandlersItest.TestMasterPathHandlers` (extended with `/sst-stats`) - [x] `build-support/lint.sh --rev origin/master`  Not 

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

### Incident Patch 1: `ef73b0c9` (2026-09-27)
**Commit Message**: [#34275] DocDB: Fix SchedulerTest.TestFunctionIsCalledIfReactorShutdown

Summary:
A task cancelled by scheduler shutdown got a different status depending on timing. If `DoSchedule` ran after `closing_` was set, the task got `Aborted`. If the IO thread inserted the task into `tasks_` before `Shutdown()` set `closing_`, the shutdown handler ran it with `ServiceUnavailable`, and the test's `IsAborted()` assertion failed.
The shutdown handler in `scheduler.cc` now also uses `Aborted` (still with `Errno(ESHUTDOWN)`), so callers get the same status on either path.

---
_Produced fully automatically by csi-fix.py: Claude Opus (5.5) analyzed the failure logs, wrote the change, and verified it locally._

Test Plan:
./yb_build.sh asan --clang21 --cxx-test scheduler-test --gtest-filter SchedulerTest.TestFunctionIsCalledIfReactorShutdown -n 100 --stop-at-failure -- -p 6
Ran the above locally with no failures.
Before the fix, this test reproduced locally (same test command and -p / env as above, without --stop-at-failure) -- with the CSI dashboard rate for reference:
- clang21-asan: 4/52 iterations failed locally; CSI 4/50
Machine: GCP n2-standard-16, AlmaLinux 8.10 (Cerulean Leopard) x86_64, 1

**File**: `src/yb/rpc/scheduler.cc` (modified, +2/-1)
```diff
@@ -75,8 +75,9 @@ class Scheduler::Impl {
         timer_.cancel(ec);
         LOG_IF(DFATAL, ec) << "Failed to cancel timer: " << ec.message();
 
+        // Same status as DoSchedule after shutdown, so callers see Aborted regardless of timing.
         auto status = STATUS(
-            ServiceUnavailable, "Scheduler is shutting down", "" /* msg2 */, Errno(ESHUTDOWN));
+            Aborted, "Scheduler is shutting down", "" /* msg2 */, Errno(ESHUTDOWN));
         // Abort all scheduled tasks. It is ok to run task earlier than it was scheduled because
         // we pass error status to it.
         for (auto task : tasks_) {
```

---

### Incident Patch 2: `0137b0bf` (2026-09-30)
**Commit Message**: [#34436] YSQL: Fix org.yb.pgsql.TestPgTransparentRestarts#retryTrackerResetAcrossProcsNoTxnBlock

Summary:
In `ConcurrentProcRetryTester`, the worker thread stopped looping once the concurrent insert thread was done. On slow builds such as gcc15-fastdebug, the 50 inserts took about 1 second, so the worker only got through 2 iterations. Both runs of `test_rr_count_proc_non_retriable()` correctly hit a read restart, which left `succeeded` at `0` and failed the "at least one successful execution" assertion. The worker now keeps looping after the inserts finish until every statement has succeeded at least once, and the existing thread-wait timeout still limits how long it can run.

---
_Produced fully automatically by csi-fix.py: Claude Opus (5.5) analyzed the failure logs, wrote the change, and verified it locally._

Test Plan:
./yb_build.sh fastdebug --gcc15 --java-test 'org.yb.pgsql.TestPgTransparentRestarts#retryTrackerResetAcrossProcsNoTxnBlock' -n 180 YB_TEST_YB_CONTROLLER=0 YB_ENABLE_YSQL_CONN_MGR_IN_JAVA_TESTS=true --stop-at-failure -- -p 6
Ran the above locally with no failures.
Before the fix, this test reproduced locally (same test command and -p / env as above, without --st

**File**: `java/yb-pgsql/src/test/java/org/yb/pgsql/TestPgTransparentRestarts.java` (modified, +5/-1)
```diff
@@ -1629,7 +1629,11 @@ public List<ThrowingRunnable> getRunnableThreads(
           for (String setupSql : sessionSetupSqls) {
             stmt.execute(setupSql);
           }
-          while (!isExecutionDone.getAsBoolean()) {
+          // Keep going after the inserts finish until every statement has succeeded once: a
+          // non-retriable statement may surface a read restart on each run during a short insert
+          // phase.
+          while (!isExecutionDone.getAsBoolean() ||
+                 Arrays.stream(succeeded).anyMatch(s -> s == 0)) {
             for (int i = 0; i < n; ++i) {
               String execSql = execSqls.get(i);
               try {
```

---

### Incident Patch 3: `f6ecca24` (2026-09-28)
**Commit Message**: [#34313] YSQL: Fix ...ScheduleTestWithYsqlColocationRestoreParam.PgsqlRenameColumn/DBColocated_Clone

Summary:
On sanitizer builds, a follower master applying a sys catalog snapshot op could block `UpdateConsensus` for more than 5s. The other masters then elected a new leader, and the failover aborted the clone in progress. Slow heartbeats could also expire the 10s `--master_ysql_operation_lease_ttl_ms` lease. The test now multiplies both the lease TTL and `--leader_failure_max_missed_heartbeat_periods` by `kTimeMultiplier`. `ExternalMiniCluster::StartMaster` still adds its sanitizer default `--leader_failure_max_missed_heartbeat_periods=10`, but now only when the test hasn't set that flag, because before this the default always overrode the test's value.

---
_Produced fully automatically by csi-fix.py: Claude Opus (5.5) analyzed the failure logs, wrote the change, and verified it locally._

Test Plan:
./yb_build.sh asan --clang21 --cxx-test yb-admin-snapshot-schedule-test --gtest-filter YbAdminSnapshotScheduleTestWithYsqlColocationRestoreParam.PgsqlRenameColumn/DBColocated_Clone -n 100 --stop-at-failure -- -p 6
Ran the above locally with no failures.
Before the fix, this test rep

**File**: `src/yb/integration-tests/external_mini_cluster.cc` (modified, +4/-1)
```diff
@@ -569,7 +569,10 @@ Result<ExternalMasterPtr> ExternalMiniCluster::StartMaster(
       Format("--transaction_table_num_tablets=$0", NumTabletsPerTransactionTable(opts_)));
   // For sanitizer builds, it is easy to overload the master, leading to quorum changes.
   // This could end up breaking ever trivial DDLs like creating an initial table in the cluster.
-  if (IsSanitizer()) {
+  // Don't override a value explicitly set by the test.
+  if (IsSanitizer() && std::none_of(flags.begin(), flags.end(), [](const auto& flag) {
+        return flag.starts_with("--leader_failure_max_missed_heartbeat_periods=");
+      })) {
     flags.push_back("--leader_failure_max_missed_heartbeat_periods=10");
   }
   if (opts_.enable_ysql) {
```

**File**: `src/yb/tools/yb-admin-snapshot-schedule-test.cc` (modified, +7/-1)
```diff
@@ -570,7 +570,13 @@ class YbAdminSnapshotScheduleTestWithYsql : public YbAdminSnapshotScheduleTest {
     opts->extra_tserver_flags.emplace_back("--ysql_num_shards_per_tserver=1");
     opts->extra_master_flags.emplace_back("--log_ysql_catalog_versions=true");
     opts->extra_master_flags.emplace_back("--consensus_rpc_timeout_ms=5000");
-    opts->extra_master_flags.emplace_back("--master_ysql_operation_lease_ttl_ms=10000");
+    // Sanitizer masters can stall heartbeats for 10+s (e.g. during clone), expiring short leases.
+    opts->extra_master_flags.emplace_back(
+        Format("--master_ysql_operation_lease_ttl_ms=$0", 10000 * kTimeMultiplier));
+    // Followers applying a sys catalog snapshot op can block UpdateConsensus for 5+s, causing a
+    // master failover that aborts in-progress clones.
+    opts->extra_master_flags.emplace_back(
+        Format("--leader_failure_max_missed_heartbeat_periods=$0", 10 * kTimeMultiplier));
     opts->num_masters = 3;
   }
 
```

---

### Incident Patch 4: `946072a1` (2026-09-28)
**Commit Message**: [PLAT-22737] YBA: Fix TabletClient client leakage in ip2client map of yb-client

Summary:
Channel can be null if the connection is not established. Lookup can also fail if DB returns a different host (e.g host resolved to an IP in AsyncYBClient.addTabletClient.
In such cases, the ip2Client entry is removed as remote peer is needed to do so. This changes handles it with fallbacks on channel shutdown.
1. If remote peer is available, use it to remove the entry.
2. If the entry is still left behind, search for the same TabletClient reference and use the IP in that to remove because this is the one which is always registered to ip2Client.
3. If the remote peer is unavailable, it defauls to the step 2 i.e using the IP in the tablet client.

Test Plan:
1. Manual tests just done to make sure it does not regress.
2. Deployment on dev-portal should catch as there are many occurrences in the log.
3. Ran some manual tests by stopping services.

Reviewers: amalyshev, sanketh

Reviewed By: amalyshev

Subscribers: yugaware

Differential Revision: https://phorge.dev.yugabyte.com/D58733

**File**: `java/interface-annotations/pom.xml` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@
   <parent>
     <groupId>org.yb</groupId>
     <artifactId>yb-parent</artifactId>
-    <version>0.8.122-SNAPSHOT</version>
+    <version>0.8.123-SNAPSHOT</version>
   </parent>
 
   <artifactId>interface-annotations</artifactId>
```

**File**: `java/pom.xml` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@
 
   <groupId>org.yb</groupId>
   <artifactId>yb-parent</artifactId>
-  <version>0.8.122-SNAPSHOT</version>
+  <version>0.8.123-SNAPSHOT</version>
   <packaging>pom</packaging>
 
   <name>Yugabyte</name>
```

**File**: `java/yb-cdc/pom.xml` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@
   <parent>
     <groupId>org.yb</groupId>
     <artifactId>yb-parent</artifactId>
-    <version>0.8.122-SNAPSHOT</version>
+    <version>0.8.123-SNAPSHOT</version>
   </parent>
   <artifactId>yb-cdc</artifactId>
   <name>YB CDC Connector</name>
```

**File**: `java/yb-cli/pom.xml` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@
   <parent>
     <groupId>org.yb</groupId>
     <artifactId>yb-parent</artifactId>
-    <version>0.8.122-SNAPSHOT</version>
+    <version>0.8.123-SNAPSHOT</version>
   </parent>
 
   <artifactId>yb-cli</artifactId>
```

**File**: `java/yb-client/pom.xml` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@
   <parent>
     <groupId>org.yb</groupId>
     <artifactId>yb-parent</artifactId>
-    <version>0.8.122-SNAPSHOT</version>
+    <version>0.8.123-SNAPSHOT</version>
   </parent>
 
   <artifactId>yb-client</artifactId>
```

---

### Incident Patch 5: `29c5c8fa` (2026-09-29)
**Commit Message**: [#31935] DocDB: Fix cloned tablet index_map for vector indexes

Summary:
Clone applied the source tablet's index_map onto the child. Restore was supposed to rewrite those IDs, but it does not for vector indexes, so the child kept the source's index entries.
Send the target table's indexes on CloneTabletRequestPB (already remapped in the catalog). Remap snapshot index IDs on colocated tables the same way we already remap index_info. The tserver uses those IDs instead of the source index_map.

**Upgrade/Rollback safety:**
CloneTabletRequestPB gains optional repeated `target_indexes` (field 18).
- Mixed cluster: old tservers ignore the field and keep inheriting the source index_map (pre-fix behavior). New tservers talking to an old master see an empty list and write an empty index_map instead of stale source IDs.
- Rollback: new field is ignored; clone returns to inheriting the source index_map.

Test Plan:
```
./yb_build.sh release --cxx-test clone_state_manager-test --gtest_filter CloneStateManagerTest.ScheduleCloneOps
./yb_build.sh release --cxx-test pg_vector_index-test --gtest_filter 'PgVectorIndexColocationOnlyTest.CloneRemapsVectorIndexMap*'
```

Reviewers: mhaddad

Reviewed By

**File**: `src/yb/master/clone/clone_state_manager-test.cc` (modified, +5/-0)
```diff
@@ -237,6 +237,9 @@ class CloneStateManagerTest : public YBTest {
       auto lock = target_table_->LockForWrite();
       lock.mutable_data()->pb.set_namespace_id(kTargetNamespaceId);
       lock.mutable_data()->pb.set_namespace_name(kTargetNamespaceName);
+      auto* index = lock.mutable_data()->pb.add_indexes();
+      index->set_table_id(kTargetIndexId);
+      index->set_indexed_table_id(kTargetTableId);
       lock.Commit();
     }
 
@@ -437,6 +440,7 @@ class CloneStateManagerTest : public YBTest {
   const TxnSnapshotRestorationId kRestorationId = TxnSnapshotRestorationId::GenerateRandom();
   const TableId kSourceTableId = "source_table_id";
   const TableId kTargetTableId = "target_table_id";
+  const TableId kTargetIndexId = "target_index_id";
   const int kNumTablets = 2;
   const HybridTime kRestoreTime = HybridTime(12345);
   const LeaderEpoch kEpoch = LeaderEpoch(123 /* term */);
@@ -519,6 +523,7 @@ TEST_F(CloneStateManagerTest, ScheduleCloneOps) {
     *expected_req.mutable_target_schema() = target_table_->LockForRead()->schema();
     *expected_req.mutable_target_partition_schema() =
         target_table_->LockForRead()->pb.partition_schema();
+    *expected_req.mutable_target_indexes() = target_table_->LockForRead()->pb.indexes();
 
     EXPECT_CALL(MockFuncs(), GetTabletInfo(source_tablets_[i]->id()))
         .WillOnce(Return(source_tablets_[i]));
```

**File**: `src/yb/master/clone/clone_state_manager.cc` (modified, +17/-0)
```diff
@@ -696,6 +696,21 @@ Status CloneStateManager::UpdateCloneStateWithSnapshotInfo(
       }
       index_info.set_indexed_table_id(it->second.new_table_id);
     }
+    // Snapshot indexes still name source tables. Remap so the cloned tablet does not inherit
+    // those IDs.
+    for (auto& index : *added_table.table_entry_pb.mutable_indexes()) {
+      auto index_it = table_snapshot_data.find(index.table_id());
+      if (index_it == table_snapshot_data.end()) {
+        return STATUS_FORMAT(NotFound, "Did not find index table $0", index.table_id());
+      }
+      index.set_table_id(index_it->second.new_table_id);
+      auto indexed_it = table_snapshot_data.find(index.indexed_table_id());
+      if (indexed_it == table_snapshot_data.end()) {
+        return STATUS_FORMAT(
+            NotFound, "Did not find indexed table $0", index.indexed_table_id());
+      }
+      index.set_indexed_table_id(indexed_it->second.new_table_id);
+    }
   }
 
   for (const auto& [_, table_data] : table_snapshot_data) {
@@ -803,6 +818,7 @@ Status CloneStateManager::ScheduleCloneOps(
     }
     *req.mutable_target_schema() = target_table_lock->pb.schema();
     *req.mutable_target_partition_schema() = target_table_lock->pb.partition_schema();
+    *req.mutable_target_indexes() = target_table_lock->pb.indexes();
     for (const auto& colocated_table_data : tablet_data.colocated_tables_data) {
       const auto& source_pb = colocated_table_data.table_entry_pb;
       auto& pb = *req.add_colocated_tables();
@@ -814,6 +830,7 @@ Status CloneStateManager::ScheduleCloneOps(
       if (source_pb.has_index_info()) {
         *pb.mutable_index_info() = source_pb.index_info();
       }
+      *pb.mutable_indexes() = source_pb.indexes();
     }
     RETURN_NOT_OK(external_funcs_->ScheduleCloneTabletCall(
         source_tablet, clone_state->Epoch(), std::move(req)));
```

**File**: `src/yb/tablet/operations.proto` (modified, +3/-0)
```diff
@@ -239,4 +239,7 @@ message CloneTabletRequestPB {
   // 2- The colocated tables on the target can have different schemas than the tables on the source
   // tablet. i.e when cloning to a time before DDl operations happened on the source tablet.
   repeated TableInfoPB colocated_tables = 16;
+
+  // Indexes attached to the target table.
+  repeated IndexInfoPB target_indexes = 18;
 }
```

**File**: `src/yb/tserver/ts_tablet_manager.cc` (modified, +2/-2)
```diff
@@ -1609,8 +1609,8 @@ Status TSTabletManager::DoApplyCloneTablet(
       source_table->table_type,
       /* Fixed by restore, but we need it to get partition_schema so might as well set it. */
       target_schema,
-      // TODO(GH31935): this may not be fixed in the case of vector indexes.
-      *source_table->index_map, /* fixed by restore */
+      // Cloned index IDs from the master. The source index_map still names the clone source.
+      qlexpr::IndexMap(request->target_indexes()),
       std::move(target_table_index_info),
       source_table->schema_version, /* fixed by restore */
       target_partition_schema,
```

**File**: `src/yb/yql/pgwrapper/pg_vector_index-test.cc` (modified, +87/-0)
```diff
@@ -2145,6 +2145,93 @@ TEST_P(PgVectorIndexColocationOnlyTest, SnapshotScheduleRestoreBeforeVectorColum
       make_unsigned(ASSERT_RESULT(conn.FetchRow<int64_t>("SELECT COUNT(*) FROM test"))));
 }
 
+// After clone, the child's TS-side index_map must list the cloned vector index, not the source
+// Restore does not rewrite those IDs for vector indexes.
+TEST_P(PgVectorIndexColocationOnlyTest, CloneRemapsVectorIndexMap) {
+  ANNOTATE_UNPROTECTED_WRITE(FLAGS_enable_automatic_tablet_splitting) = false;
+  ANNOTATE_UNPROTECTED_WRITE(tablet::TEST_fail_on_seq_scan_with_vector_indexes) = false;
+
+  constexpr auto kSourceDb = "source_db";
+  constexpr auto kCloneDb = "clone_db";
+  constexpr size_t kNumRows = 8;
+  dimensions_ = 3;
+
+  client::SnapshotTestUtil snapshot_util;
+  snapshot_util.SetProxy(&client_->proxy_cache());
+  snapshot_util.SetCluster(cluster_.get());
+
+  auto admin_conn = ASSERT_RESULT(PgMiniTestBase::Connect());
+  if (IsColocated()) {
+    ASSERT_OK(admin_conn.ExecuteFormat("CREATE DATABASE $0 COLOCATION = true", kSourceDb));
+  } else {
+    ASSERT_OK(admin_conn.ExecuteFormat("CREATE DATABASE $0", kSourceDb));
+  }
+
+  auto conn = ASSERT_RESULT(ConnectToDB(kSourceDb));
+  ASSERT_OK(conn.Execute("CREATE EXTENSION vector"));
+  const auto create_suffix = IsColocated() ? " WITH (COLOCATED = 1)" : " SPLIT INTO 1 TABLETS";
+  ASSERT_OK(conn.ExecuteFormat(
+      "CREATE TABLE test (id bigserial PRIMARY KEY, embedding vector(3))$0", create_suffix));
+  for (size_t i = 1; i <= kNumRows; ++i) {
+    ASSERT_OK(conn.ExecuteFormat(
+        "INSERT INTO test (id, embedding) VALUES ($0, '$1')", i, AsString(Vector(i))));
+  }
+  ASSERT_OK(CreateIndex(conn));
+
+  auto find_table_id = [this](const std::string& namespace_name,
+                              const std::string& table_name) -> Result<TableId> {
+    for (const auto& table : VERIFY_RESULT(client_->ListTables())) {
+      if (table.has_table() && table.table_name() == table_name &&
+          table.namespace_name() == namespace_name) {
+        return table.table_id();
+      }
+    }
+    return STATUS_FORMAT(
+        NotFound, "Didn't find table $0 in namespace $1", table_name, namespace_name);
+  };
+
+  const auto source_table_id = ASSERT_RESULT(find_table_id(kSourceDb, "test"));
+  const auto source_index_id = ASSERT_RESULT(find_table_id(kSourceDb, kVectorIndexName));
+
+  ASSERT_OK(snapshot_util.CreateSchedule(
+      nullptr, YQL_DATABASE_PGSQL, kSourceDb,
+      client::WaitSnapshot::kTrue, 1s * kTimeMultiplier, 60s * kTimeMultiplier));
+
+  ASSERT_OK(admin_conn.ExecuteFormat("CREATE DATABASE $0 TEMPLATE $1", kCloneDb, kSourceDb));
+
+  const auto clone_table_id = ASSERT_RESULT(find_table_id(kCloneDb, "test"));
+  const auto clone_index_id = ASSERT_RESULT(find_table_id(kCloneDb, kVectorIndexName));
+  ASSERT_NE(clone_table_id, source_table_id);
+  ASSERT_NE(clone_index_id, source_index_id);
+
+  auto peers = ListTableActiveTabletLeadersPeers(cluster_.get(), clone_table_id);
+  ASSERT_FALSE(peers.empty());
+  for (const auto& peer : peers) {
+    auto tablet = ASSERT_RESULT(peer->shared_tablet());
+    auto table_info = ASSERT_RESULT(tablet->metadata()->GetTableInfo(clone_table_id));
+    std::string index_ids;
+    for (const auto& [id, _] : *table_info->index_map) {
+      if (!index_ids.empty()) {
+        index_ids += ", ";
+      }
+      index_ids += id;
+    }
+    ASSERT_NE(table_info->index_map->find(clone_index_id), table_info->index_map->end())
+        << "cloned tablet " << peer->tablet_id() << " index_map: " << index_ids;
+    ASSERT_EQ(table_info->index_map->find(source_index_id), table_info->index_map->end())
+        << "cloned tablet " << peer->tablet_id()
+        << " still has source index " << source_index_id
+        << " index_map: " << index_ids;
+  }
+
+  auto clone_conn = ASSERT_RESULT(ConnectToDB(kCloneDb));
+  ASSERT_EQ(ASSERT_RESULT(clone_conn.FetchRow<int64_t>("SELECT COUNT(*) FROM test")), kNumRows);
+  ASSERT_EQ(
+     
```

---

### Incident Patch 6: `fdb82af9` (2026-09-23)
**Commit Message**: [DB-23400] YSQL: Import PG 15.19 security fixes from upstream pg

Summary:
##### Upstream commits, by ticket, in the order applied

**DB-23403 / CVE-2026-14671**
- refint: Remove plan cache. [[ https://github.com/postgres/postgres/commit/b7b513d9afabf43124edda3dff7dd8af39906951 | b7b513d9afa ]] -> [[ https://github.com/yugabyte/postgres/commit/58c5646ad243a0d6a3fffac7a05e56ccf11b774e | 58c5646ad24 ]]

**DB-23063 / CVE-2026-14669**
- Guard against overlength time zone abbreviations in to_char(). [[ https://github.com/postgres/postgres/commit/12a6206864a0ba38dc506644bdb3928beea5256a | 12a6206864a ]] -> [[ https://github.com/yugabyte/postgres/commit/c3b90a8752c7655e71193f2b9a6a8e4bbe6f46ad | c3b90a8752c ]]

**DB-23061 / CVE-2026-14662**
- Harden tsvector code against overflows. [[ https://github.com/postgres/postgres/commit/f443d0a0af03e9edc95f2c6a8da6229d025d0d4e | f443d0a0af0 ]] -> [[ https://github.com/yugabyte/postgres/commit/2f6a37361877d6992cb54778f539a5be86b05171 | 2f6a3736187 ]]
- Harden tsquery code against overflows. [[ https://github.com/postgres/postgres/commit/4f8b37b6bf0f6b038e26d1d75ce6407e1a56aa9b | 4f8b37b6bf0 ]] -> [[ https://github.com/yugabyte/postgres/commit/566a2

**File**: `src/lint/upstream_repositories.csv` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 local_path,upstream_path,repository,commit
-src/postgres,,https://github.com/yugabyte/postgres,81e722494f32eb2f05504ae18446a40a57e67c99
+src/postgres,,https://github.com/yugabyte/postgres,b7aa69214048f2c3715b858ae5066558787e2d74
 src/postgres/contrib/passwordcheck,passwordcheck_extra,https://github.com/michaelpq/pg_plugins,66a75ea0ca0706bef7b1e17055aa5fd364189fec
 src/postgres/contrib/passwordcheck/expected/passwordcheck.out,contrib/passwordcheck/expected/passwordcheck.out,https://github.com/yugabyte/postgres,src/postgres
 src/postgres/contrib/passwordcheck/sql/passwordcheck.sql,contrib/passwordcheck/sql/passwordcheck.sql,https://github.com/yugabyte/postgres,src/postgres
```

**File**: `src/postgres/contrib/fuzzystrmatch/expected/fuzzystrmatch.out` (modified, +14/-0)
```diff
@@ -41,6 +41,14 @@ SELECT levenshtein('GUMBO', 'GAMBOL', 2, 1, 1);
            3
 (1 row)
 
+SELECT levenshtein('GUMBO', 'GAMBOL', 1, 1, 2000000000);
+ levenshtein 
+-------------
+           3
+(1 row)
+
+SELECT levenshtein('GUMBO', 'GAMBOL', 2000000000, 2000000000, 2000000000);
+ERROR:  levenshtein distance out of range
 SELECT levenshtein_less_equal('extensive', 'exhaustive', 2);
  levenshtein_less_equal 
 ------------------------
@@ -53,6 +61,12 @@ SELECT levenshtein_less_equal('extensive', 'exhaustive', 4);
                       4
 (1 row)
 
+SELECT levenshtein_less_equal('aaa', 'aaaaa', 1073741824, 0, 1073741824, 10);
+ levenshtein_less_equal 
+------------------------
+                     11
+(1 row)
+
 SELECT metaphone('GUMBO', 4);
  metaphone 
 -----------
```

**File**: `src/postgres/contrib/fuzzystrmatch/sql/fuzzystrmatch.sql` (modified, +3/-0)
```diff
@@ -11,8 +11,11 @@ SELECT soundex(''), difference('', '');
 
 SELECT levenshtein('GUMBO', 'GAMBOL');
 SELECT levenshtein('GUMBO', 'GAMBOL', 2, 1, 1);
+SELECT levenshtein('GUMBO', 'GAMBOL', 1, 1, 2000000000);
+SELECT levenshtein('GUMBO', 'GAMBOL', 2000000000, 2000000000, 2000000000);
 SELECT levenshtein_less_equal('extensive', 'exhaustive', 2);
 SELECT levenshtein_less_equal('extensive', 'exhaustive', 4);
+SELECT levenshtein_less_equal('aaa', 'aaaaa', 1073741824, 0, 1073741824, 10);
 
 
 SELECT metaphone('GUMBO', 4);
```

**File**: `src/postgres/contrib/hstore_plperl/hstore_plperl.c` (modified, +9/-2)
```diff
@@ -119,8 +119,9 @@ plperl_to_hstore(PG_FUNCTION_ARGS)
 				 errmsg("cannot transform non-hash Perl value to hstore")));
 	hv = (HV *) in;
 
-	pcount = hv_iterinit(hv);
+	(void) hv_iterinit(hv);
 
+	pcount = 64;				/* arbitrary initial guess */
 	pairs = palloc_array(Pairs, pcount);
 
 	i = 0;
@@ -129,6 +130,12 @@ plperl_to_hstore(PG_FUNCTION_ARGS)
 		char	   *key = sv2cstr(HeSVKEY_force(he));
 		SV		   *value = HeVAL(he);
 
+		if (i >= pcount)
+		{
+			pcount *= 2;
+			pairs = repalloc_array(pairs, Pairs, pcount);
+		}
+
 		pairs[i].key = pstrdup(key);
 		pairs[i].keylen = hstoreCheckKeyLen(strlen(pairs[i].key));
 		pairs[i].needfree = true;
@@ -149,7 +156,7 @@ plperl_to_hstore(PG_FUNCTION_ARGS)
 		i++;
 	}
 
-	pcount = hstoreUniquePairs(pairs, pcount, &buflen);
+	pcount = hstoreUniquePairs(pairs, i, &buflen);
 	out = hstorePairs(pairs, pcount, buflen);
 	PG_RETURN_POINTER(out);
 }
```

**File**: `src/postgres/contrib/jsonb_plperl/jsonb_plperl.c` (modified, +2/-3)
```diff
@@ -129,12 +129,11 @@ static JsonbValue *
 AV_to_JsonbValue(AV *in, JsonbParseState **jsonb_state)
 {
 	dTHX;
-	SSize_t		pcount = av_len(in) + 1;
-	SSize_t		i;
+	Size_t		pcount = av_count(in);
 
 	pushJsonbValue(jsonb_state, WJB_BEGIN_ARRAY, NULL);
 
-	for (i = 0; i < pcount; i++)
+	for (Size_t i = 0; i < pcount; i++)
 	{
 		SV		  **value = av_fetch(in, i, FALSE);
 
```

---

### Incident Patch 7: `8a709bb0` (2026-09-27)
**Commit Message**: [#34301] DocDB: Fix MasterPathHandlersItest.TestClusterBalancerWarnings

Summary:
The test polled `/load-distribution` and failed immediately unless the "Warnings Summary" table had exactly one row, via `SCHECK_EQ(rows.size(), 1)` inside `WaitFor`. The balancer starts right away because `load_balancer_initial_delay_secs=0`, so on slow builds its early runs can emit other expected warnings, such as skipping a table whose tablets are not reported yet. Those early runs can also produce the "Could not find a valid tserver to host tablet" row before it counts more than 3 tablets. The wait loop now keeps polling until a row with that message and a count above 3 appears, and it ignores other rows.

---
_Produced fully automatically by csi-fix.py: Claude Opus (5.5) analyzed the failure logs, wrote the change, and verified it locally._

Test Plan:
./yb_build.sh tsan --clang21 --cxx-test master_path_handlers-itest --gtest-filter MasterPathHandlersItest.TestClusterBalancerWarnings -n 100 --stop-at-failure -- -p 6
Ran the above locally with no failures.
Before the fix, this test reproduced locally (same test command and -p / env as above, without --stop-at-failure) -- with the CSI dashboard ra

**File**: `src/yb/integration-tests/master_path_handlers-itest.cc` (modified, +9/-5)
```diff
@@ -1898,13 +1898,17 @@ TEST_F(MasterPathHandlersItest, TestClusterBalancerWarnings) {
   ANNOTATE_UNPROTECTED_WRITE(FLAGS_TEST_sleep_before_reporting_lb_ui_ms) = 500;
   std::vector<std::string> row;
   ASSERT_OK(WaitFor([&]() -> Result<bool> {
+    // Other transient warnings (e.g. a table skipped before its tablets are reported) and runs
+    // that did not yet cover all tablets can show up first, so wait for the expected row.
     auto rows = VERIFY_RESULT(GetHtmlTableRows("/load-distribution", "Warnings Summary"));
-    if (rows.empty()) {
-      return false;
+    for (const auto& r : rows) {
+      if (r.size() == 2 && r[0].find("Could not find a valid tserver to host tablet") !=
+              std::string::npos && std::stoi(r[1]) > 3) {
+        row = r;
+        return true;
+      }
     }
-    SCHECK_EQ(rows.size(), 1, IllegalState, "Expected one row");
-    row = rows[0];
-    return true;
+    return false;
   }, 10s /* timeout */, "Waiting for warnings to show up in the Warnings Summary table"));
 
   ASSERT_EQ(row.size(), 2);
```

---

### Incident Patch 8: `4cc207a7` (2026-09-29)
**Commit Message**: [#34377] YSQL: Fix PgIndexBackfillPartialIndexTest.RowCountsChunkRetry/0 hang on slow builds

Summary:
The test lowers the master's `ysql_index_backfill_rpc_timeout_ms` to `1000` so the first slowed chunk times out and gets resent, but it never set the flag back. On TSAN, even an unslowed chunk takes about 1.4-2s, so every later chunk also timed out and was retried with longer and longer backoff, and `CREATE INDEX CONCURRENTLY` never finished before the test timeout. The test now saves the original flag value and restores it after the resend is seen and `TEST_slowdown_backfill_by_ms` is reset to `0`. The rest of the build then runs with the normal timeout, and the test still checks that the redone chunk does not double the row counts.

---
_Produced fully automatically by csi-fix.py: Claude Opus (5.5) analyzed the failure logs, wrote the change, and verified it locally._

Test Plan:
./yb_build.sh tsan --clang21 --cxx-test pg_index_backfill-test --gtest-filter PgIndexBackfillPartialIndexTest.RowCountsChunkRetry/0 -n 180 --stop-at-failure -- -p 6
Ran the above locally with no failures.
Before the fix, this test reproduced locally (same test command and -p / env as above, without --st

**File**: `src/yb/yql/pgwrapper/pg_index_backfill-test.cc` (modified, +4/-0)
```diff
@@ -3766,6 +3766,8 @@ TEST_P(PgIndexBackfillPartialIndexTest, RowCountsChunkRetry) {
   ASSERT_OK(CreatePartialIndexTable(1 /* num_tablets */));
 
   ASSERT_OK(cluster_->SetFlagOnTServers("TEST_slowdown_backfill_by_ms", "3000"));
+  const auto rpc_timeout = ASSERT_RESULT(
+      cluster_->GetLeaderMaster()->GetFlag("ysql_index_backfill_rpc_timeout_ms"));
   ASSERT_OK(cluster_->SetFlagOnMasters("ysql_index_backfill_rpc_timeout_ms", "1000"));
 
   std::vector<ExternalDaemon*> tablet_servers;
@@ -3786,6 +3788,8 @@ TEST_P(PgIndexBackfillPartialIndexTest, RowCountsChunkRetry) {
   LogWaiter redone_waiter(tablet_servers, kFirstChunkOfTablet);
   ASSERT_OK(redone_waiter.WaitFor(60s * kTimeMultiplier));
   ASSERT_OK(cluster_->SetFlagOnTServers("TEST_slowdown_backfill_by_ms", "0"));
+  // An unslowed chunk can still take over 1s on slow builds, so it would never finish in time.
+  ASSERT_OK(cluster_->SetFlagOnMasters("ysql_index_backfill_rpc_timeout_ms", rpc_timeout));
   thread_holder_.JoinAll();
 
   ASSERT_NO_FATALS(CheckRowCounts("idx_concurrent", kNumRows, kMatchingRows));
```

---

### Incident Patch 9: `3da46b4c` (2026-09-25)
**Commit Message**: [#34230] DocDB: Fix TabletSplitITest.SplitSingleTabletWithLimit flush before intents apply

Summary:
The test writes its rows in a transaction, and those rows are applied from the intents DB to the regular DB in the background. If the test flushed and compacted before that apply ran, the regular DB had no SST file, so the first split attempt failed with `Incomplete: No SST file at level 0`. The test now calls `WaitForTestTableIntentsApplied()` after writing and counting the rows, so an SST file with a split key exists by the time the split loop starts.

---
_Produced fully automatically by csi-fix.py: Claude Opus (5.5) analyzed the failure logs, wrote the change, and verified it locally._

Test Plan:
./yb_build.sh asan --clang21 --cxx-test tablet-split-itest --gtest-filter TabletSplitITest.SplitSingleTabletWithLimit -n 288 --stop-at-failure -- -p 6
Ran the above locally with no failures.
Before the fix, this test reproduced locally (same test command and -p / env as above, without --stop-at-failure) -- with the CSI dashboard rate for reference:
- clang21-asan: 1/96 iterations failed locally; CSI 2/32
Machine: GCP n2-standard-16, AlmaLinux 8.10 (Cerulean Leopard) x86_64, 16 vCPU, 62

**File**: `src/yb/integration-tests/tablet-split-itest.cc` (modified, +2/-0)
```diff
@@ -915,6 +915,8 @@ TEST_F(TabletSplitITest, SplitSingleTabletWithLimit) {
   CreateSingleTablet();
   ASSERT_OK(WriteRows(kNumRows, 1));
   ASSERT_OK(CheckRowsCount(kNumRows));
+  // Intents are applied asynchronously; flushing before apply leaves no SST to pick a split key.
+  ASSERT_OK(WaitForTestTableIntentsApplied());
 
   auto* catalog_mgr = ASSERT_RESULT(catalog_manager());
 
```

---

### Incident Patch 10: `1a0e940a` (2026-09-30)
**Commit Message**: [#16670] DocDB: dist-trace: record socket endpoints on RPC spans (#34150)

## Summary

Client spans carried `server.address`/`server.port` and
`network.peer.address`/`network.peer.port`
with identical values, and nothing identified the caller's own socket;
server spans had no address
at all, so reading a trace from its last (inbound) span gave no node
information.

Client spans now emit `network.local.*` (own socket, set once the call
is on a connection) and keep
`network.peer.*` (target); the duplicate `server.*` pair is dropped.
Server spans emit
`server.address`/`server.port`, the listener the call arrived on, set
right after the span is
created in `RpcContext`. In-process and shared-memory calls carry none
of these, which is itself the
signal that the call never hit a socket.

## Test plan

- [x] Local cluster with tracing enabled, verified in Jaeger: client
spans show
`network.local.*` (ephemeral port) and `network.peer.*` (9100), inbound
spans show
`server.address`/`server.port` of the listener; the one in-process
`UpdateTransaction` pair and
  the shmem PgClientService spans carry no address attributes.

<!-- Reviewable:start -->
- - -
This change is [<img src="https://revie

**File**: `src/yb/rpc/outbound_call.cc` (modified, +5/-0)
```diff
@@ -329,6 +329,11 @@ void OutboundCall::NotifyTransferred(const Status& status, const ConnectionPtr&
       std::lock_guard lock(sent_on_connection_mutex_);
       sent_on_connection_ = conn;
     }
+    if (otel_span_ && conn) {
+      const auto& local = conn->local();
+      otel_span_->SetAttribute("network.local.address", local.address().to_string());
+      otel_span_->SetAttribute("network.local.port", static_cast<int64_t>(local.port()));
+    }
   } else {
     VLOG_WITH_PREFIX(1) << "Connection torn down: " << status;
     SetFailed(status);
```

**File**: `src/yb/rpc/outbound_call.h` (modified, +0/-4)
```diff
@@ -350,11 +350,7 @@ class OutboundCall : public RpcCall {
     conn_id_ = value;
     hostname_ = hostname;
     if (otel_span_) {
-      if (hostname) {
-        otel_span_->SetAttribute("server.address", *hostname);
-      }
       const auto& remote = value.remote();
-      otel_span_->SetAttribute("server.port", static_cast<int64_t>(remote.port()));
       otel_span_->SetAttribute("network.peer.address", remote.address().to_string());
       otel_span_->SetAttribute("network.peer.port", static_cast<int64_t>(remote.port()));
     }
```

**File**: `src/yb/rpc/rpc_context.cc` (modified, +5/-0)
```diff
@@ -143,6 +143,11 @@ RpcContext::RpcContext(std::shared_ptr<YBInboundCall> call,
     : call_(std::move(call)),
       params_(std::move(params)) {
   call_->CreateServerSpan();
+  if (const auto& span = call_->server_span(); span) {
+    const auto& local = call_->local_address();
+    span->SetAttribute("server.address", local.address().to_string());
+    span->SetAttribute("server.port", static_cast<int64_t>(local.port()));
+  }
   const Status s = call_->ParseParam(params_.get());
   if (PREDICT_FALSE(!s.ok())) {
     RespondRpcFailure(ErrorStatusPB::ERROR_INVALID_REQUEST, s);
```

#### Recent Merged Pull Requests:
- **PR #34463** (2026-09-30): [#34361] docdb: Update cache statistics outside of mutex lock (@es1024)
- **PR #34447** (2026-09-30): [BACKPORT 2.31.0.6390][PLAT-22695] YBA: Remove InstanceExistCheck from the create universe path (#34239) (@shashwat-yb)
- **PR #34443** (closed): [BACKPORT 2025.1][#33634] xClusterDDLRepl: Keep PartmanExtension test data inside one month (@kai-franz)
- **PR #34442** (2026-09-30): [BACKPORT 2025.2][#33634] xClusterDDLRepl: Keep PartmanExtension test data inside one month (@kai-franz)
- **PR #34441** (2026-09-30): [BACKPORT 2026.1][#33634] xClusterDDLRepl: Keep PartmanExtension test data inside one month (@kai-franz)
- **PR #34418** (2026-09-30): [docs] Update YugabyteDB connector docs for lsn.flush.mode, heartbeat… (@shishir2001-yb)
- **PR #34403** (closed): [#33769] DocDB: Render per-file SST statistics on the tablet status page (@balajisubramanian-yugabyte)
- **PR #34402** (closed): [#33768] DocDB: Export SST statistics as Prometheus gauges (@balajisubramanian-yugabyte)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
