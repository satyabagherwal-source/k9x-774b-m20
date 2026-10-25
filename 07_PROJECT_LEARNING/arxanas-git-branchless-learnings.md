> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/arxanas-git-branchless-learnings.md`  
> **Source**: github ([https://github.com/arxanas/git-branchless](https://github.com/arxanas/git-branchless))  
> **Source Version**: `f37244cb`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-25T03:52:44.993Z  
> **Learning ID**: `learn-github-arxanas-git-branchless`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): arxanas/git-branchless

---

## 1. Executive Forensic Architecture & System Mechanics

`git-branchless` provides anonymous, branch-free, trunk-based, and stacked-diff development workflows on top of vanilla Git repositories without requiring server-side changes or custom Git forks. 

### Core Architectural Boundaries & Decoupling
The architecture is partitioned into four major layers:
1. **Hook Interception & Event Capture Layer (`git-branchless-hook`, `git-branchless-record`)**:
   Injects hooks into Git (`post-commit`, `post-checkout`, `post-merge`, `post-rewrite`, and `reference-transaction`). When Git executes mutations, these hooks intercept the operation, parse stdin/stdout/environment variables, and emit transactional event descriptors (`Event::RewriteEvent`, `Event::RefUpdateEvent`, `Event::CommitEvent`, `Event::WorkingCopySnapshot`).
2. **Persistent SCM Event Store & Replay Engine (`git-branchless-lib::core::eventlog`)**:
   Underneath the repository's `.git/branchless/` directory, an embedded SQLite database stores an append-only sequence of immutable events wrapped in `EventTransactionId` boundaries. The `EventReplayer` replays this event sequence deterministically to reconstruct commit activity states (`Active`, `Inactive`, `Obsolete`), forming an accurate point-in-time timeline of developer intentions.
3. **Commit Graph Abstraction & Topo-Ordering Layer (`git-branchless-lib::core::dag`)**:
   Wraps Meta's high-performance Eden SCM directed acyclic graph implementation (`eden_dag` / `sapling-dag`). It constructs an incremental, cached on-disk representation of the Git commit graph. It integrates a custom parent-traversal bridge (`GitParentsBlocking`) interfacing with `git2` / libgit2, caching reachability sets (`head_commit`, `main_branch_commit`, `branch_commits`, `observed_commits`, `obsolete_commits`).
4. **Command Execution & Safe Working-Tree Orchestrator (`git-branchless-lib::core::check_out`, `git-branchless-lib::core::rewrite`)**:
   Coordinates safe repository manipulations (such as `smartlog`, `move`, `sync`, `restack`, and `undo`). Before any potentially destructive tree mutation or branch update, it generates a full `WorkingCopySnapshot` (tracking both staged and unstaged working-tree states into temporary Git tree objects and commit records) and pins ephemeral commits into `refs/branchless/<OID>` to shield them against Git's native garbage collector (`git gc` / `git prune`).

```
+-----------------------------------------------------------------------------+
|                                Git Repository                               |
|   (CLI calls: git commit, git checkout, git rebase, git-branchless move)    |
+-----------------------------------------------------------------------------+
         |                                                 ^
         v (Hook triggers)                                 | (Safe mutations)
+-------------------------------------+   +-----------------------------------+
|      git-branchless-hook /          |   | git-branchless-lib::core::check_out
|      reference-transaction          |   |  - Two-phase checkout/reset       |
|  - Parse refs / args / shas         |   |  - Snapshot capture & restore     |
+-------------------------------------+   +-----------------------------------+
         |                                                 ^
         v (Emit Events)                                   |
+-----------------------------------------------------------------------------+
|                     Persistent SQLite Event Log                             |
|           Table: events (event_tx_id, timestamp, type, refs)                |
+-----------------------------------------------------------------------------+
         |
         v (Deterministic playback)
+-----------------------------------------------------------------------------+
|                     EventReplayer (State Reconstruction)                    |
|        Calculates CommitActivityStatus: Active | Inactive | Obsolete        |
+-----------------------------------------------------------------------------+
         |
         v (Queried by)
