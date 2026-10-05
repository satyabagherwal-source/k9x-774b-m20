# Forensic Learning Record (Deep Inspection): feder-cr/invisible_playwright_mcp

> **Canonical Artifact**: `07_PROJECT_LEARNING/feder-cr-invisible_playwright_mcp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/feder-cr/invisible_playwright_mcp](https://github.com/feder-cr/invisible_playwright_mcp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:29:30.175Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `feder-cr/invisible_playwright_mcp`
- **Description**: Playwright MCP server undetected by anti-bots and captchas: AI agent browses the web on anti-detect stealth Firefox, Python, undetected browser automation, scraping, computer use.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 31770 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/invisible_playwright_mcp/engine.py`
```
"""The engine on disk, once per process, and what to say while it is not.

The browser is a patched Firefox of roughly a quarter of a gigabyte that the
core downloads from a GitHub release (`invisible_core.ensure_binary`) and
caches on this machine. Until 0.69.0 that download happened in one of two
places: inside `uvx invisible-playwright fetch`, run by a person who had read
the README, or inside the first browser launch, which from an MCP client
looked like a tool call sitting there for minutes and, on a client with a
short tool timeout, died with an error that named the timeout and never the
download. The README's fetch line existed for that reason alone.

So the download is now a thing THIS PROCESS does, once, from the moment it
starts, and the two ways in use one object for it:

* `invisible-playwright-mcp ui` runs it in the foreground, before the port opens, with a
  terminal line that follows it: the person launches the download and
  watches it, which is the way the owner asked for it to be on 2026-09-06
  when the first version of this (0.7.0 / server 0.13.0) was withdrawn.
* the MCP server runs it in a daemon thread from `main()`, because a client
  starts its servers at session start and the minutes before the first page
  are download time for free. `browser_open` does not launch a browser while
  the engine is not there: it answers with how far the download is and asks
  to be called again, so no tool call ever blocks on it and no client
  timeout is ever reached. Every other tool already answers "not open".

⛔ A CALLER THAT BRINGS ITS OWN BINARY GETS NO DOWNLOAD. `--binary` on the
interface and `STEALTHFOX_BINARY` for the server (read by `plan.engine_here`,
the one reader of that variable) name an engine the person already has; the
launch still verifies it against the seal, as it always did.

⛔ TWO DOWNLOADS IN ONE PROCESS RACE ON THE SAME TEMPORARY TREE: the core's
`ensure_binary` names it `.tmp-<tag>-<pid>` and removes it at the start of
every download, so a second caller deletes the first one's extraction. The
server never launches while this is in flight, and the interface runs it to
completion before spawning anything, so there is exactly one caller per
process and the race cannot start. Measured on the first version, 2026-09-05.
"""
from __future__ import annotations

import threading
from typing import Callable, Optional

#: The command a person can run to do the download by hand, where they can
#: watch it. Named in one place so the answer below and the setup skill say
#: the same thing.
FETCH_BY_HAND = "uvx invisible-playwright fetch"


class Abandoned(BaseException):
    """Raised inside the download's progress callback when the process is
    leaving. A BaseException on purpose: the core's download loop wraps the
    callback in `except Exception: pass`, so an ordinary exception would be
    swallowed and the thread would go on downloading into a temporary
    directory nobody will ever clean. This one climbs out, the core's
    `TemporaryDirectory` unwinds, and nothing is left behind."""


class Engine:
    """Where the engine is, for this process: not yet, coming, here, or given.

    `state` is one of `pending` (nothing started), `downloading`, `verifying`,
    `extracting` (the core's three phases), `ready` (on disk, verified),
    `failed` (with `error`), `abandoned` (the process left mid-download) and
    `given` (a binary was named, nothing to download). `run()` does the work
    in the calling thread; `start()` does it in a daemon thread and is a no-op
    while one is in flight or once the engine is ready, so calling it from
    every `browser_open` costs nothing and is what retries a failed download.
    """

    def __init__(self, *, binary_path: Optional[str] = None,
                 fetch: Optional[Callable] = None, listener=None) -> None:
        self._fetch = fetch
        self._listener = listener
        self._lock = threading.Lock()
        self._thread: Optional[threading.Thread] = None
        self._abandoned = False
        #: Set once a download has said what it is: a cache hit (`ready`), a
        #: transfer that has begun (`downloading`), or a failure. Cleared by
        #: `start`. `settle` waits on it, so a caller can tell "the engine is
        #: being looked for" from "the engine is being downloaded" without
        #: guessing, and a warm cache never reads as a download.
        self._settled = threading.Event()
        self._settled.set()
        self.state = "given" if binary_path else "pending"
        self.path: Optional[str] = binary_path
        self.error: Optional[str] = None
        self.done = 0
        self.total = 0

    # --- the answer --------------------------------------------------------------

    def ready(self) -> bool:
        return self.state in ("ready", "given")

    def settle(self, timeout: float) -> bool:
        """Wait until the download has said what it is, at most `timeout`
        seconds: the cache check and the release lookup before the first byte
        take a network round trip, not a transfer. True when it has."""
        return self._settled.wait(timeout)

    def describe(self) -> str:
        """One sentence for a tool answer: where the engine is and what to do,
        which is always "call browser_open again" and never a command."""
        if self.state == "given":
            return "the engine is %s." % self.path
        if self.state == "ready":
            return "the engine is on this machine."
        if self.state == "failed":
            return ("the engine download failed: %s. Call browser_open again to "
                    "retry, or run the download by hand where you can watch it, "
                    "in a terminal: %s" % (self.error, FETCH_BY_HAND))
        if self.state in ("verifying", "extracting"):
            return ("the engine has downloaded and is being %s, which takes a "
                    "moment. Call browser_open again shortly; nothing else needs "
                    "doing." % ("verified" if self.state == "verifying" else "extracted"))
        if self.state == "downloading" and (self.done or self.total):
            # Before the first byte the core has said "downloading" and no
            # size yet: that instant reads as "starting" below, not as
            # "0 MB so far", which was the first answer a person got.
            if self.total:
                far = "%d%% of %d MB" % (self.done * 100 // self.total, self.total >> 20)
            else:
                far = "%d MB so far" % (self.done >> 20)
            return ("the engine is not on this machine yet and is downloading now: "
                    "%s. Call browser_open again in a minute; nothing else needs "
                    "doing." % far)
        return ("the engine is not on this machine yet; its download is starting. "
                "Call browser_open again in a minute; nothing else needs doing.")

    # --- the work ------------------------------------------------------------------

    def _fetcher(self) -> Callable:
        if self._fetch is None:
            # The engine package re-exports the core's fetcher; the core is
            # not a dependency this package declares, and an import of it
            # would be the undeclared kind the import gate refuses.
            from invisible_playwright import ensure_binary
            self._fetch = ensure_binary
        return self._fetch

    def _progress(self, done: int, total: int) -> None:
        if self._abandoned:
            raise Abandoned()
        self.done, self.total = done, total
        self.state = "downloading"
        self._settled.set()
        if self._listener is not None:
            self._listener.progress(done, total)

    def _status(self, phase: str) -> None:
        self.state = phase
        self._settled.set()
        if self._listener is not None:
            self._listener.status(phase)

    def run(self) -> Optional[str]:
        """Download in the calling thread. Returns the path, or None with
        `state` and `error` saying why."""
        if self.state == "given":
            return self.path
        self.state = "starting"
        self.error = None
        self._settled.clear()
        try:
            try:
                path = self._fetcher()(progress=self._progress, status=self._status)
            except Abandoned:
                self.state = "abandoned"
                return None
            except Exception as exc:
                self.state = "failed"
                self.error = str(exc)
                return None
            self.path = str(path)
            self.state = "ready"
            return self.path
        finally:
            self._settled.set()

    def start(self) -> bool:
        """Download in a daemon thread. True when a download was started now;
        False when one is in flight, or there is nothing to download."""
        with self._lock:
            if self.state not in ("pending", "failed"):
                return False
            self.state = "starting"
            self._settled.clear()
            self._thread = threading.Thread(target=self.run, name="invisible_playwright_mcp-engine",
                                            daemon=True)
            self._thread.start()
            return True

    def abandon(self, timeout: float = 2.0) -> None:
        """Stop a download in flight because the process is leaving. The
        `verifying` and `extracting` phases report no progress and are not
        interrupted; a process killed there leaves its `.tmp-<tag>-<pid>`
        tree, which the core's next `ensure_binary` sweeps because the pid is
        dead."""
        self._abandoned = True
        thread = self._thread
        if thread is not None and thread.is_alive():
            thread.join(timeout)

```

### Core Architecture Module: `articles/web-research-audited/ground_truth.py`
```
from invisible_playwright import InvisiblePlaywright

prices = []
with InvisiblePlaywright(seed=7) as browser:
    page = browser.new_page()
    for n in (1, 2, 3):
        page.goto(f"https://books.toscrape.com/catalogue/page-{n}.html",
                  wait_until="domcontentloaded")
        for card in page.locator("article.product_pod").all():
            prices.append(float(card.locator(".price_color").inner_text().lstrip("£")))

print("books:", len(prices))
print("above 40:", sum(1 for p in prices if p > 40.00))
bands = {}
for p in prices:
    lo = int(p // 10) * 10
    bands[f"{lo}-{lo+10}"] = bands.get(f"{lo}-{lo+10}", 0) + 1
for band, count in sorted(bands.items(), key=lambda kv: -kv[1]):
    print(band, count)

```

### Core Architecture Module: `scripts/bundle_speaks_mcp.py`
```
"""Start an unpacked bundle the way its manifest says, and speak MCP to it.

⛔ WHY THIS EXISTS: THE CI RAN `--help` AND CALLED IT PROOF. The `bundle` job
packed the archive, unpacked it and ran
`uv run --directory <unpacked> python -m invisible_playwright_mcp --help`, which prints click's
help text. A bundle whose server could not start, could not complete
`initialize`, or answered `tools/list` with nothing would have been green all
the way to a directory review, because `--help` never reaches any of that.

What this does instead, in the order a host does it:

1. reads `manifest.json` from the unpacked bundle, so the command under test
   is the one the manifest DECLARES rather than one written here a second
   time. `${__dirname}` is substituted the way the MCPB spec says a host
   substitutes it, with the bundle's own directory.
2. spawns that command as a subprocess over stdio.
3. completes the MCP handshake and reads `serverInfo`.
4. lists the tools and checks the set is the one the package registers.

Exit 0 on success, 1 with the reason on failure. It prints what it found, so
a CI log says which build and how many tools rather than nothing.

Run it with the bundle's own interpreter, so the `mcp` client library resolves
from the bundle's dependencies:

    uv run --directory /tmp/unpacked python scripts/bundle_speaks_mcp.py /tmp/unpacked
"""
from __future__ import annotations

import asyncio
import json
import pathlib
import sys


def declared_command(bundle: pathlib.Path) -> tuple[str, list[str], dict]:
    """The command the manifest tells a host to run, with `${__dirname}` filled.

    The MCPB spec substitutes a small set of variables in `mcp_config`; the
    only one this bundle uses is `${__dirname}`, the extension's directory.
    Anything else is left alone and will simply fail to start, which is the
    honest outcome for a manifest asking for something a host does not supply.
    """
    manifest = json.loads((bundle / "manifest.json").read_text(encoding="utf-8"))
    server = manifest["server"]
    config = server["mcp_config"]
    here = str(bundle)

    def fill(value: str) -> str:
        return value.replace("${__dirname}", here)

    command = fill(config["command"])
    args = [fill(a) for a in config.get("args", [])]
    env = {k: fill(v) for k, v in (config.get("env") or {}).items()}
    print("manifest: %s %s, server type %r, entry point %r"
          % (manifest["name"], manifest["version"], server["type"],
             server["entry_point"]))
    print("launching: %s %s" % (command, " ".join(args)))
    return command, args, env


async def handshake(bundle: pathlib.Path) -> int:
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client

    command, args, env = declared_command(bundle)
    import os
    params = StdioServerParameters(command=command, args=args,
                                   env=dict(os.environ, **env))
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            got = await asyncio.wait_for(session.initialize(), 120)
            info = got.serverInfo
            print("serverInfo: %s %s" % (info.name, info.version))
            tools = (await asyncio.wait_for(session.list_tools(), 60)).tools
            names = sorted(t.name for t in tools)
            print("tools (%d): %s" % (len(names), ", ".join(names)))
            if not names:
                print("FAIL: the bundle started and offered no tools")
                return 1
            missing = [t for t in tools if not (t.description or "").strip()]
            if missing:
                print("FAIL: tools with no description: %s"
                      % ", ".join(t.name for t in missing))
                return 1
            if not info.version:
                print("FAIL: the handshake carried no server version")
                return 1
    print("OK: the bundle starts from its own manifest and answers MCP")
    return 0


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    bundle = pathlib.Path(sys.argv[1]).resolve()
    if not (bundle / "manifest.json").is_file():
        print("no manifest.json under %s" % bundle)
        return 2
    try:
        return asyncio.run(handshake(bundle))
    except asyncio.TimeoutError:
        print("FAIL: the bundle did not answer in time")
        return 1


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    raise SystemExit(main())

```

### Core Architecture Module: `scripts/check_content.py`
```
"""Content gates for this repository's published surface.

Checks over docs/, articles/, assets/ and the README, each born from a real
incident rather than a hypothetical. How many there are is deliberately not
written here: this file said "five" while running six, and a hand-written count
inside the file that exists to catch stale numbers is the joke telling itself.
Count the numbered entries.

  1. Banned-topic scan. Pages on retired topics must not come back; a stale
     branch once squash-merged five of them straight onto main. Historical
     one-line mentions are pinned in an explicit allowance table.
  2. Dash and invisible-Unicode scan. No em/en dashes, and none of the
     invisible or formatting codepoints that text pipelines can smuggle in
     (zero-width, bidi controls, variation selectors, tag block).
  3. CLI-surface scan. Every `<command> <subcommand>` a page teaches must exist
     in src/invisible_playwright_mcp/cli.py. A release once removed a subcommand while 13 wiki
     pages still taught it.
  4. Internal links. Every `](page.md)` in docs/ must point at a page that
     exists, and image assets must carry no metadata chunks.
  5. The way in is written once. The README's code blocks are the source:
     in every fence that installs uv (one per system), the run from the
     installer line to the end of the fence, PATH line included, minus the
     line that runs the product (the interface fence ends with it); the
     first fenced line that runs the command names the launcher in front of
     every command (`uvx` today; until 0.69.0 the fetch line did, and the
     fetch line left the README when the server began downloading the engine
     itself); and the lines that tell a client the server exists, one per client
     (`claude plugin install invisible-playwright-mcp@feder-cr`, `gemini extensions install
     ...`, `codex mcp add ...`). A page that carries the uv installer carries
     the install lines verbatim, every code block runs the command (the server,
     or `invisible-playwright-mcp ui`) and the fetch with the README's launcher, a page that
     tells a client the server exists says it with the README's line or names
     the route bare, and no page teaches a way in that the README does not
     (`pip install invisible-playwright-mcp`; `claude mcp add`, once the README moved to the
     plugin). On 2026-09-06 the route went uv, pip, uv in one day, and each
     flip touched the README plus twenty-odd wiki pages by hand; on
     2026-09-21 Claude Code moved from `claude mcp add` to the plugin and
     Gemini CLI from `gemini mcp add` to the extension, and five pages went
     on teaching the old lines with this check green, because it read only
     the installer lines.
  6. MCP-tool scan. Every `browser_*` or `session_*` tool a page teaches must
     be declared in the server. 0.39.0 and 0.41.0 between them removed nine
     tools, and four published pages went on teaching them - one told the
     reader to set the proxy at a tool that no longer exists.
  7. Tool-surface size. A page that publishes how big this server's tool
     surface is must publish the live figure. On 2026-09-13 eleven pages
     quoted a character count that was stale AND had been measured the wrong
     way, and nothing could go red about it: a number copied into prose has
     no link back to what it measured. This check is that link.

Run: python scripts/check_content.py            (from the repo root)
     python scripts/check_content.py --selftest (prove the gate on known-bad)

Exit 0 clean, 1 findings, 2 usage error.
"""

import argparse
import re
import struct
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

#: The command this package puts on the PATH, read from the one place that
#: declares it.
#:
#: The module and the command are two spellings of one name, and only one of
#: them is ever typed at a shell. This gate held a copy of the wrong one after
#: the rename on 2026-09-23, and the result was not a missed check but four
#: INVENTED ones: with the module's spelling in the pattern, any prose that
#: mentioned the module inside backticks followed by any word at all read as a
#: subcommand, so the gate reported `<module> src` and `<module> reviewed` as
#: commands the CLI does not define. A gate that holds a copy of what it
#: measures reports on the copy.
COMMAND = next(iter(tomllib.loads(
    (ROOT / "pyproject.toml").read_text(encoding="utf-8"))["project"]["scripts"]))

BANNED_TERMS = [
    "job application", "job-application", "job applications",
    "apply to jobs", "job board", "cover letter", "job hunt", "job search",
]

# Path suffix -> max total banned-term hits allowed there, with the reason.
# A historical one-liner is allowed; a page ABOUT the topic is not.
ALLOWED_MENTIONS = {
    "docs/ai-browser-agent-open-source.md": 1,   # one line of project history
    "docs/openai-operator-open-source.md": 1,    # one line of project history
    "README.md": 1,                              # press-coverage link
}

INVISIBLE = {
    0x00A0, 0x00AD, 0x034F, 0x061C, 0x115F, 0x1160, 0x17B4, 0x17B5, 0x180E,
    0x200B, 0x200C, 0x200D, 0x200E, 0x200F, 0x202F, 0x205F, 0x2060, 0x2061,
    0x2062, 0x2063, 0x2064, 0x3164, 0xFEFF, 0xFFA0, 0xFFF9, 0xFFFA, 0xFFFB,
}
INVISIBLE_RANGES = [(0x2000, 0x200A), (0x202A, 0x202E), (0x2066, 0x2069),
                    (0xFE00, 0xFE0F), (0xE0000, 0xE007F), (0xE0100, 0xE01EF)]

PNG_OK = {b"IHDR", b"PLTE", b"IDAT", b"IEND", b"tRNS", b"gAMA", b"cHRM",
          b"sRGB", b"iCCP", b"sBIT", b"bKGD", b"hIST", b"pHYs", b"sPLT",
          b"tIME", b"acTL", b"fcTL", b"fdAT"}

# `<command> <token>` counts as a command reference only in code-shaped
# contexts: after `uvx `, inside backticks, or in a quoted argv list.
CMD_RE = re.compile(r"(?:uvx[ \t]+|[\"'`])" + re.escape(COMMAND) + r"[\"', \t]+([a-z][a-z-]*)")


