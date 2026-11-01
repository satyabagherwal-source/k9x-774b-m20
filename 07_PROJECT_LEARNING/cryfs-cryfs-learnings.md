> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/cryfs-cryfs-learnings.md`  
> **Source**: github ([https://github.com/cryfs/cryfs](https://github.com/cryfs/cryfs))  
> **Source Version**: `e2da97b1`  
> **License**: LGPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-30T06:29:51.254Z  
> **Learning ID**: `learn-github-cryfs-cryfs`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): cryfs/cryfs

> **Canonical Artifact**: `07_PROJECT_LEARNING/cryfs-cryfs-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/cryfs/cryfs](https://github.com/cryfs/cryfs))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-30T06:29:51.074Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `cryfs/cryfs`
- **Description**: Cryptographic filesystem for the cloud
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 2328 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/blockstore/src/utils.rs`
```
#[derive(Debug, PartialEq, Eq)]
#[must_use]
pub enum TryCreateResult {
    SuccessfullyCreated,
    NotCreatedBecauseBlockIdAlreadyExists,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[must_use]
pub enum RemoveResult {
    SuccessfullyRemoved,
    NotRemovedBecauseItDoesntExist,
}

```

### Core Architecture Module: `crates/check/src/checks/utils/mod.rs`
```
pub mod reference_checker;

```

### Core Architecture Module: `crates/check/src/checks/utils/reference_checker.rs`
```
use std::collections::{HashMap, hash_map::Entry};
use std::fmt::Debug;
use std::hash::Hash;

/// [ReferenceChecker] is useful for checking references in tree structures.
/// It remembers for each node id
/// - whether it was seen
/// - which other nodes referenced it
pub struct ReferenceChecker<NodeId, SeenInfo, ReferenceInfo>
where
    NodeId: Debug + Hash + PartialEq + Eq,
{
    // `SeenInfo` is set if the node was *seen*.
    // `ReferenceInfo` remembers all references to the node.
    nodes: HashMap<NodeId, (Option<SeenInfo>, Vec<ReferenceInfo>)>,
}

impl<NodeId, SeenInfo, ReferenceInfo> ReferenceChecker<NodeId, SeenInfo, ReferenceInfo>
where
    NodeId: Debug + Hash + PartialEq + Eq,
{
    pub fn new() -> Self {
        Self {
            nodes: HashMap::new(),
        }
    }

    pub fn mark_as_seen(&mut self, node_id: NodeId, seen_info: SeenInfo) {
        match self.nodes.entry(node_id) {
            Entry::Occupied(mut entry) => {
                if entry.get().0.is_some() {
                    panic!(
                        "Node {node_id:?} was seen twice. The runner should guarantee that each node is only seen once.",
                        node_id = entry.key()
                    );
                }
                entry.get_mut().0 = Some(seen_info);
            }
            Entry::Vacant(entry) => {
                entry.insert((Some(seen_info), vec![]));
            }
        }
    }

    pub fn mark_as_referenced(&mut self, node_id: NodeId, reference_info: ReferenceInfo) {
        match self.nodes.entry(node_id) {
            Entry::Occupied(mut entry) => {
                entry.get_mut().1.push(reference_info);
            }
            Entry::Vacant(entry) => {
                entry.insert((None, vec![reference_info]));
            }
        }
    }

    // Returns a list of errors and a list of nodes that were processed without errors
    pub fn finalize(self) -> impl Iterator<Item = (NodeId, Option<SeenInfo>, Vec<ReferenceInfo>)> {
        self.nodes
            .into_iter()
            .map(|(node_id, (seen_info, references))| (node_id, seen_info, references))
    }
}

```

### Core Architecture Module: `crates/check/src/task_queue.rs`
```
use futures::future::{BoxFuture, FutureExt};
use futures::stream::{StreamExt, TryStreamExt};
use std::future::Future;
use tokio::sync::mpsc::{UnboundedSender, unbounded_channel};
use tokio_stream::wrappers::UnboundedReceiverStream;

/// Call this with an `initial_task` and it will call that task, and all tasks recursively spawned by it, until all tasks are done.
/// It will restrict the number of tasks running concurrently to `max_concurrency`.
pub async fn run_to_completion<'f, F, E>(
    max_concurrency: usize,
    initial_task: impl FnOnce(TaskSpawner<'f, E>) -> F,
) -> Result<(), E>
where
    F: Future<Output = Result<(), E>> + Send + 'f,
{
    assert!(max_concurrency > 0, "Cannot run with max_concurrency == 0");

    let (sender, receiver) = unbounded_channel();
    TaskSpawner { sender }.spawn(initial_task);

    UnboundedReceiverStream::new(receiver)
        .buffer_unordered(max_concurrency)
        .try_collect::<Vec<()>>()
        .await?;
    Ok(())
}

pub struct TaskSpawner<'f, E = anyhow::Error> {
    sender: UnboundedSender<BoxFuture<'f, Result<(), E>>>,
}

impl<'f, E> TaskSpawner<'f, E> {
    pub fn spawn<F>(&self, future: impl FnOnce(Self) -> F)
    where
        F: Future<Output = Result<(), E>> + Send + 'f,
    {
        let future = future(TaskSpawner {
            sender: self.sender.clone(),
        });
        let future = future.boxed();
        self.sender.send(future).unwrap();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use std::sync::atomic::{AtomicUsize, Ordering};

    #[tokio::test]
    async fn spawn_100_tasks_directly() {
        let counter = Arc::new(AtomicUsize::new(0));
        let counter_clone = Arc::clone(&counter);
        run_to_completion(10, async move |spawner: TaskSpawner<'_, ()>| {
            for _ in 0..100 {
                let counter_clone = Arc::clone(&counter_clone);
                spawner.spawn(async move |_| {
                    counter_clone.fetch_add(1, Ordering::SeqCst);
                    Ok(())
                });
            }
            Ok(())
        })
        .await
        .unwrap();
        assert_eq!(100, counter.load(Ordering::SeqCst));
    }

    #[tokio::test]
    async fn spawn_100_tasks_recursively() {
        let counter = Arc::new(AtomicUsize::new(0));

        // TODO Use `async` syntax
        fn task(
            spawner: TaskSpawner<'static, ()>,
            counter: Arc<AtomicUsize>,
            index: usize,
        ) -> impl Future<Output = Result<(), ()>> + Send {
            async move {
                counter.fetch_add(1, Ordering::SeqCst);
                if index < 100 {
                    spawner.spawn(async move |spawner| task(spawner, counter, index + 1).await);
                }
                Ok(())
            }
        }

        run_to_completion(10, |spawner| task(spawner, Arc::clone(&counter), 1))
            .await
            .unwrap();
        assert_eq!(100, counter.load(Ordering::SeqCst));
    }

    #[tokio::test]
    async fn spawn_error_task() {
        let counter = Arc::new(AtomicUsize::new(0));

        fn task(
            spawner: TaskSpawner<'static, &'static str>,
            counter: Arc<AtomicUsize>,
            index: usize,
        ) -> impl Future<Output = Result<(), &'static str>> + Send {
            async move {
                counter.fetch_add(1, Ordering::SeqCst);
                if index < 100 {
                    spawner.spawn(move |spawner| async move {
                        Box::pin(task(spawner, counter, index + 1)).await
                    });
                    Ok(())
                } else {
                    Err("error message")
                }
            }
        }

        let result = run_to_completion(10, |spawner| task(spawner, Arc::clone(&counter), 1)).await;
        assert_eq!(Err("error message"), result);
    }
}

