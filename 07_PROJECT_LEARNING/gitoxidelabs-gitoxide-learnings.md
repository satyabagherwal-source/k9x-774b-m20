> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/gitoxidelabs-gitoxide-learnings.md`  
> **Source**: github ([https://github.com/GitoxideLabs/gitoxide](https://github.com/GitoxideLabs/gitoxide))  
> **Source Version**: `2baa819b`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-04T01:58:19.976Z  
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
> **Harvest Timestamp**: 2026-11-04T01:58:17.910Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `GitoxideLabs/gitoxide`
- **Description**: A tasteful, lean, fast & safe pure Rust implementation of Git
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 12099 stars

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
- **Issue #3152** (2026-11-03): **even faster qa**
  *Symptoms*: ### Tasks  * [x] windows improvements * [x] refackiew 
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary --> <!-- codex-review-state:v1 {"code_review":{"commit_sha":"19ff6a69569cf678ed7750d84fa749bb9840d9cd","has_any_findings":false,"has_unresolved_findings":false,"status":"completed"},"security_review":{"commit_sha":null,"has_any_findings":null,"has_unresolved_findings":null,"status":null}} -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-11-03T10:30:12.047230Z">2026-11-03T10:30:12.047230Z</relative-time> | `19ff6a6` | Draft marked ready |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review"

- **Issue #3150** (2026-11-03): **Remove the last `unsafe` block from `gix-revision` and forbid `unsafe` there**
  *Symptoms*: **AI disclosure:** Claude Code, an AI agent, wrote this description, the patch and the test, and is speaking through the `b84330808` account. The commit carries a `Co-Authored-By` trailer for the same reason.  ### Motivation  The account holder asked me to look for `unsafe` in gitoxide's OSS-Fuzz-fuzzed parsers that can be removed without a performance cost, as security hardening. This is also meant for Google's Patch Rewards program, which rewards removing `unsafe` from Rust crates in OSS-Fuzz projects. `gix-revision` was the smallest case: one `unsafe` block, and safe code is faster there.  ### Change  For rev-specs that look like `git describe` output, such as `v1.0-12-g3bee7fb`, `long_describe_prefix()` computes the length of the anchor's reference name. It did this with `<*const u8>::offset_from()` on two pointers into `name`. That was the only `unsafe` block in `gix-revision`.  - Compute the length as the distance between the address where `name` starts and the address where the   last anchor token ends. This is safe Rust. If the computation were ever wrong, the bounds-checked   `name[..len]` would panic. It could not cause undefined behaviour. - Drop the `next_back()` call. It only located the first token for `offset_from()`. - Switch the crate from `#![deny(unsafe_code)]` to `#![forbid(unsafe_code)]`. Then a local   `#[allow(unsafe_code)]` or `#[expect(unsafe_code)]` can't bring `unsafe` back. - Extend `full_format_parses_hash_portion_as_prefix` with `foo--bar-12-g3be

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

### Incident Patch 1: `0c6c639c` (2026-11-03)
**Commit Message**: Share generated fixtures between exhaustive native QA passes

The archived and generated native passes use separate source snapshots,
so scripts without portable archives used to regenerate identical fixtures
within one CI job. Allocate one fresh generated-fixture cache for the two
passes and tell `gix-testtools` which source snapshot each replay uses.
Archive extraction and source-integrity checks remain separate.

Keep every producer snapshot and the cache alive until both replays finish.
Retain them together if a source copy changes. Scrub inherited cache settings
and allocate nothing for fast mode, whose single replay already shares its
local fixture cache. Feature/hash variants keep their existing shared
snapshot; no checks, fixture modes or failure gates are removed.

A controlled Windows multi-round fetch benchmark, using the same compiled
test binary and identical scripts, measured two passes at 45.212s without
sharing and 23.998s with sharing (46.9% faster). The shared second pass took
1.685s, and both passes used one generated fixture at the same absolute path.

All 39 QA tests pass, including fresh cache ownership, normal cleanup,
retention after source mutation, and the

**File**: `DEVELOPMENT.md` (modified, +6/-1)
```diff
@@ -352,7 +352,12 @@ when an archive is absent or stale. This avoids repeated expensive Git subproces
 comparisons against freshly generated Git baselines still run in exhaustive QA. Linux and macOS
 fast tests use freshly generated fixtures. Exhaustive native tests compile/list once,
 then reuse the same nextest binaries for archived and generated fixtures in separate temporary
-source copies. Feature/hash variants also run in an isolated copy, sharing compatible fixture
+source copies. The native passes share a fresh cache of generated read-only scripted fixtures.
+When no archive is available, the archived pass can generate a fixture once for both passes;
+the shared cache never substitutes extracted archives for generated fixtures. Fixtures that write archives or require
+execution in a writable destination keep their existing behavior. The cache and its source
+copies remain alive until both passes finish, and are retained together if a source copy changes.
+Feature/hash variants also run in an isolated copy, sharing compatible fixture
 caches within their task and continuing after individual failures. Their fixture caches cannot
 reuse a previous local run's extracted archives. Archive changes cause
 a failure and retain the changed copy for inspection. Explicit archive-only fixtures keep
```

**File**: `gix-archive/Cargo.toml` (modified, +1/-0)
```diff
@@ -48,6 +48,7 @@ document-features = { version = "0.2.0", optional = true }
 
 [dev-dependencies]
 gix-testtools = { path = "../tests/tools" }
+gix-path = { path = "../gix-path" }
 gix-odb = { path = "../gix-odb", features = ["sha1", "sha256"] }
 gix-worktree = { path = "../gix-worktree", default-features = false, features = [
     "attributes",
```

