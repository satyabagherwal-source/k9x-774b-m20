> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/gitoxidelabs-gitoxide-learnings.md`  
> **Source**: github ([https://github.com/GitoxideLabs/gitoxide](https://github.com/GitoxideLabs/gitoxide))  
> **Source Version**: `641aca38`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-05T04:43:34.931Z  
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
> **Harvest Timestamp**: 2026-11-05T04:43:34.923Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `GitoxideLabs/gitoxide`
- **Description**: A tasteful, lean, fast & safe pure Rust implementation of Git
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 12103 stars

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
- **Issue #3157** (2026-11-05): **Create `oid` from bytes in one `unsafe` block in `gix-hash`**
  *Symptoms*: Title: Create `oid` from bytes in one `unsafe` block in `gix-hash`  **AI disclosure:** Claude Code, an AI agent, wrote this description and the patch, and is speaking through the `b84330808` account. The commit carries a `Co-Authored-By` trailer for the same reason.  ### Motivation  This follows #3150. The account holder asked me to look for `unsafe` in gitoxide's parsers that can be removed or narrowed, as security hardening and for Google's Patch Rewards program. The cast from `&[u8]` to `&oid` can't be written in safe Rust, but `gix-hash` had three copies of it, none with a `SAFETY` comment. `oid::try_from_bytes()` gets its input from the tree parser in `gix-object`, among others.  ### Change  - `try_from_bytes()` calls `from_bytes()` after its length check instead of repeating the cast for   each hash kind. `gix-hash` now has one `unsafe` block. - Add a `SAFETY` comment to that block: `oid` is `#[repr(transparent)]` over `[u8]`, the cast keeps   the length, and an unexpected length makes `kind()` panic but isn't undefined behaviour. - Mark `from_bytes()` `#[inline]` so callers of the `#[inline]` `try_from_bytes()` in other crates   still see the cast.  ### Verification (by the agent, on Windows, `x86_64-pc-windows-gnu`, Rust 1.99.1)  - `cargo test -p gix-hash` with `--features sha1`, `sha256` and `sha1,sha256`: all passed. - `cargo clippy -p gix-hash --all-targets --features sha1,sha256 --no-deps -- -D warnings`: no findings. - `cargo +stable fmt -p gix-hash -- --check` a
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary --> <!-- codex-review-state:v1 {"code_review":{"commit_sha":"d7949ff324e17555b50adb2d544ca8d7077c35e5","has_any_findings":false,"has_unresolved_findings":false,"status":"completed"},"security_review":{"commit_sha":null,"has_any_findings":null,"has_unresolved_findings":null,"status":null}} -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-11-04T16:10:24.044911Z">2026-11-04T16:10:24.044911Z</relative-time> | `d7949ff` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex 
  > That's a warning - I rubber-stamped the commit that introduced this, in a rush. While it's not actually unsafe, it's something I wouldn't have allowed either.

- **Issue #3156** (2026-11-04): **much faster qa**
  *Symptoms*: Prune dependency configurations more. 
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary --> <!-- codex-review-state:v1 {"code_review":{"commit_sha":"71bbcef515982cf49df854c44bc8ea0a29736f0f","has_any_findings":false,"has_unresolved_findings":false,"status":"completed"},"security_review":{"commit_sha":null,"has_any_findings":null,"has_unresolved_findings":null,"status":null}} -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-11-04T14:50:13.210149Z">2026-11-04T14:50:13.210149Z</relative-time> | `71bbcef` | Draft marked ready |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review"
  > CI isn't quite as fast here yet as it sees changes to the `it` tool which make it conservative. However, ideally soon this will get much better.

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

### Incident Patch 1: `61bbd5b5` (2026-11-04)
**Commit Message**: Share generated fixtures across QA test stages

The demand-driven `gix-archive` PR run still regenerated the same expensive
`gix` fixtures in its native and feature test stages. CI shared generated
fixtures within native archive/generated replays, but each local test task
started with a separate cache.

Keep one fresh generated-fixture cache and its source snapshots alive for
an entire QA invocation. Run native tests in the catalog process so native,
isolated and feature suites can use the existing `gix-testtools` cache
without new inherited environment variables or CLI options. Preserve each
replay's fixture hash, archive policy, source isolation and detailed logs.

