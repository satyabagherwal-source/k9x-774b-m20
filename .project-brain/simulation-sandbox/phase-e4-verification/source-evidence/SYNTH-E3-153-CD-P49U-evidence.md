# Source Evidence Dossier: SYNTH-E3-153-CD-P49U
- **Title**: Backend Concurrency & Memory Safety
- **Repository**: tursodatabase/turso
- **Source Commit**: 65b33d6c
- **Parent Dossier**: 07_PROJECT_LEARNING/tursodatabase-limbo-learnings.md
- **Primary Domain**: G (Architecture Intelligence)
- **Mechanism**: SQL Schema Modification Dependency Order (DROP FUNCTION CASCADE)

---

## Forensic Source Excerpt

```
closed production bug issues:
- **Issue #11737** (2026-11-12): **postgres: drop SQL functions with DROP FUNCTION**
  *Symptoms*: ## Description  **This PR is part of #11725 now.** Its two commits (`DROP FUNCTION`, and `DROP SCHEMA ... CASCADE` with functions) moved to the branch of #11725, because `CREATE FUNCTION` without `DROP FUNCTION` is not a complete change: a stored function could not be removed. GitHub shows this PR as merged for that reason. It is not merged into `main`.  See #11725 for the description and the stack order.  🤖 Generated with [Claude Code](https://claude.com/claude-code)  https://claude.ai/code/session_01SLcVSJFZw3qJhrS7iwMo88
  **Post-Mortem & Fix Analysis**:
  > ### Autofixer review <sub>🔄 Autofixer updates this comment while the review runs.</sub>  Review cancelled: the pull request was closed. 

- **Issue #11724** (2026-11-11): **limbo_sim: DeleteSelect fails in MVCC mode when a forced COMMIT ends the deleting transaction before the SELECT**
  *Symptoms*: ## Summary  In MVCC mode, the `DeleteSelect` property of `limbo_sim` fails with this assertion:  ``` Assertion '`SELECT * FROM t WHERE (p)` should return no values for table `t`' failed: expected no rows but got N rows ```  The engine is correct. The property is wrong. The rows that the `SELECT` finds were not visible to the snapshot of the `DELETE`.  ## Reproduction  On `main` at d5fdf4d8, each of these seeds fails with this assertion:  ```bash cargo run --release -p limbo_sim -- --disable-bugbase --mvcc true --seed 1 ```  ```bash cargo run --release -p limbo_sim -- --disable-bugbase --mvcc true --seed 26134076604605 ```  ```bash cargo run --release -p limbo_sim -- --disable-bugbase --mvcc true --seed 17106953217057 ```  ```bash cargo run --release -p limbo_sim -- --disable-bugbase --mvcc true --profile write_stress --seed 7115677748372 ```  In a loop of random seeds with `--mvcc
```