# The way in is written once, in the README: the install block, and the
# launcher in front of every command. A page repeats them verbatim or not at
# all. Born 2026-09-06, when the route went uv, pip, uv in one day and each
# flip touched the README plus twenty-odd wiki pages by hand.
# The command alone is the server, `<command> ui` the interface: one token
# covers both, matched as a whole word (never inside a dotted path).
#: ⛔ THE FIRST ENTRY IS THE COMMAND, AND WRITING THE MODULE'S SPELLING HERE
#: TURNED FOUR CHECKS OFF WITHOUT A WORD. `way_in` finds the product line in a
#: fence by this string; with the module's spelling it matched nothing in a
#: README that teaches `uvx invisible-playwright-mcp`, so it returned
#: `(None, None, None)`, every check that reads the launcher or the client lines
#: was skipped, and the gate printed `clean`. The four mutations in `selftest`
#: were the only thing that said so. A gate that cannot find the thing it
#: measures does not fail, it passes.
WAY_IN = (COMMAND, "invisible-playwright fetch")
INSTALLER = "astral.sh/uv/install"
#: The routes that are not the blessed one. `pip` was tried and withdrawn in a
#: day, so a page teaching it is a page teaching something we do not support.
#: There were four before the rename, two of them the old distribution's name
#: and one the shim's; the shim's name is the package's own now, so the three
#: below are all there are.
OTHER_WAYS = tuple("%s %s" % (prefix, COMMAND)
                   for prefix in ("pip install", "pipx install", "pipx run"))
#: How a client is told the server exists: the start of one line per client
#: in the README, and every form a README of this project has taught. A page
#: repeats the README's whole line, names the route bare in prose (`claude
#: plugin install`, as a noun), or says nothing; a route the README no longer
#: teaches is a way in the README does not, whichever form it takes.
CLIENT_WAYS = ("claude mcp add", "claude plugin marketplace add",
               "claude plugin install", "gemini mcp add",
               "gemini extensions install", "codex mcp add",
               "codex plugin marketplace add", "codex plugin add")
FENCE = chr(96) * 3


#: The languages in which a page can actually teach the way in: a shell, or a
#: client's config block. A `python` block cannot - there `invisible_playwright_mcp` is a string
#: inside an argument list, not a command - and reading one as shell accuses
#: healthy code. Happened 2026-09-13 on `args=["-m", "invisible_playwright_mcp"]` in a thirty-line
#: MCP client: the gate reported that the page runs `" invisible_playwright_mcp`. A block with no
#: declared language stays in, because that is the form shell blocks use most.
WAY_IN_LANGUAGES = ("", "text", "sh", "bash", "shell", "console",
                    "powershell", "ps1", "json", "toml", "jsonc")


def fenced_blocks(text, only_languages=None):
    """The lines of every fenced code block, block by block, fences excluded.

    `only_languages` keeps just the blocks whose fence declares one of those
    languages, so a caller that reads blocks AS SHELL does not also read
    Python source as shell.
    """
    blocks, current, language = [], None, ""
    for line in text.split(chr(10)):
        stripped = line.lstrip()
        if stripped.startswith(FENCE):
            if current is None:
                current = []
                language = stripped[len(FENCE):].strip().lower()
            else:
                if only_languages is None or language in only_languages:
                    blocks.append(current)
                current = None
            continue
        if current is not None:
            current.append(line)
    return blocks


def runs(line, cmd):
    """Where `line` runs `cmd` as a command: (text before it, the word in the
    launcher slot) for each place. A URL or path segment (`.../invisible_playwright_mcp`) is not
    one, and neither is a plugin id (`invisible-playwright-mcp@feder-cr`, which `claude plugin
    install` takes: a name, not a command run). The launcher word is the l
```

### Core Architecture Module: `scripts/pack_bundle.py`
```
"""Build the MCP bundle (.mcpb) from this repository, and refuse one that
carries what it must not.

The repository IS the bundle: `manifest.json` at the root (server.type "uv",
MCPB manifest 0.4), `pyproject.toml` with the dependencies, the package under
`src/`, the icon. That is the layout the MCPB spec gives for Python servers
whose dependencies cannot be bundled portably (pydantic, which the MCP SDK
needs), and it is what `uv run --directory <bundle> python -m invisible_playwright_mcp` runs.
`.mcpbignore` keeps everything else out; this script packs with the official
CLI and then LISTS the archive against an allowed set, because an ignore file
is a list of what to drop and a secret is what nobody thought to list.

Two things are staged before packing, on purpose:

  * Only files git knows and does not ignore are copied into the staging
    directory. A `.env` beside the manifest, which .gitignore names, never
    reaches the archive whatever the ignore file says; and the archive check
    below refuses one anyway.
  * `--smithery` rewrites `server.type` to "python" in the staged manifest.
    Smithery's CLI recognises python, node and binary only (measured
    2026-09-12: a uv-type manifest is refused with "Could not determine
    bundle runtime"), so the variant it gets is the same bundle with the one
    word it can read. The repository keeps the spec's word.

    python scripts/pack_bundle.py                 # dist/<manifest name>-<version>.mcpb
    python scripts/pack_bundle.py --smithery      # dist/<manifest name>-<version>-smithery.mcpb
    python scripts/pack_bundle.py --output /tmp/b # somewhere else
"""
from __future__ import annotations

import argparse
import json
import pathlib
import shutil
import subprocess
import sys
import tempfile
import tomllib
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]

#: The whole of what a bundle may hold, as archive paths or path prefixes.
ALLOWED = ("manifest.json", "pyproject.toml", "README.md", "LICENSE",
           "assets/icon-400.png", "src/invisible_playwright_mcp/")
#: Names that must not appear anywhere in an archive path, whatever the prefix.
FORBIDDEN_PARTS = (".env", ".git", "__pycache__", "tests", "docs", "articles", "skills")


def archive_findings(names):
    """Why the archive must not ship, or nothing.

    `names` are the entries of the zip. Every entry must sit under ALLOWED, and
    no entry may carry a forbidden part; both halves, because an allowed prefix
    with a forbidden name inside it (`src/invisible_playwright_mcp/.env`) is the case the first
    half cannot see.
    """
    out = []
    for name in names:
        if name.endswith("/"):
            continue
        if not any(name == a or name.startswith(a) for a in ALLOWED):
            out.append("%s is outside the allowed set" % name)
        parts = name.split("/")
        bad = [p for p in parts if p in FORBIDDEN_PARTS or p.startswith(".env")]
        if bad:
            out.append("%s carries %s" % (name, ", ".join(bad)))
    for must in ("manifest.json", "pyproject.toml", "src/invisible_playwright_mcp/__init__.py",
                 "src/invisible_playwright_mcp/__main__.py", "assets/icon-400.png"):
        if must not in names:
            out.append("%s is missing from the archive" % must)
    return out


def stage(smithery: bool) -> pathlib.Path:
    """A copy of the tracked tree, with the Smithery rewrite if asked."""
    # Tracked files plus untracked ones that git does not ignore: a manifest
    # edited but not yet committed is packed, a `.env` that .gitignore names
    # is not, and whatever slips through is caught by the archive check.
    tracked = subprocess.run(["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
                             cwd=ROOT, capture_output=True, check=True).stdout.decode("utf-8").split("\0")
    staging = pathlib.Path(tempfile.mkdtemp(prefix="invisible_playwright_mcp-mcpb-"))
    for rel in tracked:
        if not rel:
            continue
        src = ROOT / rel
        if not src.is_file():
            continue
        dst = staging / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dst)
    if smithery:
        manifest_path = staging / "manifest.json"
        manifest = json.loads(manifest_path.read_bytes().decode("utf-8"))
        assert manifest["server"]["type"] == "uv", manifest["server"]["type"]
        manifest["server"]["type"] = "python"
        manifest_path.write_bytes((json.dumps(manifest, indent=2) + "\n").encode("utf-8"))
    return staging


def main(argv=None) -> int:
    # The CLI prints an emoji in its summary; on a cp1252 console that kills
    # this script AFTER the archive is written and BEFORE it is checked.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--output", default=str(ROOT / "dist"), help="directory for the .mcpb")
    ap.add_argument("--smithery", action="store_true",
                    help="server.type python in the staged manifest, for Smithery's CLI")
    args = ap.parse_args(argv)

    version = tomllib.loads((ROOT / "pyproject.toml").read_text(encoding="utf-8"))["project"]["version"]
    manifest = json.loads((ROOT / "manifest.json").read_bytes().decode("utf-8"))
    if manifest["version"] != version:
        print("manifest.json is %s, pyproject.toml is %s: not packing a bundle that lies"
              % (manifest["version"], version))
        return 2

    out_dir = pathlib.Path(args.output)
    out_dir.mkdir(parents=True, exist_ok=True)
    suffix = "-smithery" if args.smithery else ""
    # ⛔ THE ARCHIVE IS NAMED FROM THE MANIFEST IT CARRIES, not from a literal
    # here. It was a literal, and after the package rename on 2026-09-23 the
    # file was called one thing while the manifest inside it declared another:
    # a directory reading both would see two names for one bundle, and nothing
    # would have gone red, because the literal here and the glob in `ci.yml`
    # were the same wrong string.
    out = out_dir / ("%s-%s%s.mcpb" % (manifest["name"], version, suffix))

    staging = stage(args.smithery)
    try:
        npx = "npx.cmd" if sys.platform == "win32" else "npx"
        r = subprocess.run([npx, "-y", "@anthropic-ai/mcpb", "pack", str(staging), str(out)],
                           capture_output=True, text=True, encoding="utf-8", errors="replace")
        sys.stdout.write(r.stdout)
        if r.returncode != 0:
            sys.stdout.write(r.stderr)
            print("mcpb pack failed (%d)" % r.returncode)
            return r.returncode
    finally:
        shutil.rmtree(staging, ignore_errors=True)

    names = zipfile.ZipFile(out).namelist()
    findings = archive_findings(names)
    if findings:
        out.unlink()
        print("REFUSED, and the archive is deleted:")
        for f in findings:
            print("  " + f)
        return 1
    print("bundle: %s (%d entries, %d bytes)" % (out, len(names), out.stat().st_size))
    for n in sorted(names):
        print("  " + n)
    return 0


if __name__ == "__main__":
    sys.exit(main())

```

### Core Architecture Module: `scripts/pack_extension.py`
```
"""Build the Gemini CLI extension archives from this repository, and refuse
one that carries what it must not.

Installed from the git URL, the extension is a clone of the whole repository:
measured 2026-09-21, `gemini extensions install https://github.com/feder-cr/invisible_playwright_mcp`
put docs, articles, tests and src on the person's disk to deliver two files,
`gemini-extension.json` and the setup skill. Gemini CLI installs from a
GitHub release instead when the Latest release carries an asset it can pick:
`{platform}.{name}.{extension}` per platform, or a single asset as the
fallback. Ours carry two MCP bundles already, so the fallback never applies
and the per-platform names are the road: three identical archives, one per
platform Gemini names (`darwin`, `linux`, `win32`), each fully contained,
with `gemini-extension.json` at its root. An archive is listed against an
allowed set before it ships, for the same reason the bundle is: an ignore
file is a list of what to drop, and a secret is what nobody thought to list.

    python scripts/pack_extension.py                # dist/<platform>.invisible_playwright_mcp-extension.zip x3
    python scripts/pack_extension.py --output /tmp/e
"""
from __future__ import annotations

import argparse
import pathlib
import subprocess
import sys
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]

#: The whole of what an extension archive may hold: the manifest Gemini reads,
#: the skill it lists, and the three files a person expects to find beside any
#: package. Nothing that runs: the server comes from the index, `uvx invisible-playwright-mcp`.
ALLOWED = ("gemini-extension.json", "skills/", "LICENSE", "README.md",
           "assets/icon-400.png")
#: Names that must not appear anywhere in an archive path, whatever the prefix.
FORBIDDEN_PARTS = (".env", ".git", "__pycache__", "tests", "docs", "articles", "src", "scripts")
#: The platform names Gemini CLI matches assets on (Node's `process.platform`).
PLATFORMS = ("darwin", "linux", "win32")


def asset_name(platform: str) -> str:
    return "%s.invisible_playwright_mcp-extension.zip" % platform


def archive_findings(names):
    """Why the archive must not ship, or nothing.

    `names` are the entries of the zip. Every entry must sit under ALLOWED, no
    entry may carry a forbidden part, and the manifest must be at the root -
    Gemini requires it there, and an archive rooted one directory down installs
    nothing.
    """
    out = []
    for name in names:
        if name.endswith("/"):
            continue
        if not any(name == a or name.startswith(a) for a in ALLOWED):
            out.append("%s is outside the allowed set" % name)
        parts = name.split("/")
        bad = [p for p in parts if p in FORBIDDEN_PARTS or p.startswith(".env")]
        if bad:
            out.append("%s carries %s" % (name, ", ".join(bad)))
    for must in ("gemini-extension.json", "skills/setup/SKILL.md", "LICENSE"):
        if must not in names:
            out.append("%s is missing from the archive" % must)
    return out


def members() -> list[pathlib.Path]:
    """The files to pack: tracked, not ignored, and inside the allowed set."""
    tracked = subprocess.run(["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
                             cwd=ROOT, capture_output=True, check=True).stdout
    chosen = []
    for rel in tracked.decode("utf-8").split("\0"):
        if rel and any(rel == a or rel.startswith(a) for a in ALLOWED) and (ROOT / rel).is_file():
            chosen.append(pathlib.Path(rel))
    return sorted(chosen)


def pack(output: pathlib.Path) -> list[pathlib.Path]:
    output.mkdir(parents=True, exist_ok=True)
    files = members()
    names = [f.as_posix() for f in files]
    findings = archive_findings(names)
    if findings:
        for line in findings:
            print("[extension] " + line, file=sys.stderr)
        raise SystemExit(1)
    made = []
    for platform in PLATFORMS:
        path = output / asset_name(platform)
        with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as zf:
            for f in files:
                zf.write(ROOT / f, f.as_posix())
        with zipfile.ZipFile(path) as zf:
            again = archive_findings(zf.namelist())
        if again:
            raise SystemExit("the packed archive %s fails its own check: %s" % (path, again))
        made.append(path)
    return made


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--output", default=str(ROOT / "dist"))
    args = ap.parse_args(argv)
    for path in pack(pathlib.Path(args.output)):
        print(path)
    return 0


if __name__ == "__main__":
    sys.exit(main())

```

### Core Architecture Module: `scripts/sync_article_pixels.py`
```
#!/usr/bin/env python3
"""One view pixel per wiki page, and the release that holds them.

A GitHub wiki serves no per-page analytics. The repository traffic API reports
the ten most visited paths over fourteen days and nothing below that, so a
corpus of hundreds of wiki pages is invisible by construction: measured on this
repository, the whole wiki index sits at about thirty views per fortnight and
not one individual page reaches the top ten.

This gives every page a counter of its own, by the same mechanism the browser
launch counter has used since May: a release asset whose `download_count` is
incremented by GitHub on every fetch. Each wiki page embeds its own asset as a
1x1 transparent image, so one page view is one fetch is one count. The assets
live in a release tagged `article-views`, which is not a software release and
is created with `make_latest=false` so it never becomes the repository's
"Latest".

What the number is, said once so nobody reads it as more than it is:

  * It counts FETCHES, not people. A reader who opens a page twice counts
    twice, and there is no unique-visitor figure anywhere in it.
  * It counts every client that loads images, crawlers included. Image
    indexers and link unfurlers fetch it exactly like a browser does. At the
    per-page volumes above, that share is not small.
  * It undercounts readers who block images or read the page through a proxy
    that strips them.

It is a floor with noise on top, and it is the only per-page signal available.
GitHub's own `traffic/popular/paths` is the independent instrument that can
corroborate it: a page the pixel calls the most read should, eventually, show
up in that top ten.

Usage:

    python scripts/sync_article_pixels.py --repo owner/name wiki_build
    python scripts/sync_article_pixels.py --repo owner/name --check wiki_build
    python scripts/sync_article_pixels.py --selftest

`--check` is the gate: it refuses unless every built page carries exactly one
pixel, addressed to this repository and naming that page. It exists because
the injection happens in `build_wiki.py`, which falls back to no pixel at all
when it is not told which repository it is building for - and a wiki published
without pixels counts nothing while looking perfectly normal.

The sync NEVER deletes an asset. A page removed from `docs/` keeps its history,
and a renamed slug gets a new asset rather than inheriting the old one's count,
which is the truth: the wiki has no redirects, so a renamed page is a new URL.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import struct
import sys
import time
import urllib.error
import urllib.request
import zlib
from pathlib import Path

#: The release that holds the pixels. Not a software release: `publish.yml`
#: reads `v*` tags and never looks at this one.
TAG = "article-views"