Reject cache reuse when source copies differ between stages. Check every
retained snapshot after each stage, since a shared fixture can reference
an earlier source copy, and retain all related paths on integrity failure.
Separate invocations and CI jobs still start fresh.

The new ownership tests also exposed a temporary-directory name collision
between concurrent tests. Retry creation with a new name on `AlreadyExists`;
never reuse an existing directory.

Validation: 56 QA self-tests and Clippy pass, including a regre

**File**: `DEVELOPMENT.md` (modified, +6/-5)
```diff
@@ -393,14 +393,15 @@ when an archive is absent or stale. This avoids repeated expensive Git subproces
 comparisons against freshly generated Git baselines still run in exhaustive QA. Linux and macOS
 fast tests use freshly generated fixtures. Exhaustive native tests compile/list once,
 then reuse the same nextest binaries for archived and generated fixtures in separate temporary
-source copies. The native passes share a fresh cache of generated read-only scripted fixtures.
+source copies. Native passes and feature/hash or isolated test variants within one QA run
+share a fresh cache of generated read-only scripted fixtures, locally and within each CI job.
 When no archive is available, the archived pass can generate a fixture once for both passes;
 the shared cache never substitutes extracted archives for generated fixtures. Fixtures that write archives or require
 execution in a writable destination keep their existing behavior. The cache and its source
-copies remain alive until both passes finish, and are retained together if a source copy changes.
-Feature/hash variants also run in an isolated copy, sharing compatible fixture
-caches within their task and continuing after individual failures. Their fixture caches cannot
-reuse a previous local run's extracted archives. Archive changes cause
+copies remain alive until the run finishes, and are retained together if a source copy changes.
+Changes to source files between stages prevent cache reuse. Feature/hash variants also run in
+an isolated copy and continue after individual failures. Separate runs and CI jobs never reuse
+each other's generated fixtures or extracted archives. Archive changes cause
 a failure and retain the changed copy for inspection. Explicit archive-only fixtures keep
 their normal semantics.
 
```

**File**: `tests/it/src/qa/catalog.rs` (modified, +5/-2)
```diff
@@ -554,6 +554,7 @@ pub fn execute(
     let mut nonblocking_failed = 0;
     let count = tasks.len();
     let mut timings = Vec::with_capacity(count);
+    let mut snapshots = super::native_tests::NativeSnapshots::default();
     for (index, task) in tasks.into_iter().enumerate() {
         let started = Instant::now();
         let path = logs.map(|logs| logs.join(format!("{}.log", task.id)));
@@ -570,8 +571,10 @@ pub fn execute(
                 if task.blocking { "" } else { " (nonblocking)" }
             );
         }
-        let result = if matches!(task.id, "feature-tests" | "isolated-tests") {
-            super::native_tests::variants(root, task.commands, dry_run, log.as_ref())
+        let result = if task.id == "native-tests" && !dry_run {
+            super::native_tests::execute(root, &task.commands[0].args[1..], &mut snapshots, log.as_ref())
+        } else if matches!(task.id, "feature-tests" | "isolated-tests") {
+            super::native_tests::variants(root, task.commands, dry_run, &mut snapshots, log.as_ref())
         } else if task.id == "feature-builds" {
             run::each_case(task.commands, log.as_ref(), |command| {
                 run::execute(root, vec![command], dry_run, log.as_ref())
```

**File**: `tests/it/src/qa/main.rs` (modified, +6/-1)
```diff
@@ -100,7 +100,12 @@ fn main() -> Result<()> {
     }
     if let Action::Exec { args } = &args.command {
         if args[0] == "native-tests" {
-            return native_tests::execute(&current_dir, &args[1..]);
+            return native_tests::execute(
+                &current_dir,
+                &args[1..],
+                &mut native_tests::NativeSnapshots::default(),
+                None,
+            );
         }
         return ops::execute(&current_dir, args);
     }
```

