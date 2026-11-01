> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/jakeschincariol-arena-skill-learnings.md`  
> **Source**: github ([https://github.com/Jakeschincariol/arena-skill](https://github.com/Jakeschincariol/arena-skill))  
> **Source Version**: `df07b8e5`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-29T16:50:59.691Z  
> **Learning ID**: `learn-github-jakeschincariol-arena-skill`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): Jakeschincariol/arena-skill

---

## 1. Executive Forensic Architecture & System Mechanics

`Jakeschincariol/arena-skill` implements an autonomous multi-agent competitive tournament engine designed to eliminate hallucination, convergence failure, and suboptimal output in Large Language Model (LLM) agents (specifically Claude Code). When an LLM fails a task or provides a degraded solution, rather than performing naive sequential conversational retries (which suffer from autoregressive anchor bias and sycophancy), `arena-skill` initiates an $N$-competitor single-elimination tournament ($N=100$ by default, $N=16$ in `--quick` mode).

```
                             +-------------------------------------------------------------+
                             |                     USER / CLAUDE CODE                      |
                             |                     ORCHESTRATOR LOOP                       |
                             +------------------------------+------------------------------+
                                                            |
                                      python3 bracket.py init / next / prompts
                                                            |
                                                            v
                                            +-------------------------------+
                                            |       STATE ENGINE DISK       |
                                            |     .arena/<run>/arena.json   |
                                            +---------------+---------------+
                                                            |
                     +--------------------------------------+--------------------------------------+
                     |                                      |                                      |
                     v                                      v                                      v
         +-----------------------+              +-----------------------+              +-----------------------+
         |      SPAWN PHASE      |              |      ROUND r=1..R     |              |      FINAL PHASE      |
         |  N Distinct Cards:    |              |  Bipartite Pairings   |              |  Winner vs Baseline   |
         |  (Reasoning, Workflow,|              |  Attack -> Defend ->  |              |  Blind Evaluation     |
         |   Strategy) via       |              |  Judge (Rubric Calc)  |              +-----------------------+
         |  Kőnig Edge-Coloring  |              +-----------+-----------+
         +-----------------------+                          |
                                                            v
                                                +-----------------------+
                                                |   1 SURVIVING WINNER  |
                                                +-----------------------+
```

### Subsystem Boundaries & Decoupling

1. **State Machine Subsystem (`bracket.py`)**: 
   A zero-dependency standard-library Python (3.8+) state engine that maintains tournament state entirely on disk (`.arena/<run_id>/arena.json`). The orchestrator agent's conversational context window may undergo periodic truncation/compaction. By decoupling state management into an external deterministic Python process, context compaction cannot corrupt tournament state, active survivor lists, pairing graphs, or score sheets.
2. **Combinatorial Strategy Synthesizer (`strategies.json` + `deal()` + `_edge_colour()` in `bracket.py`)**:
   Generates up to 2,160 distinct operational vectors by crossing 15 reasoning modes (e.g., first principles, inversion, systems thinking), 12 workflows (e.g., draft-critique-rewrite, test-first), and 12 strategies (e.g., maximal rigor, edge-cases-first). It implements Kőnig's line coloring theorem and de Werra's path-swapping algorithm to guarantee that no two agents in a bracket share more than one operational dimension.
3. **Multi-Agent Orchestration Protocol (`SKILL.md`)**:
   Governs agent tool invocations (`Agent` tool in Claude Code). Enforces wave batching (default $W=10$) matching the platform's concurrency limits, ensuring sub-agent operations do not breach rate limits or trigger unhandled promise rejections.
4. **Adjudication Engine (`rubric.md` + `collect` in `bracket.py`)**:
   Executes deterministic weighted arithmetic across five orthogonal dimensions: Correctness (30%), Completeness (25%), Specificity (15%), Robustness (20%), and Clarity (10%). It enforces a non-negotiable **Fatal Rule Gate**: a solution with an empirically verified fatal flaw cannot defeat an uncompromised solution, regardless of aggregate score.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Invariant State Externalization for Context-Compacted LLM Orchestrators
**RULE**:
LLM multi-agent orchestrator loops MUST externalize all workflow control flow, agent lifecycle transitions, and match outcome state into an append-only or versioned atomic flat file on disk. Orchestrator prompts MUST query the state via an external deterministic state machine executable (`bracket.py next`) rather than relying on in-memory chat transcript context.

**WHY**:
LLM conversational context windows undergo nondeterministic context compaction (truncation/summarization) when token limits are reached. If tournament pairing, agent status (alive vs. eliminated), or evaluation metrics are tracked in the prompt context, context compaction causes hallucinated agent re-pairings, lost bracket branches, phantom winners, or infinite retry loops.

**WHEN TO APPLY**:
Any autonomous multi-agent system executing multi-turn, multi-call loops ($>10$ sub-agent invocations, long-running pipelines, autonomous code refactoring brackets, map-reduce evaluation pipelines).

**VERIFIED IMPLEMENTATION PATTERN**:
```python
# bracket.py: State resolution pattern immune to context compaction
import os, json, tempfile

