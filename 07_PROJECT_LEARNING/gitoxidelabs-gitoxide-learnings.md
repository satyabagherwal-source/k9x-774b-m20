> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/gitoxidelabs-gitoxide-learnings.md`  
> **Source**: github ([https://github.com/GitoxideLabs/gitoxide](https://github.com/GitoxideLabs/gitoxide))  
> **Source Version**: `7a229482`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-21T00:21:49.433Z  
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
> **Harvest Timestamp**: 2026-10-21T00:21:49.425Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `GitoxideLabs/gitoxide`
- **Description**: An idiomatic, lean, fast & safe pure Rust implementation of Git
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 12036 stars

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
- **Issue #3079** (2026-10-20): **perf(gix): don't look for new packs before writing an object**
  *Symptoms*: Before writing an object, gix checks whether it already exists so it doesn't write duplicates (`Repository::write_object()`, `write_blob()`, `write_blob_stream()` and the `gix_object::Write` implementation). A new object never exists. With the default `RefreshMode::AfterAllIndicesLoaded`, each of those misses calls `consolidate_with_disk_state()`, which lists the pack directory and stats every index file. Writing N new objects reads the pack directory N times, and each read gets slower as packs accumulate.  This adds `exists_without_refresh()` to gix-odb's dynamic `Handle`, plus a `memory::Proxy` version that checks the in-memory objects first. It runs the same lookup as `contains()`, with `RefreshMode::Never` for that call only. The store is still initialized on first use, and every index it already knows about is still loaded. The write paths in gix now use it.  If another process added a pack containing the object since the last refresh, the object is written again as a loose object, and `git gc` removes it later. Git's own write path does the same: `odb_freshen_object()` calls `find_pack_entry()`, which looks only at packs that are already prepared. Git re-reads the pack directory (`packfile_store_reprepare()`) only when a read misses. `exists()` keeps its behaviour, because reads still need the refresh to see packs written by other processes, for example by a fetch.  `exists_without_refresh` in the gix-odb store tests checks that the new method still finds packed and loo

- **Issue #3078** (2026-10-20): **perf(gix-filter): only read the index object when there is a CRLF to convert**
  *Symptoms*: In auto-text mode (`text=auto`, or `core.autocrlf` without a `text` attribute), `eol::convert_to_git()` reads the path's object from the index to see whether it was committed with CRLF, so that files committed with CRLF stay that way. That check can only turn a conversion off. When the worktree content has no CRLF there is nothing to turn off, but the object was still looked up and decompressed for every file going through the filter.  `gix status` sends a file through the filter whenever its stat doesn't match the index entry but its size does. Unchanged files end up there after a copy or extraction that changes ctimes, after an index is written without stat information, and while they are racily clean. gix only writes the refreshed stat back if the caller asks for it, so tools that run status repeatedly pay this on every call. Git's `crlf_to_git()` reads the object unconditionally too, but `git status` refreshes the index, so unchanged files rarely get there twice.  Now the object is only read when the content has a CRLF. The conversion, its result and the round-trip checks are unchanged. `no_crlf_means_no_work` asserts that auto mode no longer consults the index without a CRLF, and `crlf_in_index_prevents_conversion_to_lf` now uses input with a CRLF, so the index check is what keeps it from converting.  ### Impact  `gix status --no-write` on a repository with 3,204 tracked files whose index entries all have a stale ctime (it was extracted from a tarball), Apple M3 Pro with

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

### Incident Patch 1: `de997d9c` (2026-10-19)
**Commit Message**: fix(gix-protocol): receive early HTTP fetch packs with `no-done` (#3073)

<!-- agent -->
Smart HTTP can finish negotiation before the client has exhausted its
`have` list. With `no-done`, Git sends `ACK ... ready`, `NAK`, a final
`ACK`, and the pack in the same response. Treating that `NAK` as the end
of the response starts another request while reqwest is still sending
the previous body, deadlocking both threads.

Pass the negotiated `no-done` capability to the existing response parser
so it keeps reading after `ready`. Preserve the extra `done` round when
the capability is absent. Before starting another HTTP request, reject
unconsumed response-body bytes so a protocol-layer mistake produces an
error instead of blocking the worker. Expose the underlying packet-line
reader for this HTTP body check.

The fetch regression fails before the fix by performing two negotiation
rounds instead of one. It uses the existing Git response fixture and
also checks the case without `no-done`. The reqwest regression leaves a
large response unread and fails with a bounded timeout before the fix.

Git reference: `6de20f6092dcf9bdb1c8efe03db4b70c82b423dd`
(`v2.56.0-116-g6de20f6092`), `upload-pack.c:g

