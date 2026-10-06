# Forensic Learning Record (Deep Inspection): GitoxideLabs/gitoxide

> **Canonical Artifact**: `07_PROJECT_LEARNING/gitoxidelabs-gitoxide-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/GitoxideLabs/gitoxide](https://github.com/GitoxideLabs/gitoxide))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:41:58.931Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `GitoxideLabs/gitoxide`
- **Description**: An idiomatic, lean, fast & safe pure Rust implementation of Git
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 11997 stars

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
        let g = Graph::at(path.as_ref())?;

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
                let repo_progress = gix::threading::OwnShared::new(gix::threading::Mutable::new(
                    repo_progress.add_child("in parallel"),
                ));
                gix::parallel::in_parallel_with_slice(
                    &mut repos,
                    Some(threads),
                    {
                        let shared_repo_progress = repo_progress.clone();
                        let db_path = db_path.clone();
                        move |tid| {
                            let mut progress = gix::threading::lock(&shared_repo_progress);
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
                let repo_progress = gix::threading::lock(&repo_progress);
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
                "SELECT id, rela_path, odb_size, num_objects, num_references FROM repository WHERE co
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
            &mut gix::features::interrupt::Write {
                inner: gix::features::progress::Write {
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
    let threads = gix::features::parallel::num_threads(threads);

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

### Core Architecture Module: `gitoxide-core/src/hours/util.rs`
```
use std::sync::atomic::{AtomicUsize, Ordering};

use gix::bstr::{BStr, ByteSlice};

use crate::hours::core::HOURS_PER_WORKDAY;

#[derive(Debug)]
pub struct WorkByPerson {
    pub name: Vec<&'static BStr>,
    pub email: Vec<&'static BStr>,
    pub hours: f32,
    pub num_commits: u32,
    pub files: FileStats,
    pub lines: LineStats,
}

impl WorkByPerson {
    pub fn merge(&mut self, other: &WorkByEmail) {
        if !self.name.contains(&other.name) {
            self.name.push(other.name);
        }
        if !self.email.contains(&other.email) {
            self.email.push(other.email);
        }
        self.num_commits += other.num_commits;
        self.hours += other.hours;
        self.files.add(&other.files);
        self.lines.add(&other.lines);
    }
}

impl<'a> From<&'a WorkByEmail> for WorkByPerson {
    fn from(w: &'a WorkByEmail) -> Self {
        WorkByPerson {
            name: vec![w.name],
            email: vec![w.email],
            hours: w.hours,
            num_commits: w.num_commits,
            files: w.files,
            lines: w.lines,
        }
    }
}

/// Combine all iterator elements into one String, separated by `sep`.
///
/// Use the `Display` implementation of each element.
///
/// extracted from
/// https://github.com/rust-itertools/itertools/blob/762643f1be2217140a972745cf4d6ed69435f722/src/lib.rs#L2295-L2324
fn join<I>(mut iter: I, sep: &str) -> String
where
    I: Iterator,
    <I as Iterator>::Item: std::fmt::Display,
{
    use ::std::fmt::Write;

    match iter.next() {
        None => String::new(),
        Some(first_elt) => {
            // estimate lower bound of capacity needed
            let (lower, _) = iter.size_hint();
            let mut result = String::with_capacity(sep.len() * lower);
            write!(&mut result, "{first_elt}").expect("enough memory");
            iter.for_each(|elt| {
                result.push_str(sep);
                write!(&mut result, "{elt}").expect("enough memory");
            });
            result
        }
    }
}

impl WorkByPerson {
    pub fn write_to(
        &self,
        total_hours: f32,
        total_files: Option<FileStats>,
        total_lines: Option<LineStats>,
        mut out: impl std::io::Write,
    ) -> std::io::Result<()> {
        writeln!(
            out,
            "{names} <{mails}>",
            names = join(self.name.iter(), ", "),
            mails = join(self.email.iter(), ", ")
        )?;
        writeln!(out, "{} commits found", self.num_commits)?;
        writeln!(
            out,
            "total time spent: {:.02}h ({:.02} 8h days, {:.02}%)",
            self.hours,
            self.hours / HOURS_PER_WORKDAY,
            (self.hours / total_hours) * 100.0
        )?;
        if let Some(total) = total_files {
            writeln!(
                out,
                "total files added/removed/modified: {}/{}/{} ({:.02}%)",
                self.files.added,
                self.files.removed,
                self.files.modified,
                (self.files.sum() / total.sum()) * 100.0
            )?;
        }
        if let Some(total) = total_lines {
            writeln!(
                out,
                "total lines added/removed: {}/{} ({:.02}%)",
                self.lines.added,
                self.lines.removed,
                (self.lines.sum() / total.sum()) * 100.0
            )?;
        }
        Ok(())
    }
}

#[derive(Debug)]
pub struct WorkByEmail {
    pub name: &'static BStr,
    pub email: &'static BStr,
    pub hours: f32,
    pub num_commits: u32,
    pub files: FileStats,
    pub lines: LineStats,
}

/// File statistics for a particular commit.
#[derive(Debug, Default, Copy, Clone)]
pub struct FileStats {
    /// amount of added files
    pub added: usize,
    /// amount of removed files
    pub removed: usize,
    /// amount of modified files
    pub modified: usize,
}

/// Line statistics for a particular commit.
#[derive(Debug, Default, Copy, Clone)]
pub struct LineStats {
    /// amount of added lines
    pub added: usize,
    /// amount of removed lines
    pub removed: usize,
}

impl FileStats {
    pub fn add(&mut self, other: &FileStats) -> &mut Self {
        self.added += other.added;
        self.removed += other.removed;
        self.modified += other.modified;
        self
    }

    pub fn sum(&self) -> f32 {
        (self.added + self.removed + self.modified) as f32
    }
}

impl LineStats {
    pub fn add(&mut self, other: &LineStats) -> &mut Self {
        self.added += other.added;
        self.removed += other.removed;
        self
    }

    pub fn sum(&self) -> f32 {
        (self.added + self.removed) as f32
    }
}

/// An index able to address any commit
pub type CommitIdx = u32;

pub fn add_lines(line_stats: bool, lines_counter: &AtomicUsize, lines: &mut LineStats, id: gix::Id<'_>) {
    if let Some(Ok(blob)) = line_stats.then(|| id.object()) {
        let nl = blob.data.lines_with_terminator().count();
        lines.added += nl;
        lines_counter.fetch_add(nl, Ordering::Relaxed);
    }
}

pub fn remove_lines(line_stats: bool, lines_counter: &AtomicUsize, lines: &mut LineStats, id: gix::Id<'_>) {
    if let Some(Ok(blob)) = line_stats.then(|| id.object()) {
        let nl = blob.data.lines_with_terminator().count();
        lines.removed += nl;
        lines_counter.fetch_add(nl, Ordering::Relaxed);
    }
}

```

### Core Architecture Module: `gitoxide-core/src/index/checkout.rs`
```
use std::{
    path::{Path, PathBuf},
    sync::atomic::{AtomicBool, Ordering},
};

use gix::{
    NestedProgress, Progress, Result,
    error::{ResultExt, bail},
    worktree::state::checkout,
};

use crate::{
    index,
    index::{Options, parse_file},
};

pub fn checkout_exclusive(
    index_path: impl AsRef<Path>,
    dest_directory: impl AsRef<Path>,
    repo: Option<PathBuf>,
    mut err: impl std::io::Write,
    mut progress: impl NestedProgress,
    should_interrupt: &AtomicBool,
    index::checkout_exclusive::Options {
        index: Options { object_hash, .. },
        empty_files,
        keep_going,
        thread_limit,
    }: index::checkout_exclusive::Options,
) -> Result<()> {
    let repo = repo.map(gix::discover).transpose()?;

    let dest_directory = dest_directory.as_ref();
    if dest_directory.exists() {
        bail!(gix::error::conflict(format!(
            "Refusing to checkout index into existing directory \"{}\" - remove it and try again",
            dest_directory.display()
        )))
    }
    std::fs::create_dir_all(dest_directory).or_error()?;

    let mut index = parse_file(index_path, object_hash)?;

    let mut num_skipped = 0;
    let maybe_symlink_mode = if !empty_files && repo.is_some() {
        gix::index::entry::Mode::DIR
    } else {
        gix::index::entry::Mode::SYMLINK
    };
    for entry in index.entries_mut().iter_mut().filter(|e| {
        e.mode
            .contains(maybe_symlink_mode | gix::index::entry::Mode::DIR | gix::index::entry::Mode::COMMIT)
    }) {
        entry.flags.insert(gix::index::entry::Flags::SKIP_WORKTREE);
        num_skipped += 1;
    }
    if num_skipped > 0 {
        progress.info(format!("Skipping {num_skipped} DIR/SYMLINK/COMMIT entries"));
    }

    let opts = gix::worktree::state::checkout::Options {
        fs: gix::fs::Capabilities::probe(dest_directory),

        destination_is_initially_empty: true,
        overwrite_existing: false,
        keep_going,
        thread_limit,
        ..gix::worktree::state::checkout::Options::new(
            repo.as_ref()
                .and_then(|repo| repo.filter_pipeline(None).ok().map(|t| t.0.into_parts().0))
                .unwrap_or_else(|| {
                    gix::filter::plumbing::Pipeline::new(Default::default(), index.object_hash(), Default::default())
                }),
        )
    };

    let mut files = progress.add_child("checkout");
    let mut bytes = progress.add_child("writing");

    let entries_for_checkout = index.entries().len() - num_skipped;
    files.init(Some(entries_for_checkout), gix::progress::count("files"));
    bytes.init(None, gix::progress::bytes());

    let start = std::time::Instant::now();
    let no_repo = repo.is_none();
    let checkout::Outcome {
        errors,
        collisions,
        files_updated,
        bytes_written,
        delayed_paths_unknown,
        delayed_paths_unprocessed,
    } = match repo {
        Some(repo) => gix::worktree::state::checkout(
            &mut index,
            dest_directory,
            EmptyOrDb {
                empty_files,
                db: repo.objects.into_arc().or_error()?,
            },
            &files,
            &bytes,
            should_interrupt,
            opts,
        ),
        None => gix::worktree::state::checkout(
            &mut index,
            dest_directory,
            Empty,
            &files,
            &bytes,
            should_interrupt,
            opts,
        ),
    }?;

    files.show_throughput(start);
    bytes.show_throughput(start);

    progress.done(format!(
        "Created {} {} files{} ({})",
        files_updated,
        if no_repo { "empty" } else { Default::default() },
        if should_interrupt.load(Ordering::Relaxed) {
            {
                format!(
                    " of {}",
                    entries_for_checkout
                        .saturating_sub(errors.len() + collisions.len() + delayed_paths_unprocessed.len())
                )
            }
        } else {
            Default::default()
        },
        gix::progress::bytes()
            .unwrap()
            .display(bytes_written as usize, None, None)
    ));

    let mut messages = Vec::new();
    if !errors.is_empty() {
        messages.push(format!("kept going through {} errors(s)", errors.len()));
        for record in errors {
            writeln!(err, "{}: {}", record.path, record.error).ok();
        }
    }
    if !collisions.is_empty() {
        messages.push(format!("encountered {} collision(s)", collisions.len()));
        for col in collisions {
            writeln!(err, "{}: collision ({:?})", col.path, col.error_kind).ok();
        }
    }
    if !delayed_paths_unknown.is_empty() {
        messages.push(format!(
            "A delayed process provided us with {} paths we never sent to it",
            delayed_paths_unknown.len()
        ));
        for unknown in delayed_paths_unknown {
            writeln!(err, "{unknown}: unknown").ok();
        }
    }
    if !delayed_paths_unprocessed.is_empty() {
        messages.push(format!(
            "A delayed process forgot to process {} paths",
            delayed_paths_unprocessed.len()
        ));
        for unprocessed in delayed_paths_unprocessed {
            writeln!(err, "{unprocessed}: unprocessed and forgotten").ok();
        }
    }
    if !messages.is_empty() {
        bail!(
            "One or more errors occurred - checkout is incomplete: {}",
            messages.join(", ")
        );
    }
    Ok(())
}

#[derive(Clone)]
struct EmptyOrDb<Find> {
    empty_files: bool,
    db: Find,
}

impl<Find> gix::objs::Find for EmptyOrDb<Find>
where
    Find: gix::objs::Find,
{
    fn try_find<'a>(&self, id: &gix::oid, buf: &'a mut Vec<u8>) -> gix::Result<Option<gix::objs::Data<'a>>> {
        if self.empty_files {
            // We always want to query the ODB here…
            let Some(kind) = self.db.try_find(id, buf)?.map(|d| d.kind) else {
                return Ok(None);
            };
            buf.clear();
            // …but write nothing
            Ok(Some(gix::objs::Data {
                kind,
                object_hash: id.kind(),
                data: buf,
            }))
        } else {
            self.db.try_find(id, buf)
        }
    }
}

#[derive(Clone)]
struct Empty;

impl gix::objs::Find for Empty {
    fn try_find<'a>(&self, id: &gix::oid, buffer: &'a mut Vec<u8>) -> gix::Result<Option<gix::objs::Data<'a>>> {
        buffer.clear();
        Ok(Some(gix::objs::Data {
            kind: gix::object::Kind::Blob,
            object_hash: id.kind(),
            data: buffer,
        }))
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3047** (2026-10-05): **fix(gix): resolve HEAD tracking branches and symbolic reflog queries**
  *Symptoms*: ## Tasks  This section is for Byron only. Models continuing this PR must not add, remove, check, uncheck, rename, or reorder checkboxes here.  - [x] refackiew  ----  Everything below this line was generated by `Codex GPT-6`.  Created by Codex on behalf of Byron. Byron will review before this is ready to merge.  `HEAD@{upstream}`, `HEAD@{u}`, and `HEAD@{push}` now use the current branch's tracking configuration, matching their implicit-HEAD equivalents. Reflog queries on symbolic references without their own log now read the final target's reflog. An existing log still takes precedence.  Fixes #3039. Fixes #3040.  The fix reuses the existing reference-following helper. Regression tests compare index and date queries, chained symbolic refs, tracking aliases, and existing-log precedence with isolated Git invocations in disposable repositories. Both regressions failed with the reported errors before the fix.  Validation: 498 `gix` integration tests passed; `cargo clippy -p gix --all-targets -- -D warnings` and workspace formatting passed. `codex review --commit d21f377` found no actionable regressions.  Git reference: `remote.c::repo_branch_get()` and `refs.c::repo_dwim_log()` in the local Git reference checkout; runtime comparisons used Git 2.54.0 (Apple Git-157). 

- **Issue #3046** (2026-10-05): **Make bstr optional for dependency-free gix-error consumers**
  *Symptoms*: ## Tasks  - [x] refackiew  ---- Created by Codex on behalf of Byron. Byron will review before this is ready to merge.  ## Summary  Make `gix-error`'s `bstr` dependency optional so small consumers can use `default-features = false` without compiling `bstr` or `memchr`. The new `bstr` feature is enabled by default, preserving the existing `BString` metadata payload, `BStr` conversions, and crate re-export.  Without the feature, byte metadata uses `Vec<u8>` and retains the same escaped diagnostics for valid Unicode, invalid bytes, control characters, and truncated UTF-8. Regression tests compare the fallback formatter with `bstr`, and the metadata documentation and doctest describe the feature-dependent payload.  ## Context  Ordinary error-context handling should not require a byte-string dependency. The branch already contains the complete Codex-authored implementation in commit `958bb57da3`; this PR publishes that existing work without adding another commit.  Recorded measurements for a small consumer on Rust 1.99.0 / M4 Max show five-sample fresh-build medians of 702 ms with `bstr` versus 458 ms without it in debug, and 872 ms versus 609 ms in release. These include Cargo and linking with registry sources cached; they describe this consumer and machine.  Workspace development dependencies re-enable default features, so dependency-free validation uses a standalone manifest pointing at the current `gix-error/src/lib.rs`, retaining the crate's features and normal dependencies wh

- **Issue #3045** (2026-10-05): **Fix intermittent Windows checkout safety fixture failures**
  *Symptoms*: Windows CI intermittently fails `checkout::safety_checks_dotdot_trees` while generating `make_traverse_trees.sh`, reporting `U git/hooks/pre-commit` and an unresolved conflict. This fixes the binary index corruption and the long-path warnings emitted by the same run.  I am **Codex, OpenAI's AI coding agent**, preparing this draft PR on Byron's behalf. **Byron will review it soon.**  MSYS `sed` reads the binary index in text mode and removes CR bytes from incidental CRLF sequences in its stat data. The resulting byte shift corrupts the entry flags and path. Setting the file mtime to `2000-11-01T12:31:06Z` (`0x3a000d0a`) reproduced the reported conflict exactly.  - Use Perl with binary standard streams and literal path substitution, including on platforms without `sed -b`. - Keep the CRLF-containing timestamp in the fixture so the original corruption is exercised deterministically. - Make the isolated `XDG_CONFIG_HOME` absolute so nested fixture commands cannot reinterpret it relative to their new directory; verify this with real Git attribute lookups. - Refresh the generated SHA-1 and SHA-256 fixture archives.  Validation on Windows with Git `2.55.0.windows.3`:  - Full `gix-testtools` and parallel `gix-worktree-state` tests with SHA-1, plus full parallel checkout tests with SHA-256: **116 test executions passed**. - Ten fresh fixture generations per hash format through isolated `jtt run`: **60 repositories**, all successful with empty stderr. - Rust formatting, Bash syntax, an

- **Issue #3044** (2026-10-05): **fix: map packs read-only on Windows so large ones can be opened**
  *Symptoms*: On Windows if you memory map with copyonwrite (which is what map_copy_read_only does) it charges against the commit limit for that. As such, when opening extremely large packs, i.e. 40GB, This can fail with an out of memory error: `ERROR_COMMITMENT_LIMIT` (os error 1455, "The paging file is too small for this operation to complete")  The fix is to memory map it plainly. Which is otherwise pretty much the same as it is on other operating systems for read-only memory mapping.
  **Post-Mortem & Fix Analysis**:
  > hmmm the failing test seems to be unrelated to this change, so im not sure why its failing, also i tried it locally and it seems to be fine. also the other windows tests pass which makes this one a bit strange

- **Issue #3040** (2026-10-05): **`gix::Repository::rev_parse_single` doesn't agree with git for reflog specs on a symbolic ref**
  *Symptoms*: ### Current behavior 😯  Running `repo.rev_parse_single("refs/symref@{0}")`, where `refs/symref` is a symbolic ref pointing at `refs/heads/main` and has no reflog of its own, returns an error:  ``` delegate.reflog(Entry(0)) failed, "input"="0"   caused by: Reference "refs/symref" does not have a reference log, cannot lookup reflog entry by index ```  ### Expected behavior 🤔  It should resolve to the same object as `main@{0}`, following the symbolic ref and reading the target's reflog. Same for `refs/symref@{n}` for any n.  ### Git behavior  `git rev-parse --verify refs/symref@{0}` prints the same object id as `main@{0}` and exits 0.   ### Steps to reproduce 🕹  ```sh git init -b main git commit --allow-empty -m c1 git commit --allow-empty -m c2 git commit --allow-empty -m c3 git symbolic-ref refs/symref refs/heads/main ``` A symbolic ref created under `refs/heads/` does get a reflog of its own, so it resolves in both; reproducing the mismatch needs a symbolic ref outside `refs/heads/`.

- **Issue #3039** (2026-10-05): **`gix::Repository::rev_parse_single` doesn't agree with git for specs of the form `HEAD@{upstream}`**
  *Symptoms*: ### Current behavior 😯  Running `repo.rev_parse_single("HEAD@{upstream}")` in a repo whose checked out branch has an upstream configured returns an error:  ``` delegate.sibling_branch(Upstream) failed, "input"="upstream"   caused by: Branch named HEAD does not have a fetch tracking branch configured   caused by: Couldn't find sibling of Upstream ```  The same happens for `HEAD@{u}` and `HEAD@{push}`. In the same repo `@{upstream}`, `@{u}` and `@{push}` resolve correctly.  ### Expected behavior 🤔  `HEAD@{upstream}` should resolve to the same object as `@{upstream}`: the upstream of the currently checked out branch.  ### Git behavior  `git rev-parse --verify HEAD@{upstream}` prints the upstream branch's object id and exits 0, giving the same answer as `git rev-parse --verify @{upstream}`.  ### Steps to reproduce 🕹  ```sh git init -b main git commit --allow-empty -m c1 git update-ref refs/remotes/origin/main HEAD git config remote.origin.url /dev/null git config remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*' git config branch.main.remote origin git config branch.main.merge refs/heads/main ``` And in this repo, run `repo.rev_parse_single("HEAD@{upstream}")` or the `git rev-parse --verify HEAD@{upstream}` previously mentioned to observe the mismatch. 