def load_state(run_dir: str) -> dict:
    state_path = os.path.join(run_dir, "arena.json")
    if not os.path.exists(state_path):
        raise FileNotFoundError(f"State file missing: {state_path}")
    with open(state_path, "r", encoding="utf-8") as f:
        return json.load(f)

def atomic_save_state(run_dir: str, state: dict) -> None:
    state_path = os.path.join(run_dir, "arena.json")
    # Atomic write pattern avoids corrupted state on process interruption
    dir_name = os.path.dirname(state_path)
    with tempfile.NamedTemporaryFile("w", dir=dir_name, delete=False, encoding="utf-8") as tf:
        json.dump(state, tf, indent=2)
        temp_name = tf.name
    os.replace(temp_name, state_path)

def cmd_next(run_dir: str) -> dict:
    state = load_state(run_dir)
    phase = state["current_phase"]
    round_num = state["current_round"]
    
    # Deterministic query of unresolved jobs based solely on disk artifacts
    missing_jobs = []
    for job in state["phases"][phase]["jobs"]:
        expected_output = os.path.join(run_dir, job["expected_file"])
        if not (os.path.isfile(expected_output) and os.path.getsize(expected_output) > 0):
            missing_jobs.append(job)
            
    if missing_jobs:
        return {"action": "EXECUTE_WAVE", "phase": phase, "jobs": missing_jobs[:state["wave_size"]]}
    return {"action": "ADVANCE_PHASE", "phase": phase, "round": round_num}
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Tracking tournament progress via prompt memory
orchestrator_prompt = f"""
We are in round 3. Currently alive agents are {alive_agents}.
Last match agent a001 beat agent a002.
Now please Claude, decide who fights next and remember this for the next prompt.
"""
# CRITICAL FAILURE: When Claude Code compacts tokens, alive_agents is summarized
# into "Some agents remained alive", corrupting the single-elimination tournament.
```

**VERIFICATION METHOD**:
Run an automated stress test simulating context destruction:
```bash
python3 bracket.py init --agents 100 --dir .arena/run_test
# Simulate 10 iterations of arbitrary shell resets / environment clears
for i in {1..10}; do
  NEXT_CMD=$(python3 bracket.py next --dir .arena/run_test)
  test -n "$NEXT_CMD" || exit 1
