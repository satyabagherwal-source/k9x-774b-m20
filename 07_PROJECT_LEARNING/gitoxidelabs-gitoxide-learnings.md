# Forensic Learning Record (Deep Inspection): GitoxideLabs/gitoxide

> **Canonical Artifact**: `07_PROJECT_LEARNING/gitoxidelabs-gitoxide-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/GitoxideLabs/gitoxide](https://github.com/GitoxideLabs/gitoxide))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:30:22.128Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `GitoxideLabs/gitoxide`
- **Description**: An idiomatic, lean, fast & safe pure Rust implementation of Git
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 11993 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/log.rs`
```
use std::{
    io::{Write, stdout},
    path::{Path, PathBuf},
};

/// A toy-version of `git log`.
use clap::Parser;
use gix::{
    bstr::{BString, ByteSlice},
    date::time::format,
    revision::walk::Sorting,
};

fn main() {
    let args = Args::parse_from(gix::env::args_os());
    match run(args) {
        Ok(()) => {}
        Err(e) => eprintln!("error: {e}"),
    }
}

#[derive(Debug, clap::Parser)]
#[clap(name = "log", about = "git log example", version = option_env!("GIX_VERSION"))]
struct Args {
    /// Alternative git directory to use
    #[clap(name = "dir", long = "git-dir")]
    git_dir: Option<PathBuf>,
    /// Number of commits to return
    #[clap(short, long)]
    count: Option<usize>,
    /// Number of commits to skip
    #[clap(short, long)]
    skip: Option<usize>,
    /// Commits are sorted as they are mentioned in the commit graph.
    #[clap(short, long)]
    breadth_first: bool,
    /// Commits are sorted by their commit time in descending order.
    #[clap(short, long)]
    newest_first: bool,
    /// Show commits with the specified minimum number of parents
    #[clap(long)]
    min_parents: Option<usize>,
    /// Show commits with the specified maximum number of parents
    #[clap(long)]
    max_parents: Option<usize>,
    /// Show only merge commits (implies --min-parents=2)
    #[clap(long)]
    merges: bool,
    /// Show only non-merge commits (implies --max-parents=1)
    #[clap(long)]
    no_merges: bool,
    /// Reverse the commit sort order (and loads all of them into memory).
    #[clap(short, long)]
    reverse: bool,
    /// The ref-spec for the first commit to log, or HEAD.
    #[clap(name = "commit")]
    committish: Option<String>,
    /// The path interested in log history of
    #[clap(name = "path")]
    paths: Vec<PathBuf>,
}

fn run(args: Args) -> anyhow::Result<()> {
    let repo = gix::discover(args.git_dir.as_deref().unwrap_or(Path::new(".")))?;
    let committish = args.committish.map(|mut c| {
        c.push_str("^{commit}");
        c
    });
    let commit = repo
        .rev_parse_single(committish.as_deref().unwrap_or("HEAD"))?
        .object()?
        .try_into_commit()?;

    let sorting = if args.breadth_first {
        Sorting::BreadthFirst
    } else {
        // else if args.newest_first {
        Sorting::ByCommitTime(Default::default())
    };

    let mut min_parents = args.min_parents.unwrap_or(0);
    let mut max_parents = args.max_parents.unwrap_or(usize::MAX);
    if args.merges {
        min_parents = 2;
    }
    if args.no_merges {
        max_parents = 1;
    }

    let mut log_iter: Box<dyn Iterator<Item = Result<LogEntryInfo, _>>> = Box::new(
        repo.rev_walk([commit.id])
            .sorting(sorting)
            .all()?
            .filter(|info| {
                info.as_ref().map_or(true, |info| {
                    info.parent_ids.len() <= max_parents &&
                    info.parent_ids.len() >= min_parents &&
                    // if the list of paths is empty the filter passes.
                    // if paths are provided check that any one of them are
                    // in fact relevant for the current commit.
                    (args.paths.is_empty() || args.paths.iter().any(|path| {
                        // TODO: should make use of the `git2::DiffOptions`
                        //       counterpart in gix for a set of files and also to
                        //       generate diffs. When ready, also make paths resistant
                        //       to illformed UTF8 by not using ".display()".
                        // PERFORMANCE WARNING: What follows is a clever implementation
                        //    that is also **very** slow - do not use on bigger sample
                        //    repositories as this needs native support in `gix` to 
                        //    be fast enough.
                        match repo.rev_parse_single(
                            format!("{}:{}", info.id, path.display()).as_str()
                        ) {
                            // check by parsing the revspec on the path with
                            // the prefix of the tree of the current commit,
                            // vs. the same counterpart but using each of
                            // commit's parents; if any pairs don't match,
                            // this indicates this path was changed in this
                            // commit thus should be included in output.
                            // naturally, root commits have no parents and
                            // by definition whatever paths in there must
                            // have been introduced there, so include them.
                            Ok(oid) => info.parent_ids.is_empty() || info
                                .parent_ids
                                .iter()
                                .any(|id| {
                                    repo.rev_parse_single(
                                        format!("{id}:{}", path.display()).as_str()
                                    ).ok() != Some(oid)
                                }),
                            // no oid for the path resolved with this commit
                            // so this commit can be omitted from output.
                            Err(_) => false,
                        }
                    }))
                })
            })
            .map(|info| -> anyhow::Result<_> {
                let info = info?;
                let commit = info.object()?;
                let commit_ref = commit.decode()?;
                let author = commit_ref.author()?;
                Ok(LogEntryInfo {
                    commit_id: commit.id().to_hex().to_string(),
                    parents: info.parent_ids().map(|id| id.shorten_or_id().to_string()).collect(),
                    author: {
                        let mut buf = Vec::new();
                        author.actor().write_to(&mut buf)?;
                        buf.into()
                    },
                    time: author.time()?.format_or_unix(format::DEFAULT),
                    message: commit_ref.message.to_owned(),
                })
            }),
    );
    if args.reverse {
        let mut results: Vec<_> = log_iter.collect();
        results.reverse();
        log_iter = Box::new(results.into_iter());
    }

    let mut log_iter = log_iter
        .skip(args.skip.unwrap_or_default())
        .take(args.count.unwrap_or(usize::MAX))
        .peekable();

    let mut out = stdout().lock();
    let mut buf = Vec::new();
    while let Some(entry) = log_iter.next() {
        buf.clear();
        let entry = entry?;
        writeln!(buf, "commit {}", entry.commit_id)?;
        if entry.parents.len() > 1 {
            writeln!(buf, "Merge: {}", entry.parents.join(" "))?;
        }
        writeln!(buf, "Author: {}", entry.author)?;
        writeln!(buf, "Date:   {}\n", entry.time)?;
        for line in entry.message.lines() {
            write!(buf, "    ")?;
            buf.write_all(line)?;
            writeln!(buf)?;
        }
        // only include newline if more log entries, mimicking `git log`
        if log_iter.peek().is_some() {
            writeln!(buf)?;
        }
        out.write_all(&buf)?;
    }

    Ok(())
}

struct LogEntryInfo {
    commit_id: String,
    parents: Vec<String>,
    author: BString,
    time: String,
    message: BString,
}

```

### Core Architecture Module: `examples/ls-tree.rs`
```
use std::io::{Write, stdout};

use clap::Parser;
use gix::{ObjectId, bstr::BString, objs::tree::EntryMode, traverse::tree::Recorder};

fn main() {
    let args = Args::parse_from(gix::env::args_os());
    match run(args) {
        Ok(()) => {}
        Err(e) => eprintln!("error: {e}"),
    }
}

#[derive(Debug, clap::Parser)]
#[clap(name = "ls-tree", about = "git ls-tree example", version = option_env!("GIX_VERSION"))]
#[clap(arg_required_else_help = true)]
struct Args {
    /// Recurse into subtrees
    #[clap(short = 'r')]
    recursive: bool,
    /// Only show trees
    #[clap(short = 'd')]
    tree_only: bool,
    /// Show trees when recursing
    #[clap(short = 't')]
    tree_recursing: bool,
    /// A revspec pointing to a tree-ish object, e.g. 'HEAD', 'HEAD:src/'
    #[clap(name = "tree-ish")]
    treeish: String,
}

fn run(args: Args) -> anyhow::Result<()> {
    let repo = gix::discover(".")?;
    let tree = repo.rev_parse_single(&*args.treeish)?.object()?.peel_to_tree()?;
    let entries = if args.recursive {
        let mut recorder = Recorder::default();
        tree.traverse().breadthfirst(&mut recorder)?;
        recorder
            .records
            .into_iter()
            .filter(|entry| args.tree_recursing || args.tree_only || entry.mode.is_no_tree())
            .filter(|entry| !args.tree_only || (entry.mode.is_tree()))
            .map(|entry| Entry::new(entry.mode, entry.oid, entry.filepath))
            .collect::<Vec<_>>()
    } else {
        tree.iter()
            .filter_map(|res| res.ok().map(|entry| entry.inner)) // dropping errors silently
            .filter(|entry| !args.tree_only || (entry.mode.is_tree()))
            .map(|entry| Entry::new(entry.mode, entry.oid.to_owned(), entry.filename.to_owned()))
            .collect::<Vec<_>>()
    };

    let mut out = stdout().lock();
    for entry in entries {
        writeln!(
            out,
            "{:>6o} {:4} {}    {}",
            entry.mode,
            entry.mode.as_str(),
            entry.hash,
            entry.path
        )?;
    }

    Ok(())
}

struct Entry {
    mode: EntryMode,
    hash: ObjectId,
    path: BString,
}

impl Entry {
    fn new(mode: EntryMode, hash: ObjectId, path: BString) -> Self {
        Self { mode, hash, path }
    }
}

```

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
    use std::{io, path::Path};

    use crate::OutputFormat;
    use anyhow::Result;
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
            Some(OutputFormat::Json) => serde_json::to_writer_pretty(out, &stats)?,
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
use std::path::{Path, PathBuf};