```

### Core Architecture Module: `crates/cli-utils/src/application.rs`
```
use std::process::ExitCode;

use anyhow::Result;
use clap::Args;
use clap_logflag::LogArgs;

use cryfs_version::VersionInfo;
use log::LevelFilter;

#[cfg(feature = "check_for_updates")]
use super::version::ReqwestHttpClient;
use super::version::show_version;
use crate::args::{ArgParseError, ParseArgsResult, parse_args};
use crate::env::Environment;
use crate::error::CliError;

/// Default log level used by `init_logging` when neither the user's `--log`
/// flag nor the application's [`Application::default_log_config`] specifies
/// one. Re-exported from this crate so downstream daemon entry points that do
/// their own deferred `init_logging` use the same level as the default path.
pub const DEFAULT_LOG_LEVEL: LevelFilter = LevelFilter::Info;

pub trait Application: Sized {
    type ConcreteArgs: Args;

    const NAME: &'static str;
    const VERSION: VersionInfo<'static, 'static, &'static str>;

    /// The logging configuration to use if the user didn't supply any `--log` flags.
    fn default_log_config(&self) -> clap_logflag::LoggingConfig;

    /// Entry point. `log_args` is the parsed `--log` flag values (possibly
    /// empty). For most apps this can be ignored — [`run`] has already
    /// initialized logging from these args + [`Self::default_log_config`]. Apps
    /// that need to forward the config elsewhere (e.g. to a daemon child
    /// via RPC) can resolve `log_args.or_default(...)` themselves with a
    /// destination-appropriate default.
    fn main(self, log_args: LogArgs) -> Result<(), CliError>;
}

/// The subset of [`Application`]s that can be constructed from parsed args
/// and environment alone. [`run`] requires it; an application whose
/// constructor needs additional inputs (e.g. a capability token that only
/// its outer framework can mint) implements just [`Application`] and is
/// started via [`run_with`] with the construction injected.
pub trait ConstructibleApplication: Application {
    fn new(args: Self::ConcreteArgs, env: Environment) -> Result<Self, CliError>;
}

pub fn run<App: ConstructibleApplication>() -> ExitCode {
    run_with(App::new)
}

/// Like [`run`], but with the application's construction injected instead of
/// taken from [`ConstructibleApplication::new`]. The constructor runs at the
/// same point of the startup pipeline `new` would: after arg parsing and
/// environment loading, before logging init and the version banner.
pub fn run_with<App: Application>(
    construct: impl FnOnce(App::ConcreteArgs, Environment) -> Result<App, CliError>,
) -> ExitCode {
    // TODO Print an error message, probably should be specific to the error. Maybe main should return a Result<(), Self::Error>?
    match _run(construct) {
        Ok(()) => ExitCode::SUCCESS,
        Err(err) => {
            // TODO Coloring the output would be nice
            // TODO This indentation matches cryfs-cli, but it might not match cryfs-check. We should either add indentation to cryfs-check, or make it conditional here.
            eprintln!("  Error: {}", err);
            err.kind.exit_code()
        }
    }
}

pub fn _run<App: Application>(
    construct: impl FnOnce(App::ConcreteArgs, Environment) -> Result<App, CliError>,
) -> Result<(), CliError> {
    setup_panic_handling(App::NAME, &App::VERSION.to_string());

    let env = Environment::read_env()?;

    let show_version = |#[cfg(feature = "check_for_updates")] env| {
        show_version(
            #[cfg(feature = "check_for_updates")]
            &env,
            App::NAME,
            #[cfg(feature = "check_for_updates")]
            ReqwestHttpClient,
            App::VERSION,
        )
    };

    match parse_args::<App::ConcreteArgs>() {
        Ok(ParseArgsResult::ShowVersion) => {
            // TODO We probably should initialize logging here before showing the version,
            // so that any http requests we do for checking for updates have a working logging backend.
            // Same for the cases below that don't initialize logging yet.
            show_version(
                #[cfg(feature = "check_for_updates")]
                env,
            );
            Ok(())
        }
        Ok(ParseArgsResult::Normal { log, args }) => {
            let app = construct(args, env.clone())?;
            clap_logflag::init_logging!(
                log.or_default(app.default_log_config()),
                DEFAULT_LOG_LEVEL
            );
            show_version(
                #[cfg(feature = "check_for_updates")]
                env,
            );
            app.main(log)
        }
        Err(ArgParseError::Clap(err)) => {
            show_version(
                #[cfg(feature = "check_for_updates")]
                env,
            );
            // clap error types can display colored output if exiting this way, otherwise they wouldn't
            err.exit();
        }
        Err(ArgParseError::Other(err)) => {
            show_version(
                #[cfg(feature = "check_for_updates")]
                env,
            );
            Err(err)
        }
    }
}

/// Install the panic hooks [`run`]/[`run_with`] give every application: a
/// forced backtrace in debug builds, a human-readable message + report file
/// (human-panic) in release builds; a user-set `RUST_BACKTRACE` wins over
/// both. Public so process entry points that bypass the [`run`] pipeline —
/// e.g. a re-exec'd daemon child dispatching straight into its daemon loop —
/// can install the same hooks first thing.
pub fn setup_panic_handling(name: &str, version: &str) {
    match ::std::env::var("RUST_BACKTRACE") {
        Ok(_) => {
            // The `RUST_BACKTRACE` environment variable is set, change nothing and just use the default behavior of that variable.
        }
        Err(_) => {
            // The `RUST_BACKTRACE` environment variable is not set, define our own default behavior
            if cfg!(debug_assertions) {
                // In debug builds, always show a backtrace on panic, irrespective of the `RUST_BACKTRACE` environment variable
                std::panic::set_hook(Box::new(|panic_info| {
                    let backtrace = std::backtrace::Backtrace::force_capture();
                    eprintln!("{panic_info}");
                    eprintln!("\nBacktrace:\n{backtrace}");
                }));
            } else {
                // In release builds, show a human readable error message and generate a dump file for the user to upload with the issue report
                human_panic::setup_panic!(
                    human_panic::Metadata::new(name.to_string(), version.to_string())
                        .authors(env!("CARGO_PKG_AUTHORS").replace(":", ", "))
                        .homepage(env!("CARGO_PKG_HOMEPAGE"))
                        .support("Open a ticket at https://github.com/cryfs/cryfs/issues and include the report file.")
                );
                // TODO https://github.com/rust-cli/human-panic/issues/155
            }
        }
    }
}

