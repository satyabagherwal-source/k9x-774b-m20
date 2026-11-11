> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/gitoxidelabs-gitoxide-learnings.md`  
> **Source**: github ([https://github.com/GitoxideLabs/gitoxide](https://github.com/GitoxideLabs/gitoxide))  
> **Source Version**: `865a2448`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-09T06:38:53.359Z  
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
> **Harvest Timestamp**: 2026-11-09T06:38:52.484Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `GitoxideLabs/gitoxide`
- **Description**: A tasteful, lean, fast & safe pure Rust implementation of Git
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 12114 stars

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
- **Issue #3183** (2026-11-09): **Avoid spawning Git for known Unix installation config paths**
  *Symptoms*: ## Tasks  This section is for Byron only. Models continuing this PR must not add, remove, check, uncheck, rename, or reorder checkboxes here.  - [x] refackiew  ----  Everything below this line was generated by `Codex`.  Created by Codex on behalf of Byron. Byron will review before this is ready to merge.  Starship opens a repository in a new process for each prompt with installation configuration enabled. In #3182, the Git subprocess used to discover that configuration dominated the reported repository-open time. This extends the existing Windows inference hook to Unix so recognized installations can avoid that subprocess too.  Resolve the first executable in `PATH` through symlinks, then recognize Homebrew Cellar installations, Linux `/usr/bin/git` and `/bin/git`, and directly invoked Apple developer binaries. Preserve Apple's `unknown` installation scope and leave configuration environment overrides to callers.  The expected config must exist. Unknown layouts, relative `PATH` entries, missing configs, and restricted execute permissions retain the Git query. Apple's `/usr/bin/git` shim and indirect Apple Git invocations also query Git, preserving its developer-directory validation and selection. Recognized layouts assume their standard build-time config paths; custom builds in those locations can differ.  Fixes #3182.  ### Validation  - The new Homebrew regression failed before implementation; all 15 Unix detection tests now pass, including symlink chains, PATH precedence, m

- **Issue #3182** (2026-11-09): **Avoid spawning `git` to find the installation config on Unix**
  *Symptoms*: > This issue was written by Claude Code, an AI agent, working for @hood. The measurements below are the agent's own.  ### Summary  With `permissions.config.git_binary` enabled, every process that opens a repository runs `git config -lz --show-origin --no-includes --show-scope --name-only` once to find the installation configuration (`gix-path/src/env/git/mod.rs`, `GIT_CONFIG_PATHS`). On Unix there is no way around the spawn, unlike the recent Windows work that finds the paths without launching Git.  For one-shot processes this spawn is the largest part of opening a repository. starship enables `git_binary` (`src/context/mod.rs`, `gix::open::permissions::Config { git_binary: true, .. }`) and runs as a new process for every prompt, so every prompt in a Git repository pays for it.  I'd like to discuss whether, and how, gitoxide could avoid it on Unix before writing any code.  ### Measurements  Apple M1 Pro, macOS, upstream `576bfd2`, neovim clone, hyperfine and in-process timers:  | | Time | |---|---| | discover + open, `git_binary: false` | 4.6 ms | | discover + open, `git_binary: true` | 55.8 ms | | the spawned command alone, Homebrew Git 2.56 | 55.1 ± 12.0 ms (user 5.4 ms, system 9.7 ms) | | the spawned command alone, `/usr/bin/git` (Apple Git, `xcrun` shim) | 92.0 ± 11.7 ms |  This machine runs endpoint security software, which inflates process creation, so absolute numbers will be lower elsewhere. Even so, a `fork`/`exec` of Git is much more than the rest of `open()`.  ### 

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

### Incident Patch 1: `cc8decf6` (2026-11-08)
**Commit Message**: fix(gix-status): read rename candidate metadata from the open file

This change to worktree status checks doesn't only make reading of worktree
files more resilient in the face of removals, it also makes it faster by
obtaining the file length directly from the open handle, instead of re-statting
just for calling the 'wrong' version of the hashing utility.

Tests mostly rubber-stamped.

<!-- agent -->
GitButler's concurrent status reloads and discard/undo operations exposed
vanishing-file races, as described in
https://github.com/gitbutlerapp/gitbutler/pull/17069. Untracked rename
candidates were opened, then their length was read through the pathname.
Unlinking the file could abort status; replacing the path could supply a
different file's length and cause a hashing error or an incorrect hash.

Use `File::metadata()` so the length and contents refer to the same open
file even after its pathname is removed or replaced. This replaces one
metadata call without adding calls, retries, allocations, or options.
In-place writes remain outside this guarantee.

Git source `6de20f6092dcf9bdb1c8efe03db4b70c82b423dd`
(`v2.56.0-116-g6de20f6092`) lists untracked names without hashing in
`wt-statu

**File**: `gix-status/src/index_as_worktree_with_renames/mod.rs` (modified, +14/-10)
```diff
@@ -585,20 +585,24 @@ pub(super) mod function {
                         )
                         .or_raise(|| message!("Could not convert worktree file {rela_path:?} to Git format"))?;
                     match out {
-                        ToGitOutcome::Unchanged(mut file) => gix_object::compute_stream_hash(
-                            object_hash,
-                            gix_object::Kind::Blob,
-                            &mut file,
-                            file_path
+                        ToGitOutcome::Unchanged(mut file) => {
+                            // The path may have been removed or replaced since opening the file.
+                            let file_size = file
                                 .metadata()
                                 .or_raise(|| {
                                     message!("Could not read metadata for worktree file \"{}\"", file_path.display())
                                 })?
-                                .len(),
-                            &mut gix_utils::progress::Discard,
-                            should_interrupt,
-                        )
-                        .or_raise(|| message!("Could not hash worktree file \"{}\"", file_path.display()))?,
+                                .len();
+                            gix_object::compute_stream_hash(
+                                object_hash,
+                                gix_object::Kind::Blob,
+                                &mut file,
+                                file_size,
+                                &mut gix_utils::progress::Discard,
+                                should_interrupt,
+                            )
+                            .or_raise(|| message!("Could not hash worktree file \"{}\"", file_path.display()))?
+                        }
                         ToGitOutcome::Buffer(buf) => gix_object::compute_hash(object_hash, gix_object::Kind::Blob, buf)
                             .or_raise(|| message!("Could not hash worktree file \"{}\"", file_path.display()))?,
                         ToGitOutcome::Process(mut stream) => {
```