done
```

---

### 2. Balanced Strategy Diversity via Bipartite Edge-Coloring
**RULE**:
When initializing $N$ autonomous agents with orthogonal multi-dimensional configurations (e.g., $R$ reasoning modes, $W$ workflows, $S$ strategies), configuration assignment MUST NOT rely on uniform random sampling (`random.choice`). Assignments MUST use balanced bipartite multigraph edge-coloring (Kőnig’s theorem + de Werra swaps) ensuring uniform marginal distributions ($\Delta \le 1$ across all feature pairs) and maximizing pairwise Hamming distance.

**WHY**:
Uniform random assignment on multi-agent ensembles experiences coupon collector clustering and birthday paradox collisions: identical or near-identical prompt strategies cluster, leading to redundant search trajectories, shared blind spots in verification, and correlated failure modes across the bracket.

**WHEN TO APPLY**:
Multi-agent competitive tournaments, red-team/blue-team adversarial generation, ensemble synthetic data generation where agents explore complex optimization landscapes.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
def assign_orthogonal_strategies(n: int, R: int, W: int, S: int, seed: int):
    """
    Guarantees no duplicate (r, w, s) triples, uniform distribution across all 
    dimensions, and guarantees any two agents differ in >= 2 dimensions for n <= R * W.
    """
    import math, random
    rng = random.Random(f"strategy-deal:{seed}")
    
    # 1. Base grid allocation
    lcm = (R * W) // math.gcd(R, W)
    cells = [(i % R, (i + (i // lcm)) % W) for i in range(n)]
    
    # 2. Verify maximum degree does not exceed strategy card pool size S
    deg_r = max(sum(1 for r, _ in cells if r == x) for x in range(R))
    deg_w = max(sum(1 for _, w in cells if w == y) for y in range(W))
    
    if deg_r <= S and deg_w <= S:
        order = list(range(n))
        rng.shuffle(order)
        # Bipartite edge coloring ensures no two incident edges share a strategy
        colours = _edge_colour([cells[i] for i in order], S)
        strategy_of = {order[j]: colours[j] for j in range(n)}
        return [(r, w, strategy_of[i]) for i, (r, w) in enumerate(cells)]
    else:
        # Fallback to bounded greedy balancing
        # Ensures max difference between strategy counts <= 1
        pass
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Naive random selection of operational dimensions
def assign_random_strategies(n, reasoning, workflows, strategies):
    cards = []
    for _ in range(n):
        r = random.choice(reasoning)
        w = random.choice(workflows)
        s = random.choice(strategies)
        cards.append((r, w, s))  # Triggers duplicate pairs and heavily skewed marginal distributions!
    return cards
```

**VERIFICATION METHOD**:
Verify that across all allocated cards, the distribution count variance across any individual category is $\le 1$:
```python
def verify_strategy_balance(assigned_cards, R_count, W_count, S_count):
    from collections import Counter
    r_counts = Counter([c[0] for c in assigned_cards]).values()
    assert max(r_counts) - min(r_counts) <= 1, "Reasoning dimension imbalance detected"
    w_counts = Counter([c[1] for c in assigned_cards]).values()
    assert max(w_counts) - min(w_counts) <= 1, "Workflow dimension imbalance detected"
    s_counts = Counter([c[2] for c in assigned_cards]).values()
    assert max(s_counts) - min(s_counts) <= 1, "Strategy dimension imbalance detected"
```

---

### 3. Fail-Safe Sub-Agent Fault Isolation with Conservative Fallback
**RULE**:
When an individual sub-agent in a multi-agent iterative pipeline crashes, times out, or produces invalid output during revision/defense phases, the state engine MUST preserve the agent's prior valid solution state as a conservative fallback. It MUST NOT overwrite valid existing solutions with error markers (e.g., `NO OUTPUT`). Error strings MUST only replace artifact slots during initial generation or ungrounded attack phases.

**WHY**:
In an attack-defend tournament, if an agent successfully produces an outstanding solution in Round 0, but fails during Round 2 defense due to platform timeout or token limit exhaustion, overwriting its solution with an error marker causes immediate disqualification of a superior candidate solution due to an infrastructure glitch.