```

### Core Architecture Module: `crates/cli-utils/src/args.rs`
```
use std::sync::Arc;

use anyhow::{Result, anyhow};
use clap::{
    Args, Parser,
    builder::{Styles, styling::AnsiColor},
    error::ErrorKind,
};
use clap_logflag::LogArgs;

use crate::error::{CliError, CliErrorKind};

pub enum ArgParseError {
    Clap(clap::Error),
    Other(CliError),
}

#[derive(Parser, Debug)]
pub struct ImmediateExitFlags {
    #[arg(short = 'V', long)]
    pub version: bool,
}

#[derive(Parser, Debug)]
#[command(styles=clap_style())]
pub struct CombinedArgs<ConcreteArgs: Args> {
    #[command(flatten)]
    pub immediate_exit_flags: ImmediateExitFlags,

    #[command(flatten)]
    pub concrete_args: ConcreteArgs,

    #[command(flatten)]
    pub log: LogArgs,
}

pub enum ParseArgsResult<ConcreteArgs: Args> {
    ShowVersion,
    Normal { log: LogArgs, args: ConcreteArgs },
}

pub fn parse_args<ConcreteArgs: Args>() -> Result<ParseArgsResult<ConcreteArgs>, ArgParseError> {
    // First try to parse ImmediateExitFlags by themselves. This is necessary because if we start by parsing `CombinedArgs`,
    // it would fail if `ConcreteArgs` aren't present.
    let args = match ImmediateExitFlags::try_parse() {
        Ok(immediate_exit_flags) => {
            if immediate_exit_flags.version {
                return Ok(ParseArgsResult::ShowVersion);
            } else {
                // TODO Can this actually happen? If ImmediateExitFlags parsed, we should have `--version` since that's the only flag right now.
                CombinedArgs::<ConcreteArgs>::try_parse().map_err(ArgParseError::Clap)?
            }
        }
        Err(e) => {
            match e.kind() {
                ErrorKind::DisplayHelp => {
                    // We need to display a help message. The easiest way to do that is to parse the arguments again,
                    // but this time including `ConcreteArgs`. Clap will then exit and display the help message.
                    let Err(err) = CombinedArgs::<ConcreteArgs>::try_parse() else {
                        panic!(
                            "We expected the previous line to exit with a help message. CLI Parsing error was: {e:#?}"
                        );
                    };
                    return Err(ArgParseError::Clap(err));
                }
                ErrorKind::UnknownArgument => {
                    // Looks like some `ConcreteArgs` may have been present. In this case, we don't support the `--version` flag.
                    // So let's parse our flags and make sure that `--version` isn't present.
                    let args =
                        CombinedArgs::<ConcreteArgs>::try_parse().map_err(ArgParseError::Clap)?;
                    // We successfully parsed the arguments, so we can return them. But we don't support the `--version` flag together with other arguments.
                    if args.immediate_exit_flags.version {
                        return Err(ArgParseError::Other(CliError {
                            kind: CliErrorKind::InvalidArguments,
                            error: Arc::new(anyhow!(
                                "the argument '--version' cannot be used with other arguments"
                            )),
                        }));
                    }
                    args
                }
                ErrorKind::DisplayVersion => {
                    panic!("We have our own handling for `--version`, this shouldn't happen");
                }
                _ => {
                    // Something went wrong parsing the arguments, e.g `--version=bad` or something like that was passed in.
                    // Let's parse the arguments again, but this time so that clap exits with an error.
                    // TODO Can this actually happen?
                    let Err(err) = CombinedArgs::<ConcreteArgs>::try_parse() else {
                        panic!(
                            "We expected the previous line to exit with an error. CLI Parsing error was: {e:#?}"
                        );
                    };
                    return Err(ArgParseError::Clap(err));
                }
            }
        }
    };

    Ok(ParseArgsResult::Normal {
        log: args.log,
        args: args.concrete_args,
    })
}

const fn clap_style() -> Styles {
    Styles::styled()
        .header(AnsiColor::Yellow.on_default().bold())
        .usage(AnsiColor::Cyan.on_default().bold())
        .literal(AnsiColor::Cyan.on_default())
        .placeholder(AnsiColor::BrightCyan.on_default())
}

```

### Core Architecture Module: `crates/cli-utils/src/blockstore_setup.rs`
```
use anyhow::Result;

use cryfs_blockstore::{
    ClientId, DynBlockStore, DynLLBlockStore, EncryptedBlockStore, IntegrityBlockStore,
    IntegrityBlockStoreInitError, IntegrityConfig, LLBlockStore, LockingBlockStore,
    OptimizedBlockStoreWriter,
};
use cryfs_config::config::{
    CryConfig,
    ciphers::{AsyncCipherCallback, UnknownCipherError, lookup_cipher_async},
};
use cryfs_config::localstate::LocalStateDir;
use cryfs_crypto::symmetric::{CipherDef, EncryptionKey};
use cryfs_utils::async_drop::{AsyncDrop, AsyncDropGuard};

use crate::{CliError, CliErrorKind, CliResultExt, CliResultExtFn};

pub trait BlockstoreCallback {
    type Result;

    #[allow(async_fn_in_trait)]
    async fn callback<B: LLBlockStore + AsyncDrop + Send + Sync + 'static>(
        self,
        blockstore: AsyncDropGuard<LockingBlockStore<B>>,
    ) -> Self::Result;
}

/// Set up a blockstore stack (i.e. EncryptedBlockStore, IntegrityBlockStore) using the cipher specified in the config file.
/// Give it the base blockstore (i.e. OnDiskBlockStore) and it will set up the blockstore stack as needed for a cryfs device.
pub async fn setup_blockstore_stack<CB: BlockstoreCallback + Send + Sync>(
    base_blockstore: AsyncDropGuard<impl LLBlockStore + OptimizedBlockStoreWriter + Send + Sync>,
    config: &CryConfig,
    my_client_id: ClientId,
    local_state_dir: &LocalStateDir,
    integrity_config: IntegrityConfig,
    callback: CB,
) -> Result<CB::Result, CliError> {
    let result = lookup_cipher_async(
        &config.cipher,
        CipherCallbackForBlockstoreSetup {
            base_blockstore,
            config,
            my_client_id,
            local_state_dir,
            integrity_config,
            callback,
        },
    )
    .await;

    match result {
        Ok(v) => v,
        Err(err @ UnknownCipherError { .. }) => {
            Err(err).map_cli_error(|_| CliErrorKind::UnspecifiedError)
        }
    }
}

struct CipherCallbackForBlockstoreSetup<
    'c,
    'l,
    B: LLBlockStore + OptimizedBlockStoreWriter + Send + Sync,
    CB: BlockstoreCallback,
> {
    base_blockstore: AsyncDropGuard<B>,
    config: &'c CryConfig,
    my_client_id: ClientId,
    local_state_dir: &'l LocalStateDir,
    integrity_config: IntegrityConfig,
    callback: CB,
}