**File**: `gix-packetline/src/read.rs` (modified, +12/-0)
```diff
@@ -54,6 +54,18 @@ pub struct StreamingPeekableIterState<T> {
 }
 
 impl<T> StreamingPeekableIterState<T> {
+    /// Return the underlying reader, bypassing any buffered packet line.
+    ///
+    /// This is useful for checking transport-level EOF after packet-line iteration has stopped at a delimiter.
+    /// For example, an HTTP transport can use [`std::io::BufRead::fill_buf()`] to check that the previous response
+    /// body is exhausted before starting another request, without decoding another packet line.
+    ///
+    /// Any packet line already buffered by this iterator remains buffered and is not visible through this reader.
+    /// Reading from it directly advances the underlying stream without updating the iterator's state.
+    pub fn inner_mut(&mut self) -> &mut T {
+        &mut self.read
+    }
+
     /// Return a new instance from `read` which will stop decoding packet lines when receiving one of the given `delimiters`.
     /// If `trace` is `true`, all packetlines received or sent will be passed to the facilities of the `gix-trace` crate.
     #[cfg(any(feature = "blocking-io", feature = "async-io"))]
```

**File**: `gix-protocol/src/fetch/function.rs` (modified, +9/-4)
```diff
@@ -73,6 +73,7 @@ where
 
     crate::fetch::Response::check_required_features(protocol_version, &fetch_features)?;
     let sideband_all = fetch_features.iter().any(|(n, _)| *n == "sideband-all");
+    let no_done = fetch_features.iter().any(|(n, _)| *n == "no-done");
     let mut arguments = Arguments::new(protocol_version, fetch_features, trace_packetlines);
     if matches!(tags, Tags::Included) {
         if !arguments.can_use_include_tag() {
@@ -126,10 +127,14 @@ where
                 if sideband_all {
                     setup_remote_progress(&mut progress, &mut reader, should_interrupt);
                 }
-                let response =
-                    crate::fetch::Response::from_line_reader(protocol_version, &mut reader, is_done, !is_done)
-                        .await
-                        .or_raise(|| message("Could not decode server reply"))?;
+                let response = crate::fetch::Response::from_line_reader(
+                    protocol_version,
+                    &mut reader,
+                    is_done || no_done,
+                    !is_done,
+                )
+                .await
+                .or_raise(|| message("Could not decode server reply"))?;
                 let has_pack = response.has_pack();
                 previous_response = Some(response);
                 if has_pack {
```

**File**: `gix-protocol/src/fetch/response/io.rs` (modified, +3/-3)
```diff
@@ -38,8 +38,8 @@ async fn parse_v2_section<'a, T>(
 impl Response {
     /// Parse a response of the given `version` of the protocol from `reader`.
     ///
-    /// `client_expects_pack` is only relevant for V1 stateful connections, and if `false`, causes us to stop parsing when seeing `NAK`,
-    /// and if `true` we will keep parsing until we get a pack as the client already signalled to the server that it's done.
+    /// `client_expects_pack` is only relevant for V1 connections. Set it when the client sent `done` or negotiated `no-done`,
+    /// so that `ready` followed by `NAK` allows us to keep parsing until the pack. Otherwise `NAK` ends the round.
     /// This way of doing things allows us to exploit knowledge about more recent versions of the protocol, which keeps code easier
     /// and more localized without having to support all the cruft that there is.
     ///
@@ -99,7 +99,7 @@ impl Response {
                         0,
                         "consuming a peeked line works"
                     );
-                    // When the server sends ready, we know there is going to be a pack so no need to stop early.
+                    // With no-done negotiated, ready promises a pack even before the client sends done.
                     saw_ready |= matches!(acks.last(), Some(Acknowledgement::Ready));
                     if let Some(Acknowledgement::Nak) = acks.last().filter(|_| !client_expects_pack || !saw_ready) {
                         if !wants_to_negotiate {
```