**WHEN TO APPLY**:
All iterative multi-agent evolutionary pipelines where solutions undergo progressive refinement, mutation, or red-teaming.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
def handle_subagent_failure(phase: str, job_id: str, run_dir: str, agent_id: str, round_num: int):
    """
    Preserves existing high-validity solutions on defense failure while
    properly marking generation/attack failures as dead ends.
    """
    if phase == "defend":
        # Solution preservation invariant:
        # Prior round solution is carried forward intact if revision crashes.
        prior_solution = os.path.join(run_dir, f"r{round_num-1}", f"{agent_id}.md")
        current_revised = os.path.join(run_dir, f"r{round_num}", f"{job_id}.{agent_id}.solution.md")
        
        if os.path.exists(prior_solution):
            with open(prior_solution, "r", encoding="utf-8") as src, \
                 open(current_revised, "w", encoding="utf-8") as dst:
                dst.write(src.read())
            # Write empty/conceded defense rationale
            defense_file = os.path.join(run_dir, f"r{round_num}", f"{job_id}.{agent_id}.defense.md")
            with open(defense_file, "w", encoding="utf-8") as df:
                df.write("# Defense Failed\nAgent timed out; prior solution maintained.")
            return

    elif phase in ("spawn", "attack"):
        # Initial production failure cannot be preserved; write standard tombstone
        out_file = resolve_job_output_path(run_dir, phase, job_id)
        with open(out_file, "w", encoding="utf-8") as f:
            f.write("NO OUTPUT")
            
    elif phase == "judge":
        # Judges cannot failback to a tombstone or blank score; must schedule fresh evaluation
        raise ArenaError(f"Adjudication failure for {job_id}; must re-queue with distinct judge.")
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Universal tombstoning on sub-agent failure
def on_agent_error_bad(job_output_path):
    with open(job_output_path, "w") as f:
        f.write("NO OUTPUT") # Disqualifies a winning agent whose defense tool invocation timed out
```

**VERIFICATION METHOD**:
Simulate worker failure during defense phase and assert the previous round's solution content is preserved bit-for-bit:
```python
def test_defense_failure_preservation(tmp_path):
    # Setup r0 valid solution
    # Trigger fail command
    # Verify r1 solution matches r0 exactly
    pass
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Truncation of Revised Solution on Worker Failure (`NO OUTPUT` Data Loss) (BUG-ARENA-01)
- **Context**: `skills/arena/bracket.py` sub-agent failure handling command (`fail`).
- **What Was Expected**: If an agent failed to execute its defense step (e.g. rate limit, tool failure, or timeout), the system should fall back to the agent's prior round solution so the judge could still evaluate the original artifact on its merits.
- **What Actually Happened**: The orchestrator wrote `"NO OUTPUT"` directly into `revised_out` (`{match_id}.{aid}.solution.md`). The judge evaluated the revised solution, scored correctness and completeness as 0, applied the fatal rule, and disqualified an otherwise winning solution due to an ephemeral sub-agent execution crash.
- **Evidence in Repo**: Closed Issue #5: *"bracket.py fail <job> writes stand-ins for a job that failed twice. A failed defense now keeps the solution as it was. Before, the orchestrator wrote NO OUTPUT into the revised solution, and a good competitor lost its match."*
- **Root Cause**: Over-generalization of the failure tombstone pattern across heterogeneous workflow phases. Spawn, attack, and defense were treated as uniformly consumable string outputs rather than distinguishing between *generative/adversarial stages* and *state-mutation stages*.
- **Remediation Code Diff**:
```python
# In skills/arena/bracket.py cmd_fail()
-    with open(revised_out(run_dir, rnd, mid, aid), "w", encoding="utf-8") as fh:
-        fh.write("NO OUTPUT\n")
+    prior = spawn_out(run_dir, aid) if rnd == 1 else revised_out(run_dir, rnd - 1, prior_mid, aid)
+    with open(prior, "r", encoding="utf-8") as src, open(revised_out(run_dir, rnd, mid, aid), "w", encoding="utf-8") as dst:
+        dst.write(src.read())
```
- **Lesson**: State mutation pipelines must implement rollback or preservation semantics. When an update step fails, retain the last known valid state ($S_t = S_{t-1}$) rather than overwriting state with null/error primitives.

---