- **Issue #3035** (2026-10-02): **fix: don't apply the caller's `GIT_INDEX_FILE` or `GIT_WORK_TREE` to a new clone**
  *Symptoms*: ## Tasks  - [x] refackiew  ---- Created by Codex on behalf of Byron. Byron will review before this is ready to merge.  A new clone now ignores the caller's repository-local environment overrides, including `GIT_INDEX_FILE` and `GIT_WORK_TREE`. Programs cloning from inside a Git hook therefore keep the new repository's index and checkout inside the clone instead of writing into the hook's repository. This is a documented deviation from `git clone`.  `PrepareFetch` reuses `open::Options::without_repository_environment_overrides()`. Editor and notes preferences (`GIT_EDITOR` and `GIT_NOTES_REF`) are still honored, as are authentication, proxy, and protocol settings. Regression coverage uses disposable repositories and checks that repository paths are ignored while these preferences survive.  The original clone fix was contributed by @any-victor with Claude Code assistance. Byron's review update preserves editor and notes settings. Codex amended that review commit with fixes for failures introduced by the Rust 1.99 toolchain update: MSRV-compatible allowances for deprecated atomic operations, scoped lint allowances for generated async code, and stable integer-conversion diagnostic snapshots through the existing test helper.  Validation on Rust 1.99: all four `just clippy -D warnings -A unknown-lints --no-deps` configurations, both `just doc` configurations, formatting, and 46 targeted clone, parallel, checkout, allocation, and snapshot tests pass. Five snapshot-related tests also
  **Post-Mortem & Fix Analysis**:
  > Thanks!  While Git expects certain variables (in hooks) [to be cleared](https://github.com/git/git/blob/master/Documentation/githooks.adoc#L30-L39), no matter how I think about it, for this API it seems like the wrong choice to adhere to that.  So let's change it, and declare the 'deviation' instead.
  > @Byron no problem! Also, I noticed a few issues came up in regards to linting, those seem related to rust's latest stable update rather than my code changes though. Glad to assist on fixing them if you'd like me to.
  > All good, thanks, I am taking it from here.

- **Issue #3034** (2026-10-02): **bump the github-actions group with 4 updates**
  *Symptoms*: Bumps the github-actions group with 4 updates: [taiki-e/install-action](https://github.com/taiki-e/install-action), [github/codeql-action/init](https://github.com/github/codeql-action), [github/codeql-action/analyze](https://github.com/github/codeql-action) and [zizmorcore/zizmor-action](https://github.com/zizmorcore/zizmor-action).  Updates `taiki-e/install-action` from 2.86.7 to 2.87.20 <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/taiki-e/install-action/releases">taiki-e/install-action's releases</a>.</em></p> <blockquote> <h2>2.87.20</h2> <ul> <li> <p>Update <code>uv@latest</code> to 0.12.18.</p> </li> <li> <p>Update <code>cargo-shear@latest</code> to 1.14.0.</p> </li> </ul> <h2>2.87.19</h2> <ul> <li> <p>Update <code>wasmtime@latest</code> to 49.0.0.</p> </li> <li> <p>Update <code>cargo-shear@latest</code> to 1.13.5.</p> </li> <li> <p>Update <code>cargo-nextest@latest</code> to 0.9.146.</p> </li> </ul> <h2>2.87.18</h2> <ul> <li> <p>Update <code>oxfmt@latest</code> to 1.84.0.</p> </li> <li> <p>Update <code>mise@latest</code> to 2026.9.12.</p> </li> <li> <p>Update <code>kache@latest</code> to 0.26.3.</p> </li> <li> <p>Update <code>cargo-tarpaulin@latest</code> to 0.37.4.</p> </li> <li> <p>Update <code>cargo-rdme@latest</code> to 2.2.3.</p> </li> </ul> <h2>2.87.17</h2> <ul> <li> <p>Update <code>uv@latest</code> to 0.12.17.</p> </li> <li> <p>Update <code>release-plz@latest</code> to 0.3.169.</p> </li> <li> <p>Update <code>kingfishe

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

### Incident Patch 1: `49885cdc` (2026-10-05)
**Commit Message**: Merge pull request #3047 from GitoxideLabs/revparse-fixes

fix(gix): resolve HEAD tracking branches and symbolic reflog queries

**File**: `gix/src/revision/spec/parse/delegate/revision.rs` (modified, +11/-2)
```diff
@@ -103,7 +103,7 @@ impl delegate::Revision for Delegate<'_> {
 
     fn reflog(&mut self, query: ReflogLookup) -> Result<()> {
         self.unset_disambiguate_call();
-        let r = match &mut self.refs[self.idx] {
+        let mut r = match &mut self.refs[self.idx] {
             Some(r) => r.clone().attach(self.repo),
             val @ None => match self.repo.head().map(crate::Head::try_into_referent) {
                 Ok(Some(r)) => {
@@ -115,6 +115,10 @@ impl delegate::Revision for Delegate<'_> {
             },
         };
 
+        if !r.log_exists() {
+            r.follow_to_object()
+                .map_err(|err| error::with_missing_reference(err.into_exn()))?;
+        }
         let mut platform = r.log_iter();
         match platform.rev().ok().flatten() {
             Some(mut it) => match query {
@@ -230,7 +234,7 @@ impl delegate::Revision for Delegate<'_> {
 
     fn sibling_branch(&mut self, kind: SiblingBranch) -> Result<()> {
         self.unset_disambiguate_call();
-        let reference = match &mut self.refs[self.idx] {
+        let mut reference = match &mut self.refs[self.idx] {
             val @ None => match self.repo.head().map(crate::Head::try_into_referent) {
                 Ok(Some(r)) => {
                     *val = Some(r.clone().detach());
@@ -245,6 +249,11 @@ impl delegate::Revision for Delegate<'_> {
             },
             Some(r) => r.clone().attach(self.repo),
         };
+        if reference.name() == "HEAD" {
+            reference
+                .follow_to_object()
+                .map_err(|err| error::with_missing_reference(err.into_exn()))?;
+        }
         let direction = match kind {
             SiblingBranch::Upstream => remote::Direction::Fetch,
             SiblingBranch::Push => remote::Direction::Push,
```

**File**: `gix/tests/fixtures/generated-archives/.gitignore` (modified, +6/-0)
```diff
@@ -51,6 +51,12 @@
 # Both files are 3.2 MB in size for some reason, let's not increase the repo size on each change.
 /make_submodules.tar
 /make_submodules_sha256.tar
+# Generate this small symbolic-reference reflog fixture, including its Git baseline.
+/make_symbolic_ref_reflogs.tar
+/make_symbolic_ref_reflogs_sha256.tar
+# Generate this small tracking-selector fixture, including its Git baseline.
+/make_tracking_branch_revspecs.tar
+/make_tracking_branch_revspecs_sha256.tar
 # Generate this small uninitialized-submodule fixture instead of storing its archives.
 /make_uninitialized_submodule.tar
 /make_uninitialized_submodule_sha256.tar
```

**File**: `gix/tests/fixtures/make_symbolic_ref_reflogs.sh` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
+#!/usr/bin/env bash
+set -eu -o pipefail
+
+# Three distinct main reflog entries exercise indexed lookups and dates before the log begins.
+git init -q
+export GIT_COMMITTER_DATE="2000-01-01 00:00:00 +0000"
+git commit -q --allow-empty -m initial
+export GIT_COMMITTER_DATE="2000-01-02 00:00:00 +0000"
+git commit -q --allow-empty -m second
+export GIT_COMMITTER_DATE="2000-01-03 00:00:00 +0000"
+git commit -q --allow-empty -m third
+
+# References outside the branch namespace have no own log, even through a symbolic chain.
+# A symbolic branch gets one entry, which must take precedence over the longer target log.
+git symbolic-ref refs/symref refs/heads/main
+git symbolic-ref refs/symref-chain refs/symref
+git symbolic-ref refs/heads/symref refs/heads/main
+
+# Bake Git's object IDs or failure exit codes into the shared revspec baseline format.
+function baseline() {
+  printf '%s\n' "$1" >>baseline.git
+  git rev-parse -q --verify "$1" >>baseline.git 2>/dev/null || echo $? >>baseline.git
+}
+
+for name in main refs/symref refs/symref-chain; do
+  for query in 0 1 2 '1979-02-26 00:00:00 +0000'; do
+    baseline "$name@{$query}"
+  done
+done
+baseline 'refs/heads/symref@{1}'
```

**File**: `gix/tests/fixtures/make_tracking_branch_revspecs.sh` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+#!/usr/bin/env bash
+set -eu -o pipefail
+
+# Explicit HEAD and main selectors must use the current branch tracking configuration.
+# Record Git results here so the read-only test never needs to invoke Git.
+git init -q
+git commit -q --allow-empty -m initial
+git remote add origin .
+git config branch.main.remote origin
+git config branch.main.merge refs/heads/main
+git fetch -q origin
+
+for op in upstream u push; do
+  for branch in '' HEAD main; do
+    revspec="$branch@{$op}"
+    printf '%s\n' "$revspec" >>baseline.git
+    git rev-parse --verify "$revspec" >>baseline.git
+  done
+done
```

**File**: `gix/tests/gix/revision/spec/from_bytes/mod.rs` (modified, +20/-0)
```diff
@@ -38,6 +38,26 @@ mod sibling_branch {
         util::hex_to_id_sha1_only,
     };
 
+    #[test]
+    fn explicit_head_uses_the_current_branch() -> gix_error::TestResult {
+        let fixture = gix_testtools::scripted_fixture_read_only("make_tracking_branch_revspecs.sh")?;
+        let repo = gix::open_opts(fixture, crate::restricted())?;
+        for op in ["upstream", "u", "push"] {
+            let expected_commit_id = parse_spec(format!("@{{{op}}}"), &repo)?
+                .single()
+                .expect("a tracking selector resolves to a single commit");
+            for branch in ["HEAD", "main"] {
+                let revspec = format!("{branch}@{{{op}}}");
+                assert_eq!(
+                    parse_spec(&revspec, &repo)?.single(),
+                    Some(expected_commit_id),
+                    "{revspec} uses the current branch's tracking configuration"
+                );
+            }
+        }
+        Ok(())
+    }
+
     #[test]
     fn push_and_upstream() -> Result {
         let repo = repo("complex_graph").unwrap();
```

**File**: `gix/tests/gix/revision/spec/from_bytes/reflog.rs` (modified, +29/-0)
```diff
@@ -6,6 +6,35 @@ use crate::{
     util::hex_to_id_sha1_only,
 };
 
+#[test]
+fn symbolic_references_use_their_own_log_or_the_final_targets() -> gix_error::TestResult {
+    let fixture = gix_testtools::scripted_fixture_read_only("make_symbolic_ref_reflogs.sh")?;
+    let repo = gix::open_opts(fixture, crate::restricted())?;
+    for name in ["refs/symref", "refs/symref-chain"] {
+        assert!(
+            !repo.find_reference(name)?.log_exists(),
+            "{name} must exercise fallback to the final target's reflog"
+        );
+        for query in ["0", "1", "2", "1979-02-26 00:00:00 +0000"] {
+            let revspec = format!("{name}@{{{query}}}");
+            assert_eq!(
+                parse_spec(&revspec, &repo)?.single(),
+                parse_spec(format!("main@{{{query}}}"), &repo)?.single(),
+                "{revspec} uses the final target's reflog"
+            );
+        }
+    }
+    assert!(
+        repo.find_reference("refs/heads/symref")?.log_exists(),
+        "a symbolic branch has its own reflog"
+    );
+    assert!(
+        parse_spec("refs/heads/symref@{1}", &repo).is_err(),
+        "an existing reflog takes precedence over the target's longer log"
+    );
+    Ok(())
+}
+
 #[test]
 fn nth_prior_checkout() {
     let repo = repo("complex_graph").unwrap();
```

---

### Incident Patch 2: `5146c90a` (2026-10-05)
**Commit Message**: fix(gix): read the target reflog when a symbolic ref has no log (#3040)

<!-- agent -->
Reflog specifications such as `refs/symref@{0}` failed when the symbolic
reference had no log of its own, even though its final target had one.

Follow symbolic references only when their own reflog is absent, retaining
precedence of an existing log. Reuse the reference-following helper for
chained references, cycle detection, and missing-ref errors.
The regression compares indexed and dated queries, chained references,
and existing-log precedence against isolated Git invocations in a
disposable repository.

Git reference: `/Users/byron/dev/github.com/git/git`,
`refs.c::repo_dwim_log()` prefers a reference's own log, then its resolved
target's log. Runtime comparisons used Git 2.54.0 (Apple Git-157).

Assisted-by: GPT 6.1 Sol
Co-authored-by: GPT 6.1 Sol <[REDACTED_EMAIL]>

**File**: `gix/src/revision/spec/parse/delegate/revision.rs` (modified, +5/-1)
```diff
@@ -103,7 +103,7 @@ impl delegate::Revision for Delegate<'_> {
 
     fn reflog(&mut self, query: ReflogLookup) -> Result<()> {
         self.unset_disambiguate_call();
-        let r = match &mut self.refs[self.idx] {
+        let mut r = match &mut self.refs[self.idx] {
             Some(r) => r.clone().attach(self.repo),
             val @ None => match self.repo.head().map(crate::Head::try_into_referent) {
                 Ok(Some(r)) => {
@@ -115,6 +115,10 @@ impl delegate::Revision for Delegate<'_> {
             },
         };
 
+        if !r.log_exists() {
+            r.follow_to_object()
+                .map_err(|err| error::with_missing_reference(err.into_exn()))?;
+        }
         let mut platform = r.log_iter();
         match platform.rev().ok().flatten() {
             Some(mut it) => match query {
```

**File**: `gix/tests/fixtures/generated-archives/.gitignore` (modified, +3/-0)
```diff
@@ -51,6 +51,9 @@
 # Both files are 3.2 MB in size for some reason, let's not increase the repo size on each change.
 /make_submodules.tar
 /make_submodules_sha256.tar
+# Generate this small symbolic-reference reflog fixture, including its Git baseline.
+/make_symbolic_ref_reflogs.tar
+/make_symbolic_ref_reflogs_sha256.tar
 # Generate this small tracking-selector fixture, including its Git baseline.
 /make_tracking_branch_revspecs.tar
 /make_tracking_branch_revspecs_sha256.tar
```

**File**: `gix/tests/fixtures/make_symbolic_ref_reflogs.sh` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
+#!/usr/bin/env bash
+set -eu -o pipefail
+
+# Three distinct main reflog entries exercise indexed lookups and dates before the log begins.
+git init -q
+export GIT_COMMITTER_DATE="2000-01-01 00:00:00 +0000"
+git commit -q --allow-empty -m initial
+export GIT_COMMITTER_DATE="2000-01-02 00:00:00 +0000"
+git commit -q --allow-empty -m second
+export GIT_COMMITTER_DATE="2000-01-03 00:00:00 +0000"
+git commit -q --allow-empty -m third
+
+# References outside the branch namespace have no own log, even through a symbolic chain.
+# A symbolic branch gets one entry, which must take precedence over the longer target log.
+git symbolic-ref refs/symref refs/heads/main
+git symbolic-ref refs/symref-chain refs/symref
+git symbolic-ref refs/heads/symref refs/heads/main
+
+# Bake Git's object IDs or failure exit codes into the shared revspec baseline format.
+function baseline() {
+  printf '%s\n' "$1" >>baseline.git
+  git rev-parse -q --verify "$1" >>baseline.git 2>/dev/null || echo $? >>baseline.git
+}
+
+for name in main refs/symref refs/symref-chain; do
+  for query in 0 1 2 '1979-02-26 00:00:00 +0000'; do
+    baseline "$name@{$query}"
+  done
+done
+baseline 'refs/heads/symref@{1}'
```

**File**: `gix/tests/gix/revision/spec/from_bytes/reflog.rs` (modified, +29/-0)
```diff
@@ -6,6 +6,35 @@ use crate::{
     util::hex_to_id_sha1_only,
 };
 
+#[test]
+fn symbolic_references_use_their_own_log_or_the_final_targets() -> gix_error::TestResult {
+    let fixture = gix_testtools::scripted_fixture_read_only("make_symbolic_ref_reflogs.sh")?;
+    let repo = gix::open_opts(fixture, crate::restricted())?;
+    for name in ["refs/symref", "refs/symref-chain"] {
+        assert!(
+            !repo.find_reference(name)?.log_exists(),
+            "{name} must exercise fallback to the final target's reflog"
+        );
+        for query in ["0", "1", "2", "1979-02-26 00:00:00 +0000"] {
+            let revspec = format!("{name}@{{{query}}}");
+            assert_eq!(
+                parse_spec(&revspec, &repo)?.single(),
+                parse_spec(format!("main@{{{query}}}"), &repo)?.single(),
+                "{revspec} uses the final target's reflog"
+            );
+        }
+    }
+    assert!(
+        repo.find_reference("refs/heads/symref")?.log_exists(),
+        "a symbolic branch has its own reflog"
+    );
+    assert!(
+        parse_spec("refs/heads/symref@{1}", &repo).is_err(),
+        "an existing reflog takes precedence over the target's longer log"
+    );
+    Ok(())
+}
+
 #[test]
 fn nth_prior_checkout() {
     let repo = repo("complex_graph").unwrap();
```

---

### Incident Patch 3: `ab83e976` (2026-10-05)
**Commit Message**: fix(gix): resolve `HEAD` tracking branches through the current branch (#3039)

<!-- agent -->
`Repository::rev_parse_single()` rejected `HEAD@{upstream}`, `HEAD@{u}`,
and `HEAD@{push}` because it looked for tracking configuration on `HEAD`
instead of the currently checked out branch.

Follow `HEAD` before looking up tracking configuration, reusing the existing
symbolic-reference resolution helper and retaining missing-ref errors.
The regression compares all three tracking aliases with their implicit
forms and isolated Git invocations in a disposable repository.

Git reference: `/Users/byron/dev/github.com/git/git`,
`remote.c::repo_branch_get()` treats `HEAD` as the current branch.
Runtime comparisons used Git 2.54.0 (Apple Git-157).

Assisted-by: GPT 6.1 Sol
Co-authored-by: GPT 6.1 Sol <[REDACTED_EMAIL]>

**File**: `gix/src/revision/spec/parse/delegate/revision.rs` (modified, +6/-1)
```diff
@@ -230,7 +230,7 @@ impl delegate::Revision for Delegate<'_> {
 
     fn sibling_branch(&mut self, kind: SiblingBranch) -> Result<()> {
         self.unset_disambiguate_call();
-        let reference = match &mut self.refs[self.idx] {
+        let mut reference = match &mut self.refs[self.idx] {
             val @ None => match self.repo.head().map(crate::Head::try_into_referent) {
                 Ok(Some(r)) => {
                     *val = Some(r.clone().detach());
@@ -245,6 +245,11 @@ impl delegate::Revision for Delegate<'_> {
             },
             Some(r) => r.clone().attach(self.repo),
         };
+        if reference.name() == "HEAD" {
+            reference
+                .follow_to_object()
+                .map_err(|err| error::with_missing_reference(err.into_exn()))?;
+        }
         let direction = match kind {
             SiblingBranch::Upstream => remote::Direction::Fetch,
             SiblingBranch::Push => remote::Direction::Push,
```

**File**: `gix/tests/fixtures/generated-archives/.gitignore` (modified, +3/-0)
```diff
@@ -51,6 +51,9 @@
 # Both files are 3.2 MB in size for some reason, let's not increase the repo size on each change.
 /make_submodules.tar
 /make_submodules_sha256.tar
+# Generate this small tracking-selector fixture, including its Git baseline.
+/make_tracking_branch_revspecs.tar
+/make_tracking_branch_revspecs_sha256.tar
 # Generate this small uninitialized-submodule fixture instead of storing its archives.
 /make_uninitialized_submodule.tar
 /make_uninitialized_submodule_sha256.tar
```

**File**: `gix/tests/fixtures/make_tracking_branch_revspecs.sh` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+#!/usr/bin/env bash
+set -eu -o pipefail
+
+# Explicit HEAD and main selectors must use the current branch tracking configuration.
+# Record Git results here so the read-only test never needs to invoke Git.
+git init -q
+git commit -q --allow-empty -m initial
+git remote add origin .
+git config branch.main.remote origin
+git config branch.main.merge refs/heads/main
+git fetch -q origin
+
+for op in upstream u push; do
+  for branch in '' HEAD main; do
+    revspec="$branch@{$op}"
+    printf '%s\n' "$revspec" >>baseline.git
+    git rev-parse --verify "$revspec" >>baseline.git
+  done
+done
```

**File**: `gix/tests/gix/revision/spec/from_bytes/mod.rs` (modified, +20/-0)
```diff
@@ -38,6 +38,26 @@ mod sibling_branch {
         util::hex_to_id_sha1_only,
     };
 
+    #[test]
+    fn explicit_head_uses_the_current_branch() -> gix_error::TestResult {
+        let fixture = gix_testtools::scripted_fixture_read_only("make_tracking_branch_revspecs.sh")?;
+        let repo = gix::open_opts(fixture, crate::restricted())?;
+        for op in ["upstream", "u", "push"] {
+            let expected_commit_id = parse_spec(format!("@{{{op}}}"), &repo)?
+                .single()
+                .expect("a tracking selector resolves to a single commit");
+            for branch in ["HEAD", "main"] {
+                let revspec = format!("{branch}@{{{op}}}");
+                assert_eq!(
+                    parse_spec(&revspec, &repo)?.single(),
+                    Some(expected_commit_id),
+                    "{revspec} uses the current branch's tracking configuration"
+                );
+            }
+        }
+        Ok(())
+    }
+
     #[test]
     fn push_and_upstream() -> Result {
         let repo = repo("complex_graph").unwrap();
```

---

### Incident Patch 4: `833a97c1` (2026-10-05)
**Commit Message**: Merge pull request #3045 from GitoxideLabs/fix-win-ci-flake

Fix intermittent Windows checkout safety fixture failures

**File**: `gix-worktree-state/tests/fixtures/make_traverse_trees.sh` (modified, +9/-4)
```diff
@@ -5,7 +5,7 @@ set -eu -o pipefail
 # File content is from stdin. Args are repo name, path, -x or +x, and tr sets.
 function make_repo() (
   local repo="$1" path="$2" xbit="$3" set1="$4" set2="$5"
-  local dir dir_standin path_standin path_standin_pattern path_replacement
+  local dir dir_standin path_standin
 
   git init -- "$repo"
   cd -- "$repo" # Temporary, as the function body is a ( ) subshell.
@@ -15,11 +15,16 @@ function make_repo() (
   path_standin="$(tr "$set1" "$set2" <<<"$path")"
   mkdir -p -- "$dir_standin"
   cat >"$path_standin"
+  # The index stores this mtime as 0x3a000d0a, including CRLF bytes. Text-mode sed
+  # on Windows would drop the CR and corrupt the index when rewriting it below.
+  TZ=UTC touch -t 200011011231.06 -- "$path_standin"
   git add --chmod="$xbit" -- "$path_standin"
-  path_standin_pattern="$(sed 's/[|.*^$\]/\\&/g' <<<"$path_standin")"
-  path_replacement="$(sed 's/[|&\]/\\&/g' <<<"$path")"
   cp .git/index old_index
-  LC_ALL=C sed "s|$path_standin_pattern|$path_replacement|g" old_index >.git/index
+  # Perl supports binary I/O on all platforms, including those without sed -b.
+  perl -0777 -pe '
+    BEGIN { binmode STDIN; binmode STDOUT; ($from, $to) = splice @ARGV, 0, 2 }
+    s/\Q$from\E/$to/g
+  ' "$path_standin" "$path" <old_index >.git/index
   git commit -m 'Initial commit'
 )
 
```

**File**: `tests/tools/src/lib.rs` (modified, +9/-2)
```diff
@@ -2208,8 +2208,13 @@ fn configure_command<'a, I: IntoIterator<Item = S>, S: AsRef<OsStr>>(
 ///
 /// Removes inherited and previously configured `GIT_*` variables, disables external configuration,
 /// and sets deterministic fixture defaults. `current_dir` scopes the replacement XDG configuration
-/// directory. This does not change the command's arguments, working directory, or standard I/O.
+/// directory, which is made absolute so scripts can change directories without relocating it.
+/// This does not change the command's arguments, working directory, or standard I/O.
 /// Add deliberate test-specific environment overrides after calling this function.
+///
+/// # Panics
+///
+/// If `current_dir` cannot be made absolute.
 pub fn configure_git_environment(
     cmd: &mut std::process::Command,
     current_dir: impl AsRef<Path>,
@@ -2235,7 +2240,9 @@ pub fn configure_git_environment(
         .env("MSYS", msys_for_git_bash_on_windows)
         .env(
             "XDG_CONFIG_HOME",
-            current_dir.as_ref().join(".gix-testtools-xdg-config"),
+            std::path::absolute(current_dir)
+                .expect("the test working directory can be made absolute")
+                .join(".gix-testtools-xdg-config"),
         )
         .env("GIT_CONFIG_NOSYSTEM", "1")
         .env("GIT_CONFIG_GLOBAL", NULL_DEVICE)
```

**File**: `tests/tools/src/tests.rs` (modified, +29/-14)
```diff
@@ -216,20 +216,35 @@ fn a_path_resolved_selected_git_does_not_override_path() {
 }
 
 #[test]
-fn configure_command_overrides_xdg_config_home() {
-    let temp = tempfile::TempDir::new().expect("can create temp dir");
-    let mut cmd = std::process::Command::new(gix_path::env::exe_invocation());
-    cmd.env("XDG_CONFIG_HOME", temp.path().join("external-config"));
-    configure_command(&mut cmd, gix_hash::Kind::default(), ["--version"], temp.path());
-
-    let xdg_config_home = cmd
-        .get_envs()
-        .find_map(|(key, value)| (key == "XDG_CONFIG_HOME").then_some(value))
-        .flatten();
-    assert_eq!(
-        xdg_config_home,
-        Some(temp.path().join(".gix-testtools-xdg-config").as_os_str())
-    );
+fn configure_command_overrides_xdg_config_home() -> gix_error::TestResult {
+    let current_dir = env::current_dir()?;
+    let temp = tempfile::tempdir_in(&current_dir)?;
+    let config_dir = temp.path().join(".gix-testtools-xdg-config/git");
+    std::fs::create_dir_all(&config_dir)?;
+    std::fs::write(config_dir.join("attributes"), "*.txt fixture-isolated\n")?;
+
+    for fixture_dir in [temp.path(), temp.path().strip_prefix(&current_dir)?] {
+        let mut cmd = std::process::Command::new(bash_program());
+        cmd.env("XDG_CONFIG_HOME", temp.path().join("external-config"));
+        let output = configure_command(
+            &mut cmd,
+            gix_hash::Kind::default(),
+            [
+                "-c",
+                "git init -q repo && cd repo && git check-attr fixture-isolated -- file.txt",
+            ],
+            fixture_dir,
+        )
+        .output()?;
+        assert!(output.status.success(), "the fixture command succeeds: {output:?}");
+        assert_eq!(
+            output.stdout.as_bstr(),
+            "file.txt: fixture-isolated: set\n",
+            "the isolated XDG directory stays anchored after changing directories, even with a relative fixture path"
+        );
+        assert!(output.stderr.is_empty(), "XDG paths produce no warnings: {output:?}");
+    }
+    Ok(())
 }
 
 #[test]
```

---

### Incident Patch 5: `d6dab890` (2026-10-05)
**Commit Message**: fix(gix-testtools): Make checkout safety fixtures reliable on Windows

<!-- agent -->
The traversal fixture rewrites `.git/index` to install paths Git would not
normally accept. MSYS `sed` reads that binary index in text mode, removing
carriage returns from incidental CRLF bytes in its stat data. Variable
timestamps make the resulting corruption intermittent. Setting the mtime to
`2000-11-01T12:31:06Z` (`0x3a000d0a`) reproduced the reported
`U git/hooks/pre-commit` and unresolved-conflict error exactly.

Use Perl with binary standard streams and literal path substitution, which
also works on systems without `sed -b`. Keep the CRLF-containing timestamp
in every generated repository so text-mode index corruption is exercised
deterministically by the existing checkout safety tests.

The same log's long-path warnings come from a relative `XDG_CONFIG_HOME`
being reinterpreted after the fixture changes directories. Make the isolated
configuration path absolute, and exercise both absolute and relative fixture
roots by checking that Git still reads the intended attributes after `cd`.

Validated on Windows with Git `2.55.0.windows.3`:

Assisted-by: GPT 6.1 Sol
Co-authored-by: GPT 6.1 Sol <[

**File**: `gix-worktree-state/tests/fixtures/make_traverse_trees.sh` (modified, +9/-4)
```diff
@@ -5,7 +5,7 @@ set -eu -o pipefail
 # File content is from stdin. Args are repo name, path, -x or +x, and tr sets.
 function make_repo() (
   local repo="$1" path="$2" xbit="$3" set1="$4" set2="$5"
-  local dir dir_standin path_standin path_standin_pattern path_replacement
+  local dir dir_standin path_standin
 
   git init -- "$repo"
   cd -- "$repo" # Temporary, as the function body is a ( ) subshell.
@@ -15,11 +15,16 @@ function make_repo() (
   path_standin="$(tr "$set1" "$set2" <<<"$path")"
   mkdir -p -- "$dir_standin"
   cat >"$path_standin"
+  # The index stores this mtime as 0x3a000d0a, including CRLF bytes. Text-mode sed
+  # on Windows would drop the CR and corrupt the index when rewriting it below.
+  TZ=UTC touch -t 200011011231.06 -- "$path_standin"
   git add --chmod="$xbit" -- "$path_standin"
-  path_standin_pattern="$(sed 's/[|.*^$\]/\\&/g' <<<"$path_standin")"
-  path_replacement="$(sed 's/[|&\]/\\&/g' <<<"$path")"
   cp .git/index old_index
-  LC_ALL=C sed "s|$path_standin_pattern|$path_replacement|g" old_index >.git/index
+  # Perl supports binary I/O on all platforms, including those without sed -b.
+  perl -0777 -pe '
+    BEGIN { binmode STDIN; binmode STDOUT; ($from, $to) = splice @ARGV, 0, 2 }
+    s/\Q$from\E/$to/g
+  ' "$path_standin" "$path" <old_index >.git/index
   git commit -m 'Initial commit'
 )
 
```

**File**: `tests/tools/src/lib.rs` (modified, +9/-2)
```diff
@@ -2208,8 +2208,13 @@ fn configure_command<'a, I: IntoIterator<Item = S>, S: AsRef<OsStr>>(
 ///
 /// Removes inherited and previously configured `GIT_*` variables, disables external configuration,
 /// and sets deterministic fixture defaults. `current_dir` scopes the replacement XDG configuration
-/// directory. This does not change the command's arguments, working directory, or standard I/O.
+/// directory, which is made absolute so scripts can change directories without relocating it.
+/// This does not change the command's arguments, working directory, or standard I/O.
 /// Add deliberate test-specific environment overrides after calling this function.
+///
+/// # Panics
+///
+/// If `current_dir` cannot be made absolute.
 pub fn configure_git_environment(
     cmd: &mut std::process::Command,
     current_dir: impl AsRef<Path>,
@@ -2235,7 +2240,9 @@ pub fn configure_git_environment(
         .env("MSYS", msys_for_git_bash_on_windows)
         .env(
             "XDG_CONFIG_HOME",
-            current_dir.as_ref().join(".gix-testtools-xdg-config"),
+            std::path::absolute(current_dir)
+                .expect("the test working directory can be made absolute")
+                .join(".gix-testtools-xdg-config"),
         )
         .env("GIT_CONFIG_NOSYSTEM", "1")
         .env("GIT_CONFIG_GLOBAL", NULL_DEVICE)
```

**File**: `tests/tools/src/tests.rs` (modified, +29/-14)
```diff
@@ -216,20 +216,35 @@ fn a_path_resolved_selected_git_does_not_override_path() {
 }
 
 #[test]
-fn configure_command_overrides_xdg_config_home() {
-    let temp = tempfile::TempDir::new().expect("can create temp dir");
-    let mut cmd = std::process::Command::new(gix_path::env::exe_invocation());
-    cmd.env("XDG_CONFIG_HOME", temp.path().join("external-config"));
-    configure_command(&mut cmd, gix_hash::Kind::default(), ["--version"], temp.path());
-
-    let xdg_config_home = cmd
-        .get_envs()
-        .find_map(|(key, value)| (key == "XDG_CONFIG_HOME").then_some(value))
-        .flatten();
-    assert_eq!(
-        xdg_config_home,
-        Some(temp.path().join(".gix-testtools-xdg-config").as_os_str())
-    );
+fn configure_command_overrides_xdg_config_home() -> gix_error::TestResult {
+    let current_dir = env::current_dir()?;
+    let temp = tempfile::tempdir_in(&current_dir)?;
+    let config_dir = temp.path().join(".gix-testtools-xdg-config/git");
+    std::fs::create_dir_all(&config_dir)?;
+    std::fs::write(config_dir.join("attributes"), "*.txt fixture-isolated\n")?;
+
+    for fixture_dir in [temp.path(), temp.path().strip_prefix(&current_dir)?] {
+        let mut cmd = std::process::Command::new(bash_program());
+        cmd.env("XDG_CONFIG_HOME", temp.path().join("external-config"));
+        let output = configure_command(
+            &mut cmd,
+            gix_hash::Kind::default(),
+            [
+                "-c",
+                "git init -q repo && cd repo && git check-attr fixture-isolated -- file.txt",
+            ],
+            fixture_dir,
+        )
+        .output()?;
+        assert!(output.status.success(), "the fixture command succeeds: {output:?}");
+        assert_eq!(
+            output.stdout.as_bstr(),
+            "file.txt: fixture-isolated: set\n",
+            "the isolated XDG directory stays anchored after changing directories, even with a relative fixture path"
+        );
+        assert!(output.stderr.is_empty(), "XDG paths produce no warnings: {output:?}");
+    }
+    Ok(())
 }
 
 #[test]
```

---

### Incident Patch 6: `9289a4c0` (2026-10-04)
**Commit Message**: fix(gix): match equivalent Windows paths when removing worktrees

The Windows fast-test job failed in Tix associated-branch cleanup:
`C:\Users\RUNNER~1\...\topic` was reported as not registered even
though Git had created the worktree. Git can record the long-name path,
while callers retain a short-name or verbatim path for the same directory.
The shared-base removal resolver only compared path components after
symlink resolution, which does not expand Windows short names.

After the existing component comparison fails on Windows, compare
canonical paths when both exist. Apply this at the shared equality helper
used for target selection and backlink validation. Keep the original
comparison and missing-path behavior so absent or inaccessible checkouts
can still be unregistered. Add a Windows regression that registers a
worktree with Git and removes it via its canonical path, and document
equivalent path selection.

Validation: ten gix removal tests and four Tix removal tests pass locally.
The gix integration tests cross-compile for aarch64-pc-windows-msvc with
basic,worktree-mutation enabled. Formatting and diff checks pass. Native
Windows regression execution remains with CI.

This

**File**: `gix/src/worktree/remove.rs` (modified, +10/-1)
```diff
@@ -78,6 +78,7 @@ impl Target<'_> {
     /// which accepts an absolute or relative worktree path or a unique suffix of whole path components.
     /// Relative target paths use the process's current directory, while registered paths use the directory
     /// captured when the repository was opened.
+    /// On Windows, existing paths also match their equivalent short-name and verbatim forms.
     /// The returned target can be inspected with [`Target::repository()`] before it is consumed by this method.
     ///
     /// # Examples
@@ -421,7 +422,15 @@ fn validate_backlink(work_dir: &Path, git_dir: &Path, ignore_case: bool) -> Resu
 }
 
 fn path_eq(left: &Path, right: &Path, ignore_case: bool) -> bool {
-    left.components().count() == right.components().count() && path_ends_with(left, right, ignore_case)
+    if left.components().count() == right.components().count() && path_ends_with(left, right, ignore_case) {
+        return true;
+    }
+    #[cfg(windows)]
+    if let (Ok(left), Ok(right)) = (left.canonicalize(), right.canonicalize()) {
+        // Windows short names and verbatim paths can refer to the same existing directory.
+        return left == right;
+    }
+    false
 }
 
 fn path_ends_with(path: &Path, suffix: &Path, ignore_case: bool) -> bool {
```

**File**: `gix/tests/gix/repository/worktree.rs` (modified, +29/-0)
```diff
@@ -1626,6 +1626,35 @@ mod remove {
         Ok(())
     }
 
+    #[test]
+    #[cfg(windows)]
+    fn canonical_paths_resolve_git_registered_worktrees() -> crate::Result {
+        let (repo, _fixture) = crate::basic_rw_repo()?;
+        let destinations = gix_testtools::tempfile::TempDir::new()?;
+        let destination = destinations.path().join("topic");
+        let output = gix_testtools::git_command(repo.workdir().expect("non-bare fixture"))
+            .args(["worktree", "add", "--detach"])
+            .arg(&destination)
+            .output()?;
+        assert!(
+            output.status.success(),
+            "Git registers the disposable worktree: {output:?}"
+        );
+        let canonical = destination.canonicalize()?;
+        let target = repo.prepare_remove_worktree(&canonical)?;
+        assert_eq!(
+            target.base().canonicalize()?,
+            canonical,
+            "canonical, verbatim, and short Windows names identify the same registered worktree"
+        );
+        target.remove(Force::Never, gix::progress::Discard)?;
+        assert!(
+            !destination.exists(),
+            "the equivalent path removes the intended worktree"
+        );
+        Ok(())
+    }
+
     fn branch(name: &str) -> FullName {
         format!("refs/heads/{name}").try_into().expect("valid test branch name")
     }
```

---

### Incident Patch 7: `d9630616` (2026-10-04)
**Commit Message**: Fix the Windows invalid-message regression test

The `test-fixtures-windows (windows-latest)` and
`test-32bit-windows-size-doc` CI jobs failed to compile the Windows-only
`invalid_message_encoding_retains_its_cause` test with E0061: it supplied
the former two-argument shape to the current three-argument
`explicit_message()` helper. This stale call was inherited from the shared
base, so keep the correction in a new PR commit.

Pass the message slice, optional file path, and stdin separately, matching
all current callers. Keep the encoding-error and retained-cause assertions.

Validation: all seven reword tests pass locally; all seven logging tests
pass with ANSI enabled; `cargo check -p gix-tix --tests --target
aarch64-pc-windows-msvc --features sha1` passes. Windows runtime execution
remains covered by CI. Workspace formatting and diff checks pass.

**File**: `gix-tix/src/command/reword.rs` (modified, +2/-1)
```diff
@@ -283,7 +283,8 @@ mod tests {
 
         let mut message_args = args("HEAD");
         message_args.edit.message = vec![OsString::from_wide(&[0xd800])];
-        let err = explicit_message(&message_args.edit, &b""[..]).expect_err("lone surrogates are not UTF-8");
+        let err = explicit_message(&message_args.edit.message, message_args.edit.file.as_deref(), &b""[..])
+            .expect_err("lone surrogates are not UTF-8");
         assert_eq!(err.to_string(), "message 1 is not valid UTF-8");
         assert!(err.is_validation());
         assert!(
```

---

### Incident Patch 8: `39277cc1` (2026-09-14)
**Commit Message**: fix(gix-tix): keep travel descendants attached to rewritten commits

Restricting travel to its destination route also removed later descendants
from the rewrite graph. Visiting a pending middle commit finalized it while
the branch above it still reached its old pending version, leaving two
versions of the same change visible in the TUI.

Keep the loaded edit graph for descendant rewrites and pass the original
travel route separately to the replay engine. Only the destination route
and its eligible AutoMerge inputs replay content. Affected descendants
follow rewritten parents lazily, retaining their trees and original replay
bases; their references and notes move in the same existing transaction.
Pending commits whose parents did not change remain untouched.

Remap the replay route independently across subsequent passes so AutoMerge
collapse cannot widen it. Shared ancestry and unpinned history outside the
loaded view retain their previous boundaries.

Add a regression for a pending middle commit, its retained descendant, and
onward travel. Update the sibling, merge, and backward-travel assertions to
require connected parent links while preserving content replay boundaries.

Validat

**File**: `gix-tix/spec.md` (modified, +10/-8)
```diff
@@ -1401,18 +1401,19 @@ views.
   the destination side after their shared ancestry; ordinary merges include all
   such parent paths, including pending sides beneath finalized merges. Finalized
   review roots, hidden boundaries, and shallow boundaries further limit replay.
-  All commits outside that scope retain their exact commit IDs and parent links,
-  even when pending. This includes older shared ancestry, off-path siblings,
-  descendants beyond the destination, and the departure unless it is also the
-  destination.
-  Pending commits outside this scope provide their existing trees without replay.
+  Older shared ancestry and unrelated branches retain their exact commit IDs and
+  parent links, even when pending. Rewritten commits lazily reparent affected
+  descendants in the loaded edit scope, including sibling branches and commits
+  beyond the destination. Their refs and pins move in the same transaction;
+  their trees and original replay bases remain available for later travel.
+  Pending commits outside the replay scope provide their existing trees without replay.
   A completed final replay does not reload history; another pass loads only the
-  rewritten path and never unrelated references.
+  remapped edit graph and replay route, never unrelated references.
   A conflict retains the ours tree, exact merge-result
   tree, conflict stages, prepared commits, and in-memory objects without changing
   the repository. The actual conflicting row is selected and centered with normal
   history-boundary clamping and shows a steady red conflict marker; `<enter>` persists
-  the prepared rebase, leaves later commits within the travel scope lazy, checks
+  the prepared rebase, leaves affected later commits lazy, checks
   out the conflicting commit at the ours tree, then checks out the merge result and derives the
   unmerged index from it. `Esc` discards the suspended operation; navigation and
   other read-only actions leave the choice armed, while repository-changing actions
@@ -1524,7 +1525,8 @@ views.
   AutoMerge or an ordinary descendant also refreshes changes made outside Tix,
   including required AutoMerges on ordinary merge paths, but only inside the
   original travel scope. Inputs outside that scope are snapshots: their current
-  trees may contribute to the merge, but travel never replays or reparents them.
+  trees may contribute to the merge, but travel never replays them. Affected
+  descendants still follow rewritten parents lazily.
   If a refreshed AutoMerge collapses to an input outside the scope, travel checks
   out that exact input, even when pending.
   Watchers only refresh display data and never initiate a remerge.
```

**File**: `gix-tix/src/command/travel.rs` (modified, +25/-3)
```diff
@@ -694,7 +694,7 @@ mod tests {
                     .push(("tix-rebase-parent".into(), parent_commit_id.to_string().into()));
             }
             let destination_commit_id = repository.write_object(&destination)?.detach();
-            // Same-tree descendants make unintended rewrites observable without checkout conflicts.
+            // Same-tree descendants distinguish parent-link updates from tree replay.
             let mut departure = destination.clone();
             departure.extra_headers.clear();
             departure.parents = [destination_commit_id].into_iter().collect();
@@ -760,18 +760,40 @@ mod tests {
                 [parent_commit_id],
                 "{revision} keeps the destination's pending parent unchanged"
             );
+            let mapped_departure_commit_id = repository.find_reference("refs/heads/departure")?.id().detach();
+            if !same_head && pending_destination {
+                assert_ne!(
+                    mapped_departure_commit_id, departure_commit_id,
+                    "backward travel reparents the departure above its rewritten destination"
+                );
+                let departure = repository
+                    .find_commit(mapped_departure_commit_id)?
+                    .decode()?
+                    .into_owned()?;
+                assert_eq!(departure.parents.as_slice(), [selected_commit_id]);
+                assert_eq!(departure.tree, destination.tree, "the departure retains its exact tree");
+                assert!(
+                    !crate::edit::rebase::is_pending(&departure),
+                    "unchanged parent trees keep the departure final"
+                );
+            } else {
+                assert_eq!(
+                    mapped_departure_commit_id, departure_commit_id,
+                    "an unchanged or out-of-view departure retains its exact commit"
+                );
+            }
             for (name, commit_id) in [
                 ("refs/heads/base", base_commit_id),
                 ("refs/heads/pending-parent", parent_commit_id),
-                ("refs/heads/departure", departure_commit_id),
+                // This unpinned branch remains outside the loaded view.
                 ("refs/heads/later", later_commit_id),
                 ("refs/heads/destination", selected_commit_id),
                 (
                     "refs/heads/main",
                     if same_head {
                         selected_commit_id
                     } else {
-                        departure_commit_id
+                        mapped_departure_commit_id
                     },
                 ),
             ] {
```

**File**: `gix-tix/src/edit/rebase.rs` (modified, +29/-21)
```diff
@@ -57,7 +57,7 @@ pub(crate) enum PendingCheckout {
     FinalizeEditedHead,
 }
 
-pub(crate) enum Edit {
+pub(crate) enum Edit<'a> {
     Replace {
         target: ObjectId,
         commit: gix::objs::Commit,
@@ -89,6 +89,8 @@ pub(crate) enum Edit {
         base: ObjectId,
         checkout: ObjectId,
         stash_before_persist: Option<gix::refs::FullName>,
+        /// Replay this route while retaining the outer graph for lazy descendant rewrites.
+        scope: &'a HistoryGraph,
     },
 }
 
@@ -729,7 +731,7 @@ pub(crate) fn copy_insert_plan(
 pub(crate) fn perform(
     repo: &gix::Repository,
     graph: &HistoryGraph,
-    edit: Edit,
+    edit: Edit<'_>,
     signature: Signature,
     tree_mode: Tree,
 ) -> Result<Perform> {
@@ -752,7 +754,7 @@ pub(crate) fn perform(
 pub(crate) fn perform_with_progress(
     repo: &gix::Repository,
     graph: &HistoryGraph,
-    edit: Edit,
+    edit: Edit<'_>,
     signature: Signature,
     tree_mode: Tree,
     checkout: Option<CheckoutOptions<'_>>,
@@ -778,7 +780,7 @@ pub(crate) fn perform_with_progress(
 pub(crate) fn perform_with_enrichment(
     repo: &gix::Repository,
     graph: &HistoryGraph,
-    edit: Edit,
+    edit: Edit<'_>,
     signature: Signature,
     tree_mode: Tree,
     headers: &crate::enrich::Headers,
@@ -801,7 +803,7 @@ pub(crate) fn perform_with_enrichment(
 pub(crate) fn perform_with_enrichment_and_progress(
     repo: &gix::Repository,
     graph: &HistoryGraph,
-    edit: Edit,
+    edit: Edit<'_>,
     signature: Signature,
     tree_mode: Tree,
     headers: &crate::enrich::Headers,
@@ -849,7 +851,7 @@ pub(crate) fn perform_with_refackiewed_and_progress(
 pub(super) fn perform_finalizing_pending_checkout_with_progress(
     repo: &gix::Repository,
     graph: &HistoryGraph,
-    edit: Edit,
+    edit: Edit<'_>,
     signature: Signature,
     tree_mode: Tree,
     mut report: impl FnMut(Progress),
@@ -873,7 +875,7 @@ pub(super) fn perform_finalizing_pending_checkout_with_progress(
 pub(crate) fn perform_reporting_rebased(
     repo: &gix::Repository,
     graph: &HistoryGraph,
-    edit: Edit,
+    edit: Edit<'_>,
     signature: Signature,
     tree_mode: Tree,
     mut report: impl FnMut(ObjectId),
@@ -901,7 +903,7 @@ pub(crate) fn perform_reporting_rebased(
 pub(super) fn perform_resetting_index_paths_with_progress(
     repo: &gix::Repository,
     graph: &HistoryGraph,
-    edit: Edit,
+    edit: Edit<'_>,
     signature: Signature,
     tree_mode: Tree,
     paths: Vec<BString>,
@@ -926,7 +928,7 @@ pub(super) fn perform_resetting_index_paths_with_progress(
 pub(super) fn perform_resetting_index_paths_finalizing_pending_checkout_with_progress(
     repo: &gix::Repository,
     graph: &HistoryGraph,
-    edit: Edit,
+    edit: Edit<'_>,
     signature: Signature,
     tree_mode: Tree,
     paths: Vec<BString>,
@@ -951,7 +953,7 @@ pub(super) fn perform_resetting_index_paths_finalizing_pending_checkout_with_pro
 pub(super) fn perform_deleting_refs_with_progress(
     repo: &gix::Repository,
     graph: &HistoryGraph,
-    edit: Edit,
+    edit: Edit<'_>,
     signature: Signature,
     tree_mode: Tree,
     deletions: Vec<(gix::refs::FullName, Target)>,
@@ -980,7 +982,7 @@ pub(super) fn perform_deleting_refs_with_progress(
 fn perform_inner(
     repo: &gix::Repository,
     graph: &HistoryGraph,
-    edit: Edit,
+    edit: Edit<'_>,
     signature: Signature,
     tree_mode: Tree,
     checkout_options: Option<CheckoutOptions<'_>>,
@@ -1017,7 +1019,10 @@ fn perform_inner(
             }
             _ => false,
         };
-    let travel = matches!(&edit, Edit::Travel { .. });
+    let (travel, replay_graph) = match &edit {
+        Edit::Travel { scope, .. } => (true, *scope),
+        _ => (false, graph),
+    };
     let (repeat_checkout, stash_before_persist) = match &edit {
         Edit::Repeat {
             checkout,
@@ -1089,7 +1094,7 @@ fn perform_inner(
         })
         .collect();
     if repeat {
-        checkout_path = auto_merge::checkout_path(&repo, graph, repeat_checkout)?;
+        checkout_path = auto_merge::checkout_path(&repo, replay_graph, repeat_checkout)?;
         let mut included: HashSet<_> = affected.iter().copied().collect();
         for commit_id in &checkout_path {
             if graph.auto_merges.contains_key(commit_id)
@@ -1111,10 +1116,10 @@ fn perform_inner(
         }
     } else {
         let auto_checkout = repeat_checkout.or(checkout).filter(|_| !below);
-        checkout_path = auto_merge::checkout_path(&repo, graph, auto_checkout)?;
+        checkout_path = auto_merge::checkout_path(&repo, replay_graph, auto_checkout)?;
         auto_merge::prepare(
             &repo,
-            graph,
+            replay_graph,
             &mut affected,
             auto_checkout,
             root.filter(|id| tree_mode == Tree::CherryPick && graph.auto_merges.contains_key(id)),
@@ -1126,14 +1131,14 @@ fn perform_inner(
     if travel {
         gix::error::ensure!(
             affec
```

**File**: `gix-tix/src/edit/time_travel.rs` (modified, +156/-27)
```diff
@@ -829,15 +829,14 @@ pub(crate) fn perform_reporting_rebased(
     // Keep the creation name as well: rollback reverses any later association rewrites.
     let mut saved: Option<(SavedStash, gix::refs::FullName)> = None;
     let mut ref_changes = Vec::new();
-    let graph = travel_graph(&repository, graph, head_id, selected)?;
-    let graph = &graph;
+    let mut scope = travel_graph(&repository, graph, head_id, selected)?;
     let result = (|| -> Result<Perform> {
         let mut completed_graph = None;
         let mut remerge_notice = None;
         let mut original_ids = HashMap::new();
         let mut ref_rewrites = Vec::new();
-        let mut required = super::auto_merge::checkout_path(&repository, graph, Some(selected))?;
-        let mut pending = refresh_base(graph, selected, &required).or(pending_base(&repository, selected, &required)?);
+        let mut required = super::auto_merge::checkout_path(&repository, &scope, Some(selected))?;
+        let mut pending = refresh_base(&scope, selected, &required).or(pending_base(&repository, selected, &required)?);
         while let Some(base) = pending {
             let graph = completed_graph.as_ref().unwrap_or(graph);
             let mut rebased = Vec::new();
@@ -848,6 +847,7 @@ pub(crate) fn perform_reporting_rebased(
                     base,
                     checkout: selected,
                     stash_before_persist: stash_name.clone(),
+                    scope: &scope,
                 },
                 super::rebase::Signature::RedoIfNeeded,
                 super::rebase::Tree::CherryPick,
@@ -902,18 +902,13 @@ pub(crate) fn perform_reporting_rebased(
             }
             repository = open_repository(repository_path, bare, false)
                 .or_raise(|| message("could not reopen repository after completing a pending rebase"))?;
-            let mut ids = Vec::new();
-            for commit_id in graph.edit_commit_ids() {
-                let Some(mapped_commit_id) = outcome.map(commit_id) else {
-                    continue;
-                };
-                // A collapsed AutoMerge aliases an input; it does not make that input editable.
-                if outcome.collapsed.contains(&commit_id) {
-                    continue;
-                }
-                ids.push(mapped_commit_id);
-            }
-            let editable: HashSet<_> = ids.iter().copied().collect();
+            // A collapsed AutoMerge aliases an input; it does not add that input to the replay route.
+            let editable: HashSet<_> = scope
+                .edit_commit_ids()
+                .into_iter()
+                .filter(|commit_id| !outcome.collapsed.contains(commit_id))
+                .filter_map(|commit_id| outcome.map(commit_id))
+                .collect();
             required = required
                 .into_iter()
                 .filter_map(|commit_id| outcome.map(commit_id))
@@ -922,16 +917,23 @@ pub(crate) fn perform_reporting_rebased(
             pending = pending_base(&repository, selected, &required)?;
             if pending.is_some() {
                 gix::error::ensure!(
-                    rebased
-                        .iter()
-                        .any(|(commit_id, _)| outcome.map(*commit_id) != Some(*commit_id)),
+                    rebased.iter().any(|(commit_id, _)| scope.is_in_edit_scope(*commit_id)
+                        && outcome.map(*commit_id) != Some(*commit_id)),
                     "time-travel could not finish the pending destination within its route"
                 );
+                let ids: Vec<_> = graph
+                    .edit_commit_ids()
+                    .into_iter()
+                    .filter(|commit_id| !outcome.collapsed.contains(commit_id))
+                    .filter_map(|commit_id| outcome.map(commit_id))
+                    .collect();
                 let mut next_graph = history::HistoryGraph::for_commits(&repository, &ids)?;
                 next_graph.bounded_history = graph
                     .bounded_history
                     .as_ref()
                     .map(|ids| ids.iter().filter_map(|id| outcome.map(*id)).collect());
+                scope = history::HistoryGraph::for_commits(&repository, &editable.into_iter().collect::<Vec<_>>())?;
+                scope.bounded_history.clone_from(&next_graph.bounded_history);
                 completed_graph = Some(next_graph);
             }
         }
@@ -3424,6 +3426,108 @@ mod tests {
         Ok(())
     }
 
+    #[test]
+    fn time_travel_keeps_pending_descendants_above_the_replayed_destination() -> gix_testtools::Result {
+        let fixture = gix_testtools::scripted_fixture_writable("rebase_edit.sh")?;
+        let repository = crate::test_repository::open(fixture.path())?;
+        let root_commit_id = repository.rev_parse_single("HEAD~2")?.detach();
+        let middle_commit_id = repository.rev_parse_single("HEAD~1")?.detach();
+        let tip_commit_id = repository.head_id()
```

---

### Incident Patch 9: `28a32b54` (2026-09-14)
**Commit Message**: fix(gix-tix): keep Windows editors attached to the console

`gix-command` prepares background helpers with `CREATE_NO_WINDOW`. Even with
inherited standard streams, that flag gives Windows editors a separate hidden
console. Vim and Nano can exit unsuccessfully, while Helix can wait invisibly
for input that never reaches it.

Clear the creation flags when launching Tix's configured editor so both direct
commands and shell commands share Tix's console. The common launch path covers
editing from the TUI and command-line operations without changing editor
selection or the handling of the edited document.

Add an isolated Windows regression that runs in a hidden test console and
checks that the editor shares its caller's console before editing the file.
Checking console process membership matters: opening `CONIN$` alone also works
in the separate hidden console. Document the console-inheritance guarantee in
`spec.md`.

Verified interactive launches with Vim, Nano, and Helix, including returning
from Vim and Helix to the TUI. The regression fails before the fix and passes
afterward. The combined editor and command checks pass 75 tests; the remaining
bare-clone test fails identically with

**File**: `gix-tix/spec.md` (modified, +2/-1)
```diff
@@ -348,7 +348,8 @@ without trading responsiveness for metadata that is not visible.
   Ordinary lazy replay, travel conflicts, and native Git rebases do not create
   these shared sessions.
 - Editor-launching commands honor Git's normal editor selection and
-  `GIT_EDITOR` overrides it.
+  `GIT_EDITOR` overrides it. Editors inherit the standard streams and, on
+  Windows, share Tix's console, including when invoked through a shell.
 - Revisions must resolve and peel to commits. Invalid or non-commit visible
   revisions are errors. An unavailable hidden revision emits a warning and is
   ignored when another hidden revision resolves; if none resolve, startup fails.
```

**File**: `gix-tix/src/edit/mod.rs` (modified, +58/-0)
```diff
@@ -145,6 +145,13 @@ pub(crate) fn edit_document_without_terminal(
     } else {
         format!(" {editor_display}")
     };
+    #[cfg(windows)]
+    {
+        use std::os::windows::process::CommandExt;
+        // gix-command uses CREATE_NO_WINDOW for background helpers. Interactive editors
+        // must inherit our console instead of running in a separate, invisible console.
+        command.creation_flags(0);
+    }
     let status = command
         .status()
         .or_raise(|| message!("could not launch Git editor{editor_display}").with_program(command.get_program()))?;
@@ -161,6 +168,57 @@ mod tests {
 
     use super::*;
 
+    #[cfg(windows)]
+    #[test]
+    fn editor_inherits_the_windows_console() -> gix_testtools::Result {
+        if gix_testtools::run_in_isolated_process()? {
+            return Ok(());
+        }
+        let fixtures = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures");
+        if std::env::var_os("GIX_TIX_TEST_CONSOLE").is_none() {
+            // Cargo may run without a console. Give this test its own hidden console so
+            // inheritance is observable without opening a window or using the user's terminal.
+            let output_dir = gix_testtools::tempfile::tempdir()?;
+            let thread = std::thread::current();
+            let test_name = thread.name().expect("libtest names its test threads");
+            let mut command = Command::new("pwsh");
+            let output = gix_testtools::configure_git_environment(&mut command, output_dir.path())
+                .env("GIX_TIX_TEST_CONSOLE", "1")
+                .args(["-NoProfile", "-NonInteractive", "-File"])
+                .arg(fixtures.join("with-console.ps1"))
+                .arg(std::env::current_exe()?)
+                .arg(test_name)
+                .arg(output_dir.path())
+                .output()?;
+            assert!(
+                output.status.success(),
+                "the editor test succeeds in its private console: {}\n{}\n{}",
+                output.status,
+                String::from_utf8_lossy(&output.stdout),
+                String::from_utf8_lossy(&output.stderr)
+            );
+            return Ok(());
+        }
+
+        let fixture = gix_testtools::scripted_fixture_writable("create_commit.sh")?;
+        let editor = format!(
+            "pwsh -NoProfile -NonInteractive -File \"{}\" {}",
+            fixtures.join("console-editor.ps1").display(),
+            std::process::id()
+        );
+        let repo = crate::test_repository::open_with(fixture.path(), [format!("core.editor={editor}")])?;
+        for shell in [false, true] {
+            let editor = repo.editor_command()?.expect("the console editor is configured");
+            let editor = if shell { editor.with_shell() } else { editor };
+            assert_eq!(
+                edit_document_without_terminal(editor, b"original\n", "tix-console-editor.md")?,
+                Some(b"edited with an inherited console\n".to_vec()),
+                "both direct and shell editors share the caller's console and edit the file (shell: {shell})"
+            );
+        }
+        Ok(())
+    }
+
     fn git(path: &Path, args: &[&str]) -> gix_testtools::Result<Vec<u8>> {
         let output = gix_testtools::git_command(path).args(args).output()?;
         if !output.status.success() {
```

**File**: `gix-tix/tests/fixtures/console-editor.ps1` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+param(
+    [Parameter(Mandatory = $true)][uint32]$ExpectedConsoleProcess,
+    [Parameter(Mandatory = $true)][string]$Path
+)
+
+$ErrorActionPreference = 'Stop'
+
+# CREATE_NO_WINDOW can still provide console devices, but they belong to a
+# separate hidden console. Check membership, not just whether CONIN$ opens.
+Add-Type -TypeDefinition @'
+using System.Runtime.InteropServices;
+public static class ConsoleEditor {
+    [DllImport("kernel32.dll", SetLastError = true)]
+    public static extern uint GetConsoleProcessList([Out] uint[] processes, uint count);
+}
+'@
+$processes = [uint32[]]::new(16)
+while ($true) {
+    $count = [ConsoleEditor]::GetConsoleProcessList($processes, $processes.Length)
+    if ($count -eq 0) {
+        throw 'The editor has no console.'
+    }
+    if ($count -le $processes.Length) {
+        break
+    }
+    $processes = [uint32[]]::new($count)
+}
+if ($processes -notcontains $ExpectedConsoleProcess) {
+    throw 'The editor must share the calling process console.'
+}
+[System.IO.File]::WriteAllText($Path, "edited with an inherited console`n", [System.Text.UTF8Encoding]::new($false))
```

**File**: `gix-tix/tests/fixtures/with-console.ps1` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+param(
+    [Parameter(Mandatory = $true)][string]$Executable,
+    [Parameter(Mandatory = $true)][string]$TestName,
+    [Parameter(Mandatory = $true)][string]$OutputDirectory
+)
+
+$ErrorActionPreference = 'Stop'
+
+# A hidden, separate console makes console inheritance testable even when Cargo
+# runs with redirected streams or without an attached console. Keep the working
+# directory so the re-executed Rust test can still resolve its fixture scripts.
+$stdout = Join-Path $OutputDirectory 'stdout.txt'
+$stderr = Join-Path $OutputDirectory 'stderr.txt'
+$process = Start-Process -FilePath $Executable `
+    -ArgumentList @('--exact', $TestName, '--nocapture', '--test-threads=1') `
+    -WorkingDirectory (Get-Location).Path -WindowStyle Hidden `
+    -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
+if (-not $process.WaitForExit(30000)) {
+    Stop-Process -Id $process.Id -Force
+    throw 'The console editor test did not finish within 30 seconds.'
+}
+# Wait for redirected output to drain as well as for the process to exit.
+$process.WaitForExit()
+Get-Content -LiteralPath $stdout, $stderr
+exit $process.ExitCode
```

---

### Incident Patch 10: `7f2111b3` (2026-09-14)
**Commit Message**: feat(gix-tix)!: retain paused rebases across CLI and TUI sessions

Accepted rebase and transplant conflicts previously kept their continuation
in an exported todo or in TUI memory. Restarting Tix or changing interfaces
lost the operation context, and the TUI could not identify a CLI-created
pause. Save accepted pauses in worktree-local Git metadata using the existing
todo and undo formats, retaining their required objects through Git GC.

Add `tix rebase status [--porcelain]`, `continue`, and `stop`. Continuation
consumes the staged index without launching an editor or staging files.
Initial and later conflicts require explicit acceptance; refusal preserves
the prior state. Plain `rebase todo` exports the saved plan, and matching
edited-file application remains supported. Bare `--materialize-conflicts`
now saves internally; exporting requires `=FILE` or `=-` for stdout. Optional
filenames never consume a positional todo.

Restore the TUI's persistent `REBASE PAUSED` notice on startup and refresh,
including operation, remaining work, readiness, and blocked-state guidance.
Enter continues, subsequent conflicts require acceptance, Escape stops at a
saved pause, and quitting preserves 

**File**: `gix-tix/spec.md` (modified, +81/-27)
```diff
@@ -167,7 +167,9 @@ without trading responsiveness for metadata that is not visible.
   default Tix view. The copy/move, fork/insert, and placement choices are required.
   Success prints the transplanted root's commit/change IDs followed by reference
   rewrites. A conflict changes nothing unless explicitly materialized into the
-  existing editable rebase continuation workflow.
+  shared rebase continuation workflow below. Bare `--materialize-conflicts` saves
+  the pause internally; `=CONTINUE` additionally exports a todo, and `=-` exports
+  to stdout. Optional filenames always require `=`.
 - `tix op`, also spelled `tix op log`, prints the current worktree's complete
   retained operation history to stdout, newest first. Each operation has a
   numbered position, `applied` or `undone` status, and its title; `@` marks the
@@ -181,8 +183,10 @@ without trading responsiveness for metadata that is not visible.
   step they report `nothing to undo` or `nothing to redo` to stderr and succeed;
   failures return an error. A new recorded operation after undo discards the
   remaining redo entries. Undo/redo reject an unresolved current index before
-  changing references, queue position, index, or files; a pending commit marker
-  or saved continuation alone does not block them once the index is resolved.
+  changing references, queue position, index, or files. A pending commit marker
+  alone does not block them once the index is resolved. A saved active rebase
+  blocks undo, redo, and clear until it completes or is stopped; its accumulated
+  changes become one undo entry at that point.
   Existing checked-reference updates, affected-worktree preflight, rollback,
   and review restrictions apply, including the review-finish exception below.
 - `tix op clear` atomically, silently, and idempotently deletes the current
@@ -275,9 +279,12 @@ without trading responsiveness for metadata that is not visible.
   is an error. The resulting `(updated-base)` plan remains actionable when saved
   unchanged. `--update-base` and an explicit `--onto` are mutually exclusive.
   `--edit-and-apply` opens the same plan with Git's configured editor and applies
-  it when the editor exits. It also accepts `--materialize-conflicts [CONTINUE]`
-  to opt into the same conflict checkout and continuation-document workflow as
-  `tix rebase apply`; the option requires `--edit-and-apply`.
+  it when the editor exits. It also accepts `--materialize-conflicts[=CONTINUE]`
+  to opt into the same saved-conflict workflow as `tix rebase apply`; the option
+  requires `--edit-and-apply`. While a rebase is paused, plain `tix rebase todo`
+  exports its saved remaining todo without requiring a hidden boundary. Its
+  `--edit-and-apply` form edits that continuation. Scope and target options are
+  rejected until the active operation is completed or stopped.
 - `tix show`, `tix ref-tree`, and `tix rebase todo` automatically inspect symbolic
   `refs/remotes/<remote>/HEAD` references. Their targets are reverse-mapped
   through each remote's fetch refspec, and existing local commit branches are
@@ -295,11 +302,47 @@ without trading responsiveness for metadata that is not visible.
   input when `FILE` is omitted or `-`. Removing its state comment or emptying the
   document cancels successfully; malformed or unsupported state is an error.
 - By default, a todo conflict changes nothing. Explicit
-  `--materialize-conflicts [CONTINUE]` accepts the partial result, checks out the
-  conflicting commit with an unmerged index, and writes a fresh editable
-  continuation todo to `CONTINUE`, or stdout when `-` is used. A terminal stdout
-  is refused. Materialization exits unsuccessfully so scripts cannot mistake the
-  incomplete rebase for completion.
+  `--materialize-conflicts[=CONTINUE]` accepts the partial result, checks out the
+  conflicting commit with an unmerged index, and saves an editable continuation
+  inside the current worktree's Git metadata. Bare opt-in needs no output file.
+  `=CONTINUE` additionally creates a new export file; `=-` explicitly writes the
+  todo to stdout. Optional filenames require `=` and never consume a positional
+  input file. Export errors prevent materialization. Materialization exits
+  unsuccessfully so scripts cannot mistake a pause for completion.
+- `tix rebase status [--porcelain]` reports the saved operation, conflict commit,
+  remaining steps (including the unresolved command and remaining folds), and
+  `conflicted`, `ready`, or `blocked` readiness. Inspection never resumes or
+  amends a commit. Porcelain output consists of one `key value` per line:
+  `state`, `operation`, `remaining`, `conflict`, and an optional `reason` with
+  escaped control characters. With no active operation it prints only
+  `state none` and succeeds. Human-readable status and todos are primary stdout
+  data; mutation guidance and diagnostics go to stderr.
+- `tix rebase continue [--materialize-conflicts[=CONTINUE]]` consumes 
```

**File**: `gix-tix/src/app.rs` (modified, +38/-1)
```diff
@@ -671,6 +671,7 @@ pub(crate) struct App {
     worktree_head_unborn: bool,
     pending_rebase_conflict: Option<ObjectId>,
     rebase_continuation_pending: bool,
+    rebase_summary: Option<crate::edit::rebase::session::Summary>,
     worktree_conflicted: bool,
     amend_available: bool,
     stash_available: bool,
@@ -797,6 +798,7 @@ impl App {
             worktree_head_unborn: false,
             pending_rebase_conflict: None,
             rebase_continuation_pending: false,
+            rebase_summary: None,
             worktree_conflicted: false,
             amend_available: false,
             stash_available: false,
@@ -938,7 +940,18 @@ impl App {
                 if entry.is_empty() { "_" } else { entry }
             ))
         } else if self.rebase_continuation_pending() {
-            Some(if self.rebase_continuation_conflicted() {
+            Some(if let Some(summary) = &self.rebase_summary {
+                use crate::edit::rebase::session::Readiness;
+                let guidance = match &summary.readiness {
+                    Readiness::Conflicted => "resolve conflicts, then <enter> continue".into(),
+                    Readiness::Ready => "ready · <enter> continue".into(),
+                    Readiness::Blocked(reason) => format!("blocked: {reason}"),
+                };
+                format!(
+                    "REBASE PAUSED · {} · {} remaining · {guidance} · Esc stop",
+                    summary.operation, summary.remaining
+                )
+            } else if self.rebase_continuation_conflicted() {
                 "REBASE PAUSED · resolve conflicts, then <enter> continue · Esc stop".into()
             } else {
                 "REBASE PAUSED · <enter> continue · Esc stop".into()
@@ -1160,9 +1173,33 @@ impl App {
 
     pub(crate) fn clear_rebase_continuation(&mut self) {
         self.rebase_continuation_pending = false;
+        self.rebase_summary = None;
         self.restore_compressed_history_around_selection();
     }
 
+    pub(crate) fn set_rebase_session(&mut self, summary: Option<crate::edit::rebase::session::Summary>) -> bool {
+        if self.rebase_summary == summary && self.rebase_continuation_pending == summary.is_some() {
+            return false;
+        }
+        match &summary {
+            Some(summary) => {
+                if !self.rebase_continuation_pending {
+                    self.begin_conflict_resolution();
+                    self.clear_notice();
+                }
+                match summary.readiness {
+                    crate::edit::rebase::session::Readiness::Conflicted => self.set_worktree_conflicted(true),
+                    crate::edit::rebase::session::Readiness::Ready => self.set_worktree_conflicted(false),
+                    crate::edit::rebase::session::Readiness::Blocked(_) => {}
+                }
+                self.arm_rebase_continuation();
+            }
+            None => self.clear_rebase_continuation(),
+        }
+        self.rebase_summary = summary;
+        true
+    }
+
     pub(crate) fn rebase_continuation_pending(&self) -> bool {
         self.rebase_continuation_pending
     }
```

**File**: `gix-tix/src/command.rs` (modified, +143/-20)
```diff
@@ -197,7 +197,7 @@ struct Pin {
     group(clap::ArgGroup::new("mode").required(true).args(["copy", "move_commits"])),
     group(clap::ArgGroup::new("connection").required(true).args(["fork", "insert"])),
     group(clap::ArgGroup::new("placement").required(true).args(["above", "below"])),
-    after_long_help = "ROOT alone selects one commit. --leaf selects the paths from ROOT to each TIP; --subtree selects all eligible descendants in the Tix view.\nConflicts change nothing by default. To materialize one and write a continuation todo:\n  tix transplant C --copy --insert --above I --materialize-conflicts=todo.continue.md\nResolve the index, then run:\n  tix rebase apply todo.continue.md\nUse --materialize-conflicts=- to write a continuation to non-terminal stdout."
+    after_long_help = "ROOT alone selects one commit. --leaf selects the paths from ROOT to each TIP; --subtree selects all eligible descendants in the Tix view.\nConflicts change nothing by default. To accept and save a pause:\n  tix transplant C --copy --insert --above I --materialize-conflicts\nResolve and stage the conflict, then run:\n  tix rebase continue\nUse --materialize-conflicts=FILE to export the saved continuation, or =- for stdout."
 )]
 struct Transplant {
     /// Revision resolving to the root of the selected commit tree.
@@ -227,15 +227,14 @@ struct Transplant {
     /// Place the selected tree directly below DEST.
     #[arg(long, value_name = "DEST")]
     below: Option<OsString>,
-    /// On conflict, materialize it and write a continuation todo to FILE, or stdout if omitted or '-'.
+    /// Accept a conflict and save its continuation; optionally export to FILE, or '-' for stdout.
     #[arg(
         long,
         value_name = "CONTINUE",
         num_args = 0..=1,
-        default_missing_value = "-",
         require_equals = true
     )]
-    materialize_conflicts: Option<PathBuf>,
+    materialize_conflicts: Option<Option<PathBuf>>,
 }
 
 #[derive(Debug, clap::Parser)]
@@ -367,6 +366,12 @@ impl Platform {
             Command::RefTree(args) => return print_ref_tree(&repository, args),
             Command::Show(args) => return show(&repository, args),
             Command::Worktrunk { command } => {
+                if matches!(
+                    &command,
+                    Some(WorktrunkCommand::Switch { .. } | WorktrunkCommand::Remove { .. })
+                ) {
+                    crate::edit::rebase::session::ensure_idle(&repository)?;
+                }
                 return match command {
                     None => crate::worktrunk::run(repository.into_sync(), None, None, false, false, quit_on_finish),
                     Some(WorktrunkCommand::Show) => crate::worktrunk::show(&repository, std::io::stdout().lock()),
@@ -396,6 +401,16 @@ impl Platform {
             }
             command => command,
         };
+        if !matches!(
+            &command,
+            Command::Amend(_)
+                | Command::Rebase(_)
+                | Command::Op {
+                    command: None | Some(op::Command::Log)
+                }
+        ) {
+            crate::edit::rebase::session::ensure_idle(&repository)?;
+        }
         match command {
             Command::RefTree(_) | Command::Show(_) => unreachable!("display commands return before logging"),
             Command::Amend(args) => {
@@ -827,7 +842,7 @@ fn transplant(repository: gix::Repository, args: Transplant) -> Result<()> {
         crate::edit::rebase::PlanPerform::Conflict(conflict) => rebase::handle_plan_conflict(
             &repository,
             conflict,
-            args.materialize_conflicts.as_deref(),
+            args.materialize_conflicts.as_ref().map(|path| path.as_deref()),
             &[],
             "transplant",
         ),
@@ -1042,6 +1057,101 @@ mod tests {
 
     use super::*;
 
+    #[test]
+    fn tui_recovers_a_cli_pause_and_observes_cli_amend_continue_and_stop() -> gix_testtools::Result {
+        use crate::{
+            Action, App, refresh_rebase_session, restore_merge_conflict_resolution, stage_resolved_conflict_paths,
+        };
+
+        for stop in [false, true] {
+            let (fixture, repo, _) = crate::edit::rebase::session::tests::paused()?;
+            let before = gix_testtools::repository::snapshot(fixture.path())?;
+            let mut app = App::new(1);
+            assert!(
+                refresh_rebase_session(&mut app, fixture.path(), false),
+                "startup discovers a saved CLI pause"
+            );
+            let notice = app
+                .notice()
+                .ok_or_raise(|| message("a paused rebase owns the notice"))?;
+            assert!(
+                notice.text.contains("REBASE PAUSED · rebase · 1 remaining"),
+                "the operation and remaining work are visible"
+            );
+            assert!(
+                notice.text.contains("resolve conflicts"),
+                "the notice gives conflict-resolution guidance"
+  
```

**File**: `gix-tix/src/command/op.rs` (modified, +3/-0)
```diff
@@ -23,6 +23,9 @@ pub(super) fn run(
     mut out: impl Write,
     mut err: impl Write,
 ) -> Result<()> {
+    if !matches!(command, None | Some(Command::Log)) {
+        crate::edit::rebase::session::ensure_idle(repository)?;
+    }
     match command.unwrap_or(Command::Log) {
         Command::Log => {
             let history = undo::history(repository)?;
```

**File**: `gix-tix/src/command/rebase.rs` (modified, +336/-43)
```diff
@@ -1,6 +1,6 @@
 use std::{
     ffi::{OsStr, OsString},
-    io::{IsTerminal, Read, Write},
+    io::{Read, Write},
     path::{Path, PathBuf},
     sync::atomic::AtomicBool,
 };
@@ -22,14 +22,24 @@ pub(super) enum Command {
     Todo(Todo),
     /// Apply a self-contained rebase todo from FILE or standard input.
     #[command(
-        after_long_help = "Conflicts change nothing by default. To opt in, write the continuation only when needed:\n  tix rebase apply --materialize-conflicts todo.continue.md todo.md\nResolve the index, then run:\n  tix rebase apply todo.continue.md\nUse --materialize-conflicts=- to write a continuation to non-terminal stdout."
+        after_long_help = "Conflicts change nothing by default. To accept and save a pause:\n  tix rebase apply --materialize-conflicts todo.md\nResolve and stage the conflict, then run:\n  tix rebase continue\nEach later conflict also requires --materialize-conflicts. Use =FILE to export the saved continuation, or =- for stdout."
     )]
     Apply(Apply),
+    /// Show the saved operation, remaining steps, and whether it can continue.
+    Status {
+        /// Print stable, line-oriented fields for scripts and agents.
+        #[arg(long)]
+        porcelain: bool,
+    },
+    /// Continue the saved operation using the staged index, without opening an editor.
+    Continue(Continue),
+    /// Forget remaining work, preserving the partial commits, index, and worktree.
+    Stop,
 }
 
 #[derive(Debug, clap::Args)]
 #[command(
-    after_long_help = "Without --edit-and-apply, the todo is written to stdout. With it, Git's normal editor selection is used; GIT_EDITOR=<command> overrides it.\n\nExamples:\n  tix rebase todo -x main topic >todo.md\n  ${GIT_EDITOR:-editor} todo.md\n  tix rebase apply todo.md\n  tix rebase todo --edit-and-apply -x main topic\n  tix rebase todo --edit-and-apply --materialize-conflicts todo.continue.md -x main topic"
+    after_long_help = "Without --edit-and-apply, the todo is written to stdout. While paused, a plain invocation exports the saved continuation. With --edit-and-apply, Git's normal editor selection is used; GIT_EDITOR=<command> overrides it.\n\nExamples:\n  tix rebase todo -x main topic >todo.md\n  ${GIT_EDITOR:-editor} todo.md\n  tix rebase apply todo.md\n  tix rebase todo --edit-and-apply -x main topic\n  tix rebase todo --edit-and-apply --materialize-conflicts -x main topic"
 )]
 pub(super) struct Todo {
     /// Hide this revision and derive the editable fork point from it.
@@ -47,42 +57,73 @@ pub(super) struct Todo {
     /// Open the todo in Git's editor and apply it after the editor exits.
     #[arg(long)]
     edit_and_apply: bool,
-    /// On conflict, materialize it and write a continuation todo to FILE, or stdout if omitted or '-'.
+    /// Accept a conflict and save its continuation; optionally export to FILE, or '-' for stdout.
     #[arg(
         long,
         value_name = "CONTINUE",
         num_args = 0..=1,
-        default_missing_value = "-",
+        require_equals = true,
         requires = "edit_and_apply"
     )]
-    materialize_conflicts: Option<PathBuf>,
+    materialize_conflicts: Option<Option<PathBuf>>,
     /// Visible traversal tips, or HEAD if omitted.
     #[arg(value_name = "TIP")]
     tips: Vec<OsString>,
 }
 
 #[derive(Debug, clap::Args)]
 pub(super) struct Apply {
-    /// On conflict, materialize it and write a continuation todo to FILE, or stdout if omitted or '-'.
-    #[arg(long, value_name = "CONTINUE", num_args = 0..=1, default_missing_value = "-")]
-    pub(super) materialize_conflicts: Option<PathBuf>,
+    /// Accept a conflict and save its continuation; optionally export to FILE, or '-' for stdout.
+    #[arg(long, value_name = "FILE", num_args = 0..=1, require_equals = true)]
+    pub(super) materialize_conflicts: Option<Option<PathBuf>>,
     /// Todo file to apply; omit or use '-' to read standard input.
     #[arg(value_name = "FILE")]
     pub(super) file: Option<PathBuf>,
 }
 
+#[derive(Debug, clap::Args)]
+pub(super) struct Continue {
+    /// Accept another conflict and save its continuation; optionally export to FILE, or '-' for stdout.
+    #[arg(long, value_name = "FILE", num_args = 0..=1, require_equals = true)]
+    materialize_conflicts: Option<Option<PathBuf>>,
+}
+
 pub(super) fn run(repo: gix::Repository, command: Command) -> Result<()> {
     match command {
         Command::Todo(args) => todo(repo, args),
         Command::Apply(args) => apply(repo, args),
+        Command::Status { porcelain } => status(&repo, porcelain, std::io::stdout().lock()),
+        Command::Continue(args) => {
+            continue_rebase(repo, args.materialize_conflicts.as_ref().map(|path| path.as_deref()))
+        }
+        Command::Stop => {
+            if let Some(warning) = rebase::session::stop(&repo)? {
+                eprintln!("warning: {warning}");
+            }
+            eprintln!("rebase stopped; partial commits, index, and worktree preserved");
+  
```

**File**: `gix-tix/src/edit/head.rs` (modified, +4/-0)
```diff
@@ -223,6 +223,10 @@ fn perform_inner(
         rebase::Perform::Conflict(conflict)
             if pending && kind == Kind::Amend && pending_checkout == rebase::PendingCheckout::FinalizeEditedHead =>
         {
+            gix::error::ensure!(
+                repo.try_find_reference(rebase::session::REF)?.is_none(),
+                "the resolution encounters another conflict; use `tix rebase continue --materialize-conflicts` or continue in the TUI to accept it"
+            );
             conflict.persist(rebase::CheckoutOptions::default())?
         }
         performed => performed.complete()?,
```

**File**: `gix-tix/src/edit/mod.rs` (modified, +5/-1)
```diff
@@ -5,6 +5,10 @@ use gix::{
     error::{OptionExt, ResultExt, bail, message},
 };
 
+pub(crate) fn is_internal_ref(name: &gix::bstr::BStr) -> bool {
+    undo::is_queue_ref(name) || rebase::session::is_ref(name)
+}
+
 #[cfg(test)]
 pub(super) fn loaded_graph(repo: &gix::Repository) -> Result<crate::history::HistoryGraph> {
     if repo.head_id().is_err() {
@@ -18,7 +22,7 @@ pub(super) fn loaded_graph(repo: &gix::Repository) -> Result<crate::history::His
                 .name()
                 .as_bstr()
                 .starts_with(crate::history::REVIEW_STASH_PREFIX)
-            || undo::is_queue_ref(reference.name().as_bstr())
+            || is_internal_ref(reference.name().as_bstr())
             || replay_refs::is_ref(reference.name().as_bstr())
         {
             continue;
```

**File**: `gix-tix/src/edit/rebase.rs` (modified, +85/-19)
```diff
@@ -21,6 +21,7 @@ use super::auto_merge;
 use crate::history::{HistoryGraph, is_missing_ref};
 
 mod merge;
+pub(crate) mod session;
 
 const ORIGINAL_PARENT: &[u8] = b"tix-rebase-parent";
 
@@ -300,6 +301,21 @@ impl PlanConflict {
         self.conflict.prepared.persist_objects()
     }
 
+    pub(crate) fn save_continuation(&mut self, tips: Vec<ObjectId>, operation: &str) -> Result<Vec<u8>> {
+        self.persist_objects()?;
+        let document =
+            super::todo::prepare_continuation(self.repository(), &self.continuation_plan(), tips, true)?.document;
+        let previous = self.conflict.prepared.session.take();
+        self.conflict.prepared.session = Some(session::Publication::pause(
+            previous,
+            self.repository(),
+            self.commit(),
+            document.clone(),
+            operation,
+        )?);
+        Ok(document)
+    }
+
     pub(crate) fn map(&self, id: ObjectId) -> Option<ObjectId> {
         self.rewritten.get(&id).copied().unwrap_or(Some(id))
     }
@@ -549,6 +565,7 @@ struct Prepared {
     enrichment: Option<(&'static str, ObjectId, BString)>,
     continuation: Option<(ObjectId, Vec<ObjectId>)>,
     release_continuation: Option<(ObjectId, Vec<ObjectId>)>,
+    session: Option<session::Publication>,
 }
 
 pub(crate) fn capture_refs(repo: &gix::Repository, scope: &[ObjectId], tips: &[ObjectId]) -> Result<Vec<PlanRef>> {
@@ -565,7 +582,7 @@ pub(crate) fn capture_refs(repo: &gix::Repository, scope: &[ObjectId], tips: &[O
         if matches!(
             reference.name().category(),
             Some(Category::Tag | Category::RemoteBranch)
-        ) || super::undo::is_queue_ref(reference.name().as_bstr())
+        ) || crate::edit::is_internal_ref(reference.name().as_bstr())
             || super::replay_refs::is_ref(reference.name().as_bstr())
         {
             continue;
@@ -973,6 +990,18 @@ fn perform_inner(
     enrichment_headers: Option<EnrichmentEdit<'_>>,
     mut report: impl FnMut(Option<ObjectId>, Progress),
 ) -> Result<(Perform, Option<crate::enrich::Enrichment>)> {
+    let session = if repo.try_find_reference(session::REF)?.is_some() {
+        gix::error::ensure!(
+            matches!(&edit, Edit::Replace { target, .. } if Some(*target) == repo.head()?.id().map(gix::Id::detach))
+                && pending_checkout == PendingCheckout::FinalizeEditedHead
+                && enrichment_headers.is_none(),
+            "a rebase is paused; only conflict-resolution amendments are allowed until it is continued or stopped"
+        );
+        session::Publication::for_amend(repo)?
+    } else {
+        session::ensure_idle(repo)?;
+        None
+    };
     let mut repo = repo.clone();
     let header_only = matches!(enrichment_headers, Some(EnrichmentEdit::Patch(_)));
     let metadata_only = pending_checkout == PendingCheckout::Reject
@@ -1443,6 +1472,7 @@ fn perform_inner(
         enrichment: None,
         continuation: None,
         release_continuation: None,
+        session,
     };
     let enrichment = prepare_enrichment(&mut prepared, enrichment_headers)?;
     let perform = match conflict {
@@ -1756,6 +1786,7 @@ pub(super) fn finish_review_with_progress(
         enrichment,
         continuation: None,
         release_continuation: None,
+        session: None,
     };
     match conflict {
         Some((original, merged_tree, conflicts, commit)) => Ok(Perform::Conflict(Conflict {
@@ -1781,6 +1812,7 @@ pub(crate) fn perform_plan_with_progress(
     checkout_options: CheckoutOptions<'_>,
     mut report: impl FnMut(Progress),
 ) -> Result<PlanPerform> {
+    let session = session::Publication::for_plan(repo, &mut plan)?;
     for step in &plan.steps {
         if step.commit.is_frozen() {
             let commit_id = step.commit.source().expect("a frozen step has a source");
@@ -2282,6 +2314,7 @@ pub(crate) fn perform_plan_with_progress(
             PlanCommit::Resolved(commit_id) => Some((commit_id, plan.scope.clone())),
             _ => None,
         }),
+        session,
     };
     tracing::info!(
         total = progress.total,
@@ -2483,6 +2516,7 @@ impl Prepared {
             .take_object_memory()
             .ok_or_raise(|| message("candidate object memory was unavailable"))?;
 
+        let mut restore_current_tree = self.checkout_tree;
         let checkout_index = if checkout.is_some() {
             let selected = self
                 .selected
@@ -2498,6 +2532,7 @@ impl Prepared {
                 Some(tree_id) => tree_id,
                 None => self.repo.head_commit()?.tree_id()?.detach(),
             };
+            restore_current_tree = Some(old_tree);
             let new_tree = self.repo.find_commit(selected)?.tree_id()?.detach();
             super::delete::preflight_tree_transition(&self.repo, workdir, old_tree, new_tree)?;
             Some(IndexBackup::capture(self.repo.index_path().to_owned())?)
@@ -2576,6 +2611,7 @@ impl Prepared {
                     .collect::<Vec<_>>(),

```

---

### Incident Patch 11: `ee55cb2b` (2026-09-14)
**Commit Message**: fix(gix-tix): confine travel replay to its destination path

Branch and Git-hash travel loaded history without the normal hidden boundary.
Old pending markers in merged ancestry could replay hundreds of commits,
changing identities and metadata even when their file contents stayed intact.
The shared replay engine also reparented siblings and later descendants that
were unrelated to the requested checkout.

Limit travel to editable commits in `HEAD..destination`, plus the destination
itself. This permits refreshing a pending `HEAD` or backward destination while
preserving older shared ancestry, siblings, and commits beyond the destination.
The limit applies even without hidden history and when an explicit view omits
HEAD. Branch and hash resolution now infer the usual hidden boundary, and
hidden or shallow destinations remain exact checkouts.

Keep AutoMerge dependency replay inside the original route, preserving the
bounded change-ID lookup window and treating outside inputs as snapshots.
Collapsing a merge cannot widen later replay passes. Pending boundary parents
remain unchanged, including when accepting and resolving a travel conflict.

Cover CLI resolution, endpoint replay, om

**File**: `gix-tix/spec.md` (modified, +43/-26)
```diff
@@ -137,11 +137,17 @@ without trading responsiveness for metadata that is not visible.
   `--stash` saves them at the departure commit before travelling and restores
   them on return. Automatic review-boundary stashing applies in both modes.
   Its target may also be an unambiguous reverse-hex change-ID prefix from the
-  default Tix view. `parent` and `child` move one edge from `HEAD`; `first` selects its oldest reachable
+  default Tix view. Branch and commit-hash targets use the same inferred hidden
+  history boundaries as change-ID and relative travel. Hidden ancestry remains
+  read-only even when it contains old pending-rebase markers; an explicitly
+  selected hidden commit is checked out without replay. Pending work above the
+  boundary replays only within the departure-to-destination scope described below.
+  `parent` and `child` move one edge from `HEAD`; `first` selects its oldest reachable
   root and `tip` its reachable leaf, considering only commits visible in the
   default view. Multiple direct or terminal candidates are reported with their
   commit and change IDs and must be selected with a direct `tix travel REVSPEC`.
-  Travelling to the current `HEAD` is a no-op.
+  Stashing travel to the current `HEAD` is a no-op; plain travel may replay or
+  refresh that destination itself.
   A detached source may travel to a descendant without a pin, but travelling to
   an ancestor or unrelated commit requires an existing current-worktree pin at
   `HEAD` or a descendant. An attached source is preserved through the singleton
@@ -914,16 +920,16 @@ selection, and submission behavior.
   `Shift-2` carry them through `git checkout --detach <commit>` without forcing
   local changes. Both shortcuts have the same availability and preserve numeric
   input precedence. Stashing travel to the current `HEAD` is a no-op; `@` can
-  still replay a pending `HEAD`.
+  replay a pending `HEAD` or refresh an AutoMerge there. Travel to an ancestor
+  may replay that destination itself but leaves its older ancestry unchanged.
 - Stashing travel uses the existing commit-stash namespace and includes staged,
   unstaged, and untracked changes, preserves the ordinary Git stash stack, and
   leaves ignored files in place. Clean departures create no stash; an existing
   departure stash is never overwritten. Destination validation leaves the source
   unchanged; conflict previews leave local changes at the departure. Saving
-  happens immediately before
-  checkout or replay persistence, so commit rewrites also move the departure
-  stash association. If earlier replay steps already completed, their updates
-  remain and saved changes are restored at the mapped departure before waiting;
+  happens immediately before checkout or replay persistence. If earlier replay
+  steps already completed, their updates remain and saved changes are restored
+  at the departure before waiting;
   consumed departure-stash rewrites are removed from the pending undo record.
   Declining a conflict preview leaves changes at the source;
   acceptance saves them before materializing conflicts. Failure restores the
@@ -1337,21 +1343,25 @@ views.
   exact commit instead of being replayed merely because it is checked out.
 - Edit graph discovery follows refs that point to commits and ignores refs whose
   targets are trees, blobs, or other non-commit objects.
-- Time travel cherry-picks and signs pending editable ancestry through its
-  destination, including pending sides retained beneath finalized ordinary merges
-  and their descendants. Finalized review roots, hidden boundaries, and shallow
-  boundaries stop this traversal. Later non-empty descendants needing tree
-  replay become or remain lazy and unsigned; zero-delta descendants finalize
-  immediately while their parent is final and remain lazy behind a pending parent. Traveling toward
-  a non-pending ancestor leaves the entire pending region untouched. A completed
-  final replay does not reload history;
-  another pass loads only the rewritten path and never unrelated references.
+- Time travel cherry-picks and signs pending editable commits reachable from its
+  destination but not from the departure `HEAD`, plus the destination itself.
+  On divergent branches this is
+  the destination side after their shared ancestry; ordinary merges include all
+  such parent paths, including pending sides beneath finalized merges. Finalized
+  review roots, hidden boundaries, and shallow boundaries further limit replay.
+  All commits outside that scope retain their exact commit IDs and parent links,
+  even when pending. This includes older shared ancestry, off-path siblings,
+  descendants beyond the destination, and the departure unless it is also the
+  destination.
+  Pending commits outside this scope provide their existing trees without replay.
+  A completed final replay does not reload history; another pass loads only the
+  rewritten path and never unrelated references.
   A confli
```

**File**: `gix-tix/src/command/travel.rs` (modified, +299/-3)
```diff
@@ -77,14 +77,20 @@ pub(super) fn run(repository: gix::Repository, args: Args) -> Result<()> {
         _ => bail!("exactly one time-travel destination is required"),
     };
     if selected == head_id {
-        eprintln!("already at {}", crate::change_id::display(&repository, selected, 7)?);
-        return Ok(());
+        let commit = repository.find_commit(selected)?.decode()?.into_owned()?;
+        if args.stash || !crate::edit::rebase::is_pending(&commit) && !crate::edit::auto_merge::is_auto_merge(&commit) {
+            eprintln!("already at {}", crate::change_id::display(&repository, selected, 7)?);
+            return Ok(());
+        }
     }
 
     let revisions = vec![OsString::from("HEAD"), OsString::from(selected.to_string())];
     let graph = match resolved_graph {
         Some(graph) => graph,
-        None => crate::edit::loaded_explicit_view_graph(&repository, &revisions, &[])?,
+        None => {
+            let hidden = crate::history::available_hidden_revisions(&repository, &[], true)?.0;
+            crate::edit::loaded_explicit_view_graph(&repository, &revisions, &hidden)?
+        }
     };
     let forward = graph.is_ancestor(head_id, selected);
     if detached && !forward {
@@ -507,6 +513,296 @@ mod tests {
         Ok(())
     }
 
+    #[test]
+    fn explicit_destinations_respect_inferred_hidden_history() -> gix_testtools::Result {
+        for pending_destination in [false, true] {
+            for revision_kind in ["branch", "hash", "change-id"] {
+                let fixture = gix_testtools::scripted_fixture_writable("rebase_edit.sh")?;
+                let path = fixture.path();
+                let repository = crate::test_repository::open(path)?;
+                // The integrated main branch retains an old pending marker below a final commit.
+                // Source and destination are siblings above main and have identical trees, so only
+                // a pending destination itself needs replay; local index/worktree changes can stay.
+                let mut pending = repository
+                    .find_commit(repository.rev_parse_single("HEAD~1")?)?
+                    .decode()?
+                    .into_owned()?;
+                pending
+                    .extra_headers
+                    .push(("tix-rebase-parent".into(), pending.parents[0].to_string().into()));
+                let pending_commit_id = repository.write_object(&pending)?.detach();
+                let mut boundary = repository.head_commit()?.decode()?.into_owned()?;
+                boundary.parents = [pending_commit_id].into_iter().collect();
+                let boundary_commit_id = repository.write_object(&boundary)?.detach();
+                let mut source = boundary.clone();
+                source.parents = [boundary_commit_id].into_iter().collect();
+                source.message = "source branch".into();
+                let source_commit_id = repository.write_object(&source)?.detach();
+                let mut destination = source;
+                destination.message = "worktree-create".into();
+                if pending_destination {
+                    destination
+                        .extra_headers
+                        .push(("tix-rebase-parent".into(), boundary_commit_id.to_string().into()));
+                }
+                let destination_commit_id = repository.write_object(&destination)?.detach();
+                for (name, commit_id) in [
+                    ("refs/heads/main", boundary_commit_id),
+                    ("refs/heads/merged", pending_commit_id),
+                    ("refs/heads/source", source_commit_id),
+                    ("refs/heads/worktree-create", destination_commit_id),
+                    ("refs/remotes/origin/main", boundary_commit_id),
+                ] {
+                    repository.reference(
+                        name,
+                        commit_id,
+                        gix::refs::transaction::PreviousValue::Any,
+                        "prepare travel",
+                    )?;
+                }
+                if revision_kind == "change-id" {
+                    repository.reference(
+                        "refs/worktree/tix/pins/destination",
+                        destination_commit_id,
+                        gix::refs::transaction::PreviousValue::MustNotExist,
+                        "make the change ID visible in the default view",
+                    )?;
+                }
+                let revision = match revision_kind {
+                    "branch" => "worktree-create".into(),
+                    "hash" => destination_commit_id.to_string(),
+                    _ => crate::change_id::for_commit(&repository, destination_commit_id)?
+                        .to_reverse_hex()
+                        .to_string(),
+                };
+                drop(repository);
+                git(path, &["config", "remote.origin.url", "."])?;
+                git(
+               
```

**File**: `gix-tix/src/edit/auto_merge/mod.rs` (modified, +5/-2)
```diff
@@ -587,6 +587,7 @@ pub(crate) fn prepare(
     affected: &mut Vec<ObjectId>,
     checkout: Option<ObjectId>,
     force: Option<ObjectId>,
+    expand_scope: bool,
 ) -> Result<Preparation> {
     let mut refs = References::for_graph(graph);
     let mut included: HashSet<_> = affected.iter().copied().collect();
@@ -658,7 +659,9 @@ pub(crate) fn prepare(
             }
             let mut seen = HashSet::new();
             while let Some(commit_id) = pending.pop() {
-                if !seen.insert(commit_id) {
+                if !seen.insert(commit_id)
+                    || !expand_scope && (!graph.is_in_edit_scope(commit_id) || graph.is_read_only(commit_id))
+                {
                     continue;
                 }
                 let commit = repo.find_commit(commit_id)?.decode()?.into_owned()?;
@@ -1208,7 +1211,7 @@ pub(crate) fn expand_plan(
             }
         }
     }
-    let preparation = prepare(repo, graph, &mut affected, checkout, None)?;
+    let preparation = prepare(repo, graph, &mut affected, checkout, None, true)?;
     let mut positions = HashMap::new();
     for (index, step) in plan.steps.iter().enumerate() {
         if let Some(commit_id) = step.commit.rewritten_source() {
```

**File**: `gix-tix/src/edit/auto_merge/tests.rs` (modified, +87/-65)
```diff
@@ -687,7 +687,7 @@ fn ordinary_merge_ancestry_visits_every_parent_until_an_auto_merge_boundary() ->
         "AutoMerge input trees remain optional"
     );
     let mut affected = vec![ordinary_commit_id];
-    let preparation = prepare(&repo, &graph, &mut affected, Some(automatic_commit_id), None)?;
+    let preparation = prepare(&repo, &graph, &mut affected, Some(automatic_commit_id), None, true)?;
     assert!(
         preparation.optional.contains(&side_commit_id),
         "a pending secondary parent is replayed before its ordinary merge input"
@@ -1261,7 +1261,7 @@ fn change_lookup_is_bounded_and_retains_ambiguous_or_missing_inputs() -> gix_tes
     view.switch_view(&[a.commit_id, replacement_commit_id], &[base_commit_id]);
     graph.bounded_history = view.bounded_history;
     let mut affected = vec![c.commit_id];
-    let preparation = prepare(&repo, &graph, &mut affected, Some(merge_commit_id), None)?;
+    let preparation = prepare(&repo, &graph, &mut affected, Some(merge_commit_id), None, true)?;
     assert!(
         affected.contains(&merge_commit_id),
         "an exact edit outside the lookup projection still updates its merge"
@@ -1687,8 +1687,8 @@ fn travel_collapse_onto_a_hidden_pending_input_preserves_the_boundary() -> gix_t
 }
 
 #[test]
-fn travel_after_merge_collapse_restores_the_departure_and_keeps_undo_consistent() -> gix_testtools::Result {
-    for accept in [None, Some(false), Some(true)] {
+fn travel_merge_collapse_preserves_pending_departure_and_local_changes() -> gix_testtools::Result {
+    for (conflicting_base, shared_change_id) in [(false, false), (true, false), (false, true), (true, true)] {
         let fixture = gix_testtools::scripted_fixture_writable("auto_merge.sh")?;
         let path = fixture.path();
         let repo = crate::test_repository::open(path)?;
@@ -1706,7 +1706,7 @@ fn travel_after_merge_collapse_restores_the_departure_and_keeps_undo_consistent(
             &repo,
             repo.find_commit(base_commit_id)?.decode()?.into_owned()?,
             "shared",
-            if accept.is_some() { "new base\n" } else { "base\n" },
+            if conflicting_base { "new base\n" } else { "base\n" },
         )?;
         new_base.parents = [base_commit_id].into_iter().collect();
         let new_base_commit_id = repo.write_object(&new_base)?.detach();
@@ -1715,13 +1715,22 @@ fn travel_after_merge_collapse_restores_the_departure_and_keeps_undo_consistent(
         pending
             .extra_headers
             .push(("tix-rebase-parent".into(), base_commit_id.to_string().into()));
-        // Invalidating this stale signature makes the optional replay visibly rewrite the departure.
+        if shared_change_id {
+            // Valid duplicate change IDs must not turn a collapsed input into an editable successor.
+            crate::change_id::inherit(&repo, &mut pending, merge_commit_id)?;
+        }
+        // Any replay would invalidate this signature and visibly rewrite the departure.
         pending.extra_headers.push(("gpgsig".into(), "legacy signature".into()));
         let pending_commit_id = repo.write_object(&pending)?.detach();
+        assert_eq!(
+            crate::change_id::for_commit(&repo, pending_commit_id)?
+                == crate::change_id::for_commit(&repo, merge_commit_id)?,
+            shared_change_id,
+            "the external input has the intended relationship to the AutoMerge's change ID"
+        );
         repo.find_reference(a.reference.as_ref())?
             .set_target_id(pending_commit_id, "prepare the pending departure")?;
-        // The first pass collapses the merge to A, leaving a conflict-free A at HEAD.
-        // If A conflicts, that optional replay stays pending and a second, mandatory pass must report it.
+        // Removing C collapses the merge to its pending departure, which is outside HEAD..destination.
         repo.find_reference(c.reference.as_ref())?.delete()?;
         assert!(
             gix_testtools::git_command(path)
@@ -1742,7 +1751,9 @@ fn travel_after_merge_collapse_restores_the_departure_and_keeps_undo_consistent(
         std::fs::write(path.join("untracked"), b"untracked\n")?;
         let before = gix_testtools::repository::snapshot(path)?;
 
-        let performed = super::super::time_travel::perform(
+        let super::super::time_travel::Perform::Complete {
+            selected, ref_changes, ..
+        } = super::super::time_travel::perform(
             repo.git_dir(),
             false,
             merge_commit_id,
@@ -1753,85 +1764,88 @@ fn travel_after_merge_collapse_restores_the_departure_and_keeps_undo_consistent(
                 stash: true,
                 ..Default::default()
             },
-        )?;
-        let replayed_commit_id = repo.head_id()?.detach();
-        assert_ne!(
-            replayed_commit_id, pending_commit_id,
-            "the first replay already rewrote the departure"
+        )?
+        else {
+            panic!("collapse must
```

**File**: `gix-tix/src/edit/rebase.rs` (modified, +91/-16)
```diff
@@ -84,6 +84,11 @@ pub(crate) enum Edit {
         checkout: ObjectId,
         stash_before_persist: Option<gix::refs::FullName>,
     },
+    Travel {
+        base: ObjectId,
+        checkout: ObjectId,
+        stash_before_persist: Option<gix::refs::FullName>,
+    },
 }
 
 #[derive(Clone, Copy, Debug, Eq, PartialEq)]
@@ -431,6 +436,8 @@ pub(crate) struct Outcome {
     pub notice: Option<String>,
     pub ref_rewrites: Vec<RefRewrite>,
     pub ref_changes: Vec<super::undo::RefChange>,
+    /// Original AutoMerge IDs replaced by an existing input during a shared edit.
+    pub(crate) collapsed: HashSet<ObjectId>,
     pub(super) departure_stash: Option<super::stash::SavedStash>,
     rewritten: HashMap<ObjectId, Option<ObjectId>>,
 }
@@ -526,6 +533,7 @@ struct Prepared {
     selected: Option<ObjectId>,
     notice: Option<String>,
     rewritten: HashMap<ObjectId, Option<ObjectId>>,
+    collapsed: HashSet<ObjectId>,
     note_rewrites: Vec<(ObjectId, ObjectId)>,
     stash_rewritten: HashMap<ObjectId, Option<ObjectId>>,
     stash_before_persist: Option<gix::refs::FullName>,
@@ -980,11 +988,17 @@ fn perform_inner(
             }
             _ => false,
         };
+    let travel = matches!(&edit, Edit::Travel { .. });
     let (repeat_checkout, stash_before_persist) = match &edit {
         Edit::Repeat {
             checkout,
             stash_before_persist,
             ..
+        }
+        | Edit::Travel {
+            checkout,
+            stash_before_persist,
+            ..
         } => (Some(*checkout), stash_before_persist.clone()),
         _ => (None, None),
     };
@@ -1007,7 +1021,7 @@ fn perform_inner(
         }
         Edit::Remove { target } => (Some(target), None, false, false, true, false, None),
         Edit::Split { target, source, upper } => (Some(target), Some(source), false, false, false, false, Some(upper)),
-        Edit::Repeat { base, .. } => (Some(base), None, false, false, false, true, None),
+        Edit::Repeat { base, .. } | Edit::Travel { base, .. } => (Some(base), None, false, false, false, true, None),
     };
     let below = insert_lower.is_some();
     let extra_commits = usize::from(split_upper.is_some() || below);
@@ -1075,9 +1089,34 @@ fn perform_inner(
             &mut affected,
             auto_checkout,
             root.filter(|id| tree_mode == Tree::CherryPick && graph.auto_merges.contains_key(id)),
+            !travel,
         )?
     };
     progress.total = affected.len() + extra_commits + usize::from(inserted && affected.is_empty());
+    let mut frozen_parents = HashSet::new();
+    if travel {
+        gix::error::ensure!(
+            affected.iter().all(|commit_id| graph.is_in_edit_scope(*commit_id)),
+            "time travel cannot rewrite commits outside the destination path"
+        );
+        for commit_id in graph.edit_commit_ids() {
+            frozen_parents.extend(
+                graph
+                    .parents_or_load(&repo, commit_id)?
+                    .into_iter()
+                    .filter(|parent_commit_id| !graph.is_in_edit_scope(*parent_commit_id)),
+            );
+        }
+    }
+    if pending_checkout == PendingCheckout::FinalizeEditedHead
+        && root == checkout
+        && let Some(commit) = replacement
+            .as_ref()
+            .filter(|commit| is_pending(commit) && crate::patch_id::is_unavailable(commit))
+    {
+        // A materialized conflict was prepared against these exact parent trees.
+        frozen_parents.extend(commit.parents.iter().copied());
+    }
     if !inserted && !below && !repeat && !checkout_path.is_empty() {
         let checkout = checkout.expect("a non-empty checkout path has a checkout");
         let review_boundary =
@@ -1091,7 +1130,9 @@ fn perform_inner(
             vec![checkout]
         };
         for id in scan_from {
-            reject_pending_checkout_path(&repo, id, review_boundary, |id| graph.is_in_edit_scope(id))?;
+            reject_pending_checkout_path(&repo, id, review_boundary, |id| {
+                graph.is_in_edit_scope(id) && !frozen_parents.contains(&id)
+            })?;
         }
     }
     validate(
@@ -1100,13 +1141,15 @@ fn perform_inner(
         &affected,
         removed,
         repeat.then_some(root).flatten(),
-        tree_mode,
+        &frozen_parents,
     )?;
 
     repo = repo.with_object_memory();
-    let replay = Replay::new(&repo)?;
+    let mut replay = Replay::new(&repo)?;
+    replay.frozen_parents = frozen_parents;
 
     let mut rewritten = HashMap::<ObjectId, Option<ObjectId>>::new();
+    let mut collapsed = HashSet::new();
     let mut note_rewrites = Vec::new();
     let mut selected = None;
     let mut conflict = None;
@@ -1171,7 +1214,7 @@ fn perform_inner(
         };
         if auto_merge::is_auto_merge(&commit) {
             let eager = !header_only && conflict.is_none() && auto.eager.contains(&old_id);
-            let (new_id, _, _) = replay.auto_merge(
+            let (new_i
```

**File**: `gix-tix/src/edit/rebase/merge/mod.rs` (modified, +6/-0)
```diff
@@ -1,3 +1,5 @@
+use std::collections::HashSet;
+
 use gix::Result;
 use gix::error::{OptionExt as _, ResultExt as _, message};
 
@@ -132,6 +134,7 @@ pub(super) fn parents_pending(
     repo: &gix::Repository,
     commit: &gix::objs::Commit,
     new_parents: &[ObjectId],
+    frozen_parents: &HashSet<ObjectId>,
 ) -> Result<bool> {
     let state = State::read(commit)?;
     let source = state
@@ -145,6 +148,7 @@ pub(super) fn parents_pending(
     let original_parents = &source.as_ref().unwrap_or(commit).parents;
     for (index, parent_commit_id) in mapped.as_deref().unwrap_or(new_parents).iter().enumerate() {
         if original_parents.get(index) != Some(parent_commit_id)
+            && !frozen_parents.contains(parent_commit_id)
             && is_pending(&repo.find_commit(*parent_commit_id)?.decode()?.into_owned()?)
         {
             return Ok(true);
@@ -162,6 +166,7 @@ pub(super) fn rewrite(
     new_parents: &[ObjectId],
     eager: bool,
     resolution: bool,
+    frozen_parents: &HashSet<ObjectId>,
 ) -> Result<TreeRewrite> {
     let previous = State::read(commit)?;
     if previous.is_none() {
@@ -206,6 +211,7 @@ pub(super) fn rewrite(
     for (original_parent_commit_id, parent_commit_id) in source.parents.iter().zip(&state.parents) {
         gix::error::ensure!(
             original_parent_commit_id == parent_commit_id
+                || frozen_parents.contains(parent_commit_id)
                 || !is_pending(&repo.find_commit(*parent_commit_id)?.decode()?.into_owned()?),
             "merge replay requires finalized changed parents"
         );
```

**File**: `gix-tix/src/edit/rebase/merge/tests.rs` (modified, +95/-0)
```diff
@@ -194,6 +194,100 @@ fn unchanged_pending_parents_do_not_block_eager_merge_replay() -> gix_testtools:
     Ok(())
 }
 
+#[test]
+fn travel_replays_merges_against_frozen_pending_parents_and_resolves_conflicts() -> gix_testtools::Result {
+    for conflicting in [false, true] {
+        let fixture = gix_testtools::scripted_fixture_writable("rebase_merge.sh")?;
+        let path = fixture.path();
+        let repo = crate::test_repository::open(path)?;
+        let source_commit_id = branch(&repo, "diamond")?;
+        let source = repo.find_commit(source_commit_id)?.decode()?.into_owned()?;
+        let changed_side_commit_id = changed_tree(
+            &repo,
+            source.parents[1],
+            if conflicting { "shared" } else { "right" },
+            if conflicting {
+                "changed right\n"
+            } else {
+                "right contribution\nright update\n"
+            },
+        )?;
+        let mut pending_side = repo.find_commit(changed_side_commit_id)?.decode()?.into_owned()?;
+        pending_side
+            .extra_headers
+            .push(("tix-rebase-parent".into(), pending_side.parents[0].to_string().into()));
+        let pending_side_commit_id = repo.write_object(&pending_side)?.detach();
+        repo.reference(
+            "refs/heads/frozen-side",
+            pending_side_commit_id,
+            gix::refs::transaction::PreviousValue::MustNotExist,
+            "retain the exact pending departure",
+        )?;
+        let parents = [source.parents[0], pending_side_commit_id];
+        let destination_commit_id = replay_merge(&repo, source_commit_id, &parents, false)?;
+        git(
+            path,
+            &["checkout", "-q", "--detach", &pending_side_commit_id.to_string()],
+        )?;
+        let graph = crate::edit::loaded_graph(&repo)?;
+        let before = gix_testtools::repository::snapshot(path)?;
+        let performed = time_travel::perform(path, false, destination_commit_id, &graph, &[], &[], Default::default())?;
+        if conflicting {
+            let time_travel::Perform::Conflict(conflict) = performed else {
+                return Err("the changed frozen parent must conflict with the recorded resolution".into());
+            };
+            assert_eq!(
+                gix_testtools::repository::snapshot(path)?,
+                before,
+                "a conflict preview keeps the frozen departure and repository untouched"
+            );
+            conflict.accept()?;
+            assert_eq!(
+                branch(&repo, "frozen-side")?,
+                pending_side_commit_id,
+                "accepting the conflict preserves the frozen input reference"
+            );
+            std::fs::write(path.join("shared"), "resolved against frozen side\n")?;
+            git(path, &["add", "shared"])?;
+            let graph = crate::edit::loaded_graph(&repo)?;
+            crate::edit::head::amend_index_reporting(repo.clone(), &graph)?
+                .ok_or_raise(|| message("amend finishes the accepted conflict against the same frozen parent"))?;
+        } else {
+            performed.complete()?;
+        }
+        let result = repo.head_commit()?.decode()?.into_owned()?;
+        assert!(
+            !rebase::is_pending(&result),
+            "the destination merge is fully materialized"
+        );
+        assert_eq!(
+            result.parents.as_slice(),
+            parents,
+            "both clean replay and conflict resolution retain the frozen parent IDs"
+        );
+        assert_eq!(
+            branch(&repo, "frozen-side")?,
+            pending_side_commit_id,
+            "replay and resolution leave the departure reference unchanged"
+        );
+        assert_eq!(
+            repo.find_commit(pending_side_commit_id)?.decode()?.into_owned()?,
+            pending_side,
+            "the pending boundary remains byte-for-byte equivalent"
+        );
+        assert_eq!(
+            std::fs::read(path.join(if conflicting { "shared" } else { "right" }))?,
+            if conflicting {
+                b"resolved against frozen side\n".as_slice()
+            } else {
+                b"right contribution\nright update\n".as_slice()
+            },
+            "the checked-out merge uses the frozen target tree and any explicit resolution"
+        );
+    }
+    Ok(())
+}
+
 #[test]
 fn travel_through_final_merges_finishes_pending_sides_before_amend() -> gix_testtools::Result {
     for with_descendant in [false, true] {
@@ -442,6 +536,7 @@ fn converged_parent_slots_survive_amend_and_a_saved_continuation() -> gix_testto
         &[changed_target, right_commit_id, extra_commit_id],
         true,
         true,
+        &Default::default(),
     ) {
         Err(error) => error,
         Ok(_) => return Err("a resolution cannot silently change its first replay target".into()),
```

**File**: `gix-tix/src/edit/time_travel.rs` (modified, +327/-15)
```diff
@@ -829,6 +829,8 @@ pub(crate) fn perform_reporting_rebased(
     // Keep the creation name as well: rollback reverses any later association rewrites.
     let mut saved: Option<(SavedStash, gix::refs::FullName)> = None;
     let mut ref_changes = Vec::new();
+    let graph = travel_graph(&repository, graph, head_id, selected)?;
+    let graph = &graph;
     let result = (|| -> Result<Perform> {
         let mut completed_graph = None;
         let mut remerge_notice = None;
@@ -842,7 +844,7 @@ pub(crate) fn perform_reporting_rebased(
             let outcome = super::rebase::perform_reporting_rebased(
                 &repository,
                 graph,
-                super::rebase::Edit::Repeat {
+                super::rebase::Edit::Travel {
                     base,
                     checkout: selected,
                     stash_before_persist: stash_name.clone(),
@@ -900,19 +902,31 @@ pub(crate) fn perform_reporting_rebased(
             }
             repository = open_repository(repository_path, bare, false)
                 .or_raise(|| message("could not reopen repository after completing a pending rebase"))?;
+            let mut ids = Vec::new();
+            for commit_id in graph.edit_commit_ids() {
+                let Some(mapped_commit_id) = outcome.map(commit_id) else {
+                    continue;
+                };
+                // A collapsed AutoMerge aliases an input; it does not make that input editable.
+                if outcome.collapsed.contains(&commit_id) {
+                    continue;
+                }
+                ids.push(mapped_commit_id);
+            }
+            let editable: HashSet<_> = ids.iter().copied().collect();
             required = required
                 .into_iter()
                 .filter_map(|commit_id| outcome.map(commit_id))
-                .filter(|commit_id| !graph.is_read_only(*commit_id))
+                .filter(|commit_id| editable.contains(commit_id))
                 .collect();
             pending = pending_base(&repository, selected, &required)?;
             if pending.is_some() {
-                let mut ids: Vec<_> = graph
-                    .edit_commit_ids()
-                    .into_iter()
-                    .filter_map(|id| outcome.map(id))
-                    .collect();
-                ids.extend(rebased.into_iter().filter_map(|(id, _)| outcome.map(id)));
+                gix::error::ensure!(
+                    rebased
+                        .iter()
+                        .any(|(commit_id, _)| outcome.map(*commit_id) != Some(*commit_id)),
+                    "time-travel could not finish the pending destination within its route"
+                );
                 let mut next_graph = history::HistoryGraph::for_commits(&repository, &ids)?;
                 next_graph.bounded_history = graph
                     .bounded_history
@@ -1013,6 +1027,57 @@ pub(crate) fn perform_reporting_rebased(
     }
 }
 
+/// Replay the destination itself and its editable ancestry not already reachable from departure.
+fn travel_graph(
+    repo: &gix::Repository,
+    graph: &history::HistoryGraph,
+    head_commit_id: ObjectId,
+    destination_commit_id: ObjectId,
+) -> Result<history::HistoryGraph> {
+    let shallow = repo
+        .shallow_commits()
+        .or_raise(|| message("could not read shallow travel boundaries"))?;
+    let mut departure = HashSet::new();
+    let mut pending = vec![head_commit_id];
+    while let Some(commit_id) = pending.pop() {
+        if !departure.insert(commit_id) || shallow.as_ref().is_some_and(|ids| ids.contains(&commit_id)) {
+            continue;
+        }
+        match graph.parents_of(commit_id) {
+            Some(parents) => pending.extend(parents),
+            // Explicit views can omit HEAD. Read its missing ancestry without expanding edit scope,
+            // stopping at any already-known unloaded history boundary.
+            None if graph.index(commit_id).is_none() => pending.extend(graph.parents_or_load(repo, commit_id)?),
+            None => {}
+        }
+    }
+    let mut route = HashSet::new();
+    pending.push(destination_commit_id);
+    while let Some(commit_id) = pending.pop() {
+        if departure.contains(&commit_id) && commit_id != destination_commit_id
+            || !graph.is_in_edit_scope(commit_id)
+            || graph.is_read_only(commit_id)
+            || shallow.as_ref().is_some_and(|ids| ids.contains(&commit_id))
+            || !route.insert(commit_id)
+        {
+            continue;
+        }
+        let commit = repo.find_commit(commit_id)?.decode()?.into_owned()?;
+        if super::review::is_review(&commit) && !super::rebase::is_pending(&commit) {
+            continue;
+        }
+        pending.extend(graph.parents_of(commit_id).into_iter().flatten());
+    }
+    let ids = graph
+        .edit_commit_ids()
+        .into_iter()
+        .filter(|commit_id| route.contains(commit_id))
+        .collect::<Vec<_>>()
```

---

### Incident Patch 12: `cc9111f8` (2026-09-14)
**Commit Message**: fix(gix-tix): make finishing reviews undoable

Finishing explicitly cleared undo history, and accepted review-return conflicts
suppressed recording through resolution. Even recording a successful finish
was insufficient for redo: undo restored an active review, whose blanket guard
hid the queue again.

Record the complete finish transaction using the normal undo machinery,
including its checkout, review resources, return pin, and patch approval.
Recognize review-ending entries by the review-reference deletion they already
contain, so they remain reversible across active reviews without a new queue
format. Remove the UI veto and the special conflict-recording suppression.

Keep ordinary edits during active reviews unrecorded and discard stale redo
after those edits. Empty transactions, including cancelled unpublished previews,
leave the queue alone. Cover attached and detached returns, repository reopens,
another active review, edit-and-retry, and grouped return-conflict resolution.
Update the review specification with the undo and redo contract.

Validation: all 764 `gix-tix` tests with `sha1`, workspace formatting checks,
and crate Clippy with warnings denied passed. Tests used no

**File**: `gix-tix/spec.md` (modified, +10/-0)
```diff
@@ -1534,6 +1534,16 @@ views.
   commit even when checkout returns to a descendant. The approval and review-ref
   deletion share the same atomic ref/worktree transaction; cancelling a suspended
   finish publishes neither.
+- Finishing records one undo operation, including the full transplanted history,
+  checkout attachment, review and saved-worktree refs, return pin, and patch
+  approval. Undo restores the clean review state immediately before finishing;
+  redo restores the completed state, including after restarting tix. These
+  review-ending operations remain available while another review is active and
+  after undo restores the finished review. An accepted return-checkout conflict
+  and its resolution share the same undo operation. Cancelling an unpublished
+  preview creates no entry and preserves redo. Starting or cancelling a review
+  still clears undo history; ordinary edits during active reviews remain
+  unrecorded and clear any previous finish's redo history.
 - If the recorded review return ref is missing, finishing leaves the repository
   untouched and limits navigation to visible non-review commits descended from
   the reviewed tip. The reviewed tip is selected initially when visible;
```

**File**: `gix-tix/src/edit/review.rs` (modified, +210/-0)
```diff
@@ -846,6 +846,181 @@ mod tests {
         Ok(())
     }
 
+    fn state_without_undo(path: &Path) -> gix_testtools::Result<gix_testtools::repository::State> {
+        let mut state = gix_testtools::repository::snapshot(path)?;
+        state
+            .references
+            .retain(|reference| !super::super::undo::is_queue_ref(reference.name.as_bstr()));
+        // Undo intentionally retains otherwise unreachable objects. HEAD and ref IDs
+        // still identify the exact commit contents and topology being restored.
+        state.commits.clear();
+        Ok(state)
+    }
+
+    #[test]
+    fn finishing_can_be_undone_and_redone_across_active_reviews_and_reopens() -> gix_testtools::Result {
+        use super::super::undo;
+
+        for (attached_return, another_review) in [(true, false), (false, false), (true, true), (false, true)] {
+            let (fixture, started, _) = review_with_prefix(2)?;
+            let repo = crate::test_repository::open(fixture.path())?;
+            let return_commit_id = repo.find_reference("refs/heads/main")?.id().detach();
+            let tip_commit_id = repo.rev_parse_single("refs/patches/middle")?.detach();
+            let stash_ref = stash_reference(started.reference.as_bstr())?;
+            repo.reference(
+                stash_ref,
+                tip_commit_id,
+                gix::refs::transaction::PreviousValue::MustNotExist,
+                "saved review state",
+            )?;
+            if another_review {
+                let base_commit_id = repo
+                    .find_commit(tip_commit_id)?
+                    .parent_ids()
+                    .next()
+                    .ok_or_raise(|| message("the tip has a base"))?
+                    .detach();
+                repo.reference(
+                    "refs/worktree/tix/review/2",
+                    base_commit_id,
+                    gix::refs::transaction::PreviousValue::MustNotExist,
+                    "another active review",
+                )?;
+            }
+            if !attached_return {
+                let return_ref = return_to(&repo.find_commit(started.commit)?.decode()?.into_owned()?)?
+                    .ok_or_raise(|| message("the review has a return pin"))?;
+                run(
+                    fixture.path(),
+                    &[
+                        "update-ref",
+                        "--no-deref",
+                        return_ref.as_bstr().to_str()?,
+                        &return_commit_id.to_string(),
+                    ],
+                )?;
+            }
+            let before = state_without_undo(fixture.path())?;
+            let graph = super::super::loaded_graph(&repo)?;
+            let Finish::Complete(finished) = finish(repo, &graph, started.commit, None)? else {
+                panic!("the review finishes without conflicts")
+            };
+            let repo = crate::test_repository::open(fixture.path())?;
+            undo::record(&repo, "finish review", &finished.outcome.ref_changes)?
+                .ok_or_raise(|| message("completion creates an undo entry even with another active review"))?;
+            let after = state_without_undo(fixture.path())?;
+            assert_eq!(
+                repo.head()?.referent_name().is_some(),
+                attached_return,
+                "completion restores the recorded attachment"
+            );
+            assert_eq!(
+                (undo::position(&repo)?.undo, undo::position(&repo)?.redo),
+                (1, 0),
+                "completion is presented as one undoable operation"
+            );
+            drop(repo);
+
+            let repo = crate::test_repository::open(fixture.path())?;
+            undo::plan_undo(&repo)?
+                .ok_or_raise(|| message("the persisted finish can be undone"))?
+                .apply(&repo)?;
+            assert_eq!(
+                state_without_undo(fixture.path())?,
+                before,
+                "undo restores commits, resources, approval, attachment, index, and worktree"
+            );
+            assert_eq!(
+                (undo::position(&repo)?.undo, undo::position(&repo)?.redo),
+                (0, 1),
+                "the restored review still presents its finish for redo"
+            );
+            assert!(
+                undo::record(&repo, "cancel unpublished preview", &[])?.is_none(),
+                "an unpublished operation creates no undo entry"
+            );
+            drop(repo);
+
+            let repo = crate::test_repository::open(fixture.path())?;
+            undo::plan_redo(&repo)?
+                .ok_or_raise(|| message("the restored active review can redo its completion after reopening"))?
+                .apply(&repo)?;
+            assert_eq!(
+                state_without_undo(fixture.path())?,
+                after,
+                "redo restores the exact completed state"
+            );
+            assert_eq!(
+                (undo:
```

**File**: `gix-tix/src/edit/undo.rs` (modified, +34/-14)
```diff
@@ -161,7 +161,7 @@ pub(crate) fn is_queue_commit(repo: &gix::Repository, needle: ObjectId) -> Resul
     }
 }
 
-pub(crate) fn review_blocks_undo(repo: &gix::Repository) -> Result<bool> {
+fn has_active_review(repo: &gix::Repository) -> Result<bool> {
     let references = repo.references()?;
     for reference in references.prefixed(crate::history::REVIEW_PREFIX.as_bstr())? {
         let reference = match reference {
@@ -176,6 +176,16 @@ pub(crate) fn review_blocks_undo(repo: &gix::Repository) -> Result<bool> {
     Ok(false)
 }
 
+fn ends_review(changes: &[RefChange]) -> bool {
+    // Completion starts from a clean checkout and records the review resource's
+    // deletion with all checkout changes. That boundary is reversible on either side.
+    changes.iter().any(|change| {
+        crate::history::review_number(change.name.as_bstr()).is_some()
+            && change.before != State::Missing
+            && change.after == State::Missing
+    })
+}
+
 pub(crate) fn clear(repo: &gix::Repository) -> Result<()> {
     let mut edits = Vec::new();
     for name in [TIP_REF, CURSOR_REF] {
@@ -248,14 +258,14 @@ pub(crate) fn changes_from_edits(edits: impl IntoIterator<Item = RefEdit>) -> Re
 /// Returns `None` when all supplied changes cancel each other out.
 pub(crate) fn record(repo: &gix::Repository, title: &str, changes: &[RefChange]) -> Result<Option<ObjectId>> {
     validate_title(title)?;
-    if review_blocks_undo(repo)? {
-        clear(repo)?;
-        return Ok(None);
-    }
     let changes = normalize_changes(changes.iter().cloned())?;
     if changes.is_empty() {
         return Ok(None);
     }
+    if !ends_review(&changes) && has_active_review(repo)? {
+        clear(repo)?;
+        return Ok(None);
+    }
 
     let queue = load(repo)?;
     let (predecessor, old_tip, old_cursor) = match queue {
@@ -279,21 +289,31 @@ pub(crate) fn record(repo: &gix::Repository, title: &str, changes: &[RefChange])
 }
 
 pub(crate) fn position(repo: &gix::Repository) -> Result<Position> {
-    if review_blocks_undo(repo)? {
+    let Some(queue) = load(repo)? else {
+        return Ok(empty_position());
+    };
+    let adjacent = [
+        queue
+            .cursor_index
+            .checked_sub(1)
+            .and_then(|index| queue.entries.get(index)),
+        queue.entries.get(queue.cursor_index),
+    ];
+    if !adjacent.into_iter().flatten().any(|entry| ends_review(&entry.changes)) && has_active_review(repo)? {
         return Ok(empty_position());
     }
-    Ok(load(repo)?.map_or_else(empty_position, |queue| queue.position(queue.cursor_index)))
+    Ok(queue.position(queue.cursor_index))
 }
 
 pub(crate) fn plan_undo(repo: &gix::Repository) -> Result<Option<Plan>> {
-    if review_blocks_undo(repo)? {
-        return Ok(None);
-    }
     let Some(queue) = load(repo)? else { return Ok(None) };
     if queue.cursor_index == 0 {
         return Ok(None);
     }
     let entry = &queue.entries[queue.cursor_index - 1];
+    if !ends_review(&entry.changes) && has_active_review(repo)? {
+        return Ok(None);
+    }
     let changes: Vec<_> = entry.changes.iter().map(RefChange::reversed).collect();
     let cursor = if queue.cursor_index == 1 {
         queue.sentinel
@@ -310,13 +330,13 @@ pub(crate) fn plan_undo(repo: &gix::Repository) -> Result<Option<Plan>> {
 }
 
 pub(crate) fn plan_redo(repo: &gix::Repository) -> Result<Option<Plan>> {
-    if review_blocks_undo(repo)? {
-        return Ok(None);
-    }
     let Some(queue) = load(repo)? else { return Ok(None) };
     let Some(entry) = queue.entries.get(queue.cursor_index) else {
         return Ok(None);
     };
+    if !ends_review(&entry.changes) && has_active_review(repo)? {
+        return Ok(None);
+    }
     Ok(Some(make_plan(
         &queue,
         entry.title.clone(),
@@ -1125,7 +1145,7 @@ mod tests {
         let review = name("refs/worktree/tix/review/1")?;
         set(&repo, review, State::Missing, State::Object(head))?;
         assert!(
-            review_blocks_undo(&repo)?,
+            has_active_review(&repo)?,
             "a valid review reference blocks the ref-only queue"
         );
         assert!(
```

**File**: `gix-tix/src/lib.rs` (modified, +44/-95)
```diff
@@ -160,7 +160,6 @@ struct PendingConflictResolution {
     commit: gix::ObjectId,
     head: Option<ConflictHead>,
     ref_changes: Vec<edit::undo::RefChange>,
-    record_undo: bool,
 }
 
 struct ConflictHead {
@@ -185,7 +184,7 @@ enum ExternalConflictResolution {
     Current,
     Changed,
     Advanced(gix::ObjectId),
-    Complete(gix::ObjectId, Vec<edit::undo::RefChange>, bool),
+    Complete(gix::ObjectId, Vec<edit::undo::RefChange>),
 }
 
 #[derive(Clone, Copy, Debug, Eq, PartialEq)]
@@ -1562,7 +1561,6 @@ fn event_loop(
     let mut pending_worktree_activation = None;
     let mut armed_worktree_removal = None;
     let mut pending_rebase_conflict: Option<edit::time_travel::Conflict> = None;
-    let mut pending_conflict_clear_undo_on_accept = false;
     let mut pending_todo_rebase_conflict: Option<edit::rebase::PlanConflict> = None;
     let mut pending_todo_rebase_plan: Option<edit::rebase::Plan> = None;
     let mut pending_todo_ref_changes = Vec::new();
@@ -3632,15 +3630,13 @@ fn event_loop(
             && pending_todo_rebase_conflict.is_none()
             && app.has_rebase_conflict()
         {
-            let recorded = pending_conflict_resolution.as_mut().and_then(|pending| {
-                pending.record_undo.then(|| {
-                    record_and_clear_pending_undo(
-                        &repository_path,
-                        repository_is_bare,
-                        "materialize time-travel conflict",
-                        &mut pending.ref_changes,
-                    )
-                })
+            let recorded = pending_conflict_resolution.as_mut().map(|pending| {
+                record_and_clear_pending_undo(
+                    &repository_path,
+                    repository_is_bare,
+                    "materialize time-travel conflict",
+                    &mut pending.ref_changes,
+                )
             });
             pending_conflict_resolution = None;
             app.clear_rebase_conflict();
@@ -3653,19 +3649,12 @@ fn event_loop(
         }
         if key_pressed && pending_rebase_conflict.is_some() {
             if action == Some(Action::OpenDiff) && app.changes_focus.is_none() {
-                let clear_undo_on_accept = std::mem::take(&mut pending_conflict_clear_undo_on_accept);
-                let record_undo = !clear_undo_on_accept;
                 let conflict = pending_rebase_conflict
                     .take()
                     .expect("a pending conflict was checked before accepting it");
                 let original = conflict.original();
                 match conflict.accept() {
                     Ok((mut notice, id, _, ref_changes)) => {
-                        if clear_undo_on_accept
-                            && let Err(err) = clear_undo_history(&repository_path, repository_is_bare)
-                        {
-                            notice = format!("{notice}; undo history: {err:#}");
-                        }
                         let head = match conflict_head(&repository_path, repository_is_bare, id) {
                             Ok(head) => Some(head),
                             Err(err) => {
@@ -3677,7 +3666,6 @@ fn event_loop(
                             commit: id,
                             head,
                             ref_changes,
-                            record_undo,
                         });
                         tracing::info!(commit_id = %original, rewritten_id = %id, "accepted suspended rebase conflict");
                         app.begin_conflict_resolution();
@@ -3715,22 +3703,19 @@ fn event_loop(
                 continue;
             }
             if action == Some(Action::Cancel) && app.changes_focus.is_none() {
-                let record_undo = !std::mem::take(&mut pending_conflict_clear_undo_on_accept);
                 let conflict = pending_rebase_conflict
                     .take()
                     .expect("a pending conflict was checked before discarding it");
                 tracing::info!(commit_id = %conflict.original(), "discarded suspended rebase conflict");
                 let mut changes = conflict.into_ref_changes();
-                let recorded = record_undo.then(|| {
-                    record_and_clear_pending_undo(
-                        &repository_path,
-                        repository_is_bare,
-                        "time travel before conflict",
-                        &mut changes,
-                    )
-                });
+                let recorded = record_and_clear_pending_undo(
+                    &repository_path,
+                    repository_is_bare,
+                    "time travel before conflict",
+                    &mut changes,
+                );
                 app.clear_rebase_conflict();
-                if let Some(Err(err)) = recorded {
+                if let Err(err) = recorded {
                     app.leave_attention(format!("cancelled conflict; undo history: {err:#}"));
      
```

---

### Incident Patch 13: `f907ec16` (2026-09-14)
**Commit Message**: fix(gix-tix): preserve commits below a finished review

Finishing a review replaced its parent with the reviewed tip and transplanted
only the review and its descendants. Independent commits inserted below the
review disappeared from the resulting history, even though the review's exact
tree retained their changes.

Find the ordinary ancestor chain exclusive to the review and replay each patch
onto the reviewed tip before attaching the finished review. Preserve change IDs,
authors, messages, Git notes, and references, and reparent affected side history.
The review keeps its exact tree and remains the only newly approved patch.

Reject hidden, pending, nonlinear, or conflicting additions without publishing
changes. A shared merge base remains valid. Cover single and multiple inserted
parents, review and original successors, notes, distinct patches, and atomic
failure, and document the completion behavior.

Validation: all 762 `gix-tix` tests with `sha1`, workspace formatting checks,
and crate Clippy with warnings denied passed. The filesystem-watcher test needs
normal macOS notification access; its sandboxed run times out.

**File**: `gix-tix/spec.md` (modified, +8/-2)
```diff
@@ -1515,8 +1515,14 @@ views.
   affected descendants for lazy replay. Pending ancestry below the review
   boundary remains untouched and does not block the amend.
 - `a r` finishes a selected review when status is completely clean and the current
-  worktree HEAD is the review commit or one of its successors. The
-  review commit is inserted after its reviewed tip with its exact tree, review
+  worktree HEAD is the review commit or one of its successors. Ordinary commits
+  inserted below the review, up to the first ancestor shared with its reviewed
+  tip, are transplanted oldest first onto that tip. Each keeps its own patch,
+  author, message, change ID, and notes; mutable refs and affected descendants
+  follow the rewrite. Hidden, pending, or non-single-parent additions are rejected,
+  and a conflicting transplant leaves the review and checkout unchanged. The
+  shared base may itself be a merge. The review commit follows those additions
+  (or the reviewed tip when there are none) with its exact tree, review
   header removed, updated committer, and configured signature. Review-side
   descendants retain exact trees and are signed without pending markers. With one
   review-side leaf, the reviewed tip's prior descendants are lazily reparented
```

**File**: `gix-tix/src/edit/rebase.rs` (modified, +32/-6)
```diff
@@ -1421,6 +1421,9 @@ pub(super) fn finish_review_with_progress(
     repo = repo.with_object_memory();
     let replay = Replay::new(&repo)?;
 
+    let prefix = super::review::inserted_parents(&repo, graph, review, tip)?;
+    let prefix_set: HashSet<_> = prefix.iter().copied().collect();
+    let root_commit_id = prefix.first().copied().unwrap_or(review);
     let review_descendants = graph
         .descendants_in_parent_order(review)
         .ok_or_raise(|| message("the review commit is not in the loaded history"))?;
@@ -1442,7 +1445,13 @@ pub(super) fn finish_review_with_progress(
             ordinary
         })
         .collect();
-    let mut affected = review_descendants;
+    let mut affected = if prefix.is_empty() {
+        review_descendants
+    } else {
+        graph
+            .descendants_in_parent_order(root_commit_id)
+            .ok_or_raise(|| message("the inserted review ancestry is incomplete"))?
+    };
     affected.extend(
         graph
             .descendants_in_parent_order(tip)
@@ -1451,10 +1460,10 @@ pub(super) fn finish_review_with_progress(
     let mut auto = auto_merge::prepare(&repo, graph, &mut affected, checkout.as_ref().map(|(id, _)| *id), None)?;
     let natural_ids: Vec<_> = affected
         .into_iter()
-        .filter(|id| *id != tip && !review_set.contains(id))
+        .filter(|id| *id != tip && !review_set.contains(id) && !prefix_set.contains(id))
         .collect();
     let mut progress = Progress {
-        total: review_ids.len() + natural_ids.len(),
+        total: prefix.len() + review_ids.len() + natural_ids.len(),
         ..Progress::default()
     };
     report(progress);
@@ -1488,20 +1497,37 @@ pub(super) fn finish_review_with_progress(
     let mut note_rewrites = Vec::new();
     let mut finished_review = None;
     let mut conflict = None;
-    for old in &review_ids {
+    for old in prefix.iter().chain(&review_ids) {
         let old_parents = graph
             .parents_of(*old)
             .ok_or_raise(|| message("a review descendant is incomplete"))?;
         let mut commit = repo.find_commit(*old)?.decode()?.into_owned()?;
-        let new_parents = if *old == review {
+        let new_parents = if *old == root_commit_id {
             vec![tip]
         } else {
             old_parents
                 .iter()
                 .filter_map(|parent| rewritten.get(parent).copied().unwrap_or(Some(*parent)))
                 .collect()
         };
-        commit.parents = new_parents.into_iter().collect();
+        if prefix_set.contains(old) {
+            let replayed = replay.tree(
+                Some(*old),
+                &mut commit,
+                &old_parents,
+                &new_parents,
+                Tree::CherryPick,
+                false,
+                false,
+                Some(&mut progress),
+            )?;
+            gix::error::ensure!(
+                replayed.conflict.is_none(),
+                "added review ancestor {old} conflicts with the reviewed history; the review was left unchanged"
+            );
+        } else {
+            commit.parents = new_parents.into_iter().collect();
+        }
         if *old == review {
             super::review::remove_identity(&mut commit, review_ref.as_bstr());
             marker(&mut commit, false, None);
```

**File**: `gix-tix/src/edit/review.rs` (modified, +382/-1)
```diff
@@ -1,4 +1,4 @@
-use std::path::Path;
+use std::{collections::HashSet, path::Path};
 
 use gix::{
     Error, ObjectId, Result,
@@ -107,6 +107,48 @@ pub(super) fn stash_reference(review: &BStr) -> Result<gix::refs::FullName> {
     .or_raise(|| message("generated an invalid review stash reference"))
 }
 
+/// Ordinary additions between the reviewed history and the review, oldest first.
+pub(super) fn inserted_parents(
+    repo: &gix::Repository,
+    graph: &history::HistoryGraph,
+    review_commit_id: ObjectId,
+    tip_commit_id: ObjectId,
+) -> Result<Vec<ObjectId>> {
+    let mut reviewed_ancestors = HashSet::new();
+    let mut pending = vec![tip_commit_id];
+    while let Some(commit_id) = pending.pop() {
+        if reviewed_ancestors.insert(commit_id) {
+            pending.extend(graph.parents_of(commit_id).unwrap_or_default());
+        }
+    }
+    let mut commit_id = repo
+        .find_commit(review_commit_id)?
+        .parent_ids()
+        .next()
+        .ok_or_raise(|| message("a review commit must have a base"))?
+        .detach();
+    let mut prefix = Vec::new();
+    while !reviewed_ancestors.contains(&commit_id) {
+        gix::error::ensure!(
+            graph.is_in_edit_scope(commit_id) && !graph.is_read_only(commit_id),
+            "added review ancestor {commit_id} is outside editable history"
+        );
+        let commit = repo.find_commit(commit_id)?.decode()?.into_owned()?;
+        gix::error::ensure!(
+            !super::rebase::is_pending(&commit),
+            "added review ancestor {commit_id} has a pending rebase"
+        );
+        gix::error::ensure!(
+            commit.parents.len() == 1 && !is_review(&commit) && !super::auto_merge::is_auto_merge(&commit),
+            "added review ancestor {commit_id} must be an ordinary single-parent commit"
+        );
+        prefix.push(commit_id);
+        commit_id = commit.parents[0];
+    }
+    prefix.reverse();
+    Ok(prefix)
+}
+
 #[tracing::instrument(skip_all, fields(%tip, %base))]
 pub(crate) fn start(
     repository_path: &Path,
@@ -407,6 +449,72 @@ fn remove_new_departure_pin(repository_path: &Path, bare: bool, pin: Option<&his
 mod tests {
     use super::*;
 
+    fn child(repo: &gix::Repository, parent_commit_id: ObjectId, path: &str) -> Result<ObjectId> {
+        let mut commit = repo.find_commit(parent_commit_id)?.decode()?.into_owned()?;
+        let mut tree = repo.find_tree(commit.tree)?.edit()?;
+        tree.upsert(
+            path,
+            gix::objs::tree::EntryKind::Blob,
+            repo.write_blob(format!("{path}\n"))?,
+        )?;
+        commit.tree = tree.write()?.detach();
+        commit.parents = [parent_commit_id].into_iter().collect();
+        commit.message = format!("add {path}\n").into();
+        commit.extra_headers.clear();
+        Ok(repo.write_object(&commit)?.detach())
+    }
+
+    fn review_with_prefix(
+        count: usize,
+    ) -> gix_testtools::Result<(gix_testtools::tempfile::TempDir, Started, Vec<ObjectId>)> {
+        let fixture = gix_testtools::scripted_fixture_writable("rebase_edit.sh")?;
+        let repo = crate::test_repository::open(fixture.path())?;
+        let tip_commit_id = repo.rev_parse_single("HEAD~1")?.detach();
+        let base_commit_id = repo.rev_parse_single("HEAD~2")?.detach();
+        let graph = super::super::loaded_graph(&repo)?;
+        drop(repo);
+        let mut started = start(fixture.path(), false, &graph, tip_commit_id, base_commit_id)?;
+        assert!(started.checkout_error.is_none(), "the review starts successfully");
+
+        let repo = crate::test_repository::open(fixture.path())?;
+        let mut review = repo.find_commit(started.commit)?.decode()?.into_owned()?;
+        let mut tree = repo.find_commit(tip_commit_id)?.tree()?.edit()?;
+        let mut parent_commit_id = base_commit_id;
+        let mut prefix = Vec::new();
+        // Independent additions below the review must remain distinct when it is finished.
+        for number in 0..count {
+            let path = format!("extra-{number}");
+            parent_commit_id = child(&repo, parent_commit_id, &path)?;
+            prefix.push(parent_commit_id);
+            repo.reference(
+                format!("refs/heads/{path}"),
+                parent_commit_id,
+                gix::refs::transaction::PreviousValue::MustNotExist,
+                "retain an inserted review parent",
+            )?;
+            tree.upsert(
+                &path,
+                gix::objs::tree::EntryKind::Blob,
+                repo.write_blob(format!("{path}\n"))?,
+            )?;
+        }
+        tree.upsert(
+            "review-fix",
+            gix::objs::tree::EntryKind::Blob,
+            repo.write_blob("review fix\n")?,
+        )?;
+        review.tree = tree.write()?.detach();
+        review.parents = [parent_commit_id].into_iter().collect();
+        crate::change_id::inherit(&repo, &mut review, started.commit)?;
+        crate::patch_id::r
```

---

### Incident Patch 14: `3932d1d3` (2026-09-14)
**Commit Message**: fix(gix-tix): keep command palette input responsive

Every palette keystroke marked the full view dirty, formatting and measuring
all changed paths even when only the query and matching commands changed.
Large dirty worktrees therefore made ordinary typing noticeably slow.

Retain one terminal-sized background buffer while a command or AutoMerge input
menu is open and reuse it for menu-only redraws. Process these redraws after
normal repository lifecycle and watcher handling. Pending background changes,
resizes, and menu dismissal still redraw the full view, and menu input leaves
the background frame deadline intact so it cannot postpone streaming updates.

Regression coverage compares cached and complete frames across filtering,
expansion, cursor placement, resizing, and updated worktree contents. In a debug
build, eight palette edits over 20,000 changed paths dropped from about 350 ms
to 10 ms. Update `spec.md` with the redraw and detached-buffer lifetime rules.

Validation: `cargo test -p gix-tix --features sha1`, crate formatting, and
Clippy for all crate targets with `sha1` and warnings denied. Tests use
`GIX_TEST_IGNORE_ARCHIVES=1`; macOS filesystem notifications require runn

**File**: `gix-tix/spec.md` (modified, +9/-0)
```diff
@@ -864,6 +864,11 @@ selection, and submission behavior.
   and changes information. Up and Down move the selection,
   `<enter>` executes it, Escape closes the menu, and pasted text edits the query
   instead of invoking history paste behavior.
+- Query edits and menu navigation redraw the overlay from the last rendered
+  background, without repeating worktree status, diff, or changed-path rendering.
+  Background changes and terminal resizing still refresh the complete view;
+  closing or submitting the menu returns to ordinary view drawing. The same
+  behavior applies to the AutoMerge input menu.
 - A displayed prefix key followed by an ASCII space scopes the menu to that
   group: `v ` selects View, `a ` Actions, `n ` Enrich, and `? ` Information.
   With no suffix every available entry in the group matches; further text
@@ -2172,6 +2177,10 @@ views.
 - Redraw is reactive and capped at approximately 60 frames per second while
   streaming. Mouse events are drained and coalesced in bounded batches so input
   storms cannot starve the main loop.
+- An open menu retains one terminal-sized background buffer of detached display
+  cells. Full redraws replace it, resizing invalidates it, and closing the menu
+  releases it. Menu redraws still pass through the event-loop lifecycle boundary
+  and do not postpone background redraws or repository idle deadlines.
 - Main status remains readable regardless of pane focus. Errors are surfaced in
   the nearest relevant status line; diagnostics never replace user-visible
   errors.
```

**File**: `gix-tix/src/lib.rs` (modified, +79/-22)
```diff
@@ -63,7 +63,7 @@ use notify::{RecommendedWatcher, RecursiveMode, Watcher};
 use ratatui::{
     TerminalOptions, Viewport,
     backend::CrosstermBackend,
-    buffer::{CellDiffOption, CellWidth},
+    buffer::{Buffer, CellDiffOption, CellWidth},
     layout::{Position, Rect},
     text::Line,
 };
@@ -1509,6 +1509,7 @@ fn event_loop(
     let mut decorations = Decorations::new();
     let mut ref_tree = ref_tree::Tree::default();
     let mut command_picker = Menu::default();
+    let mut menu_background = None;
     let mut command_picker_key = None;
     let mut prefix_input = prefix_input::State::default();
     let mut filesystem_responses = logging::FilesystemResponses::default();
@@ -1517,6 +1518,7 @@ fn event_loop(
         terminal,
         &mut app,
         &mut command_picker,
+        &mut menu_background,
         &decorations,
         &mailmap,
         &authors,
@@ -1545,6 +1547,7 @@ fn event_loop(
     let mut last_draw = Instant::now();
     let mut dirty = false;
     let mut urgent = false;
+    let mut menu_dirty = false;
     let mut history_finished = false;
     let mut repeat_deadline: Option<Instant> = None;
     let mut history_status_deadline: Option<Instant> = None;
@@ -2598,11 +2601,28 @@ fn event_loop(
             filesystem_responses.phase(&response_ids, "history-refresh-started");
             tracing::info!(?response_ids, "started history refresh");
         }
+        // Menu edits leave the background's draw deadline intact so streaming updates cannot starve.
+        if std::mem::take(&mut menu_dirty)
+            && (dirty
+                || urgent
+                || !redraw_menu(
+                    terminal,
+                    menu_background.as_ref(),
+                    &mut app,
+                    &mut command_picker,
+                    &decorations,
+                )
+                .or_raise(|| message("could not redraw menu"))?)
+        {
+            dirty = true;
+            urgent = true;
+        }
         if urgent {
             let drawn = draw(
                 terminal,
                 &mut app,
                 &mut command_picker,
+                &mut menu_background,
                 &decorations,
                 &mailmap,
                 &authors,
@@ -2720,6 +2740,7 @@ fn event_loop(
                 terminal,
                 &mut app,
                 &mut command_picker,
+                &mut menu_background,
                 &decorations,
                 &mailmap,
                 &authors,
@@ -3422,8 +3443,7 @@ fn event_loop(
             match input {
                 MenuInput::Pass => None,
                 MenuInput::Handled => {
-                    dirty = true;
-                    urgent = true;
+                    menu_dirty = true;
                     continue;
                 }
                 MenuInput::Submit(selection) => Some(Action::ApplyAutoMerge(selection)),
@@ -3439,8 +3459,7 @@ fn event_loop(
             match input {
                 CommandMenuInput::Pass => None,
                 CommandMenuInput::Handled => {
-                    dirty = true;
-                    urgent = true;
+                    menu_dirty = true;
                     continue;
                 }
                 CommandMenuInput::Submit(action) => Some(action),
@@ -6794,11 +6813,62 @@ fn resized_terminal_area<B: ratatui::backend::Backend>(
     Ok(terminal.get_frame().area())
 }
 
+fn redraw_menu<B: ratatui::backend::Backend>(
+    terminal: &mut ratatui::Terminal<B>,
+    background: Option<&(Rect, Buffer)>,
+    app: &mut App,
+    command_picker: &mut Menu<CommandId>,
+    decorations: &Decorations,
+) -> std::result::Result<bool, B::Error> {
+    if !command_picker.is_open() && !app.auto_merge_picker.is_open() {
+        return Ok(false);
+    }
+    let area = resized_terminal_area(terminal)?;
+    let Some((bounds, background)) = background.filter(|(_, buffer)| buffer.area == area) else {
+        return Ok(false);
+    };
+    let cursor = {
+        let mut frame = terminal.get_frame();
+        frame.buffer_mut().clone_from(background);
+        let cursor = draw_active_menu(&mut frame, *bounds, app, command_picker, decorations);
+        prepare_terminal_frame(&mut frame);
+        cursor
+    };
+    terminal.apply_buffer_with_cursor(cursor)?;
+    Ok(true)
+}
+
+fn draw_active_menu(
+    frame: &mut ratatui::Frame<'_>,
+    bounds: Rect,
+    app: &mut App,
+    command_picker: &mut Menu<CommandId>,
+    decorations: &Decorations,
+) -> Option<Position> {
+    if command_picker.is_open() {
+        let commands = command_menu::commands(app, decorations, app.has_verifiable_signatures());
+        command_picker.sync(&command_picker_items(&commands));
+        ui::draw_command_menu(frame, bounds, command_picker, &commands)
+    } else if app.auto_merge_picker.is_open() {
+        ui::draw_menu(
+            frame,
+            bounds,
+            &mut app.auto_merge_picker,
+            app.auto_merge_picker_ti
```

**File**: `gix-tix/src/ui.rs` (modified, +122/-0)
```diff
@@ -3752,6 +3752,128 @@ mod tests {
         Ok(())
     }
 
+    #[test]
+    fn command_menu_input_with_many_worktree_changes() -> gix_testtools::Result {
+        use crossterm::event::{Event, KeyCode, KeyEvent, KeyModifiers};
+        use ratatui::backend::Backend;
+
+        let mut app = App::new(1);
+        app.changes_mode = Some(ChangesMode::Both);
+        let decorations = Decorations::new();
+        let mailmap = gix::mailmap::Snapshot::default();
+        let mut changes = Changes {
+            paths: (0..20_000)
+                .map(|index| crate::app::PathChange {
+                    kind: ChangeKind::Modified,
+                    group: ChangeGroup::Unstaged,
+                    source: None,
+                    path: format!("src/{}/file-{index}.rs", "directory/".repeat(8)).into(),
+                    lines: Some((1, 1)),
+                })
+                .collect(),
+            ..Changes::default()
+        };
+        let commands = command_menu::commands(&app, &decorations, false);
+        let items = crate::command_picker_items(&commands);
+        let mut menu = Menu::default();
+        menu.open(&items);
+        let mut terminal = Terminal::new(TestBackend::new(120, 40))?;
+        let mut background = None;
+        assert!(
+            !crate::redraw_menu(&mut terminal, background.as_ref(), &mut app, &mut menu, &decorations)?,
+            "opening the menu requires a complete background frame"
+        );
+        let draw_full =
+            |terminal: &mut Terminal<TestBackend>, app: &mut App, menu: &mut Menu<CommandId>, changes: &Changes| {
+                let mut background = None;
+                terminal.draw(|frame| {
+                    let area = frame.area();
+                    draw_with_worktree(frame, area, app, &decorations, &mailmap, None, None, Some(changes));
+                    background = Some((area, frame.buffer_mut().clone()));
+                    if let Some(cursor) = crate::draw_active_menu(frame, area, app, menu, &decorations) {
+                        frame.set_cursor_position(cursor);
+                    }
+                    crate::prepare_terminal_frame(frame);
+                })?;
+                Ok::<_, std::convert::Infallible>(background)
+            };
+        background = draw_full(&mut terminal, &mut app, &mut menu, &changes)?;
+        let started = std::time::Instant::now();
+        for ch in "ref-tree".chars() {
+            assert_eq!(
+                crate::command_menu_input(
+                    &Event::Key(KeyEvent::new(KeyCode::Char(ch), KeyModifiers::NONE)),
+                    &mut menu,
+                    &commands,
+                ),
+                crate::CommandMenuInput::Handled,
+                "typing stays inside the command menu"
+            );
+            assert!(
+                crate::redraw_menu(&mut terminal, background.as_ref(), &mut app, &mut menu, &decorations)?,
+                "query edits reuse the rendered worktree without traversing its changed paths"
+            );
+        }
+        eprintln!("eight palette edits over 20,000 changes: {:?}", started.elapsed());
+        assert_eq!(menu.query(), "ref-tree", "every keystroke edits the command query");
+
+        let mut expected = Terminal::new(TestBackend::new(120, 40))?;
+        let _ = draw_full(&mut expected, &mut app, &mut menu, &changes)?;
+        assert_eq!(
+            terminal.backend().buffer(),
+            expected.backend().buffer(),
+            "shrinking the menu restores the exposed background exactly"
+        );
+        assert!(
+            terminal.backend().cursor_visible(),
+            "editing keeps the query cursor visible"
+        );
+        assert_eq!(
+            terminal.backend_mut().get_cursor_position()?,
+            expected.backend_mut().get_cursor_position()?,
+            "cached redraws move the query cursor with the resized menu"
+        );
+        for _ in "ref-tree".chars() {
+            menu.backspace(&items);
+            assert!(
+                crate::redraw_menu(&mut terminal, background.as_ref(), &mut app, &mut menu, &decorations)?,
+                "deleting query text also reuses the background"
+            );
+        }
+        let _ = draw_full(&mut expected, &mut app, &mut menu, &changes)?;
+        assert_eq!(
+            terminal.backend().buffer(),
+            expected.backend().buffer(),
+            "growing the menu leaves no remnants of its smaller layout"
+        );
+
+        terminal.backend_mut().resize(100, 30);
+        assert!(
+            !crate::redraw_menu(&mut terminal, background.as_ref(), &mut app, &mut menu, &decorations)?,
+            "a resize requires a fresh background and layout"
+        );
+        changes.paths.truncate(1);
+        background = draw_full(&mut terminal, &mut app, &mut menu, &changes)?;
+        menu.insert('d', &items);
+        assert!(
+            crate::redraw_menu(&mut terminal, background.as_ref(), &m
```

---

### Incident Patch 15: `5d89748b` (2026-09-13)
**Commit Message**: fix(gix-tix): recover when worktree removal interrupts the UI

An external remover can delete a linked worktree's `HEAD`, `commondir`, or
`gitdir` before its checkout and administration directories disappear. The
lifecycle check only noticed missing directories, so reference refreshes and
view loads could exit while reopening that incomplete repository.

Treat missing administration files as worktree loss and enter the normalized
common repository. Explicitly clear its in-memory worktree path: overriding
`core.bare` alone could retain the main checkout. Recovery leaves that
checkout's `HEAD` and index untouched.

Retry interrupted renders and snapshots through the existing lifecycle
boundary. Keep refresh graphs and distinguish worker requests made before
recovery so late failures reload the surviving history. A disappearing picker
preview becomes unavailable instead of closing the UI. Requests against the
recovered repository still propagate errors normally.

Validation: the new partial-removal regression fails on the previous code.
All 747 library tests, SHA-1 all-target Clippy, and formatting checks passed
from an isolated source copy. Regression fixtures use `gix-testtools` and

**File**: `gix-tix/spec.md` (modified, +8/-2)
```diff
@@ -2103,8 +2103,14 @@ views.
   working directory may have disappeared. Before processing filesystem events or
   redrawing, it lexically normalizes and enters the common repository, reopens it
   as bare, drops worktree state, keeps tree/history views live, and reports recovery
-  in the attention notice. If recovery fails, terminal state is restored and the
-  contextual error is returned.
+  in the attention notice. Missing administrative `HEAD`, `commondir`, or `gitdir`
+  files count as removal even while the checkout and administration directories
+  still exist. View loads interrupted between boundary checks retry after recovery;
+  late history-worker failures return their graph for a refresh from the common
+  repository. A worktree that disappears during picker activation is marked
+  unavailable instead of closing the application. Errors unrelated to removal,
+  including failures from the surviving common repository, still propagate after
+  terminal state is restored.
 
 ## Resource and responsiveness invariants
 
```

**File**: `gix-tix/src/lib.rs` (modified, +356/-27)
```diff
@@ -931,6 +931,13 @@ struct HistoryRefresh {
     worktree: Option<std::result::Result<worktrunk::GraphMetadata, String>>,
 }
 
+struct HistoryRefreshResult {
+    bare: bool,
+    kind: RefreshKind,
+    graph: HistoryGraph,
+    result: Result<HistoryRefresh>,
+}
+
 type WorktreeMetadata = Vec<(usize, std::result::Result<worktrunk::GraphMetadata, String>)>;
 
 #[derive(Clone)]
@@ -1417,6 +1424,7 @@ fn event_loop(
     };
     let mut ref_watch_set_changed = false;
     let mut ref_status_config_changed = false;
+    let initial_history_is_bare = repository_is_bare;
     let (cancelled, receiver) = start_history(
         repository,
         &revisions,
@@ -1449,7 +1457,7 @@ fn event_loop(
         );
     }
     let mut lane_receiver: Option<mpsc::Receiver<(Vec<SharedCommitRow>, app::Graph, Duration)>> = None;
-    let mut refresh_receiver: Option<mpsc::Receiver<(RefreshKind, HistoryGraph, Result<HistoryRefresh>)>> = None;
+    let mut refresh_receiver: Option<mpsc::Receiver<HistoryRefreshResult>> = None;
     let mut refresh_pending = false;
     let mut ref_tree_refresh_pending = false;
     let mut return_to_history_after_refresh = None;
@@ -1505,7 +1513,7 @@ fn event_loop(
     let mut prefix_input = prefix_input::State::default();
     let mut filesystem_responses = logging::FilesystemResponses::default();
     let mut focused = true;
-    draw(
+    let drawn = draw(
         terminal,
         &mut app,
         &mut command_picker,
@@ -1526,6 +1534,13 @@ fn event_loop(
         &mut filesystem_responses,
         picker.as_deref_mut(),
         *picker_focused,
+    );
+    retry_after_worktree_removal(
+        drawn,
+        &repository_path,
+        &common_dir,
+        repository_is_bare,
+        repository_is_bare,
     )?;
     let mut last_draw = Instant::now();
     let mut dirty = false;
@@ -1604,9 +1619,7 @@ fn event_loop(
             ref_watch_set_changed = false;
             ref_status_config_changed = false;
             app.leave_attention("worktree removed; using the common repository without worktree changes");
-            if history_graph.is_some() {
-                refresh_pending = true;
-            }
+            refresh_pending = true;
             dirty = true;
             urgent = true;
         }
@@ -1996,17 +2009,34 @@ fn event_loop(
                             .get(index)
                             .and_then(Clone::clone)
                             .ok_or_raise(|| message("completed worktree preview disappeared"))?;
-                        let mut next_repository = open_repository(&preview.path, false, false)
-                            .or_raise(|| message!("could not open worktree {}", preview.path.display()))?;
+                        let next_repository = open_repository(&preview.path, false, false)
+                            .or_raise(|| message!("could not open worktree {}", preview.path.display()))
+                            .and_then(|repository| {
+                                let unborn = repository.workdir().is_some() && repository.head()?.is_unborn();
+                                std::env::set_current_dir(&preview.path)
+                                    .or_raise(|| message!("could not enter worktree {}", preview.path.display()))?;
+                                Ok((repository, unborn))
+                            });
+                        let (mut next_repository, next_head_unborn) = match next_repository {
+                            Ok(next) => next,
+                            Err(err) => {
+                                app.cancel_preview_refresh(previous_state);
+                                picker.cancel_preview();
+                                picker.set_graph_metadata(index, Err(format!("{err:#}")));
+                                worktree_previews[index] = None;
+                                requested_worktree_preview = None;
+                                lane_receiver = None;
+                                dirty = true;
+                                urgent = true;
+                                continue;
+                            }
+                        };
                         next_repository.object_cache_size(None);
                         let next_repository_path = next_repository.git_dir().to_owned();
                         let next_repository_is_bare = next_repository.workdir().is_none();
                         let next_mailmap = next_repository.open_mailmap();
                         let next_configured_author = configured_author_identity(&next_repository);
-                        let next_head_unborn = !next_repository_is_bare && next_repository.head()?.is_unborn();
                         drop(next_repository);
-                        std::env::set_current_dir(&preview.path)
-                            .or_raise(|| message!("could not enter worktree {}", preview.path.display()))?;
 
                         repository_path = next_repository_path;
             
```

#### Recent Merged Pull Requests:
- **PR #3047** (2026-10-05): fix(gix): resolve HEAD tracking branches and symbolic reflog queries (@Byron)
- **PR #3046** (2026-10-05): Make bstr optional for dependency-free gix-error consumers (@Byron)
- **PR #3045** (2026-10-05): Fix intermittent Windows checkout safety fixture failures (@Byron)
- **PR #3044** (2026-10-05): fix: map packs read-only on Windows so large ones can be opened (@special-bread)
- **PR #3035** (2026-10-02): fix: don't apply the caller's `GIT_INDEX_FILE` or `GIT_WORK_TREE` to a new clone (@any-victor)
- **PR #3034** (2026-10-02): bump the github-actions group with 4 updates (@dependabot[bot])
- **PR #3033** (2026-10-03): gix cli progress cleanup (@Byron)
- **PR #3031** (2026-09-29): Fix UCRT64 discovery and runtime paths for Git for Windows (@Byron)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