**File**: `gix-protocol/tests/protocol/fetch/v1.rs` (modified, +101/-0)
```diff
@@ -6,6 +6,107 @@ use gix_utils::progress;
 
 use crate::fetch::{_impl::FetchConnection, CloneDelegate, LsRemoteDelegate, helper_unused, oid, transport};
 
+#[crate::bisync::bisync]
+#[cfg_attr(feature = "blocking-client", test)]
+#[cfg_attr(all(feature = "async-client", not(feature = "blocking-client")), async_std::test)]
+async fn fetch_receives_pack_after_ready_with_no_done() -> TestResult {
+    use gix_error::{Result, ResultExt};
+    use gix_protocol::fetch::{self, negotiate};
+
+    struct Negotiation;
+    impl fetch::Negotiate for Negotiation {
+        fn mark_complete_and_common_ref(&mut self) -> Result<negotiate::Action> {
+            Ok(negotiate::Action::MustNegotiate {
+                remote_ref_target_known: vec![false],
+            })
+        }
+
+        fn add_wants(&mut self, arguments: &mut fetch::Arguments, _known: &[bool]) -> bool {
+            arguments.want(oid("6504930888c9c5337e7e065c964f87b60d16a7d7"));
+            true
+        }
+
+        fn one_round(
+            &mut self,
+            _state: &mut negotiate::one_round::State,
+            arguments: &mut fetch::Arguments,
+            previous_response: Option<&fetch::Response>,
+        ) -> Result<(negotiate::Round, bool)> {
+            let is_done = previous_response.is_some();
+            if !is_done {
+                arguments.have(oid("f22743895a3024bb0c958335981439f1fa747d57"));
+            }
+            Ok((
+                negotiate::Round {
+                    haves_sent: usize::from(!is_done),
+                    in_vain: 0,
+                    haves_to_send: 16,
+                    previous_response_had_at_least_one_in_common: is_done,
+                },
+                is_done,
+            ))
+        }
+    }
+
+    let temp = gix_testtools::tempfile::tempdir()?;
+    for no_done in [false, true] {
+        let capabilities = format!(
+            "{} HEAD\0multi_ack_detailed side-band-64k{}",
+            "6504930888c9c5337e7e065c964f87b60d16a7d7",
+            if no_done { " no-done" } else { "" }
+        );
+        let mut handshake = gix_protocol::Handshake {
+            server_protocol_version: Protocol::V1,
+            capabilities: gix_transport::client::Capabilities::from_bytes(capabilities.as_bytes())?.0,
+            refs: None,
+            v1_shallow_updates: None,
+        };
+        // Git's response contains ready, NAK, a final ACK, and the sideband pack.
+        let mut transport = transport(
+            Vec::new(),
+            "v1/fetch.response",
+            Protocol::V1,
+            gix_transport::client::git::ConnectMode::Process,
+        );
+        let mut pack = Vec::new();
+        let outcome = gix_protocol::fetch(
+            &mut Negotiation,
+            |reader, _, _| {
+                reader.read_to_end(&mut pack).or_error()?;
+                Ok(true)
+            },
+            progress::Discard,
+            &std::sync::atomic::AtomicBool::new(false),
+            fetch::Context {
+                handshake: &mut handshake,
+                transport: &mut transport,
+                user_agent: ("agent", Some("test".into())),
+                trace_packetlines: false,
+            },
+            fetch::Options {
+                shallow_file: temp.path().join("shallow"),
+                shallow: &fetch::Shallow::NoChange,
+                tags: fetch::Tags::None,
+                reject_shallow_remote: false,
+            },
+        )
+        .await?
+        .expect("negotiation receives a pack");
+        assert!(pack.starts_with(b"PACK"), "the final ACK is consumed before the pack");
+        assert_eq!(
+            outcome.negotiate.rounds.len(),
+            if no_done { 1 } else { 2 },
+            "only no-done allows receiving a pack before the client is done"
+        );
+        assert_eq!(
+            transport.into_inner().1.contains_str("done\n"),
+            !no_done,
+            "without no-done, ready still requires sending done"
+        );
+    }
+    Ok(())
+}
+
 #[crate::bisync::bisync]
 #[cfg_attr(feature = "blocking-client", test)]
 #[cfg_attr(all(feature = "async-client", not(feature = "blocking-client")), async_std::test)]
```

**File**: `gix-transport/src/client/blocking_io/http/mod.rs` (modified, +8/-0)
```diff
@@ -465,6 +465,14 @@ impl<H: Http> blocking_io::Transport for Transport<H> {
         trace: bool,
     ) -> std::result::Result<RequestWriter<'_>, client::Error> {
         let service = self.service.ok_or(client::Error::MissingHandshake)?;
+        // A worker cannot accept another request while blocked sending the previous response.
+        if let Some(previous_response) = self.line_provider.as_mut()
+            && !previous_response.inner_mut().fill_buf()?.is_empty()
+        {
+            return Err(client::Error::Http(
+                message("previous HTTP response body was not fully consumed").raise(),
+            ));
+        }
         let url = append_url(&self.url, service.as_str());
         let static_headers = &[
             Cow::Borrowed(self.user_agent_header),
```