+-----------------------------------------------------------------------------+
|                     High-Performance DAG (sapling-dag)                      |
|     - GitParentsBlocking: Traverses git2 commit parents                     |
|     - Computes CommitSets, Ancestors, Heuristics, Branch Segments           |
|     - Renders Smartlog via Glyphs & ANSI Spans                              |
+-----------------------------------------------------------------------------+
```

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Replay Engine Lineage Preservation Rule
**RULE**:
When transforming, rebasing, or rewriting an entity within an event-sourced or replaying state machine, the resulting replacement entity MUST inherit the lifecycle classification (e.g., `Obsolete`, `Hidden`, `Tombstoned`) of its direct antecedent, UNLESS an explicit un-hiding event was dispatched within that transaction boundary.

**WHY**:
In event-driven architectures tracking object lifecycles across mutations (such as Git commit rewrites, immutable database migrations, or document editing stacks), assuming that a new generated entity defaults to `Active` or `Visible` creates phantom resurrection bugs. In `git-branchless`, when an obsolete commit was moved or restacked, the rewrite emitted a `RewriteEvent` where the replayer unconditionally stamped the replacement commit with `EventClassification::Show`. This resurrected dead/hidden commits onto the active smartlog display, polluting the developer's working tree and violating graph invariants.

**WHEN TO APPLY**:
Apply to any system using event sourcing, operational transformation (OT), CRDTs, or Git-based rewrite abstractions where mutations generate replacement OIDs/IDs representing prior nodes.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// In event replaying / transformation modules:
// Inspect the antecedent's resolved activity status at the current cursor
// before assigning classification to the replacement ID.

if let MaybeZeroOid::NonZero(new_commit_oid) = new_commit_oid {
    let event_classification = match old_commit_oid {
        MaybeZeroOid::NonZero(old_commit_oid) => {
            match self.get_cursor_commit_activity_status(
                EventCursor { event_id: id },
                *old_commit_oid,
            ) {
                CommitActivityStatus::Obsolete => EventClassification::Hide,
                CommitActivityStatus::Active | CommitActivityStatus::Inactive => {
                    EventClassification::Show
                }
            }
        }
        MaybeZeroOid::Zero => EventClassification::Show,
    };

    self.commit_history
        .entry(*new_commit_oid)
        .or_default()
        .push(EventInfo {
            id,
            event: event.clone(),
            event_classification,
        });
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER assume newly rewritten entities default to visible/active state:
if let MaybeZeroOid::NonZero(new_commit_oid) = new_commit_oid {
    self.commit_history
        .entry(*new_commit_oid)
        .or_default()
        .push(EventInfo {
            id,
            event: event.clone(),
            // BUG: Resurrects obsolete/hidden commits during rebase/sync/move
            event_classification: EventClassification::Show,
        });
}
```

**VERIFICATION METHOD**:
Construct an integration test where an entity is initialized, transitioned to `Obsolete`/`Hidden`, subjected to a synthetic rewrite/migration, and asserted that the subsequent timeline query strictly matches `CommitActivityStatus::Obsolete`:
```rust
#[test]
fn verify_rewrite_preserves_obsolete_status() -> eyre::Result<()> {
    let mut replayer = new_event_replayer("refs/heads/master".into());
    replayer.process_event(&Event::ObsoleteEvent { timestamp: 0.0, event_tx_id, commit_oid: old_oid });
    replayer.process_event(&Event::RewriteEvent { timestamp: 0.0, event_tx_id, old_commit_oid: old_oid.into(), new_commit_oid: new_oid.into() });
    let cursor = replayer.make_default_cursor();
    assert!(matches!(replayer.get_cursor_commit_activity_status(cursor, new_oid), CommitActivityStatus::Obsolete));
    Ok(())
}
```

---

### 2. Destructive Working-Tree Snapshot Isolation Rule
**RULE**:
When restoring a dirty working-tree snapshot or checking out state over uncommitted changes, you MUST NOT execute a direct single-step forced hard reset (`git reset --hard <target>`). You MUST execute a two-step isolated transition: first reset tracked files to the clean base (`git reset --hard HEAD`), then checkout the unstaged commit tree specifically (`git checkout <unstaged_tree_commit> --`).