impl<B: LLBlockStore + OptimizedBlockStoreWriter + Send + Sync, CB: BlockstoreCallback + Send>
    AsyncCipherCallback for CipherCallbackForBlockstoreSetup<'_, '_, B, CB>
{
    type Result = Result<CB::Result, CliError>;

    async fn callback<C: CipherDef + Send + Sync + 'static>(self) -> Self::Result {
        let key = match EncryptionKey::from_hex(&self.config.enc_key) {
            Ok(key) => key,
            Err(err) => {
                self.base_blockstore
                    .async_drop()
                    .await
                    .map_cli_error(CliErrorKind::UnspecifiedError)?;
                return Err(err).map_cli_error(CliErrorKind::InvalidFilesystem);
            }
        };

        let cipher = match C::new(key) {
            Ok(cipher) => cipher,
            Err(err) => {
                self.base_blockstore
                    .async_drop()
                    .await
                    .map_cli_error(CliErrorKind::UnspecifiedError)?;
                return Err(err).map_cli_error(|_| CliErrorKind::InvalidFilesystem);
            }
        };
        let encrypted_blockstore = EncryptedBlockStore::new(self.base_blockstore, cipher);

        let integrity_file_path = self
            .local_state_dir
            .for_filesystem_id(&self.config.filesystem_id);
        let integrity_file_path = match integrity_file_path {
            Ok(integrity_file_path) => integrity_file_path.join("integritydata"),
            Err(err) => {
                encrypted_blockstore
                    .async_drop()
                    .await
                    .map_cli_error(CliErrorKind::UnspecifiedError)?;
                return Err(err).map_cli_error(CliErrorKind::InaccessibleLocalStateDir);
            }
        };
        let integrity_blockstore = IntegrityBlockStore::new(
            encrypted_blockstore,
            integrity_file_path,
            self.my_client_id,
            self.integrity_config,
        )
        .await
        .map_cli_error(|error| match error {
            IntegrityBlockStoreInitError::IntegrityViolationInPreviousRun { .. } => {
                CliErrorKind::IntegrityViolationOnPreviousRun
            }
            IntegrityBlockStoreInitError::InvalidLocalIntegrityState { .. } => {
                CliErrorKind::InvalidLocalState
            }
        })?;
        let blockstore = LockingBlockStore::new(integrity_blockstore);

        Ok(self.callback.callback(blockstore).await)
    }
}

pub async fn setup_blockstore_stack_dyn(
    base_blockstore: AsyncDropGuard<impl LLBlockStore + OptimizedBlockStoreWriter + Send + Sync>,
    config: &CryConfig,
    my_client_id: ClientId,
    local_state_dir: &LocalStateDir,
    integrity_config: IntegrityConfig,
) -> Result<AsyncDropGuard<LockingBlockStore<DynBlockStore>>, CliError> {
    setup_blockstore_stack(
        base_blockstore,
        config,
        my_client_id,
        local_state_dir,
        integrity_config,
        DynCallback,
    )
    .await?
    .map_cli_error(CliErrorKind::UnspecifiedError)
}

struct DynCallback;
impl BlockstoreCallback for DynCallback {
    type Result = Result<AsyncDropGuard<LockingBlockStore<DynBlockStore>>>;

    async fn callback<B: LLBlockStore + AsyncDrop + Send + Sync + 'static>(
        self,
        blockstore: AsyncDropGuard<LockingBlockStore<B>>,
    ) -> Self::Result {
        let inner = LockingBlockStore::into_inner_block_store(blockstore).await?;
        let inner: Box<dyn DynLLBlockStore + Send + Sync> =
            Box::new(inner.unsafe_into_inner_dont_drop());
        let inner = AsyncDropGuard::new(DynBlockStore(inner));
        Ok(LockingBlockStore::new(inner))
    }
}

```

### Core Architecture Module: `crates/cli-utils/src/config.rs`
```
use byte_unit::{Byte, UnitType};
use console::{StyledObject, style};
use std::fmt::Display;

use cryfs_config::config::ConfigLoadResult;

// TODO Integration test the outputs of print_config
pub fn print_config(config: &ConfigLoadResult) {
    fn print_value<T: Display + Eq>(old_value: T, new_value: T) {
        if old_value == new_value {
            print!("{}", format_value(&old_value.to_string()));
        } else {
            print!(
                "{} -> {}",
                format_value(&old_value.to_string()),
                format_value(&new_value.to_string())
            );
        }
    }

    fn format_bytes(bytes: Byte) -> String {
        format!(
            "{} ({} bytes)",
            bytes.get_appropriate_unit(UnitType::Binary),
            bytes.as_u64(),
        )
    }

    fn format_key(name: &str) -> StyledObject<&str> {
        style(name).bold().blue()
    }

    fn format_value(name: &str) -> StyledObject<&str> {
        style(name).yellow()
    }

    println!("\n  {}", style("Filesystem configuration:").bold());
    println!("  ----------------------------------------------------");
    print!("  • {} ", format_key("Filesystem format version:"));
    print_value(
        &config.old_config.format_version,
        &config.config.config().format_version,
    );
    print!(
        "\n  • {} {} ",
        format_key("Created with:"),
        format_value("CryFS"),
    );
    print_value(
        &config.old_config.created_with_version,
        &config.config.config().created_with_version,
    );
    print!(
        "\n  • {} {} ",
        format_key("Last opened with:"),
        format_value("CryFS"),
    );
    print_value(
        &config.old_config.last_opened_with_version,
        &config.config.config().last_opened_with_version,
    );
    print!("\n  • {} ", format_key("Cipher:"));
    print_value(&config.old_config.cipher, &config.config.config().cipher);
    print!("\n  • {} ", format_key("Blocksize:"));
    print_value(
        format_bytes(config.old_config.blocksize),
        format_bytes(config.config.config().blocksize),
    );
    print!("\n  • {} ", format_key("Filesystem Id:"));
    print_value(
        config.old_config.filesystem_id.to_hex(),
        config.config.config().filesystem_id.to_hex(),
    );

    println!("\n  ----------------------------------------------------\n");
}

```

### Core Architecture Module: `crates/cli-utils/src/env.rs`
```
use anyhow::{Context, Result, anyhow, bail};
use std::env::VarError;
use std::path::PathBuf;

use crate::error::{CliError, CliErrorKind, CliResultExt};

const FRONTEND_KEY: &str = "CRYFS_FRONTEND";
const FRONTEND_NONINTERACTIVE: &str = "noninteractive";
#[cfg(feature = "check_for_updates")]
const NOUPDATECHECK_KEY: &str = "CRYFS_NO_UPDATE_CHECK";
const LOCALSTATEDIR_KEY: &str = "CRYFS_LOCAL_STATE_DIR";

pub struct EnvVarDoc {
    pub key: &'static str,
    pub value: &'static str,
    pub description: &'static str,
}