**File**: `gix-transport/tests/client/blocking_io/http/mod.rs` (modified, +72/-2)
```diff
@@ -30,6 +30,74 @@ type Remote = http::curl::Curl;
 #[cfg(all(feature = "http-client-reqwest", not(feature = "http-client-curl")))]
 type Remote = http::reqwest::Remote;
 
+#[test]
+fn next_request_rejects_an_unread_response_body() -> gix_testtools::TestResult {
+    use gix_transport::client::{MessageKind, WriteMode};
+
+    let listener = std::net::TcpListener::bind("127.0.0.1:0")?;
+    let url = format!("http://{}/repo", listener.local_addr()?);
+    let server = std::thread::spawn(move || -> std::io::Result<()> {
+        let mut response = b"0008NAK\n".to_vec();
+        // More than one copy buffer keeps the worker blocked after the protocol stops at NAK.
+        response.resize(32 * 1024, b'x');
+        for (content_type, body) in [
+            ("advertisement", b"000eversion 2\n000cls-refs\n000afetch\n0000".to_vec()),
+            ("result", response),
+        ] {
+            let (stream, _) = listener.accept()?;
+            stream.set_read_timeout(Some(std::time::Duration::from_secs(5)))?;
+            let mut reader = std::io::BufReader::new(stream);
+            read_request_lines(&mut reader);
+            if content_type == "result" {
+                let mut request = [0; 4];
+                reader.read_exact(&mut request)?;
+                assert_eq!(&request, b"0000", "the request contains only a flush packet");
+            }
+            write!(
+                reader.get_mut(),
+                "HTTP/1.1 200 OK\r\n\
+                 Content-Type: application/x-git-upload-pack-{content_type}\r\n\
+                 Content-Length: {}\r\n\
+                 Connection: close\r\n\
+                 \r\n",
+                body.len()
+            )?;
+            reader.get_mut().write_all(&body)?;
+        }
+        Ok(())
+    });
+
+    let mut client = http::connect::<Remote>(url.as_str().try_into()?, Protocol::V2, false);
+    client.handshake(Service::UploadPack, &[])?;
+    let mut response = client
+        .request(WriteMode::OneLfTerminatedLinePerWriteCall, MessageKind::Flush, false)?
+        .into_read()?;
+    let mut line = String::new();
+    response.read_line(&mut line)?;
+    assert_eq!(line, "NAK\n", "the protocol stops before the remaining response body");
+    drop(response);
+    server.join().expect("HTTP server thread completed")?;
+
+    let (send, receive) = std::sync::mpsc::channel();
+    let request = std::thread::spawn(move || {
+        let result = client
+            .request(WriteMode::OneLfTerminatedLinePerWriteCall, MessageKind::Flush, false)
+            .map(|_| ())
+            .map_err(|err| format!("{err:?}"));
+        send.send(result).expect("the test is waiting for the request result");
+    });
+    let error = receive
+        .recv_timeout(std::time::Duration::from_secs(5))
+        .expect("an unread response must cause an error instead of a deadlock")
+        .expect_err("the next request must reject the unread response");
+    request.join().expect("request thread completed");
+    assert!(
+        error.contains("previous HTTP response body was not fully consumed"),
+        "the error explains why the next request cannot start: {error}"
+    );
+    Ok(())
+}
+
 fn assert_error_status(
     status: usize,
     kind: std::io::ErrorKind,
@@ -285,7 +353,8 @@ fn http_authentication_error_can_be_differentiated_and_identity_is_transmitted()
         password: "password".into(),
         oauth_refresh_token: None,
     })?;
-    client.handshake(Service::UploadPack, &[])?;
+    let SetServiceResponse { refs, .. } = client.handshake(Service::UploadPack, &[])?;
+    io::copy(&mut refs.expect("refs in protocol V1"), &mut io::sink())?;
 
     assert_eq!(
         server
@@ -556,7 +625,8 @@ fn redirected_post_does_not_forward_basic_auth_to_the_new_host() -> TestResult {
         oauth_refresh_token: None,
     })?;
 
-    client.handshake(Service::UploadPack, &[]).map(drop)?;
+    let SetServiceResponse { refs, .. } = client.handshake(Service::UploadPack, &[])?;
+    io::copy(&mut refs.expect("refs in protocol V1"), &mut io::sink())?;
     let url_after_handshake = client.to_url().as_ref().to_owned();
     let mut request = client.request(client::WriteMode::Binary, client::MessageKind::Flush, false)?;
     request.write_all(b"0000")?;
```