**WHY**:
Executing `git reset --hard <target>` overwrites untracked and unstaged files that conflict between the working directory and the target commit, silently destroying user data without recovery recourse. By performing `git reset --hard HEAD` first, the index and tracked files are synchronized without touching untracked files; subsequent invocation of `git checkout <unstaged_oid> --` causes Git's internal tree-collision detector to fail fast and abort the operation if untracked files would be overwritten, leaving the user's workspace intact.

**WHEN TO APPLY**:
Any CLI or daemon tool performing automated checkout, branch switching, patch application, or workspace restoration in systems with dirty uncommitted files.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Two-step safe restoration protocol protecting untracked local modifications:

// Step 1: Discard only tracked working copy modifications relative to HEAD.
try_exit_code!(
    git_run_info
        .run(
            effects,
            Some(event_tx_id),
            &["reset", "--hard", "HEAD", "--"]
        )
        .wrap_err("Discarding tracked working copy changes")?
);

// Step 2: Attempt checkout of unstaged commit tree.
// If untracked files collide with the target tree, Git terminates with an error
// rather than truncating/clobbering untracked workspace files.
try_exit_code!(
    git_run_info
        .run(
            effects,
            Some(event_tx_id),
            &[
                "checkout",
                &snapshot.commit_unstaged.get_oid().to_string(),
                "--"
            ],
        )
        .wrap_err("Checking out unstaged changes (fail if conflict)")?
);
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER do a single forced reset to the destination snapshot OID:
try_exit_code!(
    git_run_info.run(
        effects,
        Some(event_tx_id),
        // CRITICAL DATA LOSS HAZARD: Silently destroys untracked files in working tree!
        &["reset", "--hard", &snapshot.commit_unstaged.get_oid().to_string(), "--"]
    )?
);
```

**VERIFICATION METHOD**:
Run an automated harness that places an untracked file `conflict.txt` in the workspace matching a file path in the snapshot, triggers checkout, and verifies: (1) the checkout fails with an exit code != 0, and (2) the untracked file `conflict.txt` retains its exact original content on disk.

---

### 3. Parent-Worktree Bare Clone Configuration Discovery Rule
**RULE**:
When resolving repository paths, configuration paths, or hook directories in a Git worktree context, tools MUST recursively inspect `repo.open_worktree_parent_repo()` and fallback gracefully to the discovered root parent repo, rather than assuming `$GIT_DIR/hooks` exists locally or that worktree directories are standard non-bare repositories.

**WHY**:
In linked worktrees spawned from bare clones (`git clone --bare ... && git worktree add ...`), `$GIT_DIR` inside the linked worktree is a pointer file (`.git: /path/to/bare/repo/worktrees/name`), while the hooks directory and common metadata reside in the parent bare repository. Tools that resolve paths via simple `.join("hooks")` without parent worktree resolution panic with repository `NotFound (-3)` errors, completely breaking CLI operation in bare repository enterprise setups.

**WHEN TO APPLY**:
Any tool, plugin, or CLI integrating with Git worktrees, bare clones, submodules, or custom Git configuration files (`core.hooksPath`).

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
#[instrument]
pub fn get_default_hooks_dir(repo: &Repo) -> eyre::Result<PathBuf> {
    // Resolve worktree parent first; if this repo is a linked worktree,
    // its common metadata, config, and hook templates reside in the parent.
    let parent_repo = repo.open_worktree_parent_repo()?;
    let repo = parent_repo.as_ref().unwrap_or(repo);
    Ok(repo.get_path().join("hooks"))
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER query the working directory path directly for repo-wide hooks:
pub fn get_default_hooks_dir_bad(repo: &Repo) -> PathBuf {
    // BUG: Panics or points to nonexistent directory in linked worktrees of bare repos!
    repo.get_path().join("hooks")
}
```