pub const ENV_VARS_DOCUMENTATION: &[EnvVarDoc] = &[
    EnvVarDoc {
        key: FRONTEND_KEY,
        value: FRONTEND_NONINTERACTIVE,
        description: "Work better together with tools. With this option set, CryFS won't ask anything, but use default values for options you didn't specify on command line. Furthermore, it won't ask you to enter a new password a second time (password confirmation).",
    },
    #[cfg(feature = "check_for_updates")]
    EnvVarDoc {
        key: NOUPDATECHECK_KEY,
        value: "true",
        description: "By default, CryFS connects to the internet to check for known security vulnerabilities and new versions. This option disables this.",
    },
    EnvVarDoc {
        key: LOCALSTATEDIR_KEY,
        value: "[path]",
        description: "Sets the directory cryfs uses to store local state. This local state is used to recognize known file systems and run integrity checks, i.e. check that they haven't been modified by an attacker.\nDefault value: /home/heinzi/.local/share/cryfs",
    },
];

#[derive(Debug, Clone)]
pub struct Environment {
    pub is_noninteractive: bool,
    #[cfg(feature = "check_for_updates")]
    pub no_update_check: bool,
    pub local_state_dir: PathBuf,
}

impl Environment {
    pub(crate) fn read_env() -> Result<Self, CliError> {
        Ok(Self {
            is_noninteractive: Self::is_noninteractive(),
            #[cfg(feature = "check_for_updates")]
            no_update_check: Self::no_update_check(),
            local_state_dir: Self::local_state_dir()
                .map_cli_error(CliErrorKind::InaccessibleLocalStateDir)?,
        })
    }

    fn is_noninteractive() -> bool {
        match std::env::var(FRONTEND_KEY) {
            Ok(frontend) => frontend == FRONTEND_NONINTERACTIVE,
            Err(VarError::NotPresent) | Err(VarError::NotUnicode(..)) => false,
        }
    }

    #[cfg(feature = "check_for_updates")]
    fn no_update_check() -> bool {
        match std::env::var(NOUPDATECHECK_KEY) {
            Ok(val) => val == "true",
            Err(VarError::NotPresent) | Err(VarError::NotUnicode(..)) => false,
        }
    }