**File**: `tests/it/src/qa/native_tests.rs` (modified, +211/-78)
```diff
@@ -17,33 +17,48 @@ enum Fixtures {
     Generated,
 }
 
-struct NativeSnapshots {
+#[derive(Default)]
+pub(super) struct NativeSnapshots {
     sources: Vec<(Snapshot, SourceState)>,
     // Only generated fixtures use this cache; extracted archives stay in their source snapshot.
     cache: Option<Snapshot>,
 }
 
 impl NativeSnapshots {
-    fn new(root: &Path, count: usize) -> Result<Self> {
-        Ok(Self {
-            sources: (0..count).map(|_| snapshot(root)).collect::<Result<_>>()?,
-            cache: (count > 1).then(empty_snapshot).transpose()?,
-        })
+    fn add(&mut self, root: &Path, count: usize) -> Result<usize> {
+        let first = self.sources.len();
+        for _ in 0..count {
+            let source = snapshot(root)?;
+            if self.sources.first().is_some_and(|(_, before)| *before != source.1) {
+                self.retain();
+                bail!("Source files changed between native test stages; refusing to reuse generated fixtures");
+            }
+            self.sources.push(source);
+        }
+        if self.cache.is_none() {
+            self.cache = Some(empty_snapshot()?);
+        }
+        Ok(first)
     }
 
-    fn check(self, index: usize) -> Result<Self> {
-        let (snapshot, before) = &self.sources[index];
-        if let Err(error) = unchanged(&snapshot.path, before) {
-            for (snapshot, _) in &self.sources {
-                eprintln!("Retained native test snapshot at {}", snapshot.path.display());
+    fn check(&mut self) -> Result<()> {
+        for (snapshot, before) in &self.sources {
+            if let Err(error) = unchanged(&snapshot.path, before) {
+                self.retain();
+                return Err(error);
             }
-            if let Some(cache) = &self.cache {
-                eprintln!("Retained native fixture cache at {}", cache.path.display());
-            }
-            std::mem::forget(self);
-            return Err(error);
         }
-        Ok(self)
+        Ok(())
+    }
+
+    fn retain(&mut self) {
+        for (snapshot, _) in &self.sources {
+            eprintln!("Retained native test snapshot at {}", snapshot.path.display());
+        }
+        if let Some(cache) = &self.cache {
+            eprintln!("Retained native fixture cache at {}", cache.path.display());
+        }
+        std::mem::forget(std::mem::take(self));
     }
 }
 
@@ -60,37 +75,34 @@ fn cargo(root: &Path) -> Result<Command> {
     run::process(root, &run::normalize(run::Command::new("cargo", &[])))
 }
 
-fn reuse_binaries(command: &mut Command, metadata: &Path, binaries: &Path, snapshot: &Path) {
+fn reuse_binaries(command: &mut Command, metadata: &Path, binaries: &Path, snapshot: &Path, cache: &Path) {
     command
         .args(["nextest", "run", "--cargo-metadata"])
         .arg(metadata)
         .arg("--binaries-metadata")
         .arg(binaries)
         .arg("--workspace-remap")
         .arg(snapshot)
-        .arg("--no-fail-fast");
+        .arg("--no-fail-fast")
+        .env("GIX_TEST_FIXTURE_CACHE", cache)
+        .env("GIX_TEST_FIXTURE_SOURCE_ROOT", snapshot);
 }
 
 fn test_command(
     root: &Path,
     metadata: &Path,
     binaries: &Path,
     snapshot: &Path,
-    cache: Option<&Path>,
+    cache: &Path,
     fixtures: Fixtures,
     windows_arm: bool,
 ) -> Result<Command> {
     let mut command = cargo(root)?;
-    reuse_binaries(&mut command, metadata, binaries, snapshot);
+    reuse_binaries(&mut command, metadata, binaries, snapshot, cache);
     command
         .args(["--no-tests", "pass"])
         .env_remove("GIX_TEST_IGNORE_ARCHIVES")
         .env_remove("GIX_TEST_CREATE_ARCHIVES_EVEN_ON_CI");
-    if let Some(cache) = cache {
-        command
-            .env("GIX_TEST_FIXTURE_CACHE", cache)
-            .env("GIX_TEST_FIXTURE_SOURCE_ROOT", snapshot);
-    }
     command.env(
         match fixtures {
             Fixtures::Archived => "GIX_TEST_CREATE_ARCHIVES_EVEN_ON_CI",
@@ -109,54 +121,68 @@ fn test_command(
     Ok(command)
 }
 
-pub fn execute(root: &Path, args: &[String]) -> Result<()> {
+pub fn execute(root: &Path, args: &[String], snapshots: &mut NativeSnapshots, log: Option<&File>) -> Result<()> {
     let (mode, args) = args
         .split_first()
         .ok_or_raise(|| message("native-tests needs a mode and Cargo selection arguments"))?;
     let modes = fixture_modes(mode, cfg!(windows))?;
     let before = source_state(root)?;
-    let result = run(root, args, modes);
+    let result = run(root, args, modes, snapshots, log);
     if before != source_state(root)? {
         bail!("Native tests changed tracked or visible untracked source files; changes were retained for inspection");
     }
     result
 }
 
-fn run(root: &Path, args: &[String], modes: &[Fixtures]) -> Result<()> {
-    let binaries = output(
-        cargo(root)?
-            .args([
-                "nextest",
-                "list",
-                "--list-type",
-                "binaries-only",
-     
```