#: GitHub allows 1000 assets on a single release. Refusing well short of that
#: leaves room to notice and split into a second release, rather than finding
#: out from a failed upload on the day a page is published.
MAX_ASSETS = 1000
REFUSE_ABOVE = 950

#: `_Sidebar.md` is navigation injected into every page, not a page. A pixel
#: there would fire on every view of every page and drown its own signal.
NOT_A_PAGE = {"_Sidebar", "_Footer", "_Header"}

#: Any pixel, whichever repository or page it names. The check needs to see a
#: WRONG pixel, not only a missing one, so it matches the shape and compares
#: the parts afterwards.
PIXEL_RE = re.compile(
    r'<img src="https://github\.com/([^/"]+/[^/"]+)/releases/download/'
    + TAG + r'/([^"/]+)\.png" width="1" height="1" alt="">')


def pixel_bytes() -> bytes:
    """A 1x1 fully transparent PNG, built here rather than committed.

    68 bytes, and no image library on the runner. Transparent so it cannot
    show through any theme, and a real PNG so a browser that sniffs content
    types is not handed a text file with an image extension.
    """
    def chunk(kind: bytes, data: bytes) -> bytes:
        return (struct.pack(">I", len(data)) + kind + data
                + struct.pack(">I", zlib.crc32(kind + data) & 0xffffffff))
    ihdr = struct.pack(">IIBBBBB", 1, 1, 8, 6, 0, 0, 0)   # 1x1, 8-bit RGBA
    idat = zlib.compress(b"\x00" + b"\x00\x00\x00\x00")   # one filtered row
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr)
            + chunk(b"IDAT", idat) + chunk(b"IEND", b""))


def pixel_tag(repo: str, page: str) -> str:
    """The exact markup a page carries.

    ONE definition, imported by `build_wiki.py` which writes it and by the
    check below which verifies it. Two copies of this string would agree today
    and drift the first time either side is edited, and the failure would be a
    wiki that silently stops counting.

    `alt=""` marks it decorative, so a screen reader skips it and a broken
    fetch leaves nothing visible. GitHub renders images from `github.com`
    directly rather than through its camo proxy, so the reader's browser asks
    GitHub for this asset and GitHub counts the request.
    """
    return ('<img src="https://github.com/%s/releases/download/%s/%s.png"'
            ' width="1" height="1" alt="">' % (repo, TAG, page))


def page_names(wiki_dir: str | Path) -> list[str]:
    """The built wiki pages that get a pixel, by page name (no extension)."""
    return sorted(p.stem for p in Path(wiki_dir).glob("*.md")
                  if p.stem not in NOT_A_PAGE)


def check(wiki_dir: str | Path, repo: str) -> list[str]:
    """Every page carries exactly one pixel, for THIS repo and THIS page."""
    problems = []
    for p in sorted(Path(wiki_dir).glob("*.md")):
        found = PIXEL_RE.findall(p.read_text(encoding="utf-8"))
        if p.stem in NOT_A_PAGE:
            if found:
                problems.append("%s is not a page and carries a pixel" % p.name)
            continue
        if not found:
            problems.append("%s carries no pixel" % p.name)
        elif len(found) > 1:
            problems.append("%s carries %d pixels" % (p.name, len(found)))
        else:
            got_repo, got_page = found[0]
            if got_repo != repo:
                problems.append("%s points at %s, not %s"
                                % (p.name, got_repo, repo))
            if got_page != p.stem:
                problems.append("%s carries the pixel of %s"
                                % (p.name, got_page))
    return problems


def _api(url: str, token: str, data: bytes | None = None,
         ctype: str = "application/json", method: str | None = None,
         tries: int = 5, sleep=time.sleep):
    """One API call, with the secondary rate limit handled rather than met.

    The first run on an existing corpus uploads one asset per page - 463 on
    the engine - and GitHub throttles bursts of content-creating requests with
    a 403 or 429 carrying `Retry-After`. Without this the first run is the one
    that fails, and it fails BEFORE the wiki push, so a hiccup here would block
    the publish entirely. Honouring the header is also what rule 11 asks for
    everywhere else this project talks to GitHub.

    A 404 is raised, not retried: `release()` reads one to decide the release
    has to be created.
    """
    for attempt in range(tries):
        req = urllib.request.Request(url, data=data, method=method)
        req.add_header("Authorization", "Bearer " + token)
        req.add_header("Accept", "application/vnd.github+json")
        if data is not None:
            req.add_header("Content-Type", ctype)
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            last_try = attempt == tries - 1
            if e.code not in (403, 429, 500, 502, 503) or last_try:
                raise
            wait = e.headers.get("Retry-After")
            wait = int(wait) if wait and wait.isdigit() else 2 ** attempt
            print("[pixels] %s from GitHub, waiting %ds (attempt %d of %d)"
                  % (e.code, wait, attempt + 1, tries), file=sys.stderr)
            sleep(wait)


def release(repo: str, token: str) -> dict:
    """The pixel release, created on first use."""
    try:
        return _api("https://api.github.com/repos/%s/releases/tags/%s"
                    % (repo, TAG), token)
    except urllib.error.HTTPError as e:
        if e.code != 404:
            raise
    body = ("One tiny image per wiki page. The download count of each asset is"
            " how many times that page was viewed. This is not a software"
            " release: see scripts/sync_article_pixels.py.")
    return _api("https://api.github.com/repos/%s/releases" % repo, token,
                json.dumps({"tag_name": TAG, "name": "Article views",
                            "body": body, "draft": False, "prerelease": False,
                            "make_latest": "false"}).encode(), method="POST")


def existing_assets(repo: str, rel_id: int, token: str) -> dict[str, int]:
    """Asset name -> download count, ALL of them.

    Paginated deliberately. The assets embedded in a release object are capped
    by the API, so reading them from there would silently report a corpus of
    hundreds of pages as a few dozen, and the sync would re-upload assets that
    already exist (which fails) or the reader would lose pages (which is
    worse, because it looks like zero views).
    """
    out: dict[str, int] = {}
    page = 1
    while True:
        batch = _api("https://api.github.com/repos/%s/releases/%d/assets"
                     "?per_page=100&page=%d" % (repo, rel_id, page), token)
        if not batch:
            return out
        for a in batch:
            out[a["name"]] = a["download_count"]
        page += 1