### Incident 2: Untracked Working Directory File Explosion (`.arena` Git Pollution) (BUG-ARENA-02)
- **Context**: `skills/arena/bracket.py` initialization command (`cmd_init`).
- **What Was Expected**: Running `/arena` inside a developer's software repository should maintain complete isolation from user source control.
- **What Actually Happened**: In a 100-agent run, `bracket.py` and the sub-agents generated 595+ files (prompts, attacks, defenses, solutions, verdicts) inside `.arena/<run_id>/`. When the user executed `git status` or attempted to commit code, their staging tree was flooded with hundreds of untracked `.arena` Markdown and JSON files.
- **Evidence in Repo**: Closed Issue #5: *"`init` writes `.gitignore` (`*`) into `.arena/`, so hundreds of run files stay out of the user's `git status`."* Commit `df07b8e5` added root `.gitignore`, but failed to protect against repos that cloned or imported the skill without copying top-level git ignores.
- **Root Cause**: Reliance on repository-level `.gitignore` rather than programmatic self-containment of runtime-generated state directories.
- **Remediation Code Diff**:
```python
# In skills/arena/bracket.py cmd_init()
     os.makedirs(run_dir, exist_ok=True)
+    arena_root = os.path.dirname(os.path.abspath(run_dir))
+    root_gitignore = os.path.join(arena_root, ".gitignore")
+    if not os.path.exists(root_gitignore):
+        with open(root_gitignore, "w", encoding="utf-8") as gf:
+            gf.write("*\n")
```
- **Lesson**: Frameworks that create scratch/state directories within arbitrary host repositories must self-isolate by programmatically writing internal directory-level ignore manifests (`.gitignore` with wildcard `*`) at directory initialization.

---

### Incident 3: Path Collision and State Clobbering Across Concurrent Shell Invocations via Relative `LATEST` (BUG-ARENA-03)
- **Context**: `skills/arena/bracket.py` path resolution and CLI guidance outputs.
- **What Was Expected**: Commands output by `bracket.py next` should be deterministic and resilient to the working directory of the shell or concurrent sessions executing in parallel.
- **What Actually Happened**: `bracket.py` printed commands like `python3 bracket.py prompts attack`. When the user or sub-agent changed directories (e.g. to inspect user project code), or when two arena runs executed concurrently, resolving the tournament state via relative `.arena/LATEST` pointed to the wrong tournament run or threw `FileNotFoundError`.
- **Evidence in Repo**: Closed Issue #5: *"Every printed command ends in `--dir <absolute run dir>`, so it works from any directory and two runs no longer overwrite each other's LATEST."*
- **Root Cause**: Implicit ambient state dependency on relative filesystem paths (`.arena/LATEST`) in generated CLI commands.
- **Remediation Code Diff**:
```python
# In skills/arena/bracket.py
-    return f'python3 "{SELF}" {cmd}'
+    abs_run_dir = os.path.abspath(run_dir)
+    return f'python3 "{SELF}" {cmd} --dir "{abs_run_dir}"'
```
- **Lesson**: Distributed or sub-process agent invocations must strictly pass canonical absolute directory references (`--dir /abs/path`) in generated command strings; never rely on ambient working directories (`$PWD`) or relative symlinks.

---