**File**: `tests/it/src/qa/ops.rs` (modified, +13/-9)
```diff
@@ -312,18 +312,22 @@ pub(super) fn source_snapshot(root: &Path) -> Result<Snapshot> {
 }
 
 pub(super) fn empty_snapshot() -> Result<Snapshot> {
-    let stamp = SystemTime::now()
+    let mut stamp = SystemTime::now()
         .duration_since(UNIX_EPOCH)
         .or_raise(|| message("Read time for QA snapshot"))?
         .as_nanos();
-    // Git for Windows still limits some repository paths even with core.longpaths enabled.
-    let mut id = DefaultHasher::new();
-    (std::process::id(), stamp).hash(&mut id);
-    let path = std::path::absolute(std::env::temp_dir())
-        .or_raise(|| message("Resolve QA temporary directory"))?
-        .join(format!("qa-{:x}", id.finish()));
-    fs::create_dir(&path).or_raise(|| message!("Create QA snapshot {}", path.display()))?;
-    Ok(Snapshot { path })
+    let directory = std::path::absolute(std::env::temp_dir()).or_raise(|| message("Resolve QA temporary directory"))?;
+    loop {
+        // Git for Windows still limits some repository paths even with core.longpaths enabled.
+        let mut id = DefaultHasher::new();
+        (std::process::id(), stamp).hash(&mut id);
+        let path = directory.join(format!("qa-{:x}", id.finish()));
+        match fs::create_dir(&path) {
+            Ok(()) => return Ok(Snapshot { path }),
+            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => stamp += 1,
+            Err(error) => return Err(error).or_raise(|| message!("Create QA snapshot {}", path.display())),
+        }
+    }
 }
 
 fn snapshot_files(root: &Path, files: &[u8]) -> Result<Snapshot> {
```

---

### Incident Patch 2: `2daa02cb` (2026-11-04)
**Commit Message**: fix(gix-credentials): address review feedback on ephemeral token lifetime

Rubber-stamp tests, checked production code.

<!-- agent -->
One helper can return `ephemeral=1` before a later helper supplies the token.
Previously, a later `credential` without an `ephemeral` line reset the flag
to `None`. Store callbacks then omitted the no-cache hint and could allow a
short-lived token to be cached.

The review requested:
> Git retains the earlier flag for the same exchange; merge this field only
> when the later helper supplies a value.

Merge the lifetime flag independently of the credential, changing it only
for an explicit helper value. Retain explicit false/true overrides and the
existing expiry handling.

The regression failed before the fix. It checks omitted, false, and true
values from the later helper, verifies both store and erase payloads, and
compares the same two-helper exchange against isolated Git 2.54.0. Git omits
false flags when serializing its result; lifetime semantics match in every
case.

Assisted-by: GPT 6.0 Astra
Co-authored-by: GPT 6.0 Astra <[REDACTED_EMAIL]>

**File**: `gix-credentials/src/helper/cascade.rs` (modified, +2/-2)
```diff
@@ -141,8 +141,8 @@ impl Cascade {
                             }
                             if let Some(src) = credential {
                                 dst_ctx.credential = Some(src);
-                                dst_ctx.ephemeral = ephemeral;
-                            } else if let Some(src) = ephemeral {
+                            }
+                            if let Some(src) = ephemeral {
                                 dst_ctx.ephemeral = Some(src);
                             }
                         }
```

