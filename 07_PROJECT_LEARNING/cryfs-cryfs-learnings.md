# Forensic Learning Record (Deep Inspection): cryfs/cryfs

> **Canonical Artifact**: `07_PROJECT_LEARNING/cryfs-cryfs-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/cryfs/cryfs](https://github.com/cryfs/cryfs))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:38:53.916Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `cryfs/cryfs`
- **Description**: Cryptographic filesystem for the cloud
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 2307 stars

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

### Core Architecture Module: `crates/cli-utils/src/lib.rs`
```
//! This crate contains some utilities for handling the command line interface.
//! This is shared between the different cryfs executables, e.g. `cryfs` and `cryfs-check`.

#![forbid(unsafe_code)]
// TODO #![deny(missing_docs)]

mod path;
pub use path::parse_path;

mod args;
pub mod password_provider;
mod version;

mod env;
pub use env::{ENV_VARS_DOCUMENTATION, EnvVarDoc, Environment};

mod application;
pub use application::{
    Application, ConstructibleApplication, DEFAULT_LOG_LEVEL, run, run_with, setup_panic_handling,
};

mod config;
pub use config::print_config;

mod error;
pub use error::{CliError, CliErrorKind, CliResultExt, CliResultExtFn};

mod blockstore_setup;
pub use blockstore_setup::{
    BlockstoreCallback, setup_blockstore_stack, setup_blockstore_stack_dyn,
};

pub use clap_logflag;

cryfs_version::assert_cargo_version_equals_git_version!();

pub mod reexports_for_tests {
    pub use anyhow;
    pub use clap;
    pub use cryfs_version;
}

```

### Core Architecture Module: `crates/cli-utils/src/password_provider.rs`
```
use anyhow::{Result, ensure};
use console::style;

use cryfs_config::config::PasswordProvider;

// TODO Protect password similar to how we protect EncryptionKey (mprotect, zero on drop, ...). The rpassword crate actually has an internal class `SafeString` but then they extract it from that before returning :(

pub struct InteractivePasswordProvider;

impl PasswordProvider for InteractivePasswordProvider {
    fn password_for_existing_filesystem(&self) -> Result<String> {
        // TODO Check how this flow looks like when actually running
        loop {
            println!();
            let password = ask_password_from_console("Password: ")?;
            match check_password(&password) {
                Ok(()) => {
                    return Ok(password);
                }
                Err(err) => {
                    println!("Error: {}", err);
                    continue;
                }
            }
        }
    }

    fn password_for_new_filesystem(&self) -> Result<String> {
        // TODO Check how this flow looks like when actually running
        loop {
            println!();
            let password = ask_password_from_console("Password: ")?;
            match check_password(&password) {
                Ok(()) => {
                    let confirm_password = ask_password_from_console("Confirm Password: ")?;
                    if password != confirm_password {
                        // TODO Error message formatting (e.g. colorization), here and above
                        println!("Passwords do not match. Please try again.");
                        continue;
                    }
                    return Ok(password);
                }
                Err(err) => {
                    println!("Error: {}", err);
                    continue;
                }
            }
        }
    }
}

pub struct NoninteractivePasswordProvider;

impl PasswordProvider for NoninteractivePasswordProvider {
    fn password_for_existing_filesystem(&self) -> Result<String> {
        let password = ask_password_from_console("Password: ")?;
        check_password(&password)?;
        Ok(password)
    }

    fn password_for_new_filesystem(&self) -> Result<String> {
        let password = ask_password_from_console("Password: ")?;
        check_password(&password)?;
        Ok(password)
    }
}

fn ask_password_from_console(prompt: &str) -> Result<String> {
    let indent = "  ";
    let prompt = format!("{indent}{prompt}");
    let password = rpassword::prompt_password(style(prompt).bold())?;
    Ok(password)
}

fn check_password(password: &str) -> Result<()> {
    ensure!(
        !password.is_empty(),
        "Invalid password. Password cannot be empty."
    );
    Ok(())
}