**File**: `gix-transport/tests/http_helpers/mod.rs` (modified, +11/-1)
```diff
@@ -9,10 +9,20 @@ pub(crate) fn response_with_connection_close(response: &[u8]) -> Vec<u8> {
     let (headers, body) = response.split_at(split);
     let body = &body[2..];
     let headers = std::str::from_utf8(headers).expect("fixture headers are UTF-8");
+    // Text fixtures end with a newline which is not part of the final flush packet.
+    let body = if body.ends_with(b"0000\n") {
+        &body[..body.len() - 1]
+    } else {
+        body
+    };
 
     let mut out = Vec::with_capacity(response.len() + 64);
     for line in headers.lines() {
-        out.extend_from_slice(line.as_bytes());
+        if line.to_ascii_lowercase().starts_with("content-length:") {
+            out.extend_from_slice(format!("Content-Length: {}", body.len()).as_bytes());
+        } else {
+            out.extend_from_slice(line.as_bytes());
+        }
         out.extend_from_slice(b"\r\n");
     }
     out.extend_from_slice(b"Connection: close\r\n\r\n");
```

---

### Incident Patch 2: `ba550491` (2026-10-20)
**Commit Message**: Merge pull request #3075 from GitoxideLabs/fix-fetch

Fix HTTP fetch hangs with protocol V1 and no-done

**File**: `gix-packetline/src/read.rs` (modified, +12/-0)
```diff
@@ -54,6 +54,18 @@ pub struct StreamingPeekableIterState<T> {
 }
 
 impl<T> StreamingPeekableIterState<T> {
+    /// Return the underlying reader, bypassing any buffered packet line.
+    ///
+    /// This is useful for checking transport-level EOF after packet-line iteration has stopped at a delimiter.
+    /// For example, an HTTP transport can use [`std::io::BufRead::fill_buf()`] to check that the previous response
+    /// body is exhausted before starting another request, without decoding another packet line.
+    ///
+    /// Any packet line already buffered by this iterator remains buffered and is not visible through this reader.
+    /// Reading from it directly advances the underlying stream without updating the iterator's state.
+    pub fn inner_mut(&mut self) -> &mut T {
+        &mut self.read
+    }
+
     /// Return a new instance from `read` which will stop decoding packet lines when receiving one of the given `delimiters`.
     /// If `trace` is `true`, all packetlines received or sent will be passed to the facilities of the `gix-trace` crate.
     #[cfg(any(feature = "blocking-io", feature = "async-io"))]
```

**File**: `gix-protocol/src/fetch/function.rs` (modified, +9/-4)
```diff
@@ -73,6 +73,7 @@ where
 
     crate::fetch::Response::check_required_features(protocol_version, &fetch_features)?;
     let sideband_all = fetch_features.iter().any(|(n, _)| *n == "sideband-all");
+    let no_done = fetch_features.iter().any(|(n, _)| *n == "no-done");
     let mut arguments = Arguments::new(protocol_version, fetch_features, trace_packetlines);
     if matches!(tags, Tags::Included) {
         if !arguments.can_use_include_tag() {
@@ -126,10 +127,14 @@ where
                 if sideband_all {
                     setup_remote_progress(&mut progress, &mut reader, should_interrupt);
                 }
-                let response =
-                    crate::fetch::Response::from_line_reader(protocol_version, &mut reader, is_done, !is_done)
-                        .await
-                        .or_raise(|| message("Could not decode server reply"))?;
+                let response = crate::fetch::Response::from_line_reader(
+                    protocol_version,
+                    &mut reader,
+                    is_done || no_done,
+                    !is_done,
+                )
+                .await
+                .or_raise(|| message("Could not decode server reply"))?;
                 let has_pack = response.has_pack();
                 previous_response = Some(response);
                 if has_pack {
```

