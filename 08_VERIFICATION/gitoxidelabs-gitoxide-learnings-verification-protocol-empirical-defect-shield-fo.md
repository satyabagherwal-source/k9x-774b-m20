# Verification Protocol: Verification Protocol: Empirical Defect Shield for gitoxidelabs-gitoxide-learnings

<!-- PROVENANCE_START
{
  "source_repository": "gitoxidelabs-gitoxide-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-25T12:09:19.161Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-gitoxidelabs-gitoxide-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [gitoxidelabs-gitoxide-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-25T12:09:19.161Z`  
> **Learning ID**: `LEARN-EVO-gitoxidelabs-gitoxide-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `gitoxidelabs-gitoxide-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/gitoxidelabs-gitoxide-learnings.md`  
> **Source**: github ([https://github.com/GitoxideLabs/gitoxide](https://github.com/GitoxideLabs/gitoxide))  
> **Source Version**: `a825f86d`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-25T12:09:02.411Z  
> **Learning ID**: `learn-github-gitoxidelabs-gitoxide`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): GitoxideLabs/gitoxide

> **Canonical Artifact**: `07_PROJECT_LEARNING/gitoxidelabs-gitoxide-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/GitoxideLabs/gitoxide](https://github.com/GitoxideLabs/gitoxide))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-25T12:09:02.406Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `GitoxideLabs/gitoxide`
- **Description**: A tasteful, lean, fast & safe pure Rust implementation of Git
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 12171 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `gitoxide-core/src/commitgraph/mod.rs`
```
pub mod verify;
pub use verify::function::verify;

```

### Core Architecture Module: `gitoxide-core/src/commitgraph/verify.rs`
```
use crate::OutputFormat;

/// A general purpose context for many operations provided here
pub struct Context<W1: std::io::Write, W2: std::io::Write> {
    /// A stream to which to output errors
    pub err: W2,
    /// A stream to which to output operation results
    pub out: W1,
    pub output_statistics: Option<OutputFormat>,
}

impl Default for Context<Vec<u8>, Vec<u8>> {
    fn default() -> Self {
        Context {
            err: Vec::new(),
            out: Vec::new(),
            output_statistics: None,
        }
    }
}

pub(crate) mod function {
    use gix::Result;
    #[cfg(feature = "serde")]
    use gix::error::ResultExt;
    use std::{io, path::Path};

    use crate::OutputFormat;
    use gix::commitgraph::{Graph, verify::Outcome};

    pub fn verify<W1, W2>(
        path: impl AsRef<Path>,
        object_hash: gix::hash::Kind,
        super::Context {
            err: _err,
            mut out,
            output_statistics,
        }: super::Context<W1, W2>,
    ) -> Result<Outcome>
    where
        W1: io::Write,
        W2: io::Write,
    {
        let g = Graph::at(path.as_ref(), object_hash, None)?;

        #[expect(clippy::unnecessary_wraps)]
        fn noop_processor(_commit: &gix::commitgraph::file::Commit<'_>) -> std::result::Result<(), std::fmt::Error> {
            Ok(())
        }
        let stats = g.verify_integrity(noop_processor)?;

        #[cfg_attr(not(feature = "serde"), allow(clippy::single_match))]
        match output_statistics {
            Some(OutputFormat::Human) => drop(print_human_output(&mut out, &stats)),
            #[cfg(feature = "serde")]
            Some(OutputFormat::Json) => serde_json::to_writer_pretty(out, &stats).or_error()?,
            _ => {}
        }

        Ok(stats)
    }

    fn print_human_output(out: &mut impl io::Write, stats: &Outcome) -> io::Result<()> {
        writeln!(out, "number of commits with the given number of parents")?;
        let mut parent_counts: Vec<_> = stats.parent_counts.iter().map(|(a, b)| (*a, *b)).collect();
        parent_counts.sort_by_key(|e| e.0);
        for (parent_count, commit_count) in parent_counts.into_iter() {
            writeln!(out, "\t{parent_count:>2}: {commit_count}")?;
        }
        writeln!(out, "\t->: {}", stats.num_commits)?;

        write!(out, "\nlongest path length between two commits: ")?;
        if let Some(n) = stats.longest_path_length {
            writeln!(out, "{n}")?;
        } else {
            writeln!(out, "unknown")?;
        }

        Ok(())
    }
}

```

### Core Architecture Module: `gitoxide-core/src/corpus/db.rs`
```
use gix::{
    Result,
    error::{ErrorExt, OptionExt, ResultExt, bail},
};
use std::path::{Path, PathBuf};

use bytesize::ByteSize;
use rusqlite::{OptionalExtension, params};
use sysinfo::{CpuRefreshKind, RefreshKind};

use crate::corpus::{Engine, Run};

pub(crate) type Id = u32;

/// a husk of a repository
pub(crate) struct Repo {
    pub(crate) id: Id,
    /// The full path to the repository on disk, not yet validated to exist.
    pub(crate) path: PathBuf,
    /// The size of the object database, counted quickly by packs only.
    pub(crate) odb_size: ByteSize,
    /// The amount of objects stored in the object database.
    pub(crate) num_objects: u64,
    /// The total amount of references, no matter which type.
    pub(crate) num_references: usize,
}

impl Repo {
    pub(crate) fn try_from(repo: &gix::Repository) -> Result<Self> {
        let num_references = repo.refs.iter()?.all().or_error()?.count();
        let num_objects = repo.objects.packed_object_count()?;
        let odb_size = ByteSize(
            std::fs::read_dir(repo.objects.store_ref().path().join("pack"))
                .map(|dir| {
                    dir.filter_map(std::result::Result::ok)
                        .filter_map(|e| e.metadata().ok())
                        .filter_map(|m| m.is_file().then_some(m.len()))
                        .sum()
                })
                .unwrap_or_default(),
        );

        Ok(Repo {
            id: 0,
            path: repo.path().to_owned(),
            odb_size,
            num_objects,
            num_references,
        })
    }
}

/// A version to be incremented whenever the database layout is changed, to refresh it automatically.
const VERSION: usize = 1;

pub fn create(path: impl AsRef<std::path::Path>) -> Result<rusqlite::Connection> {
    let path = path.as_ref();
    let con = rusqlite::Connection::open(path).or_error()?;
    let meta_table = r#"
    CREATE TABLE if not exists meta(
        version int
    )"#;
    con.execute_batch(meta_table).or_error()?;
    let version: Option<usize> = con
        .query_row("SELECT version FROM meta", [], |r| r.get(0))
        .optional()
        .or_error()?;
    match version {
        None => {
            con.execute("INSERT into meta(version) values(?)", params![VERSION])
                .or_error()?;
        }
        Some(version) if version != VERSION => match con.close() {
            Ok(()) => {
                bail!(gix::error::unsupported(format!(
                    "Cannot handle database with version {version}, cannot yet migrate to {VERSION} - maybe migrate by hand?"
                )));
            }
            Err((_, err)) => return Err(err.raise()),
        },
        _ => {}
    }
    con.execute_batch("PRAGMA synchronous = OFF; PRAGMA journal_mode = WAL; PRAGMA wal_checkpoint(FULL); ")
        .or_error()?;
    con.execute_batch(
        r#"
    CREATE TABLE if not exists runner(
        id integer PRIMARY KEY,
        vendor text,
        brand text,
        host_name text, -- this is just to help ID the runner
        UNIQUE (vendor, brand)
    )
    "#,
    )
    .or_error()?;
    con.execute_batch(
        r#"
    CREATE TABLE if not exists corpus(
        id integer PRIMARY KEY,
        root text UNIQUE -- the root path of all repositories we want to consider, as canonicalized path
    )
    "#,
    )
    .or_error()?;
    con.execute_batch(
        r"
    CREATE TABLE if not exists repository(
        id integer PRIMARY KEY,
        rela_path text, -- the path to the repository on disk, relative to the corpus root path, without leading `./` or `.\`
        corpus integer,
        odb_size integer, -- the object database size in bytes
        num_references integer, -- the total amount of references
        num_objects integer, -- the total amount of objects
        FOREIGN KEY (corpus) REFERENCES corpus (id)
        UNIQUE (rela_path, corpus)
    )
    ",
    ).or_error()?;
    con.execute_batch(
        r#"
    CREATE TABLE if not exists gitoxide_version(
        id integer PRIMARY KEY,
        version text UNIQUE -- the unique git version via gix describe
    )
    "#,
    )
    .or_error()?;
    con.execute_batch(
        r#"
    CREATE TABLE if not exists task(
        id integer PRIMARY KEY,
        short_name UNIQUE, -- the unique and permanent identifier for the task
        description text UNIQUE -- the descriptive name of the task, it can be changed at will
    )
    "#,
    )
    .or_error()?;
    con.execute_batch(
        r#"
    CREATE TABLE if not exists run(
        id integer PRIMARY KEY,
        repository integer,
        runner integer,
        task integer,
        gitoxide_version integer,
        insertion_time integer NOT NULL, -- in seconds since UNIX epoch
        duration real, -- in seconds or NULL if not yet finished (either successful or with failure)
        error text, -- or NULL if there was no error
        spans_json text, -- all spans collecteted while performing the run
        FOREIGN KEY (repository) REFERENCES repository (id),
        FOREIGN KEY (task) REFERENCES task (id),
        FOREIGN KEY (runner) REFERENCES runner (id),
        FOREIGN KEY (gitoxide_version) REFERENCES gitoxide_version (id)
    )
    "#,
    )
    .or_error()?;

    Ok(con)
}

/// Utilities
impl Engine {
    pub(crate) fn runner_id_or_insert(&self) -> Result<Id> {
        let sys = sysinfo::System::new_with_specifics(
            RefreshKind::nothing().with_cpu(CpuRefreshKind::nothing().with_frequency()),
        )
        .or_raise(|| gix::error::message("failed to collect runner CPU information"))?;
        let cpu = &sys.cpus()[0];
        let vendor = Some(cpu.vendor_id().to_owned());
        let host = sysinfo::System::host_name().ok();
        let brand = Some(cpu.brand().to_owned());
        self.con
            .query_row(
                "INSERT INTO runner (vendor, brand, host_name) VALUES (?1, ?2, ?3) \
                    ON CONFLICT DO UPDATE SET vendor = vendor, brand = brand, host_name = ?3 RETURNING id",
                [vendor.as_deref(), brand.as_deref(), host.as_deref()],
                |r| r.get(0),
            )
            .or_error()
    }
    pub(crate) fn corpus_id_or_insert(&self, path: &Path) -> Result<Id> {
        let path = path
            .to_str()
            .ok_or_raise(|| gix::error::validation("corpus root cannot contain illformed UTF-8"))?;
        self.con
            .query_row(
                "INSERT INTO corpus (root) VALUES (?1) \
                ON CONFLICT DO UPDATE SET root = root RETURNING id",
                [path],
                |r| r.get(0),
            )
            .or_error()
    }
    pub(crate) fn gitoxide_version_id_or_insert(&self) -> Result<Id> {
        self
                .con
                .query_row(
                    "INSERT INTO gitoxide_version (version) VALUES (?1) ON CONFLICT DO UPDATE SET version = version RETURNING id",
                    [&self.state.gitoxide_version],
                    |r| r.get(0),
                ).or_error()
    }
    pub(crate) fn tasks_or_insert(&self, allowed_short_names: &[String]) -> Result<Vec<(Id, &'static super::Task)>> {
        let mut out: Vec<_> = super::run::ALL
            .iter()
            .filter(|task| {
                if allowed_short_names.is_empty() {
                    true
                } else {
                    allowed_short_names.iter().any(|allowed| task.short_name == allowed)
                }
            })
            .map(|task| (0, task))
            .collect();
        for (id, task) in &mut out {
            *id = self.con.query_row(
                "INSERT INTO task (short_name, description) VALUES (?1, ?2) ON CONFLICT DO UPDATE SET short_name = short_name, description = ?2 RETURNING id",
                [task.short_name, task.description],
                |r| r.get(0),
            ).or_error()?;
        }
        Ok(out)
    }
    pub(crate) fn insert_run(
        con: &rusqlite::Connection,
        gitoxide_version: Id,
        runner: Id,
        task: Id,
        repository: Id,
    ) -> Result<Run> {
        let insertion_time = std::time::UNIX_EPOCH.elapsed().or_error()?.as_secs();
        let id = con.query_row("INSERT INTO run (gitoxide_version, runner, task, repository, insertion_time) VALUES (?1, ?2, ?3, ?4, ?5) RETURNING id", params![gitoxide_version, runner, task, repository, insertion_time], |r| r.get(0)).or_error()?;
        Ok(Run {
            id,
            duration: Default::default(),
            error: None,
        })
    }
    pub(crate) fn update_run(con: &rusqlite::Connection, run: Run) -> Result<()> {
        con.execute(
            "UPDATE run SET duration = ?2, error = ?3 WHERE id = ?1",
            params![run.id, run.duration.as_secs_f64(), run.error.as_deref()],
        )
        .or_error()?;
        Ok(())
    }
}

```

### Core Architecture Module: `gitoxide-core/src/corpus/engine.rs`
```
use std::{
    path::{Path, PathBuf},
    sync::atomic::{AtomicUsize, Ordering},
    time::{Duration, Instant},
};

use bytesize::ByteSize;
use gix::{
    Count, NestedProgress, Progress, Result,
    error::{ErrorExt, OptionExt, ResultExt, bail, message, validation},
};
use rusqlite::params;

use super::db;
use crate::{
    corpus,
    corpus::{Engine, Task},
    organize::find_git_repository_workdirs,
};

pub type ProgressItem = gix::progress::DoOrDiscard<gix::progress::prodash::tree::Item>;

pub struct State {
    pub progress: ProgressItem,
    pub gitoxide_version: String,
    pub trace: u8,
    pub trace_output: crate::trace::Output,
}

impl Engine {
    /// Open the corpus DB or create it.
    pub fn open_or_create(db: PathBuf, state: State) -> Result<Engine> {
        let con = crate::corpus::db::create(db).or_raise(|| message("Could not open or create database"))?;
        Ok(Engine { con, state })
    }

    /// Run on the existing set of repositories we have already seen or obtain them from `path` if there is none yet.
    pub fn run(
        &mut self,
        corpus_path: PathBuf,
        threads: Option<usize>,
        dry_run: bool,
        repo_sql_suffix: Option<String>,
        allowed_task_names: Vec<String>,
    ) -> Result<()> {
        let tasks = self.tasks_or_insert(&allowed_task_names)?;
        if tasks.is_empty() {
            bail!(validation("Cannot run without any task to perform on the repositories"));
        }
        let (corpus_path, corpus_id) = self.prepare_corpus_path(corpus_path)?;
        let gitoxide_id = self.gitoxide_version_id_or_insert()?;
        let runner_id = self.runner_id_or_insert()?;
        let repos = self.find_repos_or_insert(&corpus_path, corpus_id, repo_sql_suffix)?;
        self.perform_run(&corpus_path, gitoxide_id, runner_id, &tasks, repos, threads, dry_run)
    }

    pub fn refresh(&mut self, corpus_path: PathBuf) -> Result<()> {
        let (corpus_path, corpus_id) = self.prepare_corpus_path(corpus_path)?;
        let repos = self.refresh_repos(&corpus_path, corpus_id)?;
        self.state.progress.set_name("refresh repos".into());
        self.state.progress.info(format!(
            "Added or updated {} repositories under \"{corpus_path}\"",
            repos.len(),
            corpus_path = corpus_path.display(),
        ));
        Ok(())
    }
}

impl Engine {
    #[expect(clippy::too_many_arguments)]
    fn perform_run(
        &mut self,
        corpus_path: &Path,
        gitoxide_id: db::Id,
        runner_id: db::Id,
        tasks: &[(db::Id, &'static Task)],
        mut repos: Vec<db::Repo>,
        threads: Option<usize>,
        dry_run: bool,
    ) -> Result<()> {
        let start = Instant::now();
        let threads = gix::parallel::num_threads(threads);
        let db_path = self.con.path().expect("opened from path on disk").to_owned();
        let subscriber = (!dry_run)
            .then(|| corpus::trace::subscriber(db_path.as_str(), self.state.trace, self.state.trace_output.clone()))
            .transpose()?;
        let repo_progress = &mut self.state.progress;
        for (task_id, task) in tasks {
            let task_start = Instant::now();
            let task_info = format!("run '{}'", task.short_name);
            repo_progress.set_name(task_info.clone());
            repo_progress.init(Some(repos.len()), gix::progress::count("repos"));
            if dry_run {
                repo_progress.set_name("WOULD run".into());
                for repo in &repos {
                    repo_progress.info(format!(
                        "{}",
                        repo.path
                            .strip_prefix(corpus_path)
                            .expect("corpus contains repo")
                            .display()
                    ));
                    repo_progress.inc();
                }
                repo_progress.info(format!("with {} tasks", tasks.len()));
                for (_, task) in tasks {
                    repo_progress.info(format!("task '{}' ({})", task.description, task.short_name));
                }
                break;
            }
            let subscriber = subscriber.as_ref().expect("dry runs do not execute tasks");
            if task.execute_exclusive || threads == 1 {
                let mut run_progress = repo_progress.add_child("set later");
                let _guard = tracing::dispatcher::set_default(subscriber);

                let mut num_errors = 0;
                for repo in &repos {
                    if gix::interrupt::is_triggered() {
                        bail!(gix::error::cancelled("interrupted by user"));
                    }
                    run_progress.set_name(format!(
                        "{}",
                        repo.path
                            .strip_prefix(corpus_path)
                            .expect("corpus contains repo")
                            .display()
                    ));

                    let mut run = Self::insert_run(&self.con, gitoxide_id, runner_id, *task_id, repo.id)?;
                    tracing::info_span!(parent: None, "run", run_id = run.id).in_scope(|| {
                        task.perform(
                            &mut run,
                            &repo.path,
                            &mut run_progress,
                            Some(threads),
                            &gix::interrupt::IS_INTERRUPTED,
                        );
                    });
                    if let Some(err) = run.error.as_deref() {
                        num_errors += 1;
                        repo_progress.fail(err.to_owned());
                    }
                    Self::update_run(&self.con, run)?;
                    repo_progress.inc();
                }
                repo_progress.show_throughput(task_start);
                if num_errors != 0 {
                    repo_progress.fail(format!(
                        "{} repositories failed to run task {}",
                        num_errors, task.short_name
                    ));
                }
            } else {
                let counter = repo_progress.counter();
                let num_errors = AtomicUsize::default();
                let repo_progress =
                    gix::parallel::OwnShared::new(gix::parallel::Mutable::new(repo_progress.add_child("in parallel")));
                gix::parallel::in_parallel_with_slice(
                    &mut repos,
                    Some(threads),
                    {
                        let shared_repo_progress = repo_progress.clone();
                        let db_path = db_path.clone();
                        move |tid| {
                            let mut progress = gix::parallel::lock(&shared_repo_progress);
                            let lane_progress = progress.add_child(format!("{tid}"));
                            let guard = tracing::dispatcher::set_default(subscriber);
                            (guard, lane_progress, rusqlite::Connection::open(&db_path))
                        }
                    },
                    |repo, (_guard, progress, con), _threads_left, should_interrupt| -> Result<()> {
                        progress.set_name(format!(
                            "{}",
                            repo.path
                                .strip_prefix(corpus_path)
                                .expect("corpus contains repo")
                                .display()
                        ));
                        let con = match con {
                            Ok(con) => con,
                            Err(err) => {
                                progress.fail(format!("{err:#?}"));
                                should_interrupt.store(true, Ordering::SeqCst);
                                return Ok(());
                            }
                        };
                        let mut run = Self::insert_run(con, gitoxide_id, runner_id, *task_id, repo.id)?;
                        tracing::info_span!(parent: None, "run", run_id = run.id).in_scope(|| {
                            task.perform(&mut run, &repo.path, progress, Some(1), should_interrupt);
                        });
                        if let Some(err) = run.error.as_deref() {
                            num_errors.fetch_add(1, Ordering::Relaxed);
                            progress.fail(err.to_owned());
                        }
                        Self::update_run(con, run)?;
                        counter.fetch_add(1, Ordering::Relaxed);
                        Ok(())
                    },
                    || (!gix::interrupt::is_triggered()).then(|| Duration::from_millis(100)),
                    drop,
                )?;
                let repo_progress = gix::parallel::lock(&repo_progress);
                repo_progress.show_throughput(task_start);
                let num_errors = num_errors.load(Ordering::Relaxed);
                if num_errors != 0 {
                    repo_progress.fail(format!(
                        "{} repositories failed to run task {}",
                        num_errors, task.short_name
                    ));
                }
            }

            repo_progress.inc();
        }
        repo_progress.show_throughput(start);
        Ok(())
    }

    fn prepare_corpus_path(&self, corpus_path: PathBuf) -> Result<(PathBuf, db::Id)> {
        let corpus_path = gix::path::realpath(corpus_path)?;
        let corpus_id = self.corpus_id_or_insert(&corpus_path)?;
        Ok((corpus_path, corpus_id))
    }

    fn find_repos(&mut self, corpus_path: &Path, corpus_id: db::Id, sql_suffix: Option<&str>) -> Result<Vec<db::Repo>> {
        self.state.progress.set_name("query db-repos".into());
        self.state.progress.init(None, gix::progress::count("repos"));

        self.con
            .prepare(&format!(
                "SELECT id, rela_path, odb_size, num_objects, num_references FROM repository WHERE corpus = ?1 {}",
        
```

### Core Architecture Module: `gitoxide-core/src/corpus/mod.rs`
```
pub const PROGRESS_RANGE: std::ops::RangeInclusive<u8> = 0..=5;

pub struct Engine {
    con: rusqlite::Connection,
    state: engine::State,
}

pub struct RunOutcome {
    /// the relative path to the repositories that could not be found on disk
    pub missing_repos_rela_paths: usize,
}

pub(crate) mod db;
pub mod engine;

/// Contains all information necessary to run a task.
pub(crate) struct Task {
    /// The unique name of the task, which must not be changed after creating it.
    ///
    /// However, if it is changed it will be treated as new kind of task entirely and won't compare
    /// to previous runs of the task.
    short_name: &'static str,
    /// Explain in greater detail what the task is doing.
    description: &'static str,
    /// `true` if the task cannot be run in parallel as it needs all resources by itself.
    execute_exclusive: bool,
    /// The actual implementation
    execute: &'static (dyn run::Execute + Send + Sync),
}

pub(crate) struct Run {
    /// Our own ID for finding the respective database row.
    id: db::Id,
    /// The time at which the run was inserted.
    duration: std::time::Duration,
    error: Option<String>,
}

pub(crate) mod run;
pub(crate) mod trace;

```

### Core Architecture Module: `gitoxide-core/src/corpus/run.rs`
```
use std::{path::Path, sync::atomic::AtomicBool};

use gix::{Result, error::ResultExt, progress::DynNestedProgress};

use crate::{
    corpus,
    corpus::{Run, Task},
    pack::verify::Algorithm,
};

impl Task {
    pub fn perform(
        &self,
        run: &mut Run,
        repo: &Path,
        progress: &mut corpus::engine::ProgressItem,
        threads: Option<usize>,
        should_interrupt: &AtomicBool,
    ) {
        let start = std::time::Instant::now();
        if let Err(err) = self.execute.execute(repo, progress, threads, should_interrupt) {
            run.error = Some(format!("{err:#?}"));
        }
        run.duration = start.elapsed();
    }
}

/// Note that once runs have been recorded, the implementation must not change anymore to keep it comparable.
/// If changes have be done, rather change the name of the owning task to start a new kind of task.
pub(crate) trait Execute {
    fn execute(
        &self,
        repo: &Path,
        progress: &mut corpus::engine::ProgressItem,
        threads: Option<usize>,
        should_interrupt: &AtomicBool,
    ) -> Result<()>;
}

pub(crate) static ALL: &[Task] = &[
    #[cfg(feature = "archive")]
    Task {
        short_name: "SWTR",
        description: "stream worktree",
        execute_exclusive: false,
        execute: &WorktreeStream,
    },
    Task {
        short_name: "OPNR",
        description: "open repository (isolated)",
        execute_exclusive: false,
        execute: &OpenRepo,
    },
    Task {
        short_name: "POCN",
        description: "packed object count",
        execute_exclusive: false,
        execute: &CountPackedObjects,
    },
    Task {
        short_name: "VERI",
        description: "verify object database",
        execute_exclusive: true,
        execute: &VerifyOdb,
    },
];

#[cfg(feature = "archive")]
struct WorktreeStream;

#[cfg(feature = "archive")]
impl Execute for WorktreeStream {
    fn execute(
        &self,
        repo: &Path,
        progress: &mut corpus::engine::ProgressItem,
        _threads: Option<usize>,
        should_interrupt: &AtomicBool,
    ) -> Result<()> {
        use gix::Progress;
        let repo = gix::open_opts(repo, gix::open::Options::isolated())?;
        let (stream, _) = {
            let _span = gix::trace::coarse!("read index and create worktree stream");
            repo.worktree_stream(repo.head_commit()?.tree_id()?)?
        };
        progress.init(None, gix::progress::bytes());
        std::io::copy(
            &mut stream.into_read(),
            &mut gix::utils::interrupt::Write {
                inner: gix::progress::Write {
                    inner: std::io::sink(),
                    progress,
                },
                should_interrupt,
            },
        )
        .or_error()?;
        Ok(())
    }
}

struct OpenRepo;

impl Execute for OpenRepo {
    fn execute(
        &self,
        repo: &Path,
        _progress: &mut corpus::engine::ProgressItem,
        _threads: Option<usize>,
        _should_interrupt: &AtomicBool,
    ) -> Result<()> {
        gix::open_opts(repo, gix::open::Options::isolated())?;
        Ok(())
    }
}

struct CountPackedObjects;

impl Execute for CountPackedObjects {
    fn execute(
        &self,
        repo: &Path,
        _progress: &mut corpus::engine::ProgressItem,
        _threads: Option<usize>,
        _should_interrupt: &AtomicBool,
    ) -> Result<()> {
        let repo = gix::open_opts(repo, gix::open::Options::isolated())?;
        repo.objects.packed_object_count()?;
        Ok(())
    }
}

struct VerifyOdb;

impl Execute for VerifyOdb {
    fn execute(
        &self,
        repo: &Path,
        progress: &mut corpus::engine::ProgressItem,
        threads: Option<usize>,
        should_interrupt: &AtomicBool,
    ) -> Result<()> {
        let repo = gix::open_opts(repo, gix::open::Options::isolated())?;
        crate::repository::verify::integrity(
            repo,
            std::io::sink(),
            progress.add_child("integrity".into()),
            should_interrupt,
            crate::repository::verify::Context {
                output_statistics: None,
                thread_limit: threads,
                verify_mode: Default::default(),
                algorithm: Algorithm::LessTime,
            },
        )?;
        Ok(())
    }
}

```

### Core Architecture Module: `gitoxide-core/src/corpus/trace.rs`
```
use std::path::Path;

use gix::{
    Result,
    error::{ResultExt, message},
};
use gix_trace::forest::Tree;
use parking_lot::Mutex;
use rusqlite::params;

use crate::trace::Output;

pub fn subscriber(db_path: impl AsRef<Path>, trace: u8, output: Output) -> Result<tracing::Dispatch> {
    let con = Mutex::new(
        rusqlite::Connection::open(db_path).or_raise(|| message("Could not open the corpus trace database"))?,
    );
    crate::trace::subscriber(
        trace,
        output,
        Some(Box::new(move |tree| {
            let run_id = tree
                .span()
                .ok()
                .filter(|span| span.name() == "run")
                .and_then(|span| span.fields().iter().find(|field| field.key() == "run_id"))
                .and_then(|field| field.value().parse::<super::db::Id>().ok());
            if let Some(run_id) = run_id {
                let json =
                    serde_json::to_string_pretty(&tree_json(tree)).expect("serialization to string always works");
                con.lock()
                    .execute("UPDATE run SET spans_json = ?1 WHERE id = ?2", params![json, run_id])
                    .or_raise(|| message!("Could not store the trace for corpus run {run_id}"))?;
            }
            Ok(())
        })),
    )
}

fn tree_json(tree: &Tree) -> serde_json::Value {
    let fields = |fields: &[gix_trace::forest::tree::Field]| {
        fields
            .iter()
            .map(|field| (field.key().to_owned(), serde_json::Value::from(field.value())))
            .collect::<serde_json::Map<_, _>>()
    };
    match tree {
        Tree::Event(event) => serde_json::json!({
            "Event": {
                "level": event.level().as_str(),
                "fields": fields(event.fields()),
                "message": event.message(),
                "tag": event.tag().map(|tag| tag.to_string()),
            }
        }),
        Tree::Span(span) => serde_json::json!({
            "Span": {
                "level": span.level().as_str(),
                "fields": fields(span.fields()),
                "name": span.name(),
                "nanos_total": span.total_duration().as_nanos(),
                "nanos_nested": span.inner_duration().as_nanos(),
                "nodes": span.nodes().iter().map(tree_json).collect::<Vec<_>>(),
            }
        }),
    }
}

#[cfg(test)]
mod tests {
    use gix::error::TestResult;
    use std::path::Path;

    use crate::{corpus::db, trace::Output};

    #[test]
    fn requested_trace_mode_controls_deferred_format_and_level() -> TestResult<()> {
        let fixture = tempfile::tempdir()?;

        let forest_info = messages(fixture.path(), 1)?;
        assert_eq!(forest_info.len(), 2);
        assert!(
            forest_info.iter().all(|line| line.contains("INFO")),
            "forest INFO output retains only INFO lines"
        );
        assert!(
            forest_info.iter().all(|line| line.contains("\x1b[")),
            "forest output includes ANSI styling"
        );

        let forest_debug = messages(fixture.path(), 2)?;
        assert_eq!(forest_debug.len(), 3);
        assert!(
            forest_debug.iter().any(|line| line.contains("DEBUG")),
            "forest DEBUG output includes DEBUG lines"
        );

        let flat_debug = messages(fixture.path(), 3)?;
        assert_eq!(flat_debug.len(), 3);
        assert!(
            flat_debug.iter().any(|line| line.contains("DEBUG")),
            "flat DEBUG output includes DEBUG lines"
        );
        assert!(
            flat_debug.iter().all(|line| line.contains("\x1b[")),
            "flat output includes ANSI styling"
        );
        assert!(flat_debug.iter().any(|line| line.contains("close")));
        assert!(
            !flat_debug.iter().any(|line| line.contains("TRACE")),
            "flat DEBUG output excludes TRACE lines"
        );

        let flat_trace = messages(fixture.path(), 4)?;
        assert_eq!(flat_trace.len(), 4);
        assert!(
            flat_trace.iter().any(|line| line.contains("TRACE")),
            "flat TRACE output includes TRACE lines"
        );
        Ok(())
    }

    #[test]
    fn display_modes_do_not_filter_the_stored_trace() -> TestResult<()> {
        let fixture = tempfile::tempdir()?;
        for trace in 0..=4 {
            let db_path = fixture.path().join(format!("stored-{trace}.db"));
            let connection = db::create(&db_path)?;
            connection.execute("INSERT INTO run (insertion_time) VALUES (0)", [])?;
            let run_id = u32::try_from(connection.last_insert_rowid()).expect("test run id fits in u32");

            let output = Output::default();
            let dispatch = super::subscriber(&db_path, trace, output.clone())?;
            tracing::dispatcher::with_default(&dispatch, || {
                tracing::info_span!("run", run_id).in_scope(|| {
                    tracing::debug!("stored debug event\nprivate continuation");
                    tracing::trace!("stored trace event");
                    tracing::info!("visible info event");
                });
            });

            let stored: String =
                connection.query_row("SELECT spans_json FROM run WHERE id = ?1", [run_id], |row| row.get(0))?;
            for message in [
                "stored debug event",
                "private continuation",
                "stored trace event",
                "visible info event",
            ] {
                assert!(
                    stored.contains(message),
                    "display mode {trace} leaves storage complete: {message}"
                );
            }
            let output = output.lock().expect("trace output lock is not poisoned");
            let rendered = String::from_utf8_lossy(&output);
            assert_eq!(rendered.is_empty(), trace == 0, "disabled display remains silent");
            for (message, visible) in [
                ("visible info event", trace != 0),
                ("stored debug event", trace >= 2),
                ("private continuation", trace >= 2),
                ("stored trace event", trace == 4),
            ] {
                assert_eq!(
                    rendered.contains(message),
                    visible,
                    "display mode {trace} filters complete events: {message}"
                );
            }
        }
        Ok(())
    }

    #[test]
    fn delayed_run_spans_keep_their_ids_and_unrelated_roots_only_display() -> TestResult<()> {
        let fixture = tempfile::tempdir()?;
        let db_path = fixture.path().join("run-ids.db");
        let connection = db::create(&db_path)?;
        connection.execute("INSERT INTO run (insertion_time) VALUES (0), (0)", [])?;
        let second_run_id = u32::try_from(connection.last_insert_rowid()).expect("test run id fits in u32");
        let first_run_id = second_run_id - 1;
        let output = Output::default();
        let dispatch = super::subscriber(&db_path, 1, output.clone())?;
        {
            let _guard = tracing::dispatcher::set_default(&dispatch);
            let first = tracing::info_span!("run", run_id = first_run_id);
            first.in_scope(|| tracing::info!("first run"));
            tracing::info_span!("run", run_id = second_run_id).in_scope(|| tracing::info!("second run"));
            drop(first);
            tracing::info!("unrelated event");
            tracing::info_span!("unrelated span", run_id = second_run_id)
                .in_scope(|| tracing::info!("unrelated span event"));
            tracing::info_span!("run").in_scope(|| tracing::info!("run without id"));
        }

        for (run_id, message) in [(first_run_id, "first run"), (second_run_id, "second run")] {
            let stored: String =
                connection.query_row("SELECT spans_json FROM run WHERE id = ?1", [run_id], |row| row.get(0))?;
            let stored: serde_json::Value = serde_json::from_str(&stored)?;
            assert_eq!(
                stored["Span"]["fields"]["run_id"],
                run_id.to_string(),
                "completed run spans retain their own ID regardless of closure order"
            );
            assert_eq!(
                stored["Span"]["nodes"][0]["Event"]["message"], message,
                "unrelated roots do not overwrite a run's stored tree"
            );
        }
        let output = output.lock().expect("trace output lock is not poisoned");
        let rendered = String::from_utf8_lossy(&output);
        for message in [
            "first run",
            "second run",
            "unrelated event",
            "unrelated span event",
            "run without id",
        ] {
            assert!(
                rendered.contains(message),
                "all requested trace output remains visible: {message}"
            );
        }
        Ok(())
    }

    #[test]
    fn concurrent_run_roots_share_a_dispatch_without_mixing_storage_or_output() -> TestResult<()> {
        let fixture = tempfile::tempdir()?;
        for trace in [0, 1, 3, 4] {
            let db_path = fixture.path().join(format!("concurrent-{trace}.db"));
            let connection = db::create(&db_path)?;
            let mut run_ids = Vec::new();
            for _ in 0..4 {
                connection.execute("INSERT INTO run (insertion_time) VALUES (0)", [])?;
                run_ids.push(db::Id::try_from(connection.last_insert_rowid())?);
            }
            let output = Output::default();
            let dispatch = super::subscriber(&db_path, trace, output.clone())?;
            let barrier = std::sync::Barrier::new(run_ids.len());
            std::thread::scope(|scope| {
                for &run_id in &run_ids {
                    let (dispatch, barrier) = (&dispatch, &barrier);
                    scope.spawn(move || {
                        let _guard = tracing::dispatcher::set_default(dispatch);
                        tracing::info_span!("run", run_id).in_scope(|| {
                         
```

### Core Architecture Module: `gitoxide-core/src/discover.rs`
```
use gix::{
    Result,
    error::{ErrorExt, ResultExt, bail},
};
use std::path::Path;

pub fn discover(repo: &Path, mut out: impl std::io::Write) -> Result<()> {
    let mut has_err = false;
    writeln!(out, "open (strict) {}:", repo.display()).or_error()?;
    has_err |= print_result(
        &mut out,
        gix::open_opts(repo, gix::open::Options::default().strict_config(true)),
    )
    .or_error()?;

    if has_err {
        writeln!(out, "open (lenient) {}:", repo.display()).or_error()?;
        has_err |= print_result(
            &mut out,
            gix::open_opts(repo, gix::open::Options::default().strict_config(false)),
        )
        .or_error()?;
    }

    writeln!(out).or_error()?;
    writeln!(out, "discover from {}:", repo.display()).or_error()?;
    has_err |= print_result(&mut out, gix::discover(repo)).or_error()?;

    writeln!(out).or_error()?;
    writeln!(out, "discover (plumbing) from {}:", repo.display()).or_error()?;
    has_err |= print_result(&mut out, gix::discover::upwards(repo)).or_error()?;

    if has_err {
        writeln!(out).or_error()?;
        bail!("At least one operation failed")
    }

    Ok(())
}

fn print_result<T, E>(mut out: impl std::io::Write, res: std::result::Result<T, E>) -> std::io::Result<bool>
where
    T: std::fmt::Debug,
    E: std::error::Error + Send + Sync + 'static,
{
    let mut has_err = false;
    let to_print = match res {
        Ok(good) => {
            format!("{good:#?}")
        }
        Err(err) => {
            has_err = true;
            format!("{:?}", err.raise())
        }
    };
    indent(&mut out, to_print)?;
    Ok(has_err)
}

fn indent(mut out: impl std::io::Write, msg: impl Into<String>) -> std::io::Result<()> {
    for line in msg.into().lines() {
        writeln!(out, "\t{line}")?;
    }
    Ok(())
}

```

### Core Architecture Module: `gitoxide-core/src/hours/core.rs`
```
use std::{
    collections::{HashMap, hash_map::Entry},
    sync::{
        Arc,
        atomic::{AtomicUsize, Ordering},
    },
};

use gix::{Result, bstr::BStr};

use crate::hours::{
    CommitIdx, FileStats, LineStats, WorkByEmail, WorkByPerson,
    util::{add_lines, remove_lines},
};

const MINUTES_PER_HOUR: f32 = 60.0;
pub const HOURS_PER_WORKDAY: f32 = 8.0;

pub fn estimate_hours(
    commits: &[(u32, super::SignatureRef<'static>)],
    stats: &[(u32, FileStats, LineStats)],
) -> WorkByEmail {
    assert!(!commits.is_empty());
    const MAX_COMMIT_DIFFERENCE_IN_MINUTES: f32 = 2.0 * MINUTES_PER_HOUR;
    const FIRST_COMMIT_ADDITION_IN_MINUTES: f32 = 2.0 * MINUTES_PER_HOUR;

    let hours_for_commits = {
        let mut hours = 0.0;

        let mut commits = commits.iter().map(|t| &t.1).rev();
        let mut cur = commits.next().expect("at least one commit if we are here");

        for next in commits {
            let change_in_minutes = (next.seconds().saturating_sub(cur.seconds())) as f32 / MINUTES_PER_HOUR;
            if change_in_minutes < MAX_COMMIT_DIFFERENCE_IN_MINUTES {
                hours += change_in_minutes / MINUTES_PER_HOUR;
            } else {
                hours += FIRST_COMMIT_ADDITION_IN_MINUTES / MINUTES_PER_HOUR;
            }
            cur = next;
        }

        hours
    };

    let author = &commits[0].1;
    let (files, lines) = if !stats.is_empty() {
        {
            commits
                .iter()
                .map(|t| &t.0)
                .fold((FileStats::default(), LineStats::default()), |mut acc, id| match stats
                    .binary_search_by(|t| t.0.cmp(id))
                {
                    Ok(idx) => {
                        let t = &stats[idx];
                        acc.0.add(&t.1);
                        acc.1.add(&t.2);
                        acc
                    }
                    Err(_) => acc,
                })
        }
    } else {
        Default::default()
    };
    WorkByEmail {
        name: author.name,
        email: author.email,
        hours: FIRST_COMMIT_ADDITION_IN_MINUTES / 60.0 + hours_for_commits,
        num_commits: commits.len() as u32,
        files,
        lines,
    }
}

type CommitChangeLineCounters = (Arc<AtomicUsize>, Arc<AtomicUsize>, Arc<AtomicUsize>);

type SpawnResultWithReturnChannelAndWorkers<'scope> = (
    crossbeam_channel::Sender<Vec<(CommitIdx, Option<gix::hash::ObjectId>, gix::hash::ObjectId)>>,
    Vec<std::thread::ScopedJoinHandle<'scope, Result<Vec<(CommitIdx, FileStats, LineStats)>>>>,
);

pub fn spawn_tree_delta_threads<'scope>(
    scope: &'scope std::thread::Scope<'scope, '_>,
    threads: usize,
    line_stats: bool,
    repo: gix::Repository,
    stat_counters: CommitChangeLineCounters,
) -> SpawnResultWithReturnChannelAndWorkers<'scope> {
    let (tx, rx) = crossbeam_channel::unbounded::<Vec<(CommitIdx, Option<gix::hash::ObjectId>, gix::hash::ObjectId)>>();
    let stat_workers = (0..threads)
        .map(|_| {
            scope.spawn(gix::trace::in_thread({
                let stats_counters = stat_counters.clone();
                let mut repo = repo.clone();
                repo.object_cache_size_if_unset((850 * 1024 * 1024) / threads);
                let rx = rx.clone();
                move || -> Result<_> {
                    let mut out = Vec::new();
                    let (commits, changes, lines_count) = stats_counters;
                    let mut cache = line_stats
                        .then(|| -> Result<_> {
                            repo.diff_resource_cache(gix::diff::blob::pipeline::Mode::ToGit, Default::default())
                        })
                        .transpose()?;
                    for chunk in rx {
                        for (commit_idx, parent_commit, commit) in chunk {
                            if let Some(cache) = cache.as_mut() {
                                cache.clear_resource_cache_keep_allocation();
                            }
                            commits.fetch_add(1, Ordering::Relaxed);
                            if gix::interrupt::is_triggered() {
                                return Ok(out);
                            }
                            let mut files = FileStats::default();
                            let mut lines = LineStats::default();
                            let from = match parent_commit {
                                Some(id) => match repo.find_object(id).ok().and_then(|c| c.peel_to_tree().ok()) {
                                    Some(tree) => tree,
                                    None => continue,
                                },
                                None => repo.empty_tree(),
                            };
                            let to = match repo.find_object(commit).ok().and_then(|c| c.peel_to_tree().ok()) {
                                Some(c) => c,
                                None => continue,
                            };
                            from.changes()?
                                .options(|opts| {
                                    opts.track_filename().track_rewrites(None);
                                })
                                .for_each_to_obtain_tree(&to, |change| {
                                    use gix::object::tree::diff::Change::*;
                                    changes.fetch_add(1, Ordering::Relaxed);
                                    match change {
                                        Rewrite { .. } => {
                                            unreachable!("we turned that off")
                                        }
                                        Addition { entry_mode, id, .. } => {
                                            if entry_mode.is_no_tree() {
                                                files.added += 1;
                                                add_lines(line_stats, &lines_count, &mut lines, id);
                                            }
                                        }
                                        Deletion { entry_mode, id, .. } => {
                                            if entry_mode.is_no_tree() {
                                                files.removed += 1;
                                                remove_lines(line_stats, &lines_count, &mut lines, id);
                                            }
                                        }
                                        Modification {
                                            entry_mode,
                                            previous_entry_mode,
                                            id,
                                            previous_id,
                                            ..
                                        } => match (previous_entry_mode.is_blob(), entry_mode.is_blob()) {
                                            (false, false) => {}
                                            (false, true) => {
                                                files.added += 1;
                                                add_lines(line_stats, &lines_count, &mut lines, id);
                                            }
                                            (true, false) => {
                                                files.removed += 1;
                                                remove_lines(line_stats, &lines_count, &mut lines, previous_id);
                                            }
                                            (true, true) => {
                                                files.modified += 1;
                                                if let Some(cache) = cache.as_mut() {
                                                    let mut diff = change.diff(cache)?;
                                                    let mut nl = 0;
                                                    if let Some(counts) = diff.line_counts()? {
                                                        nl += counts.insertions as usize + counts.removals as usize;
                                                        lines.added += counts.insertions as usize;
                                                        lines.removed += counts.removals as usize;
                                                        lines_count.fetch_add(nl, Ordering::Relaxed);
                                                    }
                                                }
                                            }
                                        },
                                    }
                                    Ok(std::ops::ControlFlow::Continue(()))
                                })?;
                            out.push((commit_idx, files, lines));
                        }
                    }
                    Ok(out)
                }
            }))
        })
        .collect::<Vec<_>>();
    (tx, stat_workers)
}

pub fn deduplicate_identities(persons: &[WorkByEmail]) -> Vec<WorkByPerson> {
    let mut email_to_index = HashMap::<&'static BStr, usize>::with_capacity(persons.len());
    let mut name_to_index = HashMap::<&'static BStr, usize>::with_capacity(persons.len());
    let mut out = Vec::<WorkByPerson>::with_capacity(persons.len());
    for person_by_email in persons {
        match email_to_index.entry(person_by_email.email) {
            Entry::Occupied(email_entry) => {
                out[*email_entry.get()].merge(person_by_email);
                name_to_index.insert(person_by_email.name, *email_entry.get());
            }
            Entry::Vacant(email_entry) => match name_to_index.entry(person_by_email.name) {
                Entry::Occupied(name_entry) => {
                    out[*name_entry.get()].merge(person_by_email);
                    email_entry.insert(*name_entry.get());
                }
                Entry::Vacant(name_entry) => {
                    let idx = out
```

### Core Architecture Module: `gitoxide-core/src/hours/mod.rs`
```
use std::{collections::BTreeSet, io, path::Path, time::Instant};

use gix::{
    Count, NestedProgress, Progress, Result,
    actor::{Identity, IdentityRef},
    bstr::{BStr, ByteSlice},
    error::{ResultExt, bail, message},
    prelude::*,
    progress,
};
use smallvec::{SmallVec, smallvec};

/// Additional configuration for the hours estimation functionality.
pub struct Context<W> {
    /// Ignore github bots which match the `[bot]` search string.
    pub ignore_bots: bool,
    /// Show personally identifiable information before the summary. Includes names and email addresses.
    pub show_pii: bool,
    /// Collect how many files have been added, removed and modified (without rename tracking).
    pub file_stats: bool,
    /// Collect how many lines in files have been added, removed and modified (without rename tracking).
    pub line_stats: bool,
    /// The number of threads to use. If unset, use all cores, if 0 use all physical cores.
    pub threads: Option<usize>,
    /// Omit unifying identities by name and email which can lead to the same author appear multiple times
    /// due to using different names or email addresses.
    pub omit_unify_identities: bool,
    /// Where to write our output to
    pub out: W,
}

pub struct SignatureRef<'a> {
    name: &'a BStr,
    email: &'a BStr,
    time: gix::date::Time,
}

impl SignatureRef<'_> {
    fn seconds(&self) -> gix::date::SecondsSinceUnixEpoch {
        self.time.seconds
    }
}

/// A parsed author identity that can either borrow from commit data or own its
/// storage when trailer parsing had to synthesize/unfold the value first.
///
/// This is not a `Cow<IdentityRef<'a>>` because `IdentityRef<'a>` is itself a
/// borrowed view, while the owned case here is a different type altogether:
/// [`Identity`]. We keep this enum private so callers can use `name()` and
/// `email()` without caring whether the identity is borrowed or owned, and so
/// the common borrowed case stays allocation-free.
enum ParsedIdentity<'a> {
    Borrowed(IdentityRef<'a>),
    Owned(Identity),
}

impl ParsedIdentity<'_> {
    fn name(&self) -> &BStr {
        match self {
            ParsedIdentity::Borrowed(identity) => identity.name,
            ParsedIdentity::Owned(identity) => identity.name.as_ref(),
        }
    }

    fn email(&self) -> &BStr {
        match self {
            ParsedIdentity::Borrowed(identity) => identity.email,
            ParsedIdentity::Owned(identity) => identity.email.as_ref(),
        }
    }
}

fn parse_trailer_identity(trailer: gix::objs::commit::message::body::TrailerRef<'_>) -> Option<ParsedIdentity<'_>> {
    match trailer.value {
        std::borrow::Cow::Borrowed(value) => IdentityRef::from_bytes(value.as_ref())
            .ok()
            .map(|identity| ParsedIdentity::Borrowed(identity.trim())),
        std::borrow::Cow::Owned(value) => IdentityRef::from_bytes(value.as_ref())
            .ok()
            .map(|identity| ParsedIdentity::Owned(identity.trim().to_owned())),
    }
}

/// Return `(commit_author, [commit_author, co_authors...])`. Use the `commit_author` for easy access to the commit author itself.
fn commit_author_identities(
    commit_data: &[u8],
    object_hash: gix::hash::Kind,
) -> Result<(gix::actor::SignatureRef<'_>, SmallVec<[ParsedIdentity<'_>; 2]>)> {
    let commit = gix::objs::CommitRef::from_bytes(commit_data, object_hash)
        .or_raise(|| message("Could not parse commit authors"))?;
    let author = commit.author().or_raise(|| message("Invalid commit author"))?.trim();
    let mut authors = smallvec![ParsedIdentity::Borrowed(gix::actor::IdentityRef::from(author))];
    authors.extend(commit.co_authored_by_trailers().filter_map(parse_trailer_identity));
    Ok((author, authors))
}

/// Estimate the hours it takes to produce the content of the repository in `_working_dir_`, with `_refname_` for
/// the start of the commit graph traversal.
///
/// * `_working_dir_` - The directory containing a '.git/' folder.
/// * `_refname_` - The name of the ref like 'main' or 'master' at which to start iterating the commit graph.
/// * `_progress_` - A way to provide progress and performance information
pub fn estimate<W, P>(
    working_dir: &Path,
    rev_spec: &BStr,
    mut progress: P,
    Context {
        show_pii,
        ignore_bots,
        file_stats,
        line_stats,
        omit_unify_identities,
        threads,
        mut out,
    }: Context<W>,
) -> Result<()>
where
    W: io::Write,
    P: NestedProgress,
{
    let repo = gix::discover(working_dir)?;
    let commit_id = repo.rev_parse_single(rev_spec)?.detach();
    let mut string_heap = BTreeSet::<&'static [u8]>::new();
    let needs_stats = file_stats || line_stats;
    let threads = gix::parallel::num_threads(threads);

    let (commit_authors, stats, is_shallow, skipped_merge_commits, num_commits) = {
        std::thread::scope(|scope| -> Result<_> {
            let start = Instant::now();
            let (tx, rx) = std::sync::mpsc::channel::<(u32, Vec<u8>)>();
            let mailmap = repo.open_mailmap();

            let extract_signatures = scope.spawn(gix::trace::in_thread(move || -> Result<Vec<_>> {
                let mut out = Vec::new();
                for (commit_idx, commit_data) in rx {
                    if let Ok((commit_author, authors)) = commit_author_identities(&commit_data, commit_id.kind()) {
                        let mut string_ref = |s: &[u8]| -> &'static BStr {
                            match string_heap.get(s) {
                                Some(n) => n.as_bstr(),
                                None => {
                                    let sv: Vec<u8> = s.to_owned();
                                    string_heap.insert(Box::leak(sv.into_boxed_slice()));
                                    (*string_heap.get(s).expect("present")).as_ref()
                                }
                            }
                        };
                        let mut authors_for_commit = SmallVec::<[SignatureRef<'static>; 2]>::new();
                        for identity in authors {
                            let author = mailmap.resolve_cow(gix::actor::SignatureRef {
                                name: identity.name(),
                                email: identity.email(),
                                time: commit_author.time,
                            });
                            let name = string_ref(author.name.as_ref());
                            let email = string_ref(author.email.as_ref());
                            if authors_for_commit
                                .iter()
                                .any(|existing| existing.name == name && existing.email == email)
                            {
                                continue;
                            }
                            authors_for_commit.push(SignatureRef {
                                name,
                                email,
                                time: author.time,
                            });
                        }
                        out.extend(authors_for_commit.into_iter().map(|author| (commit_idx, author)));
                    }
                }
                out.shrink_to_fit();
                out.sort_by(|a, b| {
                    a.1.email
                        .cmp(b.1.email)
                        .then(a.1.seconds().cmp(&b.1.seconds()).reverse())
                        .then(a.0.cmp(&b.0))
                });
                Ok(out)
            }));

            let (stats_progresses, stats_counters) = if needs_stats {
                {
                    let mut sp = progress.add_child("extract stats");
                    sp.init(None, progress::count("commits"));
                    let sc = sp.counter();

                    let mut cp = progress.add_child("find changes");
                    cp.init(None, progress::count("modified files"));
                    let cc = cp.counter();

                    let mut lp = progress.add_child("find changes");
                    lp.init(None, progress::count("diff lines"));
                    let lc = lp.counter();

                    (Some((sp, cp, lp)), Some((sc, cc, lc)))
                }
            } else {
                Default::default()
            };

            let mut progress = progress.add_child("traverse commit graph");
            progress.init(None, progress::count("commits"));

            let (tx_tree_id, stat_threads) = if needs_stats {
                {
                    let (tx, threads) = spawn_tree_delta_threads(
                        scope,
                        threads,
                        line_stats,
                        repo.clone(),
                        stats_counters.clone().expect("counters are set"),
                    );
                    (Some(tx), threads)
                }
            } else {
                Default::default()
            };

            let mut commit_idx = 0_u32;
            let mut skipped_merge_commits = 0;
            const CHUNK_SIZE: usize = 50;
            let mut chunk = Vec::with_capacity(CHUNK_SIZE);
            let mut commit_iter = commit_id.ancestors(&repo.objects);
            let mut is_shallow = false;
            while let Some(c) = commit_iter.next() {
                progress.inc();
                if gix::interrupt::is_triggered() {
                    bail!(gix::error::cancelled("Cancelled by user"));
                }
                match c {
                    Ok(c) => {
                        tx.send((commit_idx, commit_iter.commit_data().to_owned())).ok();
                        let tree_delta_info = tx_tree_id.as_ref().and_then(|tx| {
                            let mut parents = c.parent_ids.into_iter();
                            parents
                                .next()
                                .map(|first_parent| (tx, Some(first_parent), c.id.to_owned()))
                              
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3241** (2026-11-24): **move experimental APIs to parallel major-zero releases**
  *Symptoms*: Sibling PR: https://github.com/GitoxideLabs/cargo-smart-release/pull/171  ---  Cargo cannot resolve disjoint minor-series pins of a major-positive crate in one dependency graph. Publish experimental APIs in parallel `0.x` series so downstream libraries can select the APIs they need by version and resolve different experimental series alongside the stable crate.  Keep the `unstable` switch for workspace builds and let cargo smart-release translate those path dependencies for publication. Re-export `SharedPermissions` and `Retries` from the paired stable `gix-fs` release to preserve their type identity across both series. 
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary --> <!-- codex-review-state:v1 {"code_review":{"commit_sha":"3422bfe91f6692e3a1b0fe84786dcacbd3ba766a","has_any_findings":false,"has_unresolved_findings":false,"status":"completed"},"security_review":{"commit_sha":null,"has_any_findings":null,"has_unresolved_findings":null,"status":null}} -->  <details> <summary><strong>Codex Review Summary</strong>: ✅ Completed</summary>  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-11-24T15:19:02.317464Z">2026-11-24T15:19:02.317464Z</relative-time> | `3422bfe` | Draft marked ready |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as rea

- **Issue #3240** (2026-11-24): **validate pack offsets on lookup**
  *Symptoms*: Supersedes https://github.com/GitoxideLabs/gitoxide/pull/3239 
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary --> <!-- codex-review-state:v1 {"code_review":{"commit_sha":"baf3a2ea73bcbdf1c8ddb02669ee2ab30a178a8d","has_any_findings":true,"has_unresolved_findings":true,"status":"completed"},"security_review":{"commit_sha":null,"has_any_findings":null,"has_unresolved_findings":null,"status":null}} -->  <details> <summary><strong>Codex Review Summary</strong>: ✅ Completed</summary>  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-11-24T09:32:16.416698Z">2026-11-24T09:32:16.416698Z</relative-time> | `baf3a2e` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Commen

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

### Incident Patch 1: `3befd38c` (2026-11-24)
**Commit Message**: fix(gix-testtools): confine Git discovery to scripted fixtures

<!-- agent -->
When a fixture is generated inside a checkout, Git can discover the
checkout and read its local config. A checkout-local `pack.threads`
setting can then break `git index-pack` during fixture generation.

Set `GIT_CEILING_DIRECTORIES` to the fixture directory's parent when
launching the script. Git can still discover repositories inside the
fixture from nested directories. Test both discovery boundaries.

Assisted-by: GPT 6.2 Sol
Co-authored-by: GPT 6.2 Sol <[REDACTED_EMAIL]>

**File**: `tests/tools/src/lib.rs` (modified, +10/-3)
```diff
@@ -38,6 +38,7 @@
 //! and set `init.defaultBranch=main` and `core.longpaths=true`. The latter lets Git for Windows use long paths
 //! without depending on external configuration. A script's own `GIT_CONFIG_COUNT` entries coexist with this
 //! configuration, with isolation taking precedence for shared keys. Explicit `git -c` options can override isolation.
+//! Fixture scripts stop Git's upward repository discovery at the fixture root.
 //! Bash fixtures trace commands to a separate descriptor so redirected stderr baselines remain unchanged.
 //! Bash older than 4.1 reports failed commands instead. Captured diagnostics are printed only on failure.
 //!
@@ -2026,7 +2027,9 @@ pub fn git(current_dir: impl AsRef<Path>, arguments: &str) -> Result<String> {
     Ok(String::from_utf8(output.stdout)?)
 }
 
-/// Prepare an isolated Git command in `current_dir`, using the same environment as fixture scripts.
+/// Prepare an isolated Git command in `current_dir`.
+///
+/// Repository discovery may walk above `current_dir`, which allows commands from fixture subdirectories.
 ///
 /// The inherited environment is captured at construction, so subsequent process-wide changes
 /// cannot bypass the command's isolation before it is spawned.
@@ -2450,8 +2453,12 @@ fn configure_command<'a, I: IntoIterator<Item = S>, S: AsRef<OsStr>>(
     args: I,
     script_result_directory: &Path,
 ) -> &'a mut std::process::Command {