// TODO Tests

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #673** (2026-09-29): **Add TODOs for the rename follow-ups found while fixing #672**
  *Symptoms*: Comments only, no behavior change. Six follow-ups came up while working on the cross-directory rename fix in #672. This makes sure each of them has a TODO in the code so it isn't forgotten.  ## New TODOs  Before writing each one, I checked the claim against the code.  - **`CryDir::remove_child_dir` can deadlock with a concurrent rename that overwrites the directory it removes.** The main TODO is in `remove_child_dir` (`dir.rs`); the two places where a rename deletes the overwritten node point to it.   - rmdir keeps the child directory loaded while it waits for the lock on the parent.   - The rename holds that lock while its `on_overwritten` callback calls `remove_by_id` on the child.   - `remove_by_id` waits until every handle to the child is dropped (see `request_immediate_drop` in `concurrent-store/src/store.rs`), including rmdir's.   - Through a Linux mount, the kernel doesn't run rmdir and rename in the same directory at the same time, so only concurrent callers in the same process can hit it. I found this by reading the code; I haven't reproduced it. - **`CryDevice::rename` doesn't update the parent directories' modification timestamps.** `CryDir::rename_child` and `CryDir::move_child_to` do, and POSIX says a rename marks both parents for update. Only the fuse-mt backend goes through `CryDevice::rename`. The TODO is at the top of `CryDevice::rename` (`device.rs`). - **fuse_mt 0.6.4 drops the `renameat2()` flags before it calls our fuse-mt backend.** Its `rename` takes `_
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/cryfs/cryfs/pull/673?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=cryfs) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 88.68%. Comparing base ([`d936715`](https://app.codecov.io/gh/cryfs/cryfs/commit/d936715525b43eae66708277567ede0bf5ae6531?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=cryfs)) to head ([`f0bea87`](https://app.codecov.io/gh/cryfs/cryfs/commit/f0bea87e5aacf478b4a848a12d457417815370b5?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=cryfs)). :warning: Report is 2 commits behind head on main.  <details><summary>Additional details and impacted files</summary>    ```diff @@            Coverage Diff             @@ ##             main     #673      +/

- **Issue #672** (2026-09-29): **Don't lose the source entry when a rename across directories is rejected**
  *Symptoms*: ## What was wrong  A rename across two directories removed the entry from the source directory first, and only then asked the destination whether it accepts the overwrite. If the destination refused, the error was returned but the entry was never put back. Refusal happens when the target is a non-empty directory (ENOTEMPTY), or when a directory is renamed onto a non-directory or vice versa (EISDIR/ENOTDIR).  The result: the node disappeared from its parent directory, and its blob was orphaned, so its data became unreachable and its storage leaked.  Both rename implementations had this, and both had a TODO saying so: - `CryDir::move_child_to`, used by the fuser backend (the default) - the cross-directory branch of `CryDevice::rename`, used by the fuse-mt backend  ### Reproduced on a real mount  This is a throwaway `cryfs-cli` integration test that mounts a `CryDevice` (in-memory block store) through `RustfsFuserBackend::spawn_mount`, then:  ``` mkdir p1 p2 p1/d p2/d; echo > p1/d/f; echo > p2/d/g rename(p1/d, p2/d) ```  |  | `rename` result | `ls p1` | `ls p2/d` | |---|---|---|---| | `main` | `ENOTEMPTY` | `[]`, so `p1/d` is gone | `[g]` | | this PR | `ENOTEMPTY` | `[d]` | `[g]` |  The kernel rejects the EISDIR/ENOTDIR type mismatches itself before calling FUSE. It does not check whether the target directory is empty. So ENOTEMPTY is the case users hit, e.g. `mv p1/d p2/` when `p2/d` exists and isn't empty.  The C++ implementation doesn't have this bug. Its `CryNode::rename` ad
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/cryfs/cryfs/pull/672?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=cryfs) Report :x: Patch coverage is `93.15068%` with `5 lines` in your changes missing coverage. Please review. :white_check_mark: Project coverage is 88.68%. Comparing base ([`d936715`](https://app.codecov.io/gh/cryfs/cryfs/commit/d936715525b43eae66708277567ede0bf5ae6531?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=cryfs)) to head ([`c8856b9`](https://app.codecov.io/gh/cryfs/cryfs/commit/c8856b9dc6d6d757d020c04532b8fa83dd41eda7?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=cryfs)).  | [Files with missing lines](https://app.codecov.io/gh/cryfs/cryfs/pull/672?dropdown=coverage&src=pr&el=tree&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+

- **Issue #671** (2026-09-23): **Shorten the 1.1.0 ChangeLog entries and link the PRs**
  *Symptoms*: Several 1.1.0 entries explained the bug they fix in detail, some running to six or nine lines. Each entry is now one line saying what changed for users, with a link to the PR that has the details. The links use the `(see https://github.com/cryfs/cryfs/pull/NNN )` form the older sections already use. The 1.1.0 section goes from 88 lines to 23.  Only the 1.1.0 section changes. Everything from `Version 1.0.3` down is byte-identical, which I checked with `cmp`.  ## Links  | Entry | PR | |---|---| | Protection and zeroing of encryption keys | #528, #529 | | Data races in the integrity checks (KnownBlockVersions) | #664 | | Buffer over-read on a truncated block file | #530 | | Heap buffer overrun when generating random data | #663 | | libFUSE 3 migration | #590 (the PR that merged the migration; its description lists the individual PRs) | | Exit code 26 when libFUSE refuses to mount | #570 | | Undefined behavior while parsing mount options | #576 | | Data race and possible hang when deleting files | #665 | | Race in the caches when unmounting | #670 | | Idle file system creating dozens of threads per second | #670 | | Windows installer built with Visual Studio 2026 | #588 | | DokanY 2.3.1.1000 | #605 |  I found each PR by looking up which commit added the entry, or which commit made the fix. Three entries (libFUSE 3, exit code, mount-option parsing) were written together in #579, so for those I linked the PR that made the change.  ## What stays in the ChangeLog  Things users have t

- **Issue #670** (2026-09-22): **Stop the cache flush thread before destructing the cache**
  *Symptoms*: This is the area the intermittent `cryfs-test` SIGSEGV points at (issuecomment-5737867149). **Read the honesty note at the bottom first: I could not reproduce that crash, so this is not presented as a proven fix for it.** Both changes stand on their own.  ## The destructor ran with the flusher still live  `Cache` starts a `PeriodicTask` that calls `_deleteOldEntriesParallel()` on it every `PURGE_INTERVAL`. The constructor is careful about exactly this hazard, and says so:  ```cpp //Don't initialize timeoutFlusher in the initializer list, //because it then might already call Cache::popOldEntries() before Cache is done constructing. ```  The destructor had no counterpart. It ran `_deleteAllEntriesParallel()` and then the size assertion with the flusher still running, so a background thread kept calling member functions on an object whose destruction had already begun — and could start a fresh parallel sweep at any point during it, including after the destructor body finished and before `_timeoutFlusher`'s own destructor stopped it.  `~Cache()` now stops the flusher first.  ## Purges started a thread pool even with nothing to purge  `_deleteMatchingEntriesAtBeginningParallel()` spawned `2 * hardware_concurrency` threads unconditionally. But the workers stop at the first entry that doesn't match, and entries are ordered oldest first, so when the oldest entry doesn't match there is nothing for any of them to do. The flusher calls this every half second whether or not anything has 
  **Post-Mortem & Fix Analysis**:
  > Three jobs are red. None of them reached a compiler, and none is this PR's.  **1. `CI (windows-2025, RelWithDebInfo)`** — died in the dependency install step:  ``` wget https://github.com/dokan-dev/dokany/releases/download/v2.3.1.1000/Dokan_x64.msi HTTP request sent, awaiting response... 500 Internal Server Error ##[error]Process completed with exit code 8. ```  A GitHub 500 serving a third-party release asset. The other five Windows jobs pulled the same MSI without trouble.  **2 and 3. `CI (macos-26-intel, …, clang 19)` and `(…, clang 17)`** — both stalled in `Restore conan cache` for roughly 50 minutes and were then reclaimed. Identical signature in both: `Restore conan cache` left `in_progress`, every later step `pending`, no step marked failed, and the log blob returns `BlobNotFound`. Neither reached `Setup conan`, so neither configured or built anything.  Worth being precise about why that can't be this PR's, since these two did *not* fail on the base branch — all five `macos-26-i

- **Issue #669** (2026-09-23): **Don't fail the CallAfterTimeout reset tests when a sleep overshoots**
  *Symptoms*: `CallAfterTimeoutTest.OneReset` and `.TwoResets` sleep for less than the timeout and then reset the timer, expecting the callback not to happen until a full timeout after that reset. But a sleep can only ever take longer than requested, never shorter, so on a loaded machine the sleep can end *after* the timeout already elapsed. The callback then happens before the test gets to reset the timer, and because the test takes its "timer started" timestamp right before resetting, the measured delay comes out far too small — even negative.  This isn't hypothetical. It just happened on a macOS runner in #654, which is the PR that starts running `cryfs-cli-test` on macOS:  ``` [  FAILED  ] CallAfterTimeoutTest.TwoResets ```  `OneReset` needs its 125ms sleep to overshoot by 75ms for this, `TwoResets` the same — and #661's own commit message records observing a 76ms overshoot. So both tests are one hiccup away from a red build.  #661 fixed exactly this class of problem for the non-reset tests, by measuring when the callback actually happened instead of checking "not called yet" at a point in time. The reset tests still have the hazard, because they need the reset itself to land before the old deadline, and no amount of care with timestamps can make an overshooting sleep land in time.  ### What this does  `resetTimer()` now reports whether the callback had already happened by the time it returned, and the two tests re-run the whole scenario when it had:  ```cpp TEST_F(CallAfterTimeoutTest

- **Issue #668** (2026-09-18): **Fix the flaky CacheTest_PushAndPop.AfterTimeout**
  *Symptoms*: `CacheTest_PushAndPop.AfterTimeout` took out two unrelated pull requests on macOS within one day, both times as `Failed test binaries: blockstore/blockstore-test`:  ``` unknown file: Failure C++ exception with description "Attempted to access the value of an uninitialized optional object." thrown in the test body. ```  It hit #662 attempt 1 ([job 105554091434](https://github.com/cryfs/cryfs/actions/runs/35330666230/job/105554091434), `Test (RelWithDebInfo)`, clang 18) and #665 ([job 105581813208](https://github.com/cryfs/cryfs/actions/runs/35339336271/job/105581813208), `Test (Release)`, clang 15). Those two diffs have nothing in common, and #662 changes only CI YAML, `.clang-tidy`, `run-clang-tidy.sh`, two comment lines in `unique_ref.h` and one file in `cpp-utils-test`, so it cannot affect `blockstore-test` at all. The test is the common factor.  ### Why it is flaky  ```cpp constexpr double TIMEOUT1_SEC = Cache::MAX_LIFETIME_SEC * 3/4;   // 750ms constexpr double TIMEOUT2_SEC = Cache::PURGE_LIFETIME_SEC * 3/4; // 375ms push(10, 20); sleep_for(TIMEOUT1_SEC); push(20, 30); sleep_for(TIMEOUT2_SEC); EXPECT_EQ(boost::none, pop(10)); EXPECT_EQ(30, pop(20).value()); ```  `PURGE_LIFETIME_SEC` and `PURGE_INTERVAL` are both 0.5, so the observation at 1125 ms has to land inside a window only 250 ms wide, and the sleeps aim at its centre:  | entry | age when read | what has to hold | slack | |---|---|---|---| | first | 1125 ms | the purge tick due at 1000 ms must already have run | 125
  **Post-Mortem & Fix Analysis**:
  > Pushed `d50a7c82`, which fixes a regression the first version of this PR introduced. I found it by measuring the old and new tests on the same scale rather than by trusting the green run above, and it is worth writing down because the green run did not catch it.  ### What was wrong  The first version discarded any attempt where the second entry had reached `PURGE_LIFETIME_SEC` by the time it was read, reasoning that the cache was then allowed to purge it. That is too strict. Purging runs on a timer every `PURGE_INTERVAL` rather than the moment an entry becomes old enough, and `Cache.h` documents entries living up to `MAX_LIFETIME_SEC`, so an entry past `PURGE_LIFETIME_SEC` that is *still cached* is correct behaviour and a perfectly usable observation. Throwing it away turned runs the old test passed into a failure after five attempts, reported as "this machine is too loaded".  Measured with an extra sleep injected before the read, standing in for a sleep that overshot. 10 runs per cell

- **Issue #667** (2026-09-18): **Print a backtrace when a test binary crashes**
  *Symptoms*: Companion to #666. That one gets a backtrace out of the core CI already produces; this one gets the crashing process to say something itself.  `cryfs-test` segfaults intermittently on CI with no diagnostic at all, because `test/my-gtest-main/my-gtest-main.cpp` never installs a crash handler. `cpputils::showBacktraceOnCrash()` exists and the `cryfs` and `cryfs-unmount` binaries use it, but it is **not** usable as-is for the test main:  - it handles `SIGABRT`, which `ASSERT` uses deliberately in Debug builds and which `assert_debug_test.cpp`'s `EXPECT_DEATH` tests rely on — and gtest's "threadsafe" death tests re-exec the binary, so `main()` and any handler run in the child too; - its handlers call `exit(1)`, which throws away the core dump (#666 needs it) and hides that the process died by a signal — bash's `Segmentation fault (core dumped)` line is currently the only way the crash is visible at all.  So this adds `showBacktraceOnCrashSignals()` next to it: handlers for `SIGSEGV`, `SIGBUS`, `SIGILL`, `SIGFPE` **only**, which write the signal name and the backtrace to stderr, restore `SIG_DFL`, and re-raise — so the process still dies by that signal and still dumps core. `SIGABRT` is untouched. `my-gtest-main` calls it before `InitGoogleMock`.  Two things review changed that are worth calling out:  **The handler could wedge the process.** Installed through `SignalHandlerRAII` it inherited `sigfillset` — every signal blocked while the handler runs — so a segfault *inside* `mallo

- **Issue #666** (2026-09-18): **Print a backtrace for test binaries that dump core on CI**
  *Symptoms*: `cryfs-test` intermittently dies with SIGSEGV on CI — roughly 1 in 40–60 Linux jobs, always clang+libc++, in the `FsppNodeTest_Timestamps_*` / `FsppDirTest_Timestamps_*` families. The evidence has been sitting in the job log all along:  ``` ... line 41: 119804 Segmentation fault      (core dumped) "./$t" > "$logdir/..." 2>&1 ```  The kernel wrote a core and nothing ever looked at it. Since the builds carry symbols, one backtrace from one of those cores ends the investigation.  This changes only `.github/workflows/actions/run_tests/action.yaml`. On Linux it raises `ulimit -c`, points `kernel.core_pattern` at a temp dir (GitHub's Ubuntu runners pipe cores to apport by default, so the override is required and passwordless sudo is available), and after the wait loop — if any core exists — lazily installs `gdb` and prints `thread apply all bt full` per core, each in its own `::group::`, matching cores back to binaries by pid. macOS is untouched. `set -e` is respected on both paths, and the existing `Failed test binaries` line and `exit 1` are unchanged.  `gdb` is installed only when a core actually exists, rather than in `setup_linux`, so the common case doesn't pay ~10s per job for a 1-in-50 event.  Review added four things:  - an `EXIT` trap that removes the core dir and restores `kernel.core_pattern`, guarded by comparing the kernel's current pattern against the saved one so a job where `sudo` refused doesn't warn about a restore it never needed - per-binary exit codes kept in 

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

### Incident Patch 1: `ad1f72d5` (2026-09-29)
**Commit Message**: Add TODOs for the rename follow-ups found while fixing #672 (#673)

Three issues came up while working on the cross-directory rename fix (#672)
that didn't have a TODO yet:

- CryDir::remove_child_dir can deadlock with a concurrent rename that
  overwrites the directory it removes. rmdir keeps the child loaded while it
  waits for the parent's lock. The rename holds that lock while it calls
  remove_by_id on the child, which waits until every handle to the child is
  dropped. Through a Linux mount, the kernel doesn't run the two at the same
  time. The main TODO is in remove_child_dir, with pointers at both
  remove_by_id call sites of the rename.
- CryDevice::rename doesn't update the modification timestamps of the parent
  directories, unlike CryDir::rename_child and CryDir::move_child_to.
- fuse_mt 0.6.4 drops the renameat2() flags before it calls our fuse-mt
  backend. So RENAME_NOREPLACE and RENAME_EXCHANGE become a plain,
  overwriting rename there, instead of being rejected with EINVAL like the
  fuser backend has done since #580.

The other follow-ups from #672 already have TODOs:
- keeping both directories locked for the whole move
- undoing a move when set_parent fails
- 

**File**: `crates/cryfs-filesystem/src/filesystem/device.rs` (modified, +4/-0)
```diff
@@ -313,6 +313,8 @@ where
     }
 
     async fn rename(&self, source_path: &AbsolutePath, dest_path: &AbsolutePath) -> FsResult<()> {
+        // TODO Unlike CryDir::rename_child and CryDir::move_child_to, this doesn't update the modification timestamps of the
+        //      source and destination parent directories, although POSIX says a rename marks them for update.
         if source_path.is_ancestor_of(dest_path) {
             log::error!(
                 "Tried to rename {source_path} into its descendant {dest_path}",
@@ -348,6 +350,8 @@ where
             )
             .await?;
 
+            // TODO We hold the lock on the destination directory here, and remove_by_id waits until every handle to the
+            //      overwritten blob is dropped. That can deadlock with a concurrent CryDir::remove_child_dir, see the TODO there.
             match self
                 .blobstore
                 .remove_by_id(&overwritten_blobid)
```

**File**: `crates/cryfs-filesystem/src/filesystem/dir.rs` (modified, +7/-0)
```diff
@@ -143,6 +143,8 @@ where
         &self,
         old_destination_blob_id: BlobId,
     ) -> FsResult<()> {
+        // TODO The caller holds the lock on the destination directory, and remove_by_id waits until every handle to the
+        //      overwritten blob is dropped. That can deadlock with a concurrent remove_child_dir, see the TODO there.
         let result = self
             .blobstore
             .remove_by_id(&old_destination_blob_id)
@@ -604,6 +606,11 @@ where
                     let ((), child_blob) = child_blob.async_drop_on_err(entries_check).await?;
 
                     // TODO We released the lock on self_blob above and are now re-locking it. There is a race condition here.
+                    // TODO This can deadlock with a concurrent rename that overwrites this child. We keep child_blob loaded while we wait
+                    //      for the lock on self_blob below, but the rename holds the lock on self_blob (its destination directory) while
+                    //      its on_overwritten callback calls remove_by_id on the child, and remove_by_id waits until every handle to the
+                    //      child is dropped, including ours. Through a Linux mount, the kernel doesn't run rmdir and rename in the same
+                    //      directory at the same time, but concurrent callers in this process can hit it.
 
                     // First remove the entry, then flush that change, and only then remove the blob.
                     // This is to make sure the file system doesn't end up in an invalid state
```

**File**: `crates/rustfs/src/backend/fuse_mt/backend_adapter.rs` (modified, +4/-0)
```diff
@@ -336,6 +336,10 @@ where
         )
     }
 
+    // TODO fuse_mt 0.6.4 drops the renameat2() flags before it calls this (its `rename` takes `_flags: u32, // TODO`),
+    //      so RENAME_NOREPLACE and RENAME_EXCHANGE arrive here as a plain rename that overwrites the target.
+    //      The fuser backend rejects any flags with EINVAL instead, see `reject_unsupported_rename_flags` in
+    //      object_based_api/low_level_adapter.rs. Do the same here once fuse_mt passes the flags on.
     fn rename(
         &self,
         req: RequestInfo,
```

---

### Incident Patch 2: `dd357526` (2026-09-10)
**Commit Message**: ci: run the beta toolchain on Linux only (#638)

#637 added beta across every runner image, which put eight of its
fourteen jobs on macOS. Those eight are the expensive half: a macOS
debug job is around 80 minutes and a release job on the Intel runner
around 300, against 50 to 110 for Linux, and the account has five
concurrent macOS runners.

They do not buy much. Beta is here to catch an upstream Rust regression
a cycle before it reaches stable, and such a regression is almost never
platform-specific -- the same argument #635 used when it cut the pull
request macOS jobs down to stable. The six Linux beta jobs give that
signal; the macOS ones repeat it at six times the cost.

Excluding them takes main from 56 jobs to 48, and its macOS jobs from
32 to 24. Nothing else changes: the pull request matrix never had beta,
and every non-beta combination is untouched.

The exclusions are per image, so a macOS image added later needs an
entry there too or beta starts running on it. That is the same shape
the pull request matrix already uses, and the wrong-by-default outcome
is two extra jobs rather than silently lost coverage.


Claude-Session: https://claude.ai/code/session_01Kjjwx5NLxkKfB8

**File**: `.github/workflows/ci.yml` (modified, +9/-2)
```diff
@@ -75,11 +75,18 @@ jobs:
         # supported version is almost never specific to a platform, and the
         # Linux jobs still check all three on every pull request.
         #
-        # Nothing is lost from main, which keeps every combination.
+        # Main keeps every combination but one: beta does not run on the
+        # macOS images. Beta is here to catch an upstream Rust regression a
+        # cycle before it reaches stable, and such a regression is almost
+        # never platform-specific -- the same reasoning that keeps the pull
+        # request macOS jobs to stable. On four macOS images it cost eight
+        # jobs for a signal the six Linux beta jobs already give. Adding a
+        # macOS image means adding it to that exclude list too, or beta
+        # starts running on it.
         env:
           EVENT: ${{ github.event_name }}
         run: |
-          full='{"os":["macos-15","macos-15-intel","macos-26","macos-26-intel","ubuntu-22.04","ubuntu-24.04","ubuntu-26.04"],"command":["test"],"profile":["","--release"],"toolchain":["stable","beta","nightly","1.95"]}'
+          full='{"os":["macos-15","macos-15-intel","macos-26","macos-26-intel","ubuntu-22.04","ubuntu-24.04","ubuntu-26.04"],"command":["test"],"profile":["","--release"],"toolchain":["stable","beta","nightly","1.95"],"exclude":[{"os":"macos-15","toolchain":"beta"},{"os":"macos-15-intel","toolchain":"beta"},{"os":"macos-26","toolchain":"beta"},{"os":"macos-26-intel","toolchain":"beta"}]}'
           pr='{"os":["macos-15","ubuntu-22.04","ubuntu-24.04","ubuntu-26.04"],"command":["test"],"profile":["","--release"],"toolchain":["stable","nightly","1.95"],"exclude":[{"os":"macos-15","toolchain":"nightly"},{"os":"macos-15","toolchain":"1.95"}]}'
           if [[ "$EVENT" == "pull_request" ]]; then
             matrix="$pr"
```

---

### Incident Patch 3: `7f4bf2a6` (2026-09-09)
**Commit Message**: CI: build pushes to the release branches (#626)

**File**: `.github/workflows/ci.yml` (modified, +1/-0)
```diff
@@ -11,6 +11,7 @@ on:
   push:
     branches:
       - main
+      - 'release/**'
       - 'feature/**'
     tags:
       - '**'
```

---

### Incident Patch 4: `cb6ad31f` (2026-09-09)
**Commit Message**: Revert "Use thin LTO for the release test builds in CI"

This reverts commit ddbecfdc (#614). The release test builds in CI go
back to the fat LTO that Cargo.toml asks for, so what CI tests is again
exactly the configuration release binaries are built with.

The numbers the change was based on were wrong. They came from builds in a
renamed target directory, which the crabtime macro used by e2e-perf-tests
refuses, so those builds had failed on the largest unit of a release build
before finishing. Measured again in target/, complete builds, same machine
and session, 4 cores, `cargo build --tests --release`:

    fresh build                      fat 16m44s (50m36s CPU)   thin 15m12s (55m50s CPU)
    rebuild after touching utils     fat 13m18s (40m32s CPU)   thin 12m23s (47m07s CPU)

Thin LTO is 7 to 9% faster in wall time on 4 cores and uses 10 to 16% more
CPU; the gain comes from parallelising the link, so on the 3-core macOS
runners it is smaller still. That is not worth testing a configuration
that differs from the shipped one.

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01FyVQXF6AvMQdyNVSdHNw9X

**File**: `.github/workflows/ci.yml` (modified, +0/-10)
```diff
@@ -132,16 +132,6 @@ jobs:
           cache-on-failure: true
       - name: cargo ${{ matrix.command }}
         shell: bash
-        env:
-          # Cargo.toml asks for fat LTO, and release binaries built anywhere
-          # else still get it. For the release test builds here, thin LTO
-          # keeps the optimisation level and the checks that differ between
-          # profiles (overflow, debug_assertions) while roughly halving the
-          # workspace's release build: rebuilding the workspace's test binaries
-          # after a change takes 8m18s with thin LTO and 17m19s with fat on a
-          # 4-core machine, and every release job pays that for each feature
-          # set.
-          CARGO_PROFILE_RELEASE_LTO: thin
         # On GitHub-hosted macOS runners we have to skip the cryfs-rustfs
         # tests that mount real FUSE sessions via fuser → macFUSE: the
         # runner image won't approve macFUSE's kernel extension
```

---

### Incident Patch 5: `d42bf7be` (2026-09-09)
**Commit Message**: Stop freeing disk space before the Linux test jobs

The step took 72 to 154 seconds per job to make room the test jobs no
longer need. A Linux runner starts with 87 GB available (145 GB disk, 59 GB
used by the image, from the step's own before/after report on a recent
job); the step reclaims 26 GB of that. A test job now needs about 10 GB:
the debug target directory of the workspace is 4 GB per feature set since
tests are built with line tables only, the release one smaller, plus the
cargo registry. The check and coverage jobs keep their step.

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01FyVQXF6AvMQdyNVSdHNw9X

**File**: `.github/workflows/ci.yml` (modified, +0/-3)
```diff
@@ -96,9 +96,6 @@ jobs:
       # from 7m40s to 5m02s and the target directory from 20 GB to 4 GB.
       CARGO_PROFILE_DEV_DEBUG: line-tables-only
     steps:
-      - name: Free Disk Space (Ubuntu)
-        if: ${{ runner.os == 'Linux' }}
-        uses: jlumbroso/free-disk-space@v1.3.1
       - uses: actions/checkout@v7
       - name: Install Dependencies (Linux)
         if: ${{ runner.os == 'Linux' }}
```

---

### Incident Patch 6: `60b3107b` (2026-09-09)
**Commit Message**: Cache the Linux test jobs too

The repository's cache storage limit has been raised from 10 GB to 20 GB in
its Actions settings, so all 30 caches fit: 15 debug at about 0.5 GB and 15
release at about 0.3 GB, about 12 GB, with room for the daily nightly churn.
The macOS-only condition and the comment explaining it go away.

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01FyVQXF6AvMQdyNVSdHNw9X

**File**: `.github/workflows/ci.yml` (modified, +9/-12)
```diff
@@ -117,19 +117,16 @@ jobs:
         # version and the Cargo.lock hash; a lockfile change still restores the
         # nearest older cache and rebuilds just the crates that differ.
         #
-        # Only the macOS jobs cache, and only main saves. GitHub runs at most
-        # 5 macOS jobs at a time for the whole account, so macOS runner
-        # minutes are the scarce resource; Linux has a pool of 20. The
-        # repository has 10 GB of cache storage in total. One cache is about
-        # 0.3 GB for the release profile and 0.5 GB for debug when tests are
-        # built with line tables only (0.8 GB with full debuginfo), so the 18
-        # macOS caches fit and the 12 Linux ones would not: they would only
-        # evict the macOS caches. Every branch can restore main's caches, while
+        # Only main saves. Every branch can restore main's caches, while
         # caches saved by a branch are visible to that branch alone, so
-        # per-branch caches would evict the shared ones the same way. If the
-        # cache storage limit is raised in the repository settings, drop the
-        # `if` to cache the Linux jobs too.
-        if: ${{ runner.os == 'macOS' }}
+        # per-branch caches would only evict the shared ones. There is one
+        # cache per runner image, toolchain and profile, 30 in total. One is
+        # about 0.3 GB for the release profile and 0.5 GB for debug (tests are
+        # built with line tables only), about 12 GB together plus the daily
+        # nightly churn. The repository's cache storage limit is set to 20 GB
+        # in its Actions settings (the default is 10 GB); eviction is
+        # least-recently-used across all entries, so if the limit ever drops
+        # back below what the caches need, which jobs hit becomes a lottery.
         uses: Swatinem/rust-cache@6323deb102c322ba6fcbdcafc7e3dddab59af2b6 # v2.9.2
         with:
           shared-key: ${{ matrix.os }}-${{ matrix.toolchain }}-${{ matrix.profile == '--release' && 'release' || 'debug' }}
```

---

### Incident Patch 7: `89f06a4c` (2026-09-09)
**Commit Message**: Stop the cryfs-cli test from building the other profile's executable

crates/cryfs-cli/tests/args.rs checked the debug-build warning against both
profiles from a single test run: it used escargot to build the `cryfs`
executable in debug and in release from inside the tests, whichever profile
the tests themselves were built with. Only one of those was already built by
the surrounding `cargo test`; the other was a full compile of the dependency
tree and the crate in the other profile, inside every test run. Measured on a
4-core machine, that one test took 549 of the 1413 seconds the whole
workspace's tests need in the debug profile, and in a release run it is a
complete debug build instead. Every job in the CI matrix paid it, in every
feature set.

The two tests now each run the executable built with the same profile as the
test binary, chosen with cfg(debug_assertions) the way the unit tests for the
same warning in cli-utils' version.rs already do. A `cargo test` run covers
the debug case, `cargo test --release` the release case, and CI runs both
profiles on every image and toolchain, so both cases stay covered on every
run. Nothing builds during the tests any more.

escargot had no

**File**: `Cargo.lock` (modified, +0/-12)
```diff
@@ -1107,7 +1107,6 @@ dependencies = [
  "cryfs-version",
  "daemonizable",
  "dialoguer",
- "escargot",
  "humantime",
  "itertools 0.14.0",
  "lazy_static",
@@ -1739,17 +1738,6 @@ dependencies = [
  "windows-sys 0.61.2",
 ]
 
-[[package]]
-name = "escargot"
-version = "0.5.15"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "11c3aea32bc97b500c9ca6a72b768a26e558264303d101d3409cf6d57a9ed0cf"
-dependencies = [
- "log",
- "serde",
- "serde_json",
-]
-
 [[package]]
 name = "fastrand"
 version = "2.4.1"
```

**File**: `Cargo.toml` (modified, +0/-1)
```diff
@@ -47,7 +47,6 @@ dtor = "^1.0.3"
 env_logger = "^0.11.8"
 envtestkit = "^1.1.2"
 errno = "^0.3.11"
-escargot = "^0.5.14"
 fuse_mt = "^0.6.3"
 fuser = "^0.17"
 futures = "^0.3.31"
```

**File**: `crates/cryfs-cli/Cargo.toml` (modified, +0/-1)
```diff
@@ -47,7 +47,6 @@ console-subscriber = {workspace = true, optional = true}
 [dev-dependencies]
 assert_cmd.workspace = true
 daemonizable = { workspace = true, features = ["testutils"] }
-escargot.workspace = true
 lazy_static.workspace = true
 predicates.workspace = true
 rstest.workspace = true
```

**File**: `crates/cryfs-cli/tests/args.rs` (modified, +12/-28)
```diff
@@ -2,43 +2,20 @@ use assert_cmd::Command;
 use lazy_static::lazy_static;
 use predicates::boolean::PredicateBooleanExt;
 use predicates::str::ContainsPredicate;
-use std::path::{Path, PathBuf};
+use std::path::Path;
 
 // TODO Use indoc! for multiline strings
 
 lazy_static! {
-    // Don't use escargot for getting the path of the executable built with same settings as the
-    // test was built, because that one is already built by cargo and we don't need to re-build it.
+    // The executable built with the same profile as this test binary. Cargo has already built it
+    // by the time the tests run, so no test here builds anything itself.
     static ref CRYFS_CMD_PATH_CURRENT: &'static Path = assert_cmd::cargo::cargo_bin!("cryfs");
-    static ref CRYFS_CMD_PATH_DEBUG: PathBuf = escargot::CargoBuild::new()
-        .current_target()
-        .bin("cryfs")
-        .run()
-        .unwrap()
-        .path()
-        .to_owned();
-    static ref CRYFS_CMD_PATH_RELEASE: PathBuf = escargot::CargoBuild::new()
-        .current_target()
-        .release()
-        .bin("cryfs")
-        .run()
-        .unwrap()
-        .path()
-        .to_owned();
 }
 
 fn cryfs_cmd() -> Command {
     Command::new(&*CRYFS_CMD_PATH_CURRENT)
 }
 
-fn cryfs_cmd_debug() -> Command {
-    Command::new(&*CRYFS_CMD_PATH_DEBUG)
-}
-
-fn cryfs_cmd_release() -> Command {
-    Command::new(&*CRYFS_CMD_PATH_RELEASE)
-}
-
 mod no_args {
     use super::*;
 
@@ -260,19 +237,26 @@ mod debug_build_warning {
         predicates::str::contains("WARNING! This is a debug build.")
     }
 
+    // Each of these runs the executable built with the same profile as the test binary, so a
+    // `cargo test` run covers the debug case and a `cargo test --release` run the release case.
+    // Building the other profile's executable from inside the test would compile the whole
+    // dependency tree a second time on every test run.
+
+    #[cfg(debug_assertions)]
     #[test]
     fn debug_build() {
-        cryfs_cmd_debug()
+        cryfs_cmd()
             // TODO Test this by actually mounting a test file system (probably with test scrypt parameters for performance), not with "--version"
             .arg("--version")
             .assert()
             .success()
             .stderr(debug_build_warning());
     }
 
+    #[cfg(not(debug_assertions))]
     #[test]
     fn release_build() {
-        cryfs_cmd_release()
+        cryfs_cmd()
             // TODO Test this by actually mounting a test file system (probably with test scrypt parameters for performance), not with "--version"
             .arg("--version")
             .assert()
```

---

### Incident Patch 8: `ddbecfdc` (2026-09-09)
**Commit Message**: Use thin LTO for the release test builds in CI

[profile.release] in Cargo.toml asks for fat LTO and keeps doing so:
release binaries built anywhere else are unchanged. This sets thin LTO
through the environment for the `cargo test --release` step in CI only.

Fat LTO re-optimises the whole dependency graph for each of the ~30 test
binaries. Measured on a 4-core machine: a release test build of the
workspace takes 21m30s with fat LTO and 14m28s with thin, and rebuilding
the workspace's test binaries after a change, which is what a job with
cached dependencies does, takes 17m19s with fat and 8m18s with thin. Every
release job pays that once per feature set, on 3-core macOS runners.

What the release jobs test is unchanged in every way a test can observe:
optimisation level, overflow checks, debug_assertions, and every feature
and toolchain combination. What changes is how much cross-crate inlining
the linker does.

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01FyVQXF6AvMQdyNVSdHNw9X

**File**: `.github/workflows/ci.yml` (modified, +10/-0)
```diff
@@ -113,6 +113,16 @@ jobs:
           toolchain: ${{ matrix.toolchain }}
       - name: cargo ${{ matrix.command }}
         shell: bash
+        env:
+          # Cargo.toml asks for fat LTO, and release binaries built anywhere
+          # else still get it. For the release test builds here, thin LTO
+          # keeps the optimisation level and the checks that differ between
+          # profiles (overflow, debug_assertions) while roughly halving the
+          # workspace's release build: rebuilding the workspace's test binaries
+          # after a change takes 8m18s with thin LTO and 17m19s with fat on a
+          # 4-core machine, and every release job pays that for each feature
+          # set.
+          CARGO_PROFILE_RELEASE_LTO: thin
         # On GitHub-hosted macOS runners we have to skip the cryfs-rustfs
         # tests that mount real FUSE sessions via fuser → macFUSE: the
         # runner image won't approve macFUSE's kernel extension
```

---

### Incident Patch 9: `52904c41` (2026-09-09)
**Commit Message**: Build tests without incremental compilation and with line tables only

CARGO_INCREMENTAL=0: nothing on a fresh runner reuses incremental
artifacts, they only cost time to write. The incremental directory of a
debug test build of the workspace is 11 GB of a 20 GB target directory.

CARGO_PROFILE_DEV_DEBUG=line-tables-only: full debuginfo is only useful
under a debugger, and nothing in CI runs one. Backtraces from a failing test
still carry file and line. Measured on a 4-core machine, a debug `cargo
build --tests` of the workspace goes from 7m40s to 5m02s and the target
directory from 20 GB to 4 GB. Same code, same optimisation level, same
tests; only the debuginfo the compiler emits changes, and only in CI:
Cargo.toml is untouched, so local builds keep full debuginfo.

HOMEBREW_NO_AUTO_UPDATE=1: `brew install` otherwise starts by updating
every tap on the runner before installing pkg-config and macfuse.

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01FyVQXF6AvMQdyNVSdHNw9X

**File**: `.github/workflows/ci.yml` (modified, +12/-0)
```diff
@@ -84,6 +84,18 @@ jobs:
         features: ["", "--no-default-features"]
         toolchain: ["stable", "nightly", "1.95"]
     runs-on: ${{matrix.os}}
+    env:
+      # `brew install` otherwise starts with a `brew update` of the whole tap.
+      HOMEBREW_NO_AUTO_UPDATE: 1
+      # Nothing on a CI runner reuses incremental artifacts, they only cost
+      # time and disk: the incremental directory of a debug test build of the
+      # workspace is 11 GB.
+      CARGO_INCREMENTAL: 0
+      # Full debuginfo is only useful under a debugger; backtraces from a
+      # failing test keep file and line with line tables alone. Measured on a
+      # 4-core machine: a debug `cargo build --tests` of the workspace drops
+      # from 7m40s to 5m02s and the target directory from 20 GB to 4 GB.
+      CARGO_PROFILE_DEV_DEBUG: line-tables-only
     steps:
       - name: Free Disk Space (Ubuntu)
         if: ${{ runner.os == 'Linux' }}
```

---

### Incident Patch 10: `6eeaeedf` (2026-09-07)
**Commit Message**: Raise recursion_limit to fix rustc ICE on nightly (#574)

The three `nightly` jobs of the CI test matrix have been failing on main
since rustc 1.100.0-nightly (a69a63265 2026-09-03), with an ICE in the
monomorphization collector while compiling cryfs-cli:

    error: internal compiler error: compiler/rustc_monomorphize/src/lib.rs:46:13:
    invalid `CoerceUnsized` from
      Pin<Box<{async block@<ObjectBasedFsAdapterLL<CryDevice<...Aes256Gcm...>>>
               as AsyncFilesystemLL>::destroy<'_, '_>::{closure#0}}>>
      to Pin<Box<dyn Future<Output = ()> + Send>>: impl_source: Err(Unimplemented)

The coercion is not the problem, the trait solver's recursion limit is.
Our ciphers are parameterized by `typenum` type-level integers, and proving
`U16: generic_array::ArrayLength` goes through `IsWithinUsizeBound`, which
unrolls typenum's `Shl` recursion past rustc's default limit of 128. That
overflow used to be accepted silently; the same nightly turned it into the
`recursion_depth_exceeding_limit` future-incompatibility lint
(rust-lang/rust#159228), which is scheduled to become a hard error.

In cryfs-cli the overflowing obligation is the `Send` bound on the boxed
`destroy` future, 

**File**: `crates/blockstore/src/lib.rs` (modified, +4/-0)
```diff
@@ -1,3 +1,7 @@
+// Raise the trait-solver recursion limit above rustc's default of 128: proving
+// `generic_array::ArrayLength` for our typenum-parameterized ciphers overflows
+// it. See crates/crypto/src/lib.rs for the full explanation.
+#![recursion_limit = "512"]
 // TODO #![deny(missing_docs)]
 // TODO Forbid unsafe code?
 
```

**File**: `crates/check/src/lib.rs` (modified, +4/-0)
```diff
@@ -1,3 +1,7 @@
+// Raise the trait-solver recursion limit above rustc's default of 128: proving
+// `generic_array::ArrayLength` for our typenum-parameterized ciphers overflows
+// it. See crates/crypto/src/lib.rs for the full explanation.
+#![recursion_limit = "512"]
 #![forbid(unsafe_code)]
 // TODO #![deny(missing_docs)]
 
```

**File**: `crates/check/tests/blob_missing.rs` (modified, +5/-0)
```diff
@@ -1,5 +1,10 @@
 //! Tests where whole blobs are missing
 
+// Raise the trait-solver recursion limit above rustc's default of 128: proving
+// `generic_array::ArrayLength` for our typenum-parameterized ciphers overflows
+// it. See crates/crypto/src/lib.rs for the full explanation.
+#![recursion_limit = "512"]
+
 use rstest::rstest;
 use std::iter;
 
```

**File**: `crates/check/tests/blob_referenced_multiple_times.rs` (modified, +5/-0)
```diff
@@ -1,6 +1,11 @@
 //! Tests where a blob is referenced multiple times, either from the same or from a different directory
 //! Note: Tests for the blob being referenced from an inner node is in [super::node_referenced_multiple_times::root_node_referenced]
 
+// Raise the trait-solver recursion limit above rustc's default of 128: proving
+// `generic_array::ArrayLength` for our typenum-parameterized ciphers overflows
+// it. See crates/crypto/src/lib.rs for the full explanation.
+#![recursion_limit = "512"]
+
 use futures::future::BoxFuture;
 use rstest::rstest;
 use std::collections::BTreeSet;
```

**File**: `crates/check/tests/blob_unreadable.rs` (modified, +5/-0)
```diff
@@ -1,5 +1,10 @@
 //! Tests where all individual nodes are readable but there is something wrong in the blob data.
 
+// Raise the trait-solver recursion limit above rustc's default of 128: proving
+// `generic_array::ArrayLength` for our typenum-parameterized ciphers overflows
+// it. See crates/crypto/src/lib.rs for the full explanation.
+#![recursion_limit = "512"]
+
 use rstest::rstest;
 use std::iter;
 
```

**File**: `crates/check/tests/blob_unreferenced.rs` (modified, +5/-0)
```diff
@@ -1,5 +1,10 @@
 //! Tests where there are blobs that aren't referenced from anywhere
 
+// Raise the trait-solver recursion limit above rustc's default of 128: proving
+// `generic_array::ArrayLength` for our typenum-parameterized ciphers overflows
+// it. See crates/crypto/src/lib.rs for the full explanation.
+#![recursion_limit = "512"]
+
 use futures::future::BoxFuture;
 use rstest::rstest;
 use std::iter;
```

**File**: `crates/check/tests/blob_with_wrong_parent_pointer.rs` (modified, +5/-0)
```diff
@@ -1,5 +1,10 @@
 //! Tests where blobs have wrong parent pointers set
 
+// Raise the trait-solver recursion limit above rustc's default of 128: proving
+// `generic_array::ArrayLength` for our typenum-parameterized ciphers overflows
+// it. See crates/crypto/src/lib.rs for the full explanation.
+#![recursion_limit = "512"]
+
 use futures::future::BoxFuture;
 use rstest::rstest;
 use std::collections::BTreeSet;
```

**File**: `crates/check/tests/node_missing.rs` (modified, +5/-0)
```diff
@@ -1,5 +1,10 @@
 //! Tests where individual nodes in a blob are missing
 
+// Raise the trait-solver recursion limit above rustc's default of 128: proving
+// `generic_array::ArrayLength` for our typenum-parameterized ciphers overflows
+// it. See crates/crypto/src/lib.rs for the full explanation.
+#![recursion_limit = "512"]
+
 use rstest::rstest;
 use std::iter;
 
```

---

### Incident Patch 11: `d16752ff` (2026-09-06)
**Commit Message**: Don't build every pull request commit twice (#584)

on: [push, pull_request] was unfiltered, so a branch pushed in this repository
and then opened as a pull request fired two full runs for the same commit. This
matrix is 255 jobs (72 test, 180 crates_individually_testable, 3 others), so
each pull request update cost 510.

Observed directly: runs 1102 (push) and 1103 (pull_request) both ran head
6e9c8fd9, created 26 seconds apart, and likewise 1100 and 1101 on e86c8c0f.

The concurrency block below does not collapse these. github.ref is
refs/heads/<branch> for the push run but refs/pull/N/merge for the pull request
run, so the two land in different groups and both survive. It only cancels
superseded runs of the same kind, which is a different and still useful thing.

Narrowing push rather than pull_request is deliberate: a pull_request run checks
out the merge of the branch into its base, a push run checks out the branch head
as it is. For a branch whose purpose is to carry a pull request, the merge
result is the interesting one.

feature/** is kept because Rust feature branches such as
feature/cachingfsblobstore push-build with this workflow. develop and master are
not listed, they

**File**: `.github/workflows/ci.yml` (modified, +11/-2)
```diff
@@ -4,8 +4,17 @@ permissions:
   contents: read
 
 on:
-  - push
-  - pull_request
+  # Only the long-lived branches build on push. A branch that exists to carry a pull
+  # request is already built by the pull_request trigger below, and an unfiltered push
+  # trigger meant every such commit was built twice: once as the branch head, once as
+  # the merge with the base. Tags stay listed so release tags still get a build.
+  push:
+    branches:
+      - main
+      - 'feature/**'
+    tags:
+      - '**'
+  pull_request:
 
 # Cancel in-progress runs on the same ref when a new commit is pushed,
 # so a fix-up push doesn't have to wait behind the superseded run.
```

---

### Incident Patch 12: `b786b0f8` (2026-05-13)
**Commit Message**: rustfs: fix flaky test deadlock in FUSE teardown

When running unprivileged, fuser unmounts via a lazy umount2(MNT_DETACH),
which doesn't abort the FUSE connection until the kernel destroys the
superblock. If kernel-side references pinned by earlier LOOKUP/MKDIR
replies linger, the background thread stays blocked in read() on
/dev/fuse, and the join() in RunningFilesystem::drop hangs the test run
forever. This is flaky: it only triggers with in-process test
parallelism plus machine load (when the kernel doesn't get around to
tearing the superblock down before the join).

Fix, test-only: Runner::drop writes "1" to
/sys/fs/fuse/connections/<id>/abort before the RunningFilesystem field
drops. That invokes fuse_abort_conn directly, so the blocked read()
returns ENODEV regardless of what still pins the superblock and the
join can't hang. The connection id (= minor(st_dev) of the mountpoint)
is resolved via /proc/self/mountinfo rather than stat(), which would
send the mock filesystem a GETATTR it doesn't expect. Runner::drop then
unmounts explicitly and fails the test loudly on unmount/destroy
errors, which production's RunningFilesystem::drop deliberately only
logs.

Verified: with the 

**File**: `crates/rustfs/src/backend/running_filesystem.rs` (modified, +10/-0)
```diff
@@ -36,6 +36,16 @@ impl BackgroundSession for fuser::BackgroundSession {
         // is what actively unmounts. It returns `Err` if the unmount failed OR the background thread
         // (which runs `destroy()`) panicked — fuser converts that thread panic into an `io::Error`. We
         // surface that to the caller rather than deciding here, so each call site picks its own policy.
+        //
+        // NOTE: when unprivileged, `umount_and_join()` unmounts via a lazy `umount2(MNT_DETACH)`, which
+        // does not abort the FUSE connection until the kernel destroys the superblock. If kernel-side
+        // references linger (e.g. dcache entries pinned by earlier lookups), the background thread can
+        // block in `read()` on `/dev/fuse` and this join can hang. The test harness force-aborts the
+        // connection on teardown to avoid exactly this; production relies on the kernel tearing the
+        // connection down on its own (production doesn't unmount mid-activity, so it isn't seen there).
+        // TODO If a production hang is ever observed here, escalate to "join with a timeout, abort the
+        // connection only if it doesn't complete" — never an unconditional abort, which would fail any
+        // in-flight request on every unmount.
         self.umount_and_join()
     }
     fn is_finished(&self) -> bool {
```

**File**: `crates/rustfs/src/tests/utils/fuser_runner.rs` (modified, +78/-5)
```diff
@@ -66,17 +66,90 @@ impl Runner {
 
 impl Drop for Runner {
     fn drop(&mut self) {
-        // Production's `RunningFilesystem::Drop` only logs unmount/destroy failures; in tests we want
-        // them to fail loudly. Unmount explicitly here (which also ensures it happens before the mock
-        // `_implementation` drops, matching the required member order) and `safe_panic!` on error —
-        // that panics normally, but degrades to stderr if we're already unwinding (e.g. an assertion
-        // already failed), avoiding a double-panic abort that would mask the original failure.
+        // The fuser background thread blocks in `read()` on `/dev/fuse` until
+        // the FUSE connection is aborted. When unprivileged, fuser's own drop
+        // only does a lazy `umount2(MNT_DETACH)`, which defers that abort until
+        // the kernel evicts the dcache entries pinned by our `LOOKUP`/`MKDIR`
+        // calls — so the `join()` in `RunningFilesystem::drop` (the
+        // `_running_filesystem` field, dropped right after this body) can hang
+        // forever. Force the abort here, while we still hold the mountpoint, so
+        // the join completes. This is deliberately a test-only concern:
+        // production lets the kernel tear the connection down on its own and
+        // must not force-abort in-flight requests on every unmount.
+        #[cfg(target_os = "linux")]
+        force_abort_fuse_connection(self.mountpoint.path());
+
+        // Unmount explicitly and fail the test loudly on error. The unmount also
+        // happens when the `_running_filesystem` field is dropped right after this
+        // body, but `RunningFilesystem::Drop` only *logs* unmount/destroy failures
+        // (correct for production, where aborting a user's process on a benign
+        // unmount hiccup is worse than logging). In tests we want those failures —
+        // including a panic in the background thread's `destroy()`, which fuser
+        // surfaces as an `Err` from `unmount_join` — to fail the test. The
+        // force-abort above ensures this `unmount_join` doesn't itself hang.
+        // `safe_panic!` panics normally but degrades to stderr if we're already
+        // unwinding (e.g. an assertion already failed), avoiding a double-panic
+        // abort that would mask the original failure.
         if let Err(err) = self._running_filesystem.unmount_join() {
             safe_panic!("Test filesystem unmount failed: {err}");
         }
     }
 }
 
+/// Writes `"1"` to `/sys/fs/fuse/connections/<id>/abort`, which calls
+/// `fuse_abort_conn` directly and makes the background thread's blocked
+/// `read()` return regardless of dcache state. Best-effort: a missing control
+/// file means the kernel already tore the connection down on its own.
+#[cfg(target_os = "linux")]
+fn force_abort_fuse_connection(mountpoint: &std::path::Path) {
+    let Some(id) = fuse_connection_id_for_mountpoint(mountpoint) else {
+        return;
+    };
+    let path = format!("/sys/fs/fuse/connections/{id}/abort");
+    if let Err(err) = std::fs::write(&path, b"1") {
+        if err.kind() != std::io::ErrorKind::NotFound {
+            log::warn!("Failed to write FUSE abort file {path}: {err}");
+        }
+    }
+}
+
+/// Resolves a FUSE mountpoint to its connection id (= `minor(st_dev)`) via
+/// `/proc/self/mountinfo`. Reading mountinfo avoids `stat`-ing the mountpoint,
+/// which would issue a `GETATTR` the mock filesystem doesn't expect.
+#[cfg(target_os = "linux")]
+fn fuse_connection_id_for_mountpoint(mountpoint: &std::path::Path) -> Option<u32> {
+    // mountinfo stores kernel-canonicalized absolute paths. Canonicalize the
+    // *parent* and re-join the final component so a symlinked `$TMPDIR` still
+    // matches, without `stat`-ing the mountpoint itself.
+    let mountpoint = match (mountpoint.parent(), mountpoint.file_name()) {
+        (Some(parent), Some(name)) => std::fs::canonicalize(parent)
+            .map(|p| p.join(name))
+            .unwrap_or_else(|_| mountpoint.to_path_buf()),
+        _ => mountpoint.to_path_buf(),
+    };
+    let mountpoint_str = mountpoint.to_str()?;
+    let mountinfo = std::fs::read_to_string("/proc/self/mountinfo").ok()?;
+    for line in mountinfo.lines() {
+        // Format: mount_id parent_id major:minor root mountpoint mount_opts ...
+        let mut fields = line.split_whitespace();
+        let _mount_id = fields.next()?;
+        let _parent_id = fields.next()?;
+        let major_minor = fields.next()?;
+        let _root = fields.next()?;
+        let mp = fields.next()?;
+        if mp == mountpoint_str {
+            let (_major, minor) = major_minor.split_once(':')?;
+            return minor.parse().ok();
+        }
+    }
+    log::warn!(
+        "Could not resolve FUSE connection id for mountpoint {mountpoint_str} \
+         in /proc/self/mountinfo; teardown will fall back to fuser's lazy \
+         unmount, which may hang"
+    );
+    None
+}
```

---

### Incident Patch 13: `d2fdee09` (2026-06-14)
**Commit Message**: ci: fix macOS jobs — skip FUSE-mounting + DNS-dependent tests (#556)

* ci: also skip fuser_runner self-tests on GitHub-hosted macOS

The --skip tests::mkdir:: filter added for the macFUSE kext problem
(GitHub-hosted macOS runners can't approve the kext, so FUSE mounts
hang forever — actions/runner-images#4731) missed two tests:
crates/rustfs/src/tests/utils/fuser_runner.rs has its own `mod tests`
with mock_expectations_work_correctly and setup_doesnt_panic, both of
which also mount a real FUSE session. Their full names live under
tests::utils::fuser_runner::, which the mkdir filter doesn't match.

Result on main run 26851126522: every macOS test job hung at

  running 2 tests
  test tests::utils::fuser_runner::tests::mock_expectations_work_correctly has been running for over 60 seconds
  test tests::utils::fuser_runner::tests::setup_doesnt_panic has been running for over 60 seconds

until the 6h job cap, with orphan mount_macfuse processes reaped in
job cleanup.

Add --skip tests::utils::fuser_runner:: alongside the existing filter.
Verified locally that the combined filters leave 0 tests in the
cryfs-rustfs lib binary (every test there mounts FUSE) and that no
other workspace cra

**File**: `.github/workflows/ci.yml` (modified, +22/-10)
```diff
@@ -53,15 +53,18 @@ jobs:
       - name: cargo ${{ matrix.command }}
         shell: bash
         # On GitHub-hosted macOS runners we have to skip the cryfs-rustfs
-        # tests under `tests::mkdir::`: they mount real FUSE sessions via
-        # fuser → macFUSE, and the runner image won't approve macFUSE's
-        # kernel extension (https://github.com/actions/runner-images/issues/4731),
-        # so the mount() syscall hangs forever and the job runs out the
-        # 6h clock. The tests still work on a local macOS where the
-        # operator has approved the kext, so we deliberately don't
-        # cfg-gate them out at compile time — only this CI invocation
-        # skips them. Keep the filter in sync with the test module paths
-        # under crates/rustfs/src/tests/.
+        # tests that mount real FUSE sessions via fuser → macFUSE: the
+        # runner image won't approve macFUSE's kernel extension
+        # (https://github.com/actions/runner-images/issues/4731), so the
+        # mount() syscall hangs forever and the job runs out the 6h clock.
+        # That's all tests under crates/rustfs/src/tests/ — currently the
+        # `tests::mkdir::` module and the fuser_runner self-tests in
+        # `tests::utils::fuser_runner::`. The tests still work on a local
+        # macOS where the operator has approved the kext, so we
+        # deliberately don't cfg-gate them out at compile time — only this
+        # CI invocation skips them. The --skip filters match by substring;
+        # keep them in sync with the test module paths under
+        # crates/rustfs/src/tests/.
         #
         # TODO Find a way to run these tests on GitHub-hosted macOS too:
         #   1. Switch to fuse-t (https://www.fuse-t.org/) — userspace
@@ -75,7 +78,16 @@ jobs:
         #      the FUSE session/mountpoint plumbing could be stubbed.
         run: |
           if [[ "${{ runner.os }}" == "macOS" ]]; then
-            cargo ${{ matrix.command }} ${{ matrix.features }} ${{ matrix.profile }} -- --skip tests::mkdir::
+            # Also skip http_client::test_get_valid_{http,https}: they hit
+            # http://example.com / https://example.com over the real network,
+            # so they fail whenever the runner's DNS resolver hiccups
+            # (observed on macos-15-intel: getaddrinfo returned EAI_NONAME
+            # for example.com mid-job even though DNS had worked at job
+            # start — macOS runners have a history of flaky resolver
+            # behavior, e.g. actions/runner-images#12562, #8649). They're
+            # reqwest smoke tests, not cryfs unit tests, and still run on
+            # Linux CI and locally.
+            cargo ${{ matrix.command }} ${{ matrix.features }} ${{ matrix.profile }} -- --skip tests::mkdir:: --skip tests::utils::fuser_runner:: --skip version::http_client::tests::reqwest_http_client::test_get_valid_
           else
             cargo ${{ matrix.command }} ${{ matrix.features }} ${{ matrix.profile }}
           fi
```

---

### Incident Patch 14: `fbf5afda` (2026-06-12)
**Commit Message**: cli-utils: fix broken intra-doc link to default_log_config (#555)

* cli-utils: fix broken intra-doc link to default_log_config

The doc comment on Application::main referenced
[`default_log_config`], but bare item links resolve in the surrounding
scope, not within the trait, so rustdoc fails with "unresolved link"
— which fails the Find dead doc links CI job (RUSTDOCFLAGS=-Dwarnings):

  error: unresolved link to `default_log_config`
    --> crates/cli-utils/src/application.rs:54:49

Qualify it as [`Self::default_log_config`], same style as the
[`Application::default_log_config`] link a few lines up.

Verified locally: RUSTDOCFLAGS="-Dwarnings" cargo doc -p cryfs-cli-utils
--no-deps passes.

* cryfs-runner: de-link doc references to private items

cargo doc with -Dwarnings (the Find dead doc links CI job) rejects
intra-doc links from public documentation to private items. The
fork+exec daemon commits added six such links:

  spawn.rs (docs of pub start_background_process):
    [`DAEMON_FLAG`], [`CHILD_REQUEST_RECV_FD`],
    [`CHILD_RESPONSE_SEND_FD`], [`super::pipe::pipe`],
    [`HANDSHAKE_TIMEOUT`]
  lib.rs (docs of pub run_as_background_daemon):
    [`background_process::backgro

**File**: `crates/cli-utils/src/application.rs` (modified, +1/-1)
```diff
@@ -51,7 +51,7 @@ pub trait Application: Sized {
 
     /// Entry point. `log_args` is the parsed `--log` flag values (possibly
     /// empty). For most apps this can be ignored — [`run`] has already
-    /// initialized logging from these args + [`default_log_config`]. Apps
+    /// initialized logging from these args + [`Self::default_log_config`]. Apps
     /// that need to forward the config elsewhere (e.g. to a daemon child
     /// via RPC) can resolve `log_args.or_default(...)` themselves with a
     /// destination-appropriate default.
```

**File**: `crates/cryfs-runner/src/ipc/spawn.rs` (modified, +5/-5)
```diff
@@ -58,14 +58,14 @@ fn daemon_exe_path() -> Result<PathBuf> {
 
 /// Spawn the cryfs daemon as a separate process via fork+exec.
 ///
-/// The current binary is re-execed with the [`DAEMON_FLAG`] sentinel argument
+/// The current binary is re-execed with the `DAEMON_FLAG` sentinel argument
 /// so its `main` can dispatch to [`crate::run_as_background_daemon`]. The
-/// child receives the two pipe ends as fds [`CHILD_REQUEST_RECV_FD`] (3) and
-/// [`CHILD_RESPONSE_SEND_FD`] (4). Every other parent fd is CLOEXEC (see
-/// [`super::pipe::pipe`]) so the kernel closes them during `execve`.
+/// child receives the two pipe ends as fds `CHILD_REQUEST_RECV_FD` (3) and
+/// `CHILD_RESPONSE_SEND_FD` (4). Every other parent fd is CLOEXEC (see
+/// `super::pipe::pipe`) so the kernel closes them during `execve`.
 ///
 /// Waits for a raw build-id handshake (not postcard-encoded) *from* the
-/// daemon child before returning, bounded by [`HANDSHAKE_TIMEOUT`]. Rejects
+/// daemon child before returning, bounded by `HANDSHAKE_TIMEOUT`. Rejects
 /// the spawn if the bytes don't match this process's own compile-time build
 /// id. This catches three classes of mistake at once:
 ///   - macOS-style binary replacement during the spawn window (the daemon
```

**File**: `crates/cryfs-runner/src/lib.rs` (modified, +1/-1)
```diff
@@ -56,7 +56,7 @@ pub fn build_id() -> String {
 ///    *here* (rather than parent-side validation in the daemon) means a
 ///    parent that accidentally exec'd a non-cryfs binary surfaces the
 ///    mistake — a non-cryfs child won't send the expected bytes.
-/// 4. Hand the [`ipc::RpcServer`] to [`background_process::background_main`],
+/// 4. Hand the [`ipc::RpcServer`] to `background_process::background_main`,
 ///    which initializes tokio inside this clean process image and serves the
 ///    mount RPC until the parent drops its client.
 pub fn run_as_background_daemon() -> ! {
```

---

### Incident Patch 15: `a3b28021` (2026-06-02)
**Commit Message**: Fix typo

**File**: `AI_POLICY.md` (modified, +3/-2)
```diff
@@ -22,10 +22,11 @@ This policy explains how AI tools are — and are not — used in this project.
 ## History and disclosure
 
 - CryFS up to version 1.0.3 was written entirely without AI.
-- CryFS 2.0.0-alpha3 is hand-written as well and it feature complete.
+- CryFS 2.0.0-alpha3 is hand-written as well and is feature complete. This means
+  all important functional pieces of CryFS 2.0 have been written without AI.
   In commits after 2.0.0-alpha3 towards the 2.0 release, AI has helped polish
   the code, write and fix tests. AI has **not** made any security-relevant
-  changes in 2.0. All important pieces of 2.0 were built without AI.
+  changes in 2.0.
 - Going forward (versions past 2.0), AI may be used more heavily, including for
   feature development — always under the principles above.
 
```

#### Recent Merged Pull Requests:
- **PR #673** (2026-09-29): Add TODOs for the rename follow-ups found while fixing #672 (@smessmer)
- **PR #672** (2026-09-29): Don't lose the source entry when a rename across directories is rejected (@smessmer)
- **PR #671** (2026-09-23): Shorten the 1.1.0 ChangeLog entries and link the PRs (@smessmer)
- **PR #670** (2026-09-22): Stop the cache flush thread before destructing the cache (@smessmer)
- **PR #669** (2026-09-23): Don't fail the CallAfterTimeout reset tests when a sleep overshoots (@smessmer)
- **PR #668** (2026-09-18): Fix the flaky CacheTest_PushAndPop.AfterTimeout (@smessmer)
- **PR #667** (2026-09-18): Print a backtrace when a test binary crashes (@smessmer)
- **PR #666** (2026-09-18): Print a backtrace for test binaries that dump core on CI (@smessmer)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