**File**: `gix-protocol/src/fetch/response/io.rs` (modified, +3/-3)
```diff
@@ -38,8 +38,8 @@ async fn parse_v2_section<'a, T>(
 impl Response {
     /// Parse a response of the given `version` of the protocol from `reader`.
     ///
-    /// `client_expects_pack` is only relevant for V1 stateful connections, and if `false`, causes us to stop parsing when seeing `NAK`,
-    /// and if `true` we will keep parsing until we get a pack as the client already signalled to the server that it's done.
+    /// `client_expects_pack` is only relevant for V1 connections. Set it when the client sent `done` or negotiated `no-done`,
+    /// so that `ready` followed by `NAK` allows us to keep parsing until the pack. Otherwise `NAK` ends the round.
     /// This way of doing things allows us to exploit knowledge about more recent versions of the protocol, which keeps code easier
     /// and more localized without having to support all the cruft that there is.
     ///
@@ -99,7 +99,7 @@ impl Response {
                         0,
                         "consuming a peeked line works"
                     );
-                    // When the server sends ready, we know there is going to be a pack so no need to stop early.
+                    // With no-done negotiated, ready promises a pack even before the client sends done.
                     saw_ready |= matches!(acks.last(), Some(Acknowledgement::Ready));
                     if let Some(Acknowledgement::Nak) = acks.last().filter(|_| !client_expects_pack || !saw_ready) {
                         if !wants_to_negotiate {
```

**File**: `gix-protocol/tests/protocol/fetch/v1.rs` (modified, +101/-0)
```diff
@@ -6,6 +6,107 @@ use gix_utils::progress;
 
 use crate::fetch::{_impl::FetchConnection, CloneDelegate, LsRemoteDelegate, helper_unused, oid, transport};
 
+#[crate::bisync::bisync]
+#[cfg_attr(feature = "blocking-client", test)]
+#[cfg_attr(all(feature = "async-client", not(feature = "blocking-client")), async_std::test)]
+async fn fetch_receives_pack_after_ready_with_no_done() -> TestResult {
+    use gix_error::{Result, ResultExt};
+    use gix_protocol::fetch::{self, negotiate};
+
+    struct Negotiation;
+    impl fetch::Negotiate for Negotiation {
+        fn mark_complete_and_common_ref(&mut self) -> Result<negotiate::Action> {
+            Ok(negotiate::Action::MustNegotiate {
+                remote_ref_target_known: vec![false],
+            })
+        }
+
+        fn add_wants(&mut self, arguments: &mut fetch::Arguments, _known: &[bool]) -> bool {
+            arguments.want(oid("6504930888c9c5337e7e065c964f87b60d16a7d7"));
+            true
+        }
+
+        fn one_round(
+            &mut self,
+            _state: &mut negotiate::one_round::State,
+            arguments: &mut fetch::Arguments,
+            previous_response: Option<&fetch::Response>,
+        ) -> Result<(negotiate::Round, bool)> {
+            let is_done = previous_response.is_some();
+            if !is_done {
+                arguments.have(oid("f22743895a3024bb0c958335981439f1fa747d57"));
+            }
+            Ok((
+                negotiate::Round {
+                    haves_sent: usize::from(!is_done),
+                    in_vain: 0,
+                    haves_to_send: 16,
+                    previous_response_had_at_least_one_in_common: is_done,
+                },
+                is_done,
+            ))
+        }
+    }
+
+    let temp = gix_testtools::tempfile::tempdir()?;
+    for no_done in [false, true] {
+        let capabilities = format!(
+            "{} HEAD\0multi_ack_detailed side-band-64k{}",
+            "6504930888c9c5337e7e065c964f87b60d16a7d7",
+            if no_done { " no-done" } else { "" }
+        );
+        let mut handshake = gix_protocol::Handshake {
+            server_protocol_version: Protocol::V1,
+            capabilities: gix_transport::client::Capabilities::from_bytes(capabilities.as_bytes())?.0,
+            refs: None,
+            v1_shallow_updates: None,
+        };
+        // Git's response contains ready, NAK, a final ACK, and the sideband pack.
+        let mut transport = transport(
+            Vec::new(),
+            "v1/fetch.response",
+            Protocol::V1,
+            gix_transport::client::git::ConnectMode::Process,
+        );
+        let mut pack = Vec::new();
+        let outcome = gix_protocol::fetch(
+            &mut Negotiation,
+            |reader, _, _| {
+                reader.read_to_end(&mut pack).or_error()?;
+                Ok(true)
+            },
+            progress::Discard,
+            &std::sync::atomic::AtomicBool::new(false),
+            fetch::Context {
+                handshake: &mut handshake,
+                transport: &mut transport,
+                user_agent: ("agent", Some("test".into())),
+                trace_packetlines: false,
+            },
+            fetch::Options {
+                shallow_file: temp.path().join("shallow"),
+                shallow: &fetch::Shallow::NoChange,
+                tags: fetch::Tags::None,
+                reject_shallow_remote: false,
+            },
+        )
+        .await?
+        .expect("negotiation receives a pack");
+        assert!(pack.starts_with(b"PACK"), "the final ACK is consumed before the pack");
+        assert_eq!(
+            outcome.negotiate.rounds.len(),
+            if no_done { 1 } else { 2 },
+            "only no-done allows receiving a pack before the client is done"
+        );
+        assert_eq!(
+            transport.into_inner().1.contains_str("done\n"),
+            !no_done,
+            "without no-done, ready still requires sending done"
+        );
+    }
+    Ok(())
+}
+
 #[crate::bisync::bisync]
 #[cfg_attr(feature = "blocking-client", test)]
 #[cfg_attr(all(feature = "async-client", not(feature = "blocking-client")), async_std::test)]
```