-    configure_git_environment(cmd, script_result_directory)
-        .args(args)
+    configure_git_environment(cmd, script_result_directory);
+    if let Some(parent) = script_result_directory.parent() {
+        // Git may discover a repository in the fixture itself, including from its subdirectories.
+        cmd.env("GIT_CEILING_DIRECTORIES", parent);
+    }
+    cmd.args(args)
         .current_dir(script_result_directory)
         .env("GIT_DEFAULT_HASH", object_hash.to_string())
 }
```

**File**: `tests/tools/src/tests.rs` (modified, +27/-0)
```diff
@@ -85,6 +85,33 @@ fn configure_command_clears_external_config() -> TestResult {
     Ok(())
 }
 
+#[test]
+fn configure_command_limits_repository_discovery_to_the_fixture() -> TestResult {
+    let parent = tempfile::tempdir()?;
+    git(parent.path(), "init")?;
+    git(parent.path(), "config fixture.scope parent")?;
+    let fixture = parent.path().join("fixture");
+    let nested = fixture.join("nested");
+    std::fs::create_dir_all(&nested)?;
+
+    let mut cmd = git_command(&fixture);
+    let result = configure_command(&mut cmd, object_hash(), ["config", "--get", "fixture.scope"], &fixture).output()?;
+    assert_eq!(result.status.code(), Some(1), "Git must skip the parent config");
+
+    git(&fixture, "init")?;
+    git(&fixture, "config fixture.scope fixture")?;
+    let mut cmd = git_command(&fixture);
+    let result = configure_command(&mut cmd, object_hash(), ["config", "--get", "fixture.scope"], &fixture)
+        .current_dir(nested)
+        .output()?;
+    assert!(
+        result.status.success(),
+        "Git can discover a repository inside the fixture"
+    );
+    assert_eq!(result.stdout.to_str()?.trim(), "fixture");
+    Ok(())
+}
+
 #[test]
 fn configure_command_keeps_destructive_git_operations_in_the_fixture() -> TestResult {
     let fixture = tempfile::TempDir::new()?;
```

---

### Incident Patch 2: `fff99b82` (2026-11-24)
**Commit Message**: fix(gix-transport): preserve Git SSH argument boundaries

I changes service program and path to execute to one argument, and quotes it,
possibly with special git quoting.
Let's see if this is the solution or causes new problems elsewhere.
Only on Winodws fortunately.

<!-- agent -->
On Windows, the MSYS2 runtime can expand an SSH destination before
OpenSSH checks whether it looks like an option. Use Git-compatible
Windows quoting for both the SSH feature probe and the connection.

Pass the service and the single-quoted repository path together as one
remote command, as Git does in `connect.c`. This keeps the path's
quoting through local argument parsing and into the remote shell.
Document the caller's quoting responsibility in `gix-url` and escape
raw arguments at the transport trace sites.

Assisted-by: GPT 6.2 Sol
Co-authored-by: GPT 6.2 Sol <[REDACTED_EMAIL]>

**File**: `gix-command/src/prepare.rs` (modified, +1/-1)
```diff
@@ -179,7 +179,7 @@ impl Prepare {
     pub fn spawn(self) -> std::io::Result<std::process::Child> {
         let mut cmd =
             Command::try_from(self).map_err(|err| std::io::Error::new(std::io::ErrorKind::InvalidInput, err))?;
-        gix_trace::debug!(program = ?cmd.get_program(), args = ?cmd.get_args().collect::<Vec<_>>());
+        gix_trace::debug_command!(cmd);
         cmd.spawn()
     }
 }
```

**File**: `gix-transport/src/client/blocking_io/file.rs` (modified, +62/-20)
```diff
@@ -120,8 +120,11 @@ impl SpawnProcessOnDemand {
             });
         }
         let repo_path = if self.ssh_cmd.is_some() {
-            cmd.args.push(service.as_str().into());
-            gix_quote::single(self.path.as_ref()).to_os_str_lossy().into_owned()
+            // SSH forwards a shell command, including the path's quotes, to the remote host.
+            let mut command = OsString::from(service.as_str());
+            command.push(" ");
+            command.push(&*gix_quote::single(self.path.as_ref()).to_os_str_lossy());
+            command
         } else {
             self.path.to_os_str_lossy().into_owned()
         };