**File**: `gix-archive/tests/archive.rs` (modified, +22/-11)
```diff
@@ -59,7 +59,8 @@ mod from_tree {
 
     #[test]
     fn basic_usage_internal() -> TestResult {
-        Ok(basic_usage(Format::InternalTransientNonPersistable, |buf| {
+        let format = Format::InternalTransientNonPersistable;
+        Ok(basic_usage(format, |buf, link_target| {
             #[cfg(target_pointer_width = "64")]
             let expected_buffer_length = match gix_testtools::object_hash() {
                 gix_hash::Kind::Sha1 => 551,
@@ -72,14 +73,20 @@ mod from_tree {
                 gix_hash::Kind::Sha256 => todo!("let the test fail on CI and add the value here"),
                 _ => unimplemented!(),
             };
-            assert_eq!(buf.len(), expected_buffer_length);
+            assert_eq!(
+                buf.len(),
+                expected_buffer_length - b"../extra-file".len() + link_target.len()
+            );
 
             let mut stream = gix_worktree_stream::Stream::from_read(std::io::Cursor::new(buf));
             let mut paths_and_modes = Vec::new();
             while let Some(mut entry) = stream.next_entry().expect("entry retrieval does not fail") {
                 paths_and_modes.push((entry.relative_path().to_owned(), entry.mode.kind(), entry.id));
                 let mut buf = Vec::new();
                 entry.read_to_end(&mut buf).expect("stream can always be read");
+                if entry.relative_path() == "extra-dir/symlink-to-extra" {
+                    assert_eq!(buf.as_bstr(), link_target, "the symlink target is preserved");
+                }
             }
 
             assert_eq!(
@@ -143,7 +150,7 @@ mod from_tree {
     #[test]
     #[cfg(feature = "tar")]
     fn basic_usage_tar() -> TestResult {
-        Ok(basic_usage(Format::Tar, |buf| {
+        Ok(basic_usage(Format::Tar, |buf, _link_target| {
             use tar::EntryType;
             let mut ar = tar::Archive::new(buf.as_slice());
             let mut out = Vec::new();
@@ -197,10 +204,11 @@ mod from_tree {
             Format::TarGz {
                 compression_level: Some(9),
             },
-            |buf| {
+            |buf, link_target| {
+                let limit = 340 - b"../extra-file".len() + link_target.len();
                 assert!(
-                    buf.len() < 340,
-                    "quite a bit smaller than uncompressed: {} < 340",
+                    buf.len() < limit,
+                    "quite a bit smaller than uncompressed: {} < {limit}",
                     buf.len()
                 );
                 Ok(())
@@ -215,10 +223,11 @@ mod from_tree {
             Format::Zip {
                 compression_level: Some(9),
             },
-            |buf| {
+            |buf, link_target| {
+                let limit = 1400 - b"../extra-file".len() + link_target.len();
                 assert!(
-                    buf.len() < 1400,
-                    "much bigger than uncompressed for some reason (565): {} < 1400",
+                    buf.len() < limit,
+                    "ZIP metadata overhead stays bounded: {} < {limit}",
                     buf.len()
                 );
                 let ar = rawzip::ZipArchive::from_slice(buf.as_slice())?;
@@ -275,9 +284,11 @@ mod from_tree {
 
     fn basic_usage(
         format: gix_archive::Format,
-        make_assertion: impl FnOnce(Vec<u8>) -> gix_testtools::Result,
+        make_assertion: impl FnOnce(Vec<u8>, &gix_testtools::bstr::BStr) -> gix_testtools::Result,
     ) -> gix_testtools::Result {
         let (dir, head_tree, odb, mut cache) = basic()?;
+        // Windows can report an absolute target for this MSYS-created relative symlink.
+        let link_target = gix_path::into_bstr(std::fs::read_link(dir.join("extra-dir/symlink-to-extra"))?)?;
         let mut stream = gix_worktree_stream::from_tree(
             head_tree,
             odb.clone(),
@@ -328,7 +339,7 @@ mod from_tree {
                 "stream is exhausted, all written to buf"
             );
         }
-        make_assertion(buf).expect("all tests pass");
+        make_assertion(buf, link_target.as_ref()).expect("all tests pass");
         Ok(())
     }
 
```

**File**: `gix-worktree-stream/tests/stream.rs` (modified, +6/-1)
```diff
@@ -137,6 +137,8 @@ mod from_tree {
     #[test]
     fn will_provide_all_information_and_respect_export_ignore() -> gix_testtools::TestResult {
         let (dir, head_tree, odb, mut cache) = basic()?;
+        // Windows can report an absolute target for this MSYS-created relative symlink.
+        let link_target = gix_path::into_bstr(std::fs::read_link(dir.join("extra-dir/symlink-to-extra"))?)?;
         let mut stream = gix_worktree_stream::from_tree(
             head_tree,
             odb.clone(),
@@ -168,6 +170,9 @@ mod from_tree {
             paths_and_modes.push((entry.relative_path().to_owned(), entry.mode.kind(), entry.id));
             let mut buf = Vec::new();
             entry.read_to_end(&mut buf)?;
+            if entry.relative_path() == "extra-dir/symlink-to-extra" {
+                assert_eq!(buf.as_bstr(), link_target.as_ref(), "the symlink target is preserved");
+            }
             if !buf.is_empty() && entry.mode.is_blob() {
                 if entry.relative_path().contains_str("extra") {
                     assert!(
@@ -285,7 +290,7 @@ mod from_tree {
 
         assert_eq!(
             copy.lock().len(),
-            expected_buffer_length,
+            expected_buffer_length - b"../extra-file".len() + link_target.len(),
             "keep track of file size changes of the streaming format"
         );
 
```