def sync(wiki_dir: str | Path, repo: str, token: str) -> int:
    pages = page_names(wiki_dir)
    rel = release(repo, token)
    have = existing_assets(repo, rel["id"], token)
    missing = [p for p in pages 
```

### Core Architecture Module: `src/invisible_playwright_mcp/__init__.py`
```
"""invisible_playwright_mcp: drive a stealth browser with an LLM from one command."""
# `__version__` describes the CODE that is about to run; the install record is
# a different fact and keeps a name that says so. Why the two can disagree, and
# what was advertising the wrong one: `_version.py`.
from ._version import __install_record_version__, __version__

__all__ = ["__version__", "__install_record_version__"]

```

### Core Architecture Module: `src/invisible_playwright_mcp/__main__.py`
```
from .cli import main

if __name__ == "__main__":
    main()

```

### Core Architecture Module: `src/invisible_playwright_mcp/_version.py`
```
"""What version the code being imported actually is.

⛔ AN INSTALL RECORD IS NOT A DESCRIPTION OF THE CODE, AND FOR AN EDITABLE
INSTALL IT STOPS BEING ONE THE MOMENT SOMEBODY PULLS. `importlib.metadata`
answers about the DISTRIBUTION the installer put there. For a wheel that is the
same artifact as the code, so the number is right and there is nothing truer to
read. For `pip install -e` the metadata is written once and the code keeps
moving, and nothing says the two have parted.

Measured on the machine this is developed on: the record said 0.54.0 while the
tree it points at said 0.68.8, fourteen patch releases apart, and the tree was
fully up to date at the time - pulling does not touch the record, which is what
makes this a defect in the code rather than a stale checkout.

⛔ AND THE NUMBER WAS BEING ADVERTISED. `mcp/server.py` sets the `initialize`
handshake's `serverInfo.version` from it, under a comment saying the field
exists so a client can "correlate a defect with a release"; the interface puts
the same number in the `build` field it serves. That handshake had already been
wrong once, advertising the MCP SDK's version for every build of this package,
and the remedy replaced it with a number that is also not ours in the install
mode the maintainers use every day.

⛔ A TEST HELD IT IN PLACE, AND THE WAY IT DID IS THE LESSON. It asserted that
the string `importlib.metadata` appeared in the source: a MECHANISM standing in
for the property that was actually wanted, which is `derived, never typed`. The
mechanism was the wrong one, so the test pinned the defect. This module answers
the property instead, and its test asserts the property.

The version of the code is:

  - a normal install: the install record, because the metadata and the code
    came out of the same build;
  - an editable install: the version the SOURCE TREE declares, because that is
    the code that will run, plus a `+editable` local segment (PEP 440) so it
    can never be read as the published release of the same number. An editable
    tree can carry uncommitted work, so a bare `0.68.8` would invite a bug
    report against a release that does not contain the code being run.

Which of the two an install is comes from what the installer WROTE, not from a
guess about `__file__`: PEP 610 puts `direct_url.json` beside the metadata,
carrying `dir_info.editable` and the source directory. A wheel install has no
such file at all.

The install record stays, under a name that cannot be mistaken for the version:
`pip`, `pip check` and anything reading `.dist-info` see that number, and
diagnosing the skew needs both. `invisible_core` made this same split first,
deriving its `__version__` from the seal it ships and naming the record
`__install_record_version__`; this is that decision, in the package that needed
it next.

⛔ AND `invisible_playwright` CARRIES THIS SAME READING, DELIBERATELY NOT SHARED,
SO A CORRECTION HERE IS WORTH LOOKING AT THERE. Putting it in one place would
mean `invisible_core`, and this package does not depend on the core: it would
gain one for eighty lines of standard library, on top of a package the wrapper
already pins exactly, which is a second constraint on the same distribution from
two directions. Nor is there one mechanism to unify - the core derives from an
artifact it PACKAGES, which is a different reading for a different reason. No
FACT is duplicated here: each package answers about itself. The mechanism is,
and naming the twin is the whole of what stops that from rotting.
"""
from __future__ import annotations

import json
import tomllib
from importlib.metadata import Distribution, PackageNotFoundError, distribution
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import url2pathname

#: What this package is called on the index, which is the dashed form: the
#: underscored one is the MODULE. `importlib.metadata` normalises the two to the
#: same distribution, so both resolve - and that is exactly why the wrong one
#: would never announce itself.
DISTRIBUTION = "invisible-playwright-mcp"

#: What a version says when there is nothing at all to read.
UNKNOWN = "0+unknown"

#: PEP 440 local segment marking a tree that is not a published artifact.
EDITABLE = "+editable"


def source_tree(dist: Distribution) -> Path | None:
    """The directory an EDITABLE install points at, or None for a normal one.

    Everything here is read from the record the installer wrote. The absence of
    `direct_url.json` is how a wheel install says it is one.
    """
    written = dist.read_text("direct_url.json")
    if not written:
        return None
    try:
        record = json.loads(written)
    except ValueError:
        return None
    if not isinstance(record, dict):
        return None
    if not (record.get("dir_info") or {}).get("editable"):
        return None
    url = record.get("url") or ""
    if not url.startswith("file:"):
        # An editable install of something fetched over the network leaves no
        # directory here to read, so the record is still the best there is.
        return None
    return Path(url2pathname(urlparse(url).path))


def declared_by(tree: Path) -> str | None:
    """The version that source tree declares, or None when it does not say one.

    `pyproject.toml` is where the version lives and the metadata is a copy of it
    taken at build time, so this goes back to the source of the copy rather than
    adding a second source. A tree declaring `dynamic = ["version"]` says
    nothing readable without running its build backend, and answering None there
    falls back to the record, which is the same answer as before this module.
    """
    try:
        parsed = tomllib.loads(
            (tree / "pyproject.toml").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    declared = (parsed.get("project") or {}).get("version")
    return declared if isinstance(declared, str) and declared else None


def versions(name: str = DISTRIBUTION) -> tuple[str, str]:
    """(the version of the CODE, the version in the install record).

    The two differ exactly when the install is editable and the tree has moved
    since it was installed, which on a machine where this is developed is most
    of the time. `name` is a parameter so the behaviour can be tested against a
    real editable install of a real distribution rather than against a double.
    """
    try:
        dist = distribution(name)
    except PackageNotFoundError:
        # A checkout on `sys.path` with nothing installed: no record to be
        # stale, and no recorded tree to read.
        return UNKNOWN, ""
    record = dist.version
    tree = source_tree(dist)
    if tree is None:
        return record, record
    declared = declared_by(tree)
    if declared is None:
        return record, record
    # Marked even when the two numbers agree: an editable tree is not the
    # published artifact whatever it declares, and that is what the marker says.
    return declared + EDITABLE, record


__version__, __install_record_version__ = versions()

__all__ = ["__version__", "__install_record_version__", "versions",
           "source_tree", "declared_by", "DISTRIBUTION", "EDITABLE", "UNKNOWN"]

```

### Core Architecture Module: `src/invisible_playwright_mcp/actions_help.py`
```
"""Turn a tool call into one readable line.

The difference between a step list somebody watches and a wall of JSON. The raw
arguments are already in the transcript the model sees; what the person on the
left needs is the target, in the shortest form that still identifies it.

Deliberately total: an unknown tool renders its arguments rather than raising or
printing nothing, because a new tool in the server must never make the UI go
quiet about what it just did.
"""
from __future__ import annotations


def _short(value, limit: int = 60) -> str:
    text = value if isinstance(value, str) else repr(value)
    text = " ".join(text.split())
    # "..." and not the single ellipsis character: these lines end up in a
    # terminal as often as in the page, and the Windows console is cp1252, where
    # one non-ASCII character in a print kills the process after the work is done.
    return text if len(text) <= limit else text[: limit - 3] + "..."


#: Anything that looks like it was typed once and must not be read twice. The
#: transcript is drawn on screen AND written to disk, so a password echoed here
#: outlives the session it was typed into.
SECRET = ("password", "passcode", "passwd", "otp", "2fa", "code", "token",
          "secret", "cvv", "pin")


def _looks_secret(selector: str) -> bool:
    low = (selector or "").lower()
    return any(word in low for word in SECRET)


def _mask(text: str) -> str:
    # ASCII only, deliberately: these lines are printed to a terminal as well as
    # drawn on the page, and one non-ASCII character in a print kills the process
    # on a cp1252 console after all the work is done.
    return "hidden, %d characters" % len(text)


def summarise(name: str, args: dict | None) -> str:
    """One line for one call. `where` names the browser only when the CALL did:
    the helper beside the identity turns 25 steps into 25 identical lines
    otherwise, and inventing a default would say more than the call said.
    """
    args = args or {}
    where = ""
    if name.startswith("browser_") and name != "browser_open" and args.get("browser") == "support":
        where = " in support"

    if name == "browser_open":
        return _short(args.get("browser") or "main", 40)
    if name == "browser_navigate":
        return _short(args.get("url", ""), 80) + where
    if name in ("browser_click",):
        return _short(args.get("selector", "")) + where
    if name == "browser_click_at":
        hold = args.get("hold_seconds") or 0
        at = "%s,%s" % (args.get("x"), args.get("y"))
        return at + (" hold %ss" % hold if hold else "") + where
    if name == "browser_type":
        # ⛔ A PASSWORD IS NOT A STEP DESCRIPTION. `Typed #passcode-input <-
        # 434262` was on screen and in the saved transcript: the line that exists
        # so a person can follow along was also the line that kept the secret.
        selector = args.get("selector", "")
        typed = args.get("text", "") or ""
        shown = _mask(typed) if _looks_secret(selector) else _short(typed, 40)
        return "%s <- %s%s" % (_short(selector, 40), shown, where)
    if name == "browser_press_key":
        return _short(args.get("key", ""), 20)
    if name == "browser_read_text":
        return _short(args.get("selector", "body")) + where
    if name == "browser_read_html":
        return "mode=%s" % _short(args.get("mode", "form"), 20) + where
    if name == "browser_evaluate":
        return _short(args.get("expression", ""), 70)
    if name in ("browser_snapshot", "browser_take_screenshot"):
        return where.strip()

    if not args:
        return ""
    return _short(", ".join("%s=%s" % (k, v) for k, v in args.items()), 70)

```

### Core Architecture Module: `src/invisible_playwright_mcp/agent.py`
```
"""The loop: model, tools, browser, repeat until it answers.

ONE loop. There were briefly two, which is how a README sentence saying "same
machinery" becomes false without anybody editing it: the second copy gets a fix,
the first does not, and the two answers diverge for a task that looks identical
from outside. They were merged, so this loop now has exactly one consumer in
the product: the interface, through `OpenRouterBrain` at the end of this file.
The suite drives the same loop, through a four-line helper that lives in the
suite rather than here.

The narration is a parameter rather than a mode. The interface passes the
callback that pushes events to the page; a caller that wants an answer and no
transcript passes nothing. A loop that knows whether it is being watched is a
loop with two behaviours to test.
"""
from __future__ import annotations

import asyncio
import json
from typing import Awaitable, Callable, List, Optional

from . import actions_help
from .link import answer_of

SYSTEM_PROMPT = (
    "You are a browser automation agent. You control a real, stealth Firefox "
    "browser ONLY through the provided tools. Inspect pages with "
    "browser_read_text / browser_snapshot / browser_read_html before acting on "
    "them. A person may be watching the browser while you work, so prefer one "
    "clear action at a time over long chains. When the task is done: first close "
    "the support browser with browser_close if you opened it and nothing more "
    "needs it, then reply with the answer, and call no more tools after that. "
    "Report only what the page "
    "actually shows. Say plainly what failed and what you could not check: the "
    "person reading is deciding what to do next. Write the way a competent "
    "colleague talks: the answer first, then what supports it. Do not announce "
    "what you are about to say, do not repeat the question back, and do not end "
    "by summarising what you just wrote - say it once. Prose by default. Use a "
    "heading, a list or a table only when the content really is one; a bold "
    "label in front of every paragraph is a template, not writing. Never use "
    "emoji: not as a status marker in front of a line, not as a bullet, not for "
    "emphasis, not one. Say in words whether something worked. Write every "
    "dash as a plain hyphen."
)
#: ⛔ THE EMOJI RULE IS FLAT, BECAUSE THE CONDITIONAL ONE WAS READ AS PERMISSION.
#: It used to say an emoji "is fine where it carries something the words do not,
#: and wrong as a status marker at the head of every line", and the answers came
#: back with a tick at the head of every line. A rule with an exception in it is
#: a rule the model satisfies by finding the exception.

#: ⛔ THE END-OF-TURN SENTENCE USED TO FORBID THE CALL THAT CLOSES `support`.
#: It said "reply with the answer and do NOT call any more tools", and the
#: only text that said to close the helper was the server's instructions,
#: which the loop never sent. Measured 2026-09-12 with the real model on a
#: task that needs both browsers: six runs out of six left `support` open,
#: and in the owner's own sessions one conversation of 247 steps used it 29
#: times and never closed it. The order is now part of the sentence about
#: ending, because that is the moment the model was told to stop.


def system_message(instructions: str = "") -> dict:
    """The one system message, from this build's prompt plus what the server
    says about itself.

    ⛔ ONE FUNCTION, THREE WRITERS. The message was assembled in the
    constructor, in the brain's restore and nowhere else, and the server's
    instructions - the only text that defines what `support` is for and that
    whoever opens it closes it - were in neither. They travel with the link
    and are refreshed at the start of every run, so a restored transcript and
    a new one carry the same current instructions.

    ⛔ AND THE TWO HALVES SAY DIFFERENT THINGS NOW. This prompt used to open
    with "open the browser with browser_open before anything else; if a tool
    answers that the browser is not open or is gone, call browser_open and
    carry on" - which is the server's first paragraph, in other words, glued
    to it a few lines later. The model read the same rule twice in one
    message, and two copies of a rule are two things to keep in agreement.

    The rule belongs to the server: it is a fact about the tools, and a
    standalone client that never sees this prompt still has to be told it.
    What is left here is what this loop owns - how the agent behaves, and how
    it WRITES.

    ⛔ AND MOVING IT MEANS THE SERVER MUST ACTUALLY STILL SAY IT, which is a
    thing to hold rather than to trust. A first draft of this change also made
    an empty `instructions` append a warning for the model to read; that was
    dropped, because the link launches this very server, so arriving here with
    nothing means the handshake failed and a sentence in the prompt helps
    nobody in that state. What guards the move instead is a gate over the
    server's own text: the rule has one home, and the gate says the home is
    not empty.
    """
    text = SYSTEM_PROMPT
    if instructions:
        text += chr(10) + chr(10) + instructions.strip()
    return {"role": "system", "content": text}


def said_only(messages) -> List[dict]:
    """The messages that are a TRANSCRIPT, which is everything anybody said.

    The system message is not one of them. It is what this build asks the model
    to be, it is rebuilt from `SYSTEM_PROMPT` plus the server's own instructions
    on every run, and a copy of it travelling with a conversation is a copy of
    CODE inside a file of DATA.

    ⛔ THE HALF THAT READS THIS RULE HAS EXISTED SINCE 2026-09-08; THE HALF THAT
    WRITES IT DID NOT. `remember` dropped the saved system message on the way
    in, because restoring it wholesale put an OLD prompt back and every change
    to the instructions reached new conversations only. Nothing stopped `save`
    from writing it, so every saved conversation went on carrying one - measured
    on the developer's own file, 1205 characters that nothing would ever read.
    Harmless in itself, and exactly the shape this project keeps finding one
    step later: the remedy for a stale duplicate is to stop WRITING it, not to
    keep remembering to ignore it.

    One function, both callers, so the two halves cannot come to disagree about
    what a transcript is.
    """
    return [m for m in messages or [] if m.get("role") != "system"]


Say = Callable[[str, str], Awaitable[None]]


async def _silent(_kind: str, _text: str) -> None:
    """The default narrator: says nothing, for a caller that wants an answer
    rather than a transcript."""


def mcp_tools_to_openai(tools) -> List[dict]:
    """MCP tool descriptions as OpenAI function definitions.

    Two details are load-bearing and both come from the API rejecting the
    alternative: `parameters` must be an object and never None, and the
    description is truncated because a long one is rejected rather than trimmed.
    """
    out = []
    for t in tools:
        out.append({
            "type": "function",
            "function": {
                "name": t.name,
                "description": (getattr(t, "description", "") or "")[:1024],
                "parameters": getattr(t, "inputSchema", None) or {"type": "object", "properties": {}},
            },
        })
    return out


# ⛔ `_result_text` STOOD HERE AND IT WAS `link.answer_of` WRITTEN OUT AGAIN. Five
# lines, the `[non-text result]` literal included, reading the same wire format
# from the same objects - while `text_of` in that module carried a docstring
# saying it was shared with this loop precisely so the two could not drift. It
# was not shared; it was copied. Both copies had tests, so either could have
# moved alone and stayed green.
#
# The loop reads `link.answer_of` now, and the measured account of why the flag is
# read at all travels with it. What is NOT here is an alias keeping the old
# name alive: the tests that held this function moved to the function, the way
# `run_task` and `Sessions.around` moved to the suite that was their only
# caller.


#: How much of a tool result the WATCHER is shown, and how much the MODEL is
#: sent. Two different jobs - the page is a window on the work, the message list
#: is what every later turn pays for - so the two numbers differ on purpose.
SHOWN, SENT = 1200, 8000


def shorten(text: str, limit: int, where: str) -> str:
    """`text` cut to `limit`, saying so whenever it cuts.

    ⛔ IT CUT IN SILENCE, AND THE PERSON WATCHING GOT THE SMALLER COPY. A read
    of a real page is tens of kilobytes; the page showed the first 1200
    characters, stopping mid-word with no ellipsis, no count and no hint that
    anything had been removed, while the line below handed the model nearly
    seven times as much. Somebody expanding a step to audit what the agent saw
    read a partial page as the whole one. The product's whole claim is that you
    can watch what it does, and the watcher was the one being given less.

    Both callers say it now, because the model reading a truncated page without
    being told is the same defect one level up: it can ask for the rest, but
    only if it knows there is a rest.

    The marker starts on a new line so the page files the result into an
    expandable block rather than onto the step row, and it is ASCII: a
    non-ASCII character on a line this server may print is a known way to kill
    the process on Windows.
    """
    if len(text) <= limit:
        return text
    return "%s\n[... %d more characters, not %s]" % (
        text[:limit], len(text) - limit, where)


def unknown_tool(name: str, known) -> str:
    """What the model is told when it calls a tool this server does not have.

    Written for the mistake actually made rather than for a typo in general:
    the names it reaches for are the old session tools, a
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1332** (2026-09-18): **[BUG]: Potential AI Response Handling Issue in Core Module**
  *Symptoms*: ### Describe the bug  During routine testing and integration with AIHawk core modules, inconsistencies were observed in AI response handling when processing edge cases with complex prompts and varied LLM configurations.  ### Steps to reproduce  1. Use branch named 'main' 2. Go to file containing AI response handler 3. Process a complex multi-turn conversation prompt 4. Execute with various LLM providers 5. Run program using command 'python -m aihawk' 6. Observe inconsistent response parsing behavior  ### Expected behavior  AI responses should be consistently parsed and handled regardless of complexity level and LLM provider, with proper error handling for edge cases.  ### Actual behavior  Occasional parsing failures and inconsistent handling of responses from different LLM providers, particularly with longer or more complex prompts.  ### Branch  main  ### Branch name  _No response_  ### Python version  3.10+  ### LLM Used  Multiple (ChatGPT, Claude, Gemini)  ### Model used  GPT-4, Claude-3, Gemini-Pro  ### Additional context  This issue impacts the reliability of AIHawk when used with different LLM providers and prompt complexities. A comprehensive review of response handling and parsing logic is recommended to ensure robustness across all supported configurations.

- **Issue #1145** (2026-01-16): **[BUG]: <Provide a clear, descriptive title>**
  *Symptoms*: ### Describe the bug  _No response_  ### Steps to reproduce  _No response_  ### Expected behavior  _No response_  ### Actual behavior  _No response_  ### Branch  main  ### Branch name  _No response_  ### Python version  _No response_  ### LLM Used  _No response_  ### Model used  _No response_  ### Additional context  _No response_

- **Issue #1144** (2026-01-16): **[BUG]: <Provide a clear, descriptive title>**
  *Symptoms*: ### Describe the bug  _No response_  ### Steps to reproduce  _No response_  ### Expected behavior  _No response_  ### Actual behavior  _No response_  ### Branch  None  ### Branch name  _No response_  ### Python version  _No response_  ### LLM Used  _No response_  ### Model used  _No response_  ### Additional context  _No response_

- **Issue #1143** (2026-01-16): **[BUG]: <Provide a clear,**
  *Symptoms*: Edmilson 

- **Issue #1142** (2026-01-16): **[BUG]: <Provide a clear, descriptive title>**
  *Symptoms*: ### Describe the bug  _No response_  ### Steps to reproduce  Revolução tecnologicas   ### Expected behavior  _No response_  ### Actual behavior  _No response_  ### Branch  None  ### Branch name  _No response_  ### Python version  _No response_  ### LLM Used  _No response_  ### Model used  _No response_  ### Additional context  _No response_

- **Issue #1141** (2026-01-16): **Edmilson **
  *Symptoms*: ### Describe the bug  _No response_  ### Steps to reproduce  _No response_  ### Expected behavior  _No response_  ### Actual behavior  _No response_  ### Branch  None  ### Branch name  _No response_  ### Python version  _No response_  ### LLM Used  _No response_  ### Model used  _No response_  ### Additional context  [](url)

- **Issue #1140** (2026-01-16): **[BUG]: <Provide a clear, descriptive title>**
  *Symptoms*: ### Describe the bug  _No response_  ### Steps to reproduce  _No response_  ### Expected behavior  _No response_  ### Actual behavior  _No response_  ### Branch  None  ### Branch name  _No response_  ### Python version  _No response_  ### LLM Used  IA gbt   ### Model used  _No response_  ### Additional context  _No response_

- **Issue #1139** (2026-01-16): **[BUG]: <Provide a clear, descriptive title>**
  *Symptoms*: ### Describe the bug  _No response_  ### Steps to reproduce  _No response_  ### Expected behavior  _No response_  ### Actual behavior  _No response_  ### Branch  main  ### Branch name  _No response_  ### Python version  _No response_  ### LLM Used  _No response_  ### Model used  _No response_  ### Additional context  _No response_

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

### Incident Patch 1: `89d125e5` (2026-09-23)
**Commit Message**: The README is checked for promises no measurement supports, in the required gate (#1391)

The claim scan that found "it passes every bot detection test" on the wrapper's
README ran by hand, from outside every repository, after the text was public.
It is invisible_core.claims since core 34.29.0, and it now runs in content-gates,
the job branch protection requires, with its selftest first, like the language
gate.

What it reads is the README, which is also what PyPI shows. A circumvention
claim on its own stays allowed and is only reported; on this README today it
refuses nothing.

**File**: `.github/workflows/content-gates.yml` (modified, +11/-0)
```diff
@@ -18,6 +18,17 @@ jobs:
         run: python scripts/check_content.py --selftest
       - name: Content gates
         run: python scripts/check_content.py
+      # A README that promises to beat everything is refused here: an absolute,
+      # a circumvention word and a protection word in one sentence. The logic is
+      # `invisible_core.claims` since core 34.29.0, shared with the wrapper, and
+      # it sits in THIS job because `gate` is the context branch protection
+      # requires. A circumvention claim on its own stays allowed and is only
+      # reported. What it reads is the README, which is also what PyPI shows.
+      - name: The README promises nothing it cannot support
+        run: |
+          python -m pip install --upgrade pip "invisible-core>=34.29.0"
+          python -m invisible_core.claims --selftest
+          python -m invisible_core.claims
       - name: Wiki renders end to end
         run: |
           python scripts/build_wiki.py docs /tmp/wiki-out
```

---

### Incident Patch 2: `5c6aa09f` (2026-09-18)
**Commit Message**: The floor carries the click fix, or the fix reaches nobody who already had a wheel (#1367)

`invisible-playwright` is declared with `>=`, so somebody who already has an
older wheel installed updates this package and keeps whatever that wheel does.
Up to 0.22.0 that means a click is not delivered once: the driver read the hit
target again AFTER the event and turned what it found into a retry, so any
control that stops being hittable by its own effect got pressed again.

Measured on 0.22.0: a button that hides itself took 1068 clicks across 30
calls, and every call then reported failure; a toggle was flipped twice by one
call and reported success. That is a modal's close, a cookie banner's accept, a
menu item, a submit that becomes a spinner - most of what an agent clicks.

The floor moves from 0.16.2 to 0.22.1, and the reason joins the three already
written beside it, in the same form: a version here is the first release in
which the named behaviour is true.

And the reasons stop being a comment nobody reads. `WHAT_THE_TOOLS_NEED` lists
each floor with what breaks below it, and two tests hold it from both sides:
the declared floor may not be below any version in the list, and every 

**File**: `manifest.json` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
   "manifest_version": "0.4",
   "name": "aihawk",
   "display_name": "AIHawk",
-  "version": "0.68.6",
+  "version": "0.68.7",
   "description": "AI browser agent: browses, clicks, types, and reads real web pages from plain-English instructions.",
   "long_description": "AIHawk gives an MCP client a real browser to drive. The tools navigate, click, type, read and screenshot pages the way a person would, on a patched Firefox engine.\n\nThe engine is downloaded once, outside this bundle, with `uvx invisible-playwright fetch`. Until that has run, every browser tool reports that the engine is missing.",
   "author": {
```

**File**: `pyproject.toml` (modified, +16/-2)
```diff
@@ -4,7 +4,7 @@ build-backend = "hatchling.build"
 
 [project]
 name = "aihawk"
-version = "0.68.6"
+version = "0.68.7"
 description = "Anti detect browser and web browsing agent: undetected, no captchas, no blocks"
 readme = "README.md"
 requires-python = ">=3.11"
@@ -41,7 +41,21 @@ dependencies = [
     # url, and both are read off what page.goto() answers. Until 0.13.2 that
     # was hardcoded to None on every navigation, so on an older wheel the tool
     # would tell a model "no HTTP response" for every page it ever visited.
-    "invisible-playwright>=0.16.2",
+    #
+    # ⛔ >=0.22.1 BECAUSE BELOW IT A CLICK IS NOT DELIVERED ONCE, AND THE FLOOR
+    # IS THE ONLY THING THAT SAYS SO. Up to 0.22.0 the driver read the hit
+    # target again AFTER the event and turned what it found into a retry, so
+    # any control that stops being hittable by its own effect was pressed
+    # again: measured, a button that hides itself took 1068 clicks across 30
+    # calls and every call then reported failure, and a toggle was flipped
+    # twice by one call and reported success. That is a modal's close, a
+    # cookie banner's accept, a menu item, a submit that becomes a spinner.
+    #
+    # A floor and not a pin, like every line above it - but this one is the
+    # reason the floor moved at all. Somebody who already had 0.22.0 installed
+    # would otherwise update this package and keep the defect, which is the
+    # shape of every dependency bug that survives its own fix.
+    "invisible-playwright>=0.22.1",
     # HTML parsing for browser_read_html. Chosen over lxml by measurement: on
     # six real pages both found byte-identical sets of interactive elements,
     # so correctness did not separate them, and selectolax then parsed 3-5x
```

**File**: `server.json` (modified, +2/-2)
```diff
@@ -7,13 +7,13 @@
     "url": "https://github.com/feder-cr/AIHawk",
     "source": "github"
   },
-  "version": "0.68.6",
+  "version": "0.68.7",
   "packages": [
     {
       "registryType": "pypi",
       "registryBaseUrl": "https://pypi.org",
       "identifier": "aihawk",
-      "version": "0.68.6",
+      "version": "0.68.7",
       "runtimeHint": "uvx",
       "transport": {
         "type": "stdio"
```

**File**: `tests/test_the_floor_carries_what_the_tools_need.py` (added, +88/-0)
```diff
@@ -0,0 +1,88 @@
+"""The declared floor is not below a version this package's behaviour needs.
+
+⛔ A FLOOR IS THE ONLY THING THAT MAKES A FIX IN A DEPENDENCY REACH ANYBODY.
+`invisible-playwright` is declared with `>=`, so a person who already has an
+older wheel installed updates this package and keeps whatever that wheel does.
+For a defect in the driver that is not a detail: up to 0.22.0 a click was not
+delivered once - the hit target was read again AFTER the event and what it
+found was turned into a retry, so any control that stops being hittable by its
+own effect got pressed again. Measured on that version: a button that hides
+itself took 1068 clicks across 30 calls, and every call then reported failure.
+
+The floor was raised to 0.22.1 for that. This test exists so the next person to
+touch the dependency line cannot lower it back without noticing, and so the
+reason is carried by something that runs rather than by a comment nobody reads.
+
+⛔ AND IT READS THE DECLARATION, NOT WHAT IS INSTALLED. A test that asked the
+interpreter which version is importable would pass on this machine, where the
+wrapper is installed from a checkout, and say nothing at all about what a user
+who runs `pip install aihawk` will get - which is the only thing a floor
+decides.
+"""
+from __future__ import annotations
+
+import re
+import tomllib
+from pathlib import Path
+
+#: Every floor this package's own behaviour depends on, with what breaks below
+#: it. A version here is not a preference: it is the first release in which the
+#: named behaviour is true.
+WHAT_THE_TOOLS_NEED = {
+    "invisible-playwright": [
+        ("0.13.0", "browser_watch and the live pane are built on page.screencast"),
+        ("0.13.2", "browser_navigate reports the HTTP status and the landed url"),
+        ("0.22.1", "a click is delivered once, whatever the click does to the page"),
+    ],
+}
+
+
+def _declared() -> dict:
+    raw = Path(__file__).resolve().parents[1] / "pyproject.toml"
+    with raw.open("rb") as f:
+        data = tomllib.load(f)
+    out = {}
+    for line in data["project"]["dependencies"]:
+        m = re.match(r"^([A-Za-z0-9_.-]+)\s*>=\s*([0-9][0-9A-Za-z.]*)", line.strip())
+        if m:
+            out[m.group(1).lower()] = m.group(2)
+    return out
+
+
+def _as_numbers(version: str):
+    return tuple(int(p) for p in re.findall(r"\d+", version))
+
+
+def test_every_floor_is_high_enough_for_what_this_package_does():
+    """⛔ THE KNOWN-BAD: put `invisible-playwright>=0.16.2` back. The comment
+    beside it would still explain three of the four reasons, and the fourth -
+    the one that makes a click happen once - would silently stop reaching
+    anybody who already had an older wheel."""
+    declared = _declared()
+    troppo_basso = []
+    for name, needs in WHAT_THE_TOOLS_NEED.items():
+        floor = declared.get(name)
+        assert floor, "%s is not declared with a floor at all" % name
+        for wanted, why in needs:
+            if _as_numbers(floor) < _as_numbers(wanted):
+                troppo_basso.append("%s>=%s is below %s, which is where %s"
+                                    % (name, floor, wanted, why))
+    assert not troppo_basso, "\n  ".join([""] + troppo_basso)
+
+
+def test_the_reasons_are_not_a_list_nobody_updates():
+    """The other direction, so this file cannot rot into a decoration: every
+    reason recorded here has to name a version that the floor actually reached,
+    or the list is describing a past that the declaration has moved on from and
+    the test above is comparing against nothing."""
+    declared = _declared()
+    for name, needs in WHAT_THE_TOOLS_NEED.items():
+        floor = _as_numbers(declared[name])
+        raggiunte = [w for w, _ in needs if _as_numbers(w) <= floor]
+        assert len(raggiunte) == len(needs), (
+            "%s declares >=%s, so these reasons name versions it never reached: %r"
+            % (name, declared[name],
+               [w for w, _ in needs if _as_numbers(w) > floor]))
+        assert needs[-1][0] == max((w for w, _ in needs), key=_as_numbers), (
+            "the highest version is not last, so the list no longer reads as a "
+            "history and the next person will append below the floor")
```

---

### Incident Patch 3: `b1fb808c` (2026-09-14)
**Commit Message**: The piece of work is one object, a rebuild is said, and a dead browser is a type (0.51.0) (#1326)

The server held its whole lifecycle in four module globals - the registry, a restored flag, the pages seen and the pages owed - and a dozen free functions reading them. Every fixture that wanted a clean server rebuilt all four by hand, which is the tell of state that wants to be one thing with one lifecycle; the cost showed three times in one afternoon (#1324).

`Work` now owns it: declare, wake, look, act, remember, close, each one method, documented in the order it happens. The server builds one from `AIHAWK_SESSION_ID` and every tool goes through it; a test installs one of its own with a factory that launches nothing. `server.py` is 783 lines where it was 1231, with nothing added but the object.

A rebuild is no longer silent: `browser_navigate` says in front of its answer that the browser had died and was reopened as the same person, so a person watching the window close and reopen reads the same thing in the transcript.

And a dead browser is recognised by its type: invisible-playwright 0.15.0 raises one `TargetClosedError` for a disposed object and a closed pipe alike and export

**File**: `docs/mcp-server.md` (modified, +4/-1)
```diff
@@ -181,7 +181,10 @@ reported as it happened, on the browser you have, with its cookies and its
 pages intact. Only a browser that is actually gone is rebuilt as the same
 identity, and the command retried once. Before 0.50.0 any failure closed the
 browser and opened a new one to try again, which failed the same way a browser
-later.
+later. From 0.51.0 a rebuild is said: the answer starts with "the main browser
+had died and was reopened as the same person, on the page it was on", so a
+model knows an ephemeral browser's cookies are gone and a login may need
+redoing.
 
 If the tools do not appear in your client, the fastest way to tell a broken
 registration from a broken server is to skip the client:
```

**File**: `manifest.json` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
   "manifest_version": "0.4",
   "name": "aihawk",
   "display_name": "AIHawk",
-  "version": "0.50.0",
+  "version": "0.51.0",
   "description": "AI browser agent: browses, clicks, types, and reads real web pages from plain-English instructions.",
   "long_description": "AIHawk gives an MCP client a real browser to drive. The tools navigate, click, type, read and screenshot pages the way a person would, on a patched Firefox engine.\n\nThe engine is downloaded once, outside this bundle, with `uvx invisible-playwright fetch`. Until that has run, every browser tool reports that the engine is missing.",
   "author": {
```

**File**: `pyproject.toml` (modified, +2/-2)
```diff
@@ -4,7 +4,7 @@ build-backend = "hatchling.build"
 
 [project]
 name = "aihawk"
-version = "0.50.0"
+version = "0.51.0"
 description = "Anti detect browser and web browsing agent: undetected, no captchas, no blocks"
 readme = "README.md"
 requires-python = ">=3.11"
@@ -41,7 +41,7 @@ dependencies = [
     # url, and both are read off what page.goto() answers. Until 0.13.2 that
     # was hardcoded to None on every navigation, so on an older wheel the tool
     # would tell a model "no HTTP response" for every page it ever visited.
-    "invisible-playwright>=0.14.0",
+    "invisible-playwright>=0.15.0",
     # HTML parsing for browser_read_html. Chosen over lxml by measurement: on
     # six real pages both found byte-identical sets of interactive elements,
     # so correctness did not separate them, and selectolax then parsed 3-5x
```

**File**: `server.json` (modified, +2/-2)
```diff
@@ -7,13 +7,13 @@
     "url": "https://github.com/feder-cr/AIHawk",
     "source": "github"
   },
-  "version": "0.50.0",
+  "version": "0.51.0",
   "packages": [
     {
       "registryType": "pypi",
       "registryBaseUrl": "https://pypi.org",
       "identifier": "aihawk",
-      "version": "0.50.0",
+      "version": "0.51.0",
       "runtimeHint": "uvx",
       "transport": {
         "type": "stdio"
```

**File**: `src/aihawk/mcp/registry.py` (modified, +17/-20)
```diff
@@ -25,6 +25,8 @@
 import asyncio
 from typing import Dict, Optional
 
+from invisible_playwright.async_api import TargetClosedError
+
 from .session import StealthSession
 
 # ⛔ `DEFAULT_SESSION_ID` MOVED TO `store.py`, WHICH IS WHAT IT NAMES: a
@@ -57,31 +59,26 @@ def _is_usable(session) -> bool:
         return False
 
 
-#: What a browser that is GONE says, from the two layers that can say it. The
-#: vendored client raises `TargetClosedError` carrying the first sentence for
-#: any call on a page, context or browser that has closed; the Juggler bridge
-#: answers the other two when the pipe to Firefox is gone. Matched on the text
-#: because they reach a tool as plain exceptions from two classes that share no
-#: base worth importing here.
-CLOSED_SENTENCES = ("has been closed", "the pipe closed", "the pipe is closed")
-
-
 def looks_closed(failure: BaseException) -> bool:
     """Whether this failure is the browser being gone, rather than the page
     refusing.
 
-    ⛔ THE DIFFERENCE IS A BROWSER. `_retrying` in the server used to treat
-    EVERY exception as a dead browser: close the one it had, build a new one,
-    retry. A domain that does not resolve, a site that answers slowly, a click
-    that finds nothing - each threw away a healthy browser with its cookies,
-    its logins and its pages, and opened a fresh one to fail the same way
-    again. Measured 2026-09-14: `NS_ERROR_UNKNOWN_HOST` on the second command
-    of a conversation cost the interface's `main` browser, and the person
-    watched it close and reopen - the window was headed - for a typo in a
-    domain name. The retry then failed identically, so nothing was gained.
+    ⛔ THE DIFFERENCE IS A BROWSER. `retrying` used to treat EVERY exception
+    as a dead browser: close the one it had, build a new one, retry. A domain
+    that does not resolve, a site that answers slowly, a click that finds
+    nothing - each threw away a healthy browser with its cookies, its logins
+    and its pages, and opened a fresh one to fail the same way again.
+    Measured 2026-09-14: `NS_ERROR_UNKNOWN_HOST` on the second command of a
+    conversation cost the interface's `main` browser, and the person watched
+    it close and reopen - the window was headed - for a typo in a domain name.
+
+    ⛔ THE TYPE, NOT THE SENTENCE. For one release (0.50.0) this matched three
+    sentences, because the engine's wrapper raised two classes with one name
+    for a disposed object and a nameless error for a closed pipe. From
+    invisible-playwright 0.15.0 both are ONE class, exported from its public
+    API, which is the floor `pyproject.toml` declares for exactly this line.
     """
-    text = str(failure)
-    return any(sentence in text for sentence in CLOSED_SENTENCES)
+    return isinstance(failure, TargetClosedError)
 
 
 class BrowserRegistry:
```

**File**: `src/aihawk/mcp/server.py` (modified, +66/-517)
```diff
@@ -51,27 +51,35 @@
 from mcp.types import ToolAnnotations
 
 from . import NOTHING_RUNNING, __version__, actions, identity, plan, store
-from .registry import BrowserRegistry
+from .work import (DEFAULT_BROWSER_ID, MAX_BROWSERS_PER_SESSION, REBUILT,
+                   SUPPORT_BROWSER_ID, Work)
 
 # Kept for callers that imported it from here. The implementation moved.
 _json_capped = actions.json_capped
 
-def new_registry(**kwargs) -> BrowserRegistry:
-    """A registry wired to write its sessions down.
-
-    ⛔ ONE CONSTRUCTOR, USED BY THE SERVER AND BY THE TESTS. A test that builds
-    a bare `BrowserRegistry` is testing a registry the product does not have,
-    and the wiring below - the thing that makes a session survive the process -
-    would be exercised by nothing. It is a function rather than a line because
-    the tests need to build one with a factory that launches no browser, and
-    the alternative was each of them repeating the wiring or, more likely, not.
-    """
-    reg = BrowserRegistry(**kwargs)
-    reg.on_change = lambda key: remember()
-    return reg
-
+#: ⛔ WHERE THIS PROCESS'S OWN PIECE OF WORK COMES FROM, AND THE ONLY PLACE
+#: THAT KNOWS IT EXISTS. Read from the environment ONCE, exactly like
+#: `STEALTHFOX_SEED` or `STEALTHFOX_PROXY` in `plan.py` - never a tool
+#: argument, never a name in a published schema, never something a model can
+#: read, pass, list or invent. There is exactly one of these for the life of
+#: the process, and nothing below can ask about, name, or reach a second one.
+#:
+#: Whoever spawns this process decides the value. The interface spawns one
+#: server PER CONVERSATION and sets this to that conversation's own id, so two
+#: conversations are two PROCESSES, each with its own saved browser on disk. A
+#: standalone client (`uvx aihawk`, or this module run directly) never sets it
+#: and lands on the same name every caller landed on before this had a name at
+#: all: `DEFAULT_SESSION_ID`. Two standalone clients on one machine therefore
+#: share a file, which is recorded as an open question in the workbench and
+#: not decided here.
+_SESSION_ID = os.environ.get("AIHAWK_SESSION_ID") or store.DEFAULT_SESSION_ID
 
-registry = new_registry()
+#: The one piece of work this process serves: its two browsers, where they
+#: were, and the file they are written to. Every tool below goes through it,
+#: and a test installs one of its own here, built with a factory that
+#: launches nothing - one object in place of the four globals this module
+#: used to hold. The lifecycle is documented on the class.
+work = Work(_SESSION_ID)
 
 
 #: Set by main(). Over stdio the SDK enters the lifespan once per process, so
@@ -102,7 +110,7 @@ async def _lifespan(_server):
         yield {}
     finally:
         if _close_on_lifespan_exit:
-            await registry.close_all()
+            await work.close_all()
 
 
 def _close_sessions_at_exit() -> None:
@@ -116,7 +124,7 @@ def _close_sessions_at_exit() -> None:
     seconds, then the process is allowed to end.
     """
     try:
-        asyncio.run(asyncio.wait_for(registry.close_all(), 10))
+        asyncio.run(asyncio.wait_for(work.close_all(), 10))
     except Exception:
         pass
 
@@ -236,18 +244,15 @@ def _says(title: str, *, read_only: bool = False, destructive: bool = False,
     form submitted or a page left behind cannot be undone from this side.
     `open_world` says the tool reaches the live web.
 
-    ⛔ AND THERE IS A THIRD GROUP, which five tools belonged to while claiming
-    to be the first. `browser_read_text`, `browser_snapshot`,
-    `browser_read_html`, `browser_take_screenshot` and `browser_evaluate` go
-    through `ready()`, which STARTS a real Firefox when none is running. A
-    tool that can spawn a browser has modified its environment, so
-    `readOnlyHint` was false in fact and true on the wire, and a client
-    trusting it ran them unattended. They now say read-only NO and destructive
-    NO, which is the honest reading: additive - it may bring something into
-    being, it will not wreck anything. Nothing on the page changes either way.
-    Stating both explicitly is what makes that group legible: an ABSENT hint
-    and a hint set to false are different facts, and a client reading MCP's
-    defaults treats a missing `destructiveHint` as true.
+    ⛔ AND UNTIL 0.48.0 THERE WAS A THIRD GROUP, five tools that claimed to be
+    the first while going through the wake funnel, which STARTS a real Firefox
+    when none is running. A tool that can spawn a browser has modified its
+    environment, so `readOnlyHint` was false in fact and true on the wire, and
+    a client trusting it ran them unattended. The reads go through
+    `Work.already_open` now, which refuses instead of starting, so the hint
+    is true again. Stating both hints explicitly is what keeps that legible:
+    an ABSENT hint and a hint set to false are different facts, and a client
+    reading MCP's defaul
```

**File**: `src/aihawk/mcp/work.py` (added, +362/-0)
```diff
@@ -0,0 +1,362 @@
+"""One piece of work: the two browsers this process serves, where each one
+was, and the file it is all written down in.
+
+⛔ AN OBJECT, WHERE THIS WAS FOUR MODULE GLOBALS AND A DOZEN FUNCTIONS READING
+THEM. `registry`, `_restored`, `_seen_tabs` and `_tabs_owed` sat at the top of
+`server.py`, and every fixture that wanted a clean server rebuilt all four by
+hand - the tell of state that wants to be one thing with one lifecycle. The
+cost showed on 2026-09-14, three times in one afternoon: the session file
+carried a launch flag because "what this process decides" and "who a browser
+is" had no place to be different in; a rebuild on ANY failure was a bare
+`except` in a free function, and nobody noticed a healthy browser being thrown
+away over a domain that did not resolve; and the rebuild itself was silent,
+so a person watching the window saw it close and reopen with no word about it
+in the transcript. The workbench records them as [B202], [B203] and [B204].
+
+The lifecycle, in the order it happens:
+
+  declare   `restore()` reads the saved file and declares who `main` is,
+            without starting anything.
+  wake      `ready()` starts a declared browser the first time a COMMAND is
+            aimed at it, and reopens the one page the file owed it.
+  look      `looking()` and `already_open()` answer a browser that is running
+            and never start one: a question is not a command.
+  act       `retrying()` runs one action, and rebuilds the browser once - as
+            the same person, back on its page - only if the browser is GONE.
+  remember  `remember()` writes down who is held and where, on every change
+            of identity and every move of a page.
+  close     `close_all()` at the end of the process.
+
+There is exactly one of these per process, because a process serves exactly
+one piece of work; `server.py` builds it from `AIHAWK_SESSION_ID` and every
+tool goes through it. A test builds its own with a factory that launches no
+browser and installs it in the server's place: one object, not four globals.
+"""
+from __future__ import annotations
+
+from typing import Awaitable, Callable, Optional
+
+from . import actions, plan, store
+from .registry import BrowserRegistry
+from .session import StealthSession
+
+#: The browser a caller means when it names nothing.
+DEFAULT_BROWSER_ID = "main"
+
+#: The other one. See MAX_BROWSERS_PER_SESSION for why there are exactly two.
+SUPPORT_BROWSER_ID = "support"
+
+#: TWO browsers in one piece of work, with fixed roles, and the number is a
+#: decision rather than a measurement - the opposite of what it was until
+#: 2026-09-11.
+#:
+#: It used to be eight, and the eight was measured: 61 processes and 6,515 MB,
+#: the eighth taking 13.6 s to start against the first one's 6.8. Nothing about
+#: that stopped being true. What changed is what a session MEANS. Identity lives
+#: on the browser - seed, fingerprint, profile - so a session holding eight
+#: browsers held eight identities while everything above it, the transcript and
+#: the saved state and anything a person attaches to a session, was addressed
+#: to one. "Whose is this?" had two possible answers and no way to choose.
+#:
+#: So a session is ONE identity, `main`, plus ONE helper beside it, `support`,
+#: for the things that must not touch that identity: a temporary mailbox to
+#: receive a verification, a lookup, a second opinion on a page. It is a
+#: browser and not a tab because a tab would share cookies and fingerprint with
+#: the site the identity is being built on, and the whole point of the helper
+#: is that it does not. The helper is not saved and not restored - it dies with
+#: the process - because a helper that survives IS a second identity, which is
+#: the thing this number exists to rule out.
+#:
+#: The roles are NAMES A CALLER CANNOT INVENT. `browser` on every tool is a
+#: closed choice, `main` or `support`, so nothing here ever holds a browser
+#: called `b3` or `walmart-jobs` again. The design that went with the eight is
+#: in the workbench, under
+#: `docs_research/chat-ui-performance/30-PROGETTO-sessioni-e-otto-browser.md`.
+MAX_BROWSERS_PER_SESSION = 2
+
+#: The launch settings that say WHO a browser is, and so the ones a saved file
+#: carries. Everything else in the launch kwargs describes THIS LAUNCH - the
+#: engine it runs on, whether its window is shown - and is decided by
+#: `plan.launched_here` every time, never read back from a file. Both halves
+#: of that were measured by getting them wrong: `binary_path` saved would
+#: restore a browser onto a path that means nothing on another machine, and
+#: `headless` saved (until 0.50.0) made one headed run decide for every later
+#: process that read the same file.
+#:
+#: ⛔ THESE ARE THE LAUNCH KWARGS' OWN NAMES, NOT THE TOOL ARGUMENTS' NAMES:
+#: this list said `profile` for its first day, the launch kwarg is
+#: `profile_dir`, so the filter matched nothing and the profile - t
```

**File**: `tests/conftest.py` (modified, +9/-15)
```diff
@@ -137,11 +137,10 @@ def _aihawk_home_is_disposable(tmp_path, monkeypatch):
 
 @pytest.fixture(autouse=True)
 def _the_server_remembers_nothing_from_the_last_test():
-    """The four things the server module holds between calls.
+    """The one thing the server module holds between calls, made new.
 
-    Emptied rather than replaced: a test that monkeypatches one of them still
-    gets its own, and a test that does not gets an empty one instead of
-    whatever the file before it left.
+    Replaced, so a test that does not install its own `Work` gets an empty
+    one instead of whatever the file before it left.
 
     ⛔ LOOKED UP IN `sys.modules`, NEVER IMPORTED, and the first version got
     that wrong. An autouse fixture runs for EVERY test in the repository, so
@@ -156,17 +155,12 @@ def _the_server_remembers_nothing_from_the_last_test():
     nothing to clear.
     """
     server = sys.modules.get("aihawk.mcp.server")
-    if server is not None:
-        for held in ("_seen_tabs", "_tabs_owed"):
-            got = getattr(server, held, None)
-            if got is not None:
-                got.clear()
-        # ⛔ NOT A DICT SINCE 2026-09-11. `_restored` used to be `_loaded`, a
-        # set keyed by session id, because one process could hold several. It
-        # is a single flag now: one process, one piece of work, restored at
-        # most once.
-        if hasattr(server, "_restored"):
-            server._restored = False
+    if server is not None and hasattr(server, "Work"):
+        # ⛔ ONE OBJECT, WHERE THIS CLEARED FOUR GLOBALS BY NAME. The server
+        # holds its whole piece of work - registry, restored flag, pages seen
+        # and pages owed - in one `Work`, so a clean server is a new one; a
+        # test that installs its own through monkeypatch still gets its own.
+        server.work = server.Work(server._SESSION_ID)
     yield
 
 
```

---

### Incident Patch 4: `e75296e7` (2026-09-14)
**Commit Message**: A page that refuses keeps its browser, a launch flag stays out of the identity file, and a quiet capture is started again (0.50.0) (#1324)

Three defects seen in one afternoon on the interface, each with its cause one step upstream of where it showed.

**The browser closed and reopened on a domain that did not resolve.** The retry wrapper treated every exception as a dead browser: it discarded the healthy one, with its cookies and pages, built a replacement as the same person and ran the action again, which failed identically. Only a browser that is gone is rebuilt now, and what "gone" means lives in one place, next to the check that decides it between calls.

**The main browser came up on screen at a launch that had asked for nothing of the kind.** The session file carried `headless: false` from a headed process that had used the same file name, and the restore took the file's word over this process's. Whether a window is shown is a property of the launch, like the engine, so it is no longer written down and the restore reads it from the environment alongside the engine.

**The live pane froze on a page the browser had left two sites earlier.** The engine's window capture ends for

**File**: `docs/mcp-server.md` (modified, +10/-2)
```diff
@@ -144,7 +144,7 @@ between what the browser says it is and where it appears to be.
 | `STEALTHFOX_SEED` | Integer seed for a deterministic fingerprint (same seed, same identity). A profile's own seed wins over this one. |
 | `STEALTHFOX_PROFILE_DIR` | A directory for a persistent profile, so logins survive across runs. |
 | `STEALTHFOX_BINARY` | Path to an engine binary you already have. It must be the build the packaged seal pins, or startup refuses. |
-| `STEALTHFOX_HEADLESS` | `0` to run headed; headless by default. |
+| `STEALTHFOX_HEADLESS` | `0` to run headed; headless by default. Decided by each launch: a saved session never records it, so a browser reopened by a headless server stays hidden even if it was last used headed. |
 | `STEALTHFOX_MCP_TRANSPORT` | `http` to serve over streamable HTTP instead of stdio. Default is stdio, which is what MCP clients expect. What else changes when you flip it, including the one thing that changes silently: [local or remote](local-vs-remote-mcp-server.md). |
 | `STEALTHFOX_MCP_HOST` | Bind address for the HTTP transport. Default `127.0.0.1`. |
 | `STEALTHFOX_MCP_PORT` | Port for the HTTP transport. Default `8766`. It used to be `8765`, the AIHawk interface's own default, so running both meant a bind error with nothing to explain it. |
@@ -175,6 +175,14 @@ exit or the profile. Before 0.48.0 a read started a browser on your behalf,
 which meant a question could launch the engine and reach the network while the
 tool told your client it only read.
 
+**A page that refuses does not cost the browser.** From 0.50.0 a navigation
+that fails - a domain that does not resolve, a page that times out - is
+reported as it happened, on the browser you have, with its cookies and its
+pages intact. Only a browser that is actually gone is rebuilt as the same
+identity, and the command retried once. Before 0.50.0 any failure closed the
+browser and opened a new one to try again, which failed the same way a browser
+later.
+
 If the tools do not appear in your client, the fastest way to tell a broken
 registration from a broken server is to skip the client:
 [a thirty-line MCP client](writing-an-mcp-client-in-python.md) lists them with
@@ -294,7 +302,7 @@ that was asked for.
 | `browser_snapshot` | `max_chars` | Title, url, and the interactive elements that are actually visible, each with a `selector` when one can reach it and `at: [x, y]`, its centre in viewport pixels. Not the accessibility tree: a single country `<select>` would contribute about two hundred `<option>` nodes and fill the cap before the form appears. |
 | `browser_read_html` | `mode`: `form` (default), `text`, `full` | The page's HTML reduced to what is worth reading: `form` keeps the interactive surface and the text explaining it, `text` the prose alone, `full` the structure with the noise removed. Not capped, on purpose: cutting markup in the middle leaves tags that mean nothing, so on a large page the answer is long. |
 | `browser_take_screenshot` | none | A screenshot of the page, as an image. |
-| `browser_watch` | none | The whole browser window as a person at the machine sees it: tab strip, address bar, page and the pointer, from a live capture the session keeps running on the active tab. |
+| `browser_watch` | none | The whole browser window as a person at the machine sees it: tab strip, address bar, page and the pointer, from a live capture the session keeps running on the active tab. A capture that stops delivering, as it does when a headed window is minimised, is started again on the next look; if the window cannot be captured the tool says so rather than answering an old picture. |
 
 The selectors a snapshot hands out are built to match exactly one element, and
 that is the reason to pass them verbatim rather than writing your own: measured
```

**File**: `manifest.json` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
   "manifest_version": "0.4",
   "name": "aihawk",
   "display_name": "AIHawk",
-  "version": "0.49.0",
+  "version": "0.50.0",
   "description": "AI browser agent: browses, clicks, types, and reads real web pages from plain-English instructions.",
   "long_description": "AIHawk gives an MCP client a real browser to drive. The tools navigate, click, type, read and screenshot pages the way a person would, on a patched Firefox engine.\n\nThe engine is downloaded once, outside this bundle, with `uvx invisible-playwright fetch`. Until that has run, every browser tool reports that the engine is missing.",
   "author": {
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ build-backend = "hatchling.build"
 
 [project]
 name = "aihawk"
-version = "0.49.0"
+version = "0.50.0"
 description = "Anti detect browser and web browsing agent: undetected, no captchas, no blocks"
 readme = "README.md"
 requires-python = ">=3.11"
```

**File**: `server.json` (modified, +2/-2)
```diff
@@ -7,13 +7,13 @@
     "url": "https://github.com/feder-cr/AIHawk",
     "source": "github"
   },
-  "version": "0.49.0",
+  "version": "0.50.0",
   "packages": [
     {
       "registryType": "pypi",
       "registryBaseUrl": "https://pypi.org",
       "identifier": "aihawk",
-      "version": "0.49.0",
+      "version": "0.50.0",
       "runtimeHint": "uvx",
       "transport": {
         "type": "stdio"
```

**File**: `src/aihawk/mcp/plan.py` (modified, +24/-5)
```diff
@@ -188,6 +188,28 @@ def engine_here(env: Optional[Mapping[str, str]] = None) -> dict:
     return {"binary_path": named} if named else {}
 
 
+def launched_here(env: Optional[Mapping[str, str]] = None) -> dict:
+    """What THIS process decides about every browser it starts, whoever the
+    browser is: the engine it runs on, and whether its window is shown.
+
+    ⛔ TWO THINGS A SAVED SESSION MUST NOT DECIDE, read in one place. The engine
+    was already kept out of the file (`engine_here`, and the reason above).
+    `headless` was not, until 2026-09-14: the interface restored a `main` that
+    a headed process had saved and showed its window on screen, uncloaked, at a
+    launch that had asked for nothing of the kind - while the helper beside it,
+    planned from this environment, stayed hidden. A launch flag written into an
+    identity file outlives the launch it described. So the restore now writes
+    this over whatever the file says, and the planner reads the same function,
+    which is what keeps the two from disagreeing.
+    """
+    env = os.environ if env is None else env
+    decided: dict[str, Any] = {
+        "headless": env.get("STEALTHFOX_HEADLESS", "1") != "0",
+    }
+    decided.update(engine_here(env))
+    return decided
+
+
 def plan_session(seed: Optional[int] = None, proxy: Optional[str] = None,
                  profile: Optional[str] = None,
                  env: Optional[Mapping[str, str]] = None) -> SessionPlan:
@@ -224,11 +246,8 @@ def plan_session(seed: Optional[int] = None, proxy: Optional[str] = None,
     # and it died the same way when the CALLER had passed a perfectly good
     # proxy. Popping a duplicate is not removing it; every STEALTHFOX_* variable
     # now has exactly one reader.
-    kwargs: dict[str, Any] = {
-        "seed": chosen_seed,
-        "headless": env.get("STEALTHFOX_HEADLESS", "1") != "0",
-    }
-    kwargs.update(engine_here(env))
+    kwargs: dict[str, Any] = {"seed": chosen_seed}
+    kwargs.update(launched_here(env))
     if chosen_proxy is not None:
         kwargs["proxy"] = chosen_proxy
     if directory is not None:
```

**File**: `src/aihawk/mcp/registry.py` (modified, +42/-0)
```diff
@@ -57,6 +57,33 @@ def _is_usable(session) -> bool:
         return False
 
 
+#: What a browser that is GONE says, from the two layers that can say it. The
+#: vendored client raises `TargetClosedError` carrying the first sentence for
+#: any call on a page, context or browser that has closed; the Juggler bridge
+#: answers the other two when the pipe to Firefox is gone. Matched on the text
+#: because they reach a tool as plain exceptions from two classes that share no
+#: base worth importing here.
+CLOSED_SENTENCES = ("has been closed", "the pipe closed", "the pipe is closed")
+
+
+def looks_closed(failure: BaseException) -> bool:
+    """Whether this failure is the browser being gone, rather than the page
+    refusing.
+
+    ⛔ THE DIFFERENCE IS A BROWSER. `_retrying` in the server used to treat
+    EVERY exception as a dead browser: close the one it had, build a new one,
+    retry. A domain that does not resolve, a site that answers slowly, a click
+    that finds nothing - each threw away a healthy browser with its cookies,
+    its logins and its pages, and opened a fresh one to fail the same way
+    again. Measured 2026-09-14: `NS_ERROR_UNKNOWN_HOST` on the second command
+    of a conversation cost the interface's `main` browser, and the person
+    watched it close and reopen - the window was headed - for a typo in a
+    domain name. The retry then failed identically, so nothing was gained.
+    """
+    text = str(failure)
+    return any(sentence in text for sentence in CLOSED_SENTENCES)
+
+
 class BrowserRegistry:
     """Browsers by key, created on demand, closed on request or at shutdown."""
 
@@ -138,6 +165,21 @@ def peek(self, key: str) -> Optional[StealthSession]:
     def ids(self) -> list:
         return sorted(self._browsers)
 
+    def is_dead(self, key: str, failure: BaseException) -> bool:
+        """Whether an action's failure means this browser is gone.
+
+        Two questions, because either alone misses a case. The object may
+        already report itself unusable - a browser whose connection dropped
+        between two calls - and that is what `_is_usable` reads. Or it may still
+        look fine while the call it just made was answered with the sentence a
+        closed target gives: a persistent-context session has no `_browser` to
+        ask, so the text is the only witness there.
+        """
+        existing = self._browsers.get(key)
+        if existing is None or not _is_usable(existing):
+            return True
+        return looks_closed(failure)
+
     async def ensure(self, key: str) -> StealthSession:
         """The browser for this key, started and usable.
 
```

**File**: `src/aihawk/mcp/server.py` (modified, +32/-5)
```diff
@@ -388,8 +388,11 @@ def restore() -> bool:
         # came back without the engine the person had named on the command
         # line: on a locally built one, with nothing to download, it could not
         # start at all. What the file says is who this browser is; what this
-        # build was asked to run it on is not the file's to say.
-        registry.declare(key, dict(config, **plan.engine_here()))
+        # build was asked to run it on is not the file's to say. Nor whether
+        # its window is shown: a file written by a headed run carries
+        # `headless: false` from before 0.50.0, and this process's own answer
+        # is written OVER it, not under it.
+        registry.declare(key, dict(config, **plan.launched_here()))
         if owed:
             _tabs_owed[key] = list(owed)
     return True
@@ -422,7 +425,16 @@ def focused() -> str:
 #: `binary_path` is deliberately absent. It is a path on this machine, and a
 #: browser reopened where that path means nothing must resolve an engine
 #: rather than insist on one that is not there.
-WHO_A_BROWSER_IS = ("seed", "proxy", "profile_dir", "headless")
+#:
+#: ⛔ AND `headless` IS ABSENT SINCE 0.50.0, FOR THE SAME REASON ONE STEP
+#: FURTHER: it is a property of the LAUNCH, not of the person. Saved, it made
+#: one headed run - another server on the same machine, run headed on purpose
+#: - decide for every later process that read the same file: the
+#: interface reopened `main` on screen, uncloaked, at a launch that had asked
+#: for nothing of the kind, and the helper beside it, built from the
+#: environment, stayed hidden. Measured 2026-09-14. What this process shows
+#: and what it runs on are both `plan.launched_here`, read at restore.
+WHO_A_BROWSER_IS = ("seed", "proxy", "profile_dir")
 
 
 def browsers_in() -> list:
@@ -661,12 +673,24 @@ def looking(browser_id=None):
 
 
 async def _retrying(fn, *args, browser_id=None, **kwargs):
-    """Run an action on one browser, and on failure rebuild it once and retry.
+    """Run an action on one browser; if the BROWSER is gone, rebuild it once
+    and retry.
 
     A browser that died between two calls is the ordinary case here, not an
     exotic one: the object is still intact, so the failure surfaces inside the
     action rather than when it was handed out.
 
+    ⛔ ONLY A BROWSER THAT IS GONE IS REBUILT, AND UNTIL 0.50.0 ANY FAILURE WAS.
+    The clause read `except Exception`, so a domain that did not resolve, a
+    page that timed out or a selector that matched nothing all counted as a
+    dead browser: the healthy one was closed, with its cookies and its pages,
+    a new one was started as the same person, the last page was reopened and
+    the action retried - to fail the same way and only then reach the caller.
+    Measured 2026-09-14 on the interface: `NS_ERROR_UNKNOWN_HOST` on the
+    second command cost the `main` browser, and a person watched the window
+    close and reopen for a typo. What "gone" means is decided in one place,
+    `registry.is_dead`, next to the check that decides it between calls.
+
     The rebuild is addressed too. Dropping and re-ensuring the DEFAULT key while
     the action was aimed at the other browser would kill a browser nobody asked
     about and hand back the wrong one, which is the same class of mistake as
@@ -677,7 +701,10 @@ async def _retrying(fn, *args, browser_id=None, **kwargs):
     session = await ready(browser_id)
     try:
         return await fn(session, *args, **kwargs)
-    except Exception:
+    except Exception as failure:
+        if not registry.is_dead(at, failure):
+            # The page refused; the browser is fine. The refusal is the answer.
+            raise
         # ⛔ THE TABS ARE OWED AGAIN, or the recovery gives back half a browser.
         # `drop` keeps the identity on purpose - the replacement is the same
         # person - and until this line the pages were not part of "the same":
```

**File**: `src/aihawk/mcp/session.py` (modified, +39/-3)
```diff
@@ -4,6 +4,7 @@
 from __future__ import annotations
 
 import asyncio
+import time
 from typing import Any, Optional
 
 from invisible_playwright.async_api import InvisiblePlaywright
@@ -30,6 +31,9 @@ def __init__(self, **kwargs: Any) -> None:
         # frame and the event that says one has arrived. Started lazily by
         # `watch_frame`, stopped with the tab.
         self._watch: dict[str, dict[str, Any]] = {}
+        # The clock a frame's age is read from. An attribute so a test can move
+        # time instead of sleeping through STALE_AFTER.
+        self._clock = time.monotonic
 
     def resume_numbering_after(self, highest: int) -> None:
         """Carry tab numbering forward from a session this one replaces.
@@ -223,6 +227,23 @@ def page(self, page_id: Optional[str] = None):
     #: page asks often enough to collect them.
     WATCH_FPS = 25
 
+    #: A capture that has delivered nothing for this long is not a quiet page:
+    #: it is a capture that has stopped. The engine delivers at WATCH_FPS
+    #: whether or not anything on the page changed - measured 2026-09-14 on a
+    #: page that never moves: 93 frames in 4 s, the longest gap 78 ms - so two
+    #: seconds of silence is fifty missing frames.
+    #:
+    #: ⛔ A FRAME SERVED WITHOUT AN AGE IS A FROZEN PANE THAT LOOKS LIVE. The
+    #: engine's window capture can end for good on its own: the WebRTC capturer
+    #: it rests on reports a PERMANENT error the first time a headed window is
+    #: minimised, the capture timer is cancelled, and nothing tells the client.
+    #: This method then answered the last frame it held, forever, and the pane
+    #: showed a search page while the browser was two sites further on. Now a
+    #: frame older than this is a reason to stop and start the capture again;
+    #: a restart that stays silent is dropped with the reason, so the pane says
+    #: what is wrong instead of showing where the browser was.
+    STALE_AFTER = 2.0
+
     async def watch_frame(self, page_id: Optional[str] = None,
                           timeout: float = 3.0) -> bytes:
         """The latest JPEG frame of the WINDOW the active tab lives in.
@@ -236,16 +257,24 @@ async def watch_frame(self, page_id: Optional[str] = None,
 
         The capture is started on first use and kept running for the life of
         the tab, so the frame answered here is at most a twenty-fifth of a
-        second old. Stopped with the tab in `close_page`.
+        second old - and if it is older than STALE_AFTER the capture is
+        started again, because the engine does not say when one ends. Stopped
+        with the tab in `close_page`.
         """
         page = self.page(page_id)
         pid = next(k for k, v in self._pages.items() if v is page)
         state = self._watch.get(pid)
+        if (state is not None and state["latest"]
+                and self._clock() - state["at"] > self.STALE_AFTER):
+            await self._stop_watch(pid)
+            state = None
         if state is None:
-            state = {"latest": b"", "arrived": asyncio.Event()}
+            state = {"latest": b"", "arrived": asyncio.Event(),
+                     "at": self._clock()}
 
             def on_frame(frame: dict) -> None:
                 state["latest"] = frame["data"]
+                state["at"] = self._clock()
                 state["arrived"].set()
 
             try:
@@ -265,8 +294,15 @@ def on_frame(frame: dict) -> None:
             try:
                 await asyncio.wait_for(state["arrived"].wait(), timeout)
             except asyncio.TimeoutError:
+                # Dropped, not kept: a capture that delivered nothing from the
+                # start may have died at birth - the engine ends one on a
+                # minimised window without a word - and keeping it would make
+                # every later look wait on a capture that cannot answer. The
+                # next look starts its own, which succeeds the moment the window
+                # can be captured again.
+                await self._stop_watch(pid)
                 raise RuntimeError(
-                    "the window capture is running but no frame arrived in "
+                    "the window capture started but no frame arrived in "
                     "%.0f s; a minimised window is captured as nothing" % timeout)
         return state["latest"]
 
```

---

### Incident Patch 5: `42cee6c3` (2026-09-12)
**Commit Message**: The interface after a UX pass: a modal panel, a truthful transcript, controls that say what they do (#1302)

A UX pass over the interface, driven by an audit of six dimensions - spatial model, typography, interaction, accessibility, visual hierarchy, first run and failure states - with every finding verified against the code before it was acted on, and every change checked in a real browser afterwards.

The owner's complaint first. The sessions panel covered half the conversation and left it looking readable: measured 240px off the front of every line at every desktop width, 48% of the measure at 1440px, 61% at 960. It is a modal now - the page behind it goes inert and dims, Escape closes it, a click outside closes it, choosing a conversation closes it - and `inert` has one owner because two reasons can hold the same pane.

The transcript stops saying things that are not true. A step nobody landed breathed for ever; Stop was reported as an error; a failed step was marked by colour alone with the same verb as one still running; tool output was cut in silence for the watcher and the model; a dead stream left the clock counting; the queued sentence was never on screen and a second Ent

**File**: `src/aihawk/agent.py` (modified, +35/-2)
```diff
@@ -93,6 +93,38 @@ def _result_text(result) -> tuple[str, bool]:
     return (getattr(first, "text", None) or "[non-text result]"), failed
 
 
+#: How much of a tool result the WATCHER is shown, and how much the MODEL is
+#: sent. Two different jobs - the page is a window on the work, the message list
+#: is what every later turn pays for - so the two numbers differ on purpose.
+SHOWN, SENT = 1200, 8000
+
+
+def shorten(text: str, limit: int, where: str) -> str:
+    """`text` cut to `limit`, saying so whenever it cuts.
+
+    ⛔ IT CUT IN SILENCE, AND THE PERSON WATCHING GOT THE SMALLER COPY. A read
+    of a real page is tens of kilobytes; the page showed the first 1200
+    characters, stopping mid-word with no ellipsis, no count and no hint that
+    anything had been removed, while the line below handed the model nearly
+    seven times as much. Somebody expanding a step to audit what the agent saw
+    read a partial page as the whole one. The product's whole claim is that you
+    can watch what it does, and the watcher was the one being given less.
+
+    Both callers say it now, because the model reading a truncated page without
+    being told is the same defect one level up: it can ask for the rest, but
+    only if it knows there is a rest.
+
+    The marker starts on a new line so the page files the result into an
+    expandable block rather than onto the step row, and it is ASCII: a
+    non-ASCII character on a line this server may print is a known way to kill
+    the process on Windows.
+    """
+    if len(text) <= limit:
+        return text
+    return "%s\n[... %d more characters, not %s]" % (
+        text[:limit], len(text) - limit, where)
+
+
 class Conversation:
     """One transcript, and the loop that grows it.
 
@@ -216,9 +248,10 @@ async def run(self, task: str, call_tool, tools, *, say: Say = _silent,
                     text = f"{type(exc).__name__}: {exc}"
                     await say("err", text)
                 else:
-                    await say("err" if failed else "result", text[:1200])
+                    await say("err" if failed else "result",
+                              shorten(text, SHOWN, "shown"))
                 self.messages.append({"role": "tool", "tool_call_id": call.id,
-                                      "content": text[:8000]})
+                                      "content": shorten(text, SENT, "sent")})
 
 
 async def run_task(mcp, task: str, *, client, model: str,
```

**File**: `src/aihawk/chat.py` (modified, +20/-2)
```diff
@@ -234,10 +234,28 @@ async def send(self, text: str) -> None:
                 # its thread and its answer is discarded, so a run stopped
                 # mid-turn is still billed for that reply. Stopping cuts what
                 # comes next, never what is already in the air.
-                await self.emit("err", "stopped")
+                # ⛔ NOT AN ERROR. THE PERSON PRESSED THE BUTTON. This emitted
+                # `err` with the single word `stopped`, so a deliberate and
+                # correct action was answered with a red box, announced to a
+                # screen reader as "error stopped", and any step in flight was
+                # flipped to the failed state. The page treated the user's own
+                # instruction as a fault.
+                await self.emit("note", "Stopped.")
                 raise
             except Exception as exc:
-                await self.emit("err", f"{type(exc).__name__}: {exc}")
+                # ⛔ AND THIS PRINTED A PYTHON CLASS NAME AND THE PROVIDER'S
+                # RAW JSON INTO THE CONVERSATION. It is the one line in the
+                # product a person reads at the exact moment something has gone
+                # wrong, and it said nothing about what to do next or about the
+                # instruction they had just lost sight of. The detail stays -
+                # it is the only clue when the cause is real - behind a sentence
+                # that says what happened and what is still true.
+                detail = " ".join(str(exc).split())
+                await self.emit("err", "The turn ended early. What you asked is "
+                                "still in the transcript, so you can send it "
+                                "again once this is dealt with. (%s%s)"
+                                % (type(exc).__name__,
+                                   ": " + detail[:200] if detail else ""))
             finally:
                 await self.emit("busy", "0")
                 # After the turn and not during it: a transcript written
```

**File**: `src/aihawk/ui/css/01-tokens.css` (modified, +31/-2)
```diff
@@ -56,6 +56,23 @@
   --on-accent: #151005;
   --ok:  #79bf94;         /* 8.6:1 */
   --err: #e88b76;         /* 7.4:1 */
+  /* The error SURFACE, written twice with two different percentages - 9 and 8
+     for the fill, 32 and 30 for the edge - on two things that are the same
+     thing to the eye. The mechanisms stay different on purpose (a border on a
+     free-standing box, an inset shadow on a grid row, where a border would
+     shift all four tracks by two pixels); only the colour is shared. */
+  --err-fill: color-mix(in srgb, var(--err) 9%, transparent);
+  --err-edge: color-mix(in srgb, var(--err) 32%, transparent);
+
+  /* ⛔ THE INK OF A SHADOW, NOT THE SHADOW. Seven shadows were written by hand
+     with six geometries and five alphas, and the temptation is a `--e-2` that
+     carries the whole value - which cannot work here, because the offsets are
+     genuinely different jobs: the drawer throws sideways, the composer throws
+     UPWARD because it separates an input from a transcript scrolling under it.
+     So the depth is shared and the direction stays with the component. */
+  --shade-1: rgba(0,0,0,.35);   /* a chip lifted off the thing behind it */
+  --shade-2: rgba(0,0,0,.5);    /* a bar, a tooltip */
+  --shade-3: rgba(0,0,0,.85);   /* a panel over the page */
 
   --sans: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
   --mono: ui-monospace, "Cascadia Mono", "SF Mono", Menlo, Consolas,
@@ -109,6 +126,9 @@
      and the kind of number nobody questions because it looks round in decimal. */
   --spine:48px;                               /* the sessions rail */
   --drawer:256px;                             /* the standard drawer's width */
+  --split:9px;                                /* the separator, and its own width */
+  --pane-min:420px;                           /* the conversation, at its narrowest */
+  --stage-min:480px;                          /* the picture, below which it is a strip */
   --topbar:56px;                              /* every header, one height */
   --h-ctl:40px;                               /* every control on a bar */
   --gutter:1.75rem;                            /* three digits of 11px mono */
@@ -132,9 +152,18 @@ code,pre,.g,.meta,.badge,#url{
    the meter at 2.71, the placeholder inside a screen at 2.51, the layout icons
    at 2.51. WCAG AA wants 4.5:1 for text and 3:1 for a graphic that carries
    meaning, and the token's own comment in this file says what it is for. A
-   label is a small word, not a faint one: `--fg-3` is 4.8:1 and still reads as
+   label is a small word, not a faint one: `--fg-3` is 6.3:1 on the ground and 5.9:1 on --raised and still reads as
    quieter than the thing it labels. */
-.label{ font-size:var(--t-label); font-weight:600; letter-spacing:.07em;
+/* ⛔ AND THE TWO DEEPEST HEADINGS JOIN IT RATHER THAN RETYPING IT. `h5` had
+   the body's size, the body's face and less contrast than the paragraph
+   under it - 8.4:1 against 14.5 - so it read as a dimmer sentence rather
+   than as a heading. The file already says that levels sharing a size are
+   separated by weight and colour, and `h4` has taken that slot, so what is
+   left for `h5` is a different KIND: the label treatment this page already
+   uses for a small word that is not a faint one. Named here instead of
+   copied into the transcript, or the day this rule is retuned they drift. */
+.label, .say h5.md-h, .say h6.md-h, .answer h5.md-h, .answer h6.md-h{
+        font-size:var(--t-label); font-weight:600; letter-spacing:.07em;
         text-transform:uppercase; color:var(--fg-3); line-height:1 }
 .sr{ position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%) }
 .skip{ position:absolute; left:var(--s2); top:var(--s2); z-index:20;
```

**File**: `src/aihawk/ui/css/02-sessions.css` (modified, +118/-52)
```diff
@@ -1,8 +1,9 @@
-/* ---------------- panes ---------------- */
-/* The session column is FIXED width and the two panes beside it share what is
-   left, because the column holds names and a name does not get more readable
-   with more room, while the transcript and the picture both do. It collapses
-   below 900px rather than squeezing the two things that matter. */
+/* ---------------- the sessions panel ---------------- */
+/* A FIXED-width panel that lies OVER the conversation as a modal, closed until
+   asked for. Fixed because it holds names, and a name does not get more
+   readable with more room; over rather than beside, because a column that
+   took its width out of the room moved and rewrapped the conversation every
+   time it opened. Below 900px it narrows, and nothing about it collapses. */
 /* ⛔ CLOSED UNTIL SOMEBODY ASKS FOR IT. A column of sessions standing open
    beside a conversation somebody is reading is a list nobody needed yet taking
    a fifth of the width; open by default it reads as scaffolding rather than as
@@ -19,29 +20,42 @@
    Anchored to the spine's own width so the two are one object, and lifted with
    a shadow rather than a border, because what says "this is over that" is the
    shadow. */
-/* ⛔ IT STOPS ABOVE THE COMPOSER, AND THAT IS NOT DECORATION. Full height, it
-   covered 256px of the 530px input - measured 2026-09-11, and `elementFromPoint`
-   on the corner of the textarea answered `chats`, so half of the only input on
-   the page was dead with nothing saying so. The rule that used to prevent it
-   padded the transcript out of the way, and that rewrapped every paragraph as
-   the panel appeared, which is what it was removed for.
+/* ⛔ IT IS A MODAL NOW, AND THAT IS WHAT ANSWERS THE THING THE OWNER SAW. It
+   floated over the near edge of the conversation and left what it covered
+   looking READABLE: measured 2026-09-12 in a real browser, 240px off the front
+   of every line at every desktop width - 48% of the measure at 1440px, 61% at
+   960px, 29 rows buried at once and one of them whole. Lines read
+   `.com/it/ navigated to` with the verb and the step number underneath the
+   panel. That is not a panel over a page, that is text that looks broken.
 
-   So the CHAT still knows nothing: the coupling runs the other way, and the
-   panel knows where the input begins.
+   Covering is not the defect. Covering while the page underneath still claims
+   to be usable is. So the two panes go `inert` behind it and dim to 2.36:1 by
+   the shell's one `[inert]` rule, Escape closes it, a click outside closes it,
+   and choosing a conversation closes it on the way out. What is covered is
+   visibly out of play, for as long as it takes to pick a name.
 
-   ⛔ AND IT IS THE DISTANCE TO THE INPUT, NOT THE HEIGHT OF IT. The first
-   version published the composer's height, which is the same number only
-   while the composer sits at the bottom of the window. Below 720px the panes
-   stack - the conversation becomes `60vh` with the browser under it - so the
-   input is in the MIDDLE of the window and the drawer ran straight over it
-   again: measured 34% at 719px and 43% at 600px, in a real browser, on the
-   build that was supposed to have fixed this. `I made it vertical so it holds
-   at every width` was the claim, and eight widths said otherwise. */
-#rail { position:absolute; top:0; bottom:var(--rail-bottom, 0px);
+   ⛔ AND THAT IS WHY `--rail-bottom` IS GONE, with the function that published
+   it, its observer and its listener. It existed so the drawer would stop short
+   of the composer: a second place that knew where the input is, re-measured on
+   every resize, because the input moves when the panes stack. With the composer
+   inert behind the panel there is nothing to keep clear of - it cannot be typed
+   into either way - so the drawer runs the full height and one mechanism does
+   what two had to agree on.
+
+   The surface is `--raised` and not `--well`: the recessed rung against the
+   ground is 1.04:1, so the edge that was supposed to say "this is on top of
+   that" was invisible, and the shadow was carrying the separation alone. */
+#rail { position:absolute; top:0; bottom:0;
         left:var(--spine); width:var(--drawer);
         z-index:5; display:flex; flex-direction:column;
-        background:var(--well); border-right:1px solid var(--line-1);
-        box-shadow:14px 0 34px -18px #000 }
+        background:var(--raised); border-right:1px solid var(--line-3);
+        box-shadow:18px 0 36px -14px var(--shade-3) }
+/* An animation and not a transition: the panel is toggled with `hidden`, so it
+   goes from not being rendered to being rendered, and there is no `from` value
+   for a transition to start at. The global reduced-motion block in the stage
+   stylesheet reaches this, like every other animation on the page. */
+#rail:not([hidden]){ animation:railin 150ms ease-out }
+@keyframes railin{ from{ transform:translateX(-100
```

**File**: `src/aihawk/ui/css/03-shell.css` (modified, +60/-25)
```diff
@@ -1,10 +1,19 @@
-#left { width:clamp(420px, 44%, 530px); display:flex; flex-direction:column;
+/* ⛔ 44% OF THE ROOM THE TWO PANES ACTUALLY SHARE, not of the window. The
+   percentage was measured against the whole window while the spine and the
+   separator are outside the split, so the conversation was quietly 25px
+   narrower than the number said at every width where the clamp was not
+   already binding. The floor and the separator are tokens now, read here and
+   by the separator's own rule and by the code that drags it: one number, three
+   readers, instead of the same 420 and 9 written out in four places. */
+#left { width:clamp(var(--pane-min),
+                    calc((100% - var(--spine) - var(--split)) * .44), 530px);
+        display:flex; flex-direction:column;
         position:relative }
 /* The separator carries the line that used to be `#left`'s right border, so
    the thing you drag and the thing you see are the same thing. Wider than the
    line it draws: a 1px target is a 1px target, and this one is grabbed by
    hand. */
-#split{ flex:0 0 9px; cursor:col-resize; position:relative; background:none;
+#split{ flex:0 0 var(--split); cursor:col-resize; position:relative; background:none;
         border:0; padding:0; touch-action:none }
 /* ⛔ NINE PIXELS OF LINE, TWENTY-FIVE OF TARGET. WCAG 2.2 puts the floor at
    24px and none of its exceptions cover a separator: the arrow keys are a
@@ -47,7 +56,7 @@
    conversation is costing and running, then the one thing you can do to it.
    The rule that separates the last is the same hairline the panes use. */
 #head { flex:none; height:var(--topbar); display:flex; align-items:center;
-        gap:var(--s2); padding:0 var(--s4);
+        justify-content:flex-end; gap:var(--s2); padding:0 var(--s4);
         border-bottom:1px solid var(--line-1) }
 #head .vr{ width:1px; height:18px; flex:none; background:var(--line-2);
            margin:0 var(--s1) }
@@ -56,7 +65,9 @@
    model and Clear against the left edge, under the transcript's own margin and
    nowhere near the edge they had always sat on. The push belongs to the first
    of whatever survives, not to whichever element happened to be there. */
-#head #model{ margin-left:auto }
+/* The push is the CONTAINER'S now (`justify-content:flex-end` above), so it
+   no longer depends on which child happens to exist: the badge is hidden until
+   the server names a model, and a hidden child cannot carry a margin. */
 /* The heading is out of flow (`.sr` is absolute), so it is not one of the
    things being pushed, and this rule only describes the size it is announced
    at rather than drawn at. */
@@ -78,8 +89,9 @@
    22 and 23 - close enough to look fine and short enough to fail. */
 #fresh{ font-family:var(--sans); cursor:pointer;
         transition:background-color 120ms ease-out, color 120ms ease-out }
-#fresh:hover:not(:disabled){ background:var(--hover); color:var(--fg) }
-#fresh:disabled{ opacity:.3; cursor:default }
+#fresh:hover:not([aria-disabled="true"]){ background:var(--hover); color:var(--fg) }
+#fresh:active:not([aria-disabled="true"]){ background:var(--top) }
+#fresh[aria-disabled="true"]{ cursor:default }
 
 /* ⛔ `inert` HAS NO LOOK, AND A CONTROL THAT CANNOT BE USED MUST NOT LOOK
    USABLE. This page already spells that `opacity:.3` on a disabled button, and
@@ -89,7 +101,11 @@
    to see, and stayed fully lit the whole time. Seen on the running page, a
    deleted conversation left a composer inviting a sentence it could not send.
    One rule, so the look follows the mechanism rather than whoever remembers. */
-[inert]{ opacity:.3 }
+/* ⛔ AND ONE VALUE FOR THE WHOLE CLASS. Four rules said "this control cannot
+   be used" with two different numbers - .3 on two disabled buttons and on
+   inert subtrees, .4 on the empty room's picker - and the newest control was
+   left out altogether. Whatever the mechanism, the look is this one. */
+:disabled, [inert], [aria-disabled="true"]{ opacity:.3 }
 
 #log{ flex:1; overflow:auto; scrollbar-gutter:stable;
       padding:var(--s5) var(--s4) }