**File**: `gix-transport/src/client/blocking_io/http/mod.rs` (modified, +8/-0)
```diff
@@ -465,6 +465,14 @@ impl<H: Http> blocking_io::Transport for Transport<H> {
         trace: bool,
     ) -> std::result::Result<RequestWriter<'_>, client::Error> {
         let service = self.service.ok_or(client::Error::MissingHandshake)?;
+        // A worker cannot accept another request while blocked sending the previous response.
+        if let Some(previous_response) = self.line_provider.as_mut()
+            && !previous_response.inner_mut().fill_buf()?.is_empty()
+        {
+            return Err(client::Error::Http(
+                message("previous HTTP response body was not fully consumed").raise(),
+            ));
+        }
         let url = append_url(&self.url, service.as_str());
         let static_headers = &[
             Cow::Borrowed(self.user_agent_header),
```

**File**: `gix-transport/tests/client/blocking_io/http/mod.rs` (modified, +72/-2)
```diff
@@ -30,6 +30,74 @@ type Remote = http::curl::Curl;
 #[cfg(all(feature = "http-client-reqwest", not(feature = "http-client-curl")))]
 type Remote = http::reqwest::Remote;
 
+#[test]
+fn next_request_rejects_an_unread_response_body() -> gix_testtools::TestResult {
+    use gix_transport::client::{MessageKind, WriteMode};
+
+    let listener = std::net::TcpListener::bind("127.0.0.1:0")?;
+    let url = format!("http://{}/repo", listener.local_addr()?);
+    let server = std::thread::spawn(move || -> std::io::Result<()> {
+        let mut response = b"0008NAK\n".to_vec();
+        // More than one copy buffer keeps the worker blocked after the protocol stops at NAK.
+        response.resize(32 * 1024, b'x');
+        for (content_type, body) in [
+            ("advertisement", b"000eversion 2\n000cls-refs\n000afetch\n0000".to_vec()),
+            ("result", response),
+        ] {
+            let (stream, _) = listener.accept()?;
+            stream.set_read_timeout(Some(std::time::Duration::from_secs(5)))?;
+            let mut reader = std::io::BufReader::new(stream);
+            read_request_lines(&mut reader);
+            if content_type == "result" {
+                let mut request = [0; 4];
+                reader.read_exact(&mut request)?;
+                assert_eq!(&request, b"0000", "the request contains only a flush packet");
+            }
+            write!(
+                reader.get_mut(),
+                "HTTP/1.1 200 OK\r\n\
+                 Content-Type: application/x-git-upload-pack-{content_type}\r\n\
+                 Content-Length: {}\r\n\
+                 Connection: close\r\n\
+                 \r\n",
+                body.len()
+            )?;
+            reader.get_mut().write_all(&body)?;
+        }
+        Ok(())
+    });
+
+    let mut client = http::connect::<Remote>(url.as_str().try_into()?, Protocol::V2, false);
+    client.handshake(Service::UploadPack, &[])?;
+    let mut response = client
+        .request(WriteMode::OneLfTerminatedLinePerWriteCall, MessageKind::Flush, false)?
+        .into_read()?;
+    let mut line = String::new();
+    response.read_line(&mut line)?;
+    assert_eq!(line, "NAK\n", "the protocol stops before the remaining response body");
+    drop(response);
+    server.join().expect("HTTP server thread completed")?;
+
+    let (send, receive) = std::sync::mpsc::channel();
+    let request = std::thread::spawn(move || {
+        let result = client
+            .request(WriteMode::OneLfTerminatedLinePerWriteCall, MessageKind::Flush, false)
+            .map(|_| ())
+            .map_err(|err| format!("{err:?}"));
+        send.send(result).expect("the test is waiting for the request result");
+    });
+    let error = receive
+        .recv_timeout(std::time::Duration::from_secs(5))
+        .expect("an unread response must cause an error instead of a deadlock")
+        .expect_err("the next request must reject the unread response");
+    request.join().expect("request thread completed");
+    assert!(
+        error.contains("previous HTTP response body was not fully consumed"),
+        "the error explains why the next request cannot start: {error}"
+    );
+    Ok(())
+}
+
 fn assert_error_status(
     status: usize,
     kind: std::io::ErrorKind,
@@ -285,7 +353,8 @@ fn http_authentication_error_can_be_differentiated_and_identity_is_transmitted()
         password: "password".into(),
         oauth_refresh_token: None,
     })?;
-    client.handshake(Service::UploadPack, &[])?;
+    let SetServiceResponse { refs, .. } = client.handshake(Service::UploadPack, &[])?;
+    io::copy(&mut refs.expect("refs in protocol V1"), &mut io::sink())?;
 
     assert_eq!(
         server
@@ -556,7 +625,8 @@ fn redirected_post_does_not_forward_basic_auth_to_the_new_host() -> TestResult {
         oauth_refresh_token: None,
     })?;
 
-    client.handshake(Service::UploadPack, &[]).map(drop)?;
+    let SetServiceResponse { refs, .. } = client.handshake(Service::UploadPack, &[])?;
+    io::copy(&mut refs.expect("refs in protocol V1"), &mut io::sink())?;
     let url_after_handshake = client.to_url().as_ref().to_owned();
     let mut request = client.request(client::WriteMode::Binary, client::MessageKind::Flush, false)?;
     request.write_all(b"0000")?;
```

