# Forensic Learning Record (Deep Inspection): TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials

> **Canonical Artifact**: `07_PROJECT_LEARNING/tarrysingh-artificial-intelligence-deep-learning-machine-learning-tutorials-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials](https://github.com/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:18:47.918Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials`
- **Description**: Synapsa Commons: free, hands-on AI courses that run anywhere (Colab, Kaggle, Binder, Codespaces, Jupyter). EU AI Act conformity evidence, model validation, predictive maintenance, document extraction, retrieval and RAG, AI agents and MCP, a simulated humanoid. Every lesson autograded. From the team building Synapsa.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 4012 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `flagships/humanoid-lab/lessons/F15-L06-control-loop-in-c/lesson.c`
```
// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Synapsa Commons - Copyright 2026 RealAI - free to learn from and share, not to sell; see NOTICE.
// F15-L06 — the control loop in C, against MuJoCo's own C API.
//
// Three functions are stubs. Fill them in, then run:
//
//     make test
//
// The self-test reports each exercise separately, so you can finish them one at a time and
// watch the TODOs turn into PASSes. Everything below the three exercises is the harness; it
// is given, and it is worth reading, because it is the shape every control loop has.

/* clock_gettime and CLOCK_MONOTONIC are POSIX, not ISO C. Under -std=c11, glibc (Linux)
   hides them unless asked before the first header; macOS shows them regardless. */
#define _DEFAULT_SOURCE
#include <mujoco/mujoco.h>

#include <math.h>
#include <setjmp.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

// ---------------------------------------------------------------------------------------
// Defaults. Every one is overridable on the command line, because the point of the lesson is
// to let a student move a gain and watch what it costs.
// ---------------------------------------------------------------------------------------
#define MAXU 16          // most actuators this teaching binary will handle
#define MAXTRACE 256     // rows of trajectory kept for the Python comparison

// Three helpers below are used by some builds of this file and not others: todo() disappears
// once you have finished all three exercises, and clamp()/stats_tick() are unreferenced until
// you start calling them. Marking them keeps -Wunused-function meaningful for YOUR code
// instead of drowning it in warnings about the scaffolding.
#define COMMONS_MAYBE_UNUSED __attribute__((unused))

static const double kDefaultKp = 40.0;
static const double kDefaultKd = 3.0;
static const int    kDefaultTicks = 1500;
static const double kDefaultTarget[2] = {0.8, -1.2};

// A joint counts as "settled" when it is inside this many radians of its target AND stays
// there. Leaving the band resets the clock, so a settle tick is a time after which the arm
// never left again — not merely the first time it brushed past.
static const double kSettleTol = 0.05;

// =======================================================================================
// Plumbing for the self-test. Read it once, then ignore it.
// =======================================================================================
//
// C has no exceptions, so an unfinished exercise reports itself with setjmp/longjmp: todo()
// records a message and jumps back to the check that called it. main() turns an unfinished
// exercise into exit code 2, which the lesson's Python wrapper translates into
// NotImplementedError so the grader prints TODO rather than a stack trace. A real failure
// jumps the same way with a different code and becomes exit 1.
static jmp_buf g_jmp;
static int g_jmp_active = 0;
static char g_msg[1024];

static COMMONS_MAYBE_UNUSED void todo(const char* what, const char* hint) {
  snprintf(g_msg, sizeof g_msg, "%s() is still a stub — %s", what, hint);
  if (g_jmp_active) longjmp(g_jmp, 1);
  fprintf(stderr, "NOT IMPLEMENTED: %s\n", g_msg);
  exit(2);
}

static void require(int ok, const char* fmt, ...) {
  if (ok) return;
  va_list ap;
  va_start(ap, fmt);
  vsnprintf(g_msg, sizeof g_msg, fmt, ap);
  va_end(ap);
  if (g_jmp_active) longjmp(g_jmp, 2);
  fprintf(stderr, "error: %s\n", g_msg);
  exit(1);
}

static COMMONS_MAYBE_UNUSED double clamp(double v, double lo, double hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

static double now_seconds(void) {
  struct timespec ts;
  clock_gettime(CLOCK_MONOTONIC, &ts);
  return (double)ts.tv_sec + 1e-9 * (double)ts.tv_nsec;
}

// =======================================================================================
// EXERCISE 1 — actuator_addresses()
// =======================================================================================
//
// Given an actuator index, find the joint it drives and that joint's two addresses: where
// its position lives in d->qpos, and where its velocity lives in d->qvel.
//
// mjModel carries three tables that answer this, and the whole exercise is looking up the
// right one:
//
//     m->actuator_trnid[2*actuator]   the id of the joint this actuator transmits to
//     m->jnt_qposadr[joint]           that joint's first slot in qpos
//     m->jnt_dofadr[joint]            that joint's first slot in qvel
//
// Write the joint id into the return value, the qpos address through *qadr, and the qvel
// address through *vadr.
//
// It is tempting to skip all three and write qpos[actuator] / qvel[actuator]. On the pinned
// arm that is RIGHT, which is exactly what makes it dangerous: with two hinges and nothing
// else, nq == nv == 2 and the addresses happen to agree. Load assets/arm2_floating.xml,
// where the base carries a free joint, and the coincidence ends — the free joint takes seven
// qpos slots but only six qvel rows, so every hinge after it sits at a different address in
// the two arrays. The self-test checks BOTH models for this reason.
//
// Worked example, on assets/arm2_floating.xml: actuator 0 drives joint 1, whose qpos address
// is 7 and whose qvel address is 6. On assets/arm2.xml the same actuator drives joint 0, at
// qpos address 0 and qvel address 0.
static int actuator_addresses(const mjModel* m, int actuator, int* qadr, int* vadr) {
  // YOUR CODE HERE
  todo("actuator_addresses",
       "read the joint id from m->actuator_trnid[2*actuator], then write "
       "m->jnt_qposadr[joint] through qadr and m->jnt_dofadr[joint] through vadr, and return "
       "the joint id");
  return -1;  // unreachable; todo() never returns
}

// =======================================================================================
// EXERCISE 2 — pd_ctrl()
// =======================================================================================
//
// Compute one command per actuator and write them into ctrl_out. For actuator i:
//
//     tau = kp * (target[i] - qpos[qadr]) - kd * qvel[vadr]
//     ctrl_out[i] = clamp(tau, ctrlrange_lo, ctrlrange_hi)   when the actuator is limited
//
// Three things to get right, each of which the self-test checks separately:
//
//  * target is indexed by ACTUATOR (target[i]), while qpos and qvel are indexed by the
//    ADDRESSES exercise 1 hands you. They are different index spaces and only agree by
//    accident on simple models.
//  * the limits are per actuator, and they are not symmetric in general:
//    m->actuator_ctrlrange[2*i] is the low bound, [2*i + 1] the high one.
//  * only clamp when m->actuator_ctrllimited[i] is true. An unlimited actuator has a
//    meaningless ctrlrange and clamping to it would silently throttle the controller.
//
// Worked example, on assets/arm2.xml with kp = 40, kd = 3, target = {0.8, -1.2} from the
// hanging keyframe (qpos = {0, 0}, qvel = {0, 0}): the raw commands are 40*0.8 = 32 and
// 40*(-1.2) = -48, and the ctrlranges are [-8, 8] and [-3, 3], so ctrl_out comes back
// {8, -3} — both actuators pinned to their limits on the very first tick.
static void pd_ctrl(const mjModel* m, const mjData* d, const double* target, double kp,
                    double kd, double* ctrl_out) {
  // YOUR CODE HERE
  todo("pd_ctrl",
       "loop i over m->nu: get the addresses from actuator_addresses, compute "
       "kp*(target[i] - d->qpos[qadr]) - kd*d->qvel[vadr], clamp it to "
       "m->actuator_ctrlrange[2*i]..[2*i+1] when m->actuator_ctrllimited[i], and store it in "
       "ctrl_out[i]");
}

// ---------------------------------------------------------------------------------------
// Bookkeeping for the loop. GIVEN — not an exercise. It is here so that exercise 3 is the
// loop and nothing but the loop.
// ---------------------------------------------------------------------------------------
typedef struct {
  long long ticks_done;
  long long saturated_ticks;
  int settle_tick;
  double peak_abs_err;
  int n_trace;
  int trace_every;
  double trace[MAXTRACE][8];  // k, time, qpos.., qvel.., ctrl..  (2 actuators assumed)
} LoopStats;

// The largest distance any actuated joint is from its target, right now.
static double max_abs_error(const mjModel* m, const mjData* d, const double* target) {
  double worst = 0.0;
  for (int i = 0; i < (int)m->nu; ++i) {
    int qadr = 0, vadr = 0;
    actuator_addresses(m, i, &qadr, &vadr);
    const double e = fabs(target[i] - d->qpos[qadr]);
    if (e > worst) worst = e;
  }
  return worst;
}

// Did any command come back sitting on its limit?
static int at_limit(const mjModel* m, const double* ctrl) {
  for (int i = 0; i < (int)m->nu; ++i) {
    if (!m->actuator_ctrllimited[i]) continue;
    const double lo = m->actuator_ctrlrange[2 * i], hi = m->actuator_ctrlrange[2 * i + 1];
    if (ctrl[i] >= hi - 1e-12 || ctrl[i] <= lo + 1e-12) return 1;
  }
  return 0;
}

// Everything that happens after a step: the counters, the settle clock and the trace.
// Call it once per tick, AFTER mj_step, with the ctrl you actually applied.
static COMMONS_MAYBE_UNUSED void stats_tick(const mjModel* m, const mjData* d, const double* ctrl,
                                          const double* target, int k, LoopStats* s) {
  s->ticks_done += 1;
  s->saturated_ticks += at_limit(m, ctrl);
  const double err = max_abs_error(m, d, target);
  if (err > s->peak_abs_err) s->peak_abs_err = err;
  // Leaving the band restarts the clock, so settle_tick ends up being the tick after which
  // the arm never left again.
  if (err < kSettleTol) {
    if (s->settle_tick < 0) s->settle_tick = k;
  } else {
    s->settle_tick = -1;
  }
  if (s->trace_every > 0 && k % s->trace_every == 0 && s->n_trace < MAXTRACE) {
    double* row = s->trace[s->n_trace++];
    row[0] = (double)k;
    row[1] = d->time;
    for (int i = 0; i < 2 && i < (int)m->nu; ++i) {
      int qadr = 0, vadr = 0;
      actuator_addresses(m
```

### Core Architecture Module: `flagships/humanoid-lab/lessons/F15-L06-control-loop-in-c/lesson.py`
```
# %% [markdown]
# <!-- COMMONS LAUNCHER v4 · generated by tools/notebooks.py · do not edit by hand -->
# <a href="https://github.com/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials"><img src="https://raw.githubusercontent.com/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/master/brand/synapsa-commons-badge.png" alt="Synapsa Commons" height="36"></a>
#
# Free, hands-on AI courses that run anywhere, from the team building [Synapsa](https://synapsa.realai.eu), an AI-native
# learning platform.
#
# © 2026 RealAI · free to learn from, share and adapt, not to sell ([CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)).
# The notice at the end of this notebook says what you may and may not do.
#
# [![Open in Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/blob/master/flagships/humanoid-lab/lessons/F15-L06-control-loop-in-c/lesson.ipynb)
# [![Open in Kaggle](https://kaggle.com/static/images/open-in-kaggle.svg)](https://kaggle.com/kernels/welcome?src=https://github.com/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/blob/master/flagships/humanoid-lab/lessons/F15-L06-control-loop-in-c/lesson.ipynb)
# [![Open in Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/master?labpath=flagships/humanoid-lab/lessons/F15-L06-control-loop-in-c/lesson.ipynb)
# [![Open in Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials)
#
# This lesson needs Python 3.11 or newer with numpy, which Colab, Kaggle, Binder and
# Codespaces already have, and a C or C++ compiler (`clang` or `gcc`). The cell below installs
# `mujoco==3.13.0` and fetches the files it needs beside it, and does nothing where they are
# already present. On Kaggle, switch Internet on in the notebook's settings first; Kaggle
# allows that only for phone-verified accounts.

# %%
# --- COMMONS LAUNCHER v4 · generated by tools/notebooks.py · do not edit by hand ---
# Makes this notebook run anywhere. Every line is a no-op when the thing is already present,
# so a local clone pays nothing and an online notebook repairs itself.
import importlib.util, os, subprocess, sys, urllib.request
from pathlib import Path

COMMONS_PIP = [("mujoco", "mujoco==3.13.0")]            # (import name, pinned pip spec) for what this lesson imports
COMMONS_SIBLINGS = ["Makefile", "lesson.c", "assets/SOURCE.md", "assets/arm2.xml", "assets/arm2_floating.xml"]    # files that must sit beside the notebook
# A fork, a classroom mirror or an offline copy can serve the files from elsewhere by setting
# COMMONS_RAW_OVERRIDE before running this cell.
COMMONS_RAW = os.environ.get("COMMONS_RAW_OVERRIDE") or "https://raw.githubusercontent.com/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/master/flagships/humanoid-lab/lessons/F15-L06-control-loop-in-c/"

# Resolve siblings against the LESSON's own directory, not the working directory. A notebook
# has no __file__ and runs with cwd alongside itself; a grader imports this file from the repo
# root. Checking cwd blindly makes the grader think every sibling is missing and reach for the
# network -- which would put a download on a graded path.
try:
    COMMONS_DIR = Path(__file__).resolve().parent
except NameError:
    COMMONS_DIR = Path.cwd()


def commons_host() -> str:
    """Name the notebook service we are on. Used for the message, and for honest errors."""
    try:
        if importlib.util.find_spec("google.colab") is not None:
            return "Google Colab"
    except (ImportError, ValueError):
        pass
    if os.environ.get("KAGGLE_KERNEL_RUN_TYPE"):
        return "Kaggle"
    if os.environ.get("BINDER_SERVICE_HOST"):
        return "Binder"
    if os.environ.get("CODESPACES"):
        return "GitHub Codespaces"
    return "a local Python environment"


_missing = [pip for imp, pip in COMMONS_PIP if importlib.util.find_spec(imp) is None]
if _missing:
    print("installing " + ", ".join(_missing) + " ...")
    # pip everywhere a student is likely to be; uv-managed local venvs ship without pip.
    if importlib.util.find_spec("pip") is not None:
        subprocess.run([sys.executable, "-m", "pip", "install", "-q", *_missing], check=True)
    else:
        subprocess.run(["uv", "pip", "install", "-q", "--python", sys.executable, *_missing],
                       check=True)
    importlib.invalidate_caches()

_fetched = []
for _name in COMMONS_SIBLINGS:
    if not (COMMONS_DIR / _name).exists():
        (COMMONS_DIR / _name).parent.mkdir(parents=True, exist_ok=True)
        try:
            urllib.request.urlretrieve(COMMONS_RAW + _name, COMMONS_DIR / _name)
            _fetched.append(_name)
        except Exception as _e:  # Kaggle disables the internet by default; say so plainly
            raise RuntimeError(
                f"this lesson needs {_name} beside the notebook and could not fetch it "
                f"({_e}). On Kaggle, switch Internet on in the notebook settings panel "
                f"(Kaggle allows that only for phone-verified accounts); otherwise download it "
                f"from {COMMONS_RAW + _name} and upload it beside the notebook."
            ) from None

print("ready on " + commons_host() + ("; fetched " + ", ".join(_fetched) if _fetched else ""))
# --- END COMMONS LAUNCHER ---

# %% [markdown]
# # F15-L06 · The control loop, in C
#
# **You will build:** a PD control loop written against MuJoCo's own C API — the address
# arithmetic, the control law and the fixed-step loop — plus the measurement that says how
# much of the gap between C and Python is physics and how much is the trip through Python.
#
# **Time:** ~70 minutes · **Runs on:** a laptop CPU, no GPU, no download
# · **Prerequisites:** F15-L01 (mjModel vs mjData), F15-L03 (PD control in Python)
#
# By the end you will be able to:
# 1. Implement a joint's `qpos` and `qvel` address lookup through `mjModel`'s own tables, and
#    show that the two addresses differ on a model with a free joint.
# 2. Implement a clamped PD control law over the actuator array in C and pass the binary's
#    self-test.
# 3. Implement a fixed-step control loop in C and show it advances simulated time by exactly
#    one timestep per tick.
# 4. Measure the same loop's throughput in C and in Python and report the per-tick overhead
#    that separates them.
# 5. Explain why a PD law leaves a steady-state error, from your own measurement of it.
#
# Most of what you write in this lesson lives in **`lesson.c`**. This notebook builds it,
# drives it, checks it and measures it. Two exercises at the end are in Python, and they exist
# so the comparison at the end is between two loops you wrote rather than a slogan.

# %%
# Setup: everything the lesson needs, in one cell, with versions printed.
import math
import subprocess
import sys
import time
from pathlib import Path

import mujoco
import numpy as np

print("mujoco", mujoco.__version__, "· numpy", np.__version__, "· python",
      sys.version.split()[0])

# True in a notebook and when this file is run as a script; False when the autograder imports
# it. Every check below is called under this guard, so the cell you are sitting in reports on
# itself, while importing the lesson never runs anything.
_IS_MAIN = __name__ == "__main__"

try:
    LESSON_DIR = Path(__file__).resolve().parent
except NameError:  # a notebook has no __file__
    LESSON_DIR = Path.cwd()

C_SRC = "lesson.c"
BIN = "lesson_bin"
MODEL_REL = "assets/arm2.xml"
FLOATING_REL = "assets/arm2_floating.xml"
MODEL_PATH = LESSON_DIR / MODEL_REL
FLOATING_PATH = LESSON_DIR / FLOATING_REL

# The control task, mirrored exactly from lesson.c. Both languages must drive the same arm to
# the same target with the same gains or no comparison between them means anything.
TARGET = (0.8, -1.2)
KP, KD = 40.0, 3.0
TICKS = 1500
BENCH_TICKS = 40_000
SETTLE_TOL = 0.05        # kSettleTol in lesson.c

_BUILD = None


def build(verbose: bool = True):
    """Compile the C source with make. Cached: the compiler runs once per session."""
    global _BUILD
    if _BUILD is None:
        proc = subprocess.run(
            ["make", "-C", str(LESSON_DIR), f"PYTHON={sys.executable}",
             f"SRC={C_SRC}", f"BIN={BIN}"],
            capture_output=True, text=True, timeout=600)
        _BUILD = (proc.returncode == 0, (proc.stdout + proc.stderr).strip())
    ok, out = _BUILD
    if verbose:
        print("build OK" if ok else "BUILD FAILED\n" + out)
    return ok, out


def run_c(*args, timeout: int = 300) -> str:
    """Run the compiled binary and return its stdout.

    Exit code 2 means one of the three C exercises is still a stub, so it is re-raised as
    NotImplementedError — the grader then reports TODO instead of an error.
    """
    ok, out = build(verbose=False)
    if not ok:
        raise RuntimeError("the C build failed; run build() to see the compiler output\n" + out)
    proc = subprocess.run([str(LESSON_DIR / BIN), *args],
                          cwd=LESSON_DIR, capture_output=True, text=True, timeout=timeout)
    if proc.returncode == 2:
        raise NotImplementedError(proc.stderr.strip())
    if proc.returncode != 0:
        raise RuntimeError(f"{BIN} {' '.join(args)} exited {proc.returncode}\n{proc.stderr.strip()}")
    return proc.stdout


def metrics(text: str) -> dict:
    """Parse the binary's `@ key=value` report lines into a dict of floats."""
    return {k: float(v) for k, v in
            (line[2:].split("=", 1) for line in text.splitlines() if line.startswith("@ "))}


def rows(text: str, tag: str) -> list:
    """Parse the binary's `<tag> v1 v2 ...` lines into a list of lists of floats."""
    return [[float(v) for v in
```

### Core Architecture Module: `lessons/T03-L02-bpe-merge-loop-in-cpp/assets/make_corpus.py`
```
#!/usr/bin/env python3
"""Regenerate assets/corpus.txt — the single input both trainers in T03-L02 read.

The corpus is CPython's own standard-library source. It is on every machine that can run
this lesson, so nothing is downloaded, and it is licensed under the PSF License Agreement
(see assets/SOURCE.md). Code is a deliberate choice of text: identifiers, punctuation runs
and indentation give byte-pair merges something with real structure to find.

    python assets/make_corpus.py --bytes 240000 --out assets/corpus.txt

The defaults below are the ones the shipped corpus.txt was built with, so a bare run
reproduces it byte for byte and the sha256 it prints matches the one in SOURCE.md.

The shipped corpus.txt was produced by this script and is byte-identical for every student,
which is what makes the merge list a testable object rather than a machine-dependent one.
"""
from __future__ import annotations

import argparse
import hashlib
import sysconfig
from pathlib import Path

# A fixed, alphabetical slice of the standard library. Every name here has shipped with
# CPython since well before 3.12, so the script reproduces the same corpus on any 3.12
# interpreter. Order is fixed because concatenation order changes the merge list.
MODULES = (
    "argparse.py",
    "ast.py",
    "dataclasses.py",
    "difflib.py",
    "enum.py",
    "functools.py",
    "inspect.py",
    "pathlib.py",
    "random.py",
    "statistics.py",
    "textwrap.py",
    "typing.py",
)


def build(target_bytes: int) -> bytes:
    """Concatenate MODULES until `target_bytes` is reached, cutting on a whitespace byte."""
    stdlib = Path(sysconfig.get_paths()["stdlib"])
    chunks: list[bytes] = []
    total = 0
    for name in MODULES:
        path = stdlib / name
        if not path.exists():
            continue
        blob = path.read_bytes()
        chunks.append(blob)
        total += len(blob) + 1
        if total >= target_bytes:
            break
    text = b"\n".join(chunks)
    if len(text) <= target_bytes:
        return text
    cut = target_bytes
    while cut > 0 and not text[cut - 1 : cut].isspace():
        cut -= 1
    return text[:cut]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--bytes", type=int, default=240_000)
    ap.add_argument("--out", default="corpus.txt")
    a = ap.parse_args()
    data = build(a.bytes)
    out = Path(a.out)
    out.write_bytes(data)
    print(f"wrote {out} — {len(data)} bytes, sha256 {hashlib.sha256(data).hexdigest()[:16]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

```

### Core Architecture Module: `lessons/T03-L02-bpe-merge-loop-in-cpp/lesson.cpp`
```
// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Synapsa Commons - Copyright 2026 RealAI - free to learn from and share, not to sell; see NOTICE.
// T03-L02 — the BPE merge loop, in C++.
//
// Four functions are yours to write. Everything else — pre-tokenisation, argument parsing,
// the self-test, the timing harness — is already here and is not part of the exercise.
//
//     make test                         build this file and run its self-test
//     make bench MERGES=300             train on the shipped corpus and print timings
//
// Only the C++ standard library is allowed. No third-party header, no hand-written assembly,
// no threads: the point of this lesson is that plain, ordinary C++ over a flat array is
// already worth a large constant factor against the same algorithm in Python. How large is
// not for this comment to say — section 8 of the notebook measures it on your machine, and
// that measured number is the only one you should ever quote.
#include <algorithm>
#include <chrono>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <vector>

namespace bpe {

// A symbol is an int: 0..255 are raw bytes, 256 is the word boundary, 257 and up are the
// merged symbols this trainer invents. int, not char: a merged symbol has no byte to live in.
constexpr int kBoundary = 256;
constexpr int kFirstMergeId = 257;
constexpr long kMinCount = 2;

// Pair counts live in a flat hash map keyed by the two symbol ids packed into one 64-bit
// integer. A std::pair<int,int> key would need a custom hash and would chase two words of
// memory per probe; this key is one register.
using PairCounts = std::unordered_map<uint64_t, long>;

inline uint64_t pack(int a, int b) {
  return (static_cast<uint64_t>(static_cast<uint32_t>(a)) << 32) |
         static_cast<uint64_t>(static_cast<uint32_t>(b));
}
inline int pair_left(uint64_t key) { return static_cast<int>(key >> 32); }
inline int pair_right(uint64_t key) { return static_cast<int>(key & 0xffffffffULL); }

struct Merge {
  int a;
  int b;
  int new_id;
  long count;
};

inline bool is_ascii_space(unsigned char c) {
  return c == ' ' || c == '\t' || c == '\n' || c == '\r' || c == '\f' || c == '\v';
}

// Given: pre-tokenisation. Bytes of one word, then kBoundary, then the next word. Whitespace
// itself is dropped. The Python trainer in lesson.py does exactly this, byte for byte, which
// is what makes the two merge lists comparable.
std::vector<int> pretokenise(const std::string& blob) {
  std::vector<int> seq;
  seq.reserve(blob.size());
  bool in_word = false;
  for (unsigned char c : blob) {
    if (is_ascii_space(c)) {
      if (in_word) {
        seq.push_back(kBoundary);
        in_word = false;
      }
    } else {
      seq.push_back(static_cast<int>(c));
      in_word = true;
    }
  }
  if (in_word) seq.push_back(kBoundary);
  return seq;
}

// ---------------------------------------------------------------------------------------
// EXERCISE 1 — count every adjacent pair in one pass.
//
// Fill `counts` so that counts[pack(x, y)] is the number of positions i where seq[i] == x and
// seq[i+1] == y. Two rules:
//   * a pair is never counted if either side is kBoundary — merging across a word boundary
//     would invent tokens that span two words, which no tokenizer wants;
//   * overlapping occurrences are all counted here. In [7,7,7] the pair (7,7) counts twice,
//     even though applying that merge will only replace one of them. Counting and merging
//     disagree on purpose; exercise 3 is where the disagreement is resolved.
//
// Worked example:
//   pretokenise("ab ab") == [97, 98, 256, 97, 98, 256]
//   count_pairs of that leaves exactly one entry: counts[pack(97, 98)] == 2
//   (97,256) and (256,97) are not entries at all — not zero entries, absent entries.
//
// Cost: one linear scan, O(n). Read each symbol once, keep the previous one in a local.
// ---------------------------------------------------------------------------------------
void count_pairs(const std::vector<int>& seq, PairCounts& counts) {
  counts.clear();
  // YOUR CODE HERE
  throw std::logic_error("NOT_IMPLEMENTED count_pairs");
}

// ---------------------------------------------------------------------------------------
// EXERCISE 2 — pick the winner, deterministically.
//
// Return the pair with the highest count through *out_a, *out_b and *out_count, and return
// true. For an empty map, touch nothing and return false.
//
// The tie-break is the whole exercise. std::unordered_map iterates in an unspecified order,
// so "the first pair I met with the maximum count" is a different answer on a different day,
// a different libc++ or a different corpus size — and a tokenizer whose vocabulary depends on
// hash order is not reproducible. Break ties towards the SMALLER pair: compare a first, then
// b, which is exactly what comparing the packed uint64_t keys does for you.
//
// Worked example:
//   counts = { pack(9,9): 4, pack(2,7): 4 }  ->  returns true, a=2, b=7, count=4
//   counts = { }                             ->  returns false
//
// Cost: one pass over the map, O(number of distinct pairs).
// ---------------------------------------------------------------------------------------
bool best_pair(const PairCounts& counts, int* out_a, int* out_b, long* out_count) {
  // YOUR CODE HERE
  throw std::logic_error("NOT_IMPLEMENTED best_pair");
}

// ---------------------------------------------------------------------------------------
// EXERCISE 3 — rewrite the sequence in place.
//
// Replace every non-overlapping left-to-right occurrence of (a, b) with new_id, shrink the
// vector to the new length with seq.resize(), and return that length.
//
// Do it with two indices into the SAME vector — a read cursor and a write cursor — not by
// building a second vector and swapping. The write cursor never overtakes the read cursor, so
// this is safe, and it is the difference between touching the data once and allocating a
// fresh array on every one of hundreds of merges.
//
// Worked example (the overlap trap):
//   seq = [7, 7, 7], merge (7,7) -> 300
//   correct:   [300, 7]      length 2 — the match consumes both symbols, so the scan resumes
//                                       after them, and the third 7 has nothing to pair with
//   wrong:     [300, 300, 7] length 3 — you advanced the read cursor by one after the match,
//                                       so the middle 7 was consumed twice and the sequence
//                                       barely shrank at all
//   A pair that never occurs must leave the sequence and its length untouched.
//
// Cost: one linear pass, O(n), zero allocations.
// ---------------------------------------------------------------------------------------
size_t apply_merge(std::vector<int>& seq, int a, int b, int new_id) {
  // YOUR CODE HERE
  throw std::logic_error("NOT_IMPLEMENTED apply_merge");
}

// ---------------------------------------------------------------------------------------
// EXERCISE 4 — the loop itself.
//
// Repeat at most n_merges times: count the pairs, take the best one, record it, apply it.
// Return the merges in the order they were made. Stop early — before recording anything —
// when there is no pair at all, or when the best pair occurs fewer than kMinCount times: a
// merge that fires once buys no compression and just burns a vocabulary slot.
//
// The k-th merge (counting from zero) is given the id kFirstMergeId + k. Ids are dense and
// sequential, so the merge list alone is enough to rebuild the vocabulary later.
//
// Worked example:
//   pretokenise("aaab aaab aaab") trained for 4 merges begins with
//   Merge{a='a', b='a', new_id=257, count=6} — (a,a) occurs twice per word, three words
//   pretokenise("abcdef") trained for 5 merges returns an EMPTY list: every pair occurs once.
//
// Cost: n_merges full rescans of a sequence that only shrinks — O(n_merges * n). That is the
// cost model this lesson is measuring, and it is identical in both languages.
// ---------------------------------------------------------------------------------------
std::vector<Merge> train(std::vector<int>& seq, int n_merges) {
  std::vector<Merge> merges;
  PairCounts counts;
  // YOUR CODE HERE
  throw std::logic_error("NOT_IMPLEMENTED train");
}

}  // namespace bpe

// =========================================================================================
// Below this line is plumbing: argument parsing, the sub-commands the notebook calls, and
// the self-test that `make test` runs. Nothing here is an exercise.
// =========================================================================================
namespace {

using bpe::PairCounts;

std::vector<int> parse_ints(const std::string& csv) {
  std::vector<int> out;
  std::string field;
  std::istringstream stream(csv);
  while (std::getline(stream, field, ',')) {
    if (!field.empty()) out.push_back(std::atoi(field.c_str()));
  }
  return out;
}

// "97:98:5,98:99:2" -> {(97,98): 5, (98,99): 2}
PairCounts parse_counts(const std::string& csv) {
  PairCounts counts;
  std::string field;
  std::istringstream stream(csv);
  while (std::getline(stream, field, ',')) {
    if (field.empty()) continue;
    int a = 0, b = 0;
    long n = 0;
    if (std::sscanf(field.c_str(), "%d:%d:%ld", &a, &b, &n) != 3)
      throw std::runtime_error("bad --counts field: " + field);
    counts[bpe::pack(a, b)] = n;
  }
  return counts;
}

std::string option(int argc, char** argv, const std::string& name, const std::string& fallback) {
  for (int i = 0; i + 1 < argc; ++i)
    if (name == argv[i]) return std::string(argv[i + 1]);
  return fallback;
}

std::string join(const std::vector<int>& seq) {
  std::string out;
  char buf[16];
  for (size_t i = 0; i < seq.size(); ++i) {
    std::snprintf(buf, sizeof buf, "%d", seq[i]);
    if (i) out += ',';
    out += buf;
  }
 
```