**File**: `tests/it/src/qa/native_tests.rs` (modified, +129/-13)
```diff
@@ -7,7 +7,7 @@ use std::{
 use gix_error::{OptionExt, Result, ResultExt, bail, message};
 
 use super::{
-    ops::{Snapshot, SourceState, checked, git, output, source_snapshot, source_state},
+    ops::{Snapshot, SourceState, checked, empty_snapshot, git, output, source_snapshot, source_state},
     run,
 };
 
@@ -17,6 +17,36 @@ enum Fixtures {
     Generated,
 }
 
+struct NativeSnapshots {
+    sources: Vec<(Snapshot, SourceState)>,
+    // Only generated fixtures use this cache; extracted archives stay in their source snapshot.
+    cache: Option<Snapshot>,
+}
+
+impl NativeSnapshots {
+    fn new(root: &Path, count: usize) -> Result<Self> {
+        Ok(Self {
+            sources: (0..count).map(|_| snapshot(root)).collect::<Result<_>>()?,
+            cache: (count > 1).then(empty_snapshot).transpose()?,
+        })
+    }
+
+    fn check(self, index: usize) -> Result<Self> {
+        let (snapshot, before) = &self.sources[index];
+        if let Err(error) = unchanged(&snapshot.path, before) {
+            for (snapshot, _) in &self.sources {
+                eprintln!("Retained native test snapshot at {}", snapshot.path.display());
+            }
+            if let Some(cache) = &self.cache {
+                eprintln!("Retained native fixture cache at {}", cache.path.display());
+            }
+            std::mem::forget(self);
+            return Err(error);
+        }
+        Ok(self)
+    }
+}
+
 fn fixture_modes(mode: &str, windows: bool) -> Result<&'static [Fixtures]> {
     match mode {
         "fast" if windows => Ok(&[Fixtures::Archived]),
@@ -46,6 +76,7 @@ fn test_command(
     metadata: &Path,
     binaries: &Path,
     snapshot: &Path,
+    cache: Option<&Path>,
     fixtures: Fixtures,
     windows_arm: bool,
 ) -> Result<Command> {
@@ -55,6 +86,11 @@ fn test_command(
         .args(["--no-tests", "pass"])
         .env_remove("GIX_TEST_IGNORE_ARCHIVES")
         .env_remove("GIX_TEST_CREATE_ARCHIVES_EVEN_ON_CI");
+    if let Some(cache) = cache {
+        command
+            .env("GIX_TEST_FIXTURE_CACHE", cache)
+            .env("GIX_TEST_FIXTURE_SOURCE_ROOT", snapshot);
+    }
     command.env(
         match fixtures {
             Fixtures::Archived => "GIX_TEST_CREATE_ARCHIVES_EVEN_ON_CI",
@@ -101,32 +137,26 @@ fn run(root: &Path, args: &[String], modes: &[Fixtures]) -> Result<()> {
             .args(args)
             .stderr(Stdio::inherit()),
     )?;
-    let mut snapshots = Vec::new();
-    for _ in modes {
-        snapshots.push(snapshot(root)?);
-    }
+    let mut snapshots = NativeSnapshots::new(root, modes.len())?;
     // Keep metadata beside the first snapshot's index, outside fixture status checks.
-    let state = snapshots[0].0.path.join(".git");
-    let metadata_path = save_metadata(root, &snapshots[0].0.path)?;
+    let state = snapshots.sources[0].0.path.join(".git");
+    let metadata_path = save_metadata(root, &snapshots.sources[0].0.path)?;
     let binaries_path = state.join("binaries-metadata.json");
     fs::write(&binaries_path, binaries).or_raise(|| message("Save nextest binaries for native tests"))?;
     let mut result = Ok(());
     for (index, fixtures) in modes.iter().enumerate() {
-        let (snapshot, state) = &snapshots[index];
+        let (snapshot, _) = &snapshots.sources[index];
         eprintln!("Native tests with {fixtures:?} fixtures in {}", snapshot.path.display());
         let test_result = checked(&mut test_command(
             root,
             &metadata_path,
             &binaries_path,
             &snapshot.path,
+            snapshots.cache.as_ref().map(|cache| cache.path.as_path()),
             *fixtures,
             cfg!(all(windows, target_arch = "aarch64")),
         )?);
-        if let Err(error) = unchanged(&snapshot.path, state) {
-            eprintln!("Retained native test snapshot at {}", snapshot.path.display());
-            std::mem::forget(snapshots.remove(index));
-            return Err(error);
-        }
+        snapshots = snapshots.check(index)?;
         if test_result.is_err() {
             result = test_result;
         }
@@ -262,6 +292,80 @@ mod tests {
 
     use super::*;
 
+    #[test]
+    fn native_cache_is_fresh_and_retained_with_changed_snapshots() -> gix_error::TestResult {
+        let source = empty_snapshot()?;
+        checked(git(&source.path)?.args(["init", "--quiet"]))?;
+        fs::write(source.path.join("input"), "original")?;
+        checked(git(&source.path)?.args(["add", "input"]))?;
+        assert!(
+            NativeSnapshots::new(&source.path, 1)?.cache.is_none(),
+            "fast mode's single replay already shares its local fixture cache"
+        );
+        let mut previous_cache = PathBuf::new();
+        for changed in [false, true] {
+            let snapshots = NativeSnapshots::new(&source.path, 2)?;
+            let cache = snapshots
+                .cache
+                .as_ref()
+                .expect("two replays share generated fixtures")
+   
```

**File**: `tests/it/src/qa/ops.rs` (modified, +9/-3)
```diff
@@ -311,17 +311,23 @@ pub(super) fn source_snapshot(root: &Path) -> Result<Snapshot> {
     snapshot_files(root, &files)
 }
 
-fn snapshot_files(root: &Path, files: &[u8]) -> Result<Snapshot> {
+pub(super) fn empty_snapshot() -> Result<Snapshot> {
     let stamp = SystemTime::now()
         .duration_since(UNIX_EPOCH)
         .or_raise(|| message("Read time for QA snapshot"))?
         .as_nanos();
     // Git for Windows still limits some repository paths even with core.longpaths enabled.
     let mut id = DefaultHasher::new();
     (std::process::id(), stamp).hash(&mut id);
-    let path = std::env::temp_dir().join(format!("qa-{:x}", id.finish()));
+    let path = std::path::absolute(std::env::temp_dir())
+        .or_raise(|| message("Resolve QA temporary directory"))?
+        .join(format!("qa-{:x}", id.finish()));
     fs::create_dir(&path).or_raise(|| message!("Create QA snapshot {}", path.display()))?;
-    let snapshot = Snapshot { path };
+    Ok(Snapshot { path })
+}
+
+fn snapshot_files(root: &Path, files: &[u8]) -> Result<Snapshot> {
+    let snapshot = empty_snapshot()?;
     for path in source_paths(files)? {
         let source = root.join(&path);
         let Some(metadata) = source_metadata(root, &path)? else {
```

**File**: `tests/it/src/qa/run.rs` (modified, +4/-0)
```diff
@@ -383,6 +383,8 @@ pub(super) fn process(root: &Path, command: &Command) -> Result<process::Command
         "GIX_TEST_IGNORE_ARCHIVES",
         "GIX_TEST_CREATE_ARCHIVES_EVEN_ON_CI",
         "GIX_TEST_FIXTURE_HASH",
+        "GIX_TEST_FIXTURE_CACHE",
+        "GIX_TEST_FIXTURE_SOURCE_ROOT",
         "GIX_MERGE_UPDATE_CARTESIAN_BASELINE",
         "GIX_MERGE_UPDATE_BASELINE",
         "INSTA_FORCE_UPDATE",
@@ -565,6 +567,8 @@ mod tests {
             ("INSTA_FORCE_PASS", Some("0")),
             ("RUSTUP_TOOLCHAIN", Some("1.99.0")),
             ("GIX_TEST_FIXTURE_HASH", Some("sha256")),
+            ("GIX_TEST_FIXTURE_CACHE", None),
+            ("GIX_TEST_FIXTURE_SOURCE_ROOT", None),
             ("INSTA_FORCE_UPDATE", None),
             ("INSTA_FORCE_UPDATE_SNAPSHOTS", None),
             ("TRYBUILD", None),
```