**VERIFICATION METHOD**:
Automated integration test initializing a bare repo, adding a linked worktree, invoking hook directory resolution, and asserting valid path:
```bash
git clone --bare "$TEST_REPO" bare-repo
git -C bare-repo worktree add ../linked-wt master
cargo run -- -C ../linked-wt init
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Revset Lexer Syntax Rejection on Valid Branch Characters (BUG-REVSET-01)
- **Context**: `git-branchless-revset/src/grammar.lalrpop` & `git-branchless-revset/src/parser.rs`
- **What Was Expected**: The revset parsing engine must parse any valid Git reference name into a `Name` token. Specifically, Git allows the `#` character in branch and ref names (common in issue-tracking naming schemes like `mr/1229#crc`).
- **What Actually Happened**: The LALRPOP lexer regular expression for unquoted reference tokens excluded `#`. Any revset expression referencing `#` (such as `stack(mr/1229#crc)`) failed immediately with `Invalid token` error during lexical analysis.
- **Evidence in Repo**: Commit `24048407`, Issue #498.
- **Root Cause**: The character class in the LALRPOP grammar was too restrictive: `([a-zA-Z0-9_$@/-]|\.[a-zA-Z0-9_$@/-])+|\.`. Because `#` is not an operator in revset syntax, there was no syntactic ambiguity, yet it was omitted from the allowed character set.
- **Remediation Code Diff**:
```diff
--- a/git-branchless-revset/src/grammar.lalrpop
+++ b/git-branchless-revset/src/grammar.lalrpop
@@ -59,7 +59,7 @@ Expr5: Expr<'input> = {
 
 Name: Cow<'input, str> = {
     // NOTE: `.` should be allowed in names, but not `..` (since that is an operator).
-    <s:r"([a-zA-Z0-9_$@/-]|\.[a-zA-Z0-9_$@/-])+|\."> => Cow::Borrowed(&s),
+    <s:r"([a-zA-Z0-9_$@/#-]|\.[a-zA-Z0-9_$@/#-])+|\."> => Cow::Borrowed(&s),
```
- **Lesson**: Grammar lexers for domain-specific query languages wrapped over external systems must strictly mirror the external system's identifier alphabet. Unless a token character is explicitly reserved for operator syntax, it must be admitted in unquoted identifier lexemes.

---