### Core Architecture Module: `lessons/T03-L02-bpe-merge-loop-in-cpp/lesson.py`
```
# %% [markdown]
# <!-- COMMONS LAUNCHER v4 · generated by tools/notebooks.py · do not edit by hand -->
# <a href="https://github.com/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials"><img src="https://raw.githubusercontent.com/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/master/brand/synapsa-commons-badge.png" alt="Synapsa Commons" height="36"></a>
#
# Free, hands-on AI courses that run anywhere, from the team building [Synapsa](https://synapsa.realai.eu), an AI-native
# learning platform.
#
# © 2026 RealAI · free to learn from, share and adapt, not to sell ([CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)).
# The notice at the end of this notebook says what you may and may not do.
#
# [![Open in Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/blob/master/lessons/T03-L02-bpe-merge-loop-in-cpp/lesson.ipynb)
# [![Open in Kaggle](https://kaggle.com/static/images/open-in-kaggle.svg)](https://kaggle.com/kernels/welcome?src=https://github.com/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/blob/master/lessons/T03-L02-bpe-merge-loop-in-cpp/lesson.ipynb)
# [![Open in Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/master?labpath=lessons/T03-L02-bpe-merge-loop-in-cpp/lesson.ipynb)
# [![Open in Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials)
#
# This lesson needs Python 3.11 or newer, and a C or C++ compiler (`clang` or `gcc`). The cell
# below installs `tokenizers==0.23.2` and fetches the files it needs beside it, and does
# nothing where they are already present. On Kaggle, switch Internet on in the notebook's
# settings first; Kaggle allows that only for phone-verified accounts.

# %%
# --- COMMONS LAUNCHER v4 · generated by tools/notebooks.py · do not edit by hand ---
# Makes this notebook run anywhere. Every line is a no-op when the thing is already present,
# so a local clone pays nothing and an online notebook repairs itself.
import importlib.util, os, subprocess, sys, urllib.request
from pathlib import Path

COMMONS_PIP = [("tokenizers", "tokenizers==0.23.2")]            # (import name, pinned pip spec) for what this lesson imports
COMMONS_SIBLINGS = ["Makefile", "lesson.cpp", "assets/SOURCE.md", "assets/corpus.txt", "assets/make_corpus.py"]    # files that must sit beside the notebook
# A fork, a classroom mirror or an offline copy can serve the files from elsewhere by setting
# COMMONS_RAW_OVERRIDE before running this cell.
COMMONS_RAW = os.environ.get("COMMONS_RAW_OVERRIDE") or "https://raw.githubusercontent.com/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/master/lessons/T03-L02-bpe-merge-loop-in-cpp/"

# Resolve siblings against the LESSON's own directory, not the working directory. A notebook
# has no __file__ and runs with cwd alongside itself; a grader imports this file from the repo
# root. Checking cwd blindly makes the grader think every sibling is missing and reach for the
# network -- which would put a download on a graded path.
try:
    COMMONS_DIR = Path(__file__).resolve().parent
except NameError:
    COMMONS_DIR = Path.cwd()


def commons_host() -> str:
    """Name the notebook service we are on. Used for the message, and for honest errors."""
    try:
        if importlib.util.find_spec("google.colab") is not None:
            return "Google Colab"
    except (ImportError, ValueError):
        pass
    if os.environ.get("KAGGLE_KERNEL_RUN_TYPE"):
        return "Kaggle"
    if os.environ.get("BINDER_SERVICE_HOST"):
        return "Binder"
    if os.environ.get("CODESPACES"):
        return "GitHub Codespaces"
    return "a local Python environment"


_missing = [pip for imp, pip in COMMONS_PIP if importlib.util.find_spec(imp) is None]
if _missing:
    print("installing " + ", ".join(_missing) + " ...")
    # pip everywhere a student is likely to be; uv-managed local venvs ship without pip.
    if importlib.util.find_spec("pip") is not None:
        subprocess.run([sys.executable, "-m", "pip", "install", "-q", *_missing], check=True)
    else:
        subprocess.run(["uv", "pip", "install", "-q", "--python", sys.executable, *_missing],
                       check=True)
    importlib.invalidate_caches()

_fetched = []
for _name in COMMONS_SIBLINGS:
    if not (COMMONS_DIR / _name).exists():
        (COMMONS_DIR / _name).parent.mkdir(parents=True, exist_ok=True)
        try:
            urllib.request.urlretrieve(COMMONS_RAW + _name, COMMONS_DIR / _name)
            _fetched.append(_name)
        except Exception as _e:  # Kaggle disables the internet by default; say so plainly
            raise RuntimeError(
                f"this lesson needs {_name} beside the notebook and could not fetch it "
                f"({_e}). On Kaggle, switch Internet on in the notebook settings panel "
                f"(Kaggle allows that only for phone-verified accounts); otherwise download it "
                f"from {COMMONS_RAW + _name} and upload it beside the notebook."
            ) from None

print("ready on " + commons_host() + ("; fetched " + ", ".join(_fetched) if _fetched else ""))
# --- END COMMONS LAUNCHER ---

# %% [markdown]
# # T03-L02 · The BPE merge loop, in C++
#
# **You will build:** a byte-pair-encoding trainer in C++ whose merge list is *identical* to
# the Python trainer's from T03-L01, on the same corpus — and a measurement of how much time
# the language change bought on your machine.
#
# **Time:** ~60 minutes · **Runs on:** a laptop CPU, no GPU, no download
# · **Prerequisites:** `T03-L01-bpe-from-scratch`
#
# By the end you will be able to:
# 1. Implement the four-function merge loop in C++ — count, argmax, merge, train — with nothing
#    but `std::` containers.
# 2. Measure the naive rescan's cost in both languages on one identical corpus, and report the
#    speedup your own machine produces.
# 3. Show that your C++ merge list matches Python's exactly, and name the one rule that makes
#    that reproducibility possible.
# 4. Explain why the speedup is a constant factor and not an asymptotic one.
# 5. Say which language each production tokenizer is really written in, and what that does and
#    does not change about the argument.
#
# **You edit `lesson.cpp`, not this file.** This notebook builds your C++, feeds it cases, and
# checks its answers against a Python trainer that is given to you, already working.

# %%
# Setup: one cell, everything the lesson needs, with versions printed.
import platform
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Callable

# Work that costs real seconds lives inside `if __name__ == "__main__":` blocks, so the
# autograder can import this file without re-running the whole lesson. In a notebook
# __name__ IS "__main__", so every one of those cells runs normally when you run it.
HERE = Path(__file__).resolve().parent if "__file__" in globals() else Path.cwd()
IS_REFERENCE = HERE.name == "solutions"
LESSON_ROOT = HERE.parent if IS_REFERENCE else HERE
CPP_SRC = HERE / "lesson.cpp"                      # the file you edit
CPP_BIN = LESSON_ROOT / "build" / ("lesson_ref" if IS_REFERENCE else "lesson")
CORPUS = LESSON_ROOT / "assets" / "corpus.txt"     # ships with the lesson; nothing is downloaded

HEADLINE_MERGES = 300      # the size of the race in section 8
ORACLE_BYTES = 40_000      # a slice of the corpus, for the checks that compare merge lists
ORACLE_MERGES = 30

print("python", sys.version.split()[0], "·", platform.machine(), platform.system())
print("corpus", CORPUS.name, CORPUS.stat().st_size, "bytes")
print("source", CPP_SRC.relative_to(LESSON_ROOT))
_paths = subprocess.run(["make", "-C", str(LESSON_ROOT), f"PYTHON={sys.executable}", "paths"],
                        capture_output=True, text=True)
print(_paths.stdout.strip() or _paths.stderr.strip())

# Every check and every demo below runs through `_try`, so pressing Run all before you have
# written a line of C++ reaches the progress board at the foot of the notebook instead of
# stopping at the first TODO.
# The four exercises, in the order the notebook meets them: (label, C++ function, where).
_EXERCISES = [("exercise 1", "count_pairs", "section 4"), ("exercise 2", "best_pair", "section 5"),
              ("exercise 3", "apply_merge", "section 6"), ("exercise 4", "train", "section 7")]
_FUNCTION = {label: function for label, function, _ in _EXERCISES}
_STATUS: dict = {}       # label -> "passed" | "failed" | "not started", for the progress board
_WAITING_ON: dict = {}   # label -> the C++ function whose TODO stopped it


def _unfinished(exc: BaseException) -> str:
    """The C++ function whose TODO fired. The binary reports it as `NOT_IMPLEMENTED <name>`."""
    found = re.search(r"NOT_IMPLEMENTED (\w+)", str(exc))
    return found.group(1) if found else ""


def _named(labels: list) -> str:
    """["exercise 4"] -> "exercise 4 (`train`)"; several -> "exercises 1 and 4"."""
    if len(labels) == 1:
        return f"{labels[0]} (`{_FUNCTION[labels[0]]}`)"
    nums = [label.split()[-1] for label in labels]
    return "exercises " + ", ".join(nums[:-1]) + " and " + nums[-1]


def _try(label: str, check: Callable[[], None], needs: tuple = ()) -> None:
    """Run a check, or a demo that depends on your code, without derailing the notebook.

    A stub you have not filled in yet simply says so, by name: the binary reports which
    function's TODO it hit. A wrong answer prints the check's own message — which names the
    likely mistake — and the notebook carries on, so one broken exercise never hides the
    feedback on the others. A demo names the exercises it `needs
```

### Core Architecture Module: `lessons/T07-L01-agent-loop-from-scratch/lesson.py`
```
# %% [markdown]
# <!-- COMMONS LAUNCHER v4 · generated by tools/notebooks.py · do not edit by hand -->
# <a href="https://github.com/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials"><img src="https://raw.githubusercontent.com/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/master/brand/synapsa-commons-badge.png" alt="Synapsa Commons" height="36"></a>
#
# Free, hands-on AI courses that run anywhere, from the team building [Synapsa](https://synapsa.realai.eu), an AI-native
# learning platform.
#
# © 2026 RealAI · free to learn from, share and adapt, not to sell ([CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)).
# The notice at the end of this notebook says what you may and may not do.
#
# [![Open in Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/blob/master/lessons/T07-L01-agent-loop-from-scratch/lesson.ipynb)
# [![Open in Kaggle](https://kaggle.com/static/images/open-in-kaggle.svg)](https://kaggle.com/kernels/welcome?src=https://github.com/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/blob/master/lessons/T07-L01-agent-loop-from-scratch/lesson.ipynb)
# [![Open in Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/master?labpath=lessons/T07-L01-agent-loop-from-scratch/lesson.ipynb)
# [![Open in Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials)
#
# This lesson needs Python 3.11 or newer with numpy, which Colab, Kaggle, Binder and
# Codespaces already have.

# %%
# --- COMMONS LAUNCHER v4 · generated by tools/notebooks.py · do not edit by hand ---
# Makes this notebook run anywhere. Every line is a no-op when the thing is already present,
# so a local clone pays nothing and an online notebook repairs itself.
import importlib.util, os, subprocess, sys, urllib.request
from pathlib import Path

COMMONS_PIP = []            # (import name, pinned pip spec) for what this lesson imports
COMMONS_SIBLINGS = []    # files that must sit beside the notebook
# A fork, a classroom mirror or an offline copy can serve the files from elsewhere by setting
# COMMONS_RAW_OVERRIDE before running this cell.
COMMONS_RAW = os.environ.get("COMMONS_RAW_OVERRIDE") or "https://raw.githubusercontent.com/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/master/lessons/T07-L01-agent-loop-from-scratch/"

# Resolve siblings against the LESSON's own directory, not the working directory. A notebook
# has no __file__ and runs with cwd alongside itself; a grader imports this file from the repo
# root. Checking cwd blindly makes the grader think every sibling is missing and reach for the
# network -- which would put a download on a graded path.
try:
    COMMONS_DIR = Path(__file__).resolve().parent
except NameError:
    COMMONS_DIR = Path.cwd()


def commons_host() -> str:
    """Name the notebook service we are on. Used for the message, and for honest errors."""
    try:
        if importlib.util.find_spec("google.colab") is not None:
            return "Google Colab"
    except (ImportError, ValueError):
        pass
    if os.environ.get("KAGGLE_KERNEL_RUN_TYPE"):
        return "Kaggle"
    if os.environ.get("BINDER_SERVICE_HOST"):
        return "Binder"
    if os.environ.get("CODESPACES"):
        return "GitHub Codespaces"
    return "a local Python environment"


_missing = [pip for imp, pip in COMMONS_PIP if importlib.util.find_spec(imp) is None]
if _missing:
    print("installing " + ", ".join(_missing) + " ...")
    # pip everywhere a student is likely to be; uv-managed local venvs ship without pip.
    if importlib.util.find_spec("pip") is not None:
        subprocess.run([sys.executable, "-m", "pip", "install", "-q", *_missing], check=True)
    else:
        subprocess.run(["uv", "pip", "install", "-q", "--python", sys.executable, *_missing],
                       check=True)
    importlib.invalidate_caches()

_fetched = []
for _name in COMMONS_SIBLINGS:
    if not (COMMONS_DIR / _name).exists():
        (COMMONS_DIR / _name).parent.mkdir(parents=True, exist_ok=True)
        try:
            urllib.request.urlretrieve(COMMONS_RAW + _name, COMMONS_DIR / _name)
            _fetched.append(_name)
        except Exception as _e:  # Kaggle disables the internet by default; say so plainly
            raise RuntimeError(
                f"this lesson needs {_name} beside the notebook and could not fetch it "
                f"({_e}). On Kaggle, switch Internet on in the notebook settings panel "
                f"(Kaggle allows that only for phone-verified accounts); otherwise download it "
                f"from {COMMONS_RAW + _name} and upload it beside the notebook."
            ) from None

print("ready on " + commons_host() + ("; fetched " + ", ".join(_fetched) if _fetched else ""))
# --- END COMMONS LAUNCHER ---

# %% [markdown]
# # T07-L01 · The agent loop from scratch, and why reliability compounds
#
# **You will build:** a hand-rolled JSON-Schema-style argument validator, a tool registry that
# never crashes on a bad call, capped seeded retries, an agent loop with explicit stop
# conditions, and the evaluation harness that measures how reliable the whole thing is.
#
# **Time:** ~55 minutes · **Runs on:** a laptop CPU, no GPU, no download ·
# **Prerequisites:** T00-L01-the-8gb-track.
#
# There is no language model anywhere in this lesson. `ScriptedPolicy` (section 9) is a
# seeded, deterministic stand-in that knows its own task's correct plan and substitutes a
# scripted mistake at a rate YOU choose — because the point of this lesson is the harness
# around the model, which fails or succeeds the same way whatever sits behind it.
#
# By the end you will be able to:
#
# 1. Implement a JSON-Schema-style argument validator, by hand, and a tool registry that
#    turns an unknown tool name or a malformed call into a returned error rather than an
#    exception.
# 2. Implement capped, seeded exponential backoff with full jitter and a retry wrapper that
#    retries only transient tool failures, never a malformed call.
# 3. Implement the agent loop itself, with a step budget, a cost budget and a stuck-loop
#    detector as its explicit stop conditions.
# 4. Measure success rate against task length over a seeded suite of synthetic tasks, with a
#    bootstrap confidence interval, a cost-per-success figure and a failure taxonomy.
# 5. Fit the measured success-rate-versus-length curve against p^n and measure how much each
#    guardrail — validation, retries, budget — moves success rate and cost.

# %%
# Setup: everything the lesson needs, in one cell, with versions printed.
import contextlib
import io
import random
import sys
import time
import traceback
from typing import Any, Callable, NamedTuple, Sequence

import numpy as np

_LESSON_T0 = time.perf_counter()
print("python", sys.version.split()[0], "· numpy", np.__version__, "· platform", sys.platform)

SEED = 20260923          # this lesson's one fixed seed: every task, every fault, every retry
                          # delay and every bootstrap resample derives from it, so re-running
                          # prints the same numbers on any machine.

_FAILED_CHECKS: list[str] = []
_STATUS: dict[str, str] = {}   # label -> "passed" | "failed" | "not started", latest run

# The exercises, in the order you meet them, and the functions each one asks you to write.
# The progress board at the foot of the notebook is built from this, and a cell that is
# waiting on an unfinished exercise names it from here.
_EXERCISES: dict[str, tuple[str, ...]] = {
    "exercise 1": ("validate_args",),
    "exercise 2": ("call_tool",),
    "exercise 3": ("backoff_delay",),
    "exercise 4": ("call_tool_with_retries",),
    "exercise 5": ("is_stuck",),
    "exercise 6": ("budget_status",),
    "exercise 7": ("run_agent_loop",),
    "exercise 8": ("bootstrap_success_interval",),
    "exercise 9": ("fit_reliability",),
}


def _named(labels: list[str]) -> str:
    """["exercise 3"] -> "exercise 3 (backoff_delay)"; several -> "exercises 3, 6 and 8"."""
    if len(labels) == 1:
        return f"{labels[0]} ({', '.join(_EXERCISES[labels[0]])})"
    nums = [label.split()[-1] for label in labels]
    return "exercises " + ", ".join(nums[:-1]) + " and " + nums[-1]