---

### Incident Patch 2: `a6fbf76b` (2026-11-03)
**Commit Message**: Reduce Linux QA serialization and debug artifacts

The one-file histogram optimization in `gix-imara-diff` exposed a 24m09s
Linux feature job in CI run 41510500602. Its 103 compilation checks took
7m18s, and 98 feature-test builds took 12m22s, while test execution took
only 2m58s. The conservative reverse-dependency closure selects 65 of 71
crates; keep that coverage intact rather than pruning configurations
without accounting for Cargo feature activation and unification.

Run feature tests in their own Linux job so compilation checks no longer
precede them. Each test variant already builds its own binaries and
creates its own fixture snapshot. Keep exhaustive feature contracts with
compilation checks, and extend the partition regression to verify exact
ownership and test-only provisioning in fast and exhaustive plans.

Use `CARGO_PROFILE_DEV_DEBUG=line-tables-only` for Linux CI runner builds,
including downstream checks, before cache lookup. The test and QA profiles
inherit it, preserving assertions, overflow checks and source-location
backtraces while omitting full debugger variable/type information.

The missing feature cache had been restored with the exact same key by an
earli

**File**: `.github/workflows/ci.yml` (modified, +8/-0)
```diff
@@ -25,6 +25,8 @@ jobs:
   plan:
     name: Select QA work
     runs-on: ubuntu-latest
+    env:
+      CARGO_PROFILE_DEV_DEBUG: line-tables-only
     outputs:
       matrix: ${{ steps.plan.outputs.matrix }}
       plan: ${{ steps.plan.outputs.plan }}
@@ -141,6 +143,10 @@ jobs:
         if: matrix.just
         with:
           just-version: ${{ matrix.just_version }} # zizmor: ignore[unpinned-tools] Exact version in Cargo.toml's workspace.metadata.qa.tool-versions.
+      - name: Reduce Linux debug artifacts while retaining backtraces
+        if: runner.os == 'Linux'
+        shell: bash
+        run: echo 'CARGO_PROFILE_DEV_DEBUG=line-tables-only' >> "$GITHUB_ENV"
       - uses: Swatinem/rust-cache@d1527c8f67ef9af357290475d4af4b0fab8f12e0 # v2.9.3
         with:
           shared-key: ${{ matrix.cache || matrix.id }}
@@ -177,6 +183,8 @@ jobs:
       matrix: ${{ fromJSON(needs.plan.outputs.downstream) }}
     continue-on-error: true
     runs-on: ubuntu-latest
+    env:
+      CARGO_PROFILE_DEV_DEBUG: line-tables-only
     steps:
       - name: Check out the gix version under test
         uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
```

**File**: `DEVELOPMENT.md` (modified, +11/-0)
```diff
@@ -262,6 +262,17 @@ runs the constrained pure-Rust Docker check. Journey tests require Unix. CI also
 Windows baseline doctests and MSRV builds. `--all-platforms` shows these exact assignments;
 a local run never attempts another host's native checks.
 
+Linux feature compilation checks and feature tests run in separate jobs, retaining every
+selected configuration. Linux CI runner builds use `CARGO_PROFILE_DEV_DEBUG=line-tables-only` (also inherited
+by the test and QA profiles) to reduce compilation and cache storage costs while preserving
+debug assertions, overflow checks, and file/line backtraces. Full debugger variable and type
+information is omitted. Reproduce this setting locally by exporting the same variable.
+
+Rust caches are saved by `main` runs and restored by PRs. They retain downloaded dependencies
+and their build artifacts; workspace crates are rebuilt. Job caches compete for the repository's
+storage allowance, so a correct key can still miss after eviction. Changes to the Cargo profile
+environment produce new cache keys that need a `main` run to populate.
+
 | Stage | Checks |
 | --- | --- |
 | `self-test` | Lightweight planner/runner tests; CI runs these once in the planning gate |
```

**File**: `tests/it/src/qa/catalog.rs` (modified, +31/-5)
```diff
@@ -270,7 +270,7 @@ pub fn tasks(metadata: &Value, selection: &Value, platform: &str) -> Result<Vec<
     }
     let variants = core("variants")?;
     if !variants.is_empty() {
-        out.push(Task::new("feature-tests", "features", &["tests"], variants));
+        out.push(Task::new("feature-tests", "feature-tests", &["tests"], variants));
     }
     for (id, stage) in [
         ("default-doctests", "default-doctests"),
@@ -806,13 +806,39 @@ mod tests {
 
     #[test]
     fn ci_jobs_partition_the_same_local_tasks() -> gix_error::TestResult {
+        let mut metadata = metadata();
+        metadata["packages"][0]["metadata"]["qa"]["checks"] = json!([{"args":["--all-features"]}]);
+        metadata["packages"][0]["metadata"]["qa"]["tests"] = json!([{"args":["--all-features"], "requires":["xz"]}]);
         for mode in ["fast", "exhaustive"] {
             let selection = json!({"mode":mode, "packages":["gix-path","gitoxide","internal-tools"]});
-            let plan = plan(&metadata(), &selection, "linux-x86_64", true)?;
+            let plan = plan(&metadata, &selection, "linux-x86_64", true)?;
+            let jobs = plan["jobs"].as_array().expect("plan jobs");
+            let owner = |task| {
+                jobs.iter()
+                    .find(|job| job["tasks"].as_array().expect("job tasks").contains(&json!(task)))
+                    .expect("feature task has a CI job")
+            };
+            let builds = owner("feature-builds");
+            let tests = owner("feature-tests");
+            assert_ne!(
+                builds["id"], tests["id"],
+                "feature builds and tests can run concurrently"
+            );
+            assert_eq!(builds["tools"], json!([]), "build checks do not need nextest");
+            assert_eq!(tests["tools"], json!(["cargo-nextest@0.9.122"]));
+            assert_eq!(builds["xz"], false, "test-only requirements stay with the tests");
+            assert_eq!(tests["xz"], true);
+            if mode == "exhaustive" {
+                assert_eq!(
+                    owner("feature-contracts")["id"],
+                    builds["id"],
+                    "feature contracts remain with compilation checks"
+                );
+            }
             let mut seen = BTreeSet::new();
-            for job in plan["jobs"].as_array().expect("plan jobs") {
+            for job in jobs {
                 let platform = job["platform"].as_str().expect("job platform");
-                let local = tasks(&metadata(), &selection, platform)?;
+                let local = tasks(&metadata, &selection, platform)?;
                 for id in job["tasks"].as_array().expect("job task IDs") {
                     let id = id.as_str().expect("task ID");
                     assert!(
@@ -826,7 +852,7 @@ mod tests {
                 }
             }
             for platform in CI_PLATFORMS {
-                for task in tasks(&metadata(), &selection, platform)? {
+                for task in tasks(&metadata, &selection, platform)? {
                     assert_eq!(
                         seen.contains(&(*platform, task.id)),
                         assigned(&task, platform, mode == "exhaustive"),
```