### Incident 2: Phantom Commit Resurrection During Rebase & Move Operations (BUG-REWRITE-02)
- **Context**: `git-branchless-lib/src/core/eventlog.rs`, `git-branchless/src/commands/split.rs`, `git-branchless/tests/test_move.rs`
- **What Was Expected**: When a hidden or obsolete commit is rewritten via `git move`, `git restack`, or `git sync --pull`, its resulting rewritten replacement commit must remain hidden (`CommitActivityStatus::Obsolete`).
- **What Actually Happened**: Rewriting an obsolete commit caused its replacement to become `Active` and visible in `git smartlog`. Furthermore, when using `split --before` (`InsertBefore`), the split remainder commit was logged as a `RewriteEvent` of the target commit, causing the target's subsequent rebase to hide the remainder commit entirely.
- **Evidence in Repo**: Commit `e12c74ce`.
- **Root Cause**: In `EventReplayer`, incoming `RewriteEvent`s unconditionally pushed new commits to the event history with `event_classification: EventClassification::Show`. It failed to query the activity status of `old_commit_oid`. Additionally, in `split.rs`, `InsertBefore` rebased the target commit after extraction; using `RewriteEvent` mistakenly linked the target to the remainder, hiding the remainder when the target moved.
- **Remediation Code Diff**:
```diff
--- a/git-branchless-lib/src/core/eventlog.rs
+++ b/git-branchless-lib/src/core/eventlog.rs
@@ -881,13 +881,28 @@ impl EventReplayer {
                 if let MaybeZeroOid::NonZero(new_commit_oid) = new_commit_oid {
+                    // Rewriting an obsolete commit should not make its replacement visible.
+                    let event_classification = match old_commit_oid {
+                        MaybeZeroOid::NonZero(old_commit_oid) => {
+                            match self.get_cursor_commit_activity_status(
+                                EventCursor { event_id: id },
+                                *old_commit_oid,
+                            ) {
+                                CommitActivityStatus::Obsolete => EventClassification::Hide,
+                                CommitActivityStatus::Active | CommitActivityStatus::Inactive => {
+                                    EventClassification::Show
+                                }
+                            }
+                        }
+                        MaybeZeroOid::Zero => EventClassification::Show,
+                    };
                     self.commit_history
                         .entry(*new_commit_oid)
                         .or_default()
                         .push(EventInfo {
                             id,
                             event: event.clone(),
-                            event_classification: EventClassification::Show,
+                            event_classification,
                         });
                 }
```
```diff
--- a/git-branchless/src/commands/split.rs
+++ b/git-branchless/src/commands/split.rs
@@ -340,12 +340,24 @@ pub fn split(
-    event_log_db.add_events(vec![Event::RewriteEvent {
-        timestamp: now.duration_since(UNIX_EPOCH)?.as_secs_f64(),
-        event_tx_id,
-        old_commit_oid: MaybeZeroOid::NonZero(target_oid),
-        new_commit_oid: MaybeZeroOid::NonZero(remainder_commit_oid),
-    }])?;
+    let timestamp = now.duration_since(UNIX_EPOCH)?.as_secs_f64();
+    // `InsertBefore` rebases the target next, so `RewriteEvent` would hide the rebased result.
+    let event = match &split_mode {
+        SplitMode::InsertBefore => Event::CommitEvent {
+            timestamp,
+            event_tx_id,
+            commit_oid: remainder_commit_oid,
+        },
+        SplitMode::DetachAfter | SplitMode::Discard | SplitMode::InsertAfter => {
+            Event::RewriteEvent {
+                timestamp,
+                event_tx_id,
+                old_commit_oid: MaybeZeroOid::NonZero(target_oid),
+                new_commit_oid: MaybeZeroOid::NonZero(remainder_commit_oid),
+            }
+        }
+    };
+    event_log_db.add_events(vec![event])?;
```
- **Lesson**: Event classifications are hereditary across replacement relationships. In order-dependent AST transformations, a new node generated from a hidden ancestor must preserve that state unless explicitly promoted.

---

### Incident 3: Bare Clone Linked Worktree Repository Lookup Panic (BUG-WORKTREE-03)
- **Context**: `git-branchless-hook/src/lib.rs:516`, `git-branchless-lib/src/core/config.rs`
- **What Was Expected**: Running commands (`git smartlog`, `git init`) inside a linked worktree derived from a bare Git clone (`git clone --bare ...`) should locate the repository root and hook directory seamlessly.
- **What Actually Happened**: The binary panicked with `NotFound (-3): could not find repository at '$USER/repos/'`.
- **Evidence in Repo**: Issue #1652.
- **Root Cause**: `git2::Repository::open()` and standard directory traversal assume that `.git` is either a directory or a worktree file pointing to a non-bare repository structure. In bare-clone linked worktrees, the path structure diverges. Hooks and shared databases were attempted to be initialized directly relative to `$CWD` without calling `open_worktree_parent_repo()`, causing path resolution to escape into parent directories until failing at root.
- **Remediation Code Diff**:
```rust
// Fixed in git-branchless-lib/src/core/config.rs:
#[instrument]
pub fn get_default_hooks_dir(repo: &Repo) -> eyre::Result<PathBuf> {
    let parent_repo = repo.open_worktree_parent_repo()?;
    let repo = parent_repo.as_ref().unwrap_or(repo);
    Ok(repo.get_path().join("hooks"))
}
```
- **Lesson**: Never assume a repository has a `.git` folder directly inside its working tree. Always resolve worktrees through libgit2's parent worktree discovery mechanism to prevent catastrophic path traversal failures.

---