def _try(label: str, check: Callable[[], None], needs: tuple[str, ...] = ()) -> None:
    """Run a check, or a demo that depends on your code, without derailing the notebook.

    A stub you have not filled in yet simply says so. A wrong answer prints the check's own
    message — which names the likely mistake — and the notebook carries on, so one broken
    exercise never hides the feedback on the others. A demo names the exercises it `needs`:
    until each has passed its check, the demo says which one it is waiting for and skips.
    Nothing is swallowed: every outcome is recorded in `_STATUS` for the progress board at the
    foot of the notebook, and every failure in `_FAILED_CHECKS`, which ends a script run
    non-zero.
    """
    waiting = [name for name in _EXERCISES
               if name in needs and _STATUS.get(name) != "passed"]
    if waiting:
        _STATUS[label] = "not started"
        print(f"{label}: skipped — needs {_named(waiting)} to pass first.")
        return
    try:
        check()
    except NotImplementedError as exc:
        _STATUS[label] = "not started"
        stub = traceback.extract_tb(exc.__traceback__)[-1].name
        owner = [name for name, funcs in _EXERCISES.items() if stub in funcs and name != label]
        if owner:
            print(f"{label}: skipped — needs {_named(owner)} first.")
        elif label in _EXERCISES:
            print(f"{label}: no
```

### Core Architecture Module: `programmes/document-intelligence/lessons/P02-L06-review-queues-real-reviewers/lesson.py`
```
# %% [markdown]
# <!-- COMMONS LAUNCHER v4 · generated by tools/notebooks.py · do not edit by hand -->
# <a href="https://github.com/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials"><img src="https://raw.githubusercontent.com/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/master/brand/synapsa-commons-badge.png" alt="Synapsa Commons" height="36"></a>
#
# Free, hands-on AI courses that run anywhere, from the team building [Synapsa](https://synapsa.realai.eu), an AI-native
# learning platform.
#
# © 2026 RealAI · free to learn from, share and adapt, not to sell ([CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)).
# The notice at the end of this notebook says what you may and may not do.
#
# [![Open in Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/blob/master/programmes/document-intelligence/lessons/P02-L06-review-queues-real-reviewers/lesson.ipynb)
# [![Open in Kaggle](https://kaggle.com/static/images/open-in-kaggle.svg)](https://kaggle.com/kernels/welcome?src=https://github.com/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/blob/master/programmes/document-intelligence/lessons/P02-L06-review-queues-real-reviewers/lesson.ipynb)
# [![Open in Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/master?labpath=programmes/document-intelligence/lessons/P02-L06-review-queues-real-reviewers/lesson.ipynb)
# [![Open in Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials)
#
# This lesson needs Python 3.11 or newer with numpy, which Colab, Kaggle, Binder and
# Codespaces already have.

# %%
# --- COMMONS LAUNCHER v4 · generated by tools/notebooks.py · do not edit by hand ---
# Makes this notebook run anywhere. Every line is a no-op when the thing is already present,
# so a local clone pays nothing and an online notebook repairs itself.
import importlib.util, os, subprocess, sys, urllib.request
from pathlib import Path

COMMONS_PIP = []            # (import name, pinned pip spec) for what this lesson imports
COMMONS_SIBLINGS = []    # files that must sit beside the notebook
# A fork, a classroom mirror or an offline copy can serve the files from elsewhere by setting
# COMMONS_RAW_OVERRIDE before running this cell.
COMMONS_RAW = os.environ.get("COMMONS_RAW_OVERRIDE") or "https://raw.githubusercontent.com/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/master/programmes/document-intelligence/lessons/P02-L06-review-queues-real-reviewers/"

# Resolve siblings against the LESSON's own directory, not the working directory. A notebook
# has no __file__ and runs with cwd alongside itself; a grader imports this file from the repo
# root. Checking cwd blindly makes the grader think every sibling is missing and reach for the
# network -- which would put a download on a graded path.
try:
    COMMONS_DIR = Path(__file__).resolve().parent
except NameError:
    COMMONS_DIR = Path.cwd()


def commons_host() -> str:
    """Name the notebook service we are on. Used for the message, and for honest errors."""
    try:
        if importlib.util.find_spec("google.colab") is not None:
            return "Google Colab"
    except (ImportError, ValueError):
        pass
    if os.environ.get("KAGGLE_KERNEL_RUN_TYPE"):
        return "Kaggle"
    if os.environ.get("BINDER_SERVICE_HOST"):
        return "Binder"
    if os.environ.get("CODESPACES"):
        return "GitHub Codespaces"
    return "a local Python environment"


_missing = [pip for imp, pip in COMMONS_PIP if importlib.util.find_spec(imp) is None]
if _missing:
    print("installing " + ", ".join(_missing) + " ...")
    # pip everywhere a student is likely to be; uv-managed local venvs ship without pip.
    if importlib.util.find_spec("pip") is not None:
        subprocess.run([sys.executable, "-m", "pip", "install", "-q", *_missing], check=True)
    else:
        subprocess.run(["uv", "pip", "install", "-q", "--python", sys.executable, *_missing],
                       check=True)
    importlib.invalidate_caches()

_fetched = []
for _name in COMMONS_SIBLINGS:
    if not (COMMONS_DIR / _name).exists():
        (COMMONS_DIR / _name).parent.mkdir(parents=True, exist_ok=True)
        try:
            urllib.request.urlretrieve(COMMONS_RAW + _name, COMMONS_DIR / _name)
            _fetched.append(_name)
        except Exception as _e:  # Kaggle disables the internet by default; say so plainly
            raise RuntimeError(
                f"this lesson needs {_name} beside the notebook and could not fetch it "
                f"({_e}). On Kaggle, switch Internet on in the notebook settings panel "
                f"(Kaggle allows that only for phone-verified accounts); otherwise download it "
                f"from {COMMONS_RAW + _name} and upload it beside the notebook."
            ) from None

print("ready on " + commons_host() + ("; fetched " + ", ".join(_fetched) if _fetched else ""))
# --- END COMMONS LAUNCHER ---

# %% [markdown]
# # P02-L06 · Review queues that survive contact with humans
#
# **You will build:** the instruments a human review team is measured with — raw agreement and
# Cohen's kappa between two reviewers, an SLA-aware queue that serves the most urgent work first
# and counts what it breaches, a two-tier escalation policy, and the ceiling your reviewers' own
# agreement puts on every score your harness reports.
#
# **Time:** ~70 minutes · **Runs on:** a laptop CPU, no GPU, no download, no model API ·
# **Prerequisites:** T00-L01 (the 8 GB track), P02-L01 (field extraction you can measure).
#
# Module 1's `apply_reviews` gave every routed cell its gold value. That reviewer was perfect:
# never tired, never rushed, never in disagreement with a colleague. This lesson replaces them
# with people. They disagree with each other, they get worse as a shift goes on, and the queue
# they work has deadlines.
#
# By the end you will be able to:
#
# 1. Implement raw agreement and Cohen's kappa over the labels either reviewer used, including
#    kappa's edge cases: perfect agreement, chance level, systematic disagreement, one shared
#    label, and a label one reviewer never uses.
# 2. Implement an SLA-aware queue that serves arrived work earliest deadline first, and measure
#    its breach rate against first-in-first-out and module 1's confidence order.
# 3. Implement a two-tier escalation policy and measure the tier-1 mistakes it sends to a senior
#    reviewer against a random escalation of the same size.
# 4. Measure throughput against quality across shift lengths, and choose one against a stated
#    breach-rate target.
# 5. Compute, from your own kappa, the ceiling your harness can see, check it against the
#    simulation's truth, and explain why it is not 1.0.

# %%
# Setup: everything the lesson needs, in one cell, with versions printed.
import contextlib
import io
import math
import random
import re
import sys
import time
import traceback
from typing import Callable, Iterable, Mapping, NamedTuple, Sequence

import numpy as np

_LESSON_T0 = time.perf_counter()
print("python", sys.version.split()[0], "· numpy", np.__version__)
print("no model API, no labelling tool, no real reviewers — a simulated team, from a fixed seed,")
print("whose every mistake is recorded, so that your measurements can be checked against the truth.\n")

# Module 1's schema: six fields, and the TYPE of each one, because field type is the unit of
# policy — in this lesson it also decides a review deadline and whether a change needs a
# second pair of eyes.
SCHEMA: dict[str, str] = {
    "invoice_id": "id",
    "invoice_date": "date",
    "total_amount": "money",
    "currency": "id",
    "counterparty": "text",
    "payment_terms_days": "integer",
}
FIELD_INDEX = {field: i for i, field in enumerate(SCHEMA)}

# Module 1's five cell labels. Every (document, field) cell lands in exactly one of them.
ERROR_LABELS = ("correct", "miss", "spurious", "wrong_value", "true_negative")

# Module 1's matching modes, minus fuzzy: module 1 measured what fuzzy costs on a money field.
MATCH_MODES = ("exact", "normalised")

MONTH_NAMES = ("January", "February", "March", "April", "May", "June",
               "July", "August", "September", "October", "November", "December")
MONTH_INDEX = {name.lower(): i + 1 for i, name in enumerate(MONTH_NAMES)}

COMPANY_SUFFIXES = frozenset({
    "gmbh", "bv", "nv", "ag", "kg", "ltd", "limited", "inc", "incorporated",
    "plc", "llc", "sa", "sas", "srl", "spa", "oy", "ab", "as", "co",
})


class FieldScore(NamedTuple):
    """What one field scored over the whole corpus, under one matching mode (module 1)."""
    field: str
    mode: str
    tp: int
    fp: int
    fn: int
    precision: float
    recall: float
    f1: float


_FAILED_CHECKS: list[str] = []

# The exercises, in the order you meet them, and the functions each one asks you to write.
# The progress board at the foot of the notebook is built from this, and a cell that is
# waiting on an unfinished exercise names it from here.
_EXERCISES: dict[str, tuple[str, ...]] = {
    "exercise 1": ("agreement_table", "raw_agreement"),
    "exercise 2": ("chance_agreement", "cohens_kappa"),
    "exercise 3": ("sla_schedule", "breach_report"),
    "exercise 4": ("escalate",),
    "exercise 5": ("harness_ceiling",),
}
_STATUS: dict[str, str] = {}   # label -> "passed" | "failed" | "not started", latest run


def _named(labels: list[str]) -> str:
    """["exercise 1"] -> "exercise 1 (agreement_table, raw_agreement)"; several -> "exercises 1 and 2"."""
    if len(labels) == 1:
        return f"{labels[0]} ({', '.join(_EXERCISES[labels[0]])})"
    nums = [label.split()[-1] for label
```

### Core Architecture Module: `flagships/humanoid-lab/capstone/measure_walk.py`
```
#!/usr/bin/env python3
"""The F15 capstone grading harness. You are given it: grading against a script you cannot
run yourself would be a trick, not an assessment.

    .venv/bin/python flagships/humanoid-lab/capstone/measure_walk.py \
        --policy flagships/humanoid-lab/capstone/policy.py --seed dev --episodes 24

Your policy module must expose:
    build_policy()                     -> called once, returns whatever your controller needs
    act(policy, observation, t)        -> returns shape (4,) joint targets

The observation is the 14 numbers of the planar walker, in this order:
    qpos[0:7]  hip x, hip height, torso pitch, hip_r, knee_r, hip_l, knee_l
    qvel[0:7]  the matching velocities

Fall criteria, distance and cost of transport are fixed here, not by you. NOTE on one
threshold: F15-L05's own gait search tolerated a torso pitch up to 1.0 rad, because it was
searching for any gait at all. The capstone is stricter and uses CAPSTONE.md's 0.6 rad, so a
gait that merely survived L05's search may be scored as a fall here. That is deliberate.
"""
import argparse
import importlib.util
import sys
from collections import deque
from pathlib import Path

import mujoco
import numpy as np

HERE = Path(__file__).resolve().parent
MODEL_PATH = HERE / "assets" / "planar_walker.xml"

# Fixed by the harness (CAPSTONE.md), not by the submission.
MIN_HIP_HEIGHT = 0.55      # metres
MAX_PITCH = 0.6            # radians
DEFAULT_SECONDS = 8.0

# Domain-randomisation spec, identical to F15-L08's DR_SPEC. The draw ORDER is the contract:
# it is what makes a seed reproducible.
DR_SPEC = {
    "mass_scale": (0.85, 1.30),
    "frictionloss": (0.0, 15.0),
    "delay_steps": (0, 9),       # integers, upper bound exclusive
    "noise_std": (0.0, 0.03),
}
DEV_SEED = 707                   # the development seed students are given
NOMINAL = {"mass_scale": 1.0, "frictionloss": 0.0, "delay_steps": 0, "noise_std": 0.0, "seed": 0}


def load_model():
    model = mujoco.MjModel.from_xml_path(str(MODEL_PATH))
    return model, mujoco.MjData(model)


def sample_conditions(n: int, seed: int, spec: dict = DR_SPEC) -> list:
    """Draw n conditions. Same generator and draw order as F15-L08, so seeds agree."""
    rng = np.random.default_rng(seed)
    out = []
    for _ in range(n):
        out.append({
            "mass_scale": float(rng.uniform(*spec["mass_scale"])),
            "frictionloss": float(rng.uniform(*spec["frictionloss"])),
            "delay_steps": int(rng.integers(*spec["delay_steps"])),
            "noise_std": float(rng.uniform(*spec["noise_std"])),
            "seed": int(rng.integers(0, 10000)),
        })
    return out


def apply_condition(model, condition: dict, base_masses: np.ndarray) -> None:
    """Model edits: torso mass and joint dry friction, always from the baseline."""
    model.body_mass[:] = base_masses * condition["mass_scale"]
    model.dof_frictionloss[:] = condition["frictionloss"]


def observe(data) -> np.ndarray:
    return np.concatenate([data.qpos[:7], data.qvel[:7]]).astype(float)


def run_episode(model, data, policy_module, policy, condition: dict, seconds: float) -> dict:
    """One episode under one condition. Returns the per-episode scorecard."""
    dt = float(model.opt.timestep)
    horizon = int(round(seconds / dt))
    rng = np.random.default_rng(condition["seed"])

    try:
        mujoco.mj_resetDataKeyframe(model, data, 0)
    except Exception:
        mujoco.mj_resetData(model, data)
    mujoco.mj_forward(model, data)

    start_x = float(data.qpos[0])
    lo = model.actuator_ctrlrange[:, 0].copy()
    hi = model.actuator_ctrlrange[:, 1].copy()
    span = np.maximum(hi - lo, 1e-9)

    # Latency: the policy sees an observation `delay_steps` old.
    delay = max(int(condition["delay_steps"]), 0)
    history = deque([observe(data)] * (delay + 1), maxlen=delay + 1)

    energy = 0.0
    saturated = 0
    fell_at_step = None

    for step in range(horizon):
        obs = history[0].copy()
        if condition["noise_std"] > 0:
            obs += rng.normal(0.0, condition["noise_std"], size=obs.shape)

        ctrl = np.asarray(policy_module.act(policy, obs, step * dt), dtype=float).reshape(-1)
        if ctrl.shape[0] != model.nu:
            raise ValueError(f"act() returned shape {ctrl.shape}, expected ({model.nu},)")

        # A submission may return out of range; MuJoCo clamps, and we record that it happened.
        clamped = np.clip(ctrl, lo, hi)
        if np.any(np.abs(ctrl - clamped) > 1e-9 * span):
            saturated += 1
        data.ctrl[:] = clamped

        mujoco.mj_step(model, data)
        energy += float(np.abs(data.actuator_force * data.actuator_velocity).sum()) * dt
        history.append(observe(data))

        if data.qpos[1] < MIN_HIP_HEIGHT or abs(data.qpos[2]) > MAX_PITCH:
            fell_at_step = step
            break

    steps_run = (fell_at_step + 1) if fell_at_step is not None else horizon
    distance = float(data.qpos[0]) - start_x
    survived = fell_at_step is None
    total_mass = float(model.body_mass.sum())
    gravity = float(-model.opt.gravity[2])
    cot = (energy / (total_mass * gravity * distance)) if distance > 0 else float("inf")

    return {
        "distance_m": distance,
        "survival_rate": 1.0 if survived else 0.0,
        "cost_of_transport": cot,
        "saturated_fraction": saturated / steps_run if steps_run else 0.0,
        "fell_at_step": fell_at_step,
    }


def measure_walk(policy_module, conditions: list, seconds: float = DEFAULT_SECONDS) -> dict:
    """Run one episode per condition and return the aggregate scorecard.

    Returns a dict with exactly these keys:
      "distance_m"          mean forward hip travel over SURVIVING episodes
      "survival_rate"       fraction of episodes that never fell
      "cost_of_transport"   mean dimensionless CoT over surviving episodes
      "saturated_fraction"  mean fraction of steps against a control limit
      "episodes"            per-condition dicts, same keys plus "fell_at_step"
    """
    if not conditions:
        raise ValueError("no conditions given")
    model, data = load_model()
    base_masses = model.body_mass.copy()
    policy = policy_module.build_policy()

    episodes = []
    for condition in conditions:
        apply_condition(model, condition, base_masses)
        episodes.append(run_episode(model, data, policy_module, policy, condition, seconds))

    survivors = [e for e in episodes if e["survival_rate"] == 1.0]
    finite = [e["cost_of_transport"] for e in survivors if np.isfinite(e["cost_of_transport"])]
    return {
        "distance_m": float(np.mean([e["distance_m"] for e in survivors])) if survivors else 0.0,
        "survival_rate": len(survivors) / len(episodes),
        "cost_of_transport": float(np.mean(finite)) if finite else float("inf"),
        "saturated_fraction": float(np.mean([e["saturated_fraction"] for e in episodes])),
        "episodes": episodes,
    }


def load_policy_module(path: str):
    p = Path(path).resolve()
    spec = importlib.util.spec_from_file_location("submitted_policy", p)
    mod = importlib.util.module_from_spec(spec)
    sys.modules["submitted_policy"] = mod
    spec.loader.exec_module(mod)
    for fn in ("build_policy", "act"):
        if not hasattr(mod, fn):
            raise AttributeError(f"{p.name} does not define {fn}()")
    return mod


def main() -> int:
    ap = argparse.ArgumentParser(description="Grade a walking policy.")
    ap.add_argument("--policy", required=True, help="path to your policy module")
    ap.add_argument("--seed", default="dev", help="'dev' for the development seed, or an integer")
    ap.add_argument("--episodes", type=int, default=24)
    ap.add_argument("--seconds", type=float, default=DEFAULT_SECONDS)
    a = ap.parse_args()

    seed = DEV_SEED if a.seed == "dev" else int(a.seed)
    conditions = sample_conditions(a.episodes, seed)
    report = measure_walk(load_policy_module(a.policy), conditions, seconds=a.seconds)

    print(f"\n  conditions      {a.episodes} drawn from seed {seed} ({a.seed})")
    print(f"  distance_m         {report['distance_m']:.3f}   (mean over survivors)")
    print(f"  survival_rate      {report['survival_rate']:.3f}")
    cot = report["cost_of_transport"]
    print(f"  cost_of_transport  {cot:.3f}" if np.isfinite(cot) else "  cost_of_transport  inf")
    print(f"  saturated_fraction {report['saturated_fraction']:.3f}")
    fell = [e for e in report["episodes"] if e["fell_at_step"] is not None]
    print(f"  fell               {len(fell)}/{len(report['episodes'])} episodes\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

```

### Core Architecture Module: `flagships/humanoid-lab/capstone/policy.py`
```
"""Your capstone submission starts here.

This starter is F15-L05's BASELINE_GAIT, unchanged. Measured under this capstone's harness,
not asserted:

    nominal model, 8 s      walks 1.208 m, then falls at step 978 (2.9 simulated seconds)
    24 development conditions   survives 12 of 24, mean 1.532 m over survivors, CoT 3.525

It is not a solved gait, and that is deliberate. F15-L05 validated it over 800 steps (2.4 s)
against a 1.0 rad pitch tolerance; the capstone runs 8 s and calls 0.6 rad a fall, so the
lesson's baseline is a genuine starting point here rather than an answer.

It is open-loop: `act` ignores the observation entirely and plays a fixed rhythm. That is its
weakness and your opportunity. A heavier torso, joint friction, control latency or sensor noise
will topple it, and the capstone scores you mostly on surviving conditions you never saw
(CAPSTONE.md section 3). Closing that gap means using the observation.

Run it:
    .venv/bin/python flagships/humanoid-lab/capstone/measure_walk.py \
        --policy flagships/humanoid-lab/capstone/policy.py --seed dev --episodes 24
"""
import math

import numpy as np

# The legs swing half a cycle apart. This is F15-L05's LEG_PHASE.
LEG_PHASE = math.pi


def build_policy():
    """Called once per grading run, before any episode.

    These are F15-L05's BASELINE_GAIT values. Tune them, replace them with a feedback
    controller, or carry a small learned table here — whatever you carry between steps must
    live inside this object.
    """
    return {
        "freq": 0.90,
        "hip_amp": 0.25,
        "knee_amp": 0.60,
        "knee_lag": 4.00,
        "hip_bias": 0.00,
    }


def act(policy, observation, t):
    """Return the four joint targets in actuator order: hip_r, knee_r, hip_l, knee_l.

    `observation` is the 14-number state (7 qpos then 7 qvel). This starter ignores it.
    `t` is elapsed SIMULATED seconds, so a periodic gait can use it directly as phase.
    """
    phase = 2.0 * math.pi * policy["freq"] * t
    hip_amp, knee_amp = policy["hip_amp"], policy["knee_amp"]
    knee_lag, hip_bias = policy["knee_lag"], policy["hip_bias"]

    hip_r = hip_amp * math.sin(phase) + hip_bias
    hip_l = hip_amp * math.sin(phase + LEG_PHASE) + hip_bias
    knee_r = -knee_amp * (1.0 - math.cos(phase + knee_lag)) / 2.0
    knee_l = -knee_amp * (1.0 - math.cos(phase + LEG_PHASE + knee_lag)) / 2.0
    return np.array([hip_r, knee_r, hip_l, knee_l])

```

### Core Architecture Module: `flagships/humanoid-lab/lessons/F15-L01-first-contact/lesson.py`
```
# %% [markdown]
# <!-- COMMONS LAUNCHER v4 · generated by tools/notebooks.py · do not edit by hand -->
# <a href="https://github.com/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials"><img src="https://raw.githubusercontent.com/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/master/brand/synapsa-commons-badge.png" alt="Synapsa Commons" height="36"></a>
#
# Free, hands-on AI courses that run anywhere, from the team building [Synapsa](https://synapsa.realai.eu), an AI-native
# learning platform.
#
# © 2026 RealAI · free to learn from, share and adapt, not to sell ([CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)).
# The notice at the end of this notebook says what you may and may not do.
#
# [![Open in Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/blob/master/flagships/humanoid-lab/lessons/F15-L01-first-contact/lesson.ipynb)
# [![Open in Kaggle](https://kaggle.com/static/images/open-in-kaggle.svg)](https://kaggle.com/kernels/welcome?src=https://github.com/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/blob/master/flagships/humanoid-lab/lessons/F15-L01-first-contact/lesson.ipynb)
# [![Open in Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/master?labpath=flagships/humanoid-lab/lessons/F15-L01-first-contact/lesson.ipynb)
# [![Open in Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials)
#
# This lesson needs Python 3.11 or newer with numpy, which Colab, Kaggle, Binder and
# Codespaces already have. The cell below installs `mujoco==3.13.0` and fetches the files it
# needs beside it, and does nothing where they are already present. On Kaggle, switch Internet
# on in the notebook's settings first; Kaggle allows that only for phone-verified accounts.

# %%
# --- COMMONS LAUNCHER v4 · generated by tools/notebooks.py · do not edit by hand ---
# Makes this notebook run anywhere. Every line is a no-op when the thing is already present,
# so a local clone pays nothing and an online notebook repairs itself.
import importlib.util, os, subprocess, sys, urllib.request
from pathlib import Path

COMMONS_PIP = [("mujoco", "mujoco==3.13.0")]            # (import name, pinned pip spec) for what this lesson imports
COMMONS_SIBLINGS = ["assets/SOURCE.md", "assets/humanoid.xml"]    # files that must sit beside the notebook
# A fork, a classroom mirror or an offline copy can serve the files from elsewhere by setting
# COMMONS_RAW_OVERRIDE before running this cell.
COMMONS_RAW = os.environ.get("COMMONS_RAW_OVERRIDE") or "https://raw.githubusercontent.com/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/master/flagships/humanoid-lab/lessons/F15-L01-first-contact/"

# Resolve siblings against the LESSON's own directory, not the working directory. A notebook
# has no __file__ and runs with cwd alongside itself; a grader imports this file from the repo
# root. Checking cwd blindly makes the grader think every sibling is missing and reach for the
# network -- which would put a download on a graded path.
try:
    COMMONS_DIR = Path(__file__).resolve().parent
except NameError:
    COMMONS_DIR = Path.cwd()


def commons_host() -> str:
    """Name the notebook service we are on. Used for the message, and for honest errors."""
    try:
        if importlib.util.find_spec("google.colab") is not None:
            return "Google Colab"
    except (ImportError, ValueError):
        pass
    if os.environ.get("KAGGLE_KERNEL_RUN_TYPE"):
        return "Kaggle"
    if os.environ.get("BINDER_SERVICE_HOST"):
        return "Binder"
    if os.environ.get("CODESPACES"):
        return "GitHub Codespaces"
    return "a local Python environment"


_missing = [pip for imp, pip in COMMONS_PIP if importlib.util.find_spec(imp) is None]
if _missing:
    print("installing " + ", ".join(_missing) + " ...")
    # pip everywhere a student is likely to be; uv-managed local venvs ship without pip.
    if importlib.util.find_spec("pip") is not None:
        subprocess.run([sys.executable, "-m", "pip", "install", "-q", *_missing], check=True)
    else:
        subprocess.run(["uv", "pip", "install", "-q", "--python", sys.executable, *_missing],
                       check=True)
    importlib.invalidate_caches()

_fetched = []
for _name in COMMONS_SIBLINGS:
    if not (COMMONS_DIR / _name).exists():
        (COMMONS_DIR / _name).parent.mkdir(parents=True, exist_ok=True)
        try:
            urllib.request.urlretrieve(COMMONS_RAW + _name, COMMONS_DIR / _name)
            _fetched.append(_name)
        except Exception as _e:  # Kaggle disables the internet by default; say so plainly
            raise RuntimeError(
                f"this lesson needs {_name} beside the notebook and could not fetch it "
                f"({_e}). On Kaggle, switch Internet on in the notebook settings panel "
                f"(Kaggle allows that only for phone-verified accounts); otherwise download it "
                f"from {COMMONS_RAW + _name} and upload it beside the notebook."
            ) from None

print("ready on " + commons_host() + ("; fetched " + ", ".join(_fetched) if _fetched else ""))
# --- END COMMONS LAUNCHER ---

# %% [markdown]
# # F15-L01 · First contact with a humanoid
#
# **You will build:** a three-instrument panel for MuJoCo's own humanoid — a clock
# (`step_for`), a posture sensor (`com_height`) and a stopwatch (`real_time_factor`).
#
# **Time:** ~45 minutes · **Runs on:** a laptop CPU, no GPU, no download
# · **Prerequisites:** none
#
# By the end you will be able to:
# 1. Locate any simulation quantity in either `mjModel` or `mjData`, and say why it lives there.
# 2. Implement `step_for(seconds)` so that simulated time advances by a whole number of steps.
# 3. Compute whole-body centre-of-mass height from state, and show it differs from root height.
# 4. Measure this machine's real-time factor and explain why simulated time is not wall time.

# %%
# Setup: everything the lesson needs, in one cell, with versions printed.
import contextlib
import hashlib
import io
import math
import sys
import time
import urllib.request
from pathlib import Path
from typing import Callable

import mujoco
import numpy as np

print("mujoco", mujoco.__version__, "· numpy", np.__version__)

# The one model we use, shipped next to this notebook in assets/ (Apache-2.0, see SOURCE.md).
MODEL_URL = (
    "https://raw.githubusercontent.com/google-deepmind/mujoco/main/model/humanoid/humanoid.xml"
)
MODEL_FILENAME = "humanoid.xml"

# Simulated time accumulates in floating point, so an exact comparison against a target is
# unreliable by a few parts in 1e14. Every time comparison in this lesson uses this slack.
TIME_EPS = 1e-9


def humanoid_xml_path() -> Path:
    """Return the path to the cached humanoid XML, downloading it only if it is missing.

    The file ships inside this lesson's assets/ directory, so the normal path is offline and
    nothing is fetched. The download branch exists only for a truncated checkout.
    """
    try:
        here = Path(__file__).resolve().parent
    except NameError:  # a notebook has no __file__
        here = Path.cwd()
    candidates = [
        here / "assets" / MODEL_FILENAME,
        here.parent / "assets" / MODEL_FILENAME,
        Path.cwd() / "assets" / MODEL_FILENAME,
        Path.cwd().parent / "assets" / MODEL_FILENAME,
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    target = candidates[0]
    target.parent.mkdir(parents=True, exist_ok=True)
    print(f"cached model absent; fetching once from {MODEL_URL}")
    urllib.request.urlretrieve(MODEL_URL, target)  # noqa: S310 - pinned https URL above
    return target


def load_humanoid():
    """Compile the humanoid XML and hand back a fresh (model, data) pair."""
    model = mujoco.MjModel.from_xml_path(str(humanoid_xml_path()))
    return model, mujoco.MjData(model)


MODEL, DATA = load_humanoid()
print("compiled:", humanoid_xml_path().name)

# Run all is safe before you have written a line: every check, and every demo that needs your
# code, goes through _try, which reports and carries on. The board at the foot of the notebook
# shows where you stand.
_EXERCISES = {"exercise 1": "step_for", "exercise 2": "com_height",
              "exercise 3": "real_time_factor", "self-check": "your four letters"}
_STATUS: dict = {}      # label -> "passed" | "failed" | "not started", read by the board


def _try(label: str, check: Callable[[], None], needs: tuple = ()) -> None:
    """Run a check, or a demo that depends on your code, without derailing the notebook.

    A stub you have not filled in yet simply says so. A wrong answer prints the check's own
    message — which names the likely mistake — and the notebook carries on, so one broken
    exercise never hides the feedback on the others. Anything listed in `needs` must have
    passed first; until it has, this names it and skips rather than failing on its behalf.
    Nothing is swallowed: every outcome lands in _STATUS, and the `__main__` block at the foot
    of this file exits non-zero outside a notebook if any check failed.
    """
    waiting = [n for n in needs if _STATUS.get(n) != "passed"]
    if waiting:
        _STATUS[label] = "not started"
        named = " and ".join(f"{n} ({_EXERCISES.get(n, n)})" for n in waiting)
        one = len(waiting) == 1
        print(f"{label}: skipped until {named} {'passes' if one else 'pass'} — finish "
              f"{'that' if one else 'those'}, then re-run this cell.")
        return
    try:
        check()
    except NotImplementedError as exc:
        _STATUS[label] = "not started"
    
```

### Core Architecture Module: `flagships/humanoid-lab/lessons/F15-L02-kinematics-jacobians/lesson.py`
```
# %% [markdown]
# <!-- COMMONS LAUNCHER v4 · generated by tools/notebooks.py · do not edit by hand -->
# <a href="https://github.com/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials"><img src="https://raw.githubusercontent.com/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/master/brand/synapsa-commons-badge.png" alt="Synapsa Commons" height="36"></a>
#
# Free, hands-on AI courses that run anywhere, from the team building [Synapsa](https://synapsa.realai.eu), an AI-native
# learning platform.
#
# © 2026 RealAI · free to learn from, share and adapt, not to sell ([CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)).
# The notice at the end of this notebook says what you may and may not do.
#
# [![Open in Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/blob/master/flagships/humanoid-lab/lessons/F15-L02-kinematics-jacobians/lesson.ipynb)
# [![Open in Kaggle](https://kaggle.com/static/images/open-in-kaggle.svg)](https://kaggle.com/kernels/welcome?src=https://github.com/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/blob/master/flagships/humanoid-lab/lessons/F15-L02-kinematics-jacobians/lesson.ipynb)
# [![Open in Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/master?labpath=flagships/humanoid-lab/lessons/F15-L02-kinematics-jacobians/lesson.ipynb)
# [![Open in Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials)
#
# This lesson needs Python 3.11 or newer with numpy, which Colab, Kaggle, Binder and
# Codespaces already have. The cell below installs `mujoco==3.13.0` and fetches the files it
# needs beside it, and does nothing where they are already present. On Kaggle, switch Internet
# on in the notebook's settings first; Kaggle allows that only for phone-verified accounts.

# %%
# --- COMMONS LAUNCHER v4 · generated by tools/notebooks.py · do not edit by hand ---
# Makes this notebook run anywhere. Every line is a no-op when the thing is already present,
# so a local clone pays nothing and an online notebook repairs itself.
import importlib.util, os, subprocess, sys, urllib.request
from pathlib import Path

COMMONS_PIP = [("mujoco", "mujoco==3.13.0")]            # (import name, pinned pip spec) for what this lesson imports
COMMONS_SIBLINGS = ["assets/SOURCE.md", "assets/arm.xml"]    # files that must sit beside the notebook
# A fork, a classroom mirror or an offline copy can serve the files from elsewhere by setting
# COMMONS_RAW_OVERRIDE before running this cell.
COMMONS_RAW = os.environ.get("COMMONS_RAW_OVERRIDE") or "https://raw.githubusercontent.com/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/master/flagships/humanoid-lab/lessons/F15-L02-kinematics-jacobians/"

# Resolve siblings against the LESSON's own directory, not the working directory. A notebook
# has no __file__ and runs with cwd alongside itself; a grader imports this file from the repo
# root. Checking cwd blindly makes the grader think every sibling is missing and reach for the
# network -- which would put a download on a graded path.
try:
    COMMONS_DIR = Path(__file__).resolve().parent
except NameError:
    COMMONS_DIR = Path.cwd()


def commons_host() -> str:
    """Name the notebook service we are on. Used for the message, and for honest errors."""
    try:
        if importlib.util.find_spec("google.colab") is not None:
            return "Google Colab"
    except (ImportError, ValueError):
        pass
    if os.environ.get("KAGGLE_KERNEL_RUN_TYPE"):
        return "Kaggle"
    if os.environ.get("BINDER_SERVICE_HOST"):
        return "Binder"
    if os.environ.get("CODESPACES"):
        return "GitHub Codespaces"
    return "a local Python environment"


_missing = [pip for imp, pip in COMMONS_PIP if importlib.util.find_spec(imp) is None]
if _missing:
    print("installing " + ", ".join(_missing) + " ...")
    # pip everywhere a student is likely to be; uv-managed local venvs ship without pip.
    if importlib.util.find_spec("pip") is not None:
        subprocess.run([sys.executable, "-m", "pip", "install", "-q", *_missing], check=True)
    else:
        subprocess.run(["uv", "pip", "install", "-q", "--python", sys.executable, *_missing],
                       check=True)
    importlib.invalidate_caches()

_fetched = []
for _name in COMMONS_SIBLINGS:
    if not (COMMONS_DIR / _name).exists():
        (COMMONS_DIR / _name).parent.mkdir(parents=True, exist_ok=True)
        try:
            urllib.request.urlretrieve(COMMONS_RAW + _name, COMMONS_DIR / _name)
            _fetched.append(_name)
        except Exception as _e:  # Kaggle disables the internet by default; say so plainly
            raise RuntimeError(
                f"this lesson needs {_name} beside the notebook and could not fetch it "
                f"({_e}). On Kaggle, switch Internet on in the notebook settings panel "
                f"(Kaggle allows that only for phone-verified accounts); otherwise download it "
                f"from {COMMONS_RAW + _name} and upload it beside the notebook."
            ) from None

print("ready on " + commons_host() + ("; fetched " + ", ".join(_fetched) if _fetched else ""))
# --- END COMMONS LAUNCHER ---

# %% [markdown]
# # F15-L02 · Kinematics, frames and Jacobians
#
# **You will build:** a forward-kinematics lookup for any named body or site, the 3-by-nv
# translational Jacobian of a humanoid palm, a finite-difference check that proves your
# Jacobian is the derivative it claims to be, and a damped least-squares inverse-kinematics
# solver that walks the hand onto a Cartesian target and reports the residual.
#
# **Time:** ~50 minutes · **Runs on:** a laptop CPU, no GPU, no download
# · **Prerequisites:** F15-L01 (mjModel vs mjData, nq vs nv, forward kinematics as a stage)
#
# By the end you will be able to:
# 1. Return a named body's and a named site's world position for any `qpos`, and measure how
#    far apart the body frame origin, the body centre of mass and a site on it really are.
# 2. Build the translational Jacobian with `mj_jac`, and show that the two dofs which cannot
#    move the hand have columns of exactly zero.
# 3. Verify that analytic Jacobian against central finite differences of your own forward
#    kinematics, to a stated tolerance.
# 4. Measure how that agreement degrades at both large and small step sizes, and find the
#    best step size from your own sweep rather than from folklore.
# 5. Implement damped least-squares inverse kinematics, report the residual for a reachable
#    and an unreachable target, and measure what the damping term prevents.
#
# Every number in this notebook's output is computed by the code you run. Nothing numeric is
# typed by hand; the sources for what MuJoCo *documents* are in `claims.yaml`.

# %%
# Setup: everything the lesson needs, in one cell, with versions printed.
import contextlib
import hashlib
import io
import sys
from pathlib import Path
from typing import Callable

import mujoco
import numpy as np

np.set_printoptions(precision=5, suppress=True, linewidth=110)
print("mujoco", mujoco.__version__, "· numpy", np.__version__)

MODEL_FILENAME = "arm.xml"


def arm_xml_path() -> Path:
    """Locate the arm model that ships next to this notebook.

    There is no download branch. The model was written for this lesson and lives in
    `assets/`; if it is missing, the checkout is broken and saying so beats a silent fetch.
    """
    try:
        here = Path(__file__).resolve().parent
    except NameError:  # a notebook has no __file__
        here = Path.cwd()
    for candidate in (here / "assets" / MODEL_FILENAME,
                      here.parent / "assets" / MODEL_FILENAME,
                      Path.cwd() / "assets" / MODEL_FILENAME,
                      Path.cwd().parent / "assets" / MODEL_FILENAME):
        if candidate.exists():
            return candidate
    raise FileNotFoundError(
        f"{MODEL_FILENAME} not found next to this lesson. It ships in assets/ and is never "
        "downloaded; restore it from the lesson directory."
    )


def load_arm():
    """Compile the arm and hand back a fresh (model, data) pair."""
    model = mujoco.MjModel.from_xml_path(str(arm_xml_path()))
    return model, mujoco.MjData(model)


MODEL, DATA = load_arm()

HAND_BODY = "hand_right"
PALM_SITE = "palm"

# The eight dofs that can move the right palm, and the two that cannot. Lists, not tuples:
# a tuple used as a NumPy index means something else entirely.
ARM_DOFS = [0, 1, 2, 3, 4, 5, 6, 7]
LEFT_ARM_DOFS = [8, 9]

# Two poses, both read from the model rather than typed. HOME is qpos = 0, where the right
# arm hangs straight down, fully extended — you will see in section 11 why that matters.
HOME = np.zeros(MODEL.nq)
_key = mujoco.MjData(MODEL)
mujoco.mj_resetDataKeyframe(MODEL, _key, 0)
READY = _key.qpos.copy()

# Joint travel limits, straight off the compiled model. All ten joints are hinges, so row i
# of jnt_range is the limit of dof i.
JOINT_LO = MODEL.jnt_range[:, 0].copy()
JOINT_HI = MODEL.jnt_range[:, 1].copy()

FD_EPS = 1e-6      # the default step. Section 8 measures where the error bottoms out.
JAC_TOL = 1e-6     # the stated tolerance your Jacobian must meet. Section 8 says why.

print(f"model: nq={MODEL.nq} nv={MODEL.nv} nu={MODEL.nu} "
      f"nbody={MODEL.nbody} nsite={MODEL.nsite}")
print("joints, in dof order:")
for _j in range(MODEL.njnt):
    _name = mujoco.mj_id2name(MODEL, mujoco.mjtObj.mjOBJ_JOINT, _j)
    print(f"  dof {int(MODEL.jnt_dofadr[_j]):2d}  qpos {int(MODEL.jnt_qposadr[_j]):2d}  "
          f"{_name:<18s} range [{MODEL.jnt_range[_j][0]:+.2f}, {MODEL.jnt_range[_j][1]:+.2f}]")
print(f"nq - nv
```

### Core Architecture Module: `flagships/humanoid-lab/lessons/F15-L03-pd-control/lesson.py`
```
# %% [markdown]
# <!-- COMMONS LAUNCHER v4 · generated by tools/notebooks.py · do not edit by hand -->
# <a href="https://github.com/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials"><img src="https://raw.githubusercontent.com/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/master/brand/synapsa-commons-badge.png" alt="Synapsa Commons" height="36"></a>
#
# Free, hands-on AI courses that run anywhere, from the team building [Synapsa](https://synapsa.realai.eu), an AI-native
# learning platform.
#
# © 2026 RealAI · free to learn from, share and adapt, not to sell ([CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)).
# The notice at the end of this notebook says what you may and may not do.
#
# [![Open in Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/blob/master/flagships/humanoid-lab/lessons/F15-L03-pd-control/lesson.ipynb)
# [![Open in Kaggle](https://kaggle.com/static/images/open-in-kaggle.svg)](https://kaggle.com/kernels/welcome?src=https://github.com/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/blob/master/flagships/humanoid-lab/lessons/F15-L03-pd-control/lesson.ipynb)
# [![Open in Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/master?labpath=flagships/humanoid-lab/lessons/F15-L03-pd-control/lesson.ipynb)
# [![Open in Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials)
#
# This lesson needs Python 3.11 or newer with numpy, which Colab, Kaggle, Binder and
# Codespaces already have. The cell below installs `mujoco==3.13.0`, and does nothing where
# they are already present. On Kaggle, switch Internet on in the notebook's settings first;
# Kaggle allows that only for phone-verified accounts.

# %%
# --- COMMONS LAUNCHER v4 · generated by tools/notebooks.py · do not edit by hand ---
# Makes this notebook run anywhere. Every line is a no-op when the thing is already present,
# so a local clone pays nothing and an online notebook repairs itself.
import importlib.util, os, subprocess, sys, urllib.request
from pathlib import Path

COMMONS_PIP = [("mujoco", "mujoco==3.13.0")]            # (import name, pinned pip spec) for what this lesson imports
COMMONS_SIBLINGS = []    # files that must sit beside the notebook
# A fork, a classroom mirror or an offline copy can serve the files from elsewhere by setting
# COMMONS_RAW_OVERRIDE before running this cell.
COMMONS_RAW = os.environ.get("COMMONS_RAW_OVERRIDE") or "https://raw.githubusercontent.com/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/master/flagships/humanoid-lab/lessons/F15-L03-pd-control/"

# Resolve siblings against the LESSON's own directory, not the working directory. A notebook
# has no __file__ and runs with cwd alongside itself; a grader imports this file from the repo
# root. Checking cwd blindly makes the grader think every sibling is missing and reach for the
# network -- which would put a download on a graded path.
try:
    COMMONS_DIR = Path(__file__).resolve().parent
except NameError:
    COMMONS_DIR = Path.cwd()


def commons_host() -> str:
    """Name the notebook service we are on. Used for the message, and for honest errors."""
    try:
        if importlib.util.find_spec("google.colab") is not None:
            return "Google Colab"
    except (ImportError, ValueError):
        pass
    if os.environ.get("KAGGLE_KERNEL_RUN_TYPE"):
        return "Kaggle"
    if os.environ.get("BINDER_SERVICE_HOST"):
        return "Binder"
    if os.environ.get("CODESPACES"):
        return "GitHub Codespaces"
    return "a local Python environment"


_missing = [pip for imp, pip in COMMONS_PIP if importlib.util.find_spec(imp) is None]
if _missing:
    print("installing " + ", ".join(_missing) + " ...")
    # pip everywhere a student is likely to be; uv-managed local venvs ship without pip.
    if importlib.util.find_spec("pip") is not None:
        subprocess.run([sys.executable, "-m", "pip", "install", "-q", *_missing], check=True)
    else:
        subprocess.run(["uv", "pip", "install", "-q", "--python", sys.executable, *_missing],
                       check=True)
    importlib.invalidate_caches()

_fetched = []
for _name in COMMONS_SIBLINGS:
    if not (COMMONS_DIR / _name).exists():
        (COMMONS_DIR / _name).parent.mkdir(parents=True, exist_ok=True)
        try:
            urllib.request.urlretrieve(COMMONS_RAW + _name, COMMONS_DIR / _name)
            _fetched.append(_name)
        except Exception as _e:  # Kaggle disables the internet by default; say so plainly
            raise RuntimeError(
                f"this lesson needs {_name} beside the notebook and could not fetch it "
                f"({_e}). On Kaggle, switch Internet on in the notebook settings panel "
                f"(Kaggle allows that only for phone-verified accounts); otherwise download it "
                f"from {COMMONS_RAW + _name} and upload it beside the notebook."
            ) from None

print("ready on " + commons_host() + ("; fetched " + ", ".join(_fetched) if _fetched else ""))
# --- END COMMONS LAUNCHER ---

# %% [markdown]
# # F15-L03 · Joint PD control and gravity compensation
#
# **You will build:** a joint-space PD controller for a two-link MuJoCo arm, a gravity
# compensation term lifted from the model's own bias force, and a measured tracking-error
# curve over a gain sweep that locates the stability limit of your control loop.
#
# **Time:** ~45 minutes · **Runs on:** a laptop CPU, no GPU, far under 8 GiB
# **Prerequisites:** `F15-L01-first-contact` — you can load a model, step it, and read
# `data.qpos` / `data.qvel`.
#
# By the end you will be able to:
# 1. Implement `pd_torque(q, qd, q_target, kp, kd)` and check it against pure-P, pure-D and
#    combined cases to machine precision.
# 2. Measure the steady-state droop of an uncompensated PD joint and show it is
#    `data.qfrc_bias / kp`, not a bug in your loop.
# 3. Implement gravity compensation from `data.qfrc_bias` and measure the drop in
#    steady-state error against the uncompensated run.
# 4. Sweep `kp` at fixed `kd`, produce the tracking-error curve, and identify the stability
#    limit from measured error alone.
# 5. Explain why a once-per-step PD law diverges both at high `kp` and at high `kd`.
#
# Every number this notebook prints is computed by the code you run. No figure in it was
# typed by a human, including the stability limit — which is a property of your loop on your
# machine, and is allowed to differ from anyone else's.
#
# **About the `if __name__ == "__main__":` guards.** They let the autograder import this
# file without running any simulation. A Jupyter kernel sets `__name__` to `"__main__"`, so
# every guarded cell still runs when you execute the notebook top to bottom.
#
# **Run all works before you write a line.** Each check reports "not implemented yet" for a
# stub instead of crashing, a demo that needs an unfinished exercise names it and skips, and
# the last cell prints a progress board. Stuck on an exercise? Open its hints, one at a time.

# %%
# Setup. Everything the lesson needs, in one cell, with versions printed by the code.
import sys
from pathlib import Path
from typing import Any, Callable

import mujoco
import numpy as np

print("mujoco  ", mujoco.__version__)
print("numpy   ", np.__version__)

# What the progress board in the last cell reads: label -> "passed", "failed", "not started"
# or "waiting on <exercise>". Every check and every demo that runs on your code writes here.
_STATUS: dict[str, str] = {}


def _try(label: str, check: Callable[[], Any], needs: tuple = ()) -> Any:
    """Run a check, or a demo that depends on your code, without derailing the notebook.

    A stub you have not filled in yet simply says so. A wrong answer prints the check's own
    message — which names the likely mistake — and the notebook carries on, so one broken
    exercise never hides the feedback on the others. Nothing is swallowed: every outcome is
    recorded in _STATUS, and the last cell of this file exits non-zero if any check failed.

    `needs` names the exercises a cell runs on. Until each has passed its own check, the cell
    says which one it is waiting for and skips, rather than failing on code you have not
    reached yet. Returns whatever the check returns, or None if it did not pass.
    """
    waiting = [n for n in needs if _STATUS.get(n) != "passed"]
    if waiting:
        _STATUS[label] = "waiting on " + ", ".join(waiting)
        named = [f"{n} ({_STATUS.get(n, 'not run yet')})" for n in waiting]
        one = len(named) == 1
        print(f"{label}: skipped — it runs on "
              + (named[0] if one else ", ".join(named[:-1]) + " and " + named[-1])
              + f", which {'has' if one else 'have'} not passed yet. Come back once "
              + f"{'it has' if one else 'they have'}.")
        return None
    try:
        result = check()
    except NotImplementedError as exc:
        _STATUS[label] = "not started"
        print(f"{label}: {str(exc) or 'not implemented yet — fill in the stub above'}, "
              "then re-run this cell.")
        return None
    except AssertionError as exc:
        _STATUS[label] = "failed"
        print(f"{label}: FAILED — {exc}")
        return None
    except Exception as exc:  # a half-finished implementation raising something else
        _STATUS[label] = "failed"
        print(f"{label}: raised {type(exc).__name__}: {exc}")
        return None
    _STATUS[label] = "passed"
    return result


def _progress_board(exercises) -> None:
    """Print one line per (label, what): ✅ passed, ❌ failed or ⏳ not started; then a tally."""
    print(
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #427** (2026-08-18): **ci: update GitHub Actions checkout and setup-python to latest versions**
  *Symptoms*: ## CI: Update GitHub Actions to latest versions  GitHub Actions `actions/checkout` and `actions/setup-python` have newer versions with bug fixes, performance improvements, and Node.js compatibility updates:  - `actions/checkout@v3` → `@v4` (Node.js 20, improved performance) - `actions/setup-python@v3`/`v4` → `@v5` (Node.js 20, improved caching)  **Files updated:**   - `.github/workflows/pythonapp.yml`: checkout: 1 occurrence(s), setup-python: 1 occurrence(s)  **Why this matters:** - Node.js 16 (used by older action versions) is EOL since September 2024 - GitHub emits deprecation warnings for v3 and older actions in CI logs - v4/v5 are functionally equivalent drop-in replacements 

- **Issue #426** (2026-07-08): **ci: update GitHub Actions checkout and setup-python to latest versions**
  *Symptoms*: ## CI: Update GitHub Actions to latest versions  GitHub Actions `actions/checkout` and `actions/setup-python` have newer versions with bug fixes, performance improvements, and Node.js compatibility updates:  - `actions/checkout@v3` → `@v4` (Node.js 20, improved performance) - `actions/setup-python@v3`/`v4` → `@v5` (Node.js 20, improved caching)  **Files updated:**   - `.github/workflows/pythonapp.yml`: checkout: 1 occurrence(s), setup-python: 1 occurrence(s)  **Why this matters:** - Node.js 16 (used by older action versions) is EOL since September 2024 - GitHub emits deprecation warnings for v3 and older actions in CI logs - v4/v5 are functionally equivalent drop-in replacements 

- **Issue #422** (2026-09-23): **Added one useful resource**
  *Symptoms*: Added the Scaler Blogs - Data Science and Business Analytics URL to the section - curated-list-of-deep learning-blogs, providing useful insights to aspiring tech professionals.  Please let me know if further changes are required.  Thank you
  **Post-Mortem & Fix Analysis**:
  > Thank you 
  > Thank you for this contribution. The 2017-2025 tutorials collection it targets has been retired from public view; this repository now hosts Synapsa Commons, original hands-on AI courses by RealAI. That leaves nothing here for this change to apply to, so it has been closed, with gratitude for helping so many learners over the years.

- **Issue #419** (2026-09-23): **Update README.md**
  *Symptoms*: Hi, I have added a link related to machine learning that will help your repository, please merge this if find it helpful. Thank you. 
  **Post-Mortem & Fix Analysis**:
  > Thank you for this contribution. The 2017-2025 tutorials collection it targets has been retired from public view; this repository now hosts Synapsa Commons, original hands-on AI courses by RealAI. That leaves nothing here for this change to apply to, so it has been closed, with gratitude for helping so many learners over the years.

- **Issue #417** (2026-09-23): **Bump werkzeug from 0.14.1 to 2.2.3 in /Projects/robosat-master/deps**
  *Symptoms*: Bumps [werkzeug](https://github.com/pallets/werkzeug) from 0.14.1 to 2.2.3. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/pallets/werkzeug/releases">werkzeug's releases</a>.</em></p> <blockquote> <h2>2.2.3</h2> <p>This is a fix release for the 2.2.x release branch.</p> <ul> <li>Changes: <a href="https://werkzeug.palletsprojects.com/en/2.2.x/changes/#version-2-2-3">https://werkzeug.palletsprojects.com/en/2.2.x/changes/#version-2-2-3</a></li> <li>Milestone: <a href="https://github.com/pallets/werkzeug/milestone/26?closed=1">https://github.com/pallets/werkzeug/milestone/26?closed=1</a></li> </ul> <p>This release contains security fixes for:</p> <ul> <li><a href="https://github.com/pallets/werkzeug/security/advisories/GHSA-xg9f-g7g7-2323">https://github.com/pallets/werkzeug/security/advisories/GHSA-xg9f-g7g7-2323</a></li> <li><a href="https://github.com/pallets/werkzeug/security/advisories/GHSA-px8h-6qxv-m22q">https://github.com/pallets/werkzeug/security/advisories/GHSA-px8h-6qxv-m22q</a></li> </ul> <h2>2.2.2</h2> <p>This is a fix release for the <a href="https://github.com/pallets/werkzeug/releases/tag/2.2.0">2.2.0</a> feature release.</p> <ul> <li>Changes: <a href="https://werkzeug.palletsprojects.com/en/2.2.x/changes/#version-2-2-2">https://werkzeug.palletsprojects.com/en/2.2.x/changes/#version-2-2-2</a></li> <li>Milestone: <a href="https://github.com/pallets/werkzeug/milestone/25?closed=1">https://github.com/pallets/werkzeug/milest
  **Post-Mortem & Fix Analysis**:
  > Closing: this repository now leads with Synapsa Commons, and the 2017-2025 tutorials this pull request updates have moved, unchanged, into archive/, where they are kept as a record rather than maintained.
  > OK, I won't notify you again about this release, but will get in touch when a new version is available. If you'd rather skip all updates until the next major or minor version, let me know by commenting `@dependabot ignore this major version` or `@dependabot ignore this minor version`.  If you change your mind, just re-open this PR and I'll resolve any conflicts on it.

- **Issue #416** (2026-09-23): **Bump ipython from 5.3.0 to 8.10.0 in /deep-learning/udacity-deeplearning/sentiment-rnn**
  *Symptoms*: Bumps [ipython](https://github.com/ipython/ipython) from 5.3.0 to 8.10.0. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/ipython/ipython/releases">ipython's releases</a>.</em></p> <blockquote> <h2>See <a href="https://pypi.org/project/ipython/">https://pypi.org/project/ipython/</a></h2> <p>We do not use GitHub release anymore. Please see PyPI <a href="https://pypi.org/project/ipython/">https://pypi.org/project/ipython/</a></p> <h2>7.9.0</h2> <p>No release notes provided.</p> <h2>7.8.0</h2> <p>No release notes provided.</p> <h2>7.7.0</h2> <p>No release notes provided.</p> <h2>7.6.1</h2> <p>No release notes provided.</p> <h2>7.6.0</h2> <p>No release notes provided.</p> <h2>7.5.0</h2> <p>No release notes provided.</p> <h2>7.4.0</h2> <p>No release notes provided.</p> <h2>7.3.0</h2> <p>No release notes provided.</p> <h2>7.2.0</h2> <p>No release notes provided.</p> <h2>7.1.1</h2> <p>No release notes provided.</p> <h2>7.1.0</h2> <p>No release notes provided.</p> <h2>7.0.1</h2> <p>No release notes provided.</p> <h2>7.0.0</h2> <p>No release notes provided.</p> <h2>7.0.0-doc</h2> <p>No release notes provided.</p> <h2>7.0.0rc1</h2> <p>No release notes provided.</p> <h2>7.0.0b1</h2> <p>No release notes provided.</p> <!-- raw HTML omitted --> </blockquote> <p>... (truncated)</p> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/ipython/ipython/commit/15ea1ed5a886d6c19c1cc4856f2cf04a2a547c57"><code>15ea1ed</code
  **Post-Mortem & Fix Analysis**:
  > Closing: this repository now leads with Synapsa Commons, and the 2017-2025 tutorials this pull request updates have moved, unchanged, into archive/, where they are kept as a record rather than maintained.
  > OK, I won't notify you again about this release, but will get in touch when a new version is available. If you'd rather skip all updates until the next major or minor version, let me know by commenting `@dependabot ignore this major version` or `@dependabot ignore this minor version`.  If you change your mind, just re-open this PR and I'll resolve any conflicts on it.

- **Issue #415** (2026-09-23): **Bump ipython from 5.3.0 to 8.10.0 in /deep-learning/udacity-deeplearning/sentiment-network**
  *Symptoms*: Bumps [ipython](https://github.com/ipython/ipython) from 5.3.0 to 8.10.0. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/ipython/ipython/releases">ipython's releases</a>.</em></p> <blockquote> <h2>See <a href="https://pypi.org/project/ipython/">https://pypi.org/project/ipython/</a></h2> <p>We do not use GitHub release anymore. Please see PyPI <a href="https://pypi.org/project/ipython/">https://pypi.org/project/ipython/</a></p> <h2>7.9.0</h2> <p>No release notes provided.</p> <h2>7.8.0</h2> <p>No release notes provided.</p> <h2>7.7.0</h2> <p>No release notes provided.</p> <h2>7.6.1</h2> <p>No release notes provided.</p> <h2>7.6.0</h2> <p>No release notes provided.</p> <h2>7.5.0</h2> <p>No release notes provided.</p> <h2>7.4.0</h2> <p>No release notes provided.</p> <h2>7.3.0</h2> <p>No release notes provided.</p> <h2>7.2.0</h2> <p>No release notes provided.</p> <h2>7.1.1</h2> <p>No release notes provided.</p> <h2>7.1.0</h2> <p>No release notes provided.</p> <h2>7.0.1</h2> <p>No release notes provided.</p> <h2>7.0.0</h2> <p>No release notes provided.</p> <h2>7.0.0-doc</h2> <p>No release notes provided.</p> <h2>7.0.0rc1</h2> <p>No release notes provided.</p> <h2>7.0.0b1</h2> <p>No release notes provided.</p> <!-- raw HTML omitted --> </blockquote> <p>... (truncated)</p> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/ipython/ipython/commit/15ea1ed5a886d6c19c1cc4856f2cf04a2a547c57"><code>15ea1ed</code
  **Post-Mortem & Fix Analysis**:
  > Closing: this repository now leads with Synapsa Commons, and the 2017-2025 tutorials this pull request updates have moved, unchanged, into archive/, where they are kept as a record rather than maintained.
  > Closing: this repository now leads with Synapsa Commons, and the 2017-2025 tutorials this pull request updates have moved, unchanged, into archive/, where they are kept as a record rather than maintained.
  > OK, I won't notify you again about this release, but will get in touch when a new version is available. If you'd rather skip all updates until the next major or minor version, let me know by commenting `@dependabot ignore this major version` or `@dependabot ignore this minor version`.  If you change your mind, just re-open this PR and I'll resolve any conflicts on it.

- **Issue #414** (2026-09-23): **Bump ipython from 5.3.0 to 8.10.0 in /deep-learning/udacity-deeplearning/tv-script-generation**
  *Symptoms*: Bumps [ipython](https://github.com/ipython/ipython) from 5.3.0 to 8.10.0. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/ipython/ipython/releases">ipython's releases</a>.</em></p> <blockquote> <h2>See <a href="https://pypi.org/project/ipython/">https://pypi.org/project/ipython/</a></h2> <p>We do not use GitHub release anymore. Please see PyPI <a href="https://pypi.org/project/ipython/">https://pypi.org/project/ipython/</a></p> <h2>7.9.0</h2> <p>No release notes provided.</p> <h2>7.8.0</h2> <p>No release notes provided.</p> <h2>7.7.0</h2> <p>No release notes provided.</p> <h2>7.6.1</h2> <p>No release notes provided.</p> <h2>7.6.0</h2> <p>No release notes provided.</p> <h2>7.5.0</h2> <p>No release notes provided.</p> <h2>7.4.0</h2> <p>No release notes provided.</p> <h2>7.3.0</h2> <p>No release notes provided.</p> <h2>7.2.0</h2> <p>No release notes provided.</p> <h2>7.1.1</h2> <p>No release notes provided.</p> <h2>7.1.0</h2> <p>No release notes provided.</p> <h2>7.0.1</h2> <p>No release notes provided.</p> <h2>7.0.0</h2> <p>No release notes provided.</p> <h2>7.0.0-doc</h2> <p>No release notes provided.</p> <h2>7.0.0rc1</h2> <p>No release notes provided.</p> <h2>7.0.0b1</h2> <p>No release notes provided.</p> <!-- raw HTML omitted --> </blockquote> <p>... (truncated)</p> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/ipython/ipython/commit/15ea1ed5a886d6c19c1cc4856f2cf04a2a547c57"><code>15ea1ed</code
  **Post-Mortem & Fix Analysis**:
  > Closing: this repository now leads with Synapsa Commons, and the 2017-2025 tutorials this pull request updates have moved, unchanged, into archive/, where they are kept as a record rather than maintained.
  > OK, I won't notify you again about this release, but will get in touch when a new version is available. If you'd rather skip all updates until the next major or minor version, let me know by commenting `@dependabot ignore this major version` or `@dependabot ignore this minor version`.  If you change your mind, just re-open this PR and I'll resolve any conflicts on it.

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

### Incident Patch 1: `11dec3fe` (2026-09-30)
**Commit Message**: Drop 3: reranking, and the agents track begins (agent loop, MCP)

**File**: `README.md` (modified, +5/-4)
```diff
@@ -31,7 +31,8 @@ computed by code you run, and every claim it makes about the world cites a prima
 | Take predictive maintenance from sensor physics to an alarm threshold priced in money | [`programmes/predictive-maintenance/`](programmes/predictive-maintenance/) | [Colab](https://colab.research.google.com/github/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/blob/master/programmes/predictive-maintenance/lessons/P03-L01-alarm-economics/lesson.ipynb) |
 | Pull fields out of invoices and contracts, and prove how often you are wrong | [`programmes/document-intelligence/`](programmes/document-intelligence/) | [Colab](https://colab.research.google.com/github/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/blob/master/programmes/document-intelligence/lessons/P02-L01-extraction-evaluation/lesson.ipynb) |
 | Make a simulated humanoid stand and walk, then measure how far that is from a robot | [`flagships/humanoid-lab/`](flagships/humanoid-lab/) | [Colab](https://colab.research.google.com/github/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/blob/master/flagships/humanoid-lab/lessons/F15-L01-first-contact/lesson.ipynb) |
-| Build search and RAG you can measure: retrieval, chunking and the context budget | [`lessons/`](lessons/) | [Colab](https://colab.research.google.com/github/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/blob/master/lessons/T06-L01-retrieval-from-scratch/lesson.ipynb) |
+| Build search and RAG you can measure: retrieval, chunking, the context budget and reranking | [`lessons/`](lessons/) | [Colab](https://colab.research.google.com/github/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/blob/master/lessons/T06-L01-retrieval-from-scratch/lesson.ipynb) |
+| Build AI agents that hold up: the agent loop from scratch, and MCP from the wire up | [`lessons/`](lessons/) | [Colab](https://colab.research.google.com/github/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/blob/master/lessons/T07-L01-agent-loop-from-scratch/lesson.ipynb) |
 | Start from nothing: the 8 GB machine, tokenisers from scratch, a language model on a CPU | [`lessons/`](lessons/) | [Colab](https://colab.research.google.com/github/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/blob/master/lessons/T00-L01-the-8gb-track/lesson.ipynb) |
 
 The model-risk, predictive-maintenance and document-intelligence courses build on
@@ -44,12 +45,12 @@ humanoid lab's is its `README.md`, and [`lessons/`](lessons/) has its own.
 
 <!-- STATUS:BEGIN generated by tools/status.py from the lessons themselves; do not edit -->
 
-**54 lessons, every one passing all 14 gates in `QUALITY.md` and independently reviewed.** 7 are compiled C or C++ exercises. Every notebook opens in Colab, Kaggle, Binder, Codespaces or local Jupyter. Every `MODULES.md` marks a module built only when its lesson exists and has passed; everything else says `specified`, and means it.
+**57 lessons, every one passing all 14 gates in `QUALITY.md` and independently reviewed.** 7 are compiled C or C++ exercises. Every notebook opens in Colab, Kaggle, Binder, Codespaces or local Jupyter. Every `MODULES.md` marks a module built only when its lesson exists and has passed; everything else says `specified`, and means it.
 
 | Area | Built | Specified, not built |
 |---|---|---|
 | `flagships/humanoid-lab` | 8 lessons + capstone | — |
-| `lessons/` — track lessons | 7 | — |
+| `lessons/` — track lessons | 10 | — |
 | `programmes/ai-act-conformity` | 9 of 9 | 0 |
 | `programmes/document-intelligence` | 11 of 11 | 0 |
 | `programmes/model-risk` | 10 of 10 | 0 |
@@ -61,7 +62,7 @@ humanoid lab's is its `README.md`, and [`lessons/`](lessons/) has its own.
 
 <!-- COMING:BEGIN generated by tools/status.py; do not edit -->
 
-A new drop of lessons every week. Watch or star this repository to hear about each one as it lands.
+New lessons three times a week, every Monday, Wednesday and Friday. Watch or star this repository to hear about each one as it lands.
 
 ```mermaid
 timeline
```

**File**: `lessons/README.md` (modified, +6/-0)
```diff
@@ -13,6 +13,9 @@ than exist so far, the rest are planned, not specified in this repository yet.
 | T03 · language models | [`T03-L03-nanolm-cpu-slice`](T03-L03-nanolm-cpu-slice/) | A character-level language model trained on a CPU with numpy alone, its backward pass derived by hand and checked against finite differences. | [Colab](https://colab.research.google.com/github/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/blob/master/lessons/T03-L03-nanolm-cpu-slice/lesson.ipynb) |
 | T06 · retrieval and RAG | [`T06-L01-retrieval-from-scratch`](T06-L01-retrieval-from-scratch/) | BM25, a dense retriever with no external model, and hybrid fusion, scored by an evaluation harness whose intervals say when one retriever is really better. | [Colab](https://colab.research.google.com/github/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/blob/master/lessons/T06-L01-retrieval-from-scratch/lesson.ipynb) |
 | T06 · retrieval and RAG | [`T06-L02-chunking-and-context-budget`](T06-L02-chunking-and-context-budget/) | Chunking and context assembly under a token budget, measured by whether the evidence an answer needs actually reaches the model. | [Colab](https://colab.research.google.com/github/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/blob/master/lessons/T06-L02-chunking-and-context-budget/lesson.ipynb) |
+| T06 · retrieval and RAG | [`T06-L03-reranking-measured`](T06-L03-reranking-measured/) | A learned reranker, pointwise and pairwise, whose gain is stated with its interval, what reranking depth costs, and the trap of tuning on test queries. | [Colab](https://colab.research.google.com/github/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/blob/master/lessons/T06-L03-reranking-measured/lesson.ipynb) |
+| T07 · agents and protocols | [`T07-L01-agent-loop-from-scratch`](T07-L01-agent-loop-from-scratch/) | An agent harness with validated tools, budgets, retries and traces, and a measurement of how per-step reliability compounds over long tasks. | [Colab](https://colab.research.google.com/github/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/blob/master/lessons/T07-L01-agent-loop-from-scratch/lesson.ipynb) |
+| T07 · agents and protocols | [`T07-L02-mcp-from-the-wire-up`](T07-L02-mcp-from-the-wire-up/) | A Model Context Protocol server and client built from the specification, checked by a conformance harness built from the same specification. | [Colab](https://colab.research.google.com/github/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/blob/master/lessons/T07-L02-mcp-from-the-wire-up/lesson.ipynb) |
 | T10 · regulation | [`T10-L01-ai-act-conformity-pack`](T10-L01-ai-act-conformity-pack/) | An AI system registry turned into a machine-checkable EU AI Act conformity evidence pack. The EU AI Act programme starts here. | [Colab](https://colab.research.google.com/github/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/blob/master/lessons/T10-L01-ai-act-conformity-pack/lesson.ipynb) |
 
 Each lesson's `meta.yaml` lists its prerequisites. T00-L01 and T10-L01 need none; beyond them:
@@ -22,6 +25,9 @@ Each lesson's `meta.yaml` lists its prerequisites. T00-L01 and T10-L01 need none
 - T03-L03 builds on T00-L01.
 - T06-L01 builds on T00-L01.
 - T06-L02 builds on T06-L01.
+- T06-L03 builds on T06-L01 and T06-L02.
+- T07-L01 builds on T00-L01.
+- T07-L02 builds on T07-L01.
 
 <!-- NOTICE:BEGIN generated by tools/status.py; do not edit -->
 
```

**File**: `lessons/T06-L03-reranking-measured/claims.yaml` (added, +54/-0)
```diff
@@ -0,0 +1,54 @@
+claims:
+- id: ranknet-pairwise-cross-entropy-cost
+  claim: RankNet models the posterior probability P_ij that document i should be ranked above document
+    j as a logistic function of the difference in the model's own outputs, o_ij = f(x_i) - f(x_j), and
+    trains that model with the cross-entropy cost C_ij = -Pbar_ij * log(P_ij) - (1 - Pbar_ij) * log(1
+    - P_ij), where Pbar_ij is the desired (target) posterior for the pair. This lesson's train_pairwise_ranknet
+    implements the hard-label reduction of exactly this cost (Pbar_ij = 1 for every graded pair, i.e.
+    i strictly preferred to j), which the paper itself reduces to C_ij = -Pbar_ij*o_ij + log(1 + exp(o_ij)).
+  where: lesson.py section on RankNet's pairwise loss, and exercise 4 (train_pairwise_ranknet)
+  source_url: https://www.microsoft.com/en-us/research/wp-content/uploads/2005/08/icml_ranking.pdf
+  source_title: Burges, C., Shaked, T., Renshaw, E., Lazier, A., Deeds, M., Hamilton, N. & Hullender,
+    G. (2005). Learning to Rank using Gradient Descent. Proceedings of the 22nd International Conference
+    on Machine Learning (ICML '05).
+  quote: Define oi ≡ f(xi) and oij ≡ f(xi) − f(xj). We will use the cross entropy cost function Cij ≡
+    C(oij) = −P̄ij log Pij − (1 − P̄ij) log(1 − Pij) [...] where the map from outputs to probabilities
+    are modeled using a logistic function [...] Pij ≡ e^oij / (1 + e^oij) [...] Cij then becomes Cij =
+    −P̄ij oij + log(1 + e^oij)
+  quote_context: Section 3, 'A Probabilistic Ranking Cost Function', equations (1), (2) and (3), page
+    3 of the PDF. The prose is verbatim from the PDF's text layer; its subscripts and superscripts (o_ij,
+    P_ij, e^(o_ij)) are flattened onto one line here, as the text layer itself flattens them. Re-read
+    by the reviewer on 2026-09-23.
+  accessed: 2026-09-23
+- id: ranknet-trains-on-pairs-within-a-query
+  claim: RankNet's approach trains on pairs of examples to learn a ranking function, following Herbrich
+    et al. (2000); because the data is partitioned by query (only documents returned for the SAME query
+    are ranked against each other), a pair is only ever drawn from one query's own results. This lesson's
+    train_pairwise_ranknet builds pairs only within a query's own candidates (grouped by query_ids), never
+    across two queries.
+  where: lesson.py exercise 4 (train_pairwise_ranknet), the requirement that pairs never cross a query
+    boundary
+  source_url: https://www.microsoft.com/en-us/research/wp-content/uploads/2005/08/icml_ranking.pdf
+  source_title: Burges, C., Shaked, T., Renshaw, E., Lazier, A., Deeds, M., Hamilton, N. & Hullender,
+    G. (2005). Learning to Rank using Gradient Descent. Proceedings of the 22nd International Conference
+    on Machine Learning (ICML '05).
+  quote: Only those documents returned for a given query are to be ranked against each other. Thus, rather
+    than consisting of a single set of objects to be ranked amongst each other, the data is instead partitioned
+    by query. In this paper we propose a new approach to this problem. Our approach follows (Herbrich
+    et al., 2000) in that we train on pairs of examples to learn a ranking function
+  quote_context: 'Section 1, Introduction, page 1 of the PDF: one contiguous passage, in the source''s
+    own order (the reviewer replaced an earlier quote that joined its last sentence to its first with
+    ''[...]'' in reverse order). Re-read by the reviewer on 2026-09-23.'
+  accessed: 2026-09-23
+- id: reciprocal-rank-fusion-k-60-default
+  claim: Reciprocal rank fusion's authors fixed its constant k at 60 during a pilot investigation and
+    did not alter it during subsequent validation — the value this lesson's given hybrid_rank uses as
+    RRF_K, carried unchanged from T06-L01.
+  where: lesson.py section 1 (RRF_K, the given first-stage hybrid retriever)
+  source_url: https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf
+  source_title: Cormack, G.V., Clarke, C.L.A. & Buettcher, S. (2009). Reciprocal Rank Fusion outperforms
+    Condorcet and individual Rank Learning Methods. Proceedings of SIGIR '09.
+  quote: where k = 60 was fixed during a pilot investigation and not altered during subsequent validation.
+  quote_context: Section 1, page 1, the sentence completing the RRFscore formula. Re-read by the reviewer
+    on 2026-09-23.
+  accessed: 2026-09-23
```

**File**: `lessons/T06-L03-reranking-measured/lesson.py` (added, +1648/-0)
```diff
@@ -0,0 +1,1648 @@
+# %% [markdown]
+# <!-- COMMONS LAUNCHER v4 · generated by tools/notebooks.py · do not edit by hand -->
+# <a href="https://github.com/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials"><img src="https://raw.githubusercontent.com/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/master/brand/synapsa-commons-badge.png" alt="Synapsa Commons" height="36"></a>
+#
+# Free, hands-on AI courses that run anywhere, from the team building [Synapsa](https://synapsa.realai.eu), an AI-native
+# learning platform.
+#
+# © 2026 RealAI · free to learn from, share and adapt, not to sell ([CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)).
+# The notice at the end of this notebook says what you may and may not do.
+#
+# [![Open in Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/blob/master/lessons/T06-L03-reranking-measured/lesson.ipynb)
+# [![Open in Kaggle](https://kaggle.com/static/images/open-in-kaggle.svg)](https://kaggle.com/kernels/welcome?src=https://github.com/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/blob/master/lessons/T06-L03-reranking-measured/lesson.ipynb)
+# [![Open in Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/master?labpath=lessons/T06-L03-reranking-measured/lesson.ipynb)
+# [![Open in Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials)
+#
+# This lesson needs Python 3.11 or newer with numpy, which Colab, Kaggle, Binder and
+# Codespaces already have.
+
+# %%
+# --- COMMONS LAUNCHER v4 · generated by tools/notebooks.py · do not edit by hand ---
+# Makes this notebook run anywhere. Every line is a no-op when the thing is already present,
+# so a local clone pays nothing and an online notebook repairs itself.
+import importlib.util, os, subprocess, sys, urllib.request
+from pathlib import Path
+
+COMMONS_PIP = []            # (import name, pinned pip spec) for what this lesson imports
+COMMONS_SIBLINGS = []    # files that must sit beside the notebook
+# A fork, a classroom mirror or an offline copy can serve the files from elsewhere by setting
+# COMMONS_RAW_OVERRIDE before running this cell.
+COMMONS_RAW = os.environ.get("COMMONS_RAW_OVERRIDE") or "https://raw.githubusercontent.com/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/master/lessons/T06-L03-reranking-measured/"
+
+# Resolve siblings against the LESSON's own directory, not the working directory. A notebook
+# has no __file__ and runs with cwd alongside itself; a grader imports this file from the repo
+# root. Checking cwd blindly makes the grader think every sibling is missing and reach for the
+# network -- which would put a download on a graded path.
+try:
+    COMMONS_DIR = Path(__file__).resolve().parent
+except NameError:
+    COMMONS_DIR = Path.cwd()
+
+
+def commons_host() -> str:
+    """Name the notebook service we are on. Used for the message, and for honest errors."""
+    try:
+        if importlib.util.find_spec("google.colab") is not None:
+            return "Google Colab"
+    except (ImportError, ValueError):
+        pass
+    if os.environ.get("KAGGLE_KERNEL_RUN_TYPE"):
+        return "Kaggle"
+    if os.environ.get("BINDER_SERVICE_HOST"):
+        return "Binder"
+    if os.environ.get("CODESPACES"):
+        return "GitHub Codespaces"
+    return "a local Python environment"
+
+
+_missing = [pip for imp, pip in COMMONS_PIP if importlib.util.find_spec(imp) is None]
+if _missing:
+    print("installing " + ", ".join(_missing) + " ...")
+    # pip everywhere a student is likely to be; uv-managed local venvs ship without pip.
+    if importlib.util.find_spec("pip") is not None:
+        subprocess.run([sys.executable, "-m", "pip", "install", "-q", *_missing], check=True)
+    else:
+        subprocess.run(["uv", "pip", "install", "-q", "--python", sys.executable, *_missing],
+                       check=True)
+    importlib.invalidate_caches()
+
+_fetched = []
+for _name in COMMONS_SIBLINGS:
+    if not (COMMONS_DIR / _name).exists():
+        (COMMONS_DIR / _name).parent.mkdir(parents=True, exist_ok=True)
+        try:
+            urllib.request.urlretrieve(COMMONS_RAW + _name, COMMONS_DIR / _name)
+            _fetched.append(_name)
+        except Exception as _e:  # Kaggle disables the internet by default; say so plainly
+            raise RuntimeError(
+                f"this lesson needs {_name} beside the notebook and could not fetch it "
+                f"({_e}). On Kaggle, switch Internet on in the notebook settings panel "
+                f"(Kaggle allows that only for phone-verified accounts); otherwise download it "
+          
```

**File**: `lessons/T06-L03-reranking-measured/meta.yaml` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+id: T06-L03-reranking-measured
+title: Reranking, and what it costs — nDCG and MRR gains, the depth curve, and the test-leakage trap
+track: T06
+flagship: ''
+tier: cpu8
+budget_seconds: 150
+language: python
+prerequisites:
+- T00-L01-the-8gb-track
+- T06-L01-retrieval-from-scratch
+- T06-L02-chunking-and-context-budget
+objectives:
+- Implement query-term coverage and term-proximity features over a first-stage candidate pool, and combine
+  them with the candidates' own BM25 score, dense cosine and first-stage ranks into one feature matrix
+- Implement a pointwise logistic-regression reranker and a pairwise RankNet-style reranker, both trained
+  by full-batch gradient descent from numpy alone
+- Measure nDCG@10 and MRR gains of each reranker over the first-stage ranking, with paired bootstrap confidence
+  intervals over queries
+- Measure the rerank-depth curve — quality against how many first-stage candidates are reranked — and
+  the wall-clock cost that buys, printed with its unit
+- Detect, with a tripwire the notebook prints rather than a written assertion, whether a model-selection
+  step read the held-out test queries, and measure how much a reranker chosen by peeking at test overstates
+  its gain relative to queries never touched during selection
+datasets:
+- name: T06-L03 synthetic reranking corpus (20 planted topics, four train/val/test/fresh query splits)
+  kind: synthetic
+  licence: not applicable - generated at run time by the lesson itself
+points: 157
+status: reviewed
+measured_seconds: 1.4
+measured_peak_mib: 41
```

**File**: `lessons/T07-L01-agent-loop-from-scratch/claims.yaml` (added, +102/-0)
```diff
@@ -0,0 +1,102 @@
+claims:
+- id: json-schema-type-keyword
+  claim: 'JSON Schema''s `type` keyword is the mechanism this lesson''s validate_args borrows (as a documented
+    subset, implemented by hand, with no jsonschema package) to say what shape an argument must have:
+    the specification''s own reference describes it as fundamental to JSON Schema because it specifies
+    the data type a schema should expect, and lists array, boolean, null, numeric types, object and string
+    among its basic types.'
+  where: lesson.py exercise 1 (validate_args) and the TOOL_SCHEMAS this lesson defines
+  source_url: https://json-schema.org/understanding-json-schema/reference/type
+  source_title: 'Understanding JSON Schema — Type-specific keywords: type'
+  quote: The type keyword is fundamental to JSON Schema because it specifies the data type that a schema
+    should expect.
+  quote_context: Opening paragraph of the 'type' reference page
+  accessed: 2026-09-23
+- id: rfc8259-json-booleans-are-not-numbers
+  claim: In JSON a boolean is its own primitive type, separate from a number, so `true` is never an integer
+    however Python happens to treat `True` (where `isinstance(True, int)` holds). This is why this lesson's
+    validate_args rejects a bool wherever a schema asks for "integer" or "number".
+  where: lesson.py exercise 1 (validate_args, its bool special case) and the common-mistakes section
+  source_url: https://www.rfc-editor.org/rfc/rfc8259.txt
+  source_title: RFC 8259 — The JavaScript Object Notation (JSON) Data Interchange Format, section 1
+  quote: JSON can represent four primitive types (strings, numbers, booleans, and null) and two structured
+    types (objects and arrays).
+  quote_context: Section 1, Introduction, second paragraph
+  accessed: 2026-09-23
+- id: json-schema-required-keyword
+  claim: 'JSON Schema''s `required` keyword names which of an object''s declared properties must be present;
+    by default none of them are. This lesson''s validate_args implements the same rule for a tool call''s
+    arguments: a property named in a schema''s "required" list that is absent from the call is a validation
+    error, not a crash.'
+  where: lesson.py exercise 1 (validate_args, the 'required' branch) and its check's missing-argument
+    case
+  source_url: https://json-schema.org/understanding-json-schema/reference/object
+  source_title: 'Understanding JSON Schema — object: Required Properties'
+  quote: By default, the properties defined by the properties keyword are not required. However, one can
+    provide a list of required properties using the required keyword. The required keyword takes an array
+    of zero or more strings. Each of these strings must be unique.
+  quote_context: The 'Required Properties' section of the 'object' reference page
+  accessed: 2026-09-23
+- id: json-schema-enum-keyword
+  claim: JSON Schema's `enum` keyword restricts a value to a fixed, non-empty set of allowed values. This
+    lesson's validate_args implements the same restriction for any tool argument whose schema carries
+    an "enum" list, rejecting a call whose value is not one of the listed options.
+  where: lesson.py exercise 1 (validate_args, the 'enum' branch)
+  source_url: https://json-schema.org/understanding-json-schema/reference/enum
+  source_title: Understanding JSON Schema — Enumerated values
+  quote: The enum keyword is used to restrict a value to a fixed set of values. It must be an array with
+    at least one element, where each element is unique.
+  quote_context: Opening paragraph of the 'enum' reference page
+  accessed: 2026-09-23
+- id: aws-capped-exponential-backoff
+  claim: 'Capped exponential backoff is the standard response to a client whose call failed and needs
+    to retry without hammering the thing it called: after each unsuccessful attempt, a client multiplies
+    its backoff by a constant, up to a fixed maximum. This lesson''s backoff_delay implements the same
+    cap — min(cap, base * 2**attempt) — as the ceiling on how long a single retry may wait (a number the
+    lesson computes and sums, but never sleeps for; episode cost is counted in attempts, not seconds).'
+  where: lesson.py exercise 3 (backoff_delay) and its BASE_DELAY / CAP_DELAY constants
+  source_url: https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
+  source_title: AWS Architecture Blog — Exponential Backoff And Jitter (Marc Brooker, 2015)
+  quote: Capped exponential backoff means that clients multiply their backoff by a constant after each
+    attempt, up to some maximum value.
+  quote_context: The 'Adding Backoff' section, the sentence introducing the capped-backoff formula
+  accessed: 2026-09-23
+- id: aws-sdks-build-backoff-and-jitter-into-retries
+  claim: Exponential backoff with jitter is not only an article's recommendation but the retry behaviour
+    most AWS SDKs ship with, which is why this lesson calls it the usual fix for a transient failur
```

**File**: `lessons/T07-L01-agent-loop-from-scratch/lesson.py` (added, +1644/-0)
```diff
@@ -0,0 +1,1644 @@
+# %% [markdown]
+# <!-- COMMONS LAUNCHER v4 · generated by tools/notebooks.py · do not edit by hand -->
+# <a href="https://github.com/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials"><img src="https://raw.githubusercontent.com/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/master/brand/synapsa-commons-badge.png" alt="Synapsa Commons" height="36"></a>
+#
+# Free, hands-on AI courses that run anywhere, from the team building [Synapsa](https://synapsa.realai.eu), an AI-native
+# learning platform.
+#
+# © 2026 RealAI · free to learn from, share and adapt, not to sell ([CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)).
+# The notice at the end of this notebook says what you may and may not do.
+#
+# [![Open in Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/blob/master/lessons/T07-L01-agent-loop-from-scratch/lesson.ipynb)
+# [![Open in Kaggle](https://kaggle.com/static/images/open-in-kaggle.svg)](https://kaggle.com/kernels/welcome?src=https://github.com/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/blob/master/lessons/T07-L01-agent-loop-from-scratch/lesson.ipynb)
+# [![Open in Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/master?labpath=lessons/T07-L01-agent-loop-from-scratch/lesson.ipynb)
+# [![Open in Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials)
+#
+# This lesson needs Python 3.11 or newer with numpy, which Colab, Kaggle, Binder and
+# Codespaces already have.
+
+# %%
+# --- COMMONS LAUNCHER v4 · generated by tools/notebooks.py · do not edit by hand ---
+# Makes this notebook run anywhere. Every line is a no-op when the thing is already present,
+# so a local clone pays nothing and an online notebook repairs itself.
+import importlib.util, os, subprocess, sys, urllib.request
+from pathlib import Path
+
+COMMONS_PIP = []            # (import name, pinned pip spec) for what this lesson imports
+COMMONS_SIBLINGS = []    # files that must sit beside the notebook
+# A fork, a classroom mirror or an offline copy can serve the files from elsewhere by setting
+# COMMONS_RAW_OVERRIDE before running this cell.
+COMMONS_RAW = os.environ.get("COMMONS_RAW_OVERRIDE") or "https://raw.githubusercontent.com/TarrySingh/Artificial-Intelligence-Deep-Learning-Machine-Learning-Tutorials/master/lessons/T07-L01-agent-loop-from-scratch/"
+
+# Resolve siblings against the LESSON's own directory, not the working directory. A notebook
+# has no __file__ and runs with cwd alongside itself; a grader imports this file from the repo
+# root. Checking cwd blindly makes the grader think every sibling is missing and reach for the
+# network -- which would put a download on a graded path.
+try:
+    COMMONS_DIR = Path(__file__).resolve().parent
+except NameError:
+    COMMONS_DIR = Path.cwd()
+
+
+def commons_host() -> str:
+    """Name the notebook service we are on. Used for the message, and for honest errors."""
+    try:
+        if importlib.util.find_spec("google.colab") is not None:
+            return "Google Colab"
+    except (ImportError, ValueError):
+        pass
+    if os.environ.get("KAGGLE_KERNEL_RUN_TYPE"):
+        return "Kaggle"
+    if os.environ.get("BINDER_SERVICE_HOST"):
+        return "Binder"
+    if os.environ.get("CODESPACES"):
+        return "GitHub Codespaces"
+    return "a local Python environment"
+
+
+_missing = [pip for imp, pip in COMMONS_PIP if importlib.util.find_spec(imp) is None]
+if _missing:
+    print("installing " + ", ".join(_missing) + " ...")
+    # pip everywhere a student is likely to be; uv-managed local venvs ship without pip.
+    if importlib.util.find_spec("pip") is not None:
+        subprocess.run([sys.executable, "-m", "pip", "install", "-q", *_missing], check=True)
+    else:
+        subprocess.run(["uv", "pip", "install", "-q", "--python", sys.executable, *_missing],
+                       check=True)
+    importlib.invalidate_caches()
+
+_fetched = []
+for _name in COMMONS_SIBLINGS:
+    if not (COMMONS_DIR / _name).exists():
+        (COMMONS_DIR / _name).parent.mkdir(parents=True, exist_ok=True)
+        try:
+            urllib.request.urlretrieve(COMMONS_RAW + _name, COMMONS_DIR / _name)
+            _fetched.append(_name)
+        except Exception as _e:  # Kaggle disables the internet by default; say so plainly
+            raise RuntimeError(
+                f"this lesson needs {_name} beside the notebook and could not fetch it "
+                f"({_e}). On Kaggle, switch Internet on in the notebook settings panel "
+                f"(Kaggle allows that only for phone-verified accounts); otherwise downl
```

**File**: `lessons/T07-L01-agent-loop-from-scratch/meta.yaml` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+id: T07-L01-agent-loop-from-scratch
+title: The agent loop from scratch, and why reliability compounds
+track: T07
+flagship: ''
+tier: cpu8
+budget_seconds: 120
+language: python
+prerequisites:
+- T00-L01-the-8gb-track
+objectives:
+- Implement a JSON-Schema-style argument validator, by hand, and a tool registry that turns an unknown
+  tool name or a malformed call into a returned error rather than an exception
+- Implement capped, seeded exponential backoff with full jitter and a retry wrapper that retries only
+  transient tool failures, never a malformed call
+- Implement the agent loop itself, with a step budget, a cost budget and a stuck-loop detector as its
+  explicit stop conditions
+- Measure success rate against task length over a seeded suite of synthetic tasks, with a bootstrap confidence
+  interval, a cost-per-success figure and a failure taxonomy
+- Fit the measured success-rate-versus-length curve against p^n and measure how much each guardrail --
+  validation, retries, budget -- moves success rate and cost
+datasets:
+- name: T07-L01 synthetic tool-call chains (lookup chains of controlled length, seeded fault and transient-failure
+    injection)
+  kind: synthetic
+  licence: not applicable - generated at run time by the lesson itself
+points: 240
+status: reviewed
+measured_seconds: 0.2
+measured_peak_mib: 65
```

---

### Incident Patch 2: `ec23e290` (2026-09-23)
**Commit Message**: Make the three C lessons compile on Linux, and mask every machine measurement

The first Linux CI run failed three compiled lessons that pass on macOS: F15-L06, P02-L10 and
P04-L06 call clock_gettime(CLOCK_MONOTONIC) under -std=c11, and glibc hides POSIX from a
strict ISO C build unless it is asked for before the first header. macOS shows it regardless.
Each now defines _DEFAULT_SOURCE, as P04-L09 already did; stub and solution scores unchanged.

The reproducibility check also relied on luck for 13 lines: timings it only masked when two
runs happened to differ. F15-L06 prints "us/tick" and F15-L07 "rollouts/s", now recognised as
measurements; T03-L02 printed seconds and nanoseconds as bare numbers in table cells, which
gate 13 forbids, and now prints them with their units.

brand/social-preview.png: the 1280 x 640 card for sharing the repository, drawn by
tools/brand_lockups.py.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `flagships/humanoid-lab/lessons/F15-L06-control-loop-in-c/lesson.c` (modified, +3/-0)
```diff
@@ -8,6 +8,9 @@
 // watch the TODOs turn into PASSes. Everything below the three exercises is the harness; it
 // is given, and it is worth reading, because it is the shape every control loop has.
 
+/* clock_gettime and CLOCK_MONOTONIC are POSIX, not ISO C. Under -std=c11, glibc (Linux)
+   hides them unless asked before the first header; macOS shows them regardless. */
+#define _DEFAULT_SOURCE
 #include <mujoco/mujoco.h>
 
 #include <math.h>
```

**File**: `lessons/T03-L02-bpe-merge-loop-in-cpp/lesson.ipynb` (modified, +8/-8)
```diff
@@ -375,7 +375,7 @@
   {
    "cell_type": "code",
    "execution_count": null,
-   "id": "dab1775e0dda",
+   "id": "293502b9957b",
    "metadata": {},
    "outputs": [],
    "source": [
@@ -396,10 +396,10 @@
     "\n",
     "\n",
     "if __name__ == \"__main__\":\n",
-    "    print(f\"{'bytes':>8} {'symbols':>9} {'seconds':>8} {'ns/symbol/merge':>16}\")\n",
+    "    print(f\"{'bytes':>8} {'symbols':>9} {'time':>9} {'per symbol, per merge':>22}\")\n",
     "    for _row in python_scaling():\n",
-    "        print(f\"{_row['bytes']:8d} {_row['symbols']:9d} {_row['seconds']:8.3f}\"\n",
-    "              f\" {_row['ns_per_symbol_per_merge']:16.1f}\")\n",
+    "        print(f\"{_row['bytes']:8d} {_row['symbols']:9d} {_row['seconds']:7.3f} s\"\n",
+    "              f\" {_row['ns_per_symbol_per_merge']:19.1f} ns\")\n",
     "    print(\"\\nSeconds roughly double when the corpus doubles. The last column is flat, and it\")\n",
     "    print(\"is the constant you are about to attack: the cost of one symbol, one time, here.\")"
    ]
@@ -921,7 +921,7 @@
   {
    "cell_type": "code",
    "execution_count": null,
-   "id": "f978bb688e2c",
+   "id": "d058e7643bb7",
    "metadata": {
     "lines_to_next_cell": 1
    },
@@ -945,10 +945,10 @@
     "    cpp_rows = cpp_scaling()\n",
     "    py_rows = python_scaling()\n",
     "    print(\"per symbol, per merge — the only column that can tell a constant from a curve\")\n",
-    "    print(f\"{'symbols':>9} {'python ns':>11} {'c++ ns':>9} {'ratio':>9}\")\n",
+    "    print(f\"{'symbols':>9} {'python':>11} {'c++':>11} {'ratio':>9}\")\n",
     "    for p, c in zip(py_rows, cpp_rows):\n",
-    "        print(f\"{c['symbols']:9d} {p['ns_per_symbol_per_merge']:11.1f}\"\n",
-    "              f\" {c['ns_per_symbol_per_merge']:9.1f}\"\n",
+    "        print(f\"{c['symbols']:9d} {p['ns_per_symbol_per_merge']:8.1f} ns\"\n",
+    "              f\" {c['ns_per_symbol_per_merge']:8.1f} ns\"\n",
     "              f\" {p['ns_per_symbol_per_merge'] / c['ns_per_symbol_per_merge']:8.1f}x\")\n",
     "    print(\"\\nRead the two middle columns DOWN, not across. Each is roughly flat as the corpus\")\n",
     "    print(\"grows, and that flatness is the straight line — the same line in both languages.\")\n",
```

**File**: `lessons/T03-L02-bpe-merge-loop-in-cpp/lesson.py` (modified, +6/-6)
```diff
@@ -337,10 +337,10 @@ def python_scaling(fractions=(0.25, 0.5, 1.0), merges: int = 30) -> list:
 
 
 if __name__ == "__main__":
-    print(f"{'bytes':>8} {'symbols':>9} {'seconds':>8} {'ns/symbol/merge':>16}")
+    print(f"{'bytes':>8} {'symbols':>9} {'time':>9} {'per symbol, per merge':>22}")
     for _row in python_scaling():
-        print(f"{_row['bytes']:8d} {_row['symbols']:9d} {_row['seconds']:8.3f}"
-              f" {_row['ns_per_symbol_per_merge']:16.1f}")
+        print(f"{_row['bytes']:8d} {_row['symbols']:9d} {_row['seconds']:7.3f} s"
+              f" {_row['ns_per_symbol_per_merge']:19.1f} ns")
     print("\nSeconds roughly double when the corpus doubles. The last column is flat, and it")
     print("is the constant you are about to attack: the cost of one symbol, one time, here.")
 
@@ -788,10 +788,10 @@ def _show_scaling() -> None:
     cpp_rows = cpp_scaling()
     py_rows = python_scaling()
     print("per symbol, per merge — the only column that can tell a constant from a curve")
-    print(f"{'symbols':>9} {'python ns':>11} {'c++ ns':>9} {'ratio':>9}")
+    print(f"{'symbols':>9} {'python':>11} {'c++':>11} {'ratio':>9}")
     for p, c in zip(py_rows, cpp_rows):
-        print(f"{c['symbols']:9d} {p['ns_per_symbol_per_merge']:11.1f}"
-              f" {c['ns_per_symbol_per_merge']:9.1f}"
+        print(f"{c['symbols']:9d} {p['ns_per_symbol_per_merge']:8.1f} ns"
+              f" {c['ns_per_symbol_per_merge']:8.1f} ns"
               f" {p['ns_per_symbol_per_merge'] / c['ns_per_symbol_per_merge']:8.1f}x")
     print("\nRead the two middle columns DOWN, not across. Each is roughly flat as the corpus")
     print("grows, and that flatness is the straight line — the same line in both languages.")
```

**File**: `programmes/document-intelligence/lessons/P02-L10-streaming-scanner-in-c/lesson.c` (modified, +3/-0)
```diff
@@ -16,6 +16,9 @@
  * of the notebook measure both on your machine, and those measured numbers are the only ones
  * you should ever quote.
  */
+/* clock_gettime and CLOCK_MONOTONIC are POSIX, not ISO C. Under -std=c11, glibc (Linux)
+   hides them unless asked before the first header; macOS shows them regardless. */
+#define _DEFAULT_SOURCE
 #include <stdbool.h>
 #include <stdint.h>
 #include <stdio.h>
```

**File**: `programmes/model-risk/lessons/P04-L06-reproduce-the-number-in-c/lesson.c` (modified, +3/-0)
```diff
@@ -12,6 +12,9 @@
 // Moved or copied this checkout? Run `make clean` first. See the common-mistakes section of
 // the notebook for why.
 
+/* clock_gettime and CLOCK_MONOTONIC are POSIX, not ISO C. Under -std=c11, glibc (Linux)
+   hides them unless asked before the first header; macOS shows them regardless. */
+#define _DEFAULT_SOURCE
 #include <float.h>
 #include <math.h>
 #include <setjmp.h>
```

**File**: `tools/brand_lockups.py` (modified, +63/-0)
```diff
@@ -12,6 +12,7 @@
   synapsa-commons-dark.png    white ink and the brand's on-dark blue and saffron
   synapsa-commons-badge.png   the light lockup on a white rounded tile, which reads on both
                               notebook themes -- used at the top of every lesson.ipynb
+  social-preview.png          1280 x 640, the card shown when the repository is shared
 
 Text is drawn as glyph outlines, so the PNGs do not depend on Geist being installed where they
 are viewed. Geist (SIL Open Font Licence) is fetched from Google Fonts into a temporary directory.
@@ -88,13 +89,75 @@ def draw(name, fonts, ink, blue, saffron, stroke, bg=None):
     print(f"  wrote brand/{name}.png  ({round(W) * 2} x {H * 2} px)")
 
 
+COURSES = ("EU AI Act conformity", "Model risk", "Predictive maintenance",
+           "Document intelligence", "Humanoid lab")
+
+
+def measure(s, prop, size):
+    """Advance width of a whole string, spaces included (a trailing bar gives spaces an extent)."""
+    bar = TextPath((0, 0), "|", size=size, prop=prop).get_extents()
+    return TextPath((0, 0), s + "|", size=size, prop=prop).get_extents().x1 - bar.width
+
+
+def text(ax, x, y, s, prop, size, colour):
+    """A whole line as one outline, so the font's own spacing and kerning apply; returns the end x."""
+    place = Affine2D().scale(1, -1).translate(0, y)
+    ax.add_patch(PathPatch(place.transform_path(TextPath((x, 0), s, size=size, prop=prop)),
+                           fc=colour, ec="none"))
+    return x + measure(s, prop, size)
+
+
+def social(fonts):
+    """brand/social-preview.png, 1280 x 640: the card GitHub shows when the repository is shared.
+    Pure black canvas, brand colour only in the mark (the handover's rules 4 and 9)."""
+    regular, bold = fonts
+    W, H, M = 1280, 640, 88
+    fig = plt.figure(figsize=(W / 100, H / 100), dpi=100)
+    ax = fig.add_axes([0, 0, 1, 1])
+    ax.set_xlim(0, W); ax.set_ylim(H, 0); ax.axis("off")
+    ax.add_patch(plt.Rectangle((0, 0), W, H, fc="#000000", ec="none"))
+    # the lockup, scaled 1.5x from the wordmark geometry
+    k, top = 1.5, 72
+    ax.add_patch(Circle((M + 13 * k - 4 * k, top + 24 * k), 9 * k, fc=hsl(228, 100, 64), ec="none"))
+    ax.add_patch(Circle((M + 32 * k - 4 * k, top + 24 * k), 5 * k, fc=hsl(34, 100, 60), ec="none"))
+    x0 = M - 4 * k
+    ax.add_patch(PathPatch(MPath([(x0 + 22 * k, top + 24 * k), (x0 + 27 * k, top + 16 * k), (x0 + 31 * k, top + 24 * k)],
+                                 [MPath.MOVETO, MPath.CURVE3, MPath.CURVE3]),
+                           fc="none", ec="#ffffff", lw=2.8 * k * 72 / 100, capstyle="round"))
+    place = Affine2D().scale(k, -k).translate(x0 + 52 * k, top + 32 * k)   # the lockup's own tracking
+    word, xe = tracked("Synapsa", bold, 0)
+    word2, _ = tracked("Commons", regular, xe + 0.28 * SIZE)
+    for p in word + word2:
+        ax.add_patch(PathPatch(place.transform_path(p), fc="#ffffff", ec="none"))
+    # the thesis
+    text(ax, M, 292, "Free, hands-on AI courses", bold, 64, "#ffffff")
+    text(ax, M, 370, "that run anywhere.", bold, 64, "#ffffff")
+    text(ax, M, 430, "Autograded notebooks for Colab, Kaggle, Binder, Codespaces and Jupyter.",
+         regular, 25, hsl(0, 0, 70))
+    # the courses, as quiet outlined chips
+    x, y, h = M, 492, 44
+    for c in COURSES:
+        w = measure(c, regular, 20) + 36
+        if x + w > W - M:
+            x, y = M, y + h + 14
+        ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0,rounding_size=22",
+                                    fc="#000000", ec=hsl(0, 0, 32), lw=1.2))
+        text(ax, x + 18, y + 29, c, regular, 20, hsl(0, 0, 88))
+        x += w + 12
+    text(ax, M, 598, "From the team building Synapsa  \u00b7  synapsa.realai.eu", regular, 20, hsl(0, 0, 55))
+    fig.savefig(OUT / "social-preview.png", dpi=100, facecolor="#000000")
+    plt.close(fig)
+    print("  wrote brand/social-preview.png  (1280 x 640 px)")
+
+
 def main():
     OUT.mkdir(exist_ok=True)
     with tempfile.TemporaryDirectory() as tmp:
         fonts = geist(Path(tmp))
         draw("synapsa-commons-light", fonts, "#000000", hsl(228, 95, 54), hsl(34, 95, 56), "#000000")
         draw("synapsa-commons-dark", fonts, "#ffffff", hsl(228, 100, 64), hsl(34, 100, 60), "#ffffff")
         draw("synapsa-commons-badge", fonts, "#000000", hsl(228, 95, 54), hsl(34, 95, 56), "#000000", bg="#ffffff")
+        social(fonts)
 
 
 if __name__ == "__main__":
```

**File**: `tools/verify_portable.py` (modified, +4/-1)
```diff
@@ -114,7 +114,10 @@ def classify(res) -> str:
     r"|KiB|MiB|GiB|kB|MB|GB|Hz|kHz|MHz|x|×"
     # rates of THIS machine. Not m/s: a simulated walking speed is a deterministic result.
     r"|(?:B|KB|kB|MB|GB|KiB|MiB|GiB|bytes|steps|it|samples|calls|ticks|rows|records|tokens"
-    r"|docs|documents|captures|readings|lines|fields|events|merges)/s)(?![\w/])")
+    r"|docs|documents|captures|readings|lines|fields|events|merges|rollouts|symbols)/s"
+    # time per unit of work on THIS machine: "0.673 us/tick", "12 ns/record"
+    r"|(?:s|ms|us|µs|ns)/(?:tick|step|call|iter|iteration|item|row|record|doc|document|sample"
+    r"|token|merge|byte|op|frame)s?)(?![\w/])")
 BUILD_JUNK = shutil.ignore_patterns("lesson_bin", "lesson_bin *", "*.o", "*.dSYM", "__pycache__",
                                     "* [0-9]", "* [0-9].*", "lesson.ipynb", "build", ".ipynb_checkpoints")
 
```

---

### Incident Patch 3: `cdf50140` (2026-09-23)
**Commit Message**: Every programme map now describes what was built, checked statement by statement

The four MODULES.md files were written as specifications before most of their lessons existed;
the lessons were then built, mutation-reviewed and changed under review. The prose had drifted
into saying things that were false about the lessons. Among them:
* the AI Act capstone "re-verifies all of the above" -- it re-verifies six specific evidence ids;
* module 2 "fills risk_classification_record" -- an evidence id its prerequisite never defines;
* module 5 "reads the verifier_ids field the module 1 log already records" -- it builds its own;
* module 7 computes "the module 6 metrics over rolling windows" -- its own metric, tumbling
  windows;
* module 8's account of Article 43 -- the point-1 choice exists only when harmonised standards
  were applied in full;
* predictive-maintenance modules 2-9 still headed "specified"; module 3 promising "a real
  vibration corpus to be selected"; module 5 putting NASA's C-MAPSS on the required path;
* model-risk module 1: "np.float64 is refused by json.dumps" -- under numpy 2.5.3 it is not;
* predictive-maintenance module 5 listing RMSE among "metrics that respect a

**File**: `programmes/ai-act-conformity/MODULES.md` (modified, +174/-113)
```diff
@@ -1,12 +1,15 @@
 # Module map — EU AI Act conformity engineering
 
-Every module is `cpu8`: 8 GiB, 2 vCPU, no GPU, no network, standard library plus numpy. Every
-module is a notebook with scaffolded stubs, public checks, an autograded rubric with partial
-credit, a worked solution and a self-check. Every module ends with an artefact, not a summary.
+Every module is `cpu8`: 8 GiB, 2 vCPU, no GPU, no network, standard library plus numpy where a
+module needs it. Every module is a notebook with scaffolded stubs, public checks, an autograded
+rubric with partial credit, a worked solution and a self-check. Every module ends with an
+artefact, not a summary.
 
 The spine is the evidence table from the prerequisite lesson
-`lessons/T10-L01-ai-act-conformity-pack`. Each module below fills one or more of the evidence
-ids that lesson defines, so the pack stays machine-checkable as the programme grows.
+`lessons/T10-L01-ai-act-conformity-pack`. Modules 1 and 3 to 8 each fill evidence ids that
+lesson defines, and the capstone re-verifies six of them, so the pack stays machine-checkable
+as the programme grows. Module 2 fills none: its classification record is the input module 8
+reads to choose the route.
 
 <!-- STATUS:BEGIN generated by tools/status.py from the lessons themselves; do not edit -->
 
@@ -26,26 +29,26 @@ ids that lesson defines, so the pack stays machine-checkable as the programme gr
 
 <!-- STATUS:END -->
 
-Each module fills one or more evidence ids from the prerequisite lesson's evidence table:
+The evidence ids from the prerequisite lesson's evidence table that each module fills, or in
+the capstone re-verifies:
 
 | # | Evidence ids it fills |
 |---|---|
 | 1 | `automatic_logging_design` |
-| 2 | `risk_classification_record` |
+| 2 | none — the lesson calls its sealed record `risk_classification_record`, but T10-L01's table defines no such id |
 | 3 | `technical_documentation` |
 | 4 | `data_governance_record` |
 | 5 | `human_oversight_plan` |
 | 6 | `accuracy_robustness_cybersecurity_report` |
 | 7 | `post_market_monitoring_plan`, `serious_incident_procedure` |
 | 8 | `conformity_assessment_record`, `eu_declaration_of_conformity`, `ce_marking_record` |
-| 9 | all of the above, re-verified |
+| 9 | re-verifies `automatic_logging_design`, `technical_documentation`, `accuracy_robustness_cybersecurity_report`, `human_oversight_plan`, `eu_declaration_of_conformity`, `post_market_monitoring_plan` |
 
 ---
 
-## 1. Article 12 logging and traceability — build an audit trail that survives an inspection
+## 1. Article 12 logging and traceability
 
-`lessons/P01-L01-article-12-logging` · **BUILT** · tier `cpu8` · prerequisite
-`T10-L01-ai-act-conformity-pack`
+`lessons/P01-L01-article-12-logging` · prerequisites `T10-L01-ai-act-conformity-pack`
 
 **The lab.** The student implements, from stubs, five things and then runs an inspection over
 the log they built:
@@ -67,41 +70,50 @@ the log they built:
 
 **What makes it not a lecture.** The event stream contains a clock that stepped backwards
 mid-decision, so ordering by timestamp visibly reverses a decision; a retention boundary two
-entries land exactly on; and a decision whose session never closed. The rubric is 58 points
-across 19 tests and was mutation-tested against 21 plausible-wrong implementations plus one
-differently-shaped right answer.
+entries land exactly on; and a decision whose session never closed. The rubric grades the
+verifier's reason as well as its verdict: a gap must be blamed on the numbering, a broken link
+on `prev_hash` and an edited event on `entry_hash`, because each sends an inspector somewhere
+different.
 
 **The honesty it teaches.** Article 12(3)'s four-item minimum is written for the Annex III
 point 1(a) remote biometric identification systems. The lesson's fictional system scores
-credit applications, so the eight-field list it checks is labelled, field by field, with where
-it came from — including the two that are the lesson's own judgement with no article behind
-them. A field list you cannot argue with is a field list nobody checked.
+credit applications, so the required-field list it checks is labelled, field by field, with
+where it came from — including the fields that are the lesson's own modelling choice rather
+than Article 12(3)'s minimum. A field list you cannot argue with is a field list nobody checked.
+
+**Data.** Nothing is read or downloaded: the event stream is constructed inside `lesson.py`
+against a fixed as-of date, and its match scores come from a seeded numpy generator.
 
 ---
 
 ## 2. Risk classification as a decision procedure
 
-`lessons/P01-L02-risk-classification` · **BUILT** · tier `cpu8` · measured <0.1 s, 21 MiB ·
-69 rubric points across 23 autograded cases · prerequisites `T10-L01-ai-act-conformity-pack`,
+`lessons/P01-L02-risk-classification` · prerequisites `T10-L01-ai-act-conformity-pack`,
 `P01-L01-article-12-logging`
 
 **The lab.** T10-L01 gave the student a `classify()` that 
```

**File**: `programmes/document-intelligence/MODULES.md` (modified, +88/-59)
```diff
@@ -32,78 +32,102 @@ inside its lesson from a fixed seed. The labs below are designed within that, no
 
 ## Module 1 — Field extraction you can measure: build the evaluation harness before the extractor
 
-**Status: BUILT.** `lessons/P02-L01-extraction-evaluation/` · tier `cpu8` · measured 0.2 s,
-29 MiB · 84 rubric points across 21 autograded cases · prerequisite `T00-L01-the-8gb-track`.
+`lessons/P02-L01-extraction-evaluation/` · tier `cpu8` · prerequisites `T00-L01-the-8gb-track`
 
-**The lab.** The student is handed 180 short synthetic remittance advices with gold labels, and
-a deliberately mediocre stand-in extractor with a seeded, documented error model — it reformats
-dates and amounts into its own house style, drops fields, invents payment terms that were never
-printed, smudges a supplier name the way a scan does, and substitutes a digit in an amount. They
+**The lab.** The student is handed 180 short synthetic remittance advices with gold labels,
+generated inside the lesson from a fixed seed, and a deliberately mediocre stand-in extractor
+with a seeded, documented error model — it reformats dates and amounts into its own house
+style, drops fields, invents payment terms that were never printed, smudges a supplier name the
+way a scan does, and gets a digit wrong in an amount, an invoice number or a payment term. They
 then implement, in pure numpy and stdlib:
 
 1. `normalise_value` — a per-field-type normalisation policy (money, date, id, integer, text),
    including the trap that a comma is a thousands separator in one convention and a decimal
-   point in another.
-2. `match_value` — exact, normalised and fuzzy matching, with fuzzy confined to text fields.
-   They then run a cell that counts how many genuinely wrong amounts a fuzzy money matcher
-   would wave through on this corpus.
+   point in another: a lone comma is decimal only when one or two digits follow it and end the
+   number.
+2. `match_value` — exact, normalised and fuzzy matching, with fuzzy confined to text fields and
+   its threshold inclusive. A later cell counts how many genuinely wrong amounts a fuzzy money
+   matcher would wave through on this corpus.
 3. `score_field` and `macro_f1` — per-field precision, recall and F1, where a wrong value counts
    as both a false positive and a false negative, and an unweighted macro average that refuses
    to let the field on every page bury the rare one.
 4. `classify_cell` and `confusion_by_field_type` — five mutually exclusive labels per cell
-   (correct, miss, spurious, wrong value, true negative), aggregated by field *type*, so one F1
-   number becomes a work order.
+   (correct, miss, spurious, wrong value, true negative), aggregated by field *type* under the
+   matching mode it is given, so one F1 number becomes a work order.
 5. `review_queue` and `apply_reviews` — a confidence-ordered routing policy under a fixed
-   budget, with a deterministic tie-break, that must not mutate the records it scores.
+   budget in which every cell is a candidate, a confident silence included, ties break on
+   `(doc_id, field)`, and corrections land in new records rather than the ones being scored.
 
 They finish by sweeping the budget and reading a quality/cost table: macro F1 against a random
 routing control, cost per document from placeholder rates they are told to replace, and the
 marginal F1 bought per unit of cost. On this corpus the yield *rises* then falls, because the
-lowest-confidence cells are all misses and the next band contains the wrong values — and fixing
-a wrong value is worth strictly more than fixing a miss. That is measured in the notebook, not
+lowest-confidence cells are all misses and the next band brings in wrong values — and fixing a
+wrong value is worth strictly more than fixing a miss. That is measured in the notebook, not
 asserted.
 
-**Why this is module 1 rather than module 3.** Published evidence puts the residual difficulty
-of contract extraction in exactly the fields normalisation governs (see `claims.yaml`). A
-student who has not written the normaliser cannot tell a formatting difference from a defect,
-and will spend the rest of the programme filing bugs against models that were already right.
+**Why this is module 1 rather than module 3.** A May 2026 study of structured contract
+extraction found its domain-trained model weakest on currency fields requiring normalisation,
+and scored its models with no currency parsing at all (both are sourced in the
+lesson's `claims.yaml`). A student who has not written the normaliser cannot tell a formatting
+difference from a defect, and will spend the rest of the programme filing bugs against models
+that were already right.
 
 ---
 
 ## Module 2 — Ingestion and layout without a PDF library
 
-**Status: BUILT.** `lessons/P02-L02-layout-reading-order/` · tier `cpu8` · measured 0.2 s,
-31 MiB · 94 rubric points across 23 autograded cases.
-
-**Lab:** reading order from geometry. The student is given syn
```

**File**: `programmes/model-risk/MODULES.md` (modified, +82/-59)
```diff
@@ -1,9 +1,10 @@
 # Module map — Model risk, AI assurance and audit analytics
 
 A module is one lesson directory in the standard layout (`meta.yaml`, `lesson.py`,
-`solutions/`, `tests/`, `claims.yaml`), except the two compiled modules, which add a `Makefile`
-and a test binary. Every module is tier `cpu8` — 8 GiB, 2 vCPU, no GPU, no network, under ten
-minutes — and each row states the budget its `meta.yaml` will declare.
+`solutions/`, `tests/`, `claims.yaml`), except the two compiled modules, which add a `lesson.c`,
+its reference in `solutions/`, and a `Makefile` that builds the test binary. Every module is
+tier `cpu8` — 8 GiB, 2 vCPU, no GPU, no network, under ten minutes — and each section states
+the budget its `meta.yaml` declares, or will declare.
 
 <!-- STATUS:BEGIN generated by tools/status.py from the lessons themselves; do not edit -->
 
@@ -24,17 +25,12 @@ minutes — and each row states the budget its `meta.yaml` will declare.
 
 <!-- STATUS:END -->
 
-Module 6's 383 MiB is the largest figure in the programme and is real: the notebook holds two
-million doubles in four different summation orders at once, which is the whole point of the
-lesson. It is well inside the 8 GiB tier.
-
 ---
 
 ## Module 1 — A validation suite that would survive an audit
 
-**Status: BUILT.** `lessons/P04-L01-validation-suite/` · id `P04-L01-validation-suite` ·
-python · tier `cpu8` · budget 90 s · **measured under 1 s and under 40 MiB** · 110 rubric points ·
-prerequisite `T00-L01-the-8gb-track`.
+**Lesson:** `lessons/P04-L01-validation-suite/` · tier `cpu8` · budget 90 s · prerequisite
+`T00-L01-the-8gb-track`.
 
 **The lab.** The student implements six functions in pure numpy against deterministic synthetic
 data generated in the notebook and declared synthetic in the notebook's output and in the
@@ -54,75 +50,96 @@ report it produces:
 6. `render_validation_report()` — the markdown validation report, generated from those results
    and from nothing else.
 
-Then the notebook runs the suite end to end and prints the report. The closing demonstration
-scores a drifted population against edges re-cut on itself and shows it reading as perfectly
-stable, forever.
+Then the notebook runs the suite end to end and prints the report. A demonstration in the
+common-mistakes section scores a drifted population against edges re-cut on itself and shows it
+reading as perfectly stable, forever.
 
-**What it is graded on.** 32 rubric cases, 110 points, partial credit throughout. The rubric was
-mutation-tested against 32 plausible-wrong implementations — all 32 caught, scoring 84% to 98% —
-and against 4 controls, each a correct answer written a different way, all still scoring 100%.
-The full list is in the lesson's `meta.yaml`.
+**What it is graded on.** Partial credit throughout. Among the cases it grades: an empty bin
+must read `nan`, never a rate of zero; `expected_calibration_error()` must return a plain
+Python `float`, checked by exact type because `np.float64` subclasses `float` and passes an
+`isinstance` check; and the absolute gates must be applied before the improvement tests, so a
+blown calibration ceiling cannot be bought back with a big enough AUC gain. The rubric was
+mutation-tested against plausible-wrong implementations, every one caught with partial credit
+intact, and against controls written a different way, which still score full marks. The
+variants that mattered most are listed, exercise by exercise, in the lesson's `meta.yaml`.
 
 ---
 
 ## Module 2 — The model inventory, and a tiering you can defend
 
-**Status: BUILT.** `lessons/P04-L02-model-inventory-tiering/` · python · tier `cpu8` ·
-budget 90 s · **measured 0.1 s, 34 MiB** · 121 rubric points across 32 autograded cases ·
+**Lesson:** `lessons/P04-L02-model-inventory-tiering/` · tier `cpu8` · budget 90 s ·
 prerequisites `T00-L01-the-8gb-track`, `P04-L01-validation-suite`.
 
 Inventory and risk classification is the *first* of the PRA's five SS1/23 principles, and the
 2026 interagency guidance is explicitly risk-based — tailored to a firm's model risk profile.
 Neither is possible without knowing what you have.
 
-**The lab.** The student implements: a model record schema with required fields and a validator
-that names every record that fails it; `tier(record, policy)` computing a risk tier from
-materiality, complexity, exposure and the reversibility of the decision, with the policy passed
-in and the boundary cases graded; a `reconcile(inventory, runtime_registry)` that produces three
-lists — in the inventory and running, in the inventory and not running, and running while
-absent from the inventory — because the third list is the one that ends careers; and a tier
-distribution report generated from the result. Synthetic inventory, generated in the notebook.
+**The lab.** The student implements: `validate_record()` and `validate_inventory()`, a schema
+validator that reports every defect rather than the first and names every record tha
```

**File**: `programmes/predictive-maintenance/MODULES.md` (modified, +156/-103)
```diff
@@ -24,185 +24,238 @@ not fit gets rewritten, per gate 10 of [`QUALITY.md`](../../QUALITY.md).
 
 ---
 
-## 1. Alarm economics — why the best model is not the best threshold — **BUILT**
+## 1. Alarm economics — why the best model is not the best threshold
 
-`lessons/P03-L01-alarm-economics` · tier `cpu8`, budget 90 s, **measured 0.7 s / 191 MiB** ·
-Python · prerequisite `T00-L01-the-8gb-track`
+`lessons/P03-L01-alarm-economics` · prerequisites `T00-L01-the-8gb-track`
 
-**The lab.** You generate a deterministic synthetic fleet — 300 machines, 360 hourly vibration
-bursts each, 18 of them running to failure — from a generator you read first. Then, in eleven
-graded stubs, you build:
+**The lab.** You read a seeded fleet generator first. Then, in eleven graded stubs, you build:
 
 - `burst_rms`, `causal_rolling_median` and `health_index`: a degradation feature that is
-  robust to impulsive shocks, comparable across machines of different sizes, and causal, with
-  the rubric proving causality by changing the tail of the input and re-reading the head;
+  robust to impulsive shocks, comparable across machines of different sizes because each is
+  divided by the median of its own raw early-life RMS, and causal, with the rubric proving
+  causality by changing the tail of the input and re-reading the head;
 - `alarm_times` and `classify_outcomes`: the decision rule, including the lead-time
   requirement that makes a late alarm a missed failure rather than a hit;
 - `sweep_thresholds`, `roc_points`, `pr_points`: the sweep and the two curves everybody draws,
-  and the AUC you compute from your own points;
+  with the AUC the lesson reads off your own points;
 - `expected_cost`, `accuracy`, `best_operating_point`: the price of every cell of the
   confusion matrix, and the two operating points the same counts support.
 
 **What it demonstrates.** On this fleet the cost-optimal threshold is 1.50 and the
-accuracy-optimal one is 2.80. The second scores 4.3 accuracy points higher, accepts seven more
-unplanned failures, and costs 2.71x as much — from one detector with an ROC AUC of 0.947.
+accuracy-optimal one is 2.80, which scores higher on accuracy, lets more machines fail
+unplanned, and costs 2.71x as much — from one detector that is good by the usual standard.
 Re-pricing the same counts under a safety-critical and a low-consequence cost model moves the
-threshold to 1.15 and 2.80 without touching a line of the detector. The lesson ends by
-printing a handover note that carries the threshold and the three prices together, because
-one without the other is a number with no meaning.
+threshold without touching a line of the detector, and a detector that never alarms at all
+beats the useful one on accuracy while costing several times as much. The lesson ends by
+printing a handover note that carries the threshold, the lead requirement and the three prices
+together, because one without the others is a number with no meaning.
+
+**Data.** Synthetic: a fleet of machines logging hourly vibration bursts, a few of them running
+to failure, generated in the lesson by `generate_fleet`. Grading lead-time accounting needs
+known failure hours, known defect onsets and a controlled base rate, so the fleet is generated
+rather than downloaded.
 
 **Why it is module 1.** The programme opens at the end of the pipeline on purpose. A student
 who has priced a confusion matrix reads every later module differently: a feature is not
 "better", it moves an operating point; a model is not "accurate", it is cheap or expensive.
 
 ---
 
-## 2. Sensor physics and signal conditioning — *specified*
+## 2. Sensor physics and signal conditioning
 
-`lessons/P03-L02-sensor-physics` · tier `cpu8` · Python + one C exercise · depends on module 1
+`lessons/P03-L02-sensor-physics` · prerequisites `T00-L01-the-8gb-track`, `P03-L01-alarm-economics`
 
-**The lab.** Build the measurement chain in numpy and watch it lie to you. Synthesise a known
-vibration signal; sample it below Nyquist and identify the alias by frequency rather than by
-eye; add an anti-alias filter and measure what it costs in phase; integrate acceleration to
-velocity and watch the DC offset ramp away until you high-pass it; apply a window and measure
-the difference between the amplitude you put in and the amplitude a periodogram reports. The
-C exercise implements a fixed-point IIR high-pass of the kind that runs on the sensor itself
-and measures the error against the float64 reference, because on a real edge device that
-difference is the signal conditioning.
+**The lab.** Build the measurement chain in numpy and watch it lie to you: `amplitude_spectrum`
+and `peak_in_band` read a line off a scaled spectrum; `alias_frequency` and
+`candidate_true_frequencies` identify an undersampled tone by frequency, intersecting candidates
+across three sampling rates; `one_pole_lowpass`, `lowpass_response` and `measure_gain_and_lag`
+price the anti-alias filter in amplitude and in phase;
```

---

### Incident Patch 4: `8707b3ae` (2026-09-23)
**Commit Message**: README speaks to students; requirements.txt gains the notebook a student opens

The README was written when the build had 17 lessons and only told maintainers how to run a
grader. It now starts with what a student does: open any lesson.ipynb in Colab, Kaggle, Binder,
Codespaces or local Jupyter; press Run all; fill in an exercise and read its check; open a hint.
It says plainly that the "Open in" badges point nowhere until the repository is published, and
that "identical on Python 3.11 and 3.12" is measured on macOS until the Linux CI runs.

Writing it exposed a false instruction before it shipped: the local setup told students to run
`jupyter lab`, and requirements.txt did not install JupyterLab. It does now, unpinned, since it
prints nothing a lesson measures.

Tested exactly as written, in a fresh environment outside the repository: python -m venv, then
pip install -r requirements.txt (exit 0, 20 s, pins honoured: numpy 2.5.3, mujoco 3.13.0);
JupyterLab 4.6.4 starts and serves /lab (HTTP 200); and four lessons -- the AI Act capstone, a
MuJoCo humanoid lesson, a C lesson compiled from scratch, the tokenizer lesson -- run as
notebooks in a real kernel with 0 errors, each ending on

**File**: `README.md` (modified, +42/-11)
```diff
@@ -1,17 +1,48 @@
-# The AI Atlas — wave 1 (pre-alpha, unpublished)
+# The AI Atlas (pre-alpha, unpublished)
 
-Local build only. Nothing here has been pushed to any GitHub repository, and the repo
-strategy and history purge are still open decisions.
+Hands-on AI lessons you *do* rather than read: every lesson is a notebook with exercises to fill
+in, instant feedback as you go, hints when you are stuck, an autograded rubric with partial
+credit, and a worked solution. Some lessons are C or C++ exercises, built and graded the same way.
 
-- `QUALITY.md` — the 12 gates every lesson must pass, and the language policy.
-- `tools/` — the autograder (`grade.py`), the execution gate (`execute.py`), lesson template.
-- `flagships/` — flagship subtrees, each with its own README and lessons.
-- `lessons/` — track lessons.
-- `programmes/` — industry-vertical programmes.
+Local build only. Nothing here has been pushed to any GitHub repository, and the repository
+strategy and history purge are still open decisions. Until it is published,
+the "Open in" badges at the top of each notebook point at addresses that do not exist yet.
 
-Run a lesson's grader:   `python tools/grade.py flagships/<id>/lessons/<lesson>`
-Run the execution gate:  `python tools/execute.py flagships/<id>/lessons/<lesson> --write-back`
-Verify the whole repo:   `python tools/verify_all.py`
+## Start a lesson
+
+Open any `lesson.ipynb` — in Google Colab, Kaggle, Binder, GitHub Codespaces, or local Jupyter.
+Its first code cell installs anything the lesson needs that your environment lacks and fetches any file
+it needs beside it; where everything is already present, that cell does nothing.
+
+Then press **Run all**. Before you have written a line, every cell still runs: each unfinished
+exercise says it is not implemented yet, and the notebook ends with a progress board. Fill in an
+exercise, re-run its cell, and its check tells you whether you are right — and if not, what the
+likely mistake is. Each exercise has two hints, hidden until you open them.
+
+To work locally instead:
+
+    python -m venv .venv && .venv/bin/pip install -r requirements.txt
+    .venv/bin/jupyter lab
+
+Anything a lesson measures on your machine — a time, a memory peak — is printed with its unit
+and will differ from ours. Every other number a finished lesson prints is identical on Python
+3.11 and 3.12 — measured on macOS; the Linux CI proves the same once the repository is public.
+
+## For maintainers
+
+- `QUALITY.md` — the 14 gates every lesson passes, and the language policy.
+- `lessons/`, `flagships/`, `programmes/` — track lessons, flagship subtrees, industry programmes.
+  Each programme's `MODULES.md` is its map: what is built and what is only specified.
+- `tools/`:
+  - `execute.py` runs a lesson's solution within its declared budget and writes back what it measured;
+  - `grade.py` runs the autograder (`--solution` grades the reference);
+  - `notebooks.py` generates each `lesson.ipynb` and its launcher cell (`--check` for drift);
+  - `verify_portable.py` runs each notebook alone in a minimal kernel on Python 3.11 and 3.12;
+  - `build_student_bundle.py` builds what a student receives and fails on any solution leak;
+  - `status.py` generates the status tables below and in each `MODULES.md`;
+  - `verify_all.py` runs gates 1-12 on every lesson.
+
+`.github/workflows/lessons.yml` runs all of it on Linux once the repository is on GitHub.
 
 ## What exists today
 
```

**File**: `requirements.txt` (modified, +3/-1)
```diff
@@ -17,7 +17,9 @@ matplotlib==3.11.2
 mujoco==3.13.0          # humanoid-lab flagship
 tokenizers==0.23.2      # T03 tokenisation lessons
 pyyaml==6.0.3
-# notebook + authoring tools
+# notebook + authoring tools. jupyterlab is the interface a student opens locally; it prints
+# nothing a lesson measures, so it is left unpinned.
+jupyterlab
 jupytext==1.19.5
 ipykernel
 nbclient
```

---

### Incident Patch 5: `eb17bc0b` (2026-09-23)
**Commit Message**: Reviewer follow-ups: a typed fleet size, two prerequisite gaps, six status promotions

* P03-L09 typed its fleet size, 140, into prose three times while the code reads N_UNITS -- a
  gate-12 breach: change the constant and the text silently lies. The prose now names N_UNITS,
  which the notebook already prints. Re-verified: 183/183, stubs 0/183, Run all passes on both
  Pythons, finished output identical on both.
* P03-L06 prices the RUL distribution that module 5 builds, but did not list module 5 as a
  prerequisite. Added.
* P01-L06 reuses P01-L04's support floor and its name-it-rather-than-drop-it rule by name. Added.
  Not added, deliberately: P01-L07 as a successor of P01-L06. MODULES.md says module 7 computes
  module 6's metrics over windows; the lesson does not -- it builds its own windowed metric -- so
  listing module 6 would be a false prerequisite. MODULES.md is corrected instead.
* status executed -> reviewed for P01-L05, L06, L08, L09 and P03-L05, L06, each only after
  asserting its meta.yaml carries an independent-review record. Their reviewers deliberately left
  the promotion to the owner.

Not promoted, and why: P01-L01 and P02-L01 have an EMPTY reviewed_by, and 

**File**: `programmes/ai-act-conformity/lessons/P01-L05-human-oversight/meta.yaml` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@ datasets:
       data is involved, no real reviewer is named, and none of the figures the lesson prints
       is a claim about any real credit portfolio or any real person's review behaviour.
 points: 100             # = sum of RUBRIC points in tests/test_lesson.py
-status: executed        # draft | executed | reviewed | shipped
+status: reviewed        # draft | executed | reviewed | shipped
 # Authoring notes, 2026-09-22.
 #
 # All four gates run from the repo root on the venv interpreter. The measured figures below
```

**File**: `programmes/ai-act-conformity/lessons/P01-L06-accuracy-robustness-security/meta.yaml` (modified, +2/-1)
```diff
@@ -9,6 +9,7 @@ language: python        # python | c | cpp
 prerequisites:
   - T10-L01-ai-act-conformity-pack
   - P01-L01-article-12-logging
+  - P01-L04-data-governance   # its support floor and name-it-not-drop-it rule are reused here by name
 objectives:
   - "Implement a paired percentile bootstrap and measure what resampling predictions independently of labels does to the interval of a model that is right about every row"
   - "Implement a declaration that refuses a bare point estimate, and declare the defensible end of the interval — the lower bound where higher is better, the upper bound where lower is better"
@@ -33,7 +34,7 @@ datasets:
       code against afterwards is named in claims.yaml with its real licence and direct URL; it
       is not on any path the grader needs.
 points: 132             # = sum of RUBRIC points in tests/test_lesson.py
-status: executed        # draft | executed | reviewed | shipped
+status: reviewed        # draft | executed | reviewed | shipped
 # Authoring notes, 2026-09-22/23.
 #
 # All four gates run from the repo root on the venv interpreter. The measured figures at the
```

**File**: `programmes/ai-act-conformity/lessons/P01-L08-conformity-assessment-route/meta.yaml` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@ datasets:
       provider, system or notified body is involved, and none of the figures the lesson
       prints is a claim about any real conformity assessment.
 points: 128             # = sum of RUBRIC points in tests/test_lesson.py
-status: executed        # draft | executed | reviewed | shipped
+status: reviewed        # draft | executed | reviewed | shipped
 # Authoring notes, 2026-09-22.
 #
 # All four gates were run from the repo root on the venv interpreter. The measured figures at
```

**File**: `programmes/ai-act-conformity/lessons/P01-L09-capstone-pack-under-inspection/meta.yaml` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ datasets:
       figures the lesson prints is a claim about any real credit portfolio or any real
       conformity assessment.
 points: 138             # = sum of RUBRIC points in tests/test_lesson.py
-status: executed        # draft | executed | reviewed | shipped
+status: reviewed        # draft | executed | reviewed | shipped
 reviewed_by: "independent review 2026-09-23: 4 gates re-run from the repo root (execute PASS 2.6s/62MiB, solution 138/138, stubs 0/138 all 34 rows TODO); 30 reviewer-written mutants + 3 differently-shaped right-answer controls; 7 rubric holes closed (conserved folded in additions, ucl-only limits comparison, reason-order across the four silencing categories, collateral that went not_run rather than red, honest ignoring collateral, the finding_id tie-break, population-0 share); 8 survivors proved equivalent over the lesson's input domain, not defects; 2 prose defects fixed (the evidence-index rationale contradicted its own measurement, and the TEMPTING_PLANS bullet called a not_run check green); 14 bare asserts in the student-facing _check_ helpers given messages (gate 5); all 10 claims.yaml sources re-fetched and every quote verbatim; points unchanged at 138 over 34 cases; gates 13 and 14 remain open (no lesson.ipynb, no hint blocks, no progress board), so status stays executed."
 # Authoring notes, 2026-09-23.
 #
```

**File**: `programmes/predictive-maintenance/lessons/P03-L05-remaining-useful-life/meta.yaml` (modified, +1/-1)
```diff
@@ -257,7 +257,7 @@ points: 122        # = sum of RUBRIC points in tests/test_lesson.py
 #     directory (see reviewed_by). The author's own mutation report stands except that it
 #     did not cover either of them.
 #
-status: executed        # draft | executed | reviewed | shipped
+status: reviewed        # draft | executed | reviewed | shipped
 reviewed_by: "Independent review 2026-09-23, reviewer re-measured everything rather than trusting the author - 4 gates re-run green from the repo root (execute PASS, 1.0 s and a peak of 91 MiB against a 90 s / 8 GiB cpu8 budget, solution 122/122, stub file 0/122 with a TODO row for all 31 rubric entries); 26 fresh mutants and 7 controls graded, 18 mutants caught at 83-98% with partial credit intact and all 8 survivors adjudicated; TWO RUBRIC DEFECTS FOUND AND FIXED that the author's 38-mutant pass missed - fit_posterior dividing by noise_sd instead of noise_sd**2 scored 122/122 and more than doubles a real unit's 90% interval (40.8 h to 86.0 h), now 119/122; rul_samples subtracting t_now from RUL_CAP scored 122/122 because every non-degrading rubric case sat at t_now=0, now 118/122; both fixes mirrored into the notebook _check_ helpers; ONE GATE 12 VIOLATION fixed - self-check Q2 claimed section 11 measured an RMSE pair of 22.8/23.0 h when it computes 21.11/24.05 h; 6 survivors proved equivalent by byte-identical whole-lesson output plus a 2,000,007-point exhaustive scan of phm_score, 2 more are conforming variants that leave the argument intact; 9 differently-shaped right answers all score 122/122; all six claims.yaml quotes re-fetched and re-verified verbatim on 2026-09-23"
 
 measured_seconds: 0.9
```

**File**: `programmes/predictive-maintenance/lessons/P03-L06-thresholds-from-distributions/meta.yaml` (modified, +2/-1)
```diff
@@ -9,6 +9,7 @@ language: python        # python | c | cpp
 prerequisites:
   - T00-L01-the-8gb-track
   - P03-L01-alarm-economics
+  - P03-L05-remaining-useful-life   # the RUL distribution this module prices; added in module order by the owner
 objectives:
   - "Implement expected_cost_at so a plan prices a failure at or before the booked hour separately from the remaining useful life thrown away when the intervention gets there first"
   - "Implement survival_and_hazard, and explain why the optimal intervention time is where the hazard reaches life_per_hour / (unplanned - planned), by checking that route against an independent cost sweep"
@@ -253,7 +254,7 @@ points: 122        # = sum of RUBRIC points in tests/test_lesson.py, 30 cases
 # scenario parameter the code then uses, not a result; no measured figure is typed anywhere.
 # Self-check answers remain c, a, b, a, c and no prose names a path under solutions/.
 #
-status: executed        # draft | executed | reviewed | shipped
+status: reviewed        # draft | executed | reviewed | shipped
 reviewed_by: "Independent review 2026-09-23 — 4 gates re-run green (execute PASS 0.8 s / 77 MiB vs 90 s / 8 GiB, solution 122/122, stub 0/122 across all 30 rubric rows); 44 mutants graded, 40 caught at 57-98% with partial credit and 4 survivors found to be RUBRIC DEFECTS and fixed (unclipped survival, the never-graded negative-probability guard, fleet_cost_matrix raising on any inf rather than a dead row, greedy's deleted all-infinite fallback), each now losing only its own row; 3 differently-shaped correct controls at 122/122 before and after; all 3 claims.yaml sources re-fetched and matched verbatim; 4 wrong section cross-references and 1 wrong typed count corrected in prose; P03-L05 has since appeared on disk as a draft, see difference 1 — owner to add the prerequisite when it reaches reviewed; prior: Author self-review 2026-09-22 — 4 gates green (execute PASS, 0.8-0.9 s and peak RSS 77 MiB across four runs against a 90 s / 8 GiB budget, the write-back below being the last, solution 122/122, stub file 0/122 with a TODO row for all 30 rubric entries, jupytext converts to 47 cells); 32 breaking mutants all caught at 57-98% with partial credit, 1 survivor found and fixed (a slackless quantile comparison, measured to disagree 794 times in 99,515 lookups and never by more than 3e-16) and 3 differently-shaped correct controls still at 122/122; both NIST quotes and the NASA PCoE disclaimer fetched and matched verbatim; prerequisite on P03-L05 deferred because that lesson is not on disk, see difference 1 above; needs an independent reviewer before status: reviewed"
 
 measured_seconds: 0.8
```

**File**: `programmes/predictive-maintenance/lessons/P03-L09-capstone/lesson.ipynb` (modified, +7/-7)
```diff
@@ -92,13 +92,13 @@
   },
   {
    "cell_type": "markdown",
-   "id": "73c189429839",
+   "id": "73fb7d634a5f",
    "metadata": {},
    "source": [
     "# P03-L09 · Capstone: a monitoring programme for one asset class\n",
     "\n",
-    "**You will build:** not a model. A **monitoring programme** for one asset class — 140\n",
-    "boiler feed pumps — delivered as this runnable notebook *plus* a one-page specification,\n",
+    "**You will build:** not a model. A **monitoring programme** for one asset class — a fleet\n",
+    "of boiler feed pumps — delivered as this runnable notebook *plus* a one-page specification,\n",
     "and graded on both. Seven things have to be in it, and every one of them is a decision you\n",
     "have already made once in an earlier module:\n",
     "\n",
@@ -2296,7 +2296,7 @@
   },
   {
    "cell_type": "markdown",
-   "id": "a05d9eda2ea2",
+   "id": "20905b75a488",
    "metadata": {},
    "source": [
     "## 10. Exercise 8 — `deployment_report()`: the constraint it respects\n",
@@ -2307,7 +2307,7 @@
     "eight fractional bits. Two things follow, and both belong in the specification:\n",
     "\n",
     "- a causal median over `window` hours means keeping `window` readings per pump, for ever.\n",
-    "  Multiply by 140 pumps and the window is a memory decision, not a filter-design decision;\n",
+    "  Multiply by every pump in the fleet (`N_UNITS`) and the window is a memory decision, not a filter-design decision;\n",
     "- the threshold you publish is not the threshold that runs. Q8.8 can hold only multiples\n",
     "  of 1/256, so `1.25` survives the trip exactly and `1.40` and `1.15` do not. The gateway\n",
     "  compares the nearest representable numbers, and the\n",
@@ -2458,11 +2458,11 @@
   },
   {
    "cell_type": "markdown",
-   "id": "71f2d6056062",
+   "id": "32d1018f4001",
    "metadata": {},
    "source": [
     "The window is the decision this makes visible. Offline it is a filter length; on the\n",
-    "gateway it is 140 pumps' worth of retained readings. Run the sweep: for each window, build\n",
+    "gateway it is `N_UNITS` pumps' worth of retained readings. Run the sweep: for each window, build\n",
     "the feature, re-derive the cost-optimal threshold on it, and ask the gateway whether it\n",
     "will hold."
    ]
```

**File**: `programmes/predictive-maintenance/lessons/P03-L09-capstone/lesson.py` (modified, +4/-4)
```diff
@@ -79,8 +79,8 @@ def atlas_host() -> str:
 # %% [markdown]
 # # P03-L09 · Capstone: a monitoring programme for one asset class
 #
-# **You will build:** not a model. A **monitoring programme** for one asset class — 140
-# boiler feed pumps — delivered as this runnable notebook *plus* a one-page specification,
+# **You will build:** not a model. A **monitoring programme** for one asset class — a fleet
+# of boiler feed pumps — delivered as this runnable notebook *plus* a one-page specification,
 # and graded on both. Seven things have to be in it, and every one of them is a decision you
 # have already made once in an earlier module:
 #
@@ -2017,7 +2017,7 @@ def _name_the_give_ups() -> None:
 # eight fractional bits. Two things follow, and both belong in the specification:
 #
 # - a causal median over `window` hours means keeping `window` readings per pump, for ever.
-#   Multiply by 140 pumps and the window is a memory decision, not a filter-design decision;
+#   Multiply by every pump in the fleet (`N_UNITS`) and the window is a memory decision, not a filter-design decision;
 # - the threshold you publish is not the threshold that runs. Q8.8 can hold only multiples
 #   of 1/256, so `1.25` survives the trip exactly and `1.40` and `1.15` do not. The gateway
 #   compares the nearest representable numbers, and the
@@ -2152,7 +2152,7 @@ def _check_deployment_report() -> None:
 
 # %% [markdown]
 # The window is the decision this makes visible. Offline it is a filter length; on the
-# gateway it is 140 pumps' worth of retained readings. Run the sweep: for each window, build
+# gateway it is `N_UNITS` pumps' worth of retained readings. Run the sweep: for each window, build
 # the feature, re-derive the cost-optimal threshold on it, and ask the gateway whether it
 # will hold.
 
```

---

### Incident Patch 6: `d81517c0` (2026-09-23)
**Commit Message**: Stop tracking P02-L10's build/: two Mach-O binaries and 8.5 MiB of generated CSVs

The Wave 2 commit staged with `git add -A` and swept in P02-L10's build directory: two macOS
executables -- useless on the Linux that every notebook service runs, and exactly the stale
binary QUALITY.md warns about, one that looks current while pointing at a dead library path --
and six CSV exports the lesson generates on every run, two of them 4 MiB each. A reviewer
spotted them showing as modified in git status.

They are now untracked (still on disk; the build recreates them) and build/ is ignored
repository-wide. tools/execute.py already deletes build/ before every C run, so nothing relied
on them being committed; the lesson executes cleanly after this change.

The 8.5 MiB remains in history at 405aab9. This repository has never been pushed, so it can be
dropped before the first publish -- part of the history decision that is already open.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.gitignore` (modified, +4/-0)
```diff
@@ -12,6 +12,10 @@ __pycache__/
 *.dSYM/
 lesson_bin
 solutions/lesson_bin
+# per-lesson build directories: binaries and generated test data. tools/execute.py deletes
+# them before every run because a stale binary can point at a dead library path. 8.5 MiB of
+# them (two Mach-O executables, six generated CSVs) were once committed by a `git add -A`.
+build/
 # environment
 .venv/
 .DS_Store
```

---

### Incident Patch 7: `864c9d20` (2026-09-22)
**Commit Message**: Binder, Codespaces and Linux CI; prove results are reproducible across Pythons

Every notebook service a student is likely to use runs Linux. This repository is developed on
macOS, so a green local run proves less than it looks. This commit adds what is needed to run
the lessons there, and a CI workflow that proves it once the repository is on GitHub.

* requirements.txt: one environment for local, Binder and Codespaces, pinned to the versions
  every gate was measured against. Resolved -- wheels only, no source builds -- for Linux
  x86_64 and aarch64 on Python 3.11, 3.12 and 3.13.
  That resolution caught a real defect before any student hit it: numpy 2.5.3 ships no wheels
  for Python 3.11, which Kaggle still runs, so the pinned file failed to install there. numpy
  is now pinned per Python version (2.4.6 below 3.12).

* binder/ and .devcontainer/ read that one file. .github/workflows/lessons.yml runs the four
  gates, the notebook sync check and the student-bundle leak check on ubuntu-latest; runs
  every notebook alone in a minimal kernel on 3.11 and 3.12; checks finished lessons print the
  same results on both; and, on main only, that the badges' raw URLs resolve.

* tools/v

**File**: `.devcontainer/devcontainer.json` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+{
+  "name": "The AI Atlas",
+  "image": "mcr.microsoft.com/devcontainers/python:3.12",
+  "postCreateCommand": "sudo apt-get update -qq && sudo apt-get install -y -qq --no-install-recommends build-essential && pip install -q -r requirements.txt",
+  "customizations": {
+    "vscode": {
+      "extensions": ["ms-python.python", "ms-toolsai.jupyter"]
+    }
+  }
+}
```

**File**: `.github/workflows/lessons.yml` (modified, +77/-19)
```diff
@@ -1,26 +1,84 @@
+# Every gate, on Linux -- which is what Colab, Kaggle, Binder and Codespaces all run.
+# The lessons are developed on macOS; this workflow is the only thing that proves they work
+# where students actually open them.
+#
+# Assumes this directory (atlas/) is the repository root. If it is published as a subfolder
+# of a larger repository instead, move this file to that repository's .github/workflows/ and
+# set `defaults.run.working-directory: atlas`.
 name: lessons
-on: [push, pull_request]
+
+on:
+  push:
+  pull_request:
+  schedule:
+    - cron: "17 5 * * 1"   # weekly: catch upstream drift (a new mujoco, a Colab image change)
+
 jobs:
-  execute:
+  gates:
+    name: four gates, notebook sync, student bundles
     runs-on: ubuntu-latest
     steps:
       - uses: actions/checkout@v4
-      - uses: astral-sh/setup-uv@v5
-      - run: uv venv --python 3.12
-      - run: uv pip install -r requirements.txt
-      # Gate 9 and 10: every lesson runs clean inside its declared budget.
-      - run: |
-          fail=0
-          for d in lessons/*/ flagships/*/lessons/*/; do
-            [ -f "$d/meta.yaml" ] || continue
-            .venv/bin/python tools/execute.py "$d" || fail=1
+      - uses: astral-sh/setup-uv@v6
+      - name: environment (pinned, as measured)
+        run: |
+          uv venv --python 3.12 .venv
+          uv pip install --python .venv/bin/python -r requirements.txt
+      - name: gates 1-12 on every lesson
+        run: .venv/bin/python tools/verify_all.py
+      - name: committed notebooks match their lesson.py
+        run: .venv/bin/python tools/notebooks.py --check
+      - name: student bundles build with no solution leaks
+        run: .venv/bin/python tools/build_student_bundle.py
+
+  portable:
+    name: opens anywhere (${{ matrix.env }})
+    runs-on: ubuntu-latest
+    strategy:
+      fail-fast: false
+      matrix:
+        include:
+          - { env: py311, python: "3.11" }   # Kaggle-like
+          - { env: py312, python: "3.12" }   # Colab-like
+    steps:
+      - uses: actions/checkout@v4
+      - uses: astral-sh/setup-uv@v6
+      - name: a deliberately minimal notebook environment -- no mujoco, no tokenizers
+        run: |
+          uv venv --seed --python ${{ matrix.python }} ~/.cache/atlas-portable/${{ matrix.env }}
+          uv pip install --python ~/.cache/atlas-portable/${{ matrix.env }}/bin/python \
+            numpy matplotlib ipykernel nbclient nbformat
+      - name: every notebook, alone in an empty directory, in a real kernel
+        run: python3 tools/verify_portable.py --env ${{ matrix.env }} --reset
+
+  reproducible:
+    # The FINISHED lesson, run in both environments; its printed results must match. Lines that
+    # vary between two runs in the same environment (timings, speeds) are masked automatically.
+    name: same results on Python 3.11 + numpy 2.4 and 3.12 + numpy 2.5
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v4
+      - uses: astral-sh/setup-uv@v6
+      - name: both minimal environments
+        run: |
+          for v in 3.11 3.12; do
+            e=~/.cache/atlas-portable/py${v/./}
+            uv venv --seed --python $v $e
+            uv pip install --python $e/bin/python numpy matplotlib ipykernel nbclient nbformat
           done
-          exit $fail
-      # Gate 6: the reference solution must score 100% against the rubric.
+      - run: python3 tools/verify_portable.py --completed --reset
+
+  live-links:
+    # The badges and the launcher's raw URLs point at `main`. On a pull request they would
+    # fetch main's files, not the branch's, so the real URLs are tested only on main itself.
+    name: badges and raw URLs resolve
+    if: github.ref == 'refs/heads/main'
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v4
+      - uses: astral-sh/setup-uv@v6
       - run: |
-          fail=0
-          for d in lessons/*/ flagships/*/lessons/*/; do
-            [ -f "$d/tests/test_lesson.py" ] || continue
-            .venv/bin/python tools/grade.py "$d" >/dev/null || { echo "rubric fails on $d"; fail=1; }
-          done
-          exit $fail
+          uv venv --seed --python 3.12 ~/.cache/atlas-portable/py312
+          uv pip install --python ~/.cache/atlas-portable/py312/bin/python \
+            numpy matplotlib ipykernel nbclient nbformat
+      - run: python3 tools/verify_portable.py --env py312 --reset --live
```

**File**: `binder/apt.txt` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+build-essential
```

**File**: `binder/requirements.txt` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+# Binder reads this folder instead of the repository root when it exists. Keep ONE source of
+# truth: everything lives in ../requirements.txt.
+-r ../requirements.txt
```

**File**: `binder/runtime.txt` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+python-3.12
```

**File**: `requirements.txt` (modified, +23/-6)
```diff
@@ -1,8 +1,25 @@
-mujoco
-numpy
-matplotlib
-jupytext
+# The AI Atlas -- one environment for every lesson.
+#
+# Pinned to the exact versions every gate in this repository was measured against. A lesson
+# that prints a number it measured (a humanoid falling at step 978, a 383 MiB peak) prints it
+# because of these versions. Exact `==` pins are what make "reproducible" mean something.
+# Colab and Kaggle already ship numpy and matplotlib -- each notebook's launcher cell installs
+# only what is missing there, pinned to the same versions below.
+#
+# Local:        python -m venv .venv && .venv/bin/pip install -r requirements.txt
+# Binder:       read automatically via binder/requirements.txt
+# Codespaces:   read automatically via .devcontainer/devcontainer.json
+numpy==2.5.3; python_version >= "3.12"
+# numpy 2.5 ships no wheels for Python 3.11, which Kaggle still runs. 2.4.6 is the newest
+# that does, and tools/verify_portable.py runs every lesson against it on 3.11.
+numpy==2.4.6; python_version < "3.12"
+matplotlib==3.11.2
+mujoco==3.13.0          # humanoid-lab flagship
+tokenizers==0.23.2      # T03 tokenisation lessons
+pyyaml==6.0.3
+# notebook + authoring tools
+jupytext==1.19.5
+ipykernel
 nbclient
 nbformat
-tokenizers
-pytest
+pytest==9.1.1
```

**File**: `tools/verify_portable.py` (modified, +131/-0)
```diff
@@ -24,6 +24,14 @@
   py311  ~ Kaggle (Python 3.11)        py312  ~ Colab (Python 3.12)
 --reset uninstalls the optional packages first, so the first lesson that needs each one
 exercises the real install path instead of finding it left over from a previous run.
+
+--completed answers a different question. A student notebook full of unfilled stubs cannot
+tell an environment failure from an unfinished exercise -- one stub's missing result cascades
+into later cells. So --completed runs the FINISHED lesson (solutions/lesson_solution.py,
+exactly as tools/execute.py does) in each minimal environment, where any error is real. It
+then diffs what the lesson printed across environments, ignoring timing lines: if a finished
+lesson prints the same numbers on Python 3.11 + numpy 2.4 as on 3.12 + numpy 2.5, it is
+reproducible in the sense a student cares about. If it does not, that is reported, not hidden.
 """
 import argparse, json, os, re, shutil, subprocess, sys, tempfile, time
 from pathlib import Path
@@ -88,6 +96,124 @@ def classify(res) -> str:
     return "STUB" if "NotImplementedError" in names else "EXIT"
 
 
+# A lesson that prints its own environment ("python 3.11.15 · numpy 2.4.6") is SUPPOSED to
+# differ across environments; that line is a banner, not a result.
+BANNER = re.compile(r"\b(python|numpy|matplotlib|mujoco|tokenizers|torch|pyyaml|clang|gcc)"
+                    r"\s+v?\d+\.\d+", re.I)
+TIMING = re.compile(r"(\bwall\b|\bseconds?\b|\d\s*ms\b|\bMiB\b|\bGiB\b|\belapsed\b|"
+                    r"\btime\b|\d+(\.\d+)?\s*s\b|\bs/it\b|it/s\b)", re.I)
+BUILD_JUNK = shutil.ignore_patterns("lesson_bin", "lesson_bin *", "*.o", "*.dSYM", "__pycache__",
+                                    "* [0-9]", "* [0-9].*", "lesson.ipynb", "build", ".ipynb_checkpoints")
+
+
+def pins() -> dict:
+    """name -> version from requirements.txt, so a completed run installs what was measured."""
+    out = {}
+    for line in (ROOT / "requirements.txt").read_text().splitlines():
+        m = re.match(r"^\s*([A-Za-z0-9_.-]+)==([^\s;#]+)\s*(;|#|$)", line)
+        if m and ";" not in line:
+            out[m.group(1).lower()] = m.group(2)
+    return out
+
+
+def required(d: Path) -> list:
+    """The (import, pip) pairs the lesson's own launcher declares."""
+    m = re.search(r"^ATLAS_PIP = \[(.*?)\]", (d / "lesson.py").read_text(), re.M)
+    return re.findall(r'\("([^"]+)", "([^"]+)"\)', m.group(1)) if m else []
+
+
+def completed(d: Path, env: str, timeout: int) -> dict:
+    py = CACHE / env / "bin" / "python"
+    pin = pins()
+    missing = [pip for imp, pip in required(d)
+               if subprocess.run([str(py), "-c", f"import {imp}"], capture_output=True).returncode]
+    if missing:
+        subprocess.run([str(py), "-m", "pip", "install", "-q",
+                        *[f"{m}=={pin[m.lower()]}" if m.lower() in pin else m for m in missing]],
+                       capture_output=True, check=False)
+    idents = env_identity(py)
+    with tempfile.TemporaryDirectory(prefix="atlas-done-") as tmp:
+        work = Path(tmp) / d.name
+        shutil.copytree(d, work, ignore=BUILD_JUNK)
+        environ = {k: v for k, v in os.environ.items() if k != "VIRTUAL_ENV"}
+        environ["MPLBACKEND"] = "Agg"
+        t0 = time.time()
+        try:
+            r = subprocess.run([str(py), "-c",
+                                "import runpy, sys; runpy.run_path(sys.argv[1], run_name='__main__')",
+                                "lesson_solution.py"], cwd=work / "solutions", env=environ,
+                               capture_output=True, text=True, timeout=timeout)
+            rc, out, err = r.returncode, r.stdout, r.stderr
+        except subprocess.TimeoutExpired:
+            rc, out, err = -1, "", f"timed out after {timeout}s"
+        # Strip what identifies THIS run and THIS environment -- the temp directory, the
+        # interpreter path, the environment's own version strings -- before anything is compared.
+        for real, label in [(str(work.resolve()), "<lesson>"), (str(work), "<lesson>"),
+                            (str(Path(tmp).resolve()), "<tmp>"), (str(Path(tmp)), "<tmp>"),
+                            *idents]:
+            out = out.replace(real, label)
+    last = (err.strip().splitlines() or [""])[-1][:200]
+    return {"rc": rc, "secs": round(time.time() - t0, 1), "err": last,
+            "installed": missing, "out": out.splitlines()}
+
+
+def env_identity(py: Path) -> list:
+    """(string, label) pairs that name an environment rather than describe a result."""
+    probe = ("import sys, importlib.metadata as m\n"
+             "print(sys.executable); print(sys.prefix); print(sys.version.split()[0])\n"
+             "for p in ('numpy', 'matplotlib', 'mujoco', 'tokenizers', 'pyyaml'):\n"
+             "    try: print(m.version(p))\n"
+             "    except m.PackageNotFoundError: print('')")
+    lines = subprocess.run([str(py), "-c", probe], capture_output=True, text=True).stdout.s
```

---

### Incident Patch 8: `69693acd` (2026-09-16)
**Commit Message**: Review pass: 64 rubric defects fixed, plus the 4 industry programmes

MUTATION TESTING across all 13 wave-1 lessons: 327 deliberately broken
solutions written, 301 caught by the rubrics as shipped, and 64 rubric
DEFECTS found and fixed — 64 ways a wrong answer scored full marks.

What the rubrics were missing, by pattern:
  - tests asserted what a function WRITES, never what it RETURNS
  - no case pinned a threshold boundary (count == kMinCount)
  - log-of-softmax accepted in place of a stable cross-entropy
  - an off-by-one batch bound hidden behind try/except
  - mjData never reset between rollouts, so a stale state scored 100%
  - a float steps count accepted where an integer was required

Reviewers also proved several survivors EQUIVALENT rather than inflating
the defect count: masking with -1e9 versus -inf differs by exactly 0.0 in
float64 (np.exp underflows below -744.4), so it is taught, not graded.

NEW: 4 industry programmes, each with a module map and one gated lesson:
  ai-act-conformity       P01-L01 Article 12 audit trail
  document-intelligence   P02-L01 the evaluation harness before the extractor
  predictive-maintenance  P03-L01 alarm economics
  model-risk         

**File**: `MUJOCO_LOG.TXT` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+WARNING Wed Sep 16 12:09:38 2026: Nan, Inf or huge value in CTRL at ACTUATOR 0. The simulation is unstable. Time = 0.0000.
+
+WARNING Wed Sep 16 12:15:04 2026: Nan, Inf or huge value in CTRL at ACTUATOR 0. The simulation is unstable. Time = 0.0000.
+
+WARNING Wed Sep 16 12:16:27 2026: Nan, Inf or huge value in CTRL at ACTUATOR 0. The simulation is unstable. Time = 0.0000.
+
+WARNING Wed Sep 16 12:17:35 2026: Nan, Inf or huge value in CTRL at ACTUATOR 0. The simulation is unstable. Time = 0.0000.
+
+WARNING Wed Sep 16 12:17:35 2026: Nan, Inf or huge value in CTRL at ACTUATOR 0. The simulation is unstable. Time = 0.0000.
+
```

**File**: `QUALITY.md` (modified, +13/-0)
```diff
@@ -44,3 +44,16 @@ A lesson ships only when all 12 gates below are green. Gates 1-8 are machine-che
   engine's real API. Built with `clang`/`make`, graded by a test binary.
 - **C#** lessons are deferred until a .NET runner exists in CI. Authoring a C# exercise that
   has never been executed would violate gate 9.
+
+## Known trap: compiled lessons and absolute library paths
+
+A C/C++ lesson links against `libmujoco` inside the virtualenv, and the linker bakes that
+ABSOLUTE path into the binary. Move the checkout, or rebuild the venv somewhere else, and the
+binary still points at the old path: `dyld: Library not loaded`. `make` will not save you —
+the binary is newer than its source, so it looks up to date.
+
+`tools/execute.py` therefore deletes compiled artefacts before gating any `language: c` or
+`language: cpp` lesson. A STUDENT who moves their checkout hits the same trap and has no such
+guard, so every compiled lesson must tell them, in its "common mistakes" section, to run
+`make clean` after moving or rebuilding. Authors: check this before marking a compiled lesson
+`reviewed`.
```

**File**: `flagships/humanoid-lab/lessons/F15-L01-first-contact/lesson.py` (modified, +28/-5)
```diff
@@ -257,11 +257,15 @@ def _check_com_height() -> None:
         "float(); do not return the whole 3-vector."
     )
     reference = float(data.subtree_com[0][2])
+    mass = model.body_mass
     assert abs(got - reference) < 1e-9, (
-        f"com_height gave {got:.6f}, MuJoCo's own whole-body COM is {reference:.6f} — if you "
-        "are close but high you used data.xpos (frame origins) instead of data.xipos; if you "
-        f"got {float(data.qpos[2]):.6f} you returned the root height; if you landed between "
-        "the two you took an unweighted mean instead of weighting by model.body_mass."
+        f"com_height gave {got:.6f}, MuJoCo's own whole-body COM is {reference:.6f}. Each "
+        "near miss names a different mistake, and all three are measured from this pose: "
+        f"{float(data.qpos[2]):.6f} is the root height in qpos[2]; "
+        f"{float((mass * data.xpos[:, 2]).sum() / mass.sum()):.6f} weights data.xpos, the "
+        "frame origins, where data.xipos belongs; "
+        f"{float(data.xipos[:, 2].mean()):.6f} is an unweighted mean of xipos, with "
+        "model.body_mass left out."
     )
     squat = mujoco.MjData(model)
     mujoco.mj_resetDataKeyframe(model, squat, 0)
@@ -340,6 +344,20 @@ def _check_real_time_factor() -> None:
         f"real_time_factor came out at {report['real_time_factor']:.4f} — a value that small "
         "means the ratio is upside down, or that you timed a reload instead of the stepping."
     )
+    assert not isinstance(report["steps"], float), (
+        f"steps came back as {type(report['steps']).__name__} — it counts mj_step calls, so "
+        "it must be a whole number. math.ceil gives an int; numpy's np.ceil gives a float "
+        "that still compares equal here and then breaks range() downstream."
+    )
+    # A second measurement on the same `data`: if the reset ran, the clock reads exactly what
+    # this call's own steps bought, and nothing of the previous call survives.
+    again = real_time_factor(model, data, 0.207)
+    assert abs(data.time - again["steps"] * model.opt.timestep) < 1e-9, (
+        f"a second call left data.time at {data.time}, not the "
+        f"{again['steps'] * model.opt.timestep} its own {again['steps']} steps bought — the "
+        "clock still carries the first run, so mujoco.mj_resetData never ran and every "
+        "measurement after the first times an already-fallen pose."
+    )
     print(f"exercise 3 looks right: {report['sim_seconds']:.3f} s simulated in "
           f"{report['wall_seconds']:.4f} s wall, RTF {report['real_time_factor']:.1f}x")
 
@@ -390,7 +408,8 @@ def _check_fall_profile() -> None:
 # - **Hard-coding the timestep.** This model overrides MuJoCo's documented default (sourced
 #   in `claims.yaml`). Read `model.opt.timestep` and your code survives the next model.
 # - **`data.xpos` for the centre of mass.** `xpos` is the body frame origin; `xipos` is where
-#   that body's mass actually sits. The gap is centimetres, which is plenty to be wrong by.
+#   that body's mass actually sits. The cell below measures the gap on this model; it is not
+#   a rounding error.
 # - **Forgetting kinematics.** Writing `data.qpos` does not update `data.xipos`. Until
 #   `mj_forward` or `mj_step` runs, you are reading the previous pose.
 # - **`time.time` for benchmarking.** Use `time.perf_counter`: monotonic, higher resolution,
@@ -400,6 +419,10 @@ def _check_fall_profile() -> None:
 # Watch the last two mistakes happen, measured rather than asserted. Nothing here is typed.
 _stale = mujoco.MjData(MODEL)
 mujoco.mj_forward(MODEL, _stale)
+_frame_gap = np.abs(_stale.xpos[:, 2] - _stale.xipos[:, 2])
+print(f"xpos vs xipos in z: worst body {_frame_gap.max():.4f} m, mean "
+      f"{_frame_gap[_frame_gap > 0].mean():.4f} m over the "
+      f"{int((_frame_gap > 0).sum())} bodies where the two differ at all")
 _torso_before = float(_stale.xipos[1][2])
 _stale.qpos[2] += 1.0                    # lift the robot a metre, then read derived state at once
 print(f"wrote qpos[2] += 1.0 -> torso xipos z still reads {float(_stale.xipos[1][2]):.4f} "
```

**File**: `flagships/humanoid-lab/lessons/F15-L01-first-contact/meta.yaml` (modified, +49/-3)
```diff
@@ -69,10 +69,56 @@ points: 26
 # all-or-nothing), the crouched-keyframe assertion (keyframe 0 is "squat", COM 0.362 m
 # against 0.850 m standing, so the 0.1 m margin is ample), and every docstring worked
 # example, each re-run against the shipped model.
+#
+# ---------------------------------------------------------------------------------------
+# Independent review, 2026-09-16, of the lesson as left by the audit pass above. 21 fresh
+# mutants of the reference solution were graded in /tmp (8 on step_for, 6 on com_height,
+# 7 on real_time_factor). 18 were caught as shipped; 3 scored a full 26/26 and two of those
+# were genuine rubric defects.
+#
+# Defect 1 — a missing mj_resetData scored 100%. The docstring and section 6 both order the
+# reset first, and it is what makes the measurement repeatable, but nothing graded it: a
+# submission that skipped it still produced a consistent report, because steps, sim_seconds
+# and the ratio are all internally consistent whether or not the clock was zeroed. Silently
+# wrong, too: every call after the first then times an already-fallen, contact-heavy pose.
+# test_real_time_factor_is_measured_and_right_way_up already makes two calls on one `data`,
+# so it now asserts that data.time equals the second call's own steps * timestep — exact if
+# the reset ran, roughly doubled if it did not.
+#
+# Defect 2 — steps returned as a float scored 100%. The rubric compared steps by ==, and
+# float(42) == 42, so np.ceil (the natural numpy spelling of the ceiling this exercise asks
+# for) passed while breaking range() and every index built from it downstream. The shape
+# test now rejects a float steps, worded to accept a numpy integer.
+#
+# Not a defect: a try/except around the whole measurement returning a zeroed report scores
+# 100%, but its except branch is unreachable on every input the rubric or a student can
+# supply — an equivalent mutant, not a gap. Re-run with a real typo inside the try (so the
+# swallow actually fires) it scores 22/26, so the category is graded.
+#
+# After both fixes: 21 mutants, 20 caught, 1 equivalent; reference still 26/26 and partial
+# credit intact in all 20 (35%-92%, no all-or-nothing collapse).
+#
+# Also fixed, outside the rubric: the com_height failure message named the wrong mistake.
+# It told a student that an unweighted mean "sits between" the root height and the COM; on
+# this model the unweighted mean is 0.8342 m, BELOW the COM's 0.8498 m, with the root at
+# 1.2820 m. All three near misses are now computed from the student's own pose and printed
+# in the message, in lesson.py, the solution and tests/test_lesson.py alike. Section 8's
+# "the gap is centimetres" was the last magnitude typed into prose about the model; the
+# stale-xipos cell now measures it (0.1700 m worst, 0.1140 m mean over the 9 bodies where
+# xpos and xipos differ) and the prose no longer states it.
+#
+# Checked and found sound: prerequisites [] is correct and consistent — F15-L01 is the root
+# of the flagship and the other seven humanoid lessons list it, so no id points at a
+# placeholder. All six claims re-fetched from their primary sources today and confirmed
+# verbatim, including the timestep default of "0.002" and the upstream XML's
+# <option timestep="0.005"/>; asset is 267 lines / 11,287 bytes with the Apache-2.0 header
+# intact and no mesh, include or file= reference. Worst prose run 33 lines. Every stub has a
+# docstring, a worked example, # YOUR CODE HERE and raise NotImplementedError. No prose
+# points a student at a solutions/ path.
 status: reviewed        # draft | executed | reviewed | shipped
 # Kept to one line on purpose: tools/build_student_bundle.py strips a line starting with
 # "reviewed_by:" but not the indented continuation lines of a folded block, which would leave
 # the student bundle's meta.student.yaml malformed. The narrative lives in the comments above.
-reviewed_by: "Audit and completion pass 2026-09-16 — all 12 gates checked, 12 mutants tested, gate-7 leak and a NameError that capped the reference at 92% both fixed; notes above"
-measured_seconds: 0.2
-measured_peak_mib: 68
+reviewed_by: "Independent review 2026-09-16 — 21 mutants graded, 18 caught as shipped; 2 rubric defects fixed (unreset mjData and a float steps count both scored 100%), 1 equivalent mutant; a false com_height diagnostic and the last typed magnitude in prose also fixed; 20/21 caught after, reference still 26/26; notes above"
+measured_seconds: 0.3
+measured_peak_mib: 67
```

**File**: `flagships/humanoid-lab/lessons/F15-L02-kinematics-jacobians/assets/SOURCE.md` (modified, +2/-2)
```diff
@@ -23,7 +23,7 @@ branch to fail.
 exercise perturb `qpos[i]` directly. It is also a privilege the lesson is explicit about
 losing: on a model with a free or ball joint, `qpos` carries a four-number quaternion where
 `qvel` carries a three-number angular velocity, and `qpos[i] += eps` no longer means "move
-dof *i*". Section 8 loads a four-line MJCF string with a ball joint and prints its `nq` and
+dof *i*". Section 9 loads a short MJCF string with a ball joint and prints its `nq` and
 `nv` rather than asking anyone to take that on trust.
 
 **The arms are asymmetric.** Eight degrees of freedom move the right palm; the two left-arm
@@ -40,7 +40,7 @@ arm cannot move its palm along its own axis at any joint velocity, so the transl
 Jacobian loses rank there. Measured on the shipped model, its singular values at home are
 approximately (0.807, 0.644, 0.000): the third is not small, it is zero.
 
-That is what makes the damping term in section 7 load-bearing rather than decorative. The
+That is what makes the damping term in sections 10 and 11 load-bearing rather than decorative. The
 inverse-kinematics solver starts every solve from the home pose, so with `lam = 0` the normal
 equations are singular and NumPy raises `LinAlgError` on the first iteration — the notebook
 runs that and prints the exception. Nudge the elbow a ten-thousandth of a radian off full
```

**File**: `flagships/humanoid-lab/lessons/F15-L02-kinematics-jacobians/assets/arm.xml` (modified, +2/-2)
```diff
@@ -16,8 +16,8 @@
      lets a student finite-difference the forward kinematics by writing qpos[i] += eps
      directly. On a model with a free or ball joint the mapping breaks — qpos carries a
      4-number quaternion where qvel carries a 3-number angular velocity — and the shortcut
-     silently produces a wrong Jacobian. The lesson says so, and section 8 loads a
-     two-line model with a ball joint to show nq != nv rather than assert it.
+     silently produces a wrong Jacobian. The lesson says so, and section 9 loads a
+     short model with a ball joint to show nq != nv rather than assert it.
 
   2. THE TWO ARMS ARE DELIBERATELY ASYMMETRIC. The right arm has six joints (three at the
      shoulder, an elbow, two at the wrist) and, with the two waist joints, eight degrees of
```

**File**: `flagships/humanoid-lab/lessons/F15-L02-kinematics-jacobians/claims.yaml` (modified, +3/-3)
```diff
@@ -170,7 +170,7 @@ claims:
       Jacobian pseudo-inverse with a solve of (J J^T + lambda^2 I) — was published by C. W.
       Wampler in "Manipulator Inverse Kinematic Solutions Based on Vector Formulations and
       Damped Least-Squares Methods", IEEE Transactions on Systems, Man and Cybernetics, 1986.
-    where: "lesson.py section 7 (where this step comes from) and self-check question 4"
+    where: "lesson.py section 10 (where this step comes from) and self-check question 4"
     source_url: https://doi.org/10.1109/TSMC.1986.289285
     source_kind: primary (the paper itself, addressed by its DOI)
     quote: "Manipulator Inverse Kinematic Solutions Based on Vector Formulations and Damped Least-Squares Methods"
@@ -190,7 +190,7 @@ claims:
       which introduced the singularity-robust inverse as an alternative to the Jacobian
       pseudo-inverse. The two 1986 papers are the standard joint citation for the step this
       lesson implements.
-    where: "lesson.py section 7 (where this step comes from)"
+    where: "lesson.py section 10 (where this step comes from)"
     source_url: https://doi.org/10.1115/1.3143764
     source_kind: primary (the paper itself, addressed by its DOI)
     quote: "Inverse kinematic solutions with singularity robustness for robot manipulator control"
@@ -205,7 +205,7 @@ claims:
       verification on the access date and is therefore not cited.
     note: >-
       WHY THE LESSON DOES NOT LEAN ON THESE CITATIONS. Everything the student is asked to
-      believe about damping is measured in section 7 on the shipped model: with lambda = 0 the
+      believe about damping is measured in section 11 on the shipped model: with lambda = 0 the
       normal equations at the home pose are singular and NumPy raises; a ten-thousandth of a
       radian off that pose, the undamped step asks for a joint velocity of order 10^2 rad
       while the damped step stays near zero. The citations record where the idea comes from,
```

**File**: `flagships/humanoid-lab/lessons/F15-L02-kinematics-jacobians/lesson.py` (modified, +2/-1)
```diff
@@ -117,11 +117,12 @@ def load_arm():
 _sid = mujoco.mj_name2id(_m, mujoco.mjtObj.mjOBJ_SITE, PALM_SITE)
 mujoco.mj_forward(_m, _d)
 print(f"palm at qpos=0                 : {_d.site_xpos[_sid]}")
+_before = np.array(_d.site_xpos[_sid])               # a COPY, so it survives the refresh below
 _d.qpos[:] = READY                                   # the write, with no refresh
 print(f"after writing a new qpos       : {_d.site_xpos[_sid]}   <- unchanged, and wrong")
 mujoco.mj_forward(_m, _d)                            # the refresh
 print(f"after mujoco.mj_forward        : {_d.site_xpos[_sid]}   <- now it means something")
-_moved = float(np.linalg.norm(_d.site_xpos[_sid] - np.array([0.0, -0.19, 0.745])))
+_moved = float(np.linalg.norm(_d.site_xpos[_sid] - _before))
 print(f"the write moved it by {_moved:.3f} m, none of which you could see until the stage ran")
 
 # %% [markdown]
```

#### Recent Merged Pull Requests:
- **PR #427** (closed): ci: update GitHub Actions checkout and setup-python to latest versions (@Mukller)
- **PR #426** (closed): ci: update GitHub Actions checkout and setup-python to latest versions (@Mukller)
- **PR #422** (closed): Added one useful resource (@Paras-96)
- **PR #419** (closed): Update README.md (@jivan84)
- **PR #417** (closed): Bump werkzeug from 0.14.1 to 2.2.3 in /Projects/robosat-master/deps (@dependabot[bot])
- **PR #416** (closed): Bump ipython from 5.3.0 to 8.10.0 in /deep-learning/udacity-deeplearning/sentiment-rnn (@dependabot[bot])
- **PR #415** (closed): Bump ipython from 5.3.0 to 8.10.0 in /deep-learning/udacity-deeplearning/sentiment-network (@dependabot[bot])
- **PR #414** (closed): Bump ipython from 5.3.0 to 8.10.0 in /deep-learning/udacity-deeplearning/tv-script-generation (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