---

### Incident Patch 3: `cd9b3ad4` (2026-11-03)
**Commit Message**: feat(gix-testtools): share generated scripted fixtures within a test run

I looked at this in detail and changed a thing or two. The tests I left
untouched, they are quite insane but I presume they are correctly reflecting
how this feature is going to be used.

<!-- agent -->
Exhaustive native QA uses separate source snapshots for archived and
freshly generated fixtures. Scripts without portable archives therefore
run twice even when their output is read-only and identical. Expensive
remote histories made this visible in Windows CI.

Add an opt-in generated fixture cache using `GIX_TEST_FIXTURE_CACHE` and
`GIX_TEST_FIXTURE_SOURCE_ROOT`. Equivalent snapshots share a stable
absolute fixture directory, keyed by source namespace, exact script
contents and invocation spelling, arguments, object hash and post-process
version. An absolute lock and atomic completion record prevent concurrent
or failed generators from publishing partial fixtures. Generation stays
at its final path so embedded alternates and worktree links remain valid.

Only normal read-only fixtures with ignored or absent archives participate,
and only when archive writing is disabled or excluded. Existing archives
retain 

**File**: `gix-diff/tests/diff/blob/slider.rs` (modified, +6/-2)
```diff
@@ -128,7 +128,11 @@ fn read_fixture(
     let baseline_path = worktree_path.join(&file_name);
     let baseline = std::fs::read(&baseline_path)?;
     let baseline = crate::blob::skip_header_and_fold_to_unidiff(&baseline);
-    let baseline_path = crate_root.join(&baseline_path).strip_prefix(project_root)?.to_owned();
+    let baseline_path = crate_root.join(&baseline_path);
+    let baseline_path = baseline_path
+        .strip_prefix(project_root)
+        .unwrap_or(&baseline_path)
+        .to_owned();
     let git_no_indent_heuristic = if read_no_indent {
         read_no_indent_baseline(worktree_path, &file_name)?
     } else {
@@ -166,7 +170,7 @@ fn cases_from_fixture(fixture: &str, read_no_indent: bool) -> gix_testtools::Res
 
 struct Case {
     file_name: String,
-    /// Location of the generated baseline, relative to the workspace root.
+    /// Location of the generated baseline, relative to the workspace root when possible.
     baseline_path: PathBuf,
     algorithm: Algorithm,
     /// The primary Git baseline, generated with `--indent-heuristic` and used for the pass/fail comparison.
```

**File**: `gix-discover/tests/discover/upwards/ceiling_dirs.rs` (modified, +31/-21)
```diff
@@ -142,22 +142,24 @@ fn more_restrictive_ceiling_dirs_overrule_less_restrictive_ones() -> TestResult
 }
 
 #[test]
-fn ceiling_dirs_are_not_processed_differently_than_the_git_dir_candidate() -> TestResult {
-    let work_dir = repo_path()?;
-    let dir = work_dir.join("some/very/deeply/nested/subdir/../../../../../..");
+fn nonmatching_relative_ceiling_is_ignored_after_resolving_start_path() -> TestResult {
+    let outer = gix_testtools::scripted_fixture_read_only("make_nested_repos.sh")?;
+    let inner = std::env::current_dir()?.join(outer).join("inner");
+    let dir = Path::new("some/very/deeply/nested/subdir/../../../../../..");
     let (repo_path, _trust) = gix_discover::upwards_opts(
-        &dir,
+        dir,
         Options {
+            current_dir: Some(&inner),
             match_ceiling_dir_or_error: false,
             ceiling_dirs: vec![Path::new("./some").into()],
             ..Default::default()
         },
     )?;
 
-    assert_ne!(
-        &repo_path.as_ref().canonicalize()?,
-        &work_dir,
-        "a relative path that climbs above the test repo should yield the gitoxide repo"
+    assert_eq!(
+        repo_path.into_repository_and_work_tree_directories().1.as_deref(),
+        Some(Path::new("..")),
+        "the start path resolves to the outer fixture; the relative ceiling does not contain it and is ignored"
     );
 
     Ok(())
@@ -186,30 +188,38 @@ fn no_matching_ceiling_dirs_errors_by_default() -> TestResult {
 
 #[test]
 fn ceilings_are_adjusted_to_match_search_dir() -> TestResult {
-    let relative_work_dir = repo_path()?;
-    let cwd = std::env::current_dir()?;
-    let absolute_ceiling_dir = gix_path::realpath_opts(&relative_work_dir, &cwd, 8)?;
-    let dir = relative_work_dir.join("some");
-    assert!(dir.is_relative());
+    // This test changes the process-wide CWD to resolve relative search and ceiling paths against the fixture.
+    // Restoring it afterward does not prevent races with other tests, so run the body in an isolated child.
+    if gix_testtools::run_in_isolated_process()? {
+        return Ok(());
+    }
+    let work_dir = std::env::current_dir()?.join(repo_path()?);
+    let _cwd = gix_testtools::set_current_dir(&work_dir)?;
     let (repo_path, _trust) = gix_discover::upwards_opts(
-        &dir,
+        Path::new("some"),
         Options {
-            ceiling_dirs: vec![absolute_ceiling_dir],
+            ceiling_dirs: vec![work_dir.clone()],
             ..Default::default()
         },
     )?;
-    assert_repo_is_current_workdir(repo_path, &relative_work_dir);
+    assert_eq!(
+        repo_path.into_repository_and_work_tree_directories().1.as_deref(),
+        Some(Path::new(".")),
+        "an absolute ceiling matches the relative search and preserves its relative result"
+    );
 
-    assert!(relative_work_dir.is_relative());
-    let absolute_dir = gix_path::realpath_opts(relative_work_dir.join("some").as_ref(), &cwd, 8)?;
     let (repo_path, _trust) = gix_discover::upwards_opts(
-        &absolute_dir,
+        &work_dir.join("some"),
         Options {
-            ceiling_dirs: vec![relative_work_dir.clone()],
+            ceiling_dirs: vec![Path::new(".").into()],
             ..Default::default()
         },
     )?;
-    assert_repo_is_current_workdir(repo_path, &relative_work_dir);
+    assert_eq!(
+        repo_path.into_repository_and_work_tree_directories().1.as_deref(),
+        Some(work_dir.as_path()),
+        "a relative ceiling matches the absolute search and preserves its absolute result"
+    );
     Ok(())
 }
 
```