use anyhow::{Context, bail};
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
    pub(crate) fn try_from(repo: &gix::Repository) -> anyhow::Result<Self> {
        let num_references = repo.refs.iter()?.all()?.count();
        let num_objects = repo.objects.packed_object_count()?;
        let odb_size = ByteSize(
            std::fs::read_dir(repo.objects.store_ref().path().join("pack"))
                .map(|dir| {
                    dir.filter_map(Result::ok)
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

pub fn create(path: impl AsRef<std::path::Path>) -> anyhow::Result<rusqlite::Connection> {
    let path = path.as_ref();
    let con = rusqlite::Connection::open(path)?;
    let meta_table = r#"
    CREATE TABLE if not exists meta(
        version int
    )"#;
    con.execute_batch(meta_table)?;
    let version: Option<usize> = con.query_row("SELECT version FROM meta", [], |r| r.get(0)).optional()?;
    match version {
        None => {
            con.execute("INSERT into meta(version) values(?)", params![VERSION])?;
        }
        Some(version) if version != VERSION => match con.close() {
            Ok(()) => {
                bail!(
                    "Cannot handle database with version {version}, cannot yet migrate to {VERSION} - maybe migrate by hand?"
                );
            }
            Err((_, err)) => return Err(err.into()),
        },
        _ => {}
    }
    con.execute_batch("PRAGMA synchronous = OFF; PRAGMA journal_mode = WAL; PRAGMA wal_checkpoint(FULL); ")?;
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
    )?;
    con.execute_batch(
        r#"
    CREATE TABLE if not exists corpus(
        id integer PRIMARY KEY,
        root text UNIQUE -- the root path of all repositories we want to consider, as canonicalized path
    )
    "#,
    )?;
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
    )?;
    con.execute_batch(
        r#"
    CREATE TABLE if not exists gitoxide_version(
        id integer PRIMARY KEY,
        version text UNIQUE -- the unique git version via gix describe
    )
    "#,
    )?;
    con.execute_batch(
        r#"
    CREATE TABLE if not exists task(
        id integer PRIMARY KEY,
        short_name UNIQUE, -- the unique and permanent identifier for the task
        description text UNIQUE -- the descriptive name of the task, it can be changed at will
    )
    "#,
    )?;
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
    )?;

    Ok(con)
}

/// Utilities
impl Engine {
    pub(crate) fn runner_id_or_insert(&self) -> anyhow::Result<Id> {
        let sys = sysinfo::System::new_with_specifics(
            RefreshKind::nothing().with_cpu(CpuRefreshKind::nothing().with_frequency()),
        );
        let cpu = &sys.cpus()[0];
        let vendor = Some(cpu.vendor_id().to_owned());
        let host = sysinfo::System::host_name();
        let brand = Some(cpu.brand().to_owned());
        Ok(self.con.query_row(
            "INSERT INTO runner (vendor, brand, host_name) VALUES (?1, ?2, ?3) \
                    ON CONFLICT DO UPDATE SET vendor = vendor, brand = brand, host_name = ?3 RETURNING id",
            [vendor.as_deref(), brand.as_deref(), host.as_deref()],
            |r| r.get(0),
        )?)
    }
    pub(crate) fn corpus_id_or_insert(&self, path: &Path) -> anyhow::Result<Id> {
        let path = path.to_str().context("corpus root cannot contain illformed UTF-8")?;
        Ok(self.con.query_row(
            "INSERT INTO corpus (root) VALUES (?1) \
                ON CONFLICT DO UPDATE SET root = root RETURNING id",
            [path],
            |r| r.get(0),
        )?)
    }
    pub(crate) fn gitoxide_version_id_or_insert(&self) -> anyhow::Result<Id> {
        Ok(self
                .con
                .query_row(
                    "INSERT INTO gitoxide_version (version) VALUES (?1) ON CONFLICT DO UPDATE SET version = version RETURNING id",
                    [&self.state.gitoxide_version],
                    |r| r.get(0),
                )?)
    }
    pub(crate) fn tasks_or_insert(
        &self,
        allowed_short_names: &[String],
    ) -> anyhow::Result<Vec<(Id, &'static super::Task)>> {
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
            )?;
        }
        Ok(out)
    }
    pub(crate) fn insert_run(
        con: &rusqlite::Connection,
        gitoxide_version: Id,
        runner: Id,
        task: Id,
        repository: Id,
    ) -> anyhow::Result<Run> {
        let insertion_time = std::time::UNIX_EPOCH.elapsed()?.as_secs();
        let id = con.query_row("INSERT INTO run (gitoxide_version, runner, task, repository, insertion_time) VALUES (?1, ?2, ?3, ?4, ?5) RETURNING id", params![gitoxide_version, runner, task, repository, insertion_time], |r| r.get(0))?;
        Ok(Run {
            id,
            duration: Def
```

### Core Architecture Module: `gitoxide-core/src/corpus/engine.rs`
```
use std::{
    path::{Path, PathBuf},
    sync::atomic::{AtomicUsize, Ordering},
    time::{Duration, Instant},
};

use anyhow::{Context, bail};
use bytesize::ByteSize;
use gix::{Count, NestedProgress, Progress, error::ErrorExt};
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
    pub trace_to_progress: bool,
    pub reverse_trace_lines: bool,
}

impl Engine {
    /// Open the corpus DB or create it.
    pub fn open_or_create(db: PathBuf, state: State) -> anyhow::Result<Engine> {
        let con = crate::corpus::db::create(db).context("Could not open or create database")?;
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
    ) -> anyhow::Result<()> {
        let tasks = self.tasks_or_insert(&allowed_task_names)?;
        if tasks.is_empty() {
            bail!("Cannot run without any task to perform on the repositories");
        }
        let (corpus_path, corpus_id) = self.prepare_corpus_path(corpus_path)?;
        let gitoxide_id = self.gitoxide_version_id_or_insert()?;
        let runner_id = self.runner_id_or_insert()?;
        let repos = self.find_repos_or_insert(&corpus_path, corpus_id, repo_sql_suffix)?;
        self.perform_run(&corpus_path, gitoxide_id, runner_id, &tasks, repos, threads, dry_run)
    }

    pub fn refresh(&mut self, corpus_path: PathBuf) -> anyhow::Result<()> {
        let (corpus_path, corpus_id) = self.prepare_corpus_path(corpus_path)?;
        let repos = self.refresh_repos(&corpus_path, corpus_id)?;
        self.state.progress.set_name("refresh repos".into());
        self.state.progress.info(format!(
            "Added or updated {} repositories under '{corpus_path}'",
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
    ) -> anyhow::Result<()> {
        let start = Instant::now();
        let repo_progress = &mut self.state.progress;
        let threads = gix::parallel::num_threads(threads);
        let db_path = self.con.path().expect("opened from path on disk").to_owned();
        'tasks_loop: for (task_id, task) in tasks {
            let task_start = Instant::now();
            let task_info = format!("run '{}'", task.short_name);
            repo_progress.set_name(task_info.clone());
            repo_progress.init(Some(repos.len()), gix::progress::count("repos"));
            if task.execute_exclusive || threads == 1 || dry_run {
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
                    break 'tasks_loop;
                }
                let mut run_progress = repo_progress.add_child("set later");
                let (_guard, current_id) = corpus::trace::override_thread_subscriber(
                    db_path.as_str(),
                    self.state.trace_to_progress.then(|| repo_progress.add_child("trace")),
                    self.state.reverse_trace_lines,
                )?;

                let mut num_errors = 0;
                for repo in &repos {
                    if gix::interrupt::is_triggered() {
                        bail!("interrupted by user");
                    }
                    run_progress.set_name(format!(
                        "{}",
                        repo.path
                            .strip_prefix(corpus_path)
                            .expect("corpus contains repo")
                            .display()
                    ));

                    // TODO: wait for new release of `tracing-forest` to be able to provide run_id via span attributes
                    let mut run = Self::insert_run(&self.con, gitoxide_id, runner_id, *task_id, repo.id)?;
                    current_id.store(run.id, Ordering::SeqCst);
                    tracing::info_span!("run", run_id = run.id).in_scope(|| {
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
                            (
                                // threaded printing is usually spammy, and lines interleave so it's useless.
                                corpus::trace::override_thread_subscriber(db_path.as_str(), None, false),
                                progress.add_child(format!("{tid}")),
                                rusqlite::Connection::open(&db_path),
                            )
                        }
                    },
                    |repo, (subscriber, progress, con), _threads_left, should_interrupt| -> anyhow::Result<()> {
                        progress.set_name(format!(
                            "{}",
                            repo.path
                                .strip_prefix(corpus_path)
                                .expect("corpus contains repo")
                                .display()
                        ));
                        let current_id = match subscriber {
                            Ok((_guard, current_id)) => current_id,
                      
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

use gix::progress::DynNestedProgress;

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
    ) -> anyhow::Result<()>;
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
    ) -> anyhow::Result<()> {
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
        )?;
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
    ) -> anyhow::Result<()> {
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
    ) -> anyhow::Result<()> {
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
    ) -> anyhow::Result<()> {
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3031** (2026-09-29): **Fix UCRT64 discovery and runtime paths for Git for Windows**
  *Symptoms*: ## Tasks  This section is for Byron only. Models continuing this PR must not add, remove, check, uncheck, rename, or reorder checkboxes here.  - [x] refackiew  ----  Everything below this line was generated by Codex GPT-6.  Created by Codex on behalf of Byron. Byron will review before this is ready to merge.  Git for Windows 2.56 moved its x86_64 executables to `ucrt64/bin`. When Git is absent from `PATH`, `gix-path` now discovers those installations in global and per-user program directories. UCRT64 precedes legacy MinGW64 in fallback searches; ARM64 preference and support for older installations remain intact.  Fixes #3030.  The `EXEPATH` shortcut recognizes UCRT64 and queries Git when multiple runtime directories exist. The fallback now retains the runtime directory from `git --exec-path`, so adding `ucrt64` beside an active `mingw64` installation preserves the selected prefix. It also handles installation ancestors named `libexec`.  Runtime prefixes and system data locations are distinct: `system_prefix()` consistently returns `<Git>/<runtime>`, while Git for Windows reads both system configuration and attributes from `<Git>/etc`. The shortcut reports the same file for installation and system configuration, and the attributes consumer uses the correct sibling directory. The public signatures, dependencies, feature flags, and MSRV are unchanged.  `gix-testtools` already delegates Git discovery to `gix-path` and derives Bash's location from `git --exec-path`. Tests cover fa

- **Issue #3030** (2026-09-29): **`ucrt64/bin` should accompany and have priority over `mingw64/bin`**
  *Symptoms*: ### Current behavior 😯  The [release notes](https://github.com/git-for-windows/git/releases/tag/v2.56.0.windows.1) for Git for Windows v2.56.0.windows.1 mention:  > Following the [MSYS2 project](https://www.msys2.org/news/#2026-02-28-dropping-support-for-windows-81), on which Git for Windows is based, Windows 8.1 support was dropped; In https://github.com/git-for-windows/git-sdk-64/pull/117, internal paths changed (`/mingw64/bin/git.exe` does not exist anymore, `/ucrt64/bin/git.exe` takes its role; if this breaks your setups, consider switching to /cmd/git.exe instead, which is guaranteed to stay stable).  (Note that these are "cygpaths"; for resolving native Windows paths, they shouldn't start with `/` or it's relative to the current drive.)  The advice it gives is often good and we may want to move in the direction of using `cmd` more, but I recall there are reasons in some cases that we haven't rushed to do that and reasons in other cases that we are not sure if we can do that.  As described below, I am not sure of our actual status on this. We already do support that in at least some cases and the degree to which this has not yet been fulfilled might actually be subtle and minimal. But I'm not sure of that.  Ideally I would research this more before opening an issue, and even more ideally I would just open a PR with the fix! However, I've been meaning to do the latter ever since the first release candidate of this Git for Windows release came out, and did not find the ti
  **Post-Mortem & Fix Analysis**:
  > Thanks for bringing this up!  I have started a job to address this, let's see where it leads. Also CC @dscho .

- **Issue #3029** (2026-09-29): **Fix minor SHA-256 issues in CLI**
  *Symptoms*: This PR fixes a few minor issues in the CLI related to SHA-256 support.  - Don't hardcode hash in `gix free index`. Instead, take it from `--object-hash`. - Add SHA-256 to `AsHashKind`. - Remove outdated note saying SHA-256 is not fully supported. - Fix key name in comment.  Some of them were found by GPT 6.0 when I asked it to trim `etc/plan/sha256-support.md` to only those items that are still left open. This was the list it came up with:  > - [ ] Honor `gix free index --object-hash` in `from-list`: forward the selection from `src/plumbing/main.rs` to `gitoxide-core/src/repository/index/mod.rs`, which still hardcodes SHA-1. Add a SHA-256 index write/read regression test. > - [ ] Support SHA-256 in query path tracing: replace the `[u8; 20]` SQL row decoding in `gitoxide-core/src/query/engine/command.rs` with hash-length-aware decoding. Add a regression test tracing a path in a SHA-256 repository. > - [ ] Complete the 32-bit SHA-256 stream-size expectations currently left as `todo!()`: `basic_usage_internal` in `gix-archive/tests/archive.rs` and `will_provide_all_information_and_respect_export_ignore` in `gix-worktree-stream/tests/stream.rs`. Run both tests on a 32-bit target with `GIX_TEST_FIXTURE_HASH=sha256`. > - [ ] Correct the stale `extensions.objectFormat` note in `gix/src/config/tree/sections/extensions.rs`, which still claims SHA-256 is rejected.  This PR addresses the first as well as the last item. Now I’m wondering: do we want to address the two othe
  **Post-Mortem & Fix Analysis**:
  > > I don’t have access to a 32-bit machine, and I don’t know whether I want to spin up a 32-bit VM on my machine just to get the two missing values.  For 32-bit testing, I suspect you may not need a 32-bit VM, nor a 32-bit operating system installed on a compatible 64-bit VM.  In principle you might be able to just install a 32-bit target and build for it and use it. This assumes you have a (physical or virtual) machine with a 64-bit CPU and operating system that is capable of running 32-bit binaries, either natively or by emulation. But even then there might be dependency problems on some 64-bit systems, which might not necessarily be easy to fix, especially if they come down to problems getting `pkgconf`/`pkg-config` to find libraries. If you do want to try that, the musl targets may be easier than glibc ones, though I think there's no guarantee that this will work well, especially for non-"pure" builds.  But containerization generally works fine! On a 64-bit system, you can use
  > Thanks a lot @cruessler, and @EliahKagan for chiming in!  I took the liberty of removing the SHA-256 plan to declare 'done enough', which also means that we could bring it back based on the status quo - the plan in question was fully generated anyway, but by an older model, and not necessarily kept up to date either.  The 32bit topic I am also not tackling here, but it's certainly something that could be looked at more particularly once there is issues coming up related to it (and maybe a greater amount of embedded usage).

- **Issue #3027** (2026-09-27): **change(gix-filter)!: remove `object_hash` from `pipeline::Options`**
  *Symptoms*: This is a follow-up to #2926, #2919 and other PRs. It makes hash selection explicit in `gix_filter::pipeline::Pipeline::new` and removes `object_hash` from `gix_filter::pipeline::Options`. This change removes the risk that callers inadvertently get SHA-1 through `#[derive(Default)]` in SHA-1/SHA-256 builds without noticing.  `gix_filter::pipeline::Options` keeps its `#[derive(Default)]`, but it doesn’t have `object_hash` any longer.  This change also removes the `Default` implementation for `Pipeline`.  This change also removes the `Default` implementation for `gix_worktree_state::checkout::Options`, replacing it with `Options::new` which requires an existing `Pipeline` to be passed in while relying on `Default::default()` to populate the remaining fields.  Most of the remaining changes are mechanical follow-up changes.  @Byron Let me know whether you think these changes are still valuable! They are part of my long-term project to make the transition to SHA-1/SHA-256 builds as smooth as possible. At this point I’m mostly done I think; I don’t expect many follow-ups, if any. 
  **Post-Mortem & Fix Analysis**:
  > This PR is ready (the Github mobile app doesn’t have a button for marking PRs as ready, apparently).
  > > This PR as ready (the Github mobile app doesn’t have a button for marking PRs as ready, apparently).  I've gone ahead and marked this as ready for review.
  > Thanks so much!  I kind of dropped the ball on this topic, thanks for picking it up!  > Let me know whether you think these changes are still valuable! They are part of my long-term project to make the transition to SHA-1/SHA-256 builds as smooth as possible. At this point I’m mostly done I think; I don’t expect many follow-ups, if any.  Something you can consider is to remove the corresponding plan in a follow-up.

- **Issue #3026** (2026-09-28): **Fix phantom untracked submodules and Unicode filenames**
  *Symptoms*: ## Tasks  This section is for Byron only. Models continuing this PR must not add, remove, check, uncheck, rename, or reorder checkboxes here.  - [x] refackiew  ----  Everything below this line was generated by `Codex GPT-6`.  Created by Codex on behalf of Byron. Byron will review before this is ready to merge.  `gix status` reported false untracked entries in two independently reproduced cases from the Starship issue. This PR fixes them in separate commits:  - **Uninitialized submodules:** putting ordinary files inside a tracked, uninitialized submodule made its directory appear untracked. The directory walker now treats the indexed gitlink as a repository boundary without requiring a checkout. Coverage includes nested submodules, both case-sensitivity modes, fresh and stale indexes, and collapsed and individual status output. [Reported case](https://github.com/starship/starship/issues/6881#issuecomment-5852165842). - **Unicode filenames on macOS:** an emoji combined with a decomposed umlaut, such as `📹Ü.md`, made a tracked file appear untracked. Git preserves the original filename when macOS's `UTF-8-MAC` conversion rejects a character above U+FFFF. The shared precomposition helper now follows that fallback. Filesystem and reference paths compose each component independently, keeping explicit traversal roots and loose and packed references consistent beneath emoji-containing paths. Reference lookup preserves the requested spelling so returned names remain usable. Coverage i

- **Issue #3025** (2026-09-28): **Add safe worktree removal and shared repository writes**
  *Symptoms*: ## Tasks  - [x] refackiew worktree-remove - [x] quick shot: make add/remove available in `gix` CLI  ---- Created by Codex on behalf of Byron. Byron will review before this is ready to merge.  ## Summary  Follow-up to https://github.com/GitoxideLabs/gitoxide/pull/2977, which added linked-worktree creation. This PR carries the nine remaining commits in that series:  - Add safe linked-worktree removal through `gix-worktree` and `gix`, with dirty-state, submodule, lock, and backlink validation. - Apply `core.sharedRepository` during initialization and when writing refs, reflogs, indexes, worktree metadata, loose objects, received packs, shallow metadata, MIDXs, and query databases with their SQLite sidecars. - Preserve existing configuration-file permissions during branch deletion and clone updates.  ## Context  The creation APIs and sharing primitives landed in #2977. This follow-up extends them to removal and the repository writers that consume the sharing policy.  Removal retains the worktree's attached branch and requires explicit force to discard changes or override a lock. Recursive deletion avoids following symlinks and crossing Unix mount boundaries. The sharing changes include the workspace adaptations for the new plumbing options and index-writing argument, with Git-baseline and umask-sensitive coverage.  The stack has been replayed onto the merge of #2977, preserving the updated worktree helpers and configuration writer.  ## Validation  - `car

- **Issue #3024** (2026-09-27): **fix: don't remove a directory when removing the file it replaced during tree merges**
  *Symptoms*: A tree merge silently loses files when one side deletes or renames away the file `a/b` and fills a new directory `a/b/` only through renames. `gix` reports the merge as clean, and the merged tree has no `a/b/` at all, where `git merge-tree` keeps it. It happens in both merge directions, whether or not the other side changed anything, and inside virtual merge bases.  Minimal case: the merge base has the file `a/b` and `d/g`; one side runs `git rm a/b && mkdir -p a/b && git mv d/g a/b/g`; the other side edits an unrelated file or nothing. `gix` merges cleanly without `a/b/g`.  ## Cause  `gix-diff`'s rewrite tracker emits paired renames before unpaired deletions, and the tree merge replays one side's changes in that order. The editor receives `a/b/g` first, which turns the blob `a/b` into a tree, and then the deletion of `a/b` (or the removal of the rename source, when `a/b` is renamed away) runs `editor.remove("a/b")` and deletes the whole new tree. Every removal in the tree merge used the same unguarded `Editor::remove()`.  ## Fix  `remove_unless_tree()` removes an entry through `Editor::remove_leaf()` and leaves a tree at that path in place. All 27 removals (2 in `apply_change()` and 25 in the resolver arms) use it. Tree changes are never applied directly, and the leaf changes below a tree carry every update to it, so skipping the tree loses nothing. Since `remove_leaf()` returns an erased error, a tree is recognized by looking it up after the failed removal, which loads ever

- **Issue #3023** (2026-09-25): **perf(gix-hash): upgrade sha1dc to 0.1.3**
  *Symptoms*: [sha1dc 0.1.3](https://github.com/srijs/sha1dc/releases/tag/v0.1.3) makes the collision check 9–11% faster again: its filter for known disturbance vectors now tests a prefix chosen by VNS (variable neighborhood search), and on NEON the checks that follow are laid out so they predict well.  The per-block scratch space moved from the hasher into the stack frame, so `Hasher` shrinks from 472 to 112 bytes, and the size tests follow. The minimum version is raised so dependents of `gix-hash` pick it up too.  Performance: On an Apple M4 (4P/6E), against a bare clone of `git/git`: 421,363 objects, 305 MiB pack. Built from one tree with the `max-pure` feature set and one target directory, with only the sha1dc version changed; fastest of 5 rounds, alternating builds each round.  | operation | `sha1dc` 0.1.2 | `sha1dc` 0.1.3 | | |---|---:|---:|---:| | `gix free pack verify` (1 thread) | 5.61s | 5.37s | **1.04x** |  | `gix free pack index create` (1 thread) | 7.29s | 7.06s | **1.03x** |  | `gix free pack verify` (all cores) | 0.94s | 0.90s | **1.05x** |  | `gix free pack index create` (all cores) | 2.65s | 2.61s | 1.02x |
  **Post-Mortem & Fix Analysis**:
  > I still remember the days when `max-pure` used to be slow, with both ZLIB and SHA-1 being pure Rust and lacked a lot of optimization. And look at `gix` now… pure magic!  Can't thank you enough, obviously :D!!

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

### Incident Patch 1: `23321850` (2026-09-26)
**Commit Message**: fix(gix-error): flatten native error chains in linear time

<!-- agent -->
`Exn::into_chain()` resolved each native source from its owning root both
to check for nested boundaries and to construct the next handle. Flattening
64 errors therefore required 4,096 `source()` calls.

Scan each native chain once when constructing its `ErrorHandle`, recording
its length and the prefix that inherits the frame location. Advancing a
handle only increments its depth. Stop at nested `Error` boundaries to
preserve breadth-first order, concrete error types, and caller locations
without extra allocations or dependencies.

Add `native_source_flattening_is_linear` to require at most four source
lookups per error and separately verify that every error survives.
Chains of 16, 32, and 64 errors now need 16, 32, and 64 source calls.
Explicit `into_chain()` calls exercise flattening in every feature
configuration. Individual handle lookups continue to walk from their owner.

Assisted-by: GPT 6.0 Astra
Co-authored-by: GPT 6.0 Astra <codex@openai.com>

**File**: `gix-error/src/concrete/chain.rs` (modified, +26/-8)
```diff
@@ -60,15 +60,20 @@ impl std::error::Error for ChainedError {
 /// lead from `owner` to the error represented by this handle. Zero represents `owner`. [`Self::error()`] follows that
 /// path whenever the borrowed error is needed.
 ///
+/// Scan the native chain once at construction, stopping at nested [`crate::Error`] boundaries. Recording its length and
+/// location-bearing prefix lets [`Self::source()`] advance without repeatedly resolving sources from `owner`.
+///
 /// Resolving a handle assumes that an error's source chain remains stable while the owning error is alive, as conventional
 /// [`std::error::Error`] implementations do.
 pub(crate) struct ErrorHandle {
     /// The error that owns the complete native source chain.
     owner: Arc<dyn std::error::Error + Send + Sync + 'static>,
     /// The number of native source links, including I/O payloads, from `owner` to this handle's error.
     source_depth: usize,
-    /// Whether this error retains its frame's location, directly or through transparent marker sources.
-    has_frame_location: bool,
+    /// The depth of the last source before the native chain ends or reaches a nested `Error` boundary.
+    source_count: usize,
+    /// The deepest source that inherits the frame's location through transparent marker sources.
+    frame_location_depth: usize,
 }
 
 impl ErrorHandle {
@@ -77,10 +82,24 @@ impl ErrorHandle {
             Ok(handle) => return *handle,
             Err(error) => error,
         };
+        let mut source: &(dyn std::error::Error + 'static) = error.as_ref();
+        let mut source_count = 0;
+        let mut frame_location_depth = 0;
+        while !source.is::<crate::Error>() {
+            let Some(next) = crate::error::native_source(source) else {
+                break;
+            };
+            if frame_location_depth == source_count && crate::error::is_transparent_marker(source) {
+                frame_location_depth += 1;
+            }
+            source_count += 1;
+            source = next;
+        }
         ErrorHandle {
             owner: error.into(),
             source_depth: 0,
-            has_frame_location: true,
+            source_count,
+            frame_location_depth,
         }
     }
 
@@ -94,12 +113,11 @@ impl ErrorHandle {
     }
 
     pub(crate) fn source(&self) -> Option<Self> {
-        let error = self.error();
-        crate::error::native_source(error)?;
-        Some(ErrorHandle {
+        (self.source_depth < self.source_count).then(|| ErrorHandle {
             owner: Arc::clone(&self.owner),
             source_depth: self.source_depth + 1,
-            has_frame_location: self.has_frame_location && crate::error::is_transparent_marker(error),
+            source_count: self.source_count,
+            frame_location_depth: self.frame_location_depth,
         })
     }
 
@@ -121,7 +139,7 @@ impl ErrorHandle {
 
     #[cfg(all(feature = "auto-chain-error", not(feature = "tree-error")))]
     pub(crate) fn has_frame_location(&self) -> bool {
-        self.has_frame_location
+        self.source_depth <= self.frame_location_depth
     }
 }
 
```

**File**: `gix-error/src/exn/impls.rs` (modified, +2/-6)
```diff
@@ -815,9 +815,7 @@ fn flatten_error_nodes(root: Frame) -> Vec<OwnedErrorNode> {
                 logical_parent,
             } => {
                 let error = ErrorHandle::new(unerase(error));
-                if !error.error().is::<crate::Error>()
-                    && let Some(source) = error.source()
-                {
+                if let Some(source) = error.source() {
                     queue.push_back(Pending::Source {
                         error: source,
                         location,
@@ -839,9 +837,7 @@ fn flatten_error_nodes(root: Frame) -> Vec<OwnedErrorNode> {
                 location,
                 logical_parent,
             } => {
-                if !error.error().is::<crate::Error>()
-                    && let Some(source) = error.source()
-                {
+                if let Some(source) = error.source() {
                     queue.push_back(Pending::Source {
                         error: source,
                         location,
```

**File**: `gix-error/tests/error/convert.rs` (modified, +61/-0)
```diff
@@ -352,3 +352,64 @@ fn public_helpers_are_lazy_and_keep_the_original_cause() -> gix_error::TestResul
     );
     Ok(())
 }
+
+#[test]
+fn native_source_flattening_is_linear() {
+    use std::sync::{
+        Arc,
+        atomic::{AtomicUsize, Ordering},
+    };
+
+    #[derive(Debug)]
+    struct NativeError {
+        source: Option<Box<NativeError>>,
+        calls: Arc<AtomicUsize>,
+    }
+
+    impl std::fmt::Display for NativeError {
+        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
+            f.write_str("native error")
+        }
+    }
+
+    impl std::error::Error for NativeError {
+        fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
+            self.calls.fetch_add(1, Ordering::Relaxed);
+            self.source.as_deref().map(|source| source as _)
+        }
+    }
+
+    let measurements = [16, 32, 64].map(|len| {
+        let calls = Arc::new(AtomicUsize::new(0));
+        let mut native = NativeError {
+            source: None,
+            calls: Arc::clone(&calls),
+        };
+        for _ in 1..len {
+            native = NativeError {
+                source: Some(Box::new(native)),
+                calls: Arc::clone(&calls),
+            };
+        }
+
+        let chain = native.raise_typed().into_chain();
+        let source_calls = calls.load(Ordering::Relaxed);
+        let root: &dyn std::error::Error = &chain;
+        assert_eq!(
+            std::iter::successors(Some(root), |error| error.source()).count(),
+            len,
+            "flattening retains every native error"
+        );
+        eprintln!("{len} native errors: {source_calls} source() calls during flattening");
+        (len, source_calls)
+    });
+
+    // Allow a small constant number of source lookups per native error.
+    for (len, calls) in measurements {
+        assert!(
+            calls <= 4 * len,
+            "flattening {len} native errors used {calls} source() calls; expected at most {} for linear work",
+            4 * len
+        );
+    }
+}
```

---

### Incident Patch 2: `6723b31e` (2026-09-26)
**Commit Message**: fix(gix): preserve caller locations in native error adapters

<!-- agent -->
Passing a `#[track_caller]` constructor directly to `map_err()` records
the `FnOnce` shim in `core` as the caller. Use `or_error()` for native
error adapters in `gix`, `gix-actor`, and `gix-config` so diagnostics record
the adapter and use the usual exception formatting, including with
`tree-error`.

Keep `Error::from_boxed()` inside a closure for boxed trait-object errors,
which `ResultExt` does not accept. Add a regression for invalid branch
merge references and document when constructors still require closures.

Assisted-by: GPT 6.0 Astra
Co-authored-by: GPT 6.0 Astra <codex@openai.com>

**File**: `gix-actor/src/signature/mod.rs` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 mod _ref {
     use bstr::ByteSlice;
 
-    use gix_error::Result;
+    use gix_error::{Result, ResultExt};
 
     use crate::{IdentityRef, Signature, SignatureRef, signature::decode};
 
@@ -68,7 +68,7 @@ mod _ref {
         /// Parse the `time` field for access to the passed time since unix epoch, and the time offset.
         /// The format is expected to be [raw](gix_date::parse_header()).
         pub fn time(&self) -> Result<gix_date::Time> {
-            self.time.parse().map_err(gix_error::ErrorExt::raise)
+            self.time.parse::<gix_date::Time>().or_error()
         }
     }
 }
```

**File**: `gix-blame/src/file/function.rs` (modified, +1/-1)
```diff
@@ -926,7 +926,7 @@ struct InitialState {
     first_suspect: Option<ObjectId>,
 }
 
-#[allow(clippy::too_many_arguments)]
+#[expect(clippy::too_many_arguments)]
 fn initial_state(
     odb: &impl gix_object::Find,
     start: Start<'_>,
```

**File**: `gix-error/src/lib.rs` (modified, +5/-1)
```diff
@@ -146,7 +146,11 @@
 //! std::io::Error::other(exn.into_error())
 //! ```
 //!
-//! It can also be created directly from any `std::error::Error` via [`Error::from_error()`].
+//! It can also be created directly from any `std::error::Error` via [`Error::from_error()`], which preserves
+//! native formatting for tree-backed errors. For native-error results, prefer [`ResultExt::or_error()`]
+//! to capture the caller location and use exception formatting.
+//! When a constructor is needed, invoke it in a closure, e.g. `.map_err(|err| Error::from_boxed(err))`.
+//! Passing the constructor directly to an adapter captures a `FnOnce` shim's location instead of the call site.
 //!
 //! # Tests with [`TestResult`]
 //!
```

**File**: `gix-fs/tests/fs/stack.rs` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-#![allow(clippy::join_absolute_paths)]
+#![expect(clippy::join_absolute_paths)]
 use crate::Result;
 use std::path::{Path, PathBuf};
 
```

**File**: `gix/src/attribute_stack.rs` (modified, +4/-5)
```diff
@@ -1,8 +1,9 @@
 use std::ops::{Deref, DerefMut};
 
+use gix_error::ResultExt;
 use gix_fs::stack::ToNormalPathComponents;
 
-use crate::{Error, Repository, Result, types::AttributeStack};
+use crate::{Repository, Result, types::AttributeStack};
 
 /// Lifecycle
 impl<'repo> AttributeStack<'repo> {
@@ -48,7 +49,7 @@ impl AttributeStack<'_> {
     ) -> Result<gix_worktree::stack::Platform<'_>> {
         self.inner
             .at_path(relative.as_ref(), mode, &self.repo.objects)
-            .map_err(Error::from_error)
+            .or_error()
     }
 
     /// Obtain a platform for attribute or ignore lookups from a repo-`relative` path, typically obtained from an index entry.
@@ -60,8 +61,6 @@ impl AttributeStack<'_> {
         relative: impl ToNormalPathComponents,
         mode: Option<gix_index::entry::Mode>,
     ) -> Result<gix_worktree::stack::Platform<'_>> {
-        self.inner
-            .at_path(relative, mode, &self.repo.objects)
-            .map_err(Error::from_error)
+        self.inner.at_path(relative, mode, &self.repo.objects).or_error()
     }
 }
```

---

### Incident Patch 3: `d3e5cbc1` (2026-09-29)
**Commit Message**: Address review comment about Windows runtime prefixes

<!-- Byron -->

Looked at every hunk, but only for the purpose of validating no API change,
and for learning what's changed. Effectively, it's a rubber-stamp,
knowing that Astra will do a good job, particularly because it was run
on a Windows box.

<!-- agent -->
Recognizing `ucrt64` makes an `EXEPATH` containing both it and `mingw64`
ambiguous. The fallback then dropped the runtime directory from
`git --exec-path`, changing `system_prefix()` even when Git still selected
MinGW64. Seven new regression cases reproduced the prefix mismatch and the
incorrect configuration and attributes paths before this correction.

Retain the directory immediately above Git's `libexec` directory, including
when an installation's ancestors also contain a directory called `libexec`.
Keep runtime prefixes separate from Git for Windows' top-level `etc`
directory: its installation and system configuration are the same file,
and system attributes belong beside the runtime directory too. Document
that distinction and test both active runtimes with unambiguous and mixed
installations in isolated processes.

The reference checkout in `../git` is `v2.56.0.

**File**: `gix-attributes/src/lib.rs` (modified, +1/-0)
```diff
@@ -143,6 +143,7 @@ pub enum Source {
     GitInstallation,
     /// System-wide attributes file. This is typically defined as
     /// `$(prefix)/etc/gitattributes` (where prefix is the git-installation directory).
+    /// Git for Windows uses `../etc/gitattributes` relative to its runtime prefix instead.
     System,
     /// This is `<xdg-config-home>/git/attributes` and is git application configuration per user.
     ///
```

**File**: `gix-attributes/src/source.rs` (modified, +8/-1)
```diff
@@ -15,7 +15,14 @@ impl Source {
                 if env_var("GIT_ATTR_NOSYSTEM").is_some() {
                     return None;
                 } else {
-                    gix_path::env::system_prefix()?.join("etc/gitattributes")
+                    let prefix = gix_path::env::system_prefix()?;
+                    // Git for Windows builds ETC_GITATTRIBUTES as ../etc/gitattributes.
+                    let prefix = if cfg!(windows) {
+                        prefix.parent().unwrap_or(prefix)
+                    } else {
+                        prefix
+                    };
+                    prefix.join("etc/gitattributes")
                 }
             }
             Git => return gix_path::env::xdg_config("attributes", env_var),
```

**File**: `gix-attributes/tests/attributes/main.rs` (modified, +2/-0)
```diff
@@ -1,4 +1,6 @@
 mod assignment;
 mod parse;
 mod search;
+#[cfg(windows)]
+mod source;
 mod state;
```

**File**: `gix-attributes/tests/attributes/search.rs` (modified, +3/-1)
```diff
@@ -67,7 +67,9 @@ fn baseline() -> gix_error::TestResult {
     let mut buf = Vec::new();
     // Due to the way our setup differs from gits dynamic stack (which involves trying to read files from disk
     // by path) we can only test one case baseline, so we require multiple platforms (or filesystems) to run this.
-    let case = if gix_fs::Capabilities::probe("../.git".as_ref()).ignore_case {
+    // Probe a disposable directory; a linked checkout's .git is a file, and the probe can write files.
+    let probe = gix_testtools::tempfile::tempdir()?;
+    let case = if gix_fs::Capabilities::probe_dir(probe.path()).ignore_case {
         Case::Fold
     } else {
         Case::Sensitive
```

**File**: `gix-attributes/tests/attributes/source.rs` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+use gix_attributes::Source;
+
+#[test]
+fn system_attributes_with_mingw64() -> gix_testtools::Result {
+    system_attributes("mingw64", false)
+}
+
+#[test]
+fn system_attributes_with_ucrt64() -> gix_testtools::Result {
+    system_attributes("ucrt64", false)
+}
+
+#[test]
+fn system_attributes_with_mixed_prefixes_and_mingw64_active() -> gix_testtools::Result {
+    system_attributes("mingw64", true)
+}
+
+#[test]
+fn system_attributes_with_mixed_prefixes_and_ucrt64_active() -> gix_testtools::Result {
+    system_attributes("ucrt64", true)
+}
+
+fn system_attributes(runtime: &str, mixed: bool) -> gix_testtools::Result {
+    if gix_testtools::run_in_isolated_process()? {
+        return Ok(());
+    }
+    let installation = gix_testtools::tempfile::tempdir()?;
+    if mixed {
+        for directory in ["mingw64", "ucrt64"] {
+            std::fs::create_dir(installation.path().join(directory))?;
+        }
+    } else {
+        std::fs::create_dir(installation.path().join(runtime))?;
+    }
+    // GIT_EXEC_PATH selects the active runtime when EXEPATH is ambiguous.
+    // Git for Windows builds ETC_GITATTRIBUTES as ../etc/gitattributes for both runtimes.
+    let core_dir = installation.path().join(runtime).join("libexec/git-core");
+    let _env = gix_testtools::Env::new()
+        .set("EXEPATH", installation.path().to_str().expect("UTF-8 temporary path"))
+        .set("GIT_EXEC_PATH", core_dir.to_str().expect("UTF-8 temporary path"));
+    assert_eq!(
+        Source::System.storage_location(&mut |_| None),
+        Some(installation.path().join("etc/gitattributes")),
+        "system attributes stay in the top-level etc directory with either prefix discovery strategy"
+    );
+    assert_eq!(
+        Source::System.storage_location(&mut |name| (name == "GIT_ATTR_NOSYSTEM").then(|| "1".into())),
+        None,
+        "disabling system attributes still takes precedence over path discovery"
+    );
+    Ok(())
+}
```

---

### Incident Patch 4: `bf0c2593` (2026-09-29)
**Commit Message**: fix(gix-path): discover UCRT64 Git for Windows installations (#3030)

<!-- agent -->
Git for Windows 2.56 moved its x86_64 executables from `mingw64/bin` to
`ucrt64/bin`. Without Git on `PATH`, the fallback search missed these
installations in both global and per-user program directories. The
`EXEPATH` shortcut also ignored `ucrt64`, incorrectly treating a legacy
prefix as unambiguous when both directories existed.

Search `ucrt64` before `mingw64`, retaining the existing preference for
native ARM64 and support for 32-bit installations. Recognize UCRT64 in
`EXEPATH`, but continue querying Git when multiple prefixes make that
shortcut ambiguous. Put UCRT64 before MinGW in the auxiliary prefix
allowlist too. Extend the candidate-order and filesystem regression tests.

The repository audit found that `gix-testtools` already delegates Git
discovery to `gix-path` and locates Bash relative to `git --exec-path`.
Other legacy paths are historical documentation or credential-quoting test
data. No independent test-helper discovery fix is needed.

The reference in `../git` is `v2.56.0.windows.1` at
`49d759b698127791a5f3f2759c69b983846711dd`. Its
`contrib/buildsystems/CMakeLists.txt` selects `

**File**: `gix-path/src/env/auxiliary.rs` (modified, +2/-2)
```diff
@@ -20,7 +20,7 @@ pub(super) struct WindowsExecutable {
 ///
 /// On Windows, we prefer to use `sh` as provided by Git for Windows, when present. To find it, we
 /// run `git --exec-path` to get a path that is usually `<platform>/libexec/git-core` in the Git
-/// for Windows installation, where `<platform>` is something like `mingw64`. It is also acceptable
+/// for Windows installation, where `<platform>` is something like `ucrt64`. It is also acceptable
 /// to find `sh` in an environment not provided by Git for Windows, such as an independent MSYS2
 /// environment in which a `git` package has been installed. However, in an unusual installation,
 /// or if the user has set a custom value of `GIT_EXEC_PATH`, the output of `git --exec-path` may
@@ -48,7 +48,7 @@ pub(super) struct WindowsExecutable {
 ///
 /// Conditions for a privilege escalation attack or other serious malfunction seem far-fetched. If
 /// further research finds the risk is low enough, `usr` may be added. But for now it is omitted.
-const MSYS_USR_VARIANTS: &[&str] = &["mingw64", "mingw32", "clangarm64", "clang64", "clang32", "ucrt64"];
+const MSYS_USR_VARIANTS: &[&str] = &["clangarm64", "ucrt64", "mingw64", "mingw32", "clang64", "clang32"];
 
 /// Find a Git for Windows installation directory based on `git --exec-path` output.
 ///
```

**File**: `gix-path/src/env/git/mod.rs` (modified, +4/-4)
```diff
@@ -46,10 +46,9 @@ where
     // limited user accounts can usually create their own arbitrarily named directories inside.)
     let varname_user_appdata_local = "LocalAppData";
 
-    // 64-bit relative bin dirs. So far, this is always `mingw64` or `clangarm64`, not `urct64` or
-    // `clang64`. We check `clangarm64` before `mingw64`, because in the strange case that both are
-    // available, we don't want to skip over a native ARM64 executable for an emulated x86_64 one.
-    let suffixes_64 = &[r"Git\clangarm64\bin", r"Git\mingw64\bin"][..];
+    // Prefer native ARM64 over an emulated x86_64 executable when both are present.
+    // For x86_64, Git for Windows 2.56 uses `ucrt64`; keep `mingw64` for older releases.
+    let suffixes_64 = &[r"Git\clangarm64\bin", r"Git\ucrt64\bin", r"Git\mingw64\bin"][..];
 
     // 32-bit relative bin dirs. So far, this is only ever `mingw32`, not `clang32`.
     let suffixes_32 = &[r"Git\mingw32\bin"][..];
@@ -64,6 +63,7 @@ where
     // Bin dirs relative to a user's local application data directory. We try each architecture.
     let suffixes_user = &[
         r"Programs\Git\clangarm64\bin",
+        r"Programs\Git\ucrt64\bin",
         r"Programs\Git\mingw64\bin",
         r"Programs\Git\mingw32\bin",
     ][..];
```

**File**: `gix-path/src/env/git/tests.rs` (modified, +72/-20)
```diff
@@ -72,6 +72,7 @@ mod locations {
             if cfg!(target_pointer_width = "64") {
                 pathbuf_vec![
                     r"C:\Program Files\Git\clangarm64\bin",
+                    r"C:\Program Files\Git\ucrt64\bin",
                     r"C:\Program Files\Git\mingw64\bin",
                 ]
             } else {
@@ -96,6 +97,7 @@ mod locations {
             ),
             pathbuf_vec![
                 r"C:\Program Files\Git\clangarm64\bin",
+                r"C:\Program Files\Git\ucrt64\bin",
                 r"C:\Program Files\Git\mingw64\bin",
                 r"C:\Program Files (x86)\Git\mingw32\bin",
             ],
@@ -113,14 +115,17 @@ mod locations {
             if cfg!(target_pointer_width = "64") {
                 pathbuf_vec![
                     r"Z:\wi\de\Git\clangarm64\bin",
+                    r"Z:\wi\de\Git\ucrt64\bin",
                     r"Z:\wi\de\Git\mingw64\bin",
                     r"Y:\nar\row\Git\mingw32\bin",
                     r"X:\cur\rent\Git\clangarm64\bin",
+                    r"X:\cur\rent\Git\ucrt64\bin",
                     r"X:\cur\rent\Git\mingw64\bin",
                 ]
             } else {
                 pathbuf_vec![
                     r"Z:\wi\de\Git\clangarm64\bin",
+                    r"Z:\wi\de\Git\ucrt64\bin",
                     r"Z:\wi\de\Git\mingw64\bin",
                     r"Y:\nar\row\Git\mingw32\bin",
                     r"X:\cur\rent\Git\mingw32\bin",
@@ -135,7 +140,11 @@ mod locations {
             locations_from!(
                 "ProgramW6432" => r"Z:\wi\de",
             ),
-            pathbuf_vec![r"Z:\wi\de\Git\clangarm64\bin", r"Z:\wi\de\Git\mingw64\bin"],
+            pathbuf_vec![
+                r"Z:\wi\de\Git\clangarm64\bin",
+                r"Z:\wi\de\Git\ucrt64\bin",
+                r"Z:\wi\de\Git\mingw64\bin",
+            ],
         );
     }
 
@@ -150,12 +159,14 @@ mod locations {
             if cfg!(target_pointer_width = "64") {
                 pathbuf_vec![
                     r"Z:\wi\de\Git\clangarm64\bin",
+                    r"Z:\wi\de\Git\ucrt64\bin",
                     r"Z:\wi\de\Git\mingw64\bin",
                     r"Y:\nar\row\Git\mingw32\bin",
                 ]
             } else {
                 pathbuf_vec![
                     r"Z:\wi\de\Git\clangarm64\bin",
+                    r"Z:\wi\de\Git\ucrt64\bin",
                     r"Z:\wi\de\Git\mingw64\bin",
                     r"Y:\nar\row\Git\mingw32\bin",
                     r"Z:\wi\de\Git\mingw32\bin",
@@ -184,6 +195,7 @@ mod locations {
             ),
             pathbuf_vec![
                 r"C:\Users\alice\AppData\Local\Programs\Git\clangarm64\bin",
+                r"C:\Users\alice\AppData\Local\Programs\Git\ucrt64\bin",
                 r"C:\Users\alice\AppData\Local\Programs\Git\mingw64\bin",
                 r"C:\Users\alice\AppData\Local\Programs\Git\mingw32\bin",
             ],
@@ -198,6 +210,7 @@ mod locations {
             ),
             pathbuf_vec![
                 r"\\.\Q:\Documents and Settings\bob\weird\sub\dir\Programs\Git\clangarm64\bin",
+                r"\\.\Q:\Documents and Settings\bob\weird\sub\dir\Programs\Git\ucrt64\bin",
                 r"\\.\Q:\Documents and Settings\bob\weird\sub\dir\Programs\Git\mingw64\bin",
                 r"\\.\Q:\Documents and Settings\bob\weird\sub\dir\Programs\Git\mingw32\bin",
             ],
@@ -234,14 +247,17 @@ mod locations {
             if cfg!(target_pointer_width = "64") {
                 pathbuf_vec![
                     r"C:\Users\alice\AppData\Local\Programs\Git\clangarm64\bin",
+                    r"C:\Users\alice\AppData\Local\Programs\Git\ucrt64\bin",
                     r"C:\Users\alice\AppData\Local\Programs\Git\mingw64\bin",
                     r"C:\Users\alice\AppData\Local\Programs\Git\mingw32\bin",
                     r"C:\Program Files\Git\clangarm64\bin",
+                    r"C:\Program Files\Git\ucrt64\bin",
                     r"C:\Program
```

**File**: `gix-path/src/env/mod.rs` (modified, +1/-1)
```diff
@@ -263,7 +263,7 @@ where
     // Only attempt this optimization if the `EXEPATH` variable is set to an absolute path.
     let root = var_os_func("EXEPATH").map(PathBuf::from).filter(|r| r.is_absolute())?;
 
-    let mut candidates = ["clangarm64", "mingw64", "mingw32"]
+    let mut candidates = ["clangarm64", "ucrt64", "mingw64", "mingw32"]
         .iter()
         .map(|component| root.join(component))
         .filter(|candidate| candidate.is_dir());
```

**File**: `gix-path/src/env/tests.rs` (modified, +28/-12)
```diff
@@ -79,8 +79,9 @@ mod system_prefix {
     }
 
     #[test]
+    #[serial]
     fn exepath_no_relevant_subdir() {
-        for names in [&[][..], &["ucrt64"][..]] {
+        for names in [&[][..], &["clang64"][..]] {
             let exepath = ExePath::new();
             exepath.create_separate_subdirs(names);
             let outcome = system_prefix_from_exepath_var(|key| exepath.var_os_func(key));
@@ -89,49 +90,64 @@ mod system_prefix {
     }
 
     #[test]
+    #[serial]
     fn exepath_unambiguous_subdir() {
-        for name in ["mingw32", "mingw64", "clangarm64"] {
+        for name in ["clangarm64", "ucrt64", "mingw64", "mingw32"] {
             let exepath = ExePath::new();
             let subdir = exepath.create_subdir(name);
             let outcome = system_prefix_from_exepath_var(|key| exepath.var_os_func(key));
-            assert_eq!(outcome, Some(subdir));
+            assert_eq!(outcome, Some(subdir), "{name} is an unambiguous Git for Windows prefix");
         }
     }
 
     #[test]
+    #[serial]
     fn exepath_unambiguous_subdir_beside_strange_files() {
-        for (dirname, filename1, filename2) in [
-            ("mingw32", "mingw64", "clangarm64"),
-            ("mingw64", "mingw32", "clangarm64"),
-            ("clangarm64", "mingw32", "mingw64"),
+        for (dirname, filenames) in [
+            ("clangarm64", ["ucrt64", "mingw64", "mingw32"]),
+            ("ucrt64", ["clangarm64", "mingw64", "mingw32"]),
+            ("mingw64", ["clangarm64", "ucrt64", "mingw32"]),
+            ("mingw32", ["clangarm64", "ucrt64", "mingw64"]),
         ] {
             let exepath = ExePath::new();
             let subdir = exepath.create_subdir(dirname);
-            exepath.create_separate_regular_files(&[filename1, filename2]);
+            exepath.create_separate_regular_files(&filenames);
             let outcome = system_prefix_from_exepath_var(|key| exepath.var_os_func(key));
-            assert_eq!(outcome, Some(subdir));
+            assert_eq!(
+                outcome,
+                Some(subdir),
+                "only directories can be Git for Windows prefixes"
+            );
         }
     }
 
     #[test]
+    #[serial]
     fn exepath_ambiguous_subdir() {
         for names in [
+            &["ucrt64", "mingw64"][..],
+            &["ucrt64", "mingw32"][..],
+            &["clangarm64", "ucrt64"][..],
             &["mingw32", "mingw64"][..],
             &["mingw32", "clangarm64"][..],
             &["mingw64", "clangarm64"][..],
             &["mingw32", "mingw64", "clangarm64"][..],
+            &["clangarm64", "ucrt64", "mingw64", "mingw32"][..],
         ] {
             let exepath = ExePath::new();
             exepath.create_separate_subdirs(names);
             let outcome = system_prefix_from_exepath_var(|key| exepath.var_os_func(key));
-            assert_eq!(outcome, None);
+            assert_eq!(
+                outcome, None,
+                "multiple prefixes require querying Git to disambiguate {names:?}"
+            );
         }
     }
 
     #[test]
     #[serial]
     fn exepath_empty_string() {
-        for name in ["mingw32", "mingw64", "clangarm64"] {
+        for name in ["clangarm64", "ucrt64", "mingw64", "mingw32"] {
             let exepath = ExePath::new();
             exepath.create_subdir(name);
             let _cwd = CurrentDir::set(&exepath.path).expect("can change to test dir");
@@ -143,7 +159,7 @@ mod system_prefix {
     #[test]
     #[serial]
     fn exepath_nonempty_relative() {
-        for name in ["mingw32", "mingw64", "clangarm64"] {
+        for name in ["clangarm64", "ucrt64", "mingw64", "mingw32"] {
             let grandparent = tempfile::tempdir().expect("can create new temporary directory");
             let parent = grandparent
                 .path()
```

---

### Incident Patch 5: `6c12f2dc` (2026-09-29)
**Commit Message**: Merge pull request #3029 from cruessler/fix-minor-sha-256-issues-in-cli

Fix minor SHA-256 issues in CLI

**File**: `etc/plan/sha256-support.md` (removed, +0/-185)
```diff
@@ -1,185 +0,0 @@
-# SHA256 / Object-Hash Transition Plan
-
-Source issue: [GitoxideLabs/gitoxide#281](https://github.com/GitoxideLabs/gitoxide/issues/281)  
-Imported on: 2026-04-22  
-Last reconciled: 2026-05-08
-Working assumption: checkboxes in this file reflect current checkout, not only historical issue state.
-
-## Mission
-
-Make object-hash kind first-class across config, protocol, storage, tests, and clone flow so SHA1 and SHA256 are both deliberate runtime choices instead of SHA1 being hidden fallback everywhere.
-
-## Constraints
-
-- Use current workspace as source of truth.
-- Treat old issue checkmarks as historical context only.
-- Prefer end-to-end correctness over isolated enum or parser support.
-- Keep scope on actual supported transition path, not abandoned pack-index-v3 speculation.
-
-## Reconciled Status
-
-- [ ] Remove hash-type specific methods from `gix-hash` and lean on `gix_hash::Kind`-parametric usage.
-  Evidence: `gix-hash` still contains `new_sha1`, `new_sha256`, `from_20_bytes`, `from_32_bytes`, `null_sha1`, `null_sha256`.
-- [ ] Remove len-20 assumptions from all relevant code paths.
-  Evidence: big progress exists, but 79 non-plan/non-changelog `Kind::Sha1.null()`/`ObjectId::null(...Sha1)` call sites still remain, plus a few explicit 20-byte comments and helpers.
-- [x] Provide visible CLI path for choosing object hash kind.
-  Evidence: `src/plumbing/options/mod.rs` and `src/plumbing/options/free.rs` expose clap `object_hash` fields, which produce `--object-hash`.
-- [x] Propagate `sha256` feature support through crates that participate in object traversal, object parsing, and object-id storage.
-  Evidence: 31 workspace packages now define a `sha256` feature, including `gix-object`, `gix-index`, `gix-protocol`, `gix-ref`, `gix-refspec`, `gix-traverse`, and top-level `gix`.
-- [ ] Make SHA256-only builds compile where supported by feature flags.
-  Evidence: `cargo check -p gix --no-default-features --features sha256` fails because `gix/src/config/cache/incubate.rs` and `gix/src/config/tree/sections/core.rs` still name `gix_hash::Kind::Sha1` unconditionally.
-- [x] Remove default `sha1` feature from `gix-hash` and deal with fallout.
-  Evidence: `gix-hash` has `default = []`, docs.rs explicitly enables `sha1`, root `gitoxide` chooses SHA1 via features, and `justfile` contains compile-guard checks for missing hash selection.
-- [x] Remove SHA1 mention from `gix-features` feature toggles.
-  Evidence: `gix-features/Cargo.toml` has no SHA1/SHA256 feature toggles anymore.
-- [x] Parameterize hash length when decoding non-blob objects.
-  Evidence: `gix-object` tree decoding hotspot uses `hash_kind.len_in_bytes()`.
-- [x] Add `Sha256` enum variant and hasher support.
-  Evidence: `gix_hash::Kind::Sha256`, `ObjectId::Sha256`, and `Hasher::Sha256` exist.
-- [x] Add broad dual-hash test hooks for reading refs and objects of different lengths.
-  Evidence: `justfile` runs SHA256 fixture suites for `gix-object`, `gix-ref-tests`, `gix-traverse-tests`, and top-level `gix`.
-- [ ] Add write/read roundtrip coverage for different hash lengths, ideally with stronger repo-level verification.
-  Evidence: targeted tests exist, but no obvious repo-conversion or full transition verifier is present.
-- [ ] Handle remote object-hash mismatch during clone by configuring repository accordingly.
-  Evidence: `gix/src/clone/fetch/mod.rs` still has `unimplemented!("configure repository to expect a different object hash as advertised by the server")`.
-
-## Deferred / Out Of Scope
-
-- [x] Pack index v3 transition work stays deferred unless Git actually relies on it.
-  Rationale: issue itself already demoted this from active task to decision point.
-
-## Current Snapshot
-
-Workspace signals on 2026-05-08:
-
-- `gix-hash` default hash feature: removed
-- compile-guard checks for missing hash selection in `justfile`: 8
-- crates/packages with explicit `sha256 = ...` feature declarations: 31
-- `gix-traverse` hash fea
```

**File**: `gitoxide-core/src/query/engine/command.rs` (modified, +13/-8)
```diff
@@ -62,18 +62,23 @@ impl query::Engine {
                     progress.inc();
                     for row in rows {
                         let (hash, mode, source_file_id, has_diff, lines_added, lines_removed): (
-                            [u8; 20],
+                            Vec<u8>,
                             usize,
                             Option<usize>,
                             bool,
                             usize,
                             usize,
                         ) = row?;
-                        let id = gix::ObjectId::from(hash);
-                        let commit_time = id.attach(&self.repo).object()?.into_commit().committer()?.time()?;
+                        let commit_id = gix::ObjectId::try_from(hash.as_slice())?;
+                        let commit_time = commit_id
+                            .attach(&self.repo)
+                            .object()?
+                            .into_commit()
+                            .committer()?
+                            .time()?;
                         let mode = FileMode::from_usize(mode).context("invalid file mode")?;
                         info.push(trace_path::Info {
-                            id,
+                            commit_id,
                             commit_time,
                             file_id,
                             mode,
@@ -93,7 +98,7 @@ impl query::Engine {
                     }
                 }
 
-                info.sort_by_key(|a| a.id);
+                info.sort_by_key(|a| a.commit_id);
                 let max_diff_lines = info
                     .iter()
                     .map(|i| i.diff.map_or(0, |d| d.lines_removed + d.lines_added))
@@ -104,7 +109,7 @@ impl query::Engine {
                 for info in self
                     .commits
                     .iter()
-                    .filter_map(|c| info.binary_search_by(|i| i.id.cmp(c)).ok().map(|idx| &info[idx]))
+                    .filter_map(|c| info.binary_search_by(|i| i.commit_id.cmp(c)).ok().map(|idx| &info[idx]))
                 {
                     found += 1;
                     info.write_to(&mut out, &self.repo, &seen, max_diff_lines)?;
@@ -152,7 +157,7 @@ mod trace_path {
 
     #[derive(Debug)]
     pub struct Info {
-        pub id: gix::ObjectId,
+        pub commit_id: gix::ObjectId,
         pub commit_time: gix::date::Time,
         pub file_id: usize,
         pub mode: FileMode,
@@ -168,7 +173,7 @@ mod trace_path {
             path_by_id: &HashMap<usize, String>,
             max_diff_lines: usize,
         ) -> std::io::Result<()> {
-            let id = self.id.attach(repo);
+            let id = self.commit_id.attach(repo);
             match self.source_file_id {
                 Some(source_id) => {
                     writeln!(
```

**File**: `gitoxide-core/src/repository/index/mod.rs` (modified, +1/-1)
```diff
@@ -43,10 +43,10 @@ pub fn from_list(
     entries_file: PathBuf,
     index_path: Option<PathBuf>,
     force: bool,
+    object_hash: gix::hash::Kind,
     skip_hash: bool,
 ) -> anyhow::Result<()> {
     use std::io::BufRead;
-    let object_hash = gix::hash::Kind::Sha1;
 
     let mut index = gix::index::State::new(object_hash);
     for path in std::io::BufReader::new(std::fs::File::open(entries_file)?).lines() {
```

**File**: `gix/src/config/tree/sections/extensions.rs` (modified, +2/-4)
```diff
@@ -11,12 +11,10 @@ impl Extensions {
         keys::Boolean::new_boolean("relativeWorktrees", &config::Tree::EXTENSIONS);
     /// The `extensions.objectFormat` key.
     pub const OBJECT_FORMAT: ObjectFormat =
-        ObjectFormat::new_with_validate("objectFormat", &config::Tree::EXTENSIONS, validate::ObjectFormat).with_note(
-            "Support for SHA256 is prepared but not fully implemented yet. For now we abort when encountered",
-        );
+        ObjectFormat::new_with_validate("objectFormat", &config::Tree::EXTENSIONS, validate::ObjectFormat);
 }
 
-/// The `core.checkStat` key.
+/// The `extensions.objectFormat` key.
 pub type ObjectFormat = keys::Any<validate::ObjectFormat>;
 
 mod object_format {
```

**File**: `src/plumbing/main.rs` (modified, +1/-1)
```diff
@@ -950,7 +950,7 @@ pub fn main() -> Result<()> {
                     progress_keep_open,
                     None,
                     move |_progress, _out, _err| {
-                        core::repository::index::from_list(file, index_output_path, force, skip_hash)
+                        core::repository::index::from_list(file, index_output_path, force, object_hash, skip_hash)
                     },
                 ),
                 free::index::Subcommands::CheckoutExclusive {
```

---

### Incident Patch 6: `f3225e90` (2026-09-29)
**Commit Message**: fix(gitoxide-core): support SHA-256 in query path tracing

<!-- agent -->
`ein tool query . trace-path file` failed on SHA-256 repositories because
path history rows were decoded as `[u8; 20]`, although SQLite stores the
full 32-byte commit IDs.

Decode the blob into `Vec<u8>` and use `ObjectId::try_from()` to select the
hash kind from its length while rejecting unsupported lengths. Add an
isolated journey test for SHA-1 and SHA-256 that checks the traced path,
diff statistics, and full commit ID against Git.

Assisted-by: GPT 6.0 Astra
Co-authored-by: GPT 6.0 Astra <codex@openai.com>

**File**: `gitoxide-core/src/query/engine/command.rs` (modified, +13/-8)
```diff
@@ -62,18 +62,23 @@ impl query::Engine {
                     progress.inc();
                     for row in rows {
                         let (hash, mode, source_file_id, has_diff, lines_added, lines_removed): (
-                            [u8; 20],
+                            Vec<u8>,
                             usize,
                             Option<usize>,
                             bool,
                             usize,
                             usize,
                         ) = row?;
-                        let id = gix::ObjectId::from(hash);
-                        let commit_time = id.attach(&self.repo).object()?.into_commit().committer()?.time()?;
+                        let commit_id = gix::ObjectId::try_from(hash.as_slice())?;
+                        let commit_time = commit_id
+                            .attach(&self.repo)
+                            .object()?
+                            .into_commit()
+                            .committer()?
+                            .time()?;
                         let mode = FileMode::from_usize(mode).context("invalid file mode")?;
                         info.push(trace_path::Info {
-                            id,
+                            commit_id,
                             commit_time,
                             file_id,
                             mode,
@@ -93,7 +98,7 @@ impl query::Engine {
                     }
                 }
 
-                info.sort_by_key(|a| a.id);
+                info.sort_by_key(|a| a.commit_id);
                 let max_diff_lines = info
                     .iter()
                     .map(|i| i.diff.map_or(0, |d| d.lines_removed + d.lines_added))
@@ -104,7 +109,7 @@ impl query::Engine {
                 for info in self
                     .commits
                     .iter()
-                    .filter_map(|c| info.binary_search_by(|i| i.id.cmp(c)).ok().map(|idx| &info[idx]))
+                    .filter_map(|c| info.binary_search_by(|i| i.commit_id.cmp(c)).ok().map(|idx| &info[idx]))
                 {
                     found += 1;
                     info.write_to(&mut out, &self.repo, &seen, max_diff_lines)?;
@@ -152,7 +157,7 @@ mod trace_path {
 
     #[derive(Debug)]
     pub struct Info {
-        pub id: gix::ObjectId,
+        pub commit_id: gix::ObjectId,
         pub commit_time: gix::date::Time,
         pub file_id: usize,
         pub mode: FileMode,
@@ -168,7 +173,7 @@ mod trace_path {
             path_by_id: &HashMap<usize, String>,
             max_diff_lines: usize,
         ) -> std::io::Result<()> {
-            let id = self.id.attach(repo);
+            let id = self.commit_id.attach(repo);
             match self.source_file_id {
                 Some(source_id) => {
                     writeln!(
```

**File**: `tests/journey/ein.sh` (modified, +25/-0)
```diff
@@ -38,6 +38,31 @@ title "Porcelain ${kind}"
   snapshot="$snapshot/porcelain"
   (when "using the 'tool' subcommand"
     title "ein tool"
+    if test "$kind" = "max"; then
+    title "ein tool query"
+    (when "tracing a path through history"
+      for object_format in sha1 sha256; do
+        (with "a $object_format repository"
+          (sandbox
+            git init --object-format="$object_format" -q
+            git config core.abbrev no
+            echo first >file
+            git add file
+            git commit -q -m "first"
+            # A non-root change ensures tracing decodes a stored commit hash.
+            echo second >>file
+            git commit -q -am "second"
+            printf '++++++++++| 2020-09-09 | %s Δ file' "$(git rev-parse HEAD)" >expected
+
+            it "traces the path with its full commit ID" && {
+              WITH_SNAPSHOT="$PWD/expected" \
+              expect_run $SUCCESSFULLY "$exe" -q tool query . trace-path file
+            }
+          )
+        )
+      done
+    )
+    fi
     (with "a repo with a tiny commit history"
       (small-repo-in-sandbox
         title "ein tool estimate-hours"
```

---

### Incident Patch 7: `fe2018f7` (2026-09-28)
**Commit Message**: fix(gix): anchor worktree removal paths to the repository CWD

<!-- agent -->
A repository opened through a relative path retains the CWD that gives its
paths meaning. Changing the process CWD before worktree removal made exact
lookup and suffix disambiguation resolve registrations against the wrong
location. Registration scans, lock checks, and reopening a selected worktree
also depended on the process CWD.

Resolve registered checkout paths with `repo.current_dir()`. Anchor proxy
private Git directories and reopened common directories to that captured
CWD, so enumeration, lookup by ID, locks, status, and removal keep using the
original repository. Keep caller-supplied relative targets relative to the
current process CWD. Document that proxy paths are now absolute.

Extend the isolated relative-path removal test with a CWD change and lock
checks, and cover absolute lookup, ambiguous suffix disambiguation, repository
inspection, and main-worktree protection from both main and linked handles.
The new CWD cases failed before the fix.

Assisted-by: GPT 6.0 Astra
Co-authored-by: GPT 6.0 Astra <codex@openai.com>

**File**: `gix/src/repository/worktree.rs` (modified, +2/-2)
```diff
@@ -58,7 +58,7 @@ impl crate::Repository {
     /// Note that these need additional processing to become usable, but provide a first glimpse a typical worktree information.
     pub fn worktrees(&self) -> Result<Vec<worktree::Proxy<'_>>> {
         let mut res = Vec::new();
-        let iter = match std::fs::read_dir(self.common_dir().join("worktrees")) {
+        let iter = match std::fs::read_dir(self.current_dir().join(self.common_dir()).join("worktrees")) {
             Ok(iter) => iter,
             Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Ok(res),
             Err(err) => return Err(Error::from_error(err)),
@@ -108,7 +108,7 @@ impl crate::Repository {
             return Ok(self.clone());
         }
         let options = self.options.clone().without_repository_environment_overrides();
-        crate::ThreadSafeRepository::open_opts(self.common_dir(), options).map(Into::into)
+        crate::ThreadSafeRepository::open_opts(self.current_dir().join(self.common_dir()), options).map(Into::into)
     }
 
     /// Return the currently set worktree if there is one, acting as platform providing a validated worktree base path.
```

**File**: `gix/src/worktree/proxy.rs` (modified, +10/-8)
```diff
@@ -13,14 +13,14 @@ impl<'repo> Proxy<'repo> {
     pub(crate) fn new(parent: &'repo Repository, git_dir: impl Into<PathBuf>) -> Self {
         Proxy {
             parent,
-            git_dir: git_dir.into(),
+            git_dir: parent.current_dir().join(git_dir.into()),
         }
     }
 
     pub(crate) fn new_if_gitdir_file_exists(parent: &'repo Repository, git_dir: impl Into<PathBuf>) -> Option<Self> {
-        let git_dir = git_dir.into();
-        if git_dir.join("gitdir").is_file() {
-            Some(Proxy::new(parent, git_dir))
+        let proxy = Proxy::new(parent, git_dir);
+        if proxy.git_dir.join("gitdir").is_file() {
+            Some(proxy)
         } else {
             None
         }
@@ -38,13 +38,15 @@ impl Proxy<'_> {
         })?
     }
 
-    /// Read the location of the checkout, the base of the work tree.
+    /// Read the absolute location of the checkout, the base of the work tree.
+    /// Relative registrations are resolved against the private Git directory.
     /// Note that the location might not exist.
     pub fn base(&self) -> std::io::Result<PathBuf> {
         Ok(gix_discover::path::without_dot_git_dir(self.dot_git()?))
     }
 
-    /// The git directory for the work tree, typically contained within the parent git dir.
+    /// The absolute git directory for the work tree, typically contained within the parent git dir.
+    /// Relative repository paths are anchored to the parent repository's captured current directory.
     pub fn git_dir(&self) -> &Path {
         &self.git_dir
     }
@@ -90,7 +92,7 @@ impl Proxy<'_> {
     pub fn into_repo_with_possibly_inaccessible_worktree(self) -> Result<Repository> {
         let base = self.base().ok();
         let options = self.parent.options.clone().without_repository_environment_overrides();
-        let common_dir = self.parent.common_dir().to_owned();
+        let common_dir = self.parent.current_dir().join(self.parent.common_dir());
         let repo = ThreadSafeRepository::open_from_paths(self.git_dir, base, options, Some(common_dir))?;
         Ok(repo.into())
     }
@@ -108,7 +110,7 @@ impl Proxy<'_> {
             )));
         }
         let options = self.parent.options.clone().without_repository_environment_overrides();
-        let common_dir = self.parent.common_dir().to_owned();
+        let common_dir = self.parent.current_dir().join(self.parent.common_dir());
         let repo = ThreadSafeRepository::open_from_paths(self.git_dir, base.into(), options, Some(common_dir))?;
         Ok(repo.into())
     }
```

**File**: `gix/src/worktree/remove.rs` (modified, +7/-4)
```diff
@@ -4,6 +4,7 @@ use gix_error::{ClassificationMarker, ErrorExt, ResultExt, message};
 
 use crate::{Result, bstr::BString};
 use gix_features::progress::{Count, NestedProgress, Progress};
+use gix_path::realpath::MAX_SYMLINKS;
 
 pub use gix_worktree::remove::Options;
 
@@ -37,7 +38,7 @@ pub struct Target<'repo> {
 }
 
 impl Target<'_> {
-    /// Return the checkout directory, whether or not it is currently accessible.
+    /// Return the absolute checkout directory, whether or not it is currently accessible.
     pub fn base(&self) -> &Path {
         &self.base
     }
@@ -75,6 +76,8 @@ impl Target<'_> {
     ///
     /// Obtain a target with [`Repository::prepare_remove_worktree()`][crate::Repository::prepare_remove_worktree()],
     /// which accepts an absolute or relative worktree path or a unique suffix of whole path components.
+    /// Relative target paths use the process's current directory, while registered paths use the directory
+    /// captured when the repository was opened.
     /// The returned target can be inspected with [`Target::repository()`] before it is consumed by this method.
     ///
     /// # Examples
@@ -357,14 +360,14 @@ fn resolve<'repo>(repo: &'repo crate::Repository, target: &Path) -> Result<Targe
         gix_path::realpath(target).or_raise(|| message!("Could not resolve worktree path '{}'", target.display()))?;
     let mut exact_matches = Vec::new();
     if let Some(path) = main {
-        let resolved =
-            gix_path::realpath(&path).or_raise(|| message!("Could not resolve worktree path '{}'", path.display()))?;
+        let resolved = gix_path::realpath_opts(&path, repo.current_dir(), MAX_SYMLINKS)
+            .or_raise(|| message!("Could not resolve worktree path '{}'", path.display()))?;
         if path_eq(&resolved, &resolved_target, ignore_case) {
             exact_matches.push(Match::Main(path));
         }
     }
     for candidate in linked {
-        let resolved = gix_path::realpath(&candidate.base)
+        let resolved = gix_path::realpath_opts(&candidate.base, repo.current_dir(), MAX_SYMLINKS)
             .or_raise(|| message!("Could not resolve worktree path '{}'", candidate.base.display()))?;
         if path_eq(&resolved, &resolved_target, ignore_case) {
             exact_matches.push(Match::Linked(candidate));
```

**File**: `gix/tests/gix/repository/worktree.rs` (modified, +84/-6)
```diff
@@ -1197,6 +1197,7 @@ mod remove {
             return Ok(());
         }
         let (source, _fixture) = crate::basic_rw_repo()?;
+        let elsewhere = gix_testtools::tempfile::TempDir::new()?;
         let _cwd = gix_testtools::set_current_dir(source.workdir().expect("non-bare fixture"))?;
         let mut repo = gix::open_opts(".", crate::restricted())?;
         let destination = repo.current_dir().join("linked");
@@ -1215,14 +1216,32 @@ mod remove {
             drop(linked);
             let proxy = repo.worktrees()?.pop().expect("one linked worktree was registered");
             assert!(
-                proxy.git_dir().is_relative(),
-                "the private Git directory needs an absolute base"
+                repo.git_dir().is_relative(),
+                "the parent repository's private Git directory needs an absolute base"
             );
+            assert!(
+                proxy.git_dir().is_absolute() && proxy.base()?.is_absolute(),
+                "proxies anchor relative paths to the repository CWD"
+            );
+            std::fs::write(private_git_dir.join("locked"), b"keep this worktree\n")?;
+            let _moved_cwd = gix_testtools::set_current_dir(elsewhere.path())?;
+
             assert_eq!(
-                proxy.base()?.is_relative(),
-                relative_links,
-                "relative backlinks also leave the checkout path relative"
+                repo.worktree_proxy_by_id(proxy.id())
+                    .expect("registration lookup uses the repository CWD")
+                    .git_dir(),
+                proxy.git_dir(),
+                "looking up a proxy before or after changing CWD locates the same registration"
+            );
+            let err = proxy
+                .clone()
+                .remove(Force::DiscardChanges, gix::progress::Discard)
+                .expect_err("changing CWD cannot bypass a worktree lock");
+            assert!(
+                matches!(err.downcast_any_ref::<gix::worktree::remove::Error>(), Some(gix::worktree::remove::Error::Locked { reason: Some(reason), .. }) if reason == "keep this worktree"),
+                "the lock and its reason are read relative to the repository CWD: {err:?}"
             );
+            std::fs::remove_file(private_git_dir.join("locked"))?;
 
             proxy.remove(Force::Never, gix::progress::Discard)?;
 
@@ -1232,6 +1251,61 @@ mod remove {
         Ok(())
     }
 
+    #[test]
+    fn resolves_registered_paths_after_changing_current_directory() -> crate::Result {
+        if gix_testtools::run_in_isolated_process()? {
+            return Ok(());
+        }
+        let (source, _fixture) = crate::basic_rw_repo()?;
+        let _cwd = gix_testtools::set_current_dir(source.workdir().expect("non-bare fixture"))?;
+        let mut repo = gix::open_opts(".", crate::restricted())?;
+        repo.config_snapshot_mut()
+            .set_raw_value("worktree.useRelativePaths", "true")?;
+        let first_path = repo.current_dir().join("one/shared");
+        let second_path = repo.current_dir().join("two/shared");
+        for destination in [&first_path, &second_path] {
+            repo.add_worktree(
+                destination,
+                gix::worktree::add::Head::Detached(repo.head_id()?.detach()),
+                gix::progress::Discard,
+                &AtomicBool::default(),
+            )?;
+        }
+        let linked = gix::open_opts("one/shared", crate::restricted())?;
+        let _moved_cwd = gix_testtools::set_current_dir(first_path.parent().expect("nested checkout"))?;
+
+        for repo in [&repo, &linked] {
+            for target in [first_path.as_path(), std::path::Path::new("shared")] {
+                let target = repo.prepare_remove_worktree(target)?;
+                assert_eq!(
+                    gix_path::realpath(target.base())?,
+                    first_path,
+                    "absolute paths and ambiguous suffixes select the registered checkout after 
```

---

### Incident Patch 8: `3f6fcda6` (2026-09-28)
**Commit Message**: Merge pull request #3026 from GitoxideLabs/status-fix

Fix phantom untracked submodules and Unicode filenames

**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -2701,6 +2701,7 @@ name = "gix-utils"
 version = "0.4.0"
 dependencies = [
  "bstr",
+ "criterion",
  "fastrand",
  "getrandom 0.4.3",
  "gix-utils",
```

**File**: `gix-dir/src/walk/classify.rs` (modified, +4/-2)
```diff
@@ -238,8 +238,10 @@ pub fn path(
         )
     };
     if let Some(status) = maybe_status {
-        if kind == Some(entry::Kind::Directory) && index_kind == Some(entry::Kind::Repository) {
-            kind = maybe_upgrade_to_repository(kind, false);
+        if kind == Some(entry::Kind::Directory) && index_kind == Some(entry::Kind::Repository) && !recurse_repositories
+        {
+            // A gitlink remains a repository boundary even when its checkout is missing.
+            kind = Some(entry::Kind::Repository);
         }
         return Ok(out.with_status(status).with_kind(kind, index_kind));
     }
```

**File**: `gix-dir/src/walk/function.rs` (modified, +1/-1)
```diff
@@ -92,7 +92,7 @@ pub fn walk(
             return Err(validation(format!("Worktree root at '{}' is not a directory", root.display())).raise_erased());
         }
         if options.precompose_unicode {
-            buf = gix_utils::str::precompose_bstr(buf.into()).into_owned();
+            buf = gix_path::into_bstr(gix_utils::str::precompose_path(gix_path::from_bstr(buf))).into_owned();
         }
         let _ = emit_entry(
             Cow::Borrowed(buf.as_bstr()),
```

**File**: `gix-dir/tests/dir/walk.rs` (modified, +90/-62)
```diff
@@ -3460,6 +3460,54 @@ fn submodules() -> Result {
     Ok(())
 }
 
+#[test]
+fn uninitialized_submodules_with_files_remain_tracked() -> Result {
+    let root = fixture("uninitialized-submodules-with-files");
+    assert_eq!(
+        gix_testtools::git(&root, "--no-optional-locks status --porcelain=v1 --untracked-files=all")?,
+        "",
+        "Git ignores files placed inside uninitialized submodules"
+    );
+
+    for fresh_index in [false, true] {
+        for ignore_case in [false, true] {
+            let ((out, _), entries) = try_collect_filtered_opts_collect(
+                &root,
+                None,
+                |keep, ctx| {
+                    walk(
+                        &root,
+                        ctx,
+                        walk::Options {
+                            ignore_case,
+                            emit_tracked: true,
+                            ..options()
+                        },
+                        keep,
+                    )
+                },
+                None::<&str>,
+                Options {
+                    fresh_index,
+                    ..Default::default()
+                },
+            )?;
+            assert_eq!(
+                entries,
+                [
+                    entry(".gitmodules", Tracked, File),
+                    entry("a/b", Tracked, Repository),
+                    entry("empty", Tracked, File),
+                    entry("submodule", Tracked, Repository),
+                ],
+                "gitlinks stay tracked without a checkout (fresh_index={fresh_index}, ignore_case={ignore_case})"
+            );
+            assert_eq!(out.read_dir_calls, 2, "submodule contents are never traversed");
+        }
+    }
+    Ok(())
+}
+
 #[test]
 fn cancel_with_collection_does_not_fail() -> Result {
     struct CancelDelegate {
@@ -3972,72 +4020,52 @@ fn nested_repos_in_ignored_directories() -> Result {
     ignore = "Needs filesystem that folds unicode composition"
 )]
 fn decomposed_unicode_in_root_is_returned_precomposed() -> Result {
-    let root = gix_testtools::tempfile::TempDir::new()?;
-
-    let decomposed = "a\u{308}";
-    let precomposed = "ä";
-    std::fs::write(root.path().join(decomposed), [])?;
-
-    let troot = root.path().join(decomposed);
-    let ((out, actual_root), entries) = try_collect_filtered_opts_collect_with_root(
-        root.path(),
-        None,
-        Some(&troot),
-        |keep, ctx| {
-            walk(
+    for (decomposed, precomposed) in [
+        ("a\u{308}", "ä"),
+        ("📹/a\u{308}", "📹/ä"),
+        ("a\u{308}/📹a\u{308}", "ä/📹a\u{308}"),
+    ] {
+        let root = gix_testtools::tempfile::TempDir::new()?;
+        let troot = root.path().join(decomposed);
+        std::fs::create_dir_all(troot.parent().expect("the file is inside the temporary directory"))?;
+        std::fs::write(&troot, [])?;
+        for (precompose_unicode, expected) in [(true, precomposed), (false, decomposed)] {
+            let ((out, actual_root), entries) = try_collect_filtered_opts_collect_with_root(
                 root.path(),
-                ctx,
-                walk::Options {
-                    precompose_unicode: true,
-                    ..options()
+                None,
+                Some(&troot),
+                |keep, ctx| {
+                    walk(
+                        root.path(),
+                        ctx,
+                        walk::Options {
+                            precompose_unicode,
+                            ..options()
+                        },
+                        keep,
+                    )
                 },
-                keep,
-            )
-        },
-        None::<&str>,
-        Default::default(),
-    )?;
-
-    assert_eq!(actual_root, troot);
-    assert_eq!(
-        out,
-        walk::Outcome {
-            read_dir_calls: 0,
-            returned_entries: entries.len(),
-            seen_entries: 1,
-        }
-    )
```

**File**: `gix-dir/tests/fixtures/many.sh` (modified, +7/-0)
```diff
@@ -359,6 +359,13 @@ git clone submodule multiple-submodules
   git commit -m "add modules"
 )
 
+git clone --no-local multiple-submodules uninitialized-submodules-with-files
+(cd uninitialized-submodules-with-files
+  # Cloning without submodule recursion leaves gitlinks backed by ordinary directories.
+  printf '%s' content >submodule/untracked
+  printf '%s' content >a/b/untracked
+)
+
 git clone submodule one-ignored-submodule
 (cd one-ignored-submodule
   git submodule add ../submodule submodule
```

---

### Incident Patch 9: `fbcb2628` (2026-09-27)
**Commit Message**: fix(gix-utils): avoid redundant Unicode precomposition work

<!-- agent -->
We now preserve macOS conversion failures per filename, but splitting
every path adds work even for ASCII. In the initial benchmark, ASCII paths
took about 2.6-2.8 times as long as before. The existing `is_nfc()`
check can also perform a full NFC conversion before our compatibility
composer performs its own decomposition and composition.

Use `is_nfc_quick()` and detect non-BMP characters through the same iterator.
Only scan its unvisited suffix if quick-check stops early. ASCII strings
return immediately; ASCII paths also avoid UTF-8 validation and splitting.
Process BMP-only paths together, reserving component splitting for paths
with conversion failures. Specialize filename and path handling at compile
time to keep the path fallback out of the filename loop.

Skip combining-class and composition lookups for ASCII starters, use byte
lengths for buffer capacities instead of counting characters, and reserve
the output string before encoding it. Keep noncanonical mark order, Hangul
composition, component-local fallback, and the original `Cow` when unchanged.

The capacity estimate can reserve more space than

**File**: `gix-utils/src/str.rs` (modified, +69/-23)
```diff
@@ -5,12 +5,58 @@ use std::{borrow::Cow, ffi::OsStr, path::Path};
 /// Strings containing characters outside the Basic Multilingual Plane are left unchanged, matching Git's
 /// fallback when macOS's `UTF-8-MAC` conversion rejects them.
 ///
-/// At the expense of extra-compute, it does nothing if there is no work to be done, returning the original input without allocating.
+/// Returns the original input when unchanged.
 pub fn precompose(s: Cow<'_, str>) -> Cow<'_, str> {
-    use unicode_normalization::{char, is_nfc};
-    if is_nfc(s.as_ref()) || s.chars().any(|ch| ch > '\u{ffff}') {
+    precompose_impl::<false>(s)
+}
+
+fn precompose_impl<const IS_PATH: bool>(s: Cow<'_, str>) -> Cow<'_, str> {
+    use unicode_normalization::{IsNormalized, char, is_nfc_quick};
+    if s.is_ascii() {
+        return s;
+    }
+    let mut chars = s.chars();
+    let mut non_bmp = false;
+    let normalized = is_nfc_quick(chars.by_ref().take_while(|ch| {
+        non_bmp = *ch > '\u{ffff}';
+        !non_bmp
+    }));
+    // On a path, stopping at a non-BMP character leaves later components to normalize.
+    if normalized == IsNormalized::Yes && (!IS_PATH || !non_bmp) {
         return s;
     }
+    // Quick-check can stop before visiting a non-BMP character. Finish the fallback check if needed.
+    // Avoid `is_nfc()`: an inconclusive quick-check would normalize the string before we compose it again.
+    if non_bmp || chars.any(|ch| ch > '\u{ffff}') {
+        if !IS_PATH {
+            return s;
+        }
+        // Split only when conversion can fail: ASCII separators already keep BMP compositions independent.
+        let mut out: Option<String> = None;
+        let mut offset = 0;
+        #[cfg(windows)]
+        let components = s.split_inclusive(['/', '\\']);
+        #[cfg(not(windows))]
+        let components = s.split_inclusive('/');
+        for component in components {
+            match precompose(component.into()) {
+                Cow::Borrowed(component) => {
+                    if let Some(out) = &mut out {
+                        out.push_str(component);
+                    }
+                }
+                Cow::Owned(component) => out
+                    .get_or_insert_with(|| {
+                        let mut out = String::with_capacity(s.len());
+                        out.push_str(&s[..offset]);
+                        out
+                    })
+                    .push_str(&component),
+            }
+            offset += component.len();
+        }
+        return out.map_or(s, Cow::Owned);
+    }
 
     /// Compose filesystem-decomposed characters without the canonical reordering that full NFC performs.
     /// Non-composable combining marks must retain their byte order to keep matching index entries.
@@ -22,8 +68,14 @@ pub fn precompose(s: Cow<'_, str>) -> Cow<'_, str> {
     ///
     /// Returns `true` if `ch` was composed into the starter, or `false` if it was appended unchanged.
     fn push(out: &mut Vec<char>, starter: &mut Option<usize>, max_class: &mut u8, ch: char) -> bool {
-        let class = char::canonical_combining_class(ch);
-        if let Some(starter) = *starter
+        let class = if ch.is_ascii() {
+            0
+        } else {
+            char::canonical_combining_class(ch)
+        };
+        // ASCII always starts a new sequence and cannot be the second character in a composition.
+        if !ch.is_ascii()
+            && let Some(starter) = *starter
             && (*max_class == 0 || *max_class < class)
             && let Some(composed) = char::compose(out[starter], ch)
         {
@@ -40,7 +92,8 @@ pub fn precompose(s: Cow<'_, str>) -> Cow<'_, str> {
         false
     }
 
-    let mut out = Vec::with_capacity(s.chars().count());
+    // The byte length is a cheap capacity estimate and avoids another character-counting pass.
+    let mut out = Vec::with_capacity(s.len());
     let mut starter = None;
     let mut max_class = 0;
     let mut changed = fal
```

**File**: `gix-utils/tests/utils/str.rs` (modified, +45/-7)
```diff
@@ -34,17 +34,25 @@ mod precompose {
 
     #[test]
     fn already_precomposed_does_not_copy() {
-        let actual = gix_utils::str::precompose("ä".into());
-        assert!(
-            matches!(actual, Cow::Borrowed(_)),
-            "pass-through as nothing needs to be done"
-        );
-        assert_eq!(actual.chars().collect::<Vec<_>>(), ['ä']);
+        for input in ["", "git_status.rs", "ä", "äq\u{308}", "한글"] {
+            let actual = gix_utils::str::precompose(input.into());
+            assert!(
+                matches!(actual, Cow::Borrowed(_)),
+                "unchanged input must be borrowed even when NFC quick-check is inconclusive: {input:?}"
+            );
+            assert_eq!(actual, input, "already precomposed text stays unchanged");
+        }
     }
 
     #[test]
     fn non_bmp_characters_prevent_precomposition() {
-        for input in ["📹U\u{308}.md", "U\u{308}📹.md", "U\u{308}\u{10000}.md"] {
+        for input in [
+            "📹U\u{308}.md",
+            "U\u{308}📹.md",
+            "U\u{308}\u{10000}.md",
+            "\u{212b}U\u{308}📹.md",
+            "A\u{315}\u{323}\u{301}📹.md",
+        ] {
             let actual = gix_utils::str::precompose(input.into());
             assert_eq!(
                 actual, input,
@@ -81,6 +89,32 @@ mod precompose {
         let actual = gix_utils::str::precompose("\u{212b}\u{301}".into());
         assert_eq!(actual, "\u{1fa}", "canonical composition must remain complete");
     }
+
+    #[test]
+    fn hangul_jamo_are_composed() {
+        let actual = gix_utils::str::precompose("\u{1112}\u{1161}\u{11ab}\u{1100}\u{1173}\u{11af}".into());
+        assert_eq!(
+            actual, "한글",
+            "class-zero characters can compose into Hangul syllables"
+        );
+    }
+
+    #[test]
+    fn nfc_bmp_starters_with_combining_marks_stay_unchanged() {
+        use unicode_normalization::UnicodeNormalization;
+
+        for starter in (0..=0xffff).filter_map(char::from_u32) {
+            for mark in ['\u{301}', '\u{308}', '\u{323}'] {
+                let input: String = [starter, mark].into_iter().nfc().collect();
+                let actual = gix_utils::str::precompose(input.as_str().into());
+                assert_eq!(actual, input, "NFC text must remain unchanged: {input:?}");
+                assert!(
+                    matches!(actual, Cow::Borrowed(_)),
+                    "inconclusive quick-checks must still borrow unchanged text: {input:?}"
+                );
+            }
+        }
+    }
 }
 
 mod precompose_path {
@@ -89,6 +123,10 @@ mod precompose_path {
     #[test]
     fn non_bmp_fallback_is_component_local() {
         for (input, expected) in [
+            ("//src//./git_status.rs/", "//src//./git_status.rs/"),
+            ("Teaching/Überwachung.md", "Teaching/Überwachung.md"),
+            ("U\u{308}/\u{308}/A\u{308}", "Ü/\u{308}/Ä"),
+            ("\u{212a}/📹U\u{308}/U\u{308}", "K/📹U\u{308}/Ü"),
             ("📹/U\u{308}", "📹/Ü"),
             ("U\u{308}/📹U\u{308}", "Ü/📹U\u{308}"),
             ("//📹//./U\u{308}/", "//📹//./Ü/"),
```

---

### Incident Patch 10: `4f7454a4` (2026-09-27)
**Commit Message**: fix(gix-utils): preserve filenames rejected by macOS precomposition

<!-- agent -->
The original Starship report states that a tracked filename
containing both an emoji and a decomposed umlaut is reported
as untracked by `gix status`.

Git's macOS `UTF-8-MAC` conversion rejects characters outside the Basic
Multilingual Plane. When conversion fails, Git keeps the entire original
input, including any decomposed umlauts before or after the rejected
character. Our precomposition instead changed those umlauts, preventing
the directory walk from matching Git's index entries.

Preserve inputs containing non-BMP characters in the shared precomposition
helper. Apply that rule separately to each filesystem-path component,
preserving path separators and borrowing unchanged paths. Reference packing
and lookup also use component-wise precomposition, consistent with loose
reference iteration.

Explicit file roots in the directory walk use the same path helper, so
their emitted spelling agrees with ordinary traversal beneath emoji
directories. Extend the existing root-precomposition test to cover an
emoji parent and an emoji filename, with precomposition enabled and disabled.

An emoji outside a 

**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -2701,6 +2701,7 @@ name = "gix-utils"
 version = "0.4.0"
 dependencies = [
  "bstr",
+ "criterion",
  "fastrand",
  "getrandom 0.4.3",
  "gix-utils",
```

**File**: `gix-dir/src/walk/function.rs` (modified, +1/-1)
```diff
@@ -92,7 +92,7 @@ pub fn walk(
             return Err(validation(format!("Worktree root at '{}' is not a directory", root.display())).raise_erased());
         }
         if options.precompose_unicode {
-            buf = gix_utils::str::precompose_bstr(buf.into()).into_owned();
+            buf = gix_path::into_bstr(gix_utils::str::precompose_path(gix_path::from_bstr(buf))).into_owned();
         }
         let _ = emit_entry(
             Cow::Borrowed(buf.as_bstr()),
```

**File**: `gix-dir/tests/dir/walk.rs` (modified, +42/-62)
```diff
@@ -4020,72 +4020,52 @@ fn nested_repos_in_ignored_directories() -> Result {
     ignore = "Needs filesystem that folds unicode composition"
 )]
 fn decomposed_unicode_in_root_is_returned_precomposed() -> Result {
-    let root = gix_testtools::tempfile::TempDir::new()?;
-
-    let decomposed = "a\u{308}";
-    let precomposed = "ä";
-    std::fs::write(root.path().join(decomposed), [])?;
-
-    let troot = root.path().join(decomposed);
-    let ((out, actual_root), entries) = try_collect_filtered_opts_collect_with_root(
-        root.path(),
-        None,
-        Some(&troot),
-        |keep, ctx| {
-            walk(
+    for (decomposed, precomposed) in [
+        ("a\u{308}", "ä"),
+        ("📹/a\u{308}", "📹/ä"),
+        ("a\u{308}/📹a\u{308}", "ä/📹a\u{308}"),
+    ] {
+        let root = gix_testtools::tempfile::TempDir::new()?;
+        let troot = root.path().join(decomposed);
+        std::fs::create_dir_all(troot.parent().expect("the file is inside the temporary directory"))?;
+        std::fs::write(&troot, [])?;
+        for (precompose_unicode, expected) in [(true, precomposed), (false, decomposed)] {
+            let ((out, actual_root), entries) = try_collect_filtered_opts_collect_with_root(
                 root.path(),
-                ctx,
-                walk::Options {
-                    precompose_unicode: true,
-                    ..options()
+                None,
+                Some(&troot),
+                |keep, ctx| {
+                    walk(
+                        root.path(),
+                        ctx,
+                        walk::Options {
+                            precompose_unicode,
+                            ..options()
+                        },
+                        keep,
+                    )
                 },
-                keep,
-            )
-        },
-        None::<&str>,
-        Default::default(),
-    )?;
-
-    assert_eq!(actual_root, troot);
-    assert_eq!(
-        out,
-        walk::Outcome {
-            read_dir_calls: 0,
-            returned_entries: entries.len(),
-            seen_entries: 1,
-        }
-    );
-    assert_eq!(
-        entries,
-        [entry(precomposed, Untracked, File)],
-        "even root paths are returned precomposed then"
-    );
+                None::<&str>,
+                Default::default(),
+            )?;
 
-    let troot = root.path().join(decomposed);
-    let ((_out, actual_root), entries) = try_collect_filtered_opts_collect_with_root(
-        root.path(),
-        None,
-        Some(&troot),
-        |keep, ctx| {
-            walk(
-                root.path(),
-                ctx,
-                walk::Options {
-                    precompose_unicode: false,
-                    ..options()
+            assert_eq!(actual_root, troot, "the traversal root keeps its original spelling");
+            assert_eq!(
+                out,
+                walk::Outcome {
+                    read_dir_calls: 0,
+                    returned_entries: entries.len(),
+                    seen_entries: 1,
                 },
-                keep,
-            )
-        },
-        None::<&str>,
-        Default::default(),
-    )?;
-    assert_eq!(actual_root, troot);
-    assert_eq!(
-        entries,
-        [entry(decomposed, Untracked, File)],
-        "if disabled, it stays decomposed as provided"
-    );
+                "a file root is emitted without reading a directory"
+            );
+            assert_eq!(
+                entries,
+                [entry(expected, Untracked, File)],
+                "root entries compose each path component independently when enabled"
+            );
+        }
+    }
     Ok(())
 }
 
```

**File**: `gix-ref/src/store/file/find.rs` (modified, +40/-32)
```diff
@@ -90,28 +90,13 @@ impl file::Store {
         partial_name: &PartialNameRef,
         packed: Option<&packed::Buffer>,
     ) -> ExnResult<Option<Reference>> {
-        fn decompose_if(mut r: Reference, input_changed_to_precomposed: bool) -> Reference {
-            if input_changed_to_precomposed {
-                use gix_object::bstr::ByteSlice;
-                let decomposed = r
-                    .name
-                    .0
-                    .to_str()
-                    .ok()
-                    .map(|name| gix_utils::str::decompose(name.into()));
-                if let Some(Cow::Owned(decomposed)) = decomposed {
-                    r.name.0 = decomposed.into();
-                }
-            }
-            r
-        }
         let mut buf = BString::default();
         let mut precomposed_partial_name_storage = packed.filter(|_| self.precompose_unicode).and_then(|_| {
             use gix_object::bstr::ByteSlice;
             let precomposed = partial_name.0.to_str().ok()?;
-            let precomposed = gix_utils::str::precompose(precomposed.into());
+            let precomposed = gix_utils::str::precompose_path(Path::new(precomposed).into());
             match precomposed {
-                Cow::Owned(precomposed) => Some(PartialName(precomposed.into())),
+                Cow::Owned(precomposed) => Some(PartialName(gix_path::into_bstr(precomposed).into_owned())),
                 Cow::Borrowed(_) => None,
             }
         });
@@ -131,7 +116,7 @@ impl file::Store {
                     &mut buf,
                     consider_pseudo_ref,
                 ) {
-                    Ok(Some(r)) => return Ok(Some(decompose_if(r, precomposed_partial_name.is_some()))),
+                    Ok(Some(r)) => return Ok(Some(r)),
                     Ok(None) => {
                         if consider_pseudo_ref && is_pseudo_ref(partial_name.as_bstr()) {
                             break 'try_directories;
@@ -161,7 +146,6 @@ impl file::Store {
                 &mut buf,
                 true, /* consider-pseudo-ref */
             )
-            .map(|res| res.map(|r| decompose_if(r, precomposed_partial_name_storage.is_some())))
         } else {
             Ok(None)
         }
@@ -181,6 +165,16 @@ impl file::Store {
         let full_name = precomposed_partial_name
             .unwrap_or(partial_name)
             .construct_full_name_ref(inbetween, path_buf, consider_pseudo_ref);
+        // Canonicalization can turn a Kelvin sign into the ASCII name of a pseudo-ref.
+        let restore_spelling = precomposed_partial_name.is_some()
+            && !matches!(
+                full_name.category(),
+                Some(
+                    crate::Category::PseudoRef
+                        | crate::Category::MainPseudoRef
+                        | crate::Category::LinkedPseudoRef { .. }
+                )
+            );
         let content_buf = match self.ref_contents(full_name) {
             Ok(content_buf) => content_buf,
             Err(err) if err.kind() == io::ErrorKind::NotADirectory => return Ok(None),
@@ -209,24 +203,38 @@ impl file::Store {
                         if let Some(namespace) = &self.namespace {
                             res.strip_namespace(namespace);
                         }
+                        if restore_spelling {
+                            let original =
+                                partial_name.construct_full_name_ref(inbetween, path_buf, consider_pseudo_ref);
+                            res.name = packed::find::transform_full_name_for_lookup(original)
+                                .expect("precomposition does not change the reference category")
+                                .to_owned();
+                        }
                         return Ok(Some(res));
                     }
                 }
                 Ok(None)
             }
-            Some(content) => Ok(Some(
-                loose::Reference::try_from_path(full_name.to_owned()
```

**File**: `gix-ref/src/store/packed/transaction.rs` (modified, +3/-3)
```diff
@@ -1,4 +1,4 @@
-use std::{borrow::Cow, fmt::Formatter, io::Write};
+use std::{borrow::Cow, fmt::Formatter, io::Write, path::Path};
 
 use gix_error::{ErrorExt, ExnMessageResult, ExnResult, Message, ResultExt, message, not_found};
 
@@ -71,11 +71,11 @@ impl packed::Transaction {
                         .0
                         .to_str()
                         .ok()
-                        .map(|name| gix_utils::str::precompose(name.into()));
+                        .map(|name| gix_utils::str::precompose_path(Path::new(name).into()));
                     match precomposed {
                         None | Some(Cow::Borrowed(_)) => edit,
                         Some(Cow::Owned(precomposed)) => {
-                            edit.name.0 = precomposed.into();
+                            edit.name.0 = gix_path::into_bstr(precomposed).into_owned();
                             edit
                         }
                     }
```

#### Recent Merged Pull Requests:
- **PR #3031** (2026-09-29): Fix UCRT64 discovery and runtime paths for Git for Windows (@Byron)
- **PR #3029** (2026-09-29): Fix minor SHA-256 issues in CLI (@cruessler)
- **PR #3027** (2026-09-27): change(gix-filter)!: remove `object_hash` from `pipeline::Options` (@cruessler)
- **PR #3026** (2026-09-28): Fix phantom untracked submodules and Unicode filenames (@Byron)
- **PR #3025** (2026-09-28): Add safe worktree removal and shared repository writes (@Byron)
- **PR #3024** (2026-09-27): fix: don't remove a directory when removing the file it replaced during tree merges (@goldjacobe)
- **PR #3023** (2026-09-25): perf(gix-hash): upgrade sha1dc to 0.1.3 (@srijs)
- **PR #3022** (2026-09-30): release testtools + minor fixes maybe (@Byron)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