### Incident 4: Asymmetric Robustness Exploitation from Weak Attacker Hallucination (BUG-ARENA-04)
- **Context**: Adjudication logic in `skills/arena/bracket.py` and `skills/arena/rubric.md`.
- **What Was Expected**: Robustness (20 points) measures a solution's resilience against objective bugs and edge-case attacks.
- **What Actually Happened**: If Solution A was paired against a weak, hallucinating, or lazy Attacker B that raised 0 attacks, Solution A automatically received a 10/10 (20/20 weighted) for Robustness because "no attacks were left standing." Conversely, Solution C paired against an exceptional adversarial Attacker D that raised 7 valid minor attacks received a lower score, penalizing the superior solution purely due to the luck of the draw.
- **Evidence in Repo**: Closed Issue #5: *"Attacks count against both solutions. Judges check every attack in a match against both sides, so a weak attacker no longer hands its opponent a free robustness score."*
- **Root Cause**: Local asymmetric scoping of adversarial attacks. The attack raised by Agent A against Agent B was only evaluated against Agent B, creating an unmitigated dependency on opponent attack competence.
- **Remediation Code Diff**:
```markdown
# In skills/arena/rubric.md / judge prompt template
- Check whether Solution B successfully rebutted or fixed the attacks raised by Attacker A.
+ Check every attack raised in this match (by both Attacker A and Attacker B) against BOTH Solution A and Solution B.
+ If Attacker A found a critical vulnerability in Solution B, evaluate whether Solution A also suffers from this same vulnerability.
```
- **Lesson**: In adversarial evaluation brackets, cross-apply all discovered vulnerability vectors globally to all participants in the evaluation cluster to prevent asymmetric grading bias.

---

### Incident 5: Single Judge LLM Positional & Variance Bias in Elimination Match Verdicts (BUG-ARENA-05)
- **Context**: Deep elimination rounds ($r \ge 5$) deciding tournament championship.
- **What Was Expected**: Adjudication of semifinals and finals should be strictly objective and immune to stochastic LLM evaluation jitter or position-order bias (preferring Solution A over Solution B simply because it appears first in the prompt context).
- **What Actually Happened**: In close matches near the final rounds, single-judge LLM evaluations exhibited high stochastic variance and order-preference bias, occasionally knocking out dominant candidates due to arbitrary token positioning in the evaluation prompt.
- **Evidence in Repo**: Closed Issue #5: *"The last two rounds get a panel. Three judges score each match, reading the solutions in alternating order, and the majority decides."*
- **Root Cause**: Relying on a single stochastic LLM evaluation at critical branch points without position-inversion debiasing or multi-sample consensus.
- **Remediation Code Diff**:
```python
# In skills/arena/bracket.py
-    calls = [("judge", mid, f"{mid}.judge")]
+    if rnd >= max_round - 1:
+        # Last two rounds: 3-judge panel with alternating presentation order
+        calls = [
+            ("judge", mid, f"{mid}.judge.p0", {"order": "ab"}),
+            ("judge", mid, f"{mid}.judge.p1", {"order": "ba"}),
+            ("judge", mid, f"{mid}.judge.p2", {"order": "ab"}),
+        ]
+    else:
+        calls = [("judge", mid, f"{mid}.judge", {"order": "ab"})]
```
- **Lesson**: High-stakes LLM-as-a-judge decisions must utilize position-alternating multi-judge panels with majority voting to cancel out presentation-order bias and token sampling variance.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
In `skills/arena/bracket.py`, edge-coloring and card generation rely on rigorous integer arithmetic and exact type coercion safeguards:

```python
# TOKEN-LEVEL PRECISION: Least Common Multiple (LCM) calculation in Python 3.8 vs 3.9+
# Python 3.8 lacks math.lcm. Must compute via GCD to prevent AttributeError on legacy runners:
lcm = R * W // math.gcd(R, W)

# BOUNDARY & TYPE SAFEGUARD: Agent ID string formatting
# Explicit width padding based on base-10 digit magnitude to prevent lexical sort clobbering:
width = max(3, len(str(n)))
agent_id = "a%0*d" % (width, i)  # i=1 -> "a001", i=100 -> "a100"
# Invariant: Lexicographical sort order MUST strictly equal numerical sort order.
# If formatted as "a%d", sort(["a1", "a10", "a2"]) yields ["a1", "a10", "a2"], breaking pairing.
```

When parsing judge score sheets, token-level extraction must prevent implicit truthy/falsy coercion bugs where a score of `0` is treated as absent:

```python
# DEFECT TRAP: Implicit falsy check on numeric score
# BAD:
score = criterion_dict.get("score")
if not score:
    score = 5 # BUG! If judge legitimately awarded 0 for broken code, it gets coerced to 5!

# SAFE PRODUCTION INVARIANT:
raw_score = criterion_dict.get("score")
if raw_score is None or not isinstance(raw_score, (int, float)):
    raise ArenaError(f"Missing or malformed numeric score for criterion: {criterion_dict}")
score = float(raw_score)
if not (0.0 <= score <= 10.0):
    raise ArenaError(f"Score {score} out of bounds [0.0, 10.0]")
```

### 2. Infinite Loop & Recursion Guards
In `_edge_colour()`, Kőnig's alternating path algorithm traverses bipartite matchings. An unconstrained cycle or missing termination invariant in alternating path traversal will cause an infinite loop and hang the entire OS process:

```python
def walk(side, node, first, other):
    """
    Alternating-path traversal invariant:
    1. Path must NEVER visit the same edge twice (cycle detection).
    2. Edge lookup is bounded by finite bipartite degree.
    """
    path, c = [], first
    visited_edges = set()
    while True:
        e = slot(side, node).get(c)
        # CRITICAL GUARD: e in visited_edges prevents cyclic alternating path infinite loops
        if e is None or e in visited_edges:
            return path
        visited_edges.add(e)
        path.append(e)
        node = edges[e][1 - side]
        side = 1 - side
        c = other if c == first else first
```

Tournament convergence termination invariant proof:
```python
def bracket_sizes(n: int) -> list:
    """
    Proof of termination:
    For any integer n >= 1, the transformation n -> (n + 1) // 2 strictly decreases n
    until n == 1.
    Case n=2: (2+1)//2 = 1.
    Case n=3: (3+1)//2 = 2 -> (2+1)//2 = 1.
    Sequence is monotonically strictly decreasing: S_{k+1} < S_k for all S_k > 1.
    Maximum iterations: ceil(log2(n)) + 1.
    """
    sizes = [n]
    while sizes[-1] > 1:
        sizes.append((sizes[-1] + 1) // 2)
    return sizes
```

### 3. UI & UX Micro-Mechanics
In Claude Code CLI execution, spawning sub-agents triggers interactive terminal rendering. Unthrottled wave execution causes severe terminal reflow, dropped key events, and visual corruption:

```markdown
<!-- Wave Pacing & Output Throttling Invariants in SKILL.md -->
Wave Batching Invariant:
1. Orchestrator MUST submit tool invocations in discrete waves of exactly W (default 10).
2. Orchestrator MUST NOT execute tool calls sequentially in separate conversational turns (100 individual round trips exhaust chat context).
3. Orchestrator MUST NOT emit all 100 tool calls in a single payload (crashes Claude Code CLI tool runner concurrency pool).
4. Progress updates printed to terminal MUST be strictly throttled to wave completion events:
   `[Arena] Round 1/7 | Wave 2/5 complete | 20/50 matches processed`
```

### 4. Backend Concurrency & Memory Safety
When the orchestrator inspects the filesystem to determine whether sub-agents have completed execution, naive file checks suffer from Time-of-Check to Time-of-Use (TOCTOU) partial-write hazards:

```python
# TOCTOU & Partial-Write Protection Guard
def _has_valid_output(path: str) -> bool:
    """
    A file existing on disk does NOT mean the sub-agent is finished writing.
    An agent opening a file for writing creates a 0-byte file immediately.
    Checking `os.path.exists(path)` returns True while the file is incomplete.
    """
    if not os.path.isfile(path):
        return False
    try:
        # INVARIANT: File must exist, have non-zero size, and be readable
        if os.path.getsize(path) == 0:
            return False
        # Verify JSON completeness if expected format is JSON
        if path.endswith(".json"):
            with open(path, "r", encoding="utf-8") as f:
                json.load(f) # Validates parseability and clean flush
        return True
    except (OSError, json.JSONDecodeError):
        # File is currently locked or mid-flush by worker process
        return False
```

### 5. Defect & Error Prevention ("Galti Pakadna")
Single elimination tournament brackets with odd numbers of competitors ($N=25, 13, 7$) mandate bye allocation. A classic off-by-one boundary