**File**: `gix-credentials/tests/helper/cascade.rs` (modified, +73/-0)
```diff
@@ -90,6 +90,79 @@ ephemeral=1
         Ok(())
     }
 
+    #[test]
+    fn later_helpers_preserve_or_explicitly_override_ephemeral() -> TestResult {
+        if gix_testtools::run_in_isolated_process()? {
+            return Ok(());
+        }
+        let temp = gix_testtools::tempfile::tempdir()?;
+        let _cwd = gix_testtools::set_current_dir(temp.path())?;
+        for later_ephemeral in [None, Some(false), Some(true)] {
+            let first_helper = r#"!f() {
+                cat >/dev/null
+                printf 'capability[]=authtype\nauthtype=Bearer\nephemeral=1\n'
+            }; f"#;
+            let second_helper = format!(
+                "!f() {{ cat >/dev/null; printf '%s' 'capability[]=authtype
+credential=access-token
+{}'; }}; f",
+                later_ephemeral.map_or_else(String::new, |value| format!("ephemeral={}\n", u8::from(value)))
+            );
+            let mut context = Context::from_url("https://example.com/repo", Default::default());
+            context.capability.push(Capability::Authtype);
+            let outcome = Cascade::default()
+                .extend([
+                    Program::from_custom_definition(first_helper)?,
+                    Program::from_custom_definition(second_helper.as_str())?,
+                ])
+                .invoke(
+                    Action::Get(context.clone()),
+                    gix_prompt::Options {
+                        mode: gix_prompt::Mode::Disable,
+                        askpass: None,
+                    },
+                )?
+                .expect("the helpers jointly supply complete token credentials");
+            assert_eq!(
+                outcome.credentials,
+                Credentials::Encoded {
+                    authtype: "Bearer".into(),
+                    credential: "access-token".into(),
+                    oauth_refresh_token: None,
+                },
+                "the later helper completes the token supplied across the exchange"
+            );
+            for action in [outcome.next.clone().store(), outcome.next.clone().erase()] {
+                let payload = action.payload().expect("follow-up actions have a payload");
+                assert_eq!(
+                    Context::from_bytes(payload, Default::default())?.ephemeral,
+                    Some(later_ephemeral.unwrap_or(true)),
+                    "omitting ephemeral preserves the no-cache hint; an explicit value overrides it"
+                );
+            }
+            if !gix_testtools::should_skip_as_git_version_is_smaller_than(2, 46, 0) {
+                let _env = gix_testtools::Env::new()
+                    .set("GIT_CONFIG_COUNT", "2")
+                    .set("GIT_CONFIG_KEY_0", "credential.helper")
+                    .set("GIT_CONFIG_VALUE_0", first_helper)
+                    .set("GIT_CONFIG_KEY_1", "credential.helper")
+                    .set("GIT_CONFIG_VALUE_1", second_helper);
+                let git_outcome = gix_credentials::builtin(Action::Get(context))?
+                    .expect("Git also completes the token across both helpers");
+                assert_eq!(
+                    git_outcome.credentials, outcome.credentials,
+                    "credential selection matches Git"
+                );
+                assert_eq!(
+                    Context::try_from(&git_outcome.next)?.ephemeral.unwrap_or(false),
+                    Context::try_from(&outcome.next)?.ephemeral.unwrap_or(false),
+                    "the lifetime semantics match Git, which omits a false flag from its output"
+                );
+            }
+        }
+        Ok(())
+    }
+
     #[test]
     fn incomplete_unnegotiated_or_expired_authtype_allows_password_fallback() -> TestResult {
         for (announce, response) in [
```

---

### Incident Patch 3: `71551f1a` (2026-11-04)
**Commit Message**: fix(gix-credentials): address review feedback on token diagnostics

Rubber-stamp tests, checked production code.

<!-- agent -->
Invalid negotiated token values were included in validation error text and
printable `input` metadata. `Cascade::invoke()` can propagate these errors
before the HTTP transport's secret-free validation runs.

The review requested:
> Return a secret-free validation error here without retaining the credential
> as metadata.

Keep credential protocol and UTF-8 errors free of token values and metadata.
The regression failed before the fix and covers CR, LF, NUL, invalid UTF-8,
and errors propagated by the cascade's input validation.

Assisted-by: GPT 6.0 Astra
Co-authored-by: GPT 6.0 Astra <[REDACTED_EMAIL]>