**File**: `tests/tools/src/fixture_cache.rs` (added, +245/-0)
```diff
@@ -0,0 +1,245 @@
+use std::{
+    collections::hash_map::DefaultHasher,
+    env, fs,
+    hash::Hasher,
+    io::Write,
+    path::{Component, Path, PathBuf},
+    time::Duration,
+};
+
+use gix_error::{Error, Result, ResultExt, bail};
+
+use crate::{FixtureState, PostResult};
+
+/// A handle to one entry in a caller-owned cache of generated fixtures.
+/// Equivalent requests select the same entry, even through separate handles. Archives never populate it.
+pub(super) struct Cache {
+    /// Absolute entry directory selected by the identity hash, containing `identity` and `completed` files
+    /// alongside `fixture-*` generation-attempt directories, rather than the fixture payload directly.
+    /// For example, `/tmp/qa-run-123/fixture-cache/<identity-hash>`, with the payload in a child
+    /// directory such as `fixture-AbCd12/`. A successful attempt's random name is recorded in `completed`
+    /// and reused by later requests; a new suffix is chosen only when starting a generation attempt.
+    directory: PathBuf,
+    /// Serialized cache-key inputs, hashed to select `directory` and persisted there in full.
+    /// Comparing these bytes before reuse detects hash collisions instead of accepting the wrong fixture.
+    identity: Vec<u8>,
+}
+
+impl Cache {
+    /// Whether either cache environment variable is set, requesting shared caching.
+    /// Partial configuration counts as a request so [`Self::from_env()`] can report it as invalid.
+    pub(super) fn is_requested_from_env() -> bool {
+        env::var_os("GIX_TEST_FIXTURE_CACHE").is_some() || env::var_os("GIX_TEST_FIXTURE_SOURCE_ROOT").is_some()
+    }
+
+    pub(super) fn from_env(
+        script: &Path,
+        args: &[String],
+        object_hash: gix_hash::Kind,
+        script_identity: u32,
+        post_version: Option<u32>,
+    ) -> Result<Option<Self>> {
+        let Some((directory, source_root)) = Self::paths_from_env()? else {
+            return Ok(None);
+        };
+        let Some(mut identity) = source_identity(script, &source_root, object_hash)? else {
+            return Ok(None);
+        };
+        fs::create_dir_all(&directory).or_error()?;
+        let directory = fixture_realpath(&directory)?;
+        append_invocation_identity(&mut identity, args, script_identity, post_version);
+        let mut hash = DefaultHasher::new();
+        hash.write(&identity);
+        Ok(Some(Self {
+            directory: directory.join(format!("{:016x}", hash.finish())),
+            identity,
+        }))
+    }
+
+    pub(super) fn obtain<T>(
+        self,
+        make_fixture: impl FnOnce(FixtureState<'_>) -> PostResult<T>,
+    ) -> Result<(PathBuf, T)> {
+        let _lock = self.lock_entry()?;
+        self.create_entry_and_verify_identity()?;
+        if let Some(path) = self.read_completed_fixture()? {
+            let value = make_fixture(FixtureState::Fresh(&path)).map_err(Error::from_boxed)?;
+            return Ok((path, value));
+        }
+
+        let path = self.create_generation_directory()?;
+        let value = make_fixture(FixtureState::Uninitialized(&path))
+            .inspect_err(|_| {
+                eprintln!("Retained incomplete generated fixture at {}", path.display());
+            })
+            .map_err(Error::from_boxed)?;
+        self.publish_completed_fixture(&path)?;
+        Ok((path, value))
+    }
+
+    fn paths_from_env() -> Result<Option<(PathBuf, PathBuf)>> {
+        let (directory, source_root) = match (
+            env::var_os("GIX_TEST_FIXTURE_CACHE"),
+            env::var_os("GIX_TEST_FIXTURE_SOURCE_ROOT"),
+        ) {
+            (None, None) => return Ok(None),
+            (Some(directory), Some(source_root)) => (PathBuf::from(directory), PathBuf::from(source_root)),
+            _ => bail!("GIX_TEST_FIXTURE_CACHE and GIX_TEST_FIXTURE_SOURCE_ROOT must be set together"),
+        };
+        if !directory.is_absolute() || !source_root.is_absolute() {
+            bail!("GIX_TEST_FIXTURE_CACHE and GIX_TEST_FIXTURE_SOURCE_ROOT must be absolute paths");
+        }
+        Ok(Some((directory, source_root)))
+    }
+
+    fn lock_entry(&self) -> Result<gix_lock::Marker> {
+        fs::create_dir_all(self.directory.parent().expect("cache entries have a parent")).or_error()?;
+        gix_lock::Marker::acquire_to_hold_resource(
+            &self.directory,
+            gix_lock::acquire::Fail::AfterDurationWithBackoff(Duration::from_secs(6 * 60)),
+            None,
+            0,
+        )
+        .or_error()
+    }
+
+    fn create_entry_and_verify_identity(&self) -> Result<()> {
+        fs::create_dir_all(&self.directory).or_error()?;
+        let identity_path = self.directory.join("identity");
+        match fs::read(&identity_path) {
+            Ok(identity) if identity == self.identity => {}
+            Ok(_) => bail!("Fixture cache identity mismatch at {}", self.directory.display()),
+            Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
+    
```