@@ -105,16 +121,19 @@
    whoever was reading them. The owner named the rule by looking at it: the
    bar lives on top and the chat must not know a thing.
 
-   What covering costs is the near edge of the conversation, and the words
-   stay where they are to come back to. What it must NOT cover is a control,
-   which is why the drawer stops above the composer - see `--composer-h` in
-   the sessions stylesheet. */
-/* ⛔ AND THE CHAT DOES NOT KNOW THE COLUMN EXISTS. The transcript and the
-   composer took a left padding here while the panel was open, to keep out
-   from under it - but a padding that changes changes the line width, so every
-   paragraph rewrapped as the panel appeared: the text moved under the eyes of
-   whoever was reading it. The panel is an overlay. It covers the near edge and
-   the rest of the words stay where they are, to come back to by closing it. */
+   W
```

**File**: `src/aihawk/ui/css/04-transcript.css` (modified, +57/-12)
```diff
@@ -1,6 +1,14 @@
 /* ---------------- one turn ---------------- */
 .turn + .turn{ margin-top:var(--s6) }   /* between turns */
-.turn > * + *{ margin-top:var(--s3) }   /* inside a turn */
+/* ⛔ 20 AND NOT 12, BECAUSE THE SPACING SAID THE WRONG THING ABOUT WHAT
+   BELONGS TOGETHER. Two paragraphs of one answer are 16px apart, and the
+   answer sat 12px from the step row under it: a two-paragraph answer read as
+   two separate things and the step below read as part of the second one.
+   Raised here rather than lowering the paragraph gap - at the 1.6 leading
+   this file declares, 12px is under half a line and paragraphs stop
+   separating at all. The ladder is 4 / 8 / 16 / 20 / 24 / 32 and never goes
+   down as the things it separates get further apart. */
+.turn > * + *{ margin-top:var(--s5) }   /* inside a turn */
 /* A turn that has scrolled out of sight costs no layout and no paint. Chosen
    over hiding or removing old turns because it is the only one of the three
    that leaves the text findable with Ctrl+F and readable by a screen reader:
@@ -53,7 +61,9 @@ h3.md-h, h4.md-h, h5.md-h, h6.md-h{
    under it, which is a hierarchy only the weight was carrying. */
 h3.md-h{ font-size:var(--t-h1) }
 h4.md-h{ font-size:var(--t-h2); font-weight:600 }