**File**: `gix-status/tests/fixtures/status_untracked_race.sh` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+#!/usr/bin/env bash
+set -eu -o pipefail
+
+# A rename candidate whose path is removed or replaced after status opens the file.
+# The process filter changes the path before completing its handshake and offers no
+# clean capability, so status hashes the original open file without filtering it.
+git init -q
+echo 'renamed filter=race -text' >.gitattributes
+echo original >source
+git add .gitattributes source
+git commit -q -m 'A file to rename'
+mv source renamed
+
+cat >.git/change-untracked.sh <<'EOF'
+#!/usr/bin/env bash
+set -eu -o pipefail
+case "$1" in
+    remove) rm renamed ;;
+    replace)
+        echo 'a replacement with a different length' >.git/replacement
+        mv .git/replacement renamed
+        ;;
+    *) exit 1 ;;
+esac
+# Packet-line greeting, version, flush, and an empty set of filter capabilities.
+printf '0016git-filter-server\n000eversion=2\n00000000'
+cat >/dev/null
+EOF
```

**File**: `gix-status/tests/status/index_as_worktree_with_renames.rs` (modified, +60/-1)
```diff
@@ -289,11 +289,52 @@ fn unreadable_untracked() {
     );
 }
 
+#[test]
+fn untracked_file_removed_after_open() -> gix_testtools::TestResult {
+    untracked_file_changed_after_open("bash .git/change-untracked.sh remove")
+}
+
+#[test]
+fn untracked_file_replaced_after_open() -> gix_testtools::TestResult {
+    untracked_file_changed_after_open("bash .git/change-untracked.sh replace")
+}
+
+fn untracked_file_changed_after_open(process: &'static str) -> gix_testtools::TestResult {
+    if gix_testtools::run_in_isolated_process()? {
+        return Ok(());
+    }
+    let out = fixture_filtered_detailed(
+        "status_untracked_race.sh",
+        "",
+        &[],
+        &[Expectation::Rewrite {
+            source_rela_path: "source",
+            dest_rela_path: "renamed",
+            dest_dirwalk_status: gix_dir::entry::Status::Untracked,
+            diff: None,
+            copy: false,
+        }],
+        Some(gix_diff::Rewrites {
+            percentage: None,
+            ..Default::default()
+        }),
+        Some(Default::default()),
+        Fixture::WritableWithFilterProcess(process),
+    );
+    assert_eq!(
+        out.rewrites.expect("rewrite tracking is enabled").num_similarity_checks,
+        0,
+        "the opened file's contents and length still identify an exact rename after its path changes"
+    );
+    Ok(())
+}
+
 enum Fixture {
     ReadOnly,
     ReadOnlyNeedsArchive,
     #[cfg(unix)]
     WritableExecuted,
+    WritableWithFilterProcess(&'static str),
 }
 
 fn fixture_filtered_detailed(
@@ -313,6 +354,7 @@ fn fixture_filtered_detailed(
         out
     }
 
+    let mut filter_process = None;
     let (worktree, _tmp) = match fixture {
         Fixture::ReadOnly => {
             let dir = fixture_path(script).join(subdir);
@@ -330,6 +372,12 @@ fn fixture_filtered_detailed(
             let dir = tmp.path().join(subdir);
             (dir, Some(tmp))
         }
+        Fixture::WritableWithFilterProcess(process) => {
+            filter_process = Some(process);
+            let tmp = crate::scripted_fixture_writable(script).expect("script works");
+            let dir = tmp.path().join(subdir);
+            (dir, Some(tmp))
+        }
     };
     let git_dir = worktree.join(".git");
     let object_hash = gix_testtools::object_hash();
@@ -351,14 +399,25 @@ fn fixture_filtered_detailed(
         index.path_backing(),
     );
     let capabilities = gix_fs::Capabilities::probe(&git_dir);
+    let mut filter = gix_filter::Pipeline::new(Default::default(), object_hash, Default::default());
+    if let Some(process) = filter_process {
+        filter.driver_state_mut().context.worktree_dir = Some(worktree.clone());
+        filter.options_mut().drivers.push(gix_filter::Driver {
+            name: "race".into(),
+            clean: None,
+            smudge: None,
+            process: Some(process.into()),
+            required: true,
+        });
+    }
     let resource_cache = gix_diff::blob::Platform::new(
         Default::default(),
         gix_diff::blob::Pipeline::new(
             WorktreeRoots {
                 old_root: None,
                 new_root: Some(worktree.to_owned()),
             },
-            gix_filter::Pipeline::new(Default::default(), gix_testtools::object_hash(), Default::default()),
+            filter,
             vec![],
             gix_diff::blob::pipeline::Options {
                 large_file_threshold_bytes: 0,
```

---

### Incident Patch 2: `499a8557` (2026-11-09)
**Commit Message**: fix(gix-path): infer known Unix config paths without running Git (#3182)

Rubber-stamped the tests, which are similar to the tests present on Windows.
They are read-only and properly isolated.

The implementation is quite minimal, and should cover most platforms for a
2.5x improvement, from ~4ms on macOS to 1.5ms.

<!-- agent -->
Starship enables Git installation configuration while opening repositories
in a new process for each prompt. Its issue report identifies the Git
configuration query as the dominant cost, which the existing Windows
layout discovery already avoids for known installations.

Use that same cached discovery hook on Unix. Resolve the first executable
in `PATH` through symlinks and recognize Homebrew Cellar installations,
Linux distribution paths, and directly invoked Apple developer binaries.
Leave Apple's shim selection to Git. Require the expected config to exist and
keep the existing query for unknown or ambiguous layouts. Preserve Apple's
non-system installation scope and leave config overrides to callers.

The Git reference checkout at `6de20f6092dcf9bdb1c8efe03db4b70c82b423dd`
uses `system_path(ETC_GITCONFIG)` in `config.c:1514`; `exec-cmd.c:290`
preserves 

**File**: `gix-path/src/env/git/mod.rs` (modified, +1/-0)
```diff
@@ -19,6 +19,7 @@ pub(super) struct ConfigPaths {
 ///
 /// An unambiguous `EXEPATH`, or `git.exe` in the `cmd` directory of an unambiguous installation,
 /// identifies Git for Windows' modern configuration location if that file exists.
+/// Known Unix installation layouts also avoid the query when their configuration file exists.
 /// Otherwise, query the Git executable found in `PATH` or an alternative location.
 pub(super) static GIT_CONFIG_PATHS: LazyLock<ConfigPaths> =
     LazyLock::new(|| platform::config_paths_without_git().unwrap_or_else(config_paths_from_executable));
```

**File**: `gix-path/src/env/mod.rs` (modified, +8/-1)
```diff
@@ -22,12 +22,19 @@ mod platform;
 ///
 /// ### Performance
 ///
-/// This can invoke the Git binary, which is slow on Windows. An unambiguous Git for Windows
+/// This can invoke the Git binary. An unambiguous Git for Windows
 /// installation identified by `EXEPATH`, or by `git.exe` in its `cmd` or `bin` directories,
 /// avoids that invocation when its modern configuration file exists.
 /// Prefixes derived from the selected executable are shared with core-directory, prefix, and shell discovery.
 /// Registered MSYS2 Git packages use their known configuration path, translated by `cygpath`.
 /// Their core and configuration paths share a single cached conversion.
+/// On Unix, the first executable in `PATH` is resolved through symlinks. Known Homebrew Cellar
+/// layouts, Linux `/usr/bin/git` and `/bin/git`, and direct Apple developer binaries avoid the query
+/// when their expected configuration file exists. Apple's `/usr/bin/git` shim still queries Git,
+/// leaving developer-directory and toolchain selection to the shim.
+/// Unknown layouts, relative `PATH` entries, and restricted execute bits also query Git.
+/// Indirect Apple Git invocations also query Git, as their config can differ from the symlink target's.
+/// These shortcuts assume the recognized installations use their standard build-time config paths.
 pub fn installation_config() -> Option<&'static Path> {
     git::install_config_path().and_then(|p| crate::from_byte_slice(p).ok())
 }
```

**File**: `gix-path/src/env/non_windows.rs` (modified, +95/-0)
```diff
@@ -25,10 +25,83 @@ pub(super) fn core_dir() -> Option<PathBuf> {
     git::core_dir_from_executable()
 }
 
+#[cfg(not(unix))]
 pub(super) fn config_paths_without_git() -> Option<ConfigPaths> {
     None
 }
 
+#[cfg(unix)]
+pub(super) fn config_paths_without_git() -> Option<ConfigPaths> {
+    use std::os::unix::fs::PermissionsExt;
+
+    for directory in std::env::split_paths(&std::env::var_os("PATH")?) {
+        // The query runs from `/`, so relative PATH entries must be left to that query.
+        if !directory.is_absolute() {
+            return None;
+        }
+        let executable = directory.join(EXE_NAME);
+        let metadata = match executable.metadata() {
+            Ok(metadata) => metadata,
+            Err(err) if err.kind() == std::io::ErrorKind::NotFound => continue,
+            Err(_) => return None,
+        };
+        let execute_bits = metadata.permissions().mode() & 0o111;
+        if !metadata.is_file() || execute_bits == 0 {
+            continue;
+        }
+        // An execute bit for another user doesn't establish that this process can execute the file.
+        if execute_bits != 0o111 {
+            return None;
+        }
+        // Only the first executable counts, even when its layout is unknown.
+        let resolved = executable.canonicalize().ok()?;
+        let (config, is_system) = config_path_from_executable(&resolved)?;
+        // Apple Git's installation config can depend on the invocation path instead of its symlink target.
+        if !is_system && executable != resolved {
+            return None;
+        }
+        if !config.is_file() {
+            return None;
+        }
+        let config = crate::os_string_into_bstring(config.into()).ok()?;
+        return Some(ConfigPaths {
+            installation: Some(config.clone()),
+            installation_is_system: is_system,
+            system: is_system.then_some(config),
+        });
+    }
+    None
+}
+
+#[cfg(unix)]
+fn config_path_from_executable(executable: &Path) -> Option<(PathBuf, bool)> {
+    // shortcut: recognized layouts assume standard build-time config paths; query custom layouts instead.
+    #[cfg(target_os = "linux")]
+    if executable == Path::new("/usr/bin/git") || executable == Path::new("/bin/git") {
+        return Some(("/etc/gitconfig".into(), true));
+    }
+
+    let bin = executable.parent()?;
+    if executable.file_name()? != EXE_NAME || bin.file_name()? != "bin" {
+        return None;
+    }
+    let prefix = bin.parent()?;
+    let package = prefix.parent()?;
+    let cellar = package.parent()?;
+    if package.file_name()? == "git" && cellar.file_name()? == "Cellar" {
+        return Some((cellar.parent()?.join("etc/gitconfig"), true));
+    }
+
+    #[cfg(target_os = "macos")]
+    if prefix.file_name()? == "usr" {
+        let developer = prefix.parent()?;
+        if developer.ends_with("Contents/Developer") || developer.ends_with("Library/Developer/CommandLineTools") {
+            return Some((prefix.join("share/git-core/gitconfig"), false));
+        }
+    }
+    None
+}
+
 pub(super) fn system_prefix() -> Option<&'static Path> {
     Some(Path::new("/"))
 }
@@ -55,3 +128,25 @@ pub(super) fn command(executable: impl AsRef<OsStr>) -> Command {
 pub(super) fn config_query_cwd() -> PathBuf {
     "/".into()
 }
+
+#[cfg(all(test, target_os = "linux"))]
+mod tests {
+    use super::config_path_from_executable;
+    use std::path::Path;
+
+    #[test]
+    fn distribution_config_is_outside_usr() {
+        for executable in ["/usr/bin/git", "/bin/git"] {
+            assert_eq!(
+                config_path_from_executable(Path::new(executable)),
+                Some(("/etc/gitconfig".into(), true)),
+                "distribution Git uses system-scoped /etc/gitconfig"
+            );
+        }
+        assert_eq!(
+            config_path_from_executable(Path::new("/usr/local/bin/git")),
+            None,
+            "an arbitrary build prefix does not establish its config location"
+        );
+    }
+}
```

**File**: `gix-path/tests/fixtures/unix-git-layouts.sh` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+#!/usr/bin/env bash
+set -eu
+
+# Every fake Git reports a different path from the inferred one, so finding the
+# Homebrew config proves discovery did not launch it. Queries do not mutate fixtures.
+for bin in homebrew/Cellar/git/2.56.0/bin incomplete/Cellar/git/2.56.0/bin custom/bin unknown non-executable; do
+    mkdir -p "$bin"
+    cat >"$bin/git" <<'EOF'
+#!/bin/sh
+printf 'unknown\000file:/queried/gitconfig\000core.test\000'
+EOF
+    chmod +x "$bin/git"
+done
+
+# Apple Git can read a different installation config when invoked indirectly.
+mkdir -p apple-link real-apple-link
+ln -s ../Xcode.app/Contents/Developer/usr/bin/git apple-link/git
+ln -s /Library/Developer/CommandLineTools/usr/bin/git real-apple-link/git
+ln -s /Library/Developer/CommandLineTools real-developer-link
+chmod -x non-executable/git
+mkdir -p broken
+ln -s missing-git broken/git
+
+# Homebrew links its public bin through opt into a versioned Cellar installation,
+# but keeps the configuration under the unversioned prefix.
+mkdir -p homebrew/bin homebrew/opt homebrew/etc
+ln -s ../Cellar/git/2.56.0 homebrew/opt/git
+ln -s ../opt/git/bin/git homebrew/bin/git
+printf '[core]\n\tfilemode = true\n' >homebrew/etc/gitconfig
+
+# A mode can grant execution to others but deny it to the file's owner.
+mkdir -p restricted/Cellar/git/2.56.0/bin restricted/etc
+cp homebrew/Cellar/git/2.56.0/bin/git restricted/Cellar/git/2.56.0/bin/git
+chmod 645 restricted/Cellar/git/2.56.0/bin/git
+cp homebrew/etc/gitconfig restricted/etc/gitconfig
+
+# An arbitrary bin/etc layout does not establish Git's compile-time config path.
+mkdir -p custom/etc
+printf '[core]\n\tfilemode = false\n' >custom/etc/gitconfig
+
+# Apple Git reads installation config below the selected developer directory.
+# Empty executable files cannot run, making a successful lookup proof of inference.
+for developer in Xcode.app/Contents/Developer Library/Developer/CommandLineTools; do
+    mkdir -p "$developer/usr/bin" "$developer/usr/share/git-core"
+    touch "$developer/usr/bin/git"
+    chmod +x "$developer/usr/bin/git"
+    printf '[credential]\n\thelper = osxkeychain\n' >"$developer/usr/share/git-core/gitconfig"
+done
```

**File**: `gix-path/tests/path/main.rs` (modified, +2/-0)
```diff
@@ -14,6 +14,8 @@ mod home_dir {
 }
 
 mod env;
+#[cfg(unix)]
+mod unix_detection;
 mod util;
 #[cfg(windows)]
 mod windows_detection;
```

**File**: `gix-path/tests/path/unix_detection.rs` (added, +275/-0)
```diff
@@ -0,0 +1,275 @@
+use std::path::{Path, PathBuf};
+
+fn fixture() -> gix_error::TestResult<PathBuf> {
+    Ok(gix_testtools::scripted_fixture_read_only("unix-git-layouts.sh")?.canonicalize()?)
+}
+
+fn select(path: impl AsRef<std::ffi::OsStr>) -> gix_testtools::Env<'static> {
+    gix_testtools::Env::new().set("PATH", path.as_ref().to_str().expect("UTF-8 fixture path"))
+}
+
+fn assert_inferred(root: &Path) {
+    assert_eq!(
+        gix_path::env::installation_config(),
+        Some(root.join("etc/gitconfig").as_path()),
+        "Homebrew's configuration belongs to its prefix, not the versioned Cellar directory"
+    );
+    assert!(
+        gix_path::env::installation_config_is_system(),
+        "Homebrew's installation configuration has system scope"
+    );
+}
+
+fn assert_queried() {
+    assert_eq!(
+        gix_path::env::installation_config(),
+        Some(Path::new("/queried/gitconfig")),
+        "ambiguous layouts preserve the configuration path reported by the selected Git"
+    );
+    assert!(
+        !gix_path::env::installation_config_is_system(),
+        "the query's reported scope is preserved"
+    );
+}
+
+#[test]
+fn homebrew_cellar_without_spawning() -> gix_error::TestResult {
+    let root = fixture()?.join("homebrew");
+    if gix_testtools::run_in_isolated_process()? {
+        return Ok(());
+    }
+    let _env = select(root.join("Cellar/git/2.56.0/bin"));
+    assert_inferred(&root);
+    Ok(())
+}
+
+#[test]
+fn homebrew_symlink_chain_without_spawning() -> gix_error::TestResult {
+    let root = fixture()?.join("homebrew");
+    if gix_testtools::run_in_isolated_process()? {
+        return Ok(());
+    }
+    let _env = select(root.join("bin"));
+    assert_inferred(&root);
+    Ok(())
+}
+
+#[test]
+fn homebrew_discovery_ignores_config_overrides() -> gix_error::TestResult {
+    let root = fixture()?.join("homebrew");
+    if gix_testtools::run_in_isolated_process()? {
+        return Ok(());
+    }
+    let _env = select(root.join("bin"))
+        .set("GIT_CONFIG_SYSTEM", "/overridden/gitconfig")
+        .set("GIT_CONFIG_NOSYSTEM", "1");
+    assert_inferred(&root);
+    Ok(())
+}
+
+#[test]
+fn first_unknown_executable_is_queried() -> gix_error::TestResult {
+    let root = fixture()?;
+    if gix_testtools::run_in_isolated_process()? {
+        return Ok(());
+    }
+    let _env = select(std::env::join_paths([root.join("unknown"), root.join("homebrew/bin")])?);
+    assert_queried();
+    Ok(())
+}
+
+#[test]
+fn missing_homebrew_config_is_queried() -> gix_error::TestResult {
+    let root = fixture()?;
+    if gix_testtools::run_in_isolated_process()? {
+        return Ok(());
+    }
+    let _env = select(root.join("incomplete/Cellar/git/2.56.0/bin"));
+    assert_queried();
+    Ok(())
+}
+
+#[test]
+fn arbitrary_prefix_with_config_is_queried() -> gix_error::TestResult {
+    let root = fixture()?;
+    if gix_testtools::run_in_isolated_process()? {
+        return Ok(());
+    }
+    let _env = select(root.join("custom/bin"));
+    assert_queried();
+    Ok(())
+}
+
+#[test]
+fn broken_symlinks_and_non_executable_entries_are_skipped() -> gix_error::TestResult {
+    let root = fixture()?;
+    if gix_testtools::run_in_isolated_process()? {
+        return Ok(());
+    }
+    let _env = select(std::env::join_paths([
+        root.join("broken"),
+        root.join("non-executable"),
+        root.join("homebrew/bin"),
+    ])?);
+    assert_inferred(&root.join("homebrew"));
+    Ok(())
+}
+
+#[test]
+fn restricted_execute_permissions_use_the_query_fallback() -> gix_error::TestResult {
+    let root = fixture()?;
+    if gix_testtools::run_in_isolated_process()? {
+        return Ok(());
+    }
+    let _env = select(std::env::join_paths([
+        root.join("restricted/Cellar/git/2.56.0/bin"),
+        root.join("unknown"),
+    ])?);
+    assert_queried();
+    Ok(())
+}
+
+#[test]
+fn relative_path_entry_uses_the_query_fallback() -> gix_error::TestResult {
+    let root = fixture()?;
+    if gix_testtools::run_in_isolated_process()? {
+        return Ok(());
+    }
+    let _env = select(std::env::join_paths([
+        PathBuf::from("gix-test-relative-path"),
+        root.join("homebrew/bin"),
+    ])?);
+    assert_queried();
+    Ok(())
+}
+
+#[cfg(target_os = "macos")]
+mod apple {
+    use super::{fixture, select};
+    use std::path::Path;
+
+    fn assert_inferred(developer: &Path) {
+        assert_eq!(
+            gix_path::env::installation_config(),
+            Some(developer.join("usr/share/git-core/gitconfig").as_path()),
+            "Apple Git's installation config belongs to the selected developer directory"
+        );
+        assert!(
+            !gix_path::env::installation_config_is_system(),
+            "Apple Git's installation config has unknown scope"
+        );
+    }
+
+    #[test]
+    fn direct_xcode_without_spawning() -> gix_error::TestResult {
+        direct("Xcode.app/Contents/Developer")
+    }
+
+    #[test]
+    fn d
```

---

### Incident Patch 3: `576bfd20` (2026-11-08)
**Commit Message**: Merge pull request #3178 from GitoxideLabs/fix-status-race

fix(gix-status): avoid two pathname races during status

**File**: `gix-dir/Cargo.toml` (modified, +0/-1)
```diff
@@ -13,7 +13,6 @@ include = ["/src/**/*", "/LICENSE-*"]
 
 [lib]
 doctest = false
-test = false
 
 [features]
 ## Enable support for the SHA-1 hash by forwarding the feature to dependencies.
```

**File**: `gix-dir/src/walk/function.rs` (modified, +5/-0)
```diff
@@ -28,6 +28,11 @@ use crate::{
 /// useful to transform the paths returned for the user. It's always within the `worktree_root`, or the same,
 /// but is hard to guess due to additional logic affecting it.
 ///
+/// Directory-open and iteration errors abort walks configured with [`Options::for_deletion`].
+/// Other walks skip the unreadable directory, retaining entries already seen and counting failures in
+/// [`Outcome::read_dir_errors`]. Path and error details are available through tracing.
+/// An unreadable directory and its ancestors won't be collapsed, even if no entries could be read.
+///
 /// ### Performance Notes
 ///
 /// Parallel traversal is abandoned as it's not worth managing a thread-pool over this, also given that
```

**File**: `gix-dir/src/walk/mod.rs` (modified, +7/-0)
```diff
@@ -165,6 +165,9 @@ pub struct Options<'a> {
     /// them, and otherwise assure that no entries are observable that shouldn't be deleted.
     /// If `None`, precious files are treated like expendable files, which is usually what you want when displaying them
     /// for addition to the repository, and the collapse of folders can be more generous in relation to ignored files.
+    /// Directory-open and iteration errors abort deletion walks, including errors caused by disappearing paths.
+    /// Other walks skip the unreadable directory, report the failure through tracing and
+    /// [`Outcome::read_dir_errors`], and prevent its ancestors from collapsing.
     pub for_deletion: Option<ForDeletionMode>,
     /// If `true`, we will not only find non-bare repositories in untracked directories, but also bare ones.
     ///
@@ -267,6 +270,10 @@ pub struct Context<'a> {
 pub struct Outcome {
     /// The amount of calls to read the directory contents.
     pub read_dir_calls: u32,
+    /// The amount of ignored directory-open or iteration errors.
+    /// A nonzero value means the listing is incomplete; path and error details are available through tracing.
+    /// Always zero for successful deletion walks.
+    pub read_dir_errors: u32,
     /// The amount of returned entries provided to the callback. This number can be lower than `seen_entries`.
     pub returned_entries: usize,
     /// The amount of entries, prior to pathspecs filtering them out or otherwise excluding them.
```

**File**: `gix-dir/src/walk/readdir.rs` (modified, +87/-7)
```diff
@@ -1,11 +1,12 @@
 use std::{
     borrow::Cow,
+    io,
     path::{Path, PathBuf},
     sync::atomic::Ordering,
 };
 
 use bstr::{BStr, BString, ByteSlice};
-use gix_error::{Result, ResultExt, bail, cancelled, message};
+use gix_error::{ErrorExt, Result, bail, cancelled, message};
 
 use crate::{
     Entry, EntryRef, entry,
@@ -19,9 +20,15 @@ use crate::{
     },
 };
 
+/// Recursively walk `current`, returning `(action, prevent_collapse)` on success.
+///
+/// `action` indicates whether traversal should continue or stop. `prevent_collapse` is `true` if
+/// this directory or a descendant prevents collapsing this directory and its ancestors into single
+/// directory entries. Callers must propagate this flag to their parents.
+///
 /// ### Deviation
 ///
-/// Git mostly silently ignores IO errors and stops iterating seemingly quietly, while we error loudly.
+/// Like Git, ordinary walks skip directory-read errors, but deletion walks abort on every such error.
 #[expect(clippy::too_many_arguments)]
 pub(super) fn recursive(
     may_collapse: bool,
@@ -38,15 +45,24 @@ pub(super) fn recursive(
         bail!(cancelled("Interrupted"));
     }
     out.read_dir_calls += 1;
-    let entries = gix_fs::read_dir(current, opts.precompose_unicode)
-        .or_raise(|| message!("Failed to read the directory at \"{}\"", current.display()))?;
+    let Some(entries) = read_dir_result(
+        gix_fs::read_dir(current, opts.precompose_unicode),
+        current,
+        opts.for_deletion,
+        out,
+    )?
+    else {
+        return Ok((std::ops::ControlFlow::Continue(()), true));
+    };
 
     let mut num_entries = 0;
-    let mark = state.mark(may_collapse);
+    let mut mark = state.mark(may_collapse);
     let mut prevent_collapse = false;
     for entry in entries {
-        let entry =
-            entry.or_raise(|| message!("Could not obtain directory entry in root of '{}'", current.display()))?;
+        let Some(entry) = read_dir_result(entry, current, opts.for_deletion, out)? else {
+            // Preserve earlier entries without treating the unreadable directory as empty or collapsible.
+            return Ok((mark.emit_all_held(state, opts, out, delegate), true));
+        };
         // Important to count right away, otherwise the directory could be seen as empty even though it's not.
         // That is, this should be independent of the kind.
         num_entries += 1;
@@ -132,6 +148,25 @@ pub(super) fn recursive(
     Ok((res, prevent_collapse))
 }
 
+fn read_dir_result<T>(
+    result: io::Result<T>,
+    directory: &Path,
+    for_deletion: Option<ForDeletionMode>,
+    out: &mut Outcome,
+) -> Result<Option<T>> {
+    match result {
+        Ok(value) => Ok(Some(value)),
+        Err(err) => {
+            if for_deletion.is_some() {
+                return Err(err.and_raise(message!("Failed to read the directory at \"{}\"", directory.display())));
+            }
+            gix_trace::warn!(?directory, ?err, "Skipping unreadable directory");
+            out.read_dir_errors += 1;
+            Ok(None)
+        }
+    }
+}
+
 pub(super) struct State {
     /// The entries to hold back until it's clear what to do with them.
     pub on_hold: Vec<Entry>,
@@ -431,3 +466,48 @@ impl Options<'_> {
         self.emit_ignored == Some(CollapseDirectory) || self.emit_untracked == CollapseDirectory
     }
 }
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+
+    #[test]
+    fn directory_read_failures_follow_deletion_policy() -> gix_testtools::TestResult {
+        for for_deletion in [None, Some(ForDeletionMode::default())] {
+            let mut out = Outcome::default();
+            assert_eq!(
+                read_dir_result(Ok(42), Path::new("directory"), for_deletion, &mut out)?,
+                Some(42),
+                "successful reads retain their value in either mode"
+            );
+            assert_eq!(out.read_dir_errors, 0, "successful reads do not count as errors");
+            for kind in [
+                io::ErrorKind::NotFound,
+                io::ErrorKind::NotADirectory,
+                io::ErrorKind::PermissionDenied,
+                io::ErrorKind::Interrupted,
+                io::ErrorKind::Other,
+            ] {
+                let mut out = Outcome::default();
+                let result = read_dir_result::<()>(
+                    Err(io::Error::from(kind)),
+                    Path::new("directory"),
+                    for_deletion,
+                    &mut out,
+                );
+                if for_deletion.is_some() {
+                    let err = result.expect_err("deletion must reject every directory-read failure");
+                    assert_eq!(
+                        err.downcast_any_ref::<io::Error>().map(io::Error::kind),
+                        Some(kind),
+                        "the original I/O error stays available for callers"
+                    );
+                } else {
+                    assert_eq!(result?, None, "ordi
```

**File**: `gix-dir/tests/dir/main.rs` (modified, +1/-0)
```diff
@@ -1,5 +1,6 @@
 pub use gix_testtools::Result;
 
 mod walk;
+mod walk_races;
 #[path = "../walk_utils/mod.rs"]
 pub mod walk_utils;
```

**File**: `gix-dir/tests/dir/walk.rs` (modified, +120/-0)
```diff
@@ -220,6 +220,7 @@ fn one_top_level_fifo() {
         out,
         walk::Outcome {
             read_dir_calls: 1,
+            read_dir_errors: 0,
             returned_entries: entries.len(),
             seen_entries: 2,
         }
@@ -252,6 +253,7 @@ fn fifo_in_traversal() {
         out,
         walk::Outcome {
             read_dir_calls: 3,
+            read_dir_errors: 0,
             returned_entries: entries.len(),
             seen_entries: 5,
         }
@@ -288,6 +290,7 @@ fn symlink_to_dir_can_be_excluded() -> TestResult {
         out,
         walk::Outcome {
             read_dir_calls: 2,
+            read_dir_errors: 0,
             returned_entries: entries.len(),
             seen_entries: 9,
         }
@@ -323,6 +326,7 @@ fn symlink_to_dir_can_be_excluded() -> TestResult {
         out,
         walk::Outcome {
             read_dir_calls: 2,
+            read_dir_errors: 0,
             returned_entries: entries.len(),
             seen_entries: 9,
         }
@@ -430,6 +434,7 @@ fn assume_unchanged_submodule_replaced_with_symlink_is_hidden() -> TestResult {
         out,
         walk::Outcome {
             read_dir_calls: 1,
+            read_dir_errors: 0,
             returned_entries: entries.len(),
             seen_entries: 3,
         }
@@ -465,6 +470,7 @@ fn submodule_replaced_with_symlink_without_assume_unchanged_stays_tracked() -> T
         out,
         walk::Outcome {
             read_dir_calls: 1,
+            read_dir_errors: 0,
             returned_entries: entries.len(),
             seen_entries: 3,
         }
@@ -507,6 +513,7 @@ fn empty_root() -> TestResult {
         out,
         walk::Outcome {
             read_dir_calls: 1,
+            read_dir_errors: 0,
             returned_entries: entries.len(),
             seen_entries: 1,
         }
@@ -532,6 +539,7 @@ fn empty_root() -> TestResult {
         out,
         walk::Outcome {
             read_dir_calls: 1,
+            read_dir_errors: 0,
             returned_entries: entries.len(),
             seen_entries: 1,
         }
@@ -552,6 +560,7 @@ fn complex_empty() -> TestResult {
         out,
         walk::Outcome {
             read_dir_calls: 9,
+            read_dir_errors: 0,
             returned_entries: entries.len(),
             seen_entries: 5,
         }
@@ -583,6 +592,7 @@ fn complex_empty() -> TestResult {
         out,
         walk::Outcome {
             read_dir_calls: 9,
+            read_dir_errors: 0,
             returned_entries: entries.len(),
             seen_entries: 5,
         }
@@ -609,6 +619,7 @@ fn complex_empty() -> TestResult {
         out,
         walk::Outcome {
             read_dir_calls: 9,
+            read_dir_errors: 0,
             returned_entries: entries.len(),
             seen_entries: 9,
         }
@@ -670,6 +681,7 @@ fn ignored_with_prefix_pathspec_collapses_just_like_untracked() -> TestResult {
         out,
         walk::Outcome {
             read_dir_calls: 2,
+            read_dir_errors: 0,
             returned_entries: entries.len(),
             seen_entries: 6,
         }
@@ -703,6 +715,7 @@ fn ignored_with_prefix_pathspec_collapses_just_like_untracked() -> TestResult {
         out,
         walk::Outcome {
             read_dir_calls: 4,
+            read_dir_errors: 0,
             returned_entries: entries.len(),
             seen_entries: 8,
         }
@@ -743,6 +756,7 @@ fn ignored_collapse_of_empty_directories_is_not_classified_as_empty_directory()
         out,
         walk::Outcome {
             read_dir_calls: 5,
+            read_dir_errors: 0,
             returned_entries: entries.len(),
             seen_entries: 6,
         }
@@ -781,6 +795,7 @@ fn ignored_dir_with_cwd_handling() -> TestResult {
         out,
         walk::Outcome {
             read_dir_calls: 2,
+            read_dir_errors: 0,
             returned_entries: entries.len(),
             seen_entries: 3,
         }
@@ -815,6 +830,7 @@ fn ignored_dir_with_cwd_handling() -> TestResult {
         out,
         walk::Outcome {
             read_dir_calls: 2,
+            read_dir_errors: 0,
             returned_entries: entries.len(),
             seen_entries: 2,
         }
@@ -850,6 +866,7 @@ fn ignored_dir_with_cwd_handling() -> TestResult {
         out,
         walk::Outcome {
             read_dir_calls: 8,
+            read_dir_errors: 0,
             returned_entries: entries.len(),
             seen_entries: 26
         }
@@ -894,6 +911,7 @@ fn ignored_with_cwd_handling() -> TestResult {
         out,
         walk::Outcome {
             read_dir_calls: 1,
+            read_dir_errors: 0,
             returned_entries: entries.len(),
             seen_entries: 3,
         }
@@ -929,6 +947,7 @@ fn ignored_with_cwd_handling() -> TestResult {
         out,
         walk::Outcome {
             read_dir_calls: 5,
+            read_dir_errors: 0,
             returned_entries: entries.len(),
             seen_entries: 7,
         }
@@ -973,6 +992,7 @@
```

**File**: `gix-dir/tests/dir/walk_races.rs` (added, +161/-0)
```diff
@@ -0,0 +1,161 @@
+use std::{io, path::Path};
+
+use gix_dir::{EntryRef, entry, walk};
+use gix_testtools::TestResult;
+
+use crate::walk_utils::{entry, options, try_collect_filtered_opts};
+
+const DELETION_MODES: [Option<walk::ForDeletionMode>; 4] = [
+    None,
+    Some(walk::ForDeletionMode::IgnoredDirectoriesCanHideNestedRepositories),
+    Some(walk::ForDeletionMode::FindNonBareRepositoriesInIgnoredDirectories),
+    Some(walk::ForDeletionMode::FindRepositoriesInIgnoredDirectories),
+];
+
+#[test]
+fn directories_removed_or_replaced_before_reading_follow_deletion_policy() -> TestResult {
+    for replace_with_file in [false, true] {
+        for emit_untracked in [walk::EmissionMode::Matching, walk::EmissionMode::CollapseDirectory] {
+            for for_deletion in DELETION_MODES {
+                let result = walk_with_directory_change(
+                    walk::Options {
+                        emit_untracked,
+                        for_deletion,
+                        emit_empty_directories: true,
+                        ..options()
+                    },
+                    |path| {
+                        std::fs::remove_dir_all(path)?;
+                        if replace_with_file {
+                            std::fs::write(path, "replacement")?;
+                        }
+                        Ok(())
+                    },
+                );
+                if for_deletion.is_some() {
+                    let err = result
+                        .err()
+                        .expect("deletion walks reject missing or replaced directories");
+                    assert!(
+                        format!("{err:?}").contains("Failed to read the directory"),
+                        "the failed directory read remains visible to deletion callers: {err:?}"
+                    );
+                    continue;
+                }
+                let (out, collected) = result?;
+                assert_eq!(
+                    collected.into_entries_by_path(),
+                    [entry("parent/keep", entry::Status::Untracked, entry::Kind::File)],
+                    "stale directories are skipped and cannot make their parent a deletion candidate"
+                );
+                assert_eq!(
+                    out.read_dir_calls, 3,
+                    "the vanished directory is attempted once without retries"
+                );
+                assert_eq!(
+                    out.read_dir_errors, 1,
+                    "the skipped path makes the result observably incomplete"
+                );
+            }
+        }
+    }
+    Ok(())
+}
+
+#[cfg(unix)]
+#[test]
+fn unreadable_directories_are_skipped_only_for_non_deletion_walks() -> TestResult {
+    for emit_untracked in [walk::EmissionMode::Matching, walk::EmissionMode::CollapseDirectory] {
+        for for_deletion in DELETION_MODES {
+            let result = walk_with_directory_change(
+                walk::Options {
+                    emit_untracked,
+                    for_deletion,
+                    emit_empty_directories: true,
+                    ..options()
+                },
+                |path| {
+                    std::fs::remove_dir_all(path)?;
+                    std::os::unix::fs::symlink("gone", path)
+                },
+            );
+            if for_deletion.is_some() {
+                let err = result.err().expect("a symlink loop must fail a deletion walk");
+                assert!(
+                    format!("{err:?}").contains("Failed to read the directory"),
+                    "the error identifies the failed directory operation: {err:?}"
+                );
+                continue;
+            }
+            let (out, collected) = result?;
+            assert_eq!(
+                collected.into_entries_by_path(),
+                [entry("parent/keep", entry::Status::Untracked, entry::Kind::File)],
+                "a non-deletion walk retains readable siblings without collapsing unreadable contents"
+            );
+            assert_eq!(out.read_dir_calls, 3, "an unreadable directory is attempted once");
+            assert_eq!(
+                out.read_dir_errors, 1,
+                "the unreadable subtree is reported as incomplete"
+            );
+        }
+    }
+    Ok(())
+}
+
+fn walk_with_directory_change(
+    options: walk::Options<'_>,
+    change: impl FnMut(&Path) -> io::Result<()>,
+) -> TestResult<(walk::Outcome, walk::delegate::Collect)> {
+    struct ChangeDirectory<'a, F> {
+        root: &'a Path,
+        change: F,
+        collected: walk::delegate::Collect,
+        changed: bool,
+    }
+
+    impl<F: FnMut(&Path) -> io::Result<()>> walk::Delegate for ChangeDirectory<'_, F> {
+        fn emit(&mut self, entry: EntryRef<'_>, dir_status: Option<entry::Status>) -> walk::Action {
+            self.collected.emit(entry, dir_status)
+        }
+
+        fn can_recurse(
+            &mut self,
+            entry: EntryRef<'_>,
+      
```

**File**: `gix-dir/tests/dir_cwd.rs` (modified, +1/-0)
```diff
@@ -22,6 +22,7 @@ fn prefixes_work_as_expected() -> gix_testtools::TestResult {
         out,
         walk::Outcome {
             read_dir_calls: 2,
+            read_dir_errors: 0,
             returned_entries: entries.len(),
             seen_entries: 3,
         }
```

#### Recent Merged Pull Requests:
- **PR #3183** (2026-11-09): Avoid spawning Git for known Unix installation config paths (@Byron)
- **PR #3181** (closed): perf(gix): read directories ahead in `status` dirwalks (@hood)
- **PR #3178** (2026-11-08): fix(gix-status): avoid two pathname races during status (@Byron)
- **PR #3175** (2026-11-07): fix(gix-traverse): stop hidden painting once every queued commit is hidden (@MarkBlum-Shopify)
- **PR #3174** (2026-11-07): Avoid Git subprocesses for known Windows installations (@Byron)
- **PR #3173** (closed): Git-conformity for rename tracking (@Byron)

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

## X. gix-status): read rename candidate metadata from the open file

**RULE**:
When implementing operations in `gix-status/src/index_as_worktree_with_renames/mod.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in GitoxideLabs/gitoxide. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `cc8decf6`: gix-status): read rename candidate metadata from the open file. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `gix-status/src/index_as_worktree_with_renames/mod.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
                        ToGitOutcome::Unchanged(mut file) => {
                            // The path may have been removed or replaced since opening the file.
                            let file_size = file
                                .len();
                            gix_object::compute_stream_hash(
                                object_hash,
                                gix_object::Kind::Blob,
                                &mut file,
                                file_size,
                                &mut gix_utils::progress::Discard,
                                should_interrupt,
                            )
                            .or_raise(|| message!("Could not hash worktree file \"{}\"", file_path.display()))?
                        }
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
                        ToGitOutcome::Unchanged(mut file) => gix_object::compute_stream_hash(
                            object_hash,
                            gix_object::Kind::Blob,
                            &mut file,
                            file_path
                                .len(),
                            &mut gix_utils::progress::Discard,
                            should_interrupt,
                        )
                        .or_raise(|| message!("Could not hash worktree file \"{}\"", file_path.display()))?,
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `cc8decf6` are properly handled with clean fallback behavior.