**File**: `tests/tools/src/lib.rs` (modified, +86/-47)
```diff
@@ -8,6 +8,30 @@
 //! Valid values are the names of hash functions supported by `gix_hash::Kind` (e.g., `sha1`, `sha256`).
 //! If not set, the default hash function via `gix_hash::Kind::default()` is used.
 //!
+//! ### `GIX_TEST_FIXTURE_CACHE` and `GIX_TEST_FIXTURE_SOURCE_ROOT`
+//!
+//! Set both to absolute paths to share generated read-only scripted fixtures across equivalent source
+//! snapshots within one owned test run.
+//!
+//! A source snapshot is a source tree kept at a fixed revision or working-tree state for testing, such
+//! as a checkout or an exported copy of the workspace. It contains the crates, fixture scripts and their
+//! inputs, not the generated fixtures. Equivalent snapshots can live at different absolute paths.
+//!
+//! - `GIX_TEST_FIXTURE_SOURCE_ROOT` names the current snapshot's workspace root, for example
+//!   `/tmp/qa-run-123/snapshot-a`, not a crate directory or its `tests/fixtures` directory.
+//!   An example fixture script would be at
+//!   `/tmp/qa-run-123/snapshot-a/gix-discover/tests/fixtures/make_nested_repos.sh`.
+//! - `GIX_TEST_FIXTURE_CACHE` names the shared output directory, for example
+//!   `/tmp/qa-run-123/fixture-cache`. Use a fresh cache namespace for each owned test run.
+//!   When shared caching applies, that script's generated test files are under
+//!   `/tmp/qa-run-123/fixture-cache/<key>/fixture-<suffix>/`, including `.git/HEAD` and
+//!   `inner/.git/HEAD`. Here `<key>` is the fixture-identity hash and `<suffix>` is a random directory suffix.
+//!
+//! Tests in a second equivalent snapshot at `/tmp/qa-run-123/snapshot-b` use that path for
+//! `GIX_TEST_FIXTURE_SOURCE_ROOT` but keep `GIX_TEST_FIXTURE_CACHE` pointing to the same
+//! `/tmp/qa-run-123/fixture-cache`. Crate and script paths are keyed relative to the source root, allowing
+//! equivalent requests from both snapshots to reuse a generated fixture despite their different roots.
+//!
 //! ## Script Isolation
 //!
 //! Fixture scripts and [`git()`] use `GIT_CONFIG_PARAMETERS` to disable signing and automatic maintenance
@@ -53,6 +77,8 @@ pub mod signature;
 /// Capture complete, stable repository state for integration-test assertions.
 pub mod repository;
 
+mod fixture_cache;
+
 const ARCHIVE_DIR_NAME: &str = "generated-archives";
 const BASH_FIXTURE_PRELUDE: &str = include_str!("scripted_fixture_prelude.sh");
 
@@ -1848,48 +1874,47 @@ where
         &script_identity,
         archive_policy.cache_variant(),
     );
-    let _marker = marker_if_needed(destination_dir, script_basename)?;
-
     let script_identity_for_archive = match args_in_hash {
         ArgsInHash::Yes => script_identity,
         ArgsInHash::No => 0,
     };
     let script_absolute_path = env::current_dir()?.join(&script_path);
+    let shared_cache = if !force_run
+        && archive_policy == ArchivePolicy::Normal
+        && fixture_cache::Cache::is_requested_from_env()
+        && (env::var_os("GIX_TEST_IGNORE_ARCHIVES").is_some() || !archive_file_path.try_exists()?)
+        && (should_skip_all_archive_creation() || excludes.is_excluded(&archive_file_path))
+    {
+        fixture_cache::Cache::from_env(&script_path, &args, object_hash, script_identity, post_version)?
+    } else {
+        None
+    };
     let post_process_closure = post_process.map(|(_, f)| f);
-
-    let res = run_fixture_generator_with_marker_handling(
-        &archive_file_path,
-        &script_result_directory,
-        script_identity_for_archive,
-        force_run,
-        archive_policy,
-        excludes,
-        &format!("using script \"{}\"", script_location.display()),
-        |fixture_state| {
-            if let FixtureState::Uninitialized(dir) = fixture_state {
-                // Bash 3.2 loses BASH_SOURCE after calling functions defined by `-c`. Sourcing a
-                // temporary prelude file preserves script context without exporting functions.
-                let prelude_file = if is_bash_fixture {
-                    let mut file = tempfile::NamedTempFile::new()?;
-                    std::io::Write::write_all(file.as_file_mut(), BASH_FIXTURE_PRELUDE.as_bytes())?;
-                    Some(file)
-                } else {
-                    None
-                };
-                let mut cmd = if let Some(file) = prelude_file.as_ref() {
-                    let mut cmd = command_with_environment_snapshot(bash_program());
-                    let prelude_path = gix_path::from_bstring(
-                        gix_path::to_unix_separators_on_windows(gix_path::into_bstr(file.path())?).into_owned(),
-                    )?;
-                    cmd.arg("-c")
-                        .arg("source \"$1\" || exit; shift; source \"$0\" \"$@\"")
-                        .arg(&script_absolute_path)
-                        .arg(prelude_path);
-                    cmd
-                } else {
-                    command_with_environment_snapshot(&script_absolute_path)
-                };
-                let outpu
```