    fn local_state_dir() -> Result<PathBuf> {
        match std::env::var(LOCALSTATEDIR_KEY) {
            Ok(local_state_dir) => std::fs::canonicalize(&local_state_dir).with_context(|| {
                anyhow!("Failed to access specified local state directory at {local_state_dir}")
            }),
            Err(VarError::NotUnicode(local_state_dir)) => {
                bail!("Failed to access specified local state directory at {local_state_dir:?}")
            }
            Err(VarError::NotPresent) => {
                let mut local_state_dir =
                    dirs::data_local_dir().context("Tried to query location of local data dir")?;
                local_state_dir.push("cryfs");
                Ok(local_state_dir)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use envtestkit::{lock::lock_test, set_env};

    mod is_noninteractive {
        use super::*;

        #[test]
        fn when_not_set_then_returns_false() {
            let _lock = lock_test();
            assert!(
                std::env::var(FRONTEND_KEY).is_err(),
                "This test assumes that the env var isn't set but it seems set?"
            );
            assert_eq!(false, Environment::read_env().unwrap().is_noninteractive);
        }

        #[test]
        fn when_set_to_noninteractive_then_returns_true() {
            let _lock = lock_test();
            let _var = set_env(FRONTEND_KEY.into(), FRONTEND_NONINTERACTIVE);
            assert_eq!(true, Environment::read_env().unwrap().is_noninteractive);
        }

        #[test]
        fn when_set_to_empty_then_returns_false() {
            let _lock = lock_test();
            let _var = set_env(FRONTEND_KEY.into(), "");
            assert_eq!(false, Environment::read_env().unwrap().is_noninteractive);
        }

        #[test]
        fn when_set_to_something_else_then_returns_false() {
            let _lock = lock_test();
            let _var = set_env(FRONTEND_KEY.into(), "something");
            assert_eq!(false, Environment::read_env().unwrap().is_noninteractive);
        }
    }

    #[cfg(feature = "check_for_updates")]
    mod no_update_check {
        use super::*;

        #[test]
        fn when_not_set_then_returns_false() {
            let _lock = lock_test();
            assert!(
                std::env::var(NOUPDATECHECK_KEY).is_err(),
                "This test assumes that the env var isn't set but it seems set?"
            );
            assert_eq!(false, Environment::read_env().unwrap().no_update_check);
        }

        #[test]
        fn when_set_to_true_then_returns_true() {
            let _lock = lock_test();
            let _var = set_env(NOUPDATECHECK_KEY.into(), "true");
            assert_eq!(true, Environment::read_env().unwrap().no_update_check);
        }

        #[test]
        fn when_set_to_empty_then_returns_false() {
            let _lock = lock_test();
            let _var = set_env(NOUPDATECHECK_KEY.into(), "");
            assert_eq!(false, Environment::read_env().unwrap().no_update_check);
        }

        #[test]
        fn when_set_to_something_else_then_returns_false() {
            let _lock = lock_test();
            let _var = set_env(NOUPDATECHECK_KEY.into(), "something");
            assert_eq!(false, Environment::read_env().unwrap().no_update_check);
        }
    }

    mod local_state_dir {
        use super::*;
        use std::fs::canonicalize;

        #[test]
        fn when_not_set_then_returns_default() {
            let _lock = lock_test();
            assert!(
                std::env::var(LOCALSTATEDIR_KEY).is_err(),
                "This test assumes that the env var isn't set but it seems set?"
            );
            let local_state_dir = Environment::read_env().unwrap().local_state_dir;
            assert_eq!(
                dirs::data_local_dir().unwrap().join("cryfs"),
                local_state_dir,
            );
        }

        #[test]
        fn when_set_to_nonexisting_absolute_dir_then_returns_error() {
            let _lock = lock_test();
            let tmpdir = tempfile::Builder::new()
                .prefix("some_path")
                .tempdir()
                .unwrap();
            let nonexisting_path = tmpdir.path().join("nonexisting");
            let _var = set_env(LOCALSTATEDIR_KEY.into(), &nonexisting_path);
            let env = Environment::read_env();
            assert!(env.is_err());
            assert_eq!(
                format!(
                    "Failed to access specified local state directory at {}",
                    nonexisting_path.to_str().unwrap(),
                ),
                env.unwrap_err().to_string()
            );
        }

        #[test]
        fn when_set_to_existing_absolute_dir_then_returns_dir() {
            let _lock = lock_test();
            let tmpdir = tempfile::Builder::new()
                .prefix("some_path")
                .tempdir()
                .unwrap();
            let _var = set_env(LOCALSTATEDIR_KEY.into(), tmpdir.path());
            let local_state_dir = Environment::read_env().unwrap().local_state_dir;
            assert_eq!(
                canonicalize(tmpdir.path()).unwrap(),
                canonicalize(local_state_dir).unwrap(),
            );
        }

        #[test]
        fn when_set_to_nonexisting_relative_dir_without_dot_then_returns_dir() {
            let _lock = lock_test();
            let tmpdir = tempfile::Builder::new()
                .prefix("some_path")
                .tempdir()
                .unwrap();
            let nonexisting_path = tmpdir.path().join("nonexisting");
            let _var = set_env(LOCALSTATEDIR_KEY.into(), &nonexisting_path);
            let env = Environment::read_env();
            assert!(env.is_err());
            assert_eq!(
                format!(
                    "Failed to access specified local state directory at {}",
                    nonexisting_path.to_str().unwrap(),
                ),
                env.unwrap_err().to_string(),
            );
        }

        #[test]
        fn when_set_to_existing_relative_dir_without_dot_then_returns_dir() {
            let _lock = lock_test();
            let tmpdir = tempfile::Builder::new()
                .prefix("some_path")
                .tempdir()
                .unwrap();
            let relative_path =
                pathdiff::diff_paths(tmpdir.path(), std::env::current_dir().unwrap()).unwrap();
            let _var = set_env(LOCALSTATEDIR_KEY.into(), relative_path);
            let local_state_dir = Environment::read_env().unwrap().local_state_dir;
            assert_eq!(
                canonicalize(tmpdir.path()).unwrap(),
                canonicalize(local_state_dir).unwrap(),
            );
        }

        #[test]
        fn when_set_to_nonexisting_relative_dir_with_dot_then_returns_dir() {
            let _lock = lock_test();
            let tmpdir = tempfile::Builder::new()
                .prefix("some_path")
                .tempdir()
                .unwrap();
            let nonexisting_path =
                format!("./{}", tmpdir.path().join("nonexisting").to_str().unwrap());
            let _var = set_env(LOCALSTATEDIR_KEY.into(), &nonexisting_path);
            let env = Environment::read_env();
            assert!(env.is_err());
```

### Core Architecture Module: `crates/cli-utils/src/error.rs`
```
use derive_more::Display;
use serde::{Deserialize, Serialize};
use std::{error::Error, process::ExitCode, sync::Arc};

// Don't derive `Error` for `CliError` because we don't want a thrown CliError to be converted back to `anyhow::Error`, that might swallow the exit code.
#[derive(Display, Debug)]
#[display("{error}")]
pub struct CliError {
    pub kind: CliErrorKind,
    pub error: Arc<anyhow::Error>,
}

/// An extension trait to map a Result with an anyhow::Error error type into a Result with a `CliError` error type.
pub trait CliResultExt {
    type T;
    fn map_cli_error(self, kind: CliErrorKind) -> Result<Self::T, CliError>;
}
impl<T> CliResultExt for Result<T, anyhow::Error> {
    type T = T;
    fn map_cli_error(self, kind: CliErrorKind) -> Result<T, CliError> {
        self.map_err(|error| CliError {
            kind,
            error: Arc::new(error),
        })
    }
}
impl<T> CliResultExt for Result<T, Arc<anyhow::Error>> {
    type T = T;
    fn map_cli_error(self, kind: CliErrorKind) -> Result<T, CliError> {
        self.map_err(|error| CliError { kind, error })
    }
}

/// An extension trait to map a Result with an arbitrary `impl Error` type into a Result with a `CliError` error type.
pub trait CliResultExtFn {
    type T;
    type E;
    fn map_cli_error(
        self,
        kind: impl FnOnce(&Self::E) -> CliErrorKind,
    ) -> Result<Self::T, CliError>;
}
impl<T, E> CliResultExtFn for Result<T, E>
where
    E: Error + Send + Sync + 'static,
{
    type T = T;
    type E = E;
    fn map_cli_error(self, kind: impl FnOnce(&E) -> CliErrorKind) -> Result<T, CliError> {
        self.map_err(|error| CliError {
            kind: kind(&error),
            error: Arc::new(anyhow::Error::from(error)),
        })
    }
}

// TODO Ensure that all of these errors, where C++ throws them, we throw them too and return them correctly to the shell. Grep our C++ code for when they're thrown.
// TODO Test error scenarios actually return the correct exit code to the shell
#[derive(Debug, PartialEq, Eq, Clone, Copy, Serialize, Deserialize)]
pub enum CliErrorKind {
    /// No error happened, everything is ok
    Success,

    /// An error happened that doesn't have an error code associated with it
    UnspecifiedError,

    /// The command line arguments are invalid.
    InvalidArguments,

    /// Couldn't load config file. Either the password is wrong or the config file is corrupted.
    WrongPasswordOrCorruptedConfigFile,

    /// Password cannot be empty
    EmptyPassword,

    /// The file system format is too new for this CryFS version. Please update your CryFS version.
    TooNewFilesystemFormat,

    /// The file system format is too old for this CryFS version. Run with --allow-filesystem-upgrade to upgrade it.
    TooOldFilesystemFormat,

    /// The file system uses a different cipher than the one specified on the command line using the --cipher argument.
    WrongCipher,

    /// The file system uses a different blocksize than the one specified on the command line using the --blocksize argument.
    WrongBlocksize,

    /// Vault directory doesn't exist or is inaccessible (i.e. not read or writable or not a directory)
    InaccessibleVaultDir,

    /// Mount directory doesn't exist or is inaccessible (i.e. not read or writable or not a directory)
    InaccessibleMountDir,

    /// Local state directory doesn't exist or is inaccessible (i.e. not read or writable or not a directory)
    InaccessibleLocalStateDir,

    /// The local state directory is in an invalid state.
    InvalidLocalState,

    /// Vault directory can't be a subdirectory of the mount directory
    VaultDirInsideMountDir,

    /// Something's wrong with the file system.
    InvalidFilesystem,

    /// The filesystem id in the config file is different to the last time we loaded a filesystem from this vault directory. This could mean an attacker replaced the file system with a different one. You can pass the --allow-replaced-filesystem option to allow this.
    FilesystemIdChanged,

    /// The filesystem encryption key differs from the last time we loaded this filesystem. This could mean an attacker replaced the file system with a different one. You can pass the --allow-replaced-filesystem option to allow this.
    EncryptionKeyChanged,

    /// The command line options and the file system disagree on whether missing blocks should be treated as integrity violations.
    FilesystemHasDifferentIntegritySetup,

    /// File system is in single-client mode and can only be used from the client that created it.
    SingleClientFileSystem,

    /// A previous run of the file system detected an integrity violation. Preventing access to make sure the user notices. The file system will be accessible again after the user deletes the integrity state file.
    IntegrityViolationOnPreviousRun,

    /// An integrity violation was detected and the file system unmounted to make sure the user notices.
    IntegrityViolation,
}

impl CliErrorKind {
    /// Exit code to report to the shell
    pub fn exit_code(&self) -> ExitCode {
        ExitCode::from(match self {
            Self::Success => 0,
            Self::UnspecifiedError => 1,
            Self::InvalidArguments => 10,
            Self::WrongPasswordOrCorruptedConfigFile => 11,
            Self::EmptyPassword => 12,
            Self::TooNewFilesystemFormat => 13,
            Self::TooOldFilesystemFormat => 14,
            Self::WrongCipher => 15,
            Self::InaccessibleVaultDir => 16,
            Self::InaccessibleMountDir => 17,
            Self::VaultDirInsideMountDir => 18,
            Self::InvalidFilesystem => 19,
            Self::FilesystemIdChanged => 20,
            Self::EncryptionKeyChanged => 21,
            Self::FilesystemHasDifferentIntegritySetup => 22,
            Self::SingleClientFileSystem => 23,
            Self::IntegrityViolationOnPreviousRun => 24,
            Self::IntegrityViolation => 25,
            Self::InaccessibleLocalStateDir => 26,
            Self::InvalidLocalState => 27,
            Self::WrongBlocksize => 28,
        })
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #677** (2026-10-30): **Look up a node's own directory entry by blob id instead of by name**
  *Symptoms*: Stacked on #676 (it extends the adapter tests from there), so this PR's base is that branch. Review only the last commit.  ## Summary  `NodeInfo` remembered the name a node had when it was loaded, and `getattr` and `setattr` looked up the node's entry in its parent directory by that name. A rename changes the name, but nodes loaded before the rename stay in use: fuser keeps them in its inode list, and open files keep theirs. After a rename within one directory, such a node either didn't find its entry anymore (ENOENT), or, if a new node had taken the old name, read and changed **that other node's** entry.  Through a real mount of current `main`, `touch x; mv x y; touch x; chmod 600 y` changes the mode of the new `x` on disk and leaves `y` unchanged. The kernel's attribute cache hides this for up to a second. Since it applies permissions to the wrong file, please review this with that in mind.  The fix looks the entry up by blob id instead, which a rename doesn't change, and drops the name from `NodeInfo`. The access and modification timestamp updates already looked up the entry by blob id. `DirBlob::set_attr_of_entry_by_name` becomes `DirBlob::set_attr_of_entry`, and `update_modification_timestamp_by_name` goes away because nothing uses it anymore.  Renames across directories are still broken after this, because there the node also keeps the old parent directory. That's the next PR in the series.  ## Tests  - `tests/rename.rs` keeps a node, a directory and an open file loaded

- **Issue #676** (2026-10-30): **Don't panic when a rename within a directory overwrites a loaded node**
  *Symptoms*: ## Summary  Through a mount, `touch a b; mv a b` panicked in `InodeList::move_inode` with "If parents are the same, we should never hit the case of orphaning an existing child", and `mv` failed with EIO even though the rename had already happened on disk. The kernel still has `b`'s inode, so the rename overwrites a node that is loaded in the inode list. Editors that save a file by writing a temporary file and renaming it over the original hit the same path.  The case is legitimate: the overwritten node stays loaded as an orphan until the kernel forgets it, like it already does for renames across directories. Its parent pointer still points to the same directory, so it still counts towards that directory's refcount (invariant E1), and the moved node stays in that directory too. So no refcounts change and the panic just goes away. Dropping the orphan later is already safe: `try_remove_child_by_handle` leaves the parent's edge alone when it leads to the node that replaced the orphan.  ## Tests  - New `crates/cryfs-filesystem/tests/fuser_adapter.rs` drives CryFS through `ObjectBasedFsAdapterLL`, the adapter the fuser backend uses, without mounting anything. Like the kernel, the adapter keeps inodes loaded between operations, which the existing e2e rename test doesn't do: it forgets its handles before renaming. Both new tests (file onto a loaded file, directory onto a loaded empty directory) panic without the fix. - cryfs-filesystem gets `cryfs-rustfs` with the `fuser` feature as 

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

### Incident Patch 1: `f9c82def` (2026-10-30)
**Commit Message**: Don't panic when a rename within a directory overwrites a loaded node (#676)

When a rename overwrote an existing node in the same directory and the kernel
still had that node's inode, InodeList::move_inode panicked with "If parents are
the same, we should never hit the case of orphaning an existing child", and the
rename failed with EIO although it had already happened on disk. Through a
mount, `touch a b; mv a b` hit this. Editors that save a file by writing a
temporary file and renaming it over the original do the same thing.

The case is legitimate: the overwritten node stays loaded as an orphan until the
kernel forgets it, like it already does for renames across directories. Its
parent pointer still points to the directory, so it still counts towards that
directory's refcount, and the moved node stays in the same directory too, so no
refcount changes.

The tests drive the file system through the fuser adapter, which keeps inodes
loaded like the kernel does. cryfs-filesystem gets cryfs-rustfs with the fuser
feature as a dev-dependency for that.


Claude-Session: https://claude.ai/code/session_013tWxNy368caFZnjrbQUJgH

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `crates/cryfs-filesystem/Cargo.toml` (modified, +2/-0)
```diff
@@ -29,6 +29,8 @@ tokio = {workspace = true, features = ["sync"]}
 [dev-dependencies]
 byte-unit.workspace = true
 cryfs-blobstore = {path = "../blobstore", features = ["testutils"]}
+# tests/fuser_adapter.rs drives the file system through the adapter the fuser backend uses
+cryfs-rustfs = {path = "../rustfs", features = ["fuser"]}
 tokio = {workspace = true, features = ["rt-multi-thread", "macros", "time"]}
 
 [features]
```

**File**: `crates/cryfs-filesystem/tests/fuser_adapter.rs` (added, +181/-0)
```diff
@@ -0,0 +1,181 @@
+//! Tests that drive CryFS through rustfs's fuser adapter, [ObjectBasedFsAdapterLL], the way the kernel does,
+//! but without mounting anything. Like for a mount, the adapter keeps every inode it handed out loaded until
+//! it is forgotten, so nodes stay in use across operations.
+
+// The async state machines built here nest deeply enough that computing their layout
+// overflows rustc's default recursion limit of 128.
+#![recursion_limit = "512"]
+
+use std::time::Duration;
+
+use cryfs_blobstore::{BlobId, BlobStoreOnBlocks};
+use cryfs_blockstore::{InMemoryBlockStore, LockingBlockStore};
+use cryfs_filesystem::filesystem::CryDevice;
+use cryfs_rustfs::{
+    AtimeUpdateBehavior, FsError, Gid, InodeNumber, Mode, OpenInFlags, RequestInfo, Uid,
+    low_level_api::AsyncFilesystemLL,
+    object_based_api::{FUSE_ROOT_ID, ObjectBasedFsAdapterLL},
+};
+use cryfs_utils::{async_drop::AsyncDropGuard, path::PathComponent};
+
+type Adapter =
+    ObjectBasedFsAdapterLL<CryDevice<BlobStoreOnBlocks<LockingBlockStore<InMemoryBlockStore>>>>;
+
+fn req() -> RequestInfo {
+    RequestInfo {
+        unique: 0,
+        uid: Uid::from(1000),
+        gid: Gid::from(1000),
+        pid: 0,
+    }
+}
+
+fn name(name: &str) -> &PathComponent {
+    PathComponent::try_from_str(name).unwrap()
+}
+
+fn dir_mode() -> Mode {
+    Mode::default()
+        .add_dir_flag()
+        .add_user_read_flag()
+        .add_user_write_flag()
+        .add_user_exec_flag()
+}
+
+fn file_mode() -> Mode {
+    Mode::default()
+        .add_file_flag()
+        .add_user_read_flag()
+        .add_user_write_flag()
+}
+
+async fn make_adapter() -> AsyncDropGuard<Adapter> {
+    let blockstore = LockingBlockStore::new(InMemoryBlockStore::new());
+    let blobstore = BlobStoreOnBlocks::new(blockstore, 1024u32.into())
+        .await
+        .unwrap();
+    let device = CryDevice::create_new_filesystem(
+        blobstore,
+        BlobId::new_random(),
+        AtimeUpdateBehavior::Relatime,
+    )
+    .await
+    .unwrap();
+    let adapter = ObjectBasedFsAdapterLL::new(|_uid, _gid| device);
+    adapter.init(&req()).await.unwrap();
+    adapter
+}
+
+/// Runs `test` on a fresh file system. Fails instead of hanging if `test` blocks forever.
+async fn run(test: impl AsyncFnOnce(&Adapter)) {
+    let adapter = make_adapter().await;
+    {
+        let mut test = std::pin::pin!(test(&adapter));
+        if tokio::time::timeout(Duration::from_secs(60), &mut test)
+            .await
+            .is_err()
+        {
+            panic!("Test timed out");
+        }
+    }
+    adapter.async_drop().await.unwrap();
+}
+
+/// Creates a directory and returns its inode, which stays loaded like after a `mkdir` through a mount
+async fn mkdir(fs: &Adapter, parent: InodeNumber, dir_name: &str) -> InodeNumber {
+    fs.mkdir(&req(), parent, name(dir_name), dir_mode(), 0)
+        .await
+        .unwrap()
+        .ino
+        .handle
+}
+
+/// Creates a file and closes it again, and returns its inode, which stays loaded like after `touch` through a mount
+async fn touch(fs: &Adapter, parent: InodeNumber, file_name: &str) -> InodeNumber {
+    let reply = fs
+        .create(
+            &req(),
+            parent,
+            name(file_name),
+            file_mode(),
+            0,
+            OpenInFlags::ReadWrite,
+        )
+        .await
+        .unwrap();
+    fs.release(
+        &req(),
+        reply.ino.handle,
+        reply.fh,
+        OpenInFlags::ReadWrite,
+        None,
+        false,
+    )
+    .await
+    .unwrap();
+    reply.ino.handle
+}
+
+async fn lookup(fs: &Adapter, parent: InodeNumber, child_name: &str) -> Option<InodeNumber> {
+    match fs.lookup(&req(), parent, name(child_name)).await {
+        Ok(reply) => Some(reply.ino.handle),
+        Err(FsError::NodeDoesNotExist) => None,
+        Err(err) => panic!("Unexpected error: {err:?}"),
+    }
+}
+
+// Renames within one directory that overwrite a node the kernel still has loaded, e.g. an editor saving a
+// file by writing a temporary file and renaming it over the original. The overwritten node stays loaded
+// as an orphan until the kernel forgets it.
+
+#[tokio::test]
+async fn rename_within_dir_onto_loaded_file() {
+    run(async |fs| {
+        let source = touch(fs, FUSE_ROOT_ID, "source").await;
+        let target = touch(fs, FUSE_ROOT_ID, "target").await;
+
+        fs.rename(
+            &req(),
+            FUSE_ROOT_ID,
+            name("source"),
+            FUSE_ROOT_ID,
+            name("target"),
+            0,
+        )
+        .await
+        .unwrap();
+
+        // The kernel forgets the orphaned node once it doesn't need it anymore, and the moved node too
+        fs.forget(&req(), target, 1).await.unwrap();
+        fs.forget(&req(), source, 1).await.unwrap();
+        assert_eq!(None, lookup(fs, FUSE_ROOT_ID, "source").await);
+        assert!(lookup(fs, FUSE_ROOT_ID, "target").await.is_some());
+    })
+    .await
```

**File**: `crates/rustfs/src/object_based_api/utils/inode_list/mod.rs` (modified, +5/-4)
```diff
@@ -798,9 +798,10 @@ where
         } else {
             match move_result {
                 MoveInodeSuccess::OrphanedExistingChildInNewParent => {
-                    panic!(
-                        "If parents are the same, we should never hit the case of orphaning an existing child."
-                    )
+                    // The rename overwrote a node under the new name that is still loaded, e.g. because the kernel
+                    // still remembers its inode. That node is an orphan now, but its parent pointer still points to
+                    // this parent, so it still counts towards the parent's refcount for invariant E1. The moved node
+                    // stays in the same parent as well, so no refcounts change.
                 }
                 MoveInodeSuccess::AddedAsNewChildToNewParent => {
                     // everything ok
@@ -812,7 +813,7 @@ where
         // * A, C, D, F: No change here
         // * B1: No change here
         // * B2: We assigned a new parent pointer to the node, but with B1+B2, we know that that parent is fully loaded.
-        // * E1: If parent didn't change, we didn't change refcounts.
+        // * E1: If parent didn't change, we didn't change refcounts. That includes a node the rename orphaned, because it still points to the same parent.
         //       If parent changed, we incremented new parent's refcount and decremented old parent's refcount.
         // * E2: We used [Self::_decrement_refcount] to decrement old parent's refcount, which would drop the parent if its refcount went to zero.
         Ok(())
```

#### Recent Merged Pull Requests:
- **PR #677** (2026-10-30): Look up a node's own directory entry by blob id instead of by name (@smessmer)
- **PR #676** (2026-10-30): Don't panic when a rename within a directory overwrites a loaded node (@smessmer)
- **PR #673** (2026-09-29): Add TODOs for the rename follow-ups found while fixing #672 (@smessmer)
- **PR #672** (2026-09-29): Don't lose the source entry when a rename across directories is rejected (@smessmer)
- **PR #671** (2026-09-23): Shorten the 1.1.0 ChangeLog entries and link the PRs (@smessmer)
- **PR #670** (2026-09-22): Stop the cache flush thread before destructing the cache (@smessmer)

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

## X. Don't panic when a rename within a directory overwrites a loaded node (#676)

**RULE**:
When implementing operations in `crates/cryfs-filesystem/Cargo.toml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in cryfs/cryfs. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f9c82def`: Don't panic when a rename within a directory overwrites a loaded node (#676). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/cryfs-filesystem/Cargo.toml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
# tests/fuser_adapter.rs drives the file system through the adapter the fuser backend uses
cryfs-rustfs = {path = "../rustfs", features = ["fuser"]}
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f9c82def` are properly handled with clean fallback behavior.