### Incident 4: Dependency Type Incompatibility on File Lock Results (BUG-DEP-04)
- **Context**: Upstream dependency `esl01-indexedlog-0.3.0/src/lock.rs:138:30`
- **What Was Expected**: Cargo compilation across lock options should unify file-locking results into `Result<(), std::io::Error>`.
- **What Actually Happened**: Compilation halted with `error[E0308]: match arms have incompatible types`. Arm `(false, true)` returned `Result<(), std::fs::TryLockError>` while prior arms returned `Result<(), std::io::Error>`.
- **Evidence in Repo**: Issue #1649, Issue #1585.
- **Root Cause**: Upstream crate `esl01-indexedlog` had mismatched return types across its conditional locking implementations when newer standard library / rustc editions decoupled `TryLockError` from standard `io::Error`.
- **Remediation Code Diff**:
```rust
// Upstream fix in lock.rs:
match (opts.exclusive, opts.non_blocking) {
    (true, false) => file.lock_exclusive(),
    (true, true) => file.try_lock_exclusive().map_err(|e| e.into()),
    (false, false) => file.lock_shared(),
    (false, true) => file.try_lock_shared().map_err(|e| match e {
        std::fs::TryLockError::WouldBlock => std::io::Error::from(std::io::ErrorKind::WouldBlock),
        std::fs::TryLockError::Error(io_err) => io_err,
    }),
}
```
- **Lesson**: When wrapping low-level system or OS file-locking operations, never let platform-specific `TryLockError` types leak directly into generic `Result` arms. Map error variants explicitly into a uniform target error type.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
* **LALRPOP Regex Non-Greedy & Disjunction Boundaries**:
  In `git-branchless-revset/src/grammar.lalrpop`, refnames must distinguish between single dot `.` (valid ref component) and range operator `..`:
  ```rust
  // CORRECT: Matches sequences of allowed chars OR dot followed by allowed chars, OR isolated dot
  <s:r"([a-zA-Z0-9_$@/#-]|\.[a-zA-Z0-9_$@/#-])+|\."> => Cow::Borrowed(&s),
  ```
  If written as `[a-zA-Z0-9_$@/#-.]+`, the regex greedily consumes `foo..bar` as a single ref name instead of three distinct tokens: identifier `foo`, operator `..`, identifier `bar`.
* **Zero OID vs Null Representation**:
  Git uses null hashes (`0000000000000000000000000000000000000000`) for deleted branches and unborn heads.
  ```rust
  // Type-level distinction between NonZeroOid and MaybeZeroOid prevents null-pointer panics
  pub enum MaybeZeroOid {
      NonZero(NonZeroOid),
      Zero,
  }
  ```
  Comparing `oid == git2::Oid::zero()` directly in logic creates silent boolean bugs when string representations mismatch (e.g. 20-byte SHA-1 zero vs 32-byte SHA-256 zero). Using `MaybeZeroOid` enforces complete pattern matching at compile time.

### 2. Infinite Loop & Recursion Guards
* **Multi-Progress Spinner Deadlock Guard**:
  When managing nested progress bars in `RootOperation` (`git-branchless-lib/src/core/effects.rs`), calling `MultiProgress::add` while the draw target is active causes an internal mutex deadlock inside `indicatif`.
  ```rust
  pub fn refresh_multi_progress(&mut self) {
      for (nesting_level, operation) in operations {
          // INVARIANT: Draw target MUST be set to hidden BEFORE adding to MultiProgress
          operation
              .progress_bar
              .set_draw_target(ProgressDrawTarget::hidden());

          self.multi_progress.add(operation.progress_bar.clone());

          // Draw target can only be retargeted or ticked AFTER the internal lock is released
          operation.tick(nesting_level);
      }
  }
  ```
* **Garbage-Collected Object Traversal Termination in DAG**:
  In `GitParentsBlocking::parent_names` (`git-branchless-lib/src/core/dag.rs`), graph traversal over commits can encounter an OID that has been pruned from Git's object store or is a non-commit annotated tag. Returning an error terminates the entire traversal, while panicking crashes the tool.
  ```rust
  let commit = match repo.find_commit(oid)? {
      Some(commit) => commit,
      None => {
          // INVARIANT: Pruned commits MUST return empty parent vec to terminate traversal loop,
          // rather than propagating error or spinning infinitely.
          return Ok(Vec::new());
      }
  };
  ```