-h5.md-h, h6.md-h{ font-size:var(--t-h3); font-weight:600; color:var(--fg-2) }
+/* h5 and h6 are dressed by the label rule in the token file: at the body's
+   size and face they were a dimmer paragraph, and the ladder had no slot
+   left for them that size and weight could carry. */
 /* A fenced block inside an answer is already inside the answer's indent, and
    `.out` carries its own for the tool output it was written for: the two
    stacked, so code sat a step to the right of the prose describing it. */
@@ -85,15 +95,18 @@ h5.md-h, h6.md-h{ font-size:var(--t-h3); font-weight:600; color:var(--fg-2) }
    whatever page the agent last read, and the browser it drives is right there.
    The address is printed next to them so an injected one is legible. */
 .lk  { color:var(--fg) }
-.href{ color:var(--fg-3); font:.75rem/1.5 var(--mono); overflow-wrap:anywhere }
+/* ⛔ `--t-mono`, THE SIZE THIS FILE'S OWN TOKEN NAMES FOR AN ADDRESS. It was hand-written at .75rem,
+   which made the printed address the SMALLEST type on the page - the one string that exists
+   so that an injected link can be read before it is trusted. */
+.href{ color:var(--fg-3); font:var(--t-mono)/1.5 var(--mono); overflow-wrap:anywhere }
 .href::before{ content:" " }
 /* ⛔ NO COLOURED BAR DOWN THE LEFT EDGE. A 2px stripe on a callout is the
    house style of every framework and belongs to none of them; a tint plus a
    hairline in the same hue says the same thing without the costume. */
 .orph  { display:flex; gap:8px; font-size:var(--t-mono); color:var(--err);
-         background:color-mix(in srgb, var(--err) 9%, transparent);
+         background:var(--err-fill);
          border-radius:var(--r-sm);
-         border:1px solid color-mix(in srgb, var(--err) 32%, transparent);
+         border:1px solid var(--err-edge);
          padding:6px 10px }
 
 /* ONE grid: every row on the same rails, so nothing shifts as text changes. */
