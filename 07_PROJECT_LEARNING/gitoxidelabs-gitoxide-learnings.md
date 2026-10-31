> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/gitoxidelabs-gitoxide-learnings.md`  
> **Source**: github ([https://github.com/GitoxideLabs/gitoxide](https://github.com/GitoxideLabs/gitoxide))  
> **Source Version**: `e0be1edf`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-31T03:26:03.914Z  
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
> **Harvest Timestamp**: 2026-10-31T03:26:03.906Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `GitoxideLabs/gitoxide`
- **Description**: An idiomatic, lean, fast & safe pure Rust implementation of Git
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 12090 stars

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
        );
        let cpu = &sys.cpus()[0];
        let vendor = Some(cpu.vendor_id().to_owned());
        let host = sysinfo::System::host_name();
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
- **Issue #3139** (2026-10-29): **Preserve Cargo.lock in dependency checks**
  *Symptoms*: > [!NOTE] > This description was written by GPT-6.1 Sol, an LLM, using the Codex harness.  Dependency checks should validate the versions committed in `Cargo.lock`. Without `--locked`, Cargo can create a missing lockfile or update one that no longer resolves the manifests while preparing cargo-deny's dependency graph. The checks can therefore succeed against a different resolution from the one under review.  Add `--locked` to both cargo-deny CI jobs, `just audit`, and the local CI pre-check. These cargo-deny invocations now fail if Cargo needs to create or change the lockfile, requiring the dependency resolution to be updated explicitly.  Validation:  - `just audit` passes all four checks locally with cargo-deny 0.20.2 and freshly fetched RustSec data; the local CI pre-check's cargo-deny command also passes. `Cargo.lock` remains unchanged. - A disposable stale-lockfile fixture confirms that `--locked` prevents regeneration and fails, while the otherwise identical unlocked command regenerates its lockfile and passes. - Bash syntax, workflow structure (`actionlint -shellcheck=''`), and whitespace checks pass. - [Fork CI](https://github.com/EliahKagan/gitoxide/actions/runs/40969798848) passed both cargo-deny jobs with `--workspace --all-features --locked`, reporting `advisories ok` and `bans ok, licenses ok, sources ok`. Workspace tests passed on Linux, Windows, and macOS. This run tested the same file tree as the final commit; only its message was subsequently amended.  

- **Issue #3138** (2026-10-30): **fix(gix): reject symlinks in configured submodule paths**
  *Symptoms*: ## Tasks  This section is for Byron only. Models continuing this PR must not add, remove, check, uncheck, rename, or reorder checkboxes here.  - [x] refackiew  ----  Everything below this line was generated by `Codex`.  Created by Codex on behalf of Byron. Byron will review before this is ready to merge.  Configured submodule paths could resolve through symbolic links during repository lookup. This change rejects those paths before inspecting or opening the submodule, including status with `ignore=all`. Missing paths for uninitialized submodules and symlinks in the superproject's own path remain supported.  Bare superprojects now use only their modules-directory fallback, without probing the caller's current directory or inventing a worktree for a bare submodule repository. An isolated regression covers that behavior.  The motivation is the submodule-inspection report in [GHSA-2rx9-36wh-cm54](https://github.com/GitoxideLabs/gitoxide/security/advisories/GHSA-2rx9-36wh-cm54). The earlier fix in `392336fb114` already recomputes submodule trust; path validation is a separate requirement, so this change retains `open::Options`'s `Clone` implementation.  ### Advisory summary  - Severity: medium (CVSS 3.1: 5.3). - Package: `gix` (Rust), reported affected range `>= 0.52.0, <= 0.90.0`. - Patched version and CVE: not assigned in the advisory. - Disclosure status: private triage; report details are omitted here.  ### Validation  The new regression failed before the fix and covers 13 pat

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

### Incident Patch 1: `1e9051bf` (2026-10-30)
**Commit Message**: fix(gix): recompute trust when staging embedded repositories

<!-- agent -->
The caller audit after GHSA-2rx9-36wh-cm54 found another repository open
that copied the parent's determined trust. Although `Submodule::open()`
already clears `git_dir_trust`, `Pipeline::worktree_file_to_object()`
cloned its options unchanged when turning directories into gitlinks.
This bypasses independent ownership-based trust determination and also
affects `gix-tix` staging.

Clear cached trust and repository-local environment overrides before
opening the embedded repository, matching `Submodule::open()`. Keep
`Options::Clone` unchanged and preserve intentional API configuration.
Path validation and trust determination protect different boundaries.

The public regression observes trust through a configuration-section
filter while opening a fixture submodule. It failed with inherited
`Reduced` trust, despite the child being owned by the current user, and
now sees independently determined `Full` trust. Existing opening-path
and reload regressions continue to pass.

Assisted-by: GPT 6.1 Sol
Co-authored-by: GPT 6.1 Sol <[REDACTED_EMAIL]>

**File**: `gix/src/filter.rs` (modified, +3/-1)
```diff
@@ -206,7 +206,9 @@ impl Pipeline<'_> {
             (id, kind)
         } else if md.is_dir() {
             gix_fs::symlink::validate_relative_path(&parent_dir, std::path::Path::new(file_name))?;
-            let Some(submodule_repo) = crate::open_opts(&path, repo.open_options().clone()).ok() else {
+            let mut options = repo.open_options().clone().without_repository_environment_overrides();
+            options.git_dir_trust = None;
+            let Some(submodule_repo) = crate::open_opts(&path, options).ok() else {
                 return Ok(None);
             };
             let Some(id) = submodule_repo.head_id().ok() else {
```

**File**: `gix/tests/gix/repository/filter.rs` (modified, +33/-0)
```diff
@@ -220,6 +220,39 @@ fn pipeline_worktree_file_to_object() -> TestResult {
     Ok(())
 }
 
+#[test]
+#[cfg(unix)]
+fn worktree_file_to_object_recomputes_submodule_trust() -> TestResult {
+    fn check_submodule_trust(meta: &gix_config::file::Metadata) -> bool {
+        if meta
+            .path
+            .as_ref()
+            .is_some_and(|path| path.ends_with(Path::new("modules/submodule/config")))
+        {
+            assert_eq!(
+                meta.trust,
+                gix_sec::Trust::Full,
+                "the fixture submodule is owned by this user, regardless of the parent's forced trust"
+            );
+        }
+        true
+    }
+    let repo = named_subrepo_opts(
+        "repo_with_untracked_files.sh",
+        ".",
+        gix::open::Options::isolated()
+            .with(gix_sec::Trust::Reduced)
+            .filter_config_section(check_submodule_trust),
+    )?;
+    assert_eq!(repo.git_dir_trust(), gix_sec::Trust::Reduced, "parent trust is forced");
+    let (mut pipe, index) = repo.filter_pipeline(None)?;
+    assert!(
+        pipe.worktree_file_to_object("submodule".into(), &index)?.is_some(),
+        "opening the submodule consults its local core.worktree configuration"
+    );
+    Ok(())
+}
+
 #[test]
 #[cfg(unix)]
 fn worktree_file_to_object_opens_submodules_after_path_options_were_consumed() -> TestResult {
```

---

### Incident Patch 2: `ef37e22b` (2026-10-30)
**Commit Message**: fix(gix): reject symlinked ancestors during file-to-object conversion

<!-- agent -->
The submodule path audit found `Pipeline::worktree_file_to_object()`
opening embedded repositories without validating their worktree paths.
This API is also used by `gix-tix` when staging changes. A directory link
could redirect both repository lookup and ordinary file reads.

Validate the parent before metadata or reads, retaining trackable leaf
symlinks. Validate the entire directory path before opening an embedded
repository. Reject paths without a file name and paths escaping the root;
keep the original spelling so trailing separators cannot bypass checks.

The regression failed before the fix by turning the repository behind a
directory symlink into a gitlink. It covers repository, file, and leaf-link
lookups through ancestors, trailing separators, dot/parent aliases, and
invalid root-only paths; existing valid leaf-link behavior still passes.
Run the writable fixture directly because its FIFO cannot be copied.

Assisted-by: GPT 6.1 Sol
Co-authored-by: GPT 6.1 Sol <[REDACTED_EMAIL]>

**File**: `gix/src/filter.rs` (modified, +9/-0)
```diff
@@ -149,6 +149,7 @@ impl Pipeline<'_> {
     /// and it should match the state used when [instantiating this instance](Self::new()).
     ///
     /// Return `Ok(None)` the file didn't exist in the worktree, or if it was of an untrackable type.
+    /// Reject paths outside the worktree or through symlinked ancestors, while allowing leaf symlinks.
     pub fn worktree_file_to_object(
         &mut self,
         rela_path: &BStr,
@@ -159,6 +160,13 @@ impl Pipeline<'_> {
         let worktree_dir = repo
             .workdir()
             .ok_or_else(|| Error::from_error(message("Cannot add worktree files in bare repositories")))?;
+        let Some(file_name) = rela_path_as_path.file_name() else {
+            bail!(gix_error::validation("A worktree file path must have a file name").with_input(rela_path));
+        };
+        let parent_dir = gix_fs::symlink::validate_relative_path(
+            worktree_dir,
+            rela_path_as_path.parent().expect("a file path has a parent"),
+        )?;
         let path = worktree_dir.join(&rela_path_as_path);
         let md = match std::fs::symlink_metadata(&path) {
             Ok(md) => md,
@@ -197,6 +205,7 @@ impl Pipeline<'_> {
             };
             (id, kind)
         } else if md.is_dir() {
+            gix_fs::symlink::validate_relative_path(&parent_dir, std::path::Path::new(file_name))?;
             let Some(submodule_repo) = crate::open_opts(&path, repo.open_options().clone()).ok() else {
                 return Ok(None);
             };
```

**File**: `gix/tests/fixtures/repo_with_untracked_files.sh` (modified, +2/-1)
```diff
@@ -9,11 +9,12 @@ git init embedded-repository
 git init -q
 echo content >file
 ln -s file link
+ln -s . directory-link
 
 echo binary >exe && chmod +x exe
 mkfifo fifo
 
 git submodule add ./embedded-repository submodule
 
 mkdir empty-dir
-git init uninitialized-embedded-repository
\ No newline at end of file
+git init uninitialized-embedded-repository
```

**File**: `gix/tests/gix/repository/filter.rs` (modified, +36/-5)
```diff
@@ -131,7 +131,7 @@ fn legacy_driver_names_are_canonical() -> TestResult {
 #[test]
 #[cfg(unix)]
 fn pipeline_worktree_file_to_object() -> TestResult {
-    let repo = named_repo("repo_with_untracked_files.sh")?;
+    let repo = named_repo("repo_with_untracked_files.sh")?.with_object_memory();
     let work_dir = repo.workdir().expect("non-bare");
     let (mut pipe, index) = repo.filter_pipeline(None)?;
     fn take_two<A, B, C>(t: Option<(A, B, C)>) -> Option<(A, B)> {
@@ -145,10 +145,13 @@ fn pipeline_worktree_file_to_object() -> TestResult {
         take_two(pipe.worktree_file_to_object("embedded-repository".into(), &index)?),
         Some((submodule_id, gix::object::tree::EntryKind::Commit))
     );
-    assert_eq!(
-        take_two(pipe.worktree_file_to_object("submodule".into(), &index)?),
-        Some((submodule_id, gix::object::tree::EntryKind::Commit))
-    );
+    for path in ["submodule", "submodule/", "submodule/.", "empty-dir/../submodule"] {
+        assert_eq!(
+            take_two(pipe.worktree_file_to_object(path.into(), &index)?),
+            Some((submodule_id, gix::object::tree::EntryKind::Commit)),
+            "directory validation preserves safe path spellings: {path}"
+        );
+    }
     assert_eq!(
         take_two(pipe.worktree_file_to_object("uninitialized-embedded-repository".into(), &index)?),
         None,
@@ -186,6 +189,34 @@ fn pipeline_worktree_file_to_object() -> TestResult {
         None,
         "untrackable entries are just ignored as if they didn't exist"
     );
+    for path in [
+        "directory-link/embedded-repository",
+        "directory-link/submodule",
+        "directory-link/file",
+        "directory-link/link",
+        "directory-link/",
+        "directory-link/.",
+        "empty-dir/../directory-link/",
+        "empty-dir/../directory-link/.",
+        "directory-link/../file",
+        "../file",
+    ] {
+        let err = pipe
+            .worktree_file_to_object(path.into(), &index)
+            .expect_err("object creation must not traverse a symlink");
+        assert!(err.is_validation(), "the unsafe path is rejected: {path}: {err:?}");
+    }
+    for path in ["", ".", "..", "empty-dir/.."] {
+        let err = pipe
+            .worktree_file_to_object(path.into(), &index)
+            .expect_err("a path without a file name must not be added, even if it has a parent");
+        assert!(err.is_validation(), "the path without a file name is rejected: {path}");
+        assert_eq!(
+            err.metadata().next().expect("the validation error retains its input")["input"],
+            gix_error::MetadataValue::from(path.as_bytes()),
+            "the original path bytes remain available in the validation error"
+        );
+    }
     Ok(())
 }
 
```

---

### Incident Patch 3: `a9f1f1ed` (2026-10-29)
**Commit Message**: fix(gix)!: reject symlinks in configured submodule paths

- Some API modifications to capture optionality of worktree directories with type system
- mostly rubber-stamped tests, based on their titles

<!-- agent -->
Submodule inspection must validate the configured worktree path before
using it to locate a repository. This addresses GHSA-2rx9-36wh-cm54.
The earlier trust fix in `392336fb114` already recomputes trust when
opening a submodule, but ownership checks cannot validate the selected
repository's relationship to the superproject.

Check each configured path component before
looking for its `.git` entry. Reject symlinks before normalizing away
parent components, permit missing paths for uninitialized submodules,
and preserve symlinks in the superproject's own path. The shared lookup
covers `git_dir_try_old_form()`, `state()`, `open()`, and `status()`,
including `Ignore::All`.

The regression failed before this change. Its read-only fixture covers
13 path variants, also checked locally against Git's submodule helper.
Existing tests preserve uninitialized submodules, linked worktrees, and
independent trust determination.

Git reference: `validate_submodule_path()` in `submodule

**File**: `gix/src/submodule/mod.rs` (modified, +42/-21)
```diff
@@ -210,27 +210,36 @@ impl Submodule<'_> {
         git_dir_from_name(self.state.repo.git_dir(), self.validated_name()?)
     }
 
-    /// Return the path to the location at which the workdir would be checked out.
+    /// Return the submodule's checkout location, or `None` if the superproject has no working directory.
     ///
-    /// Note that it may be a path relative to the repository if, for some reason, the parent directory
-    /// doesn't have a working dir set.
-    pub fn work_dir(&self) -> Result<PathBuf> {
-        let worktree_git = gix_path::from_bstr(self.path()?)?;
-        Ok(match self.state.repo.workdir() {
-            None => worktree_git.into_owned(),
-            Some(prefix) => prefix.join(worktree_git),
-        })
+    /// The returned directory might not exist yet. Use [`path()`](Self::path()) to obtain the configured
+    /// relative path regardless of whether the superproject has a working directory.
+    pub fn work_dir(&self) -> Result<Option<PathBuf>> {
+        let Some(work_dir) = self.state.repo.workdir() else {
+            return Ok(None);
+        };
+        Ok(Some(work_dir.join(gix_path::from_bstr(self.path()?)?)))
     }
 
-    /// Return the path at which the repository of the submodule should be located, or the path inside of
-    /// the superproject's worktree where it actually *is* located if the submodule in the 'old-form', thus is a directory
-    /// inside of the superproject's work-tree.
+    /// Return the submodule's repository location, honoring old-form `.git` directories and gitdir
+    /// file targets in the superproject's worktree.
+    ///
+    /// Fall back to the name-derived [`git_dir()`](Self::git_dir()) when no checkout `.git` entry exists.
+    /// This fallback directory might not exist yet for uninitialized submodules.
     ///
     /// Note that paths returned aren't fully verified, i.e. the `.git` repository might be corrupt or otherwise
     /// invalid - it's left to the caller to try to open it. `.git` files are parsed when present and their target
     /// is required to be a directory though, as a malformed gitdir file means a broken submodule checkout.
     ///
-    /// Also note that the fallback path returned for uninitialized submodules may not actually exist.
+    /// Symbolic links in the configured submodule path are rejected. Symlinks in the superproject's
+    /// own path are allowed.
+    ///
+    /// Without a superproject worktree, there is no checkout `.git` entry to inspect. Repository lookup
+    /// therefore uses the name-derived location returned by [`git_dir()`](Self::git_dir()).
+    /// For example, a bare superproject at `/repos/project.git` with submodule name `library` and configured
+    /// path `vendor/lib` returns `/repos/project.git/modules/library`, even if that directory does not exist.
+    /// It does not inspect `vendor/lib/.git` relative to the current directory, as there is no superproject
+    /// worktree to anchor that checkout path.
     pub fn git_dir_try_old_form(&self) -> Result<PathBuf> {
         self.git_dir_try_old_form_inner(true)
     }
@@ -244,7 +253,9 @@ impl Submodule<'_> {
         let git_dir = self
             .git_dir()
             .or_raise(|| gix_error::validation("The submodule name is invalid"))?;
-        let worktree_gitdir = self.worktree_gitdir()?;
+        let Some(worktree_gitdir) = self.worktree_gitdir()? else {
+            return Ok(git_dir);
+        };
         let git_dir = if worktree_gitdir.is_dir() {
             worktree_gitdir
         } else if worktree_gitdir.is_file() {
@@ -286,8 +297,8 @@ impl Submodule<'_> {
             .any(|section| section.header().subsection_name() == Some(self.name.as_ref()));
         Ok(State {
             repository_exists: maybe_old_path.is_dir(),
-            is_old_form: worktree_git.is_dir(),
-            worktree_checkout: worktree_git.exists(),
+            is_old_form: worktree_git.as_deref().is_some_and(Path::is_dir),
+            worktree_checkout: worktree_git.as_deref().is_some_and(Path::exists),
             superproject_configuration,
         })
     }
@@ -319,9 +330,10 @@ impl Submodule<'_> {
         options.git_dir_trust = None;
         match crate::open_opts(self.git_dir_try_old_form()?, options) {
             Ok(mut repo) => {
-                if repo.workdir().is_none() {
-                    let wd = self.work_dir()?;
-                    // We should always have a workdir, as bare submodules don't exist.
+                if repo.workdir().is_none()
+                    && let Some(wd) = self.work_dir()?
+                {
+                    // Submodules of a checked-out superproject should always have a workdir.
                     // However, it's possible for no workdir to be accessible if there is a symlink in the way.
                     // Just setting it by hand fixes this issue effectively, even though the question remains
                     // if this should work automatically.
@@ -
```

**File**: `gix/tests/fixtures/make_submodule_symlink_paths.sh` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+#!/usr/bin/env bash
+set -eu -o pipefail
+
+# Configured submodule paths must not traverse symlinks, even without index gitlinks.
+# Cover old-form and gitdir-file repositories, dangling links, and lexical aliases.
+git init -q other
+git init -q superproject
+(cd superproject
+  git init -q actual/old
+  git init -q --separate-git-dir "$PWD/modern.git" actual/modern
+  ln -s .. parent
+  ln -s ../other leaf
+  ln -s actual inside
+  ln -s missing dangling
+  ln -s / absolute
+  mkdir deps
+  ln -s ../../other deps/nested
+
+  case_number=0
+  for path in parent/other leaf inside/old inside/modern dangling dangling/child \
+              absolute/missing deps/nested parent//other parent/./other leaf/ leaf/. inside/../actual/old
+  do
+    case_number=$((case_number + 1))
+    git config -f .gitmodules "submodule.case-$case_number.path" "$path"
+    git config -f .gitmodules "submodule.case-$case_number.url" ../other
+  done
+  git add .gitmodules parent leaf inside dangling absolute deps/nested
+  git commit -qm "configured paths through symlinks"
+)
+git clone -q --bare superproject bare.git
+git init -q --bare bare.git/modules/case-1
+
+# A regular file obstructing the checkout must still allow the modules-directory fallback.
+git init -q obstructed
+(cd obstructed
+  git init -q --bare .git/modules/module
+  git config -f .git/modules/module/config core.bare false
+  git config -f .git/modules/module/config core.worktree ../../../blocked/child
+  git config -f .gitmodules submodule.module.path blocked/child
+  git config -f .gitmodules submodule.module.url ../other
+  touch blocked
+)
```

**File**: `gix/tests/gix/submodule.rs` (modified, +136/-2)
```diff
@@ -277,6 +277,130 @@ mod open {
 
     use crate::{submodule::repo, util::named_subrepo_opts};
 
+    #[test]
+    #[cfg(unix)]
+    fn configured_paths_reject_symlinks() -> TestResult {
+        let fixture = gix_testtools::scripted_fixture_read_only("make_submodule_symlink_paths.sh")?;
+        let repo = gix::open_opts(fixture.join("superproject"), gix::open::Options::isolated())?;
+        let mut count = 0;
+        for sm in repo.submodules()?.expect("fixture has configured submodules") {
+            let path = sm.path()?;
+            assert!(sm.git_dir()?.starts_with(repo.git_dir()), "the name itself is valid");
+            for err in [
+                sm.git_dir_try_old_form()
+                    .expect_err("repository lookup rejects symlinks"),
+                sm.state().expect_err("state inspection rejects symlinks"),
+                sm.open().expect_err("opening rejects symlinks"),
+            ] {
+                assert!(
+                    err.downcast_any_ref::<gix_error::Message>()
+                        .is_some_and(|error| error.class == Some(gix_error::Class::Validation)),
+                    "path {path:?} fails validation: {err:?}"
+                );
+                assert!(
+                    err.to_string().contains("symbolic link"),
+                    "the error identifies the symlink in {path:?}: {err:?}"
+                );
+            }
+            #[cfg(feature = "status")]
+            for ignore in [
+                gix::submodule::config::Ignore::None,
+                gix::submodule::config::Ignore::All,
+            ] {
+                let err = sm
+                    .status(ignore, false)
+                    .expect_err("even coarse state rejects symlinks");
+                assert!(
+                    err.to_string().contains("symbolic link"),
+                    "status rejects the symlink in {path:?}: {err:?}"
+                );
+            }
+            count += 1;
+        }
+        assert_eq!(count, 13, "all symlink variants were exercised");
+        Ok(())
+    }
+
+    #[test]
+    #[cfg(unix)]
+    fn bare_superproject_does_not_inspect_the_current_directory() -> TestResult {
+        if gix_testtools::run_in_isolated_process()? {
+            return Ok(());
+        }
+        let fixture = gix::path::realpath(gix_testtools::scripted_fixture_read_only(
+            "make_submodule_symlink_paths.sh",
+        )?)?;
+        let repo = gix::open_opts(fixture.join("bare.git"), gix::open::Options::isolated())?;
+        let _cwd = gix_testtools::set_current_dir(fixture.join("superproject"))?;
+        assert!(repo.workdir().is_none(), "the superproject has no worktree");
+        for sm in repo.submodules()?.expect("submodules are read from HEAD") {
+            assert_eq!(
+                sm.work_dir()?,
+                None,
+                "a bare superproject has no submodule checkout location"
+            );
+            let expected_git_dir = sm.git_dir()?;
+            assert_eq!(
+                sm.git_dir_try_old_form()?,
+                expected_git_dir,
+                "bare superprojects return the name-derived location even if it does not exist"
+            );
+            let state = sm.state()?;
+            assert!(!state.worktree_checkout, "the caller's directory is not a checkout");
+            assert!(!state.is_old_form, "no old-form lookup occurs without a worktree");
+            let opened = sm.open()?;
+            assert_eq!(opened.is_some(), sm.name() == "case-1", "only one repository exists");
+            assert_eq!(state.repository_exists, opened.is_some(), "state agrees with opening");
+            if let Some(opened) = opened {
+                assert_eq!(opened.git_dir(), expected_git_dir, "the intended repository opens");
+                assert!(
+                    opened.workdir().is_none(),
+                    "no worktree is invented from the caller's cwd"
+                );
+            }
+            #[cfg(feature = "status")]
+            assert_eq!(
+                sm.status(gix::submodule::config::Ignore::All, false)?.state,
+                state,
+                "coarse status also ignores the caller's directory"
+            );
+        }
+        Ok(())
+    }
+
+    #[test]
+    #[cfg(unix)]
+    fn non_directory_path_prefix_allows_repository_fallback() -> TestResult {
+        let fixture = gix_testtools::scripted_fixture_read_only("make_submodule_symlink_paths.sh")?;
+        let repo = gix::open_opts(fixture.join("obstructed"), gix::open::Options::isolated())?;
+        let sm = repo
+            .submodules()?
+            .expect("configured submodules")
+            .next()
+            .expect("module");
+        let expected_git_dir = repo.git_dir().join("modules/module");
+        assert_eq!(
+            sm.git_dir_try_old_form()?,
+            expected_git_dir,
+            "a non-directory obstruction leaves the fallback available"
+        );
+        let state 
```

**File**: `gix/tests/submodule_open.rs` (modified, +2/-2)
```diff
@@ -20,8 +20,8 @@ fn on_nested_symlink() -> gix_testtools::TestResult {
     let repo = gix::discover_opts(".", Default::default(), gix::open::Options::isolated())?;
     let sm = repo.submodules()?.into_iter().flatten().next().expect("one submodule");
     assert_eq!(
-        sm.work_dir()?,
-        p("../../m1"),
+        sm.work_dir()?.as_deref(),
+        Some(p("../../m1")),
         "the workdir remains relative and is available"
     );
     let sm_repo = sm.open()?.expect("repo is present and accessible");
```

#### Recent Merged Pull Requests:
- **PR #3139** (2026-10-29): Preserve Cargo.lock in dependency checks (@EliahKagan)
- **PR #3138** (2026-10-30): fix(gix): reject symlinks in configured submodule paths (@Byron)
- **PR #3137** (2026-10-29): Restore transitive soundness advisory reporting (@EliahKagan)
- **PR #3136** (2026-10-29): Correct why `release.yml` avoids YAML anchors (@EliahKagan)
- **PR #3135** (2026-10-29): Update `libz-sys` to fix the CI advisory check (@EliahKagan)
- **PR #3132** (2026-10-29): fix(gix-path): discover Windows package-manager Git installations and MSYS2 companions (@Byron)

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

## X. gix): recompute trust when staging embedded repositories

**RULE**:
When implementing operations in `gix/src/filter.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in GitoxideLabs/gitoxide. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1e9051bf`: gix): recompute trust when staging embedded repositories. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `gix/src/filter.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
            let mut options = repo.open_options().clone().without_repository_environment_overrides();
            options.git_dir_trust = None;
            let Some(submodule_repo) = crate::open_opts(&path, options).ok() else {
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
            let Some(submodule_repo) = crate::open_opts(&path, repo.open_options().clone()).ok() else {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1e9051bf` are properly handled with clean fallback behavior.