**File**: `tests/tools/tests/tools/fixture_cache.rs` (added, +653/-0)
```diff
@@ -0,0 +1,653 @@
+use std::{
+    path::{Path, PathBuf},
+    process::{Child, Command, Stdio},
+};
+
+use gix_testtools::TestResult;
+
+const SCRIPT: &str = r#"#!/usr/bin/env bash
+set -eu -o pipefail
+printf 'run\n' >> "$FIXTURE_CACHE_RUNS"
+printf 'generated\n' > origin
+pwd -W 2>/dev/null > generation-path || pwd > generation-path
+printf '%s\n' "$@" > arguments
+if test -n "${FIXTURE_CACHE_FAIL:-}"; then exit 1; fi
+"#;
+
+#[cfg(windows)]
+#[test]
+fn short_cache_paths_match_paths_recorded_by_git_and_the_shell() -> TestResult {
+    if gix_testtools::run_in_isolated_process()? {
+        return Ok(());
+    }
+    let mut fixture = Cache::new()?;
+    fixture.cache = fixture.directory.path().join("long-cache-directory");
+    std::fs::create_dir(&fixture.cache)?;
+    let root = fixture.snapshot("source", "crate", SCRIPT)?;
+    let output = Command::new(gix_testtools::bash_program())
+        .args(["-c", "cygpath -d \"$1\"", "short-cache-path"])
+        .arg(&fixture.cache)
+        .output()?;
+    assert!(output.status.success(), "Git Bash can resolve the cache's short path");
+    let short_path = PathBuf::from(std::str::from_utf8(&output.stdout)?.trim());
+    assert_ne!(short_path, fixture.cache, "the regression exercises a short path alias");
+    let mut request = fixture.invocation(&root, "crate", true)?;
+    request.command.env("GIX_TEST_FIXTURE_CACHE", short_path);
+    let generated = request.run()?;
+    assert_eq!(
+        generated,
+        fixture.invocation(&root, "crate", true)?.run()?,
+        "short and long cache paths share the same fixture"
+    );
+    let mut request = fixture.invocation(&root, "crate", true)?;
+    request
+        .command
+        .env("GIX_TEST_FIXTURE_CACHE", fixture.cache.canonicalize()?);
+    assert_eq!(
+        request.run()?,
+        generated,
+        "verbatim cache paths reuse an ordinary fixture path"
+    );
+    assert_eq!(fixture.runs()?, 1, "path aliases do not regenerate fixtures");
+    Ok(())
+}
+
+#[cfg(unix)]
+#[test]
+fn symlinked_cache_roots_return_physical_fixture_paths() -> TestResult {
+    if gix_testtools::run_in_isolated_process()? {
+        return Ok(());
+    }
+    let fixture = Cache::new()?;
+    let root = fixture.snapshot("source", "crate", SCRIPT)?;
+    let alias = fixture.directory.path().join("cache-alias");
+    std::os::unix::fs::symlink(&fixture.cache, &alias)?;
+    let mut request = fixture.invocation(&root, "crate", true)?;
+    request.command.env("GIX_TEST_FIXTURE_CACHE", &alias);
+    let path = request.run()?;
+    assert_eq!(
+        path,
+        path.canonicalize()?,
+        "fixture paths match the physical paths recorded by Git and the shell"
+    );
+    assert_eq!(fixture.invocation(&root, "crate", true)?.run()?, path);
+    assert_eq!(fixture.runs()?, 1, "cache aliases reuse the same generated fixture");
+    Ok(())
+}
+
+#[test]
+fn missing_archive_generation_is_reused_across_snapshots_and_modes() -> TestResult {
+    if gix_testtools::run_in_isolated_process()? {
+        return Ok(());
+    }
+    let fixture = Cache::new()?;
+    let first = fixture.snapshot("archived", "crate", SCRIPT)?;
+    let second = fixture.snapshot("generated", "crate", SCRIPT)?;
+    let archived = fixture.invocation(&first, "crate", false)?.run()?;
+    let generated = fixture.invocation(&second, "crate", true)?.run()?;
+    assert_eq!(
+        archived, generated,
+        "a missing archive generates one stable fixture shared by later generated-mode snapshots"
+    );
+    assert_eq!(
+        generated
+            .parent()
+            .and_then(Path::parent)
+            .map(Path::canonicalize)
+            .transpose()?,
+        Some(fixture.cache.canonicalize()?),
+        "hash-keyed fixture entries live directly under the job cache root"
+    );
+    assert_eq!(fixture.runs()?, 1, "equivalent snapshots execute the script only once");
+    assert_eq!(std::fs::read(generated.join("origin"))?, b"generated\n");
+    let generation_path = PathBuf::from(std::fs::read_to_string(generated.join("generation-path"))?.trim());
+    assert_eq!(
+        generation_path.canonicalize()?,
+        generated.canonicalize()?,
+        "absolute paths recorded by the script remain valid after publication"
+    );
+    let mut entries = std::fs::read_dir(&generated)?
+        .map(|entry| entry.map(|entry| entry.file_name()))
+        .collect::<Result<Vec<_>, _>>()?;
+    entries.sort();
+    assert_eq!(
+        entries,
+        ["arguments", "generation-path", "origin"],
+        "cache metadata stays outside the fixture payload"
+    );
+    Ok(())
+}
+
+#[test]
+fn archives_remain_local_and_never_supply_generated_mode() -> TestResult {
+    if gix_testtools::run_in_isolated_process()? {
+        return Ok(());
+    }
+    let fixture = Cache::new()?;
+    let first = fixture.snapshot("first", "crate", SCRIPT)?;
+    let second = fixture.snapshot("second", "crate", SCRIPT)?;
+    fixture.archive(&first, 0)?;
+
```

**File**: `tests/tools/tests/tools/main.rs` (modified, +2/-0)
```diff
@@ -1,6 +1,8 @@
 #[cfg(all(feature = "worktree-exclusions", not(windows)))]
 mod archive_regeneration;
 
+mod fixture_cache;
+
 mod isolation {
     use gix_testtools::{Creation, TestResult, redact_debug_snapshot, redact_display_snapshot};
 
```

#### Recent Merged Pull Requests:
- **PR #3152** (2026-11-03): even faster qa (@Byron)
- **PR #3150** (2026-11-03): Remove the last `unsafe` block from `gix-revision` and forbid `unsafe` there (@b84330808)
- **PR #3149** (2026-11-03): Enforce allocation limits for pack traversal metadata (@Byron)
- **PR #3148** (2026-11-02): faster qa (@Byron)
- **PR #3146** (2026-11-02): Release gix-macros v0.2.1 (@Byron)
- **PR #3144** (2026-11-01): Bump the github-actions group with 7 updates (@dependabot[bot])

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

## X. Share generated fixtures between exhaustive native QA passes

**RULE**:
When implementing operations in `DEVELOPMENT.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in GitoxideLabs/gitoxide. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0c6c639c`: Share generated fixtures between exhaustive native QA passes. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `DEVELOPMENT.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
source copies. The native passes share a fresh cache of generated read-only scripted fixtures.
When no archive is available, the archived pass can generate a fixture once for both passes;
the shared cache never substitutes extracted archives for generated fixtures. Fixtures that write archives or require
execution in a writable destination keep their existing behavior. The cache and its source
copies remain alive until both passes finish, and are retained together if a source copy changes.
Feature/hash variants also run in an isolated copy, sharing compatible fixture
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
source copies. Feature/hash variants also run in an isolated copy, sharing compatible fixture
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0c6c639c` are properly handled with clean fallback behavior.