@@ -110,10 +123,25 @@ h5.md-h, h6.md-h{ font-size:var(--t-h3); font-weight:600; color:var(--fg-2) }
    reading. */
 .lab { user-select:text; grid-column:2; min-width:0; overflow:hidden;
        text-overflow:ellipsis; white-space:nowrap; font-size:var(--t-mono) }
-.lab b   { font-family:var(--sans); font-weight:600; color:var(--fg) }  /* the verb */
-.lab code{ color:var(--accent) }                                        /* the object */
+/* ⛔ THE INK MOVED BETWEEN THESE TWO, AND THEY HAVE TO MOVE TOGETHER. The
+   accent is the page's ACTION colour - it is on the send button - and its most
+   frequent appearance on screen was the address in a step row, which is not an
+   action and is not a thing to press. The address is the object of the line and
+   now carries full ink; the verb steps back to the quieter one, because two
+   full-ink things in one row is no hierarchy at all. */
+.lab b   { font-family:var(--sans); font-weight:600; color:var(--fg-2) } /* the verb */
+.lab code{ color:var(--fg) }                                            /* the object */
 .lab .inline{ color:var(--fg-3) }                    /* a short result, on the row */
-.meta{ grid-column:3; white-space:nowrap; font-size:var(--t-label); color:var(--fg-3) }
+/* ⛔ SIX CHARACTERS OF ROOM, RESERVED, BECAUSE THE CLOCK GROWS WHILE IT RUNS.
+   The timing is written ten times a second and the column was sized to its
+   contents, so every time the number gained a digit - `5ms` to `58ms` to
+   `412ms` to `1.0s` - the label beside it lost about 6.6px and re-truncated
+   under the reader's eye, three times in the first second of every step. A
+   `ch` really is one character here: this is the mono face and it is tabular,
+   which is the one place in this file where that unit means what it 
```

**File**: `src/aihawk/ui/css/05-composer.css` (modified, +39/-3)
```diff
@@ -2,12 +2,29 @@
 form{ position:relative; padding:var(--s3) var(--s4) var(--s4);
       border-top:1px solid var(--line-1);
       background:var(--raised);
-      box-shadow:0 -1px 0 rgba(0,0,0,.5), 0 -12px 28px -12px rgba(0,0,0,.65) }
+      box-shadow:0 -1px 0 var(--shade-2), 0 -12px 28px -12px var(--shade-2) }
 .composer{ display:flex; align-items:flex-end; gap:var(--s2);
            background:var(--base); border:1px solid var(--line-2);
            border-radius:var(--r-lg); padding:10px 10px 10px var(--s3);
            box-shadow:var(--lip); transition:border-color 120ms ease-out }
-.composer:focus-within{ border-color:var(--line-3) }
+/* --fg-4 and not --line-3: this is the only signal a pointer user gets that the
+   box has the keyboard, and a border at 1.2:1 against the surface is not a
+   signal. #6b747d reads at 3.92:1 against the ground, over the 3:1 floor for a
+   non-text indicator, without inventing a token. */
+/* ⛔ ONE INDICATOR, ON THE CONTAINER, TWO PIXELS WIDE. The keyboard ring was
+   drawn on the textarea INSIDE this bordered box, and on a textarea
+   `:focus-visible` matches on every focus - a click included, because the
+   element takes keyboard input - so the page opened on two nested rectangles
+   and drew them again on every click into the box. The box is the control a
+   person sees, so the box says it has the keyboard: the border goes to
+   `--fg-4` and a 1px shadow doubles it to a 2px ring at 3.92:1 against the
+   ground, over the 3:1 floor for a focus indicator, with nothing moving. */
+.composer:focus-within{ border-color:var(--fg-4);
+                        box-shadow:var(--lip), 0 0 0 1px var(--fg-4) }
+/* `outline:none` on the field itself, because the ring belongs to the box
+   around it - see `.composer:focus-within` above. Not a blanket removal of the
+   focus signal: it is the one place on the page where the visible control and
+   the focusable element are two different boxes. */
 #i{ flex:1; background:transparent; border:0; outline:none; resize:none; color:var(--fg);
     font:var(--t-body)/1.55 var(--sans); min-height:24px; max-height:200px;
     overflow-y:hidden; padding:0; caret-color:var(--accent) }