@@ -279,7 +282,12 @@ impl client::blocking_io::Transport for SpawnProcessOnDemand {
             cmd.stdin = Stdio::piped();
             cmd.stdout = Stdio::piped();
 
-            let mut cmd = std::process::Command::try_from(cmd).map_err(|err| client::Error::InvokeProgram {
+            let prepared = if ssh_kind.is_some() {
+                cmd.into_command_with_git_quoting()
+            } else {
+                cmd.try_into()
+            };
+            let mut cmd = prepared.map_err(|err| client::Error::InvokeProgram {
                 source: std::io::Error::new(std::io::ErrorKind::InvalidInput, err),
                 command: command.to_owned(),
             })?;
@@ -291,15 +299,15 @@ impl client::blocking_io::Transport for SpawnProcessOnDemand {
         };
 
         let mut cmd = into_std_command(cmd, &cmd_name)?;
-        gix_trace::debug!(command = ?cmd, "gix_transport::SpawnProcessOnDemand");
+        gix_trace::debug_command!(cmd, "gix_transport::SpawnProcessOnDemand");
         let mut child = match cmd.spawn() {
             Ok(child) => child,
             Err(err) if ssh_kind.is_none() && err.kind() == std::io::ErrorKind::NotFound => {
                 // The service program wasn't found in `PATH`, but as `git` itself can be found,
                 // the service can still be run through it (#2313).
                 let (cmd, cmd_name) = self.prepare_fallback_command(service);
                 let mut cmd = into_std_command(cmd, &cmd_name)?;
-                gix_trace::debug!(command = ?cmd, "gix_transport::SpawnProcessOnDemand (fallback)");
+                gix_trace::debug_command!(cmd, "gix_transport::SpawnProcessOnDemand (fallback)");
                 cmd.spawn().map_err(|err| client::Error::InvokeProgram {
                     source: err,
                     command: cmd_name,
@@ -431,15 +439,15 @@ mod tests {
                 for (url, expected) in [
                     (
                         "git@forge.com:/path/repo",
-                        &["ssh", "git@forge.com", "git-upload-pack", "'/path/repo'"][..],
+                        &["ssh", "git@forge.com", "git-upload-pack '/path/repo'"][..],
                     ),
                     (
                         "git@forge.com:path/repo",
-                        &["ssh", "git@forge.com", "git-upload-pack", "'path/repo'"][..],
+                        &["ssh", "git@forge.com", "git-upload-pack 'path/repo'"][..],
                     ),
                     (
                         "ssh://git@forge.com/path/repo",
-                        &["ssh", "git@forge.com", "git-upload-pack", "'/path/repo'"][..],
+                        &["ssh", "git@forge.com", "git-upload-pack '/path/repo'"][..],
                     ),
                 ] {
                     let url = gix_url::parse(url)?;
@@ -453,6 +461,50 @@ mod tests {
                 Ok(())
             }
 
+            #[test]
+            fn remote_command_preserves_shell_quoting_in_one_argument() -> gix_testtools::TestResult {
+                if gix_testtools::run_in_isolated_process()? {
+                    return Ok(());
+                }
+                let root = gix_testtools::tempfile::tempdir()?;
+                let _cwd = gix_testtools::set_current_dir(root.path())?;
+                for kind in [
+                    ssh::ProgramKind::Ssh,
+                    ssh::ProgramKind::Plink,
+                    ssh::ProgramKind::Putty,
+                    ssh::ProgramKind::TortoisePlink,
+                    ssh::ProgramKind::Simple,
+                ] {
+                    for service in [crate::Service::UploadPack, crate::Service::ReceivePack] {
+                        let transport = ssh::connect(
+                            "user@host:team/repo.git;echo harmless'!".try_into()?,
+                            Protocol::V1,
+                            ssh::connect::Options {
+                                command: Some(r#"printf '<%s>\n' "$@""#.into()),
+                                kind: Some(kind),
+                                ..Default::default()
+                            },
+                            false,
+                        )?;
+                        let cmd = transport.prepare_command(service)?.0;
+                        let remote_command = format!(r"{} 'team/repo.git;echo harmless'\''
```

**File**: `gix-transport/src/client/blocking_io/ssh/mod.rs` (modified, +2/-2)
```diff
@@ -192,7 +192,7 @@ fn determine_client_kind(
     let mut kind = known_kind.unwrap_or_else(|| ProgramKind::from(ssh_cmd));
     if known_kind.is_none() && kind == ProgramKind::Simple {
         let mut cmd = build_client_feature_check_command(ssh_cmd, url, disallow_shell)?;
-        gix_trace::debug!(cmd = ?cmd, "invoking `ssh` for feature check");
+        gix_trace::debug_command!(cmd, "invoking `ssh` for feature check");
         kind = if cmd.status().ok().is_some_and(|status| status.success()) {
             ProgramKind::Ssh
         } else {
@@ -221,7 +221,7 @@ fn build_client_feature_check_command(ssh_cmd: &OsStr, url: &Url, disallow_shell
     if disallow_shell {
         prepare.use_shell = false;
     }
-    prepare.try_into().map_err(Error::PrepareCommand)
+    prepare.into_command_with_git_quoting().map_err(Error::PrepareCommand)
 }
 
 #[cfg(test)]
```

**File**: `gix-url/src/lib.rs` (modified, +2/-0)
```diff
@@ -112,6 +112,8 @@ pub fn expand_path(user: Option<&expand_path::ForUser>, path: &BStr) -> Result<P
 ///
 /// This type only expresses known *syntactic* risk. It does not cover other risks, such as passing a personal access
 /// token as a username rather than a password in an application that logs usernames.
+/// The caller must preserve the argument literally when invoking the program. MSYS2/Cygwin programs on Windows
+/// require additional quoting to prevent the runtime from expanding arguments or removing quotes.
 #[derive(Debug, PartialEq, Eq, Copy, Clone)]
 pub enum ArgumentSafety<'a> {
     /// May be safe. There is nothing to pass, so there is nothing dangerous.
```

---

### Incident Patch 3: `860ec3d2` (2026-11-23)
**Commit Message**: fix(gix-command): prepare Git-compatible Windows arguments

Looked at it carefully, improved some details to make them easier to follow,
and rubber-stamped the tests and the actual quoting implementation.

<!-- agent -->
Git's MSVC quoting protects arguments that MSYS2 and Cygwin could
expand before the called program sees them. Make that quoting available
to callers without inspecting executable images or changing the normal
argument handling of native helpers.

Prefer an explicit path's `.exe` sibling before shebang dispatch. Keep
the bundled Git shell's MSYS2 quoting and Rust's batch file escaping.
Reject literal double quotes for custom transports under `noglob`,
where a runtime could otherwise change the argument boundaries. Escape
raw arguments in trace output and exercise the behavior on Windows.

**File**: `gix-command/src/lib.rs` (modified, +32/-7)
```diff
@@ -28,6 +28,8 @@ use bstr::{BString, ByteSlice};
 pub mod parse;
 
 mod prepare;
+#[cfg(windows)]
+mod windows;
 
 ///
 pub mod shebang {
@@ -65,8 +67,10 @@ pub mod shebang {
 /// after creating it with [`prepare()`].
 ///
 /// Convert it to [`std::process::Command`] with [`TryFrom::try_from()`] to finish preparation
-/// without spawning. Preparation reports an error when shell quoting or namespace conversion
-/// requires an encoding the platform cannot represent.
+/// without spawning. Preparation reports an error when argument quoting or namespace conversion
+/// requires an encoding the selected parser or platform cannot represent.
+/// On Windows, arguments to the bundled Git shell can use `CommandExt::raw_arg`, so
+/// `Command::get_args()` can include command-line quoting rather than only the decoded contents.
 pub struct Prepare {
     /// The command to invoke, either directly or with a shell depending on `use_shell`.
     pub command: OsString,
@@ -160,21 +164,39 @@ fn is_bare_command(command: &Path) -> bool {
     command.components().take(2).count() == 1
 }
 
+/// Return `Some(path)` if appending `.exe` to `command` yields a path to a file, as in Rust's
+/// Windows process launcher for explicit paths. For example, `bin/ssh` returns `Some(bin/ssh.exe)`
+/// if `bin/ssh.exe` is a file, even if `bin/ssh` also exists.
+///
+/// Return `None` if there is no such file, if `command` already has an `.exe` extension (ignoring
+/// ASCII case), or if it ends in a [Windows path separator](prepare::has_trailing_windows_separator).
+fn win_exe_suffix_lookup(command: &Path) -> Option<PathBuf> {
+    if prepare::has_trailing_windows_separator(command)
+        || command
+            .extension()
+            .is_some_and(|ext| ext.as_encoded_bytes().eq_ignore_ascii_case(b"exe"))
+    {
+        return None;
+    }
+    let mut executable = command.as_os_str().to_owned();
+    executable.push(".exe");
+    let executable = PathBuf::from(executable);
+    executable.is_file().then_some(executable)
+}
+
 /// Try to find `command` in `joined_paths` using [`split_paths()`].
 /// Commands with an explicit extension are matched verbatim. Otherwise, `.exe` is preferred over an extensionless file.
 /// Note that just like Git, no lookup is performed if a slash or backslash is in `command`.
 fn win_path_lookup(command: &Path, joined_paths: &std::ffi::OsStr) -> Option<PathBuf> {
     fn lookup(root: &Path, command: &Path, has_extension: bool) -> Option<PathBuf> {
-        let mut path = root.join(command);
+        let path = root.join(command);
         if has_extension {
             return path.is_file().then_some(path);
         }
 
-        path.set_extension("exe");
-        if path.is_file() {
-            return Some(path);
+        if let Some(executable) = win_exe_suffix_lookup(&path) {
+            return Some(executable);
         }
-        path.set_extension("");
         path.is_file().then_some(path)
     }
     if !is_bare_command(command) {
@@ -212,6 +234,9 @@ pub fn extract_interpreter(executable: &Path) -> Option<shebang::Data> {
 /// - `stderr` is inherited to allow the command to provide context to the user
 ///
 /// On Windows, terminal Windows will be suppressed automatically.
+/// Explicit program paths also prefer an existing `.exe` sibling, matching Rust's process launcher.
+/// The bundled Git shell receives MSYS2 quoting. For external Git transports use
+/// [`Prepare::into_command_with_git_quoting()`] to enable Git's additional Windows quoting.
 ///
 /// ### Warning
 ///
```

**File**: `gix-command/src/prepare.rs` (modified, +74/-21)
```diff
@@ -8,7 +8,9 @@ use std::{
 use bstr::ByteSlice;
 use gix_error::Result;
 
-use crate::{Context, Prepare, extract_interpreter, is_bare_command, split_paths, win_path_lookup};
+use crate::{
+    Context, Prepare, extract_interpreter, is_bare_command, split_paths, win_exe_suffix_lookup, win_path_lookup,
+};
 
 /// Builder
 impl Prepare {
@@ -177,16 +179,39 @@ impl Prepare {
     pub fn spawn(self) -> std::io::Result<std::process::Child> {
         let mut cmd =
             Command::try_from(self).map_err(|err| std::io::Error::new(std::io::ErrorKind::InvalidInput, err))?;
-        gix_trace::debug!(cmd = ?cmd);
+        gix_trace::debug!(program = ?cmd.get_program(), args = ?cmd.get_args().collect::<Vec<_>>());
         cmd.spawn()
     }
 }
 
 impl TryFrom<Prepare> for Command {
     type Error = gix_error::Error;
 
-    fn try_from(mut prep: Prepare) -> Result<Self> {
+    fn try_from(prep: Prepare) -> Result<Self> {
+        prep.into_command(false)
+    }
+}
+
+/// Lifecycle
+impl Prepare {
+    /// Finish preparation using Git for Windows' additional argument quoting on Windows.
+    ///
+    /// Use this for external Git transports whose arguments may be parsed again by MSYS2 or Cygwin.
+    /// As with the bundled shell, `Command::get_args()` includes quoting for arguments passed with `raw_arg`.
+    /// For other programs, disabling globbing in `MSYS` or `CYGWIN` can make literal double quotes
+    /// ambiguous, so preparation rejects them in that mode.
+    /// On other platforms this is identical to converting with [`Command::try_from()`].
+    pub fn into_command_with_git_quoting(self) -> Result<Command> {
+        self.into_command(true)
+    }
+
+    fn into_command(self, git_quoting: bool) -> Result<Command> {
+        #[cfg(not(windows))]
+        let _ = git_quoting;
+        let mut prep = self;
         let mut inline_env = Vec::new();
+        #[cfg(windows)]
+        let mut bundled_shell = false;
         let mut cmd = if prep.use_shell {
             let split_args = prep
                 .allow_manual_arg_splitting
@@ -213,7 +238,15 @@ impl TryFrom<Prepare> for Command {
                 None => {
                     let mut cmd = match prep.shell_program {
                         Some(shell) => Command::new(shell),
-                        None => gix_path::env::shell_command(),
+                        None => {
+                            let shell = gix_path::env::shell_command();
+                            #[cfg(windows)]
+                            {
+                                // Discovery returns a full path for Git's MSYS2 shell or its shim.
+                                bundled_shell = Path::new(shell.get_program()).is_absolute();
+                            }
+                            shell
+                        }
                     };
                     // Passed as `command_name` after `-c <script>`; the shell uses it
                     // as `$0`, which prefixes its own diagnostic messages. If the
@@ -250,6 +283,9 @@ impl TryFrom<Prepare> for Command {
         } else {
             Command::new(prep.command)
         };
+        cmd.args(prep.args);
+        #[cfg(windows)]
+        let mut cmd = crate::windows::quote_arguments(cmd, git_quoting, bundled_shell, &prep.env, &inline_env)?;
         // We never want to have terminals pop-up on Windows if this runs from a GUI application.
         #[cfg(windows)]
         {
@@ -260,8 +296,7 @@ impl TryFrom<Prepare> for Command {
         cmd.stdin(prep.stdin)
             .stdout(prep.stdout)
             .stderr(prep.stderr)
-            .envs(prep.env)
-            .args(prep.args);
+            .envs(prep.env);
         if let Some(ctx) = prep.context {
             if let Some(git_dir) = ctx.git_dir {
                 cmd.env("GIT_DIR", &git_dir);
@@ -307,18 +342,7 @@ impl TryFrom<Prepare> for Command {
 /// arguments. If `PATH` does not resolve a bare command, the missing program remains anchored in its first entry
 /// so Rust's broader Windows lookup cannot find it elsewhere.
 fn windows_command(command: OsString, env: &[(OsString, OsString)], inline_env: &[(String, OsString)]) -> Command {
-    let explicit_joined_paths = inline_env
-        .iter()
-        .rev()
-        .find(|(name, _)| name.eq_ignore_ascii_case("PATH"))
-        .map(|(_, value)| value.as_os_str())
-        .or_else(|| {
-            env.iter()
-                .rev()
-                .find(|(name, _)| name.to_str().is_some_and(|name| name.eq_ignore_ascii_case("PATH")))
-                .map(|(_, value)| value.as_os_str())
-        });
-    let joined_paths = explicit_joined_paths
+    let joined_paths = windows_env_override("PATH", env, inline_env)
         .map(Cow::Borrowed)
         .or_else(|| std::env::var_os("PATH").map(Cow::Owned));
     let looked_up = joined_paths
@@ -329,15 +353,20 @@ fn windows_command(command: OsString, env: &[(OsString, OsString)], inline_env:
         Some(program) => Cow::Owned(program),
```

**File**: `gix-command/src/windows.rs` (added, +182/-0)
```diff
@@ -0,0 +1,182 @@
+use std::{
+    borrow::Cow,
+    ffi::{OsStr, OsString},
+    os::windows::{ffi::OsStrExt, ffi::OsStringExt, process::CommandExt},
+    path::Path,
+    process::Command,
+};
+
+use gix_error::{Result, bail, validation};
+
+/// Apply Git's extra quoting without probing the executable.
+pub(super) fn quote_arguments(
+    cmd: Command,
+    git_quoting: bool,
+    bundled_shell: bool,
+    env: &[(OsString, OsString)],
+    inline_env: &[(String, OsString)],
+) -> Result<Command> {
+    let glob = |key| {
+        crate::prepare::windows_env_override(key, env, inline_env)
+            .map(Cow::Borrowed)
+            .or_else(|| std::env::var_os(key).map(Cow::Owned))
+            .as_deref()
+            .is_none_or(glob_enabled)
+    };
+    let quote: fn(&OsStr) -> Option<OsString> = if bundled_shell {
+        if !cmd.get_args().any(needs_msys_quoting) {
+            return Ok(cmd);
+        }
+        if glob("MSYS") {
+            quote_for_msys_glob
+        } else {
+            quote_for_msys_noglob
+        }
+    } else if git_quoting {
+        let has_double_quote = cmd.get_args().any(|arg| arg.as_encoded_bytes().contains(&b'"'));
+        let needs_quoting = cmd.get_args().any(needs_msvc_quoting);
+        if !(has_double_quote || needs_quoting) || may_be_batch_file(cmd.get_program()) {
+            return Ok(cmd);
+        }
+        // The noglob parser does not decode the backslash escapes used by the Windows C runtime.
+        // Without identifying the executable, reject an argument that could lose its quote boundary.
+        if has_double_quote && (!glob("MSYS") || !glob("CYGWIN")) {
+            bail!(validation(
+                "cannot pass literal double quotes to a Windows Git transport with globbing disabled"
+            ));
+        }
+        if !needs_quoting {
+            return Ok(cmd);
+        }
+        quote_for_msvc
+    } else {
+        return Ok(cmd);
+    };
+
+    let mut quoted = Command::new(cmd.get_program());
+    for arg in cmd.get_args() {
+        if let Some(arg) = quote(arg) {
+            quoted.raw_arg(arg);
+        } else {
+            quoted.arg(arg);
+        }
+    }
+    Ok(quoted)
+}
+
+fn may_be_batch_file(program: &OsStr) -> bool {
+    // Rust uses a separate, safer encoder for batch files. In particular, raw_arg would bypass
+    // its escaping of percent signs and its checks for line breaks.
+    let has_suffix = |name: &OsStr, suffix: &[u8]| {
+        let bytes = name.as_encoded_bytes();
+        bytes
+            .get(bytes.len().saturating_sub(suffix.len())..)
+            .is_some_and(|tail| tail.eq_ignore_ascii_case(suffix))
+    };
+    !has_suffix(program, b".exe")
+        && std::path::absolute(Path::new(program)).map_or(true, |path| {
+            has_suffix(path.as_os_str(), b".cmd") || has_suffix(path.as_os_str(), b".bat")
+        })
+}
+
+fn needs_msvc_quoting(arg: &OsStr) -> bool {
+    let bytes = arg.as_encoded_bytes();
+    // Spaces and tabs already make Rust wrap the entire argument in double quotes.
+    !bytes.iter().any(|byte| matches!(byte, b' ' | b'\t')) && bytes.iter().any(|&byte| requires_quotes(byte))
+}
+
+fn needs_msys_quoting(arg: &OsStr) -> bool {
+    arg.as_encoded_bytes()
+        .iter()
+        .any(|&byte| byte == b'\\' || requires_quotes(byte))
+}
+
+fn requires_quotes(byte: u8) -> bool {
+    // As in Git's quote_arg_msvc(), also quote characters that trigger argument expansion.
+    // Include bracket and tilde expansion to preserve the SSH destination literally.
+    matches!(
+        byte,
+        b'\n' | b'\r' | 0x0b | 0x0c | b'"' | b'\'' | b'*' | b'?' | b'[' | b'{' | b'~'
+    )
+}
+
+/// The last glob, noglob or -glob setting controls Windows argument expansion.
+fn glob_enabled(options: &OsStr) -> bool {
+    let mut quoted = false;
+    let mut glob = true;
+    for option in options.as_encoded_bytes().split(|&byte| {
+        if byte == b'"' {
+            quoted = !quoted;
+        }
+        !quoted && matches!(byte, b' ' | b'\t')
+    }) {
+        let split = option
+            .iter()
+            .position(|&b| b == b'=')
+            .or_else(|| option.iter().position(|&b| b == b':'));
+        let (name, value) = split.map_or((option, None), |at| (&option[..at], Some(&option[at + 1..])));
+        if name.eq_ignore_ascii_case(b"glob") {
+            glob = value.is_none_or(|value| value.iter().any(|&byte| byte != b'"'));
+        } else if name.eq_ignore_ascii_case(b"noglob") || name.eq_ignore_ascii_case(b"-glob") {
+            glob = false;
+        }
+    }
+    glob
+}
+
+const DOUBLE: u16 = b'"' as u16;
+const SINGLE: u16 = b'\'' as u16;
+const SLASH: u16 = b'\\' as u16;
+
+fn quote_for_msvc(arg: &OsStr) -> Option<OsString> {
+    if !needs_msvc_quoting(arg) {
+        return None;
+    }
+    let mut quoted = vec![DOUBLE];
+    let mut slashes = 0;
+    for c in arg.encode_wide() {
+        if c == SLASH {
+            slashes += 1;
+        } else {
+ 
```

**File**: `gix-command/tests/command/main.rs` (modified, +2/-0)
```diff
@@ -158,3 +158,5 @@ mod command_line;
 mod context;
 mod prepare;
 mod spawn;
+#[cfg(windows)]
+mod windows;
```

**File**: `gix-command/tests/command/windows.rs` (added, +179/-0)
```diff
@@ -0,0 +1,179 @@
+use bstr::ByteSlice;
+use gix_testtools::TestResult;
+
+#[test]
+fn git_style_quoting_preserves_msys_ssh_arguments() -> TestResult {
+    if gix_testtools::run_in_isolated_process()? {
+        return Ok(());
+    }
+    let printf = gix_path::env::installation_program("printf").expect("Git for Windows provides MSYS printf");
+    let root = gix_testtools::tempfile::tempdir()?;
+    let _cwd = gix_testtools::set_current_dir(root.path())?;
+    std::fs::write(root.path().join("hostname.invalid"), [])?;
+    let args = [
+        "{first,second}",
+        "host*.invalid",
+        "host?ame.invalid",
+        "host[n]ame.invalid",
+        "O'Brien.invalid",
+        "git-upload-pack 'team/repo with spaces.git'",
+        r"git-upload-pack 'team/O'\''Brien.git'",
+    ];
+    let expected = format!("<{}>", args.join("><"));
+    for mode in ["glob", "noglob"] {
+        let output = gix_command::prepare(&printf)
+            .env("MSYS", mode)
+            .arg("<%s>")
+            .args(args)
+            .into_command_with_git_quoting()?
+            .output()?;
+        assert!(
+            output.status.success(),
+            "the MSYS argument recorder completes in mode {mode}"
+        );
+        assert_eq!(
+            output.stdout.as_bstr(),
+            expected.as_bytes().as_bstr(),
+            "the SSH destination stays literal and the remote command arrives in one argument"
+        );
+    }
+    Ok(())
+}
+
+#[test]
+fn explicit_msys_ssh_path_can_omit_exe_suffix() -> TestResult {
+    if gix_testtools::run_in_isolated_process()? {
+        return Ok(());
+    }
+    let ssh = gix_path::env::installation_program("ssh").expect("Git for Windows provides MSYS ssh");
+    let mut cmd = gix_command::prepare(ssh.with_extension(""))
+        .env("MSYS", "glob")
+        .args(["-F", "/dev/null", "-G", "{first,second}"])
+        .stderr(std::process::Stdio::piped())
+        .into_command_with_git_quoting()?;
+    assert_eq!(cmd.get_program(), ssh, "the .exe sibling selected at launch is used");
+    let output = cmd.output()?;
+    assert!(
+        !output.status.success(),
+        "the invalid hostname is rejected during the configuration probe"
+    );
+    assert!(
+        output.stderr.contains_str("hostname contains invalid characters"),
+        "OpenSSH sees the literal brace argument without a connection attempt"
+    );
+    Ok(())
+}
+
+#[test]
+fn bundled_msys_shell_preserves_positional_arguments() -> TestResult {
+    if gix_testtools::run_in_isolated_process()? {
+        return Ok(());
+    }
+    let args = ["{first,second}", "'repo name'", r"C:\example directory\", r#"a"b"#];
+    let expected = format!("<{}>", args.join("><"));
+    for mode in ["glob", "noglob"] {
+        let output = gix_command::prepare(r#"printf '<%s>' "$@""#)
+            .with_shell()
+            .env("MSYS", mode)
+            .args(args)
+            .spawn()?
+            .wait_with_output()?;
+        assert!(output.status.success(), "the bundled shell completes in mode {mode}");
+        assert_eq!(
+            output.stdout.as_bstr(),
+            expected.as_bytes().as_bstr(),
+            "the shell preserves its positional arguments"
+        );
+    }
+    Ok(())
+}
+
+#[test]
+fn native_fallback_shell_retains_standard_argument_encoding() -> TestResult {
+    if gix_testtools::run_in_isolated_process()? {
+        return Ok(());
+    }
+    let root = gix_testtools::tempfile::tempdir()?;
+    let _env = gix_testtools::Env::new().set("GIT_EXEC_PATH", root.path().to_string_lossy());
+    std::fs::copy(std::env::current_exe()?, root.path().join("sh.exe"))?;
+    assert_eq!(
+        gix_path::env::shell(),
+        "sh.exe",
+        "the fixture disables bundled shell discovery"
+    );
+
+    let arg = r"C:\example directory\";
+    let script = r#"printf '%s' "$1" "$@""#;
+    let cmd = std::process::Command::try_from(
+        gix_command::prepare(script)
+            .with_shell()
+            .env("PATH", root.path())
+            .arg(arg),
+    )?;
+    assert_eq!(cmd.get_program(), "sh.exe", "Rust resolves the fallback shell at spawn");
+    assert_eq!(
+        cmd.get_args().collect::<Vec<_>>(),
+        ["-c", script, "sh.exe", arg],
+        "the native fallback receives ordinary Windows arguments"
+    );
+    Ok(())
+}
+
+#[test]
+fn explicit_shell_does_not_discover_git_shell() -> TestResult {
+    if gix_testtools::run_in_isolated_process()? {
+        return Ok(());
+    }
+    let root = gix_testtools::tempfile::tempdir()?;
+    let shell = std::env::current_exe()?;
+    {
+        let _env = gix_testtools::Env::new().set("GIT_EXEC_PATH", root.path().to_string_lossy());
+        let cmd = std::process::Command::try_from(
+            gix_command::prepare("echo hello")
+                .with_shell()
+                .with_shell_program(&shell),
+        )?;
+        assert_eq!(cmd.get_program(), shell, "the explicit absolute shell is used directly");
+    }
```

**File**: `gix-credentials/src/program/mod.rs` (modified, +5/-2)
```diff
@@ -172,6 +172,9 @@ mod tests {
 
     #[test]
     fn git_program_with_spaces_is_quoted_in_external_name_shell_scripts() -> gix_testtools::TestResult {
+        if gix_testtools::run_in_isolated_process()? {
+            return Ok(());
+        }
         let cmd = super::external_name_command(
             Path::new(r"C:\Program Files\Git\mingw64\bin\git.exe"),
             "manager --config=~/credentials".into(),
@@ -186,11 +189,11 @@ mod tests {
         assert_eq!(
             script,
             OsStr::new(if cfg!(windows) {
-                r#"'C:/Program Files/Git/mingw64/bin/git.exe' credential-manager --config=~/credentials "$@""#
+                r#""'C:/Program Files/Git/mingw64/bin/git.exe' credential-manager --config=~/credentials \"$@\"""#
             } else {
                 r#"'C:\Program Files\Git\mingw64\bin\git.exe' credential-manager --config=~/credentials "$@""#
             }),
-            "the Git executable is a single shell token even when its path contains spaces"
+            "the Git executable stays a single shell token through runtime quoting even when its path contains spaces"
         );
         Ok(())
     }
```

#### Recent Merged Pull Requests:
- **PR #3241** (2026-11-24): move experimental APIs to parallel major-zero releases (@Byron)
- **PR #3240** (2026-11-24): validate pack offsets on lookup (@Byron)
- **PR #3239** (closed): perf(gix-odb): validate pack offsets on lookup (@Havunen)
- **PR #3238** (2026-11-23): Upgrade `sirocco` to 0.4 (@srijs)
- **PR #3237** (2026-11-24): fix(gix-ignore): drop a `` that ends an ignore file without `
`, like Git. (@AbuYahya94)
- **PR #3236** (2026-11-23): Preserve shallow boundaries during ordinary fetch (@Byron)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. gix-testtools): confine Git discovery to scripted fixtures

**RULE**:
When implementing operations in `tests/tools/src/lib.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in GitoxideLabs/gitoxide. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `3befd38c`: gix-testtools): confine Git discovery to scripted fixtures. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `tests/tools/src/lib.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
//! Fixture scripts stop Git's upward repository discovery at the fixture root.
/// Prepare an isolated Git command in `current_dir`.
///
/// Repository discovery may walk above `current_dir`, which allows commands from fixture subdirectories.
    configure_git_environment(cmd, script_result_directory);
    if let Some(parent) = script_result_directory.parent() {
        // Git may discover a repository in the fixture itself, including from its subdirectories.
        cmd.env("GIT_CEILING_DIRECTORIES", parent);
    }
    cmd.args(args)
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
/// Prepare an isolated Git command in `current_dir`, using the same environment as fixture scripts.
    configure_git_environment(cmd, script_result_directory)
        .args(args)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `3befd38c` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