**File**: `gix-credentials/src/protocol/context/serde.rs` (modified, +22/-4)
```diff
@@ -11,7 +11,8 @@ mod write {
         /// Write the serializable fields to `out` for decoding with [`from_bytes()`][Self::from_bytes()].
         /// Unsupported capabilities and `quit` are omitted. Fields enabled by `authtype` are only
         /// written if that capability is set.
-        /// Invalid field values are retained as `input` bytes in the I/O error.
+        /// Invalid field values, except `password`, `credential`, and `oauth_refresh_token` secrets,
+        /// are retained as `input` bytes in the I/O error.
         /// After [wrapping](gix_error::Error::from_error()), inspect them with
         /// [metadata](gix_error::Error::metadata()).
         pub fn write_to(&self, mut out: impl std::io::Write) -> std::io::Result<()> {
@@ -106,15 +107,19 @@ pub mod decode {
 
     use gix_error::{ErrorExt, Result, bail, validation};
 
-    use crate::protocol::{Capability, Context, ContextOptions, context::serde::validate};
+    use crate::protocol::{
+        Capability, Context, ContextOptions,
+        context::serde::{is_secret_field, validate},
+    };
 
     impl Context {
         /// Decode ourselves from `input` which is the format written by [`write_to()`][Self::write_to()].
         /// Fields enabled by `authtype` require a preceding `capability[]=authtype` line.
         /// Unsupported capability names are retained for inspection, but do not enable any fields
         /// and are omitted when encoding the context again.
         /// `options` control what to support during deserialization.
-        /// Invalid line or value bytes are stored as `input` in [`gix_error::Message::values`].
+        /// Invalid line or value bytes, except `password`, `credential`, and `oauth_refresh_token` secrets,
+        /// are stored as `input` in [`gix_error::Message::values`].
         /// After [wrapping](gix_error::Error::from_error()), inspect them with
         /// [metadata](gix_error::Error::metadata()).
         pub fn from_bytes(input: &[u8], options: ContextOptions) -> Result<Self> {
@@ -165,7 +170,11 @@ pub mod decode {
                     | "credential"
                     | "capability[]" => {
                         if !value.is_utf8() {
-                            bail!(validation(format!("Illformed UTF-8 in value of key {key:?}")).with_input(value));
+                            let mut error = validation(format!("Illformed UTF-8 in value of key {key:?}"));
+                            if !is_secret_field(key) {
+                                error = error.with_input(value);
+                            }
+                            bail!(error);
                         }
                         let value = value.to_string();
                         if key == "capability[]" {
@@ -206,6 +215,10 @@ pub mod decode {
     }
 }
 
+fn is_secret_field(key: &str) -> bool {
+    matches!(key, "password" | "credential" | "oauth_refresh_token")
+}
+
 fn validate(key: &str, value: &BStr, protect_protocol: bool) -> Result {
     if key.contains('\0')
         || key.contains('\n')
@@ -214,6 +227,11 @@ fn validate(key: &str, value: &BStr, protect_protocol: bool) -> Result {
         || value.contains(&b'\n')
         || (protect_protocol && value.contains(&b'\r'))
     {
+        if is_secret_field(key) {
+            bail!(gix_error::validation(format!(
+                "{key:?} must not contain null bytes or newlines"
+            )));
+        }
         bail!(
             gix_error::validation(format!(
                 "{key:?}={value:?} must not contain null bytes or newlines neither in key nor in value."
```