@@ -32,14 +49,33 @@ form{ position:relative; padding:var(--s3) var(--s4) var(--s4);
 #go:hover:not(:disabled){ background:var(--accent-hi) }
 #halt:hover{ background:var(--stop-hi) }
 #go:active, #halt:active{ transform:scale(.92); box-shadow:none }
-#go:disabled{ opacity:.3; cursor:default }
+#go:disabled{ cursor:default }
+/* ⛔ QUEUE LOOKS DIFFERENT FROM SEND, on the button itself. While the agent
+   works, Enter queues the sentence for the next turn, and the only thing that
+   said so was a placeholder that vanished at the first keystroke: the button
+   looked exactly like Send. Outlined rather than filled - the same shape, held
+   back - and the hover rule below has to be this specific or the ordinary
+   hover fills it in again and undoes the signal. */
+#go[data-mode="queue"]:not(:disabled), #go[data-mode="replace"]:not(:disabled){
+     background:transparent; color:var(--accent);
+     box-shadow:inset 0 0 0 1.5px var(--accent) }
+#go[data-mode="queue"]:hover:not(:disabled), #go[data-mode="replace"]:hover:not(:disabled){
+     background:color-mix(in srgb, var(--accent) 14%, transparent) }
+/* #chip sits on `--hover`; the next rung up is `--top`. */
+#chip:hover{ background:var(--top) }
 /* Its own button, not a mode of the send button. As a mode it disappeared the
    moment somebody typed, because the same control then meant "queue this for
    the next turn" - and the loop has no turn ceiling, so this button is the only
    thing that ends a run that will not converge. It follows the RUN. */
 #halt{ background:var(--stop) }
 #chip{ display:inline-flex; align-items:center; gap:6px; margin-bottom:var(--s2);
+       max-width:100%;
        background:var(--hover); border:1px solid var(--line-2); color:var(--fg-2);
        font-size:var(--t-label); padding:3px 9px; border-radius:var(--r-pill);
        cursor:pointer }
+/* The queued sentence can be a paragraph. It gives way to the width there is
+   rather than to a character count guessed in advance - a `ch` is the width of
+   a zero, not of a letter, and this file is not the place to relearn that. */
+#chip .what{ min-width:0; overflow:hidden; text-overflow:ellipsis;
+             white-space:nowrap }
 
```

**File**: `src/aihawk/ui/css/06-browser.css` (modified, +16/-8)
```diff
@@ -61,24 +61,32 @@
               transition:color 120ms ease-out }
 #mode button:hover:not([aria-pressed="true"]){ color:var(--fg-2) }
 #mode button[aria-pressed="true"]{ background:var(--top); color:var(--fg);
-                                    box-shadow:0 1px 2px rgba(0,0,0,.35) }
+                                    box-shadow:0 1px 2px var(--shade-1) }
 /* ⛔ A CONTROL THAT CANNOT DO ANYTHING DOES NOT LOOK READY. With no browser
    open, Live/Frozen, the layout picker and the address are three armed controls
    over an empty room: the bar looked identical whether the product was working
    or waiting to be told what to do. */
-#right[data-empty="1"] #url,
-#right[data-empty="1"] #mode{ opacity:.4 }
+/* ⛔ NEITHER LINE IS HERE ANY MORE, FOR TWO DIFFERENT REASONS. The picker
+   goes inert when the room is empty, and inert has one look, declared once in
+   the shell - a second opacity here was the second of the two numbers the
+   page used for "cannot be used". And the address is TEXT, not a control:
+   `opacity:.4` put `no page yet` at 2.13:1 on every first run, where the
+   `.dim` class the script already sets on an empty address reads at 6.6:1. Ink
+   for words, the shared rule for controls. */
 /* ⛔ AND `pointer-events` IS NOT A DISABLED STATE. It only stops the
    mouse: the five buttons kept their place in the tab order, kept the focus
    ring, and Enter still fired the handler - so a keyboard could operate five
    controls that look dead, and a screen reader announced them as ordinary
    enabled buttons. `inert` takes them out of both. */
 #right[data-empty="1"] #mode{ pointer-events:none }
-/* And the state word goes altogether: with nothing running it said IDLE, in
-   capitals, and was the brightest thing on a bar describing an empty room -
-   while the room itself already says what it is. */
-#right[data-empty="1"] #state{ position:absolute; width:1px; height:1px;
-                              overflow:hidden; clip-path:inset(50%) }
+/* ⛔ AND `idle` IS HIDDEN BY THE STATE ITSELF, NOT BY THE EMPTY ROOM. A rule
+   here clipped `#state` to one pixel whenever the pane was empty, which is
+   right for the word `idle` - capitals, the brightest thing on a bar describing
+   an empty room - and wrong for every other word that box can hold. Drop the
+   stream on a first run and `offline` was written into a clipped box: the
+   sighted user got a 7px dot changing colour, and nobody got the word. Two
+   places decided whether that word is worth showing; now the one that knows
+   WHICH word it is decides, in `say`. */
 
 /* The frame is solved from the available height, so a wide shot fills the width
    and a tall one fills the height. What is left over is stage, never a hole
```

#### Recent Merged Pull Requests:
- **PR #1411** (2026-10-05): 0.70.11: the wrapper floor moves to 0.26.0, the firefox-36 engine (@feder-cr)
- **PR #1410** (2026-10-04): 0.70.10: the file chooser pause is the wrapper's standard set_files (@feder-cr)
- **PR #1409** (closed): browser_navigate: no response while on another page is an error, not success (@richardpowellus)
- **PR #1407** (2026-10-03): 0.70.9: the wrapper floor moves to 0.25.9, the firefox-35 engine (@feder-cr)
- **PR #1406** (2026-10-02): fix: browser_snapshot and read_html keep a transparent field that a shown label names (@richardpowellus)
- **PR #1405** (closed): fix: browser_type with expect_origin answers "typed into" only once the field kept it (@richardpowellus)
- **PR #1404** (closed): browser_download: keep the file a page hands over (@richardpowellus)
- **PR #1403** (closed): browser_upload_files: attach local files through the file chooser (@richardpowellus)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