**File**: `gix-transport/tests/http_helpers/mod.rs` (modified, +11/-1)
```diff
@@ -9,10 +9,20 @@ pub(crate) fn response_with_connection_close(response: &[u8]) -> Vec<u8> {
     let (headers, body) = response.split_at(split);
     let body = &body[2..];
     let headers = std::str::from_utf8(headers).expect("fixture headers are UTF-8");
+    // Text fixtures end with a newline which is not part of the final flush packet.
+    let body = if body.ends_with(b"0000\n") {
+        &body[..body.len() - 1]
+    } else {
+        body
+    };
 
     let mut out = Vec::with_capacity(response.len() + 64);
     for line in headers.lines() {
-        out.extend_from_slice(line.as_bytes());
+        if line.to_ascii_lowercase().starts_with("content-length:") {
+            out.extend_from_slice(format!("Content-Length: {}", body.len()).as_bytes());
+        } else {
+            out.extend_from_slice(line.as_bytes());
+        }
         out.extend_from_slice(b"\r\n");
     }
     out.extend_from_slice(b"Connection: close\r\n\r\n");
```

#### Recent Merged Pull Requests:
- **PR #3079** (2026-10-20): perf(gix): don't look for new packs before writing an object (@krlvi)
- **PR #3078** (2026-10-20): perf(gix-filter): only read the index object when there is a CRLF to convert (@krlvi)
- **PR #3077** (2026-10-20): Fix text merge alignment for repeated lines (@Byron)
- **PR #3075** (2026-10-20): Fix HTTP fetch hangs with protocol V1 and no-done (@Byron)
- **PR #3074** (2026-10-19): fix/imara myers whole file occurrences (@Byron)
- **PR #3072** (2026-10-19): fix(gix-status): match Git's filter path so Git LFS extensions don't show false modifications (@juanibiapina)

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

## X. gix-protocol): receive early HTTP fetch packs with `no-done` (#3073)

**RULE**:
When implementing operations in `gix-packetline/src/read.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in GitoxideLabs/gitoxide. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `de997d9c`: gix-protocol): receive early HTTP fetch packs with `no-done` (#3073). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `gix-packetline/src/read.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    /// Return the underlying reader, bypassing any buffered packet line.
    ///
    /// This is useful for checking transport-level EOF after packet-line iteration has stopped at a delimiter.
    /// For example, an HTTP transport can use [`std::io::BufRead::fill_buf()`] to check that the previous response
    /// body is exhausted before starting another request, without decoding another packet line.
    ///
    /// Any packet line already buffered by this iterator remains buffered and is not visible through this reader.
    /// Reading from it directly advances the underlying stream without updating the iterator's state.
    pub fn inner_mut(&mut self) -> &mut T {
        &mut self.read
    }

```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `de997d9c` are properly handled with clean fallback behavior.