### 3. UI & UX Micro-Mechanics
* **Glyph Directionality Swapping on Inversion**:
  When users specify `smartlog.reverse = true`, tree branches and merge arrows inverted in ASCII/Unicode must swap both vertical directions and branch-joining curves (`split` vs `merge`):
  ```rust
  pub fn reverse_order(mut self, reverse: bool) -> Self {
      if reverse {
          // Must swap branching split ("─╮") with merging join ("─╯")
          std::mem::swap(&mut self.split, &mut self.merge);
          // Must swap merge flow arrows ("↓" vs "↑")
          std::mem::swap(&mut self.commit_merge, &mut self.commit_merge_rev);
      }
      self
  }
  ```
* **Terminal Multi-Byte Character Width Calculation**:
  In `git-branchless-lib/src/core/effects.rs`, unicode icons must avoid width discrepancies between standard terminal emulators:
  ```rust
  pub mod icons {
      pub const CHECKMARK: &str = "✓";
      pub const EXCLAMATION: &str = "!";
      // INVARIANT: Do NOT use "✗️" (U+2717 + U+FE0F) because terminal emulators
      // diverge on whether its visual width is 1 or 2 columns, breaking ANSI alignment.
      pub const CROSS: &str = "X";
  }
  ```

### 4. Backend Concurrency & Memory Safety
* **Reference Pinning to Prevent TOCTOU Race with `git gc`**:
  Between the moment a branchless command creates a dangling commit and the moment the user restacks or views it, Git's background garbage collection could purge the unreferenced commit.
  `git-branchless-lib/src/core/gc.rs` guarantees safety by creating an explicit reference under `refs/branchless/<OID>`:
  ```rust
  pub fn mark_commit_reachable(repo: &Repo, commit_oid: NonZeroOid) -> eyre::Result<()> {
      let ref_name = format!("refs/branchless/{commit_oid}");
      if repo.find_commit(commit_oid)?.is_some() {
          repo.create_reference(
              &ref_name.into(),
              commit_oid,
              true, // force overwrite
              "branchless: marking commit as reachable",
          )?;
      }
      Ok(())
  }
  ```
* **Event Transaction ID Variable Propagation**:
  Nested Git CLI invocations must share the identical transaction boundary to prevent fragmented undo records.
  The transaction ID is passed via environment variable `BRANCHLESS_TRANSACTION_ID`:
  ```rust
  pub const BRANCHLESS_TRANSACTION_ID_ENV_VAR: &str = "BRANCHLESS_TRANSACTION_ID";
  ```
  If present, child processes reuse this ID instead of generating a new one in SQLite, guaranteeing multi-process ACID transaction atomicity.

### 5. Defect & Error Prevention ("Galti Pakadna")
* **Packed-Refs Header and Comment Parsing Pitfalls**:
  When reading `.git/packed-refs` directly (`reference_transaction::parse_packed_refs_line`), lines starting with `#` (metadata header like `# pack-refs with: peeled sorted`) or `^` (peeled object hashes) must be explicitly skipped:
  ```rust
  if line.is_empty() || line.starts_with('#') || line.starts_with('^') {
      return None;
  }
  if !line.starts_with(|c: char| c.is_ascii_hexdigit()) {
      warn!(?line, "Unrecognized pack-refs line starting character");
      return None;
  }
  ```
  Failing to skip `^` causes peeled commit hashes to be parsed as invalid reference names, poisoning the in-memory reference snapshot.

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
`git-branchless` decouples its operations into discrete crates (`git-branchless-opts`, `git-branchless-invoke`, `git-branchless-lib`, `git-branchless-revset`, `git-branchless-smartlog`, etc.). The core library crate (`git-branchless-lib`) owns the stateful domain logic and is strictly decoupled from the UI and CLI wrappers.

State ownership is strictly partitioned:
- Git owns object storage (`.git/objects`) and