**File**: `gix-credentials/tests/helper/context.rs` (modified, +97/-0)
```diff
@@ -164,6 +164,103 @@ fn authtype_protocol_fields_reject_record_injection() {
     }
 }
 
+#[test]
+fn invalid_secrets_never_appear_in_encoding_diagnostics_or_metadata() -> TestResult {
+    for value in [
+        "secret-token\rcontent",
+        "secret-token
+content",
+        "secret-token\0content",
+    ] {
+        for (key, context) in [
+            (
+                "password",
+                Context {
+                    password: Some(value.into()),
+                    ..Default::default()
+                },
+            ),
+            (
+                "credential",
+                Context {
+                    capability: vec![Capability::Authtype],
+                    credential: Some(value.into()),
+                    ..Default::default()
+                },
+            ),
+            (
+                "oauth_refresh_token",
+                Context {
+                    oauth_refresh_token: Some(value.into()),
+                    ..Default::default()
+                },
+            ),
+        ] {
+            let write_error = context
+                .write_to(Vec::new())
+                .expect_err("protocol delimiters in secrets are rejected");
+            let cascade_error = gix_credentials::helper::Cascade::default()
+                .invoke(
+                    gix_credentials::helper::Action::Get(context),
+                    gix_prompt::Options {
+                        mode: gix_prompt::Mode::Disable,
+                        askpass: None,
+                    },
+                )
+                .expect_err("the cascade validates secrets before invoking helpers");
+            for error in [gix_error::Error::from_error(write_error), cascade_error] {
+                assert!(
+                    !error.to_string().contains("secret-token") && !format!("{error:?}").contains("secret-token"),
+                    "encoding and cascade diagnostics must not expose any part of the rejected {key}"
+                );
+                assert!(
+                    error.metadata().all(|values| !values.contains_key("input")),
+                    "rejected {key} values must not be retained in diagnostic metadata"
+                );
+                assert!(
+                    error.to_string().contains(key),
+                    "the rejected secret field remains identifiable"
+                );
+            }
+        }
+    }
+    Ok(())
+}
+
+#[test]
+fn invalid_secrets_never_appear_in_decoding_diagnostics_or_metadata() -> TestResult {
+    for key in ["password", "credential", "oauth_refresh_token"] {
+        for value in [
+            b"secret-token\xff".as_slice(),
+            b"secret-token\rcontent",
+            b"secret-token\0content",
+        ] {
+            let input = [
+                b"capability[]=authtype\n".as_slice(),
+                key.as_bytes(),
+                b"=",
+                value,
+                b"\n",
+            ]
+            .concat();
+            let error = Context::from_bytes(&input, Default::default()).expect_err("invalid secret bytes are rejected");
+            assert!(
+                !error.to_string().contains("secret-token") && !format!("{error:?}").contains("secret-token"),
+                "decoding diagnostics must not expose invalid {key} values"
+            );
+            assert!(
+                error.metadata().all(|values| !values.contains_key("input")),
+                "neither protocol nor UTF-8 validation may retain the secret {key} input"
+            );
+            assert!(
+                error.to_string().contains(key),
+                "the rejected secret field remains identifiable"
+            );
+        }
+    }
+    Ok(())
+}
+
 #[test]
 fn authentication_challenges_survive_a_protocol_roundtrip() -> TestResult {
     let input = b"protocol=https
```

#### Recent Merged Pull Requests:
- **PR #3157** (2026-11-05): Create `oid` from bytes in one `unsafe` block in `gix-hash` (@b84330808)
- **PR #3156** (2026-11-04): much faster qa (@Byron)
- **PR #3155** (2026-11-04): fix(gix-merge): treat merge driver exit codes 1 to 128 as conflicts, like Git does (@arthurzam)
- **PR #3154** (2026-11-04): Decode into a `String` and forbid `unsafe` in `gix-filter` (@b84330808)
- **PR #3152** (2026-11-03): even faster qa (@Byron)
- **PR #3150** (2026-11-03): Remove the last `unsafe` block from `gix-revision` and forbid `unsafe` there (@b84330808)

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

## X. Share generated fixtures across QA test stages

**RULE**:
When implementing operations in `DEVELOPMENT.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in GitoxideLabs/gitoxide. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `61bbd5b5`: Share generated fixtures across QA test stages. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `DEVELOPMENT.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
source copies. Native passes and feature/hash or isolated test variants within one QA run
share a fresh cache of generated read-only scripted fixtures, locally and within each CI job.
copies remain alive until the run finishes, and are retained together if a source copy changes.
Changes to source files between stages prevent cache reuse. Feature/hash variants also run in
an isolated copy and continue after individual failures. Separate runs and CI jobs never reuse
each other's generated fixtures or extracted archives. Archive changes cause
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
source copies. The native passes share a fresh cache of generated read-only scripted fixtures.
copies remain alive until both passes finish, and are retained together if a source copy changes.
Feature/hash variants also run in an isolated copy, sharing compatible fixture
caches within their task and continuing after individual failures. Their fixture caches cannot
reuse a previous local run's extracted archives. Archive changes cause
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `61bbd5b5` are properly handled with clean fallback behavior.
